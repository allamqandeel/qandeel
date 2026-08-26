-- A2.3c - Automatic Hypothesis Update Invocation + Durable Recovery v1.
--
-- A2.3a (migration 0031) durably stores the exact post-authority Association
-- command batch; A2.3b (migration 0032) provides the canonical service-role
-- Hypothesis Update boundary; Finding 09 guarantees exact-version post-update
-- Confidence. The dispatcher still deliberately performs ZERO Hypothesis
-- mutations for a recovered AUTHORIZED_COMMANDS batch, and a naive application
-- loop over the commands would create the two crash gaps A2.3c exists to
-- close: a committed mutation with no durable receipt, and a partially applied
-- authorized batch.
--
-- This forward-only migration adds ONE new typed MANAGED effect,
-- HYPOTHESIS_UPDATE_BATCH, on the existing effect ledger - no second ledger,
-- no per-command table, no new column - and ONE specialized service-role
-- command that performs the complete managed operation inside a single
-- database transaction:
--   * derives the user and conversation session from the execution row and the
--     command batch from the exact durable ASSOCIATION_PROVIDER /
--     AUTHORIZED_COMMANDS result (the application supplies ONLY pre-generated
--     audit/evaluation UUID identities - never a userId, sessionId, command
--     payload, access token or user JWT);
--   * claims the managed effect internally (the ordinary claim path rejects
--     it, so a crash can never strand a CLAIMED managed row);
--   * pre-locks every target Hypothesis in deterministic id order, bound to
--     the execution owner and the exact CONVERSATION_SESSION scope;
--   * applies every command through the canonical A2.3b boundary
--     background_apply_hypothesis_evidence_update_v1 in the original durable
--     order, all-or-nothing: any canonical rejection rolls back EVERY mutation
--     and audit row of the batch and completes the effect as UPDATES_REJECTED;
--   * only after ALL mutations succeed, attempts exact-version Confidence per
--     mutation through background_create_confidence_evaluation_v1 with the
--     mutation's exact after_version, each attempt isolated in its own
--     exception sub-block so a Confidence failure becomes a durable
--     PENDING_RETRY receipt without rolling back the mutation batch;
--   * completes the effect as UPDATES_APPLIED with the exact ordered immutable
--     receipt array IN THE SAME TRANSACTION, so there is no crash gap between
--     committed mutation and durable recovery receipt.
-- Unexpected infrastructure failures abort the whole transaction: no managed
-- effect, no mutation and no audit row persist, so redelivery is safe. Only
-- expected canonical rejections (stale version, ineligible or already-attached
-- Evidence, an unbound target) become the durable UPDATES_REJECTED result.
-- Exception text, stack traces and provider data are never persisted.

BEGIN;

-- 1. The managed effect joins the canonical registry. Every existing effect
--    key keeps its exact semantics.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_effect_key_check,
  ADD CONSTRAINT post_response_intelligence_effects_effect_key_check
    CHECK(effect_key IN('MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH'));

-- 2. Invocation-identity validator. The application pre-generates one
--    {updateId, confidenceEvaluationId} pair per durable command; these are
--    idempotency/audit identities ONLY, never authority. Shape: 1..4 exact
--    two-key objects, canonical UUIDs, update IDs unique, Confidence IDs
--    unique, and no UUID reused across the two identity sets. Internal-only,
--    IMMUTABLE, no table reads.
CREATE FUNCTION public.post_response_hypothesis_update_invocation_ids_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  element jsonb; seen text[] := '{}'; identity text;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_value) NOT BETWEEN 1 AND 4 THEN RETURN false; END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(p_value) AS entry(value) LOOP
    IF jsonb_typeof(element)<>'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(element) k)
       IS DISTINCT FROM ARRAY['confidenceEvaluationId','updateId'] THEN RETURN false; END IF;
    FOREACH identity IN ARRAY ARRAY[element->>'updateId', element->>'confidenceEvaluationId'] LOOP
      IF identity IS NULL OR identity !~* uuid_pattern THEN RETURN false; END IF;
      IF lower(identity) = ANY(seen) THEN RETURN false; END IF;
      seen := array_append(seen, lower(identity));
    END LOOP;
    IF jsonb_typeof(element->'updateId')<>'string' OR jsonb_typeof(element->'confidenceEvaluationId')<>'string' THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;$$;

