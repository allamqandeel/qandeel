-- S8A-03 - Living Personal Memory v1: the knowledge picture and its living state, inside the existing Memory.
--
-- The Founder's decision "S8A-03 / Living Personal Memory - Design Corrections & Controlled Implementation": a personal
-- picture derived at READ time from the live Memories (no stored summary), in three tiers - core knowledge, current
-- state, and recalled details - and kept current by the SAME background capture call (no new model call, nothing
-- before the reply). This migration is the durable half of that decision, and nothing else:
--
--   1. memory_retrieval_profiles gains the living state of a Memory: when the user last stated it (last_stated_at), how
--      many later turns restated it (restated_count), and whether the user explicitly ended it (ended_at, naming the
--      execution). An ended Memory stays ACTIVE and true as history: its time standing becomes PAST, nothing else
--      changes, and no writer can make it current again (a guard trigger). Silence never ends anything.
--   2. The subject basis MODEL_ASSISTED_RELATION_CAPTURE (OTHER only, names an execution): a statement of who one of
--      the user's family is, kept in the user's own verbatim words and ALWAYS about someone else, never the user.
--   3. The capture result may also name the existing Memories this capture restated or ended (identifiers only).
--   4. background_current_state_memories_v1 - the bounded read of the owner's current-state Memories the capture may
--      find restated or ended in the current message (at most ten, SELF only).
--   5. complete_post_response_personal_capture_v2 - the ONE atomic capture command, now also applying the verified
--      REAFFIRMED / ENDED statements and keeping family relationship statements as OTHER. Every 0171 rule holds.
--   6. personal_knowledge_sources_v1 - the foreground read the knowledge picture is projected from, SECURITY INVOKER
--      under the caller's RLS, bounded, with eligibility decided from public.memories at read time.
--
-- complete_post_response_personal_capture_v1 is left in place and unchanged (its verifier still proves it); the runtime
-- no longer calls it, and the guard trigger of section 1 holds whichever command writes a profile.
--
-- No hosted application is authorized by this file: it is applied to the local verification database only until a
-- separate authorization says otherwise. Migrations 0001-0171 are byte-unchanged.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The living state of an indexed Memory. NULL last_stated_at means "as created"; readers use created_at.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.memory_retrieval_profiles
  ADD COLUMN last_stated_at timestamptz,
  ADD COLUMN restated_count integer NOT NULL DEFAULT 0,
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN ended_execution_id uuid;
ALTER TABLE public.memory_retrieval_profiles ADD CONSTRAINT memory_retrieval_profiles_restated_check CHECK (restated_count >= 0);
-- An ended Memory is history: PAST, with the execution that recorded the user's explicit ending.
ALTER TABLE public.memory_retrieval_profiles ADD CONSTRAINT memory_retrieval_profiles_ended_check CHECK (
  (ended_at IS NULL AND ended_execution_id IS NULL)
  OR (ended_at IS NOT NULL AND ended_execution_id IS NOT NULL AND temporal IS NOT DISTINCT FROM 'PAST'));

-- Once ended, always ended while the Memory lives: a later index write (the 0171 backfill included) may add keys or a
-- slot but never makes an ended Memory current again, and never forgets that it was ended. The living state is never
-- moved backwards by an index write either.
CREATE FUNCTION public.keep_memory_living_state_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.ended_at IS NOT NULL THEN
    NEW.temporal := 'PAST';
    NEW.ended_at := OLD.ended_at;
    NEW.ended_execution_id := OLD.ended_execution_id;
  END IF;
  NEW.restated_count := greatest(NEW.restated_count, OLD.restated_count);
  IF OLD.last_stated_at IS NOT NULL AND (NEW.last_stated_at IS NULL OR NEW.last_stated_at < OLD.last_stated_at) THEN
    NEW.last_stated_at := OLD.last_stated_at;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER memory_retrieval_profiles_keep_living_state
  BEFORE UPDATE ON public.memory_retrieval_profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_memory_living_state_v1();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. MODEL_ASSISTED_RELATION_CAPTURE. Widened by exactly the one new basis; the 0171 capture_self_check is unchanged
