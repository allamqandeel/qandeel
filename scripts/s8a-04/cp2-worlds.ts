// S8A-04 CP2 — the synthetic people and Shared Worlds of the round-19 harness, made through the frozen commands as their
// owners (the fixtures of database/verify-migration-0175.mjs, committed instead of rolled back). Operator-only; never a CI
// step; never imported by production code. Everything here is test SETUP on the disposable database; what is under test
// runs through the production services and the in-process Data API.
import { createHash, randomUUID } from 'node:crypto';
import type { LocalDataApi } from './cp2-local-data-api';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** One owner transaction with `request.jwt.claims` naming `userId` (or none), as the verifier's `asOwner`. */
async function asOwner<T>(api: LocalDataApi, userId: string | null, work: (query: (text: string, values?: unknown[]) => Promise<Json[]>) => Promise<T>): Promise<T> {
  const client = await (api.owner as Json).connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
    const value = await work(async (text, values = []) => (await client.query(text, values)).rows);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export interface Person { readonly key: string; readonly name: string; readonly userId: string; readonly token: string }

export async function signUp(api: LocalDataApi, key: string, name: string): Promise<Person> {
  const userId = randomUUID();
  await asOwner(api, null, async (query) => {
    await query('INSERT INTO auth.users (id) VALUES ($1)', [userId]);
    await query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [userId, name, `cp2.${key.replace(/[^a-z0-9]/gu, '')}.${userId.slice(0, 8)}`]);
  });
  return Object.freeze({ key, name, userId, token: api.tokenFor(userId) });
}

/** The Shared conversation launch capability, switched on for the disposable database (the 0175 verifier's own fixture). */
export async function enableSharedConversation(api: LocalDataApi): Promise<void> {
  await asOwner(api, null, (query) => query('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
    ['SHARED_CONVERSATION', 'ENABLED', 'SATISFIED', 's8a-04-cp2-harness', 'synthetic qualification fixture']));
}

const sid = () => `sid1:${createHash('sha256').update(randomUUID(), 'utf8').digest('hex')}`;

