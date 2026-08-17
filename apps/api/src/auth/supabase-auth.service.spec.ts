import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service';

describe('SupabaseAuthService', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://auth.invalid';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('fails closed when the bearer token is absent', async () => {
    await expect(new SupabaseAuthService().authenticate(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('derives the canonical UUID from the verified Auth response', async () => {
    const userId = '123e4567-e89b-42d3-a456-426614174000';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: userId }) });
    await expect(new SupabaseAuthService().authenticate('Bearer opaque-token')).resolves.toEqual({
      userId, accessToken: 'opaque-token',
    });
    const init = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(init.headers.Authorization).toBe('Bearer opaque-token');
  });

  it('does not trust malformed identities returned by Auth', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'not-a-uuid' }) });
    await expect(new SupabaseAuthService().authenticate('Bearer opaque-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('distinguishes unavailable Auth from invalid credentials', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    await expect(new SupabaseAuthService().authenticate('Bearer opaque-token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