ALTER FUNCTION public.post_response_hypothesis_update_invocation_ids_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_hypothesis_update_invocation_ids_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 3. Durable receipt validator. Shape/bounds only - exact keys, 1-based
--    sequential ordinals, canonical unique identities with no cross-set reuse,
--    positive int32 versions with beforeVersion = expectedVersion and
--    afterVersion = expectedVersion + 1, canonical Evidence identity, exact
--    role and Confidence-status vocabularies. Current-world cross-checks
--    belong to the managed command and runtime recovery, never to a CHECK.
CREATE FUNCTION public.post_response_hypothesis_update_batch_result_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  evidence_pattern constant text := '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  element jsonb; seen text[] := '{}'; identity text; ordinal integer := 0; expected integer;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_value) NOT BETWEEN 1 AND 4 THEN RETURN false; END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(p_value) AS entry(value) LOOP
    ordinal := ordinal + 1;
    IF jsonb_typeof(element)<>'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(element) k)
       IS DISTINCT FROM ARRAY['afterVersion','beforeVersion','commandOrdinal','confidenceEvaluationId','confidenceStatus','evidenceId','evidenceRole','expectedVersion','hypothesisId','updateId'] THEN RETURN false; END IF;
    IF jsonb_typeof(element->'commandOrdinal')<>'number'
       OR (element->>'commandOrdinal') <> ordinal::text THEN RETURN false; END IF;
    FOREACH identity IN ARRAY ARRAY[element->>'updateId', element->>'confidenceEvaluationId'] LOOP
      IF identity IS NULL OR identity !~* uuid_pattern THEN RETURN false; END IF;
      IF lower(identity) = ANY(seen) THEN RETURN false; END IF;
      seen := array_append(seen, lower(identity));
    END LOOP;
    IF jsonb_typeof(element->'updateId')<>'string' OR jsonb_typeof(element->'confidenceEvaluationId')<>'string' THEN RETURN false; END IF;
    IF jsonb_typeof(element->'hypothesisId')<>'string' OR (element->>'hypothesisId') !~* uuid_pattern THEN RETURN false; END IF;
    IF jsonb_typeof(element->'expectedVersion')<>'number'
       OR (element->>'expectedVersion') !~ '^[1-9][0-9]{0,9}$'
       OR (element->'expectedVersion')::numeric > 2147483647 THEN RETURN false; END IF;
    expected := (element->>'expectedVersion')::integer;
    IF jsonb_typeof(element->'beforeVersion')<>'number' OR (element->>'beforeVersion') <> expected::text THEN RETURN false; END IF;
    IF jsonb_typeof(element->'afterVersion')<>'number' OR (element->>'afterVersion') <> (expected+1)::text THEN RETURN false; END IF;
    IF jsonb_typeof(element->'evidenceId')<>'string' OR (element->>'evidenceId') !~* evidence_pattern THEN RETURN false; END IF;
    IF jsonb_typeof(element->'evidenceRole')<>'string'
       OR (element->>'evidenceRole') NOT IN ('SUPPORTING','CONTRADICTING') THEN RETURN false; END IF;
    IF jsonb_typeof(element->'confidenceStatus')<>'string'
       OR (element->>'confidenceStatus') NOT IN ('EVALUATED','PENDING_RETRY') THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;$$;

