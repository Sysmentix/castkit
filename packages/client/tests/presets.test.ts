import { describe, it, expect } from 'vitest';
import { RESOLUTION_PRESETS, ResolutionPreset } from '../src/core/index.js';

describe('Resolution Presets & Framerate Edge Cases', () => {
  it('should define 60fps high-bitrate presets (1080p60 and 720p60)', () => {
    const p1080p60 = RESOLUTION_PRESETS['1080p60'];
    expect(p1080p60).toBeDefined();
    expect(p1080p60.width).toBe(1920);
    expect(p1080p60.height).toBe(1080);
    expect(p1080p60.frameRate).toBe(60);
    expect(p1080p60.bitrateKbps).toBe(6000); // 6 Mbps

    const p720p60 = RESOLUTION_PRESETS['720p60'];
    expect(p720p60).toBeDefined();
    expect(p720p60.width).toBe(1280);
    expect(p720p60.height).toBe(720);
    expect(p720p60.frameRate).toBe(60);
    expect(p720p60.bitrateKbps).toBe(4000); // 4 Mbps
  });

  it('should define standard 30fps presets (1080p, 720p, 480p, 360p)', () => {
    const standardKeys: ResolutionPreset[] = ['1080p', '720p', '480p', '360p'];

    for (const key of standardKeys) {
      const preset = RESOLUTION_PRESETS[key];
      expect(preset).toBeDefined();
      expect(preset.frameRate).toBe(30);
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.bitrateKbps).toBeGreaterThan(0);
    }
  });

  it('should maintain descending bitrate ladder from 1080p60 down to 360p', () => {
    expect(RESOLUTION_PRESETS['1080p60'].bitrateKbps).toBeGreaterThan(RESOLUTION_PRESETS['1080p'].bitrateKbps);
    expect(RESOLUTION_PRESETS['1080p'].bitrateKbps).toBeGreaterThan(RESOLUTION_PRESETS['720p'].bitrateKbps);
    expect(RESOLUTION_PRESETS['720p'].bitrateKbps).toBeGreaterThan(RESOLUTION_PRESETS['480p'].bitrateKbps);
    expect(RESOLUTION_PRESETS['480p'].bitrateKbps).toBeGreaterThan(RESOLUTION_PRESETS['360p'].bitrateKbps);
  });

  it('should maintain standard 16:9 widescreen aspect ratio across presets', () => {
    const keys: ResolutionPreset[] = ['1080p60', '1080p', '720p60', '720p', '360p'];
    for (const key of keys) {
      const preset = RESOLUTION_PRESETS[key];
      const ratio = preset.width / preset.height;
      expect(ratio).toBeCloseTo(16 / 9, 2);
    }
  });
});
