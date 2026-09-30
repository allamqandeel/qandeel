-- W3-MEGA-M — Conversational Memory Control & Trust (E2E-D-13).
--
-- P1 §9 froze the Product rule: there is no Memory editor in v1; the user asks IN CONVERSATION what QANDEEL
-- remembers, asks it to remember something, corrects a remembered fact, asks it to forget one, or asks it to keep one
-- but stop relying on it — all under the existing Memory Runtime authority (supersession, the DISABLED / DELETED
-- lifecycle, the explicit-remember write path, user scope). Memory is not QANDEEL Understanding; nothing here touches
-- the Hypothesis, Confidence or Understanding runtimes.
--
-- This migration adds exactly what that rule needed and did not have:
--
--   1. `server_disable_memory_v1` — the missing narrow DISABLED primitive. The vocabulary has carried DISABLED since
--      migration 0004, but no authority could reach it. Owner-bound, row-locked, status-only: an ACTIVE unexpired row
--      becomes DISABLED; an already DISABLED row is answered unchanged (convergent); anything else — another reader's
--      row, a missing row, a superseded / deleted / expired / pending row — answers nothing. Content, provenance,
--      scores, version and lineage never move. There is still no generic status updater.
--   2. `memory_control_commands` — ONE immutable, owner-only record per conversational Memory command, bound to the
--      committed user turn that asked for it (`UNIQUE (source_turn_id)`). It stores ids and a bounded outcome only:
--      no Memory content, no conversation text, no reasoning, no score.
--   3. `server_finalize_memory_control_turn_v1` — the ONE atomic command. In a single transaction it locks the
--      canonical GENERATING user turn, re-validates the target Memory under its row lock, applies the change through
--      the existing narrow authorities (create 0026, supersede 0026, mark-deleted 0026, disable above), records the
--      command, and finalizes the turn through the canonical `finalize_conversation_turn_v2` (0063) with the reply
--      that reports the OUTCOME ACTUALLY COMMITTED. The Memory change and the reply that describes it commit together
--      or not at all: there is no state in which Memory changed but the conversation shows no reply for it, or a
--      reply claims a change that did not happen. A turn that is no longer GENERATING (replayed, recovered, cancelled,
--      foreign) writes nothing and answers nothing.
--   4. `pending_memory_clarification_v1` — an owner-token (SECURITY INVOKER, RLS) read of the clarification the
--      IMMEDIATELY preceding user turn received, so "the second one" can answer "which one do you mean?", together with
--      the words of the request that first asked (a question asked again keeps them).
--
-- Additive and forward-only. Migrations 0001–0127 are untouched.
BEGIN;

-- 1. The missing DISABLED primitive.
CREATE FUNCTION public.server_disable_memory_v1(p_user_id uuid, p_memory_id uuid)
RETURNS SETOF public.memories
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.memories;
BEGIN
  IF p_user_id IS NULL OR p_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY' USING ERRCODE='22023'; END IF;
  SELECT * INTO target FROM public.memories m WHERE m.id=p_memory_id AND m.user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF target.status='DISABLED' THEN RETURN NEXT target; RETURN; END IF;
  IF target.status<>'ACTIVE' OR (target.expires_at IS NOT NULL AND target.expires_at<=CURRENT_TIMESTAMP) THEN RETURN; END IF;
  UPDATE public.memories m SET status='DISABLED', updated_at=CURRENT_TIMESTAMP
    WHERE m.id=target.id AND m.user_id=p_user_id RETURNING * INTO target;
  RETURN NEXT target;
END;$$;

