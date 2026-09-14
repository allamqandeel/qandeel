import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HumanPrincipal } from '../kernel/principal.types';
import { QANDEEL_SYSTEM_ACTOR } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedWorldBirthRequest } from '../kernel/shared-world.types';
import { attemptSharedWorldBirth, contextAdmissionAuthorizes, validateContextAdmission } from '../kernel/world-invariants';
import {
  AUTHORITY_DECISIONS,
  STANDING_CONTEXT_ACTION,
  STANDING_CONTEXT_DENY_REASONS,
  STANDING_CONTEXT_GRANT_STATUSES,
  STANDING_CONTEXT_PURPOSE,
  STANDING_CONTEXT_RESOLUTION_FAILURES,
  STANDING_CONTEXT_UNKNOWN_REASONS,
} from './standing-context-authority.types';
import type {
  SharedHumanAudienceSnapshot,
  StandingContextAllowConstraints,
  StandingContextAuthorityDecision,
  StandingContextAuthorityRequest,
  StandingContextGrantResolution,
  StandingContextGrantSnapshot,
} from './standing-context-authority.types';
import { evaluateStandingContextAuthority } from './standing-context-authority';

const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human('human-mohamed');
const HADIR = human('human-hadir');
const AHMED = human('human-ahmed');
const OMAR = human('human-omar');

// A SharedWorldId exists only through a valid Shared World birth (I-01A); the
// evaluator never mints one, so the fixtures obtain theirs the same way.
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
const WORLD_A = bornWorldId('shared-world-a');
const WORLD_B = bornWorldId('shared-world-b');

const audience = (humans: ReadonlyArray<HumanPrincipal>, snapshotRef = 'audience-snapshot-1'): SharedHumanAudienceSnapshot => ({ snapshotRef, humans });
const request = (overrides: Partial<StandingContextAuthorityRequest> = {}): StandingContextAuthorityRequest => ({
  action: STANDING_CONTEXT_ACTION,
  grantor: MOHAMED,
  targetWorldId: WORLD_A,
  purpose: STANDING_CONTEXT_PURPOSE,
  audienceSnapshot: audience([MOHAMED, HADIR]),
  ...overrides,
});
const grant = (overrides: Partial<StandingContextGrantSnapshot> = {}): StandingContextGrantSnapshot => ({
  grantId: 'grant-1',
  worldId: WORLD_A,
  grantor: MOHAMED,
  status: 'ACTIVE',
  audienceCeiling: [MOHAMED, HADIR],
  ...overrides,
});
const found = (snapshot: StandingContextGrantSnapshot = grant(), authoritySnapshotRef = 'authority-snapshot-1'): StandingContextGrantResolution =>
  ({ state: 'FOUND', authoritySnapshotRef, grant: snapshot });
