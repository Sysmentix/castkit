import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StreamBroadcasterClient,
  BroadcasterOptions,
} from '../../broadcaster.js';
import { StreamStatus, StreamChatMessage } from '../../core/index.js';

export function useLiveBroadcaster(options: BroadcasterOptions) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoPaused, setIsVideoPaused] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<StreamChatMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clientRef = useRef<StreamBroadcasterClient | null>(null);

  // Initialize or update client instance
  useEffect(() => {
    const client = new StreamBroadcasterClient(options);
    clientRef.current = client;

    client.on('statusChange', (s) => setStatus(s));
    client.on('viewerCount', (c) => setViewerCount(c));
    client.on('error', (err) => setError(err));
    client.on('chatMessage', (msg) => setChatMessages((prev) => [...prev, msg]));

    client.on('localStreamReady', (stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // prevent host echo
        videoRef.current.play().catch(() => {});
      }
    });

    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [options.serverUrl, options.streamId, options.protocol]);

  const start = useCallback(async () => {
    setError(null);
    if (!clientRef.current) return;
    try {
      await clientRef.current.start();
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    clientRef.current?.stop();
    setStatus('ended');
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (!clientRef.current) return;
    const muted = clientRef.current.toggleAudio();
    setIsMuted(muted);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!clientRef.current) return;
    const paused = clientRef.current.toggleVideo();
    setIsVideoPaused(paused);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.startScreenShare();
      setIsScreenSharing(true);
    } catch (err: any) {
      setError(err);
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!clientRef.current) return;
    await clientRef.current.stopScreenShare();
    setIsScreenSharing(false);
  }, []);

  const switchCamera = useCallback(async (deviceId: string) => {
    if (!clientRef.current) return;
    await clientRef.current.switchCamera(deviceId);
  }, []);

  const sendChatMessage = useCallback((text: string, senderName: string = 'Host') => {
    clientRef.current?.sendChatMessage(text, senderName);
  }, []);

  return {
    status,
    isLive: status === 'live',
    viewerCount,
    isScreenSharing,
    isMuted,
    isVideoPaused,
    chatMessages,
    error,
    videoRef,
    start,
    stop,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    switchCamera,
    sendChatMessage,
  };
}
