// Shared support for the I-06A real-PostgreSQL verifiers (migrations 0100 and 0101).
//
// The Replay verifiers reach their subjects through the SAME fixture shape the
// Public World verifiers use - the frozen 0064 Personal source, the frozen I-04
// Shared source, the frozen I-05 Public Identity / Experience / package runtime -
// so they compose the Public support runtime rather than copying it, and add only
// what Replay needs: the relation and function names, the two human primitives,
// the read boundaries, and a teardown that lifts the Replay immutability guards
// inside ONE transaction and puts them back.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { createRuntime as createPublicRuntime } from './public-runtime-verifier-support.mjs';

// ------------------------------------------------------------------ relations
export const R = Object.freeze({
  REPLAYS: 'public.replays',
  MANIFESTS: 'public.replay_source_manifest_versions',
  MANIFEST_ITEMS: 'public.replay_source_manifest_items',
  SPECS: 'public.replay_selection_spec_versions',
  SPEC_ITEMS: 'public.replay_selection_spec_items',
  DRAFT_STATE: 'public.replay_draft_state',
  CREATE_COMMANDS: 'public.replay_create_commands',
  REVISION_COMMANDS: 'public.replay_draft_revision_commands',
});

/** Every append-only Replay relation with the trigger that guards it. */
export const REPLAY_IMMUTABLE = [
  [R.MANIFESTS, 'replay_source_manifest_versions_immutable'],
  [R.MANIFEST_ITEMS, 'replay_source_manifest_items_immutable'],
  [R.SPECS, 'replay_selection_spec_versions_immutable'],
  [R.SPEC_ITEMS, 'replay_selection_spec_items_immutable'],
];

// ------------------------------------------------------------------ functions
export const FN = Object.freeze({
  TOKEN: 'public.replay_selection_request_token_v1(uuid[], integer[], integer[])',
  CAPTURE: 'public.replay_capture_source_manifest_v1(uuid, uuid, integer, text, uuid, uuid, uuid[], timestamptz)',
  LOCK: 'public.replay_lock_source_manifest_v1(uuid)',
  CURRENCY: 'public.derive_replay_source_manifest_currency_v1(uuid)',
  SELECT: 'public.replay_resolve_selection_spec_v1(uuid, uuid, uuid, integer, uuid[], integer[], integer[], text, timestamptz)',
  CREATE: 'public.create_replay_draft_v1(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text)',
  REVISE: 'public.revise_replay_draft_v1(uuid, uuid, bigint, uuid, uuid, text, uuid, uuid, uuid[], uuid[], integer[], integer[], text)',
  COMPOSITION: 'public.resolve_replay_draft_composition_v1(uuid, uuid)',
  COMPONENT_TRIGGER: 'public.reject_replay_component_mutation_v1()',
  IDENTITY_TRIGGER: 'public.replay_identity_truth_v1()',
  FORWARD_TRIGGER: 'public.replay_draft_state_forward_only_v1()',
  CHRONOLOGY_TRIGGER: 'public.replay_selection_chronology_v1()',
  /** Proves an item's several source columns describe ONE canonical row. */
  ONE_ROW_TRIGGER: 'public.replay_source_manifest_item_one_row_v1()',
});

/** Result columns no Replay read boundary may ever declare: source identity is never a DTO. */
export const REPLAY_DISCLOSURE_BAN = /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|context_ref|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|staleness/u;

