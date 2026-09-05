-- T-03B3 - Thread Lifecycle + Cross-Session Continuity v1
-- (Active / Dormant / Reopened), one Architecture-sized task.
--
-- An Established Thread is a persistent user/world object. Once established it
-- never returns to Mention or Emerging. This migration makes the FINAL
-- Thread-layer truth of every committed CU durable while preserving the
-- frozen Stage-6 same-SP order:
--
--   1. CU is committed / receives SP
--   2. references + conversational focus + Emerging Focus continuity   [B1, seq 1]
--   3. the FINAL Thread layer                                         [B2 + B3, seq 2]
--        new Thread + permanent Home                (0068, reused)
--        Session focus -> existing Thread binding   (this migration)
--        Session lifecycle transitions              (this migration)
--   4. effective LF                                                   [T-03D]
--
-- Architecture Decisions frozen here:
--
--   B3-01  Lifecycle state is SESSION-LOCAL; Thread identity, Home and identity
--          evidence are USER/WORLD-GLOBAL. SP values of different Sessions are
--          not comparable, so there is deliberately NO global current lifecycle
--          column, NO global Session order, NO cross-Session SP and NO
--          timestamp-based lifecycle ordering anywhere below. A Thread has one
--          canonical id, one permanent Home, one canonical placement, and as
--          many Session temporal footprints as conversation truthfully returns
--          to it. Its first appearance in a NEW Session binds it and starts
--          that Session's lifecycle at ACTIVE; it is never a cross-Session
--          "reopening", because no comparable cross-Session order exists.
--   B3-02  Cross-Session continuity is SEMANTIC IDENTITY resolution: a later
--          Session Emerging Focus binds to an existing Thread only when the
--          current focus refers to the SAME canonical conversational locus.
--          Same name, repeated wording, similarity, proximity, recency,
--          importance and "best match" are never identity. Same-name
--          ambiguity stays ambiguity and BLOCKS duplicate Thread creation.
--   B3-03  Candidate screening is EXHAUSTIVE and DETERMINISTIC: every
--          canonical Thread dossier of the user, in `thread_id::text COLLATE
--          "C"` order, in fixed-size pages, against one exact user/world
--          identity version. No retrieval heuristic can silently drop a
--          Thread.
--   B3-04  The FINAL Thread-layer capture of this migration supersedes the
--          B2-only capture of 0068 for B3-enabled batches. 0068 is not wrong:
--          it remains valid implementation-layer evidence and its ONE
--          structural authority is REUSED, never rewritten.
--   B3-05  Lifecycle transitions are DETERMINISTIC over canonical B1
--          functions, attention, focus -> Thread bindings and the exact prior
--          committed-CU sequence. No lifecycle model, no timer, no wall-clock
--          duration, no importance, no analytical/background activity. The
--          database RE-DERIVES the transitions of every CU from the durable
--          rows and refuses any payload that differs.
--
-- Same-SP rule (frozen): B1 stays sequence 1; the whole Thread layer reserves
-- AT MOST ONE additional sequence, 2, when ANY durable Thread-layer change
-- happens at a CU (new Thread, new Session binding, lifecycle transition(s)),
-- and every Thread-layer row of that CU shares it. A baseline ACTIVE is
-- durable through the establishment / binding row itself and never costs a
-- lifecycle row. T-03D later reads: no Thread-layer event -> LF may be 2,
-- Thread-layer event -> LF may be 3. LF is not implemented here.
--
-- AF66-01 lock order, provable from the writer body:
--
--   Session Semantic Clock FOR UPDATE                     <- FIRST
--     -> source turn -> B1 semantic rows
--     -> user/world Thread Identity Clock                 (technical version)
--     -> user/world spatial authority (NEW establishment only)
--     -> Thread / Home / focus-binding / lifecycle rows
--
-- Production-inert: every new writer, coordinator, read, page and helper is
-- executable by NO application role; the T-03A2 grants are untouched;
-- ConversationService / ConversationModule are unchanged; no mobile schema
-- changes. T-03D owns the final cutover. Migrations 0064-0069 are byte-identical.
--
-- Audit timestamps exist only as audit metadata. No timestamp decides SP,
-- identity, lifecycle, availability or ordering anywhere below.

BEGIN;

-- ===========================================================================
-- 0. Preconditions: the frozen UTF-8 contract and the 0065 / 0066 / 0068 /
--    0069 objects this migration extends.
-- ===========================================================================
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03B3 requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF to_regprocedure('public.reserve_session_same_sp_event_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint)') IS NULL
     OR to_regprocedure('public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb)') IS NULL
     OR to_regprocedure('public.persist_conversation_thread_establishment_v1(public.conversation_units,uuid,jsonb,bigint,numeric,numeric,integer,numeric,numeric,bytea,bytea)') IS NULL
     OR to_regprocedure('public.compute_canonical_home_placement_v1(text,text,text,text[],text[],numeric[],numeric[])') IS NULL
     OR to_regprocedure('public.canonical_thread_identities_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.canonical_uuid_v5_v1(uuid,text)') IS NULL
     OR to_regprocedure('public.conversation_thread_batch_state_v1(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)') IS NULL
     OR to_regprocedure('public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid)') IS NULL
     OR to_regclass('public.conversation_threads') IS NULL
     OR to_regclass('public.conversation_thread_homes') IS NULL
     OR to_regclass('public.conversation_thread_commit_batches') IS NULL
     OR to_regclass('public.conversation_emerging_focuses') IS NULL
     OR to_regclass('public.conversation_reference_resolutions') IS NULL THEN
    RAISE EXCEPTION 'T-03B3 requires the T-03A2 seam, the T-03B1b1 focus substrate, the T-03B2b2 Thread substrate and the T-03B2b3 reads'
      USING ERRCODE='55000';
  END IF;
END$$;

-- ===========================================================================
-- 1. The user/world Thread Identity Clock: a TECHNICAL optimistic version of
--    the user's Thread identity dossiers. It is NOT Product time, NOT SP, NOT
--    LH, NOT knowledge time and NOT a global Session order. It advances
--    exactly when a dossier changes (a new canonical Thread, or a new
--    SESSION_CONTINUITY binding adding identity evidence) and never for a
--    lifecycle-only transition. Lazily inserted, then locked FOR UPDATE -
--    always AFTER the Session Semantic Clock (AF66-01).
-- ===========================================================================
CREATE TABLE public.conversation_world_thread_identity_clocks (
  user_id uuid PRIMARY KEY,
  current_version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT world_thread_identity_clocks_version_check CHECK (current_version >= 0)
);

CREATE FUNCTION public.guard_conversation_world_thread_identity_clock_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_IS_PERMANENT' USING ERRCODE='55000',
      DETAIL='The user/world Thread identity version is a permanent technical row: DELETE is refused for every role.';
  END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at OR NEW.current_version <> OLD.current_version + 1 THEN
    RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_IS_MONOTONIC' USING ERRCODE='55000',
      DETAIL='The user/world Thread identity version only ever advances by exactly one; nothing else on the row may change.';
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER conversation_world_thread_identity_clocks_guard
  BEFORE UPDATE OR DELETE ON public.conversation_world_thread_identity_clocks
  FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_world_thread_identity_clock_v1();

