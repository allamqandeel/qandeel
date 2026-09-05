-- T-03C - Historical Coverage Completion + Layer A Projection + Layer B
-- Disclosure v1, one Architecture-sized task.
--
-- Stage 6 froze the temporal constitution this migration serves:
--
--   1 committed CU = 1 Moment           SP = gapless per-Session committed-CU ordinal
--   LH = greatest committed SP          TC = the effective selected Session Position
--   K(TC) = TemporalProject(W, TC)      V  = Disclose(K(TC), semanticDepth, inspectionContext)
--
-- and the availability law the whole task implements (Stage 6.6 v3, REV66-06
-- .. REV66-08; release conditions R-C1 .. R-C5):
--
--   KF(x)      = the earliest Session Position at which x is legitimately known
--                in THIS Session's projection - recorded, never inferred.
--   Known(x,t) = KF(x) <= t.   Current(v,t) is evaluated separately.
--   ANCHOR TO ACTUAL CANONICAL AVAILABILITY, NEVER TO CAUSAL SOURCE.
--   No created_at / CURRENT_TIMESTAMP / clock_timestamp() ever decides
--   availability; a sealed SP is never reopened; no caller authors an SP.
--
-- What this migration builds (event capture, never content migration):
--
--   1. the per-user WORLD SEMANTIC CLOCK: one server-owned monotonic version
--      per user Conversation World, acquired AFTER the Session Semantic Clock
--      and BEFORE any analytical row lock. Every canonical analytical fact of
--      the user receives exactly one world version at the instant it becomes
--      canonical. Because the lock is held until commit, world versions commit
--      in version order, so a cut of the clock is an exact cut of committed
--      truth - the race-free SessionHistoricalBaseline REV66-07 requires;
--   2. SESSION HISTORICAL COVERAGE (R-C1): evaluated ONCE at Session creation.
--      Every Session that exists before this migration is a LEGACY UNCOVERED
--      SESSION: the Conversation Runtime continues normally in it (committed
--      CUs, Session Positions, LH, the frozen T-03B / T-03D chain), but it
--      stays historical-disabled through closure - no baseline is ever cut
--      for it and the projection fails closed - so no partial Timeline is
--      ever addressable. Coverage gates historical projection, never runtime;
--   3. SESSION HISTORICAL BASELINES: the world-clock cut taken inside the very
--      transaction that assigns SP(1), before it commits. A fact whose world
--      version is <= the baseline is PRE_FIRST_SP for that Session: available
--      at every addressable SP, never a Moment, never exposed;
--   4. typed, append-only SP-native availability / validity EVENT tables for
--      every legacy family exposed by v1 V: Reading identity / status,
--      Evidence participation, peer Reading relations, Material identity /
--      status, Information Gap identity / epoch lifecycle, Question identity,
--      Confidence evaluations, the Formal Question <-> Turn appearance, and
--      the Thread's world availability. Each event carries its OWN anchor:
--      (session_id, session_position, same_sp_event_sequence) when the
--      write is canonically associated with a Session through a server-owned
--      relation, and always a world version. Parent knowledge never
--      substitutes for a child's anchor;
--   5. the Thread <-> Reading contextual appearance substrate
--      (thread_reading_bindings, validity-aware: bound_sp .. unbound_sp) and
--      its writers, executable by NO application role: T-03C owns the
--      historical truth of this appearance and its projection. The frozen rule
--      binds a Reading to a Thread only when the Reading's canonical subject
--      grounding legitimately resolves to that Thread, so R2 adds the
--      CANONICAL READING SUBJECT-GROUNDING AUTHORITY (sections 5A, 11A, 12A):
--      a typed relation from a Hypothesis-backed Reading to the frozen B1
--      stable focus identity (emerging_focus_id), born only inside the durable
--      post-response generation - the SERVER builds a bounded universe of the
--      committed focuses of the execution's Session as opaque handles, the
--      provider proposes a subset of those handles and nothing else, the
--      server authorizes the proposal against the exact stored universe, and
--      the grounding becomes canonical atomically with the Hypothesis it
--      grounds. The A-1 appearance is DERIVED from that grounding and the
--      canonical focus -> Thread truth of 0068 / 0070 by two triggers, at its
--      own availability boundary. Nothing is inferred from a label, string
--      similarity, an embedding, Evidence or peer co-occurrence, the current
--      LF, geometry or a caller-supplied identity; legacy Hypotheses receive
--      no grounding and no appearance;
--   6. R-C2 preservation guards on the canonical legacy rows historical V
--      reads (physical DELETE refused; the historical fields of hypotheses,
--      memories, question_candidates and confidence_evaluations immutable;
--      information_gaps keep the 0063 byte-identity guard and gain the DELETE
--      refusal), plus R-C3: the legacy Evidence-attach paths of migrations
--      0005 / 0008 / 0021 / 0028 keep their live entrypoints and grants, and
--      every write they make to public.hypotheses passes the ONE capture hook
--      (tracked; world-only when unassociated) - no untracked participation
--      can be authored any more;
--   7. the live post-response writers enter the historical boundary without a
--      single caller change: the three managed commands keep their exact
--      public name, signature and grant, their frozen bodies survive
--      byte-for-byte under an internal *_core name executable by NO
--      application role, and the public name is now the clock-acquiring entry;
--      the Information Gap synchronization entry delegates to its v2 authority
--      after the same capture step; background Memory creation gains a
--      command that derives owner AND Session from the durable execution;
--   8. R-C5: Material expiry mapped into Session Position space
--      (historical_memory_expiry_at_sp_v1) - never expires_at compared to TC;
--   9. Layer A: get_session_historical_projection_v1(session, TC), the
--      owner-scoped, coverage-gated, fail-closed K(TC) over every family.
--
-- Lock order of every T-03C semantic writer, provable from the bodies below:
--
--   Session Semantic Clock FOR UPDATE (when a Session association exists)
--     -> same-SP sequence reservation through the ONE 0065 seam
--     -> World Semantic Clock FOR UPDATE (+1)
--     -> the analytical rows the frozen command locks itself
--
-- The frozen writers 0065-0071 are untouched: the T-03C hooks on
-- conversation_units and conversation_threads run INSIDE their transaction,
-- after their own Session-clock lock, and acquire only the world clock.
--
-- Migrations 0001-0071 are byte-identical. Legacy rows are read exactly once,
-- at migration time, to seed their LEGACY BASELINE events (world version 0:
-- canonical before capture began, therefore PRE_FIRST_SP for every covered
-- Session). No legacy row is rewritten. Audit timestamps exist only as audit
-- metadata; the ONE place a wall-clock value participates is the explicit,
-- deterministic R-C5 expiry mapping.

BEGIN;

-- ===========================================================================
-- 0. Preconditions: the frozen UTF-8 contract and every 0064-0071 object this
--    migration extends, hooks or reuses.
-- ===========================================================================
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03C requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF to_regprocedure('public.reserve_session_same_sp_event_v1(uuid,uuid)') IS NULL
     OR to_regprocedure('public.canonical_uuid_v5_v1(uuid,text)') IS NULL
     OR to_regprocedure('public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer)') IS NULL
     OR to_regprocedure('public.conversation_session_live_focus_before_v1(uuid,integer)') IS NULL
     OR to_regprocedure('public.persist_post_response_hypothesis_generation_v1(uuid)') IS NULL
     OR to_regprocedure('public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb)') IS NULL
     OR to_regprocedure('public.execute_post_response_confidence_batch_v1(uuid)') IS NULL
     OR to_regprocedure('public.sync_post_response_information_gaps_v1(uuid)') IS NULL
     OR to_regprocedure('public.sync_post_response_information_gaps_v2(uuid)') IS NULL
     OR to_regprocedure('public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)') IS NULL
     OR to_regprocedure('public.attach_hypothesis_evidence(uuid,text,text)') IS NULL
     OR to_regprocedure('public.background_attach_hypothesis_evidence_v1(uuid,uuid,text,text)') IS NULL
     OR to_regprocedure('public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)') IS NULL
     OR to_regclass('public.session_semantic_clocks') IS NULL
     OR to_regclass('public.conversation_units') IS NULL
     OR to_regclass('public.conversation_emerging_focuses') IS NULL
     OR to_regclass('public.conversation_emerging_focus_attention_events') IS NULL
     OR to_regclass('public.conversation_threads') IS NULL
     OR to_regclass('public.conversation_thread_homes') IS NULL
     OR to_regclass('public.conversation_thread_focus_bindings') IS NULL
     OR to_regclass('public.conversation_thread_lifecycle_events') IS NULL
     OR to_regclass('public.conversation_live_focus_transitions') IS NULL
     OR to_regclass('public.hypotheses') IS NULL
     OR to_regclass('public.memories') IS NULL
     OR to_regclass('public.information_gaps') IS NULL
     OR to_regclass('public.question_candidates') IS NULL
     OR to_regclass('public.confidence_evaluations') IS NULL
     OR to_regclass('public.formal_question_turn_bindings') IS NULL
     OR to_regclass('public.post_response_intelligence_executions') IS NULL
     OR to_regclass('public.post_response_intelligence_effects') IS NULL THEN
    RAISE EXCEPTION 'T-03C requires the T-03A2 clock and seam, the T-03B1b1 / T-03B2b2 / T-03B3 / T-03D substrates, the 0068 identity authority and the legacy analytical families'
      USING ERRCODE='55000';
  END IF;
END$$;

-- ===========================================================================
-- 1. The World Semantic Clock. One permanent row per user Conversation World,
--    holding the current world version. It is acquired FOR UPDATE by every
--    T-03C canonical write (after the Session Semantic Clock, when one is
--    associated) and advances by exactly one per write transaction; the
--    guard below makes any other change impossible. Because the row lock is
--    held until commit, versions COMMIT in version order: a baseline read
--    under the same lock is an exact cut of committed truth (no in-flight
--    lower version can appear later), which is what makes PRE_FIRST_SP
--    membership race-free without any timestamp (REV66-06 / REV66-07).
--
--    Version 0 is reserved for the LEGACY BASELINE: facts already canonical
--    when this migration ran. No timestamp column exists here at all.
-- ===========================================================================
CREATE TABLE public.historical_world_semantic_clocks (
  user_id uuid PRIMARY KEY,
  current_version bigint NOT NULL DEFAULT 0,
  CONSTRAINT historical_world_semantic_clocks_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT historical_world_semantic_clocks_version_check CHECK (current_version >= 0)
);

CREATE FUNCTION public.guard_historical_world_semantic_clock_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'WORLD_SEMANTIC_CLOCK_IS_PERMANENT' USING ERRCODE='55000',
      DETAIL='The user/world semantic version is a permanent technical row: DELETE is refused for every role.';
  END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.current_version <> OLD.current_version + 1 THEN
    RAISE EXCEPTION 'WORLD_SEMANTIC_CLOCK_IS_MONOTONIC' USING ERRCODE='55000',
      DETAIL='The user/world semantic version only ever advances by exactly one; nothing else on the row may change.';
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER historical_world_semantic_clocks_guard
  BEFORE UPDATE OR DELETE ON public.historical_world_semantic_clocks
  FOR EACH ROW EXECUTE FUNCTION public.guard_historical_world_semantic_clock_v1();

-- ===========================================================================
-- 2. R-C1 - Session historical coverage and the Session historical baseline.
--
--    Coverage is technical release safety metadata, decided ONCE at Session
--    creation and never changed: a Session created after this migration is
--    COVERED (Path A - it began after every capture authority was active);
--    every Session that already existed is a LEGACY UNCOVERED SESSION and
--    stays historical-disabled through closure. Coverage is not KF, not a
--    Product state, not a temporal mode and never exposed in V.
--
--    Coverage decides HISTORICAL PROJECTION eligibility only. Committed-CU
--    runtime eligibility is a different thing: a LEGACY UNCOVERED SESSION
--    keeps committing CUs and Session Positions through the frozen runtime
--    authority (LH advances, the T-03B / T-03D semantic chain runs), it simply
--    never receives a baseline (section 8) and is refused by the projection
--    (section 14) - so no PINNED historical semantics and no partial Timeline
--    ever become addressable for it, while the user continues the Session.
--
--    The baseline is written by the committed-CU hook (section 8), for a
--    COVERED Session only, inside the transaction that assigns SP(1), under
--    the Session Semantic Clock that transaction already holds and under the
--    World Semantic Clock it takes there: no race gap exists between the
--    baseline and SP(1).
-- ===========================================================================
CREATE TABLE public.session_historical_coverage (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  coverage_state text NOT NULL,
  CONSTRAINT session_historical_coverage_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT session_historical_coverage_state_check CHECK (coverage_state IN ('COVERED', 'LEGACY_UNCOVERED'))
);

CREATE TABLE public.session_historical_baselines (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  baseline_world_version bigint NOT NULL,
  CONSTRAINT session_historical_baselines_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT session_historical_baselines_coverage_fk
    FOREIGN KEY (session_id) REFERENCES public.session_historical_coverage (session_id) ON DELETE RESTRICT,
  CONSTRAINT session_historical_baselines_version_check CHECK (baseline_world_version >= 0)
);

-- Every Session that exists when this migration runs is a LEGACY UNCOVERED
-- SESSION. This is the only row this migration ever writes about a Session.
INSERT INTO public.session_historical_coverage (session_id, user_id, coverage_state)
SELECT s.id, s.user_id, 'LEGACY_UNCOVERED' FROM public.conversation_sessions s;

-- Every FUTURE Session is COVERED atomically with its own insertion.
CREATE FUNCTION public.provision_session_historical_coverage_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.session_historical_coverage (session_id, user_id, coverage_state)
  VALUES (NEW.id, NEW.user_id, 'COVERED')
  ON CONFLICT (session_id) DO NOTHING;
  RETURN NULL;
END;$$;

CREATE TRIGGER conversation_sessions_provision_historical_coverage
  AFTER INSERT ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.provision_session_historical_coverage_v1();

-- ===========================================================================
-- 3. Thread world availability. A Thread is a user/world-global identity
--    (0068). Inside its establishing Session its availability is its
--    established_sp; in every other Session it is PRE_FIRST_SP iff its world
--    version is at or below that Session's baseline, and otherwise it enters
--    only through an explicit canonical association (a 0070 continuity
--    binding at its bound_sp). The hook in section 8 stamps every new Thread
--    with the world version the establishing transaction takes; existing
--    Threads are seeded at version 0 (legacy baseline).
-- ===========================================================================
CREATE TABLE public.historical_thread_availability (
  thread_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  world_version bigint NOT NULL,
  CONSTRAINT historical_thread_availability_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT historical_thread_availability_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT historical_thread_availability_version_check CHECK (world_version >= 0)
);

-- ===========================================================================
-- 4. Typed SP-native availability / validity events, one table per family.
--    Common anchor columns of every event row:
--
--      session_id              the server-owned Session association, or NULL
--                              when the writer could not be associated
--      session_position        the OPEN Session Position the event was
--                              anchored to (NULL when unassociated, and NULL
--                              when the Session had no SP yet - then the
--                              baseline decides PRE_FIRST_SP membership)
--      same_sp_event_sequence  the 0065 seam's deterministic same-SP order
--                              (0 = born inside the Moment's own commit)
--      world_version           the World Semantic Clock version (0 = legacy)
--
--    Availability of an event in Session S at TC is exactly:
--      (session_id = S AND session_position <= TC) OR world_version <= baseline(S)
--    Nothing here is a Moment, a temporal mode or a client-visible coordinate.
-- ===========================================================================
CREATE TABLE public.historical_reading_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  hypothesis_id uuid NOT NULL,
  event_kind text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  from_version integer,
  to_version integer NOT NULL,
  session_id uuid,
  session_position integer,
  same_sp_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_reading_events_owner_fk
    FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_reading_events_kind_check CHECK (event_kind IN ('LEGACY_BASELINE', 'CREATED', 'STATUS_TRANSITION', 'VERSION_ADVANCED')),
  CONSTRAINT historical_reading_events_shape_check CHECK (
    (event_kind IN ('LEGACY_BASELINE', 'CREATED') AND from_status IS NULL AND from_version IS NULL)
    OR (event_kind = 'STATUS_TRANSITION' AND from_status IS NOT NULL AND from_version IS NOT NULL AND from_status <> to_status)
    OR (event_kind = 'VERSION_ADVANCED' AND from_status IS NOT NULL AND from_version IS NOT NULL AND from_status = to_status AND from_version < to_version)),
  CONSTRAINT historical_reading_events_version_check CHECK (to_version >= 1 AND (from_version IS NULL OR from_version >= 1)),
  CONSTRAINT historical_reading_events_anchor_check CHECK (
    (session_position IS NULL) = (same_sp_event_sequence IS NULL)
    AND (session_id IS NOT NULL OR session_position IS NULL)
    AND (session_position IS NULL OR session_position >= 1)
    AND (same_sp_event_sequence IS NULL OR same_sp_event_sequence >= 0)
    AND world_version >= 0)
);
CREATE INDEX historical_reading_events_subject_idx ON public.historical_reading_events (hypothesis_id, world_version);
CREATE INDEX historical_reading_events_session_idx ON public.historical_reading_events (session_id, session_position);

CREATE TABLE public.historical_evidence_participation_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  hypothesis_id uuid NOT NULL,
  evidence_id text NOT NULL,
  evidence_role text NOT NULL,
  event_kind text NOT NULL,
  reading_version integer NOT NULL,
  session_id uuid,
  session_position integer,
  same_sp_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_evidence_participation_owner_fk
    FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_evidence_participation_evidence_check CHECK (evidence_id ~ '^memory:[0-9a-fA-F-]{36}$'),
  CONSTRAINT historical_evidence_participation_role_check CHECK (evidence_role IN ('SUPPORTING', 'CONTRADICTING')),
  CONSTRAINT historical_evidence_participation_kind_check CHECK (event_kind IN ('LEGACY_BASELINE', 'ATTACHED', 'DETACHED')),
  CONSTRAINT historical_evidence_participation_version_check CHECK (reading_version >= 1),
  CONSTRAINT historical_evidence_participation_anchor_check CHECK (
    (session_position IS NULL) = (same_sp_event_sequence IS NULL)
    AND (session_id IS NOT NULL OR session_position IS NULL)
    AND (session_position IS NULL OR session_position >= 1)
    AND (same_sp_event_sequence IS NULL OR same_sp_event_sequence >= 0)
    AND world_version >= 0)
);
CREATE INDEX historical_evidence_participation_subject_idx ON public.historical_evidence_participation_events (hypothesis_id, world_version);

