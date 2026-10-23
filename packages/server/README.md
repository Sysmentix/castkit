# ⚡ castkit-server

> Enterprise-grade, low-latency live video streaming engine for Node.js backends.

[![npm version](https://img.shields.io/npm/v/castkit-server.svg)](https://www.npmjs.com/package/castkit-server)
[![license](https://img.shields.io/npm/l/castkit-server.svg)](https://github.com/rakeshkundan/StreamModule)

`castkit-server` provides multi-protocol live video streaming for Node.js backends with options for both **sub-second interactive latency (<300ms)** via WebRTC and **YouTube-style infinite audience scale** via HLS + Adaptive Bitrate (ABR) + CDN edge caching.

---

## 🌟 Features

- ⚡ **WebRTC SFU & Signaling**: Sub-second (<300ms) ultra-low latency peer routing for webinars, classrooms, gaming, and interactive live auctions.
- 🌐 **YouTube-Scale HLS Engine**: Decoupled ingestion, multi-bitrate ABR ladder (1080p60, 720p60, 480p, 360p), fMP4/TS segmentation, and CDN cache headers (`Cache-Control: public, max-age=86400, immutable`).
- 📦 **Zero-Config WebSocket Relay**: Lightweight fallback streaming with pure TypeScript chunking without native C++ compilation or STUN/TURN requirements.
- 🛡️ **Built-in Auth Guards**: Authenticate hosts via `streamKey` and viewers via `token`, preventing unauthorized broadcasts.
- 💬 **Live Chat & Viewer Metrics**: Real-time participant tracking, viewer counters, and broadcast-wide chat message relay.
- 🚀 **Zero Native Dependencies**: Pure JavaScript / TypeScript implementation that runs everywhere—macOS, Linux, Windows, Docker, and Cloud VMs.

---

## 📦 Installation

```bash
npm install castkit-server
```

---

## 🚀 Quickstart (Express / Node.js)

```typescript
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { createStreamServer } from 'castkit-server';

const app = express();
app.use(cors());

const server = http.createServer(app);

// Initialize CastKit Live Stream Server
const streamServer = createStreamServer({
  server,
  signalingPath: '/stream-signal',
  hlsPath: '/live',
  defaultProtocol: 'webrtc', // 'webrtc' | 'hls' | 'websocket'

  // Security & Authentication Guard
  auth: async ({ streamId, role, streamKey, token, clientIp }) => {
    if (role === 'broadcaster') {
      // Authenticate the broadcaster
      if (streamKey === 'super-secret-key') {
        return { valid: true, userId: 'host_1', userName: 'Channel Host' };
      }
      return { valid: false, reason: 'Invalid stream key' };
    }

    // Viewers can join freely or validate session token
    return { valid: true, userId: `viewer_${Date.now()}` };
  },

  onStreamStarted: (stream) => {
    console.log(`🚀 Live stream started: room ${stream.streamId}`);
  },
  onStreamEnded: (streamId) => {
    console.log(`🛑 Live stream ended: room ${streamId}`);
  },
});

server.listen(5001, () => {
  console.log('🎬 CastKit live server running on port 5001');
  console.log('• WebRTC Signaling: ws://localhost:5001/stream-signal');
  console.log('• HLS Live Edge: http://localhost:5001/live/:streamId/index.m3u8');
});
```

---

## 📖 API Reference

### `createStreamServer(options)`

Initializes and attaches the streaming engine to an existing Node.js HTTP/HTTPS server.

#### `StreamServerOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `server` | `http.Server \| https.Server` | **Required** | The Node.js HTTP server instance to attach WebSocket and HTTP listeners to. |
| `signalingPath` | `string` | `'/stream-signal'` | WebSocket endpoint path for WebRTC signaling and chat. |
| `hlsPath` | `string` | `'/live'` | HTTP route prefix for serving HLS playlists and media segments. |
| `defaultProtocol` | `'webrtc' \| 'hls' \| 'websocket'` | `'webrtc'` | Preferred streaming protocol. |
| `iceServers` | `IceServer[]` | Google STUN | STUN and TURN server array for NAT traversal. |
| `auth` | `(ctx: AuthContext) => Promise<AuthResult>` | Optional | Custom authentication hook for hosts and viewers. |
| `dvrWindowSeconds` | `number` | `7200` (2h) | Sliding DVR rewind window for HLS playback. |
| `hlsSegmentDuration` | `number` | `4` (sec) | Segment duration in seconds for HLS transmuxing. |
| `onStreamStarted` | `(stream: StreamRoom) => void` | Optional | Callback fired when a host begins streaming. |
| `onStreamEnded` | `(streamId: string) => void` | Optional | Callback fired when a host disconnects. |

---

### Custom STUN / TURN Configuration

For enterprise firewalls and restrictive cellular networks, provide custom TURN credentials:

```typescript
const streamServer = createStreamServer({
  server,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.mycompany.com:3478',
      username: 'user1',
      credential: 'turnPassword123'
    }
  ],
});
```

---

### Scale to Millions of Viewers with a CDN

`castkit-server` automatically injects production-ready caching headers on media segments:
- **Playlists (`.m3u8`)**: `Cache-Control: no-cache, no-store, must-revalidate` (instant live playlist refreshes).
- **Video Segments (`.ts` / `.m4s`)**: `Cache-Control: public, max-age=86400, immutable` (permanently cacheable at Cloudflare, Fastly, or AWS CloudFront edges).

Point your CDN distribution to your Node.js server as the origin to distribute HLS streams to millions of concurrent viewers with zero extra server load.

---

## 📄 License

MIT © [rakeshkundan](https://github.com/rakeshkundan)
