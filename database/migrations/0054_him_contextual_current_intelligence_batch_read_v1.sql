BEGIN;
-- HIM Contextual Current Intelligence Batch Read v1 (QHIA-004).
--
-- QHIA-003 installed the typed cross-family contextual current-intelligence
-- boundary, but its application transport shape performed up to three serial
-- network stages per requested metric slot (definition read, canonical-latest
-- read, ACTIVE-binding read). Consumed naively in a foreground path, one full
-- SITUATION context would fan out to roughly 33 PostgREST requests, which is
-- incompatible with the phase latency invariant that Human Intelligence must
-- never make the conversation feel slower.
--
-- This migration changes TRANSPORT SHAPE ONLY. It installs exactly one new
-- read-only batch RPC that answers one explicit context/subset request in one
-- HTTP round trip while DELEGATING every per-slot current-value read to the
-- existing canonical authorities:
--
--   * public.read_him_latest_measurement_v1(uuid,text,integer,text,text)
--     (migration 0052) stays the ONLY canonical latest-across-events value
--     authority - owner-exact access, exact definition identity, definition
--     approved context eligibility, context ownership, immutable event
--     chronology, unsuperseded-observation selection, structured-current
--     selection, zero rows when the newest event has no usable current
--     calculated value, and no older-event fallback all live there and only
--     there.
--   * public.him_active_structured_binding_id(text,integer,text)
--     (migration 0050) stays the only ACTIVE-binding identity resolver.
--   * public.him_metric_definitions stays the exact persisted definition,
--     context-eligibility, and semantic metadata authority; the batch surface
--     reads exact requested definition rows solely to return the metadata the
--     QHIA-003 projection already requires.
--
-- The batch function owns NO currentness semantics: it never touches the
-- measurement-event, observation, snapshot, structured-current,
-- calculation-supersession, or canonical-binding substrates directly, and it
-- implements no chronology, correction selection, snapshot-version ordering,
-- binding selection, older-event fallback, or any second "latest" algorithm.
-- The install-time postcondition below proves those absences on the INSTALLED
-- function definition, naming the forbidden identifiers only as data.
--
-- No Trend, score, interpretation, readiness, freshness, or behavioral field
-- is added; no cache or staleness policy is invented; no history row is
-- written, backfilled, or reinterpreted; and no existing surface (HSE
-- Intelligence Snapshot, QHIA-001 interaction adaptation, Reasoning,
-- FAST/DEEP consumption, background HIM, Orchestrator, providers) changes.

-- 1. Current-phase preconditions: the canonical authorities this transport
--    composes over must already exist. One-time migration-phase facts only -
--    nothing here freezes a future migration, metric version, context kind,
--    or function.
DO $$BEGIN
 IF to_regprocedure('public.read_him_latest_measurement_v1(uuid,text,integer,text,text)') IS NULL THEN RAISE EXCEPTION 'The canonical latest measurement read authority (migration 0052) is missing';END IF;
 IF to_regprocedure('public.him_active_structured_binding_id(text,integer,text)') IS NULL THEN RAISE EXCEPTION 'The QHIM-001 ACTIVE-binding resolver (migration 0050) is missing';END IF;
 IF to_regclass('public.him_metric_definitions') IS NULL THEN RAISE EXCEPTION 'The persisted HIM metric definition authority is missing';END IF;
END$$;

