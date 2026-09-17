-- I-07B - Private candidate evaluation, Safe Compatibility Conclusion, the
-- Sensitive Conclusion Filter and the Matching Proposal Disclosure Gate v1.
--
-- Migration 0110 created the pair / eligibility / proposal / recipient-view
-- persistence and deliberately left it with no boundary at all. This forward-only
-- migration creates the PRIVATE side of the runtime: the narrow internal
-- resolvers over the sealed I-07A setup state, candidate discovery, hard
-- dealbreaker evaluation, eligibility capture, and the one-way disclosure
-- boundary that turns private Matching reasoning into an authorized recipient
-- view. Migration 0112 adds the proposal choreography that consumes it.
--
-- ## NOTHING HERE IS EXECUTABLE BY AN APPLICATION ROLE (task section 23)
--
-- Every boundary in 0111 and 0112 is postgres-owned, SECURITY DEFINER, with an
-- empty pinned search_path and EXECUTE revoked from PUBLIC, anon, authenticated
-- AND service_role. No role holds EXECUTE on any of them.
--
-- That is deliberate and it is the repository's established pre-launch pattern
-- rather than an omission. Delivering a proposal is a consequential disclosure
-- about two humans, and the CW2-08 Safety / moderation / entitlement / Launch
-- Gate runtime that must clear it does not exist in this repository - its seam
-- below answers NOT_EVALUATED on every dimension, exactly as I-05B's and I-06's
-- do. Granting a production application role a path to a consequential Matching
-- disclosure now would be a path around a gate that has not been built. The
-- internals are real, durable and fully proven against real PostgreSQL; what is
-- withheld is production reachability, and I-09 grants it by wrapping these
-- cores rather than by reopening them.
--
-- The same rule answers the candidate-discovery question. CW2-06 permits a
-- narrow read-only service resolver over the sealed setup state; it does not
-- require one, and a `service_role`-executable resolver that ENUMERATES
-- currently matchable humans is precisely the oracle the anti-oracle law
-- forbids. Discovery is therefore internal too. `service_role` gains nothing at
-- all from this slice.
--
-- ## The narrow private resolvers (task section 22)
--
-- `resolve_matching_setup_state_v1` is the ONE entry point into the sealed I-07A
-- state for Matching work. It reads participation, the Matching Context Grant,
-- the Introduction Profile version, the requirement version and the Pre-Match
-- Disclosure Authority of ONE human and answers with identities and bounded
-- states. It cannot modify anything, and it cannot manufacture, widen or
-- withdraw a human's consent: it holds no INSERT, UPDATE or DELETE of any kind.
-- It is fail-closed - absence of a participation pointer is OFF, and a human is
-- `matchable` only when participation is ACTIVE and all four current identities
-- exist.
--
-- `resolve_matching_active_introduction_v1` answers "does this human hold an
-- active Introduction right now" from the CANONICAL SHARED WORLD SUBSTRATE that
-- migration 0075 already owns - an open membership episode in an ACTIVE World
-- whose phase is INTRODUCTION. I-07B does not implement `ACTIVE_INTRODUCTION_SLOT`
-- and does not pre-create I-07C's slot in order to have something to read.
--
-- ## Two fail-closed seams, and why each is honest
--
--   * `resolve_matching_proposal_prerequisites_v1` answers NOT_EVALUATED for the
--     CW2-08 Launch Gate, safety, moderation and entitlement dimensions, because
--     no executable canonical runtime for any of them exists here. Every
--     consequential delivery and decision in 0112 requires exactly CLEARED from
--     it as its LAST gate, after every privacy and authority gate.
--
--   * `resolve_matching_canonical_first_name_v1` answers
--     UNRESOLVED_NO_CANONICAL_SOURCE. A proposal may disclose the candidate's
--     FIRST NAME from an allowed canonical source, and this repository has no
--     canonical product account name store: `public.users` carries an id, an auth
--     subject and two timestamps. The Public World display label is a PUBLIC
--     identity of a different capability and reading it here would move a Public
--     fact into private Matching, so it is not read. Inventing a name store would
--     be deferred Product work. The seam therefore fails the disclosure gate
--     closed and is replaceable without reopening anything.
--
-- ## The one-way boundary (task sections 13, 14, 15)
--
--     private Matching reasoning
--          v  record_matching_private_reasoning_core_v1
--     safe conclusion CANDIDATE                     (untrusted, whatever wrote it)
--          v  apply_matching_sensitive_conclusion_filter_core_v1
--     PERMITTED safe conclusion  or  private REFUSAL
--          v  materialize_matching_recipient_view_core_v1
--     authorized recipient proposal view
--
-- The filter is deterministic and fail-closed. It refuses a contact route, a
-- verbatim private quote, hidden provenance, visible ranking language and an
-- unauthorized sensitive fact, and it records an UNCLASSIFIED result as a
-- REFUSAL rather than as a pass. "Filter unavailable" is not a path: an
-- unconfigured filter policy raises, and nothing is permitted.
--
-- The five classifiers are IMMUTABLE pure functions, and each one is the
-- runtime half of a CHECK constraint 0110 already carries. They are deliberately
-- two implementations of one rule: the CHECK is the structural floor that binds
-- even the table owner, and the classifier is what lets a boundary refuse with a
-- bounded, answerable error instead of a constraint violation. The verifier
-- proves they agree over one corpus, so they cannot drift apart silently.
--
-- The sensitive-fact marker set is a deterministic v1 FLOOR, not a Product
-- safety policy. It is recorded against a versioned filter policy identity
-- precisely so a later reviewed slice can extend it - with model assistance if
-- CW2-08 wants one - without any of this being rewritten. Model assistance can
-- only ever ADD refusals: a conclusion is not recipient-safe because something
-- called it safe, and there is no column anywhere in which anything can say so.
--
-- ## The disclosure gate (task section 15)
--
-- `materialize_matching_recipient_view_core_v1` is the ONE way a recipient view
-- comes into existence. It revalidates that the subject's CURRENT profile
-- version and CURRENT disclosure authority are still exactly the ones the
-- eligibility snapshot bound, requires the current Product proposal-safety
-- policy, requires the canonical first name to resolve, and discloses only the
-- INTERSECTION of the fields the subject approved and the fields Product permits.
--
-- It does not copy approved profile text into a view. Every value is put through
-- the proposal-output filter first, and a field whose value carries a contact
-- route or a source identifier is refused BY NAME - so a benign key cannot
-- smuggle a phone number, an email address, a URL or a social handle past a
-- ceiling that only ever inspected keys.
--
-- The first-recipient view and the candidate view are INDEPENDENT disclosures.
-- Each is materialized by its own call, over its own subject, its own authority,
-- its own profile version and its own recipient-specific conclusion. There is no
-- copy path and no name swap: the gate cannot even be asked to reuse a view.
--
-- Migrations 0001-0110 are untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. PURE CLASSIFIERS.
--
--    IMMUTABLE, side-effect free, and the runtime half of the 0110 CHECKs. They
--    take no identity, read no relation and decide nothing about a human.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.matching_text_carries_contact_route_v1(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND (p_text ~* ('(^|[^a-z0-9])@[a-z0-9._]{2,}')
       OR p_text ~* ('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}')
       OR p_text ~* ('(https?://|www\.)')
       OR p_text ~* ('[a-z0-9-]+\.(com|net|org|io|me|co|uk|eg|app|link|xyz|info|biz'
                  || '|tv|gg|fm|site|online|shop|blog|dev|page)([^a-z]|$)')
       OR p_text ~ ('[0-9](?:[0-9 ()._+-]*[0-9]){6,}')
       OR p_text ~* ('(^|[^a-z])(whats ?app|telegram|instagram|snapchat|tik ?tok|facebook'
                  || '|twitter|linked ?in|messenger|viber|signal|discord|skype|wechat'
                  || '|botim|imo)([^a-z]|$)'));
$$;

COMMENT ON FUNCTION public.matching_text_carries_contact_route_v1(text) IS
  'True when bounded text carries a direct contact route - a social handle, an '
  'email address, a URL, a bare domain, a long digit run or a messaging platform '
  'name. Deliberately fail-closed: it refuses some innocent sentences, because '
  'refusing to disclose a sentence is recoverable and disclosing a phone number '
  'before a Mutual Match is not.';

CREATE FUNCTION public.matching_text_carries_hidden_provenance_v1(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND p_text ~* ('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
$$;

COMMENT ON FUNCTION public.matching_text_carries_hidden_provenance_v1(text) IS
  'True when bounded text carries a source, evidence or memory identifier. Every '
  'identifier in this runtime is a UUID, so a recipient-facing string that '
  'contains one is carrying provenance it must never carry.';

CREATE FUNCTION public.matching_text_carries_visible_ranking_v1(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND p_text ~* ('(^|[^a-z])([0-9]{1,3} ?%|per ?cent|score[ds]?|scoring|rank(ed|ing|s)?'
                 || '|rating|percentile|match rate|top [0-9]|[0-9]{1,3} out of [0-9]{1,3}'
                 || '|compatibility (score|rating|percentage|index))([^a-z]|$)');
$$;

COMMENT ON FUNCTION public.matching_text_carries_visible_ranking_v1(text) IS
  'True when bounded text expresses a compatibility percentage, score, rank, '
  'rating or leaderboard position. Matching v1 has no ranking Product, and a '
  'conclusion that talks like one is refused even though no column stores one.';

CREATE FUNCTION public.matching_text_carries_sensitive_fact_v1(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND p_text ~* ('(^|[^a-z])(hiv|aids|cancer|diabet[a-z]*|epilep[a-z]*|schizophren[a-z]*'
                 || '|bipolar|psychiatric|psychosis|depress(ion|ive)|panic attacks?|self ?harm'
                 || '|suicid[a-z]*|therapy|therapist|medicat(ion|ed)|diagnos(is|ed|es)'
                 || '|infertil[a-z]*|fertility treatment|miscarriage|abortion|pregnan[a-z]*'
                 || '|virgin(ity)?|bankrupt[a-z]*|in debt|debts|loan default|repossess[a-z]*'
                 || '|prison|jail|convict(ed|ion)|criminal record|arrested|deport[a-z]*'
                 || '|asylum|undocumented|visa status|addict[a-z]*|alcoholic|rehab'
                 || '|overdose|abus(ed|ive))([^a-z]|$)');
$$;

COMMENT ON FUNCTION public.matching_text_carries_sensitive_fact_v1(text) IS
  'True when bounded text carries a sensitive health, reproductive, financial, '
  'legal, immigration or substance fact. This marker set is the deterministic v1 '
  'FLOOR of the Sensitive Conclusion Filter and not a Product safety policy: the '
  'filter records the policy version it applied precisely so a later reviewed '
  'slice can extend the floor without rewriting any of this. Extension may only '
  'ever ADD refusals.';

CREATE FUNCTION public.matching_text_carries_quoted_span_v1(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL AND p_text ~ ('"[^"]{24,}"');
$$;

COMMENT ON FUNCTION public.matching_text_carries_quoted_span_v1(text) IS
  'True when bounded text carries a long verbatim span in quotation marks, which '
  'is how a private memory reaches a recipient wearing a conclusion''s clothes. '
  'The unquoted case is caught separately, by comparing a conclusion against the '
  'private reasoning notes of its own eligibility snapshot.';

CREATE FUNCTION public.matching_canonical_pair_v1(p_user_a uuid, p_user_b uuid)
RETURNS TABLE(lower_user_id uuid, higher_user_id uuid)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT least(p_user_a, p_user_b), greatest(p_user_a, p_user_b)
   WHERE p_user_a IS NOT NULL AND p_user_b IS NOT NULL AND p_user_a <> p_user_b;
$$;

COMMENT ON FUNCTION public.matching_canonical_pair_v1(uuid, uuid) IS
  'The canonical unordered PAIR_KEY of two humans, as the two members smallest '
  'first. PAIR_KEY(A,B) and PAIR_KEY(B,A) are the same answer, and a pair of one '
  'human with themselves has no answer at all.';

-- ---------------------------------------------------------------------------
-- 2. THE NARROW PRIVATE RESOLVERS over sealed I-07A state.
--
--    Read-only by construction: neither body contains an INSERT, an UPDATE or a
--    DELETE, so neither can manufacture, widen or withdraw human consent.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_setup_state_v1(p_user_id uuid)
RETURNS TABLE(participation_state text, pause_reason text, participation_event_id uuid,
              matching_context_grant_id uuid, introduction_profile_version_id uuid,
              matching_requirement_version_id uuid, pre_match_disclosure_authority_id uuid,
              matchable boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r_state text := 'OFF';
  r_reason text := NULL;
  r_event uuid := NULL;
  r_grant uuid := NULL;
  r_profile uuid := NULL;
  r_requirements uuid := NULL;
  r_authority uuid := NULL;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_REQUIRED' USING ERRCODE='22023';
  END IF;
  -- Absence of a pointer IS OFF. Nothing infers participation from a profile, a
  -- grant, a disclosure authority or a conversation.
  SELECT e.id, e.resulting_state, e.resulting_pause_reason INTO r_event, r_state, r_reason
    FROM public.matching_participation_state s
    JOIN public.matching_participation_events e ON e.id = s.current_event_id
   WHERE s.participant_user_id = p_user_id;
  IF r_state IS NULL THEN r_state := 'OFF'; END IF;

  SELECT g.id INTO r_grant FROM public.matching_context_grants g
   WHERE g.grantor_user_id = p_user_id AND g.status = 'ACTIVE';
  SELECT s.current_profile_version_id INTO r_profile
    FROM public.introduction_profile_state s WHERE s.owner_user_id = p_user_id;
  SELECT s.current_requirement_version_id INTO r_requirements
    FROM public.matching_requirement_state s WHERE s.owner_user_id = p_user_id;
  SELECT a.id INTO r_authority FROM public.pre_match_disclosure_authorities a
   WHERE a.grantor_user_id = p_user_id AND a.status = 'ACTIVE';

  RETURN QUERY SELECT r_state, r_reason, r_event, r_grant, r_profile, r_requirements, r_authority,
    (r_state = 'ACTIVE' AND r_grant IS NOT NULL AND r_profile IS NOT NULL
     AND r_requirements IS NOT NULL AND r_authority IS NOT NULL);
END$$;

ALTER FUNCTION public.resolve_matching_setup_state_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_matching_setup_state_v1(uuid) IS
  'The ONE internal entry point into the sealed I-07A setup state for Matching '
  'work: one human''s current participation, grant, profile version, requirement '
  'version and disclosure authority, as identities and bounded states. It writes '
  'nothing, it is executable by no role, and `matchable` is fail-closed - ACTIVE '
  'participation AND all four current identities, never inferred from any of '
  'them individually.';

CREATE FUNCTION public.resolve_matching_active_introduction_v1(p_user_id uuid)
RETURNS TABLE(has_active_introduction boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_REQUIRED' USING ERRCODE='22023';
  END IF;
  -- The canonical Shared World substrate migration 0075 owns, and nothing else.
  -- I-07B implements no Introduction slot and pre-creates none of I-07C's state
  -- in order to have something to read.
  RETURN QUERY SELECT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = p_user_id AND e.ended_at IS NULL
       AND w.phase = 'INTRODUCTION' AND w.lifecycle = 'ACTIVE');
END$$;

ALTER FUNCTION public.resolve_matching_active_introduction_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_matching_active_introduction_v1(uuid) IS
  'Whether one human currently holds an active Introduction, derived from the '
  'canonical Shared World substrate: an open membership episode in an ACTIVE '
  'World whose phase is INTRODUCTION. I-07B implements no ACTIVE_INTRODUCTION_SLOT '
  'and this resolver is not one.';

-- ---------------------------------------------------------------------------
-- 3. THE TWO FAIL-CLOSED SEAMS.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_matching_proposal_prerequisites_v1(p_proposal_id uuid)
RETURNS TABLE(clearance text, basis text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- The only truthful answer today. No executable canonical runtime for the
  -- CW2-08 System / Safety policy, moderation, commercial entitlement, feature
  -- gating or the Launch Gate exists in this repository, and NOT_EVALUATED fails
  -- every consequential proposal delivery and human decision closed. The slice
  -- that implements CW2-08 replaces this body; nothing that consumes it moves.
  RETURN QUERY SELECT 'NOT_EVALUATED'::text,
    ('CW2-08 safety, moderation, entitlement, feature and Launch Gate evaluation has no canonical '
     || 'runtime in this repository, so pre-Match proposal delivery is not cleared.')::text;
END$$;

ALTER FUNCTION public.resolve_matching_proposal_prerequisites_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_matching_proposal_prerequisites_v1(uuid) IS
  'The CW2-08 prerequisite seam for pre-Match proposal delivery and human '
  'decision. Its only answer is NOT_EVALUATED, and every consequential boundary '
  'in 0112 requires exactly CLEARED from it as its LAST gate, after every '
  'privacy and authority gate. It never answers CLEARED and it never will until '
  'the canonical gate exists.';

CREATE FUNCTION public.resolve_matching_canonical_first_name_v1(p_user_id uuid)
RETURNS TABLE(resolution text, first_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_REQUIRED' USING ERRCODE='22023';
  END IF;
  -- The only truthful answer today. A pre-Match proposal may present the
  -- candidate's FIRST NAME from an allowed canonical source, and this repository
  -- has no canonical product account name: public.users carries an id, an auth
  -- subject and two timestamps. The Public World display label belongs to a
  -- different capability and reading it here would move a PUBLIC fact into
  -- private Matching, so it is not read, and a name is never inferred from an
  -- auth subject, a conversation or anything else. The disclosure gate requires
  -- RESOLVED, so the whole proposal path fails closed on this.
  RETURN QUERY SELECT 'UNRESOLVED_NO_CANONICAL_SOURCE'::text, NULL::text;
END$$;

ALTER FUNCTION public.resolve_matching_canonical_first_name_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_matching_canonical_first_name_v1(uuid) IS
  'The canonical first-name seam for pre-Match proposal presentation. Its only '
  'answer is UNRESOLVED_NO_CANONICAL_SOURCE, because no canonical product '
  'account name store exists in this repository and neither a Public display '
  'label nor an inference from any other attribute is an allowed source. The '
  'disclosure gate requires RESOLVED and therefore fails closed.';

-- ---------------------------------------------------------------------------
-- 4. THE TWO-HUMAN LOCK.
--
--    Both humans' I-07A serialization rows, ALWAYS in canonical user-id order,
--    through the SAME upsert-and-lock statement 0109 uses - so an I-07A setup
--    command and an I-07B pair operation serialize on the same row rather than
--    on two different things that happen to be about the same human. Canonical
--    order is what makes a concurrent (A,B) and (B,A) pair of operations
--    impossible to deadlock: both take the smaller id first, always.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.lock_matching_pair_humans_v1(p_lower_user_id uuid, p_higher_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  locked uuid;
BEGIN
  IF p_lower_user_id IS NULL OR p_higher_user_id IS NULL OR p_lower_user_id >= p_higher_user_id THEN
    RAISE EXCEPTION 'MATCHING_PAIR_ORDER_INVALID' USING ERRCODE='22023',
      DETAIL='The two-human lock is taken in canonical user-id order, smallest first, so a concurrent reverse-direction operation cannot deadlock against it.';
  END IF;
  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (p_lower_user_id)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;
  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (p_higher_user_id)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;
END$$;

ALTER FUNCTION public.lock_matching_pair_humans_v1(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.lock_matching_pair_humans_v1(uuid, uuid) IS
  'Takes both humans'' I-07A Matching serialization rows FOR UPDATE in canonical '
  'user-id order, through the same upsert-and-lock statement the I-07A commands '
  'use. Direction never decides lock order, so simultaneous (A,B) and (B,A) work '
  'cannot deadlock.';

-- ---------------------------------------------------------------------------
-- 5. CANONICAL PAIR CREATION - convergent, never duplicated.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.ensure_matching_pair_core_v1(
  p_pair_id uuid, p_user_a uuid, p_user_b uuid
) RETURNS TABLE(pair_id uuid, lower_user_id uuid, higher_user_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lo uuid;
  hi uuid;
  existing uuid;
BEGIN
  IF p_pair_id IS NULL THEN RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023'; END IF;
  SELECT c.lower_user_id, c.higher_user_id INTO lo, hi
    FROM public.matching_canonical_pair_v1(p_user_a, p_user_b) c;
  IF lo IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PAIR_MEMBERS_INVALID' USING ERRCODE='22023',
      DETAIL='A pair is two distinct humans. A human is never paired with themselves.';
  END IF;

  PERFORM public.lock_matching_pair_humans_v1(lo, hi);

  -- Simultaneous (A,B) and (B,A) converge on ONE row: they canonicalize to the
  -- same two columns and the unordered UNIQUE decides. The loser reads the
  -- winner's identity back rather than creating a second pair.
  INSERT INTO public.matching_pairs (id, lower_user_id, higher_user_id)
  VALUES (p_pair_id, lo, hi)
  ON CONFLICT (lower_user_id, higher_user_id) DO NOTHING;

  SELECT p.id INTO existing FROM public.matching_pairs p
   WHERE p.lower_user_id = lo AND p.higher_user_id = hi;
  RETURN QUERY SELECT existing, lo, hi, (existing = p_pair_id);
END$$;

ALTER FUNCTION public.ensure_matching_pair_core_v1(uuid, uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.ensure_matching_pair_core_v1(uuid, uuid, uuid) IS
  'Resolves the canonical unordered pair of two humans, creating it if it does '
  'not exist. Convergent rather than merely idempotent: a simultaneous (A,B) and '
  '(B,A) canonicalize to the same two columns and exactly one row survives, and '
  'the other caller is told which identity won.';

-- ---------------------------------------------------------------------------
-- 6. PRIVATE CANDIDATE DISCOVERY - internal, bounded, unranked, silent.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.discover_matching_candidates_core_v1(p_for_user_id uuid, p_max integer)
RETURNS TABLE(candidate_user_id uuid, lower_user_id uuid, higher_user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  self_state record;
BEGIN
  IF p_for_user_id IS NULL OR p_max IS NULL OR p_max <= 0 OR p_max > 200 THEN
    RAISE EXCEPTION 'MATCHING_DISCOVERY_REQUEST_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO self_state FROM public.resolve_matching_setup_state_v1(p_for_user_id);
  IF NOT self_state.matchable THEN
    RAISE EXCEPTION 'MATCHING_PARTICIPATION_NOT_MATCHABLE' USING ERRCODE='55000',
      DETAIL='Candidate discovery reads CURRENT eligibility truth and never a cached participation fact.';
  END IF;
  IF (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(p_for_user_id) r) THEN
    RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_PRESENT' USING ERRCODE='55000';
  END IF;

  -- Ordering is by canonical identifier, for determinism and for nothing else.
  -- There is no rank, no score, no compatibility percentage and no desirability
  -- order anywhere in this body, and the result is a bounded internal list that
  -- reaches no human and notifies no candidate.
  RETURN QUERY
    SELECT c.participant_user_id,
           least(p_for_user_id, c.participant_user_id),
           greatest(p_for_user_id, c.participant_user_id)
      FROM public.matching_participation_state s
      JOIN public.matching_participation_events c ON c.id = s.current_event_id
     WHERE c.participant_user_id <> p_for_user_id
       AND (SELECT r.matchable FROM public.resolve_matching_setup_state_v1(c.participant_user_id) r)
       AND NOT (SELECT r.has_active_introduction
                  FROM public.resolve_matching_active_introduction_v1(c.participant_user_id) r)
       AND NOT EXISTS (
             SELECT 1 FROM public.matching_proposals prop
              JOIN public.matching_pairs pr ON pr.id = prop.pair_id
             WHERE pr.lower_user_id = least(p_for_user_id, c.participant_user_id)
               AND pr.higher_user_id = greatest(p_for_user_id, c.participant_user_id)
               AND prop.proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST',
                                           'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND'))
     ORDER BY c.participant_user_id
     LIMIT p_max;
END$$;

ALTER FUNCTION public.discover_matching_candidates_core_v1(uuid, integer) OWNER TO postgres;

COMMENT ON FUNCTION public.discover_matching_candidates_core_v1(uuid, integer) IS
  'Bounded INTERNAL candidate resolution over the sealed setup state. It is '
  'executable by no role at all - not even service_role - because an enumerating '
  'read over currently matchable humans is exactly the oracle the anti-oracle '
  'law forbids, and CW2-06 permits such a resolver without requiring one. It '
  'returns no rank, score or percentage, it is not a feed, a swipe deck or a '
  'directory, and discovering a human notifies them of nothing.';

-- ---------------------------------------------------------------------------
-- 7. ELIGIBILITY CAPTURE AND HARD DEALBREAKER EVALUATION.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.capture_matching_eligibility_snapshot_core_v1(
  p_snapshot_id uuid, p_pair_id uuid, p_user_a uuid, p_user_b uuid
) RETURNS TABLE(eligibility_snapshot_id uuid, pair_id uuid,
                lower_user_id uuid, higher_user_id uuid, hard_requirement_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lo uuid;
  hi uuid;
  resolved_pair uuid;
  low_state record;
  high_state record;
  cadence uuid;
  pending uuid;
  expiry uuid;
  committed public.matching_eligibility_snapshots;
  hard_total integer;
BEGIN
  IF p_snapshot_id IS NULL THEN RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023'; END IF;
  SELECT c.lower_user_id, c.higher_user_id INTO lo, hi
    FROM public.matching_canonical_pair_v1(p_user_a, p_user_b) c;
  IF lo IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PAIR_MEMBERS_INVALID' USING ERRCODE='22023';
  END IF;

  PERFORM public.lock_matching_pair_humans_v1(lo, hi);

  -- An equivalent retry returns the ALREADY COMMITTED result, read back from the
  -- committed row rather than echoed from this call's own arguments.
  SELECT * INTO committed FROM public.matching_eligibility_snapshots s WHERE s.id = p_snapshot_id;
  IF FOUND THEN
    IF committed.pair_id = p_pair_id AND committed.lower_user_id = lo AND committed.higher_user_id = hi THEN
      SELECT count(*)::int INTO hard_total FROM public.matching_hard_requirement_results r
       WHERE r.eligibility_snapshot_id = p_snapshot_id;
      RETURN QUERY SELECT committed.id, committed.pair_id, committed.lower_user_id,
                          committed.higher_user_id, hard_total;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT p.id INTO resolved_pair FROM public.matching_pairs p
   WHERE p.lower_user_id = lo AND p.higher_user_id = hi FOR SHARE;
  IF resolved_pair IS NULL OR resolved_pair IS DISTINCT FROM p_pair_id THEN
    RAISE EXCEPTION 'MATCHING_PAIR_NOT_CURRENT' USING ERRCODE='40001',
      DETAIL='A snapshot binds the canonical pair identity that exists right now.';
  END IF;

  SELECT * INTO low_state FROM public.resolve_matching_setup_state_v1(lo);
  SELECT * INTO high_state FROM public.resolve_matching_setup_state_v1(hi);
  -- BOTH humans must be currently matchable. A cross-human failure is ONE
  -- bounded answer that names no human, so an error can never disclose which of
  -- the two is not participating.
  IF NOT low_state.matchable OR NOT high_state.matchable THEN
    RAISE EXCEPTION 'MATCHING_PAIR_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='Both humans must currently participate and hold a Matching Context Grant, an Introduction Profile, a requirement set and a Pre-Match Disclosure Authority.';
  END IF;
  IF (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(lo) r)
     OR (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(hi) r) THEN
    RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_PRESENT' USING ERRCODE='55000',
      DETAIL='A human holding an active Introduction is not available for a new proposal.';
  END IF;

  -- Every required policy must be CONFIGURED. An unconfigured policy is never
  -- read as a permissive default.
  SELECT st.current_policy_version_id INTO cadence FROM public.matching_proposal_policy_state st
   WHERE st.policy_kind = 'PROPOSAL_CADENCE';
  SELECT st.current_policy_version_id INTO pending FROM public.matching_proposal_policy_state st
   WHERE st.policy_kind = 'PENDING_PROPOSAL_LIMIT';
  SELECT st.current_policy_version_id INTO expiry FROM public.matching_proposal_policy_state st
   WHERE st.policy_kind = 'PROPOSAL_EXPIRY';
  IF cadence IS NULL OR pending IS NULL OR expiry IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_UNCONFIGURED' USING ERRCODE='55000',
      DETAIL='The proposal cadence, pending maximum and expiry policies are required and fail closed when unconfigured.';
  END IF;

  INSERT INTO public.matching_eligibility_snapshots (
    id, pair_id, lower_user_id, higher_user_id,
    lower_participation_event_id, higher_participation_event_id,
    lower_context_grant_id, higher_context_grant_id,
    lower_profile_version_id, higher_profile_version_id,
    lower_requirement_version_id, higher_requirement_version_id,
    lower_disclosure_authority_id, higher_disclosure_authority_id,
    cadence_policy_version_id, pending_policy_version_id, expiry_policy_version_id)
  VALUES (
    p_snapshot_id, p_pair_id, lo, hi,
    low_state.participation_event_id, high_state.participation_event_id,
    low_state.matching_context_grant_id, high_state.matching_context_grant_id,
    low_state.introduction_profile_version_id, high_state.introduction_profile_version_id,
    low_state.matching_requirement_version_id, high_state.matching_requirement_version_id,
    low_state.pre_match_disclosure_authority_id, high_state.pre_match_disclosure_authority_id,
    cadence, pending, expiry);

  SELECT count(*)::int INTO hard_total FROM public.matching_requirement_items i
   WHERE i.requirement_version_id IN (low_state.matching_requirement_version_id,
                                      high_state.matching_requirement_version_id)
     AND i.requirement_strength = 'HARD_DEALBREAKER';

  RETURN QUERY SELECT p_snapshot_id, p_pair_id, lo, hi, hard_total;
END$$;

ALTER FUNCTION public.capture_matching_eligibility_snapshot_core_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.capture_matching_eligibility_snapshot_core_v1(uuid, uuid, uuid, uuid) IS
  'Captures the immutable CANDIDATE_ELIGIBILITY_SNAPSHOT for one canonical pair, '
  'binding both humans'' exact current participation, grant, profile, requirement '
  'and disclosure identities and the three exact current proposal policy '
  'identities. It refuses an unconfigured policy, a non-matchable human and a '
  'human holding an active Introduction, and its cross-human refusal names no '
  'human at all.';

CREATE FUNCTION public.evaluate_matching_hard_requirement_core_v1(
  p_eligibility_snapshot_id uuid, p_for_user_id uuid, p_requirement_key text,
  p_outcome text, p_evidence_source_class text
) RETURNS TABLE(eligibility_snapshot_id uuid, evaluated_for_user_id uuid, requirement_key text,
                requirement_outcome text, evidence_source_class text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  version_id uuid;
  strength text;
  committed public.matching_hard_requirement_results;
BEGIN
  IF p_eligibility_snapshot_id IS NULL OR p_for_user_id IS NULL OR p_requirement_key IS NULL
     OR p_outcome IS NULL OR p_evidence_source_class IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_outcome NOT IN ('PASS', 'FAIL', 'UNKNOWN') THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_OUTCOME_INVALID' USING ERRCODE='22023';
  END IF;
  -- THE CANDIDATE SELF-TRUTH LAW, as a refusal rather than as a comment. Only
  -- the four allowed source classes exist, and an outcome that claims to be
  -- established must name one while an UNKNOWN must not.
  IF p_evidence_source_class NOT IN ('SELF_AUTHORED_PERSONAL', 'EXPLICIT_MATCHING_ANSWER',
                                     'INTRODUCTION_PROFILE', 'CANONICAL_PRODUCT_ACCOUNT_STATE',
                                     'NOT_ESTABLISHED') THEN
    RAISE EXCEPTION 'MATCHING_EVIDENCE_SOURCE_NOT_ALLOWED' USING ERRCODE='22023',
      DETAIL='A candidate fact may only be established from the human''s own self-authored context, an explicit Matching answer, their Introduction Profile or canonical product account state. A third-party claim and an inference from a name, a voice, a photo, a language style or any stereotype-bearing proxy are not sources.';
  END IF;
  IF (p_outcome = 'UNKNOWN') <> (p_evidence_source_class = 'NOT_ESTABLISHED') THEN
    RAISE EXCEPTION 'MATCHING_UNKNOWN_IS_NOT_SATISFACTION' USING ERRCODE='22023',
      DETAIL='An UNKNOWN carries no established source and an established outcome must name one. UNKNOWN is never promoted to PASS.';
  END IF;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  PERFORM public.lock_matching_pair_humans_v1(snapshot.lower_user_id, snapshot.higher_user_id);

  version_id := CASE p_for_user_id
                  WHEN snapshot.lower_user_id THEN snapshot.lower_requirement_version_id
                  WHEN snapshot.higher_user_id THEN snapshot.higher_requirement_version_id
                END;
  IF version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_OWNER_NOT_IN_PAIR' USING ERRCODE='22023';
  END IF;

  -- A result exists only for a HARD_DEALBREAKER. A soft preference is not a
  -- gate and never acquires one by being evaluated here.
  SELECT i.requirement_strength INTO strength FROM public.matching_requirement_items i
   WHERE i.requirement_version_id = version_id AND i.requirement_key = p_requirement_key;
  IF strength IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_NOT_IN_VERSION' USING ERRCODE='22023';
  END IF;
  IF strength <> 'HARD_DEALBREAKER' THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_IS_NOT_HARD' USING ERRCODE='22023',
      DETAIL='Only a HARD_DEALBREAKER is evaluated as PASS, FAIL or UNKNOWN. A SOFT_PREFERENCE is never converted into a gate.';
  END IF;

  SELECT * INTO committed FROM public.matching_hard_requirement_results r
   WHERE r.eligibility_snapshot_id = p_eligibility_snapshot_id
     AND r.evaluated_for_user_id = p_for_user_id AND r.requirement_key = p_requirement_key;
  IF FOUND THEN
    IF committed.requirement_outcome = p_outcome
       AND committed.evidence_source_class = p_evidence_source_class
       AND committed.requirement_version_id = version_id THEN
      RETURN QUERY SELECT committed.eligibility_snapshot_id, committed.evaluated_for_user_id,
                          committed.requirement_key, committed.requirement_outcome,
                          committed.evidence_source_class;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_RESULT_CONFLICT' USING ERRCODE='23505',
      DETAIL='A committed hard requirement result is immutable. A different answer for the same requirement is a different evaluation and needs a new snapshot.';
  END IF;

  INSERT INTO public.matching_hard_requirement_results
    (eligibility_snapshot_id, evaluated_for_user_id, requirement_version_id,
     requirement_key, requirement_outcome, evidence_source_class)
  VALUES (p_eligibility_snapshot_id, p_for_user_id, version_id,
          p_requirement_key, p_outcome, p_evidence_source_class);

  RETURN QUERY SELECT p_eligibility_snapshot_id, p_for_user_id, p_requirement_key,
                      p_outcome, p_evidence_source_class;
END$$;

ALTER FUNCTION public.evaluate_matching_hard_requirement_core_v1(uuid, uuid, text, text, text) OWNER TO postgres;

COMMENT ON FUNCTION public.evaluate_matching_hard_requirement_core_v1(uuid, uuid, text, text, text) IS
  'Records one HARD_DEALBREAKER outcome against one eligibility snapshot. The '
  'source class must be one of the four allowed candidate self-truth classes, an '
  'UNKNOWN must carry none, an established outcome must carry one, and a '
  'SOFT_PREFERENCE cannot be evaluated here at all. A committed result is '
  'immutable: a different answer needs a new snapshot, never a rewrite.';

-- ---------------------------------------------------------------------------
-- 8. THE PRIVATE SIDE, AND THE FILTER THAT GUARDS THE CROSSING.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_matching_private_reasoning_core_v1(
  p_note_id uuid, p_eligibility_snapshot_id uuid, p_about_user_id uuid,
  p_evidence_source_class text, p_private_note text
) RETURNS TABLE(note_id uuid, eligibility_snapshot_id uuid, about_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  committed public.matching_private_reasoning_notes;
BEGIN
  IF p_note_id IS NULL OR p_eligibility_snapshot_id IS NULL OR p_about_user_id IS NULL
     OR p_evidence_source_class IS NULL OR p_private_note IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_evidence_source_class NOT IN ('SELF_AUTHORED_PERSONAL', 'EXPLICIT_MATCHING_ANSWER',
                                     'INTRODUCTION_PROFILE', 'CANONICAL_PRODUCT_ACCOUNT_STATE') THEN
    RAISE EXCEPTION 'MATCHING_EVIDENCE_SOURCE_NOT_ALLOWED' USING ERRCODE='22023';
  END IF;

  SELECT * INTO committed FROM public.matching_private_reasoning_notes n WHERE n.id = p_note_id;
  IF FOUND THEN
    IF committed.eligibility_snapshot_id = p_eligibility_snapshot_id
       AND committed.about_user_id = p_about_user_id
       AND committed.evidence_source_class = p_evidence_source_class
       AND committed.private_note = p_private_note THEN
      RETURN QUERY SELECT committed.id, committed.eligibility_snapshot_id, committed.about_user_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_about_user_id NOT IN (snapshot.lower_user_id, snapshot.higher_user_id) THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_NOT_IN_PAIR' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_matching_pair_humans_v1(snapshot.lower_user_id, snapshot.higher_user_id);

  INSERT INTO public.matching_private_reasoning_notes
    (id, eligibility_snapshot_id, about_user_id, evidence_source_class, private_note)
  VALUES (p_note_id, p_eligibility_snapshot_id, p_about_user_id, p_evidence_source_class, p_private_note);

  RETURN QUERY SELECT p_note_id, p_eligibility_snapshot_id, p_about_user_id;
END$$;

ALTER FUNCTION public.record_matching_private_reasoning_core_v1(uuid, uuid, uuid, text, text) OWNER TO postgres;

COMMENT ON FUNCTION public.record_matching_private_reasoning_core_v1(uuid, uuid, uuid, text, text) IS
  'Records private Matching reasoning about one human of one pair, on the '
  'private side of the disclosure boundary. It is never read by a recipient '
  'boundary; the filter reads it only in order to REFUSE a conclusion that '
  'quotes it.';

CREATE FUNCTION public.submit_matching_safe_conclusion_core_v1(
  p_conclusion_id uuid, p_eligibility_snapshot_id uuid,
  p_for_recipient_user_id uuid, p_about_user_id uuid, p_conclusion_text text
) RETURNS TABLE(conclusion_candidate_id uuid, for_recipient_user_id uuid, about_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  committed public.matching_safe_conclusion_candidates;
BEGIN
  IF p_conclusion_id IS NULL OR p_eligibility_snapshot_id IS NULL
     OR p_for_recipient_user_id IS NULL OR p_about_user_id IS NULL OR p_conclusion_text IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO committed FROM public.matching_safe_conclusion_candidates c WHERE c.id = p_conclusion_id;
  IF FOUND THEN
    IF committed.eligibility_snapshot_id = p_eligibility_snapshot_id
       AND committed.for_recipient_user_id = p_for_recipient_user_id
       AND committed.about_user_id = p_about_user_id
       AND committed.conclusion_text = p_conclusion_text THEN
      RETURN QUERY SELECT committed.id, committed.for_recipient_user_id, committed.about_user_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_for_recipient_user_id NOT IN (snapshot.lower_user_id, snapshot.higher_user_id)
     OR p_about_user_id NOT IN (snapshot.lower_user_id, snapshot.higher_user_id) THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_NOT_IN_PAIR' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_matching_pair_humans_v1(snapshot.lower_user_id, snapshot.higher_user_id);

  -- The text is stored EXACTLY as submitted, unfiltered, on the untrusted side.
  -- Nothing about this row makes it disclosable: only the filter's own verdict
  -- can create a permitted conclusion, and this relation carries no verdict.
  INSERT INTO public.matching_safe_conclusion_candidates
    (id, eligibility_snapshot_id, for_recipient_user_id, about_user_id, conclusion_text)
  VALUES (p_conclusion_id, p_eligibility_snapshot_id, p_for_recipient_user_id,
          p_about_user_id, p_conclusion_text);

  RETURN QUERY SELECT p_conclusion_id, p_for_recipient_user_id, p_about_user_id;
END$$;

ALTER FUNCTION public.submit_matching_safe_conclusion_core_v1(uuid, uuid, uuid, uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.submit_matching_safe_conclusion_core_v1(uuid, uuid, uuid, uuid, text) IS
  'Submits one recipient-specific Safe Compatibility Conclusion CANDIDATE. '
  'Whatever produced it - a model, a template, a human - it is untrusted input '
  'to the disclosure pipeline, it is stored exactly as submitted, and it carries '
  'no safety label of its own because nothing but the filter may give it one.';

-- THE SENSITIVE CONCLUSION FILTER. Deterministic, fail-closed, and the only
-- thing in this repository that can mint a permitted conclusion.
CREATE FUNCTION public.apply_matching_sensitive_conclusion_filter_core_v1(
  p_decision_id uuid, p_conclusion_candidate_id uuid
) RETURNS TABLE(filter_verdict text, permitted_conclusion_id uuid, private_refusal_class text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  candidate public.matching_safe_conclusion_candidates;
  snapshot public.matching_eligibility_snapshots;
  policy_version uuid;
  refusal_class text := NULL;
  existing_permitted public.matching_permitted_safe_conclusions;
  existing_refusal public.matching_sensitive_filter_refusals;
BEGIN
  IF p_decision_id IS NULL OR p_conclusion_candidate_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO candidate FROM public.matching_safe_conclusion_candidates c
   WHERE c.id = p_conclusion_candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_SAFE_CONCLUSION_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s
   WHERE s.id = candidate.eligibility_snapshot_id;
  PERFORM public.lock_matching_pair_humans_v1(snapshot.lower_user_id, snapshot.higher_user_id);

  -- An already-decided candidate answers with the COMMITTED outcome, read back
  -- from the committed row. One conclusion has exactly one verdict, forever.
  SELECT * INTO existing_permitted FROM public.matching_permitted_safe_conclusions c
   WHERE c.conclusion_candidate_id = p_conclusion_candidate_id;
  IF FOUND THEN
    RETURN QUERY SELECT existing_permitted.filter_verdict, existing_permitted.id, NULL::text;
    RETURN;
  END IF;
  SELECT * INTO existing_refusal FROM public.matching_sensitive_filter_refusals f
   WHERE f.conclusion_candidate_id = p_conclusion_candidate_id;
  IF FOUND THEN
    RETURN QUERY SELECT existing_refusal.filter_verdict, NULL::uuid, existing_refusal.private_refusal_class;
    RETURN;
  END IF;

  -- FAIL CLOSED ON AN UNCONFIGURED FILTER. There is no "filter unavailable, so
  -- allow" path: without a policy identity nothing can be permitted and nothing
  -- can even be recorded as refused, so the call refuses outright.
  SELECT st.current_policy_version_id INTO policy_version
    FROM public.matching_proposal_policy_state st
   WHERE st.policy_kind = 'SENSITIVE_CONCLUSION_FILTER';
  IF policy_version IS NULL THEN
    RAISE EXCEPTION 'MATCHING_SENSITIVE_FILTER_UNCONFIGURED' USING ERRCODE='55000',
      DETAIL='The Sensitive Conclusion Filter policy is unconfigured. No conclusion is permitted while it is.';
  END IF;

  -- THE DETERMINISTIC CLASSIFICATION, most specific first.
  IF public.matching_text_carries_contact_route_v1(candidate.conclusion_text) THEN
    refusal_class := 'CONTACT_ROUTE';
  ELSIF public.matching_text_carries_hidden_provenance_v1(candidate.conclusion_text) THEN
    refusal_class := 'HIDDEN_PROVENANCE';
  ELSIF public.matching_text_carries_quoted_span_v1(candidate.conclusion_text)
        OR EXISTS (SELECT 1 FROM public.matching_private_reasoning_notes n
                    WHERE n.eligibility_snapshot_id = candidate.eligibility_snapshot_id
                      AND length(btrim(n.private_note)) >= 16
                      AND position(btrim(n.private_note) IN candidate.conclusion_text) > 0) THEN
    -- Either a long verbatim quoted span, or the conclusion carrying a private
    -- reasoning note of its OWN snapshot word for word with no quotation marks
    -- at all. The second is the one a regex-only redaction layer never catches.
    refusal_class := 'PRIVATE_QUOTE';
  ELSIF public.matching_text_carries_visible_ranking_v1(candidate.conclusion_text) THEN
    refusal_class := 'VISIBLE_RANKING';
  ELSIF public.matching_text_carries_sensitive_fact_v1(candidate.conclusion_text) THEN
    refusal_class := 'SENSITIVE_FACT';
  ELSIF btrim(candidate.conclusion_text) = '' OR length(candidate.conclusion_text) > 1024 THEN
    -- Anything the permitted relation could not hold is UNCLASSIFIED rather than
    -- quietly trimmed: an unknown safety result is a refusal, never a pass.
    refusal_class := 'UNCLASSIFIED_RESULT';
  END IF;

  IF refusal_class IS NOT NULL THEN
    INSERT INTO public.matching_sensitive_filter_refusals
      (id, conclusion_candidate_id, filter_policy_version_id, filter_verdict, private_refusal_class)
    VALUES (p_decision_id, p_conclusion_candidate_id, policy_version,
            CASE WHEN refusal_class = 'UNCLASSIFIED_RESULT' THEN 'UNCLASSIFIED' ELSE 'REFUSED' END,
            refusal_class);
    RETURN QUERY SELECT (CASE WHEN refusal_class = 'UNCLASSIFIED_RESULT' THEN 'UNCLASSIFIED' ELSE 'REFUSED' END)::text,
                        NULL::uuid, refusal_class;
    RETURN;
  END IF;

  INSERT INTO public.matching_permitted_safe_conclusions
    (id, conclusion_candidate_id, for_recipient_user_id, about_user_id,
     filter_policy_version_id, permitted_text)
  VALUES (p_decision_id, p_conclusion_candidate_id, candidate.for_recipient_user_id,
          candidate.about_user_id, policy_version, candidate.conclusion_text);

  RETURN QUERY SELECT 'PERMITTED'::text, p_decision_id, NULL::text;
END$$;

ALTER FUNCTION public.apply_matching_sensitive_conclusion_filter_core_v1(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.apply_matching_sensitive_conclusion_filter_core_v1(uuid, uuid) IS
  'The SENSITIVE_CONCLUSION_FILTER, and the only thing that can mint a permitted '
  'Safe Compatibility Conclusion. It is deterministic and fail-closed: a contact '
  'route, hidden provenance, a verbatim private quote - quoted or not - visible '
  'ranking language and an unauthorized sensitive fact each refuse, an '
  'unclassifiable result refuses as UNCLASSIFIED, and an unconfigured filter '
  'policy refuses the call outright. The private refusal reason is recorded '
  'where no recipient boundary can reach it.';

-- ---------------------------------------------------------------------------
-- 9. THE MATCHING PROPOSAL DISCLOSURE GATE.
--
--    The ONE way a recipient view comes into existence, and the only place
--    private Matching state becomes something a human may be shown.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.materialize_matching_recipient_view_core_v1(
  p_view_id uuid, p_proposal_id uuid, p_recipient_user_id uuid, p_permitted_conclusion_id uuid
) RETURNS TABLE(recipient_view_id uuid, proposal_id uuid, recipient_role text,
                superseded_view_id uuid, disclosed_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  proposal public.matching_proposals;
  snapshot public.matching_eligibility_snapshots;
  conclusion public.matching_permitted_safe_conclusions;
  committed public.matching_recipient_proposal_views;
  role_of text;
  subject uuid;
  subject_state record;
  bound_profile uuid;
  bound_authority uuid;
  field_policy uuid;
  name_answer record;
  current_view uuid;
  offending_key text;
  disclosed integer;
BEGIN
  IF p_view_id IS NULL OR p_proposal_id IS NULL OR p_recipient_user_id IS NULL
     OR p_permitted_conclusion_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  SELECT * INTO committed FROM public.matching_recipient_proposal_views v WHERE v.id = p_view_id;
  IF FOUND THEN
    IF committed.proposal_id = p_proposal_id AND committed.recipient_user_id = p_recipient_user_id
       AND committed.permitted_conclusion_id = p_permitted_conclusion_id THEN
      SELECT count(*)::int INTO disclosed FROM public.matching_recipient_proposal_view_fields f
       WHERE f.view_id = p_view_id;
      RETURN QUERY SELECT committed.id, committed.proposal_id, committed.recipient_role,
                          committed.prior_view_id, disclosed;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- The audience is derived from the proposal's own immutable direction. A
  -- caller cannot name an arbitrary recipient: only the two humans of this exact
  -- proposal have a role at all.
  role_of := CASE p_recipient_user_id
               WHEN proposal.first_recipient_user_id THEN 'FIRST_RECIPIENT'
               WHEN proposal.candidate_user_id THEN 'CANDIDATE'
             END;
  IF role_of IS NULL THEN
    RAISE EXCEPTION 'MATCHING_RECIPIENT_NOT_IN_PROPOSAL' USING ERRCODE='22023';
  END IF;
  subject := CASE role_of WHEN 'FIRST_RECIPIENT' THEN proposal.candidate_user_id
                          ELSE proposal.first_recipient_user_id END;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s
   WHERE s.id = proposal.eligibility_snapshot_id;
  bound_profile := CASE subject WHEN snapshot.lower_user_id THEN snapshot.lower_profile_version_id
                                ELSE snapshot.higher_profile_version_id END;
  bound_authority := CASE subject WHEN snapshot.lower_user_id THEN snapshot.lower_disclosure_authority_id
                                  ELSE snapshot.higher_disclosure_authority_id END;

  -- REVALIDATION, not trust. The snapshot says what was true when it was taken;
  -- disclosure requires those identities to still be the subject's CURRENT ones.
  SELECT * INTO subject_state FROM public.resolve_matching_setup_state_v1(subject);
  IF NOT subject_state.matchable
     OR subject_state.introduction_profile_version_id IS DISTINCT FROM bound_profile
     OR subject_state.pre_match_disclosure_authority_id IS DISTINCT FROM bound_authority THEN
    RAISE EXCEPTION 'MATCHING_DISCLOSURE_AUTHORITY_STALE' USING ERRCODE='40001',
      DETAIL='A recipient view may only be built from the subject''s CURRENT Introduction Profile version and CURRENT Pre-Match Disclosure Authority. An authority over an earlier version never silently covers a later one.';
  END IF;

  SELECT st.current_policy_version_id INTO field_policy
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PROPOSAL_SAFE_FIELDS';
  IF field_policy IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_UNCONFIGURED' USING ERRCODE='55000',
      DETAIL='The Product pre-Match field policy is required. Human authority is necessary and not sufficient, so an unconfigured Product policy discloses nothing.';
  END IF;

  -- The conclusion was filtered FOR THIS RECIPIENT and is ABOUT THIS SUBJECT.
  SELECT * INTO conclusion FROM public.matching_permitted_safe_conclusions c
   WHERE c.id = p_permitted_conclusion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_SAFE_CONCLUSION_NOT_PERMITTED' USING ERRCODE='55000',
      DETAIL='A recipient view binds a conclusion the Sensitive Conclusion Filter permitted. A refused, unclassified or unfiltered conclusion has no row here.';
  END IF;
  IF conclusion.for_recipient_user_id <> p_recipient_user_id OR conclusion.about_user_id <> subject THEN
    RAISE EXCEPTION 'MATCHING_SAFE_CONCLUSION_AUDIENCE_MISMATCH' USING ERRCODE='22023',
      DETAIL='The first-recipient view and the candidate view are independent disclosures. A conclusion written for one is never re-aimed at the other.';
  END IF;

  -- The first name comes from the ONE canonical seam and from nowhere else.
  SELECT * INTO name_answer FROM public.resolve_matching_canonical_first_name_v1(subject);
  IF name_answer.resolution <> 'RESOLVED' OR name_answer.first_name IS NULL THEN
    RAISE EXCEPTION 'MATCHING_CANONICAL_FIRST_NAME_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='A proposal presents a first name from an allowed canonical source. There is none in this repository, so the disclosure gate fails closed rather than inferring one.';
  END IF;

  SELECT st.current_view_id INTO current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = p_recipient_user_id FOR UPDATE;

  -- THE DISCLOSABLE SET IS AN INTERSECTION: approved by the human AND permitted
  -- by Product. Then every VALUE is put through the proposal-output filter, so a
  -- benign key cannot smuggle a contact route or a source identifier past a
  -- ceiling that only ever inspected keys.
  SELECT fv.field_key INTO offending_key
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority
     AND (public.matching_text_carries_contact_route_v1(fv.field_value)
       OR public.matching_text_carries_hidden_provenance_v1(fv.field_value))
   ORDER BY fv.field_key LIMIT 1;
  IF offending_key IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_FIELD_VALUE_REFUSED' USING ERRCODE='55000',
      DETAIL=format('The approved field %L carries a direct contact route or a source identifier in its VALUE. I-07A bans a contact-route field KEY; a benign key may not smuggle one through free text.', offending_key);
  END IF;

  SELECT count(*)::int INTO disclosed
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority;
  IF disclosed = 0 THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_DISCLOSURE_EMPTY' USING ERRCODE='55000',
      DETAIL='Nothing the human approved is also permitted by Product for pre-Match disclosure, so there is no proposal to make.';
  END IF;

  INSERT INTO public.matching_recipient_proposal_views (
    id, proposal_id, recipient_role, recipient_user_id, subject_user_id,
    first_recipient_user_id, candidate_user_id, prior_view_id, eligibility_snapshot_id,
    subject_profile_version_id, subject_disclosure_authority_id,
    safe_field_policy_version_id, permitted_conclusion_id, subject_first_name)
  VALUES (
    p_view_id, p_proposal_id, role_of, p_recipient_user_id, subject,
    proposal.first_recipient_user_id, proposal.candidate_user_id, current_view,
    proposal.eligibility_snapshot_id, bound_profile, bound_authority,
    field_policy, p_permitted_conclusion_id, name_answer.first_name);

  INSERT INTO public.matching_recipient_proposal_view_fields
    (view_id, subject_disclosure_authority_id, safe_field_policy_version_id, field_key, disclosed_value)
  SELECT p_view_id, bound_authority, field_policy, af.field_key, fv.field_value
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority;

  IF current_view IS NULL THEN
    INSERT INTO public.matching_recipient_proposal_view_state
      (proposal_id, recipient_user_id, current_view_id)
    VALUES (p_proposal_id, p_recipient_user_id, p_view_id);
  ELSE
    -- The superseded view is NOT erased: it stays as the historical record of
    -- what this human was actually shown.
    UPDATE public.matching_recipient_proposal_view_state st
       SET current_view_id = p_view_id, updated_at = CURRENT_TIMESTAMP
     WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = p_recipient_user_id
       AND st.current_view_id = current_view;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_view_id, p_proposal_id, role_of, current_view, disclosed;
END$$;

ALTER FUNCTION public.materialize_matching_recipient_view_core_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.materialize_matching_recipient_view_core_v1(uuid, uuid, uuid, uuid) IS
  'The MATCHING_PROPOSAL_DISCLOSURE_GATE, and the only way a recipient view '
  'exists. It derives the audience from the proposal''s own immutable direction, '
  'revalidates that the subject''s CURRENT profile version and disclosure '
  'authority are still the ones the snapshot bound, requires the current Product '
  'field policy and the canonical first name, and discloses only the '
  'intersection of what the human approved and what Product permits - with every '
  'VALUE filtered, so a benign key cannot carry a contact route. The '
  'first-recipient view and the candidate view are independent disclosures with '
  'no copy path between them.';

-- ---------------------------------------------------------------------------
-- 10. OWNERSHIP AND LEAST-PRIVILEGE ACL.
--
--     NO ROLE HOLDS EXECUTE ON ANYTHING HERE. See the header: pre-Match proposal
--     work is consequential disclosure about two humans, the CW2-08 gate that
--     must clear it does not exist, and a production application role must not
--     be handed a path around a gate nobody has built. I-09 wraps these cores;
--     it does not reopen them.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.matching_text_carries_contact_route_v1(text)',
    'public.matching_text_carries_hidden_provenance_v1(text)',
    'public.matching_text_carries_visible_ranking_v1(text)',
    'public.matching_text_carries_sensitive_fact_v1(text)',
    'public.matching_text_carries_quoted_span_v1(text)',
    'public.matching_canonical_pair_v1(uuid,uuid)',
    'public.resolve_matching_setup_state_v1(uuid)',
    'public.resolve_matching_active_introduction_v1(uuid)',
    'public.resolve_matching_proposal_prerequisites_v1(uuid)',
    'public.resolve_matching_canonical_first_name_v1(uuid)',
    'public.lock_matching_pair_humans_v1(uuid,uuid)',
    'public.ensure_matching_pair_core_v1(uuid,uuid,uuid)',
    'public.discover_matching_candidates_core_v1(uuid,integer)',
    'public.capture_matching_eligibility_snapshot_core_v1(uuid,uuid,uuid,uuid)',
    'public.evaluate_matching_hard_requirement_core_v1(uuid,uuid,text,text,text)',
    'public.record_matching_private_reasoning_core_v1(uuid,uuid,uuid,text,text)',
    'public.submit_matching_safe_conclusion_core_v1(uuid,uuid,uuid,uuid,text)',
    'public.apply_matching_sensitive_conclusion_filter_core_v1(uuid,uuid)',
    'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 11. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  all_boundaries text[] := ARRAY[
    'public.matching_text_carries_contact_route_v1(text)',
    'public.matching_text_carries_hidden_provenance_v1(text)',
    'public.matching_text_carries_visible_ranking_v1(text)',
    'public.matching_text_carries_sensitive_fact_v1(text)',
    'public.matching_text_carries_quoted_span_v1(text)',
    'public.matching_canonical_pair_v1(uuid,uuid)',
    'public.resolve_matching_setup_state_v1(uuid)',
    'public.resolve_matching_active_introduction_v1(uuid)',
    'public.resolve_matching_proposal_prerequisites_v1(uuid)',
    'public.resolve_matching_canonical_first_name_v1(uuid)',
    'public.lock_matching_pair_humans_v1(uuid,uuid)',
    'public.ensure_matching_pair_core_v1(uuid,uuid,uuid)',
    'public.discover_matching_candidates_core_v1(uuid,integer)',
    'public.capture_matching_eligibility_snapshot_core_v1(uuid,uuid,uuid,uuid)',
    'public.evaluate_matching_hard_requirement_core_v1(uuid,uuid,text,text,text)',
    'public.record_matching_private_reasoning_core_v1(uuid,uuid,uuid,text,text)',
    'public.submit_matching_safe_conclusion_core_v1(uuid,uuid,uuid,uuid,text)',
    'public.apply_matching_sensitive_conclusion_filter_core_v1(uuid,uuid)',
    'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)'];
  read_only text[] := ARRAY[
    'public.resolve_matching_setup_state_v1(uuid)',
    'public.resolve_matching_active_introduction_v1(uuid)',
    'public.resolve_matching_proposal_prerequisites_v1(uuid)',
    'public.resolve_matching_canonical_first_name_v1(uuid)',
    'public.discover_matching_candidates_core_v1(uuid,integer)'];
  fn text;
  p record;
  target_role text;
  offending text;
BEGIN
  FOREACH fn IN ARRAY all_boundaries LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07B: % must be postgres-owned', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-07B: % must pin an empty search_path', fn;
    END IF;
    -- NO ROLE EXECUTES ANY OF IT. Pre-Match proposal work stays behind the
    -- missing CW2-08 Launch Gate rather than around it.
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07B: PUBLIC must not execute %', fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-07B: % must not execute % before the CW2-08 Launch Gate exists', target_role, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- EVERY READ-ONLY RESOLVER REALLY IS READ ONLY. A resolver that could write
  -- could manufacture, widen or withdraw a human's Matching consent.
  FOREACH fn IN ARRAY read_only LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-07B: % must be STABLE', fn; END IF;
    IF p.prosrc ~* '(INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE)' THEN
      RAISE EXCEPTION 'I-07B: % is a private resolver and may never write: it cannot manufacture human consent', fn;
    END IF;
  END LOOP;

  -- THE TWO SEAMS FAIL CLOSED AND CANNOT ANSWER OTHERWISE.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_matching_proposal_prerequisites_v1(uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'I-07B: the CW2-08 prerequisite seam must answer NOT_EVALUATED and never CLEARED until the canonical gate exists';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_matching_canonical_first_name_v1(uuid)'::regprocedure;
  IF p.prosrc !~ 'UNRESOLVED_NO_CANONICAL_SOURCE' OR p.prosrc ~ '''RESOLVED''' THEN
    RAISE EXCEPTION 'I-07B: the canonical first-name seam must answer UNRESOLVED and never RESOLVED while no canonical source exists';
  END IF;

  -- THE DISCLOSURE GATE NEVER READS THE PRIVATE SIDE, AND NEVER COPIES A VALUE
  -- WITHOUT FILTERING IT.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)'::regprocedure;
  -- The relation references are matched SCHEMA-QUALIFIED. The body legitimately
  -- spells bounded error codes in upper case, and an unqualified needle would
  -- match one of those instead of an actual read.
  IF p.prosrc ~ 'public\.matching_private_reasoning_notes'
     OR p.prosrc ~ 'public\.matching_sensitive_filter_refusals'
     OR p.prosrc ~ 'public\.matching_hard_requirement_results'
     OR p.prosrc ~ 'public\.matching_safe_conclusion_candidates' THEN
    RAISE EXCEPTION 'I-07B: the disclosure gate may not read private reasoning, a private filter reason, a hard requirement result or an unfiltered conclusion';
  END IF;
  IF p.prosrc !~ 'matching_text_carries_contact_route_v1'
     OR p.prosrc !~ 'matching_proposal_safe_field_keys'
     OR p.prosrc !~ 'resolve_matching_canonical_first_name_v1' THEN
    RAISE EXCEPTION 'I-07B: the disclosure gate must filter every disclosed value, require the Product field policy and consume the canonical first-name seam';
  END IF;

  -- THE FILTER IS THE ONLY WRITER OF A PERMITTED CONCLUSION.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_permitted_safe_conclusions'
     AND pr.proname <> 'apply_matching_sensitive_conclusion_filter_core_v1';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: only the Sensitive Conclusion Filter may mint a permitted conclusion; found %', offending;
  END IF;

  -- NO PROPOSAL STATE PRODUCER EXISTS YET: 0111 is evaluation and disclosure,
  -- and 0112 owns the choreography. This is a statement about THIS migration's
  -- own deploy point, which is why it lives here and not in the 0111 verifier:
  -- by the time a verifier runs, 0112 has legitimately added its producers.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\.matching_proposal_transitions';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: migration 0111 creates no proposal transition producer; that is 0112. Found %', offending;
  END IF;

  -- NO SECOND ACCEPTANCE, NO MUTUAL MATCH, NO INTRODUCTION BIRTH ANYWHERE IN
  -- THIS MIGRATION'S OWN BODIES. The scan is bounded to the boundaries 0111
  -- creates, so a reviewed predecessor elsewhere is not judged by an I-07B rule.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND pr.proname IN (SELECT split_part(split_part(b, '.', 2), '(', 1) FROM unnest(all_boundaries) b)
     AND (pr.prosrc ~* '(SECOND_ACCEPTED|MUTUAL_MATCH_COMMITTED|MATCH_COMMIT|ACTIVE_INTRODUCTION_SLOT)'
       OR pr.prosrc ~ 'INSERT INTO public\.shared_worlds'
       OR pr.prosrc ~ 'INSERT INTO public\.shared_world_membership_episodes');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: second acceptance, Mutual Match, match commit, Introduction slot and Shared World birth belong to I-07C; found %', offending;
  END IF;

  -- THE I-07A BOUNDARY IS UNCHANGED.
  IF NOT has_function_privilege('authenticated', 'public.get_my_matching_setup_v1()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.activate_matching_participation_v1(uuid,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07B: the I-07A human command boundary must be exactly as 0109 left it';
  END IF;
END$$;

COMMIT;
