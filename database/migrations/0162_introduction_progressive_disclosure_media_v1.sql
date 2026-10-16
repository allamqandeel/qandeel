-- S6-06 - Introduction progressive disclosure, photos and the full-name display consent v1 (CP1: Secure Backend & Media).
--
-- Product authority: the Product Owner's S6-06 Task Contract v1.0, WP0 v1.1 and its five-point correction, approved on
-- 2026-10-16 («S6-06 — اعتماد WP0 وبدء CP1»), decisions D-01 ... D-12 within the agreed limits. The execution record is
-- docs/e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md. This migration is that task's CP1 database part for disclosure,
-- photos and the display consent; 0163 is its SUCCESS and reactivation part.
--
-- The frozen I-07D disclosure core (0115, forward-replaced by 0122) is fully implemented and executable by no
-- application role; its own CW2-08 seam answers NOT_EVALUATED and is its LAST gate. This migration adds the reviewed
-- authenticated boundary around it, and nothing that could open it: every function here that could deliver anything
-- calls the frozen core, which still checks the seam last, so production delivery fails closed exactly as before. No
-- existing function, table, seam, policy or privilege is changed (0001-0161 are byte-unchanged).
--
-- ## The vocabulary (D-10, D-11)
--
--   FULL_NAME / CONTACT_METHOD    free text, single line, at most 512 characters, typed by the owner (never read from
--                                 the account: no public.users read anywhere here)
--   DEEPER_PERSONAL_FIELD         exactly four keys and no others: work_field, education, hometown_city (at most 64
--                                 characters, "city only"), about_me. Each passes the frozen 0115 key shape and key ban.
--   The contact floor             FULL_NAME and every DEEPER_PERSONAL_FIELD value carrying a contact route is refused
--                                 (CONTACT_REFUSED): CONTACT_METHOD stays the ONE reviewed way to share one.
--   PARTIAL_IMAGE / FULL_IMAGE    the three photo stages: 1 strong blur and 2 medium blur are PARTIAL_IMAGE, 3 clear is
--                                 FULL_IMAGE (P1 §14.5). Each stage is its own resource version, command and grant.
--
-- ## Photos (D-01, D-02, D-04, D-05, D-06)
--
-- Image bytes never live in PostgreSQL. A photo is a SERIES of three server-derived renditions in the private object
-- store; the database holds, per rendition, an opaque random HANDLE and a separate opaque random STORAGE KEY, and nothing
-- derived from the content: no hash, no size, no dimensions, no ETag (0122). The handle is what the frozen core receives
-- as its media reference (`qmedia:<handle>`); the storage key is known only to service_role and the API.
--
--   begin (gated)   PENDING series + three rendition rows written BEFORE any byte is stored (write-ahead intent), with
--                   an upload deadline. In production the gate answers NOT_AVAILABLE_NOW and nothing is written.
--   complete        service_role, by the API after it stored the three objects: PENDING -> READY, before the deadline
--   stage n         owner-only, strictly in order (n = disclosed + 1), one frozen-core delivery per stage
--   remove          owner-only, ungated, any state: every still-visible stage is deleted through the frozen owner
--                   deletion, the series is RETIRED (a stage was shared) or DISCARDED, every rendition row goes and its
--                   storage key alone moves to the erasure queue, in the same transaction
--
-- One active photo per owner per Introduction (D-05): a new series is refused while one is PENDING / READY / DISCLOSING,
-- or while a RETIRED one still has a visible stage. A new photo is a new series, with new identities and new approvals.
--
-- ## Erasure (correction 2)
--
-- The queue row carries one storage key and its retry state, and nothing else: no World, owner, series, handle or stage.
-- Access is refused the moment the deletion commits, because every byte request re-authorizes from these relations and
-- the rendition row is gone. The worker deletes the object, proves it gone (HEAD 404) and only then deletes the queue
-- row; a failure keeps the row with a back-off and is never dropped. A key from a series that was still uploading is
-- not erased before its upload deadline plus a grace period, so a late upload cannot outlive the erasure (condition 1).
-- A sweep reconciles: expired uploads, a World that left ACTIVE / INTRODUCTION, and a stage deleted through the generic
-- owner deletion all retire their series the same way; a storage listing reconciliation enqueues any stored key the
-- database no longer knows.
--
-- ## The display consent (D-09)
--
-- A FULL_NAME disclosure is not a display consent (S6-02 A/A1). The owner may separately GRANT that the exact disclosed
-- FULL_NAME text of one version be shown instead of the first name in THIS World, and REVOKE it at any time, in any
-- state, ungated. The read returns that text only while the grant is current AND the bound disclosure is still visible
-- to the reader through the frozen resolver - so deleting the disclosure makes the consent inert with no trigger, and a
-- new FULL_NAME version needs a new grant. It never reads public.users and changes no frozen projection: Activity,
-- notifications, Public sources and model input keep the first name.
--
-- ## What is deliberately NOT here
--
-- No change to any frozen function, core, seam or policy; no CW2-08 evaluation; no SUCCESS or reactivation (0163); no
-- Activity, Push, moderation or AI; no route or mobile surface (the API and CP2 own those). Forward-only.
BEGIN;

