-- S8A-03 - Open Understanding v1: capture schema v3, the durable half (Product Owner decision 2026-10-24; CP2 amendment §10).
--
-- The Product Owner adopted Open Understanding as the direction of QANDEEL's mind after the S8A-03 two-arm experiment:
-- DeepSeek reads the meaning of the user's message (with the recent turns and what QANDEEL already knows); QANDEEL proves
-- grounding, ownership and structure on the server, then organizes, saves, corrects and forgets. The linguistic gates
-- that blocked understanding are removed; the privacy, data-integrity and attribution guarantees are kept, and Living
-- Personal Memory (0172: CORE / CURRENT / HISTORICAL, restatement, ending) is kept whole. This migration adds:
--
--   1. memory_person_labels - whom an OTHER Memory is about: the person's name and / or relation to the user, as the
--      user's own words said them (grounded by the server verifier), so someone else's fact is stored as that person's,
--      with no closed kin-word list deciding it.
--   2. background_memory_commands - the forget / correct requests the background capture understood and executed
--      (identifiers only). The foreground deterministic Memory commands are unchanged and stay first: nothing is
--      captured on a foreground Memory-command turn.
--   3. background_known_memories_v1 - the bounded read of the owner's live Memories the capture may ground people on,
--      restate, end, forget or correct (at most 40, SELF and OTHER, with person labels). Service role, execution-scoped.
--   4. complete_post_response_personal_capture_v3 - the ONE atomic capture command: up to six new atomic Memories,
--      someone else's facts with a person label (any non-temporary type, CURRENT / PAST / PLANNED, never a slot), endings
--      and restatements of SELF and OTHER Memories, forget (DELETED, equivalent copies too) and correct (supersede; the
--      successor keeps the subject and the label) - all in one transaction with the typed completion, or nothing.
--   5. personal_knowledge_sources_v2 - the 0172 knowledge read plus the person label (SECURITY INVOKER, RLS).
--
-- Unchanged guarantees: the execution (never the caller) names the owner; only the owner's ACTIVE Memories created before
-- the message are touched; nothing is captured on a foreground Memory-command turn; a later forget / correct (foreground
-- or background) is never undone by an older message's capture; every write is in one transaction; service_role only for
-- writes and the background read, authenticated only for the caller's own reads under RLS. Deleted Memories leave every
-- read; the governed account erasure (0130) removes the new rows through the CASCADE of their Memory foreign keys.
--
-- No user address form is read or stored (not adopted, amendment §10). The 0171 and 0172 commands and the 0172 current-
-- state read are left in place and unchanged; the runtime no longer calls them.
--
-- No hosted application is authorized by this file: it is applied to the local verification database only until a
-- separate authorization says otherwise. Migrations 0001-0172 are byte-unchanged.

BEGIN;

