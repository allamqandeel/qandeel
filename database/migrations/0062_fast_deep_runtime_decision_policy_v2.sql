-- QIR-002 — FAST / DEEP Runtime Decision Policy v2 (durable routing authority).
--
-- Before this migration the legal FAST/DEEP route pairs were owned in THREE
-- independent places: the orchestrator's private input-length rule, the
-- persisted conversation_turns_routing_reason_check CHECK constraint created by
-- migration 0003, and the server-authoritative claim_conversation_turn gate
-- (migration 0025, replaced with identical routing rules by migration 0039).
-- All three accepted exactly two pairs:
--
--   FAST + 'FAST_DEFAULT'
--   DEEP + 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'
--
-- QIR-002 replaces the input-length-only policy with a deterministic,
-- Unicode-aware, provider-neutral structural policy whose five reasons are:
--
--   FAST + 'RUNTIME_ROUTING_V2_FAST_DEFAULT'
--   DEEP + 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'
--   DEEP + 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION'
--   DEEP + 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART'
--   DEEP + 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'
--
-- This forward-only migration therefore splits the durable routing contract in
-- two, deliberately, because reading history and authorizing new work are not
-- the same authority:
--
--   * the persisted CHECK is WIDENED to the union {null/null, both historical
--     legacy pairs, all five v2 pairs}, so every canonical row written before
--     QIR-002 stays valid and readable forever and no historical migration has
--     to be edited or replayed; and
--   * claim_conversation_turn is NARROWED so a NEW claim accepts ONLY the five
--     v2 pairs. A legacy reason, an unknown reason, a cross pair, and any
--     null/partial routing argument are all rejected with INVALID_ROUTING.
--
-- The claim replacement keeps migration 0039's external signature and EVERY
-- authority property byte-for-byte: service-role-only execution, SECURITY
-- DEFINER with an empty search_path, the explicit INVALID_USER guard, the
-- explicit session/user ownership check, the USER + RECEIVED state requirement,
-- the FOR UPDATE one-claimant-wins row lock, and the server-owned generation
-- lease stamped on the single successful RECEIVED -> GENERATING transition. No
-- new table, column, index, policy, role, or grant is introduced, no direct
-- mutation grant is reopened, and no authenticated claim path is created.
-- Migrations 0001-0061 remain byte-exact; history files are left untouched.

BEGIN;

-- 1. Durable read compatibility. The routing CHECK becomes the UNION of the
--    pre-routing state, the historical legacy pairs, and the v2 pairs. Widening
--    is what keeps historical canonical turns (and the assistant rows and
--    outbox payloads that copied their route pair) valid; the constraint is
--    added WITHOUT `NOT VALID` on purpose, so PostgreSQL revalidates every
--    existing row here and the migration itself proves backward compatibility.
--    Cross pairs and unknown reasons stay rejected exactly as before.
--
--    The constraint is also made TOTAL. The migration-0003 predicate was
--    three-valued: for a HALF-NULL routing state (path set with a NULL reason,
--    or the reverse) every disjunct evaluated to NULL or FALSE, the whole OR
--    chain evaluated to NULL, and PostgreSQL treats a NULL CHECK as SATISFIED —
--    so `path-only` and `reason-only` rows were silently persistable, and were
--    actually reachable through the matching NULL hole in the claim gate closed
--    in step 2. The explicit both-NOT-NULL guard below removes the third truth
--    value, so the predicate is exactly TRUE or FALSE for every row.
--
--    DEPLOYMENT NOTE: because the constraint is added WITHOUT `NOT VALID`, a
--    pre-existing half-null row would make this statement fail loudly rather
--    than be carried forward. That is deliberate: a half-null routing state is
--    corruption, and QIR-002 does not silently repair or delete canonical data.
ALTER TABLE public.conversation_turns
  DROP CONSTRAINT conversation_turns_routing_reason_check;

ALTER TABLE public.conversation_turns
  ADD CONSTRAINT conversation_turns_routing_reason_check CHECK (
    -- The legitimate pre-routing state.
    (processing_path IS NULL AND routing_reason IS NULL) OR
    (processing_path IS NOT NULL AND routing_reason IS NOT NULL AND (
      -- Historical, read-only from QIR-002 onward. New claims can no longer
      -- produce these; existing rows must never become unreadable.
      (processing_path = 'FAST' AND routing_reason = 'FAST_DEFAULT') OR
      (processing_path = 'DEEP' AND routing_reason = 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT') OR
      -- Runtime Decision Policy v2.
      (processing_path = 'FAST' AND routing_reason = 'RUNTIME_ROUTING_V2_FAST_DEFAULT') OR
      (processing_path = 'DEEP' AND routing_reason IN (
        'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE',
        'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION',
        'RUNTIME_ROUTING_V2_DEEP_MULTI_PART',
        'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'))
    ))
  );

-- 2. Current claim authority. Same signature, same ownership/state/lock/lease
--    semantics as migration 0039 — only the routing gate changes, and it
--    changes in exactly one direction: NEW claims are v2-only, so the database
--    remains the durable routing authority even if an application ever tried to
--    claim with a retired reason.
--
--    The gate is also made genuinely TOTAL. The migration-0025/0039 predicate
--    was three-valued: with a NULL path or a NULL reason every disjunct
--    collapsed to NULL, `NOT(NULL)` is NULL, and plpgsql treats a NULL IF
--    condition as false — so the RAISE was skipped. A NULL/NULL claim therefore
--    passed the routing gate entirely and could transition RECEIVED ->
--    GENERATING with no durable route at all (the table CHECK accepts null/null
--    as the legitimate pre-routing state, so nothing downstream caught it). The
--    explicit NULL guard below closes that hole: it strengthens the gate and
--    weakens nothing, because a NULL routing argument was never a legal claim
--    under any policy version.
CREATE OR REPLACE FUNCTION public.claim_conversation_turn(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_processing_path text, p_routing_reason text
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023'; END IF;
  IF p_processing_path IS NULL OR p_routing_reason IS NULL
    OR NOT((p_processing_path='FAST' AND p_routing_reason='RUNTIME_ROUTING_V2_FAST_DEFAULT')
      OR (p_processing_path='DEEP' AND p_routing_reason IN (
            'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE',
            'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION',
            'RUNTIME_ROUTING_V2_DEEP_MULTI_PART',
            'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'))) THEN
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

-- 3. Least privilege re-asserted. CREATE OR REPLACE preserves any drifted
--    privileges, so — exactly as migration 0039 did — the service-role-only
--    authority established by migration 0025 is restated explicitly rather than
--    assumed. Nothing is granted to PUBLIC, anon, or authenticated.
ALTER FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) TO service_role;

COMMIT;
