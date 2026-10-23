'use client';

import React, { useState } from 'react';
import { StreamPlayer, StreamProtocol } from 'castkit-client';

export default function WatchStreamPage({ params }: { params: { streamId: string } }) {
  const streamId = params.streamId || 'main-stage';
  const [protocol, setProtocol] = useState<StreamProtocol | 'auto'>('auto');
  const [serverUrl, setServerUrl] = useState('ws://localhost:5001/stream-signal');
  const [hlsUrl, setHlsUrl] = useState(`http://localhost:5001/live/${streamId}/index.m3u8`);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'localhost';
      setServerUrl(`ws://${host}:5001/stream-signal`);
      setHlsUrl(`http://${host}:5001/live/${streamId}/index.m3u8`);
    }
  }, [streamId]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '36px 20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px 0' }}>
            Live: {streamId}
          </h1>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '13px' }}>
            Ultra-low latency sub-second live video with YouTube-style DVR catch-up
          </p>
        </div>

        {/* Protocol Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>Engine:</span>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as any)}
            style={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option value="auto">Auto (WebRTC with HLS Fallback)</option>
            <option value="webrtc">Pure WebRTC (&lt;300ms)</option>
            <option value="hls">HLS (Broadcast CDN)</option>
            <option value="websocket">WebSocket Chunk Relay</option>
          </select>
        </div>
      </div>

      {/* Embed Player Component */}
      <StreamPlayer
        serverUrl={serverUrl}
        streamId={streamId}
        protocol={protocol}
        hlsUrl={hlsUrl}
        title={`Live Broadcast • ${streamId}`}
        autoPlay={true}
        enableCatchUpSync={true}
      />

      {/* Live Information Box */}
      <div
        style={{
          marginTop: '28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#111827',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px 0' }}>
            ⚡ Catch-Up Sync Active
          </h3>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
            If your connection fluctuates and you drop behind the live broadcast, the player automatically
            accelerates playback slightly (1.06x) until real-time sync is regained.
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#111827',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px 0' }}>
            🔄 Seamless Failover
          </h3>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
            In Auto mode, viewers behind corporate firewalls or NATs that block UDP/WebRTC traffic
            automatically fall back to HTTP-based HLS video segments without interrupting playback.
          </p>
        </div>
      </div>
    </div>
  );
}
