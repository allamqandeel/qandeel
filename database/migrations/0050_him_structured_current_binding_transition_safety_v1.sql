BEGIN;
-- HIM Structured Current Binding-Transition Safety v1 - the shared
-- currentness remediation for independent audit finding QHIM-001 (HIGH):
-- "Binding replacement can leave two current snapshots for one observation."
--
-- Confirmed defect shape: the canonical binding lifecycle legitimately
-- replaces an ACTIVE binding with an activated PENDING successor, and
-- calculation idempotency is deliberately scoped to
-- (measurement_observation_id,canonical_binding_id) - so one unsuperseded
-- observation may durably hold one calculation/snapshot pair under the
-- retired binding and another under its successor. The shared
-- him_current_structured_measurements view returned every
-- non-correction-superseded snapshot for that observation, so a binding
-- transition followed by recalculation surfaced two "current" rows for one
-- observation and inflated downstream slot cardinality into Snapshot
-- INTEGRITY_FAILURE. This is a shared currentness defect, not a
-- metric-calculation defect, so the remediation is selection-only and
-- metric-agnostic across all seventeen calibrated structured routes.
--
-- Frozen selection contract after this migration: for each unsuperseded
-- structured measurement observation the view exposes AT MOST ONE current
-- snapshot. A candidate snapshot calculated under the currently ACTIVE
-- canonical binding for the observation's exact
-- (metric_key,definition_version,context_kind) always wins - snapshot
-- recency never overrides an ACTIVE-binding candidate, which keeps the
-- selection safe even when an old-binding calculation commits AFTER the
-- binding transition. When no ACTIVE-binding candidate exists, exactly one
-- latest historical candidate is preserved (durable snapshot chronology:
-- snapshot_version, then created_at, then id as the stable tie-breaker) so
-- consumers can still observe INCOMPATIBLE_ACTIVE_BINDING instead of a
-- false NO_MEASUREMENT_EVENT. Binding lifecycle history and calculation
-- history stay append-only: nothing here deletes, rewrites, or
-- reinterprets a historical calculation result or snapshot, a binding
-- transition is never treated as an observation correction, and the
-- meaning of explicit observation correction is untouched.

-- 1. Shared ACTIVE-binding resolver: the current view is security_invoker
--    and the canonical binding table deliberately carries no authenticated
--    read grant, so the ACTIVE-binding preference resolves through this
--    narrow SECURITY DEFINER lookup. It exposes only the ACTIVE binding id
--    for one exact (metric_key,definition_version,context_kind) route -
--    the same identity read_him_intelligence_snapshot_v1 already returns
--    to its authenticated callers - never a binding row, and it is
--    metric-agnostic: no metric-specific currentness semantics exist. The
--    partial unique index him_one_active_canonical_binding guarantees at
--    most one ACTIVE binding per route, so the lookup is deterministic.
CREATE FUNCTION public.him_active_structured_binding_id(p_metric_key text,p_definition_version integer,p_context_kind text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT b.id FROM public.him_canonical_model_bindings b WHERE b.metric_key=p_metric_key AND b.definition_version=p_definition_version AND b.context_kind=p_context_kind AND b.status='ACTIVE'$$;
REVOKE ALL ON FUNCTION public.him_active_structured_binding_id(text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.him_active_structured_binding_id(text,integer,text) TO authenticated;

-- 2. One current snapshot per unsuperseded observation. The seventeen
--    canonical structured routes, the correction filter, and the explicit
--    supersession filter are preserved exactly from 0049 - no route is
--    added, removed, or broadened, and Trend/Snapshot eligibility is
--    unchanged. DISTINCT ON enforces the cardinality invariant (at most
--    one row per measurement_observation_id) and the ORDER BY encodes the
--    frozen selection priority: the ACTIVE-source-binding candidate first
--    (coalesced to false so a NULL comparison can never outrank a real
--    ACTIVE-binding match), then the deterministic latest-historical
--    fallback by durable snapshot chronology with a stable tie-breaker.
CREATE OR REPLACE VIEW public.him_current_structured_measurements WITH(security_invoker=true)AS SELECT DISTINCT ON(s.measurement_observation_id)s.* FROM public.him_measurement_observations o JOIN public.him_metric_snapshots s ON s.measurement_observation_id=o.id WHERE o.metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'])AND NOT EXISTS(SELECT 1 FROM public.him_measurement_observations newer WHERE newer.supersedes_observation_id=o.id)AND NOT EXISTS(SELECT 1 FROM public.him_energy_calculation_supersessions x WHERE x.snapshot_id=s.id)ORDER BY s.measurement_observation_id,coalesce(s.canonical_binding_id=public.him_active_structured_binding_id(o.metric_key,o.definition_version,o.context_kind),false)DESC,s.snapshot_version DESC,s.created_at DESC,s.id DESC;

-- 3. Migration-phase invariant: the rebuilt view still routes exactly the
--    seventeen canonical v1 structured metric keys through the preserved
--    correction/supersession filters and the new single-row selection.
--    This is a one-time migration-phase check only - nothing here freezes
--    a future migration number, a future metric version, or a separately
--    reviewed runtime function, and no global calibrated count is frozen.
DO $$DECLARE def text;route_key text;BEGIN
 def:=pg_get_viewdef('public.him_current_structured_measurements'::regclass);
 FOREACH route_key IN ARRAY ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'] LOOP
  IF position(route_key in def)=0 THEN RAISE EXCEPTION 'Structured-current route % must survive the binding-transition-safety rebuild',route_key;END IF;
 END LOOP;
 IF position('DISTINCT ON' in def)=0 OR position('him_active_structured_binding_id' in def)=0 OR position('supersedes_observation_id' in def)=0 OR position('him_energy_calculation_supersessions' in def)=0 OR position('snapshot_version DESC' in def)=0 THEN RAISE EXCEPTION 'Structured-current one-row-per-observation selection invariant failed';END IF;
END$$;
COMMIT;
