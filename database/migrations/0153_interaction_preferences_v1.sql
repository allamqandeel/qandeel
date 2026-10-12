-- IP-IMP-01 - Interaction Preferences v1.
--
-- Product authority: the Product Owner's IP-IMP-01 R1 Task Contract (FINAL PRODUCT OWNER APPROVAL, D-SP Option A) and
-- the Product decisions IP-01..IP-10 it carries. This migration is that task's database part, and nothing more.
--
-- ## What is added
--
--   1. public.interaction_preferences - ONE owner-only canonical record per account holding the four durable
--      interaction preferences the owner explicitly declared: reply length, reply language / dialect, humour and
--      explanation style. `DEFAULT` means "no durable declaration" (Automatic); no row means every field is DEFAULT and
--      the record's version is 0. Every value is closed by a CHECK. The row carries a version for compare-and-set.
--   2. interaction_preference_private.apply_v1 - the ONE write core. One field per call, under the owner's advisory
--      lock: a value already held answers UNCHANGED (an idempotent replay of a committed change changes nothing); a
--      different value under a version the caller did not read answers STALE (a stale command never overwrites a newer
--      value); otherwise the field changes, the version advances by one and the answer is SAVED. DEFAULT is the reset.
--   3. The owner's Settings command: public.set_own_interaction_preference_v1 (SECURITY INVOKER pass-through to a
--      SECURITY DEFINER function in the non-exposed private schema). The caller is `auth.uid()` and nothing else.
--   4. The owner's legacy review command: public.apply_own_legacy_interaction_preference_v1. It re-validates AT COMMIT
--      that the named Memory is the caller's, ACTIVE, unexpired, an INTERACTION_PREFERENCE and attributed SELF (0152),
--      locks it FOR SHARE, and only then applies the chosen value through the same core. The Memory itself is never
--      changed, deleted or rewritten, and nothing is copied from Memory without the owner's explicit choice.
--   5. The conversation command: public.server_finalize_interaction_preference_turn_v1 (service_role only). In ONE
--      transaction it locks the GENERATING source turn, applies the change through the same core and finalizes the turn
--      through finalize_conversation_turn_v2 with the reply for the outcome actually committed (SAVED / UNCHANGED /
--      STALE), so the change and the reply that reports it exist together or not at all. A turn that is no longer
--      GENERATING (a replay, a recovered or cancelled turn) writes nothing and returns no row.
--   6. Export My Data (0130): build_personal_export_v1 is re-stated with ONE added section, `interactionPreferences`,
--      in readable words. Every other line of the 0130 body is unchanged.
--
-- ## What is deliberately NOT here
--
--   * No command log table, no Memory write, no Memory type, no backfill and no change to any Memory function: the
--     record is the only durable preference authority, and Memory keeps every MEM-AR-01 guarantee unchanged.
--   * No inference: nothing here derives a preference from anything the owner did not explicitly choose.
--   * No Shared or Public object reads this table. Personal preferences never enter a Shared or Public model input.
--
-- ## Erasure
--
-- The table names its account with `user_id REFERENCES public.users (id) ON DELETE CASCADE`: the governed Personal
-- erasure (0130), which deletes `public.users` last, leaves no row behind.
--
-- Forward-only. Migrations 0001-0152 are byte-unchanged.
BEGIN;

CREATE SCHEMA interaction_preference_private;
REVOKE ALL ON SCHEMA interaction_preference_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The canonical record.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.interaction_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  reply_length text NOT NULL DEFAULT 'DEFAULT',
  reply_language text NOT NULL DEFAULT 'DEFAULT',
  humour text NOT NULL DEFAULT 'DEFAULT',
  explanation_style text NOT NULL DEFAULT 'DEFAULT',
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT interaction_preferences_reply_length_check CHECK (reply_length IN ('DEFAULT', 'ALWAYS_BRIEF')),
  CONSTRAINT interaction_preferences_reply_language_check CHECK (reply_language IN ('DEFAULT', 'EGYPTIAN_ARABIC',
    'MODERN_STANDARD_ARABIC', 'LEVANTINE_ARABIC', 'GULF_ARABIC', 'MAGHREBI_ARABIC', 'ENGLISH')),
  CONSTRAINT interaction_preferences_humour_check CHECK (humour IN ('DEFAULT', 'WELCOME', 'DECLINED')),
  CONSTRAINT interaction_preferences_explanation_style_check CHECK (explanation_style IN ('DEFAULT', 'SIMPLER', 'DIRECT',
    'SIMPLER_AND_DIRECT')),
  CONSTRAINT interaction_preferences_version_check CHECK (version >= 0)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The ONE write core. Not executable by any application role; the three entry points below call it as its owner.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION interaction_preference_private.apply_v1(
  p_user_id uuid, p_field text, p_value text, p_expected_version integer)
