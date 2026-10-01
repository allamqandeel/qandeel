-- W3-CORR-U — QANDEEL Understanding Integrity: discussion-focus continuity, contest resolution, withdrawal resolution.
--
-- The Product Owner's binding rule (W3-CORR-U §0): a reader's disagreement is durable history and is never erased.
-- A contest is no longer permanently UNDER_REVIEW: it may make exactly ONE lawful forward move, to RESOLVED, in exactly
-- two v1 cases —
--   1. USER_CONFIRMED_CURRENT_INTERPRETATION — the reader explicitly agrees with the interpretation at the exact version
--      they see (one command identity, one bounded answer). It is the reader's act, never QANDEEL's: stronger system
--      Confidence, a SUPPORTED step or any other lifecycle movement resolves nothing;
--   2. INTERPRETATION_WITHDRAWN — the interpretation itself leaves the current Understanding through a lawful lifecycle
--      transition to REJECTED or RETIRED, so nothing is left to keep under review. It names no reader act and carries no
--      command identity, so it can never be told as "you agreed".
-- Resolution changes NO Hypothesis: no status, no version, no statement, no Evidence and no Confidence. A resolved
-- contest stays durable history; a later disagreement creates a NEW contest and never reopens an old one.
--
-- U-1 — focus continuity. The disagreement command (0127) may move the item v → v+1 (to MIXED). The reader's open
-- discussion focus (0126) on that exact item and version is moved to v+1 IN THE SAME TRANSACTION: only its version
-- changes — `opened_at` (and so the bounded 30-minute window) is preserved, a closed focus is never reopened, no other
-- item's focus moves, and an item already MIXED (no version step) moves nothing. A replay of the command, or an
-- ALREADY_UNDER_REVIEW answer, repairs a still-open stale focus that meets exactly those facts; and this migration
-- repairs, once, the rows that already meet them. No other focus row is touched, and no unrelated Hypothesis update
-- ever slides a focus.
--
-- ## Lock order (one, documented)
--
--   hypotheses row (FOR UPDATE / FOR SHARE)  →  understanding_contests row  →  understanding_discussion_focus row
--
-- The disagreement and resolution commands lock the item FOR UPDATE first; the lifecycle core (0036) holds the same
-- lock when it writes the audit row whose trigger resolves a withdrawn contest; opening a discussion (0126) takes the
-- item FOR SHARE before the focus row; closing one takes only the focus row. Every path therefore acquires in the same
-- order and none can deadlock another, and under READ COMMITTED each guarded UPDATE re-checks its WHERE against the
-- committed row it waited for: a focus closed or moved to another item meanwhile is simply not matched.
--
-- ## The privilege boundary (the W3-02 rule, restated after 0133)
--
-- Every SECURITY DEFINER function lives in the non-exposed `understanding_private`; the `public` Product RPC is a
-- SECURITY INVOKER pass-through. Every grant is stated explicitly: EXECUTE on the two commands to `authenticated`
-- only; nothing to PUBLIC, anon or service_role; the two trigger functions are executable by no role at all. No client
-- role gains any write on either table.
--
-- Forward-only. Migrations 0001–0133 are untouched; 0127's command is redefined in place with its exact signature.
BEGIN;

-- 1. The contest lifecycle: UNDER_REVIEW → RESOLVED, with the minimum durable resolution facts.
ALTER TABLE public.understanding_contests
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolved_version integer,
  ADD COLUMN resolution_reason text,
  ADD COLUMN resolution_command_id uuid;

ALTER TABLE public.understanding_contests DROP CONSTRAINT understanding_contests_lifecycle_check;
ALTER TABLE public.understanding_contests ADD CONSTRAINT understanding_contests_lifecycle_check
  CHECK (lifecycle IN ('UNDER_REVIEW', 'RESOLVED'));

-- An open contest carries no resolution fact; a resolved one carries all of them, after the contest and at or after
-- its re-evaluated version. Only the reader's own confirmation carries a command identity.
ALTER TABLE public.understanding_contests ADD CONSTRAINT understanding_contests_resolution_check CHECK (
  (lifecycle = 'UNDER_REVIEW'
    AND resolved_at IS NULL AND resolved_version IS NULL AND resolution_reason IS NULL AND resolution_command_id IS NULL)
  OR (lifecycle = 'RESOLVED'
    AND resolved_at IS NOT NULL AND resolved_at >= created_at
    AND resolved_version IS NOT NULL AND resolved_version >= reevaluation_after_version
    AND ((resolution_reason = 'USER_CONFIRMED_CURRENT_INTERPRETATION' AND resolution_command_id IS NOT NULL)
      OR (resolution_reason = 'INTERPRETATION_WITHDRAWN' AND resolution_command_id IS NULL))));

