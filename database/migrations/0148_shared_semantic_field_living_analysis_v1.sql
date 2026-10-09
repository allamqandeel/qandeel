-- SHARED-VIS-01 — Shared World Living Analysis Map: the Shared semantic place, its stable World-local placement and the
-- member's read boundary over them (QAN-BL-CW-03).
--
-- Additive and forward-only. Migrations 0001–0147 are untouched: no historical table, column, constraint body, trigger,
-- function body or policy is dropped, replaced or rewritten. Everything this migration creates lives in its own schema,
-- `shared_semantic_private`, plus SECURITY INVOKER one-line wrappers in `public`. The S4-01 … S4-04 surfaces in
-- `shared_private` are not extended, so their exact server-channel and human-command sets stay what they are.
--
-- ## What a Shared semantic place IS (Product Owner decisions D1–D4, 2026-10-08)
--
-- A meaningful unit QANDEEL derived from authorized Shared World material: one concise meaning statement, its themes, its
-- exact source provenance and a stable World-local place. It is not a message drawn as a point: its sources are the exact
-- Shared materials it was read from, and its place is reasoned from its meaning, never from a message or turn order.
--
-- Its eligible sources are the World's HUMAN_TEXT. QANDEEL's conversational output is not eligible: the frozen I-04G core
-- (as 0119 remediated it) records that output's additional human requirement as UNRESOLVED and refuses it as a
-- MATERIAL_DEPENDENCY source, and recording it as an unproven influence instead would break exact provenance.
--
-- It is built from the frozen I-04G vocabulary, not beside it:
--
--   * the meaning statement IS one `QANDEEL_ANALYSIS` material (CW2-03 §36) — the reserved kind the 0089 envelope already
--     carries and the 0090 QANDEEL core already commits — with one MATERIAL_DEPENDENCY edge per exact source. The core
--     derives its audience, its required approvers (the union of the sources' human authorities) and its history item,
--     and refuses stale or forged I-03 evidence, exactly as for every QANDEEL material. No second material, history,
--     audience or provenance model is created;
--   * its themes, semantic region and World-local coordinates live in ONE additive relation keyed by that material.
--
-- Visibility (D3). A place is served to a reader only when the frozen 0089 resolver serves its meaning to them AND serves
-- them every one of its MATERIAL_DEPENDENCY sources — the reader's current authority over every source, through the ONE
-- visibility authority (I-04F, 0087), never a copy of it. Membership episodes, history grants and source availability are
-- therefore that resolver's, unchanged.
--
-- Deletion (D4) — the frozen dependency semantics, not a new rule. A place states the meaning OF its sources, so it is
-- source-content-bearing: owner deletion of any source makes the place's material UNAVAILABLE and physically removes its
-- meaning body through the frozen 0090 MATERIAL_DEPENDENCY closure (CW2-02 §27). The relation below is bound to that body
-- ON DELETE CASCADE, so the themes, region and coordinates are removed in the same statement: nothing derived from a
-- deleted source survives to be shown, and nothing is regenerated from the remaining material. The Product Definition's
-- "earlier analysis is kept" (§19) is the REASONING / conversational side of the same frozen distinction: QANDEEL's
-- conversational replies (S4-02, no material dependency) stay as historical discussion, untouched here.
--
-- Placement (CW2-07 §21, §47). Coordinates are canonical state of ONE Shared World in its own space
-- `QANDEEL_SHARED_FIELD_V1` — exact signed integers within [-(2^62), 2^62 - 1], the bound the Map's exact world math uses —
-- never the Personal Home scheme and never the Public field's: Shared Worlds are geocoded independently and share no
-- coordinate alignment with each other or with any other World. A place is committed once and never moved.
--
-- Production (D2). The API produces places through provider-neutral ports that REFUSE until Stage 8A binds a provider, so
-- outside tests no place is produced and the field is legitimately empty. Nothing here manufactures one.
--
-- ## What this adds
--
--   A. `semantic_places` (the place) and the pass-work state: `semantic_passes` (one row per completed pass, so an
--      equivalent retry starts nothing again), `semantic_work_leases` (at most one live pass per World, across every API
--      instance) and `semantic_work_grants` (the rolling per-World work-start budget). The work tables hold no content.
--   B. The server's acts (`service_role` only): begin a pass, read the World's existing places (the interpreter's context),
--      complete ONE place under the lease (through the frozen 0090 core), end the pass.
--   C. The member's reads (`authenticated`): the field of the exact World, one place, and one place's sources — each for a
--      CURRENT member of an ACTIVE World only, through the frozen resolver.
--   D. The ended World's read-only conversation without semantic places: `list_own_closed_shared_world_material_v2`, the
--      0140 read with QANDEEL_ANALYSIS excluded (the 0140 function is not changed; the API moves to v2). The active
--      conversation already carries each row's kind, so its Product projection excludes places itself.
--
-- ## Lock order (continues 0139 / 0090; never reversed)
--
--   0. the gate row of SHARED_CONVERSATION       (FOR SHARE — inside bind_shared_launch_gate_v1)
--   0a. the World's semantic-work lock           (advisory, own namespace — begin only)
--   0b. the semantic work lease row              (complete / end)
--   1. the World row                             (FOR UPDATE — inside the frozen 0090 core)
--   2. source material / history rows            (inside the frozen 0090 core)
--   3. the place row                             (insert, after the core)

BEGIN;

CREATE SCHEMA shared_semantic_private;
REVOKE ALL ON SCHEMA shared_semantic_private FROM PUBLIC;

-- =====================================================================================================================
-- A. THE RELATIONS.
-- =====================================================================================================================

-- A.0 The shape rules, exactly the API's: one trimmed line, no control character, no identifier.
CREATE FUNCTION shared_semantic_private.is_semantic_text_v1(p_value text, p_max integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_value IS NOT NULL AND length(p_value) BETWEEN 1 AND p_max AND p_value = btrim(p_value)
     AND p_value !~ '[\n\r\t]'
     AND p_value !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
$$;

CREATE FUNCTION shared_semantic_private.is_theme_set_v1(p_themes text[], p_min integer, p_max integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_themes IS NOT NULL AND coalesce(array_length(p_themes, 1), 0) BETWEEN p_min AND p_max
     AND coalesce(array_ndims(p_themes), 1) = 1
     AND NOT EXISTS (SELECT 1 FROM unnest(p_themes) AS t(theme)
                      WHERE NOT shared_semantic_private.is_semantic_text_v1(t.theme, 40))
     AND (SELECT count(DISTINCT lower(t.theme)) FROM unnest(p_themes) AS t(theme)) = coalesce(array_length(p_themes, 1), 0);
$$;

-- A.1 THE PLACE. One row per committed Shared semantic place. Its meaning is the bound QANDEEL_ANALYSIS body; this row is
--     the rest of the place, and it lives exactly as long as that body does.
CREATE TABLE shared_semantic_private.semantic_places (
    material_id uuid NOT NULL,
    world_id uuid NOT NULL,
    -- The committed HUMAN_TEXT command whose pass produced the place, and the place's ordinal within that pass. Together
    -- they derive every persistence identity, so an equivalent retry names the same place.
    pass_command_id uuid NOT NULL,
    place_ordinal smallint NOT NULL,
    interpretation_contract text NOT NULL,
    primary_themes text[] NOT NULL,
    secondary_themes text[] NOT NULL,
    semantic_region text NOT NULL,
    spatial_contract text NOT NULL,
    layout_version text NOT NULL,
    coordinate_scheme text NOT NULL,
    world_x bigint NOT NULL,
    world_y bigint NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT semantic_places_pk PRIMARY KEY (material_id),
    CONSTRAINT semantic_places_pass_key UNIQUE (pass_command_id, place_ordinal),
    CONSTRAINT semantic_places_ordinal_check CHECK (place_ordinal BETWEEN 1 AND 3),
    CONSTRAINT semantic_places_interpretation_check CHECK (interpretation_contract = 'SHARED_SEMANTIC_INTERPRETATION_V1'),
    CONSTRAINT semantic_places_primary_check CHECK (shared_semantic_private.is_theme_set_v1(primary_themes, 1, 3)),
    CONSTRAINT semantic_places_secondary_check CHECK (shared_semantic_private.is_theme_set_v1(secondary_themes, 0, 3)),
    CONSTRAINT semantic_places_disjoint_check CHECK (NOT (lower(primary_themes::text)::text[] && lower(secondary_themes::text)::text[])),
    CONSTRAINT semantic_places_region_check CHECK (semantic_region ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
    CONSTRAINT semantic_places_spatial_check CHECK (spatial_contract = 'SHARED_SPATIAL_PLACEMENT_V1'),
    CONSTRAINT semantic_places_layout_check CHECK (layout_version ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
    CONSTRAINT semantic_places_scheme_check CHECK (coordinate_scheme = 'QANDEEL_SHARED_FIELD_V1'),
    CONSTRAINT semantic_places_bound_check CHECK (
      world_x BETWEEN -4611686018427387904 AND 4611686018427387903
      AND world_y BETWEEN -4611686018427387904 AND 4611686018427387903),
    -- The place IS one exact material of its own World.
    CONSTRAINT semantic_places_material_fk
        FOREIGN KEY (material_id, world_id) REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    -- ERASURE FOLLOWS THE MEANING: when the frozen 0090 closure physically removes the place's meaning body (a source was
    -- deleted by its owner), this row goes in the same statement.
    CONSTRAINT semantic_places_body_fk
        FOREIGN KEY (material_id) REFERENCES public.shared_world_text_material_bodies (material_id) ON DELETE CASCADE,
    CONSTRAINT semantic_places_pass_fk
        FOREIGN KEY (pass_command_id) REFERENCES public.shared_world_material_commit_commands (id) ON DELETE RESTRICT
);
CREATE INDEX semantic_places_world_idx ON shared_semantic_private.semantic_places (world_id, committed_at, material_id);

COMMENT ON TABLE shared_semantic_private.semantic_places IS
  'SHARED-VIS-01: one Shared semantic place — the themes, semantic region and stable World-local coordinates '
  '(QANDEEL_SHARED_FIELD_V1) of ONE QANDEEL_ANALYSIS material whose body is the place''s meaning. Committed once, never '
  'moved; removed only with its meaning body (owner deletion of a source, through the frozen MATERIAL_DEPENDENCY closure).';

-- A.2 One row per completed pass: the answer to an equivalent retry. Identities, an instant and a count only.
CREATE TABLE shared_semantic_private.semantic_passes (
    pass_command_id uuid NOT NULL,
    world_id uuid NOT NULL,
    place_count smallint NOT NULL,
    completed_at timestamptz NOT NULL,
    CONSTRAINT semantic_passes_pk PRIMARY KEY (pass_command_id),
    CONSTRAINT semantic_passes_count_check CHECK (place_count BETWEEN 0 AND 3),
    CONSTRAINT semantic_passes_command_fk
        FOREIGN KEY (pass_command_id) REFERENCES public.shared_world_material_commit_commands (id) ON DELETE RESTRICT,
    CONSTRAINT semantic_passes_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT
);

-- A.3 Runtime authority state of the pass work (the PROD-SEC-02 / 0131 principle): no content, no application role.
CREATE TABLE shared_semantic_private.semantic_work_leases (
    pass_command_id uuid NOT NULL,
    world_id uuid NOT NULL,
    lease_id uuid NOT NULL,
    acquired_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    CONSTRAINT semantic_work_leases_pk PRIMARY KEY (pass_command_id),
    CONSTRAINT semantic_work_leases_command_fk
        FOREIGN KEY (pass_command_id) REFERENCES public.shared_world_material_commit_commands (id) ON DELETE CASCADE,
    CONSTRAINT semantic_work_leases_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE CASCADE,
    CONSTRAINT semantic_work_leases_window_check CHECK (expires_at > acquired_at)
);
CREATE INDEX semantic_work_leases_world_idx ON shared_semantic_private.semantic_work_leases (world_id, expires_at);

-- One row per GRANTED pass, kept as long as the longest window needs it; returning a lease never removes its grant.
CREATE TABLE shared_semantic_private.semantic_work_grants (
    id bigint GENERATED ALWAYS AS IDENTITY,
    world_id uuid NOT NULL,
    granted_at timestamptz NOT NULL,
    CONSTRAINT semantic_work_grants_pk PRIMARY KEY (id),
    CONSTRAINT semantic_work_grants_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE CASCADE
);
CREATE INDEX semantic_work_grants_world_idx ON shared_semantic_private.semantic_work_grants (world_id, granted_at);

-- A.4 The place and the pass are append-only for every role, the owner included. An inserted place IS a QANDEEL_ANALYSIS
--     material of its own World; a place leaves only once its meaning body is physically gone (the cascade above).
CREATE FUNCTION shared_semantic_private.guard_semantic_history_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'semantic_places' THEN
    IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.shared_world_materials m
                                     WHERE m.id = NEW.material_id AND m.world_id = NEW.world_id
                                       AND m.material_kind = 'QANDEEL_ANALYSIS' AND m.producer_kind = 'QANDEEL') THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b
                                         WHERE b.material_id = OLD.material_id) THEN
      RETURN OLD;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'SHARED_SEMANTIC_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000',
          DETAIL = 'A Shared semantic place is committed once and never moved; it leaves only with its meaning body. '
                   'A completed pass is history.';
END$$;

CREATE TRIGGER semantic_places_immutable BEFORE INSERT OR UPDATE OR DELETE ON shared_semantic_private.semantic_places
    FOR EACH ROW EXECUTE FUNCTION shared_semantic_private.guard_semantic_history_v1();
CREATE TRIGGER semantic_passes_immutable BEFORE INSERT OR UPDATE OR DELETE ON shared_semantic_private.semantic_passes
    FOR EACH ROW EXECUTE FUNCTION shared_semantic_private.guard_semantic_history_v1();

ALTER TABLE shared_semantic_private.semantic_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_semantic_private.semantic_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_semantic_private.semantic_work_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_semantic_private.semantic_work_grants ENABLE ROW LEVEL SECURITY;

-- =====================================================================================================================
-- B. INTERNAL DERIVATIONS. Executable by no application role.
-- =====================================================================================================================

-- B.1 Server-derived persistence identities: one pass command and one ordinal name exactly one place, however often the
--     pass is retried; no caller supplies a material, history item or command identity.
CREATE FUNCTION shared_semantic_private.derive_semantic_identity_v1(p_namespace text, p_pass_command_id uuid, p_ordinal integer)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_SHARED_VIS_01_SEMANTIC_PLACE_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_pass_command_id::text) || E'\n' || p_ordinal::text, 'UTF8')), 'hex') AS h) d;
$$;