-- ===========================================================================
-- 2. Session Emerging Focus -> canonical Thread binding.
--
--    One Session Emerging Focus binds to at most ONE Thread forever (it is
--    the primary key). One Thread binds to at most ONE focus per Session
--    (UNIQUE(thread_id, session_id)): within a Session, B1 already decided
--    that two different Emerging Focus identities are two different loci, so
--    a second same-Session binding of one Thread is never admissible. The
--    original establishment binding is ESTABLISHMENT; a later Session's
--    identity reuse is SESSION_CONTINUITY, which never creates a Home and
--    never rewrites `conversation_threads.grounding_emerging_focus_id`.
-- ===========================================================================
CREATE TABLE public.conversation_thread_focus_bindings (
  emerging_focus_id uuid PRIMARY KEY,
  binding_id uuid NOT NULL UNIQUE,
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  bound_cu_id uuid NOT NULL,
  bound_sp integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  binding_kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_focus_bindings_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_focus_bindings_focus_fk
    FOREIGN KEY (emerging_focus_id) REFERENCES public.conversation_emerging_focuses (id) ON DELETE RESTRICT,
  CONSTRAINT thread_focus_bindings_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_focus_bindings_cu_fk
    FOREIGN KEY (bound_cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT thread_focus_bindings_sp_fk
    FOREIGN KEY (session_id, bound_sp) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT thread_focus_bindings_kind_check CHECK (binding_kind IN ('ESTABLISHMENT', 'SESSION_CONTINUITY')),
  CONSTRAINT thread_focus_bindings_position_check CHECK (bound_sp >= 1 AND same_sp_event_sequence = 2),
  CONSTRAINT thread_focus_bindings_one_per_session UNIQUE (thread_id, session_id)
);

CREATE INDEX thread_focus_bindings_thread_idx ON public.conversation_thread_focus_bindings (thread_id);
CREATE INDEX thread_focus_bindings_session_idx ON public.conversation_thread_focus_bindings (session_id, bound_sp);

-- ===========================================================================
-- 3. Append-only user/world Thread identity evidence: the source-bound
--    surfaces (exact committed wording of canonical RESOLVED B1 references
--    whose handle grounds the bound Emerging Focus) that let a later Session
--    defend "this is the SAME canonical locus". No generated alias, no
--    normalized key, no score. The same reference can never be evidence for
--    two Threads (UNIQUE over (session_id, cu_id, reference_index)).
-- ===========================================================================
CREATE TABLE public.conversation_thread_identity_evidence (
  thread_id uuid NOT NULL,
  evidence_ordinal integer NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  cu_id uuid NOT NULL,
  reference_index integer NOT NULL,
  exact_surface text NOT NULL,
  source_kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_identity_evidence_pkey PRIMARY KEY (thread_id, evidence_ordinal),
  CONSTRAINT thread_identity_evidence_episode_unique UNIQUE (thread_id, session_id, cu_id, reference_index),
  CONSTRAINT thread_identity_evidence_reference_unique UNIQUE (session_id, cu_id, reference_index),
  CONSTRAINT thread_identity_evidence_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_identity_evidence_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_identity_evidence_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT thread_identity_evidence_reference_fk
    FOREIGN KEY (cu_id, reference_index) REFERENCES public.conversation_reference_resolutions (cu_id, reference_index) ON DELETE RESTRICT,
  CONSTRAINT thread_identity_evidence_ordinal_check CHECK (evidence_ordinal >= 0 AND reference_index >= 0),
  CONSTRAINT thread_identity_evidence_surface_check CHECK (length(exact_surface) > 0),
  CONSTRAINT thread_identity_evidence_kind_check CHECK (source_kind IN ('ESTABLISHMENT', 'SESSION_BINDING'))
);

CREATE INDEX thread_identity_evidence_cu_idx ON public.conversation_thread_identity_evidence (cu_id);

-- ===========================================================================
-- 4. Append-only Session-local lifecycle transitions. Only transitions are
--    rows: the baseline ACTIVE of a Session footprint is the binding itself.
--    Allowed in v1: ACTIVE -> DORMANT, REOPENED -> DORMANT, DORMANT -> REOPENED,
--    REOPENED -> ACTIVE. Persisting the history is NOT a visual scar; a later
--    UI projects the then-valid state only. At most one transition per
--    Thread per CU, and every transition of one CU shares same-SP sequence 2.
-- ===========================================================================
CREATE TABLE public.conversation_thread_lifecycle_events (
  event_id uuid PRIMARY KEY,
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  cu_id uuid NOT NULL,
  commit_batch_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  transition_ordinal integer NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_lifecycle_events_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_lifecycle_events_binding_fk
    FOREIGN KEY (thread_id, session_id) REFERENCES public.conversation_thread_focus_bindings (thread_id, session_id) ON DELETE RESTRICT,
  CONSTRAINT thread_lifecycle_events_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_lifecycle_events_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT thread_lifecycle_events_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT thread_lifecycle_events_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT thread_lifecycle_events_state_check CHECK (
    from_state IN ('ACTIVE', 'DORMANT', 'REOPENED') AND to_state IN ('ACTIVE', 'DORMANT', 'REOPENED')),
  CONSTRAINT thread_lifecycle_events_transition_check CHECK (
    (from_state = 'ACTIVE' AND to_state = 'DORMANT')
    OR (from_state = 'REOPENED' AND to_state = 'DORMANT')
    OR (from_state = 'DORMANT' AND to_state = 'REOPENED')
    OR (from_state = 'REOPENED' AND to_state = 'ACTIVE')),
  CONSTRAINT thread_lifecycle_events_reason_check CHECK (
    (to_state = 'DORMANT' AND reason_code IN ('EXPLICIT_FOCUS_SHIFT', 'SUSTAINED_DEPARTURE'))
    OR (to_state = 'REOPENED' AND reason_code = 'GENUINE_RETURN')
    OR (to_state = 'ACTIVE' AND reason_code = 'CONTINUED_ANCHORING')),
  CONSTRAINT thread_lifecycle_events_position_check CHECK (
    session_position >= 1 AND same_sp_event_sequence = 2 AND transition_ordinal >= 0),
  CONSTRAINT thread_lifecycle_events_one_per_cu UNIQUE (session_id, cu_id, thread_id),
  CONSTRAINT thread_lifecycle_events_ordinal_unique UNIQUE (session_id, session_position, transition_ordinal)
);

CREATE INDEX thread_lifecycle_events_thread_session_idx
  ON public.conversation_thread_lifecycle_events (thread_id, session_id, session_position DESC, transition_ordinal DESC);

-- ===========================================================================
-- 5. The FINAL Thread-layer capture: one batch row per committed-CU batch and
--    one unit result per committed CU. This is the B3 completeness authority
--    for B3-enabled batches (B3-04). The B2 capture of 0068 is neither
--    deleted nor rewritten; it stays implementation-layer evidence.
--
--    `canonical_fingerprint` is DB-derived SHA-256 over the canonical ordered
--    B3 payload plus provenance; SP allocation, the same-SP sequence and the
--    audit timestamp are excluded because they are allocation results.
-- ===========================================================================
CREATE TABLE public.conversation_thread_semantic_commit_batches (
  commit_batch_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  unit_count integer NOT NULL,
  establishment_count integer NOT NULL,
  continuity_binding_count integer NOT NULL,
  lifecycle_transition_count integer NOT NULL,
  ambiguous_count integer NOT NULL,
  canonical_fingerprint bytea NOT NULL,
  continuity_evaluator_version text NOT NULL,
  continuity_policy_version text NOT NULL,
  continuity_provider text NOT NULL,
  continuity_model text NOT NULL,
  continuity_prompt_version text NOT NULL,
  continuity_schema_version integer NOT NULL,
  lifecycle_reducer_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_semantic_batches_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_batches_thread_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_thread_commit_batches (commit_batch_id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_batches_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_batches_turn_fk
    FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_batches_count_check CHECK (
    unit_count >= 0 AND establishment_count >= 0 AND continuity_binding_count >= 0
    AND lifecycle_transition_count >= 0 AND ambiguous_count >= 0
    AND establishment_count + continuity_binding_count + ambiguous_count <= unit_count),
  CONSTRAINT thread_semantic_batches_digest_check CHECK (length(canonical_fingerprint) = 32),
  CONSTRAINT thread_semantic_batches_provenance_check CHECK (
    length(btrim(continuity_evaluator_version)) > 0 AND length(continuity_evaluator_version) <= 64 AND
    length(btrim(continuity_policy_version)) > 0 AND length(continuity_policy_version) <= 64 AND
    length(btrim(continuity_provider)) > 0 AND length(continuity_provider) <= 64 AND
    length(btrim(continuity_model)) > 0 AND length(continuity_model) <= 128 AND
    length(btrim(continuity_prompt_version)) > 0 AND length(continuity_prompt_version) <= 64 AND
    continuity_schema_version >= 1 AND
    length(btrim(lifecycle_reducer_version)) > 0 AND length(lifecycle_reducer_version) <= 64)
);

CREATE TABLE public.conversation_thread_semantic_unit_results (
  cu_id uuid PRIMARY KEY,
  commit_batch_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  session_position integer NOT NULL,
  outcome text NOT NULL,
  emerging_focus_id uuid,
  thread_id uuid,
  candidate_thread_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  thread_layer_event_sequence bigint,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_semantic_units_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_units_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_thread_semantic_commit_batches (commit_batch_id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_units_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_units_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_units_focus_fk
    FOREIGN KEY (emerging_focus_id) REFERENCES public.conversation_emerging_focuses (id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_units_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_semantic_units_outcome_check CHECK (outcome IN (
    'NO_THREAD_ACTION', 'ESTABLISH_NEW', 'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING', 'IDENTITY_AMBIGUOUS')),
  CONSTRAINT thread_semantic_units_shape_check CHECK (
    (outcome = 'NO_THREAD_ACTION' AND thread_id IS NULL AND cardinality(candidate_thread_ids) = 0)
    OR (outcome IN ('ESTABLISH_NEW', 'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING')
        AND thread_id IS NOT NULL AND emerging_focus_id IS NOT NULL AND cardinality(candidate_thread_ids) = 0)
    OR (outcome = 'IDENTITY_AMBIGUOUS' AND thread_id IS NULL AND emerging_focus_id IS NOT NULL AND cardinality(candidate_thread_ids) >= 2)),
  CONSTRAINT thread_semantic_units_sequence_check CHECK (
    session_position >= 1 AND (thread_layer_event_sequence IS NULL OR thread_layer_event_sequence = 2)),
  CONSTRAINT thread_semantic_units_sp_unique UNIQUE (session_id, session_position)
);

-- ===========================================================================
-- 6. Append-only enforcement, binding the owner too, exactly as 0064-0068 do.
-- ===========================================================================
CREATE FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Focus bindings, identity evidence, lifecycle transitions and the final Thread-layer capture are append-only truth: UPDATE and DELETE are refused for every role, including the table owner. There is no rebind, no merge and no repair path.';
END;$$;

CREATE TRIGGER conversation_thread_focus_bindings_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_focus_bindings
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1();
CREATE TRIGGER conversation_thread_identity_evidence_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_identity_evidence
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1();
CREATE TRIGGER conversation_thread_lifecycle_events_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1();
CREATE TRIGGER conversation_thread_semantic_commit_batches_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_semantic_commit_batches
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1();
CREATE TRIGGER conversation_thread_semantic_unit_results_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_semantic_unit_results
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1();

-- ===========================================================================
-- 7. Canonical identities of the new rows: the exact RFC 4122 version-5
--    derivation of 0068 (`canonical_uuid_v5_v1`), under two frozen namespaces
--    derived from their documented URIs. The provider never authors either;
--    the database re-derives and requires exact equality.
--
--      focus_binding_id   = uuidV5(BINDING_NAMESPACE,   sessionId + ':' + emergingFocusId + ':' + threadId)
--      lifecycle_event_id = uuidV5(LIFECYCLE_NAMESPACE, sessionId + ':' + cuId + ':' + threadId + ':' + toState)
-- ===========================================================================
CREATE FUNCTION public.canonical_thread_focus_binding_id_v1(p_session_id uuid, p_emerging_focus_id uuid, p_thread_id uuid)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  binding_namespace constant uuid := '194bb7c5-906f-5228-8116-b4c99b34bd76';
BEGIN
  IF p_session_id IS NULL OR p_emerging_focus_id IS NULL OR p_thread_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023';
  END IF;
  RETURN public.canonical_uuid_v5_v1(binding_namespace, p_session_id::text || ':' || p_emerging_focus_id::text || ':' || p_thread_id::text);
END;$$;

CREATE FUNCTION public.canonical_thread_lifecycle_event_id_v1(p_session_id uuid, p_cu_id uuid, p_thread_id uuid, p_to_state text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lifecycle_namespace constant uuid := '9fbd9e6c-f8a4-529b-bd97-46f75cb068d3';
BEGIN
  IF p_session_id IS NULL OR p_cu_id IS NULL OR p_thread_id IS NULL OR p_to_state IS NULL THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023';
  END IF;
  RETURN public.canonical_uuid_v5_v1(lifecycle_namespace, p_session_id::text || ':' || p_cu_id::text || ':' || p_thread_id::text || ':' || p_to_state);
END;$$;

-- ===========================================================================
-- 8. Session-local lifecycle state, DB-derived. NULL when the Thread has no
--    footprint in the Session; the binding itself is the ACTIVE baseline; the
--    latest transition strictly before `p_before_sp` (or all of them) is the
--    then-valid state. No timestamp, no cross-Session order.
-- ===========================================================================
CREATE FUNCTION public.conversation_thread_session_lifecycle_state_v1(p_thread_id uuid, p_session_id uuid, p_before_sp integer DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  latest text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b
                  WHERE b.thread_id = p_thread_id AND b.session_id = p_session_id
                    AND (p_before_sp IS NULL OR b.bound_sp < p_before_sp)) THEN
    RETURN NULL;
  END IF;
  SELECT e.to_state INTO latest
    FROM public.conversation_thread_lifecycle_events e
   WHERE e.thread_id = p_thread_id AND e.session_id = p_session_id
     AND (p_before_sp IS NULL OR e.session_position < p_before_sp)
   ORDER BY e.session_position DESC, e.transition_ordinal DESC
   LIMIT 1;
  RETURN COALESCE(latest, 'ACTIVE');
END;$$;

-- ===========================================================================
-- 9. The canonical relation between ONE committed CU and ONE Thread, read
--    from durable B1 rows and bindings bound strictly before the CU:
--
--      attention_on         the CU's independent attention is a focus bound to the Thread
--      targets_thread       the CU's canonical target_cu_id closes to a CU whose
--                           attention is bound to the Thread
--      local_clarification  LOCAL_CLARIFICATION_OR_CORRECTION anchored to the Thread
--      away                 independent attention elsewhere, not a local
--                           clarification of the Thread
--      explicit_shift       away AND the CU carries FOCUS_SHIFT
--
--    A CU with NO_INDEPENDENT_FOCUS is never "away". Nothing analytical,
--    temporal or graded participates.
-- ===========================================================================
CREATE FUNCTION public.conversation_thread_cu_relation_v1(
  p_cu_id uuid,
  p_thread_id uuid,
  OUT attention_on boolean,
  OUT targets_thread boolean,
  OUT local_clarification boolean,
  OUT away boolean,
  OUT explicit_shift boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  cu public.conversation_units;
  att public.conversation_emerging_focus_attention_events;
  sem public.conversation_unit_focus_semantics;
BEGIN
  SELECT * INTO cu FROM public.conversation_units u WHERE u.id = p_cu_id;
  SELECT * INTO att FROM public.conversation_emerging_focus_attention_events e WHERE e.cu_id = p_cu_id;
  SELECT * INTO sem FROM public.conversation_unit_focus_semantics s WHERE s.cu_id = p_cu_id;
  IF cu.id IS NULL OR att.cu_id IS NULL OR sem.cu_id IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL='A lifecycle relation is only derivable for a committed CU whose canonical B1 semantics are durable.';
  END IF;
  attention_on := att.attention_kind <> 'NO_INDEPENDENT_FOCUS' AND EXISTS (
    SELECT 1 FROM public.conversation_thread_focus_bindings b
     WHERE b.thread_id = p_thread_id AND b.session_id = cu.session_id
       AND b.emerging_focus_id = att.emerging_focus_id AND b.bound_sp < cu.session_position);
  targets_thread := sem.target_cu_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conversation_emerging_focus_attention_events ta
      JOIN public.conversation_thread_focus_bindings b
        ON b.emerging_focus_id = ta.emerging_focus_id AND b.session_id = ta.session_id
     WHERE ta.cu_id = sem.target_cu_id AND ta.attention_kind <> 'NO_INDEPENDENT_FOCUS'
       AND b.thread_id = p_thread_id AND b.bound_sp < cu.session_position);
  local_clarification := att.attention_reason = 'LOCAL_CLARIFICATION_OR_CORRECTION' AND (attention_on OR targets_thread);
  away := att.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS') AND NOT attention_on AND NOT local_clarification;
  explicit_shift := away AND 'FOCUS_SHIFT' = ANY (sem.functions);
END;$$;

-- ===========================================================================
-- 10. The deterministic lifecycle reducer, mirrored in SQL (B3-05). For ONE
--     committed CU it derives every legal transition of every Thread bound in
--     the Session strictly before the CU, from durable rows alone:
--
--       own Thread (the CU's attention focus is bound to it):
--         DORMANT  -> REOPENED   GENUINE_RETURN
--         REOPENED -> ACTIVE     CONTINUED_ANCHORING
--       every other ACTIVE / REOPENED Thread T:
--         explicit_shift(CU, T)                                -> DORMANT  EXPLICIT_FOCUS_SHIFT
--         else REOPENED and anchored (attention_on or targets) -> ACTIVE   CONTINUED_ANCHORING
--         else away(CU, T), not anchored, AND the immediately
--              preceding committed CU away(prev, T), not anchored -> DORMANT  SUSTAINED_DEPARTURE
--
--     Nothing else ever makes a Thread Dormant: one NO_INDEPENDENT_FOCUS CU,
--     one interruption, one local clarification, background analysis or time
--     never do. Results are in `thread_id::text COLLATE "C"` order: storage
--     order, never primacy.
-- ===========================================================================
CREATE FUNCTION public.derive_conversation_thread_lifecycle_transitions_v1(p_cu public.conversation_units)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  binding public.conversation_thread_focus_bindings;
  att public.conversation_emerging_focus_attention_events;
  own_thread uuid;
  current_state text;
  rel record;
  prev_rel record;
  prev_cu uuid;
  out jsonb := '[]'::jsonb;
  transition jsonb;
BEGIN
  SELECT * INTO att FROM public.conversation_emerging_focus_attention_events e WHERE e.cu_id = p_cu.id;
  IF att.cu_id IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000';
  END IF;
  own_thread := NULL;
  IF att.attention_kind <> 'NO_INDEPENDENT_FOCUS' THEN
    SELECT b.thread_id INTO own_thread FROM public.conversation_thread_focus_bindings b
     WHERE b.emerging_focus_id = att.emerging_focus_id AND b.session_id = p_cu.session_id AND b.bound_sp < p_cu.session_position;
  END IF;
  SELECT u.id INTO prev_cu FROM public.conversation_units u
   WHERE u.session_id = p_cu.session_id AND u.session_position = p_cu.session_position - 1;

  FOR binding IN
    SELECT b.* FROM public.conversation_thread_focus_bindings b
     WHERE b.session_id = p_cu.session_id AND b.bound_sp < p_cu.session_position
     ORDER BY b.thread_id::text COLLATE "C"
  LOOP
    current_state := public.conversation_thread_session_lifecycle_state_v1(binding.thread_id, p_cu.session_id, p_cu.session_position);
    transition := NULL;
    IF binding.thread_id = own_thread THEN
      IF current_state = 'DORMANT' THEN
        transition := jsonb_build_object('thread_id', binding.thread_id, 'from_state', 'DORMANT', 'to_state', 'REOPENED', 'reason_code', 'GENUINE_RETURN');
      ELSIF current_state = 'REOPENED' THEN
        transition := jsonb_build_object('thread_id', binding.thread_id, 'from_state', 'REOPENED', 'to_state', 'ACTIVE', 'reason_code', 'CONTINUED_ANCHORING');
      END IF;
    ELSIF current_state IN ('ACTIVE', 'REOPENED') THEN
      SELECT * INTO rel FROM public.conversation_thread_cu_relation_v1(p_cu.id, binding.thread_id);
      IF rel.explicit_shift THEN
        transition := jsonb_build_object('thread_id', binding.thread_id, 'from_state', current_state, 'to_state', 'DORMANT', 'reason_code', 'EXPLICIT_FOCUS_SHIFT');
      ELSIF current_state = 'REOPENED' AND (rel.attention_on OR rel.targets_thread) THEN
        transition := jsonb_build_object('thread_id', binding.thread_id, 'from_state', 'REOPENED', 'to_state', 'ACTIVE', 'reason_code', 'CONTINUED_ANCHORING');
      ELSIF rel.away AND NOT rel.targets_thread AND prev_cu IS NOT NULL THEN
        SELECT * INTO prev_rel FROM public.conversation_thread_cu_relation_v1(prev_cu, binding.thread_id);
        IF prev_rel.away AND NOT prev_rel.targets_thread THEN
          transition := jsonb_build_object('thread_id', binding.thread_id, 'from_state', current_state, 'to_state', 'DORMANT', 'reason_code', 'SUSTAINED_DEPARTURE');
        END IF;
      END IF;
    END IF;
    IF transition IS NOT NULL THEN
      out := out || jsonb_build_array(transition);
    END IF;
  END LOOP;
  RETURN out;
END;$$;

-- ===========================================================================
-- 11. The canonical ESTABLISHMENT identity evidence of ONE promotion,
--     DB-derived: every RESOLVED reference whose handle is the grounding
--     handle of the promoted Emerging Focus, inside the focus's starting CU
--     and every B2 evidence CU, in (SP, reference_index) order. Source-bound
--     wording only; the caller can never author or omit an item.
-- ===========================================================================
CREATE FUNCTION public.derive_conversation_thread_establishment_identity_evidence_v1(p_cu public.conversation_units, p_decision jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  focus_id uuid := (p_decision ->> 'emerging_focus_id')::uuid;
  grounding_handle uuid;
  started_cu uuid;
  derived jsonb;
BEGIN
  SELECT f.grounding_handle_id, f.started_cu_id INTO grounding_handle, started_cu
    FROM public.conversation_emerging_focuses f WHERE f.id = focus_id;
  IF grounding_handle IS NULL THEN
    RAISE EXCEPTION 'UNKNOWN_THREAD_FOCUS' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('cu_id', r.cu_id, 'reference_index', r.reference_index)
                            ORDER BY cu.session_position, r.reference_index), '[]'::jsonb)
    INTO derived
    FROM (SELECT started_cu AS cu_id
          UNION
          SELECT (e.value ->> 'cu_id')::uuid FROM jsonb_array_elements(p_decision -> 'evidence') AS e(value)) AS episode
    JOIN public.conversation_units cu ON cu.id = episode.cu_id
    JOIN public.conversation_reference_resolutions r ON r.cu_id = cu.id
   WHERE cu.session_id = p_cu.session_id AND cu.session_position <= p_cu.session_position
     AND r.state = 'RESOLVED' AND r.resolved_handle_id = grounding_handle;
  RETURN derived;
END;$$;

-- ===========================================================================
-- 12. The deterministic DB-side validation of ONE canonical B3 decision
--     against the locked rows (task section 17). The database never trusts
--     the provider's or the application's semantic claims: outcome / B2
--     coupling, the exact focus, existing Thread + Home + same user/world, no
--     rebind, no duplicate geography, source-grounded evidence closing to the
--     bound focus, dossier-only prior evidence, canonical ambiguity, derived
--     identities, and lifecycle transitions equal to the DB-derived reducer
--     result with DB-derived from_state.
-- ===========================================================================
CREATE FUNCTION public.validate_conversation_thread_lifecycle_decision_v1(
  p_cu public.conversation_units,
  p_thread_decision jsonb,
  p_decision jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  outcome text;
  b2_decision text;
  target_focus uuid;
  attention_kind text;
  attention_focus uuid;
  target_thread uuid;
  binding_kind text;
  target_binding uuid;
  bound public.conversation_thread_focus_bindings;
  grounding_handle uuid;
  evidence jsonb;
  prior_evidence jsonb;
  candidates jsonb;
  candidate_ids uuid[];
  candidate uuid;
  transitions jsonb;
  derived jsonb;
  entry jsonb;
  idx integer;
  ref_index integer;
  ref_cu uuid;
  current_state text;
  last_thread text;
BEGIN
  IF jsonb_typeof(p_decision) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_decision)) <> 10
     OR NOT (p_decision ? 'unit_id') OR NOT (p_decision ? 'outcome') OR NOT (p_decision ? 'emerging_focus_id')
     OR NOT (p_decision ? 'thread_id') OR NOT (p_decision ? 'binding_kind') OR NOT (p_decision ? 'focus_binding_id')
     OR NOT (p_decision ? 'identity_evidence') OR NOT (p_decision ? 'prior_identity_evidence')
     OR NOT (p_decision ? 'candidate_thread_ids') OR NOT (p_decision ? 'lifecycle_transitions') THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A canonical Thread-layer decision carries exactly unit_id, outcome, emerging_focus_id, thread_id, binding_kind, focus_binding_id, identity_evidence, prior_identity_evidence, candidate_thread_ids and lifecycle_transitions.';
  END IF;
  IF jsonb_typeof(p_decision -> 'unit_id') <> 'string' OR (p_decision ->> 'unit_id') !~ uuid_shape
     OR (p_decision ->> 'unit_id')::uuid <> p_cu.id THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Each canonical Thread-layer decision names the proposed CU it belongs to, in the same order.';
  END IF;
  outcome := p_decision ->> 'outcome';
  IF outcome IS NULL OR outcome NOT IN ('NO_THREAD_ACTION', 'ESTABLISH_NEW', 'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING', 'IDENTITY_AMBIGUOUS') THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Exactly six final Thread-layer outcomes are representable.';
  END IF;
  IF jsonb_typeof(p_decision -> 'identity_evidence') <> 'array' OR jsonb_typeof(p_decision -> 'prior_identity_evidence') <> 'array'
     OR jsonb_typeof(p_decision -> 'candidate_thread_ids') <> 'array' OR jsonb_typeof(p_decision -> 'lifecycle_transitions') <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  evidence := p_decision -> 'identity_evidence';
  prior_evidence := p_decision -> 'prior_identity_evidence';
  candidates := p_decision -> 'candidate_thread_ids';
  transitions := p_decision -> 'lifecycle_transitions';

  -- The canonical B1 attention of THIS CU is the only admissible focus source.
  SELECT e.attention_kind, e.emerging_focus_id INTO attention_kind, attention_focus
    FROM public.conversation_emerging_focus_attention_events e WHERE e.cu_id = p_cu.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'THREAD_DECISION_WITHOUT_B1_SEMANTICS' USING ERRCODE='55000';
  END IF;
  target_focus := NULL;
  IF jsonb_typeof(p_decision -> 'emerging_focus_id') = 'string' THEN
    IF (p_decision ->> 'emerging_focus_id') !~ uuid_shape THEN
      RAISE EXCEPTION 'UNKNOWN_THREAD_FOCUS' USING ERRCODE='22023';
    END IF;
    target_focus := (p_decision ->> 'emerging_focus_id')::uuid;
  ELSIF jsonb_typeof(p_decision -> 'emerging_focus_id') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF target_focus IS DISTINCT FROM attention_focus THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_FOCUS_MISMATCH' USING ERRCODE='22023',
      DETAIL='A Thread-layer decision names exactly the stable Emerging Focus this CU attends or starts, and none when it has no independent focus.';
  END IF;

  -- The B2 decision of the SAME CU and the final outcome must agree: a new
  -- Thread exists exactly when B2 establishes AND continuity is DISTINCT_NEW.
  b2_decision := p_thread_decision ->> 'decision';
  IF (outcome = 'ESTABLISH_NEW') <> (b2_decision = 'ESTABLISH_THREAD') THEN
    RAISE EXCEPTION 'THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH' USING ERRCODE='22023',
      DETAIL='ESTABLISH_NEW is truthful exactly when the B2 decision establishes and the continuity resolution is DISTINCT_NEW; a BIND or AMBIGUOUS continuity outcome forbids a new Thread.';
  END IF;

  -- Thread id / binding shape per outcome.
  target_thread := NULL;
  IF jsonb_typeof(p_decision -> 'thread_id') = 'string' THEN
    IF (p_decision ->> 'thread_id') !~ uuid_shape THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023';
    END IF;
    target_thread := (p_decision ->> 'thread_id')::uuid;
  ELSIF jsonb_typeof(p_decision -> 'thread_id') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  binding_kind := NULL;
  IF jsonb_typeof(p_decision -> 'binding_kind') = 'string' THEN
    binding_kind := p_decision ->> 'binding_kind';
    IF binding_kind NOT IN ('ESTABLISHMENT', 'SESSION_CONTINUITY') THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
    END IF;
  ELSIF jsonb_typeof(p_decision -> 'binding_kind') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  target_binding := NULL;
  IF jsonb_typeof(p_decision -> 'focus_binding_id') = 'string' THEN
    IF (p_decision ->> 'focus_binding_id') !~ uuid_shape THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023';
    END IF;
    target_binding := (p_decision ->> 'focus_binding_id')::uuid;
  ELSIF jsonb_typeof(p_decision -> 'focus_binding_id') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;

  -- The existing binding of this focus, if any (bound strictly before this CU).
  SELECT * INTO bound FROM public.conversation_thread_focus_bindings b WHERE b.emerging_focus_id = target_focus;
  IF bound.emerging_focus_id IS NOT NULL AND bound.bound_sp >= p_cu.session_position THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_CONTEXT' USING ERRCODE='55000',
      DETAIL='A focus binding at or after the current Session Position is structurally impossible.';
  END IF;

  IF outcome = 'NO_THREAD_ACTION' THEN
    IF target_thread IS NOT NULL OR binding_kind IS NOT NULL OR target_binding IS NOT NULL
       OR jsonb_array_length(evidence) <> 0 OR jsonb_array_length(prior_evidence) <> 0 OR jsonb_array_length(candidates) <> 0 THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
        DETAIL='NO_THREAD_ACTION carries no Thread, no binding, no evidence and no candidates.';
    END IF;
    IF bound.emerging_focus_id IS NOT NULL THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_OUTCOME_MISMATCH' USING ERRCODE='22023',
        DETAIL='A focus already bound to a canonical Thread attends or reopens it; NO_THREAD_ACTION is not truthful for it.';
    END IF;
  ELSIF outcome = 'IDENTITY_AMBIGUOUS' THEN
    IF target_thread IS NOT NULL OR binding_kind IS NOT NULL OR target_binding IS NOT NULL
       OR jsonb_array_length(evidence) <> 0 OR jsonb_array_length(prior_evidence) <> 0 THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
        DETAIL='IDENTITY_AMBIGUOUS binds nothing, establishes nothing and cites no evidence: ambiguity stays ambiguity.';
    END IF;
    IF bound.emerging_focus_id IS NOT NULL THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_OUTCOME_MISMATCH' USING ERRCODE='22023',
        DETAIL='A focus already bound to a canonical Thread is never ambiguous.';
    END IF;
    IF jsonb_array_length(candidates) < 2 THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_AMBIGUITY' USING ERRCODE='22023',
        DETAIL='Identity ambiguity names at least two existing canonical Threads.';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(candidates) AS c(value)
                WHERE jsonb_typeof(c.value) <> 'string' OR (c.value #>> '{}') !~ uuid_shape) THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023';
    END IF;
    SELECT COALESCE(array_agg((c.value #>> '{}')::uuid ORDER BY c.ordinality), ARRAY[]::uuid[]) INTO candidate_ids
      FROM jsonb_array_elements(candidates) WITH ORDINALITY AS c(value, ordinality);
    IF (SELECT count(DISTINCT d.id) FROM unnest(candidate_ids) AS d(id)) <> cardinality(candidate_ids) THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_AMBIGUITY' USING ERRCODE='22023', DETAIL='Duplicate candidate Thread.';
    END IF;
    IF (SELECT string_agg(c.value #>> '{}', ',' ORDER BY c.ordinality) FROM jsonb_array_elements(candidates) WITH ORDINALITY AS c(value, ordinality))
       IS DISTINCT FROM
       (SELECT string_agg(c.value #>> '{}', ',' ORDER BY (c.value #>> '{}') COLLATE "C") FROM jsonb_array_elements(candidates) AS c(value)) THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_AMBIGUITY' USING ERRCODE='22023',
        DETAIL='Candidate Threads are stored in canonical textual order so that no position can be read as a preference.';
    END IF;
    FOREACH candidate IN ARRAY candidate_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t
                       JOIN public.conversation_thread_homes h ON h.thread_id = t.id
                      WHERE t.id = candidate AND t.user_id = p_cu.user_id
                        AND NOT (t.established_session_id = p_cu.session_id AND t.established_sp >= p_cu.session_position)) THEN
        RAISE EXCEPTION 'UNKNOWN_THREAD_IDENTITY_CANDIDATE' USING ERRCODE='22023',
          DETAIL='Every ambiguity candidate is an already-canonical Thread of the SAME user world that already holds its permanent Home.';
      END IF;
      IF EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b
                  WHERE b.thread_id = candidate AND b.session_id = p_cu.session_id) THEN
        RAISE EXCEPTION 'THREAD_ALREADY_BOUND_IN_SESSION' USING ERRCODE='22023',
          DETAIL='A Thread already bound in this Session belongs to another Emerging Focus that B1 already distinguished; it is never an identity candidate of a new focus.';
      END IF;
    END LOOP;
  ELSE
    -- Every binding-bearing outcome names exactly one Thread and no candidate.
    IF target_thread IS NULL OR jsonb_array_length(candidates) <> 0 THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A binding-bearing outcome names exactly one canonical Thread and no ambiguity candidate.';
    END IF;
    IF target_focus IS NULL THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_FOCUS_MISMATCH' USING ERRCODE='22023',
        DETAIL='Only a CU whose canonical B1 attention starts or attends a stable Emerging Focus can carry a Thread outcome.';
    END IF;

    IF outcome IN ('ATTEND_EXISTING', 'REOPEN_EXISTING') THEN
      IF binding_kind IS NOT NULL OR target_binding IS NOT NULL OR jsonb_array_length(evidence) <> 0 OR jsonb_array_length(prior_evidence) <> 0 THEN
        RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
          DETAIL='Attending or reopening an already-bound Thread creates no binding and no evidence.';
      END IF;
      IF bound.emerging_focus_id IS NULL OR bound.thread_id <> target_thread THEN
        RAISE EXCEPTION 'THREAD_LIFECYCLE_OUTCOME_MISMATCH' USING ERRCODE='22023',
          DETAIL='ATTEND_EXISTING and REOPEN_EXISTING require the current focus to be already bound to exactly the named Thread in this Session.';
      END IF;
      current_state := public.conversation_thread_session_lifecycle_state_v1(target_thread, p_cu.session_id, p_cu.session_position);
      IF (outcome = 'REOPEN_EXISTING') <> (current_state = 'DORMANT') THEN
        RAISE EXCEPTION 'THREAD_LIFECYCLE_OUTCOME_MISMATCH' USING ERRCODE='22023',
          DETAIL='REOPEN_EXISTING is truthful exactly when the then-valid Session state of the bound Thread is DORMANT; otherwise the CU attends it.';
      END IF;
    ELSE
      -- ESTABLISH_NEW / ACTIVATE_EXISTING_IN_SESSION: a NEW binding at this CU.
      IF bound.emerging_focus_id IS NOT NULL THEN
        RAISE EXCEPTION 'THREAD_FOCUS_ALREADY_BOUND' USING ERRCODE='22023',
          DETAIL='One Session Emerging Focus binds to at most one canonical Thread forever: no rebind, no second Thread, no duplicate geography.';
      END IF;
      IF binding_kind IS DISTINCT FROM (CASE WHEN outcome = 'ESTABLISH_NEW' THEN 'ESTABLISHMENT' ELSE 'SESSION_CONTINUITY' END) THEN
        RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
          DETAIL='ESTABLISH_NEW creates an ESTABLISHMENT binding; ACTIVATE_EXISTING_IN_SESSION creates a SESSION_CONTINUITY binding.';
      END IF;
      IF target_binding IS DISTINCT FROM public.canonical_thread_focus_binding_id_v1(p_cu.session_id, target_focus, target_thread) THEN
        RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023',
          DETAIL='A focus binding identity is the deterministic RFC 4122 version-5 derivation of the Session, the focus and the Thread; no other UUID is admissible.';
      END IF;
      IF EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b
                  WHERE b.thread_id = target_thread AND b.session_id = p_cu.session_id) THEN
        RAISE EXCEPTION 'THREAD_ALREADY_BOUND_IN_SESSION' USING ERRCODE='22023',
          DETAIL='One canonical Thread carries at most one focus binding per Session.';
      END IF;
      SELECT f.grounding_handle_id INTO grounding_handle FROM public.conversation_emerging_focuses f
       WHERE f.id = target_focus AND f.session_id = p_cu.session_id AND f.user_id = p_cu.user_id;
      IF grounding_handle IS NULL THEN
        RAISE EXCEPTION 'UNKNOWN_THREAD_FOCUS' USING ERRCODE='22023';
      END IF;

      IF outcome = 'ESTABLISH_NEW' THEN
        IF target_thread <> (p_thread_decision ->> 'thread_id')::uuid THEN
          RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023',
            DETAIL='The final Thread-layer decision names exactly the canonical Thread the B2 decision establishes.';
        END IF;
        IF jsonb_array_length(prior_evidence) <> 0 THEN
          RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
            DETAIL='A new Thread has no prior identity dossier to cite.';
        END IF;
        derived := public.derive_conversation_thread_establishment_identity_evidence_v1(p_cu, p_thread_decision);
        IF evidence IS DISTINCT FROM derived OR jsonb_array_length(derived) < 1 THEN
          RAISE EXCEPTION 'THREAD_IDENTITY_EVIDENCE_NOT_CANONICAL' USING ERRCODE='22023',
            DETAIL='The identity evidence of a new Thread is exactly every canonical RESOLVED reference to the promoted focus''s grounding handle inside its starting CU and its promotion evidence, in Session order; nothing is authored, omitted or generated.';
        END IF;
      ELSE
        -- ACTIVATE_EXISTING_IN_SESSION: the Thread exists in this user world
        -- with its permanent Home, was established elsewhere, and the current
        -- source-grounded evidence closes to the bound focus.
        IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t
                         JOIN public.conversation_thread_homes h ON h.thread_id = t.id
                        WHERE t.id = target_thread AND t.user_id = p_cu.user_id) THEN
          RAISE EXCEPTION 'UNKNOWN_THREAD_IDENTITY_CANDIDATE' USING ERRCODE='22023',
            DETAIL='Session continuity binds only an already-canonical Thread of the SAME user world that already holds its permanent Home.';
        END IF;
        IF jsonb_array_length(evidence) < 1 OR jsonb_array_length(prior_evidence) < 1 THEN
          RAISE EXCEPTION 'THREAD_CONTINUITY_EVIDENCE_REQUIRED' USING ERRCODE='22023',
            DETAIL='Binding an existing Thread needs at least one current source-grounded evidence reference and at least one prior identity evidence of that Thread; same name alone is never continuity proof.';
        END IF;
        FOR idx IN 0 .. jsonb_array_length(evidence) - 1 LOOP
          entry := evidence -> idx;
          IF jsonb_typeof(entry) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(entry)) <> 2
             OR NOT (entry ? 'cu_id') OR NOT (entry ? 'reference_index')
             OR jsonb_typeof(entry -> 'reference_index') <> 'number' OR (entry ->> 'cu_id') !~ uuid_shape THEN
            RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
          END IF;
          IF (entry ->> 'cu_id')::uuid <> p_cu.id THEN
            RAISE EXCEPTION 'THREAD_CONTINUITY_EVIDENCE_NOT_CURRENT' USING ERRCODE='22023',
              DETAIL='Session continuity evidence is the current CU''s own canonical B1 wording.';
          END IF;
          ref_index := (entry ->> 'reference_index')::integer;
          IF NOT EXISTS (SELECT 1 FROM public.conversation_reference_resolutions r
                          WHERE r.cu_id = p_cu.id AND r.reference_index = ref_index
                            AND r.state = 'RESOLVED' AND r.resolved_handle_id = grounding_handle) THEN
            RAISE EXCEPTION 'THREAD_CONTINUITY_EVIDENCE_NOT_GROUNDED' USING ERRCODE='22023',
              DETAIL='Every current evidence reference is a canonical RESOLVED B1 reference of this CU whose handle grounds the bound Emerging Focus.';
          END IF;
          IF idx > 0 AND ref_index <= ((evidence -> (idx - 1)) ->> 'reference_index')::integer THEN
            RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023', DETAIL='Evidence references ascend without repetition.';
          END IF;
        END LOOP;
        FOR idx IN 0 .. jsonb_array_length(prior_evidence) - 1 LOOP
          entry := prior_evidence -> idx;
          IF jsonb_typeof(entry) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(entry)) <> 2
             OR NOT (entry ? 'cu_id') OR NOT (entry ? 'exact_surface')
             OR jsonb_typeof(entry -> 'exact_surface') <> 'string' OR (entry ->> 'cu_id') !~ uuid_shape THEN
            RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM public.conversation_thread_identity_evidence ie
                          WHERE ie.thread_id = target_thread AND ie.cu_id = (entry ->> 'cu_id')::uuid
                            AND ie.exact_surface = (entry ->> 'exact_surface')) THEN
            RAISE EXCEPTION 'THREAD_CONTINUITY_PRIOR_EVIDENCE_UNKNOWN' USING ERRCODE='22023',
              DETAIL='Every cited prior evidence is an existing identity-dossier item of exactly the bound Thread; nothing outside the supplied dossier is admissible.';
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- Lifecycle transitions: exactly the DB-derived reducer result, with the
  -- DB-derived from_state, derived event identities and canonical order.
  derived := public.derive_conversation_thread_lifecycle_transitions_v1(p_cu);
  IF jsonb_array_length(transitions) <> jsonb_array_length(derived) THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL' USING ERRCODE='22023',
      DETAIL='The lifecycle transitions of a CU are derived deterministically from canonical B1 semantics, bindings and the exact prior committed-CU sequence; a payload may neither add nor omit one.';
  END IF;
  last_thread := NULL;
  FOR idx IN 0 .. jsonb_array_length(transitions) - 1 LOOP
    entry := transitions -> idx;
    IF jsonb_typeof(entry) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(entry)) <> 4
       OR NOT (entry ? 'thread_id') OR NOT (entry ? 'to_state') OR NOT (entry ? 'reason_code') OR NOT (entry ? 'lifecycle_event_id')
       OR jsonb_typeof(entry -> 'thread_id') <> 'string' OR (entry ->> 'thread_id') !~ uuid_shape
       OR jsonb_typeof(entry -> 'lifecycle_event_id') <> 'string' OR (entry ->> 'lifecycle_event_id') !~ uuid_shape THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023',
        DETAIL='One lifecycle transition carries exactly thread_id, to_state, reason_code and lifecycle_event_id; from_state is never caller-authored.';
    END IF;
    IF (entry ->> 'thread_id') IS DISTINCT FROM ((derived -> idx) ->> 'thread_id')
       OR (entry ->> 'to_state') IS DISTINCT FROM ((derived -> idx) ->> 'to_state')
       OR (entry ->> 'reason_code') IS DISTINCT FROM ((derived -> idx) ->> 'reason_code') THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL' USING ERRCODE='22023',
        DETAIL='A lifecycle transition, its target state and its reason are derived, never authored; and the DB derives the from_state itself.';
    END IF;
    IF (entry ->> 'lifecycle_event_id')::uuid
       <> public.canonical_thread_lifecycle_event_id_v1(p_cu.session_id, p_cu.id, (entry ->> 'thread_id')::uuid, entry ->> 'to_state') THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023',
        DETAIL='A lifecycle event identity is the deterministic RFC 4122 version-5 derivation of the Session, the CU, the Thread and the target state.';
    END IF;
    last_thread := entry ->> 'thread_id';
  END LOOP;
  IF outcome = 'REOPEN_EXISTING' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(transitions) AS t(value)
     WHERE (t.value ->> 'thread_id')::uuid = target_thread AND (t.value ->> 'to_state') = 'REOPENED') THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_OUTCOME_MISMATCH' USING ERRCODE='22023',
      DETAIL='REOPEN_EXISTING carries the DORMANT -> REOPENED transition of its own Thread at this CU.';
  END IF;
END;$$;

-- ===========================================================================
-- 13. Persisting the Thread-layer rows of ONE CU at its reserved same-SP
--     sequence: the binding + identity evidence (+ identity clock advance)
--     for a new binding, every lifecycle transition, and the unit result. The
--     B2 rows of an ESTABLISH_NEW are persisted by 0068's helper beforehand.
-- ===========================================================================
CREATE FUNCTION public.persist_conversation_thread_lifecycle_layer_v1(
  p_cu public.conversation_units,
  p_commit_batch_id uuid,
  p_decision jsonb,
  p_event_sequence bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  outcome text := p_decision ->> 'outcome';
  target_focus uuid := (p_decision ->> 'emerging_focus_id')::uuid;
  target_thread uuid := (p_decision ->> 'thread_id')::uuid;
  next_ordinal integer;
  entry jsonb;
  idx integer;
  from_state text;
BEGIN
  IF p_event_sequence IS NOT NULL AND p_event_sequence <> 2 THEN
    RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
      DETAIL='The whole final Thread layer of a Moment is same-SP sequence 2, or nothing.';
  END IF;
  IF outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION') THEN
    IF p_event_sequence IS NULL THEN
      RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000';
    END IF;
    INSERT INTO public.conversation_thread_focus_bindings (
      emerging_focus_id, binding_id, thread_id, user_id, session_id, bound_cu_id, bound_sp, same_sp_event_sequence, binding_kind)
    VALUES (target_focus, public.canonical_thread_focus_binding_id_v1(p_cu.session_id, target_focus, target_thread), target_thread,
      p_cu.user_id, p_cu.session_id, p_cu.id, p_cu.session_position, p_event_sequence, p_decision ->> 'binding_kind');
    SELECT COALESCE(max(ie.evidence_ordinal) + 1, 0) INTO next_ordinal
      FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = target_thread;
    FOR idx IN 0 .. jsonb_array_length(p_decision -> 'identity_evidence') - 1 LOOP
      entry := (p_decision -> 'identity_evidence') -> idx;
      INSERT INTO public.conversation_thread_identity_evidence (
        thread_id, evidence_ordinal, user_id, session_id, cu_id, reference_index, exact_surface, source_kind)
      SELECT target_thread, next_ordinal + idx, p_cu.user_id, p_cu.session_id, r.cu_id, r.reference_index, r.anchor_text,
             CASE WHEN outcome = 'ESTABLISH_NEW' THEN 'ESTABLISHMENT' ELSE 'SESSION_BINDING' END
        FROM public.conversation_reference_resolutions r
       WHERE r.cu_id = (entry ->> 'cu_id')::uuid AND r.reference_index = (entry ->> 'reference_index')::integer;
    END LOOP;
    -- The user/world identity dossiers changed: advance the technical version
    -- (the row was locked earlier in this transaction, after the Session clock).
    UPDATE public.conversation_world_thread_identity_clocks c
       SET current_version = c.current_version + 1
     WHERE c.user_id = p_cu.user_id;
  END IF;

  FOR idx IN 0 .. jsonb_array_length(p_decision -> 'lifecycle_transitions') - 1 LOOP
    entry := (p_decision -> 'lifecycle_transitions') -> idx;
    IF p_event_sequence IS NULL THEN
      RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000';
    END IF;
    from_state := public.conversation_thread_session_lifecycle_state_v1((entry ->> 'thread_id')::uuid, p_cu.session_id, p_cu.session_position);
    INSERT INTO public.conversation_thread_lifecycle_events (
      event_id, thread_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence,
      transition_ordinal, from_state, to_state, reason_code)
    VALUES ((entry ->> 'lifecycle_event_id')::uuid, (entry ->> 'thread_id')::uuid, p_cu.user_id, p_cu.session_id, p_cu.id,
      p_commit_batch_id, p_cu.session_position, p_event_sequence, idx, from_state, entry ->> 'to_state', entry ->> 'reason_code');
  END LOOP;

  INSERT INTO public.conversation_thread_semantic_unit_results (
    cu_id, commit_batch_id, user_id, session_id, session_position, outcome, emerging_focus_id, thread_id,
    candidate_thread_ids, thread_layer_event_sequence)
  VALUES (p_cu.id, p_commit_batch_id, p_cu.user_id, p_cu.session_id, p_cu.session_position, outcome, target_focus, target_thread,
    (SELECT COALESCE(array_agg((c.value #>> '{}')::uuid ORDER BY c.ordinality), ARRAY[]::uuid[])
       FROM jsonb_array_elements(p_decision -> 'candidate_thread_ids') WITH ORDINALITY AS c(value, ordinality)),
    p_event_sequence);
END;$$;

-- ===========================================================================
-- 14. The ONE structural B3 completeness authority (B3-04). It REUSES
--     0068's `conversation_thread_batch_state_v1` for the commitment, B1 and
--     B2 layers and adds the final Thread-layer coherence:
--
--       ABSENT    every layer absent - the only state a NEW batch may start from
--       COMPLETE  commitment + B1 + B2 capture COMPLETE by 0068 AND the final
--                 Thread-layer capture structurally whole: one unit result per
--                 CU, every ESTABLISH_NEW / SESSION_CONTINUITY binding and its
--                 identity evidence coherent, every lifecycle row legal with
--                 the DB-derived from_state, and every same-SP seq2 claim true
--       PARTIAL   anything else, including legacy T-03A2-only, B1-only,
--                 B2-only (0068 complete without 0070 capture), missing
--                 binding, missing evidence, lifecycle corruption, or an
--                 ambiguous outcome beside a permanent Thread mutation
--
--     IDENTITY_AMBIGUOUS with no permanent mutation is a truthful COMPLETE
--     outcome. Read-only, zero-mutation, timestamp-free.
-- ===========================================================================
CREATE FUNCTION public.conversation_thread_semantic_batch_state_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  base_state text;
  commit_row public.conversation_unit_commit_batches;
  thread_row public.conversation_thread_commit_batches;
  semantic_row public.conversation_thread_semantic_commit_batches;
  result_row public.conversation_thread_semantic_unit_results;
  binding public.conversation_thread_focus_bindings;
  event_row public.conversation_thread_lifecycle_events;
  cu public.conversation_units;
  att_focus uuid;
  att_kind text;
  grounding_handle uuid;
  result_count integer;
  continuity_count integer;
  lifecycle_count integer;
  ambiguous_count integer;
  evidence_total integer;
  has_change boolean;
  expected_from text;
  candidate uuid;
  last_ordinal integer;
  last_sp integer;
  last_thread text;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  base_state := public.conversation_thread_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);
  SELECT * INTO semantic_row FROM public.conversation_thread_semantic_commit_batches s WHERE s.commit_batch_id = p_batch_id;
  IF base_state = 'ABSENT' THEN
    RETURN CASE WHEN semantic_row.commit_batch_id IS NULL THEN 'ABSENT' ELSE 'PARTIAL' END;
  END IF;
  IF base_state <> 'COMPLETE' OR semantic_row.commit_batch_id IS NULL THEN
    RETURN 'PARTIAL';
  END IF;
  SELECT * INTO commit_row FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id;
  SELECT * INTO thread_row FROM public.conversation_thread_commit_batches t WHERE t.commit_batch_id = p_batch_id;
  IF semantic_row.user_id <> p_user_id OR semantic_row.session_id <> p_session_id OR semantic_row.source_turn_id <> p_source_turn_id
     OR semantic_row.unit_count <> commit_row.unit_count OR semantic_row.establishment_count <> thread_row.establishment_count THEN
    RETURN 'PARTIAL';
  END IF;

  -- One unit result per committed CU of this batch, agreeing with its CU.
  SELECT count(*) INTO result_count
    FROM public.conversation_thread_semantic_unit_results r
    JOIN public.conversation_units u ON u.id = r.cu_id
   WHERE r.commit_batch_id = p_batch_id AND u.commit_batch_id = p_batch_id
     AND r.session_position = u.session_position AND r.session_id = u.session_id AND r.user_id = u.user_id;
  IF result_count <> commit_row.unit_count THEN RETURN 'PARTIAL'; END IF;
  IF (SELECT count(*) FROM public.conversation_thread_semantic_unit_results r WHERE r.commit_batch_id = p_batch_id) <> commit_row.unit_count THEN
    RETURN 'PARTIAL';
  END IF;

  -- The recorded counters are what the rows say.
  SELECT count(*) INTO continuity_count
    FROM public.conversation_thread_focus_bindings b JOIN public.conversation_units u ON u.id = b.bound_cu_id
   WHERE u.commit_batch_id = p_batch_id AND b.binding_kind = 'SESSION_CONTINUITY';
  SELECT count(*) INTO lifecycle_count FROM public.conversation_thread_lifecycle_events e WHERE e.commit_batch_id = p_batch_id;
  SELECT count(*) INTO ambiguous_count FROM public.conversation_thread_semantic_unit_results r
   WHERE r.commit_batch_id = p_batch_id AND r.outcome = 'IDENTITY_AMBIGUOUS';
  IF continuity_count <> semantic_row.continuity_binding_count OR lifecycle_count <> semantic_row.lifecycle_transition_count
     OR ambiguous_count <> semantic_row.ambiguous_count THEN
    RETURN 'PARTIAL';
  END IF;
  IF (SELECT count(*) FROM public.conversation_thread_semantic_unit_results r WHERE r.commit_batch_id = p_batch_id AND r.outcome = 'ESTABLISH_NEW')
     <> thread_row.establishment_count THEN
    RETURN 'PARTIAL';
  END IF;

  FOR result_row IN
    SELECT r.* FROM public.conversation_thread_semantic_unit_results r WHERE r.commit_batch_id = p_batch_id ORDER BY r.session_position
  LOOP
    SELECT * INTO cu FROM public.conversation_units u WHERE u.id = result_row.cu_id;
    SELECT e.attention_kind, e.emerging_focus_id INTO att_kind, att_focus
      FROM public.conversation_emerging_focus_attention_events e WHERE e.cu_id = result_row.cu_id;
    IF att_kind IS NULL OR result_row.emerging_focus_id IS DISTINCT FROM att_focus THEN RETURN 'PARTIAL'; END IF;

    -- The seq2 claim is true exactly when a durable Thread-layer change exists at this CU.
    has_change := EXISTS (SELECT 1 FROM public.conversation_threads t WHERE t.established_cu_id = result_row.cu_id)
      OR EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b WHERE b.bound_cu_id = result_row.cu_id)
      OR EXISTS (SELECT 1 FROM public.conversation_thread_lifecycle_events e WHERE e.cu_id = result_row.cu_id);
    IF has_change <> (result_row.thread_layer_event_sequence = 2) OR (has_change AND result_row.thread_layer_event_sequence IS NULL) THEN
      RETURN 'PARTIAL';
    END IF;

    IF result_row.outcome IN ('NO_THREAD_ACTION', 'IDENTITY_AMBIGUOUS') THEN
      -- No binding of this focus at or before this CU, no Thread born here.
      IF result_row.emerging_focus_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.conversation_thread_focus_bindings b
         WHERE b.emerging_focus_id = result_row.emerging_focus_id AND b.bound_sp <= result_row.session_position) THEN
        RETURN 'PARTIAL';
      END IF;
      IF EXISTS (SELECT 1 FROM public.conversation_threads t WHERE t.established_cu_id = result_row.cu_id) THEN RETURN 'PARTIAL'; END IF;
      IF result_row.outcome = 'IDENTITY_AMBIGUOUS' THEN
        last_thread := NULL;
        FOREACH candidate IN ARRAY result_row.candidate_thread_ids LOOP
          IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t JOIN public.conversation_thread_homes h ON h.thread_id = t.id
                          WHERE t.id = candidate AND t.user_id = p_user_id) THEN RETURN 'PARTIAL'; END IF;
          IF last_thread IS NOT NULL AND candidate::text COLLATE "C" <= last_thread COLLATE "C" THEN RETURN 'PARTIAL'; END IF;
          last_thread := candidate::text;
        END LOOP;
      END IF;
    ELSE
      SELECT * INTO binding FROM public.conversation_thread_focus_bindings b WHERE b.emerging_focus_id = result_row.emerging_focus_id;
      IF binding.emerging_focus_id IS NULL OR binding.thread_id <> result_row.thread_id OR binding.session_id <> p_session_id
         OR binding.user_id <> p_user_id OR binding.same_sp_event_sequence <> 2
         OR binding.binding_id <> public.canonical_thread_focus_binding_id_v1(p_session_id, binding.emerging_focus_id, binding.thread_id) THEN
        RETURN 'PARTIAL';
      END IF;
      IF result_row.outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION') THEN
        IF binding.bound_cu_id <> result_row.cu_id OR binding.bound_sp <> result_row.session_position THEN RETURN 'PARTIAL'; END IF;
        IF binding.binding_kind <> (CASE WHEN result_row.outcome = 'ESTABLISH_NEW' THEN 'ESTABLISHMENT' ELSE 'SESSION_CONTINUITY' END) THEN
          RETURN 'PARTIAL';
        END IF;
        IF result_row.outcome = 'ESTABLISH_NEW' THEN
          IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t
                          WHERE t.id = result_row.thread_id AND t.established_cu_id = result_row.cu_id
                            AND t.grounding_emerging_focus_id = result_row.emerging_focus_id) THEN RETURN 'PARTIAL'; END IF;
        ELSE
          IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t JOIN public.conversation_thread_homes h ON h.thread_id = t.id
                          WHERE t.id = result_row.thread_id AND t.user_id = p_user_id AND t.established_cu_id <> result_row.cu_id) THEN
            RETURN 'PARTIAL';
          END IF;
          IF EXISTS (SELECT 1 FROM public.conversation_thread_lifecycle_events e
                      WHERE e.cu_id = result_row.cu_id AND e.thread_id = result_row.thread_id) THEN RETURN 'PARTIAL'; END IF;
        END IF;
        -- Identity evidence of this binding episode: at least one row, every
        -- row a canonical RESOLVED reference whose handle grounds the bound focus.
        SELECT f.grounding_handle_id INTO grounding_handle FROM public.conversation_emerging_focuses f WHERE f.id = result_row.emerging_focus_id;
        SELECT count(*) INTO evidence_total FROM public.conversation_thread_identity_evidence ie
         WHERE ie.thread_id = result_row.thread_id AND ie.session_id = p_session_id
           AND ie.source_kind = (CASE WHEN result_row.outcome = 'ESTABLISH_NEW' THEN 'ESTABLISHMENT' ELSE 'SESSION_BINDING' END);
        IF evidence_total < 1 THEN RETURN 'PARTIAL'; END IF;
        IF EXISTS (SELECT 1 FROM public.conversation_thread_identity_evidence ie
                     LEFT JOIN public.conversation_reference_resolutions r ON r.cu_id = ie.cu_id AND r.reference_index = ie.reference_index
                     LEFT JOIN public.conversation_units eu ON eu.id = ie.cu_id
                    WHERE ie.thread_id = result_row.thread_id AND ie.session_id = p_session_id
                      AND (r.cu_id IS NULL OR r.state <> 'RESOLVED' OR r.resolved_handle_id IS DISTINCT FROM grounding_handle
                           OR r.anchor_text <> ie.exact_surface OR ie.user_id <> p_user_id
                           OR eu.session_id <> p_session_id OR eu.session_position > result_row.session_position)) THEN
          RETURN 'PARTIAL';
        END IF;
        IF result_row.outcome = 'ACTIVATE_EXISTING_IN_SESSION' AND EXISTS (
          SELECT 1 FROM public.conversation_thread_identity_evidence ie
           WHERE ie.thread_id = result_row.thread_id AND ie.session_id = p_session_id AND ie.cu_id <> result_row.cu_id) THEN
          RETURN 'PARTIAL';
        END IF;
        -- Contiguous evidence ordinals over the whole Thread dossier.
        SELECT count(*) INTO evidence_total FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = result_row.thread_id;
        IF (SELECT min(ie.evidence_ordinal) FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = result_row.thread_id) <> 0
           OR (SELECT max(ie.evidence_ordinal) FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = result_row.thread_id) <> evidence_total - 1 THEN
          RETURN 'PARTIAL';
        END IF;
      ELSE
        -- ATTEND_EXISTING / REOPEN_EXISTING: bound strictly before this CU.
        IF binding.bound_sp >= result_row.session_position THEN RETURN 'PARTIAL'; END IF;
        IF result_row.outcome = 'REOPEN_EXISTING' THEN
          IF (SELECT count(*) FROM public.conversation_thread_lifecycle_events e
               WHERE e.cu_id = result_row.cu_id AND e.thread_id = result_row.thread_id AND e.to_state = 'REOPENED') <> 1 THEN
            RETURN 'PARTIAL';
          END IF;
        ELSIF EXISTS (SELECT 1 FROM public.conversation_thread_lifecycle_events e
                       WHERE e.cu_id = result_row.cu_id AND e.thread_id = result_row.thread_id AND e.to_state <> 'ACTIVE') THEN
          RETURN 'PARTIAL';
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Every lifecycle row of this batch: inside the batch at its CU's SP,
  -- sequence 2, a Thread bound strictly before, a legal transition from the
  -- DB-derived then-valid state, the derived identity, contiguous ordinals
  -- per CU in canonical Thread order.
  last_sp := NULL;
  last_ordinal := NULL;
  last_thread := NULL;
  FOR event_row IN
    SELECT e.* FROM public.conversation_thread_lifecycle_events e
     WHERE e.commit_batch_id = p_batch_id ORDER BY e.session_position, e.transition_ordinal
  LOOP
    SELECT * INTO cu FROM public.conversation_units u WHERE u.id = event_row.cu_id;
    IF cu.id IS NULL OR cu.commit_batch_id <> p_batch_id OR cu.session_position <> event_row.session_position
       OR event_row.session_id <> p_session_id OR event_row.user_id <> p_user_id OR event_row.same_sp_event_sequence <> 2 THEN
      RETURN 'PARTIAL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b
                    WHERE b.thread_id = event_row.thread_id AND b.session_id = p_session_id AND b.bound_sp < event_row.session_position) THEN
      RETURN 'PARTIAL';
    END IF;
    expected_from := public.conversation_thread_session_lifecycle_state_v1(event_row.thread_id, p_session_id, event_row.session_position);
    IF expected_from IS DISTINCT FROM event_row.from_state THEN RETURN 'PARTIAL'; END IF;
    IF event_row.event_id <> public.canonical_thread_lifecycle_event_id_v1(p_session_id, event_row.cu_id, event_row.thread_id, event_row.to_state) THEN
      RETURN 'PARTIAL';
    END IF;
    IF last_sp IS DISTINCT FROM event_row.session_position THEN
      IF event_row.transition_ordinal <> 0 THEN RETURN 'PARTIAL'; END IF;
      last_thread := NULL;
    ELSIF event_row.transition_ordinal <> last_ordinal + 1 OR event_row.thread_id::text COLLATE "C" <= last_thread COLLATE "C" THEN
      RETURN 'PARTIAL';
    END IF;
    last_sp := event_row.session_position;
    last_ordinal := event_row.transition_ordinal;
    last_thread := event_row.thread_id::text;
  END LOOP;

  RETURN 'COMPLETE';
