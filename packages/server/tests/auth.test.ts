import { describe, it, expect } from 'vitest';
import { AuthGuard } from '../src/auth.js';

describe('AuthGuard & Access Control Edge Cases', () => {
  it('should allow viewers and broadcasters by default when no secret or hook is set', async () => {
    const guard = new AuthGuard();

    const viewerResult = await guard.authenticate({
      streamId: 'public-stage',
      role: 'viewer',
    });
    expect(viewerResult.valid).toBe(true);

    const hostResult = await guard.authenticate({
      streamId: 'public-stage',
      role: 'broadcaster',
    });
    expect(hostResult.valid).toBe(true);
  });

  it('should validate broadcaster streamKey and reject incorrect keys', async () => {
    const guard = new AuthGuard({ defaultStreamKeys: ['secure-key-123'] });

    // Valid key
    const success = await guard.authenticate({
      streamId: 'stage-1',
      role: 'broadcaster',
      streamKey: 'secure-key-123',
    });
    expect(success.valid).toBe(true);

    // Invalid key
    const failure = await guard.authenticate({
      streamId: 'stage-1',
      role: 'broadcaster',
      streamKey: 'wrong-key',
    });
    expect(failure.valid).toBe(false);
    expect(failure.error).toContain('Invalid or missing stream key');

    // Missing key
    const missing = await guard.authenticate({
      streamId: 'stage-1',
      role: 'broadcaster',
    });
    expect(missing.valid).toBe(false);
  });

  it('should execute custom asynchronous auth hook and handle rejections', async () => {
    const guard = new AuthGuard({
      authHook: async ({ streamId, role, token }) => {
        if (role === 'broadcaster' && token === 'admin-jwt') {
          return { valid: true, userId: 'admin_1', userName: 'Admin Host' };
        }
        if (role === 'viewer' && streamId.startsWith('premium-') && !token) {
          return { valid: false, error: 'Subscription token required' };
        }
        return { valid: true };
      },
    });

    // Broadcaster with valid JWT
    const host = await guard.authenticate({
      streamId: 'news-live',
      role: 'broadcaster',
      token: 'admin-jwt',
    });
    expect(host.valid).toBe(true);
    expect(host.userName).toBe('Admin Host');

    // Premium room viewer without token
    const blockedViewer = await guard.authenticate({
      streamId: 'premium-concert',
      role: 'viewer',
    });
    expect(blockedViewer.valid).toBe(false);
    expect(blockedViewer.error).toBe('Subscription token required');

    // Normal room viewer
    const freeViewer = await guard.authenticate({
      streamId: 'free-talk',
      role: 'viewer',
    });
    expect(freeViewer.valid).toBe(true);
  });

  it('should gracefully catch exceptions inside custom authHook without crashing', async () => {
    const guard = new AuthGuard({
      authHook: async () => {
        throw new Error('Database connection failed');
      },
    });

    const result = await guard.authenticate({
      streamId: 'test-room',
      role: 'broadcaster',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Internal authentication error: Database connection failed');
  });

  it('should support dynamic registration and revocation of stream keys at runtime', async () => {
    const guard = new AuthGuard();
    // Initially permissive since no keys are registered
    const initial = await guard.authenticate({ streamId: 'room-1', role: 'broadcaster' });
    expect(initial.valid).toBe(true);

    // Register a dynamic key
    guard.registerStreamKey('ephemeral-key-999');

    // Without key -> now rejected
    const withoutKey = await guard.authenticate({ streamId: 'room-1', role: 'broadcaster' });
    expect(withoutKey.valid).toBe(false);

    // With key -> accepted
    const withKey = await guard.authenticate({
      streamId: 'room-1',
      role: 'broadcaster',
      streamKey: 'ephemeral-key-999',
    });
    expect(withKey.valid).toBe(true);

    // Revoke key -> rejected
    guard.revokeStreamKey('ephemeral-key-999');
    // Now no keys left -> becomes permissive or empty
    const afterRevoke = await guard.authenticate({
      streamId: 'room-1',
      role: 'broadcaster',
      streamKey: 'ephemeral-key-999',
    });
    expect(afterRevoke.valid).toBe(true);
  });
});