const NOT_FOUND: StandingContextGrantResolution = { state: 'NOT_FOUND', authoritySnapshotRef: 'authority-snapshot-1' };
const UNRESOLVED: StandingContextGrantResolution = { state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' };

const evaluate = (req: unknown, res: unknown): StandingContextAuthorityDecision =>
  evaluateStandingContextAuthority(req as StandingContextAuthorityRequest, res as StandingContextGrantResolution);

function allowed(req: StandingContextAuthorityRequest, res: StandingContextGrantResolution) {
  const decision = evaluateStandingContextAuthority(req, res);
  if (decision.decision !== 'ALLOW') throw new Error(`expected ALLOW, got ${decision.decision} / ${decision.reason}`);
  return decision;
}

const EXPECTED_CONSTRAINTS: StandingContextAllowConstraints = {
  contextClassification: 'PRIVATE_REASONING_ONLY_CONTEXT',
  reasoningAuthority: 'ALLOW',
  directPrivateDisclosureAuthority: 'NOT_GRANTED',
  materialDisclosureAuthority: 'NOT_GRANTED',
  provenanceDisclosure: 'SEALED',
  deliveryAuthority: 'REQUIRES_REVALIDATION',
};

describe('Standing Context authority - decision vocabulary (task §3, §15)', () => {
  it('uses exactly ALLOW / DENY / UNKNOWN externally and bounded internal reason classes', () => {
    expect([...AUTHORITY_DECISIONS]).toEqual(['ALLOW', 'DENY', 'UNKNOWN']);
    expect([...STANDING_CONTEXT_DENY_REASONS].sort()).toEqual(['AUDIENCE_EXCEEDS_GRANT_CEILING', 'GRANTOR_MISMATCH', 'GRANT_REVOKED', 'NO_STANDING_CONTEXT_GRANT', 'TARGET_WORLD_MISMATCH']);
    expect([...STANDING_CONTEXT_UNKNOWN_REASONS].sort()).toEqual(['GRANT_STATE_UNRESOLVED', 'MALFORMED_AUDIENCE_SNAPSHOT', 'MALFORMED_GRANT_SNAPSHOT', 'MALFORMED_REQUEST', 'MISSING_AUDIENCE_SNAPSHOT_REF', 'MISSING_AUTHORITY_SNAPSHOT_REF', 'UNKNOWN_GRANT_STATUS']);
    expect([...STANDING_CONTEXT_GRANT_STATUSES]).toEqual(['ACTIVE', 'REVOKED']);
    expect(STANDING_CONTEXT_RESOLUTION_FAILURES.length).toBeGreaterThan(0);
    expect(STANDING_CONTEXT_ACTION).toBe('REASON_FROM_PRIVATE_CONTEXT');
    expect(STANDING_CONTEXT_PURPOSE).toBe('SHARED_REASONING');
  });

  it('agrees with the frozen kernel: the Shared admission purpose is SHARED_REASONING and never material disclosure', () => {
    const admission = validateContextAdmission({ scope: 'SHARED_EXACT_WORLD', owner: MOHAMED, purpose: STANDING_CONTEXT_PURPOSE }, { architectureClass: 'WORLD', worldType: 'SHARED_WORLD', worldId: WORLD_A });
    expect(admission.valid).toBe(true);
    if (!admission.valid) throw new Error('unreachable');
    expect(contextAdmissionAuthorizes(admission.admission, { question: 'REASONING_FOR_SHARED_WORLD', worldId: WORLD_A })).toBe(true);
    expect(contextAdmissionAuthorizes(admission.admission, { question: 'MATERIAL_DISCLOSURE' })).toBe(false);
  });
});

describe('Standing Context authority - ALLOW law (task §11.7, §12-§14, §23.1-3, §23.21-26)', () => {
  it('allows an exact active grant for the exact World, exact grantor and exact ceiling audience, reasoning-only', () => {
    const decision = allowed(request(), found());
    expect(decision.externalEffect).toBe('ADMIT_FOR_REASONING_ONLY');
    expect(decision.constraints).toEqual(EXPECTED_CONSTRAINTS);
    expect(decision.binding).toEqual({
      action: 'REASON_FROM_PRIVATE_CONTEXT',
      grantorHumanId: 'human-mohamed',
      targetWorldId: WORLD_A,
      purpose: 'SHARED_REASONING',
      audienceHumanIds: ['human-hadir', 'human-mohamed'],
      grantId: 'grant-1',
      authoritySnapshotRef: 'authority-snapshot-1',
      audienceSnapshotRef: 'audience-snapshot-1',
    });
    expect(Object.keys(decision).sort()).toEqual(['binding', 'constraints', 'decision', 'externalEffect']);
  });

  it('allows an audience that is a strict subset of the ceiling', () => {
    const decision = allowed(request({ audienceSnapshot: audience([HADIR]) }), found(grant({ audienceCeiling: [MOHAMED, HADIR, AHMED] })));
    expect(decision.binding.audienceHumanIds).toEqual(['human-hadir']);
  });

  it('gives audience order no authority meaning and canonicalizes it in the binding', () => {
    const ceiling = found(grant({ audienceCeiling: [AHMED, MOHAMED, HADIR] }));
    const first = allowed(request({ audienceSnapshot: audience([MOHAMED, HADIR, AHMED]) }), ceiling);
    const second = allowed(request({ audienceSnapshot: audience([AHMED, HADIR, MOHAMED]) }), ceiling);
    expect(second).toEqual(first);
    expect(first.binding.audienceHumanIds).toEqual(['human-ahmed', 'human-hadir', 'human-mohamed']);
    // Ceiling order is equally meaningless.
    expect(allowed(request({ audienceSnapshot: audience([MOHAMED, HADIR, AHMED]) }), found(grant({ audienceCeiling: [HADIR, AHMED, MOHAMED] })))).toEqual(first);
  });

  it('says private reasoning only: no direct private disclosure, no material disclosure, sealed provenance, delivery not authorized', () => {
    const decision = allowed(request(), found());
    expect(decision.constraints.contextClassification).toBe('PRIVATE_REASONING_ONLY_CONTEXT');
    expect(decision.constraints.reasoningAuthority).toBe('ALLOW');
    expect(decision.constraints.directPrivateDisclosureAuthority).toBe('NOT_GRANTED');
    expect(decision.constraints.materialDisclosureAuthority).toBe('NOT_GRANTED');
    expect(decision.constraints.provenanceDisclosure).toBe('SEALED');
    expect(decision.constraints.deliveryAuthority).toBe('REQUIRES_REVALIDATION');
    expect(Object.keys(decision.constraints).sort()).toEqual(['contextClassification', 'deliveryAuthority', 'directPrivateDisclosureAuthority', 'materialDisclosureAuthority', 'provenanceDisclosure', 'reasoningAuthority']);
    // There is no generic `allowed: true`.
    expect('allowed' in decision).toBe(false);
    // @ts-expect-error the constraint set has exactly one legal value per position: material disclosure can never be GRANTED.
    const widened: StandingContextAllowConstraints = { ...EXPECTED_CONSTRAINTS, materialDisclosureAuthority: 'GRANTED' };
    expect(widened.materialDisclosureAuthority).not.toBe(decision.constraints.materialDisclosureAuthority);
  });

  it('never carries a disclosure, transfer or provenance permission literal in any ALLOW result', () => {
    const decision = allowed(request(), found(grant({ audienceCeiling: [MOHAMED, HADIR, AHMED] })));
    const literals = JSON.stringify(decision);
    for (const forbidden of ['DISCLOSE_PRIVATE_FACT', 'QUOTE_PRIVATE_SOURCE', 'COPY_PRIVATE_SOURCE', 'PUBLISH_PRIVATE_SOURCE', 'EXPORT_PRIVATE_SOURCE', 'PROVENANCE_DISCLOSURE_ALLOWED', 'MATERIAL_TRANSFER_ALLOWED', '"GRANTED"', '"DISCLOSED"', '"ALLOWED"']) {
      expect(literals).not.toContain(forbidden);
    }
  });

  it('binds the ALLOW immutably to grant, World, grantor, exact audience and both snapshot references', () => {
    const decision = allowed(request(), found());
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.binding)).toBe(true);
    expect(Object.isFrozen(decision.binding.audienceHumanIds)).toBe(true);
    expect(Object.isFrozen(decision.constraints)).toBe(true);
    expect(() => { (decision.binding as { grantId: string }).grantId = 'grant-2'; }).toThrow(TypeError);
    // A different authority snapshot or audience snapshot yields a different binding for the same facts.
    expect(allowed(request(), found(grant(), 'authority-snapshot-2')).binding.authoritySnapshotRef).toBe('authority-snapshot-2');
    expect(allowed(request({ audienceSnapshot: audience([MOHAMED, HADIR], 'audience-snapshot-2') }), found()).binding.audienceSnapshotRef).toBe('audience-snapshot-2');
    // The binding carries only what was evaluated: no timestamp, no generated identifier.
    expect(Object.keys(decision.binding).sort()).toEqual(['action', 'audienceHumanIds', 'audienceSnapshotRef', 'authoritySnapshotRef', 'grantId', 'grantorHumanId', 'purpose', 'targetWorldId']);
  });

  it('produces a different binding for audience A and audience A+1 even when both are inside the ceiling', () => {
    const ceiling = found(grant({ audienceCeiling: [MOHAMED, HADIR, AHMED] }));
    const a = allowed(request({ audienceSnapshot: audience([MOHAMED, HADIR]) }), ceiling);
    const aPlusOne = allowed(request({ audienceSnapshot: audience([MOHAMED, HADIR, AHMED]) }), ceiling);
    expect(a.binding).not.toEqual(aPlusOne.binding);
    expect(a.binding.audienceHumanIds).toEqual(['human-hadir', 'human-mohamed']);
    expect(aPlusOne.binding.audienceHumanIds).toEqual(['human-ahmed', 'human-hadir', 'human-mohamed']);
  });
});

