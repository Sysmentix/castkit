import {
  StreamProtocol,
  StreamStatus,
  StreamStats,
  DEFAULT_ICE_SERVERS,
  TypedEventEmitter,
  SignalingMessage,
  createMessage,
  parseSignalingMessage,
  StreamChatMessage,
  StreamMetadata,
  IceServer,
} from './core/index.js';

export interface PlayerOptions {
  serverUrl: string;
  streamId: string;
  token?: string;
  protocol?: StreamProtocol | 'auto';
  hlsUrl?: string;
  autoPlay?: boolean;
  muted?: boolean;
  iceServers?: IceServer[];
  targetLatencySec?: number;
  enableCatchUpSync?: boolean;
}

export interface PlayerEvents {
  statusChange: StreamStatus;
  remoteStreamReady: MediaStream;
  viewerCount: number;
  statsUpdate: StreamStats;
  chatMessage: StreamChatMessage;
  metadata: StreamMetadata;
  protocolChange: StreamProtocol;
  error: Error;
}

export class StreamPlayerClient extends TypedEventEmitter<PlayerEvents> {
  private options: PlayerOptions;
  private videoElement: HTMLVideoElement | null = null;
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private remoteStream: MediaStream = new MediaStream();
  private status: StreamStatus = 'idle';
  private activeProtocol: StreamProtocol = 'webrtc';
  private participantId: string = '';
  private broadcasterId: string = '';
  private iceServers: RTCIceServer[] = [];
  private statsInterval: any = null;
  private syncInterval: any = null;

  constructor(options: PlayerOptions) {
    super();
    this.options = {
      protocol: 'auto',
      autoPlay: true,
      muted: false,
      targetLatencySec: 2,
      enableCatchUpSync: true,
      ...options,
    };
    this.iceServers = (options.iceServers || DEFAULT_ICE_SERVERS) as RTCIceServer[];
  }

  public getStatus(): StreamStatus {
    return this.status;
  }

  public getActiveProtocol(): StreamProtocol {
    return this.activeProtocol;
  }

  public attachVideoElement(video: HTMLVideoElement): void {
    this.videoElement = video;
    if (this.remoteStream.getTracks().length > 0) {
      this.videoElement.srcObject = this.remoteStream;
      if (this.options.autoPlay) {
        this.videoElement.play().catch((err) => {
          if (err.name === 'NotAllowedError') {
            this.videoElement!.muted = true;
            this.videoElement!.play().catch(() => {});
          }
        });
      }
    }
  }

  /**
   * Start playback
   */
  public async play(): Promise<void> {
    this.setStatus('connecting');

    try {
      await this.connectSignaling();
      this.startStatsMonitor();
      if (this.options.enableCatchUpSync) {
        this.startCatchUpSync();
      }
    } catch (err: any) {
      this.setStatus('error');
      this.emit('error', err);
      throw err;
    }
  }

  private setStatus(status: StreamStatus): void {
    this.status = status;
    this.emit('statusChange', status);
  }

