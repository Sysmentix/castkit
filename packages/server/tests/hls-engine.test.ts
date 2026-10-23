import { describe, it, expect } from 'vitest';
import { HlsEngine } from '../src/adapters/hls-engine.js';
import http from 'node:http';

describe('HlsEngine & ABR CDN Edge Cases', () => {
  it('should generate master playlist with multi-bitrate ABR ladder', () => {
    const engine = new HlsEngine();
    // Initialize stream buffer with segment
    engine.pushSegment('stage-one', Buffer.from('data'), 4);
    const masterPlaylist = engine.getMasterPlaylist('stage-one', '/live');

    expect(masterPlaylist).toContain('#EXTM3U');
    expect(masterPlaylist).toContain('#EXT-X-VERSION:3');
    // Multi-bitrate ladders
    expect(masterPlaylist).toContain('RESOLUTION=1920x1080');
    expect(masterPlaylist).toContain('BANDWIDTH=4500000');
    expect(masterPlaylist).toContain('RESOLUTION=1280x720');
    expect(masterPlaylist).toContain('RESOLUTION=854x480');
    expect(masterPlaylist).toContain('RESOLUTION=640x360');
  });

  it('should generate media playlist with correct segment sequences and durations', () => {
    const engine = new HlsEngine({ segmentDuration: 4 });

    // Push 3 video segments
    engine.pushSegment('concert', Buffer.from('fake-video-chunk-1'), 4);
    engine.pushSegment('concert', Buffer.from('fake-video-chunk-2'), 4);
    engine.pushSegment('concert', Buffer.from('fake-video-chunk-3'), 4);

    const mediaPlaylist = engine.getMediaPlaylist('concert');

    expect(mediaPlaylist).toContain('#EXTM3U');
    expect(mediaPlaylist).toContain('#EXT-X-TARGETDURATION:4');
    expect(mediaPlaylist).toContain('#EXTINF:4.000');
    expect(mediaPlaylist).toContain('segment_1.ts');
    expect(mediaPlaylist).toContain('segment_2.ts');
    expect(mediaPlaylist).toContain('segment_3.ts');
  });

  it('should enforce sliding DVR window and purge old segments', () => {
    // 10 second DVR window, 2s segments (max 5 segments retained)
    const engine = new HlsEngine({
      dvrWindowSeconds: 10,
      segmentDuration: 2,
    });

    for (let i = 0; i < 8; i++) {
      engine.pushSegment('marathon', Buffer.from(`segment-data-${i}`), 2);
    }

    const buffer = engine.getBuffer('marathon');
    expect(buffer).toBeDefined();
    // 8 segments * 2s = 16s. With a 10s window, segments are pruned
    expect(buffer!.segments.length).toBeLessThanOrEqual(5);

    // Oldest segment should no longer be segment 1
    expect(buffer!.segments[0].sequence).toBeGreaterThan(1);
  });

  it('should respond to HTTP requests with CDN cache-control and CORS headers', () => {
    const engine = new HlsEngine();
    engine.pushSegment('webinar', Buffer.from('ts-binary-content'), 4);

    const mockHeaders: Record<string, string> = {};
    let statusCode = 200;
    let responseBody = '';

    const mockRes = {
      setHeader: (key: string, value: string) => {
        mockHeaders[key] = value;
      },
      writeHead: (status: number, headers?: Record<string, string>) => {
        statusCode = status;
        if (headers) Object.assign(mockHeaders, headers);
      },
      end: (data?: string | Buffer) => {
        if (data) responseBody = data.toString();
      },
    } as unknown as http.ServerResponse;

    // 1. Test Master Playlist Request
    const masterReq = { url: '/live/webinar/index.m3u8', method: 'GET' } as http.IncomingMessage;
    const handledMaster = engine.handleHttpRequest(masterReq, mockRes, '/live');

    expect(handledMaster).toBe(true);
    expect(statusCode).toBe(200);
    expect(mockHeaders['Content-Type']).toBe('application/vnd.apple.mpegurl');
    expect(mockHeaders['Access-Control-Allow-Origin']).toBe('*');
    // Playlists must NOT be cached on CDN edges
    expect(mockHeaders['Cache-Control']).toContain('no-cache');

    // 2. Test Media Segment (.ts) Request
    const segmentReq = { url: '/live/webinar/segment_1.ts', method: 'GET' } as http.IncomingMessage;
    const handledSegment = engine.handleHttpRequest(segmentReq, mockRes, '/live');

    expect(handledSegment).toBe(true);
    expect(statusCode).toBe(200);
    expect(mockHeaders['Content-Type']).toBe('video/mp2t');
    // Media segments MUST be permanently cached (immutable) for YouTube/CDN scale!
    expect(mockHeaders['Cache-Control']).toBe('public, max-age=86400, immutable');
    expect(responseBody).toBe('ts-binary-content');
  });

  it('should return 404 for unknown stream or missing segment', () => {
    const engine = new HlsEngine();
    let statusCode = 200;

    const mockRes = {
      setHeader: () => {},
      writeHead: (status: number) => {
        statusCode = status;
      },
      end: () => {},
    } as unknown as http.ServerResponse;

    const missingReq = { url: '/live/ghost-stream/segment_99.ts', method: 'GET' } as http.IncomingMessage;
    const handled = engine.handleHttpRequest(missingReq, mockRes, '/live');

    expect(handled).toBe(true);
    expect(statusCode).toBe(404);
  });

  it('should respond to OPTIONS preflight with 204 No Content and CORS headers', () => {
    const engine = new HlsEngine();
    let statusCode = 0;
    const headers: Record<string, string> = {};

    const mockRes = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      writeHead: (status: number) => {
        statusCode = status;
      },
      end: () => {},
    } as unknown as http.ServerResponse;

    const optReq = { url: '/live/stream-preflight/index.m3u8', method: 'OPTIONS' } as http.IncomingMessage;
    const handled = engine.handleHttpRequest(optReq, mockRes, '/live');

    expect(handled).toBe(true);
    expect(statusCode).toBe(204);
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('should ignore non-matching mount path URLs and return false', () => {
    const engine = new HlsEngine();
    const mockRes = { setHeader: () => {}, writeHead: () => {}, end: () => {} } as unknown as http.ServerResponse;
    const req = { url: '/api/v1/auth', method: 'GET' } as http.IncomingMessage;

    const handled = engine.handleHttpRequest(req, mockRes, '/live');
    expect(handled).toBe(false);
  });

  it('should serve variant quality playlists for ABR ladder switching', () => {
    const engine = new HlsEngine();
    engine.pushSegment('concert', Buffer.from('hd-seg'), 2, '720p');
    engine.pushSegment('concert', Buffer.from('fhd-seg'), 2, '1080p');

    let response = '';
    const mockRes = {
      setHeader: () => {},
      writeHead: () => {},
      end: (data: string) => {
        response = data;
      },
    } as unknown as http.ServerResponse;

    const req = { url: '/live/concert/720p/index.m3u8', method: 'GET' } as http.IncomingMessage;
    const handled = engine.handleHttpRequest(req, mockRes, '/live');

    expect(handled).toBe(true);
    expect(response).toContain('#EXTM3U');
    expect(response).toContain('segment_1.ts');
  });
});
