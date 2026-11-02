// S8B-03 (CP1, §8.1 API, F / A11 / A24): the owner's voice consent and Voice Note acts. The database decides consent, the
// gate, ownership and the withdraw / commit race (FOR SHARE, proven by verify-migration-0186); this service maps its
// answers and never serves a consent text other than the approved one.
import { HttpException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { VoiceNotesService } from './voice-notes.service';
import type { VoiceNotesRepository } from './voice-notes.repository';
import {
  consentText, VOICE_CONSENT_ROWS, VOICE_CONSENT_V1_ROWS, VOICE_CONSENT_V1_VERSION, VOICE_CONSENT_V2_ROWS, VOICE_CONSENT_V2_VERSION,
} from './voice-consent-text';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const NOTE = 'eeeeeeee-0000-4000-8000-000000000001';
const SESSION = '5e55a000-0000-4000-8000-000000000001';
const TURN = 'cccccccc-0000-4000-8000-000000000001';
const COMMAND = 'dddddddd-0000-4000-8000-000000000001';

function setup(overrides: Partial<Record<keyof VoiceNotesRepository, jest.Mock>> = {}, rpc = jest.fn()) {
  const notes = {
    consentText: jest.fn().mockResolvedValue({ consent_version: 'VOICE_RECORDING_V3', text_ar: consentText('ar'), text_en: consentText('en') }),
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
      consentVersion: 'VOICE_RECORDING_V3', consentState: 'NONE', grantedVersion: null,
      rows: VOICE_CONSENT_ROWS.map(({ id, ar, en }) => ({ id, ar, en })),
    });
  });

  // S8B-04 (CP2, migration 0188): the current version is VOICE_RECORDING_V3 (K-01 … K-15); V1 and V2 are history. A
  // database still answering an earlier version as current is a version the API does not serve.
  it('serves no consent text (503) when the installed current version is V2, even word for word', async () => {
    const v2Text = { consent_version: VOICE_CONSENT_V2_VERSION, text_ar: VOICE_CONSENT_V2_ROWS.map((r) => r.ar).join('\n'), text_en: VOICE_CONSENT_V2_ROWS.map((r) => r.en).join('\n') };
    const { service } = setup({ consentText: jest.fn().mockResolvedValue(v2Text) }, jest.fn().mockResolvedValue([{ consent_state: 'NONE', consent_version: null }]));
    await expect(statusOf(service.consent(USER))).resolves.toBe(503);
    // V3 is V2 with exactly K-07, K-08 and K-13 replaced.
    expect(VOICE_CONSENT_ROWS.filter((row, i) => row !== VOICE_CONSENT_V2_ROWS[i]).map((r) => r.id)).toEqual(['K-07', 'K-08', 'K-13']);
  });

  it('serves no consent text (503) when the installed current version is not V3, even V1 word for word', async () => {
    const v1Text = { consent_version: VOICE_CONSENT_V1_VERSION, text_ar: VOICE_CONSENT_V1_ROWS.map((r) => r.ar).join('\n'), text_en: VOICE_CONSENT_V1_ROWS.map((r) => r.en).join('\n') };
    const { service } = setup({ consentText: jest.fn().mockResolvedValue(v1Text) }, jest.fn().mockResolvedValue([{ consent_state: 'NONE', consent_version: null }]));
    await expect(statusOf(service.consent(USER))).resolves.toBe(503);
    expect(VOICE_CONSENT_ROWS.map((r) => r.id)).toEqual(Array.from({ length: 15 }, (_, i) => `K-${String(i + 1).padStart(2, '0')}`));
  });

  it('serves no consent text at all (503) when the installed text drifted', async () => {
    const drifted = jest.fn().mockResolvedValue({ consent_version: 'VOICE_RECORDING_V3', text_ar: `${consentText('ar')} `, text_en: consentText('en') });
    const { service } = setup({ consentText: drifted }, jest.fn().mockResolvedValue([{ consent_state: 'NONE', consent_version: null }]));
    await expect(statusOf(service.consent(USER))).resolves.toBe(503);
  });

  it('grant and withdraw pass the verified human and the command only', async () => {
    const rpc = jest.fn().mockResolvedValueOnce([{ outcome: 'GRANTED' }]).mockResolvedValueOnce([{ outcome: 'WITHDRAWN' }]);
    const { service } = setup({}, rpc);
    await expect(service.grant(USER, { commandId: COMMAND, version: 'VOICE_RECORDING_V3' })).resolves.toEqual({ outcome: 'GRANTED' });
    await expect(service.withdraw(USER, { commandId: COMMAND })).resolves.toEqual({ outcome: 'WITHDRAWN' });
    expect(rpc.mock.calls).toEqual([
      ['server_grant_voice_recording_consent_v1', { p_user_id: USER, p_command_id: COMMAND, p_consent_version: 'VOICE_RECORDING_V3' }],
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

// S8B-04 (CP2): the automatic voice reply. Only the request that COMMITTED the turn opens its reply (one per turn); the
// turn runs through the SAME runner with the reply as its sink, in the background, and its answer is attached to the reply.
describe('VoiceNotesService — the automatic voice reply (S8B-04 CP2)', () => {
  const REPLY = 'ffffffff-0000-4000-8000-000000000001';
  function withPath(open: jest.Mock = jest.fn().mockResolvedValue({ replyId: REPLY, signal: new AbortController().signal, release: jest.fn(), end: jest.fn() })) {
    const h = setup({ commitTurn: jest.fn().mockResolvedValue({ outcome: 'COMMITTED', turn_id: TURN, session_id: SESSION }) });
    const path = { openReply: open, attachExchange: jest.fn(), finishLiveNote: jest.fn(), discardLiveNote: jest.fn() };
    (h.service as unknown as { moduleRef: { get: jest.Mock } }).moduleRef.get.mockImplementation((token: symbol) =>
      (String(token).includes('FAST_VOICE_PATH') ? path : h.runner));
    return { ...h, path };
  }

  it('answers REPLYING at once and runs the turn with the reply as its sink; the answer is attached when done', async () => {
    const { service, runner, path } = withPath();
    await expect(service.commitTurn(USER, 'token', NOTE, true)).resolves.toEqual({ outcome: 'REPLYING', turnId: TURN, replyId: REPLY });
    expect(path.openReply).toHaveBeenCalledWith(USER, SESSION, TURN);
    expect(runner.run).toHaveBeenCalledWith(USER, 'token', SESSION, TURN, { liveReply: expect.objectContaining({ replyId: REPLY }) });
    await new Promise((resolve) => setImmediate(resolve));
    expect(path.attachExchange).toHaveBeenCalledWith(USER, REPLY, { userTurn: { id: TURN }, assistantTurn: { id: 'reply' } });
  });

  it('a replay (ALREADY_COMMITTED) never opens a second reply: the turn is answered exactly as before', async () => {
    const { service, notes, runner, path } = withPath();
    notes.commitTurn.mockResolvedValue({ outcome: 'ALREADY_COMMITTED', turn_id: TURN, session_id: SESSION });
    await expect(service.commitTurn(USER, 'token', NOTE, true)).resolves.toEqual({ userTurn: { id: TURN }, assistantTurn: { id: 'reply' } });
    expect(path.openReply).not.toHaveBeenCalled();
    expect(runner.run).toHaveBeenCalledWith(USER, 'token', SESSION, TURN);
  });

  it('no reply could be opened (no synthesis route, refused): text only, exactly as before', async () => {
    const { service, runner } = withPath(jest.fn().mockResolvedValue(undefined));
    await expect(service.commitTurn(USER, 'token', NOTE, true)).resolves.toEqual({ userTurn: { id: TURN }, assistantTurn: { id: 'reply' } });
    expect(runner.run).toHaveBeenCalledWith(USER, 'token', SESSION, TURN);
  });

  it('a turn that fails before the orchestrator ends the reply FAILED and attaches no answer', async () => {
    const sink = { replyId: REPLY, signal: new AbortController().signal, release: jest.fn(), end: jest.fn() };
    const { service, runner, path } = withPath(jest.fn().mockResolvedValue(sink));
    runner.run.mockRejectedValueOnce(new Error('lease'));
    await service.commitTurn(USER, 'token', NOTE, true);
    await new Promise((resolve) => setImmediate(resolve));
    expect(sink.end).toHaveBeenCalledWith({ kind: 'FAILED' });
    expect(path.attachExchange).toHaveBeenCalledWith(USER, REPLY, null);
  });

  it('without auto the commit is exactly S8B-03\'s', async () => {
    const { service, runner, path } = withPath();
    await service.commitTurn(USER, 'token', NOTE);
    expect(path.openReply).not.toHaveBeenCalled();
    expect(runner.run).toHaveBeenCalledWith(USER, 'token', SESSION, TURN);
  });
});
