-- INTEL-LIVE-01 CP3 — the Replay read of a live call's provisional attention (Lane B). Product Owner "INTEL-LIVE-01 —
-- CP2 ACCEPTANCE & PO EXCEPTION" (2026-11-26: CP3 authorised on the CP0 contract stack v1.0 -> v1.1 -> A1 -> A2 and the
-- Replay §19 policy) and D-CP3 (2026-11-26): ONE new read function, the Replay role only, strict ownership, consent,
-- CURRENT version and deletion guards, no new table, 0204 and its accepted semantics unchanged. Not hosted.
--
-- ## What is added
--
--   public.server_read_replay_version_attention_v1(user, replay, version) — for the Replay pool's role only. For the
--   creator's own CURRENT V2 version, every attention event (0204) of the live calls whose recordings the version
--   presents, each placed on the version's audio plan (0195) as 0202 places a moment:
--
--     entry 'VERSION'   exactly one row first: the version binding (replay id, version id, revision, the V2 source
--                       window binding digest). A V1 version presents no audio: the VERSION row alone (an empty lane).
--     entry 'EVENT'     one row per event, in (call, event_seq) order, each with the binding again:
--                         call_ordinal   the call's rank by its first presented run (a call is never named by its id)
--                         event_seq      0204's own order within the call
--                         track, op, subject_key, label, kind, confidence, thread_ref   0204's row, unchanged
--                         anchor_*       SET / WITHDRAW: the run and clock of the words the event is about — the first
--                                        presented WINDOW of the event's OWN track on its call's recording holding
--                                        anchor_clock_ms ([start, end)); an event whose words lie in no such window is
--                                        not returned (the words it is about are not heard). Settlements carry their
--                                        SET's anchor run and no anchor clock.
--                         floor_*        the earliest presented position the event may appear at, never certified:
--                                        PRODUCED_POSITION  a SET / WITHDRAW at its produced_clock_ms, the server's own
--                                                           recorded position of the interpretation on the call clock
--                                        SETTLED_THROUGH    a CONFIRMED / EXPIRED at its settlement's
--                                                           settled_through_clock_ms (the turn's words, then the slack)
--                                        placed in the first presented RUN of the same recording, AT OR AFTER the
--                                        anchor's run, whose clock ends after it, at max(position, run start); none:
--                                        AFTER_END (the closing display, Replay §19).
--
--   Zero rows: not the person's own, not this Replay's version, not CURRENT, a V2 version whose windows no longer
--   re-derive to its stored binding, or a presented call recording that is no longer readable. The caller cannot tell
--   these apart, by design.
--
-- ## Why nothing here is certified (D-CP3, the contract's uncertified branch)
--
--   0203 certifies LEDGER PREFIXES (0201): a persisted echo keeps the ledger key its snapshot saw, and the snapshots are
--   collected after 120 s. No stored fact says that an attention row's transaction was visible to a snapshot whose mark
--   preceded an echoed capture position, so no attention event has a certified display instant. Every floor is the
--   server-produced position (or the settlement's source-order position), labelled non-exact by the reader; it is
--   never the anchor, never before the event's own words, and never a claim of when the phone showed it.
--
-- ## Guards
--
--   Ownership  the version's Replay is the caller's (created_by_user_id), its Session's calls are the caller's, and
--              every event row is the caller's (user_id, session_id).
--   CURRENT    the ONE availability derivation (derive_replay_version_current_availability_v1), and the plan's own
--              re-derivation of the source window binding (resolve_replay_version_audio_plan_v1).
--   Deletion   every presented call recording must be readable NOW (voice_private.recording_readable_v1: STORED, before
--              its expiry, the owner's, no due account erasure); otherwise nothing is returned. An erased account's
--              rows are gone by cascade (0204 FKs).
--   Consent    a call is admitted only under the person's CURRENT recording consent (0189 begin), and a withdrawal is
--              never a deletion reason (PRIV-W, 0183): the attention a call recorded is read exactly where, and only
--              where, the version presents that call's own consented recording.
--   Coverage   only events of DEVELOPMENTS evaluations (C10: a STALE_* or DEGRADED_SUSPENDED row has no event, and none
--              is returned); a settlement only when the SET it settles is returned. MISSED_* spans have no event: nothing
--              is reconstructed (C8).
--
-- ## Posture
--
--   A postgres-owned, search_path-pinned, STABLE definer with no exception handler, no dynamic SQL and no retryable
--   SQLSTATE (0150). Executable by qandeel_replay_media only. Nothing is written.
--
-- ## What is deliberately NOT here
--
--   * No table, column, index, policy, permit or cost family. No change to 0195, 0201, 0202, 0203 or 0204.
--   * No certification seam, no clock mark, no protocol change. No hosted deployment.

BEGIN;

CREATE FUNCTION public.server_read_replay_version_attention_v1(
  p_user_id uuid, p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (entry text, replay_id uuid, replay_version_id uuid, replay_version_revision integer,
               source_window_binding_digest text, call_ordinal integer, event_seq bigint, track text, op text,
               subject_key text, label text, kind text, confidence text, thread_ref uuid, anchor_run_ordinal integer,
               anchor_clock_ms bigint, floor_basis text, floor_placement text, floor_run_ordinal integer,
               floor_clock_ms bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version public.replay_versions;
  v_contract public.replay_render_contract_versions;
  v_session uuid;
  v_availability text;
  v_plan_rows integer;
  v_unreadable integer;
BEGIN
  IF p_user_id IS NULL OR p_replay_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_ATTENTION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;

  -- 1. The creator's own version of this Replay, and CURRENT.
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

  -- 2. A V1 version presents no audio: the binding alone, an empty lane.
  IF v_contract.contract_schema_id IS DISTINCT FROM 'QANDEEL_REPLAY_RENDER_CONTRACT_V2' THEN
    RETURN QUERY SELECT 'VERSION'::text, v_version.replay_id, v_version.id, v_version.replay_version_revision, NULL::text,
                        NULL::integer, NULL::bigint, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
                        NULL::uuid, NULL::integer, NULL::bigint, NULL::text, NULL::text, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  -- 3. The plan (it re-derives the binding and re-asks CURRENT itself). An empty plan is the plan's own refusal.
  SELECT count(*)::integer INTO v_plan_rows FROM public.resolve_replay_version_audio_plan_v1(p_user_id, v_version.id);
  IF v_plan_rows = 0 THEN
    RETURN;
  END IF;

  -- 4. Deletion: every presented call recording of this Session must be readable now, or nothing is returned.
  SELECT count(*)::integer INTO v_unreadable
    FROM (SELECT DISTINCT pl.recording_id AS rec FROM public.resolve_replay_version_audio_plan_v1(p_user_id, v_version.id) pl
           WHERE pl.row_kind = 'RUN') ru
    JOIN voice_private.recordings r ON r.id = ru.rec AND r.recording_kind = 'LIVE_CALL'
   WHERE NOT voice_private.recording_readable_v1(p_user_id, r.id);
  IF v_unreadable > 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
    WITH plan AS (
      SELECT * FROM public.resolve_replay_version_audio_plan_v1(p_user_id, v_version.id)
    ), runs AS (
      SELECT p.entry_ordinal AS slot, p.recording_id AS rec, p.clock_start_ms AS a, p.clock_end_ms AS b,
             (row_number() OVER (ORDER BY p.entry_ordinal))::integer AS n
        FROM plan p WHERE p.row_kind = 'RUN'
    ), windows AS (
      -- A WINDOW shares its run's entry ordinal (0195: one slot per run).
      SELECT ru.n, w.recording_id AS rec, w.track AS tr, w.clock_start_ms AS a, w.clock_end_ms AS b, w.entry_ordinal AS slot,
             w.window_ordinal AS k
        FROM plan w JOIN runs ru ON ru.slot = w.entry_ordinal WHERE w.row_kind = 'WINDOW'
    ), calls AS (
      -- Only a live call of the version's own Session, and the caller's.
      SELECT r.id AS rec, c.id AS call, (dense_rank() OVER (ORDER BY min(ru.n)))::integer AS ordinal
        FROM runs ru JOIN voice_private.recordings r ON r.id = ru.rec AND r.recording_kind = 'LIVE_CALL' AND r.user_id = p_user_id
        JOIN voice_private.calls c ON c.id = r.call_id AND c.session_id = v_session AND c.user_id = p_user_id
       GROUP BY r.id, c.id
    ), producer AS (
      -- SET / WITHDRAW of a DEVELOPMENTS evaluation, anchored in a presented window of its own track.
      SELECT cl.ordinal, cl.rec, cl.call, e.event_seq, e.track, e.op, e.subject_key, e.label, e.kind, e.confidence, e.thread_ref,
             e.anchor_clock_ms, e.produced_clock_ms, aw.n AS anchor_n
        FROM calls cl
        JOIN voice_private.call_attention_events e ON e.call_id = cl.call AND e.user_id = p_user_id AND e.session_id = v_session
        JOIN voice_private.call_attention_evaluations ev ON ev.call_id = e.call_id AND ev.eval_seq = e.eval_seq
             AND ev.outcome = 'DEVELOPMENTS'
        JOIN LATERAL (
          SELECT w.n FROM windows w
           WHERE w.rec = cl.rec AND w.tr = e.track AND w.a <= e.anchor_clock_ms AND e.anchor_clock_ms < w.b
           ORDER BY w.n, w.k LIMIT 1) aw ON true
       WHERE e.op IN ('SET', 'WITHDRAW')
    ), settled AS (
      -- CONFIRMED / EXPIRED of a SET returned above, at its settlement's source-order position.
      SELECT pr.ordinal, pr.rec, pr.call, e.event_seq, e.track, e.op, e.subject_key, e.label, e.kind, e.confidence, e.thread_ref,
             NULL::bigint AS anchor_clock_ms, s.settled_through_clock_ms AS position, pr.anchor_n
        FROM producer pr
        JOIN voice_private.call_attention_events e ON e.call_id = pr.call
             AND e.settles_event_seq = pr.event_seq AND e.op IN ('CONFIRMED', 'EXPIRED') AND e.user_id = p_user_id
        LEFT JOIN voice_private.call_attention_settlements s ON s.call_id = e.call_id AND s.track = e.track
             AND s.call_turn_index = e.call_turn_index
       WHERE pr.op = 'SET'
    ), placed AS (
      SELECT x.*, f.n AS floor_n, f.at AS floor_at
        FROM (SELECT pr.ordinal, pr.rec, pr.event_seq, pr.track, pr.op, pr.subject_key, pr.label, pr.kind, pr.confidence,
                     pr.thread_ref, pr.anchor_clock_ms, pr.produced_clock_ms AS position, pr.anchor_n,
                     'PRODUCED_POSITION'::text AS basis
                FROM producer pr
              UNION ALL
              SELECT st.ordinal, st.rec, st.event_seq, st.track, st.op, st.subject_key, st.label, st.kind, st.confidence,
                     st.thread_ref, st.anchor_clock_ms, st.position, st.anchor_n, 'SETTLED_THROUGH'::text
                FROM settled st) x
        LEFT JOIN LATERAL (
          SELECT ru.n, greatest(x.position, ru.a) AS at FROM runs ru
           WHERE ru.rec = x.rec AND ru.n >= x.anchor_n AND ru.b > x.position
           ORDER BY ru.n LIMIT 1) f ON x.position IS NOT NULL
    )
    -- The VERSION row first ('VERSION' > 'EVENT'), then the events in (call, event_seq) order.
    SELECT 'VERSION'::text, v_version.replay_id, v_version.id, v_version.replay_version_revision,
           v_contract.source_window_binding_digest, NULL::integer, NULL::bigint, NULL::text, NULL::text, NULL::text,
           NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::integer, NULL::bigint, NULL::text, NULL::text,
           NULL::integer, NULL::bigint
    UNION ALL
    SELECT 'EVENT'::text, v_version.replay_id, v_version.id, v_version.replay_version_revision,
            v_contract.source_window_binding_digest, p.ordinal, p.event_seq, p.track, p.op, p.subject_key, p.label, p.kind,
            p.confidence, p.thread_ref, p.anchor_n, p.anchor_clock_ms, p.basis,
            CASE WHEN p.floor_n IS NULL THEN 'AFTER_END' ELSE 'IN_RECORDING' END, p.floor_n, p.floor_at
       FROM placed p
    ORDER BY 1 DESC, 6, 7;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- OWNERSHIP AND ACL: the read to the Replay pool's role only.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text := 'public.server_read_replay_version_attention_v1(uuid,uuid,uuid)';
  r text;
BEGIN
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.server_read_replay_version_attention_v1(uuid,uuid,uuid) TO qandeel_replay_media;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text := 'public.server_read_replay_version_attention_v1(uuid,uuid,uuid)';
  r text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef AND p.proowner = 'postgres'::regrole
                    AND p.provolatile = 's' AND p.proconfig = ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'INTEL-LIVE-01 CP3: % is not a postgres-owned, STABLE, search_path-pinned definer', fn;
  END IF;
  IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure) ~* '(EXCEPTION\s+WHEN|\mEXECUTE\M|40001|40P01|PT409)' THEN
    RAISE EXCEPTION 'INTEL-LIVE-01 CP3: % must not hold a handler, dynamic SQL or a retryable SQLSTATE', fn;
  END IF;
  IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = fn::regprocedure) ~* '((INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s|recorded_at|produced_at|xact_id)' THEN
    RAISE EXCEPTION 'INTEL-LIVE-01 CP3: % writes, or reads a wall clock or a transaction id as a time', fn;
  END IF;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'INTEL-LIVE-01 CP3: % is reachable by %', fn, r;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('qandeel_replay_media', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'INTEL-LIVE-01 CP3: the Replay pool must reach the read';
  END IF;
END$$;

COMMIT;
