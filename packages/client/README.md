# ⚡ castkit-client

> Universal browser live video streaming client SDK with ready-to-use React & Next.js components and hooks.

[![npm version](https://img.shields.io/npm/v/castkit-client.svg)](https://www.npmjs.com/package/castkit-client)
[![license](https://img.shields.io/npm/l/castkit-client.svg)](https://github.com/rakeshkundan/StreamModule)

`castkit-client` provides everything needed to build high-performance live video broadcasting and viewing in the browser. It features **sub-second WebRTC streaming**, **automatic HLS fallback**, **YouTube-style live catch-up synchronization**, and drop-in dark-mode UI components for React and Next.js.

---

## 🌟 Features

- ⚛️ **Drop-in React & Next.js Components**: Pre-styled, responsive dark-mode UI components (`<StreamPlayer />`, `<StreamBroadcaster />`, `<LiveBadge />`, `<DeviceSelector />`).
- 🪝 **Headless React Hooks**: Build your own completely custom UI using `useLiveBroadcaster`, `useLivePlayer`, and `useMediaDevices`.
- 🌐 **Framework Agnostic Core**: Pure TypeScript/JavaScript client classes (`StreamPlayerClient`, `StreamBroadcasterClient`) that work anywhere—Vue, Svelte, Angular, or Vanilla JS.
- ⚡ **WebRTC Sub-Second Playback**: Ultra-low latency (<300ms) real-time video and audio.
- 🔄 **Auto-Fallback & Catch-up Sync**: Seamlessly falls back to HLS if WebRTC UDP ports are blocked. If the viewer lags behind due to network jitter, the player gently accelerates (1.06x speed) to smoothly return to real time.
- ⏪ **DVR Live Rewinding**: Sliding-window live timeline scrubber allowing viewers to pause and seek back in time while the stream is active.
- 📱 **Mobile Optimized**: Full iOS Safari fullscreen support (`webkitEnterFullscreen`), browser autoplay policy recovery, and responsive controls.
- 🎙️ **Studio Broadcaster**: Camera capture, microphone switching, screen sharing (`getDisplayMedia`), and 60fps presets (`1080p60`, `720p60`, `480p`, `360p`).

---

## 📦 Installation

```bash
npm install castkit-client
```

*(Note: `react` and `react-dom` are optional peer dependencies. If you're building in React or Next.js, ensure you have React 18+ installed).*

---

## 🚀 Quickstart (React / Next.js App Router)

### 1. Broadcaster Studio (Host)

Drop in `<StreamBroadcaster />` to give users a full live-streaming studio:

```tsx
'use client';

import React from 'react';
import { StreamBroadcaster } from 'castkit-client';

export default function StudioPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <StreamBroadcaster
        serverUrl="ws://localhost:5001/stream-signal"
        streamId="main-stage"
        protocol="webrtc"
        resolution="1080p60"
        audio={true}
        video={true}
        title="Main Stage Broadcast"
        onStart={() => console.log('Broadcaster is live!')}
        onEnd={() => console.log('Broadcast has ended')}
      />
    </div>
  );
}
```

---

### 2. Live Stream Viewer (Audience)

Drop in `<StreamPlayer />` for real-time video playback with automatic HLS fallback and DVR scrubber:

```tsx
'use client';

import React from 'react';
import { StreamPlayer } from 'castkit-client';

export default function WatchPage({ params }: { params: { streamId: string } }) {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <StreamPlayer
        serverUrl="ws://localhost:5001/stream-signal"
        streamId={params.streamId || 'main-stage'}
        protocol="auto" // Auto-selects WebRTC with HLS fallback
        hlsUrl={`http://localhost:5001/live/${params.streamId}/index.m3u8`}
        autoPlay={true}
        enableCatchUpSync={true}
        title="Live Stream"
      />
    </div>
  );
}
```

---

## 🪝 Headless React Hooks

If you prefer building a custom UI from scratch, use the headless hooks:

```tsx
'use client';

import React from 'react';
import { useLiveBroadcaster, useMediaDevices } from 'castkit-client';

export function CustomStudio() {
  const {
    videoRef,
    status,
    viewerCount,
    start,
    stop,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    isMuted,
    isVideoPaused,
    isScreenSharing,
  } = useLiveBroadcaster({
    serverUrl: 'ws://localhost:5001/stream-signal',
    streamId: 'room-1',
    resolution: '720p60',
  });

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 12 }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={status === 'live' ? stop : start}>
          {status === 'live' ? 'End Stream' : 'Go Live'}
        </button>
        <button onClick={toggleAudio}>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</button>
        <button onClick={toggleVideo}>{isVideoPaused ? 'Enable Cam' : 'Pause Cam'}</button>
        <button onClick={startScreenShare}>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</button>
      </div>
      <p>Status: {status} | Viewers: {viewerCount}</p>
    </div>
  );
}
```

```tsx
'use client';

import React from 'react';
import { useLivePlayer } from 'castkit-client';

export function CustomViewer() {
  const { videoRef, status, activeProtocol, viewerCount, retry, sendChatMessage } = useLivePlayer({
    serverUrl: 'ws://localhost:5001/stream-signal',
    streamId: 'room-1',
    protocol: 'auto',
  });

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline controls style={{ width: '100%' }} />
      <p>Protocol: {activeProtocol} | Viewers: {viewerCount} | State: {status}</p>
    </div>
  );
}
```

---

## 🍦 Vanilla JavaScript / TypeScript (No React)

You can use `castkit-client` without React in Vue, Svelte, or plain HTML/JS:

```typescript
import { StreamPlayerClient, StreamBroadcasterClient } from 'castkit-client';

