import { Participant, ParticipantRole, StreamMetadata, StreamProtocol, StreamChatMessage } from './types.js';
import { IceServer } from './constants.js';

export type SignalingMessageType =
  | 'auth'
  | 'auth_ack'
  | 'join_stream'
  | 'joined_stream'
  | 'peer_joined'
  | 'peer_left'
  | 'stream_started'
  | 'stream_ended'
  | 'offer'
  | 'answer'
  | 'ice_candidate'
  | 'viewer_count_update'
  | 'chat_message'
  | 'stream_chunk'
  | 'ping'
  | 'pong'
  | 'error';

export interface BaseSignalingMessage<T extends SignalingMessageType = SignalingMessageType, D = unknown> {
  type: T;
  data: D;
  streamId?: string;
  senderId?: string;
  timestamp?: number;
}

export interface AuthMessageData {
  token?: string;
  streamKey?: string;
  streamId: string;
  role: ParticipantRole;
  name?: string;
  protocol?: StreamProtocol;
}

export interface AuthAckMessageData {
  success: boolean;
  error?: string;
  participantId: string;
  streamId: string;
  role: ParticipantRole;
  isBroadcaster: boolean;
  iceServers?: IceServer[];
  protocol: StreamProtocol;
  metadata?: Partial<StreamMetadata>;
}

export interface JoinStreamMessageData {
  streamId: string;
}

export interface JoinedStreamMessageData {
  streamId: string;
  broadcasterOnline: boolean;
  viewerCount: number;
  metadata?: StreamMetadata;
}

export interface PeerJoinedMessageData {
  participant: Participant;
}

export interface PeerLeftMessageData {
  participantId: string;
  role: ParticipantRole;
}

export interface StreamStartedMessageData {
  streamId: string;
  protocol: StreamProtocol;
  metadata: StreamMetadata;
}

export interface StreamEndedMessageData {
  streamId: string;
}

export interface SdpMessageData {
  from: string;
  to: string;
  sdp: {
    type: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp: string;
  };
}

export interface IceCandidateMessageData {
  from: string;
  to: string;
  candidate: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  };
}

export interface ViewerCountMessageData {
  streamId: string;
  count: number;
}

export interface StreamChunkMessageData {
  streamId: string;
  sequence: number;
  isKeyframe: boolean;
  timestamp: number;
  mimeType: string;
  data: string; // Base64 encoded or binary payload metadata
}

export interface ErrorMessageData {
  message: string;
  code?: string;
}

export type SignalingMessage =
  | BaseSignalingMessage<'auth', AuthMessageData>
  | BaseSignalingMessage<'auth_ack', AuthAckMessageData>
  | BaseSignalingMessage<'join_stream', JoinStreamMessageData>
  | BaseSignalingMessage<'joined_stream', JoinedStreamMessageData>
  | BaseSignalingMessage<'peer_joined', PeerJoinedMessageData>
  | BaseSignalingMessage<'peer_left', PeerLeftMessageData>
  | BaseSignalingMessage<'stream_started', StreamStartedMessageData>
  | BaseSignalingMessage<'stream_ended', StreamEndedMessageData>
  | BaseSignalingMessage<'offer', SdpMessageData>
  | BaseSignalingMessage<'answer', SdpMessageData>
  | BaseSignalingMessage<'ice_candidate', IceCandidateMessageData>
  | BaseSignalingMessage<'viewer_count_update', ViewerCountMessageData>
  | BaseSignalingMessage<'chat_message', StreamChatMessage>
  | BaseSignalingMessage<'stream_chunk', StreamChunkMessageData>
  | BaseSignalingMessage<'ping', { timestamp: number }>
  | BaseSignalingMessage<'pong', { timestamp: number }>
  | BaseSignalingMessage<'error', ErrorMessageData>;

export function createMessage<T extends SignalingMessageType>(
  type: T,
  data: Extract<SignalingMessage, { type: T }>['data'],
  streamId?: string,
  senderId?: string
): Extract<SignalingMessage, { type: T }> {
  return {
    type,
    data,
    streamId,
    senderId,
    timestamp: Date.now(),
  } as Extract<SignalingMessage, { type: T }>;
}

export function parseSignalingMessage(raw: string | ArrayBuffer | Uint8Array): SignalingMessage | null {
  try {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.type === 'string') {
      return parsed as SignalingMessage;
    }
  } catch {
    return null;
  }
  return null;
}
