BEGIN;
-- HIM Canonical Latest Measurement Read Semantics v1 - the shared
-- current-read remediation for independent closure-audit findings
-- QHIM-005 (HIGH) and QHIM-007 (MEDIUM).
--
-- QHIM-005: the application repository selected "latest" across multiple
-- measurement events by snapshot_version DESC. snapshot_version is allocated
-- at calculation time, so a recalculation of an OLDER measurement event after
-- a binding upgrade received a higher snapshot version than a genuinely newer
-- measurement event and wrongly became "latest". The canonical chronological
-- identity of a measurement is its immutable measurement event, never its
-- calculation, snapshot, or snapshot-version chronology.
--
-- QHIM-007: the application repository routed every metric/context pair
-- outside a hand-coded structured-route expression to raw
-- him_metric_snapshots, so a now-unsupported canonical pair such as
-- hse.energy@1/SITUATION could surface a preserved pre-0051 legacy raw
-- snapshot as the canonical latest value.
--
-- Shared root cause: no single authoritative canonical-latest read contract
-- existed. This migration installs the one canonical read authority:
--
--   Given one authenticated user, one exact metric definition
--   (metric_key, definition_version), one exact canonical context kind, and
--   one exact owned context identity, return at most one canonical current
--   structured snapshot. The QHIM-001 per-observation binding-correct
--   selection (migration 0050) stays authoritative inside each unsuperseded
--   observation. Across measurement events the newest event is selected by
--   immutable event chronology - him_measurement_events.created_at DESC with
--   him_measurement_events.id DESC as the stable tie-breaker - then the
--   latest unsuperseded correction observation inside that event, and only
--   then that one observation's current structured snapshot. A later
--   recalculation of an older event can never make that event "latest", an
--   ACTIVE-binding snapshot on an older event can never outrank a newer
--   event's historical-fallback snapshot, and a correction never rewrites its
--   event's chronological position. If the newest qualifying event's current
--   observation has no current structured snapshot yet, the read returns
--   zero rows - it never walks back to an older event's calculated value.
--
-- A metric/context pair that is not authorized by the exact persisted metric
-- definition is not a canonical latest-read route and fails closed. Raw
-- him_metric_snapshots history stays durable and reachable only through the
-- explicit history/audit read paths; it is never canonical latest authority.
-- Nothing here deletes, backfills, or reinterprets any historical row, and
-- no Trend, Intelligence Snapshot, or Runtime Consumption surface changes.

-- 1. Current-phase preconditions: the canonical structured substrate this
--    read authority composes over must already exist. These are one-time
--    migration-phase facts only - nothing here freezes a future migration,
--    metric version, context kind, or function.
DO $$BEGIN
 IF to_regclass('public.him_current_structured_measurements') IS NULL OR to_regclass('public.him_measurement_events') IS NULL OR to_regclass('public.him_measurement_observations') IS NULL OR to_regclass('public.him_measurement_targets') IS NULL OR to_regclass('public.conversation_sessions') IS NULL OR to_regclass('public.him_metric_definitions') IS NULL THEN RAISE EXCEPTION 'Canonical latest-read substrate is missing';END IF;
 IF to_regprocedure('public.him_active_structured_binding_id(text,integer,text)') IS NULL THEN RAISE EXCEPTION 'QHIM-001 ACTIVE-binding resolver is missing';END IF;
END$$;

