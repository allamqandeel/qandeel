-- Finding 04 - Hypothesis Authority Forgery Hardening v1.
--
-- Before this migration, `authenticated` held direct INSERT on public.hypotheses
-- (migration 0005) behind an RLS policy that only proved
-- `user_id = auth.uid()`. That is tenant isolation, not Hypothesis authority: an
-- authenticated client could bypass the application runtime and manufacture an
-- owned Hypothesis while choosing every server-significant field the table
-- accepts - origin (including SYSTEM_GENERATED / HUMAN_REVIEWED /
-- ADMIN_CONTROLLED), a non-CANDIDATE status such as SUPPORTED, an arbitrary
-- positive version, supporting and contradicting Evidence identifiers,
-- competing Hypothesis identifiers, assumptions, disconfirming conditions and
-- both lifecycle timestamps. The table constraints bound shape and vocabulary,
-- but they never established that the server authorized those authoritative
-- values, so a client could manufacture an apparently canonical Hypothesis that
-- downstream reasoning, association, Confidence and Human Model paths then
-- treat as authoritative.
--
-- This forward-only migration makes Hypothesis creation server-only:
--   * authenticated keeps owner-scoped SELECT and loses direct INSERT; UPDATE
--     and DELETE were never granted and stay unavailable;
--   * the permissive INSERT RLS policy is dropped so privilege drift cannot
--     silently reactivate a direct client write path; the owner read policy
--     (hypotheses_select_own) is retained unchanged;
--   * the server REST role keeps the direct SELECT the background intelligence
--     read path relies on but loses direct INSERT/UPDATE/DELETE, so possession
--     of the privileged API role is not arbitrary table-mutation authority;
--   * legitimate internal creation moves to one narrow purpose-specific
--     SECURITY DEFINER command that validates the owner and the canonical
--     vocabulary explicitly and derives every authoritative column in the
--     database. It changes who may create a Hypothesis, not what a legitimate
--     internal creation may do: the canonical creation semantics of
--     HypothesisService.create are preserved exactly.
--
-- Scope discipline: the existing constrained mutation commands
-- (transition_hypothesis, attach_hypothesis_evidence,
-- link_competing_hypotheses, apply_hypothesis_evidence_update) and the
-- service-only migration-0021 background commands are deliberately left
-- untouched - their authority and Evidence semantics intersect other audited
-- boundaries. Existing Hypothesis rows are not read, rewritten or
-- reinterpreted: this is authority hardening, not historical data repair, and
-- migration 0005's historical text is left as written.

BEGIN;

-- 1. Table authority. No role may create, rewrite or remove a Hypothesis row
--    directly any more. Clients keep the owner-scoped read used by Hypothesis
--    retrieval, reasoning context and Confidence; the server REST role keeps
--    SELECT for the background intelligence read path. Every write flows
--    through a narrow database command: the creation command added below, or
--    the pre-existing constrained mutation commands, which are unchanged.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.hypotheses FROM authenticated;
REVOKE ALL ON TABLE public.hypotheses FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.hypotheses TO authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.hypotheses FROM service_role';
  EXECUTE 'GRANT SELECT ON TABLE public.hypotheses TO service_role';
END IF;END$$;

-- 2. Remove the obsolete permissive INSERT policy. It now advertises an
--    authority that has no legitimate write path behind it, and leaving it in
--    place would let a future GRANT silently re-open direct client creation.
--    The owner-scoped read policy is retained unchanged.
DROP POLICY IF EXISTS hypotheses_insert_own ON public.hypotheses;

-- 3. Canonical structured-text guard for the creation command. It repeats the
--    assumption / disconfirming-condition bounds deliberately: the server
--    command must fail closed on malformed trusted input and return the
--    canonically trimmed values it will store, rather than depend only on the
--    table CHECK constraints. It reads no rows, mutates nothing, and is
--    SECURITY INVOKER so it can never itself be an authority escalation.
CREATE FUNCTION public.assert_canonical_hypothesis_text_array_v1(
  p_values text[], p_max_count integer, p_max_length integer
) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE canonical text[] := ARRAY[]::text[]; item text;
BEGIN
  IF p_values IS NULL OR array_ndims(p_values) > 1 THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_STRUCTURED_TEXT' USING ERRCODE='22023'; END IF;
  IF cardinality(p_values) > p_max_count THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_STRUCTURED_TEXT' USING ERRCODE='22023'; END IF;
  FOREACH item IN ARRAY p_values LOOP
    IF item IS NULL THEN
      RAISE EXCEPTION 'INVALID_HYPOTHESIS_STRUCTURED_TEXT' USING ERRCODE='22023'; END IF;
    item := btrim(item);
    IF length(item) = 0 OR length(item) > p_max_length THEN
      RAISE EXCEPTION 'INVALID_HYPOTHESIS_STRUCTURED_TEXT' USING ERRCODE='22023'; END IF;
    -- Uniqueness is judged after canonical trimming, so two entries that differ
    -- only in surrounding whitespace are one assumption, not two.
    IF item = ANY(canonical) THEN
      RAISE EXCEPTION 'INVALID_HYPOTHESIS_STRUCTURED_TEXT' USING ERRCODE='22023'; END IF;
    canonical := array_append(canonical, item);
  END LOOP;
  RETURN canonical;
