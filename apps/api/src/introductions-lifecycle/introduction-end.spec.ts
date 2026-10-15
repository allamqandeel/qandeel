import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, type SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionEndRepository } from './introduction-end.repository';
import { IntroductionEndService } from './introduction-end.service';

// S6-02 — the API boundary of the Introduction's unilateral END (GATE-34, D1): the exact request shape, the three
// neutral outcomes and nothing else, no gate, no retry, no account or counterpart on the wire, nothing logged.

const COMMAND = '11111111-1111-4111-8111-111111111111';
const WORLD = '22222222-2222-4222-8222-222222222222';

describe('S6-02 — IntroductionEndService', () => {
  let end: jest.Mock;
  let service: IntroductionEndService;

  beforeEach(() => {
    end = jest.fn().mockResolvedValue([{ outcome: 'ENDED' }]);
    service = new IntroductionEndService({ end } as unknown as IntroductionEndRepository);
  });

  it('ends with exactly the command and the World, once', async () => {
    await expect(service.end('token', WORLD, { commandId: COMMAND })).resolves.toEqual({ outcome: 'ENDED' });
    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith('token', COMMAND, WORLD);
  });

  it.each(['ENDED', 'ALREADY_SETTLED', 'UNAVAILABLE'])('passes the neutral %s outcome through unchanged', async (outcome) => {
    end.mockResolvedValue([{ outcome }]);
    await expect(service.end('token', WORLD, { commandId: COMMAND })).resolves.toEqual({ outcome });
  });

  it.each([
    ['no body', undefined], ['an array', [COMMAND]], ['no command', {}], ['a malformed command', { commandId: 'x' }],
    ['a counterpart', { commandId: COMMAND, counterpartId: WORLD }], ['an actor', { commandId: COMMAND, userId: WORLD }],
    ['participation events', { commandId: COMMAND, lowerParticipationEventId: WORLD }],
  ])('refuses %s as an invalid request before any database call', async (_label, body) => {
    await expect(service.end('token', WORLD, body)).rejects.toBeInstanceOf(BadRequestException);
    expect(end).not.toHaveBeenCalled();
  });

  it('a World that is not an identifier is UNAVAILABLE without a database call', async () => {
    await expect(service.end('token', 'not-a-world', { commandId: COMMAND })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    expect(end).not.toHaveBeenCalled();
  });

  it('an unknown or missing answer fails closed, never as a success', async () => {
    for (const rows of [[], [{ outcome: 'INTRODUCTION_ENDED' }], [{}], null]) {
      end.mockResolvedValue(rows);
      await expect(service.end('token', WORLD, { commandId: COMMAND })).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('a database 400 is the client\'s invalid request; any other failure is unavailable and is not retried', async () => {
    end.mockRejectedValue(new DataApiError(400));
    await expect(service.end('token', WORLD, { commandId: COMMAND })).rejects.toBeInstanceOf(BadRequestException);
    for (const status of [401, 403, 404, 409, 500, 503]) {
      end.mockReset().mockRejectedValue(new DataApiError(status));
      await expect(service.end('token', WORLD, { commandId: COMMAND })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(end).toHaveBeenCalledTimes(1);
    }
  });
});

describe('S6-02 — IntroductionEndRepository', () => {
  it('calls only end_own_introduction_v1, with the caller token and exactly p_command_id and p_world_id', async () => {
    const request = jest.fn().mockResolvedValue([{ outcome: 'ENDED' }]);
    const repository = new IntroductionEndRepository({ request } as unknown as SupabaseDataApiService);
    await repository.end('caller-token', COMMAND, WORLD);
    expect(request).toHaveBeenCalledWith('caller-token', 'rpc/end_own_introduction_v1', {
      method: 'POST', body: JSON.stringify({ p_command_id: COMMAND, p_world_id: WORLD }),
    });
  });
});

describe('S6-02 — the Introduction lifecycle module is isolated', () => {
  const dir = __dirname;
  const own = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts')).sort();

  it('is exactly its four files', () => {
    expect(own).toEqual(['introduction-end.controller.ts', 'introduction-end.repository.ts', 'introduction-end.service.ts', 'introductions-lifecycle.module.ts']);
  });

  it.each(own)('%s imports only its own files, auth and the Data API transport, names no other Matching boundary and logs nothing', (name) => {
    const text = readFileSync(join(dir, name), 'utf8');
    for (const target of [...text.matchAll(/from '([^']+)'/gu)].map((m) => m[1])) {
      expect(target.startsWith('./') || ['@nestjs/common', '../auth/authenticated-request', '../auth/supabase-auth.guard',
        '../auth/supabase-auth.service', '../conversation/supabase-data-api.service'].includes(target)).toBe(true);
    }
    const code = text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    expect(code).not.toMatch(/commit_introduction_end_v1|commit_introduction_success|_matching_|launch|seam|service[-_]role|model-router|shared-world/iu);
    expect(code).not.toMatch(/console\.|Logger|captureException|Sentry|retry/iu);
  });
});
