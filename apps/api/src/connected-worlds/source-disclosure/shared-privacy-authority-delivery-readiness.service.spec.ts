import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import { evaluateStandingContextAuthority } from '../authority/standing-context-authority';
import { STANDING_CONTEXT_ACTION, STANDING_CONTEXT_PURPOSE } from '../authority/standing-context-authority.types';
import type { SharedHumanAudienceSnapshot, StandingContextGrantResolution } from '../authority/standing-context-authority.types';
import type { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedHumanAudienceResolverService, fingerprintSharedHumanAudience } from '../audience/shared-human-audience-resolver.service';
import { SharedPreModelWorldStateResolverService, fingerprintSharedPreModelWorldState } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { digestReasoningContent, fingerprintSharedEffectiveContext } from '../effective-context/shared-effective-context.service';
import type {
  AuthorizedPrivateReasoningContext,
  PrivateSourceContextRef,
  SharedEffectiveContext,
  StandingContextAllowDecision,
} from '../effective-context/shared-effective-context.types';
import {
  SHARED_DELIVERY_AUTHORITY_STALE_REASONS,
  SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS,
} from '../delivery-authority/shared-delivery-authority.types';
import type { SharedPrivateSourceStateResolver } from '../delivery-authority/shared-private-source-state-resolver.types';
import {
  SharedDeliveryAuthorityRevalidatorService,
  digestProviderOutput,
  fingerprintSharedDeliveryAuthorityRevalidation,
} from '../delivery-authority/shared-delivery-authority-revalidator.service';
import type { SharedSourceDisclosureDetectionRequest, SharedSourceDisclosureDetector } from './shared-source-disclosure-detector.types';
import { SharedSourceDisclosureGateService } from './shared-source-disclosure-gate.service';
import { SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_UNRESOLVED_REASONS } from './shared-source-disclosure.types';
import type { SharedSourceDisclosureGateResult, SharedPrivacyAuthorityDeliveryReadiness } from './shared-source-disclosure.types';
import {
  SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_VERSION,
  SharedPrivacyAuthorityDeliveryReadinessService,
  fingerprintSharedPrivacyAuthorityDeliveryReadiness,
} from './shared-privacy-authority-delivery-readiness.service';

