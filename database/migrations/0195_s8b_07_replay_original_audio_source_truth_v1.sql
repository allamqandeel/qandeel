-- S8B-07 CP1-A — Original Audio Source Truth: a Personal Replay Version may now carry original audio, bound to the exact
-- recording windows its selected items name, and re-verified at finalization. Under the Product Owner's approval of the
-- S8B-07 CP0 Approval Package v1.1 (D-01(a), D-03 Selection-Exact Audio L-1 … L-8, D-04 Render Contract V2 and the
-- Source Window Binding, D-08(a)) and the CP1-A authorization with its four mandatory corrections (2026-11-05).
-- Not hosted: every voice gate and the Personal Replay gate stay DISABLED; no media byte is read, written or served here.
--
-- ## What is added
--
--   A. replay_render_contract_versions gains ONE nullable column, source_window_binding_digest, and one CHECK: a V1 row
--      carries NO binding, a V2 row carries exactly one sha256 binding (IS NOT NULL is stated, because a CHECK passes an
--      UNKNOWN result). The schema, medium and timing CHECKs are re-created under their own names as schema-keyed
--      disjunctions: the V1 branch is exactly 0102's values, the V2 branch is the D-04 values. The truth CHECK is
--      untouched. No row is written, backfilled or updated (every existing row is V1 with a NULL binding).
--   B. replay_resolve_source_windows_v1: the ONE window resolver. For one selection of one creator it resolves every
--      selected item to TEXT or to the window of its turn on its own track of its own recording - metadata only (the
--      anchor, the STORED segments' clock ranges, the recorded gaps), never a storage key, never a byte - or refuses
--      with one internal cause. Every window is checked against the coverage law before anything is returned.
--   C. replay_derive_source_window_binding_v1: the canonical binding digest over the resolver's answer (package v1.1
--      §C.3.1 step 3, the preimage exactly as written there).
--   D. replay_render_contract_digest_v2: the V2 contract digest; it WRAPS an unchanged replay_render_contract_digest_v1
--      call, so a V1 digest is byte-identical by construction.
--   E. build_replay_render_contract_v1 (forward): the all-text path is 0103's verbatim; any original-audio item builds a
--      V2 row only when every window resolves, and otherwise raises the existing REPLAY_RENDER_MEDIUM_UNAVAILABLE /
--      0A000 with the internal cause in DETAIL. There is no V1 fallback for an audio selection.
--   F. derive_replay_version_truth_currency_v1 (forward): the V1 path is 0103's verbatim; a V2 contract is re-verified by
--      re-deriving its binding and recomputing digest_v2. Any refusal or mismatch is RENDER_CONTRACT_MOVED (no new class),
--      which the unchanged finalize_replay_version_v1 already answers as REPLAY_RENDER_CONTRACT_STALE / 40001.
--   G. derive_replay_source_manifest_currency_v1 (forward, from the 0155 body): the Personal branch adds one last check -
--      an original-audio item whose recording is not readable now (expired at the instant with no sweep run, deleted, or
--      under a due account erasure) is STALE / SOURCE_UNAVAILABLE. The other branches are verbatim.
--   H. replay_lock_source_manifest_v1 (forward, from the 0101 body): the MY_WORLD branch also locks the bound recordings,
--      ascending, FOR SHARE, after the units, so a preview or a finalization serializes against an early deletion.
--   I. resolve_replay_version_audio_plan_v1: the L-5 plan of one of the person's own V2 versions (runs, windows, the
--      audible span of each track, the spans where two selected tracks mix, held intervals with their exact elapsed time,
--      recorded gaps by kind, and SAME_RECORDING / CROSS_RECORDING / TEXT boundaries), only while the version's source is
--      currently available and its re-derived binding is the stored one. service_role only. No key, URL, path or text.
--
-- ## The laws (package v1.1 §C.3.2 – §C.3.4, as the Product Owner approved them)
--
--   L-1 an item is heard only inside its own window and only on its own track (USER -> USER, ASSISTANT -> QANDEEL, a
--       voice note -> NOTE); L-2 nothing unselected is ever heard, and two tracks mix only where both carry a selected
--       window; L-3 one recording shares one clock, different recordings share none (CROSS_RECORDING is UNTIMED, no time
--       is computed from started_at or accepted_at); L-4 WHOLE-TURN CLOSURE: an audio item resolves only when the
--       selection holds every unit of its turn, and every unit of that turn maps to the ONE window of the turn, which the
--       plan presents once. No unit is given a time inside the turn: the anchor is a turn's, and nothing here (or in the
--       plan) ties an analytical transition to a word or an instant inside the recording - CP1-B and its Visual Proof Board
--       inherit that as a constraint; L-5 the plan is derived, the milliseconds are the truth; L-7 a recorded gap is never
--       filled. Coverage: STORED segments and recorded gaps tile each call window with no hole and no overlap (a discarded
--       range is legitimate only through its WRITER_LOSS gap); a note is exactly one STORED object and the anchor
--       [0, its recorded duration). A selected original-audio item with no anchor is refused (ANCHOR_ABSENT): no row, no
--       V1 fallback, no transcript promoted, no silence presented as QANDEEL's speech.
--
--   A STORED segment may be wider than the window it covers: the plan and the binding name the segment's own clock range,
--   and the window is the bound. A consumer that decodes a segment must cut to the window after decoding and must never
--   let audio before or after the window, or from the other track, through (CP1-B's duty; recorded in its contract).
--
-- ## What is deliberately NOT here
--
--   * finalize_replay_version_v1, prepare_replay_preview_v1, replay_render_contract_digest_v1, 0104 and every I-06C
--     function are not replaced. No new relation, no FK to voice_private, no fifth Replay component, no copy of an anchor.
--   * No I-06D writer (D-08(a)): the sweep and the deletion functions are not modified. Whether a finalized version's
--     source is available is DERIVED live (G above, inherited by derive_replay_version_current_availability_v1); the
--     evidence row is written only when the creator runs the existing reconcile_replay_post_finalization_state_v1. An
--     expiry or a deletion writes no I-06D event by itself, and nothing here claims one.
--   * No mobile code, no media, no mix, no worker, no route, no gate opened, no retention written, nothing hosted.

BEGIN;

-- The relation census before this migration, so the self-assertions can prove no relation was created.
SELECT set_config('qandeel.s8b07_cp1a_relations', (SELECT count(*)::text FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r', 'v', 'm', 'p', 'f')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')), true);

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE RENDER CONTRACT ROW (A).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.replay_render_contract_versions ADD COLUMN source_window_binding_digest text;

