-- ---------------------------------------------------------------------------
-- QANDEEL Connected Worlds v2
-- I-06D - Post-finalization source availability and current complete-Replay
--         usability (migration 0106 of 0106 / 0107).
--
-- Architecture authority: CW2-05 - Replay Runtime Architecture v1.0, sections 31
-- (source unavailable after finalization) and 32 (source-content vs analysis
-- layers), with binding CW2-01, CW2-02, CW2-04 and CW2-08.
--
-- ## The one distinction this migration exists to make
--
--   a HISTORICAL FACT          this exact Replay Version was finalized, and that
--                              is append-only evidence forever;
--
--   a CURRENT ANSWER           whether the source it represents is still legit-
--                              imately dereferenceable RIGHT NOW.
--
-- The second may change. The first never does. Nothing here rewrites, trims,
-- repairs or re-composes an immutable Replay Version to make the current answer
-- easier to model, and nothing here reconstructs a source that is gone.
--
-- ## What it does NOT do
--
-- It writes no second source-currency evaluator. `derive_replay_source_manifest_currency_v1`
-- is the ONE canonical source truth and this migration delegates to it whole: it
-- recomputes no digest, reads no source row of its own, and never treats a
-- captured digest as evidence that the source still exists. A digest proves what
-- the source WAS, never that it still IS.
--
-- It also invents no media, storage, transport, delivery, external recall or
-- Public lifecycle transition. Migration 0107 owns current distribution
-- eligibility; this one owns the source and layer truth it consumes.
--
-- ## Source-content-bearing layer vs analytical visual layer
--
-- CW2-05 section 32 classifies Replay elements between two layers, and the
-- consequence of a source becoming unavailable is DIFFERENT for each:
--
--   SOURCE_CONTENT_BEARING_LAYER   cannot be dereferenced, regenerated or newly
--                                  rendered from hidden or deleted source;
--
--   ANALYTICAL_VISUAL_LAYER        remains exactly what it was - immutable,
--                                  sealed historical analytical evidence - and
--                                  is never erased merely because the source
--                                  moved.
--
-- Both facts are answered by the creator boundary below, and neither is ever
-- allowed to stand in for the other: a Replay whose source layer is not
-- dereferenceable is NOT a complete Replay, however intact its analytical
-- evidence is. That is what stops an analytical-only fallback from being served
-- under the original Replay's name.
-- ---------------------------------------------------------------------------
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE APPEND-ONLY GUARD FOR EVERY I-06D RELATION.
--
--    Reconciliation records what QANDEEL OBSERVED. An observation that can be
--    edited afterwards is not evidence, so every relation this slice owns - in
--    0106 and in 0107 - is append-only for every role including the table owner.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_replay_post_finalization_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_IS_IMMUTABLE' USING ERRCODE='55000',
    DETAIL='A post-finalization reconciliation record is append-only evidence of what was observed at one instant; it is never updated or deleted.';
END$$;

