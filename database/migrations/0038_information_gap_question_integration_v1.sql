-- Information Gap / Question Integration v1.
--
-- Canonical durable Confidence outputs already exist (the A2.3c
-- HYPOTHESIS_UPDATE_BATCH exact-version receipts and the QAN-AUD-06
-- CONFIDENCE_BATCH_EVALUATED receipts), but the live post-response runtime
-- never materialized their safe structural missing-information state into the
-- frozen Question / Information Gap Runtime (migration 0007). This forward-only
-- migration closes exactly that boundary and nothing else:
--   * ONE shared internal Information Gap creation core with an explicit
--     trusted owner - the EXACT migration-0007 creation semantics with
--     auth.uid() removed - so no second SQL semantic implementation exists;
--   * the authenticated create_information_gap(jsonb) becomes a narrow
--     behavior-preserving wrapper over that core: same signature, same
--     auth.uid()-only ownership, same validation, same errors, same result
--     shape, same grants;
--   * ONE narrow internal automatic-gap source/traceability table binding each
--     automatically materialized gap to its exact durable Confidence source
--     tuple (user, Hypothesis, exact target version, canonical evaluation,
--     actionable missing-information code) - no Evidence content, no Memory
--     content, no transcript, no provider payload, no hidden reasoning, no
--     diagnosis/personality field;
--   * ONE idempotent service-role-only synchronization command that accepts
--     ONLY the execution identity and derives every source from the execution's
--     durable typed effects. It validates the ENTIRE derived source set before
--     writing anything, materializes at most one automatic gap per exact
--     (user, hypothesis, target_version, missing_information_code) tuple,
--     reuses the same canonical gap on every re-sync and on later executions
--     that encounter the same exact tuple, and fails closed with a bounded
--     QUARANTINED result on any source-integrity violation.
--
-- Deliberately NOT added: no new post-response effect key, no second effect
-- ledger, no Question queue/worker/scheduler, no automatic Question Candidate
-- generation, no ranking/selection/asking lifecycle, no provider or model
-- call, no public/client API, and no background_%_v1 function (the historical
-- six-function census of migration 0021 is unchanged).
--
-- CONFIDENCE_MODEL_UNCALIBRATED is a calibration statement about the model,
-- never a user Information Gap: alone it produces zero gaps, and mixed with
-- actionable structural codes it is filtered out. An unknown future
-- missing-information code fails closed instead of being silently ignored.

BEGIN;

-- 1. The shared internal Information Gap creation core. EXACT migration-0007
--    creation semantics with one change only: the owner is an explicit trusted
--    parameter and auth.uid() is never called. No JWT or request-claim
--    reconstruction exists. It is internal-only: EXECUTE is revoked from
--    PUBLIC, anon, authenticated AND service_role; only the owner/definer
--    chain (the authenticated wrapper and the synchronization command below)
--    can reach it.
CREATE FUNCTION public.create_information_gap_core_v1(p_user_id uuid, p_gap jsonb) RETURNS SETOF public.information_gaps LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hypothesis_id uuid; confidence public.confidence_evaluations; result public.information_gaps;
BEGIN
 IF p_user_id IS NULL THEN RETURN; END IF;
 IF cardinality(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gap->'related_hypothesis_ids','[]'::jsonb))))>16 THEN RAISE EXCEPTION 'Too many hypotheses' USING ERRCODE='22023'; END IF;
 FOREACH hypothesis_id IN ARRAY ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gap->'related_hypothesis_ids','[]'::jsonb))::uuid) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.hypotheses WHERE id=hypothesis_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Invalid hypothesis target' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF nullif(p_gap->>'confidence_evaluation_id','') IS NOT NULL THEN
  SELECT * INTO confidence FROM public.confidence_evaluations WHERE id=(p_gap->>'confidence_evaluation_id')::uuid AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid confidence target' USING ERRCODE='42501'; END IF;
  IF confidence.target_type='HYPOTHESIS' AND NOT confidence.target_id=ANY(ARRAY(SELECT jsonb_array_elements_text(p_gap->'related_hypothesis_ids')::uuid)) THEN RAISE EXCEPTION 'Inconsistent confidence target' USING ERRCODE='22023'; END IF;
  IF confidence.missing_information_codes=ARRAY['CONFIDENCE_MODEL_UNCALIBRATED']::text[] THEN RAISE EXCEPTION 'Calibration is not a user gap' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.information_gaps(id,user_id,information_needed,why_it_matters,related_hypothesis_ids,confidence_evaluation_id,user_answerability,preferred_question_type)
 VALUES((p_gap->>'id')::uuid,p_user_id,p_gap->>'information_needed',p_gap->>'why_it_matters',ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gap->'related_hypothesis_ids','[]'::jsonb))::uuid),nullif(p_gap->>'confidence_evaluation_id','')::uuid,coalesce(p_gap->>'user_answerability','UNASSESSED'),nullif(p_gap->>'preferred_question_type','')) RETURNING * INTO result;
 INSERT INTO public.information_gap_hypotheses(gap_id,hypothesis_id,user_id) SELECT result.id,id,p_user_id FROM unnest(result.related_hypothesis_ids) id;
 RETURN NEXT result;
