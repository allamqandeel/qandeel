-- I-07D - Ordinary Shared Material in an ACTIVE / INTRODUCTION World v1.
--
-- ===========================================================================
-- Why this migration exists
-- ===========================================================================
--
-- Independent review of this slice found that after a Mutual Match the two
-- humans were given a Shared World they could not actually speak in.
--
-- CW2-03 requires Shared v1 to carry HUMAN_TEXT, HUMAN_VOICE_NOTE and
-- QANDEEL_PARTICIPATION, and the ACTIVE / INTRODUCTION phase specifically
-- exists so QANDEEL can welcome the pair, break the ice, surface safe
-- differences and agreements, propose progressive disclosure and propose the
-- transition to Standard. Migration 0115 gave that phase exactly ONE producer -
-- the reserved EXPLICIT_DISCLOSURE - and migration 0090's two ordinary commit
-- cores still refused every World that was not ACTIVE / STANDARD. So an
-- Introduction could disclose a phone number and could end, but neither human
-- nor QANDEEL could say a single ordinary thing in between.
--
-- I-07 must not close in that state, so the gap is closed here, inside the same
-- slice that created the phase's terminal lifecycle.
--
-- ===========================================================================
-- What changes, and what deliberately does NOT
-- ===========================================================================
--
-- 0090 anticipated exactly this. Its own header says the SCHEMA is not
-- Standard-only and that a later reviewed Introduction producer would compose
-- the same relations. This migration is that producer, and it is not a new one:
-- it REPLACES the two existing cores forward-only so the same primitives serve
-- both phases. There is no second material store, no second history model, no
-- Introduction-specific commit path and no parallel truth to reconcile later.
--
-- In each core exactly ONE gate changes:
--
--   before   ACTIVE and STANDARD, or refuse
--   after    ACTIVE, and then either STANDARD as before, or INTRODUCTION while
--            the Introduction Record for that exact World is still ACTIVE
--
-- and exactly one invariant is ADDED, on the Introduction branch alone: the
-- derived audience must be exactly two humans.
--
-- Everything else in both cores is preserved verbatim - the human actor from
-- auth.uid(), QANDEEL as a system actor that derives no human at all, the
-- World-row-first lock order, the durable request identity and its three
-- idempotency passes, the derived-never-supplied audience, the baseline
-- viewers, the required approvers, the I-03 privacy and readiness evidence
-- envelope, the dependency provenance and the historical-sharing authority.
-- ACTIVE / STANDARD behaviour is therefore unchanged, semantically and
-- textually: this file's own bodies differ from 0090's by that one gate, that
-- one added Introduction check, and their comments.
--
-- The Introduction envelope is the SAME as Standard or STRICTER. It is never
-- looser:
--
--   * no new privacy authority is granted merely because the phase is
--     INTRODUCTION - QANDEEL output still carries the exact same frozen I-03
--     effective-context, disclosure-gate, revalidation and readiness evidence
--   * no Matching Context Grant is transferred, consulted or implied
--   * no third member can exist, and a World that somehow shows one refuses
--   * the Introduction Record must still be live, which no Standard World is
--     ever asked for
--   * no application role gains EXECUTE on anything, here or anywhere
--
-- ===========================================================================
-- How this composes with the rest of I-07D
-- ===========================================================================
--
-- Nothing downstream needed changing, which is the strongest evidence that the
-- canonical model was the right one to extend:
--
--   VISIBILITY    0115's ACTIVE / INTRODUCTION branch resolves history items by
--                 the baseline-audience conjunction alone. It never filtered on
--                 material kind, so ordinary material becomes visible to exactly
--                 the two humans the moment it is committed, and an
--                 EXPLICIT_DISCLOSURE and a HUMAN_TEXT sit in ONE history.
--
--   END           0116 snapshots the closed view through that ONE canonical
--                 visibility entry point, so ordinary material is frozen into
--                 the Introduction closed-view entitlement automatically.
--
--   SUCCESS       0116 moves the World to STANDARD and touches no history at
--                 all, so the same material continues into ACTIVE / STANDARD
--                 with nothing copied, rewritten or re-derived.
--
--   RACES         both terminal cores take the World row first, exactly as
--                 these cores do, so commit-versus-END and commit-versus-SUCCESS
--                 serialize on it. Whichever commits first, the loser sees a
--                 World that is no longer ACTIVE / INTRODUCTION and there is no
--                 hybrid and no partial outcome.
--
--   DELETION      0115 already taught owner deletion the disclosure payload, and
--                 deletion was never phase-gated, so an author can delete their
--                 own Introduction material exactly as in a Standard World.
--
-- Migration 0090 is NOT edited. Its forward-safety section already required a
-- later Introduction producer to compose these relations without reopening it,
-- and its runtime verifier has been reconciled additively to prove the extended
-- cores still refuse everything 0090 owns.
--
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE HUMAN COMMIT CORE, FORWARD-EXTENDED.
--
--    Both typed entry points - commit_shared_world_human_text_v1 and
--    commit_shared_world_human_voice_note_v1 - delegate here and are NOT
--    replaced: they pin the material kind as a literal and hold no gate of
--    their own, so extending this core extends both of them and nothing else.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_shared_world_human_material_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
  p_material_kind text, p_body_text text, p_audio_object_ref text,
  p_transcript_text text, p_duration_ms integer
) RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                committed_history_item_id uuid, committed_material_kind text,
                audience_size integer, material_established_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_material_commit_commands;
  world public.shared_worlds;
  digest text;
  request text;
  form text;
  audience uuid[];
  actor_episode uuid;
  viewers integer;
  affected integer;
  commit_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_material_id IS NULL OR p_history_item_id IS NULL
     OR p_material_kind IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE EXACT BODY SHAPE OF EXACTLY ONE HUMAN KIND. A voice note without an
  -- audio object reference is a transcript, and a transcript must never
  -- masquerade as an original voice note (task section 14); a text body carrying
  -- media metadata is a different kind of confusion. Neither is representable.
  IF p_material_kind = 'HUMAN_TEXT' THEN
    form := 'TEXT';
    IF p_body_text IS NULL OR length(btrim(p_body_text)) = 0
       OR p_audio_object_ref IS NOT NULL OR p_transcript_text IS NOT NULL OR p_duration_ms IS NOT NULL THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    digest := 'sha256:' || encode(sha256(convert_to(p_body_text, 'UTF8')), 'hex');
  ELSIF p_material_kind = 'HUMAN_VOICE_NOTE' THEN
    form := 'VOICE_NOTE';
    IF p_audio_object_ref IS NULL OR length(btrim(p_audio_object_ref)) = 0 OR p_body_text IS NOT NULL
       OR (p_transcript_text IS NOT NULL AND length(btrim(p_transcript_text)) = 0)
       OR (p_duration_ms IS NOT NULL AND p_duration_ms <= 0) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    digest := 'sha256:' || encode(sha256(convert_to(
                p_audio_object_ref || E'\n' || coalesce(p_transcript_text, ''), 'UTF8')), 'hex');
  ELSE
    -- EXPLICIT_DISCLOSURE and WORLD_EVENT_DERIVED_MATERIAL are reserved in the
    -- envelope and have no producer here; QANDEEL kinds have their own core.
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE DURABLE REQUEST IDENTITY, which is a DIFFERENT concept from the body
  -- digest above: the body digest identifies the content, this identifies the
  -- whole immutable request. It binds every input that must not differ between a
  -- retry and the command it retries - the exact World, material, history item,
  -- kind, actor, body, media reference, transcript and DURATION, with presence
  -- distinguished from value so a NULL and a value can never fingerprint alike.
  --
  -- Duration matters here and nowhere else: it is real voice-note metadata that
  -- the body digest deliberately does not cover, so without this a retry naming
  -- the same audio and transcript but a DIFFERENT duration would have been
  -- accepted as equivalent.
  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_SHARED_MATERIAL_COMMIT_REQUEST_V1' || E'\n'
   || 'world=' || lower(p_world_id::text) || E'\n'
   || 'material=' || lower(p_material_id::text) || E'\n'
   || 'historyItem=' || lower(p_history_item_id::text) || E'\n'
   || 'kind=' || p_material_kind || E'\n'
   || 'producer=HUMAN' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'body=' || digest || E'\n'
   || 'audio=' || CASE WHEN p_audio_object_ref IS NULL THEN 'NONE'
        ELSE 'sha256:' || encode(sha256(convert_to(p_audio_object_ref, 'UTF8')), 'hex') END || E'\n'
   || 'transcript=' || CASE WHEN p_transcript_text IS NULL THEN 'NONE'
        ELSE 'sha256:' || encode(sha256(convert_to(p_transcript_text, 'UTF8')), 'hex') END || E'\n'
   || 'duration=' || CASE WHEN p_duration_ms IS NULL THEN 'NONE' ELSE p_duration_ms::text END || E'\n'
   || 'effectiveContext=NONE' || E'\n'
   || 'outputDigest=NONE' || E'\n'
   || 'sourceDisclosureGate=NONE' || E'\n'
   || 'authorityRevalidation=NONE' || E'\n'
   || 'readiness=NONE' || E'\n'
   || 'audienceSnapshot=NONE' || E'\n'
   || 'materialSources=' || E'\n'
   || 'reasoningSources=', 'UTF8')), 'hex');

  -- STEP 1. DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent
  -- retry of a command that already committed is answered even after the human
  -- has left, the World has closed or the owner has since deleted the body.
  -- Nothing on this path reads current membership, current World state or
  -- current availability: those are mutable, and a historical command must not
  -- start answering differently because of them.
  SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    -- EVERY immutable input must match, through the ONE durable request identity.
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
       AND committed.producer_kind = 'HUMAN' AND committed.request_ref = request THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_materials m
          JOIN public.shared_world_history_items i ON i.id = m.history_item_id
         WHERE m.id = committed.material_id AND m.world_id = committed.world_id
           AND m.history_item_id = committed.history_item_id
           AND m.material_kind = committed.material_kind AND m.producer_kind = 'HUMAN'
           AND m.author_user_id = committed.actor_user_id
           AND m.established_at = committed.committed_at
           AND i.occurred_at = committed.committed_at AND i.registered_at = committed.committed_at
           AND i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
           AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                        WHERE ra.history_item_id = i.id AND ra.approver_user_id = committed.actor_user_id)
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                          committed.history_item_id, committed.material_kind,
                          committed.baseline_viewer_count, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- STEP 2. CANONICAL LOCK ORDER, THE WORLD ROW FIRST. Every consequential
  -- material mutation starts here, which is what makes commit-versus-leave,
  -- commit-versus-topology and commit-versus-closure serialize rather than race.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 3. DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two
  -- concurrent equivalent commits serialize and the loser returns the committed
  -- result instead of attempting a second mutation.
  SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    -- EVERY immutable input must match, through the ONE durable request identity.
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
       AND committed.producer_kind = 'HUMAN' AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                          committed.history_item_id, committed.material_kind,
                          committed.baseline_viewer_count, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- STEP 4. ORDINARY MATERIAL IS ACTIVE, IN EITHER FROZEN PHASE. An archived
  -- World still blocks ordinary mutation (CW2-03 section 35 / C31). What changed
  -- is the paired World: I-04G refused it because it had no terminal transition
  -- to reason about, and I-07D gives it one, so the phase is now a BRANCH rather
  -- than a refusal. The Introduction branch is strictly the narrower of the two.
  IF world.lifecycle <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  ELSIF world.phase = 'INTRODUCTION' THEN
    -- An Introduction World carries ordinary communication only while its
    -- Introduction is actually LIVE. Both terminal outcomes move the World out
    -- of ACTIVE / INTRODUCTION under the very World row locked above - SUCCESS
    -- by taking it to STANDARD, END by closing it - so this is a coherence
    -- floor rather than a second lifecycle: it can only ever refuse a World
    -- whose phase and Record already disagree, and it fails closed when they do.
    IF NOT EXISTS (
      SELECT 1 FROM public.introduction_records r
       WHERE r.world_id = p_world_id AND r.introduction_status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
  ELSIF world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 5. THE ACTOR'S OWN EXACT OPEN EPISODE, from canonical state rather than
  -- from any parameter. One human cannot hold two open episodes in one World -
  -- the 0075 partial unique index forbids it - so fail closed rather than pick
  -- one if it is ever observed. A non-member reaches the same bounded answer as
  -- a caller naming a World that does not exist, so no future wrapper can become
  -- a membership oracle.
  SELECT count(*) INTO affected
    FROM public.shared_world_membership_episodes probe
   WHERE probe.world_id = p_world_id AND probe.user_id = u AND probe.ended_at IS NULL;
  IF affected > 1 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT e.id INTO actor_episode
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.user_id = u AND e.ended_at IS NULL;

  -- STEP 6 and 7. THE EXACT CURRENT HUMAN AUDIENCE, derived under the same World
  -- lock through the frozen I-03D audience boundary rather than re-implemented,
  -- and never accepted from a caller (CW2-02 section 44). This IS the original
  -- delivery audience that becomes the item's baseline viewers. An inert
  -- zero-human World therefore cannot commit at all, and a human who is not in
  -- the audience cannot commit into it.
  SELECT array_agg(a.user_id ORDER BY a.user_id) INTO audience
    FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a;
  IF audience IS NULL OR array_length(audience, 1) IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- AN INTRODUCTION IS EXACTLY TWO HUMANS. Nothing in the frozen lifecycle can
  -- add a third or remove one while the World is ACTIVE / INTRODUCTION: ordinary
  -- leave and governed membership are both Standard-only, and the terminal cores
  -- close BOTH episodes and the World together in one transaction. A different
  -- number is therefore an impossible state rather than an availability answer,
  -- and it fails closed here instead of silently delivering to the wrong people.
  IF world.phase = 'INTRODUCTION' AND array_length(audience, 1) <> 2 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  IF NOT (u = ANY(audience)) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- The two canonical readings of "who is currently in this World" must agree
  -- about this human's exact episode. They are the same underlying truth, so a
  -- disagreement is an impossible state rather than a refusal.
  IF NOT EXISTS (
    SELECT 1 FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a
     WHERE a.user_id = u AND a.membership_episode_id = actor_episode
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- STEP 8. THE ONE canonical establishment instant, read from the database
  -- clock exactly once and reused for every authoritative moment below.
  commit_instant := clock_timestamp();

  BEGIN
    -- STEP 9. The I-04F history identity FIRST, because the envelope, the
    -- audience and the authority all bind to it.
    INSERT INTO public.shared_world_history_items
      (id, world_id, occurred_at, authority_requirement_mode, availability_state,
       availability_revision, registered_at)
    VALUES (p_history_item_id, p_world_id, commit_instant, 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE',
            1, commit_instant);

    -- THE EXACT ORIGINAL HUMAN AUDIENCE. Derived, never supplied.
    INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id)
    SELECT p_history_item_id, v.member FROM unnest(audience) AS v(member);
    GET DIAGNOSTICS viewers = ROW_COUNT;
    IF viewers <> array_length(audience, 1) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE EXACT HUMAN MATERIAL AUTHORITY: the author, and only the author.
    -- Membership never creates co-ownership of another human's material.
    INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)
    VALUES (p_history_item_id, u);

    INSERT INTO public.shared_world_materials
      (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
    VALUES (p_material_id, p_world_id, p_history_item_id, p_material_kind, 'HUMAN', form, u, commit_instant);

    IF form = 'TEXT' THEN
      INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text)
      VALUES (p_material_id, 'TEXT', p_body_text);
    ELSE
      INSERT INTO public.shared_world_voice_note_material_bodies
        (material_id, body_form, audio_object_ref, transcript_text, duration_ms)
      VALUES (p_material_id, 'VOICE_NOTE', p_audio_object_ref, p_transcript_text, p_duration_ms);
    END IF;

    -- PROVENANCE. A human statement made in this World establishes its own
    -- truth: there is no source material and no source context. The surrogate
    -- identity is generated rather than supplied because this row's identity is
    -- the partial unique index on its target, not a retry key.
    INSERT INTO public.shared_world_material_dependencies
      (id, world_id, dependency_kind, target_material_id, target_established_at)
    VALUES (gen_random_uuid(), p_world_id, 'INDEPENDENT_TARGET_TRUTH', p_material_id, commit_instant);

    -- HISTORICAL-SHARING AUTHORITY. A human's own material has exactly one human
    -- authority and it is known: themselves. Nothing about it is unresolved.
    INSERT INTO public.shared_world_material_historical_authority
      (material_id, world_id, history_item_id, resolution_state)
    VALUES (p_material_id, p_world_id, p_history_item_id, 'RESOLVED_EXACT_HUMAN_REQUIREMENT');

    INSERT INTO public.shared_world_material_commit_commands
      (id, world_id, material_id, history_item_id, material_kind, producer_kind, actor_user_id,
       body_digest, request_ref, baseline_viewer_count, committed_at)
    VALUES (p_command_id, p_world_id, p_material_id, p_history_item_id, p_material_kind, 'HUMAN', u,
            digest, request, viewers, commit_instant);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS. Two equivalent commits by the same human
    -- always serialize on the World row above, but two commands sharing a
    -- command id while resolving to DIFFERENT humans do not, and this conflict
    -- is their only serialization point. So durable history is consulted before
    -- any conflict is classified.
    SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id = u AND committed.world_id = p_world_id
         AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
         AND committed.producer_kind = 'HUMAN' AND committed.request_ref = request THEN
        RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                            committed.history_item_id, committed.material_kind,
                            committed.baseline_viewer_count, committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken. The whole transaction
    -- rolls back together, so a refused commit never leaves half a material, a
    -- history item without its audience, or an item without its authority.
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, p_command_id, p_world_id, p_material_id,
                      p_history_item_id, p_material_kind, viewers, commit_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 2. THE QANDEEL COMMIT CORE, FORWARD-EXTENDED.
