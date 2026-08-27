BEGIN;
-- HIM Legacy Snapshot Authority & Energy Context Reconciliation v1 - the
-- Measurement Foundation closure remediation for independent audit findings
-- QHIM-003 (MEDIUM, legacy generic HIM snapshot authority / context-integrity
-- drift) and QHIM-004 (LOW, stale HIM Snapshot documentation; the
-- documentation half of QHIM-004 lives in docs/ and carries no database
-- state).
--
-- QHIM-003 has two halves.
--
-- First, the Foundation-era public.create_him_metric_snapshot(jsonb) is still
-- executable by authenticated and still writes directly to
-- him_metric_snapshots. Assessed generic inserts are already blocked by the
-- 0012 trusted-provenance guard, but UNASSESSED generic snapshots can still be
-- written, several UUID-shaped context identities are validated by syntax
-- rather than by canonical target ownership, and the resulting rows are
-- canonical-looking HIM history with no first-class Measurement Event ->
-- Measurement Observation -> Canonical Binding -> Calculation Result ->
-- Snapshot chain behind them. All seventeen canonical v1 metrics are now
-- calibrated and every one of them owns a first-class structured measurement
-- path, so this generic authenticated write authority is no longer required
-- for canonical production measurement.
--
-- The canonical rule after this migration: canonical HIM v1 measurement state
-- may be created only through a metric-owned, first-class structured
-- measurement path with server-derived ownership, instrument, scale, binding,
-- calculation, and provenance. The legacy function identity is therefore kept
-- for historical and schema compatibility but replaced with a fail-closed
-- no-write tombstone, and EXECUTE is revoked from every application role. No
-- replacement generic direct-snapshot writer is introduced, and no historical
-- snapshot created under the old authority is deleted, rewritten,
-- invalidated, or backfilled - this migration performs no INSERT, DELETE, or
-- TRUNCATE of any kind. A future, explicitly designed generic measurement API
-- is not prohibited by anything here; it would simply be a new reviewed
-- contract under its own name, never a silent resurrection of this function.
--
-- Second, hse.energy@1 still lists SITUATION among its valid context kinds.
-- That is historical Foundation drift, not dormant production authority: the
-- calibrated Energy model, the Energy observation/event substrate, the ACTIVE
-- canonical binding, the governance approval basis, and the dedicated
-- create_hse_energy_measurement RPC are all CONVERSATION_SESSION-only, and
-- Intelligence Snapshot v1 deliberately excludes Energy-in-SITUATION. This
-- migration reconciles the persisted definition to CONVERSATION_SESSION only.
-- It adds no SITUATION Energy model, binding, instrument, RPC, Snapshot slot,
-- or Trend eligibility, and it changes no other metric's contexts. If
-- SITUATION Energy is ever wanted, it requires a separately reviewed
-- measurement/version/authority decision.
--
-- This migration reduces authority and never broadens it. Nothing here grants
-- a table privilege, widens a SECURITY DEFINER function, expands Runtime
-- Consumption, Trend, or Snapshot eligibility, or freezes a future metric
-- version or a future migration.

-- 1. Exact preconditions. The migration fails closed if either target is not
--    in its expected pre-remediation shape, so it can never silently
--    reconcile an unexpected catalog or tombstone an unexpected function.
DO $$BEGIN
 IF to_regprocedure('public.create_him_metric_snapshot(jsonb)') IS NULL THEN RAISE EXCEPTION 'Legacy generic HIM snapshot writer is absent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HSE' AND semantic_mapping_status='RESOLVED' AND semantic_type='STATE' AND scale_reference='hse.energy.ordinal-5.v1' AND required_input_contract='DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1' AND confidence_requirement_reference='UNRESOLVED_METRIC_CONFIDENCE_MODEL' AND valid_context_kinds=ARRAY['SITUATION','CONVERSATION_SESSION'] AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  THEN RAISE EXCEPTION 'Unexpected hse.energy v1 catalog shape before context reconciliation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND status='ACTIVE' AND context_kind='CONVERSATION_SESSION')
  OR EXISTS(SELECT 1 FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND status='ACTIVE' AND context_kind<>'CONVERSATION_SESSION')
  THEN RAISE EXCEPTION 'Energy production authority is not CONVERSATION_SESSION-only'; END IF;
END$$;

