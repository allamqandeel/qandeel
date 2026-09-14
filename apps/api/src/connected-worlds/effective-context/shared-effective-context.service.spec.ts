import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { HumanPrincipal } from '../kernel/principal.types';
import { QANDEEL_SYSTEM_ACTOR } from '../kernel/principal.types';
import type { MyWorldRef, SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest, SharedWorldLifecycle, SharedWorldPhase } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import type { StandingContextAllowConstraints, StandingContextGrantResolution, StandingContextResolutionFailure } from '../authority/standing-context-authority.types';
import { STANDING_CONTEXT_RESOLUTION_FAILURES } from '../authority/standing-context-authority.types';
import { StandingContextGrantResolverService, STANDING_CONTEXT_GRANT_RESOLUTION_RPC } from '../authority-resolution/standing-context-grant-resolver.service';
import type { SharedHumanAudienceResolution } from '../audience/shared-human-audience-resolution.types';
import { SharedHumanAudienceResolverService, SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC, fingerprintSharedHumanAudience } from '../audience/shared-human-audience-resolver.service';
import { SharedPreModelWorldStateResolverService, SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC, fingerprintSharedPreModelWorldState } from './shared-pre-model-world-state-resolver.service';
import {
  SHARED_EFFECTIVE_CONTEXT_BLOCK_REASONS,
  SHARED_EFFECTIVE_CONTEXT_UNRESOLVED_REASONS,
  SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES,
} from './shared-effective-context.types';
import type {
  AvailableSharedPrivateContextCandidate,
  SharedEffectiveContextResolution,
  SharedPreModelWorldStateResolution,
  SharedPrivateContextCandidate,
  UnavailableSharedPrivateContextCandidate,
} from './shared-effective-context.types';
import {
  SHARED_EFFECTIVE_CONTEXT_VERSION,
  SharedEffectiveContextService,
  digestReasoningContent,
  fingerprintSharedEffectiveContext,
} from './shared-effective-context.service';

const IDS = {
  world: '10000000-0000-4000-8000-00000000000a',
  otherWorld: '10000000-0000-4000-8000-00000000000b',
  mohamed: '20000000-0000-4000-8000-000000000001',
  hadir: '20000000-0000-4000-8000-000000000002',
  ahmed: '20000000-0000-4000-8000-000000000003',
  omar: '20000000-0000-4000-8000-000000000004',
  grantM: '30000000-0000-4000-8000-000000000001',
  grantM2: '30000000-0000-4000-8000-000000000002',
  grantA: '30000000-0000-4000-8000-000000000003',
  grantO: '30000000-0000-4000-8000-000000000004',
  e1: '40000000-0000-4000-8000-000000000001',
  e2: '40000000-0000-4000-8000-000000000002',
  e3: '40000000-0000-4000-8000-000000000003',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human(IDS.mohamed);
const HADIR = human(IDS.hadir);
const AHMED = human(IDS.ahmed);
const OMAR = human(IDS.omar);

// A SharedWorldId exists only through a valid Shared World birth (I-01A); the
// service never mints one, so the fixtures obtain theirs the same way.
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

const EXPECTED_CONSTRAINTS: StandingContextAllowConstraints = {
  contextClassification: 'PRIVATE_REASONING_ONLY_CONTEXT',
  reasoningAuthority: 'ALLOW',
  directPrivateDisclosureAuthority: 'NOT_GRANTED',
  materialDisclosureAuthority: 'NOT_GRANTED',
  provenanceDisclosure: 'SEALED',
  deliveryAuthority: 'REQUIRES_REVALIDATION',
};

// --- fixtures -----------------------------------------------------------------

const myWorld = (owner: HumanPrincipal): MyWorldRef => ({ architectureClass: 'WORLD', worldType: 'MY_WORLD', owner });
const available = (owner: HumanPrincipal, contextId: string, reasoningContent: string): AvailableSharedPrivateContextCandidate =>
  ({ kind: 'MY_WORLD_PRIVATE_CONTEXT', contextId, originWorld: myWorld(owner), availability: 'AVAILABLE', reasoningContent });
const unavailable = (owner: HumanPrincipal, contextId: string, availability: 'DELETED_BY_OWNER' | 'UNAVAILABLE'): UnavailableSharedPrivateContextCandidate =>
  ({ kind: 'MY_WORLD_PRIVATE_CONTEXT', contextId, originWorld: myWorld(owner), availability });

const worldResolved = (lifecycle: SharedWorldLifecycle = 'ACTIVE', phase: SharedWorldPhase = 'STANDARD', worldId: SharedWorldId = WORLD): SharedPreModelWorldStateResolution =>
  ({ state: 'RESOLVED', snapshot: { worldId, lifecycle, phase, snapshotRef: fingerprintSharedPreModelWorldState({ worldId, lifecycle, phase }) } });
const snapshotOf = (resolution: SharedPreModelWorldStateResolution) => {
  if (resolution.state !== 'RESOLVED') throw new Error('fixture is not RESOLVED');
  return resolution.snapshot;
};
const grantOf = (resolution: StandingContextGrantResolution) => {
  if (resolution.state !== 'FOUND') throw new Error('fixture is not FOUND');
  return resolution.grant;
};
const audienceRef = (members: ReadonlyArray<[HumanPrincipal, string]>): string =>
  fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId: IDS.world, members: members.map(([h, episode]) => ({ userId: h.humanId, membershipEpisodeId: episode })) });
const audienceOf = (humans: ReadonlyArray<HumanPrincipal>, snapshotRef = audienceRef(humans.map((h, index) => [h, [IDS.e1, IDS.e2, IDS.e3][index] ?? IDS.e3]))): SharedHumanAudienceResolution =>
  ({ state: 'RESOLVED', snapshot: { snapshotRef, humans } });
const AUDIENCE_EMPTY: SharedHumanAudienceResolution = { state: 'EMPTY', snapshotRef: fingerprintSharedHumanAudience({ state: 'EMPTY', worldId: IDS.world }) };

const AUTHORITY_REF = (suffix: string) => `sha256:${suffix.padEnd(64, '0')}`;
const found = (grantor: HumanPrincipal, ceiling: ReadonlyArray<HumanPrincipal>, grantId = IDS.grantM, authoritySnapshotRef = AUTHORITY_REF('a1'), worldId: SharedWorldId = WORLD): StandingContextGrantResolution =>
  ({ state: 'FOUND', authoritySnapshotRef, grant: { grantId, worldId, grantor, status: 'ACTIVE', audienceCeiling: ceiling } });
const notFound = (authoritySnapshotRef = AUTHORITY_REF('n0')): StandingContextGrantResolution => ({ state: 'NOT_FOUND', authoritySnapshotRef });
const unresolvedGrant = (failure: StandingContextResolutionFailure = 'LOOKUP_FAILED'): StandingContextGrantResolution => ({ state: 'UNRESOLVED', failure });

type GrantMap = Record<string, StandingContextGrantResolution | Error | undefined>;

