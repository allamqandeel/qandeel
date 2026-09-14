/**
 * I-04C - Standard Voluntary Leave: the audience-staleness evidence.
 *
 * TEST-ONLY. This file adds no production code, changes no frozen production
 * code, wires no service and introduces no new authority vocabulary. It exists
 * to close one gap that a database verifier cannot close on its own.
 *
 * Migration 0083 changes the canonical membership topology. The frozen 0079
 * resolver then reports a different set of open membership episodes, and
 * database/verify-migration-0083.mjs proves exactly that transition in real
 * PostgreSQL: {A@e1, B@e2} -> {B@e2} -> EMPTY. What the verifier cannot prove,
 * because it is JavaScript talking to SQL rather than TypeScript, is that the
 * ALREADY-FROZEN delivery-authority layer turns that exact transition into a
 * refusal. That is what is proven here, using:
 *
 *   - `fingerprintSharedHumanAudience` (I-03D, frozen, unchanged), which hashes
 *     precisely the `(user, membership episode)` set the verifier observed;
 *   - `SharedDeliveryAuthorityRevalidatorService` (I-03F, frozen, unchanged).
 *
 * No new stale reason is invented: `AUDIENCE_CHANGED` and `NO_ACTIVE_HUMANS`
 * already express both post-leave states (CW2-02 §48, CW2-03 §48 / C42).
 */
import { fingerprintSharedHumanAudience } from '../audience/shared-human-audience-resolver.service';
import type { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { SharedHumanAudienceSnapshot } from '../authority/standing-context-authority.types';
import type { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import {
  fingerprintSharedEffectiveContext,
} from '../effective-context/shared-effective-context.service';
import type { SharedEffectiveContext } from '../effective-context/shared-effective-context.types';
import {
  fingerprintSharedPreModelWorldState,
} from '../effective-context/shared-pre-model-world-state-resolver.service';
import type { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from './shared-delivery-authority-revalidator.service';
import type { SharedPrivateSourceStateResolver } from './shared-private-source-state-resolver.types';

const WORLD_ID = '10000000-0000-4000-8000-00000000004c';
const WORLD = WORLD_ID as unknown as SharedWorldId;
const ALEF = '20000000-0000-4000-8000-00000000004a';
const BEH = '20000000-0000-4000-8000-00000000004b';
const EPISODE_A = '40000000-0000-4000-8000-00000000004a';
const EPISODE_B = '40000000-0000-4000-8000-00000000004b';
const OUTPUT = 'A Shared suggestion generated while both humans were still current members.';

const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });

/** Exactly what migration 0079 returns, shaped as the frozen resolver reports it. */
const resolvedAudience = (members: ReadonlyArray<[string, string]>): SharedHumanAudienceSnapshot => ({
  snapshotRef: fingerprintSharedHumanAudience({
    state: 'RESOLVED',
    worldId: WORLD_ID,
    members: members.map(([userId, membershipEpisodeId]) => ({ userId, membershipEpisodeId })),
  }),
  humans: members.map(([userId]) => human(userId)),
});

const EMPTY_AUDIENCE = { state: 'EMPTY', snapshotRef: fingerprintSharedHumanAudience({ state: 'EMPTY', worldId: WORLD_ID }) } as const;

/** The three canonical topologies of the verifier's leave sequence. */
const BEFORE_ANY_LEAVE = resolvedAudience([[ALEF, EPISODE_A], [BEH, EPISODE_B]]);
const AFTER_FIRST_LEAVE = resolvedAudience([[BEH, EPISODE_B]]);

const WORLD_STATE_REF = fingerprintSharedPreModelWorldState({ worldId: WORLD_ID, lifecycle: 'ACTIVE', phase: 'STANDARD' });

/**
 * A minimal but genuine EffectiveContext bound to the PRE-LEAVE audience, with
 * zero admitted private items - the frozen revalidator explicitly treats that as
 * legitimate, and it keeps this proof about membership topology alone.
 */
const preLeaveEnvelope = (audience: SharedHumanAudienceSnapshot): SharedEffectiveContext => ({
  effectiveContextRef: fingerprintSharedEffectiveContext({
    worldId: WORLD_ID,
    worldStateSnapshotRef: WORLD_STATE_REF,
    audienceSnapshotRef: audience.snapshotRef,
    items: [],
  }),
  targetWorldId: WORLD,
  worldStateSnapshotRef: WORLD_STATE_REF,
  audienceSnapshot: audience,
  privateReasoningContexts: [],
});

/** The frozen revalidator, driven by stubs that report exactly one canonical current state. */
function revalidatorSeeing(currentAudience: unknown): SharedDeliveryAuthorityRevalidatorService {
  const worldState = {
    async resolveCurrent() {
      // The World is deliberately still ACTIVE / STANDARD: voluntary leave never
      // closes it, so the refusal below must come from the membership topology.
      return { state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: WORLD_STATE_REF } };
    },
  } as unknown as SharedPreModelWorldStateResolverService;
  const audience = { async resolveCurrent() { return currentAudience; } } as unknown as SharedHumanAudienceResolverService;
  const grants = { async resolveCurrent() { throw new Error('no item is admitted, so no grant may be resolved'); } } as unknown as StandingContextGrantResolverService;
  const sources = { async resolveCurrent() { throw new Error('no item is admitted, so no source may be resolved'); } } as unknown as SharedPrivateSourceStateResolver;
  return new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, sources);
}

