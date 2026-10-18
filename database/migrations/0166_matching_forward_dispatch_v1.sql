-- S6-07 - The forward dispatcher v1 (CP2: Forward Dispatcher).
--
-- Product authority: the Product Owner's S6-07 Final Task Contract, the CP0 report and its review addendum as approved
-- on 2026-10-18 (Q5' - the corrected dispatcher: the pair lock first, lock_timeout -> BUSY, a ledger backoff and the
-- reconciliation lister - with the Controlled Amendment CA-SYS-02), and "S6-07 - CP1 CLOSED / Start CP2" (2026-10-18).
-- Where the CP0 report and the addendum differ, the addendum (S6-07_CP0_REVIEW_ADDENDUM_v1.md §2) is the design. The
-- execution record is docs/e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md (§10, CA-SYS-02-impl); the runtime amendment is
-- docs/matching-introduction-runtime-v1.md §50. This migration is that task's CP2 database part, and nothing more.
--
-- ## Why this exists (QAN-BL-MATCH-06)
--
-- After the first recipient approves forwarding (S6-04, FIRST_FORWARD_APPROVED), the proposal reaches the second recipient
-- only through the frozen forward core forward_matching_proposal_to_second_core_v1 (0120), which no role may execute and
-- nothing called. This adds the ONE server-side producer of that step. It never decides anything a human or the frozen
-- core decides: the first recipient's approval is the human act, and the core's own revalidation, CW2-08 seam (last) and
-- disclosure gate decide whether anything is delivered.
--
-- ## What is added (schema matching_forward_private, not exposed through the Data API)
--
--   1. matching_forward_private.proposal_forward_attempts - the durable ledger, one row per proposal: the forward command
--      id and the candidate view id, each minted ONCE and reused by every later attempt (the core answers an equivalent
--      retry from its durable delivery binding, so a restart or a crashed worker can never deliver twice or under a second
--      identity); the attempt count, the last outcome and the next instant the proposal is due. Readable and writable by
--      no application role; RLS on. It references the proposal ON DELETE CASCADE, so the governed account erasure (0164),
--      which deletes the account's proposals, removes the ledger rows with them and its frozen body stays unchanged.
--   2. public.server_forward_approved_matching_proposals_v1(p_max) - THE dispatcher (CA-SYS-02). service_role only,
--      SECURITY DEFINER, p_max must be 1: ONE attempt per transaction (the 0157 sweeper discipline), lock_timeout 2 s.
--        1. the one due proposal, read WITHOUT a row lock: FIRST_FORWARD_APPROVED, not expired, no ledger row or one that
--           is due; oldest due first (the ledger instant, else the preparation instant), then id     none -> NONE_DUE
--        2. the canonical pair lock FIRST, exactly as every core and every human decision takes it; a wait past the lock
--           timeout is BUSY - nothing of the proposal is touched; where the ledger can be written within 100 ms it
--           defers the proposal 30 s, so a contended pair can never be selected first forever (while a human decision
--           holds the proposal row itself, even the ledger is left untouched and the worker ends its cycle)
--        3. re-read under the pair lock: moved or expired -> SKIPPED_MOVED (terminal for the ledger); the first
--           recipient's forward approval no longer bound to their current exact view -> SKIPPED_STALE
--        4. the ledger row (the ids minted once, ON CONFLICT DO NOTHING) and its row lock
--        5. the candidate's permitted conclusion for the proposal's own snapshot (for the candidate, about the first
--           recipient): exactly one must exist; none (or more than one) -> SKIPPED_NO_CONCLUSION. Nothing is invented: a
--           conclusion is only ever the real filter's PERMITTED row (0110 / 0111)
--        6. the frozen core, in an inner block: FORWARDED; 55000 from the CW2-08 seam -> SKIPPED_NOT_CLEARED, any other
--           55000 (an expired deadline at the real instant, an unconfigured policy, an unresolved first name, a refused
--           disclosure) -> SKIPPED_NOT_READY; 40001 / PT409 -> SKIPPED_STALE; a lock wait past the timeout -> BUSY;
--           anything else (a reused-id 23505 included) -> HELD_INTEGRITY: held by the ledger, never retried
--           automatically and never raised, so it can neither be taken for a retry nor be selected first forever
--        7. the ledger: FORWARDED, SKIPPED_MOVED and HELD_INTEGRITY are terminal (no next instant); every other outcome is
--           due again after a bounded exponential backoff (1 min doubling, capped at 6 h, never past the deadline)
--      Answers ONE word and no identity: FORWARDED | SKIPPED_MOVED | SKIPPED_NO_CONCLUSION | SKIPPED_NOT_CLEARED |
--      SKIPPED_NOT_READY | SKIPPED_STALE | HELD_INTEGRITY | BUSY | NONE_DUE.
--   3. public.server_list_proposal_delivery_activity_reconciliation_v1(p_limit) - read-only, service_role only: every
--      proposal delivery whose delivery is still the proposal's current state and whose deadline has not passed, and whose
--      recipient has no Activity member under the candidate key introductions:proposal-delivered:<delivery transition>
--      (0136). Publication is NOT part of the forward transaction, so a worker that dies after a committed forward finds
--      the delivery here on its next cycle; the Activity publisher (CP3) answers DUPLICATE on any replay. It reads no 0108
--      relation and reaches no write. CP2 lists PUBLISH only; the Activity producer, its copy and withdrawal are CP3.
--
-- ## What is deliberately NOT here
--
--   * No change to any frozen body: the forward core, the materializer, the transition writer, the CW2-08 seam
--     (still NOT_EVALUATED, so in production every attempt ends SKIPPED_NOT_CLEARED with only a ledger row), the S6-04
--     decisions, the 0157 sweeper and the 0164 erasure are byte-unchanged. No transition, view or binding is written here
--     except by the frozen core itself.
--   * No route, no client grant, no authenticated path; no policy row, conclusion, proposal or gate. No Activity item is
--     published (CP3). No Launch Gate is opened and Stage 8A is not claimed: no proposal can exist in production.
--   * NO_BACKDOOR gains exactly ONE named service_role SYSTEM exception, the dispatcher (CA-SYS-02); the lister and the
--     ledger are not exceptions.
--
-- Forward-only. Migrations 0001-0165 are byte-unchanged.
BEGIN;

