-- 0200 — COSMOS E-2 corrections, the Reading statement (Product Owner directive "COMPLETE ALL CORRECTIONS BEFORE FINAL
--        CI", 2026-11-21, approving contract §31.9.2 (a)): the Personal historical projection discloses a Reading's own
--        words exactly when QANDEEL may rely on it (PG-02 / INTEL-TM-01, 0151).
--
-- Why
--   The historical projection (0072, unchanged by every later definition) emits each Reading's `statement`,
--   `assumptions` and `disconfirmingConditions` with no reliance filter. Every other surface withholds a Hypothesis
--   whose evidence changed (`hypothesis_evidence_change_core_v1` <> 'NONE': REVIEW_PENDING, NO_REMAINING_SUPPORT) —
--   "a statement is shown exactly when QANDEEL may rely on it. A withheld item carries no statement" (Understanding,
--   CC-2). Showing the projection's statement in the COSMOS Reading PEEK would therefore show what PG-02 withholds.
--
-- What this migration does (forward-only; nothing is dropped; no table is touched)
--   `public.get_session_historical_projection_v2(p_session_id, p_tc)` (0198) is REPLACED with the same signature, the
--   same row shape and the same Thread enrichment, and ONE added law on two columns:
--     readings     every Reading carries `evidenceChange` — the reliance of the caller's own Hypothesis row whose
--                  statement the projection discloses (the same row, so the same version), evaluated by the 0151 core
--                  and nothing else. 'NONE': the Reading is V1's, unchanged. Otherwise its own words are withheld
--                  SERVER-SIDE: `statement` null, `assumptions` and `disconfirmingConditions` empty; its identity,
--                  type, domain, scope, origin, status and version at TC, lineage and subject groundings stay (the
--                  historical truth that the Reading existed, and how it moved, is not erased). A Reading whose
--                  Hypothesis row cannot be found for the caller is withheld as REVIEW_PENDING (fail closed).
--     confidences  the Confidence of a withheld Reading keeps its codes, ids and resolution and carries no
--                  `assumptions` (its reader's context, CC-2). Confidence is never recomputed.
--   Everything else — visibility, coverage, sealing, TC, refusals, every other column — is V1's, re-derived nowhere.
--   The frozen V1 (`get_session_historical_projection_v1`, 0072) is NOT replaced, so a Replay moment (0169, which
--   reads V1 under its digest) is byte-identical; Replay is out of this correction's scope (recorded in the contract).
--   The function stays SECURITY DEFINER, postgres-owned, search_path-pinned, EXECUTE to `authenticated` only.
--
-- Not authorised: hosted deployment. This file is verified locally and in CI (verify-migration-0200.mjs) only.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_session_historical_projection_v2(p_session_id uuid, p_tc integer)
RETURNS TABLE(
  session_id uuid,
  live_head integer,
  tc integer,
  sealed boolean,
  revision jsonb,
  moments jsonb,
  emerging_focuses jsonb,
  live_focus jsonb,
  threads jsonb,
  thread_reading_appearances jsonb,
  readings jsonb,
  reading_relations jsonb,
  evidence_participations jsonb,
  materials jsonb,
  gaps jsonb,
  questions jsonb,
  question_appearances jsonb,
  confidences jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  -- V1 decides visibility, coverage, sealing and every rung; it refuses exactly as before. Nothing is re-derived.
  RETURN QUERY
  SELECT v.session_id, v.live_head, v.tc, v.sealed, v.revision, v.moments, v.emerging_focuses, v.live_focus,
         (SELECT coalesce(jsonb_agg(
                   e.value || jsonb_build_object(
                     'name',
                       CASE
                         WHEN al.alias IS NOT NULL THEN jsonb_build_object('text', al.alias, 'source', 'USER_ALIAS')
                         WHEN gw.wording IS NOT NULL THEN jsonb_build_object('text', gw.wording, 'source', 'GROUNDING_WORDING')
                         ELSE jsonb_build_object('text', NULL, 'source', 'NONE')
                       END,
                     'origin', jsonb_build_object('sessionId', t.established_session_id, 'sp', t.established_sp)
                   ) ORDER BY e.ordinality), '[]'::jsonb)
            FROM jsonb_array_elements(v.threads) WITH ORDINALITY AS e(value, ordinality)
            JOIN public.conversation_threads t ON t.id = (e.value ->> 'id')::uuid AND t.user_id = caller
            LEFT JOIN LATERAL (
              SELECT a.alias FROM public.conversation_thread_aliases a
               WHERE a.thread_id = t.id AND a.user_id = caller
               ORDER BY a.id DESC LIMIT 1
            ) al ON true
            LEFT JOIN LATERAL (
              SELECT left(btrim(regexp_replace(r.anchor_text, '\s+', ' ', 'g')), 80) AS wording
                FROM public.conversation_emerging_focuses f
                JOIN public.conversation_reference_resolutions r
                  ON r.resolved_handle_id = f.grounding_handle_id AND r.session_id = f.session_id
               WHERE f.id = t.grounding_emerging_focus_id
                 AND r.session_position <= t.established_sp
                 AND btrim(r.anchor_text) <> ''
               ORDER BY r.session_position, r.same_sp_event_sequence, r.reference_index
               LIMIT 1
            ) gw ON true
         ) AS threads,
         v.thread_reading_appearances,
         gated.readings,
         v.reading_relations, v.evidence_participations, v.materials, v.gaps, v.questions, v.question_appearances,
         gated.confidences
    FROM public.get_session_historical_projection_v1(p_session_id, p_tc) v
   CROSS JOIN LATERAL (
     WITH reliance AS MATERIALIZED (
       SELECT DISTINCT e.value ->> 'id' AS reading_id,
              coalesce((SELECT public.hypothesis_evidence_change_core_v1(
                                 h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP)
                          FROM public.hypotheses h
                         WHERE h.id = (e.value ->> 'id')::uuid AND h.user_id = caller), 'REVIEW_PENDING') AS change
         FROM jsonb_array_elements(v.readings) AS e(value)
     )
     SELECT
       (SELECT coalesce(jsonb_agg(
                 CASE WHEN r.change = 'NONE'
                      THEN e.value || jsonb_build_object('evidenceChange', 'NONE')
                      ELSE e.value || jsonb_build_object(
                             'statement', NULL, 'assumptions', '[]'::jsonb, 'disconfirmingConditions', '[]'::jsonb,
                             'evidenceChange', r.change)
                 END ORDER BY e.ordinality), '[]'::jsonb)
          FROM jsonb_array_elements(v.readings) WITH ORDINALITY AS e(value, ordinality)
          JOIN reliance r ON r.reading_id = e.value ->> 'id') AS readings,
       (SELECT coalesce(jsonb_agg(
                 CASE WHEN r.change = 'NONE' THEN c.value
                      ELSE c.value || jsonb_build_object('assumptions', '[]'::jsonb)
                 END ORDER BY c.ordinality), '[]'::jsonb)
          FROM jsonb_array_elements(v.confidences) WITH ORDINALITY AS c(value, ordinality)
          LEFT JOIN reliance r ON r.reading_id = c.value ->> 'targetReadingId') AS confidences
   ) gated;
END;
$$;

-- CREATE OR REPLACE keeps the owner and the ACL; both are restated so the posture never depends on that.
ALTER FUNCTION public.get_session_historical_projection_v2(uuid, integer) OWNER TO postgres;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.get_session_historical_projection_v2(uuid, integer) FROM PUBLIC, anon, authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.get_session_historical_projection_v2(uuid, integer) FROM service_role;
  END IF;
  GRANT EXECUTE ON FUNCTION public.get_session_historical_projection_v2(uuid, integer) TO authenticated;
END
$$;

-- Self-assertions: the migration proves its own posture before it commits.
DO $$
DECLARE
  fn constant text := 'public.get_session_historical_projection_v2(uuid, integer)';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = fn::regprocedure AND p.prosecdef
       AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
       AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION '0200: % must be SECURITY DEFINER, owned by postgres, with a pinned search_path', fn;
  END IF;
  IF has_function_privilege('anon', fn, 'EXECUTE') THEN
    RAISE EXCEPTION '0200: anon must not execute %', fn;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND has_function_privilege('service_role', fn, 'EXECUTE') THEN
    RAISE EXCEPTION '0200: service_role must not execute %', fn;
  END IF;
  IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION '0200: authenticated must execute %', fn;
  END IF;
  IF (SELECT pg_get_function_result(fn::regprocedure))
     IS DISTINCT FROM
     (SELECT pg_get_function_result('public.get_session_historical_projection_v1(uuid, integer)'::regprocedure)) THEN
    RAISE EXCEPTION '0200: V2 must return the V1 row shape';
  END IF;
  IF position('hypothesis_evidence_change_core_v1' IN (SELECT prosrc FROM pg_proc WHERE oid = fn::regprocedure)) = 0 THEN
    RAISE EXCEPTION '0200: V2 must gate each Reading through the 0151 reliance core';
  END IF;
END
$$;

COMMIT;
