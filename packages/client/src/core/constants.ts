import { ResolutionPreset, VideoProfile } from './types.js';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export const RESOLUTION_PRESETS: Record<ResolutionPreset, VideoProfile> = {
  '1080p60': {
    preset: '1080p60',
    width: 1920,
    height: 1080,
    frameRate: 60,
    bitrateKbps: 6000,
  },
  '1080p': {
    preset: '1080p',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrateKbps: 4500,
  },
  '720p60': {
    preset: '720p60',
    width: 1280,
    height: 720,
    frameRate: 60,
    bitrateKbps: 4000,
  },
  '720p': {
    preset: '720p',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrateKbps: 2500,
  },
  '480p': {
    preset: '480p',
    width: 854,
    height: 480,
    frameRate: 30,
    bitrateKbps: 1200,
  },
  '360p': {
    preset: '360p',
    width: 640,
    height: 360,
    frameRate: 30,
    bitrateKbps: 700,
  },
};

export const DEFAULT_HLS_SEGMENT_DURATION_SEC = 2;
export const DEFAULT_DVR_WINDOW_SECONDS = 7200; // 2 hours live rewind window
export const DEFAULT_SIGNALING_PATH = '/stream-signal';
export const DEFAULT_HLS_PATH = '/live';
