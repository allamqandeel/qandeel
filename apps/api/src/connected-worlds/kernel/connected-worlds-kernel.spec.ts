import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConsentPrincipal, HumanApproval, HumanPrincipal } from './principal.types';
import { QANDEEL_SYSTEM_ACTOR } from './principal.types';
import { ARCHITECTURE_CLASSES, NON_WORLD_KINDS, WORLD_TYPES } from './world.types';
import type { WorldType } from './world.types';
import { SHARED_WORLD_LEGAL_STATES } from './shared-world.types';
import type {
  BornSharedWorld,
  MatchingProposal,
  SharedInvitation,
  SharedWorldBirthRequest,
} from './shared-world.types';
import { CONTENT_AVAILABILITIES, DEPENDENCY_KINDS } from './material.types';
import type {
  HistoryAccessGrant,
  MembershipEpisode,
  ProvenanceRecord,
  ReplayArtifact,
} from './material.types';
import { CONTEXT_ADMISSION_SCOPES } from './authority.types';
import type { ContextAdmission } from './authority.types';
import {
  attemptSharedWorldBirth,
  classifyAudienceExpansion,
  classifyWorldCandidate,
  contextAdmissionAuthorizes,
  defaultHistoryAccessOnJoin,
  isDependencyKind,
  isHumanPrincipal,
  isIntroductionPairIntact,
  isLegalSharedWorldState,
  isWorldType,
  mayRequireSourceMaterialRights,
  memberOperationAvailability,
  requireHumanPrincipal,
  resolveSourceMaterialView,
  validateContextAdmission,
  validateMembershipEpisodes,
} from './world-invariants';

const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
const MOHAMED = human('human-mohamed');
const HADIR = human('human-hadir');
const OMAR = human('human-omar');

const invitation = (inviter: HumanPrincipal, target: HumanPrincipal): SharedInvitation =>
  ({ prospective: 'SHARED_INVITATION', inviter, target });
const accepted = (acceptedBy: ConsentPrincipal) => ({ kind: 'INVITATION_ACCEPTANCE' as const, acceptedBy });
const proposal = (first: HumanPrincipal, second: HumanPrincipal): MatchingProposal =>
  ({ architectureClass: 'RELATIONSHIP_STATE', prospective: 'MATCHING_PROPOSAL', pair: [first, second], state: 'PENDING' });

const standardBirth = (): SharedWorldBirthRequest => ({
  worldId: 'shared-world-1',
  phase: 'STANDARD',
  participantsAtBirth: [MOHAMED, HADIR],
  event: { basis: 'ACCEPTED_INVITATION', invitation: invitation(MOHAMED, HADIR), acceptance: accepted(HADIR) },
});
const introductionBirth = (): SharedWorldBirthRequest => ({
  worldId: 'shared-world-2',
  phase: 'INTRODUCTION',
  participantsAtBirth: [MOHAMED, HADIR],
  event: { basis: 'MUTUAL_MATCH', mutualMatch: { kind: 'MUTUAL_MATCH', proposal: proposal(MOHAMED, HADIR), acceptedBy: [MOHAMED, HADIR] } },
});

function born(request: SharedWorldBirthRequest): BornSharedWorld {
  const outcome = attemptSharedWorldBirth(request);
  if (!outcome.born) throw new Error(`expected a valid birth, got ${outcome.rejection}`);
  return outcome.world;
}
function rejectionOf(request: SharedWorldBirthRequest): string {
  const outcome = attemptSharedWorldBirth(request);
  if (outcome.born) throw new Error('expected the birth to fail closed');
  return outcome.rejection;
}