END;$$;

-- ===========================================================================
-- 15. The integrated per-Moment writer with the FINAL Thread layer.
--     Production-inert: granted to no application role. It preserves the
--     ENTIRE 0064 / 0065 commitment contract, the ENTIRE 0066 B1 contract and
--     the ENTIRE 0068 B2 contract (its validator, placement and persistence
--     helpers are CALLED, never re-implemented), and adds the B3 layer at the
--     SAME SP and the SAME same-SP sequence 2.
--
--     Per CU, in canonical source order, inside ONE clock-locked transaction:
--
--       B  insert this CU with its next SP
--       C  set clock.current_sp = this SP, reset same_sp_event_sequence = 0
--       E  reserve sequence 1 through the ONE T-03A2 seam
--       G  persist the whole T-03B1 bundle at (SP, 1)
--       H  validate the canonical B2 decision (0068) and the canonical B3
--          decision (this migration) against the durable rows
--       I  no durable Thread-layer change -> reserve NOTHING
--       J  ESTABLISH_NEW / ACTIVATE_EXISTING_IN_SESSION -> lock the user/world
--          Thread Identity Clock (after the Session clock, before the world)
--       J' ESTABLISH_NEW -> lock the user/world spatial authority, compute the
--          canonical Home against the locked world (0068)
--       K  reserve same-SP sequence 2 ONCE for the whole Thread layer
--       L  persist Thread + Home + ThreadEstablished + evidence + Origin
--          (0068), then binding + identity evidence + version advance +
--          lifecycle rows + unit result (this migration), all at sequence 2
--       M  only then may the next CU advance the clock and seal this SP
-- ===========================================================================
CREATE FUNCTION public.commit_conversation_units_with_focus_thread_lifecycle_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid,
  p_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_units jsonb,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_units jsonb,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_lifecycle_units jsonb,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text
) RETURNS SETOF public.conversation_units
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  max_units constant integer := 64;
  clock_row public.session_semantic_clocks;
  session_row public.conversation_sessions;
  turn_row public.conversation_turns;
  identity_row public.conversation_world_thread_identity_clocks;
  authority_row public.conversation_world_spatial_authorities;
  semantic_batch_row public.conversation_thread_semantic_commit_batches;
  result_row public.conversation_thread_semantic_unit_results;
  binding public.conversation_thread_focus_bindings;
  inserted_cu public.conversation_units;
  derived_digest bytea;
  derived_modality constant text := 'TEXT';
  derived_speaker constant text := 'RESOLVED';
  source_length integer;
  unit_count integer;
  establishment_count integer := 0;
  continuity_count integer := 0;
  lifecycle_count integer := 0;
  ambiguous_count integer := 0;
  unit jsonb;
  decision jsonb;
  lifecycle jsonb;
  outcome text;
  idx integer;
  unit_ids uuid[] := ARRAY[]::uuid[];
  span_starts integer[] := ARRAY[]::integer[];
  span_ends integer[] := ARRAY[]::integer[];
  cursor_pos integer;
  frontier integer;
  next_ordinal integer;
  first_sp integer;
  this_sp integer;
  reserved_sp integer;
  reserved_sequence bigint;
  has_change boolean;
  canonical jsonb;
  fingerprint bytea;
  focus_canonical jsonb;
  focus_fingerprint bytea;
  thread_canonical jsonb;
  thread_fingerprint bytea;
  lifecycle_canonical jsonb;
  lifecycle_fingerprint bytea;
  batch_state text;
  canonical_thread_id uuid;
  world_thread_ids text[];
  world_x numeric[];
  world_y numeric[];
  origin_ids text[];
  placement record;
  stored jsonb;
  expected jsonb;
