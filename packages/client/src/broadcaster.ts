import {
  StreamProtocol,
  StreamStatus,
  ResolutionPreset,
  RESOLUTION_PRESETS,
  DEFAULT_ICE_SERVERS,
  TypedEventEmitter,
  SignalingMessage,
  createMessage,
  parseSignalingMessage,
  StreamChatMessage,
  IceServer,
} from './core/index.js';

export interface BroadcasterOptions {
  serverUrl: string;
  streamId: string;
  streamKey?: string;
  token?: string;
  protocol?: StreamProtocol;
  resolution?: ResolutionPreset;
  audio?: boolean;
  video?: boolean;
  cameraDeviceId?: string;
  micDeviceId?: string;
  iceServers?: IceServer[];
}

export interface BroadcasterEvents {
  statusChange: StreamStatus;
  localStreamReady: MediaStream;
  viewerCount: number;
  chatMessage: StreamChatMessage;
  peerJoined: { id: string; name?: string };
  peerLeft: { id: string };
  error: Error;
}

export class StreamBroadcasterClient extends TypedEventEmitter<BroadcasterEvents> {
  private options: BroadcasterOptions;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private mediaRecorder: MediaRecorder | null = null;
  private status: StreamStatus = 'idle';
  private participantId: string = '';
  private iceServers: RTCIceServer[] = [];
  private isSharingScreen: boolean = false;
  private currentCameraId?: string;

  constructor(options: BroadcasterOptions) {
    super();
    this.options = {
      protocol: 'webrtc',
      resolution: '720p',
      audio: true,
      video: true,
      ...options,
    };
    this.currentCameraId = options.cameraDeviceId;
    this.iceServers = (options.iceServers || DEFAULT_ICE_SERVERS) as RTCIceServer[];
  }

  public getStatus(): StreamStatus {
    return this.status;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public isScreenSharing(): boolean {
    return this.isSharingScreen;
  }

  /**
   * Start broadcast: acquire media, connect signaling, and go LIVE
   */
  public async start(): Promise<MediaStream> {
    this.setStatus('connecting');

    try {
      // 1. Acquire Local Media
      await this.initMedia();

      // 2. Connect to WebSocket Signaling Server
      await this.connectSignaling();

      // 3. If WebSocket fallback protocol is chosen, start MediaRecorder chunker
      if (this.options.protocol === 'websocket' && this.localStream) {
        this.startMediaRecorder(this.localStream);
      }

      this.setStatus('live');
      return this.localStream!;
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

  private async initMedia(): Promise<void> {
    const preset = RESOLUTION_PRESETS[this.options.resolution || '720p'];

    const constraints: MediaStreamConstraints = {
      audio: this.options.audio ?? true,
      video: this.options.video
        ? {
            width: { ideal: preset.width },
            height: { ideal: preset.height },
            frameRate: { ideal: preset.frameRate, max: preset.frameRate },
            deviceId: this.currentCameraId ? { exact: this.currentCameraId } : undefined,
          }
        : false,
    };

    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.emit('localStreamReady', this.localStream);
  }

  private connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.serverUrl);

        this.ws.onopen = () => {
          // Send authentication message
          const authMsg = createMessage('auth', {
            streamId: this.options.streamId,
            streamKey: this.options.streamKey,
            token: this.options.token,
            role: 'broadcaster',
            protocol: this.options.protocol,
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
                if (message.data.iceServers) {
                  this.iceServers = message.data.iceServers as RTCIceServer[];
                }
                resolve();
              } else {
                reject(new Error(message.data.error || 'Broadcaster authentication rejected'));
              }
              break;
            }

            case 'peer_joined': {
              const viewer = message.data.participant;
              this.emit('peerJoined', { id: viewer.id, name: viewer.name });

              // In WebRTC mode, create an offer for the new viewer
              if (this.options.protocol === 'webrtc' && this.localStream) {
                await this.createPeerConnectionForViewer(viewer.id);
              }
              break;
            }

            case 'peer_left': {
              const viewerId = message.data.participantId;
              this.closePeerConnection(viewerId);
              this.emit('peerLeft', { id: viewerId });
              break;
            }

            case 'answer': {
              const { from, sdp } = message.data;
              const pc = this.peerConnections.get(from);
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              }
              break;
            }

            case 'ice_candidate': {
              const { from, candidate } = message.data;
              const pc = this.peerConnections.get(from);
              if (pc && candidate.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
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

  private async createPeerConnectionForViewer(viewerId: string): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(viewerId, pc);

    // Add local tracks to peer connection
    if (this.localStream) {
      const preset = RESOLUTION_PRESETS[this.options.resolution || '720p'];
      this.localStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, this.localStream!);
        if (track.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = preset.bitrateKbps * 1000;
            params.encodings[0].maxFramerate = preset.frameRate;
            sender.setParameters(params).catch(() => {});
          } catch {}
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        const iceMsg = createMessage(
          'ice_candidate',
          {
            from: this.participantId,
            to: viewerId,
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

    // Create SDP offer for this viewer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (this.ws?.readyState === WebSocket.OPEN) {
      const offerMsg = createMessage(
        'offer',
        {
          from: this.participantId,
          to: viewerId,
          sdp: { type: offer.type, sdp: offer.sdp || '' },
        },
        this.options.streamId
      );
      this.ws.send(JSON.stringify(offerMsg));
    }
  }

  private closePeerConnection(viewerId: string): void {
    const pc = this.peerConnections.get(viewerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(viewerId);
    }
  }

  /**
   * Screen sharing toggle: switch from camera to screen seamlessly
   */
  public async startScreenShare(): Promise<MediaStream> {
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing not supported on this device/browser');
    }

    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 60, max: 60 },
      },
      audio: true,
    });

