import { describe, it, expect } from 'vitest';
import { StreamPlayerClient } from '../src/player.js';
import { StreamBroadcasterClient } from '../src/broadcaster.js';

describe('Client SDK Instantiation & Options Edge Cases', () => {
  it('should initialize StreamPlayerClient with default options', () => {
    const player = new StreamPlayerClient({
      serverUrl: 'ws://localhost:5001/stream-signal',
      streamId: 'my-stage',
    });

    expect(player).toBeDefined();
    expect(player['options'].protocol).toBe('auto');
    expect(player.getStatus()).toBe('idle');
    expect(player.getActiveProtocol()).toBe('webrtc');
    expect(player.getViewerCount()).toBe(0);
  });

  it('should initialize StreamBroadcasterClient with default presets', () => {
    const broadcaster = new StreamBroadcasterClient({
      serverUrl: 'ws://localhost:5001/stream-signal',
      streamId: 'my-stage',
    });

    expect(broadcaster).toBeDefined();
    expect(broadcaster['options'].protocol).toBe('webrtc');
    expect(broadcaster['options'].resolution).toBe('720p');
    expect(broadcaster.getStatus()).toBe('idle');
    expect(broadcaster.isAudioMuted()).toBe(false);
    expect(broadcaster.isVideoPaused()).toBe(false);
    expect(broadcaster.isScreenSharingActive()).toBe(false);
  });

  it('should allow custom resolution presets such as 1080p60 on broadcaster', () => {
    const broadcaster = new StreamBroadcasterClient({
      serverUrl: 'ws://localhost:5001/stream-signal',
      streamId: 'my-stage',
      resolution: '1080p60',
      audio: true,
      video: true,
    });

    expect(broadcaster['options'].resolution).toBe('1080p60');
  });

  it('should safely handle toggleAudio, toggleVideo and stop before stream is started', () => {
    const broadcaster = new StreamBroadcasterClient({
      serverUrl: 'ws://localhost:5001/stream-signal',
      streamId: 'offline-stage',
    });

    // Calling controls before media acquisition should be safe no-ops
    expect(broadcaster.toggleAudio(true)).toBe(false);
    expect(broadcaster.toggleVideo(true)).toBe(false);
    expect(() => broadcaster.stop()).not.toThrow();
    expect(broadcaster.getStatus()).toBe('ended');
  });

  it('should safely handle jumpToLive, seek, and stop on unattached player', () => {
    const player = new StreamPlayerClient({
      serverUrl: 'ws://localhost:5001/stream-signal',
      streamId: 'offline-stage',
    });

    expect(() => player.jumpToLive()).not.toThrow();
    expect(() => player.seek(10)).not.toThrow();
    expect(() => player.stop()).not.toThrow();
    expect(player.getStatus()).toBe('ended');
  });

  it('should accept custom ICE servers and latency targets', () => {
    const customIce = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:turn.mycorp.com:3478', username: 'u', credential: 'p' }];
    const player = new StreamPlayerClient({
      serverUrl: 'ws://localhost:5001/stream-signal',
      streamId: 'custom-stage',
      targetLatencySec: 1.2,
      iceServers: customIce,
      token: 'jwt-auth-token-123',
    });

    expect(player['options'].targetLatencySec).toBe(1.2);
    expect(player['options'].token).toBe('jwt-auth-token-123');
    expect(player['iceServers']).toEqual(customIce);
  });
});
