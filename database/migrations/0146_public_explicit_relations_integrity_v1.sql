-- S5-03C — Public Explicit Relations + Integrity Closure v1.
--
-- Forward-only. No historical migration is edited and no frozen function is replaced. CW2-04 §16 requires that a visible
-- relation line exist ONLY for an `EXPLICIT_PUBLIC_RELATION` "with public evidence, relation type, endpoint/version
-- validity and current validity state", and D18 / D19 / §30 / D31 that similarity never creates one and that a deleted
-- Experience leaves no edge behind. No runtime held that authority before this migration: 0091–0099 and 0142–0145 hold no
-- relation of any kind (S5-03B served zero lines, gap G07). This migration is that minimal, additive authority, and the
-- Product Owner's S5-03C decision (R+, 2026-10-07) is its whole semantics:
--
--   * ONE relation type in v1, `EXPLICIT_PUBLIC_RELATION`: explicit, MUTUAL and UNDIRECTED. QANDEEL never creates, proposes
--     or publishes one. Similarity, proximity, a shared semantic region, colour, theme, popularity, discussion, views,
--     recency and any score create nothing: the ONLY writer of a relation is a human controller's explicit request.
--   * A controller of the SOURCE Experience requests; a controller of the TARGET Experience must explicitly ACCEPT before
--     any Public relation exists. A pending request may be CANCELLED by its initiating side or DECLINED by the target side.
--     Once ACTIVE, either endpoint's controller may REMOVE it at any time.
--   * The canonical evidence is those authenticated authority acts themselves — no free-text evidence and no content.
--   * A relation binds BOTH exact Experience Versions AND both exact reviewed S5-03A revisions it was requested for.
--     It is servable only while it is ACTIVE and BOTH endpoints are, at read time, exactly those versions and revisions
--     served by the ONE S5-03B visible-entry derivation (canonical visibility + the reviewed current interpretation + its
--     current placement). Any version or revision change, a withdrawal, a disappearance, an ASSURE-F05 erasure, a loss of
--     visibility, or a removal makes it non-servable immediately. Nothing carries forward: a new current pair needs a new
--     explicit relation.
--   * Relation truth NEVER changes geography: nothing here reads a distance, a region or a theme to decide anything, and
--     nothing here writes a coordinate. Relations are an overlay over canonical geography, never an input to it.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- Why staleness needs no write
-- ---------------------------------------------------------------------------------------------------------------------
-- Validity is DERIVED on every read and stored nowhere, exactly like 0098 visibility and 0145 spatial readiness. It is
-- also permanent, because every input it reads is monotonic in the frozen runtime: the current version pointer only moves
-- forward (0091), the current semantic revision is the highest (0096 / 0144), a withdrawal is an append-only act (0094),
-- an ASSURE-F05 erasure NULLs content for good (0143 / 0144), and absence is terminal (0099). A relation that stopped
-- matching its bound pair can therefore never match it again — and a relation never re-binds: the bindings are immutable.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- MATERIAL / REASONING (CW2-02 §27, S5-02 R1, S5-03A R1)
-- ---------------------------------------------------------------------------------------------------------------------
-- The two relations store identities, instants and three closed vocabularies (relation type, act, acting side). No
-- package text, meaning, theme, label, display or account is copied: whatever a reader needs is joined from the visible
-- S5-03B entry at read time. When ASSURE-F05 erases a package item, S5-03A NULLs the interpretation's content in the same
-- transaction, the visible entry goes dark, and every relation through that Experience stops being served at that instant
-- with no write of its own.
--
-- ---------------------------------------------------------------------------------------------------------------------
-- Disclosure (CW2-04 §27–§30; S5-03C integrity laws)
-- ---------------------------------------------------------------------------------------------------------------------
-- Every read is the caller's own (`auth.uid()`, admitted by the frozen audience gate). A relation row is returned only
-- when BOTH endpoints are served now; one visible endpoint never discloses an invisible other — not through a row, a
-- count, an identity, a meaning or an outcome. A command that targets anything not served now answers UNAVAILABLE, the
-- same answer a guessed id gets. No relation id, count, endpoint or state is cached anywhere a client could keep serving.
--
-- Lock order: a command takes BOTH Experience rows FOR UPDATE in ascending id order, then both current packages' items
-- FOR SHARE in the same order (the S5-03A / S5-03B discipline, extended to two Experiences), then writes its own family.
-- Viewer and owner reads take no lock.

BEGIN;

-- =====================================================================================================================
-- A. THE PRIVATE SCHEMA AND ITS TWO APPEND-ONLY RELATIONS. No column names an account and no foreign key reaches one
--    directly. They are NOT outside QAN-BL-ACCT-01: each relation binds two Experience Versions and two S5-03A
--    interpretations ON DELETE RESTRICT — edges of the open blocker.
-- =====================================================================================================================
CREATE SCHEMA public_relation_private;
REVOKE ALL ON SCHEMA public_relation_private FROM PUBLIC;