RETURNS TABLE (outcome text, version integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.interaction_preferences;
  current_value text;
  current_version integer := 0;
  next_version integer;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INTERACTION_PREFERENCE_OWNER_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_expected_version IS NULL OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'INVALID_INTERACTION_PREFERENCE_VERSION' USING ERRCODE = '22023'; END IF;
  IF NOT ((p_field = 'REPLY_LENGTH' AND p_value IN ('DEFAULT', 'ALWAYS_BRIEF'))
       OR (p_field = 'REPLY_LANGUAGE' AND p_value IN ('DEFAULT', 'EGYPTIAN_ARABIC', 'MODERN_STANDARD_ARABIC',
             'LEVANTINE_ARABIC', 'GULF_ARABIC', 'MAGHREBI_ARABIC', 'ENGLISH'))
       OR (p_field = 'HUMOUR' AND p_value IN ('DEFAULT', 'WELCOME', 'DECLINED'))
       OR (p_field = 'EXPLANATION_STYLE' AND p_value IN ('DEFAULT', 'SIMPLER', 'DIRECT', 'SIMPLER_AND_DIRECT'))) THEN
    RAISE EXCEPTION 'INVALID_INTERACTION_PREFERENCE' USING ERRCODE = '22023';
  END IF;

  -- One writer at a time per owner, so a first write and a concurrent first write never race on the absent row.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel:interaction-preferences:' || p_user_id::text, 0));
  SELECT * INTO current_row FROM public.interaction_preferences p WHERE p.user_id = p_user_id FOR UPDATE;
  IF FOUND THEN
    current_version := current_row.version;
    current_value := CASE p_field WHEN 'REPLY_LENGTH' THEN current_row.reply_length
                                  WHEN 'REPLY_LANGUAGE' THEN current_row.reply_language
                                  WHEN 'HUMOUR' THEN current_row.humour
                                  ELSE current_row.explanation_style END;
  ELSE
    current_value := 'DEFAULT';
  END IF;

  IF current_value = p_value THEN RETURN QUERY SELECT 'UNCHANGED'::text, current_version; RETURN; END IF;
  IF current_version <> p_expected_version THEN RETURN QUERY SELECT 'STALE'::text, current_version; RETURN; END IF;

  next_version := current_version + 1;
  INSERT INTO public.interaction_preferences AS p (user_id, reply_length, reply_language, humour, explanation_style, version, updated_at)
    VALUES (p_user_id,
            CASE WHEN p_field = 'REPLY_LENGTH' THEN p_value ELSE 'DEFAULT' END,
            CASE WHEN p_field = 'REPLY_LANGUAGE' THEN p_value ELSE 'DEFAULT' END,
            CASE WHEN p_field = 'HUMOUR' THEN p_value ELSE 'DEFAULT' END,
            CASE WHEN p_field = 'EXPLANATION_STYLE' THEN p_value ELSE 'DEFAULT' END,
            next_version, CURRENT_TIMESTAMP)
  ON CONFLICT (user_id) DO UPDATE SET
    reply_length = CASE WHEN p_field = 'REPLY_LENGTH' THEN p_value ELSE p.reply_length END,
    reply_language = CASE WHEN p_field = 'REPLY_LANGUAGE' THEN p_value ELSE p.reply_language END,
    humour = CASE WHEN p_field = 'HUMOUR' THEN p_value ELSE p.humour END,
    explanation_style = CASE WHEN p_field = 'EXPLANATION_STYLE' THEN p_value ELSE p.explanation_style END,
    version = next_version,
    updated_at = CURRENT_TIMESTAMP;
  RETURN QUERY SELECT 'SAVED'::text, next_version;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. The owner's Settings command.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION interaction_preference_private.set_own_interaction_preference_v1(
  p_field text, p_value text, p_expected_version integer)
