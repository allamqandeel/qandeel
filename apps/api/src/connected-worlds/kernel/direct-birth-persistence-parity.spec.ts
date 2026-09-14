// I-04B - Kernel / persistence parity for the direct accepted-invitation birth.
//
// Migration 0082 persists a Shared World birth in SQL. The frozen I-01A kernel
// decides, in TypeScript, what a valid birth IS. Those two must not be allowed
// to drift, and the honest way to show they have not is to run the frozen
// validator for the exact direct shape and compare its outcome with the literals
// the migration actually writes - read out of the migration file rather than
// re-declared here, so this proves parity instead of restating one constant
// twice.
//
// This file is TEST-ONLY. It adds no production service, provider, controller or
// route, it exports nothing, and it changes no frozen kernel semantics: there is
// deliberately no second birth validator in production TypeScript. The database
// primitive it compares against is not executable by any application role yet
// (the frozen system-policy / Launch Gate precondition is unimplemented), so
// nothing here is wired into the application either.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { attemptSharedWorldBirth } from './world-invariants';
import type { HumanPrincipal } from './principal.types';
import type { SharedWorldBirthRequest } from './shared-world.types';

const MIGRATION = join(__dirname, '../../../../../database/migrations/0082_shared_direct_world_birth_transaction_v1.sql');
const migration = readFileSync(MIGRATION, 'utf8').replace(/\r\n/gu, '\n');
/**
 * Executable SQL only.
 *
 * The migration's prose legitimately NAMES what it refuses - it states in so
 * many words that there is no GRANT statement in it - so a ban scanned over the
 * raw file would fail on the very sentence documenting the guarantee.
 */
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

/** The exact tuple migration 0082 inserts into public.shared_worlds. */
const persistedBirth = (): { lifecycle: string; phase: string; birthBasis: string; closedAt: string } => {
  const match = migration.match(
    /INSERT INTO public\.shared_worlds \(id, lifecycle, phase, birth_basis, born_at, closed_at\)\s*\n\s*VALUES \(p_world_id, '([A-Z_]+)', '([A-Z_]+)', '([A-Z_]+)', birth_at, (NULL)\);/u,
  );
  if (!match) throw new Error('migration 0082 no longer inserts a single recognisable direct birth tuple');
  return { lifecycle: match[1], phase: match[2], birthBasis: match[3], closedAt: match[4] };
};

const inviter: HumanPrincipal = { kind: 'HUMAN', humanId: 'human-inviter' };
const target: HumanPrincipal = { kind: 'HUMAN', humanId: 'human-target' };
const outsider: HumanPrincipal = { kind: 'HUMAN', humanId: 'human-outsider' };

/**
 * The frozen direct path exactly as CW2-03 section 6 describes it: one ordinary
 * Shared invitation between two humans, accepted by the exact target.
 */
const directBirthRequest = (overrides: Partial<SharedWorldBirthRequest> = {}): SharedWorldBirthRequest => ({
  worldId: 'world-under-test',
  phase: 'STANDARD',
  participantsAtBirth: [inviter, target],
  event: {
    basis: 'ACCEPTED_INVITATION',
    invitation: { prospective: 'SHARED_INVITATION', inviter, target },
    acceptance: { kind: 'INVITATION_ACCEPTANCE', acceptedBy: target },
  },
  ...overrides,
});

