-- QAN-AUD-06 - Confidence Batch Reliability v1.
--
-- Before this migration CONFIDENCE_BATCH was the last generic, result-less
-- effect: the dispatcher claimed it, looped the accepted Hypothesis IDs
-- swallowing every per-target failure, then completed the effect generically
-- and terminalized the execution COMPLETED. Five failure classes follow:
--   1. one failed target evaluation still produces a durable COMPLETED batch
--      and a terminal COMPLETED execution - false durable success;
--   2. a crash after some targets committed leaves a CLAIMED batch the global
--      fail-closed rule can only quarantine, with no way to resume the rest;
--   3. a crash after every evaluation but before generic completion leaves no
--      durable proof the batch was fully evaluated;
--   4. no durable record of the exact target versions exists, so a retry could
--      silently evaluate a later Hypothesis version;
--   5. confidence_evaluations is an immutable history table with no batch
--      identity, so an ambiguous response cannot be answered from history and a
--      fresh random evaluation UUID could duplicate a committed evaluation.
--
-- This forward-only migration closes those defects with the bounded child work
-- table the audit finding requires - NOT a second orchestration ledger, no new
-- queue, no scheduler, no dynamic per-target effect key:
--   * public.post_response_confidence_batch_items holds the 0..5 durable item
--     plan owned by the single CONFIDENCE_BATCH effect: the exact target
--     Hypothesis ID, the exact target version frozen at first initialization,
--     one stable database-generated Confidence evaluation UUID per target, and
--     bounded per-target retry/quarantine state;
--   * CONFIDENCE_BATCH becomes a MANAGED typed effect exactly like the A2.3c
--     batch: the ordinary claim path and the generic result-less completion
--     both fail closed, so no CLAIMED CONFIDENCE_BATCH row can ever be produced
--     by the new path and the only durable states it writes are terminal typed
--     COMPLETED results;
--   * ONE service-role command owns the batch. The application supplies only
--     the execution identity: the database derives the owner from the
--     execution, the exact target list from the durable HYPOTHESIS_PERSISTENCE
--     result (migration 0033), the target versions from the canonical
--     Hypothesis rows at first initialization, and the evaluation identities
--     itself, then evaluates only unfinished items through the canonical
--     background_create_confidence_evaluation_v1 boundary (migration
--     0021/0028) and completes the effect ONLY when every target has a valid
--     result.
--
-- There is deliberately no PARTIAL / FAILED completed result: the batch is
-- complete only when every frozen target has a valid Confidence evaluation.
-- Unfinished work stays in the child items while the execution stays RUNNING,
-- and the existing Redis reclaim/redelivery path retries it under the existing
-- attempt_count / MAX_ATTEMPTS policy. A target whose version advanced before
-- retry is quarantined with a bounded TARGET_VERSION_DRIFT code - a later
-- version is NEVER substituted and no historical snapshot is reconstructed.
-- No raw exception text, stack trace, provider payload, Memory content or
-- transcript content is ever persisted. Pre-0035 rows are never rewritten or
-- backfilled: a legacy all-null completed CONFIDENCE_BATCH row stays valid and
-- is classified INDETERMINATE at runtime, and a legacy CLAIMED row keeps the
-- existing global fail-closed behaviour.

BEGIN;

-- 1. The bounded child work table owned by the CONFIDENCE_BATCH effect. It is
--    internal state, not an orchestration ledger: it carries no event, no
--    stage, no attempt counter and no content - only the exact target plan and
--    a bounded state/failure vocabulary. Primary key (execution_id, ordinal)
--    plus the 1..5 ordinal bound caps the plan at five items; the per-execution
--    Hypothesis uniqueness stops a duplicated target; the globally unique
--    confidence_evaluation_id makes each item's evaluation identity stable and
--    unambiguous. failure_code is NULL exactly for PENDING and EVALUATED, so a
--    retry or quarantine always carries its bounded reason and a success never
--    carries a stale one.
CREATE TABLE public.post_response_confidence_batch_items(
 execution_id uuid NOT NULL REFERENCES public.post_response_intelligence_executions(id) ON DELETE RESTRICT,
 ordinal smallint NOT NULL CHECK(ordinal BETWEEN 1 AND 5),
 hypothesis_id uuid NOT NULL,
 target_version integer NOT NULL CHECK(target_version>0),
 confidence_evaluation_id uuid NOT NULL UNIQUE,
 state text NOT NULL CHECK(state IN('PENDING','RETRY_PENDING','EVALUATED','QUARANTINED')),
 failure_code text CHECK(failure_code IS NULL OR failure_code IN('CONFIDENCE_ATTEMPT_FAILED','TARGET_UNAVAILABLE','TARGET_VERSION_DRIFT','EVALUATION_ID_CONFLICT','RESULT_INTEGRITY_FAILURE')),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(execution_id,ordinal),
 UNIQUE(execution_id,hypothesis_id),
 CHECK((state IN('PENDING','EVALUATED'))=(failure_code IS NULL))
);
ALTER TABLE public.post_response_confidence_batch_items OWNER TO postgres;
ALTER TABLE public.post_response_confidence_batch_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.post_response_confidence_batch_items FROM PUBLIC,anon,authenticated,service_role;

