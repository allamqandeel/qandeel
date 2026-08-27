-- Foreground GENERATING Turn Recovery v1 (Reliability Correction 1 of the
-- bounded post-review Reliability Correction Pass).
--
-- Confirmed defect (Codex + Claude Code System-Wide Architecture Review): a
-- process crash after the atomic RECEIVED -> GENERATING claim leaves the
-- canonical USER turn GENERATING forever. The orchestrator's in-process catch
-- cannot run after a crash, claim_conversation_turn only accepts RECEIVED, and
-- an idempotent replay finds the same nonterminal turn with no escape except
-- explicit client cancellation.
--
-- Because a crashed foreground generation may have already reached the
-- external model provider, QANDEEL must never automatically re-run the same
-- foreground generation (duplicate external call, different response). The v1
-- policy is therefore fail-closed terminalization, never regeneration:
--
--   uncertain crashed foreground generation
--   -> wait until lease expiry
--   -> canonical GENERATING -> FAILED with the existing ConversationTurnFailed
--      v1 outbox event in the SAME transaction
--   -> no replay; a genuine retry is a NEW turn / NEW idempotency admission.
--
-- This forward-only migration adds:
--   * two server-owned generation lease columns with a bounded pair-integrity
--     constraint (legacy/null-lease GENERATING rows stay representable);
--   * the single frozen v1 lease constant (120 seconds) as one SQL function so
--     the value exists in exactly one place and application code never owns it;
--   * a safe deployment backfill that gives any pre-existing GENERATING row at
--     least one fresh 120-second recovery window from migration time;
--   * claim_conversation_turn replaced with the same external signature and
--     authority/routing rules plus lease assignment on the successful claim;
--   * recover_expired_generating_conversation_turn_v1 — a narrow
--     service-role-only command that terminalizes an expired GENERATING turn
--     to FAILED atomically with its outbox event, creates no assistant, calls
--     no model, and is a strict no-op on live leases and terminal rows.
-- Migrations 0001-0038 remain byte-exact; history files are left untouched.

BEGIN;

-- 1. Server-owned generation lease metadata. These columns are runtime
--    authority state, never user input: no client mutation path exists
--    (migration 0025 removed every direct role write on conversation_turns)
--    and the ordinary application projection does not expose them.
ALTER TABLE public.conversation_turns
  ADD COLUMN generation_claimed_at timestamptz,
  ADD COLUMN generation_lease_expires_at timestamptz;

-- Bounded pair integrity: both NULL (legacy/no active claim metadata) or both
-- set with a strictly forward-moving lease. Historical and verifier-created
-- GENERATING fixtures with NULL lease metadata remain valid at schema level;
-- the recovery command owns their bounded fallback semantics.
ALTER TABLE public.conversation_turns
  ADD CONSTRAINT conversation_turns_generation_lease_pair_check CHECK (
    (generation_claimed_at IS NULL AND generation_lease_expires_at IS NULL) OR
    (generation_claimed_at IS NOT NULL AND generation_lease_expires_at IS NOT NULL
      AND generation_lease_expires_at > generation_claimed_at)
  );

-- 2. The frozen v1 foreground generation lease: exactly 120 seconds. This is
--    canonical foreground state-machine policy, not provider authority: there
--    is no environment override, request/JWT field, user-configurable value,
--    or provider-specific duration, and application code never chooses it.
--    This function is the ONE place the value is defined.
CREATE FUNCTION public.foreground_generation_lease_interval_v1() RETURNS interval
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT interval '120 seconds'
$$;

-- 3. Safe deployment backfill. A pre-existing canonical GENERATING row must
--    not expire merely because this migration deployed: it keeps its bounded
--    historical claim instant (updated_at, the moment its claim mutation was
--    stamped) and receives at least one fresh 120-second recovery window from
--    migration time. Rows not in GENERATING are not fabricated as active
--    leases.
UPDATE public.conversation_turns
  SET generation_claimed_at = updated_at,
      generation_lease_expires_at = greatest(
        updated_at + public.foreground_generation_lease_interval_v1(),
        CURRENT_TIMESTAMP + public.foreground_generation_lease_interval_v1())
  WHERE status = 'GENERATING' AND generation_claimed_at IS NULL;