// Viewer
const player = new StreamPlayerClient({
  serverUrl: 'ws://localhost:5001/stream-signal',
  streamId: 'main-stage',
  protocol: 'webrtc',
});

player.on('remoteStreamReady', (mediaStream) => {
  const video = document.getElementById('my-video') as HTMLVideoElement;
  video.srcObject = mediaStream;
  video.play();
});

player.on('viewerCount', (count) => {
  console.log('Current viewers:', count);
});

player.start();
```

---

## 📖 Component Props Reference

### `<StreamPlayer />`

| Prop | Type | Default | Description |
|---|---|---|---|
| `serverUrl` | `string` | **Required** | WebSocket URL of the signaling server (`ws://host:port/stream-signal`). |
| `streamId` | `string` | **Required** | Unique room or stream identifier. |
| `protocol` | `'webrtc' \| 'hls' \| 'websocket' \| 'auto'` | `'auto'` | Streaming protocol. `'auto'` attempts WebRTC first and falls back to HLS. |
| `hlsUrl` | `string` | Optional | URL to the HLS master playlist (`.m3u8`). |
| `autoPlay` | `boolean` | `true` | Automatically starts playback (muted to conform to browser autoplay policy). |
| `enableCatchUpSync` | `boolean` | `true` | Gently accelerates (1.06x) playback speed if network lag causes viewer drift. |
| `title` | `string` | `'Live Stream'` | Stream title displayed in the header. |
| `showControls` | `boolean` | `true` | Shows or hides the player control bar. |

### `<StreamBroadcaster />`

| Prop | Type | Default | Description |
|---|---|---|---|
| `serverUrl` | `string` | **Required** | WebSocket URL of the signaling server. |
| `streamId` | `string` | **Required** | Unique room or stream identifier. |
| `streamKey` | `string` | Optional | Secret key to pass to the backend auth guard. |
| `protocol` | `'webrtc' \| 'websocket'` | `'webrtc'` | Uplink broadcast protocol. |
| `resolution` | `'1080p60' \| '1080p' \| '720p60' \| '720p' \| '480p' \| '360p'` | `'720p'` | Video encoding resolution and framerate preset. |
| `audio` | `boolean` | `true` | Enable microphone input by default. |
| `video` | `boolean` | `true` | Enable camera input by default. |
| `onStart` | `() => void` | Optional | Callback when broadcast successfully goes live. |
| `onEnd` | `() => void` | Optional | Callback when stream is stopped. |

---

## 📄 License

MIT © [rakeshkundan](https://github.com/rakeshkundan)
