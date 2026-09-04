-- T-03B1b1 - Durable Reference / Emerging Focus SP-Native Substrate +
-- Per-Moment Integrated DB Writer v1.
--
-- T-03B1a (merged) evaluates ONE committed CU at a time and returns a PREPARED,
-- transient result. This migration makes reference continuity and Emerging
-- Focus durable while preserving the frozen Stage-6 same-SP order:
--
--   1. CU is committed / receives SP
--   2. references + conversational focus are resolved          [this slice]
--   3. Emerging Focus continuity is resolved                   [this slice]
--   4. optional Thread establishment                           [T-03B2]
--   5. effective LF                                            [T-03D]
--
-- A later writer may not backdate new truth into a sealed SP, and the T-03A2
-- whole-batch producer seals every SP except the final head before any later
-- writer could run. So this migration builds the transaction shape in which,
-- for EVERY CU / Moment of a batch, in canonical source order:
--
--   allocate this CU's SP
--   -> make that SP the current open head
--   -> reserve the same-SP semantic sequence through the ONE T-03A2 seam
--   -> persist this CU's whole reference / focus semantic bundle at it
--   -> only then may the next CU advance the clock and seal this SP
--
-- What this migration is NOT:
--   * it is not runtime activation: the new writer, the new coordinator and
--     the new context read are granted to NO application role, the T-03A2
--     service_role grants are left exactly as they are, and no Product code
--     path reaches anything here until T-03B1b2 performs the activation;
--   * it is not Thread, Home, lifecycle, LF, `live_focus_transitions`,
--     LIVE_FOCUS_TRANSITION delivery, K/V/KF/VF/VT, PRE_FIRST_SP, historical
--     baseline/backfill, Timeline, Map or navigation - none of those has a
--     column, a function or a field here;
--   * it does not rewrite migration 0064 or 0065, and shares the same-SP seam
--     with 0065 by CALLING it rather than by creating a second sequence
--     authority;
--   * it backfills nothing and declares no Session historical-enabled.
--
-- Audit timestamps exist only as audit metadata. No timestamp decides SP,
-- identity, continuity, availability or ordering anywhere below.

BEGIN;