ALTER FUNCTION public.server_disable_memory_v1(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.server_disable_memory_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.server_disable_memory_v1(uuid,uuid) TO service_role;

-- 2. The durable command record.
CREATE TABLE public.memory_control_commands (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL REFERENCES public.conversation_turns(id) ON DELETE RESTRICT,
  kind text NOT NULL,
  outcome text NOT NULL,
  target_memory_id uuid,
  result_memory_id uuid,
  candidate_memory_ids uuid[] NOT NULL DEFAULT '{}',
  answers_command_id uuid REFERENCES public.memory_control_commands(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT memory_control_commands_session_fk FOREIGN KEY (session_id, user_id)
    REFERENCES public.conversation_sessions(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT memory_control_commands_target_fk FOREIGN KEY (target_memory_id, user_id)
    REFERENCES public.memories(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT memory_control_commands_result_fk FOREIGN KEY (result_memory_id, user_id)
    REFERENCES public.memories(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT memory_control_commands_source_turn_key UNIQUE (source_turn_id),
  CONSTRAINT memory_control_commands_answers_key UNIQUE (answers_command_id),
  CONSTRAINT memory_control_commands_kind_check CHECK (kind IN ('INSPECT','REMEMBER','CORRECT','FORGET','DISABLE')),
  CONSTRAINT memory_control_commands_candidates_check CHECK (
    cardinality(candidate_memory_ids) <= 3 AND array_position(candidate_memory_ids, NULL) IS NULL),
  -- Every outcome has exactly one lawful shape, per kind.
  CONSTRAINT memory_control_commands_shape_check CHECK (
    (kind='INSPECT' AND outcome IN ('INSPECTED','NOTHING_REMEMBERED')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome='REMEMBERED'
      AND target_memory_id IS NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome IN ('ALREADY_REMEMBERED','DECLINED_SENSITIVE')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='CORRECT' AND outcome='CORRECTED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind='CORRECT' AND outcome IN ('ALREADY_CORRECT','DECLINED_SENSITIVE')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('FORGET','DISABLE') AND outcome IN ('FORGOTTEN','DISABLED')
      AND outcome=CASE kind WHEN 'FORGET' THEN 'FORGOTTEN' ELSE 'DISABLED' END
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('FORGET','DISABLE') AND outcome IN ('TARGET_NOT_FOUND','TARGET_NOT_SPECIFIED')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='CLARIFICATION_REQUIRED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids) BETWEEN 1 AND 3)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='TARGET_CHANGED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='CLARIFICATION_DECLINED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
  )
);

CREATE INDEX memory_control_commands_user_session_idx ON public.memory_control_commands (user_id, session_id, created_at DESC);

-- A recorded command is a fact: nothing may rewrite it afterwards.
CREATE FUNCTION public.memory_control_command_facts_immutable_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'MEMORY_CONTROL_COMMAND_IMMUTABLE' USING ERRCODE='42501';
END;$$;
ALTER FUNCTION public.memory_control_command_facts_immutable_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.memory_control_command_facts_immutable_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER memory_control_commands_facts_immutable
  BEFORE UPDATE ON public.memory_control_commands
  FOR EACH ROW EXECUTE FUNCTION public.memory_control_command_facts_immutable_v1();

ALTER TABLE public.memory_control_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.memory_control_commands FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.memory_control_commands FROM service_role';
END IF;END$$;
GRANT SELECT ON TABLE public.memory_control_commands TO authenticated;
CREATE POLICY memory_control_commands_select_own ON public.memory_control_commands
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- 3. The ONE atomic command: Memory change + command record + canonical finalization, together or not at all.
--
-- The caller is trusted server code, but it chooses no authority: source is always USER_STATED, status always
-- ACTIVE, owner / version / lineage / timestamps are derived by the narrow commands it calls, and every target and
-- candidate must belong to p_user_id. p_outcome is the INTENDED outcome; a targeted change whose target no longer
-- qualifies under its row lock commits TARGET_CHANGED instead, with p_reply_if_changed, and changes nothing.
CREATE FUNCTION public.server_finalize_memory_control_turn_v1(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_assistant_turn_id uuid,
  p_kind text, p_outcome text,
  p_target_memory_id uuid, p_new_memory_id uuid,
  p_type text, p_content text, p_confidence double precision, p_importance double precision, p_expires_at timestamptz,
  p_candidate_memory_ids uuid[], p_answers_command_id uuid,
  p_reply text, p_reply_if_changed text,
  p_event_id uuid, p_correlation_id uuid DEFAULT NULL, p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE(outcome text, user_turn jsonb, assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  source_row public.conversation_turns;
  previous_user_turn_id uuid;
  pending public.memory_control_commands;
  target public.memories;
  changed public.memories;
  applied text := p_outcome;
  reply text := p_reply;
  result_id uuid;
  candidates uuid[] := coalesce(p_candidate_memory_ids, '{}');
  finalized_user jsonb;
  finalized_assistant jsonb;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_IDENTITY' USING ERRCODE='22023'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('INSPECT','REMEMBER','CORRECT','FORGET','DISABLE') THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_KIND' USING ERRCODE='22023'; END IF;
  -- TARGET_CHANGED is decided here, never requested.
  IF p_outcome IS NULL OR p_outcome NOT IN (
    'INSPECTED','NOTHING_REMEMBERED','REMEMBERED','ALREADY_REMEMBERED','DECLINED_SENSITIVE','CORRECTED','ALREADY_CORRECT',
    'FORGOTTEN','DISABLED','TARGET_NOT_FOUND','TARGET_NOT_SPECIFIED','CLARIFICATION_REQUIRED','CLARIFICATION_DECLINED')
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_OUTCOME' USING ERRCODE='22023'; END IF;
  IF p_reply IS NULL OR length(btrim(p_reply))=0 THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;
  IF p_outcome IN ('CORRECTED','FORGOTTEN','DISABLED') AND (p_reply_if_changed IS NULL OR length(btrim(p_reply_if_changed))=0)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;

  -- Lock order: the source turn first, then the answered command, then the Memory row.
  SELECT * INTO source_row FROM public.conversation_turns t
    WHERE t.id=p_source_turn_id AND t.session_id=p_session_id AND t.user_id=p_user_id AND t.role='USER' AND t.status='GENERATING'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM unnest(candidates) c
              WHERE NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=c AND m.user_id=p_user_id))
     OR cardinality(candidates) <> (SELECT count(DISTINCT c) FROM unnest(candidates) c)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_CANDIDATES' USING ERRCODE='42501'; END IF;

  -- A follow-up answers exactly the clarification the immediately preceding user turn of this Session received, and
  -- may only pick one of the options that clarification offered.
  IF p_answers_command_id IS NOT NULL THEN
    SELECT t.id INTO previous_user_turn_id FROM public.conversation_turns t
      WHERE t.session_id=p_session_id AND t.user_id=p_user_id AND t.role='USER' AND t.status<>'CANCELLED' AND t.id<>source_row.id
        AND (t.created_at, t.id) < (source_row.created_at, source_row.id)
      ORDER BY t.created_at DESC, t.id DESC LIMIT 1;
    SELECT * INTO pending FROM public.memory_control_commands c
      WHERE c.id=p_answers_command_id AND c.user_id=p_user_id AND c.session_id=p_session_id
        AND c.outcome='CLARIFICATION_REQUIRED' AND c.kind=p_kind
      FOR UPDATE;
    IF NOT FOUND OR pending.source_turn_id IS DISTINCT FROM previous_user_turn_id
       OR (p_target_memory_id IS NOT NULL AND NOT (p_target_memory_id = ANY (pending.candidate_memory_ids)))
    THEN RAISE EXCEPTION 'INVALID_MEMORY_CLARIFICATION_ANSWER' USING ERRCODE='42501'; END IF;
  END IF;

  IF p_target_memory_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_TARGET' USING ERRCODE='42501'; END IF;

  IF p_outcome='REMEMBERED' THEN
    IF p_new_memory_id IS NULL OR p_target_memory_id IS NOT NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    SELECT * INTO changed FROM public.server_create_memory_v1(
      p_user_id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
    result_id := changed.id;
  ELSIF p_outcome='CORRECTED' THEN
    IF p_new_memory_id IS NULL OR p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    -- Only a current (ACTIVE, unexpired) Memory can be corrected; the supersede command re-checks ACTIVE under its
    -- own lock, and memories_one_successor_unique still forbids a second successor.
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id FOR UPDATE;
    IF target.status='ACTIVE' AND (target.expires_at IS NULL OR target.expires_at>CURRENT_TIMESTAMP) THEN
      SELECT * INTO changed FROM public.server_supersede_memory_v1(
        p_user_id, p_target_memory_id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
    END IF;
    IF changed.id IS NULL THEN applied := 'TARGET_CHANGED'; ELSE result_id := changed.id; END IF;
  ELSIF p_outcome='FORGOTTEN' THEN
    IF p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    -- Lifecycle deletion, never a physical DELETE. A row already DELETED means the asked-for state holds; a row that
    -- was superseded or expired meanwhile is no longer what the user named.
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id FOR UPDATE;
    IF target.status IN ('ACTIVE','DISABLED') THEN
      SELECT * INTO changed FROM public.server_mark_memory_deleted_v1(p_user_id, p_target_memory_id);
    ELSIF target.status='DELETED' THEN
      changed := target;
    END IF;
    IF changed.id IS NULL THEN applied := 'TARGET_CHANGED'; END IF;
  ELSIF p_outcome='DISABLED' THEN
    IF p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    SELECT * INTO changed FROM public.server_disable_memory_v1(p_user_id, p_target_memory_id);
    IF changed.id IS NULL THEN applied := 'TARGET_CHANGED'; END IF;
  ELSIF p_new_memory_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023';
  END IF;

  IF applied='TARGET_CHANGED' THEN reply := p_reply_if_changed; END IF;

  INSERT INTO public.memory_control_commands(
    id, user_id, session_id, source_turn_id, kind, outcome, target_memory_id, result_memory_id, candidate_memory_ids, answers_command_id)
  VALUES (
    gen_random_uuid(), p_user_id, p_session_id, p_source_turn_id, p_kind, applied,
    CASE WHEN applied IN ('CORRECTED','FORGOTTEN','DISABLED','TARGET_CHANGED') THEN p_target_memory_id END,
    result_id, candidates, p_answers_command_id);

  SELECT f.user_turn, f.assistant_turn INTO finalized_user, finalized_assistant FROM public.finalize_conversation_turn_v2(
    p_session_id, p_user_id, p_source_turn_id, p_assistant_turn_id, reply, 'ALLOW',
    p_event_id, p_correlation_id, p_orchestration_id, NULL) f;
  -- The source turn is locked GENERATING above, so this cannot happen; if it ever did, nothing above may survive.
  IF finalized_user IS NULL THEN RAISE EXCEPTION 'MEMORY_CONTROL_TURN_NOT_FINALIZED' USING ERRCODE='55000'; END IF;

  RETURN QUERY SELECT applied, finalized_user, finalized_assistant;
END;$$;

ALTER FUNCTION public.server_finalize_memory_control_turn_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,text,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.server_finalize_memory_control_turn_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.server_finalize_memory_control_turn_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,text,uuid,uuid,uuid) TO service_role;

-- 4. The owner-token read of a clarification still awaiting its answer. SECURITY INVOKER: RLS on both tables keeps it
--    to the caller's own rows. It answers only when the clarification belongs to the IMMEDIATELY preceding user turn of
--    the same Session and has not been answered.
CREATE FUNCTION public.pending_memory_clarification_v1(p_session_id uuid, p_source_turn_id uuid)
RETURNS TABLE(command_id uuid, kind text, candidate_memory_ids uuid[], clarified_turn_content text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH RECURSIVE current_turn AS (
    SELECT t.id, t.session_id, t.created_at FROM public.conversation_turns t
     WHERE t.id=p_source_turn_id AND t.session_id=p_session_id AND t.role='USER'
  ), previous_turn AS (
    SELECT t.id FROM public.conversation_turns t, current_turn cur
     WHERE t.session_id=cur.session_id AND t.role='USER' AND t.status<>'CANCELLED' AND t.id<>cur.id
       AND (t.created_at, t.id) < (cur.created_at, cur.id)
     ORDER BY t.created_at DESC, t.id DESC LIMIT 1
  ), pending AS (
    SELECT c.id, c.kind, c.candidate_memory_ids, c.answers_command_id, c.source_turn_id
      FROM public.memory_control_commands c JOIN previous_turn p ON p.id=c.source_turn_id
     WHERE c.session_id=p_session_id AND c.outcome='CLARIFICATION_REQUIRED'
       AND NOT EXISTS (SELECT 1 FROM public.memory_control_commands a WHERE a.answers_command_id=c.id)
  ), origin AS (
    -- A question asked again ("5" was not an option) answers the one before it; the words that asked for the change
    -- are those of the first request in that chain, so a later answer still knows what was asked, and in which language.
    SELECT pd.answers_command_id, pd.source_turn_id, 0 AS depth FROM pending pd
    UNION ALL
    SELECT c.answers_command_id, c.source_turn_id, o.depth + 1
      FROM public.memory_control_commands c JOIN origin o ON c.id=o.answers_command_id
     WHERE o.depth < 16
  )
  SELECT pd.id, pd.kind, pd.candidate_memory_ids, t.content
    FROM pending pd, origin o JOIN public.conversation_turns t ON t.id=o.source_turn_id
   WHERE o.answers_command_id IS NULL
$$;
ALTER FUNCTION public.pending_memory_clarification_v1(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pending_memory_clarification_v1(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pending_memory_clarification_v1(uuid,uuid) TO authenticated;

COMMIT;