-- 1. Person labels ----------------------------------------------------------------------------------------------------
CREATE TABLE public.memory_person_labels (
  memory_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  person_name text,
  person_relation text,
  execution_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT memory_person_labels_memory_fk FOREIGN KEY (memory_id, user_id) REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
  CONSTRAINT memory_person_labels_present_check CHECK (person_name IS NOT NULL OR person_relation IS NOT NULL),
  CONSTRAINT memory_person_labels_bounds_check CHECK (
    (person_name IS NULL OR char_length(btrim(person_name)) BETWEEN 1 AND 40)
    AND (person_relation IS NULL OR char_length(btrim(person_relation)) BETWEEN 1 AND 40))
);
ALTER TABLE public.memory_person_labels OWNER TO postgres;
ALTER TABLE public.memory_person_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.memory_person_labels FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.memory_person_labels TO authenticated, service_role;
CREATE POLICY memory_person_labels_select_own ON public.memory_person_labels
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- 2. Background forget / correct record --------------------------------------------------------------------------------
CREATE TABLE public.background_memory_commands (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid,
  source_turn_id uuid NOT NULL,
  execution_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('FORGET','CORRECT')),
  target_memory_id uuid NOT NULL,
  new_memory_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT background_memory_commands_shape_check CHECK ((kind = 'CORRECT') = (new_memory_id IS NOT NULL)),
  CONSTRAINT background_memory_commands_target_fk FOREIGN KEY (target_memory_id, user_id)
    REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
  CONSTRAINT background_memory_commands_new_fk FOREIGN KEY (new_memory_id, user_id)
    REFERENCES public.memories (id, user_id) ON DELETE CASCADE
);
CREATE INDEX background_memory_commands_user_idx ON public.background_memory_commands (user_id, source_turn_id);
CREATE INDEX background_memory_commands_target_idx ON public.background_memory_commands (target_memory_id, user_id);
CREATE INDEX background_memory_commands_new_idx ON public.background_memory_commands (new_memory_id, user_id) WHERE new_memory_id IS NOT NULL;
ALTER TABLE public.background_memory_commands OWNER TO postgres;
ALTER TABLE public.background_memory_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.background_memory_commands FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.background_memory_commands TO authenticated;
CREATE POLICY background_memory_commands_select_own ON public.background_memory_commands
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- The typed v3 result: memoryIds (new and corrected successors, <= 8), indexedMemoryIds (<= 4), updatedMemoryIds
-- (restated / ended, <= 20) and retiredMemoryIds (forgotten / corrected predecessors, <= 5).
CREATE FUNCTION public.post_response_personal_capture_result_valid_v3(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  list jsonb;
  name text;
  total integer := 0;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_value) k)
     IS DISTINCT FROM ARRAY['indexedMemoryIds','memoryIds','retiredMemoryIds','updatedMemoryIds'] THEN RETURN false; END IF;
  FOREACH name IN ARRAY ARRAY['memoryIds','indexedMemoryIds','updatedMemoryIds','retiredMemoryIds'] LOOP
    list := p_value->name;
    IF jsonb_typeof(list) <> 'array' OR jsonb_array_length(list) >
       (CASE name WHEN 'memoryIds' THEN 8 WHEN 'indexedMemoryIds' THEN 4 WHEN 'updatedMemoryIds' THEN 20 ELSE 5 END) THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(list) e(v) WHERE jsonb_typeof(e.v) <> 'string' OR e.v #>> '{}' !~ uuid_pattern) THEN RETURN false; END IF;
    IF (SELECT count(DISTINCT e.v) FROM jsonb_array_elements(list) e(v)) <> jsonb_array_length(list) THEN RETURN false; END IF;
    total := total + jsonb_array_length(list);
  END LOOP;
  RETURN total > 0;
END;$$;

ALTER TABLE public.post_response_intelligence_effects DROP CONSTRAINT post_response_intelligence_effects_understanding_result_check;
ALTER TABLE public.post_response_intelligence_effects ADD CONSTRAINT post_response_intelligence_effects_understanding_result_check CHECK (
  effect_key IS DISTINCT FROM 'UNDERSTANDING_CAPTURE_PROVIDER'
  OR (state IS NOT DISTINCT FROM 'CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  OR (state IS NOT DISTINCT FROM 'COMPLETED' AND result_code IS NOT DISTINCT FROM 'NO_UNDERSTANDING_RECORDED'
      AND result_reference IS NULL AND result_payload IS NULL)
  OR (state IS NOT DISTINCT FROM 'COMPLETED' AND result_code IS NOT DISTINCT FROM 'UNDERSTANDING_RECORDED'
      AND result_reference IS NULL AND result_payload IS NOT NULL
      AND (coalesce(public.post_response_personal_capture_result_valid_v2(result_payload), false)
           OR coalesce(public.post_response_personal_capture_result_valid_v3(result_payload), false))));

