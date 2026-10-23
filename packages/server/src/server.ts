import http from 'node:http';
import https from 'node:https';
import { WebSocketServer, WebSocket } from 'ws';
import {
  StreamProtocol,
  StreamMetadata,
  SignalingMessage,
  createMessage,
  parseSignalingMessage,
  DEFAULT_ICE_SERVERS,
  DEFAULT_SIGNALING_PATH,
  DEFAULT_HLS_PATH,
  IceServer,
} from './core/index.js';
import { StreamRoomManager, StreamRoom } from './room-manager.js';
import { AuthGuard, AuthHook } from './auth.js';
import { WebRtcSignaler } from './adapters/webrtc-signaler.js';
import { HlsEngine } from './adapters/hls-engine.js';
import { WebSocketRelay } from './adapters/websocket-relay.js';

export interface StreamServerOptions {
  server?: http.Server | https.Server;
  port?: number;
  signalingPath?: string;
  hlsPath?: string;
  defaultProtocol?: StreamProtocol;
  iceServers?: IceServer[];
  auth?: AuthHook | { defaultStreamKeys?: string[] };
  dvrWindowSeconds?: number;
  onStreamStarted?: (stream: StreamMetadata) => void;
  onStreamEnded?: (streamId: string) => void;
}

export class StreamServer {
  private options: StreamServerOptions;
  private httpServer?: http.Server | https.Server;
  private wss?: WebSocketServer;
  private roomManager: StreamRoomManager;
  private authGuard: AuthGuard;
  private webrtcSignaler: WebRtcSignaler;
  private hlsEngine: HlsEngine;
  private wsRelay: WebSocketRelay;
  private isStandaloneServer: boolean = false;

  constructor(options: StreamServerOptions = {}) {
    this.options = {
      signalingPath: DEFAULT_SIGNALING_PATH,
      hlsPath: DEFAULT_HLS_PATH,
      defaultProtocol: 'webrtc',
      iceServers: DEFAULT_ICE_SERVERS,
      ...options,
    };

    this.roomManager = new StreamRoomManager();
    this.authGuard =
      typeof options.auth === 'function'
        ? new AuthGuard({ authHook: options.auth })
        : new AuthGuard(options.auth);

    this.webrtcSignaler = new WebRtcSignaler();
    this.hlsEngine = new HlsEngine();
    this.wsRelay = new WebSocketRelay();

    if (this.options.server) {
      this.attach(this.options.server);
    }
  }

