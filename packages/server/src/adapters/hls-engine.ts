import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DEFAULT_HLS_SEGMENT_DURATION_SEC,
  DEFAULT_DVR_WINDOW_SECONDS,
  RESOLUTION_PRESETS,
  ABRQuality,
} from '../core/index.js';

export interface HlsSegment {
  sequence: number;
  duration: number; // in seconds
  data: Buffer;
  timestamp: number;
  quality?: string;
}

export interface StreamHlsBuffer {
  streamId: string;
  sequenceCounter: number;
  segments: HlsSegment[];
  dvrWindowSeconds: number;
  targetDuration: number;
  qualities: ABRQuality[];
}

export class HlsEngine {
  private buffers: Map<string, StreamHlsBuffer> = new Map();

  constructor() {}

  public initStream(streamId: string, dvrWindowSeconds: number = DEFAULT_DVR_WINDOW_SECONDS): StreamHlsBuffer {
    let buf = this.buffers.get(streamId);
    if (!buf) {
      buf = {
        streamId,
        sequenceCounter: 1,
        segments: [],
        dvrWindowSeconds,
        targetDuration: DEFAULT_HLS_SEGMENT_DURATION_SEC,
        qualities: [
          { id: '1080p', label: '1080p (FHD)', width: 1920, height: 1080, bitrateKbps: 4500 },
          { id: '720p', label: '720p (HD)', width: 1280, height: 720, bitrateKbps: 2500, isDefault: true },
          { id: '480p', label: '480p (SD)', width: 854, height: 480, bitrateKbps: 1200 },
          { id: '360p', label: '360p (Low)', width: 640, height: 360, bitrateKbps: 700 },
        ],
      };
      this.buffers.set(streamId, buf);
    }
    return buf;
  }

  public pushSegment(
    streamId: string,
    data: Buffer,
    durationSec: number = DEFAULT_HLS_SEGMENT_DURATION_SEC,
    quality?: string
  ): HlsSegment {
    const buf = this.initStream(streamId);
    const seq = buf.sequenceCounter++;

    const segment: HlsSegment = {
      sequence: seq,
      duration: durationSec,
      data,
      timestamp: Date.now(),
      quality,
    };

    buf.segments.push(segment);

    // Prune segments older than DVR window
    const maxSegments = Math.ceil(buf.dvrWindowSeconds / buf.targetDuration);
    if (buf.segments.length > maxSegments) {
      buf.segments.splice(0, buf.segments.length - maxSegments);
    }

    return segment;
  }

  public getMasterPlaylist(streamId: string, basePath: string = ''): string {
    const buf = this.buffers.get(streamId);
    if (!buf) {
      return '';
    }

    let m3u8 = '#EXTM3U\n#EXT-X-VERSION:3\n';
    for (const q of buf.qualities) {
      m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${q.bitrateKbps * 1000},RESOLUTION=${q.width}x${q.height},NAME="${q.label}"\n`;
      m3u8 += `${basePath}/${streamId}/${q.id}/index.m3u8\n`;
    }
    return m3u8;
  }

  public getMediaPlaylist(streamId: string, quality?: string, maxLiveSegments: number = 6): string {
    const buf = this.buffers.get(streamId);
    if (!buf || buf.segments.length === 0) {
      // Empty / standby playlist
      return '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n';
    }

    const filteredSegments = quality
      ? buf.segments.filter((s) => !s.quality || s.quality === quality)
      : buf.segments;

    // Use recent sliding window segments for low-latency live edge
    const activeSegments =
      maxLiveSegments > 0 && filteredSegments.length > maxLiveSegments
        ? filteredSegments.slice(-maxLiveSegments)
        : filteredSegments;

    const firstSeq = activeSegments[0]?.sequence ?? 0;
    const targetDuration = Math.max(
      buf.targetDuration,
      ...activeSegments.map((s) => Math.ceil(s.duration))
    );

    let m3u8 = '#EXTM3U\n';
    m3u8 += '#EXT-X-VERSION:3\n';
    m3u8 += `#EXT-X-TARGETDURATION:${targetDuration}\n`;
    m3u8 += `#EXT-X-MEDIA-SEQUENCE:${firstSeq}\n`;

    for (const seg of activeSegments) {
      m3u8 += `#EXTINF:${seg.duration.toFixed(3)},\n`;
      m3u8 += `segment_${seg.sequence}.ts\n`;
    }

    return m3u8;
  }

  public getSegment(streamId: string, sequence: number): HlsSegment | undefined {
    const buf = this.buffers.get(streamId);
    if (!buf) return undefined;
    return buf.segments.find((s) => s.sequence === sequence);
  }

  /**
   * HTTP Handler with YouTube/CDN Grade Cache Optimization & CORS
   */
  public handleHttpRequest(
    req: IncomingMessage,
    res: ServerResponse,
    baseMountPath: string = '/live'
  ): boolean {
    const url = req.url || '';
    if (!url.startsWith(baseMountPath)) {
      return false;
    }

    // Always enable CORS for web player requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    const subPath = url.slice(baseMountPath.length).replace(/^\//, '');
    const parts = subPath.split('/');

    // Route 1: /live/:streamId/master.m3u8 -> Master Playlist
    if (parts.length === 2 && parts[1] === 'master.m3u8') {
      const streamId = parts[0];
      const master = this.getMasterPlaylist(streamId, baseMountPath);
      if (!master) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Stream not found or offline');
        return true;
      }

      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        // CDN Caching: Master playlist changes rarely, short cache
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(master);
      return true;
    }

    // Route 2: /live/:streamId/index.m3u8 -> Live Media Playlist (Default)
    if (parts.length === 2 && parts[1] === 'index.m3u8') {
      const streamId = parts[0];
      const playlist = this.getMediaPlaylist(streamId);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        // Live manifests must not be cached stale by CDN
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(playlist);
      return true;
    }

    // Route 3: /live/:streamId/:quality/index.m3u8 -> Variant Quality Media Playlist
    if (parts.length === 3 && parts[2] === 'index.m3u8') {
      const [streamId, quality] = parts;
      const playlist = this.getMediaPlaylist(streamId, quality);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(playlist);
      return true;
    }

    // Route 4: /live/:streamId/segment_:seq.ts -> Video Segment chunk
    const segMatch = subPath.match(/^([^/]+)\/segment_(\d+)\.ts$/);
    if (segMatch) {
      const streamId = segMatch[1];
      const seq = parseInt(segMatch[2], 10);
      const segment = this.getSegment(streamId, seq);

      if (!segment) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Segment expired or not found');
        return true;
      }

      res.writeHead(200, {
        'Content-Type': 'video/mp2t',
        'Content-Length': segment.data.length,
        // YouTube/Twitch standard: Segments are immutable and cached forever by CDNs
        'Cache-Control': 'public, max-age=86400, immutable',
      });
      res.end(segment.data);
      return true;
    }

    return false;
  }
}