BEGIN
  ---------------------------------------------------------------------------
  -- COMMON SETUP. Identical structure and identical rejections to 0068, plus
  -- the B3 payload and provenance. THE SESSION CLOCK IS THE FIRST LOCK.
  ---------------------------------------------------------------------------
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_focus_units IS NULL OR jsonb_typeof(p_focus_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_thread_units IS NULL OR jsonb_typeof(p_thread_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_lifecycle_units IS NULL OR jsonb_typeof(p_lifecycle_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_continuity_evaluator_version IS NULL OR length(btrim(p_continuity_evaluator_version)) = 0 OR length(p_continuity_evaluator_version) > 64
     OR p_continuity_policy_version IS NULL OR length(btrim(p_continuity_policy_version)) = 0 OR length(p_continuity_policy_version) > 64
     OR p_continuity_provider IS NULL OR length(btrim(p_continuity_provider)) = 0 OR length(p_continuity_provider) > 64
     OR p_continuity_model IS NULL OR length(btrim(p_continuity_model)) = 0 OR length(p_continuity_model) > 128
     OR p_continuity_prompt_version IS NULL OR length(btrim(p_continuity_prompt_version)) = 0 OR length(p_continuity_prompt_version) > 64
     OR p_continuity_schema_version IS NULL OR p_continuity_schema_version < 1
     OR p_lifecycle_reducer_version IS NULL OR length(btrim(p_lifecycle_reducer_version)) = 0 OR length(p_lifecycle_reducer_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_thread_evaluator_version IS NULL OR length(btrim(p_thread_evaluator_version)) = 0 OR length(p_thread_evaluator_version) > 64
     OR p_thread_policy_version IS NULL OR length(btrim(p_thread_policy_version)) = 0 OR length(p_thread_policy_version) > 64
     OR p_thread_provider IS NULL OR length(btrim(p_thread_provider)) = 0 OR length(p_thread_provider) > 64
     OR p_thread_model IS NULL OR length(btrim(p_thread_model)) = 0 OR length(p_thread_model) > 128
     OR p_thread_prompt_version IS NULL OR length(btrim(p_thread_prompt_version)) = 0 OR length(p_thread_prompt_version) > 64
     OR p_thread_schema_version IS NULL OR p_thread_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_THREAD_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_evaluator_version IS NULL OR length(btrim(p_evaluator_version)) = 0 OR length(p_evaluator_version) > 64
     OR p_policy_version IS NULL OR length(btrim(p_policy_version)) = 0 OR length(p_policy_version) > 64
     OR p_segmentation_provider IS NULL OR length(btrim(p_segmentation_provider)) = 0 OR length(p_segmentation_provider) > 64
     OR p_segmentation_model IS NULL OR length(btrim(p_segmentation_model)) = 0 OR length(p_segmentation_model) > 128
     OR p_segmentation_prompt_version IS NULL OR length(btrim(p_segmentation_prompt_version)) = 0
     OR length(p_segmentation_prompt_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_COMMIT_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_focus_evaluator_version IS NULL OR length(btrim(p_focus_evaluator_version)) = 0 OR length(p_focus_evaluator_version) > 64
     OR p_focus_policy_version IS NULL OR length(btrim(p_focus_policy_version)) = 0 OR length(p_focus_policy_version) > 64
     OR p_focus_provider IS NULL OR length(btrim(p_focus_provider)) = 0 OR length(p_focus_provider) > 64
     OR p_focus_model IS NULL OR length(btrim(p_focus_model)) = 0 OR length(p_focus_model) > 128
     OR p_focus_prompt_version IS NULL OR length(btrim(p_focus_prompt_version)) = 0 OR length(p_focus_prompt_version) > 64
     OR p_focus_schema_version IS NULL OR p_focus_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PROVENANCE' USING ERRCODE='22023';
  END IF;

  unit_count := jsonb_array_length(p_units);
  IF unit_count > max_units THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A commitment batch carries at most 64 committed conversational units.';
  END IF;
  IF jsonb_array_length(p_focus_units) <> unit_count THEN
    RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_thread_units) <> unit_count THEN
    RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_lifecycle_units) <> unit_count THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Exactly one canonical Thread-layer decision corresponds to exactly one proposed committed CU, in the same order.';
  END IF;

  -- AF66-01: the Session Semantic Clock is the FIRST lock of the semantic
  -- transaction, taken before the source turn, before any semantic row, before
  -- the user/world identity version and long before the spatial authority.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO session_row FROM public.conversation_sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO turn_row FROM public.conversation_turns t
    WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF turn_row.role NOT IN ('USER', 'ASSISTANT') THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_ROLE' USING ERRCODE='22023';
  END IF;
  IF turn_row.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'SOURCE_TURN_NOT_COMMITTABLE' USING ERRCODE='55000',
      DETAIL='Provisional, cancelled, failed and superseded source never becomes committed conversational truth.';
  END IF;
  IF session_row.channel <> 'TEXT' THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE='22023';
  END IF;
  derived_digest := sha256(convert_to(turn_row.content, 'UTF8'));
  source_length := length(turn_row.content);

  -- The 1:1 mapping between the four payloads, in order.
  cursor_pos := 0;
  FOR idx IN 0 .. unit_count - 1 LOOP
    unit := p_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(unit)) <> 3
       OR NOT (unit ? 'unit_id') OR NOT (unit ? 'span_start') OR NOT (unit ? 'span_end')
       OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR jsonb_typeof(unit -> 'span_start') <> 'number'
       OR jsonb_typeof(unit -> 'span_end') <> 'number'
       OR (unit ->> 'unit_id') !~* uuid_shape
       OR (unit ->> 'span_start') !~ '^[0-9]{1,9}$'
       OR (unit ->> 'span_end') !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    unit_ids := array_append(unit_ids, (unit ->> 'unit_id')::uuid);
    span_starts := array_append(span_starts, (unit ->> 'span_start')::integer);
    span_ends := array_append(span_ends, (unit ->> 'span_end')::integer);
    IF span_ends[idx + 1] <= span_starts[idx + 1] OR span_ends[idx + 1] > source_length THEN
      RAISE EXCEPTION 'SPAN_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;
    IF idx > 0 AND span_starts[idx + 1] < cursor_pos THEN
      RAISE EXCEPTION 'SPAN_NOT_FORWARD_ORDERED' USING ERRCODE='22023';
    END IF;
    cursor_pos := span_ends[idx + 1];

    unit := p_focus_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (unit ? 'unit_id') OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR (unit ->> 'unit_id') !~* uuid_shape OR (unit ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;

    decision := p_thread_units -> idx;
    IF jsonb_typeof(decision) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (decision ? 'unit_id') OR jsonb_typeof(decision -> 'unit_id') <> 'string'
       OR (decision ->> 'unit_id') !~* uuid_shape OR (decision ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
      establishment_count := establishment_count + 1;
    END IF;

    lifecycle := p_lifecycle_units -> idx;
    IF jsonb_typeof(lifecycle) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (lifecycle ? 'unit_id') OR jsonb_typeof(lifecycle -> 'unit_id') <> 'string'
       OR (lifecycle ->> 'unit_id') !~* uuid_shape OR (lifecycle ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    -- The B2 decision and the final outcome of one CU must agree before any batch row exists.
    IF ((decision ->> 'decision') = 'ESTABLISH_THREAD') <> ((lifecycle ->> 'outcome') = 'ESTABLISH_NEW') THEN
      RAISE EXCEPTION 'THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH' USING ERRCODE='22023',
        DETAIL='ESTABLISH_NEW is truthful exactly when the B2 decision establishes and the continuity resolution is DISTINCT_NEW; a BIND or AMBIGUOUS continuity outcome forbids a new Thread.';
    END IF;
    IF (lifecycle ->> 'outcome') = 'ACTIVATE_EXISTING_IN_SESSION' THEN continuity_count := continuity_count + 1; END IF;
    IF (lifecycle ->> 'outcome') = 'IDENTITY_AMBIGUOUS' THEN ambiguous_count := ambiguous_count + 1; END IF;
    IF jsonb_typeof(lifecycle -> 'lifecycle_transitions') = 'array' THEN
      lifecycle_count := lifecycle_count + jsonb_array_length(lifecycle -> 'lifecycle_transitions');
    END IF;
  END LOOP;
  IF unit_count > 1 AND (SELECT count(DISTINCT d.u) FROM unnest(unit_ids) AS d(u)) <> unit_count THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Unit identities inside a commitment batch must be distinct.';
  END IF;

  -- The DB-derived canonical fingerprints, byte-identical to 0065 / 0066 /
  -- 0068 so every writer recognises the same batch identity.
  canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'source_role', turn_row.role,
    'speaker_state', derived_speaker,
    'source_modality', derived_modality,
    'source_content_sha256', encode(derived_digest, 'hex'),
    'evaluator_version', p_evaluator_version,
    'policy_version', p_policy_version,
    'segmentation_provider', p_segmentation_provider,
    'segmentation_model', p_segmentation_model,
    'segmentation_prompt_version', p_segmentation_prompt_version,
    'unit_count', unit_count,
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'unit_id', unit_ids[g.i],
               'span_start', span_starts[g.i],
               'span_end', span_ends[g.i]) ORDER BY g.i)
        FROM generate_series(1, unit_count) AS g(i)), '[]'::jsonb));
  fingerprint := sha256(convert_to(canonical::text, 'UTF8'));
  focus_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'focus_evaluator_version', p_focus_evaluator_version,
    'focus_policy_version', p_focus_policy_version,
    'focus_provider', p_focus_provider,
    'focus_model', p_focus_model,
    'focus_prompt_version', p_focus_prompt_version,
    'focus_schema_version', p_focus_schema_version,
    'unit_count', unit_count,
    'focus_units', p_focus_units);
  focus_fingerprint := sha256(convert_to(focus_canonical::text, 'UTF8'));
  thread_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'thread_evaluator_version', p_thread_evaluator_version,
    'thread_policy_version', p_thread_policy_version,
    'thread_provider', p_thread_provider,
    'thread_model', p_thread_model,
    'thread_prompt_version', p_thread_prompt_version,
    'thread_schema_version', p_thread_schema_version,
    'unit_count', unit_count,
    'establishment_count', establishment_count,
    'thread_units', p_thread_units);
  thread_fingerprint := sha256(convert_to(thread_canonical::text, 'UTF8'));
  -- The DB-derived canonical B3 capture fingerprint: payload + provenance
  -- only; SP, sequence, timestamp and derived from_state are excluded.
  lifecycle_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'continuity_evaluator_version', p_continuity_evaluator_version,
    'continuity_policy_version', p_continuity_policy_version,
    'continuity_provider', p_continuity_provider,
    'continuity_model', p_continuity_model,
    'continuity_prompt_version', p_continuity_prompt_version,
    'continuity_schema_version', p_continuity_schema_version,
    'lifecycle_reducer_version', p_lifecycle_reducer_version,
    'unit_count', unit_count,
    'establishment_count', establishment_count,
    'continuity_binding_count', continuity_count,
    'lifecycle_transition_count', lifecycle_count,
    'ambiguous_count', ambiguous_count,
    'lifecycle_units', p_lifecycle_units);
  lifecycle_fingerprint := sha256(convert_to(lifecycle_canonical::text, 'UTF8'));

  -- B3-04: the ONE B3 completeness authority decides the path.
  batch_state := public.conversation_thread_semantic_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);

  ---------------------------------------------------------------------------
  -- PATH B - NEW INTEGRATED BATCH. Allowed only when NO layer exists yet.
  ---------------------------------------------------------------------------
  IF batch_state = 'ABSENT' THEN
    SELECT COALESCE(MAX(cu.source_span_end), 0), COALESCE(MAX(cu.ordinal_within_turn) + 1, 0)
      INTO frontier, next_ordinal
      FROM public.conversation_units cu WHERE cu.source_turn_id = turn_row.id;
    IF unit_count > 0 AND span_starts[1] < frontier THEN
      RAISE EXCEPTION 'SPAN_BEFORE_SOURCE_FRONTIER' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.conversation_unit_commit_batches (
      id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
      unit_count, evaluator_version, policy_version,
      segmentation_provider, segmentation_model, segmentation_prompt_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, fingerprint, derived_digest,
      unit_count, p_evaluator_version, p_policy_version,
      p_segmentation_provider, p_segmentation_model, p_segmentation_prompt_version);
    INSERT INTO public.conversation_focus_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, canonical_fingerprint,
      focus_evaluator_version, focus_policy_version, focus_provider, focus_model,
      focus_prompt_version, focus_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, focus_fingerprint,
      p_focus_evaluator_version, p_focus_policy_version, p_focus_provider, p_focus_model,
      p_focus_prompt_version, p_focus_schema_version);
    INSERT INTO public.conversation_thread_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, establishment_count,
      canonical_fingerprint, thread_evaluator_version, thread_policy_version,
      thread_provider, thread_model, thread_prompt_version, thread_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, establishment_count,
      thread_fingerprint, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version);
    INSERT INTO public.conversation_thread_semantic_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, establishment_count,
      continuity_binding_count, lifecycle_transition_count, ambiguous_count, canonical_fingerprint,
      continuity_evaluator_version, continuity_policy_version, continuity_provider, continuity_model,
      continuity_prompt_version, continuity_schema_version, lifecycle_reducer_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, establishment_count,
      continuity_count, lifecycle_count, ambiguous_count, lifecycle_fingerprint,
      p_continuity_evaluator_version, p_continuity_policy_version, p_continuity_provider, p_continuity_model,
      p_continuity_prompt_version, p_continuity_schema_version, p_lifecycle_reducer_version);

    -- A ZERO-CU batch is a complete evaluation batch at all four layers.
    IF unit_count = 0 THEN
      RETURN;
    END IF;

    this_sp := COALESCE(clock_row.current_sp, 0);
    FOR idx IN 1 .. unit_count LOOP
      -- B: this CU is born at the next Session Position.
      this_sp := this_sp + 1;
      IF idx = 1 THEN first_sp := this_sp; END IF;
      INSERT INTO public.conversation_units (
        id, user_id, session_id, source_turn_id, commit_batch_id,
        source_role, speaker_state, source_modality,
        ordinal_within_turn, source_span_start, source_span_end,
        committed_text, source_content_sha256, session_position)
      VALUES (unit_ids[idx], turn_row.user_id, turn_row.session_id, turn_row.id, p_batch_id,
        turn_row.role, derived_speaker, derived_modality,
        next_ordinal + idx - 1, span_starts[idx], span_ends[idx],
        substring(turn_row.content from span_starts[idx] + 1 for span_ends[idx] - span_starts[idx]),
        derived_digest, this_sp)
      RETURNING * INTO inserted_cu;

      -- C + D: this SP becomes the open head; every earlier SP is sealed.
      UPDATE public.session_semantic_clocks c
         SET current_sp = this_sp, same_sp_event_sequence = 0
       WHERE c.session_id = turn_row.session_id;

      -- E + F: the ONE same-SP sequence authority. B1 is always sequence 1.
      SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
        FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
      IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 1::bigint THEN
        RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The first Stage-6 semantic layer after commitment is sequence 1 on the SP the CU was born at.';
      END IF;

      -- G: the whole T-03B1 semantic bundle of this CU, at (this_sp, 1).
      PERFORM public.persist_conversation_unit_focus_semantics_v1(
        inserted_cu, p_batch_id, p_focus_units -> (idx - 1), reserved_sequence);

      decision := p_thread_units -> (idx - 1);
      lifecycle := p_lifecycle_units -> (idx - 1);
      outcome := lifecycle ->> 'outcome';

      -- H: the deterministic DB gates of BOTH layers, against the rows this
      -- transaction has already made durable at this exact SP.
      PERFORM public.validate_conversation_thread_decision_v1(inserted_cu, decision);
      PERFORM public.validate_conversation_thread_lifecycle_decision_v1(inserted_cu, decision, lifecycle);

      has_change := outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION')
        OR jsonb_array_length(lifecycle -> 'lifecycle_transitions') > 0;

      -- I: no durable Thread-layer change reserves NOTHING.
      IF has_change THEN
        -- J: a dossier change locks the user/world Thread Identity Clock -
        -- after the Session clock, before the spatial authority.
        IF outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION') THEN
          INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
          VALUES (turn_row.user_id)
          ON CONFLICT (user_id) DO NOTHING;
          SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
            WHERE w.user_id = turn_row.user_id
            FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
          END IF;
        END IF;

        -- J': a NEW establishment locks the spatial authority and computes the
        -- canonical Home against the locked world, exactly as 0068 does.
        IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
          INSERT INTO public.conversation_world_spatial_authorities (user_id, address_scheme)
          VALUES (turn_row.user_id, 'QANDEEL_OSDAP_V1')
          ON CONFLICT (user_id) DO NOTHING;
          SELECT * INTO authority_row FROM public.conversation_world_spatial_authorities w
            WHERE w.user_id = turn_row.user_id
            FOR UPDATE;
          IF NOT FOUND OR authority_row.address_scheme <> 'QANDEEL_OSDAP_V1' THEN
            RAISE EXCEPTION 'CANONICAL_WORLD_AUTHORITY_MISSING' USING ERRCODE='55000';
          END IF;
          SELECT COALESCE(array_agg(h.thread_id::text ORDER BY h.thread_id), ARRAY[]::text[]),
                 COALESCE(array_agg(h.placement_x ORDER BY h.thread_id), ARRAY[]::numeric[]),
                 COALESCE(array_agg(h.placement_y ORDER BY h.thread_id), ARRAY[]::numeric[])
            INTO world_thread_ids, world_x, world_y
            FROM public.conversation_thread_homes h
           WHERE h.user_id = turn_row.user_id AND h.address_scheme = authority_row.address_scheme;
          SELECT COALESCE(array_agg(m.value #>> '{}' ORDER BY m.ordinality), ARRAY[]::text[])
            INTO origin_ids
            FROM jsonb_array_elements(decision -> 'origin_thread_ids') WITH ORDINALITY AS m(value, ordinality);
          SELECT c.thread_id INTO canonical_thread_id
            FROM public.canonical_thread_identities_v1(turn_row.user_id, (decision ->> 'emerging_focus_id')::uuid) c;
          SELECT p.placement_x, p.placement_y, p.placement_attempt, p.base_x, p.base_y, p.world_fingerprint, p.origin_fingerprint
            INTO placement
            FROM public.compute_canonical_home_placement_v1(
                   turn_row.user_id::text, canonical_thread_id::text, (decision ->> 'origin_state'),
                   origin_ids, world_thread_ids, world_x, world_y) p;
        END IF;

        -- K: the ONE same-SP sequence authority, ONCE for the whole layer.
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 2::bigint THEN
          RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
            DETAIL='The final Thread layer is the second Stage-6 semantic layer on the SP the CU was born at, reserved exactly once, and B1 must already hold sequence 1 there.';
        END IF;

        -- L: every Thread-layer row of this CU at (this_sp, 2).
        IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
          PERFORM public.persist_conversation_thread_establishment_v1(
            inserted_cu, p_batch_id, decision, reserved_sequence,
            placement.placement_x, placement.placement_y, placement.placement_attempt,
            placement.base_x, placement.base_y, placement.world_fingerprint, placement.origin_fingerprint);
        END IF;
        PERFORM public.persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, reserved_sequence);
      ELSE
        PERFORM public.persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, NULL);
      END IF;
      -- M: continue with the next CU, which seals this SP.
    END LOOP;

    INSERT INTO public.conversation_unit_commit_events (
      commit_batch_id, user_id, session_id, source_turn_id, first_sp, last_sp, unit_count)
    VALUES (p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, first_sp, this_sp, unit_count);

    RETURN QUERY SELECT cu.* FROM public.conversation_units cu
      WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- PATH A - REPLAY. Every layer must be COMPLETE by the ONE B3 authority: a
  -- batch that carries CU + B1 + B2 truth but no final Thread-layer capture
  -- is PARTIAL / LEGACY state whose SP may already be sealed, and it is never
  -- upgraded, backfilled or completed here.
  ---------------------------------------------------------------------------
  IF batch_state <> 'COMPLETE' THEN
    RAISE EXCEPTION 'THREAD_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='This commitment batch is structurally partial at the commitment, B1, B2 or final Thread layer; partial, corrupted or legacy state is never repaired, upgraded, replayed or backfilled from today''s inference.';
  END IF;

  -- The frozen 0068 writer verifies the CU, B1 and B2 layers tuple by tuple
  -- with ZERO mutation; then the B3 capture identity must match exactly.
  PERFORM * FROM public.commit_conversation_units_with_focus_and_thread_v1(
    p_session_id, p_user_id, p_source_turn_id, p_batch_id, p_units,
    p_evaluator_version, p_policy_version, p_segmentation_provider,
    p_segmentation_model, p_segmentation_prompt_version,
    p_focus_units, p_focus_evaluator_version, p_focus_policy_version,
    p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
    p_thread_units, p_thread_evaluator_version, p_thread_policy_version,
    p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version);

  SELECT * INTO semantic_batch_row FROM public.conversation_thread_semantic_commit_batches s WHERE s.commit_batch_id = p_batch_id;
  IF semantic_batch_row.user_id <> turn_row.user_id
     OR semantic_batch_row.session_id <> turn_row.session_id
     OR semantic_batch_row.source_turn_id <> turn_row.id
     OR semantic_batch_row.unit_count <> unit_count
     OR semantic_batch_row.establishment_count <> establishment_count
     OR semantic_batch_row.continuity_binding_count <> continuity_count
     OR semantic_batch_row.lifecycle_transition_count <> lifecycle_count
     OR semantic_batch_row.ambiguous_count <> ambiguous_count
     OR semantic_batch_row.continuity_evaluator_version <> p_continuity_evaluator_version
     OR semantic_batch_row.continuity_policy_version <> p_continuity_policy_version
     OR semantic_batch_row.continuity_provider <> p_continuity_provider
     OR semantic_batch_row.continuity_model <> p_continuity_model
     OR semantic_batch_row.continuity_prompt_version <> p_continuity_prompt_version
     OR semantic_batch_row.continuity_schema_version <> p_continuity_schema_version
     OR semantic_batch_row.lifecycle_reducer_version <> p_lifecycle_reducer_version
     OR semantic_batch_row.canonical_fingerprint IS DISTINCT FROM lifecycle_fingerprint THEN
    RAISE EXCEPTION 'THREAD_SEMANTIC_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023',
      DETAIL='A final Thread-layer capture identity is immutable: the same batch id can never be replayed with a different outcome, binding, evidence, candidate set, transition or provenance.';
  END IF;

  -- Payload-level replay identity beyond the fingerprint: every unit result,
  -- binding, evidence row and lifecycle row is exactly what this canonical
  -- payload names.
  FOR idx IN 1 .. unit_count LOOP
    lifecycle := p_lifecycle_units -> (idx - 1);
    SELECT * INTO result_row FROM public.conversation_thread_semantic_unit_results r WHERE r.cu_id = unit_ids[idx];
    IF result_row.cu_id IS NULL OR result_row.commit_batch_id <> p_batch_id
       OR result_row.outcome <> (lifecycle ->> 'outcome')
       OR result_row.emerging_focus_id IS DISTINCT FROM (lifecycle ->> 'emerging_focus_id')::uuid
       OR result_row.thread_id IS DISTINCT FROM (lifecycle ->> 'thread_id')::uuid
       OR to_jsonb(result_row.candidate_thread_ids) IS DISTINCT FROM (lifecycle -> 'candidate_thread_ids') THEN
      RAISE EXCEPTION 'THREAD_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
        DETAIL='The stored unit result of this batch is not the outcome this canonical payload names; nothing is replayed over a different final Thread-layer truth.';
    END IF;
    IF (lifecycle ->> 'outcome') IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION') THEN
      SELECT * INTO binding FROM public.conversation_thread_focus_bindings b WHERE b.bound_cu_id = unit_ids[idx];
      IF binding.emerging_focus_id IS NULL
         OR binding.binding_id IS DISTINCT FROM (lifecycle ->> 'focus_binding_id')::uuid
         OR binding.binding_kind IS DISTINCT FROM (lifecycle ->> 'binding_kind') THEN
        RAISE EXCEPTION 'THREAD_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The stored focus binding of this CU is not the binding this canonical payload names.';
      END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('cu_id', ie.cu_id, 'reference_index', ie.reference_index) ORDER BY ie.evidence_ordinal), '[]'::jsonb)
        INTO stored
        FROM public.conversation_thread_identity_evidence ie
       WHERE ie.thread_id = binding.thread_id AND ie.session_id = p_session_id
         AND ie.source_kind = (CASE WHEN (lifecycle ->> 'outcome') = 'ESTABLISH_NEW' THEN 'ESTABLISHMENT' ELSE 'SESSION_BINDING' END);
      IF stored IS DISTINCT FROM (lifecycle -> 'identity_evidence') THEN
        RAISE EXCEPTION 'THREAD_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The stored identity evidence of this binding episode is not the evidence this canonical payload names; a missing, extra, substituted or reordered evidence row never replays.';
      END IF;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('thread_id', e.thread_id, 'to_state', e.to_state, 'reason_code', e.reason_code, 'lifecycle_event_id', e.event_id)
                              ORDER BY e.transition_ordinal), '[]'::jsonb)
      INTO stored
      FROM public.conversation_thread_lifecycle_events e WHERE e.cu_id = unit_ids[idx];
    IF stored IS DISTINCT FROM (lifecycle -> 'lifecycle_transitions') THEN
      RAISE EXCEPTION 'THREAD_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
        DETAIL='The stored lifecycle transitions of this CU are not the transitions this canonical payload names; no transition may be missing, extra, reordered or re-targeted.';
    END IF;
  END LOOP;

  RETURN QUERY SELECT cu.* FROM public.conversation_units cu
    WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
  RETURN;
