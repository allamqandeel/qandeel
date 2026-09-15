// I-04G Independent Review FIX-B - the QANDEEL material commit evidence binder.
//
// What is proven here is exactly one property, in both directions: a commit
// input is assembled ONLY when the frozen I-03F revalidation and the frozen
// I-03G readiness describe the SAME operation, the SAME output bytes, the SAME
// audience and the SAME World - and is refused, with a bounded reason, whenever
// any one of those disagrees.
//
// The cross-World case is the one this file exists for: evidence that is
// perfectly valid for World A must not assemble a commit for World B even when
// the body bytes are byte-identical.

import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldBirthRequest } from '../kernel/shared-world.types';
import type { SharedWorldId } from '../kernel/world.types';
import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import type {
  SharedDeliveryAuthorityCurrent,
  SharedDeliveryAuthorityRevalidation,
} from '../delivery-authority/shared-delivery-authority.types';
import type {
  SharedPrivacyAuthorityDeliveryReadiness,
  SharedPrivacyAuthorityDeliveryReadinessDetail,
} from '../source-disclosure/shared-source-disclosure.types';
import {
  SHARED_QANDEEL_COMMIT_BINDING_REFUSALS,
  bindSharedQandeelMaterialCommit,
} from './shared-qandeel-material-commit-binding';

