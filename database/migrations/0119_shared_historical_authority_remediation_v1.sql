-- QAN-CW-REM-01 - Shared historical authority resolution v1.
--
-- ===========================================================================
-- Why this migration exists
-- ===========================================================================
--
-- The Connected Worlds phase-wide architecture assurance accepted ASSURE-F02:
-- the canonical QANDEEL Shared material producer recorded a POSITIVELY RESOLVED
-- EMPTY human requirement for material it had merely found no evidence about.
--
-- Its authority resolution ended in
--
--   ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT'
--
-- so a QANDEEL_OUTPUT or QANDEEL_ANALYSIS committed with no MATERIAL_DEPENDENCY
-- and no REASONING_DEPENDENCY was durably recorded as proven approval-free, and
-- its history item was written NO_HUMAN_APPROVAL_REQUIRED. Both downstream
-- widening paths then accepted it: the frozen I-04F history package admits a
-- zero-approver manifest precisely when every item says approval-free, and the
-- frozen I-05A publication authority admits a zero-approver package.
--
-- That is the exact fail-open shape the frozen architecture forbids, stated in
-- this repository four times and most sharply by migration 0092 itself: "we
-- cannot compute the requirement" and "we computed it and there is none" stay
-- different facts, and the second is written ONLY when the source state proves
-- it. Here nothing proved it. The absence of a caller-supplied dependency array
-- was being read as proof about protected humans.
--
-- It bites hardest in ACTIVE / INTRODUCTION, which is the phase whose whole
-- purpose is QANDEEL speaking ABOUT BOTH MATCHED HUMANS - welcoming the pair,
-- surfacing safe differences and agreements - while the dependency vocabulary
-- has no representable edge for the Match handoff those observations come from.
-- INDEPENDENT_TARGET_TRUTH is the only encoding available, and it was exactly
-- the one that produced zero approvers. Either human could then have widened an
-- analysis about both of them to a later third Shared member or to the whole
-- Public World, with the other never consulted and holding no control surface
-- over the material at all.
--
-- ===========================================================================
-- What this migration decides, and what it deliberately does not
-- ===========================================================================
--
-- INDEPENDENT_TARGET_TRUTH REMAINS PROVENANCE AND IS STILL WRITTEN. It says
-- exactly what it always said: this target reproduces no MATERIAL_DEPENDENCY
-- source and carries no REASONING_DEPENDENCY source reference. That is true, it
-- is worth recording, and it is NOT a protected-human subject clearance. The
-- three dependency kinds keep their exact separate meanings.
--
-- NO APPROVER IS INVENTED. The counterpart of an Introduction is not turned
-- into an approver, a reasoning grantor is still never turned into an approver,
-- World membership is still not an authority, and no caller may supply one.
-- This migration resolves no protected-human subject authority, because no
-- reviewed server-owned source in this repository can.
--
-- WHAT CHANGES IS ONE ARM OF ONE CASE. A QANDEEL commit that reaches the end of
-- the authority resolution with no enumerable required human now records
-- UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT - the state this repository already
-- uses for exactly this fact, on exactly this rationale, for the
-- reasoning-bearing case. Unknown is recorded as unknown.
--
-- ORDINARY PARTICIPATION IS UNTOUCHED, and this is a requirement rather than a
-- side effect. The material still commits. Its exact baseline audience still
-- sees it, through the same resolver, in both frozen World modes. A Standard
-- World still works, an Introduction still works, and QANDEEL can still speak.
-- What fails closed is a LATER AUDIENCE WIDENING of material whose protected
-- human requirement was never established.
--
-- ===========================================================================
-- The four surfaces, and why each one is necessary
-- ===========================================================================
--
--   THE PRODUCER (section 3) stops writing the unproven state. Future material
--   is correct at the instant it is committed.
--
--   THE RECONCILIATION (section 2) moves material ALREADY committed under the
--   old arm forward onto the authority-resolution relation that exists for
--   exactly that purpose. Without it the fix would protect nothing already
--   written, and the promised additive forward path - a later reviewed resolver
--   moving rows to RESOLVED - would silently skip every one of them. No source
--   body, provenance identity, material identity, history identity, instant,
--   baseline viewer, approver row or dependency edge is rewritten, and the
--   frozen authority_requirement_mode immutability trigger is neither disabled
--   nor bypassed: a reconciled item keeps the mode it was committed under and
--   is refused by current state rather than by a rewritten past.
--
--   THE GRANT BOUNDARY (section 4) re-asks the question at the instant the
--   widening actually happens. The frozen preparation-time trigger cannot cover
--   a manifest that was prepared BEFORE the reconciliation, and a manifest is
--   immutable, so the consequential commit is the only place left that can.
--
--   EFFECTIVE VISIBILITY (sections 5 and 6) stops an ALREADY COMMITTED grant
--   from continuing to widen. The grant row itself is durable historical
--   evidence and is never deleted; what it no longer does is carry material
--   whose authority is currently unresolved. Baseline visibility is preserved
--   exactly, in the ACTIVE branch and in the closed snapshot alike.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- It edits no historical migration: 0075-0118 are byte-identical. It creates no
-- table, no column, no index, no policy and no trigger. It adds no actor,
-- approver, viewer or authority parameter to any signature. It grants EXECUTE
-- to no application role and widens no privilege of any kind. It deletes
-- nothing. It writes no Public lifecycle transition and invents no Public
-- recall, withdrawal or deletion policy - the frozen rule that source
-- unavailability alone creates no retroactive removal is untouched, and this is
-- a different subject: authority invalidity. It changes no Public, Replay,
-- Matching or governance semantics, and it fixes no other assurance finding.
--
-- The Public downstream needs no change at all, which is the strongest evidence
-- that the correction belongs where it has been put: migration 0093's
-- preparation and the 0105 replacement of the publication-authority derivation
-- BOTH already require a Shared source to be in one of the two RESOLVED states
-- and both already raise PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED
-- otherwise, and the I-05C continuing-eligibility derivation already turns that
-- raise into an INELIGIBLE answer. Correcting the source state is therefore the
-- whole of the Public fix, by composition of frozen derivations.
--
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE FORWARD RECONCILIATION OF ALREADY-COMMITTED AUTHORITY STATE.
--
--    `shared_world_material_historical_authority` is the relation migration
--    0090 created for exactly this: "the representation is additive on purpose,
--    a later reviewed subject-authority resolver transitions a row forward
--    without rewriting any source history". This is that transition, in the
--    fail-closed direction.
--
--    IT MOVES IN EXACTLY ONE DIRECTION. A row may only become
--    UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT. Nothing can ever be moved the
--    permissive way by this function, so re-running it can only ever be a no-op
--    and it cannot be made into a clearance tool by any future caller.
--
--    IT MOVES TWO SHAPES, AND THE SECOND IS ONLY VISIBLE ONCE THE FIRST IS.
--
--    The first is the defect written directly: a row holding
--    RESOLVED_NO_HUMAN_REQUIREMENT. Exactly one writer in this repository can
--    produce that value - the ELSE arm section 3 corrects. The human commit core
--    writes the exact author and the one progressive-disclosure producer writes
--    the exact owner; both write RESOLVED_EXACT_HUMAN_REQUIREMENT
--    unconditionally. So the set of rows holding the unproven clearance IS the
--    set of rows the defect wrote, and the producer-kind condition below states
--    that structurally rather than trusting it.
--
--    The second is the SAME defect written one edge later (REM01-AUTH-01): a row
--    holding RESOLVED_EXACT_HUMAN_REQUIREMENT while depending, directly or
--    transitively, on a source that is not itself positively resolved. The old
--    producer classified a target from its known approver COUNT alone, so a
--    target of an unresolved source inherited the known half and silently
--    dropped the unknown half. Reconciling only the first shape would repair the
--    ancestors and leave every laundering descendant exactly as it was - and a
--    descendant is as widenable as an ancestor.
--
--    WHAT IT DOES NOT TOUCH. It writes one column of one relation. No source
--    body, provenance row, material row, history item, occurrence instant,
--    availability state or revision, baseline viewer, required approver,
--    manifest, approval, grant or command is read for writing or changed, and
--    `shared_world_history_items.authority_requirement_mode` in particular is
--    left exactly as committed. A reconciled item therefore keeps the mode its
--    original commit really used, and is refused by CURRENT authority state
--    rather than by a past rewritten to look like the new rule. That pairing -
--    an unresolved resolution over a mode written as approval-free - is
--    truthful about what happened and is precisely what the frozen consumers
--    need, because every widening boundary that matters keys on the resolution
--    state, not on the mode.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reconcile_shared_world_material_historical_authority_v1()
RETURNS TABLE(reconciled_material_count integer, remaining_unproven_count integer,
              remaining_laundered_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  moved integer;
  remaining integer;
  laundered integer;
BEGIN
  -- THE TAINTED CLOSURE, TO A FIXED POINT.
  --
  -- Two different rows need moving, and the second is only visible once the
  -- first is understood. A row holding the unproven clearance is the defect
  -- written directly. A row holding RESOLVED_EXACT_HUMAN_REQUIREMENT while
  -- depending, directly or transitively, on a source that is NOT positively
  -- resolved is the SAME defect written one edge later: the old producer
  -- classified a target from its known approver COUNT alone, so a target of an
  -- unresolved source inherited the known half and silently dropped the unknown
  -- half. Reconciling only the first would leave every descendant laundered.
  --
  -- The seed is every material that does not positively record
  -- RESOLVED_EXACT_HUMAN_REQUIREMENT - unresolved, unproven-empty, or carrying no
  -- authority row at all - and the closure follows MATERIAL_DEPENDENCY edges
  -- FORWARD. Migration 0089's strict source-precedes-target CHECK makes that
  -- graph acyclic, so the recursion terminates and one traversal really is the
  -- fixed point rather than one round of an iteration nobody finished.
  WITH RECURSIVE tainted(material_id) AS (
    SELECT m.id
      FROM public.shared_world_materials m
     WHERE NOT EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority a
                        WHERE a.material_id = m.id
                          AND a.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT')
    UNION
    SELECT d.target_material_id
      FROM public.shared_world_material_dependencies d
      JOIN tainted t ON t.material_id = d.source_material_id
     WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'
  )
  UPDATE public.shared_world_material_historical_authority a
     SET resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
   WHERE a.resolution_state <> 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
     AND a.material_id IN (SELECT t.material_id FROM tainted t)
     AND EXISTS (SELECT 1 FROM public.shared_world_materials m
                  WHERE m.id = a.material_id AND m.world_id = a.world_id
                    AND m.producer_kind = 'QANDEEL');
  GET DIAGNOSTICS moved = ROW_COUNT;

  -- BOTH ANSWERS ARE READ BACK FROM COMMITTED TRUTH, never reported from the
  -- statement's own intent, and they are counted separately because they mean
  -- different things: a row still holding the unproven clearance, and a row
  -- still claiming an exact resolution its own ancestry does not support.
  SELECT count(*)::integer INTO remaining
    FROM public.shared_world_material_historical_authority a
   WHERE a.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT';

  SELECT count(*)::integer INTO laundered
    FROM public.shared_world_material_historical_authority a
    JOIN public.shared_world_materials m ON m.id = a.material_id
   WHERE a.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
     AND m.producer_kind = 'QANDEEL'
     AND EXISTS (
       SELECT 1 FROM public.shared_world_material_dependencies d
        WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'
          AND d.target_material_id = a.material_id
          AND NOT EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority sa
                           WHERE sa.material_id = d.source_material_id
                             AND sa.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'));

  RETURN QUERY SELECT moved, remaining, laundered;
END$$;

ALTER FUNCTION public.reconcile_shared_world_material_historical_authority_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reconcile_shared_world_material_historical_authority_v1()
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reconcile_shared_world_material_historical_authority_v1() FROM service_role';
END IF;END$$;

COMMENT ON FUNCTION public.reconcile_shared_world_material_historical_authority_v1() IS
  'QAN-CW-REM-01. Moves Shared QANDEEL material historical authority forward from '
  'RESOLVED_NO_HUMAN_REQUIREMENT - a clearance no reviewed source in this repository '
  'can positively establish - to UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT. Fail-closed '
  'direction only, idempotent, and it rewrites no source history: bodies, provenance, '
  'instants, baseline viewers, required approvers and the frozen '
  'authority_requirement_mode are all left exactly as committed.';

-- ---------------------------------------------------------------------------
-- 2. THE RECONCILIATION RUNS ONCE, HERE, AND THE MIGRATION REFUSES IF IT LEAVES
--    ANYTHING BEHIND.
--
--    A deploy that silently left unproven clearances in place would be the
--    defect surviving its own fix, so the count is proven rather than trusted.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  moved integer;
  remaining integer;
  laundered integer;
BEGIN
  SELECT r.reconciled_material_count, r.remaining_unproven_count, r.remaining_laundered_count
    INTO moved, remaining, laundered
    FROM public.reconcile_shared_world_material_historical_authority_v1() r;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: % historical-authority row(s) still record a resolved-empty human requirement after reconciliation', remaining;
  END IF;
  -- THE FIXED POINT IS WITNESSED, not assumed. If no material still claims an
  -- exact resolution while naming a source that is not itself exactly resolved,
  -- then by induction over an acyclic graph no transitively laundered row
  -- survives either - so this ONE-EDGE residue is the whole fixed-point proof.
  IF laundered <> 0 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: % historical-authority row(s) still claim an exact resolution their own MATERIAL_DEPENDENCY ancestry does not support', laundered;
  END IF;
  RAISE NOTICE 'QAN-CW-REM-01: reconciled % Shared QANDEEL historical-authority row(s) to UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT', moved;
END$$;


-- ---------------------------------------------------------------------------
-- 3. THE CANONICAL QANDEEL COMMIT CORE, FORWARD-REPLACED.
--
--    This is migration 0118's function, reproduced from its own text with ONE
--    arm of ONE CASE changed and its comment extended. Signature, result shape,
--    request identity, evidence envelope, audience derivation, Introduction
--    support, lock order, idempotency paths, dependency persistence and ACL
--    posture are all byte-identical to 0118, which is why this file can be
--    diffed against it rather than re-reviewed from scratch.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_shared_world_qandeel_material_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
  p_material_kind text, p_body_text text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_reasoning_source_refs text[]
) RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                committed_history_item_id uuid, committed_material_kind text,
                audience_size integer, authority_size integer,
                material_dependency_edges integer, reasoning_dependency_edges integer,
                material_established_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_material_commit_commands;
  world public.shared_worlds;
  digest text;
  request text;
  recomputed_readiness text;
  current_audience_ref text;
  audience uuid[];
  sources uuid[];
  reasoning text[];
  viewers integer;
  approvers integer;
  unresolved_sources integer;
  material_edges integer;
  reasoning_edges integer;
  affected integer;
  authority_mode text;
  authority_resolution text;
  db_material_edges integer;
  db_reasoning_edges integer;
  commit_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_material_id IS NULL OR p_history_item_id IS NULL
     OR p_material_kind IS NULL OR p_body_text IS NULL OR length(btrim(p_body_text)) = 0 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_material_kind NOT IN ('QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS') THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_effective_context_ref IS NULL OR p_output_digest IS NULL OR p_source_disclosure_gate_ref IS NULL
     OR p_authority_revalidation_ref IS NULL OR p_readiness_ref IS NULL OR p_audience_snapshot_ref IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_EVIDENCE_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE EVIDENCE BINDS THESE EXACT BYTES. The supplied output digest must be the
  -- digest of the exact body being committed, computed with the same convention
  -- the frozen I-03F digestProviderOutput uses, so evidence produced for another
  -- output cannot be presented for this one.
  digest := 'sha256:' || encode(sha256(convert_to(p_body_text, 'UTF8')), 'hex');
  IF p_output_digest <> digest THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_EVIDENCE_INVALID' USING ERRCODE='22023';
  END IF;
  -- AND THE READINESS REFERENCE IS RECOMPUTED, not trusted: it must be exactly
  -- the I-03G readiness fingerprint over its own four parts. A readiness
  -- reference that does not derive from the gate and revalidation it claims is
  -- not evidence of anything.
  recomputed_readiness := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1' || E'\n'
      || 'effectiveContext=' || p_effective_context_ref || E'\n'
      || 'output=' || p_output_digest || E'\n'
      || 'sourceDisclosureGate=' || p_source_disclosure_gate_ref || E'\n'
      || 'authorityRevalidation=' || p_authority_revalidation_ref, 'UTF8')), 'hex');
  IF p_readiness_ref <> recomputed_readiness THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_EVIDENCE_INVALID' USING ERRCODE='22023';
  END IF;

  -- The two dependency selections are exact SETS. A repeated identity is refused
  -- rather than silently folded, and a NULL member is malformed.
  sources := coalesce(p_material_source_ids, ARRAY[]::uuid[]);
  reasoning := coalesce(p_reasoning_source_refs, ARRAY[]::text[]);
  IF array_position(sources, NULL::uuid) IS NOT NULL OR array_position(reasoning, NULL::text) IS NOT NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  material_edges := coalesce(array_length(sources, 1), 0);
  reasoning_edges := coalesce(array_length(reasoning, 1), 0);
  IF (SELECT count(DISTINCT s.item) FROM unnest(sources) AS s(item)) <> material_edges
     OR (SELECT count(DISTINCT r.item) FROM unnest(reasoning) AS r(item)) <> reasoning_edges THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_material_id = ANY(sources) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE DURABLE REQUEST IDENTITY. It binds EVERY immutable input of this exact
  -- request: the World, the material and history identities, the kind, the exact
  -- body, all five I-03 evidence references, the exact audience snapshot the
  -- output was generated for, and BOTH dependency sets in canonical order. Set
  -- ORDER therefore cannot change identity while set CONTENT always does, and a
  -- retry that alters any of them is a conflict rather than an equivalence.
  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_SHARED_MATERIAL_COMMIT_REQUEST_V1' || E'\n'
   || 'world=' || lower(p_world_id::text) || E'\n'
   || 'material=' || lower(p_material_id::text) || E'\n'
   || 'historyItem=' || lower(p_history_item_id::text) || E'\n'
   || 'kind=' || p_material_kind || E'\n'
   || 'producer=QANDEEL' || E'\n'
   || 'actor=NONE' || E'\n'
   || 'body=' || digest || E'\n'
   || 'audio=NONE' || E'\n'
   || 'transcript=NONE' || E'\n'
   || 'duration=NONE' || E'\n'
   || 'effectiveContext=' || p_effective_context_ref || E'\n'
   || 'outputDigest=' || p_output_digest || E'\n'
   || 'sourceDisclosureGate=' || p_source_disclosure_gate_ref || E'\n'
   || 'authorityRevalidation=' || p_authority_revalidation_ref || E'\n'
   || 'readiness=' || p_readiness_ref || E'\n'
   || 'audienceSnapshot=' || p_audience_snapshot_ref || E'\n'
   || 'materialSources=' || coalesce((SELECT string_agg(lower(s.item::text), ','
        ORDER BY lower(s.item::text) COLLATE "C") FROM unnest(sources) AS s(item)), '') || E'\n'
   || 'reasoningSources=' || coalesce((SELECT string_agg(r.item, ','
        ORDER BY r.item COLLATE "C") FROM unnest(reasoning) AS r(item)), ''),
      'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    -- EVERY immutable input must match, through the ONE durable request identity:
    -- body, every I-03 evidence reference, the exact audience snapshot and both
    -- exact dependency sets are all inside it.
    IF committed.actor_user_id IS NULL AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
       AND committed.producer_kind = 'QANDEEL' AND committed.request_ref = request THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_materials m
          JOIN public.shared_world_history_items i ON i.id = m.history_item_id
          JOIN public.shared_world_qandeel_material_evidence ev ON ev.material_id = m.id
         WHERE m.id = committed.material_id AND m.world_id = committed.world_id
           AND m.history_item_id = committed.history_item_id
           AND m.material_kind = committed.material_kind AND m.producer_kind = 'QANDEEL'
           AND m.author_user_id IS NULL AND m.established_at = committed.committed_at
           AND i.occurred_at = committed.committed_at AND i.registered_at = committed.committed_at
           AND ev.readiness_ref = p_readiness_ref AND ev.output_digest = digest
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      -- EVERY count in a retry answer comes from COMMITTED truth, never from the
      -- arrays this retry happened to pass in.
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_item_required_approvers ra
       WHERE ra.history_item_id = committed.history_item_id;
      SELECT count(*) FILTER (WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY')::integer,
             count(*) FILTER (WHERE d.dependency_kind = 'REASONING_DEPENDENCY')::integer
        INTO db_material_edges, db_reasoning_edges
        FROM public.shared_world_material_dependencies d
       WHERE d.target_material_id = committed.material_id;
      RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                          committed.history_item_id, committed.material_kind,
                          committed.baseline_viewer_count, approvers, db_material_edges, db_reasoning_edges,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, THE WORLD ROW FIRST.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock.
  SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    -- EVERY immutable input must match, through the ONE durable request identity:
    -- body, every I-03 evidence reference, the exact audience snapshot and both
    -- exact dependency sets are all inside it.
    IF committed.actor_user_id IS NULL AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
       AND committed.producer_kind = 'QANDEEL' AND committed.request_ref = request THEN
      -- EVERY count in a retry answer comes from COMMITTED truth, never from the
      -- arrays this retry happened to pass in.
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_item_required_approvers ra
       WHERE ra.history_item_id = committed.history_item_id;
      SELECT count(*) FILTER (WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY')::integer,
             count(*) FILTER (WHERE d.dependency_kind = 'REASONING_DEPENDENCY')::integer
        INTO db_material_edges, db_reasoning_edges
        FROM public.shared_world_material_dependencies d
       WHERE d.target_material_id = committed.material_id;
      RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                          committed.history_item_id, committed.material_kind,
                          committed.baseline_viewer_count, approvers, db_material_edges, db_reasoning_edges,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  ELSIF world.phase = 'INTRODUCTION' THEN
    -- An Introduction World carries ordinary communication only while its
    -- Introduction is actually LIVE. Both terminal outcomes move the World out
    -- of ACTIVE / INTRODUCTION under the very World row locked above - SUCCESS
    -- by taking it to STANDARD, END by closing it - so this is a coherence
    -- floor rather than a second lifecycle: it can only ever refuse a World
    -- whose phase and Record already disagree, and it fails closed when they do.
    IF NOT EXISTS (
      SELECT 1 FROM public.introduction_records r
       WHERE r.world_id = p_world_id AND r.introduction_status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
  ELSIF world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact dependency sources, in deterministic
  -- identity order, so a concurrent owner deletion of a source serializes here
  -- rather than racing this commit.
  IF material_edges > 0 THEN
    -- QAN-CW-REM-01 / ASSURE-F04: WORLD CONTAINMENT IS DECIDED BEFORE THE LOCK,
    -- and the lock is SCOPED to the World this transaction already holds.
    --
    -- The phase-wide assurance found, and this slice's verifier REPRODUCED on
    -- real PostgreSQL, that locking a globally unique row identity without also
    -- pinning its already-known World lets a transaction hold row locks inside a
    -- World whose World row it does not hold - which closes a directed cycle
    -- against owner deletion, because migration 0089 orders dependency edges
    -- TEMPORALLY rather than on the uuid, so a target may sort BELOW its source
    -- and the deletion walks source-then-target while every other site walks
    -- ascending.
    --
    -- A material's World is immutable, so containment is knowable without any
    -- lock at all and the answer cannot go stale; AVAILABILITY is mutable and
    -- therefore stays under the lock, below. Splitting the check this way is
    -- what keeps the refusal class EXACTLY what it was: a foreign-World source
    -- is still SHARED_WORLD_MATERIAL_STALE, not a missing-row answer.
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
       WHERE m.id = ANY(sources) AND m.world_id <> p_world_id
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_STALE' USING ERRCODE='40001';
    END IF;
    PERFORM 1 FROM public.shared_world_materials m
      WHERE m.id = ANY(sources) AND m.world_id = p_world_id ORDER BY m.id FOR UPDATE;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> material_edges THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    -- EVERY SOURCE IS STILL AVAILABLE, read under the lock it needs. A deleted
    -- or invalidated source can never acquire a new source-content-bearing
    -- derivative.
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id
       WHERE m.id = ANY(sources) AND m.world_id = p_world_id
         AND i.availability_state <> 'AVAILABLE'
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_STALE' USING ERRCODE='40001';
    END IF;
    -- AUTHORITY METADATA IS EXACT, IN BOTH DIRECTIONS, OR IT FAILS CLOSED. This
    -- is the frozen I-04F rule: missing or contradictory authority metadata is
    -- never interpreted as approval-free.
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id
       WHERE m.id = ANY(sources)
         AND ((i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
               AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                                WHERE ra.history_item_id = i.id))
           OR (i.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'
               AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                            WHERE ra.history_item_id = i.id)))
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
  END IF;

  -- THE DERIVED REQUIRED APPROVER SET: the exact UNION of the human material
  -- authorities of the MATERIAL_DEPENDENCY sources, and nothing else. Never
  -- World membership, never the current audience, never a caller-supplied list,
  -- and never anything a REASONING_DEPENDENCY contributed.
  SELECT count(DISTINCT ra.approver_user_id)::integer INTO approvers
    FROM public.shared_world_materials m
    JOIN public.shared_world_history_item_required_approvers ra ON ra.history_item_id = m.history_item_id
   WHERE m.id = ANY(sources);
  -- AND THE AUTHORITY OF EVERY SOURCE IS READ, not just its approver rows
  -- (QAN-CW-REM-01 / REM01-AUTH-01). A MATERIAL_DEPENDENCY means this target
  -- REPRODUCES its source, so the source's whole authority requirement comes with
  -- it - and a source whose ADDITIONAL protected-human requirement is unresolved
  -- carries that unresolved half across the edge too. Counting only the source's
  -- KNOWN approvers would let one edge turn "known owners PLUS an unknown
  -- additional requirement" into "known owners only", which is the exact
  -- absence-is-not-emptiness inversion this whole migration exists to correct.
  --
  -- The predicate is the frozen one migration 0093 and the 0105 replacement of
  -- the Public authority derivation already use, reproduced here rather than
  -- reinvented: a source counts as unresolved unless it POSITIVELY records one of
  -- the two resolved states, so missing source-side authority metadata fails
  -- closed for exactly the same reason an unresolved one does.
  SELECT count(*)::integer INTO unresolved_sources
    FROM public.shared_world_materials m
   WHERE m.id = ANY(sources)
     AND NOT EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority a
                      WHERE a.material_id = m.id
                        AND a.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                                   'RESOLVED_NO_HUMAN_REQUIREMENT'));
  -- HISTORICAL-SHARING AUTHORITY RESOLUTION. A reasoning dependency propagates no
  -- material consent and never turns its grantor into an approver - but it DOES
  -- mean a protected human subject may be implicated whose authority this
  -- repository cannot yet resolve. Unknown is recorded as unknown, never as a
  -- known-empty requirement, and known MATERIAL_DEPENDENCY owners do not resolve
  -- the whole requirement on their own.
  --
  -- QAN-CW-REM-01 CORRECTS THE LAST ARM, AND ONLY THAT ARM. It used to read
  -- RESOLVED_NO_HUMAN_REQUIREMENT, which claims the runtime POSITIVELY PROVED
  -- this exact output implicates no protected human. Nothing here proves that.
  -- Reaching this arm means only that the caller declared no dependency whose
  -- owner this runtime could enumerate - and absence of known authority evidence
  -- is not a resolved-empty authority set. The same sentence the comment above
  -- already makes about a reasoning dependency is true here for exactly the same
  -- reason: an Introduction analysis can concern both matched humans while
  -- reproducing no Shared material and carrying no Shared reasoning reference, so
  -- "no declared source" and "no implicated human" are different facts.
  --
  -- A zero-dependency output therefore still commits, still reaches its exact
  -- baseline audience and still records INDEPENDENT_TARGET_TRUTH below - that
  -- provenance is unchanged and is still true. What it no longer does is claim an
  -- authority clearance it never established, so historical and Public widening
  -- fail closed instead of reading it as approval-free.
  --
  -- This makes RESOLVED_NO_HUMAN_REQUIREMENT unreachable from this producer at
  -- this baseline, which is the honest state of the repository: no reviewed
  -- server-owned source can positively prove an empty protected-human subject
  -- requirement for an arbitrary QANDEEL output. The value stays representable,
  -- and the mode derivation below stays exactly as it was, so a later reviewed
  -- subject-authority resolver re-enables both without reopening anything.
  --
  -- AND AN UNRESOLVED SOURCE MAKES AN UNRESOLVED TARGET (REM01-AUTH-01). The
  -- rule this migration applies to a reasoning dependency is applied to a
  -- MATERIAL_DEPENDENCY source that is itself unresolved, for the identical
  -- reason: the target reproduces it, so it inherits the source's WHOLE
  -- requirement, and the known half does not answer the unknown half. Without
  -- this arm the unresolved state is launderable in exactly one edge - commit an
  -- analysis over an unresolved analysis, declare no reasoning of your own, and
  -- the known owners alone would have resolved it - and then transitively, which
  -- would make the correction above cosmetic for every descendant.
  --
  -- The known approver rows are still derived and still written. An unresolved
  -- target with known required humans is a shape this repository already
  -- produces and already reads correctly: the mixed reasoning case has recorded
  -- exactly it since I-04G.
  authority_resolution := CASE
    WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
    WHEN unresolved_sources > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
    WHEN approvers > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
    ELSE 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' END;
  -- NO_HUMAN_APPROVAL_REQUIRED is written ONLY for a genuinely resolved empty
  -- requirement. Anything unresolved keeps the exact-approver mode, so the frozen
  -- I-04F package path can never read it as approval-free, and the widening gate
  -- above refuses it outright.
  authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'
    THEN 'NO_HUMAN_APPROVAL_REQUIRED' ELSE 'EXACT_HUMAN_APPROVER_SET' END;

  -- THE EXACT CURRENT HUMAN AUDIENCE, derived under the World lock, together with
  -- its canonical I-03D snapshot fingerprint - the SAME rows serve both, so there
  -- is exactly one audience meaning here.
  SELECT array_agg(a.user_id ORDER BY a.user_id),
         'sha256:' || encode(sha256(convert_to(
             'QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1' || E'\n'
          || 'state=RESOLVED' || E'\n'
          || 'world=' || lower(p_world_id::text) || E'\n'
          || 'members=' || coalesce(string_agg(
                 lower(a.user_id::text) || '@' || lower(a.membership_episode_id::text), ','
                 ORDER BY lower(a.user_id::text) COLLATE "C",
                          lower(a.membership_episode_id::text) COLLATE "C"), ''),
             'UTF8')), 'hex')
    INTO audience, current_audience_ref
    FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a;
  IF audience IS NULL OR array_length(audience, 1) IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- AN INTRODUCTION IS EXACTLY TWO HUMANS. Nothing in the frozen lifecycle can
  -- add a third or remove one while the World is ACTIVE / INTRODUCTION: ordinary
  -- leave and governed membership are both Standard-only, and the terminal cores
  -- close BOTH episodes and the World together in one transaction. A different
  -- number is therefore an impossible state rather than an availability answer,
  -- and it fails closed here instead of silently delivering to the wrong people.
  IF world.phase = 'INTRODUCTION' AND array_length(audience, 1) <> 2 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- STALE AUDIENCE EVIDENCE REFUSES THE COMMIT. The output was generated and
  -- revalidated for one exact audience; if the World's membership has moved since,
  -- that proof is about a different audience and this commit must not silently
  -- deliver to the new one.
  --
  -- The fingerprint is per (user, EPISODE), so a leave followed by the same
  -- human's rejoin stales it even though the human SET is identical - which is
  -- correct: the absent interval is real, and the new episode is a new membership.
  -- Because the fingerprint also carries the exact World, evidence generated for
  -- another World can never satisfy this either.
  IF p_audience_snapshot_ref <> current_audience_ref THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_STALE' USING ERRCODE='40001';
  END IF;

  -- THE ONE canonical establishment instant.
  commit_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_history_items
      (id, world_id, occurred_at, authority_requirement_mode, availability_state,
       availability_revision, registered_at)
    VALUES (p_history_item_id, p_world_id, commit_instant, authority_mode, 'AVAILABLE', 1, commit_instant);

    INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id)
    SELECT p_history_item_id, v.member FROM unnest(audience) AS v(member);
    GET DIAGNOSTICS viewers = ROW_COUNT;
    IF viewers <> array_length(audience, 1) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)
    SELECT DISTINCT p_history_item_id, ra.approver_user_id
      FROM public.shared_world_materials m
      JOIN public.shared_world_history_item_required_approvers ra ON ra.history_item_id = m.history_item_id
     WHERE m.id = ANY(sources);
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> approvers THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_materials
      (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
    VALUES (p_material_id, p_world_id, p_history_item_id, p_material_kind, 'QANDEEL', 'TEXT', NULL, commit_instant);

    INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text)
    VALUES (p_material_id, 'TEXT', p_body_text);

    INSERT INTO public.shared_world_qandeel_material_evidence
      (material_id, world_id, readiness_state, readiness_ref, effective_context_ref, output_digest,
       source_disclosure_gate_ref, authority_revalidation_ref, audience_snapshot_ref)
    VALUES (p_material_id, p_world_id, 'READY_FOR_LATER_DELIVERY_GATES', p_readiness_ref,
            p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref,
            p_authority_revalidation_ref, p_audience_snapshot_ref);

    -- PROVENANCE. Each kind keeps its own exact meaning. The source instant is
    -- carried so the strict source-precedes-target constraint of migration 0089
    -- makes a dependency cycle unrepresentable.
    IF material_edges > 0 THEN
      INSERT INTO public.shared_world_material_dependencies
        (id, world_id, dependency_kind, target_material_id, target_established_at,
         source_material_id, source_established_at)
      SELECT gen_random_uuid(), p_world_id, 'MATERIAL_DEPENDENCY', p_material_id, commit_instant,
             m.id, m.established_at
        FROM public.shared_world_materials m WHERE m.id = ANY(sources);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> material_edges THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;
    IF reasoning_edges > 0 THEN
      -- An opaque server-owned context reference, never raw private content:
      -- authorized private context influenced reasoning and was NOT copied here.
      INSERT INTO public.shared_world_material_dependencies
        (id, world_id, dependency_kind, target_material_id, target_established_at, source_context_ref)
      SELECT gen_random_uuid(), p_world_id, 'REASONING_DEPENDENCY', p_material_id, commit_instant, r.item
        FROM unnest(reasoning) AS r(item);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> reasoning_edges THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;
    IF material_edges = 0 AND reasoning_edges = 0 THEN
      INSERT INTO public.shared_world_material_dependencies
        (id, world_id, dependency_kind, target_material_id, target_established_at)
      VALUES (gen_random_uuid(), p_world_id, 'INDEPENDENT_TARGET_TRUTH', p_material_id, commit_instant);
    END IF;

    INSERT INTO public.shared_world_material_historical_authority
      (material_id, world_id, history_item_id, resolution_state)
    VALUES (p_material_id, p_world_id, p_history_item_id, authority_resolution);

    INSERT INTO public.shared_world_material_commit_commands
      (id, world_id, material_id, history_item_id, material_kind, producer_kind, actor_user_id,
       body_digest, request_ref, baseline_viewer_count, committed_at)
    VALUES (p_command_id, p_world_id, p_material_id, p_history_item_id, p_material_kind, 'QANDEEL', NULL,
            digest, request, viewers, commit_instant);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id IS NULL AND committed.world_id = p_world_id
         AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
         AND committed.producer_kind = 'QANDEEL' AND committed.request_ref = request THEN
        -- EVERY count in a retry answer comes from COMMITTED truth, never from the
        -- arrays this retry happened to pass in.
        SELECT count(*)::integer INTO approvers
          FROM public.shared_world_history_item_required_approvers ra
         WHERE ra.history_item_id = committed.history_item_id;
        SELECT count(*) FILTER (WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY')::integer,
               count(*) FILTER (WHERE d.dependency_kind = 'REASONING_DEPENDENCY')::integer
          INTO db_material_edges, db_reasoning_edges
          FROM public.shared_world_material_dependencies d
         WHERE d.target_material_id = committed.material_id;
        RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                            committed.history_item_id, committed.material_kind,
                            committed.baseline_viewer_count, approvers, db_material_edges, db_reasoning_edges,
                            committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken, or this exact I-03
    -- readiness already committed its one material. Evidence is not replayable.
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, p_command_id, p_world_id, p_material_id,
                      p_history_item_id, p_material_kind, viewers, approvers,
                      material_edges, reasoning_edges, commit_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 3b. THE TWO REMAINING UNSCOPED LOCK STATEMENTS, FORWARD-REPLACED.
--
--     ASSURE-F04 was provisional and is now REPRODUCED on real PostgreSQL by
--     this slice's own verifier, so its correction is authorized and is made
--     here - one scoping predicate per statement, and nothing else. Both
--     functions are reproduced from their own migrations' text; every gate,
--     order, instant, idempotency path and refusal class is byte-identical.
--
--     No result class changes. A mismatched request is still refused by the
--     containment check each function already had, with the class it already
--     raised; what changes is only that it no longer takes a lock inside a World
--     it does not hold on the way to that refusal.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_shared_world_history_package_v1(
  p_manifest_version_id uuid, p_world_id uuid, p_grantee_user_id uuid, p_history_item_ids uuid[]
) RETURNS TABLE(outcome text, prepared_manifest_version_id uuid, prepared_world_id uuid,
                prepared_grantee_user_id uuid, prepared_grantee_episode_id uuid,
                prepared_item_count integer, prepared_required_approver_count integer,
                prepared_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_history_package_manifest_versions;
  world public.shared_worlds;
  selected uuid[];
  items integer;
  approvers integer;
  grantee_episode uuid;
  affected integer;
  prepare_instant timestamptz;
BEGIN
  IF p_manifest_version_id IS NULL OR p_world_id IS NULL OR p_grantee_user_id IS NULL
     OR p_history_item_ids IS NULL OR array_length(p_history_item_ids, 1) IS NULL
     OR array_position(p_history_item_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The selection is an exact SET. A repeated identity is refused rather than
  -- silently folded, so "the exact item set" means the same thing to the caller,
  -- to the idempotency comparison below and to every later revalidation.
  IF (SELECT count(DISTINCT s.item) FROM unnest(p_history_item_ids) AS s(item))
     <> array_length(p_history_item_ids, 1) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(s.item ORDER BY s.item) INTO selected FROM unnest(p_history_item_ids) AS s(item);
  items := array_length(selected, 1);

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry of a
  -- manifest that already committed is answered from immutable history even after
  -- the grantee has left or rejoined. Nothing below this point reads CURRENT
  -- topology: a historical answer must not start differing because a human moved.
  SELECT * INTO committed FROM public.shared_world_history_package_manifest_versions c
   WHERE c.id = p_manifest_version_id;
  IF FOUND THEN
    IF committed.world_id = p_world_id AND committed.grantee_user_id = p_grantee_user_id
       AND (SELECT count(*) FROM public.shared_world_history_package_manifest_items mi
             WHERE mi.manifest_version_id = committed.id) = items
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                        WHERE mi.manifest_version_id = committed.id
                          AND NOT (mi.history_item_id = ANY(selected))) THEN
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_package_required_approvers pa
       WHERE pa.manifest_version_id = committed.id;
      RETURN QUERY SELECT 'PREPARED'::text, committed.id, committed.world_id, committed.grantee_user_id,
                          committed.grantee_membership_episode_id, items, approvers, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the exact World row, before anything else.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two concurrent
  -- equivalent preparations serialize and the loser returns committed history.
  SELECT * INTO committed FROM public.shared_world_history_package_manifest_versions c
   WHERE c.id = p_manifest_version_id;
  IF FOUND THEN
    IF committed.world_id = p_world_id AND committed.grantee_user_id = p_grantee_user_id
       AND (SELECT count(*) FROM public.shared_world_history_package_manifest_items mi
             WHERE mi.manifest_version_id = committed.id) = items
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                        WHERE mi.manifest_version_id = committed.id
                          AND NOT (mi.history_item_id = ANY(selected))) THEN
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_package_required_approvers pa
       WHERE pa.manifest_version_id = committed.id;
      RETURN QUERY SELECT 'PREPARED'::text, committed.id, committed.world_id, committed.grantee_user_id,
                          committed.grantee_membership_episode_id, items, approvers, committed.created_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Selective history is an ordinary Shared mutation: ACTIVE / STANDARD only. An
  -- archived World blocks it (CW2-03 section 35 / C31) and a paired World has its
  -- own terminal transition, which this slice neither implements nor guesses.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE GRANTEE'S OWN EXACT CURRENT OPEN EPISODE, resolved from canonical state
  -- under the World lock rather than from any parameter. Migration 0075's partial
  -- unique index already guarantees at most one; zero reaches the same bounded
  -- class as every other unavailable case, so no future wrapper can turn this
  -- primitive into a membership oracle.
  IF (SELECT count(*) FROM public.shared_world_membership_episodes probe
       WHERE probe.world_id = p_world_id AND probe.user_id = p_grantee_user_id
         AND probe.ended_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT e.id INTO grantee_episode
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.user_id = p_grantee_user_id AND e.ended_at IS NULL;

  -- CANONICAL LOCK ORDER, STEP 2: the exact selected history items, in
  -- deterministic UUID identity order. LockRows sits above the sort, so the rows
  -- really are locked in that order and two packages sharing items cannot
  -- deadlock against each other.
  -- QAN-CW-REM-01 / ASSURE-F04: scoped to the World locked above, so this
  -- transaction cannot hold a row lock inside a World whose World row it does
  -- not hold. A foreign item now fails the row-count check immediately below
  -- instead of the containment check immediately after it - and BOTH raise the
  -- same SHARED_WORLD_HISTORY_NOT_AVAILABLE, so no refusal class changes.
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id = ANY(selected) AND i.world_id = p_world_id ORDER BY i.id FOR UPDATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> items THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- Every selected item must belong to the exact same World and still be
  -- AVAILABLE. A deleted or unavailable source is never packaged.
  IF EXISTS (SELECT 1 FROM public.shared_world_history_items i
              WHERE i.id = ANY(selected)
                AND (i.world_id <> p_world_id OR i.availability_state <> 'AVAILABLE')) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- AUTHORITY METADATA IS EXACT, IN BOTH DIRECTIONS, OR IT FAILS CLOSED. An item
  -- claiming EXACT_HUMAN_APPROVER_SET with no approver is missing metadata, and
  -- an item claiming NO_HUMAN_APPROVAL_REQUIRED while carrying one is
  -- contradictory. Neither is ever interpreted as approval-free.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_items i
     WHERE i.id = ANY(selected)
       AND ((i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
             AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                              WHERE ra.history_item_id = i.id))
         OR (i.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'
             AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                          WHERE ra.history_item_id = i.id)))
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- THE ONE canonical instant, read from the database clock exactly once.
  prepare_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_history_package_manifest_versions
      (id, world_id, grantee_user_id, grantee_membership_episode_id, created_at)
    VALUES (p_manifest_version_id, p_world_id, p_grantee_user_id, grantee_episode, prepare_instant);

    -- The exact item set, with each item's exact availability revision captured.
    INSERT INTO public.shared_world_history_package_manifest_items
      (manifest_version_id, world_id, history_item_id, captured_availability_revision)
    SELECT p_manifest_version_id, i.world_id, i.id, i.availability_revision
      FROM public.shared_world_history_items i WHERE i.id = ANY(selected);
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> items THEN
      RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE DERIVED REQUIRED APPROVER SET: the exact UNION over the included items,
    -- never a caller-supplied list and never World membership.
    INSERT INTO public.shared_world_history_package_required_approvers
      (manifest_version_id, approver_user_id)
    SELECT DISTINCT p_manifest_version_id, ra.approver_user_id
      FROM public.shared_world_history_item_required_approvers ra
     WHERE ra.history_item_id = ANY(selected);
    GET DIAGNOSTICS approvers = ROW_COUNT;
  EXCEPTION WHEN unique_violation THEN
    -- A manifest identity already committed for THIS World would have been
    -- answered above under the World lock, so the only remaining collision is the
    -- same identity committed for a DIFFERENT World, which can never be an
    -- equivalent retry. The whole preparation - manifest, item set and derived
    -- approver set - rolls back together, so a refused preparation leaves no
    -- orphan manifest behind.
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PREPARED'::text, p_manifest_version_id, p_world_id, p_grantee_user_id,
                      grantee_episode, items, approvers, prepare_instant;