END;$$;

-- ===========================================================================
-- 16. The atomic finalized-exchange coordinator with the FINAL Thread layer.
--     Production-inert: granted to no application role.
--
--     Exactly the 0068 shape, extended by the B3 payloads, the B3 provenance
--     and the SECOND optimistic authority: ONE Session clock acquired FIRST
--     and held across both blocks, the two source rows locked, the
--     finalized-exchange relation proved, BOTH halves classified by the ONE
--     B3 completeness authority, the Session-clock token compared against the
--     LOCKED clock, then the user/world Thread Identity Clock locked and its
--     version compared against the expected one - all before any canonical
--     mutation - then the USER block and the ASSISTANT block in canonical
--     conversational order. No provider call happens while a lock is held,
--     and no Home coordinate is accepted.
-- ===========================================================================
CREATE FUNCTION public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_user_source_turn_id uuid,
  p_user_batch_id uuid,
  p_user_units jsonb,
  p_user_focus_units jsonb,
  p_user_thread_units jsonb,
  p_user_lifecycle_units jsonb,
  p_assistant_source_turn_id uuid,
  p_assistant_batch_id uuid,
  p_assistant_units jsonb,
  p_assistant_focus_units jsonb,
  p_assistant_thread_units jsonb,
  p_assistant_lifecycle_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text,
  p_expected_current_sp integer,
  p_expected_same_sp_event_sequence bigint,
  p_expected_world_thread_identity_version bigint
) RETURNS TABLE(
  live_head integer,
  same_sp_event_sequence bigint,
  world_thread_identity_version bigint,
  user_units jsonb,
  assistant_units jsonb,
  user_event jsonb,
  assistant_event jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  identity_row public.conversation_world_thread_identity_clocks;
  user_turn_row public.conversation_turns;
  assistant_turn_row public.conversation_turns;
  user_state text;
  assistant_state text;
  both_exist boolean;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL
     OR p_user_source_turn_id IS NULL OR p_assistant_source_turn_id IS NULL
     OR p_user_batch_id IS NULL OR p_assistant_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_user_source_turn_id = p_assistant_source_turn_id OR p_user_batch_id = p_assistant_batch_id THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023',
      DETAIL='A finalized exchange carries two distinct source turns and two distinct commitment batches.';
  END IF;
  IF p_expected_same_sp_event_sequence IS NULL OR p_expected_same_sp_event_sequence < 0
     OR (p_expected_current_sp IS NOT NULL AND p_expected_current_sp < 1) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected semantic-clock token is (current_sp >= 1 or NULL before the first SP, same_sp_event_sequence >= 0).';
  END IF;
  IF p_expected_world_thread_identity_version IS NULL OR p_expected_world_thread_identity_version < 0 THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected user/world Thread identity version is a non-negative technical version.';
  END IF;

  -- AF66-01: exactly ONE Session clock, acquired FIRST and held for the whole
  -- exchange transaction, before every source row, semantic row, identity
  -- version and world row.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO user_turn_row FROM public.conversation_turns t
    WHERE t.id = p_user_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO assistant_turn_row FROM public.conversation_turns t
    WHERE t.id = p_assistant_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF user_turn_row.role <> 'USER'
     OR user_turn_row.status <> 'COMPLETED'
     OR user_turn_row.source_turn_id IS NOT NULL
     OR assistant_turn_row.role <> 'ASSISTANT'
     OR assistant_turn_row.status <> 'COMPLETED'
     OR assistant_turn_row.source_turn_id IS DISTINCT FROM user_turn_row.id THEN
    RAISE EXCEPTION 'INVALID_FINALIZED_EXCHANGE_RELATION' USING ERRCODE='22023',
      DETAIL='A finalized exchange is one COMPLETED USER source turn and the COMPLETED ASSISTANT turn finalized as its response, in that order.';
  END IF;

  -- BOTH halves through the ONE B3 completeness authority, BEFORE the token
  -- logic and BEFORE either writer: ABSENT + ABSENT or COMPLETE + COMPLETE.
  user_state := public.conversation_thread_semantic_batch_state_v1(p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id);
  assistant_state := public.conversation_thread_semantic_batch_state_v1(p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id);
  IF NOT ((user_state = 'ABSENT' AND assistant_state = 'ABSENT')
          OR (user_state = 'COMPLETE' AND assistant_state = 'COMPLETE')) THEN
    RAISE EXCEPTION 'THREAD_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='A finalized exchange is committed as a whole or not at all: one half canonical while the other is absent or structurally partial is never completed, replayed or repaired.';
  END IF;

  -- Stale-context protection, first authority: the Session Semantic Clock.
  both_exist := user_state = 'COMPLETE';
  IF NOT both_exist
     AND (clock_row.current_sp IS DISTINCT FROM p_expected_current_sp
          OR clock_row.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence) THEN
    RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' USING ERRCODE='40001',
      DETAIL='The Session Semantic Clock moved after the prior context was read; nothing was written. Re-read the context and evaluate again.';
  END IF;

  -- Stale-context protection, second authority: the user/world Thread
  -- Identity Clock, locked AFTER the Session clock and compared BEFORE any
  -- canonical mutation. A dossier that changed under the screening is never
  -- guessed around.
  IF NOT both_exist THEN
    INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
      WHERE w.user_id = p_user_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
    END IF;
    IF identity_row.current_version IS DISTINCT FROM p_expected_world_thread_identity_version THEN
      RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='40001',
        DETAIL='The user/world Thread identity dossiers changed after they were screened; nothing was written. Re-read the context and the dossiers and resolve again.';
    END IF;
  END IF;

  -- USER block first, ASSISTANT block second: canonical conversational order.
  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
    INTO user_units
    FROM public.commit_conversation_units_with_focus_thread_lifecycle_v1(
      p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id, p_user_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_user_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_user_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_user_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal_within_turn), '[]'::jsonb)
    INTO assistant_units
    FROM public.commit_conversation_units_with_focus_thread_lifecycle_v1(
      p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_assistant_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_assistant_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_assistant_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version) a;

  SELECT c.current_sp, c.same_sp_event_sequence INTO live_head, same_sp_event_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  SELECT COALESCE((SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0)
    INTO world_thread_identity_version;
  SELECT to_jsonb(e) INTO user_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_user_batch_id;
  SELECT to_jsonb(e) INTO assistant_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_assistant_batch_id;
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 17. Exhaustive, deterministic Thread identity dossier paging (B3-03).
--     Every canonical Thread of the user, in `thread_id::text COLLATE "C"`
--     order, in fixed-size pages, read against ONE exact user/world identity
--     version. A dossier carries source-grounded identity evidence only: no
--     Home coordinate, no lifecycle, no importance, no relation, no timestamp.
--     A Thread without a dossier (legacy B2-only truth) fails closed rather
--     than being silently ignored.
-- ===========================================================================
CREATE FUNCTION public.get_conversation_thread_identity_dossier_page_v1(
  p_user_id uuid,
  p_expected_world_thread_identity_version bigint,
  p_after_thread_id uuid,
  p_limit integer
) RETURNS TABLE(
  thread_id uuid,
  identity_evidence jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  current_version bigint;
BEGIN
  IF p_user_id IS NULL OR p_expected_world_thread_identity_version IS NULL OR p_expected_world_thread_identity_version < 0 THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_CONTEXT_TOKEN' USING ERRCODE='22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 64 THEN
    RAISE EXCEPTION 'INVALID_THREAD_DOSSIER_PAGE' USING ERRCODE='22023',
      DETAIL='A dossier page is a fixed technical chunk of 1 to 64 Threads.';
  END IF;
  SELECT COALESCE((SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0)
    INTO current_version;
  IF current_version <> p_expected_world_thread_identity_version THEN
    RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='40001',
      DETAIL='The user/world Thread identity dossiers changed after the runtime context was read; re-read the context and screen again.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.conversation_threads t
              WHERE t.user_id = p_user_id
                AND NOT EXISTS (SELECT 1 FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = t.id)) THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL='THREAD_WITHOUT_IDENTITY_DOSSIER: a canonical Thread with no source-grounded identity evidence cannot be screened and is never silently ignored.';
  END IF;
  RETURN QUERY
    SELECT t.id,
           (SELECT jsonb_agg(jsonb_build_object(
                     'session_id', ie.session_id,
                     'cu_id', ie.cu_id,
                     'exact_surface', ie.exact_surface,
                     'committed_cu_text', cu.committed_text,
                     'source_role', cu.source_role)
                     ORDER BY ie.evidence_ordinal)
              FROM public.conversation_thread_identity_evidence ie
              JOIN public.conversation_units cu ON cu.id = ie.cu_id
             WHERE ie.thread_id = t.id)
      FROM public.conversation_threads t
     WHERE t.user_id = p_user_id
       AND (p_after_thread_id IS NULL OR t.id::text COLLATE "C" > p_after_thread_id::text COLLATE "C")
     ORDER BY t.id::text COLLATE "C"
     LIMIT p_limit;
END;$$;

-- ===========================================================================
-- 18. The B3 runtime context: the 0069 combined context (token, B1 prior
--     context, canonical B1 bundles, attention history, this Session's
--     establishment bindings), preserved by delegation, PLUS the user/world
--     identity version, every Session focus -> Thread binding and the
--     Session-local lifecycle history. It FAILS CLOSED on any prior batch
--     that is not B3-COMPLETE and on any user Thread without a dossier. No
--     cross-Session SP order, no global lifecycle "latest", no Home.
-- ===========================================================================
CREATE FUNCTION public.get_conversation_thread_lifecycle_runtime_context_v1(
  p_session_id uuid,
  p_user_id uuid
) RETURNS TABLE(
  base_current_sp integer,
  base_same_sp_event_sequence bigint,
  world_thread_identity_version bigint,
  prior_cus jsonb,
  reference_handles jsonb,
  focus_candidates jsonb,
  current_focus_candidate_id uuid,
  prior_focus_semantics jsonb,
  focus_attention_history jsonb,
  established_thread_bindings jsonb,
  session_focus_thread_bindings jsonb,
  session_thread_lifecycle_history jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  offending uuid;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;

  -- The T-03B2b3 read is the authority for the token and the B1 / B2 context.
  SELECT c.base_current_sp, c.base_same_sp_event_sequence, c.prior_cus, c.reference_handles, c.focus_candidates,
         c.current_focus_candidate_id, c.prior_focus_semantics, c.focus_attention_history, c.established_thread_bindings
    INTO base_current_sp, base_same_sp_event_sequence, prior_cus, reference_handles, focus_candidates,
         current_focus_candidate_id, prior_focus_semantics, focus_attention_history, established_thread_bindings
    FROM public.get_conversation_focus_thread_runtime_context_v1(p_session_id, p_user_id) c;

  -- Fail closed on any prior batch that is not COMPLETE at the FINAL Thread
  -- layer, and on any Thread of this user world without an identity dossier.
  SELECT b.id INTO offending
    FROM public.conversation_unit_commit_batches b
   WHERE b.session_id = p_session_id AND b.user_id = p_user_id
     AND public.conversation_thread_semantic_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id) <> 'COMPLETE'
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL=format('PRIOR_BATCH_NOT_B3_COMPLETE: %s', offending);
  END IF;
  SELECT t.id INTO offending FROM public.conversation_threads t
   WHERE t.user_id = p_user_id
     AND NOT EXISTS (SELECT 1 FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = t.id)
   ORDER BY t.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL=format('THREAD_WITHOUT_IDENTITY_DOSSIER: %s', offending);
  END IF;

  world_thread_identity_version := COALESCE(
    (SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0);

  -- A binding or lifecycle row at a Session Position later than the base
  -- token is structurally impossible; it is refused, never truncated.
  IF EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b
              WHERE b.session_id = p_session_id AND (base_current_sp IS NULL OR b.bound_sp > base_current_sp))
     OR EXISTS (SELECT 1 FROM public.conversation_thread_lifecycle_events e
                 WHERE e.session_id = p_session_id AND (base_current_sp IS NULL OR e.session_position > base_current_sp)) THEN
    RAISE EXCEPTION 'INVALID_THREAD_RUNTIME_CONTEXT' USING ERRCODE='55000',
      DETAIL='A focus binding or lifecycle transition cannot lie at a Session Position later than the base semantic-clock token.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'binding_id', b.binding_id,
           'thread_id', b.thread_id,
           'emerging_focus_id', b.emerging_focus_id,
           'bound_cu_id', b.bound_cu_id,
           'bound_sp', b.bound_sp,
           'binding_kind', b.binding_kind)
           ORDER BY b.bound_sp, b.thread_id::text COLLATE "C"), '[]'::jsonb)
    INTO session_focus_thread_bindings
    FROM public.conversation_thread_focus_bindings b
   WHERE b.session_id = p_session_id AND b.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'event_id', e.event_id,
           'thread_id', e.thread_id,
           'cu_id', e.cu_id,
           'session_position', e.session_position,
           'transition_ordinal', e.transition_ordinal,
           'from_state', e.from_state,
           'to_state', e.to_state,
           'reason_code', e.reason_code)
           ORDER BY e.session_position, e.transition_ordinal), '[]'::jsonb)
    INTO session_thread_lifecycle_history
    FROM public.conversation_thread_lifecycle_events e
   WHERE e.session_id = p_session_id AND e.user_id = p_user_id;

  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 19. The integrated batch snapshot with the FINAL Thread-layer capture