describe('Connected Worlds kernel - world taxonomy (task §5-§6)', () => {
  it('names exactly the five architecture classes and the three canonical Worlds', () => {
    expect([...ARCHITECTURE_CLASSES].sort()).toEqual(['CAPABILITY', 'MATERIAL_ARTIFACT', 'RELATIONSHIP_STATE', 'USER_STATE', 'WORLD']);
    expect([...WORLD_TYPES].sort()).toEqual(['MY_WORLD', 'PUBLIC_WORLD', 'SHARED_WORLD']);
    for (const worldType of WORLD_TYPES) {
      expect(isWorldType(worldType)).toBe(true);
      expect(classifyWorldCandidate(worldType)).toEqual({ verdict: 'WORLD', worldType });
    }
  });

  it('refuses to classify REPLAY, MATCHING, INTRODUCTION, PUBLIC_EXPERIENCE, INVITATION or DISCUSSION as a World', () => {
    expect([...NON_WORLD_KINDS].sort()).toEqual(['DISCUSSION', 'INTRODUCTION', 'INVITATION', 'MATCHING', 'PUBLIC_EXPERIENCE', 'REPLAY']);
    for (const kind of NON_WORLD_KINDS) {
      expect(isWorldType(kind)).toBe(false);
      expect(classifyWorldCandidate(kind)).toEqual({ verdict: 'NOT_A_WORLD', kind });
    }
    // An unknown or malformed name is not a World either: classification fails closed.
    expect(classifyWorldCandidate('FAMILY_WORLD')).toEqual({ verdict: 'UNKNOWN' });
    expect(classifyWorldCandidate(undefined)).toEqual({ verdict: 'UNKNOWN' });
    // @ts-expect-error REPLAY is not a WorldType - there is no fourth World.
    const replayAsWorld: WorldType = 'REPLAY';
    expect(isWorldType(replayAsWorld)).toBe(false);
  });
});

describe('Connected Worlds kernel - QANDEEL actor boundary (task §7)', () => {
  it('lets QANDEEL satisfy neither the human predicate nor a human consent / ownership position', () => {
    expect(isHumanPrincipal(MOHAMED)).toBe(true);
    expect(isHumanPrincipal(QANDEEL_SYSTEM_ACTOR)).toBe(false);
    expect(isHumanPrincipal({ kind: 'HUMAN', humanId: '   ' })).toBe(false);
    expect(requireHumanPrincipal(HADIR, 'owner')).toEqual(HADIR);
    expect(() => requireHumanPrincipal(QANDEEL_SYSTEM_ACTOR, 'consent principal')).toThrow(TypeError);
    // @ts-expect-error a required human approval cannot be given by the system actor.
    const approval: HumanApproval = { kind: 'HUMAN_APPROVAL', approvedBy: QANDEEL_SYSTEM_ACTOR };
    expect(isHumanPrincipal(approval.approvedBy)).toBe(false);
  });

  it('fails a Shared birth closed when QANDEEL is offered as participant or acceptor', () => {
    const qandeelAsParticipant = { ...standardBirth(), participantsAtBirth: [MOHAMED, QANDEEL_SYSTEM_ACTOR as unknown as HumanPrincipal] };
    expect(rejectionOf(qandeelAsParticipant)).toBe('NON_HUMAN_PARTICIPANT');
    const qandeelAsAcceptor: SharedWorldBirthRequest = {
      ...standardBirth(),
      event: { basis: 'ACCEPTED_INVITATION', invitation: invitation(MOHAMED, HADIR), acceptance: accepted(QANDEEL_SYSTEM_ACTOR as unknown as ConsentPrincipal) },
    };
    expect(rejectionOf(qandeelAsAcceptor)).toBe('NON_HUMAN_ACCEPTOR');
    const qandeelAsTarget: SharedWorldBirthRequest = {
      ...standardBirth(),
      event: { basis: 'ACCEPTED_INVITATION', invitation: invitation(MOHAMED, QANDEEL_SYSTEM_ACTOR as unknown as HumanPrincipal), acceptance: accepted(HADIR) },
    };
    expect(rejectionOf(qandeelAsTarget)).toBe('NON_HUMAN_PARTICIPANT');
  });
});