-- 2. The one canonical latest read authority. SECURITY DEFINER is required
--    because the exact persisted metric definition is the context-eligibility
--    authority and him_metric_definitions deliberately carries no direct
--    authenticated SELECT grant - the same reason read_him_intelligence
--    snapshot v1 and the Trend source reader are definers. Authority is
--    fail-closed: authenticated caller only, exact caller identity only,
--    exact persisted definition only, definition-listed context kind only,
--    owner-verified context only. The read is STABLE, uses no dynamic SQL,
--    reconstructs no JWT, and writes nothing.
CREATE FUNCTION public.read_him_latest_measurement_v1(p_user_id uuid,p_metric_key text,p_definition_version integer,p_context_kind text,p_context_id text)
RETURNS SETOF public.him_metric_snapshots LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();valid_kinds text[];owned boolean:=false;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Canonical latest measurement reads are owner-exact' USING ERRCODE='42501';END IF;
 IF p_metric_key IS NULL OR length(p_metric_key)=0 OR length(p_metric_key)>128 OR p_definition_version IS NULL OR p_definition_version<1 THEN RAISE EXCEPTION 'Invalid exact HIM metric identity' USING ERRCODE='22023';END IF;
 IF p_context_id IS NULL OR length(p_context_id)=0 OR length(p_context_id)>128 THEN RAISE EXCEPTION 'Invalid HIM context identity' USING ERRCODE='22023';END IF;
 -- Exact-definition authority: the requested (metric_key,definition_version)
 -- must exist exactly - no implicit version, no latest-version inference -
 -- and the requested context kind must be present in that exact definition's
 -- valid_context_kinds. This closes QHIM-007 at the root for every metric
 -- family, not only Energy.
 SELECT d.valid_context_kinds INTO valid_kinds FROM public.him_metric_definitions d WHERE d.metric_key=p_metric_key AND d.definition_version=p_definition_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown exact HIM metric definition' USING ERRCODE='22023';END IF;
 IF p_context_kind IS NULL OR NOT(p_context_kind=ANY(valid_kinds)) THEN RAISE EXCEPTION 'Unsupported context kind for the exact HIM metric definition' USING ERRCODE='22023';END IF;
 -- Context ownership authority: the same canonical substrates the dedicated
 -- metric RPCs, Snapshot, and Trend already use. Conversation sessions own
 -- CONVERSATION_SESSION contexts; him_measurement_targets owns SITUATION,
 -- DECISION, GOAL, and RELATIONSHIP contexts. Any other kind has no
 -- canonical ownership substrate today and fails closed. Unknown and
 -- cross-user contexts fail closed without revealing whether another user's
 -- measurement exists.
 IF p_context_kind='CONVERSATION_SESSION' THEN SELECT EXISTS(SELECT 1 FROM public.conversation_sessions c WHERE c.id::text=p_context_id AND c.user_id=u) INTO owned;
 ELSIF p_context_kind=ANY(ARRAY['SITUATION','DECISION','GOAL','RELATIONSHIP']) THEN SELECT EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id::text=p_context_id AND t.user_id=u AND t.context_kind=p_context_kind) INTO owned;
 ELSE RAISE EXCEPTION 'Unsupported HIM context ownership authority' USING ERRCODE='22023';END IF;
 IF NOT owned THEN RAISE EXCEPTION 'Unknown or unowned HIM measurement context' USING ERRCODE='42501';END IF;
 -- Selection: resolve the newest measurement event FIRST, by immutable event
 -- chronology, among events that carry an observation of the exact requested
 -- metric definition; then the latest unsuperseded observation inside that
 -- one event (explicit correction replaces the value within its original
 -- event and never creates a newer event); then join that exact observation
 -- to the QHIM-001 structured-current view. Because the event is chosen
 -- before snapshot availability, a newest event whose current observation
 -- has no current snapshot yields zero rows instead of falling back to an
 -- older event, and an older event's ACTIVE-binding or later-calculated
 -- snapshot can never masquerade as latest.
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

-- 3. Narrow authority: authenticated EXECUTE only. No PUBLIC, no anon, and
--    no service_role grant - background HIM has its own separately reviewed
--    read authority and no existing executable caller requires this RPC.
REVOKE ALL ON FUNCTION public.read_him_latest_measurement_v1(uuid,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_latest_measurement_v1(uuid,text,integer,text,text) TO authenticated;

-- 4. Migration-phase postconditions on the function this migration owns:
--    exact safe properties and exact chronology, checked once at install
--    time. The literal 'snapshot_version' is named here only as data to
--    prove the read authority never orders across events by it.
DO $$DECLARE def text;p record;BEGIN
 SELECT prosecdef,provolatile,proconfig INTO p FROM pg_proc WHERE oid='public.read_him_latest_measurement_v1(uuid,text,integer,text,text)'::regprocedure;
 IF NOT p.prosecdef OR p.provolatile<>'s' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'Canonical latest read authority properties are unsafe';END IF;
 def:=pg_get_functiondef('public.read_him_latest_measurement_v1(uuid,text,integer,text,text)'::regprocedure);
 IF position('ORDER BY me.created_at DESC,me.id DESC' in def)=0 OR position('ORDER BY mo.created_at DESC,mo.id DESC' in def)=0 THEN RAISE EXCEPTION 'Canonical latest event/observation chronology is missing';END IF;
 IF position('him_current_structured_measurements' in def)=0 THEN RAISE EXCEPTION 'Canonical latest must read through the QHIM-001 structured-current view';END IF;
 IF position('snapshot_version' in def)>0 OR position('EXECUTE format' in def)>0 OR position('EXECUTE ''' in def)>0 THEN RAISE EXCEPTION 'Canonical latest contains snapshot-version ordering or dynamic SQL';END IF;
 IF position('valid_context_kinds' in def)=0 OR position('him_metric_definitions' in def)=0 THEN RAISE EXCEPTION 'Canonical latest lost its exact-definition context authority';END IF;
 IF has_function_privilege('anon','public.read_him_latest_measurement_v1(uuid,text,integer,text,text)','EXECUTE') OR has_function_privilege('service_role','public.read_him_latest_measurement_v1(uuid,text,integer,text,text)','EXECUTE') OR NOT has_function_privilege('authenticated','public.read_him_latest_measurement_v1(uuid,text,integer,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Canonical latest read authority grants are wrong';END IF;
END$$;
COMMIT;
