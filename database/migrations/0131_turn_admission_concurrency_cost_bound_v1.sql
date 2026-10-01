-- PROD-SEC-02 - Turn Admission Concurrency & Cost Bound v1 (closes PROD-READINESS-01 finding PR01-S02, P0).
--
-- Before this migration one authenticated account could admit any number of cost-bearing turns at once and keep
-- doing so forever: create_user_conversation_turn bounded nothing, claim_conversation_turn only stops two claimants
-- of the SAME turn, and every admitted turn fans into several model-provider calls (reply, segmentation, focus,
-- Thread continuity and establishment). This forward-only migration makes that work finite, at the database
-- authority, for every API instance and for a client that calls the admission RPC directly:
--
--   1. ADMISSION BOUND (create_user_conversation_turn, same signature, same ACL). Under one per-user transaction
--      lock, a NEW admission is refused with SQLSTATE PT429 / 'TURN_ADMISSION_LIMITED' (PostgREST answers HTTP 429)
--      when the session already holds a turn in flight, when the user already holds two, or when the user has
--      used the rolling 10-minute or 24-hour admission allowance. A replay of an already-admitted command (same
--      session, user and idempotency key) is never limited and never charged: it still meets the unchanged
--      unique violation that the API resolves to the original turn. A refusal inserts nothing.
--
--   2. WORK BOUND (begin_ / end_conversation_turn_work_v1, service role only). Provider-bearing work for one
--      exchange - its generation, and the post-finalization semantic walk of an exchange not yet established -
--      runs only under that exchange's work lease. The same per-user lock and the same in-flight bounds decide
--      it, so a RECEIVED turn admitted earlier (by a crashed request, or banked through direct RPC calls) can never
--      be generated beside the user's other live work, and one exchange is never worked twice at once. A lease
--      lasts the frozen 120-second foreground lease (`foreground_generation_lease_interval_v1`), so a crashed
--      request frees its slot by itself; the API returns it as soon as its request ends.
--
--   3. WORK-START BUDGET (same commands). A lease bounds how much work runs AT ONCE, not how much runs over time:
--      an exchange whose reply completed but whose semantic establishment failed retryably is re-walked by every
--      replay, and each replay could take a fresh lease after the previous one ended. So every GRANTED lease is
--      also recorded, durably, in a per-user grant ledger, and a new grant is refused (LIMITED) once the user has
--      used the rolling 10-minute or 24-hour work-start budget. One request takes at most one lease per exchange
--      (its generation and its semantic walk share it), so one request is charged once; a canonical replay of an
--      already established exchange never asks for a lease and is never charged. Admission refuses a new turn
--      while that budget is spent, so no turn is admitted that could not be worked. The windows roll, so neither
--      a crash nor a burst of retries can lock an account out for longer than the window.
--
-- "In flight" is one definition, used by both: a USER turn of the user that holds a live work lease, OR is
-- GENERATING with a live generation lease (the 0039 rule, including its legacy updated_at fallback), OR - for
-- admission only - is RECEIVED and was admitted within the same 120-second window. Every clause expires on its
-- own, so neither a crash nor an abandoned RECEIVED turn can lock an account out; nothing deletes or rewrites a
-- canonical turn to free a slot, and a cancelled turn whose request is still working still holds its lease.
--
-- The numbers are engineering safety defaults, not Product law, and they live in ONE internal function. They are
-- deliberately not runtime-configurable: the admission RPC is callable by every authenticated client, so the
-- ceiling must be owned where that client cannot reach it. Changing them is a reviewed forward migration.
--
-- Lock order: each of the three commands that decide the bound takes exactly ONE lock of its own - the per-user
-- transaction advisory lock below, keyed only by the user - and takes it before touching any row. Nothing else in
-- the schema takes this key, and no holder of a row lock ever waits for it, so it adds no deadlock cycle.
-- Different users hash to different keys and never serialize on one another.
--
-- Migrations 0001-0130 are byte-unchanged.

BEGIN;