-- One resolution command identity resolves at most one contest of its reader.
ALTER TABLE public.understanding_contests ADD CONSTRAINT understanding_contests_resolution_command_key
  UNIQUE (user_id, resolution_command_id);

-- 0127's `understanding_contests_one_under_review_idx` (partial, WHERE lifecycle = 'UNDER_REVIEW') is kept exactly:
-- at most ONE contest under review per reader and item, any number of RESOLVED ones.

-- 2. The move is forward-only and final. A RESOLVED row can never change again — not back to UNDER_REVIEW, not to a
--    different reason, time or version. 0127's facts trigger keeps the original disagreement facts immutable too.
CREATE FUNCTION understanding_private.understanding_contest_lifecycle_forward_only_v1() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.lifecycle = 'RESOLVED' THEN
    RAISE EXCEPTION 'UNDERSTANDING_CONTEST_RESOLUTION_FINAL' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER understanding_contests_lifecycle_forward_only
  BEFORE UPDATE ON public.understanding_contests
  FOR EACH ROW EXECUTE FUNCTION understanding_private.understanding_contest_lifecycle_forward_only_v1();

-- 3. Withdrawal resolution. The ONE place a Hypothesis lifecycle step is recorded is the audit row the lifecycle core
--    (0036) writes in the same transaction as the step; a lawful step to REJECTED or RETIRED resolves that item's
--    contest under review, once. No read is intercepted, the lifecycle core is not redefined, and no other status —
--    ACTIVE, SUPPORTED, MIXED, WEAK, REOPENED — resolves anything: system confidence never overrules the reader.
CREATE FUNCTION understanding_private.resolve_withdrawn_understanding_contest_v1() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.understanding_contests c
     SET lifecycle = 'RESOLVED', resolved_at = clock_timestamp(), resolved_version = NEW.after_version,
         resolution_reason = 'INTERPRETATION_WITHDRAWN'
   WHERE c.user_id = NEW.user_id AND c.hypothesis_id = NEW.hypothesis_id AND c.lifecycle = 'UNDER_REVIEW';
  RETURN NULL;
END;
$$;
CREATE TRIGGER hypothesis_lifecycle_transitions_withdraw_understanding_contest
  AFTER INSERT ON public.hypothesis_lifecycle_transitions
  FOR EACH ROW WHEN (NEW.after_status IN ('REJECTED', 'RETIRED'))
  EXECUTE FUNCTION understanding_private.resolve_withdrawn_understanding_contest_v1();

-- 4. The disagreement command (0127), redefined in place with its exact signature and answers. Everything 0127 froze
--    is kept; the ONLY additions are the U-1 focus rebinding on a fresh record and the bounded repair on a replay or
--    ALREADY_UNDER_REVIEW answer. Each is ONE guarded UPDATE of the caller's own focus row: same reader, same item,
--    still open, still at the contested version — and, for the repair, the item is now exactly at the contest's lawful
--    after-version, one step past the contested one.
CREATE OR REPLACE FUNCTION understanding_private.record_understanding_disagreement_v1(
  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer
) RETURNS TABLE (outcome text, contested_version integer, reevaluated_version integer, confidence_evaluation_id uuid)
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
  v_evaluation uuid := pg_catalog.gen_random_uuid();
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
      -- U-1 repair: a still-open focus left at the contested version, when the item is exactly at the after-version.
      UPDATE public.understanding_discussion_focus f
         SET hypothesis_version = v_prior.reevaluation_after_version
       WHERE f.user_id = v_user AND f.hypothesis_id = v_prior.hypothesis_id AND f.closed_at IS NULL
         AND f.hypothesis_version = v_prior.contested_version
         AND v_prior.reevaluation_after_version = v_prior.contested_version + 1
         AND v_item.version = v_prior.reevaluation_after_version;
      RETURN QUERY SELECT 'RECORDED'::text, v_prior.contested_version, v_prior.reevaluation_after_version, v_prior.confidence_evaluation_id;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::integer, NULL::integer, NULL::uuid;
    RETURN;
  END IF;

  IF v_item.id IS NULL OR v_item.status NOT IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::integer, NULL::integer, NULL::uuid;
    RETURN;
  END IF;

  SELECT * INTO v_prior FROM public.understanding_contests c
   WHERE c.user_id = v_user AND c.hypothesis_id = v_item.id AND c.lifecycle = 'UNDER_REVIEW';
  IF FOUND THEN
    -- U-1 repair, exactly as for a replay.
    UPDATE public.understanding_discussion_focus f
       SET hypothesis_version = v_prior.reevaluation_after_version
     WHERE f.user_id = v_user AND f.hypothesis_id = v_prior.hypothesis_id AND f.closed_at IS NULL
       AND f.hypothesis_version = v_prior.contested_version
       AND v_prior.reevaluation_after_version = v_prior.contested_version + 1
       AND v_item.version = v_prior.reevaluation_after_version;
    RETURN QUERY SELECT 'ALREADY_UNDER_REVIEW'::text, v_prior.contested_version, v_prior.reevaluation_after_version, v_prior.confidence_evaluation_id;
    RETURN;
  END IF;

  -- Never applied to a different interpretation than the one the reader disagreed with.
  IF v_item.version <> p_expected_version THEN
    RETURN QUERY SELECT 'STALE'::text, NULL::integer, NULL::integer, NULL::uuid;
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
      reevaluation_before_status, reevaluation_after_status, reevaluation_after_version, confidence_evaluation_id, created_at)
    VALUES (
      pg_catalog.gen_random_uuid(), v_user, v_item.id, p_command_id, v_item.version, 'UNDER_REVIEW',
      v_item.status, 'MIXED', v_after_version, v_evaluation, clock_timestamp());
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_conflict = CONSTRAINT_NAME;
    IF v_conflict = 'understanding_contests_command_key' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::integer, NULL::integer, NULL::uuid;
      RETURN;
    END IF;
    RAISE;
  END;

  -- U-1: the reader's open focus on THIS item at the contested version follows the re-evaluation step, in this same
  -- transaction. Only the version changes; opened_at is preserved; a closed focus or another item's is never matched.
  IF v_after_version <> v_item.version THEN
    UPDATE public.understanding_discussion_focus f
       SET hypothesis_version = v_after_version
     WHERE f.user_id = v_user AND f.hypothesis_id = v_item.id AND f.closed_at IS NULL
       AND f.hypothesis_version = v_item.version;
  END IF;

  RETURN QUERY SELECT 'RECORDED'::text, v_item.version, v_after_version, v_evaluation;
