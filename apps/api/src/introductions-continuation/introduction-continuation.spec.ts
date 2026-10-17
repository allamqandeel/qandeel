import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { IntroductionContinuationRepository } from './introduction-continuation.repository';
import { COMPLETION_ATTEMPT_DELAYS_MS, IntroductionContinuationService } from './introduction-continuation.service';

const W = '0b9b2a52-6a5c-4c3e-9d4a-1f2e3d4c5b6a';
const C = '1c8c3b63-7b6d-4d4f-8e5b-2a3f4e5d6c7b';
const V = '2d7d4c74-8c7e-4e5a-9f6c-3b4a5f6e7d8c';
const E = '3e6e5d85-9d8f-4f6b-8a7d-4c5b6a7f8e9d';
const TOKEN = 'user-token';

function repo(over: Record<string, jest.Mock> = {}): IntroductionContinuationRepository & Record<string, jest.Mock> {
  return {
    readSuccess: jest.fn(), approve: jest.fn(), withdraw: jest.fn(), complete: jest.fn().mockResolvedValue([{ outcome: 'PENDING' }]),
    readParticipation: jest.fn(), reactivate: jest.fn(), ...over,
  } as unknown as IntroductionContinuationRepository & Record<string, jest.Mock>;
}
function service(r: IntroductionContinuationRepository, log: string[] = []): IntroductionContinuationService {
  const s = new IntroductionContinuationService(r);
  s.delay = async (ms) => { log.push(`wait:${ms}`); };
  return s;
}

