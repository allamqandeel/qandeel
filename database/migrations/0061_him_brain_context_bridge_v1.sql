BEGIN;
-- HIM Background Human Intelligence -> Brain Context Bridge v1 (QHIA-012).
--
-- The phase invariant this migration exists to satisfy:
--
--   Human Intelligence must make QANDEEL smarter WITHOUT making the foreground
--   response slower.
--
-- Every foreground consumption shipped so far (QHIA-007/008/010/011) is bounded
-- to ONE metric per context kind precisely because a wider read would have to be
-- paid for inside the turn. QHIA-012 breaks that trade-off by MOVING the heavy
-- work: eight context-bound canonical current readings are materialized ONCE, in
-- the POST-RESPONSE BACKGROUND path of a completed turn, into one small typed
-- durable result; the NEXT foreground turn may consume that already-computed
-- materialization through ONE optional read, and may NEVER wait for it.
--
-- This migration installs exactly four new callable objects plus one internal
-- payload validator, and widens exactly one existing effect registry:
--
--   1. public.read_him_latest_measurement_core_v1(...)
--      The migration-0052 canonical latest-across-events algorithm, EXTRACTED
--      unchanged into one trusted internal core that takes an already-trusted
--      exact user identity instead of reading auth.uid(). It is reachable by NO
--      request role at all.
--
--   2. public.read_him_latest_measurement_v1(...)  (REPLACED BODY ONLY)
--      The existing authenticated public wrapper keeps its exact signature,
--      exact return shape, exact error contract, exact ACL and exact observable
--      semantics; its body is narrowed to authentication + owner-exactness +
--      delegation to the trusted core. This is a CORE EXTRACTION, not a rewrite:
--      migration 0052's behaviour is frozen and no existing authenticated caller
--      observes any difference.
--
--   3. public.background_read_him_brain_context_source_v1(p_execution_id uuid)
--      ONE narrow execution-bound service-role source read. The caller supplies
--      ONLY the post-response execution ID; the database derives owner, session,
--      source turn, event version, safety disposition and execution state
--      itself, resolves ONLY exact ACTIVE QHIA-006 DECISION/SITUATION/GOAL
--      bindings, and answers all eight frozen Brain slots in ONE request.
--
--   4. public.complete_post_response_him_brain_context_materialization_v1(...)
--      The dedicated MANAGED typed durable completion command. The new
--      HIM_BRAIN_CONTEXT_MATERIALIZATION effect is inserted DIRECTLY as
--      COMPLETED, so no CLAIMED Brain Context row can exist even transiently -
--      the ordinary claim path and the generic result-less completion path both
--      fail closed for it, and the result-domain CHECK below makes an all-null
--      (claimed) Brain row structurally unrepresentable.
--
--   5. public.read_him_brain_context_for_turn_v1(p_user_id,p_session_id,
--      p_current_turn_id)
--      The ONE authenticated foreground read. It selects the IMMEDIATELY
--      PRECEDING canonical USER turn by the existing deterministic session
--      ordering (created_at, id) WITHOUT filtering by status, only THEN requires
--      that turn to be COMPLETED, reads that exact turn's durable typed
--      materialization, and revalidates every materialized signal against the
--      CURRENT QHIA-006 ACTIVE binding. It reads no measurement substrate at
--      all: zero metric rereads, zero currentness work, zero canonical-latest
--      calls.
--
-- What this migration deliberately does NOT do:
--
--   * it invents no second latest/currentness algorithm - the extracted core is
--     the migration-0052 algorithm itself, moved, not reimplemented;
--   * it grants service_role no generic HIM read: the background role gets
--     exactly one execution-bound fixed-registry materialization source and
--     nothing else, and cannot reach the internal core or the authenticated
--     wrapper;
--   * it reconstructs no JWT and calls set_config nowhere;
--   * it infers no relevance: an unbound context kind contributes no candidate
--     row, and no newest/first/only/most-recently-measured target is ever
--     substituted;
--   * it adds no ninth Brain slot, no HRS signal, and none of the four metrics
--     that already have their own dedicated foreground consumption
--     (hse.stress, hse.attention, hse.motivation, hrs.communication);
--   * it derives no freshness, confidence, trend, average, score, ranking or
--     correlation - freshness and confidence stay exactly UNASSESSED;
--   * it changes no existing foreground surface: the QHIA-009/010/011
--     aggregate-v1/v2/v3 transports, the four direct per-channel authorities,
--     the QHIA-004 batch, the QHIA-006 relevance authority, the Intelligence
--     Snapshot, the Trend source and the background CONVERSATION_SESSION
--     snapshot are untouched.

-- 1. Current-phase preconditions: the canonical authorities and substrates this
--    migration extracts from, composes over, and extends must already exist with
--    their exact intended shapes. One-time migration-phase facts only - nothing
--    here freezes a future migration, metric version, context kind, slot, or
--    function.
DO $$BEGIN
 IF to_regprocedure('public.read_him_latest_measurement_v1(uuid,text,integer,text,text)') IS NULL THEN RAISE EXCEPTION 'The canonical latest measurement read authority (migration 0052) is missing';END IF;
 IF to_regprocedure('public.him_active_structured_binding_id(text,integer,text)') IS NULL THEN RAISE EXCEPTION 'The QHIM-001 ACTIVE-binding resolver (migration 0050) is missing';END IF;
 IF to_regprocedure('public.read_him_session_context_bindings_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-006 session context binding relevance authority (migration 0055) is missing';END IF;
 IF to_regclass('public.him_metric_definitions') IS NULL OR to_regclass('public.him_measurement_targets') IS NULL OR to_regclass('public.him_session_context_bindings') IS NULL THEN RAISE EXCEPTION 'The HIM definition, target, or relevance substrate is missing';END IF;
 IF to_regclass('public.post_response_intelligence_executions') IS NULL OR to_regclass('public.post_response_intelligence_effects') IS NULL THEN RAISE EXCEPTION 'The post-response intelligence durable ledger is missing';END IF;
 IF to_regclass('public.conversation_turns') IS NULL THEN RAISE EXCEPTION 'The canonical conversation turn substrate is missing';END IF;
 -- The deterministic session ordering the immediate-previous-turn rule depends
 -- on is an EXISTING index from migration 0001; this migration creates none.
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='conversation_turns' AND indexname='conversation_turns_session_order_idx') THEN RAISE EXCEPTION 'The deterministic (session_id, created_at, id) turn ordering index is missing';END IF;
 -- Every one of the eight frozen Brain slots must already be an approved
 -- context/metric pair in the exact persisted definition authority. QHIA-012
 -- activates no unapproved route and writes no definition.
 IF EXISTS(
  SELECT 1 FROM (VALUES
   ('DECISION','hse.self-confidence'),
   ('SITUATION','hbs.avoidance'),('SITUATION','hgs.self-awareness'),('SITUATION','hgs.resilience'),
   ('GOAL','hbs.consistency'),('GOAL','hbs.initiative'),('GOAL','hgs.purpose-alignment'),('GOAL','hgs.habit-strength')
  ) AS registry(kind,metric)
  WHERE NOT EXISTS(SELECT 1 FROM public.him_metric_definitions d WHERE d.metric_key=registry.metric AND d.definition_version=1 AND registry.kind=ANY(d.valid_context_kinds) AND d.calculation_status='CALIBRATED')
 ) THEN RAISE EXCEPTION 'Every frozen Brain Context slot must be an approved CALIBRATED context/metric pair in the persisted definition authority';END IF;
