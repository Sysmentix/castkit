import { describe, it, expect, vi } from 'vitest';
import { TypedEventEmitter } from '../src/core/events.js';

interface TestEvents {
  statusChange: string;
  viewerCount: number;
  error: Error;
}

describe('TypedEventEmitter Edge Cases', () => {
  it('should emit events to registered listeners with correct arguments', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('statusChange', listener);
    emitter.emit('statusChange', 'live');

    expect(listener).toHaveBeenCalledWith('live');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should support multiple listeners on the same event', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const l1 = vi.fn();
    const l2 = vi.fn();

    emitter.on('viewerCount', l1);
    emitter.on('viewerCount', l2);
    emitter.emit('viewerCount', 42);

    expect(l1).toHaveBeenCalledWith(42);
    expect(l2).toHaveBeenCalledWith(42);
  });

  it('should stop calling listeners after off() is called', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('statusChange', listener);
    emitter.emit('statusChange', 'starting');
    expect(listener).toHaveBeenCalledTimes(1);

    emitter.off('statusChange', listener);
    emitter.emit('statusChange', 'live');
    expect(listener).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should remove all listeners with removeAllListeners()', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const l1 = vi.fn();
    const l2 = vi.fn();

    emitter.on('statusChange', l1);
    emitter.on('viewerCount', l2);

    emitter.removeAllListeners();
    emitter.emit('statusChange', 'live');
    emitter.emit('viewerCount', 10);

    expect(l1).not.toHaveBeenCalled();
    expect(l2).not.toHaveBeenCalled();
  });

  it('should trigger once() listener exactly once and auto-unsubscribe', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.once('statusChange', listener);

    emitter.emit('statusChange', 'live');
    emitter.emit('statusChange', 'idle');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('live');
  });

  it('should support unsubscribing via the returned unsubscribe closure', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();
    const unsubscribe = emitter.on('statusChange', listener);

    emitter.emit('statusChange', 'connecting');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.emit('statusChange', 'live');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