--    (MODEL_ASSISTED_CAPTURE stays SELF only) and a separate check makes the new basis OTHER only.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.memory_subject_attributions DROP CONSTRAINT memory_subject_attributions_basis_check;
ALTER TABLE public.memory_subject_attributions ADD CONSTRAINT memory_subject_attributions_basis_check CHECK (basis IN (
  'FIRST_PERSON_CAPTURE','EXPLICIT_STATEMENT','USER_CLARIFIED','CORRECTION_INHERITED','LEGACY_FIRST_PERSON_CAPTURE',
  'MODEL_ASSISTED_CAPTURE','MODEL_ASSISTED_RELATION_CAPTURE'));
ALTER TABLE public.memory_subject_attributions DROP CONSTRAINT memory_subject_attributions_provenance_check;
ALTER TABLE public.memory_subject_attributions ADD CONSTRAINT memory_subject_attributions_provenance_check CHECK (
  (execution_id IS NULL OR basis IN ('FIRST_PERSON_CAPTURE','LEGACY_FIRST_PERSON_CAPTURE','MODEL_ASSISTED_CAPTURE','MODEL_ASSISTED_RELATION_CAPTURE'))
  AND (command_id IS NULL OR basis IN ('EXPLICIT_STATEMENT','USER_CLARIFIED','CORRECTION_INHERITED')));
ALTER TABLE public.memory_subject_attributions ADD CONSTRAINT memory_subject_attributions_relation_capture_check CHECK (
  basis IS DISTINCT FROM 'MODEL_ASSISTED_RELATION_CAPTURE' OR (subject = 'OTHER' AND execution_id IS NOT NULL));

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The typed capture result: the 0171 shape, or the same two lists plus updatedMemoryIds (the existing Memories this
--    capture restated or ended). Identifiers only, bounded, distinct, never empty.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.post_response_personal_capture_result_valid_v2(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  list jsonb;
  name text;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_value) k)
     IS NOT DISTINCT FROM ARRAY['indexedMemoryIds','memoryIds'] THEN
    RETURN public.post_response_personal_capture_result_valid_v1(p_value);
  END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_value) k)
     IS DISTINCT FROM ARRAY['indexedMemoryIds','memoryIds','updatedMemoryIds'] THEN RETURN false; END IF;
  FOREACH name IN ARRAY ARRAY['memoryIds','indexedMemoryIds','updatedMemoryIds'] LOOP
    list := p_value->name;
    IF jsonb_typeof(list) <> 'array'
       OR jsonb_array_length(list) > (CASE name WHEN 'memoryIds' THEN 3 WHEN 'indexedMemoryIds' THEN 4 ELSE 13 END) THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(list) e(v) WHERE jsonb_typeof(e.v) <> 'string' OR e.v #>> '{}' !~ uuid_pattern) THEN RETURN false; END IF;
    IF (SELECT count(DISTINCT e.v) FROM jsonb_array_elements(list) e(v)) <> jsonb_array_length(list) THEN RETURN false; END IF;
  END LOOP;
  IF jsonb_array_length(p_value->'memoryIds') + jsonb_array_length(p_value->'indexedMemoryIds')
     + jsonb_array_length(p_value->'updatedMemoryIds') = 0 THEN RETURN false; END IF;
  RETURN true;
END;$$;

ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_understanding_result_check;
ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_understanding_result_check CHECK (
  effect_key IS DISTINCT FROM 'UNDERSTANDING_CAPTURE_PROVIDER'
  OR (state IS NOT DISTINCT FROM 'CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  OR (state IS NOT DISTINCT FROM 'COMPLETED' AND result_code IS NOT DISTINCT FROM 'NO_UNDERSTANDING_RECORDED'
      AND result_reference IS NULL AND result_payload IS NULL)
  OR (state IS NOT DISTINCT FROM 'COMPLETED' AND result_code IS NOT DISTINCT FROM 'UNDERSTANDING_RECORDED'
      AND result_reference IS NULL AND result_payload IS NOT NULL
      AND coalesce(public.post_response_personal_capture_result_valid_v2(result_payload), false)));