-- 0. Preconditions. The frozen UTF-8 contract still binds (anchor spans are
--    code-point coordinates verified by the database against the committed
--    wording), and the T-03A2 seam this migration reuses must exist.
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03B1b1 requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF to_regprocedure('public.reserve_session_same_sp_event_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'T-03B1b1 requires the T-03A2 Session Semantic Clock seam and the canonical commitment producer'
      USING ERRCODE='55000';
  END IF;
END$$;

-- 1. The durable semantic-batch identity. One row per committed-CU batch,
--    keyed on the T-03A1 batch id. `canonical_fingerprint` is DB-derived
--    SHA-256 over the canonicalized semantic payload plus provenance; SP, the
--    same-SP sequence and the audit timestamp are deliberately EXCLUDED from
--    it because they are allocation results, never caller payload identity.
--    Same batch id + identical canonical payload = replay; same batch id +
--    changed payload or provenance = fail closed.
CREATE TABLE public.conversation_focus_commit_batches (
  commit_batch_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  unit_count integer NOT NULL,
  canonical_fingerprint bytea NOT NULL,
  focus_evaluator_version text NOT NULL,
  focus_policy_version text NOT NULL,
  focus_provider text NOT NULL,
  focus_model text NOT NULL,
  focus_prompt_version text NOT NULL,
  focus_schema_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT focus_commit_batches_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT focus_commit_batches_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT focus_commit_batches_turn_fk
    FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
  CONSTRAINT focus_commit_batches_unit_count_check CHECK (unit_count >= 0),
  CONSTRAINT focus_commit_batches_digest_check CHECK (length(canonical_fingerprint) = 32),
  CONSTRAINT focus_commit_batches_provenance_check CHECK (
    length(btrim(focus_evaluator_version)) > 0 AND length(focus_evaluator_version) <= 64 AND
    length(btrim(focus_policy_version)) > 0 AND length(focus_policy_version) <= 64 AND
    length(btrim(focus_provider)) > 0 AND length(focus_provider) <= 64 AND
    length(btrim(focus_model)) > 0 AND length(focus_model) <= 128 AND
    length(btrim(focus_prompt_version)) > 0 AND length(focus_prompt_version) <= 64 AND
    focus_schema_version >= 1)
);

-- 2. Stable canonical reference identity. Session-scoped, born at the exact
--    (SP, same-SP sequence) of its first grounding. There is deliberately NO
--    normalized name, NO label inferred from wording, NO embedding and NO
--    entity-type ontology: identity is grounded through the resolution rows
--    below, never through a mutable display label. A handle may exist as a
--    Mention without any Emerging Focus row.
CREATE TABLE public.conversation_reference_handles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  first_cu_id uuid NOT NULL,
  first_sp integer NOT NULL,
  first_event_sequence bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reference_handles_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT reference_handles_first_cu_fk
    FOREIGN KEY (first_cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT reference_handles_first_sp_fk
    FOREIGN KEY (session_id, first_sp) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT reference_handles_first_check CHECK (first_sp >= 1 AND first_event_sequence >= 1)
);

CREATE INDEX reference_handles_session_idx
  ON public.conversation_reference_handles (session_id, first_sp, first_event_sequence);

-- 3. The durable CU semantic bundle: one append-only row per committed CU,
--    keyed on the canonical CU identity, carrying the frozen conversational
--    functions, sequence position and prior-CU target binding at the exact
--    (SP, same-SP sequence) the writer reserved for it. `session_position`
--    must equal the CU's own DB-allocated SP (composite FK); the same-SP
--    sequence is DB-allocated and never caller-supplied.
CREATE TABLE public.conversation_unit_focus_semantics (
  cu_id uuid PRIMARY KEY,
  focus_commit_batch_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  functions text[] NOT NULL,
  sequence_position text NOT NULL,
  target_cu_id uuid,
  CONSTRAINT cu_focus_semantics_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT cu_focus_semantics_batch_fk
    FOREIGN KEY (focus_commit_batch_id) REFERENCES public.conversation_focus_commit_batches (commit_batch_id) ON DELETE RESTRICT,
  CONSTRAINT cu_focus_semantics_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT cu_focus_semantics_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT cu_focus_semantics_target_fk
    FOREIGN KEY (target_cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT cu_focus_semantics_sp_unique UNIQUE (session_id, session_position),
  CONSTRAINT cu_focus_semantics_position_check CHECK (session_position >= 1 AND same_sp_event_sequence >= 1),
  CONSTRAINT cu_focus_semantics_functions_check CHECK (
    cardinality(functions) >= 1 AND cardinality(functions) <= 12
    AND functions <@ ARRAY['INFORM_REPORT','ASK','REQUEST','ACKNOWLEDGE','AGREE','DISAGREE_CHALLENGE','ELABORATE',
                           'CLARIFY','CORRECT','RECALL','FOCUS_SHIFT','FUNCTION_UNRESOLVED']::text[]
    AND (NOT ('FUNCTION_UNRESOLVED' = ANY (functions)) OR cardinality(functions) = 1)),
  CONSTRAINT cu_focus_semantics_sequence_check
    CHECK (sequence_position IN ('UNMARKED','INITIATING','RESPONSIVE','FOLLOW_UP')),
  CONSTRAINT cu_focus_semantics_target_self_check CHECK (target_cu_id IS NULL OR target_cu_id <> cu_id)
);

-- 4. Reference resolution rows: one per material reference in one CU, with
--    the exact extractive anchor and its code-point span, and exactly one of
--    the three frozen states. After canonicalization a T-03B1a
--    `newReference=true` is a normal RESOLVED row whose handle was first
--    grounded by this CU - `newReference` is NOT a durable Product state.
--    AMBIGUOUS candidates live in the append-only child table.
CREATE TABLE public.conversation_reference_resolutions (
  cu_id uuid NOT NULL,
  reference_index integer NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  anchor_text text NOT NULL,
  anchor_occurrence integer NOT NULL,
  span_start integer NOT NULL,
  span_end integer NOT NULL,
  state text NOT NULL,
  resolved_handle_id uuid,
  CONSTRAINT reference_resolutions_pkey PRIMARY KEY (cu_id, reference_index),
  CONSTRAINT reference_resolutions_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_unit_focus_semantics (cu_id) ON DELETE RESTRICT,
  CONSTRAINT reference_resolutions_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT reference_resolutions_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT reference_resolutions_handle_fk
    FOREIGN KEY (resolved_handle_id) REFERENCES public.conversation_reference_handles (id) ON DELETE RESTRICT,
  CONSTRAINT reference_resolutions_index_check CHECK (reference_index >= 0 AND reference_index < 32),
  CONSTRAINT reference_resolutions_position_check CHECK (session_position >= 1 AND same_sp_event_sequence >= 1),
  CONSTRAINT reference_resolutions_anchor_check CHECK (
    length(anchor_text) > 0 AND anchor_occurrence >= 1 AND span_start >= 0 AND span_end > span_start
    AND length(anchor_text) = span_end - span_start),
  CONSTRAINT reference_resolutions_state_check CHECK (state IN ('RESOLVED','AMBIGUOUS','UNRESOLVED')),
  CONSTRAINT reference_resolutions_identity_check CHECK ((state = 'RESOLVED') = (resolved_handle_id IS NOT NULL))
);

CREATE INDEX reference_resolutions_handle_idx
  ON public.conversation_reference_resolutions (resolved_handle_id, session_position, reference_index);

CREATE TABLE public.conversation_reference_resolution_candidates (
  cu_id uuid NOT NULL,
  reference_index integer NOT NULL,
  handle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  CONSTRAINT reference_candidates_pkey PRIMARY KEY (cu_id, reference_index, handle_id),
  CONSTRAINT reference_candidates_resolution_fk
    FOREIGN KEY (cu_id, reference_index) REFERENCES public.conversation_reference_resolutions (cu_id, reference_index) ON DELETE RESTRICT,
  CONSTRAINT reference_candidates_handle_fk
    FOREIGN KEY (handle_id) REFERENCES public.conversation_reference_handles (id) ON DELETE RESTRICT,
  CONSTRAINT reference_candidates_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT
);

-- 5. Claim attribution rows. Only the three CANONICAL claimant kinds are
--    representable; T-03B1a's prepared-only NEW_CURRENT_CU_REFERENCE pointer
--    canonicalizes to REFERENCE_HANDLE(<the stable handle created for that
--    reference>) BEFORE this boundary and is structurally unrepresentable
--    here. The conversational speaker is DB/source-derived on the CU row
--    itself and is never caller-authored claim attribution.
CREATE TABLE public.conversation_claim_attributions (
  cu_id uuid NOT NULL,
  attribution_index integer NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  anchor_text text NOT NULL,
  anchor_occurrence integer NOT NULL,
  span_start integer NOT NULL,
  span_end integer NOT NULL,
  claimant_kind text NOT NULL,
  claimant_handle_id uuid,
  claim_frame text NOT NULL,
  CONSTRAINT claim_attributions_pkey PRIMARY KEY (cu_id, attribution_index),
  CONSTRAINT claim_attributions_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_unit_focus_semantics (cu_id) ON DELETE RESTRICT,
  CONSTRAINT claim_attributions_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT claim_attributions_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT claim_attributions_handle_fk
    FOREIGN KEY (claimant_handle_id) REFERENCES public.conversation_reference_handles (id) ON DELETE RESTRICT,
  CONSTRAINT claim_attributions_index_check CHECK (attribution_index >= 0 AND attribution_index < 16),
  CONSTRAINT claim_attributions_position_check CHECK (session_position >= 1 AND same_sp_event_sequence >= 1),
  CONSTRAINT claim_attributions_anchor_check CHECK (
    length(anchor_text) > 0 AND anchor_occurrence >= 1 AND span_start >= 0 AND span_end > span_start
    AND length(anchor_text) = span_end - span_start),
  CONSTRAINT claim_attributions_kind_check
    CHECK (claimant_kind IN ('CURRENT_CONVERSATIONAL_SPEAKER','REFERENCE_HANDLE','UNRESOLVED')),
  CONSTRAINT claim_attributions_handle_check CHECK ((claimant_kind = 'REFERENCE_HANDLE') = (claimant_handle_id IS NOT NULL)),
  CONSTRAINT claim_attributions_frame_check
    CHECK (claim_frame IN ('DIRECT_ASSERTION','REPORTED_SPEECH','DIRECT_QUOTATION'))
);

-- 6. Stable provisional Emerging Focus identity. Session-scoped,
--    pre-geographic, NOT a Thread: there is no Thread id, no Home, no
--    lifecycle status, no LF field, no mutable "active" flag and no
--    importance/confidence score. UNIQUE(session_id, grounding_handle_id)
--    structurally prevents a second Emerging Focus for an already-represented
--    canonical locus; a genuine reframing (`Relationship with Ahmed`) stays
--    distinct because it is grounded by its own newly canonical handle.
CREATE TABLE public.conversation_emerging_focuses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  grounding_handle_id uuid NOT NULL,
  started_cu_id uuid NOT NULL,
  started_sp integer NOT NULL,
  started_event_sequence bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT emerging_focuses_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT emerging_focuses_handle_fk
    FOREIGN KEY (grounding_handle_id) REFERENCES public.conversation_reference_handles (id) ON DELETE RESTRICT,
  CONSTRAINT emerging_focuses_started_cu_fk
    FOREIGN KEY (started_cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT emerging_focuses_started_sp_fk
    FOREIGN KEY (session_id, started_sp) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT emerging_focuses_grounding_unique UNIQUE (session_id, grounding_handle_id),
  CONSTRAINT emerging_focuses_started_check CHECK (started_sp >= 1 AND started_event_sequence >= 1)
);

-- 7. Append-only Emerging Focus attention history: one row per CU semantic
--    decision, including NO_INDEPENDENT_FOCUS, which deletes or rewrites
--    nothing older. No focus-termination event and no LF departure semantic
--    exists here: T-03D owns effective Live Focus.
CREATE TABLE public.conversation_emerging_focus_attention_events (
  cu_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  attention_kind text NOT NULL,
  attention_reason text NOT NULL,
  emerging_focus_id uuid,
  grounding_reference_index integer,
  CONSTRAINT focus_attention_events_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_unit_focus_semantics (cu_id) ON DELETE RESTRICT,
  CONSTRAINT focus_attention_events_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT focus_attention_events_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT focus_attention_events_focus_fk
    FOREIGN KEY (emerging_focus_id) REFERENCES public.conversation_emerging_focuses (id) ON DELETE RESTRICT,
  CONSTRAINT focus_attention_events_grounding_fk
    FOREIGN KEY (cu_id, grounding_reference_index)
    REFERENCES public.conversation_reference_resolutions (cu_id, reference_index) ON DELETE RESTRICT,
  CONSTRAINT focus_attention_events_sp_unique UNIQUE (session_id, session_position),
  CONSTRAINT focus_attention_events_position_check CHECK (session_position >= 1 AND same_sp_event_sequence >= 1),
  CONSTRAINT focus_attention_events_kind_check
    CHECK (attention_kind IN ('NO_INDEPENDENT_FOCUS','ATTEND_EXISTING_FOCUS','START_NEW_FOCUS')),
  CONSTRAINT focus_attention_events_reason_check CHECK (
    (attention_kind = 'NO_INDEPENDENT_FOCUS'
       AND attention_reason IN ('INCIDENTAL_OR_SUBORDINATE','LOCAL_CLARIFICATION_OR_CORRECTION','UNRESOLVED_ATTENTION'))
    OR (attention_kind = 'ATTEND_EXISTING_FOCUS'
       AND attention_reason IN ('DIRECT_SUBJECT','DIRECT_REQUEST_OR_QUESTION','SUBSTANTIVE_ELABORATION',
                                'LOCAL_CLARIFICATION_OR_CORRECTION','EXPLICIT_FOCUS_SHIFT'))
    OR (attention_kind = 'START_NEW_FOCUS'
       AND attention_reason IN ('DIRECT_SUBJECT','EXPLICIT_FOCUS_SHIFT','DIRECT_REQUEST_OR_QUESTION','SUBSTANTIVE_ELABORATION'))),
  CONSTRAINT focus_attention_events_shape_check CHECK (
    (attention_kind = 'NO_INDEPENDENT_FOCUS' AND emerging_focus_id IS NULL AND grounding_reference_index IS NULL)
    OR (attention_kind = 'START_NEW_FOCUS' AND emerging_focus_id IS NOT NULL AND grounding_reference_index IS NOT NULL)
    OR (attention_kind = 'ATTEND_EXISTING_FOCUS' AND emerging_focus_id IS NOT NULL))
);

CREATE INDEX focus_attention_events_focus_idx
  ON public.conversation_emerging_focus_attention_events (emerging_focus_id, session_position, same_sp_event_sequence);
CREATE INDEX focus_attention_events_session_idx
  ON public.conversation_emerging_focus_attention_events (session_id, session_position DESC, same_sp_event_sequence DESC);

-- 8. Append-only enforcement, binding the owner too, exactly as 0064/0065 do.
--    Delete/reinsert identity rewriting is impossible for the same reason:
--    nothing can be removed, and every identity is a primary key.
CREATE FUNCTION public.reject_conversation_focus_semantic_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'CONVERSATIONAL_FOCUS_SEMANTIC_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Reference, claim and Emerging Focus semantics are append-only historical truth: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE TRIGGER conversation_focus_commit_batches_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_focus_commit_batches
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();
CREATE TRIGGER conversation_reference_handles_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_reference_handles
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();
CREATE TRIGGER conversation_unit_focus_semantics_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_unit_focus_semantics
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();
CREATE TRIGGER conversation_reference_resolutions_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_reference_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();
CREATE TRIGGER conversation_reference_resolution_candidates_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_reference_resolution_candidates
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();
CREATE TRIGGER conversation_claim_attributions_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_claim_attributions
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();
CREATE TRIGGER conversation_emerging_focuses_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_emerging_focuses
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();
CREATE TRIGGER conversation_emerging_focus_attention_events_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_emerging_focus_attention_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_focus_semantic_mutation_v1();

-- 9. Exact-anchor validation. The caller proposes `anchor_text` and an
--    `anchor_occurrence` together with a code-point span; the database
--    proves, against the committed wording it sliced itself, that the span is
--    inside the CU, that the substring at [span_start, span_end) equals the
--    anchor text exactly (PostgreSQL text functions count Unicode characters
--    under the frozen UTF8 server encoding), and that the named occurrence is
--    exactly the one at that span. No normalization, no fuzzy match.
CREATE FUNCTION public.validate_conversation_focus_anchor_v1(
  p_committed_text text,
  p_anchor jsonb,
  OUT anchor_text text,
  OUT anchor_occurrence integer,
  OUT span_start integer,
  OUT span_end integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  text_length integer := length(p_committed_text);
  earlier integer;
BEGIN
  IF jsonb_typeof(p_anchor -> 'anchor_text') <> 'string'
     OR jsonb_typeof(p_anchor -> 'anchor_occurrence') <> 'number'
     OR jsonb_typeof(p_anchor -> 'span_start') <> 'number'
     OR jsonb_typeof(p_anchor -> 'span_end') <> 'number'
     OR (p_anchor ->> 'anchor_occurrence') !~ '^[0-9]{1,9}$'
     OR (p_anchor ->> 'span_start') !~ '^[0-9]{1,9}$'
     OR (p_anchor ->> 'span_end') !~ '^[0-9]{1,9}$' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
      DETAIL='An anchor is exact text plus a 1-based occurrence and a code-point span; no other shape is representable.';
  END IF;
  anchor_text := p_anchor ->> 'anchor_text';
  anchor_occurrence := (p_anchor ->> 'anchor_occurrence')::integer;
  span_start := (p_anchor ->> 'span_start')::integer;
  span_end := (p_anchor ->> 'span_end')::integer;
  IF length(anchor_text) = 0 OR length(anchor_text) > 4000
     OR span_end <= span_start OR span_end > text_length
     OR length(anchor_text) <> span_end - span_start
     OR substring(p_committed_text from span_start + 1 for span_end - span_start) <> anchor_text THEN
    RAISE EXCEPTION 'NON_EXTRACTIVE_REFERENCE' USING ERRCODE='22023',
      DETAIL='The anchor is not the exact committed wording at the proposed code-point span.';
  END IF;
  -- The occurrence the caller named must be exactly the one at this span:
  -- 1 + the number of exact occurrences that start before span_start.
  SELECT count(*) INTO earlier
    FROM generate_series(0, span_start - 1) AS g(p)
   WHERE substring(p_committed_text from g.p + 1 for span_end - span_start) = anchor_text;
  IF anchor_occurrence < 1 OR anchor_occurrence <> earlier + 1 THEN
    RAISE EXCEPTION 'OCCURRENCE_OUT_OF_RANGE' USING ERRCODE='22023',
      DETAIL='The named occurrence is not the repetition at the proposed span.';
  END IF;
END;$$;

-- 10. Persisting ONE CU's semantic bundle at its reserved (SP, same-SP
--     sequence). Called by the integrated writer only, once per CU, right
--     after that CU's SP was allocated and opened. Every element of the
--     payload is revalidated here against the locked canonical rows: frozen
--     enums and cardinalities, exact anchors, same-Session handles and
--     focuses that are already legitimate for this CU, first grounding by
--     THIS CU, a prior same-Session target, and the START/ATTEND grounding
--     rules. service_role is never trusted Product truth.
CREATE FUNCTION public.persist_conversation_unit_focus_semantics_v1(
  p_cu public.conversation_units,
  p_focus_commit_batch_id uuid,
  p_bundle jsonb,
  p_event_sequence bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  function_vocabulary constant text[] := ARRAY['INFORM_REPORT','ASK','REQUEST','ACKNOWLEDGE','AGREE','DISAGREE_CHALLENGE',
    'ELABORATE','CLARIFY','CORRECT','RECALL','FOCUS_SHIFT','FUNCTION_UNRESOLVED'];
  sequence_vocabulary constant text[] := ARRAY['UNMARKED','INITIATING','RESPONSIVE','FOLLOW_UP'];
  cu_text text := p_cu.committed_text;
  functions text[];
  function_count integer;
  sequence_position text;
  target_cu uuid;
  entries jsonb;
  entry jsonb;
  idx integer;
  entry_count integer;
  a_text text;
  a_occurrence integer;
  a_start integer;
  a_end integer;
  ref_state text;
  ref_handle uuid;
  ref_creates boolean;
  ref_candidates uuid[];
  candidate uuid;
  ref_states text[] := ARRAY[]::text[];
  ref_handles uuid[] := ARRAY[]::uuid[];
  claimant_kind text;
  claimant_handle uuid;
  claim_frame text;
  attention jsonb;
  attention_kind text;
  attention_reason text;
  focus_id uuid;
  creates_focus boolean;
  grounding_index integer;
  grounding_handle uuid;
  focus_grounding_handle uuid;
  current_focus uuid;
BEGIN
  IF p_event_sequence IS NULL OR p_event_sequence < 1 THEN
    RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000';
  END IF;
  IF jsonb_typeof(p_bundle) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_bundle)) <> 7
     OR NOT (p_bundle ? 'unit_id') OR NOT (p_bundle ? 'functions') OR NOT (p_bundle ? 'sequence_position')
     OR NOT (p_bundle ? 'target_cu_id') OR NOT (p_bundle ? 'references')
     OR NOT (p_bundle ? 'claim_attributions') OR NOT (p_bundle ? 'attention') THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A semantic bundle carries exactly unit_id, functions, sequence_position, target_cu_id, references, claim_attributions and attention.';
  END IF;

  -- Conversational functions: frozen vocabulary, non-empty, distinct, and
  -- FUNCTION_UNRESOLVED standing alone (CU-04/05/06).
  IF jsonb_typeof(p_bundle -> 'functions') <> 'array' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_bundle -> 'functions') AS f(value) WHERE jsonb_typeof(f.value) <> 'string') THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(f.value ORDER BY f.ordinality) INTO functions
    FROM jsonb_array_elements_text(p_bundle -> 'functions') WITH ORDINALITY AS f(value, ordinality);
  function_count := COALESCE(cardinality(functions), 0);
  IF function_count = 0 OR function_count > 12 OR NOT (functions <@ function_vocabulary)
     OR (SELECT count(DISTINCT f) FROM unnest(functions) AS d(f)) <> function_count
     OR ('FUNCTION_UNRESOLVED' = ANY (functions) AND function_count <> 1) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_FUNCTION' USING ERRCODE='22023',
      DETAIL='Only the frozen conversational-function vocabulary is representable; FUNCTION_UNRESOLVED stands alone.';
  END IF;

  -- Sequence position and prior-CU target binding.
  IF jsonb_typeof(p_bundle -> 'sequence_position') <> 'string' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  sequence_position := p_bundle ->> 'sequence_position';
  IF NOT (sequence_position = ANY (sequence_vocabulary)) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Only the four frozen sequence positions are representable.';
  END IF;
  IF jsonb_typeof(p_bundle -> 'target_cu_id') = 'null' THEN
    target_cu := NULL;
  ELSIF jsonb_typeof(p_bundle -> 'target_cu_id') = 'string' AND (p_bundle ->> 'target_cu_id') ~* uuid_shape THEN
    target_cu := (p_bundle ->> 'target_cu_id')::uuid;
    -- A target is a PRIOR committed CU of the same Session and owner: never
    -- the current CU, never a later one, never another Session.
    IF NOT EXISTS (SELECT 1 FROM public.conversation_units t
                    WHERE t.id = target_cu AND t.session_id = p_cu.session_id AND t.user_id = p_cu.user_id
                      AND t.session_position < p_cu.session_position) THEN
      RAISE EXCEPTION 'UNKNOWN_TARGET_CU' USING ERRCODE='22023',
        DETAIL='A local target is a prior committed CU of the same Session.';
    END IF;
    IF sequence_position IN ('INITIATING', 'UNMARKED') THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='An initiating or unmarked contribution binds to no target.';
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.conversation_unit_focus_semantics (
    cu_id, focus_commit_batch_id, user_id, session_id, session_position, same_sp_event_sequence,
    functions, sequence_position, target_cu_id)
  VALUES (p_cu.id, p_focus_commit_batch_id, p_cu.user_id, p_cu.session_id, p_cu.session_position, p_event_sequence,
    functions, sequence_position, target_cu);

  -- References (CU-10 / CU-11 / CU-16), in index order: a handle first
  -- grounded by this CU becomes selectable for a later index of the same CU.
  entries := p_bundle -> 'references';
  IF jsonb_typeof(entries) <> 'array' OR jsonb_array_length(entries) > 32 THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  entry_count := jsonb_array_length(entries);
  FOR idx IN 0 .. entry_count - 1 LOOP
    entry := entries -> idx;
    IF jsonb_typeof(entry) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(entry)) <> 9
       OR NOT (entry ? 'reference_index') OR NOT (entry ? 'anchor_text') OR NOT (entry ? 'anchor_occurrence')
       OR NOT (entry ? 'span_start') OR NOT (entry ? 'span_end') OR NOT (entry ? 'state')
       OR NOT (entry ? 'resolved_handle_id') OR NOT (entry ? 'creates_handle') OR NOT (entry ? 'candidate_handle_ids')
       OR jsonb_typeof(entry -> 'reference_index') <> 'number' OR (entry ->> 'reference_index') <> idx::text
       OR jsonb_typeof(entry -> 'state') <> 'string'
       OR jsonb_typeof(entry -> 'creates_handle') <> 'boolean'
       OR jsonb_typeof(entry -> 'candidate_handle_ids') <> 'array'
       OR jsonb_typeof(entry -> 'resolved_handle_id') NOT IN ('null', 'string') THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A reference resolution carries exactly its ordered index, an exact anchor, one state, one optional handle, the creates_handle flag and the candidate list.';
    END IF;
    SELECT v.anchor_text, v.anchor_occurrence, v.span_start, v.span_end
      INTO a_text, a_occurrence, a_start, a_end
      FROM public.validate_conversation_focus_anchor_v1(cu_text, entry) v;

    ref_state := entry ->> 'state';
    IF ref_state NOT IN ('RESOLVED', 'AMBIGUOUS', 'UNRESOLVED') THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A reference is exactly one of RESOLVED, AMBIGUOUS or UNRESOLVED.';
    END IF;
    ref_creates := (entry ->> 'creates_handle')::boolean;
    IF jsonb_typeof(entry -> 'resolved_handle_id') = 'null' THEN
      ref_handle := NULL;
    ELSIF (entry ->> 'resolved_handle_id') ~* uuid_shape THEN
      ref_handle := (entry ->> 'resolved_handle_id')::uuid;
    ELSE
      RAISE EXCEPTION 'UNKNOWN_REFERENCE_HANDLE' USING ERRCODE='22023',
        DETAIL='Only a canonical stable handle UUID is representable; prepared identities never cross this boundary.';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(entry -> 'candidate_handle_ids') AS c(value)
                WHERE jsonb_typeof(c.value) <> 'string' OR (c.value #>> '{}') !~* uuid_shape) THEN
      RAISE EXCEPTION 'UNKNOWN_REFERENCE_HANDLE' USING ERRCODE='22023';
    END IF;
    SELECT COALESCE(array_agg((c.value #>> '{}')::uuid), ARRAY[]::uuid[]) INTO ref_candidates
      FROM jsonb_array_elements(entry -> 'candidate_handle_ids') AS c(value);
    -- Every named candidate must be a same-Session handle BEFORE cardinality
    -- is judged (exactly as the T-03B1a validator orders it), so an invented
    -- or foreign identity is reported as such rather than as a count problem.
    FOREACH candidate IN ARRAY ref_candidates LOOP
      IF NOT EXISTS (SELECT 1 FROM public.conversation_reference_handles h
                      WHERE h.id = candidate AND h.session_id = p_cu.session_id AND h.user_id = p_cu.user_id) THEN
        RAISE EXCEPTION 'UNKNOWN_REFERENCE_HANDLE' USING ERRCODE='22023',
          DETAIL='An ambiguity candidate must be an already-legitimate handle of this Session.';
      END IF;
    END LOOP;

    IF ref_state = 'RESOLVED' THEN
      IF ref_handle IS NULL OR cardinality(ref_candidates) <> 0 THEN
        RAISE EXCEPTION 'INVALID_REFERENCE_CARDINALITY' USING ERRCODE='22023',
          DETAIL='RESOLVED asserts exactly one handle and no ambiguous candidate.';
      END IF;
      IF ref_creates THEN
        -- A new handle is first grounded by THIS CU only.
        IF EXISTS (SELECT 1 FROM public.conversation_reference_handles h WHERE h.id = ref_handle) THEN
          RAISE EXCEPTION 'REFERENCE_HANDLE_ALREADY_GROUNDED' USING ERRCODE='22023',
            DETAIL='A new handle cannot claim first grounding in a different, prior or future CU.';
        END IF;
        INSERT INTO public.conversation_reference_handles (id, user_id, session_id, first_cu_id, first_sp, first_event_sequence)
        VALUES (ref_handle, p_cu.user_id, p_cu.session_id, p_cu.id, p_cu.session_position, p_event_sequence);
      ELSIF NOT EXISTS (SELECT 1 FROM public.conversation_reference_handles h
                         WHERE h.id = ref_handle AND h.session_id = p_cu.session_id AND h.user_id = p_cu.user_id) THEN
        RAISE EXCEPTION 'UNKNOWN_REFERENCE_HANDLE' USING ERRCODE='22023',
          DETAIL='A resolved handle must already be legitimate in this Session before this reference.';
      END IF;
    ELSIF ref_state = 'AMBIGUOUS' THEN
      IF ref_handle IS NOT NULL OR ref_creates
         OR (SELECT count(DISTINCT c) FROM unnest(ref_candidates) AS d(c)) < 2
         OR (SELECT count(DISTINCT c) FROM unnest(ref_candidates) AS d(c)) <> cardinality(ref_candidates) THEN
        RAISE EXCEPTION 'INVALID_REFERENCE_CARDINALITY' USING ERRCODE='22023',
          DETAIL='AMBIGUOUS asserts no identity and at least two distinct candidate handles.';
      END IF;
    ELSIF ref_handle IS NOT NULL OR ref_creates OR cardinality(ref_candidates) <> 0 THEN
      RAISE EXCEPTION 'INVALID_REFERENCE_CARDINALITY' USING ERRCODE='22023',
        DETAIL='UNRESOLVED asserts no identity at all.';
    END IF;

    INSERT INTO public.conversation_reference_resolutions (
      cu_id, reference_index, user_id, session_id, session_position, same_sp_event_sequence,
      anchor_text, anchor_occurrence, span_start, span_end, state, resolved_handle_id)
    VALUES (p_cu.id, idx, p_cu.user_id, p_cu.session_id, p_cu.session_position, p_event_sequence,
      a_text, a_occurrence, a_start, a_end, ref_state, ref_handle);
    FOREACH candidate IN ARRAY ref_candidates LOOP
      INSERT INTO public.conversation_reference_resolution_candidates (cu_id, reference_index, handle_id, user_id, session_id)
      VALUES (p_cu.id, idx, candidate, p_cu.user_id, p_cu.session_id);
    END LOOP;
    ref_states := array_append(ref_states, ref_state);
    ref_handles := array_append(ref_handles, ref_handle);
  END LOOP;

  -- Claim attributions (CU-13 / CU-14). Only the three canonical claimant
  -- kinds are representable; a handle created by THIS CU's references is a
  -- legitimate claimant.
  entries := p_bundle -> 'claim_attributions';
  IF jsonb_typeof(entries) <> 'array' OR jsonb_array_length(entries) > 16 THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  entry_count := jsonb_array_length(entries);
  FOR idx IN 0 .. entry_count - 1 LOOP
    entry := entries -> idx;
    IF jsonb_typeof(entry) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_CLAIM_ATTRIBUTION' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(entry)) <> 8
       OR NOT (entry ? 'attribution_index') OR NOT (entry ? 'anchor_text') OR NOT (entry ? 'anchor_occurrence')
       OR NOT (entry ? 'span_start') OR NOT (entry ? 'span_end') OR NOT (entry ? 'claimant_kind')
       OR NOT (entry ? 'claimant_handle_id') OR NOT (entry ? 'claim_frame')
       OR jsonb_typeof(entry -> 'attribution_index') <> 'number' OR (entry ->> 'attribution_index') <> idx::text
       OR jsonb_typeof(entry -> 'claimant_kind') <> 'string' OR jsonb_typeof(entry -> 'claim_frame') <> 'string'
       OR jsonb_typeof(entry -> 'claimant_handle_id') NOT IN ('null', 'string') THEN
      RAISE EXCEPTION 'INVALID_CLAIM_ATTRIBUTION' USING ERRCODE='22023';
    END IF;
    SELECT v.anchor_text, v.anchor_occurrence, v.span_start, v.span_end
      INTO a_text, a_occurrence, a_start, a_end
      FROM public.validate_conversation_focus_anchor_v1(cu_text, entry) v;
    claimant_kind := entry ->> 'claimant_kind';
    claim_frame := entry ->> 'claim_frame';
    IF claimant_kind NOT IN ('CURRENT_CONVERSATIONAL_SPEAKER', 'REFERENCE_HANDLE', 'UNRESOLVED')
       OR claim_frame NOT IN ('DIRECT_ASSERTION', 'REPORTED_SPEECH', 'DIRECT_QUOTATION') THEN
      RAISE EXCEPTION 'INVALID_CLAIM_ATTRIBUTION' USING ERRCODE='22023',
        DETAIL='Only the canonical claimant kinds and the frozen claim frames are representable; NEW_CURRENT_CU_REFERENCE is prepared-only.';
    END IF;
    IF jsonb_typeof(entry -> 'claimant_handle_id') = 'null' THEN
      claimant_handle := NULL;
    ELSIF (entry ->> 'claimant_handle_id') ~* uuid_shape THEN
      claimant_handle := (entry ->> 'claimant_handle_id')::uuid;
    ELSE
      RAISE EXCEPTION 'UNKNOWN_REFERENCE_HANDLE' USING ERRCODE='22023';
    END IF;
    IF (claimant_kind = 'REFERENCE_HANDLE') <> (claimant_handle IS NOT NULL) THEN
      RAISE EXCEPTION 'INVALID_CLAIM_ATTRIBUTION' USING ERRCODE='22023',
        DETAIL='REFERENCE_HANDLE carries exactly one handle; the other claimant kinds carry none.';
    END IF;
    IF claimant_handle IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.conversation_reference_handles h
       WHERE h.id = claimant_handle AND h.session_id = p_cu.session_id AND h.user_id = p_cu.user_id) THEN
      RAISE EXCEPTION 'UNKNOWN_REFERENCE_HANDLE' USING ERRCODE='22023',
        DETAIL='A claimant handle must belong to this Session.';
    END IF;
    INSERT INTO public.conversation_claim_attributions (
      cu_id, attribution_index, user_id, session_id, session_position, same_sp_event_sequence,
      anchor_text, anchor_occurrence, span_start, span_end, claimant_kind, claimant_handle_id, claim_frame)
    VALUES (p_cu.id, idx, p_cu.user_id, p_cu.session_id, p_cu.session_position, p_event_sequence,
      a_text, a_occurrence, a_start, a_end, claimant_kind, claimant_handle, claim_frame);
  END LOOP;

  -- Independent attention (THR-01 / THR-02 / THR-11).
  attention := p_bundle -> 'attention';
  IF jsonb_typeof(attention) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(attention)) <> 5
     OR NOT (attention ? 'kind') OR NOT (attention ? 'reason') OR NOT (attention ? 'emerging_focus_id')
     OR NOT (attention ? 'creates_focus') OR NOT (attention ? 'grounding_reference_index')
     OR jsonb_typeof(attention -> 'kind') <> 'string' OR jsonb_typeof(attention -> 'reason') <> 'string'
     OR jsonb_typeof(attention -> 'creates_focus') <> 'boolean'
     OR jsonb_typeof(attention -> 'emerging_focus_id') NOT IN ('null', 'string')
     OR jsonb_typeof(attention -> 'grounding_reference_index') NOT IN ('null', 'number') THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Attention carries exactly kind, reason, emerging_focus_id, creates_focus and grounding_reference_index.';
  END IF;
  attention_kind := attention ->> 'kind';
  attention_reason := attention ->> 'reason';
  creates_focus := (attention ->> 'creates_focus')::boolean;
  IF NOT (
       (attention_kind = 'NO_INDEPENDENT_FOCUS'
          AND attention_reason IN ('INCIDENTAL_OR_SUBORDINATE','LOCAL_CLARIFICATION_OR_CORRECTION','UNRESOLVED_ATTENTION'))
    OR (attention_kind = 'ATTEND_EXISTING_FOCUS'
          AND attention_reason IN ('DIRECT_SUBJECT','DIRECT_REQUEST_OR_QUESTION','SUBSTANTIVE_ELABORATION',
                                   'LOCAL_CLARIFICATION_OR_CORRECTION','EXPLICIT_FOCUS_SHIFT'))
    OR (attention_kind = 'START_NEW_FOCUS'
          AND attention_reason IN ('DIRECT_SUBJECT','EXPLICIT_FOCUS_SHIFT','DIRECT_REQUEST_OR_QUESTION','SUBSTANTIVE_ELABORATION'))) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Only the three frozen attention kinds with their permitted reasons are representable.';
  END IF;
  IF jsonb_typeof(attention -> 'emerging_focus_id') = 'null' THEN
    focus_id := NULL;
  ELSIF (attention ->> 'emerging_focus_id') ~* uuid_shape THEN
    focus_id := (attention ->> 'emerging_focus_id')::uuid;
  ELSE
    RAISE EXCEPTION 'UNKNOWN_FOCUS_CANDIDATE' USING ERRCODE='22023',
      DETAIL='Only a canonical stable emerging_focus_id is representable; prepared identities never cross this boundary.';
  END IF;
  IF jsonb_typeof(attention -> 'grounding_reference_index') = 'null' THEN
    grounding_index := NULL;
  ELSIF (attention ->> 'grounding_reference_index') ~ '^[0-9]{1,2}$' THEN
    grounding_index := (attention ->> 'grounding_reference_index')::integer;
  ELSE
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF grounding_index IS NOT NULL THEN
    IF grounding_index >= cardinality(ref_states) OR ref_states[grounding_index + 1] <> 'RESOLVED' THEN
      RAISE EXCEPTION 'FOCUS_GROUNDING_REQUIRED' USING ERRCODE='22023',
        DETAIL='Focus grounding names a RESOLVED reference of this same CU.';
    END IF;
    grounding_handle := ref_handles[grounding_index + 1];
  END IF;

  IF attention_kind = 'NO_INDEPENDENT_FOCUS' THEN
    IF focus_id IS NOT NULL OR creates_focus OR grounding_index IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='NO_INDEPENDENT_FOCUS carries no focus identity and no grounding.';
    END IF;
  ELSIF attention_kind = 'START_NEW_FOCUS' THEN
    IF focus_id IS NULL OR NOT creates_focus THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='START_NEW_FOCUS creates exactly one new stable focus identity.';
    END IF;
    IF grounding_index IS NULL THEN
      RAISE EXCEPTION 'FOCUS_GROUNDING_REQUIRED' USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.conversation_emerging_focuses f WHERE f.id = focus_id) THEN
      RAISE EXCEPTION 'EMERGING_FOCUS_ALREADY_EXISTS' USING ERRCODE='22023';
    END IF;
    -- Continuity follows resolved identity: an already-represented locus is
    -- attended, never minted twice. The UNIQUE constraint is the structural
    -- backstop behind this typed rejection.
    IF EXISTS (SELECT 1 FROM public.conversation_emerging_focuses f
                WHERE f.session_id = p_cu.session_id AND f.grounding_handle_id = grounding_handle) THEN
      RAISE EXCEPTION 'EXISTING_FOCUS_CONTINUITY_REQUIRED' USING ERRCODE='22023',
        DETAIL='This identity already grounds an Emerging Focus of the Session; attend it instead of starting a second one.';
    END IF;
    INSERT INTO public.conversation_emerging_focuses (
      id, user_id, session_id, grounding_handle_id, started_cu_id, started_sp, started_event_sequence)
    VALUES (focus_id, p_cu.user_id, p_cu.session_id, grounding_handle, p_cu.id, p_cu.session_position, p_event_sequence);
  ELSE
    IF focus_id IS NULL OR creates_focus THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='ATTEND_EXISTING_FOCUS names an existing focus and creates none.';
    END IF;
    SELECT f.grounding_handle_id INTO focus_grounding_handle
      FROM public.conversation_emerging_focuses f
     WHERE f.id = focus_id AND f.session_id = p_cu.session_id AND f.user_id = p_cu.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'UNKNOWN_FOCUS_CANDIDATE' USING ERRCODE='22023',
        DETAIL='An attended focus must already exist in this Session before this CU.';
    END IF;
    IF grounding_index IS NOT NULL THEN
      IF grounding_handle IS DISTINCT FROM focus_grounding_handle THEN
        RAISE EXCEPTION 'UNGROUNDED_FOCUS_CONTINUITY' USING ERRCODE='22023',
          DETAIL='Identity-specific continuity needs a RESOLVED reference to the handle that grounds the focus.';
      END IF;
    ELSE
      -- The accepted T-03B1a local-continuation rule, re-established here:
      -- the attended focus is the CURRENT focus (latest START/ATTEND by
      -- (SP, same-SP sequence)) and this CU asserts no AMBIGUOUS or
      -- UNRESOLVED reference at all.
      SELECT e.emerging_focus_id INTO current_focus
        FROM public.conversation_emerging_focus_attention_events e
       WHERE e.session_id = p_cu.session_id
         AND e.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS')
       ORDER BY e.session_position DESC, e.same_sp_event_sequence DESC
       LIMIT 1;
      IF current_focus IS DISTINCT FROM focus_id
         OR EXISTS (SELECT 1 FROM unnest(ref_states) AS s(state) WHERE s.state <> 'RESOLVED') THEN
        RAISE EXCEPTION 'UNGROUNDED_FOCUS_CONTINUITY' USING ERRCODE='22023',
          DETAIL='Identity-free continuation is legitimate only for the current focus and only when every reference of the CU is RESOLVED.';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.conversation_emerging_focus_attention_events (
    cu_id, user_id, session_id, session_position, same_sp_event_sequence,
    attention_kind, attention_reason, emerging_focus_id, grounding_reference_index)
  VALUES (p_cu.id, p_cu.user_id, p_cu.session_id, p_cu.session_position, p_event_sequence,
    attention_kind, attention_reason, focus_id, grounding_index);
END;$$;

-- 11. The integrated per-Moment writer. Production-inert: granted to no
--     application role. It preserves the ENTIRE 0064/0065 commitment
--     contract (identity, provenance, structural payload validation, source
--     frontier, global ordinal, DB-sliced wording, digest, replay identity,
--     delivery event) and adds, INSIDE the same clock-locked transaction, the
--     per-CU semantic write at the exact SP the CU was born at.
--
--     AF66-01 lock order, provable from the deployed body:
--
--       Session Semantic Clock FOR UPDATE  ->  source turn  ->  semantic rows
--
--     The per-CU loop (§9.2):
--
--       A  the commitment invariants were established above for the batch
--       B  insert this CU with its next SP
--       C  set clock.current_sp = this SP
--       D  reset same_sp_event_sequence = 0 for the newly opened SP
--       E  call reserve_session_same_sp_event_v1 (the ONE sequence authority)
--       F  require returned SP == this CU's SP and sequence == 1
--       G  persist the entire T-03B1 semantic bundle at that sequence
--       H  only then continue with the next CU, which seals this one
--
--     T-03B2 (Thread) and T-03D (LF) extend this loop by inserting their own
--     same-SP steps between G and H; nothing here forces them to backdate.
CREATE FUNCTION public.commit_conversation_units_with_focus_v1(
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
  p_focus_schema_version integer
) RETURNS SETOF public.conversation_units
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  max_units constant integer := 64;
  clock_row public.session_semantic_clocks;
  session_row public.conversation_sessions;
  turn_row public.conversation_turns;
  batch_row public.conversation_unit_commit_batches;
  focus_batch_row public.conversation_focus_commit_batches;
  inserted_cu public.conversation_units;
  derived_digest bytea;
  derived_modality constant text := 'TEXT';
  derived_speaker constant text := 'RESOLVED';
  source_length integer;
  unit_count integer;
  unit jsonb;
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
  canonical jsonb;
  fingerprint bytea;
  focus_canonical jsonb;
  focus_fingerprint bytea;
  is_replay boolean := false;
  inserted_batches integer;
  stored_semantics integer;
  stored_attention integer;
BEGIN
  ---------------------------------------------------------------------------
  -- COMMON SETUP: parameter structure, THE SESSION CLOCK LOCK, identity,
  -- source lock, canonical derivation, structural validation of both ordered
  -- payloads and their 1:1 unit mapping.
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
    RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Exactly one semantic bundle corresponds to exactly one proposed committed CU, in the same order.';
  END IF;

  -- AF66-01: the Session Semantic Clock is the FIRST lock of the semantic
  -- transaction, taken before the source turn and before any semantic row.
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
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_ROLE' USING ERRCODE='22023',
      DETAIL='Only USER and ASSISTANT conversational source is committable in v1.';
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

    -- 1:1 mapping between the commitment payload and the semantic payload,
    -- in order: no missing, extra or duplicate semantic unit.
    unit := p_focus_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
    END IF;
    -- The shape test is its own statement: SQL does not guarantee that OR
    -- short-circuits, and the uuid cast raises on a malformed string.
    IF NOT (unit ? 'unit_id') OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR (unit ->> 'unit_id') !~* uuid_shape THEN
      RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
        DETAIL='Each semantic bundle names the proposed CU it belongs to, in the same order.';
    END IF;
    IF (unit ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
        DETAIL='Each semantic bundle names the proposed CU it belongs to, in the same order.';
    END IF;
  END LOOP;
  IF unit_count > 1 AND (SELECT count(DISTINCT d.u) FROM unnest(unit_ids) AS d(u)) <> unit_count THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Unit identities inside a commitment batch must be distinct.';
  END IF;

  -- The DB-derived canonical commitment fingerprint, byte-identical to 0065's
  -- derivation so both writers recognise the same batch identity.
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

  -- The DB-derived canonical SEMANTIC fingerprint: canonicalized payload plus
  -- focus provenance. SP, the same-SP sequence and audit time are excluded.
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

  SELECT * INTO batch_row FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id;
  IF FOUND THEN is_replay := true; END IF;

  ---------------------------------------------------------------------------
  -- PATH B - NEW BATCH COMMIT: the forward-only source frontier, then the
  -- per-Moment loop under the clock lock taken above.
  ---------------------------------------------------------------------------
  IF NOT is_replay THEN
    SELECT COALESCE(MAX(cu.source_span_end), 0), COALESCE(MAX(cu.ordinal_within_turn) + 1, 0)
      INTO frontier, next_ordinal
      FROM public.conversation_units cu WHERE cu.source_turn_id = turn_row.id;

    IF unit_count > 0 AND span_starts[1] < frontier THEN
      RAISE EXCEPTION 'SPAN_BEFORE_SOURCE_FRONTIER' USING ERRCODE='22023',
        DETAIL='A later commitment batch may only append source material after the committed source frontier of its turn.';
    END IF;

    INSERT INTO public.conversation_unit_commit_batches (
      id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
      unit_count, evaluator_version, policy_version,
      segmentation_provider, segmentation_model, segmentation_prompt_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, fingerprint, derived_digest,
      unit_count, p_evaluator_version, p_policy_version,
      p_segmentation_provider, p_segmentation_model, p_segmentation_prompt_version)
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS inserted_batches = ROW_COUNT;

    IF inserted_batches = 0 THEN
      SELECT * INTO batch_row FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id;
      is_replay := true;
    ELSE
      INSERT INTO public.conversation_focus_commit_batches (
        commit_batch_id, user_id, session_id, source_turn_id, unit_count, canonical_fingerprint,
        focus_evaluator_version, focus_policy_version, focus_provider, focus_model,
        focus_prompt_version, focus_schema_version)
      VALUES (
        p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, focus_fingerprint,
        p_focus_evaluator_version, p_focus_policy_version, p_focus_provider, p_focus_model,
        p_focus_prompt_version, p_focus_schema_version);

      -- A ZERO-CU batch is a complete evaluation batch: no SP, no reservation,
      -- no semantic row, no attention event, no delivery event, both clock
      -- coordinates untouched.
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

        -- C + D: this SP becomes the open head; every earlier SP is thereby
        -- sealed, WITH its semantics already in place.
        UPDATE public.session_semantic_clocks c
           SET current_sp = this_sp, same_sp_event_sequence = 0
         WHERE c.session_id = turn_row.session_id;

        -- E + F: the ONE same-SP sequence authority, re-acquiring the clock
        -- lock this transaction already holds.
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 1::bigint THEN
          RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
            DETAIL='The first Stage-6 semantic layer after commitment is sequence 1 on the SP the CU was born at.';
        END IF;

        -- G: the whole semantic bundle of this CU, at (this_sp, 1).
        PERFORM public.persist_conversation_unit_focus_semantics_v1(
          inserted_cu, p_batch_id, p_focus_units -> (idx - 1), reserved_sequence);
        -- H: continue with the next CU.
      END LOOP;

      INSERT INTO public.conversation_unit_commit_events (
        commit_batch_id, user_id, session_id, source_turn_id, first_sp, last_sp, unit_count)
      VALUES (p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, first_sp, this_sp, unit_count);

      RETURN QUERY SELECT cu.* FROM public.conversation_units cu
        WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
      RETURN;
    END IF;
  END IF;

  ---------------------------------------------------------------------------
  -- PATH A - EXISTING BATCH REPLAY. The canonical 0065 producer verifies the
  -- stored commitment identity tuple by tuple with zero mutation and without
  -- re-checking today's frontier; then the semantic batch must exist, must
  -- carry the same DB-derived semantic fingerprint and provenance, and must
  -- be structurally complete. Partial semantic state is an integrity failure
  -- that is never repaired from today's inference.
  ---------------------------------------------------------------------------
  PERFORM * FROM public.commit_conversation_units_v1(
    p_session_id, p_user_id, p_source_turn_id, p_batch_id, p_units,
    p_evaluator_version, p_policy_version, p_segmentation_provider,
    p_segmentation_model, p_segmentation_prompt_version);

  SELECT * INTO focus_batch_row FROM public.conversation_focus_commit_batches f WHERE f.commit_batch_id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FOCUS_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='A committed CU batch without its focus semantic batch is partial semantic state; it is never silently repaired or backfilled.';
  END IF;
  IF focus_batch_row.user_id <> turn_row.user_id
     OR focus_batch_row.session_id <> turn_row.session_id
     OR focus_batch_row.source_turn_id <> turn_row.id
     OR focus_batch_row.unit_count <> unit_count
     OR focus_batch_row.focus_evaluator_version <> p_focus_evaluator_version
     OR focus_batch_row.focus_policy_version <> p_focus_policy_version
     OR focus_batch_row.focus_provider <> p_focus_provider
     OR focus_batch_row.focus_model <> p_focus_model
     OR focus_batch_row.focus_prompt_version <> p_focus_prompt_version
     OR focus_batch_row.focus_schema_version <> p_focus_schema_version
     OR focus_batch_row.canonical_fingerprint IS DISTINCT FROM focus_fingerprint THEN
    RAISE EXCEPTION 'FOCUS_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023',
      DETAIL='A semantic batch identity is immutable: the same batch id can never be replayed with different semantics or provenance.';
  END IF;

  SELECT count(*) INTO stored_semantics FROM public.conversation_unit_focus_semantics s
    WHERE s.focus_commit_batch_id = p_batch_id;
  SELECT count(*) INTO stored_attention FROM public.conversation_emerging_focus_attention_events e
    JOIN public.conversation_units cu ON cu.id = e.cu_id
    WHERE cu.commit_batch_id = p_batch_id;
  IF stored_semantics <> unit_count OR stored_attention <> unit_count
     OR EXISTS (SELECT 1 FROM public.conversation_unit_focus_semantics s
                  JOIN public.conversation_units cu ON cu.id = s.cu_id
                 WHERE s.focus_commit_batch_id = p_batch_id
                   AND (s.session_position <> cu.session_position OR s.session_id <> cu.session_id
                        OR s.user_id <> cu.user_id OR cu.commit_batch_id <> p_batch_id)) THEN
    RAISE EXCEPTION 'FOCUS_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='The stored semantic bundles of this batch are incomplete or disagree with their committed CUs.';
  END IF;

  RETURN QUERY SELECT cu.* FROM public.conversation_units cu
    WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
  RETURN;
END;$$;

-- 12. The atomic finalized-exchange coordinator with stale-context
--     protection. Production-inert: granted to no application role.
--
--     Takes the ONE Session clock FIRST and holds it across both blocks; then
--     locks the two source rows and proves the finalized-exchange RELATION
--     exactly as 0065 does (FIX-T03A2-01). When BOTH batches already exist the
--     call is an exact replay: it returns the stored canonical pair with zero
--     mutation and does not consult the token. Otherwise, BEFORE any canonical
--     mutation, the expected semantic-clock token (current_sp, same-SP
--     sequence) the caller evaluated against must equal the locked actual
--     token; a mismatch is STALE_CONVERSATIONAL_FOCUS_CONTEXT with zero
--     mutation. The provider evaluation of T-03B1b2 will run OUTSIDE this lock
--     and hand in the token it read; the clock is never held across a
--     provider call. Before the first SP the token is (NULL, 0) - a technical
--     absence, not PRE_FIRST_SP.
CREATE FUNCTION public.commit_finalized_exchange_with_focus_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_user_source_turn_id uuid,
  p_user_batch_id uuid,
  p_user_units jsonb,
  p_user_focus_units jsonb,
  p_assistant_source_turn_id uuid,
  p_assistant_batch_id uuid,
  p_assistant_units jsonb,
  p_assistant_focus_units jsonb,
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
  p_expected_current_sp integer,
  p_expected_same_sp_event_sequence bigint
) RETURNS TABLE(
  live_head integer,
  same_sp_event_sequence bigint,
  user_units jsonb,
  assistant_units jsonb,
  user_event jsonb,
  assistant_event jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  user_turn_row public.conversation_turns;
  assistant_turn_row public.conversation_turns;
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

  -- AF66-01: exactly ONE Session clock, acquired FIRST and held for the whole
  -- exchange transaction.
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

  -- Stale-context protection: after the clock lock, before any canonical
  -- mutation. An exact replay of an already-committed pair needs no token.
  both_exist := EXISTS (SELECT 1 FROM public.conversation_unit_commit_batches b WHERE b.id = p_user_batch_id)
            AND EXISTS (SELECT 1 FROM public.conversation_unit_commit_batches b WHERE b.id = p_assistant_batch_id);
  IF NOT both_exist
     AND (clock_row.current_sp IS DISTINCT FROM p_expected_current_sp
          OR clock_row.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence) THEN
    RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' USING ERRCODE='40001',
      DETAIL='The Session Semantic Clock moved after the prior context was read; nothing was written. Re-read the context and evaluate again.';
  END IF;

  -- USER block first, ASSISTANT block second: canonical conversational order.
  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
    INTO user_units
    FROM public.commit_conversation_units_with_focus_v1(
      p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id, p_user_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_user_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal_within_turn), '[]'::jsonb)
    INTO assistant_units
    FROM public.commit_conversation_units_with_focus_v1(
      p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_assistant_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version) a;

  SELECT c.current_sp, c.same_sp_event_sequence INTO live_head, same_sp_event_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  SELECT to_jsonb(e) INTO user_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_user_batch_id;
  SELECT to_jsonb(e) INTO assistant_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_assistant_batch_id;
  RETURN NEXT;
END;$$;

-- 13. The internal authoritative focus-context snapshot. Production-inert:
--     granted to no application role. T-03B1b2 will seed the T-03B1a
--     evaluator from it. It returns the optimistic clock token plus every
--     prior CU in SP order, every reference handle with its exact committed
--     surface grounding (same-name handles stay distinguishable), every
--     Emerging Focus as a candidate keyed on its durable id with its START /
--     ATTEND history, and the current focus candidate = the latest START /
--     ATTEND by (SP, same-SP sequence). A later NO_INDEPENDENT_FOCUS does not
--     erase that continuity context, and no timestamp influences any order.
CREATE FUNCTION public.get_conversation_focus_runtime_context_v1(
  p_session_id uuid,
  p_user_id uuid
) RETURNS TABLE(
  base_current_sp integer,
  base_same_sp_event_sequence bigint,
  prior_cus jsonb,
  reference_handles jsonb,
  focus_candidates jsonb,
  current_focus_candidate_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  base_current_sp := clock_row.current_sp;
  base_same_sp_event_sequence := clock_row.same_sp_event_sequence;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'cu_id', cu.id,
           'source_turn_id', cu.source_turn_id,
           'source_role', cu.source_role,
           'committed_text', cu.committed_text,
           'ordinal_within_turn', cu.ordinal_within_turn,
           'session_position', cu.session_position,
           'functions', to_jsonb(s.functions),
           'sequence_position', s.sequence_position,
           'target_cu_id', s.target_cu_id) ORDER BY cu.session_position), '[]'::jsonb)
    INTO prior_cus
    FROM public.conversation_units cu
    LEFT JOIN public.conversation_unit_focus_semantics s ON s.cu_id = cu.id
   WHERE cu.session_id = p_session_id AND cu.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'handle_id', h.id,
           'grounding', (
             SELECT COALESCE(jsonb_agg(jsonb_build_object('cu_id', r.cu_id, 'exact_surface', r.anchor_text)
                                       ORDER BY r.session_position, r.reference_index), '[]'::jsonb)
               FROM public.conversation_reference_resolutions r
              WHERE r.resolved_handle_id = h.id AND r.state = 'RESOLVED'))
           ORDER BY h.first_sp, h.first_event_sequence, h.id), '[]'::jsonb)
    INTO reference_handles
    FROM public.conversation_reference_handles h
   WHERE h.session_id = p_session_id AND h.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'focus_candidate_id', f.id,
           'grounding_handle_ids', jsonb_build_array(f.grounding_handle_id),
           'prior_grounding_cu_ids', (
             SELECT COALESCE(jsonb_agg(e.cu_id ORDER BY e.session_position, e.same_sp_event_sequence), '[]'::jsonb)
               FROM public.conversation_emerging_focus_attention_events e
              WHERE e.emerging_focus_id = f.id
                AND e.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS')))
           ORDER BY f.started_sp, f.started_event_sequence, f.id), '[]'::jsonb)
    INTO focus_candidates
    FROM public.conversation_emerging_focuses f
   WHERE f.session_id = p_session_id AND f.user_id = p_user_id;

  SELECT e.emerging_focus_id INTO current_focus_candidate_id
    FROM public.conversation_emerging_focus_attention_events e
   WHERE e.session_id = p_session_id AND e.user_id = p_user_id
     AND e.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS')
   ORDER BY e.session_position DESC, e.same_sp_event_sequence DESC
   LIMIT 1;

  RETURN NEXT;
