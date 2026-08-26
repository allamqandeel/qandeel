import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { MemoryDataApiError } from './memory-data-api.service';
import { MemoryServiceRoleApiService } from './memory-service-role-api.service';

const SENTINEL = 'SENTINEL_MEMORY_SERVICE_ROLE_KEY';

describe('MemoryServiceRoleApiService', () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  let service: MemoryServiceRoleApiService;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://database.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = SENTINEL;
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    service = new MemoryServiceRoleApiService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });

  it('calls the named RPC with service-role authority and never a caller token', async () => {
    await service.rpc('server_create_memory_v1', { p_user_id: 'user-a' });
    const [url, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://database.invalid/rest/v1/rpc/server_create_memory_v1');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe(SENTINEL);
    expect(headers.Authorization).toBe(`Bearer ${SENTINEL}`);
    expect(JSON.parse(String(init.body))).toEqual({ p_user_id: 'user-a' });
  });

  it.each([
    ['SUPABASE_SERVICE_ROLE_KEY', () => delete process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['SUPABASE_URL', () => delete process.env.SUPABASE_URL],
  ])('fails closed when %s is unconfigured instead of falling back', async (_name, unset) => {
    unset();
    await expect(service.rpc('server_create_memory_v1', {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sanitizes transport and status failures without leaking the service-role key', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error(`raw ${SENTINEL}`));
    const transport = await service.rpc('server_create_memory_v1', {}).catch((error: Error) => error);
    expect(transport).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(transport)).not.toContain(SENTINEL);
    expect(String((transport as Error).stack)).not.toContain(SENTINEL);

    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    const rejected = await service.rpc('server_create_memory_v1', {}).catch((error: Error) => error);
    expect(rejected).toBeInstanceOf(MemoryDataApiError);
    expect(JSON.stringify(rejected)).not.toContain(SENTINEL);
  });

  it('exposes no caller-token parameter and no authenticated fallback', () => {
    // Comments are stripped so the assertion is about the code, not the prose
    // that documents it.
    const source = readFileSync(join(__dirname, 'memory-service-role-api.service.ts'), 'utf8')
      .replace(/\/\/[^\n]*/gu, '');
    expect(source).not.toMatch(/accessToken|SUPABASE_PUBLISHABLE_KEY|jwt/iu);
    expect(source).not.toMatch(/console\./u);
    // rpc(name, body) only - no third credential argument.
    expect(new MemoryServiceRoleApiService().rpc).toHaveLength(2);
  });
});