-- 3. The known-Memories read ------------------------------------------------------------------------------------------
-- People first (they ground who a fact is about), then the 0172 knowledge order; PAST and ended last.
CREATE FUNCTION public.background_known_memories_v1(p_source_turn_id uuid, p_limit integer)
RETURNS TABLE(memory_id uuid, type text, content text, subject text, person_name text, person_relation text,
  temporal text, ended boolean, terms text[])
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
    SELECT m.id, m.type, m.content, coalesce(a.subject, 'UNATTRIBUTED'), l.person_name, l.person_relation,
           p.temporal, p.ended_at IS NOT NULL,
           ARRAY(SELECT t.term FROM public.memory_retrieval_terms t WHERE t.memory_id = m.id AND t.user_id = m.user_id ORDER BY t.term)
      FROM public.memories m
      LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
      LEFT JOIN public.memory_retrieval_profiles p ON p.memory_id = m.id AND p.user_id = m.user_id
      LEFT JOIN public.memory_person_labels l ON l.memory_id = m.id AND l.user_id = m.user_id
     WHERE m.user_id = owner_id AND m.status = 'ACTIVE'
       AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
     ORDER BY
       CASE WHEN p.ended_at IS NOT NULL OR p.temporal = 'PAST' THEN 6
            WHEN a.subject = 'OTHER' OR m.type = 'RELATIONSHIP_CONTEXT' THEN 0
            WHEN a.subject = 'SELF' AND p.slot IS NOT NULL AND p.temporal = 'CURRENT' THEN 1
            WHEN m.type = 'GOAL' THEN 2
            WHEN m.type IN ('TEMPORARY_STATE','DECISION_COMMITMENT') OR p.temporal IN ('PLANNED','TEMPORARY') THEN 3
            WHEN a.subject IS NULL THEN 5
            ELSE 4 END,
       coalesce(p.last_stated_at, m.created_at) DESC, m.id DESC
     LIMIT least(p_limit, 40);
END;$$;

