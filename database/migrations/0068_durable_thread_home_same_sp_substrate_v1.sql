-- T-03B2b2 - Durable Thread + Permanent Home + Same-SP DB Substrate v1.
--
-- T-03B2a (merged) judges ONE committed CU and returns a prepared TE-01 /
-- TE-02 / TE-03 decision. T-03B2b1 (merged) froze QANDEEL_OSDAP_V1, the pure
-- permanent Home placement engine. This migration makes that truth DURABLE
-- while preserving the frozen Stage-6 same-SP order:
--
--   1. CU is committed / receives SP
--   2. references + conversational focus are resolved          [T-03B1b1]
--   3. Emerging Focus continuity is resolved                   [T-03B1b1]
--   4. optional Thread establishment + permanent Home          [this slice]
--   5. effective LF                                            [T-03D]
--
-- The per-Moment shape this migration builds, for EVERY CU of a batch, in
-- canonical source order, inside ONE transaction:
--
--   allocate this CU's SP
--   -> make that SP the current open head
--   -> reserve same-SP sequence 1 through the ONE T-03A2 seam
--   -> persist the whole T-03B1 reference / focus bundle at it
--   -> inspect this CU's canonical B2 decision
--        NO_ESTABLISHMENT  -> reserve NOTHING
--        ESTABLISH_THREAD  -> lock this user's world, compute the canonical
--                             Home against the world as it actually stands,
--                             reserve same-SP sequence 2, and insert the
--                             Thread, its permanent Home, the explicit
--                             ThreadEstablished event, the evidence and the
--                             Conversational Origin provenance atomically
--   -> only then may the next CU advance the clock and seal this SP
--
-- Frozen truth this substrate preserves:
--   * a canonical Thread belongs to the user's persistent Conversation World,
--     so Thread identity scope is user/world, NOT Session; the establishing
--     Emerging Focus stays Session-scoped and its history is never rewritten;
--   * promotion creates an immutable EmergingFocus -> Thread lineage
--     (UNIQUE grounding_emerging_focus_id), never a rename and never a merge;
--   * every Established Thread receives exactly ONE permanent Home; after
--     commit there is no Thread without its Home and no Home without its
--     Thread, and no later code may move, recompute or relocate a Home;
--   * Conversational Origin is placement input and provenance - never
--     parenthood, hierarchy, causality, ownership or mandatory adjacency, so
--     no member is ever marked parent, primary or preferred;
--   * spatial proximity carries no analytical meaning: no score, similarity,
--     confidence, importance, popularity, viewport or device value reaches
--     geography, and the caller can never author a coordinate.
--
-- What this migration is NOT:
--   * it is not runtime activation: the new writer, the new coordinator and
--     every internal helper are executable by NO application role, the
--     T-03A2 grants are left exactly as they are, and no Product path can
--     establish a Thread; T-03B2b3 owns runtime orchestration and T-03D owns
--     the final semantic-chain cutover;
--   * it is not Thread lifecycle, Dormant / Reopened, cross-session identity
--     resolution, Thread <-> Reading binding, effective Live Focus, T-03C
--     historical projection, Neighborhood geometry, Timeline, Map or Thread
--     merge - none of those has a column, a function or a field here;
--   * it does not rewrite migrations 0064, 0065, 0066 or 0067, and it shares
--     the same-SP seam with 0065 by CALLING it rather than by creating a
--     second sequence authority;
--   * it backfills nothing, declares no Session historical-enabled, and
--     introduces no activation or cutover flag.
--
-- Audit timestamps exist only as audit metadata. No timestamp decides SP,
-- identity, placement, lineage, availability or ordering anywhere below.

BEGIN;

-- 0. Preconditions. The frozen UTF-8 contract still binds (selection anchors
--    are code-point coordinates verified against the committed wording), and
--    the T-03A2 seam plus the T-03B1b1 substrate this migration extends must
--    exist.
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03B2b2 requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF to_regprocedure('public.reserve_session_same_sp_event_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint)') IS NULL
     OR to_regprocedure('public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)') IS NULL
     OR to_regclass('public.conversation_emerging_focuses') IS NULL
     OR to_regclass('public.conversation_emerging_focus_attention_events') IS NULL THEN
    RAISE EXCEPTION 'T-03B2b2 requires the T-03A2 Session Semantic Clock seam and the T-03B1b1 focus substrate'
      USING ERRCODE='55000';
  END IF;
END$$;

-- ===========================================================================
-- 1. The per-user-world serialization row.
--
--    This is a TECHNICAL row, not a Product object. It holds no rank, no
--    counter, no layout state and no mutable geography: it exists only so
--    that concurrent Thread establishments from different Sessions of the
--    SAME user are serialized while the permanent Home is computed. The
--    frozen engine guarantees separation only against the world it is given,
--    so the world must not move under the computation.
--
--    It may be lazily inserted and is then locked FOR UPDATE - always AFTER
--    the Session Semantic Clock (AF66-01), never before.
-- ===========================================================================
CREATE TABLE public.conversation_world_spatial_authorities (
  user_id uuid PRIMARY KEY,
  address_scheme text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT world_spatial_authorities_scheme_check CHECK (address_scheme = 'QANDEEL_OSDAP_V1')
);

