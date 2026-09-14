import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest, SharedWorldLifecycle, SharedWorldPhase } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import { evaluateStandingContextAuthority } from '../authority/standing-context-authority';
import { STANDING_CONTEXT_ACTION, STANDING_CONTEXT_PURPOSE } from '../authority/standing-context-authority.types';
import type { SharedHumanAudienceSnapshot, StandingContextGrantResolution } from '../authority/standing-context-authority.types';
import { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedHumanAudienceResolverService, fingerprintSharedHumanAudience } from '../audience/shared-human-audience-resolver.service';
import { SharedPreModelWorldStateResolverService, fingerprintSharedPreModelWorldState } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { SharedEffectiveContextService, digestReasoningContent, fingerprintSharedEffectiveContext } from '../effective-context/shared-effective-context.service';
import type {
  AuthorizedPrivateReasoningContext,
  PrivateSourceContextRef,
  SharedEffectiveContext,
  StandingContextAllowDecision,
} from '../effective-context/shared-effective-context.types';
import { SHARED_PRIVATE_SOURCE_STATE_RESOLUTION_FAILURES } from './shared-private-source-state-resolver.types';
import type { SharedPrivateSourceStateResolution, SharedPrivateSourceStateResolver } from './shared-private-source-state-resolver.types';
import {
  SHARED_DELIVERY_AUTHORITY_STALE_REASONS,
  SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS,
} from './shared-delivery-authority.types';
import type { SharedDeliveryAuthorityRevalidation } from './shared-delivery-authority.types';
import {
  SHARED_DELIVERY_AUTHORITY_REVALIDATION_VERSION,
  SharedDeliveryAuthorityRevalidatorService,
  digestProviderOutput,
  fingerprintSharedDeliveryAuthorityRevalidation,
} from './shared-delivery-authority-revalidator.service';

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
  e1: '40000000-0000-4000-8000-000000000001',
  e2: '40000000-0000-4000-8000-000000000002',
  e3: '40000000-0000-4000-8000-000000000003',
  e1b: '40000000-0000-4000-8000-00000000000b',
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

const AUTHORITY_REF = (suffix: string) => `sha256:${suffix.padEnd(64, '0')}`;
const REF_A = AUTHORITY_REF('a1');
const REF_A2 = AUTHORITY_REF('a2');
const REF_B = AUTHORITY_REF('b1');
const OUTPUT = 'A higher-level suggestion influenced by private reasoning context.';

// --- canonical fixtures --------------------------------------------------------

const worldSnapshotRef = (lifecycle: SharedWorldLifecycle = 'ACTIVE', phase: SharedWorldPhase = 'STANDARD', worldId: string = IDS.world): string =>
  fingerprintSharedPreModelWorldState({ worldId, lifecycle, phase });
const worldResolved = (lifecycle: SharedWorldLifecycle = 'ACTIVE', phase: SharedWorldPhase = 'STANDARD', worldId: SharedWorldId = WORLD): unknown =>
  ({ state: 'RESOLVED', snapshot: { worldId, lifecycle, phase, snapshotRef: worldSnapshotRef(lifecycle, phase, worldId) } });

const audienceRef = (members: ReadonlyArray<[HumanPrincipal, string]>): string =>
  fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId: IDS.world, members: members.map(([who, episode]) => ({ userId: who.humanId, membershipEpisodeId: episode })) });
const PAIR: ReadonlyArray<[HumanPrincipal, string]> = [[MOHAMED, IDS.e1], [HADIR, IDS.e2]];
const audienceSnapshot = (members: ReadonlyArray<[HumanPrincipal, string]> = PAIR): SharedHumanAudienceSnapshot =>
  ({ snapshotRef: audienceRef(members), humans: members.map(([who]) => who) });
const audienceResolved = (snapshot: SharedHumanAudienceSnapshot): unknown => ({ state: 'RESOLVED', snapshot });
const AUDIENCE = audienceSnapshot();
const AUDIENCE_EMPTY: unknown = { state: 'EMPTY', snapshotRef: fingerprintSharedHumanAudience({ state: 'EMPTY', worldId: IDS.world }) };

const foundGrant = (
  grantor: HumanPrincipal,
  ceiling: ReadonlyArray<HumanPrincipal>,
  grantId = IDS.grantM,
  authoritySnapshotRef = REF_A,
  worldId: SharedWorldId = WORLD,
): StandingContextGrantResolution => ({ state: 'FOUND', authoritySnapshotRef, grant: { grantId, worldId, grantor, status: 'ACTIVE', audienceCeiling: ceiling } });
const notFoundGrant = (authoritySnapshotRef = AUTHORITY_REF('n0')): StandingContextGrantResolution => ({ state: 'NOT_FOUND', authoritySnapshotRef });

/** A genuine frozen I-03A ALLOW, produced by the frozen evaluator itself rather than hand-written. */
function allowDecision(
  owner: HumanPrincipal,
  snapshot: SharedHumanAudienceSnapshot = AUDIENCE,
  grantId = IDS.grantM,
  authoritySnapshotRef = REF_A,
  worldId: SharedWorldId = WORLD,
): StandingContextAllowDecision {
  const decision = evaluateStandingContextAuthority(
    { action: STANDING_CONTEXT_ACTION, grantor: owner, targetWorldId: worldId, purpose: STANDING_CONTEXT_PURPOSE, audienceSnapshot: snapshot },
    foundGrant(owner, snapshot.humans, grantId, authoritySnapshotRef, worldId),
  );
  if (decision.decision !== 'ALLOW') throw new Error(`fixture ALLOW failed: ${decision.decision}`);
  return decision;
}

const CONTENT_M = 'Mohamed prefers to avoid travel in the first week of the month.';
const CONTENT_M2 = 'Mohamed has a standing commitment on Thursday evenings.';
const CONTENT_A = 'Ahmed is saving for a move and is cautious about new costs.';

function item(
  owner: HumanPrincipal,
  contextId: string,
  reasoningContent: string,
  authority: StandingContextAllowDecision = allowDecision(owner),
): AuthorizedPrivateReasoningContext {
  return {
    kind: 'AUTHORIZED_PRIVATE_REASONING_CONTEXT',
    source: { contextId, originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner } },
    reasoningContent,
    contentDigest: digestReasoningContent(reasoningContent),
    authority,
  };
}

/** Builds an envelope and seals it with the frozen I-03E fingerprint, exactly as I-03E does. */
function envelopeOf(
  items: ReadonlyArray<AuthorizedPrivateReasoningContext>,
  snapshot: SharedHumanAudienceSnapshot = AUDIENCE,
  worldStateSnapshotRef = worldSnapshotRef(),
  targetWorldId: SharedWorldId = WORLD,
): SharedEffectiveContext {
  return {
    effectiveContextRef: fingerprintSharedEffectiveContext({
      worldId: targetWorldId,
      worldStateSnapshotRef,
      audienceSnapshotRef: snapshot.snapshotRef,
      items: items.map((entry) => ({
        ownerHumanId: entry.source.originWorld.owner.humanId,
        contextId: entry.source.contextId,
        contentDigest: entry.contentDigest,
        grantId: entry.authority.binding.grantId,
        authoritySnapshotRef: entry.authority.binding.authoritySnapshotRef,
      })),
    }),
    targetWorldId,
    worldStateSnapshotRef,
    audienceSnapshot: snapshot,
    privateReasoningContexts: items,
  };
}

const ONE_ITEM = () => envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M)]);
const EMPTY_ENVELOPE = () => envelopeOf([]);

/** Structural surgery on a sealed envelope: the fingerprint is NOT recomputed, exactly as a tampering caller would leave it. */
function tamper(envelope: SharedEffectiveContext, mutate: (draft: Record<string, unknown>) => void): SharedEffectiveContext {
  const draft = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
  mutate(draft);
  return draft as unknown as SharedEffectiveContext;
}

const sourceKey = (ownerHumanId: string, contextId: string): string => JSON.stringify([ownerHumanId, contextId]);
const AVAILABLE = (contentDigest: string): SharedPrivateSourceStateResolution => ({ state: 'AVAILABLE', contentDigest });

interface Harness {
  readonly service: SharedDeliveryAuthorityRevalidatorService;
  readonly worldCalls: string[];
  readonly audienceCalls: string[];
  readonly grantCalls: string[];
  readonly sourceCalls: PrivateSourceContextRef[];
}