-- 4. The ONE atomic capture command ------------------------------------------------------------------------------
CREATE FUNCTION public.complete_post_response_personal_capture_v3(
  p_execution_id uuid,
  p_memory_ids uuid[], p_types text[], p_contents text[], p_importances double precision[],
  p_expires_at timestamptz[], p_slots text[], p_temporals text[], p_subjects text[],
  p_person_names text[], p_person_relations text[],
  p_index_memory_ids uuid[], p_index_slots text[], p_index_temporals text[],
  p_term_memory_ids uuid[], p_terms text[],
  p_reaffirmed_memory_ids uuid[], p_ended_memory_ids uuid[],
  p_forget_memory_ids uuid[],
  p_correct_memory_ids uuid[], p_correct_new_ids uuid[], p_correct_types text[], p_correct_contents text[],
  p_correct_importances double precision[], p_correct_slots text[], p_correct_temporals text[]
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  source_row public.conversation_turns;
  item_count integer := coalesce(cardinality(p_memory_ids), 0);
  index_count integer := coalesce(cardinality(p_index_memory_ids), 0);
  reaffirmed_count integer := coalesce(cardinality(p_reaffirmed_memory_ids), 0);
  ended_count integer := coalesce(cardinality(p_ended_memory_ids), 0);
  forget_count integer := coalesce(cardinality(p_forget_memory_ids), 0);
  correct_count integer := coalesce(cardinality(p_correct_memory_ids), 0);
  command_turn boolean;
  history_open boolean := false;
  new_key text;
  equivalent_id uuid;
  created public.memories;
  target_row public.memories;
  target_subject text;
  label_row public.memory_person_labels;
  command_id uuid;
  copy_id uuid;
  created_ids uuid[] := '{}';
  indexed_ids uuid[] := '{}';
  restate_ids uuid[] := coalesce(p_reaffirmed_memory_ids, '{}');
  updated_ids uuid[] := '{}';
  retired_ids uuid[] := '{}';
  retired_keys text[] := '{}';
  target uuid;
  i integer;
BEGIN
  IF p_execution_id IS NULL
     OR coalesce(cardinality(p_types), 0) <> item_count OR coalesce(cardinality(p_contents), 0) <> item_count
     OR coalesce(cardinality(p_importances), 0) <> item_count OR coalesce(cardinality(p_expires_at), 0) <> item_count
     OR coalesce(cardinality(p_slots), 0) <> item_count OR coalesce(cardinality(p_temporals), 0) <> item_count
     OR coalesce(cardinality(p_subjects), 0) <> item_count
     OR coalesce(cardinality(p_person_names), 0) <> item_count OR coalesce(cardinality(p_person_relations), 0) <> item_count
     OR coalesce(cardinality(p_index_slots), 0) <> index_count OR coalesce(cardinality(p_index_temporals), 0) <> index_count
     OR coalesce(cardinality(p_term_memory_ids), 0) <> coalesce(cardinality(p_terms), 0)
     OR coalesce(cardinality(p_correct_new_ids), 0) <> correct_count OR coalesce(cardinality(p_correct_types), 0) <> correct_count
     OR coalesce(cardinality(p_correct_contents), 0) <> correct_count OR coalesce(cardinality(p_correct_importances), 0) <> correct_count
     OR coalesce(cardinality(p_correct_slots), 0) <> correct_count OR coalesce(cardinality(p_correct_temporals), 0) <> correct_count
     OR item_count > 6 OR index_count > 4 OR forget_count > 3 OR correct_count > 2
     OR coalesce(cardinality(p_terms), 0) > 64 * (item_count + index_count + correct_count)
     OR reaffirmed_count + ended_count > 20
     OR array_position(p_memory_ids, NULL) IS NOT NULL OR array_position(p_index_memory_ids, NULL) IS NOT NULL
     OR array_position(p_term_memory_ids, NULL) IS NOT NULL
     OR array_position(p_reaffirmed_memory_ids, NULL) IS NOT NULL OR array_position(p_ended_memory_ids, NULL) IS NOT NULL
     OR array_position(p_forget_memory_ids, NULL) IS NOT NULL OR array_position(p_correct_memory_ids, NULL) IS NOT NULL
     OR array_position(p_correct_new_ids, NULL) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_memory_ids, '{}') || coalesce(p_index_memory_ids, '{}') || coalesce(p_correct_new_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_reaffirmed_memory_ids, '{}') || coalesce(p_ended_memory_ids, '{}')
                                     || coalesce(p_forget_memory_ids, '{}') || coalesce(p_correct_memory_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_reaffirmed_memory_ids, '{}') || coalesce(p_ended_memory_ids, '{}')
                                     || coalesce(p_forget_memory_ids, '{}') || coalesce(p_correct_memory_ids, '{}')) u(id)
                 WHERE u.id = ANY (coalesce(p_memory_ids, '{}') || coalesce(p_correct_new_ids, '{}')))
  THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_terms, '{}')) t(term)
              WHERE t.term IS NULL OR char_length(t.term) NOT BETWEEN 2 AND 48 OR t.term !~ '^[^[:space:]]+$')
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_slots, '{}') || coalesce(p_index_slots, '{}') || coalesce(p_correct_slots, '{}')) s(slot)
                 WHERE s.slot IS NOT NULL AND s.slot NOT IN ('RESIDENCE','OCCUPATION','EMPLOYER','STUDY','MARITAL_STATUS','SMOKING'))
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_temporals, '{}') || coalesce(p_index_temporals, '{}') || coalesce(p_correct_temporals, '{}')) s(temporal)
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
       -- The user's own fact never carries a person label; someone else's always does, is never slotted and never temporary.
       OR (p_subjects[i] = 'SELF' AND (p_person_names[i] IS NOT NULL OR p_person_relations[i] IS NOT NULL))
       OR (p_subjects[i] = 'OTHER' AND (p_person_names[i] IS NULL AND p_person_relations[i] IS NULL))
       OR (p_subjects[i] = 'OTHER' AND (p_slots[i] IS NOT NULL OR p_temporals[i] = 'TEMPORARY'))
       OR char_length(btrim(coalesce(p_person_names[i], 'x'))) NOT BETWEEN 1 AND 40
       OR char_length(btrim(coalesce(p_person_relations[i], 'x'))) NOT BETWEEN 1 AND 40
    THEN
      RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
    END IF;
  END LOOP;
  FOR i IN 1..correct_count LOOP
    PERFORM public.assert_canonical_memory_shape_v1(p_correct_types[i], p_correct_contents[i], 'USER_STATED', 0.80, p_correct_importances[i], 'ACTIVE', NULL);
    IF p_correct_types[i] NOT IN ('STABLE_PREFERENCE','PERSONAL_FACT','GOAL','DECISION_COMMITMENT','RELATIONSHIP_CONTEXT')
       OR char_length(p_correct_contents[i]) > 280 OR p_correct_temporals[i] = 'TEMPORARY' THEN
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

  -- (a) Forget and correct first, so nothing this same message proposes can bring the withdrawn words back.
  IF NOT command_turn THEN
    FOREACH target IN ARRAY coalesce(p_forget_memory_ids, '{}') LOOP
      SELECT * INTO target_row FROM public.memories m
       WHERE m.id = target AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT') AND m.created_at < source_row.created_at
       FOR UPDATE;
      CONTINUE WHEN NOT FOUND;
      IF NOT history_open THEN PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true); history_open := true; END IF;
      command_id := gen_random_uuid();
      INSERT INTO public.background_memory_commands (id, user_id, session_id, source_turn_id, execution_id, kind, target_memory_id)
        VALUES (command_id, execution_row.user_id, execution_row.session_id, source_row.id, execution_row.id, 'FORGET', target);
      PERFORM 1 FROM public.server_mark_memory_deleted_v1(execution_row.user_id, target);
      new_key := public.memory_equivalence_key_v1(target_row.content);
      retired_keys := retired_keys || new_key;
      FOR copy_id IN SELECT m.id FROM public.memories m
                      WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE' AND m.id <> target
                        AND public.memory_equivalence_key_v1(m.content) = new_key ORDER BY m.id LOOP
        PERFORM public.memory_dispose_equivalent_v1(execution_row.user_id, copy_id, command_id, target, 'FORGOTTEN');
      END LOOP;
      retired_ids := retired_ids || target;
    END LOOP;
    FOR i IN 1..correct_count LOOP
      SELECT * INTO target_row FROM public.memories m
       WHERE m.id = p_correct_memory_ids[i] AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT') AND m.created_at < source_row.created_at
       FOR UPDATE;
      CONTINUE WHEN NOT FOUND;
      target_subject := public.memory_subject_v1(execution_row.user_id, target_row.id);
      CONTINUE WHEN target_subject IS NULL OR (target_subject = 'OTHER' AND p_correct_slots[i] IS NOT NULL);
      IF NOT history_open THEN PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true); history_open := true; END IF;
      command_id := gen_random_uuid();
      SELECT * INTO created FROM public.server_supersede_memory_v1(execution_row.user_id, target_row.id, p_correct_new_ids[i],
        p_correct_types[i], p_correct_contents[i], 'USER_STATED', 0.80, p_correct_importances[i], 'ACTIVE', NULL);
      CONTINUE WHEN created.id IS NULL;
      INSERT INTO public.background_memory_commands (id, user_id, session_id, source_turn_id, execution_id, kind, target_memory_id, new_memory_id)
        VALUES (command_id, execution_row.user_id, execution_row.session_id, source_row.id, execution_row.id, 'CORRECT', target_row.id, created.id);
      INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
        VALUES (created.id, execution_row.user_id, target_subject,
                CASE target_subject WHEN 'SELF' THEN 'MODEL_ASSISTED_CAPTURE' ELSE 'MODEL_ASSISTED_RELATION_CAPTURE' END, execution_row.id);
      SELECT * INTO label_row FROM public.memory_person_labels l WHERE l.memory_id = target_row.id AND l.user_id = execution_row.user_id;
      IF FOUND THEN
        INSERT INTO public.memory_person_labels (memory_id, user_id, person_name, person_relation, execution_id)
          VALUES (created.id, execution_row.user_id, label_row.person_name, label_row.person_relation, execution_row.id);
      END IF;
      INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal)
        VALUES (created.id, execution_row.user_id, true, p_correct_slots[i], p_correct_temporals[i]);
      new_key := public.memory_equivalence_key_v1(target_row.content);
      retired_keys := retired_keys || new_key;
      FOR copy_id IN SELECT m.id FROM public.memories m
                      WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE' AND m.id <> created.id
                        AND public.memory_equivalence_key_v1(m.content) = new_key ORDER BY m.id LOOP
        PERFORM public.memory_dispose_equivalent_v1(execution_row.user_id, copy_id, command_id, created.id, 'CORRECTED');
      END LOOP;
      created_ids := created_ids || created.id;
      retired_ids := retired_ids || target_row.id;
    END LOOP;
  END IF;

  -- (b) New atomic Memories.
  FOR i IN 1..item_count LOOP
    EXIT WHEN command_turn;
    new_key := public.memory_equivalence_key_v1(btrim(p_contents[i]));
    CONTINUE WHEN new_key = ANY (retired_keys);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id = execution_row.user_id AND m.type = p_types[i] AND m.status = 'ACTIVE'
        AND public.memory_equivalence_key_v1(m.content) = new_key
      ORDER BY m.id FOR UPDATE;
    -- 0152 SUPERSEDED_BY_LATER_COMMAND, as 0171 / 0172 ...
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
    -- ... and the same for a later background forget / correct: an older message never brings its words back.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.background_memory_commands c
        JOIN public.conversation_turns later ON later.id = c.source_turn_id
        JOIN public.memories m ON m.user_id = c.user_id AND m.id = c.target_memory_id
       WHERE c.user_id = execution_row.user_id
         AND public.memory_equivalence_key_v1(m.content) = new_key
         AND (later.created_at, later.id) > (source_row.created_at, source_row.id));
    IF p_subjects[i] = 'SELF' THEN
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
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND public.memory_equivalence_key_v1(m.content) = new_key);
    END IF;
    IF NOT history_open THEN PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true); history_open := true; END IF;
    SELECT * INTO created FROM public.server_create_memory_v1(execution_row.user_id, p_memory_ids[i], p_types[i], p_contents[i],
      'USER_STATED', 0.80, p_importances[i], 'ACTIVE', p_expires_at[i]);
    INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
      VALUES (created.id, execution_row.user_id, p_subjects[i],
              CASE p_subjects[i] WHEN 'SELF' THEN 'MODEL_ASSISTED_CAPTURE' ELSE 'MODEL_ASSISTED_RELATION_CAPTURE' END, execution_row.id);
    IF p_subjects[i] = 'OTHER' THEN
      INSERT INTO public.memory_person_labels (memory_id, user_id, person_name, person_relation, execution_id)
        VALUES (created.id, execution_row.user_id, nullif(btrim(p_person_names[i]), ''), nullif(btrim(p_person_relations[i]), ''), execution_row.id);
    END IF;
    INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal)
      VALUES (created.id, execution_row.user_id, true, p_slots[i], p_temporals[i]);
    created_ids := created_ids || created.id;
  END LOOP;

  -- (c) Backfill index, exactly as 0172.
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

  -- (d) The living state, SELF and OTHER alike: the owner's ACTIVE, unexpired Memory, created before this message, never
  --     moved by a message older than its last statement. A Memory forgotten or corrected since the read is skipped.
  IF NOT command_turn THEN
    FOREACH target IN ARRAY coalesce(p_ended_memory_ids, '{}') LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.id = target AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
           AND m.created_at < source_row.created_at
           AND public.memory_subject_v1(execution_row.user_id, m.id) IN ('SELF','OTHER'));
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
           AND public.memory_subject_v1(execution_row.user_id, m.id) IN ('SELF','OTHER'));
      INSERT INTO public.memory_retrieval_profiles AS p (memory_id, user_id, semantic_indexed, slot, temporal, last_stated_at, restated_count)
        VALUES (target, execution_row.user_id, false, NULL, NULL, source_row.created_at, 1)
        ON CONFLICT (memory_id) DO UPDATE SET last_stated_at = source_row.created_at, restated_count = p.restated_count + 1
          WHERE p.ended_at IS NULL AND (p.last_stated_at IS NULL OR p.last_stated_at < source_row.created_at);
      CONTINUE WHEN NOT FOUND;
      updated_ids := updated_ids || target;
    END LOOP;
  END IF;

  DELETE FROM public.memory_retrieval_terms t USING public.memories m
   WHERE t.memory_id = m.id AND t.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM public.memory_retrieval_profiles p USING public.memories m
   WHERE p.memory_id = m.id AND p.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;

  UPDATE public.post_response_intelligence_effects
     SET state = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
         result_code = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) + cardinality(updated_ids) + cardinality(retired_ids) = 0
           THEN 'NO_UNDERSTANDING_RECORDED' ELSE 'UNDERSTANDING_RECORDED' END,
         result_payload = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) + cardinality(updated_ids) + cardinality(retired_ids) = 0 THEN NULL
           ELSE jsonb_build_object('memoryIds', to_jsonb(created_ids::text[]), 'indexedMemoryIds', to_jsonb(indexed_ids::text[]),
                                   'updatedMemoryIds', to_jsonb(updated_ids::text[]), 'retiredMemoryIds', to_jsonb(retired_ids::text[])) END
   WHERE execution_id = p_execution_id AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER' AND state = 'CLAIMED';
  IF NOT FOUND THEN RAISE EXCEPTION 'UNDERSTANDING_CAPTURE_COMPLETION_LOST' USING ERRCODE='55000'; END IF;
  RETURN 'COMPLETED';