describe('Connected Worlds kernel - Shared World birth (task §8)', () => {
  it('keeps a prospective invitation and a pending Matching proposal free of any Shared world_id', () => {
    const pending = invitation(MOHAMED, HADIR);
    const pendingProposal = proposal(MOHAMED, HADIR);
    expect('worldId' in pending).toBe(false);
    expect('worldId' in pendingProposal).toBe(false);
    // @ts-expect-error a prospective invitation has no worldId to read.
    expect(pending.worldId).toBeUndefined();
    // @ts-expect-error a pending Matching proposal has no worldId to read.
    expect(pendingProposal.worldId).toBeUndefined();
    expect(pendingProposal.state).toBe('PENDING');
  });

  it('brands the world_id only through a valid birth and records no owner or initiator privilege', () => {
    const world = born(standardBirth());
    expect(world.worldId).toBe('shared-world-1');
    expect(world.worldType).toBe('SHARED_WORLD');
    expect(world.birthBasis).toBe('ACCEPTED_INVITATION');
    expect(world.state).toEqual({ lifecycle: 'ACTIVE', phase: 'STANDARD' });
    expect(world.membershipAtBirth).toEqual([MOHAMED, HADIR]);
    expect(Object.keys(world).sort()).toEqual(['architectureClass', 'birthBasis', 'membershipAtBirth', 'state', 'worldId', 'worldType']);
  });

  it('lets an accepted ordinary invitation produce only a STANDARD birth of the inviter and the exact target', () => {
    expect(rejectionOf({ ...standardBirth(), phase: 'INTRODUCTION' })).toBe('PHASE_BASIS_MISMATCH');
    expect(rejectionOf({ ...standardBirth(), participantsAtBirth: [MOHAMED] })).toBe('TOO_FEW_PARTICIPANTS');
    // A third human is not born into a direct World (CW2-03 §6); joining later is add-member governance.
    expect(rejectionOf({ ...standardBirth(), participantsAtBirth: [MOHAMED, HADIR, OMAR] })).toBe('PARTICIPANTS_NOT_INVITER_AND_TARGET');
    expect(rejectionOf({ ...standardBirth(), participantsAtBirth: [MOHAMED, OMAR] })).toBe('PARTICIPANTS_NOT_INVITER_AND_TARGET');
    expect(born(standardBirth()).membershipAtBirth).toHaveLength(2);
  });

  it('is born only after the acceptance authority event of the exact target', () => {
    const base = standardBirth();
    expect(rejectionOf({ ...base, event: { basis: 'ACCEPTED_INVITATION', invitation: invitation(MOHAMED, HADIR), acceptance: undefined as never } })).toBe('MISSING_ACCEPTANCE_AUTHORITY');
    expect(rejectionOf({ ...base, event: { basis: 'ACCEPTED_INVITATION', invitation: invitation(MOHAMED, HADIR), acceptance: accepted(OMAR) } })).toBe('ACCEPTOR_NOT_THE_TARGET');
    // The inviter cannot accept on the target's behalf.
    expect(rejectionOf({ ...base, event: { basis: 'ACCEPTED_INVITATION', invitation: invitation(MOHAMED, HADIR), acceptance: accepted(MOHAMED) } })).toBe('ACCEPTOR_NOT_THE_TARGET');
  });

  it('lets a Mutual Match produce only an INTRODUCTION birth with exactly the two matched humans', () => {
    const world = born(introductionBirth());
    expect(world.state).toEqual({ lifecycle: 'ACTIVE', phase: 'INTRODUCTION' });
    expect(world.birthBasis).toBe('MUTUAL_MATCH');
    expect(rejectionOf({ ...introductionBirth(), phase: 'STANDARD' })).toBe('PHASE_BASIS_MISMATCH');
    expect(rejectionOf({ ...introductionBirth(), participantsAtBirth: [MOHAMED, HADIR, OMAR] })).toBe('INTRODUCTION_REQUIRES_EXACT_PAIR');
    expect(rejectionOf({ ...introductionBirth(), participantsAtBirth: [MOHAMED, OMAR] })).toBe('PARTICIPANTS_NOT_THE_MATCHED_PAIR');
    // One acceptance is a pending proposal, not a Mutual Match - no World.
    expect(rejectionOf({
      ...introductionBirth(),
      event: { basis: 'MUTUAL_MATCH', mutualMatch: { kind: 'MUTUAL_MATCH', proposal: proposal(MOHAMED, HADIR), acceptedBy: [MOHAMED, MOHAMED] } },
    })).toBe('PROPOSAL_NOT_MUTUAL');
    expect(rejectionOf({
      ...introductionBirth(),
      event: { basis: 'MUTUAL_MATCH', mutualMatch: { kind: 'MUTUAL_MATCH', proposal: proposal(MOHAMED, HADIR), acceptedBy: [MOHAMED, OMAR] } },
    })).toBe('PROPOSAL_NOT_MUTUAL');
  });

  it('fails every other combination closed', () => {
    expect(rejectionOf({ ...standardBirth(), worldId: '   ' })).toBe('BLANK_WORLD_ID');
    expect(rejectionOf({ ...standardBirth(), phase: 'DORMANT' as never })).toBe('UNKNOWN_PHASE');
    expect(rejectionOf({ ...standardBirth(), event: { basis: 'PENDING_PROPOSAL' } as never })).toBe('UNKNOWN_BIRTH_BASIS');
    expect(rejectionOf({ ...standardBirth(), participantsAtBirth: [MOHAMED, MOHAMED] })).toBe('DUPLICATE_PARTICIPANT');
  });
});

