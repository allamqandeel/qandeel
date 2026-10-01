-- PROD-OPS-01 - Operational Readiness & Silent-Failure Visibility v1 (owns QAN-BL-PROD-03: PR01-S05 readiness; the W3
-- independent review's P-1 / P-5 privacy and export silent failures; stuck privacy / export work).
--
-- Operational state only. Nothing here is Product authority, nothing changes what an owner sees or how a deletion or
-- an export behaves, and nothing here carries an identifier, a text, an error message or a SQLSTATE out of the
-- database. Every object is executable by the server role alone.
--
--   1. DATABASE READINESS (public.server_database_ready_v1). The API's readiness probe used to send HEAD /rest/v1/ with
--      the publishable key. Supabase withdrew Data API root (OpenAPI) access for anon / publishable keys on 11 March
--      2026, so that probe could never pass. Readiness is now ONE zero-parameter RPC through the same Data API path
--      and the same server credential every server pass already uses. It reads no table and no row, mutates nothing
--      and answers exactly `true`: a successful answer proves the Data API gateway, a pooled database connection,
--      PostgREST's schema cache holding QANDEEL's own migrated surface, and the server role switch. It is not exposed
--      to anon or authenticated: no new client-reachable surface.
--
--   2. EXPORT FAILURE CLASSIFICATION (personal_data_private.data_exports + prepare_data_exports_v1). 0130 retries a
--      failed preparation and marks it FAILED after three attempts, but kept no reason at all. A failed attempt now
--      records ONE closed operational class derived from the SQLSTATE class and the time of that failure:
--        TRANSIENT_DATABASE | CONSTRAINT_OR_INTEGRITY | RESOURCE_OR_CAPACITY | INTERNAL_OTHER
--      The SQLSTATE itself and the exception text are never stored. A successful preparation clears both fields.
--      prepare_data_exports_v1 is redefined IN PLACE (same name, OID, owner, grants, DEFINER posture, empty
--      search_path); its body is 0130's except for three additions: one declared variable, the success UPDATE also
--      clearing the two fields, and the failure handler reading the SQLSTATE and setting them. Attempts (3), the one-minute backoff, the five-minute lease, the atomic READY
--      artifact and the owner-facing FAILED state are unchanged. The fields live on the export row itself, so the
--      governed Personal erasure (which deletes that row, and the account's ON DELETE CASCADE) removes them with it.
--
--   3. AGGREGATE PRIVACY OPERATIONS SUMMARY (public.server_read_privacy_operations_summary_v1). One row of counts and
--      ages, never an identity: how many exports are preparing, retrying, stuck or FAILED, the recent failures by
--      class, and how many deletions are due but not advancing or erased but still waiting for the provider account's
--      removal. BLOCKED (a Connected Worlds row still references the account) is the database's legitimate answer and
--      is never counted as stuck. The API's maintenance pass reads it and emits numeric telemetry; it is NOT a
--      readiness dependency.
--
-- Monitoring thresholds (engineering defaults, not Product law; fixed here so no configuration can alter them):
--   * stuck export: PREPARING for 30 minutes. A healthy preparation ends READY or FAILED within about four minutes
--     (three attempts, a one-minute backoff, a 30-second pass, ten exports per pass); 30 minutes is well past a busy
--     queue and still inside the hour. It also catches an export whose preparation never commits at all (a failure the
--     subtransaction cannot catch rolls the whole pass back, so no attempt is ever counted).
--   * stuck due deletion: SCHEDULED 30 minutes past its final_at. The first pass after final_at (30 seconds) claims it;
--     a crashed pass's lease frees it after five minutes; 30 minutes is six leases.
--   * stuck provider removal: ERASED for 30 minutes. Every pass retries the removal under the same five-minute lease.
--   * recent export failure: a failed attempt in the last 24 hours.
BEGIN;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Database readiness.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_database_ready_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT true $$;

ALTER FUNCTION public.server_database_ready_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.server_database_ready_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_database_ready_v1() TO service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Export failure classification.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE personal_data_private.data_exports
    ADD COLUMN failure_class text,
    ADD COLUMN last_failure_at timestamptz,
    ADD CONSTRAINT data_exports_failure_class_check CHECK (failure_class IS NULL OR failure_class IN
        ('TRANSIENT_DATABASE', 'CONSTRAINT_OR_INTEGRITY', 'RESOURCE_OR_CAPACITY', 'INTERNAL_OTHER')),
    ADD CONSTRAINT data_exports_failure_shape CHECK ((failure_class IS NULL) = (last_failure_at IS NULL)),
    ADD CONSTRAINT data_exports_failure_only_unready CHECK (failure_class IS NULL OR status IN ('PREPARING', 'FAILED'));
CREATE INDEX data_exports_failed ON personal_data_private.data_exports (last_failure_at) WHERE status = 'FAILED';
CREATE INDEX data_exports_recent_failure ON personal_data_private.data_exports (last_failure_at) WHERE failure_class IS NOT NULL;

-- The closed class of one failed preparation, from the SQLSTATE class only. Never stored, never returned: only its
-- class is. Unknown classes are INTERNAL_OTHER.
CREATE FUNCTION personal_data_private.export_failure_class_v1(p_sqlstate text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT CASE
        WHEN pg_catalog.left(p_sqlstate, 2) IN ('08', '40', '57', '58') OR p_sqlstate IN ('55P03', '55006') THEN 'TRANSIENT_DATABASE'
        WHEN pg_catalog.left(p_sqlstate, 2) IN ('22', '23', '27', '44') THEN 'CONSTRAINT_OR_INTEGRITY'
        WHEN pg_catalog.left(p_sqlstate, 2) IN ('53', '54') THEN 'RESOURCE_OR_CAPACITY'
        ELSE 'INTERNAL_OTHER'
    END
$$;
ALTER FUNCTION personal_data_private.export_failure_class_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION personal_data_private.export_failure_class_v1(text) FROM PUBLIC, anon, authenticated;
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION personal_data_private.export_failure_class_v1(text) FROM service_role';
  END IF;
END$$;

-- 0130's preparation pass, redefined in place. Only the marked additions differ.
CREATE OR REPLACE FUNCTION personal_data_private.prepare_data_exports_v1(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_export personal_data_private.data_exports;
    v_prepared integer := 0;
    v_sqlstate text;
BEGIN
    UPDATE personal_data_private.data_exports e
       SET status = 'EXPIRED', content = NULL
     WHERE e.status = 'READY' AND e.available_until <= clock_timestamp();

    FOR v_export IN
        SELECT * FROM personal_data_private.data_exports e
         WHERE e.status = 'PREPARING' AND (e.lease_until IS NULL OR e.lease_until <= clock_timestamp())
         ORDER BY e.requested_at, e.id
         LIMIT greatest(1, least(coalesce(p_limit, 1), 20))
           FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE personal_data_private.data_exports e
           SET attempt_count = e.attempt_count + 1, lease_until = clock_timestamp() + interval '5 minutes'
         WHERE e.id = v_export.id;
        BEGIN
            -- PROD-OPS-01: a success also clears any stale failure classification.
            UPDATE personal_data_private.data_exports e
               SET status = 'READY',
                   content = personal_data_private.build_personal_export_v1(e.user_id),
                   prepared_at = clock_timestamp(),
                   available_until = clock_timestamp() + interval '7 days',
                   lease_until = NULL,
                   failure_class = NULL,
                   last_failure_at = NULL
             WHERE e.id = v_export.id;
            v_prepared := v_prepared + 1;
        EXCEPTION WHEN OTHERS THEN
            -- PROD-OPS-01: record the closed class of this failure and when it happened; never its SQLSTATE or text.
            GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
            UPDATE personal_data_private.data_exports e
               SET status = CASE WHEN e.attempt_count >= 3 THEN 'FAILED' ELSE 'PREPARING' END,
                   lease_until = CASE WHEN e.attempt_count >= 3 THEN NULL ELSE clock_timestamp() + interval '1 minute' END,
                   failure_class = personal_data_private.export_failure_class_v1(v_sqlstate),
                   last_failure_at = clock_timestamp()
             WHERE e.id = v_export.id;
        END;
    END LOOP;
    RETURN v_prepared;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The aggregate privacy operations summary (service role only). Counts and ages in whole seconds; no identity.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_privacy_operations_summary_v1()
RETURNS TABLE (
    export_preparing integer,
    export_retrying integer,
    export_stuck_preparing integer,
    export_stuck_preparing_oldest_age_seconds bigint,
    export_failed_total integer,
    export_failed_recent integer,
    export_recent_failures_transient_database integer,
    export_recent_failures_constraint_or_integrity integer,
    export_recent_failures_resource_or_capacity integer,
    export_recent_failures_internal_other integer,
    deletion_stuck_due integer,
    deletion_stuck_due_oldest_age_seconds bigint,
    deletion_stuck_provider_pending integer,
    deletion_stuck_provider_pending_oldest_age_seconds bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH bounds AS (
        SELECT pg_catalog.now() AS at,
               pg_catalog.now() - interval '30 minutes' AS stuck_before,
               pg_catalog.now() - interval '24 hours' AS recent_after
    ),
    preparing AS (
        SELECT pg_catalog.count(*)::integer AS total,
               (pg_catalog.count(*) FILTER (WHERE e.failure_class IS NOT NULL))::integer AS retrying,
               (pg_catalog.count(*) FILTER (WHERE e.requested_at <= b.stuck_before))::integer AS stuck,
               pg_catalog.min(e.requested_at) FILTER (WHERE e.requested_at <= b.stuck_before) AS stuck_oldest
          FROM personal_data_private.data_exports e CROSS JOIN bounds b
         WHERE e.status = 'PREPARING'
    ),
    failed AS (
        SELECT pg_catalog.count(*)::integer AS total,
               (pg_catalog.count(*) FILTER (WHERE e.last_failure_at > b.recent_after))::integer AS recent
          FROM personal_data_private.data_exports e CROSS JOIN bounds b
         WHERE e.status = 'FAILED'
    ),
    recent AS (
        SELECT (pg_catalog.count(*) FILTER (WHERE e.failure_class = 'TRANSIENT_DATABASE'))::integer AS transient_database,
               (pg_catalog.count(*) FILTER (WHERE e.failure_class = 'CONSTRAINT_OR_INTEGRITY'))::integer AS constraint_or_integrity,
               (pg_catalog.count(*) FILTER (WHERE e.failure_class = 'RESOURCE_OR_CAPACITY'))::integer AS resource_or_capacity,
               (pg_catalog.count(*) FILTER (WHERE e.failure_class = 'INTERNAL_OTHER'))::integer AS internal_other
          FROM personal_data_private.data_exports e CROSS JOIN bounds b
         WHERE e.failure_class IS NOT NULL AND e.last_failure_at > b.recent_after
    ),
    due AS (
        SELECT pg_catalog.count(*)::integer AS stuck, pg_catalog.min(d.final_at) AS oldest
          FROM personal_data_private.account_deletions d CROSS JOIN bounds b
         WHERE d.status = 'SCHEDULED' AND d.final_at <= b.stuck_before
    ),
    provider_pending AS (
        SELECT pg_catalog.count(*)::integer AS stuck, pg_catalog.min(d.erased_at) AS oldest
          FROM personal_data_private.account_deletions d CROSS JOIN bounds b
         WHERE d.status = 'ERASED' AND d.erased_at <= b.stuck_before
    )
    SELECT p.total, p.retrying, p.stuck,
           COALESCE(pg_catalog.floor(EXTRACT(EPOCH FROM (b.at - p.stuck_oldest)))::bigint, 0),
           f.total, f.recent,
           r.transient_database, r.constraint_or_integrity, r.resource_or_capacity, r.internal_other,
           du.stuck, COALESCE(pg_catalog.floor(EXTRACT(EPOCH FROM (b.at - du.oldest)))::bigint, 0),
           pp.stuck, COALESCE(pg_catalog.floor(EXTRACT(EPOCH FROM (b.at - pp.oldest)))::bigint, 0)
      FROM bounds b, preparing p, failed f, recent r, due du, provider_pending pp
$$;

ALTER FUNCTION public.server_read_privacy_operations_summary_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.server_read_privacy_operations_summary_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_read_privacy_operations_summary_v1() TO service_role;

COMMIT;