CREATE SCHEMA introduction_sharing_private;
REVOKE ALL ON SCHEMA introduction_sharing_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. RELATIONS. Private schema, RLS on, no policy, no privilege for any application role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE introduction_sharing_private.image_series (
    id uuid NOT NULL,
    begin_command_id uuid NOT NULL,
    world_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    series_state text NOT NULL,
    upload_deadline timestamptz NOT NULL,
    CONSTRAINT image_series_pk PRIMARY KEY (id),
    CONSTRAINT image_series_command_key UNIQUE (begin_command_id),
    CONSTRAINT image_series_state_check
        CHECK (series_state IN ('PENDING', 'READY', 'DISCLOSING', 'RETIRED', 'DISCARDED')),
    CONSTRAINT image_series_record_fk
        FOREIGN KEY (introduction_record_id, world_id)
        REFERENCES public.introduction_records (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT image_series_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);
-- D-05, structurally: at most one live series per owner per World.
CREATE UNIQUE INDEX image_series_one_live_idx
    ON introduction_sharing_private.image_series (world_id, owner_user_id)
    WHERE series_state IN ('PENDING', 'READY', 'DISCLOSING');

CREATE TABLE introduction_sharing_private.image_renditions (
    handle uuid NOT NULL,
    series_id uuid NOT NULL,
    stage smallint NOT NULL,
    storage_key text NOT NULL,
    CONSTRAINT image_renditions_pk PRIMARY KEY (handle),
    CONSTRAINT image_renditions_stage_key UNIQUE (series_id, stage),
    CONSTRAINT image_renditions_storage_key UNIQUE (storage_key),
    CONSTRAINT image_renditions_stage_check CHECK (stage BETWEEN 1 AND 3),
    CONSTRAINT image_renditions_storage_key_check CHECK (storage_key ~ '^intro-media/[0-9a-f-]{36}$'),
    CONSTRAINT image_renditions_series_fk
        FOREIGN KEY (series_id) REFERENCES introduction_sharing_private.image_series (id) ON DELETE RESTRICT
);

CREATE TABLE introduction_sharing_private.image_stage_disclosures (
    series_id uuid NOT NULL,
    stage smallint NOT NULL,
    resource_version_id uuid NOT NULL,
    disclosure_command_id uuid NOT NULL,
    CONSTRAINT image_stage_disclosures_pk PRIMARY KEY (series_id, stage),
    CONSTRAINT image_stage_disclosures_version_key UNIQUE (resource_version_id),
    CONSTRAINT image_stage_disclosures_command_key UNIQUE (disclosure_command_id),
    CONSTRAINT image_stage_disclosures_stage_check CHECK (stage BETWEEN 1 AND 3),
    CONSTRAINT image_stage_disclosures_series_fk
        FOREIGN KEY (series_id) REFERENCES introduction_sharing_private.image_series (id) ON DELETE RESTRICT,
    CONSTRAINT image_stage_disclosures_version_fk
        FOREIGN KEY (resource_version_id)
        REFERENCES public.introduction_disclosure_resource_versions (id) ON DELETE RESTRICT
);

-- One storage key and its retry state. Nothing that links it to a World, a human, a series, a handle or a stage.
CREATE TABLE introduction_sharing_private.media_erasure_queue (
    storage_key text NOT NULL,
    not_before timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    lease_id uuid,
    lease_until timestamptz,
    CONSTRAINT media_erasure_queue_pk PRIMARY KEY (storage_key),
    CONSTRAINT media_erasure_queue_key_check CHECK (storage_key ~ '^intro-media/[0-9a-f-]{36}$'),
    CONSTRAINT media_erasure_queue_attempts_check CHECK (attempts >= 0),
    CONSTRAINT media_erasure_queue_lease_check CHECK ((lease_id IS NULL) = (lease_until IS NULL))
);

-- The display consent: an immutable act chain plus one current pointer per (World, owner).
CREATE TABLE introduction_sharing_private.name_display_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    display_act text NOT NULL,
    resource_version_id uuid,
    prior_event_id uuid,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT name_display_events_pk PRIMARY KEY (id),
    CONSTRAINT name_display_events_identity_key UNIQUE (id, world_id, owner_user_id),
    CONSTRAINT name_display_events_act_check CHECK (display_act IN ('GRANT', 'REVOKE')),
    CONSTRAINT name_display_events_version_check
        CHECK ((display_act = 'GRANT') = (resource_version_id IS NOT NULL)),
    -- A grant binds an exact disclosure OF THIS OWNER, structurally.
    CONSTRAINT name_display_events_version_fk
        FOREIGN KEY (resource_version_id, owner_user_id)
        REFERENCES public.introduction_disclosure_resource_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT name_display_events_prior_fk
        FOREIGN KEY (prior_event_id, world_id, owner_user_id)
        REFERENCES introduction_sharing_private.name_display_events (id, world_id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT name_display_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX name_display_events_prior_idx
    ON introduction_sharing_private.name_display_events (prior_event_id) WHERE prior_event_id IS NOT NULL;

CREATE TABLE introduction_sharing_private.name_display_state (
    world_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    current_event_id uuid NOT NULL,
    CONSTRAINT name_display_state_pk PRIMARY KEY (world_id, owner_user_id),
    CONSTRAINT name_display_state_event_key UNIQUE (current_event_id),
    CONSTRAINT name_display_state_event_fk
        FOREIGN KEY (current_event_id, world_id, owner_user_id)
        REFERENCES introduction_sharing_private.name_display_events (id, world_id, owner_user_id) ON DELETE RESTRICT
);

CREATE FUNCTION introduction_sharing_private.refuse_name_display_event_rewrite_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'INTRODUCTION_NAME_DISPLAY_EVENT_IS_IMMUTABLE' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER name_display_events_immutable
    BEFORE UPDATE OR DELETE ON introduction_sharing_private.name_display_events
    FOR EACH ROW EXECUTE FUNCTION introduction_sharing_private.refuse_name_display_event_rewrite_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. PRIVATE HELPERS (executable by no application role).
-- ---------------------------------------------------------------------------------------------------------------------
-- The S6-06 identity derivation: a pure function of the slot, the human, the scope and the caller's command, so an
-- equivalent retry derives the same identities and two humans' commands never collide.
CREATE FUNCTION introduction_sharing_private.derive_identity_v1(p_slot text, p_user uuid, p_scope uuid, p_command_id uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S6_06_INTRODUCTION_DISCLOSURE_IDENTITY_V1' || E'\n' || p_slot || E'\n'
                   || lower(p_user::text) || E'\n' || lower(p_scope::text) || E'\n' || lower(p_command_id::text), 'UTF8')),
                 'hex') AS h) d;
$$;

-- The reader's view of one Introduction World: ACTIVE, ENDED (END), SHARED_WORLD (SUCCESS), or NULL when the reader is
-- not one of its two humans or the World is in none of those shapes.
CREATE FUNCTION introduction_sharing_private.introduction_state_v1(p_world_id uuid, p_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
           WHEN r.introduction_status = 'ACTIVE' AND w.lifecycle = 'ACTIVE' AND w.phase = 'INTRODUCTION' THEN 'ACTIVE'
           WHEN r.introduction_status = 'CLOSED' AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'INTRODUCTION' THEN 'ENDED'
           WHEN r.introduction_status = 'COMPLETED' AND w.phase = 'STANDARD' THEN 'SHARED_WORLD'
         END
    FROM public.introduction_records r JOIN public.shared_worlds w ON w.id = r.world_id
   WHERE r.world_id = p_world_id AND p_user IN (r.lower_user_id, r.higher_user_id);
$$;

-- Retire one series under its World lock (the caller holds it): every rendition that is not a still-visible disclosed
-- stage leaves, and only its storage key moves to the erasure queue. A key that may still be uploading waits for the
-- upload deadline plus a grace period.
CREATE FUNCTION introduction_sharing_private.retire_image_series_v1(p_series_id uuid, p_keep_visible boolean)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_series introduction_sharing_private.image_series;
  v_now timestamptz := clock_timestamp();
  v_released integer := 0;
  v_rendition record;
  v_any_disclosed boolean;
BEGIN
  SELECT * INTO v_series FROM introduction_sharing_private.image_series s WHERE s.id = p_series_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  FOR v_rendition IN
    SELECT r.handle, r.stage, r.storage_key,
           EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d
                     JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = d.resource_version_id
                    WHERE d.series_id = r.series_id AND d.stage = r.stage) AS visible
      FROM introduction_sharing_private.image_renditions r
     WHERE r.series_id = p_series_id
     ORDER BY r.stage
  LOOP
    IF p_keep_visible AND v_rendition.visible THEN CONTINUE; END IF;
    INSERT INTO introduction_sharing_private.media_erasure_queue (storage_key, not_before)
    VALUES (v_rendition.storage_key,
            CASE WHEN v_series.series_state = 'PENDING' THEN greatest(v_now, v_series.upload_deadline + interval '60 seconds')
                 ELSE v_now END)
    ON CONFLICT ON CONSTRAINT media_erasure_queue_pk DO NOTHING;
    DELETE FROM introduction_sharing_private.image_renditions r WHERE r.handle = v_rendition.handle;
    v_released := v_released + 1;
  END LOOP;
  v_any_disclosed := EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d WHERE d.series_id = p_series_id);
  UPDATE introduction_sharing_private.image_series s
     SET series_state = CASE WHEN v_any_disclosed THEN 'RETIRED' ELSE 'DISCARDED' END
   WHERE s.id = p_series_id AND s.series_state NOT IN ('RETIRED', 'DISCARDED');
  -- A series retired earlier keeps its state; one that is DISCARDED never had a stage.
  RETURN v_released;