END;$$;

-- 14. Ownership, search_path hardening and the PRODUCTION-INERT posture. The
--     new tables are unreachable by every application role; the new writer,
--     coordinator, context read and internal helpers are executable by NO
--     application role; the T-03A2 same-SP seam stays internal; and the
--     existing T-03A2 service_role grants are left exactly as they are.
--     T-03B1b2 performs the single activation step.
ALTER TABLE public.conversation_focus_commit_batches OWNER TO postgres;
ALTER TABLE public.conversation_reference_handles OWNER TO postgres;
ALTER TABLE public.conversation_unit_focus_semantics OWNER TO postgres;
ALTER TABLE public.conversation_reference_resolutions OWNER TO postgres;
ALTER TABLE public.conversation_reference_resolution_candidates OWNER TO postgres;
ALTER TABLE public.conversation_claim_attributions OWNER TO postgres;
ALTER TABLE public.conversation_emerging_focuses OWNER TO postgres;
ALTER TABLE public.conversation_emerging_focus_attention_events OWNER TO postgres;
ALTER TABLE public.conversation_focus_commit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reference_handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_unit_focus_semantics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reference_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reference_resolution_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_claim_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_emerging_focuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_emerging_focus_attention_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.conversation_focus_commit_batches, public.conversation_reference_handles,
  public.conversation_unit_focus_semantics, public.conversation_reference_resolutions,
  public.conversation_reference_resolution_candidates, public.conversation_claim_attributions,
  public.conversation_emerging_focuses, public.conversation_emerging_focus_attention_events
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.reject_conversation_focus_semantic_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.validate_conversation_focus_anchor_v1(text,jsonb) OWNER TO postgres;
ALTER FUNCTION public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint) OWNER TO postgres;
ALTER FUNCTION public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)
  OWNER TO postgres;