--     state: the 0069 read (commitment, B1, B2), preserved by delegation, plus
--     the B3 completeness authority and its technical counters.
-- ===========================================================================
CREATE FUNCTION public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid
) RETURNS TABLE(
  batch_exists boolean,
  committed_unit_count integer,
  units jsonb,
  commit_event jsonb,
  source_frontier integer,
  live_head integer,
  focus_batch_exists boolean,
  focus_semantic_count integer,
  focus_attention_count integer,
  focus_complete boolean,
  thread_capture_state text,
  thread_batch_exists boolean,
  thread_unit_count integer,
  thread_establishment_count integer,
  thread_semantic_capture_state text,
  thread_semantic_batch_exists boolean,
  thread_semantic_unit_count integer,
  continuity_binding_count integer,
  lifecycle_transition_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  semantic_row public.conversation_thread_semantic_commit_batches;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT s.batch_exists, s.committed_unit_count, s.units, s.commit_event, s.source_frontier, s.live_head,
         s.focus_batch_exists, s.focus_semantic_count, s.focus_attention_count, s.focus_complete,
         s.thread_capture_state, s.thread_batch_exists, s.thread_unit_count, s.thread_establishment_count
    INTO batch_exists, committed_unit_count, units, commit_event, source_frontier, live_head,
         focus_batch_exists, focus_semantic_count, focus_attention_count, focus_complete,
         thread_capture_state, thread_batch_exists, thread_unit_count, thread_establishment_count
    FROM public.get_conversation_focus_thread_integrated_batch_snapshot_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id) s;

  thread_semantic_capture_state := public.conversation_thread_semantic_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);
  thread_semantic_batch_exists := false;
  thread_semantic_unit_count := 0;
  continuity_binding_count := 0;
  lifecycle_transition_count := 0;
  SELECT * INTO semantic_row FROM public.conversation_thread_semantic_commit_batches t WHERE t.commit_batch_id = p_batch_id;
  IF FOUND THEN
    IF semantic_row.user_id <> p_user_id OR semantic_row.session_id <> p_session_id OR semantic_row.source_turn_id <> p_source_turn_id THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
    END IF;
    thread_semantic_batch_exists := true;
    thread_semantic_unit_count := semantic_row.unit_count;
    continuity_binding_count := semantic_row.continuity_binding_count;
    lifecycle_transition_count := semantic_row.lifecycle_transition_count;
  END IF;
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 20. The Thread-lifecycle cutover-readiness audit: a DEPLOYMENT / READINESS
--     PROOF ONLY. It fails closed if ANY committed-CU batch is not COMPLETE by
--     the ONE B3 authority, if ANY Thread lacks its ESTABLISHMENT binding or
--     its identity dossier, or if ANY Session lifecycle chain is illegal. It
--     backfills, repairs, deletes, mutates and declares nothing (STABLE).
-- ===========================================================================
CREATE FUNCTION public.assert_conversation_thread_lifecycle_cutover_ready_v1()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  offending uuid;
  offending_state text;
  event_row public.conversation_thread_lifecycle_events;