-- B.2 The pass-work bound (an implementation policy, like the 0139 reply bound): one live pass per World, and a rolling
--     per-World budget of pass starts. Every pass rides on a human message that already passed the conversation bound.
CREATE FUNCTION shared_semantic_private.semantic_work_policy_v1(
  OUT world_in_flight_limit integer,
  OUT short_window interval,
  OUT short_window_limit integer,
  OUT long_window interval,
  OUT long_window_limit integer
) LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 1, interval '10 minutes', 20, interval '24 hours', 300
$$;

-- B.3 Whether `p_user` is a CURRENT member of the ACTIVE World (the S4-01 entry law).
CREATE FUNCTION shared_semantic_private.is_current_member_v1(p_world_id uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e JOIN public.shared_worlds w ON w.id = e.world_id
                  WHERE e.world_id = p_world_id AND e.user_id = p_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE');
$$;

-- B.4 THE ONE VISIBILITY DERIVATION of the member reads: the places of the exact World whose meaning the frozen resolver
--     serves this reader AND every one of whose MATERIAL_DEPENDENCY sources it serves them too. Nothing else is served.
CREATE FUNCTION shared_semantic_private.visible_places_v1(p_world_id uuid, p_user uuid)
RETURNS TABLE (material_id uuid, meaning text, established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
    WITH visible AS MATERIALIZED (
      SELECT r.material_id, r.text_body, r.established_at
        FROM public.resolve_shared_world_material_v1(p_world_id, p_user) r
    )
    SELECT p.material_id, v.text_body, v.established_at
      FROM shared_semantic_private.semantic_places p
      JOIN visible v ON v.material_id = p.material_id
     WHERE p.world_id = p_world_id AND v.text_body IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.shared_world_material_dependencies d
                    WHERE d.target_material_id = p.material_id AND d.dependency_kind = 'MATERIAL_DEPENDENCY')
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_material_dependencies d
                        WHERE d.target_material_id = p.material_id AND d.dependency_kind = 'MATERIAL_DEPENDENCY'
                          AND NOT EXISTS (SELECT 1 FROM visible s WHERE s.material_id = d.source_material_id));
