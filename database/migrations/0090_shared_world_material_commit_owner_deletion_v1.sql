-- I-04G - Shared Material Commit Runtime and Owner Deletion v1 (PART B).
--
-- Migration 0089 created the material envelope, its normalized bodies and its
-- provenance relation. This migration creates the only things that ever write
-- them, and the only thing that ever destroys a body.
--
-- ===========================================================================
-- What a material commit IS
-- ===========================================================================
--
-- ONE transaction that either produces all of this or none of it:
--
--   the material envelope
--   + its normalized body
--   + the I-04F history item that IS its Shared identity
--   + that item's EXACT original human audience (baseline viewers)
--   + that item's EXACT human material authorities (required approvers)
--   + its provenance record
--   + the durable command that answers an equivalent retry
--
-- There is no second history model and no second audience model: migration
-- 0087's projection is populated here, not duplicated. A caller may not supply
-- baseline viewers, an approver, an episode, a count or an instant - every one
-- of those is derived from canonical state under the World lock, or read once
-- from the database clock (task sections 8, 9, 10).
--
-- ===========================================================================
-- ONE database-owned establishment instant
-- ===========================================================================
--
-- `clock_timestamp()` is read EXACTLY ONCE per committed transaction and is
-- written to every authoritative moment that transaction creates:
--
--   shared_world_materials.established_at
--   shared_world_history_items.occurred_at
--   shared_world_history_items.registered_at
--   shared_world_material_commit_commands.committed_at
--
-- No caller supplies it, and no second clock is read. A recalled or
-- source-event time is a DIFFERENT thing and belongs to provenance semantics:
-- migration 0087 deployed that rule as a COMMENT ON COLUMN precisely so the
-- slice that finally writes `occurred_at` - this one - meets it in the catalog.
--
-- ===========================================================================
-- Material authority: who must approve, and who may never
-- ===========================================================================
--
-- HUMAN_TEXT / HUMAN_VOICE_NOTE
--   authority_requirement_mode = EXACT_HUMAN_APPROVER_SET
--   required approver          = the exact human author, and only them
--
--   Membership does not co-own another participant's material (CW2-02 section
--   25, B21). Every other current member is a baseline VIEWER, which is a
--   different relation and a different meaning.
--
-- QANDEEL_OUTPUT / QANDEEL_ANALYSIS
--   required approver set = the exact UNION of the human material authorities
--                           of its MATERIAL_DEPENDENCY sources
--   empty union           = NO_HUMAN_APPROVAL_REQUIRED, written explicitly
--
--   It is never "every World member" (CW2-02 section 26, B27). A
--   REASONING_DEPENDENCY contributes NOTHING to it: authorized private context
--   influencing reasoning was never material consent (CW2-02 section 19, B14),
--   and this is the one place that distinction could have been quietly lost.
--
--   Section 9 of the task also admits a SECOND source for that union - exact
--   protected-human subject authorities produced by an already-reviewed
--   server-owned authority source - IF such a canonical source exists. In this
--   repository it does not: the whole I-03 chain terminates at
--   `materialDisclosureAuthority: NOT_GRANTED` and `provenanceDisclosure:
--   SEALED`, and produces no protected-subject authority set at all. Accepting
--   one as a parameter would be exactly the "app/client supplies final
--   authority claims" that section 9 forbids, so this slice derives from
--   dependencies alone and leaves the second contributor to the reviewed slice
--   that first builds a real source for it.
--
--   Missing or contradictory authority metadata NEVER means empty: a source
--   whose own item claims EXACT_HUMAN_APPROVER_SET with no approver, or
--   NO_HUMAN_APPROVAL_REQUIRED while carrying one, fails the commit closed -
--   the same fail-closed rule migration 0087 applies to a package.
--
-- ===========================================================================
-- The QANDEEL core is unreachable, and its evidence is not a clearance
-- ===========================================================================
--
-- CW2-08 Safety / moderation / entitlement / Launch Gate is unimplemented, so
-- the QANDEEL commit core is executable by NO application role - PUBLIC, anon,
-- authenticated and service_role alike. It binds the exact I-03 operation
-- evidence of the output it is committing, and binds it to the exact BYTES: the
-- supplied output digest must equal the digest of the exact body, and the
-- supplied readiness reference must equal the I-03G readiness fingerprint
-- recomputed from its own four parts. Evidence for one output therefore cannot
-- be replayed for another body or another World.
--
-- I-03G froze what that readiness means, and this migration does not reinterpret
-- it:
--
--   READY_FOR_LATER_DELIVERY_GATES
--     != System / Safety clearance
--     != Launch Gate clearance
--     != delivery / commit permission
--
-- So the evidence relation carries NO system-safety column, NO launch-gate
-- column and NO delivery-permission column, and the migration refuses to deploy
-- if one appears. No fake Safety or Launch evidence is manufactured anywhere.
--
-- ===========================================================================
-- Owner deletion
-- ===========================================================================
--
-- A human may delete their OWN human-authored material whether they are a
-- current member, a former member, or a viewer of an archived World (CW2-03
-- section 24 / C21, section 35 / C31). Deleting restores no browsing: this
-- transaction writes no membership episode, no grant and no entitlement.
--
-- It is a PRIVACY_MATERIAL_MUTATION, not an ordinary World mutation, so
-- READ_ONLY_CLOSED does not block it and it never reopens the lifecycle. It
-- makes reconstruction impossible rather than merely hidden: the body row is
-- PHYSICALLY REMOVED - human text, audio object reference and stored transcript
-- alike - and the history item transitions to the terminal `DELETED_BY_OWNER`.
-- Envelope, history identity and provenance identity remain as non-content
-- history (CW2-01 section 25 / A18, CW2-03 section 37).
--
-- Every Shared target that is transitively SOURCE-CONTENT-BEARING through
-- MATERIAL_DEPENDENCY becomes `UNAVAILABLE` and loses its body too, because it
-- reproduces or contains the deleted source (CW2-02 section 27). It is NOT
-- marked `DELETED_BY_OWNER` - that would falsely claim its own owner deleted it
-- - and its dependency identity is never erased. ANALYTICAL derivatives, which
-- is what a REASONING_DEPENDENCY target is, are NOT erased: legitimate prior
-- analysis may remain historical.
--
-- The traversal is a deterministic recursive closure, and it provably
-- terminates: migration 0089 makes every MATERIAL_DEPENDENCY edge strictly
-- increase establishment time, so a cycle is unrepresentable.
--
-- ===========================================================================
-- No content anywhere but the body
-- ===========================================================================
--
-- No command, event or evidence row carries raw human text, an output body, a
-- transcript, a private source reference or deleted content. Where a command
-- must bind the exact body it committed - so that an equivalent retry is
-- equivalent, and so that a retry after a legitimate deletion still answers
-- truthfully - it stores a SHA-256 digest, which is the identity-not-content
-- convention the frozen I-03F `digestProviderOutput` already established.
--
-- ===========================================================================
-- What this slice deliberately does NOT do
-- ===========================================================================
--
-- It creates and closes no World, opens and closes no membership episode,
-- terminalizes no invitation, touches no Standing Context Grant, audience
-- ceiling or consent history, reads no Personal context, alters no predecessor
-- table, adds no route, controller, RPC, mobile surface, Launch Gate, feature
-- flag, entitlement policy or safety / moderation policy, builds no media
-- storage provider, upload path or storage credential, implements no history
-- grant withdrawal, no Introduction producer, no explicit-disclosure producer,
-- no World-event-derived producer, no human-to-human live call, and mutates no
-- Personal, Public, Replay, Matching or Introduction state. Every historical
-- migration, 0001-0088 included, is untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE COMMIT COMMAND.
--
--    One row per committed material. It is the idempotency key AND the exact
--    committed answer: an equivalent retry is served from here, never by
--    re-reading current state, so a later leave, closure or owner deletion can
--    never make a historical command start answering differently.
--
--    `body_digest` binds the command to the exact bytes it committed. That is
--    what makes "equivalent retry" mean something after the body has been
--    legitimately destroyed, and it is an identity, not content: it is not
--    reversible, and it is the same `sha256:<hex>` convention frozen I-03F
--    already uses for provider output.
--
--    `actor_user_id` is the human who committed HUMAN material and is NULL for
--    QANDEEL, because QANDEEL is a system actor and never a human principal
--    (CW2-01 section 7 / A3).
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_material_commit_commands (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    material_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    material_kind text NOT NULL,
    producer_kind text NOT NULL,
    actor_user_id uuid,
    body_digest text NOT NULL,
    request_ref text NOT NULL,
    baseline_viewer_count integer NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_material_commit_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_material_commit_commands_material_key UNIQUE (material_id),
    CONSTRAINT shared_world_material_commit_commands_history_item_key UNIQUE (history_item_id),
    CONSTRAINT shared_world_material_commit_commands_producer_check
        CHECK ((producer_kind = 'HUMAN' AND actor_user_id IS NOT NULL)
            OR (producer_kind = 'QANDEEL' AND actor_user_id IS NULL)),
    CONSTRAINT shared_world_material_commit_commands_digest_check
        CHECK (body_digest ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT shared_world_material_commit_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- The original delivery audience is never empty: ordinary material is
    -- committed into a World that has at least one current human in it.
    CONSTRAINT shared_world_material_commit_commands_viewers_check
        CHECK (baseline_viewer_count > 0),
    CONSTRAINT shared_world_material_commit_commands_material_fk
        FOREIGN KEY (material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_commit_commands_history_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_commit_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 2. THE EXACT I-03 OPERATION EVIDENCE OF ONE COMMITTED QANDEEL MATERIAL.
--
--    One row per QANDEEL material, and no row for human material - a human
--    statement is not a provider output and has no gate, revalidation or
--    readiness to bind.
--
--    UNIQUE (readiness_ref) is the replay rule: one I-03 readiness commits at
--    most one material, ever. Because that reference is the fingerprint over the
--    envelope, the output digest, the disclosure gate and the authority
--    revalidation, and because the core additionally requires the output digest
--    to be the digest of the exact body, evidence produced for one output can
--    never be reused for a different body or a different World.
--
--    There is deliberately NO system-safety, launch-gate, moderation,
--    entitlement or delivery-permission column here.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_qandeel_material_evidence (
    material_id uuid NOT NULL,
    world_id uuid NOT NULL,
    readiness_state text NOT NULL,
    readiness_ref text NOT NULL,
    effective_context_ref text NOT NULL,
    output_digest text NOT NULL,
    source_disclosure_gate_ref text NOT NULL,
    authority_revalidation_ref text NOT NULL,
    audience_snapshot_ref text NOT NULL,
    CONSTRAINT shared_world_qandeel_material_evidence_pk PRIMARY KEY (material_id),
    CONSTRAINT shared_world_qandeel_material_evidence_readiness_key UNIQUE (readiness_ref),
    -- The exact frozen I-03G state, and only it. This records WHAT was proven,
    -- and I-03G froze that it is not a Safety, Launch or delivery clearance.
    CONSTRAINT shared_world_qandeel_material_evidence_state_check
        CHECK (readiness_state = 'READY_FOR_LATER_DELIVERY_GATES'),
    CONSTRAINT shared_world_qandeel_material_evidence_digest_check
        CHECK (output_digest ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT shared_world_qandeel_material_evidence_readiness_ref_check
        CHECK (readiness_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- Opaque server-owned references: bounded, whitespace-free, never prose.
    CONSTRAINT shared_world_qandeel_material_evidence_opaque_refs_check
        CHECK (length(btrim(effective_context_ref)) > 0 AND length(effective_context_ref) <= 200
           AND effective_context_ref !~ '\s'
           AND length(btrim(source_disclosure_gate_ref)) > 0 AND length(source_disclosure_gate_ref) <= 200
           AND source_disclosure_gate_ref !~ '\s'
           AND length(btrim(authority_revalidation_ref)) > 0 AND length(authority_revalidation_ref) <= 200
           AND authority_revalidation_ref !~ '\s'
           AND length(btrim(audience_snapshot_ref)) > 0 AND length(audience_snapshot_ref) <= 200
           AND audience_snapshot_ref !~ '\s'),
    CONSTRAINT shared_world_qandeel_material_evidence_material_fk
        FOREIGN KEY (material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.shared_world_qandeel_material_evidence IS
  'The exact I-03 operation evidence bound to one committed QANDEEL material. '
  'Its readiness state is the frozen I-03G READY_FOR_LATER_DELIVERY_GATES, which '
  'is NOT System/Safety clearance, NOT Launch Gate clearance and NOT delivery or '
  'commit permission: System/Safety and the Launch Gate are NOT_EVALUATED and '
  'belong to CW2-08, and delivery/commit authority is NOT_GRANTED_BY_THIS_BOUNDARY. '
  'No column here may ever assert otherwise.';

-- ---------------------------------------------------------------------------
-- 3. THE HISTORICAL-SHARING AUTHORITY RESOLUTION OF ONE COMMITTED MATERIAL.
--
--    CW2-02 section 26 derives a publishable QANDEEL analysis's
--    AUTHORITY_REQUIREMENT_SET from the protected human material and SUBJECTS
--    actually implicated in it. I-04G can compute the first half exactly - the
--    human authorities propagated from MATERIAL_DEPENDENCY sources - and cannot
--    compute the second: no reviewed server-owned producer of an additional
--    protected-human subject authority exists in this repository yet.
--
--    "Cannot compute" is NOT "computed, and empty". The frozen rule is that
--    missing or unresolved authority metadata NEVER means approval-free, so this
--    relation records which of the three it actually is:
--
--      RESOLVED_EXACT_HUMAN_REQUIREMENT       the exact required humans are known
--      RESOLVED_NO_HUMAN_REQUIREMENT          there is genuinely no human requirement
--      UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT an additional human requirement may
--                                             exist and is not yet resolvable
--
--    QANDEEL material carrying ANY reasoning dependency is UNRESOLVED, even when
--    it also carries known MATERIAL_DEPENDENCY owners: the known owners alone do
--    not resolve the whole requirement. A REASONING_DEPENDENCY still propagates
--    NO material consent - no reasoning grantor is ever turned into an approver.
--
--    This changes nothing about CURRENT delivery. The material exists, its exact
--    baseline audience sees it, and the material resolver returns it. What is
--    blocked is HISTORICAL AUDIENCE WIDENING, by the trigger in section 5.
--
--    The representation is additive on purpose: a later reviewed subject-authority
--    resolver transitions a row forward without rewriting any source history.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_material_historical_authority (
    material_id uuid NOT NULL,
    world_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    resolution_state text NOT NULL,
    CONSTRAINT shared_world_material_historical_authority_pk PRIMARY KEY (material_id),
    CONSTRAINT shared_world_material_historical_authority_item_key UNIQUE (history_item_id),
    CONSTRAINT shared_world_material_historical_authority_state_check
        CHECK (resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',
                                    'RESOLVED_NO_HUMAN_REQUIREMENT',
                                    'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT')),
    CONSTRAINT shared_world_material_historical_authority_material_fk
        FOREIGN KEY (material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_historical_authority_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT
);

CREATE INDEX shared_world_material_historical_authority_item_idx
    ON public.shared_world_material_historical_authority (history_item_id);

-- ---------------------------------------------------------------------------
-- 4. The append-only MATERIAL_DELETED fact (CW2-03 section 46) and its durable
--    command history.
--
--    UNIQUE (material_id) on BOTH is the "one effective owner deletion per
--    material" rule: two competing deletes cannot both commit even if every
--    procedural check above them were somehow bypassed. Neither row carries any
--    deleted content, reason, body, transcript or media reference.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_material_deleted_events (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    material_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT shared_world_material_deleted_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_material_deleted_events_material_key UNIQUE (material_id),
    CONSTRAINT shared_world_material_deleted_events_history_item_key UNIQUE (history_item_id),
    CONSTRAINT shared_world_material_deleted_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_deleted_events_material_fk
        FOREIGN KEY (material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_deleted_events_history_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT
);

CREATE TABLE public.shared_world_material_delete_commands (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    material_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    material_deleted_event_id uuid NOT NULL,
    invalidated_target_count integer NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_world_material_delete_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_material_delete_commands_material_key UNIQUE (material_id),
    CONSTRAINT shared_world_material_delete_commands_event_key UNIQUE (material_deleted_event_id),
    CONSTRAINT shared_world_material_delete_commands_invalidated_check
        CHECK (invalidated_target_count >= 0),
    CONSTRAINT shared_world_material_delete_commands_material_fk
        FOREIGN KEY (material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_delete_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_delete_commands_event_fk
        FOREIGN KEY (material_deleted_event_id)
        REFERENCES public.shared_world_material_deleted_events (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 5. Deny-by-default posture for all five new relations.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_world_material_commit_commands OWNER TO postgres;
ALTER TABLE public.shared_world_qandeel_material_evidence OWNER TO postgres;
ALTER TABLE public.shared_world_material_historical_authority OWNER TO postgres;
ALTER TABLE public.shared_world_material_deleted_events OWNER TO postgres;
ALTER TABLE public.shared_world_material_delete_commands OWNER TO postgres;
ALTER TABLE public.shared_world_material_commit_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_qandeel_material_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_material_historical_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_material_deleted_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_material_delete_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_material_commit_commands,
                    public.shared_world_qandeel_material_evidence,
                    public.shared_world_material_historical_authority,
                    public.shared_world_material_deleted_events,
                    public.shared_world_material_delete_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_material_commit_commands, public.shared_world_qandeel_material_evidence, public.shared_world_material_historical_authority, public.shared_world_material_deleted_events, public.shared_world_material_delete_commands FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 6. THE HISTORICAL WIDENING GATE.
--
--    The one place an audience can be widened over already-committed material is
--    the frozen I-04F history package: its manifest items are what a later
--    HISTORY_ACCESS_GRANT exposes. This narrow additive trigger refuses to admit
--    any item whose material's additional human authority is UNRESOLVED.
--
--    It is deliberately enforced HERE rather than left to a future Product
--    wrapper or to documentation: the frozen 0087 primitive is postgres-owned and
--    would otherwise package an unresolved item the moment its KNOWN material
--    owners approved - and known owners alone do not resolve the requirement.
--
--    It narrows nothing else. Ordinary current-audience participation, the
--    material resolver, owner deletion and every human-authored item are
--    untouched, and an item with no I-04G material at all - which is every item a
--    later reviewed producer creates outside this store - passes through.
--
--    A later reviewed subject-authority resolver moves a row to RESOLVED and the
--    same item becomes packageable, with no change to this trigger and no
--    rewriting of source history.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.shared_world_material_historical_widening_gate_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.shared_world_material_historical_authority a
     WHERE a.history_item_id = NEW.history_item_id
       AND a.resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'
  ) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER shared_world_material_historical_widening_gate
  BEFORE INSERT ON public.shared_world_history_package_manifest_items
  FOR EACH ROW EXECUTE FUNCTION public.shared_world_material_historical_widening_gate_v1();

-- ---------------------------------------------------------------------------
-- 5. THE HUMAN MATERIAL COMMIT CORE.
--
--    The committing human is exactly auth.uid(), derived and never supplied.
--    The caller provides opaque persistence identities, the material kind and
--    the body it is committing - and no actor, author, audience, viewer,
--    approver, episode, authority, count or instant of any kind.
--
--    It is INTERNAL: the two named primitives below are its only callers, and
--    they reach it as its own owner. Both it and they are executable by no
--    application role, because the frozen Launch Gate precondition of CW2-08 is
--    unimplemented.
--
--    THE CANONICAL TRANSACTION, in this exact order (task section 13):
--      1  durable idempotency, before any lock
--      2  the exact World row, LOCKED FIRST
--      3  durable idempotency again, under the lock
--      4  lifecycle ACTIVE and phase STANDARD
--      5  the actor's exact open membership episode
--      6  the exact current human audience, under the SAME World lock
--      7  the actor is in it, and it is non-empty
--      8  ONE database-owned instant
--      9  envelope + body + history item + baseline audience + author authority
--         + provenance + command, atomically
--
--    The schema is NOT Standard-only: this PRIMITIVE refuses a non-STANDARD
--    World because I-04G implements no Introduction producer, exactly as the
--    frozen I-04C and I-04F primitives do. A later reviewed Introduction
--    producer composes the same relations; nothing here forecloses it.
--
--    The RETURNS TABLE columns are named so that none of them collides with a
--    column this body reads: an OUT parameter is a plpgsql variable, and an
--    unqualified reference to a same-named column is an execution-time
--    ambiguity error rather than a compile-time one.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_human_material_v1(
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

  -- STEP 4. ORDINARY MATERIAL IS ACTIVE / STANDARD ONLY. An archived World
  -- blocks ordinary mutation (CW2-03 section 35 / C31) and a paired World has
  -- its own terminal transition, which this slice neither implements nor guesses.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
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
-- 6. PRIMITIVE A - commit real Shared HUMAN_TEXT.
--
--    The kind is a literal here, not something a caller chooses, so no client
--    can commit text under a voice-note identity or a QANDEEL identity.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_human_text_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid, p_body_text text
) RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                committed_history_item_id uuid, committed_material_kind text,
                audience_size integer, material_established_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN QUERY
    SELECT c.outcome, c.command_id, c.material_world_id, c.committed_material_id,
           c.committed_history_item_id, c.committed_material_kind,
           c.audience_size, c.material_established_at
      FROM public.commit_shared_world_human_material_v1(
             p_command_id, p_world_id, p_material_id, p_history_item_id,
             'HUMAN_TEXT', p_body_text, NULL, NULL, NULL) c;
END$$;

-- ---------------------------------------------------------------------------
-- 7. PRIMITIVE B - commit a real Shared HUMAN_VOICE_NOTE.
--
--    `p_audio_object_ref` is required by the core, so a transcript alone can
--    never be committed as an original voice note. The reference is an opaque
--    server-side media object identity: migration 0089 CHECKs that it is not a
--    URL and carries no credential, and I-04G builds no storage provider,
--    upload path or credential of any kind.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_human_voice_note_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid,
  p_audio_object_ref text, p_transcript_text text, p_duration_ms integer
) RETURNS TABLE(outcome text, command_id uuid, material_world_id uuid, committed_material_id uuid,
                committed_history_item_id uuid, committed_material_kind text,
                audience_size integer, material_established_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN QUERY
    SELECT c.outcome, c.command_id, c.material_world_id, c.committed_material_id,
           c.committed_history_item_id, c.committed_material_kind,
           c.audience_size, c.material_established_at
      FROM public.commit_shared_world_human_material_v1(
             p_command_id, p_world_id, p_material_id, p_history_item_id,
             'HUMAN_VOICE_NOTE', NULL, p_audio_object_ref, p_transcript_text, p_duration_ms) c;
END$$;

-- ---------------------------------------------------------------------------
-- 8. THE QANDEEL MATERIAL COMMIT CORE.
--
--    There is NO human actor here and NO auth.uid(): QANDEEL is a system actor
--    and never a human consent or ownership principal (CW2-01 section 7 / A3).
--    The envelope's author is NULL, and no human approval is manufactured.
--
--    It derives the current audience under the World lock exactly as the human
--    core does, and never accepts a viewer list. The caller's own audience
--    snapshot reference is recorded as evidence of WHICH audience the output was
--    produced for - it is audit truth, never an authority, and it can neither
--    widen nor narrow the baseline audience this transaction derives for itself.
--
--    Stale state refuses the commit: a World that is no longer ACTIVE/STANDARD,
--    a dependency source that is no longer AVAILABLE, and evidence that does not
--    bind these exact body bytes are each a refusal rather than a warning.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.commit_shared_world_qandeel_material_v1(
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

  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN
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
-- 9. OWNER DELETION - the PRIVACY_MATERIAL_MUTATION.
--
--    The deleting human is exactly auth.uid(). There is no owner parameter and
--    no actor parameter, so no caller - including a future launch-gated wrapper
--    - can delete on somebody's behalf, and membership can never confer
--    ownership over another human's or QANDEEL's material.
--
--    Lifecycle: ACTIVE and READ_ONLY_CLOSED both permit it, and neither is
--    changed by it. Phase is deliberately NOT a gate: deletion authority is the
--    exact author, not World governance, and a later reviewed Introduction
--    producer's material must remain deletable by its own owner without
--    reopening this primitive.
--
--    This is the ONLY function in I-04G that deletes anything, and every DELETE
--    it issues targets a material BODY relation. No envelope, history item,
--    baseline viewer, required approver, dependency, grant, entitlement,
--    membership episode or event is ever removed.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.delete_shared_world_owned_material_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_material_deleted_event_id uuid
) RETURNS TABLE(outcome text, command_id uuid, deleted_world_id uuid, deleted_material_id uuid,
                deleted_history_item_id uuid, deleted_event_id uuid,
                invalidated_targets integer, deleted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_material_delete_commands;
  world public.shared_worlds;
  owned public.shared_world_materials;
  item public.shared_world_history_items;
  targets uuid[];
  invalidating uuid[];
  removed integer;
  invalidated integer;
  affected integer;
  delete_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_material_id IS NULL
     OR p_material_deleted_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry is
  -- answered from immutable history even after the World has closed. Nothing on
  -- this path reads current membership or current World state.
  SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id
       AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_material_deleted_events ev
          JOIN public.shared_world_materials m ON m.id = ev.material_id
          JOIN public.shared_world_history_items i ON i.id = ev.history_item_id
         WHERE ev.id = committed.material_deleted_event_id
           AND ev.material_id = committed.material_id AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
           AND m.world_id = committed.world_id AND m.author_user_id = committed.actor_user_id
           AND i.id = m.history_item_id AND i.availability_state = 'DELETED_BY_OWNER'
           AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b
                            WHERE b.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies b
                            WHERE b.material_id = committed.material_id)
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                          (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                            WHERE ev.id = committed.material_deleted_event_id),
                          committed.material_deleted_event_id, committed.invalidated_target_count,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, THE WORLD ROW FIRST, exactly as every other
  -- consequential material mutation does - which is what makes
  -- deletion-versus-grant, deletion-versus-closure and deletion-versus-commit
  -- serialize in a single deterministic order with no deadlock.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two competing
  -- deletes serialize and the loser returns the committed result.
  SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id
       AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
      RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                          (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                            WHERE ev.id = committed.material_deleted_event_id),
                          committed.material_deleted_event_id, committed.invalidated_target_count,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- A PRIVACY MUTATION IS NOT AN ORDINARY WORLD MUTATION. READ_ONLY_CLOSED does
  -- not block it (CW2-03 section 35 / C31), and this transaction never writes a
  -- lifecycle, a phase or a closure instant, so it cannot reopen anything.
  IF world.lifecycle NOT IN ('ACTIVE', 'READ_ONLY_CLOSED') THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact material, then its exact history
  -- item.
  SELECT * INTO owned FROM public.shared_world_materials m WHERE m.id = p_material_id FOR UPDATE;
  IF NOT FOUND OR owned.world_id <> p_world_id THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE ACTOR IS THE EXACT ORIGINAL HUMAN AUTHOR. A different human, and any
  -- human at all against QANDEEL material, reaches the same bounded answer as a
  -- caller naming material that does not exist, so this is not an ownership
  -- oracle either. Membership is never consulted: a former member and a closed
  -- World viewer both keep this authority (CW2-03 section 24 / C21).
  IF owned.producer_kind <> 'HUMAN' OR owned.author_user_id IS NULL OR owned.author_user_id <> u THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO item FROM public.shared_world_history_items i WHERE i.id = owned.history_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- The source must still be AVAILABLE. An already deleted or already
  -- invalidated source is not deletable a second time.
  IF item.availability_state <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE TRANSITIVE SOURCE-CONTENT-BEARING CLOSURE. Deterministic, over
  -- MATERIAL_DEPENDENCY edges only: a REASONING_DEPENDENCY target is an
  -- ANALYTICAL derivative and is never erased merely because a source later
  -- disappeared (CW2-02 section 27). UNION rather than UNION ALL, and migration
  -- 0089's strict source-precedes-target rule, make the traversal terminate.
  targets := coalesce((
    WITH RECURSIVE reachable(material_id) AS (
      SELECT d.target_material_id
        FROM public.shared_world_material_dependencies d
       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY' AND d.source_material_id = p_material_id
      UNION
      SELECT d.target_material_id
        FROM public.shared_world_material_dependencies d
        JOIN reachable step ON d.source_material_id = step.material_id
       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'
    )
    SELECT array_agg(r.material_id ORDER BY r.material_id) FROM reachable r
  ), ARRAY[]::uuid[]);
  -- Acyclicity is structural, so the deleted source can never be its own
  -- downstream target. Fail closed rather than mutate it twice if it ever is.
  IF p_material_id = ANY(targets) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF array_length(targets, 1) IS NOT NULL THEN
    -- CANONICAL LOCK ORDER, STEP 3: every reachable target, then its history
    -- item, both in deterministic identity order.
    PERFORM 1 FROM public.shared_world_materials m WHERE m.id = ANY(targets) ORDER BY m.id FOR UPDATE;
    PERFORM 1 FROM public.shared_world_history_items i
      WHERE i.id IN (SELECT m.history_item_id FROM public.shared_world_materials m WHERE m.id = ANY(targets))
      ORDER BY i.id FOR UPDATE;
    -- Only targets whose source content is still present are invalidated. One
    -- already terminal by ITS OWN owner's deletion stays exactly as it is, and
    -- one already UNAVAILABLE needs no second transition.
    SELECT array_agg(m.id ORDER BY m.id) INTO invalidating
      FROM public.shared_world_materials m
      JOIN public.shared_world_history_items i ON i.id = m.history_item_id
     WHERE m.id = ANY(targets) AND i.availability_state = 'AVAILABLE';
  END IF;
  invalidating := coalesce(invalidating, ARRAY[]::uuid[]);

  -- THE ONE canonical deletion instant.
  delete_instant := clock_timestamp();

  BEGIN
    -- PHYSICAL REMOVAL OF THE SOURCE BODY. Human text, the audio object
    -- reference and any stored transcript all go with the row: there is nothing
    -- left to reconstruct from, and nothing is copied anywhere first.
    DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = p_material_id;
    GET DIAGNOSTICS removed = ROW_COUNT;
    DELETE FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = p_material_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    removed := removed + affected;
    IF removed <> (CASE WHEN owned.body_form = 'RESERVED' THEN 0 ELSE 1 END) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE TERMINAL AVAILABILITY TRANSITION, through the frozen I-04F revision
    -- semantics. Migration 0087's trigger makes DELETED_BY_OWNER permanent.
    UPDATE public.shared_world_history_items i
       SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1
     WHERE i.id = owned.history_item_id AND i.availability_state = 'AVAILABLE';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- EVERY TRANSITIVELY SOURCE-CONTENT-BEARING TARGET becomes UNAVAILABLE and
    -- loses its body. It is NOT marked DELETED_BY_OWNER: its own owner did not
    -- delete it, and that distinction is historical truth. Its envelope and its
    -- dependency identity survive.
    invalidated := 0;
    IF array_length(invalidating, 1) IS NOT NULL THEN
      DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = ANY(invalidating);
      DELETE FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = ANY(invalidating);
      UPDATE public.shared_world_history_items i
         SET availability_state = 'UNAVAILABLE', availability_revision = i.availability_revision + 1
        FROM public.shared_world_materials m
       WHERE m.id = ANY(invalidating) AND i.id = m.history_item_id
         AND i.availability_state = 'AVAILABLE';
      GET DIAGNOSTICS invalidated = ROW_COUNT;
      IF invalidated <> array_length(invalidating, 1) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;

    -- The canonical MATERIAL_DELETED fact, carrying identity and time only.
    INSERT INTO public.shared_world_material_deleted_events
      (id, world_id, material_id, history_item_id, occurred_at)
    VALUES (p_material_deleted_event_id, p_world_id, p_material_id, owned.history_item_id, delete_instant);

    INSERT INTO public.shared_world_material_delete_commands
      (id, world_id, material_id, actor_user_id, material_deleted_event_id,
       invalidated_target_count, committed_at)
    VALUES (p_command_id, p_world_id, p_material_id, u, p_material_deleted_event_id,
            invalidated, delete_instant);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS: two deletes sharing a command id while
    -- resolving to different humans serialize only here.
    SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id = u AND committed.world_id = p_world_id
         AND committed.material_id = p_material_id
         AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
        RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                            (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                              WHERE ev.id = committed.material_deleted_event_id),
                            committed.material_deleted_event_id, committed.invalidated_target_count,
                            committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken, or this material was
    -- already deleted under another command. The whole transaction rolls back.
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATERIAL_DELETED'::text, p_command_id, p_world_id, p_material_id,
                      owned.history_item_id, p_material_deleted_event_id, invalidated, delete_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 10. Ownership and THE PRE-LAUNCH ACL. All five primitives are executable by no
--     application role at all, service_role included, because the frozen CW2-08
--     Safety / Launch Gate precondition is unimplemented. This migration GRANTS
--     NOTHING to anybody: the one material read boundary is migration 0089's
--     resolver, and it stays the only thing any application role may call.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.commit_shared_world_human_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, integer) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_human_text_v1(uuid, uuid, uuid, uuid, text) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_human_voice_note_v1(uuid, uuid, uuid, uuid, text, text, integer) OWNER TO postgres;
ALTER FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) OWNER TO postgres;
ALTER FUNCTION public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.commit_shared_world_human_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_human_text_v1(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_human_voice_note_v1(uuid, uuid, uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_human_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_human_text_v1(uuid, uuid, uuid, uuid, text) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_human_voice_note_v1(uuid, uuid, uuid, uuid, text, text, integer) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[]) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid) FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 11. Terminal self-assertions. The migration refuses to deploy a material
--     runtime that is application-executable, caller-identified, unpinned,
--     wrongly ordered, multi-clocked, audience-accepting, membership-owning,
--     history-deleting, reasoning-consenting, content-logging, Safety- or
--     Launch-claiming, or that lets QANDEEL become a human principal.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  human_core text := 'public.commit_shared_world_human_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,integer)';
  text_fn text := 'public.commit_shared_world_human_text_v1(uuid,uuid,uuid,uuid,text)';
  voice_fn text := 'public.commit_shared_world_human_voice_note_v1(uuid,uuid,uuid,uuid,text,text,integer)';
  qandeel_fn text := 'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])';
  delete_fn text := 'public.delete_shared_world_owned_material_v1(uuid,uuid,uuid,uuid)';
  resolver_fn text := 'public.resolve_shared_world_material_v1(uuid,uuid)';
  entry_point_fn text := 'public.resolve_shared_world_history_visibility_v1(uuid,uuid)';
  own_tables text[] := ARRAY['public.shared_world_material_commit_commands',
                             'public.shared_world_qandeel_material_evidence',
                             'public.shared_world_material_historical_authority',
                             'public.shared_world_material_deleted_events',
                             'public.shared_world_material_delete_commands'];
  all_fns text[];
  fn text;
  p record;
  in_names text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
  deletes integer;
  body_deletes integer;
  approver_write text;
BEGIN
  all_fns := ARRAY[human_core, text_fn, voice_fn, qandeel_fn, delete_fn];

  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'I-04G: row level security must be enabled on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04G: no RLS policy may exist yet on %', target_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
       WHERE c.oid = target_table::regclass AND privilege.grantee = 0
    ) THEN
      RAISE EXCEPTION 'I-04G: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04G: the material runtime must stay sealed: % holds % on %',
              target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- NO CONTENT, NO REASON AND NO SAFETY OR LAUNCH CLAIM in any command, event or
  -- evidence row. A digest is identity, not content, and is named so.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_material_commit_commands','shared_world_qandeel_material_evidence',
                            'shared_world_material_historical_authority',
                            'shared_world_material_deleted_events','shared_world_material_delete_commands')
       AND (c.column_name ~* '(body_text|transcript|audio|content|payload|reason|note|prompt|message|excerpt|snippet|owner|admin|moderator|safety|launch|entitlement|clearance|approved|allowed)'
         OR c.data_type IN ('json','jsonb','bytea'))
  ) THEN
    RAISE EXCEPTION 'I-04G: no command, event or evidence row may carry material content, a reason, a role or a Safety/Launch claim';
  END IF;

  -- I-03G FROZE WHAT READINESS MEANS, AND THIS MIGRATION DOES NOT REINTERPRET IT.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.shared_world_qandeel_material_evidence'::regclass
       AND c.conname = 'shared_world_qandeel_material_evidence_state_check'
  ) THEN
    RAISE EXCEPTION 'I-04G: the bound I-03 readiness state must stay pinned to READY_FOR_LATER_DELIVERY_GATES';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.shared_world_qandeel_material_evidence'::regclass
       AND c.conname = 'shared_world_qandeel_material_evidence_readiness_key'
  ) THEN
    RAISE EXCEPTION 'I-04G: one I-03 readiness must commit at most one material: evidence is not replayable';
  END IF;

  FOREACH fn IN ARRAY all_fns LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04G: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04G: % must be SECURITY DEFINER', fn; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-04G: % is a mutation and must be VOLATILE', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-04G: % must pin an empty search_path', fn;
    END IF;

    -- THE PRE-LAUNCH SECURITY BOUNDARY, asserted rather than commented. This is
    -- about THESE primitives only; a later reviewed launch-gated wrapper is
    -- expected and is forbidden nowhere in this migration.
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04G: PUBLIC must not execute the material runtime before the launch gate exists';
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-04G: % must not execute the material runtime before the launch gate exists', target_role;
      END IF;
    END LOOP;

    -- NO CALLER CLOCK, NO ADVISORY OR TABLE LOCK, NO PERSONAL CONTEXT, NO
    -- STANDING CONTEXT OR CONSENT MUTATION, AND NO WORLD LIFECYCLE MUTATION.
    IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
      RAISE EXCEPTION 'I-04G: % accepts no clock but one read of the database clock', fn;
    END IF;
    IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' THEN
      RAISE EXCEPTION 'I-04G: % locks rows in the canonical order, never a table and never an advisory key', fn;
    END IF;
    IF p.prosrc ~* 'conversation_|\Wmemor|human_intelligence|hypothes|effective_context_grant|standing_context|consent_|matching|introduction' THEN
      RAISE EXCEPTION 'I-04G: % must not read Personal context or touch Standing Context / consent state', fn;
    END IF;
    IF p.prosrc ~ 'UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds' THEN
      RAISE EXCEPTION 'I-04G: % must not create, close or mutate a Shared World', fn;
    END IF;
    IF p.prosrc ~ 'INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes' THEN
      RAISE EXCEPTION 'I-04G: % must not create or mutate a membership episode', fn;
    END IF;
    IF p.prosrc ~ 'shared_world_history_access_grants|shared_world_standard_closed_view_entitlements' THEN
      RAISE EXCEPTION 'I-04G: % must not write a history grant or a closed-World entitlement', fn;
    END IF;
    IF p.prosrc ~* 'TRUNCATE' THEN
      RAISE EXCEPTION 'I-04G: % may never truncate canonical history', fn;
    END IF;
    -- THE CANONICAL LOCK ORDER: the exact World row, first.
    IF p.prosrc ~ 'FOR UPDATE' AND p.prosrc !~ 'FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE' THEN
      RAISE EXCEPTION 'I-04G: % must lock the exact World row first', fn;
    END IF;
  END LOOP;

  -- ONLY THE OWNER-DELETION PRIMITIVE DELETES ANYTHING, AND ONLY A BODY.
  FOREACH fn IN ARRAY ARRAY[human_core, text_fn, voice_fn, qandeel_fn] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc ~* 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-04G: % may never delete anything: committing material destroys nothing', fn;
    END IF;
  END LOOP;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = delete_fn::regprocedure;
  deletes := (length(p.prosrc) - length(replace(p.prosrc, 'DELETE FROM public.', ''))) / length('DELETE FROM public.');
  body_deletes :=
      (length(p.prosrc) - length(replace(p.prosrc, 'DELETE FROM public.shared_world_text_material_bodies', '')))
        / length('DELETE FROM public.shared_world_text_material_bodies')
    + (length(p.prosrc) - length(replace(p.prosrc, 'DELETE FROM public.shared_world_voice_note_material_bodies', '')))
        / length('DELETE FROM public.shared_world_voice_note_material_bodies');
  IF deletes <> 4 OR body_deletes <> deletes THEN
    RAISE EXCEPTION 'I-04G: owner deletion removes material BODIES and nothing else: % DELETE statements, % of them bodies',
      deletes, body_deletes;
  END IF;
  -- And it makes the source terminal while leaving an invalidated derivative's
  -- own owner's truth alone.
  IF p.prosrc !~ 'SET availability_state = ''DELETED_BY_OWNER'', availability_revision = i\.availability_revision \+ 1' THEN
    RAISE EXCEPTION 'I-04G: owner deletion must transition the exact history item to the terminal DELETED_BY_OWNER';
  END IF;
  IF p.prosrc !~ 'SET availability_state = ''UNAVAILABLE'', availability_revision = i\.availability_revision \+ 1' THEN
    RAISE EXCEPTION 'I-04G: a source-content-bearing derivative becomes UNAVAILABLE, never DELETED_BY_OWNER';
  END IF;
  -- The traversal PREDICATE is the proof, in both recursive branches, and no
  -- REASONING_DEPENDENCY predicate exists anywhere in the body. The ban is on a
  -- predicate rather than on the token, because the body legitimately EXPLAINS in
  -- prose why an analytical derivative is spared - and a token ban would make
  -- this migration refuse itself over its own comment.
  IF (length(p.prosrc) - length(replace(p.prosrc, 'd.dependency_kind = ''MATERIAL_DEPENDENCY''', '')))
     / length('d.dependency_kind = ''MATERIAL_DEPENDENCY''') <> 2 THEN
    RAISE EXCEPTION 'I-04G: both recursive branches must follow MATERIAL_DEPENDENCY edges exactly';
  END IF;
  IF p.prosrc ~ 'dependency_kind = ''REASONING_DEPENDENCY''' THEN
    RAISE EXCEPTION 'I-04G: invalidation follows MATERIAL_DEPENDENCY only: an analytical derivative is not erased';
  END IF;
  IF p.prosrc ~ 'SET lifecycle|SET phase|SET closed_at|lifecycle = ''|phase = ''|closed_at = ' THEN
    RAISE EXCEPTION 'I-04G: a privacy material mutation never reopens or changes World lifecycle';
  END IF;

  -- THE HUMAN SURFACE DERIVES ITS HUMAN, AND THE QANDEEL CORE HAS NONE.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = human_core::regprocedure;
  IF p.prosrc !~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-04G: % must derive the committing human from auth.uid()', human_core;
  END IF;
  IF p.prosrc !~ 'VALUES \(p_history_item_id, u\)' THEN
    RAISE EXCEPTION 'I-04G: the exact human author is the exact required material authority, and only them';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = delete_fn::regprocedure;
  IF p.prosrc !~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-04G: % must derive the deleting human from auth.uid()', delete_fn;
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = qandeel_fn::regprocedure;
  IF p.prosrc ~ 'auth\.uid' THEN
    RAISE EXCEPTION 'I-04G: QANDEEL is a system actor and is never a human consent or ownership principal';
  END IF;
  IF p.prosrc ~ 'INSERT INTO public\.shared_world_history_item_required_approvers[^;]*unnest\(audience\)'
     OR p.prosrc ~ 'authority_mode := ''EXACT_HUMAN_APPROVER_SET''' THEN
    RAISE EXCEPTION 'I-04G: the QANDEEL approver set is dependency-derived, never the World membership and never a constant';
  END IF;
  -- MISSING AUTHORITY NEVER MEANS EMPTY. A reasoning dependency records an
  -- UNRESOLVED additional human requirement, and NO_HUMAN_APPROVAL_REQUIRED is
  -- reachable ONLY from a resolved empty one.
  IF p.prosrc !~ 'WHEN reasoning_edges > 0 THEN ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'I-04G: an unresolvable additional human requirement must be recorded as unresolved, never as empty';
  END IF;
  IF p.prosrc !~ 'authority_mode := CASE WHEN authority_resolution = ''RESOLVED_NO_HUMAN_REQUIREMENT''' THEN
    RAISE EXCEPTION 'I-04G: NO_HUMAN_APPROVAL_REQUIRED may be written only for a RESOLVED empty human requirement';
  END IF;
  -- A REASONING DEPENDENCY IS NEVER MATERIAL CONSENT - proven STRUCTURALLY.
  -- An unbounded negative pattern cannot express this invariant. PostgreSQL
  -- evaluates `~` with newline-sensitive matching OFF, so a `.` matches a
  -- NEWLINE and spans the whole body; and this body legitimately REASONS about
  -- REASONING_DEPENDENCY a few statements away from where it writes approvers.
  -- The invariant was never "the word reasoning must not precede
  -- approver_user_id". It is: there is exactly ONE approver-writing path, and it
  -- derives its approvers only from MATERIAL_DEPENDENCY source authority. So the
  -- writes are COUNTED, and that one statement is READ and proven by exact
  -- shape - bounded by its own statement terminator, so nothing outside it can
  -- satisfy or violate the proof.
  IF (length(p.prosrc) - length(replace(p.prosrc, 'INSERT INTO public.shared_world_history_item_required_approvers', '')))
     / length('INSERT INTO public.shared_world_history_item_required_approvers') <> 1 THEN
    RAISE EXCEPTION 'I-04G: the QANDEEL core must write a required approver in exactly one place';
  END IF;
  IF p.prosrc ~ 'UPDATE public\.shared_world_history_item_required_approvers'
     OR p.prosrc ~ 'DELETE FROM public\.shared_world_history_item_required_approvers' THEN
    RAISE EXCEPTION 'I-04G: the QANDEEL core must write a required approver in exactly one place';
  END IF;
  approver_write := substr(p.prosrc, strpos(p.prosrc, 'INSERT INTO public.shared_world_history_item_required_approvers'));
  approver_write := left(approver_write, strpos(approver_write, ';'));
  IF length(approver_write) = 0 THEN
    RAISE EXCEPTION 'I-04G: the one QANDEEL approver write must be one complete bounded statement';
  END IF;
  IF approver_write !~ 'SELECT DISTINCT p_history_item_id, ra\.approver_user_id'
     OR approver_write !~ 'FROM public\.shared_world_materials m'
     OR approver_write !~ 'JOIN public\.shared_world_history_item_required_approvers ra ON ra\.history_item_id = m\.history_item_id'
     OR approver_write !~ 'WHERE m\.id = ANY\(sources\)' THEN
    RAISE EXCEPTION 'I-04G: the one QANDEEL approver write must derive approvers from the MATERIAL_DEPENDENCY source authorities alone';
  END IF;
  IF approver_write ~* 'reasoning|source_context_ref|grantor' THEN
    RAISE EXCEPTION 'I-04G: a reasoning dependency is never material consent: no reasoning grantor becomes an approver';
  END IF;
  IF p.prosrc !~ 'p_readiness_ref <> recomputed_readiness' OR p.prosrc !~ 'p_output_digest <> digest' THEN
    RAISE EXCEPTION 'I-04G: exact I-03 operation evidence must bind these exact body bytes, recomputed rather than trusted';
  END IF;
  -- THE SUPPLIED AUDIENCE SNAPSHOT IS REVALIDATED, not merely stored: it must be
  -- the canonical I-03D fingerprint of the CURRENT audience of the EXACT World.
  IF p.prosrc !~ 'QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1' THEN
    RAISE EXCEPTION 'I-04G: the supplied audience snapshot must be recomputed against the frozen I-03D fingerprint';
  END IF;
  IF p.prosrc !~ 'IF p_audience_snapshot_ref <> current_audience_ref THEN' THEN
    RAISE EXCEPTION 'I-04G: stale audience evidence must refuse the commit, never silently retarget it';
  END IF;

  -- EVERY SURFACE DERIVES ITS OWN AUDIENCE, ACCEPTS NO VIEWER LIST, AND BINDS ITS
  -- WHOLE IMMUTABLE REQUEST INTO ONE DURABLE IDENTITY.
  FOREACH fn IN ARRAY ARRAY[human_core, qandeel_fn] LOOP
    SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.prosrc !~ 'public\.resolve_shared_world_human_audience_snapshot_v1\(p_world_id\)' THEN
      RAISE EXCEPTION 'I-04G: % must derive the exact current audience through the frozen I-03D boundary', fn;
    END IF;
    IF p.prosrc !~ 'INSERT INTO public\.shared_world_history_item_baseline_viewers' THEN
      RAISE EXCEPTION 'I-04G: % must write the exact original delivery audience as baseline viewers', fn;
    END IF;
    IF p.prosrc !~ 'QANDEEL_CWV2_SHARED_MATERIAL_COMMIT_REQUEST_V1' THEN
      RAISE EXCEPTION 'I-04G: % must bind its whole immutable request into one versioned durable identity', fn;
    END IF;
    IF p.prosrc !~ 'committed\.request_ref = request' THEN
      RAISE EXCEPTION 'I-04G: % must decide retry equivalence on the whole request identity, not on part of it', fn;
    END IF;
    IF p.prosrc !~ 'INSERT INTO public\.shared_world_material_historical_authority' THEN
      RAISE EXCEPTION 'I-04G: % must record the historical-sharing authority resolution of what it commits', fn;
    END IF;
  END LOOP;
  -- A RETRY ANSWERS FROM COMMITTED TRUTH. Returning a count taken from the retry's
  -- own input arrays would make a conflicting retry describe itself.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = qandeel_fn::regprocedure;
  IF p.prosrc ~ 'committed\.baseline_viewer_count, approvers, material_edges, reasoning_edges' THEN
    RAISE EXCEPTION 'I-04G: a retry must report committed dependency counts, never the arrays it was called with';
  END IF;
  IF (length(p.prosrc) - length(replace(p.prosrc, 'INTO db_material_edges, db_reasoning_edges', '')))
     / length('INTO db_material_edges, db_reasoning_edges') <> 3 THEN
    RAISE EXCEPTION 'I-04G: every one of the three retry paths must read its counts from committed rows';
  END IF;

  -- THE HISTORICAL WIDENING GATE EXISTS AND GUARDS THE EXACT FROZEN I-04F TABLE.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
     WHERE tg.tgrelid = 'public.shared_world_history_package_manifest_items'::regclass
       AND tg.tgname = 'shared_world_material_historical_widening_gate'
       AND NOT tg.tgisinternal
  ) THEN
    RAISE EXCEPTION 'I-04G: unresolved historical-sharing authority must be refused where widening actually happens';
  END IF;

  -- NO CALLER-SUPPLIED ACTOR, AUDIENCE, AUTHORITY, COUNT OR CLOCK, on any
  -- surface. The exact parameter list is pinned first, so each ban below is
  -- non-vacuous by construction.
  SELECT pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = human_core::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m IS NULL OR a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_world_id','p_material_id','p_history_item_id',
                       'p_material_kind','p_body_text','p_audio_object_ref','p_transcript_text','p_duration_ms'] THEN
    RAISE EXCEPTION 'I-04G: % must accept exactly its frozen identity and body list, not %', human_core, in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'actor|author_|author$|user_id|viewer|baseline|approver|member|episode|audience|authority|evidence|digest|instant|timestamp|_at$|count|availability|revision|launch|gate|safety|entitlement' THEN
      RAISE EXCEPTION 'I-04G: % must not accept an actor, audience, authority, count or clock parameter', human_core;
    END IF;
  END LOOP;

  SELECT pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = qandeel_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m IS NULL OR a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_world_id','p_material_id','p_history_item_id',
                       'p_material_kind','p_body_text','p_effective_context_ref','p_output_digest',
                       'p_source_disclosure_gate_ref','p_authority_revalidation_ref','p_readiness_ref',
                       'p_audience_snapshot_ref','p_material_source_ids','p_reasoning_source_refs'] THEN
    RAISE EXCEPTION 'I-04G: % must accept exactly its frozen identity, body and evidence list, not %', qandeel_fn, in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'actor|author_|author$|user_id|viewer|baseline|approver|member|episode|audience_human|audience_user|instant|timestamp|_at$|count|availability|revision|launch_gate|system_safety|entitlement|moderation' THEN
      RAISE EXCEPTION 'I-04G: % must not accept an actor, viewer list, approver, count or clock parameter', qandeel_fn;
    END IF;
  END LOOP;

  SELECT pr.proargnames, pr.proargmodes INTO p FROM pg_proc pr WHERE pr.oid = delete_fn::regprocedure;
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m IS NULL OR a.m::text = 'i') INTO in_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_command_id','p_world_id','p_material_id','p_material_deleted_event_id'] THEN
    RAISE EXCEPTION 'I-04G: % must accept exactly the four opaque persistence identities, not %', delete_fn, in_names;
  END IF;
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'actor|owner|author_|author$|user_id|viewer|approver|member|episode|audience|reason|instant|timestamp|_at$|count|availability|revision|body|transcript|audio|content' THEN
      RAISE EXCEPTION 'I-04G: % must not accept an owner, actor, reason, clock or content parameter', delete_fn;
    END IF;
  END LOOP;

  -- THE TWO NAMED HUMAN PRIMITIVES PIN THEIR OWN KIND AS A LITERAL, so no caller
  -- chooses which kind of material their statement becomes.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = text_fn::regprocedure;
  IF p.prosrc !~ '''HUMAN_TEXT'', p_body_text, NULL, NULL, NULL' THEN
    RAISE EXCEPTION 'I-04G: % must commit HUMAN_TEXT and nothing else', text_fn;
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = voice_fn::regprocedure;
  IF p.prosrc !~ '''HUMAN_VOICE_NOTE'', NULL, p_audio_object_ref, p_transcript_text, p_duration_ms' THEN
    RAISE EXCEPTION 'I-04G: % must commit HUMAN_VOICE_NOTE and nothing else', voice_fn;
  END IF;

  -- THE ONE MATERIAL READ BOUNDARY AND THE ONE HISTORY ENTRY POINT BOTH STAY
  -- EXACTLY AS THEY ARE: this migration narrows nothing and opens nothing.
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role') THEN
    IF NOT has_function_privilege('service_role', resolver_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04G: service_role must still execute the ONE narrow material resolver';
    END IF;
    IF NOT has_function_privilege('service_role', entry_point_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04G: service_role must still execute the ONE historical visibility entry point';
    END IF;
  END IF;

  -- THE REVIEWED I-04E TOPOLOGY TRIGGERS AND THE I-04F TEMPORAL-TRUTH TRIGGER
  -- MUST STILL BE IN PLACE: this slice writes history availability THROUGH the
  -- frozen revision semantics, never around them.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
     WHERE tg.tgrelid = 'public.shared_world_history_items'::regclass
       AND tg.tgname = 'shared_world_history_item_immutable_truth'
       AND NOT tg.tgisinternal
  ) THEN
    RAISE EXCEPTION 'I-04G: the frozen I-04F temporal-truth trigger must still guard every availability transition';
  END IF;
END$$;

COMMIT;