-- ===========================================================================
-- 2. Canonical Thread identity: user/world-scoped, born of exactly one
--    Session-scoped Emerging Focus, at one exact (SP, same-SP sequence).
--
--    There is deliberately NO lifecycle status, NO mutable label, NO score,
--    NO parent Thread, NO merge target and NO Home coordinate here: the Home
--    lives in its own one-to-one table and the coordinate is written once.
-- ===========================================================================
CREATE TABLE public.conversation_threads (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  grounding_emerging_focus_id uuid NOT NULL UNIQUE,
  established_session_id uuid NOT NULL,
  established_cu_id uuid NOT NULL,
  established_sp integer NOT NULL,
  established_event_sequence bigint NOT NULL,
  establishment_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversation_threads_owner_fk
    FOREIGN KEY (user_id) REFERENCES public.conversation_world_spatial_authorities (user_id) ON DELETE RESTRICT,
  CONSTRAINT conversation_threads_session_user_fk
    FOREIGN KEY (established_session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT conversation_threads_focus_fk
    FOREIGN KEY (grounding_emerging_focus_id) REFERENCES public.conversation_emerging_focuses (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_threads_cu_fk
    FOREIGN KEY (established_cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_threads_sp_fk
    FOREIGN KEY (established_session_id, established_sp) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT conversation_threads_path_check CHECK (establishment_path IN ('TE-01','TE-02','TE-03')),
  CONSTRAINT conversation_threads_position_check CHECK (established_sp >= 1 AND established_event_sequence = 2)
);

-- ===========================================================================
-- 3. The permanent Home Anchor: exactly ONE per Thread, forever.
--
--    `thread_id` is the PRIMARY KEY, so a second Home for a Thread is
--    structurally impossible; UNIQUE(user_id, address_scheme, x, y) makes a
--    second Thread at one canonical place impossible. The placement, its
--    attempt, its origin-seeded base and both fingerprints are recorded as
--    reproducibility provenance: nothing here may ever be updated.
-- ===========================================================================
CREATE TABLE public.conversation_thread_homes (
  thread_id uuid PRIMARY KEY,
  home_anchor_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  address_scheme text NOT NULL,
  placement_x numeric(20,0) NOT NULL,
  placement_y numeric(20,0) NOT NULL,
  placement_attempt integer NOT NULL,
  placement_base_x numeric(20,0) NOT NULL,
  placement_base_y numeric(20,0) NOT NULL,
  world_fingerprint bytea NOT NULL,
  origin_fingerprint bytea NOT NULL,
  placement_engine_version text NOT NULL,
  established_session_id uuid NOT NULL,
  established_cu_id uuid NOT NULL,
  established_sp integer NOT NULL,
  established_event_sequence bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_homes_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_homes_authority_fk
    FOREIGN KEY (user_id) REFERENCES public.conversation_world_spatial_authorities (user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_homes_session_user_fk
    FOREIGN KEY (established_session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_homes_cu_fk
    FOREIGN KEY (established_cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT thread_homes_scheme_check CHECK (address_scheme = 'QANDEEL_OSDAP_V1'),
  CONSTRAINT thread_homes_engine_check CHECK (placement_engine_version = 'canonical-home-placement-engine-v1'),
  CONSTRAINT thread_homes_bounds_check CHECK (
    placement_x >= -4611686018427387904 AND placement_x <= 4611686018427387903
    AND placement_y >= -4611686018427387904 AND placement_y <= 4611686018427387903
    AND placement_base_x >= -4611686018427387904 AND placement_base_x <= 4611686018427387903
    AND placement_base_y >= -4611686018427387904 AND placement_base_y <= 4611686018427387903),
  CONSTRAINT thread_homes_attempt_check CHECK (placement_attempt >= 0 AND placement_attempt <= 8191),
  CONSTRAINT thread_homes_digest_check CHECK (length(world_fingerprint) = 32 AND length(origin_fingerprint) = 32),
  CONSTRAINT thread_homes_position_check CHECK (established_sp >= 1 AND established_event_sequence = 2),
  CONSTRAINT thread_homes_place_unique UNIQUE (user_id, address_scheme, placement_x, placement_y)
);

CREATE INDEX thread_homes_world_idx
  ON public.conversation_thread_homes (user_id, address_scheme, placement_x, placement_y);

-- ===========================================================================
-- 4. The explicit append-only ThreadEstablished domain event.
--
--    Thread + Home are ONE B2 semantic event: they share the same SP and the
--    same same-SP sequence, and no second sequence is ever reserved for the
--    Home. `origin_state` is recorded here as the then-known Conversational
--    Origin state; the members live in their own provenance table.
-- ===========================================================================
CREATE TABLE public.conversation_thread_establishment_events (
  event_id uuid PRIMARY KEY,
  thread_id uuid NOT NULL UNIQUE,
  home_anchor_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  cu_id uuid NOT NULL,
  commit_batch_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  emerging_focus_id uuid NOT NULL,
  establishment_path text NOT NULL,
  origin_state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_events_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_events_home_fk
    FOREIGN KEY (home_anchor_id) REFERENCES public.conversation_thread_homes (home_anchor_id) ON DELETE RESTRICT,
  CONSTRAINT thread_events_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_events_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT thread_events_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT thread_events_focus_fk
    FOREIGN KEY (emerging_focus_id) REFERENCES public.conversation_emerging_focuses (id) ON DELETE RESTRICT,
  CONSTRAINT thread_events_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT thread_events_path_check CHECK (establishment_path IN ('TE-01','TE-02','TE-03')),
  CONSTRAINT thread_events_origin_state_check CHECK (origin_state IN ('NONE','RESOLVED','MULTIPLE','AMBIGUOUS')),
  CONSTRAINT thread_events_position_check CHECK (session_position >= 1 AND same_sp_event_sequence = 2),
  CONSTRAINT thread_events_sp_unique UNIQUE (session_id, session_position, same_sp_event_sequence)
);

-- ===========================================================================
-- 5. Append-only establishment evidence provenance.
--
--    These rows say WHICH committed CUs the promotion rested on. They are
--    evidence, NOT hierarchy edges, NOT a Thread relation and NOT a reading
--    order: there is no direction, no weight and no semantic distance.
-- ===========================================================================
CREATE TABLE public.conversation_thread_establishment_evidence (
  thread_id uuid NOT NULL,
  evidence_ordinal integer NOT NULL,
  cu_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  cu_sp integer NOT NULL,
  evidence_role text NOT NULL,
  CONSTRAINT thread_evidence_pkey PRIMARY KEY (thread_id, evidence_ordinal),
  CONSTRAINT thread_evidence_cu_unique UNIQUE (thread_id, cu_id),
  CONSTRAINT thread_evidence_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_evidence_cu_fk
    FOREIGN KEY (cu_id) REFERENCES public.conversation_units (id) ON DELETE RESTRICT,
  CONSTRAINT thread_evidence_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_evidence_sp_fk
    FOREIGN KEY (session_id, cu_sp) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT thread_evidence_ordinal_check CHECK (evidence_ordinal >= 0 AND evidence_ordinal < 64),
  CONSTRAINT thread_evidence_sp_check CHECK (cu_sp >= 1),
  CONSTRAINT thread_evidence_role_check CHECK (evidence_role IN ('PRIOR_EVIDENCE','ESTABLISHING_CU'))
);

-- ===========================================================================
-- 6. Append-only Conversational Origin provenance.
--
--    Membership ONLY. There is deliberately no parent_thread_id, no
--    origin_parent, no primary_origin, no edge_direction and no semantic
--    distance: MULTIPLE and AMBIGUOUS are stored symmetrically over ALL
--    members, in canonical textual order, and the order is storage order.
-- ===========================================================================
CREATE TABLE public.conversation_thread_origin_members (
  thread_id uuid NOT NULL,
  origin_member_ordinal integer NOT NULL,
  origin_thread_id uuid NOT NULL,
  CONSTRAINT thread_origin_members_pkey PRIMARY KEY (thread_id, origin_member_ordinal),
  CONSTRAINT thread_origin_members_unique UNIQUE (thread_id, origin_thread_id),
  CONSTRAINT thread_origin_members_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_origin_members_origin_fk
    FOREIGN KEY (origin_thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_origin_members_ordinal_check CHECK (origin_member_ordinal >= 0 AND origin_member_ordinal < 64),
  CONSTRAINT thread_origin_members_self_check CHECK (origin_thread_id <> thread_id)
);

-- ===========================================================================
-- 7. Technical B2 capture completeness: one row per committed-CU batch.
--
--    It distinguishes "B2 evaluated this batch and established nothing" from
--    "B2 never ran here", carries the exact replay identity, and covers the
--    zero-CU batch. It has NO SP and NO same-SP sequence because it is
--    technical capture metadata, not Product historical material.
--
--    `canonical_fingerprint` is DB-derived SHA-256 over the canonical ordered
--    B2 decision payload plus provenance; SP allocation, the event sequence,
--    the audit timestamp and the DB-derived placement are all EXCLUDED,
--    because they are allocation results, never caller payload identity.
-- ===========================================================================
CREATE TABLE public.conversation_thread_commit_batches (
  commit_batch_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  unit_count integer NOT NULL,
  establishment_count integer NOT NULL,
  canonical_fingerprint bytea NOT NULL,
  thread_evaluator_version text NOT NULL,
  thread_policy_version text NOT NULL,
  thread_provider text NOT NULL,
  thread_model text NOT NULL,
  thread_prompt_version text NOT NULL,
  thread_schema_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_commit_batches_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT thread_commit_batches_focus_batch_fk
    FOREIGN KEY (commit_batch_id) REFERENCES public.conversation_focus_commit_batches (commit_batch_id) ON DELETE RESTRICT,
  CONSTRAINT thread_commit_batches_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_commit_batches_turn_fk
    FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
  CONSTRAINT thread_commit_batches_count_check CHECK (
    unit_count >= 0 AND establishment_count >= 0 AND establishment_count <= unit_count),
  CONSTRAINT thread_commit_batches_digest_check CHECK (length(canonical_fingerprint) = 32),
  CONSTRAINT thread_commit_batches_provenance_check CHECK (
    length(btrim(thread_evaluator_version)) > 0 AND length(thread_evaluator_version) <= 64 AND
    length(btrim(thread_policy_version)) > 0 AND length(thread_policy_version) <= 64 AND
    length(btrim(thread_provider)) > 0 AND length(thread_provider) <= 64 AND
    length(btrim(thread_model)) > 0 AND length(thread_model) <= 128 AND
    length(btrim(thread_prompt_version)) > 0 AND length(thread_prompt_version) <= 64 AND
    thread_schema_version >= 1)
);

-- ===========================================================================
-- 8. Append-only / permanence enforcement, binding the owner too, exactly as
--    0064 / 0065 / 0066 do. A Home can therefore never be relocated - not by
--    UPDATE and not by delete/reinsert, because nothing can be removed and
--    every identity is a primary key.
-- ===========================================================================
CREATE FUNCTION public.reject_conversation_thread_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'CANONICAL_THREAD_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Thread identity, its permanent Home, the establishment event, its evidence and its Conversational Origin provenance are append-only permanent truth: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE TRIGGER conversation_world_spatial_authorities_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_world_spatial_authorities
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_mutation_v1();
CREATE TRIGGER conversation_threads_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_threads
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_mutation_v1();
CREATE TRIGGER conversation_thread_homes_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_homes
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_mutation_v1();
CREATE TRIGGER conversation_thread_establishment_events_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_establishment_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_mutation_v1();
CREATE TRIGGER conversation_thread_establishment_evidence_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_establishment_evidence
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_mutation_v1();
CREATE TRIGGER conversation_thread_origin_members_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_origin_members
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_mutation_v1();
CREATE TRIGGER conversation_thread_commit_batches_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_thread_commit_batches
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_thread_mutation_v1();

-- ===========================================================================
-- 9. QANDEEL_OSDAP_V1 - the internal PostgreSQL parity implementation of the
--    frozen T-03B2b1 engine.
--
--    The database must never accept a caller-authored permanent coordinate,
--    so the placement is recomputed here, in exact integer arithmetic, from
--    the world as it actually stands under the user-world lock. Every step
--    below mirrors `apps/api/src/thread-establishment/home-placement` byte
--    for byte, and the cross-language parity is proven against the seven
--    frozen golden vectors by database/verify-migration-0068.mjs.
--
--    The helpers are PROOF SEAMS, exactly as in the TypeScript engine: pure
--    steps of the one algorithm, separated so each can be pinned. None of
--    them is an alternative authority; the placement function binds the
--    search to the REAL fingerprints of the real world.
--
--    Frozen constants (identical to the TypeScript engine):
--      scheme                 QANDEEL_OSDAP_V1
--      digest domain          qandeel-osdap-v1
--      MIN_COORD              -(2^62)  = -4611686018427387904
--      MAX_COORD              2^62 - 1 =  4611686018427387903
--      HOME_STEP              1000000
--      MIN_HOME_SEPARATION    250000
--      CANDIDATES_PER_SHELL   32
--      MAX_ATTEMPTS           8192
-- ===========================================================================

-- 9.1 Mathematical floor division: the quotient rounded toward negative
--     infinity, in exact numeric arithmetic. `div()` truncates toward zero and
--     `mod()` carries the sign of the dividend, so one correction suffices.
CREATE FUNCTION public.osdap_floor_div_v1(p_dividend numeric, p_divisor numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE
  quotient numeric;
BEGIN
  IF p_divisor IS NULL OR p_dividend IS NULL OR p_divisor <= 0 THEN
    RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023',
      DETAIL='Floor division requires a positive divisor.';
  END IF;
  quotient := div(p_dividend, p_divisor);
  IF mod(p_dividend, p_divisor) < 0 THEN
    quotient := quotient - 1;
  END IF;
  RETURN quotient;
END;$$;

-- 9.2 The unsigned big-endian integer carried by digest bytes [p_from, p_to).
--     The first 16 bytes give uX, the last 16 give uY. No floating point.
CREATE FUNCTION public.osdap_unsigned_v1(p_digest bytea, p_from integer, p_to integer)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE
  value numeric := 0;
  position integer;
BEGIN
  IF p_digest IS NULL OR length(p_digest) <> 32 OR p_from < 0 OR p_to > 32 OR p_to <= p_from THEN
    RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023',
      DETAIL='A sha256 digest is exactly 32 bytes and the half-open byte range must lie inside it.';
  END IF;
  FOR position IN p_from .. p_to - 1 LOOP
    value := value * 256 + get_byte(p_digest, position);
  END LOOP;
  RETURN value;
END;$$;

-- 9.3 The canonical serialization of a set of Homes: `threadId \t x \t y \n`
--     per Home, ordered by Thread id in byte (C) order so the input order is
--     irrelevant, exactly like the engine's UTF-16 code-unit comparison over
--     the closed ASCII identity charset.
CREATE FUNCTION public.osdap_serialize_homes_v1(p_thread_ids text[], p_x numeric[], p_y numeric[])
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE
  serialized text;
BEGIN
  SELECT COALESCE(string_agg(h.thread_id || E'\t' || h.x::bigint::text || E'\t' || h.y::bigint::text || E'\n', ''
                             ORDER BY h.thread_id COLLATE "C"), '')
    INTO serialized
    FROM unnest(p_thread_ids, p_x, p_y) AS h(thread_id, x, y);
  RETURN serialized;
END;$$;

-- 9.4 sha256 over `scheme + ordered (threadId, x, y)`: the then-existing world.
CREATE FUNCTION public.osdap_world_fingerprint_v1(p_thread_ids text[], p_x numeric[], p_y numeric[])
RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT sha256(convert_to('QANDEEL_OSDAP_V1' || E'\n' || public.osdap_serialize_homes_v1(p_thread_ids, p_x, p_y), 'UTF8'));
$$;

-- 9.5 sha256 over `origin state + ordered origin (threadId, x, y)`.
CREATE FUNCTION public.osdap_origin_fingerprint_v1(p_state text, p_thread_ids text[], p_x numeric[], p_y numeric[])
RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT sha256(convert_to(p_state || E'\n' || public.osdap_serialize_homes_v1(p_thread_ids, p_x, p_y), 'UTF8'));
$$;

-- 9.6 The per-attempt digest:
--     `domain|userWorldId|newThreadId|originFingerprintHex|worldFingerprintHex|attempt`.
CREATE FUNCTION public.osdap_attempt_digest_v1(
  p_user_world_id text,
  p_new_thread_id text,
  p_origin_fingerprint bytea,
  p_world_fingerprint bytea,
  p_attempt integer
) RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT sha256(convert_to(
    'qandeel-osdap-v1' || '|' || p_user_world_id || '|' || p_new_thread_id || '|'
      || encode(p_origin_fingerprint, 'hex') || '|' || encode(p_world_fingerprint, 'hex') || '|' || p_attempt::text,
    'UTF8'));
$$;

-- 9.7 One candidate offset: the two 128-bit digest halves mapped into the
--     square [-radius, +radius]^2 by exact modulus, then projected onto the
--     OUTER half of the shell when the offset falls in the inner half. The
--     dominant component (larger absolute value; x on an exact tie) is
--     replaced by sign * ceil(radius / 2), where a zero component counts as
--     positive; the other component is kept.
CREATE FUNCTION public.osdap_candidate_offset_v1(
  p_digest bytea,
  p_radius numeric,
  OUT offset_dx numeric,
  OUT offset_dy numeric
) LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE
  boundary numeric;
  abs_dx numeric;
  abs_dy numeric;
BEGIN
  IF p_radius IS NULL OR p_radius <= 0 THEN
    RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023',
      DETAIL='A shell radius is strictly positive.';
  END IF;
  offset_dx := mod(public.osdap_unsigned_v1(p_digest, 0, 16), 2 * p_radius + 1) - p_radius;
  offset_dy := mod(public.osdap_unsigned_v1(p_digest, 16, 32), 2 * p_radius + 1) - p_radius;
  boundary := div(p_radius + 1, 2);
  abs_dx := abs(offset_dx);
  abs_dy := abs(offset_dy);
  IF GREATEST(abs_dx, abs_dy) >= boundary THEN
    RETURN;
  END IF;
  IF abs_dx >= abs_dy THEN
    offset_dx := (CASE WHEN offset_dx < 0 THEN -1 ELSE 1 END) * boundary;
  ELSE
    offset_dy := (CASE WHEN offset_dy < 0 THEN -1 ELSE 1 END) * boundary;
  END IF;
END;$$;

-- 9.8 The search: the FIRST admissible candidate in attempt order.
--     shell = 1 + floor(attempt / 32), radius = HOME_STEP * shell. A candidate
--     outside the technical coordinate bound is SKIPPED - never clamped and
--     never wrapped. A candidate whose exact Chebyshev distance to ANY
--     existing Home is below MIN_HOME_SEPARATION is skipped. Existing Homes
--     are read, never moved. Exhaustion fails closed.
--
--     This is the proof seam: it takes the seed explicitly, so the frozen
--     8192-candidate exhaustion behaviour can be exercised against a fixed
--     seed. `compute_canonical_home_placement_v1` binds it to the REAL
--     fingerprints of the REAL world; nothing else may call it.
CREATE FUNCTION public.osdap_search_admissible_placement_v1(
  p_user_world_id text,
  p_new_thread_id text,
  p_origin_fingerprint bytea,
  p_world_fingerprint bytea,
  p_base_x numeric,
  p_base_y numeric,
  p_existing_x numeric[],
  p_existing_y numeric[],
  OUT placement_x numeric,
  OUT placement_y numeric,
  OUT placement_attempt integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  min_coord constant numeric := -4611686018427387904;
  max_coord constant numeric := 4611686018427387903;
  home_step constant numeric := 1000000;
  min_separation constant numeric := 250000;
  candidates_per_shell constant integer := 32;
  max_attempts constant integer := 8192;
  attempt integer;
  radius numeric;
  offsets record;
  candidate_x numeric;
  candidate_y numeric;
  blocked boolean;
BEGIN
  FOR attempt IN 0 .. max_attempts - 1 LOOP
    radius := home_step * (1 + attempt / candidates_per_shell);
    SELECT o.offset_dx, o.offset_dy INTO offsets
      FROM public.osdap_candidate_offset_v1(
             public.osdap_attempt_digest_v1(p_user_world_id, p_new_thread_id, p_origin_fingerprint, p_world_fingerprint, attempt),
             radius) o;
    candidate_x := p_base_x + offsets.offset_dx;
    candidate_y := p_base_y + offsets.offset_dy;
    IF candidate_x < min_coord OR candidate_x > max_coord OR candidate_y < min_coord OR candidate_y > max_coord THEN
      CONTINUE;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM unnest(p_existing_x, p_existing_y) AS h(x, y)
       WHERE abs(candidate_x - h.x) < min_separation AND abs(candidate_y - h.y) < min_separation)
      INTO blocked;
    IF NOT blocked THEN
      placement_x := candidate_x;
      placement_y := candidate_y;
      placement_attempt := attempt;
      RETURN;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED' USING ERRCODE='55000',
    DETAIL='No admissible canonical placement exists within the frozen attempt budget; nothing is clamped, wrapped or relocated.';
END;$$;

-- 9.9 The canonical placement of ONE new Thread against the then-existing
--     committed world. Validates the closed world exactly as the frozen
--     engine does, derives the origin-seeded base (NONE -> the world datum
--     (0,0), RESOLVED -> the one origin Home, MULTIPLE / AMBIGUOUS -> the
--     permutation-invariant exact integer barycenter over ALL members, floor
--     divided toward negative infinity), computes both fingerprints and binds
--     the search to them.
CREATE FUNCTION public.compute_canonical_home_placement_v1(
  p_user_world_id text,
  p_new_thread_id text,
  p_origin_state text,
  p_origin_thread_ids text[],
  p_existing_thread_ids text[],
  p_existing_x numeric[],
  p_existing_y numeric[],
  OUT placement_x numeric,
  OUT placement_y numeric,
  OUT placement_attempt integer,
  OUT base_x numeric,
  OUT base_y numeric,
  OUT world_fingerprint bytea,
  OUT origin_fingerprint bytea
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  identity_shape constant text := '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$';
  min_coord constant numeric := -4611686018427387904;
  max_coord constant numeric := 4611686018427387903;
  world_count integer;
  origin_count integer;
  idx integer;
  member text;
  origin_x numeric[] := ARRAY[]::numeric[];
  origin_y numeric[] := ARRAY[]::numeric[];
  found_x numeric;
  found_y numeric;
  sum_x numeric := 0;
  sum_y numeric := 0;
  placement record;
BEGIN
  IF p_user_world_id IS NULL OR p_new_thread_id IS NULL OR p_origin_state IS NULL
     OR p_origin_thread_ids IS NULL OR p_existing_thread_ids IS NULL OR p_existing_x IS NULL OR p_existing_y IS NULL THEN
    RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023';
  END IF;
  IF p_user_world_id !~ identity_shape OR p_new_thread_id !~ identity_shape THEN
    RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023',
      DETAIL='A world owner and a Thread identity use the closed canonical identity charset.';
  END IF;
  world_count := cardinality(p_existing_thread_ids);
  IF world_count <> cardinality(p_existing_x) OR world_count <> cardinality(p_existing_y) THEN
    RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023',
      DETAIL='The existing world is three parallel arrays of equal length.';
  END IF;
  FOR idx IN 1 .. world_count LOOP
    IF p_existing_thread_ids[idx] IS NULL OR p_existing_thread_ids[idx] !~ identity_shape
       OR p_existing_x[idx] IS NULL OR p_existing_y[idx] IS NULL
       OR p_existing_x[idx] <> trunc(p_existing_x[idx]) OR p_existing_y[idx] <> trunc(p_existing_y[idx]) THEN
      RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023';
    END IF;
    IF p_existing_x[idx] < min_coord OR p_existing_x[idx] > max_coord
       OR p_existing_y[idx] < min_coord OR p_existing_y[idx] > max_coord THEN
      RAISE EXCEPTION 'EXISTING_HOME_OUT_OF_BOUNDS' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM unnest(p_existing_thread_ids) AS t(id) GROUP BY t.id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'DUPLICATE_EXISTING_THREAD_ID' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_existing_x, p_existing_y) AS h(x, y) GROUP BY h.x, h.y HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'DUPLICATE_EXISTING_PLACEMENT' USING ERRCODE='22023',
      DETAIL='Two committed Homes share one canonical placement: the world is malformed and is never repaired here.';
  END IF;
  IF p_new_thread_id = ANY (p_existing_thread_ids) THEN
    RAISE EXCEPTION 'THREAD_ALREADY_PLACED' USING ERRCODE='22023',
      DETAIL='A Thread that already holds a committed Home keeps it: the placement engine is called only for a NEW establishment.';
  END IF;

  IF p_origin_state NOT IN ('NONE', 'RESOLVED', 'MULTIPLE', 'AMBIGUOUS') THEN
    RAISE EXCEPTION 'INVALID_PLACEMENT_INPUT' USING ERRCODE='22023';
  END IF;
  origin_count := cardinality(p_origin_thread_ids);
  IF (p_origin_state = 'NONE' AND origin_count <> 0)
     OR (p_origin_state = 'RESOLVED' AND origin_count <> 1)
     OR (p_origin_state IN ('MULTIPLE', 'AMBIGUOUS') AND origin_count < 2) THEN
    RAISE EXCEPTION 'INVALID_ORIGIN_CARDINALITY' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_origin_thread_ids) AS t(id) GROUP BY t.id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'DUPLICATE_ORIGIN_HOME' USING ERRCODE='22023';
  END IF;
  FOR idx IN 1 .. origin_count LOOP
    member := p_origin_thread_ids[idx];
    SELECT h.x, h.y INTO found_x, found_y
      FROM unnest(p_existing_thread_ids, p_existing_x, p_existing_y) AS h(thread_id, x, y)
     WHERE h.thread_id = member;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'UNKNOWN_ORIGIN_HOME' USING ERRCODE='22023',
        DETAIL='Every Conversational Origin member must be one of the committed Homes of this world.';
    END IF;
    origin_x := array_append(origin_x, found_x);
    origin_y := array_append(origin_y, found_y);
    sum_x := sum_x + found_x;
    sum_y := sum_y + found_y;
  END LOOP;

  IF origin_count = 0 THEN
    base_x := 0;
    base_y := 0;
  ELSE
    base_x := public.osdap_floor_div_v1(sum_x, origin_count);
    base_y := public.osdap_floor_div_v1(sum_y, origin_count);
  END IF;

  world_fingerprint := public.osdap_world_fingerprint_v1(p_existing_thread_ids, p_existing_x, p_existing_y);
  origin_fingerprint := public.osdap_origin_fingerprint_v1(p_origin_state, p_origin_thread_ids, origin_x, origin_y);

  SELECT s.placement_x, s.placement_y, s.placement_attempt INTO placement
    FROM public.osdap_search_admissible_placement_v1(
           p_user_world_id, p_new_thread_id, origin_fingerprint, world_fingerprint,
           base_x, base_y, p_existing_x, p_existing_y) s;
  placement_x := placement.placement_x;
  placement_y := placement.placement_y;
  placement_attempt := placement.placement_attempt;
END;$$;

-- ===========================================================================
-- 10. The deterministic DB-side validation of ONE canonical B2 decision.
--
--     The privileged caller must not be able to fabricate an impossible
--     Thread establishment, so every T-03B2a gate is re-proved here against
--     the locked canonical rows: the frozen decision shape, the B1 attention
--     of THIS CU, the focus identity and its Session ownership, the promotion
--     state, the evidence chronology and focus binding, and the structural
--     minimum of the named evidence path. A technical failure is NEVER
--     persisted as truthful non-establishment.
-- ===========================================================================
CREATE FUNCTION public.validate_conversation_thread_decision_v1(
  p_cu public.conversation_units,
  p_decision jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  decision text;
  reason text;
  path text;
  focus_id uuid;
  thread_id uuid;
  home_anchor_id uuid;
  event_id uuid;
  origin_state text;
  origin_ids uuid[];
  evidence jsonb;
  evidence_count integer;
  entry jsonb;
  idx integer;
  evidence_ids uuid[] := ARRAY[]::uuid[];
  prior_ids uuid[] := ARRAY[]::uuid[];
  attention_kind text;
  attention_reason text;
  attention_focus uuid;
  already_established boolean;
  grounding jsonb;
  a_text text;
  a_occurrence integer;
  a_start integer;
  a_end integer;
  user_evidence integer;
  boundary_cu uuid;
  boundary_sp integer;
  origin_member uuid;
  identity_key text;
BEGIN
  IF jsonb_typeof(p_decision) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_decision)) <> 12
     OR NOT (p_decision ? 'unit_id') OR NOT (p_decision ? 'decision') OR NOT (p_decision ? 'no_establishment_reason')
     OR NOT (p_decision ? 'emerging_focus_id') OR NOT (p_decision ? 'path') OR NOT (p_decision ? 'thread_id')
     OR NOT (p_decision ? 'home_anchor_id') OR NOT (p_decision ? 'thread_established_event_id')
     OR NOT (p_decision ? 'evidence') OR NOT (p_decision ? 'explicit_selection_grounding')
     OR NOT (p_decision ? 'origin_state') OR NOT (p_decision ? 'origin_thread_ids') THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A canonical Thread decision carries exactly unit_id, decision, no_establishment_reason, emerging_focus_id, path, thread_id, home_anchor_id, thread_established_event_id, evidence, explicit_selection_grounding, origin_state and origin_thread_ids.';
  END IF;
  IF jsonb_typeof(p_decision -> 'unit_id') <> 'string' OR (p_decision ->> 'unit_id') !~ uuid_shape THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF (p_decision ->> 'unit_id')::uuid <> p_cu.id THEN
    RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Each canonical Thread decision names the proposed CU it belongs to, in the same order.';
  END IF;
  decision := p_decision ->> 'decision';
  IF decision IS NULL OR decision NOT IN ('NO_ESTABLISHMENT', 'ESTABLISH_THREAD') THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Exactly two decisions are representable; nothing graded and nothing provisional.';
  END IF;

  -- The canonical B1 semantics of THIS CU are the only admissible source of
  -- the establishment target: the caller never names a focus of its own.
  SELECT e.attention_kind, e.attention_reason, e.emerging_focus_id
    INTO attention_kind, attention_reason, attention_focus
    FROM public.conversation_emerging_focus_attention_events e
   WHERE e.cu_id = p_cu.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'THREAD_DECISION_WITHOUT_B1_SEMANTICS' USING ERRCODE='55000',
      DETAIL='A Thread decision is only meaningful for a CU whose canonical B1 semantics are already durable at this SP.';
  END IF;

  focus_id := NULL;
  IF jsonb_typeof(p_decision -> 'emerging_focus_id') = 'string' THEN
    IF (p_decision ->> 'emerging_focus_id') !~ uuid_shape THEN
      RAISE EXCEPTION 'UNKNOWN_THREAD_FOCUS' USING ERRCODE='22023',
        DETAIL='Only a canonical stable emerging_focus_id is representable; prepared identities never cross this boundary.';
    END IF;
    focus_id := (p_decision ->> 'emerging_focus_id')::uuid;
  ELSIF jsonb_typeof(p_decision -> 'emerging_focus_id') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;

  -- --------------------------------------------------------------- NO branch
  IF decision = 'NO_ESTABLISHMENT' THEN
    reason := p_decision ->> 'no_establishment_reason';
    IF reason IS NULL OR reason NOT IN ('NO_INDEPENDENT_FOCUS', 'ALREADY_ESTABLISHED', 'NO_PROMOTION_PATH_PROVEN') THEN
      RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A truthful non-establishment carries exactly one of the three frozen engineering reasons; a technical failure is never persisted as one.';
    END IF;
    IF jsonb_typeof(p_decision -> 'path') <> 'null'
       OR jsonb_typeof(p_decision -> 'thread_id') <> 'null'
       OR jsonb_typeof(p_decision -> 'home_anchor_id') <> 'null'
       OR jsonb_typeof(p_decision -> 'thread_established_event_id') <> 'null'
       OR jsonb_typeof(p_decision -> 'explicit_selection_grounding') <> 'null'
       OR jsonb_typeof(p_decision -> 'evidence') <> 'array' OR jsonb_array_length(p_decision -> 'evidence') <> 0
       OR (p_decision ->> 'origin_state') <> 'NONE'
       OR jsonb_typeof(p_decision -> 'origin_thread_ids') <> 'array' OR jsonb_array_length(p_decision -> 'origin_thread_ids') <> 0 THEN
      RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A non-establishment carries no path, no Thread, no Home, no event, no evidence, no selection and no Conversational Origin.';
    END IF;
    IF reason = 'NO_INDEPENDENT_FOCUS' THEN
      IF attention_kind <> 'NO_INDEPENDENT_FOCUS' OR focus_id IS NOT NULL THEN
        RAISE EXCEPTION 'THREAD_NO_ESTABLISHMENT_MISMATCH' USING ERRCODE='22023',
          DETAIL='NO_INDEPENDENT_FOCUS is truthful only when this CU carries no independent attention at all.';
      END IF;
      RETURN;
    END IF;
    IF attention_focus IS NULL OR focus_id IS DISTINCT FROM attention_focus THEN
      RAISE EXCEPTION 'THREAD_NO_ESTABLISHMENT_MISMATCH' USING ERRCODE='22023',
        DETAIL='A non-establishment about a focus names exactly the stable Emerging Focus this CU attends or starts.';
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.conversation_threads t WHERE t.grounding_emerging_focus_id = focus_id)
      INTO already_established;
    IF (reason = 'ALREADY_ESTABLISHED') <> already_established THEN
      RAISE EXCEPTION 'THREAD_NO_ESTABLISHMENT_MISMATCH' USING ERRCODE='22023',
        DETAIL='ALREADY_ESTABLISHED requires an existing canonical Thread lineage for exactly this Emerging Focus; NO_PROMOTION_PATH_PROVEN requires that none exists.';
    END IF;
    RETURN;
  END IF;

  -- ---------------------------------------------------------- ESTABLISH branch
  IF attention_kind NOT IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS') THEN
    RAISE EXCEPTION 'THREAD_ESTABLISHMENT_WITHOUT_FOCUS' USING ERRCODE='22023',
      DETAIL='Only a CU whose canonical B1 attention starts or attends a stable Emerging Focus can establish a Thread.';
  END IF;
  IF focus_id IS NULL OR focus_id IS DISTINCT FROM attention_focus THEN
    RAISE EXCEPTION 'THREAD_ESTABLISHMENT_WITHOUT_FOCUS' USING ERRCODE='22023',
      DETAIL='The proposed Emerging Focus must be exactly the one this CU attends or starts.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_emerging_focuses f
                  WHERE f.id = focus_id AND f.session_id = p_cu.session_id AND f.user_id = p_cu.user_id) THEN
    RAISE EXCEPTION 'UNKNOWN_THREAD_FOCUS' USING ERRCODE='22023',
      DETAIL='The establishing Emerging Focus must belong to this Session and this owner.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.conversation_threads t WHERE t.grounding_emerging_focus_id = focus_id) THEN
    RAISE EXCEPTION 'THREAD_FOCUS_ALREADY_ESTABLISHED' USING ERRCODE='22023',
      DETAIL='An Emerging Focus is promoted exactly once; the lineage is immutable.';
  END IF;
  IF jsonb_typeof(p_decision -> 'no_establishment_reason') <> 'null' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  path := p_decision ->> 'path';
  IF path IS NULL OR path NOT IN ('TE-01', 'TE-02', 'TE-03') THEN
    RAISE EXCEPTION 'INVALID_THREAD_PROMOTION_PATH' USING ERRCODE='22023',
      DETAIL='Promotion is always by one of the three frozen evidence paths, never by a score.';
  END IF;
  FOREACH identity_key IN ARRAY ARRAY['thread_id', 'home_anchor_id', 'thread_established_event_id'] LOOP
    IF jsonb_typeof(p_decision -> identity_key) <> 'string' OR (p_decision ->> identity_key) !~ uuid_shape THEN
      RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023',
        DETAIL='Thread, Home Anchor and event identities are canonical RFC 4122 UUIDs derived server-side; the provider never authors them.';
    END IF;
  END LOOP;
  thread_id := (p_decision ->> 'thread_id')::uuid;
  home_anchor_id := (p_decision ->> 'home_anchor_id')::uuid;
  event_id := (p_decision ->> 'thread_established_event_id')::uuid;
  IF thread_id = home_anchor_id OR thread_id = event_id OR home_anchor_id = event_id THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023',
      DETAIL='The Thread, its permanent Home Anchor and its establishment event are three distinct identities.';
  END IF;

  -- Evidence: contiguous ordinals, the current CU exactly once and last, and
  -- every prior evidence CU legitimately earlier, same Session, same owner and
  -- bound to the SAME focus by its own canonical B1 attention.
  evidence := p_decision -> 'evidence';
  IF jsonb_typeof(evidence) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  evidence_count := jsonb_array_length(evidence);
  IF evidence_count < 1 OR evidence_count > 64 THEN
    RAISE EXCEPTION 'INVALID_THREAD_EVIDENCE' USING ERRCODE='22023';
  END IF;
  FOR idx IN 0 .. evidence_count - 1 LOOP
    entry := evidence -> idx;
    IF jsonb_typeof(entry) <> 'object'
       OR (SELECT count(*) FROM jsonb_object_keys(entry)) <> 3
       OR NOT (entry ? 'evidence_ordinal') OR NOT (entry ? 'cu_id') OR NOT (entry ? 'evidence_role')
       OR jsonb_typeof(entry -> 'evidence_ordinal') <> 'number' OR (entry ->> 'evidence_ordinal') <> idx::text
       OR jsonb_typeof(entry -> 'cu_id') <> 'string' OR (entry ->> 'cu_id') !~ uuid_shape
       OR jsonb_typeof(entry -> 'evidence_role') <> 'string' THEN
      RAISE EXCEPTION 'INVALID_THREAD_EVIDENCE' USING ERRCODE='22023',
        DETAIL='One evidence row carries exactly its contiguous ordinal, one committed CU identity and its role.';
    END IF;
    IF (entry ->> 'evidence_role') <> (CASE WHEN idx = evidence_count - 1 THEN 'ESTABLISHING_CU' ELSE 'PRIOR_EVIDENCE' END) THEN
      RAISE EXCEPTION 'INVALID_THREAD_EVIDENCE' USING ERRCODE='22023',
        DETAIL='The establishing CU is the LAST evidence row in Session Position order; every other row is prior evidence.';
    END IF;
    evidence_ids := array_append(evidence_ids, (entry ->> 'cu_id')::uuid);
  END LOOP;
  IF (SELECT count(DISTINCT d.id) FROM unnest(evidence_ids) AS d(id)) <> evidence_count THEN
    RAISE EXCEPTION 'DUPLICATE_THREAD_EVIDENCE' USING ERRCODE='22023';
  END IF;
  IF evidence_ids[evidence_count] <> p_cu.id THEN
    RAISE EXCEPTION 'CURRENT_CU_THREAD_EVIDENCE_REQUIRED' USING ERRCODE='22023',
      DETAIL='The establishing CU is always the final evidence of its own promotion.';
  END IF;
  prior_ids := evidence_ids[1 : evidence_count - 1];
  FOR idx IN 1 .. evidence_count - 1 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.conversation_units cu
                    WHERE cu.id = prior_ids[idx] AND cu.session_id = p_cu.session_id AND cu.user_id = p_cu.user_id
                      AND cu.session_position < p_cu.session_position) THEN
      RAISE EXCEPTION 'FUTURE_OR_FOREIGN_THREAD_EVIDENCE' USING ERRCODE='22023',
        DETAIL='Every prior evidence CU is an earlier committed CU of the SAME Session and owner; no future and no cross-Session material is admissible.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.conversation_emerging_focus_attention_events e
                    WHERE e.cu_id = prior_ids[idx]
                      AND e.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS')
                      AND e.emerging_focus_id = focus_id) THEN
      RAISE EXCEPTION 'THREAD_EVIDENCE_NOT_FOCUS_BOUND' USING ERRCODE='22023',
        DETAIL='Prior evidence counts only when its own canonical B1 attention starts or attends the SAME Emerging Focus.';
    END IF;
  END LOOP;
  SELECT count(*) INTO user_evidence
    FROM public.conversation_units cu
   WHERE cu.id = ANY (evidence_ids) AND cu.source_role = 'USER';

  -- Conversational Origin: closed vocabulary, frozen cardinality, canonical
  -- textual order, members that already exist in this world and already hold
  -- a committed Home. No member is or becomes a parent.
  origin_state := p_decision ->> 'origin_state';
  IF origin_state IS NULL OR origin_state NOT IN ('NONE', 'RESOLVED', 'MULTIPLE', 'AMBIGUOUS')
     OR jsonb_typeof(p_decision -> 'origin_thread_ids') <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_decision -> 'origin_thread_ids') AS c(value)
              WHERE jsonb_typeof(c.value) <> 'string' OR (c.value #>> '{}') !~ uuid_shape) THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(array_agg((c.value #>> '{}')::uuid ORDER BY c.ordinality), ARRAY[]::uuid[]) INTO origin_ids
    FROM jsonb_array_elements(p_decision -> 'origin_thread_ids') WITH ORDINALITY AS c(value, ordinality);
  IF (origin_state = 'NONE' AND cardinality(origin_ids) <> 0)
     OR (origin_state = 'RESOLVED' AND cardinality(origin_ids) <> 1)
     OR (origin_state IN ('MULTIPLE', 'AMBIGUOUS') AND cardinality(origin_ids) < 2) THEN
    RAISE EXCEPTION 'INVALID_THREAD_ORIGIN_CARDINALITY' USING ERRCODE='22023',
      DETAIL='NONE carries zero members, RESOLVED exactly one, MULTIPLE and AMBIGUOUS at least two.';
  END IF;
  IF (SELECT count(DISTINCT d.id) FROM unnest(origin_ids) AS d(id)) <> cardinality(origin_ids) THEN
    RAISE EXCEPTION 'DUPLICATE_THREAD_ORIGIN_MEMBER' USING ERRCODE='22023';
  END IF;
  IF (SELECT string_agg(c.value #>> '{}', ',' ORDER BY c.ordinality) FROM jsonb_array_elements(p_decision -> 'origin_thread_ids') WITH ORDINALITY AS c(value, ordinality))
     IS DISTINCT FROM
     (SELECT string_agg(c.value #>> '{}', ',' ORDER BY (c.value #>> '{}') COLLATE "C") FROM jsonb_array_elements(p_decision -> 'origin_thread_ids') AS c(value)) THEN
    RAISE EXCEPTION 'THREAD_ORIGIN_ORDER_NOT_CANONICAL' USING ERRCODE='22023',
      DETAIL='Origin members are stored in canonical textual order so that no position can be read as primacy.';
  END IF;
  FOREACH origin_member IN ARRAY origin_ids LOOP
    IF origin_member = thread_id THEN
      RAISE EXCEPTION 'INVALID_THREAD_ORIGIN_CARDINALITY' USING ERRCODE='22023',
        DETAIL='A Thread is never its own Conversational Origin.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t
                    JOIN public.conversation_thread_homes h ON h.thread_id = t.id
                   WHERE t.id = origin_member AND t.user_id = p_cu.user_id) THEN
      RAISE EXCEPTION 'UNKNOWN_THREAD_ORIGIN_MEMBER' USING ERRCODE='22023',
        DETAIL='Every Conversational Origin member is an already-canonical Thread of the SAME user world that already holds its permanent Home.';
    END IF;
  END LOOP;

  -- --------------------------------------------------------------- TE-01
  grounding := p_decision -> 'explicit_selection_grounding';
  IF path = 'TE-01' THEN
    IF p_cu.source_role <> 'USER' THEN
      RAISE EXCEPTION 'EXPLICIT_SELECTION_ROLE_FORBIDDEN' USING ERRCODE='22023',
        DETAIL='QANDEEL never selects on the user''s behalf.';
    END IF;
    IF evidence_count <> 1 THEN
      RAISE EXCEPTION 'INVALID_THREAD_PROMOTION_PATH' USING ERRCODE='22023',
        DETAIL='An explicit conversational selection rests on the establishing CU alone.';
    END IF;
    IF jsonb_typeof(grounding) <> 'object' THEN
      RAISE EXCEPTION 'EXPLICIT_SELECTION_REQUIRED' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(grounding)) <> 4 THEN
      RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A selection grounding is exact text plus a 1-based occurrence and a code-point span; no other shape is representable.';
    END IF;
    SELECT v.anchor_text, v.anchor_occurrence, v.span_start, v.span_end
      INTO a_text, a_occurrence, a_start, a_end
      FROM public.validate_conversation_focus_anchor_v1(p_cu.committed_text, grounding) v;
    -- THR-12: a selection wholly inside somebody else's reported speech or a
    -- direct quotation is that person's selection, never the user's own.
    IF EXISTS (SELECT 1 FROM public.conversation_claim_attributions c
                WHERE c.cu_id = p_cu.id
                  AND c.claim_frame IN ('REPORTED_SPEECH', 'DIRECT_QUOTATION')
                  AND a_start >= c.span_start AND a_end <= c.span_end) THEN
      RAISE EXCEPTION 'ATTRIBUTED_SELECTION_FORBIDDEN' USING ERRCODE='22023',
        DETAIL='The selection lies wholly inside attributed wording of this CU; it is not the user''s own conversational selection.';
    END IF;
    RETURN;
  END IF;

  IF jsonb_typeof(grounding) <> 'null' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PROMOTION_PATH' USING ERRCODE='22023',
      DETAIL='Only TE-01 carries an explicit selection grounding.';
  END IF;
  IF user_evidence < 1 THEN
    RAISE EXCEPTION 'USER_THREAD_EVIDENCE_REQUIRED' USING ERRCODE='22023',
      DETAIL='QANDEEL alone never establishes a Thread: sustained and recurrent promotion needs at least one USER committed CU among the evidence.';
  END IF;

  -- --------------------------------------------------------------- TE-02
  IF path = 'TE-02' THEN
    IF evidence_count < 2 THEN
      RAISE EXCEPTION 'INSUFFICIENT_SUSTAINED_THREAD_EVIDENCE' USING ERRCODE='22023',
        DETAIL='Sustained substantive engagement rests on at least two distinct committed CUs, the establishing CU and at least one prior CU.';
    END IF;
    RETURN;
  END IF;

  -- --------------------------------------------------------------- TE-03
  IF attention_reason = 'LOCAL_CLARIFICATION_OR_CORRECTION' THEN
    RAISE EXCEPTION 'THREAD_RECURRENCE_NOT_PROVEN' USING ERRCODE='22023',
      DETAIL='A local clarification or correction is not an independent return to the subject.';
  END IF;
  -- The recurrence boundary is derived from the FULL canonical B1 history, not
  -- from the evidence the caller chose: the LATEST prior START/ATTEND of the
  -- target focus. A caller that omits a more recent same-focus CU can never
  -- turn a continuation into a fake recurrence.
  SELECT e.cu_id, e.session_position INTO boundary_cu, boundary_sp
    FROM public.conversation_emerging_focus_attention_events e
   WHERE e.session_id = p_cu.session_id AND e.user_id = p_cu.user_id
     AND e.attention_kind IN ('START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS')
     AND e.emerging_focus_id = focus_id
     AND e.session_position < p_cu.session_position
   ORDER BY e.session_position DESC, e.same_sp_event_sequence DESC
   LIMIT 1;
  IF boundary_cu IS NULL THEN
    RAISE EXCEPTION 'THREAD_RECURRENCE_NOT_PROVEN' USING ERRCODE='22023',
      DETAIL='A recurrent independent attention needs an earlier committed CU on the same Emerging Focus.';
  END IF;
  IF NOT (boundary_cu = ANY (prior_ids)) THEN
    RAISE EXCEPTION 'THREAD_RECURRENCE_NOT_PROVEN' USING ERRCODE='22023',
      DETAIL='The latest prior CU on the target focus must itself be cited as evidence; older evidence alone never proves a return.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_emerging_focus_attention_events e
     WHERE e.session_id = p_cu.session_id AND e.user_id = p_cu.user_id
       AND e.session_position > boundary_sp AND e.session_position < p_cu.session_position
       AND e.emerging_focus_id IS DISTINCT FROM focus_id
       AND e.attention_reason <> 'LOCAL_CLARIFICATION_OR_CORRECTION') THEN
    RAISE EXCEPTION 'THREAD_RECURRENCE_NOT_PROVEN' USING ERRCODE='22023',
      DETAIL='A return needs intervening committed material that is known, is not on the target focus, and is not a local clarification or correction.';
  END IF;
END;$$;

-- ===========================================================================
-- 11. Persisting ONE establishment at its reserved (SP, same-SP sequence)
--     together with its already-computed canonical placement. Called by the
--     integrated writer only, after the decision was validated, the user
--     world was locked and the placement was computed against that locked
--     world. Thread, Home and event are ONE B2 semantic event: they share the
--     SP and the sequence, and no second sequence is ever reserved.
-- ===========================================================================
CREATE FUNCTION public.persist_conversation_thread_establishment_v1(
  p_cu public.conversation_units,
  p_commit_batch_id uuid,
  p_decision jsonb,
  p_event_sequence bigint,
  p_placement_x numeric,
  p_placement_y numeric,
  p_placement_attempt integer,
  p_placement_base_x numeric,
  p_placement_base_y numeric,
  p_world_fingerprint bytea,
  p_origin_fingerprint bytea
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  thread_id uuid := (p_decision ->> 'thread_id')::uuid;
  home_anchor_id uuid := (p_decision ->> 'home_anchor_id')::uuid;
  event_id uuid := (p_decision ->> 'thread_established_event_id')::uuid;
  focus_id uuid := (p_decision ->> 'emerging_focus_id')::uuid;
  path text := p_decision ->> 'path';
BEGIN
  IF p_event_sequence IS NULL OR p_event_sequence <> 2 THEN
    RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
      DETAIL='Thread establishment is the SECOND Stage-6 semantic layer of its Moment: B1 is sequence 1 and the whole B2 event is sequence 2.';
  END IF;

  INSERT INTO public.conversation_threads (
    id, user_id, grounding_emerging_focus_id, established_session_id, established_cu_id,
    established_sp, established_event_sequence, establishment_path)
  VALUES (thread_id, p_cu.user_id, focus_id, p_cu.session_id, p_cu.id,
    p_cu.session_position, p_event_sequence, path);

  INSERT INTO public.conversation_thread_homes (
    thread_id, home_anchor_id, user_id, address_scheme,
    placement_x, placement_y, placement_attempt, placement_base_x, placement_base_y,
    world_fingerprint, origin_fingerprint, placement_engine_version,
    established_session_id, established_cu_id, established_sp, established_event_sequence)
  VALUES (thread_id, home_anchor_id, p_cu.user_id, 'QANDEEL_OSDAP_V1',
    p_placement_x, p_placement_y, p_placement_attempt, p_placement_base_x, p_placement_base_y,
    p_world_fingerprint, p_origin_fingerprint, 'canonical-home-placement-engine-v1',
    p_cu.session_id, p_cu.id, p_cu.session_position, p_event_sequence);

  INSERT INTO public.conversation_thread_establishment_events (
    event_id, thread_id, home_anchor_id, user_id, session_id, cu_id, commit_batch_id,
    session_position, same_sp_event_sequence, emerging_focus_id, establishment_path, origin_state)
  VALUES (event_id, thread_id, home_anchor_id, p_cu.user_id, p_cu.session_id, p_cu.id, p_commit_batch_id,
    p_cu.session_position, p_event_sequence, focus_id, path, p_decision ->> 'origin_state');

  INSERT INTO public.conversation_thread_establishment_evidence (
    thread_id, evidence_ordinal, cu_id, user_id, session_id, cu_sp, evidence_role)
  SELECT thread_id,
         (e.value ->> 'evidence_ordinal')::integer,
         (e.value ->> 'cu_id')::uuid,
         p_cu.user_id,
         p_cu.session_id,
         cu.session_position,
         e.value ->> 'evidence_role'
    FROM jsonb_array_elements(p_decision -> 'evidence') AS e(value)
    JOIN public.conversation_units cu ON cu.id = (e.value ->> 'cu_id')::uuid;

  INSERT INTO public.conversation_thread_origin_members (thread_id, origin_member_ordinal, origin_thread_id)
  SELECT thread_id, (m.ordinality - 1)::integer, (m.value #>> '{}')::uuid
    FROM jsonb_array_elements(p_decision -> 'origin_thread_ids') WITH ORDINALITY AS m(value, ordinality);
END;$$;

-- ===========================================================================
-- 12. The integrated per-Moment writer. Production-inert: granted to no
--     application role. It preserves the ENTIRE 0064 / 0065 commitment
--     contract and the ENTIRE 0066 semantic contract, and adds, INSIDE the
--     same clock-locked transaction, the optional B2 layer at the SAME SP.
--
--     AF66-01 lock order, provable from the deployed body:
--
--       Session Semantic Clock FOR UPDATE
--         -> source turn
--         -> B1 semantic rows
--         -> user-world spatial authority
--         -> Thread / Home rows
--
--     The world lock is NEVER taken before the Session clock. It serializes
--     concurrent Thread establishments from different Sessions of the SAME
--     user: the loser waits, then computes its placement against the
--     winner-inclusive world. No duplicate Home, no stale pre-lock world, and
--     no committed Home ever moves.
--
--     The per-CU loop:
--
--       A  the commitment invariants were established above for the batch
--       B  insert this CU with its next SP
--       C  set clock.current_sp = this SP
--       D  reset same_sp_event_sequence = 0 for the newly opened SP
--       E  call reserve_session_same_sp_event_v1 (the ONE sequence authority)
--       F  require returned SP == this CU's SP and sequence == 1
--       G  persist the entire T-03B1 semantic bundle at that sequence
--       H  validate this CU's canonical B2 decision against the locked rows
--       I  NO_ESTABLISHMENT -> reserve nothing at all
--       J  ESTABLISH_THREAD -> lock the world, compute the canonical Home,
--          reserve sequence 2, insert Thread + Home + event + evidence +
--          origin provenance atomically
--       K  only then continue with the next CU, which seals this one
--
--     T-03D will later append effective LF at sequence 2 when this Moment
--     carries no B2 event and at sequence 3 when it does. Nothing here forces
--     it to backdate.
-- ===========================================================================
CREATE FUNCTION public.commit_conversation_units_with_focus_and_thread_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid,
  p_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_units jsonb,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_units jsonb,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer
) RETURNS SETOF public.conversation_units
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  max_units constant integer := 64;
  clock_row public.session_semantic_clocks;
  session_row public.conversation_sessions;
  turn_row public.conversation_turns;
  thread_batch_row public.conversation_thread_commit_batches;
  authority_row public.conversation_world_spatial_authorities;
  inserted_cu public.conversation_units;
  derived_digest bytea;
  derived_modality constant text := 'TEXT';
  derived_speaker constant text := 'RESOLVED';
  source_length integer;
  unit_count integer;
  establishment_count integer := 0;
  unit jsonb;
  decision jsonb;
  idx integer;
  unit_ids uuid[] := ARRAY[]::uuid[];
  span_starts integer[] := ARRAY[]::integer[];
  span_ends integer[] := ARRAY[]::integer[];
  cursor_pos integer;
  frontier integer;
  next_ordinal integer;
  first_sp integer;
  this_sp integer;
  reserved_sp integer;
  reserved_sequence bigint;
  canonical jsonb;
  fingerprint bytea;
  focus_canonical jsonb;
  focus_fingerprint bytea;
  thread_canonical jsonb;
  thread_fingerprint bytea;
  commit_batch_exists boolean;
  focus_batch_exists boolean;
  thread_batch_exists boolean;
  world_thread_ids text[];
  world_x numeric[];
  world_y numeric[];
  origin_ids text[];
  placement record;
  stored_threads integer;
  stored_homes integer;
  stored_events integer;
BEGIN
  ---------------------------------------------------------------------------
  -- COMMON SETUP. Identical structure and identical rejections to 0066, plus
  -- the B2 payload and provenance. THE SESSION CLOCK IS THE FIRST LOCK.
  ---------------------------------------------------------------------------
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_focus_units IS NULL OR jsonb_typeof(p_focus_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_thread_units IS NULL OR jsonb_typeof(p_thread_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_thread_evaluator_version IS NULL OR length(btrim(p_thread_evaluator_version)) = 0 OR length(p_thread_evaluator_version) > 64
     OR p_thread_policy_version IS NULL OR length(btrim(p_thread_policy_version)) = 0 OR length(p_thread_policy_version) > 64
     OR p_thread_provider IS NULL OR length(btrim(p_thread_provider)) = 0 OR length(p_thread_provider) > 64
     OR p_thread_model IS NULL OR length(btrim(p_thread_model)) = 0 OR length(p_thread_model) > 128
     OR p_thread_prompt_version IS NULL OR length(btrim(p_thread_prompt_version)) = 0 OR length(p_thread_prompt_version) > 64
     OR p_thread_schema_version IS NULL OR p_thread_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_THREAD_PROVENANCE' USING ERRCODE='22023';
  END IF;

  IF p_evaluator_version IS NULL OR length(btrim(p_evaluator_version)) = 0 OR length(p_evaluator_version) > 64
     OR p_policy_version IS NULL OR length(btrim(p_policy_version)) = 0 OR length(p_policy_version) > 64
     OR p_segmentation_provider IS NULL OR length(btrim(p_segmentation_provider)) = 0 OR length(p_segmentation_provider) > 64
     OR p_segmentation_model IS NULL OR length(btrim(p_segmentation_model)) = 0 OR length(p_segmentation_model) > 128
     OR p_segmentation_prompt_version IS NULL OR length(btrim(p_segmentation_prompt_version)) = 0
     OR length(p_segmentation_prompt_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_COMMIT_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_focus_evaluator_version IS NULL OR length(btrim(p_focus_evaluator_version)) = 0 OR length(p_focus_evaluator_version) > 64
     OR p_focus_policy_version IS NULL OR length(btrim(p_focus_policy_version)) = 0 OR length(p_focus_policy_version) > 64
     OR p_focus_provider IS NULL OR length(btrim(p_focus_provider)) = 0 OR length(p_focus_provider) > 64
     OR p_focus_model IS NULL OR length(btrim(p_focus_model)) = 0 OR length(p_focus_model) > 128
     OR p_focus_prompt_version IS NULL OR length(btrim(p_focus_prompt_version)) = 0 OR length(p_focus_prompt_version) > 64
     OR p_focus_schema_version IS NULL OR p_focus_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PROVENANCE' USING ERRCODE='22023';
  END IF;

  unit_count := jsonb_array_length(p_units);
  IF unit_count > max_units THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A commitment batch carries at most 64 committed conversational units.';
  END IF;
  IF jsonb_array_length(p_focus_units) <> unit_count THEN
    RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Exactly one semantic bundle corresponds to exactly one proposed committed CU, in the same order.';
  END IF;
  IF jsonb_array_length(p_thread_units) <> unit_count THEN
    RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Exactly one canonical Thread decision corresponds to exactly one proposed committed CU, in the same order.';
  END IF;

  -- AF66-01: the Session Semantic Clock is the FIRST lock of the semantic
  -- transaction, taken before the source turn, before any semantic row and
  -- long before the user-world spatial authority.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO session_row FROM public.conversation_sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO turn_row FROM public.conversation_turns t
    WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF turn_row.role NOT IN ('USER', 'ASSISTANT') THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_ROLE' USING ERRCODE='22023',
      DETAIL='Only USER and ASSISTANT conversational source is committable in v1.';
  END IF;
  IF turn_row.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'SOURCE_TURN_NOT_COMMITTABLE' USING ERRCODE='55000',
      DETAIL='Provisional, cancelled, failed and superseded source never becomes committed conversational truth.';
  END IF;
  IF session_row.channel <> 'TEXT' THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE='22023';
  END IF;
  derived_digest := sha256(convert_to(turn_row.content, 'UTF8'));
  source_length := length(turn_row.content);

  -- The 1:1 mapping between the commitment payload, the B1 payload and the B2
  -- payload, in order: no missing, extra or duplicate unit, bundle or decision.
  cursor_pos := 0;
  FOR idx IN 0 .. unit_count - 1 LOOP
    unit := p_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(unit)) <> 3
       OR NOT (unit ? 'unit_id') OR NOT (unit ? 'span_start') OR NOT (unit ? 'span_end')
       OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR jsonb_typeof(unit -> 'span_start') <> 'number'
       OR jsonb_typeof(unit -> 'span_end') <> 'number'
       OR (unit ->> 'unit_id') !~* uuid_shape
       OR (unit ->> 'span_start') !~ '^[0-9]{1,9}$'
       OR (unit ->> 'span_end') !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    unit_ids := array_append(unit_ids, (unit ->> 'unit_id')::uuid);
    span_starts := array_append(span_starts, (unit ->> 'span_start')::integer);
    span_ends := array_append(span_ends, (unit ->> 'span_end')::integer);

    IF span_ends[idx + 1] <= span_starts[idx + 1] OR span_ends[idx + 1] > source_length THEN
      RAISE EXCEPTION 'SPAN_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;
    IF idx > 0 AND span_starts[idx + 1] < cursor_pos THEN
      RAISE EXCEPTION 'SPAN_NOT_FORWARD_ORDERED' USING ERRCODE='22023';
    END IF;
    cursor_pos := span_ends[idx + 1];

    unit := p_focus_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (unit ? 'unit_id') OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR (unit ->> 'unit_id') !~* uuid_shape THEN
      RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
        DETAIL='Each semantic bundle names the proposed CU it belongs to, in the same order.';
    END IF;
    IF (unit ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
        DETAIL='Each semantic bundle names the proposed CU it belongs to, in the same order.';
    END IF;

    decision := p_thread_units -> idx;
    IF jsonb_typeof(decision) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (decision ? 'unit_id') OR jsonb_typeof(decision -> 'unit_id') <> 'string'
       OR (decision ->> 'unit_id') !~* uuid_shape THEN
      RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
        DETAIL='Each canonical Thread decision names the proposed CU it belongs to, in the same order.';
    END IF;
    IF (decision ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
        DETAIL='Each canonical Thread decision names the proposed CU it belongs to, in the same order.';
    END IF;
    IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
      establishment_count := establishment_count + 1;
    END IF;
  END LOOP;
  IF unit_count > 1 AND (SELECT count(DISTINCT d.u) FROM unnest(unit_ids) AS d(u)) <> unit_count THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Unit identities inside a commitment batch must be distinct.';
  END IF;

  -- The DB-derived canonical commitment fingerprint, byte-identical to the
  -- 0065 / 0066 derivation so every writer recognises the same batch identity.
  canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'source_role', turn_row.role,
    'speaker_state', derived_speaker,
    'source_modality', derived_modality,
    'source_content_sha256', encode(derived_digest, 'hex'),
    'evaluator_version', p_evaluator_version,
    'policy_version', p_policy_version,
    'segmentation_provider', p_segmentation_provider,
    'segmentation_model', p_segmentation_model,
    'segmentation_prompt_version', p_segmentation_prompt_version,
    'unit_count', unit_count,
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'unit_id', unit_ids[g.i],
               'span_start', span_starts[g.i],
               'span_end', span_ends[g.i]) ORDER BY g.i)
        FROM generate_series(1, unit_count) AS g(i)), '[]'::jsonb));
  fingerprint := sha256(convert_to(canonical::text, 'UTF8'));

  -- The DB-derived canonical B1 SEMANTIC fingerprint, byte-identical to 0066.
  focus_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'focus_evaluator_version', p_focus_evaluator_version,
    'focus_policy_version', p_focus_policy_version,
    'focus_provider', p_focus_provider,
    'focus_model', p_focus_model,
    'focus_prompt_version', p_focus_prompt_version,
    'focus_schema_version', p_focus_schema_version,
    'unit_count', unit_count,
    'focus_units', p_focus_units);
  focus_fingerprint := sha256(convert_to(focus_canonical::text, 'UTF8'));

  -- The DB-derived canonical B2 capture fingerprint. SP allocation, the
  -- same-SP sequence, the audit timestamp and the DB-derived placement are
  -- deliberately EXCLUDED: they are allocation results, never payload identity.
  thread_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'thread_evaluator_version', p_thread_evaluator_version,
    'thread_policy_version', p_thread_policy_version,
    'thread_provider', p_thread_provider,
    'thread_model', p_thread_model,
    'thread_prompt_version', p_thread_prompt_version,
    'thread_schema_version', p_thread_schema_version,
    'unit_count', unit_count,
    'establishment_count', establishment_count,
    'thread_units', p_thread_units);
  thread_fingerprint := sha256(convert_to(thread_canonical::text, 'UTF8'));

  SELECT EXISTS (SELECT 1 FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id) INTO commit_batch_exists;
  SELECT EXISTS (SELECT 1 FROM public.conversation_focus_commit_batches f WHERE f.commit_batch_id = p_batch_id) INTO focus_batch_exists;
  SELECT EXISTS (SELECT 1 FROM public.conversation_thread_commit_batches t WHERE t.commit_batch_id = p_batch_id) INTO thread_batch_exists;

  ---------------------------------------------------------------------------
  -- PATH B - NEW INTEGRATED BATCH. Allowed only when NO layer of this batch
  -- exists yet: partial or legacy state is never completed from today's
  -- inference, because its SP may already be sealed.
  ---------------------------------------------------------------------------
  IF NOT commit_batch_exists AND NOT focus_batch_exists AND NOT thread_batch_exists THEN
    SELECT COALESCE(MAX(cu.source_span_end), 0), COALESCE(MAX(cu.ordinal_within_turn) + 1, 0)
      INTO frontier, next_ordinal
      FROM public.conversation_units cu WHERE cu.source_turn_id = turn_row.id;

    IF unit_count > 0 AND span_starts[1] < frontier THEN
      RAISE EXCEPTION 'SPAN_BEFORE_SOURCE_FRONTIER' USING ERRCODE='22023',
        DETAIL='A later commitment batch may only append source material after the committed source frontier of its turn.';
    END IF;

    INSERT INTO public.conversation_unit_commit_batches (
      id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
      unit_count, evaluator_version, policy_version,
      segmentation_provider, segmentation_model, segmentation_prompt_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, fingerprint, derived_digest,
      unit_count, p_evaluator_version, p_policy_version,
      p_segmentation_provider, p_segmentation_model, p_segmentation_prompt_version);

    INSERT INTO public.conversation_focus_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, canonical_fingerprint,
      focus_evaluator_version, focus_policy_version, focus_provider, focus_model,
      focus_prompt_version, focus_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, focus_fingerprint,
      p_focus_evaluator_version, p_focus_policy_version, p_focus_provider, p_focus_model,
      p_focus_prompt_version, p_focus_schema_version);

    INSERT INTO public.conversation_thread_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, establishment_count,
      canonical_fingerprint, thread_evaluator_version, thread_policy_version,
      thread_provider, thread_model, thread_prompt_version, thread_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, establishment_count,
      thread_fingerprint, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version);

    -- A ZERO-CU batch is a complete evaluation batch: all three capture rows
    -- exist, establishment_count is 0, and no SP, no sequence, no semantic
    -- row, no Thread and no Home is allocated anywhere; both clock
    -- coordinates stay untouched.
    IF unit_count = 0 THEN
      RETURN;
    END IF;

    this_sp := COALESCE(clock_row.current_sp, 0);
    FOR idx IN 1 .. unit_count LOOP
      -- B: this CU is born at the next Session Position.
      this_sp := this_sp + 1;
      IF idx = 1 THEN first_sp := this_sp; END IF;
      INSERT INTO public.conversation_units (
        id, user_id, session_id, source_turn_id, commit_batch_id,
        source_role, speaker_state, source_modality,
        ordinal_within_turn, source_span_start, source_span_end,
        committed_text, source_content_sha256, session_position)
      VALUES (unit_ids[idx], turn_row.user_id, turn_row.session_id, turn_row.id, p_batch_id,
        turn_row.role, derived_speaker, derived_modality,
        next_ordinal + idx - 1, span_starts[idx], span_ends[idx],
        substring(turn_row.content from span_starts[idx] + 1 for span_ends[idx] - span_starts[idx]),
        derived_digest, this_sp)
      RETURNING * INTO inserted_cu;

      -- C + D: this SP becomes the open head; every earlier SP is thereby
      -- sealed, WITH its whole semantic stack already in place.
      UPDATE public.session_semantic_clocks c
         SET current_sp = this_sp, same_sp_event_sequence = 0
       WHERE c.session_id = turn_row.session_id;

      -- E + F: the ONE same-SP sequence authority. B1 is always sequence 1.
      SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
        FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
      IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 1::bigint THEN
        RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The first Stage-6 semantic layer after commitment is sequence 1 on the SP the CU was born at.';
      END IF;

      -- G: the whole T-03B1 semantic bundle of this CU, at (this_sp, 1).
      PERFORM public.persist_conversation_unit_focus_semantics_v1(
        inserted_cu, p_batch_id, p_focus_units -> (idx - 1), reserved_sequence);

      decision := p_thread_units -> (idx - 1);

      -- H: the deterministic DB gates, for BOTH decisions, against the rows
      -- this transaction has already made durable at this exact SP.
      PERFORM public.validate_conversation_thread_decision_v1(inserted_cu, decision);

      -- I: a truthful non-establishment reserves NOTHING: no same-SP event,
      -- no Thread, no Home, no world lock.
      IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
        -- J: the user-world spatial authority, lazily created and then LOCKED.
        -- It is acquired here, long after the Session clock, and it serializes
        -- every concurrent permanent Home allocation of this one user world.
        INSERT INTO public.conversation_world_spatial_authorities (user_id, address_scheme)
        VALUES (turn_row.user_id, 'QANDEEL_OSDAP_V1')
        ON CONFLICT (user_id) DO NOTHING;
        SELECT * INTO authority_row FROM public.conversation_world_spatial_authorities w
          WHERE w.user_id = turn_row.user_id
          FOR UPDATE;
        IF NOT FOUND OR authority_row.address_scheme <> 'QANDEEL_OSDAP_V1' THEN
          RAISE EXCEPTION 'CANONICAL_WORLD_AUTHORITY_MISSING' USING ERRCODE='55000';
        END IF;

        -- The world as it ACTUALLY stands under the lock, and the committed
        -- Homes of the named Conversational Origin members inside it.
        SELECT COALESCE(array_agg(h.thread_id::text ORDER BY h.thread_id), ARRAY[]::text[]),
               COALESCE(array_agg(h.placement_x ORDER BY h.thread_id), ARRAY[]::numeric[]),
               COALESCE(array_agg(h.placement_y ORDER BY h.thread_id), ARRAY[]::numeric[])
          INTO world_thread_ids, world_x, world_y
          FROM public.conversation_thread_homes h
         WHERE h.user_id = turn_row.user_id AND h.address_scheme = authority_row.address_scheme;
        SELECT COALESCE(array_agg(m.value #>> '{}' ORDER BY m.ordinality), ARRAY[]::text[])
          INTO origin_ids
          FROM jsonb_array_elements(decision -> 'origin_thread_ids') WITH ORDINALITY AS m(value, ordinality);

        -- The database is the ONLY permanent-placement authority: the caller
        -- supplies no coordinate, and the placement is recomputed here.
        SELECT p.placement_x, p.placement_y, p.placement_attempt, p.base_x, p.base_y, p.world_fingerprint, p.origin_fingerprint
          INTO placement
          FROM public.compute_canonical_home_placement_v1(
                 turn_row.user_id::text, (decision ->> 'thread_id'), (decision ->> 'origin_state'),
                 origin_ids, world_thread_ids, world_x, world_y) p;

        -- The ONE same-SP sequence authority, at the SP this CU was born at.
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 2::bigint THEN
          RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
            DETAIL='Thread establishment is the second Stage-6 semantic layer on the SP the CU was born at, and B1 must already hold sequence 1 there.';
        END IF;

        PERFORM public.persist_conversation_thread_establishment_v1(
          inserted_cu, p_batch_id, decision, reserved_sequence,
          placement.placement_x, placement.placement_y, placement.placement_attempt,
          placement.base_x, placement.base_y, placement.world_fingerprint, placement.origin_fingerprint);
      END IF;
      -- K: continue with the next CU, which seals this SP.
    END LOOP;

    INSERT INTO public.conversation_unit_commit_events (
      commit_batch_id, user_id, session_id, source_turn_id, first_sp, last_sp, unit_count)
    VALUES (p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, first_sp, this_sp, unit_count);

    RETURN QUERY SELECT cu.* FROM public.conversation_units cu
      WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- PATH A - REPLAY. Every layer must be present: a batch that carries CU and
  -- B1 truth but no B2 capture is PARTIAL / LEGACY state whose SP may already
  -- be sealed, and it is never upgraded, backfilled or completed here.
  ---------------------------------------------------------------------------
  IF NOT (commit_batch_exists AND focus_batch_exists AND thread_batch_exists) THEN
    RAISE EXCEPTION 'THREAD_CAPTURE_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='This commitment batch exists without its complete semantic capture; partial or legacy state is never repaired, upgraded or backfilled from today''s inference.';
  END IF;

  -- The frozen T-03B1b1 writer verifies the CU and B1 layers tuple by tuple
  -- with ZERO mutation and no frontier re-check; then the B2 capture identity
  -- must match exactly.
  PERFORM * FROM public.commit_conversation_units_with_focus_v1(
    p_session_id, p_user_id, p_source_turn_id, p_batch_id, p_units,
    p_evaluator_version, p_policy_version, p_segmentation_provider,
    p_segmentation_model, p_segmentation_prompt_version,
    p_focus_units, p_focus_evaluator_version, p_focus_policy_version,
    p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version);

  SELECT * INTO thread_batch_row FROM public.conversation_thread_commit_batches t WHERE t.commit_batch_id = p_batch_id;
  IF thread_batch_row.user_id <> turn_row.user_id
     OR thread_batch_row.session_id <> turn_row.session_id
     OR thread_batch_row.source_turn_id <> turn_row.id
     OR thread_batch_row.unit_count <> unit_count
     OR thread_batch_row.establishment_count <> establishment_count
     OR thread_batch_row.thread_evaluator_version <> p_thread_evaluator_version
     OR thread_batch_row.thread_policy_version <> p_thread_policy_version
     OR thread_batch_row.thread_provider <> p_thread_provider
     OR thread_batch_row.thread_model <> p_thread_model
     OR thread_batch_row.thread_prompt_version <> p_thread_prompt_version
     OR thread_batch_row.thread_schema_version <> p_thread_schema_version
     OR thread_batch_row.canonical_fingerprint IS DISTINCT FROM thread_fingerprint THEN
    RAISE EXCEPTION 'THREAD_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023',
      DETAIL='A Thread capture batch identity is immutable: the same batch id can never be replayed with a different decision, path, evidence, grounding, identity, origin or provenance.';
  END IF;

  SELECT count(*) INTO stored_events
    FROM public.conversation_thread_establishment_events e
   WHERE e.commit_batch_id = p_batch_id;
  SELECT count(*) INTO stored_threads
    FROM public.conversation_threads t
    JOIN public.conversation_thread_establishment_events e ON e.thread_id = t.id
   WHERE e.commit_batch_id = p_batch_id;
  SELECT count(*) INTO stored_homes
    FROM public.conversation_thread_homes h
    JOIN public.conversation_thread_establishment_events e ON e.thread_id = h.thread_id
   WHERE e.commit_batch_id = p_batch_id;
  IF stored_events <> establishment_count OR stored_threads <> establishment_count OR stored_homes <> establishment_count THEN
    RAISE EXCEPTION 'THREAD_CAPTURE_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='The stored Thread establishments of this batch are incomplete or disagree with their capture row; a Thread without its Home is not repairable state.';
  END IF;

  RETURN QUERY SELECT cu.* FROM public.conversation_units cu
    WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
  RETURN;
END;$$;

-- ===========================================================================
-- 13. The atomic finalized-exchange coordinator. Production-inert: granted to
--     no application role.
--
--     Exactly the 0066 shape, extended by the B2 payloads and provenance:
--     ONE Session clock acquired FIRST and held across both blocks, the two
--     source rows locked, the finalized-exchange relation proved, the
--     stale-context token compared against the LOCKED clock before any
--     canonical mutation, then the USER block and the ASSISTANT block in
--     canonical conversational order. No provider call happens while the lock
--     is held, and the coordinator accepts NO Home coordinate: the database
--     computes the placement under the world lock.
-- ===========================================================================
CREATE FUNCTION public.commit_finalized_exchange_with_focus_and_thread_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_user_source_turn_id uuid,
  p_user_batch_id uuid,
  p_user_units jsonb,
  p_user_focus_units jsonb,
  p_user_thread_units jsonb,
  p_assistant_source_turn_id uuid,
  p_assistant_batch_id uuid,
  p_assistant_units jsonb,
  p_assistant_focus_units jsonb,
  p_assistant_thread_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_expected_current_sp integer,
  p_expected_same_sp_event_sequence bigint
) RETURNS TABLE(
  live_head integer,
  same_sp_event_sequence bigint,
  user_units jsonb,
  assistant_units jsonb,
  user_event jsonb,
  assistant_event jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  user_turn_row public.conversation_turns;
  assistant_turn_row public.conversation_turns;
  both_exist boolean;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL
     OR p_user_source_turn_id IS NULL OR p_assistant_source_turn_id IS NULL
     OR p_user_batch_id IS NULL OR p_assistant_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_user_source_turn_id = p_assistant_source_turn_id OR p_user_batch_id = p_assistant_batch_id THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023',
      DETAIL='A finalized exchange carries two distinct source turns and two distinct commitment batches.';
  END IF;
  IF p_expected_same_sp_event_sequence IS NULL OR p_expected_same_sp_event_sequence < 0
     OR (p_expected_current_sp IS NOT NULL AND p_expected_current_sp < 1) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected semantic-clock token is (current_sp >= 1 or NULL before the first SP, same_sp_event_sequence >= 0).';
  END IF;

  -- AF66-01: exactly ONE Session clock, acquired FIRST and held for the whole
  -- exchange transaction, before every source row, semantic row and world row.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO user_turn_row FROM public.conversation_turns t
    WHERE t.id = p_user_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO assistant_turn_row FROM public.conversation_turns t
    WHERE t.id = p_assistant_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF user_turn_row.role <> 'USER'
     OR user_turn_row.status <> 'COMPLETED'
     OR user_turn_row.source_turn_id IS NOT NULL
     OR assistant_turn_row.role <> 'ASSISTANT'
     OR assistant_turn_row.status <> 'COMPLETED'
     OR assistant_turn_row.source_turn_id IS DISTINCT FROM user_turn_row.id THEN
    RAISE EXCEPTION 'INVALID_FINALIZED_EXCHANGE_RELATION' USING ERRCODE='22023',
      DETAIL='A finalized exchange is one COMPLETED USER source turn and the COMPLETED ASSISTANT turn finalized as its response, in that order.';
  END IF;

  -- Stale-context protection: after the clock lock, before any canonical
  -- mutation. An exact replay of an already-committed pair needs no token.
  both_exist := EXISTS (SELECT 1 FROM public.conversation_unit_commit_batches b WHERE b.id = p_user_batch_id)
            AND EXISTS (SELECT 1 FROM public.conversation_unit_commit_batches b WHERE b.id = p_assistant_batch_id);
  IF NOT both_exist
     AND (clock_row.current_sp IS DISTINCT FROM p_expected_current_sp
          OR clock_row.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence) THEN
    RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' USING ERRCODE='40001',
      DETAIL='The Session Semantic Clock moved after the prior context was read; nothing was written. Re-read the context and evaluate again.';
  END IF;

  -- USER block first, ASSISTANT block second: canonical conversational order.
  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
    INTO user_units
    FROM public.commit_conversation_units_with_focus_and_thread_v1(
      p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id, p_user_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_user_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_user_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal_within_turn), '[]'::jsonb)
    INTO assistant_units
    FROM public.commit_conversation_units_with_focus_and_thread_v1(
      p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_assistant_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_assistant_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version) a;

  SELECT c.current_sp, c.same_sp_event_sequence INTO live_head, same_sp_event_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  SELECT to_jsonb(e) INTO user_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_user_batch_id;
  SELECT to_jsonb(e) INTO assistant_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_assistant_batch_id;
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 14. Ownership, search_path hardening and the PRODUCTION-INERT posture. The
--     new tables are unreachable by every application role; the new writer,
--     coordinator and every internal helper are executable by NO application
--     role; the T-03A2 same-SP seam stays internal; and the existing T-03A2
--     service_role grants are left exactly as they are. No ConversationService
--     or ConversationModule change accompanies this migration, so no Product
--     path can establish a Thread. T-03D owns the final live cutover.
-- ===========================================================================
ALTER TABLE public.conversation_world_spatial_authorities OWNER TO postgres;
ALTER TABLE public.conversation_threads OWNER TO postgres;
ALTER TABLE public.conversation_thread_homes OWNER TO postgres;
ALTER TABLE public.conversation_thread_establishment_events OWNER TO postgres;
ALTER TABLE public.conversation_thread_establishment_evidence OWNER TO postgres;
ALTER TABLE public.conversation_thread_origin_members OWNER TO postgres;
ALTER TABLE public.conversation_thread_commit_batches OWNER TO postgres;
ALTER TABLE public.conversation_world_spatial_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_establishment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_establishment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_origin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_commit_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.conversation_world_spatial_authorities, public.conversation_threads,
  public.conversation_thread_homes, public.conversation_thread_establishment_events,
  public.conversation_thread_establishment_evidence, public.conversation_thread_origin_members,
  public.conversation_thread_commit_batches
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.reject_conversation_thread_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.osdap_floor_div_v1(numeric,numeric) OWNER TO postgres;
ALTER FUNCTION public.osdap_unsigned_v1(bytea,integer,integer) OWNER TO postgres;
ALTER FUNCTION public.osdap_serialize_homes_v1(text[],numeric[],numeric[]) OWNER TO postgres;
ALTER FUNCTION public.osdap_world_fingerprint_v1(text[],numeric[],numeric[]) OWNER TO postgres;
ALTER FUNCTION public.osdap_origin_fingerprint_v1(text,text[],numeric[],numeric[]) OWNER TO postgres;
ALTER FUNCTION public.osdap_attempt_digest_v1(text,text,bytea,bytea,integer) OWNER TO postgres;
ALTER FUNCTION public.osdap_candidate_offset_v1(bytea,numeric) OWNER TO postgres;
ALTER FUNCTION public.osdap_search_admissible_placement_v1(text,text,bytea,bytea,numeric,numeric,numeric[],numeric[]) OWNER TO postgres;
ALTER FUNCTION public.compute_canonical_home_placement_v1(text,text,text,text[],text[],numeric[],numeric[]) OWNER TO postgres;
ALTER FUNCTION public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb) OWNER TO postgres;
ALTER FUNCTION public.persist_conversation_thread_establishment_v1(public.conversation_units,uuid,jsonb,bigint,numeric,numeric,integer,numeric,numeric,bytea,bytea)
  OWNER TO postgres;