BEGIN
  SELECT b.id, public.conversation_thread_semantic_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id)
    INTO offending, offending_state
    FROM public.conversation_unit_commit_batches b
   WHERE public.conversation_thread_semantic_batch_state_v1(b.session_id, b.user_id, b.source_turn_id, b.id) <> 'COMPLETE'
   ORDER BY b.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('COMMIT_BATCH_NOT_THREAD_LIFECYCLE_COMPLETE: %s (%s)', offending, offending_state);
  END IF;
  SELECT t.id INTO offending FROM public.conversation_threads t
   WHERE NOT EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings b
                      WHERE b.thread_id = t.id AND b.binding_kind = 'ESTABLISHMENT'
                        AND b.emerging_focus_id = t.grounding_emerging_focus_id AND b.bound_cu_id = t.established_cu_id
                        AND b.session_id = t.established_session_id AND b.bound_sp = t.established_sp)
   ORDER BY t.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('THREAD_WITHOUT_ESTABLISHMENT_BINDING: %s', offending);
  END IF;
  SELECT t.id INTO offending FROM public.conversation_threads t
   WHERE NOT EXISTS (SELECT 1 FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = t.id)
   ORDER BY t.id LIMIT 1;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_CUTOVER_NOT_READY' USING ERRCODE='55000',
      DETAIL=format('THREAD_WITHOUT_IDENTITY_DOSSIER: %s', offending);
  END IF;
  FOR event_row IN SELECT e.* FROM public.conversation_thread_lifecycle_events e ORDER BY e.session_id, e.session_position, e.transition_ordinal LOOP
    IF public.conversation_thread_session_lifecycle_state_v1(event_row.thread_id, event_row.session_id, event_row.session_position)
       IS DISTINCT FROM event_row.from_state THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_CUTOVER_NOT_READY' USING ERRCODE='55000',
        DETAIL=format('INVALID_LIFECYCLE_CHAIN: %s', event_row.event_id);
    END IF;
  END LOOP;
