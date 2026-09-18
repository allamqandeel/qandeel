-- I-07D - Post-Introduction Matching reactivation and the I-07 phase-closing
-- forward contracts v1 (PART C).
--
-- There is NO automatic Matching restart. CW2-06 freezes that a failed
-- Introduction preserves Matching setup but leaves the human paused, that a
-- successful Introduction also leaves them paused, that reactivation is
-- explicit and fully revalidated, and that a later Standard World end never
-- auto-reactivates anything.
--
-- Migration 0116 produced the two reserved post-terminal pauses and gave
-- neither a resume path on purpose: the frozen I-07A resume is USER_PAUSED-only
-- and stays that way. This migration adds the ONE dedicated, fully revalidated
-- boundary that may cross them, and nothing else may.
--
-- ===========================================================================
-- THE THREE REAL HUMAN STATES THE LIFECYCLE ACTUALLY PRODUCES
-- ===========================================================================
--
--   PAUSED / POST_INTRODUCTION   the Introduction ended; RESUME to ACTIVE
--   PAUSED / POST_SUCCESS        the Introduction completed; RESUME to ACTIVE
--   OFF over that exact lineage  the human turned Matching off during or after
--                                the Introduction; an explicit ACTIVATE, through
--                                one of the two already frozen entry channels
--
-- The third case exists because participation is independent after the Match:
-- a human may turn Matching OFF while an Introduction is live, and the terminal
-- transition then leaves them OFF rather than overwriting their own decision.
-- The frozen I-07A activation refuses exactly that OFF - it looks one hop back
-- along the immutable chain, sees a pause it may not lift, and answers
-- MATCHING_REACTIVATION_REQUIRES_REVALIDATION. This is the revalidation it was
-- waiting for, and it is the ONLY path that may cross it. The generic path is
-- not widened: the terminal self-assertion proves both frozen ceilings still
-- refuse, on the live catalog.
--
-- ===========================================================================
-- LINEAGE IS PROVEN FROM EXACT IMMUTABLE IDENTITY, NEVER FROM TIME
-- ===========================================================================
--
-- Eligibility is NOT "this human has some terminal Introduction somewhere" and
-- is NOT "the latest record wins". It is one exact chain of identities, every
-- link of which is immutable and was written by a reviewed core:
--
--   the human's CURRENT participation act
--     -> the exact act it supersedes
--        -> the exact I-07C ACTIVE_INTRODUCTION pause of one Match commit,
--           or the exact I-07D POST_* act of one terminal commit
--           -> that exact terminal commit
--              -> its exact Introduction Record, which is terminal
--              -> this human's exact claim from it, which is RELEASED
--
-- No timestamp is compared, no ordering is inferred and no set is searched for
-- a best candidate. If the chain does not resolve to exactly one terminal
-- commit naming this exact human, reactivation fails closed.
--
-- ===========================================================================
-- FULL CURRENT REVALIDATION, AND THE SEAM LAST
-- ===========================================================================
--
-- Under the caller's own canonical matching_setup_locks row, and through the
-- canonical I-07A / I-07B resolvers rather than a second copy of their logic:
--
--   1  the current participation state is one of the exact three above
--   2  a current ACTIVE Matching Context Grant exists
--   3  a current Introduction Profile version exists
--   4  a current Matching Requirements version exists
--   5  this human holds NO HELD active-Introduction claim
--   6  the canonical active-Introduction truth answers false
--   7  the exact prior Introduction Record is terminal and the exact prior
--      claim is RELEASED
--   8  the CW2-08 reactivation prerequisite is CLEARED - LAST
--
-- Every one of 2, 3 and 4 is a CURRENT truth read at reactivation time: a human
-- who revoked their Matching Context Grant during the Introduction does not get
-- it back by reactivating, and a human whose profile was never set cannot be
-- reactivated into candidate work they are not eligible for.
--
-- The Pre-Match Proposal Disclosure Authority is deliberately NOT required
-- here. It is the authority for a FUTURE pre-Match proposal disclosure and the
-- frozen I-07B candidate boundary already requires it at that moment; demanding
-- it to change a participation state would make one authority a precondition of
-- another, which is exactly the coupling I-07A separated structurally.
--
-- ===========================================================================
-- REACTIVATION CHANGES PARTICIPATION AND NOTHING ELSE
-- ===========================================================================
--
-- It moves no proposal out of a terminal state, clones none, restores no
-- recipient view pointer, revives no CANCELLED_BY_COMPETING_MATCH, STALE,
-- EXPIRED, WITHDRAWN or declined proposal, and creates none. Future proposal
-- generation begins from future fresh candidate work. The terminal
-- self-assertion refuses to deploy a body that touches a proposal relation at
-- all.
--
-- It also reopens nothing: no World, no membership episode, no Introduction
-- Record, no claim. A terminal Introduction stays terminal forever.
--
-- ===========================================================================
-- LOCK LAW
-- ===========================================================================
--
-- Reactivation is a ONE-HUMAN Matching act and takes exactly the locks a
-- one-human Matching act takes:
--
--   A. the caller's own matching_setup_locks row, through the same
--      upsert-and-lock statement every I-07A command uses
--   B. the caller's own matching_participation_state pointer, FOR UPDATE
--
-- It takes NO Shared World lock, because it mutates no Shared World; it takes
-- no second human's lock, because it decides nothing about anybody else. The
-- terminal cores take the setup locks BEFORE the participation pointers too, so
-- the two orders agree and a reactivation racing a terminal transition blocks
-- rather than deadlocks - and then observes the settled post-terminal state.
--
-- ===========================================================================
-- What this migration deliberately does NOT do
-- ===========================================================================
--
-- It creates no World, no membership, no proposal, no pair, no candidate work
-- and no Introduction; it mutates no grant, profile, requirement version or
-- disclosure authority; it reads no Personal context, no Public state and no
-- Matching private reasoning; it adds no route, controller, RPC, mobile
-- surface, Launch Gate, feature flag, entitlement or moderation policy. Every
-- historical migration, 0001-0116 included, is untouched and nothing is
-- replaced.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE REACTIVATION COMMAND.
--
--    One row per reactivation. It is the idempotency key AND the exact
--    committed answer, and it records the exact lineage the reactivation was
--    authorized by: the terminal commit it descends from, the act it
--    superseded and the act it produced.
--
--    That lineage is not decoration. It is what makes an audit able to ask
--    "why was this human allowed back into Matching" and get an exact chain of
--    immutable identities rather than a timestamp and an inference.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_introduction_reactivation_commands (
    id uuid NOT NULL,
    participant_user_id uuid NOT NULL,
    terminal_commit_id uuid NOT NULL,
    introduction_record_id uuid NOT NULL,
    released_claim_id uuid NOT NULL,
    prior_participation_event_id uuid NOT NULL,
    participation_event_id uuid NOT NULL,
    reactivation_act text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT matching_introduction_reactivation_commands_pk PRIMARY KEY (id),
    -- One produced act belongs to at most one reactivation, and one superseded
    -- act is crossed at most once: a lineage can never be reused.
    CONSTRAINT matching_introduction_reactivation_commands_event_key UNIQUE (participation_event_id),
    CONSTRAINT matching_introduction_reactivation_commands_prior_key
        UNIQUE (prior_participation_event_id),
    CONSTRAINT matching_introduction_reactivation_commands_act_check
        CHECK (reactivation_act IN ('RESUME', 'ACTIVATE')),
    -- The produced act is an act OF THIS EXACT HUMAN, and so is the act it
    -- superseded. Neither can name somebody else's participation.
    CONSTRAINT matching_introduction_reactivation_commands_event_fk
        FOREIGN KEY (participation_event_id, participant_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_introduction_reactivation_commands_prior_fk
        FOREIGN KEY (prior_participation_event_id, participant_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    -- The exact terminal commit this reactivation descends from.
    CONSTRAINT matching_introduction_reactivation_commands_terminal_fk
        FOREIGN KEY (terminal_commit_id, introduction_record_id)
        REFERENCES public.introduction_terminal_commits (id, introduction_record_id) ON DELETE RESTRICT,
    -- The exact released claim of THIS human from THAT exact Introduction.
    CONSTRAINT matching_introduction_reactivation_commands_claim_fk
        FOREIGN KEY (released_claim_id, introduction_record_id, participant_user_id)
        REFERENCES public.matching_active_introduction_claims
                   (id, introduction_record_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX matching_introduction_reactivation_commands_human_idx
    ON public.matching_introduction_reactivation_commands (participant_user_id, committed_at);

COMMENT ON TABLE public.matching_introduction_reactivation_commands IS
  'One explicit post-Introduction Matching reactivation, carrying the exact '
  'immutable lineage it was authorized by: the terminal Introduction commit it '
  'descends from, that Introduction''s released claim for this human, the exact '
  'participation act it superseded and the exact act it produced. Eligibility '
  'is proven from these identities, never from a timestamp or a latest-record '
  'inference, and a lineage can be crossed at most once.';

-- ---------------------------------------------------------------------------
-- 2. Deny-by-default posture and immutability.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_introduction_reactivation_commands OWNER TO postgres;
ALTER TABLE public.matching_introduction_reactivation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.matching_introduction_reactivation_commands FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.matching_introduction_reactivation_commands FROM service_role';
END IF;END$$;

CREATE FUNCTION public.reject_matching_reactivation_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'MATCHING_REACTIVATION_RECORD_IS_DURABLE'
    USING ERRCODE='55000',
          DETAIL='A post-Introduction reactivation is durable history: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_matching_reactivation_mutation_v1() OWNER TO postgres;

CREATE TRIGGER matching_introduction_reactivation_commands_immutable
    BEFORE UPDATE OR DELETE ON public.matching_introduction_reactivation_commands
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_reactivation_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE FAIL-CLOSED CW2-08 SEAM FOR REACTIVATION.
--
--    Re-entering Matching is a continuation capability and requires exactly
--    CLEARED as its LAST gate, after every participation, authority, claim and
--    lineage gate. Its only answer is NOT_EVALUATED.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_reactivation_prerequisites_v1(p_user_id uuid)
RETURNS TABLE(clearance text, basis text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN QUERY SELECT 'NOT_EVALUATED'::text,
    ('CW2-08 safety, moderation, entitlement, feature and Launch Gate evaluation has no canonical '
     || 'runtime in this repository, so post-Introduction Matching reactivation is not cleared.')::text;
END$$;

ALTER FUNCTION public.resolve_matching_reactivation_prerequisites_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_matching_reactivation_prerequisites_v1(uuid) IS
  'The CW2-08 prerequisite seam for explicit post-Introduction Matching '
  'reactivation. Its only answer is NOT_EVALUATED, and the reactivation '
  'boundary requires exactly CLEARED from it as its LAST gate, after every '
  'participation, authority, claim and lineage gate.';

-- ---------------------------------------------------------------------------
-- 4. THE ONE DEDICATED POST-INTRODUCTION REACTIVATION BOUNDARY.
--
--    The human is `auth.uid()`, derived and never supplied: there is no user
--    id parameter, so no caller can reactivate somebody else.
--
--    `p_entry_channel` is activation PROVENANCE, not authority, and it is
--    required exactly when the derived path is an ACTIVATE - which the human's
--    own current state decides, not the caller's intent. Supplying one on the
--    RESUME path, or omitting one on the ACTIVATE path, is a bounded invalid
--    command rather than a silently reinterpreted one.
--
--    It changes participation and nothing else.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reactivate_matching_after_introduction_v1(
  p_command_id uuid, p_participation_event_id uuid, p_expected_current_event_id uuid,
  p_entry_channel text DEFAULT NULL
) RETURNS TABLE(outcome text, reactivation_command_id uuid, participation_event_id uuid,
                participation_act text, participation_state text, superseded_event_id uuid,
                reactivated_from_record_id uuid, reactivated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.matching_introduction_reactivation_commands;
  locked uuid;
  setup record;
  gate record;
  current_id uuid;
  current_act public.matching_participation_events;
  anchor uuid;
  terminal public.introduction_terminal_commits;
  claim_id uuid;
  record_status text;
  act text;
  channel text;
  reactivate_at timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_participation_event_id IS NULL OR p_expected_current_event_id IS NULL
     OR p_command_id = p_participation_event_id THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, over immutable columns
  -- only, so an equivalent retry is answered from history even after the human
  -- has paused or turned Matching off again.
  SELECT * INTO committed FROM public.matching_introduction_reactivation_commands c
   WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u
       AND committed.participation_event_id = p_participation_event_id
       AND committed.prior_participation_event_id = p_expected_current_event_id THEN
      RETURN QUERY SELECT 'MATCHING_REACTIVATED'::text, committed.id, committed.participation_event_id,
                          committed.reactivation_act, 'ACTIVE'::text,
                          committed.prior_participation_event_id, committed.introduction_record_id,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_REACTIVATION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP A: the caller's own Matching serialization row,
  -- through the same upsert-and-lock statement every I-07A command uses. This
  -- is a ONE-HUMAN act and takes no Shared World lock and no second human's.
  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_introduction_reactivation_commands c
   WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u
       AND committed.participation_event_id = p_participation_event_id
       AND committed.prior_participation_event_id = p_expected_current_event_id THEN
      RETURN QUERY SELECT 'MATCHING_REACTIVATED'::text, committed.id, committed.participation_event_id,
                          committed.reactivation_act, 'ACTIVE'::text,
                          committed.prior_participation_event_id, committed.introduction_record_id,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_REACTIVATION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP B: the caller's own current participation
  -- pointer, with the exact stale token they acted on.
  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_STALE_STATE' USING ERRCODE='40001';
  END IF;
  SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 1. THE CURRENT STATE IS ONE OF THE EXACT THREE THE LIFECYCLE PRODUCES,
  -- and the ANCHOR is the exact act whose lineage must be proven.
  IF current_act.resulting_state = 'PAUSED'
     AND current_act.resulting_pause_reason IN ('POST_INTRODUCTION', 'POST_SUCCESS') THEN
    act := 'RESUME';
    anchor := current_act.id;
  ELSIF current_act.resulting_state = 'OFF' AND current_act.prior_event_id IS NOT NULL THEN
    act := 'ACTIVATE';
    anchor := current_act.prior_event_id;
  ELSE
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This boundary reactivates exactly a post-Introduction pause or an explicit OFF that descends from one. Every other participation state uses its own frozen I-07A command.';
  END IF;
  -- The entry channel is provenance of an ACTIVATION and of nothing else: a
  -- resume is not a fresh entry and carries none.
  IF act = 'ACTIVATE' THEN
    IF p_entry_channel IS NULL OR p_entry_channel NOT IN ('CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY') THEN
      RAISE EXCEPTION 'MATCHING_REACTIVATION_ENTRY_CHANNEL_INVALID' USING ERRCODE='22023';
    END IF;
    channel := p_entry_channel;
  ELSE
    IF p_entry_channel IS NOT NULL THEN
      RAISE EXCEPTION 'MATCHING_REACTIVATION_ENTRY_CHANNEL_INVALID' USING ERRCODE='22023';
    END IF;
    channel := NULL;
  END IF;

  -- GATE 7a. THE EXACT IMMUTABLE LINEAGE. Either the anchor IS the POST_* act a
  -- terminal commit wrote for this exact human, or it is the exact
  -- ACTIVE_INTRODUCTION pause of a Match whose Introduction later reached a
  -- terminal outcome. No timestamp is compared and no set is searched for a
  -- best candidate.
  SELECT * INTO terminal FROM public.introduction_terminal_commits t
   WHERE (t.lower_user_id = u AND t.lower_participation_event_id = anchor)
      OR (t.higher_user_id = u AND t.higher_participation_event_id = anchor);
  IF NOT FOUND THEN
    SELECT t.* INTO terminal
      FROM public.matching_match_commits m
      JOIN public.introduction_terminal_commits t ON t.match_commit_id = m.id
     WHERE (m.first_recipient_user_id = u AND m.first_recipient_pause_event_id = anchor)
        OR (m.candidate_user_id = u AND m.candidate_pause_event_id = anchor);
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This participation state does not descend from an exact terminal Introduction of this human. Reactivation is never inferred from time or from a latest record.';
  END IF;

  -- GATE 7b. THE PRIOR INTRODUCTION RECORD IS TERMINAL, read live rather than
  -- assumed from the commit that wrote it.
  SELECT r.introduction_status INTO record_status
    FROM public.introduction_records r WHERE r.id = terminal.introduction_record_id;
  IF record_status IS NULL OR record_status NOT IN ('COMPLETED', 'CLOSED') THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 7c. THIS HUMAN'S EXACT CLAIM FROM THAT EXACT INTRODUCTION IS RELEASED.
  claim_id := CASE WHEN u = terminal.lower_user_id THEN terminal.lower_claim_id
                   ELSE terminal.higher_claim_id END;
  IF NOT EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
                  WHERE c.id = claim_id AND c.user_id = u
                    AND c.introduction_record_id = terminal.introduction_record_id
                    AND c.claim_state = 'RELEASED') THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 5. NO HELD ACTIVE-INTRODUCTION CLAIM AT ALL, for this human, from any
  -- Introduction. A human occupied by a live Introduction never re-enters
  -- candidate work.
  IF EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
              WHERE c.user_id = u AND c.claim_state = 'HELD') THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This human still holds an active-Introduction claim.';
  END IF;

  -- GATE 6. THE CANONICAL ACTIVE-INTRODUCTION TRUTH, consumed rather than
  -- re-implemented: an open membership episode in an ACTIVE / INTRODUCTION
  -- Shared World.
  IF (SELECT a.has_active_introduction FROM public.resolve_matching_active_introduction_v1(u) a) THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This human currently holds an active Introduction.';
  END IF;

  -- GATES 2, 3 and 4. THE CURRENT MATCHING SETUP, through the ONE canonical
  -- I-07B entry point into the sealed I-07A state rather than a second copy of
  -- its logic. A grant revoked during the Introduction is NOT restored by
  -- reactivating, and a missing profile or requirement version fails closed.
  SELECT * INTO setup FROM public.resolve_matching_setup_state_v1(u);
  IF setup.matching_context_grant_id IS NULL
     OR setup.introduction_profile_version_id IS NULL
     OR setup.matching_requirement_version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='Reactivation requires a current Matching Context Grant, a current Introduction Profile and a current Matching Requirements version. Matching setup is preserved across an Introduction; it is not restored by one.';
  END IF;
  -- The canonical resolver and this transaction must agree about the exact act
  -- being superseded. They read the same pointer under the same lock, so a
  -- disagreement is an impossible state rather than a refusal.
  IF setup.participation_event_id IS DISTINCT FROM current_id THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 8. THE CW2-08 PREREQUISITE, LAST - after every participation,
  -- authority, claim and lineage gate above.
  SELECT * INTO gate FROM public.resolve_matching_reactivation_prerequisites_v1(u);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='Post-Introduction Matching reactivation requires the CW2-08 system/safety prerequisite to be CLEARED. It is not, and reactivation fails closed.';
  END IF;

  reactivate_at := clock_timestamp();

  BEGIN
    -- THE ONE EFFECT: one participation act and the pointer that names it.
    INSERT INTO public.matching_participation_events
      (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
       activation_entry_channel, prior_event_id, occurred_at)
    VALUES (p_participation_event_id, u, act, 'ACTIVE', NULL, channel, current_id, reactivate_at);

    UPDATE public.matching_participation_state s
       SET current_event_id = p_participation_event_id, updated_at = reactivate_at
     WHERE s.participant_user_id = u AND s.current_event_id = current_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_REACTIVATION_STALE_STATE' USING ERRCODE='40001';
    END IF;

    INSERT INTO public.matching_introduction_reactivation_commands
      (id, participant_user_id, terminal_commit_id, introduction_record_id, released_claim_id,
       prior_participation_event_id, participation_event_id, reactivation_act, committed_at)
    VALUES (p_command_id, u, terminal.id, terminal.introduction_record_id, claim_id,
            current_id, p_participation_event_id, act, reactivate_at);
  EXCEPTION WHEN unique_violation THEN
    -- A supplied persistence identity was already taken, or this exact lineage
    -- was already crossed. The whole reactivation rolls back together.
    RAISE EXCEPTION 'MATCHING_REACTIVATION_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATCHING_REACTIVATED'::text, p_command_id, p_participation_event_id,
                      act, 'ACTIVE'::text, current_id, terminal.introduction_record_id, reactivate_at;
END$$;

-- ---------------------------------------------------------------------------
-- 5. Ownership and THE PRE-LAUNCH ACL. The reactivation boundary is executable
--    by NO application role. This migration GRANTS NOTHING to anybody.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.reactivate_matching_after_introduction_v1(uuid, uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reactivate_matching_after_introduction_v1(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_matching_reactivation_prerequisites_v1(uuid)
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reactivate_matching_after_introduction_v1(uuid, uuid, uuid, text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.resolve_matching_reactivation_prerequisites_v1(uuid) FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 6. Terminal self-assertions, and THE I-07 PHASE-CLOSING FORWARD CONTRACTS.
--
--    The first half is this migration's own posture. The second half is the
--    whole I-07D forward seam, asserted ONCE on the live catalog at the tip of
--    the chain: every reserved state that previously had no producer now has
--    exactly the reviewed one, every frozen predecessor ceiling still refuses,
--    and the I-07C Match/birth semantics are untouched.
--
--    It is deliberately at the TIP rather than spread across three migrations:
--    a census of "exactly these producers exist" is only true once every
--    producer has been deployed, and asserting it earlier would make it
--    vacuous.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  reactivate_fn text := 'public.reactivate_matching_after_introduction_v1(uuid,uuid,uuid,text)';
  gate_fn text := 'public.resolve_matching_reactivation_prerequisites_v1(uuid)';
  resume_fn text := 'public.resume_matching_participation_v1(uuid,uuid)';
  activate_fn text := 'public.activate_matching_participation_v1(uuid,text,uuid)';
  own_table text := 'public.matching_introduction_reactivation_commands';
  p record;
  in_names text[];
  arg_name text;
  target_role text;
  target_privilege text;
  rls_enabled boolean;
  body text;
  lock_pos integer;
  pointer_pos integer;
  lineage_pos integer;
  gate_pos integer;
  write_pos integer;
BEGIN
  -- ===================================================================
  -- THE NEW RELATION: unreachable, policy-free, within the identifier limit.
  -- ===================================================================
  SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = own_table::regclass;
  IF NOT rls_enabled THEN RAISE EXCEPTION 'I-07D: row level security must be enabled on %', own_table; END IF;
  IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = own_table::regclass) THEN
    RAISE EXCEPTION 'I-07D: no RLS policy may exist on %', own_table;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
              WHERE c.oid = own_table::regclass AND privilege.grantee = 0) THEN
    RAISE EXCEPTION 'I-07D: PUBLIC must hold no privilege on %', own_table;
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
        IF has_table_privilege(target_role, own_table, target_privilege) THEN
          RAISE EXCEPTION 'I-07D: the reactivation record stays sealed: % holds % on %',
            target_role, target_privilege, own_table;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_constraint con
              WHERE con.conrelid = own_table::regclass AND length(con.conname) > 63) THEN
    RAISE EXCEPTION 'I-07D: a constraint name on % exceeds the PostgreSQL 63-byte identifier limit', own_table;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
              WHERE ix.indrelid = own_table::regclass AND length(idx.relname) > 63) THEN
    RAISE EXCEPTION 'I-07D: an index name on % exceeds the PostgreSQL 63-byte identifier limit', own_table;
  END IF;

  -- ===================================================================
  -- THE REACTIVATION BOUNDARY.
  -- ===================================================================
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
         pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = reactivate_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07D: % must be owned by postgres', reactivate_fn; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07D: % must be SECURITY DEFINER', reactivate_fn; END IF;
  IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-07D: % mutates and must be VOLATILE', reactivate_fn; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-07D: % must pin an empty search_path', reactivate_fn;
  END IF;
  IF has_function_privilege('public', reactivate_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07D: PUBLIC must not execute the reactivation boundary before the launch gate exists';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, reactivate_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: % must not execute the reactivation boundary before the launch gate exists', target_role;
    END IF;
  END LOOP;
  body := p.prosrc;
  IF body !~ 'u uuid := auth\.uid\(\);' THEN
    RAISE EXCEPTION 'I-07D: the reactivating human must be derived from the session subject, never supplied';
  END IF;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_participation_event_id','p_expected_current_event_id','p_entry_channel'] THEN
    RAISE EXCEPTION 'I-07D: the reactivation boundary must accept exactly the frozen v1 surface, not %', in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'user_id|actor|human|subject|on_behalf|owner|counterpart|reason|state|record|claim|grant|profile|requirement|timestamp|instant|_at$|clock|launch|gate' THEN
      RAISE EXCEPTION 'I-07D: the reactivation boundary must not accept %: the human is auth.uid() and every truth is derived', arg_name;
    END IF;
  END LOOP;
  IF body ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
    RAISE EXCEPTION 'I-07D: % must persist one database-owned instant, never a transaction clock', reactivate_fn;
  END IF;
  IF (length(body) - length(replace(body, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
    RAISE EXCEPTION 'I-07D: % must read the canonical instant exactly once', reactivate_fn;
  END IF;
  IF body ~ 'pg_advisory|LOCK TABLE|TRUNCATE|DELETE FROM' THEN
    RAISE EXCEPTION 'I-07D: % takes only canonical row locks and deletes nothing', reactivate_fn;
  END IF;
  -- IT IS A ONE-HUMAN ACT: no Shared World lock and no second human's lock.
  IF body ~ 'shared_worlds|lock_matching_pair_humans_v1' THEN
    RAISE EXCEPTION 'I-07D: reactivation is a one-human Matching act: it locks no Shared World and no second human';
  END IF;
  -- LINEAGE IS EXACT IDENTITY, NEVER TIME OR A LATEST-RECORD INFERENCE.
  IF body ~ 'ORDER BY|MAX\(|max\(|LIMIT|occurred_at >|occurred_at <|committed_at >|committed_at <' THEN
    RAISE EXCEPTION 'I-07D: reactivation eligibility must be proven from exact immutable identity, never by ordering, time comparison or a latest-record inference';
  END IF;
  IF body !~ 'introduction_terminal_commits' OR body !~ 'matching_match_commits' THEN
    RAISE EXCEPTION 'I-07D: reactivation must prove the exact I-07C Match/pause and I-07D terminal linkage';
  END IF;
  IF body !~ 'c\.claim_state = ''RELEASED''' THEN
    RAISE EXCEPTION 'I-07D: reactivation must prove the exact prior claim is RELEASED';
  END IF;
  IF body !~ 'c\.claim_state = ''HELD''' THEN
    RAISE EXCEPTION 'I-07D: reactivation must refuse a human who still holds an active-Introduction claim';
  END IF;
  -- THE CANONICAL TRUTHS ARE CONSUMED, NEVER RE-IMPLEMENTED.
  IF body !~ 'resolve_matching_active_introduction_v1' OR body !~ 'resolve_matching_setup_state_v1' THEN
    RAISE EXCEPTION 'I-07D: reactivation must consume the canonical I-07A/I-07B truth resolvers rather than copy their logic';
  END IF;
  IF body ~ 'matching_context_consent_events|introduction_profile_field_values|matching_requirement_items|pre_match_disclosure_authority_fields' THEN
    RAISE EXCEPTION 'I-07D: reactivation must not re-implement the canonical setup truth from its underlying relations';
  END IF;
  -- IT REVIVES NO PROPOSAL AND REOPENS NOTHING.
  IF body ~ 'matching_proposal|matching_recipient_proposal|matching_eligibility_snapshots|matching_pairs|matching_safe_conclusion|matching_private_reasoning' THEN
    RAISE EXCEPTION 'I-07D: reactivation changes participation only: it revives, clones and creates no proposal, pair, candidate or view';
  END IF;
  IF body ~ 'UPDATE public\.introduction_records|UPDATE public\.matching_active_introduction_claims|UPDATE public\.shared_worlds|INSERT INTO public\.shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-07D: reactivation reopens no Introduction, no claim, no World and no membership';
  END IF;
  -- THE PUBLISHED ORDER: the setup lock, the pointer, the lineage, the gate, the write.
  lock_pos := strpos(body, 'INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)');
  pointer_pos := strpos(body, 'WHERE s.participant_user_id = u FOR UPDATE');
  lineage_pos := strpos(body, 'FROM public.introduction_terminal_commits t');
  gate_pos := strpos(body, 'resolve_matching_reactivation_prerequisites_v1');
  write_pos := strpos(body, 'INSERT INTO public.matching_participation_events');
  IF lock_pos = 0 OR pointer_pos = 0 OR lineage_pos = 0 OR gate_pos = 0 OR write_pos = 0
     OR lock_pos > pointer_pos OR pointer_pos > lineage_pos OR lineage_pos > gate_pos OR gate_pos > write_pos THEN
    RAISE EXCEPTION 'I-07D: the reactivation order is the setup lock, then the pointer, then the exact lineage, then the gate LAST, then the write';
  END IF;
  -- THE ONLY PARTICIPATION RESULT IS ACTIVE, and the entry channel is
  -- provenance of an activation and of nothing else.
  IF body !~ '''ACTIVE'', NULL, channel, current_id' THEN
    RAISE EXCEPTION 'I-07D: reactivation produces exactly one ACTIVE participation act carrying no pause reason';
  END IF;
  IF body ~ '''USER_PAUSED''|''SYSTEM_POLICY''|''PAUSE''|''TURN_OFF''' THEN
    RAISE EXCEPTION 'I-07D: reactivation may spell no participation act or reason outside RESUME and ACTIVATE';
  END IF;

  -- THE FAIL-CLOSED SEAM.
  SELECT pr.prosrc, pr.provolatile INTO p FROM pg_proc pr WHERE pr.oid = gate_fn::regprocedure;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-07D: the reactivation prerequisite seam must be STABLE'; END IF;
  IF p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'I-07D: the reactivation prerequisite seam must never answer CLEARED before CW2-08 exists';
  END IF;
  IF p.prosrc !~ '''NOT_EVALUATED''' THEN
    RAISE EXCEPTION 'I-07D: the reactivation prerequisite seam must answer NOT_EVALUATED';
  END IF;

  -- ===================================================================
  -- THE I-07 PHASE-CLOSING FORWARD CONTRACTS, on the live catalog.
  -- ===================================================================

  -- 0108 / 0109: THE TWO FROZEN I-07A CEILINGS STILL REFUSE. The generic resume
  -- is still USER_PAUSED-only and the generic activation still refuses an OFF
  -- that descends from a pause it may not lift. I-07D did not widen either; it
  -- added ONE dedicated path beside them.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = resume_fn::regprocedure;
  IF p.prosrc !~ 'current_act\.resulting_pause_reason <> ''USER_PAUSED''' THEN
    RAISE EXCEPTION 'I-07D: the generic I-07A resume must remain USER_PAUSED-only';
  END IF;
  -- The QUOTED literals, because that is what a code path is. `prosrc` carries
  -- comments, and 0109's resume EXPLAINS the four reserved reasons by name in
  -- its own ceiling comment - so a bare-word ban would fire on the very prose
  -- that documents the rule it is checking.
  IF p.prosrc ~ '''POST_SUCCESS''|''POST_INTRODUCTION''|introduction_terminal_commits' THEN
    RAISE EXCEPTION 'I-07D: the generic I-07A resume must not learn any reserved pause reason or terminal linkage';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = activate_fn::regprocedure;
  IF p.prosrc !~ 'MATCHING_REACTIVATION_REQUIRES_REVALIDATION' THEN
    RAISE EXCEPTION 'I-07D: the generic I-07A activation must still refuse an OFF that descends from a pause it may not lift';
  END IF;
  IF p.prosrc ~ 'introduction_terminal_commits|POST_SUCCESS|POST_INTRODUCTION' THEN
    RAISE EXCEPTION 'I-07D: the generic I-07A activation must not learn the post-Introduction lineage';
  END IF;

  -- 0108: EXACTLY ONE PRODUCER CROSSES A RESERVED POST-INTRODUCTION PAUSE.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'INSERT INTO public\.matching_introduction_reactivation_commands') <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly the one reviewed reactivation boundary may cross a post-Introduction pause';
  END IF;

  -- 0113 / 0114: THE I-07C MATCH AND BIRTH SEMANTICS REMAIN FROZEN.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND (pr.prosrc ~ 'INSERT INTO public\.matching_match_commits'
           OR pr.prosrc ~ 'INSERT INTO public\.introduction_records'
           OR pr.prosrc ~ 'INSERT INTO public\.matching_active_introduction_claims'
           OR pr.prosrc ~ 'INSERT INTO public\.shared_world_matching_birth_events'
           OR pr.prosrc ~ 'INSERT INTO public\.shared_world_introduction_started_events')) <> 1 THEN
    RAISE EXCEPTION 'I-07D: the frozen I-07C Match commit remains the ONLY producer of a Match, a Record birth, a claim and the two birth facts';
  END IF;

  -- 0113: EXACTLY THE TWO REVIEWED TERMINAL CORES REACH A TERMINAL OUTCOME AND
  -- RELEASE A CLAIM.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'UPDATE public\.introduction_records') <> 2
     OR (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
            AND pr.prosrc ~ 'UPDATE public\.matching_active_introduction_claims') <> 2
     OR (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
            AND pr.prosrc ~ 'INSERT INTO public\.introduction_terminal_commits') <> 2 THEN
    RAISE EXCEPTION 'I-07D: exactly the two reviewed terminal cores may reach a terminal outcome, release a claim and write a terminal commit';
  END IF;

  -- 0089: EXACTLY ONE PRODUCER WRITES THE RESERVED EXPLICIT_DISCLOSURE MATERIAL.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ '''EXPLICIT_DISCLOSURE'''
         AND pr.prosrc ~ 'INSERT INTO public\.shared_world_materials') <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly one reviewed producer may write an EXPLICIT_DISCLOSURE material';
  END IF;

  -- 0087 / 0088: THERE IS STILL EXACTLY ONE HISTORICAL VISIBILITY ENTRY POINT,
  -- and the closed reader is still reachable by nobody.
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role',
           'public.resolve_shared_world_history_visibility_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07D: service_role must still execute the ONE historical visibility entry point';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role,
             'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: % must not execute the internal closed reader: there is ONE entry point', target_role;
    END IF;
  END LOOP;

  -- 0090: OWNER DELETION IS STILL THE ONLY THING THAT DESTROYS SOURCE CONTENT,
  -- and it still destroys only bodies and disclosure payloads.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND (pr.prosrc ~ 'DELETE FROM public\.shared_world_text_material_bodies'
           OR pr.prosrc ~ 'DELETE FROM public\.shared_world_voice_note_material_bodies'
           OR pr.prosrc ~ 'DELETE FROM public\.introduction_disclosure_text_payloads'
           OR pr.prosrc ~ 'DELETE FROM public\.introduction_disclosure_media_payloads')) <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly the one canonical owner-deletion primitive may destroy a material body or a disclosure payload';
  END IF;

  -- THE THREE FAIL-CLOSED SEAMS I-07D OWNS ALL ANSWER NOT_EVALUATED, and END
  -- consults none of them. Production stays fail-closed on every gated path.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public'
         AND pr.proname IN ('resolve_introduction_disclosure_prerequisites_v1',
                            'resolve_introduction_success_prerequisites_v1',
                            'resolve_matching_reactivation_prerequisites_v1')
         AND pr.prosrc ~ '''NOT_EVALUATED''' AND pr.prosrc !~ '''CLEARED''') <> 3 THEN
    RAISE EXCEPTION 'I-07D: all three I-07D prerequisite seams must answer NOT_EVALUATED and never CLEARED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'public' AND pr.proname = 'commit_introduction_end_v1'
                AND pr.prosrc ~ 'prerequisites_v1') THEN
    RAISE EXCEPTION 'I-07D: ending an Introduction must consult no prerequisite seam at all';
  END IF;

  -- NO APPLICATION ROLE HOLDS EXECUTE ON ANY I-07D CONSEQUENTIAL BOUNDARY.
  IF EXISTS (
    SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace,
         LATERAL unnest(ARRAY['anon','authenticated','service_role']) AS r(rolename)
     WHERE n.nspname = 'public'
       AND pr.proname IN ('commit_introduction_progressive_disclosure_v1',
                          'prepare_introduction_success_transition_v1',
                          'record_introduction_success_approval_core_v1',
                          'approve_introduction_success_v1',
                          'withdraw_introduction_success_approval_v1',
                          'commit_introduction_success_v1',
                          'commit_introduction_end_v1',
                          'reactivate_matching_after_introduction_v1')
       AND EXISTS (SELECT 1 FROM pg_roles ro WHERE ro.rolname = r.rolename)
       AND has_function_privilege(r.rolename, pr.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'I-07D: no application role may execute any I-07D consequential boundary before the CW2-08 Launch Gate exists';
  END IF;
END$$;

COMMIT;