END$$;

-- =====================================================================================================================
-- C. THE SERVER'S ACTS (service_role only).
-- =====================================================================================================================

-- C.1 Begin ONE pass for one committed human message of this exact World. GRANTED (a new lease) | IN_PROGRESS (the World
--     already has a live pass) | DONE (this message's pass completed) | LIMITED (the World's work-start budget; one
--     answer for every reason) | UNAVAILABLE (not a committed HUMAN_TEXT command of this World, the World is not
--     ACTIVE / STANDARD, or the conversation capability DENIES). A refusal records nothing.
CREATE FUNCTION shared_semantic_private.begin_shared_semantic_work_v1(p_pass_command_id uuid, p_world_id uuid)
RETURNS TABLE (work_outcome text, work_lease_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_human public.shared_world_material_commit_commands;
  v_gate record;
  v_policy record;
  v_lease uuid;
BEGIN
  IF p_pass_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_human FROM public.shared_world_material_commit_commands c WHERE c.id = p_pass_command_id;
  IF NOT FOUND OR v_human.world_id <> p_world_id OR v_human.producer_kind <> 'HUMAN' OR v_human.material_kind <> 'HUMAN_TEXT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_passes s WHERE s.pass_command_id = p_pass_command_id) THEN
    RETURN QUERY SELECT 'DONE'::text, NULL::uuid;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD') THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- LOCK ORDER STEP 0: no provider work starts while ordinary Shared conversation is closed.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- The World's work lock: every decision below is made under it, for every API instance at once.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qandeel.shared-semantic-work.v1:' || p_world_id::text, 0));
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_passes s WHERE s.pass_command_id = p_pass_command_id) THEN
    RETURN QUERY SELECT 'DONE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT * INTO v_policy FROM shared_semantic_private.semantic_work_policy_v1();
  -- Bounded housekeeping of this World's rows only.
  DELETE FROM shared_semantic_private.semantic_work_leases l WHERE l.world_id = p_world_id AND l.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM shared_semantic_private.semantic_work_grants g
   WHERE g.world_id = p_world_id AND g.granted_at <= CURRENT_TIMESTAMP - v_policy.long_window;
  IF (SELECT count(*) FROM shared_semantic_private.semantic_work_leases l WHERE l.world_id = p_world_id) >= v_policy.world_in_flight_limit THEN
    RETURN QUERY SELECT 'IN_PROGRESS'::text, NULL::uuid;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM shared_semantic_private.semantic_work_grants g
       WHERE g.world_id = p_world_id AND g.granted_at > CURRENT_TIMESTAMP - v_policy.short_window) >= v_policy.short_window_limit
     OR (SELECT count(*) FROM shared_semantic_private.semantic_work_grants g WHERE g.world_id = p_world_id) >= v_policy.long_window_limit THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid;
    RETURN;
  END IF;
  v_lease := pg_catalog.gen_random_uuid();
  INSERT INTO shared_semantic_private.semantic_work_leases (pass_command_id, world_id, lease_id, acquired_at, expires_at)
  VALUES (p_pass_command_id, p_world_id, v_lease, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + public.foreground_generation_lease_interval_v1());
  INSERT INTO shared_semantic_private.semantic_work_grants (world_id, granted_at) VALUES (p_world_id, CURRENT_TIMESTAMP);
  RETURN QUERY SELECT 'GRANTED'::text, v_lease;