const IDS = {
  world: '10000000-0000-4000-8000-00000000000a',
  mohamed: '20000000-0000-4000-8000-000000000001',
  hadir: '20000000-0000-4000-8000-000000000002',
  grantM: '30000000-0000-4000-8000-000000000001',
  e1: '40000000-0000-4000-8000-000000000001',
  e2: '40000000-0000-4000-8000-000000000002',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human(IDS.mohamed);
const HADIR = human(IDS.hadir);

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
const REF_A = `sha256:${'a1'.padEnd(64, '0')}`;
const OUTPUT = 'Mid-month looks like the better window, and a conservative budget is worth keeping.';
const ASSESSMENT_REF = 'assessment:9f2c';
const POLICY_REF = 'detector-policy:v7';
const CONTENT_M = 'Mohamed avoids travel in the first week of the month.';

const WORLD_STATE_REF = fingerprintSharedPreModelWorldState({ worldId: IDS.world, lifecycle: 'ACTIVE', phase: 'STANDARD' });
const AUDIENCE: SharedHumanAudienceSnapshot = {
  snapshotRef: fingerprintSharedHumanAudience({
    state: 'RESOLVED',
    worldId: IDS.world,
    members: [{ userId: IDS.mohamed, membershipEpisodeId: IDS.e1 }, { userId: IDS.hadir, membershipEpisodeId: IDS.e2 }],
  }),
  humans: [MOHAMED, HADIR],
};

const foundGrant = (grantor: HumanPrincipal, ceiling: ReadonlyArray<HumanPrincipal>): StandingContextGrantResolution =>
  ({ state: 'FOUND', authoritySnapshotRef: REF_A, grant: { grantId: IDS.grantM, worldId: WORLD, grantor, status: 'ACTIVE', audienceCeiling: ceiling } });

function allowDecision(owner: HumanPrincipal): StandingContextAllowDecision {
  const decision = evaluateStandingContextAuthority(
    { action: STANDING_CONTEXT_ACTION, grantor: owner, targetWorldId: WORLD, purpose: STANDING_CONTEXT_PURPOSE, audienceSnapshot: AUDIENCE },
    foundGrant(owner, AUDIENCE.humans),
  );
  if (decision.decision !== 'ALLOW') throw new Error(`fixture ALLOW failed: ${decision.decision}`);
  return decision;
}

function item(owner: HumanPrincipal, contextId: string, reasoningContent: string): AuthorizedPrivateReasoningContext {
  return {
    kind: 'AUTHORIZED_PRIVATE_REASONING_CONTEXT',
    source: { contextId, originWorld: { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner } },
    reasoningContent,
    contentDigest: digestReasoningContent(reasoningContent),
    authority: allowDecision(owner),
  };
}

function envelopeOf(items: ReadonlyArray<AuthorizedPrivateReasoningContext>): SharedEffectiveContext {
  return {
    effectiveContextRef: fingerprintSharedEffectiveContext({
      worldId: WORLD,
      worldStateSnapshotRef: WORLD_STATE_REF,
      audienceSnapshotRef: AUDIENCE.snapshotRef,
      items: items.map((entry) => ({
        ownerHumanId: entry.source.originWorld.owner.humanId,
        contextId: entry.source.contextId,
        contentDigest: entry.contentDigest,
        grantId: entry.authority.binding.grantId,
        authoritySnapshotRef: entry.authority.binding.authoritySnapshotRef,
      })),
    }),
    targetWorldId: WORLD,
    worldStateSnapshotRef: WORLD_STATE_REF,
    audienceSnapshot: AUDIENCE,
    privateReasoningContexts: items,
  };
}

const ENVELOPE = envelopeOf([item(MOHAMED, 'ctx-m1', CONTENT_M)]);
const OUTPUT_DIGEST = digestProviderOutput(OUTPUT);

// --- the two dependency fixtures ------------------------------------------------

const GATE_REF = `sha256:${'9c'.padEnd(64, '0')}`;

/** A structurally exact I-03G clearance, as the real gate produces it. */
const clearance = (overrides: Record<string, unknown> = {}): SharedSourceDisclosureGateResult => ({
  state: 'CLEAR',
  gate: {
    gateRef: GATE_REF,
    effectiveContextRef: ENVELOPE.effectiveContextRef,
    outputDigest: OUTPUT_DIGEST,
    protectedSourceSetRef: `sha256:${'7d'.padEnd(64, '0')}`,
    basis: 'SERVER_DETECTOR_CLEAR',
    detectorAssessmentRef: ASSESSMENT_REF,
    detectorPolicyRef: POLICY_REF,
    sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED',
    directPrivateDisclosureAuthority: 'NOT_GRANTED',
    materialDisclosureAuthority: 'NOT_GRANTED',
    provenanceDisclosure: 'SEALED',
    deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
    ...overrides,
  },
} as unknown as SharedSourceDisclosureGateResult);

const REVALIDATION_REF = fingerprintSharedDeliveryAuthorityRevalidation({
  effectiveContextRef: ENVELOPE.effectiveContextRef,
  outputDigest: OUTPUT_DIGEST,
  worldId: WORLD,
  worldStateSnapshotRef: WORLD_STATE_REF,
  audienceSnapshotRef: AUDIENCE.snapshotRef,
  items: [{ ownerHumanId: IDS.mohamed, contextId: 'ctx-m1', contentDigest: digestReasoningContent(CONTENT_M), grantId: IDS.grantM, authoritySnapshotRef: REF_A }],
});

/** A structurally exact frozen I-03F CURRENT result. */
const current = (overrides: Record<string, unknown> = {}): unknown => ({
  state: 'CURRENT',
  revalidation: {
    revalidationRef: REVALIDATION_REF,
    effectiveContextRef: ENVELOPE.effectiveContextRef,
    outputDigest: OUTPUT_DIGEST,
    targetWorldId: WORLD,
    worldStateSnapshotRef: WORLD_STATE_REF,
    audienceSnapshotRef: AUDIENCE.snapshotRef,
    authorityStatus: 'CURRENT',
    sourceDisclosureAuthority: 'NOT_EVALUATED',
    systemSafetyAuthority: 'NOT_EVALUATED',
    deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
    directPrivateDisclosureAuthority: 'NOT_GRANTED',
    materialDisclosureAuthority: 'NOT_GRANTED',
    provenanceDisclosure: 'SEALED',
    ...overrides,
  },
});

interface Call {
  readonly envelope: unknown;
  readonly output: unknown;
}

interface Kit {
  readonly service: SharedPrivacyAuthorityDeliveryReadinessService;
  readonly gateCalls: Call[];
  readonly authorityCalls: Call[];
  /** The exact order in which the two boundaries were entered and left. */
  readonly trace: string[];
}

type Fixture = unknown;

function harness(options: { gate?: Fixture; authority?: Fixture; gateGate?: () => Promise<void> } = {}): Kit {
  const gateCalls: Call[] = [];
  const authorityCalls: Call[] = [];
  const trace: string[] = [];

  const gate = {
    async evaluate(envelope: unknown, output: unknown) {
      trace.push('gate:enter');
      gateCalls.push({ envelope, output });
      if (options.gateGate !== undefined) await options.gateGate();
      trace.push('gate:leave');
      const answer = 'gate' in options ? options.gate : clearance();
      if (answer instanceof Error) throw answer;
      return answer as SharedSourceDisclosureGateResult;
    },
  } as unknown as SharedSourceDisclosureGateService;

  const authority = {
    async revalidate(envelope: unknown, output: unknown) {
      trace.push('authority:enter');
      authorityCalls.push({ envelope, output });
      const answer = 'authority' in options ? options.authority : current();
      if (answer instanceof Error) throw answer;
      return answer;
    },
  } as unknown as SharedDeliveryAuthorityRevalidatorService;

  return { service: new SharedPrivacyAuthorityDeliveryReadinessService(gate, authority), gateCalls, authorityCalls, trace };
}

function readinessOf(result: SharedPrivacyAuthorityDeliveryReadiness) {
  if (result.state !== 'READY_FOR_LATER_DELIVERY_GATES') throw new Error(`expected READY, got ${result.state}: ${JSON.stringify(result)}`);
  return result.readiness;
}

const expectUnresolved = (result: SharedPrivacyAuthorityDeliveryReadiness, reason: string): void => {
  expect(result).toEqual({ state: 'UNRESOLVED', reason });
};

describe('SharedPrivacyAuthorityDeliveryReadinessService', () => {
  // -------------------------------------------------------------------------
  describe('the frozen CW2-02 §22 order (task §28, §29, §49)', () => {
    it('78. never revalidates authority for an output the Source Disclosure Gate blocked', async () => {
      const kit = harness({ gate: { state: 'BLOCKED', reason: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED' } });
      expect(await kit.service.evaluate(ENVELOPE, OUTPUT)).toEqual({ state: 'BLOCKED', reason: 'SOURCE_DISCLOSURE_BLOCKED' });
      expect({ gate: kit.gateCalls.length, authority: kit.authorityCalls.length }).toEqual({ gate: 1, authority: 0 });
    });

    it('79. never revalidates authority when the Source Disclosure Gate could not answer', async () => {
      for (const [reason, mapped] of [
        ['MALFORMED_GENERATION_ARTIFACT', 'MALFORMED_GENERATION_ARTIFACT'],
        ['DETECTOR_UNRESOLVED', 'SOURCE_DISCLOSURE_UNRESOLVED'],
        ['DETECTOR_BINDING_MISMATCH', 'SOURCE_DISCLOSURE_UNRESOLVED'],
      ]) {
        const kit = harness({ gate: { state: 'UNRESOLVED', reason } });
        expectUnresolved(await kit.service.evaluate(ENVELOPE, OUTPUT), mapped);
        expect({ reason, gate: kit.gateCalls.length, authority: kit.authorityCalls.length }).toEqual({ reason, gate: 1, authority: 0 });
      }
      // A gate that throws is uncertainty too, and still stops the sequence.
      const thrown = harness({ gate: new Error('gate exploded') });
      expectUnresolved(await thrown.service.evaluate(ENVELOPE, OUTPUT), 'SOURCE_DISCLOSURE_UNRESOLVED');
      expect(thrown.authorityCalls).toHaveLength(0);
    });

    it('80-81. calls the authority revalidator exactly once, and only after the gate has completed', async () => {
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const kit = harness({ gateGate: () => held });
      const pending = kit.service.evaluate(ENVELOPE, OUTPUT);
      // The gate is still inside its own call. Nothing else may have started.
      await Promise.resolve();
      expect(kit.trace).toEqual(['gate:enter']);
      expect(kit.authorityCalls).toHaveLength(0);
      release();
      readinessOf(await pending);
      expect(kit.trace).toEqual(['gate:enter', 'gate:leave', 'authority:enter']);
      expect({ gate: kit.gateCalls.length, authority: kit.authorityCalls.length }).toEqual({ gate: 1, authority: 1 });
    });

    it('82-83. hands both boundaries the exact same envelope object and the exact same output bytes', async () => {
      const kit = harness();
      await kit.service.evaluate(ENVELOPE, OUTPUT);
      expect(kit.gateCalls[0].envelope).toBe(ENVELOPE);
      expect(kit.authorityCalls[0].envelope).toBe(ENVELOPE);
      expect(kit.gateCalls[0].output).toBe(OUTPUT);
      expect(kit.authorityCalls[0].output).toBe(OUTPUT);
      // Not a copy, not a normalized form, not a re-serialized envelope.
      expect(kit.gateCalls[0].envelope).toBe(kit.authorityCalls[0].envelope);
      expect(kit.gateCalls[0].output).toBe(kit.authorityCalls[0].output);
    });
  });

  // -------------------------------------------------------------------------
  describe('the frozen I-03F result is untrusted runtime data (task §31, §32, §50)', () => {
    it('84. returns readiness only for an exactly bound CURRENT', async () => {
      const kit = harness();
      const readiness = readinessOf(await kit.service.evaluate(ENVELOPE, OUTPUT));
      expect(readiness.effectiveContextRef).toBe(ENVELOPE.effectiveContextRef);
      expect(readiness.outputDigest).toBe(OUTPUT_DIGEST);
      expect(readiness.sourceDisclosureGateRef).toBe(GATE_REF);
      expect(readiness.authorityRevalidationRef).toBe(REVALIDATION_REF);
    });

    it('85. maps every frozen STALE reason to one generic AUTHORITY_STALE, leaking no per-owner detail', async () => {
      for (const reason of SHARED_DELIVERY_AUTHORITY_STALE_REASONS) {
        const kit = harness({ authority: { state: 'STALE', reason } });
        const result = await kit.service.evaluate(ENVELOPE, OUTPUT);
        expect({ reason, result }).toEqual({ reason, result: { state: 'STALE', reason: 'AUTHORITY_STALE' } });
      }
    });

    it('86. maps every frozen I-03F UNRESOLVED reason to one generic AUTHORITY_UNRESOLVED', async () => {
      for (const reason of SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS) {
        const kit = harness({ authority: { state: 'UNRESOLVED', reason } });
        expectUnresolved(await kit.service.evaluate(ENVELOPE, OUTPUT), 'AUTHORITY_UNRESOLVED');
      }
    });

    it('87. treats a throwing revalidator as unresolved, and leaks no exception detail', async () => {
      const kit = harness({ authority: new Error(`grant lookup for ${IDS.mohamed} failed at postgres://secret@db`) });
      const result = await kit.service.evaluate(ENVELOPE, OUTPUT);
      expectUnresolved(result, 'AUTHORITY_UNRESOLVED');
      for (const secret of [IDS.mohamed, 'postgres', 'secret', 'grant lookup']) expect(JSON.stringify(result)).not.toContain(secret);
    });

    it('88. refuses a malformed CURRENT rather than believing it', async () => {
      const refuses = async (authority: unknown, note: string, reason = 'AUTHORITY_UNRESOLVED'): Promise<void> => {
        const kit = harness({ authority });
        const result = await kit.service.evaluate(ENVELOPE, OUTPUT);
        expect({ note, result }).toEqual({ note, result: { state: 'UNRESOLVED', reason } });
      };
      for (const value of [null, undefined, 'CURRENT', 42, [], true, {}]) await refuses(value, `non-result ${String(value)}`);
      await refuses({ state: 'CURRENT' }, 'no revalidation payload');
      await refuses({ state: 'CURRENT', revalidation: null }, 'null payload');
      await refuses({ state: 'CURRENT', revalidation: {} }, 'empty payload');
      await refuses({ ...(current() as Record<string, unknown>), extra: 1 }, 'extra outer property');
      await refuses(current({ revalidationRef: '  ' }), 'blank revalidation reference');
      await refuses(current({ confidence: 0.9 }), 'extra payload property');
      await refuses({ state: 'STALE', reason: 'SOMETHING_ELSE' }, 'unknown stale reason');
      await refuses({ state: 'STALE' }, 'stale without a reason');
      await refuses({ state: 'STALE', reason: 'AUDIENCE_CHANGED', owner: IDS.mohamed }, 'stale carrying an owner');
      await refuses({ state: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' }, 'a reason from the wrong vocabulary');
    });

    it('89-90. refuses a CURRENT that describes a different operation', async () => {
      const other = harness({ authority: current({ effectiveContextRef: envelopeOf([]).effectiveContextRef }) });
      expectUnresolved(await other.service.evaluate(ENVELOPE, OUTPUT), 'OPERATION_BINDING_MISMATCH');
      const otherOutput = harness({ authority: current({ outputDigest: digestProviderOutput('a different answer') }) });
      expectUnresolved(await otherOutput.service.evaluate(ENVELOPE, OUTPUT), 'OPERATION_BINDING_MISMATCH');
      // And the mismatch is judged against the GATE's own references, so a gate
      // and a revalidation that each describe a coherent but different operation
      // can never be assembled into one readiness.
      const driftedGate = harness({ gate: clearance({ outputDigest: digestProviderOutput('a different answer') }) });
      expectUnresolved(await driftedGate.service.evaluate(ENVELOPE, OUTPUT), 'OPERATION_BINDING_MISMATCH');
    });

    it('91. refuses a CURRENT that claims source disclosure or system safety was evaluated or granted', async () => {
      for (const overrides of [
        { sourceDisclosureAuthority: 'EVALUATED' },
        { sourceDisclosureAuthority: 'GRANTED' },
        { sourceDisclosureAuthority: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED' },
        { systemSafetyAuthority: 'ALLOW' },
        { systemSafetyAuthority: 'GRANTED' },
        { authorityStatus: 'STALE' },
        { deliveryCommitAuthority: 'GRANTED' },
      ]) {
        const kit = harness({ authority: current(overrides) });
        expectUnresolved(await kit.service.evaluate(ENVELOPE, OUTPUT), 'AUTHORITY_UNRESOLVED');
      }
    });

    it('92. refuses a CURRENT that widens the frozen direct, material or provenance positions', async () => {
      for (const overrides of [
        { directPrivateDisclosureAuthority: 'GRANTED' },
        { materialDisclosureAuthority: 'GRANTED' },
        { provenanceDisclosure: 'DISCLOSABLE' },
        { provenanceDisclosure: 'NOT_EVALUATED' },
      ]) {
        const kit = harness({ authority: current(overrides) });
        expectUnresolved(await kit.service.evaluate(ENVELOPE, OUTPUT), 'AUTHORITY_UNRESOLVED');
      }
      // The I-03G gate passing does NOT rewrite what the I-03F result means: a
      // CURRENT still says source disclosure was NOT_EVALUATED by I-03F, and the
      // readiness reports the separate I-03G status in its own field.
      const kit = harness();
      const readiness = readinessOf(await kit.service.evaluate(ENVELOPE, OUTPUT));
      expect(readiness.sourceDisclosureStatus).toBe('NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED');
      expect(readiness.authorityStatus).toBe('CURRENT');
    });
  });

  // -------------------------------------------------------------------------
  describe('what READY means, and what it structurally cannot mean (task §30, §33, §34, §51)', () => {
    it('carries exactly the ten frozen readiness facts and nothing else', async () => {
      const kit = harness();
      const readiness = readinessOf(await kit.service.evaluate(ENVELOPE, OUTPUT));
      expect(Object.keys(readiness).sort()).toEqual([
        'authorityRevalidationRef', 'authorityStatus', 'deliveryCommitAuthority', 'effectiveContextRef', 'launchGateStatus',
        'outputDigest', 'readinessRef', 'sourceDisclosureGateRef', 'sourceDisclosureStatus', 'systemSafetyStatus',
      ]);
      expect(readiness.sourceDisclosureStatus).toBe('NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED');
      expect(readiness.authorityStatus).toBe('CURRENT');
      expect(readiness.systemSafetyStatus).toBe('NOT_EVALUATED');
      expect(readiness.launchGateStatus).toBe('NOT_EVALUATED');
      expect(readiness.deliveryCommitAuthority).toBe('NOT_GRANTED_BY_THIS_BOUNDARY');
    });

    it('is named for readiness, never for permission', async () => {
      const kit = harness();
      const result = await kit.service.evaluate(ENVELOPE, OUTPUT);
      expect(result.state).toBe('READY_FOR_LATER_DELIVERY_GATES');
      const serialized = JSON.stringify(result);
      for (const claim of ['deliveryAllowed', '"safe"', 'approved', 'canDeliver', 'commitReady', 'publishAllowed', 'materialDisclosureAllowed', 'DELIVERY_ALLOWED', 'APPROVED_FOR_DELIVERY', 'COMMIT_READY', "sourceDisclosureAuthority"]) {
        expect(serialized).not.toContain(claim);
      }
      expect(Object.keys(readinessOf(result))).not.toContain('directPrivateDisclosureAuthority');
    });

    it('binds the readiness reference to both boundary proofs and to nothing else', async () => {
      const kit = harness();
      const readiness = readinessOf(await kit.service.evaluate(ENVELOPE, OUTPUT));
      expect(readiness.readinessRef).toBe(fingerprintSharedPrivacyAuthorityDeliveryReadiness({
        effectiveContextRef: ENVELOPE.effectiveContextRef,
        outputDigest: OUTPUT_DIGEST,
        sourceDisclosureGateRef: GATE_REF,
        authorityRevalidationRef: REVALIDATION_REF,
      }));
      expect(readiness.readinessRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
      const base = { effectiveContextRef: 'sha256:e', outputDigest: 'sha256:o', sourceDisclosureGateRef: 'sha256:g', authorityRevalidationRef: 'sha256:r' };
      const variants = [{ effectiveContextRef: 'sha256:e2' }, { outputDigest: 'sha256:o2' }, { sourceDisclosureGateRef: 'sha256:g2' }, { authorityRevalidationRef: 'sha256:r2' }];
      const refs = variants.map((patch) => fingerprintSharedPrivacyAuthorityDeliveryReadiness({ ...base, ...patch }));
      expect(new Set([fingerprintSharedPrivacyAuthorityDeliveryReadiness(base), ...refs]).size).toBe(variants.length + 1);
      expect(SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_VERSION).toBe('QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1');
    });

    it('uses no clock, no random value and no raw content in the reference', async () => {
      const first = readinessOf(await harness().service.evaluate(ENVELOPE, OUTPUT)).readinessRef;
      await new Promise((resolve) => { setTimeout(resolve, 5); });
      expect(readinessOf(await harness().service.evaluate(ENVELOPE, OUTPUT)).readinessRef).toBe(first);
      const serialized = JSON.stringify(readinessOf(await harness().service.evaluate(ENVELOPE, OUTPUT)));
      for (const secret of [OUTPUT, CONTENT_M, IDS.mohamed, IDS.hadir, 'ctx-m1', IDS.grantM, ASSESSMENT_REF, POLICY_REF]) {
        expect(serialized).not.toContain(secret);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('no blocked, stale or unresolved result leaks a private fact (task §52)', () => {
    it('returns only a bounded class, whatever the underlying cause', async () => {
      const secrets = [IDS.mohamed, IDS.hadir, 'ctx-m1', IDS.grantM, CONTENT_M, OUTPUT, ASSESSMENT_REF, POLICY_REF, REF_A,
        'PRIVATE_QUOTE', 'DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION', 'SEALED_PROVENANCE_DISCLOSURE',
        'REVOKED', 'GRANT_REVOKED', 'PRIVATE_AUTHORITY_CHANGED', 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE'];
      const cases: ReadonlyArray<{ gate?: Fixture; authority?: Fixture }> = [
        { gate: { state: 'BLOCKED', reason: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED' } },
        { gate: { state: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' } },
        { gate: { state: 'UNRESOLVED', reason: 'MALFORMED_GENERATION_ARTIFACT' } },
        { gate: new Error(`detector said ${CONTENT_M}`) },
        { authority: { state: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' } },
        { authority: { state: 'STALE', reason: 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE' } },
        { authority: { state: 'UNRESOLVED', reason: 'PRIVATE_AUTHORITY_UNRESOLVED' } },
        { authority: new Error(`grant ${IDS.grantM} for ${IDS.mohamed}`) },
        { authority: current({ effectiveContextRef: 'sha256:elsewhere' }) },
      ];
      for (const fixture of cases) {
        const result = await harness(fixture).service.evaluate(ENVELOPE, OUTPUT);
        expect(Object.keys(result)).toEqual(['state', 'reason']);
        const serialized = JSON.stringify(result);
        for (const secret of secrets) expect(serialized).not.toContain(secret);
      }
      expect(SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_UNRESOLVED_REASONS)
        .toEqual(['MALFORMED_GENERATION_ARTIFACT', 'SOURCE_DISCLOSURE_UNRESOLVED', 'AUTHORITY_UNRESOLVED', 'OPERATION_BINDING_MISMATCH']);
    });
  });

  // -------------------------------------------------------------------------
  describe('composed with the real gate and the real frozen I-03F revalidator', () => {
    const realService = (detectorAnswer: (request: SharedSourceDisclosureDetectionRequest) => unknown, sourceDigest?: string) => {
      const detector: SharedSourceDisclosureDetector = {
        async assess(request) { return detectorAnswer(request) as Awaited<ReturnType<SharedSourceDisclosureDetector['assess']>>; },
      };
      const worldState = { async resolveCurrent(worldId: SharedWorldId) { return { state: 'RESOLVED', snapshot: { worldId, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: WORLD_STATE_REF } }; } } as unknown as SharedPreModelWorldStateResolverService;
      const audience = { async resolveCurrent() { return { state: 'RESOLVED', snapshot: AUDIENCE }; } } as unknown as SharedHumanAudienceResolverService;
      const grants = { async resolveCurrent(_worldId: SharedWorldId, grantor: HumanPrincipal) { return foundGrant(grantor, AUDIENCE.humans); } } as unknown as StandingContextGrantResolverService;
      const sources: SharedPrivateSourceStateResolver = {
        async resolveCurrent(_source: PrivateSourceContextRef) { return { state: 'AVAILABLE', contentDigest: sourceDigest ?? digestReasoningContent(CONTENT_M) }; },
      };
      return new SharedPrivacyAuthorityDeliveryReadinessService(
        new SharedSourceDisclosureGateService(detector),
        new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, sources),
      );
    };

    const boundClear = (request: SharedSourceDisclosureDetectionRequest): unknown => ({
      state: 'CLEAR',
      assessmentRef: ASSESSMENT_REF,
      detectorPolicyRef: POLICY_REF,
      binding: { effectiveContextRef: request.effectiveContextRef, outputDigest: request.outputDigest, protectedSourceSetRef: request.protectedSourceSetRef },
    });

    it('reaches READY end to end, with both real boundaries agreeing on the same operation', async () => {
      const readiness = readinessOf(await realService(boundClear).evaluate(ENVELOPE, OUTPUT));
      expect(readiness.effectiveContextRef).toBe(ENVELOPE.effectiveContextRef);
      expect(readiness.outputDigest).toBe(digestProviderOutput(OUTPUT));
      expect(readiness.authorityRevalidationRef).toBe(REVALIDATION_REF);
      expect(readiness.readinessRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
    });

    it('blocks end to end on a real detection, without ever consulting current authority', async () => {
      const detected = (request: SharedSourceDisclosureDetectionRequest): unknown => ({
        ...(boundClear(request) as Record<string, unknown>),
        state: 'DETECTED',
        findings: ['PRIVATE_QUOTE'],
      });
      expect(await realService(detected).evaluate(ENVELOPE, OUTPUT)).toEqual({ state: 'BLOCKED', reason: 'SOURCE_DISCLOSURE_BLOCKED' });
    });

    it('is STALE end to end when the private source content moved after generation', async () => {
      // The gate still clears - the output disclosed nothing - and I-03F still
      // refuses, because the bytes the old output depended on no longer exist.
      const result = await realService(boundClear, digestReasoningContent('Mohamed changed his note.')).evaluate(ENVELOPE, OUTPUT);
      expect(result).toEqual({ state: 'STALE', reason: 'AUTHORITY_STALE' });
    });

    it('refuses the same output against a malformed envelope at the first gate', async () => {
      const broken = { ...ENVELOPE, worldStateSnapshotRef: `${WORLD_STATE_REF}-edited` } as SharedEffectiveContext;
      expectUnresolved(await realService(boundClear).evaluate(broken, OUTPUT), 'MALFORMED_GENERATION_ARTIFACT');
    });
  });

  // -------------------------------------------------------------------------
  describe('scope: an ordered composition, and nothing else', () => {
    it('composes exactly two dependencies, in the frozen order, with no policy engine of its own', () => {
      const service = executable('shared-privacy-authority-delivery-readiness.service.ts');
      expect(service.match(/this\.sourceDisclosure\.evaluate\(/gu)).toHaveLength(1);
      expect(service.match(/this\.authority\.revalidate\(/gu)).toHaveLength(1);
      expect(service.indexOf('this.sourceDisclosure.evaluate(')).toBeLessThan(service.indexOf('this.authority.revalidate('));
      // Never concurrently: no combinator may appear at all.
      for (const pattern of [/Promise\.all|Promise\.allSettled|Promise\.race|Promise\.any/u, /setTimeout|setInterval|AbortController/u]) {
        expect(service).not.toMatch(pattern);
      }
      // The second gate is reachable only past a cleared first one.
      expect(service).toContain("if (disclosure.state === 'BLOCKED') return Object.freeze({ state: 'BLOCKED', reason: 'SOURCE_DISCLOSURE_BLOCKED' } as const);");
      expect(service).toContain("if (disclosure.state === 'UNRESOLVED') {");
      expect(service.indexOf("disclosure.state === 'BLOCKED'")).toBeLessThan(service.indexOf('this.authority.revalidate('));
      expect(service.indexOf("disclosure.state === 'UNRESOLVED'")).toBeLessThan(service.indexOf('this.authority.revalidate('));
      // Two constructor dependencies, and no third policy, safety or launch input.
      expect(service.match(/@Injectable\(\)/gu)).toHaveLength(1);
      expect(service).not.toMatch(/@Inject\(|SafetyGate|SafetyResponseGate|LaunchGateService|Entitlement|FeatureFlag|subscription/u);
    });

    it('implements no detector, no safety policy, no entitlement and no persistence', () => {
      const service = executable('shared-privacy-authority-delivery-readiness.service.ts');
      for (const pattern of [
        /outputText\.(?:includes|indexOf|match|search|slice|split|substring|replace|toLowerCase)/u,
        /\bquote\b|redact|similar|threshold|embedding|Classifier/iu,
        /persist|outbox|writeAudit|\.save\(|repository|INSERT|CREATE\s+TABLE/iu,
        /randomUUID|Math\.random|Date\.now|new Date|performance\.now/u,
        /\bfetch\(|new Pool\(|SUPABASE|SERVICE_ROLE|\/rest\/v1\//u,
        /model-router|ModelRouter|openai|anthropic|regenerat/iu,
        /console\.|logger|\bLogger\b/u,
        /@Controller|@Get\(|@Post\(|@Module|\.dto\b/u,
      ]) {
        expect(service).not.toMatch(pattern);
      }
      // It touches the output for exactly one purpose: handing the same bytes to
      // both boundaries.
      expect(service.match(/\boutputText\b/gu)).toHaveLength(3);
    });

    it('reuses the frozen I-03F vocabulary rather than re-spelling it, and the guard is not vacuous', () => {
      const service = executable('shared-privacy-authority-delivery-readiness.service.ts');
      expect(service).toContain('SHARED_DELIVERY_AUTHORITY_STALE_REASONS');
      expect(service).toContain('SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS');
      expect(service).not.toMatch(/'WORLD_STATE_CHANGED'|'AUDIENCE_CHANGED'|'PRIVATE_AUTHORITY_CHANGED'|'NO_ACTIVE_HUMANS'/u);
      expect(service.length).toBeGreaterThan(500);
      // The comment-only phrasing really was stripped, so every ban above was
      // answered by executable code rather than by prose.
      expect(service).not.toContain('no eager second call');
      expect(readFileSync(join(__dirname, 'shared-privacy-authority-delivery-readiness.service.ts'), 'utf8')).toContain('no eager second call');
    });
  });
});

// --- static-guard helpers -------------------------------------------------------

function executable(file: string): string {
  return readFileSync(join(__dirname, file), 'utf8')
    .replace(/\r\n/gu, '\n')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^[ \t]*\/\/.*$/gmu, '')
    .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');
}
