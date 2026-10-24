-- S8A-03 CP2 - Personal Understanding: natural acquisition and semantic Memory retrieval v1.
--
-- The Founder's CP2 decision (option B): DeepSeek Flash proposes, in the BACKGROUND, the personal facts a user stated
-- in ordinary conversation (no «افتكر») and the retrieval keys of their Memories; the server verifies every proposal
-- before anything is kept; and the foreground retrieves through a PostgreSQL index with no model call at read time.
-- This migration is the durable half of that decision, and nothing else:
--
--   1. memory_retrieval_profiles - one row per indexed Memory: whether its semantic keys were indexed, and the
--      OPTIONAL slot (RESIDENCE / OCCUPATION / EMPLOYER / STUDY / MARITAL_STATUS / SMOKING) and temporal standing
--      (CURRENT / PAST / PLANNED / TEMPORARY) the same-slot rule reads. A Memory with no slot is retrieved exactly like
--      any other: the slots only group current facts on one topic, never a retrieval filter.
--   2. memory_retrieval_terms - the normalized retrieval terms of a Memory (its own words and its semantic keys, both
--      normalized by the ONE TypeScript tokenizer the reader also uses). The database compares terms for equality only.
--   3. An index row never outlives the Memory's eligibility: leaving ACTIVE (forgotten, disabled, corrected, expired)
--      deletes the Memory's terms and profile in the same transaction; deleting the Memory cascades. Eligibility is
--      still decided at READ time from public.memories itself (status, expiry, owner), never from the index.
--   4. The subject basis MODEL_ASSISTED_CAPTURE (SELF only, names an execution): a Memory the server kept from a model
--      proposal, in the user's own verbatim words. The deterministic FIRST_PERSON_CAPTURE stays as it was.
--   5. The fourth provider-backed post-response effect, UNDERSTANDING_CAPTURE_PROVIDER (QIR-005 v2), with its typed
--      result: NO_UNDERSTANDING_RECORDED, or UNDERSTANDING_RECORDED carrying only the identifiers it wrote - never
--      a word of content - so the ledger holds no copy of what the user said.
--   6. The AI-COST-01 feature family PERSONAL_UNDERSTANDING_CAPTURE.
--   7. background_unindexed_memories_v1 - the bounded backfill read: the execution owner's eligible Memories whose
--      semantic keys are not indexed yet (natural captures, «افتكر» / correction results and pre-0171 Memories alike).
--   8. complete_post_response_personal_capture_v1 - the ONE atomic command of the capture effect: every
--      verified Memory, its SELF / MODEL_ASSISTED_CAPTURE subject, profile and terms, every backfill index row, and the
--      typed effect completion commit in ONE transaction, or nothing does. It writes only while the effect is CLAIMED
--      by a RUNNING execution, so a redelivery can never replay it (a CLAIMED effect quarantines; a COMPLETED one is
--      recovered). Every 0152 rule of the background writer holds for each Memory: nothing on a Memory-command turn,
--      nothing a later FORGET / DISABLE / CORRECT withdrew, nothing equivalent to an ACTIVE SELF / UNATTRIBUTED Memory.
--      The background never retires, supersedes or re-attributes an existing Memory. It is also the explicit cleanup
--      path of the owner's EXPIRED Memories' index rows (expiry is a time, not an event, and fires no trigger).
--   9. retrieve_personal_memory_candidates_v1 - the foreground semantic read, SECURITY INVOKER under the caller's RLS:
--      the caller's ACTIVE, unexpired Memories whose terms match, plus the other UNSETTLED Memories of a matched slot.
--
-- No hosted application is authorized by this file: it is applied to the local verification database only until a
-- separate authorization says otherwise. Migrations 0001-0170 are byte-unchanged.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------
-- 1-2. The index tables. Composite foreign keys to public.memories (id, user_id), so an index row can only ever name a
--      Memory of its own owner, and ON DELETE CASCADE so the governed Personal erasure (0130) needs no new step.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE public.memory_retrieval_profiles (
  memory_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  semantic_indexed boolean NOT NULL,
  slot text,
  temporal text,
  key_version smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT memory_retrieval_profiles_memory_fk FOREIGN KEY (memory_id, user_id)
    REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
  CONSTRAINT memory_retrieval_profiles_slot_check CHECK (slot IS NULL OR slot IN (
    'RESIDENCE','OCCUPATION','EMPLOYER','STUDY','MARITAL_STATUS','SMOKING')),
  CONSTRAINT memory_retrieval_profiles_temporal_check CHECK (temporal IS NULL OR temporal IN (
    'CURRENT','PAST','PLANNED','TEMPORARY')),
  CONSTRAINT memory_retrieval_profiles_key_version_check CHECK (key_version = 1)
);
CREATE INDEX memory_retrieval_profiles_user_idx ON public.memory_retrieval_profiles (user_id, slot);

