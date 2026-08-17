BEGIN;

ALTER TABLE conversation_turns
  ADD COLUMN routing_reason text,
  ADD COLUMN source_turn_id uuid;

ALTER TABLE conversation_turns
  ADD CONSTRAINT conversation_turns_source_fk
    FOREIGN KEY (source_turn_id) REFERENCES conversation_turns (id) ON DELETE RESTRICT,
  ADD CONSTRAINT conversation_turns_one_assistant_per_source UNIQUE (source_turn_id),
  ADD CONSTRAINT conversation_turns_routing_reason_check CHECK (
    (processing_path = 'FAST' AND routing_reason = 'FAST_DEFAULT') OR
    (processing_path = 'DEEP' AND routing_reason = 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT') OR
    (processing_path IS NULL AND routing_reason IS NULL)
  );

CREATE FUNCTION finalize_conversation_turn(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid,
  p_assistant_turn_id uuid, p_content text
) RETURNS TABLE (user_turn jsonb, assistant_turn jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE source_row conversation_turns; assistant_row conversation_turns;
BEGIN
  SELECT * INTO source_row FROM conversation_turns
   WHERE id = p_source_turn_id AND session_id = p_session_id AND user_id = p_user_id
     AND role = 'USER' AND status = 'GENERATING'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, source_turn_id, completed_at)
  VALUES (p_assistant_turn_id, p_session_id, p_user_id, 'ASSISTANT', 'COMPLETED', p_content,
          source_row.processing_path, source_row.routing_reason, p_source_turn_id, CURRENT_TIMESTAMP)
  RETURNING * INTO assistant_row;

  UPDATE conversation_turns SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
   WHERE id = p_source_turn_id RETURNING * INTO source_row;
  RETURN QUERY SELECT to_jsonb(source_row), to_jsonb(assistant_row);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_conversation_turn(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_conversation_turn(uuid, uuid, uuid, uuid, text) TO authenticated;

COMMIT;