-- 2. Retire the generic direct snapshot writer. The identity, argument name,
--    and result type are preserved exactly so no dependent object breaks, but
--    the body is a deterministic fail-closed tombstone: no INSERT, UPDATE, or
--    DELETE, no dynamic SQL, no provider or network behavior, a fixed empty
--    search_path, and a stable sanitized error naming the supported
--    replacement. It is downgraded from SECURITY DEFINER to the caller's own
--    authority because a function that performs no work needs none.
CREATE OR REPLACE FUNCTION public.create_him_metric_snapshot(p_observation jsonb)
RETURNS SETOF public.him_metric_snapshots LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $tombstone$
BEGIN
 RAISE EXCEPTION 'Generic HIM snapshot creation is retired: canonical measurement state must be created through the metric-owned structured measurement RPC for the exact metric' USING ERRCODE='42501';
END$tombstone$;
REVOKE ALL ON FUNCTION public.create_him_metric_snapshot(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 3. Reconcile Energy v1 to its approved production context. Exactly one row
--    and exactly one column change: calculation status, semantic mapping,
--    scale, required input contract, confidence semantics, consumers, and
--    dependencies are all untouched, and no other definition is named.
UPDATE public.him_metric_definitions SET valid_context_kinds=ARRAY['CONVERSATION_SESSION'] WHERE metric_key='hse.energy' AND definition_version=1;

-- 4. Exact postconditions. Energy v1 carries its approved
--    CONVERSATION_SESSION-only context with every other attribute preserved,
--    the sixteen sibling canonical v1 context lists are untouched, the
--    tombstone performs no write and no application role may execute it, and
--    the seventeen canonical v1 metrics remain calibrated. No global
--    definition count, future metric version, future function, or future
--    migration is frozen by any of this.
DO $$DECLARE body text;BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HSE' AND semantic_mapping_status='RESOLVED' AND semantic_type='STATE' AND scale_reference='hse.energy.ordinal-5.v1' AND required_input_contract='DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1' AND confidence_requirement_reference='UNRESOLVED_METRIC_CONFIDENCE_MODEL' AND valid_context_kinds=ARRAY['CONVERSATION_SESSION'] AND cardinality(dependency_ids)=0 AND cardinality(consumers)=0)
  THEN RAISE EXCEPTION 'hse.energy v1 CONVERSATION_SESSION-only reconciliation failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY(ARRAY['hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength']) AND NOT((metric_key='hse.motivation' AND valid_context_kinds=ARRAY['SITUATION','GOAL'])OR(metric_key='hse.attention' AND valid_context_kinds=ARRAY['SITUATION','CONVERSATION_SESSION','DECISION'])OR(metric_key='hse.self-confidence' AND valid_context_kinds=ARRAY['SITUATION','DECISION'])OR(metric_key='hse.stress' AND valid_context_kinds=ARRAY['SITUATION','CONVERSATION_SESSION'])OR(metric_key=ANY(ARRAY['hbs.avoidance','hbs.consistency','hbs.initiative']) AND valid_context_kinds=ARRAY['SITUATION','GOAL'])OR(metric_key='hbs.reflection' AND valid_context_kinds=ARRAY['SITUATION','CONVERSATION_SESSION'])OR(metric_key=ANY(ARRAY['hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety']) AND valid_context_kinds=ARRAY['RELATIONSHIP'])OR(metric_key=ANY(ARRAY['hgs.self-awareness','hgs.resilience','hgs.habit-strength']) AND valid_context_kinds=ARRAY['GOAL','SITUATION'])OR(metric_key='hgs.purpose-alignment' AND valid_context_kinds=ARRAY['GOAL'])))
  THEN RAISE EXCEPTION 'A sibling canonical v1 metric context list changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY(ARRAY['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength']) AND calculation_status<>'CALIBRATED')
  THEN RAISE EXCEPTION 'A canonical v1 metric left CALIBRATED'; END IF;
 body:=pg_get_functiondef(to_regprocedure('public.create_him_metric_snapshot(jsonb)'));
 IF body ~* '(INSERT|UPDATE|DELETE|TRUNCATE|COPY)[[:space:]]' OR body ~* 'EXECUTE[[:space:]]+format' OR body !~ 'retired' THEN RAISE EXCEPTION 'Legacy generic snapshot writer is not a no-write tombstone'; END IF;
 IF has_function_privilege('public','public.create_him_metric_snapshot(jsonb)','EXECUTE') OR has_function_privilege('anon','public.create_him_metric_snapshot(jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.create_him_metric_snapshot(jsonb)','EXECUTE') OR has_function_privilege('service_role','public.create_him_metric_snapshot(jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'An application role retains EXECUTE on the retired generic snapshot writer'; END IF;
END$$;
COMMIT;
