BEGIN;
-- HIM Legacy Energy Current Authority Reconciliation v1 - the compatibility
-- remediation for independent closure-audit finding QHIM-012 (HIGH):
-- "Legacy Energy 'current' view contradicts canonical current semantics."
--
-- Confirmed defect shape: migration 0012 created
-- public.him_current_energy_measurements as an INDEPENDENT raw
-- observation-to-snapshot join carrying its own correction filter and its own
-- explicit calculation-supersession filter. It predates every later
-- currentness decision, so it has no metric_key restriction, no exact
-- definition-version restriction, no one-row-per-observation contract, no
-- ACTIVE-binding preference, and no deterministic historical fallback. It
-- therefore contradicted the canonical current contract on two axes at once:
-- it could surface a non-Energy structured snapshot through an Energy-named
-- surface, and after a canonical binding transition it could surface more than
-- one "current" snapshot for a single unsuperseded Energy observation - the
-- exact QHIM-001 defect that migration 0050 repaired for
-- public.him_current_structured_measurements. It remained directly readable by
-- authenticated at the canonical baseline, so it was a live second current
-- authority beside the repaired canonical one.
--
-- Frozen remediation, per the reviewed architectural decision: the object is
-- NOT dropped and its independent selection logic is NOT preserved or
-- reimplemented. him_current_energy_measurements becomes a narrow backward
-- compatibility PROJECTION over the canonical structured-current authority,
-- restricted to exactly hse.energy@1. Every currentness semantic - correction
-- exclusion, explicit calculation supersession, at most one current snapshot
-- per unsuperseded observation, ACTIVE-binding preference over snapshot
-- recency, and the deterministic latest-historical fallback - is inherited by
-- delegation to public.him_current_structured_measurements (migration 0050),
-- never duplicated here. No third currentness implementation is created.
--
-- Two distinct authorities stay strictly separate and neither moves here:
--   * PER-OBSERVATION CURRENTNESS is owned by
--     public.him_current_structured_measurements. The compatibility view is
--     only a filtered projection of that one authority.
--   * LATEST MEASUREMENT ACROSS EVENTS is owned by
--     public.read_him_latest_measurement_v1(...) (migration 0052).
--     him_current_energy_measurements is NOT, and must never be described as,
--     the latest-across-events authority. No latest semantics - no measurement
--     event chronology, no cross-event ordering, no LIMIT 1 - enter this view.
--
-- The exact definition_version=1 pin is mandatory and deliberate. This object
-- was introduced by the Energy v1 measurement model and carries no version
-- parameter in its name or its shape, so a legitimate future hse.energy@2 must
-- never silently enter a versionless legacy compatibility surface merely
-- because it shares the metric key. Nothing here prohibits hse.energy@2: a
-- future Energy definition version stays entirely legal and would simply be
-- read through separately reviewed exact-version authorities. The invariant is
-- only that THIS historical v1 compatibility object stays exact to
-- hse.energy@1.
--
-- The object is preserved rather than retired because the historical Energy
-- verifier still exercises this surface against the final live schema for
-- Energy v1 correction behavior. Preserving it as a projection keeps that
-- historical v1 surface available, removes its independent read authority,
-- makes it inherit the 0050 currentness contract automatically, keeps the
-- existing authenticated owner/RLS behavior, and prevents future Energy
-- versions from leaking into it.
--
-- This migration is selection-only and reduces authority. It performs no
-- INSERT, UPDATE, DELETE, backfill, or truncation of measurement history, adds
-- no table, index, trigger, or function, changes no metric definition, model,
-- binding, approval, scale, or calibration status, and adds or removes no
-- Trend, Intelligence Snapshot, or Runtime Consumption eligibility. It freezes
-- no future migration number, no future metric version, and no future
-- authority.

-- 1. Current-phase preconditions. The canonical substrate this projection
--    delegates to must already exist and must still own the QHIM-001
--    selection, and the legacy object this task reconciles must still be
--    present, so the migration can never silently install a projection over an
--    unexpected authority or resurrect a dropped object. These are one-time
--    migration-phase facts only. The pre-remediation service_role privilege on
--    the legacy view is captured into a transaction-local setting so the
--    postcondition can prove this task granted service_role nothing new,
--    whatever the deployment's baseline was.
DO $$BEGIN
 IF to_regclass('public.him_current_structured_measurements') IS NULL THEN RAISE EXCEPTION 'Canonical structured-current authority is missing';END IF;
 IF to_regclass('public.him_current_energy_measurements') IS NULL THEN RAISE EXCEPTION 'Legacy Energy compatibility surface is missing';END IF;
 IF to_regclass('public.him_metric_snapshots') IS NULL THEN RAISE EXCEPTION 'Canonical snapshot substrate is missing';END IF;
 IF to_regprocedure('public.him_active_structured_binding_id(text,integer,text)') IS NULL THEN RAISE EXCEPTION 'QHIM-001 ACTIVE-binding resolver is missing';END IF;
 IF position('DISTINCT ON' in pg_get_viewdef('public.him_current_structured_measurements'::regclass))=0 OR position('him_active_structured_binding_id' in pg_get_viewdef('public.him_current_structured_measurements'::regclass))=0 THEN RAISE EXCEPTION 'Canonical structured-current no longer owns the QHIM-001 one-row-per-observation ACTIVE-binding selection';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=1) THEN RAISE EXCEPTION 'The exact hse.energy v1 definition this compatibility surface represents is missing';END IF;
 PERFORM set_config('qandeel.qhim012_service_role_select',has_table_privilege('service_role','public.him_current_energy_measurements','SELECT')::text,true);
END$$;

