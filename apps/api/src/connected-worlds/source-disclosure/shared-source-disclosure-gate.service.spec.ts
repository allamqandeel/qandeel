import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest, SharedWorldLifecycle, SharedWorldPhase } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import { evaluateStandingContextAuthority } from '../authority/standing-context-authority';
import { STANDING_CONTEXT_ACTION, STANDING_CONTEXT_PURPOSE } from '../authority/standing-context-authority.types';
import type { SharedHumanAudienceSnapshot, StandingContextGrantResolution } from '../authority/standing-context-authority.types';
import type { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedHumanAudienceResolverService, fingerprintSharedHumanAudience } from '../audience/shared-human-audience-resolver.service';
import { SharedPreModelWorldStateResolverService, fingerprintSharedPreModelWorldState } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { SharedEffectiveContextService, digestReasoningContent, fingerprintSharedEffectiveContext } from '../effective-context/shared-effective-context.service';
import type {
  AuthorizedPrivateReasoningContext,
  SharedEffectiveContext,
  SharedPrivateContextCandidate,
  StandingContextAllowDecision,
} from '../effective-context/shared-effective-context.types';
import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import {
  SHARED_SOURCE_DISCLOSURE_DETECTOR_FAILURES,
  SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES,
} from './shared-source-disclosure-detector.types';
import type { SharedSourceDisclosureDetectionRequest, SharedSourceDisclosureDetector } from './shared-source-disclosure-detector.types';
import {
  SHARED_SOURCE_DISCLOSURE_GATE_BASES,
  SHARED_SOURCE_DISCLOSURE_UNRESOLVED_REASONS,
} from './shared-source-disclosure.types';
import type { SharedSourceDisclosureClearance, SharedSourceDisclosureGateResult } from './shared-source-disclosure.types';
import {
  SHARED_PROTECTED_SOURCE_SET_VERSION,
  SHARED_SOURCE_DISCLOSURE_GATE_VERSION,
  SharedSourceDisclosureGateService,
  fingerprintSharedProtectedSourceSet,
  fingerprintSharedSourceDisclosureGate,
} from './shared-source-disclosure-gate.service';