  /**
   * Attach stream engine to an existing Node.js HTTP/HTTPS server
   */
  public attach(server: http.Server | https.Server): void {
    this.httpServer = server;

    // Attach HLS HTTP route handler listener
    const originalListeners = server.listeners('request').slice(0);
    server.removeAllListeners('request');

    server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
      // Check if request is an HLS streaming route (/live/...)
      const handled = this.hlsEngine.handleHttpRequest(req, res, this.options.hlsPath);
      if (!handled) {
        // Forward to other application handlers (e.g. Express, Next.js)
        for (const listener of originalListeners) {
          listener.call(server, req, res);
        }
      }
    });

    // Initialize WebSocket signaling server on the HTTP server
    this.wss = new WebSocketServer({
      noServer: true,
    });

    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === this.options.signalingPath) {
        this.wss?.handleUpgrade(req, socket, head, (ws) => {
          this.wss?.emit('connection', ws, req);
        });
      }
    });

    this.setupWebSocketServer();
  }

  /**
   * Start as a standalone HTTP and streaming server
   */
  public async listen(port: number = 4000, host?: string): Promise<void> {
    this.isStandaloneServer = true;
    const server = http.createServer((req, res) => {
      const handled = this.hlsEngine.handleHttpRequest(req, res, this.options.hlsPath);
      if (!handled) {
        if (req.url === '/health' || req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'ok',
              activeStreams: this.roomManager.getAllActiveStreams().length,
              streams: this.roomManager.getAllActiveStreams(),
            })
          );
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      }
    });

    this.attach(server);

    return new Promise((resolve) => {
      server.listen(port, host, () => {
        resolve();
      });
    });
  }

  private setupWebSocketServer(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      let currentRoom: StreamRoom | null = null;
      let participantId: string | null = null;
      let participantRole: string | null = null;

      // Heartbeat ping-pong
      let isAlive = true;
      ws.on('pong', () => {
        isAlive = true;
      });

      const pingInterval = setInterval(() => {
        if (!isAlive) {
          clearInterval(pingInterval);
          ws.terminate();
          return;
        }
        isAlive = false;
        ws.ping();
      }, 30000);

      ws.on('message', async (raw: string | Buffer | ArrayBuffer) => {
        const message = parseSignalingMessage(raw);
        if (!message) return;

        try {
          switch (message.type) {
            case 'auth': {
              const { token, streamKey, streamId, role, name, protocol } = message.data;
              const authRes = await this.authGuard.authenticate({
                token,
                streamKey,
                streamId,
                role,
                clientIp: req.socket.remoteAddress,
              });

              if (!authRes.valid) {
                ws.send(
                  JSON.stringify(
                    createMessage('auth_ack', {
                      success: false,
                      error: authRes.error || 'Authentication failed',
                      participantId: '',
                      streamId,
                      role,
                      isBroadcaster: false,
                      protocol: protocol || this.options.defaultProtocol || 'webrtc',
                    })
                  )
                );
                ws.close(4001, authRes.error);
                return;
              }

              participantId = authRes.userId || `p_${Date.now()}`;
              participantRole = role;
              const chosenProtocol = protocol || this.options.defaultProtocol || 'webrtc';
              currentRoom = this.roomManager.getOrCreateRoom(streamId, chosenProtocol);

              const participant = {
                id: participantId,
                name: authRes.userName || name || (role === 'broadcaster' ? 'Host' : 'Viewer'),
                role,
                joinedAt: Date.now(),
              };

              if (role === 'broadcaster') {
                currentRoom.setBroadcaster(participant, ws);
                if (this.options.onStreamStarted) {
                  this.options.onStreamStarted(currentRoom.metadata);
                }
                // Notify any waiting viewers that the stream is now LIVE
                currentRoom.broadcastToViewers(
                  createMessage(
                    'stream_started',
                    {
                      streamId,
                      protocol: currentRoom.protocol,
                      metadata: currentRoom.metadata,
                    },
                    streamId
                  )
                );
              } else {
                currentRoom.addViewer(participant, ws);
                // If using WebSocket fallback protocol, catch up viewer with keyframe buffer
                if (currentRoom.protocol === 'websocket') {
                  this.wsRelay.catchUpViewer(currentRoom, ws);
                }
              }

              // Send auth acknowledgment
              ws.send(
                JSON.stringify(
                  createMessage('auth_ack', {
                    success: true,
                    participantId,
                    streamId,
                    role,
                    isBroadcaster: role === 'broadcaster',
                    iceServers: this.options.iceServers,
                    protocol: currentRoom.protocol,
                    metadata: currentRoom.metadata,
                  })
                )
              );

              // If broadcaster just joined, inform them about all already-waiting viewers so offers are generated
              if (role === 'broadcaster') {
                for (const viewer of currentRoom.viewers.values()) {
                  ws.send(
                    JSON.stringify(
                      createMessage('peer_joined', { participant: viewer.participant }, streamId, viewer.participant.id)
                    )
                  );
                }
              }

              // Broadcast peer joined & viewer count updates
              currentRoom.broadcast(
                createMessage('peer_joined', { participant }, streamId, participantId),
                participantId
              );

              currentRoom.broadcast(
                createMessage(
                  'viewer_count_update',
                  { streamId, count: currentRoom.viewers.size },
                  streamId
                )
              );

              // Notify new viewer of stream state
              if (role === 'viewer') {
                ws.send(
                  JSON.stringify(
                    createMessage('joined_stream', {
                      streamId,
                      broadcasterOnline: !!currentRoom.broadcaster,
                      viewerCount: currentRoom.viewers.size,
                      metadata: currentRoom.metadata,
                    })
                  )
                );
              }
              break;
            }

            case 'offer':
            case 'answer': {
              if (currentRoom) {
                this.webrtcSignaler.handleSdp(currentRoom, message);
              }
              break;
            }

            case 'ice_candidate': {
              if (currentRoom) {
                this.webrtcSignaler.handleIceCandidate(currentRoom, message);
              }
              break;
            }

            case 'stream_chunk': {
              if (currentRoom && participantRole === 'broadcaster') {
                this.wsRelay.handleChunk(currentRoom, message.data);
              }
              break;
            }

            case 'chat_message': {
              if (currentRoom) {
                currentRoom.broadcast(message);
              }
              break;
            }

            case 'ping': {
              ws.send(JSON.stringify(createMessage('pong', { timestamp: Date.now() })));
              break;
            }
          }
        } catch (err) {
          console.error('Error handling signaling message:', err);
        }
      });

      ws.on('close', () => {
        clearInterval(pingInterval);
        if (currentRoom && participantId) {
          const removedRole = currentRoom.removeParticipant(participantId);

          if (removedRole === 'broadcaster') {
            currentRoom.broadcast(
              createMessage('stream_ended', { streamId: currentRoom.streamId }, currentRoom.streamId)
            );
            this.wsRelay.clearBuffer(currentRoom.streamId);
            if (this.options.onStreamEnded) {
              this.options.onStreamEnded(currentRoom.streamId);
            }
          } else {
            currentRoom.broadcast(
              createMessage(
                'peer_left',
                { participantId, role: (participantRole as any) || 'viewer' },
                currentRoom.streamId
              )
            );
            currentRoom.broadcast(
              createMessage(
                'viewer_count_update',
                { streamId: currentRoom.streamId, count: currentRoom.viewers.size },
                currentRoom.streamId
              )
            );
          }
        }
      });
    });
  }

  /**
   * Feed video chunk or segment directly to HLS engine
   */
  public pushHlsSegment(
    streamId: string,
    data: Buffer,
    durationSec?: number,
    quality?: string
  ): void {
    this.hlsEngine.pushSegment(streamId, data, durationSec, quality);
  }

  public getHlsEngine(): HlsEngine {
    return this.hlsEngine;
  }

  public getRoomManager(): StreamRoomManager {
    return this.roomManager;
  }

  public getAuthGuard(): AuthGuard {
    return this.authGuard;
  }

  public async close(): Promise<void> {
    if (this.wss) {
      this.wss.close();
    }
    if (this.isStandaloneServer && this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer?.close(() => resolve());
      });
    }
  }
}

/**
 * Convenience factory function to create a StreamServer instance
 */
export function createStreamServer(options: StreamServerOptions = {}): StreamServer {
  return new StreamServer(options);
}