-- 2. Canonical Confidence-batch receipt validator: 1..5 exact four-key objects
--    in 1-based sequential order, canonical unique Hypothesis and evaluation
--    UUIDs with no reuse across the two identity sets, and positive int32
--    target versions. Shape and bounds only - it reads no table, because
--    current Hypothesis state is world state and re-deciding a past result
--    against it would let a later change rewrite a durable receipt. It is
--    deliberately not STRICT: a NULL payload must be a hard false, never a NULL
--    a CHECK would treat as satisfied.
CREATE FUNCTION public.post_response_confidence_batch_result_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  element jsonb; seen text[] := '{}'; identity text; ordinal integer := 0;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_value) NOT BETWEEN 1 AND 5 THEN RETURN false; END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(p_value) AS entry(value) LOOP
    ordinal := ordinal + 1;
    IF jsonb_typeof(element)<>'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(element) k)
       IS DISTINCT FROM ARRAY['confidenceEvaluationId','hypothesisId','ordinal','targetVersion'] THEN RETURN false; END IF;
    IF jsonb_typeof(element->'ordinal')<>'number'
       OR (element->>'ordinal') <> ordinal::text THEN RETURN false; END IF;
    FOREACH identity IN ARRAY ARRAY[element->>'hypothesisId', element->>'confidenceEvaluationId'] LOOP
      IF identity IS NULL OR identity !~* uuid_pattern THEN RETURN false; END IF;
      IF lower(identity) = ANY(seen) THEN RETURN false; END IF;
      seen := array_append(seen, lower(identity));
    END LOOP;
    IF jsonb_typeof(element->'hypothesisId')<>'string' OR jsonb_typeof(element->'confidenceEvaluationId')<>'string' THEN RETURN false; END IF;
    IF jsonb_typeof(element->'targetVersion')<>'number'
       OR (element->>'targetVersion') !~ '^[1-9][0-9]{0,9}$'
       OR (element->'targetVersion')::numeric > 2147483647 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;$$;

ALTER FUNCTION public.post_response_confidence_batch_result_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_confidence_batch_result_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 3. Result domain. Every existing claimed/memory/intent/association/candidate/
--    persistence/update-batch check is untouched; the untyped check widens for
--    the last time so the managed Confidence effect may carry a result, and the
--    Confidence effect states its own domain: a legacy pre-0035 all-null row (a
--    completed generic row or a claimed row) stays representable and is NEVER
--    rewritten, a payload-free NO_CONFIDENCE_TARGETS, or a
--    CONFIDENCE_BATCH_EVALUATED with a schema-valid ordered receipt. There is
--    no third result code, no partial/failed completed result and no
--    reference-bearing Confidence result.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check,
  ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE','HYPOTHESIS_UPDATE_BATCH','CONFIDENCE_BATCH')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  ),
  ADD CONSTRAINT post_response_intelligence_effects_confidence_batch_result_check CHECK (
    effect_key<>'CONFIDENCE_BATCH'
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='NO_CONFIDENCE_TARGETS' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='CONFIDENCE_BATCH_EVALUATED' AND result_reference IS NULL
        AND result_payload IS NOT NULL AND public.post_response_confidence_batch_result_valid_v1(result_payload))
  );

