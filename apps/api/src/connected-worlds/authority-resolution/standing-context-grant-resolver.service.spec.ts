import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { HumanPrincipal } from '../kernel/principal.types';
import { QANDEEL_SYSTEM_ACTOR } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import { evaluateStandingContextAuthority } from '../authority/standing-context-authority';
import { STANDING_CONTEXT_RESOLUTION_FAILURES } from '../authority/standing-context-authority.types';
import type { StandingContextAuthorityRequest, StandingContextGrantResolution } from '../authority/standing-context-authority.types';
import {
  STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION,
  STANDING_CONTEXT_GRANT_RESOLUTION_RPC,
  StandingContextGrantResolverService,
  fingerprintStandingContextAuthority,
} from './standing-context-grant-resolver.service';

const IDS = {
  world: '10000000-0000-4000-8000-00000000000a',
  otherWorld: '10000000-0000-4000-8000-00000000000b',
  grantor: '20000000-0000-4000-8000-000000000001',
  hadir: '20000000-0000-4000-8000-000000000002',
  ahmed: '20000000-0000-4000-8000-000000000003',
  grant: '30000000-0000-4000-8000-000000000001',
  grant2: '30000000-0000-4000-8000-000000000002',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human(IDS.grantor);
const HADIR = human(IDS.hadir);
const AHMED = human(IDS.ahmed);

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

const row = (audience: string | null, overrides: Record<string, unknown> = {}) =>
  ({ grant_id: IDS.grant, world_id: IDS.world, grantor_user_id: IDS.grantor, status: 'ACTIVE', audience_user_id: audience, ...overrides });
const respond = (payload: unknown, status = 200) =>
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => payload } as Response);
const lastCall = () => (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];