-- A.1 ONE explicit relation request between two exact visible Experience Versions under their exact reviewed revisions.
--     The request is the source side's authority act; the row never changes.
CREATE TABLE public_relation_private.explicit_relations (
    id uuid NOT NULL,
    relation_type text NOT NULL,
    source_experience_id uuid NOT NULL,
    source_experience_version_id uuid NOT NULL,
    source_interpretation_id uuid NOT NULL,
    target_experience_id uuid NOT NULL,
    target_experience_version_id uuid NOT NULL,
    target_interpretation_id uuid NOT NULL,
    requested_at timestamptz NOT NULL,
    CONSTRAINT explicit_relations_pk PRIMARY KEY (id),
    CONSTRAINT explicit_relations_type_check CHECK (relation_type = 'EXPLICIT_PUBLIC_RELATION'),
    CONSTRAINT explicit_relations_two_endpoints_check CHECK (source_experience_id <> target_experience_id),
    CONSTRAINT explicit_relations_source_version_fk
        FOREIGN KEY (source_experience_version_id, source_experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT explicit_relations_target_version_fk
        FOREIGN KEY (target_experience_version_id, target_experience_id)
        REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT explicit_relations_source_interpretation_fk
        FOREIGN KEY (source_interpretation_id)
        REFERENCES public_semantic_private.semantic_interpretations (placement_id) ON DELETE RESTRICT,
    CONSTRAINT explicit_relations_target_interpretation_fk
        FOREIGN KEY (target_interpretation_id)
        REFERENCES public_semantic_private.semantic_interpretations (placement_id) ON DELETE RESTRICT
);
CREATE INDEX explicit_relations_source_idx ON public_relation_private.explicit_relations (source_experience_id, requested_at);
CREATE INDEX explicit_relations_target_idx ON public_relation_private.explicit_relations (target_experience_id, requested_at);

COMMENT ON TABLE public_relation_private.explicit_relations IS
  'S5-03C: one EXPLICIT_PUBLIC_RELATION request from a controller of the source Experience to another Public Experience, '
  'bound to both exact Experience Versions and both exact reviewed S5-03A revisions. Mutual and undirected once accepted. '
  'Identities, a closed type and an instant only. Append-only. No account. Similarity never writes a row.';

-- A.2 THE AUTHORITY ACTS after the request: the target side's ACCEPT or DECLINE, the source side's CANCEL, either side's
--     REMOVE. At most one acceptance and at most one ending per relation; the side is recorded, never the account.
CREATE TABLE public_relation_private.explicit_relation_acts (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    act text NOT NULL,
    acting_side text NOT NULL,
    acted_at timestamptz NOT NULL,
    CONSTRAINT explicit_relation_acts_pk PRIMARY KEY (id),
    CONSTRAINT explicit_relation_acts_relation_fk
        FOREIGN KEY (relation_id) REFERENCES public_relation_private.explicit_relations (id) ON DELETE RESTRICT,
    CONSTRAINT explicit_relation_acts_act_check CHECK (act IN ('ACCEPT', 'DECLINE', 'CANCEL', 'REMOVE')),
    CONSTRAINT explicit_relation_acts_side_check CHECK (
      (act IN ('ACCEPT', 'DECLINE') AND acting_side = 'TARGET')
      OR (act = 'CANCEL' AND acting_side = 'SOURCE')
      OR (act = 'REMOVE' AND acting_side IN ('SOURCE', 'TARGET')))
);
CREATE UNIQUE INDEX explicit_relation_acts_one_acceptance ON public_relation_private.explicit_relation_acts (relation_id)
    WHERE act = 'ACCEPT';
CREATE UNIQUE INDEX explicit_relation_acts_one_ending ON public_relation_private.explicit_relation_acts (relation_id)
    WHERE act IN ('DECLINE', 'CANCEL', 'REMOVE');

COMMENT ON TABLE public_relation_private.explicit_relation_acts IS
  'S5-03C: the explicit authority acts on one relation request — ACCEPT / DECLINE (target side), CANCEL (source side), '
  'REMOVE (either side, once ACTIVE). The canonical evidence of a relation. The side only, never an account. Append-only.';

-- A.3 Append-only for every role, the owner included. An inserted relation names reviewed revisions OF ITS OWN versions,
--     and an inserted act is a legal transition from the relation's derived state.
CREATE FUNCTION public_relation_private.reject_relation_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_accepted boolean;
  v_ended boolean;
BEGIN
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'explicit_relations' THEN
    IF EXISTS (SELECT 1 FROM public_semantic_private.semantic_interpretations i
                WHERE i.placement_id = NEW.source_interpretation_id AND i.experience_version_id = NEW.source_experience_version_id
                  AND i.experience_id = NEW.source_experience_id)
       AND EXISTS (SELECT 1 FROM public_semantic_private.semantic_interpretations i
                    WHERE i.placement_id = NEW.target_interpretation_id AND i.experience_version_id = NEW.target_experience_version_id
                      AND i.experience_id = NEW.target_experience_id) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'explicit_relation_acts' THEN
    SELECT bool_or(a.act = 'ACCEPT'), bool_or(a.act IN ('DECLINE', 'CANCEL', 'REMOVE'))
      INTO v_accepted, v_ended
      FROM public_relation_private.explicit_relation_acts a WHERE a.relation_id = NEW.relation_id;
    v_accepted := coalesce(v_accepted, false);
    v_ended := coalesce(v_ended, false);
    IF NOT v_ended AND ((NEW.act IN ('ACCEPT', 'DECLINE', 'CANCEL') AND NOT v_accepted) OR (NEW.act = 'REMOVE' AND v_accepted)) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'PUBLIC_RELATION_HISTORY_IS_IMMUTABLE'
    USING ERRCODE = '55000',
          DETAIL = 'Explicit relations and their authority acts are append-only for every role; a relation binds reviewed '
                   'revisions of its own exact versions, and an act is a legal transition (request → accept | decline | '
                   'cancel; accepted → remove). Nothing is rebound or revived.';
END$$;

CREATE TRIGGER explicit_relations_immutable BEFORE INSERT OR UPDATE OR DELETE ON public_relation_private.explicit_relations
    FOR EACH ROW EXECUTE FUNCTION public_relation_private.reject_relation_history_mutation_v1();
CREATE TRIGGER explicit_relation_acts_immutable BEFORE INSERT OR UPDATE OR DELETE ON public_relation_private.explicit_relation_acts
    FOR EACH ROW EXECUTE FUNCTION public_relation_private.reject_relation_history_mutation_v1();

-- =====================================================================================================================
-- B. INTERNAL DERIVATIONS. Executable by no application role.
-- =====================================================================================================================

-- B.1 Deterministic identities: an equivalent retry names the same rows; no caller supplies one.
CREATE FUNCTION public_relation_private.derive_relation_identity_v1(p_namespace text, p_first uuid, p_second uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S5_03C_PUBLIC_RELATION_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_first::text) || E'\n' || lower(p_second::text), 'UTF8')), 'hex') AS h) d;
$$;