ALTER FUNCTION public.reject_replay_post_finalization_mutation_v1() OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 2. APPEND-ONLY SOURCE-AVAILABILITY RECONCILIATION EVIDENCE.
--
--    NOT a current-state cache, and structurally incapable of becoming one.
--    Canonical current truth is the live derivation in section 3; this relation
--    records that QANDEEL looked, when it looked, and what the bounded answer
--    was. Nothing in 0106 or 0107 reads a row of it to decide anything.
--
--    It carries the BOUNDED three-state answer and NOT the private staleness
--    class. The internal class distinguishes "deleted" from "no longer visible
--    to you" from "changed", which is exactly the private cause every anti-
--    oracle rule in this runtime keeps out of durable, transferable records. The
--    convergence value of the evidence does not need it.
--
--    No source text, no body, no path, no URL, no storage handle, no provenance,
--    no free-form explanation. The deploy-time self-assertions below refuse the
--    migration outright if a column of any of those shapes ever appears.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_source_availability_reconciliation_events (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    replay_version_id uuid NOT NULL,
    source_manifest_version_id uuid NOT NULL,
    observed_availability_state text NOT NULL,
    observed_at timestamptz NOT NULL,
    CONSTRAINT replay_source_availability_reconciliation_events_pk PRIMARY KEY (id),
    -- The exact bounded vocabulary of the ONE derivation in section 3, and
    -- nothing else. A state this relation cannot spell is a state the evidence
    -- can never claim was observed.
    CONSTRAINT replay_source_availability_reconciliation_events_state_check
        CHECK (observed_availability_state IN ('CURRENT', 'NOT_CURRENT', 'CONTRADICTORY')),
    -- THE EXACT REPLAY VERSION, ITS REPLAY AND THAT VERSION'S OWN MANIFEST AS
    -- ONE ROW, through the 0104 composition key: an observation can never pair
    -- one Replay's version with another Replay, and never name a manifest that
    -- version does not bind.
    CONSTRAINT replay_source_availability_reconciliation_events_target_fk
        FOREIGN KEY (replay_version_id, replay_id, source_manifest_version_id)
        REFERENCES public.replay_versions (id, replay_id, source_manifest_version_id) ON DELETE RESTRICT,
    -- And the version observed is one that was HISTORICALLY FINALIZED, through
    -- the append-only evidence rather than through `replays.current_lifecycle`,
    -- which I-06B legitimately moves back to DRAFT without erasing it.
    CONSTRAINT replay_source_availability_reconciliation_events_final_fk
        FOREIGN KEY (replay_version_id, replay_id)
        REFERENCES public.replay_version_finalizations (replay_version_id, replay_id) ON DELETE RESTRICT
);

ALTER TABLE public.replay_source_availability_reconciliation_events OWNER TO postgres;
ALTER TABLE public.replay_source_availability_reconciliation_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER replay_source_availability_reconciliation_events_immutable
  BEFORE UPDATE OR DELETE ON public.replay_source_availability_reconciliation_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_replay_post_finalization_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE ONE CURRENT SOURCE-AVAILABILITY DERIVATION FOR AN EXACT REPLAY VERSION.