-- A V1 contract binds no window; a V2 contract binds exactly one, never NULL (a CHECK passes UNKNOWN, so IS NOT NULL is
-- stated in the V2 branch rather than left to the pattern).
ALTER TABLE public.replay_render_contract_versions ADD CONSTRAINT replay_render_contract_versions_window_binding_check CHECK (
    (contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V1' AND source_window_binding_digest IS NULL)
 OR (contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V2' AND source_window_binding_digest IS NOT NULL
     AND source_window_binding_digest ~ '^sha256:[0-9a-f]{64}$'));

ALTER TABLE public.replay_render_contract_versions DROP CONSTRAINT replay_render_contract_versions_schema_check;
ALTER TABLE public.replay_render_contract_versions ADD CONSTRAINT replay_render_contract_versions_schema_check
    CHECK (contract_schema_id IN ('QANDEEL_REPLAY_RENDER_CONTRACT_V1', 'QANDEEL_REPLAY_RENDER_CONTRACT_V2'));

-- ORIGINAL MEDIUM. V1: text only (0102). V2 (D-04): the original media preserved, the exact source text of a text item,
-- and a transcript that is only ever DERIVED from audio, never presented as its source.
ALTER TABLE public.replay_render_contract_versions DROP CONSTRAINT replay_render_contract_versions_medium_check;
ALTER TABLE public.replay_render_contract_versions ADD CONSTRAINT replay_render_contract_versions_medium_check CHECK (
    (contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V1'
     AND source_medium_class = 'ORIGINAL_TEXT_ONLY'
     AND original_medium_policy = 'PRESERVE_ORIGINAL_MEDIUM_ONLY'
     AND source_text_policy = 'EXACT_SOURCE_TEXT')
 OR (contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V2'
     AND source_medium_class = 'ORIGINAL_MEDIA_PRESERVED'
     AND original_medium_policy = 'PRESERVE_ORIGINAL_MEDIUM_ONLY'
     AND source_text_policy = 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED'));

-- TIMING SEMANTIC INTEGRITY. V1: a text event has no original voice timing (0102). V2: audio keeps its recording clock,
-- and a text item keeps the declared presentation pacing.
ALTER TABLE public.replay_render_contract_versions DROP CONSTRAINT replay_render_contract_versions_timing_check;
ALTER TABLE public.replay_render_contract_versions ADD CONSTRAINT replay_render_contract_versions_timing_check CHECK (
    (contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V1' AND timing_integrity_policy = 'PRESENTATION_PACING_DECLARED')
 OR (contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V2'
     AND timing_integrity_policy = 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING'));

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE WINDOW RESOLVER (B).
--
--    Rows, in this order: one ITEM per selected item (selected_ordinal; window_ordinal NULL for a text item); then per
--    window k: one WINDOW (its turn, the turn's unit count, the recording, its kind, the track, the anchor [start, end)),
--    its SEGMENT rows (segment_index ascending; a note's one object carries no clock) and its GAP rows (clock ascending).
--    Or exactly ONE REFUSAL row carrying the internal cause, and nothing else.
--
--    Readability is asked before any object or gap row of a recording is read, so nothing of an expired, deleted or
--    erased recording is read past that instant. Only the creator's own recording is readable.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.replay_resolve_source_windows_v1(p_selection_spec_version_id uuid, p_creator uuid)
RETURNS TABLE (entry text, selected_ordinal integer, window_ordinal integer, source_turn_id uuid, unit_count integer,
               recording_id uuid, recording_kind text, track text, clock_start_ms bigint, clock_end_ms bigint,
               segment_index integer, gap_kind text, refusal_cause text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_manifest public.replay_source_manifest_versions;
  v_item record;
  v_window record;
  v_piece record;
  v_reach bigint;
  v_first boolean;
  v_cause text;
BEGIN
  IF p_selection_spec_version_id IS NULL OR p_creator IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT m.* INTO v_manifest
    FROM public.replay_selection_spec_versions sp
    JOIN public.replay_source_manifest_versions m ON m.id = sp.source_manifest_version_id AND m.replay_id = sp.replay_id
    JOIN public.replays r ON r.id = m.replay_id
   WHERE sp.id = p_selection_spec_version_id AND r.created_by_user_id = p_creator;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'REFUSAL'::text, NULL::integer, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text,
                        NULL::text, NULL::bigint, NULL::bigint, NULL::integer, NULL::text, 'OWNER_MISMATCH'::text;
    RETURN;
  END IF;

  -- PASS 1, THE ITEMS. A non-text item resolves only as a Personal unit of the creator, on a turn with a voice source of
  -- the creator, with an anchor, selected whole, with every unit of its turn selected (L-4).
  FOR v_item IN
    SELECT si.selected_ordinal AS ord, si.anchor_kind, mi.original_medium, cu.id AS unit_id, cu.user_id AS unit_user,
           cu.source_turn_id AS turn_id, vs.turn_id AS voiced_turn, vs.user_id AS source_user, vs.anchor_start_ms,
           (SELECT count(*) FROM public.conversation_units x WHERE x.source_turn_id = cu.source_turn_id) AS turn_units,
           (SELECT count(*) FROM public.replay_selection_spec_items s2
              JOIN public.replay_source_manifest_items m2
                ON m2.manifest_version_id = s2.source_manifest_version_id AND m2.source_item_ordinal = s2.source_item_ordinal
              JOIN public.conversation_units x ON x.id = m2.personal_conversation_unit_id
             WHERE s2.selection_spec_version_id = p_selection_spec_version_id AND s2.anchor_kind = 'WHOLE_ITEM'
               AND x.source_turn_id = cu.source_turn_id) AS selected_units
      FROM public.replay_selection_spec_items si
      JOIN public.replay_source_manifest_items mi
        ON mi.manifest_version_id = si.source_manifest_version_id AND mi.source_item_ordinal = si.source_item_ordinal
      LEFT JOIN public.conversation_units cu ON cu.id = mi.personal_conversation_unit_id
      LEFT JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
     WHERE si.selection_spec_version_id = p_selection_spec_version_id AND mi.original_medium <> 'ORIGINAL_TEXT'
     ORDER BY si.selected_ordinal
  LOOP
    -- A Shared or Public item, or a medium no Personal voice source explains, has no anchor this resolver may name.
    IF v_manifest.source_class <> 'MY_WORLD' OR v_item.original_medium <> 'ORIGINAL_AUDIO' OR v_item.unit_id IS NULL
       OR v_item.voiced_turn IS NULL THEN
      v_cause := 'ANCHOR_ABSENT';
    ELSIF v_item.unit_user <> p_creator OR v_item.source_user <> p_creator THEN
      v_cause := 'OWNER_MISMATCH';
    ELSIF v_item.anchor_start_ms IS NULL THEN
      v_cause := 'ANCHOR_ABSENT';
    ELSIF v_item.anchor_kind <> 'WHOLE_ITEM' OR v_item.selected_units <> v_item.turn_units THEN
      v_cause := 'TURN_PARTIALLY_SELECTED';
    END IF;
    IF v_cause IS NOT NULL THEN
      RETURN QUERY SELECT 'REFUSAL'::text, NULL::integer, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text,
                          NULL::text, NULL::bigint, NULL::bigint, NULL::integer, NULL::text, v_cause;
      RETURN;
    END IF;
  END LOOP;

  -- PASS 2, THE WINDOWS: one per turn. Readability first, then the role's track, then coverage.
  FOR v_window IN
    SELECT vs.turn_id, vs.recording_id AS rec, vs.source_role, vs.source_modality, vs.anchor_start_ms AS a,
           vs.anchor_end_ms AS b, min(cu.source_role) AS unit_role, max(cu.source_role) AS unit_role_max
      FROM public.replay_selection_spec_items si
      JOIN public.replay_source_manifest_items mi
        ON mi.manifest_version_id = si.source_manifest_version_id AND mi.source_item_ordinal = si.source_item_ordinal
      JOIN public.conversation_units cu ON cu.id = mi.personal_conversation_unit_id
      JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
     WHERE si.selection_spec_version_id = p_selection_spec_version_id AND mi.original_medium = 'ORIGINAL_AUDIO'
     GROUP BY vs.turn_id, vs.recording_id, vs.source_role, vs.source_modality, vs.anchor_start_ms, vs.anchor_end_ms
     ORDER BY min(si.selected_ordinal)
  LOOP
    IF NOT voice_private.recording_readable_v1(p_creator, v_window.rec) THEN
      v_cause := 'RECORDING_NOT_READABLE';
    ELSIF v_window.unit_role <> v_window.source_role OR v_window.unit_role_max <> v_window.source_role
       OR NOT EXISTS (SELECT 1 FROM voice_private.recordings r
                       WHERE r.id = v_window.rec
                         AND ((v_window.source_modality = 'VOICE_NOTE' AND v_window.source_role = 'USER'
                               AND r.recording_kind = 'VOICE_NOTE')
                           OR (v_window.source_modality = 'LIVE_CALL_SPEECH' AND r.recording_kind = 'LIVE_CALL'))) THEN
      v_cause := 'TRACK_ROLE_MISMATCH';
    ELSIF v_window.source_modality = 'VOICE_NOTE' THEN
      -- A note: exactly one STORED object, and the anchor is [0, the note's recorded duration).
      IF (SELECT count(*) FROM voice_private.recording_objects o
           WHERE o.recording_id = v_window.rec AND o.object_state = 'STORED') <> 1
         OR NOT EXISTS (SELECT 1 FROM voice_private.recording_objects o
                         WHERE o.recording_id = v_window.rec AND o.track = 'NOTE' AND o.segment_index = 0
                           AND o.object_state = 'STORED')
         OR v_window.a <> 0
         OR v_window.b IS DISTINCT FROM (SELECT n.duration_ms FROM voice_private.note_transcriptions n
                                          WHERE n.recording_id = v_window.rec) THEN
        v_cause := 'NOTE_SHAPE_INVALID';
      END IF;
    ELSE
      -- A call track: STORED segments and recorded gaps must tile [a, b) exactly.
      IF NOT EXISTS (SELECT 1 FROM voice_private.recording_objects o
                      WHERE o.recording_id = v_window.rec
                        AND o.track = CASE v_window.source_role WHEN 'USER' THEN 'USER' ELSE 'QANDEEL' END
                        AND o.object_state = 'STORED' AND o.clock_start_ms < v_window.b AND o.clock_end_ms > v_window.a) THEN
        v_cause := 'WINDOW_WITHOUT_STORED_AUDIO';
      ELSE
        v_reach := v_window.a;
        v_first := true;
        FOR v_piece IN
          SELECT x.s, x.e FROM (
            SELECT o.clock_start_ms AS s, o.clock_end_ms AS e FROM voice_private.recording_objects o
             WHERE o.recording_id = v_window.rec
               AND o.track = CASE v_window.source_role WHEN 'USER' THEN 'USER' ELSE 'QANDEEL' END
               AND o.object_state = 'STORED' AND o.clock_start_ms < v_window.b AND o.clock_end_ms > v_window.a
            UNION ALL
            SELECT g.clock_start_ms, g.clock_end_ms FROM voice_private.recording_gaps g
             WHERE g.recording_id = v_window.rec
               AND g.track = CASE v_window.source_role WHEN 'USER' THEN 'USER' ELSE 'QANDEEL' END
               AND g.clock_start_ms < v_window.b AND g.clock_end_ms > v_window.a) x
           ORDER BY x.s, x.e
        LOOP
          IF v_piece.s > v_reach THEN
            v_cause := 'COVERAGE_HOLE';
            EXIT;
          ELSIF NOT v_first AND v_piece.s < v_reach THEN
            v_cause := 'COVERAGE_OVERLAP';
            EXIT;
          END IF;
          v_reach := v_piece.e;
          v_first := false;
          EXIT WHEN v_reach >= v_window.b;
        END LOOP;
        IF v_cause IS NULL AND v_reach < v_window.b THEN
          v_cause := 'COVERAGE_HOLE';
        END IF;
      END IF;
    END IF;
    IF v_cause IS NOT NULL THEN
      RETURN QUERY SELECT 'REFUSAL'::text, NULL::integer, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text,
                          NULL::text, NULL::bigint, NULL::bigint, NULL::integer, NULL::text, v_cause;
      RETURN;
    END IF;
  END LOOP;

  -- THE ANSWER. Every window resolved; the rows are the same facts the passes checked.
  RETURN QUERY
    WITH sel AS (
      SELECT si.selected_ordinal AS ord, mi.original_medium, cu.source_turn_id AS turn_id
        FROM public.replay_selection_spec_items si
        JOIN public.replay_source_manifest_items mi
          ON mi.manifest_version_id = si.source_manifest_version_id AND mi.source_item_ordinal = si.source_item_ordinal
        LEFT JOIN public.conversation_units cu ON cu.id = mi.personal_conversation_unit_id
       WHERE si.selection_spec_version_id = p_selection_spec_version_id
    ), win AS (
      SELECT s.turn_id, (row_number() OVER (ORDER BY min(s.ord)))::integer AS k
        FROM sel s WHERE s.original_medium = 'ORIGINAL_AUDIO' GROUP BY s.turn_id
    ), w AS (
      SELECT win.k, vs.turn_id, vs.recording_id AS rec, r.recording_kind AS kind,
             CASE WHEN vs.source_modality = 'VOICE_NOTE' THEN 'NOTE' WHEN vs.source_role = 'USER' THEN 'USER' ELSE 'QANDEEL' END AS tr,
             vs.anchor_start_ms AS a, vs.anchor_end_ms AS b,
             (SELECT count(*)::integer FROM public.conversation_units x WHERE x.source_turn_id = vs.turn_id) AS units
        FROM win
        JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = win.turn_id
        JOIN voice_private.recordings r ON r.id = vs.recording_id
    )
    SELECT x.entry, x.selected_ordinal, x.window_ordinal, x.source_turn_id, x.unit_count, x.recording_id,
           x.recording_kind, x.track, x.clock_start_ms, x.clock_end_ms, x.segment_index, x.gap_kind, NULL::text
      FROM (
        SELECT 'ITEM'::text AS entry, s.ord AS selected_ordinal, win.k AS window_ordinal, NULL::uuid AS source_turn_id,
               NULL::integer AS unit_count, NULL::uuid AS recording_id, NULL::text AS recording_kind, NULL::text AS track,
               NULL::bigint AS clock_start_ms, NULL::bigint AS clock_end_ms, NULL::integer AS segment_index,
               NULL::text AS gap_kind, 0 AS block, s.ord AS o1, 0::bigint AS o2, 0::bigint AS o3
          FROM sel s LEFT JOIN win ON win.turn_id = s.turn_id AND s.original_medium = 'ORIGINAL_AUDIO'
        UNION ALL
        SELECT 'WINDOW', NULL, w.k, w.turn_id, w.units, w.rec, w.kind, w.tr, w.a, w.b, NULL, NULL, 1, w.k, 0, 0 FROM w
        UNION ALL
        SELECT 'SEGMENT', NULL, w.k, NULL, NULL, NULL, NULL, NULL, o.clock_start_ms, o.clock_end_ms, o.segment_index, NULL,
               1, w.k, 1, o.segment_index
          FROM w JOIN voice_private.recording_objects o
            ON o.recording_id = w.rec AND o.track = w.tr AND o.object_state = 'STORED'
           AND (w.tr = 'NOTE' OR (o.clock_start_ms < w.b AND o.clock_end_ms > w.a))
        UNION ALL
        SELECT 'GAP', NULL, w.k, NULL, NULL, NULL, NULL, NULL, g.clock_start_ms, g.clock_end_ms, NULL, g.gap_kind,
               1, w.k, 2, g.clock_start_ms
          FROM w JOIN voice_private.recording_gaps g
            ON g.recording_id = w.rec AND g.track = w.tr AND g.clock_start_ms < w.b AND g.clock_end_ms > w.a
      ) x
     ORDER BY x.block, x.o1, x.o2, x.o3;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE BINDING DIGEST (C): the canonical preimage of package v1.1 §C.3.1 step 3, over the resolver's answer.
--    UTF-8, '\n'-joined, ascending everywhere, lowercase UUIDs, decimal integers. Exactly one column is non-NULL.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.replay_derive_source_window_binding_v1(p_selection_spec_version_id uuid, p_creator uuid)
RETURNS TABLE (binding_digest text, refusal_cause text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rows record;
  v_lines text[] := ARRAY[]::text[];
  v_items integer := 0;
  v_windows integer := 0;
  v_refusal text;
BEGIN
  IF p_selection_spec_version_id IS NULL OR p_creator IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  FOR v_rows IN SELECT * FROM public.replay_resolve_source_windows_v1(p_selection_spec_version_id, p_creator) LOOP
    IF v_rows.entry = 'REFUSAL' THEN
      v_refusal := v_rows.refusal_cause;
      EXIT;
    ELSIF v_rows.entry = 'ITEM' THEN
      v_items := v_items + 1;
      v_lines := v_lines || ('i|' || v_rows.selected_ordinal::text || '|'
                             || coalesce('W' || v_rows.window_ordinal::text, 'TEXT'));
    ELSIF v_rows.entry = 'WINDOW' THEN
      IF v_windows = 0 THEN
        v_lines := v_lines || '<windows>'::text;
      END IF;
      v_windows := v_windows + 1;
      v_lines := v_lines || ('W' || v_rows.window_ordinal::text || '|turn=' || lower(v_rows.source_turn_id::text)
                             || '|units=' || v_rows.unit_count::text || '|recording=' || lower(v_rows.recording_id::text)
                             || '|kind=' || v_rows.recording_kind || '|track=' || v_rows.track
                             || '|start=' || v_rows.clock_start_ms::text || '|end=' || v_rows.clock_end_ms::text);
    ELSIF v_rows.entry = 'SEGMENT' THEN
      v_lines := v_lines || ('W' || v_rows.window_ordinal::text || '|s|' || v_rows.segment_index::text || '|'
                             || CASE WHEN v_rows.clock_start_ms IS NULL THEN 'NOTE'
                                     ELSE v_rows.clock_start_ms::text || '|' || v_rows.clock_end_ms::text END);
    ELSE
      v_lines := v_lines || ('W' || v_rows.window_ordinal::text || '|g|' || v_rows.gap_kind || '|'
                             || v_rows.clock_start_ms::text || '|' || v_rows.clock_end_ms::text);
    END IF;
  END LOOP;
  IF v_refusal IS NOT NULL THEN
    RETURN QUERY SELECT NULL::text, v_refusal;
    RETURN;
  END IF;
  -- The window count stands where the first window begins, or after the items when there is none.
  IF v_windows = 0 THEN
    v_lines := v_lines || 'windows=0'::text;
  ELSE
    v_lines := array_replace(v_lines, '<windows>', 'windows=' || v_windows::text);
  END IF;
  RETURN QUERY SELECT 'sha256:' || encode(sha256(convert_to(
         'QANDEEL_REPLAY_SOURCE_WINDOW_BINDING_V1' || E'\n'
      || 'selection=' || lower(p_selection_spec_version_id::text) || E'\n'
      || 'items=' || v_items::text || E'\n'
      || array_to_string(v_lines, E'\n'), 'UTF8')), 'hex'), NULL::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE V2 CONTRACT DIGEST (D). It calls replay_render_contract_digest_v1, never changes it.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.replay_render_contract_digest_v2(
  p_replay_id uuid, p_source_manifest_version_id uuid, p_selection_spec_version_id uuid,
  p_analytical_projection_version_id uuid, p_projection_digest text, p_contract_schema_id text,
  p_source_medium_class text, p_original_medium_policy text, p_source_text_policy text,
  p_semantic_cut_policy text, p_temporal_discontinuity_policy text, p_timing_integrity_policy text,
  p_analytical_projection_policy text, p_camera_emphasis_policy text, p_motion_policy text,
  p_caption_provenance_policy text, p_accessibility_parity_policy text,
  p_reduced_motion_parity_policy text, p_editorial_annotation_policy text,
  p_discontinuity_count integer, p_point_count integer, p_source_window_binding_digest text
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT 'sha256:' || encode(sha256(convert_to(
       'QANDEEL_REPLAY_RENDER_CONTRACT_DIGEST_V2' || E'\n'
    || 'policyDigest=' || public.replay_render_contract_digest_v1(
         p_replay_id, p_source_manifest_version_id, p_selection_spec_version_id, p_analytical_projection_version_id,
         p_projection_digest, p_contract_schema_id, p_source_medium_class, p_original_medium_policy, p_source_text_policy,
         p_semantic_cut_policy, p_temporal_discontinuity_policy, p_timing_integrity_policy, p_analytical_projection_policy,
         p_camera_emphasis_policy, p_motion_policy, p_caption_provenance_policy, p_accessibility_parity_policy,
         p_reduced_motion_parity_policy, p_editorial_annotation_policy, p_discontinuity_count, p_point_count) || E'\n'
    || 'sourceWindowBinding=' || p_source_window_binding_digest, 'UTF8')), 'hex')
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE BUILDER (E). Forward-replaced from 0103_replay_preview_finalization_runtime_v1.sql: the 0103 body with the
--    original-medium gate replaced by the audio path, and the V1 insert unchanged.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_replay_render_contract_v1(
  p_replay_id uuid,
  p_contract_version_id uuid,
  p_contract_revision integer,
  p_analytical_projection_version_id uuid,
  p_contract_instant timestamptz
) RETURNS TABLE(built_contract_digest text, built_discontinuity_count integer)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  projection public.replay_analytical_projection_versions;
  gaps integer;
  unsafe integer;
  assessed integer;
  nontext integer;
  contract_ref text;
  -- S8B-07 CP1-A (0195): the source window binding of an original-audio selection, or its refusal.
  binding text;
  cause text;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_replay_id IS NULL OR p_contract_version_id IS NULL OR p_contract_revision IS NULL
     OR p_analytical_projection_version_id IS NULL OR p_contract_instant IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT v.* INTO projection FROM public.replay_analytical_projection_versions v
    JOIN public.replays r ON r.id = v.replay_id
   WHERE v.id = p_analytical_projection_version_id AND v.replay_id = p_replay_id
     AND r.created_by_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- EVERY SELECTED CUT IS PROVEN SAFE, or the contract cannot truthfully claim
  -- WHOLE_ITEM_ONLY_PROVEN_SAFE.
  SELECT count(*)::integer, count(*) FILTER (WHERE a.assessment_result <> 'SAFE')::integer
    INTO assessed, unsafe
    FROM public.replay_semantic_cut_assessments a
   WHERE a.selection_spec_version_id = projection.selection_spec_version_id;
  IF assessed <> projection.point_count OR unsafe > 0 THEN
    RAISE EXCEPTION 'REPLAY_SEMANTIC_CUT_UNSAFE' USING ERRCODE='0A000',
      DETAIL='A selected cut is not proven to preserve negation, qualification, attribution and clause context. Widen the selection through an explicit new draft revision; a Replay never widens a selection silently.';
  END IF;

  SELECT count(*)::integer INTO nontext
    FROM public.replay_selection_spec_items si
    JOIN public.replay_source_manifest_items mi
      ON mi.manifest_version_id = si.source_manifest_version_id
     AND mi.source_item_ordinal = si.source_item_ordinal
   WHERE si.selection_spec_version_id = projection.selection_spec_version_id
     AND mi.original_medium <> 'ORIGINAL_TEXT';

  SELECT count(*)::integer INTO gaps FROM public.replay_temporal_discontinuities d
   WHERE d.selection_spec_version_id = projection.selection_spec_version_id;

  -- S8B-07 CP1-A (0195): AN ORIGINAL-AUDIO SELECTION IS BOUND TO ITS EXACT WINDOWS, OR IT IS REFUSED. Every window must
  -- resolve (anchor, readable recording, the role's track, whole turn, full coverage); there is no V1 fallback, nothing
  -- is reclassified as text, and an absent original medium is never fabricated.
  IF nontext > 0 THEN
    SELECT b.binding_digest, b.refusal_cause INTO binding, cause
      FROM public.replay_derive_source_window_binding_v1(projection.selection_spec_version_id, u) b;
    IF binding IS NULL THEN
      RAISE EXCEPTION 'REPLAY_RENDER_MEDIUM_UNAVAILABLE' USING ERRCODE='0A000',
        DETAIL='REPLAY_SOURCE_WINDOW_' || coalesce(cause, 'UNRESOLVED') || ': a selected original-audio item does not resolve to a readable, covered, whole-turn window of its own track. An absent original medium is never fabricated, and a transcript is never promoted to an original spoken event.';
    END IF;
    contract_ref := public.replay_render_contract_digest_v2(
      p_replay_id, projection.source_manifest_version_id, projection.selection_spec_version_id,
      projection.id, projection.projection_digest, 'QANDEEL_REPLAY_RENDER_CONTRACT_V2',
      'ORIGINAL_MEDIA_PRESERVED', 'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED',
      'WHOLE_ITEM_ONLY_PROVEN_SAFE', 'PERCEPTIBLE_DISCONTINUITY_REQUIRED', 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING',
      'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION', 'EXPLANATORY_MOTION_ONLY',
      'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', 'EQUIVALENT_TRUTH_REQUIRED', 'EQUIVALENT_TRUTH_REQUIRED',
      'NO_EDITORIAL_ANNOTATION', gaps, projection.point_count, binding);
    INSERT INTO public.replay_render_contract_versions
      (id, replay_id, source_manifest_version_id, selection_spec_version_id,
       analytical_projection_version_id, contract_revision, contract_schema_id, source_medium_class,
       original_medium_policy, source_text_policy, semantic_cut_policy, temporal_discontinuity_policy,
       timing_integrity_policy, analytical_projection_policy, camera_emphasis_policy, motion_policy,
       caption_provenance_policy, accessibility_parity_policy, reduced_motion_parity_policy,
       editorial_annotation_policy, discontinuity_count, contract_digest, created_at, source_window_binding_digest)
    VALUES (p_contract_version_id, p_replay_id, projection.source_manifest_version_id,
            projection.selection_spec_version_id, projection.id, p_contract_revision,
            'QANDEEL_REPLAY_RENDER_CONTRACT_V2', 'ORIGINAL_MEDIA_PRESERVED',
            'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED', 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
            'PERCEPTIBLE_DISCONTINUITY_REQUIRED', 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING',
            'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION',
            'EXPLANATORY_MOTION_ONLY', 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE',
            'EQUIVALENT_TRUTH_REQUIRED', 'EQUIVALENT_TRUTH_REQUIRED', 'NO_EDITORIAL_ANNOTATION',
            gaps, contract_ref, p_contract_instant, binding);
    RETURN QUERY SELECT contract_ref, gaps;
    RETURN;
  END IF;

  contract_ref := public.replay_render_contract_digest_v1(
    p_replay_id, projection.source_manifest_version_id, projection.selection_spec_version_id,
    projection.id, projection.projection_digest, 'QANDEEL_REPLAY_RENDER_CONTRACT_V1',
    'ORIGINAL_TEXT_ONLY', 'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT',
    'WHOLE_ITEM_ONLY_PROVEN_SAFE', 'PERCEPTIBLE_DISCONTINUITY_REQUIRED', 'PRESENTATION_PACING_DECLARED',
    'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION', 'EXPLANATORY_MOTION_ONLY',
    'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', 'EQUIVALENT_TRUTH_REQUIRED', 'EQUIVALENT_TRUTH_REQUIRED',
    'NO_EDITORIAL_ANNOTATION', gaps, projection.point_count);

  INSERT INTO public.replay_render_contract_versions
    (id, replay_id, source_manifest_version_id, selection_spec_version_id,
     analytical_projection_version_id, contract_revision, contract_schema_id, source_medium_class,
     original_medium_policy, source_text_policy, semantic_cut_policy, temporal_discontinuity_policy,
     timing_integrity_policy, analytical_projection_policy, camera_emphasis_policy, motion_policy,
     caption_provenance_policy, accessibility_parity_policy, reduced_motion_parity_policy,
     editorial_annotation_policy, discontinuity_count, contract_digest, created_at)
  VALUES (p_contract_version_id, p_replay_id, projection.source_manifest_version_id,
          projection.selection_spec_version_id, projection.id, p_contract_revision,
          'QANDEEL_REPLAY_RENDER_CONTRACT_V1', 'ORIGINAL_TEXT_ONLY',
          'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT', 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
          'PERCEPTIBLE_DISCONTINUITY_REQUIRED', 'PRESENTATION_PACING_DECLARED',
          'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION',
          'EXPLANATORY_MOTION_ONLY', 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE',
          'EQUIVALENT_TRUTH_REQUIRED', 'EQUIVALENT_TRUTH_REQUIRED', 'NO_EDITORIAL_ANNOTATION',
          gaps, contract_ref, p_contract_instant);

  RETURN QUERY SELECT contract_ref, gaps;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. THE TRUTH REVALIDATION (F). Forward-replaced from 0103_replay_preview_finalization_runtime_v1.sql: the 0103 body
--    with the render-contract step keyed on the contract's schema. STABLE, writes nothing, takes no lock.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_replay_version_truth_currency_v1(p_replay_version_id uuid)
RETURNS TABLE(currency_state text, divergence_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  version public.replay_versions;
  projection public.replay_analytical_projection_versions;
  contract public.replay_render_contract_versions;
  manifest public.replay_source_manifest_versions;
  point record;
  projected record;
  recomputed text;
  assessed integer;
  unsafe integer;
  -- S8B-07 CP1-A (0195): the creator, and the binding re-derived from current source metadata.
  creator uuid;
  rebound record;
BEGIN
  IF p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT v.* INTO version FROM public.replay_versions v WHERE v.id = p_replay_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT p.* INTO projection FROM public.replay_analytical_projection_versions p
   WHERE p.id = version.analytical_projection_version_id;
  SELECT c.* INTO contract FROM public.replay_render_contract_versions c
   WHERE c.id = version.render_contract_version_id;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
   WHERE m.id = version.source_manifest_version_id;

  -- Semantic Cut Safety, still complete and still entirely SAFE.
  SELECT count(*)::integer, count(*) FILTER (WHERE a.assessment_result <> 'SAFE')::integer
    INTO assessed, unsafe
    FROM public.replay_semantic_cut_assessments a
   WHERE a.selection_spec_version_id = version.selection_spec_version_id;
  IF assessed <> projection.point_count OR unsafe > 0 THEN
    RETURN QUERY SELECT 'DIVERGED'::text, 'CUT_UNSAFE'::text; RETURN;
  END IF;

  -- The analytical projection, re-derived at every represented coordinate.
  FOR point IN
    SELECT pt.* FROM public.replay_analytical_projection_points pt
     WHERE pt.projection_version_id = projection.id
     ORDER BY pt.selected_ordinal
  LOOP
    BEGIN
      SELECT * INTO projected
        FROM public.get_session_historical_projection_v1(manifest.personal_session_id, point.represented_session_position);
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 'DIVERGED'::text, 'PROJECTION_UNAVAILABLE'::text; RETURN;
    END;
    IF projected IS NULL OR NOT projected.sealed THEN
      RETURN QUERY SELECT 'DIVERGED'::text, 'PROJECTION_UNSEALED'::text; RETURN;
    END IF;
    recomputed := public.replay_analytical_projection_point_digest_v1(
      projected.tc, projected.emerging_focuses, projected.live_focus, projected.threads,
      projected.thread_reading_appearances, projected.readings, projected.reading_relations,
      projected.evidence_participations, projected.materials, projected.gaps,
      projected.questions, projected.question_appearances, projected.confidences);
    IF recomputed IS DISTINCT FROM point.point_digest THEN
      RETURN QUERY SELECT 'DIVERGED'::text, 'PROJECTION_MOVED'::text; RETURN;
    END IF;
  END LOOP;

  -- The render contract, re-derived from its own bound composition.
  IF contract.contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V2' THEN
    -- S8B-07 CP1-A (0195): a V2 contract is current only while its windows still re-derive to the binding it stored, and
    -- its digest still commits that binding. A refusal (unreadable, uncovered, partial, no anchor) is a moved contract.
    SELECT r.created_by_user_id INTO creator FROM public.replays r WHERE r.id = contract.replay_id;
    SELECT b.binding_digest, b.refusal_cause INTO rebound
      FROM public.replay_derive_source_window_binding_v1(contract.selection_spec_version_id, creator) b;
    IF rebound.binding_digest IS NULL
       OR rebound.binding_digest IS DISTINCT FROM contract.source_window_binding_digest THEN
      RETURN QUERY SELECT 'DIVERGED'::text, 'RENDER_CONTRACT_MOVED'::text; RETURN;
    END IF;
    recomputed := public.replay_render_contract_digest_v2(
      contract.replay_id, contract.source_manifest_version_id, contract.selection_spec_version_id,
      contract.analytical_projection_version_id, projection.projection_digest, contract.contract_schema_id,
      contract.source_medium_class, contract.original_medium_policy, contract.source_text_policy,
      contract.semantic_cut_policy, contract.temporal_discontinuity_policy, contract.timing_integrity_policy,
      contract.analytical_projection_policy, contract.camera_emphasis_policy, contract.motion_policy,
      contract.caption_provenance_policy, contract.accessibility_parity_policy,
      contract.reduced_motion_parity_policy, contract.editorial_annotation_policy,
      contract.discontinuity_count, projection.point_count, contract.source_window_binding_digest);
  ELSE
  recomputed := public.replay_render_contract_digest_v1(
    contract.replay_id, contract.source_manifest_version_id, contract.selection_spec_version_id,
    contract.analytical_projection_version_id, projection.projection_digest, contract.contract_schema_id,
    contract.source_medium_class, contract.original_medium_policy, contract.source_text_policy,
    contract.semantic_cut_policy, contract.temporal_discontinuity_policy, contract.timing_integrity_policy,
    contract.analytical_projection_policy, contract.camera_emphasis_policy, contract.motion_policy,
    contract.caption_provenance_policy, contract.accessibility_parity_policy,
    contract.reduced_motion_parity_policy, contract.editorial_annotation_policy,
    contract.discontinuity_count, projection.point_count);
  END IF;
  IF recomputed IS DISTINCT FROM contract.contract_digest THEN
    RETURN QUERY SELECT 'DIVERGED'::text, 'RENDER_CONTRACT_MOVED'::text; RETURN;
  END IF;
  IF (SELECT count(*)::integer FROM public.replay_temporal_discontinuities d
       WHERE d.selection_spec_version_id = version.selection_spec_version_id)
     <> contract.discontinuity_count THEN
    RETURN QUERY SELECT 'DIVERGED'::text, 'RENDER_CONTRACT_MOVED'::text; RETURN;
  END IF;

  RETURN QUERY SELECT 'CURRENT'::text, NULL::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE SOURCE CURRENCY (G). Forward-replaced from 0155_introduction_privacy_isolation_end_boundary_v1.sql: the 0155
--    body with one check added at the end of the Personal branch.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_replay_source_manifest_currency_v1(p_source_manifest_version_id uuid)
 RETURNS TABLE(currency_state text, staleness_class text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  manifest public.replay_source_manifest_versions;
  creator uuid;
  visible uuid[];
BEGIN
  IF p_source_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
   WHERE m.id = p_source_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT r.created_by_user_id INTO creator FROM public.replays r WHERE r.id = manifest.replay_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF manifest.source_class = 'MY_WORLD' THEN
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
       WHERE i.manifest_version_id = manifest.id
         AND NOT EXISTS (SELECT 1 FROM public.conversation_units cu
                          WHERE cu.id = i.personal_conversation_unit_id
                            AND cu.session_id = i.personal_session_id AND cu.user_id = creator
                            AND cu.session_position = i.personal_session_position)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.conversation_units cu ON cu.id = i.personal_conversation_unit_id
       WHERE i.manifest_version_id = manifest.id
         AND ('sha256:' || encode(sha256(convert_to(cu.committed_text, 'UTF8')), 'hex')) <> i.captured_source_digest
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
    -- S8B-07 CP1-A (0195): an original-audio item is current only while its recording is readable by its creator now:
    -- stored, before its expiry instant (cut at the instant, whether or not the sweep has run), and with no due account
    -- erasure. A deleted, expired or erased recording makes the source unavailable.
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.conversation_units cu ON cu.id = i.personal_conversation_unit_id
        LEFT JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
       WHERE i.manifest_version_id = manifest.id AND i.original_medium = 'ORIGINAL_AUDIO'
         AND (vs.turn_id IS NULL OR NOT voice_private.recording_readable_v1(creator, vs.recording_id))
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;
    END IF;
  ELSIF manifest.source_class = 'SHARED_WORLD' THEN
    -- DEFENCE IN DEPTH, ANSWERED FIRST. The 0100 same-row guard makes a
    -- malformed binding unrepresentable at INSERT, and this derivation refuses
    -- to bless one anyway: a material and a history item that are each
    -- individually valid, but are not the SAME canonical event, describe a
    -- source that never happened. It can never read CURRENT, whatever the
    -- availability and digests of the independently named rows say.
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        LEFT JOIN public.shared_world_materials m
          ON m.id = i.shared_material_id AND m.world_id = i.shared_world_id
        LEFT JOIN public.shared_world_history_items h
          ON h.id = i.shared_history_item_id AND h.world_id = i.shared_world_id
       WHERE i.manifest_version_id = manifest.id
         AND (m.id IS NULL OR h.id IS NULL
              OR m.history_item_id IS DISTINCT FROM i.shared_history_item_id
              OR m.material_kind IS DISTINCT FROM i.shared_material_kind
              OR h.occurred_at IS DISTINCT FROM i.shared_occurred_at)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CONTRADICTORY'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.shared_world_history_items h ON h.id = i.shared_history_item_id
       WHERE i.manifest_version_id = manifest.id AND h.availability_state <> 'AVAILABLE'
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.shared_world_history_items h ON h.id = i.shared_history_item_id
        JOIN public.shared_world_materials m ON m.id = i.shared_material_id
        LEFT JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
        LEFT JOIN public.shared_world_voice_note_material_bodies vn ON vn.material_id = m.id
       WHERE i.manifest_version_id = manifest.id
         AND (h.availability_revision <> i.captured_availability_revision
              OR (t.material_id IS NULL AND vn.material_id IS NULL)
              OR ('sha256:' || encode(sha256(convert_to(
                    CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE'
                         THEN vn.audio_object_ref || E'\n' || coalesce(vn.transcript_text, '')
                         ELSE t.body_text END, 'UTF8')), 'hex')) IS DISTINCT FROM i.captured_source_digest)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
    BEGIN
      SELECT array_agg(v.history_item_id) INTO visible
        FROM public.resolve_shared_world_history_visibility_v1(manifest.shared_world_id, creator) v;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END;
    -- S6-02 (GATE-35 / D5): an Introduction-era item is not visible to any Replay, whenever it was captured.
    visible := shared_private.without_introduction_era_history_v1(manifest.shared_world_id, visible);
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
       WHERE i.manifest_version_id = manifest.id
         AND NOT (i.shared_history_item_id = ANY(coalesce(visible, ARRAY[]::uuid[])))
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END IF;
  ELSE
    -- The same defence for the bounded Public derivative: an ordinal or a
    -- classification that does not belong to the exact package item named is a
    -- contradiction, never a current source.
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        LEFT JOIN public.publication_package_manifest_items it
          ON it.manifest_version_id = i.public_manifest_version_id
         AND it.package_item_id = i.public_package_item_id
       WHERE i.manifest_version_id = manifest.id
         AND (it.package_item_id IS NULL
              OR it.item_ordinal IS DISTINCT FROM i.public_item_ordinal
              OR it.derivative_classification IS DISTINCT FROM i.public_derivative_classification)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CONTRADICTORY'::text; RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                    WHERE c.experience_id = manifest.public_experience_id AND c.controller_user_id = creator) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.public_experiences e
                    WHERE e.id = manifest.public_experience_id
                      AND e.current_experience_version_id = manifest.public_experience_version_id
                      AND e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED')) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_VERSION_NOT_CURRENT'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        LEFT JOIN public.publication_package_manifest_items it
          ON it.manifest_version_id = i.public_manifest_version_id AND it.package_item_id = i.public_package_item_id
        LEFT JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
       WHERE i.manifest_version_id = manifest.id
         AND (it.package_item_id IS NULL OR b.package_item_id IS NULL
              OR it.public_body_digest <> i.captured_source_digest)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'CURRENT'::text, NULL::text;
END$function$
;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. THE SOURCE LOCK (H). Forward-replaced from 0101_replay_authorized_draft_runtime_v1.sql: the 0101 body with the
--    bound recordings locked after the units, ascending, FOR SHARE. No advisory lock, no table lock.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replay_lock_source_manifest_v1(p_source_manifest_version_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  manifest public.replay_source_manifest_versions;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
    JOIN public.replays r ON r.id = m.replay_id
   WHERE m.id = p_source_manifest_version_id AND r.created_by_user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF manifest.source_class = 'MY_WORLD' THEN
    PERFORM 1 FROM public.session_semantic_clocks c
      WHERE c.session_id = manifest.personal_session_id AND c.user_id = u FOR SHARE;
    PERFORM 1 FROM public.conversation_units cu
      WHERE cu.id IN (SELECT i.personal_conversation_unit_id FROM public.replay_source_manifest_items i
                       WHERE i.manifest_version_id = manifest.id)
      ORDER BY cu.id FOR SHARE;
    -- S8B-07 CP1-A (0195): the recordings the original-audio items are bound to, after the units, ascending. An early
    -- deletion (FOR UPDATE) and this preview or finalization are serialized; the expiry needs no lock (it is cut at the
    -- instant), and a wait here never extends a recording's readability.
    PERFORM 1 FROM voice_private.recordings rec
      WHERE rec.id IN (SELECT vs.recording_id FROM public.replay_source_manifest_items i
                         JOIN public.conversation_units cu ON cu.id = i.personal_conversation_unit_id
                         JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
                        WHERE i.manifest_version_id = manifest.id AND i.original_medium = 'ORIGINAL_AUDIO')
      ORDER BY rec.id FOR SHARE;
  ELSIF manifest.source_class = 'SHARED_WORLD' THEN
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = manifest.shared_world_id FOR SHARE;
    PERFORM 1 FROM public.shared_world_materials m
      WHERE m.id IN (SELECT i.shared_material_id FROM public.replay_source_manifest_items i
                      WHERE i.manifest_version_id = manifest.id)
      ORDER BY m.id FOR SHARE;
    PERFORM 1 FROM public.shared_world_history_items i
      WHERE i.id IN (SELECT mi.shared_history_item_id FROM public.replay_source_manifest_items mi
                      WHERE mi.manifest_version_id = manifest.id)
      ORDER BY i.id FOR SHARE;
  ELSE
    PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR SHARE;
    PERFORM 1 FROM public.public_experiences e WHERE e.id = manifest.public_experience_id FOR SHARE;
    PERFORM 1 FROM public.publication_package_manifest_versions pm
      WHERE pm.id = manifest.public_manifest_version_id FOR SHARE;
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. THE AUDIO PLAN READ (I). service_role only.
--
--    One row per fact, ordered by entry_ordinal (the presentation sequence) and then by its own position:
--      RUN       a maximal sequence of consecutive selected audio items on ONE recording: its recording and clock span
--      ITEM      a selected audio item and the window it maps to (every unit of a turn maps to that turn's one window)
--      WINDOW    a window on the recording clock: its track and [start, end), presented once
--      AUDIBLE   the span a track is heard in, inside the run: the union of that track's selected windows (once a track)
--      MIX       a span where two selected tracks are heard together: exactly their intersection
--      HELD      a span inside the run where no selected window is heard, with its exact elapsed_ms
--      GAP       a recorded gap inside a window (clipped to it), with its kind; it is never filled
--      TEXT      a selected text item, presented with the V1 declared pacing
--      BOUNDARY  before a run that follows an earlier run: SAME_RECORDING with the proven elapsed_ms, or CROSS_RECORDING
--                with elapsed_ms NULL (UNTIMED: different recordings share no clock)
--    Zero rows unless the version is the person's own, V2, currently available, and its windows re-derive to the
--    binding it stored. No key, URL, path or text is ever returned.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_version_audio_plan_v1(p_user_id uuid, p_replay_version_id uuid)
RETURNS TABLE (entry_ordinal integer, row_kind text, window_ordinal integer, selected_ordinal integer, recording_id uuid,
               track text, clock_start_ms bigint, clock_end_ms bigint, elapsed_ms bigint, gap_kind text,
               boundary_kind text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version public.replay_versions;
  v_contract public.replay_render_contract_versions;
  v_availability text;
  v_rebound record;
BEGIN
  IF p_user_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT v.* INTO v_version FROM public.replay_versions v JOIN public.replays r ON r.id = v.replay_id
   WHERE v.id = p_replay_version_id AND r.created_by_user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT c.* INTO v_contract FROM public.replay_render_contract_versions c
   WHERE c.id = v_version.render_contract_version_id AND c.contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V2';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- The ONE availability derivation (I-06D), which consults the ONE source currency; no second evaluator.
  SELECT a.availability_state INTO v_availability
    FROM public.derive_replay_version_current_availability_v1(v_version.replay_id, v_version.id) a;
  IF v_availability IS DISTINCT FROM 'CURRENT' THEN
    RETURN;
  END IF;
  SELECT b.binding_digest INTO v_rebound
    FROM public.replay_derive_source_window_binding_v1(v_contract.selection_spec_version_id, p_user_id) b;
  IF v_rebound.binding_digest IS NULL
     OR v_rebound.binding_digest IS DISTINCT FROM v_contract.source_window_binding_digest THEN
    RETURN;
  END IF;

  RETURN QUERY
    WITH res AS (
      SELECT * FROM public.replay_resolve_source_windows_v1(v_contract.selection_spec_version_id, p_user_id)
    ), win AS (
      SELECT r.window_ordinal AS k, r.recording_id AS rec, r.track AS tr, r.clock_start_ms AS a, r.clock_end_ms AS b
        FROM res r WHERE r.entry = 'WINDOW'
    ), seq AS (
      -- The items in selection order; a later unit of an already-presented window is not a new entry.
      SELECT i.selected_ordinal AS ord, i.window_ordinal AS k, w.rec,
             row_number() OVER (PARTITION BY i.window_ordinal ORDER BY i.selected_ordinal) AS nth
        FROM res i LEFT JOIN win w ON w.k = i.window_ordinal
       WHERE i.entry = 'ITEM'
    ), kept AS (
      SELECT s.ord, s.k, s.rec,
             CASE WHEN s.k IS NULL OR lag(s.k) OVER (ORDER BY s.ord) IS NULL
                       OR s.rec IS DISTINCT FROM lag(s.rec) OVER (ORDER BY s.ord) THEN 1 ELSE 0 END AS starts
        FROM seq s WHERE s.k IS NULL OR s.nth = 1
    ), grouped AS (
      SELECT k.ord, k.k, k.rec, (sum(k.starts) OVER (ORDER BY k.ord))::integer AS g FROM kept k
    ), runs AS (
      SELECT gr.g, min(gr.rec::text)::uuid AS rec, min(w.a) AS a, max(w.b) AS b,
             (row_number() OVER (ORDER BY gr.g))::integer AS run_no
        FROM grouped gr JOIN win w ON w.k = gr.k
       WHERE gr.k IS NOT NULL GROUP BY gr.g
    ), run_windows AS (
      SELECT gr.g, w.k, w.rec, w.tr, w.a, w.b FROM grouped gr JOIN win w ON w.k = gr.k
    ), islands AS (
      -- The union of a run's windows (any track), as islands on the clock; the spaces between them are held.
      SELECT x.g, x.a, x.b,
             sum(x.fresh) OVER (PARTITION BY x.g ORDER BY x.a, x.b ROWS UNBOUNDED PRECEDING) AS island
        FROM (SELECT rw.g, rw.a, rw.b,
                     CASE WHEN rw.a > max(rw.b) OVER (PARTITION BY rw.g ORDER BY rw.a, rw.b
                                                     ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
                          THEN 1 ELSE 0 END AS fresh
                FROM run_windows rw) x
    ), merged AS (
      SELECT i.g, i.island, min(i.a) AS a, max(i.b) AS b FROM islands i GROUP BY i.g, i.island
    ), held AS (
      SELECT m.g, m.b AS a, lead(m.a) OVER (PARTITION BY m.g ORDER BY m.a) AS b FROM merged m
    ), track_islands AS (
      SELECT x.g, x.tr, x.a, x.b,
             sum(x.fresh) OVER (PARTITION BY x.g, x.tr ORDER BY x.a, x.b ROWS UNBOUNDED PRECEDING) AS island
        FROM (SELECT rw.g, rw.tr, rw.a, rw.b,
                     CASE WHEN rw.a > max(rw.b) OVER (PARTITION BY rw.g, rw.tr ORDER BY rw.a, rw.b
                                                     ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
                          THEN 1 ELSE 0 END AS fresh
                FROM run_windows rw) x
    ), audible AS (
      SELECT t.g, t.tr, min(t.a) AS a, max(t.b) AS b FROM track_islands t GROUP BY t.g, t.tr, t.island
    ), mix AS (
      SELECT u.g, greatest(u.a, q.a) AS a, least(u.b, q.b) AS b
        FROM audible u JOIN audible q ON q.g = u.g AND u.tr = 'USER' AND q.tr = 'QANDEEL'
       WHERE greatest(u.a, q.a) < least(u.b, q.b)
    ), bounds AS (
      SELECT r.g, lag(r.rec) OVER (ORDER BY r.g) AS prev_rec, lag(r.b) OVER (ORDER BY r.g) AS prev_b, r.rec, r.a
        FROM runs r
    ), facts AS (
      SELECT 2 * r.g AS slot, 0 AS o1, 0::bigint AS o2, 'RUN'::text AS kind, NULL::integer AS k, NULL::integer AS ord,
             r.rec, NULL::text AS tr, r.a, r.b, NULL::bigint AS elapsed, NULL::text AS gk, NULL::text AS bk
        FROM runs r
      UNION ALL
      SELECT 2 * gr.g, 1, s.ord, 'ITEM', s.k, s.ord, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        FROM seq s JOIN grouped gr ON gr.k = s.k AND s.k IS NOT NULL
      UNION ALL
      SELECT 2 * rw.g, 2, rw.k, 'WINDOW', rw.k, NULL, rw.rec, rw.tr, rw.a, rw.b, NULL, NULL, NULL FROM run_windows rw
      UNION ALL
      SELECT 2 * a.g, 3, a.a, 'AUDIBLE', NULL, NULL, NULL, a.tr, a.a, a.b, NULL, NULL, NULL FROM audible a
      UNION ALL
      SELECT 2 * m.g, 4, m.a, 'MIX', NULL, NULL, NULL, NULL, m.a, m.b, NULL, NULL, NULL FROM mix m
      UNION ALL
      SELECT 2 * h.g, 5, h.a, 'HELD', NULL, NULL, NULL, NULL, h.a, h.b, h.b - h.a, NULL, NULL
        FROM held h WHERE h.b IS NOT NULL
      UNION ALL
      SELECT 2 * rw.g, 6, gp.clock_start_ms, 'GAP', rw.k, NULL, NULL, rw.tr, greatest(gp.clock_start_ms, rw.a),
             least(gp.clock_end_ms, rw.b), NULL, gp.gap_kind, NULL
        FROM run_windows rw JOIN res gp ON gp.entry = 'GAP' AND gp.window_ordinal = rw.k
      UNION ALL
      SELECT 2 * gr.g, 0, gr.ord, 'TEXT', NULL, gr.ord, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        FROM grouped gr WHERE gr.k IS NULL
      UNION ALL
      SELECT 2 * b.g - 1, 0, 0, 'BOUNDARY', NULL, NULL, NULL, NULL, NULL, NULL,
             CASE WHEN b.rec = b.prev_rec THEN b.a - b.prev_b END, NULL,
             CASE WHEN b.rec = b.prev_rec THEN 'SAME_RECORDING' ELSE 'CROSS_RECORDING' END
        FROM bounds b WHERE b.prev_rec IS NOT NULL
    )
    SELECT (dense_rank() OVER (ORDER BY f.slot))::integer, f.kind, f.k, f.ord, f.rec, f.tr, f.a, f.b, f.elapsed, f.gk, f.bk
      FROM facts f
     ORDER BY f.slot, f.o1, f.o2;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. OWNERSHIP AND GRANTS. Every new function is postgres-owned and executable by nobody, except the plan read
--     (service_role). The forward replacements keep their owner and their (empty) grants.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.replay_resolve_source_windows_v1(uuid, uuid)',
    'public.replay_derive_source_window_binding_v1(uuid, uuid)',
    'public.replay_render_contract_digest_v2(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, text)',
    'public.resolve_replay_version_audio_plan_v1(uuid, uuid)',
    'public.build_replay_render_contract_v1(uuid, uuid, integer, uuid, timestamptz)',
    'public.derive_replay_version_truth_currency_v1(uuid)',
    'public.derive_replay_source_manifest_currency_v1(uuid)',
    'public.replay_lock_source_manifest_v1(uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.resolve_replay_version_audio_plan_v1(uuid, uuid) TO service_role;
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. DEPLOY SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  def text;
  src text;
  fn text;
  needed text;
  r text;
BEGIN
  -- The column: text, nullable, and clear of every I-06B name ban (0102's World, distribution, content and craft bans).
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
                  WHERE a.attrelid = 'public.replay_render_contract_versions'::regclass
                    AND a.attname = 'source_window_binding_digest' AND NOT a.attisdropped AND NOT a.attnotnull
                    AND ty.typname = 'text' AND a.atthasdef = false)
     OR 'source_window_binding_digest' ~ '(world_type|phase|birth_basis|member|episode|governance|proposal|approv|coordinate|embedding|vitality|ranking)'
     OR 'source_window_binding_digest' ~ '(public_flag|is_public|is_shared|shareable|share_flag|share_link|sharing|download|distribut|export|premium|safety|moderation|entitle|launch|clearance|feature_flag|approver|audience)'
     OR 'source_window_binding_digest' ~ '(body|_text$|^text|transcript|audio|content|payload|blob|document|excerpt|snippet|caption_text|statement|moment|committed)'
     OR 'source_window_binding_digest' ~ '(codec|container|bitrate|resolution|frame_rate|framerate|cdn|storage_|bucket|object_key|watermark|drm|template|font|typograph|choreograph|easing|palette)' THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the binding column must be one nullable text digest clear of every I-06B name ban';
  END IF;
  IF (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'public.replay_render_contract_versions'::regclass
       AND a.attnum > 0 AND NOT a.attisdropped) <> 24 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the render contract gains exactly one column';
  END IF;

  -- The four keyed CHECKs and the binding CHECK, by exact meaning; the truth CHECK untouched.
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'public.replay_render_contract_versions'::regclass
     AND c.conname = 'replay_render_contract_versions_window_binding_check';
  IF def IS NULL OR strpos(def, 'source_window_binding_digest IS NULL') = 0
     OR strpos(def, 'source_window_binding_digest IS NOT NULL') = 0
     OR strpos(def, '^sha256:[0-9a-f]{64}$') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the binding CHECK must refuse a V1 binding and a NULL or malformed V2 binding';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'public.replay_render_contract_versions'::regclass
     AND c.conname = 'replay_render_contract_versions_medium_check';
  IF def IS NULL OR strpos(def, 'ORIGINAL_TEXT_ONLY') = 0 OR strpos(def, 'ORIGINAL_MEDIA_PRESERVED') = 0
     OR strpos(def, 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED') = 0 OR strpos(def, 'contract_schema_id') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the medium CHECK must be keyed on the schema with the V1 and the D-04 values';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'public.replay_render_contract_versions'::regclass
     AND c.conname = 'replay_render_contract_versions_timing_check';
  IF def IS NULL OR strpos(def, 'PRESENTATION_PACING_DECLARED') = 0
     OR strpos(def, 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING') = 0 OR strpos(def, 'contract_schema_id') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the timing CHECK must be keyed on the schema with the V1 and the D-04 values';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'public.replay_render_contract_versions'::regclass
     AND c.conname = 'replay_render_contract_versions_schema_check';
  IF def IS NULL OR strpos(def, 'QANDEEL_REPLAY_RENDER_CONTRACT_V1') = 0 OR strpos(def, 'QANDEEL_REPLAY_RENDER_CONTRACT_V2') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the schema CHECK admits exactly V1 and V2';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'public.replay_render_contract_versions'::regclass
     AND c.conname = 'replay_render_contract_versions_truth_check';
  IF def IS NULL OR strpos(def, 'WHOLE_ITEM_ONLY_PROVEN_SAFE') = 0 OR strpos(def, 'NO_EDITORIAL_ANNOTATION') = 0
     OR strpos(def, 'contract_schema_id') > 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the truth CHECK is untouched';
  END IF;

  -- replay_render_contract_digest_v1 is exactly 0103's (its body hash and its signature as at e9311ca1).
  SELECT encode(sha256(convert_to(replace(p.prosrc, chr(13), ''), 'UTF8')), 'hex') INTO src FROM pg_proc p
   WHERE p.oid = 'public.replay_render_contract_digest_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer)'::regprocedure
     AND p.provolatile = 'i';
  IF src IS DISTINCT FROM '073b3faac39f67873090af74a10a3fe3e604782cf7964706aa90eecb97ab5ee4' THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: replay_render_contract_digest_v1 must be byte-identical to 0103';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'replay_render_contract_digest_v1') <> 1 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: there is exactly one replay_render_contract_digest_v1';
  END IF;

  -- The builder keeps 0103's three self-asserted strings and refuses without a V1 fallback.
  SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = 'public.build_replay_render_contract_v1(uuid, uuid, integer, uuid, timestamptz)'::regprocedure;
  FOREACH needed IN ARRAY ARRAY['REPLAY_SEMANTIC_CUT_UNSAFE', 'REPLAY_RENDER_MEDIUM_UNAVAILABLE',
                                'replay_render_contract_digest_v1', 'replay_derive_source_window_binding_v1',
                                'replay_render_contract_digest_v2', 'IF binding IS NULL THEN'] LOOP
    IF strpos(src, needed) = 0 THEN
      RAISE EXCEPTION 'S8B-07 CP1-A: the builder must contain %', needed;
    END IF;
  END LOOP;

  -- The truth revalidation: STABLE, writes nothing, re-derives the binding for a V2 contract.
  SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = 'public.derive_replay_version_truth_currency_v1(uuid)'::regprocedure
     AND p.provolatile = 's' AND p.prosecdef;
  IF src IS NULL OR strpos(src, 'INSERT INTO') > 0 OR src ~ 'UPDATE public' OR strpos(src, 'DELETE FROM') > 0
     OR strpos(src, 'replay_derive_source_window_binding_v1') = 0 OR strpos(src, 'replay_render_contract_digest_v2') = 0
     OR strpos(src, 'replay_render_contract_digest_v1') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the truth revalidation must stay STABLE, write nothing, and re-derive a V2 binding';
  END IF;

  -- The source lock takes no advisory or table lock; the currency stays the asker-free derivation.
  SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = 'public.replay_lock_source_manifest_v1(uuid)'::regprocedure;
  IF src ~* '(pg_advisory|LOCK TABLE)' OR strpos(src, 'ORDER BY rec.id FOR SHARE') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the source lock locks the bound recordings FOR SHARE and takes no advisory or table lock';
  END IF;
  SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = 'public.derive_replay_source_manifest_currency_v1(uuid)'::regprocedure
     AND p.provolatile = 's';
  IF src IS NULL OR strpos(src, 'auth.uid') > 0 OR strpos(src, 'voice_private.recording_readable_v1(creator, vs.recording_id)') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the source currency stays asker-free and asks the recording''s readability';
  END IF;

  -- Every new function: postgres-owned, SECURITY DEFINER where it reads, search_path pinned, revoked; the plan read
  -- alone is service_role's. The resolver and the binding never name a storage key.
  FOREACH fn IN ARRAY ARRAY['public.replay_resolve_source_windows_v1(uuid, uuid)',
                            'public.replay_derive_source_window_binding_v1(uuid, uuid)',
                            'public.resolve_replay_version_audio_plan_v1(uuid, uuid)',
                            'public.replay_render_contract_digest_v2(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, text)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure
                    AND pg_get_userbyid(p.proowner) = 'postgres'
                    AND p.proconfig @> ARRAY['search_path=""']
                    AND (p.prosecdef OR fn LIKE '%digest_v2%')
                    AND p.provolatile = CASE WHEN fn LIKE '%digest_v2%' THEN 'i' ELSE 's' END) THEN
      RAISE EXCEPTION 'S8B-07 CP1-A: % has the wrong owner, posture or volatility', fn;
    END IF;
    SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
    IF src ~ '(storage_key|INSERT INTO|DELETE FROM|UPDATE public|UPDATE voice_private|retention_expires_at)' THEN
      RAISE EXCEPTION 'S8B-07 CP1-A: % may read no storage key, write nothing and touch no retention', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S8B-07 CP1-A: % must not be executable by PUBLIC', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
      IF has_function_privilege(r, fn, 'EXECUTE') <> (r = 'service_role' AND fn LIKE '%audio_plan%') THEN
        RAISE EXCEPTION 'S8B-07 CP1-A: % has the wrong grant for %', fn, r;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['public.build_replay_render_contract_v1(uuid, uuid, integer, uuid, timestamptz)',
                            'public.derive_replay_version_truth_currency_v1(uuid)',
                            'public.derive_replay_source_manifest_currency_v1(uuid)',
                            'public.replay_lock_source_manifest_v1(uuid)'] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
      IF has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S8B-07 CP1-A: the forward-replaced % must stay executable by nobody', fn;
      END IF;
    END LOOP;
  END LOOP;

  -- No Replay relation binds voice_private, and no new relation exists.
  IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
              JOIN pg_class p ON p.oid = c.confrelid JOIN pg_namespace pn ON pn.oid = p.relnamespace
              WHERE c.contype = 'f' AND n.nspname = 'public' AND t.relname LIKE 'replay\_%' AND pn.nspname = 'voice_private') THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: no Replay relation may bind voice_private';
  END IF;
  IF (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind IN ('r', 'v', 'm', 'p', 'f') AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast'))
     IS DISTINCT FROM current_setting('qandeel.s8b07_cp1a_relations', true) THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: no relation is created';
  END IF;

  -- No I-06D writer but the creator's reconciliation (D-08(a)), and every gate still closed.
  IF (SELECT count(*) FROM pg_proc p WHERE p.prosrc LIKE '%INSERT INTO public.replay_source_availability_reconciliation_events%') <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.proname = 'reconcile_replay_post_finalization_state_v1'
                     AND p.prosrc LIKE '%INSERT INTO public.replay_source_availability_reconciliation_events%') THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the creator''s reconciliation is the only I-06D source-availability writer';
  END IF;
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  IF EXISTS (SELECT 1 FROM replay_private.replay_launch_capability_states s
              WHERE s.feature_flag_state <> 'DISABLED' OR s.launch_requirements_state <> 'UNSATISFIED') THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: the Personal Replay gate must remain closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.replay_render_contract_versions c WHERE c.source_window_binding_digest IS NOT NULL) THEN
    RAISE EXCEPTION 'S8B-07 CP1-A: no binding is backfilled';
  END IF;
END$$;

COMMIT;