END$$;

-- 2. The trusted internal canonical latest core.
--
--    This is migration 0052's body, verbatim in every semantic respect, with
--    exactly one change: the caller identity arrives as an ALREADY-TRUSTED
--    parameter instead of being read from auth.uid(). Everything the canonical
--    read authority owns still lives here and only here:
--
--      * exact persisted metric definition identity (no implicit version, no
--        latest-version inference);
--      * definition-listed context-kind eligibility;
--      * owner-exact context ownership across the canonical ownership
--        substrates (conversation_sessions for CONVERSATION_SESSION;
--        him_measurement_targets for SITUATION/DECISION/GOAL/RELATIONSHIP);
--      * newest measurement EVENT by immutable event chronology
--        (created_at DESC, id DESC), chosen BEFORE snapshot availability;
--      * newest unsuperseded correction observation inside that one event;
--      * the QHIM-001 structured-current view as the only value source;
--      * ZERO older-event fallback when the newest event has no usable current
--        calculated snapshot;
--      * no snapshot-version ordering anywhere.
--
--    It is deliberately unreachable by every request role. It is not an API: it
--    is the shared internal implementation of the one canonical read authority,
--    reachable only from the two postgres-owned SECURITY DEFINER callers this
--    migration installs and preserves.
CREATE FUNCTION public.read_him_latest_measurement_core_v1(p_trusted_user_id uuid,p_metric_key text,p_definition_version integer,p_context_kind text,p_context_id text)
RETURNS SETOF public.him_metric_snapshots LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=p_trusted_user_id;valid_kinds text[];owned boolean:=false;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Trusted canonical latest reads require an exact user identity' USING ERRCODE='42501';END IF;
 IF p_metric_key IS NULL OR length(p_metric_key)=0 OR length(p_metric_key)>128 OR p_definition_version IS NULL OR p_definition_version<1 THEN RAISE EXCEPTION 'Invalid exact HIM metric identity' USING ERRCODE='22023';END IF;
 IF p_context_id IS NULL OR length(p_context_id)=0 OR length(p_context_id)>128 THEN RAISE EXCEPTION 'Invalid HIM context identity' USING ERRCODE='22023';END IF;
 SELECT d.valid_context_kinds INTO valid_kinds FROM public.him_metric_definitions d WHERE d.metric_key=p_metric_key AND d.definition_version=p_definition_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown exact HIM metric definition' USING ERRCODE='22023';END IF;
 IF p_context_kind IS NULL OR NOT(p_context_kind=ANY(valid_kinds)) THEN RAISE EXCEPTION 'Unsupported context kind for the exact HIM metric definition' USING ERRCODE='22023';END IF;
 IF p_context_kind='CONVERSATION_SESSION' THEN SELECT EXISTS(SELECT 1 FROM public.conversation_sessions c WHERE c.id::text=p_context_id AND c.user_id=u) INTO owned;
 ELSIF p_context_kind=ANY(ARRAY['SITUATION','DECISION','GOAL','RELATIONSHIP']) THEN SELECT EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id::text=p_context_id AND t.user_id=u AND t.context_kind=p_context_kind) INTO owned;
 ELSE RAISE EXCEPTION 'Unsupported HIM context ownership authority' USING ERRCODE='22023';END IF;
 IF NOT owned THEN RAISE EXCEPTION 'Unknown or unowned HIM measurement context' USING ERRCODE='42501';END IF;
 RETURN QUERY
 WITH latest_event AS(
  SELECT me.id FROM public.him_measurement_events me
  WHERE me.user_id=u AND me.context_kind=p_context_kind AND me.context_id=p_context_id
   AND EXISTS(SELECT 1 FROM public.him_measurement_observations eo WHERE eo.measurement_event_id=me.id AND eo.user_id=u AND eo.metric_key=p_metric_key AND eo.definition_version=p_definition_version)
  ORDER BY me.created_at DESC,me.id DESC LIMIT 1),
 latest_observation AS(
  SELECT mo.id,mo.measurement_event_id FROM public.him_measurement_observations mo JOIN latest_event le ON mo.measurement_event_id=le.id
  WHERE mo.user_id=u AND mo.metric_key=p_metric_key AND mo.definition_version=p_definition_version
   AND NOT EXISTS(SELECT 1 FROM public.him_measurement_observations newer WHERE newer.supersedes_observation_id=mo.id)
  ORDER BY mo.created_at DESC,mo.id DESC LIMIT 1)
 SELECT cs.* FROM public.him_current_structured_measurements cs
 JOIN latest_observation lo ON cs.measurement_observation_id=lo.id
 WHERE cs.user_id=u AND cs.metric_key=p_metric_key AND cs.definition_version=p_definition_version AND cs.context_kind=p_context_kind AND cs.context_id=p_context_id AND cs.measurement_event_id=lo.measurement_event_id;
END$$;
ALTER FUNCTION public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text) OWNER TO postgres;
-- No request role may reach the trusted core: not PUBLIC, not anon, not
-- authenticated, and above all not service_role. Trusting the caller-supplied
-- identity is safe ONLY because nothing outside this database's own
-- postgres-owned definers can call it.
REVOKE ALL ON FUNCTION public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;

-- 3. The existing authenticated canonical latest authority, narrowed to
--    authentication + owner-exactness + delegation.
--
--    Signature, return type, volatility, definer posture, search_path, owner,
--    ACL, error messages and error codes are all preserved EXACTLY. A caller
--    cannot tell the difference: the authentication and owner-exactness errors
--    are raised here in the same order as before, and every remaining error -
--    invalid metric identity, invalid context identity, unknown exact
--    definition, unsupported context kind, unsupported ownership authority,
--    unknown or unowned context - now propagates verbatim from the trusted core
--    that owns those rules.
--
--    CREATE OR REPLACE deliberately preserves the existing grants rather than
--    re-issuing them, so the migration cannot accidentally widen the ACL; the
--    postcondition below proves the ACL is still exactly authenticated-only.
CREATE OR REPLACE FUNCTION public.read_him_latest_measurement_v1(p_user_id uuid,p_metric_key text,p_definition_version integer,p_context_kind text,p_context_id text)
RETURNS SETOF public.him_metric_snapshots LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Canonical latest measurement reads are owner-exact' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT core.* FROM public.read_him_latest_measurement_core_v1(u,p_metric_key,p_definition_version,p_context_kind,p_context_id) core;
END$$;

-- 4. The new MANAGED durable effect joins the canonical registry. Every existing
--    effect key keeps its exact semantics and its exact result domain.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_effect_key_check,
  ADD CONSTRAINT post_response_intelligence_effects_effect_key_check
    CHECK(effect_key IN('MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH','HIM_BRAIN_CONTEXT_MATERIALIZATION'));

