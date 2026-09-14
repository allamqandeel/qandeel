import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import { evaluateStandingContextAuthority } from '../authority/standing-context-authority';
import type { SharedHumanAudienceSnapshot, StandingContextAuthorityRequest, StandingContextGrantResolution } from '../authority/standing-context-authority.types';
import { SHARED_HUMAN_AUDIENCE_RESOLUTION_FAILURES } from './shared-human-audience-resolution.types';
import type { SharedHumanAudienceResolution } from './shared-human-audience-resolution.types';
import {
  SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC,
  SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION,
  SharedHumanAudienceResolverService,
  fingerprintSharedHumanAudience,
} from './shared-human-audience-resolver.service';

const IDS = {
  world: '10000000-0000-4000-8000-00000000000a',
  otherWorld: '10000000-0000-4000-8000-00000000000b',
  mohamed: '20000000-0000-4000-8000-000000000001',
  hadir: '20000000-0000-4000-8000-000000000002',
  ahmed: '20000000-0000-4000-8000-000000000003',
  e1: '40000000-0000-4000-8000-000000000001',
  e2: '40000000-0000-4000-8000-000000000002',
  e3: '40000000-0000-4000-8000-000000000003',
  e4: '40000000-0000-4000-8000-000000000004',
  grant: '30000000-0000-4000-8000-000000000001',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human(IDS.mohamed);
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

const row = (userId: string, episodeId: string, overrides: Record<string, unknown> = {}) =>
  ({ world_id: IDS.world, membership_episode_id: episodeId, user_id: userId, ...overrides });
const respond = (payload: unknown, status = 200) =>
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => payload } as Response);
const lastCall = () => (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
const fingerprintOf = (lines: string[]) => `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
const refOf = (resolution: SharedHumanAudienceResolution): string =>
  resolution.state === 'RESOLVED' ? resolution.snapshot.snapshotRef : resolution.state === 'EMPTY' ? resolution.snapshotRef : '';

describe('SharedHumanAudienceResolverService', () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  let service: SharedHumanAudienceResolverService;
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://database.invalid/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    service = new SharedHumanAudienceResolverService();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });

  describe('transport (task §21, §30.1-3)', () => {
    it('POSTs exactly the audience RPC with the exact World parameter and service-role headers only', async () => {
      await service.resolveCurrent(WORLD);
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = lastCall();
      expect(url).toBe(`https://database.invalid/rest/v1/rpc/${SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC}`);
      expect(SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC).toBe('resolve_shared_world_human_audience_snapshot_v1');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ p_world_id: IDS.world });
      const headers = init.headers as Record<string, string>;
      expect(headers.apikey).toBe('SENTINEL_SERVICE_ROLE');
      expect(headers.Authorization).toBe('Bearer SENTINEL_SERVICE_ROLE');
      expect(init.signal).toBeInstanceOf(AbortSignal);
      // No direct table REST read, no membership-table endpoint, no mutation.
      expect(url).not.toMatch(/shared_world_membership_episodes|shared_worlds\b|standing_context|\?select=/u);
      expect(url).toContain('/rest/v1/rpc/');
    });

    it('accepts no user JWT, client token or client-supplied audience: the signature is (world) only and the body carries nothing else', async () => {
      await service.resolveCurrent(WORLD);
      const body = JSON.parse(lastCall()[1].body as string);
      for (const forbidden of ['accessToken', 'token', 'jwt', 'claims', 'p_access_token', 'p_jwt', 'Authorization', 'p_user_id', 'p_audience', 'p_audience_user_ids', 'p_members']) expect(body).not.toHaveProperty(forbidden);
      expect(Object.keys(body)).toEqual(['p_world_id']);
      expect(service.resolveCurrent.length).toBe(1);
    });
  });

  describe('resolution mapping (task §18, §25, §30.10-13)', () => {
    it('maps valid zero rows to EMPTY with a fingerprint, never to a snapshot with zero humans', async () => {
      respond([]);
      const resolution = await service.resolveCurrent(WORLD);
      expect(resolution).toEqual({ state: 'EMPTY', snapshotRef: fingerprintOf([SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION, 'state=EMPTY', `world=${IDS.world}`, 'members=']) });
      expect(Object.isFrozen(resolution)).toBe(true);
      expect('snapshot' in resolution).toBe(false);
      expect(resolution.state).not.toBe('UNRESOLVED');
    });

    it('maps one current member to RESOLVED with exactly that human', async () => {
      respond([row(IDS.mohamed, IDS.e1)]);
      const resolution = await service.resolveCurrent(WORLD);
      expect(resolution).toEqual({
        state: 'RESOLVED',
        snapshot: { snapshotRef: fingerprintOf([SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION, 'state=RESOLVED', `world=${IDS.world}`, `members=${IDS.mohamed}@${IDS.e1}`]), humans: [MOHAMED] },
      });
    });

    it('maps two current members to RESOLVED with exactly those humans, canonically sorted by humanId', async () => {
      respond([row(IDS.hadir, IDS.e2), row(IDS.mohamed, IDS.e1)]);
      const resolution = await service.resolveCurrent(WORLD);
      expect(resolution).toEqual({
        state: 'RESOLVED',
        snapshot: {
          snapshotRef: fingerprintOf([SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION, 'state=RESOLVED', `world=${IDS.world}`, `members=${IDS.mohamed}@${IDS.e1},${IDS.hadir}@${IDS.e2}`]),
          humans: [MOHAMED, HADIR],
        },
      });
      if (resolution.state !== 'RESOLVED') throw new Error('unreachable');
      expect(Object.isFrozen(resolution.snapshot)).toBe(true);
      expect(Object.isFrozen(resolution.snapshot.humans)).toBe(true);
      // The frozen I-03A snapshot shape exactly: snapshotRef + humans, every human a HUMAN principal, no episode / lifecycle / material field.
      expect(Object.keys(resolution.snapshot).sort()).toEqual(['humans', 'snapshotRef']);
      expect(resolution.snapshot.humans.every((h) => h.kind === 'HUMAN' && Object.keys(h).length === 2)).toBe(true);
      expect(resolution.snapshot.humans.map((h) => h.humanId)).toEqual([IDS.mohamed, IDS.hadir]);
    });
  });

  describe('snapshotRef fingerprint (task §12, §24, §27, §30.14-18, §30.27)', () => {
    it('is versioned SHA-256 over canonical content, deterministic, independent of row order and of id case', async () => {
      respond([row(IDS.hadir, IDS.e2), row(IDS.mohamed, IDS.e1)]);
      const reversed = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2)]);
      const ordered = await service.resolveCurrent(WORLD);
      expect(reversed).toEqual(ordered);
      expect(refOf(reversed)).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId: IDS.world, members: [{ userId: IDS.hadir, membershipEpisodeId: IDS.e2 }, { userId: IDS.mohamed, membershipEpisodeId: IDS.e1 }] }))
        .toBe(fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId: IDS.world.toUpperCase(), members: [{ userId: IDS.mohamed.toUpperCase(), membershipEpisodeId: IDS.e1 }, { userId: IDS.hadir, membershipEpisodeId: IDS.e2.toUpperCase() }] }));
      expect(SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION).toBe('QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1');
    });

    it('changes when a human is added or removed, when another World is resolved, and never collides between RESOLVED and EMPTY', async () => {
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2)]);
      const pair = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2), row(IDS.ahmed, IDS.e3)]);
      const trio = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1)]);
      const solo = await service.resolveCurrent(WORLD);
      respond([]);
      const empty = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1, { world_id: IDS.otherWorld }), row(IDS.hadir, IDS.e2, { world_id: IDS.otherWorld })]);
      const elsewhere = await service.resolveCurrent(OTHER_WORLD);
      respond([]);
      const emptyElsewhere = await service.resolveCurrent(OTHER_WORLD);
      const refs = [pair, trio, solo, empty, elsewhere, emptyElsewhere].map(refOf);
      expect(refs.every((ref) => /^sha256:[0-9a-f]{64}$/u.test(ref))).toBe(true);
      expect(new Set(refs).size).toBe(6);
    });

    it('changes when one membership episode id is replaced while the human set stays identical (leave / rejoin)', async () => {
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2)]);
      const s1 = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e3)]);
      const s2 = await service.resolveCurrent(WORLD);
      if (s1.state !== 'RESOLVED' || s2.state !== 'RESOLVED') throw new Error('unreachable');
      expect(s1.snapshot.humans).toEqual(s2.snapshot.humans);
      expect(s1.snapshot.snapshotRef).not.toBe(s2.snapshot.snapshotRef);
      // The reference binds user@episode, not the user alone.
      expect(fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId: IDS.world, members: [{ userId: IDS.hadir, membershipEpisodeId: IDS.e2 }] }))
        .not.toBe(fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId: IDS.world, members: [{ userId: IDS.hadir, membershipEpisodeId: IDS.e3 }] }));
    });
  });

  describe('malformed / contradictory payload → UNRESOLVED / CONTRADICTORY_CANONICAL_STATE (task §22, §30.19-23)', () => {
    const contradictory = { state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' };
    it.each([
      ['duplicate user across two episodes', [row(IDS.mohamed, IDS.e1), row(IDS.mohamed, IDS.e2)]],
      ['duplicate user differing by case', [row(IDS.mohamed, IDS.e1), row(IDS.mohamed.toUpperCase(), IDS.e2)]],
      ['duplicate episode id across two users', [row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e1)]],
      ['malformed user UUID', [row('mohamed', IDS.e1)]],
      ['malformed episode UUID', [row(IDS.mohamed, 'episode-1')]],
      ['malformed world UUID', [row(IDS.mohamed, IDS.e1, { world_id: 'shared-world-a' })]],
      ['mismatched world row', [row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2, { world_id: IDS.otherWorld })]],
      ['every row for another World', [row(IDS.mohamed, IDS.e1, { world_id: IDS.otherWorld })]],
      ['null user', [row(IDS.mohamed, IDS.e1, { user_id: null })]],
      ['extra column', [row(IDS.mohamed, IDS.e1, { lifecycle: 'ACTIVE' })]],
      ['extra material column', [row(IDS.mohamed, IDS.e1, { session_ids: [] })]],
      ['missing column', [{ world_id: IDS.world, user_id: IDS.mohamed }]],
      ['QANDEEL as a member', [row('QANDEEL_SYSTEM', IDS.e1)]],
      ['non-object row', ['row']],
      ['non-array payload', { world_id: IDS.world }],
      ['null payload', null],
      ['string payload', '[]'],
    ])('%s', async (_name, payload) => {
      respond(payload);
      expect(await service.resolveCurrent(WORLD)).toEqual(contradictory);
    });

    it('never partially salvages: a contradictory response yields no snapshot and no fingerprint, and duplicates are never silently deduplicated', async () => {
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2), row(IDS.hadir, IDS.e3)]);
      const resolution = await service.resolveCurrent(WORLD);
      expect(resolution).toEqual(contradictory);
      expect('snapshot' in resolution).toBe(false);
      expect('snapshotRef' in resolution).toBe(false);
    });
  });

  describe('input validation before network (task §20, §30.4)', () => {
    it('fails closed on a malformed World id and never reaches the transport', async () => {
      for (const worldId of ['', '   ', 'shared-world-a', 'PUBLIC_WORLD', 'MATCHING', 'INTRODUCTION', '10000000-0000-4000-8000-00000000000g', null, undefined, 42]) {
        expect(await service.resolveCurrent(worldId as never)).toEqual({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' });
      }
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('transport failure mapping (task §19, §30.5-9, §30.24)', () => {
    it('maps missing server configuration to AUDIENCE_SNAPSHOT_UNAVAILABLE without calling the network', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'AUDIENCE_SNAPSHOT_UNAVAILABLE' });
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
      delete process.env.SUPABASE_URL;
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'AUDIENCE_SNAPSHOT_UNAVAILABLE' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('maps a timeout to LOOKUP_TIMED_OUT', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_TIMED_OUT' });
    });

    it('maps a network failure, a non-2xx status (including the bounded nonexistent-World error) and invalid JSON to LOOKUP_FAILED, never to EMPTY', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED SENTINEL_SERVICE_ROLE'));
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      respond({ code: 'P0002', message: 'Shared human audience resolution target is not a canonical Shared World' }, 400);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      respond({ message: 'permission denied' }, 401);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      respond([], 500);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } } as unknown as Response);
      expect(await service.resolveCurrent(WORLD)).toEqual({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' });
    });

    it('never places the service-role secret or a raw upstream error body in a result, and uses only the bounded failure union', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('raw SENTINEL_SERVICE_ROLE leak'));
      const failed = await service.resolveCurrent(WORLD);
      respond({ message: 'raw database error SENTINEL_SERVICE_ROLE', details: 'stack' }, 500);
      const upstream = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1)]);
      const resolved = await service.resolveCurrent(WORLD);
      for (const result of [failed, upstream, resolved]) {
        const text = JSON.stringify(result);
        expect(text).not.toContain('SENTINEL_SERVICE_ROLE');
        expect(text).not.toMatch(/raw|stack|details|message/u);
      }
      expect(Object.keys(failed).sort()).toEqual(['failure', 'state']);
      expect(SHARED_HUMAN_AUDIENCE_RESOLUTION_FAILURES).toContain((failed as { failure: string }).failure);
      expect([...SHARED_HUMAN_AUDIENCE_RESOLUTION_FAILURES].sort()).toEqual(['AUDIENCE_SNAPSHOT_UNAVAILABLE', 'CONTRADICTORY_CANONICAL_STATE', 'LOOKUP_FAILED', 'LOOKUP_TIMED_OUT']);
    });
  });

  describe('direct composition with the frozen I-03A evaluator (task §26, §30.25-26)', () => {
    // The grant resolution is built by hand: I-03D never calls I-03B, and the
    // composition proof is exactly that the RESOLVED snapshot is accepted as
    // `audienceSnapshot` without translation.
    const grantResolution = (ceiling: ReadonlyArray<HumanPrincipal>): StandingContextGrantResolution => ({
      state: 'FOUND',
      authoritySnapshotRef: 'sha256:' + '0'.repeat(64),
      grant: { grantId: IDS.grant, worldId: WORLD, grantor: MOHAMED, status: 'ACTIVE', audienceCeiling: ceiling },
    });
    const requestWith = (audienceSnapshot: SharedHumanAudienceSnapshot): StandingContextAuthorityRequest => ({
      action: 'REASON_FROM_PRIVATE_CONTEXT',
      grantor: MOHAMED,
      targetWorldId: WORLD,
      purpose: 'SHARED_REASONING',
      audienceSnapshot,
    });

    it('a RESOLVED snapshot is passed directly as audienceSnapshot: audience {Mohamed,Hadir} inside ceiling {Mohamed,Hadir} may ALLOW', async () => {
      respond([row(IDS.hadir, IDS.e2), row(IDS.mohamed, IDS.e1)]);
      const resolution = await service.resolveCurrent(WORLD);
      if (resolution.state !== 'RESOLVED') throw new Error('unreachable');
      const decision = evaluateStandingContextAuthority(requestWith(resolution.snapshot), grantResolution([MOHAMED, HADIR]));
      expect(decision.decision).toBe('ALLOW');
      if (decision.decision !== 'ALLOW') throw new Error('unreachable');
      expect(decision.binding.audienceSnapshotRef).toBe(resolution.snapshot.snapshotRef);
      expect(decision.binding.audienceHumanIds).toEqual([IDS.mohamed, IDS.hadir]);
      expect(decision.constraints.materialDisclosureAuthority).toBe('NOT_GRANTED');
    });

    it('an expanded current audience {Mohamed,Hadir,Ahmed} under the same old ceiling is DENIED with AUDIENCE_EXCEEDS_GRANT_CEILING', async () => {
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2), row(IDS.ahmed, IDS.e3)]);
      const expanded = await service.resolveCurrent(WORLD);
      if (expanded.state !== 'RESOLVED') throw new Error('unreachable');
      expect(evaluateStandingContextAuthority(requestWith(expanded.snapshot), grantResolution([MOHAMED, HADIR]))).toEqual({ decision: 'DENY', externalEffect: 'BLOCKED', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
    });

    it('a leave / rejoin snapshot with the same humans is still accepted by I-03A but binds a different audienceSnapshotRef (stale-state detection)', async () => {
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2)]);
      const s1 = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e4)]);
      const s2 = await service.resolveCurrent(WORLD);
      if (s1.state !== 'RESOLVED' || s2.state !== 'RESOLVED') throw new Error('unreachable');
      const d1 = evaluateStandingContextAuthority(requestWith(s1.snapshot), grantResolution([MOHAMED, HADIR]));
      const d2 = evaluateStandingContextAuthority(requestWith(s2.snapshot), grantResolution([MOHAMED, HADIR]));
      if (d1.decision !== 'ALLOW' || d2.decision !== 'ALLOW') throw new Error('unreachable');
      expect(d1.binding.audienceHumanIds).toEqual(d2.binding.audienceHumanIds);
      expect(d1.binding.audienceSnapshotRef).not.toBe(d2.binding.audienceSnapshotRef);
    });
  });

  describe('scope guard (task §16, §30.27-30, §32-§35)', () => {
    const executable = (file: string): string => readFileSync(join(__dirname, file), 'utf8')
      .replace(/\r\n/gu, '\n')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^[ \t]*\/\/.*$/gmu, '')
      .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');

    it('contains exactly the types, the resolver and its spec; the resolver imports only Nest Injectable, node:crypto, the kernel types, the frozen I-03A snapshot type and its own result type', () => {
      expect(readdirSync(__dirname).filter((name) => name.endsWith('.ts')).sort()).toEqual([
        'shared-human-audience-resolution.types.ts',
        'shared-human-audience-resolver.service.spec.ts',
        'shared-human-audience-resolver.service.ts',
      ]);
      const source = executable('shared-human-audience-resolver.service.ts');
      const imports = [...source.matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]).sort();
      expect(imports).toEqual(['../authority/standing-context-authority.types', '../kernel/principal.types', '../kernel/world.types', './shared-human-audience-resolution.types', '@nestjs/common', 'node:crypto']);
      expect(source).toMatch(/import type \{ SharedHumanAudienceSnapshot \} from '\.\.\/authority\/standing-context-authority\.types';/u);
      expect(source).not.toMatch(/\brequire\(|\bimport\(|authority-resolution|standing-context-grant-resolver/u);
      const types = executable('shared-human-audience-resolution.types.ts');
      expect(types).toMatch(/import type \{ SharedHumanAudienceSnapshot \} from '\.\.\/authority\/standing-context-authority\.types';/u);
      expect(types).not.toMatch(/interface \w*Snapshot\b/u);
    });

    it('reaches no table endpoint, grant, history, Personal runtime, model router, mutation, controller, clock or random identity', () => {
      const source = executable('shared-human-audience-resolver.service.ts');
      for (const pattern of [
        /\/rest\/v1\/(?!rpc\/)/u, /shared_world_membership_episodes\b|shared_worlds\b/u, /standing_context|grant_audience|resolve_shared_world_standing/u,
        /conversation|model-router|ModelRouter|\bmemory\b|human-model|intelligence-runtime|effective-context|EffectiveContext|runtime-events|background-intelligence/iu,
        /@Controller|@Get|@Post|@Module|Router|express/u, /INSERT|UPDATE|DELETE|MERGE|TRUNCATE|revoke|consent_event|leave|rejoin|close_/u,
        /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout/u, /accessToken|jwt|auth\.uid/iu,
        /lifecycle|READ_ONLY_CLOSED|history|session|material|disclos|matching|public_world|replay/iu,
      ]) {
        expect(source).not.toMatch(pattern);
      }
      // The ONE RPC and the ONE hash: exactly one fetch, aimed at /rest/v1/rpc/<resolver>, and SHA-256 only.
      expect(source.match(/\bfetch\(/gu)).toHaveLength(1);
      expect(source).toContain("/rest/v1/rpc/${SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC}");
      expect(source).toContain("createHash('sha256')");
      expect(source).toContain('AbortSignal.timeout(');
      expect(source).toContain('@');
      expect(source.length).toBeGreaterThan(500);
    });

    it('is determinism-safe: identical inputs and payloads give identical results, and every frozen failure class is reachable', async () => {
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2)]);
      const first = await service.resolveCurrent(WORLD);
      respond([row(IDS.mohamed, IDS.e1), row(IDS.hadir, IDS.e2)]);
      const second = await service.resolveCurrent(WORLD);
      expect(second).toEqual(first);
      const source = executable('shared-human-audience-resolver.service.ts');
      for (const failure of SHARED_HUMAN_AUDIENCE_RESOLUTION_FAILURES) expect(source).toContain(`'${failure}'`);
    });
  });
});