END$$;

-- Map the frozen disclosure core's bounded refusals onto the S6-06 answer vocabulary.
CREATE FUNCTION introduction_sharing_private.disclosure_refusal_v1(p_state text, p_message text)
RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
           WHEN p_state = '55000' AND p_message = 'INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER' THEN 'DELETED'
           WHEN p_state = '55000' AND p_message = 'INTRODUCTION_DISCLOSURE_PREREQUISITE_UNRESOLVED' THEN 'NOT_AVAILABLE_NOW'
           WHEN p_state = '23505' AND p_message = 'INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT' THEN 'COMMAND_CONFLICT'
           ELSE 'UNAVAILABLE'
         END;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. TEXT DISCLOSURE (FULL_NAME, CONTACT_METHOD, DEEPER_PERSONAL_FIELD).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.disclose_my_introduction_text_v1(
  p_command_id uuid, p_world_id uuid, p_resource_type text, p_field_key text, p_text text
) RETURNS TABLE(outcome text, disclosed_material_id uuid, disclosed_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_text IS NULL OR p_resource_type IS NULL
     OR p_resource_type NOT IN ('FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD')
     OR (p_resource_type = 'DEEPER_PERSONAL_FIELD') <> (p_field_key IS NOT NULL)
     OR (p_field_key IS NOT NULL AND p_field_key NOT IN ('work_field', 'education', 'hometown_city', 'about_me'))
     OR btrim(p_text) = '' OR p_text ~ '[\n\r]'
     OR length(p_text) > 512 OR (p_field_key = 'hometown_city' AND length(p_text) > 64) THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Not one of the World's two humans: the same answer as an unknown World, before anything else is read or locked.
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  -- D-10: a contact route belongs in CONTACT_METHOD and nowhere else.
  IF p_resource_type <> 'CONTACT_METHOD' AND public.matching_text_carries_contact_route_v1(p_text) THEN
    RETURN QUERY SELECT 'CONTACT_REFUSED'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  BEGIN
    SELECT c.disclosed_material_id, c.disclosed_at INTO v_result
      FROM public.commit_introduction_progressive_disclosure_v1(
             p_command_id, p_world_id,
             introduction_sharing_private.derive_identity_v1('TEXT_RESOURCE_VERSION', v_user, p_world_id, p_command_id),
             introduction_sharing_private.derive_identity_v1('TEXT_MATERIAL', v_user, p_world_id, p_command_id),
             introduction_sharing_private.derive_identity_v1('TEXT_HISTORY_ITEM', v_user, p_world_id, p_command_id),
             introduction_sharing_private.derive_identity_v1('TEXT_GRANT_EVENT', v_user, p_world_id, p_command_id),
             p_resource_type, p_field_key, p_text, NULL) c;
  EXCEPTION
    WHEN no_data_found OR unique_violation OR object_not_in_prerequisite_state OR raise_exception THEN
      RETURN QUERY SELECT introduction_sharing_private.disclosure_refusal_v1(SQLSTATE, SQLERRM), NULL::uuid, NULL::timestamptz;
      RETURN;
  END;
  RETURN QUERY SELECT 'DISCLOSED'::text, v_result.disclosed_material_id, v_result.disclosed_at;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. PHOTOS.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.begin_my_introduction_image_v1(p_command_id uuid, p_world_id uuid)
RETURNS TABLE(outcome text, image_series_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_existing introduction_sharing_private.image_series;
  v_world public.shared_worlds;
  v_record public.introduction_records;
  v_series uuid;
  v_now timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- A retry of this human's begin is answered from the series it created; a command id naming anything else conflicts.
  SELECT * INTO v_existing FROM introduction_sharing_private.image_series s WHERE s.begin_command_id = p_command_id;
  IF FOUND THEN
    IF v_existing.owner_user_id = v_user AND v_existing.world_id = p_world_id THEN
      RETURN QUERY SELECT CASE WHEN v_existing.series_state IN ('RETIRED', 'DISCARDED') THEN 'REMOVED' ELSE 'BEGUN' END,
                          v_existing.id;
    ELSE
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid;
    END IF;
    RETURN;
  END IF;
  -- The World row first, as the frozen core, END, SUCCESS and owner deletion take it.
  SELECT * INTO v_world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  SELECT * INTO v_record FROM public.introduction_records r WHERE r.world_id = p_world_id;
  IF v_world.lifecycle IS DISTINCT FROM 'ACTIVE' OR v_world.phase IS DISTINCT FROM 'INTRODUCTION'
     OR v_record.introduction_status IS DISTINCT FROM 'ACTIVE' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- D-05: one active photo. A live series, or a retired one whose shared stage is still visible, holds the place.
  IF EXISTS (SELECT 1 FROM introduction_sharing_private.image_series s
              WHERE s.world_id = p_world_id AND s.owner_user_id = v_user
                AND (s.series_state IN ('PENDING', 'READY', 'DISCLOSING')
                     OR EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d
                                  JOIN public.introduction_disclosure_media_payloads mp
                                    ON mp.resource_version_id = d.resource_version_id
                                 WHERE d.series_id = s.id))) THEN
    RETURN QUERY SELECT 'PHOTO_ACTIVE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- D-06: storing a photo is part of disclosure, so it is gated by the same CW2-08 seam - LAST. Production: closed.
  IF (SELECT g.clearance FROM public.resolve_introduction_disclosure_prerequisites_v1(p_world_id) g) IS DISTINCT FROM 'CLEARED' THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid;
    RETURN;
  END IF;
  v_series := introduction_sharing_private.derive_identity_v1('IMAGE_SERIES', v_user, p_world_id, p_command_id);
  v_now := clock_timestamp();
  INSERT INTO introduction_sharing_private.image_series
    (id, begin_command_id, world_id, introduction_record_id, owner_user_id, series_state, upload_deadline)
  VALUES (v_series, p_command_id, p_world_id, v_record.id, v_user, 'PENDING', v_now + interval '120 seconds');
  INSERT INTO introduction_sharing_private.image_renditions (handle, series_id, stage, storage_key)
  SELECT gen_random_uuid(), v_series, s.n, 'intro-media/' || gen_random_uuid()::text FROM generate_series(1, 3) AS s(n);
  RETURN QUERY SELECT 'BEGUN'::text, v_series;
END$$;

CREATE FUNCTION public.disclose_my_introduction_image_stage_v1(
  p_command_id uuid, p_world_id uuid, p_series_id uuid, p_stage integer
) RETURNS TABLE(outcome text, disclosed_material_id uuid, disclosed_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_type text;
  v_series introduction_sharing_private.image_series;
  v_handle uuid;
  v_next integer;
  v_version uuid;
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_series_id IS NULL OR p_stage IS NULL OR p_stage NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  v_type := CASE WHEN p_stage = 3 THEN 'FULL_IMAGE' ELSE 'PARTIAL_IMAGE' END;
  v_version := introduction_sharing_private.derive_identity_v1('IMAGE_RESOURCE_VERSION', v_user, p_world_id, p_command_id);
  SELECT r.handle INTO v_handle FROM introduction_sharing_private.image_renditions r
    JOIN introduction_sharing_private.image_series s ON s.id = r.series_id
   WHERE r.series_id = p_series_id AND r.stage = p_stage AND s.owner_user_id = v_user AND s.world_id = p_world_id;
  -- A command id that already exists is the frozen core's to answer from durable rows, before any lock: a replay, the
  -- owner's deletion (DELETED: no verifier survives to compare against), or its own conflict.
  IF NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_commands c WHERE c.id = p_command_id) THEN
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
    SELECT * INTO v_series FROM introduction_sharing_private.image_series s
     WHERE s.id = p_series_id AND s.world_id = p_world_id AND s.owner_user_id = v_user FOR UPDATE;
    IF NOT FOUND OR v_series.series_state NOT IN ('READY', 'DISCLOSING', 'RETIRED') THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
    -- D-05: once any shared stage of this photo was deleted, the photo cannot continue.
    IF v_series.series_state = 'RETIRED'
       OR EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d
                   WHERE d.series_id = p_series_id
                     AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                                      WHERE mp.resource_version_id = d.resource_version_id)) THEN
      PERFORM introduction_sharing_private.retire_image_series_v1(p_series_id, true);
      RETURN QUERY SELECT 'RETIRED'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
    -- Strictly in order: exactly the next stage, never a skip and never a second delivery of one stage.
    SELECT count(*)::integer + 1 INTO v_next FROM introduction_sharing_private.image_stage_disclosures d
     WHERE d.series_id = p_series_id;
    IF p_stage <> v_next OR v_handle IS NULL THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
  END IF;
  BEGIN
    SELECT c.disclosed_material_id, c.disclosed_at INTO v_result
      FROM public.commit_introduction_progressive_disclosure_v1(
             p_command_id, p_world_id, v_version,
             introduction_sharing_private.derive_identity_v1('IMAGE_MATERIAL', v_user, p_world_id, p_command_id),
             introduction_sharing_private.derive_identity_v1('IMAGE_HISTORY_ITEM', v_user, p_world_id, p_command_id),
             introduction_sharing_private.derive_identity_v1('IMAGE_GRANT_EVENT', v_user, p_world_id, p_command_id),
             v_type, NULL, NULL, 'qmedia:' || coalesce(v_handle::text, 'released')) c;
    -- A replay of this exact stage command already has its row; a new delivery records its stage.
    INSERT INTO introduction_sharing_private.image_stage_disclosures (series_id, stage, resource_version_id, disclosure_command_id)
    SELECT p_series_id, p_stage, v_version, p_command_id
     WHERE NOT EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d
                        WHERE d.disclosure_command_id = p_command_id);
    UPDATE introduction_sharing_private.image_series s SET series_state = 'DISCLOSING'
     WHERE s.id = p_series_id AND s.series_state = 'READY';
  EXCEPTION
    WHEN no_data_found OR unique_violation OR object_not_in_prerequisite_state OR raise_exception THEN
      RETURN QUERY SELECT introduction_sharing_private.disclosure_refusal_v1(SQLSTATE, SQLERRM), NULL::uuid, NULL::timestamptz;
      RETURN;
  END;
  RETURN QUERY SELECT 'DISCLOSED'::text, v_result.disclosed_material_id, v_result.disclosed_at;