CREATE TABLE public.memory_retrieval_terms (
  memory_id uuid NOT NULL,
  user_id uuid NOT NULL,
  term text NOT NULL,
  PRIMARY KEY (memory_id, term),
  CONSTRAINT memory_retrieval_terms_memory_fk FOREIGN KEY (memory_id, user_id)
    REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
  CONSTRAINT memory_retrieval_terms_term_check CHECK (char_length(term) BETWEEN 2 AND 48 AND term ~ '^[^[:space:]]+$')
);
CREATE INDEX memory_retrieval_terms_lookup_idx ON public.memory_retrieval_terms (user_id, term);

ALTER TABLE public.memory_retrieval_profiles OWNER TO postgres;
ALTER TABLE public.memory_retrieval_terms OWNER TO postgres;
ALTER TABLE public.memory_retrieval_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_retrieval_terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.memory_retrieval_profiles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.memory_retrieval_terms FROM PUBLIC, anon, authenticated, service_role;
-- Read like public.memories (0026) and the 0152 attributions: the owner through RLS, the server REST role for the
-- background. Nobody but the two definers below and the cascade ever writes them.
GRANT SELECT ON TABLE public.memory_retrieval_profiles TO authenticated, service_role;
GRANT SELECT ON TABLE public.memory_retrieval_terms TO authenticated, service_role;
CREATE POLICY memory_retrieval_profiles_select_own ON public.memory_retrieval_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY memory_retrieval_terms_select_own ON public.memory_retrieval_terms
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------------------------------------------
-- 3. A Memory that leaves ACTIVE takes its index with it, in the same transaction as the FORGET / DISABLE / CORRECT /
--    expiry that moved it. Statuses never return to ACTIVE (a correction creates a new Memory), so nothing is lost.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.retire_memory_retrieval_index_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  DELETE FROM public.memory_retrieval_terms t WHERE t.memory_id = NEW.id AND t.user_id = NEW.user_id;
  DELETE FROM public.memory_retrieval_profiles p WHERE p.memory_id = NEW.id AND p.user_id = NEW.user_id;
  RETURN NULL;
END;$$;
CREATE TRIGGER memories_retire_retrieval_index
  AFTER UPDATE OF status ON public.memories
  FOR EACH ROW WHEN (OLD.status = 'ACTIVE' AND NEW.status <> 'ACTIVE')
  EXECUTE FUNCTION public.retire_memory_retrieval_index_v1();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. MODEL_ASSISTED_CAPTURE. The three 0152 checks, each with the one new basis; every existing row satisfies them.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.memory_subject_attributions DROP CONSTRAINT memory_subject_attributions_basis_check;
ALTER TABLE public.memory_subject_attributions ADD CONSTRAINT memory_subject_attributions_basis_check CHECK (basis IN (
  'FIRST_PERSON_CAPTURE','EXPLICIT_STATEMENT','USER_CLARIFIED','CORRECTION_INHERITED','LEGACY_FIRST_PERSON_CAPTURE',
  'MODEL_ASSISTED_CAPTURE'));
