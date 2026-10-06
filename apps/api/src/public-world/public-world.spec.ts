import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { PublicWorldRepository } from './public-world.repository';
import { PublicWorldService } from './public-world.service';

const TOKEN = 'reader-token';

function repository(overrides: Partial<Record<keyof PublicWorldRepository, jest.Mock>> = {}) {
  return {
    entry: jest.fn(async () => [{ verdict: 'ALLOW' }]),
    readDisplay: jest.fn(async () => [{ label_mode: 'PSEUDONYM', display_label: 'nightlamp27', real_name_available: true }]),
    setDisplayMode: jest.fn(async (_token: string, mode: string) => [{ outcome: 'UPDATED', label_mode: mode, display_label: mode === 'REAL_NAME' ? 'Amal' : 'nightlamp27' }]),
    ...overrides,
  };
}
const service = (repo = repository()) => new PublicWorldService(repo as unknown as PublicWorldRepository);

describe('S5-01 Public World entry verdict', () => {
  it('admits only an exact ALLOW, on the caller token alone', async () => {
    const repo = repository();
    await expect(service(repo).entry(TOKEN)).resolves.toEqual({ outcome: 'ALLOW' });
    expect(repo.entry).toHaveBeenCalledWith(TOKEN);
  });

  it('answers every other database verdict with one neutral UNAVAILABLE', async () => {
    for (const rows of [[{ verdict: 'UNAVAILABLE' }], [], [{ verdict: 'allow' }], [{ verdict: 'ALLOW_EXPERIENCES' }]]) {
      const repo = repository({ entry: jest.fn(async () => rows) });
      await expect(service(repo).entry(TOKEN)).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    }
  });

  it('turns a transport failure into 503, never into ALLOW', async () => {
    const repo = repository({ entry: jest.fn(async () => { throw new Error('down'); }) });
    await expect(service(repo).entry(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-01 Public display choice', () => {
  it('reads the mode and its derived label, and nothing else', async () => {
    await expect(service().display(TOKEN)).resolves.toEqual({ mode: 'PSEUDONYM', label: 'nightlamp27', realNameAvailable: true });
  });

  it('sends a MODE only — never label text, a user or a ref', async () => {
    const repo = repository();
    await expect(service(repo).setDisplay(TOKEN, { mode: 'REAL_NAME' })).resolves.toEqual({ outcome: 'UPDATED', mode: 'REAL_NAME', label: 'Amal' });
    expect(repo.setDisplayMode).toHaveBeenCalledWith(TOKEN, 'REAL_NAME');
    for (const body of [{ mode: 'REAL_NAME', label: 'Someone Else' }, { mode: 'Lamplighter' }, { label: 'x' }, { mode: 'REAL_NAME', userId: 'u' },
      { mode: 'PSEUDONYM', publicIdentityRef: 'r' }, null, [], 'PSEUDONYM']) {
      expect(() => service(repo).setDisplay(TOKEN, body)).toThrow(BadRequestException);
    }
    expect(repo.setDisplayMode).toHaveBeenCalledTimes(1);
  });

  it('passes UNAVAILABLE through and refuses a malformed answer', async () => {
    const unavailable = repository({ setDisplayMode: jest.fn(async () => [{ outcome: 'UNAVAILABLE', label_mode: 'PSEUDONYM', display_label: 'nightlamp27' }]) });
    await expect(service(unavailable).setDisplay(TOKEN, { mode: 'REAL_NAME' })).resolves.toEqual({ outcome: 'UNAVAILABLE', mode: 'PSEUDONYM', label: 'nightlamp27' });
    const malformed = repository({ readDisplay: jest.fn(async () => [{ label_mode: 'ALIAS', display_label: 'x', real_name_available: true }]) });
    await expect(service(malformed).display(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-01 routes', () => {
  it('are classified as ordinary authenticated own-state routes', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/entry']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/display']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['PUT /public/display']).toBe('AUTHENTICATED');
  });
});