function harness(options: {
  world?: unknown;
  audience?: unknown;
  grants?: Record<string, StandingContextGrantResolution | Error>;
  sources?: Record<string, unknown>;
  /** Every source resolves AVAILABLE at the envelope's own digest. */
  envelope?: SharedEffectiveContext;
} = {}): Harness {
  const worldCalls: string[] = [];
  const audienceCalls: string[] = [];
  const grantCalls: string[] = [];
  const sourceCalls: PrivateSourceContextRef[] = [];

  const defaultSources: Record<string, unknown> = {};
  for (const entry of options.envelope?.privateReasoningContexts ?? []) {
    defaultSources[sourceKey(entry.source.originWorld.owner.humanId, entry.source.contextId)] = AVAILABLE(entry.contentDigest);
  }
  const defaultGrants: Record<string, StandingContextGrantResolution | Error> = {};
  for (const entry of options.envelope?.privateReasoningContexts ?? []) {
    const owner = entry.source.originWorld.owner;
    defaultGrants[owner.humanId] = foundGrant(owner, AUDIENCE.humans, entry.authority.binding.grantId, entry.authority.binding.authoritySnapshotRef);
  }

  // `in`, never `??`: an explicit `null` or `undefined` fixture is a payload the
  // service must refuse, not an absent option that falls back to a valid one.
  const given = (key: 'world' | 'audience'): boolean => Object.prototype.hasOwnProperty.call(options, key);

  const worldState = {
    async resolveCurrent(worldId: SharedWorldId) {
      worldCalls.push(worldId);
      const answer = given('world') ? options.world : worldResolved();
      if (answer instanceof Error) throw answer;
      return answer;
    },
  } as unknown as SharedPreModelWorldStateResolverService;

  const audience = {
    async resolveCurrent(worldId: SharedWorldId) {
      audienceCalls.push(worldId);
      const answer = given('audience') ? options.audience : audienceResolved(AUDIENCE);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  } as unknown as SharedHumanAudienceResolverService;

  const grants = {
    async resolveCurrent(_worldId: SharedWorldId, grantor: HumanPrincipal) {
      grantCalls.push(grantor.humanId);
      const answer = (options.grants ?? defaultGrants)[grantor.humanId];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) throw new Error(`no grant fixture for ${grantor.humanId}`);
      return answer;
    },
  } as unknown as StandingContextGrantResolverService;

  const sources: SharedPrivateSourceStateResolver = {
    async resolveCurrent(source: PrivateSourceContextRef) {
      sourceCalls.push(source);
      const answer = (options.sources ?? defaultSources)[sourceKey(source.originWorld.owner.humanId, source.contextId)];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) throw new Error(`no source fixture for ${source.contextId}`);
      return answer as SharedPrivateSourceStateResolution;
    },
  };

  return { service: new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, sources), worldCalls, audienceCalls, grantCalls, sourceCalls };
}

function expectUnresolved(result: SharedDeliveryAuthorityRevalidation, reason: string): void {
  expect(result).toEqual({ state: 'UNRESOLVED', reason });
}
function expectStale(result: SharedDeliveryAuthorityRevalidation, reason: string): void {
  expect(result).toEqual({ state: 'STALE', reason });
}
function currentOf(result: SharedDeliveryAuthorityRevalidation) {
  if (result.state !== 'CURRENT') throw new Error(`expected CURRENT, got ${result.state}: ${JSON.stringify(result)}`);
  return result.revalidation;
}