-- 4. The ordinary claim path can no longer touch the Confidence batch: a
--    CLAIMED Confidence row outside the managed command is exactly the
--    unrecoverable crash state QAN-AUD-06 exists to remove. Every other effect
--    key keeps the exact 0022/0034 claim semantics.
CREATE OR REPLACE FUNCTION public.claim_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='HYPOTHESIS_UPDATE_BATCH' THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_MANAGED' USING ERRCODE='22023';END IF;
 IF p_effect_key='CONFIDENCE_BATCH' THEN RAISE EXCEPTION 'CONFIDENCE_BATCH_MANAGED' USING ERRCODE='22023';END IF;
 INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state)SELECT p_execution_id,p_effect_key,'CLAIMED' FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' ON CONFLICT DO NOTHING;
 RETURN FOUND;
END;$$;

-- 5. Generic result-less completion now rejects every effect key: each one
--    carries a typed durable result written by its own dedicated command.
--    Every existing error contract is preserved verbatim. The UPDATE below is
--    retained unchanged so no historical behaviour is silently rewritten, but
--    it is unreachable for the canonical registry.
CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='ASSOCIATION_PROVIDER' THEN RAISE EXCEPTION 'ASSOCIATION_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='CANDIDATE_PROVIDER' THEN RAISE EXCEPTION 'CANDIDATE_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='HYPOTHESIS_PERSISTENCE' THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='HYPOTHESIS_UPDATE_BATCH' THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='CONFIDENCE_BATCH' THEN RAISE EXCEPTION 'CONFIDENCE_BATCH_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