-- 1. The engineering defaults, in one place.
--    * one turn in flight per session: the TEXT conversation keeps one coherent head (the client already sends
--      one turn at a time, and the Session Semantic Clock orders exchanges);
--    * two in flight per user: room for a second device, while opening more sessions buys nothing;
--    * 40 admissions per rolling 10 minutes: every turn waits for its whole reply and semantic establishment
--      before the next one in its session can be admitted, so conversational use stays far below one new turn
--      per 15 seconds sustained for ten minutes, burst included;
--    * 600 admissions per rolling 24 hours: hours of heavy daily use, while one account's sustained ceiling is
--      roughly ten times lower than the 10-minute window alone would allow;
--    * 60 work starts per rolling 10 minutes and 900 per rolling 24 hours, over the same two windows: every
--      admitted turn is worked by the request that admitted it under ONE lease, so ordinary use spends exactly
--      one start per admission and never exceeds 40 / 600; the further 50% is the room for genuine retries (a
--      reply deferred while the user was at the in-flight bound, a semantic walk that failed retryably or ran
--      out of its foreground deadline). A retry loop on one exchange therefore stops after at most 20 extra
--      starts in ten minutes and 300 in a day, and the account's whole foreground provider-bearing work is at
--      most 900 bounded requests a day, however it is split between new turns and retries.
CREATE FUNCTION public.conversation_turn_admission_policy_v1(
  OUT session_in_flight_limit integer,
  OUT user_in_flight_limit integer,
  OUT short_window interval,
  OUT short_window_limit integer,
  OUT long_window interval,
  OUT long_window_limit integer,
  OUT work_short_window_limit integer,
  OUT work_long_window_limit integer
) LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT 1, 2, interval '10 minutes', 40, interval '24 hours', 600, 60, 900
$$;

-- 2. The work lease. Runtime authority state only: no application role may read or write it, every row belongs
--    to exactly one USER turn and disappears with it (account erasure deletes the turns, and the cascade takes
--    the leases), and user_id / session_id are copied from that turn by the one command that inserts here.
CREATE TABLE public.conversation_turn_work_leases (
  user_turn_id uuid PRIMARY KEY REFERENCES public.conversation_turns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  acquired_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT conversation_turn_work_leases_window_check CHECK (expires_at > acquired_at)
);
CREATE INDEX conversation_turn_work_leases_user_idx ON public.conversation_turn_work_leases (user_id, expires_at);

ALTER TABLE public.conversation_turn_work_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_turn_work_leases FROM PUBLIC, anon, authenticated, service_role;

-- 2b. The work-start ledger: one row per GRANTED lease, kept as long as the longest window needs it. Same
--     authority as the lease table: no application role may read or write it, and it disappears with its turn.
--     Ending a lease never removes its grant, so a returned or expired lease is still charged.
CREATE TABLE public.conversation_turn_work_grants (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_turn_id uuid NOT NULL REFERENCES public.conversation_turns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  granted_at timestamptz NOT NULL
);
CREATE INDEX conversation_turn_work_grants_user_idx ON public.conversation_turn_work_grants (user_id, granted_at);
CREATE INDEX conversation_turn_work_grants_turn_idx ON public.conversation_turn_work_grants (user_turn_id);

ALTER TABLE public.conversation_turn_work_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_turn_work_grants FROM PUBLIC, anon, authenticated, service_role;

-- 3. The two reads the bound needs, indexed for one user rather than the whole table.
CREATE INDEX conversation_turns_user_admission_window_idx
  ON public.conversation_turns (user_id, created_at) WHERE role = 'USER';
CREATE INDEX conversation_turns_user_unsettled_idx
  ON public.conversation_turns (user_id) WHERE role = 'USER' AND status IN ('RECEIVED', 'GENERATING');

-- 4. The one in-flight definition (internal; executed only inside the definer commands below).
CREATE FUNCTION public.conversation_turns_in_flight_v1(p_user_id uuid, p_include_received boolean)
RETURNS TABLE(turn_id uuid, turn_session_id uuid)
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT w.user_turn_id, w.session_id
    FROM public.conversation_turn_work_leases w
   WHERE w.user_id = p_user_id AND w.expires_at > CURRENT_TIMESTAMP
  UNION
  SELECT t.id, t.session_id
    FROM public.conversation_turns t
   WHERE t.user_id = p_user_id AND t.role = 'USER' AND t.status IN ('RECEIVED', 'GENERATING')
     AND ((t.status = 'GENERATING'
           AND COALESCE(t.generation_lease_expires_at, t.updated_at + public.foreground_generation_lease_interval_v1()) > CURRENT_TIMESTAMP)
       OR (p_include_received AND t.status = 'RECEIVED'
           AND t.created_at + public.foreground_generation_lease_interval_v1() > CURRENT_TIMESTAMP))
$$;

