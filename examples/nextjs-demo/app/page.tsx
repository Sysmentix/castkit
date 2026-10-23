'use client';

import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
        <div
          style={{
            display: 'inline-block',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '9999px',
            padding: '4px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#ef4444',
            marginBottom: '16px',
          }}
        >
          🚀 Unified Live Streaming Engine
        </div>
        <h1
          style={{
            fontSize: '44px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 16px 0',
            lineHeight: 1.15,
          }}
        >
          Stream Live Video to Millions or Sub-Second Rooms
        </h1>
        <p
          style={{
            fontSize: '18px',
            color: '#9ca3af',
            maxWidth: '700px',
            margin: '0 auto 32px auto',
            lineHeight: 1.6,
          }}
        >
          A plug-and-play Node.js module and React/Next.js library. Switch between ultra-low latency WebRTC,
          YouTube-scale CDN-cached HLS with DVR rewind, and zero-dependency WebSocket fallback.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <Link
            href="/studio"
            style={{
              backgroundColor: '#dc2626',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '15px',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.4)',
            }}
          >
            🔴 Open Broadcast Studio
          </Link>
          <Link
            href="/watch/main-stage"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#e5e7eb',
              padding: '12px 28px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '15px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            📺 Watch Stream Demo
          </Link>
        </div>
      </div>

      {/* Protocol Feature Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '56px',
        }}
      >
        {/* Card 1: WebRTC */}
        <div
          style={{
            backgroundColor: '#111827',
            padding: '24px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⚡</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
            WebRTC (Sub-Second Latency)
          </h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
            Real-time sub-300ms latency with camera, mic, and screen sharing. Built for webinars, gaming,
            auctions, and interactive watch parties.
          </p>
        </div>

        {/* Card 2: YouTube-scale HLS */}
        <div
          style={{
            backgroundColor: '#111827',
            padding: '24px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>🌐</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
            YouTube-Scale HLS + CDN
          </h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
            Broadcast to 10 or 1,000,000+ viewers via HTTP/CDN edge caching. Includes ABR ladder quality
            switching and 2-hour DVR live rewind.
          </p>
        </div>

        {/* Card 3: WebSocket Relay */}
        <div
          style={{
            backgroundColor: '#111827',
            padding: '24px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>📦</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
            Zero-Config WebSocket Relay
          </h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
            Pure JavaScript/TypeScript video chunking. No native C++ compilation, STUN/TURN, or external
            tools needed for rapid local prototyping.
          </p>
        </div>
      </div>

      {/* Integration Code Demo */}
      <div
        style={{
          backgroundColor: '#0d111a',
          borderRadius: '16px',
          padding: '28px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0' }}>
          3 Lines to Integrate into React / Next.js
        </h2>
        <pre
          style={{
            backgroundColor: '#05070c',
            padding: '18px',
            borderRadius: '10px',
            overflowX: 'auto',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#a7f3d0',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            margin: 0,
          }}
        >{`// In your React / Next.js app:
import { StreamBroadcaster, StreamPlayer } from 'castkit-client';

// For the Broadcaster (Host):
<StreamBroadcaster serverUrl="ws://localhost:5001/stream-signal" streamId="my-stream" />

// For the Viewer (Audience):
<StreamPlayer serverUrl="ws://localhost:5001/stream-signal" streamId="my-stream" autoPlay />`}</pre>
      </div>
    </div>
  );
}