END$$;

CREATE FUNCTION public.remove_my_introduction_image_v1(p_command_id uuid, p_world_id uuid, p_series_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_series introduction_sharing_private.image_series;
  v_stage record;
  v_answer text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_series_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- A privacy act, not a gated one: any state the frozen owner deletion accepts (ACTIVE or READ_ONLY_CLOSED).
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.lifecycle IN ('ACTIVE', 'READ_ONLY_CLOSED') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO v_series FROM introduction_sharing_private.image_series s
   WHERE s.id = p_series_id AND s.world_id = p_world_id AND s.owner_user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- Every stage still visible is deleted through the frozen owner deletion, as the owner (auth.uid()).
  FOR v_stage IN
    SELECT d.stage, rv.material_id
      FROM introduction_sharing_private.image_stage_disclosures d
      JOIN public.introduction_disclosure_resource_versions rv ON rv.id = d.resource_version_id
     WHERE d.series_id = p_series_id
       AND EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp WHERE mp.resource_version_id = d.resource_version_id)
     ORDER BY d.stage
  LOOP
    SELECT o.outcome INTO v_answer FROM public.delete_own_shared_world_material_v1(
      introduction_sharing_private.derive_identity_v1('IMAGE_REMOVE_STAGE_' || v_stage.stage, v_user, p_series_id, p_command_id),
      p_world_id, v_stage.material_id) o;
    IF v_answer IS DISTINCT FROM 'DELETED' THEN
      RAISE EXCEPTION 'INTRODUCTION_IMAGE_REMOVE_CONTRADICTORY' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  PERFORM introduction_sharing_private.retire_image_series_v1(p_series_id, false);
  RETURN QUERY SELECT 'REMOVED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. READS (authenticated, STABLE).