END$$;

-- C.2 The World's places that are still whole, for the interpreter's context: each place's meaning and its exact sources.
--     Only under a live lease of this World. Nothing about any member.
CREATE FUNCTION shared_semantic_private.read_shared_semantic_context_v1(p_lease_id uuid, p_world_id uuid)
RETURNS TABLE (material_id uuid, meaning text, source_material_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_lease_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM shared_semantic_private.semantic_work_leases l
                  WHERE l.lease_id = p_lease_id AND l.world_id = p_world_id AND l.expires_at > CURRENT_TIMESTAMP) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.material_id, b.body_text,
           (SELECT array_agg(d.source_material_id ORDER BY d.source_material_id)
              FROM public.shared_world_material_dependencies d
             WHERE d.target_material_id = p.material_id AND d.dependency_kind = 'MATERIAL_DEPENDENCY')
      FROM shared_semantic_private.semantic_places p
      JOIN public.shared_world_text_material_bodies b ON b.material_id = p.material_id
     WHERE p.world_id = p_world_id
     ORDER BY p.committed_at, p.material_id
     LIMIT 400;
END$$;

-- C.3 Complete ONE place under the pass lease. Outcomes: MATERIAL_COMMITTED (now, or already under this pass and ordinal
--     — answered from durable history) | STALE (the frozen 40001: the audience moved, or a source is no longer available)
--     | UNAVAILABLE (not the current lease holder, not a committed human message of this World, a source that is not
--     human text of this World, the capability DENIES, or the frozen core's bounded refusal).
--     Invalid or forged evidence (22023) and identity conflicts (23505) propagate unchanged.
CREATE FUNCTION shared_semantic_private.complete_shared_semantic_place_v1(
  p_lease_id uuid, p_pass_command_id uuid, p_place_ordinal integer, p_world_id uuid, p_meaning text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_primary_themes text[], p_secondary_themes text[], p_semantic_region text,
  p_layout_version text, p_world_x bigint, p_world_y bigint
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_human public.shared_world_material_commit_commands;
  v_command uuid;
  v_material uuid;
  v_item uuid;
  v_committed public.shared_world_material_commit_commands;
  v_gate record;
  v_result record;
  v_sources integer;
BEGIN
  IF p_lease_id IS NULL OR p_pass_command_id IS NULL OR p_world_id IS NULL OR p_place_ordinal IS NULL
     OR p_place_ordinal NOT BETWEEN 1 AND 3
     OR NOT shared_semantic_private.is_semantic_text_v1(p_meaning, 120)
     OR p_material_source_ids IS NULL OR coalesce(array_length(p_material_source_ids, 1), 0) NOT BETWEEN 1 AND 24
     OR array_position(p_material_source_ids, NULL::uuid) IS NOT NULL
     OR NOT shared_semantic_private.is_theme_set_v1(p_primary_themes, 1, 3)
     OR NOT shared_semantic_private.is_theme_set_v1(p_secondary_themes, 0, 3)
     OR EXISTS (SELECT 1 FROM unnest(p_primary_themes) AS a(theme), unnest(p_secondary_themes) AS b(theme)
                 WHERE lower(a.theme) = lower(b.theme))
     OR p_semantic_region IS NULL OR p_semantic_region !~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
     OR p_layout_version IS NULL OR p_layout_version !~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
     OR p_world_x IS NULL OR p_world_y IS NULL
     OR p_world_x NOT BETWEEN -4611686018427387904 AND 4611686018427387903
     OR p_world_y NOT BETWEEN -4611686018427387904 AND 4611686018427387903 THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_command := shared_semantic_private.derive_semantic_identity_v1('PLACE_COMMAND', p_pass_command_id, p_place_ordinal);
  v_material := shared_semantic_private.derive_semantic_identity_v1('PLACE_MATERIAL', p_pass_command_id, p_place_ordinal);
  v_item := shared_semantic_private.derive_semantic_identity_v1('PLACE_HISTORY_ITEM', p_pass_command_id, p_place_ordinal);

  -- A human message of this exact World started this pass. Anything else is one UNAVAILABLE that changes nothing.
  SELECT * INTO v_human FROM public.shared_world_material_commit_commands c WHERE c.id = p_pass_command_id;
  IF NOT FOUND OR v_human.world_id <> p_world_id OR v_human.producer_kind <> 'HUMAN' OR v_human.material_kind <> 'HUMAN_TEXT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- An already committed place of this pass and ordinal is the answer, whatever is offered now.
  SELECT * INTO v_committed FROM public.shared_world_material_commit_commands c
   WHERE c.id = v_command AND c.world_id = p_world_id AND c.producer_kind = 'QANDEEL';
  IF FOUND THEN
    RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_committed.material_id, v_committed.committed_at;
    RETURN;
  END IF;

  -- LOCK ORDER STEP 0: the current conversation-capability snapshot, FOR SHARE until this transaction ends.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- Only the holder of this pass's CURRENT, unexpired lease commits; the row is locked against a concurrent begin.
  PERFORM 1 FROM shared_semantic_private.semantic_work_leases l
   WHERE l.pass_command_id = p_pass_command_id AND l.lease_id = p_lease_id AND l.world_id = p_world_id
     AND l.expires_at > CURRENT_TIMESTAMP
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- A place is read from what the World's humans said: HUMAN_TEXT of THIS World only. Never from another place (no meaning
  -- of a meaning), never from a reserved kind, and never from QANDEEL's conversational output: the frozen I-04G core records
  -- that output's additional human requirement as UNRESOLVED (0119) and refuses it as a MATERIAL_DEPENDENCY source, so it
  -- is not an eligible source, and it is refused here before the core is reached.
  SELECT count(*)::integer INTO v_sources FROM public.shared_world_materials m
   WHERE m.id = ANY(p_material_source_ids) AND m.world_id = p_world_id AND m.material_kind = 'HUMAN_TEXT';
  IF v_sources <> array_length(p_material_source_ids, 1) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  BEGIN
    SELECT c.committed_material_id, c.material_established_at INTO v_result
      FROM public.commit_shared_world_qandeel_material_v1(
             v_command, p_world_id, v_material, v_item, 'QANDEEL_ANALYSIS', p_meaning,
             p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref,
             p_authority_revalidation_ref, p_readiness_ref, p_audience_snapshot_ref,
             p_material_source_ids, ARRAY[]::text[]) c;
  EXCEPTION
    WHEN no_data_found THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
  END;

  INSERT INTO shared_semantic_private.semantic_places
    (material_id, world_id, pass_command_id, place_ordinal, interpretation_contract, primary_themes, secondary_themes,
     semantic_region, spatial_contract, layout_version, coordinate_scheme, world_x, world_y, committed_at)
  VALUES (v_result.committed_material_id, p_world_id, p_pass_command_id, p_place_ordinal, 'SHARED_SEMANTIC_INTERPRETATION_V1',
          p_primary_themes, p_secondary_themes, p_semantic_region, 'SHARED_SPATIAL_PLACEMENT_V1', p_layout_version,
          'QANDEEL_SHARED_FIELD_V1', p_world_x, p_world_y, v_result.material_established_at);

  RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_result.committed_material_id, v_result.material_established_at;
END$$;

-- C.4 End the pass. A COMPLETED pass is recorded once (so an equivalent retry starts nothing again) with the number of
--     places it committed; an abandoned one is not. Either way only the exact holder's lease is returned.
CREATE FUNCTION shared_semantic_private.end_shared_semantic_work_v1(p_pass_command_id uuid, p_lease_id uuid, p_completed boolean)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_world uuid;
BEGIN
  IF p_pass_command_id IS NULL OR p_lease_id IS NULL OR p_completed IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  DELETE FROM shared_semantic_private.semantic_work_leases l
   WHERE l.pass_command_id = p_pass_command_id AND l.lease_id = p_lease_id
  RETURNING l.world_id INTO v_world;
  IF v_world IS NULL THEN
    RETURN false;
  END IF;
  IF p_completed THEN
    INSERT INTO shared_semantic_private.semantic_passes (pass_command_id, world_id, place_count, completed_at)
    SELECT p_pass_command_id, v_world,
           (SELECT count(*) FROM shared_semantic_private.semantic_places p WHERE p.pass_command_id = p_pass_command_id)::smallint,
           CURRENT_TIMESTAMP
    ON CONFLICT (pass_command_id) DO NOTHING;
  END IF;
  RETURN true;
END$$;

-- =====================================================================================================================
-- D. THE MEMBER'S READS (authenticated). The reader is auth.uid(); a non-member, a former member, an ended World and a
--    World that never existed read the same thing: nothing. No hidden place, count, coordinate or placeholder.
-- =====================================================================================================================

-- D.1 The field of the exact World: every place the reader may see, at its committed place (exact integer text, never a
--     float). Bounded (400, the S5-03B v1
--     bound; density at scale is LA-SCALE-01's).
CREATE FUNCTION shared_semantic_private.list_own_shared_semantic_field_v1(p_world_id uuid)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.material_id, p.world_x::text, p.world_y::text, v.meaning, p.semantic_region
      FROM shared_semantic_private.visible_places_v1(p_world_id, v_user) v
      JOIN shared_semantic_private.semantic_places p ON p.material_id = v.material_id
     ORDER BY p.committed_at, p.material_id
     LIMIT 400;
END$$;

-- D.2 One place the reader may see: its meaning, themes, region, place and instant. Otherwise nothing.
CREATE FUNCTION shared_semantic_private.read_own_shared_semantic_place_v1(p_world_id uuid, p_place_id uuid)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text,
               primary_themes text[], secondary_themes text[], established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_place_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.material_id, p.world_x::text, p.world_y::text, v.meaning, p.semantic_region, p.primary_themes, p.secondary_themes, v.established_at
      FROM shared_semantic_private.visible_places_v1(p_world_id, v_user) v
      JOIN shared_semantic_private.semantic_places p ON p.material_id = v.material_id
     WHERE p.material_id = p_place_id;
END$$;

-- D.3 The exact sources of one place the reader may see, oldest first, with the same attribution the conversation shows
--     (the reader themself, another human's Name, or QANDEEL). A place the reader may not see has no sources here.
CREATE FUNCTION shared_semantic_private.list_own_shared_semantic_place_sources_v1(p_world_id uuid, p_place_id uuid)
RETURNS TABLE (material_id uuid, producer_kind text, is_self boolean, author_name text, text_body text, established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_place_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, v_user)
     OR NOT EXISTS (SELECT 1 FROM shared_semantic_private.visible_places_v1(p_world_id, v_user) v WHERE v.material_id = p_place_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE u.name END,
           m.text_body, m.established_at
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      JOIN public.shared_world_material_dependencies d
        ON d.source_material_id = m.material_id AND d.target_material_id = p_place_id AND d.dependency_kind = 'MATERIAL_DEPENDENCY'
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL
     ORDER BY m.established_at, m.material_id;
END$$;

-- D.4 The ended World's read-only conversation: exactly the 0140 read, without semantic places (a place is drawn in the
--     Living Analysis World, never as a message). The 0140 function is unchanged.
CREATE FUNCTION shared_semantic_private.list_own_closed_shared_world_material_v2(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, producer_kind text, established_at timestamptz, is_self boolean, author_name text, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements ent
                   JOIN public.shared_worlds w ON w.id = ent.world_id
                  WHERE ent.world_id = p_world_id AND ent.user_id = v_user
                    AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD') THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE u.name END,
           m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL AND m.material_kind <> 'QANDEEL_ANALYSIS'
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$$;

-- =====================================================================================================================
-- E. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.begin_shared_semantic_work_v1(p_pass_command_id uuid, p_world_id uuid)
RETURNS TABLE (work_outcome text, work_lease_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.work_outcome, r.work_lease_id FROM shared_semantic_private.begin_shared_semantic_work_v1(p_pass_command_id, p_world_id) r;
$$;

CREATE FUNCTION public.read_shared_semantic_context_v1(p_lease_id uuid, p_world_id uuid)
RETURNS TABLE (material_id uuid, meaning text, source_material_ids uuid[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.meaning, r.source_material_ids FROM shared_semantic_private.read_shared_semantic_context_v1(p_lease_id, p_world_id) r;
$$;

CREATE FUNCTION public.complete_shared_semantic_place_v1(
  p_lease_id uuid, p_pass_command_id uuid, p_place_ordinal integer, p_world_id uuid, p_meaning text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_primary_themes text[], p_secondary_themes text[], p_semantic_region text,
  p_layout_version text, p_world_x bigint, p_world_y bigint
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.material_id, r.established_at
    FROM shared_semantic_private.complete_shared_semantic_place_v1(
           p_lease_id, p_pass_command_id, p_place_ordinal, p_world_id, p_meaning,
           p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref, p_authority_revalidation_ref,
           p_readiness_ref, p_audience_snapshot_ref, p_material_source_ids, p_primary_themes, p_secondary_themes,
           p_semantic_region, p_layout_version, p_world_x, p_world_y) r;
$$;

CREATE FUNCTION public.end_shared_semantic_work_v1(p_pass_command_id uuid, p_lease_id uuid, p_completed boolean)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT shared_semantic_private.end_shared_semantic_work_v1(p_pass_command_id, p_lease_id, p_completed);
$$;

CREATE FUNCTION public.list_own_shared_semantic_field_v1(p_world_id uuid)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.place_id, r.world_x, r.world_y, r.meaning, r.semantic_region FROM shared_semantic_private.list_own_shared_semantic_field_v1(p_world_id) r;
$$;

CREATE FUNCTION public.read_own_shared_semantic_place_v1(p_world_id uuid, p_place_id uuid)
RETURNS TABLE (place_id uuid, world_x text, world_y text, meaning text, semantic_region text,
               primary_themes text[], secondary_themes text[], established_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.place_id, r.world_x, r.world_y, r.meaning, r.semantic_region, r.primary_themes, r.secondary_themes, r.established_at
    FROM shared_semantic_private.read_own_shared_semantic_place_v1(p_world_id, p_place_id) r;
$$;

CREATE FUNCTION public.list_own_shared_semantic_place_sources_v1(p_world_id uuid, p_place_id uuid)
RETURNS TABLE (material_id uuid, producer_kind text, is_self boolean, author_name text, text_body text, established_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.producer_kind, r.is_self, r.author_name, r.text_body, r.established_at
    FROM shared_semantic_private.list_own_shared_semantic_place_sources_v1(p_world_id, p_place_id) r;
$$;

CREATE FUNCTION public.list_own_closed_shared_world_material_v2(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, producer_kind text, established_at timestamptz, is_self boolean, author_name text, text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.producer_kind, r.established_at, r.is_self, r.author_name, r.text_body
    FROM shared_semantic_private.list_own_closed_shared_world_material_v2(p_world_id, p_before_established_at, p_before_material_id, p_limit) r;
$$;

-- =====================================================================================================================
-- F. PRIVILEGES. Ownership; default-deny for everything; then the exact grants.
-- =====================================================================================================================
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'shared_semantic_private'
               OR (n.nspname = 'public' AND p.proname IN ('begin_shared_semantic_work_v1', 'read_shared_semantic_context_v1',
                   'complete_shared_semantic_place_v1', 'end_shared_semantic_work_v1', 'list_own_shared_semantic_field_v1',
                   'read_own_shared_semantic_place_v1', 'list_own_shared_semantic_place_sources_v1',
                   'list_own_closed_shared_world_material_v2')) LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', f.sig);
    END IF;
  END LOOP;
END$$;

ALTER TABLE shared_semantic_private.semantic_places OWNER TO postgres;
ALTER TABLE shared_semantic_private.semantic_passes OWNER TO postgres;
ALTER TABLE shared_semantic_private.semantic_work_leases OWNER TO postgres;
ALTER TABLE shared_semantic_private.semantic_work_grants OWNER TO postgres;
REVOKE ALL ON TABLE shared_semantic_private.semantic_places, shared_semantic_private.semantic_passes,
                    shared_semantic_private.semantic_work_leases, shared_semantic_private.semantic_work_grants
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE shared_semantic_private.semantic_work_grants_id_seq FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE shared_semantic_private.semantic_places, shared_semantic_private.semantic_passes, shared_semantic_private.semantic_work_leases, shared_semantic_private.semantic_work_grants FROM service_role';
  EXECUTE 'REVOKE ALL ON SEQUENCE shared_semantic_private.semantic_work_grants_id_seq FROM service_role';
  -- THE SERVER'S ACTS. A place is produced by the server, never under a human's token: USAGE on the schema (no table
  -- privilege travels with it) and EXECUTE on exactly the four pass commands.
  EXECUTE 'GRANT USAGE ON SCHEMA shared_semantic_private TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION shared_semantic_private.begin_shared_semantic_work_v1(uuid, uuid), shared_semantic_private.read_shared_semantic_context_v1(uuid, uuid), shared_semantic_private.complete_shared_semantic_place_v1(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, uuid[], text[], text[], text, text, bigint, bigint), shared_semantic_private.end_shared_semantic_work_v1(uuid, uuid, boolean), public.begin_shared_semantic_work_v1(uuid, uuid), public.read_shared_semantic_context_v1(uuid, uuid), public.complete_shared_semantic_place_v1(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, uuid[], text[], text[], text, text, bigint, bigint), public.end_shared_semantic_work_v1(uuid, uuid, boolean) TO service_role';
END IF; END$$;

-- The member's four reads, on the member's own token.
GRANT USAGE ON SCHEMA shared_semantic_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  shared_semantic_private.list_own_shared_semantic_field_v1(uuid),
  shared_semantic_private.read_own_shared_semantic_place_v1(uuid, uuid),
  shared_semantic_private.list_own_shared_semantic_place_sources_v1(uuid, uuid),
  shared_semantic_private.list_own_closed_shared_world_material_v2(uuid, timestamptz, uuid, integer),
  public.list_own_shared_semantic_field_v1(uuid),
  public.read_own_shared_semantic_place_v1(uuid, uuid),
  public.list_own_shared_semantic_place_sources_v1(uuid, uuid),
  public.list_own_closed_shared_world_material_v2(uuid, timestamptz, uuid, integer)
  TO authenticated;

-- =====================================================================================================================
-- G. DEPLOY-TIME SELF-ASSERTIONS.
-- =====================================================================================================================
DO $$
DECLARE
  p record;
  t text;
  r text;
BEGIN
  -- G1. Every private function is a pinned, postgres-owned SECURITY DEFINER; every exposed wrapper is an INVOKER.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'shared_semantic_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'SHARED-VIS-01: shared_semantic_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;
  FOR p IN SELECT pr.proname, pr.prosecdef FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public' AND pr.proname IN ('begin_shared_semantic_work_v1', 'read_shared_semantic_context_v1',
                  'complete_shared_semantic_place_v1', 'end_shared_semantic_work_v1', 'list_own_shared_semantic_field_v1',
                  'read_own_shared_semantic_place_v1', 'list_own_shared_semantic_place_sources_v1',
                  'list_own_closed_shared_world_material_v2') LOOP
    IF p.prosecdef THEN
      RAISE EXCEPTION 'SHARED-VIS-01: public.% must be SECURITY INVOKER', p.proname;
    END IF;
  END LOOP;

  -- G2. No application role reaches a relation of this schema; all four have row level security.
  FOREACH t IN ARRAY ARRAY['semantic_places', 'semantic_passes', 'semantic_work_leases', 'semantic_work_grants'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('shared_semantic_private.' || t)::regclass) THEN
      RAISE EXCEPTION 'SHARED-VIS-01: % must have row level security', t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
         AND has_table_privilege(r, 'shared_semantic_private.' || t, 'SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'SHARED-VIS-01: % must not reach %', r, t;
      END IF;
    END LOOP;
  END LOOP;

  -- G3. A client executes no server act; the server executes no member read; nobody executes an internal derivation.
  FOR p IN SELECT pr.oid::regprocedure AS sig, pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname IN ('shared_semantic_private', 'public')
              AND pr.proname IN ('begin_shared_semantic_work_v1', 'read_shared_semantic_context_v1',
                                 'complete_shared_semantic_place_v1', 'end_shared_semantic_work_v1') LOOP
    IF has_function_privilege('authenticated', p.sig, 'EXECUTE') OR has_function_privilege('anon', p.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'SHARED-VIS-01: a client must not execute %', p.sig;
    END IF;
  END LOOP;
  FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_semantic_private'
              AND pr.proname IN ('is_semantic_text_v1', 'is_theme_set_v1', 'guard_semantic_history_v1', 'derive_semantic_identity_v1',
                                 'semantic_work_policy_v1', 'is_current_member_v1', 'visible_places_v1') LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, p.sig, 'EXECUTE') THEN
        RAISE EXCEPTION 'SHARED-VIS-01: % must not execute the internal %', r, p.sig;
      END IF;
    END LOOP;
  END LOOP;

  -- G4. The frozen primitives keep their pre-SHARED-VIS-01 ACL: the 0090 QANDEEL core stays executable by no application
  --     role, and the 0089 resolver by the server channel alone.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r,
         'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])', 'EXECUTE') THEN
      RAISE EXCEPTION 'SHARED-VIS-01: % must not execute the frozen QANDEEL core', r;
    END IF;
  END LOOP;

  -- G5. Only the place relation holds derived text (themes, region, contract names), and nothing here names an account.
  IF EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'shared_semantic_private' AND c.relkind = 'r' AND c.relname <> 'semantic_places'
                AND a.attnum > 0 AND NOT a.attisdropped
                AND a.atttypid IN ('text'::regtype, 'text[]'::regtype, 'varchar'::regtype, 'jsonb'::regtype)) THEN
    RAISE EXCEPTION 'SHARED-VIS-01: only the place relation may hold derived text';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t2 ON t2.oid = c.conrelid JOIN pg_namespace n ON n.oid = t2.relnamespace
              WHERE n.nspname = 'shared_semantic_private' AND c.contype = 'f' AND c.confrelid = 'public.users'::regclass) THEN
    RAISE EXCEPTION 'SHARED-VIS-01: no relation here references an account';
  END IF;

  -- G6. The place's derived text leaves with its meaning body (ON DELETE CASCADE), and both history relations are guarded.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = 'semantic_places_body_fk'
                    AND c.conrelid = 'shared_semantic_private.semantic_places'::regclass
                    AND c.confrelid = 'public.shared_world_text_material_bodies'::regclass AND c.confdeltype = 'c') THEN
    RAISE EXCEPTION 'SHARED-VIS-01: a place must be erased with its meaning body';
  END IF;
  IF (SELECT count(*) FROM pg_trigger tg WHERE NOT tg.tgisinternal
        AND tg.tgfoid = 'shared_semantic_private.guard_semantic_history_v1()'::regprocedure) <> 2 THEN
    RAISE EXCEPTION 'SHARED-VIS-01: both history relations must be guarded';
  END IF;
END$$;

COMMIT;