END;
$$;

-- 5. The reader's explicit resolution: "I agree with this now" (U-2). Answers, in one row:
--   RESOLVED          this command resolved the item's contest at this exact version (or it is the same command
--                     replayed: the committed truth is answered again, nothing is repeated);
--   NOT_UNDER_REVIEW  the item has no contest under review (already resolved, or never contested) — nothing written;
--   STALE             the item changed since the reader saw it — nothing was written; the caller reads it again;
--   NOT_FOUND         not one of the caller's current items — nothing was written;
--   COMMAND_CONFLICT  this command identity was already spent on another item or version — nothing was written.
-- The reason is server-owned and always USER_CONFIRMED_CURRENT_INTERPRETATION; no caller supplies a reason or an
-- owner. Nothing else changes: the Hypothesis keeps its status, version, statement and Evidence, no Confidence is
-- created and no provider is involved. The item is locked FOR UPDATE first (the documented lock order), so a
-- resolution, a disagreement and a withdrawal of one item serialize, and two resolutions can never both apply.
CREATE FUNCTION understanding_private.resolve_understanding_disagreement_v1(
  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer
) RETURNS TABLE (outcome text, resolved_version integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_item public.hypotheses;
  v_contest public.understanding_contests;
  v_conflict text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_hypothesis_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'UNDERSTANDING_RESOLUTION_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item FROM public.hypotheses h
   WHERE h.id = p_hypothesis_id AND h.user_id = v_user
   FOR UPDATE;

  -- The same command again: its committed truth, or a refusal when it now names something else.
  SELECT * INTO v_contest FROM public.understanding_contests c
   WHERE c.user_id = v_user AND c.resolution_command_id = p_command_id;
  IF FOUND THEN
    IF v_contest.hypothesis_id = p_hypothesis_id AND v_contest.resolved_version = p_expected_version THEN
      RETURN QUERY SELECT 'RESOLVED'::text, v_contest.resolved_version;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::integer;
    RETURN;
  END IF;

  IF v_item.id IS NULL OR v_item.status NOT IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::integer;
    RETURN;
  END IF;

  -- The reader agrees with the interpretation they SEE: never with a newer one they were not shown.
  IF v_item.version <> p_expected_version THEN
    RETURN QUERY SELECT 'STALE'::text, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_contest FROM public.understanding_contests c
   WHERE c.user_id = v_user AND c.hypothesis_id = v_item.id AND c.lifecycle = 'UNDER_REVIEW'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_UNDER_REVIEW'::text, NULL::integer;
    RETURN;
  END IF;

  -- One forward move. The one command identity used at the same instant on another item (which the item lock does not
  -- serialize) meets the resolution command key; that answer is the bounded COMMAND_CONFLICT and nothing is written.
  BEGIN
    UPDATE public.understanding_contests c
       SET lifecycle = 'RESOLVED', resolved_at = clock_timestamp(), resolved_version = v_item.version,
           resolution_reason = 'USER_CONFIRMED_CURRENT_INTERPRETATION', resolution_command_id = p_command_id
     WHERE c.id = v_contest.id AND c.lifecycle = 'UNDER_REVIEW';
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_conflict = CONSTRAINT_NAME;
    IF v_conflict = 'understanding_contests_resolution_command_key' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::integer;
      RETURN;
    END IF;
    RAISE;
  END;

  RETURN QUERY SELECT 'RESOLVED'::text, v_item.version;
END;
$$;

-- The Product boundary on the Data API: an INVOKER pass-through. The caller is still only `auth.uid()`.
CREATE FUNCTION public.resolve_understanding_disagreement_v1(
  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer
) RETURNS TABLE (outcome text, resolved_version integer)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT r.outcome, r.resolved_version
    FROM understanding_private.resolve_understanding_disagreement_v1(p_command_id, p_hypothesis_id, p_expected_version) r;
$$;

-- 6. Forward reconciliation of rows that already exist, narrowly and once.
--    a. A contest still under review whose item was since withdrawn (REJECTED / RETIRED) through the audited lifecycle
--       core: resolved as INTERPRETATION_WITHDRAWN at that first withdrawal's own version and instant, exactly as the
--       trigger in §3 would have. A contest on an item that is current, or only reconsidered, is left untouched.
UPDATE public.understanding_contests c
   SET lifecycle = 'RESOLVED', resolved_at = GREATEST(w.created_at, c.created_at), resolved_version = w.after_version,
       resolution_reason = 'INTERPRETATION_WITHDRAWN'
  FROM (SELECT DISTINCT ON (x.id) x.id AS contest_id, t.created_at, t.after_version
          FROM public.understanding_contests x
          JOIN public.hypothesis_lifecycle_transitions t
            ON t.user_id = x.user_id AND t.hypothesis_id = x.hypothesis_id
           AND t.after_status IN ('REJECTED', 'RETIRED') AND t.after_version > x.reevaluation_after_version
         WHERE x.lifecycle = 'UNDER_REVIEW'
         ORDER BY x.id, t.after_version) w
 WHERE c.id = w.contest_id AND c.lifecycle = 'UNDER_REVIEW';

--    b. An open focus left at a contest's contested version by a pre-0134 disagreement whose re-evaluation step moved
--       the item exactly one version on, and the item is still exactly there: moved to that version. opened_at and
--       closed_at are untouched; no other focus row matches.
UPDATE public.understanding_discussion_focus f
   SET hypothesis_version = c.reevaluation_after_version
  FROM public.understanding_contests c
  JOIN public.hypotheses h ON h.id = c.hypothesis_id AND h.user_id = c.user_id
 WHERE f.user_id = c.user_id AND f.hypothesis_id = c.hypothesis_id AND f.closed_at IS NULL
   AND f.hypothesis_version = c.contested_version
   AND c.reevaluation_after_version = c.contested_version + 1
   AND h.version = c.reevaluation_after_version;

-- 7. Privileges, every one explicit (0133 removed the hosted default privileges; nothing here relies on a default).
ALTER TABLE public.understanding_contests OWNER TO postgres;
REVOKE ALL ON TABLE public.understanding_contests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.understanding_contests TO authenticated;
REVOKE ALL ON TABLE public.understanding_discussion_focus FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.understanding_discussion_focus TO authenticated;

ALTER FUNCTION understanding_private.understanding_contest_lifecycle_forward_only_v1() OWNER TO postgres;
ALTER FUNCTION understanding_private.resolve_withdrawn_understanding_contest_v1() OWNER TO postgres;
ALTER FUNCTION understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer) OWNER TO postgres;
ALTER FUNCTION understanding_private.resolve_understanding_disagreement_v1(uuid, uuid, integer) OWNER TO postgres;
ALTER FUNCTION public.resolve_understanding_disagreement_v1(uuid, uuid, integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION understanding_private.understanding_contest_lifecycle_forward_only_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION understanding_private.resolve_withdrawn_understanding_contest_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_understanding_disagreement_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION understanding_private.resolve_understanding_disagreement_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_understanding_disagreement_v1(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
-- The server channel needs none of this: the API acts on the CALLER's token.
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.understanding_contests, public.understanding_discussion_focus FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION understanding_private.understanding_contest_lifecycle_forward_only_v1(), understanding_private.resolve_withdrawn_understanding_contest_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer), public.record_understanding_disagreement_v1(uuid, uuid, integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION understanding_private.resolve_understanding_disagreement_v1(uuid, uuid, integer), public.resolve_understanding_disagreement_v1(uuid, uuid, integer) FROM service_role';
END IF; END$$;
GRANT EXECUTE ON FUNCTION understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION understanding_private.resolve_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated;

COMMIT;
