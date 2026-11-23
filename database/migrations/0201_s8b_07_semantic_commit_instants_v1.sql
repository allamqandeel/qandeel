-- S8B-07 RB-2 / S1 — the semantic commit instants: for every Session, which transaction made which range of its semantic
-- clock durable, and when that range was first SEEN committed. The historical-availability authority Replay will read in
-- a later, separately authorized slice. Product Owner authorization "RB-2/S1 ONLY" of 2026-11-23 (D-RB2-1, D-RB2-5a,
-- D-RB2-7a, D-RB2-9, D-RB2-11), RB-2 Final Execution Contract v1.1 and its v1.1.1 addendum. Not hosted.
--
-- ## What is added
--
--   A. public.session_semantic_commit_instants — APPEND-ONLY, one row per (Session, committing transaction) that moved the
--      Session semantic clock (0065 public.session_semantic_clocks): the clock range (from, through] the transaction made
--      durable, the transaction's identity (xact_id = pg_current_xact_id(), xid8), trigger_at and observed_at.
--        * from = (0, 0) means the Session's origin (covers_from_sp1); a first row whose from is a real position is the
--          deploy boundary: the clock had moved before this ledger existed, and the row says it does not cover the origin.
--        * trigger_at = clock_timestamp() when the recorder last ran for the transaction: a LOWER bound of the commit,
--          never the commit instant.
--        * observed_at = NULL until a LATER transaction whose statement SEES the committed row stamps it, exactly once.
--   B. The recorder: a DEFERRABLE INITIALLY DEFERRED constraint trigger, AFTER UPDATE FOR EACH ROW on the clock — a
--      controlled trigger ADDITION (D-RB2-7a): the clock's columns, its writers, its lock order and its authority are
--      unchanged, and no existing function is replaced. One semantic transaction moves the clock 1 + N times (the CU's
--      new Position, then each same-Position reservation), so the recorder never trusts NEW: every firing reads the clock
--      as it stands and, keyed by TRANSACTION IDENTITY, either inserts the transaction's one row or FOLDS the further
--      movement into it. Under the default (deferred) timing every firing happens at COMMIT and only the first one writes;
--      under SET CONSTRAINTS ... IMMEDIATE each firing happens at its statement's end and the later ones fold. A no-op
--      UPDATE (nothing advanced) records nothing and aborts nothing. A clock that would move backwards, or a ledger that
--      does not agree with the clock, aborts the transaction (55000): a ledger write failure is NEVER swallowed — there
--      is no exception handler anywhere in this migration, and a failed recording fails the semantic commit with it.
--   C. The guard (BEFORE INSERT OR UPDATE OR DELETE): the ledger enforces transaction identity itself, never relying on
--      the order of its through values alone —
--        INSERT  only under the writing transaction's own identity, unobserved, continuing the Session's chain exactly
--                (from = the latest row's through) and never as a second row of a transaction already in the chain
--                (with UNIQUE (session_id, xact_id) and UNIQUE (session_id, from) beside it);
--        UPDATE  only the FOLD (the same transaction, unobserved, through moving forward, nothing else) or the ONE
--                OBSERVATION (observed_at NULL -> a value, nothing else, by a DIFFERENT transaction than the writer);
--        DELETE  only inside the governed Personal erasure (0130), which reaches the ledger by the cascade from the Session.
--   D. Two service_role definers, NOT wired to the API and run by NO scheduler in this slice:
--        server_observe_session_semantic_commits_v1(p_session_id)   observe one Session's committed, unobserved rows
--        server_observe_unobserved_semantic_commits_v1(p_limit)      the sweeper: the oldest unobserved rows, 1..1000
--      Both stamp observed_at = GREATEST(clock_timestamp(), trigger_at) on the rows their own statement sees, skip the
--      calling transaction's own rows, and are idempotent (a stamped row is never stamped again).
--
-- ## The authority is MVCC visibility, not a clock
--
--   A row is visible to another transaction only once its writer has committed; the observer's UPDATE can stamp only rows
--   its own snapshot sees. So "observed_at was written after the commit became visible" is proven by visibility, by
--   construction. The NUMERIC values (trigger_at, observed_at) are recorded and may be compared as diagnostics; no
--   ordering in this migration, and none that S1 claims, rests on comparing them. The GREATEST() clamp keeps the stored
--   pair self-consistent under a backward clock step; it proves nothing about order.
--
-- ## Posture (D-RB2-9)
--
--   Restricted: postgres-owned, RLS with no policy, no privilege for anon / authenticated / service_role /
--   qandeel_replay_media. The row leaves with its Session (ON DELETE CASCADE from (id, user_id), the 0197 precedent) and
--   only inside the governed Personal erasure. Export: the 0130 Personal export package deliberately carries no engine
--   internals (no Session clock, no commit event, no internal id); this ledger is engine timing of the same class and is
--   NOT added to it, which narrows nothing the export carries today. Whether a future export must carry it is a Product
--   Owner decision, recorded with this slice, not taken by it.
--
-- ## What is deliberately NOT here
--
--   * No API observer call, no worker, no schedule (S2); no Replay read (0202, S2/S3); no transport, no mobile change, no
--     MP4 export, no live-call protocol change (the M-2 capture echo is a separate design review, D-RB2-10).
--   * No backfill: Sessions whose clock moved before this migration get their first row at their next semantic commit,
--     as a deploy-boundary row (covers_from_sp1 = false). Nothing claims availability for what was committed before it.
--   * No replacement of any existing function, no change to the clock's columns, writers or lock order, no 40001 / 40P01
--     / PT409 raise (PROD-RETRY-01, 0150), no EXECUTE in any body, no hosted deployment, no capability gate opened.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE LEDGER (A).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.session_semantic_commit_instants (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  from_sp integer NOT NULL,
  from_event_sequence bigint NOT NULL,
  through_sp integer NOT NULL,
  through_event_sequence bigint NOT NULL,
  covers_from_sp1 boolean GENERATED ALWAYS AS (from_sp = 0) STORED,
  xact_id xid8 NOT NULL,
  trigger_at timestamptz NOT NULL,
  observed_at timestamptz,
  CONSTRAINT session_semantic_commit_instants_pk PRIMARY KEY (session_id, through_sp, through_event_sequence),
  CONSTRAINT session_semantic_commit_instants_xact_unique UNIQUE (session_id, xact_id),
  CONSTRAINT session_semantic_commit_instants_from_unique UNIQUE (session_id, from_sp, from_event_sequence),
  CONSTRAINT session_semantic_commit_instants_session_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE CASCADE,
  CONSTRAINT session_semantic_commit_instants_from_check
    CHECK (from_event_sequence >= 0 AND (from_sp >= 1 OR (from_sp = 0 AND from_event_sequence = 0))),
  CONSTRAINT session_semantic_commit_instants_through_check CHECK (through_sp >= 1 AND through_event_sequence >= 0),
  CONSTRAINT session_semantic_commit_instants_range_check
    CHECK ((from_sp, from_event_sequence) < (through_sp, through_event_sequence)),
  CONSTRAINT session_semantic_commit_instants_observed_check CHECK (observed_at IS NULL OR observed_at >= trigger_at)
);
CREATE INDEX session_semantic_commit_instants_unobserved_idx
  ON public.session_semantic_commit_instants (trigger_at) WHERE observed_at IS NULL;

ALTER TABLE public.session_semantic_commit_instants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.session_semantic_commit_instants FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.session_semantic_commit_instants FROM %I', r);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE GUARD (C).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.guard_session_semantic_commit_instant_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  this_xact xid8;
  predecessor public.session_semantic_commit_instants;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- The governed Personal erasure (0130) alone removes a row, through the cascade from the Session.
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
    RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_IMMUTABLE' USING ERRCODE = '55000',
      DETAIL = 'Only the governed Personal erasure removes a semantic commit instant.';
  END IF;
  this_xact := pg_catalog.pg_current_xact_id();
  IF TG_OP = 'INSERT' THEN
    IF NEW.xact_id IS DISTINCT FROM this_xact OR NEW.observed_at IS NOT NULL THEN
      RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_IDENTITY' USING ERRCODE = '55000',
        DETAIL = 'A semantic commit instant is written only by its own transaction, and unobserved.';
    END IF;
    SELECT * INTO predecessor FROM public.session_semantic_commit_instants l
     WHERE l.session_id = NEW.session_id
     ORDER BY l.through_sp DESC, l.through_event_sequence DESC LIMIT 1;
    IF FOUND AND (predecessor.xact_id = NEW.xact_id
                  OR predecessor.user_id <> NEW.user_id
                  OR (NEW.from_sp, NEW.from_event_sequence) <> (predecessor.through_sp, predecessor.through_event_sequence)) THEN
      RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_CHAIN' USING ERRCODE = '55000',
        DETAIL = 'A new row continues the Session chain exactly, from a different transaction than the latest row.';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: the one observation, by a later transaction than the writer.
  IF OLD.observed_at IS NULL AND NEW.observed_at IS NOT NULL AND OLD.xact_id <> this_xact
     AND (NEW.session_id, NEW.user_id, NEW.from_sp, NEW.from_event_sequence, NEW.through_sp, NEW.through_event_sequence,
          NEW.xact_id, NEW.trigger_at)
         IS NOT DISTINCT FROM
         (OLD.session_id, OLD.user_id, OLD.from_sp, OLD.from_event_sequence, OLD.through_sp, OLD.through_event_sequence,
          OLD.xact_id, OLD.trigger_at) THEN
    RETURN NEW;
  END IF;
  -- UPDATE: the fold, by the writing transaction itself, forward only.
  IF OLD.xact_id = this_xact AND NEW.xact_id = this_xact AND OLD.observed_at IS NULL AND NEW.observed_at IS NULL
     AND (NEW.session_id, NEW.user_id, NEW.from_sp, NEW.from_event_sequence)
         IS NOT DISTINCT FROM (OLD.session_id, OLD.user_id, OLD.from_sp, OLD.from_event_sequence)
     AND (NEW.through_sp, NEW.through_event_sequence) > (OLD.through_sp, OLD.through_event_sequence)
     AND NEW.trigger_at >= OLD.trigger_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_IMMUTABLE' USING ERRCODE = '55000',
    DETAIL = 'A semantic commit instant is folded only by its own transaction and observed only once, by a later one.';
END$$;

CREATE TRIGGER session_semantic_commit_instants_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.session_semantic_commit_instants
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_semantic_commit_instant_mutation_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE RECORDER (B).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.record_session_semantic_commit_instant_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  this_xact xid8 := pg_catalog.pg_current_xact_id();
  clock_row public.session_semantic_clocks;
  latest public.session_semantic_commit_instants;
  has_latest boolean;
  final_sp integer;
  final_sequence bigint;
  start_sp integer;
  start_sequence bigint;
  folded integer;
BEGIN
  -- The clock as it stands NOW, never NEW: the transaction may have moved it again since this event was queued.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c WHERE c.session_id = NEW.session_id;
  IF NOT FOUND OR clock_row.current_sp IS NULL THEN
    RETURN NULL;
  END IF;
  final_sp := clock_row.current_sp;
  final_sequence := clock_row.same_sp_event_sequence;
  SELECT * INTO latest FROM public.session_semantic_commit_instants l
   WHERE l.session_id = clock_row.session_id
   ORDER BY l.through_sp DESC, l.through_event_sequence DESC LIMIT 1;
  has_latest := FOUND;

  IF has_latest AND latest.xact_id = this_xact THEN
    -- This transaction already holds its row: fold the further movement into it, forward only.
    IF (final_sp, final_sequence) = (latest.through_sp, latest.through_event_sequence) THEN
      RETURN NULL;
    END IF;
    IF (final_sp, final_sequence) < (latest.through_sp, latest.through_event_sequence) THEN
      RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_INTEGRITY' USING ERRCODE = '55000',
        DETAIL = 'The Session semantic clock moved backwards inside one transaction.';
    END IF;
    UPDATE public.session_semantic_commit_instants l
       SET through_sp = final_sp, through_event_sequence = final_sequence,
           trigger_at = GREATEST(l.trigger_at, pg_catalog.clock_timestamp())
     WHERE l.session_id = clock_row.session_id AND l.xact_id = this_xact;
    GET DIAGNOSTICS folded = ROW_COUNT;
    IF folded <> 1 THEN
      RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_INTEGRITY' USING ERRCODE = '55000',
        DETAIL = 'The transaction''s own semantic commit instant could not be folded.';
    END IF;
    RETURN NULL;
  END IF;

  -- A transaction not yet in the chain starts where the chain ends; with no chain, at the origin or the deploy boundary.
  IF has_latest THEN
    start_sp := latest.through_sp;
    start_sequence := latest.through_event_sequence;
  ELSIF OLD.current_sp IS NULL THEN
    start_sp := 0;
    start_sequence := 0;
  ELSE
    start_sp := OLD.current_sp;
    start_sequence := OLD.same_sp_event_sequence;
  END IF;
  IF (final_sp, final_sequence) = (start_sp, start_sequence) THEN
    RETURN NULL;
  END IF;
  IF (final_sp, final_sequence) < (start_sp, start_sequence) THEN
    RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_INTEGRITY' USING ERRCODE = '55000',
      DETAIL = 'The Session semantic clock is behind its recorded semantic commits.';
  END IF;
  INSERT INTO public.session_semantic_commit_instants (
    session_id, user_id, from_sp, from_event_sequence, through_sp, through_event_sequence, xact_id, trigger_at)
  VALUES (clock_row.session_id, clock_row.user_id, start_sp, start_sequence, final_sp, final_sequence, this_xact,
          pg_catalog.clock_timestamp());
  RETURN NULL;
END$$;

CREATE CONSTRAINT TRIGGER session_semantic_clocks_record_commit_instant
  AFTER UPDATE ON public.session_semantic_clocks
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.record_session_semantic_commit_instant_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE OBSERVER AND THE SWEEPER (D). Not wired; nothing calls them in this slice.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_observe_session_semantic_commits_v1(p_session_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE stamped integer;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SESSION_ID' USING ERRCODE = '22023';
  END IF;
  -- Only rows this statement SEES are stamped: rows of a transaction still in progress are invisible, and the calling
  -- transaction's own rows (visible to it, not yet committed) are skipped.
  UPDATE public.session_semantic_commit_instants l
     SET observed_at = GREATEST(pg_catalog.clock_timestamp(), l.trigger_at)
   WHERE l.session_id = p_session_id AND l.observed_at IS NULL AND l.xact_id <> pg_catalog.pg_current_xact_id();
  GET DIAGNOSTICS stamped = ROW_COUNT;
  RETURN stamped;
END$$;

CREATE FUNCTION public.server_observe_unobserved_semantic_commits_v1(p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE stamped integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'INVALID_LIMIT' USING ERRCODE = '22023';
  END IF;
  WITH due AS (
    SELECT l.session_id, l.through_sp, l.through_event_sequence
      FROM public.session_semantic_commit_instants l
     WHERE l.observed_at IS NULL AND l.xact_id <> pg_catalog.pg_current_xact_id()
     ORDER BY l.trigger_at, l.session_id, l.through_sp, l.through_event_sequence
     LIMIT p_limit
       FOR UPDATE SKIP LOCKED)
  UPDATE public.session_semantic_commit_instants l
     SET observed_at = GREATEST(pg_catalog.clock_timestamp(), l.trigger_at)
    FROM due
   WHERE l.session_id = due.session_id AND l.through_sp = due.through_sp
     AND l.through_event_sequence = due.through_event_sequence AND l.observed_at IS NULL;
  GET DIAGNOSTICS stamped = ROW_COUNT;
  RETURN stamped;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. OWNERSHIP AND ACL: the observer and the sweeper to service_role only; the recorder and the guard to nobody.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  servers text[] := ARRAY[
    'public.server_observe_session_semantic_commits_v1(uuid)',
    'public.server_observe_unobserved_semantic_commits_v1(integer)'];
  internals text[] := ARRAY[
    'public.record_session_semantic_commit_instant_v1()',
    'public.guard_session_semantic_commit_instant_mutation_v1()'];
  fn text; r text;
BEGIN
  FOREACH fn IN ARRAY servers || internals LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOREACH fn IN ARRAY servers LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn); END LOOP;
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE fn text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                  WHERE t.tgrelid = 'public.session_semantic_clocks'::regclass
                    AND t.tgname = 'session_semantic_clocks_record_commit_instant'
                    AND t.tgconstraint <> 0 AND t.tgdeferrable AND t.tginitdeferred AND t.tgenabled = 'O'
                    AND t.tgtype = 17 /* ROW | UPDATE, AFTER */
                    AND t.tgfoid = 'public.record_session_semantic_commit_instant_v1()'::regprocedure) THEN
    RAISE EXCEPTION 'RB-2 S1: the recorder is not a deferred AFTER UPDATE row constraint trigger on the clock';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                  WHERE t.tgrelid = 'public.session_semantic_commit_instants'::regclass
                    AND t.tgname = 'session_semantic_commit_instants_guard' AND t.tgenabled = 'O'
                    AND t.tgtype = 31 /* ROW | BEFORE | INSERT | DELETE | UPDATE */) THEN
    RAISE EXCEPTION 'RB-2 S1: the ledger is not guarded before every row write';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.session_semantic_commit_instants'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = 'public.session_semantic_commit_instants'::regclass) THEN
    RAISE EXCEPTION 'RB-2 S1: the ledger must carry RLS with no policy';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'public' AND g.table_name = 'session_semantic_commit_instants'
                AND g.grantee IN ('anon', 'authenticated', 'service_role', 'qandeel_replay_media', 'PUBLIC')) THEN
    RAISE EXCEPTION 'RB-2 S1: a client role holds a privilege on the ledger';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                  WHERE c.conrelid = 'public.session_semantic_commit_instants'::regclass AND c.contype = 'f'
                    AND c.confrelid = 'public.conversation_sessions'::regclass AND c.confdeltype = 'c') THEN
    RAISE EXCEPTION 'RB-2 S1: the ledger must leave with its Session';
  END IF;
  FOREACH fn IN ARRAY ARRAY['public.record_session_semantic_commit_instant_v1()',
                            'public.server_observe_session_semantic_commits_v1(uuid)',
                            'public.server_observe_unobserved_semantic_commits_v1(integer)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef AND p.proowner = 'postgres'::regrole
                      AND p.proconfig = ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'RB-2 S1: % is not a postgres-owned, search_path-pinned definer', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['public.record_session_semantic_commit_instant_v1()',
                            'public.guard_session_semantic_commit_instant_mutation_v1()',
                            'public.server_observe_session_semantic_commits_v1(uuid)',
                            'public.server_observe_unobserved_semantic_commits_v1(integer)'] LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') OR has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'RB-2 S1: % is reachable by a client role', fn;
    END IF;
    IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure) ~* '(EXCEPTION\s+WHEN|\mEXECUTE\M|40001|40P01|PT409)' THEN
      RAISE EXCEPTION 'RB-2 S1: % must not hold a handler, dynamic SQL or a retryable SQLSTATE', fn;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     AND (has_function_privilege('service_role', 'public.record_session_semantic_commit_instant_v1()', 'EXECUTE')
          OR NOT has_function_privilege('service_role', 'public.server_observe_session_semantic_commits_v1(uuid)', 'EXECUTE')
          OR NOT has_function_privilege('service_role', 'public.server_observe_unobserved_semantic_commits_v1(integer)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'RB-2 S1: service_role must reach exactly the observer and the sweeper';
  END IF;
END$$;

COMMIT;
