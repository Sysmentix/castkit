import { describe, it, expect } from 'vitest';

/**
 * YouTube-style catch-up playback synchronization logic
 */
function calculateCatchUpRate(latencySeconds: number, currentRate: number = 1.0): number {
  const DRIFT_THRESHOLD = 1.5; // seconds
  const RECOVERED_THRESHOLD = 0.5; // seconds
  const ACCELERATED_RATE = 1.06;

  if (latencySeconds > DRIFT_THRESHOLD) {
    return ACCELERATED_RATE;
  } else if (latencySeconds <= RECOVERED_THRESHOLD && currentRate > 1.0) {
    return 1.0;
  }
  return currentRate;
}

describe('YouTube-Style Catch-Up Sync Algorithm Edge Cases', () => {
  it('should maintain standard 1.0x playback rate when latency is minimal (<1.5s)', () => {
    expect(calculateCatchUpRate(0.2)).toBe(1.0);
    expect(calculateCatchUpRate(0.8)).toBe(1.0);
    expect(calculateCatchUpRate(1.4)).toBe(1.0);
  });

  it('should accelerate playback to 1.06x when video lags behind the live edge (>1.5s)', () => {
    expect(calculateCatchUpRate(1.8)).toBe(1.06);
    expect(calculateCatchUpRate(3.5)).toBe(1.06);
    expect(calculateCatchUpRate(10.0)).toBe(1.06);
  });

  it('should smoothly return playback to 1.0x once live edge is caught up (<=0.5s)', () => {
    const rateWhileCatchingUp = 1.06;

    // Still slightly behind: keep catching up
    expect(calculateCatchUpRate(0.9, rateWhileCatchingUp)).toBe(1.06);

    // Fully caught up: normalize back to 1.0x
    expect(calculateCatchUpRate(0.4, rateWhileCatchingUp)).toBe(1.0);
    expect(calculateCatchUpRate(0.1, rateWhileCatchingUp)).toBe(1.0);
  });

  it('should handle negative latency or clock skew gracefully without accelerating', () => {
    // When client clock is slightly ahead of NTP server time
    expect(calculateCatchUpRate(-0.5)).toBe(1.0);
    expect(calculateCatchUpRate(-2.0)).toBe(1.0);
  });

  it('should flag severe drift (>8s) requiring hard jump-to-live seek instead of micro-acceleration', () => {
    function evaluateSyncAction(latencySec: number, targetSec: number = 2): 'normal' | 'speed_up' | 'hard_seek' {
      if (latencySec > 8) return 'hard_seek';
      if (latencySec > targetSec + 1.5) return 'speed_up';
      return 'normal';
    }

    expect(evaluateSyncAction(1.0)).toBe('normal');
    expect(evaluateSyncAction(4.0)).toBe('speed_up');
    expect(evaluateSyncAction(9.5)).toBe('hard_seek');
    expect(evaluateSyncAction(30.0)).toBe('hard_seek');
  });
});
