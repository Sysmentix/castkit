# ⚡ CastKit

> **Enterprise-grade, plug-and-play live video streaming module for Node.js backends and React / Next.js frontends.**

CastKit allows you to integrate full live video streaming into your application in minutes with options for both **real-time sub-second latency** (WebRTC) and **YouTube-style infinite scale** (HLS + Adaptive Bitrate + CDN edge caching).

---

## 🌟 Key Features

- ⚡ **Ultra-Low Latency (<300ms)**: Direct WebRTC peer/SFU streaming for interactive classrooms, webinars, gaming, and auctions.
- 🌐 **YouTube-Scale HLS Engine**: Decoupled ingestion, multi-bitrate ABR ladder (1080p, 720p, 480p, 360p), fMP4/TS segmentation, and CDN cache headers (`Cache-Control: public, max-age=86400, immutable`) to scale to millions of viewers on Cloudflare, CloudFront, or Fastly.
- 📦 **Zero-Config WebSocket Relay**: Lightweight fallback streaming with pure JavaScript/TypeScript chunking without native C++ compilation or STUN/TURN requirements.
- 🔄 **Auto-Fallback & Catch-up Sync**: Viewers automatically switch from WebRTC to HLS if UDP/firewall blocked. If network dips occur, the player gently accelerates (1.06x) to catch back up to real time.
- ⏪ **DVR Live Rewind**: Sliding window live scrubber allowing viewers to seek backwards in time while the stream is live.
- 🖥️ **Full Studio Capabilities**: Webcam, microphone, screen sharing (`getDisplayMedia`), device switching, mute/video controls, and live chat.
- ⚛️ **React & Next.js 14/15 Ready**: Drop-in UI components (`<StreamBroadcaster />`, `<StreamPlayer />`) and powerful headless hooks (`useLiveBroadcaster`, `useLivePlayer`, `useMediaDevices`).

---

## 📦 Package Architecture (Monorepo)

| Package | Description | Install |
|---|---|---|
| [`castkit-server`](./packages/server) | Node.js backend streaming engine with pluggable adapters (WebRTC, HLS, WebSocket), auth guards, and room management. | `npm i castkit-server` |
| [`castkit-client`](./packages/client) | Browser live streaming client SDK + ready-to-use React & Next.js hooks (`useLiveBroadcaster`, `useLivePlayer`) and UI components (`<StreamBroadcaster />`, `<StreamPlayer />`). | `npm i castkit-client` |

---

## 🚀 Quickstart

### 1. Backend (Node.js / Express / Next.js)

```typescript
import http from 'node:http';
import express from 'express';
import { createStreamServer } from 'castkit-server';

const app = express();
const server = http.createServer(app);

// Initialize Stream Server
const streamServer = createStreamServer({
  server,
  signalingPath: '/stream-signal',
  hlsPath: '/live',
  defaultProtocol: 'webrtc', // 'webrtc' | 'hls' | 'websocket'
  auth: async ({ streamKey, role, streamId }) => {
    // Authenticate host vs viewer
    if (role === 'broadcaster') {
      return { valid: true, userId: `host_${streamId}`, userName: 'Channel Host' };
    }
    return { valid: true, userId: `viewer_${Date.now()}` };
  },
  onStreamStarted: (stream) => console.log('Live stream started:', stream.streamId),
  onStreamEnded: (streamId) => console.log('Live stream ended:', streamId),
});

server.listen(5001, () => {
  console.log('Stream server listening on port 5001');
});
```

---

### 2. Frontend (React / Next.js App Router)

#### 🔴 Broadcaster View (Studio)
```tsx
'use client';
import { StreamBroadcaster } from 'castkit-client';

export function HostStudio({ streamId }: { streamId: string }) {
  return (
    <StreamBroadcaster
      serverUrl="ws://localhost:5001/stream-signal"
      streamId={streamId}
      protocol="webrtc"
      resolution="1080p60"
      audio={true}
      video={true}
      title="Main Stage Studio"
      onStart={() => console.log('You are now live!')}
      onEnd={() => console.log('Stream ended')}
    />
  );
}
```

#### 📺 Viewer View (Live Player with YouTube DVR & Catch-Up)
```tsx
'use client';
import { StreamPlayer } from 'castkit-client';

export function ViewerRoom({ streamId }: { streamId: string }) {
  return (
    <StreamPlayer
      serverUrl="ws://localhost:5001/stream-signal"
      streamId={streamId}
      protocol="auto" // Auto-selects WebRTC with HLS fallback
      hlsUrl={`http://localhost:5001/live/${streamId}/index.m3u8`}
      autoPlay={true}
      enableCatchUpSync={true}
      title="Live Stream"
    />
  );
}
```

---

### 3. Headless React Hooks

If you prefer building your own custom UI:

```tsx
import { useLiveBroadcaster, useLivePlayer, useMediaDevices } from 'castkit-client';

// Custom Broadcaster
function CustomStudio() {
  const { videoRef, isLive, start, stop, toggleAudio, isMuted, startScreenShare } = useLiveBroadcaster({
    serverUrl: 'ws://localhost:5001/stream-signal',
    streamId: 'my-room',
  });

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <button onClick={start}>{isLive ? 'End' : 'Go Live'}</button>
      <button onClick={toggleAudio}>{isMuted ? 'Unmute' : 'Mute'}</button>
      <button onClick={startScreenShare}>Share Screen</button>
    </div>
  );
}
```

---

## 🏃 Running the Full-Stack Demo Locally

You can launch both the **Node.js streaming backend (port 5001)** and **Next.js frontend (port 3000)** simultaneously with a single command:

```bash
# Start both backend server and Next.js frontend concurrently
npm run dev
```

Or run them individually in separate terminals:
```bash
# Terminal 1: Run the Node.js streaming backend
npm run dev:server
# Running on http://localhost:5001 (Signaling: ws://localhost:5001/stream-signal)

# Terminal 2: Run the Next.js Web App
npm run dev:next
# Running on http://localhost:3000
```

Once running:
- **Studio (Host)**: Open [http://localhost:3000/studio](http://localhost:3000/studio) and click **Go Live**.
- **Viewer (Audience)**: Open [http://localhost:3000/watch/main-stage](http://localhost:3000/watch/main-stage) in another window/tab to watch the live stream in real time!