--
--    Read-only, STABLE, takes no lock: a caller that needs a STABLE answer holds
--    the Replay and the source first, exactly as the frozen I-06A currency
--    derivation and the frozen Public derivations document. Migration 0107's
--    reconciliation primitive does precisely that.
--
--    It binds ONE exact replay_id + replay_version_id as one row, reads that
--    version's own captured source manifest from the immutable composition, and
--    then DELEGATES THE WHOLE SOURCE QUESTION to the canonical I-06A derivation.
--    It never reinterprets source truth, never reads a source row itself, never
--    recomputes a digest and never uses historical finalization as evidence that
--    the source is still current.
--
--    Three bounded answers, with the private cause carried separately:
--
--      CURRENT         every bound source is still exactly what the manifest
--                      captured and still legitimately available to the creator
--      NOT_CURRENT     it is not, for one of the canonical I-06A reasons
--      CONTRADICTORY   the bound source describes something that never happened,
--                      which is a different fact from "no longer current" and
--                      fails closed harder
--
--    `source_staleness_class` is the INTERNAL I-06A class, passed straight
--    through and never re-spelled. The creator boundary in section 4 does not
--    return it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_version_current_availability_v1(
  p_replay_id uuid, p_replay_version_id uuid
) RETURNS TABLE(availability_state text, source_staleness_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  version public.replay_versions;
  currency record;
BEGIN
  IF p_replay_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- THE EXACT VERSION OF THE EXACT REPLAY. A version that belongs to another
  -- Replay is not this Replay's version, and reaches the same bounded class as
  -- one that does not exist at all.
  SELECT v.* INTO version FROM public.replay_versions v
   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE ONE CANONICAL SOURCE TRUTH. A raise from the canonical derivation is a
  -- contradiction rather than an error a caller can read, so this derivation
  -- stays total: everything it cannot establish is answered closed.
  BEGIN
    SELECT c.currency_state, c.staleness_class INTO currency
      FROM public.derive_replay_source_manifest_currency_v1(version.source_manifest_version_id) c;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'CONTRADICTORY'::text, 'SOURCE_CONTRADICTORY'::text;
    RETURN;
  END;
  IF currency.currency_state IS NULL THEN
    RETURN QUERY SELECT 'CONTRADICTORY'::text, 'SOURCE_CONTRADICTORY'::text;
    RETURN;
  END IF;
  IF currency.currency_state = 'CURRENT' THEN
    RETURN QUERY SELECT 'CURRENT'::text, NULL::text;
    RETURN;
  END IF;
  IF currency.staleness_class = 'SOURCE_CONTRADICTORY' THEN
    RETURN QUERY SELECT 'CONTRADICTORY'::text, currency.staleness_class;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'NOT_CURRENT'::text, currency.staleness_class;
END$$;

ALTER FUNCTION public.derive_replay_version_current_availability_v1(uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 4. THE CREATOR-EXACT CURRENT COMPLETE-REPLAY USABILITY BOUNDARY.
--
--    ## What it answers
--
--    Whether ONE historically finalized Replay Version is, RIGHT NOW, usable as
--    a COMPLETE Replay - the source-content-bearing layer and the analytical
--    visual layer together, as the frozen render contract binds them.
--
--    ## Who may ask
--
--    The exact creator, and nobody else. Anyone else receives ZERO ROWS, which
--    is the same answer a nonexistent Replay, a nonexistent version and another
--    human's version all produce: the boundary is not an existence oracle, and a
--    stranger learns nothing about whether source existed, which World held it,
--    whether it was deleted, who withdrew what, or which component went stale.
--
--    ## What the creator learns
--
--    The MINIMUM ACTIONABLE current state. Four bounded classes, none of which
--    is the private I-06A staleness class:
--
--      REPLAY_VERSION_NOT_FINALIZED     this version was never finalized, so the
--                                       complete-Replay question does not apply
--      SOURCE_NOT_CURRENTLY_AVAILABLE   the source layer cannot be dereferenced
--      SOURCE_STATE_CONTRADICTORY       the bound source is incoherent
--      ANALYTICAL_EVIDENCE_INCOMPLETE   the sealed analytical evidence of this
--                                       exact version is no longer complete
--
--    ## The two layers, always reported
--
--    Both layer columns are answered on EVERY row, including the refusals, which
--    is what makes CW2-05 section 32 operational rather than decorative:
--
--      source loss     -> source_content_bearing_layer = NOT_DEREFERENCEABLE
--                         analytical_visual_layer      = SEALED_HISTORICAL_EVIDENCE
--                         usability_state              = NOT currently usable
--
--    Read together, those three columns say exactly what the architecture says:
--    the analytical history was not erased, AND it does not make a complete
--    Replay by itself. There is deliberately no layer state meaning "the
--    analytical layer stands in for the missing source", because no such state
--    is true.
--
--    ## Why the analytical axis is an EVIDENCE fact rather than a re-derivation
--
--    I-06B owns the canonical question "does this version's immutable
--    composition still re-derive" - `derive_replay_version_truth_currency_v1` -
--    and this boundary deliberately does NOT compose it. That derivation reaches
--    the canonical historical projection, `get_session_historical_projection_v1`,
--    which is scoped to `auth.uid()` and raises FORBIDDEN for anyone but the
--    Session owner. This boundary names its human as a PARAMETER instead, which
--    is the frozen narrow-resolver precedent every Replay read boundary follows
--    and the shape the service tier calls it in. Composing the two would make the
--    answer depend on WHICH SESSION ASKED rather than on which human was named -
--    a gate that is arbitrary rather than fail-closed, and one that would report
--    a healthy Replay as diverged for every caller but one.
--
--    What this boundary CAN establish for the human it was given is that the
--    sealed analytical evidence of this exact version is still there and still
--    complete: the projection version it binds, every one of the points that
--    version declares, and the render contract. That is the fact CW2-05 section
--    32 asks it to report, and it is the fact a source loss must not change.
--    Whether that sealed evidence still re-derives from current canonical state
--    remains I-06B's question, asked by I-06B's own owner-scoped path.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_version_current_usability_v1(
  p_replay_id uuid, p_replay_version_id uuid, p_user_id uuid
) RETURNS TABLE(replay_id uuid, replay_version_id uuid, usability_state text,
                source_content_bearing_layer text, analytical_visual_layer text,
                unavailable_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  version public.replay_versions;
  current_availability text;
  declared_points integer;
  sealed_points integer;
  source_layer text;
  analytical_layer text;
BEGIN
  IF p_replay_id IS NULL OR p_replay_version_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- THE EXACT CREATOR'S OWN EXACT VERSION. Everything else returns nothing.
  SELECT v.* INTO version FROM public.replay_versions v
    JOIN public.replays r ON r.id = v.replay_id
   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id
     AND r.created_by_user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- The bounded three-state answer, and DELIBERATELY NOT the private staleness
  -- class beside it: this boundary never holds the internal cause in the first
  -- place, so it cannot leak one by a later edit.
  SELECT a.availability_state INTO current_availability
    FROM public.derive_replay_version_current_availability_v1(p_replay_id, p_replay_version_id) a;
  source_layer := CASE WHEN current_availability = 'CURRENT'
                       THEN 'DEREFERENCEABLE' ELSE 'NOT_DEREFERENCEABLE' END;

  -- THE SEALED ANALYTICAL EVIDENCE IS STILL THERE WHATEVER HAPPENED TO THE
  -- SOURCE: the projection version this version binds, every point that
  -- projection declares, and the render contract. Read from the version's own
  -- immutable composition, so the answer is about THIS version and not about
  -- whoever happens to be asking.
  SELECT pv.point_count INTO declared_points
    FROM public.replay_analytical_projection_versions pv
   WHERE pv.id = version.analytical_projection_version_id;
  SELECT count(*)::integer INTO sealed_points
    FROM public.replay_analytical_projection_points pt
   WHERE pt.projection_version_id = version.analytical_projection_version_id;
  analytical_layer := CASE
    WHEN declared_points IS NOT NULL AND sealed_points = declared_points
         AND EXISTS (SELECT 1 FROM public.replay_render_contract_versions rc
                      WHERE rc.id = version.render_contract_version_id)
    THEN 'SEALED_HISTORICAL_EVIDENCE'
    ELSE 'SEALED_EVIDENCE_INCOMPLETE' END;

  -- FAIL CLOSED, IN ORDER. Historical finalization first, because a version that
  -- was never finalized is not a complete Replay whatever its source says.
  IF NOT EXISTS (SELECT 1 FROM public.replay_version_finalizations f
                  WHERE f.replay_version_id = p_replay_version_id AND f.replay_id = p_replay_id) THEN
    RETURN QUERY SELECT p_replay_id, p_replay_version_id, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE'::text,
                        source_layer, analytical_layer, 'REPLAY_VERSION_NOT_FINALIZED'::text;
    RETURN;
  END IF;
  IF current_availability = 'CONTRADICTORY' THEN
    RETURN QUERY SELECT p_replay_id, p_replay_version_id, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE'::text,
                        source_layer, analytical_layer, 'SOURCE_STATE_CONTRADICTORY'::text;
    RETURN;
  END IF;
  IF current_availability IS DISTINCT FROM 'CURRENT' THEN
    RETURN QUERY SELECT p_replay_id, p_replay_version_id, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE'::text,
                        source_layer, analytical_layer, 'SOURCE_NOT_CURRENTLY_AVAILABLE'::text;
    RETURN;
  END IF;
  IF analytical_layer <> 'SEALED_HISTORICAL_EVIDENCE' THEN
    RETURN QUERY SELECT p_replay_id, p_replay_version_id, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE'::text,
                        source_layer, analytical_layer, 'ANALYTICAL_EVIDENCE_INCOMPLETE'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT p_replay_id, p_replay_version_id, 'COMPLETE_REPLAY_CURRENTLY_USABLE'::text,
                      source_layer, analytical_layer, NULL::text;
END$$;

ALTER FUNCTION public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 5. ACL AND RLS POSTURE.
--
--    The relation is sealed from every application role, exactly as every
--    Replay relation before it. The internal derivation is executable by NO
--    role, because it carries the private staleness class. The creator boundary
--    is service_role-only, exactly as the two I-06C read boundaries are: the
--    authenticated tier reaches it through the service tier or not at all.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.replay_source_availability_reconciliation_events
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replay_source_availability_reconciliation_events FROM service_role';
END IF;END$$;

REVOKE ALL ON FUNCTION public.reject_replay_post_finalization_mutation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.derive_replay_version_current_availability_v1(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid) FROM PUBLIC;
DO $$
DECLARE
  sealed text[] := ARRAY['public.reject_replay_post_finalization_mutation_v1()',
                         'public.derive_replay_version_current_availability_v1(uuid, uuid)'];
  boundary text := 'public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid)';
  fn text;
BEGIN
  FOREACH fn IN ARRAY sealed LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', boundary);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 6. SELF-ASSERTIONS.
--
--    What must already be true of THIS migration for it to be allowed to deploy.
--    Every one is a fact about the objects 0106 owns or the frozen truths it
--    binds - never a census of the database, and never a ceiling on 0107 or on
--    any later reviewed work. Nothing here forbids a future media encoder,
--    object store, transport provider, delivery receipt, Safety runtime or
--    Shared / Public analytical capability from existing anywhere in this
--    repository. What is forbidden is forbidden ON THE RELATIONS AND FUNCTIONS
--    THIS MIGRATION OWNS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['replay_source_availability_reconciliation_events'];
  t text;
  needed text;
  body text;
  n integer;
BEGIN
  FOREACH t IN ARRAY own_tables LOOP
    -- A REPLAY IS NOT A WORLD, and observing one changes no ontology.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(world_type|phase|birth_basis|member|episode|governance|proposal|coordinate|embedding|vitality|ranking|lifecycle)'
    ) THEN
      RAISE EXCEPTION 'I-06D: a Replay is a source-bound artifact, never a World: relation % may carry no World membership governance or lifecycle column', t;
    END IF;
    -- NO SOURCE CONTENT SURVIVES A SOURCE LOSS BY BEING COPIED HERE.
    --
    -- The content sense of each word is named exactly rather than banned as a
    -- bare substring, because this relation legitimately carries an OBSERVED
    -- state and an observation instant: a ban on `state` or on `observed` would
    -- refuse the migration's own truth, which is a defect in the ban and not a
    -- finding about the schema.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(^body|_body$|body_text|_text$|^text|transcript|audio|content|payload|blob|document|excerpt|snippet|statement|committed_text|source_text|url|uri|href|path|filename|object_key|bucket|storage|credential|secret|token|note|explanation|message|description)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % may carry no source content no private path no storage handle and no free-form explanation: source loss never authorizes a copy', t;
    END IF;
    -- NO MEDIA CRAFT, ENCODER, STORE OR TRANSPORT IS INVENTED HERE.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(codec|container|bitrate|video_resolution|frame_rate|framerate|cdn|watermark|drm|encoder|mime|pixel|recipient|delivered|recalled|remote_|external_copy|endpoint|address|email|phone)'
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % may define no media storage transport delivery or external-recall column: CW2-05 defers all of it and guarantees no recall', t;
    END IF;
    -- NO PRIVATE SOURCE IDENTITY AND NO PRIVATE CAUSE IS MADE DURABLE.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(session|turn|conversation_unit|world_id|shared_|material|history_item|owner_user|approver|participant|captured_|provenance|staleness|digest|fingerprint)'
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % may carry no private source identity and no private staleness cause', t;
    END IF;
    -- NO BODY RELATION, RAW TURN OR COMMITTED SOURCE UNIT IS EVER A PARENT.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid IN ('public.shared_world_text_material_bodies'::regclass,
                             'public.shared_world_voice_note_material_bodies'::regclass,
                             'public.public_experience_text_derivative_bodies'::regclass,
                             'public.conversation_turns'::regclass,
                             'public.conversation_units'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % must bind no body relation, no raw turn and no committed source unit', t;
    END IF;
    -- Every foreign key this migration installs is restrictive: an observation
    -- can never cascade an immutable Replay truth away.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f' AND c.confdeltype <> 'r'
    ) THEN
      RAISE EXCEPTION 'I-06D: every I-06D foreign key is restrictive: relation % must never cascade truth away', t;
    END IF;
    -- Every identifier fits the 63-byte limit, so nothing is silently truncated.
    IF length(t) > 63 OR EXISTS (SELECT 1 FROM pg_constraint c
                                  WHERE c.conrelid = ('public.' || t)::regclass AND length(c.conname) > 63)
       OR EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                   WHERE ix.indrelid = ('public.' || t)::regclass AND length(idx.relname) > 63)
       OR EXISTS (SELECT 1 FROM pg_trigger tg
                   WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
                     AND length(tg.tgname) > 63) THEN
      RAISE EXCEPTION 'I-06D: an identifier on % exceeds the PostgreSQL 63-byte limit', t;
    END IF;
    -- Append-only for every role, deny by default, sealed, and 0106 writes no row.
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_replay_post_finalization_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % must be append-only for every role including its owner', t;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06D: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06D: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-06D: relation % must be postgres-owned', t;
    END IF;
    FOREACH needed IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN needed <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = needed);
      IF has_table_privilege(needed, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06D: relation % must hold no privilege for %', t, needed;
      END IF;
    END LOOP;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'I-06D: 0106 installs persistence and a derivation and writes no row: % holds %', t, n;
    END IF;
  END LOOP;

  -- AN OBSERVATION BINDS THE EXACT HISTORICALLY FINALIZED VERSION OF ITS EXACT
  -- REPLAY, AND THAT VERSION'S OWN MANIFEST, as one row each.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_source_availability_reconciliation_events'::regclass
       AND c.conname = 'replay_source_availability_reconciliation_events_target_fk'
       AND c.confrelid = 'public.replay_versions'::regclass AND cardinality(c.confkey) = 3
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_source_availability_reconciliation_events'::regclass
       AND c.conname = 'replay_source_availability_reconciliation_events_final_fk'
       AND c.confrelid = 'public.replay_version_finalizations'::regclass AND cardinality(c.confkey) = 2
  ) THEN
    RAISE EXCEPTION 'I-06D: source-availability evidence must bind the exact finalized Replay Version, its Replay and that version own manifest';
  END IF;

  -- THE EVIDENCE CAN ONLY SPELL THE BOUNDED ANSWER.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_source_availability_reconciliation_events'::regclass
       AND c.conname = 'replay_source_availability_reconciliation_events_state_check'
       AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ~ 'CONTRADICTORY'
       AND pg_get_constraintdef(c.oid) ~ 'NOT_CURRENT'
  ) THEN
    RAISE EXCEPTION 'I-06D: observed availability must be one of the three bounded states the canonical derivation answers';
  END IF;

  -- THE CURRENT ANSWER IS DERIVED FROM THE ONE CANONICAL SOURCE TRUTH.
  --
  -- Read from the installed body rather than assumed: a derivation that stopped
  -- consulting `derive_replay_source_manifest_currency_v1` would be exactly the
  -- second source-currency evaluator this slice is forbidden to write, and it
  -- would look identical from outside.
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.derive_replay_version_current_availability_v1(uuid, uuid)'::regprocedure;
  IF body IS NULL OR body !~ 'derive_replay_source_manifest_currency_v1' THEN
    RAISE EXCEPTION 'I-06D: current source availability must consume the ONE canonical I-06A source-currency derivation and never re-derive source truth';
  END IF;
  IF body ~ 'conversation_units|shared_world_materials|shared_world_history_items|publication_package_manifest_items|encode\(sha256' THEN
    RAISE EXCEPTION 'I-06D: current source availability must read no source row and recompute no digest of its own';
  END IF;
  IF body ~ 'replay_version_finalizations' THEN
    RAISE EXCEPTION 'I-06D: historical finalization is never evidence that source is still current';
  END IF;

  -- THE CREATOR BOUNDARY COMPOSES THE CANONICAL ANSWERS AND LEAKS NO PRIVATE CAUSE.
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid)'::regprocedure;
  IF body IS NULL
     OR body !~ 'derive_replay_version_current_availability_v1'
     OR body !~ 'replay_analytical_projection_points'
     OR body !~ 'created_by_user_id = p_user_id' THEN
    RAISE EXCEPTION 'I-06D: the usability boundary must be creator-exact, must consume the ONE source availability derivation and must establish the sealed analytical evidence of its own exact version';
  END IF;
  -- IT DOES NOT COMPOSE THE OWNER-SCOPED I-06B TRUTH CURRENCY.
  --
  -- That derivation reaches `get_session_historical_projection_v1`, which is
  -- scoped to auth.uid() and raises FORBIDDEN for anyone but the Session owner.
  -- This boundary names its human as a PARAMETER, so composing the two would
  -- make the answer depend on which session asked rather than on which human was
  -- named - arbitrary rather than fail-closed.
  IF body ~ 'derive_replay_version_truth_currency_v1|get_session_historical_projection_v1' THEN
    RAISE EXCEPTION 'I-06D: a boundary whose human is a parameter may not compose an auth.uid()-scoped derivation: the answer would depend on which session asked';
  END IF;
  IF body ~ 'SOURCE_UNAVAILABLE|SOURCE_ACCESS_LOST|SOURCE_VERSION_NOT_CURRENT|PROJECTION_MOVED|CUT_UNSAFE|RENDER_CONTRACT_MOVED' THEN
    RAISE EXCEPTION 'I-06D: the creator boundary returns a bounded actionable class and never the private internal cause';
  END IF;
  -- And there is NO state in which the analytical layer stands in for a missing
  -- source layer: an analytical-only fallback is never a complete Replay.
  IF body ~ 'ANALYTICAL_ONLY|ANALYTICAL_FALLBACK|ANALYTICAL_SUBSTITUTE|PARTIAL_REPLAY|DEGRADED_REPLAY' THEN
    RAISE EXCEPTION 'I-06D: an analytical-only rendering may never be represented as the complete Replay it is not';
  END IF;
  IF body !~ 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE' THEN
    RAISE EXCEPTION 'I-06D: the usability boundary must be able to answer that a complete Replay is not currently usable';
  END IF;

  -- NEITHER FUNCTION RECONSTRUCTS, SYNTHESIZES OR REPAIRS ANYTHING, AND NEITHER
  -- MUTATES THE IMMUTABLE TRUTH IT READS.
  FOREACH needed IN ARRAY ARRAY['public.derive_replay_version_current_availability_v1(uuid, uuid)',
                                'public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid)'] LOOP
    SELECT pr.prosrc INTO body FROM pg_proc pr WHERE pr.oid = needed::regprocedure;
    IF body ~ 'INSERT INTO|UPDATE public\.|DELETE FROM|ALTER TABLE|TRUNCATE' THEN
      RAISE EXCEPTION 'I-06D: % answers a question and writes nothing: source loss never repairs an immutable Replay Version', needed;
    END IF;
    IF body ~ 'pg_advisory|LOCK TABLE|FOR UPDATE|FOR SHARE' THEN
      RAISE EXCEPTION 'I-06D: % is a STABLE derivation and takes no lock; its caller stabilizes the source through the canonical Replay lock path', needed;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc pr
       WHERE pr.oid = needed::regprocedure AND pr.prosecdef AND pr.provolatile = 's'
         AND pr.proowner = (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres')
         AND pr.proconfig IS NOT NULL
         AND ('search_path=' = ANY(pr.proconfig) OR 'search_path=""' = ANY(pr.proconfig))
    ) THEN
      RAISE EXCEPTION 'I-06D: % must be a postgres-owned SECURITY DEFINER STABLE function with an empty search_path', needed;
    END IF;
    -- No human principal is ever a trusted parameter, and no caller may author
    -- an availability, currency or authority answer.
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = needed::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(actor|creator_user|owner_user|approver|currency|staleness|availability_state|usability|authority|safety|entitlement|launch|clearance)'
    ) THEN
      RAISE EXCEPTION 'I-06D: % accepts no caller-authored principal state or verdict', needed;
    END IF;
  END LOOP;

  -- THE INTERNAL DERIVATION IS REACHABLE BY NO APPLICATION ROLE, and the creator
  -- boundary is reachable by the service tier only.
  FOREACH needed IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
    CONTINUE WHEN needed <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = needed);
    IF has_function_privilege(needed, 'public.derive_replay_version_current_availability_v1(uuid, uuid)', 'EXECUTE')
       OR has_function_privilege(needed, 'public.reject_replay_post_finalization_mutation_v1()', 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06D: the internal availability derivation and the append-only guard are executable by no application role: % holds EXECUTE', needed;
    END IF;
    IF needed <> 'service_role'
       AND has_function_privilege(needed, 'public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06D: the creator usability boundary is service_role-only: % holds EXECUTE', needed;
    END IF;
  END LOOP;

  -- THE FROZEN TRUTHS THIS SLICE CONSUMES ARE STILL INTACT, and 0106 replaced
  -- none of them: the canonical source currency, the canonical version truth
  -- currency, the canonical Public visibility resolver and the two fail-closed
  -- CW2-08 seams are exactly as their own migrations left them.
  FOREACH needed IN ARRAY ARRAY['public.derive_replay_source_manifest_currency_v1(uuid)',
                                'public.derive_replay_version_truth_currency_v1(uuid)',
                                'public.replay_lock_source_manifest_v1(uuid)',
                                'public.resolve_public_visibility_state_v1(uuid)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc pr WHERE pr.oid = needed::regprocedure) THEN
      RAISE EXCEPTION 'I-06D: the frozen predecessor % must still exist', needed;
    END IF;
  END LOOP;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_visibility_state_v1(uuid)'::regprocedure)
     !~ 'derive_public_continuing_eligibility_v1' THEN
    RAISE EXCEPTION 'I-06D: the canonical Public visibility resolver must still rest on the frozen I-05C continuing-eligibility truth; I-06D writes no second Public visibility authority';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_replay_analytical_distribution_authority_v1(uuid)'::regprocedure)
     !~ 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' THEN
    RAISE EXCEPTION 'I-06D: the frozen analytical subject-authority seam must still answer UNRESOLVED; I-06D resolves no protected-human authority';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_replay_distribution_prerequisites_v1(uuid, text)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-06D: the frozen CW2-08 prerequisite seam must still answer NOT_EVALUATED; I-06D manufactures no launch readiness';
  END IF;
END$$;

COMMIT;