-- 6. The ONE managed Confidence-batch command. The application supplies ONLY
--    the execution identity: no user, no session, no target list, no target
--    version, no Evidence, no Confidence payload, no access token and no user
--    JWT. Returns a small typed status:
--      COMPLETED     - the typed Confidence effect is durably complete;
--      RETRY_PENDING - at least one item still needs retry, no batch effect
--                      exists, and the execution stays RUNNING;
--      QUARANTINED   - irrecoverable item/work mismatch; the dispatcher must
--                      quarantine the execution;
--      NO_OP         - a race / missing / terminal condition that requires a
--                      durable reread before deciding.
--    Ordering inside: the RUNNING execution lock (owner authority), the
--    already-complete guard (the first durable result is immutable), the
--    durable HYPOTHESIS_PERSISTENCE authority, one-time plan initialization or
--    a strict cross-check of the existing plan, the per-item evaluation phase,
--    and the all-items-evaluated typed completion. Every phase writes inside
--    the one transaction, so the final item transitions and the durable
--    completion commit together.
CREATE FUNCTION public.execute_post_response_confidence_batch_v1(p_execution_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 execution_row public.post_response_intelligence_executions;
 confidence_effect public.post_response_intelligence_effects;
 persistence_effect public.post_response_intelligence_effects;
 item public.post_response_confidence_batch_items;
 confidence_row public.confidence_evaluations;
 planned_total integer; target_total integer; locked_total integer := 0; locked_id uuid;
 current_version integer; attempt_state text; attempt_failure text;
 retry_total integer; blocked_total integer; receipts jsonb;
BEGIN
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'NO_OP';END IF;
 -- The first durable Confidence result is immutable and is never overwritten.
 -- A legacy pre-0035 generic COMPLETED row (all result fields null) or a legacy
 -- CLAIMED row is indeterminate: nothing is inferred about which targets
 -- succeeded and nothing is rewritten.
 SELECT * INTO confidence_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='CONFIDENCE_BATCH' FOR UPDATE;
 IF FOUND THEN
  IF confidence_effect.state='COMPLETED' AND confidence_effect.result_reference IS NULL
     AND confidence_effect.result_code IN ('NO_CONFIDENCE_TARGETS','CONFIDENCE_BATCH_EVALUATED')
  THEN RETURN 'COMPLETED';END IF;
  RETURN 'QUARANTINED';
 END IF;
 -- The exact durable generation output (migration 0033) is the ONLY target
 -- authority. Nothing is ever inferred from current Hypothesis rows.
 SELECT * INTO persistence_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_PERSISTENCE' AND state='COMPLETED';
 IF NOT FOUND OR persistence_effect.result_reference IS NOT NULL THEN
  RAISE EXCEPTION 'CONFIDENCE_PERSISTENCE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT count(*) INTO planned_total FROM public.post_response_confidence_batch_items WHERE execution_id=p_execution_id;
 IF planned_total=0 THEN
  -- Zero durable targets: the typed no-target result is written atomically and
  -- no item row is required.
  IF persistence_effect.result_code='NO_HYPOTHESES_PERSISTED' THEN
   IF persistence_effect.result_payload IS NOT NULL THEN RAISE EXCEPTION 'CONFIDENCE_PERSISTENCE_UNAVAILABLE' USING ERRCODE='42501';END IF;
   INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code)
    VALUES(p_execution_id,'CONFIDENCE_BATCH','COMPLETED',CURRENT_TIMESTAMP,'NO_CONFIDENCE_TARGETS');
   RETURN 'COMPLETED';
  END IF;
  IF persistence_effect.result_code IS DISTINCT FROM 'HYPOTHESES_PERSISTED'
     OR persistence_effect.result_payload IS NULL
     OR NOT public.post_response_persisted_hypothesis_ids_valid_v1(persistence_effect.result_payload)
  THEN RAISE EXCEPTION 'CONFIDENCE_PERSISTENCE_UNAVAILABLE' USING ERRCODE='42501';END IF;
  target_total := jsonb_array_length(persistence_effect.result_payload);
  -- Deterministic UUID-order pre-lock of every durable target, bound to the
  -- execution owner. A missing or foreign target is irrecoverable: no plan is
  -- written and nothing is fabricated.
  FOR locked_id IN
    SELECT h.id FROM public.hypotheses h
     WHERE h.user_id=execution_row.user_id
       AND h.id IN (SELECT (entry.value#>>'{}')::uuid FROM jsonb_array_elements(persistence_effect.result_payload) AS entry(value))
     ORDER BY h.id ASC
     FOR UPDATE
  LOOP
   locked_total := locked_total + 1;
  END LOOP;
  IF locked_total<>target_total THEN RETURN 'QUARANTINED';END IF;
  -- The exact target version is frozen HERE, once, from the canonical
  -- post-persistence Hypothesis row, together with one stable database-side
  -- evaluation identity per target. No later attempt regenerates either.
  INSERT INTO public.post_response_confidence_batch_items(execution_id,ordinal,hypothesis_id,target_version,confidence_evaluation_id,state)
  SELECT p_execution_id,entry.ordinality::smallint,generated.id,generated.version,pg_catalog.gen_random_uuid(),'PENDING'
    FROM jsonb_array_elements(persistence_effect.result_payload) WITH ORDINALITY AS entry(value,ordinality)
    JOIN public.hypotheses generated ON generated.id=(entry.value#>>'{}')::uuid AND generated.user_id=execution_row.user_id;
  GET DIAGNOSTICS planned_total = ROW_COUNT;
  IF planned_total<>target_total THEN RAISE EXCEPTION 'CONFIDENCE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
 ELSE
  -- An existing plan is never regenerated: target IDs, ordinals, frozen
  -- versions and evaluation identities are immutable. It must still describe
  -- exactly the durable persistence list, in the same order.
  IF persistence_effect.result_code IS DISTINCT FROM 'HYPOTHESES_PERSISTED'
     OR persistence_effect.result_payload IS NULL
     OR NOT public.post_response_persisted_hypothesis_ids_valid_v1(persistence_effect.result_payload)
     OR jsonb_array_length(persistence_effect.result_payload)<>planned_total
  THEN RETURN 'QUARANTINED';END IF;
  IF (SELECT max(ordinal) FROM public.post_response_confidence_batch_items WHERE execution_id=p_execution_id)<>planned_total
  THEN RETURN 'QUARANTINED';END IF;
  IF EXISTS(
    SELECT 1 FROM public.post_response_confidence_batch_items plan_item
     WHERE plan_item.execution_id=p_execution_id
       AND plan_item.hypothesis_id IS DISTINCT FROM ((persistence_effect.result_payload->(plan_item.ordinal-1))#>>'{}')::uuid)
  THEN RETURN 'QUARANTINED';END IF;
 END IF;
 -- Evaluate ONLY unfinished items. An EVALUATED item is never re-evaluated, so
 -- a retry can never duplicate an immutable Confidence row.
 FOR item IN
   SELECT * FROM public.post_response_confidence_batch_items
    WHERE execution_id=p_execution_id AND state<>'EVALUATED' ORDER BY ordinal FOR UPDATE
 LOOP
  attempt_state := NULL; attempt_failure := NULL; current_version := NULL;
  SELECT h.version INTO current_version FROM public.hypotheses h
    WHERE h.id=item.hypothesis_id AND h.user_id=execution_row.user_id FOR UPDATE;
  IF NOT FOUND THEN
   attempt_state := 'QUARANTINED'; attempt_failure := 'TARGET_UNAVAILABLE';
  ELSIF current_version IS DISTINCT FROM item.target_version THEN
   -- Fail closed: the later version is NEVER evaluated on behalf of the frozen
   -- target, and no historical snapshot is reconstructed.
   attempt_state := 'QUARANTINED'; attempt_failure := 'TARGET_VERSION_DRIFT';
  ELSE
   -- One isolated sub-block per target: a single failure can never roll back
   -- another target's committed evaluation. Only the canonical Confidence
   -- creation boundary writes the row - Evidence eligibility, snapshot
   -- construction, policy version, assumptions, competitors, missing-
   -- information codes and provenance all stay where they already live.
   BEGIN
    confidence_row := NULL;
    SELECT * INTO confidence_row FROM public.background_create_confidence_evaluation_v1(
      execution_row.user_id, item.confidence_evaluation_id, item.hypothesis_id, item.target_version);
    IF confidence_row.id IS NULL
     OR confidence_row.id IS DISTINCT FROM item.confidence_evaluation_id
     OR confidence_row.user_id IS DISTINCT FROM execution_row.user_id
     OR confidence_row.target_id IS DISTINCT FROM item.hypothesis_id
     OR confidence_row.target_type IS DISTINCT FROM 'HYPOTHESIS'
     OR confidence_row.target_version IS DISTINCT FROM item.target_version
     OR confidence_row.provenance IS DISTINCT FROM 'QANDEEL_CONFIDENCE_RUNTIME'
    THEN RAISE EXCEPTION 'CONFIDENCE_BATCH_RESULT_INTEGRITY' USING ERRCODE='XX000';END IF;
    attempt_state := 'EVALUATED';
   EXCEPTION
    WHEN unique_violation THEN
     -- The durable evaluation identity is already taken by a row this batch did
     -- not write: it can never be mistaken for this item's success.
     attempt_state := 'QUARANTINED'; attempt_failure := 'EVALUATION_ID_CONFLICT';
    WHEN SQLSTATE 'XX000' THEN
     attempt_state := 'QUARANTINED'; attempt_failure := 'RESULT_INTEGRITY_FAILURE';
    WHEN OTHERS THEN
     -- Expected retryable failure. No exception text, stack trace or provider
     -- payload is ever persisted.
     attempt_state := 'RETRY_PENDING'; attempt_failure := 'CONFIDENCE_ATTEMPT_FAILED';
   END;
  END IF;
  UPDATE public.post_response_confidence_batch_items
     SET state=attempt_state,failure_code=attempt_failure,updated_at=CURRENT_TIMESTAMP
   WHERE execution_id=p_execution_id AND ordinal=item.ordinal;
 END LOOP;
 SELECT count(*) FILTER (WHERE state='RETRY_PENDING'), count(*) FILTER (WHERE state IN('QUARANTINED','PENDING'))
   INTO retry_total, blocked_total
   FROM public.post_response_confidence_batch_items WHERE execution_id=p_execution_id;
 -- No PARTIAL / PENDING_RETRY / FAILED completed effect exists: unfinished work
 -- stays in the child items and the execution stays RUNNING for the existing
 -- Redis reclaim path.
 IF blocked_total>0 THEN RETURN 'QUARANTINED';END IF;
 IF retry_total>0 THEN RETURN 'RETRY_PENDING';END IF;
 SELECT jsonb_agg(jsonb_build_object(
          'ordinal',plan_item.ordinal,
          'hypothesisId',plan_item.hypothesis_id,
          'targetVersion',plan_item.target_version,
          'confidenceEvaluationId',plan_item.confidence_evaluation_id) ORDER BY plan_item.ordinal)
   INTO receipts FROM public.post_response_confidence_batch_items plan_item WHERE plan_item.execution_id=p_execution_id;
 IF receipts IS NULL OR NOT public.post_response_confidence_batch_result_valid_v1(receipts) THEN
  RAISE EXCEPTION 'CONFIDENCE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
 INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload)
  VALUES(p_execution_id,'CONFIDENCE_BATCH','COMPLETED',CURRENT_TIMESTAMP,'CONFIDENCE_BATCH_EVALUATED',receipts);
 RETURN 'COMPLETED';
END;$$;

ALTER FUNCTION public.execute_post_response_confidence_batch_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.execute_post_response_confidence_batch_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_post_response_confidence_batch_v1(uuid) TO service_role;

COMMIT;