ALTER FUNCTION public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)
  OWNER TO postgres;
ALTER FUNCTION public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.reject_conversation_thread_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_floor_div_v1(numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_unsigned_v1(bytea,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_serialize_homes_v1(text[],numeric[],numeric[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_world_fingerprint_v1(text[],numeric[],numeric[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_origin_fingerprint_v1(text,text[],numeric[],numeric[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_attempt_digest_v1(text,text,bytea,bytea,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_candidate_offset_v1(bytea,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.osdap_search_admissible_placement_v1(text,text,bytea,bytea,numeric,numeric,numeric[],numeric[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_canonical_home_placement_v1(text,text,text,text[],text[],numeric[],numeric[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_conversation_thread_establishment_v1(public.conversation_units,uuid,jsonb,bigint,numeric,numeric,integer,numeric,numeric,bytea,bytea)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.conversation_world_spatial_authorities, public.conversation_threads, '
       || 'public.conversation_thread_homes, public.conversation_thread_establishment_events, '
       || 'public.conversation_thread_establishment_evidence, public.conversation_thread_origin_members, '
       || 'public.conversation_thread_commit_batches FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_conversation_thread_mutation_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_floor_div_v1(numeric,numeric) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_unsigned_v1(bytea,integer,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_serialize_homes_v1(text[],numeric[],numeric[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_world_fingerprint_v1(text[],numeric[],numeric[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_origin_fingerprint_v1(text,text[],numeric[],numeric[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_attempt_digest_v1(text,text,bytea,bytea,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_candidate_offset_v1(bytea,numeric) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.osdap_search_admissible_placement_v1(text,text,bytea,bytea,numeric,numeric,numeric[],numeric[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.compute_canonical_home_placement_v1(text,text,text,text[],text[],numeric[],numeric[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.persist_conversation_thread_establishment_v1(public.conversation_units,uuid,jsonb,bigint,numeric,numeric,integer,numeric,numeric,bytea,bytea) FROM service_role';
  -- PRODUCTION-INERT: the integrated writer and the coordinator are executable
  -- by no application role in T-03B2b2. T-03B2b3 owns runtime orchestration
  -- and T-03D owns the final semantic-chain cutover.
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint) FROM service_role';
END IF;END$$;

-- ===========================================================================
-- 15. Terminal self-assertions. The migration refuses to deploy a substrate
--     that is production-reachable, that disturbed the T-03A2 activation or
--     the T-03B1b1 posture, that backfilled anything, or that carries a
--     lifecycle, LF, score, label, merge or parent column.
-- ===========================================================================
DO $$
DECLARE
  thread_writer constant text := 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
  thread_coordinator constant text := 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
  thread_validator constant text := 'public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb)';
  thread_persist constant text := 'public.persist_conversation_thread_establishment_v1(public.conversation_units,uuid,jsonb,bigint,numeric,numeric,integer,numeric,numeric,bytea,bytea)';
  placement_engine constant text := 'public.compute_canonical_home_placement_v1(text,text,text,text[],text[],numeric[],numeric[])';
  placement_search constant text := 'public.osdap_search_admissible_placement_v1(text,text,bytea,bytea,numeric,numeric,numeric[],numeric[])';
  focus_writer constant text := 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
  focus_coordinator constant text := 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
  legacy_producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_coordinator constant text := 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
  legacy_snapshot constant text := 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
  same_sp_helper constant text := 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
  thread_tables constant text[] := ARRAY[
    'public.conversation_world_spatial_authorities', 'public.conversation_threads',
    'public.conversation_thread_homes', 'public.conversation_thread_establishment_events',
    'public.conversation_thread_establishment_evidence', 'public.conversation_thread_origin_members',
    'public.conversation_thread_commit_batches'];
  thread_functions constant text[] := ARRAY[thread_writer, thread_coordinator, thread_validator, thread_persist, placement_engine, placement_search];
  target_role text;
  target_table text;
  target_privilege text;
  target_function text;
  function_row pg_proc;
  row_total bigint;
BEGIN
  -- Nothing was backfilled: every new table is empty, and every canonical one
  -- is append-only for the owner too.
  FOREACH target_table IN ARRAY thread_tables LOOP
    EXECUTE format('SELECT count(*) FROM %s', target_table) INTO STRICT row_total;
    IF row_total <> 0 THEN
      RAISE EXCEPTION 'T-03B2b2 creates a forward-only substrate and backfills nothing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal
                      AND t.tgfoid = 'public.reject_conversation_thread_mutation_v1'::regproc) THEN
      RAISE EXCEPTION 'every T-03B2b2 table must be append-only: % lacks the immutability trigger', target_table;
    END IF;
  END LOOP;

  -- No lifecycle, Live Focus, score, label, merge, parent, Reading, Timeline
  -- or projection column anywhere in the new substrate.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name IN ('conversation_world_spatial_authorities','conversation_threads','conversation_thread_homes',
                                     'conversation_thread_establishment_events','conversation_thread_establishment_evidence',
                                     'conversation_thread_origin_members','conversation_thread_commit_batches')
                AND c.column_name ~* 'lifecycle|dormant|reopen|status|score|confidence|similarity|embedding|rank|importance|label|display_name|normalized|active|sealed|merge|parent|primary_origin|edge_direction|semantic_distance|live_focus|(^|_)lf($|_)|pre_first_sp|timeline|projection|reading|neighborhood|viewport|camera') THEN
    RAISE EXCEPTION 'T-03B2b2 introduces no lifecycle/LF/score/label/merge/parent/Reading/Timeline column';
  END IF;

  -- The structural one-to-one and one-per-focus invariants exist.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k
                  WHERE k.conrelid = 'public.conversation_thread_homes'::regclass AND k.contype = 'p'
                    AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                           FROM unnest(k.conkey) AS ck(attnum)
                           JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ck.attnum) = ARRAY['thread_id']) THEN
    RAISE EXCEPTION 'T-03B2b2 requires exactly ONE permanent Home per Thread (thread_id is the Home primary key)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k
                  WHERE k.conrelid = 'public.conversation_thread_homes'::regclass AND k.contype = 'u'
                    AND k.conname = 'thread_homes_place_unique') THEN
    RAISE EXCEPTION 'T-03B2b2 requires UNIQUE(user_id, address_scheme, placement_x, placement_y)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k
                  WHERE k.conrelid = 'public.conversation_threads'::regclass AND k.contype = 'u'
                    AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                           FROM unnest(k.conkey) AS ck(attnum)
                           JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ck.attnum) = ARRAY['grounding_emerging_focus_id']) THEN
    RAISE EXCEPTION 'T-03B2b2 requires an immutable one-to-one EmergingFocus -> Thread lineage';
  END IF;

  -- Function identity, security posture and search path.
  FOREACH target_function IN ARRAY thread_functions LOOP
    SELECT * INTO function_row FROM pg_proc WHERE oid = to_regprocedure(target_function);
    IF NOT FOUND THEN RAISE EXCEPTION 'a T-03B2b2 function is missing: %', target_function; END IF;
    IF pg_get_userbyid(function_row.proowner) <> 'postgres' OR NOT function_row.prosecdef
       OR NOT EXISTS (SELECT 1 FROM unnest(function_row.proconfig) AS entry(setting)
                       WHERE entry.setting LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'T-03B2b2 functions must stay postgres-owned, SECURITY DEFINER and search_path-fixed: %', target_function;
    END IF;
  END LOOP;

  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      -- PRODUCTION-INERT: no application role executes anything new, and the
      -- T-03B1b1 writer / coordinator and the T-03A2 seam stay ungranted.
      FOREACH target_function IN ARRAY thread_functions || ARRAY[focus_writer, focus_coordinator, same_sp_helper] LOOP
        IF has_function_privilege(target_role, target_function, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B2b2 is production-inert: % must not execute %', target_role, target_function;
        END IF;
      END LOOP;
      -- The T-03A2 activation is untouched.
      IF target_role = 'service_role' THEN
        IF NOT has_function_privilege(target_role, legacy_producer, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_coordinator, 'EXECUTE')
           OR NOT has_function_privilege(target_role, legacy_snapshot, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03B2b2 must leave the T-03A2 service_role grants exactly in place';
        END IF;
      ELSIF has_function_privilege(target_role, legacy_producer, 'EXECUTE')
         OR has_function_privilege(target_role, legacy_coordinator, 'EXECUTE') THEN
        RAISE EXCEPTION 'the canonical producer must never be executable by %', target_role;
      END IF;
      -- No application role may read or write any Thread table directly.
      FOREACH target_table IN ARRAY thread_tables LOOP
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'the Thread substrate must stay unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  -- The clock itself is unchanged: still exactly SP and the internal sequence.
  IF (SELECT array_agg(c.column_name::text ORDER BY c.column_name) FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'session_semantic_clocks')
     <> ARRAY['current_sp','same_sp_event_sequence','session_id','user_id'] THEN
    RAISE EXCEPTION 'T-03B2b2 must not alter the Session Semantic Clock';
  END IF;
END$$;

COMMIT;