const IDS = {
  world: '10000000-0000-4000-8000-00000000000a',
  otherWorld: '10000000-0000-4000-8000-00000000000b',
  mohamed: '20000000-0000-4000-8000-000000000001',
  hadir: '20000000-0000-4000-8000-000000000002',
  ahmed: '20000000-0000-4000-8000-000000000003',
  grantM: '30000000-0000-4000-8000-000000000001',
  grantA: '30000000-0000-4000-8000-000000000003',
  e1: '40000000-0000-4000-8000-000000000001',
  e2: '40000000-0000-4000-8000-000000000002',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human(IDS.mohamed);
const HADIR = human(IDS.hadir);
const AHMED = human(IDS.ahmed);

// A SharedWorldId exists only through a valid Shared World birth (I-01A); the
// gate never mints one, so the fixtures obtain theirs the same way.
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

/** Higher-level advice that is plainly influenced by private context and quotes none of it (CW2-02 §19-§20, B16). */
const OUTPUT = 'Mid-month looks like the better window for the three of you, and keeping the budget conservative is worth it.';
const ASSESSMENT_REF = 'assessment:9f2c';
const POLICY_REF = 'detector-policy:v7';

// --- canonical fixtures ---------------------------------------------------------

const worldSnapshotRef = (lifecycle: SharedWorldLifecycle = 'ACTIVE', phase: SharedWorldPhase = 'STANDARD', worldId: string = IDS.world): string =>
  fingerprintSharedPreModelWorldState({ worldId, lifecycle, phase });

const audienceRef = (members: ReadonlyArray<[HumanPrincipal, string]>): string =>
  fingerprintSharedHumanAudience({ state: 'RESOLVED', worldId: IDS.world, members: members.map(([who, episode]) => ({ userId: who.humanId, membershipEpisodeId: episode })) });
const PAIR: ReadonlyArray<[HumanPrincipal, string]> = [[MOHAMED, IDS.e1], [HADIR, IDS.e2]];
const audienceSnapshot = (members: ReadonlyArray<[HumanPrincipal, string]> = PAIR): SharedHumanAudienceSnapshot =>
  ({ snapshotRef: audienceRef(members), humans: members.map(([who]) => who) });
const AUDIENCE = audienceSnapshot();

const foundGrant = (
  grantor: HumanPrincipal,
  ceiling: ReadonlyArray<HumanPrincipal>,
  grantId = IDS.grantM,
  authoritySnapshotRef = REF_A,
  worldId: SharedWorldId = WORLD,
): StandingContextGrantResolution => ({ state: 'FOUND', authoritySnapshotRef, grant: { grantId, worldId, grantor, status: 'ACTIVE', audienceCeiling: ceiling } });

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

// Deliberately awkward bytes: a newline, a combining sequence, an emoji and a
// right-to-left script, so "byte-for-byte" means something.
const CONTENT_M = 'Mohamed avoids travel in the first week of the month.\nHe did not say why.';
const CONTENT_M2 = 'Mohamed has a standing commitment on Thursday evenings — ‎موعد ثابت‎ 🗓';
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
const TWO_OWNERS = () => envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M), item(AHMED, 'ctx-a1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA))]);
const EMPTY_ENVELOPE = () => envelopeOf([]);

/** Structural surgery on a sealed envelope: the fingerprint is NOT recomputed, exactly as a tampering caller would leave it. */
function tamper(envelope: SharedEffectiveContext, mutate: (draft: Record<string, unknown>) => void): SharedEffectiveContext {
  const draft = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
  mutate(draft);
  return draft as unknown as SharedEffectiveContext;
}

/** Structural surgery that re-seals: only the mutated fact differs, never the fingerprint's own consistency. */
function reseal(envelope: SharedEffectiveContext, mutate: (draft: Record<string, unknown>) => void): SharedEffectiveContext {
  const draft = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
  mutate(draft);
  const items = draft.privateReasoningContexts as ReadonlyArray<AuthorizedPrivateReasoningContext>;
  draft.effectiveContextRef = fingerprintSharedEffectiveContext({
    worldId: draft.targetWorldId as string,
    worldStateSnapshotRef: draft.worldStateSnapshotRef as string,
    audienceSnapshotRef: (draft.audienceSnapshot as SharedHumanAudienceSnapshot).snapshotRef,
    items: items.map((entry) => ({
      ownerHumanId: entry.source.originWorld.owner.humanId,
      contextId: entry.source.contextId,
      contentDigest: entry.contentDigest,
      grantId: entry.authority.binding.grantId,
      authoritySnapshotRef: entry.authority.binding.authoritySnapshotRef,
    })),
  });
  return draft as unknown as SharedEffectiveContext;
}

// --- the detector fake ----------------------------------------------------------

/**
 * What the fake detector answers with: an `Error` it throws, a function of the
 * exact request, or any literal payload - including the malformed ones a real
 * boundary has to survive.
 */
type Answer = unknown;

const clearFor = (request: SharedSourceDisclosureDetectionRequest): unknown => ({
  state: 'CLEAR',
  assessmentRef: ASSESSMENT_REF,
  detectorPolicyRef: POLICY_REF,
  binding: { effectiveContextRef: request.effectiveContextRef, outputDigest: request.outputDigest, protectedSourceSetRef: request.protectedSourceSetRef },
});

const detectedFor = (findings: ReadonlyArray<unknown>) => (request: SharedSourceDisclosureDetectionRequest): unknown => ({
  state: 'DETECTED',
  assessmentRef: ASSESSMENT_REF,
  detectorPolicyRef: POLICY_REF,
  binding: { effectiveContextRef: request.effectiveContextRef, outputDigest: request.outputDigest, protectedSourceSetRef: request.protectedSourceSetRef },
  findings,
});

interface Kit {
  readonly service: SharedSourceDisclosureGateService;
  readonly requests: SharedSourceDisclosureDetectionRequest[];
}

function harness(answer: Answer = clearFor): Kit {
  const requests: SharedSourceDisclosureDetectionRequest[] = [];
  const detector: SharedSourceDisclosureDetector = {
    async assess(request) {
      requests.push(request);
      const resolved = typeof answer === 'function' ? (answer as (r: SharedSourceDisclosureDetectionRequest) => unknown)(request) : answer;
      if (resolved instanceof Error) throw resolved;
      return resolved as Awaited<ReturnType<SharedSourceDisclosureDetector['assess']>>;
    },
  };
  return { service: new SharedSourceDisclosureGateService(detector), requests };
}

function clearanceOf(result: SharedSourceDisclosureGateResult): SharedSourceDisclosureClearance {
  if (result.state !== 'CLEAR') throw new Error(`expected CLEAR, got ${result.state}: ${JSON.stringify(result)}`);
  return result.gate;
}

const expectUnresolved = (result: SharedSourceDisclosureGateResult, reason: string): void => {
  expect(result).toEqual({ state: 'UNRESOLVED', reason });
};
const expectBlocked = (result: SharedSourceDisclosureGateResult): void => {
  expect(result).toEqual({ state: 'BLOCKED', reason: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED' });
};

describe('SharedSourceDisclosureGateService', () => {
  // -------------------------------------------------------------------------
  describe('malformed generation artifact, refused before the detector is told anything (task §16, §42)', () => {
    const refuses = async (envelope: unknown, note: string, output: unknown = OUTPUT): Promise<void> => {
      const kit = harness();
      const result = await kit.service.evaluate(envelope as SharedEffectiveContext, output as string);
      expectUnresolved(result, 'MALFORMED_GENERATION_ARTIFACT');
      expect({ note, detectorCalls: kit.requests.length }).toEqual({ note, detectorCalls: 0 });
    };

    it('1. refuses a non-object or non-envelope value', async () => {
      for (const value of [null, undefined, 'envelope', 42, true, [], new Date(), () => ONE_ITEM()]) {
        await refuses(value, `non-envelope ${String(value)}`);
      }
    });

    it('2. refuses a missing or extra top-level field', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => { delete draft.worldStateSnapshotRef; }), 'missing field');
      await refuses(tamper(ONE_ITEM(), (draft) => { delete draft.audienceSnapshot; }), 'missing audience');
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.sourceDisclosureSafe = true; }), 'smuggled clearance claim');
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.deliveryAllowed = true; }), 'smuggled delivery claim');
    });

    it('3. refuses a blank effectiveContextRef', async () => {
      for (const value of ['', '   ', null, 7]) await refuses(tamper(ONE_ITEM(), (draft) => { draft.effectiveContextRef = value; }), `ref ${String(value)}`);
    });

    it('4. refuses an invalid Shared target identity', async () => {
      for (const value of ['', '  ', null, 5, 'MY_WORLD', 'PUBLIC_WORLD', 'MATCHING', 'REPLAY', 'INTRODUCTION']) {
        await refuses(tamper(ONE_ITEM(), (draft) => { draft.targetWorldId = value; }), `world ${String(value)}`);
      }
    });

    it('5. refuses a blank worldStateSnapshotRef', async () => {
      for (const value of ['', '\t', null]) await refuses(tamper(ONE_ITEM(), (draft) => { draft.worldStateSnapshotRef = value; }), `worldState ${String(value)}`);
    });

    it('6. refuses a malformed audience snapshot', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.audienceSnapshot = null; }), 'null audience');
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.audienceSnapshot = { snapshotRef: AUDIENCE.snapshotRef }; }), 'missing humans');
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.audienceSnapshot as Record<string, unknown>).snapshotRef = '  '; }), 'blank audience ref');
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.audienceSnapshot as Record<string, unknown>).humans = []; }), 'empty audience');
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.audienceSnapshot as Record<string, unknown>).humans = [{ kind: 'QANDEEL' }]; }), 'non-human audience member');
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.audienceSnapshot as Record<string, unknown>).humans = [{ kind: 'HUMAN', humanId: IDS.mohamed, role: 'OWNER' }]; }), 'extra member property');
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.audienceSnapshot as Record<string, unknown>).epoch = 3; }), 'extra audience property');
    });

    it('7. refuses a duplicated audience human', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => {
        (draft.audienceSnapshot as Record<string, unknown>).humans = [MOHAMED, HADIR, MOHAMED];
      }), 'duplicate human');
    });

    it('8. refuses a malformed private-context array', async () => {
      for (const value of [null, undefined, {}, 'none', 3]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { draft.privateReasoningContexts = value; }), `items ${String(value)}`);
      }
    });

    it('9. refuses a malformed item', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as unknown[])[0] = null; }), 'null item');
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].kind = 'EXPLICIT_DISCLOSURE'; }), 'wrong kind');
      await refuses(tamper(ONE_ITEM(), (draft) => { delete (draft.privateReasoningContexts as Record<string, unknown>[])[0].authority; }), 'missing authority');
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].materialId = 'm-1'; }), 'smuggled material reference');
    });

    it('10. refuses a non-MY_WORLD source origin', async () => {
      for (const origin of [
        { architectureClass: 'WORLD', worldType: 'SHARED_WORLD', owner: MOHAMED },
        { architectureClass: 'WORLD', worldType: 'PUBLIC_WORLD', owner: MOHAMED },
        { architectureClass: 'CAPABILITY', worldType: 'MY_WORLD', owner: MOHAMED },
      ]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].source = { contextId: 'ctx-m1', originWorld: origin }; }), `origin ${origin.worldType}`);
      }
    });

    it('11. refuses a non-human source owner', async () => {
      for (const owner of [{ kind: 'QANDEEL' }, { kind: 'HUMAN', humanId: '   ' }, { kind: 'HUMAN' }, null] as ReadonlyArray<unknown>) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          ((draft.privateReasoningContexts as Record<string, unknown>[])[0].source as Record<string, Record<string, unknown>>).originWorld.owner = owner;
        }), `owner ${JSON.stringify(owner)}`);
      }
    });

    it('12. refuses a blank contextId', async () => {
      for (const value of ['', '   ', null, 9]) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          ((draft.privateReasoningContexts as Record<string, unknown>[])[0].source as Record<string, unknown>).contextId = value;
        }), `contextId ${String(value)}`);
      }
    });

    it('13. refuses a duplicated source identity', async () => {
      const twice = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M), item(MOHAMED, 'ctx-m1', CONTENT_M2)]);
      await refuses(twice, 'same owner, same context id, twice');
    });

    it('14. refuses a malformed contentDigest', async () => {
      for (const value of ['sha256:not-hex', `SHA256:${'a'.repeat(64)}`, `sha256:${'A'.repeat(64)}`, `sha256:${'a'.repeat(63)}`, 'a'.repeat(64), '', null]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].contentDigest = value; }), `digest ${String(value)}`);
      }
    });

    it('15. refuses non-string reasoning content', async () => {
      for (const value of [null, undefined, 42, { text: CONTENT_M }, [CONTENT_M]]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].reasoningContent = value; }), `content ${String(value)}`);
      }
    });

    it('16. refuses a contentDigest that does not describe its own reasoning content', async () => {
      // The exact bytes are what the detector will be asked to judge, so a digest
      // that names different bytes would bind one operation identity to another
      // operation's content. Both directions of the drift are refused.
      await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].reasoningContent = `${CONTENT_M} `; }), 'content drifted from digest');
      await refuses(reseal(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].contentDigest = digestReasoningContent(CONTENT_A); }), 'digest drifted from content, re-sealed');
    });

    it('17. refuses a non-ALLOW authority', async () => {
      for (const authority of [
        { decision: 'DENY', externalEffect: 'BLOCKED', reason: 'GRANT_REVOKED' },
        { decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason: 'GRANT_STATE_UNRESOLVED' },
        null,
      ]) {
        await refuses(tamper(ONE_ITEM(), (draft) => { (draft.privateReasoningContexts as Record<string, unknown>[])[0].authority = authority; }), `authority ${JSON.stringify(authority)}`);
      }
    });

    it('18. refuses widened, narrowed or re-spelled ALLOW constraints', async () => {
      for (const [key, value] of [
        ['directPrivateDisclosureAuthority', 'GRANTED'],
        ['materialDisclosureAuthority', 'GRANTED'],
        ['provenanceDisclosure', 'DISCLOSABLE'],
        ['deliveryAuthority', 'GRANTED'],
        ['contextClassification', 'SHARED_NATIVE_CONTEXT'],
        ['reasoningAuthority', 'DENY'],
      ] as ReadonlyArray<[string, string]>) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          ((draft.privateReasoningContexts as Record<string, Record<string, Record<string, unknown>>>[])[0].authority.constraints)[key] = value;
        }), `constraint ${key}=${value}`);
      }
      await refuses(tamper(ONE_ITEM(), (draft) => {
        ((draft.privateReasoningContexts as Record<string, Record<string, Record<string, unknown>>>[])[0].authority.constraints).quoteAuthority = 'GRANTED';
      }), 'extra constraint');
      await refuses(tamper(ONE_ITEM(), (draft) => {
        (draft.privateReasoningContexts as Record<string, Record<string, unknown>>[])[0].authority.externalEffect = 'ADMIT_FOR_DISCLOSURE';
      }), 'widened external effect');
    });

    it('19. refuses a binding whose grantor is not the source owner', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => {
        (draft.privateReasoningContexts as Record<string, Record<string, Record<string, unknown>>>[])[0].authority.binding.grantorHumanId = IDS.hadir;
      }), 'foreign grantor');
    });

    it('20. refuses a binding whose target World is not the envelope World', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => {
        (draft.privateReasoningContexts as Record<string, Record<string, Record<string, unknown>>>[])[0].authority.binding.targetWorldId = OTHER_WORLD;
      }), 'foreign World');
    });

    it('21. refuses a binding whose audience reference is not the envelope audience reference', async () => {
      await refuses(tamper(ONE_ITEM(), (draft) => {
        (draft.privateReasoningContexts as Record<string, Record<string, Record<string, unknown>>>[])[0].authority.binding.audienceSnapshotRef = AUTHORITY_REF('ff');
      }), 'foreign audience ref');
    });

    it('22. refuses a binding whose audience set is not the envelope audience', async () => {
      for (const ids of [[IDS.mohamed], [IDS.mohamed, IDS.hadir, IDS.ahmed], [IDS.mohamed, IDS.ahmed], []]) {
        await refuses(tamper(ONE_ITEM(), (draft) => {
          (draft.privateReasoningContexts as Record<string, Record<string, Record<string, unknown>>>[])[0].authority.binding.audienceHumanIds = ids;
        }), `audience ids ${ids.length}`);
      }
    });

    it('23. refuses two items of one owner carrying contradictory bindings', async () => {
      const contradictory = envelopeOf([
        item(MOHAMED, 'ctx-m1', CONTENT_M),
        item(MOHAMED, 'ctx-m2', CONTENT_M2, allowDecision(MOHAMED, AUDIENCE, IDS.grantA, AUTHORITY_REF('a9'))),
      ]);
      await refuses(contradictory, 'one owner, two authority bindings');
    });

    it('24. refuses an envelope whose recomputed I-03E fingerprint does not match', async () => {
      // Every fact the fingerprint binds: a caller that edits one and keeps the
      // old reference is refused, even though each individual shape is legal.
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.effectiveContextRef = fingerprintSharedEffectiveContext({ worldId: IDS.world, worldStateSnapshotRef: worldSnapshotRef(), audienceSnapshotRef: AUDIENCE.snapshotRef, items: [] }); }), 'fingerprint of a different item set');
      await refuses(tamper(ONE_ITEM(), (draft) => { draft.worldStateSnapshotRef = worldSnapshotRef('ACTIVE', 'INTRODUCTION'); }), 'World state edited, reference kept');
      const reordered = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M), item(AHMED, 'ctx-a1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA))]);
      await refuses(tamper(reordered, (draft) => { (draft.privateReasoningContexts as unknown[]).reverse(); }), 'items reordered, reference kept');
    });

    it('25. refuses a non-string output', async () => {
      // Called directly rather than through `refuses`: an explicit `undefined`
      // output is a payload the gate must refuse, and a defaulted parameter
      // would quietly turn it into the valid one.
      for (const value of [null, undefined, 42, {}, [OUTPUT], Buffer.from(OUTPUT), Symbol('output')] as ReadonlyArray<unknown>) {
        const kit = harness();
        const result = await kit.service.evaluate(ONE_ITEM(), value as string);
        expect({ note: String(typeof value), result, detectorCalls: kit.requests.length })
          .toEqual({ note: String(typeof value), result: { state: 'UNRESOLVED', reason: 'MALFORMED_GENERATION_ARTIFACT' }, detectorCalls: 0 });
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('protected source set identity (task §14, §43)', () => {
    const refOf = async (envelope: SharedEffectiveContext, output = OUTPUT): Promise<string> => {
      const kit = harness();
      await kit.service.evaluate(envelope, output);
      expect(kit.requests).toHaveLength(1);
      return kit.requests[0].protectedSourceSetRef;
    };

    it('26. is identical for the same exact envelope, and is a canonical sha256', async () => {
      const first = await refOf(ONE_ITEM());
      const second = await refOf(ONE_ITEM());
      expect(first).toBe(second);
      expect(first).toMatch(/^sha256:[0-9a-f]{64}$/u);
    });

    it('27. changes when a private source is added or removed', async () => {
      const one = await refOf(ONE_ITEM());
      const two = await refOf(TWO_OWNERS());
      expect(two).not.toBe(one);
    });

    it('28. changes when the source owner changes', async () => {
      const mine = await refOf(envelopeOf([item(MOHAMED, 'ctx-x', CONTENT_M)]));
      const theirs = await refOf(envelopeOf([item(AHMED, 'ctx-x', CONTENT_M, allowDecision(AHMED, AUDIENCE, IDS.grantA))]));
      expect(theirs).not.toBe(mine);
    });

    it('29. changes when the contextId changes', async () => {
      expect(await refOf(envelopeOf([item(MOHAMED, 'ctx-m2', CONTENT_M)]))).not.toBe(await refOf(ONE_ITEM()));
    });

    it('30. changes when the content digest changes', async () => {
      expect(await refOf(envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M2)]))).not.toBe(await refOf(ONE_ITEM()));
    });

    it('31. changes when the admitted item order changes', async () => {
      const forward = await refOf(TWO_OWNERS());
      const backward = await refOf(envelopeOf([item(AHMED, 'ctx-a1', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA)), item(MOHAMED, 'ctx-m1', CONTENT_M)]));
      expect(backward).not.toBe(forward);
    });

    it('32. keeps the same opaque contextId under two owners as two distinct sources', async () => {
      const shared = envelopeOf([item(MOHAMED, 'ctx-same', CONTENT_M), item(AHMED, 'ctx-same', CONTENT_A, allowDecision(AHMED, AUDIENCE, IDS.grantA))]);
      const kit = harness();
      await kit.service.evaluate(shared, OUTPUT);
      expect(kit.requests[0].protectedSources).toHaveLength(2);
      expect(kit.requests[0].protectedSources.map((entry) => entry.source.originWorld.owner.humanId)).toEqual([IDS.mohamed, IDS.ahmed]);
      // And it is not the fingerprint of a single deduplicated source.
      expect(kit.requests[0].protectedSourceSetRef).not.toBe(await refOf(envelopeOf([item(MOHAMED, 'ctx-same', CONTENT_M)])));
    });

    it('33. never takes raw reasoning content as fingerprint material', async () => {
      const envelope = ONE_ITEM();
      const observed = await refOf(envelope);
      // Recomputed from the canonical facts only - owner, context id, digest -
      // with the content nowhere in the call.
      expect(observed).toBe(fingerprintSharedProtectedSourceSet({
        effectiveContextRef: envelope.effectiveContextRef,
        items: [{ ownerHumanId: IDS.mohamed, contextId: 'ctx-m1', contentDigest: digestReasoningContent(CONTENT_M) }],
      }));
      expect(SHARED_PROTECTED_SOURCE_SET_VERSION).toBe('QANDEEL_CWV2_SHARED_PROTECTED_SOURCE_SET_V1');
    });

    it('34. uses no clock, no random value and no secret', async () => {
      const first = await refOf(ONE_ITEM());
      await new Promise((resolve) => { setTimeout(resolve, 5); });
      expect(await refOf(ONE_ITEM())).toBe(first);
      // The empty set is a well-defined identity too, bound to its own envelope.
      const empty = fingerprintSharedProtectedSourceSet({ effectiveContextRef: EMPTY_ENVELOPE().effectiveContextRef, items: [] });
      expect(empty).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(empty).not.toBe(first);
    });
  });

  // -------------------------------------------------------------------------
  describe('an envelope with zero private reasoning contexts (task §18, §44)', () => {
    it('35-37. clears without invoking the detector, on the NO_PROTECTED_PRIVATE_CONTEXT basis', async () => {
      const kit = harness(new Error('the detector must not be consulted'));
      const gate = clearanceOf(await kit.service.evaluate(EMPTY_ENVELOPE(), OUTPUT));
      expect(kit.requests).toHaveLength(0);
      expect(gate.basis).toBe('NO_PROTECTED_PRIVATE_CONTEXT');
      expect(gate.sourceDisclosureStatus).toBe('NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED');
      // No detector ran, so no detector evidence is representable on this branch.
      expect(Object.keys(gate)).not.toContain('detectorAssessmentRef');
      expect(Object.keys(gate)).not.toContain('detectorPolicyRef');
    });

    it('38. still binds the exact output', async () => {
      const kit = harness();
      const gate = clearanceOf(await kit.service.evaluate(EMPTY_ENVELOPE(), OUTPUT));
      expect(gate.outputDigest).toBe(digestProviderOutput(OUTPUT));
      const other = clearanceOf(await kit.service.evaluate(EMPTY_ENVELOPE(), `${OUTPUT} `));
      expect(other.outputDigest).not.toBe(gate.outputDigest);
      expect(other.gateRef).not.toBe(gate.gateRef);
    });

    it('39-40. grants nothing, and implies nothing about System / Safety or delivery', async () => {
      const kit = harness();
      const gate = clearanceOf(await kit.service.evaluate(EMPTY_ENVELOPE(), OUTPUT));
      expect(gate.deliveryCommitAuthority).toBe('NOT_GRANTED_BY_THIS_BOUNDARY');
      expect(gate.directPrivateDisclosureAuthority).toBe('NOT_GRANTED');
      expect(gate.materialDisclosureAuthority).toBe('NOT_GRANTED');
      expect(gate.provenanceDisclosure).toBe('SEALED');
      const serialized = JSON.stringify(gate);
      for (const claim of ['systemSafety', 'launchGate', 'deliveryAllowed', 'approved', 'commitReady', '"safe"', 'SAFE']) {
        expect(serialized).not.toContain(claim);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('a non-empty protected source set that the server detector clears (task §19, §22, §23, §45)', () => {
    it('41-42. clears on an exactly bound CLEAR, with ONE detector invocation for the whole operation', async () => {
      const kit = harness();
      const gate = clearanceOf(await kit.service.evaluate(TWO_OWNERS(), OUTPUT));
      // Two owners, two sources, one operation: never once per source.
      expect(kit.requests).toHaveLength(1);
      expect(kit.requests[0].protectedSources).toHaveLength(2);
      expect(gate.basis).toBe('SERVER_DETECTOR_CLEAR');
      expect(gate.sourceDisclosureStatus).toBe('NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED');
    });

    it('43-46. hands the detector the exact output bytes, the exact generation-time content, in exact admitted order', async () => {
      const envelope = TWO_OWNERS();
      const kit = harness();
      await kit.service.evaluate(envelope, OUTPUT);
      const request = kit.requests[0];
      expect(request.outputText).toBe(OUTPUT);
      expect(request.outputDigest).toBe(digestProviderOutput(OUTPUT));
      expect(request.effectiveContextRef).toBe(envelope.effectiveContextRef);
      expect(request.protectedSources.map((entry) => entry.reasoningContent)).toEqual([CONTENT_M, CONTENT_A]);
      expect(request.protectedSources.map((entry) => entry.source.contextId)).toEqual(['ctx-m1', 'ctx-a1']);
      expect(request.protectedSources.map((entry) => entry.source.originWorld.owner.humanId)).toEqual([IDS.mohamed, IDS.ahmed]);
      for (const entry of request.protectedSources) {
        expect(entry.contentDigest).toBe(digestReasoningContent(entry.reasoningContent));
        expect(entry.source.originWorld.worldType).toBe('MY_WORLD');
      }
      // The awkward bytes survived: no normalization, trimming or re-encoding.
      const unicode = envelopeOf([item(MOHAMED, 'ctx-u', CONTENT_M2)]);
      const second = harness();
      await second.service.evaluate(unicode, OUTPUT);
      expect(second.requests[0].protectedSources[0].reasoningContent).toBe(CONTENT_M2);
    });

    it('47. clears higher-level advice that private context influenced: existence of private context is never itself a block', async () => {
      // CW2-02 §20 / B16. The gate has no "private context existed -> block" path:
      // the ONLY thing that blocks is a positive, exactly bound detection.
      const kit = harness();
      const result = await kit.service.evaluate(TWO_OWNERS(), OUTPUT);
      expect(result.state).toBe('CLEAR');
      expect(kit.requests).toHaveLength(1);
    });

    it('48. restates the frozen no-disclosure positions unchanged, and grants no delivery', async () => {
      const kit = harness();
      const gate = clearanceOf(await kit.service.evaluate(ONE_ITEM(), OUTPUT));
      expect(gate.directPrivateDisclosureAuthority).toBe('NOT_GRANTED');
      expect(gate.materialDisclosureAuthority).toBe('NOT_GRANTED');
      expect(gate.provenanceDisclosure).toBe('SEALED');
      expect(gate.deliveryCommitAuthority).toBe('NOT_GRANTED_BY_THIS_BOUNDARY');
      for (const key of ['sourceDisclosureAuthority', 'quoteAuthority', 'deliveryAllowed', 'safe', 'approved']) {
        expect(Object.keys(gate)).not.toContain(key);
      }
    });

    it('49. binds the exact detector assessment and policy into the gate reference', async () => {
      const envelope = ONE_ITEM();
      const kit = harness();
      const gate = clearanceOf(await kit.service.evaluate(envelope, OUTPUT));
      if (gate.basis !== 'SERVER_DETECTOR_CLEAR') throw new Error('expected a detector-backed clearance');
      expect(gate.detectorAssessmentRef).toBe(ASSESSMENT_REF);
      expect(gate.detectorPolicyRef).toBe(POLICY_REF);
      expect(gate.gateRef).toBe(fingerprintSharedSourceDisclosureGate({
        effectiveContextRef: envelope.effectiveContextRef,
        outputDigest: digestProviderOutput(OUTPUT),
        protectedSourceSetRef: gate.protectedSourceSetRef,
        basis: 'SERVER_DETECTOR_CLEAR',
        detectorAssessmentRef: ASSESSMENT_REF,
        detectorPolicyRef: POLICY_REF,
      }));
      expect(SHARED_SOURCE_DISCLOSURE_GATE_VERSION).toBe('QANDEEL_CWV2_SHARED_SOURCE_DISCLOSURE_GATE_V1');
      expect(SHARED_SOURCE_DISCLOSURE_GATE_BASES).toEqual(['NO_PROTECTED_PRIVATE_CONTEXT', 'SERVER_DETECTOR_CLEAR']);
    });
  });

  // -------------------------------------------------------------------------
  describe('a positive detection always blocks this lane (task §21, §41, §46)', () => {
    it('50-53. blocks on each of the four frozen categories', async () => {
      expect(SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES).toEqual(['PRIVATE_QUOTE', 'DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION', 'SEALED_PROVENANCE_DISCLOSURE']);
      for (const category of SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES) {
        const kit = harness(detectedFor([category]));
        expectBlocked(await kit.service.evaluate(ONE_ITEM(), OUTPUT));
      }
    });

    it('54. returns the same generic result for several unique findings', async () => {
      const kit = harness(detectedFor([...SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES]));
      expectBlocked(await kit.service.evaluate(TWO_OWNERS(), OUTPUT));
      // "Only attribution" is not a lesser finding: no category is inspected to
      // decide whether a detection is acceptable.
      const attribution = harness(detectedFor(['SOURCE_SPECIFIC_ATTRIBUTION']));
      expectBlocked(await attribution.service.evaluate(TWO_OWNERS(), OUTPUT));
    });

    it('55-56. refuses a malformed findings list rather than blocking or clearing on it', async () => {
      for (const findings of [
        ['PRIVATE_QUOTE', 'PRIVATE_QUOTE'],
        [],
        ['SOMETHING_ELSE'],
        ['PRIVATE_QUOTE', 'NOT_A_CATEGORY'],
        [{ category: 'PRIVATE_QUOTE', sourceId: 'ctx-m1' }],
        'PRIVATE_QUOTE',
        null,
      ] as ReadonlyArray<unknown>) {
        const kit = harness(detectedFor(findings as ReadonlyArray<unknown>));
        expectUnresolved(await kit.service.evaluate(ONE_ITEM(), OUTPUT), 'DETECTOR_UNRESOLVED');
      }
    });

    it('57-58. exposes no category, source, owner, content or output in the blocked result', async () => {
      const kit = harness(detectedFor(['PRIVATE_QUOTE', 'SEALED_PROVENANCE_DISCLOSURE']));
      const result = await kit.service.evaluate(TWO_OWNERS(), OUTPUT);
      expectBlocked(result);
      expect(Object.keys(result)).toEqual(['state', 'reason']);
      const serialized = JSON.stringify(result);
      for (const secret of [...SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES, IDS.mohamed, IDS.ahmed, 'ctx-m1', 'ctx-a1', CONTENT_M, CONTENT_A, OUTPUT, ASSESSMENT_REF, POLICY_REF, IDS.grantM]) {
        expect(serialized).not.toContain(secret);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('an untrustworthy detector answer is uncertainty, never a clearance (task §13, §25, §47)', () => {
    const refuses = async (answer: Answer, reason: string, note: string): Promise<void> => {
      const kit = harness(answer);
      const result = await kit.service.evaluate(ONE_ITEM(), OUTPUT);
      expect({ note, result }).toEqual({ note, result: { state: 'UNRESOLVED', reason } });
    };

    it('59. treats a throwing detector as unresolved', async () => {
      await refuses(new Error('connection reset'), 'DETECTOR_UNRESOLVED', 'throws');
      await refuses(new TypeError('undefined is not a function'), 'DETECTOR_UNRESOLVED', 'throws a TypeError');
    });

    it('60. maps every bounded detector failure to one internal class', async () => {
      expect(SHARED_SOURCE_DISCLOSURE_DETECTOR_FAILURES).toEqual(['DETECTOR_UNAVAILABLE', 'DETECTOR_FAILED', 'ASSESSMENT_UNAVAILABLE', 'CONTRADICTORY_ASSESSMENT']);
      for (const failure of SHARED_SOURCE_DISCLOSURE_DETECTOR_FAILURES) {
        await refuses({ state: 'UNRESOLVED', failure }, 'DETECTOR_UNRESOLVED', failure);
      }
    });

    it('61-63. refuses a malformed CLEAR', async () => {
      const bound = (extra: Record<string, unknown>) => (request: SharedSourceDisclosureDetectionRequest): unknown => ({ ...(clearFor(request) as Record<string, unknown>), ...extra });
      await refuses(bound({ assessmentRef: undefined }), 'DETECTOR_UNRESOLVED', 'undefined assessmentRef');
      await refuses(bound({ assessmentRef: '  ' }), 'DETECTOR_UNRESOLVED', 'blank assessmentRef');
      await refuses(bound({ detectorPolicyRef: '' }), 'DETECTOR_UNRESOLVED', 'blank policyRef');
      await refuses(bound({ confidence: 0.92 }), 'DETECTOR_UNRESOLVED', 'extra property');
      await refuses(bound({ findings: [] }), 'DETECTOR_UNRESOLVED', 'a CLEAR carrying findings');
      await refuses(bound({ binding: undefined }), 'DETECTOR_UNRESOLVED', 'missing binding');
      await refuses(bound({ binding: { effectiveContextRef: ONE_ITEM().effectiveContextRef } }), 'DETECTOR_UNRESOLVED', 'partial binding');
    });

    it('64. refuses a DETECTED that is malformed beyond its findings', async () => {
      const detected = (extra: Record<string, unknown>) => (request: SharedSourceDisclosureDetectionRequest): unknown => ({ ...(detectedFor(['PRIVATE_QUOTE'])(request) as Record<string, unknown>), ...extra });
      await refuses(detected({ assessmentRef: null }), 'DETECTOR_UNRESOLVED', 'null assessmentRef');
      await refuses(detected({ quotedText: CONTENT_M }), 'DETECTOR_UNRESOLVED', 'smuggled quoted text');
      await refuses(detected({ binding: null }), 'DETECTOR_UNRESOLVED', 'null binding');
    });

    it('65-67. refuses an assessment bound to a different operation', async () => {
      const rebound = (patch: Record<string, unknown>) => (request: SharedSourceDisclosureDetectionRequest): unknown => ({
        ...(clearFor(request) as Record<string, unknown>),
        binding: { effectiveContextRef: request.effectiveContextRef, outputDigest: request.outputDigest, protectedSourceSetRef: request.protectedSourceSetRef, ...patch },
      });
      await refuses(rebound({ effectiveContextRef: EMPTY_ENVELOPE().effectiveContextRef }), 'DETECTOR_BINDING_MISMATCH', 'another envelope');
      await refuses(rebound({ outputDigest: digestProviderOutput('another output') }), 'DETECTOR_BINDING_MISMATCH', 'another output');
      await refuses(rebound({ protectedSourceSetRef: AUTHORITY_REF('cc') }), 'DETECTOR_BINDING_MISMATCH', 'another source set');
      // The same rule applies to a DETECTED: a detection of another operation is
      // not weaker evidence about this one, it is none.
      const detectedElsewhere = (request: SharedSourceDisclosureDetectionRequest): unknown => ({
        ...(detectedFor(['PRIVATE_QUOTE'])(request) as Record<string, unknown>),
        binding: { effectiveContextRef: request.effectiveContextRef, outputDigest: digestProviderOutput('another output'), protectedSourceSetRef: request.protectedSourceSetRef },
      });
      await refuses(detectedElsewhere, 'DETECTOR_BINDING_MISMATCH', 'a detection of another output');
    });

    it('68. refuses an unknown or missing detector state', async () => {
      for (const answer of [{ state: 'SAFE' }, { state: 'ALLOW' }, { state: 'CLEARED' }, {}, null, 'CLEAR', 42, [], true] as ReadonlyArray<unknown>) {
        await refuses(answer, 'DETECTOR_UNRESOLVED', `state ${JSON.stringify(answer)}`);
      }
      // A detector that resolves with nothing at all. Passed as a function so the
      // harness cannot mistake it for "no fixture given".
      await refuses((): unknown => undefined, 'DETECTOR_UNRESOLVED', 'state undefined');
    });

    it('69. never lets raw exception text, upstream detail or protected content into the result', async () => {
      const kit = harness(new Error(`upstream said: ${CONTENT_M} for ${IDS.mohamed} at https://detector.internal/assess?key=secret`));
      const result = await kit.service.evaluate(ONE_ITEM(), OUTPUT);
      expect(result).toEqual({ state: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' });
      const serialized = JSON.stringify(result);
      for (const secret of [CONTENT_M, IDS.mohamed, 'detector.internal', 'secret', 'upstream said', OUTPUT]) {
        expect(serialized).not.toContain(secret);
      }
      expect(SHARED_SOURCE_DISCLOSURE_UNRESOLVED_REASONS).toEqual(['MALFORMED_GENERATION_ARTIFACT', 'DETECTOR_UNRESOLVED', 'DETECTOR_BINDING_MISMATCH']);
    });
  });

  // -------------------------------------------------------------------------
  describe('one clearance is bound to exactly one operation (task §24, §48)', () => {
    it('70-71. gives identical bytes an identical output identity, and one changed byte a different one', async () => {
      const kit = harness();
      const a = clearanceOf(await kit.service.evaluate(ONE_ITEM(), OUTPUT));
      const b = clearanceOf(await kit.service.evaluate(ONE_ITEM(), `${OUTPUT}`));
      expect(b.outputDigest).toBe(a.outputDigest);
      for (const variant of [`${OUTPUT} `, OUTPUT.replace('Mid-month', 'Mid month'), `${OUTPUT}\n`, OUTPUT.toUpperCase()]) {
        const other = clearanceOf(await kit.service.evaluate(ONE_ITEM(), variant));
        expect(other.outputDigest).not.toBe(a.outputDigest);
      }
    });

    it('72. cannot clear output B with an assessment issued for output A', async () => {
      // A detector that answers about the FIRST output it ever saw, replayed
      // against a second one - the exact shape of a cached or replayed verdict.
      let pinned: SharedSourceDisclosureDetectionRequest | undefined;
      const kit = harness((request: SharedSourceDisclosureDetectionRequest): unknown => {
        if (pinned === undefined) pinned = request;
        return clearFor(pinned);
      });
      expect((await kit.service.evaluate(ONE_ITEM(), OUTPUT)).state).toBe('CLEAR');
      expectUnresolved(await kit.service.evaluate(ONE_ITEM(), 'A completely different answer.'), 'DETECTOR_BINDING_MISMATCH');
    });

    it('73-76. changes the gate reference with the output, the envelope, the source set and the detector evidence', async () => {
      const base = fingerprintSharedSourceDisclosureGate({
        effectiveContextRef: 'sha256:e', outputDigest: 'sha256:o', protectedSourceSetRef: 'sha256:p',
        basis: 'SERVER_DETECTOR_CLEAR', detectorAssessmentRef: ASSESSMENT_REF, detectorPolicyRef: POLICY_REF,
      });
      const variants = [
        { outputDigest: 'sha256:o2' },
        { effectiveContextRef: 'sha256:e2' },
        { protectedSourceSetRef: 'sha256:p2' },
        { detectorAssessmentRef: 'assessment:other' },
        { detectorPolicyRef: 'detector-policy:v8' },
        { basis: 'NO_PROTECTED_PRIVATE_CONTEXT' },
      ];
      const refs = variants.map((patch) => fingerprintSharedSourceDisclosureGate({
        effectiveContextRef: 'sha256:e', outputDigest: 'sha256:o', protectedSourceSetRef: 'sha256:p',
        basis: 'SERVER_DETECTOR_CLEAR', detectorAssessmentRef: ASSESSMENT_REF, detectorPolicyRef: POLICY_REF, ...patch,
      }));
      expect(new Set([base, ...refs]).size).toBe(variants.length + 1);
      // A clearance with no detector evidence is never the same reference as one
      // that merely happens to share the other four facts.
      expect(fingerprintSharedSourceDisclosureGate({ effectiveContextRef: 'sha256:e', outputDigest: 'sha256:o', protectedSourceSetRef: 'sha256:p', basis: 'SERVER_DETECTOR_CLEAR' }))
        .not.toBe(base);
    });

    it('77. puts no raw output and no private content into the reference or the clearance', async () => {
      const kit = harness();
      const gate = clearanceOf(await kit.service.evaluate(TWO_OWNERS(), OUTPUT));
      const serialized = JSON.stringify(gate);
      for (const secret of [OUTPUT, CONTENT_M, CONTENT_A, 'Mid-month', 'avoids travel', IDS.mohamed, IDS.ahmed, 'ctx-m1', IDS.grantM, REF_A]) {
        expect(serialized).not.toContain(secret);
      }
      for (const ref of [gate.gateRef, gate.outputDigest, gate.protectedSourceSetRef, gate.effectiveContextRef]) {
        expect(ref).toMatch(/^sha256:[0-9a-f]{64}$/u);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('composed with the real frozen I-03E admission boundary', () => {
    it('clears a genuinely built EffectiveContext, and refuses the same output against a re-built one', async () => {
      const worldState = { async resolveCurrent(worldId: SharedWorldId) { return { state: 'RESOLVED', snapshot: { worldId, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: worldSnapshotRef() } }; } } as unknown as SharedPreModelWorldStateResolverService;
      const audience = { async resolveCurrent() { return { state: 'RESOLVED', snapshot: AUDIENCE }; } } as unknown as SharedHumanAudienceResolverService;
      const grants = { async resolveCurrent(_worldId: SharedWorldId, grantor: HumanPrincipal) { return foundGrant(grantor, AUDIENCE.humans); } } as unknown as StandingContextGrantResolverService;
      const candidates: ReadonlyArray<SharedPrivateContextCandidate> = [
        { kind: 'MY_WORLD_PRIVATE_CONTEXT', contextId: 'ctx-m1', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED }, availability: 'AVAILABLE', reasoningContent: CONTENT_M },
        { kind: 'MY_WORLD_PRIVATE_CONTEXT', contextId: 'ctx-gone', originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: HADIR }, availability: 'DELETED_BY_OWNER' },
      ];
      const admission = await new SharedEffectiveContextService(worldState, audience, grants).resolve(WORLD, candidates);
      if (admission.state !== 'READY') throw new Error(`expected READY, got ${admission.state}`);
      expect(admission.effectiveContext.privateReasoningContexts).toHaveLength(1);

      const kit = harness();
      const gate = clearanceOf(await kit.service.evaluate(admission.effectiveContext, OUTPUT));
      expect(gate.basis).toBe('SERVER_DETECTOR_CLEAR');
      expect(gate.effectiveContextRef).toBe(admission.effectiveContext.effectiveContextRef);
      // The deleted source never reached the detector: it was excluded pre-model
      // and cannot be resurrected post-generation (CW2-02 §27, B19).
      expect(kit.requests[0].protectedSources.map((entry) => entry.source.contextId)).toEqual(['ctx-m1']);
    });
  });

  // -------------------------------------------------------------------------
  describe('scope: the gate is a contract boundary and not a detector', () => {
    it('carries the files it introduced, each with a closed import set', () => {
      // Presence, never a census: a later authorized detector implementation,
      // helper or second spec in this namespace is expected growth, and a guard
      // that counted the files here would fail on it for no reason. The root
      // closure contract proves that property by mutation instead.
      const present = readdirSync(__dirname);
      for (const file of [...PRODUCTION, 'shared-source-disclosure-gate.service.spec.ts', 'shared-privacy-authority-delivery-readiness.service.spec.ts']) {
        expect(present).toContain(file);
      }
      expect(imports(executable('shared-source-disclosure.types.ts'))).toEqual([]);
      expect(imports(executable('shared-source-disclosure-detector.types.ts'))).toEqual(['../effective-context/shared-effective-context.types']);
      expect(imports(executable('shared-source-disclosure-gate.service.ts'))).toEqual([
        '../authority/standing-context-authority.types',
        '../delivery-authority/shared-delivery-authority-revalidator.service',
        '../effective-context/shared-effective-context.service',
        '../effective-context/shared-effective-context.types',
        '../kernel/principal.types',
        '../kernel/world-invariants',
        '../kernel/world.types',
        './shared-source-disclosure-detector.types',
        './shared-source-disclosure.types',
        '@nestjs/common',
        'node:crypto',
      ]);
    });

    it('implements no detection mechanism: the output is hashed, handed over, and never inspected', () => {
      const gate = executable('shared-source-disclosure-gate.service.ts');
      for (const pattern of [
        /\.includes\(outputText|outputText\.(?:includes|indexOf|match|search|slice|split|substring|replace|toLowerCase|normalize)/u,
        /\bquote\b|quoting|verbatim|excerpt|snippet|paraphras/iu,
        /redact|scrub|sanitizeOutput|rewriteOutput|summari[sz]e|rerank/iu,
        /similar|threshold|embedding|cosine|jaccard|levenshtein|nGram|ngram|tokeniz/iu,
        /sourceDisclosureSafe|disclosureSafe|declaredSafe|providerAsserts|selfDeclar/iu,
        /model-router|ModelRouter|openai|anthropic|completion|prompt/iu,
        /'SAFE'|'UNSAFE'|isSafe|markSafe/u,
      ]) {
        expect(gate).not.toMatch(pattern);
      }
      // The output text is used exactly twice: to derive its identity through the
      // frozen I-03F helper, and to fill the request field the detector reads.
      expect(gate.match(/\boutputText\b/gu)).toHaveLength(4);
      expect(gate).toContain('const outputDigest = digestProviderOutput(outputText);');
      expect(gate).toContain("if (typeof outputText !== 'string') return unresolved('MALFORMED_GENERATION_ARTIFACT');");
      // Exactly one detector invocation site exists at all.
      expect(gate.match(/this\.detector\.assess\(/gu)).toHaveLength(1);
      expect(gate.match(/@Injectable\(\)/gu)).toHaveLength(1);
      expect(gate.match(/@Inject\(/gu)).toHaveLength(1);
    });

    it('persists nothing, reads nothing, and uses no clock, random value or transport', () => {
      for (const file of PRODUCTION) {
        const source = executable(file);
        for (const pattern of [
          /persist|\bcommit\b|outbox|writeAudit|auditEvent|\.save\(|repository|INSERT|UPDATE\s|CREATE\s+TABLE/iu,
          /randomUUID|Math\.random|Date\.now|new Date|performance\.now/u,
          /\bfetch\(|globalThis\.fetch|new Pool\(|require\('pg'\)|SUPABASE|SERVICE_ROLE|\/rest\/v1\//u,
          /console\.|logger|\bLogger\b/u,
          /@Controller|@Get\(|@Post\(|@Module|@WebSocketGateway|\.dto\b/u,
        ]) {
          expect(source).not.toMatch(pattern);
        }
      }
      // The detector request is built, passed and dropped: never serialized,
      // returned or stored (task §40).
      const gate = executable('shared-source-disclosure-gate.service.ts');
      expect(gate).not.toMatch(/JSON\.stringify\(request|return request|this\.\w+ = request/u);
    });

    it('reuses the frozen I-03E and I-03F helpers rather than inventing competing ones', () => {
      const gate = executable('shared-source-disclosure-gate.service.ts');
      expect(gate).toContain("import { digestReasoningContent, fingerprintSharedEffectiveContext } from '../effective-context/shared-effective-context.service';");
      expect(gate).toContain("import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';");
      expect(gate).not.toMatch(/QANDEEL_CWV2_SHARED_EFFECTIVE_CONTEXT|QANDEEL_CWV2_SHARED_DELIVERY_AUTHORITY/u);
      expect(gate).toContain("if (recomputed !== artifact.effectiveContextRef) return unresolved('MALFORMED_GENERATION_ARTIFACT');");
      expect(gate).toContain("if (digestReasoningContent(item.reasoningContent) !== item.contentDigest) return 'MALFORMED';");
      // No new action, purpose, grant type, TTL or permission engine.
      for (const pattern of [/'REASON_FROM_PRIVATE_CONTEXT'|'SHARED_REASONING'/u, /\bTTL\b|expiresAt|expiry|ttlSeconds/iu, /\bcan[A-Z]\w*\(|\bmay[A-Z]\w*\(|isAuthorized|checkPermission|evaluatePolicy|PolicyEngine|PermissionEngine/u]) {
        expect(gate).not.toMatch(pattern);
      }
      expect(new SharedSourceDisclosureGateService({ async assess() { throw new Error('unused'); } }).evaluate.length).toBe(2);
    });

    it('states its own boundary in the vocabulary, and the guard is not vacuous', () => {
      const types = executable('shared-source-disclosure.types.ts');
      for (const literal of [
        "readonly sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED';",
        "readonly directPrivateDisclosureAuthority: 'NOT_GRANTED';",
        "readonly materialDisclosureAuthority: 'NOT_GRANTED';",
        "readonly provenanceDisclosure: 'SEALED';",
        "readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';",
      ]) {
        expect(types).toContain(literal);
      }
      for (const file of PRODUCTION) expect(executable(file).length).toBeGreaterThan(500);
      // The comment-only phrasing really was stripped, so the bans above were
      // answered by executable code rather than by prose.
      expect(executable('shared-source-disclosure-gate.service.ts')).not.toContain('LLM-as-judge');
      expect(readFileSync(join(__dirname, 'shared-source-disclosure-gate.service.ts'), 'utf8')).toContain('LLM-as-judge');
    });
  });
});

// --- static-guard helpers -------------------------------------------------------

const PRODUCTION = [
  'shared-source-disclosure.types.ts',
  'shared-source-disclosure-detector.types.ts',
  'shared-source-disclosure-gate.service.ts',
  'shared-privacy-authority-delivery-readiness.service.ts',
] as const;

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
