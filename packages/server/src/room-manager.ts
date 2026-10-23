import { WebSocket } from 'ws';
import {
  Participant,
  ParticipantRole,
  StreamMetadata,
  StreamProtocol,
  SignalingMessage,
  createMessage,
} from './core/index.js';

export interface RoomParticipant {
  participant: Participant;
  ws: WebSocket;
}

export class StreamRoom {
  public readonly streamId: string;
  public protocol: StreamProtocol;
  public broadcaster: RoomParticipant | null = null;
  public viewers: Map<string, RoomParticipant> = new Map();
  public startedAt: number = 0;
  public isLive: boolean = false;
  public metadata: StreamMetadata;

  constructor(streamId: string, protocol: StreamProtocol = 'webrtc') {
    this.streamId = streamId;
    this.protocol = protocol;
    this.metadata = {
      streamId,
      broadcasterId: '',
      protocol,
      startedAt: 0,
      viewerCount: 0,
      isLive: false,
    };
  }

  public setBroadcaster(participant: Participant, ws: WebSocket): void {
    this.broadcaster = { participant, ws };
    this.isLive = true;
    this.startedAt = Date.now();
    this.metadata.broadcasterId = participant.id;
    this.metadata.isLive = true;
    this.metadata.startedAt = this.startedAt;
  }

  public addViewer(participant: Participant, ws: WebSocket): void {
    this.viewers.set(participant.id, { participant, ws });
    this.metadata.viewerCount = this.viewers.size;
  }

  public removeParticipant(participantId: string): ParticipantRole | null {
    if (this.broadcaster?.participant.id === participantId) {
      this.broadcaster = null;
      this.isLive = false;
      this.metadata.isLive = false;
      return 'broadcaster';
    }

    if (this.viewers.has(participantId)) {
      this.viewers.delete(participantId);
      this.metadata.viewerCount = this.viewers.size;
      return 'viewer';
    }

    return null;
  }

  public broadcast(message: SignalingMessage, excludeParticipantId?: string): void {
    const raw = JSON.stringify(message);

    // Send to broadcaster if not excluded
    if (this.broadcaster && this.broadcaster.participant.id !== excludeParticipantId) {
      if (this.broadcaster.ws.readyState === WebSocket.OPEN) {
        this.broadcaster.ws.send(raw);
      }
    }

    // Send to viewers
    for (const [id, viewer] of this.viewers.entries()) {
      if (id !== excludeParticipantId && viewer.ws.readyState === WebSocket.OPEN) {
        viewer.ws.send(raw);
      }
    }
  }

  public broadcastToViewers(message: SignalingMessage): void {
    const raw = JSON.stringify(message);
    for (const viewer of this.viewers.values()) {
      if (viewer.ws.readyState === WebSocket.OPEN) {
        viewer.ws.send(raw);
      }
    }
  }
}

export class StreamRoomManager {
  private rooms: Map<string, StreamRoom> = new Map();

  public getOrCreateRoom(streamId: string, protocol: StreamProtocol = 'webrtc'): StreamRoom {
    let room = this.rooms.get(streamId);
    if (!room) {
      room = new StreamRoom(streamId, protocol);
      this.rooms.set(streamId, room);
    }
    return room;
  }

  public getRoom(streamId: string): StreamRoom | undefined {
    return this.rooms.get(streamId);
  }

  public removeRoom(streamId: string): void {
    const room = this.rooms.get(streamId);
    if (room) {
      room.broadcast(createMessage('stream_ended', { streamId }, streamId));
      this.rooms.delete(streamId);
    }
  }

  public getAllActiveStreams(): StreamMetadata[] {
    const list: StreamMetadata[] = [];
    for (const room of this.rooms.values()) {
      if (room.isLive) {
        list.push({ ...room.metadata });
      }
    }
    return list;
  }
}
