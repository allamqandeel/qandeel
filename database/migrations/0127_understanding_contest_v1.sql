-- W3-MEGA-U U3 — QANDEEL Understanding: explicit user disagreement → Contested / Under Review (E2E-D-15, PG-01).
--
-- P1 §11.4 froze the Product rule: an EXPLICIT disagreement with an Understanding item makes it contested / under
-- review and causes re-evaluation; it does not delete the item. I-08A4 §18 named the runtime gap `PG-01 — User
-- Interpretive Disagreement / Contested Reliance`. This migration is that runtime, and nothing more:
--
--   1. a durable, immutable, owner-only contest record — which item, which EXACT version the reader disagreed with,
--      under which command identity, when, and what the re-evaluation did. It stores no conversation text, no
--      reasoning and no score;
--   2. ONE atomic command that, bound to the exact version the reader saw, records the contest and performs the
--      re-evaluation's lifecycle step through the EXISTING audited lifecycle core (migration 0036): a current
--      ACTIVE / SUPPORTED / WEAK interpretation becomes MIXED — a transition the frozen graph already allows — so a
--      new version and a lifecycle audit row exist; one that is already MIXED keeps its version. The Hypothesis is
--      never deleted, rejected or rewritten; its statement, Evidence, assumptions and alternatives are untouched, and
--      its history is preserved (0072 captures the transition).
--
-- Contest lifecycle v1 is exactly one state, UNDER_REVIEW. What would resolve a contest beyond this re-evaluation is
-- not defined by any Product authority, so a contest stays under review rather than pretending to be resolved. A
-- provider restating the interpretation cannot clear it: nothing but a later, lawful migration could.
--
-- The fresh exact-version Confidence evaluation (Confidence Runtime, migration 0006) runs after this transaction, from
-- the API, against the returned after_version — never against a later version.
--
-- ## The privilege boundary (the W3-02 rule)
--
-- The command is SECURITY DEFINER in the non-exposed `understanding_private` (migration 0126); the `public` function of
-- the same name is a SECURITY INVOKER pass-through. `authenticated` may SELECT its own contests (RLS) and EXECUTE the
-- two functions; no client role may INSERT, UPDATE or DELETE a contest, and no caller supplies an owner.
--
-- Additive and forward-only. One table, one partial unique index, two functions. Migrations 0001–0126 are untouched.
BEGIN;

CREATE TABLE public.understanding_contests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hypothesis_id uuid NOT NULL,
  command_id uuid NOT NULL,
  contested_version integer NOT NULL,
  lifecycle text NOT NULL,
  reevaluation_before_status text NOT NULL,
  reevaluation_after_status text NOT NULL,
  reevaluation_after_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT understanding_contests_owner_fk FOREIGN KEY (hypothesis_id, user_id)
    REFERENCES public.hypotheses(id, user_id) ON DELETE CASCADE,
  CONSTRAINT understanding_contests_command_key UNIQUE (user_id, command_id),
  CONSTRAINT understanding_contests_lifecycle_check CHECK (lifecycle IN ('UNDER_REVIEW')),
  CONSTRAINT understanding_contests_version_check CHECK (
    contested_version > 0 AND reevaluation_after_version >= contested_version
    AND reevaluation_after_version <= contested_version + 1),
  CONSTRAINT understanding_contests_reevaluation_check CHECK (
    reevaluation_before_status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') AND reevaluation_after_status = 'MIXED'
    AND (reevaluation_before_status = 'MIXED') = (reevaluation_after_version = contested_version))
);

-- At most ONE contest under review per item: a second disagreement, concurrent or later, can never double-mutate.
CREATE UNIQUE INDEX understanding_contests_one_under_review_idx
  ON public.understanding_contests (user_id, hypothesis_id) WHERE lifecycle = 'UNDER_REVIEW';