CREATE TABLE public.historical_reading_relation_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  hypothesis_a uuid NOT NULL,
  hypothesis_b uuid NOT NULL,
  event_kind text NOT NULL,
  session_id uuid,
  session_position integer,
  same_sp_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_reading_relation_a_fk
    FOREIGN KEY (hypothesis_a, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_reading_relation_b_fk
    FOREIGN KEY (hypothesis_b, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_reading_relation_order_check CHECK (hypothesis_a < hypothesis_b),
  CONSTRAINT historical_reading_relation_kind_check CHECK (event_kind IN ('LEGACY_BASELINE', 'LINKED', 'UNLINKED')),
  CONSTRAINT historical_reading_relation_anchor_check CHECK (
    (session_position IS NULL) = (same_sp_event_sequence IS NULL)
    AND (session_id IS NOT NULL OR session_position IS NULL)
    AND (session_position IS NULL OR session_position >= 1)
    AND (same_sp_event_sequence IS NULL OR same_sp_event_sequence >= 0)
    AND world_version >= 0)
);
CREATE INDEX historical_reading_relation_pair_idx ON public.historical_reading_relation_events (hypothesis_a, hypothesis_b, world_version);

CREATE TABLE public.historical_material_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  memory_id uuid NOT NULL,
  event_kind text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  memory_version integer NOT NULL,
  supersedes_memory_id uuid,
  session_id uuid,
  session_position integer,
  same_sp_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_material_events_owner_fk
    FOREIGN KEY (memory_id, user_id) REFERENCES public.memories (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_material_events_kind_check CHECK (event_kind IN ('LEGACY_BASELINE', 'CREATED', 'STATUS_TRANSITION')),
  CONSTRAINT historical_material_events_status_check CHECK (
    to_status IN ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED', 'DISABLED', 'PENDING_CONFIRMATION')
    AND (from_status IS NULL OR from_status IN ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED', 'DISABLED', 'PENDING_CONFIRMATION'))),
  CONSTRAINT historical_material_events_shape_check CHECK (
    (event_kind IN ('LEGACY_BASELINE', 'CREATED') AND from_status IS NULL)
    OR (event_kind = 'STATUS_TRANSITION' AND from_status IS NOT NULL AND from_status <> to_status)),
  CONSTRAINT historical_material_events_version_check CHECK (memory_version >= 1),
  CONSTRAINT historical_material_events_anchor_check CHECK (
    (session_position IS NULL) = (same_sp_event_sequence IS NULL)
    AND (session_id IS NOT NULL OR session_position IS NULL)
    AND (session_position IS NULL OR session_position >= 1)
    AND (same_sp_event_sequence IS NULL OR same_sp_event_sequence >= 0)
    AND world_version >= 0)
);
CREATE INDEX historical_material_events_subject_idx ON public.historical_material_events (memory_id, world_version);

CREATE TABLE public.historical_gap_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  information_gap_id uuid NOT NULL,
  event_kind text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  open_epoch integer NOT NULL,
  closure_reason text,
  session_id uuid,
  session_position integer,
  same_sp_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_gap_events_owner_fk
    FOREIGN KEY (information_gap_id, user_id) REFERENCES public.information_gaps (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_gap_events_kind_check CHECK (event_kind IN ('LEGACY_BASELINE', 'CREATED', 'CLOSED', 'REOPENED')),
  CONSTRAINT historical_gap_events_status_check CHECK (
    to_status IN ('OPEN', 'RESOLVED', 'SUPERSEDED') AND (from_status IS NULL OR from_status IN ('OPEN', 'RESOLVED', 'SUPERSEDED'))),
  CONSTRAINT historical_gap_events_shape_check CHECK (
    (event_kind IN ('LEGACY_BASELINE', 'CREATED') AND from_status IS NULL)
    OR (event_kind = 'CLOSED' AND from_status = 'OPEN' AND to_status IN ('RESOLVED', 'SUPERSEDED') AND closure_reason IS NOT NULL)
    OR (event_kind = 'REOPENED' AND from_status IN ('RESOLVED', 'SUPERSEDED') AND to_status = 'OPEN' AND closure_reason IS NULL)),
  CONSTRAINT historical_gap_events_epoch_check CHECK (open_epoch >= 1),
  CONSTRAINT historical_gap_events_anchor_check CHECK (
    (session_position IS NULL) = (same_sp_event_sequence IS NULL)
    AND (session_id IS NOT NULL OR session_position IS NULL)
    AND (session_position IS NULL OR session_position >= 1)
    AND (same_sp_event_sequence IS NULL OR same_sp_event_sequence >= 0)
    AND world_version >= 0)
);
CREATE INDEX historical_gap_events_subject_idx ON public.historical_gap_events (information_gap_id, world_version);

CREATE TABLE public.historical_question_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  question_candidate_id uuid NOT NULL,
  event_kind text NOT NULL,
  session_id uuid,
  session_position integer,
  same_sp_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_question_events_subject_fk
    FOREIGN KEY (question_candidate_id) REFERENCES public.question_candidates (id) ON DELETE RESTRICT,
  CONSTRAINT historical_question_events_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT historical_question_events_kind_check CHECK (event_kind IN ('LEGACY_BASELINE', 'CREATED')),
  CONSTRAINT historical_question_events_anchor_check CHECK (
    (session_position IS NULL) = (same_sp_event_sequence IS NULL)
    AND (session_id IS NOT NULL OR session_position IS NULL)
    AND (session_position IS NULL OR session_position >= 1)
    AND (same_sp_event_sequence IS NULL OR same_sp_event_sequence >= 0)
    AND world_version >= 0)
);

CREATE TABLE public.historical_confidence_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  confidence_evaluation_id uuid NOT NULL,
  hypothesis_id uuid NOT NULL,
  target_version integer NOT NULL,
  event_kind text NOT NULL,
  session_id uuid,
  session_position integer,
  same_sp_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_confidence_events_owner_fk
    FOREIGN KEY (confidence_evaluation_id, user_id) REFERENCES public.confidence_evaluations (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_confidence_events_target_fk
    FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_confidence_events_kind_check CHECK (event_kind IN ('LEGACY_BASELINE', 'CREATED')),
  CONSTRAINT historical_confidence_events_version_check CHECK (target_version >= 1),
  CONSTRAINT historical_confidence_events_anchor_check CHECK (
    (session_position IS NULL) = (same_sp_event_sequence IS NULL)
    AND (session_id IS NOT NULL OR session_position IS NULL)
    AND (session_position IS NULL OR session_position >= 1)
    AND (same_sp_event_sequence IS NULL OR same_sp_event_sequence >= 0)
    AND world_version >= 0)
);
CREATE INDEX historical_confidence_events_target_idx ON public.historical_confidence_events (hypothesis_id, world_version);

-- The Formal Question <-> Turn appearance is Session-bound by construction:
-- it becomes conversationally canonical when the exchange it was consumed by
-- becomes committed Moments, so its anchor is always (session, SP, 0) - born
-- inside the committing transaction of the exchange's first committed CU.
CREATE TABLE public.historical_question_appearance_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  binding_id uuid NOT NULL UNIQUE,
  session_id uuid NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historical_question_appearance_binding_fk
    FOREIGN KEY (binding_id) REFERENCES public.formal_question_turn_bindings (id) ON DELETE RESTRICT,
  CONSTRAINT historical_question_appearance_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT historical_question_appearance_sp_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT historical_question_appearance_anchor_check CHECK (
    session_position >= 1 AND same_sp_event_sequence = 0 AND world_version >= 0)
);

-- ===========================================================================
-- 5. The Thread <-> Reading contextual appearance (Stage 6.5 v3 SDM-02
--    "Reading <-> Thread binding", Stage 6.6 matrix row A-1). Owner-scoped,
--    Session-scoped, validity-aware: a binding is current at TC iff
--    bound_sp <= TC < COALESCE(unbound_sp, infinity). Binding never duplicates
--    Reading identity and never creates ownership; one Reading may carry
--    several legitimate appearances. The row is immutable except for the ONE
--    unbind transition (unbound_sp / unbound_event_sequence NULL -> value).
-- ===========================================================================
CREATE TABLE public.thread_reading_bindings (
  binding_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  hypothesis_id uuid NOT NULL,
  bound_sp integer NOT NULL,
  bound_event_sequence bigint NOT NULL,
  unbound_sp integer,
  unbound_event_sequence bigint,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT thread_reading_bindings_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_reading_bindings_thread_fk
    FOREIGN KEY (thread_id) REFERENCES public.conversation_threads (id) ON DELETE RESTRICT,
  CONSTRAINT thread_reading_bindings_reading_fk
    FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT thread_reading_bindings_bound_sp_fk
    FOREIGN KEY (session_id, bound_sp) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT thread_reading_bindings_validity_check CHECK (
    bound_sp >= 1 AND bound_event_sequence >= 1
    AND ((unbound_sp IS NULL) = (unbound_event_sequence IS NULL))
    AND (unbound_sp IS NULL OR unbound_sp >= bound_sp)
    AND (unbound_event_sequence IS NULL OR unbound_event_sequence >= 1)
    AND world_version >= 1)
);
CREATE UNIQUE INDEX thread_reading_bindings_one_current
  ON public.thread_reading_bindings (session_id, thread_id, hypothesis_id) WHERE unbound_sp IS NULL;

CREATE FUNCTION public.guard_thread_reading_binding_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE' USING ERRCODE='55000',
      DETAIL='A Thread <-> Reading appearance is canonical history: DELETE is refused for every role.';
  END IF;
  IF OLD.unbound_sp IS NOT NULL
     OR NEW.unbound_sp IS NULL
     OR (to_jsonb(OLD) - 'unbound_sp' - 'unbound_event_sequence') <> (to_jsonb(NEW) - 'unbound_sp' - 'unbound_event_sequence') THEN
    RAISE EXCEPTION 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE' USING ERRCODE='55000',
      DETAIL='The only permitted change of a Thread <-> Reading appearance is its ONE unbind transition.';
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER thread_reading_bindings_guard
  BEFORE UPDATE OR DELETE ON public.thread_reading_bindings
  FOR EACH ROW EXECUTE FUNCTION public.guard_thread_reading_binding_mutation_v1();

-- ===========================================================================
-- 5A. The canonical Reading subject grounding (R2). Stage 1.9 freezes
--     Reading <-> Hypothesis as PARTIAL: the Hypothesis keeps its analytical
--     identity, statement, type / domain / scope / origin, lifecycle and
--     version, Evidence semantics, assumptions / disconfirming conditions,
--     Confidence integration and update loop untouched, and subject grounding
--     is ADDITIONAL canonical truth, never a replacement. Four things stay
--     apart, in types, persistence, proofs and docs:
--
--       A. analytical identity          public.hypotheses (frozen)
--       B. subject grounding            public.hypothesis_subject_groundings:
--                                       "this analytical object is
--                                       substantively about this canonical
--                                       conversational focus, on inspectable
--                                       committed conversational grounding"
--       C. Thread contextual appearance public.thread_reading_bindings (A-1),
--                                       DERIVED from B plus the canonical
--                                       focus -> Thread truth of 0068 / 0070
--       D. Evidence participation       the supporting / contradicting
--                                       Evidence ids: inferential bearing on
--                                       the claim, never Thread membership
--
--     The grounding target is the frozen B1 stable focus identity
--     (conversation_emerging_focuses.id, the emerging_focus_id): the SAME
--     handle Thread establishment (0068, grounding_emerging_focus_id) and
--     cross-Session continuity (0070, conversation_thread_focus_bindings)
--     resolve. No second focus ontology exists, and a grounding may exist
--     while its focus is still Emerging: SubjectGrounding <> ThreadBinding.
--
--     A grounding is born ONLY inside the durable post-response generation
--     (section 11A): the universe of legitimately groundable focuses is built
--     by the server from committed truth and stored per execution (5A.2), the
--     provider's selection is validated against that exact universe and
--     stored per execution (5A.3), and the grounding row (5A.1) is written by
--     the persistence command atomically with the Hypothesis it grounds,
--     anchored at actual canonical availability through the execution's
--     Session association (SP, same-SP sequence, world version) - never at
--     the causal source turn. Every row is append-only; no application role
--     reaches any of the three tables.
-- ===========================================================================
CREATE TABLE public.hypothesis_subject_groundings (
  grounding_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  hypothesis_id uuid NOT NULL,
  session_id uuid NOT NULL,
  emerging_focus_id uuid NOT NULL,
  execution_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  universe_frontier_sp integer NOT NULL,
  session_position integer NOT NULL,
  same_sp_event_sequence bigint NOT NULL,
  world_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hypothesis_subject_groundings_owner_fk
    FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_groundings_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_groundings_focus_fk
    FOREIGN KEY (emerging_focus_id) REFERENCES public.conversation_emerging_focuses (id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_groundings_execution_fk
    FOREIGN KEY (execution_id) REFERENCES public.post_response_intelligence_executions (id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_groundings_anchor_fk
    FOREIGN KEY (session_id, session_position) REFERENCES public.conversation_units (session_id, session_position) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_groundings_one_per_focus UNIQUE (hypothesis_id, emerging_focus_id),
  CONSTRAINT hypothesis_subject_groundings_anchor_check CHECK (
    universe_frontier_sp >= 1 AND session_position >= universe_frontier_sp
    AND same_sp_event_sequence >= 1 AND world_version >= 1)
);
CREATE INDEX hypothesis_subject_groundings_focus_idx
  ON public.hypothesis_subject_groundings (emerging_focus_id, session_id);
CREATE INDEX hypothesis_subject_groundings_reading_idx
  ON public.hypothesis_subject_groundings (hypothesis_id, session_id, session_position);

-- 5A.2 The authorized grounding universe of ONE durable generation: the
--      committed Emerging Focuses of the execution's Session up to the Live
--      Head at build time (the frontier), each with its server-issued opaque
--      handle and its committed provenance. Stored once, never rewritten, so
--      "the exact supplied universe" is a durable fact the proposal is judged
--      against. frontier_sp NULL = no committed Moment yet = empty universe.
CREATE TABLE public.hypothesis_subject_grounding_universes (
  execution_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  frontier_sp integer,
  entries jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hypothesis_subject_grounding_universes_execution_fk
    FOREIGN KEY (execution_id) REFERENCES public.post_response_intelligence_executions (id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_grounding_universes_session_user_fk
    FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_grounding_universes_frontier_check CHECK (frontier_sp IS NULL OR frontier_sp >= 1),
  CONSTRAINT hypothesis_subject_grounding_universes_entries_check CHECK (
    jsonb_typeof(entries) = 'array' AND jsonb_array_length(entries) <= 32
    AND (frontier_sp IS NOT NULL OR jsonb_array_length(entries) = 0))
);

-- 5A.3 The authorized proposal of ONE durable generation: exactly one
--      selection per accepted candidate, each a subset (possibly empty) of the
--      handles of the stored universe. Written by the grounded Candidate
--      completion in the SAME transaction as the frozen 0033 completion.
CREATE TABLE public.hypothesis_subject_grounding_proposals (
  execution_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  selections jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hypothesis_subject_grounding_proposals_universe_fk
    FOREIGN KEY (execution_id) REFERENCES public.hypothesis_subject_grounding_universes (execution_id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_grounding_proposals_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_subject_grounding_proposals_selections_check CHECK (
    jsonb_typeof(selections) = 'array' AND jsonb_array_length(selections) <= 5)
);

-- ===========================================================================
-- 6. Append-only enforcement of every T-03C history row. Availability is
--    recorded once; no role, the owner included, can rewrite, renumber,
--    reanchor or physically remove an event, a coverage decision, a baseline
--    or a Thread world version.
-- ===========================================================================
CREATE FUNCTION public.reject_historical_projection_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE' USING ERRCODE='55000',
    DETAIL=format('%s is append-only SP-native history: UPDATE and DELETE are refused for every role.', TG_TABLE_NAME);
END;$$;

CREATE TRIGGER session_historical_coverage_immutable
  BEFORE UPDATE OR DELETE ON public.session_historical_coverage
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER session_historical_baselines_immutable
  BEFORE UPDATE OR DELETE ON public.session_historical_baselines
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_thread_availability_immutable
  BEFORE UPDATE OR DELETE ON public.historical_thread_availability
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_reading_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_reading_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_evidence_participation_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_evidence_participation_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_reading_relation_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_reading_relation_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_material_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_material_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_gap_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_gap_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_question_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_question_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_confidence_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_confidence_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER historical_question_appearance_events_immutable
  BEFORE UPDATE OR DELETE ON public.historical_question_appearance_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER hypothesis_subject_groundings_immutable
  BEFORE UPDATE OR DELETE ON public.hypothesis_subject_groundings
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER hypothesis_subject_grounding_universes_immutable
  BEFORE UPDATE OR DELETE ON public.hypothesis_subject_grounding_universes
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();
CREATE TRIGGER hypothesis_subject_grounding_proposals_immutable
  BEFORE UPDATE OR DELETE ON public.hypothesis_subject_grounding_proposals
  FOR EACH ROW EXECUTE FUNCTION public.reject_historical_projection_mutation_v1();

-- ===========================================================================
-- 7. Identity, and the historical capture boundary.
--
--    7.1 Every T-03C event identity is RFC 4122 v5 through the frozen 0068
--        authority over the documented namespace
--          79466f6b-04fd-5150-aa23-59682098057c
--        = uuidV5(RFC 4122 URL namespace,
--                 'https://qandeel.app/runtime/historical-availability-event/v1').
--        Section 12 refuses to deploy unless the literal re-derives.
--
--    7.2 The capture boundary is a transaction-local context:
--          { user_id, requested_session_id | null, session_id | null,
--            session_position | null, same_sp_event_sequence | null,
--            world_version }
--        established once per (user, requested Session association) per
--        transaction by historical_capture_begin_v1 (clock-first: Session
--        Semantic Clock FOR UPDATE -> the ONE 0065 same-SP seam -> World
--        Semantic Clock FOR UPDATE, +1) and read by every capture hook (the
--        newest context of the writing user). A canonical write
--        that reaches a capture hook WITHOUT an established context is an
--        UNASSOCIATED write: the hook establishes a world-only context itself
--        (world version only, no Session anchor). Such a fact is never
--        untracked and never fabricates a Session anchor - it enters a later
--        Session only through that Session's historical baseline (REV66-06
--        section 4.5). A caller can supply no SP, no sequence and no version:
--        the context is set only by these postgres-owned bodies.
-- ===========================================================================
CREATE FUNCTION public.historical_event_identity_v1(p_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p_name IS NULL OR length(p_name) = 0 THEN
    RAISE EXCEPTION 'INVALID_HISTORICAL_EVENT_IDENTITY' USING ERRCODE='22023';
  END IF;
  RETURN public.canonical_uuid_v5_v1('79466f6b-04fd-5150-aa23-59682098057c'::uuid, p_name);
END;$$;

CREATE FUNCTION public.historical_capture_begin_v1(p_user_id uuid, p_session_id uuid, p_require_session boolean)
RETURNS TABLE(session_id uuid, session_position integer, same_sp_event_sequence bigint, world_version bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  contexts jsonb;
  matched jsonb;
  clock_row public.session_semantic_clocks;
  reserved_sp integer;
  reserved_sequence bigint;
  associated_session uuid := NULL;
  next_version bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_HISTORICAL_CAPTURE_IDENTITY' USING ERRCODE='22023';
  END IF;
  -- One context per (user, requested Session association) per transaction,
  -- newest first. A transaction that writes for several users or Sessions
  -- (a verifier, an administrative batch) carries one context for each; a
  -- production transaction carries exactly one.
  contexts := COALESCE(NULLIF(current_setting('qandeel.historical_capture_context', true), '')::jsonb, '[]'::jsonb);
  SELECT entry INTO matched FROM jsonb_array_elements(contexts) AS entry
   WHERE (entry ->> 'user_id')::uuid = p_user_id
     AND (entry ->> 'requested_session_id')::uuid IS NOT DISTINCT FROM p_session_id
   LIMIT 1;
  IF matched IS NOT NULL THEN
    session_id := (matched ->> 'session_id')::uuid;
    session_position := (matched ->> 'session_position')::integer;
    same_sp_event_sequence := (matched ->> 'same_sp_event_sequence')::bigint;
    world_version := (matched ->> 'world_version')::bigint;
    IF p_require_session AND session_id IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 1. The Session Semantic Clock FIRST (AF66-01), when a Session association
  --    exists. A Session without a clock cannot be associated: the write is
  --    unassociated unless the caller REQUIRES the association.
  IF p_session_id IS NOT NULL THEN
    SELECT * INTO clock_row FROM public.session_semantic_clocks c
      WHERE c.session_id = p_session_id
      FOR UPDATE;
    IF FOUND THEN
      IF clock_row.user_id <> p_user_id THEN
        RAISE EXCEPTION 'HISTORICAL_CAPTURE_ASSOCIATION_INTEGRITY' USING ERRCODE='55000',
          DETAIL='A Session association names a Session of another user; nothing is captured.';
      END IF;
      associated_session := p_session_id;
      -- 2. The deterministic same-SP order, through the ONE 0065 seam, only
      --    while an addressable Session Position exists. Before SP(1) the
      --    baseline decides membership; nothing is fabricated.
      IF clock_row.current_sp IS NOT NULL THEN
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM clock_row.current_sp THEN
          RAISE EXCEPTION 'HISTORICAL_CAPTURE_SEQUENCE_INTEGRITY' USING ERRCODE='55000';
        END IF;
      END IF;
    ELSIF p_require_session THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
    END IF;
  ELSIF p_require_session THEN
    RAISE EXCEPTION 'INVALID_HISTORICAL_CAPTURE_IDENTITY' USING ERRCODE='22023';
  END IF;

  -- 3. The World Semantic Clock: provisioned lazily, locked until commit,
  --    advanced by exactly one.
  INSERT INTO public.historical_world_semantic_clocks (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.historical_world_semantic_clocks w WHERE w.user_id = p_user_id FOR UPDATE;
  UPDATE public.historical_world_semantic_clocks w
     SET current_version = w.current_version + 1
   WHERE w.user_id = p_user_id
   RETURNING w.current_version INTO next_version;
  IF next_version IS NULL THEN
    RAISE EXCEPTION 'WORLD_SEMANTIC_CLOCK_MISSING' USING ERRCODE='55000';
  END IF;

  PERFORM pg_catalog.set_config('qandeel.historical_capture_context', (jsonb_build_array(jsonb_build_object(
    'user_id', p_user_id,
    'requested_session_id', p_session_id,
    'session_id', associated_session,
    'session_position', reserved_sp,
    'same_sp_event_sequence', reserved_sequence,
    'world_version', next_version)) || contexts)::text, true);

  session_id := associated_session;
  session_position := reserved_sp;
  same_sp_event_sequence := reserved_sequence;
  world_version := next_version;
  RETURN NEXT;
END;$$;

-- The hooks' view of the boundary: the established context, or a world-only
-- context for an unassociated canonical write.
CREATE FUNCTION public.historical_capture_context_v1(p_user_id uuid)
RETURNS TABLE(session_id uuid, session_position integer, same_sp_event_sequence bigint, world_version bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  matched jsonb;
BEGIN
  -- The newest context of THIS user; a canonical write of a user who has no
  -- context in the transaction is an unassociated write (world-only).
  SELECT entry INTO matched
    FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('qandeel.historical_capture_context', true), '')::jsonb, '[]'::jsonb)) AS entry
   WHERE (entry ->> 'user_id')::uuid = p_user_id
   LIMIT 1;
  IF matched IS NOT NULL THEN
    session_id := (matched ->> 'session_id')::uuid;
    session_position := (matched ->> 'session_position')::integer;
    same_sp_event_sequence := (matched ->> 'same_sp_event_sequence')::bigint;
    world_version := (matched ->> 'world_version')::bigint;
    RETURN NEXT;
    RETURN;
  END IF;
  RETURN QUERY SELECT b.session_id, b.session_position, b.same_sp_event_sequence, b.world_version
    FROM public.historical_capture_begin_v1(p_user_id, NULL, false) b;
END;$$;

-- The durable post-response execution is the server-owned Session
-- association of every background analytical write (0022: session_id NOT
-- NULL, source_turn_id UNIQUE; effects are its children). No caller-supplied
-- identity participates. A missing execution, or an execution whose Session
-- holds no Session Semantic Clock, yields an UNASSOCIATED context.
CREATE FUNCTION public.historical_capture_begin_for_execution_v1(p_execution_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
BEGIN
  IF p_execution_id IS NULL THEN RETURN; END IF;
  SELECT * INTO execution_row FROM public.post_response_intelligence_executions e WHERE e.id = p_execution_id;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, false);
END;$$;

-- ===========================================================================
-- 8. The capture hooks. Each canonical legacy write that can change
--    historical K(TC) records its own typed availability / validity event at
--    the moment it becomes canonical, from the OLD/NEW rows themselves - the
--    actual change, never a reconstruction from today's row. An event
--    identity that already exists with a different payload fails closed;
--    an identical replay (the two rows of one symmetric relation link, or
--    an exact retry inside one transaction) is a no-op.
-- ===========================================================================
CREATE FUNCTION public.historical_event_identity_conflict_v1(p_table text, p_event_id uuid, p_expected jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  stored jsonb;
BEGIN
  EXECUTE format('SELECT to_jsonb(t) - ''created_at'' FROM public.%I t WHERE t.event_id = $1', p_table)
    INTO stored USING p_event_id;
  IF stored IS NULL OR stored <> (p_expected - 'created_at') THEN
    RAISE EXCEPTION 'HISTORICAL_EVENT_IDENTITY_CONFLICT' USING ERRCODE='22023',
      DETAIL=format('%s: the same stable event identity was reused with a different semantic payload; nothing is replaced.', p_table);
  END IF;
END;$$;

CREATE FUNCTION public.capture_historical_reading_change_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
  evidence text;
  peer uuid;
  first_id uuid;
  second_id uuid;
  event uuid;
  row_json jsonb;
BEGIN
  SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
  IF TG_OP = 'INSERT' THEN
    event := public.historical_event_identity_v1('reading-created:' || NEW.id::text);
    INSERT INTO public.historical_reading_events (
      event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
      session_id, session_position, same_sp_event_sequence, world_version)
    VALUES (event, NEW.user_id, NEW.id, 'CREATED', NULL, NEW.status, NULL, NEW.version,
      ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
    ON CONFLICT (event_id) DO NOTHING;
    IF NOT FOUND THEN
      PERFORM public.historical_event_identity_conflict_v1('historical_reading_events', event, jsonb_build_object(
        'event_id', event, 'user_id', NEW.user_id, 'hypothesis_id', NEW.id, 'event_kind', 'CREATED', 'from_status', NULL, 'to_status', NEW.status,
        'from_version', NULL, 'to_version', NEW.version, 'session_id', ctx.session_id, 'session_position', ctx.session_position,
        'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version));
    END IF;
  ELSE
    IF NEW.status <> OLD.status THEN
      event := public.historical_event_identity_v1('reading-status:' || NEW.id::text || ':' || NEW.version::text || ':' || ctx.world_version::text);
      row_json := jsonb_build_object(
        'event_id', event, 'user_id', NEW.user_id, 'hypothesis_id', NEW.id, 'event_kind', 'STATUS_TRANSITION', 'from_status', OLD.status, 'to_status', NEW.status,
        'from_version', OLD.version, 'to_version', NEW.version, 'session_id', ctx.session_id, 'session_position', ctx.session_position,
        'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version);
      INSERT INTO public.historical_reading_events (
        event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
        session_id, session_position, same_sp_event_sequence, world_version)
      VALUES (event, NEW.user_id, NEW.id, 'STATUS_TRANSITION', OLD.status, NEW.status, OLD.version, NEW.version,
        ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
      ON CONFLICT (event_id) DO NOTHING;
      IF NOT FOUND THEN PERFORM public.historical_event_identity_conflict_v1('historical_reading_events', event, row_json); END IF;
    ELSIF NEW.version <> OLD.version THEN
      -- A version advance without a status change (an Evidence attach, a peer
      -- link) is its own availability boundary: the then-current version of a
      -- known Reading is exact at every TC, so Confidence resolution never
      -- mistakes a known evaluation for PREVALID.
      event := public.historical_event_identity_v1('reading-version:' || NEW.id::text || ':' || NEW.version::text || ':' || ctx.world_version::text);
      row_json := jsonb_build_object(
        'event_id', event, 'user_id', NEW.user_id, 'hypothesis_id', NEW.id, 'event_kind', 'VERSION_ADVANCED', 'from_status', OLD.status, 'to_status', NEW.status,
        'from_version', OLD.version, 'to_version', NEW.version, 'session_id', ctx.session_id, 'session_position', ctx.session_position,
        'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version);
      INSERT INTO public.historical_reading_events (
        event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
        session_id, session_position, same_sp_event_sequence, world_version)
      VALUES (event, NEW.user_id, NEW.id, 'VERSION_ADVANCED', OLD.status, NEW.status, OLD.version, NEW.version,
        ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
      ON CONFLICT (event_id) DO NOTHING;
      IF NOT FOUND THEN PERFORM public.historical_event_identity_conflict_v1('historical_reading_events', event, row_json); END IF;
    END IF;
  END IF;

  -- Evidence participation: each newly present (or newly absent) evidence id,
  -- by role, is its OWN availability boundary.
  FOR evidence IN
    SELECT e FROM unnest(NEW.supporting_evidence_ids) AS e
    WHERE TG_OP = 'INSERT' OR NOT (e = ANY (OLD.supporting_evidence_ids))
  LOOP
    PERFORM public.record_historical_evidence_participation_v1(NEW.user_id, NEW.id, evidence, 'SUPPORTING', 'ATTACHED', NEW.version, ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version);
  END LOOP;
  FOR evidence IN
    SELECT e FROM unnest(NEW.contradicting_evidence_ids) AS e
    WHERE TG_OP = 'INSERT' OR NOT (e = ANY (OLD.contradicting_evidence_ids))
  LOOP
    PERFORM public.record_historical_evidence_participation_v1(NEW.user_id, NEW.id, evidence, 'CONTRADICTING', 'ATTACHED', NEW.version, ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version);
  END LOOP;
  IF TG_OP = 'UPDATE' THEN
    FOR evidence IN SELECT e FROM unnest(OLD.supporting_evidence_ids) AS e WHERE NOT (e = ANY (NEW.supporting_evidence_ids)) LOOP
      PERFORM public.record_historical_evidence_participation_v1(NEW.user_id, NEW.id, evidence, 'SUPPORTING', 'DETACHED', NEW.version, ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version);
    END LOOP;
    FOR evidence IN SELECT e FROM unnest(OLD.contradicting_evidence_ids) AS e WHERE NOT (e = ANY (NEW.contradicting_evidence_ids)) LOOP
      PERFORM public.record_historical_evidence_participation_v1(NEW.user_id, NEW.id, evidence, 'CONTRADICTING', 'DETACHED', NEW.version, ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version);
    END LOOP;
  END IF;

  -- Peer relations: unranked, symmetric, recorded once per ordered pair, and
  -- only between two canonical Readings of the same owner (a dangling peer id
  -- names no Reading: there is no relation to know).
  FOR peer IN
    SELECT p FROM unnest(NEW.competing_hypothesis_ids) AS p
    WHERE (TG_OP = 'INSERT' OR NOT (p = ANY (OLD.competing_hypothesis_ids)))
      AND p <> NEW.id
      AND EXISTS (SELECT 1 FROM public.hypotheses x WHERE x.id = p AND x.user_id = NEW.user_id)
  LOOP
    first_id := LEAST(NEW.id, peer); second_id := GREATEST(NEW.id, peer);
    PERFORM public.record_historical_reading_relation_v1(NEW.user_id, first_id, second_id, 'LINKED', ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version);
  END LOOP;
  IF TG_OP = 'UPDATE' THEN
    FOR peer IN
      SELECT p FROM unnest(OLD.competing_hypothesis_ids) AS p
      WHERE NOT (p = ANY (NEW.competing_hypothesis_ids))
        AND p <> NEW.id
        AND EXISTS (SELECT 1 FROM public.hypotheses x WHERE x.id = p AND x.user_id = NEW.user_id)
    LOOP
      first_id := LEAST(NEW.id, peer); second_id := GREATEST(NEW.id, peer);
      PERFORM public.record_historical_reading_relation_v1(NEW.user_id, first_id, second_id, 'UNLINKED', ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version);
    END LOOP;
  END IF;
  RETURN NULL;
END;$$;

CREATE FUNCTION public.record_historical_evidence_participation_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_evidence_id text, p_role text, p_kind text, p_reading_version integer,
  p_session_id uuid, p_session_position integer, p_sequence bigint, p_world_version bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  event uuid;
BEGIN
  event := public.historical_event_identity_v1(
    'evidence:' || p_hypothesis_id::text || ':' || p_evidence_id || ':' || p_kind || ':' || p_reading_version::text || ':' || p_world_version::text);
  INSERT INTO public.historical_evidence_participation_events (
    event_id, user_id, hypothesis_id, evidence_id, evidence_role, event_kind, reading_version,
    session_id, session_position, same_sp_event_sequence, world_version)
  VALUES (event, p_user_id, p_hypothesis_id, p_evidence_id, p_role, p_kind, p_reading_version,
    p_session_id, p_session_position, p_sequence, p_world_version)
  ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN
    PERFORM public.historical_event_identity_conflict_v1('historical_evidence_participation_events', event, jsonb_build_object(
      'event_id', event, 'user_id', p_user_id, 'hypothesis_id', p_hypothesis_id, 'evidence_id', p_evidence_id, 'evidence_role', p_role,
      'event_kind', p_kind, 'reading_version', p_reading_version, 'session_id', p_session_id, 'session_position', p_session_position,
      'same_sp_event_sequence', p_sequence, 'world_version', p_world_version));
  END IF;
END;$$;

CREATE FUNCTION public.record_historical_reading_relation_v1(
  p_user_id uuid, p_a uuid, p_b uuid, p_kind text,
  p_session_id uuid, p_session_position integer, p_sequence bigint, p_world_version bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  event uuid;
BEGIN
  event := public.historical_event_identity_v1('relation:' || p_a::text || ':' || p_b::text || ':' || p_kind || ':' || p_world_version::text);
  INSERT INTO public.historical_reading_relation_events (
    event_id, user_id, hypothesis_a, hypothesis_b, event_kind, session_id, session_position, same_sp_event_sequence, world_version)
  VALUES (event, p_user_id, p_a, p_b, p_kind, p_session_id, p_session_position, p_sequence, p_world_version)
  ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN
    PERFORM public.historical_event_identity_conflict_v1('historical_reading_relation_events', event, jsonb_build_object(
      'event_id', event, 'user_id', p_user_id, 'hypothesis_a', p_a, 'hypothesis_b', p_b, 'event_kind', p_kind,
      'session_id', p_session_id, 'session_position', p_session_position, 'same_sp_event_sequence', p_sequence, 'world_version', p_world_version));
  END IF;
END;$$;

CREATE FUNCTION public.capture_historical_material_change_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
  event uuid;
  row_json jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NULL; END IF;
  SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
  IF TG_OP = 'INSERT' THEN
    event := public.historical_event_identity_v1('material-created:' || NEW.id::text);
    row_json := jsonb_build_object('event_id', event, 'user_id', NEW.user_id, 'memory_id', NEW.id, 'event_kind', 'CREATED', 'from_status', NULL, 'to_status', NEW.status,
      'memory_version', NEW.version, 'supersedes_memory_id', NEW.supersedes_memory_id, 'session_id', ctx.session_id, 'session_position', ctx.session_position,
      'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version);
    INSERT INTO public.historical_material_events (
      event_id, user_id, memory_id, event_kind, from_status, to_status, memory_version, supersedes_memory_id,
      session_id, session_position, same_sp_event_sequence, world_version)
    VALUES (event, NEW.user_id, NEW.id, 'CREATED', NULL, NEW.status, NEW.version, NEW.supersedes_memory_id,
      ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
    ON CONFLICT (event_id) DO NOTHING;
  ELSE
    event := public.historical_event_identity_v1('material-status:' || NEW.id::text || ':' || NEW.status || ':' || ctx.world_version::text);
    row_json := jsonb_build_object('event_id', event, 'user_id', NEW.user_id, 'memory_id', NEW.id, 'event_kind', 'STATUS_TRANSITION', 'from_status', OLD.status, 'to_status', NEW.status,
      'memory_version', NEW.version, 'supersedes_memory_id', NEW.supersedes_memory_id, 'session_id', ctx.session_id, 'session_position', ctx.session_position,
      'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version);
    INSERT INTO public.historical_material_events (
      event_id, user_id, memory_id, event_kind, from_status, to_status, memory_version, supersedes_memory_id,
      session_id, session_position, same_sp_event_sequence, world_version)
    VALUES (event, NEW.user_id, NEW.id, 'STATUS_TRANSITION', OLD.status, NEW.status, NEW.version, NEW.supersedes_memory_id,
      ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  IF NOT FOUND THEN PERFORM public.historical_event_identity_conflict_v1('historical_material_events', event, row_json); END IF;
  RETURN NULL;
END;$$;

CREATE FUNCTION public.capture_historical_gap_change_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
  event uuid;
  kind text;
  row_json jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.open_epoch = OLD.open_epoch THEN RETURN NULL; END IF;
  SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
  IF TG_OP = 'INSERT' THEN
    kind := 'CREATED';
    event := public.historical_event_identity_v1('gap-created:' || NEW.id::text);
  ELSE
    kind := CASE WHEN NEW.status = 'OPEN' THEN 'REOPENED' ELSE 'CLOSED' END;
    event := public.historical_event_identity_v1('gap-transition:' || NEW.id::text || ':' || NEW.status || ':' || NEW.open_epoch::text || ':' || ctx.world_version::text);
  END IF;
  row_json := jsonb_build_object('event_id', event, 'user_id', NEW.user_id, 'information_gap_id', NEW.id, 'event_kind', kind,
    'from_status', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END, 'to_status', NEW.status, 'open_epoch', NEW.open_epoch,
    'closure_reason', CASE WHEN kind = 'CLOSED' THEN NEW.closure_reason ELSE NULL END,
    'session_id', ctx.session_id, 'session_position', ctx.session_position, 'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version);
  INSERT INTO public.historical_gap_events (
    event_id, user_id, information_gap_id, event_kind, from_status, to_status, open_epoch, closure_reason,
    session_id, session_position, same_sp_event_sequence, world_version)
  VALUES (event, NEW.user_id, NEW.id, kind, CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END, NEW.status, NEW.open_epoch,
    CASE WHEN kind = 'CLOSED' THEN NEW.closure_reason ELSE NULL END,
    ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
  ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN PERFORM public.historical_event_identity_conflict_v1('historical_gap_events', event, row_json); END IF;
  RETURN NULL;
END;$$;

CREATE FUNCTION public.capture_historical_question_creation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
  event uuid;
BEGIN
  SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
  event := public.historical_event_identity_v1('question-created:' || NEW.id::text);
  INSERT INTO public.historical_question_events (
    event_id, user_id, question_candidate_id, event_kind, session_id, session_position, same_sp_event_sequence, world_version)
  VALUES (event, NEW.user_id, NEW.id, 'CREATED', ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
  ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN
    PERFORM public.historical_event_identity_conflict_v1('historical_question_events', event, jsonb_build_object(
      'event_id', event, 'user_id', NEW.user_id, 'question_candidate_id', NEW.id, 'event_kind', 'CREATED',
      'session_id', ctx.session_id, 'session_position', ctx.session_position, 'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version));
  END IF;
  RETURN NULL;
END;$$;

CREATE FUNCTION public.capture_historical_confidence_creation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
  event uuid;
BEGIN
  SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
  event := public.historical_event_identity_v1('confidence-created:' || NEW.id::text);
  INSERT INTO public.historical_confidence_events (
    event_id, user_id, confidence_evaluation_id, hypothesis_id, target_version, event_kind,
    session_id, session_position, same_sp_event_sequence, world_version)
  VALUES (event, NEW.user_id, NEW.id, NEW.target_id, NEW.target_version, 'CREATED',
    ctx.session_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
  ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN
    PERFORM public.historical_event_identity_conflict_v1('historical_confidence_events', event, jsonb_build_object(
      'event_id', event, 'user_id', NEW.user_id, 'confidence_evaluation_id', NEW.id, 'hypothesis_id', NEW.target_id, 'target_version', NEW.target_version,
      'event_kind', 'CREATED', 'session_id', ctx.session_id, 'session_position', ctx.session_position, 'same_sp_event_sequence', ctx.same_sp_event_sequence, 'world_version', ctx.world_version));
  END IF;
  RETURN NULL;
END;$$;

-- A new Thread receives its world version inside the establishing
-- transaction (the frozen 0071 writer holds the Session clock; this hook
-- takes only the world clock, after it).
CREATE FUNCTION public.capture_historical_thread_availability_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
BEGIN
  SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
  INSERT INTO public.historical_thread_availability (thread_id, user_id, world_version)
  VALUES (NEW.id, NEW.user_id, ctx.world_version);
  RETURN NULL;
END;$$;

-- R-C1: committed-CU insertion is NOT gated by coverage. A LEGACY UNCOVERED
-- SESSION (and a Session that carries no coverage decision at all) keeps
-- committing Session Positions through the frozen runtime authority; what it
-- never receives is a baseline, so the projection (section 14) stays
-- fail-closed for it through closure and no partial Timeline is addressable.
-- Coverage is decided once at creation and never inferred here.
--
-- The SP(1) baseline cut (COVERED Sessions only), and the Formal Question <->
-- Turn appearance anchor, both born inside the committing transaction of the
-- Moment. The appearance anchor is technical SP-native history recorded for
-- every Session; whether it is ever projected is decided by coverage.
CREATE FUNCTION public.capture_session_historical_baseline_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  cut bigint;
  coverage text;
  binding public.formal_question_turn_bindings;
  ctx record;
BEGIN
  IF NEW.session_position = 1 THEN
    SELECT c.coverage_state INTO coverage FROM public.session_historical_coverage c
      WHERE c.session_id = NEW.session_id AND c.user_id = NEW.user_id;
    IF FOUND AND coverage = 'COVERED' THEN
      INSERT INTO public.historical_world_semantic_clocks (user_id) VALUES (NEW.user_id)
      ON CONFLICT (user_id) DO NOTHING;
      SELECT w.current_version INTO cut FROM public.historical_world_semantic_clocks w
        WHERE w.user_id = NEW.user_id
        FOR UPDATE;
      INSERT INTO public.session_historical_baselines (session_id, user_id, baseline_world_version)
      VALUES (NEW.session_id, NEW.user_id, cut);
    END IF;
  END IF;
  FOR binding IN
    SELECT b.* FROM public.formal_question_turn_bindings b
     WHERE b.session_id = NEW.session_id AND b.user_id = NEW.user_id AND b.state = 'BOUND'
       AND (b.source_turn_id = NEW.source_turn_id OR b.assistant_turn_id = NEW.source_turn_id)
       AND NOT EXISTS (SELECT 1 FROM public.historical_question_appearance_events a WHERE a.binding_id = b.id)
     ORDER BY b.id
  LOOP
    SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
    INSERT INTO public.historical_question_appearance_events (
      event_id, user_id, binding_id, session_id, session_position, same_sp_event_sequence, world_version)
    VALUES (public.historical_event_identity_v1('question-appearance:' || binding.id::text), NEW.user_id, binding.id,
      NEW.session_id, NEW.session_position, 0, ctx.world_version);
  END LOOP;
  RETURN NULL;
END;$$;

-- R-C2: the canonical legacy rows historical V reads are preserved. Physical
-- DELETE is refused for every role; the historical fields never change after
-- insert; only the lifecycle / version / participation columns the frozen
-- runtime legitimately moves may move. (information_gaps keep the 0063
-- byte-identity + DELETE guard; formal_question_turn_bindings likewise.)
CREATE FUNCTION public.guard_historical_canonical_row_preservation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  mutable text[];
  before jsonb;
  after jsonb;
  col text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CANONICAL_HISTORICAL_ROW_IS_PRESERVED' USING ERRCODE='55000',
      DETAIL=format('%s rows are canonical history read by historical projection: physical DELETE is refused for every role. Lifecycle deletion is a status transition.', TG_TABLE_NAME);
  END IF;
  mutable := CASE TG_TABLE_NAME
    WHEN 'hypotheses' THEN ARRAY['status', 'version', 'updated_at', 'supporting_evidence_ids', 'contradicting_evidence_ids', 'competing_hypothesis_ids']
    WHEN 'memories' THEN ARRAY['status', 'updated_at']
    ELSE ARRAY['updated_at']
  END;
  before := to_jsonb(OLD);
  after := to_jsonb(NEW);
  FOREACH col IN ARRAY mutable LOOP
    before := before - col;
    after := after - col;
  END LOOP;
  IF before <> after THEN
    RAISE EXCEPTION 'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE' USING ERRCODE='55000',
      DETAIL=format('%s: a historical field may never be rewritten in place; the frozen lifecycle columns are the only mutable columns.', TG_TABLE_NAME);
  END IF;
  RETURN NEW;
END;$$;

-- ===========================================================================
-- 9. The LEGACY BASELINE. Every canonical fact that already exists when this
--    migration runs was canonical before capture began. It is seeded exactly
--    once at world version 0, session NULL: PRE_FIRST_SP for every covered
--    Session (all of which start later), never a Moment, never a
--    reconstruction of a past position. Field values are reused; only their
--    temporal availability is recorded here. These statements are idempotent
--    by identity so a verifier can replay them against injected legacy rows.
-- ===========================================================================
INSERT INTO public.historical_reading_events (
  event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
  session_id, session_position, same_sp_event_sequence, world_version)
SELECT public.historical_event_identity_v1('reading-created:' || h.id::text), h.user_id, h.id, 'LEGACY_BASELINE', NULL::text, h.status, NULL::integer, h.version,
       NULL::uuid, NULL::integer, NULL::bigint, 0::bigint
  FROM public.hypotheses h
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_reading_events e WHERE e.hypothesis_id = h.id);

INSERT INTO public.historical_evidence_participation_events (
  event_id, user_id, hypothesis_id, evidence_id, evidence_role, event_kind, reading_version,
  session_id, session_position, same_sp_event_sequence, world_version)
SELECT public.historical_event_identity_v1('evidence-baseline:' || h.id::text || ':' || e.evidence_id), h.user_id, h.id, e.evidence_id, e.evidence_role, 'LEGACY_BASELINE', h.version,
       NULL::uuid, NULL::integer, NULL::bigint, 0::bigint
  FROM public.hypotheses h
  CROSS JOIN LATERAL (
    SELECT s AS evidence_id, 'SUPPORTING' AS evidence_role FROM unnest(h.supporting_evidence_ids) AS s
    UNION ALL
    SELECT c, 'CONTRADICTING' FROM unnest(h.contradicting_evidence_ids) AS c) e
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_evidence_participation_events x WHERE x.hypothesis_id = h.id AND x.evidence_id = e.evidence_id);

INSERT INTO public.historical_reading_relation_events (
  event_id, user_id, hypothesis_a, hypothesis_b, event_kind, session_id, session_position, same_sp_event_sequence, world_version)
SELECT DISTINCT public.historical_event_identity_v1('relation-baseline:' || LEAST(h.id, p)::text || ':' || GREATEST(h.id, p)::text), h.user_id,
       LEAST(h.id, p), GREATEST(h.id, p), 'LEGACY_BASELINE', NULL::uuid, NULL::integer, NULL::bigint, 0::bigint
  FROM public.hypotheses h
  CROSS JOIN LATERAL unnest(h.competing_hypothesis_ids) AS p
  JOIN public.hypotheses peer ON peer.id = p AND peer.user_id = h.user_id AND peer.id <> h.id
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_reading_relation_events r WHERE r.hypothesis_a = LEAST(h.id, p) AND r.hypothesis_b = GREATEST(h.id, p));

INSERT INTO public.historical_material_events (
  event_id, user_id, memory_id, event_kind, from_status, to_status, memory_version, supersedes_memory_id,
  session_id, session_position, same_sp_event_sequence, world_version)
SELECT public.historical_event_identity_v1('material-created:' || m.id::text), m.user_id, m.id, 'LEGACY_BASELINE', NULL::text, m.status, m.version, m.supersedes_memory_id,
       NULL::uuid, NULL::integer, NULL::bigint, 0::bigint
  FROM public.memories m
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_material_events e WHERE e.memory_id = m.id);

INSERT INTO public.historical_gap_events (
  event_id, user_id, information_gap_id, event_kind, from_status, to_status, open_epoch, closure_reason,
  session_id, session_position, same_sp_event_sequence, world_version)
SELECT public.historical_event_identity_v1('gap-created:' || g.id::text), g.user_id, g.id, 'LEGACY_BASELINE', NULL::text, g.status, g.open_epoch, g.closure_reason,
       NULL::uuid, NULL::integer, NULL::bigint, 0::bigint
  FROM public.information_gaps g
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_gap_events e WHERE e.information_gap_id = g.id);

INSERT INTO public.historical_question_events (
  event_id, user_id, question_candidate_id, event_kind, session_id, session_position, same_sp_event_sequence, world_version)
SELECT public.historical_event_identity_v1('question-created:' || q.id::text), q.user_id, q.id, 'LEGACY_BASELINE', NULL::uuid, NULL::integer, NULL::bigint, 0::bigint
  FROM public.question_candidates q
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_question_events e WHERE e.question_candidate_id = q.id);

INSERT INTO public.historical_confidence_events (
  event_id, user_id, confidence_evaluation_id, hypothesis_id, target_version, event_kind,
  session_id, session_position, same_sp_event_sequence, world_version)
SELECT public.historical_event_identity_v1('confidence-created:' || c.id::text), c.user_id, c.id, c.target_id, c.target_version, 'LEGACY_BASELINE',
       NULL::uuid, NULL::integer, NULL::bigint, 0::bigint
  FROM public.confidence_evaluations c
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_confidence_events e WHERE e.confidence_evaluation_id = c.id);

INSERT INTO public.historical_thread_availability (thread_id, user_id, world_version)
SELECT t.id, t.user_id, 0
  FROM public.conversation_threads t
 WHERE NOT EXISTS (SELECT 1 FROM public.historical_thread_availability a WHERE a.thread_id = t.id);

-- ===========================================================================
-- 10. Installing the hooks and the preservation guards. From this point every
--     canonical write of the legacy families is captured, a COVERED Session's
--     first Moment cuts its baseline (committed-CU insertion itself is never
--     gated by coverage), and no historical row can be deleted or rewritten
--     in place.
-- ===========================================================================
CREATE TRIGGER hypotheses_historical_capture
  AFTER INSERT OR UPDATE ON public.hypotheses
  FOR EACH ROW EXECUTE FUNCTION public.capture_historical_reading_change_v1();
CREATE TRIGGER memories_historical_capture
  AFTER INSERT OR UPDATE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.capture_historical_material_change_v1();
CREATE TRIGGER information_gaps_historical_capture
  AFTER INSERT OR UPDATE ON public.information_gaps
  FOR EACH ROW EXECUTE FUNCTION public.capture_historical_gap_change_v1();
CREATE TRIGGER question_candidates_historical_capture
  AFTER INSERT ON public.question_candidates
  FOR EACH ROW EXECUTE FUNCTION public.capture_historical_question_creation_v1();
CREATE TRIGGER confidence_evaluations_historical_capture
  AFTER INSERT ON public.confidence_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.capture_historical_confidence_creation_v1();
CREATE TRIGGER conversation_threads_historical_availability
  AFTER INSERT ON public.conversation_threads
  FOR EACH ROW EXECUTE FUNCTION public.capture_historical_thread_availability_v1();
CREATE TRIGGER conversation_units_historical_baseline
  AFTER INSERT ON public.conversation_units
  FOR EACH ROW EXECUTE FUNCTION public.capture_session_historical_baseline_v1();

CREATE TRIGGER hypotheses_historical_preservation
  BEFORE UPDATE OR DELETE ON public.hypotheses
  FOR EACH ROW EXECUTE FUNCTION public.guard_historical_canonical_row_preservation_v1();
CREATE TRIGGER memories_historical_preservation
  BEFORE UPDATE OR DELETE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.guard_historical_canonical_row_preservation_v1();
CREATE TRIGGER question_candidates_historical_preservation
  BEFORE UPDATE OR DELETE ON public.question_candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_historical_canonical_row_preservation_v1();
CREATE TRIGGER confidence_evaluations_historical_preservation
  BEFORE UPDATE OR DELETE ON public.confidence_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.guard_historical_canonical_row_preservation_v1();

-- ===========================================================================
-- 11. The live writers enter the historical boundary.
--
--     11.1 The three managed post-response commands keep their exact public
--          name, signature, result and service_role grant. Their frozen
--          bodies (0034 / 0035 / 0036 text, byte-identical) survive under an
--          internal *_core name that NO application role can execute; the
--          public name is now a wrapper that establishes the capture context
--          from the durable execution (server-owned Session association)
--          and then runs the core. Every existing caller - the runtime and
--          every historical verifier - therefore enters the boundary without
--          a single change, and no direct path to an uncaptured core exists.
--     11.2 The Information Gap synchronization entry keeps its v1 name and
--          delegates to the v2 authority after the same capture step (v2 is
--          the one closure implementation, exactly as 0063 froze it).
--     11.3 Background Memory creation gains ONE command that derives the
--          owner AND the Session from the durable execution keyed by the
--          canonical source turn; the caller supplies no user id and no
--          session id. The 0026 command it delegates to is unchanged.
-- ===========================================================================
ALTER FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid)
  RENAME TO persist_post_response_hypothesis_generation_v1_core;
ALTER FUNCTION public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb)
  RENAME TO execute_post_response_hypothesis_update_batch_v1_core;
ALTER FUNCTION public.execute_post_response_confidence_batch_v1(uuid)
  RENAME TO execute_post_response_confidence_batch_v1_core;

CREATE FUNCTION public.persist_post_response_hypothesis_generation_v1(p_execution_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  persisted boolean;
BEGIN
  PERFORM public.historical_capture_begin_for_execution_v1(p_execution_id);
  persisted := public.persist_post_response_hypothesis_generation_v1_core(p_execution_id);
  -- R2: the authorized subject groundings of this generation become canonical
  -- in the SAME transaction as the Hypotheses they ground (sections 5A / 11A),
  -- under the same execution association - a Hypothesis can never commit
  -- without the grounding it was authorized with, and a retry the frozen core
  -- answers as a bounded no-op persists nothing twice.
  IF persisted THEN
    PERFORM public.persist_authorized_subject_groundings_v1(p_execution_id);
  END IF;
  RETURN persisted;
END;$$;

CREATE FUNCTION public.execute_post_response_hypothesis_update_batch_v1(p_execution_id uuid, p_invocation_ids jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.historical_capture_begin_for_execution_v1(p_execution_id);
  RETURN public.execute_post_response_hypothesis_update_batch_v1_core(p_execution_id, p_invocation_ids);
END;$$;

CREATE FUNCTION public.execute_post_response_confidence_batch_v1(p_execution_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.historical_capture_begin_for_execution_v1(p_execution_id);
  RETURN public.execute_post_response_confidence_batch_v1_core(p_execution_id);
END;$$;

CREATE OR REPLACE FUNCTION public.sync_post_response_information_gaps_v1(p_execution_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.historical_capture_begin_for_execution_v1(p_execution_id);
  RETURN public.sync_post_response_information_gaps_v2(p_execution_id);
END;$$;

CREATE FUNCTION public.server_create_memory_for_execution_v1(
  p_source_turn_id uuid, p_memory_id uuid, p_type text, p_content text, p_source text,
  p_confidence double precision, p_importance double precision, p_status text,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS TABLE(
  id uuid, user_id uuid, scope text, type text, content text, source text, confidence double precision,
  importance double precision, status text, version integer, created_at timestamptz, updated_at timestamptz,
  expires_at timestamptz, supersedes_memory_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
BEGIN
  IF p_source_turn_id IS NULL OR p_memory_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY' USING ERRCODE='22023';
  END IF;
  -- The durable RUNNING execution owning this source turn, with MEMORY_WRITE
  -- claimed, is the ONE server-owned association; nothing weaker qualifies.
  SELECT e.* INTO execution_row FROM public.post_response_intelligence_executions e
   WHERE e.source_turn_id = p_source_turn_id AND e.state = 'RUNNING';
  IF NOT FOUND OR NOT EXISTS (
       SELECT 1 FROM public.post_response_intelligence_effects f
        WHERE f.execution_id = execution_row.id AND f.effect_key = 'MEMORY_WRITE' AND f.state = 'CLAIMED') THEN
    RAISE EXCEPTION 'MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED' USING ERRCODE='42501',
      DETAIL='A background Memory write is canonical only inside its durable post-response execution with MEMORY_WRITE claimed.';
  END IF;
  PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true);
  RETURN QUERY SELECT m.id, m.user_id, m.scope, m.type, m.content, m.source, m.confidence, m.importance, m.status,
                      m.version, m.created_at, m.updated_at, m.expires_at, m.supersedes_memory_id
    FROM public.server_create_memory_v1(execution_row.user_id, p_memory_id, p_type, p_content, p_source,
                                        p_confidence, p_importance, p_status, p_expires_at) m;
END;$$;

-- ===========================================================================
-- 11A. The subject-grounding authority (R2): the SERVER builds the universe,
--      the provider proposes opaque handles, the server authorizes, the
--      database persists canonical truth. Identity namespaces:
--
--        grounding  1592a69d-781e-57ce-bb2c-6744a6ac3ceb
--          = uuidV5(RFC 4122 URL namespace,
--                   'https://qandeel.app/runtime/hypothesis-subject-grounding/v1')
--          name = <hypothesis_id>:<emerging_focus_id>
--        handle     8feaee1d-fe51-5e9e-8594-52499b414e64
--          = uuidV5(RFC 4122 URL namespace,
--                   'https://qandeel.app/runtime/subject-grounding-handle/v1')
--          name = <execution_id>:<emerging_focus_id>
--
--      A handle is opaque to the provider: it is issued per execution, it
--      names no focus, no Thread and no Session, and a raw focus or Thread
--      UUID is never a handle. Section 16 refuses to deploy unless both
--      namespaces re-derive.
-- ===========================================================================
CREATE FUNCTION public.hypothesis_subject_grounding_identity_v1(p_hypothesis_id uuid, p_emerging_focus_id uuid)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p_hypothesis_id IS NULL OR p_emerging_focus_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_IDENTITY' USING ERRCODE='22023';
  END IF;
  RETURN public.canonical_uuid_v5_v1('1592a69d-781e-57ce-bb2c-6744a6ac3ceb'::uuid, p_hypothesis_id::text || ':' || p_emerging_focus_id::text);
END;$$;

CREATE FUNCTION public.hypothesis_subject_grounding_handle_v1(p_execution_id uuid, p_emerging_focus_id uuid)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p_execution_id IS NULL OR p_emerging_focus_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_IDENTITY' USING ERRCODE='22023';
  END IF;
  RETURN public.canonical_uuid_v5_v1('8feaee1d-fe51-5e9e-8594-52499b414e64'::uuid, p_execution_id::text || ':' || p_emerging_focus_id::text)::text;
END;$$;

-- The provider-facing presentation of a stored universe: opaque handle, the
-- exact committed wording that first grounded the focus, and its Session
-- Positions. No focus id, no Thread id, no Session id crosses to a provider.
CREATE FUNCTION public.hypothesis_subject_grounding_universe_presentation_v1(p_universe public.hypothesis_subject_grounding_universes)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_build_object(
    'executionId', p_universe.execution_id,
    'frontierSp', p_universe.frontier_sp,
    'entries', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'handle', e.value ->> 'handle', 'subjectText', e.value ->> 'subjectText',
        'startedSp', (e.value ->> 'startedSp')::integer, 'lastAttentionSp', (e.value ->> 'lastAttentionSp')::integer)
        ORDER BY (e.value ->> 'startedSp')::integer, e.value ->> 'emergingFocusId')
      FROM jsonb_array_elements(p_universe.entries) AS e(value)), '[]'::jsonb))
$$;

-- 11A.1 The universe. Built from committed B1 / B2 / B3 truth of the
--       execution's Session ONLY (server-owned association, 0022): every
--       Emerging Focus committed at or before the Live Head at build time,
--       bounded to the 32 most recently attended, each carrying its own
--       committed provenance - the stable focus identity, the grounding
--       reference handle, the starting CU and SP, the latest attention SP,
--       the first committed wording of the reference, and the Thread the
--       focus already resolves to in this Session (0068 establishment or
--       0070 continuity), if any. A focus that never became canonical - an
--       AMBIGUOUS or UNRESOLVED reference, an incidental mention - has no
--       row here, so no definite grounding can ever name it. Idempotent: the
--       first build is the universe of the execution for good.
CREATE FUNCTION public.build_hypothesis_subject_grounding_universe_v1(p_execution_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  stored public.hypothesis_subject_grounding_universes;
  frontier integer;
  built jsonb;
BEGIN
  IF p_execution_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT * INTO execution_row FROM public.post_response_intelligence_executions e WHERE e.id = p_execution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO stored FROM public.hypothesis_subject_grounding_universes u WHERE u.execution_id = p_execution_id;
  IF FOUND THEN
    RETURN public.hypothesis_subject_grounding_universe_presentation_v1(stored);
  END IF;
  IF execution_row.state <> 'RUNNING' THEN
    RAISE EXCEPTION 'SUBJECT_GROUNDING_EXECUTION_NOT_RUNNING' USING ERRCODE='42501',
      DETAIL='A grounding universe is built only for a RUNNING durable generation.';
  END IF;
  SELECT c.current_sp INTO frontier FROM public.session_semantic_clocks c
   WHERE c.session_id = execution_row.session_id AND c.user_id = execution_row.user_id;
  WITH focuses AS (
    SELECT f.id, f.grounding_handle_id, f.started_cu_id, f.started_sp,
           (SELECT max(a.session_position) FROM public.conversation_emerging_focus_attention_events a
             WHERE a.emerging_focus_id = f.id AND a.session_id = f.session_id AND a.session_position <= frontier) AS last_attention_sp,
           (SELECT r.anchor_text FROM public.conversation_reference_resolutions r
             WHERE r.resolved_handle_id = f.grounding_handle_id AND r.session_id = f.session_id
             ORDER BY r.session_position, r.same_sp_event_sequence, r.reference_index LIMIT 1) AS subject_text,
           (SELECT b.thread_id FROM public.conversation_thread_focus_bindings b
             WHERE b.emerging_focus_id = f.id AND b.session_id = f.session_id AND b.bound_sp <= frontier) AS thread_id,
           (SELECT b.bound_sp FROM public.conversation_thread_focus_bindings b
             WHERE b.emerging_focus_id = f.id AND b.session_id = f.session_id AND b.bound_sp <= frontier) AS thread_bound_sp
      FROM public.conversation_emerging_focuses f
     WHERE f.session_id = execution_row.session_id AND f.user_id = execution_row.user_id
       AND frontier IS NOT NULL AND f.started_sp <= frontier),
  bounded AS (
    SELECT * FROM focuses ORDER BY last_attention_sp DESC NULLS LAST, started_sp DESC, id LIMIT 32)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'handle', public.hypothesis_subject_grounding_handle_v1(p_execution_id, b.id),
      'emergingFocusId', b.id, 'groundingHandleId', b.grounding_handle_id, 'startedCuId', b.started_cu_id,
      'startedSp', b.started_sp, 'lastAttentionSp', b.last_attention_sp, 'subjectText', b.subject_text,
      'threadId', b.thread_id, 'threadBoundSp', b.thread_bound_sp) ORDER BY b.started_sp, b.id), '[]'::jsonb)
    INTO built
    FROM bounded b;
  INSERT INTO public.hypothesis_subject_grounding_universes (execution_id, user_id, session_id, source_turn_id, frontier_sp, entries)
  VALUES (p_execution_id, execution_row.user_id, execution_row.session_id, execution_row.source_turn_id, frontier, built)
  ON CONFLICT (execution_id) DO NOTHING;
  SELECT * INTO stored FROM public.hypothesis_subject_grounding_universes u WHERE u.execution_id = p_execution_id;
  RETURN public.hypothesis_subject_grounding_universe_presentation_v1(stored);
END;$$;

-- 11A.2 The grounded Candidate completion: the frozen 0033 completion
--       (unchanged text, unchanged grant) FIRST - it validates the candidate
--       plan against the durable authorized Intent and completes the effect -
--       then, in the SAME transaction, the proposal is judged against the
--       exact stored universe of this execution: exactly one selection per
--       accepted candidate, handles that are strings the server issued for
--       THIS execution, no duplicate, at most eight per candidate. Anything
--       else fails closed and rolls the completion back with it: no silent
--       fallback, no partial grounding. A NO_ACCEPTED_CANDIDATES result
--       grounds nothing and carries no proposal.
CREATE FUNCTION public.complete_post_response_grounded_candidates_v1(
  p_execution_id uuid, p_result_code text, p_result_payload jsonb, p_subject_grounding jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  completed boolean;
  execution_row public.post_response_intelligence_executions;
  universe public.hypothesis_subject_grounding_universes;
  stored public.hypothesis_subject_grounding_proposals;
  candidate_ids text[];
  selected_ids text[] := '{}';
  universe_handles text[];
  selection jsonb;
  handle jsonb;
  handles text[];
BEGIN
  IF p_result_code = 'NO_ACCEPTED_CANDIDATES' THEN
    IF p_subject_grounding IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_PROPOSAL' USING ERRCODE='22023',
        DETAIL='A generation that accepted no candidate grounds nothing.';
    END IF;
    RETURN public.complete_post_response_candidate_provider_effect_v1(p_execution_id, p_result_code, p_result_payload);
  END IF;
  IF p_result_code IS DISTINCT FROM 'VALIDATED_CANDIDATES' OR p_subject_grounding IS NULL OR jsonb_typeof(p_subject_grounding) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_PROPOSAL' USING ERRCODE='22023',
      DETAIL='A validated candidate plan carries exactly one grounding selection per accepted candidate.';
  END IF;
  completed := public.complete_post_response_candidate_provider_effect_v1(p_execution_id, p_result_code, p_result_payload);
  IF NOT completed THEN
    RETURN false;
  END IF;
  SELECT * INTO execution_row FROM public.post_response_intelligence_executions e WHERE e.id = p_execution_id;
  SELECT * INTO universe FROM public.hypothesis_subject_grounding_universes u WHERE u.execution_id = p_execution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBJECT_GROUNDING_UNIVERSE_MISSING' USING ERRCODE='55000',
      DETAIL='The server builds the authorized grounding universe of a generation BEFORE its provider is invoked; a proposal without one is not judgeable.';
  END IF;
  SELECT COALESCE(array_agg(lower(c.value ->> 'hypothesisId')), '{}') INTO candidate_ids
    FROM jsonb_array_elements(p_result_payload) AS c(value);
  SELECT COALESCE(array_agg(e.value ->> 'handle'), '{}') INTO universe_handles
    FROM jsonb_array_elements(universe.entries) AS e(value);
  IF jsonb_array_length(p_subject_grounding) <> cardinality(candidate_ids) THEN
    RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_PROPOSAL' USING ERRCODE='22023',
      DETAIL='Exactly one grounding selection per accepted candidate; zero handles is the explicit statement that the candidate grounds nothing.';
  END IF;
  FOR selection IN SELECT s.value FROM jsonb_array_elements(p_subject_grounding) AS s(value) LOOP
    IF jsonb_typeof(selection) <> 'object'
       OR (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(selection) k) IS DISTINCT FROM ARRAY['handles', 'hypothesisId']
       OR jsonb_typeof(selection -> 'hypothesisId') <> 'string'
       OR jsonb_typeof(selection -> 'handles') <> 'array' THEN
      RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_PROPOSAL' USING ERRCODE='22023',
        DETAIL='A selection is exactly a candidate Hypothesis identity and its list of handles.';
    END IF;
    IF NOT (lower(selection ->> 'hypothesisId') = ANY (candidate_ids)) THEN
      RAISE EXCEPTION 'SUBJECT_GROUNDING_TARGET_NOT_CANDIDATE' USING ERRCODE='22023',
        DETAIL='A grounding selection names an accepted candidate of this exact plan and nothing else.';
    END IF;
    IF lower(selection ->> 'hypothesisId') = ANY (selected_ids) THEN
      RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_PROPOSAL' USING ERRCODE='22023', DETAIL='A candidate is selected for at most once.';
    END IF;
    selected_ids := array_append(selected_ids, lower(selection ->> 'hypothesisId'));
    IF jsonb_array_length(selection -> 'handles') > 8 THEN
      RAISE EXCEPTION 'SUBJECT_GROUNDING_LIMIT_EXCEEDED' USING ERRCODE='22023';
    END IF;
    handles := '{}';
    FOR handle IN SELECT h.value FROM jsonb_array_elements(selection -> 'handles') AS h(value) LOOP
      IF jsonb_typeof(handle) <> 'string' THEN
        RAISE EXCEPTION 'INVALID_SUBJECT_GROUNDING_PROPOSAL' USING ERRCODE='22023', DETAIL='A handle is an opaque string.';
      END IF;
      IF (handle #>> '{}') = ANY (handles) THEN
        RAISE EXCEPTION 'SUBJECT_GROUNDING_DUPLICATE_HANDLE' USING ERRCODE='22023';
      END IF;
      IF NOT ((handle #>> '{}') = ANY (universe_handles)) THEN
        RAISE EXCEPTION 'SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE' USING ERRCODE='22023',
          DETAIL='Only an opaque handle the server issued for this execution can ground a candidate; no raw focus or Thread identity and no handle of another execution is admissible.';
      END IF;
      handles := array_append(handles, handle #>> '{}');
    END LOOP;
  END LOOP;
  INSERT INTO public.hypothesis_subject_grounding_proposals (execution_id, user_id, selections)
  VALUES (p_execution_id, execution_row.user_id, p_subject_grounding)
  ON CONFLICT (execution_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO stored FROM public.hypothesis_subject_grounding_proposals p WHERE p.execution_id = p_execution_id;
    IF stored.selections <> p_subject_grounding THEN
      RAISE EXCEPTION 'SUBJECT_GROUNDING_PROPOSAL_CONFLICT' USING ERRCODE='22023',
        DETAIL='The first durable proposal of a generation is immutable; a different proposal is refused, not merged.';
    END IF;
  END IF;
  RETURN true;
END;$$;

-- 11A.3 Persisting the authorized groundings of a generation, called by the
--       persist wrapper (section 11) in the SAME transaction as the frozen
--       core that created the Hypotheses. Every handle is re-resolved against
--       the stored universe and re-verified against canonical truth: the
--       focus exists, belongs to the execution's owner and Session and was
--       committed at or before the universe frontier; the Hypothesis exists
--       for the owner; the anchor is the execution association's own
--       committed Session Position (never the source turn, never the focus's
--       started SP - a late generation anchors where it actually became
--       canonical). Identity is derived; an identical replay writes nothing;
--       the same identity with a different semantic payload fails closed.
CREATE FUNCTION public.persist_authorized_subject_groundings_v1(p_execution_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  universe public.hypothesis_subject_grounding_universes;
  proposal public.hypothesis_subject_grounding_proposals;
  ctx record;
  selection jsonb;
  handle text;
  entry jsonb;
  target uuid;
  focus public.conversation_emerging_focuses;
  grounding uuid;
  expected jsonb;
  stored jsonb;
  inserted integer := 0;
BEGIN
  SELECT * INTO proposal FROM public.hypothesis_subject_grounding_proposals p WHERE p.execution_id = p_execution_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  SELECT * INTO execution_row FROM public.post_response_intelligence_executions e WHERE e.id = p_execution_id;
  SELECT * INTO universe FROM public.hypothesis_subject_grounding_universes u WHERE u.execution_id = p_execution_id;
  IF NOT FOUND OR universe.user_id <> execution_row.user_id OR universe.session_id <> execution_row.session_id THEN
    RAISE EXCEPTION 'SUBJECT_GROUNDING_UNIVERSE_MISSING' USING ERRCODE='55000';
  END IF;
  SELECT * INTO ctx FROM public.historical_capture_context_v1(execution_row.user_id);
  FOR selection IN SELECT s.value FROM jsonb_array_elements(proposal.selections) AS s(value) LOOP
    IF jsonb_array_length(selection -> 'handles') = 0 THEN
      CONTINUE;
    END IF;
    target := (selection ->> 'hypothesisId')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.hypotheses h WHERE h.id = target AND h.user_id = execution_row.user_id) THEN
      RAISE EXCEPTION 'SUBJECT_GROUNDING_TARGET_MISSING' USING ERRCODE='55000',
        DETAIL='A grounding is recorded only for a Hypothesis this generation actually persisted for its owner.';
    END IF;
    IF ctx.session_id IS DISTINCT FROM execution_row.session_id OR ctx.session_position IS NULL THEN
      RAISE EXCEPTION 'SUBJECT_GROUNDING_ANCHOR_UNAVAILABLE' USING ERRCODE='55000',
        DETAIL='A subject grounding is anchored through the execution association at an addressable committed Session Position of its Session.';
    END IF;
    FOR handle IN SELECT h.value FROM jsonb_array_elements_text(selection -> 'handles') AS h(value) LOOP
      SELECT e.value INTO entry FROM jsonb_array_elements(universe.entries) AS e(value) WHERE e.value ->> 'handle' = handle;
      IF entry IS NULL THEN
        RAISE EXCEPTION 'SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE' USING ERRCODE='55000';
      END IF;
      SELECT * INTO focus FROM public.conversation_emerging_focuses f WHERE f.id = (entry ->> 'emergingFocusId')::uuid;
      IF NOT FOUND OR focus.session_id <> execution_row.session_id OR focus.user_id <> execution_row.user_id
         OR universe.frontier_sp IS NULL OR focus.started_sp > universe.frontier_sp THEN
        RAISE EXCEPTION 'SUBJECT_GROUNDING_FOCUS_NOT_CANONICAL' USING ERRCODE='55000',
          DETAIL='A grounding names a committed Emerging Focus of the execution''s own Session and owner, at or before the universe frontier.';
      END IF;
      grounding := public.hypothesis_subject_grounding_identity_v1(target, focus.id);
      expected := jsonb_build_object('grounding_id', grounding, 'user_id', execution_row.user_id, 'hypothesis_id', target,
        'session_id', execution_row.session_id, 'emerging_focus_id', focus.id, 'execution_id', p_execution_id, 'source_turn_id', execution_row.source_turn_id);
      INSERT INTO public.hypothesis_subject_groundings (
        grounding_id, user_id, hypothesis_id, session_id, emerging_focus_id, execution_id, source_turn_id,
        universe_frontier_sp, session_position, same_sp_event_sequence, world_version)
      VALUES (grounding, execution_row.user_id, target, execution_row.session_id, focus.id, p_execution_id, execution_row.source_turn_id,
        universe.frontier_sp, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version)
      ON CONFLICT (grounding_id) DO NOTHING;
      IF FOUND THEN
        inserted := inserted + 1;
      ELSE
        SELECT to_jsonb(g) - 'created_at' - 'universe_frontier_sp' - 'session_position' - 'same_sp_event_sequence' - 'world_version' INTO stored
          FROM public.hypothesis_subject_groundings g WHERE g.grounding_id = grounding;
        IF stored IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'SUBJECT_GROUNDING_IDENTITY_CONFLICT' USING ERRCODE='22023',
            DETAIL='The same stable grounding identity was reused with a different semantic payload; nothing is replaced.';
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN inserted;
END;$$;

-- ===========================================================================
-- 12. The Thread <-> Reading appearance writers: Session-bound, identity
--     derived, idempotent, executable by NO application role. The ONE
--     recording core takes its anchor from the canonical row that derives the
--     appearance (section 12A: a subject grounding, or a focus -> Thread
--     binding), and the boundary-anchored helper reserves its own same-SP
--     position through the capture boundary. No caller ever supplies a
--     Thread / Reading pair from outside the server. The binding namespace
--       11be3a36-745a-54fd-a938-3f14eaedee14
--     = uuidV5(RFC 4122 URL namespace,
--              'https://qandeel.app/runtime/thread-reading-binding/v1').
-- ===========================================================================
CREATE FUNCTION public.record_thread_reading_appearance_v1(
  p_user_id uuid, p_session_id uuid, p_thread_id uuid, p_hypothesis_id uuid,
  p_session_position integer, p_event_sequence bigint, p_world_version bigint)
RETURNS TABLE(binding_id uuid, bound_sp integer, unbound_sp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  existing public.thread_reading_bindings;
  derived uuid;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_thread_id IS NULL OR p_hypothesis_id IS NULL
     OR p_session_position IS NULL OR p_event_sequence IS NULL OR p_world_version IS NULL THEN
    RAISE EXCEPTION 'INVALID_THREAD_READING_BINDING_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_threads t WHERE t.id = p_thread_id AND t.user_id = p_user_id)
     OR NOT EXISTS (SELECT 1 FROM public.hypotheses h WHERE h.id = p_hypothesis_id AND h.user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO existing FROM public.thread_reading_bindings b
   WHERE b.session_id = p_session_id AND b.thread_id = p_thread_id AND b.hypothesis_id = p_hypothesis_id AND b.unbound_sp IS NULL;
  IF FOUND THEN
    binding_id := existing.binding_id; bound_sp := existing.bound_sp; unbound_sp := existing.unbound_sp;
    RETURN NEXT; RETURN;
  END IF;
  derived := public.canonical_uuid_v5_v1('11be3a36-745a-54fd-a938-3f14eaedee14'::uuid,
    p_session_id::text || ':' || p_thread_id::text || ':' || p_hypothesis_id::text || ':' || p_session_position::text);
  IF EXISTS (SELECT 1 FROM public.thread_reading_bindings b WHERE b.binding_id = derived) THEN
    RAISE EXCEPTION 'THREAD_READING_BINDING_IDENTITY_CONFLICT' USING ERRCODE='22023',
      DETAIL='The same appearance identity already exists with a different validity; a Session Position never carries two lives of one appearance.';
  END IF;
  INSERT INTO public.thread_reading_bindings (
    binding_id, user_id, session_id, thread_id, hypothesis_id, bound_sp, bound_event_sequence, world_version)
  VALUES (derived, p_user_id, p_session_id, p_thread_id, p_hypothesis_id, p_session_position, p_event_sequence, p_world_version);
  binding_id := derived; bound_sp := p_session_position; unbound_sp := NULL;
  RETURN NEXT;
END;$$;

CREATE FUNCTION public.bind_reading_to_thread_v1(p_user_id uuid, p_session_id uuid, p_thread_id uuid, p_hypothesis_id uuid)
RETURNS TABLE(binding_id uuid, bound_sp integer, unbound_sp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_thread_id IS NULL OR p_hypothesis_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_THREAD_READING_BINDING_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT * INTO ctx FROM public.historical_capture_begin_v1(p_user_id, p_session_id, true);
  IF ctx.session_position IS NULL THEN
    RAISE EXCEPTION 'SESSION_POSITION_NOT_ESTABLISHED' USING ERRCODE='55000',
      DETAIL='A contextual appearance needs an addressable committed Session Position to be bound at.';
  END IF;
  RETURN QUERY SELECT * FROM public.record_thread_reading_appearance_v1(
    p_user_id, p_session_id, p_thread_id, p_hypothesis_id, ctx.session_position, ctx.same_sp_event_sequence, ctx.world_version);
END;$$;

CREATE FUNCTION public.unbind_reading_from_thread_v1(p_user_id uuid, p_session_id uuid, p_binding_id uuid)
RETURNS TABLE(binding_id uuid, bound_sp integer, unbound_sp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
  existing public.thread_reading_bindings;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_binding_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_THREAD_READING_BINDING_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT * INTO ctx FROM public.historical_capture_begin_v1(p_user_id, p_session_id, true);
  IF ctx.session_position IS NULL THEN
    RAISE EXCEPTION 'SESSION_POSITION_NOT_ESTABLISHED' USING ERRCODE='55000';
  END IF;
  SELECT * INTO existing FROM public.thread_reading_bindings b
   WHERE b.binding_id = p_binding_id AND b.user_id = p_user_id AND b.session_id = p_session_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF existing.unbound_sp IS NULL THEN
    UPDATE public.thread_reading_bindings b
       SET unbound_sp = ctx.session_position, unbound_event_sequence = ctx.same_sp_event_sequence
     WHERE b.binding_id = p_binding_id
     RETURNING * INTO existing;
  END IF;
  binding_id := existing.binding_id; bound_sp := existing.bound_sp; unbound_sp := existing.unbound_sp;
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 12A. THE A-1 PRODUCTION AUTHORITY (R2). The appearance is DERIVED, never
--      authored: a Reading appears in a Thread exactly when a canonical
--      subject grounding of the Reading names a focus that the canonical
--      B2 / B3 truth of the SAME Session resolves to that Thread. Two
--      triggers cover the two orders in which those facts can become
--      canonical, each anchoring the appearance at ITS OWN actual
--      availability - never at the Reading's creation, never at the causal
--      source turn, never backdated into a sealed Session Position:
--
--        Case A  the focus is already bound to a Thread in this Session when
--                the grounding becomes canonical -> the appearance is born in
--                the grounding's transaction, at the grounding's own anchor
--                (the execution association's SP / same-SP sequence / world
--                version);
--        Case B  the grounding exists while the focus is still Emerging ->
--                no appearance; when the focus later resolves to a Thread
--                (0068 establishment or 0070 continuity, both written by the
--                frozen FINAL chain as a conversation_thread_focus_bindings
--                row) the appearance is born in THAT transaction, at the
--                focus binding's own Session Position and Thread-layer
--                same-SP sequence, with the world version of that
--                transaction's capture context;
--        Case C  several groundings -> several appearances of ONE analytical
--                identity; a grounding to a focus that never resolves, an
--                Evidence overlap, a peer relation, a statement that names a
--                subject, the current LF and geometry derive nothing.
--
--      v1 validity is open-ended after bind: no current Hypothesis Runtime
--      operation changes a Hypothesis's subject (statement / type / domain /
--      scope / origin are immutable in place under the R-C2 guard, and an
--      Evidence attach, a status transition, a Confidence evaluation or a
--      Thread lifecycle change never touches a grounding), so nothing can
--      leave a binding stale; the unbind substrate stays reserved and
--      unreachable by any application role.
-- ===========================================================================
CREATE FUNCTION public.derive_thread_reading_appearances_for_grounding_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  binding public.conversation_thread_focus_bindings;
BEGIN
  FOR binding IN
    SELECT b.* FROM public.conversation_thread_focus_bindings b
     WHERE b.emerging_focus_id = NEW.emerging_focus_id AND b.session_id = NEW.session_id AND b.user_id = NEW.user_id
       AND b.bound_sp <= NEW.session_position
     ORDER BY b.thread_id
  LOOP
    PERFORM public.record_thread_reading_appearance_v1(NEW.user_id, NEW.session_id, binding.thread_id, NEW.hypothesis_id,
      NEW.session_position, NEW.same_sp_event_sequence, NEW.world_version);
  END LOOP;
  RETURN NULL;
END;$$;

CREATE FUNCTION public.derive_thread_reading_appearances_for_focus_binding_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  ctx record;
  anchored boolean := false;
  grounding public.hypothesis_subject_groundings;
BEGIN
  FOR grounding IN
    SELECT g.* FROM public.hypothesis_subject_groundings g
     WHERE g.emerging_focus_id = NEW.emerging_focus_id AND g.session_id = NEW.session_id AND g.user_id = NEW.user_id
       AND g.session_position <= NEW.bound_sp
     ORDER BY g.grounding_id
  LOOP
    IF NOT anchored THEN
      SELECT * INTO ctx FROM public.historical_capture_context_v1(NEW.user_id);
      anchored := true;
    END IF;
    PERFORM public.record_thread_reading_appearance_v1(NEW.user_id, NEW.session_id, NEW.thread_id, grounding.hypothesis_id,
      NEW.bound_sp, NEW.same_sp_event_sequence, ctx.world_version);
  END LOOP;
  RETURN NULL;
END;$$;

CREATE TRIGGER hypothesis_subject_groundings_thread_appearance
  AFTER INSERT ON public.hypothesis_subject_groundings
  FOR EACH ROW EXECUTE FUNCTION public.derive_thread_reading_appearances_for_grounding_v1();
CREATE TRIGGER conversation_thread_focus_bindings_thread_appearance
  AFTER INSERT ON public.conversation_thread_focus_bindings
  FOR EACH ROW EXECUTE FUNCTION public.derive_thread_reading_appearances_for_focus_binding_v1();

-- ===========================================================================
-- 13. R-C5 - wall-clock domain separation. A Material's expires_at is a
--     policy fact in the wall-clock domain. It is NEVER compared to TC. It is
--     mapped, deterministically, into Session Position space:
--
--       t(k) = the committed wall time of SP(k), taken as the running maximum
--              of the committed CU audit times up to k (monotone by
--              construction even under Session-clock serialization order)
--       expiry X belongs to:
--         PRE_FIRST_SP    when X <  t(1)         (expired at every addressable SP)
--         SP(n)           when t(n) <= X < t(n+1) (a same-SP validity transition;
--                                                 an exact tie X = t(n) is EXPIRED at n)
--         SP(LH)          when X >= t(LH) and X <= now and the Session is open
--                                                 (expired inside the open head)
--         NOT_IN_SESSION  when the Session closed before X
--         PENDING         when X lies in the future: no transition exists yet
--
--     Expiry never advances LH, never moves TC, never writes RH and never
--     erases identity or lineage; once SP(n) seals its then-final validity is
--     stable because t(n+1) is fixed.
-- ===========================================================================
CREATE FUNCTION public.historical_session_position_wall_time_v1(p_session_id uuid, p_sp integer)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT max(u.created_at) FROM public.conversation_units u
   WHERE u.session_id = p_session_id AND u.session_position <= p_sp
$$;

CREATE FUNCTION public.historical_memory_expiry_at_sp_v1(p_session_id uuid, p_expires_at timestamptz)
RETURNS TABLE(mapping text, session_position integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lh integer;
  closed timestamptz;
  first_time timestamptz;
  anchor integer;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_expires_at IS NULL THEN
    mapping := 'NO_EXPIRY'; session_position := NULL; RETURN NEXT; RETURN;
  END IF;
  SELECT c.current_sp INTO lh FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT s.closed_at INTO closed FROM public.conversation_sessions s WHERE s.id = p_session_id;
  IF lh IS NULL THEN
    IF p_expires_at <= now() THEN mapping := 'PRE_FIRST_SP'; ELSE mapping := 'PENDING'; END IF;
    session_position := NULL; RETURN NEXT; RETURN;
  END IF;
  first_time := public.historical_session_position_wall_time_v1(p_session_id, 1);
  IF p_expires_at < first_time THEN
    mapping := 'PRE_FIRST_SP'; session_position := NULL; RETURN NEXT; RETURN;
  END IF;
  SELECT max(k) INTO anchor
    FROM generate_series(1, lh) AS k
   WHERE public.historical_session_position_wall_time_v1(p_session_id, k) <= p_expires_at;
  IF anchor < lh THEN
    mapping := 'SP'; session_position := anchor; RETURN NEXT; RETURN;
  END IF;
  IF closed IS NOT NULL AND p_expires_at >= closed THEN
    mapping := 'NOT_IN_SESSION'; session_position := NULL; RETURN NEXT; RETURN;
  END IF;
  IF p_expires_at <= now() THEN
    mapping := 'SP'; session_position := lh; RETURN NEXT; RETURN;
  END IF;
  mapping := 'PENDING'; session_position := NULL; RETURN NEXT;
END;$$;

-- ===========================================================================
-- 14. Layer A - K(TC) = TemporalProject(W, TC). Owner-scoped (auth.uid()),
--     coverage-gated, TC validated against the authoritative Session
--     position, fail-closed on every technical gap (uncovered Session, missing
--     baseline, unaddressable TC). Each family is projected by ITS OWN
--     availability gate:
--
--       known(e) := (e.session_id = S AND e.session_position <= TC)
--                   OR e.world_version <= baseline(S)
--
--     then-current lifecycle / version truth is the latest known event of the
--     component; known noncurrent lineage stays known and is never treated as
--     current; relations, Evidence participations, Confidence evaluations and
--     contextual appearances are gated independently AND require both of
--     their endpoints to be known (no relation stub, no future identity);
--     Thread lifecycle at TC comes from the durable 0070 lifecycle history;
--     LF at TC from the durable 0071 transition history; Threads keep the ONE
--     Home assigned at establishment; no current mutable row is ever the
--     historical fallback for a versioned field. The result is stable for a
--     sealed TC and may legitimately evolve while TC is the open head.
--
--     Typed JSON arrays are the transport of typed families to the API
--     mapper; every element has a fixed key set (documented in
--     docs/historical-projection-v1.md and pinned by the runtime mapper).
-- ===========================================================================
CREATE FUNCTION public.get_session_historical_projection_v1(p_session_id uuid, p_tc integer)
RETURNS TABLE(
  session_id uuid,
  live_head integer,
  tc integer,
  sealed boolean,
  revision jsonb,
  moments jsonb,
  emerging_focuses jsonb,
  live_focus jsonb,
  threads jsonb,
  thread_reading_appearances jsonb,
  readings jsonb,
  reading_relations jsonb,
  evidence_participations jsonb,
  materials jsonb,
  gaps jsonb,
  questions jsonb,
  question_appearances jsonb,
  confidences jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid;
  lh integer;
  clock_sequence bigint;
  baseline bigint;
  coverage text;
  world_now bigint;
  pending_expiries integer;
  lf record;
BEGIN
  caller := (SELECT auth.uid());
  IF caller IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = caller) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  -- Z66-05: a technical coverage gap fails closed; it is never UNKNOWN_AT_TC.
  SELECT c.coverage_state INTO coverage FROM public.session_historical_coverage c
   WHERE c.session_id = p_session_id AND c.user_id = caller;
  IF NOT FOUND OR coverage <> 'COVERED' THEN
    RAISE EXCEPTION 'HISTORICAL_COVERAGE_UNAVAILABLE' USING ERRCODE='55000',
      DETAIL='This Session is a LEGACY UNCOVERED SESSION or carries no coverage decision: no Stage-6 historical semantics exist for it.';
  END IF;
  SELECT c.current_sp, c.same_sp_event_sequence INTO lh, clock_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id AND c.user_id = caller;
  IF NOT FOUND OR lh IS NULL THEN
    RAISE EXCEPTION 'LIVE_HEAD_NOT_ESTABLISHED' USING ERRCODE='55000',
      DETAIL='No user-addressable committed Session Position exists yet in this Session.';
  END IF;
  IF p_tc IS NULL OR p_tc < 1 OR p_tc > lh THEN
    RAISE EXCEPTION 'SESSION_POSITION_NOT_ADDRESSABLE' USING ERRCODE='22023',
      DETAIL='TC must be an addressable committed Session Position between SP(1) and the Live Head.';
  END IF;
  SELECT b.baseline_world_version INTO baseline FROM public.session_historical_baselines b
   WHERE b.session_id = p_session_id AND b.user_id = caller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HISTORICAL_BASELINE_MISSING' USING ERRCODE='55000',
      DETAIL='A covered Session with a Live Head carries no historical baseline: technical corruption, never epistemic absence.';
  END IF;
  SELECT COALESCE((SELECT w.current_version FROM public.historical_world_semantic_clocks w WHERE w.user_id = caller), 0) INTO world_now;

  session_id := p_session_id;
  live_head := lh;
  tc := p_tc;
  sealed := p_tc < lh;

  -- Moments (C1-C3): every committed CU with SP <= TC, in Session order.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', u.id, 'sp', u.session_position, 'sourceRole', u.source_role, 'sourceTurnId', u.source_turn_id,
      'ordinalWithinTurn', u.ordinal_within_turn, 'committedText', u.committed_text,
      'spanStart', u.source_span_start, 'spanEnd', u.source_span_end) ORDER BY u.session_position), '[]'::jsonb)
    INTO moments
    FROM public.conversation_units u
   WHERE u.session_id = p_session_id AND u.user_id = caller AND u.session_position <= p_tc;

  -- Emerging Focus (E1-E4): Session-scoped, pre-geographic; promotion
  -- lineage only once the establishing Moment is itself known.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', f.id, 'startedSp', f.started_sp,
      'lastAttentionSp', (SELECT max(a.session_position) FROM public.conversation_emerging_focus_attention_events a
                           WHERE a.emerging_focus_id = f.id AND a.session_id = p_session_id AND a.session_position <= p_tc),
      'promotedThreadId', (SELECT t.id FROM public.conversation_threads t
                            WHERE t.grounding_emerging_focus_id = f.id AND t.established_session_id = p_session_id AND t.established_sp <= p_tc)
      ) ORDER BY f.started_sp, f.id), '[]'::jsonb)
    INTO emerging_focuses
    FROM public.conversation_emerging_focuses f
   WHERE f.session_id = p_session_id AND f.user_id = caller AND f.started_sp <= p_tc;

  -- Live Focus at TC (L1-L2): the durable transition with the greatest SP <= TC.
  SELECT b.live_focus_kind, b.live_focus_ref, b.live_focus_sp INTO lf
    FROM public.conversation_session_live_focus_before_v1(p_session_id, p_tc + 1) b;
  live_focus := jsonb_build_object(
    'kind', lf.live_focus_kind, 'ref', lf.live_focus_ref, 'atSp', lf.live_focus_sp,
    'reasonCode', (SELECT t.reason_code FROM public.conversation_live_focus_transitions t
                    WHERE t.session_id = p_session_id AND t.session_position = lf.live_focus_sp));

  -- Threads (T1-T3): known through this Session's establishment, the
  -- baseline, or an explicit continuity binding; ONE Home, assigned at
  -- establishment; Session-local lifecycle from the durable 0070 history.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', t.id, 'establishmentPath', t.establishment_path,
      'establishedInSession', t.established_session_id = p_session_id,
      'establishedSp', CASE WHEN t.established_session_id = p_session_id THEN t.established_sp ELSE NULL END,
      'groundingEmergingFocusId', CASE WHEN t.established_session_id = p_session_id THEN t.grounding_emerging_focus_id ELSE NULL END,
      'home', jsonb_build_object('x', h.placement_x::text, 'y', h.placement_y::text),
      'sessionLifecycle', public.conversation_thread_session_lifecycle_state_v1(t.id, p_session_id, p_tc + 1)
      ) ORDER BY t.id), '[]'::jsonb)
    INTO threads
    FROM public.conversation_threads t
    JOIN public.historical_thread_availability a ON a.thread_id = t.id
    JOIN public.conversation_thread_homes h ON h.thread_id = t.id
   WHERE t.user_id = caller
     AND ((t.established_session_id = p_session_id AND t.established_sp <= p_tc)
          OR a.world_version <= baseline
          OR EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings fb
                      WHERE fb.thread_id = t.id AND fb.session_id = p_session_id AND fb.bound_sp <= p_tc));
  IF EXISTS (SELECT 1 FROM public.conversation_threads t
              WHERE t.user_id = caller AND NOT EXISTS (SELECT 1 FROM public.historical_thread_availability a WHERE a.thread_id = t.id)) THEN
    RAISE EXCEPTION 'HISTORICAL_PROJECTION_INTEGRITY' USING ERRCODE='55000',
      DETAIL='A canonical Thread carries no world availability: technical corruption, never epistemic absence.';
  END IF;

  -- Readings (R1-R5, R8): identity by creation event; then-current status and
  -- version from the latest known event; immutable fields reused under the
  -- preservation guard; a known Reading never shows an unknown later version.
  -- The v1 Hypothesis-backed Reading projection bridge (Stage 1.9: Reading <->
  -- Hypothesis is PARTIAL) carries the Reading's canonical subject groundings
  -- of THIS Session known at TC (own anchor <= TC), so a consumer can tell an
  -- ungrounded legacy Hypothesis from a grounded Reading whose focus is still
  -- Emerging from one that also appears in a Thread; grounding is never
  -- inferred from statement, scope, Evidence or the Thread appearance itself.
  WITH known AS (
    SELECT e.* FROM public.historical_reading_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  created AS (SELECT DISTINCT k.hypothesis_id FROM known k WHERE k.event_kind IN ('LEGACY_BASELINE', 'CREATED')),
  latest AS (
    SELECT DISTINCT ON (k.hypothesis_id) k.hypothesis_id, k.to_status, k.to_version
      FROM known k ORDER BY k.hypothesis_id, k.world_version DESC, k.to_version DESC),
  lineage AS (
    SELECT k.hypothesis_id, jsonb_agg(jsonb_build_object('kind', k.event_kind, 'fromStatus', k.from_status, 'toStatus', k.to_status,
             'fromVersion', k.from_version, 'toVersion', k.to_version) ORDER BY k.world_version, k.to_version) AS steps
      FROM known k GROUP BY k.hypothesis_id)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', h.id, 'statement', h.statement, 'type', h.type, 'domain', h.domain, 'scope', h.scope, 'origin', h.origin,
      'assumptions', to_jsonb(h.assumptions), 'disconfirmingConditions', to_jsonb(h.disconfirming_conditions),
      'statusAtTc', l.to_status, 'versionAtTc', l.to_version, 'lineage', g.steps,
      'subjectGroundings', COALESCE((SELECT jsonb_agg(jsonb_build_object('emergingFocusId', sg.emerging_focus_id, 'groundedAtSp', sg.session_position)
                                              ORDER BY sg.session_position, sg.grounding_id)
                                       FROM public.hypothesis_subject_groundings sg
                                      WHERE sg.hypothesis_id = h.id AND sg.user_id = caller AND sg.session_id = p_session_id
                                        AND sg.session_position <= p_tc), '[]'::jsonb)) ORDER BY h.id), '[]'::jsonb)
    INTO readings
    FROM created c
    JOIN public.hypotheses h ON h.id = c.hypothesis_id AND h.user_id = caller
    JOIN latest l ON l.hypothesis_id = h.id
    JOIN lineage g ON g.hypothesis_id = h.id;

  -- Peer relations (R7): unranked pairs whose LINKED event is known and whose
  -- both endpoints are known at TC.
  WITH known AS (
    SELECT e.* FROM public.historical_reading_relation_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  latest AS (
    SELECT DISTINCT ON (k.hypothesis_a, k.hypothesis_b) k.hypothesis_a, k.hypothesis_b, k.event_kind
      FROM known k ORDER BY k.hypothesis_a, k.hypothesis_b, k.world_version DESC),
  known_readings AS (
    SELECT DISTINCT e.hypothesis_id FROM public.historical_reading_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline))
  SELECT COALESCE(jsonb_agg(jsonb_build_object('a', l.hypothesis_a, 'b', l.hypothesis_b) ORDER BY l.hypothesis_a, l.hypothesis_b), '[]'::jsonb)
    INTO reading_relations
    FROM latest l
   WHERE l.event_kind IN ('LEGACY_BASELINE', 'LINKED')
     AND l.hypothesis_a IN (SELECT hypothesis_id FROM known_readings)
     AND l.hypothesis_b IN (SELECT hypothesis_id FROM known_readings);

  -- Materials (M1-M4): identity by creation event, status from the latest
  -- known status event, expiry through the R-C5 mapping, lineage only when
  -- the predecessor / successor is itself known.
  WITH known AS (
    SELECT e.* FROM public.historical_material_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  created AS (SELECT DISTINCT k.memory_id FROM known k WHERE k.event_kind IN ('LEGACY_BASELINE', 'CREATED')),
  latest AS (
    SELECT DISTINCT ON (k.memory_id) k.memory_id, k.to_status
      FROM known k ORDER BY k.memory_id, k.world_version DESC)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id, 'type', m.type, 'content', m.content, 'source', m.source, 'confidence', m.confidence, 'importance', m.importance,
      'version', m.version,
      'supersedesMemoryId', CASE WHEN m.supersedes_memory_id IN (SELECT memory_id FROM created) THEN m.supersedes_memory_id ELSE NULL END,
      'supersededByMemoryId', (SELECT s.id FROM public.memories s WHERE s.supersedes_memory_id = m.id AND s.id IN (SELECT memory_id FROM created)),
      'statusAtTc', CASE
        WHEN l.to_status = 'ACTIVE' AND x.mapping = 'PRE_FIRST_SP' THEN 'EXPIRED'
        WHEN l.to_status = 'ACTIVE' AND x.mapping = 'SP' AND x.session_position <= p_tc THEN 'EXPIRED'
        ELSE l.to_status END,
      'expiry', jsonb_build_object('mapping', x.mapping, 'sp', x.session_position)) ORDER BY m.id), '[]'::jsonb)
    INTO materials
    FROM created c
    JOIN public.memories m ON m.id = c.memory_id AND m.user_id = caller
    JOIN latest l ON l.memory_id = m.id
    CROSS JOIN LATERAL public.historical_memory_expiry_at_sp_v1(p_session_id, m.expires_at) x;

  -- Evidence participations (R6 / A-2): the Material <-> Reading appearance,
  -- own attach event known, both endpoints known, latest kind present.
  WITH known AS (
    SELECT e.* FROM public.historical_evidence_participation_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  latest AS (
    SELECT DISTINCT ON (k.hypothesis_id, k.evidence_id, k.evidence_role) k.hypothesis_id, k.evidence_id, k.evidence_role, k.event_kind
      FROM known k ORDER BY k.hypothesis_id, k.evidence_id, k.evidence_role, k.world_version DESC, k.reading_version DESC),
  known_readings AS (
    SELECT DISTINCT e.hypothesis_id FROM public.historical_reading_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  known_materials AS (
    SELECT DISTINCT e.memory_id FROM public.historical_material_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'hypothesisId', l.hypothesis_id, 'evidenceId', l.evidence_id, 'memoryId', substring(l.evidence_id from 8)::uuid, 'role', l.evidence_role)
      ORDER BY l.hypothesis_id, l.evidence_role, l.evidence_id), '[]'::jsonb)
    INTO evidence_participations
    FROM latest l
   WHERE l.event_kind IN ('LEGACY_BASELINE', 'ATTACHED')
     AND l.hypothesis_id IN (SELECT hypothesis_id FROM known_readings)
     AND substring(l.evidence_id from 8)::uuid IN (SELECT memory_id FROM known_materials);

  -- Information Gaps (U1-U2, A-3): identity by creation event; then-current
  -- status / epoch from the latest known lifecycle event; related Readings
  -- (the Unknown <-> Reading appearance, same-transaction anchor) filtered to
  -- the Readings known at TC.
  WITH known AS (
    SELECT e.* FROM public.historical_gap_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  created AS (SELECT DISTINCT k.information_gap_id FROM known k WHERE k.event_kind IN ('LEGACY_BASELINE', 'CREATED')),
  latest AS (
    SELECT DISTINCT ON (k.information_gap_id) k.information_gap_id, k.to_status, k.open_epoch, k.closure_reason
      FROM known k ORDER BY k.information_gap_id, k.world_version DESC, k.open_epoch DESC),
  known_readings AS (
    SELECT DISTINCT e.hypothesis_id FROM public.historical_reading_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', g.id, 'informationNeeded', g.information_needed, 'whyItMatters', g.why_it_matters,
      'userAnswerability', g.user_answerability, 'preferredQuestionType', g.preferred_question_type,
      'readingIds', COALESCE((SELECT jsonb_agg(r ORDER BY r) FROM unnest(g.related_hypothesis_ids) AS r WHERE r IN (SELECT hypothesis_id FROM known_readings)), '[]'::jsonb),
      'statusAtTc', l.to_status, 'openEpochAtTc', l.open_epoch, 'closureReasonAtTc', l.closure_reason) ORDER BY g.id), '[]'::jsonb)
    INTO gaps
    FROM created c
    JOIN public.information_gaps g ON g.id = c.information_gap_id AND g.user_id = caller
    JOIN latest l ON l.information_gap_id = g.id;

  -- Question candidates (Q1): identity by creation event; the Gap must be known.
  WITH known AS (
    SELECT e.* FROM public.historical_question_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  known_gaps AS (
    SELECT DISTINCT e.information_gap_id FROM public.historical_gap_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  known_readings AS (
    SELECT DISTINCT e.hypothesis_id FROM public.historical_reading_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', q.id, 'informationGapId', q.information_gap_id, 'questionText', q.question_text, 'questionType', q.question_type,
      'answerFormat', q.answer_format, 'informationNeeded', q.information_needed,
      'targetReadingIds', COALESCE((SELECT jsonb_agg(r ORDER BY r) FROM unnest(q.target_hypothesis_ids) AS r WHERE r IN (SELECT hypothesis_id FROM known_readings)), '[]'::jsonb)
      ) ORDER BY q.id), '[]'::jsonb)
    INTO questions
    FROM known k
    JOIN public.question_candidates q ON q.id = k.question_candidate_id AND q.user_id = caller
   WHERE q.information_gap_id IN (SELECT information_gap_id FROM known_gaps);

  -- Formal Question <-> Turn appearances (A-4): Session-anchored at the SP of
  -- the exchange's first committed Moment; Gap and Reading must be known.
  WITH known_gaps AS (
    SELECT DISTINCT e.information_gap_id FROM public.historical_gap_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  known_readings AS (
    SELECT DISTINCT e.hypothesis_id FROM public.historical_reading_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'bindingId', b.id, 'informationGapId', b.information_gap_id, 'gapOpenEpoch', b.gap_open_epoch,
      'hypothesisId', b.hypothesis_id, 'hypothesisVersion', b.hypothesis_version, 'questionType', b.question_type,
      'sourceTurnId', b.source_turn_id, 'assistantTurnId', b.assistant_turn_id, 'appearedAtSp', a.session_position) ORDER BY a.session_position, b.id), '[]'::jsonb)
    INTO question_appearances
    FROM public.historical_question_appearance_events a
    JOIN public.formal_question_turn_bindings b ON b.id = a.binding_id
   WHERE a.session_id = p_session_id AND a.user_id = caller AND a.session_position <= p_tc
     AND b.information_gap_id IN (SELECT information_gap_id FROM known_gaps)
     AND b.hypothesis_id IN (SELECT hypothesis_id FROM known_readings);

  -- Confidence (F1): own creation event; target Reading known; resolution
  -- against the Reading's then-current version: CURRENT (targets the version
  -- known at TC and is the latest known evaluation of it), SUPERSEDED (an
  -- earlier version, or a later known evaluation of the same version exists),
  -- PREVALID (targets a version this Session does not yet know - reachable
  -- only through an unassociated version advance).
  WITH known AS (
    SELECT e.* FROM public.historical_confidence_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  reading_events AS (
    SELECT e.* FROM public.historical_reading_events e
     WHERE e.user_id = caller
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  known_readings AS (SELECT DISTINCT r.hypothesis_id FROM reading_events r WHERE r.event_kind IN ('LEGACY_BASELINE', 'CREATED')),
  reading_version AS (
    SELECT DISTINCT ON (r.hypothesis_id) r.hypothesis_id, r.to_version
      FROM reading_events r ORDER BY r.hypothesis_id, r.world_version DESC, r.to_version DESC),
  ordered AS (
    SELECT k.*, row_number() OVER (PARTITION BY k.hypothesis_id, k.target_version ORDER BY k.world_version DESC, k.confidence_evaluation_id DESC) AS recency
      FROM known k)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.id, 'targetReadingId', c.target_id, 'targetVersion', c.target_version,
      'missingInformationCodes', to_jsonb(c.missing_information_codes),
      'supportingEvidenceIds', to_jsonb(c.supporting_evidence_ids), 'contradictingEvidenceIds', to_jsonb(c.contradicting_evidence_ids),
      'assumptions', to_jsonb(c.assumptions),
      'alternativeReadingIds', COALESCE((SELECT jsonb_agg(r ORDER BY r) FROM unnest(c.alternative_hypothesis_ids) AS r WHERE r IN (SELECT hypothesis_id FROM known_readings)), '[]'::jsonb),
      'resolution', CASE
        WHEN c.target_version > v.to_version THEN 'PREVALID'
        WHEN c.target_version < v.to_version OR k.recency > 1 THEN 'SUPERSEDED'
        ELSE 'CURRENT' END) ORDER BY c.id), '[]'::jsonb)
    INTO confidences
    FROM ordered k
    JOIN public.confidence_evaluations c ON c.id = k.confidence_evaluation_id AND c.user_id = caller
    JOIN reading_version v ON v.hypothesis_id = c.target_id
   WHERE c.target_id IN (SELECT hypothesis_id FROM known_readings);

  -- Thread <-> Reading appearances (A-1): own bound_sp, validity by ordinal,
  -- both endpoints known.
  WITH known_readings AS (
    SELECT DISTINCT e.hypothesis_id FROM public.historical_reading_events e
     WHERE e.user_id = caller AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
       AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline)),
  known_threads AS (
    SELECT t.id FROM public.conversation_threads t
    JOIN public.historical_thread_availability a ON a.thread_id = t.id
   WHERE t.user_id = caller
     AND ((t.established_session_id = p_session_id AND t.established_sp <= p_tc)
          OR a.world_version <= baseline
          OR EXISTS (SELECT 1 FROM public.conversation_thread_focus_bindings fb
                      WHERE fb.thread_id = t.id AND fb.session_id = p_session_id AND fb.bound_sp <= p_tc)))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'bindingId', b.binding_id, 'threadId', b.thread_id, 'hypothesisId', b.hypothesis_id, 'boundSp', b.bound_sp,
      'current', b.unbound_sp IS NULL OR b.unbound_sp > p_tc) ORDER BY b.bound_sp, b.binding_id), '[]'::jsonb)
    INTO thread_reading_appearances
    FROM public.thread_reading_bindings b
   WHERE b.session_id = p_session_id AND b.user_id = caller AND b.bound_sp <= p_tc
     AND b.thread_id IN (SELECT id FROM known_threads)
     AND b.hypothesis_id IN (SELECT hypothesis_id FROM known_readings);

  -- The projection revision: authoritative inputs only. A sealed TC is stable
  -- under any revision; the open head evolves with the Session clock, the
  -- world clock and (R-C5, through the ONE mapping) the count of known
  -- Materials whose expiry is still PENDING.
  SELECT count(*)::int INTO pending_expiries
    FROM public.memories m
    CROSS JOIN LATERAL public.historical_memory_expiry_at_sp_v1(p_session_id, m.expires_at) x
   WHERE m.user_id = caller AND x.mapping = 'PENDING'
     AND EXISTS (SELECT 1 FROM public.historical_material_events e
                  WHERE e.memory_id = m.id AND e.event_kind IN ('LEGACY_BASELINE', 'CREATED')
                    AND ((e.session_id = p_session_id AND e.session_position IS NOT NULL AND e.session_position <= p_tc) OR e.world_version <= baseline));
  revision := jsonb_build_object('liveHead', lh, 'sameSpEventSequence', clock_sequence, 'worldVersion', world_now, 'pendingExpiries', pending_expiries);
  RETURN NEXT;
END;$$;

-- ===========================================================================
-- 15. Ownership, search_path hardening, RLS, and THE AUTHORITY POSTURE:
--
--       GRANT  authenticated -> the ONE owner-scoped Layer-A projection read
--       GRANT  service_role  -> the three managed commands (their unchanged
--                               public names), the synchronization entry
--                               (unchanged name), the execution-associated
--                               Memory creation command, and (R2) the two
--                               server-only subject-grounding entries: the
--                               universe build and the grounded Candidate
--                               completion
--       REVOKE service_role  -> the three renamed frozen cores
--
--     R-C3 keeps the live legacy Evidence-attach entrypoints (0005 / 0008 /
--     0021 / 0028) and their grants untouched: every write they make passes
--     the capture hook, which is what defangs the old untracked bypass.
--     Nothing else is granted: the capture boundary, every capture hook, the
--     Thread <-> Reading writers and the appearance-deriving triggers, the
--     grounding persistence and identity functions, the expiry mapping and
--     every history table (the three subject-grounding tables included) stay
--     executable / reachable by NO application role.
-- ===========================================================================
ALTER TABLE public.historical_world_semantic_clocks OWNER TO postgres;
ALTER TABLE public.session_historical_coverage OWNER TO postgres;
ALTER TABLE public.session_historical_baselines OWNER TO postgres;
ALTER TABLE public.historical_thread_availability OWNER TO postgres;
ALTER TABLE public.historical_reading_events OWNER TO postgres;
ALTER TABLE public.historical_evidence_participation_events OWNER TO postgres;
ALTER TABLE public.historical_reading_relation_events OWNER TO postgres;
ALTER TABLE public.historical_material_events OWNER TO postgres;
ALTER TABLE public.historical_gap_events OWNER TO postgres;
ALTER TABLE public.historical_question_events OWNER TO postgres;
ALTER TABLE public.historical_confidence_events OWNER TO postgres;
ALTER TABLE public.historical_question_appearance_events OWNER TO postgres;
ALTER TABLE public.thread_reading_bindings OWNER TO postgres;
ALTER TABLE public.hypothesis_subject_groundings OWNER TO postgres;
ALTER TABLE public.hypothesis_subject_grounding_universes OWNER TO postgres;
ALTER TABLE public.hypothesis_subject_grounding_proposals OWNER TO postgres;

ALTER TABLE public.historical_world_semantic_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_historical_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_historical_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_thread_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_reading_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_evidence_participation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_reading_relation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_material_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_gap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_question_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_confidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_question_appearance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_reading_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypothesis_subject_groundings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypothesis_subject_grounding_universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypothesis_subject_grounding_proposals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.historical_world_semantic_clocks, public.session_historical_coverage, public.session_historical_baselines,
  public.historical_thread_availability, public.historical_reading_events, public.historical_evidence_participation_events,
  public.historical_reading_relation_events, public.historical_material_events, public.historical_gap_events,
  public.historical_question_events, public.historical_confidence_events, public.historical_question_appearance_events,
  public.thread_reading_bindings, public.hypothesis_subject_groundings, public.hypothesis_subject_grounding_universes,
  public.hypothesis_subject_grounding_proposals
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.guard_historical_world_semantic_clock_v1() OWNER TO postgres;
ALTER FUNCTION public.provision_session_historical_coverage_v1() OWNER TO postgres;
ALTER FUNCTION public.guard_thread_reading_binding_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.reject_historical_projection_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.historical_event_identity_v1(text) OWNER TO postgres;
ALTER FUNCTION public.historical_capture_begin_v1(uuid,uuid,boolean) OWNER TO postgres;
ALTER FUNCTION public.historical_capture_context_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.historical_capture_begin_for_execution_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.historical_event_identity_conflict_v1(text,uuid,jsonb) OWNER TO postgres;
ALTER FUNCTION public.capture_historical_reading_change_v1() OWNER TO postgres;
ALTER FUNCTION public.record_historical_evidence_participation_v1(uuid,uuid,text,text,text,integer,uuid,integer,bigint,bigint) OWNER TO postgres;
ALTER FUNCTION public.record_historical_reading_relation_v1(uuid,uuid,uuid,text,uuid,integer,bigint,bigint) OWNER TO postgres;
ALTER FUNCTION public.capture_historical_material_change_v1() OWNER TO postgres;
ALTER FUNCTION public.capture_historical_gap_change_v1() OWNER TO postgres;
ALTER FUNCTION public.capture_historical_question_creation_v1() OWNER TO postgres;
ALTER FUNCTION public.capture_historical_confidence_creation_v1() OWNER TO postgres;
ALTER FUNCTION public.capture_historical_thread_availability_v1() OWNER TO postgres;
ALTER FUNCTION public.capture_session_historical_baseline_v1() OWNER TO postgres;
ALTER FUNCTION public.guard_historical_canonical_row_preservation_v1() OWNER TO postgres;
ALTER FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb) OWNER TO postgres;
ALTER FUNCTION public.execute_post_response_confidence_batch_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.sync_post_response_information_gaps_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.server_create_memory_for_execution_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.bind_reading_to_thread_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.unbind_reading_from_thread_v1(uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.record_thread_reading_appearance_v1(uuid,uuid,uuid,uuid,integer,bigint,bigint) OWNER TO postgres;
ALTER FUNCTION public.derive_thread_reading_appearances_for_grounding_v1() OWNER TO postgres;
ALTER FUNCTION public.derive_thread_reading_appearances_for_focus_binding_v1() OWNER TO postgres;
ALTER FUNCTION public.hypothesis_subject_grounding_identity_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.hypothesis_subject_grounding_handle_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.hypothesis_subject_grounding_universe_presentation_v1(public.hypothesis_subject_grounding_universes) OWNER TO postgres;
ALTER FUNCTION public.build_hypothesis_subject_grounding_universe_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.complete_post_response_grounded_candidates_v1(uuid,text,jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.persist_authorized_subject_groundings_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.historical_session_position_wall_time_v1(uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.historical_memory_expiry_at_sp_v1(uuid,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.get_session_historical_projection_v1(uuid,integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.guard_historical_world_semantic_clock_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provision_session_historical_coverage_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_thread_reading_binding_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_historical_projection_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.historical_event_identity_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.historical_capture_begin_v1(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.historical_capture_context_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.historical_capture_begin_for_execution_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.historical_event_identity_conflict_v1(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_historical_reading_change_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_historical_evidence_participation_v1(uuid,uuid,text,text,text,integer,uuid,integer,bigint,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_historical_reading_relation_v1(uuid,uuid,uuid,text,uuid,integer,bigint,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_historical_material_change_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_historical_gap_change_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_historical_question_creation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_historical_confidence_creation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_historical_thread_availability_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_session_historical_baseline_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_historical_canonical_row_preservation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_post_response_confidence_batch_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_post_response_information_gaps_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.server_create_memory_for_execution_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_reading_to_thread_v1(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unbind_reading_from_thread_v1(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_thread_reading_appearance_v1(uuid,uuid,uuid,uuid,integer,bigint,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_thread_reading_appearances_for_grounding_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_thread_reading_appearances_for_focus_binding_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hypothesis_subject_grounding_identity_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hypothesis_subject_grounding_handle_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hypothesis_subject_grounding_universe_presentation_v1(public.hypothesis_subject_grounding_universes) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.build_hypothesis_subject_grounding_universe_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_post_response_grounded_candidates_v1(uuid,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_authorized_subject_groundings_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.historical_session_position_wall_time_v1(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.historical_memory_expiry_at_sp_v1(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_session_historical_projection_v1(uuid,integer) FROM PUBLIC, anon, authenticated;

-- R-C3: the legacy Evidence-attach paths (0005 attach_hypothesis_evidence,
-- 0008 apply_hypothesis_evidence_update, 0021 background_attach_hypothesis_
-- evidence_v1 and the 0028 rewrites) keep their object identity and their
-- callers, but none can author an UNTRACKED participation any more: every
-- write to public.hypotheses - whatever its path, role or entry point - passes
-- the capture hook, which records the participation boundary. A path that
-- carries no server-owned Session association (an authenticated client call,
-- a caller-supplied session id) is captured UNASSOCIATED: world version only,
-- no fabricated Session anchor; the fact enters later Sessions through their
-- baseline (REV66-06 section 4.5) and is never shown as this Session's
-- knowledge. The proof is behavioural (verify-migration-0072): each legacy
-- path authors exactly one tracked participation event and no untracked one.
REVOKE ALL ON FUNCTION public.persist_post_response_hypothesis_generation_v1_core(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_post_response_hypothesis_update_batch_v1_core(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_post_response_confidence_batch_v1_core(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_session_historical_projection_v1(uuid,integer) TO authenticated;

DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.historical_world_semantic_clocks, public.session_historical_coverage, public.session_historical_baselines, '
       || 'public.historical_thread_availability, public.historical_reading_events, public.historical_evidence_participation_events, '
       || 'public.historical_reading_relation_events, public.historical_material_events, public.historical_gap_events, '
       || 'public.historical_question_events, public.historical_confidence_events, public.historical_question_appearance_events, '
       || 'public.thread_reading_bindings, public.hypothesis_subject_groundings, public.hypothesis_subject_grounding_universes, '
       || 'public.hypothesis_subject_grounding_proposals FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.record_thread_reading_appearance_v1(uuid,uuid,uuid,uuid,integer,bigint,bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.hypothesis_subject_grounding_identity_v1(uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.hypothesis_subject_grounding_handle_v1(uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.hypothesis_subject_grounding_universe_presentation_v1(public.hypothesis_subject_grounding_universes) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.persist_authorized_subject_groundings_v1(uuid) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.build_hypothesis_subject_grounding_universe_v1(uuid) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.complete_post_response_grounded_candidates_v1(uuid,text,jsonb,jsonb) TO service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.historical_capture_begin_v1(uuid,uuid,boolean) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.historical_capture_context_v1(uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.historical_capture_begin_for_execution_v1(uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.historical_event_identity_v1(text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.historical_event_identity_conflict_v1(text,uuid,jsonb) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.record_historical_evidence_participation_v1(uuid,uuid,text,text,text,integer,uuid,integer,bigint,bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.record_historical_reading_relation_v1(uuid,uuid,uuid,text,uuid,integer,bigint,bigint) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.bind_reading_to_thread_v1(uuid,uuid,uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.unbind_reading_from_thread_v1(uuid,uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.historical_session_position_wall_time_v1(uuid,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.historical_memory_expiry_at_sp_v1(uuid,timestamptz) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_session_historical_projection_v1(uuid,integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.persist_post_response_hypothesis_generation_v1_core(uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.execute_post_response_hypothesis_update_batch_v1_core(uuid,jsonb) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.execute_post_response_confidence_batch_v1_core(uuid) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.execute_post_response_confidence_batch_v1(uuid) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.sync_post_response_information_gaps_v1(uuid) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_create_memory_for_execution_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) TO service_role';
END IF;END$$;

-- ===========================================================================
-- 16. Terminal self-assertions. The migration refuses to deploy a substrate
--     that left a legacy Session covered, a Session without a coverage
--     decision, a legacy analytical row without its baseline event, a
--     history table reachable by an application role, a frozen core still
--     executable, a Reading write path outside the capture hook, a coverage
--     gate on committed-CU insertion (coverage gates the projection, never
--     the Conversation Runtime), a drifted identity namespace, a projection
--     that is not read-only by declaration, or a Session Semantic Clock that
--     changed shape.
-- ===========================================================================
DO $$
DECLARE
  offending integer;
  legacy_reading integer;
  legacy_material integer;
  legacy_gap integer;
  legacy_question integer;
  legacy_confidence integer;
  legacy_thread integer;
  vector uuid;
  posture record;
  fn text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE NOT EXISTS (SELECT 1 FROM public.session_historical_coverage c WHERE c.session_id = s.id)) THEN
    RAISE EXCEPTION 'T-03C self-assertion: every Session carries a coverage decision' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.session_historical_coverage c WHERE c.coverage_state <> 'LEGACY_UNCOVERED') THEN
    RAISE EXCEPTION 'T-03C self-assertion: every pre-existing Session is a LEGACY UNCOVERED SESSION' USING ERRCODE='55000';
  END IF;
  SELECT count(*) INTO legacy_reading FROM public.hypotheses h WHERE NOT EXISTS (SELECT 1 FROM public.historical_reading_events e WHERE e.hypothesis_id = h.id);
  SELECT count(*) INTO legacy_material FROM public.memories m WHERE NOT EXISTS (SELECT 1 FROM public.historical_material_events e WHERE e.memory_id = m.id);
  SELECT count(*) INTO legacy_gap FROM public.information_gaps g WHERE NOT EXISTS (SELECT 1 FROM public.historical_gap_events e WHERE e.information_gap_id = g.id);
  SELECT count(*) INTO legacy_question FROM public.question_candidates q WHERE NOT EXISTS (SELECT 1 FROM public.historical_question_events e WHERE e.question_candidate_id = q.id);
  SELECT count(*) INTO legacy_confidence FROM public.confidence_evaluations c WHERE NOT EXISTS (SELECT 1 FROM public.historical_confidence_events e WHERE e.confidence_evaluation_id = c.id);
  SELECT count(*) INTO legacy_thread FROM public.conversation_threads t WHERE NOT EXISTS (SELECT 1 FROM public.historical_thread_availability a WHERE a.thread_id = t.id);
  IF legacy_reading + legacy_material + legacy_gap + legacy_question + legacy_confidence + legacy_thread <> 0 THEN
    RAISE EXCEPTION 'T-03C self-assertion: every pre-existing canonical fact carries its legacy baseline event' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.historical_reading_events WHERE world_version <> 0 OR session_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.historical_material_events WHERE world_version <> 0 OR session_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.historical_gap_events WHERE world_version <> 0 OR session_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.historical_question_events WHERE world_version <> 0 OR session_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.historical_confidence_events WHERE world_version <> 0 OR session_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.historical_evidence_participation_events WHERE world_version <> 0 OR session_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.historical_reading_relation_events WHERE world_version <> 0 OR session_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.historical_thread_availability WHERE world_version <> 0)
     OR EXISTS (SELECT 1 FROM public.session_historical_baselines)
     OR EXISTS (SELECT 1 FROM public.thread_reading_bindings)
     OR EXISTS (SELECT 1 FROM public.historical_question_appearance_events) THEN
    RAISE EXCEPTION 'T-03C self-assertion: the migration seeds legacy baseline events only - no Session anchor, no baseline, no appearance is fabricated' USING ERRCODE='55000';
  END IF;
  -- The frozen identity namespaces re-derive from their documented URIs.
  vector := public.canonical_uuid_v5_v1('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid, 'https://qandeel.app/runtime/historical-availability-event/v1');
  IF vector <> '79466f6b-04fd-5150-aa23-59682098057c'::uuid THEN
    RAISE EXCEPTION 'T-03C self-assertion: the historical event namespace drifted (%)', vector USING ERRCODE='55000';
  END IF;
  vector := public.canonical_uuid_v5_v1('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid, 'https://qandeel.app/runtime/thread-reading-binding/v1');
  IF vector <> '11be3a36-745a-54fd-a938-3f14eaedee14'::uuid THEN
    RAISE EXCEPTION 'T-03C self-assertion: the Thread <-> Reading binding namespace drifted (%)', vector USING ERRCODE='55000';
  END IF;
  vector := public.canonical_uuid_v5_v1('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid, 'https://qandeel.app/runtime/hypothesis-subject-grounding/v1');
  IF vector <> '1592a69d-781e-57ce-bb2c-6744a6ac3ceb'::uuid THEN
    RAISE EXCEPTION 'T-03C self-assertion: the subject-grounding namespace drifted (%)', vector USING ERRCODE='55000';
  END IF;
  vector := public.canonical_uuid_v5_v1('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid, 'https://qandeel.app/runtime/subject-grounding-handle/v1');
  IF vector <> '8feaee1d-fe51-5e9e-8594-52499b414e64'::uuid THEN
    RAISE EXCEPTION 'T-03C self-assertion: the subject-grounding handle namespace drifted (%)', vector USING ERRCODE='55000';
  END IF;
  IF public.hypothesis_subject_grounding_identity_v1('11111111-2222-4333-8444-555555555555'::uuid, '4ef8538d-ddda-5e11-b7d9-052be85de59a'::uuid)
       <> 'a89b9e67-501f-5c0d-bede-122763231f6e'::uuid
     OR public.hypothesis_subject_grounding_handle_v1('10000000-0000-4000-8000-000000000005'::uuid, '4ef8538d-ddda-5e11-b7d9-052be85de59a'::uuid)
       <> '22d3c5d1-02cc-55e5-97c8-7b5563e5332f' THEN
    RAISE EXCEPTION 'T-03C self-assertion: the pinned subject-grounding vectors do not reproduce' USING ERRCODE='55000';
  END IF;
  IF public.historical_event_identity_v1('reading-created:11111111-2222-4333-8444-555555555555') <> '91dc104c-e42b-54ff-8638-6dd7776f318c'::uuid THEN
    RAISE EXCEPTION 'T-03C self-assertion: the pinned event identity vector does not reproduce' USING ERRCODE='55000';
  END IF;
  -- Read-only by declaration.
  FOR fn IN SELECT unnest(ARRAY['public.get_session_historical_projection_v1(uuid,integer)', 'public.historical_memory_expiry_at_sp_v1(uuid,timestamptz)',
                                'public.historical_session_position_wall_time_v1(uuid,integer)']) LOOP
    SELECT p.provolatile AS volatility, p.prosecdef AS definer INTO posture FROM pg_proc p WHERE p.oid = to_regprocedure(fn);
    IF posture.volatility <> 's' OR NOT posture.definer THEN
      RAISE EXCEPTION 'T-03C self-assertion: % must be STABLE SECURITY DEFINER', fn USING ERRCODE='55000';
    END IF;
  END LOOP;
  -- Every history table is unreachable by every application role.
  SELECT count(*) INTO offending FROM (
    SELECT r.role_name, t.table_name FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role_name)
    CROSS JOIN (VALUES ('historical_world_semantic_clocks'), ('session_historical_coverage'), ('session_historical_baselines'),
      ('historical_thread_availability'), ('historical_reading_events'), ('historical_evidence_participation_events'),
      ('historical_reading_relation_events'), ('historical_material_events'), ('historical_gap_events'),
      ('historical_question_events'), ('historical_confidence_events'), ('historical_question_appearance_events'),
      ('thread_reading_bindings'), ('hypothesis_subject_groundings'), ('hypothesis_subject_grounding_universes'),
      ('hypothesis_subject_grounding_proposals')) AS t(table_name)
    WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.role_name)
      AND (has_table_privilege(r.role_name, 'public.' || t.table_name, 'SELECT')
        OR has_table_privilege(r.role_name, 'public.' || t.table_name, 'INSERT')
        OR has_table_privilege(r.role_name, 'public.' || t.table_name, 'UPDATE')
        OR has_table_privilege(r.role_name, 'public.' || t.table_name, 'DELETE'))) x;
  IF offending <> 0 THEN
    RAISE EXCEPTION 'T-03C self-assertion: a history table is reachable by an application role' USING ERRCODE='55000';
  END IF;
  -- The authority posture.
  IF NOT has_function_privilege('authenticated', 'public.get_session_historical_projection_v1(uuid,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_session_historical_projection_v1(uuid,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.bind_reading_to_thread_v1(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_thread_reading_appearance_v1(uuid,uuid,uuid,uuid,integer,bigint,bigint)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.build_hypothesis_subject_grounding_universe_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.complete_post_response_grounded_candidates_v1(uuid,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.persist_authorized_subject_groundings_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.historical_capture_begin_v1(uuid,uuid,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T-03C self-assertion: the authority posture is wrong' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    IF has_function_privilege('service_role', 'public.persist_post_response_hypothesis_generation_v1_core(uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.execute_post_response_hypothesis_update_batch_v1_core(uuid,jsonb)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.execute_post_response_confidence_batch_v1_core(uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.bind_reading_to_thread_v1(uuid,uuid,uuid,uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.unbind_reading_from_thread_v1(uuid,uuid,uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.record_thread_reading_appearance_v1(uuid,uuid,uuid,uuid,integer,bigint,bigint)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.persist_authorized_subject_groundings_v1(uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.get_session_historical_projection_v1(uuid,integer)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.persist_post_response_hypothesis_generation_v1(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.execute_post_response_confidence_batch_v1(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.sync_post_response_information_gaps_v1(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.server_create_memory_for_execution_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.build_hypothesis_subject_grounding_universe_v1(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.complete_post_response_grounded_candidates_v1(uuid,text,jsonb,jsonb)', 'EXECUTE') THEN
      RAISE EXCEPTION 'T-03C self-assertion: the service_role posture is wrong' USING ERRCODE='55000';
    END IF;
  END IF;
  -- R2: the A-1 appearance is derived by exactly the two triggers, and the
  -- grounding persistence has exactly one caller path (the persist wrapper).
  IF (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.hypothesis_subject_groundings'::regclass AND NOT t.tgisinternal
        AND t.tgfoid = 'public.derive_thread_reading_appearances_for_grounding_v1'::regproc AND t.tgenabled = 'O') <> 1
     OR (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.conversation_thread_focus_bindings'::regclass AND NOT t.tgisinternal
           AND t.tgfoid = 'public.derive_thread_reading_appearances_for_focus_binding_v1'::regproc AND t.tgenabled = 'O') <> 1 THEN
    RAISE EXCEPTION 'T-03C self-assertion: the Thread <-> Reading appearance is derived by exactly the two production triggers' USING ERRCODE='55000';
  END IF;
  IF position('persist_authorized_subject_groundings_v1' in pg_get_functiondef(to_regprocedure('public.persist_post_response_hypothesis_generation_v1(uuid)'))) = 0 THEN
    RAISE EXCEPTION 'T-03C self-assertion: the persist wrapper records the authorized subject groundings atomically with the Hypotheses' USING ERRCODE='55000';
  END IF;
  -- R-C3: every path into public.hypotheses passes the ONE capture hook.
  IF (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.hypotheses'::regclass AND NOT t.tgisinternal
        AND t.tgfoid = 'public.capture_historical_reading_change_v1'::regproc AND t.tgenabled = 'O') <> 1 THEN
    RAISE EXCEPTION 'T-03C self-assertion: the Reading capture hook is not the one enabled AFTER INSERT OR UPDATE trigger' USING ERRCODE='55000';
  END IF;
  -- R-C1: coverage gates historical projection, never committed-CU runtime.
  -- The ONE 0072 trigger on conversation_units is the AFTER INSERT baseline
  -- hook; no BEFORE INSERT coverage gate exists.
  IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.conversation_units'::regclass AND NOT t.tgisinternal
               AND t.tgfoid IN ('public.capture_session_historical_baseline_v1'::regproc) AND (t.tgtype & 2) = 2)
     OR (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.conversation_units'::regclass AND NOT t.tgisinternal
           AND t.tgfoid = 'public.capture_session_historical_baseline_v1'::regproc AND t.tgenabled = 'O') <> 1
     OR to_regprocedure('public.guard_session_historical_coverage_v1()') IS NOT NULL THEN
    RAISE EXCEPTION 'T-03C self-assertion: coverage must gate historical projection, never committed-CU runtime' USING ERRCODE='55000';
  END IF;
  -- The Session Semantic Clock is untouched.
  IF (SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'session_semantic_clocks') <> 'session_id,user_id,current_sp,same_sp_event_sequence' THEN
    RAISE EXCEPTION 'T-03C self-assertion: the Session Semantic Clock changed shape' USING ERRCODE='55000';
  END IF;
END$$;

COMMIT;