END;$$;

-- 4. Server-only Hypothesis creation. The caller is trusted internal code, so
--    the canonical semantic values a legitimate creation is allowed to choose
--    (statement / type / domain / scope / origin / assumptions / disconfirming
--    conditions) are accepted, but the owner is verified, the vocabulary is
--    re-enforced here rather than trusted, and every authoritative column a
--    client previously could forge is derived: status, version, both Evidence
--    lists, the competitor list and both timestamps. Origin remains provenance
--    only and is never reachable from an authenticated direct write. The
--    canonical Hypothesis UUID is supplied by the runtime and returned
--    unchanged so downstream identity stays exact; a duplicate identifier fails
--    atomically on the primary key, and ownership can never be transferred
--    because there is no update path here at all.
CREATE FUNCTION public.server_create_hypothesis_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_statement text, p_type text, p_domain text,
  p_scope text, p_origin text, p_assumptions text[], p_disconfirming_conditions text[]
) RETURNS SETOF public.hypotheses
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE new_row public.hypotheses; canonical_statement text; canonical_scope text;
BEGIN
  IF p_user_id IS NULL OR p_hypothesis_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_IDENTITY' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_type IS NULL OR p_type NOT IN (
    'CAUSAL','BEHAVIORAL','MOTIVATIONAL','SITUATIONAL','RELATIONAL','DECISION','PREDICTIVE','INTERPRETIVE','STRATEGIC'
  ) THEN RAISE EXCEPTION 'INVALID_HYPOTHESIS_TYPE' USING ERRCODE='22023'; END IF;
  IF p_domain IS NULL OR p_domain NOT IN (
    'GENERAL','RELATIONSHIP','WORK','DECISION','GOAL','INTERACTION'
  ) THEN RAISE EXCEPTION 'INVALID_HYPOTHESIS_DOMAIN' USING ERRCODE='22023'; END IF;
  IF p_origin IS NULL OR p_origin NOT IN (
    'SYSTEM_GENERATED','HUMAN_REVIEWED','USER_PROPOSED','ADMIN_CONTROLLED'
  ) THEN RAISE EXCEPTION 'INVALID_HYPOTHESIS_ORIGIN' USING ERRCODE='22023'; END IF;
  canonical_statement := btrim(coalesce(p_statement,''));
  IF length(canonical_statement) = 0 OR length(canonical_statement) > 2000 THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_STATEMENT' USING ERRCODE='22023'; END IF;
  canonical_scope := btrim(coalesce(p_scope,''));
  IF length(canonical_scope) = 0 OR length(canonical_scope) > 500 THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_SCOPE' USING ERRCODE='22023'; END IF;
  INSERT INTO public.hypotheses(
    id, user_id, statement, type, domain, scope, origin, status, version,
    supporting_evidence_ids, contradicting_evidence_ids, competing_hypothesis_ids,
    assumptions, disconfirming_conditions, created_at, updated_at
  ) VALUES (
    p_hypothesis_id, p_user_id, canonical_statement, p_type, p_domain, canonical_scope, p_origin, 'CANDIDATE', 1,
    '{}', '{}', '{}',
    public.assert_canonical_hypothesis_text_array_v1(p_assumptions, 8, 500),
    public.assert_canonical_hypothesis_text_array_v1(p_disconfirming_conditions, 8, 500),
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) RETURNING * INTO new_row;
  RETURN NEXT new_row;
END;$$;

-- 5. Ownership, fixed search_path posture, and least-privilege ACLs. The
--    creation command and its guard are server-only: PUBLIC, anon and
--    authenticated hold no EXECUTE, and only the server REST role can run the
--    command. No arbitrary-column Hypothesis mutation RPC is introduced, and no
--    role regains direct table write.
ALTER FUNCTION public.server_create_hypothesis_v1(uuid,uuid,text,text,text,text,text,text[],text[]) OWNER TO postgres;
ALTER FUNCTION public.assert_canonical_hypothesis_text_array_v1(text[],integer,integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.server_create_hypothesis_v1(uuid,uuid,text,text,text,text,text,text[],text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.assert_canonical_hypothesis_text_array_v1(text[],integer,integer) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION
  public.server_create_hypothesis_v1(uuid,uuid,text,text,text,text,text,text[],text[])
  TO service_role;

COMMIT;
