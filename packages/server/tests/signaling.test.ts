import { describe, it, expect } from 'vitest';
import {
  createMessage,
  parseSignalingMessage,
  isSignalingMessage,
  SignalingMessage,
} from '../src/core/signaling.js';

describe('Signaling Message Schema & Edge Cases', () => {
  it('should create valid signaling messages with timestamp and payload', () => {
    const msg = createMessage('auth', {
      streamId: 'room-101',
      role: 'broadcaster',
      protocol: 'webrtc',
    }, 'room-101', 'user-1');

    expect(msg.type).toBe('auth');
    expect(msg.streamId).toBe('room-101');
    expect(msg.senderId).toBe('user-1');
    expect(msg.data).toEqual({ streamId: 'room-101', role: 'broadcaster', protocol: 'webrtc' });
    expect(typeof msg.timestamp).toBe('number');
  });

  it('should parse valid JSON signaling message strings', () => {
    const raw = JSON.stringify({
      type: 'chat_message',
      streamId: 'gaming-stream',
      senderId: 'alice',
      timestamp: Date.now(),
      data: { message: 'Hello world!', userName: 'Alice' },
    });

    const parsed = parseSignalingMessage(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('chat_message');
    expect((parsed?.data as any).message).toBe('Hello world!');
  });

  it('should return null on malformed JSON without throwing exceptions', () => {
    expect(parseSignalingMessage('{ invalid json')).toBeNull();
    expect(parseSignalingMessage('')).toBeNull();
    expect(parseSignalingMessage('undefined')).toBeNull();
    expect(parseSignalingMessage('42')).toBeNull();
    expect(parseSignalingMessage('true')).toBeNull();
  });

  it('should return null when required signaling fields (type or data) are missing', () => {
    // Missing type
    expect(parseSignalingMessage(JSON.stringify({ streamId: 'r1', senderId: 'u1', data: {} }))).toBeNull();
    // Missing data
    expect(parseSignalingMessage(JSON.stringify({ type: 'join_stream', senderId: 'u1' }))).toBeNull();
  });

  it('should validate message structure with isSignalingMessage type guard', () => {
    const validMsg: SignalingMessage = {
      type: 'ice_candidate',
      streamId: 's1',
      senderId: 'u1',
      timestamp: 12345,
      data: {
        from: 'u1',
        to: 'host-1',
        candidate: { candidate: 'candidate:...', sdpMid: '0', sdpMLineIndex: 0 },
      },
    };

    expect(isSignalingMessage(validMsg)).toBe(true);
    expect(isSignalingMessage(null)).toBe(false);
    expect(isSignalingMessage({})).toBe(false);
    expect(isSignalingMessage('string')).toBe(false);
    expect(isSignalingMessage({ type: 123, streamId: 's', senderId: 'u' })).toBe(false);
  });

  it('should handle large SDP payloads (>64KB) without data corruption', () => {
    const largeSdp = 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\n' + 'a=candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host\r\n'.repeat(1200);
    expect(largeSdp.length).toBeGreaterThan(64000);

    const msg = createMessage('offer', {
      from: 'host-1',
      to: 'viewer-99',
      sdp: { type: 'offer', sdp: largeSdp },
    }, 'stream-hd', 'host-1');

    const serialized = JSON.stringify(msg);
    const parsed = parseSignalingMessage(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('offer');
    expect((parsed?.data as any).sdp.sdp.length).toBe(largeSdp.length);
  });

  it('should safely preserve UTF-8 emojis and multilingual text in chat payloads', () => {
    const unicodeText = '🚀 Live Stream Started! 🎥 日本語テスト 🎉 العربية 🔥';
    const msg = createMessage('chat_message', {
      id: 'msg-utf8',
      streamId: 'multilingual-room',
      senderId: 'user-intl',
      senderName: '田中太郎',
      text: unicodeText,
      timestamp: Date.now(),
    }, 'multilingual-room');

    const serialized = JSON.stringify(msg);
    const parsed = parseSignalingMessage(serialized);
    expect(parsed).not.toBeNull();
    expect((parsed?.data as any).text).toBe(unicodeText);
    expect((parsed?.data as any).senderName).toBe('田中太郎');
  });

  it('should accept ICE candidates with nullable or missing sdpMid and sdpMLineIndex', () => {
    const candidateMsg = createMessage('ice_candidate', {
      from: 'peer-abc',
      to: 'host-1',
      candidate: {
        candidate: 'candidate:842163049 1 udp 1677729535 192.168.1.2 56143 typ srflx raddr 10.0.0.1 rport 56143',
        sdpMid: null,
        sdpMLineIndex: null,
      },
    }, 'stream-ice');

    const serialized = JSON.stringify(candidateMsg);
    const parsed = parseSignalingMessage(serialized);
    expect(parsed).not.toBeNull();
    expect((parsed?.data as any).candidate.sdpMid).toBeNull();
  });
});
