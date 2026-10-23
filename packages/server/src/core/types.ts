/**
 * Core type definitions for stream-module
 */

export type StreamProtocol = 'webrtc' | 'hls' | 'websocket' | 'rtmp';

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'buffering'
  | 'reconnecting'
  | 'ended'
  | 'error';

export type ParticipantRole = 'broadcaster' | 'viewer' | 'admin';

export interface Participant {
  id: string;
  name?: string;
  role: ParticipantRole;
  joinedAt: number;
  metadata?: Record<string, unknown>;
}

export type ResolutionPreset = '1080p60' | '1080p' | '720p60' | '720p' | '480p' | '360p';

export interface VideoProfile {
  preset: ResolutionPreset;
  width: number;
  height: number;
  frameRate: number;
  bitrateKbps: number;
}

export interface StreamStats {
  fps: number;
  bitrateKbps: number;
  packetLoss: number;
  latencyMs: number;
  width: number;
  height: number;
  bufferLengthSec: number;
  timestamp: number;
}

export interface StreamMetadata {
  streamId: string;
  title?: string;
  broadcasterId: string;
  protocol: StreamProtocol;
  startedAt: number;
  viewerCount: number;
  isLive: boolean;
  dvrWindowSeconds?: number;
  qualities?: ABRQuality[];
}

export interface ABRQuality {
  id: string;
  label: string;
  width: number;
  height: number;
  bitrateKbps: number;
  isDefault?: boolean;
}

export interface StreamChatMessage {
  id: string;
  streamId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}
