import React, { useState, useRef, useEffect } from 'react';
import { useLivePlayer } from '../hooks/useLivePlayer.js';
import { LiveBadge } from './LiveBadge.js';
import { PlayerOptions } from '../../player.js';

export interface StreamPlayerProps extends PlayerOptions {
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  showControls?: boolean;
}

export const StreamPlayer: React.FC<StreamPlayerProps> = ({
  title = 'Live Stream',
  className = '',
  style = {},
  showControls = true,
  ...options
}) => {
  const {
    status,
    isLive,
    activeProtocol,
    viewerCount,
    stats,
    error,
    videoRef,
    play,
    stop,
    jumpToLive,
    seek,
  } = useLivePlayer(options);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(options.muted ?? true);
  const [volume, setVolume] = useState<number>(1);
  const [isLiveEdge, setIsLiveEdge] = useState<boolean>(true);
  const [showStatsHud, setShowStatsHud] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hovered, setHovered] = useState<boolean>(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;

    const isCurrentlyFullscreen =
      !!document.fullscreenElement ||
      !!(document as any).webkitFullscreenElement ||
      !!(video as any)?.webkitDisplayingFullscreen ||
      isFullscreen;

    if (!isCurrentlyFullscreen) {
      if (container && typeof container.requestFullscreen === 'function') {
        container.requestFullscreen().catch(() => {
          if (video && typeof (video as any).webkitEnterFullscreen === 'function') {
            (video as any).webkitEnterFullscreen();
          }
        });
        setIsFullscreen(true);
      } else if (container && typeof (container as any).webkitRequestFullscreen === 'function') {
        (container as any).webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (video && typeof (video as any).webkitEnterFullscreen === 'function') {
        // iOS Safari on iPhone
        (video as any).webkitEnterFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (typeof (document as any).webkitExitFullscreen === 'function') {
        (document as any).webkitExitFullscreen();
      } else if (video && typeof (video as any).webkitExitFullscreen === 'function') {
        (video as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement ||
        !!(videoRef.current as any)?.webkitDisplayingFullscreen;
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    const video = videoRef.current;
    const onBeginFs = () => setIsFullscreen(true);
    const onEndFs = () => setIsFullscreen(false);
    if (video) {
      video.addEventListener('webkitbeginfullscreen', onBeginFs);
      video.addEventListener('webkitendfullscreen', onEndFs);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', onBeginFs);
        video.removeEventListener('webkitendfullscreen', onEndFs);
      }
    };
  }, []);

  const handleJumpToLive = () => {
    jumpToLive();
    setIsLiveEdge(true);
  };

  return (
    <div
      ref={containerRef}
      className={`stream-module-player ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        backgroundColor: '#05070c',
        borderRadius: isFullscreen ? '0px' : '16px',
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : '0 20px 40px rgba(0, 0, 0, 0.7)',
        border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f9fafb',
        maxWidth: isFullscreen ? '100%' : '900px',
        width: '100%',
        margin: '0 auto',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Video Element */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: isFullscreen ? 'auto' : '16/9',
          height: isFullscreen ? '100vh' : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
        }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          autoPlay={options.autoPlay ?? true}
          playsInline
          muted={isMuted}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />

        {/* Unmute prompt banner if playing muted */}
        {isMuted && isLive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(8px)',
              zIndex: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            🔇 Click to Unmute
          </button>
        )}

        {/* Connecting Spinner */}
        {status === 'connecting' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              zIndex: 8,
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
            <span style={{ fontSize: '13px', color: '#93c5fd' }}>Connecting to live broadcast...</span>
          </div>
        )}

        {/* Offline / Ended Overlay */}
        {(status === 'ended' || (status === 'idle' && !isLive)) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(10, 13, 20, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '40px' }}>📡</div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Stream is Offline</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
              Waiting for broadcaster to go live...
            </p>
          </div>
        )}

        {/* Reconnecting Overlay */}
        {status === 'reconnecting' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: '#f59e0b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: '13px', color: '#fde68a' }}>Reconnecting to stream...</span>
          </div>
        )}

        {/* Stats HUD (Bitrate, FPS, Latency) */}
        {showStatsHud && stats && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '12px',
              lineHeight: 1.6,
              fontFamily: 'monospace',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 15,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>
              STREAM TELEMETRY
            </div>
            <div>Protocol: <span style={{ color: '#a7f3d0' }}>{activeProtocol.toUpperCase()}</span></div>
            <div>Resolution: {stats.width}x{stats.height}</div>
            <div>FPS: {stats.fps.toFixed(1)}</div>
            <div>Bitrate: {stats.bitrateKbps} kbps</div>
            <div>Latency: {stats.latencyMs} ms</div>
            <div>Buffer: {stats.bufferLengthSec.toFixed(2)}s</div>
          </div>
        )}
      </div>

      {/* Floating Top Header (Shown on Hover) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '14px 20px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: hovered || !isPlaying ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: hovered || !isPlaying ? 'auto' : 'none',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div onClick={handleJumpToLive} style={{ cursor: 'pointer' }}>
            <LiveBadge isLive={isLive} viewerCount={viewerCount} />
          </div>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{title}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowStatsHud(!showStatsHud);
          }}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          {showStatsHud ? 'Hide Stats' : '📊 Stats'}
        </button>
      </div>

      {/* Bottom Control Bar */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            padding: '12px 18px',
            opacity: hovered || !isPlaying ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: hovered || !isPlaying ? 'auto' : 'none',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left Controls: Play, Jump To Live, Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={togglePlay}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {/* Jump to Live Button (YouTube Style) */}
              <button
                onClick={handleJumpToLive}
                style={{
                  background: isLiveEdge ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  border: `1px solid ${isLiveEdge ? '#ef4444' : '#6b7280'}`,
                  color: isLiveEdge ? '#ef4444' : '#9ca3af',
                  borderRadius: '9999px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isLiveEdge ? '#ef4444' : '#6b7280',
                  }}
                />
                LIVE
              </button>

              {/* Volume Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={toggleMute}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '15px',
                    cursor: 'pointer',
                  }}
                >
                  {isMuted || volume === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{ width: '60px', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Right Controls: Protocol Tag, Fullscreen */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#d1d5db',
                  fontFamily: 'monospace',
                }}
              >
                {activeProtocol}
              </span>

              <button
                onClick={toggleFullscreen}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                {isFullscreen ? '↙' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