-- B.2 THE LIFE of one relation, from its acts alone: PENDING | ACTIVE | DECLINED | CANCELLED | REMOVED.
CREATE FUNCTION public_relation_private.derive_relation_life_v1(p_relation_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
           WHEN bool_or(a.act = 'REMOVE') THEN 'REMOVED'
           WHEN bool_or(a.act = 'DECLINE') THEN 'DECLINED'
           WHEN bool_or(a.act = 'CANCEL') THEN 'CANCELLED'
           WHEN bool_or(a.act = 'ACCEPT') THEN 'ACTIVE'
           ELSE 'PENDING' END
    FROM public_relation_private.explicit_relation_acts a WHERE a.relation_id = p_relation_id;
$$;

-- B.3 Is one bound endpoint served NOW exactly as it was bound? The ONE S5-03B visible-entry derivation must answer for
--     that Experience with exactly that version and exactly that reviewed revision. Anything else is false, for good.
CREATE FUNCTION public_relation_private.endpoint_is_current_v1(p_experience_id uuid, p_version_id uuid, p_interpretation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id) ve
                  WHERE ve.experience_version_id = p_version_id AND ve.interpretation_id = p_interpretation_id);
$$;

-- B.4 Is one relation (pending or active) still bound to two endpoints that are both current? The integrity closure.
CREATE FUNCTION public_relation_private.relation_is_current_v1(p_relation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public_relation_private.explicit_relations r
                  WHERE r.id = p_relation_id
                    AND public_relation_private.endpoint_is_current_v1(r.source_experience_id, r.source_experience_version_id, r.source_interpretation_id)
                    AND public_relation_private.endpoint_is_current_v1(r.target_experience_id, r.target_experience_version_id, r.target_interpretation_id));
$$;

-- B.5 Is this human a controller of this Experience?
CREATE FUNCTION public_relation_private.controls_v1(p_user uuid, p_experience_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                  WHERE c.experience_id = p_experience_id AND c.controller_user_id = p_user);
$$;