    const screenTrack = this.screenStream.getVideoTracks()[0];
    if (screenTrack && this.localStream) {
      const currentVideoTrack = this.localStream.getVideoTracks()[0];

      // Replace track across all active viewer peer connections
      for (const pc of this.peerConnections.values()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      }

      // Handle user clicking native "Stop sharing" chrome banner
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.isSharingScreen = true;
      this.emit('localStreamReady', this.screenStream);
    }

    return this.screenStream;
  }

  public async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    // Restore camera track
    if (this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      for (const pc of this.peerConnections.values()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && cameraTrack) {
          videoSender.replaceTrack(cameraTrack);
        }
      }
      this.emit('localStreamReady', this.localStream);
    }

    this.isSharingScreen = false;
  }

  public async switchCamera(deviceId: string): Promise<void> {
    this.currentCameraId = deviceId;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
    });
    const newTrack = stream.getVideoTracks()[0];

    if (newTrack && this.localStream) {
      const oldTrack = this.localStream.getVideoTracks()[0];
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      this.localStream.addTrack(newTrack);

      for (const pc of this.peerConnections.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      }
      this.emit('localStreamReady', this.localStream);
    }
  }

  public toggleAudio(muted?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return false;

    audioTrack.enabled = muted !== undefined ? !muted : !audioTrack.enabled;
    return !audioTrack.enabled; // returns true if now muted
  }

  public toggleVideo(paused?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return false;

    videoTrack.enabled = paused !== undefined ? !paused : !videoTrack.enabled;
    return !videoTrack.enabled; // returns true if now paused
  }

  public sendChatMessage(text: string, senderName: string = 'Host'): void {
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

  private startMediaRecorder(stream: MediaStream): void {
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')
        ? 'video/webm; codecs=vp8,opus'
        : 'video/webm';

      const preset = RESOLUTION_PRESETS[this.options.resolution || '720p'];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: preset.bitrateKbps * 1000,
      });

      let sequence = 1;
      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          const buffer = await e.data.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          const chunkMsg = createMessage(
            'stream_chunk',
            {
              streamId: this.options.streamId,
              sequence: sequence++,
              isKeyframe: true,
              timestamp: Date.now(),
              mimeType,
              data: base64,
            },
            this.options.streamId
          );
          this.ws.send(JSON.stringify(chunkMsg));
        }
      };

      this.mediaRecorder.start(1000); // 1-second chunks
    } catch (err) {
      console.warn('MediaRecorder chunking failed to initialize:', err);
    }
  }

  /**
   * Stop broadcast completely and clean up all resources
   */
  public stop(): void {
    this.setStatus('ended');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.removeAllListeners();
  }
}