ALTER TABLE public.memory_subject_attributions DROP CONSTRAINT memory_subject_attributions_provenance_check;
ALTER TABLE public.memory_subject_attributions ADD CONSTRAINT memory_subject_attributions_provenance_check CHECK (
  (execution_id IS NULL OR basis IN ('FIRST_PERSON_CAPTURE','LEGACY_FIRST_PERSON_CAPTURE','MODEL_ASSISTED_CAPTURE'))
  AND (command_id IS NULL OR basis IN ('EXPLICIT_STATEMENT','USER_CLARIFIED','CORRECTION_INHERITED')));
ALTER TABLE public.memory_subject_attributions DROP CONSTRAINT memory_subject_attributions_capture_self_check;
ALTER TABLE public.memory_subject_attributions ADD CONSTRAINT memory_subject_attributions_capture_self_check CHECK (
  basis NOT IN ('FIRST_PERSON_CAPTURE','LEGACY_FIRST_PERSON_CAPTURE','MODEL_ASSISTED_CAPTURE') OR subject = 'SELF');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. The fourth provider effect and its typed result. The payload is identifiers only.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.post_response_personal_capture_result_valid_v1(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  list jsonb;
  name text;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_value) k)
     IS DISTINCT FROM ARRAY['indexedMemoryIds','memoryIds'] THEN RETURN false; END IF;
  FOREACH name IN ARRAY ARRAY['memoryIds','indexedMemoryIds'] LOOP
    list := p_value->name;
    IF jsonb_typeof(list) <> 'array' OR jsonb_array_length(list) > (CASE name WHEN 'memoryIds' THEN 3 ELSE 4 END) THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(list) e(v) WHERE jsonb_typeof(e.v) <> 'string' OR e.v #>> '{}' !~ uuid_pattern) THEN RETURN false; END IF;
    IF (SELECT count(DISTINCT e.v) FROM jsonb_array_elements(list) e(v)) <> jsonb_array_length(list) THEN RETURN false; END IF;
  END LOOP;
  IF jsonb_array_length(p_value->'memoryIds') + jsonb_array_length(p_value->'indexedMemoryIds') = 0 THEN RETURN false; END IF;
  RETURN true;
END;$$;

ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_effect_key_check;
ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_effect_key_check CHECK (effect_key IN (
  'MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_PERSISTENCE',
  'CONFIDENCE_BATCH','HIM_BRAIN_CONTEXT_MATERIALIZATION','UNDERSTANDING_CAPTURE_PROVIDER'));
ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check;
ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
  effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE',
    'HYPOTHESIS_UPDATE_BATCH','CONFIDENCE_BATCH','HIM_BRAIN_CONTEXT_MATERIALIZATION','UNDERSTANDING_CAPTURE_PROVIDER')
  OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL));
-- No legacy result-less COMPLETED state exists for this key, so none is admitted: the generic result-less completion
-- (0024) cannot complete it, and a COMPLETED row always carries one of the two typed results. Every comparison is
-- NULL-safe (IS NOT DISTINCT FROM): a CHECK that evaluates to NULL passes, so `result_code = '...'` would admit a NULL
-- result code.
ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_understanding_result_check CHECK (
  effect_key IS DISTINCT FROM 'UNDERSTANDING_CAPTURE_PROVIDER'
  OR (state IS NOT DISTINCT FROM 'CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  OR (state IS NOT DISTINCT FROM 'COMPLETED' AND result_code IS NOT DISTINCT FROM 'NO_UNDERSTANDING_RECORDED'
      AND result_reference IS NULL AND result_payload IS NULL)
  OR (state IS NOT DISTINCT FROM 'COMPLETED' AND result_code IS NOT DISTINCT FROM 'UNDERSTANDING_RECORDED'
      AND result_reference IS NULL AND result_payload IS NOT NULL
      AND coalesce(public.post_response_personal_capture_result_valid_v1(result_payload), false)));

-- ---------------------------------------------------------------------------------------------------------------
-- 6. The AI-COST-01 feature family: the 0135 list plus exactly one name.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE'));