const fingerprintOf = (lines: string[]) => `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;

describe('StandingContextGrantResolverService', () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  let service: StandingContextGrantResolverService;
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://database.invalid/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    service = new StandingContextGrantResolverService();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });

  describe('transport (task §12, §22.1-3, §22.28-30)', () => {
    it('POSTs exactly the resolver RPC with the exact World and grantor parameters and service-role headers only', async () => {
      await service.resolveCurrent(WORLD, MOHAMED);
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = lastCall();
      expect(url).toBe(`https://database.invalid/rest/v1/rpc/${STANDING_CONTEXT_GRANT_RESOLUTION_RPC}`);
      expect(STANDING_CONTEXT_GRANT_RESOLUTION_RPC).toBe('resolve_shared_world_standing_context_grant_v1');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ p_world_id: IDS.world, p_grantor_user_id: IDS.grantor });
      const headers = init.headers as Record<string, string>;
      expect(headers.apikey).toBe('SENTINEL_SERVICE_ROLE');
      expect(headers.Authorization).toBe('Bearer SENTINEL_SERVICE_ROLE');
      expect(init.signal).toBeInstanceOf(AbortSignal);
      // No direct table REST read, no membership read, no mutation.
      expect(url).not.toMatch(/shared_world_standing_context_grants\b|grant_audience|membership|\?select=/u);
      expect(url).toContain('/rest/v1/rpc/');
    });

    it('accepts no user JWT or client token: the method signature is (world, grantor) only and the body carries nothing else', async () => {
      await service.resolveCurrent(WORLD, MOHAMED);
      const body = JSON.parse(lastCall()[1].body as string);
      for (const forbidden of ['accessToken', 'token', 'jwt', 'claims', 'p_access_token', 'p_jwt', 'Authorization', 'p_user_id', 'p_audience']) expect(body).not.toHaveProperty(forbidden);
      expect(Object.keys(body).sort()).toEqual(['p_grantor_user_id', 'p_world_id']);
      expect(service.resolveCurrent.length).toBe(2);
    });
  });

  describe('resolution mapping (task §3, §14, §22.4-6)', () => {
    it('maps a valid empty response to NOT_FOUND with a fingerprint', async () => {
      respond([]);
      const resolution = await service.resolveCurrent(WORLD, MOHAMED);
      expect(resolution).toEqual({
        state: 'NOT_FOUND',
        authoritySnapshotRef: fingerprintOf([STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION, 'state=NOT_FOUND', `world=${IDS.world}`, `grantor=${IDS.grantor}`]),
      });
      expect(Object.isFrozen(resolution)).toBe(true);
    });

    it('maps one ACTIVE grant with an empty ceiling (one NULL-audience row) to FOUND with an empty audienceCeiling', async () => {
      respond([row(null)]);
      const resolution = await service.resolveCurrent(WORLD, MOHAMED);
      expect(resolution).toEqual({
        state: 'FOUND',
        authoritySnapshotRef: fingerprintOf([STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION, 'state=FOUND', `world=${IDS.world}`, `grantor=${IDS.grantor}`, `grant=${IDS.grant}`, 'status=ACTIVE', 'audience=']),
        grant: { grantId: IDS.grant, worldId: IDS.world, grantor: MOHAMED, status: 'ACTIVE', audienceCeiling: [] },
      });
      // An empty ceiling is a grant, never confused with no grant.
      expect(resolution.state).not.toBe('NOT_FOUND');
    });

    it('maps one ACTIVE grant with two ceiling humans to FOUND with exactly those humans', async () => {
      respond([row(IDS.grantor), row(IDS.hadir)]);
      const resolution = await service.resolveCurrent(WORLD, MOHAMED);
      expect(resolution).toEqual({
        state: 'FOUND',
        authoritySnapshotRef: fingerprintOf([STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION, 'state=FOUND', `world=${IDS.world}`, `grantor=${IDS.grantor}`, `grant=${IDS.grant}`, 'status=ACTIVE', `audience=${IDS.grantor},${IDS.hadir}`]),
        grant: { grantId: IDS.grant, worldId: IDS.world, grantor: MOHAMED, status: 'ACTIVE', audienceCeiling: [MOHAMED, HADIR] },
      });
      if (resolution.state !== 'FOUND') throw new Error('unreachable');
      expect(Object.isFrozen(resolution.grant)).toBe(true);
      expect(Object.isFrozen(resolution.grant.audienceCeiling)).toBe(true);
      // The requested branded identity passes through; nothing is re-minted.
      expect(resolution.grant.worldId).toBe(WORLD);
      // Only the five transport columns feed the snapshot: no purpose / scope / disclosure / provenance field.
      expect(Object.keys(resolution.grant).sort()).toEqual(['audienceCeiling', 'grantId', 'grantor', 'status', 'worldId']);
    });
  });

  describe('authoritySnapshotRef fingerprint (task §16, §22.7-9, §22.27)', () => {
    it('is versioned SHA-256 over canonical content, deterministic across calls and independent of row order', async () => {
      respond([row(IDS.hadir), row(IDS.grantor)]);
      const reversed = await service.resolveCurrent(WORLD, MOHAMED);
      respond([row(IDS.grantor), row(IDS.hadir)]);
      const ordered = await service.resolveCurrent(WORLD, MOHAMED);
      expect(reversed).toEqual(ordered);
      expect(reversed.state === 'FOUND' && reversed.authoritySnapshotRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(fingerprintStandingContextAuthority({ state: 'FOUND', worldId: IDS.world, grantorId: IDS.grantor, grantId: IDS.grant, audienceIds: [IDS.hadir, IDS.grantor] }))
        .toBe(fingerprintStandingContextAuthority({ state: 'FOUND', worldId: IDS.world.toUpperCase(), grantorId: IDS.grantor, grantId: IDS.grant, audienceIds: [IDS.grantor, IDS.hadir] }));
      expect(STANDING_CONTEXT_AUTHORITY_SNAPSHOT_VERSION).toBe('QANDEEL_CWV2_STANDING_CONTEXT_AUTHORITY_SNAPSHOT_V1');
    });

    it('changes when the audience set changes or the grant id changes, and never collides between FOUND and NOT_FOUND', async () => {
      respond([row(IDS.grantor), row(IDS.hadir)]);
      const pair = await service.resolveCurrent(WORLD, MOHAMED);
      respond([row(IDS.grantor), row(IDS.hadir), row(IDS.ahmed)]);
      const trio = await service.resolveCurrent(WORLD, MOHAMED);
      respond([row(IDS.grantor, { grant_id: IDS.grant2 }), row(IDS.hadir, { grant_id: IDS.grant2 })]);
      const reconfirmed = await service.resolveCurrent(WORLD, MOHAMED);
      respond([]);
      const none = await service.resolveCurrent(WORLD, MOHAMED);
      const refs = [pair, trio, reconfirmed, none].map((r) => (r.state === 'UNRESOLVED' ? '' : r.authoritySnapshotRef));
      expect(new Set(refs).size).toBe(4);
      expect(refs.every((ref) => /^sha256:[0-9a-f]{64}$/u.test(ref))).toBe(true);
    });
  });

  describe('malformed / contradictory payload → UNRESOLVED / CONTRADICTORY_CANONICAL_STATE (task §14, §22.10-15)', () => {
    const contradictory = { state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' };
    it.each([
      ['malformed status', [row(IDS.grantor, { status: 'REVOKED' })]],
      ['lowercase status', [row(IDS.grantor, { status: 'active' })]],
      ['mismatched world', [row(IDS.grantor, { world_id: IDS.otherWorld })]],
      ['mismatched grantor', [row(IDS.grantor, { grantor_user_id: IDS.hadir })]],
      ['multiple grant ids in one response', [row(IDS.grantor), row(IDS.hadir, { grant_id: IDS.grant2 })]],
      ['duplicate audience id', [row(IDS.grantor), row(IDS.grantor)]],
      ['duplicate audience id differing by case', [row(IDS.grantor), row(IDS.grantor.toUpperCase())]],
      ['null and non-null audience mix', [row(null), row(IDS.hadir)]],
      ['two null-audience rows', [row(null), row(null)]],
      ['non-UUID audience', [row('everyone')]],
      ['non-UUID grant id', [row(IDS.grantor, { grant_id: 'grant-1' })]],
      ['extra column', [row(IDS.grantor, { scope: 'ALL' })]],
      ['missing column', [{ grant_id: IDS.grant, world_id: IDS.world, grantor_user_id: IDS.grantor, status: 'ACTIVE' }]],
      ['non-object row', ['row']],
      ['non-array payload', { grant_id: IDS.grant }],
      ['null payload', null],
    ])('%s', async (_name, payload) => {
      respond(payload);
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual(contradictory);
    });

    it('never partially salvages: a contradictory response yields no grant, no ceiling and no fingerprint', async () => {
      respond([row(IDS.grantor), row(IDS.hadir, { world_id: IDS.otherWorld })]);
      const resolution = await service.resolveCurrent(WORLD, MOHAMED);
      expect(resolution).toEqual(contradictory);
      expect('grant' in resolution).toBe(false);
      expect('authoritySnapshotRef' in resolution).toBe(false);
    });
  });

  describe('input validation before network (task §13, §22.16-17)', () => {
    it('fails closed on a malformed World id or human id and never reaches the transport', async () => {
      for (const worldId of ['', '   ', 'shared-world-a', 'PUBLIC_WORLD', 'MATCHING', '10000000-0000-4000-8000-00000000000g']) {
        expect(await service.resolveCurrent(worldId as SharedWorldId, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' });
      }
      for (const grantor of [human(''), human('human-mohamed'), QANDEEL_SYSTEM_ACTOR, { kind: 'HUMAN' }, null, 'human-mohamed']) {
        expect(await service.resolveCurrent(WORLD, grantor as never)).toEqual({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' });
      }
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('transport failure mapping (task §15, §22.18-23)', () => {
    it('maps missing server configuration to AUTHORITY_SNAPSHOT_UNAVAILABLE without calling the network', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'AUTHORITY_SNAPSHOT_UNAVAILABLE' });
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
      delete process.env.SUPABASE_URL;
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'AUTHORITY_SNAPSHOT_UNAVAILABLE' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('maps a timeout to LOOKUP_TIMED_OUT', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_TIMED_OUT' });
    });

    it('maps a network failure, a non-2xx status (including the bounded noncanonical-World/human error) and invalid JSON to LOOKUP_FAILED', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED SENTINEL_SERVICE_ROLE'));
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      respond({ code: 'P0002', message: 'Standing Context Grant resolution target is not a canonical Shared World' }, 400);
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      respond({ message: 'permission denied' }, 401);
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } } as unknown as Response);
      expect(await service.resolveCurrent(WORLD, MOHAMED)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
    });

    it('never places the service-role secret or a raw upstream error body in a result', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('raw SENTINEL_SERVICE_ROLE leak'));
      const failed = await service.resolveCurrent(WORLD, MOHAMED);
      respond({ message: 'raw database error SENTINEL_SERVICE_ROLE', details: 'stack' }, 500);
      const upstream = await service.resolveCurrent(WORLD, MOHAMED);
      respond([row(IDS.grantor)]);
      const found = await service.resolveCurrent(WORLD, MOHAMED);
      for (const result of [failed, upstream, found]) {
        const text = JSON.stringify(result);
        expect(text).not.toContain('SENTINEL_SERVICE_ROLE');
        expect(text).not.toMatch(/raw|stack|details|message/u);
      }
      expect(Object.keys(failed).sort()).toEqual(['failure', 'state']);
      expect(STANDING_CONTEXT_RESOLUTION_FAILURES).toContain((failed as { failure: string }).failure);
    });
  });

  describe('composition with the frozen I-03A evaluator (task §18, §22.24-26)', () => {
    const request = (audience: ReadonlyArray<HumanPrincipal>): StandingContextAuthorityRequest => ({
      action: 'REASON_FROM_PRIVATE_CONTEXT',
      grantor: MOHAMED,
      targetWorldId: WORLD,
      purpose: 'SHARED_REASONING',
      audienceSnapshot: { snapshotRef: 'audience-snapshot-1', humans: audience },
    });

    it('FOUND feeds the evaluator directly and ALLOWs an audience inside the ceiling, DENYs one outside it', async () => {
      respond([row(IDS.grantor), row(IDS.hadir)]);
      const resolution: StandingContextGrantResolution = await service.resolveCurrent(WORLD, MOHAMED);
      const allowed = evaluateStandingContextAuthority(request([HADIR, MOHAMED]), resolution);
      expect(allowed.decision).toBe('ALLOW');
      if (allowed.decision !== 'ALLOW') throw new Error('unreachable');
      expect(allowed.binding.grantId).toBe(IDS.grant);
      expect(allowed.binding.authoritySnapshotRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(allowed.constraints.materialDisclosureAuthority).toBe('NOT_GRANTED');
      // Membership expansion is only a changed audience snapshot; the resolved ceiling does not follow it.
      expect(evaluateStandingContextAuthority(request([MOHAMED, HADIR, AHMED]), resolution)).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
    });

    it('NOT_FOUND feeds the evaluator directly and DENYs', async () => {
      respond([]);
      const resolution = await service.resolveCurrent(WORLD, MOHAMED);
      expect(evaluateStandingContextAuthority(request([MOHAMED, HADIR]), resolution)).toEqual({ decision: 'DENY', externalEffect: 'BLOCKED', reason: 'NO_STANDING_CONTEXT_GRANT' });
    });

    it('UNRESOLVED feeds the evaluator directly and becomes UNKNOWN, for every failure class', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('down'));
      const unavailable = await service.resolveCurrent(WORLD, MOHAMED);
      expect(evaluateStandingContextAuthority(request([MOHAMED, HADIR]), unavailable)).toEqual({ decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason: 'GRANT_STATE_UNRESOLVED' });
      respond([row(IDS.grantor, { world_id: IDS.otherWorld })]);
      const contradictory = await service.resolveCurrent(WORLD, MOHAMED);
      expect(evaluateStandingContextAuthority(request([MOHAMED, HADIR]), contradictory)).toEqual({ decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason: 'GRANT_STATE_UNRESOLVED' });
      // A grant for another World is still exact-World: resolved for OTHER_WORLD it can never answer for WORLD.
      respond([{ ...row(IDS.grantor), world_id: IDS.otherWorld }]);
      const elsewhere = await service.resolveCurrent(OTHER_WORLD, MOHAMED);
      expect(elsewhere.state).toBe('FOUND');
      expect(evaluateStandingContextAuthority(request([MOHAMED]), elsewhere)).toMatchObject({ decision: 'DENY', reason: 'TARGET_WORLD_MISMATCH' });
    });
  });

  describe('scope guard (task §19, §22.27-30, §23-§25)', () => {
    const executable = (file: string): string => readFileSync(join(__dirname, file), 'utf8')
      .replace(/\r\n/gu, '\n')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^[ \t]*\/\/.*$/gmu, '')
      .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');

    it('contains exactly the resolver and its spec, imports only Nest Injectable, node:crypto, the kernel and the frozen I-03A types', () => {
      expect(readdirSync(__dirname).filter((name) => name.endsWith('.ts')).sort()).toEqual(['standing-context-grant-resolver.service.spec.ts', 'standing-context-grant-resolver.service.ts']);
      const source = executable('standing-context-grant-resolver.service.ts');
      const imports = [...source.matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]).sort();
      expect(imports).toEqual(['../authority/standing-context-authority.types', '../kernel/principal.types', '../kernel/world-invariants', '../kernel/world.types', '@nestjs/common', 'node:crypto']);
      expect(source).toMatch(/import type \{[^}]*StandingContextGrantResolution[^}]*\} from '\.\.\/authority\/standing-context-authority\.types';/u);
      expect(source).not.toMatch(/\brequire\(|\bimport\(/u);
    });

    it('reaches no table endpoint, membership, Personal runtime, model router, mutation RPC, controller, clock or random identity', () => {
      const source = executable('standing-context-grant-resolver.service.ts');
      for (const pattern of [
        /\/rest\/v1\/(?!rpc\/)/u, /shared_world_standing_context_grants\b/u, /grant_audience\b/u, /membership|episode/iu,
        /conversation|model-router|ModelRouter|\bmemory\b|human-model|intelligence-runtime|runtime-events|background-intelligence/iu,
        /@Controller|@Get|@Post|@Module|Router|express/u, /grant_standing|revoke|extend_|consent_event|server_create|INSERT|UPDATE|DELETE/u,
        /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout/u, /cross-context|crossContext/u, /accessToken|jwt|auth\.uid/iu,
      ]) {
        expect(source).not.toMatch(pattern);
      }
      // The ONE RPC and the ONE hash: exactly one fetch, aimed at /rest/v1/rpc/<resolver>, and SHA-256 only.
      expect(source.match(/\bfetch\(/gu)).toHaveLength(1);
      expect(source).toContain("/rest/v1/rpc/${STANDING_CONTEXT_GRANT_RESOLUTION_RPC}");
      expect(source).toContain("createHash('sha256')");
      expect(source).toContain('AbortSignal.timeout(');
      expect(source.length).toBeGreaterThan(500);
    });

    it('is determinism-safe: identical inputs and payloads give identical results', async () => {
      respond([row(IDS.grantor), row(IDS.hadir)]);
      const first = await service.resolveCurrent(WORLD, MOHAMED);
      respond([row(IDS.grantor), row(IDS.hadir)]);
      const second = await service.resolveCurrent(WORLD, MOHAMED);
      expect(second).toEqual(first);
    });
  });
});