CREATE SCHEMA matching_forward_private;
ALTER SCHEMA matching_forward_private OWNER TO postgres;
REVOKE ALL ON SCHEMA matching_forward_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE LEDGER.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE matching_forward_private.proposal_forward_attempts (
    proposal_id uuid PRIMARY KEY,
    forward_command_id uuid NOT NULL,
    forwarded_view_id uuid NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    last_outcome text NOT NULL DEFAULT 'PENDING',
    last_failure_sqlstate text,
    next_attempt_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT proposal_forward_attempts_proposal_fk
        FOREIGN KEY (proposal_id) REFERENCES public.matching_proposals (id) ON DELETE CASCADE,
    CONSTRAINT proposal_forward_attempts_command_key UNIQUE (forward_command_id),
    CONSTRAINT proposal_forward_attempts_view_key UNIQUE (forwarded_view_id),
    CONSTRAINT proposal_forward_attempts_ids_check CHECK (forward_command_id <> forwarded_view_id),
    CONSTRAINT proposal_forward_attempts_attempts_check CHECK (attempts >= 0),
    CONSTRAINT proposal_forward_attempts_outcome_check CHECK (last_outcome IN (
        'PENDING', 'FORWARDED', 'SKIPPED_MOVED', 'SKIPPED_NO_CONCLUSION', 'SKIPPED_NOT_CLEARED', 'SKIPPED_NOT_READY',
        'SKIPPED_STALE', 'HELD_INTEGRITY', 'BUSY')),
    -- Terminal exactly when nothing is due again.
    CONSTRAINT proposal_forward_attempts_terminal_check CHECK (
        (last_outcome IN ('FORWARDED', 'SKIPPED_MOVED', 'HELD_INTEGRITY')) = (next_attempt_at IS NULL)),
    -- Only a held integrity refusal keeps a SQLSTATE, and only the SQLSTATE: never a message, detail or identity.
    CONSTRAINT proposal_forward_attempts_failure_check CHECK (
        (last_failure_sqlstate IS NULL OR last_failure_sqlstate ~ '^[0-9A-Z]{5}$')
        AND (last_failure_sqlstate IS NULL OR last_outcome = 'HELD_INTEGRITY'))
);