-- ---------------------------------------------------------------------------------------------------------------
-- 7. The bounded backfill read. The execution - never the caller - names the owner. At most four Memories, newest
--    first; only Memories retrieval could ever serve (ACTIVE, unexpired, not an Interaction Preference).
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.background_unindexed_memories_v1(p_source_turn_id uuid, p_limit integer)
RETURNS TABLE(memory_id uuid, type text, content text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid;
BEGIN
  IF p_source_turn_id IS NULL OR p_limit IS NULL OR p_limit < 0 THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_BACKFILL_REQUEST' USING ERRCODE='22023';
  END IF;
  SELECT e.user_id INTO owner_id FROM public.post_response_intelligence_executions e
   WHERE e.source_turn_id = p_source_turn_id AND e.state = 'RUNNING';
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'UNDERSTANDING_EXECUTION_NOT_ASSOCIATED' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.type, m.content FROM public.memories m
     WHERE m.user_id = owner_id AND m.status = 'ACTIVE'
       AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND m.type <> 'INTERACTION_PREFERENCE'
       AND NOT EXISTS (SELECT 1 FROM public.memory_retrieval_profiles p
                        WHERE p.memory_id = m.id AND p.user_id = m.user_id AND p.semantic_indexed)
     ORDER BY m.updated_at DESC, m.id DESC
     LIMIT least(p_limit, 4);
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. The ONE atomic capture command.
--
--   Arguments are parallel arrays (no json, no record, no caller-chosen status or confidence):
--     new Memories   p_memory_ids / p_types / p_contents / p_importances / p_expires_at / p_slots / p_temporals (<= 3)
--     backfill index p_index_memory_ids / p_index_slots / p_index_temporals (<= 4)
--     terms          p_term_memory_ids / p_terms (<= 64 per Memory): a term naming a Memory that is neither created nor
--                    indexed here is ignored.
--   A model-assisted Memory is USER_STATED (the user's own verbatim words, verified by the server), ACTIVE, confidence
--   0.80 - below the deterministic capture's 0.95 - and SELF / MODEL_ASSISTED_CAPTURE naming this execution.
--   Answers COMPLETED (this call wrote the typed result) or NO_OP (no RUNNING execution with the effect CLAIMED: a
--   finished, quarantined or already completed execution writes nothing).
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.complete_post_response_personal_capture_v1(
  p_execution_id uuid,
  p_memory_ids uuid[], p_types text[], p_contents text[], p_importances double precision[],
  p_expires_at timestamptz[], p_slots text[], p_temporals text[],
  p_index_memory_ids uuid[], p_index_slots text[], p_index_temporals text[],
  p_term_memory_ids uuid[], p_terms text[]
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  source_row public.conversation_turns;
  item_count integer := coalesce(cardinality(p_memory_ids), 0);
  index_count integer := coalesce(cardinality(p_index_memory_ids), 0);
  command_turn boolean;
  history_open boolean := false;
  new_key text;
  created public.memories;
  created_ids uuid[] := '{}';
  indexed_ids uuid[] := '{}';
  i integer;
BEGIN
  IF p_execution_id IS NULL
     OR coalesce(cardinality(p_types), 0) <> item_count OR coalesce(cardinality(p_contents), 0) <> item_count
     OR coalesce(cardinality(p_importances), 0) <> item_count OR coalesce(cardinality(p_expires_at), 0) <> item_count
     OR coalesce(cardinality(p_slots), 0) <> item_count OR coalesce(cardinality(p_temporals), 0) <> item_count
     OR coalesce(cardinality(p_index_slots), 0) <> index_count OR coalesce(cardinality(p_index_temporals), 0) <> index_count
     OR coalesce(cardinality(p_term_memory_ids), 0) <> coalesce(cardinality(p_terms), 0)
     OR item_count > 3 OR index_count > 4 OR coalesce(cardinality(p_terms), 0) > 64 * (item_count + index_count)
     OR array_position(p_memory_ids, NULL) IS NOT NULL OR array_position(p_index_memory_ids, NULL) IS NOT NULL
     OR array_position(p_term_memory_ids, NULL) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_memory_ids, '{}') || coalesce(p_index_memory_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
  THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_terms, '{}')) t(term)
              WHERE t.term IS NULL OR char_length(t.term) NOT BETWEEN 2 AND 48 OR t.term !~ '^[^[:space:]]+$')
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_slots, '{}') || coalesce(p_index_slots, '{}')) s(slot)
                 WHERE s.slot IS NOT NULL AND s.slot NOT IN ('RESIDENCE','OCCUPATION','EMPLOYER','STUDY','MARITAL_STATUS','SMOKING'))
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_temporals, '{}') || coalesce(p_index_temporals, '{}')) s(temporal)
                 WHERE s.temporal IS NULL OR s.temporal NOT IN ('CURRENT','PAST','PLANNED','TEMPORARY'))
  THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
  END IF;
  FOR i IN 1..item_count LOOP
    PERFORM public.assert_canonical_memory_shape_v1(p_types[i], p_contents[i], 'USER_STATED', 0.80, p_importances[i], 'ACTIVE', p_expires_at[i]);
    IF p_types[i] NOT IN ('STABLE_PREFERENCE','PERSONAL_FACT','GOAL','DECISION_COMMITMENT','RELATIONSHIP_CONTEXT','TEMPORARY_STATE')
       OR char_length(p_contents[i]) > 280
       OR ((p_types[i] = 'TEMPORARY_STATE') <> (p_temporals[i] = 'TEMPORARY'))
       OR ((p_types[i] = 'TEMPORARY_STATE') <> (p_expires_at[i] IS NOT NULL))
       OR (p_expires_at[i] IS NOT NULL AND p_expires_at[i] > CURRENT_TIMESTAMP + interval '15 days')
    THEN
      RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
    END IF;
  END LOOP;

  SELECT * INTO execution_row FROM public.post_response_intelligence_executions
   WHERE id = p_execution_id AND state = 'RUNNING' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
       SELECT 1 FROM public.post_response_intelligence_effects f
        WHERE f.execution_id = p_execution_id AND f.effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER' AND f.state = 'CLAIMED') THEN
    RETURN 'NO_OP';
  END IF;

  -- The owner's lock first, exactly as 0152's background writer: every equivalence decision below is serialized with
  -- the Memory commands and the deterministic capture of the same owner.
  PERFORM public.memory_equivalence_lock_v1(execution_row.user_id);
  -- 0152 PD-7: a turn a Memory command answered is the foreground's. Nothing is captured from it (backfill indexing of
  -- other Memories is not a capture and still proceeds).
  command_turn := EXISTS (SELECT 1 FROM public.memory_control_commands c
                           WHERE c.source_turn_id = execution_row.source_turn_id AND c.user_id = execution_row.user_id);
  SELECT * INTO source_row FROM public.conversation_turns t
   WHERE t.id = execution_row.source_turn_id AND t.user_id = execution_row.user_id;

  FOR i IN 1..item_count LOOP
    EXIT WHEN command_turn;
    new_key := public.memory_equivalence_key_v1(btrim(p_contents[i]));
    PERFORM 1 FROM public.memories m
      WHERE m.user_id = execution_row.user_id AND m.type = p_types[i] AND m.status = 'ACTIVE'
        AND public.memory_equivalence_key_v1(m.content) = new_key
      ORDER BY m.id FOR UPDATE;
    -- 0152 SUPERSEDED_BY_LATER_COMMAND: a fact a later command withdrew is never re-created.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.memory_control_commands c
        JOIN public.conversation_turns later ON later.id = c.source_turn_id
        JOIN public.memories m ON m.user_id = c.user_id
          AND (m.id = c.target_memory_id
               OR m.id IN (SELECT d.memory_id FROM public.memory_equivalence_dispositions d
                            WHERE d.command_id = c.id AND d.disposition IN ('FORGOTTEN','DISABLED','CORRECTED')))
       WHERE c.user_id = execution_row.user_id
         AND c.outcome IN ('FORGOTTEN','DISABLED','CORRECTED','CORRECTED_TO_EXISTING')
         AND m.type = p_types[i] AND public.memory_equivalence_key_v1(m.content) = new_key
         AND (later.created_at, later.id) > (source_row.created_at, source_row.id));
    -- 0152 EQUIVALENT_EXISTS, any type: the same words are already an ACTIVE SELF or UNATTRIBUTED Memory (an earlier
    -- item of this batch included). The background never re-states a fact under a second type.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.memories m
       WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
         AND public.memory_equivalence_key_v1(m.content) = new_key
         AND coalesce(public.memory_subject_v1(execution_row.user_id, m.id), 'SELF') = 'SELF');
    IF NOT history_open THEN
      PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true);
      history_open := true;
    END IF;
    SELECT * INTO created FROM public.server_create_memory_v1(execution_row.user_id, p_memory_ids[i], p_types[i], p_contents[i],
      'USER_STATED', 0.80, p_importances[i], 'ACTIVE', p_expires_at[i]);
    INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
      VALUES (created.id, execution_row.user_id, 'SELF', 'MODEL_ASSISTED_CAPTURE', execution_row.id);
    INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal)
      VALUES (created.id, execution_row.user_id, true, p_slots[i], p_temporals[i]);
    created_ids := created_ids || created.id;
  END LOOP;

  FOR i IN 1..index_count LOOP
    -- Only the owner's Memory, still eligible, and not semantically indexed yet. Anything else is skipped silently: a
    -- Memory forgotten or corrected since the backfill read is exactly what must not be indexed.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM public.memories m
       WHERE m.id = p_index_memory_ids[i] AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP) AND m.type <> 'INTERACTION_PREFERENCE');
    INSERT INTO public.memory_retrieval_profiles AS p (memory_id, user_id, semantic_indexed, slot, temporal)
      VALUES (p_index_memory_ids[i], execution_row.user_id, true, p_index_slots[i], p_index_temporals[i])
      ON CONFLICT (memory_id) DO UPDATE SET semantic_indexed = true, slot = EXCLUDED.slot, temporal = EXCLUDED.temporal
        WHERE NOT p.semantic_indexed;
    CONTINUE WHEN NOT FOUND;
    indexed_ids := indexed_ids || p_index_memory_ids[i];
  END LOOP;

  INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term)
    SELECT DISTINCT t.memory_id, execution_row.user_id, t.term
      FROM unnest(coalesce(p_term_memory_ids, '{}'), coalesce(p_terms, '{}')) AS t(memory_id, term)
     WHERE t.memory_id = ANY (created_ids || indexed_ids)
    ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.memory_retrieval_terms t WHERE t.memory_id = ANY (created_ids || indexed_ids)
              GROUP BY t.memory_id HAVING count(*) > 64) THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
  END IF;

  -- Expiry is a time, not an event, and fires no trigger (S8A-03 CP1 amendment §7.6): reads already exclude an expired
  -- Memory by their own predicate, and this is the explicit cleanup of its index, run by every capture of its owner.
  DELETE FROM public.memory_retrieval_terms t USING public.memories m
   WHERE t.memory_id = m.id AND t.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM public.memory_retrieval_profiles p USING public.memories m
   WHERE p.memory_id = m.id AND p.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;

  UPDATE public.post_response_intelligence_effects
     SET state = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
         result_code = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) = 0 THEN 'NO_UNDERSTANDING_RECORDED' ELSE 'UNDERSTANDING_RECORDED' END,
         result_payload = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) = 0 THEN NULL
           ELSE jsonb_build_object('memoryIds', to_jsonb(created_ids::text[]), 'indexedMemoryIds', to_jsonb(indexed_ids::text[])) END
   WHERE execution_id = p_execution_id AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER' AND state = 'CLAIMED';
  IF NOT FOUND THEN RAISE EXCEPTION 'UNDERSTANDING_CAPTURE_COMPLETION_LOST' USING ERRCODE='55000'; END IF;
  RETURN 'COMPLETED';
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. The foreground semantic read. SECURITY INVOKER: the caller's own RLS on memories, attributions, profiles and terms
--    is the authority, and auth.uid() names the owner explicitly as well. Eligibility is read from public.memories at
--    read time - ACTIVE and unexpired - so an index row can never serve a forgotten, corrected or expired Memory.
--    Returned: up to 12 matching Memories (most terms matched first), then every other Memory of a matched shared slot
--    (two or more CURRENT SELF Memories in one slot), flagged UNSETTLED. UNSETTLED is NOT a confirmed conflict (CP2 R1):
--    sharing a slot proves no mutual exclusion - a user may work for two employers at once, or state one fact twice in
--    other words - and the database compares no values, so it claims only that no one of them is the settled answer.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.retrieve_personal_memory_candidates_v1(p_terms text[], p_limit integer)
RETURNS TABLE(id uuid, user_id uuid, scope text, type text, content text, source text, confidence double precision,
  importance double precision, status text, version integer, created_at timestamptz, updated_at timestamptz,
  expires_at timestamptz, supersedes_memory_id uuid, subject text, hits integer, slot text, unsettled boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH me AS (SELECT (SELECT auth.uid()) AS uid),
  live AS MATERIALIZED (
    SELECT m.*, a.subject, p.slot, p.temporal
      FROM public.memories m
      JOIN me ON m.user_id = me.uid
      LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
      LEFT JOIN public.memory_retrieval_profiles p ON p.memory_id = m.id AND p.user_id = m.user_id
     WHERE m.status = 'ACTIVE' AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND m.type <> 'INTERACTION_PREFERENCE'
  ), shared_slot AS (
    SELECT l.slot FROM live l WHERE l.slot IS NOT NULL AND l.temporal = 'CURRENT' AND l.subject = 'SELF'
     GROUP BY l.slot HAVING count(*) > 1
  ), hit AS (
    SELECT t.memory_id, count(*)::integer AS hits
      FROM public.memory_retrieval_terms t JOIN me ON t.user_id = me.uid
     WHERE t.term = ANY (coalesce(p_terms, '{}'))
     GROUP BY t.memory_id
  ), matched AS (
    SELECT l.*, h.hits FROM live l JOIN hit h ON h.memory_id = l.id
     ORDER BY h.hits DESC, l.importance DESC, l.updated_at DESC, l.id
     LIMIT least(greatest(coalesce(p_limit, 0), 0), 12)
  ), partner AS (
    SELECT l.*, 0 AS hits FROM live l
     WHERE l.temporal = 'CURRENT' AND l.subject = 'SELF' AND l.id NOT IN (SELECT x.id FROM matched x)
       AND l.slot IN (SELECT x.slot FROM matched x JOIN shared_slot c ON c.slot = x.slot WHERE x.temporal = 'CURRENT' AND x.subject = 'SELF')
  )
  SELECT r.id, r.user_id, r.scope, r.type, r.content, r.source, r.confidence, r.importance, r.status, r.version,
         r.created_at, r.updated_at, r.expires_at, r.supersedes_memory_id, r.subject, r.hits, r.slot,
         -- Never NULL: a Memory with no slot, no time standing or no attribution is simply not unsettled.
         coalesce(r.temporal = 'CURRENT' AND r.subject = 'SELF' AND r.slot IN (SELECT c.slot FROM shared_slot c), false) AS unsettled
    FROM (SELECT * FROM matched UNION ALL SELECT * FROM partner) r
   ORDER BY r.hits DESC, r.importance DESC, r.updated_at DESC, r.id
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 10. Ownership and privileges, all explicit.
-- ---------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.retire_memory_retrieval_index_v1() OWNER TO postgres;
ALTER FUNCTION public.post_response_personal_capture_result_valid_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION public.background_unindexed_memories_v1(uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.complete_post_response_personal_capture_v1(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],uuid[],text[],text[],uuid[],text[]) OWNER TO postgres;
ALTER FUNCTION public.retrieve_personal_memory_candidates_v1(text[],integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION
  public.retire_memory_retrieval_index_v1(),
  public.post_response_personal_capture_result_valid_v1(jsonb),
  public.background_unindexed_memories_v1(uuid,integer),
  public.complete_post_response_personal_capture_v1(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],uuid[],text[],text[],uuid[],text[]),
  public.retrieve_personal_memory_candidates_v1(text[],integer)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.background_unindexed_memories_v1(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_post_response_personal_capture_v1(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],uuid[],text[],text[],uuid[],text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.retrieve_personal_memory_candidates_v1(text[],integer) TO authenticated;

COMMIT;
