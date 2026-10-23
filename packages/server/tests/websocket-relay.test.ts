import { describe, it, expect } from 'vitest';
import { WebSocketRelay } from '../src/adapters/websocket-relay.js';
import { StreamRoom } from '../src/room-manager.js';
import { WebSocket } from 'ws';

function createMockSocket(): WebSocket {
  const sent: string[] = [];
  return {
    readyState: WebSocket.OPEN,
    send: (data: string) => sent.push(data),
    _sent: sent,
  } as unknown as WebSocket;
}

describe('WebSocketRelay & Chunk Ring Buffer Edge Cases', () => {
  it('should relay video chunks to all viewers in the room', () => {
    const relay = new WebSocketRelay();
    const room = new StreamRoom('tech-talk');

    const v1 = createMockSocket();
    const v2 = createMockSocket();

    room.addViewer(
      { id: 'v1', streamId: 'tech-talk', role: 'viewer', joinedAt: Date.now() },
      v1
    );
    room.addViewer(
      { id: 'v2', streamId: 'tech-talk', role: 'viewer', joinedAt: Date.now() },
      v2
    );

    relay.handleChunk(room, {
      sequence: 1,
      timestamp: Date.now(),
      mimeType: 'video/webm; codecs=vp8',
      data: 'base64-encoded-video-bytes',
    });

    expect((v1 as any)._sent.length).toBe(1);
    expect((v2 as any)._sent.length).toBe(1);

    const received = JSON.parse((v1 as any)._sent[0]);
    expect(received.type).toBe('stream_chunk');
    expect(received.data.sequence).toBe(1);
  });

  it('should maintain ring buffer capped at maxBufferedChunks (15)', () => {
    const relay = new WebSocketRelay();
    const room = new StreamRoom('speed-test');

    for (let i = 0; i < 25; i++) {
      relay.handleChunk(room, {
        sequence: i,
        timestamp: Date.now(),
        mimeType: 'video/webm',
        data: `chunk-${i}`,
      });
    }

    // New viewer joins and catches up
    const lateViewer = createMockSocket();
    relay.catchUpViewer(room, lateViewer);

    // Buffer should be capped at 15
    expect((lateViewer as any)._sent.length).toBe(15);
    const firstSent = JSON.parse((lateViewer as any)._sent[0]);
    expect(firstSent.data.sequence).toBe(10); // 25 - 15 = 10
  });

  it('should clear buffer on demand', () => {
    const relay = new WebSocketRelay();
    const room = new StreamRoom('ephemeral');

    relay.handleChunk(room, {
      sequence: 1,
      timestamp: Date.now(),
      mimeType: 'video/webm',
      data: 'chunk-1',
    });

    relay.clearBuffer('ephemeral');

    const lateViewer = createMockSocket();
    relay.catchUpViewer(room, lateViewer);
    expect((lateViewer as any)._sent.length).toBe(0);
  });

  it('should safely ignore catchUpViewer calls on closed or throwing sockets', () => {
    const relay = new WebSocketRelay();
    const room = new StreamRoom('resilient-stream');
    relay.handleChunk(room, {
      sequence: 1,
      timestamp: Date.now(),
      mimeType: 'video/webm',
      data: 'chunk-1',
    });

    // Closed socket
    const closedWs = {
      readyState: WebSocket.CLOSED,
      send: () => {},
    } as unknown as WebSocket;

    expect(() => relay.catchUpViewer(room, closedWs)).not.toThrow();

    // Throwing socket
    const throwingWs = {
      readyState: WebSocket.OPEN,
      send: () => {
        throw new Error('Socket disconnected');
      },
    } as unknown as WebSocket;

    expect(() => relay.catchUpViewer(room, throwingWs)).not.toThrow();
  });

  it('should isolate chunk buffers between independent stream rooms', () => {
    const relay = new WebSocketRelay();
    const roomA = new StreamRoom('room-a');
    const roomB = new StreamRoom('room-b');

    relay.handleChunk(roomA, { sequence: 100, timestamp: Date.now(), mimeType: 'video/webm', data: 'data-a' });
    relay.handleChunk(roomB, { sequence: 200, timestamp: Date.now(), mimeType: 'video/webm', data: 'data-b' });

    const viewerA = createMockSocket();
    const viewerB = createMockSocket();

    relay.catchUpViewer(roomA, viewerA);
    relay.catchUpViewer(roomB, viewerB);

    const chunkA = JSON.parse((viewerA as any)._sent[0]);
    const chunkB = JSON.parse((viewerB as any)._sent[0]);

    expect(chunkA.data.data).toBe('data-a');
    expect(chunkB.data.data).toBe('data-b');
  });
});
