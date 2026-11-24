-- S8B-07 RB-2 / S3 — the Replay historical availability read: for every moment of a Replay version, WHEN its analysis
-- may appear, read from the S1 semantic commit instants (0201) and from the call clock certification seam. Product
-- Owner execution authorization "RB-2 / M-2 + S3 PRODUCTION IMPLEMENTATION — Direct Historical Binding" of 2026-11-24
-- (CP1), RB-2 Execution Contract v1.1 §6.1 / §8 as amended by that authorization (Direct Historical Binding: no
-- observer, no sweeper, no Tier 1). Not hosted.
--
-- ## What is added
--
--   A. voice_private.replay_call_certified_capture_ms_v1(call, through_sp, through_event_sequence) — THE CERTIFICATION
--      SEAM: the earliest capture position of the call at which the ledger prefix ending at `through` is CERTIFIED
--      committed, or NULL. In this migration it answers NULL for every call: nothing certifies a position yet, so every
--      RECORDED moment is placed AFTER_END. Migration 0203 (M-2, the snapshot-stamped capture echo) replaces its body
--      with the certified marks; nothing else changes when it does.
--   B. public.server_read_replay_version_availability_v1(user, replay, version) — THE READ, for the Replay pool's role
--      only. One row per moment of the creator's own CURRENT version, each carrying the version binding (replay id,
--      version id, revision, the V2 source window binding digest) and the ledger watermark the answer was read at:
--
--        availability_state  RECORDED       the Session's ledger covers its origin and is one unbroken chain, and the
--                                           moment's completing row is in it; placement says where:
--                              placement      IN_RECORDING  run_ordinal + clock_ms (the run's recording clock, never a
--                                                           file position: the Replay media service translates it with
--                                                           the run timeline the file is mixed with, at or after)
--                                             AFTER_END     no certified position inside the presented recordings
--                            UNESTABLISHED  the Session has no ledger row, or its first row is the deploy boundary
--                                           (covers_from_sp1 = false): nothing is claimed for any of its moments
--                            BROKEN         the chain is not continuous, or the moment's completing row is missing
--                            ORDINAL_ONLY   a V1 version: no audio, no time claim, reading pace only
--
--      Zero rows: not the person's own, not this Replay's version, not CURRENT, or a V2 version whose windows no longer
--      re-derive to its stored binding (the plan's own refusal). The caller cannot tell these apart, by design.
--
-- ## The moment's completing row (why the projection's sequence is NOT a coordinate)
--
--   A moment represents K(TC): every event at a Session Position <= TC (0072 §14). K(TC) is SEALED once the live head
--   passes TC, and every event that can belong to it is reserved while TC is still the open head (0065: the same-SP
--   seam reserves at the current position only). The completing row is therefore the FIRST ledger row whose `through`
--   passes TC: its commit is the earliest instant at which the sealed K(TC) is provably entirely committed. This is a
--   conservative bound — a row before it may already have carried the last event of TC, but the ledger records ranges,
--   not events, and a transaction that reserves at TC before moving the head would make that earlier row too early.
--   The point's `projection_same_sp_event_sequence` is the clock's sequence AT THE LIVE HEAD when the projection was
--   taken (0072:2572 `clock_sequence` of `lh`; 0102: "freshness tokens"), not a sequence at TC: it is never used here.
--
-- ## Certification and placement
--
--   The presented recordings are the plan's RUN rows (0195, the same rows the media service maps and mixes). For each
--   live-call recording among them whose call belongs to the version's Session, the seam gives the certified capture
--   position X of the completing row, or nothing. A position is placed in the FIRST run (in presentation order) of that
--   recording whose clock ends after X, at max(X, the run's clock start): everything presented there was captured after
--   the commit was certified. Of all calls, the earliest presented placement wins (run order, then clock). No placement:
--   AFTER_END. A text item, a Voice Note and a recording of another Session never certify.
--
-- ## Posture
--
--   Both functions are postgres-owned, search_path-pinned definers with no exception handler, no dynamic SQL and no
--   retryable SQLSTATE (0150). The read is executable by qandeel_replay_media only, the seam by nobody. Nothing is
--   written: the read is STABLE, so a Replay answer can never change the ledger, a call or a recording.
--
-- ## What is deliberately NOT here
--
--   * No mark, snapshot or echo table, no protocol change (0203 / M-2). No observer, no sweeper: `observed_at` and
--     `trigger_at` are never read as a time (S2 Alternative A is retired).
--   * No change to 0201, to the plan (0195), to the map (0196), to the renderer, the original audio or any existing
--     function. No new relation (the Replay census stays 36). No hosted deployment.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE CERTIFICATION SEAM (A). NULL until M-2 (0203) gives it certified marks.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.replay_call_certified_capture_ms_v1(
  p_call_id uuid, p_through_sp integer, p_through_event_sequence bigint)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NULL::bigint
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE READ (B).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_replay_version_availability_v1(
  p_user_id uuid, p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (replay_id uuid, replay_version_id uuid, replay_version_revision integer,
               source_window_binding_digest text, ledger_through_sp integer, ledger_through_event_sequence bigint,
               selected_ordinal integer, availability_state text, placement text, run_ordinal integer, clock_ms bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version public.replay_versions;
  v_contract public.replay_render_contract_versions;
  v_session uuid;
  v_availability text;
  v_plan_rows integer;
  v_run_recordings uuid[];
  v_run_starts bigint[];
  v_run_ends bigint[];
  v_ledger_rows integer;
  v_first_from_sp integer;
  v_breaks integer;
  v_head_sp integer;
  v_head_seq bigint;
  v_session_state text;
BEGIN
  IF p_user_id IS NULL OR p_replay_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AVAILABILITY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;

  -- 1. The creator's own version of this Replay, and CURRENT (the ONE availability derivation, I-06D).
  SELECT v.* INTO v_version FROM public.replay_versions v JOIN public.replays r ON r.id = v.replay_id
   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id AND r.created_by_user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT a.availability_state INTO v_availability
    FROM public.derive_replay_version_current_availability_v1(v_version.replay_id, v_version.id) a;
  IF v_availability IS DISTINCT FROM 'CURRENT' THEN
    RETURN;
  END IF;
  SELECT c.* INTO v_contract FROM public.replay_render_contract_versions c WHERE c.id = v_version.render_contract_version_id;
  SELECT m.personal_session_id INTO v_session FROM public.replay_source_manifest_versions m
   WHERE m.id = v_version.source_manifest_version_id;

  -- 2. The ledger watermark this answer is read at (NULL when the Session has no row).
  SELECT l.through_sp, l.through_event_sequence INTO v_head_sp, v_head_seq
    FROM public.session_semantic_commit_instants l WHERE l.session_id = v_session
   ORDER BY l.through_sp DESC, l.through_event_sequence DESC LIMIT 1;

  -- 3. A V1 version presents no audio: every moment is ORDINAL_ONLY.
  IF v_contract.contract_schema_id IS DISTINCT FROM 'QANDEEL_REPLAY_RENDER_CONTRACT_V2' THEN
    RETURN QUERY
      SELECT v_version.replay_id, v_version.id, v_version.replay_version_revision, NULL::text, v_head_sp, v_head_seq,
             p.selected_ordinal, 'ORDINAL_ONLY'::text, NULL::text, NULL::integer, NULL::bigint
        FROM public.replay_analytical_projection_points p
       WHERE p.projection_version_id = v_version.analytical_projection_version_id
       ORDER BY p.selected_ordinal;
    RETURN;
  END IF;

  -- 4. The presented recordings: the plan's runs, in presentation order. An empty plan is the plan's own refusal.
  SELECT count(*)::integer,
         array_agg(pl.recording_id ORDER BY pl.entry_ordinal) FILTER (WHERE pl.row_kind = 'RUN'),
         array_agg(pl.clock_start_ms ORDER BY pl.entry_ordinal) FILTER (WHERE pl.row_kind = 'RUN'),
         array_agg(pl.clock_end_ms ORDER BY pl.entry_ordinal) FILTER (WHERE pl.row_kind = 'RUN')
    INTO v_plan_rows, v_run_recordings, v_run_starts, v_run_ends
    FROM public.resolve_replay_version_audio_plan_v1(p_user_id, v_version.id) pl;
  IF v_plan_rows = 0 THEN
    RETURN;
  END IF;

  -- 5. The Session's chain: covered from its origin, one unbroken chain.
  SELECT count(*)::integer,
         min(c.from_sp) FILTER (WHERE c.k = 1),
         count(*) FILTER (WHERE c.k > 1 AND (c.from_sp, c.from_event_sequence) IS DISTINCT FROM (c.prev_sp, c.prev_seq))::integer
    INTO v_ledger_rows, v_first_from_sp, v_breaks
    FROM (SELECT l.from_sp, l.from_event_sequence,
                 lag(l.through_sp) OVER w AS prev_sp, lag(l.through_event_sequence) OVER w AS prev_seq,
                 row_number() OVER w AS k
            FROM public.session_semantic_commit_instants l WHERE l.session_id = v_session
          WINDOW w AS (ORDER BY l.through_sp, l.through_event_sequence)) c;
  v_session_state := CASE
    WHEN v_ledger_rows = 0 OR v_first_from_sp <> 0 THEN 'UNESTABLISHED'
    WHEN v_breaks > 0 THEN 'BROKEN'
    ELSE 'RECORDED' END;

  RETURN QUERY
    WITH points AS (
      SELECT p.selected_ordinal AS ord, p.represented_session_position AS tc
        FROM public.replay_analytical_projection_points p
       WHERE p.projection_version_id = v_version.analytical_projection_version_id
    ), runs AS (
      SELECT u.n::integer AS n, u.rec, u.a, u.b
        FROM unnest(coalesce(v_run_recordings, ARRAY[]::uuid[]), coalesce(v_run_starts, ARRAY[]::bigint[]),
                    coalesce(v_run_ends, ARRAY[]::bigint[])) WITH ORDINALITY AS u(rec, a, b, n)
    ), calls AS (
      -- Only a live call of the version's own Session can certify; a Voice Note has no call.
      SELECT DISTINCT r.id AS rec, r.call_id AS call
        FROM voice_private.recordings r JOIN voice_private.calls c ON c.id = r.call_id
       WHERE r.id IN (SELECT runs.rec FROM runs) AND r.recording_kind = 'LIVE_CALL'
         AND c.session_id = v_session AND c.user_id = p_user_id
    ), completing AS (
      -- The first row whose through passes TC (see the header): the earliest commit of the sealed K(TC).
      SELECT pt.ord, t.through_sp AS sp, t.through_event_sequence AS seq
        FROM points pt
        LEFT JOIN LATERAL (
          SELECT l.through_sp, l.through_event_sequence FROM public.session_semantic_commit_instants l
           WHERE l.session_id = v_session AND l.through_sp > pt.tc
           ORDER BY l.through_sp, l.through_event_sequence LIMIT 1) t ON true
    ), certified AS (
      SELECT k.ord, cl.rec, voice_private.replay_call_certified_capture_ms_v1(cl.call, k.sp, k.seq) AS x
        FROM completing k CROSS JOIN calls cl
       WHERE k.sp IS NOT NULL AND v_session_state = 'RECORDED'
    ), placed AS (
      SELECT DISTINCT ON (ce.ord) ce.ord, ru.n, greatest(ce.x, ru.a) AS at
        FROM certified ce JOIN runs ru ON ru.rec = ce.rec AND ru.b > ce.x
       WHERE ce.x IS NOT NULL
       ORDER BY ce.ord, ru.n, greatest(ce.x, ru.a)
    )
    SELECT v_version.replay_id, v_version.id, v_version.replay_version_revision, v_contract.source_window_binding_digest,
           v_head_sp, v_head_seq, k.ord,
           CASE WHEN v_session_state <> 'RECORDED' THEN v_session_state
                WHEN k.sp IS NULL THEN 'BROKEN'
                ELSE 'RECORDED' END,
           CASE WHEN v_session_state <> 'RECORDED' OR k.sp IS NULL THEN NULL
                WHEN pc.ord IS NOT NULL THEN 'IN_RECORDING'
                ELSE 'AFTER_END' END,
           CASE WHEN v_session_state = 'RECORDED' AND k.sp IS NOT NULL THEN pc.n END,
           CASE WHEN v_session_state = 'RECORDED' AND k.sp IS NOT NULL THEN pc.at END
      FROM completing k LEFT JOIN placed pc ON pc.ord = k.ord
     ORDER BY k.ord;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. OWNERSHIP AND ACL: the read to the Replay pool's role only; the seam to nobody.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)',
                            'public.server_read_replay_version_availability_v1(uuid,uuid,uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.server_read_replay_version_availability_v1(uuid,uuid,uuid) TO qandeel_replay_media;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)',
                            'public.server_read_replay_version_availability_v1(uuid,uuid,uuid)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef AND p.proowner = 'postgres'::regrole
                      AND p.provolatile = 's' AND p.proconfig = ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'RB-2 S3: % is not a postgres-owned, STABLE, search_path-pinned definer', fn;
    END IF;
    IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure) ~* '(EXCEPTION\s+WHEN|\mEXECUTE\M|40001|40P01|PT409)' THEN
      RAISE EXCEPTION 'RB-2 S3: % must not hold a handler, dynamic SQL or a retryable SQLSTATE', fn;
    END IF;
    IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure) ~* '(observed_at|trigger_at|(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s)' THEN
      RAISE EXCEPTION 'RB-2 S3: % reads a wall clock of the ledger as a time or writes', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'RB-2 S3: % is reachable by %', fn, r;
      END IF;
    END LOOP;
  END LOOP;
  IF has_function_privilege('qandeel_replay_media', 'voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)', 'EXECUTE')
     OR NOT has_function_privilege('qandeel_replay_media', 'public.server_read_replay_version_availability_v1(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RB-2 S3: the Replay pool must reach exactly the read';
  END IF;
END$$;

COMMIT;