-- 4b. Whether the user has spent either rolling work-start budget (internal; read under the per-user lock).
CREATE FUNCTION public.conversation_turn_work_budget_spent_v1(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT count(g.id) FILTER (WHERE g.granted_at > CURRENT_TIMESTAMP - p.short_window) >= p.work_short_window_limit
      OR count(g.id) >= p.work_long_window_limit
    FROM public.conversation_turn_admission_policy_v1() p
    LEFT JOIN public.conversation_turn_work_grants g
      ON g.user_id = p_user_id AND g.granted_at > CURRENT_TIMESTAMP - p.long_window
   GROUP BY p.short_window, p.work_short_window_limit, p.work_long_window_limit
$$;

-- 5. The per-user lock (internal). One key per user, in its own namespace.
CREATE FUNCTION public.lock_conversation_turn_admission_v1(p_user_id uuid) RETURNS void
LANGUAGE sql VOLATILE SET search_path='' AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.conversation-turn-admission.v1:' || p_user_id::text, 0))
$$;

-- 6. Same-signature admission replacement. Every pre-existing check is unchanged and keeps its order and its
--    error; the bound is evaluated only after them, under the lock, and only for a genuinely new command.
CREATE OR REPLACE FUNCTION public.create_user_conversation_turn(
  p_id uuid, p_session_id uuid, p_content text, p_idempotency_key text DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); session_row public.conversation_sessions; new_row public.conversation_turns;
  policy record; in_session integer; in_user integer; recent_short integer; recent_long integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO session_row FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=u;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF session_row.status<>'ACTIVE' OR session_row.channel<>'TEXT' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE_TEXT' USING ERRCODE='55000'; END IF;
  IF p_content IS NULL OR length(btrim(p_content))=0 OR length(p_content)>20000 THEN
    RAISE EXCEPTION 'INVALID_CONTENT' USING ERRCODE='22023'; END IF;
  IF p_idempotency_key IS NOT NULL AND (length(p_idempotency_key)<1 OR length(p_idempotency_key)>128) THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE='22023'; END IF;
  -- PROD-SEC-02: decide and insert under the user's one admission lock, so no two admissions of one user can
  -- both pass a check made before either inserted - across sessions and across API instances.
  PERFORM public.lock_conversation_turn_admission_v1(u);
  -- A replay of an already-admitted command is neither limited nor charged: it falls through to the INSERT and
  -- meets the same (session_id, user_id, idempotency_key) unique violation as before (PostgREST 409).
  IF p_idempotency_key IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.conversation_turns t
     WHERE t.session_id=p_session_id AND t.user_id=u AND t.idempotency_key=p_idempotency_key
  ) THEN
    SELECT * INTO policy FROM public.conversation_turn_admission_policy_v1();
    SELECT count(*) FILTER (WHERE f.turn_session_id=p_session_id), count(*)
      INTO in_session, in_user FROM public.conversation_turns_in_flight_v1(u, true) f;
    SELECT count(*) FILTER (WHERE t.created_at > CURRENT_TIMESTAMP - policy.short_window), count(*)
      INTO recent_short, recent_long
      FROM public.conversation_turns t
     WHERE t.user_id=u AND t.role='USER' AND t.created_at > CURRENT_TIMESTAMP - policy.long_window;
    IF in_session >= policy.session_in_flight_limit OR in_user >= policy.user_in_flight_limit
       OR recent_short >= policy.short_window_limit OR recent_long >= policy.long_window_limit
       OR public.conversation_turn_work_budget_spent_v1(u) THEN
      -- One answer for every reason: no counter, window, limit or other session is disclosed.
      RAISE EXCEPTION 'TURN_ADMISSION_LIMITED' USING ERRCODE='PT429';
    END IF;
  END IF;
  INSERT INTO public.conversation_turns(
    id,session_id,user_id,role,status,content,processing_path,routing_reason,source_turn_id,idempotency_key,completed_at
  ) VALUES(p_id,p_session_id,u,'USER','RECEIVED',p_content,NULL,NULL,NULL,p_idempotency_key,NULL)
  RETURNING * INTO new_row;
  RETURN NEXT new_row;
END;$$;

