import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest, SharedWorldLifecycle, SharedWorldPhase } from '../kernel/shared-world.types';
import { SHARED_WORLD_LEGAL_STATES } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import { SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES } from './shared-effective-context.types';
import type { SharedPreModelWorldStateResolution } from './shared-effective-context.types';
import {
  NONCANONICAL_WORLD_SQLSTATE,
  SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC,
  SHARED_PRE_MODEL_WORLD_STATE_SNAPSHOT_VERSION,
  SharedPreModelWorldStateResolverService,
  fingerprintSharedPreModelWorldState,
} from './shared-pre-model-world-state-resolver.service';

const IDS = {
  world: '10000000-0000-4000-8000-00000000000a',
  otherWorld: '10000000-0000-4000-8000-00000000000b',
  mohamed: '20000000-0000-4000-8000-000000000001',
  hadir: '20000000-0000-4000-8000-000000000002',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human(IDS.mohamed);
const HADIR = human(IDS.hadir);

// A SharedWorldId exists only through a valid Shared World birth (I-01A); the
// resolver never mints one, so the fixtures obtain theirs the same way.
function bornWorldId(worldId: string): SharedWorldId {
  const request: SharedWorldBirthRequest = {
    worldId,
    phase: 'STANDARD',
    participantsAtBirth: [MOHAMED, HADIR],
    event: {
      basis: 'ACCEPTED_INVITATION',
      invitation: { prospective: 'SHARED_INVITATION', inviter: MOHAMED, target: HADIR },
      acceptance: { kind: 'INVITATION_ACCEPTANCE', acceptedBy: HADIR },
    },
  };
  const outcome = attemptSharedWorldBirth(request);
  if (!outcome.born) throw new Error(`fixture birth failed: ${outcome.rejection}`);
  return outcome.world.worldId;
}
const WORLD = bornWorldId(IDS.world);
const OTHER_WORLD = bornWorldId(IDS.otherWorld);

const row = (lifecycle = 'ACTIVE', phase = 'STANDARD', overrides: Record<string, unknown> = {}) =>
  ({ world_id: IDS.world, lifecycle, phase, ...overrides });
const respond = (payload: unknown, status = 200) =>
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => payload } as Response);
const lastCall = () => (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
const fingerprintOf = (lines: string[]) => `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
const refOf = (resolution: SharedPreModelWorldStateResolution): string => (resolution.state === 'RESOLVED' ? resolution.snapshot.snapshotRef : '');

describe('SharedPreModelWorldStateResolverService', () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  let service: SharedPreModelWorldStateResolverService;
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://database.invalid/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => [row()] } as Response);
    service = new SharedPreModelWorldStateResolverService();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });

  describe('transport (task §7, §9)', () => {
    it('POSTs exactly the World-state RPC with the exact World parameter and service-role headers only', async () => {
      await service.resolveCurrent(WORLD);
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = lastCall();
      expect(url).toBe(`https://database.invalid/rest/v1/rpc/${SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC}`);
      expect(SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC).toBe('resolve_shared_world_pre_model_state_v1');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ p_world_id: IDS.world });
      const headers = init.headers as Record<string, string>;
      expect(headers.apikey).toBe('SENTINEL_SERVICE_ROLE');
      expect(headers.Authorization).toBe('Bearer SENTINEL_SERVICE_ROLE');
      expect(init.signal).toBeInstanceOf(AbortSignal);
      // No direct table REST read, no shared_worlds endpoint, no mutation.
      expect(url).not.toMatch(/shared_worlds\b|membership|standing_context|\?select=/u);
      expect(url).toContain('/rest/v1/rpc/');
    });

    it('accepts no user JWT, client token or client-supplied lifecycle: the signature is (world) only and the body carries nothing else', async () => {
      await service.resolveCurrent(WORLD);
      const body = JSON.parse(lastCall()[1].body as string);
      for (const forbidden of ['accessToken', 'token', 'jwt', 'claims', 'p_access_token', 'p_jwt', 'Authorization', 'p_user_id', 'p_lifecycle', 'p_phase', 'p_expected_lifecycle']) expect(body).not.toHaveProperty(forbidden);
      expect(Object.keys(body)).toEqual(['p_world_id']);
      expect(service.resolveCurrent.length).toBe(1);
    });
  });

  describe('resolution mapping (task §8, §9)', () => {
    it.each(SHARED_WORLD_LEGAL_STATES.map((state) => [state.lifecycle, state.phase] as [SharedWorldLifecycle, SharedWorldPhase]))(
      'maps the canonical %s / %s row to RESOLVED with exactly that state and its fingerprint',
      async (lifecycle, phase) => {
        respond([row(lifecycle, phase)]);
        const resolution = await service.resolveCurrent(WORLD);
        expect(resolution).toEqual({
          state: 'RESOLVED',
          snapshot: { worldId: IDS.world, lifecycle, phase, snapshotRef: fingerprintOf([SHARED_PRE_MODEL_WORLD_STATE_SNAPSHOT_VERSION, `world=${IDS.world}`, `lifecycle=${lifecycle}`, `phase=${phase}`]) },
        });
        if (resolution.state !== 'RESOLVED') throw new Error('unreachable');
        expect(Object.isFrozen(resolution)).toBe(true);
        expect(Object.isFrozen(resolution.snapshot)).toBe(true);
        expect(Object.keys(resolution.snapshot).sort()).toEqual(['lifecycle', 'phase', 'snapshotRef', 'worldId']);
        // The requested (already-branded) identity passes through; nothing is re-minted.
        expect(resolution.snapshot.worldId).toBe(WORLD);
      },
    );

    it('returns READ_ONLY_CLOSED as known canonical state, never as UNRESOLVED and never as NOT_FOUND', async () => {
      respond([row('READ_ONLY_CLOSED', 'STANDARD')]);
      const closed = await service.resolveCurrent(WORLD);
      expect(closed.state).toBe('RESOLVED');
      if (closed.state !== 'RESOLVED') throw new Error('unreachable');
      expect(closed.snapshot.lifecycle).toBe('READ_ONLY_CLOSED');
      expect(JSON.stringify(closed)).not.toMatch(/NOT_FOUND|EMPTY|BLOCKED/u);
      // The resolver decides nothing about generation: a closed World resolves like any other state.
      expect(Object.keys(closed).sort()).toEqual(['snapshot', 'state']);
    });

    it('has no NOT_FOUND state: a missing canonical World is contradiction, not absence', () => {
      expect([...SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES].sort()).toEqual(['CONTRADICTORY_CANONICAL_STATE', 'LOOKUP_FAILED', 'LOOKUP_TIMED_OUT', 'WORLD_STATE_SNAPSHOT_UNAVAILABLE']);
      expect(SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES).not.toContain('NOT_FOUND');
    });
  });

  describe('snapshotRef fingerprint (task §11)', () => {
    it('is versioned SHA-256 over canonical content, deterministic across calls and independent of id case', async () => {
      respond([row()]);
      const first = await service.resolveCurrent(WORLD);
      respond([row('ACTIVE', 'STANDARD', { world_id: IDS.world.toUpperCase() })]);
      const upper = await service.resolveCurrent(WORLD);
      expect(upper).toEqual(first);
      expect(refOf(first)).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(fingerprintSharedPreModelWorldState({ worldId: IDS.world, lifecycle: 'ACTIVE', phase: 'STANDARD' }))
        .toBe(fingerprintSharedPreModelWorldState({ worldId: IDS.world.toUpperCase(), lifecycle: 'ACTIVE', phase: 'STANDARD' }));
      expect(SHARED_PRE_MODEL_WORLD_STATE_SNAPSHOT_VERSION).toBe('QANDEEL_CWV2_SHARED_PRE_MODEL_WORLD_STATE_V1');
    });

    it('changes when lifecycle changes, when phase changes and when the World changes, and never collides across the four legal states', async () => {
      const refs: string[] = [];
      for (const state of SHARED_WORLD_LEGAL_STATES) {
        respond([row(state.lifecycle, state.phase)]);
        refs.push(refOf(await service.resolveCurrent(WORLD)));
      }
      respond([row('ACTIVE', 'STANDARD', { world_id: IDS.otherWorld })]);
      refs.push(refOf(await service.resolveCurrent(OTHER_WORLD)));
      expect(refs.every((ref) => /^sha256:[0-9a-f]{64}$/u.test(ref))).toBe(true);
      expect(new Set(refs).size).toBe(5);
      // Closing a World (ACTIVE -> READ_ONLY_CLOSED) changes the reference the EffectiveContext binds.
      expect(fingerprintSharedPreModelWorldState({ worldId: IDS.world, lifecycle: 'ACTIVE', phase: 'STANDARD' }))
        .not.toBe(fingerprintSharedPreModelWorldState({ worldId: IDS.world, lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' }));
      // Completing an Introduction (INTRODUCTION -> STANDARD) changes it too.
      expect(fingerprintSharedPreModelWorldState({ worldId: IDS.world, lifecycle: 'ACTIVE', phase: 'INTRODUCTION' }))
        .not.toBe(fingerprintSharedPreModelWorldState({ worldId: IDS.world, lifecycle: 'ACTIVE', phase: 'STANDARD' }));
    });
  });

  describe('malformed / contradictory payload → UNRESOLVED / CONTRADICTORY_CANONICAL_STATE (task §9)', () => {
    const contradictory = { state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' };
    it.each([
      ['zero rows (never a legitimate state)', []],
      ['two rows', [row(), row()]],
      ['two rows for two Worlds', [row(), row('ACTIVE', 'STANDARD', { world_id: IDS.otherWorld })]],
      ['mismatched World', [row('ACTIVE', 'STANDARD', { world_id: IDS.otherWorld })]],
      ['malformed World UUID', [row('ACTIVE', 'STANDARD', { world_id: 'shared-world-a' })]],
      ['null World', [row('ACTIVE', 'STANDARD', { world_id: null })]],
      ['unknown lifecycle DORMANT', [row('DORMANT', 'STANDARD')]],
      ['unknown lifecycle ARCHIVED', [row('ARCHIVED', 'STANDARD')]],
      ['lowercase lifecycle', [row('active', 'STANDARD')]],
      ['null lifecycle', [row('ACTIVE', 'STANDARD', { lifecycle: null })]],
      ['unknown phase PUBLIC', [row('ACTIVE', 'PUBLIC')]],
      ['unknown phase REPLAY', [row('ACTIVE', 'REPLAY')]],
      ['lowercase phase', [row('ACTIVE', 'standard')]],
      ['boolean lifecycle', [row('ACTIVE', 'STANDARD', { lifecycle: true })]],
      ['extra column closed_at', [row('ACTIVE', 'STANDARD', { closed_at: null })]],
      ['extra column birth_basis', [row('ACTIVE', 'STANDARD', { birth_basis: 'ACCEPTED_INVITATION' })]],
      ['extra permission column', [row('ACTIVE', 'STANDARD', { generation_allowed: true })]],
      ['missing phase', [{ world_id: IDS.world, lifecycle: 'ACTIVE' }]],
      ['missing lifecycle', [{ world_id: IDS.world, phase: 'STANDARD' }]],
      ['non-object row', ['row']],
      ['non-array payload', row()],
      ['null payload', null],
      ['string payload', '[]'],
    ])('%s', async (_name, payload) => {
      respond(payload);
      expect(await service.resolveCurrent(WORLD)).toEqual(contradictory);
    });

    it('never partially salvages: a contradictory response yields no snapshot and no fingerprint, and zero rows never become a default state', async () => {
      respond([]);
      const resolution = await service.resolveCurrent(WORLD);
      expect(resolution).toEqual(contradictory);
      expect('snapshot' in resolution).toBe(false);
      expect(JSON.stringify(resolution)).not.toMatch(/ACTIVE|READ_ONLY_CLOSED|STANDARD|INTRODUCTION/u);
    });
  });

  describe('input validation before network (task §9)', () => {
    it('fails closed on a malformed World id and never reaches the transport', async () => {
      for (const worldId of ['', '   ', 'shared-world-a', 'PUBLIC_WORLD', 'MATCHING', 'INTRODUCTION', '10000000-0000-4000-8000-00000000000g', null, undefined, 42]) {
        expect(await service.resolveCurrent(worldId as never)).toEqual({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' });
      }
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('transport failure mapping (task §10)', () => {
    it('maps missing server configuration to WORLD_STATE_SNAPSHOT_UNAVAILABLE without calling the network', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'WORLD_STATE_SNAPSHOT_UNAVAILABLE' });
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
      delete process.env.SUPABASE_URL;
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'WORLD_STATE_SNAPSHOT_UNAVAILABLE' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('maps a timeout to LOOKUP_TIMED_OUT', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_TIMED_OUT' });
    });

    it('maps a network failure, a generic non-2xx status and invalid JSON to LOOKUP_FAILED, never to a World state', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED SENTINEL_SERVICE_ROLE'));
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      respond({ message: 'permission denied' }, 401);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      respond([row()], 500);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } } as unknown as Response);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
    });

    it('maps the bounded nonexistent-World rejection (SQLSTATE P0002 from migration 0080) to CONTRADICTORY_CANONICAL_STATE, never to LOOKUP_FAILED, never to a closed or empty World', async () => {
      expect(NONCANONICAL_WORLD_SQLSTATE).toBe('P0002');
      for (const status of [400, 404, 500]) {
        respond({ code: 'P0002', message: 'Shared pre-model World-state resolution target is not a canonical Shared World', details: null, hint: null }, status);
        expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' });
      }
    });

    it.each([
      ['NULL-input 22023 (never sent by this resolver)', { code: '22023', message: 'requires an exact Shared World' }, 400],
      ['permission denied 42501', { code: '42501', message: 'permission denied for function' }, 403],
      ['missing function PGRST202', { code: 'PGRST202', message: 'Could not find the function' }, 404],
      ['generic 5xx with an unrelated code', { code: '57014', message: 'canceling statement' }, 500],
      ['P0001 (a different bounded class)', { code: 'P0001', message: 'raise' }, 400],
      ['lowercase p0002', { code: 'p0002', message: 'x' }, 400],
      ['P0002 with trailing text', { code: 'P0002 ', message: 'x' }, 400],
      ['a non-string code', { code: 2, message: 'x' }, 400],
      ['a code nested in details', { message: 'x', details: { code: 'P0002' } }, 400],
      ['no code at all', { message: 'x' }, 400],
      ['an array error body', [{ code: 'P0002' }], 400],
      ['a string error body', 'P0002', 400],
      ['a null error body', null, 400],
    ])('keeps every other rejection as LOOKUP_FAILED: %s', async (_name, body, status) => {
      respond(body, status);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
    });

    it('keeps a non-JSON non-2xx body as LOOKUP_FAILED', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400, json: async () => { throw new SyntaxError('Unexpected token <'); } } as unknown as Response);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new SyntaxError('Bad Gateway'); } } as unknown as Response);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
    });

    it('anti-vacuity: canonical contradiction and infrastructure failure are two different results from two rejections that differ only in code', async () => {
      respond({ code: 'P0002', message: 'same message SENTINEL_SERVICE_ROLE', details: 'same details' }, 400);
      const contradiction = await service.resolveCurrent(WORLD);
      respond({ code: '42501', message: 'same message SENTINEL_SERVICE_ROLE', details: 'same details' }, 400);
      const infrastructure = await service.resolveCurrent(WORLD);
      expect(contradiction).toEqual({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' });
      expect(infrastructure).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      expect(contradiction).not.toEqual(infrastructure);
      for (const result of [contradiction, infrastructure]) {
        expect(JSON.stringify(result)).not.toMatch(/SENTINEL_SERVICE_ROLE|same message|same details|P0002|42501/u);
        expect(Object.keys(result).sort()).toEqual(['failure', 'state']);
      }
    });

    it('never places the service-role secret or a raw upstream error body in a result, and uses only the bounded failure union', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('raw SENTINEL_SERVICE_ROLE leak'));
      const failed = await service.resolveCurrent(WORLD);
      respond({ message: 'raw database error SENTINEL_SERVICE_ROLE', details: 'stack' }, 500);
      const upstream = await service.resolveCurrent(WORLD);
      respond([row()]);
      const resolved = await service.resolveCurrent(WORLD);
      for (const result of [failed, upstream, resolved]) {
        const text = JSON.stringify(result);
        expect(text).not.toContain('SENTINEL_SERVICE_ROLE');
        expect(text).not.toMatch(/raw|stack|details|message/u);
      }
      expect(Object.keys(failed).sort()).toEqual(['failure', 'state']);
      expect(SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES).toContain((failed as { failure: string }).failure);
    });
  });

  describe('scope guard (task §9, §38, §46)', () => {
    const executable = (file: string): string => readFileSync(join(__dirname, file), 'utf8')
      .replace(/\r\n/gu, '\n')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^[ \t]*\/\/.*$/gmu, '')
      .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');

    it('imports only Nest Injectable, node:crypto, the frozen kernel and the I-03E vocabulary; never I-03B, I-03D or the audience', () => {
      const source = executable('shared-pre-model-world-state-resolver.service.ts');
      const imports = [...source.matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]).sort();
      expect(imports).toEqual(['../kernel/shared-world.types', '../kernel/world-invariants', '../kernel/world.types', './shared-effective-context.types', '@nestjs/common', 'node:crypto']);
      expect(source).toMatch(/import \{ isLegalSharedWorldState \} from '\.\.\/kernel\/world-invariants';/u);
      expect(source).not.toMatch(/\brequire\(|\bimport\(|authority-resolution|standing-context-grant-resolver|\/audience\/|shared-human-audience|shared-effective-context\.service/u);
    });

    it('reaches no table endpoint, membership, grant, Personal runtime, model router, mutation, controller, clock or random identity, and decides no lifecycle', () => {
      const source = executable('shared-pre-model-world-state-resolver.service.ts');
      for (const pattern of [
        /\/rest\/v1\/(?!rpc\/)/u, /shared_worlds\b|membership_episodes|standing_context|grant_audience/u,
        /conversation|model-router|ModelRouter|\bmemory\b|human-model|intelligence-runtime|runtime-events|background-intelligence/iu,
        /@Controller|@Get|@Post|@Module|Router|express/u, /INSERT|UPDATE|DELETE|MERGE|TRUNCATE|revoke|consent_event|close_|end_world|lifecycle_command/u,
        /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout/u, /accessToken|jwt|auth\.uid/iu,
        /'READ_ONLY_CLOSED'|'ACTIVE'|'STANDARD'|'INTRODUCTION'|BLOCKED|NOT_FOUND|EMPTY/u,
        /history|session|material|disclos|matching|public_world|replay|budget|BYTES|TOKENS/iu,
      ]) {
        expect(source).not.toMatch(pattern);
      }
      // The ONE RPC and the ONE hash: exactly one fetch, aimed at /rest/v1/rpc/<resolver>, and SHA-256 only.
      expect(source.match(/\bfetch\(/gu)).toHaveLength(1);
      expect(source).toContain("/rest/v1/rpc/${SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC}");
      expect(source).toContain("createHash('sha256')");
      expect(source).toContain('AbortSignal.timeout(');
      expect(source).toContain('payload.length !== 1');
      expect(source.length).toBeGreaterThan(500);
      // The rejection classifier reads only the bounded `code`: exactly P0002 is canonical contradiction, everything else infrastructure failure.
      expect(source).toContain("NONCANONICAL_WORLD_SQLSTATE = 'P0002' as const;");
      expect(source).toContain('if (!response.ok) return unresolved(await classifyRejection(response));');
      expect(source).toMatch(/return isRecord\(body\) && body\.code === NONCANONICAL_WORLD_SQLSTATE \? 'CONTRADICTORY_CANONICAL_STATE' : 'LOOKUP_FAILED';/u);
      expect(source).not.toMatch(/body\.message|body\.details|body\.hint|response\.text\(|response\.statusText|error\.message/u);
    });

    it('is determinism-safe: identical inputs and payloads give identical results, and every frozen failure class is reachable', async () => {
      respond([row('READ_ONLY_CLOSED', 'INTRODUCTION')]);
      const first = await service.resolveCurrent(WORLD);
      respond([row('READ_ONLY_CLOSED', 'INTRODUCTION')]);
      const second = await service.resolveCurrent(WORLD);
      expect(second).toEqual(first);
      const source = executable('shared-pre-model-world-state-resolver.service.ts');
      for (const failure of SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES) expect(source).toContain(`'${failure}'`);
    });
  });
});
