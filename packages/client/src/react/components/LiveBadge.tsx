import React from 'react';

export interface LiveBadgeProps {
  isLive?: boolean;
  viewerCount?: number;
  showViewerCount?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({
  isLive = true,
  viewerCount = 0,
  showViewerCount = true,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`stream-module-live-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: isLive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(107, 114, 128, 0.2)',
        border: `1px solid ${isLive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(156, 163, 175, 0.3)'}`,
        borderRadius: '9999px',
        padding: '3px 10px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '12px',
        fontWeight: 600,
        color: isLive ? '#ef4444' : '#9ca3af',
        letterSpacing: '0.05em',
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isLive ? '#ef4444' : '#9ca3af',
          boxShadow: isLive ? '0 0 8px #ef4444' : 'none',
          animation: isLive ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      <span>{isLive ? 'LIVE' : 'OFFLINE'}</span>
      {isLive && showViewerCount && (
        <>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ color: '#f3f4f6', fontWeight: 500 }}>
            {viewerCount.toLocaleString()} {viewerCount === 1 ? 'viewer' : 'viewers'}
          </span>
        </>
      )}
    </div>
  );
};