const IDS = {
  world: '10000000-0000-4000-8000-0000000000a1',
  otherWorld: '10000000-0000-4000-8000-0000000000a2',
  mohamed: '20000000-0000-4000-8000-0000000000b1',
  hadir: '20000000-0000-4000-8000-0000000000b2',
  source: '30000000-0000-4000-8000-0000000000c1',
  otherSource: '30000000-0000-4000-8000-0000000000c2',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human(IDS.mohamed);
const HADIR = human(IDS.hadir);

/** A SharedWorldId exists only through a valid Shared World birth (I-01A). */
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

const ref = (suffix: string): string => `sha256:${suffix.padEnd(64, '0')}`;
const ENVELOPE = 'ec:i04g:0001';
const GATE = ref('9a');
const REVALIDATION = ref('9b');
const READINESS = ref('9c');
const AUDIENCE = ref('9d');
const OTHER_AUDIENCE = ref('9e');
const BODY = 'An analysis produced for this exact Shared World.';

function authorityCurrent(overrides: Partial<SharedDeliveryAuthorityCurrent> = {}): SharedDeliveryAuthorityRevalidation {
  const revalidation: SharedDeliveryAuthorityCurrent = {
    revalidationRef: REVALIDATION,
    effectiveContextRef: ENVELOPE,
    outputDigest: digestProviderOutput(BODY),
    targetWorldId: WORLD,
    worldStateSnapshotRef: ref('8a'),
    audienceSnapshotRef: AUDIENCE,
    authorityStatus: 'CURRENT',
    sourceDisclosureAuthority: 'NOT_EVALUATED',
    systemSafetyAuthority: 'NOT_EVALUATED',
    deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
    directPrivateDisclosureAuthority: 'NOT_GRANTED',
    materialDisclosureAuthority: 'NOT_GRANTED',
    provenanceDisclosure: 'SEALED',
    ...overrides,
  };
  return { state: 'CURRENT', revalidation };
}

function readinessReady(
  overrides: Partial<SharedPrivacyAuthorityDeliveryReadinessDetail> = {},
): SharedPrivacyAuthorityDeliveryReadiness {
  const readiness: SharedPrivacyAuthorityDeliveryReadinessDetail = {
    readinessRef: READINESS,
    effectiveContextRef: ENVELOPE,
    outputDigest: digestProviderOutput(BODY),
    sourceDisclosureGateRef: GATE,
    authorityRevalidationRef: REVALIDATION,
    sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED',
    authorityStatus: 'CURRENT',
    systemSafetyStatus: 'NOT_EVALUATED',
    launchGateStatus: 'NOT_EVALUATED',
    deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
    ...overrides,
  };
  return { state: 'READY_FOR_LATER_DELIVERY_GATES', readiness };
}

const bind = (overrides: Partial<Parameters<typeof bindSharedQandeelMaterialCommit>[0]> = {}) =>
  bindSharedQandeelMaterialCommit({
    targetWorldId: WORLD,
    materialKind: 'QANDEEL_ANALYSIS',
    outputText: BODY,
    currentAudienceSnapshotRef: AUDIENCE,
    revalidation: authorityCurrent(),
    readiness: readinessReady(),
    materialSourceIds: [IDS.source],
    reasoningSourceRefs: ['ctx:personal:9f2a'],
    ...overrides,
  });

describe('bindSharedQandeelMaterialCommit', () => {
  it('assembles the exact commit input when every frozen boundary agrees', () => {
    const outcome = bind();
    expect(outcome.state).toBe('BOUND');
    if (outcome.state !== 'BOUND') return;
    expect(outcome.input.worldId).toBe(WORLD);
    expect(outcome.input.materialKind).toBe('QANDEEL_ANALYSIS');
    expect(outcome.input.bodyText).toBe(BODY);
    expect(outcome.input.outputDigest).toBe(digestProviderOutput(BODY));
    expect(outcome.input.effectiveContextRef).toBe(ENVELOPE);
    expect(outcome.input.sourceDisclosureGateRef).toBe(GATE);
    expect(outcome.input.authorityRevalidationRef).toBe(REVALIDATION);
    expect(outcome.input.readinessRef).toBe(READINESS);
    expect(outcome.input.audienceSnapshotRef).toBe(AUDIENCE);
    expect([...outcome.input.materialSourceIds]).toEqual([IDS.source]);
    expect([...outcome.input.reasoningSourceRefs]).toEqual(['ctx:personal:9f2a']);
  });

  it('refuses evidence from another World even when the body bytes are identical', () => {
    // The revalidation is perfectly valid - for World A. Committing it into
    // World B is exactly the reuse this binder exists to stop.
    const outcome = bind({ targetWorldId: OTHER_WORLD });
    expect(outcome).toEqual({ state: 'REFUSED', reason: 'WORLD_MISMATCH' });
  });

  it('refuses a revalidation that is not CURRENT, and a readiness that is not READY', () => {
    expect(bind({ revalidation: { state: 'STALE', reason: 'AUDIENCE_CHANGED' } }))
      .toEqual({ state: 'REFUSED', reason: 'AUTHORITY_NOT_CURRENT' });
    expect(bind({ revalidation: { state: 'UNRESOLVED', reason: 'AUDIENCE_UNRESOLVED' } }))
      .toEqual({ state: 'REFUSED', reason: 'AUTHORITY_NOT_CURRENT' });
    expect(bind({ readiness: { state: 'BLOCKED', reason: 'SOURCE_DISCLOSURE_BLOCKED' } }))
      .toEqual({ state: 'REFUSED', reason: 'READINESS_NOT_READY' });
    expect(bind({ readiness: { state: 'STALE', reason: 'AUTHORITY_STALE' } }))
      .toEqual({ state: 'REFUSED', reason: 'READINESS_NOT_READY' });
  });

  it('refuses evidence about different output bytes, from either boundary', () => {
    expect(bind({ outputText: 'a different analysis body' }))
      .toEqual({ state: 'REFUSED', reason: 'OUTPUT_MISMATCH' });
    expect(bind({ readiness: readinessReady({ outputDigest: digestProviderOutput('something else') }) }))
      .toEqual({ state: 'REFUSED', reason: 'OUTPUT_MISMATCH' });
  });

  it('refuses two boundaries that do not describe the same operation', () => {
    expect(bind({ readiness: readinessReady({ effectiveContextRef: 'ec:i04g:0002' }) }))
      .toEqual({ state: 'REFUSED', reason: 'OPERATION_MISMATCH' });
    expect(bind({ readiness: readinessReady({ authorityRevalidationRef: ref('7f') }) }))
      .toEqual({ state: 'REFUSED', reason: 'OPERATION_MISMATCH' });
  });

  it('refuses a revalidation performed against a different audience', () => {
    expect(bind({ currentAudienceSnapshotRef: OTHER_AUDIENCE }))
      .toEqual({ state: 'REFUSED', reason: 'AUDIENCE_MISMATCH' });
  });

  it('requires both dependency selections to be exact opaque sets', () => {
    expect(bind({ materialSourceIds: [IDS.source, IDS.source] }))
      .toEqual({ state: 'REFUSED', reason: 'MALFORMED_DEPENDENCIES' });
    expect(bind({ reasoningSourceRefs: ['ctx:a', 'ctx:a'] }))
      .toEqual({ state: 'REFUSED', reason: 'MALFORMED_DEPENDENCIES' });
    expect(bind({ reasoningSourceRefs: ['he told me in confidence that he is leaving'] }))
      .toEqual({ state: 'REFUSED', reason: 'MALFORMED_DEPENDENCIES' });
    expect(bind({ reasoningSourceRefs: [''] }))
      .toEqual({ state: 'REFUSED', reason: 'MALFORMED_DEPENDENCIES' });
    // Both selections may legitimately be empty: that is INDEPENDENT_TARGET_TRUTH.
    const independent = bind({ materialSourceIds: [], reasoningSourceRefs: [] });
    expect(independent.state).toBe('BOUND');
  });

  it('grants nothing: it restates no Safety, Launch or delivery position', () => {
    const outcome = bind();
    expect(outcome.state).toBe('BOUND');
    if (outcome.state !== 'BOUND') return;
    const assembled = JSON.stringify(outcome.input);
    for (const forbidden of ['systemSafety', 'launchGate', 'deliveryCommit', 'NOT_EVALUATED', 'allowed', 'approved']) {
      expect(assembled).not.toContain(forbidden);
    }
    // Every refusal stays a bounded internal class.
    expect([...SHARED_QANDEEL_COMMIT_BINDING_REFUSALS]).toEqual([
      'AUTHORITY_NOT_CURRENT', 'READINESS_NOT_READY', 'WORLD_MISMATCH', 'OUTPUT_MISMATCH',
      'OPERATION_MISMATCH', 'AUDIENCE_MISMATCH', 'MALFORMED_DEPENDENCIES',
    ]);
  });
});