ALTER FUNCTION public.post_response_hypothesis_update_batch_result_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_hypothesis_update_batch_result_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 4. Result domain. Every existing claimed/memory/intent/association/
--    candidate/persistence check is untouched; the untyped check widens so the
--    managed effect may carry a result, and the managed effect states its own
--    domain: a (transaction-internal) claimed row with all result fields null,
--    a payload-free UPDATES_REJECTED, or UPDATES_APPLIED with a schema-valid
--    receipt payload. There is no third result code and no reference-bearing
--    batch result, and no legacy completed rows exist for this new key.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check,
  ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE','HYPOTHESIS_UPDATE_BATCH')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  ),
  ADD CONSTRAINT post_response_intelligence_effects_update_batch_result_check CHECK (
    effect_key<>'HYPOTHESIS_UPDATE_BATCH'
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='UPDATES_REJECTED' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='UPDATES_APPLIED' AND result_reference IS NULL
        AND result_payload IS NOT NULL AND public.post_response_hypothesis_update_batch_result_valid_v1(result_payload))
  );

-- 5. The ordinary claim path can no longer touch the managed effect: a CLAIMED
--    managed row outside the one-transaction execute command would be an
--    unrecoverable crash state. Every other effect key keeps the exact 0022
--    claim semantics.
CREATE OR REPLACE FUNCTION public.claim_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='HYPOTHESIS_UPDATE_BATCH' THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_MANAGED' USING ERRCODE='22023';END IF;
 INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state)SELECT p_execution_id,p_effect_key,'CLAIMED' FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' ON CONFLICT DO NOTHING;
 RETURN FOUND;
END;$$;

-- 6. Generic completion likewise rejects the managed effect. Every existing
--    typed-effect error contract is preserved verbatim; CONFIDENCE_BATCH
--    remains the only generic result-less completion.
CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='ASSOCIATION_PROVIDER' THEN RAISE EXCEPTION 'ASSOCIATION_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='CANDIDATE_PROVIDER' THEN RAISE EXCEPTION 'CANDIDATE_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='HYPOTHESIS_PERSISTENCE' THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='HYPOTHESIS_UPDATE_BATCH' THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

