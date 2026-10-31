// S8B-03 (CP1, §8.1 API, F / A11 / A24): the owner's voice consent and Voice Note acts. The database decides consent, the
// gate, ownership and the withdraw / commit race (FOR SHARE, proven by verify-migration-0186); this service maps its
// answers and never serves a consent text other than the approved one.
import { HttpException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { VoiceNotesService } from './voice-notes.service';
import type { VoiceNotesRepository } from './voice-notes.repository';
import { consentText, VOICE_CONSENT_ROWS } from './voice-consent-text';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const NOTE = 'eeeeeeee-0000-4000-8000-000000000001';
const SESSION = '5e55a000-0000-4000-8000-000000000001';
const TURN = 'cccccccc-0000-4000-8000-000000000001';
const COMMAND = 'dddddddd-0000-4000-8000-000000000001';

function setup(overrides: Partial<Record<keyof VoiceNotesRepository, jest.Mock>> = {}, rpc = jest.fn()) {
  const notes = {
    consentText: jest.fn().mockResolvedValue({ consent_version: 'VOICE_RECORDING_V1', text_ar: consentText('ar'), text_en: consentText('en') }),
    commitTurn: jest.fn(), status: jest.fn(), retry: jest.fn(), pending: jest.fn(), capability: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<VoiceNotesRepository>;
  const runner = { run: jest.fn().mockResolvedValue({ userTurn: { id: TURN }, assistantTurn: { id: 'reply' } }) };
  const moduleRef = { get: jest.fn().mockReturnValue(runner) } as unknown as ModuleRef;
  const serverApi = { rpc } as unknown as SupabaseServiceRoleApiService;
  return { notes, runner, rpc, service: new VoiceNotesService(notes, serverApi, moduleRef) };
}

const statusOf = async (promise: Promise<unknown>) => promise.then(() => 200, (error: unknown) => (error instanceof HttpException ? error.getStatus() : 500));

describe('VoiceNotesService (S8B-03 CP1)', () => {
  it('serves the approved consent rows when the installed text is exactly the approved one', async () => {
    const { service } = setup({}, jest.fn().mockResolvedValue([{ consent_state: 'NONE', consent_version: null }]));
    await expect(service.consent(USER)).resolves.toEqual({
      consentVersion: 'VOICE_RECORDING_V1', consentState: 'NONE', grantedVersion: null,
      rows: VOICE_CONSENT_ROWS.map(({ id, ar, en }) => ({ id, ar, en })),
    });
  });

  it('serves no consent text at all (503) when the installed text drifted', async () => {
    const drifted = jest.fn().mockResolvedValue({ consent_version: 'VOICE_RECORDING_V1', text_ar: `${consentText('ar')} `, text_en: consentText('en') });
    const { service } = setup({ consentText: drifted }, jest.fn().mockResolvedValue([{ consent_state: 'NONE', consent_version: null }]));
    await expect(statusOf(service.consent(USER))).resolves.toBe(503);
  });

  it('grant and withdraw pass the verified human and the command only', async () => {
    const rpc = jest.fn().mockResolvedValueOnce([{ outcome: 'GRANTED' }]).mockResolvedValueOnce([{ outcome: 'WITHDRAWN' }]);
    const { service } = setup({}, rpc);
    await expect(service.grant(USER, { commandId: COMMAND, version: 'VOICE_RECORDING_V1' })).resolves.toEqual({ outcome: 'GRANTED' });
    await expect(service.withdraw(USER, { commandId: COMMAND })).resolves.toEqual({ outcome: 'WITHDRAWN' });
    expect(rpc.mock.calls).toEqual([
      ['server_grant_voice_recording_consent_v1', { p_user_id: USER, p_command_id: COMMAND, p_consent_version: 'VOICE_RECORDING_V1' }],
      ['server_revoke_voice_recording_consent_v1', { p_user_id: USER, p_command_id: COMMAND }],
    ]);
  });

  it('refuses an extra field, a bad command id or a missing version before any call', async () => {
    const { service, rpc } = setup();
    for (const body of [{ commandId: COMMAND, version: 'V', userId: USER }, { commandId: 'x', version: 'V' }, { commandId: COMMAND }]) {
      await expect(statusOf(service.grant(USER, body))).resolves.toBe(400);
    }
    await expect(statusOf(service.withdraw(USER, { commandId: COMMAND, version: 'V' }))).resolves.toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a committed note runs its one turn through the Orchestrator runner; a replay answers the same turn', async () => {
    for (const outcome of ['COMMITTED', 'ALREADY_COMMITTED']) {
      const { service, runner } = setup({ commitTurn: jest.fn().mockResolvedValue({ outcome, turn_id: TURN, session_id: SESSION }) });
      await service.commitTurn(USER, 'token', NOTE);
      expect(runner.run).toHaveBeenCalledWith(USER, 'token', SESSION, TURN);
    }
  });

  it.each([
    ['ADMISSION_LIMITED', 429], ['CONSENT_REQUIRED', 403], ['NOT_AVAILABLE_NOW', 503],
    ['NOT_READY', 409], ['SESSION_NOT_ACTIVE', 409], ['COMMAND_CONFLICT', 409], ['NOT_FOUND', 404],
  ])('a commit answered %s is %s and runs no turn (a withdrawal that won the race is CONSENT_REQUIRED)', async (outcome, status) => {
    const { service, runner } = setup({ commitTurn: jest.fn().mockResolvedValue({ outcome, turn_id: null, session_id: null }) });
    await expect(statusOf(service.commitTurn(USER, 'token', NOTE))).resolves.toBe(status);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('a malformed note id is 404 before any call', async () => {
    const { service, notes } = setup();
    await expect(statusOf(service.commitTurn(USER, 'token', 'nope'))).resolves.toBe(404);
    await expect(statusOf(service.status(USER, '../x'))).resolves.toBe(404);
    expect(notes.commitTurn).not.toHaveBeenCalled();
    expect(notes.status).not.toHaveBeenCalled();
  });

  it('a status never carries the transcript, band or attempt detail', async () => {
    const { service } = setup({ status: jest.fn().mockResolvedValue({
      session_id: SESSION, state: 'DELETION_PENDING', failure_class: null, can_retry: false, committed_turn_id: null,
      recording_available: true, accepted_at: '2026-10-31T10:00:00Z', available_until: '2026-11-30T10:00:00Z', duration_ms: '4200',
      transcript: 'secret', asr_confidence_band: 'HIGH',
    }) });
    const status = await service.status(USER, NOTE);
    expect(status).toEqual({
      recordingId: NOTE, sessionId: SESSION, status: 'PROCESSING', failure: null, canRetry: false, turnId: null, recordingAvailable: true,
      acceptedAt: '2026-10-31T10:00:00.000Z', availableUntil: '2026-11-30T10:00:00.000Z', durationMs: 4200,
    });
    expect(JSON.stringify(status)).not.toMatch(/secret|HIGH/u);
  });
});