describe('I-04B direct birth: kernel and migration 0082 agree', () => {
  it('the frozen kernel accepts the direct shape and yields exactly the persisted constants', () => {
    const outcome = attemptSharedWorldBirth(directBirthRequest());
    expect(outcome.born).toBe(true);
    if (!outcome.born) throw new Error('unreachable');

    const persisted = persistedBirth();
    expect(outcome.world.worldType).toBe('SHARED_WORLD');
    expect(outcome.world.architectureClass).toBe('WORLD');
    // THE parity assertions: each side read from its own authority.
    expect(outcome.world.state.lifecycle).toBe(persisted.lifecycle);
    expect(outcome.world.state.phase).toBe(persisted.phase);
    expect(outcome.world.birthBasis).toBe(persisted.birthBasis);
    // A born World carries no closure moment on either side.
    expect(persisted.closedAt).toBe('NULL');
    // And the values themselves are the frozen ones, so parity cannot be
    // satisfied by both sides drifting together.
    expect(persisted).toEqual({ lifecycle: 'ACTIVE', phase: 'STANDARD', birthBasis: 'ACCEPTED_INVITATION', closedAt: 'NULL' });
  });

  it('membership at birth is exactly the inviter and the exact accepting target, as the migration persists', () => {
    const outcome = attemptSharedWorldBirth(directBirthRequest());
    if (!outcome.born) throw new Error('the direct shape must be born');
    expect(outcome.world.membershipAtBirth.map((human) => human.humanId).sort()).toEqual([inviter.humanId, target.humanId].sort());
    expect(outcome.world.membershipAtBirth).toHaveLength(2);
    // The migration writes exactly two episode tuples, from the two user ids on
    // the persisted invitation - never from a parameter and never a third human.
    const episodes = migration.match(
      /INSERT INTO public\.shared_world_membership_episodes \(id, world_id, user_id, joined_at, ended_at\)\s*\n\s*VALUES ([^;]+);/u,
    );
    expect(episodes).not.toBeNull();
    expect((episodes as RegExpMatchArray)[1].match(/invitation\.\w+_user_id/gu)).toEqual(['invitation.inviter_user_id', 'invitation.target_user_id']);
    expect((episodes as RegExpMatchArray)[1].match(/birth_at, NULL\)/gu)).toHaveLength(2);
  });

  it('the kernel refuses exactly what the migration refuses', () => {
    // The acceptor must BE the target. The migration enforces the same rule with
    // `invitation.target_user_id <> u`.
    const wrongAcceptor = attemptSharedWorldBirth(directBirthRequest({
      event: {
        basis: 'ACCEPTED_INVITATION',
        invitation: { prospective: 'SHARED_INVITATION', inviter, target },
        acceptance: { kind: 'INVITATION_ACCEPTANCE', acceptedBy: inviter },
      },
    }));
    expect(wrongAcceptor).toEqual({ born: false, rejection: 'ACCEPTOR_NOT_THE_TARGET' });
    expect(migration).toContain('IF invitation.target_user_id <> u');

    // Birth membership is exactly the two humans who acted; a third human at
    // birth is not a direct birth. The migration writes exactly two tuples.
    const thirdHuman = attemptSharedWorldBirth(directBirthRequest({ participantsAtBirth: [inviter, target, outsider] }));
    expect(thirdHuman).toEqual({ born: false, rejection: 'PARTICIPANTS_NOT_INVITER_AND_TARGET' });

    // A direct birth is STANDARD. The migration can persist no other phase for
    // ACCEPTED_INVITATION, and migration 0075's own CHECK refuses it too.
    const wrongPhase = attemptSharedWorldBirth(directBirthRequest({ phase: 'INTRODUCTION' }));
    expect(wrongPhase).toEqual({ born: false, rejection: 'PHASE_BASIS_MISMATCH' });
  });

  it('the migration creates no second birth law in production TypeScript', () => {
    // I-04B adds no production validator: the kernel remains the only place
    // where a Shared World birth is decided in TypeScript.
    const kernel = readFileSync(join(__dirname, 'world-invariants.ts'), 'utf8');
    expect(kernel).toContain('export function attemptSharedWorldBirth');
    expect(readFileSync(join(__dirname, 'shared-world.types.ts'), 'utf8')).toContain("export const SHARED_WORLD_BIRTH_BASES = ['ACCEPTED_INVITATION', 'MUTUAL_MATCH'] as const;");
    // And the birth core stays non-application-executable until the launch gate
    // exists, so nothing in the application can reach it yet.
    expect(executableSql).toContain('REVOKE ALL ON FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;');
    expect(executableSql).not.toMatch(/\bGRANT\b/u);
  });
});