-- 5. The canonical Brain Context durable payload validator.
--
--    Shape, identity and bounds ONLY. It reads no table, exactly like the
--    QAN-AUD-06 receipt validator: re-deciding a committed durable result
--    against later world state would let a binding change rewrite history. It is
--    deliberately not STRICT, so a NULL payload is a hard false rather than a
--    NULL a CHECK would treat as satisfied.
--
--    The eight frozen slot labels carry the provider-safe semantic identity, and
--    slotOrder is the FIXED registry ordinal: strictly increasing ordinals prove
--    fixed registry order AND the absence of a duplicate slot in one rule. Each
--    slot is pinned to its one frozen context kind, so a GOAL reading can never
--    be persisted under a DECISION slot. Nothing else may appear: the exact key
--    sets below reject any metric key, measurement/observation/snapshot/binding
--    identity, timestamp, temporal window, confidence or freshness reference,
--    transcript, Memory, Hypothesis, provider payload, target label or arbitrary
--    text.
CREATE FUNCTION public.post_response_him_brain_context_result_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  slots constant text[] := ARRAY['DECISION_SELF_CONFIDENCE','SITUATION_AVOIDANCE_FREQUENCY','SITUATION_SELF_AWARENESS','SITUATION_RESILIENCE','GOAL_CONSISTENCY','GOAL_INITIATIVE','GOAL_PURPOSE_ALIGNMENT','GOAL_HABIT_STRENGTH'];
  kinds constant text[] := ARRAY['DECISION','SITUATION','SITUATION','SITUATION','GOAL','GOAL','GOAL','GOAL'];
  signals jsonb; element jsonb; previous integer := 0; ordinal integer;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p_value) k)
     IS DISTINCT FROM ARRAY['contractVersion','signals','source','sourceTurnId'] THEN RETURN false; END IF;
  IF jsonb_typeof(p_value->'contractVersion')<>'number' OR (p_value->>'contractVersion')<>'1' THEN RETURN false; END IF;
  IF jsonb_typeof(p_value->'source')<>'string'
     OR (p_value->>'source')<>'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1' THEN RETURN false; END IF;
  IF jsonb_typeof(p_value->'sourceTurnId')<>'string' OR (p_value->>'sourceTurnId') !~* uuid_pattern THEN RETURN false; END IF;
  signals := p_value->'signals';
  IF jsonb_typeof(signals)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(signals) NOT BETWEEN 1 AND 8 THEN RETURN false; END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(signals) AS entry(value) LOOP
    IF jsonb_typeof(element)<>'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(element) k)
       IS DISTINCT FROM ARRAY['confidenceState','contextId','contextKind','freshnessState','numericValue','semanticMappingStatus','semanticType','slot','slotOrder'] THEN RETURN false; END IF;
    IF jsonb_typeof(element->'slotOrder')<>'number' OR (element->>'slotOrder') !~ '^[1-8]$' THEN RETURN false; END IF;
    ordinal := (element->>'slotOrder')::integer;
    -- Strictly increasing registry ordinals: fixed registry order and no
    -- duplicate slot, proven by one rule.
    IF ordinal<=previous THEN RETURN false; END IF;
    previous := ordinal;
    IF jsonb_typeof(element->'slot')<>'string' OR (element->>'slot')<>slots[ordinal] THEN RETURN false; END IF;
    IF jsonb_typeof(element->'contextKind')<>'string' OR (element->>'contextKind')<>kinds[ordinal] THEN RETURN false; END IF;
    IF jsonb_typeof(element->'contextId')<>'string' OR (element->>'contextId') !~* uuid_pattern THEN RETURN false; END IF;
    -- The existing v1 structured scale contract: a canonical current numeric
    -- value is an integer in [1,5]. Structural bound only - never a semantic
    -- interpretation, normalization, valence, or cross-metric arithmetic.
    IF jsonb_typeof(element->'numericValue')<>'number' OR (element->>'numericValue') !~ '^[1-5]$' THEN RETURN false; END IF;
    IF jsonb_typeof(element->'semanticMappingStatus')<>'string'
       OR (element->>'semanticMappingStatus') NOT IN ('RESOLVED','UNRESOLVED') THEN RETURN false; END IF;
    -- The exact persisted semantic mapping is preserved, never coerced: a
    -- RESOLVED mapping keeps its exact non-empty persisted type and an
    -- UNRESOLVED mapping keeps a JSON null, exactly as the QHIA-004 projection
    -- already requires.
    IF (element->>'semanticMappingStatus')='RESOLVED' THEN
      IF jsonb_typeof(element->'semanticType')<>'string'
         OR length(element->>'semanticType')=0 OR length(element->>'semanticType')>64 THEN RETURN false; END IF;
    ELSIF jsonb_typeof(element->'semanticType')<>'null' THEN RETURN false;
    END IF;
    IF jsonb_typeof(element->'freshnessState')<>'string' OR (element->>'freshnessState')<>'UNASSESSED' THEN RETURN false; END IF;
    IF jsonb_typeof(element->'confidenceState')<>'string' OR (element->>'confidenceState')<>'UNASSESSED' THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;$$;
ALTER FUNCTION public.post_response_him_brain_context_result_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_him_brain_context_result_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 6. Result domain. Every existing typed result check is untouched; the untyped
--    check widens so the new managed effect may carry a result, and the Brain
--    effect states its own domain.
--
--    Note what is DELIBERATELY ABSENT from the Brain branch: there is no
--    all-null alternative. Unlike every effect that predates its own typed
--    result, HIM_BRAIN_CONTEXT_MATERIALIZATION has no legacy rows to preserve,
--    so the absence of that branch makes a CLAIMED (all-null) Brain Context row
--    STRUCTURALLY UNREPRESENTABLE rather than merely unwritten. The stranded
--    CLAIMED state QHIA-012 must not introduce cannot be stored at all.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check,
  ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE','HYPOTHESIS_UPDATE_BATCH','CONFIDENCE_BATCH','HIM_BRAIN_CONTEXT_MATERIALIZATION')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  ),
  ADD CONSTRAINT post_response_intelligence_effects_brain_context_result_check CHECK (
    effect_key<>'HIM_BRAIN_CONTEXT_MATERIALIZATION'
    OR (state='COMPLETED' AND result_code='NO_HIM_BRAIN_CONTEXT' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='HIM_BRAIN_CONTEXT_MATERIALIZED' AND result_reference IS NULL
        AND result_payload IS NOT NULL AND public.post_response_him_brain_context_result_valid_v1(result_payload))
  );

-- 7. The ordinary claim path can no longer touch the Brain Context effect. A
--    CLAIMED Brain row outside the managed command is exactly the unrecoverable
--    crash state this task exists to avoid, and the constraint above already
--    makes it unrepresentable; rejecting it here as well means the application
--    gets a bounded task-specific error instead of a constraint violation. Every
--    other effect key keeps its exact 0022/0034/0035 claim semantics verbatim.
CREATE OR REPLACE FUNCTION public.claim_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='HYPOTHESIS_UPDATE_BATCH' THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_MANAGED' USING ERRCODE='22023';END IF;
 IF p_effect_key='CONFIDENCE_BATCH' THEN RAISE EXCEPTION 'CONFIDENCE_BATCH_MANAGED' USING ERRCODE='22023';END IF;
 IF p_effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_MANAGED' USING ERRCODE='22023';END IF;
 INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state)SELECT p_execution_id,p_effect_key,'CLAIMED' FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' ON CONFLICT DO NOTHING;
 RETURN FOUND;
END;$$;

-- 8. Generic result-less completion keeps rejecting every effect key, and now
--    rejects the Brain Context effect too: a typed result is mandatory. Every
--    existing error contract is preserved verbatim.
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
 IF p_effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