// ------------------------------------------------------------------- runtime
export function createReplayRuntime(databaseUrl) {
  const rt = createPublicRuntime(databaseUrl);
  const { q, rows } = rt;

  const whole = (items) => items.map(() => null);
  /**
   * create_replay_draft_v1 with named arguments. `selected` defaults to every
   * item, `starts` / `ends` default to whole items, `coverage` to SELECTED_EXCERPT.
   */
  const createDraft = (s) => {
    const selected = s.selected ?? s.items;
    return rows(
      'SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10::integer[], $11::integer[], $12)',
      [s.command, s.replay, s.manifest, s.selection, s.sourceClass, s.context, s.version ?? null,
        s.items, selected, s.starts ?? whole(selected), s.ends ?? whole(selected), s.coverage ?? 'SELECTED_EXCERPT']);
  };
  /** revise_replay_draft_v1 with named arguments; a null `manifest` keeps the current manifest. */
  const reviseDraft = (s) => {
    const selected = s.selected;
    return rows(
      'SELECT * FROM public.revise_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10::uuid[], $11::integer[], $12::integer[], $13)',
      [s.command, s.replay, s.expectedRevision, s.manifest ?? null, s.selection, s.sourceClass ?? null,
        s.context ?? null, s.version ?? null, s.items ?? null, selected,
        s.starts ?? whole(selected), s.ends ?? whole(selected), s.coverage ?? 'SELECTED_EXCERPT']);
  };
  const composition = (replay, user) =>
    rows('SELECT * FROM public.resolve_replay_draft_composition_v1($1, $2)', [replay, user]);
  const currency = (manifest) =>
    rows('SELECT * FROM public.derive_replay_source_manifest_currency_v1($1)', [manifest]);
  const selectionToken = (selected, starts, ends) =>
    rows('SELECT public.replay_selection_request_token_v1($1::uuid[], $2::integer[], $3::integer[]) token', [selected, starts, ends]);

  /** The whole immutable composition of one Replay, as rows, for before/after snapshots. */
  async function replaySnapshot(replay) {
    return {
      replay: await rows(`SELECT * FROM ${R.REPLAYS} WHERE id = $1`, [replay]),
      manifests: await rows(`SELECT * FROM ${R.MANIFESTS} WHERE replay_id = $1 ORDER BY manifest_revision`, [replay]),
      items: await rows(`SELECT i.* FROM ${R.MANIFEST_ITEMS} i JOIN ${R.MANIFESTS} m ON m.id = i.manifest_version_id
                          WHERE m.replay_id = $1 ORDER BY m.manifest_revision, i.source_item_ordinal`, [replay]),
      specs: await rows(`SELECT * FROM ${R.SPECS} WHERE replay_id = $1 ORDER BY selection_revision`, [replay]),
      specItems: await rows(`SELECT si.* FROM ${R.SPEC_ITEMS} si JOIN ${R.SPECS} sp ON sp.id = si.selection_spec_version_id
                              WHERE sp.replay_id = $1 ORDER BY sp.selection_revision, si.selected_ordinal`, [replay]),
    };
  }

  /**
   * Remove every committed Replay row of the given humans, lifting the four
   * append-only guards inside ONE transaction and proving them back. Runs BEFORE
   * the Public support removes the humans, because every Replay component binds
   * the source rows and the creator restrictively.
   */
  async function removeCommittedReplays(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of REPLAY_IMMUTABLE) await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      const replays = `SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])`;
      const manifests = `SELECT id FROM ${R.MANIFESTS} WHERE replay_id IN (${replays})`;
      await q(`DELETE FROM ${R.SPEC_ITEMS} WHERE source_manifest_version_id IN (${manifests})`, [humans]);
      await q(`DELETE FROM ${R.REVISION_COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${R.CREATE_COMMANDS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${R.DRAFT_STATE} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${R.SPECS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${R.MANIFEST_ITEMS} WHERE manifest_version_id IN (${manifests})`, [humans]);
      await q(`DELETE FROM ${R.MANIFESTS} WHERE replay_id IN (${replays})`, [humans]);
      await q(`DELETE FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])`, [humans]);
      for (const [table, trigger] of REPLAY_IMMUTABLE) await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    for (const [table, trigger] of REPLAY_IMMUTABLE) {
      assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled again after Replay teardown`);
    }
  }

  return { ...rt, R, FN, createDraft, reviseDraft, composition, currency, selectionToken, replaySnapshot, removeCommittedReplays };
}

export { runVerifier, APP_ROLES, NONE, SEAM, T } from './public-runtime-verifier-support.mjs';