-- B.6 The canonical lock order for a command over two Experiences: both rows FOR UPDATE, ascending; then both current
--     packages' items FOR SHARE, ascending.
CREATE FUNCTION public_relation_private.lock_endpoints_v1(p_first uuid, p_second uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.public_experiences e WHERE e.id IN (p_first, p_second) ORDER BY e.id FOR UPDATE;
  PERFORM public_semantic_private.lock_current_package_v1(LEAST(p_first, p_second));
  PERFORM public_semantic_private.lock_current_package_v1(GREATEST(p_first, p_second));
END$$;

-- B.7 One authority act on one relation, idempotent per (actor, command): a retry of the SAME command reads its own act
--     back; the same command id for a different relation is a conflict. Returns true when the act exists after the call.
CREATE FUNCTION public_relation_private.record_act_v1(p_user uuid, p_command_id uuid, p_relation_id uuid, p_act text, p_side text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := public_relation_private.derive_relation_identity_v1('ACT', p_user, p_command_id);
  v_existing public_relation_private.explicit_relation_acts;
BEGIN
  SELECT a.* INTO v_existing FROM public_relation_private.explicit_relation_acts a WHERE a.id = v_id;
  IF FOUND THEN
    IF v_existing.relation_id <> p_relation_id OR v_existing.act <> p_act THEN
      RAISE EXCEPTION 'PUBLIC_RELATION_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN true;
  END IF;
  INSERT INTO public_relation_private.explicit_relation_acts (id, relation_id, act, acting_side, acted_at)
  VALUES (v_id, p_relation_id, p_act, p_side, clock_timestamp());
  RETURN true;
END$$;

-- B.8 The retry of an already-recorded act by the same command: its own outcome, read back.
CREATE FUNCTION public_relation_private.retried_act_v1(p_user uuid, p_command_id uuid, p_relation_id uuid, p_act text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing public_relation_private.explicit_relation_acts;
BEGIN
  SELECT a.* INTO v_existing FROM public_relation_private.explicit_relation_acts a
   WHERE a.id = public_relation_private.derive_relation_identity_v1('ACT', p_user, p_command_id);
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_existing.relation_id <> p_relation_id OR v_existing.act <> p_act THEN
    RAISE EXCEPTION 'PUBLIC_RELATION_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;
  RETURN true;
END$$;

-- =====================================================================================================================
-- C. THE OWNER READS (authenticated; the caller is auth.uid(), admitted by the frozen gate). Only what is served now.
-- =====================================================================================================================

-- C.1 The caller's own Experiences that are served in the Public World now: the only Experiences a relation can be asked
--     from. Its reviewed meaning names it. At most 100, in a fixed order that says nothing about an Experience.
CREATE FUNCTION public_relation_private.read_own_public_relation_experiences_v1()
RETURNS TABLE (experience_id uuid, meaning text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_spatial_private.admitted_viewer_v1();
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ve.experience_id, ve.meaning
      FROM public.public_experience_controllers c
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(c.experience_id) ve
     WHERE c.controller_user_id = v_user
     ORDER BY ve.experience_id
     LIMIT 100;
END$$;

-- C.2 The caller's own relations: every PENDING or ACTIVE relation one of whose endpoints the caller controls, while BOTH
--     endpoints are still exactly what was bound and served now — from the caller's side:
--       ACTIVE            an accepted relation
--       REQUEST_SENT      a pending request the caller's side made (the caller may cancel it)
--       REQUEST_RECEIVED  a pending request to the caller's side (the caller may accept or decline it)
--     The other endpoint is named by its reviewed meaning only. A stale, ended or invisible relation is simply absent. At
--     most 200, in request order.
CREATE FUNCTION public_relation_private.read_own_public_relations_v1()
RETURNS TABLE (relation_id uuid, experience_id uuid, other_experience_id uuid, other_meaning text, relation_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_spatial_private.admitted_viewer_v1();
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT s.id, s.own_id, s.other_id, ve.meaning,
           CASE WHEN s.life = 'ACTIVE' THEN 'ACTIVE' WHEN s.own_side = 'SOURCE' THEN 'REQUEST_SENT' ELSE 'REQUEST_RECEIVED' END::text
      FROM (
        SELECT r.id, r.requested_at, 'SOURCE'::text AS own_side, r.source_experience_id AS own_id, r.target_experience_id AS other_id,
               public_relation_private.derive_relation_life_v1(r.id) AS life
          FROM public_relation_private.explicit_relations r
         WHERE public_relation_private.controls_v1(v_user, r.source_experience_id)
        UNION ALL
        SELECT r.id, r.requested_at, 'TARGET'::text, r.target_experience_id, r.source_experience_id,
               public_relation_private.derive_relation_life_v1(r.id)
          FROM public_relation_private.explicit_relations r
         WHERE public_relation_private.controls_v1(v_user, r.target_experience_id)
      ) s
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(s.other_id) ve
     WHERE s.life IN ('PENDING', 'ACTIVE') AND public_relation_private.relation_is_current_v1(s.id)
     ORDER BY s.requested_at, s.id, s.own_side
     LIMIT 200;
END$$;

-- =====================================================================================================================
-- D. THE OWNER COMMANDS (authenticated; the acting controller is auth.uid()). Every refusal of something not served now,
--    not the caller's to act on, or never there is the same UNAVAILABLE.
-- =====================================================================================================================

-- D.1 REQUEST an explicit relation from the caller's own served Experience to another served Experience.
--       REQUESTED        the request exists (new, or this command's retry)
--       ALREADY_PENDING  a current request between the two already waits (either direction) — nothing new is written
--       ALREADY_RELATED  the two are already in an ACTIVE current relation — nothing new is written
--       UNAVAILABLE      not the source's controller, the same Experience twice, or either endpoint not served now
CREATE FUNCTION public_relation_private.request_public_relation_v1(p_command_id uuid, p_experience_id uuid, p_other_experience_id uuid)
RETURNS TABLE (outcome text, relation_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid;
  v_relation uuid;
  v_existing public_relation_private.explicit_relations;
  s record;
  t record;
  p record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_other_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_RELATION_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_user := public_spatial_private.admitted_viewer_v1();
  IF v_user IS NULL OR p_experience_id = p_other_experience_id THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  v_relation := public_relation_private.derive_relation_identity_v1('RELATION', v_user, p_command_id);
  PERFORM public_relation_private.lock_endpoints_v1(p_experience_id, p_other_experience_id);
  SELECT r.* INTO v_existing FROM public_relation_private.explicit_relations r WHERE r.id = v_relation;
  IF FOUND THEN
    IF v_existing.source_experience_id <> p_experience_id OR v_existing.target_experience_id <> p_other_experience_id THEN
      RAISE EXCEPTION 'PUBLIC_RELATION_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT 'REQUESTED'::text, v_relation;
    RETURN;
  END IF;
  IF NOT public_relation_private.controls_v1(v_user, p_experience_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT ve.experience_version_id AS version_id, ve.interpretation_id INTO s
    FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id) ve;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT ve.experience_version_id AS version_id, ve.interpretation_id INTO t
    FROM public_spatial_private.derive_visible_spatial_entry_v1(p_other_experience_id) ve;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  -- One current relation per pair, in either direction: a live pending or active one is answered, never duplicated.
  SELECT r.id, public_relation_private.derive_relation_life_v1(r.id) AS life INTO p
    FROM public_relation_private.explicit_relations r
   WHERE ((r.source_experience_id = p_experience_id AND r.target_experience_id = p_other_experience_id)
          OR (r.source_experience_id = p_other_experience_id AND r.target_experience_id = p_experience_id))
     AND public_relation_private.derive_relation_life_v1(r.id) IN ('PENDING', 'ACTIVE')
     AND public_relation_private.relation_is_current_v1(r.id)
   ORDER BY r.requested_at, r.id
   LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN p.life = 'ACTIVE' THEN 'ALREADY_RELATED' ELSE 'ALREADY_PENDING' END::text, p.id;
    RETURN;
  END IF;
  INSERT INTO public_relation_private.explicit_relations
    (id, relation_type, source_experience_id, source_experience_version_id, source_interpretation_id,
     target_experience_id, target_experience_version_id, target_interpretation_id, requested_at)
  VALUES (v_relation, 'EXPLICIT_PUBLIC_RELATION', p_experience_id, s.version_id, s.interpretation_id,
          p_other_experience_id, t.version_id, t.interpretation_id, clock_timestamp());
  RETURN QUERY SELECT 'REQUESTED'::text, v_relation;
END$$;

-- D.2 One act on one current relation, by the side that may make it. The shared body of the four acts below.
--       DONE         the act is recorded (new, or this command's retry)
--       NOT_PENDING  (accept / decline / cancel) the request is no longer waiting
--       NOT_ACTIVE   (remove) the relation is not active
--       UNAVAILABLE  not that side's controller, a stale relation, or nothing there
CREATE FUNCTION public_relation_private.act_on_public_relation_v1(p_command_id uuid, p_relation_id uuid, p_act text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid;
  v_relation public_relation_private.explicit_relations;
  v_side text;
  v_life text;
BEGIN
  IF p_command_id IS NULL OR p_relation_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_RELATION_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_user := public_spatial_private.admitted_viewer_v1();
  IF v_user IS NULL THEN
    RETURN 'UNAVAILABLE';
  END IF;
  SELECT r.* INTO v_relation FROM public_relation_private.explicit_relations r WHERE r.id = p_relation_id;
  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;
  PERFORM public_relation_private.lock_endpoints_v1(v_relation.source_experience_id, v_relation.target_experience_id);
  v_side := CASE
    WHEN p_act IN ('ACCEPT', 'DECLINE') AND public_relation_private.controls_v1(v_user, v_relation.target_experience_id) THEN 'TARGET'
    WHEN p_act = 'CANCEL' AND public_relation_private.controls_v1(v_user, v_relation.source_experience_id) THEN 'SOURCE'
    WHEN p_act = 'REMOVE' AND public_relation_private.controls_v1(v_user, v_relation.source_experience_id) THEN 'SOURCE'
    WHEN p_act = 'REMOVE' AND public_relation_private.controls_v1(v_user, v_relation.target_experience_id) THEN 'TARGET'
    ELSE NULL END;
  IF v_side IS NULL THEN
    RETURN 'UNAVAILABLE';
  END IF;
  IF public_relation_private.retried_act_v1(v_user, p_command_id, p_relation_id, p_act) THEN
    RETURN 'DONE';
  END IF;
  -- Integrity first: a relation whose bound pair is no longer exactly what is served is nothing anyone can act on.
  IF NOT public_relation_private.relation_is_current_v1(p_relation_id) THEN
    RETURN 'UNAVAILABLE';
  END IF;
  v_life := public_relation_private.derive_relation_life_v1(p_relation_id);
  IF p_act = 'REMOVE' AND v_life <> 'ACTIVE' THEN
    RETURN 'NOT_ACTIVE';
  END IF;
  IF p_act <> 'REMOVE' AND v_life <> 'PENDING' THEN
    RETURN 'NOT_PENDING';
  END IF;
  PERFORM public_relation_private.record_act_v1(v_user, p_command_id, p_relation_id, p_act, v_side);
  RETURN 'DONE';
END$$;

-- D.3 – D.6 The four acts. Each answers its own word for DONE.
CREATE FUNCTION public_relation_private.accept_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v text := public_relation_private.act_on_public_relation_v1(p_command_id, p_relation_id, 'ACCEPT');
BEGIN
  RETURN QUERY SELECT CASE WHEN v = 'DONE' THEN 'ACCEPTED' ELSE v END::text;
END$$;

CREATE FUNCTION public_relation_private.decline_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v text := public_relation_private.act_on_public_relation_v1(p_command_id, p_relation_id, 'DECLINE');
BEGIN
  RETURN QUERY SELECT CASE WHEN v = 'DONE' THEN 'DECLINED' ELSE v END::text;
END$$;

CREATE FUNCTION public_relation_private.cancel_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v text := public_relation_private.act_on_public_relation_v1(p_command_id, p_relation_id, 'CANCEL');
BEGIN
  RETURN QUERY SELECT CASE WHEN v = 'DONE' THEN 'CANCELLED' ELSE v END::text;
END$$;

CREATE FUNCTION public_relation_private.remove_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v text := public_relation_private.act_on_public_relation_v1(p_command_id, p_relation_id, 'REMOVE');
BEGIN
  RETURN QUERY SELECT CASE WHEN v = 'DONE' THEN 'REMOVED' ELSE v END::text;
END$$;

-- =====================================================================================================================
-- E. THE VIEWER READ (authenticated; the viewer is auth.uid(), admitted by the frozen gate).
-- =====================================================================================================================

-- E.1 THE EXPLICIT RELATIONS of one served Experience, as the field draws them: for every ACTIVE relation through it
--     whose two bound endpoints are both current, the OTHER endpoint's served entry (its place, reviewed meaning and
--     region) and the relation's identity. Nothing for an Experience not served, an unadmitted viewer or a guessed id; no
--     row, count or identity for a relation whose other endpoint is not served now. At most 24, in a fixed spatial order
--     of the other endpoint (never by strength, popularity, recency or anything about the relation).
CREATE FUNCTION public_relation_private.read_public_semantic_relations_v1(p_experience_id uuid)
RETURNS TABLE (relation_id uuid, experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_RELATION_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF public_spatial_private.admitted_viewer_v1() IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id)) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT o.id, ve.experience_id, ve.world_x::text, ve.world_y::text, ve.meaning, ve.semantic_region
      FROM (SELECT r.id, CASE WHEN r.source_experience_id = p_experience_id THEN r.target_experience_id ELSE r.source_experience_id END AS other_id
              FROM public_relation_private.explicit_relations r
             WHERE (r.source_experience_id = p_experience_id OR r.target_experience_id = p_experience_id)
               AND public_relation_private.derive_relation_life_v1(r.id) = 'ACTIVE'
               AND public_relation_private.relation_is_current_v1(r.id)) o
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(o.other_id) ve
     ORDER BY ve.world_x, ve.world_y, ve.experience_id, o.id
     LIMIT 24;
END$$;

-- =====================================================================================================================
-- F. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.read_own_public_relation_experiences_v1()
RETURNS TABLE (experience_id uuid, meaning text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.experience_id, r.meaning FROM public_relation_private.read_own_public_relation_experiences_v1() r;
$$;
CREATE FUNCTION public.read_own_public_relations_v1()
RETURNS TABLE (relation_id uuid, experience_id uuid, other_experience_id uuid, other_meaning text, relation_state text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.relation_id, r.experience_id, r.other_experience_id, r.other_meaning, r.relation_state
    FROM public_relation_private.read_own_public_relations_v1() r;
$$;
CREATE FUNCTION public.request_public_relation_v1(p_command_id uuid, p_experience_id uuid, p_other_experience_id uuid)
RETURNS TABLE (outcome text, relation_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.relation_id FROM public_relation_private.request_public_relation_v1(p_command_id, p_experience_id, p_other_experience_id) r;
$$;
CREATE FUNCTION public.accept_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM public_relation_private.accept_public_relation_v1(p_command_id, p_relation_id) r;
$$;
CREATE FUNCTION public.decline_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM public_relation_private.decline_public_relation_v1(p_command_id, p_relation_id) r;
$$;
CREATE FUNCTION public.cancel_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM public_relation_private.cancel_public_relation_v1(p_command_id, p_relation_id) r;
$$;
CREATE FUNCTION public.remove_public_relation_v1(p_command_id uuid, p_relation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM public_relation_private.remove_public_relation_v1(p_command_id, p_relation_id) r;
$$;
CREATE FUNCTION public.read_public_semantic_relations_v1(p_experience_id uuid)
RETURNS TABLE (relation_id uuid, experience_id uuid, world_x text, world_y text, meaning text, semantic_region text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.relation_id, r.experience_id, r.world_x, r.world_y, r.meaning, r.semantic_region
    FROM public_relation_private.read_public_semantic_relations_v1(p_experience_id) r;
$$;

-- =====================================================================================================================
-- G. PRIVILEGES. Ownership; default-deny by name; then the exact grants. The server channel (service_role) is granted
--    NOTHING: a relation is a human act, never a server one. Nothing relies on a default (0133).
-- =====================================================================================================================
ALTER TABLE public_relation_private.explicit_relations OWNER TO postgres;
ALTER TABLE public_relation_private.explicit_relation_acts OWNER TO postgres;
ALTER TABLE public_relation_private.explicit_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_relation_private.explicit_relation_acts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public_relation_private.explicit_relations, public_relation_private.explicit_relation_acts
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_fn text;
  v_commands text[] := ARRAY[
    'public_relation_private.read_own_public_relation_experiences_v1()',
    'public_relation_private.read_own_public_relations_v1()',
    'public_relation_private.request_public_relation_v1(uuid, uuid, uuid)',
    'public_relation_private.accept_public_relation_v1(uuid, uuid)',
    'public_relation_private.decline_public_relation_v1(uuid, uuid)',
    'public_relation_private.cancel_public_relation_v1(uuid, uuid)',
    'public_relation_private.remove_public_relation_v1(uuid, uuid)',
    'public_relation_private.read_public_semantic_relations_v1(uuid)',
    'public.read_own_public_relation_experiences_v1()',
    'public.read_own_public_relations_v1()',
    'public.request_public_relation_v1(uuid, uuid, uuid)',
    'public.accept_public_relation_v1(uuid, uuid)',
    'public.decline_public_relation_v1(uuid, uuid)',
    'public.cancel_public_relation_v1(uuid, uuid)',
    'public.remove_public_relation_v1(uuid, uuid)',
    'public.read_public_semantic_relations_v1(uuid)'];
  v_internal text[] := ARRAY[
    'public_relation_private.reject_relation_history_mutation_v1()',
    'public_relation_private.derive_relation_identity_v1(text, uuid, uuid)',
    'public_relation_private.derive_relation_life_v1(uuid)',
    'public_relation_private.endpoint_is_current_v1(uuid, uuid, uuid)',
    'public_relation_private.relation_is_current_v1(uuid)',
    'public_relation_private.controls_v1(uuid, uuid)',
    'public_relation_private.lock_endpoints_v1(uuid, uuid)',
    'public_relation_private.record_act_v1(uuid, uuid, uuid, text, text)',
    'public_relation_private.retried_act_v1(uuid, uuid, uuid, text)',
    'public_relation_private.act_on_public_relation_v1(uuid, uuid, text)'];
BEGIN
  FOREACH v_fn IN ARRAY v_commands || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public_relation_private.explicit_relations, public_relation_private.explicit_relation_acts FROM service_role';
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_relation_private TO authenticated';
  FOREACH v_fn IN ARRAY v_commands LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END$$;

-- =====================================================================================================================
-- H. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_role text;
  p record;
BEGIN
  -- H1. The server channel holds nothing here, and no application role executes a readiness derivation or a frozen
  --     primitive through this family.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND EXISTS (
       SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
        WHERE (n.nspname = 'public_relation_private'
               OR (n.nspname = 'public' AND pr.proname IN ('read_own_public_relation_experiences_v1', 'read_own_public_relations_v1',
                   'request_public_relation_v1', 'accept_public_relation_v1', 'decline_public_relation_v1', 'cancel_public_relation_v1',
                   'remove_public_relation_v1', 'read_public_semantic_relations_v1')))
          AND has_function_privilege('service_role', pr.oid, 'EXECUTE')) THEN
    RAISE EXCEPTION 'S5-03C: the server channel must hold no relation command';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = v_role)
       AND (has_function_privilege(v_role, 'public_spatial_private.derive_visible_spatial_entry_v1(uuid)', 'EXECUTE')
            OR has_function_privilege(v_role, 'public_spatial_private.derive_public_spatial_readiness_v1(uuid)', 'EXECUTE')
            OR has_function_privilege(v_role, 'public.publish_public_experience_v1(uuid, uuid, uuid)', 'EXECUTE')) THEN
      RAISE EXCEPTION 'S5-03C: % executes a derivation or a frozen publication primitive', v_role;
    END IF;
  END LOOP;

  -- H2. Publication stays impossible: the CW2-08 seam answers NOT_EVALUATED.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'S5-03C: the CW2-08 prerequisite seam must still answer NOT_EVALUATED';
  END IF;

  -- H3. SIMILARITY IS NOT A RELATION, AND A RELATION IS NOT GEOGRAPHY. Nothing S5-03C owns reads the field's candidate
  --     prefilter, nearby, search, a distance, a region, a theme or a vitality to decide anything; nothing writes a
  --     coordinate, a placement, a semantic revision or anything outside its own two relations; nothing publishes or
  --     reaches discussion, Public QANDEEL, private truth or the account.
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public_relation_private' LOOP
    IF p.prosrc ~ '(field_candidates_v1|read_public_semantic_nearby|search_public_semantic_field|\^ *2|semantic_region *(=|<>|IN)|primary_themes|secondary_themes|vitality|discussion|qandeel_response|published_at|display_label|public_identit|publish_public_experience_v1|resolve_public_publication_prerequisites_v1|''PUBLISHED''|provenance|shared_world|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|public\.users|s5-03a\.private|S5-03A_PRIVATE)' THEN
      RAISE EXCEPTION 'S5-03C: % reaches beyond the explicit-relation boundary', p.proname;
    END IF;
    IF p.prosrc ~* '(INSERT INTO|UPDATE|DELETE FROM)\s+public(_spatial_private|_semantic_private|_authoring_private|_world_private)?\.' THEN
      RAISE EXCEPTION 'S5-03C: % writes outside its own family', p.proname;
    END IF;
  END LOOP;
  -- H3a. Exactly one writer of a relation (the human request) and exactly one writer of an act (the four human acts'
  --      shared recorder), in the whole database.
  IF (SELECT array_agg(n.nspname || '.' || pr.proname ORDER BY 1) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND pr.prosrc ~* 'INSERT INTO\s+public_relation_private\.explicit_relations\s') IS DISTINCT FROM ARRAY['public_relation_private.request_public_relation_v1']
     OR (SELECT array_agg(n.nspname || '.' || pr.proname ORDER BY 1) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND pr.prosrc ~* 'INSERT INTO\s+public_relation_private\.explicit_relation_acts') IS DISTINCT FROM ARRAY['public_relation_private.record_act_v1'] THEN
    RAISE EXCEPTION 'S5-03C: a relation is written only by the human request, and an act only by the human act recorder';
  END IF;

  -- H4. Every S5-03C private function is a pinned postgres-owned SECURITY DEFINER.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'public_relation_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S5-03C: public_relation_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;

  -- H5. Both relations are append-only; no text column exists beyond the three closed vocabularies.
  IF (SELECT count(*) FROM pg_trigger tg WHERE NOT tg.tgisinternal
        AND tg.tgfoid = 'public_relation_private.reject_relation_history_mutation_v1()'::regprocedure) <> 2 THEN
    RAISE EXCEPTION 'S5-03C: both relation tables must be append-only';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public_relation_private' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
                AND a.atttypid IN ('text'::regtype, 'text[]'::regtype, 'varchar'::regtype, 'jsonb'::regtype, 'tsvector'::regtype)
                AND a.attname NOT IN ('relation_type', 'act', 'acting_side')) THEN
    RAISE EXCEPTION 'S5-03C: a relation table must hold no free text, evidence text or content';
  END IF;

  -- H6. No DIRECT account reference (the version / interpretation bindings are QAN-BL-ACCT-01 edges; see A).
  IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
              WHERE n.nspname = 'public_relation_private' AND c.contype = 'f'
                AND c.confrelid IN ('public.users'::regclass, 'public.public_identities'::regclass)) THEN
    RAISE EXCEPTION 'S5-03C: a relation table must not reference an account or a Public identity';
  END IF;

  -- H7. Still one Public World, the signed-out policy untouched.
  IF (SELECT count(*) FROM public.public_world_state) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state p2 WHERE p2.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'S5-03C: one Public World, and the signed-out policy still UNRESOLVED';
  END IF;
END$$;

COMMIT;
