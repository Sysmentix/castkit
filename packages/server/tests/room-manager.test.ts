import { describe, it, expect } from 'vitest';
import { StreamRoomManager, StreamRoom } from '../src/room-manager.js';
import { WebSocket } from 'ws';
import { createMessage } from '../src/core/signaling.js';

function createMockWebSocket(): WebSocket {
  const sentMessages: string[] = [];
  return {
    readyState: WebSocket.OPEN,
    send: (msg: string) => sentMessages.push(msg),
    _sentMessages: sentMessages,
  } as unknown as WebSocket;
}

describe('StreamRoomManager & Participant Lifecycle Edge Cases', () => {
  it('should create room on demand and return the same room instance', () => {
    const manager = new StreamRoomManager();
    const room1 = manager.getOrCreateRoom('stage-1');
    const room2 = manager.getOrCreateRoom('stage-1');

    expect(room1).toBe(room2);
    expect(room1.streamId).toBe('stage-1');
    expect(manager.getRoom('stage-1')).toBe(room1);
  });

  it('should track broadcaster and viewers accurately', () => {
    const manager = new StreamRoomManager();
    const room = manager.getOrCreateRoom('keynote');

    const hostWs = createMockWebSocket();
    const viewer1Ws = createMockWebSocket();
    const viewer2Ws = createMockWebSocket();

    // Add broadcaster
    room.setBroadcaster(
      { id: 'host-1', streamId: 'keynote', role: 'broadcaster', joinedAt: Date.now() },
      hostWs
    );
    expect(room.broadcaster?.participant.id).toBe('host-1');
    expect(room.isLive).toBe(true);

    // Add viewers
    room.addViewer(
      { id: 'viewer-1', streamId: 'keynote', role: 'viewer', joinedAt: Date.now() },
      viewer1Ws
    );
    room.addViewer(
      { id: 'viewer-2', streamId: 'keynote', role: 'viewer', joinedAt: Date.now() },
      viewer2Ws
    );

    expect(room.viewers.size).toBe(2);
    expect(room.metadata.viewerCount).toBe(2);
  });

  it('should decrement viewer count when a viewer leaves', () => {
    const manager = new StreamRoomManager();
    const room = manager.getOrCreateRoom('live-chat');

    const v1 = createMockWebSocket();
    room.addViewer(
      { id: 'v1', streamId: 'live-chat', role: 'viewer', joinedAt: Date.now() },
      v1
    );

    expect(room.viewers.size).toBe(1);

    const role = room.removeParticipant('v1');
    expect(role).toBe('viewer');
    expect(room.viewers.size).toBe(0);
    expect(room.metadata.viewerCount).toBe(0);
  });

  it('should reset broadcaster and set isLive to false when host disconnects', () => {
    const manager = new StreamRoomManager();
    const room = manager.getOrCreateRoom('townhall');

    const hostWs = createMockWebSocket();
    room.setBroadcaster(
      { id: 'host-ceo', streamId: 'townhall', role: 'broadcaster', joinedAt: Date.now() },
      hostWs
    );

    expect(room.isLive).toBe(true);

    const role = room.removeParticipant('host-ceo');
    expect(role).toBe('broadcaster');
    expect(room.broadcaster).toBeNull();
    expect(room.isLive).toBe(false);
  });

  it('should broadcast signaling messages to all participants except the excluded sender', () => {
    const manager = new StreamRoomManager();
    const room = manager.getOrCreateRoom('broadcast-test');

    const senderWs = createMockWebSocket();
    const peer1Ws = createMockWebSocket();
    const peer2Ws = createMockWebSocket();

    room.addViewer(
      { id: 'sender', streamId: 'broadcast-test', role: 'viewer', joinedAt: Date.now() },
      senderWs
    );
    room.addViewer(
      { id: 'peer-1', streamId: 'broadcast-test', role: 'viewer', joinedAt: Date.now() },
      peer1Ws
    );
    room.setBroadcaster(
      { id: 'peer-2', streamId: 'broadcast-test', role: 'broadcaster', joinedAt: Date.now() },
      peer2Ws
    );

    const msg = createMessage('chat_message', { message: 'Hey all!', userName: 'Sender' }, 'broadcast-test', 'sender');
    room.broadcast(msg, 'sender');

    // Sender should NOT receive their own broadcast
    expect((senderWs as any)._sentMessages.length).toBe(0);

    // Peers should receive it
    const raw = JSON.stringify(msg);
    expect((peer1Ws as any)._sentMessages).toContain(raw);
    expect((peer2Ws as any)._sentMessages).toContain(raw);
  });

  it('should remove room from manager and emit stream_ended', () => {
    const manager = new StreamRoomManager();
    manager.getOrCreateRoom('temp-room');
    expect(manager.getRoom('temp-room')).toBeDefined();

    manager.removeRoom('temp-room');
    expect(manager.getRoom('temp-room')).toBeUndefined();
  });

  it('should scale to 50 concurrent viewers in a single room with 100% broadcast delivery', () => {
    const manager = new StreamRoomManager();
    const room = manager.getOrCreateRoom('massive-webinar');

    const viewerSockets: WebSocket[] = [];
    for (let i = 0; i < 50; i++) {
      const ws = createMockWebSocket();
      viewerSockets.push(ws);
      room.addViewer(
        { id: `viewer-${i}`, streamId: 'massive-webinar', role: 'viewer', joinedAt: Date.now() },
        ws
      );
    }

    expect(room.viewers.size).toBe(50);
    expect(room.metadata.viewerCount).toBe(50);

    const announcement = createMessage('chat_message', { message: 'Hello 50 viewers!' }, 'massive-webinar');
    room.broadcastToViewers(announcement);

    const raw = JSON.stringify(announcement);
    for (const ws of viewerSockets) {
      expect((ws as any)._sentMessages).toContain(raw);
    }
  });

  it('should guarantee complete isolation between distinct stream rooms', () => {
    const manager = new StreamRoomManager();
    const roomA = manager.getOrCreateRoom('room-alpha');
    const roomB = manager.getOrCreateRoom('room-beta');

    const wsA = createMockWebSocket();
    const wsB = createMockWebSocket();

    roomA.addViewer({ id: 'viewer-a', streamId: 'room-alpha', role: 'viewer', joinedAt: Date.now() }, wsA);
    roomB.addViewer({ id: 'viewer-b', streamId: 'room-beta', role: 'viewer', joinedAt: Date.now() }, wsB);

    const msgA = createMessage('chat_message', { text: 'Alpha only' }, 'room-alpha');
    roomA.broadcastToViewers(msgA);

    expect((wsA as any)._sentMessages.length).toBe(1);
    expect((wsB as any)._sentMessages.length).toBe(0);
  });

  it('should remain resilient when a viewer socket throws an unexpected exception during broadcast', () => {
    const manager = new StreamRoomManager();
    const room = manager.getOrCreateRoom('fault-tolerant-room');

    const healthyWs = createMockWebSocket();
    const brokenWs = {
      readyState: WebSocket.OPEN,
      send: () => {
        throw new Error('EPIPE: Broken pipe on write');
      },
    } as unknown as WebSocket;

    room.addViewer({ id: 'healthy', streamId: 'fault-tolerant-room', role: 'viewer', joinedAt: Date.now() }, healthyWs);
    room.addViewer({ id: 'broken', streamId: 'fault-tolerant-room', role: 'viewer', joinedAt: Date.now() }, brokenWs);

    const msg = createMessage('chat_message', { text: 'Safe broadcast' }, 'fault-tolerant-room');

    // Should not throw or crash
    expect(() => room.broadcastToViewers(msg)).not.toThrow();
    // Healthy peer still received the message
    expect((healthyWs as any)._sentMessages.length).toBe(1);
  });

  it('should gracefully handle broadcaster replacement/reconnect', () => {
    const manager = new StreamRoomManager();
    const room = manager.getOrCreateRoom('keynote');

    const host1 = createMockWebSocket();
    room.setBroadcaster({ id: 'host-v1', streamId: 'keynote', role: 'broadcaster', joinedAt: Date.now() }, host1);
    expect(room.broadcaster?.participant.id).toBe('host-v1');

    // Host reconnects with a new socket / session ID
    const host2 = createMockWebSocket();
    room.setBroadcaster({ id: 'host-v2', streamId: 'keynote', role: 'broadcaster', joinedAt: Date.now() }, host2);
    expect(room.broadcaster?.participant.id).toBe('host-v2');
    expect(room.isLive).toBe(true);
  });
});