CREATE INDEX proposal_forward_attempts_due_idx
    ON matching_forward_private.proposal_forward_attempts (next_attempt_at) WHERE next_attempt_at IS NOT NULL;

COMMENT ON TABLE matching_forward_private.proposal_forward_attempts IS
  'S6-07 (CA-SYS-02): the forward dispatcher''s durable ledger, one row per proposal. The forward command id and the '
  'candidate view id are minted once and reused by every attempt, so no retry, restart or crashed worker delivers twice '
  'or under a second identity. Readable and writable by no application role; deleted with its proposal.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE DISPATCHER (CA-SYS-02).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_forward_approved_matching_proposals_v1(p_max integer)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  v_due record;
  v_proposal public.matching_proposals;
  v_attempt matching_forward_private.proposal_forward_attempts;
  v_conclusions uuid[];
  v_outcome text;
  v_sqlstate text;
BEGIN
  IF p_max IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'MATCHING_FORWARD_REQUEST_INVALID' USING ERRCODE = '22023',
      DETAIL = 'One attempt per transaction: a batch would hold several pairs'' locks in no global order.';
  END IF;

  -- 1. The one due proposal, read without a row lock: a proposal row is only ever touched under its pair lock.
  SELECT p.id, p.lower_user_id, p.higher_user_id INTO v_due
    FROM public.matching_proposals p
    LEFT JOIN matching_forward_private.proposal_forward_attempts a ON a.proposal_id = p.id
   WHERE p.proposal_state = 'FIRST_FORWARD_APPROVED' AND p.expires_at > clock_timestamp()
     AND (a.proposal_id IS NULL OR a.next_attempt_at <= clock_timestamp())
   ORDER BY coalesce(a.next_attempt_at, p.prepared_at), p.id
   LIMIT 1;
  IF v_due.id IS NULL THEN
    RETURN QUERY SELECT 'NONE_DUE'::text;
    RETURN;
  END IF;

  -- 2. The pair lock FIRST - the same first lock as every core and every human decision, in canonical order.
  BEGIN
    PERFORM public.lock_matching_pair_humans_v1(v_due.lower_user_id, v_due.higher_user_id);
  EXCEPTION WHEN lock_not_available OR deadlock_detected THEN
    -- Nothing of the proposal is touched. The ledger alone defers it, so a held pair cannot be selected first forever;
    -- a terminal row is never reopened, and a ledger row held by another attempt is simply left to it. The deferral
    -- waits at most 100 ms: a new row's key check waits for the proposal row, which a human decision may hold.
    BEGIN
      PERFORM pg_catalog.set_config('lock_timeout', '100ms', true);
      INSERT INTO matching_forward_private.proposal_forward_attempts AS a
        (proposal_id, forward_command_id, forwarded_view_id, last_outcome, next_attempt_at)
      VALUES (v_due.id, gen_random_uuid(), gen_random_uuid(), 'BUSY', clock_timestamp() + interval '30 seconds')
      ON CONFLICT (proposal_id) DO UPDATE
        SET last_outcome = 'BUSY', next_attempt_at = clock_timestamp() + interval '30 seconds', updated_at = clock_timestamp()
        WHERE a.next_attempt_at IS NOT NULL;
    EXCEPTION WHEN lock_not_available OR deadlock_detected OR foreign_key_violation THEN
      NULL;
    END;
    RETURN QUERY SELECT 'BUSY'::text;
    RETURN;
  END;

  -- 3. Re-read under the pair lock.
  SELECT * INTO v_proposal FROM public.matching_proposals p WHERE p.id = v_due.id;
  IF v_proposal.id IS NULL OR v_proposal.proposal_state <> 'FIRST_FORWARD_APPROVED'
     OR v_proposal.expires_at <= clock_timestamp() THEN
    UPDATE matching_forward_private.proposal_forward_attempts a
       SET last_outcome = 'SKIPPED_MOVED', last_failure_sqlstate = NULL, next_attempt_at = NULL, updated_at = clock_timestamp()
     WHERE a.proposal_id = v_due.id AND a.next_attempt_at IS NOT NULL;
    RETURN QUERY SELECT 'SKIPPED_MOVED'::text;
    RETURN;
  END IF;

  -- 4. The ledger row: both identities minted ONCE, then reused by every attempt.
  INSERT INTO matching_forward_private.proposal_forward_attempts AS a
    (proposal_id, forward_command_id, forwarded_view_id, last_outcome, next_attempt_at)
  VALUES (v_proposal.id, gen_random_uuid(), gen_random_uuid(), 'PENDING', clock_timestamp())
  ON CONFLICT (proposal_id) DO NOTHING;
  SELECT * INTO v_attempt FROM matching_forward_private.proposal_forward_attempts a
   WHERE a.proposal_id = v_proposal.id FOR UPDATE;

  -- The first recipient's forward approval is still bound to their current exact view.
  IF NOT EXISTS (SELECT 1 FROM public.matching_forward_approval_view_bindings b
                   JOIN public.matching_recipient_proposal_view_state st
                     ON st.proposal_id = b.proposal_id AND st.recipient_user_id = b.approver_user_id
                  WHERE b.approval_transition_id = v_proposal.current_transition_id
                    AND b.proposal_id = v_proposal.id
                    AND b.approver_user_id = v_proposal.first_recipient_user_id
                    AND st.current_view_id = b.approved_view_id) THEN
    v_outcome := 'SKIPPED_STALE';
  ELSE
    -- 5. The candidate's own permitted conclusion for this proposal's snapshot: exactly one, never invented.
    v_conclusions := ARRAY(
      SELECT c.id FROM public.matching_permitted_safe_conclusions c
        JOIN public.matching_safe_conclusion_candidates k ON k.id = c.conclusion_candidate_id
       WHERE k.eligibility_snapshot_id = v_proposal.eligibility_snapshot_id
         AND c.for_recipient_user_id = v_proposal.candidate_user_id
         AND c.about_user_id = v_proposal.first_recipient_user_id
       ORDER BY c.id);
    IF cardinality(v_conclusions) <> 1 THEN
      v_outcome := 'SKIPPED_NO_CONCLUSION';
    ELSE
      -- 6. The frozen core. Its revalidation, its CW2-08 seam (last) and its disclosure gate decide; a refusal leaves
      --    nothing of it behind.
      BEGIN
        PERFORM 1 FROM public.forward_matching_proposal_to_second_core_v1(
          v_attempt.forward_command_id, v_proposal.id, v_attempt.forwarded_view_id, v_conclusions[1]);
        v_outcome := 'FORWARDED';
      EXCEPTION
        WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
          v_outcome := 'SKIPPED_STALE';
        WHEN SQLSTATE '55000' THEN
          v_outcome := CASE WHEN SQLERRM = 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED'
                            THEN 'SKIPPED_NOT_CLEARED' ELSE 'SKIPPED_NOT_READY' END;
        WHEN lock_not_available OR deadlock_detected THEN
          v_outcome := 'BUSY';
        WHEN OTHERS THEN
          v_outcome := 'HELD_INTEGRITY';
          v_sqlstate := SQLSTATE;
      END;
    END IF;
  END IF;

  -- 7. The ledger.
  UPDATE matching_forward_private.proposal_forward_attempts a
     SET attempts = a.attempts + CASE WHEN v_outcome = 'BUSY' THEN 0 ELSE 1 END,
         last_outcome = v_outcome,
         last_failure_sqlstate = v_sqlstate,
         next_attempt_at = CASE
           WHEN v_outcome IN ('FORWARDED', 'HELD_INTEGRITY') THEN NULL
           WHEN v_outcome = 'BUSY' THEN least(clock_timestamp() + interval '30 seconds', v_proposal.expires_at)
           ELSE least(clock_timestamp() + least(interval '6 hours', interval '1 minute' * power(2, least(a.attempts, 16))),
                      v_proposal.expires_at) END,
         updated_at = clock_timestamp()
   WHERE a.proposal_id = v_proposal.id;
  RETURN QUERY SELECT v_outcome;