-- 2. The compatibility projection. CREATE OR REPLACE keeps the object
--    identity, its dependents, and its existing ACL rather than dropping and
--    recreating an authenticated-readable surface, and security_invoker is
--    restated so the caller's own privileges and RLS continue to decide row
--    visibility exactly as before. The body is deliberately nothing but a
--    delegation plus the exact hse.energy@1 restriction: no join to
--    him_metric_snapshots, no correction predicate, no supersession predicate,
--    no binding resolver, no DISTINCT ON, no snapshot ordering, and no event
--    ordering. Those semantics belong to the canonical authorities and are
--    inherited, never restated.
CREATE OR REPLACE VIEW public.him_current_energy_measurements WITH(security_invoker=true)AS SELECT canonical.* FROM public.him_current_structured_measurements canonical WHERE canonical.metric_key='hse.energy' AND canonical.definition_version=1;

-- 3. Exactly the intended read authority, restated explicitly: authenticated
--    may SELECT, PUBLIC and anon may not, and service_role receives no grant
--    of any kind from this task. This is the same posture migration 0012
--    installed for this object; nothing is broadened.
REVOKE ALL ON public.him_current_energy_measurements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.him_current_energy_measurements TO authenticated;

-- 4. Migration-phase postconditions on the one object this migration owns:
--    the installed definition delegates to the canonical authority, is exact
--    to hse.energy@1, owns no competing currentness algorithm, keeps the
--    him_metric_snapshots-compatible row shape, stays security_invoker, and
--    carries exactly the intended privileges. Semantic properties are proven -
--    no byte-exact SQL formatting is required. The literals naming raw
--    snapshot joins and selection tokens appear here only as data, to prove
--    their absence from the installed definition.
DO $$DECLARE def text;shape name[];source name[];BEGIN
 def:=pg_get_viewdef('public.him_current_energy_measurements'::regclass);
 IF position('him_current_structured_measurements' in def)=0 THEN RAISE EXCEPTION 'The legacy Energy surface must delegate to the canonical structured-current authority';END IF;
 IF def !~ 'metric_key\s*=\s*''hse\.energy''' THEN RAISE EXCEPTION 'The legacy Energy compatibility surface is not restricted to hse.energy';END IF;
 IF def !~ 'definition_version\s*=\s*1\y' THEN RAISE EXCEPTION 'The legacy Energy compatibility surface is not exact to definition version 1';END IF;
 IF position('him_metric_snapshots' in def)>0 OR position('him_measurement_observations' in def)>0 OR position('him_energy_calculation_supersessions' in def)>0 OR position('him_measurement_events' in def)>0 THEN RAISE EXCEPTION 'The legacy Energy compatibility surface must join no raw measurement substrate';END IF;
 IF position('supersedes_observation_id' in def)>0 OR position('him_active_structured_binding_id' in def)>0 OR position('DISTINCT' in def)>0 OR position('ORDER BY' in def)>0 OR position('LIMIT' in def)>0 THEN RAISE EXCEPTION 'The legacy Energy compatibility surface must own no independent currentness, binding, or latest-selection algorithm';END IF;
 SELECT array_agg(attname ORDER BY attnum) INTO shape FROM pg_attribute WHERE attrelid='public.him_current_energy_measurements'::regclass AND attnum>0 AND NOT attisdropped;
 SELECT array_agg(attname ORDER BY attnum) INTO source FROM pg_attribute WHERE attrelid='public.him_metric_snapshots'::regclass AND attnum>0 AND NOT attisdropped;
 IF shape IS DISTINCT FROM source THEN RAISE EXCEPTION 'The legacy Energy compatibility surface lost its him_metric_snapshots-compatible row shape';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.him_current_energy_measurements'::regclass AND 'security_invoker=true'=ANY(coalesce(reloptions,ARRAY[]::text[]))) THEN RAISE EXCEPTION 'The legacy Energy compatibility surface must remain security_invoker';END IF;
 IF NOT has_table_privilege('authenticated','public.him_current_energy_measurements','SELECT') THEN RAISE EXCEPTION 'authenticated must retain SELECT on the legacy Energy compatibility surface';END IF;
 IF has_table_privilege('public','public.him_current_energy_measurements','SELECT') OR has_table_privilege('anon','public.him_current_energy_measurements','SELECT') THEN RAISE EXCEPTION 'PUBLIC and anon must not read the legacy Energy compatibility surface';END IF;
 IF has_table_privilege('authenticated','public.him_current_energy_measurements','INSERT') OR has_table_privilege('authenticated','public.him_current_energy_measurements','UPDATE') OR has_table_privilege('authenticated','public.him_current_energy_measurements','DELETE') THEN RAISE EXCEPTION 'The legacy Energy compatibility surface must stay read-only for authenticated';END IF;
 IF has_table_privilege('service_role','public.him_current_energy_measurements','SELECT')::text IS DISTINCT FROM current_setting('qandeel.qhim012_service_role_select',true) THEN RAISE EXCEPTION 'service_role privilege on the legacy Energy compatibility surface changed in this task';END IF;
 -- The delegated authority is still the one that owns currentness, and the
 -- canonical latest-across-events authority is untouched and still separate.
 IF position('him_active_structured_binding_id' in pg_get_viewdef('public.him_current_structured_measurements'::regclass))=0 THEN RAISE EXCEPTION 'The canonical structured-current authority was altered by this task';END IF;
 IF to_regprocedure('public.read_him_latest_measurement_v1(uuid,text,integer,text,text)') IS NULL THEN RAISE EXCEPTION 'The canonical latest-across-events authority must remain installed and separate';END IF;
END$$;
COMMIT;