--
--    QANDEEL remains a SYSTEM actor here. It derives no human, holds no
--    consent principal and gains no authority from the phase: an Introduction
--    output must carry the same exact I-03 evidence a Standard output carries.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_shared_world_qandeel_material_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
  p_material_kind text, p_body_text text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_reasoning_source_refs text[]
) RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                committed_history_item_id uuid, committed_material_kind text,
                audience_size integer, authority_size integer,
                material_dependency_edges integer, reasoning_dependency_edges integer,
                material_established_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.shared_world_material_commit_commands;
  world public.shared_worlds;
  digest text;
  request text;
  recomputed_readiness text;
  current_audience_ref text;
  audience uuid[];
  sources uuid[];
  reasoning text[];
  viewers integer;
  approvers integer;
  material_edges integer;
  reasoning_edges integer;
  affected integer;
  authority_mode text;
  authority_resolution text;
  db_material_edges integer;
  db_reasoning_edges integer;
  commit_instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_material_id IS NULL OR p_history_item_id IS NULL
     OR p_material_kind IS NULL OR p_body_text IS NULL OR length(btrim(p_body_text)) = 0 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_material_kind NOT IN ('QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS') THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_effective_context_ref IS NULL OR p_output_digest IS NULL OR p_source_disclosure_gate_ref IS NULL
     OR p_authority_revalidation_ref IS NULL OR p_readiness_ref IS NULL OR p_audience_snapshot_ref IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_EVIDENCE_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE EVIDENCE BINDS THESE EXACT BYTES. The supplied output digest must be the
  -- digest of the exact body being committed, computed with the same convention
  -- the frozen I-03F digestProviderOutput uses, so evidence produced for another
  -- output cannot be presented for this one.
  digest := 'sha256:' || encode(sha256(convert_to(p_body_text, 'UTF8')), 'hex');
  IF p_output_digest <> digest THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_EVIDENCE_INVALID' USING ERRCODE='22023';
  END IF;
  -- AND THE READINESS REFERENCE IS RECOMPUTED, not trusted: it must be exactly
  -- the I-03G readiness fingerprint over its own four parts. A readiness
  -- reference that does not derive from the gate and revalidation it claims is
  -- not evidence of anything.
  recomputed_readiness := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1' || E'\n'
      || 'effectiveContext=' || p_effective_context_ref || E'\n'
      || 'output=' || p_output_digest || E'\n'
      || 'sourceDisclosureGate=' || p_source_disclosure_gate_ref || E'\n'
      || 'authorityRevalidation=' || p_authority_revalidation_ref, 'UTF8')), 'hex');
  IF p_readiness_ref <> recomputed_readiness THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_EVIDENCE_INVALID' USING ERRCODE='22023';
  END IF;

  -- The two dependency selections are exact SETS. A repeated identity is refused
  -- rather than silently folded, and a NULL member is malformed.
  sources := coalesce(p_material_source_ids, ARRAY[]::uuid[]);
  reasoning := coalesce(p_reasoning_source_refs, ARRAY[]::text[]);
  IF array_position(sources, NULL::uuid) IS NOT NULL OR array_position(reasoning, NULL::text) IS NOT NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  material_edges := coalesce(array_length(sources, 1), 0);
  reasoning_edges := coalesce(array_length(reasoning, 1), 0);
  IF (SELECT count(DISTINCT s.item) FROM unnest(sources) AS s(item)) <> material_edges
     OR (SELECT count(DISTINCT r.item) FROM unnest(reasoning) AS r(item)) <> reasoning_edges THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_material_id = ANY(sources) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- THE DURABLE REQUEST IDENTITY. It binds EVERY immutable input of this exact
  -- request: the World, the material and history identities, the kind, the exact
  -- body, all five I-03 evidence references, the exact audience snapshot the
  -- output was generated for, and BOTH dependency sets in canonical order. Set
  -- ORDER therefore cannot change identity while set CONTENT always does, and a
  -- retry that alters any of them is a conflict rather than an equivalence.
  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_SHARED_MATERIAL_COMMIT_REQUEST_V1' || E'\n'
   || 'world=' || lower(p_world_id::text) || E'\n'
   || 'material=' || lower(p_material_id::text) || E'\n'
   || 'historyItem=' || lower(p_history_item_id::text) || E'\n'
   || 'kind=' || p_material_kind || E'\n'
   || 'producer=QANDEEL' || E'\n'
   || 'actor=NONE' || E'\n'
   || 'body=' || digest || E'\n'
   || 'audio=NONE' || E'\n'
   || 'transcript=NONE' || E'\n'
   || 'duration=NONE' || E'\n'
   || 'effectiveContext=' || p_effective_context_ref || E'\n'
   || 'outputDigest=' || p_output_digest || E'\n'
   || 'sourceDisclosureGate=' || p_source_disclosure_gate_ref || E'\n'
   || 'authorityRevalidation=' || p_authority_revalidation_ref || E'\n'
   || 'readiness=' || p_readiness_ref || E'\n'
   || 'audienceSnapshot=' || p_audience_snapshot_ref || E'\n'
   || 'materialSources=' || coalesce((SELECT string_agg(lower(s.item::text), ','
        ORDER BY lower(s.item::text) COLLATE "C") FROM unnest(sources) AS s(item)), '') || E'\n'
   || 'reasoningSources=' || coalesce((SELECT string_agg(r.item, ','
        ORDER BY r.item COLLATE "C") FROM unnest(reasoning) AS r(item)), ''),
      'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    -- EVERY immutable input must match, through the ONE durable request identity:
    -- body, every I-03 evidence reference, the exact audience snapshot and both
    -- exact dependency sets are all inside it.
    IF committed.actor_user_id IS NULL AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
       AND committed.producer_kind = 'QANDEEL' AND committed.request_ref = request THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_materials m
          JOIN public.shared_world_history_items i ON i.id = m.history_item_id
          JOIN public.shared_world_qandeel_material_evidence ev ON ev.material_id = m.id
         WHERE m.id = committed.material_id AND m.world_id = committed.world_id
           AND m.history_item_id = committed.history_item_id
           AND m.material_kind = committed.material_kind AND m.producer_kind = 'QANDEEL'
           AND m.author_user_id IS NULL AND m.established_at = committed.committed_at
           AND i.occurred_at = committed.committed_at AND i.registered_at = committed.committed_at
           AND ev.readiness_ref = p_readiness_ref AND ev.output_digest = digest
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      -- EVERY count in a retry answer comes from COMMITTED truth, never from the
      -- arrays this retry happened to pass in.
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_item_required_approvers ra
       WHERE ra.history_item_id = committed.history_item_id;
      SELECT count(*) FILTER (WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY')::integer,
             count(*) FILTER (WHERE d.dependency_kind = 'REASONING_DEPENDENCY')::integer
        INTO db_material_edges, db_reasoning_edges
        FROM public.shared_world_material_dependencies d
       WHERE d.target_material_id = committed.material_id;
      RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                          committed.history_item_id, committed.material_kind,
                          committed.baseline_viewer_count, approvers, db_material_edges, db_reasoning_edges,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, THE WORLD ROW FIRST.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock.
  SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    -- EVERY immutable input must match, through the ONE durable request identity:
    -- body, every I-03 evidence reference, the exact audience snapshot and both
    -- exact dependency sets are all inside it.
    IF committed.actor_user_id IS NULL AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
       AND committed.producer_kind = 'QANDEEL' AND committed.request_ref = request THEN
      -- EVERY count in a retry answer comes from COMMITTED truth, never from the
      -- arrays this retry happened to pass in.
      SELECT count(*)::integer INTO approvers
        FROM public.shared_world_history_item_required_approvers ra
       WHERE ra.history_item_id = committed.history_item_id;
      SELECT count(*) FILTER (WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY')::integer,
             count(*) FILTER (WHERE d.dependency_kind = 'REASONING_DEPENDENCY')::integer
        INTO db_material_edges, db_reasoning_edges
        FROM public.shared_world_material_dependencies d
       WHERE d.target_material_id = committed.material_id;
      RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                          committed.history_item_id, committed.material_kind,
                          committed.baseline_viewer_count, approvers, db_material_edges, db_reasoning_edges,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  IF world.lifecycle <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  ELSIF world.phase = 'INTRODUCTION' THEN
    -- An Introduction World carries ordinary communication only while its
    -- Introduction is actually LIVE. Both terminal outcomes move the World out
    -- of ACTIVE / INTRODUCTION under the very World row locked above - SUCCESS
    -- by taking it to STANDARD, END by closing it - so this is a coherence
    -- floor rather than a second lifecycle: it can only ever refuse a World
    -- whose phase and Record already disagree, and it fails closed when they do.
    IF NOT EXISTS (
      SELECT 1 FROM public.introduction_records r
       WHERE r.world_id = p_world_id AND r.introduction_status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
  ELSIF world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact dependency sources, in deterministic
  -- identity order, so a concurrent owner deletion of a source serializes here
  -- rather than racing this commit.
  IF material_edges > 0 THEN
    PERFORM 1 FROM public.shared_world_materials m
      WHERE m.id = ANY(sources) ORDER BY m.id FOR UPDATE;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> material_edges THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    -- EVERY SOURCE PRE-EXISTS, BELONGS TO THIS EXACT WORLD AND IS STILL
    -- AVAILABLE. A deleted or invalidated source can never acquire a new
    -- source-content-bearing derivative.
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id
       WHERE m.id = ANY(sources)
         AND (m.world_id <> p_world_id OR i.availability_state <> 'AVAILABLE')
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_STALE' USING ERRCODE='40001';
    END IF;
    -- AUTHORITY METADATA IS EXACT, IN BOTH DIRECTIONS, OR IT FAILS CLOSED. This
    -- is the frozen I-04F rule: missing or contradictory authority metadata is
    -- never interpreted as approval-free.
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id
       WHERE m.id = ANY(sources)
         AND ((i.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'
               AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                                WHERE ra.history_item_id = i.id))
           OR (i.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'
               AND EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers ra
                            WHERE ra.history_item_id = i.id)))
    ) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
  END IF;

  -- THE DERIVED REQUIRED APPROVER SET: the exact UNION of the human material
  -- authorities of the MATERIAL_DEPENDENCY sources, and nothing else. Never
  -- World membership, never the current audience, never a caller-supplied list,
  -- and never anything a REASONING_DEPENDENCY contributed.
  SELECT count(DISTINCT ra.approver_user_id)::integer INTO approvers
    FROM public.shared_world_materials m
    JOIN public.shared_world_history_item_required_approvers ra ON ra.history_item_id = m.history_item_id
   WHERE m.id = ANY(sources);
  -- HISTORICAL-SHARING AUTHORITY RESOLUTION. A reasoning dependency propagates no
  -- material consent and never turns its grantor into an approver - but it DOES
  -- mean a protected human subject may be implicated whose authority this
  -- repository cannot yet resolve. Unknown is recorded as unknown, never as a
  -- known-empty requirement, and known MATERIAL_DEPENDENCY owners do not resolve
  -- the whole requirement on their own.
  authority_resolution := CASE
    WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
    WHEN approvers > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
    ELSE 'RESOLVED_NO_HUMAN_REQUIREMENT' END;
  -- NO_HUMAN_APPROVAL_REQUIRED is written ONLY for a genuinely resolved empty
  -- requirement. Anything unresolved keeps the exact-approver mode, so the frozen
  -- I-04F package path can never read it as approval-free, and the widening gate
  -- above refuses it outright.
  authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'
    THEN 'NO_HUMAN_APPROVAL_REQUIRED' ELSE 'EXACT_HUMAN_APPROVER_SET' END;

  -- THE EXACT CURRENT HUMAN AUDIENCE, derived under the World lock, together with
  -- its canonical I-03D snapshot fingerprint - the SAME rows serve both, so there
  -- is exactly one audience meaning here.
  SELECT array_agg(a.user_id ORDER BY a.user_id),
         'sha256:' || encode(sha256(convert_to(
             'QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1' || E'\n'
          || 'state=RESOLVED' || E'\n'
          || 'world=' || lower(p_world_id::text) || E'\n'
          || 'members=' || coalesce(string_agg(
                 lower(a.user_id::text) || '@' || lower(a.membership_episode_id::text), ','
                 ORDER BY lower(a.user_id::text) COLLATE "C",
                          lower(a.membership_episode_id::text) COLLATE "C"), ''),
             'UTF8')), 'hex')
    INTO audience, current_audience_ref
    FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a;
  IF audience IS NULL OR array_length(audience, 1) IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  -- AN INTRODUCTION IS EXACTLY TWO HUMANS. Nothing in the frozen lifecycle can
  -- add a third or remove one while the World is ACTIVE / INTRODUCTION: ordinary
  -- leave and governed membership are both Standard-only, and the terminal cores
  -- close BOTH episodes and the World together in one transaction. A different
  -- number is therefore an impossible state rather than an availability answer,
  -- and it fails closed here instead of silently delivering to the wrong people.
  IF world.phase = 'INTRODUCTION' AND array_length(audience, 1) <> 2 THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- STALE AUDIENCE EVIDENCE REFUSES THE COMMIT. The output was generated and
  -- revalidated for one exact audience; if the World's membership has moved since,
  -- that proof is about a different audience and this commit must not silently
  -- deliver to the new one.
  --
  -- The fingerprint is per (user, EPISODE), so a leave followed by the same
  -- human's rejoin stales it even though the human SET is identical - which is
  -- correct: the absent interval is real, and the new episode is a new membership.
  -- Because the fingerprint also carries the exact World, evidence generated for
  -- another World can never satisfy this either.
  IF p_audience_snapshot_ref <> current_audience_ref THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_STALE' USING ERRCODE='40001';
  END IF;

  -- THE ONE canonical establishment instant.
  commit_instant := clock_timestamp();

  BEGIN
    INSERT INTO public.shared_world_history_items
      (id, world_id, occurred_at, authority_requirement_mode, availability_state,
       availability_revision, registered_at)
    VALUES (p_history_item_id, p_world_id, commit_instant, authority_mode, 'AVAILABLE', 1, commit_instant);

    INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id)
    SELECT p_history_item_id, v.member FROM unnest(audience) AS v(member);
    GET DIAGNOSTICS viewers = ROW_COUNT;
    IF viewers <> array_length(audience, 1) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)
    SELECT DISTINCT p_history_item_id, ra.approver_user_id
      FROM public.shared_world_materials m
      JOIN public.shared_world_history_item_required_approvers ra ON ra.history_item_id = m.history_item_id
     WHERE m.id = ANY(sources);
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> approvers THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.shared_world_materials
      (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
    VALUES (p_material_id, p_world_id, p_history_item_id, p_material_kind, 'QANDEEL', 'TEXT', NULL, commit_instant);

    INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text)
    VALUES (p_material_id, 'TEXT', p_body_text);

    INSERT INTO public.shared_world_qandeel_material_evidence
      (material_id, world_id, readiness_state, readiness_ref, effective_context_ref, output_digest,
       source_disclosure_gate_ref, authority_revalidation_ref, audience_snapshot_ref)
    VALUES (p_material_id, p_world_id, 'READY_FOR_LATER_DELIVERY_GATES', p_readiness_ref,
            p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref,
            p_authority_revalidation_ref, p_audience_snapshot_ref);

    -- PROVENANCE. Each kind keeps its own exact meaning. The source instant is
    -- carried so the strict source-precedes-target constraint of migration 0089
    -- makes a dependency cycle unrepresentable.
    IF material_edges > 0 THEN
      INSERT INTO public.shared_world_material_dependencies
        (id, world_id, dependency_kind, target_material_id, target_established_at,
         source_material_id, source_established_at)
      SELECT gen_random_uuid(), p_world_id, 'MATERIAL_DEPENDENCY', p_material_id, commit_instant,
             m.id, m.established_at
        FROM public.shared_world_materials m WHERE m.id = ANY(sources);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> material_edges THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;
    IF reasoning_edges > 0 THEN
      -- An opaque server-owned context reference, never raw private content:
      -- authorized private context influenced reasoning and was NOT copied here.
      INSERT INTO public.shared_world_material_dependencies
        (id, world_id, dependency_kind, target_material_id, target_established_at, source_context_ref)
      SELECT gen_random_uuid(), p_world_id, 'REASONING_DEPENDENCY', p_material_id, commit_instant, r.item
        FROM unnest(reasoning) AS r(item);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> reasoning_edges THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;
    IF material_edges = 0 AND reasoning_edges = 0 THEN
      INSERT INTO public.shared_world_material_dependencies
        (id, world_id, dependency_kind, target_material_id, target_established_at)
      VALUES (gen_random_uuid(), p_world_id, 'INDEPENDENT_TARGET_TRUTH', p_material_id, commit_instant);
    END IF;

    INSERT INTO public.shared_world_material_historical_authority
      (material_id, world_id, history_item_id, resolution_state)
    VALUES (p_material_id, p_world_id, p_history_item_id, authority_resolution);

    INSERT INTO public.shared_world_material_commit_commands
      (id, world_id, material_id, history_item_id, material_kind, producer_kind, actor_user_id,
       body_digest, request_ref, baseline_viewer_count, committed_at)
    VALUES (p_command_id, p_world_id, p_material_id, p_history_item_id, p_material_kind, 'QANDEEL', NULL,
            digest, request, viewers, commit_instant);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id IS NULL AND committed.world_id = p_world_id
         AND committed.material_id = p_material_id AND committed.history_item_id = p_history_item_id
         AND committed.producer_kind = 'QANDEEL' AND committed.request_ref = request THEN
        -- EVERY count in a retry answer comes from COMMITTED truth, never from the
        -- arrays this retry happened to pass in.
        SELECT count(*)::integer INTO approvers
          FROM public.shared_world_history_item_required_approvers ra
         WHERE ra.history_item_id = committed.history_item_id;
        SELECT count(*) FILTER (WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY')::integer,
               count(*) FILTER (WHERE d.dependency_kind = 'REASONING_DEPENDENCY')::integer
          INTO db_material_edges, db_reasoning_edges
          FROM public.shared_world_material_dependencies d
         WHERE d.target_material_id = committed.material_id;
        RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, committed.id, committed.world_id, committed.material_id,
                            committed.history_item_id, committed.material_kind,
                            committed.baseline_viewer_count, approvers, db_material_edges, db_reasoning_edges,
                            committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken, or this exact I-03
    -- readiness already committed its one material. Evidence is not replayable.
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, p_command_id, p_world_id, p_material_id,
                      p_history_item_id, p_material_kind, viewers, approvers,
                      material_edges, reasoning_edges, commit_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 3. OWNERSHIP AND ACLS, RE-ASSERTED.
--
--    CREATE OR REPLACE preserves both, so these statements change nothing. They
--    are written anyway so this file states the posture it depends on instead of
--    inheriting it silently.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.commit_shared_world_human_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, integer) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.commit_shared_world_human_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Terminal self-assertions, and THE PHASE-CLOSING CONTRACTS, RE-ASSERTED.
--
--    This migration is the new tip of the I-07D chain, so it re-asserts the
--    phase-closing contracts migration 0117 made at the old tip as well as its
--    own. A tip contract that a later migration silently outranks is not a
--    contract, so they are restated here rather than assumed.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  human_fn constant text := 'public.commit_shared_world_human_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, integer)';
  qandeel_fn constant text := 'public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[])';
  target_fn text;
  target_role text;
  body text;
  p record;