describe('SharedDeliveryAuthorityRevalidatorService', () => {
  // -------------------------------------------------------------------------
  describe('malformed EffectiveContext, refused before any dependency call (task §15, §35-§37, §41)', () => {
    const refuses = async (envelope: unknown, note: string): Promise<void> => {
      const kit = harness();
      const result = await kit.service.revalidate(envelope as SharedEffectiveContext, OUTPUT);
      expectUnresolved(result, 'MALFORMED_EFFECTIVE_CONTEXT');
      expect({ note, world: kit.worldCalls.length, audience: kit.audienceCalls.length, grants: kit.grantCalls.length, sources: kit.sourceCalls.length })
        .toEqual({ note, world: 0, audience: 0, grants: 0, sources: 0 });
    };

    it('41.1 refuses a non-envelope: null, undefined, a string, an array or a class instance', async () => {
      for (const value of [null, undefined, '', 'envelope', 42, true, [], [ONE_ITEM()], new Date(), () => ONE_ITEM()]) {
        await refuses(value, `non-envelope ${String(value)}`);
      }
    });

    it('41.2 refuses a missing or extra top-level field', async () => {
      for (const key of ['effectiveContextRef', 'targetWorldId', 'worldStateSnapshotRef', 'audienceSnapshot', 'privateReasoningContexts']) {
        await refuses(tamper(ONE_ITEM(), (draft) => { delete draft[key]; }), `missing ${key}`);
      }
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.deliveryAllowed = true; }), 'extra field');
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.sourceDisclosureSafe = true; }), 'smuggled safety claim');
    });

    it('41.3 refuses a blank or non-string effectiveContextRef', async () => {
      for (const value of ['', '   ', 0, null, {}]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { draft.effectiveContextRef = value; }), 'blank ref');
      }
    });

    it('41.4 refuses a malformed targetWorldId, including a World-taxonomy name', async () => {
      for (const value of ['', '  ', 'MY_WORLD', 'SHARED_WORLD', 'PUBLIC_WORLD', 'MATCHING', 'REPLAY', 'INTRODUCTION', 'INVITATION', 'DISCUSSION', 'PUBLIC_EXPERIENCE', 7, null]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { draft.targetWorldId = value; }), `world ${String(value)}`);
      }
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.worldStateSnapshotRef = '  '; }), 'blank world-state ref');
    });

    it('41.5 refuses a malformed audience snapshot', async () => {
      for (const value of [null, 'audience', [], { snapshotRef: 'r' }, { humans: [MOHAMED] }, { snapshotRef: '', humans: [MOHAMED] }, { snapshotRef: 'r', humans: [] }, { snapshotRef: 'r', humans: [MOHAMED], extra: 1 }]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { draft.audienceSnapshot = value; }), 'audience shape');
      }
      for (const bad of [{ kind: 'QANDEEL_SYSTEM' }, { kind: 'HUMAN' }, { kind: 'HUMAN', humanId: '' }, { kind: 'HUMAN', humanId: IDS.mohamed, role: 'owner' }]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (draft.audienceSnapshot as Record<string, unknown>).humans = [bad, HADIR]; }), 'non-human member');
      }
    });

    it('41.6 refuses a duplicate human in the generation audience', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.audienceSnapshot as Record<string, unknown>).humans = [MOHAMED, HADIR, MOHAMED]; }), 'duplicate audience');
    });

    it('41.7 refuses a malformed private list', async () => {
      for (const value of [null, 'none', {}, 42]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { draft.privateReasoningContexts = value; }), 'private list');
      }
    });

    it('41.8 refuses a malformed item: wrong kind, missing or extra property, non-string content', async () => {
      for (const value of [null, 'item', [], { kind: 'AUTHORIZED_PRIVATE_REASONING_CONTEXT' }]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as unknown[])[0] = value; }), 'item shape');
      }
      for (const key of ['kind', 'source', 'reasoningContent', 'contentDigest', 'authority']) {
        await refuses(tamper(ONE_ITEM(), (draft) => { delete (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>)[key]; }), `item missing ${key}`);
      }
      await refuses(tamper(ONE_ITEM(), (draft) => { (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).disclosable = true; }), 'item extra field');
      await refuses(tamper(ONE_ITEM(), (draft) => { (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).kind = 'CANDIDATE'; }), 'item wrong kind');
      await refuses(tamper(ONE_ITEM(), (draft) => { (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).reasoningContent = 12; }), 'item non-string content');
    });

    it('41.9 refuses a non-MY_WORLD source origin', async () => {
      for (const origin of [
        { architectureClass: 'WORLD', worldType: 'SHARED_WORLD', owner: MOHAMED },
        { architectureClass: 'WORLD', worldType: 'PUBLIC_WORLD', owner: MOHAMED },
        { architectureClass: 'CAPABILITY', worldType: 'MY_WORLD', owner: MOHAMED },
        { architectureClass: 'WORLD', worldType: 'MY_WORLD' },
        { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED, worldId: IDS.world },
        null,
        'MY_WORLD',
      ]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).source as Record<string, unknown>).originWorld = origin; }), 'origin');
      }
    });

    it('41.10 refuses a non-human source owner', async () => {
      for (const owner of [{ kind: 'QANDEEL_SYSTEM' }, { kind: 'HUMAN', humanId: '  ' }, { kind: 'HUMAN', humanId: IDS.mohamed, extra: 1 }, null, IDS.mohamed]) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          const source = (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).source as Record<string, unknown>;
          (source.originWorld as Record<string, unknown>).owner = owner;
        }), 'owner');
      }
    });

    it('41.11 refuses a blank contextId or a malformed source reference', async () => {
      for (const source of [null, 'ctx', { contextId: 'ctx-m1' }, { contextId: '', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED } },
        { contextId: 'ctx-m1', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED }, materialId: 'm1' }]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).source = source; }), 'source ref');
      }
    });

    it('41.12 refuses the same source identity twice, and accepts the same contextId under two owners', async () => {
      const twice = envelopeOf([item(MOHAMED, 'ctx-1', CONTENT_M), item(MOHAMED, 'ctx-1', CONTENT_M2)]);
      await refuses(twice, 'duplicate source identity');
      // The same opaque id under a different owner is a DIFFERENT source and is legitimate.
      const shared = envelopeOf([item(MOHAMED, 'ctx-1', CONTENT_M), item(AHMED, 'ctx-1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA, REF_B))]);
      const kit = harness({ envelope: shared });
      expect(currentOf(await kit.service.revalidate(shared, OUTPUT)).authorityStatus).toBe('CURRENT');
    });

    it('41.13 refuses a malformed contentDigest', async () => {
      for (const digest of ['', 'sha256:', 'sha1:' + 'a'.repeat(64), 'sha256:' + 'A'.repeat(64), 'sha256:' + 'a'.repeat(63), 'sha256:' + 'a'.repeat(65), 'sha256:' + 'g'.repeat(64), createHash('sha256').update(CONTENT_M).digest('hex'), null]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).contentDigest = digest; }), `digest ${String(digest)}`);
      }
    });

    it('41.14 refuses a non-ALLOW authority, including DENY, UNKNOWN and a missing binding', async () => {
      for (const authority of [
        { decision: 'DENY', externalEffect: 'BLOCKED', reason: 'GRANT_REVOKED' },
        { decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason: 'GRANT_STATE_UNRESOLVED' },
        { ...allowDecision(MOHAMED), decision: 'ALLOW', externalEffect: 'ADMIT_FOR_DELIVERY' },
        null,
        'ALLOW',
      ]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority = authority; }), 'authority');
      }
      for (const key of ['decision', 'externalEffect', 'constraints', 'binding']) {
        await refuses(tamper(ONE_ITEM(), (draft) => { delete ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>)[key]; }), `authority missing ${key}`);
      }
    });

    it('41.15 refuses changed, widened or faked ALLOW constraints', async () => {
      const widened: Record<string, unknown> = {
        contextClassification: 'SHARED_TRUTH',
        reasoningAuthority: 'GRANTED',
        directPrivateDisclosureAuthority: 'GRANTED',
        materialDisclosureAuthority: 'GRANTED',
        provenanceDisclosure: 'VISIBLE',
        deliveryAuthority: 'GRANTED',
      };
      for (const key of Object.keys(widened)) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          const constraints = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).constraints as Record<string, unknown>;
          constraints[key] = widened[key];
        }), `constraint ${key}`);
        await refuses(tamper(ONE_ITEM(), (draft) => {
          const constraints = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).constraints as Record<string, unknown>;
          delete constraints[key];
        }), `constraint missing ${key}`);
      }
      await refuses(tamper(ONE_ITEM(), (draft) => {
        const constraints = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).constraints as Record<string, unknown>;
        constraints.sourceDisclosureAuthority = 'GRANTED';
      }), 'extra constraint');
    });

    it('41.16 refuses a binding whose grantor is not the source owner', async () => {
      await refuses(envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M, allowDecision(HADIR))]), 'grantor != owner');
    });

    it('41.17 refuses a binding whose target World is not the envelope World', async () => {
      await refuses(envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M, allowDecision(MOHAMED, AUDIENCE, IDS.grantM, REF_A, OTHER_WORLD))]), 'foreign target World');
      await refuses(tamper(ONE_ITEM(), (draft) => {
        const binding = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).binding as Record<string, unknown>;
        binding.action = 'DISCLOSE_PRIVATE_FACT';
      }), 'foreign action');
      await refuses(tamper(ONE_ITEM(), (draft) => {
        const binding = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).binding as Record<string, unknown>;
        binding.purpose = 'MATCHING';
      }), 'foreign purpose');
      for (const key of ['grantId', 'authoritySnapshotRef']) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          const binding = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).binding as Record<string, unknown>;
          binding[key] = '   ';
        }), `blank ${key}`);
      }
    });

    it('41.18 refuses a binding audience reference that is not the envelope audience reference', async () => {
      await refuses(envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M, allowDecision(MOHAMED, audienceSnapshot([[MOHAMED, IDS.e1], [HADIR, IDS.e3]])))]), 'foreign audience ref');
    });

    it('41.19 refuses a binding audience SET that is not the envelope audience set', async () => {
      // Same snapshotRef, different bound human ids: the binding is internally inconsistent.
      await refuses(tamper(ONE_ITEM(), (draft) => {
        const binding = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).binding as Record<string, unknown>;
        binding.audienceHumanIds = [IDS.mohamed, IDS.hadir, IDS.ahmed];
      }), 'widened bound audience');
      await refuses(tamper(ONE_ITEM(), (draft) => {
        const binding = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).binding as Record<string, unknown>;
        binding.audienceHumanIds = [IDS.mohamed];
      }), 'narrowed bound audience');
      for (const value of [[IDS.mohamed, IDS.mohamed], [IDS.mohamed, 7], 'ids', null]) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          const binding = ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).authority as Record<string, unknown>).binding as Record<string, unknown>;
          binding.audienceHumanIds = value;
        }), 'malformed bound audience');
      }
    });

    it('41.20 refuses one owner carrying contradictory grant bindings inside one envelope', async () => {
      await refuses(envelopeOf([
        item(MOHAMED, 'ctx-m1', CONTENT_M, allowDecision(MOHAMED, AUDIENCE, IDS.grantM, REF_A)),
        item(MOHAMED, 'ctx-m2', CONTENT_M2, allowDecision(MOHAMED, AUDIENCE, IDS.grantM2, REF_A)),
      ]), 'two grant ids for one owner');
      await refuses(envelopeOf([
        item(MOHAMED, 'ctx-m1', CONTENT_M, allowDecision(MOHAMED, AUDIENCE, IDS.grantM, REF_A)),
        item(MOHAMED, 'ctx-m2', CONTENT_M2, allowDecision(MOHAMED, AUDIENCE, IDS.grantM, REF_A2)),
      ]), 'two authority snapshots for one owner');
      // Two items of the SAME owner sharing one binding are legitimate.
      const consistent = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M), item(MOHAMED, 'ctx-m2', CONTENT_M2)]);
      const kit = harness({ envelope: consistent });
      expect(currentOf(await kit.service.revalidate(consistent, OUTPUT)).authorityStatus).toBe('CURRENT');
    });

    it('41.21 refuses a mutated envelope that keeps its old effectiveContextRef', async () => {
      const sealed = ONE_ITEM();
      const mutations: ReadonlyArray<[string, (draft: Record<string, unknown>) => void]> = [
        ['source context id', (draft) => { ((((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).source as Record<string, unknown>).contextId = 'ctx-swapped'; }],
        ['content digest', (draft) => { (((draft.privateReasoningContexts as unknown[])[0]) as Record<string, unknown>).contentDigest = digestReasoningContent(CONTENT_M2); }],
        ['world-state ref', (draft) => { draft.worldStateSnapshotRef = worldSnapshotRef('ACTIVE', 'INTRODUCTION'); }],
        ['effectiveContextRef itself', (draft) => { draft.effectiveContextRef = AUTHORITY_REF('ff'); }],
      ];
      for (const [note, mutate] of mutations) await refuses(tamper(sealed, mutate), note);

      // Item ORDER is part of the fingerprint: reordering two legitimately
      // admitted items while keeping the old reference is refused.
      const two = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M), item(MOHAMED, 'ctx-m2', CONTENT_M2)]);
      await refuses({ ...two, privateReasoningContexts: [...two.privateReasoningContexts].reverse() }, 'reordered items');

      // Substituting a DIFFERENT owner's item wholesale, keeping the old ref.
      await refuses({ ...sealed, privateReasoningContexts: [item(AHMED, 'ctx-a1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA, REF_B))] }, 'swapped owner');
    });

    it('refuses a non-string provider output before any dependency call', async () => {
      for (const value of [undefined, null, 42, {}, ['text'], Buffer.from('text')]) {
        const kit = harness({ envelope: ONE_ITEM() });
        const result = await kit.service.revalidate(ONE_ITEM(), value as unknown as string);
        expectUnresolved(result, 'MALFORMED_EFFECTIVE_CONTEXT');
        expect(kit.worldCalls).toHaveLength(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('World-state revalidation (task §13, §42)', () => {
    it('42.22 proceeds when the current World snapshot is exactly the generation snapshot', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope });
      const revalidation = currentOf(await kit.service.revalidate(envelope, OUTPUT));
      expect(kit.worldCalls).toEqual([WORLD]);
      expect(revalidation.worldStateSnapshotRef).toBe(envelope.worldStateSnapshotRef);
    });

    it('42.23 a throwing World resolver is UNRESOLVED and reaches no audience, grant or source', async () => {
      const kit = harness({ envelope: ONE_ITEM(), world: new Error('boom: SUPABASE_SERVICE_ROLE_KEY=hunter2') });
      const result = await kit.service.revalidate(ONE_ITEM(), OUTPUT);
      expectUnresolved(result, 'WORLD_STATE_UNRESOLVED');
      expect(JSON.stringify(result)).not.toContain('hunter2');
      expect([kit.audienceCalls.length, kit.grantCalls.length, kit.sourceCalls.length]).toEqual([0, 0, 0]);
    });

    it('42.24 an UNRESOLVED World resolution is UNRESOLVED, whatever its failure class', async () => {
      for (const failure of ['LOOKUP_FAILED', 'LOOKUP_TIMED_OUT', 'WORLD_STATE_SNAPSHOT_UNAVAILABLE', 'CONTRADICTORY_CANONICAL_STATE']) {
        const kit = harness({ envelope: ONE_ITEM(), world: { state: 'UNRESOLVED', failure } });
        expectUnresolved(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'WORLD_STATE_UNRESOLVED');
        expect(kit.audienceCalls).toHaveLength(0);
      }
    });

    it('42.25 a malformed RESOLVED World payload is UNRESOLVED, never a World state', async () => {
      const ok = worldResolved() as Record<string, unknown>;
      for (const world of [
        null, 'RESOLVED', { state: 'RESOLVED' }, { ...ok, extra: 1 },
        { state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'ACTIVE', phase: 'STANDARD' } },
        { state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: '  ' } },
        { state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'DORMANT', phase: 'STANDARD', snapshotRef: worldSnapshotRef() } },
        { state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'ACTIVE', phase: 'ARCHIVED', snapshotRef: worldSnapshotRef() } },
        { state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: worldSnapshotRef(), governance: 'OPEN' } },
        { state: 'READ_ONLY_CLOSED', snapshot: (ok.snapshot as unknown) },
      ]) {
        const kit = harness({ envelope: ONE_ITEM(), world });
        expectUnresolved(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'WORLD_STATE_UNRESOLVED');
        expect(kit.audienceCalls).toHaveLength(0);
      }
    });

    it('42.26 a World that has closed makes the old result STALE', async () => {
      for (const phase of ['STANDARD', 'INTRODUCTION'] as const) {
        const kit = harness({ envelope: ONE_ITEM(), world: worldResolved('READ_ONLY_CLOSED', phase) });
        expectStale(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'WORLD_READ_ONLY_CLOSED');
        expect([kit.audienceCalls.length, kit.grantCalls.length, kit.sourceCalls.length]).toEqual([0, 0, 0]);
      }
    });

    it('42.27 an ACTIVE phase change makes the old result STALE: INTRODUCTION to STANDARD is not silently delivered', async () => {
      const introduction = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M)], AUDIENCE, worldSnapshotRef('ACTIVE', 'INTRODUCTION'));
      const kit = harness({ envelope: introduction, world: worldResolved('ACTIVE', 'STANDARD') });
      expectStale(await kit.service.revalidate(introduction, OUTPUT), 'WORLD_STATE_CHANGED');
      expect([kit.audienceCalls.length, kit.grantCalls.length, kit.sourceCalls.length]).toEqual([0, 0, 0]);
      // And the reverse direction is equally stale.
      const standard = ONE_ITEM();
      const back = harness({ envelope: standard, world: worldResolved('ACTIVE', 'INTRODUCTION') });
      expectStale(await back.service.revalidate(standard, OUTPUT), 'WORLD_STATE_CHANGED');
    });

    it('42.28 a snapshot for a DIFFERENT World never becomes CURRENT', async () => {
      const kit = harness({ envelope: ONE_ITEM(), world: worldResolved('ACTIVE', 'STANDARD', OTHER_WORLD) });
      const result = await kit.service.revalidate(ONE_ITEM(), OUTPUT);
      expect(result.state).not.toBe('CURRENT');
      expectUnresolved(result, 'WORLD_STATE_UNRESOLVED');
    });
  });

  // -------------------------------------------------------------------------
  describe('Audience Snapshot revalidation (task §14, §43)', () => {
    it('43.29 proceeds when the current audience snapshot is exactly the generation snapshot', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope });
      expect(currentOf(await kit.service.revalidate(envelope, OUTPUT)).audienceSnapshotRef).toBe(AUDIENCE.snapshotRef);
      expect(kit.audienceCalls).toEqual([WORLD]);
    });

    it('43.30 a throwing audience resolver is UNRESOLVED and reaches no grant or source', async () => {
      const kit = harness({ envelope: ONE_ITEM(), audience: new Error('transport failed for user 20000000-0000-4000-8000-000000000002') });
      const result = await kit.service.revalidate(ONE_ITEM(), OUTPUT);
      expectUnresolved(result, 'AUDIENCE_UNRESOLVED');
      expect(JSON.stringify(result)).not.toContain(IDS.hadir);
      expect([kit.grantCalls.length, kit.sourceCalls.length]).toEqual([0, 0]);
    });

    it('43.31 an UNRESOLVED audience resolution is UNRESOLVED, whatever its failure class', async () => {
      for (const failure of ['LOOKUP_FAILED', 'LOOKUP_TIMED_OUT', 'AUDIENCE_SNAPSHOT_UNAVAILABLE', 'CONTRADICTORY_CANONICAL_STATE']) {
        const kit = harness({ envelope: ONE_ITEM(), audience: { state: 'UNRESOLVED', failure } });
        expectUnresolved(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'AUDIENCE_UNRESOLVED');
        expect(kit.grantCalls).toHaveLength(0);
      }
    });

    it('43.32 a malformed EMPTY-like or RESOLVED-like payload is UNRESOLVED, never known NO_ACTIVE_HUMANS', async () => {
      for (const audience of [
        { state: 'EMPTY' }, { state: 'EMPTY', snapshotRef: '' }, { state: 'EMPTY', snapshotRef: '   ' },
        { state: 'EMPTY', snapshotRef: 'r', humans: [] }, { state: 'EMPTY', snapshotRef: 'r', reason: 'ALL_LEFT' },
        null, 'EMPTY', { state: 'RESOLVED' }, { state: 'RESOLVED', snapshot: { snapshotRef: 'r' } },
        { state: 'RESOLVED', snapshot: { snapshotRef: 'r', humans: [] } },
        { state: 'RESOLVED', snapshot: { snapshotRef: 'r', humans: [MOHAMED, MOHAMED] } },
        { state: 'RESOLVED', snapshot: { snapshotRef: 'r', humans: [MOHAMED], extra: 1 } },
        { state: 'RESOLVED', snapshot: { snapshotRef: 'r', humans: [{ kind: 'QANDEEL_SYSTEM' }] } },
      ]) {
        const kit = harness({ envelope: ONE_ITEM(), audience });
        expectUnresolved(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'AUDIENCE_UNRESOLVED');
        expect(kit.grantCalls).toHaveLength(0);
      }
    });

    it('43.33 an exact valid EMPTY audience makes the old result STALE / NO_ACTIVE_HUMANS', async () => {
      const kit = harness({ envelope: ONE_ITEM(), audience: AUDIENCE_EMPTY });
      expectStale(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'NO_ACTIVE_HUMANS');
      expect([kit.grantCalls.length, kit.sourceCalls.length]).toEqual([0, 0]);
    });

    it('43.34 a leave and rejoin of the SAME humans is still AUDIENCE_CHANGED', async () => {
      // Identical human set, new membership episode: the snapshot reference changes,
      // and no "the same people are back" rule resurrects the old generation.
      const rejoined = audienceSnapshot([[MOHAMED, IDS.e1b], [HADIR, IDS.e2]]);
      expect(rejoined.humans.map((who) => who.humanId)).toEqual(AUDIENCE.humans.map((who) => who.humanId));
      expect(rejoined.snapshotRef).not.toBe(AUDIENCE.snapshotRef);
      const kit = harness({ envelope: ONE_ITEM(), audience: audienceResolved(rejoined) });
      expectStale(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'AUDIENCE_CHANGED');
      expect([kit.grantCalls.length, kit.sourceCalls.length]).toEqual([0, 0]);
    });

    it('43.35 an added human is AUDIENCE_CHANGED, with no superset grandfathering', async () => {
      const expanded = audienceSnapshot([[MOHAMED, IDS.e1], [HADIR, IDS.e2], [AHMED, IDS.e3]]);
      const kit = harness({ envelope: ONE_ITEM(), audience: audienceResolved(expanded) });
      expectStale(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'AUDIENCE_CHANGED');
      expect(kit.grantCalls).toHaveLength(0);
    });

    it('43.36 a removed human is AUDIENCE_CHANGED, with no subset grandfathering', async () => {
      const reduced = audienceSnapshot([[MOHAMED, IDS.e1]]);
      const kit = harness({ envelope: ONE_ITEM(), audience: audienceResolved(reduced) });
      expectStale(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'AUDIENCE_CHANGED');
      expect(kit.grantCalls).toHaveLength(0);
    });

    it('an identical audience reference over a different human set is contradictory, never a match', async () => {
      const forged: SharedHumanAudienceSnapshot = { snapshotRef: AUDIENCE.snapshotRef, humans: [MOHAMED, AHMED] };
      const kit = harness({ envelope: ONE_ITEM(), audience: audienceResolved(forged) });
      expectUnresolved(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'AUDIENCE_UNRESOLVED');
      expect(kit.grantCalls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('Standing Context authority revalidation (task §17-§19, §44)', () => {
    it('44.37 the same current grant and a current I-03A ALLOW proceeds', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope });
      expect(currentOf(await kit.service.revalidate(envelope, OUTPUT)).authorityStatus).toBe('CURRENT');
      expect(kit.grantCalls).toEqual([IDS.mohamed]);
    });

    it('44.38 an absent grant makes the old result STALE / PRIVATE_AUTHORITY_CHANGED', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope, grants: { [IDS.mohamed]: notFoundGrant() } });
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
    });

    it('44.39 a revoked grant, a foreign grantor, a foreign World and an exceeded ceiling all make it STALE', async () => {
      const envelope = ONE_ITEM();
      const revoked: StandingContextGrantResolution = { state: 'FOUND', authoritySnapshotRef: REF_A, grant: { grantId: IDS.grantM, worldId: WORLD, grantor: MOHAMED, status: 'REVOKED', audienceCeiling: AUDIENCE.humans } };
      const foreignGrantor = foundGrant(HADIR, AUDIENCE.humans);
      const foreignWorld = foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM, REF_A, OTHER_WORLD);
      const narrowedCeiling = foundGrant(MOHAMED, [MOHAMED]);
      for (const resolution of [revoked, foreignGrantor, foreignWorld, narrowedCeiling]) {
        const kit = harness({ envelope, grants: { [IDS.mohamed]: resolution } });
        expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
      }
    });

    it('44.40 an UNRESOLVED grant makes the WHOLE revalidation UNRESOLVED: the dependency may not be dropped after generation', async () => {
      const envelope = ONE_ITEM();
      for (const failure of ['LOOKUP_FAILED', 'LOOKUP_TIMED_OUT', 'AUTHORITY_SNAPSHOT_UNAVAILABLE', 'CONTRADICTORY_CANONICAL_STATE'] as const) {
        const kit = harness({ envelope, grants: { [IDS.mohamed]: { state: 'UNRESOLVED', failure } } });
        expectUnresolved(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_UNRESOLVED');
      }
      // A malformed grant snapshot is UNKNOWN to I-03A, and UNKNOWN is uncertainty here too.
      const malformed = { state: 'FOUND', authoritySnapshotRef: REF_A, grant: { grantId: IDS.grantM, worldId: WORLD, grantor: MOHAMED, status: 'PAUSED', audienceCeiling: AUDIENCE.humans } } as unknown as StandingContextGrantResolution;
      const kit = harness({ envelope, grants: { [IDS.mohamed]: malformed } });
      expectUnresolved(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_UNRESOLVED');
    });

    it('44.41 a throwing grant resolver is UNRESOLVED and leaks no upstream detail', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope, grants: { [IDS.mohamed]: new Error(`grant ${IDS.grantM} for ${IDS.mohamed} was revoked at 09:12`) } });
      const result = await kit.service.revalidate(envelope, OUTPUT);
      expectUnresolved(result, 'PRIVATE_AUTHORITY_UNRESOLVED');
      const serialized = JSON.stringify(result);
      for (const secret of [IDS.grantM, IDS.mohamed, 'revoked', '09:12']) expect(serialized).not.toContain(secret);
    });

    it('44.42 a reconfirmed grant with the same scope but a NEW grantId does NOT grandfather the old generation', async () => {
      const envelope = ONE_ITEM();
      const reconfirmed = foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM2, REF_A2);
      const kit = harness({ envelope, grants: { [IDS.mohamed]: reconfirmed } });
      // The current authority is a perfectly valid ALLOW - and that is exactly the point.
      expect(evaluateStandingContextAuthority(
        { action: STANDING_CONTEXT_ACTION, grantor: MOHAMED, targetWorldId: WORLD, purpose: STANDING_CONTEXT_PURPOSE, audienceSnapshot: AUDIENCE },
        reconfirmed,
      ).decision).toBe('ALLOW');
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
    });

    it('44.43 the same grantId under a CHANGED authority snapshot is still STALE', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope, grants: { [IDS.mohamed]: foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM, REF_A2) } });
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
      // A widened ceiling under the same grant id also changes the authority snapshot in
      // production; here the drift is proven on the snapshot reference alone.
      const widened = harness({ envelope, grants: { [IDS.mohamed]: foundGrant(MOHAMED, [MOHAMED, HADIR, AHMED], IDS.grantM, REF_A2) } });
      expectStale(await widened.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
    });

    it('44.44 an expanded audience is caught as AUDIENCE_CHANGED before any grant lookup happens', async () => {
      const expanded = audienceSnapshot([[MOHAMED, IDS.e1], [HADIR, IDS.e2], [AHMED, IDS.e3]]);
      const kit = harness({ envelope: ONE_ITEM(), audience: audienceResolved(expanded) });
      expectStale(await kit.service.revalidate(ONE_ITEM(), OUTPUT), 'AUDIENCE_CHANGED');
      expect(kit.grantCalls).toEqual([]);
    });

    it('44.45 resolves exactly one current grant per unique owner, however many items that owner has', async () => {
      const envelope = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M), item(MOHAMED, 'ctx-m2', CONTENT_M2)]);
      const kit = harness({ envelope });
      expect(currentOf(await kit.service.revalidate(envelope, OUTPUT)).authorityStatus).toBe('CURRENT');
      expect(kit.grantCalls).toEqual([IDS.mohamed]);
      expect(kit.sourceCalls).toHaveLength(2);
    });

    it('44.46 two owners are revalidated independently, each against its own grant', async () => {
      const envelope = envelopeOf([
        item(MOHAMED, 'ctx-m1', CONTENT_M),
        item(AHMED, 'ctx-a1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA, REF_B)),
      ]);
      const kit = harness({ envelope });
      expect(currentOf(await kit.service.revalidate(envelope, OUTPUT)).authorityStatus).toBe('CURRENT');
      expect([...kit.grantCalls].sort()).toEqual([IDS.mohamed, IDS.ahmed].sort());
      // Either owner losing authority alone is enough to make the whole old output stale.
      for (const revoker of [IDS.mohamed, IDS.ahmed]) {
        const grants: Record<string, StandingContextGrantResolution> = {
          [IDS.mohamed]: foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM, REF_A),
          [IDS.ahmed]: foundGrant(AHMED, AUDIENCE.humans, IDS.grantA, REF_B),
        };
        grants[revoker] = notFoundGrant();
        const kit2 = harness({ envelope, grants });
        expectStale(await kit2.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
      }
    });

    it('44.47 one owner’s grant never covers another owner: grants are not unioned', async () => {
      const envelope = envelopeOf([
        item(MOHAMED, 'ctx-m1', CONTENT_M),
        item(OMAR, 'ctx-o1', CONTENT_A, allowDecision(OMAR, AUDIENCE, IDS.grantA, REF_B)),
      ]);
      // Mohamed has a perfectly good grant. Omar has none. The presence of Mohamed's
      // authority authorizes nothing at all for Omar's context.
      const kit = harness({
        envelope,
        grants: { [IDS.mohamed]: foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM, REF_A), [IDS.omar]: notFoundGrant() },
      });
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
    });
  });

  // -------------------------------------------------------------------------
  describe('private source-state revalidation (task §20-§23, §45)', () => {
    it('45.48 an AVAILABLE source at the same content digest proceeds', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope });
      expect(currentOf(await kit.service.revalidate(envelope, OUTPUT)).authorityStatus).toBe('CURRENT');
      expect(kit.sourceCalls).toEqual([{ contextId: 'ctx-m1', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED } }]);
    });

    it('45.49 a source deleted by its owner after generation makes the old result STALE', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: { state: 'DELETED_BY_OWNER' } } });
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE');
    });

    it('45.50 an UNAVAILABLE source makes the old result STALE', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: { state: 'UNAVAILABLE' } } });
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE');
    });

    it('45.51 an AVAILABLE source whose content changed after generation makes the old result STALE', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: AVAILABLE(digestReasoningContent(`${CONTENT_M} `)) } });
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE');
    });

    it('45.52 an UNRESOLVED source state makes revalidation UNRESOLVED, whatever its failure class', async () => {
      const envelope = ONE_ITEM();
      for (const failure of SHARED_PRIVATE_SOURCE_STATE_RESOLUTION_FAILURES) {
        const kit = harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: { state: 'UNRESOLVED', failure } } });
        expectUnresolved(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_SOURCE_STATE_UNRESOLVED');
      }
    });

    it('45.53 a throwing source resolver is UNRESOLVED and leaks no upstream detail', async () => {
      const envelope = ONE_ITEM();
      const kit = harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: new Error(`memory ctx-m1 of ${IDS.mohamed}: ${CONTENT_M}`) } });
      const result = await kit.service.revalidate(envelope, OUTPUT);
      expectUnresolved(result, 'PRIVATE_SOURCE_STATE_UNRESOLVED');
      const serialized = JSON.stringify(result);
      for (const secret of ['ctx-m1', IDS.mohamed, CONTENT_M]) expect(serialized).not.toContain(secret);
    });

    it('45.54 a malformed source-state payload is UNRESOLVED, never availability', async () => {
      const envelope = ONE_ITEM();
      const digest = digestReasoningContent(CONTENT_M);
      for (const payload of [
        null, undefined, 'AVAILABLE', 42, [],
        { state: 'AVAILABLE' },
        { state: 'AVAILABLE', contentDigest: '' },
        { state: 'AVAILABLE', contentDigest: 'not-a-digest' },
        { state: 'AVAILABLE', contentDigest: digest.toUpperCase() },
        { state: 'AVAILABLE', contentDigest: digest, reasoningContent: CONTENT_M },
        { state: 'AVAILABLE', contentDigest: digest, extra: 1 },
        { state: 'DELETED_BY_OWNER', contentDigest: digest },
        { state: 'UNAVAILABLE', reason: 'quota' },
        { state: 'PRESENT', contentDigest: digest },
        { state: 'UNRESOLVED' },
      ]) {
        const kit = harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: payload } });
        expectUnresolved(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_SOURCE_STATE_UNRESOLVED');
      }
    });

    it('45.55 resolves exactly one source state per exact unique source identity', async () => {
      const envelope = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M), item(MOHAMED, 'ctx-m2', CONTENT_M2)]);
      const kit = harness({ envelope });
      expect(currentOf(await kit.service.revalidate(envelope, OUTPUT)).authorityStatus).toBe('CURRENT');
      const identities = kit.sourceCalls.map((source) => sourceKey(source.originWorld.owner.humanId, source.contextId));
      expect(identities).toEqual([sourceKey(IDS.mohamed, 'ctx-m1'), sourceKey(IDS.mohamed, 'ctx-m2')]);
      expect(new Set(identities).size).toBe(identities.length);
    });

    it('45.56 the same contextId under two different owners is two distinct sources and two lookups', async () => {
      const envelope = envelopeOf([
        item(MOHAMED, 'shared-opaque-id', CONTENT_M),
        item(AHMED, 'shared-opaque-id', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA, REF_B)),
      ]);
      const kit = harness({ envelope });
      expect(currentOf(await kit.service.revalidate(envelope, OUTPUT)).authorityStatus).toBe('CURRENT');
      expect(kit.sourceCalls.map((source) => source.originWorld.owner.humanId).sort()).toEqual([IDS.mohamed, IDS.ahmed].sort());
      // One owner's deletion does not affect the other owner's identically-named source.
      const kit2 = harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'shared-opaque-id')]: { state: 'DELETED_BY_OWNER' }, [sourceKey(IDS.ahmed, 'shared-opaque-id')]: AVAILABLE(digestReasoningContent(CONTENT_A)) } });
      expectStale(await kit2.service.revalidate(envelope, OUTPUT), 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE');
    });

    it('45.57 the source-state contract carries availability and a digest only: raw content is not representable', () => {
      const types = executable('shared-private-source-state-resolver.types.ts');
      expect(types).toContain("readonly state: 'AVAILABLE'; readonly contentDigest: string");
      for (const pattern of [/reasoningContent/u, /\bcontent\s*:/u, /rawContent|sourceContent|payload|transcript|\bbody\b|\btext\b|excerpt|snippet/iu]) {
        expect(types).not.toMatch(pattern);
      }
      // The call carries only the canonical source identity: no credential, no audience, no permission.
      expect(types).toContain('resolveCurrent(source: PrivateSourceContextRef): Promise<SharedPrivateSourceStateResolution>;');
      for (const pattern of [/accessToken|jwt|bearer|apikey|credential/iu, /audience|permission|disclos|allowed|entitle/iu]) {
        expect(types).not.toMatch(pattern);
      }
    });

    it('a deleted source and an unresolved grant together report the KNOWN fact, not the uncertainty', async () => {
      const envelope = envelopeOf([
        item(MOHAMED, 'ctx-m1', CONTENT_M),
        item(AHMED, 'ctx-a1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA, REF_B)),
      ]);
      const kit = harness({
        envelope,
        grants: { [IDS.mohamed]: foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM, REF_A), [IDS.ahmed]: { state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' } },
        sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: { state: 'DELETED_BY_OWNER' }, [sourceKey(IDS.ahmed, 'ctx-a1')]: AVAILABLE(digestReasoningContent(CONTENT_A)) },
      });
      expectStale(await kit.service.revalidate(envelope, OUTPUT), 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE');
    });
  });

  // -------------------------------------------------------------------------
  describe('empty private envelope (task §24, §46)', () => {
    it('46.58 an envelope with no private dependency still revalidates World and audience and performs zero private lookups', async () => {
      const envelope = EMPTY_ENVELOPE();
      const kit = harness({ envelope });
      const revalidation = currentOf(await kit.service.revalidate(envelope, OUTPUT));
      expect(kit.worldCalls).toEqual([WORLD]);
      expect(kit.audienceCalls).toEqual([WORLD]);
      expect(kit.grantCalls).toEqual([]);
      expect(kit.sourceCalls).toEqual([]);
      expect(revalidation.authorityStatus).toBe('CURRENT');
      expect(revalidation.sourceDisclosureAuthority).toBe('NOT_EVALUATED');
      expect(revalidation.systemSafetyAuthority).toBe('NOT_EVALUATED');
    });

    it('46.59 a stale World still blocks an envelope with zero private dependencies', async () => {
      const envelope = EMPTY_ENVELOPE();
      const closed = harness({ envelope, world: worldResolved('READ_ONLY_CLOSED') });
      expectStale(await closed.service.revalidate(envelope, OUTPUT), 'WORLD_READ_ONLY_CLOSED');
      const changed = harness({ envelope, world: worldResolved('ACTIVE', 'INTRODUCTION') });
      expectStale(await changed.service.revalidate(envelope, OUTPUT), 'WORLD_STATE_CHANGED');
    });

    it('46.60 a stale audience still blocks an envelope with zero private dependencies', async () => {
      const envelope = EMPTY_ENVELOPE();
      const empty = harness({ envelope, audience: AUDIENCE_EMPTY });
      expectStale(await empty.service.revalidate(envelope, OUTPUT), 'NO_ACTIVE_HUMANS');
      const expanded = harness({ envelope, audience: audienceResolved(audienceSnapshot([[MOHAMED, IDS.e1], [HADIR, IDS.e2], [AHMED, IDS.e3]])) });
      expectStale(await expanded.service.revalidate(envelope, OUTPUT), 'AUDIENCE_CHANGED');
    });
  });

  // -------------------------------------------------------------------------
  describe('exact output binding and revalidation identity (task §6, §26-§27, §47)', () => {
    it('47.61 the same output bytes always produce the same digest and the same revalidation', async () => {
      const envelope = ONE_ITEM();
      const first = currentOf(await harness({ envelope }).service.revalidate(envelope, OUTPUT));
      const second = currentOf(await harness({ envelope }).service.revalidate(envelope, OUTPUT));
      expect(second).toEqual(first);
      expect(first.outputDigest).toBe(digestProviderOutput(OUTPUT));
      expect(first.outputDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(first.outputDigest).toBe(`sha256:${createHash('sha256').update(OUTPUT, 'utf8').digest('hex')}`);
    });

    it('47.62 a one-byte output change changes the output digest', async () => {
      const variants = [OUTPUT, `${OUTPUT} `, OUTPUT.replace('higher', 'Higher'), `${OUTPUT}\n`, OUTPUT.slice(0, -1), '', 'x'];
      const digests = variants.map(digestProviderOutput);
      expect(new Set(digests).size).toBe(variants.length);
      // Byte-exact, not code-point-approximate: identical text in different encodings never collides.
      expect(digestProviderOutput('café')).not.toBe(digestProviderOutput('café'));
    });

    it('47.63 the revalidation reference changes when the output digest changes', async () => {
      const envelope = ONE_ITEM();
      const a = currentOf(await harness({ envelope }).service.revalidate(envelope, OUTPUT));
      const b = currentOf(await harness({ envelope }).service.revalidate(envelope, `${OUTPUT}!`));
      expect(b.outputDigest).not.toBe(a.outputDigest);
      expect(b.revalidationRef).not.toBe(a.revalidationRef);
      // A revalidation of output A therefore cannot be presented for output B.
      expect(a.revalidationRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
    });

    it('47.64 the revalidation reference changes when any bound fact changes', async () => {
      const base = {
        effectiveContextRef: AUTHORITY_REF('e1'),
        outputDigest: digestProviderOutput(OUTPUT),
        worldId: IDS.world,
        worldStateSnapshotRef: worldSnapshotRef(),
        audienceSnapshotRef: AUDIENCE.snapshotRef,
        items: [{ ownerHumanId: IDS.mohamed, contextId: 'ctx-m1', contentDigest: digestReasoningContent(CONTENT_M), grantId: IDS.grantM, authoritySnapshotRef: REF_A }],
      };
      const reference = fingerprintSharedDeliveryAuthorityRevalidation(base);
      expect(fingerprintSharedDeliveryAuthorityRevalidation(base)).toBe(reference);
      const variants = [
        { ...base, effectiveContextRef: AUTHORITY_REF('e2') },
        { ...base, outputDigest: digestProviderOutput(`${OUTPUT}!`) },
        { ...base, worldId: IDS.otherWorld },
        { ...base, worldStateSnapshotRef: worldSnapshotRef('ACTIVE', 'INTRODUCTION') },
        { ...base, audienceSnapshotRef: audienceRef([[MOHAMED, IDS.e1b], [HADIR, IDS.e2]]) },
        { ...base, items: [] },
        { ...base, items: [{ ...base.items[0], ownerHumanId: IDS.ahmed }] },
        { ...base, items: [{ ...base.items[0], contextId: 'ctx-m2' }] },
        { ...base, items: [{ ...base.items[0], contentDigest: digestReasoningContent(CONTENT_M2) }] },
        { ...base, items: [{ ...base.items[0], grantId: IDS.grantM2 }] },
        { ...base, items: [{ ...base.items[0], authoritySnapshotRef: REF_A2 }] },
        { ...base, items: [base.items[0], { ownerHumanId: IDS.ahmed, contextId: 'ctx-a1', contentDigest: digestReasoningContent(CONTENT_A), grantId: IDS.grantA, authoritySnapshotRef: REF_B }] },
      ];
      const refs = variants.map(fingerprintSharedDeliveryAuthorityRevalidation);
      expect(new Set([reference, ...refs]).size).toBe(refs.length + 1);
      // Item ORDER is bound, so two admitted items swapping places is a different revalidation.
      const swapped = { ...base, items: [...(variants[variants.length - 1].items as ReadonlyArray<(typeof base.items)[number]>)].reverse() };
      expect(fingerprintSharedDeliveryAuthorityRevalidation(swapped)).not.toBe(refs[refs.length - 1]);
      // A separator inside an identity cannot collide with the next field.
      const injected = { ...base, items: [{ ...base.items[0], contextId: `ctx-m1","${IDS.grantM}` }] };
      expect(fingerprintSharedDeliveryAuthorityRevalidation(injected)).not.toBe(reference);
    });

    it('47.65 no raw output, private content or reasoning text appears anywhere in the result', async () => {
      const secretOutput = `SECRET-OUTPUT-TOKEN ${CONTENT_M}`;
      const envelope = ONE_ITEM();
      const revalidation = currentOf(await harness({ envelope }).service.revalidate(envelope, secretOutput));
      const serialized = JSON.stringify(revalidation);
      for (const secret of ['SECRET-OUTPUT-TOKEN', CONTENT_M, 'prefers to avoid travel']) expect(serialized).not.toContain(secret);
      expect(serialized).toContain(revalidation.outputDigest);
    });

    it('47.66 the result uses no clock, no random identity and no secret', async () => {
      const envelope = ONE_ITEM();
      const first = currentOf(await harness({ envelope }).service.revalidate(envelope, OUTPUT));
      await new Promise((resolve) => setImmediate(resolve));
      const second = currentOf(await harness({ envelope }).service.revalidate(envelope, OUTPUT));
      expect(second.revalidationRef).toBe(first.revalidationRef);
      const source = executable('shared-delivery-authority-revalidator.service.ts');
      for (const pattern of [/randomUUID|Math\.random|\buuid\b/iu, /Date\.now|new Date|performance\.now|setTimeout|setInterval|hrtime/u, /process\.env|SUPABASE|SERVICE_ROLE|apikey|Authorization/iu]) {
        expect(source).not.toMatch(pattern);
      }
      expect(fingerprintSharedDeliveryAuthorityRevalidation({
        effectiveContextRef: 'a', outputDigest: 'b', worldId: 'C', worldStateSnapshotRef: 'd', audienceSnapshotRef: 'e', items: [],
      })).toBe(fingerprintSharedDeliveryAuthorityRevalidation({
        effectiveContextRef: 'a', outputDigest: 'b', worldId: 'c', worldStateSnapshotRef: 'd', audienceSnapshotRef: 'e', items: [],
      }));
    });
  });

  // -------------------------------------------------------------------------
  describe('the CURRENT result is authority freshness only (task §12, §30, §48-§49)', () => {
    it('carries exactly the frozen positions and nothing that could be read as permission', async () => {
      const envelope = ONE_ITEM();
      const revalidation = currentOf(await harness({ envelope }).service.revalidate(envelope, OUTPUT));
      expect(Object.keys(revalidation).sort()).toEqual([
        'audienceSnapshotRef', 'authorityStatus', 'deliveryCommitAuthority', 'directPrivateDisclosureAuthority',
        'effectiveContextRef', 'materialDisclosureAuthority', 'outputDigest', 'provenanceDisclosure',
        'revalidationRef', 'sourceDisclosureAuthority', 'systemSafetyAuthority', 'targetWorldId', 'worldStateSnapshotRef',
      ]);
      expect(revalidation.authorityStatus).toBe('CURRENT');
      expect(revalidation.sourceDisclosureAuthority).toBe('NOT_EVALUATED');
      expect(revalidation.systemSafetyAuthority).toBe('NOT_EVALUATED');
      expect(revalidation.deliveryCommitAuthority).toBe('NOT_GRANTED_BY_THIS_BOUNDARY');
      expect(revalidation.directPrivateDisclosureAuthority).toBe('NOT_GRANTED');
      expect(revalidation.materialDisclosureAuthority).toBe('NOT_GRANTED');
      expect(revalidation.provenanceDisclosure).toBe('SEALED');
      const serialized = JSON.stringify(revalidation);
      for (const forbidden of ['deliveryAllowed', '"allowed"', '"safe"', 'sourceDisclosureSafe', 'publishAllowed', 'materialDisclosureAllowed', 'DELIVERY_ALLOWED', 'SOURCE_DISCLOSURE_SAFE', 'true']) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(Object.isFrozen(revalidation)).toBe(true);
    });

    it('exposes no per-owner authority or source detail in any blocked result', async () => {
      const envelope = envelopeOf([
        item(MOHAMED, 'ctx-m1', CONTENT_M),
        item(AHMED, 'ctx-a1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA, REF_B)),
      ]);
      const blocked: SharedDeliveryAuthorityRevalidation[] = [
        await harness({ envelope, grants: { [IDS.mohamed]: notFoundGrant(), [IDS.ahmed]: foundGrant(AHMED, AUDIENCE.humans, IDS.grantA, REF_B) } }).service.revalidate(envelope, OUTPUT),
        await harness({ envelope, grants: { [IDS.mohamed]: foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM, REF_A), [IDS.ahmed]: { state: 'FOUND', authoritySnapshotRef: REF_B, grant: { grantId: IDS.grantA, worldId: WORLD, grantor: AHMED, status: 'REVOKED', audienceCeiling: AUDIENCE.humans } } } }).service.revalidate(envelope, OUTPUT),
        await harness({ envelope, sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: { state: 'DELETED_BY_OWNER' }, [sourceKey(IDS.ahmed, 'ctx-a1')]: AVAILABLE(digestReasoningContent(CONTENT_A)) } }).service.revalidate(envelope, OUTPUT),
        await harness({ envelope, grants: { [IDS.mohamed]: { state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' }, [IDS.ahmed]: foundGrant(AHMED, AUDIENCE.humans, IDS.grantA, REF_B) } }).service.revalidate(envelope, OUTPUT),
      ];
      for (const result of blocked) {
        expect(Object.keys(result).sort()).toEqual(['reason', 'state']);
        expect(result.state === 'STALE' || result.state === 'UNRESOLVED').toBe(true);
        const serialized = JSON.stringify(result);
        for (const secret of [IDS.mohamed, IDS.ahmed, IDS.grantM, IDS.grantA, 'ctx-m1', 'ctx-a1', CONTENT_M, CONTENT_A, 'REVOKED', 'NOT_FOUND', 'LOOKUP_FAILED', 'GRANT_REVOKED', 'NO_STANDING_CONTEXT_GRANT']) {
          expect(serialized).not.toContain(secret);
        }
      }
      // Revocation and absence are indistinguishable from outside: both are one bounded class.
      expect(blocked[0]).toEqual(blocked[1]);
    });

    it('never reports CURRENT when any dependency throws unexpectedly', async () => {
      const envelope = ONE_ITEM();
      const boom = new Error('unexpected');
      for (const options of [{ world: boom }, { audience: boom }, { grants: { [IDS.mohamed]: boom } }, { sources: { [sourceKey(IDS.mohamed, 'ctx-m1')]: boom } }]) {
        const result = await harness({ envelope, ...options }).service.revalidate(envelope, OUTPUT);
        expect(result.state).toBe('UNRESOLVED');
      }
    });

    it('every bounded reason class is reachable and none is invented', () => {
      expect([...SHARED_DELIVERY_AUTHORITY_STALE_REASONS]).toEqual([
        'WORLD_STATE_CHANGED', 'WORLD_READ_ONLY_CLOSED', 'AUDIENCE_CHANGED', 'NO_ACTIVE_HUMANS',
        'PRIVATE_AUTHORITY_CHANGED', 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE',
      ]);
      expect([...SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS]).toEqual([
        'MALFORMED_EFFECTIVE_CONTEXT', 'WORLD_STATE_UNRESOLVED', 'AUDIENCE_UNRESOLVED',
        'PRIVATE_AUTHORITY_UNRESOLVED', 'PRIVATE_SOURCE_STATE_UNRESOLVED',
      ]);
      // Neither vocabulary carries a per-participant, per-grant or per-source position.
      for (const reason of [...SHARED_DELIVERY_AUTHORITY_STALE_REASONS, ...SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS]) {
        expect(reason).not.toMatch(/REVOKED|ABSENT|DENIED|OWNER_|PARTICIPANT|GRANT_ID/u);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('end to end against a real I-03E envelope', () => {
    it('revalidates an EffectiveContext built by the frozen I-03E service through the same resolved state', async () => {
      const worldState = { async resolveCurrent() { return worldResolved(); } } as unknown as SharedPreModelWorldStateResolverService;
      const audience = { async resolveCurrent() { return audienceResolved(AUDIENCE); } } as unknown as SharedHumanAudienceResolverService;
      const grants = {
        async resolveCurrent(_worldId: SharedWorldId, grantor: HumanPrincipal) {
          return grantor.humanId === IDS.mohamed ? foundGrant(MOHAMED, AUDIENCE.humans, IDS.grantM, REF_A) : notFoundGrant();
        },
      } as unknown as StandingContextGrantResolverService;

      const built = await new SharedEffectiveContextService(worldState, audience, grants).resolve(WORLD, [
        { kind: 'MY_WORLD_PRIVATE_CONTEXT', contextId: 'ctx-m1', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED }, availability: 'AVAILABLE', reasoningContent: CONTENT_M },
        { kind: 'MY_WORLD_PRIVATE_CONTEXT', contextId: 'ctx-o1', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: OMAR }, availability: 'AVAILABLE', reasoningContent: CONTENT_A },
      ]);
      if (built.state !== 'READY') throw new Error(`fixture EffectiveContext is ${built.state}`);
      // Omar has no grant, so I-03E admitted Mohamed's context only.
      expect(built.effectiveContext.privateReasoningContexts).toHaveLength(1);

      const sources: SharedPrivateSourceStateResolver = { async resolveCurrent() { return AVAILABLE(digestReasoningContent(CONTENT_M)); } };
      const revalidator = new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, sources);
      const revalidation = currentOf(await revalidator.revalidate(built.effectiveContext, OUTPUT));
      expect(revalidation.effectiveContextRef).toBe(built.effectiveContext.effectiveContextRef);
      expect(revalidation.worldStateSnapshotRef).toBe(built.effectiveContext.worldStateSnapshotRef);
      expect(revalidation.audienceSnapshotRef).toBe(AUDIENCE.snapshotRef);
      expect(revalidation.authorityStatus).toBe('CURRENT');

      // The same envelope against a World that has since closed is stale, not delivered.
      const closed = { async resolveCurrent() { return worldResolved('READ_ONLY_CLOSED'); } } as unknown as SharedPreModelWorldStateResolverService;
      expectStale(await new SharedDeliveryAuthorityRevalidatorService(closed, audience, grants, sources).revalidate(built.effectiveContext, OUTPUT), 'WORLD_READ_ONLY_CLOSED');

      // And after Mohamed revokes, the already generated output is stale.
      const revoked = { async resolveCurrent() { return notFoundGrant(); } } as unknown as StandingContextGrantResolverService;
      expectStale(await new SharedDeliveryAuthorityRevalidatorService(worldState, audience, revoked, sources).revalidate(built.effectiveContext, OUTPUT), 'PRIVATE_AUTHORITY_CHANGED');
    });
  });

  // -------------------------------------------------------------------------
  describe('scope guard (task §8, §28-§34, §38, §50-§51)', () => {
    it('contains exactly the three production files and their one spec, with closed import sets', () => {
      expect(readdirSync(__dirname).filter((name) => name.endsWith('.ts')).sort()).toEqual([
        'shared-delivery-authority-revalidator.service.spec.ts',
        'shared-delivery-authority-revalidator.service.ts',
        'shared-delivery-authority.types.ts',
        'shared-private-source-state-resolver.types.ts',
      ]);
      expect(readdirSync(__dirname).filter((name) => !name.endsWith('.ts'))).toEqual([]);
      expect(imports(executable('shared-delivery-authority.types.ts'))).toEqual(['../kernel/world.types']);
      expect(imports(executable('shared-private-source-state-resolver.types.ts'))).toEqual(['../effective-context/shared-effective-context.types']);
      expect(imports(executable('shared-delivery-authority-revalidator.service.ts'))).toEqual([
        '../audience/shared-human-audience-resolver.service',
        '../authority-resolution/standing-context-grant-resolver.service',
        '../authority/standing-context-authority',
        '../authority/standing-context-authority.types',
        '../effective-context/shared-effective-context.service',
        '../effective-context/shared-effective-context.types',
        '../effective-context/shared-pre-model-world-state-resolver.service',
        '../kernel/principal.types',
        '../kernel/world-invariants',
        '../kernel/world.types',
        './shared-delivery-authority.types',
        './shared-private-source-state-resolver.types',
        '@nestjs/common',
        'node:crypto',
      ]);
      for (const file of PRODUCTION) expect(executable(file)).not.toMatch(/\brequire\(|\bimport\(/u);
    });

    it('implements no Source Disclosure Gate: no detector, classifier, similarity measure, redaction or provider self-declaration', () => {
      for (const file of PRODUCTION) {
        const source = executable(file);
        for (const pattern of [
          /\bquote\b|quoting|verbatim|excerpt|snippet|paraphras/iu,
          /redact|mask\(|scrub|sanitizeOutput|rewrite|summar|rerank|truncat/iu,
          /Classifier|classifyOutput|classifyDisclos|detector|detect\w*(?:Disclos|Leak|Quote|Fact)|semanticMatch/iu,
          /similar|threshold|embedding|cosine|jaccard|levenshtein|distance\(|ratio\(/iu,
          /sourceDisclosureSafe|disclosureSafe|declaredSafe|providerAsserts|selfDeclar/iu,
          /'SAFE'|'UNSAFE'|isSafe|markSafe/u,
        ]) {
          expect(source).not.toMatch(pattern);
        }
      }
      // The output text is never inspected: it is hashed, and nothing else.
      const service = executable('shared-delivery-authority-revalidator.service.ts');
      expect(service).not.toMatch(/outputText\s*[.[]/u);
      expect(service).toContain("createHash('sha256').update(outputText, 'utf8')");
      expect(service).toContain("if (typeof outputText !== 'string') return unresolved('MALFORMED_EFFECTIVE_CONTEXT');");
    });

    it('grants no delivery, material, disclosure, publication, Replay, history, Matching or Public authority', () => {
      for (const file of PRODUCTION) {
        const source = executable(file);
        for (const pattern of [
          /deliveryAllowed|publishAllowed|materialDisclosureAllowed|canDeliver|mayDeliver|allowDelivery/u,
          /\ballowed\s*:|\bsafe\s*:|\bpermitted\s*:|\bgranted\s*:\s*true/u,
          /'DISCLOSE_PRIVATE_FACT'|'QUOTE'|'MATERIAL_TRANSFER'|'PUBLICATION'|'REPLAY_DISTRIBUTION'|'HISTORY_ACCESS'|'DELIVERY_ALLOWED'|'SOURCE_DISCLOSURE_SAFE'/u,
          /SourceMaterialRef|materialId|MATERIAL_DEPENDENCY|REASONING_DEPENDENCY|SEALED_PROVENANCE_DEPENDENCY|ProvenanceRecord|HistoryAccess|ReplayArtifact/u,
          /MATCHING|PUBLIC_WORLD|PublicExperience|Introduction Profile/u,
        ]) {
          expect(source).not.toMatch(pattern);
        }
      }
    });

    it('persists, commits and mutates nothing, reaches no database, provider, Personal runtime, route or Nest registration', () => {
      for (const file of PRODUCTION) {
        const source = executable(file);
        for (const pattern of [
          /\b(?:INSERT|UPDATE|MERGE|TRUNCATE|SELECT|CREATE TABLE)\b/u,
          /persist|\bcommit\b|outbox|auditEvent|writeAudit|\.save\(|repository|CanonicalStore/iu,
          /model-router|ModelRouter|intelligence-runtime|IntegratedContext|conversation|human-model|memoryContext|behavioralGuidance|openai|anthropic|@qandeel\/runtime/iu,
          /\bfetch\b|axios|XMLHttpRequest|\/rest\/v1\/|http[s]?:\/\//u,
          /SUPABASE|SERVICE_ROLE|accessToken|\bjwt\b|auth\.uid|apikey|Authorization/iu,
          // Spelled without any full table name: the frozen 0078 contract bans the
          // consent-event table name in every API file, so a literal here would fail it.
          /shared_worlds|membership_episodes|standing_context_\w*(?:grants|consent)|grant_audience|conversation_turns|conversation_sessions|memories/u,
          /@Controller|@Get|@Post|@Put|@Patch|@Delete|@Module|@WebSocketGateway|express|\.dto\b/u,
        ]) {
          expect(source).not.toMatch(pattern);
        }
      }
      // Exactly one Nest surface: an injectable service, with no module registration anywhere.
      const service = executable('shared-delivery-authority-revalidator.service.ts');
      expect(service.match(/@Injectable\(\)/gu)).toHaveLength(1);
      expect(service.match(/@Inject\(/gu)).toHaveLength(1);
    });

    it('reuses the frozen I-03A, I-03B, I-03D and I-03E boundaries without reinterpreting them', () => {
      const service = executable('shared-delivery-authority-revalidator.service.ts');
      // Exactly one authority evaluation site, and it is the frozen evaluator.
      expect(service.match(/evaluateStandingContextAuthority\(/gu)).toHaveLength(1);
      expect(service).toMatch(/action: STANDING_CONTEXT_ACTION,\s+grantor: Object\.freeze\(\{ kind: 'HUMAN', humanId: item\.ownerHumanId \} as const\),\s+targetWorldId: envelope\.targetWorldId,\s+purpose: STANDING_CONTEXT_PURPOSE,\s+audienceSnapshot: currentAudience,/u);
      // The frozen I-03E fingerprint helper is reused; no competing fingerprint of the envelope exists.
      expect(service).toContain('const recomputed = fingerprintSharedEffectiveContext({');
      expect(service).toContain("if (recomputed !== envelope.effectiveContextRef) return unresolved('MALFORMED_EFFECTIVE_CONTEXT');");
      expect(service).not.toMatch(/QANDEEL_CWV2_SHARED_EFFECTIVE_CONTEXT/u);
      // No new action, purpose, grant type, TTL or permission engine.
      for (const pattern of [/'REASON_FROM_PRIVATE_CONTEXT'|'SHARED_REASONING'/u, /\bTTL\b|expiresAt|expiry|ttlSeconds/iu, /\bcan[A-Z]\w*\(|\bmay[A-Z]\w*\(|isAuthorized|checkPermission|evaluatePolicy|PolicyEngine|PermissionEngine/u]) {
        expect(service).not.toMatch(pattern);
      }
      // The gates in their frozen order, each fail-closed.
      expect(service).toContain("if (currentWorld.lifecycle === 'READ_ONLY_CLOSED') return stale('WORLD_READ_ONLY_CLOSED');");
      expect(service).toContain("if (currentWorld.snapshotRef !== envelope.worldStateSnapshotRef) return stale('WORLD_STATE_CHANGED');");
      expect(service).toContain("if (isEmptyAudience(audience)) return stale('NO_ACTIVE_HUMANS');");
      expect(service).toContain("if (currentAudience.snapshotRef !== envelope.audienceSnapshotRef) return stale('AUDIENCE_CHANGED');");
      expect(service.indexOf('this.worldState.resolveCurrent')).toBeLessThan(service.indexOf('this.audience.resolveCurrent'));
      expect(service.indexOf('this.audience.resolveCurrent')).toBeLessThan(service.indexOf('this.grants.resolveCurrent'));
      expect(service.indexOf('this.grants.resolveCurrent')).toBeLessThan(service.indexOf('this.sources.resolveCurrent'));
      expect(service).toContain('const owners = [...new Set(envelope.items.map((item) => item.ownerHumanId))];');
      // No membership-of-grantor rule and no "close enough" audience comparison is invented.
      expect(service).not.toMatch(/humans\.(?:some|includes|find|indexOf|filter)\(/u);
      expect(service).not.toMatch(/isSubset|isSuperset|intersect|overlap|closeEnough|approximately/iu);
      const revalidator = new SharedDeliveryAuthorityRevalidatorService(
        {} as unknown as SharedPreModelWorldStateResolverService,
        {} as unknown as SharedHumanAudienceResolverService,
        {} as unknown as StandingContextGrantResolverService,
        {} as unknown as SharedPrivateSourceStateResolver,
      );
      expect(revalidator.revalidate.length).toBe(2);
      expect(SHARED_DELIVERY_AUTHORITY_REVALIDATION_VERSION).toBe('QANDEEL_CWV2_SHARED_DELIVERY_AUTHORITY_REVALIDATION_V1');
    });

    it('states its own boundary in the result vocabulary, and the guard is not vacuous', () => {
      const types = executable('shared-delivery-authority.types.ts');
      for (const literal of ["readonly authorityStatus: 'CURRENT';", "readonly sourceDisclosureAuthority: 'NOT_EVALUATED';", "readonly systemSafetyAuthority: 'NOT_EVALUATED';",
        "readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';", "readonly directPrivateDisclosureAuthority: 'NOT_GRANTED';",
        "readonly materialDisclosureAuthority: 'NOT_GRANTED';", "readonly provenanceDisclosure: 'SEALED';"]) {
        expect(types).toContain(literal);
      }
      for (const file of PRODUCTION) expect(executable(file).length).toBeGreaterThan(500);
      // The comment-only phrasing really was stripped, so the bans above were answered by executable code.
      expect(executable('shared-delivery-authority-revalidator.service.ts')).not.toContain('Narrow Source Disclosure Gate');
      expect(readFileSync(join(__dirname, 'shared-delivery-authority-revalidator.service.ts'), 'utf8')).toContain('Narrow Source Disclosure Gate');
    });
  });
});

// --- static-guard helpers -------------------------------------------------------

const PRODUCTION = ['shared-delivery-authority.types.ts', 'shared-private-source-state-resolver.types.ts', 'shared-delivery-authority-revalidator.service.ts'] as const;

function executable(file: string): string {
  return readFileSync(join(__dirname, file), 'utf8')
    .replace(/\r\n/gu, '\n')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^[ \t]*\/\/.*$/gmu, '')
    .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');
}

function imports(source: string): ReadonlyArray<string> {
  return [...new Set([...source.matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]))].sort();
}