-- 7. The ONE managed A2.3c command. See the header comment for the full
--    contract. Ordering inside: structural input validation first (an invalid
--    input mutates nothing), then the RUNNING execution lock, the
--    already-executed guard, the durable Association command authority, the
--    durable same-execution Evidence provenance, the internal claim, the
--    deterministic session-bound target pre-lock, the all-or-nothing mutation
--    sub-block through the canonical A2.3b boundary, the per-mutation
--    exact-version Confidence sub-blocks, and the atomic UPDATES_APPLIED
--    completion. Returns true ONLY when UPDATES_APPLIED was durably written by
--    this call; a durable UPDATES_REJECTED returns false after committing, and
--    benign no-op cases (missing/terminal execution, batch already present)
--    return false without writing anything.
CREATE FUNCTION public.execute_post_response_hypothesis_update_batch_v1(p_execution_id uuid,p_invocation_ids jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 execution_row public.post_response_intelligence_executions;
 association_effect public.post_response_intelligence_effects;
 memory_reference text;
 command_count integer; bound_count integer := 0;
 command jsonb; invocation jsonb; locked_id uuid;
 mutation_update jsonb; mutation_hypothesis jsonb;
 confidence_row public.confidence_evaluations;
 confidence_status text;
 receipts jsonb := '[]'::jsonb;
 ordinal integer := 0; item integer;
 rejected boolean := false;
BEGIN
 IF NOT public.post_response_hypothesis_update_invocation_ids_valid_v1(p_invocation_ids) THEN
  RAISE EXCEPTION 'INVALID_HYPOTHESIS_UPDATE_INVOCATION_IDS' USING ERRCODE='22023';END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.post_response_intelligence_effects WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH') THEN RETURN false;END IF;
 -- The exact durable A2.3a result is the ONLY command authority.
 SELECT * INTO association_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='ASSOCIATION_PROVIDER' AND state='COMPLETED';
 IF NOT FOUND OR association_effect.result_code IS DISTINCT FROM 'AUTHORIZED_COMMANDS'
    OR association_effect.result_reference IS NOT NULL
    OR association_effect.result_payload IS NULL
    OR NOT public.post_response_association_commands_valid_v1(association_effect.result_payload)
 THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_COMMANDS_UNAVAILABLE' USING ERRCODE='42501';END IF;
 command_count := jsonb_array_length(association_effect.result_payload);
 IF jsonb_array_length(p_invocation_ids) <> command_count THEN
  RAISE EXCEPTION 'INVALID_HYPOTHESIS_UPDATE_INVOCATION_IDS' USING ERRCODE='22023';END IF;
 -- Defense in depth: the commands must still be bound to THIS execution's
 -- durable fresh Evidence. No later Memory state is consulted.
 SELECT result_reference INTO memory_reference FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='MEMORY_WRITE' AND state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED';
 IF NOT FOUND OR memory_reference IS NULL THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_EVIDENCE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(association_effect.result_payload) AS entry(value) WHERE entry.value->>'evidenceId' IS DISTINCT FROM memory_reference)
 THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_EVIDENCE_MISMATCH' USING ERRCODE='42501';END IF;
 -- Internal claim: it lives and dies with this transaction, so no CLAIMED
 -- managed row can ever be observed by a redelivery.
 INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state) VALUES(p_execution_id,'HYPOTHESIS_UPDATE_BATCH','CLAIMED');
 -- Deterministic pre-lock: every target, bound to the execution owner and the
 -- exact conversation-session scope, locked in id order. A missing binding is
 -- a deterministic canonical rejection, not an error.
 FOR locked_id IN
   SELECT h.id FROM public.hypotheses h
    WHERE h.user_id=execution_row.user_id
      AND h.scope='CONVERSATION_SESSION:'||execution_row.session_id::text
      AND h.id IN (SELECT (entry.value->>'hypothesisId')::uuid FROM jsonb_array_elements(association_effect.result_payload) AS entry(value))
    ORDER BY h.id ASC
    FOR UPDATE
 LOOP
  bound_count := bound_count + 1;
 END LOOP;
 IF bound_count <> command_count THEN
  rejected := true;
 ELSE
  -- All-or-nothing mutation phase: one inner subtransaction around the whole
  -- batch. Any expected canonical rejection (stale version 40001, ineligible
  -- or already-attached Evidence 22023, a target that vanished from the bound
  -- scope) rolls back EVERY mutation and audit row of this batch. Anything
  -- unexpected propagates and aborts the entire managed transaction.
  BEGIN
   FOR command, invocation IN
     SELECT c.value, i.value
       FROM jsonb_array_elements(association_effect.result_payload) WITH ORDINALITY AS c(value,ord)
       JOIN jsonb_array_elements(p_invocation_ids) WITH ORDINALITY AS i(value,ord2) ON c.ord=i.ord2
      ORDER BY c.ord
   LOOP
    ordinal := ordinal + 1;
    mutation_update := NULL; mutation_hypothesis := NULL;
    SELECT m."update", m.hypothesis INTO mutation_update, mutation_hypothesis
      FROM public.background_apply_hypothesis_evidence_update_v1(
        execution_row.user_id,
        execution_row.session_id,
        (invocation->>'updateId')::uuid,
        (command->>'hypothesisId')::uuid,
        (command->>'expectedVersion')::integer,
        command->>'evidenceId',
        command->>'evidenceRole') m;
    IF mutation_update IS NULL OR mutation_hypothesis IS NULL THEN
     RAISE EXCEPTION 'HYPOTHESIS_UPDATE_TARGET_UNBOUND' USING ERRCODE='22023';END IF;
    -- The returned tuple must be exactly the canonical mutation this command
    -- asked for; anything else is an internal invariant failure that aborts
    -- the whole managed transaction (never a durable rejection).
    IF mutation_update->>'id' IS DISTINCT FROM invocation->>'updateId'
     OR mutation_update->>'user_id' IS DISTINCT FROM execution_row.user_id::text
     OR mutation_hypothesis->>'user_id' IS DISTINCT FROM execution_row.user_id::text
     OR mutation_update->>'hypothesis_id' IS DISTINCT FROM command->>'hypothesisId'
     OR mutation_hypothesis->>'id' IS DISTINCT FROM command->>'hypothesisId'
     OR mutation_update->>'evidence_id' IS DISTINCT FROM command->>'evidenceId'
     OR mutation_update->>'evidence_role' IS DISTINCT FROM command->>'evidenceRole'
     OR (mutation_update->>'before_version')::integer IS DISTINCT FROM (command->>'expectedVersion')::integer
     OR (mutation_update->>'after_version')::integer IS DISTINCT FROM (command->>'expectedVersion')::integer + 1
     OR (mutation_hypothesis->>'version')::integer IS DISTINCT FROM (mutation_update->>'after_version')::integer
     OR mutation_update->>'source' IS DISTINCT FROM 'QANDEEL_HYPOTHESIS_UPDATE_LOOP'
    THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
    receipts := receipts || jsonb_build_object(
      'commandOrdinal',ordinal,
      'updateId',invocation->>'updateId',
      'confidenceEvaluationId',invocation->>'confidenceEvaluationId',
      'hypothesisId',command->>'hypothesisId',
      'expectedVersion',(command->>'expectedVersion')::integer,
      'evidenceId',command->>'evidenceId',
      'evidenceRole',command->>'evidenceRole',
      'beforeVersion',(mutation_update->>'before_version')::integer,
      'afterVersion',(mutation_update->>'after_version')::integer,
      'confidenceStatus','PENDING_RETRY');
   END LOOP;
  EXCEPTION
   WHEN SQLSTATE '40001' OR SQLSTATE '22023' THEN
    rejected := true;
  END;
 END IF;
 IF rejected THEN
  -- Deterministic canonical rejection: zero mutation from this batch
  -- committed, and the typed rejection is durable. No exception text, no
  -- stack trace, no provider data.
  UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='UPDATES_REJECTED'
   WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
  RETURN false;
 END IF;
 -- Exact-version Confidence phase: one isolated sub-block per mutation. The
 -- target version is EXACTLY the mutation's after_version - never a
 -- latest-version re-read, never a substitution (Finding 09). A failed attempt
 -- rolls back only that evaluation and becomes a durable PENDING_RETRY
 -- receipt; the mutation batch is never rolled back by Confidence.
 FOR item IN 1..command_count LOOP
  BEGIN
   confidence_row := NULL;
   SELECT * INTO confidence_row FROM public.background_create_confidence_evaluation_v1(
     execution_row.user_id,
     ((p_invocation_ids->(item-1))->>'confidenceEvaluationId')::uuid,
     ((receipts->(item-1))->>'hypothesisId')::uuid,
     ((receipts->(item-1))->>'afterVersion')::integer);
   IF confidence_row.id IS NULL
    OR confidence_row.id::text IS DISTINCT FROM (p_invocation_ids->(item-1))->>'confidenceEvaluationId'
    OR confidence_row.user_id IS DISTINCT FROM execution_row.user_id
    OR confidence_row.target_id::text IS DISTINCT FROM (receipts->(item-1))->>'hypothesisId'
    OR confidence_row.target_type IS DISTINCT FROM 'HYPOTHESIS'
    OR confidence_row.target_version IS DISTINCT FROM ((receipts->(item-1))->>'afterVersion')::integer
    OR confidence_row.provenance IS DISTINCT FROM 'QANDEEL_CONFIDENCE_RUNTIME'
   THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_CONFIDENCE_INTEGRITY' USING ERRCODE='22023';END IF;
   confidence_status := 'EVALUATED';
  EXCEPTION WHEN OTHERS THEN
   confidence_status := 'PENDING_RETRY';
  END;
  IF confidence_status='EVALUATED' THEN
   receipts := jsonb_set(receipts, ARRAY[(item-1)::text,'confidenceStatus'], '"EVALUATED"'::jsonb);
  END IF;
 END LOOP;
 -- Atomic durable completion: mutations, audits, Confidence rows, durable
 -- PENDING_RETRY statuses and the typed receipt commit together.
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='UPDATES_APPLIED',result_payload=receipts
  WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
 RETURN true;
END;$$;

ALTER FUNCTION public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb) TO service_role;

COMMIT;