describe('I-04C: a pre-leave delivery authority cannot silently commit after a voluntary leave', () => {
  it('the frozen audience fingerprint distinguishes all three canonical topologies of a leave sequence', () => {
    // These are exactly the row sets database/verify-migration-0083.mjs observes
    // from the frozen 0079 resolver, before and after each leave.
    expect(BEFORE_ANY_LEAVE.snapshotRef).not.toBe(AFTER_FIRST_LEAVE.snapshotRef);
    expect(AFTER_FIRST_LEAVE.snapshotRef).not.toBe(EMPTY_AUDIENCE.snapshotRef);
    expect(BEFORE_ANY_LEAVE.snapshotRef).not.toBe(EMPTY_AUDIENCE.snapshotRef);
    // And the departure is what changed it: the same surviving human under the
    // same episode still fingerprints identically.
    expect(resolvedAudience([[BEH, EPISODE_B]]).snapshotRef).toBe(AFTER_FIRST_LEAVE.snapshotRef);
  });

  it('a generation authorized for both humans is STALE / AUDIENCE_CHANGED once one of them leaves', async () => {
    const envelope = preLeaveEnvelope(BEFORE_ANY_LEAVE);
    const service = revalidatorSeeing({ state: 'RESOLVED', snapshot: AFTER_FIRST_LEAVE });
    const revalidation = await service.revalidate(envelope, OUTPUT);
    expect(revalidation.state).toBe('STALE');
    expect(revalidation).toMatchObject({ state: 'STALE', reason: 'AUDIENCE_CHANGED' });
  });

  it('and STALE / NO_ACTIVE_HUMANS once the last human leaves, even though the World is still ACTIVE / STANDARD', async () => {
    const envelope = preLeaveEnvelope(AFTER_FIRST_LEAVE);
    const service = revalidatorSeeing(EMPTY_AUDIENCE);
    const revalidation = await service.revalidate(envelope, OUTPUT);
    expect(revalidation).toMatchObject({ state: 'STALE', reason: 'NO_ACTIVE_HUMANS' });
  });

  it('while an unchanged membership topology still revalidates as CURRENT, so the refusals above are not vacuous', async () => {
    const envelope = preLeaveEnvelope(BEFORE_ANY_LEAVE);
    const service = revalidatorSeeing({ state: 'RESOLVED', snapshot: BEFORE_ANY_LEAVE });
    const revalidation = await service.revalidate(envelope, OUTPUT);
    expect(revalidation.state).toBe('CURRENT');
  });

  it('a leave followed by a future rejoin is still a CHANGED audience, because episode identity changed', async () => {
    // I-04C does not implement rejoin. But the same human returning under a NEW
    // episode must not silently revive a pre-leave authorization (CW2-03 §28 /
    // C25: a rejoin is a new episode, and absence remains historically real).
    const rejoined = resolvedAudience([[ALEF, '40000000-0000-4000-8000-00000000004c'], [BEH, EPISODE_B]]);
    expect(rejoined.snapshotRef).not.toBe(BEFORE_ANY_LEAVE.snapshotRef);
    const service = revalidatorSeeing({ state: 'RESOLVED', snapshot: rejoined });
    const revalidation = await service.revalidate(preLeaveEnvelope(BEFORE_ANY_LEAVE), OUTPUT);
    expect(revalidation).toMatchObject({ state: 'STALE', reason: 'AUDIENCE_CHANGED' });
  });
});