END $$;
ALTER FUNCTION public.create_information_gap_core_v1(uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_information_gap_core_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 2. The authenticated wrapper. Exact migration-0007 signature, result shape
--    and observable behavior: owner derived ONLY from auth.uid(), a missing
--    authentication still returns zero rows, and every validation/error
--    contract lives in the shared core so the two authorities can never drift.
--    CREATE OR REPLACE preserves the existing ACL (authenticated-only EXECUTE;
--    PUBLIC and anon revoked by migration 0007).
CREATE OR REPLACE FUNCTION public.create_information_gap(p_gap jsonb) RETURNS SETOF public.information_gaps LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical_user uuid := (SELECT auth.uid());
BEGIN
 IF canonical_user IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT * FROM public.create_information_gap_core_v1(canonical_user,p_gap);
END $$;

-- 3. The narrow internal automatic-gap source/traceability table. One row per
--    automatic gap; one automatic gap per exact source tuple. Every FK is an
--    exact-owner composite FK, only the three actionable structural codes are
--    representable, and the table carries durable identities and a timestamp
--    only - no text, no payload, no content of any kind. It is internal: RLS
--    is enabled and NO application role (anon, authenticated, service_role)
--    holds any privilege on it; the only writer is the synchronization command
--    below and only tests may inspect it as postgres.
CREATE TABLE public.information_gap_confidence_sources(
 information_gap_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 hypothesis_id uuid NOT NULL,
 target_version integer NOT NULL CHECK(target_version>0),
 confidence_evaluation_id uuid NOT NULL,
 missing_information_code text NOT NULL CHECK(missing_information_code IN('NO_ELIGIBLE_EVIDENCE','UNVERIFIED_ASSUMPTIONS','COMPETING_HYPOTHESES_UNASSESSED')),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,hypothesis_id,target_version,missing_information_code),
 CONSTRAINT information_gap_source_single_gap_binding UNIQUE(information_gap_id),
 CONSTRAINT information_gap_source_gap_owner_fk FOREIGN KEY(information_gap_id,user_id) REFERENCES public.information_gaps(id,user_id) ON DELETE RESTRICT,
 CONSTRAINT information_gap_source_hypothesis_owner_fk FOREIGN KEY(hypothesis_id,user_id) REFERENCES public.hypotheses(id,user_id) ON DELETE RESTRICT,
 CONSTRAINT information_gap_source_confidence_owner_fk FOREIGN KEY(confidence_evaluation_id,user_id) REFERENCES public.confidence_evaluations(id,user_id) ON DELETE RESTRICT
);
ALTER TABLE public.information_gap_confidence_sources OWNER TO postgres;
ALTER TABLE public.information_gap_confidence_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.information_gap_confidence_sources FROM PUBLIC,anon,authenticated,service_role;