describe('Connected Worlds kernel - Shared lifecycle and phase (task §9)', () => {
  it('accepts exactly the four legal lifecycle / phase combinations and rejects everything else', () => {
    expect(SHARED_WORLD_LEGAL_STATES).toHaveLength(4);
    for (const state of SHARED_WORLD_LEGAL_STATES) expect(isLegalSharedWorldState(state)).toBe(true);
    expect(isLegalSharedWorldState({ lifecycle: 'DORMANT', phase: 'STANDARD' })).toBe(false);
    expect(isLegalSharedWorldState({ lifecycle: 'ACTIVE', phase: 'PUBLIC' })).toBe(false);
    expect(isLegalSharedWorldState({ lifecycle: 'ACTIVE' })).toBe(false);
    expect(isLegalSharedWorldState(null)).toBe(false);
  });

  it('makes ADD_MEMBER unavailable in INTRODUCTION phase and in a closed World, and freezes Introduction membership to the matched pair', () => {
    expect(memberOperationAvailability({ lifecycle: 'ACTIVE', phase: 'INTRODUCTION' }, 'ADD_MEMBER')).toBe('UNAVAILABLE_INTRODUCTION_PAIR_FREEZE');
    expect(memberOperationAvailability({ lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' }, 'ADD_MEMBER')).toBe('UNAVAILABLE_READ_ONLY_CLOSED');
    expect(memberOperationAvailability({ lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' }, 'ADD_MEMBER')).toBe('UNAVAILABLE_READ_ONLY_CLOSED');
    expect(memberOperationAvailability({ lifecycle: 'ACTIVE', phase: 'STANDARD' }, 'ADD_MEMBER')).toBe('NOT_STRUCTURALLY_EXCLUDED');
    const introduction = born(introductionBirth());
    expect(isIntroductionPairIntact(introduction, [HADIR, MOHAMED])).toBe(true);
    expect(isIntroductionPairIntact(introduction, [MOHAMED, HADIR, OMAR])).toBe(false);
    expect(isIntroductionPairIntact(introduction, [MOHAMED, OMAR])).toBe(false);
    expect(isIntroductionPairIntact(introduction, [MOHAMED])).toBe(false);
    // The freeze is a property of the phase, not of Shared Worlds in general.
    expect(isIntroductionPairIntact(born(standardBirth()), [MOHAMED, HADIR, OMAR])).toBe(true);
  });
});

describe('Connected Worlds kernel - membership vs historical access (task §10)', () => {
  const worldId = born(standardBirth()).worldId;
  const episode = (member: HumanPrincipal, joinedAt: string, endedAt: string | null): MembershipEpisode =>
    ({ architectureClass: 'USER_STATE', kind: 'MEMBERSHIP_EPISODE', worldId, member, joinedAt, endedAt });

  it('represents join, end, rejoin as separate episodes and rejects ill-formed episode sets', () => {
    const first = episode(OMAR, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z');
    const rejoin = episode(OMAR, '2026-03-01T00:00:00Z', null);
    expect(validateMembershipEpisodes([first, rejoin, episode(HADIR, '2026-01-01T00:00:00Z', null)])).toEqual({ valid: true });
    expect(validateMembershipEpisodes([first, episode(OMAR, '2026-01-15T00:00:00Z', null)])).toEqual({ valid: false, rejection: 'OVERLAPPING_EPISODES' });
    expect(validateMembershipEpisodes([rejoin, episode(OMAR, '2026-04-01T00:00:00Z', null)])).toEqual({ valid: false, rejection: 'MULTIPLE_OPEN_EPISODES' });
    expect(validateMembershipEpisodes([episode(OMAR, '2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z')])).toEqual({ valid: false, rejection: 'ENDED_BEFORE_JOINED' });
    expect(validateMembershipEpisodes([episode(OMAR, 'yesterday', null)])).toEqual({ valid: false, rejection: 'UNPARSEABLE_TIMESTAMP' });
    expect(validateMembershipEpisodes([episode(QANDEEL_SYSTEM_ACTOR as unknown as HumanPrincipal, '2026-01-01T00:00:00Z', null)])).toEqual({ valid: false, rejection: 'NON_HUMAN_MEMBER' });
  });

  it('keeps a membership episode and a history-access grant distinct and never derives whole-history access from membership', () => {
    const current = episode(OMAR, '2026-03-01T00:00:00Z', null);
    expect(defaultHistoryAccessOnJoin(current)).toEqual({ scope: 'FROM_JOIN_FORWARD', fromInclusive: '2026-03-01T00:00:00Z' });
    const grant: HistoryAccessGrant = { architectureClass: 'USER_STATE', kind: 'HISTORY_ACCESS_GRANT', grantId: 'grant-1', worldId, grantee: OMAR };
    expect(grant.kind).not.toBe(current.kind);
    // @ts-expect-error a membership episode is not a history-access grant, whatever infrastructure they share.
    const episodeAsGrant: HistoryAccessGrant = current;
    expect(episodeAsGrant.kind).toBe('MEMBERSHIP_EPISODE');
  });
});

describe('Connected Worlds kernel - dependency and availability (task §11-§12)', () => {
  const myWorld = { architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED } as const;
  const shared = { architectureClass: 'WORLD', worldType: 'SHARED_WORLD', worldId: born(standardBirth()).worldId } as const;
  const target = { contextId: 'shared-session-1', world: shared } as const;
  const material: ProvenanceRecord = { kind: 'MATERIAL_DEPENDENCY', source: { materialId: 'm-1', originWorld: myWorld }, target };
  const reasoning: ProvenanceRecord = { kind: 'REASONING_DEPENDENCY', source: { contextId: 'my-context-1', originWorld: myWorld }, target };
  const independent: ProvenanceRecord = { kind: 'INDEPENDENT_TARGET_TRUTH', target };

  it('keeps exactly three dependency kinds and never treats a reasoning dependency as material', () => {
    expect([...DEPENDENCY_KINDS].sort()).toEqual(['INDEPENDENT_TARGET_TRUTH', 'MATERIAL_DEPENDENCY', 'REASONING_DEPENDENCY']);
    expect(isDependencyKind('REASONING_DEPENDENCY')).toBe(true);
    expect(isDependencyKind('TRANSITIVE_CONSENT')).toBe(false);
    expect(mayRequireSourceMaterialRights(material)).toBe(true);
    expect(mayRequireSourceMaterialRights(reasoning)).toBe(false);
    expect(mayRequireSourceMaterialRights(independent)).toBe(false);
  });

  it('keeps provenance identity while withholding deleted or unavailable content', () => {
    expect([...CONTENT_AVAILABILITIES].sort()).toEqual(['AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE']);
    expect(resolveSourceMaterialView(material, 'AVAILABLE')).toEqual({ dependencyIdentified: true, content: 'PRESENT', availability: 'AVAILABLE' });
    expect(resolveSourceMaterialView(material, 'DELETED_BY_OWNER')).toEqual({ dependencyIdentified: true, content: 'WITHHELD', availability: 'DELETED_BY_OWNER' });
    expect(resolveSourceMaterialView(reasoning, 'UNAVAILABLE')).toEqual({ dependencyIdentified: true, content: 'WITHHELD', availability: 'UNAVAILABLE' });
    // An unrecognised availability is not a way back to the content.
    expect(resolveSourceMaterialView(material, 'RESTORED' as never)).toEqual({ dependencyIdentified: true, content: 'WITHHELD', availability: 'UNAVAILABLE' });
  });
});

describe('Connected Worlds kernel - Context Admission (task §13)', () => {
  const sharedWorld = born(standardBirth());
  const otherWorld = born({ ...standardBirth(), worldId: 'shared-world-3' });
  const sharedAdmission: ContextAdmission = { scope: 'SHARED_EXACT_WORLD', owner: MOHAMED, targetWorldId: sharedWorld.worldId, purpose: 'SHARED_REASONING' };
  const matchingAdmission: ContextAdmission = { scope: 'MATCHING', owner: MOHAMED, purpose: 'MATCHING_CAPABILITY' };

  it('has no legal Public private-context admission', () => {
    expect([...CONTEXT_ADMISSION_SCOPES].sort()).toEqual(['MATCHING', 'SHARED_EXACT_WORLD']);
    expect(validateContextAdmission({ scope: 'PUBLIC_WORLD', owner: MOHAMED, purpose: 'PUBLIC_REASONING' })).toEqual({ valid: false, rejection: 'UNSUPPORTED_SCOPE' });
    expect(validateContextAdmission({ scope: 'PUBLIC_EXACT_EXPERIENCE', owner: MOHAMED })).toEqual({ valid: false, rejection: 'UNSUPPORTED_SCOPE' });
    // @ts-expect-error there is no Public World admission variant, and none is reserved for later.
    const publicAdmission: ContextAdmission = { scope: 'PUBLIC_WORLD', owner: MOHAMED, purpose: 'PUBLIC_REASONING' };
    expect(validateContextAdmission(publicAdmission).valid).toBe(false);
  });

  it('validates the two supported scopes and fails closed on a QANDEEL owner, a missing target or a foreign purpose', () => {
    expect(validateContextAdmission(sharedAdmission)).toEqual({ valid: true, admission: sharedAdmission });
    expect(validateContextAdmission(matchingAdmission)).toEqual({ valid: true, admission: matchingAdmission });
    expect(validateContextAdmission({ ...sharedAdmission, owner: QANDEEL_SYSTEM_ACTOR })).toEqual({ valid: false, rejection: 'NON_HUMAN_OWNER' });
    expect(validateContextAdmission({ scope: 'SHARED_EXACT_WORLD', owner: MOHAMED, purpose: 'SHARED_REASONING' })).toEqual({ valid: false, rejection: 'MISSING_TARGET_WORLD' });
    expect(validateContextAdmission({ ...sharedAdmission, purpose: 'MATCHING_CAPABILITY' })).toEqual({ valid: false, rejection: 'PURPOSE_SCOPE_MISMATCH' });
    expect(validateContextAdmission({ ...matchingAdmission, purpose: 'SHARED_REASONING' })).toEqual({ valid: false, rejection: 'PURPOSE_SCOPE_MISMATCH' });
  });

  it('scopes Shared admission to the exact target World and never to material disclosure', () => {
    expect(contextAdmissionAuthorizes(sharedAdmission, { question: 'REASONING_FOR_SHARED_WORLD', worldId: sharedWorld.worldId })).toBe(true);
    expect(contextAdmissionAuthorizes(sharedAdmission, { question: 'REASONING_FOR_SHARED_WORLD', worldId: otherWorld.worldId })).toBe(false);
    expect(contextAdmissionAuthorizes(sharedAdmission, { question: 'MATERIAL_DISCLOSURE' })).toBe(false);
    expect(contextAdmissionAuthorizes(sharedAdmission, { question: 'REASONING_FOR_MATCHING' })).toBe(false);
  });

  it('keeps Matching admission capability-scoped and non-transferable to the Shared World born from the match', () => {
    const introduction = born(introductionBirth());
    expect(contextAdmissionAuthorizes(matchingAdmission, { question: 'REASONING_FOR_MATCHING' })).toBe(true);
    expect(contextAdmissionAuthorizes(matchingAdmission, { question: 'REASONING_FOR_SHARED_WORLD', worldId: introduction.worldId })).toBe(false);
    expect(contextAdmissionAuthorizes(matchingAdmission, { question: 'MATERIAL_DISCLOSURE' })).toBe(false);
  });
});

describe('Connected Worlds kernel - audience expansion and Replay (task §14, §16)', () => {
  it('distinguishes audience-expanding operations from operations that are not expansion by themselves', () => {
    expect(classifyAudienceExpansion({ operation: 'PUBLISH_TO_PUBLIC_WORLD' })).toBe('AUDIENCE_EXPANSION');
    expect(classifyAudienceExpansion({ operation: 'DISTRIBUTE_REPLAY_EXTERNALLY' })).toBe('AUDIENCE_EXPANSION');
    expect(classifyAudienceExpansion({ operation: 'DISCLOSE_SOURCE_MATERIAL_TO_SHARED_AUDIENCE', audienceAlreadyPossessed: false })).toBe('AUDIENCE_EXPANSION');
    expect(classifyAudienceExpansion({ operation: 'DISCLOSE_SOURCE_MATERIAL_TO_SHARED_AUDIENCE', audienceAlreadyPossessed: true })).toBe('NO_AUDIENCE_EXPANSION');
    expect(classifyAudienceExpansion({ operation: 'CREATE_INTERNAL_REPLAY_DRAFT' })).toBe('NO_AUDIENCE_EXPANSION');
    expect(classifyAudienceExpansion({ operation: 'ADMIT_CONTEXT_FOR_REASONING' })).toBe('NO_AUDIENCE_EXPANSION');
    expect(classifyAudienceExpansion({ operation: 'INSPECT_OWN_MATERIAL' })).toBe('NO_AUDIENCE_EXPANSION');
    // Unknown operations fail closed as expansion.
    expect(classifyAudienceExpansion({ operation: 'FORWARD_TO_FAMILY' } as never)).toBe('AUDIENCE_EXPANSION');
  });

  it('gives a created Replay no distribution authority of its own', () => {
    const replay: ReplayArtifact = {
      architectureClass: 'MATERIAL_ARTIFACT',
      kind: 'REPLAY_ARTIFACT',
      replayId: 'replay-1',
      sourceWorlds: [{ architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: MOHAMED }],
      createdBy: MOHAMED,
    };
    expect(isWorldType(replay.kind)).toBe(false);
    expect('distributionAuthority' in replay).toBe(false);
    // @ts-expect-error a Replay artifact carries no distribution authority; distribution is a separate, audience-expanding operation.
    const distributable: ReplayArtifact = { ...replay, distributionAuthority: 'GRANTED' };
    expect(classifyAudienceExpansion({ operation: 'CREATE_INTERNAL_REPLAY_DRAFT' })).toBe('NO_AUDIENCE_EXPANSION');
    expect(classifyAudienceExpansion({ operation: 'DISTRIBUTE_REPLAY_EXTERNALLY' })).toBe('AUDIENCE_EXPANSION');
    expect(distributable.replayId).toBe('replay-1');
  });
});

describe('Connected Worlds kernel - domain closure (task §2-§4, §13)', () => {
  it('imports nothing outside the kernel directory and never reuses Human Intelligence cross-context types', () => {
    const files = readdirSync(__dirname).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));
    expect(files.sort()).toEqual(['authority.types.ts', 'material.types.ts', 'principal.types.ts', 'shared-world.types.ts', 'world-invariants.ts', 'world.types.ts']);
    for (const file of files) {
      const source = readFileSync(join(__dirname, file), 'utf8').replace(/\r\n/gu, '\n');
      const imports = [...source.matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]);
      // principal.types.ts is the root of the kernel and imports nothing; every other file imports a sibling.
      if (file !== 'principal.types.ts') expect(imports.length).toBeGreaterThan(0);
      // Sibling files only: no `../` reach into human-model, conversation, model-router or any
      // other Personal module, no package import, no Nest decorator, no `@qandeel/runtime`.
      for (const specifier of imports) expect(specifier).toMatch(/^\.\/[a-z-]+(\.types)?$/u);
      expect(source).not.toMatch(/\brequire\(/u);
      expect(source).not.toMatch(/^import\b[^;]*?\bfrom '(?!\.\/)/mu);
    }
  });
});