describe('Standing Context authority - audience ceiling (task §11.7, §16-§17, §23.4-5, §23.20)', () => {
  it('runs the canonical scenario: {Mohamed, Hadir} ceiling allows {Mohamed, Hadir} and denies {Mohamed, Hadir, Ahmed} under the same old grant', () => {
    const oldGrant = found(grant({ audienceCeiling: [MOHAMED, HADIR] }));
    expect(allowed(request({ audienceSnapshot: audience([MOHAMED, HADIR]) }), oldGrant).decision).toBe('ALLOW');
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED, HADIR, AHMED], 'audience-snapshot-after-join') }), oldGrant))
      .toEqual({ decision: 'DENY', externalEffect: 'BLOCKED', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
  });

  it('denies one extra audience human outside the ceiling, whoever it is', () => {
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED, OMAR]) }), found())).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
    expect(evaluate(request({ audienceSnapshot: audience([OMAR]) }), found())).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
  });

  it('represents membership expansion only as a changed Audience Snapshot and never widens the ceiling', () => {
    const ceiling = Object.freeze([MOHAMED, HADIR]);
    const resolution = Object.freeze({ state: 'FOUND', authoritySnapshotRef: 'authority-snapshot-1', grant: Object.freeze(grant({ audienceCeiling: ceiling })) } as const);
    const expanded = Object.freeze(request({ audienceSnapshot: Object.freeze(audience(Object.freeze([MOHAMED, HADIR, AHMED]))) }));
    expect(evaluate(expanded, resolution)).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
    // Evaluating again with the same grant still denies: nothing was added to the ceiling.
    expect(evaluate(expanded, resolution)).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
    expect(resolution.grant.audienceCeiling).toEqual([MOHAMED, HADIR]);
    expect(expanded.audienceSnapshot.humans).toEqual([MOHAMED, HADIR, AHMED]);
    // Only an explicitly reconfirmed grant (a NEW resolved grant with a wider ceiling) allows the expanded audience.
    expect(allowed(expanded, found(grant({ grantId: 'grant-2', audienceCeiling: [MOHAMED, HADIR, AHMED] }))).binding.grantId).toBe('grant-2');
  });

  it('lets an empty ceiling authorize no non-empty audience', () => {
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED]) }), found(grant({ audienceCeiling: [] })))).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
  });

  it('consumes exactly one resolved grant and never a list to union', () => {
    const narrowA = grant({ grantId: 'grant-a', audienceCeiling: [MOHAMED, HADIR] });
    const narrowB = grant({ grantId: 'grant-b', audienceCeiling: [MOHAMED, AHMED] });
    const wideAudience = request({ audienceSnapshot: audience([MOHAMED, HADIR, AHMED]) });
    expect(evaluate(wideAudience, found(narrowA))).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
    expect(evaluate(wideAudience, found(narrowB))).toMatchObject({ decision: 'DENY', reason: 'AUDIENCE_EXCEEDS_GRANT_CEILING' });
    // A list of grants, or a resolution carrying several, is not a valid resolution at all.
    expect(evaluate(wideAudience, [found(narrowA), found(narrowB)])).toMatchObject({ decision: 'UNKNOWN', reason: 'GRANT_STATE_UNRESOLVED' });
    expect(evaluate(wideAudience, { state: 'FOUND', authoritySnapshotRef: 'authority-snapshot-1', grants: [narrowA, narrowB] })).toMatchObject({ decision: 'UNKNOWN', reason: 'GRANT_STATE_UNRESOLVED' });
    expect(evaluate(wideAudience, { ...found(narrowA), extraGrant: narrowB })).toMatchObject({ decision: 'UNKNOWN', reason: 'GRANT_STATE_UNRESOLVED' });
    expect(evaluateStandingContextAuthority.length).toBe(2);
  });
});