END;$$;

-- ===========================================================================
-- 21. Ownership, search_path hardening and the PRODUCTION-INERT posture.
--     Nothing new is granted; nothing existing is revoked or re-granted.
-- ===========================================================================
ALTER TABLE public.conversation_world_thread_identity_clocks OWNER TO postgres;
ALTER TABLE public.conversation_thread_focus_bindings OWNER TO postgres;
ALTER TABLE public.conversation_thread_identity_evidence OWNER TO postgres;
ALTER TABLE public.conversation_thread_lifecycle_events OWNER TO postgres;
ALTER TABLE public.conversation_thread_semantic_commit_batches OWNER TO postgres;
ALTER TABLE public.conversation_thread_semantic_unit_results OWNER TO postgres;
ALTER TABLE public.conversation_world_thread_identity_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_focus_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_identity_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_semantic_commit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_semantic_unit_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.conversation_world_thread_identity_clocks, public.conversation_thread_focus_bindings,
  public.conversation_thread_identity_evidence, public.conversation_thread_lifecycle_events,
  public.conversation_thread_semantic_commit_batches, public.conversation_thread_semantic_unit_results
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.guard_conversation_world_thread_identity_clock_v1() OWNER TO postgres;
ALTER FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.canonical_thread_focus_binding_id_v1(uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.canonical_thread_lifecycle_event_id_v1(uuid,uuid,uuid,text) OWNER TO postgres;
ALTER FUNCTION public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.conversation_thread_cu_relation_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.derive_conversation_thread_lifecycle_transitions_v1(public.conversation_units) OWNER TO postgres;
ALTER FUNCTION public.derive_conversation_thread_establishment_identity_evidence_v1(public.conversation_units,jsonb) OWNER TO postgres;
ALTER FUNCTION public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.persist_conversation_thread_lifecycle_layer_v1(public.conversation_units,uuid,jsonb,bigint) OWNER TO postgres;
ALTER FUNCTION public.conversation_thread_semantic_batch_state_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text)
  OWNER TO postgres;
ALTER FUNCTION public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,integer,bigint,bigint)
  OWNER TO postgres;
ALTER FUNCTION public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.assert_conversation_thread_lifecycle_cutover_ready_v1() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.guard_conversation_world_thread_identity_clock_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonical_thread_focus_binding_id_v1(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonical_thread_lifecycle_event_id_v1(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversation_thread_cu_relation_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_conversation_thread_lifecycle_transitions_v1(public.conversation_units) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_conversation_thread_establishment_identity_evidence_v1(public.conversation_units,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_conversation_thread_lifecycle_layer_v1(public.conversation_units,uuid,jsonb,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversation_thread_semantic_batch_state_v1(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,integer,bigint,bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_conversation_thread_lifecycle_cutover_ready_v1() FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.conversation_world_thread_identity_clocks, public.conversation_thread_focus_bindings, '
       || 'public.conversation_thread_identity_evidence, public.conversation_thread_lifecycle_events, '
       || 'public.conversation_thread_semantic_commit_batches, public.conversation_thread_semantic_unit_results FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.guard_conversation_world_thread_identity_clock_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.canonical_thread_focus_binding_id_v1(uuid,uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.canonical_thread_lifecycle_event_id_v1(uuid,uuid,uuid,text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.conversation_thread_cu_relation_v1(uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_conversation_thread_lifecycle_transitions_v1(public.conversation_units) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_conversation_thread_establishment_identity_evidence_v1(public.conversation_units,jsonb) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.persist_conversation_thread_lifecycle_layer_v1(public.conversation_units,uuid,jsonb,bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.conversation_thread_semantic_batch_state_v1(uuid,uuid,uuid,uuid) FROM service_role';
  -- PRODUCTION-INERT: the B3 writer, coordinator, reads, dossier paging and
  -- readiness audit are executable by NO application role in T-03B3. T-03D
  -- owns the final semantic-chain cutover.
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,integer,bigint,bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.assert_conversation_thread_lifecycle_cutover_ready_v1() FROM service_role';
END IF;END$$;

-- ===========================================================================
-- 22. Terminal self-assertions. The migration refuses to deploy a substrate
--     that is production-reachable, that disturbed the T-03A2 activation or
--     the 0066 / 0068 / 0069 posture, that backfilled anything, that carries
--     a global lifecycle / Session-order / LF / score column, whose frozen
--     namespaces drift, or whose reads are not read-only by declaration.
-- ===========================================================================
DO $$
DECLARE
  lifecycle_writer constant text := 'public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text)';
  lifecycle_coordinator constant text := 'public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,integer,bigint,bigint)';
  lifecycle_validator constant text := 'public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb)';
  lifecycle_persist constant text := 'public.persist_conversation_thread_lifecycle_layer_v1(public.conversation_units,uuid,jsonb,bigint)';
  lifecycle_reducer constant text := 'public.derive_conversation_thread_lifecycle_transitions_v1(public.conversation_units)';
  lifecycle_relation constant text := 'public.conversation_thread_cu_relation_v1(uuid,uuid)';
  lifecycle_state constant text := 'public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer)';
  establishment_evidence constant text := 'public.derive_conversation_thread_establishment_identity_evidence_v1(public.conversation_units,jsonb)';
  binding_identity constant text := 'public.canonical_thread_focus_binding_id_v1(uuid,uuid,uuid)';
  event_identity constant text := 'public.canonical_thread_lifecycle_event_id_v1(uuid,uuid,uuid,text)';
  semantic_batch_state constant text := 'public.conversation_thread_semantic_batch_state_v1(uuid,uuid,uuid,uuid)';
  dossier_page constant text := 'public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)';
  lifecycle_context constant text := 'public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid)';
  lifecycle_snapshot constant text := 'public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  readiness_audit constant text := 'public.assert_conversation_thread_lifecycle_cutover_ready_v1()';
  thread_writer constant text := 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
  thread_coordinator constant text := 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
  thread_snapshot constant text := 'public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  thread_context constant text := 'public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid)';
  thread_audit constant text := 'public.assert_conversation_thread_capture_cutover_ready_v1()';
  batch_state constant text := 'public.conversation_thread_batch_state_v1(uuid,uuid,uuid,uuid)';
  focus_writer constant text := 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
  focus_coordinator constant text := 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
  same_sp_helper constant text := 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
  legacy_producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_coordinator constant text := 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_snapshot constant text := 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  rfc4122_url_namespace constant uuid := '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
  lifecycle_tables constant text[] := ARRAY[
    'public.conversation_world_thread_identity_clocks', 'public.conversation_thread_focus_bindings',
    'public.conversation_thread_identity_evidence', 'public.conversation_thread_lifecycle_events',
    'public.conversation_thread_semantic_commit_batches', 'public.conversation_thread_semantic_unit_results'];
  lifecycle_functions constant text[] := ARRAY[lifecycle_writer, lifecycle_coordinator, lifecycle_validator, lifecycle_persist,
    lifecycle_reducer, lifecycle_relation, lifecycle_state, establishment_evidence, binding_identity, event_identity,
    semantic_batch_state, dossier_page, lifecycle_context, lifecycle_snapshot, readiness_audit];
  read_only_functions constant text[] := ARRAY[semantic_batch_state, dossier_page, lifecycle_context, lifecycle_snapshot,
    readiness_audit, lifecycle_state, lifecycle_relation, lifecycle_reducer, establishment_evidence];
  target_role text;
  target_table text;
  target_privilege text;
  target_function text;
  function_row pg_proc;
  row_total bigint;
BEGIN
  -- Nothing was backfilled; every new table is append-only for the owner too.
  FOREACH target_table IN ARRAY lifecycle_tables LOOP
    EXECUTE format('SELECT count(*) FROM %s', target_table) INTO STRICT row_total;
    IF row_total <> 0 THEN
      RAISE EXCEPTION 'T-03B3 creates a forward-only substrate and backfills nothing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal
                      AND t.tgfoid IN ('public.reject_conversation_thread_lifecycle_mutation_v1'::regproc,
                                       'public.guard_conversation_world_thread_identity_clock_v1'::regproc)) THEN
      RAISE EXCEPTION 'every T-03B3 table must be append-only or guarded: % lacks its trigger', target_table;
    END IF;
  END LOOP;

  -- B3-01: no global lifecycle state, no global Session order, no cross-Session
  -- SP, no timestamp lifecycle authority, no LF, no score / similarity, no merge.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name IN ('conversation_world_thread_identity_clocks','conversation_thread_focus_bindings',
                                     'conversation_thread_identity_evidence','conversation_thread_lifecycle_events',
                                     'conversation_thread_semantic_commit_batches','conversation_thread_semantic_unit_results',
                                     'conversation_threads','conversation_thread_homes','session_semantic_clocks')
                AND c.column_name ~* 'current_global_lifecycle_state|global_thread_sp|global_session_order|cross_session_last_sp|lifecycle_state$|current_lifecycle|last_active_at|dormant_since|reopened_at|score|confidence|similarity|embedding|rank|importance|label|normalized|merge|parent|live_focus|(^|_)lf($|_)|pre_first_sp|timeline|projection|reading|neighborhood|viewport|camera') THEN
    RAISE EXCEPTION 'T-03B3 introduces no global lifecycle / Session-order / timestamp / LF / score / label / merge column';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'conversation_threads'
                AND c.column_name ~* 'lifecycle|dormant|reopen|status|active|state') THEN
    RAISE EXCEPTION 'T-03B3 adds no lifecycle column to conversation_threads: lifecycle is Session-local history';
  END IF;

  -- The structural invariants exist: one Thread per focus forever, one focus
  -- per Thread per Session, one transition per Thread per CU, one unit result
  -- per CU, one result per Session Position.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = 'public.conversation_thread_focus_bindings'::regclass
                  AND k.contype = 'p'
                  AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(k.conkey) AS ck(attnum)
                        JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ck.attnum) = ARRAY['emerging_focus_id']) THEN
    RAISE EXCEPTION 'T-03B3 requires one Session Emerging Focus to bind to at most one Thread forever';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = 'public.conversation_thread_focus_bindings'::regclass
                  AND k.contype = 'u' AND k.conname = 'thread_focus_bindings_one_per_session') THEN
    RAISE EXCEPTION 'T-03B3 requires at most one focus binding per Thread per Session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = 'public.conversation_thread_lifecycle_events'::regclass
                  AND k.contype = 'u' AND k.conname = 'thread_lifecycle_events_one_per_cu') THEN
    RAISE EXCEPTION 'T-03B3 requires at most one lifecycle transition per Thread per CU';
  END IF;

  -- Function identity, security posture, search path and read-only declarations.
  FOREACH target_function IN ARRAY lifecycle_functions LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF NOT FOUND THEN RAISE EXCEPTION 'a T-03B3 function is missing: %', target_function; END IF;
    IF pg_get_userbyid(function_row.proowner) <> 'postgres' OR NOT function_row.prosecdef
       OR NOT EXISTS (SELECT 1 FROM unnest(function_row.proconfig) AS entry(setting)
                       WHERE entry.setting LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'T-03B3 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed: %', target_function;
    END IF;
  END LOOP;
  FOREACH target_function IN ARRAY read_only_functions LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF function_row.provolatile <> 's' THEN
      RAISE EXCEPTION 'T-03B3 reads, derivations and the audit must be STABLE, never writers: %', target_function;
    END IF;
  END LOOP;

  -- B3-04: the B3 authority REUSES the single 0068 authority and the 0069
  -- reads delegate; nothing is duplicated.
  IF position('conversation_thread_batch_state_v1' IN pg_get_functiondef(to_regprocedure(semantic_batch_state))) = 0
     OR position('get_conversation_focus_thread_runtime_context_v1' IN pg_get_functiondef(to_regprocedure(lifecycle_context))) = 0
     OR position('get_conversation_focus_thread_integrated_batch_snapshot_v1' IN pg_get_functiondef(to_regprocedure(lifecycle_snapshot))) = 0
     OR position('conversation_thread_semantic_batch_state_v1' IN pg_get_functiondef(to_regprocedure(readiness_audit))) = 0
     OR position('conversation_thread_semantic_batch_state_v1' IN pg_get_functiondef(to_regprocedure(lifecycle_writer))) = 0
     OR position('conversation_thread_semantic_batch_state_v1' IN pg_get_functiondef(to_regprocedure(lifecycle_coordinator))) = 0 THEN
    RAISE EXCEPTION 'T-03B3 must reuse the 0068 completeness authority and the 0069 reads, never duplicate them';
  END IF;
  IF to_regprocedure(batch_state) IS NULL OR to_regprocedure(thread_snapshot) IS NULL OR to_regprocedure(thread_context) IS NULL
     OR to_regprocedure(thread_audit) IS NULL OR to_regprocedure(thread_writer) IS NULL OR to_regprocedure(thread_coordinator) IS NULL THEN
    RAISE EXCEPTION 'the 0068 / 0069 substrate must remain deployed';
  END IF;

  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      FOREACH target_function IN ARRAY lifecycle_functions || ARRAY[thread_snapshot, thread_context, thread_audit, batch_state,
                                             thread_writer, thread_coordinator, focus_writer, focus_coordinator, same_sp_helper] LOOP
        IF has_function_privilege(target_role, target_function, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B3 performs no cutover: % must not execute %', target_role, target_function;
        END IF;
      END LOOP;
      IF target_role = 'service_role' THEN
        IF NOT has_function_privilege(target_role, legacy_producer, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_coordinator, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_snapshot, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B3 must leave the live T-03A2 service_role grants exactly in place';
        END IF;
      ELSIF has_function_privilege(target_role, legacy_producer, 'EXECUTE')
         OR has_function_privilege(target_role, legacy_coordinator, 'EXECUTE') THEN
        RAISE EXCEPTION 'the canonical producer must never be executable by %', target_role;
      END IF;
      FOREACH target_table IN ARRAY lifecycle_tables LOOP
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'the Thread lifecycle substrate must stay unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  -- The frozen namespace literals re-derive from their documented URIs, and
  -- the pinned identity vectors reproduce.
  IF public.canonical_uuid_v5_v1(rfc4122_url_namespace, 'https://qandeel.app/runtime/thread-focus-binding/v1')
       <> '194bb7c5-906f-5228-8116-b4c99b34bd76'::uuid
     OR public.canonical_uuid_v5_v1(rfc4122_url_namespace, 'https://qandeel.app/runtime/thread-lifecycle-event/v1')
       <> '9fbd9e6c-f8a4-529b-bd97-46f75cb068d3'::uuid THEN
    RAISE EXCEPTION 'T-03B3 requires the exact RFC 4122 version-5 derivation of its frozen namespaces';
  END IF;
  IF public.canonical_thread_focus_binding_id_v1('33333333-3333-4333-8333-333333333333'::uuid,
       '4ef8538d-ddda-5e11-b7d9-052be85de59a'::uuid, 'afc4fd81-fe54-5738-9545-e1053044d919'::uuid)
       <> '81db0320-39e5-5053-adc5-6d9c993f5ec7'::uuid
     OR public.canonical_thread_lifecycle_event_id_v1('33333333-3333-4333-8333-333333333333'::uuid,
       '11111111-2222-4333-8444-555555555555'::uuid, 'afc4fd81-fe54-5738-9545-e1053044d919'::uuid, 'DORMANT')
       <> '3150f4a8-1f76-5ed4-9936-53dc2d72ee78'::uuid
     OR public.canonical_thread_lifecycle_event_id_v1('33333333-3333-4333-8333-333333333333'::uuid,
       '11111111-2222-4333-8444-555555555555'::uuid, 'afc4fd81-fe54-5738-9545-e1053044d919'::uuid, 'REOPENED')
       <> '45873543-9eb6-5679-ae70-befb05f4ee86'::uuid THEN
    RAISE EXCEPTION 'T-03B3 requires the frozen focus-binding and lifecycle-event identity vectors';
  END IF;

  -- The clock itself is unchanged: still exactly SP and the internal sequence.
  IF (SELECT array_agg(c.column_name::text ORDER BY c.column_name) FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'session_semantic_clocks')
     <> ARRAY['current_sp','same_sp_event_sequence','session_id','user_id'] THEN
    RAISE EXCEPTION 'T-03B3 must not alter the Session Semantic Clock';
  END IF;
END$$;

COMMIT;