-- 9. The ONE background Brain Context source read.
--
--    The callable surface is narrow ON PURPOSE: the ONLY input is the
--    post-response execution ID. There is no user parameter, no session
--    parameter, no turn parameter, no context kind, no caller-supplied context
--    id, no target, no metric key, no metric list, no definition version, no
--    slot list, and no registry - so the service role cannot aim this function
--    at another user, another context, another metric, or a wider read, because
--    there is no parameter with which to do so. The service role gets NO generic
--    cross-context HIM read authority anywhere in this migration: it gets this
--    execution-bound fixed-registry materialization source and nothing else.
--
--    Authority is fail-closed and entirely database-derived: the execution must
--    exist and be RUNNING, must be the canonical v2 completed-turn event, must
--    carry safety disposition ALLOW, and its source turn must be the exact owned
--    canonical COMPLETED USER turn of that exact session.
--
--    Relevance is EXACT and never inferred. Only ACTIVE QHIA-006 bindings of the
--    three frozen kinds are resolved, straight from the canonical relevance
--    substrate under the same user/session/kind identity the authenticated
--    QHIA-006 authority uses and under its own one-ACTIVE-per-kind partial
--    unique index. No relevance SEMANTICS are created here: there is no newest,
--    first, only, most-recently-measured, highest, or lowest target fallback, no
--    RETIRED binding, no RELATIONSHIP kind, no target text read, no label match,
--    and no inference from conversation content. An unbound kind simply
--    contributes no candidate row.
--
--    Currentness is NOT owned here: every per-slot current value is delegated to
--    the trusted canonical latest core, every ACTIVE measurement-binding
--    identity to the existing migration-0050 resolver, and every definition
--    metadata field to the exact persisted definition row. The function is
--    STABLE, uses no dynamic SQL, reconstructs no JWT, and writes nothing.
--
--    It answers all eight frozen slots in ONE request: there is no per-slot
--    network fan-out anywhere on this path.
CREATE FUNCTION public.background_read_him_brain_context_source_v1(p_execution_id uuid)
RETURNS TABLE(
 brain_slot_order integer,
 brain_slot text,
 slot_order integer,
 metric_key text,
 definition_version integer,
 hif_owner text,
 semantic_mapping_status text,
 semantic_type text,
 calculation_status text,
 valid_context_kinds text[],
 context_kind text,
 context_id text,
 has_canonical_current_value boolean,
 source_metric_key text,
 source_definition_version integer,
 source_semantic_mapping_status text,
 source_semantic_type text,
 source_context_kind text,
 source_context_id text,
 value_state text,
 numeric_value double precision,
 validity_status text,
 confidence_state text,
 confidence_reference text,
 observed_at timestamptz,
 temporal_window_start timestamptz,
 temporal_window_end timestamptz,
 canonical_binding_id uuid,
 active_binding_id uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE execution_row public.post_response_intelligence_executions;
BEGIN
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions e WHERE e.id=p_execution_id AND e.state='RUNNING';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or non-running post-response intelligence execution' USING ERRCODE='42501';END IF;
 IF execution_row.event_version<>'2.0' OR execution_row.safety_disposition IS DISTINCT FROM 'ALLOW' THEN RAISE EXCEPTION 'Brain Context materialization requires a canonical v2 ALLOW execution' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.conversation_turns t
  WHERE t.id=execution_row.source_turn_id AND t.session_id=execution_row.session_id AND t.user_id=execution_row.user_id
   AND t.role='USER' AND t.status='COMPLETED'
 ) THEN RAISE EXCEPTION 'Unknown or non-canonical Brain Context source turn' USING ERRCODE='42501';END IF;
 RETURN QUERY
 WITH registry(brain_order,brain_label,brain_kind,brain_metric) AS(
  VALUES
   (1,'DECISION_SELF_CONFIDENCE'::text,'DECISION'::text,'hse.self-confidence'::text),
   (2,'SITUATION_AVOIDANCE_FREQUENCY','SITUATION','hbs.avoidance'),
   (3,'SITUATION_SELF_AWARENESS','SITUATION','hgs.self-awareness'),
   (4,'SITUATION_RESILIENCE','SITUATION','hgs.resilience'),
   (5,'GOAL_CONSISTENCY','GOAL','hbs.consistency'),
   (6,'GOAL_INITIATIVE','GOAL','hbs.initiative'),
   (7,'GOAL_PURPOSE_ALIGNMENT','GOAL','hgs.purpose-alignment'),
   (8,'GOAL_HABIT_STRENGTH','GOAL','hgs.habit-strength')),
 bound AS(
  SELECT b.context_kind AS bound_kind,b.context_id AS bound_id
  FROM public.him_session_context_bindings b
  WHERE b.user_id=execution_row.user_id
   AND b.conversation_session_id=execution_row.session_id
   AND b.status='ACTIVE'
   AND b.context_kind=ANY(ARRAY['DECISION','SITUATION','GOAL']))
 SELECT r.brain_order,r.brain_label,
  r.brain_order,r.brain_metric,1,
  d.hif_owner,d.semantic_mapping_status,d.semantic_type,d.calculation_status,d.valid_context_kinds,
  r.brain_kind,bound.bound_id::text,
  (c.id IS NOT NULL),
  c.metric_key,c.definition_version,c.semantic_mapping_status,c.semantic_type,c.context_kind,c.context_id,
  c.value_state,c.numeric_value,c.validity_status,c.confidence_state,c.confidence_reference,
  c.observed_at,c.temporal_window_start,c.temporal_window_end,c.canonical_binding_id,
  public.him_active_structured_binding_id(r.brain_metric,1,r.brain_kind)
 FROM registry r
 JOIN bound ON bound.bound_kind=r.brain_kind
 JOIN public.him_metric_definitions d ON d.metric_key=r.brain_metric AND d.definition_version=1
 LEFT JOIN LATERAL public.read_him_latest_measurement_core_v1(execution_row.user_id,r.brain_metric,1,r.brain_kind,bound.bound_id::text) c ON true
 ORDER BY r.brain_order;
END$$;
ALTER FUNCTION public.background_read_him_brain_context_source_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.background_read_him_brain_context_source_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.background_read_him_brain_context_source_v1(uuid) TO service_role;