END$$;

CREATE OR REPLACE FUNCTION public.prepare_public_experience_manifest_v1(
  p_command_id uuid,
  p_experience_id uuid,
  p_manifest_version_id uuid,
  p_experience_version_id uuid,
  p_personal_package_item_ids uuid[],
  p_personal_source_unit_ids uuid[],
  p_shared_package_item_ids uuid[],
  p_shared_source_world_ids uuid[],
  p_shared_source_material_ids uuid[]
) RETURNS TABLE(outcome text, manifest_version_id uuid, experience_version_id uuid,
                version_ordinal integer, item_count integer, required_approver_count integer,
                authority_request_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.publication_package_prepare_commands;
  experience public.public_experiences;
  controller public.public_experience_controllers;
  personal_count integer := coalesce(array_length(p_personal_package_item_ids, 1), 0);
  shared_count integer := coalesce(array_length(p_shared_package_item_ids, 1), 0);
  total integer;
  next_ordinal integer;
  derived_approvers uuid[];
  derived_count integer;
  derived_fingerprint text;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_manifest_version_id IS NULL
     OR p_experience_version_id IS NULL
     OR p_personal_package_item_ids IS NULL OR p_personal_source_unit_ids IS NULL
     OR p_shared_package_item_ids IS NULL OR p_shared_source_world_ids IS NULL
     OR p_shared_source_material_ids IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- Aligned arrays of equal length, with no NULL element, and a NON-EMPTY package.
  IF personal_count <> coalesce(array_length(p_personal_source_unit_ids, 1), 0)
     OR shared_count <> coalesce(array_length(p_shared_source_world_ids, 1), 0)
     OR shared_count <> coalesce(array_length(p_shared_source_material_ids, 1), 0)
     OR array_position(p_personal_package_item_ids, NULL) IS NOT NULL
     OR array_position(p_personal_source_unit_ids, NULL) IS NOT NULL
     OR array_position(p_shared_package_item_ids, NULL) IS NOT NULL
     OR array_position(p_shared_source_world_ids, NULL) IS NOT NULL
     OR array_position(p_shared_source_material_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  total := personal_count + shared_count;
  IF total = 0 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- Distinct package item identities, distinct Personal sources and distinct
  -- Shared sources: an item may appear in a package exactly once.
  IF (SELECT count(DISTINCT x) FROM unnest(p_personal_package_item_ids || p_shared_package_item_ids) x) <> total
     OR (SELECT count(DISTINCT x) FROM unnest(p_personal_source_unit_ids) x) <> personal_count
     OR (SELECT count(*) FROM (SELECT DISTINCT w, m
           FROM unnest(p_shared_source_world_ids, p_shared_source_material_ids) t(w, m)) d) <> shared_count THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_PACKAGE_PREPARE_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'manifest=' || lower(p_manifest_version_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text) || E'\n'
   || 'personal=' || coalesce((SELECT string_agg(lower(t.pi::text) || '@' || lower(t.su::text), ','
                                 ORDER BY lower(t.pi::text) COLLATE "C")
                                 FROM unnest(p_personal_package_item_ids, p_personal_source_unit_ids)
                                   AS t(pi, su)), '') || E'\n'
   || 'shared=' || coalesce((SELECT string_agg(lower(t.pi::text) || '@' || lower(t.w::text)
                                               || ':' || lower(t.m::text), ','
                               ORDER BY lower(t.pi::text) COLLATE "C")
                               FROM unnest(p_shared_package_item_ids, p_shared_source_world_ids,
                                           p_shared_source_material_ids) AS t(pi, w, m)), ''), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.publication_package_prepare_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.manifest_version_id,
                        committed.experience_version_id,
                        (SELECT v.version_ordinal FROM public.public_experience_versions v
                          WHERE v.id = committed.experience_version_id),
                        committed.item_count, committed.required_approver_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the ONE Public World.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  -- CANONICAL LOCK ORDER, STEP 2: the exact Experience.
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.publication_package_prepare_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.manifest_version_id,
                        committed.experience_version_id,
                        (SELECT v.version_ordinal FROM public.public_experience_versions v
                          WHERE v.id = committed.experience_version_id),
                        committed.item_count, committed.required_approver_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- THE EXACT CONTROLLER, and nobody else. A content rightsholder does not gain
  -- this, and there is no controller parameter.
  SELECT * INTO controller FROM public.public_experience_controllers c
   WHERE c.experience_id = p_experience_id AND c.controller_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  -- I-05A prepares packages for a DRAFT Experience only. It owns no transition
  -- back out of READY_FOR_REVIEW and no public lifecycle at all.
  IF experience.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 4: the exact source rows, in the SAME relative
  -- order every I-04 consequential mutation uses - the Shared World row, then
  -- materials by id, then history items by id. SHARE locks throughout: Public
  -- reads Shared truth and never writes it.
  --
  -- The Shared World row is the synchronization point source-view authority
  -- needs. Every I-04 mutation that can change what this human may see - leave,
  -- removal, rejoin, a history grant, closure, owner deletion - takes
  -- `shared_worlds FOR UPDATE` FIRST, so a SHARE lock here means the visibility
  -- answer resolved below cannot go stale before the body is copied. Taking it
  -- creates no cycle: I-04 never takes a Public lock, and Public acquires the
  -- three Shared relations in I-04's own order.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id = ANY(p_shared_source_world_ids) ORDER BY w.id FOR SHARE;
  -- QAN-CW-REM-01 / ASSURE-F04, the PRIMARY site: these are the only
  -- (World, material) arrays a human's publication request supplies directly,
  -- and locking a material by id ALONE let a mismatched request hold a row lock
  -- inside a World whose row the statement above never took. That is the whole
  -- of the cycle this slice's verifier reproduced against owner deletion on real
  -- PostgreSQL. The predicate below makes the claim at the top of this comment
  -- block - "Public acquires the three Shared relations in I-04's own order,
  -- under the World row it holds" - true instead of merely intended.
  --
  -- A mismatched request is still refused by the exact containment check below,
  -- with the exact same PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE class: what
  -- changes is only that it no longer takes a foreign lock on the way there.
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id = ANY(p_shared_source_material_ids)
      AND m.world_id = ANY(p_shared_source_world_ids) ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT m.history_item_id FROM public.shared_world_materials m
                    WHERE m.id = ANY(p_shared_source_material_ids)
                      AND m.world_id = ANY(p_shared_source_world_ids))
      AND i.world_id = ANY(p_shared_source_world_ids)
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id = ANY(p_personal_source_unit_ids) ORDER BY cu.id FOR SHARE;

  -- ===================== THE PERSONAL SOURCE ADAPTER =====================
  -- Every named unit exists.
  IF EXISTS (SELECT 1 FROM unnest(p_personal_source_unit_ids) s(id)
              WHERE NOT EXISTS (SELECT 1 FROM public.conversation_units cu WHERE cu.id = s.id)) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- The actor owns it exactly. Another human cannot prepare it.
  IF EXISTS (SELECT 1 FROM public.conversation_units cu
              WHERE cu.id = ANY(p_personal_source_unit_ids) AND cu.user_id <> u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  -- PERSONAL QANDEEL ANALYSIS FAILS CLOSED. The exact protected-human authority
  -- requirement is not resolvable from current reviewed repository truth, and
  -- unresolved never means approval-free.
  IF EXISTS (SELECT 1 FROM public.conversation_units cu
              WHERE cu.id = ANY(p_personal_source_unit_ids) AND cu.source_role <> 'USER') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- ====================== THE SHARED SOURCE ADAPTER ======================
  -- Every named material exists in the exact named World.
  IF EXISTS (
    SELECT 1 FROM unnest(p_shared_source_world_ids, p_shared_source_material_ids) t(w, m)
     WHERE NOT EXISTS (SELECT 1 FROM public.shared_world_materials sm
                        WHERE sm.id = t.m AND sm.world_id = t.w)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- ============ SOURCE-ACCESS AUTHORITY, BEFORE ANY BODY IS READ ============
  --
  -- Content publication authority is NOT source-access authority. A rightsholder
  -- approving the widening of THEIR material says nothing about whether the human
  -- assembling the package was ever entitled to SEE it. Without this check, a
  -- controller who merely knew valid Shared identifiers could make this
  -- SECURITY DEFINER path copy hidden bytes into their own DRAFT and then read
  -- them back through the controller review boundary - before any rightsholder
  -- approval, and before any audience expansion existed to be refused.
  --
  -- The entitlement question belongs to I-04F and is NOT re-implemented here.
  -- This consumes the canonical entry point,
  -- `resolve_shared_world_history_visibility_v1(world, human)`, which already
  -- owns the whole meaning: the ACTIVE union of membership-period visibility and
  -- explicit history grants, the READ_ONLY_CLOSED delegation to the exact frozen
  -- closure entitlement, the requirement of an open episode, availability
  -- dominating every basis, and a truthful EMPTY answer rather than a
  -- distinguishable error for a human with no standing - so it is not a
  -- membership oracle and neither is this.
  --
  -- A former member keeps material authority to APPROVE their own included
  -- material (proven separately below). That is a different right from browsing,
  -- and this check is what keeps preparation from becoming the backdoor.
  --
  -- The denial class is deliberately the SAME one a nonexistent material gets, so
  -- a caller cannot learn from the error whether a hidden source id exists. It is
  -- also evaluated BEFORE the kind, availability and authority checks below, so
  -- none of those can answer that question either.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND NOT EXISTS (
         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(sm.world_id, u) v
          WHERE v.history_item_id = sm.history_item_id)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- Only a kind that has a PUBLIC body form may be included. HUMAN_VOICE_NOTE
  -- has no reviewed public media boundary; EXPLICIT_DISCLOSURE and
  -- WORLD_EVENT_DERIVED_MATERIAL have no producer at all.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND sm.material_kind NOT IN ('HUMAN_TEXT', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_KIND_RESERVED' USING ERRCODE='0A000';
  END IF;
  -- The source must be currently available, and its body must still exist.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
      JOIN public.shared_world_history_items i ON i.id = sm.history_item_id
     WHERE sm.id = ANY(p_shared_source_material_ids) AND i.availability_state <> 'AVAILABLE'
  ) OR EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b
                        WHERE b.material_id = sm.id)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- UNRESOLVED ADDITIONAL HUMAN AUTHORITY FAILS CLOSED FOR PACKAGE INCLUSION,
  -- and so does the absence of any source-side authority metadata.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_materials sm
     WHERE sm.id = ANY(p_shared_source_material_ids)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority ha
                        WHERE ha.material_id = sm.id
                          AND ha.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                                      'RESOLVED_NO_HUMAN_REQUIREMENT'))
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- THE NEXT VERSION ORDINAL of this exact Experience, under its own lock.
  SELECT coalesce(max(v.version_ordinal), 0) + 1 INTO next_ordinal
    FROM public.public_experience_versions v WHERE v.experience_id = p_experience_id;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this preparation.
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.publication_package_manifest_versions
      (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
       intended_publication_action, target_audience_class, authority_readiness,
       prepared_authority_snapshot_version, item_count, created_at)
    SELECT p_manifest_version_id, p_experience_id, true, controller.controller_public_identity_ref, u,
           'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
           w.state_version, total, instant
      FROM public.public_world_state w WHERE w.singleton;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- THE ITEMS, THEIR PUBLIC BODIES, THEIR SEALED PROVENANCE AND THEIR PER-ITEM
  -- AUTHORITY, all from the ONE item resolution over the exact locked source.
  INSERT INTO public.publication_package_manifest_items
    (manifest_version_id, experience_id, package_item_id, item_ordinal,
     derivative_classification, public_body_form, public_body_digest)
  SELECT p_manifest_version_id, p_experience_id, r.package_item_id, r.item_ordinal,
         r.derivative_classification, 'PUBLIC_TEXT', r.public_body_digest
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  INSERT INTO public.public_experience_text_derivative_bodies
    (package_item_id, public_body_form, public_text_body)
  SELECT r.package_item_id, 'PUBLIC_TEXT', r.public_text_body
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  INSERT INTO public.publication_package_item_provenance
    (package_item_id, manifest_version_id, source_class, personal_conversation_unit_id,
     personal_owner_user_id, shared_world_id, shared_material_id, shared_history_item_id,
     captured_availability_state, captured_availability_revision, captured_source_digest)
  SELECT r.package_item_id, p_manifest_version_id, r.source_class, r.personal_conversation_unit_id,
         r.personal_owner_user_id, r.shared_world_id, r.shared_material_id, r.shared_history_item_id,
         'AVAILABLE', r.captured_availability_revision, r.public_body_digest
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  INSERT INTO public.publication_package_item_authority
    (package_item_id, manifest_version_id, resolution_state, required_approver_count)
  SELECT r.package_item_id, p_manifest_version_id,
         CASE WHEN r.item_required_approver_count > 0
              THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT' ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT' END,
         r.item_required_approver_count
    FROM public.resolve_public_package_items_v1(
           p_personal_package_item_ids, p_personal_source_unit_ids, p_shared_package_item_ids,
           p_shared_source_world_ids, p_shared_source_material_ids) r;

  -- THE PROSPECTIVE EXPERIENCE VERSION, bijective with this exact manifest.
  BEGIN
    INSERT INTO public.public_experience_versions
      (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
    VALUES (p_experience_version_id, p_experience_id, p_manifest_version_id, next_ordinal, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- THE DERIVED CONTENT RIGHTSHOLDER SET AND THE AUTHORITY REQUEST FINGERPRINT,
  -- from the ONE derivation, over the rows just written. The three results are
  -- read into explicitly typed scalars rather than a record, so every expression
  -- built from them has a type the planner knows without inferring one.
  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO derived_approvers, derived_count, derived_fingerprint
    FROM public.derive_public_publication_authority_v1(p_manifest_version_id) d;

  INSERT INTO public.publication_manifest_required_approvers (manifest_version_id, approver_user_id)
  SELECT p_manifest_version_id, a.approver FROM unnest(derived_approvers) AS a(approver);

  -- The Experience moves forward one revision and points at the new prospective
  -- version. Its lifecycle does NOT change: preparing a package is not a
  -- lifecycle transition and widens no audience.
  UPDATE public.public_experiences e
     SET current_experience_version_id = p_experience_version_id,
         experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;

  INSERT INTO public.publication_package_prepare_commands
    (id, experience_id, manifest_version_id, experience_version_id, actor_user_id, command_action,
     item_count, required_approver_count, authority_request_fingerprint, request_ref, committed_at)
  VALUES (p_command_id, p_experience_id, p_manifest_version_id, p_experience_version_id, u,
          'PREPARE_PUBLICATION', total, derived_count, derived_fingerprint, request, instant);

  RETURN QUERY SELECT 'PACKAGE_PREPARED'::text, p_manifest_version_id, p_experience_version_id,
                      next_ordinal, total, derived_count, derived_fingerprint, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 4. THE HISTORY ACCESS GRANT, FORWARD-REPLACED.
--
--    Migration 0087's function, reproduced from its own text with ONE gate
--    added immediately before the grant instant is taken. Nothing else moves:
--    the same three idempotency passes, the same World-first lock order, the
--    same staleness and approval-completeness rules, the same absence of a
--    granting actor, and the same rows written at the same one instant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_shared_world_history_access_grant_v1(
  p_command_id uuid, p_manifest_version_id uuid, p_history_access_grant_id uuid,
  p_history_granted_event_id uuid
) RETURNS TABLE(outcome text, history_command_id uuid, granted_world_id uuid,
                granted_manifest_version_id uuid, committed_grant_id uuid,
                committed_event_id uuid, history_granted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_history_grant_commands;
  manifest public.shared_world_history_package_manifest_versions;
  world public.shared_worlds;
  target_world uuid;
  required integer;
  recorded integer;
  grant_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_manifest_version_id IS NULL OR p_history_access_grant_id IS NULL
     OR p_history_granted_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS. The committed answer is historical: an item
  -- may legitimately have become unavailable since, and this command must not
  -- start answering differently because of that. What must still hold is that the
  -- immutable facts it wrote remain coherent.
  SELECT * INTO committed FROM public.shared_world_history_grant_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id
       AND committed.history_access_grant_id = p_history_access_grant_id
       AND committed.history_granted_event_id = p_history_granted_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_history_granted_events ev
          JOIN public.shared_world_history_access_grants g ON g.id = ev.history_access_grant_id
         WHERE ev.id = committed.history_granted_event_id
           AND ev.history_access_grant_id = committed.history_access_grant_id
           AND ev.manifest_version_id = committed.manifest_version_id
           AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
           AND g.manifest_version_id = committed.manifest_version_id
           AND g.world_id = committed.world_id
           AND g.granted_at = committed.committed_at
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'HISTORY_GRANTED'::text, committed.id, committed.world_id,
                          committed.manifest_version_id, committed.history_access_grant_id,
                          committed.history_granted_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- WORLD-FIRST ORDER.
  SELECT m.world_id INTO target_world
    FROM public.shared_world_history_package_manifest_versions m WHERE m.id = p_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.shared_world_history_grant_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.manifest_version_id = p_manifest_version_id
       AND committed.history_access_grant_id = p_history_access_grant_id
       AND committed.history_granted_event_id = p_history_granted_event_id THEN
      RETURN QUERY SELECT 'HISTORY_GRANTED'::text, committed.id, committed.world_id,
                          committed.manifest_version_id, committed.history_access_grant_id,
                          committed.history_granted_event_id, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO manifest FROM public.shared_world_history_package_manifest_versions m
   WHERE m.id = p_manifest_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF manifest.world_id <> target_world THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT mi.history_item_id
                     FROM public.shared_world_history_package_manifest_items mi
                    WHERE mi.manifest_version_id = manifest.id)
    ORDER BY i.id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
     WHERE e.id = manifest.grantee_membership_episode_id
       AND e.world_id = manifest.world_id AND e.user_id = manifest.grantee_user_id
       AND e.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                  WHERE mi.manifest_version_id = manifest.id) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_history_items i ON i.id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND (i.world_id <> manifest.world_id
            OR i.availability_state <> 'AVAILABLE'
            OR i.availability_revision <> mi.captured_availability_revision)
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;

  -- THE COMPLETED EXACT MATERIAL-AUTHORITY SET. Every derived required human
  -- carries an approval of THIS exact manifest, and the unique binding makes at
  -- least one mean exactly one.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_required_approvers pa
     WHERE pa.manifest_version_id = manifest.id
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_approvals a
                        WHERE a.manifest_version_id = pa.manifest_version_id
                          AND a.approver_user_id = pa.approver_user_id)
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE' USING ERRCODE='55000';
  END IF;
  SELECT count(*)::integer INTO required
    FROM public.shared_world_history_package_required_approvers pa
   WHERE pa.manifest_version_id = manifest.id;
  SELECT count(*)::integer INTO recorded
    FROM public.shared_world_history_package_approvals a
   WHERE a.manifest_version_id = manifest.id;
  IF recorded <> required THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE' USING ERRCODE='55000';
  END IF;

  -- PER-ITEM AUTHORITY METADATA IS STILL EXACT, in both directions. A zero
  -- required set is authority ONLY for a manifest whose every item explicitly
  -- says NO_HUMAN_APPROVAL_REQUIRED; missing metadata is never approval-free.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_history_items i ON i.id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND ((i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
             AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                              WHERE ra.history_item_id = i.id))
         OR (i.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'
             AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                          WHERE ra.history_item_id = i.id)))
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF required = 0 AND EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_history_items i ON i.id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND i.authority_requirement_mode <> 'NO_HUMAN_APPROVAL_REQUIRED'
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- The derived set must STILL equal the exact union over the included items, so
  -- an item that gained a required human after preparation cannot be granted
  -- under the narrower set that was approved.
  IF EXISTS (
    SELECT ra.approver_user_id FROM public.shared_world_history_item_required_approvers ra
     WHERE ra.history_item_id IN (SELECT mi.history_item_id
                                    FROM public.shared_world_history_package_manifest_items mi
                                   WHERE mi.manifest_version_id = manifest.id)
    EXCEPT
    SELECT pa.approver_user_id FROM public.shared_world_history_package_required_approvers pa
     WHERE pa.manifest_version_id = manifest.id
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_STALE' USING ERRCODE='40001';
  END IF;

  -- AND THE PER-ITEM AUTHORITY IS STILL RESOLVED AT THE INSTANT THE WIDENING
  -- ACTUALLY HAPPENS (QAN-CW-REM-01). Package preparation already refuses an
  -- item whose additional human requirement is unresolved, but a manifest is
  -- immutable and may have been prepared BEFORE that state was corrected - so a
  -- preparation older than the truth is exactly what this commit must not trust.
  --
  -- It is the SAME relation, the SAME state and the SAME bounded refusal class
  -- the preparation gate uses, re-read here under the World lock: one authority
  -- model asked twice at two consequential boundaries, never a second model.
  -- Every other manifest is untouched, and an item with no material authority row
  -- at all passes exactly as it did before.
  IF EXISTS (
    SELECT 1 FROM public.shared_world_history_package_manifest_items mi
      JOIN public.shared_world_material_historical_authority a
        ON a.history_item_id = mi.history_item_id
     WHERE mi.manifest_version_id = manifest.id
       AND a.resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  grant_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_history_access_grants
      (id, world_id, grantee_user_id, grantee_membership_episode_id, manifest_version_id, granted_at)
    VALUES (p_history_access_grant_id, manifest.world_id, manifest.grantee_user_id,
            manifest.grantee_membership_episode_id, manifest.id, grant_instant);

    INSERT INTO public.shared_world_history_granted_events
      (id, world_id, history_access_grant_id, manifest_version_id, occurred_at)
    VALUES (p_history_granted_event_id, manifest.world_id, p_history_access_grant_id,
            manifest.id, grant_instant);

    INSERT INTO public.shared_world_history_grant_commands
      (id, world_id, manifest_version_id, history_access_grant_id, history_granted_event_id, committed_at)
    VALUES (p_command_id, manifest.world_id, manifest.id, p_history_access_grant_id,
            p_history_granted_event_id, grant_instant);
  EXCEPTION WHEN unique_violation THEN
    -- A supplied persistence identity was already taken, or this exact manifest
    -- already committed its one grant. The whole commit rolls back together.
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'HISTORY_GRANTED'::text, p_command_id, manifest.world_id, manifest.id,
                      p_history_access_grant_id, p_history_granted_event_id, grant_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 5. THE ONE HISTORICAL VISIBILITY ENTRY POINT, FORWARD-REPLACED.
--
--    Migration 0115's function, reproduced from its own text with ONE conjunct
--    added to the STANDARD grant basis. It is still the ONE entry point, the
--    membership-period basis is untouched in both modes, the Introduction
--    branch is untouched, closed viewing still delegates to the same reader,
--    availability still dominates, and an unspelled World mode is still refused.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_shared_world_history_visibility_v1(p_world_id uuid, p_user_id uuid)
RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  world public.shared_worlds;
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- Canonical existence first: a noncanonical World is a bounded error, never a
  -- successful empty history.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- A World mode outside the frozen vocabulary is still unsupported rather
  -- than silently given Standard semantics. Both frozen phases are now
  -- implemented, so this branch is a forward guard rather than a live refusal.
  IF world.phase NOT IN ('STANDARD', 'INTRODUCTION') THEN
    RAISE EXCEPTION 'SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  IF world.lifecycle = 'READ_ONLY_CLOSED' THEN
    RETURN QUERY SELECT c.world_id, c.history_item_id, c.occurred_at
      FROM public.resolve_shared_world_closed_history_visibility_v1(p_world_id, p_user_id) c;
    RETURN;
  END IF;
  -- ACTIVE: an open episode is required before anything is visible, in both
  -- modes. This is what makes a departed human's answer truthfully empty.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                  WHERE e.world_id = p_world_id AND e.user_id = p_user_id AND e.ended_at IS NULL) THEN
    RETURN;
  END IF;
  -- ACTIVE / INTRODUCTION: the exact baseline-audience conjunction alone. No
  -- history package, no grant, no placeholder.
  IF world.phase = 'INTRODUCTION' THEN
    RETURN QUERY
      SELECT i.world_id, i.id, i.occurred_at
        FROM public.shared_world_history_items i
       WHERE i.world_id = p_world_id
         AND i.availability_state = 'AVAILABLE'
         AND EXISTS (
               SELECT 1 FROM public.shared_world_history_item_baseline_viewers b
                WHERE b.history_item_id = i.id AND b.user_id = p_user_id
                  AND EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                               WHERE e.world_id = i.world_id AND e.user_id = p_user_id
                                 AND i.occurred_at >= e.joined_at
                                 AND (e.ended_at IS NULL OR i.occurred_at <= e.ended_at)))
       ORDER BY i.occurred_at, i.id;
    RETURN;
  END IF;
  -- ACTIVE / STANDARD: exactly the frozen I-04F union, unchanged.
  RETURN QUERY
    SELECT i.world_id, i.id, i.occurred_at
      FROM public.shared_world_history_items i
     WHERE i.world_id = p_world_id
       AND i.availability_state = 'AVAILABLE'
       AND (EXISTS (
              SELECT 1 FROM public.shared_world_history_item_baseline_viewers b
               WHERE b.history_item_id = i.id AND b.user_id = p_user_id
                 AND EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                              WHERE e.world_id = i.world_id AND e.user_id = p_user_id
                                AND i.occurred_at >= e.joined_at
                                AND (e.ended_at IS NULL OR i.occurred_at <= e.ended_at)))
         OR (EXISTS (
              SELECT 1 FROM public.shared_world_history_package_manifest_items mi
                JOIN public.shared_world_history_access_grants g
                  ON g.manifest_version_id = mi.manifest_version_id
               WHERE mi.history_item_id = i.id
                 AND g.world_id = i.world_id AND g.grantee_user_id = p_user_id)
             -- QAN-CW-REM-01: A WIDENED BASIS CARRIES ONLY RESOLVED AUTHORITY.
             -- An existing grant is durable historical evidence and is never
             -- erased, but it is evidence that a widening was committed - not a
             -- standing permission that survives the authority behind it being
             -- corrected. So the grant basis, and ONLY the grant basis, stops
             -- carrying an item whose additional human requirement is currently
             -- unresolved. The membership-period basis above is untouched, which
             -- is the whole point: a human who could already see this item as
             -- part of its exact baseline audience still sees it, under the same
             -- baseline truth, and loses nothing.
             AND NOT EXISTS (
               SELECT 1 FROM public.shared_world_material_historical_authority a
                WHERE a.history_item_id = i.id
                  AND a.resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT')))
     ORDER BY i.occurred_at, i.id;
END$$;

-- ---------------------------------------------------------------------------
-- 6. THE INTERNAL CLOSED READER, FORWARD-REPLACED.
--
--    Migration 0115's internal reader, reproduced from its own text with the
--    same correction applied to its STANDARD branch. It stays INTERNAL, STABLE,
--    membership-free and reachable only by its one postgres-owned caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_shared_world_closed_history_visibility_v1(p_world_id uuid, p_user_id uuid)
RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  world public.shared_worlds;
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF world.lifecycle <> 'READ_ONLY_CLOSED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  -- READ_ONLY_CLOSED / INTRODUCTION: the exact Introduction closed-view
  -- entitlement snapshot migration 0116 froze at the terminal instant.
  IF world.phase = 'INTRODUCTION' THEN
    RETURN QUERY
      SELECT i.world_id, i.id, i.occurred_at
        FROM public.introduction_closed_view_entitlement_items it
        JOIN public.shared_world_history_items i ON i.id = it.history_item_id
       WHERE it.world_id = p_world_id AND it.user_id = p_user_id
         AND i.availability_state = 'AVAILABLE'
       ORDER BY i.occurred_at, i.id;
    RETURN;
  END IF;
  IF world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  -- READ_ONLY_CLOSED / STANDARD: the frozen I-04F snapshot, with exactly the
  -- same QAN-CW-REM-01 correction the ACTIVE branch of the entry point makes.
  --
  -- The snapshot is a flat (World, human, item) list: migration 0088 builds it
  -- through the ONE visibility entry point while the World is still ACTIVE, so an
  -- item widened by a grant BEFORE the authority behind it was corrected would
  -- otherwise be frozen into it and served forever. The basis is re-derived here
  -- from the item's own exact baseline audience - the entitlement snapshot keeps
  -- the temporal truth, so the audience row is the whole question and NO
  -- membership is consulted: closed viewing is entitlement, never membership.
  --
  -- The Introduction branch above needs none of this and deliberately gets none:
  -- its snapshot is written from the ACTIVE / INTRODUCTION branch of the entry
  -- point, which has no grant basis at all, so every item it can hold is already
  -- a baseline item of the human holding it.
  RETURN QUERY
    SELECT i.world_id, i.id, i.occurred_at
      FROM public.shared_world_standard_closed_view_entitlement_items it
      JOIN public.shared_world_history_items i ON i.id = it.history_item_id
     WHERE it.world_id = p_world_id AND it.user_id = p_user_id
       AND i.availability_state = 'AVAILABLE'
       AND (EXISTS (
              SELECT 1 FROM public.shared_world_history_item_baseline_viewers b
               WHERE b.history_item_id = i.id AND b.user_id = p_user_id)
         OR NOT EXISTS (
              SELECT 1 FROM public.shared_world_material_historical_authority a
               WHERE a.history_item_id = i.id
                 AND a.resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'))
     ORDER BY i.occurred_at, i.id;
END$$;

-- ---------------------------------------------------------------------------
-- 7. OWNERSHIP AND ACLS, RE-ASSERTED.
--
--    CREATE OR REPLACE preserves both, so these statements change nothing. They
--    are written anyway so this file states the posture it depends on instead of
--    inheriting it silently. No application role gains EXECUTE on anything here.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_shared_world_history_visibility_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid) FROM service_role';
  -- The ONE historical visibility entry point KEEPS its frozen service_role
  -- EXECUTE. It is the only grant in this whole chain and it is not this
  -- migration's to take away.
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_shared_world_history_visibility_v1(uuid, uuid) TO service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 8. Terminal self-assertions. The migration refuses to deploy an authority
--    correction that is not actually present, or that arrived by widening
--    something it was supposed to leave alone.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  qandeel_fn constant text := 'public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[])';
  grant_fn constant text := 'public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid)';
  entry_fn constant text := 'public.resolve_shared_world_history_visibility_v1(uuid, uuid)';
  closed_fn constant text := 'public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid)';
  reconcile_fn constant text := 'public.reconcile_shared_world_material_historical_authority_v1()';
  target_fn text;
  target_role text;
  body text;
  p record;
BEGIN
  -- =========================================================================
  -- THE PRODUCER
  -- =========================================================================
  SELECT pr.prosrc, pr.proowner::regrole::text AS owner, pr.prosecdef, pr.provolatile, pr.proconfig,
         pr.proargnames, pr.proargmodes
    INTO p FROM pg_proc pr WHERE pr.oid = qandeel_fn::regprocedure;
  IF NOT FOUND THEN RAISE EXCEPTION 'QAN-CW-REM-01: % must exist', qandeel_fn; END IF;
  body := p.prosrc;

  -- THE SIGNATURE AND RESULT SHAPE ARE UNCHANGED. Both pg_get_function_arguments
  -- forms mis-describe a RETURNS TABLE function, so the catalog arrays are read
  -- directly: 14 inputs and 11 result columns, exactly as migration 0090 shipped
  -- them and migration 0118 preserved them.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = 'commit_shared_world_qandeel_material_v1') <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the QANDEEL commit core must stay ONE function: no overload was authorized';
  END IF;
  IF (SELECT count(*) FROM unnest(p.proargnames, p.proargmodes) AS a(name, mode) WHERE a.mode = 'i') <> 14
     OR (SELECT count(*) FROM unnest(p.proargnames, p.proargmodes) AS a(name, mode) WHERE a.mode = 't') <> 11 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the QANDEEL commit core must keep its exact 14 inputs and 11 result columns';
  END IF;
  -- AND THE INPUT LIST IS THE EXACT FROZEN ONE, pinned by name and position
  -- rather than by a word list. An authority correction that accepted a claim
  -- from its caller would be the opposite of a correction - but two frozen
  -- parameters are legitimately NAMED for authority and audience, because they
  -- carry the frozen I-03 revalidation and audience-snapshot EVIDENCE
  -- references. Only the exact list can tell those apart from a new claim, so
  -- the exact list is what is pinned.
  IF (SELECT array_agg(a.name ORDER BY a.n)
        FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(name, mode, n)
       WHERE a.mode = 'i')
     <> ARRAY['p_command_id', 'p_world_id', 'p_material_id', 'p_history_item_id',
              'p_material_kind', 'p_body_text',
              'p_effective_context_ref', 'p_output_digest', 'p_source_disclosure_gate_ref',
              'p_authority_revalidation_ref', 'p_readiness_ref', 'p_audience_snapshot_ref',
              'p_material_source_ids', 'p_reasoning_source_refs'] THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the QANDEEL commit core must keep the EXACT frozen input list: no actor, approver, viewer or authority claim may be added to it';
  END IF;

  -- THE CORRECTION ITSELF, PINNED IN FULL. All THREE arms are pinned, because
  -- pinning one arm of a three-armed CASE is what let the defective arm ship.
  IF body !~ 'WHEN reasoning_edges > 0 THEN ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: a reasoning dependency must still record an unresolvable additional human requirement as unresolved';
  END IF;
  IF body !~ 'WHEN approvers > 0 THEN ''RESOLVED_EXACT_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: known exact material owners must still resolve the exact human requirement';
  END IF;
  -- AND AN UNRESOLVED SOURCE MUST REACH THE TARGET. Without this arm the
  -- unresolved state is launderable in one MATERIAL_DEPENDENCY edge, and then
  -- transitively, which would make the correction above cosmetic for every
  -- descendant. It is pinned BEFORE the known-owner arm, because the order is
  -- the semantics: known owners must not answer an unknown requirement.
  IF body !~ 'WHEN unresolved_sources > 0 THEN ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: a MATERIAL_DEPENDENCY source whose own additional human requirement is unresolved must make its target unresolved too';
  END IF;
  IF strpos(body, 'WHEN unresolved_sources > 0') > strpos(body, 'WHEN approvers > 0') THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the unresolved-source arm must be evaluated BEFORE the known-owner arm';
  END IF;
  -- AND IT MUST BE DERIVED FROM THE SOURCE AUTHORITY RELATION, positively, with
  -- absent metadata failing closed exactly as the frozen Public gate does.
  IF body !~ 'INTO unresolved_sources'
     OR body !~ 'FROM public\.shared_world_material_historical_authority a'
     OR body !~ 'a\.resolution_state IN \(''RESOLVED_EXACT_HUMAN_REQUIREMENT'''
     OR body !~ 'NOT EXISTS \(SELECT 1 FROM public\.shared_world_material_historical_authority a' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: source authority must be read from the canonical relation, with missing metadata failing closed';
  END IF;
  IF body !~ 'ELSE ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'' END;' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: a QANDEEL commit with no enumerable required human must record UNRESOLVED, never a proven-empty requirement';
  END IF;
  -- AND THE RESOLUTION CAN NO LONGER REACH THE PROVEN-EMPTY STATE AT ALL. The
  -- assignment is bounded by its own terminating semicolon, so this is a claim
  -- about the CASE rather than about the whole body - the mode derivation below
  -- it still names the value, and still should.
  IF body ~ 'authority_resolution := CASE[^;]*RESOLVED_NO_HUMAN_REQUIREMENT' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: no arm of the authority resolution may reach RESOLVED_NO_HUMAN_REQUIREMENT: this repository can positively prove no such clearance';
  END IF;
  -- THE MODE DERIVATION IS UNCHANGED, so the rule "approval-free is written ONLY
  -- for a genuinely resolved empty requirement" survives verbatim and a later
  -- reviewed resolver re-enables it without reopening this file.
  IF body !~ 'authority_mode := CASE WHEN authority_resolution = ''RESOLVED_NO_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the approval-free mode must still be derived from a genuinely resolved empty requirement and nothing else';
  END IF;
  -- PROVENANCE IS UNCHANGED AND STILL WRITTEN. INDEPENDENT_TARGET_TRUTH remains
  -- what it always was - a statement about SOURCES - and is never an authority
  -- clearance. Removing it would have destroyed true provenance to fix an
  -- authority defect.
  IF body !~ 'IF material_edges = 0 AND reasoning_edges = 0 THEN'
     OR body !~ '''INDEPENDENT_TARGET_TRUTH''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: a zero-dependency target must still persist INDEPENDENT_TARGET_TRUTH provenance';
  END IF;
  -- AND THE REST OF THE 0118 POSTURE IS STILL IN PLACE, clause by clause, so a
  -- replacement that also quietly changed something else cannot deploy.
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'QAN-CW-REM-01: % must be owned by postgres', qandeel_fn; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'QAN-CW-REM-01: % must be SECURITY DEFINER', qandeel_fn; END IF;
  IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'QAN-CW-REM-01: % mutates and must be VOLATILE', qandeel_fn; END IF;
  IF NOT coalesce(p.proconfig @> ARRAY['search_path=']
               OR p.proconfig @> ARRAY['search_path=""'], false) THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: % must pin an empty search_path', qandeel_fn;
  END IF;
  IF body ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the QANDEEL commit core derives no human: a system actor is never a consent or ownership principal';
  END IF;
  IF body !~ 'IF world\.lifecycle <> ''ACTIVE'' THEN'
     OR body !~ 'ELSIF world\.phase = ''INTRODUCTION'' THEN'
     OR body !~ 'r\.world_id = p_world_id AND r\.introduction_status = ''ACTIVE'''
     OR body !~ 'IF world\.phase = ''INTRODUCTION'' AND array_length\(audience, 1\) <> 2 THEN'
     OR body !~ 'ELSIF world\.phase <> ''STANDARD'' THEN' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the I-07D Introduction extension must survive this correction unchanged';
  END IF;
  IF body !~ 'FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: % must still lock the exact World row FIRST', qandeel_fn;
  END IF;
  IF body !~ 'public\.resolve_shared_world_human_audience_snapshot_v1\(p_world_id\)' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: % must still derive its audience through the frozen I-03D boundary', qandeel_fn;
  END IF;
  IF (SELECT count(*) FROM regexp_matches(body, 'clock_timestamp\(\)', 'g')) <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: % must still read ONE database-owned instant, exactly once', qandeel_fn;
  END IF;
  IF body ~* 'DELETE FROM' OR body ~* 'pg_advisory|LOCK TABLE' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: % destroys nothing and takes only canonical row locks', qandeel_fn;
  END IF;

  -- =========================================================================
  -- ASSURE-F04: NO STATEMENT LOCKS A ROW IN A WORLD IT DOES NOT HOLD.
  --
  -- The finding was provisional and is REPRODUCED on real PostgreSQL by this
  -- slice's verifier, which is what authorizes the correction below. It is one
  -- scoping predicate per statement: a globally unique row identity is never
  -- locked without also pinning the World the transaction already knows.
  -- =========================================================================
  IF body !~ 'WHERE m\.id = ANY\(sources\) AND m\.world_id = p_world_id ORDER BY m\.id FOR UPDATE' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the QANDEEL producer must lock its sources only inside the World it locked first';
  END IF;
  IF strpos(body, 'WHERE m.id = ANY(sources) AND m.world_id <> p_world_id')
     > strpos(body, 'WHERE m.id = ANY(sources) AND m.world_id = p_world_id ORDER BY m.id FOR UPDATE')
     OR strpos(body, 'WHERE m.id = ANY(sources) AND m.world_id <> p_world_id') = 0 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: World containment must be decided BEFORE the source lock, so the refusal class is unchanged';
  END IF;
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.prepare_shared_world_history_package_v1(uuid, uuid, uuid, uuid[])'::regprocedure;
  IF body !~ 'WHERE i\.id = ANY\(selected\) AND i\.world_id = p_world_id ORDER BY i\.id FOR UPDATE' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: history package preparation must lock items only inside the World it locked first';
  END IF;
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])'::regprocedure;
  IF body !~ 'AND m\.world_id = ANY\(p_shared_source_world_ids\) ORDER BY m\.id FOR SHARE'
     OR body !~ 'AND i\.world_id = ANY\(p_shared_source_world_ids\)' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: Public package preparation must lock Shared rows only inside the Worlds it named and locked';
  END IF;
  -- `\s*` rather than an explicit newline: a needle that spells its own line
  -- break stops matching the moment a checkout uses different line endings.
  IF body !~ 'FROM public\.shared_worlds w\s*WHERE w\.id = ANY\(p_shared_source_world_ids\) ORDER BY w\.id FOR SHARE' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: and it must still take those World rows FIRST';
  END IF;

  -- =========================================================================
  -- THE CONSUMERS: every widening boundary reads CURRENT authority state.
  -- =========================================================================
  -- The frozen preparation-time trigger is still installed and still refuses
  -- exactly the unresolved state. This migration adds no second gate beside it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.shared_world_history_package_manifest_items'::regclass
       AND NOT t.tgisinternal AND t.tgname = 'shared_world_material_historical_widening_gate'
       AND t.tgenabled <> 'D') THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the frozen preparation-time widening gate must still be installed and enabled';
  END IF;

  SELECT pr.prosrc INTO body FROM pg_proc pr WHERE pr.oid = grant_fn::regprocedure;
  IF body !~ 'public\.shared_world_material_historical_authority'
     OR body !~ 'SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the grant boundary must revalidate current historical authority at the instant it widens';
  END IF;
  -- IT IS STILL THE SAME PRIMITIVE. No granting actor appeared, the World row is
  -- still taken first, and the approval-completeness rules are still there.
  IF body ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: a history grant still has no granting actor: the authority IS the completed approval set';
  END IF;
  IF body !~ 'FROM public\.shared_worlds w WHERE w\.id = target_world FOR UPDATE'
     OR body !~ 'SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the grant boundary must keep its frozen World-first order and its approval-completeness rules';
  END IF;
  IF (SELECT count(*) FROM regexp_matches(body, 'clock_timestamp\(\)', 'g')) <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the grant boundary must still read ONE database-owned instant, exactly once';
  END IF;

  SELECT pr.prosrc, pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = entry_fn::regprocedure;
  body := p.prosrc;
  IF p.provolatile <> 's' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the ONE historical visibility entry point must stay STABLE';
  END IF;
  IF body !~ 'public\.shared_world_material_historical_authority' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the widened visibility basis must consume current historical authority state';
  END IF;
  -- THE BASELINE BASIS IS UNTOUCHED, in both frozen modes, with its exact
  -- temporal bounds. This is the clause that makes the correction a narrowing of
  -- WIDENING rather than a loss of ordinary participation.
  IF body !~ 'i\.occurred_at >= e\.joined_at'
     OR body !~ 'e\.ended_at IS NULL OR i\.occurred_at <= e\.ended_at'
     OR body !~ 'shared_world_history_item_baseline_viewers' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: membership-period visibility must survive this correction exactly as frozen';
  END IF;
  -- AND THE GRANT BASIS IS STILL STANDARD-ONLY: it appears exactly once, which
  -- is what proves the Introduction branch did not acquire selective history.
  IF (SELECT count(*) FROM regexp_matches(body, 'shared_world_history_package_manifest_items', 'g')) <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the explicit grant basis must remain exactly once, in the STANDARD branch alone';
  END IF;
  IF body !~ 'SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE'
     OR body !~ 'resolve_shared_world_closed_history_visibility_v1' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the ONE entry point must still refuse an unspelled World mode and still delegate closed viewing';
  END IF;

  SELECT pr.prosrc, pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = closed_fn::regprocedure;
  body := p.prosrc;
  IF p.provolatile <> 's' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the closed reader must stay STABLE';
  END IF;
  IF body ~ 'shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: closed viewing is entitlement, never membership: the reader must not consult episodes';
  END IF;
  IF body !~ 'shared_world_standard_closed_view_entitlement_items'
     OR body !~ 'introduction_closed_view_entitlement_items'
     OR body !~ 'i\.availability_state = ''AVAILABLE''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the closed reader must keep both frozen branches and can never reconstruct unavailable source';
  END IF;
  IF body !~ 'public\.shared_world_material_historical_authority' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: a closure snapshot must not preserve a widening whose authority is now unresolved';
  END IF;

  -- THE PUBLIC CHAIN IS CONSUMED, NOT REPLACED. Both frozen derivations still
  -- require a RESOLVED source state and still raise the frozen unresolved class,
  -- which is the entire Public half of this remediation.
  FOREACH target_fn IN ARRAY ARRAY['public.prepare_public_experience_manifest_v1',
                                   'public.derive_public_publication_authority_v1'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname = split_part(target_fn, '.', 2)
         AND pr.prosrc ~ 'public\.shared_world_material_historical_authority'
         AND pr.prosrc ~ 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED') THEN
      RAISE EXCEPTION 'QAN-CW-REM-01: % must still fail Public inclusion closed on unresolved source authority', target_fn;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
     WHERE n.nspname = 'public' AND pr.proname = 'derive_public_continuing_eligibility_v1'
       AND pr.prosrc ~ 'derive_public_publication_authority_v1'
       AND pr.prosrc ~ 'PUBLICATION_AUTHORITY_INVALIDATED') THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: continuing Public eligibility must still consume the ONE authority derivation and fail closed on it';
  END IF;

  -- =========================================================================
  -- THE RECONCILIATION, AND THE POSTURE OF EVERYTHING THIS FILE TOUCHED
  -- =========================================================================
  SELECT pr.prosrc INTO body FROM pg_proc pr WHERE pr.oid = reconcile_fn::regprocedure;
  -- IT MOVES ONE COLUMN OF ONE RELATION, IN ONE DIRECTION.
  IF body !~ 'UPDATE public\.shared_world_material_historical_authority'
     OR body !~ 'SET resolution_state = ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'''
     OR body !~ 'a\.resolution_state <> ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the reconciliation must move authority forward in the fail-closed direction, and nothing else';
  END IF;
  -- AND IT MUST REACH THE LAUNDERING DESCENDANTS, transitively, to a fixed point
  -- over MATERIAL_DEPENDENCY. Repairing an ancestor while leaving its
  -- descendants exactly as they were would repair nothing that can be widened.
  IF body !~ 'WITH RECURSIVE tainted'
     OR body !~ 'JOIN tainted t ON t\.material_id = d\.source_material_id'
     OR body !~ 'd\.dependency_kind = ''MATERIAL_DEPENDENCY''' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the reconciliation must propagate transitively over MATERIAL_DEPENDENCY to a fixed point';
  END IF;
  IF body !~ 'INTO laundered' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the reconciliation must report the residue that still claims an unsupported exact resolution';
  END IF;
  IF (SELECT count(*) FROM regexp_matches(body, 'UPDATE public\.', 'g')) <> 1
     OR body ~* 'DELETE FROM|INSERT INTO|TRUNCATE' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the reconciliation writes exactly one relation and destroys nothing';
  END IF;
  -- AND IT NEVER REWRITES IMMUTABLE SOURCE HISTORY. Provenance is READ, to walk
  -- the closure, and never written - the ONE UPDATE asserted above is the whole
  -- of what this function writes - so the dependency relation is excluded from
  -- this ban and given its own, narrower one below.
  -- The concatenation is PARENTHESISED on purpose: `~` and `||` share a
  -- precedence class in PostgreSQL, so `body ~ 'a' || 'b'` parses as
  -- `(body ~ 'a') || 'b'` and fails at run time trying to read a boolean as text.
  IF body ~ ('authority_requirement_mode|shared_world_history_items'
     || '|shared_world_history_item_baseline_viewers|shared_world_history_item_required_approvers'
     || '|_material_bodies|DISABLE TRIGGER|ALTER TABLE') THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the reconciliation rewrites no source history and disables no frozen immutability guard';
  END IF;
  IF body ~ 'UPDATE public\.shared_world_material_dependencies' THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: the reconciliation never rewrites provenance: a dependency edge is evidence, not a thing a correction edits';
  END IF;
  -- THE POST-STATE IS PROVEN, not assumed: nothing anywhere still records a
  -- clearance this repository cannot establish.
  IF EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority a
              WHERE a.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT') THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: no Shared material may still record a proven-empty human requirement after this migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shared_world_material_historical_authority a
      JOIN public.shared_world_materials m ON m.id = a.material_id
     WHERE a.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
       AND m.producer_kind = 'QANDEEL'
       AND EXISTS (
         SELECT 1 FROM public.shared_world_material_dependencies d
          WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'
            AND d.target_material_id = a.material_id
            AND NOT EXISTS (SELECT 1 FROM public.shared_world_material_historical_authority sa
                             WHERE sa.material_id = d.source_material_id
                               AND sa.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'))) THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: no Shared material may still claim an exact resolution its own MATERIAL_DEPENDENCY ancestry does not support';
  END IF;

  -- NO APPLICATION ROLE REACHES ANY OF IT, and the ONE frozen resolver grant is
  -- exactly where it was.
  FOREACH target_fn IN ARRAY ARRAY[qandeel_fn, grant_fn, closed_fn, reconcile_fn] LOOP
    IF has_function_privilege('public', target_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'QAN-CW-REM-01: PUBLIC must not execute %', target_fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, target_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'QAN-CW-REM-01: % must not execute % before the CW2-08 Launch Gate exists', target_role, target_fn;
      END IF;
    END LOOP;
  END LOOP;
  IF has_function_privilege('public', entry_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: PUBLIC must not execute the ONE historical visibility entry point';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, entry_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'QAN-CW-REM-01: % must not execute the ONE historical visibility entry point', target_role;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', entry_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: service_role must still execute the ONE historical visibility entry point';
  END IF;

  -- ONE CANONICAL SHARED TRUTH MODEL, unchanged. Replacing a core must not have
  -- created a second producer of a material, a history item or a body store.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'INSERT INTO public\.shared_world_materials\y') <> 3
     OR (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
            AND pr.prosrc ~ 'INSERT INTO public\.shared_world_history_items\y') <> 3 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: exactly the three reviewed producers may write a Shared material and its history item';
  END IF;
  -- AND EXACTLY ONE FUNCTION MAY MOVE HISTORICAL AUTHORITY STATE AT ALL.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public'
         AND pr.prosrc ~ 'UPDATE public\.shared_world_material_historical_authority') <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-01: exactly one reviewed function may move a historical authority resolution';
  END IF;
END$$;

COMMIT;