-- 2. The one batch transport function. SECURITY DEFINER for the same reason
--    as read_him_latest_measurement_v1: the exact persisted metric definition
--    is the context-eligibility and metadata authority and deliberately
--    carries no direct authenticated SELECT grant. Authority is fail-closed:
--    authenticated caller only, exact caller identity only, canonical batch
--    context kinds only, bounded aligned duplicate-free slot arrays only,
--    exact persisted definitions only, definition-listed context kinds only.
--    Context OWNERSHIP is enforced by the delegated canonical latest
--    authority itself on every slot, so unknown and cross-user contexts fail
--    closed without revealing whether another user's data exists. The read is
--    STABLE, uses no dynamic SQL, reconstructs no JWT, and writes nothing.
--    One result row is returned for every requested slot - slot_order is the
--    1-based input array ordinal - including when the canonical latest
--    authority returns zero rows for that slot, in which case every source
--    and current-value field is null and has_canonical_current_value=false
--    while the requested/definition metadata remains present.
CREATE FUNCTION public.read_him_contextual_current_intelligence_batch_v1(p_user_id uuid,p_context_kind text,p_context_id text,p_metric_keys text[],p_definition_versions integer[])
RETURNS TABLE(
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
DECLARE u uuid:=auth.uid();n integer;i integer;k text;v integer;kinds text[];distinct_slots integer;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Contextual current-intelligence batch reads are owner-exact' USING ERRCODE='42501';END IF;
 IF p_context_kind IS NULL OR NOT(p_context_kind=ANY(ARRAY['CONVERSATION_SESSION','SITUATION','GOAL','DECISION','RELATIONSHIP'])) THEN RAISE EXCEPTION 'Unsupported HIM batch context kind' USING ERRCODE='22023';END IF;
 IF p_context_id IS NULL OR length(p_context_id)=0 OR length(p_context_id)>128 THEN RAISE EXCEPTION 'Invalid HIM context identity' USING ERRCODE='22023';END IF;
 IF p_metric_keys IS NULL OR p_definition_versions IS NULL THEN RAISE EXCEPTION 'Contextual batch metric identity arrays are required' USING ERRCODE='22023';END IF;
 n:=cardinality(p_metric_keys);
 IF n<1 OR n>17 OR cardinality(p_definition_versions)<>n THEN RAISE EXCEPTION 'Contextual batch requests carry between 1 and 17 aligned exact metric slots' USING ERRCODE='22023';END IF;
 FOR i IN 1..n LOOP
  k:=p_metric_keys[i];v:=p_definition_versions[i];
  IF k IS NULL OR length(k)=0 OR length(k)>128 OR v IS NULL OR v<1 THEN RAISE EXCEPTION 'Invalid exact HIM metric identity' USING ERRCODE='22023';END IF;
  SELECT d.valid_context_kinds INTO kinds FROM public.him_metric_definitions d WHERE d.metric_key=k AND d.definition_version=v;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown exact HIM metric definition' USING ERRCODE='22023';END IF;
  IF NOT(p_context_kind=ANY(kinds)) THEN RAISE EXCEPTION 'Unsupported context kind for the exact HIM metric definition' USING ERRCODE='22023';END IF;
 END LOOP;
 SELECT count(DISTINCT (p_metric_keys[j],p_definition_versions[j])) INTO distinct_slots FROM generate_series(1,n) j;
 IF distinct_slots<>n THEN RAISE EXCEPTION 'Duplicate exact HIM metric definition in one batch request' USING ERRCODE='22023';END IF;
 RETURN QUERY
 SELECT s.ord::integer,
  s.k,s.v,
  d.hif_owner,d.semantic_mapping_status,d.semantic_type,d.calculation_status,d.valid_context_kinds,
  p_context_kind,p_context_id,
  (c.id IS NOT NULL),
  c.metric_key,c.definition_version,c.semantic_mapping_status,c.semantic_type,c.context_kind,c.context_id,
  c.value_state,c.numeric_value,c.validity_status,c.confidence_state,c.confidence_reference,
  c.observed_at,c.temporal_window_start,c.temporal_window_end,c.canonical_binding_id,
  public.him_active_structured_binding_id(s.k,s.v,p_context_kind)
 FROM unnest(p_metric_keys,p_definition_versions) WITH ORDINALITY AS s(k,v,ord)
 JOIN public.him_metric_definitions d ON d.metric_key=s.k AND d.definition_version=s.v
 LEFT JOIN LATERAL public.read_him_latest_measurement_v1(p_user_id,s.k,s.v,p_context_kind,p_context_id) c ON true
 ORDER BY s.ord;
END$$;

-- 3. Narrow authority: authenticated EXECUTE only. No PUBLIC, no anon, and no
--    service_role grant - the batch surface is an aggregation/transport
--    optimization over reads the authenticated user could already perform
--    through the canonical authorities, and it widens no visibility.
REVOKE ALL ON FUNCTION public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[]) TO authenticated;

-- 4. Migration-phase postconditions on the one function this migration owns:
--    safe properties, exact narrow ACL, required delegation to the canonical
--    latest authority and the ACTIVE-binding resolver, and the proven absence
--    of every forbidden currentness substrate/algorithm from the INSTALLED
--    function definition. The forbidden identifiers are named here only as
--    data to prove their absence.
DO $$DECLARE def text;p record;forbidden text;acl record;BEGIN
 SELECT prosecdef,provolatile,proconfig INTO p FROM pg_proc WHERE oid='public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])'::regprocedure;
 IF NOT p.prosecdef OR p.provolatile<>'s' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'Contextual batch read authority properties are unsafe';END IF;
 def:=pg_get_functiondef('public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])'::regprocedure);
 IF position('public.read_him_latest_measurement_v1(' in def)=0 THEN RAISE EXCEPTION 'Contextual batch must delegate every current-value read to the canonical latest authority';END IF;
 IF position('public.him_active_structured_binding_id(' in def)=0 THEN RAISE EXCEPTION 'Contextual batch must resolve binding identity through the existing ACTIVE-binding resolver';END IF;
 IF position('him_metric_definitions' in def)=0 OR position('valid_context_kinds' in def)=0 THEN RAISE EXCEPTION 'Contextual batch lost its exact-definition metadata/context authority';END IF;
 FOREACH forbidden IN ARRAY ARRAY['him_measurement_events','him_measurement_observations','him_metric_snapshots','him_current_structured_measurements','him_energy_calculation_supersessions','him_canonical_model_bindings','snapshot_version','supersedes_observation_id','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'Contextual batch must not own currentness semantics or dynamic SQL: found %',forbidden;END IF;
 END LOOP;
 IF position('set_config' in def)>0 OR position('request.jwt' in def)>0 THEN RAISE EXCEPTION 'Contextual batch must not reconstruct a JWT';END IF;
 SELECT has_function_privilege('public','public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])','EXECUTE') pub,has_function_privilege('anon','public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])','EXECUTE') anon_role,has_function_privilege('service_role','public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])','EXECUTE') service,has_function_privilege('authenticated','public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])','EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Contextual batch read authority grants are wrong';END IF;
END$$;
COMMIT;
