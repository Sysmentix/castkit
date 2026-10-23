import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createStreamServer, StreamServer } from '../src/server.js';
import { createMessage, parseSignalingMessage } from '../src/core/signaling.js';

describe('CastKit Server End-to-End WebSocket Integration', () => {
  let server: http.Server;
  let streamServer: StreamServer;
  const PORT = 6789;
  const WS_URL = `ws://localhost:${PORT}/stream-signal`;

  beforeAll(async () => {
    server = http.createServer();
    streamServer = createStreamServer({
      server,
      signalingPath: '/stream-signal',
      hlsPath: '/live',
    });

    await new Promise<void>((resolve) => server.listen(PORT, resolve));
  });

  afterAll(async () => {
    streamServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should authenticate host and viewer and broadcast chat in real-time', async () => {
    const hostWs = new WebSocket(WS_URL);
    const viewerWs = new WebSocket(WS_URL);

    // Wait for sockets to open
    await Promise.all([
      new Promise((res) => hostWs.on('open', res)),
      new Promise((res) => viewerWs.on('open', res)),
    ]);

    const hostReceived: any[] = [];
    const viewerReceived: any[] = [];

    hostWs.on('message', (raw) => {
      const msg = parseSignalingMessage(raw.toString());
      if (msg) hostReceived.push(msg);
    });

    viewerWs.on('message', (raw) => {
      const msg = parseSignalingMessage(raw.toString());
      if (msg) viewerReceived.push(msg);
    });

    // 1. Host authenticates
    hostWs.send(
      JSON.stringify(
        createMessage('auth', {
          streamId: 'integration-stage',
          role: 'broadcaster',
          name: 'Host User',
          protocol: 'webrtc',
        }, 'integration-stage', 'host-user')
      )
    );

    await new Promise((res) => setTimeout(res, 80));

    const hostAuthAck = hostReceived.find((m) => m.type === 'auth_ack');
    expect(hostAuthAck).toBeDefined();
    expect(hostAuthAck.data.success).toBe(true);
    expect(hostAuthAck.data.isBroadcaster).toBe(true);

    // 2. Viewer authenticates
    viewerWs.send(
      JSON.stringify(
        createMessage('auth', {
          streamId: 'integration-stage',
          role: 'viewer',
          name: 'Viewer User',
          protocol: 'webrtc',
        }, 'integration-stage', 'viewer-user')
      )
    );

    await new Promise((res) => setTimeout(res, 80));

    const viewerAuthAck = viewerReceived.find((m) => m.type === 'auth_ack');
    expect(viewerAuthAck).toBeDefined();
    expect(viewerAuthAck.data.success).toBe(true);

    // 3. Host broadcasts a live chat message
    hostWs.send(
      JSON.stringify(
        createMessage('chat_message', {
          id: 'msg-1',
          streamId: 'integration-stage',
          senderId: 'host-user',
          senderName: 'Host User',
          text: 'Hello everyone!',
          timestamp: Date.now(),
        }, 'integration-stage', 'host-user')
      )
    );

    await new Promise((res) => setTimeout(res, 80));

    const chatReceived = viewerReceived.find((m) => m.type === 'chat_message');
    expect(chatReceived).toBeDefined();
    expect(chatReceived.data.text).toBe('Hello everyone!');

    // 4. Host disconnects abruptly -> viewer should receive stream_ended
    hostWs.close();
    await new Promise((res) => setTimeout(res, 80));

    const streamEnded = viewerReceived.find((m) => m.type === 'stream_ended');
    expect(streamEnded).toBeDefined();
    expect(streamEnded.data.streamId).toBe('integration-stage');

    viewerWs.close();
  });

  it('should reject unauthorized connection attempts and send auth failure', async () => {
    // Register a valid stream key so authentication is enforced
    streamServer.getAuthGuard().registerStreamKey('master-key');

    const badWs = new WebSocket(WS_URL);
    await new Promise((res) => badWs.on('open', res));

    let closeCode = 0;
    let authAckData: any = null;

    badWs.on('message', (raw) => {
      const msg = parseSignalingMessage(raw.toString());
      if (msg?.type === 'auth_ack') {
        authAckData = msg.data;
      }
    });

    badWs.on('close', (code) => {
      closeCode = code;
    });

    // Send invalid auth
    badWs.send(
      JSON.stringify(
        createMessage('auth', {
          streamId: 'secure-stage',
          role: 'broadcaster',
          streamKey: 'invalid-secret-key',
        }, 'secure-stage')
      )
    );

    await new Promise((res) => setTimeout(res, 100));

    expect(authAckData).toBeDefined();
    expect(authAckData.success).toBe(false);
    expect(authAckData.error).toContain('Invalid or missing stream key');
    expect(closeCode).toBe(4001);

    // Clean up key
    streamServer.getAuthGuard().revokeStreamKey('master-key');
  });
});