BEGIN
  -- THE TWO CORES ARE FORWARD-EXTENDED, NOT WIDENED. Every clause below must
  -- hold in BOTH, because a gate that exists in one core and not the other is
  -- exactly the hole this migration was written to close.
  FOREACH target_fn IN ARRAY ARRAY[human_fn, qandeel_fn] LOOP
    SELECT pr.prosrc, pr.proowner::regrole::text AS owner, pr.prosecdef, pr.provolatile, pr.proconfig
      INTO p FROM pg_proc pr WHERE pr.oid = target_fn::regprocedure;
    IF NOT FOUND THEN RAISE EXCEPTION 'I-07D: % must exist', target_fn; END IF;
    body := p.prosrc;

    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-07D: % must be owned by postgres', target_fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-07D: % must be SECURITY DEFINER', target_fn; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-07D: % mutates and must be VOLATILE', target_fn; END IF;
    IF NOT coalesce(p.proconfig @> ARRAY['search_path=']
                 OR p.proconfig @> ARRAY['search_path=""'], false) THEN
      RAISE EXCEPTION 'I-07D: % must pin an empty search_path', target_fn;
    END IF;

    -- A CLOSED OR ARCHIVED WORLD IS STILL REFUSED. The lifecycle was never the
    -- thing under review and it is still an unconditional gate.
    IF body !~ 'IF world\.lifecycle <> ''ACTIVE'' THEN' THEN
      RAISE EXCEPTION 'I-07D: % must still refuse every World that is not ACTIVE, before it considers any phase', target_fn;
    END IF;
    -- A PHASE OUTSIDE THE TWO FROZEN ONES IS STILL REFUSED, so a future mode
    -- inherits nothing by default.
    IF body !~ 'ELSIF world\.phase <> ''STANDARD'' THEN' THEN
      RAISE EXCEPTION 'I-07D: % must still refuse every World mode outside STANDARD and INTRODUCTION', target_fn;
    END IF;
    -- THE INTRODUCTION BRANCH IS THE NARROWER ONE: it additionally requires a
    -- live Introduction Record for that exact World, which no Standard World is
    -- ever asked for.
    IF body !~ 'ELSIF world\.phase = ''INTRODUCTION'' THEN'
       OR body !~ 'FROM public\.introduction_records r'
       OR body !~ 'r\.world_id = p_world_id AND r\.introduction_status = ''ACTIVE''' THEN
      RAISE EXCEPTION 'I-07D: % may admit an Introduction World only while its exact Introduction Record is still ACTIVE', target_fn;
    END IF;
    -- AND AN INTRODUCTION IS EXACTLY TWO HUMANS.
    IF body !~ 'IF world\.phase = ''INTRODUCTION'' AND array_length\(audience, 1\) <> 2 THEN' THEN
      RAISE EXCEPTION 'I-07D: % must refuse an Introduction World whose derived audience is not exactly the two matched humans', target_fn;
    END IF;

    -- THE 0090 POSTURE IS UNCHANGED, PROVEN CLAUSE BY CLAUSE rather than
    -- assumed from the fact that this file was generated from 0090's text.
    IF body ~* 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-07D: % deletes nothing: committing destroys nothing', target_fn;
    END IF;
    IF body ~ 'UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
      RAISE EXCEPTION 'I-07D: % creates, closes and mutates no Shared World', target_fn;
    END IF;
    IF body ~ 'INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes' THEN
      RAISE EXCEPTION 'I-07D: % creates and mutates no membership episode', target_fn;
    END IF;
    IF body ~ 'UPDATE public\.introduction_records|INSERT INTO public\.introduction_records' THEN
      RAISE EXCEPTION 'I-07D: % reads the Introduction Record and never moves it: ordinary material is not a lifecycle act', target_fn;
    END IF;
    IF body ~ 'shared_world_history_access_grants|shared_world_standard_closed_view_entitlements|introduction_closed_view_entitlements' THEN
      RAISE EXCEPTION 'I-07D: % writes no history grant and no closed-World entitlement', target_fn;
    END IF;
    IF body ~ 'matching_context_grants|matching_active_introduction_claims|introduction_terminal_commits' THEN
      RAISE EXCEPTION 'I-07D: % consults no Matching authority: speaking in an Introduction is not a Matching act', target_fn;
    END IF;
    IF body ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-07D: % must persist one database-owned instant, never a transaction clock', target_fn;
    END IF;
    IF body ~* 'pg_advisory|LOCK TABLE' THEN
      RAISE EXCEPTION 'I-07D: % takes only canonical row locks', target_fn;
    END IF;
    IF body !~ 'FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE' THEN
      RAISE EXCEPTION 'I-07D: % must still lock the exact World row FIRST', target_fn;
    END IF;
    -- THE AUDIENCE IS STILL DERIVED THROUGH THE FROZEN I-03D BOUNDARY, never
    -- re-implemented and never accepted from a caller.
    IF body !~ 'public\.resolve_shared_world_human_audience_snapshot_v1\(p_world_id\)' THEN
      RAISE EXCEPTION 'I-07D: % must derive its audience through the frozen I-03D boundary', target_fn;
    END IF;
    -- AND NO APPLICATION ROLE MAY REACH EITHER CORE.
    IF has_function_privilege('public', target_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-07D: PUBLIC must not execute %', target_fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, target_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-07D: % must not execute % before the CW2-08 Launch Gate exists', target_role, target_fn;
      END IF;
    END LOOP;
  END LOOP;

  -- THE HUMAN ACTOR IS STILL THE SESSION SUBJECT, AND QANDEEL IS STILL NOT ONE.
  SELECT pr.prosrc INTO body FROM pg_proc pr WHERE pr.oid = human_fn::regprocedure;
  IF body !~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-07D: the human commit core must still derive its human from auth.uid()';
  END IF;
  SELECT pr.prosrc INTO body FROM pg_proc pr WHERE pr.oid = qandeel_fn::regprocedure;
  IF body ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-07D: the QANDEEL commit core derives no human: a system actor is never a consent or ownership principal, in either phase';
  END IF;
  IF body !~ 'WHEN reasoning_edges > 0 THEN ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'I-07D: the QANDEEL commit core must still record an unresolvable additional human requirement as unresolved';
  END IF;

  -- THE TWO TYPED HUMAN ENTRY POINTS STILL DELEGATE HERE AND HOLD NO GATE OF
  -- THEIR OWN, which is what makes replacing the core sufficient.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public'
         AND pr.proname IN ('commit_shared_world_human_text_v1', 'commit_shared_world_human_voice_note_v1')
         AND pr.prosrc ~ 'public\.commit_shared_world_human_material_v1'
         AND pr.prosrc !~ 'world\.phase|world\.lifecycle') <> 2 THEN
    RAISE EXCEPTION 'I-07D: both typed human entry points must still delegate to the ONE core and hold no lifecycle gate of their own';
  END IF;

  -- ONE CANONICAL SHARED TRUTH MODEL. This is the load-bearing architectural
  -- claim of this migration: the Introduction did not get a material system of
  -- its own. Exactly three reviewed producers write a Shared material and its
  -- history item, and they are the same three before and after this file.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'INSERT INTO public\.shared_world_materials\y') <> 3 THEN
    RAISE EXCEPTION 'I-07D: exactly three reviewed producers may write a Shared material: the human core, the QANDEEL core and the one disclosure producer';
  END IF;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'INSERT INTO public\.shared_world_history_items\y') <> 3 THEN
    RAISE EXCEPTION 'I-07D: exactly three reviewed producers may write a Shared history item, and they are the same three that write a material';
  END IF;
  -- AND NO PARALLEL BODY STORE WAS INVENTED BESIDE THEM.
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND c.relname ~ '^shared_world_.*_material_bodies$') <> 2 THEN
    RAISE EXCEPTION 'I-07D: the two frozen body relations must remain the only Shared material body stores';
  END IF;

  -- ===========================================================================
  -- THE PHASE-CLOSING CONTRACTS, RE-ASSERTED AT THE NEW TIP OF THE CHAIN.
  -- ===========================================================================

  -- 0113 / 0116: EXACTLY THE TWO REVIEWED TERMINAL CORES REACH A TERMINAL
  -- OUTCOME AND RELEASE A CLAIM.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'INSERT INTO public\.introduction_terminal_commits') <> 2 THEN
    RAISE EXCEPTION 'I-07D: exactly the two reviewed terminal cores may write a terminal commit';
  END IF;

  -- 0089 / 0115: EXACTLY ONE PRODUCER WRITES THE RESERVED EXPLICIT_DISCLOSURE
  -- MATERIAL. Extending the ordinary cores must not have given them the
  -- reserved kind by accident.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ '''EXPLICIT_DISCLOSURE'''
         AND pr.prosrc ~ 'INSERT INTO public\.shared_world_materials\y') <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly one reviewed producer may write an EXPLICIT_DISCLOSURE material';
  END IF;

  -- 0087 / 0088 / 0115: THERE IS STILL EXACTLY ONE HISTORICAL VISIBILITY ENTRY
  -- POINT, and the closed reader is still reachable by nobody.
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

  -- 0090 / 0115: OWNER DELETION IS STILL THE ONLY THING THAT DESTROYS SOURCE
  -- CONTENT, and it still destroys only bodies and disclosure payloads.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND (pr.prosrc ~ 'DELETE FROM public\.shared_world_text_material_bodies'
           OR pr.prosrc ~ 'DELETE FROM public\.shared_world_voice_note_material_bodies'
           OR pr.prosrc ~ 'DELETE FROM public\.introduction_disclosure_text_payloads'
           OR pr.prosrc ~ 'DELETE FROM public\.introduction_disclosure_media_payloads')) <> 1 THEN
    RAISE EXCEPTION 'I-07D: exactly the one canonical owner-deletion primitive may destroy a material body or a disclosure payload';
  END IF;

  -- THE THREE FAIL-CLOSED SEAMS I-07D OWNS ALL STILL ANSWER NOT_EVALUATED, and
  -- END still consults none of them. Committing ordinary material consults none
  -- of them either: it is gated by the Shared envelope, not by a launch seam.
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

  -- AND NO APPLICATION ROLE HOLDS EXECUTE ON ANY I-07D CONSEQUENTIAL BOUNDARY.
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