-- ---------------------------------------------------------------------------------------------------------------------
-- One World's shares as this reader may see them: the frozen resolver decides visibility (ACTIVE, END entitlement and
-- SUCCESS Standard alike, and owner deletion dominating), plus the reader's own unshared photo stages. Never a user id.
CREATE FUNCTION public.read_my_introduction_disclosures_v1(p_world_id uuid)
RETURNS TABLE(introduction_state text, item_kind text, is_mine boolean, disclosure_material_id uuid,
              disclosure_version_id uuid, resource_type text, field_key text, text_value text,
              image_series_id uuid, image_stage integer, media_handle uuid, series_state text, established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_state text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_state := introduction_sharing_private.introduction_state_v1(p_world_id, v_user);
  IF v_state IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    WITH visible AS (
      SELECT v.material_id, v.resource_version_id, v.owner_user_id, v.resource_type, v.field_key, v.text_value,
             v.media_object_ref, v.occurred_at
        FROM public.resolve_shared_world_introduction_disclosure_v1(p_world_id, v_user) v
    )
    SELECT v_state, CASE WHEN v.text_value IS NOT NULL THEN 'TEXT' ELSE 'IMAGE' END, v.owner_user_id = v_user,
           v.material_id, v.resource_version_id, v.resource_type, v.field_key, v.text_value,
           CASE WHEN v.owner_user_id = v_user THEN d.series_id END, d.stage::integer,
           CASE WHEN v.media_object_ref ~ '^qmedia:[0-9a-f-]{36}$' THEN substr(v.media_object_ref, 8)::uuid END,
           NULL::text, v.occurred_at
      FROM visible v
      LEFT JOIN introduction_sharing_private.image_stage_disclosures d ON d.resource_version_id = v.resource_version_id
    UNION ALL
    SELECT v_state, 'MY_IMAGE_STAGE', true, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::text,
           s.id, r.stage::integer, r.handle, s.series_state, NULL::timestamptz
      FROM introduction_sharing_private.image_series s
      JOIN introduction_sharing_private.image_renditions r ON r.series_id = s.id
     WHERE v_state = 'ACTIVE' AND s.world_id = p_world_id AND s.owner_user_id = v_user
       AND s.series_state IN ('PENDING', 'READY', 'DISCLOSING')
       AND NOT EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d2
                        WHERE d2.series_id = s.id AND d2.stage = r.stage);
  IF NOT FOUND THEN
    RETURN QUERY SELECT v_state, 'NONE'::text, NULL::boolean, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::text,
                        NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::timestamptz;
  END IF;
END$$;

-- Everything the reader shared, in every Introduction World they are one of the two humans of - live, ended or
-- continued - so a deletion and a "go back to my first name" are always reachable (correction 4). Their own rows only.
CREATE FUNCTION public.list_my_introduction_shares_v1()
RETURNS TABLE(world_id uuid, introduction_state text, other_first_name text, disclosure_material_id uuid,
              disclosure_version_id uuid, resource_type text, field_key text, text_value text,
              image_series_id uuid, image_stage integer, is_displayed boolean, established_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_world record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  FOR v_world IN
    SELECT r.world_id AS id, introduction_sharing_private.introduction_state_v1(r.world_id, v_user) AS state,
           shared_private.shared_person_name_v1(
             r.world_id, CASE WHEN r.lower_user_id = v_user THEN r.higher_user_id ELSE r.lower_user_id END, v_user) AS other
      FROM public.introduction_records r
     WHERE v_user IN (r.lower_user_id, r.higher_user_id)
     ORDER BY r.started_at DESC, r.world_id
  LOOP
    CONTINUE WHEN v_world.state IS NULL;
    RETURN QUERY
      SELECT v_world.id, v_world.state, v_world.other, v.material_id, v.resource_version_id, v.resource_type,
             v.field_key, v.text_value, d.series_id, d.stage::integer,
             (v.resource_type = 'FULL_NAME' AND EXISTS (
               SELECT 1 FROM introduction_sharing_private.name_display_state st
                 JOIN introduction_sharing_private.name_display_events e ON e.id = st.current_event_id
                WHERE st.world_id = v_world.id AND st.owner_user_id = v_user
                  AND e.display_act = 'GRANT' AND e.resource_version_id = v.resource_version_id)),
             v.occurred_at
        FROM public.resolve_shared_world_introduction_disclosure_v1(v_world.id, v_user) v
        LEFT JOIN introduction_sharing_private.image_stage_disclosures d ON d.resource_version_id = v.resource_version_id
       WHERE v.owner_user_id = v_user
       ORDER BY v.occurred_at, v.resource_version_id;
  END LOOP;
END$$;

-- Is this reader allowed to receive these bytes NOW? Re-decided on every request (correction 2): the owner may preview
-- their own unshared stages while the Introduction is live; anyone may receive a shared stage only while the frozen
-- resolver still shows it to them. A deleted, erased, unshared or foreign handle is one answer: UNAVAILABLE.
CREATE FUNCTION public.authorize_my_introduction_media_v1(p_world_id uuid, p_handle uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_state text;
  v_owner uuid;
  v_series_state text;
  v_stage integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_handle IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_state := introduction_sharing_private.introduction_state_v1(p_world_id, v_user);
  SELECT s.owner_user_id, s.series_state, r.stage INTO v_owner, v_series_state, v_stage
    FROM introduction_sharing_private.image_renditions r
    JOIN introduction_sharing_private.image_series s ON s.id = r.series_id
   WHERE r.handle = p_handle AND s.world_id = p_world_id;
  IF v_state IS NULL OR v_owner IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_shared_world_introduction_disclosure_v1(p_world_id, v_user) v
              WHERE v.media_object_ref = 'qmedia:' || p_handle::text) THEN
    RETURN QUERY SELECT 'AUTHORIZED'::text;
    RETURN;
  END IF;
  IF v_owner = v_user AND v_state = 'ACTIVE' AND v_series_state IN ('READY', 'DISCLOSING')
     AND NOT EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d
                      JOIN introduction_sharing_private.image_renditions r ON r.series_id = d.series_id AND r.stage = d.stage
                     WHERE r.handle = p_handle) THEN
    RETURN QUERY SELECT 'AUTHORIZED'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'UNAVAILABLE'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. THE FULL-NAME DISPLAY CONSENT (D-09).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.grant_my_introduction_name_display_v1(p_command_id uuid, p_world_id uuid, p_resource_version_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_existing introduction_sharing_private.name_display_events;
  v_world public.shared_worlds;
  v_current uuid;
  v_current_act introduction_sharing_private.name_display_events;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_resource_version_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM introduction_sharing_private.name_display_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.owner_user_id = v_user AND v_existing.world_id = p_world_id
                              AND v_existing.display_act = 'GRANT' AND v_existing.resource_version_id = p_resource_version_id
                             THEN 'GRANTED' ELSE 'COMMAND_CONFLICT' END;
    RETURN;
  END IF;
  SELECT * INTO v_world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  -- A new grant only while the World is live: an Introduction, or the Standard World SUCCESS made of it.
  IF coalesce(introduction_sharing_private.introduction_state_v1(p_world_id, v_user), 'NONE') NOT IN ('ACTIVE', 'SHARED_WORLD')
     OR v_world.lifecycle IS DISTINCT FROM 'ACTIVE' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- The exact FULL_NAME disclosure of THIS owner in THIS World, whose text still exists.
  IF NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_resource_versions rv
                   JOIN public.introduction_disclosure_text_payloads tp ON tp.resource_version_id = rv.id
                  WHERE rv.id = p_resource_version_id AND rv.world_id = p_world_id AND rv.owner_user_id = v_user
                    AND rv.resource_type = 'FULL_NAME') THEN
    RETURN QUERY SELECT 'NOT_SHARED'::text;
    RETURN;
  END IF;
  SELECT st.current_event_id INTO v_current FROM introduction_sharing_private.name_display_state st
   WHERE st.world_id = p_world_id AND st.owner_user_id = v_user FOR UPDATE;
  IF v_current IS NOT NULL THEN
    SELECT * INTO v_current_act FROM introduction_sharing_private.name_display_events e WHERE e.id = v_current;
    IF v_current_act.display_act = 'GRANT' AND v_current_act.resource_version_id = p_resource_version_id THEN
      RETURN QUERY SELECT 'GRANTED'::text;
      RETURN;
    END IF;
  END IF;
  -- Showing a disclosed name is a display of disclosed content: the same CW2-08 seam, LAST. Production: closed.
  IF (SELECT g.clearance FROM public.resolve_introduction_disclosure_prerequisites_v1(p_world_id) g) IS DISTINCT FROM 'CLEARED' THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text;
    RETURN;
  END IF;
  INSERT INTO introduction_sharing_private.name_display_events
    (id, world_id, owner_user_id, display_act, resource_version_id, prior_event_id, occurred_at)
  VALUES (p_command_id, p_world_id, v_user, 'GRANT', p_resource_version_id, v_current, clock_timestamp());
  INSERT INTO introduction_sharing_private.name_display_state (world_id, owner_user_id, current_event_id)
  VALUES (p_world_id, v_user, p_command_id)
  ON CONFLICT ON CONSTRAINT name_display_state_pk DO UPDATE SET current_event_id = EXCLUDED.current_event_id;
  RETURN QUERY SELECT 'GRANTED'::text;
