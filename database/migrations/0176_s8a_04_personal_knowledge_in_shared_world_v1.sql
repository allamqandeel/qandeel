-- S8A-04 CP3 — Personal Knowledge in Shared World (QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT
-- v1.0, R3, approved for implementation by the Product Owner on 2026-10-25 with two binding corrections: no AI call before
-- consent, and every AI call paid by the author of the message that caused it).
--
-- Forward-only and additive. Migrations 0001–0175 are byte-unchanged and no existing function body is replaced: the one
-- existing CHECK widened is the AI-COST-01 family list (one new family). Nothing here is applied to any hosted database.
--
-- ## What exists after this file (amendment §2 – §6)
--
--   * the consent pair: ONE owner action writes ONE consent event and TWO grants of two families — a reasoning grant (use)
--     and a disclosure grant (mention as the owner's), for one memory item, one Shared World, one membership episode and
--     one audience ceiling (the exact current members at the moment of the answer). A disclosure grant always names its
--     reasoning grant with the same keys (a composite foreign key), and both end together. Only `authenticated` commands
--     write them, and the grantor is always `auth.uid()`: no server path can create a grant;
--   * the private requests: at most one open request per member and World, written only by the local relevance read below,
--     readable only by the owner; a request is never a grant;
--   * the cooldown of an item whose reply was withheld (one hour by default, an operational value);
--   * the use record: one row per item a committed reply used, with the evidence it rested on (service-only, never read by
--     a person, erased with the owner's account);
--   * the resolvers the API composes: the per-item grant and source state, the reply collector (consented items only, at
--     most one per owner per reply, by the 0171 index terms), and the local relevance read that opens a private request;
--   * `complete_shared_world_qandeel_reply_v2`: the frozen reply commit wrapped with the consent re-check under lock.
--
-- ## Authority of the local relevance read (Product Owner correction 1)
--
-- Before any consent, an item's words never leave the database: `propose_shared_knowledge_request_v1` runs entirely in SQL,
-- over the 0171 index terms of the members' eligible memories and the terms of a message every member already sees, and its
-- only effect is a request row the owner alone can read. It returns one word (REQUESTED | NONE) and no identity, no item and
-- no score. It is purpose-bound by the approved amendment (§5): it creates no grant, admits nothing into any reply, and is
-- executable by `service_role` only — the same posture as 0171's `background_unindexed_memories_v1`, which reads a member's
-- memories for that member's own benefit. Service-role execution is never treated as consent: only the owner's own
-- `authenticated` answer writes a grant.
--
-- ## Accounting (Product Owner correction 2)
--
-- One new AI-COST-01 family, SHARED_DISCLOSURE_JUDGE, begun through the unchanged `begin_ai_provider_call_v2`, whose payer
-- rule (the author of the causing HUMAN_TEXT) is untouched. No other accounting changes.

BEGIN;

CREATE SCHEMA shared_knowledge_private;
REVOKE ALL ON SCHEMA shared_knowledge_private FROM PUBLIC;

-- =====================================================================================================================
-- A. THE RELATIONS. Every row names its owner (account cascade) and its memory (cascade with the memory's own erasure).
-- =====================================================================================================================

-- A.1 The consent event log: what the owner did, once per command. Append-only.
CREATE TABLE shared_knowledge_private.consent_events (
    id uuid PRIMARY KEY,
    command_id uuid NOT NULL UNIQUE,
    world_id uuid NOT NULL REFERENCES public.shared_worlds (id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    membership_episode_id uuid NOT NULL REFERENCES public.shared_world_membership_episodes (id) ON DELETE CASCADE,
    memory_id uuid NOT NULL,
    event_kind text NOT NULL,
    ceiling_user_ids uuid[],
    content_digest text,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT consent_events_memory_fk FOREIGN KEY (memory_id, owner_user_id)
        REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
    CONSTRAINT consent_events_kind_check CHECK (event_kind IN ('GRANTED', 'DECLINED', 'REVOKED')),
    -- A grant names its ceiling (the owner among them) and the exact words it covers; nothing else does.
    CONSTRAINT consent_events_shape_check CHECK (
        (event_kind = 'GRANTED' AND ceiling_user_ids IS NOT NULL AND cardinality(ceiling_user_ids) > 0
            AND owner_user_id = ANY (ceiling_user_ids) AND content_digest ~ '^sha256:[0-9a-f]{64}$')
        OR (event_kind <> 'GRANTED' AND ceiling_user_ids IS NULL AND content_digest IS NULL))
);
CREATE INDEX consent_events_item_idx ON shared_knowledge_private.consent_events (world_id, owner_user_id, membership_episode_id, memory_id, occurred_at);

-- A.2 The reasoning grant: QANDEEL may USE this one item in this World's replies, for this episode and ceiling.
CREATE TABLE shared_knowledge_private.reasoning_grants (
    id uuid PRIMARY KEY,
    consent_event_id uuid NOT NULL UNIQUE REFERENCES shared_knowledge_private.consent_events (id) ON DELETE CASCADE,
    world_id uuid NOT NULL REFERENCES public.shared_worlds (id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    membership_episode_id uuid NOT NULL REFERENCES public.shared_world_membership_episodes (id) ON DELETE CASCADE,
    memory_id uuid NOT NULL,
    content_digest text NOT NULL,
    ceiling_user_ids uuid[] NOT NULL,
    purpose text NOT NULL DEFAULT 'SHARED_REASONING',
    status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    revoked_at timestamptz,
    CONSTRAINT reasoning_grants_memory_fk FOREIGN KEY (memory_id, owner_user_id)
        REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
    CONSTRAINT reasoning_grants_pair_key UNIQUE (id, world_id, owner_user_id, membership_episode_id, memory_id, content_digest),
    CONSTRAINT reasoning_grants_purpose_check CHECK (purpose = 'SHARED_REASONING'),
    CONSTRAINT reasoning_grants_status_check CHECK (status IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT reasoning_grants_revoked_check CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL)),
    CONSTRAINT reasoning_grants_ceiling_check CHECK (cardinality(ceiling_user_ids) > 0 AND owner_user_id = ANY (ceiling_user_ids)),
    CONSTRAINT reasoning_grants_digest_check CHECK (content_digest ~ '^sha256:[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX reasoning_grants_one_active_idx ON shared_knowledge_private.reasoning_grants (world_id, owner_user_id, memory_id)
    WHERE status = 'ACTIVE';

-- A.3 The disclosure grant: QANDEEL may MENTION that item as its owner's, to the same ceiling. It names its reasoning grant
--     with the same keys, so it can never cover another item, World, episode or wording.
CREATE TABLE shared_knowledge_private.disclosure_grants (
    id uuid PRIMARY KEY,
    reasoning_grant_id uuid NOT NULL UNIQUE,
    world_id uuid NOT NULL,
    owner_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    membership_episode_id uuid NOT NULL,
    memory_id uuid NOT NULL,
    content_digest text NOT NULL,
    ceiling_user_ids uuid[] NOT NULL,
    scope text NOT NULL DEFAULT 'MENTION_ATTRIBUTED_TO_OWNER',
    status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    revoked_at timestamptz,
    CONSTRAINT disclosure_grants_pair_fk FOREIGN KEY (reasoning_grant_id, world_id, owner_user_id, membership_episode_id, memory_id, content_digest)
        REFERENCES shared_knowledge_private.reasoning_grants (id, world_id, owner_user_id, membership_episode_id, memory_id, content_digest)
        ON DELETE CASCADE,
    CONSTRAINT disclosure_grants_scope_check CHECK (scope = 'MENTION_ATTRIBUTED_TO_OWNER'),
    CONSTRAINT disclosure_grants_status_check CHECK (status IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT disclosure_grants_revoked_check CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL)),
    CONSTRAINT disclosure_grants_ceiling_check CHECK (cardinality(ceiling_user_ids) > 0 AND owner_user_id = ANY (ceiling_user_ids))
);

-- A.4 The private requests. Written only by the local relevance read; the owner alone reads them.
CREATE TABLE shared_knowledge_private.requests (
    id uuid PRIMARY KEY,
    world_id uuid NOT NULL REFERENCES public.shared_worlds (id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    membership_episode_id uuid NOT NULL REFERENCES public.shared_world_membership_episodes (id) ON DELETE CASCADE,
    memory_id uuid NOT NULL,
    state text NOT NULL DEFAULT 'OPEN',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    answered_at timestamptz,
    answer_event_id uuid REFERENCES shared_knowledge_private.consent_events (id) ON DELETE CASCADE,
    CONSTRAINT requests_memory_fk FOREIGN KEY (memory_id, owner_user_id)
        REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
    CONSTRAINT requests_state_check CHECK (state IN ('OPEN', 'ALLOWED', 'DECLINED')),
    CONSTRAINT requests_answer_check CHECK ((state = 'OPEN') = (answered_at IS NULL AND answer_event_id IS NULL)),
    CONSTRAINT requests_one_per_item_unique UNIQUE (world_id, owner_user_id, membership_episode_id, memory_id)
);
CREATE UNIQUE INDEX requests_one_open_idx ON shared_knowledge_private.requests (world_id, owner_user_id, membership_episode_id)
    WHERE state = 'OPEN';
CREATE INDEX requests_window_idx ON shared_knowledge_private.requests (world_id, owner_user_id, created_at);

-- A.5 The cooldown of an item whose reply was withheld (§4): no reply uses it before `until`.
CREATE TABLE shared_knowledge_private.cooldowns (
    world_id uuid NOT NULL REFERENCES public.shared_worlds (id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    memory_id uuid NOT NULL,
    until timestamptz NOT NULL,
    CONSTRAINT cooldowns_pk PRIMARY KEY (world_id, owner_user_id, memory_id),
    CONSTRAINT cooldowns_memory_fk FOREIGN KEY (memory_id, owner_user_id)
        REFERENCES public.memories (id, user_id) ON DELETE CASCADE
);

-- A.6 The use record (§3 step 4): one row per item a committed reply used. Never read by a person.
CREATE TABLE shared_knowledge_private.uses (
    material_id uuid NOT NULL REFERENCES public.shared_world_materials (id) ON DELETE CASCADE,
    reasoning_grant_id uuid NOT NULL REFERENCES shared_knowledge_private.reasoning_grants (id) ON DELETE CASCADE,
    disclosure_grant_id uuid NOT NULL REFERENCES shared_knowledge_private.disclosure_grants (id) ON DELETE CASCADE,
    world_id uuid NOT NULL,
    owner_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    memory_id uuid NOT NULL,
    disclosed boolean NOT NULL,
    audience_snapshot_ref text NOT NULL,
    gate_ref text NOT NULL,
    readiness_ref text NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uses_pk PRIMARY KEY (material_id, reasoning_grant_id)
);

-- A.7 History stays history: an event is never edited; a grant only moves ACTIVE → REVOKED, once, both of a pair in the
--     same transaction (checked at commit); a request only moves OPEN → answered, once.
CREATE FUNCTION shared_knowledge_private.guard_history_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'consent_events' OR TG_TABLE_NAME = 'uses' THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_HISTORY_IS_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF TG_TABLE_NAME IN ('reasoning_grants', 'disclosure_grants') THEN
    IF OLD.status = 'ACTIVE' AND NEW.status = 'REVOKED' AND NEW.revoked_at IS NOT NULL
       AND (to_jsonb(NEW) - 'status' - 'revoked_at') = (to_jsonb(OLD) - 'status' - 'revoked_at') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'requests' THEN
    IF OLD.state = 'OPEN' AND NEW.state IN ('ALLOWED', 'DECLINED')
       AND (to_jsonb(NEW) - 'state' - 'answered_at' - 'answer_event_id') = (to_jsonb(OLD) - 'state' - 'answered_at' - 'answer_event_id') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'SHARED_KNOWLEDGE_HISTORY_IS_IMMUTABLE' USING ERRCODE = '55000';
END$$;

CREATE TRIGGER consent_events_guard BEFORE UPDATE ON shared_knowledge_private.consent_events
    FOR EACH ROW EXECUTE FUNCTION shared_knowledge_private.guard_history_v1();
CREATE TRIGGER reasoning_grants_guard BEFORE UPDATE ON shared_knowledge_private.reasoning_grants
    FOR EACH ROW EXECUTE FUNCTION shared_knowledge_private.guard_history_v1();
CREATE TRIGGER disclosure_grants_guard BEFORE UPDATE ON shared_knowledge_private.disclosure_grants
    FOR EACH ROW EXECUTE FUNCTION shared_knowledge_private.guard_history_v1();
CREATE TRIGGER requests_guard BEFORE UPDATE ON shared_knowledge_private.requests
    FOR EACH ROW EXECUTE FUNCTION shared_knowledge_private.guard_history_v1();
CREATE TRIGGER uses_guard BEFORE UPDATE ON shared_knowledge_private.uses
    FOR EACH ROW EXECUTE FUNCTION shared_knowledge_private.guard_history_v1();

-- A.8 Refused at commit: a reasoning grant without its disclosure grant (or the reverse), a pair whose statuses differ, or a
--     grant whose consent event is not the owner's GRANTED event for exactly that World, episode, item, ceiling and words.
CREATE FUNCTION shared_knowledge_private.require_pair_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'reasoning_grants' THEN v_id := NEW.id; ELSE v_id := NEW.reasoning_grant_id; END IF;
  IF NOT EXISTS (
       SELECT 1 FROM shared_knowledge_private.reasoning_grants r
         JOIN shared_knowledge_private.disclosure_grants d ON d.reasoning_grant_id = r.id
         JOIN shared_knowledge_private.consent_events e ON e.id = r.consent_event_id
        WHERE r.id = v_id AND d.status = r.status AND d.ceiling_user_ids = r.ceiling_user_ids
          AND e.event_kind = 'GRANTED' AND e.world_id = r.world_id AND e.owner_user_id = r.owner_user_id
          AND e.membership_episode_id = r.membership_episode_id AND e.memory_id = r.memory_id
          AND e.ceiling_user_ids = r.ceiling_user_ids AND e.content_digest = r.content_digest) THEN
    -- A pair removed together (an erasure cascade) leaves nothing to check.
    IF NOT EXISTS (SELECT 1 FROM shared_knowledge_private.reasoning_grants r WHERE r.id = v_id)
       AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.disclosure_grants d WHERE d.reasoning_grant_id = v_id) THEN
      RETURN NULL;
    END IF;
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_GRANT_PAIR_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END$$;

CREATE CONSTRAINT TRIGGER reasoning_grants_pair AFTER INSERT OR UPDATE ON shared_knowledge_private.reasoning_grants
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shared_knowledge_private.require_pair_v1();
CREATE CONSTRAINT TRIGGER disclosure_grants_pair AFTER INSERT OR UPDATE ON shared_knowledge_private.disclosure_grants
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shared_knowledge_private.require_pair_v1();

ALTER TABLE shared_knowledge_private.consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_knowledge_private.reasoning_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_knowledge_private.disclosure_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_knowledge_private.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_knowledge_private.cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_knowledge_private.uses ENABLE ROW LEVEL SECURITY;

-- =====================================================================================================================
-- B. THE DERIVATIONS. Executable by no application role.
-- =====================================================================================================================

-- B.1 One item, now (PO-4): AVAILABLE only for the owner's ACTIVE, unexpired memory about themselves, stated or confirmed by
--     them, not an interaction preference. Otherwise the reason it is not, in the CG-5 vocabulary; a missing row (an erased
--     memory) is a forgotten one.
CREATE FUNCTION shared_knowledge_private.item_v1(p_owner uuid, p_memory uuid)
RETURNS TABLE (availability text, reason text, content text, content_digest text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.memories; v_reason text;
BEGIN
  SELECT * INTO m FROM public.memories x WHERE x.id = p_memory AND x.user_id = p_owner;
  IF NOT FOUND OR m.status = 'DELETED' THEN
    RETURN QUERY SELECT 'DELETED_BY_OWNER'::text, 'FORGOTTEN'::text, NULL::text, NULL::text; RETURN;
  END IF;
  v_reason := CASE
    WHEN m.status = 'SUPERSEDED' THEN 'CORRECTED'
    WHEN m.status = 'DISABLED' THEN 'TURNED_OFF'
    WHEN m.status = 'EXPIRED' OR (m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP) THEN 'EXPIRED'
    WHEN m.status <> 'ACTIVE' OR m.source NOT IN ('USER_STATED', 'USER_CONFIRMED') OR m.type = 'INTERACTION_PREFERENCE'
         OR NOT EXISTS (SELECT 1 FROM public.memory_subject_attributions a
                         WHERE a.memory_id = m.id AND a.user_id = m.user_id AND a.subject = 'SELF') THEN 'INELIGIBLE'
  END;
  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, v_reason, NULL::text, NULL::text; RETURN;
  END IF;
  RETURN QUERY SELECT 'AVAILABLE'::text, NULL::text, m.content,
                      'sha256:' || encode(pg_catalog.sha256(convert_to(m.content, 'UTF8')), 'hex');
END$$;

-- B.2 The exact current human audience of a World (the frozen I-03D resolver), as an array.
CREATE FUNCTION shared_knowledge_private.audience_v1(p_world uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(a.user_id ORDER BY a.user_id), ARRAY[]::uuid[])
    FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world) a;
$$;

-- B.3 What one reasoning grant is NOW (§2): ACTIVE only while revoked by nobody, the World is ACTIVE / STANDARD, its episode
--     is open, the item is AVAILABLE with the same words, and the ceiling covers the whole current audience. A wider audience
--     is NEEDS_RECONFIRMATION (CG-3), never ACTIVE.
CREATE FUNCTION shared_knowledge_private.grant_state_v1(p_grant uuid)
RETURNS TABLE (state text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE g shared_knowledge_private.reasoning_grants; i record;
BEGIN
  SELECT * INTO g FROM shared_knowledge_private.reasoning_grants r WHERE r.id = p_grant;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NONE'::text, NULL::text; RETURN; END IF;
  IF g.status = 'REVOKED' THEN RETURN QUERY SELECT 'REVOKED'::text, NULL::text; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                  WHERE e.id = g.membership_episode_id AND e.ended_at IS NULL) THEN
    RETURN QUERY SELECT 'ENDED'::text, 'LEFT'::text; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = g.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD') THEN
    RETURN QUERY SELECT 'ENDED'::text, 'WORLD_CLOSED'::text; RETURN;
  END IF;
  SELECT * INTO i FROM shared_knowledge_private.item_v1(g.owner_user_id, g.memory_id);
  IF i.availability <> 'AVAILABLE' THEN RETURN QUERY SELECT 'ENDED'::text, i.reason; RETURN; END IF;
  IF i.content_digest <> g.content_digest THEN RETURN QUERY SELECT 'ENDED'::text, 'CORRECTED'::text; RETURN; END IF;
  IF NOT (shared_knowledge_private.audience_v1(g.world_id) <@ g.ceiling_user_ids) THEN
    RETURN QUERY SELECT 'NEEDS_RECONFIRMATION'::text, NULL::text; RETURN;
  END IF;
  RETURN QUERY SELECT 'ACTIVE'::text, NULL::text;
END$$;

-- B.4 The caller's current open episode in an ACTIVE / STANDARD World, or NULL.
CREATE FUNCTION shared_knowledge_private.open_episode_v1(p_world uuid, p_user uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.id FROM public.shared_world_membership_episodes e
    JOIN public.shared_worlds w ON w.id = e.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
   WHERE e.world_id = p_world AND e.user_id = p_user AND e.ended_at IS NULL;
$$;

-- B.5 The one consent writer: one GRANTED event and its pair, after revoking any pair the item already has here. Called
--     only by the owner's commands below, with the caller's own identity.
CREATE FUNCTION shared_knowledge_private.write_grant_v1(p_command uuid, p_world uuid, p_owner uuid, p_episode uuid, p_memory uuid,
                                                       p_ceiling uuid[], p_digest text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event uuid := pg_catalog.gen_random_uuid(); v_grant uuid := pg_catalog.gen_random_uuid(); v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE shared_knowledge_private.disclosure_grants d SET status = 'REVOKED', revoked_at = v_now
   WHERE d.world_id = p_world AND d.owner_user_id = p_owner AND d.memory_id = p_memory AND d.status = 'ACTIVE';
  UPDATE shared_knowledge_private.reasoning_grants r SET status = 'REVOKED', revoked_at = v_now
   WHERE r.world_id = p_world AND r.owner_user_id = p_owner AND r.memory_id = p_memory AND r.status = 'ACTIVE';
  INSERT INTO shared_knowledge_private.consent_events (id, command_id, world_id, owner_user_id, membership_episode_id, memory_id,
                                                       event_kind, ceiling_user_ids, content_digest, occurred_at)
  VALUES (v_event, p_command, p_world, p_owner, p_episode, p_memory, 'GRANTED', p_ceiling, p_digest, v_now);
  INSERT INTO shared_knowledge_private.reasoning_grants (id, consent_event_id, world_id, owner_user_id, membership_episode_id, memory_id,
                                                         content_digest, ceiling_user_ids, created_at)
  VALUES (v_grant, v_event, p_world, p_owner, p_episode, p_memory, p_digest, p_ceiling, v_now);
  INSERT INTO shared_knowledge_private.disclosure_grants (id, reasoning_grant_id, world_id, owner_user_id, membership_episode_id, memory_id,
                                                          content_digest, ceiling_user_ids, created_at)
  VALUES (pg_catalog.gen_random_uuid(), v_grant, p_world, p_owner, p_episode, p_memory, p_digest, p_ceiling, v_now);
  RETURN v_event;
END$$;

-- B.6 The reference a committed reply records for one used item (0089's opaque context reference).
CREATE FUNCTION shared_knowledge_private.reasoning_ref_v1(p_grant uuid) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'shared-knowledge:' || lower(p_grant::text);
$$;

-- =====================================================================================================================
-- C. THE OWNER'S COMMANDS AND READ (authenticated). The grantor is always auth.uid(); nothing here acts for anyone else.
--    Outcomes are words, never another member's state.
-- =====================================================================================================================

-- C.1 The owner's own view of one World (CG-1, CG-3, CG-4, CG-5): the open request, what they allowed, what needs their
--     answer because the audience grew, what they declined or withdrew, and what ended. Their own words only.
CREATE FUNCTION shared_knowledge_private.list_own_shared_knowledge_v1(p_world_id uuid)
RETURNS TABLE (section text, memory_id uuid, content text, request_id uuid, ended_reason text, ceiling_user_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_episode uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_world_id IS NULL THEN RAISE EXCEPTION 'SHARED_KNOWLEDGE_READ_INVALID' USING ERRCODE = '22023'; END IF;
  v_episode := shared_knowledge_private.open_episode_v1(p_world_id, v_user);
  IF v_episode IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (e.memory_id) e.memory_id, e.event_kind
      FROM shared_knowledge_private.consent_events e
     WHERE e.world_id = p_world_id AND e.owner_user_id = v_user AND e.membership_episode_id = v_episode
     ORDER BY e.memory_id, e.occurred_at DESC, e.id DESC
  ), grants AS (
    SELECT r.memory_id, r.ceiling_user_ids, s.state, s.reason
      FROM shared_knowledge_private.reasoning_grants r
      CROSS JOIN LATERAL shared_knowledge_private.grant_state_v1(r.id) s
     WHERE r.world_id = p_world_id AND r.owner_user_id = v_user AND r.membership_episode_id = v_episode AND r.status = 'ACTIVE'
  ), listed AS (
    SELECT 'REQUEST'::text AS section, q.memory_id, q.id AS request_id, NULL::text AS ended_reason, NULL::uuid[] AS ceiling
      FROM shared_knowledge_private.requests q
     WHERE q.world_id = p_world_id AND q.owner_user_id = v_user AND q.membership_episode_id = v_episode AND q.state = 'OPEN'
    UNION ALL
    SELECT CASE g.state WHEN 'ACTIVE' THEN 'ALLOWED' WHEN 'NEEDS_RECONFIRMATION' THEN 'NEEDS_RECONFIRMATION' ELSE 'ENDED' END,
           g.memory_id, NULL::uuid, CASE WHEN g.state = 'ENDED' THEN g.reason END, g.ceiling_user_ids
      FROM grants g WHERE g.state IN ('ACTIVE', 'NEEDS_RECONFIRMATION', 'ENDED')
    UNION ALL
    SELECT 'DECLINED', l.memory_id, NULL::uuid, NULL::text, NULL::uuid[]
      FROM latest l WHERE l.event_kind IN ('DECLINED', 'REVOKED')
  )
  SELECT x.section, x.memory_id, i.content, x.request_id, x.ended_reason, x.ceiling
    FROM listed x CROSS JOIN LATERAL shared_knowledge_private.item_v1(v_user, x.memory_id) i
   -- An item that is no longer the owner's AVAILABLE words is shown only as ENDED, without its words.
   WHERE x.section = 'ENDED' OR i.availability = 'AVAILABLE'
   ORDER BY x.section, x.memory_id;
END$$;

-- C.2 Answer one open request (CG-1 / CG-2). ALLOW requires the ceiling the owner was shown to be EXACTLY the current
--     members (themselves included); otherwise AUDIENCE_CHANGED and nothing is written, so the client shows the new list.
--     DECLINE writes a DECLINED event (no grant). Outcomes: ALLOWED | DECLINED | AUDIENCE_CHANGED | UNAVAILABLE.
CREATE FUNCTION shared_knowledge_private.answer_own_shared_knowledge_request_v1(p_command_id uuid, p_request_id uuid, p_decision text,
                                                                               p_ceiling_user_ids uuid[])
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); q shared_knowledge_private.requests; v_episode uuid; i record; v_event uuid; prior shared_knowledge_private.consent_events;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_request_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('ALLOW', 'DECLINE')
     OR (p_decision = 'ALLOW' AND (p_ceiling_user_ids IS NULL OR array_position(p_ceiling_user_ids, NULL::uuid) IS NOT NULL))
     OR (p_decision = 'DECLINE' AND p_ceiling_user_ids IS NOT NULL) THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- A replay of this owner's own answer is that answer.
  SELECT * INTO prior FROM shared_knowledge_private.consent_events e WHERE e.command_id = p_command_id;
  IF FOUND THEN
    IF prior.owner_user_id = v_user AND EXISTS (SELECT 1 FROM shared_knowledge_private.requests r WHERE r.id = p_request_id AND r.answer_event_id = prior.id) THEN
      RETURN QUERY SELECT CASE prior.event_kind WHEN 'GRANTED' THEN 'ALLOWED' ELSE 'DECLINED' END; RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_CONFLICT' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO q FROM shared_knowledge_private.requests r WHERE r.id = p_request_id AND r.owner_user_id = v_user FOR UPDATE;
  IF NOT FOUND OR q.state <> 'OPEN' THEN RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN; END IF;
  v_episode := shared_knowledge_private.open_episode_v1(q.world_id, v_user);
  IF v_episode IS DISTINCT FROM q.membership_episode_id THEN RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN; END IF;
  SELECT * INTO i FROM shared_knowledge_private.item_v1(v_user, q.memory_id);
  IF i.availability <> 'AVAILABLE' THEN RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN; END IF;
  IF p_decision = 'ALLOW' THEN
    IF (SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(p_ceiling_user_ids) c) IS DISTINCT FROM shared_knowledge_private.audience_v1(q.world_id) THEN
      RETURN QUERY SELECT 'AUDIENCE_CHANGED'::text; RETURN;
    END IF;
    v_event := shared_knowledge_private.write_grant_v1(p_command_id, q.world_id, v_user, v_episode, q.memory_id,
                                                       shared_knowledge_private.audience_v1(q.world_id), i.content_digest);
    UPDATE shared_knowledge_private.requests r SET state = 'ALLOWED', answered_at = clock_timestamp(), answer_event_id = v_event WHERE r.id = q.id;
    RETURN QUERY SELECT 'ALLOWED'::text; RETURN;
  END IF;
  v_event := pg_catalog.gen_random_uuid();
  INSERT INTO shared_knowledge_private.consent_events (id, command_id, world_id, owner_user_id, membership_episode_id, memory_id, event_kind)
  VALUES (v_event, p_command_id, q.world_id, v_user, v_episode, q.memory_id, 'DECLINED');
  UPDATE shared_knowledge_private.requests r SET state = 'DECLINED', answered_at = clock_timestamp(), answer_event_id = v_event WHERE r.id = q.id;
  RETURN QUERY SELECT 'DECLINED'::text;
END$$;

-- C.3 Allow an item the owner already decided about in this World and episode (CG-3 «اسمح للجميع», CG-4 «اسمح الآن»):
--     declined, withdrawn, or allowed for a smaller audience. Never an item with no decision here (no advance grant, PO-3).
--     Same exact-ceiling rule. Outcomes: ALLOWED | AUDIENCE_CHANGED | UNAVAILABLE.
CREATE FUNCTION shared_knowledge_private.allow_own_shared_knowledge_v1(p_command_id uuid, p_world_id uuid, p_memory_id uuid, p_ceiling_user_ids uuid[])
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_episode uuid; i record; prior shared_knowledge_private.consent_events;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_memory_id IS NULL OR p_ceiling_user_ids IS NULL
     OR array_position(p_ceiling_user_ids, NULL::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO prior FROM shared_knowledge_private.consent_events e WHERE e.command_id = p_command_id;
  IF FOUND THEN
    IF (prior.owner_user_id, prior.world_id, prior.memory_id, prior.event_kind) = (v_user, p_world_id, p_memory_id, 'GRANTED') THEN
      RETURN QUERY SELECT 'ALLOWED'::text; RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_CONFLICT' USING ERRCODE = '23505';
  END IF;
  v_episode := shared_knowledge_private.open_episode_v1(p_world_id, v_user);
  IF v_episode IS NULL OR NOT EXISTS (SELECT 1 FROM shared_knowledge_private.consent_events e
                                       WHERE e.world_id = p_world_id AND e.owner_user_id = v_user
                                         AND e.membership_episode_id = v_episode AND e.memory_id = p_memory_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN;
  END IF;
  SELECT * INTO i FROM shared_knowledge_private.item_v1(v_user, p_memory_id);
  IF i.availability <> 'AVAILABLE' THEN RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN; END IF;
  IF (SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(p_ceiling_user_ids) c) IS DISTINCT FROM shared_knowledge_private.audience_v1(p_world_id) THEN
    RETURN QUERY SELECT 'AUDIENCE_CHANGED'::text; RETURN;
  END IF;
  PERFORM shared_knowledge_private.write_grant_v1(p_command_id, p_world_id, v_user, v_episode, p_memory_id,
                                                  shared_knowledge_private.audience_v1(p_world_id), i.content_digest);
  RETURN QUERY SELECT 'ALLOWED'::text;
END$$;

-- C.4 Withdraw (CG-4 «اسحب», CG-3 «أوقف استخدامها»): both grants REVOKED, future only, under the lock a reply commit shares.
--     Outcomes: REVOKED | UNAVAILABLE (nothing active to withdraw).
CREATE FUNCTION shared_knowledge_private.revoke_own_shared_knowledge_v1(p_command_id uuid, p_world_id uuid, p_memory_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); g shared_knowledge_private.reasoning_grants; prior shared_knowledge_private.consent_events;
        v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_memory_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO prior FROM shared_knowledge_private.consent_events e WHERE e.command_id = p_command_id;
  IF FOUND THEN
    IF (prior.owner_user_id, prior.world_id, prior.memory_id, prior.event_kind) = (v_user, p_world_id, p_memory_id, 'REVOKED') THEN
      RETURN QUERY SELECT 'REVOKED'::text; RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_CONFLICT' USING ERRCODE = '23505';
  END IF;
  -- FOR UPDATE: a reply commit holding the pair FOR SHARE finishes first (and stands, CW2-02 §32), or waits and refuses.
  SELECT * INTO g FROM shared_knowledge_private.reasoning_grants r
   WHERE r.world_id = p_world_id AND r.owner_user_id = v_user AND r.memory_id = p_memory_id AND r.status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN; END IF;
  PERFORM 1 FROM shared_knowledge_private.disclosure_grants d WHERE d.reasoning_grant_id = g.id FOR UPDATE;
  UPDATE shared_knowledge_private.disclosure_grants d SET status = 'REVOKED', revoked_at = v_now WHERE d.reasoning_grant_id = g.id;
  UPDATE shared_knowledge_private.reasoning_grants r SET status = 'REVOKED', revoked_at = v_now WHERE r.id = g.id;
  INSERT INTO shared_knowledge_private.consent_events (id, command_id, world_id, owner_user_id, membership_episode_id, memory_id, event_kind, occurred_at)
  VALUES (pg_catalog.gen_random_uuid(), p_command_id, p_world_id, v_user, g.membership_episode_id, p_memory_id, 'REVOKED', v_now);
  RETURN QUERY SELECT 'REVOKED'::text;
END$$;

-- =====================================================================================================================
-- D. THE SERVER'S READS AND ACTS (service_role only).
-- =====================================================================================================================

-- D.1 The local relevance read (§5, Product Owner correction 1). After a QANDEEL reply to `p_source_material_id` committed:
--     for each member with an open episode, their AVAILABLE items with no decision, no request and no cooldown here, scored
--     by how many of the message's index terms they carry (0171's terms and scoring). The single strongest item opens ONE
--     private request — never for a member who has an open request in this World or was asked within the window; a
--     rejoined member starts afresh (requests, decisions and grants of an earlier membership episode do not count). Nothing
--     is returned but the word: REQUESTED | NONE.
CREATE FUNCTION shared_knowledge_private.propose_shared_knowledge_request_v1(p_world_id uuid, p_source_material_id uuid, p_terms text[],
                                                                            p_window_seconds integer)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_window interval; c record;
BEGIN
  IF p_world_id IS NULL OR p_source_material_id IS NULL OR p_window_seconds IS NULL THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_window := make_interval(secs => least(greatest(p_window_seconds, 60), 86400));
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_materials m JOIN public.shared_worlds w ON w.id = m.world_id
                  WHERE m.id = p_source_material_id AND m.world_id = p_world_id AND m.material_kind = 'HUMAN_TEXT'
                    AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD')
     OR coalesce(cardinality(p_terms), 0) = 0 THEN
    RETURN QUERY SELECT 'NONE'::text; RETURN;
  END IF;
  -- One proposal at a time per World, so two replies cannot both pass the per-member window.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.shared-knowledge.propose.v1:' || p_world_id::text, 0));
  SELECT a.user_id AS owner, a.membership_episode_id AS episode, m.id AS memory, h.hits INTO c
    FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a
    JOIN public.memories m ON m.user_id = a.user_id
    JOIN LATERAL (SELECT count(*)::integer AS hits FROM public.memory_retrieval_terms t
                   WHERE t.memory_id = m.id AND t.user_id = m.user_id AND t.term = ANY (p_terms[1:32])) h ON h.hits > 0
   WHERE (SELECT x.availability FROM shared_knowledge_private.item_v1(a.user_id, m.id) x) = 'AVAILABLE'
     AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.consent_events e
                      WHERE e.world_id = p_world_id AND e.owner_user_id = a.user_id
                        AND e.membership_episode_id = a.membership_episode_id AND e.memory_id = m.id)
     AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.reasoning_grants r
                      WHERE r.world_id = p_world_id AND r.owner_user_id = a.user_id AND r.memory_id = m.id AND r.status = 'ACTIVE'
                        AND r.membership_episode_id = a.membership_episode_id)
     AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.requests q
                      WHERE q.world_id = p_world_id AND q.owner_user_id = a.user_id
                        AND (q.created_at > clock_timestamp() - v_window
                             OR (q.membership_episode_id = a.membership_episode_id AND (q.state = 'OPEN' OR q.memory_id = m.id))))
     AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.cooldowns k
                      WHERE k.world_id = p_world_id AND k.owner_user_id = a.user_id AND k.memory_id = m.id AND k.until > clock_timestamp())
   ORDER BY h.hits DESC, m.importance DESC, m.updated_at DESC, m.id
   LIMIT 1;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NONE'::text; RETURN; END IF;
  INSERT INTO shared_knowledge_private.requests (id, world_id, owner_user_id, membership_episode_id, memory_id)
  VALUES (pg_catalog.gen_random_uuid(), p_world_id, c.owner, c.episode, c.memory);
  RETURN QUERY SELECT 'REQUESTED'::text;
END$$;

-- D.2 The reply collector (§3 step 0): for each current member, AT MOST ONE item they allowed here — ACTIVE now, not cooled
--     down, carrying at least one of the message's index terms (the strongest) — with its words and its pair. Only consented
--     words ever leave the database for a reply.
CREATE FUNCTION shared_knowledge_private.list_shared_knowledge_for_reply_v1(p_world_id uuid, p_source_material_id uuid, p_terms text[])
RETURNS TABLE (owner_user_id uuid, memory_id uuid, content text, content_digest text, reasoning_grant_id uuid,
               disclosure_grant_id uuid, membership_episode_id uuid, ceiling_user_ids uuid[], owner_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_world_id IS NULL OR p_source_material_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_materials m WHERE m.id = p_source_material_id AND m.world_id = p_world_id
                    AND m.material_kind = 'HUMAN_TEXT') OR coalesce(cardinality(p_terms), 0) = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (r.owner_user_id) r.owner_user_id, r.memory_id, i.content, i.content_digest, r.id, d.id,
         r.membership_episode_id, r.ceiling_user_ids, u.name
    FROM shared_knowledge_private.reasoning_grants r
    JOIN shared_knowledge_private.disclosure_grants d ON d.reasoning_grant_id = r.id AND d.status = 'ACTIVE'
    JOIN public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a
      ON a.user_id = r.owner_user_id AND a.membership_episode_id = r.membership_episode_id
    JOIN public.memories m ON m.id = r.memory_id AND m.user_id = r.owner_user_id
    JOIN public.users u ON u.id = r.owner_user_id
    JOIN LATERAL (SELECT count(*)::integer AS hits FROM public.memory_retrieval_terms t
                   WHERE t.memory_id = r.memory_id AND t.user_id = r.owner_user_id AND t.term = ANY (p_terms[1:32])) h ON h.hits > 0
    CROSS JOIN LATERAL shared_knowledge_private.item_v1(r.owner_user_id, r.memory_id) i
   WHERE r.world_id = p_world_id AND r.status = 'ACTIVE'
     AND (SELECT s.state FROM shared_knowledge_private.grant_state_v1(r.id) s) = 'ACTIVE'
     AND NOT EXISTS (SELECT 1 FROM shared_knowledge_private.cooldowns k
                      WHERE k.world_id = p_world_id AND k.owner_user_id = r.owner_user_id AND k.memory_id = r.memory_id
                        AND k.until > clock_timestamp())
   ORDER BY r.owner_user_id, h.hits DESC, m.importance DESC, m.updated_at DESC, r.memory_id;
END$$;

-- D.3 One item's grant and source state now (the I-03A / I-03F adapters and the disclosure revalidator): the item's
--     availability and current digest, and its ACTIVE-row pair with that pair's state. Content is never returned here.
CREATE FUNCTION shared_knowledge_private.resolve_shared_knowledge_item_v1(p_world_id uuid, p_owner_user_id uuid, p_memory_id uuid)
RETURNS TABLE (availability text, current_content_digest text, reasoning_grant_id uuid, disclosure_grant_id uuid,
               membership_episode_id uuid, grant_content_digest text, ceiling_user_ids uuid[], grant_state text, disclosure_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i record; r shared_knowledge_private.reasoning_grants; d shared_knowledge_private.disclosure_grants; s record;
BEGIN
  IF p_world_id IS NULL OR p_owner_user_id IS NULL OR p_memory_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO i FROM shared_knowledge_private.item_v1(p_owner_user_id, p_memory_id);
  SELECT * INTO r FROM shared_knowledge_private.reasoning_grants x
   WHERE x.world_id = p_world_id AND x.owner_user_id = p_owner_user_id AND x.memory_id = p_memory_id AND x.status = 'ACTIVE';
  IF NOT FOUND THEN
    RETURN QUERY SELECT i.availability, i.content_digest, NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::uuid[], 'NONE'::text, NULL::text;
    RETURN;
  END IF;
  SELECT * INTO d FROM shared_knowledge_private.disclosure_grants x WHERE x.reasoning_grant_id = r.id;
  SELECT * INTO s FROM shared_knowledge_private.grant_state_v1(r.id);
  RETURN QUERY SELECT i.availability, i.content_digest, r.id, d.id, r.membership_episode_id, r.content_digest, r.ceiling_user_ids,
                      s.state, d.status;
END$$;

-- D.4 The cooldown after a withheld reply (§4): the named items of that World are not used again before now + seconds.
CREATE FUNCTION shared_knowledge_private.cool_down_shared_knowledge_v1(p_world_id uuid, p_owner_user_ids uuid[], p_memory_ids uuid[],
                                                                       p_seconds integer)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF p_world_id IS NULL OR p_owner_user_ids IS NULL OR p_memory_ids IS NULL OR p_seconds IS NULL
     OR cardinality(p_owner_user_ids) <> cardinality(p_memory_ids) THEN
    RAISE EXCEPTION 'SHARED_KNOWLEDGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO shared_knowledge_private.cooldowns (world_id, owner_user_id, memory_id, until)
  SELECT p_world_id, x.owner, x.memory, clock_timestamp() + make_interval(secs => least(greatest(p_seconds, 60), 86400))
    FROM unnest(p_owner_user_ids, p_memory_ids) AS x(owner, memory)
    JOIN public.memories m ON m.id = x.memory AND m.user_id = x.owner
  ON CONFLICT ON CONSTRAINT cooldowns_pk DO UPDATE SET until = greatest(shared_knowledge_private.cooldowns.until, EXCLUDED.until);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END$$;

-- D.5 THE REPLY COMMIT WITH CONSENT (§3 step 4). The used pairs are locked FOR SHARE (a withdrawal takes FOR UPDATE), and
--     each is re-checked ACTIVE now — World, open episode, the item's words, the ceiling over the current audience; the
--     reasoning references must be exactly the used grants'. Then the frozen reply commit (0139 / 0155), unchanged. A
--     committed reply records one use per item. A refused check is STALE and writes nothing. Outcomes as v1.
CREATE FUNCTION shared_knowledge_private.complete_shared_world_qandeel_reply_v2(
  p_lease_id uuid, p_human_command_id uuid, p_world_id uuid, p_body_text text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_reasoning_source_refs text[], p_reasoning_grant_ids uuid[], p_disclosed boolean[]
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result record; v_count integer; v_edges text[];
BEGIN
  IF p_reasoning_grant_ids IS NULL OR p_disclosed IS NULL OR cardinality(p_reasoning_grant_ids) = 0
     OR cardinality(p_reasoning_grant_ids) <> cardinality(p_disclosed)
     OR array_position(p_reasoning_grant_ids, NULL::uuid) IS NOT NULL OR array_position(p_disclosed, NULL::boolean) IS NOT NULL
     OR (SELECT count(DISTINCT g) FROM unnest(p_reasoning_grant_ids) g) <> cardinality(p_reasoning_grant_ids)
     OR p_lease_id IS NULL OR p_human_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_QANDEEL_REPLY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- The reasoning references are exactly the used grants', in any order: no more, no fewer.
  IF (SELECT array_agg(x ORDER BY x) FROM unnest(coalesce(p_reasoning_source_refs, ARRAY[]::text[])) x)
     IS DISTINCT FROM (SELECT array_agg(shared_knowledge_private.reasoning_ref_v1(g) ORDER BY shared_knowledge_private.reasoning_ref_v1(g))
                         FROM unnest(p_reasoning_grant_ids) g) THEN
    RAISE EXCEPTION 'SHARED_QANDEEL_REPLY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;

  -- The consent locks, in id order. Then the re-check, under them.
  PERFORM 1 FROM shared_knowledge_private.reasoning_grants r WHERE r.id = ANY (p_reasoning_grant_ids) ORDER BY r.id FOR SHARE;
  PERFORM 1 FROM shared_knowledge_private.disclosure_grants d WHERE d.reasoning_grant_id = ANY (p_reasoning_grant_ids) ORDER BY d.id FOR SHARE;
  PERFORM 1 FROM public.memories m JOIN shared_knowledge_private.reasoning_grants r ON r.memory_id = m.id AND r.owner_user_id = m.user_id
   WHERE r.id = ANY (p_reasoning_grant_ids) ORDER BY m.id FOR SHARE OF m;
  SELECT count(*)::integer INTO v_count
    FROM shared_knowledge_private.reasoning_grants r
    JOIN shared_knowledge_private.disclosure_grants d ON d.reasoning_grant_id = r.id AND d.status = 'ACTIVE'
   WHERE r.id = ANY (p_reasoning_grant_ids) AND r.world_id = p_world_id AND r.status = 'ACTIVE'
     AND (SELECT s.state FROM shared_knowledge_private.grant_state_v1(r.id) s) = 'ACTIVE';
  IF v_count <> cardinality(p_reasoning_grant_ids) THEN
    PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
    RETURN QUERY SELECT 'STALE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_result FROM shared_private.complete_shared_world_qandeel_reply_v1(p_lease_id, p_human_command_id, p_world_id, p_body_text,
           p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref, p_authority_revalidation_ref,
           p_readiness_ref, p_audience_snapshot_ref, p_material_source_ids, p_reasoning_source_refs) c;
  IF v_result.outcome = 'MATERIAL_COMMITTED' THEN
    -- The use is recorded only for the reply whose reasoning edges are exactly these grants (a reply that was already
    -- committed by another request without them records nothing here).
    SELECT array_agg(dep.source_context_ref ORDER BY dep.source_context_ref) INTO v_edges
      FROM public.shared_world_material_dependencies dep
     WHERE dep.target_material_id = v_result.material_id AND dep.dependency_kind = 'REASONING_DEPENDENCY';
    IF v_edges IS NOT DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(p_reasoning_source_refs) x) THEN
      INSERT INTO shared_knowledge_private.uses (material_id, reasoning_grant_id, disclosure_grant_id, world_id, owner_user_id, memory_id,
                                                 disclosed, audience_snapshot_ref, gate_ref, readiness_ref)
      SELECT v_result.material_id, r.id, d.id, r.world_id, r.owner_user_id, r.memory_id, x.disclosed,
             p_audience_snapshot_ref, p_source_disclosure_gate_ref, p_readiness_ref
        FROM unnest(p_reasoning_grant_ids, p_disclosed) AS x(grant_id, disclosed)
        JOIN shared_knowledge_private.reasoning_grants r ON r.id = x.grant_id
        JOIN shared_knowledge_private.disclosure_grants d ON d.reasoning_grant_id = r.id
      ON CONFLICT ON CONSTRAINT uses_pk DO NOTHING;
    END IF;
  END IF;
  RETURN QUERY SELECT v_result.outcome, v_result.material_id, v_result.established_at;
END$$;

-- =====================================================================================================================
-- E. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.list_own_shared_knowledge_v1(p_world_id uuid)
RETURNS TABLE (section text, memory_id uuid, content text, request_id uuid, ended_reason text, ceiling_user_ids uuid[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.section, r.memory_id, r.content, r.request_id, r.ended_reason, r.ceiling_user_ids
    FROM shared_knowledge_private.list_own_shared_knowledge_v1(p_world_id) r;
$$;
CREATE FUNCTION public.answer_own_shared_knowledge_request_v1(p_command_id uuid, p_request_id uuid, p_decision text, p_ceiling_user_ids uuid[])
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_knowledge_private.answer_own_shared_knowledge_request_v1(p_command_id, p_request_id, p_decision, p_ceiling_user_ids) r;
$$;
CREATE FUNCTION public.allow_own_shared_knowledge_v1(p_command_id uuid, p_world_id uuid, p_memory_id uuid, p_ceiling_user_ids uuid[])
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_knowledge_private.allow_own_shared_knowledge_v1(p_command_id, p_world_id, p_memory_id, p_ceiling_user_ids) r;
$$;
CREATE FUNCTION public.revoke_own_shared_knowledge_v1(p_command_id uuid, p_world_id uuid, p_memory_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_knowledge_private.revoke_own_shared_knowledge_v1(p_command_id, p_world_id, p_memory_id) r;
$$;
CREATE FUNCTION public.propose_shared_knowledge_request_v1(p_world_id uuid, p_source_material_id uuid, p_terms text[], p_window_seconds integer)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_knowledge_private.propose_shared_knowledge_request_v1(p_world_id, p_source_material_id, p_terms, p_window_seconds) r;
$$;
CREATE FUNCTION public.list_shared_knowledge_for_reply_v1(p_world_id uuid, p_source_material_id uuid, p_terms text[])
RETURNS TABLE (owner_user_id uuid, memory_id uuid, content text, content_digest text, reasoning_grant_id uuid,
               disclosure_grant_id uuid, membership_episode_id uuid, ceiling_user_ids uuid[], owner_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.owner_user_id, r.memory_id, r.content, r.content_digest, r.reasoning_grant_id, r.disclosure_grant_id,
         r.membership_episode_id, r.ceiling_user_ids, r.owner_name
    FROM shared_knowledge_private.list_shared_knowledge_for_reply_v1(p_world_id, p_source_material_id, p_terms) r;
$$;
CREATE FUNCTION public.resolve_shared_knowledge_item_v1(p_world_id uuid, p_owner_user_id uuid, p_memory_id uuid)
RETURNS TABLE (availability text, current_content_digest text, reasoning_grant_id uuid, disclosure_grant_id uuid,
               membership_episode_id uuid, grant_content_digest text, ceiling_user_ids uuid[], grant_state text, disclosure_status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.availability, r.current_content_digest, r.reasoning_grant_id, r.disclosure_grant_id, r.membership_episode_id,
         r.grant_content_digest, r.ceiling_user_ids, r.grant_state, r.disclosure_status
    FROM shared_knowledge_private.resolve_shared_knowledge_item_v1(p_world_id, p_owner_user_id, p_memory_id) r;
$$;
CREATE FUNCTION public.cool_down_shared_knowledge_v1(p_world_id uuid, p_owner_user_ids uuid[], p_memory_ids uuid[], p_seconds integer)
RETURNS integer
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT shared_knowledge_private.cool_down_shared_knowledge_v1(p_world_id, p_owner_user_ids, p_memory_ids, p_seconds);
$$;
CREATE FUNCTION public.complete_shared_world_qandeel_reply_v2(
  p_lease_id uuid, p_human_command_id uuid, p_world_id uuid, p_body_text text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_reasoning_source_refs text[], p_reasoning_grant_ids uuid[], p_disclosed boolean[]
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.material_id, r.established_at
    FROM shared_knowledge_private.complete_shared_world_qandeel_reply_v2(p_lease_id, p_human_command_id, p_world_id, p_body_text,
           p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref, p_authority_revalidation_ref,
           p_readiness_ref, p_audience_snapshot_ref, p_material_source_ids, p_reasoning_source_refs, p_reasoning_grant_ids, p_disclosed) r;
$$;

-- =====================================================================================================================
-- F. ACCOUNTING (Product Owner correction 2): one family for the disclosure judge. The begin command is unchanged.
-- =====================================================================================================================
ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT',
  'SHARED_DISCLOSURE_JUDGE'));

-- =====================================================================================================================
-- G. ACCOUNT ERASURE COVERAGE: every relation cascades from its owner's account (and from the memory it names).
-- =====================================================================================================================
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('shared_knowledge_private.consent_events', 'ACCOUNT_CASCADE'),
    ('shared_knowledge_private.reasoning_grants', 'ACCOUNT_CASCADE'),
    ('shared_knowledge_private.disclosure_grants', 'ACCOUNT_CASCADE'),
    ('shared_knowledge_private.requests', 'ACCOUNT_CASCADE'),
    ('shared_knowledge_private.cooldowns', 'ACCOUNT_CASCADE'),
    ('shared_knowledge_private.uses', 'ACCOUNT_CASCADE');

-- =====================================================================================================================
-- H. PRIVILEGES. Default-deny for every new function and relation; then the exact grants.
-- =====================================================================================================================
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'shared_knowledge_private'
               OR (n.nspname = 'public' AND p.proname IN ('list_own_shared_knowledge_v1', 'answer_own_shared_knowledge_request_v1',
                     'allow_own_shared_knowledge_v1', 'revoke_own_shared_knowledge_v1', 'propose_shared_knowledge_request_v1',
                     'list_shared_knowledge_for_reply_v1', 'resolve_shared_knowledge_item_v1', 'cool_down_shared_knowledge_v1',
                     'complete_shared_world_qandeel_reply_v2')) LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', f.sig);
    END IF;
  END LOOP;
END$$;

ALTER SCHEMA shared_knowledge_private OWNER TO postgres;
ALTER TABLE shared_knowledge_private.consent_events OWNER TO postgres;
ALTER TABLE shared_knowledge_private.reasoning_grants OWNER TO postgres;
ALTER TABLE shared_knowledge_private.disclosure_grants OWNER TO postgres;
ALTER TABLE shared_knowledge_private.requests OWNER TO postgres;
ALTER TABLE shared_knowledge_private.cooldowns OWNER TO postgres;
ALTER TABLE shared_knowledge_private.uses OWNER TO postgres;
REVOKE ALL ON TABLE shared_knowledge_private.consent_events, shared_knowledge_private.reasoning_grants,
                    shared_knowledge_private.disclosure_grants, shared_knowledge_private.requests,
                    shared_knowledge_private.cooldowns, shared_knowledge_private.uses
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE shared_knowledge_private.consent_events, shared_knowledge_private.reasoning_grants, shared_knowledge_private.disclosure_grants, shared_knowledge_private.requests, shared_knowledge_private.cooldowns, shared_knowledge_private.uses FROM service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA shared_knowledge_private TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION shared_knowledge_private.propose_shared_knowledge_request_v1(uuid, uuid, text[], integer), shared_knowledge_private.list_shared_knowledge_for_reply_v1(uuid, uuid, text[]), shared_knowledge_private.resolve_shared_knowledge_item_v1(uuid, uuid, uuid), shared_knowledge_private.cool_down_shared_knowledge_v1(uuid, uuid[], uuid[], integer), shared_knowledge_private.complete_shared_world_qandeel_reply_v2(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[], uuid[], boolean[]), public.propose_shared_knowledge_request_v1(uuid, uuid, text[], integer), public.list_shared_knowledge_for_reply_v1(uuid, uuid, text[]), public.resolve_shared_knowledge_item_v1(uuid, uuid, uuid), public.cool_down_shared_knowledge_v1(uuid, uuid[], uuid[], integer), public.complete_shared_world_qandeel_reply_v2(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[], uuid[], boolean[]) TO service_role';
END IF; END$$;

GRANT USAGE ON SCHEMA shared_knowledge_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  shared_knowledge_private.list_own_shared_knowledge_v1(uuid),
  shared_knowledge_private.answer_own_shared_knowledge_request_v1(uuid, uuid, text, uuid[]),
  shared_knowledge_private.allow_own_shared_knowledge_v1(uuid, uuid, uuid, uuid[]),
  shared_knowledge_private.revoke_own_shared_knowledge_v1(uuid, uuid, uuid),
  public.list_own_shared_knowledge_v1(uuid),
  public.answer_own_shared_knowledge_request_v1(uuid, uuid, text, uuid[]),
  public.allow_own_shared_knowledge_v1(uuid, uuid, uuid, uuid[]),
  public.revoke_own_shared_knowledge_v1(uuid, uuid, uuid)
  TO authenticated;

-- =====================================================================================================================
-- I. DEPLOY-TIME SELF-ASSERTIONS.
-- =====================================================================================================================
DO $$
DECLARE p record; t text; r text;
BEGIN
  -- I1. Every private function is a pinned, postgres-owned SECURITY DEFINER; every exposed wrapper an INVOKER.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'shared_knowledge_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S8A-04 CP3: shared_knowledge_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;
  FOR p IN SELECT pr.proname, pr.prosecdef FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public' AND pr.proname IN ('list_own_shared_knowledge_v1', 'answer_own_shared_knowledge_request_v1',
                  'allow_own_shared_knowledge_v1', 'revoke_own_shared_knowledge_v1', 'propose_shared_knowledge_request_v1',
                  'list_shared_knowledge_for_reply_v1', 'resolve_shared_knowledge_item_v1', 'cool_down_shared_knowledge_v1',
                  'complete_shared_world_qandeel_reply_v2') LOOP
    IF p.prosecdef THEN RAISE EXCEPTION 'S8A-04 CP3: public.% must be SECURITY INVOKER', p.proname; END IF;
  END LOOP;

  -- I2. The relations are private, RLS-enabled and unreachable by every application role.
  FOREACH t IN ARRAY ARRAY['consent_events', 'reasoning_grants', 'disclosure_grants', 'requests', 'cooldowns', 'uses'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('shared_knowledge_private.' || t)::regclass) THEN
      RAISE EXCEPTION 'S8A-04 CP3: % must have row level security', t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
         AND has_table_privilege(r, 'shared_knowledge_private.' || t, 'SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'S8A-04 CP3: % must not reach %', r, t;
      END IF;
    END LOOP;
  END LOOP;

  -- I3. No server function can write a grant: the only definers that insert into a grant relation are the owner's
  --     commands' shared writer, and it is executable by no application role.
  FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_knowledge_private'
              AND pr.proname IN ('item_v1', 'audience_v1', 'grant_state_v1', 'open_episode_v1', 'write_grant_v1', 'reasoning_ref_v1',
                                 'guard_history_v1', 'require_pair_v1') LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, p.sig, 'EXECUTE') THEN
        RAISE EXCEPTION 'S8A-04 CP3: % must not execute the internal %', r, p.sig;
      END IF;
    END LOOP;
  END LOOP;
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname IN ('shared_knowledge_private', 'public')
              AND pr.prosrc ~* 'INSERT\s+INTO\s+shared_knowledge_private\.(reasoning|disclosure)_grants' LOOP
    IF p.proname <> 'write_grant_v1' THEN
      RAISE EXCEPTION 'S8A-04 CP3: only the owner''s consent writer may create a grant (found in %)', p.proname;
    END IF;
  END LOOP;
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_knowledge_private' AND pr.prosrc ~ 'write_grant_v1\(' LOOP
    IF p.proname NOT IN ('answer_own_shared_knowledge_request_v1', 'allow_own_shared_knowledge_v1') OR p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'S8A-04 CP3: the consent writer is called only by the owner''s own commands (found in %)', p.proname;
    END IF;
  END LOOP;

  -- I4. A client never executes a server act; the server never executes an owner command.
  FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname IN ('shared_knowledge_private', 'public')
              AND pr.proname IN ('propose_shared_knowledge_request_v1', 'list_shared_knowledge_for_reply_v1', 'resolve_shared_knowledge_item_v1',
                                 'cool_down_shared_knowledge_v1', 'complete_shared_world_qandeel_reply_v2') LOOP
    IF has_function_privilege('authenticated', p.sig, 'EXECUTE') OR has_function_privilege('anon', p.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'S8A-04 CP3: a client must not execute %', p.sig;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'service_role') THEN
    FOR p IN SELECT pr.oid::regprocedure AS sig FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname IN ('shared_knowledge_private', 'public')
                AND pr.proname IN ('list_own_shared_knowledge_v1', 'answer_own_shared_knowledge_request_v1',
                                   'allow_own_shared_knowledge_v1', 'revoke_own_shared_knowledge_v1') LOOP
      IF has_function_privilege('service_role', p.sig, 'EXECUTE') THEN
        RAISE EXCEPTION 'S8A-04 CP3: the server must not execute the owner''s command %', p.sig;
      END IF;
    END LOOP;
  END IF;

  -- I5. The frozen QANDEEL core keeps its ACL, and the frozen v1 reply commit is unchanged in signature and grants.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r,
         'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])', 'EXECUTE') THEN
      RAISE EXCEPTION 'S8A-04 CP3: % must not execute the frozen QANDEEL core', r;
    END IF;
  END LOOP;
END$$;

COMMIT;
