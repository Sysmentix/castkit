'use client';

import React, { useState } from 'react';
import { StreamBroadcaster, StreamProtocol, ResolutionPreset } from 'castkit-client';

export default function StudioPage() {
  const [streamId, setStreamId] = useState('main-stage');
  const [protocol, setProtocol] = useState<StreamProtocol>('webrtc');
  const [resolution, setResolution] = useState<ResolutionPreset>('720p');
  const [serverUrl, setServerUrl] = useState('ws://localhost:5001/stream-signal');
  const [currentHost, setCurrentHost] = useState('localhost');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'localhost';
      setCurrentHost(host);
      setServerUrl(`ws://${host}:5001/stream-signal`);
    }
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '36px 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0' }}>
          Broadcast Studio
        </h1>
        <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>
          Go live directly from your browser with webcam, microphone, or screen sharing.
        </p>
      </div>

      {/* Stream Configuration Panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          backgroundColor: '#111827',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '24px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
            Room / Stream ID
          </label>
          <input
            type="text"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
            Streaming Protocol
          </label>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as StreamProtocol)}
            style={{
              width: '100%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="webrtc">WebRTC (Ultra Low Latency &lt;300ms)</option>
            <option value="websocket">WebSocket (Lightweight Dev / Fallback)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
            Target Resolution
          </label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
            style={{
              width: '100%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="1080p60">1080p @ 60 FPS (6.0 Mbps - High Quality)</option>
            <option value="720p60">720p @ 60 FPS (4.0 Mbps - Smooth)</option>
            <option value="1080p">1080p @ 30 FPS (4.5 Mbps)</option>
            <option value="720p">720p @ 30 FPS (2.5 Mbps)</option>
            <option value="480p">480p @ 30 FPS (1.2 Mbps)</option>
            <option value="360p">360p @ 30 FPS (700 kbps)</option>
          </select>
        </div>
      </div>

      {/* Embed Broadcaster Component */}
      <StreamBroadcaster
        serverUrl={serverUrl}
        streamId={streamId}
        protocol={protocol}
        resolution={resolution}
        title={`Studio: ${streamId}`}
      />

      {/* Viewer Link Card */}
      <div
        style={{
          marginTop: '24px',
          padding: '16px 20px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#93c5fd' }}>
            Viewer Playback URL
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
            📱 On your Phone (same Wi-Fi): <strong style={{ color: '#38bdf8' }}>http://192.168.31.100:3000/watch/{streamId}</strong>
          </div>
        </div>
        <a
          href={`http://${currentHost === 'localhost' ? '192.168.31.100' : currentHost}:3000/watch/${streamId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: '8px',
          }}
        >
          Open Viewer Page ↗
        </a>
      </div>
    </div>
  );
}
