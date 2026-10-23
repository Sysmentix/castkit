import { useState, useEffect, useRef, useCallback } from 'react';
import { StreamPlayerClient, PlayerOptions } from '../../player.js';
import { StreamStatus, StreamProtocol, StreamStats, StreamChatMessage } from '../../core/index.js';

export function useLivePlayer(options: PlayerOptions) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [activeProtocol, setActiveProtocol] = useState<StreamProtocol>('webrtc');
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const [chatMessages, setChatMessages] = useState<StreamChatMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clientRef = useRef<StreamPlayerClient | null>(null);

  useEffect(() => {
    const client = new StreamPlayerClient(options);
    clientRef.current = client;

    client.on('statusChange', (s) => setStatus(s));
    client.on('protocolChange', (p) => setActiveProtocol(p));
    client.on('viewerCount', (c) => setViewerCount(c));
    client.on('statsUpdate', (st) => setStats(st));
    client.on('chatMessage', (msg) => setChatMessages((prev) => [...prev, msg]));
    client.on('remoteStreamReady', (stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          if (err.name === 'NotAllowedError') {
            videoRef.current!.muted = true;
            videoRef.current!.play().catch(() => {});
          }
        });
      }
    });

    if (videoRef.current) {
      client.attachVideoElement(videoRef.current);
    }

    if (options.autoPlay !== false) {
      client.play().catch((err) => setError(err));
    }

    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [options.serverUrl, options.streamId, options.protocol]);

  const play = useCallback(async () => {
    setError(null);
    if (!clientRef.current) return;
    try {
      await clientRef.current.play();
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    clientRef.current?.stop();
    setStatus('ended');
  }, []);

  const jumpToLive = useCallback(() => {
    clientRef.current?.jumpToLive();
  }, []);

  const seek = useCallback((seconds: number) => {
    clientRef.current?.seek(seconds);
  }, []);

  const sendChatMessage = useCallback((text: string, senderName: string = 'Viewer') => {
    clientRef.current?.sendChatMessage(text, senderName);
  }, []);

  return {
    status,
    isLive: status === 'live',
    activeProtocol,
    viewerCount,
    stats,
    chatMessages,
    error,
    videoRef,
    play,
    stop,
    jumpToLive,
    seek,
    sendChatMessage,
  };
}