/** A World born between `inviter` and `target` (the S4-01 direct invitation). */
export async function bornWorld(api: LocalDataApi, inviter: Person, target: Person): Promise<string> {
  const [state] = await asOwner(api, null, (query) => query('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [target.userId]));
  const ref = sid();
  await asOwner(api, target.userId, (query) => query('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), ref, state ? state.epoch : null]));
  const invitationId = randomUUID();
  await asOwner(api, inviter.userId, (query) => query('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), invitationId, ref]));
  const worldId = randomUUID();
  const [born] = await asOwner(api, target.userId, (query) => query('SELECT outcome FROM public.commit_shared_world_direct_acceptance_birth_v1($1, $2, $3, $4, $5)',
    [randomUUID(), invitationId, worldId, randomUUID(), randomUUID()]));
  if (born?.outcome !== 'BORN') throw new Error(`the World was not born: ${born?.outcome}`);
  return worldId;
}

/** `newcomer` joins through the S4-03 governed add-member path, approved by every current member. */
export async function addMember(api: LocalDataApi, worldId: string, newcomer: Person, current: ReadonlyArray<Person>): Promise<void> {
  const proposal = randomUUID();
  const [prepared] = await asOwner(api, null, (query) => query('SELECT outcome FROM public.prepare_shared_world_add_member_governance_v1($1, $2, $3, $4, $5)',
    [proposal, randomUUID(), randomUUID(), worldId, newcomer.userId]));
  if (prepared?.outcome !== 'PREPARED') throw new Error(`the addition was not prepared: ${prepared?.outcome}`);
  for (const human of current) {
    await asOwner(api, human.userId, (query) => query('SELECT outcome FROM public.commit_shared_world_governance_approval_v1($1, $2)', [randomUUID(), proposal]));
  }
  const invitation = randomUUID();
  await asOwner(api, null, (query) => query('SELECT outcome FROM public.dispatch_shared_world_member_invitation_v1($1, $2)', [invitation, proposal]));
  const [joined] = await asOwner(api, newcomer.userId, (query) => query('SELECT outcome FROM public.accept_shared_world_member_invitation_v1($1, $2, $3, $4)',
    [randomUUID(), invitation, randomUUID(), randomUUID()]));
  if (joined?.outcome !== 'JOINED') throw new Error(`the newcomer did not join: ${joined?.outcome}`);
}

/** A World of `people` (two born it; the rest joined in order). */
export async function worldOf(api: LocalDataApi, people: ReadonlyArray<Person>): Promise<string> {
  if (people.length < 2) throw new Error('a World needs two people');
  const worldId = await bornWorld(api, people[0], people[1]);
  for (let index = 2; index < people.length; index += 1) await addMember(api, worldId, people[index], people.slice(0, index));
  return worldId;
}

/**
 * DECLARED TEST SHORTCUT (amendment §11 stages R and 3): the saved positions' commit times are moved into the past, keeping
 * their order, so "since" spans months. Done as the database owner with triggers bypassed for this one statement; nothing
 * else about a position changes.
 */
export async function backdatePlaces(api: LocalDataApi, worldId: string, when: (index: number, total: number, committedAt: string) => Date): Promise<number> {
  return asOwner(api, null, async (query) => {
    const places = await query('SELECT material_id, committed_at::text AS committed_at FROM shared_semantic_private.semantic_places WHERE world_id = $1 ORDER BY committed_at, material_id', [worldId]);
    await query("SET LOCAL session_replication_role = 'replica'");
    for (const [index, place] of places.entries()) {
      await query('UPDATE shared_semantic_private.semantic_places SET committed_at = $2 WHERE material_id = $1', [place.material_id, when(index, places.length, place.committed_at).toISOString()]);
    }
    return places.length;
  });
}

/**
 * DECLARED TEST SHORTCUT (stage R seeding only): the World's semantic work-start budget (0148's rolling grant records) is
 * cleared before each seed pass, so hundreds of positions can be saved through the real pass in one run. The budget is a
 * rate limit, not what the stage tests; the lease, the reading, the write and every check stay the production ones.
 */
export async function clearPassBudget(api: LocalDataApi, worldId: string): Promise<void> {
  await asOwner(api, null, (query) => query('DELETE FROM shared_semantic_private.semantic_work_grants WHERE world_id = $1', [worldId]));
}

/** What the harness observes as the owner (never what a model receives): the World's saved positions with their attribution. */
export async function placesOf(api: LocalDataApi, worldId: string): Promise<Json[]> {
  return asOwner(api, null, (query) => query(`SELECT p.material_id AS place_id, b.body_text AS meaning, p.semantic_region AS region, p.world_x::text AS x, p.world_y::text AS y,
      p.committed_at, a.nature, a.absent_holder_label, a.hedged, a.standing,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('role', pp.person_role, 'user', pp.user_id) ORDER BY pp.person_role, pp.user_id), '[]'::jsonb)
         FROM shared_semantic_private.semantic_place_people pp WHERE pp.material_id = p.material_id) AS people,
      (SELECT r.earlier_material_id FROM shared_semantic_private.semantic_place_revisions r WHERE r.later_material_id = p.material_id) AS earlier_place_id
    FROM shared_semantic_private.semantic_places p
    JOIN shared_semantic_private.semantic_place_attributions a ON a.material_id = p.material_id
    JOIN public.shared_world_text_material_bodies b ON b.material_id = p.material_id
    WHERE p.world_id = $1 ORDER BY p.committed_at, p.material_id`, [worldId]));
}

/** The World's AI-COST-01 ledger rows, in the order they began (the Shared correlation, §5). */
export async function ledgerOf(api: LocalDataApi, worldId: string): Promise<Json[]> {
  return asOwner(api, null, (query) => query(`SELECT c.feature_family AS family, c.call_state AS state, c.usage_completeness AS completeness, c.attempt_number AS attempt,
      c.user_id AS payer, c.source_shared_material_id AS message, c.processing_path AS path,
      (SELECT json_object_agg(u.usage_kind, u.quantity::text) FROM public.ai_provider_call_usage u WHERE u.provider_call_id = c.id) AS usage
    FROM public.ai_provider_calls c WHERE c.source_world_id = $1 ORDER BY c.started_at, c.id`, [worldId]));
}
