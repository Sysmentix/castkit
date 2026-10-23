import React, { useState } from 'react';
import { useLiveBroadcaster } from '../hooks/useLiveBroadcaster.js';
import { useMediaDevices } from '../hooks/useMediaDevices.js';
import { LiveBadge } from './LiveBadge.js';
import { DeviceSelector } from './DeviceSelector.js';
import { BroadcasterOptions } from '../../broadcaster.js';

export interface StreamBroadcasterProps extends BroadcasterOptions {
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  onStart?: () => void;
  onEnd?: () => void;
}

export const StreamBroadcaster: React.FC<StreamBroadcasterProps> = ({
  title = 'Live Broadcast Studio',
  className = '',
  style = {},
  onStart,
  onEnd,
  ...options
}) => {
  const {
    status,
    isLive,
    viewerCount,
    isScreenSharing,
    isMuted,
    isVideoPaused,
    error,
    videoRef,
    start,
    stop,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    switchCamera,
  } = useLiveBroadcaster(options);

  const {
    cameras,
    microphones,
    selectedCamera,
    selectedMic,
    setSelectedCamera,
    setSelectedMic,
  } = useMediaDevices();

  const [showSettings, setShowSettings] = useState(false);

  const handleToggleLive = async () => {
    if (isLive) {
      stop();
      onEnd?.();
    } else {
      try {
        await start();
        onStart?.();
      } catch {
        // Error is surfaced via the error banner in UI
      }
    }
  };

  const handleSelectCamera = (id: string) => {
    setSelectedCamera(id);
    switchCamera(id);
  };

  return (
    <div
      className={`stream-module-broadcaster ${className}`}
      style={{
        position: 'relative',
        backgroundColor: '#0a0d14',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f9fafb',
        maxWidth: '900px',
        margin: '0 auto',
        ...style,
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LiveBadge isLive={isLive} viewerCount={viewerCount} />
          <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.01em' }}>
            {title}
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#9ca3af',
              textTransform: 'uppercase',
            }}
          >
            {options.protocol || 'webrtc'}
          </span>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            backgroundColor: showSettings ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e5e7eb',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Video Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: isScreenSharing ? 'none' : 'scaleX(-1)', // mirror selfie camera
            display: status === 'idle' ? 'none' : 'block',
          }}
        />

        {status === 'idle' && (
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>📹</div>
            <p style={{ fontSize: '14px', margin: 0 }}>Camera preview will appear when you go live</p>
          </div>
        )}

        {status === 'connecting' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: '13px', color: '#93c5fd' }}>Connecting to stream gateway...</span>
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.9)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              backdropFilter: 'blur(8px)',
            }}
          >
            ⚠️ {error.message}
          </div>
        )}

        {/* Settings Drawer Overlay */}
        {showSettings && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 20,
              width: '280px',
            }}
          >
            <DeviceSelector
              cameras={cameras}
              microphones={microphones}
              selectedCamera={selectedCamera}
              selectedMic={selectedMic}
              onSelectCamera={handleSelectCamera}
              onSelectMic={(id) => setSelectedMic(id)}
            />
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          backgroundColor: '#111827',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mute Button */}
          <button
            onClick={toggleAudio}
            style={{
              backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.12)'}`,
              color: isMuted ? '#ef4444' : '#f3f4f6',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
          </button>

          {/* Video Toggle Button */}
          <button
            onClick={toggleVideo}
            style={{
              backgroundColor: isVideoPaused ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isVideoPaused ? '#ef4444' : 'rgba(255, 255, 255, 0.12)'}`,
              color: isVideoPaused ? '#ef4444' : '#f3f4f6',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {isVideoPaused ? '🛑 Start Video' : '📷 Stop Video'}
          </button>

          {/* Screen Share Button */}
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            style={{
              backgroundColor: isScreenSharing ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isScreenSharing ? '#3b82f6' : 'rgba(255, 255, 255, 0.12)'}`,
              color: isScreenSharing ? '#60a5fa' : '#f3f4f6',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {isScreenSharing ? '🖥️ Stop Sharing' : '🖥️ Share Screen'}
          </button>
        </div>

        {/* Go Live / End Stream Button */}
        <button
          onClick={handleToggleLive}
          style={{
            backgroundColor: isLive ? '#dc2626' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            boxShadow: isLive ? '0 0 16px rgba(220, 38, 38, 0.5)' : '0 0 16px rgba(37, 99, 235, 0.5)',
            transition: 'all 0.2s ease',
          }}
        >
          {isLive ? 'End Stream' : '🔴 Go Live'}
        </button>
      </div>
    </div>
  );
};