-- 10. The ONE managed Brain Context materialization completion command.
--
--     This is NOT the generic completion path and NOT a claim-then-work pair:
--     the typed effect is inserted DIRECTLY as COMPLETED inside one transaction,
--     so no externally visible CLAIMED Brain Context state exists at any instant
--     and a crash between "source read" and "completion" simply leaves no effect
--     row at all - a perfectly recoverable state the next redelivery redoes.
--
--     The application supplies ONLY the execution identity and the typed result:
--     never a user, session, turn, target, metric, binding, access token or user
--     JWT. The database derives the owner and the source turn from the execution
--     and re-verifies every context in the payload against them.
--
--     Returned status vocabulary:
--       COMPLETED         - this call durably wrote the typed result;
--       ALREADY_COMPLETED - a valid first durable result already exists and was
--                           NOT overwritten (the first result is immutable);
--       QUARANTINED       - an existing Brain effect row is not a valid typed
--                           COMPLETED result (unreachable under the CHECK above,
--                           kept as defence in depth);
--       NO_OP             - the execution is missing or no longer RUNNING; the
--                           caller must reread durable state before deciding.
CREATE FUNCTION public.complete_post_response_him_brain_context_materialization_v1(p_execution_id uuid,p_result_code text,p_result_payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 execution_row public.post_response_intelligence_executions;
 brain_effect public.post_response_intelligence_effects;
 signal_total integer;
 owned_total integer;
BEGIN
 -- Typed result domain first: an invalid code or an impossible code/payload
 -- pairing is a hard rejection, never a durable row.
 IF p_result_code IS NULL OR p_result_code<>ALL(ARRAY['NO_HIM_BRAIN_CONTEXT','HIM_BRAIN_CONTEXT_MATERIALIZED']) THEN RAISE EXCEPTION 'INVALID_HIM_BRAIN_CONTEXT_RESULT' USING ERRCODE='22023';END IF;
 IF p_result_code='NO_HIM_BRAIN_CONTEXT' AND p_result_payload IS NOT NULL THEN RAISE EXCEPTION 'INVALID_HIM_BRAIN_CONTEXT_RESULT' USING ERRCODE='22023';END IF;
 IF p_result_code='HIM_BRAIN_CONTEXT_MATERIALIZED' AND NOT public.post_response_him_brain_context_result_valid_v1(p_result_payload) THEN RAISE EXCEPTION 'INVALID_HIM_BRAIN_CONTEXT_RESULT' USING ERRCODE='22023';END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions e WHERE e.id=p_execution_id AND e.state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'NO_OP';END IF;
 IF execution_row.event_version<>'2.0' OR execution_row.safety_disposition IS DISTINCT FROM 'ALLOW' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_EXECUTION_NOT_ELIGIBLE' USING ERRCODE='42501';END IF;
 IF p_result_code='HIM_BRAIN_CONTEXT_MATERIALIZED' THEN
  -- The durable result belongs to EXACTLY this execution's source turn.
  IF (p_result_payload->>'sourceTurnId')::uuid IS DISTINCT FROM execution_row.source_turn_id THEN RAISE EXCEPTION 'INVALID_HIM_BRAIN_CONTEXT_SOURCE_TURN' USING ERRCODE='22023';END IF;
  -- Every signal context must be an exact target OWNED by the execution owner
  -- and of exactly the frozen kind the slot pins. A foreign or wrong-kind
  -- context can never become a durable Brain signal.
  signal_total:=jsonb_array_length(p_result_payload->'signals');
  SELECT count(*) INTO owned_total
   FROM jsonb_array_elements(p_result_payload->'signals') AS entry(value)
   JOIN public.him_measurement_targets t
     ON t.id=(entry.value->>'contextId')::uuid
    AND t.user_id=execution_row.user_id
    AND t.context_kind=(entry.value->>'contextKind');
  IF owned_total IS DISTINCT FROM signal_total THEN RAISE EXCEPTION 'INVALID_HIM_BRAIN_CONTEXT_CONTEXT' USING ERRCODE='42501';END IF;
 END IF;
 -- The first durable Brain Context result is IMMUTABLE and is never overwritten.
 SELECT * INTO brain_effect FROM public.post_response_intelligence_effects f
  WHERE f.execution_id=p_execution_id AND f.effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' FOR UPDATE;
 IF FOUND THEN
  IF brain_effect.state='COMPLETED' AND brain_effect.result_reference IS NULL
     AND brain_effect.result_code IN('NO_HIM_BRAIN_CONTEXT','HIM_BRAIN_CONTEXT_MATERIALIZED')
  THEN RETURN 'ALREADY_COMPLETED';END IF;
  RETURN 'QUARANTINED';
 END IF;
 INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload)
  VALUES(p_execution_id,'HIM_BRAIN_CONTEXT_MATERIALIZATION','COMPLETED',CURRENT_TIMESTAMP,p_result_code,p_result_payload);
 RETURN 'COMPLETED';
