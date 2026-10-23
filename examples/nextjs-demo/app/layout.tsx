import React from 'react';

export const metadata = {
  title: 'StreamModule Live — Enterprise Video Streaming',
  description: 'Ultra-low latency and YouTube-scalable live video streaming for Node.js and React/Next.js',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#07090e',
          color: '#f3f4f6',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Navigation Bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 28px',
            backgroundColor: 'rgba(11, 15, 23, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <a
              href="/"
              style={{
                textDecoration: 'none',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              StreamModule<span style={{ color: '#ef4444' }}>.Live</span>
            </a>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a
              href="/"
              style={{
                color: '#9ca3af',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'color 0.15s',
              }}
            >
              Overview
            </a>
            <a
              href="/watch/main-stage"
              style={{
                color: '#9ca3af',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Watch Stream
            </a>
            <a
              href="/studio"
              style={{
                backgroundColor: '#dc2626',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: '8px',
                boxShadow: '0 0 12px rgba(220, 38, 38, 0.4)',
              }}
            >
              🔴 Go Live (Studio)
            </a>
          </nav>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1 }}>{children}</main>

        {/* Footer */}
        <footer
          style={{
            padding: '24px',
            textAlign: 'center',
            fontSize: '13px',
            color: '#6b7280',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          StreamModule • Pluggable WebRTC SFU, YouTube-Scale HLS & WebSocket Streaming for Node.js & React
        </footer>
      </body>
    </html>
  );
}