ALTER TABLE public.understanding_contests OWNER TO postgres;
ALTER TABLE public.understanding_contests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.understanding_contests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.understanding_contests TO authenticated;
CREATE POLICY understanding_contests_select_own ON public.understanding_contests
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- The ONE disagreement command. Answers, in one row:
--   RECORDED             this command recorded the contest and performed the re-evaluation step (or it is the same
--                        command replayed: the committed truth is answered again, nothing is repeated);
--   ALREADY_UNDER_REVIEW the item already has a contest under review (another command's): nothing is repeated;
--   STALE                the item changed since the reader saw it — nothing was written; the caller reads it again;
--   NOT_FOUND            not one of the caller's current items — nothing was written;
--   COMMAND_CONFLICT     this command identity was already spent on another item or version — nothing was written.
-- The item row is locked FOR UPDATE first, so concurrent disagreements on one item serialize here, and every later
-- check reads the committed state.
CREATE FUNCTION understanding_private.record_understanding_disagreement_v1(
  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer
) RETURNS TABLE (outcome text, contested_version integer, reevaluated_version integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_item public.hypotheses;
  v_prior public.understanding_contests;
  v_after_version integer;
  v_conflict text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_hypothesis_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'UNDERSTANDING_DISAGREEMENT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item FROM public.hypotheses h
   WHERE h.id = p_hypothesis_id AND h.user_id = v_user
   FOR UPDATE;

  -- The same command again: its committed truth, or a refusal when it now names something else.
  SELECT * INTO v_prior FROM public.understanding_contests c
   WHERE c.user_id = v_user AND c.command_id = p_command_id;
  IF FOUND THEN
    IF v_prior.hypothesis_id = p_hypothesis_id AND v_prior.contested_version = p_expected_version THEN
      RETURN QUERY SELECT 'RECORDED'::text, v_prior.contested_version, v_prior.reevaluation_after_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::integer, NULL::integer;
    RETURN;
  END IF;

  IF v_item.id IS NULL OR v_item.status NOT IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::integer, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_prior FROM public.understanding_contests c
   WHERE c.user_id = v_user AND c.hypothesis_id = v_item.id AND c.lifecycle = 'UNDER_REVIEW';
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_UNDER_REVIEW'::text, v_prior.contested_version, v_prior.reevaluation_after_version;
    RETURN;
  END IF;

  -- Never applied to a different interpretation than the one the reader disagreed with.
  IF v_item.version <> p_expected_version THEN
    RETURN QUERY SELECT 'STALE'::text, NULL::integer, NULL::integer;
    RETURN;
  END IF;

  -- The re-evaluation's lifecycle step, through the ONE audited lifecycle core, at the exact version, and the contest
  -- record, as ONE unit: the one command identity used at the same instant for another item (which the item lock does
  -- not serialize) meets the command key, and then BOTH are undone and the answer is the bounded COMMAND_CONFLICT —
  -- never a MIXED step without its contest.
  BEGIN
    IF v_item.status = 'MIXED' THEN
      v_after_version := v_item.version;
    ELSE
      SELECT t.version INTO v_after_version
        FROM public.transition_hypothesis_core_v1(v_user, v_item.id, v_item.version, 'MIXED', 'AUTHENTICATED_TRANSITION') t;
      IF v_after_version IS NULL OR v_after_version <> v_item.version + 1 THEN
        RAISE EXCEPTION 'UNDERSTANDING_REEVALUATION_FAILED' USING ERRCODE = '55000';
      END IF;
    END IF;

    INSERT INTO public.understanding_contests (
      id, user_id, hypothesis_id, command_id, contested_version, lifecycle,
      reevaluation_before_status, reevaluation_after_status, reevaluation_after_version, created_at)
    VALUES (
      pg_catalog.gen_random_uuid(), v_user, v_item.id, p_command_id, v_item.version, 'UNDER_REVIEW',
      v_item.status, 'MIXED', v_after_version, clock_timestamp());
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_conflict = CONSTRAINT_NAME;
    IF v_conflict = 'understanding_contests_command_key' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::integer, NULL::integer;
      RETURN;
    END IF;
    RAISE;
  END;

  RETURN QUERY SELECT 'RECORDED'::text, v_item.version, v_after_version;
END;
$$;

CREATE FUNCTION public.record_understanding_disagreement_v1(
  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer
) RETURNS TABLE (outcome text, contested_version integer, reevaluated_version integer)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT r.outcome, r.contested_version, r.reevaluated_version
    FROM understanding_private.record_understanding_disagreement_v1(p_command_id, p_hypothesis_id, p_expected_version) r;
$$;

REVOKE ALL ON FUNCTION understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_understanding_disagreement_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.understanding_contests FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer), public.record_understanding_disagreement_v1(uuid, uuid, integer) FROM service_role';
END IF; END$$;
GRANT EXECUTE ON FUNCTION understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated;

COMMIT;