describe('SharedEffectiveContextService', () => {
  const worldState = { resolveCurrent: jest.fn<Promise<SharedPreModelWorldStateResolution>, [SharedWorldId]>() };
  const audience = { resolveCurrent: jest.fn<Promise<SharedHumanAudienceResolution>, [SharedWorldId]>() };
  const grants = { resolveCurrent: jest.fn<Promise<StandingContextGrantResolution>, [SharedWorldId, HumanPrincipal]>() };
  const service = new SharedEffectiveContextService(
    worldState as unknown as SharedPreModelWorldStateResolverService,
    audience as unknown as SharedHumanAudienceResolverService,
    grants as unknown as StandingContextGrantResolverService,
  );
  const grantsByOwner = (map: GrantMap) => grants.resolveCurrent.mockImplementation(async (_world, grantor) => {
    const resolution = map[grantor.humanId];
    if (resolution instanceof Error) throw resolution;
    return resolution ?? notFound();
  });
  const resolve = (candidates: ReadonlyArray<SharedPrivateContextCandidate>, worldId: SharedWorldId = WORLD) => service.resolve(worldId, candidates);
  const ready = async (candidates: ReadonlyArray<SharedPrivateContextCandidate>, worldId: SharedWorldId = WORLD) => {
    const resolution = await resolve(candidates, worldId);
    if (resolution.state !== 'READY') throw new Error(`expected READY, got ${resolution.state} / ${resolution.reason}`);
    return resolution.effectiveContext;
  };
  const admittedIds = async (candidates: ReadonlyArray<SharedPrivateContextCandidate>) => (await ready(candidates)).privateReasoningContexts.map((item) => item.source.contextId);

  beforeEach(() => {
    jest.resetAllMocks();
    worldState.resolveCurrent.mockResolvedValue(worldResolved());
    audience.resolveCurrent.mockResolvedValue(audienceOf([MOHAMED, HADIR]));
    grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR]), [IDS.hadir]: notFound() });
  });

  describe('global gates (task §19-§22, §42.1-7)', () => {
    it('1. a malformed candidate set is UNRESOLVED / MALFORMED_CANDIDATE_SET before any resolver is called', async () => {
      for (const candidates of [undefined, null, 'candidates', {}, [null], ['context'], [{ kind: 'SHARED_MATERIAL', contextId: 'c1', originWorld: myWorld(MOHAMED), availability: 'AVAILABLE', reasoningContent: 'x' }]]) {
        expect(await resolve(candidates as never)).toEqual({ state: 'UNRESOLVED', reason: 'MALFORMED_CANDIDATE_SET' });
      }
      expect(worldState.resolveCurrent).not.toHaveBeenCalled();
      expect(audience.resolveCurrent).not.toHaveBeenCalled();
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('2. an UNRESOLVED or malformed World state is UNRESOLVED / WORLD_STATE_UNRESOLVED and neither audience nor grants are called', async () => {
      const candidates = [available(MOHAMED, 'c1', 'private')];
      for (const failure of SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES) {
        worldState.resolveCurrent.mockResolvedValueOnce({ state: 'UNRESOLVED', failure });
        expect(await resolve(candidates)).toEqual({ state: 'UNRESOLVED', reason: 'WORLD_STATE_UNRESOLVED' });
      }
      for (const malformed of [undefined, null, {}, { state: 'RESOLVED' }, worldResolved('ACTIVE', 'STANDARD', OTHER_WORLD), { state: 'RESOLVED', snapshot: { ...snapshotOf(worldResolved()), lifecycle: 'DORMANT' } }, { state: 'RESOLVED', snapshot: { ...snapshotOf(worldResolved()), snapshotRef: '' } }, { state: 'NOT_FOUND' }]) {
        worldState.resolveCurrent.mockResolvedValueOnce(malformed as never);
        expect(await resolve(candidates)).toEqual({ state: 'UNRESOLVED', reason: 'WORLD_STATE_UNRESOLVED' });
      }
      expect(worldState.resolveCurrent).toHaveBeenCalledTimes(SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES.length + 8);
      expect(audience.resolveCurrent).not.toHaveBeenCalled();
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('3. READ_ONLY_CLOSED (either phase) is BLOCKED / WORLD_READ_ONLY_CLOSED: known state, not UNRESOLVED, and neither audience nor grants are called', async () => {
      for (const phase of ['STANDARD', 'INTRODUCTION'] as const) {
        worldState.resolveCurrent.mockResolvedValueOnce(worldResolved('READ_ONLY_CLOSED', phase));
        const resolution = await resolve([available(MOHAMED, 'c1', 'private')]);
        expect(resolution).toEqual({ state: 'BLOCKED', reason: 'WORLD_READ_ONLY_CLOSED' });
        expect(Object.isFrozen(resolution)).toBe(true);
      }
      expect(audience.resolveCurrent).not.toHaveBeenCalled();
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('4. ACTIVE / STANDARD proceeds to READY', async () => {
      const effectiveContext = await ready([available(MOHAMED, 'c1', 'private')]);
      expect(effectiveContext.worldStateSnapshotRef).toBe(snapshotOf(worldResolved('ACTIVE', 'STANDARD')).snapshotRef);
      expect(effectiveContext.privateReasoningContexts).toHaveLength(1);
    });

    it('5. ACTIVE / INTRODUCTION proceeds with exactly the same admission: Introduction creates no extra privacy authority', async () => {
      const candidates = [available(MOHAMED, 'c1', 'private'), available(HADIR, 'c2', 'no grant')];
      const standard = await ready(candidates);
      worldState.resolveCurrent.mockResolvedValue(worldResolved('ACTIVE', 'INTRODUCTION'));
      const introduction = await ready(candidates);
      expect(introduction.privateReasoningContexts).toEqual(standard.privateReasoningContexts);
      expect(introduction.privateReasoningContexts.map((item) => item.source.contextId)).toEqual(['c1']);
      expect(introduction.worldStateSnapshotRef).not.toBe(standard.worldStateSnapshotRef);
      expect(introduction.effectiveContextRef).not.toBe(standard.effectiveContextRef);
    });

    it('6. an UNRESOLVED or malformed audience is UNRESOLVED / AUDIENCE_UNRESOLVED and grants are not called', async () => {
      const candidates = [available(MOHAMED, 'c1', 'private')];
      for (const failure of ['LOOKUP_FAILED', 'LOOKUP_TIMED_OUT', 'AUDIENCE_SNAPSHOT_UNAVAILABLE', 'CONTRADICTORY_CANONICAL_STATE'] as const) {
        audience.resolveCurrent.mockResolvedValueOnce({ state: 'UNRESOLVED', failure });
        expect(await resolve(candidates)).toEqual({ state: 'UNRESOLVED', reason: 'AUDIENCE_UNRESOLVED' });
      }
      for (const malformed of [undefined, null, {}, { state: 'RESOLVED' }, audienceOf([MOHAMED, HADIR], ''), audienceOf([], AUTHORITY_REF('x')), audienceOf([MOHAMED, MOHAMED], AUTHORITY_REF('d')), audienceOf([MOHAMED, QANDEEL_SYSTEM_ACTOR as never], AUTHORITY_REF('q'))]) {
        audience.resolveCurrent.mockResolvedValueOnce(malformed as never);
        expect(await resolve(candidates)).toEqual({ state: 'UNRESOLVED', reason: 'AUDIENCE_UNRESOLVED' });
      }
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('7. an EMPTY audience is BLOCKED / NO_ACTIVE_HUMANS: no grant lookup, no EffectiveContext, no empty-set approval', async () => {
      audience.resolveCurrent.mockResolvedValue(AUDIENCE_EMPTY);
      const resolution = await resolve([available(MOHAMED, 'c1', 'private')]);
      expect(resolution).toEqual({ state: 'BLOCKED', reason: 'NO_ACTIVE_HUMANS' });
      expect(resolution.state).not.toBe('UNRESOLVED');
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
      expect(await resolve([])).toEqual({ state: 'BLOCKED', reason: 'NO_ACTIVE_HUMANS' });
    });

    it('keeps BLOCKED and UNRESOLVED distinct vocabularies', () => {
      expect([...SHARED_EFFECTIVE_CONTEXT_BLOCK_REASONS]).toEqual(['WORLD_READ_ONLY_CLOSED', 'NO_ACTIVE_HUMANS']);
      expect([...SHARED_EFFECTIVE_CONTEXT_UNRESOLVED_REASONS]).toEqual(['WORLD_STATE_UNRESOLVED', 'AUDIENCE_UNRESOLVED', 'MALFORMED_CANDIDATE_SET']);
    });
  });

  describe('source availability (task §15, §42.8-12)', () => {
    it('8. a DELETED_BY_OWNER candidate is excluded even though its owner holds a sufficient grant', async () => {
      expect(await admittedIds([unavailable(MOHAMED, 'deleted', 'DELETED_BY_OWNER'), available(MOHAMED, 'live', 'private')])).toEqual(['live']);
    });

    it('9. an UNAVAILABLE candidate is excluded even though its owner holds a sufficient grant', async () => {
      expect(await admittedIds([unavailable(MOHAMED, 'gone', 'UNAVAILABLE'), available(MOHAMED, 'live', 'private')])).toEqual(['live']);
    });

    it('10. an unavailable or deleted candidate that still carries content fails the WHOLE set closed as malformed', async () => {
      for (const availability of ['DELETED_BY_OWNER', 'UNAVAILABLE'] as const) {
        for (const reasoningContent of ['leaked', '', undefined]) {
          const contradiction = { ...unavailable(MOHAMED, 'x', availability), reasoningContent } as unknown as SharedPrivateContextCandidate;
          expect(await resolve([available(MOHAMED, 'live', 'private'), contradiction])).toEqual({ state: 'UNRESOLVED', reason: 'MALFORMED_CANDIDATE_SET' });
        }
      }
      // Any other content-bearing property on an unavailable candidate is equally malformed.
      expect(await resolve([{ ...unavailable(MOHAMED, 'x', 'DELETED_BY_OWNER'), content: 'leaked' } as unknown as SharedPrivateContextCandidate])).toEqual({ state: 'UNRESOLVED', reason: 'MALFORMED_CANDIDATE_SET' });
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
      // @ts-expect-error an unavailable candidate cannot carry reasoning content by type.
      const typed: UnavailableSharedPrivateContextCandidate = { ...unavailable(MOHAMED, 'x', 'UNAVAILABLE'), reasoningContent: 'leaked' };
      expect(typed.availability).toBe('UNAVAILABLE');
    });

    it('11. unavailable candidates cause zero grant lookups', async () => {
      const effectiveContext = await ready([unavailable(MOHAMED, 'a', 'DELETED_BY_OWNER'), unavailable(HADIR, 'b', 'UNAVAILABLE'), unavailable(OMAR, 'c', 'DELETED_BY_OWNER')]);
      expect(effectiveContext.privateReasoningContexts).toEqual([]);
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('12. a deleted / unavailable payload never appears in a READY result or its fingerprint', async () => {
      const withUnavailable = await ready([available(MOHAMED, 'live', 'private'), unavailable(MOHAMED, 'DELETED-CONTEXT-ID', 'DELETED_BY_OWNER'), unavailable(HADIR, 'UNAVAILABLE-CONTEXT-ID', 'UNAVAILABLE')]);
      const without = await ready([available(MOHAMED, 'live', 'private')]);
      expect(JSON.stringify(withUnavailable)).not.toMatch(/DELETED-CONTEXT-ID|UNAVAILABLE-CONTEXT-ID|DELETED_BY_OWNER|UNAVAILABLE/u);
      expect(withUnavailable.effectiveContextRef).toBe(without.effectiveContextRef);
      expect(withUnavailable).toEqual(without);
    });
  });

  describe('candidate validation (task §13-§14, §42.13-18)', () => {
    const malformed = { state: 'UNRESOLVED', reason: 'MALFORMED_CANDIDATE_SET' };
    const withOrigin = (originWorld: unknown) => ({ ...available(MOHAMED, 'c1', 'private'), originWorld }) as unknown as SharedPrivateContextCandidate;

    it('13. a Shared or Public origin is rejected: only MY_WORLD private context can be a candidate', async () => {
      expect(await resolve([withOrigin({ architectureClass: 'WORLD', worldType: 'SHARED_WORLD', worldId: WORLD })])).toEqual(malformed);
      expect(await resolve([withOrigin({ architectureClass: 'WORLD', worldType: 'PUBLIC_WORLD' })])).toEqual(malformed);
      expect(await resolve([withOrigin({ architectureClass: 'WORLD', worldType: 'MATCHING', owner: MOHAMED })])).toEqual(malformed);
      expect(await resolve([withOrigin({ architectureClass: 'CAPABILITY', worldType: 'MY_WORLD', owner: MOHAMED })])).toEqual(malformed);
      expect(await resolve([withOrigin({ ...myWorld(MOHAMED), worldId: WORLD })])).toEqual(malformed);
      expect(await resolve([withOrigin(undefined)])).toEqual(malformed);
      expect(worldState.resolveCurrent).not.toHaveBeenCalled();
    });

    it('14. a non-human owner is rejected: QANDEEL, a blank human, a bare string or an owner with extra properties', async () => {
      for (const owner of [QANDEEL_SYSTEM_ACTOR, human(''), human('   '), 'human-mohamed', { kind: 'HUMAN' }, { kind: 'SYSTEM', humanId: IDS.mohamed }, { ...MOHAMED, role: 'admin' }, null]) {
        expect(await resolve([withOrigin({ architectureClass: 'WORLD', worldType: 'MY_WORLD', owner })])).toEqual(malformed);
      }
    });

    it('15. a blank or non-string contextId is rejected', async () => {
      for (const contextId of ['', '   ', 42, null, undefined, ['c1']]) {
        expect(await resolve([{ ...available(MOHAMED, 'c1', 'private'), contextId } as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
      }
    });

    it('16. the same owner offering the same contextId twice is contradictory, whatever the availability', async () => {
      expect(await resolve([available(MOHAMED, 'c1', 'first'), available(MOHAMED, 'c1', 'second')])).toEqual(malformed);
      expect(await resolve([available(MOHAMED, 'c1', 'first'), unavailable(MOHAMED, 'c1', 'DELETED_BY_OWNER')])).toEqual(malformed);
      expect(await resolve([unavailable(MOHAMED, 'c1', 'UNAVAILABLE'), unavailable(MOHAMED, 'c1', 'DELETED_BY_OWNER')])).toEqual(malformed);
      expect(worldState.resolveCurrent).not.toHaveBeenCalled();
    });

    it('17. different owners may reuse the same opaque contextId: they are two sources', async () => {
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR], IDS.grantM), [IDS.hadir]: found(HADIR, [MOHAMED, HADIR], IDS.grantA, AUTHORITY_REF('h1')) });
      const effectiveContext = await ready([available(MOHAMED, 'shared-id', 'mohamed private'), available(HADIR, 'shared-id', 'hadir private')]);
      expect(effectiveContext.privateReasoningContexts.map((item) => [item.source.contextId, item.source.originWorld.owner.humanId, item.reasoningContent]))
        .toEqual([['shared-id', IDS.mohamed, 'mohamed private'], ['shared-id', IDS.hadir, 'hadir private']]);
    });

    it('18. a malformed availability, kind, missing property or extra property is rejected', async () => {
      for (const availability of ['ARCHIVED', 'available', 'MATERIAL_AVAILABLE', undefined, null, true]) {
        expect(await resolve([{ ...available(MOHAMED, 'c1', 'private'), availability } as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
      }
      expect(await resolve([{ ...available(MOHAMED, 'c1', 'private'), kind: 'SHARED_MATERIAL' } as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
      expect(await resolve([{ ...available(MOHAMED, 'c1', 'private'), disclosureAllowed: true } as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
      expect(await resolve([{ ...available(MOHAMED, 'c1', 'private'), materialId: 'm1' } as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
      expect(await resolve([{ ...available(MOHAMED, 'c1', 'private'), reasoningContent: 42 } as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
      const withoutContent: Record<string, unknown> = { ...available(MOHAMED, 'c1', 'private') };
      delete withoutContent.reasoningContent;
      expect(await resolve([withoutContent as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
      const withoutKind: Record<string, unknown> = { ...available(MOHAMED, 'c1', 'private') };
      delete withoutKind.kind;
      expect(await resolve([withoutKind as unknown as SharedPrivateContextCandidate])).toEqual(malformed);
    });
  });

  describe('grant resolution and I-03A composition (task §23-§26, §34, §42.19-28)', () => {
    it('19. one owner with a FOUND sufficient grant is admitted with the exact I-03A ALLOW bound to this World, owner, grant and audience snapshot', async () => {
      const effectiveContext = await ready([available(MOHAMED, 'c1', 'private')]);
      expect(effectiveContext.privateReasoningContexts).toHaveLength(1);
      const [item] = effectiveContext.privateReasoningContexts;
      expect(item.authority.decision).toBe('ALLOW');
      expect(item.authority.externalEffect).toBe('ADMIT_FOR_REASONING_ONLY');
      expect(item.authority.binding).toEqual({
        action: 'REASON_FROM_PRIVATE_CONTEXT',
        grantorHumanId: IDS.mohamed,
        targetWorldId: WORLD,
        purpose: 'SHARED_REASONING',
        audienceHumanIds: [IDS.mohamed, IDS.hadir],
        grantId: IDS.grantM,
        authoritySnapshotRef: AUTHORITY_REF('a1'),
        audienceSnapshotRef: effectiveContext.audienceSnapshot.snapshotRef,
      });
      expect(grants.resolveCurrent).toHaveBeenCalledWith(WORLD, MOHAMED);
    });

    it("20. NOT_FOUND excludes that owner's items (I-03A DENY)", async () => {
      grantsByOwner({ [IDS.mohamed]: notFound() });
      expect(await admittedIds([available(MOHAMED, 'c1', 'private')])).toEqual([]);
    });

    it("21. UNRESOLVED excludes that owner's items for every failure class (I-03A UNKNOWN)", async () => {
      for (const failure of STANDING_CONTEXT_RESOLUTION_FAILURES) {
        grantsByOwner({ [IDS.mohamed]: unresolvedGrant(failure) });
        expect(await admittedIds([available(MOHAMED, 'c1', 'private')])).toEqual([]);
      }
    });

    it('22. an audience that exceeds the grant ceiling excludes the item: membership expansion never widens private-context authority', async () => {
      audience.resolveCurrent.mockResolvedValue(audienceOf([MOHAMED, HADIR, AHMED]));
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR]) });
      expect(await admittedIds([available(MOHAMED, 'c1', 'private')])).toEqual([]);
      // Only an explicitly reconfirmed grant with the wider ceiling admits it again.
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR, AHMED], IDS.grantM2, AUTHORITY_REF('a2')) });
      expect(await admittedIds([available(MOHAMED, 'c1', 'private')])).toEqual(['c1']);
    });

    it("23. a malformed dependency result - another World's grant, another grantor's grant, a revoked grant, a garbage resolution - is excluded by I-03A", async () => {
      const candidates = [available(MOHAMED, 'c1', 'private')];
      for (const resolution of [
        found(MOHAMED, [MOHAMED, HADIR], IDS.grantM, AUTHORITY_REF('a1'), OTHER_WORLD),
        found(HADIR, [MOHAMED, HADIR]),
        { ...found(MOHAMED, [MOHAMED, HADIR]), grant: { ...grantOf(found(MOHAMED, [MOHAMED, HADIR])), status: 'REVOKED' } },
        { ...found(MOHAMED, [MOHAMED, HADIR]), grant: { ...grantOf(found(MOHAMED, [MOHAMED, HADIR])), materialDisclosureAllowed: true } },
        { state: 'FOUND', authoritySnapshotRef: '', grant: grantOf(found(MOHAMED, [MOHAMED, HADIR])) },
        { state: 'ALLOWED' }, undefined, null, 'FOUND',
      ]) {
        grantsByOwner({ [IDS.mohamed]: resolution as never });
        expect(await admittedIds(candidates)).toEqual([]);
      }
    });

    it("24. grants are never unioned: Ahmed's wider ceiling never covers Mohamed's item", async () => {
      audience.resolveCurrent.mockResolvedValue(audienceOf([MOHAMED, HADIR, AHMED]));
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR]), [IDS.ahmed]: found(AHMED, [MOHAMED, HADIR, AHMED], IDS.grantA, AUTHORITY_REF('ah')) });
      const effectiveContext = await ready([available(MOHAMED, 'm1', 'mohamed'), available(AHMED, 'a1', 'ahmed')]);
      expect(effectiveContext.privateReasoningContexts.map((item) => item.source.contextId)).toEqual(['a1']);
      expect(effectiveContext.privateReasoningContexts[0].authority.binding.grantorHumanId).toBe(IDS.ahmed);
      expect(effectiveContext.privateReasoningContexts[0].authority.binding.grantId).toBe(IDS.grantA);
    });

    it('25. two owners are evaluated independently, each against its own resolved grant', async () => {
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR]), [IDS.hadir]: notFound() });
      expect(await admittedIds([available(MOHAMED, 'm1', 'x'), available(HADIR, 'h1', 'y'), available(MOHAMED, 'm2', 'z')])).toEqual(['m1', 'm2']);
      expect(grants.resolveCurrent).toHaveBeenCalledTimes(2);
      expect(grants.resolveCurrent).toHaveBeenCalledWith(WORLD, MOHAMED);
      expect(grants.resolveCurrent).toHaveBeenCalledWith(WORLD, HADIR);
      // Each lookup names exactly the candidate owner as grantor: never QANDEEL, never a client-supplied claim.
      for (const [world, grantor] of grants.resolveCurrent.mock.calls) {
        expect(world).toBe(WORLD);
        expect(Object.keys(grantor).sort()).toEqual(['humanId', 'kind']);
        expect(grantor.kind).toBe('HUMAN');
      }
    });

    it('26. the same owner with several candidates triggers exactly one grant resolution and one authority snapshot', async () => {
      const effectiveContext = await ready([available(MOHAMED, 'c1', 'a'), available(MOHAMED, 'c2', 'b'), available(MOHAMED, 'c3', 'c')]);
      expect(grants.resolveCurrent).toHaveBeenCalledTimes(1);
      expect(new Set(effectiveContext.privateReasoningContexts.map((item) => item.authority.binding.authoritySnapshotRef)).size).toBe(1);
      expect(new Set(effectiveContext.privateReasoningContexts.map((item) => item.authority.binding.grantId)).size).toBe(1);
      expect(effectiveContext.privateReasoningContexts).toHaveLength(3);
    });

    it("27. an unexpected grant-resolver throw excludes that owner's items, admits nothing for them and leaks no exception text", async () => {
      grantsByOwner({ [IDS.mohamed]: new Error('raw grant resolver crash SENTINEL_STACK') });
      const resolution = await resolve([available(MOHAMED, 'c1', 'private')]);
      expect(resolution.state).toBe('READY');
      if (resolution.state !== 'READY') throw new Error('unreachable');
      expect(resolution.effectiveContext.privateReasoningContexts).toEqual([]);
      expect(JSON.stringify(resolution)).not.toMatch(/SENTINEL_STACK|crash|Error/u);
    });

    it("28. another owner's safe item is still admitted beside a throwing owner", async () => {
      grantsByOwner({ [IDS.mohamed]: new Error('crash SENTINEL_STACK'), [IDS.hadir]: found(HADIR, [MOHAMED, HADIR], IDS.grantA, AUTHORITY_REF('h1')) });
      const effectiveContext = await ready([available(MOHAMED, 'm1', 'x'), available(HADIR, 'h1', 'y')]);
      expect(effectiveContext.privateReasoningContexts.map((item) => item.source.contextId)).toEqual(['h1']);
      expect(JSON.stringify(effectiveContext)).not.toMatch(/SENTINEL_STACK/u);
    });

    it('does not invent a grantor-in-audience rule: a departed owner with a valid current grant for exactly this audience is admitted (task §25)', async () => {
      // Omar is not in the current audience {Mohamed, Hadir}; his grant's ceiling covers exactly that audience.
      grantsByOwner({ [IDS.omar]: found(OMAR, [MOHAMED, HADIR], IDS.grantO, AUTHORITY_REF('o1')) });
      expect(await admittedIds([available(OMAR, 'o1', 'omar private')])).toEqual(['o1']);
      // And an owner inside the audience with no grant is still excluded: membership is not authority.
      grantsByOwner({ [IDS.hadir]: notFound() });
      expect(await admittedIds([available(HADIR, 'h1', 'hadir private')])).toEqual([]);
    });
  });

  describe('exact constraints (task §26-§27, §36, §42.29-35)', () => {
    it('29-33. an admitted item carries the exact I-03A ALLOW constraints: reasoning-only, no direct or material disclosure, sealed provenance, delivery requires revalidation', async () => {
      const [item] = (await ready([available(MOHAMED, 'c1', 'private')])).privateReasoningContexts;
      expect(item.authority.constraints).toEqual(EXPECTED_CONSTRAINTS);
      expect(item.authority.constraints.contextClassification).toBe('PRIVATE_REASONING_ONLY_CONTEXT');
      expect(item.authority.constraints.reasoningAuthority).toBe('ALLOW');
      expect(item.authority.constraints.materialDisclosureAuthority).toBe('NOT_GRANTED');
      expect(item.authority.constraints.directPrivateDisclosureAuthority).toBe('NOT_GRANTED');
      expect(item.authority.constraints.provenanceDisclosure).toBe('SEALED');
      expect(item.authority.constraints.deliveryAuthority).toBe('REQUIRES_REVALIDATION');
      expect(Object.keys(item.authority).sort()).toEqual(['binding', 'constraints', 'decision', 'externalEffect']);
      expect('allowed' in item.authority).toBe(false);
      expect(Object.isFrozen(item)).toBe(true);
      expect(Object.isFrozen(item.authority)).toBe(true);
      const literals = JSON.stringify(item);
      for (const forbidden of ['"GRANTED"', '"DISCLOSED"', '"ALLOWED"', 'DISCLOSE_PRIVATE_FACT', 'MATERIAL_TRANSFER', 'materialDisclosureAllowed', 'publishAllowed', 'deliveryAllowed', 'historyAccess', 'replayAllowed', 'matchingAllowed', 'publicAllowed']) {
        expect(literals).not.toContain(forbidden);
      }
    });

    it('34. content is byte-identical to the candidate input, and the digest is SHA-256 over its exact UTF-8 bytes', async () => {
      const content = '  مرحبا\n"quoted" <tag> & emoji 🌙 ​ trailing  ';
      const [item] = (await ready([available(MOHAMED, 'c1', content)])).privateReasoningContexts;
      expect(item.reasoningContent).toBe(content);
      expect(item.reasoningContent.length).toBe(content.length);
      expect(item.contentDigest).toBe(`sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`);
      expect(digestReasoningContent(content)).toBe(item.contentDigest);
      expect(digestReasoningContent('')).toMatch(/^sha256:[0-9a-f]{64}$/u);
      // The digest is not the content and the content is not summarized, rewritten or quoted.
      expect(item.contentDigest).not.toContain('مرحبا');
    });

    it('35. the source is a SourceContextRef to the MY_WORLD source, never Shared material, never a provenance record', async () => {
      const [item] = (await ready([available(MOHAMED, 'ctx-7', 'private')])).privateReasoningContexts;
      expect(item.kind).toBe('AUTHORIZED_PRIVATE_REASONING_CONTEXT');
      expect(item.source).toEqual({ contextId: 'ctx-7', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED } });
      expect(Object.keys(item.source).sort()).toEqual(['contextId', 'originWorld']);
      expect('materialId' in item.source).toBe(false);
      expect(Object.keys(item).sort()).toEqual(['authority', 'contentDigest', 'kind', 'reasoningContent', 'source']);
      expect(JSON.stringify(item)).not.toMatch(/MATERIAL_DEPENDENCY|REASONING_DEPENDENCY|INDEPENDENT_TARGET_TRUTH|SHARED_WORLD|PUBLIC_WORLD|"target"/u);
    });
  });

  describe('determinism and fingerprint (task §17, §31-§35, §42.36-47)', () => {
    const c1 = available(MOHAMED, 'z-first', 'alpha');
    const c2 = available(HADIR, 'excluded', 'beta');
    const c3 = available(MOHAMED, 'a-second', 'gamma');
    const c4 = available(AHMED, 'm-third', 'delta');
    beforeEach(() => {
      audience.resolveCurrent.mockResolvedValue(audienceOf([MOHAMED, HADIR, AHMED]));
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR, AHMED]), [IDS.hadir]: notFound(), [IDS.ahmed]: found(AHMED, [MOHAMED, HADIR, AHMED], IDS.grantA, AUTHORITY_REF('ah')) });
    });

    it('36. candidate order is preserved after exclusions: never reordered by owner, grant or context id', async () => {
      expect(await admittedIds([c1, c2, c3, c4])).toEqual(['z-first', 'a-second', 'm-third']);
      expect(await admittedIds([c4, c3, c2, c1])).toEqual(['m-third', 'a-second', 'z-first']);
    });

    it('37-38. no candidate is duplicated and the admitted count never exceeds the offered count', async () => {
      for (const offered of [[], [c1], [c1, c2], [c1, c2, c3, c4], [c2, unavailable(OMAR, 'u', 'UNAVAILABLE')], [c4, c1, c3]]) {
        const ids = await admittedIds(offered);
        expect(ids.length).toBeLessThanOrEqual(offered.length);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id) => offered.some((candidate) => candidate.contextId === id))).toBe(true);
      }
    });

    it('39. the content digest changes with content', async () => {
      const [before] = (await ready([available(MOHAMED, 'c1', 'alpha')])).privateReasoningContexts;
      const [after] = (await ready([available(MOHAMED, 'c1', 'alpha ')])).privateReasoningContexts;
      expect(before.contentDigest).not.toBe(after.contentDigest);
    });

    it('40. the EffectiveContext reference is stable for exactly the same facts', async () => {
      const first = await ready([c1, c2, c3, c4]);
      const second = await ready([c1, c2, c3, c4]);
      expect(second).toEqual(first);
      expect(second.effectiveContextRef).toBe(first.effectiveContextRef);
      expect(first.effectiveContextRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.privateReasoningContexts)).toBe(true);
    });

    it('41. the reference changes with the World-state snapshot', async () => {
      const standard = await ready([c1]);
      worldState.resolveCurrent.mockResolvedValue(worldResolved('ACTIVE', 'INTRODUCTION'));
      const introduction = await ready([c1]);
      expect(introduction.privateReasoningContexts).toEqual(standard.privateReasoningContexts);
      expect(introduction.effectiveContextRef).not.toBe(standard.effectiveContextRef);
    });

    it('42. the reference changes with the audience snapshot even when the human set is identical (leave / rejoin), and every item binds that same snapshot', async () => {
      const s1 = await ready([c1, c4]);
      audience.resolveCurrent.mockResolvedValue(audienceOf([MOHAMED, HADIR, AHMED], audienceRef([[MOHAMED, IDS.e1], [HADIR, IDS.e3], [AHMED, IDS.e2]])));
      const s2 = await ready([c1, c4]);
      expect(s2.audienceSnapshot.humans).toEqual(s1.audienceSnapshot.humans);
      expect(s2.audienceSnapshot.snapshotRef).not.toBe(s1.audienceSnapshot.snapshotRef);
      expect(s2.effectiveContextRef).not.toBe(s1.effectiveContextRef);
      for (const context of [s1, s2]) {
        expect(new Set(context.privateReasoningContexts.map((item) => item.authority.binding.audienceSnapshotRef))).toEqual(new Set([context.audienceSnapshot.snapshotRef]));
        expect(new Set(context.privateReasoningContexts.map((item) => item.authority.binding.targetWorldId))).toEqual(new Set([WORLD]));
      }
    });

    it('43. the reference changes with the authority snapshot or the grant identity', async () => {
      const base = await ready([c1]);
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR, AHMED], IDS.grantM, AUTHORITY_REF('a9')) });
      const otherSnapshot = await ready([c1]);
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR, AHMED], IDS.grantM2, AUTHORITY_REF('a1')) });
      const otherGrant = await ready([c1]);
      expect(new Set([base.effectiveContextRef, otherSnapshot.effectiveContextRef, otherGrant.effectiveContextRef]).size).toBe(3);
    });

    it('44-46. the reference changes with the source context id, with the content and with the admitted order', async () => {
      const base = await ready([c1, c4]);
      const otherId = await ready([available(MOHAMED, 'z-first-2', 'alpha'), c4]);
      const otherContent = await ready([available(MOHAMED, 'z-first', 'alpha!'), c4]);
      const otherOrder = await ready([c4, c1]);
      const oneFewer = await ready([c1]);
      expect(new Set([base, otherId, otherContent, otherOrder, oneFewer].map((context) => context.effectiveContextRef)).size).toBe(5);
    });

    it('47. the canonical fingerprint representation binds World, World state, audience and every item without clock, random, secret or raw content', async () => {
      const effectiveContext = await ready([c1, c4]);
      const items = effectiveContext.privateReasoningContexts.map((item) => ({
        ownerHumanId: item.source.originWorld.owner.humanId,
        contextId: item.source.contextId,
        contentDigest: item.contentDigest,
        grantId: item.authority.binding.grantId,
        authoritySnapshotRef: item.authority.binding.authoritySnapshotRef,
      }));
      const lines = [
        SHARED_EFFECTIVE_CONTEXT_VERSION,
        `world=${IDS.world}`,
        `worldState=${effectiveContext.worldStateSnapshotRef}`,
        `audience=${effectiveContext.audienceSnapshot.snapshotRef}`,
        'items=2',
        JSON.stringify([0, IDS.mohamed, 'z-first', digestReasoningContent('alpha'), IDS.grantM, AUTHORITY_REF('a1')]),
        JSON.stringify([1, IDS.ahmed, 'm-third', digestReasoningContent('delta'), IDS.grantA, AUTHORITY_REF('ah')]),
      ];
      expect(SHARED_EFFECTIVE_CONTEXT_VERSION).toBe('QANDEEL_CWV2_SHARED_EFFECTIVE_CONTEXT_V1');
      expect(effectiveContext.effectiveContextRef).toBe(`sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`);
      expect(fingerprintSharedEffectiveContext({ worldId: IDS.world.toUpperCase(), worldStateSnapshotRef: effectiveContext.worldStateSnapshotRef, audienceSnapshotRef: effectiveContext.audienceSnapshot.snapshotRef, items }))
        .toBe(effectiveContext.effectiveContextRef);
      expect(lines.join('\n')).not.toMatch(/alpha|delta/u);
      // A context id containing the line separator cannot collide with two items.
      const spliced = fingerprintSharedEffectiveContext({ worldId: IDS.world, worldStateSnapshotRef: 'w', audienceSnapshotRef: 'a', items: [{ ...items[0], contextId: 'x\n[1,"y"]' }] });
      const two = fingerprintSharedEffectiveContext({ worldId: IDS.world, worldStateSnapshotRef: 'w', audienceSnapshotRef: 'a', items: [{ ...items[0], contextId: 'x' }, { ...items[0], contextId: 'y' }] });
      expect(spliced).not.toBe(two);
    });
  });

  describe('empty authorized envelope (task §30, §42.48-51)', () => {
    const expectEmptyReady = async (candidates: ReadonlyArray<SharedPrivateContextCandidate>) => {
      const resolution = await resolve(candidates);
      expect(resolution.state).toBe('READY');
      if (resolution.state !== 'READY') throw new Error('unreachable');
      expect(resolution.effectiveContext.privateReasoningContexts).toEqual([]);
      expect(resolution.effectiveContext.targetWorldId).toBe(WORLD);
      expect(resolution.effectiveContext.audienceSnapshot.humans).toEqual([MOHAMED, HADIR]);
      expect(resolution.effectiveContext.effectiveContextRef).toBe(fingerprintSharedEffectiveContext({ worldId: IDS.world, worldStateSnapshotRef: resolution.effectiveContext.worldStateSnapshotRef, audienceSnapshotRef: resolution.effectiveContext.audienceSnapshot.snapshotRef, items: [] }));
      return resolution.effectiveContext;
    };

    it('48. no candidates -> READY with an empty private list and no grant lookup', async () => {
      await expectEmptyReady([]);
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('49. every candidate denied -> READY with an empty private list', async () => {
      grantsByOwner({ [IDS.mohamed]: notFound(), [IDS.hadir]: notFound() });
      await expectEmptyReady([available(MOHAMED, 'm1', 'x'), available(HADIR, 'h1', 'y')]);
    });

    it('50. every candidate unavailable -> READY with an empty private list and no grant lookup', async () => {
      await expectEmptyReady([unavailable(MOHAMED, 'm1', 'DELETED_BY_OWNER'), unavailable(HADIR, 'h1', 'UNAVAILABLE')]);
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('51. every grant resolution unresolved -> READY with an empty private list, never a global failure', async () => {
      grantsByOwner({ [IDS.mohamed]: unresolvedGrant('LOOKUP_TIMED_OUT'), [IDS.hadir]: unresolvedGrant('AUTHORITY_SNAPSHOT_UNAVAILABLE') });
      await expectEmptyReady([available(MOHAMED, 'm1', 'x'), available(HADIR, 'h1', 'y')]);
    });
  });

  describe('dependency throws and audit leakage (task §43-§44)', () => {
    it('a throwing World-state resolver is UNRESOLVED / WORLD_STATE_UNRESOLVED with no exception text; audience and grants are not called', async () => {
      worldState.resolveCurrent.mockRejectedValue(new Error('world-state crash SENTINEL_STACK'));
      const resolution = await resolve([available(MOHAMED, 'c1', 'private')]);
      expect(resolution).toEqual({ state: 'UNRESOLVED', reason: 'WORLD_STATE_UNRESOLVED' });
      expect(JSON.stringify(resolution)).not.toMatch(/SENTINEL_STACK/u);
      expect(audience.resolveCurrent).not.toHaveBeenCalled();
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('a throwing audience resolver is UNRESOLVED / AUDIENCE_UNRESOLVED with no exception text; grants are not called', async () => {
      audience.resolveCurrent.mockRejectedValue(new Error('audience crash SENTINEL_STACK'));
      const resolution = await resolve([available(MOHAMED, 'c1', 'private')]);
      expect(resolution).toEqual({ state: 'UNRESOLVED', reason: 'AUDIENCE_UNRESOLVED' });
      expect(JSON.stringify(resolution)).not.toMatch(/SENTINEL_STACK/u);
      expect(grants.resolveCurrent).not.toHaveBeenCalled();
    });

    it('the production result carries no per-owner DENY / UNKNOWN detail and no excluded owner identity', async () => {
      grantsByOwner({ [IDS.mohamed]: found(MOHAMED, [MOHAMED, HADIR]), [IDS.omar]: notFound(), [IDS.ahmed]: unresolvedGrant() });
      const resolution = await resolve([available(MOHAMED, 'm1', 'x'), available(OMAR, 'o1', 'omar private'), available(AHMED, 'a1', 'ahmed private')]);
      expect(resolution.state).toBe('READY');
      if (resolution.state !== 'READY') throw new Error('unreachable');
      expect(Object.keys(resolution).sort()).toEqual(['effectiveContext', 'state']);
      expect(Object.keys(resolution.effectiveContext).sort()).toEqual(['audienceSnapshot', 'effectiveContextRef', 'privateReasoningContexts', 'targetWorldId', 'worldStateSnapshotRef']);
      const text = JSON.stringify(resolution);
      expect(text).not.toMatch(/NO_STANDING_CONTEXT_GRANT|GRANT_STATE_UNRESOLVED|DENY|UNKNOWN|excluded|denied|reasons/u);
      // Omar and Ahmed are outside the audience and excluded: nothing identifies them or their private content.
      expect(text).not.toMatch(new RegExp(`${IDS.omar}|${IDS.ahmed}|omar private|ahmed private`, 'u'));
      expect(resolution.effectiveContext.privateReasoningContexts.map((item) => item.source.contextId)).toEqual(['m1']);
    });
  });

  describe('end-to-end through the real I-03E / I-03D / I-03B resolvers over a mocked service-role transport', () => {
    const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    const real = new SharedEffectiveContextService(new SharedPreModelWorldStateResolverService(), new SharedHumanAudienceResolverService(), new StandingContextGrantResolverService());
    const json = (payload: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload } as Response);
    const calls = (): string[] => (fetch as jest.Mock).mock.calls.map((call) => String(call[0]).split('/rpc/')[1]);
    interface Canon { world: { lifecycle: string; phase: string } | 'NONEXISTENT'; members: Array<[string, string]>; grants: Record<string, Array<Record<string, unknown>>> }
    const transport = (canon: Canon) => jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body));
      if (url.endsWith(SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC)) {
        return canon.world === 'NONEXISTENT' ? json({ code: 'P0002', message: 'not a canonical Shared World' }, 400) : json([{ world_id: body.p_world_id, ...canon.world }]);
      }
      if (url.endsWith(SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC)) return json(canon.members.map(([user, episode]) => ({ world_id: body.p_world_id, membership_episode_id: episode, user_id: user })));
      if (url.endsWith(STANDING_CONTEXT_GRANT_RESOLUTION_RPC)) return json(canon.grants[body.p_grantor_user_id] ?? []);
      throw new Error(`unexpected transport call ${url}`);
    });
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://database.invalid';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
    });
    afterEach(() => {
      jest.restoreAllMocks();
      if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
      if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
    });
    const grantRows = (grantId: string, grantor: string, ceiling: string[]) => ceiling.map((audienceUser) => ({ grant_id: grantId, world_id: IDS.world, grantor_user_id: grantor, status: 'ACTIVE', audience_user_id: audienceUser }));

    it('admits exactly the grant-covered private context of an ACTIVE World with one World-state call, one audience call and one grant call per unique owner', async () => {
      transport({ world: { lifecycle: 'ACTIVE', phase: 'STANDARD' }, members: [[IDS.mohamed, IDS.e1], [IDS.hadir, IDS.e2]], grants: { [IDS.mohamed]: grantRows(IDS.grantM, IDS.mohamed, [IDS.mohamed, IDS.hadir]) } });
      const resolution = await real.resolve(WORLD, [available(MOHAMED, 'm1', 'x'), available(HADIR, 'h1', 'y'), available(MOHAMED, 'm2', 'z')]);
      expect(resolution.state).toBe('READY');
      if (resolution.state !== 'READY') throw new Error('unreachable');
      expect(resolution.effectiveContext.privateReasoningContexts.map((item) => item.source.contextId)).toEqual(['m1', 'm2']);
      expect(resolution.effectiveContext.audienceSnapshot.humans).toEqual([MOHAMED, HADIR]);
      expect(resolution.effectiveContext.worldStateSnapshotRef).toBe(fingerprintSharedPreModelWorldState({ worldId: IDS.world, lifecycle: 'ACTIVE', phase: 'STANDARD' }));
      expect(calls().sort()).toEqual([SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC, SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC, STANDING_CONTEXT_GRANT_RESOLUTION_RPC, STANDING_CONTEXT_GRANT_RESOLUTION_RPC].sort());
      expect(JSON.stringify(resolution)).not.toContain('SENTINEL_SERVICE_ROLE');
    });

    it('blocks a READ_ONLY_CLOSED World after exactly one transport call', async () => {
      transport({ world: { lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' }, members: [[IDS.mohamed, IDS.e1]], grants: { [IDS.mohamed]: grantRows(IDS.grantM, IDS.mohamed, [IDS.mohamed]) } });
      expect(await real.resolve(WORLD, [available(MOHAMED, 'm1', 'x')])).toEqual({ state: 'BLOCKED', reason: 'WORLD_READ_ONLY_CLOSED' });
      expect(calls()).toEqual([SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC]);
    });

    it('treats a nonexistent canonical World (bounded P0002) as WORLD_STATE_UNRESOLVED after exactly one transport call, never as closed or empty', async () => {
      transport({ world: 'NONEXISTENT', members: [], grants: {} });
      expect(await real.resolve(WORLD, [available(MOHAMED, 'm1', 'x')])).toEqual({ state: 'UNRESOLVED', reason: 'WORLD_STATE_UNRESOLVED' });
      expect(calls()).toEqual([SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC]);
    });

    it('blocks a zero-active-human World after the World-state and audience calls, with no grant call', async () => {
      transport({ world: { lifecycle: 'ACTIVE', phase: 'STANDARD' }, members: [], grants: { [IDS.mohamed]: grantRows(IDS.grantM, IDS.mohamed, [IDS.mohamed]) } });
      expect(await real.resolve(WORLD, [available(MOHAMED, 'm1', 'x')])).toEqual({ state: 'BLOCKED', reason: 'NO_ACTIVE_HUMANS' });
      expect(calls()).toEqual([SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_RPC, SHARED_HUMAN_AUDIENCE_RESOLUTION_RPC]);
    });

    it("excludes an item whose owner's grant ceiling no longer covers the expanded current audience", async () => {
      transport({ world: { lifecycle: 'ACTIVE', phase: 'INTRODUCTION' }, members: [[IDS.mohamed, IDS.e1], [IDS.hadir, IDS.e2], [IDS.ahmed, IDS.e3]], grants: { [IDS.mohamed]: grantRows(IDS.grantM, IDS.mohamed, [IDS.mohamed, IDS.hadir]) } });
      const resolution = await real.resolve(WORLD, [available(MOHAMED, 'm1', 'x')]);
      expect(resolution.state).toBe('READY');
      if (resolution.state !== 'READY') throw new Error('unreachable');
      expect(resolution.effectiveContext.privateReasoningContexts).toEqual([]);
    });
  });

  describe('scope guard (task §17, §38-§39, §45-§46)', () => {
    const executable = (file: string): string => readFileSync(join(__dirname, file), 'utf8')
      .replace(/\r\n/gu, '\n')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^[ \t]*\/\/.*$/gmu, '')
      .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');
    const imports = (source: string) => [...new Set([...source.matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]))].sort();

    it('contains exactly the three production files and their two specs, with closed import sets', () => {
      expect(readdirSync(__dirname).filter((name) => name.endsWith('.ts')).sort()).toEqual([
        'shared-effective-context.service.spec.ts',
        'shared-effective-context.service.ts',
        'shared-effective-context.types.ts',
        'shared-pre-model-world-state-resolver.service.spec.ts',
        'shared-pre-model-world-state-resolver.service.ts',
      ]);
      expect(imports(executable('shared-effective-context.types.ts'))).toEqual(['../authority/standing-context-authority.types', '../kernel/material.types', '../kernel/shared-world.types', '../kernel/world.types']);
      expect(imports(executable('shared-effective-context.service.ts'))).toEqual([
        '../audience/shared-human-audience-resolution.types', '../audience/shared-human-audience-resolver.service',
        '../authority-resolution/standing-context-grant-resolver.service', '../authority/standing-context-authority', '../authority/standing-context-authority.types',
        '../kernel/material.types', '../kernel/world-invariants', '../kernel/world.types',
        './shared-effective-context.types', './shared-pre-model-world-state-resolver.service', '@nestjs/common', 'node:crypto',
      ]);
      for (const file of ['shared-effective-context.types.ts', 'shared-effective-context.service.ts']) expect(executable(file)).not.toMatch(/\brequire\(|\bimport\(/u);
    });

    it('reaches no model router, context budget, Personal runtime, Shared messaging, history, material, disclosure, delivery, controller, table, clock or random identity', () => {
      for (const file of ['shared-effective-context.types.ts', 'shared-effective-context.service.ts']) {
        const source = executable(file);
        for (const pattern of [
          /model-router|ModelRouter|composeServerGuidance|memoryContext|behavioralGuidance|intelligence-runtime|IntegratedContext|conversation|\bmemory\b|human-model|hypothes|recommendation|question|runtime-events|background-intelligence/iu,
          /BUDGET|_BYTES|_TOKENS|MAX_PRIVATE|tokeniz|byteLength|truncat|summar|redact|rerank|\.sort\(/iu,
          /@Controller|@Get|@Post|@Module|Router|express|\bfetch\b|\/rest\/v1\//u,
          /shared_worlds\b|membership_episodes|standing_context_grants|grant_audience|consent_events|memories|conversation_turns|conversation_sessions|CanonicalStore/u,
          /randomUUID|Math\.random|Date\.now|new Date|performance\.now|setTimeout/u, /accessToken|jwt|auth\.uid|SUPABASE/iu,
          /SourceMaterialRef|materialId|MATERIAL_DEPENDENCY|REASONING_DEPENDENCY|disclos|publish|quote|deliver|history|replay|matching|public_world|PUBLIC_WORLD/iu,
          /INSERT|UPDATE|DELETE|MERGE|TRUNCATE|revoke|grant_shared|persist/u,
          /'GRANTED'|'NOT_GRANTED'|'SEALED'|'REQUIRES_REVALIDATION'|'PRIVATE_REASONING_ONLY_CONTEXT'|contextClassification:|deliveryAuthority:|allowed:/u,
        ]) {
          expect(source).not.toMatch(pattern);
        }
      }
    });

    it('composes exactly the frozen I-03A evaluator once per candidate in offered order, excludes DENY and UNKNOWN structurally, dedups owners, and invents no grantor-in-audience or content-rewriting rule', () => {
      const source = executable('shared-effective-context.service.ts');
      expect(source.match(/evaluateStandingContextAuthority\(/gu)).toHaveLength(1);
      expect(source).toContain("if (validated === 'MALFORMED') return unresolved('MALFORMED_CANDIDATE_SET');");
      expect(source).toContain("if (worldState.snapshot.lifecycle === 'READ_ONLY_CLOSED') return blocked('WORLD_READ_ONLY_CLOSED');");
      expect(source).toContain("if (isRecord(audience) && audience.state === 'EMPTY') return blocked('NO_ACTIVE_HUMANS');");
      expect(source).toContain("if (!isResolvedAudience(audience)) return unresolved('AUDIENCE_UNRESOLVED');");
      expect(source).toContain('const owners = [...new Set(validated.map((candidate) => candidate.ownerHumanId))];');
      expect(source).toContain('for (const candidate of validated) {');
      expect(source).toContain("if (decision.decision !== 'ALLOW') continue;");
      expect(source).toMatch(/action: STANDING_CONTEXT_ACTION,\s+grantor,\s+targetWorldId,\s+purpose: STANDING_CONTEXT_PURPOSE,\s+audienceSnapshot,/u);
      expect(source).not.toMatch(/humans\.(?:some|includes|find|indexOf|filter)\(/u);
      expect(source).not.toMatch(/reasoningContent\.(?:replace|slice|substring|substr|trim|toLowerCase|toUpperCase|normalize|split|concat)/u);
      expect(source).not.toMatch(/'DENY'|'UNKNOWN'|reason:\s*decision|decision\.reason/u);
      expect(source).toContain("createHash('sha256')");
      expect(service.resolve.length).toBe(2);
      for (const reason of [...SHARED_EFFECTIVE_CONTEXT_BLOCK_REASONS, ...SHARED_EFFECTIVE_CONTEXT_UNRESOLVED_REASONS]) expect(source).toContain(`'${reason}'`);
      expect(source.length).toBeGreaterThan(1000);
    });
  });
});
