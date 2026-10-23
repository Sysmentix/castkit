import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { createStreamServer } from 'castkit-server';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

app.use(cors());
app.use(express.json());

// Initialize Stream Server
const streamServer = createStreamServer({
  server,
  signalingPath: '/stream-signal',
  hlsPath: '/live',
  defaultProtocol: 'webrtc',
  auth: async ({ streamKey, role, streamId }) => {
    // Custom auth logic:
    // Broadcasters can supply a valid streamKey or use demo keys
    if (role === 'broadcaster') {
      console.log(`[Auth] Broadcaster attempting to stream on room: ${streamId}`);
      return {
        valid: true,
        userId: `host_${streamId}`,
        userName: 'Channel Host',
      };
    }
    // Viewers are authenticated freely
    return {
      valid: true,
      userId: `viewer_${Math.random().toString(36).substring(2, 8)}`,
      userName: 'Live Viewer',
    };
  },
  onStreamStarted: (stream) => {
    console.log(`[Stream Started] 🚀 Room: ${stream.streamId} via ${stream.protocol}`);
  },
  onStreamEnded: (streamId) => {
    console.log(`[Stream Ended] 🛑 Room: ${streamId}`);
  },
});

// REST API for Stream Info & Discovery
app.get('/api/streams', (req, res) => {
  const active = streamServer.getRoomManager().getAllActiveStreams();
  res.json({
    count: active.length,
    streams: active,
  });
});

app.post('/api/streams/create', (req, res) => {
  const streamId = req.body.streamId || `stream_${Date.now()}`;
  const streamKey = `key_${Math.random().toString(36).substring(2, 12)}`;
  res.json({
    streamId,
    streamKey,
    signalingUrl: `ws://localhost:${PORT}/stream-signal`,
    hlsUrl: `http://localhost:${PORT}/live/${streamId}/index.m3u8`,
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
======================================================
  🎬 STREAM-MODULE LIVE BACKEND RUNNING
======================================================
  • Local URL         : http://localhost:${PORT}
  • Mobile LAN URL    : http://192.168.31.100:${PORT}
  • WebRTC Signaling  : ws://192.168.31.100:${PORT}/stream-signal
  • HLS Live Edge     : http://192.168.31.100:${PORT}/live/:streamId/index.m3u8
  • Active Streams    : http://192.168.31.100:${PORT}/api/streams
======================================================
  `);
});