END$$;

CREATE FUNCTION public.revoke_my_introduction_name_display_v1(p_command_id uuid, p_world_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_existing introduction_sharing_private.name_display_events;
  v_current uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM introduction_sharing_private.name_display_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.owner_user_id = v_user AND v_existing.world_id = p_world_id
                              AND v_existing.display_act = 'REVOKE' THEN 'REVOKED' ELSE 'COMMAND_CONFLICT' END;
    RETURN;
  END IF;
  -- Ungated and allowed in every state (live, ended, continued): going back to the first name is never refused.
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  SELECT st.current_event_id INTO v_current FROM introduction_sharing_private.name_display_state st
   WHERE st.world_id = p_world_id AND st.owner_user_id = v_user FOR UPDATE;
  IF v_current IS NULL OR (SELECT e.display_act FROM introduction_sharing_private.name_display_events e
                            WHERE e.id = v_current) = 'REVOKE' THEN
    RETURN QUERY SELECT 'REVOKED'::text;
    RETURN;
  END IF;
  INSERT INTO introduction_sharing_private.name_display_events
    (id, world_id, owner_user_id, display_act, resource_version_id, prior_event_id, occurred_at)
  VALUES (p_command_id, p_world_id, v_user, 'REVOKE', NULL, v_current, clock_timestamp());
  UPDATE introduction_sharing_private.name_display_state st SET current_event_id = p_command_id
   WHERE st.world_id = p_world_id AND st.owner_user_id = v_user AND st.current_event_id = v_current;
  RETURN QUERY SELECT 'REVOKED'::text;
END$$;

-- The names this reader sees in one World: their own current choice, and the other human's DISPLAY name - which is the
-- other's disclosed FULL_NAME text only while their grant is current and that disclosure is still visible to this
-- reader; otherwise NULL, and the client keeps the first name the server already presents.
CREATE FUNCTION public.read_my_introduction_display_names_v1(p_world_id uuid)
RETURNS TABLE(introduction_state text, my_displayed_version_id uuid, other_display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_state text;
  v_other uuid;
  v_mine uuid;
  v_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_state := introduction_sharing_private.introduction_state_v1(p_world_id, v_user);
  IF v_state IS NULL THEN
    RETURN;
  END IF;
  SELECT CASE WHEN r.lower_user_id = v_user THEN r.higher_user_id ELSE r.lower_user_id END INTO v_other
    FROM public.introduction_records r WHERE r.world_id = p_world_id;
  SELECT e.resource_version_id INTO v_mine
    FROM introduction_sharing_private.name_display_state st
    JOIN introduction_sharing_private.name_display_events e ON e.id = st.current_event_id
   WHERE st.world_id = p_world_id AND st.owner_user_id = v_user AND e.display_act = 'GRANT';
  SELECT v.text_value INTO v_name
    FROM introduction_sharing_private.name_display_state st
    JOIN introduction_sharing_private.name_display_events e ON e.id = st.current_event_id
    JOIN public.resolve_shared_world_introduction_disclosure_v1(p_world_id, v_user) v
      ON v.resource_version_id = e.resource_version_id
   WHERE st.world_id = p_world_id AND st.owner_user_id = v_other AND e.display_act = 'GRANT'
     AND v.owner_user_id = v_other AND v.resource_type = 'FULL_NAME';
  RETURN QUERY SELECT v_state, v_mine, v_name;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE API'S STORAGE BOUNDARY (service_role only; the API holds the object-store credentials, nothing else does).
-- ---------------------------------------------------------------------------------------------------------------------
-- The storage keys of one PENDING series, only before its upload deadline.
CREATE FUNCTION public.server_read_introduction_image_upload_v1(p_series_id uuid)
RETURNS TABLE(stage integer, storage_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.stage::integer, r.storage_key
    FROM introduction_sharing_private.image_renditions r
    JOIN introduction_sharing_private.image_series s ON s.id = r.series_id
   WHERE s.id = p_series_id AND s.series_state = 'PENDING' AND clock_timestamp() < s.upload_deadline
   ORDER BY r.stage;
$$;

-- The three objects are stored: PENDING -> READY, only before the deadline (after it, the sweep owns the series).
CREATE FUNCTION public.server_complete_introduction_image_v1(p_series_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_series introduction_sharing_private.image_series;
BEGIN
  SELECT * INTO v_series FROM introduction_sharing_private.image_series s WHERE s.id = p_series_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF v_series.series_state IN ('READY', 'DISCLOSING') THEN
    RETURN QUERY SELECT 'READY'::text;
    RETURN;
  END IF;
  IF v_series.series_state <> 'PENDING' OR clock_timestamp() >= v_series.upload_deadline
     OR (SELECT count(*) FROM introduction_sharing_private.image_renditions r WHERE r.series_id = p_series_id) <> 3 THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  UPDATE introduction_sharing_private.image_series s SET series_state = 'READY' WHERE s.id = p_series_id;
  RETURN QUERY SELECT 'READY'::text;
END$$;

-- The storage key behind one handle, for the API to read the bytes the reader was just authorized for. A handle whose
-- rendition is gone has no key: the deletion's own transaction removed it.
CREATE FUNCTION public.server_read_introduction_media_key_v1(p_handle uuid)
RETURNS TABLE(storage_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.storage_key FROM introduction_sharing_private.image_renditions r
    JOIN introduction_sharing_private.image_series s ON s.id = r.series_id
   WHERE r.handle = p_handle AND s.series_state IN ('READY', 'DISCLOSING', 'RETIRED');
$$;

-- The reconciliation sweep, under each World's lock (SKIP LOCKED: a World busy with a human act is visited next time).
CREATE FUNCTION public.server_sweep_introduction_media_v1(p_limit integer)
RETURNS TABLE(swept_series integer, released_renditions integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_candidate record;
  v_series integer := 0;
  v_released integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'INTRODUCTION_MEDIA_SWEEP_INVALID' USING ERRCODE = '22023';
  END IF;
  FOR v_candidate IN
    SELECT s.id, s.world_id,
           (s.series_state = 'PENDING' AND clock_timestamp() >= s.upload_deadline) AS expired,
           (introduction_sharing_private.introduction_state_v1(s.world_id, s.owner_user_id) IS DISTINCT FROM 'ACTIVE') AS left_live
      FROM introduction_sharing_private.image_series s
     WHERE (s.series_state = 'PENDING' AND clock_timestamp() >= s.upload_deadline)
        OR (s.series_state IN ('PENDING', 'READY', 'DISCLOSING')
            AND introduction_sharing_private.introduction_state_v1(s.world_id, s.owner_user_id) IS DISTINCT FROM 'ACTIVE')
        OR EXISTS (SELECT 1 FROM introduction_sharing_private.image_renditions r
                    JOIN introduction_sharing_private.image_stage_disclosures d ON d.series_id = r.series_id AND d.stage = r.stage
                   WHERE r.series_id = s.id
                     AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                                      WHERE mp.resource_version_id = d.resource_version_id))
        OR (s.series_state IN ('RETIRED', 'DISCARDED')
            AND EXISTS (SELECT 1 FROM introduction_sharing_private.image_renditions r WHERE r.series_id = s.id
                          AND NOT EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures d
                                           JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = d.resource_version_id
                                          WHERE d.series_id = r.series_id AND d.stage = r.stage)))
     ORDER BY s.id
     LIMIT p_limit
  LOOP
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = v_candidate.world_id FOR UPDATE SKIP LOCKED;
    CONTINUE WHEN NOT FOUND;
    v_released := v_released + introduction_sharing_private.retire_image_series_v1(v_candidate.id, true);
    v_series := v_series + 1;
  END LOOP;
  RETURN QUERY SELECT v_series, v_released;
END$$;

-- Lease up to p_limit due erasures (SKIP LOCKED, so two workers never take the same key).
CREATE FUNCTION public.server_claim_introduction_media_erasures_v1(p_limit integer, p_lease_seconds integer)
RETURNS TABLE(storage_key text, lease_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lease uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 900 THEN
    RAISE EXCEPTION 'INTRODUCTION_MEDIA_ERASURE_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    UPDATE introduction_sharing_private.media_erasure_queue q
       SET lease_id = v_lease, lease_until = v_now + make_interval(secs => p_lease_seconds)
     WHERE q.storage_key IN (SELECT c.storage_key FROM introduction_sharing_private.media_erasure_queue c
                              WHERE c.not_before <= v_now AND (c.lease_until IS NULL OR c.lease_until < v_now)
                              ORDER BY c.not_before, c.storage_key
                              LIMIT p_limit
                              FOR UPDATE SKIP LOCKED)
    RETURNING q.storage_key, q.lease_id;
END$$;

-- The object is proven gone (the API saw HEAD 404 after its delete): the queue row - the last trace - goes.
CREATE FUNCTION public.server_confirm_introduction_media_erased_v1(p_storage_key text, p_lease_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM introduction_sharing_private.media_erasure_queue q
   WHERE q.storage_key = p_storage_key AND q.lease_id = p_lease_id;
  RETURN QUERY SELECT CASE WHEN FOUND THEN 'CONFIRMED' ELSE 'NOT_HELD' END;
END$$;

-- The erasure failed: keep the row, release the lease, back off (30 s doubling, at most one hour). Never dropped.
CREATE FUNCTION public.server_defer_introduction_media_erasure_v1(p_storage_key text, p_lease_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE introduction_sharing_private.media_erasure_queue q
     SET attempts = q.attempts + 1, lease_id = NULL, lease_until = NULL,
         not_before = clock_timestamp() + least(interval '1 hour', interval '30 seconds' * power(2, least(q.attempts, 7)))
   WHERE q.storage_key = p_storage_key AND q.lease_id = p_lease_id;
  RETURN QUERY SELECT CASE WHEN FOUND THEN 'DEFERRED' ELSE 'NOT_HELD' END;
END$$;

-- Storage listing reconciliation: of the stored keys the API found, enqueue every one the database no longer knows
-- (no rendition, not already queued). A key with a live rendition is never touched.
CREATE FUNCTION public.server_enqueue_unknown_introduction_media_v1(p_storage_keys text[])
RETURNS TABLE(enqueued integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_storage_keys IS NULL OR cardinality(p_storage_keys) > 1000 THEN
    RAISE EXCEPTION 'INTRODUCTION_MEDIA_ERASURE_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO introduction_sharing_private.media_erasure_queue (storage_key, not_before)
  SELECT DISTINCT k, clock_timestamp() FROM unnest(p_storage_keys) AS u(k)
   WHERE k ~ '^intro-media/[0-9a-f-]{36}$'
     AND NOT EXISTS (SELECT 1 FROM introduction_sharing_private.image_renditions r WHERE r.storage_key = k)
  ON CONFLICT ON CONSTRAINT media_erasure_queue_pk DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END$$;

-- Count-only operational state for telemetry: how many erasures are pending and how old the oldest due one is.
CREATE FUNCTION public.server_read_introduction_media_erasure_state_v1()
RETURNS TABLE(pending integer, oldest_due_seconds integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::integer,
         coalesce(max(extract(epoch FROM clock_timestamp() - q.not_before)) FILTER (WHERE q.not_before <= clock_timestamp()), 0)::integer
    FROM introduction_sharing_private.media_erasure_queue q;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. OWNERSHIP, RLS AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['image_series', 'image_renditions', 'image_stage_disclosures', 'media_erasure_queue',
                             'name_display_events', 'name_display_state'] LOOP
    EXECUTE format('ALTER TABLE introduction_sharing_private.%I OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE introduction_sharing_private.%I ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON introduction_sharing_private.%I FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON introduction_sharing_private.%I FROM %I', rel, r);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'introduction_sharing_private.refuse_name_display_event_rewrite_v1()',
    'introduction_sharing_private.derive_identity_v1(text,uuid,uuid,uuid)',
    'introduction_sharing_private.introduction_state_v1(uuid,uuid)',
    'introduction_sharing_private.retire_image_series_v1(uuid,boolean)',
    'introduction_sharing_private.disclosure_refusal_v1(text,text)',
    'public.disclose_my_introduction_text_v1(uuid,uuid,text,text,text)',
    'public.begin_my_introduction_image_v1(uuid,uuid)',
    'public.disclose_my_introduction_image_stage_v1(uuid,uuid,uuid,integer)',
    'public.remove_my_introduction_image_v1(uuid,uuid,uuid)',
    'public.read_my_introduction_disclosures_v1(uuid)',
    'public.list_my_introduction_shares_v1()',
    'public.authorize_my_introduction_media_v1(uuid,uuid)',
    'public.grant_my_introduction_name_display_v1(uuid,uuid,uuid)',
    'public.revoke_my_introduction_name_display_v1(uuid,uuid)',
    'public.read_my_introduction_display_names_v1(uuid)',
    'public.server_read_introduction_image_upload_v1(uuid)',
    'public.server_complete_introduction_image_v1(uuid)',
    'public.server_read_introduction_media_key_v1(uuid)',
    'public.server_sweep_introduction_media_v1(integer)',
    'public.server_claim_introduction_media_erasures_v1(integer,integer)',
    'public.server_confirm_introduction_media_erased_v1(text,uuid)',
    'public.server_defer_introduction_media_erasure_v1(text,uuid)',
    'public.server_enqueue_unknown_introduction_media_v1(text[])',
    'public.server_read_introduction_media_erasure_state_v1()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION
  public.disclose_my_introduction_text_v1(uuid, uuid, text, text, text),
  public.begin_my_introduction_image_v1(uuid, uuid),
  public.disclose_my_introduction_image_stage_v1(uuid, uuid, uuid, integer),
  public.remove_my_introduction_image_v1(uuid, uuid, uuid),
  public.read_my_introduction_disclosures_v1(uuid),
  public.list_my_introduction_shares_v1(),
  public.authorize_my_introduction_media_v1(uuid, uuid),
  public.grant_my_introduction_name_display_v1(uuid, uuid, uuid),
  public.revoke_my_introduction_name_display_v1(uuid, uuid),
  public.read_my_introduction_display_names_v1(uuid)
  TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA introduction_sharing_private TO service_role;
    EXECUTE 'GRANT EXECUTE ON FUNCTION
      public.server_read_introduction_image_upload_v1(uuid),
      public.server_complete_introduction_image_v1(uuid),
      public.server_read_introduction_media_key_v1(uuid),
      public.server_sweep_introduction_media_v1(integer),
      public.server_claim_introduction_media_erasures_v1(integer, integer),
      public.server_confirm_introduction_media_erased_v1(text, uuid),
      public.server_defer_introduction_media_erasure_v1(text, uuid),
      public.server_enqueue_unknown_introduction_media_v1(text[]),
      public.server_read_introduction_media_erasure_state_v1()
      TO service_role';
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  human_boundaries text[] := ARRAY[
    'public.disclose_my_introduction_text_v1(uuid,uuid,text,text,text)',
    'public.begin_my_introduction_image_v1(uuid,uuid)',
    'public.disclose_my_introduction_image_stage_v1(uuid,uuid,uuid,integer)',
    'public.remove_my_introduction_image_v1(uuid,uuid,uuid)',
    'public.read_my_introduction_disclosures_v1(uuid)',
    'public.list_my_introduction_shares_v1()',
    'public.authorize_my_introduction_media_v1(uuid,uuid)',
    'public.grant_my_introduction_name_display_v1(uuid,uuid,uuid)',
    'public.revoke_my_introduction_name_display_v1(uuid,uuid)',
    'public.read_my_introduction_display_names_v1(uuid)'];
  server_boundaries text[] := ARRAY[
    'public.server_read_introduction_image_upload_v1(uuid)',
    'public.server_complete_introduction_image_v1(uuid)',
    'public.server_read_introduction_media_key_v1(uuid)',
    'public.server_sweep_introduction_media_v1(integer)',
    'public.server_claim_introduction_media_erasures_v1(integer,integer)',
    'public.server_confirm_introduction_media_erased_v1(text,uuid)',
    'public.server_defer_introduction_media_erasure_v1(text,uuid)',
    'public.server_enqueue_unknown_introduction_media_v1(text[])',
    'public.server_read_introduction_media_erasure_state_v1()'];
  hidden text[] := ARRAY[
    'public.commit_introduction_progressive_disclosure_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text)',
    'public.resolve_introduction_disclosure_prerequisites_v1(uuid)',
    'public.delete_shared_world_owned_material_v1(uuid,uuid,uuid,uuid)',
    'introduction_sharing_private.retire_image_series_v1(uuid,boolean)',
    'introduction_sharing_private.derive_identity_v1(text,uuid,uuid,uuid)'];
  fn text;
  r text;
  src text;
  rel record;
BEGIN
  FOREACH fn IN ARRAY human_boundaries || server_boundaries LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef
                     AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'S6-06: % must be postgres-owned, SECURITY DEFINER and search_path-pinned', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-06: PUBLIC must not execute %', fn;
    END IF;
    SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
    -- No account Name, no reply, analysis, Activity, push, grant, Personal Context or memory, and no dynamic SQL.
    IF src ~* '(public\.users|qandeel_|semantic|analysis|activity|push_|context_grant|personal_context|personal_data|memory|EXECUTE\s)' THEN
      RAISE EXCEPTION 'S6-06: % reaches nothing beyond its disclosure boundary', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY human_boundaries LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-06: % must not execute %', r, fn;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-06: authenticated must execute %', fn;
    END IF;
    -- The human is the session subject, never a parameter.
    IF EXISTS (SELECT 1 FROM pg_proc p, unnest(p.proargnames) a WHERE p.oid = fn::regprocedure
                AND a ~* '(user|owner|actor|counterpart|recipient|audience|viewer)') THEN
      RAISE EXCEPTION 'S6-06: % must take no human identity', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY server_boundaries LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-06: % must not execute %', r, fn;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY hidden LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-06: % must not execute %', r, fn;
      END IF;
    END LOOP;
  END LOOP;
  -- No relation of this migration holds a digest, a size, a dimension or an ETag of any content (0122).
  FOR rel IN SELECT c.relname, a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'introduction_sharing_private' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped LOOP
    IF rel.attname ~* '(digest|hash|etag|size|bytes|width|height|dimension|checksum|md5|sha)' THEN
      RAISE EXCEPTION 'S6-06: %.% would hold a verifier of content', rel.relname, rel.attname;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'introduction_sharing_private' AND c.relkind = 'r' AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'S6-06: every relation must have row level security enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'introduction_sharing_private') THEN
    RAISE EXCEPTION 'S6-06: no policy may exist on the sharing-private relations';
  END IF;
  -- The seam is still fail-closed.
  IF (SELECT g.clearance FROM public.resolve_introduction_disclosure_prerequisites_v1(gen_random_uuid()) g) <> 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'S6-06: the disclosure seam must still answer NOT_EVALUATED';
  END IF;
END$$;

COMMIT;