describe('S6-06 SUCCESS: two humans decide, the system executes (condition 3)', () => {
  it('the completion runs only AFTER the approval has answered, in its own calls, at the fixed delays', async () => {
    const order: string[] = [];
    const r = repo({
      approve: jest.fn().mockImplementation(async () => { order.push('approve'); return [{ outcome: 'APPROVED', approval_event_id: E }]; }),
      complete: jest.fn().mockImplementation(async () => { order.push('complete'); return [{ outcome: 'PENDING' }]; }),
    });
    expect(await service(r, order).approve(TOKEN, W, { commandId: C, versionId: V, expectedEventId: null })).toEqual({ outcome: 'APPROVED', eventId: E });
    expect(order).toEqual(['approve', 'complete', `wait:${COMPLETION_ATTEMPT_DELAYS_MS[1]}`, 'complete', `wait:${COMPLETION_ATTEMPT_DELAYS_MS[2]}`, 'complete']);
    expect(r.approve).toHaveBeenCalledWith(TOKEN, C, W, V, null);
  });

  it('answers COMPLETED as soon as one attempt completes, and stops trying', async () => {
    const r = repo({
      approve: jest.fn().mockResolvedValue([{ outcome: 'APPROVED', approval_event_id: E }]),
      complete: jest.fn().mockResolvedValueOnce([{ outcome: 'PENDING' }]).mockResolvedValueOnce([{ outcome: 'COMPLETED' }]),
    });
    expect(await service(r).approve(TOKEN, W, { commandId: C, versionId: V })).toEqual({ outcome: 'COMPLETED' });
    expect(r.complete).toHaveBeenCalledTimes(2);
  });

  it('a failed attempt never undoes or changes the approval answer; a transport failure is just PENDING', async () => {
    const r = repo({
      approve: jest.fn().mockResolvedValue([{ outcome: 'APPROVED', approval_event_id: E }]),
      complete: jest.fn().mockRejectedValue(new DataApiError(503)),
    });
    expect(await service(r).approve(TOKEN, W, { commandId: C, versionId: V })).toEqual({ outcome: 'APPROVED', eventId: E });
    expect(r.complete).toHaveBeenCalledTimes(COMPLETION_ATTEMPT_DELAYS_MS.length);
  });

  it.each(['CHANGED', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT', 'UNAVAILABLE'])('no completion after %s', async (outcome) => {
    const r = repo({ approve: jest.fn().mockResolvedValue([{ outcome, approval_event_id: null }]) });
    expect(await service(r).approve(TOKEN, W, { commandId: C, versionId: V })).toEqual({ outcome });
    expect(r.complete).not.toHaveBeenCalled();
  });

  it('every read by an approving human tries the completion again - the gates may allow it now', async () => {
    const approving = repo({
      readSuccess: jest.fn().mockResolvedValue([{ introduction_state: 'ACTIVE', transition_version_id: V, my_approval_state: 'APPROVED', my_current_event_id: E }]),
      complete: jest.fn().mockResolvedValue([{ outcome: 'COMPLETED' }]),
    });
    expect(await service(approving).readSuccess(TOKEN, W)).toEqual({ outcome: 'COMPLETED' });
    const notYet = repo({
      readSuccess: jest.fn().mockResolvedValue([{ introduction_state: 'ACTIVE', transition_version_id: V, my_approval_state: 'NONE', my_current_event_id: null }]),
    });
    expect(await service(notYet).readSuccess(TOKEN, W)).toEqual({ outcome: 'TRANSITION', versionId: V, myState: 'NONE', expectedEventId: null });
    expect(notYet.complete).not.toHaveBeenCalled();
  });

  it('production: no transition, nothing attempted', async () => {
    const r = repo({ readSuccess: jest.fn().mockResolvedValue([{ introduction_state: 'ACTIVE', transition_version_id: null, my_approval_state: null, my_current_event_id: null }]) });
    expect(await service(r).readSuccess(TOKEN, W)).toEqual({ outcome: 'NO_TRANSITION' });
    expect(r.complete).not.toHaveBeenCalled();
  });

  it('withdraw needs the exact current token and is never followed by a completion', async () => {
    const r = repo({ withdraw: jest.fn().mockResolvedValue([{ outcome: 'WITHDRAWN', approval_event_id: E }]) });
    expect(await service(r).withdraw(TOKEN, W, { commandId: C, versionId: V, expectedEventId: E })).toEqual({ outcome: 'WITHDRAWN', eventId: E });
    await expect(service(r).withdraw(TOKEN, W, { commandId: C, versionId: V })).rejects.toBeInstanceOf(BadRequestException);
    expect(r.complete).not.toHaveBeenCalled();
  });

  it('refuses any human identity in the body', async () => {
    await expect(service(repo()).approve(TOKEN, W, { commandId: C, versionId: V, approverUserId: W })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('S6-06 reactivation', () => {
  it('reads only the reader\'s own participation, three fields', async () => {
    const r = repo({ readParticipation: jest.fn().mockResolvedValue([{
      participation_state: 'PAUSED', pause_reason: 'POST_INTRODUCTION', participation_event_id: E, matching_context_grant_id: C,
      introduction_profile_version_id: V, matching_requirement_version_id: V, pre_match_disclosure_authority_id: null,
      bound_profile_version_id: null, approved_field_count: 3,
    }]) });
    expect(await service(r).readParticipation(TOKEN)).toEqual({ outcome: 'READY', state: 'PAUSED', pauseReason: 'POST_INTRODUCTION', expectedEventId: E });
  });

  it('passes one explicit act and maps the bounded answers', async () => {
    const r = repo({ reactivate: jest.fn().mockResolvedValue([{ outcome: 'REACTIVATED', participation_state: 'ACTIVE' }]) });
    expect(await service(r).reactivate(TOKEN, { commandId: C, expectedEventId: E })).toEqual({ outcome: 'REACTIVATED', state: 'ACTIVE' });
    expect(r.reactivate).toHaveBeenCalledWith(TOKEN, C, E, null);
    for (const outcome of ['NOT_AVAILABLE_NOW', 'NOT_ELIGIBLE', 'CHANGED']) {
      const x = repo({ reactivate: jest.fn().mockResolvedValue([{ outcome, participation_state: null }]) });
      expect(await service(x).reactivate(TOKEN, { commandId: C, expectedEventId: E, entryChannel: 'MANUAL_MY_WORLD_ENTRY' })).toEqual({ outcome });
    }
    await expect(service(r).reactivate(TOKEN, { commandId: C, expectedEventId: E, entryChannel: 'ANYWHERE' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('S6-06 isolation of the continuation module', () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  const code = (f: string) => readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

  it('has no service_role channel, no preparation, no AI and no logging', () => {
    for (const f of files) {
      expect(code(f)).not.toMatch(/ServiceRole|service_role|server_|prepare_introduction_success/u);
      expect(code(f)).not.toMatch(/model-router|anthropic|openai|activity|PushModule|console\.|Logger|Sentry/iu);
    }
  });

  it('the controller takes no human identity and no query', () => {
    const controller = code('introduction-continuation.controller.ts');
    expect(controller).not.toMatch(/@Query|userId|approver|counterpart|recipient/iu);
    expect(controller).toMatch(/@UseGuards\(SupabaseAuthGuard\)/u);
  });
});