-- 7. Begin provider-bearing work for one exchange (service role only). Ownership is explicit, exactly like
--    claim/finalize/fail: the server names the user, session and USER source turn, and a mismatch fails closed.
--      GRANTED      a new lease; the caller holds it until end_conversation_turn_work_v1 or expiry
--      IN_PROGRESS  another live lease already covers this exchange; start nothing
--      LIMITED      the session or the user is at its in-flight bound, or the user has spent its work-start
--                   budget; start nothing (one answer for every reason, as at admission)
CREATE FUNCTION public.begin_conversation_turn_work_v1(p_session_id uuid, p_user_id uuid, p_source_turn_id uuid)
RETURNS TABLE(work_outcome text, work_lease_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE policy record; in_session integer; in_user integer; granted uuid;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_turns t
                 WHERE t.id=p_source_turn_id AND t.session_id=p_session_id AND t.user_id=p_user_id AND t.role='USER') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM public.lock_conversation_turn_admission_v1(p_user_id);
  IF EXISTS(SELECT 1 FROM public.conversation_turn_work_leases w
             WHERE w.user_turn_id=p_source_turn_id AND w.expires_at > CURRENT_TIMESTAMP) THEN
    RETURN QUERY SELECT 'IN_PROGRESS'::text, NULL::uuid; RETURN;
  END IF;
  -- Expired leases of this user only: bounded housekeeping, never another user's rows.
  DELETE FROM public.conversation_turn_work_leases w WHERE w.user_id=p_user_id AND w.expires_at <= CURRENT_TIMESTAMP;
  SELECT * INTO policy FROM public.conversation_turn_admission_policy_v1();
  SELECT count(*) FILTER (WHERE f.turn_session_id=p_session_id), count(*)
    INTO in_session, in_user
    FROM public.conversation_turns_in_flight_v1(p_user_id, false) f
   WHERE f.turn_id <> p_source_turn_id;
  IF in_session >= policy.session_in_flight_limit OR in_user >= policy.user_in_flight_limit THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid; RETURN;
  END IF;
  -- The work-start budget: grants older than the longest window can no longer count, so this user's are pruned
  -- (bounded housekeeping, never another user's rows); then a spent budget refuses exactly like the bound above.
  DELETE FROM public.conversation_turn_work_grants g
   WHERE g.user_id=p_user_id AND g.granted_at <= CURRENT_TIMESTAMP - policy.long_window;
  IF public.conversation_turn_work_budget_spent_v1(p_user_id) THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid; RETURN;
  END IF;
  granted := pg_catalog.gen_random_uuid();
  INSERT INTO public.conversation_turn_work_leases(user_turn_id, user_id, session_id, lease_id, acquired_at, expires_at)
  VALUES(p_source_turn_id, p_user_id, p_session_id, granted, CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP + public.foreground_generation_lease_interval_v1());
  INSERT INTO public.conversation_turn_work_grants(user_turn_id, user_id, granted_at)
  VALUES(p_source_turn_id, p_user_id, CURRENT_TIMESTAMP);
  RETURN QUERY SELECT 'GRANTED'::text, granted;
END;$$;

-- 8. Return a lease (service role only). Only the exact holder's lease is removed, so a late return from a
--    request whose lease already expired can never release a newer holder's.
CREATE FUNCTION public.end_conversation_turn_work_v1(p_user_id uuid, p_source_turn_id uuid, p_lease_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  DELETE FROM public.conversation_turn_work_leases w
   WHERE w.user_turn_id=p_source_turn_id AND w.user_id=p_user_id AND w.lease_id=p_lease_id;
  RETURN FOUND;
END;$$;

-- 9. Ownership, search_path and least privilege. The admission command keeps its authenticated-only EXECUTE
--    (CREATE OR REPLACE preserves it; it is re-asserted here). The work commands are service-role only, like
--    claim/finalize/fail. The policy, in-flight and lock functions are internal to the definer commands.
ALTER FUNCTION public.conversation_turn_admission_policy_v1() OWNER TO postgres;
ALTER FUNCTION public.conversation_turns_in_flight_v1(uuid, boolean) OWNER TO postgres;
ALTER FUNCTION public.lock_conversation_turn_admission_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.conversation_turn_work_budget_spent_v1(uuid) OWNER TO postgres;
ALTER TABLE public.conversation_turn_work_grants OWNER TO postgres;
ALTER FUNCTION public.create_user_conversation_turn(uuid,uuid,text,text) OWNER TO postgres;
ALTER FUNCTION public.begin_conversation_turn_work_v1(uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.end_conversation_turn_work_v1(uuid,uuid,uuid) OWNER TO postgres;
ALTER TABLE public.conversation_turn_work_leases OWNER TO postgres;

REVOKE ALL ON FUNCTION public.conversation_turn_admission_policy_v1() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.conversation_turns_in_flight_v1(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.lock_conversation_turn_admission_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.conversation_turn_work_budget_spent_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_user_conversation_turn(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_conversation_turn(uuid,uuid,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.begin_conversation_turn_work_v1(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_conversation_turn_work_v1(uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.end_conversation_turn_work_v1(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_conversation_turn_work_v1(uuid,uuid,uuid) TO service_role;

COMMIT;
