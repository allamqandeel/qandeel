-- S8B-07 RB-2 / M-2 — Direct Historical Binding: the live call's certified clock marks. Product Owner execution
-- authorization "RB-2 / M-2 + S3 PRODUCTION IMPLEMENTATION — Direct Historical Binding" of 2026-11-24 (CP2 / CP4), on
-- the M-2 design review (Option B, T = 1000 ms) and the HONOR device proof (CONDITIONAL GO, Android only). Not hosted.
--
-- ## The chain
--
--   semantic commit -> S1 ledger row (0201, its writer's xact_id) -> a database snapshot taken in a slot batch and
--   COMMITTED before the API sends CLOCK_MARK -> the phone answers MARK_ECHO with the capture position of the first frame
--   it captured at least 100 ms after the mark arrived -> the next slot batch persists the echo with the ledger prefix
--   that snapshot saw -> the seam (0202) gives the earliest certified capture position of a ledger row -> the S3 read.
--
--   Why it is never early: every ledger row visible in the snapshot committed before the snapshot was taken; the snapshot
--   committed before the mark was sent; the mark arrived before the echoed frame was captured. So the analysis of every
--   moment that row completes was committed before the audio at the echoed position was captured. A late, lost, skipped,
--   duplicated or reordered mark can only make a certification LATER (or absent: AFTER_END), never earlier.
--
-- ## What is added
--
--   A. voice_private.call_clock_snapshots — one row per slot batch: the instance, when, and pg_current_snapshot(). No
--      person, no call, no content. An instance only ever reads its own; its rows older than 120 s, and anyone's older
--      than one hour, are removed by the batch itself (bounded). No worker.
--   B. voice_private.call_clock_marks — WRITE-ON-CHANGE: a persisted echo exists only when its snapshot certifies a
--      LONGER contiguous ledger prefix (`certified_through`) than the call already holds. The first echo that reaches a
--      prefix is the earliest one for it (echoes rise with time, and so do snapshots), so nothing a later, equal echo
--      would add is lost; an echo is kept exactly when no held pair certifies as long a prefix at an earlier-or-equal
--      position. Keyed by (call, certified_through); a race between two connections keeps the smaller echo.
--   C. voice_private.call_clock_cert_ranges — the post-call COMPACTION of an ENDED call's marks: one row per call holding
--      only the Pareto-minimal (certified_through, echo) pairs. Idempotent: it merges what it already holds with any mark
--      persisted since, and deletes the marks it absorbed.
--   D. public.server_call_clock_slot_v1(instance, echoes…, compact…) — the ONE batched statement per slot: persist the
--      echoes (each against its own instance's snapshot), compact the named ENDED calls, collect old snapshots, and take
--      and return a fresh snapshot. service_role only. A failure persists nothing and returns nothing: the API then sends
--      no mark for that slot.
--   E. voice_private.replay_call_certified_capture_ms_v1 — the 0202 seam, now answered from B and C: the smallest echo
--      whose certified prefix reaches the asked row. Same signature, same posture.
--
-- ## What is deliberately NOT here
--
--   * No sweeper, no polling worker, no schedule, no event routing. `observed_at` / `trigger_at` are never read.
--   * No change to 0201 (frozen) or to the 0202 read. No user content: a mark is a call id, its owner, a connection
--     epoch, a mark number, a capture position and a ledger key.
--   * No iOS certification: the API never asks an iOS call for an echo (fail-closed, AFTER_END).
--   * No hosted deployment.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE SLOT SNAPSHOTS (A).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.call_clock_snapshots (
  snapshot_id bigint GENERATED ALWAYS AS IDENTITY,
  instance_id uuid NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  snapshot pg_snapshot NOT NULL,
  CONSTRAINT call_clock_snapshots_pk PRIMARY KEY (snapshot_id)
);
CREATE INDEX call_clock_snapshots_instance_idx ON voice_private.call_clock_snapshots (instance_id, snapshot_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE CERTIFIED MARKS (B), WRITE-ON-CHANGE.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.call_clock_marks (
  call_id uuid NOT NULL,
  certified_through_sp integer NOT NULL,
  certified_through_event_sequence bigint NOT NULL,
  user_id uuid NOT NULL,
  connection_epoch bigint NOT NULL,
  mark_seq integer NOT NULL,
  echo_capture_ms bigint NOT NULL,
  CONSTRAINT call_clock_marks_pk PRIMARY KEY (call_id, certified_through_sp, certified_through_event_sequence),
  CONSTRAINT call_clock_marks_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT call_clock_marks_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_clock_marks_shape_check CHECK (
    echo_capture_ms >= 0 AND echo_capture_ms % 20 = 0 AND connection_epoch >= 1 AND mark_seq >= 1
    AND certified_through_sp >= 1 AND certified_through_event_sequence >= 0)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE COMPACTED CERTIFICATION OF AN ENDED CALL (C).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.call_clock_cert_ranges (
  call_id uuid NOT NULL,
  user_id uuid NOT NULL,
  through_sp integer[] NOT NULL,
  through_event_sequence bigint[] NOT NULL,
  echo_capture_ms bigint[] NOT NULL,
  CONSTRAINT call_clock_cert_ranges_pk PRIMARY KEY (call_id),
  CONSTRAINT call_clock_cert_ranges_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id) ON DELETE CASCADE,
  CONSTRAINT call_clock_cert_ranges_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_clock_cert_ranges_shape_check CHECK (
    cardinality(through_sp) >= 1 AND cardinality(through_sp) = cardinality(through_event_sequence)
    AND cardinality(through_sp) = cardinality(echo_capture_ms))
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE SEAM (E): the earliest certified capture position at which the ledger prefix through (sp, seq) was committed.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION voice_private.replay_call_certified_capture_ms_v1(
  p_call_id uuid, p_through_sp integer, p_through_event_sequence bigint)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT least(
    (SELECT min(m.echo_capture_ms) FROM voice_private.call_clock_marks m
      WHERE m.call_id = p_call_id
        AND (m.certified_through_sp, m.certified_through_event_sequence) >= (p_through_sp, p_through_event_sequence)),
    (SELECT min(u.e) FROM voice_private.call_clock_cert_ranges r,
            unnest(r.through_sp, r.through_event_sequence, r.echo_capture_ms) AS u(sp, seq, e)
      WHERE r.call_id = p_call_id AND (u.sp, u.seq) >= (p_through_sp, p_through_event_sequence)))
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE PREFIX THE CALL ALREADY CERTIFIES AT OR BEFORE A CAPTURE POSITION, and the LONGER contiguous prefix a snapshot
--    sees above it. An echo is kept exactly when it is not dominated: no held pair certifies as long a prefix at an
--    earlier-or-equal position. So a requeued older echo still lands, and a later equal one never does.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.call_clock_held_prefix_v1(p_call_id uuid, p_echo_capture_ms bigint, OUT sp integer, OUT seq bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.sp, x.seq FROM (
    (SELECT m.certified_through_sp AS sp, m.certified_through_event_sequence AS seq FROM voice_private.call_clock_marks m
      WHERE m.call_id = p_call_id AND m.echo_capture_ms <= p_echo_capture_ms ORDER BY 1 DESC, 2 DESC LIMIT 1)
    UNION ALL
    (SELECT u.sp, u.seq FROM voice_private.call_clock_cert_ranges r,
            unnest(r.through_sp, r.through_event_sequence, r.echo_capture_ms) AS u(sp, seq, e)
      WHERE r.call_id = p_call_id AND u.e <= p_echo_capture_ms ORDER BY 1 DESC, 2 DESC LIMIT 1)) x
  ORDER BY 1 DESC, 2 DESC LIMIT 1
$$;

-- The rows commit in chain order (S1: the clock row lock serializes them), so the visible rows form a prefix; this still
-- stops at the FIRST row above the held prefix the snapshot does not see, so a later visible row never jumps a hole.
CREATE FUNCTION voice_private.call_clock_visible_prefix_v1(p_session_id uuid, p_snapshot pg_snapshot,
  p_after_sp integer, p_after_seq bigint, OUT sp integer, OUT seq bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH above AS (
    SELECT l.through_sp, l.through_event_sequence, pg_visible_in_snapshot(l.xact_id, p_snapshot) AS seen
      FROM public.session_semantic_commit_instants l
     WHERE l.session_id = p_session_id
       AND (p_after_sp IS NULL OR (l.through_sp, l.through_event_sequence) > (p_after_sp, p_after_seq))),
  hole AS (SELECT a.through_sp, a.through_event_sequence FROM above a WHERE NOT a.seen
            ORDER BY 1, 2 LIMIT 1)
  SELECT a.through_sp, a.through_event_sequence FROM above a
   WHERE a.seen AND NOT EXISTS (SELECT 1 FROM hole h
                                 WHERE (a.through_sp, a.through_event_sequence) > (h.through_sp, h.through_event_sequence))
   ORDER BY 1 DESC, 2 DESC LIMIT 1
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. COMPACTION (C): an ENDED call's marks and ranges become its Pareto-minimal pairs, in one row. Idempotent.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.compact_call_clock_marks_v1(p_call_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid;
  v_sp integer[];
  v_seq bigint[];
  v_echo bigint[];
BEGIN
  SELECT c.user_id INTO v_user FROM voice_private.calls c WHERE c.id = p_call_id AND c.state = 'ENDED' FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  WITH pts AS (
    SELECT m.certified_through_sp AS sp, m.certified_through_event_sequence AS seq, m.echo_capture_ms AS e
      FROM voice_private.call_clock_marks m WHERE m.call_id = p_call_id
    UNION ALL
    SELECT u.sp, u.seq, u.e FROM voice_private.call_clock_cert_ranges r,
           unnest(r.through_sp, r.through_event_sequence, r.echo_capture_ms) AS u(sp, seq, e)
     WHERE r.call_id = p_call_id),
  best AS (SELECT p.sp, p.seq, min(p.e) AS e FROM pts p GROUP BY p.sp, p.seq),
  -- A pair is kept only if every LONGER prefix needs a LATER echo: otherwise the longer one already answers it.
  pareto AS (SELECT b.sp, b.seq, b.e,
                    min(b.e) OVER (ORDER BY b.sp DESC, b.seq DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS later
               FROM best b)
  SELECT array_agg(p.sp ORDER BY p.sp, p.seq), array_agg(p.seq ORDER BY p.sp, p.seq), array_agg(p.e ORDER BY p.sp, p.seq)
    INTO v_sp, v_seq, v_echo
    FROM pareto p WHERE p.later IS NULL OR p.e < p.later;
  IF v_sp IS NULL THEN RETURN false; END IF;
  INSERT INTO voice_private.call_clock_cert_ranges AS r (call_id, user_id, through_sp, through_event_sequence, echo_capture_ms)
  VALUES (p_call_id, v_user, v_sp, v_seq, v_echo)
  ON CONFLICT (call_id) DO UPDATE SET through_sp = EXCLUDED.through_sp,
                                      through_event_sequence = EXCLUDED.through_event_sequence,
                                      echo_capture_ms = EXCLUDED.echo_capture_ms
   WHERE (r.through_sp, r.through_event_sequence, r.echo_capture_ms)
         IS DISTINCT FROM (EXCLUDED.through_sp, EXCLUDED.through_event_sequence, EXCLUDED.echo_capture_ms);
  DELETE FROM voice_private.call_clock_marks m WHERE m.call_id = p_call_id;
  RETURN true;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE SLOT BATCH (D): one statement per slot, for the calling instance only.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_call_clock_slot_v1(
  p_instance_id uuid,
  p_call_ids uuid[], p_connection_epochs bigint[], p_mark_seqs integer[], p_snapshot_ids bigint[], p_echo_capture_ms bigint[],
  p_compact_call_ids uuid[])
RETURNS TABLE (snapshot_id bigint, persisted integer, compacted integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  n integer := coalesce(cardinality(p_call_ids), 0);
  e record;
  v_held record;
  v_seen record;
  v_persisted integer := 0;
  v_compacted integer := 0;
  v_snapshot bigint;
  v_call uuid;
BEGIN
  IF p_instance_id IS NULL OR n > 2000 OR coalesce(cardinality(p_compact_call_ids), 0) > 2000
     OR n <> coalesce(cardinality(p_connection_epochs), 0) OR n <> coalesce(cardinality(p_mark_seqs), 0)
     OR n <> coalesce(cardinality(p_snapshot_ids), 0) OR n <> coalesce(cardinality(p_echo_capture_ms), 0) THEN
    RAISE EXCEPTION 'RB-2 M-2: malformed slot batch' USING ERRCODE = '22023';
  END IF;

  -- Echoes: only this instance's own, unexpired snapshots certify; anything else is dropped, never raised. Per call in
  -- capture order, an echo is kept only if its snapshot sees a LONGER contiguous prefix than the call already holds.
  FOR e IN
    SELECT x.call_id, x.epoch, x.mark_seq, x.echo, s.snapshot, c.user_id, c.session_id
      FROM unnest(p_call_ids, p_connection_epochs, p_mark_seqs, p_snapshot_ids, p_echo_capture_ms)
             AS x(call_id, epoch, mark_seq, snapshot_id, echo)
      JOIN voice_private.call_clock_snapshots s
        ON s.snapshot_id = x.snapshot_id AND s.instance_id = p_instance_id
       AND s.taken_at >= clock_timestamp() - interval '120 seconds'
      JOIN voice_private.calls c ON c.id = x.call_id
     WHERE x.echo IS NOT NULL AND x.echo >= 0 AND x.echo % 20 = 0 AND x.epoch >= 1 AND x.mark_seq >= 1
     ORDER BY x.call_id, x.echo, x.snapshot_id
  LOOP
    SELECT * INTO v_held FROM voice_private.call_clock_held_prefix_v1(e.call_id, e.echo);
    SELECT * INTO v_seen FROM voice_private.call_clock_visible_prefix_v1(e.session_id, e.snapshot, v_held.sp, v_held.seq);
    CONTINUE WHEN v_seen.sp IS NULL;
    INSERT INTO voice_private.call_clock_marks AS m
      (call_id, certified_through_sp, certified_through_event_sequence, user_id, connection_epoch, mark_seq, echo_capture_ms)
    VALUES (e.call_id, v_seen.sp, v_seen.seq, e.user_id, e.epoch, e.mark_seq, e.echo)
    ON CONFLICT (call_id, certified_through_sp, certified_through_event_sequence) DO UPDATE
      SET echo_capture_ms = EXCLUDED.echo_capture_ms, connection_epoch = EXCLUDED.connection_epoch, mark_seq = EXCLUDED.mark_seq
      WHERE EXCLUDED.echo_capture_ms < m.echo_capture_ms;
    v_persisted := v_persisted + 1;
  END LOOP;

  -- Compaction of the named calls that have ENDED (a live one is left alone).
  FOREACH v_call IN ARRAY coalesce(p_compact_call_ids, ARRAY[]::uuid[]) LOOP
    IF voice_private.compact_call_clock_marks_v1(v_call) THEN v_compacted := v_compacted + 1; END IF;
  END LOOP;

  -- Collection, bounded: this instance's snapshots past the echo lifetime, and anyone's left by a stopped instance.
  DELETE FROM voice_private.call_clock_snapshots s
   WHERE s.instance_id = p_instance_id AND s.taken_at < clock_timestamp() - interval '120 seconds';
  DELETE FROM voice_private.call_clock_snapshots s
   WHERE s.snapshot_id IN (SELECT o.snapshot_id FROM voice_private.call_clock_snapshots o ORDER BY o.snapshot_id LIMIT 50)
     AND s.taken_at < clock_timestamp() - interval '1 hour';

  -- The fresh snapshot, LAST: it is what the marks of this slot are sent against, once this statement has committed.
  INSERT INTO voice_private.call_clock_snapshots (instance_id, snapshot)
  VALUES (p_instance_id, pg_current_snapshot()) RETURNING call_clock_snapshots.snapshot_id INTO v_snapshot;
  RETURN QUERY SELECT v_snapshot, v_persisted, v_compacted;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. ACCOUNT ERASURE COVERAGE. The marks and ranges name a person and cascade from the account (and from the call).
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.call_clock_marks', 'ACCOUNT_CASCADE'),
    ('voice_private.call_clock_cert_ranges', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. OWNERSHIP, RLS AND ACL. No role holds a privilege on a new relation; service_role executes the slot batch only.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.call_clock_snapshots', 'voice_private.call_clock_marks',
                             'voice_private.call_clock_cert_ranges'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r); END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)',
    'voice_private.call_clock_held_prefix_v1(uuid,bigint)',
    'voice_private.call_clock_visible_prefix_v1(uuid,pg_snapshot,integer,bigint)',
    'voice_private.compact_call_clock_marks_v1(uuid)',
    'public.server_call_clock_slot_v1(uuid,uuid[],bigint[],integer[],bigint[],bigint[],uuid[])'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.server_call_clock_slot_v1(uuid,uuid[],bigint[],integer[],bigint[],bigint[],uuid[]) TO service_role;
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
  v_count integer;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)',
    'voice_private.call_clock_held_prefix_v1(uuid,bigint)',
    'voice_private.call_clock_visible_prefix_v1(uuid,pg_snapshot,integer,bigint)',
    'voice_private.compact_call_clock_marks_v1(uuid)',
    'public.server_call_clock_slot_v1(uuid,uuid[],bigint[],integer[],bigint[],bigint[],uuid[])'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef AND p.proowner = 'postgres'::regrole
                      AND p.proconfig = ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'RB-2 M-2: % is not a postgres-owned, search_path-pinned definer', fn;
    END IF;
    IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure) ~* '(EXCEPTION\s+WHEN|\mEXECUTE\M|40001|40P01|PT409|observed_at|trigger_at)' THEN
      RAISE EXCEPTION 'RB-2 M-2: % must hold no handler, no dynamic SQL, no retryable SQLSTATE and no ledger wall clock', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'RB-2 M-2: % is reachable by %', fn, r;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
       AND has_function_privilege('service_role', fn, 'EXECUTE') <> (fn LIKE 'public.%') THEN
      RAISE EXCEPTION 'RB-2 M-2: service_role must reach exactly the slot batch (%)', fn;
    END IF;
  END LOOP;
  IF (SELECT p.provolatile FROM pg_proc p WHERE p.oid = 'voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)'::regprocedure) <> 's' THEN
    RAISE EXCEPTION 'RB-2 M-2: the seam must stay STABLE';
  END IF;
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN RAISE EXCEPTION 'RB-2 M-2: a relation referencing the account is unregistered'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.table_name LIKE 'call\_clock\_%'
                AND g.grantee IN ('anon', 'authenticated', 'service_role', 'qandeel_replay_media', 'PUBLIC')) THEN
    RAISE EXCEPTION 'RB-2 M-2: a clock relation is reachable by a role';
  END IF;
END$$;

COMMIT;