describe('Standing Context authority - DENY law (task §11.1, §11.3-§11.5, §23.6-7, §23.9-10)', () => {
  it('denies a revoked grant: revocation stops future reasoning', () => {
    expect(evaluate(request(), found(grant({ status: 'REVOKED' })))).toEqual({ decision: 'DENY', externalEffect: 'BLOCKED', reason: 'GRANT_REVOKED' });
  });

  it('denies a positively resolved NOT_FOUND', () => {
    expect(evaluate(request(), NOT_FOUND)).toEqual({ decision: 'DENY', externalEffect: 'BLOCKED', reason: 'NO_STANDING_CONTEXT_GRANT' });
  });

  it('denies a grant for a different Shared World: a Standing Context Grant never transfers between Worlds', () => {
    expect(evaluate(request({ targetWorldId: WORLD_B }), found())).toMatchObject({ decision: 'DENY', reason: 'TARGET_WORLD_MISMATCH' });
    expect(evaluate(request(), found(grant({ worldId: WORLD_B })))).toMatchObject({ decision: 'DENY', reason: 'TARGET_WORLD_MISMATCH' });
  });

  it("denies a grant held by a different human: Mohamed's grant never authorizes Hadir's private context", () => {
    expect(evaluate(request({ grantor: HADIR }), found())).toMatchObject({ decision: 'DENY', reason: 'GRANTOR_MISMATCH' });
    expect(evaluate(request(), found(grant({ grantor: HADIR })))).toMatchObject({ decision: 'DENY', reason: 'GRANTOR_MISMATCH' });
  });

  it('blocks externally on DENY exactly like UNKNOWN, while keeping the reason class distinct', () => {
    const denied = evaluate(request(), NOT_FOUND);
    const unresolved = evaluate(request(), UNRESOLVED);
    expect(denied.externalEffect).toBe('BLOCKED');
    expect(unresolved.externalEffect).toBe('BLOCKED');
    expect(denied.decision).toBe('DENY');
    expect(unresolved.decision).toBe('UNKNOWN');
    expect('constraints' in denied).toBe(false);
    expect('binding' in denied).toBe(false);
  });
});