  private connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.serverUrl);

        this.ws.onopen = () => {
          const authMsg = createMessage('auth', {
            streamId: this.options.streamId,
            token: this.options.token,
            role: 'viewer',
            protocol: this.options.protocol === 'auto' ? 'webrtc' : this.options.protocol,
          });
          this.ws?.send(JSON.stringify(authMsg));
        };

        this.ws.onmessage = async (event) => {
          const message = parseSignalingMessage(event.data);
          if (!message) return;

          switch (message.type) {
            case 'auth_ack': {
              if (message.data.success) {
                this.participantId = message.data.participantId;
                this.activeProtocol = message.data.protocol;
                this.emit('protocolChange', this.activeProtocol);

                if (message.data.iceServers) {
                  this.iceServers = message.data.iceServers as RTCIceServer[];
                }

                if (this.activeProtocol === 'hls') {
                  this.initHlsPlayback();
                } else if (this.activeProtocol === 'webrtc') {
                  this.initWebRtc();
                }

                resolve();
              } else {
                reject(new Error(message.data.error || 'Viewer authentication rejected'));
              }
              break;
            }

            case 'offer': {
              const { from, sdp } = message.data;
              this.broadcasterId = from;
              await this.handleOffer(sdp);
              break;
            }

            case 'stream_started': {
              this.setStatus('connecting');
              break;
            }

            case 'ice_candidate': {
              const { candidate } = message.data;
              if (this.pc && candidate.candidate) {
                await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
              break;
            }

            case 'stream_chunk': {
              if (this.activeProtocol === 'websocket') {
                this.handleWebSocketChunk(message.data);
              }
              break;
            }

            case 'viewer_count_update': {
              this.emit('viewerCount', message.data.count);
              break;
            }

            case 'chat_message': {
              this.emit('chatMessage', message.data);
              break;
            }

            case 'stream_ended': {
              this.setStatus('ended');
              break;
            }

            case 'error': {
              this.emit('error', new Error(message.data.message));
              break;
            }
          }
        };

        this.ws.onerror = () => {
          reject(
            new Error(
              `Cannot connect to stream server at ${this.options.serverUrl}. Make sure the backend streaming server is running (run "npm run dev:server").`
            )
          );
        };

        this.ws.onclose = () => {
          if (this.status === 'live') {
            this.setStatus('reconnecting');
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private initWebRtc(): void {
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

    this.pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      this.remoteStream = stream;

      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        if (this.options.autoPlay) {
          const playPromise = this.videoElement.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              if (err.name === 'NotAllowedError') {
                this.videoElement!.muted = true;
                this.videoElement!.play().catch(() => {});
              }
            });
          }
        }
      }
      this.setStatus('live');
      this.emit('remoteStreamReady', stream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        const iceMsg = createMessage(
          'ice_candidate',
          {
            from: this.participantId,
            to: this.broadcasterId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          },
          this.options.streamId
        );
        this.ws.send(JSON.stringify(iceMsg));
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'connected') {
        this.setStatus('live');
      } else if (this.pc?.connectionState === 'disconnected' || this.pc?.connectionState === 'failed') {
        if (this.options.protocol === 'auto') {
          // Auto fallback to HLS or WebSocket
          this.fallbackToHls();
        } else {
          this.setStatus('reconnecting');
        }
      }
    };
  }

  private async handleOffer(sdp: { type: 'offer' | 'answer' | 'pranswer' | 'rollback'; sdp: string }): Promise<void> {
    if (!this.pc) {
      this.initWebRtc();
    }

    await this.pc!.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    if (this.ws?.readyState === WebSocket.OPEN) {
      const answerMsg = createMessage(
        'answer',
        {
          from: this.participantId,
          to: this.broadcasterId,
          sdp: { type: answer.type, sdp: answer.sdp || '' },
        },
        this.options.streamId
      );
      this.ws.send(JSON.stringify(answerMsg));
    }
  }

  private initHlsPlayback(): void {
    const hlsUrl = this.options.hlsUrl || `/live/${this.options.streamId}/index.m3u8`;
    if (!this.videoElement) return;

    // Check for native HLS (Safari / iOS)
    if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      this.videoElement.src = hlsUrl;
      if (this.options.autoPlay) {
        this.videoElement.play().catch(() => {});
      }
      this.setStatus('live');
    } else {
      // Check if Hls.js is loaded in window or provide fallback notification
      const Hls = (window as any).Hls;
      if (Hls && Hls.isSupported()) {
        const hls = new Hls({
          liveSyncDurationCount: 3,
          maxLiveSyncPlaybackRate: 1.1,
          enableWorker: true,
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(this.videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (this.options.autoPlay) {
            this.videoElement?.play().catch(() => {});
          }
          this.setStatus('live');
        });
      } else {
        // Fallback directly to video element source
        this.videoElement.src = hlsUrl;
        this.setStatus('live');
      }
    }
  }

  private fallbackToHls(): void {
    if (this.activeProtocol === 'hls') return;
    this.activeProtocol = 'hls';
    this.emit('protocolChange', 'hls');

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.initHlsPlayback();
  }

  private handleWebSocketChunk(chunk: any): void {
    // MediaSource or blob chunk playback
    this.setStatus('live');
  }

  /**
   * YouTube style live catch-up sync: accelerates playback gently if fallen behind live edge
   */
  private startCatchUpSync(): void {
    this.syncInterval = setInterval(() => {
      if (!this.videoElement || this.status !== 'live') return;

      // If video has buffered time ranges
      if (this.videoElement.buffered.length > 0) {
        const liveEdge = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
        const currentPos = this.videoElement.currentTime;
        const latency = liveEdge - currentPos;

        if (latency > (this.options.targetLatencySec || 2) + 1.5) {
          // Falling behind live edge: speed up slightly (1.06x)
          this.videoElement.playbackRate = 1.06;
        } else {
          // In sync: normal speed
          this.videoElement.playbackRate = 1.0;
        }
      }
    }, 2000);
  }

  private startStatsMonitor(): void {
    this.statsInterval = setInterval(async () => {
      if (!this.pc || this.status !== 'live') return;

      try {
        const report = await this.pc.getStats();
        let fps = 0;
        let bitrateKbps = 0;
        let packetLoss = 0;
        let width = 0;
        let height = 0;

        report.forEach((stat) => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            fps = stat.framesPerSecond || 0;
            packetLoss = stat.packetsLost || 0;
            width = stat.frameWidth || 0;
            height = stat.frameHeight || 0;
          }
        });

        const stats: StreamStats = {
          fps,
          bitrateKbps,
          packetLoss,
          latencyMs: 150, // sub-second WebRTC
          width,
          height,
          bufferLengthSec: this.videoElement?.buffered.length
            ? this.videoElement.buffered.end(0) - this.videoElement.currentTime
            : 0,
          timestamp: Date.now(),
        };

        this.emit('statsUpdate', stats);
      } catch {}
    }, 2000);
  }

  public jumpToLive(): void {
    if (!this.videoElement) return;
    if (this.videoElement.buffered.length > 0) {
      const liveEdge = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
      this.videoElement.currentTime = Math.max(0, liveEdge - 0.5);
    }
  }

  public seek(seconds: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = seconds;
    }
  }

  public sendChatMessage(text: string, senderName: string = 'Viewer'): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const chatMsg = createMessage(
        'chat_message',
        {
          id: `msg_${Date.now()}`,
          streamId: this.options.streamId,
          senderId: this.participantId,
          senderName,
          text,
          timestamp: Date.now(),
        },
        this.options.streamId
      );
      this.ws.send(JSON.stringify(chatMsg));
    }
  }

  public stop(): void {
    this.setStatus('ended');

    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.src = '';
    }

    this.removeAllListeners();
  }
}