-- ---------------------------------------------------------------------------------------------------------------
-- 4. The bounded current-state read. The execution - never the caller - names the owner. Only the owner's own SELF
--    Memories that describe a current state: a current fact with a slot, a plan, a temporary state or a decision -
--    never one already PAST or ended, never someone else's, never an unattributed one. At most ten, last stated first,
--    each with its index terms (its own words and semantic keys) - what a restatement or ending must share to be about it.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.background_current_state_memories_v1(p_source_turn_id uuid, p_limit integer)
RETURNS TABLE(memory_id uuid, type text, content text, terms text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid;
BEGIN
  IF p_source_turn_id IS NULL OR p_limit IS NULL OR p_limit < 0 THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_STATE_REQUEST' USING ERRCODE='22023';
  END IF;
  SELECT e.user_id INTO owner_id FROM public.post_response_intelligence_executions e
   WHERE e.source_turn_id = p_source_turn_id AND e.state = 'RUNNING';
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'UNDERSTANDING_EXECUTION_NOT_ASSOCIATED' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.type, m.content,
           ARRAY(SELECT t.term FROM public.memory_retrieval_terms t WHERE t.memory_id = m.id AND t.user_id = m.user_id ORDER BY t.term)
      FROM public.memories m
      JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id AND a.subject = 'SELF'
      LEFT JOIN public.memory_retrieval_profiles p ON p.memory_id = m.id AND p.user_id = m.user_id
     WHERE m.user_id = owner_id AND m.status = 'ACTIVE'
       AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
       AND p.ended_at IS NULL AND p.temporal IS DISTINCT FROM 'PAST'
       AND ((p.temporal = 'CURRENT' AND p.slot IS NOT NULL) OR p.temporal IN ('PLANNED','TEMPORARY')
            OR m.type IN ('TEMPORARY_STATE','DECISION_COMMITMENT'))
     ORDER BY coalesce(p.last_stated_at, m.created_at) DESC, m.id DESC
     LIMIT least(p_limit, 10);
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. The ONE atomic capture command, v2.
--
--   The 0171 arguments, plus:
--     p_subjects             per new Memory: SELF (MODEL_ASSISTED_CAPTURE, exactly as 0171) or OTHER - a statement of
--                            who one of the user's family is, RELATIONSHIP_CONTEXT, no slot, CURRENT, kept as
--                            OTHER / MODEL_ASSISTED_RELATION_CAPTURE and never as the user's own fact;
--     p_reaffirmed_memory_ids existing Memories the server verified the user restated in this message (<= 10);
--     p_ended_memory_ids     existing Memories the server verified the user explicitly ended in this message (<= 10).
--   A restatement or an ending applies only to the owner's ACTIVE, unexpired SELF Memory created before the source
--   turn and not ended, and only forwards in time: never by a message older than the Memory's last statement. A SELF
--   item whose words are already an ACTIVE SELF / UNATTRIBUTED Memory restates that Memory instead of being skipped
--   silently. Nothing is captured, restated or ended on a Memory-command turn (0152 PD-7).
--   Answers COMPLETED or NO_OP exactly as 0171.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.complete_post_response_personal_capture_v2(
  p_execution_id uuid,
  p_memory_ids uuid[], p_types text[], p_contents text[], p_importances double precision[],
  p_expires_at timestamptz[], p_slots text[], p_temporals text[], p_subjects text[],
  p_index_memory_ids uuid[], p_index_slots text[], p_index_temporals text[],
  p_term_memory_ids uuid[], p_terms text[],
  p_reaffirmed_memory_ids uuid[], p_ended_memory_ids uuid[]
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  source_row public.conversation_turns;
  item_count integer := coalesce(cardinality(p_memory_ids), 0);
  index_count integer := coalesce(cardinality(p_index_memory_ids), 0);
  reaffirmed_count integer := coalesce(cardinality(p_reaffirmed_memory_ids), 0);
  ended_count integer := coalesce(cardinality(p_ended_memory_ids), 0);
  command_turn boolean;
  history_open boolean := false;
  new_key text;
  equivalent_id uuid;
  created public.memories;
  created_ids uuid[] := '{}';
  indexed_ids uuid[] := '{}';
  restate_ids uuid[] := coalesce(p_reaffirmed_memory_ids, '{}');
  updated_ids uuid[] := '{}';
  target uuid;
  i integer;
BEGIN
  IF p_execution_id IS NULL
     OR coalesce(cardinality(p_types), 0) <> item_count OR coalesce(cardinality(p_contents), 0) <> item_count
     OR coalesce(cardinality(p_importances), 0) <> item_count OR coalesce(cardinality(p_expires_at), 0) <> item_count
     OR coalesce(cardinality(p_slots), 0) <> item_count OR coalesce(cardinality(p_temporals), 0) <> item_count
     OR coalesce(cardinality(p_subjects), 0) <> item_count
     OR coalesce(cardinality(p_index_slots), 0) <> index_count OR coalesce(cardinality(p_index_temporals), 0) <> index_count
     OR coalesce(cardinality(p_term_memory_ids), 0) <> coalesce(cardinality(p_terms), 0)
     OR item_count > 3 OR index_count > 4 OR coalesce(cardinality(p_terms), 0) > 64 * (item_count + index_count)
     OR reaffirmed_count > 10 OR ended_count > 10 OR reaffirmed_count + ended_count > 10
     OR array_position(p_memory_ids, NULL) IS NOT NULL OR array_position(p_index_memory_ids, NULL) IS NOT NULL
     OR array_position(p_term_memory_ids, NULL) IS NOT NULL
     OR array_position(p_reaffirmed_memory_ids, NULL) IS NOT NULL OR array_position(p_ended_memory_ids, NULL) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_memory_ids, '{}') || coalesce(p_index_memory_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_reaffirmed_memory_ids, '{}') || coalesce(p_ended_memory_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_reaffirmed_memory_ids, '{}') || coalesce(p_ended_memory_ids, '{}')) u(id) WHERE u.id = ANY (coalesce(p_memory_ids, '{}')))
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
       OR p_subjects[i] IS NULL OR p_subjects[i] NOT IN ('SELF','OTHER')
       -- Someone else's fact is kept only as a family relationship statement: never slotted, never a time-bound state.
       OR (p_subjects[i] = 'OTHER' AND (p_types[i] <> 'RELATIONSHIP_CONTEXT' OR p_slots[i] IS NOT NULL OR p_temporals[i] <> 'CURRENT'))
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

  PERFORM public.memory_equivalence_lock_v1(execution_row.user_id);
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
    -- 0152 SUPERSEDED_BY_LATER_COMMAND, exactly as 0171.
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
    IF p_subjects[i] = 'SELF' THEN
      -- 0152 EQUIVALENT_EXISTS, exactly as 0171 - and the user saying it again is a restatement of that Memory.
      SELECT m.id INTO equivalent_id FROM public.memories m
       WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
         AND public.memory_equivalence_key_v1(m.content) = new_key
         AND coalesce(public.memory_subject_v1(execution_row.user_id, m.id), 'SELF') = 'SELF'
       ORDER BY m.created_at, m.id LIMIT 1;
      IF equivalent_id IS NOT NULL THEN
        IF NOT equivalent_id = ANY (restate_ids || coalesce(p_ended_memory_ids, '{}')) THEN restate_ids := restate_ids || equivalent_id; END IF;
        CONTINUE;
      END IF;
    ELSE
      -- Someone else's fact: the same words already kept, about anyone, are never kept twice.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND public.memory_equivalence_key_v1(m.content) = new_key);
    END IF;
    IF NOT history_open THEN
      PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true);
      history_open := true;
    END IF;
    SELECT * INTO created FROM public.server_create_memory_v1(execution_row.user_id, p_memory_ids[i], p_types[i], p_contents[i],
      'USER_STATED', 0.80, p_importances[i], 'ACTIVE', p_expires_at[i]);
    INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
      VALUES (created.id, execution_row.user_id, p_subjects[i],
              CASE p_subjects[i] WHEN 'SELF' THEN 'MODEL_ASSISTED_CAPTURE' ELSE 'MODEL_ASSISTED_RELATION_CAPTURE' END, execution_row.id);
    INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal)
      VALUES (created.id, execution_row.user_id, true, p_slots[i], p_temporals[i]);
    created_ids := created_ids || created.id;
  END LOOP;

  FOR i IN 1..index_count LOOP
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

  -- The living state. Only the owner's ACTIVE, unexpired SELF Memory, created before this message, not ended, and
  -- never moved by a message older than its last statement; anything else is skipped silently (a Memory forgotten or
  -- corrected since the read is exactly what must not change).
  IF NOT command_turn THEN
    FOREACH target IN ARRAY coalesce(p_ended_memory_ids, '{}') LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.id = target AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
           AND m.created_at < source_row.created_at
           AND public.memory_subject_v1(execution_row.user_id, m.id) = 'SELF');
      INSERT INTO public.memory_retrieval_profiles AS p (memory_id, user_id, semantic_indexed, slot, temporal, ended_at, ended_execution_id)
        VALUES (target, execution_row.user_id, false, NULL, 'PAST', CURRENT_TIMESTAMP, execution_row.id)
        ON CONFLICT (memory_id) DO UPDATE SET temporal = 'PAST', ended_at = CURRENT_TIMESTAMP, ended_execution_id = execution_row.id
          WHERE p.ended_at IS NULL AND (p.last_stated_at IS NULL OR p.last_stated_at < source_row.created_at);
      CONTINUE WHEN NOT FOUND;
      updated_ids := updated_ids || target;
    END LOOP;
    FOREACH target IN ARRAY restate_ids LOOP
      CONTINUE WHEN target = ANY (updated_ids) OR NOT EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.id = target AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
           AND m.created_at < source_row.created_at
           AND public.memory_subject_v1(execution_row.user_id, m.id) = 'SELF');
      INSERT INTO public.memory_retrieval_profiles AS p (memory_id, user_id, semantic_indexed, slot, temporal, last_stated_at, restated_count)
        VALUES (target, execution_row.user_id, false, NULL, NULL, source_row.created_at, 1)
        ON CONFLICT (memory_id) DO UPDATE SET last_stated_at = source_row.created_at, restated_count = p.restated_count + 1
          WHERE p.ended_at IS NULL AND (p.last_stated_at IS NULL OR p.last_stated_at < source_row.created_at);
      CONTINUE WHEN NOT FOUND;
      updated_ids := updated_ids || target;
    END LOOP;
  END IF;

  -- Expiry cleanup, exactly as 0171.
  DELETE FROM public.memory_retrieval_terms t USING public.memories m
   WHERE t.memory_id = m.id AND t.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM public.memory_retrieval_profiles p USING public.memories m
   WHERE p.memory_id = m.id AND p.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;

  UPDATE public.post_response_intelligence_effects
     SET state = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
         result_code = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) + cardinality(updated_ids) = 0
           THEN 'NO_UNDERSTANDING_RECORDED' ELSE 'UNDERSTANDING_RECORDED' END,
         result_payload = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) + cardinality(updated_ids) = 0 THEN NULL
           ELSE jsonb_build_object('memoryIds', to_jsonb(created_ids::text[]), 'indexedMemoryIds', to_jsonb(indexed_ids::text[]),
                                   'updatedMemoryIds', to_jsonb(updated_ids::text[])) END
   WHERE execution_id = p_execution_id AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER' AND state = 'CLAIMED';
  IF NOT FOUND THEN RAISE EXCEPTION 'UNDERSTANDING_CAPTURE_COMPLETION_LOST' USING ERRCODE='55000'; END IF;
  RETURN 'COMPLETED';
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. The knowledge read. SECURITY INVOKER: the caller's own RLS on memories, attributions and profiles is the
--    authority, and auth.uid() names the owner explicitly as well. Eligibility is read from public.memories at read
--    time - ACTIVE and unexpired - so a forgotten, corrected, disabled or expired Memory is never in the picture and
--    nothing derived from it survives (there is no stored picture). Never an Interaction Preference (the canonical
--    preference record is the one authority) and never a Derived Insight (an inference is not a stated fact).
--    Ordered so the bound drops the least central rows first: current slotted SELF facts, then someone-else and
--    relationship rows, then goals, then current states, then everything else, PAST and ended last.
--    unsettled: the 0171 same-slot rule, computed over every live row (never truncated by the bound).
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.personal_knowledge_sources_v1(p_limit integer)
RETURNS TABLE(id uuid, type text, content text, source text, importance double precision, created_at timestamptz,
  expires_at timestamptz, subject text, slot text, temporal text, last_stated_at timestamptz, restated_count integer,
  ended boolean, unsettled boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH me AS (SELECT (SELECT auth.uid()) AS uid),
  live AS MATERIALIZED (
    SELECT m.id, m.type, m.content, m.source, m.importance, m.created_at, m.expires_at, a.subject, p.slot, p.temporal,
           coalesce(p.last_stated_at, m.created_at) AS last_stated_at, coalesce(p.restated_count, 0) AS restated_count,
           p.ended_at IS NOT NULL AS ended
      FROM public.memories m
      JOIN me ON m.user_id = me.uid
      LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
      LEFT JOIN public.memory_retrieval_profiles p ON p.memory_id = m.id AND p.user_id = m.user_id
     WHERE m.status = 'ACTIVE' AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
  ), shared_slot AS (
    SELECT l.slot FROM live l WHERE l.slot IS NOT NULL AND l.temporal = 'CURRENT' AND l.subject = 'SELF'
     GROUP BY l.slot HAVING count(*) > 1
  )
  SELECT l.id, l.type, l.content, l.source, l.importance, l.created_at, l.expires_at, l.subject, l.slot, l.temporal,
         l.last_stated_at, l.restated_count, l.ended,
         coalesce(l.temporal = 'CURRENT' AND l.subject = 'SELF' AND l.slot IN (SELECT c.slot FROM shared_slot c), false) AS unsettled
    FROM live l
   ORDER BY
     CASE WHEN l.ended OR l.temporal = 'PAST' THEN 5
          WHEN l.subject = 'SELF' AND l.slot IS NOT NULL AND l.temporal = 'CURRENT' THEN 0
          WHEN l.subject = 'OTHER' OR l.type = 'RELATIONSHIP_CONTEXT' THEN 1
          WHEN l.type = 'GOAL' THEN 2
          WHEN l.type IN ('TEMPORARY_STATE','DECISION_COMMITMENT') OR l.temporal IN ('PLANNED','TEMPORARY') THEN 3
          ELSE 4 END,
     l.restated_count DESC, l.last_stated_at DESC, l.id
   LIMIT least(greatest(coalesce(p_limit, 0), 0), 120)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Ownership and privileges, all explicit.
-- ---------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.keep_memory_living_state_v1() OWNER TO postgres;
ALTER FUNCTION public.post_response_personal_capture_result_valid_v2(jsonb) OWNER TO postgres;
ALTER FUNCTION public.background_current_state_memories_v1(uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.complete_post_response_personal_capture_v2(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[]) OWNER TO postgres;
ALTER FUNCTION public.personal_knowledge_sources_v1(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION
  public.keep_memory_living_state_v1(),
  public.post_response_personal_capture_result_valid_v2(jsonb),
  public.background_current_state_memories_v1(uuid,integer),
  public.complete_post_response_personal_capture_v2(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[]),
  public.personal_knowledge_sources_v1(integer)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.background_current_state_memories_v1(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_post_response_personal_capture_v2(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_knowledge_sources_v1(integer) TO authenticated;

COMMIT;