END;$$;

-- 5. The knowledge read with person labels ----------------------------------------------------------------------------
CREATE FUNCTION public.personal_knowledge_sources_v2(p_limit integer)
RETURNS TABLE(id uuid, type text, content text, source text, importance double precision, created_at timestamptz,
  expires_at timestamptz, subject text, slot text, temporal text, last_stated_at timestamptz, restated_count integer,
  ended boolean, unsettled boolean, person_name text, person_relation text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT k.id, k.type, k.content, k.source, k.importance, k.created_at, k.expires_at, k.subject, k.slot, k.temporal,
         k.last_stated_at, k.restated_count, k.ended, k.unsettled, l.person_name, l.person_relation
    FROM public.personal_knowledge_sources_v1(p_limit) WITH ORDINALITY AS k(id, type, content, source, importance, created_at,
         expires_at, subject, slot, temporal, last_stated_at, restated_count, ended, unsettled, ord)
    LEFT JOIN public.memory_person_labels l ON l.memory_id = k.id AND l.user_id = (SELECT auth.uid())
   ORDER BY k.ord
$$;

ALTER FUNCTION public.post_response_personal_capture_result_valid_v3(jsonb) OWNER TO postgres;
ALTER FUNCTION public.background_known_memories_v1(uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.complete_post_response_personal_capture_v3(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[],uuid[],uuid[],uuid[],text[],text[],double precision[],text[],text[]) OWNER TO postgres;
ALTER FUNCTION public.personal_knowledge_sources_v2(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION
  public.post_response_personal_capture_result_valid_v3(jsonb),
  public.background_known_memories_v1(uuid,integer),
  public.complete_post_response_personal_capture_v3(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[],uuid[],uuid[],uuid[],text[],text[],double precision[],text[],text[]),
  public.personal_knowledge_sources_v2(integer)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.background_known_memories_v1(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_post_response_personal_capture_v3(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[],uuid[],uuid[],uuid[],text[],text[],double precision[],text[],text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_knowledge_sources_v2(integer) TO authenticated;

COMMIT;