END$$;

COMMENT ON FUNCTION public.server_forward_approved_matching_proposals_v1(integer) IS
  'S6-07 (CA-SYS-02): THE forward dispatcher. One attempt per transaction (p_max = 1): the one due '
  'FIRST_FORWARD_APPROVED proposal, its pair lock first (lock_timeout 2 s -> BUSY), re-read under it, the ids minted once '
  'in the ledger, the candidate''s one permitted conclusion, then the frozen forward core, whose revalidation and CW2-08 '
  'seam decide. Answers one word and no identity. service_role only; the census''s second SYSTEM exception.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE ACTIVITY RECONCILIATION LISTER (read-only).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_list_proposal_delivery_activity_reconciliation_v1(p_limit integer)
RETURNS TABLE(delivery_transition_id uuid, proposal_id uuid, recipient_user_id uuid, candidate_key text,
              delivered_at timestamptz, action text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'ACTIVITY_RECONCILIATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT b.delivery_transition_id, b.proposal_id, b.recipient_user_id,
         'introductions:proposal-delivered:' || b.delivery_transition_id::text, t.occurred_at, 'PUBLISH'::text
    FROM public.matching_proposal_delivery_view_bindings b
    JOIN public.matching_proposals p ON p.id = b.proposal_id AND p.current_transition_id = b.delivery_transition_id
    JOIN public.matching_proposal_transitions t ON t.id = b.delivery_transition_id
   WHERE p.expires_at > CURRENT_TIMESTAMP
     AND NOT EXISTS (SELECT 1 FROM public.activity_item_members m
                      WHERE m.user_id = b.recipient_user_id
                        AND m.candidate_key = 'introductions:proposal-delivered:' || b.delivery_transition_id::text)
   ORDER BY t.occurred_at, b.delivery_transition_id
   LIMIT p_limit;
END$$;

COMMENT ON FUNCTION public.server_list_proposal_delivery_activity_reconciliation_v1(integer) IS
  'S6-07 (CA-SYS-02): read-only. Every proposal delivery that is still its proposal''s current state, before its deadline, '
  'whose recipient has no Activity member under its candidate key - so a delivery committed by a worker that died before '
  'publishing is found again on the next cycle. Reaches no write. service_role only.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. DELETION COVERAGE (ACCT-DEL-01): the ledger references an erased relation and goes with it.
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
  ('matching_forward_private.proposal_forward_attempts', 'MATCHING_INTRODUCTIONS');

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. PRIVILEGES, every one explicit.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
BEGIN
  ALTER TABLE matching_forward_private.proposal_forward_attempts OWNER TO postgres;
  ALTER TABLE matching_forward_private.proposal_forward_attempts ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE matching_forward_private.proposal_forward_attempts FROM PUBLIC, anon, authenticated;
  FOREACH fn IN ARRAY ARRAY[
    'public.server_forward_approved_matching_proposals_v1(integer)',
    'public.server_list_proposal_delivery_activity_reconciliation_v1(integer)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON SCHEMA matching_forward_private FROM service_role;
    REVOKE ALL ON TABLE matching_forward_private.proposal_forward_attempts FROM service_role;
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_forward_approved_matching_proposals_v1(integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_list_proposal_delivery_activity_reconciliation_v1(integer) TO service_role';
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  dispatcher constant text := 'public.server_forward_approved_matching_proposals_v1(integer)';
  lister constant text := 'public.server_list_proposal_delivery_activity_reconciliation_v1(integer)';
  src text;
  v_bad text;
BEGIN
  -- service_role and nobody else, where the role exists; never a client.
  SELECT string_agg(format('%s:%s', r.rolname, f.fn), ', ') INTO v_bad
    FROM unnest(ARRAY[dispatcher, lister]) AS f(fn)
    CROSS JOIN (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) r
   WHERE has_function_privilege(r.rolname, f.fn::regprocedure, 'EXECUTE');
  IF v_bad IS NOT NULL OR has_function_privilege('public', dispatcher::regprocedure, 'EXECUTE')
     OR has_function_privilege('public', lister::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'S6-07: no client role may execute the dispatcher or the lister: %', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     AND NOT (has_function_privilege('service_role', dispatcher::regprocedure, 'EXECUTE')
              AND has_function_privilege('service_role', lister::regprocedure, 'EXECUTE')) THEN
    RAISE EXCEPTION 'S6-07: service_role executes the dispatcher and the lister';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN ('server_forward_approved_matching_proposals_v1',
                                                    'server_list_proposal_delivery_activity_reconciliation_v1')) <> 2 THEN
    RAISE EXCEPTION 'S6-07: the dispatcher and the lister exist once each, with no overload';
  END IF;
  -- No application role reads or writes the ledger.
  SELECT string_agg(r.rolname, ', ') INTO v_bad
    FROM (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) r
   WHERE has_table_privilege(r.rolname, 'matching_forward_private.proposal_forward_attempts',
                             'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: an application role holds a privilege on the ledger: %', v_bad; END IF;
  -- The frozen core and every proposal core stay executable by no application role.
  SELECT string_agg(format('%s:%s', r.rolname, p.oid::regprocedure), ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) r
   WHERE n.nspname = 'public'
     AND p.proname IN ('forward_matching_proposal_to_second_core_v1', 'offer_matching_proposal_to_first_core_v1',
                       'materialize_matching_recipient_view_core_v1', 'append_matching_proposal_transition_v1',
                       'lock_matching_pair_humans_v1', 'sweep_matching_proposals_core_v1')
     AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: a proposal core became executable: %', v_bad; END IF;
  -- The dispatcher is the forward core's ONE caller; it writes no transition, view or binding itself, never consults or
  -- answers the CW2-08 seam, absorbs 40001 naming PT409, raises neither, re-raises nothing and runs no dynamic SQL.
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY 1) INTO v_bad FROM pg_proc p
   WHERE p.prosrc ~ 'forward_matching_proposal_to_second_core_v1\s*\(' AND p.oid <> dispatcher::regprocedure
     AND p.proname <> 'forward_matching_proposal_to_second_core_v1';
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: only the dispatcher calls the forward core; found %', v_bad; END IF;
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = dispatcher::regprocedure;
  IF src ~ '(INSERT\s+INTO\s+public\.|UPDATE\s+public\.|DELETE\s+FROM\s+public\.|append_matching_proposal_transition_v1|materialize_matching_recipient_view_core_v1|resolve_matching_proposal_prerequisites_v1|''CLEARED'')'
     OR src !~ 'WHEN SQLSTATE ''40001'' OR SQLSTATE ''PT409'' THEN' OR src ~ 'ERRCODE = ''(40001|PT409)'''
     OR src ~* '(\mEXECUTE\s|RAISE;|ISOLATION|auth\.uid)' THEN
    RAISE EXCEPTION 'S6-07: the dispatcher writes nothing public itself, never answers the seam, absorbs 40001 / PT409 and runs no dynamic SQL';
  END IF;
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = lister::regprocedure;
  IF src ~* '(INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE|_core_v1|lock_matching|\mEXECUTE\s)'
     OR (SELECT p.provolatile FROM pg_proc p WHERE p.oid = lister::regprocedure) <> 's' THEN
    RAISE EXCEPTION 'S6-07: the reconciliation lister is STABLE and writes nothing';
  END IF;
  -- CW2-08 stays closed: the proposal seam still answers NOT_EVALUATED.
  IF (SELECT r.clearance FROM public.resolve_matching_proposal_prerequisites_v1(gen_random_uuid()) r) <> 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'S6-07: the CW2-08 proposal seam answers NOT_EVALUATED';
  END IF;
  -- The ledger references only its proposal, and cascades with it.
  SELECT string_agg(c.conname, ', ') INTO v_bad FROM pg_constraint c
   WHERE c.contype = 'f' AND c.connamespace = 'matching_forward_private'::regnamespace
     AND NOT (c.confrelid = 'public.matching_proposals'::regclass AND c.confdeltype = 'c');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: the ledger references only its proposal, ON DELETE CASCADE: %', v_bad; END IF;
  IF NOT EXISTS (SELECT 1 FROM account_erasure_private.coverage_registry g
                  WHERE g.relation = 'matching_forward_private.proposal_forward_attempts' AND g.coverage = 'MATCHING_INTRODUCTIONS') THEN
    RAISE EXCEPTION 'S6-07: the ledger is registered for the governed erasure';
  END IF;
END$$;

COMMIT;