-- 4. The ONE idempotent service-role-only post-response Information Gap
--    synchronization command. The application supplies ONLY the execution
--    identity: no user, no Hypothesis, no version, no Confidence identity, no
--    missing-information code, no gap text, no token and no JWT. It derives
--    source Confidence exclusively from the SAME execution's durable typed
--    effects:
--      Source A - a COMPLETED HYPOTHESIS_UPDATE_BATCH / UPDATES_APPLIED:
--                 receipts with confidenceStatus=EVALUATED only, in durable
--                 commandOrdinal order, each contributing the exact
--                 (confidenceEvaluationId, hypothesisId, afterVersion). A
--                 PENDING_RETRY receipt has no successful exact evaluation and
--                 contributes nothing.
--      Source B - a COMPLETED CONFIDENCE_BATCH / CONFIDENCE_BATCH_EVALUATED:
--                 the exact ordered receipts (confidenceEvaluationId,
--                 hypothesisId, targetVersion). NO_CONFIDENCE_TARGETS
--                 contributes nothing.
--    It never scans latest Confidence, never substitutes a later Hypothesis
--    version for the exact durable target version, and never accepts
--    caller-supplied Confidence identities. The ENTIRE derived source set is
--    validated against the canonical confidence_evaluations rows BEFORE any
--    write: any missing, foreign, mismatched, non-canonical or structurally
--    inconsistent source - a rejected/legacy/indeterminate durable batch and
--    an unknown future missing-information code included - returns the bounded
--    {status:'QUARANTINED', reason:'SOURCE_INTEGRITY_FAILURE'} with ZERO new
--    gap/source rows in that invocation.
--
--    Materialization is deterministic and bounded: durable Update receipts in
--    commandOrdinal order, then generation receipts in ordinal order, each
--    evaluation's stored missing_information_codes array order preserved,
--    CONFIDENCE_MODEL_UNCALIBRATED filtered out, exact source tuples
--    deduplicated by first canonical occurrence, and the current-contract
--    maximum of 27 tuples (4 update + 5 generation receipts x 3 actionable
--    codes) enforced fail-closed. Cross-execution races on the same exact
--    tuple are serialized by transaction-scoped advisory locks keyed from the
--    tuple and acquired in globally sorted key order (deadlock-free), with the
--    primary-key uniqueness as the database backstop: exactly one canonical
--    gap/source pair survives and every synchronization resolves to that same
--    gap identity. Repeated synchronization of identical durable sources
--    returns the same canonical gap identities in the same order.
CREATE FUNCTION public.sync_post_response_information_gaps_v1(p_execution_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 quarantined constant jsonb := jsonb_build_object('status','QUARANTINED','reason','SOURCE_INTEGRITY_FAILURE');
 execution_row public.post_response_intelligence_executions;
 update_effect public.post_response_intelligence_effects;
 confidence_effect public.post_response_intelligence_effects;
 evaluation public.confidence_evaluations;
 receipt jsonb; source jsonb; tuple jsonb; code text; tuple_key text;
 sources jsonb := '[]'::jsonb;
 tuples jsonb := '[]'::jsonb;
 seen_tuple_keys text[] := '{}';
 lock_keys bigint[] := '{}'; sorted_lock_keys bigint[]; lock_key bigint;
 gap_id uuid; new_gap_id uuid; created public.information_gaps;
 gaps jsonb := '[]'::jsonb; ordinal integer := 0; index integer;
 gap_information_needed text; gap_why_it_matters text;
BEGIN
 -- Execution authority: only a live post-response execution's durable typed
 -- effects may be consumed. The row lock serializes re-syncs of the same
 -- execution; a missing or terminal execution fails closed.
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN quarantined; END IF;
 -- Source A: the durable automatic Hypothesis Update batch. Anything other
 -- than a schema-valid COMPLETED UPDATES_APPLIED result (UPDATES_REJECTED, a
 -- legacy null result, an impossible CLAIMED row, a malformed payload) is an
 -- untrusted batch and fails closed: no gap is ever created from it.
 SELECT * INTO update_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH';
 IF FOUND THEN
  IF update_effect.state IS DISTINCT FROM 'COMPLETED'
     OR update_effect.result_code IS DISTINCT FROM 'UPDATES_APPLIED'
     OR update_effect.result_reference IS NOT NULL
     OR update_effect.result_payload IS NULL
     OR NOT public.post_response_hypothesis_update_batch_result_valid_v1(update_effect.result_payload)
  THEN RETURN quarantined; END IF;
  FOR receipt IN SELECT entry.value FROM jsonb_array_elements(update_effect.result_payload) AS entry(value) LOOP
   IF receipt->>'confidenceStatus'='EVALUATED' THEN
    sources := sources || jsonb_build_object(
      'evaluationId',receipt->>'confidenceEvaluationId',
      'hypothesisId',receipt->>'hypothesisId',
      'targetVersion',(receipt->>'afterVersion')::integer);
   END IF;
  END LOOP;
 END IF;
 -- Source B: the durable managed generation Confidence batch. A payload-free
 -- NO_CONFIDENCE_TARGETS contributes nothing; a legacy pre-0035 all-null
 -- completed row, an impossible CLAIMED row or a malformed payload fails
 -- closed.
 SELECT * INTO confidence_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='CONFIDENCE_BATCH';
 IF FOUND THEN
  IF confidence_effect.state IS DISTINCT FROM 'COMPLETED' OR confidence_effect.result_reference IS NOT NULL THEN RETURN quarantined; END IF;
  IF confidence_effect.result_code='NO_CONFIDENCE_TARGETS' THEN
   IF confidence_effect.result_payload IS NOT NULL THEN RETURN quarantined; END IF;
  ELSIF confidence_effect.result_code='CONFIDENCE_BATCH_EVALUATED' THEN
   IF confidence_effect.result_payload IS NULL
      OR NOT public.post_response_confidence_batch_result_valid_v1(confidence_effect.result_payload)
   THEN RETURN quarantined; END IF;
   FOR receipt IN SELECT entry.value FROM jsonb_array_elements(confidence_effect.result_payload) AS entry(value) LOOP
    sources := sources || jsonb_build_object(
      'evaluationId',receipt->>'confidenceEvaluationId',
      'hypothesisId',receipt->>'hypothesisId',
      'targetVersion',(receipt->>'targetVersion')::integer);
   END LOOP;
  ELSE RETURN quarantined; END IF;
 END IF;
 -- Validate the ENTIRE derived source set first, materialize second. Every
 -- durable receipt must resolve to the exact canonical Confidence evaluation:
 -- execution owner, HYPOTHESIS target, exact target Hypothesis, exact durable
 -- target version (a later Hypothesis version is NEVER substituted), canonical
 -- lifecycle/provenance/policy, and the intentionally null score/band. The
 -- owned Hypothesis row must still exist for the exact-owner FK. An unknown
 -- future missing-information code fails closed; the calibration-only code is
 -- filtered, never materialized.
 FOR index IN 0..jsonb_array_length(sources)-1 LOOP
  source := sources->index;
  SELECT * INTO evaluation FROM public.confidence_evaluations WHERE id=(source->>'evaluationId')::uuid;
  IF NOT FOUND
     OR evaluation.user_id IS DISTINCT FROM execution_row.user_id
     OR evaluation.target_type IS DISTINCT FROM 'HYPOTHESIS'
     OR evaluation.target_id IS DISTINCT FROM (source->>'hypothesisId')::uuid
     OR evaluation.target_version IS DISTINCT FROM (source->>'targetVersion')::integer
     OR evaluation.lifecycle_state IS DISTINCT FROM 'EVALUATED'
     OR evaluation.provenance IS DISTINCT FROM 'QANDEEL_CONFIDENCE_RUNTIME'
     OR evaluation.policy_version IS DISTINCT FROM 'confidence-foundation-v1'
     OR evaluation.numeric_score IS NOT NULL
     OR evaluation.confidence_band IS NOT NULL
  THEN RETURN quarantined; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hypotheses WHERE id=evaluation.target_id AND user_id=execution_row.user_id) THEN RETURN quarantined; END IF;
  FOREACH code IN ARRAY evaluation.missing_information_codes LOOP
   IF code NOT IN ('NO_ELIGIBLE_EVIDENCE','UNVERIFIED_ASSUMPTIONS','COMPETING_HYPOTHESES_UNASSESSED','CONFIDENCE_MODEL_UNCALIBRATED') THEN RETURN quarantined; END IF;
  END LOOP;
  FOREACH code IN ARRAY evaluation.missing_information_codes LOOP
   CONTINUE WHEN code='CONFIDENCE_MODEL_UNCALIBRATED';
   tuple_key := lower(evaluation.target_id::text)||':'||evaluation.target_version::text||':'||code;
   CONTINUE WHEN tuple_key=ANY(seen_tuple_keys);
   seen_tuple_keys := array_append(seen_tuple_keys,tuple_key);
   tuples := tuples || jsonb_build_object(
     'hypothesisId',evaluation.target_id,
     'targetVersion',evaluation.target_version,
     'code',code,
     'evaluationId',evaluation.id);
  END LOOP;
 END LOOP;
 -- The bounded result set implied by the current contracts: 4 update receipts
 -- + 5 generation receipts, at most 3 actionable codes each. If upstream
 -- bounds ever widen inconsistently, fail closed instead of silently widening.
 IF jsonb_array_length(tuples)>27 THEN RETURN quarantined; END IF;
 -- Cross-execution race safety: acquire one transaction-scoped advisory lock
 -- per exact source tuple, in globally sorted key order so two executions
 -- overlapping on the same tuples can never deadlock. No read-then-insert race
 -- exists: the lock serializes the check-create pair, and the primary key is
 -- the database backstop.
 FOR index IN 0..jsonb_array_length(tuples)-1 LOOP
  tuple := tuples->index;
  lock_keys := array_append(lock_keys, pg_catalog.hashtextextended(
    'qandeel_information_gap_source:'||execution_row.user_id::text||':'||lower(tuple->>'hypothesisId')||':'||(tuple->>'targetVersion')||':'||(tuple->>'code'), 0));
 END LOOP;
 SELECT coalesce(array_agg(DISTINCT key ORDER BY key),'{}'::bigint[]) INTO sorted_lock_keys FROM unnest(lock_keys) AS key;
 FOREACH lock_key IN ARRAY sorted_lock_keys LOOP
  PERFORM pg_catalog.pg_advisory_xact_lock(lock_key);
 END LOOP;
 -- Deterministic materialization in canonical source order. An existing exact
 -- source tuple reuses its canonical automatic gap; a new tuple creates the
 -- gap through the ONE shared core with the fixed controlled text, exact
 -- single-Hypothesis linkage, exact canonical Confidence linkage, UNASSESSED
 -- answerability and a null preferred Question type, then binds it durably to
 -- its source tuple.
 FOR index IN 0..jsonb_array_length(tuples)-1 LOOP
  tuple := tuples->index;
  ordinal := ordinal + 1;
  SELECT information_gap_id INTO gap_id FROM public.information_gap_confidence_sources
   WHERE user_id=execution_row.user_id
     AND hypothesis_id=(tuple->>'hypothesisId')::uuid
     AND target_version=(tuple->>'targetVersion')::integer
     AND missing_information_code=tuple->>'code';
  IF NOT FOUND THEN
   gap_information_needed := CASE tuple->>'code'
     WHEN 'NO_ELIGIBLE_EVIDENCE' THEN 'Eligible evidence for the current Hypothesis version is missing.'
     WHEN 'UNVERIFIED_ASSUMPTIONS' THEN 'One or more assumptions in the current Hypothesis remain unverified.'
     ELSE 'Competing Hypotheses remain unassessed in the current Confidence snapshot.' END;
   gap_why_it_matters := 'Confidence Runtime reported '||(tuple->>'code')||' for this exact Hypothesis version.';
   new_gap_id := pg_catalog.gen_random_uuid();
   created := NULL;
   SELECT * INTO created FROM public.create_information_gap_core_v1(execution_row.user_id, jsonb_build_object(
     'id',new_gap_id,
     'information_needed',gap_information_needed,
     'why_it_matters',gap_why_it_matters,
     'related_hypothesis_ids',jsonb_build_array(tuple->>'hypothesisId'),
     'confidence_evaluation_id',tuple->>'evaluationId',
     'user_answerability','UNASSESSED'));
   IF created.id IS NULL
      OR created.id IS DISTINCT FROM new_gap_id
      OR created.user_id IS DISTINCT FROM execution_row.user_id
      OR created.related_hypothesis_ids IS DISTINCT FROM ARRAY[(tuple->>'hypothesisId')::uuid]
      OR created.confidence_evaluation_id IS DISTINCT FROM (tuple->>'evaluationId')::uuid
      OR created.user_answerability IS DISTINCT FROM 'UNASSESSED'
      OR created.preferred_question_type IS NOT NULL
      OR created.status IS DISTINCT FROM 'OPEN'
      OR created.version IS DISTINCT FROM 1
      OR created.provenance IS DISTINCT FROM 'QANDEEL_QUESTION_RUNTIME'
   THEN RAISE EXCEPTION 'INFORMATION_GAP_SYNC_INTEGRITY' USING ERRCODE='XX000'; END IF;
   INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code)
    VALUES(created.id,execution_row.user_id,(tuple->>'hypothesisId')::uuid,(tuple->>'targetVersion')::integer,(tuple->>'evaluationId')::uuid,tuple->>'code');
   gap_id := created.id;
  END IF;
  gaps := gaps || jsonb_build_object(
    'ordinal',ordinal,
    'informationGapId',gap_id,
    'hypothesisId',lower(tuple->>'hypothesisId'),
    'targetVersion',(tuple->>'targetVersion')::integer,
    'missingInformationCode',tuple->>'code');
 END LOOP;
 IF ordinal=0 THEN RETURN jsonb_build_object('status','NO_INFORMATION_GAPS','gaps',jsonb_build_array()); END IF;
 RETURN jsonb_build_object('status','INFORMATION_GAPS_AVAILABLE','gaps',gaps);
END;$$;

ALTER FUNCTION public.sync_post_response_information_gaps_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_post_response_information_gaps_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_post_response_information_gaps_v1(uuid) TO service_role;

COMMIT;
