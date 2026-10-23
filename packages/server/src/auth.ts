import { ParticipantRole } from './core/index.js';

export interface AuthContext {
  token?: string;
  streamKey?: string;
  streamId: string;
  role: ParticipantRole;
  clientIp?: string;
}

export interface AuthResult {
  valid: boolean;
  userId?: string;
  userName?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type AuthHook = (ctx: AuthContext) => Promise<boolean | AuthResult> | boolean | AuthResult;

export class AuthGuard {
  private hook?: AuthHook;
  private validStreamKeys: Set<string> = new Set();

  constructor(options?: { authHook?: AuthHook; defaultStreamKeys?: string[] }) {
    this.hook = options?.authHook;
    if (options?.defaultStreamKeys) {
      options.defaultStreamKeys.forEach((k) => this.validStreamKeys.add(k));
    }
  }

  public registerStreamKey(key: string): void {
    this.validStreamKeys.add(key);
  }

  public revokeStreamKey(key: string): void {
    this.validStreamKeys.delete(key);
  }

  public async authenticate(ctx: AuthContext): Promise<AuthResult> {
    // If a custom auth hook is provided, use it
    if (this.hook) {
      const res = await this.hook(ctx);
      if (typeof res === 'boolean') {
        return res
          ? { valid: true, userId: `user_${Date.now()}` }
          : { valid: false, error: 'Unauthorized by auth hook' };
      }
      return res;
    }

    // Default stream key validation for broadcasters if keys are defined
    if (ctx.role === 'broadcaster' && this.validStreamKeys.size > 0) {
      if (!ctx.streamKey || !this.validStreamKeys.has(ctx.streamKey)) {
        return { valid: false, error: 'Invalid or missing stream key' };
      }
    }

    // Default permissive for viewers or if no keys registered
    return {
      valid: true,
      userId: `participant_${Math.random().toString(36).substring(2, 9)}`,
      userName: ctx.role === 'broadcaster' ? 'Host' : 'Viewer',
    };
  }
}