describe('Standing Context authority - UNKNOWN law (task §11.1-§11.2, §11.6, §23.8, §23.11-19, §23.28)', () => {
  const unknown = (reason: string) => ({ decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason });

  it('maps an unresolved lookup to UNKNOWN, never to DENY, whatever the failure class says', () => {
    expect(evaluate(request(), UNRESOLVED)).toEqual(unknown('GRANT_STATE_UNRESOLVED'));
    for (const failure of STANDING_CONTEXT_RESOLUTION_FAILURES) {
      expect(evaluate(request(), { state: 'UNRESOLVED', failure })).toEqual(unknown('GRANT_STATE_UNRESOLVED'));
    }
    expect(evaluate(request(), { state: 'UNRESOLVED' })).toEqual(unknown('GRANT_STATE_UNRESOLVED'));
    expect(evaluate(request(), { state: 'MAYBE', authoritySnapshotRef: 'authority-snapshot-1' })).toEqual(unknown('GRANT_STATE_UNRESOLVED'));
    expect(evaluate(request(), undefined)).toEqual(unknown('GRANT_STATE_UNRESOLVED'));
    expect(evaluate(request(), null)).toEqual(unknown('GRANT_STATE_UNRESOLVED'));
  });

  it('treats an unknown grant status as UNKNOWN, not as ACTIVE and not as REVOKED', () => {
    for (const status of ['PENDING', 'EXPIRED', 'PAUSED', 'SUPERSEDED', 'active', '', undefined, true]) {
      expect(evaluate(request(), found(grant({ status: status as never })))).toEqual(unknown('UNKNOWN_GRANT_STATUS'));
    }
  });

  it('refuses QANDEEL or a malformed principal as grantor or audience member', () => {
    expect(evaluate(request({ grantor: QANDEEL_SYSTEM_ACTOR as never }), found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate(request({ grantor: { kind: 'HUMAN', humanId: '  ' } }), found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED, QANDEEL_SYSTEM_ACTOR as never]) }), found())).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
    expect(evaluate(request({ audienceSnapshot: audience([{ kind: 'SYSTEM', humanId: 'human-hadir' } as never]) }), found())).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
    expect(evaluate(request({ audienceSnapshot: audience(['human-hadir' as never]) }), found())).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
    // The same holds for the grant side: a QANDEEL grantor or ceiling member is malformed state, never a match.
    expect(evaluate(request(), found(grant({ grantor: QANDEEL_SYSTEM_ACTOR as never })))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    expect(evaluate(request(), found(grant({ audienceCeiling: [MOHAMED, QANDEEL_SYSTEM_ACTOR as never] })))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
  });

  it('treats duplicate audience or ceiling humans as malformed instead of silently normalizing them', () => {
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED, HADIR, MOHAMED]) }), found())).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED, human('human-mohamed')]) }), found())).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
    expect(evaluate(request(), found(grant({ audienceCeiling: [MOHAMED, HADIR, HADIR] })))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
  });

  it('treats an empty output audience as malformed', () => {
    expect(evaluate(request({ audienceSnapshot: audience([]) }), found())).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
    expect(evaluate(request({ audienceSnapshot: audience([]) }), found(grant({ audienceCeiling: [] })))).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
  });

  it('requires a non-blank authority snapshot reference for FOUND and NOT_FOUND alike', () => {
    expect(evaluate(request(), found(grant(), ''))).toEqual(unknown('MISSING_AUTHORITY_SNAPSHOT_REF'));
    expect(evaluate(request(), found(grant(), '   '))).toEqual(unknown('MISSING_AUTHORITY_SNAPSHOT_REF'));
    expect(evaluate(request(), { state: 'FOUND', grant: grant() })).toEqual(unknown('MISSING_AUTHORITY_SNAPSHOT_REF'));
    expect(evaluate(request(), { state: 'NOT_FOUND', authoritySnapshotRef: '' })).toEqual(unknown('MISSING_AUTHORITY_SNAPSHOT_REF'));
    expect(evaluate(request(), { state: 'NOT_FOUND' })).toEqual(unknown('MISSING_AUTHORITY_SNAPSHOT_REF'));
  });

  it('requires a non-blank audience snapshot reference', () => {
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED, HADIR], '') }), found())).toEqual(unknown('MISSING_AUDIENCE_SNAPSHOT_REF'));
    expect(evaluate(request({ audienceSnapshot: audience([MOHAMED, HADIR], ' ') }), found())).toEqual(unknown('MISSING_AUDIENCE_SNAPSHOT_REF'));
    expect(evaluate(request({ audienceSnapshot: { humans: [MOHAMED, HADIR] } as never }), found())).toEqual(unknown('MALFORMED_AUDIENCE_SNAPSHOT'));
  });

  it('treats a malformed request, action, purpose, target or extra permission claim as UNKNOWN', () => {
    expect(evaluate(undefined, found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate('reason', found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate(request({ action: 'DISCLOSE_PRIVATE_FACT' as never }), found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate(request({ action: 'reason' as never }), found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate(request({ purpose: 'MATCHING_CAPABILITY' as never }), found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate(request({ purpose: 'PUBLIC_REASONING' as never }), found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate(request({ targetWorldId: '' as never }), found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate({ ...request(), clientPermitted: true }, found())).toEqual(unknown('MALFORMED_REQUEST'));
    expect(evaluate({ ...request(), sourceScope: 'ALL_PRIVATE_CONTEXT' }, found())).toEqual(unknown('MALFORMED_REQUEST'));
    const withoutPurpose: Record<string, unknown> = { ...request() };
    delete withoutPurpose.purpose;
    expect(evaluate(withoutPurpose, found())).toEqual(unknown('MALFORMED_REQUEST'));
    // @ts-expect-error there is no disclosure action in this authority family.
    const disclosure: StandingContextAuthorityRequest = { ...request(), action: 'DISCLOSE_PRIVATE_FACT' };
    expect(evaluate(disclosure, found()).decision).toBe('UNKNOWN');
  });

  it('treats a malformed grant snapshot, including one carrying a scope, TTL or disclosure flag, as UNKNOWN', () => {
    expect(evaluate(request(), { state: 'FOUND', authoritySnapshotRef: 'authority-snapshot-1' })).toEqual(unknown('GRANT_STATE_UNRESOLVED'));
    expect(evaluate(request(), found(null as never))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    expect(evaluate(request(), found(grant({ grantId: '' })))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    expect(evaluate(request(), found(grant({ worldId: '' as never })))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    expect(evaluate(request(), found(grant({ audienceCeiling: 'everyone' as never })))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    expect(evaluate(request(), found({ ...grant(), scope: { disclosure: true } } as never))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    expect(evaluate(request(), found({ ...grant(), validUntil: '2099-01-01T00:00:00Z' } as never))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    expect(evaluate(request(), found({ ...grant(), materialDisclosureAllowed: true } as never))).toEqual(unknown('MALFORMED_GRANT_SNAPSHOT'));
    // @ts-expect-error the grant status vocabulary is exactly ACTIVE | REVOKED.
    const pending: StandingContextGrantSnapshot = grant({ status: 'PENDING' });
    expect(evaluate(request(), found(pending)).decision).toBe('UNKNOWN');
  });

  it('never lets a malformed or unknown path become ALLOW, whatever else is exact', () => {
    const exact = found();
    const malformedRequests: ReadonlyArray<unknown> = [
      null, {}, request({ grantor: QANDEEL_SYSTEM_ACTOR as never }), request({ audienceSnapshot: audience([]) }),
      request({ audienceSnapshot: audience([MOHAMED, MOHAMED]) }), { ...request(), allowed: true },
    ];
    for (const malformed of malformedRequests) expect(evaluate(malformed, exact).decision).toBe('UNKNOWN');
    const malformedResolutions: ReadonlyArray<unknown> = [
      null, {}, UNRESOLVED, found(grant({ status: 'GRANTED' as never })), found(grant({ audienceCeiling: [HADIR, HADIR, MOHAMED] })),
      { ...found(), allowed: true }, found(grant(), ''),
    ];
    for (const malformed of malformedResolutions) expect(evaluate(request(), malformed).decision).toBe('UNKNOWN');
  });
});

describe('Standing Context authority - no Matching / Public / Replay target (task §7, §26)', () => {
  it('cannot represent or evaluate a Matching, Public World, Public Experience, Replay or Introduction target', () => {
    for (const target of ['MATCHING', 'PUBLIC_WORLD', 'PUBLIC_EXPERIENCE', 'REPLAY', 'INTRODUCTION', 'MY_WORLD', 'SHARED_WORLD']) {
      // Even when the resolved grant "agrees", a taxonomy name is not a World identity and fails UNKNOWN before any comparison.
      expect(evaluate(request({ targetWorldId: target as never }), found(grant({ worldId: target as never })))).toEqual({ decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason: 'MALFORMED_REQUEST' });
      expect(evaluate(request(), found(grant({ worldId: target as never })))).toEqual({ decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason: 'MALFORMED_GRANT_SNAPSHOT' });
    }
    // @ts-expect-error the target is a branded SharedWorldId minted only by Shared World birth; a raw string is not one.
    const rawTarget: StandingContextAuthorityRequest = { ...request(), targetWorldId: 'PUBLIC_WORLD' };
    expect(evaluate(rawTarget, found()).decision).toBe('UNKNOWN');
    expect(Object.keys(request()).sort()).toEqual(['action', 'audienceSnapshot', 'grantor', 'purpose', 'targetWorldId']);
  });
});

describe('Standing Context authority - determinism and scope guard (task §14, §19, §24, §29)', () => {
  const sourceFiles = ['standing-context-authority.types.ts', 'standing-context-authority.ts'];
  const executable = (file: string): string => readFileSync(join(__dirname, file), 'utf8')
    .replace(/\r\n/gu, '\n')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^[ \t]*\/\/.*$/gmu, '')
    .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');

  it('is deterministic: identical inputs give identical decisions and bindings across calls', () => {
    const first = allowed(request(), found());
    const second = allowed(request(), found());
    expect(second).toEqual(first);
    expect(second.binding).toEqual(first.binding);
    expect(evaluate(request(), NOT_FOUND)).toEqual(evaluate(request(), NOT_FOUND));
  });

  it('contains exactly the three authority files and imports only the frozen kernel and its own sibling', () => {
    const files = readdirSync(__dirname).filter((name) => name.endsWith('.ts')).sort();
    expect(files).toEqual(['standing-context-authority.spec.ts', 'standing-context-authority.ts', 'standing-context-authority.types.ts']);
    for (const file of sourceFiles) {
      const source = executable(file);
      const imports = [...source.matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]);
      expect(imports.length).toBeGreaterThan(0);
      for (const specifier of imports) expect(specifier).toMatch(/^(?:\.\.\/kernel\/[a-z-]+(?:\.types)?|\.\/standing-context-authority(?:\.types)?)$/u);
      expect(source).not.toMatch(/\brequire\(|\bimport\(/u);
    }
  });

  it('reaches no database, Supabase, Personal runtime, Nest registration, network, clock or random identity', () => {
    const forbidden: ReadonlyArray<RegExp> = [
      /database/iu, /\bpg\b/u, /supabase/iu, /conversation/iu, /model-router|ModelRouter/u, /\bmemory\b/iu, /human-model|HumanModel/u,
      /intelligence-runtime|IntelligenceRuntime/u, /runtime-events|RuntimeEvent/u, /@nestjs|@Controller|@Module|@Injectable|@Get|@Post/u,
      /\bfetch\b|axios|XMLHttpRequest|http[s]?:/u, /randomUUID|\bcrypto\b|Math\.random/u, /Date\.now|new Date|performance\.now|setTimeout|process\./u,
      /\bawait\b|\basync\b|Promise/u, /@qandeel\/runtime/u, /cross-context|crossContext/u,
    ];
    for (const file of sourceFiles) {
      const source = executable(file);
      for (const pattern of forbidden) expect(source).not.toMatch(pattern);
      // The guard is not vacuous: the executable source is non-trivial and the comment-only phrasing has been stripped.
      expect(source.length).toBeGreaterThan(500);
      expect(source).not.toContain('Pre-model authority decision.');
    }
    // The staleness boundary is documented in both source files.
    for (const file of sourceFiles) {
      expect(readFileSync(join(__dirname, file), 'utf8').replace(/\r\n/gu, '\n')).toContain('Pre-model authority decision. Must be revalidated before protected\n// delivery/commit by a later runtime boundary.');
    }
  });

  it('carries no disclosure, transfer or Matching / Public literal in executable source', () => {
    for (const file of sourceFiles) {
      const source = executable(file);
      for (const literal of ["'DISCLOSE_PRIVATE_FACT'", "'QUOTE_PRIVATE_SOURCE'", "'COPY_PRIVATE_SOURCE'", "'PUBLISH_PRIVATE_SOURCE'", "'EXPORT_PRIVATE_SOURCE'", "'PROVENANCE_DISCLOSURE_ALLOWED'", "'MATERIAL_TRANSFER_ALLOWED'", "'GRANTED'", "'MATCHING'", "'PUBLIC_WORLD'", "'MATCHING_CAPABILITY'"]) {
        expect(source).not.toContain(literal);
      }
    }
  });
});