-- 4. Same-signature claim replacement: identical service-role-only authority,
--    explicit session/user/source ownership, USER role, RECEIVED state, exact
--    FAST/DEEP routing-reason contract and one-claimant-wins row lock as
--    migration 0025 — plus the server-owned lease stamped on the one
--    successful RECEIVED -> GENERATING transition. No claim token exists:
--    this task never reclaims execution.
CREATE OR REPLACE FUNCTION public.claim_conversation_turn(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_processing_path text, p_routing_reason text
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023'; END IF;
  IF NOT((p_processing_path='FAST' AND p_routing_reason='FAST_DEFAULT')
      OR (p_processing_path='DEEP' AND p_routing_reason='INPUT_LENGTH_REQUIRES_DEEP_CONTEXT')) THEN
    RAISE EXCEPTION 'INVALID_ROUTING' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO source_row FROM public.conversation_turns
    WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='RECEIVED'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.conversation_turns
    SET status='GENERATING',processing_path=p_processing_path,routing_reason=p_routing_reason,
        generation_claimed_at=CURRENT_TIMESTAMP,
        generation_lease_expires_at=CURRENT_TIMESTAMP+public.foreground_generation_lease_interval_v1(),
        updated_at=CURRENT_TIMESTAMP
    WHERE id=p_source_turn_id RETURNING * INTO source_row;
  RETURN NEXT source_row;
END;$$;

-- 5. Narrow fail-closed recovery. Lease expiry means terminalization, never
--    regeneration: the command locks the exact owner-scoped GENERATING USER
--    source turn, is a strict no-op while the lease is live, and on expiry
--    performs exactly GENERATING -> FAILED atomically with the existing
--    canonical content-free ConversationTurnFailed v1 outbox event. It never
--    calls a model, returns no provider content, changes no idempotency key,
--    creates no replacement USER or ASSISTANT turn, and never moves any turn
--    back to RECEIVED. completed_at keeps the canonical
--    fail_conversation_turn semantics (it stays NULL for FAILED). Race safety
--    is the database row lock plus the current-state predicate: whichever of
--    finalize/fail/cancel/recovery commits first wins and every later command
--    is a no-op, so a recovered FAILED source turn can never gain a late
--    assistant completion and no duplicate terminal outbox event can exist
--    (structurally reinforced by the outbox UNIQUE(event_type,
--    subject_turn_id) constraint).
CREATE FUNCTION public.recover_expired_generating_conversation_turn_v1(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid,
  p_event_id uuid, p_correlation_id uuid DEFAULT NULL, p_orchestration_id uuid DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns; lease_claimed_at timestamptz; lease_expires_at timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO source_row FROM public.conversation_turns
    WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Authoritative expiry: the server-owned lease when present; for
  -- legacy/null-lease rows the bounded fallback is updated_at plus the one
  -- frozen lease interval. Both are fail-closed: nothing expires early.
  lease_claimed_at := COALESCE(source_row.generation_claimed_at, source_row.updated_at);
  lease_expires_at := COALESCE(source_row.generation_lease_expires_at,
                               source_row.updated_at + public.foreground_generation_lease_interval_v1());
  IF lease_expires_at > CURRENT_TIMESTAMP THEN RETURN; END IF;
  UPDATE public.conversation_turns
    SET status='FAILED',
        generation_claimed_at=lease_claimed_at,
        generation_lease_expires_at=lease_expires_at,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=p_source_turn_id RETURNING * INTO source_row;
  INSERT INTO public.runtime_event_outbox(event_id,event_type,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
  VALUES(p_event_id,'ConversationTurnFailed',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-failed.v1',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','FAILED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id));
  RETURN NEXT source_row;
END;$$;

-- 6. Ownership, search_path hardening, and least-privilege ACLs. Recovery is
--    service-role-only exactly like claim/finalize/fail; the lease constant is
--    internal (definer functions execute it with owner rights). Because
--    CREATE OR REPLACE preserves any drifted privileges, the
--    claim_conversation_turn service-role-only authority from migration 0025
--    is explicitly restored and re-asserted.
ALTER FUNCTION public.foreground_generation_lease_interval_v1() OWNER TO postgres;
ALTER FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) OWNER TO postgres;
ALTER FUNCTION public.recover_expired_generating_conversation_turn_v1(uuid,uuid,uuid,uuid,uuid,uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.foreground_generation_lease_interval_v1() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.recover_expired_generating_conversation_turn_v1(uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_expired_generating_conversation_turn_v1(uuid,uuid,uuid,uuid,uuid,uuid) TO service_role;

COMMIT;