END;$$;
ALTER FUNCTION public.complete_post_response_him_brain_context_materialization_v1(uuid,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_post_response_him_brain_context_materialization_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_post_response_him_brain_context_materialization_v1(uuid,text,jsonb) TO service_role;

-- 11. The ONE authenticated foreground Brain Context read.
--
--     Selection, durable-result recovery and relevance revalidation all happen
--     inside THIS ONE function, so the foreground performs exactly ONE optional
--     external request per eligible turn: no per-slot read, no separate binding
--     request, no metric reread, no canonical-latest call, no QHIA-004 batch
--     call, no background table write.
--
--     THE IMMEDIATE-PREVIOUS-TURN RULE. The predecessor is selected by the
--     existing deterministic session ordering (created_at, id) with NO status
--     filter, and only AFTER selection is it required to be COMPLETED. That
--     ordering matters: filtering by status while choosing would silently SKIP a
--     FAILED, CANCELLED or SUPERSEDED user turn and reach back to an older
--     completed one, presenting intelligence from before an intervening turn as
--     if it described the conversation's immediate past. There is no older
--     fallback anywhere on this path.
--
--     RELEVANCE REVALIDATION WITHOUT A METRIC REREAD. Every materialized signal
--     survives only if its context kind still has an ACTIVE binding AND the
--     current bound context_id is EXACTLY the materialized contextId. A replaced
--     binding drops the old signal, a cleared binding drops it, and an unrelated
--     kind that is still bound survives independently. Equality is exact
--     identity: no fuzzy match, no same-label match, no latest-target match. The
--     current binding set comes from the QHIA-006 authority itself, which stays
--     the only relevance authority - this function reconstructs no binding query
--     and touches no relevance substrate directly.
--
--     A malformed durable result is an integrity failure, never a guess and
--     never a repair.
CREATE FUNCTION public.read_him_brain_context_for_turn_v1(p_user_id uuid,p_session_id uuid,p_current_turn_id uuid)
RETURNS TABLE(
 slot_order integer,
 slot text,
 context_kind text,
 context_id uuid,
 numeric_value integer,
 semantic_mapping_status text,
 semantic_type text,
 freshness_state text,
 confidence_state text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 u uuid:=auth.uid();
 current_turn public.conversation_turns;
 previous_turn public.conversation_turns;
 execution_row public.post_response_intelligence_executions;
 brain_effect public.post_response_intelligence_effects;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Brain Context reads are owner-exact' USING ERRCODE='42501';END IF;
 -- The exact owned USER turn of the exact owned session. An assistant turn, an
 -- unknown turn, a cross-user turn, and a turn from another session all fail
 -- closed with one sanitized error that never discloses whether another user's
 -- turn exists.
 SELECT * INTO current_turn FROM public.conversation_turns t
  WHERE t.id=p_current_turn_id AND t.session_id=p_session_id AND t.user_id=u AND t.role='USER';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or cross-user current conversation turn' USING ERRCODE='42501';END IF;
 IF current_turn.status<>'GENERATING' THEN RAISE EXCEPTION 'The current conversation turn is not in the foreground generating state' USING ERRCODE='55000';END IF;
 -- Step 1: the immediate predecessor, chosen WITHOUT any status predicate.
 SELECT * INTO previous_turn FROM public.conversation_turns t
  WHERE t.session_id=p_session_id AND t.user_id=u AND t.role='USER'
   AND (t.created_at,t.id)<(current_turn.created_at,current_turn.id)
  ORDER BY t.created_at DESC,t.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN;END IF;
 -- Step 2: only NOW is usability decided. An intervening FAILED, CANCELLED or
 -- SUPERSEDED user turn ends the read; it is never skipped over.
 IF previous_turn.status<>'COMPLETED' THEN RETURN;END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions e
  WHERE e.source_turn_id=previous_turn.id AND e.user_id=u AND e.session_id=p_session_id;
 IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO brain_effect FROM public.post_response_intelligence_effects f
  WHERE f.execution_id=execution_row.id AND f.effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' AND f.state='COMPLETED';
 IF NOT FOUND THEN RETURN;END IF;
 -- An authoritative "there was nothing to materialize" is a normal empty answer.
 IF brain_effect.result_code='NO_HIM_BRAIN_CONTEXT' THEN RETURN;END IF;
 IF brain_effect.result_code IS DISTINCT FROM 'HIM_BRAIN_CONTEXT_MATERIALIZED'
    OR brain_effect.result_reference IS NOT NULL
    OR NOT public.post_response_him_brain_context_result_valid_v1(brain_effect.result_payload)
    OR (brain_effect.result_payload->>'sourceTurnId')::uuid IS DISTINCT FROM previous_turn.id
 THEN RAISE EXCEPTION 'Malformed durable Brain Context materialization' USING ERRCODE='XX000';END IF;
 -- Step 3: revalidate against the CURRENT ACTIVE relevance, through the QHIA-006
 -- authority. An inner join on exact (kind, id) identity IS the revalidation:
 -- a changed or cleared binding simply produces no matching row.
 RETURN QUERY
 SELECT (brain_signal.value->>'slotOrder')::integer,
        brain_signal.value->>'slot',
        brain_signal.value->>'contextKind',
        (brain_signal.value->>'contextId')::uuid,
        (brain_signal.value->>'numericValue')::integer,
        brain_signal.value->>'semanticMappingStatus',
        brain_signal.value->>'semanticType',
        brain_signal.value->>'freshnessState',
        brain_signal.value->>'confidenceState'
 FROM jsonb_array_elements(brain_effect.result_payload->'signals') AS brain_signal(value)
 JOIN public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b
   ON b.context_kind=(brain_signal.value->>'contextKind')
  AND b.context_id=(brain_signal.value->>'contextId')::uuid
 ORDER BY (brain_signal.value->>'slotOrder')::integer;
END$$;
ALTER FUNCTION public.read_him_brain_context_for_turn_v1(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.read_him_brain_context_for_turn_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_brain_context_for_turn_v1(uuid,uuid,uuid) TO authenticated;

-- 12. Migration-phase postcondition on the trusted core and the preserved
--     authenticated wrapper. The core must carry the migration-0052 chronology
--     and structured-current selection VERBATIM, must be reachable by no request
--     role, and must not read auth.uid(); the wrapper must keep its exact safe
--     properties, its exact authenticated-only ACL, its authentication and
--     owner-exactness gates, and must now delegate rather than reimplement.
--     Forbidden identifiers are named here only as data to prove their absence.
DO $$DECLARE core_def text;wrapper_def text;p record;acl record;BEGIN
 SELECT prosecdef,provolatile,proconfig,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid='public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text)'::regprocedure;
 IF NOT FOUND THEN RAISE EXCEPTION 'The trusted canonical latest core is missing';END IF;
 IF NOT p.prosecdef OR p.provolatile<>'s' OR p.owner<>'postgres' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'Trusted canonical latest core properties are unsafe';END IF;
 SELECT has_function_privilege('public','public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text)','EXECUTE') pub,
        has_function_privilege('anon','public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text)','EXECUTE') anon_role,
        has_function_privilege('authenticated','public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text)','EXECUTE') authed,
        has_function_privilege('service_role','public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text)','EXECUTE') service INTO acl;
 IF acl.pub OR acl.anon_role OR acl.authed OR acl.service THEN RAISE EXCEPTION 'The trusted canonical latest core must be reachable by no request role';END IF;
 core_def:=pg_get_functiondef('public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text)'::regprocedure);
 IF position('ORDER BY me.created_at DESC,me.id DESC' in core_def)=0 OR position('ORDER BY mo.created_at DESC,mo.id DESC' in core_def)=0 THEN RAISE EXCEPTION 'The trusted core lost the canonical event/observation chronology';END IF;
 IF position('him_current_structured_measurements' in core_def)=0 THEN RAISE EXCEPTION 'The trusted core must read through the QHIM-001 structured-current view';END IF;
 IF position('valid_context_kinds' in core_def)=0 OR position('him_metric_definitions' in core_def)=0 THEN RAISE EXCEPTION 'The trusted core lost its exact-definition context authority';END IF;
 IF position('supersedes_observation_id' in core_def)=0 THEN RAISE EXCEPTION 'The trusted core lost its unsuperseded-observation selection';END IF;
 IF position('snapshot_version' in core_def)>0 OR position('EXECUTE format' in core_def)>0 OR position('EXECUTE ''' in core_def)>0 THEN RAISE EXCEPTION 'The trusted core contains snapshot-version ordering or dynamic SQL';END IF;
 IF position('auth.uid' in core_def)>0 OR position('request.jwt' in core_def)>0 OR position('set_config' in core_def)>0 THEN RAISE EXCEPTION 'The trusted core must neither read nor reconstruct request identity';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid='public.read_him_latest_measurement_v1(uuid,text,integer,text,text)'::regprocedure;
 IF NOT p.prosecdef OR p.provolatile<>'s' OR p.pronargs<>5 OR p.owner<>'postgres' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The authenticated canonical latest wrapper properties changed';END IF;
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_latest_measurement_v1')<>1 THEN RAISE EXCEPTION 'Exactly one authenticated canonical latest authority may exist';END IF;
 wrapper_def:=pg_get_functiondef('public.read_him_latest_measurement_v1(uuid,text,integer,text,text)'::regprocedure);
 IF position('auth.uid()' in wrapper_def)=0 THEN RAISE EXCEPTION 'The authenticated wrapper must still read auth.uid()';END IF;
 IF position('Authentication required' in wrapper_def)=0 OR position('Canonical latest measurement reads are owner-exact' in wrapper_def)=0 THEN RAISE EXCEPTION 'The authenticated wrapper lost its exact authentication or owner-exactness contract';END IF;
 IF position('public.read_him_latest_measurement_core_v1(' in wrapper_def)=0 THEN RAISE EXCEPTION 'The authenticated wrapper must delegate to the trusted canonical core';END IF;
 IF position('him_measurement_events' in wrapper_def)>0 OR position('him_measurement_observations' in wrapper_def)>0 OR position('him_current_structured_measurements' in wrapper_def)>0 OR position('him_metric_definitions' in wrapper_def)>0 OR position('snapshot_version' in wrapper_def)>0 THEN RAISE EXCEPTION 'The authenticated wrapper must delegate currentness, never reimplement it';END IF;
 IF position('EXECUTE format' in wrapper_def)>0 OR position('EXECUTE ''' in wrapper_def)>0 OR position('request.jwt' in wrapper_def)>0 OR position('set_config' in wrapper_def)>0 THEN RAISE EXCEPTION 'The authenticated wrapper must contain no dynamic SQL and reconstruct no JWT';END IF;
 SELECT has_function_privilege('public','public.read_him_latest_measurement_v1(uuid,text,integer,text,text)','EXECUTE') pub,
        has_function_privilege('anon','public.read_him_latest_measurement_v1(uuid,text,integer,text,text)','EXECUTE') anon_role,
        has_function_privilege('authenticated','public.read_him_latest_measurement_v1(uuid,text,integer,text,text)','EXECUTE') authed,
        has_function_privilege('service_role','public.read_him_latest_measurement_v1(uuid,text,integer,text,text)','EXECUTE') service INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'The authenticated canonical latest ACL changed: it must stay authenticated-only';END IF;
END$$;

-- 13. Migration-phase postcondition on the background Brain Context source: safe
--     properties, postgres ownership, the exact narrow service-role-only ACL, a
--     single execution-ID parameter, required delegation to the trusted core and
--     the existing ACTIVE-binding resolver, the exact eight frozen slots, and the
--     proven absence - from the INSTALLED definition - of every duplicated
--     currentness algorithm, every excluded metric, every excluded context kind,
--     every caller-supplied selector, dynamic SQL, JWT reconstruction and
--     mutation.
DO $$DECLARE fn text:='public.background_read_him_brain_context_source_v1(uuid)';def text;p record;acl record;forbidden text;required text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The background Brain Context source authority is missing';END IF;
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='background_read_him_brain_context_source_v1')<>1 THEN RAISE EXCEPTION 'Exactly one background Brain Context source may exist: no overload may accept a user, context, target, metric, or registry';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF NOT p.prosecdef OR p.provolatile<>'s' OR p.owner<>'postgres' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'Background Brain Context source properties are unsafe';END IF;
 IF p.pronargs<>1 THEN RAISE EXCEPTION 'The background Brain Context source must accept exactly the post-response execution identity';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('authenticated',fn,'EXECUTE') authed,has_function_privilege('service_role',fn,'EXECUTE') service INTO acl;
 IF acl.pub OR acl.anon_role OR acl.authed OR NOT acl.service THEN RAISE EXCEPTION 'The background Brain Context source EXECUTE authority must be service_role-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.read_him_latest_measurement_core_v1(' in def)=0 THEN RAISE EXCEPTION 'The background Brain Context source must delegate every current value to the trusted canonical core';END IF;
 IF position('public.him_active_structured_binding_id(' in def)=0 THEN RAISE EXCEPTION 'The background Brain Context source must resolve binding identity through the existing ACTIVE-binding resolver';END IF;
 IF position('him_metric_definitions' in def)=0 THEN RAISE EXCEPTION 'The background Brain Context source lost its exact persisted definition metadata authority';END IF;
 IF position('''ACTIVE''' in def)=0 THEN RAISE EXCEPTION 'The background Brain Context source must resolve only ACTIVE relevance bindings';END IF;
 -- Exactly the eight frozen slots, each pinned to its one frozen context kind.
 FOREACH required IN ARRAY ARRAY['''DECISION_SELF_CONFIDENCE''','''SITUATION_AVOIDANCE_FREQUENCY''','''SITUATION_SELF_AWARENESS''','''SITUATION_RESILIENCE''','''GOAL_CONSISTENCY''','''GOAL_INITIATIVE''','''GOAL_PURPOSE_ALIGNMENT''','''GOAL_HABIT_STRENGTH''','''hse.self-confidence''','''hbs.avoidance''','''hgs.self-awareness''','''hgs.resilience''','''hbs.consistency''','''hbs.initiative''','''hgs.purpose-alignment''','''hgs.habit-strength'''] LOOP
  IF position(required in def)=0 THEN RAISE EXCEPTION 'The background Brain Context source must pin the exact frozen registry entry %',required;END IF;
 END LOOP;
 -- No ninth slot, no HRS, no already-dedicated foreground metric, and no
 -- currentness algorithm of its own.
 FOREACH forbidden IN ARRAY ARRAY['hse.stress','hse.attention','hse.motivation','hse.energy','hbs.reflection','hrs.','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','him_measurement_events','him_measurement_observations','him_metric_snapshots','him_current_structured_measurements','him_canonical_model_bindings','him_calculation_results','snapshot_version','supersedes_observation_id','public.read_him_latest_measurement_v1','public.read_him_contextual_current_intelligence_batch_v1','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The background Brain Context source must stay a fixed eight-slot delegation: found %',forbidden;END IF;
 END LOOP;
 IF position('auth.uid' in def)>0 OR position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The background Brain Context source must neither read nor reconstruct request identity';END IF;
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The background Brain Context source must be read-only';END IF;
END$$;

-- 14. Migration-phase postcondition on the managed durable completion command and
--     the two generic paths that must reject the Brain Context effect.
DO $$DECLARE fn text:='public.complete_post_response_him_brain_context_materialization_v1(uuid,text,jsonb)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The managed Brain Context completion command is missing';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF NOT p.prosecdef OR p.provolatile<>'v' OR p.owner<>'postgres' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The managed Brain Context completion properties are unsafe';END IF;
 IF p.pronargs<>3 THEN RAISE EXCEPTION 'The managed Brain Context completion must accept exactly the execution identity and the typed result';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('authenticated',fn,'EXECUTE') authed,has_function_privilege('service_role',fn,'EXECUTE') service INTO acl;
 IF acl.pub OR acl.anon_role OR acl.authed OR NOT acl.service THEN RAISE EXCEPTION 'The managed Brain Context completion EXECUTE authority must be service_role-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.post_response_him_brain_context_result_valid_v1(' in def)=0 THEN RAISE EXCEPTION 'The managed Brain Context completion must validate the typed durable payload';END IF;
 IF position('''COMPLETED''' in def)=0 OR position('''CLAIMED''' in def)>0 THEN RAISE EXCEPTION 'The managed Brain Context completion must insert a COMPLETED effect and never a CLAIMED one';END IF;
 IF position('source_turn_id' in def)=0 THEN RAISE EXCEPTION 'The managed Brain Context completion must bind the durable result to the execution source turn';END IF;
 IF position('him_measurement_targets' in def)=0 THEN RAISE EXCEPTION 'The managed Brain Context completion must verify every signal context against the execution owner';END IF;
 FOREACH forbidden IN ARRAY ARRAY['p_user_id','p_session_id','p_access_token','p_metric_key','p_metric_keys','p_context_kind','p_context_id','p_source_turn_id','request.jwt','set_config','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The managed Brain Context completion accepts no caller-supplied identity, registry, or reconstructed JWT: found %',forbidden;END IF;
 END LOOP;
 -- Both generic paths reject the managed effect by name.
 def:=pg_get_functiondef('public.claim_post_response_intelligence_effect_v1(uuid,text)'::regprocedure);
 IF position('HIM_BRAIN_CONTEXT_MATERIALIZATION_MANAGED' in def)=0 THEN RAISE EXCEPTION 'The generic claim path must reject the managed Brain Context effect';END IF;
 IF position('HYPOTHESIS_UPDATE_BATCH_MANAGED' in def)=0 OR position('CONFIDENCE_BATCH_MANAGED' in def)=0 THEN RAISE EXCEPTION 'The generic claim path must keep every existing managed rejection';END IF;
 def:=pg_get_functiondef('public.complete_post_response_intelligence_effect_v1(uuid,text)'::regprocedure);
 IF position('HIM_BRAIN_CONTEXT_MATERIALIZATION_COMMAND_REQUIRED' in def)=0 THEN RAISE EXCEPTION 'The generic result-less completion must reject the managed Brain Context effect';END IF;
 FOREACH forbidden IN ARRAY ARRAY['MEMORY_RESULT_REQUIRED','INTENT_RESULT_REQUIRED','ASSOCIATION_RESULT_REQUIRED','CANDIDATE_RESULT_REQUIRED','HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED','HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED','CONFIDENCE_BATCH_COMMAND_REQUIRED'] LOOP
  IF position(forbidden in def)=0 THEN RAISE EXCEPTION 'The generic result-less completion must keep every existing typed rejection: % is missing',forbidden;END IF;
 END LOOP;
 -- The durable result domain really is installed, and really has no all-null
 -- (claimed) Brain alternative.
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.post_response_intelligence_effects'::regclass AND conname='post_response_intelligence_effects_brain_context_result_check') THEN RAISE EXCEPTION 'The Brain Context durable result domain is missing';END IF;
 IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.post_response_intelligence_effects'::regclass AND conname='post_response_intelligence_effects_brain_context_result_check') NOT LIKE '%post_response_him_brain_context_result_valid_v1%' THEN RAISE EXCEPTION 'The Brain Context durable result domain must enforce the canonical payload validator';END IF;
END$$;

-- 15. Migration-phase postcondition on the authenticated foreground Brain Context
--     read: safe properties, postgres ownership, the exact narrow
--     authenticated-only ACL, the exact three-parameter surface, the proven
--     immediate-previous-turn algorithm, required delegation to the QHIA-006
--     relevance authority, and the proven absence - from the INSTALLED
--     definition - of every measurement substrate, every currentness authority,
--     every older-fallback shape, dynamic SQL, JWT reconstruction and mutation.
DO $$DECLARE fn text:='public.read_him_brain_context_for_turn_v1(uuid,uuid,uuid)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The foreground Brain Context read is missing';END IF;
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_brain_context_for_turn_v1')<>1 THEN RAISE EXCEPTION 'Exactly one foreground Brain Context read may exist';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF NOT p.prosecdef OR p.provolatile<>'s' OR p.owner<>'postgres' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The foreground Brain Context read properties are unsafe';END IF;
 IF p.pronargs<>3 THEN RAISE EXCEPTION 'The foreground Brain Context read must accept exactly the owner, the exact owned session, and the exact current turn';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('authenticated',fn,'EXECUTE') authed,has_function_privilege('service_role',fn,'EXECUTE') service INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'The foreground Brain Context read EXECUTE authority must be authenticated-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('auth.uid()' in def)=0 THEN RAISE EXCEPTION 'The foreground Brain Context read must require an authenticated caller';END IF;
 -- The immediate-previous-turn rule, proven structurally on the installed
 -- definition: the predecessor comparison uses the deterministic
 -- (created_at, id) ordering, and the COMPLETED requirement appears only AFTER
 -- that selection.
 IF position('(t.created_at,t.id)<(current_turn.created_at,current_turn.id)' in def)=0 THEN RAISE EXCEPTION 'The foreground Brain Context read must select the predecessor by the deterministic (created_at, id) session ordering';END IF;
 IF position('ORDER BY t.created_at DESC,t.id DESC LIMIT 1' in def)=0 THEN RAISE EXCEPTION 'The foreground Brain Context read must take exactly the greatest strictly-earlier USER turn';END IF;
 IF strpos(def,'previous_turn.status<>''COMPLETED''')=0 THEN RAISE EXCEPTION 'The foreground Brain Context read must require the selected predecessor to be COMPLETED';END IF;
 IF strpos(def,'previous_turn.status<>''COMPLETED''')<strpos(def,'(t.created_at,t.id)<(current_turn.created_at,current_turn.id)') THEN RAISE EXCEPTION 'The foreground Brain Context read must decide usability AFTER selecting the immediate predecessor, never by filtering status while choosing';END IF;
 IF position('public.read_him_session_context_bindings_v1(' in def)=0 THEN RAISE EXCEPTION 'The foreground Brain Context read must revalidate relevance through the QHIA-006 authority';END IF;
 -- No metric reread, no currentness authority, no relevance reimplementation,
 -- and no older-fallback shape anywhere in the installed definition.
 FOREACH forbidden IN ARRAY ARRAY['him_metric_snapshots','him_measurement_events','him_measurement_observations','him_current_structured_measurements','him_metric_definitions','him_canonical_model_bindings','him_calculation_results','public.him_measurement_targets','public.him_session_context_bindings','public.read_him_latest_measurement_v1','public.read_him_latest_measurement_core_v1','public.read_him_contextual_current_intelligence_batch_v1','public.him_active_structured_binding_id','public.background_read_him_brain_context_source_v1','OFFSET','LIMIT 2','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The foreground Brain Context read must consume only the durable materialization and the QHIA-006 authority: found %',forbidden;END IF;
 END LOOP;
 IF position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The foreground Brain Context read must not reconstruct or write request identity state';END IF;
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The foreground Brain Context read must be read-only';END IF;
END$$;

-- 16. The existing surfaces this migration composes over are untouched and must
--     still be installed with their exact unchanged authorities. QHIA-012 adds
--     one background source, one managed completion, one foreground read and one
--     trusted internal core; it retires, replaces, and weakens nothing.
DO $$DECLARE acl record;fn text;BEGIN
 FOREACH fn IN ARRAY ARRAY['public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])','public.read_him_session_context_bindings_v1(uuid,uuid)','public.read_him_session_situation_stress_v1(uuid,uuid)','public.read_him_session_decision_attention_v1(uuid,uuid)','public.read_him_session_goal_motivation_v1(uuid,uuid)','public.read_him_session_relationship_communication_v1(uuid,uuid)','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','public.read_him_session_cross_context_foreground_v2(uuid,uuid)','public.read_him_session_cross_context_foreground_v3(uuid,uuid)'] LOOP
  IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The existing foreground authority % must remain installed',fn;END IF;
  SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('authenticated',fn,'EXECUTE') authed,has_function_privilege('service_role',fn,'EXECUTE') service INTO acl;
  IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'The existing foreground authority % must keep its unchanged authenticated-only EXECUTE authority',fn;END IF;
 END LOOP;
 IF to_regprocedure('public.background_read_him_conversation_snapshot_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The existing background CONVERSATION_SESSION snapshot authority must remain installed';END IF;
 -- The service role gains exactly two new capabilities in this migration and no
 -- generic HIM read of any kind.
 IF has_function_privilege('service_role','public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])','EXECUTE') THEN RAISE EXCEPTION 'The service role must not gain the QHIA-004 batch authority';END IF;
 IF has_function_privilege('service_role','public.read_him_session_context_bindings_v1(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'The service role must not gain the QHIA-006 relevance authority';END IF;
 -- The QHIA-006 relevance substrate keeps its migration-0055 zero-privilege
 -- posture for EVERY request role: QHIA-012 reaches ACTIVE bindings only from
 -- inside postgres-owned SECURITY DEFINER functions and grants nothing.
 FOREACH fn IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
  IF has_table_privilege('anon','public.him_session_context_bindings',fn) OR has_table_privilege('authenticated','public.him_session_context_bindings',fn) OR has_table_privilege('service_role','public.him_session_context_bindings',fn) THEN RAISE EXCEPTION 'Direct % on the QHIA-006 relevance substrate is forbidden',fn;END IF;
 END LOOP;
 -- The durable post-response ledger keeps its migration-0022 posture for the
 -- two user-facing request roles: the new foreground read reaches it only
 -- through the postgres-owned definer installed above.
 FOREACH fn IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
  IF has_table_privilege('anon','public.post_response_intelligence_effects',fn) OR has_table_privilege('authenticated','public.post_response_intelligence_effects',fn)
   OR has_table_privilege('anon','public.post_response_intelligence_executions',fn) OR has_table_privilege('authenticated','public.post_response_intelligence_executions',fn)
  THEN RAISE EXCEPTION 'Direct % on the post-response durable ledger is forbidden for anon and authenticated',fn;END IF;
 END LOOP;
END$$;
COMMIT;