ALTER FUNCTION public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)
  OWNER TO postgres;
ALTER FUNCTION public.get_conversation_focus_runtime_context_v1(uuid,uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.reject_conversation_focus_semantic_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_conversation_focus_anchor_v1(text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_focus_runtime_context_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.conversation_focus_commit_batches, public.conversation_reference_handles, '
       || 'public.conversation_unit_focus_semantics, public.conversation_reference_resolutions, '
       || 'public.conversation_reference_resolution_candidates, public.conversation_claim_attributions, '
       || 'public.conversation_emerging_focuses, public.conversation_emerging_focus_attention_events FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_conversation_focus_semantic_mutation_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.validate_conversation_focus_anchor_v1(text,jsonb) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint) FROM service_role';
  -- PRODUCTION-INERT: the integrated writer, the coordinator and the context
  -- read are executable by no application role in T-03B1b1. T-03B1b2 grants
  -- and wires the integrated semantic path in one activation step.
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversation_focus_runtime_context_v1(uuid,uuid) FROM service_role';
END IF;END$$;

-- 15. Terminal self-assertions. The migration refuses to deploy a substrate
--     that is production-reachable, that disturbed the T-03A2 activation, or
--     that carries a Thread/LF/Home/K/V/score column.
DO $$
DECLARE
  focus_writer constant text := 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
  focus_coordinator constant text := 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
  focus_context constant text := 'public.get_conversation_focus_runtime_context_v1(uuid,uuid)';
  focus_persist constant text := 'public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint)';
  focus_anchor constant text := 'public.validate_conversation_focus_anchor_v1(text,jsonb)';
  legacy_producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_coordinator constant text := 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_snapshot constant text := 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  same_sp_helper constant text := 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
  focus_tables constant text[] := ARRAY[
    'public.conversation_focus_commit_batches', 'public.conversation_reference_handles',
    'public.conversation_unit_focus_semantics', 'public.conversation_reference_resolutions',
    'public.conversation_reference_resolution_candidates', 'public.conversation_claim_attributions',
    'public.conversation_emerging_focuses', 'public.conversation_emerging_focus_attention_events'];
  target_role text;
  target_table text;
  target_privilege text;
  target_function text;
  function_row pg_proc;
  row_total bigint;
BEGIN
  -- Nothing was backfilled: every new table is empty.
  FOREACH target_table IN ARRAY focus_tables LOOP
    EXECUTE format('SELECT count(*) FROM %s', target_table) INTO STRICT row_total;
    IF row_total <> 0 THEN
      RAISE EXCEPTION 'T-03B1b1 creates a forward-only substrate and backfills nothing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal
                      AND t.tgfoid = 'public.reject_conversation_focus_semantic_mutation_v1'::regproc) THEN
      RAISE EXCEPTION 'every T-03B1b1 semantic table must be append-only: % lacks the immutability trigger', target_table;
    END IF;
  END LOOP;

  -- No Thread, Home, lifecycle, LF, K/V, sealing flag, score or label column.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name IN ('conversation_focus_commit_batches','conversation_reference_handles',
                                     'conversation_unit_focus_semantics','conversation_reference_resolutions',
                                     'conversation_reference_resolution_candidates','conversation_claim_attributions',
                                     'conversation_emerging_focuses','conversation_emerging_focus_attention_events')
                AND c.column_name ~* 'thread|home|live_focus|(^|_)lf($|_)|lifecycle|status|score|confidence|embedding|label|display_name|normalized|active|sealed|pre_first_sp|moment|timeline|knowledge|(^|_)kf($|_)|(^|_)vf($|_)|(^|_)vt($|_)|terminat') THEN
    RAISE EXCEPTION 'T-03B1b1 introduces no Thread/Home/lifecycle/LF/K-V/score/label column';
  END IF;

  -- Structural focus uniqueness per canonical locus.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k
                  WHERE k.conrelid = 'public.conversation_emerging_focuses'::regclass AND k.contype = 'u'
                    AND k.conname = 'emerging_focuses_grounding_unique') THEN
    RAISE EXCEPTION 'T-03B1b1 requires UNIQUE(session_id, grounding_handle_id) on Emerging Focus';
  END IF;

  -- Function identity, security posture and search path.
  FOREACH target_function IN ARRAY ARRAY[focus_writer, focus_coordinator, focus_context, focus_persist, focus_anchor] LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF NOT FOUND THEN RAISE EXCEPTION 'a T-03B1b1 function is missing: %', target_function; END IF;
    IF pg_get_userbyid(function_row.proowner) <> 'postgres' OR NOT function_row.prosecdef
       OR NOT EXISTS (SELECT 1 FROM unnest(function_row.proconfig) AS entry(setting)
                       WHERE entry.setting LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'T-03B1b1 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed: %', target_function;
    END IF;
  END LOOP;

  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      -- PRODUCTION-INERT: no application role executes anything new.
      FOREACH target_function IN ARRAY ARRAY[focus_writer, focus_coordinator, focus_context, focus_persist, focus_anchor, same_sp_helper] LOOP
        IF has_function_privilege(target_role, target_function, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B1b1 is production-inert: % must not execute %', target_role, target_function;
        END IF;
      END LOOP;
      -- The T-03A2 activation is untouched: service_role still executes the
      -- legacy producer, coordinator and snapshot, and nobody else does.
      IF target_role = 'service_role' THEN
        IF NOT has_function_privilege(target_role, legacy_producer, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_coordinator, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_snapshot, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B1b1 must leave the T-03A2 service_role grants exactly in place';
        END IF;
      ELSIF has_function_privilege(target_role, legacy_producer, 'EXECUTE')
         OR has_function_privilege(target_role, legacy_coordinator, 'EXECUTE') THEN
        RAISE EXCEPTION 'the canonical producer must never be executable by %', target_role;
      END IF;
      -- No application role may read or write any semantic table directly.
      FOREACH target_table IN ARRAY focus_tables LOOP
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'the focus substrate must stay unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  -- The clock itself is unchanged: still exactly SP and the internal sequence.
  IF (SELECT array_agg(c.column_name::text ORDER BY c.column_name) FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'session_semantic_clocks')
     <> ARRAY['current_sp','same_sp_event_sequence','session_id','user_id'] THEN
    RAISE EXCEPTION 'T-03B1b1 must not alter the Session Semantic Clock';
  END IF;
END$$;

COMMIT;