RETURNS TABLE (outcome text, version integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT c.outcome, c.version FROM interaction_preference_private.apply_v1(v_user, p_field, p_value, p_expected_version) c;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The owner's legacy review command: an explicit choice to adopt what one of the owner's own SELF Memories says.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION interaction_preference_private.apply_own_legacy_interaction_preference_v1(
  p_memory_id uuid, p_field text, p_value text, p_expected_version integer)
RETURNS TABLE (outcome text, version integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_version integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_INTERACTION_PREFERENCE_SOURCE' USING ERRCODE = '22023'; END IF;
  -- Re-validated at commit, under a share lock a concurrent forget / disable / correct must wait for.
  PERFORM 1 FROM public.memories m
    WHERE m.id = p_memory_id AND m.user_id = v_user AND m.status = 'ACTIVE' AND m.type = 'INTERACTION_PREFERENCE'
      AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
      AND public.memory_subject_v1(v_user, m.id) = 'SELF'
    FOR SHARE OF m;
  IF NOT FOUND THEN
    SELECT p.version INTO v_version FROM public.interaction_preferences p WHERE p.user_id = v_user;
    RETURN QUERY SELECT 'NOT_ELIGIBLE'::text, coalesce(v_version, 0);
    RETURN;
  END IF;
  RETURN QUERY SELECT c.outcome, c.version FROM interaction_preference_private.apply_v1(v_user, p_field, p_value, p_expected_version) c;
END;$$;

-- The exposed Product RPCs: SECURITY INVOKER pass-throughs, so no command takes an account parameter.
CREATE FUNCTION public.set_own_interaction_preference_v1(p_field text, p_value text, p_expected_version integer)
RETURNS TABLE (outcome text, version integer) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome, c.version FROM interaction_preference_private.set_own_interaction_preference_v1(p_field, p_value, p_expected_version) c;
$$;
CREATE FUNCTION public.apply_own_legacy_interaction_preference_v1(p_memory_id uuid, p_field text, p_value text, p_expected_version integer)
RETURNS TABLE (outcome text, version integer) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome, c.version FROM interaction_preference_private.apply_own_legacy_interaction_preference_v1(p_memory_id, p_field, p_value, p_expected_version) c;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. The conversation command, committed with its reply.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_finalize_interaction_preference_turn_v1(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_assistant_turn_id uuid,
  p_field text, p_value text, p_expected_version integer,
  p_reply_if_saved text, p_reply_if_unchanged text, p_reply_if_stale text,
  p_event_id uuid, p_correlation_id uuid DEFAULT NULL, p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE (outcome text, version integer, user_turn jsonb, assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  applied text;
  applied_version integer;
  reply text;
  finalized_user jsonb;
  finalized_assistant jsonb;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
  THEN RAISE EXCEPTION 'INVALID_INTERACTION_PREFERENCE_IDENTITY' USING ERRCODE = '22023'; END IF;
  IF p_reply_if_saved IS NULL OR length(btrim(p_reply_if_saved)) = 0
     OR p_reply_if_unchanged IS NULL OR length(btrim(p_reply_if_unchanged)) = 0
     OR p_reply_if_stale IS NULL OR length(btrim(p_reply_if_stale)) = 0
  THEN RAISE EXCEPTION 'INVALID_INTERACTION_PREFERENCE_REPLY' USING ERRCODE = '22023'; END IF;

  -- Lock order: the source turn first, then (inside the core) the owner's preference lock and row.
  PERFORM 1 FROM public.conversation_turns t
    WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id AND t.role = 'USER'
      AND t.status = 'GENERATING'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT c.outcome, c.version INTO applied, applied_version
    FROM interaction_preference_private.apply_v1(p_user_id, p_field, p_value, p_expected_version) c;
  reply := CASE applied WHEN 'SAVED' THEN p_reply_if_saved WHEN 'UNCHANGED' THEN p_reply_if_unchanged ELSE p_reply_if_stale END;

  SELECT f.user_turn, f.assistant_turn INTO finalized_user, finalized_assistant FROM public.finalize_conversation_turn_v2(
    p_session_id, p_user_id, p_source_turn_id, p_assistant_turn_id, reply, 'ALLOW',
    p_event_id, p_correlation_id, p_orchestration_id, NULL) f;
  -- The source turn is locked GENERATING above, so this cannot happen; if it ever did, nothing above may survive.
  IF finalized_user IS NULL THEN RAISE EXCEPTION 'INTERACTION_PREFERENCE_TURN_NOT_FINALIZED' USING ERRCODE = '55000'; END IF;

  RETURN QUERY SELECT applied, applied_version, finalized_user, finalized_assistant;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Export My Data: the 0130 body, re-stated with the one added `interactionPreferences` section.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION personal_data_private.build_personal_export_v1(p_subject uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'format', 'qandeel.personal-data-export.v1',
        'preparedAt', clock_timestamp(),
        'account', (
            SELECT jsonb_build_object(
                'name', u.name,
                'loginId', u.login_id,
                'publicId', u.public_id,
                'accountCreatedAt', u.created_at)
              FROM public.users u WHERE u.id = p_subject),
        'conversations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'startedAt', s.created_at,
                       'lastActivityAt', s.last_activity_at,
                       'turns', coalesce((
                           SELECT jsonb_agg(jsonb_build_object(
                                      'speaker', CASE t.role WHEN 'USER' THEN 'you' ELSE 'qandeel' END,
                                      'text', t.content,
                                      'at', t.created_at,
                                      'state', lower(t.status))
                                  ORDER BY t.created_at, t.id)
                             FROM public.conversation_turns t
                            WHERE t.session_id = s.id AND t.user_id = p_subject
                              AND (t.role = 'USER' OR (t.role = 'ASSISTANT' AND t.status = 'COMPLETED'))), '[]'::jsonb))
                   ORDER BY s.created_at, s.id)
              FROM public.conversation_sessions s WHERE s.user_id = p_subject), '[]'::jsonb),
        'memory', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'text', m.content,
                       'kind', lower(m.type),
                       'state', CASE m.status WHEN 'ACTIVE' THEN 'active'
                                              WHEN 'DISABLED' THEN 'not relied on'
                                              WHEN 'DELETED' THEN 'forgotten'
                                              WHEN 'SUPERSEDED' THEN 'replaced by a correction'
                                              ELSE lower(m.status) END,
                       'rememberedAt', m.created_at,
                       'lastChangedAt', m.updated_at,
                       'expiresAt', m.expires_at)
                   ORDER BY m.created_at, m.id)
              FROM public.memories m WHERE m.user_id = p_subject), '[]'::jsonb),
        'understanding', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'statement', h.statement,
                       'status', CASE WHEN h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN 'current'
                                      WHEN h.status = 'REOPENED' THEN 'being reconsidered'
                                      ELSE 'withdrawn' END,
                       'firstFormedAt', h.created_at,
                       'lastChangedAt', h.updated_at,
                       'yourDisagreements', coalesce((
                           SELECT jsonb_agg(c.created_at ORDER BY c.created_at)
                             FROM public.understanding_contests c
                            WHERE c.hypothesis_id = h.id AND c.user_id = p_subject), '[]'::jsonb))
                   ORDER BY h.created_at, h.id)
              FROM public.hypotheses h
             WHERE h.user_id = p_subject
               -- Only an interpretation the owner could have been shown: current now (the statuses the Understanding
               -- surface lists), or current at some point before it was reconsidered or withdrawn. A CANDIDATE, or one
               -- withdrawn before it was ever admitted, is QANDEEL's own unshown reasoning (hypothesis restraint).
               AND (h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK')
                    OR (h.status IN ('REOPENED', 'REJECTED', 'RETIRED')
                        AND EXISTS (SELECT 1 FROM public.hypothesis_lifecycle_transitions t
                                     WHERE t.hypothesis_id = h.id AND t.user_id = p_subject
                                       AND t.after_status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK'))))), '[]'::jsonb),
        -- IP-IMP-01 (0153): the owner's four durable interaction preferences, in readable words. No row: all automatic.
        'interactionPreferences', (
            SELECT jsonb_build_object(
                       'replyLength', CASE coalesce(p.reply_length, 'DEFAULT') WHEN 'ALWAYS_BRIEF' THEN 'always brief' ELSE 'automatic' END,
                       'replyLanguage', CASE coalesce(p.reply_language, 'DEFAULT')
                                            WHEN 'EGYPTIAN_ARABIC' THEN 'Egyptian Arabic'
                                            WHEN 'MODERN_STANDARD_ARABIC' THEN 'Modern Standard Arabic'
                                            WHEN 'LEVANTINE_ARABIC' THEN 'Levantine Arabic'
                                            WHEN 'GULF_ARABIC' THEN 'Gulf Arabic'
                                            WHEN 'MAGHREBI_ARABIC' THEN 'Maghrebi Arabic'
                                            WHEN 'ENGLISH' THEN 'English'
                                            ELSE 'automatic' END,
                       'humour', CASE coalesce(p.humour, 'DEFAULT') WHEN 'WELCOME' THEN 'welcome' WHEN 'DECLINED' THEN 'no humour' ELSE 'automatic' END,
                       'explanationStyle', CASE coalesce(p.explanation_style, 'DEFAULT')
                                               WHEN 'SIMPLER' THEN 'simpler'
                                               WHEN 'DIRECT' THEN 'direct'
                                               WHEN 'SIMPLER_AND_DIRECT' THEN 'simple and direct'
                                               ELSE 'automatic' END,
                       'lastChangedAt', p.updated_at)
              FROM (SELECT 1) AS one LEFT JOIN public.interaction_preferences p ON p.user_id = p_subject),
        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay', 'introductions'));
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Privileges, every one explicit (0133 removed the hosted default privileges; nothing here relies on a default).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.interaction_preferences OWNER TO postgres;
ALTER TABLE public.interaction_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.interaction_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.interaction_preferences TO authenticated;
CREATE POLICY interaction_preferences_select_own ON public.interaction_preferences
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

ALTER FUNCTION interaction_preference_private.apply_v1(uuid, text, text, integer) OWNER TO postgres;
ALTER FUNCTION interaction_preference_private.set_own_interaction_preference_v1(text, text, integer) OWNER TO postgres;
ALTER FUNCTION interaction_preference_private.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer) OWNER TO postgres;
ALTER FUNCTION public.set_own_interaction_preference_v1(text, text, integer) OWNER TO postgres;
ALTER FUNCTION public.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer) OWNER TO postgres;
ALTER FUNCTION public.server_finalize_interaction_preference_turn_v1(uuid, uuid, uuid, uuid, text, text, integer, text, text, text, uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION personal_data_private.build_personal_export_v1(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  interaction_preference_private.apply_v1(uuid, text, text, integer),
  interaction_preference_private.set_own_interaction_preference_v1(text, text, integer),
  interaction_preference_private.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer),
  public.set_own_interaction_preference_v1(text, text, integer),
  public.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer),
  public.server_finalize_interaction_preference_turn_v1(uuid, uuid, uuid, uuid, text, text, integer, text, text, text, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  -- The server channel reads no preference directly and runs no owner command: it finalizes a conversation command only.
  EXECUTE 'REVOKE ALL ON TABLE public.interaction_preferences FROM service_role';
  EXECUTE 'REVOKE ALL ON SCHEMA interaction_preference_private FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION interaction_preference_private.apply_v1(uuid, text, text, integer), interaction_preference_private.set_own_interaction_preference_v1(text, text, integer), interaction_preference_private.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer), public.set_own_interaction_preference_v1(text, text, integer), public.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_finalize_interaction_preference_turn_v1(uuid, uuid, uuid, uuid, text, text, integer, text, text, text, uuid, uuid, uuid) TO service_role';
END IF; END$$;

GRANT USAGE ON SCHEMA interaction_preference_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  interaction_preference_private.set_own_interaction_preference_v1(text, text, integer),
  interaction_preference_private.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer),
  public.set_own_interaction_preference_v1(text, text, integer),
  public.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Deploy-time self-assertions: the migration refuses to leave a client write, an anon privilege, a reachable core
--    or a server command a client could run.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.interaction_preferences', 'SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated', 'public.interaction_preferences', 'INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION '0153: a client role can write the preference record or anon can read it';
  END IF;
  IF has_function_privilege('authenticated', 'interaction_preference_private.apply_v1(uuid, text, text, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'interaction_preference_private.apply_v1(uuid, text, text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '0153: a client role can run the write core with an account parameter';
  END IF;
  IF has_function_privilege('authenticated', 'public.server_finalize_interaction_preference_turn_v1(uuid, uuid, uuid, uuid, text, text, integer, text, text, text, uuid, uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.server_finalize_interaction_preference_turn_v1(uuid, uuid, uuid, uuid, text, text, integer, text, text, text, uuid, uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0153: a client role can run the server conversation command';
  END IF;
  IF has_function_privilege('anon', 'public.set_own_interaction_preference_v1(text, text, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.apply_own_legacy_interaction_preference_v1(uuid, text, text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '0153: anon can run an owner command';
  END IF;
END$$;

COMMIT;
