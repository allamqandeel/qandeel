-- W3-MEGA-U U2 — QANDEEL Understanding: the "talk to QANDEEL about this" discussion focus (E2E-D-14).
--
-- P1 §11.4: each QANDEEL Understanding item offers a route to "talk to QANDEEL about this". It is not a field
-- editor: the reader returns to their Conversation and says what they want. For QANDEEL to know WHICH item the
-- reader chose to talk about, the explicit act is recorded here as a bounded, owner-only fact: one current
-- discussion focus per reader — which item, at which exact version, since when, and whether the reader closed it.
--
-- It carries no conversation content, no reasoning, no score and no statement text; it is a pointer to the
-- reader's own Hypothesis row, owner-scoped by a composite foreign key so it can never name another tenant's.
-- The provider-facing Hypothesis reasoning context reads it (owner RLS, the caller's own token) and marks that one
-- item as the one the reader opened from QANDEEL Understanding, for a bounded window only.
--
-- ## The privilege boundary (the W3-02 rule)
--
-- A SECURITY DEFINER function never lives in an exposed schema. The two privileged commands live in
-- `understanding_private`, created here and exposed nowhere; the two Product functions in `public` are SECURITY
-- INVOKER pass-throughs. `authenticated` gets USAGE on the schema and EXECUTE on exactly those two commands, and
-- only SELECT (own rows, RLS) on the table: no client role can INSERT, UPDATE or DELETE it.
--
-- Additive and forward-only. One schema, one table, four functions. Migrations 0001–0125 are untouched.
BEGIN;

CREATE SCHEMA understanding_private;
REVOKE ALL ON SCHEMA understanding_private FROM PUBLIC;

CREATE TABLE public.understanding_discussion_focus (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  hypothesis_id uuid NOT NULL,
  hypothesis_version integer NOT NULL,
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  CONSTRAINT understanding_discussion_focus_owner_fk FOREIGN KEY (hypothesis_id, user_id)
    REFERENCES public.hypotheses(id, user_id) ON DELETE CASCADE,
  CONSTRAINT understanding_discussion_focus_version_check CHECK (hypothesis_version > 0),
  CONSTRAINT understanding_discussion_focus_closed_check CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

ALTER TABLE public.understanding_discussion_focus OWNER TO postgres;
ALTER TABLE public.understanding_discussion_focus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.understanding_discussion_focus FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.understanding_discussion_focus TO authenticated;
CREATE POLICY understanding_discussion_focus_select_own ON public.understanding_discussion_focus
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Open (or move) the reader's ONE discussion focus onto one of their own CURRENT items, at the exact version the
-- reader saw. The answer is a bounded word, never an error the caller must parse:
--   OPENED     the focus now names this item at this version;
--   STALE      the item changed since the reader saw it — nothing was written; the caller reads it again;
--   NOT_FOUND  not one of the caller's current items (another reader's, withdrawn, or none) — nothing was written.
-- The item row is locked FOR SHARE so its version cannot move between the check and the write.
CREATE FUNCTION understanding_private.open_understanding_discussion_v1(p_hypothesis_id uuid, p_expected_version integer)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_item public.hypotheses;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
  END IF;
  IF p_hypothesis_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'UNDERSTANDING_DISCUSSION_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_item FROM public.hypotheses h
   WHERE h.id = p_hypothesis_id AND h.user_id = v_user
   FOR SHARE;
  IF NOT FOUND OR v_item.status NOT IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN
    RETURN 'NOT_FOUND';
  END IF;
  IF v_item.version <> p_expected_version THEN
    RETURN 'STALE';
  END IF;
  INSERT INTO public.understanding_discussion_focus (user_id, hypothesis_id, hypothesis_version, opened_at, closed_at)
  VALUES (v_user, v_item.id, v_item.version, clock_timestamp(), NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET hypothesis_id = EXCLUDED.hypothesis_id,
        hypothesis_version = EXCLUDED.hypothesis_version,
        opened_at = EXCLUDED.opened_at,
        closed_at = NULL;
  RETURN 'OPENED';
END;
$$;

-- Close the reader's discussion focus, but only if it still names THIS item: closing an old context can never
-- close a newer one the reader opened since. CLOSED, or NONE when there was nothing open for this item.
CREATE FUNCTION understanding_private.close_understanding_discussion_v1(p_hypothesis_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
  END IF;
  IF p_hypothesis_id IS NULL THEN
    RAISE EXCEPTION 'UNDERSTANDING_DISCUSSION_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE public.understanding_discussion_focus f
     SET closed_at = clock_timestamp()
   WHERE f.user_id = v_user AND f.hypothesis_id = p_hypothesis_id AND f.closed_at IS NULL;
  RETURN CASE WHEN FOUND THEN 'CLOSED' ELSE 'NONE' END;
END;
$$;

-- The Product boundary on the Data API: INVOKER pass-throughs. The caller is still only `auth.uid()`.
CREATE FUNCTION public.open_understanding_discussion_v1(p_hypothesis_id uuid, p_expected_version integer)
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT understanding_private.open_understanding_discussion_v1(p_hypothesis_id, p_expected_version);
$$;

CREATE FUNCTION public.close_understanding_discussion_v1(p_hypothesis_id uuid)
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT understanding_private.close_understanding_discussion_v1(p_hypothesis_id);
$$;

-- Default-deny, by name (a per-schema default privilege cannot withdraw PostgreSQL's global PUBLIC EXECUTE).
REVOKE ALL ON FUNCTION understanding_private.open_understanding_discussion_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION understanding_private.close_understanding_discussion_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_understanding_discussion_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_understanding_discussion_v1(uuid) FROM PUBLIC, anon, authenticated;
-- The server channel needs none of this: the API acts on the CALLER's token.
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON SCHEMA understanding_private FROM service_role';
  EXECUTE 'REVOKE ALL ON TABLE public.understanding_discussion_focus FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION understanding_private.open_understanding_discussion_v1(uuid, integer), understanding_private.close_understanding_discussion_v1(uuid), public.open_understanding_discussion_v1(uuid, integer), public.close_understanding_discussion_v1(uuid) FROM service_role';
END IF; END$$;
GRANT USAGE ON SCHEMA understanding_private TO authenticated;
GRANT EXECUTE ON FUNCTION understanding_private.open_understanding_discussion_v1(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION understanding_private.close_understanding_discussion_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_understanding_discussion_v1(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_understanding_discussion_v1(uuid) TO authenticated;

COMMIT;
