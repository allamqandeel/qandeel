-- S5-02 — Public Publishing, Rights, Draft / Review & Privacy Closure v1.
--
-- Forward-only. No historical migration is edited. This migration does three things, in the order the Task Contract
-- binds them, and nothing else:
--
--   A. ASSURE-F05 / QAN-BL-CW-01 — PHYSICAL ERASURE. When canonical Shared owner deletion destroys a HUMAN source that a
--      Public package copied as a SOURCE_CONTENT_BEARING_DERIVATIVE, the package's retained copy of those bytes is
--      destroyed in the SAME transaction, at the SAME canonical deletion instant: the public body row, and both durable
--      content verifiers of it (`publication_package_manifest_items.public_body_digest` and
--      `publication_package_item_provenance.captured_source_digest`, each an unsalted SHA-256 of the exact deleted bytes
--      — the 0122 precedent: a digest of bytes that no longer exist is the last copy of the thing the owner deleted).
--      Audit identity survives: the manifest, the Experience / version, every package item and its ordinal and
--      classification, the sealed provenance identity, the per-item authority, the required approver set, every
--      approval and withdrawal, and the erasure fact and instant. Rows already in the unsafe state are erased forward;
--      contradictory state refuses deployment. Both review boundaries go dark for a package that is no longer intact.
--   B. THE 64 → 80 NAME RECONCILIATION (Product Owner, S5-01 R1). The full valid account Name (≤ 80, 0123) is now
--      representable as an I-05 REAL_NAME label: the display relation, the identity command answer, both frozen
--      identity primitives and the S5-01 bridge move their ceiling from 64 to 80. Nothing is truncated; the account
--      Name limit is unchanged.
--   C. THE S5-02 AUTHORING PRODUCT BOUNDARY, above the frozen I-05 runtime and NOT a second one: owner commands in the
--      new non-exposed schema `public_authoring_private`, each deriving the human from `auth.uid()`, each admitted by
--      the frozen Public audience gate, each composing the frozen 0093 / 0094 / 0119 / 0121 primitives as their owner.
--      The first real authoring act (starting a Draft) provisions the ONE I-05 Public Identity (E2E-H-08), with the mode
--      and label derived from the account by the ONE S5-01 derivation — never supplied. The lifecycle this boundary can
--      reach is DRAFT → READY_FOR_REVIEW and nothing else.
--
-- What stays impossible, and is asserted at the end: no application role executes a frozen I-05 primitive; nothing
-- here calls the publish boundary or the CW2-08 prerequisite seam; the seam still answers NOT_EVALUATED; no function
-- here can write PUBLISHED or ABSENT_FROM_PUBLIC_WORLD; no Public Voice derivative, Replay, semantic placement,
-- discussion, Public QANDEEL, vitality, search or Launch path is created.
--
-- ## Content-verifier census (the whole Public package path; S5-02 Task Contract §3.2)
--
--   public_experience_text_derivative_bodies.public_text_body      CONTENT                      → row DELETED
--   publication_package_manifest_items.public_body_digest           sha256(exact public bytes)   → ERASED (NULL)
--   publication_package_item_provenance.captured_source_digest      sha256(exact source bytes)   → ERASED (NULL)
--   publication_package_prepare_commands.request_ref                ids only (actor, experience,
--                                                                   manifest, version, item@source) → kept
--   *.authority_request_fingerprint / bound_authority_fingerprint   action, target, audience,
--                                                                   readiness, ids, source SCOPE
--                                                                   (ids), approvers, snapshot   → kept
--   public_experience_draft_commands / review_ready_commands /
--   publication_approval_withdrawal_commands .request_ref          ids only                     → kept
--   public_identity_commands.request_ref                            the display LABEL's digest
--                                                                   (public identity, not source
--                                                                   content)                     → kept
--   this migration's own relations                                  none carries content         → n/a
--
-- Every kept value is built only from identifiers, vocabulary and counts the row already holds in plain form, so none
-- of them can confirm a guess about the deleted bytes. ANALYTICAL_DERIVATIVE items are not touched: CW2-02 §27 keeps
-- legitimate historical analysis, and their serving already fails closed on availability.
--
-- ## The one-way exception to the 0092 immutability guard
--
-- The trigger and its function NAME are unchanged on all seven package relations; the function body is forward-
-- replaced with exactly three permitted operations, each re-proving canonical truth inside the trigger itself:
--
--   provenance  captured_source_digest  sha256:… → NULL        (+ captured_digest_erased_at := the deletion instant)
--   items       content_state  CONTENT_PRESENT → ERASED_BY_OWNER, public_body_digest → NULL (+ the same instant)
--   bodies      DELETE of the body of an item already ERASED_BY_OWNER
--
-- and only for a SHARED_WORLD SOURCE_CONTENT_BEARING_DERIVATIVE whose exact source history item is terminal
-- DELETED_BY_OWNER, whose Shared body is physically gone, and whose canonical MATERIAL_DELETED event carries that
-- exact instant. Every other UPDATE and every other DELETE of every package relation is refused, as before, for every
-- role including the table owner. There is no way back to CONTENT_PRESENT, no replacement digest, no tombstone text.
--
-- ## Lock order
--
-- Owner deletion keeps its canonical order (World → material → history item → transitive targets) and only then
-- erases already-committed, immutable Public package rows. No Public primitive ever locks those rows for update, so
-- the erasure adds no edge to the canonical Public order (singleton → Experience → manifest → Shared World →
-- materials → history items) and cannot close a cycle. A preparation that holds its Shared World lock first is waited
-- for; the deletion then sees, and erases, the package it committed. A deletion that holds the World lock first makes
-- the waiting preparation re-read a DELETED_BY_OWNER source and fail closed, writing nothing.

BEGIN;

-- =====================================================================================================================
-- B. THE 64 → 80 NAME RECONCILIATION.
-- =====================================================================================================================

ALTER TABLE public.public_identity_display_state DROP CONSTRAINT public_identity_display_label_check;
ALTER TABLE public.public_identity_display_state ADD CONSTRAINT public_identity_display_label_check
    CHECK (length(btrim(display_label)) > 0 AND length(display_label) <= 80);

ALTER TABLE public.public_identity_commands DROP CONSTRAINT public_identity_commands_answer_label_check;
ALTER TABLE public.public_identity_commands ADD CONSTRAINT public_identity_commands_answer_label_check
    CHECK (committed_display_label IS NULL
        OR (length(btrim(committed_display_label)) > 0 AND length(committed_display_label) <= 80));

COMMENT ON CONSTRAINT public_identity_display_label_check ON public.public_identity_display_state IS
  'S5-02: a PUBLIC_DISPLAY_LABEL holds up to 80 characters, so the full valid account Name (0123: 1–80) is representable '
  'as REAL_NAME without truncation. Labels are still not unique.';

-- The two frozen I-05 identity primitives, forward-replaced from their latest definition (0121) with exactly one change
-- each: the label ceiling is 80, not 64. Signature, result columns, idempotency, request identity, the 0121 stored
-- answer and every refusal class are unchanged; both stay executable by no application role.
CREATE OR REPLACE FUNCTION public.ensure_public_identity_v1(
  p_command_id uuid, p_public_identity_ref uuid, p_label_mode text, p_display_label text
) RETURNS TABLE(outcome text, public_identity_ref uuid, label_mode text,
                display_label text, label_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_identity_commands;
  existing public.public_identities;
  display public.public_identity_display_state;
  request text;
  conflict text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_public_identity_ref IS NULL
     OR p_label_mode IS NULL OR p_label_mode NOT IN ('PSEUDONYM', 'REAL_NAME')
     OR p_display_label IS NULL OR length(btrim(p_display_label)) = 0 OR length(p_display_label) > 80
     OR p_public_identity_ref = u THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_IDENTITY_COMMAND_V1' || E'\n'
   || 'kind=ENSURE_PUBLIC_IDENTITY' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'identity=' || lower(p_public_identity_ref::text) || E'\n'
   || 'mode=' || p_label_mode || E'\n'
   || 'label=' || 'sha256:' || encode(sha256(convert_to(p_display_label, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_identity_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- ASSURE-F09: the answer THIS COMMAND committed, never the label the
    -- identity happens to display now.
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.public_identity_ref,
                        answer.label_mode, answer.display_label, answer.label_revision,
                        committed.committed_at
      FROM public.derive_public_identity_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  -- The identity's own row is the serialization point. Two concurrent first
  -- creations collide on UNIQUE (user_id) and the loser re-reads.
  SELECT * INTO existing FROM public.public_identities i WHERE i.user_id = u FOR UPDATE;
  instant := clock_timestamp();
  IF FOUND THEN
    SELECT * INTO display FROM public.public_identity_display_state d
     WHERE d.public_identity_ref = existing.public_identity_ref;
    INSERT INTO public.public_identity_commands
      (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at,
       committed_label_mode, committed_display_label)
    VALUES (p_command_id, 'ENSURE_PUBLIC_IDENTITY', u, existing.public_identity_ref,
            display.label_revision, request, instant, display.label_mode, display.display_label);
    RETURN QUERY SELECT 'ALREADY_PRESENT'::text, existing.public_identity_ref,
                        display.label_mode, display.display_label, display.label_revision, instant;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.public_identities (public_identity_ref, user_id, created_at)
    VALUES (p_public_identity_ref, u, instant);
  EXCEPTION WHEN unique_violation THEN
    -- Two different failures wear the same SQLSTATE, and telling them apart is
    -- the difference between "retry" and "choose another identity": a concurrent
    -- first creation by the same human lost the race on UNIQUE (user_id), while a
    -- reused public ref belongs to somebody else already.
    --
    -- The item is CONSTRAINT_NAME. PostgreSQL's `PG_EXCEPTION_` prefix exists for
    -- DETAIL, HINT and CONTEXT only; the constraint, column, table and schema
    -- items are unprefixed, and an invented name is not a syntax error the
    -- surrounding SQL reveals - plpgsql rejects it when the FUNCTION is created,
    -- and reports it at the line of the closing END.
    GET STACKED DIAGNOSTICS conflict = CONSTRAINT_NAME;
    IF conflict = 'public_identities_user_key' THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
    END IF;
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  INSERT INTO public.public_identity_display_state
    (public_identity_ref, label_mode, display_label, label_revision, updated_at)
  VALUES (p_public_identity_ref, p_label_mode, btrim(p_display_label), 1, instant);
  INSERT INTO public.public_identity_commands
    (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at,
     committed_label_mode, committed_display_label)
  VALUES (p_command_id, 'ENSURE_PUBLIC_IDENTITY', u, p_public_identity_ref, 1, request, instant,
          p_label_mode, btrim(p_display_label));

  RETURN QUERY SELECT 'CREATED'::text, p_public_identity_ref, p_label_mode,
                      btrim(p_display_label), 1::bigint, instant;
END$$;

CREATE OR REPLACE FUNCTION public.update_public_display_label_v1(
  p_command_id uuid, p_label_mode text, p_display_label text
) RETURNS TABLE(outcome text, public_identity_ref uuid, label_mode text,
                display_label text, label_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_identity_commands;
  owned public.public_identities;
  display public.public_identity_display_state;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_label_mode IS NULL OR p_label_mode NOT IN ('PSEUDONYM', 'REAL_NAME')
     OR p_display_label IS NULL OR length(btrim(p_display_label)) = 0 OR length(p_display_label) > 80 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_IDENTITY_COMMAND_V1' || E'\n'
   || 'kind=UPDATE_PUBLIC_DISPLAY_LABEL' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'mode=' || p_label_mode || E'\n'
   || 'label=' || 'sha256:' || encode(sha256(convert_to(p_display_label, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_identity_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- ASSURE-F09: a LATER label change moved the display row, and it did not
    -- move what this command answered.
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.public_identity_ref,
                        answer.label_mode, answer.display_label, answer.label_revision,
                        committed.committed_at
      FROM public.derive_public_identity_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  -- THE ACTOR OWNS THE PUBLIC IDENTITY EXACTLY. There is no identity parameter,
  -- so one human can never rename another human's public presentation.
  SELECT * INTO owned FROM public.public_identities i WHERE i.user_id = u FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  instant := clock_timestamp();
  UPDATE public.public_identity_display_state d
     SET label_mode = p_label_mode, display_label = btrim(p_display_label),
         label_revision = d.label_revision + 1, updated_at = instant
   WHERE d.public_identity_ref = owned.public_identity_ref
  RETURNING * INTO display;

  INSERT INTO public.public_identity_commands
    (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at,
     committed_label_mode, committed_display_label)
  VALUES (p_command_id, 'UPDATE_PUBLIC_DISPLAY_LABEL', u, owned.public_identity_ref,
          display.label_revision, request, instant, display.label_mode, display.display_label);

  RETURN QUERY SELECT 'UPDATED'::text, owned.public_identity_ref, display.label_mode,
                      display.display_label, display.label_revision, instant;
END$$;

-- The S5-01 bridge (0142), forward-replaced with one change: a label up to 80 characters — every valid account Name —
-- is now representable, so the bridge no longer refuses a 65–80-character REAL_NAME. A label the relation still cannot
-- hold (no Name) is refused, never truncated or substituted.
CREATE OR REPLACE FUNCTION public_world_private.sync_account_public_display_v1(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ref uuid;
  v_mode text;
  v_label text;
BEGIN
  SELECT i.public_identity_ref INTO v_ref FROM public.public_identities i WHERE i.user_id = p_user_id;
  IF v_ref IS NULL THEN
    RETURN;
  END IF;
  SELECT d.label_mode, d.display_label INTO v_mode, v_label FROM public_world_private.derive_account_public_display_v1(p_user_id) d;
  IF v_label IS NULL OR length(btrim(v_label)) = 0 OR length(v_label) > 80 THEN
    RAISE EXCEPTION 'PUBLIC_DISPLAY_LABEL_UNREPRESENTABLE' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.public_identity_display_state d
     SET label_mode = v_mode, display_label = v_label, label_revision = d.label_revision + 1, updated_at = clock_timestamp()
   WHERE d.public_identity_ref = v_ref
     AND (d.label_mode IS DISTINCT FROM v_mode OR d.display_label IS DISTINCT FROM v_label);
END$$;

-- =====================================================================================================================
-- A. ASSURE-F05 — PHYSICAL ERASURE OF AN OWNER-DELETED SOURCE-CONTENT-BEARING PUBLIC DERIVATIVE.
-- =====================================================================================================================

-- A.1 THE EXPLICIT ERASURE STATE. Typed columns and structural biconditionals, so the state and the columns are one
--     fact (the 0122 shape). The frozen 0092 digest shape CHECKs still apply to every non-NULL value.
ALTER TABLE public.publication_package_manifest_items
    ADD COLUMN content_state text NOT NULL DEFAULT 'CONTENT_PRESENT',
    ADD COLUMN content_erased_at timestamptz;
ALTER TABLE public.publication_package_manifest_items ALTER COLUMN public_body_digest DROP NOT NULL;
ALTER TABLE public.publication_package_manifest_items
    ADD CONSTRAINT publication_package_manifest_items_content_state_check
        CHECK (content_state IN ('CONTENT_PRESENT', 'ERASED_BY_OWNER')),
    ADD CONSTRAINT publication_package_manifest_items_content_shape_check
        CHECK ((content_state = 'CONTENT_PRESENT' AND public_body_digest IS NOT NULL AND content_erased_at IS NULL)
            OR (content_state = 'ERASED_BY_OWNER' AND public_body_digest IS NULL AND content_erased_at IS NOT NULL
                AND derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'));

COMMENT ON COLUMN public.publication_package_manifest_items.content_state IS
  'S5-02 / ASSURE-F05: CONTENT_PRESENT while the public bytes exist; ERASED_BY_OWNER once the canonical Shared owner '
  'deletion destroyed the source this SOURCE_CONTENT_BEARING_DERIVATIVE copied, and with it the public body and both '
  'content verifiers. One direction only. The item identity, ordinal and classification survive as audit identity.';
COMMENT ON COLUMN public.publication_package_manifest_items.content_erased_at IS
  'The exact canonical owner-deletion instant (the MATERIAL_DELETED event) at which the public bytes were destroyed. '
  'A time, not a verifier.';
COMMENT ON COLUMN public.publication_package_manifest_items.public_body_digest IS
  'The identity of the exact public bytes while they exist. DESTROYED with them by owner deletion (ASSURE-F05): an '
  'unsalted digest of deleted content is a practical verifier of that content, so it may not outlive it.';

ALTER TABLE public.publication_package_item_provenance ADD COLUMN captured_digest_erased_at timestamptz;
ALTER TABLE public.publication_package_item_provenance ALTER COLUMN captured_source_digest DROP NOT NULL;
ALTER TABLE public.publication_package_item_provenance
    ADD CONSTRAINT publication_package_item_provenance_digest_erasure_check
        CHECK ((captured_source_digest IS NOT NULL AND captured_digest_erased_at IS NULL)
            OR (captured_source_digest IS NULL AND captured_digest_erased_at IS NOT NULL AND source_class = 'SHARED_WORLD'));

-- Owner deletion now asks, for every deleted Shared material, which package items copied it: an index on that exact
-- question keeps the deletion path from scanning every package's provenance.
CREATE INDEX publication_package_item_provenance_shared_material_idx
    ON public.publication_package_item_provenance (shared_material_id)
 WHERE shared_material_id IS NOT NULL;

COMMENT ON COLUMN public.publication_package_item_provenance.captured_source_digest IS
  'The captured digest of the exact source bytes, while they exist. DESTROYED by the canonical Shared owner deletion of '
  'that source when the package item is SOURCE_CONTENT_BEARING (ASSURE-F05). The sealed source identity survives.';
COMMENT ON COLUMN public.publication_package_item_provenance.captured_digest_erased_at IS
  'The exact canonical owner-deletion instant at which the captured source digest was destroyed.';

-- A.2 THE ONE-WAY GUARD. Same function name, same seven triggers; exactly three narrow operations are permitted, each
--     proven from canonical truth read HERE rather than trusted from any caller. Everything else is refused exactly as
--     0092 refused it.
CREATE OR REPLACE FUNCTION public.reject_publication_package_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  prov_new public.publication_package_item_provenance;
  item_new public.publication_package_manifest_items;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'publication_package_item_provenance' AND TG_OP = 'UPDATE' THEN
    -- The captured digest goes, the erasure instant arrives, and NOTHING else moves.
    prov_new := NEW;
    prov_new.captured_source_digest := OLD.captured_source_digest;
    prov_new.captured_digest_erased_at := OLD.captured_digest_erased_at;
    IF OLD.captured_source_digest IS NOT NULL AND NEW.captured_source_digest IS NULL
       AND OLD.captured_digest_erased_at IS NULL AND NEW.captured_digest_erased_at IS NOT NULL
       AND NOT (prov_new IS DISTINCT FROM OLD)
       AND OLD.source_class = 'SHARED_WORLD'
       AND EXISTS (SELECT 1 FROM public.publication_package_manifest_items it
                    WHERE it.package_item_id = OLD.package_item_id
                      AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE')
       AND EXISTS (SELECT 1 FROM public.shared_world_history_items i
                    WHERE i.id = OLD.shared_history_item_id AND i.world_id = OLD.shared_world_id
                      AND i.availability_state = 'DELETED_BY_OWNER')
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b WHERE b.material_id = OLD.shared_material_id)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = OLD.shared_material_id)
       AND EXISTS (SELECT 1 FROM public.shared_world_material_deleted_events ev
                    WHERE ev.material_id = OLD.shared_material_id AND ev.world_id = OLD.shared_world_id
                      AND ev.history_item_id = OLD.shared_history_item_id
                      AND ev.occurred_at = NEW.captured_digest_erased_at) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'publication_package_manifest_items' AND TG_OP = 'UPDATE' THEN
    item_new := NEW;
    item_new.content_state := OLD.content_state;
    item_new.public_body_digest := OLD.public_body_digest;
    item_new.content_erased_at := OLD.content_erased_at;
    IF OLD.content_state = 'CONTENT_PRESENT' AND NEW.content_state = 'ERASED_BY_OWNER'
       AND OLD.public_body_digest IS NOT NULL AND NEW.public_body_digest IS NULL
       AND OLD.content_erased_at IS NULL AND NEW.content_erased_at IS NOT NULL
       AND NOT (item_new IS DISTINCT FROM OLD)
       AND OLD.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
       -- The sealed provenance of THIS item already proved the owner deletion, at THIS instant.
       AND EXISTS (SELECT 1 FROM public.publication_package_item_provenance p
                     JOIN public.shared_world_history_items i
                       ON i.id = p.shared_history_item_id AND i.world_id = p.shared_world_id
                    WHERE p.package_item_id = OLD.package_item_id AND p.manifest_version_id = OLD.manifest_version_id
                      AND p.source_class = 'SHARED_WORLD' AND p.captured_source_digest IS NULL
                      AND p.captured_digest_erased_at = NEW.content_erased_at
                      AND i.availability_state = 'DELETED_BY_OWNER') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'public_experience_text_derivative_bodies' AND TG_OP = 'DELETE' THEN
    -- The bytes go only once their own item records the erasure.
    IF EXISTS (SELECT 1 FROM public.publication_package_manifest_items it
                WHERE it.package_item_id = OLD.package_item_id AND it.content_state = 'ERASED_BY_OWNER') THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'PUBLICATION_PACKAGE_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A publication package manifest, its items, its public bodies, its provenance, its authority resolution, its required approver set and its approvals are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed payload is a NEW manifest. The ONE exception (S5-02, ASSURE-F05) is the one-way erasure of an owner-deleted source-content-bearing derivative, proven from canonical truth.';
END$$;

ALTER FUNCTION public.reject_publication_package_mutation_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM PUBLIC;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated, service_role';
ELSE
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_publication_package_mutation_v1() FROM anon, authenticated';
END IF;END$$;

-- A.3 THE S5-02 PRIVATE SCHEMA. Non-exposed; nothing in it is reachable except the owner commands granted in C.
CREATE SCHEMA public_authoring_private;
ALTER SCHEMA public_authoring_private OWNER TO postgres;
REVOKE ALL ON SCHEMA public_authoring_private FROM PUBLIC;

-- A.4 THE ONE ERASURE, called by owner deletion and by nothing else. It erases, for the exact deleted Shared material,
--     every SOURCE_CONTENT_BEARING package item that copied it: provenance digest first (it carries the canonical
--     proof), then the item digest, then the body — and then proves nothing of it survives. Analytical items are
--     never touched. Internal: executable by no application role.
CREATE FUNCTION public_authoring_private.erase_owner_deleted_public_derivatives_v1(p_material_id uuid, p_instant timestamptz)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_items integer;
BEGIN
  IF p_material_id IS NULL OR p_instant IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_DERIVATIVE_ERASURE_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE public.publication_package_item_provenance p
     SET captured_source_digest = NULL, captured_digest_erased_at = p_instant
    FROM public.publication_package_manifest_items it
   WHERE it.package_item_id = p.package_item_id
     AND p.source_class = 'SHARED_WORLD' AND p.shared_material_id = p_material_id
     AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
     AND p.captured_source_digest IS NOT NULL;
  UPDATE public.publication_package_manifest_items it
     SET content_state = 'ERASED_BY_OWNER', public_body_digest = NULL, content_erased_at = p_instant
    FROM public.publication_package_item_provenance p
   WHERE p.package_item_id = it.package_item_id
     AND p.source_class = 'SHARED_WORLD' AND p.shared_material_id = p_material_id
     AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
     AND it.content_state = 'CONTENT_PRESENT';
  GET DIAGNOSTICS v_items = ROW_COUNT;
  DELETE FROM public.public_experience_text_derivative_bodies b
   USING public.publication_package_manifest_items it, public.publication_package_item_provenance p
   WHERE it.package_item_id = b.package_item_id AND p.package_item_id = b.package_item_id
     AND p.source_class = 'SHARED_WORLD' AND p.shared_material_id = p_material_id
     AND it.content_state = 'ERASED_BY_OWNER';
  -- NOTHING OF THE DELETED BYTES SURVIVES IN ANY PACKAGE: no body, no digest, no present item.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
      JOIN public.publication_package_manifest_items it ON it.package_item_id = p.package_item_id
     WHERE p.source_class = 'SHARED_WORLD' AND p.shared_material_id = p_material_id
       AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
       AND (it.content_state <> 'ERASED_BY_OWNER' OR it.public_body_digest IS NOT NULL
            OR p.captured_source_digest IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.public_experience_text_derivative_bodies b WHERE b.package_item_id = it.package_item_id))
  ) THEN
    RAISE EXCEPTION 'PUBLIC_DERIVATIVE_ERASURE_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_items;
END$$;

-- A.4b NO RESURRECTION. The 0092 guard governs UPDATE and DELETE; without this, the table owner could INSERT an erased
--      item's bytes back. A body may be inserted only beside an item whose content is present — which is every item the
--      frozen preparation creates, and never an erased one.
CREATE FUNCTION public_authoring_private.refuse_erased_body_resurrection_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.publication_package_manifest_items it
              WHERE it.package_item_id = NEW.package_item_id AND it.content_state <> 'CONTENT_PRESENT') THEN
    RAISE EXCEPTION 'PUBLICATION_PACKAGE_IS_IMMUTABLE'
      USING ERRCODE = '55000',
            DETAIL = 'An erased Public derivative is never restored: no body may be inserted beside an item its owner''s deletion erased.';
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER public_experience_text_derivative_bodies_no_resurrection
    BEFORE INSERT ON public.public_experience_text_derivative_bodies
    FOR EACH ROW EXECUTE FUNCTION public_authoring_private.refuse_erased_body_resurrection_v1();

-- A.5 CANONICAL OWNER DELETION, forward-replaced from its latest definition (0122) with exactly two changes: the
--     committed-answer retry additionally proves that no Public package retains the deleted bytes or a verifier of
--     them, and the erasure above runs inside the deletion. Its actor, lock order, kind branches, transitive
--     invalidation, terminal transition, events, commands, refusal classes and result columns are unchanged.
CREATE OR REPLACE FUNCTION public.delete_shared_world_owned_material_v1(
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
  -- this path reads current membership or current World state. The committed
  -- answer additionally proves that NO body, NO Introduction payload and NO
  -- payload-derived verifier of the deleted material survives, which is the
  -- whole point of the deletion.
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
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_text_payloads tp
                            JOIN public.introduction_disclosure_resource_versions rv
                              ON rv.id = tp.resource_version_id
                           WHERE rv.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                            JOIN public.introduction_disclosure_resource_versions rv
                              ON rv.id = mp.resource_version_id
                           WHERE rv.material_id = committed.material_id)
           -- ASSURE-F06: and no payload-derived verifier of it either.
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_commands dc
                           WHERE dc.material_id = committed.material_id
                             AND (dc.payload_digest IS NOT NULL OR dc.request_ref IS NOT NULL))
           -- ASSURE-F05 (S5-02): and no Public package retains a copy of it, or a digest of one.
           AND NOT EXISTS (SELECT 1 FROM public.publication_package_item_provenance pp
                             JOIN public.publication_package_manifest_items pit ON pit.package_item_id = pp.package_item_id
                            WHERE pp.source_class = 'SHARED_WORLD' AND pp.shared_material_id = committed.material_id
                              AND pit.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
                              AND (pit.content_state <> 'ERASED_BY_OWNER' OR pit.public_body_digest IS NOT NULL
                                   OR pp.captured_source_digest IS NOT NULL
                                   OR EXISTS (SELECT 1 FROM public.public_experience_text_derivative_bodies pb
                                               WHERE pb.package_item_id = pp.package_item_id)))
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
  -- deletion-versus-grant, deletion-versus-closure, deletion-versus-commit and
  -- deletion-versus-Introduction-END serialize in a single deterministic order
  -- with no deadlock.
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
  -- oracle either. Membership is never consulted: a former member, a closed
  -- World viewer and a human whose Introduction has ended all keep this
  -- authority (CW2-03 section 24 / C21).
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

    -- THE ONE RESERVED BRANCH: an EXPLICIT_DISCLOSURE keeps its protected
    -- payload in the typed Introduction resource relation rather than in a
    -- 0089 body relation, so that is what is destroyed here. Exactly one
    -- payload row exists per delivered resource version - a text one or a
    -- media one, never both and never neither - and the count is asserted, so
    -- a disclosure whose payload was somehow already gone fails closed rather
    -- than reporting a deletion it did not perform. The resource version, its
    -- grant fact and its durable command all SURVIVE: audit identity remains,
    -- source content does not.
    IF owned.material_kind = 'EXPLICIT_DISCLOSURE' THEN
      DELETE FROM public.introduction_disclosure_text_payloads tp
       WHERE tp.resource_version_id IN (
         SELECT rv.id FROM public.introduction_disclosure_resource_versions rv
          WHERE rv.material_id = p_material_id);
      GET DIAGNOSTICS removed = ROW_COUNT;
      DELETE FROM public.introduction_disclosure_media_payloads mp
       WHERE mp.resource_version_id IN (
         SELECT rv.id FROM public.introduction_disclosure_resource_versions rv
          WHERE rv.material_id = p_material_id);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF removed + affected <> 1 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
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

    -- ASSURE-F06: AND THE PAYLOAD-DERIVED VERIFIERS GO WITH THE PAYLOAD.
    --
    -- It is here, after the terminal transition, because that transition is the
    -- guard's proof that an owner deletion is what is happening. It is the same
    -- transaction and the same instant, so nothing observable sits between the
    -- destroyed payload and the destroyed verifier: a failure anywhere rolls
    -- back both, and the committed answer above re-proves the result.
    --
    -- Exactly one command row names one disclosure material, so exactly one row
    -- moves. Zero means the durable command this disclosure must have is not
    -- there, and more than one is impossible; both fail closed rather than
    -- leave a verifier standing.
    IF owned.material_kind = 'EXPLICIT_DISCLOSURE' THEN
      UPDATE public.introduction_disclosure_commands c
         SET verifier_state = 'ERASED_BY_OWNER', payload_digest = NULL, request_ref = NULL,
             verifier_erased_at = delete_instant
       WHERE c.material_id = p_material_id AND c.verifier_state = 'PRESENT';
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      IF EXISTS (SELECT 1 FROM public.introduction_disclosure_commands c
                  WHERE c.material_id = p_material_id
                    AND (c.payload_digest IS NOT NULL OR c.request_ref IS NOT NULL)) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
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

  -- ASSURE-F05 (S5-02): every source-content-bearing Public derivative of this exact material loses its bytes and both
  -- content verifiers HERE - after the terminal DELETED_BY_OWNER transition and the MATERIAL_DELETED fact the guard
  -- reads as its proof, in the same transaction, at the same canonical instant. A failure rolls the whole deletion
  -- back: a committed deletion can never stand beside a surviving Public copy.
  PERFORM public_authoring_private.erase_owner_deleted_public_derivatives_v1(p_material_id, delete_instant);

  RETURN QUERY SELECT 'MATERIAL_DELETED'::text, p_command_id, p_world_id, p_material_id,
                      owned.history_item_id, p_material_deleted_event_id, invalidated, delete_instant;
END$$;

-- A.6 RECONCILING PACKAGES WHOSE SOURCE WAS DELETED UNDER THE OLD RULE. A package item qualifies only when canonical
--     truth proves all of it; the guard re-checks every condition independently. CONTRADICTORY STATE IS NOT
--     NORMALIZED: a source-content-bearing Shared source whose body is gone without an owner deletion, an owner deletion
--     with no canonical MATERIAL_DELETED event, or a DELETED_BY_OWNER source whose body somehow survives, each refuses
--     deployment rather than inventing a history that did not happen.
DO $$
DECLARE
  v_contradictory integer;
  v_reconciled integer;
BEGIN
  SELECT count(*)::integer INTO v_contradictory
    FROM public.publication_package_item_provenance p
    JOIN public.publication_package_manifest_items it ON it.package_item_id = p.package_item_id
    JOIN public.shared_world_history_items i ON i.id = p.shared_history_item_id
   WHERE p.source_class = 'SHARED_WORLD' AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
     AND (
       (i.availability_state <> 'DELETED_BY_OWNER'
          AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b WHERE b.material_id = p.shared_material_id)
          AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = p.shared_material_id))
       OR (i.availability_state = 'DELETED_BY_OWNER'
          AND (EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b WHERE b.material_id = p.shared_material_id)
               OR NOT EXISTS (SELECT 1 FROM public.shared_world_material_deleted_events ev
                               WHERE ev.material_id = p.shared_material_id AND ev.history_item_id = i.id))));
  IF v_contradictory <> 0 THEN
    RAISE EXCEPTION 'S5-02: % source-content-bearing Public package item(s) sit beside contradictory Shared deletion state; refused, not normalized', v_contradictory
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.publication_package_item_provenance p
     SET captured_source_digest = NULL, captured_digest_erased_at = ev.occurred_at
    FROM public.publication_package_manifest_items it, public.shared_world_history_items i,
         public.shared_world_material_deleted_events ev
   WHERE it.package_item_id = p.package_item_id AND i.id = p.shared_history_item_id
     AND ev.material_id = p.shared_material_id AND ev.history_item_id = i.id
     AND p.source_class = 'SHARED_WORLD' AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
     AND i.availability_state = 'DELETED_BY_OWNER' AND p.captured_source_digest IS NOT NULL;
  UPDATE public.publication_package_manifest_items it
     SET content_state = 'ERASED_BY_OWNER', public_body_digest = NULL, content_erased_at = p.captured_digest_erased_at
    FROM public.publication_package_item_provenance p
   WHERE p.package_item_id = it.package_item_id AND p.source_class = 'SHARED_WORLD'
     AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
     AND p.captured_source_digest IS NULL AND p.captured_digest_erased_at IS NOT NULL
     AND it.content_state = 'CONTENT_PRESENT';
  GET DIAGNOSTICS v_reconciled = ROW_COUNT;
  DELETE FROM public.public_experience_text_derivative_bodies b
   USING public.publication_package_manifest_items it
   WHERE it.package_item_id = b.package_item_id AND it.content_state = 'ERASED_BY_OWNER';
  RAISE NOTICE 'S5-02: % already-deleted source-content-bearing Public derivative(s) erased.', v_reconciled;

  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
      JOIN public.publication_package_manifest_items it ON it.package_item_id = p.package_item_id
      JOIN public.shared_world_history_items i ON i.id = p.shared_history_item_id
     WHERE p.source_class = 'SHARED_WORLD' AND it.derivative_classification = 'SOURCE_CONTENT_BEARING_DERIVATIVE'
       AND i.availability_state = 'DELETED_BY_OWNER'
       AND (it.content_state <> 'ERASED_BY_OWNER' OR it.public_body_digest IS NOT NULL OR p.captured_source_digest IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.public_experience_text_derivative_bodies b WHERE b.package_item_id = it.package_item_id))
  ) THEN
    RAISE EXCEPTION 'S5-02: an owner-deleted source still survives in a Public package' USING ERRCODE = 'P0001';
  END IF;
END$$;

-- A.7 IS THIS PACKAGE STILL WHOLE? 'INTACT' only when no item was erased, every item still has its body, and the ONE
--     I-05A authority derivation still accepts every source (available at the captured revision, captured bytes, resolved
--     authority, consistent metadata). Anything else is 'UNAVAILABLE': a partial package is never presented as whole.
--     Internal.
CREATE FUNCTION public_authoring_private.public_package_state_v1(p_manifest_version_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_manifest_version_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.publication_package_manifest_items it WHERE it.manifest_version_id = p_manifest_version_id)
     OR EXISTS (SELECT 1 FROM public.publication_package_manifest_items it
                 WHERE it.manifest_version_id = p_manifest_version_id
                   AND (it.content_state <> 'CONTENT_PRESENT'
                        OR NOT EXISTS (SELECT 1 FROM public.public_experience_text_derivative_bodies b
                                        WHERE b.package_item_id = it.package_item_id))) THEN
    RETURN 'UNAVAILABLE';
  END IF;
  BEGIN
    PERFORM 1 FROM public.derive_public_publication_authority_v1(p_manifest_version_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'UNAVAILABLE';
  END;
  RETURN 'INTACT';
END$$;

-- A.8 THE FROZEN 0093 CONTROLLER REVIEW RESOLVER (service_role-only), forward-replaced with one change: it is dark for
--     a package that is no longer whole, so neither review boundary can serve deleted bytes or a silently partial
--     package. Signature, result columns, STABLE / DEFINER posture, the exact-controller rule and its zero-row answer
--     for everyone else are unchanged, and it still never names sealed provenance itself.
CREATE OR REPLACE FUNCTION public.resolve_public_experience_review_v1(p_experience_id uuid, p_user_id uuid)
RETURNS TABLE(experience_id uuid, current_lifecycle text, experience_version_id uuid,
              version_ordinal integer, manifest_version_id uuid, publisher_public_identity_ref uuid,
              publisher_label_mode text, publisher_display_label text, package_item_id uuid,
              item_ordinal integer, derivative_classification text, public_body_form text,
              public_text_body text, required_approver_count integer,
              satisfied_approval_count integer, approvals_complete boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_experience_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- ASSURE-F05 (S5-02): a package that is no longer whole - an erased item, a source no longer available at its
  -- captured revision, unresolved or contradictory authority - is served to nobody, and never as a smaller package.
  IF NOT EXISTS (SELECT 1 FROM public.public_experiences e
                   JOIN public.public_experience_versions v ON v.id = e.current_experience_version_id
                  WHERE e.id = p_experience_id
                    AND public_authoring_private.public_package_state_v1(v.package_manifest_version_id) = 'INTACT') THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT e.id, e.current_lifecycle, v.id, v.version_ordinal, m.id,
         m.publisher_public_identity_ref, d.label_mode, d.display_label,
         it.package_item_id, it.item_ordinal, it.derivative_classification, it.public_body_form,
         b.public_text_body,
         (SELECT count(*)::integer FROM public.publication_manifest_required_approvers ra
           WHERE ra.manifest_version_id = m.id),
         (SELECT count(*)::integer FROM public.publication_manifest_approvals a
           WHERE a.manifest_version_id = m.id),
         (SELECT count(*) FROM public.publication_manifest_approvals a
           WHERE a.manifest_version_id = m.id)
         = (SELECT count(*) FROM public.publication_manifest_required_approvers ra
             WHERE ra.manifest_version_id = m.id)
    FROM public.public_experiences e
    JOIN public.public_experience_controllers c
      ON c.experience_id = e.id AND c.controller_user_id = p_user_id
    JOIN public.public_experience_versions v ON v.id = e.current_experience_version_id
    JOIN public.publication_package_manifest_versions m ON m.id = v.package_manifest_version_id
    JOIN public.public_identity_display_state d ON d.public_identity_ref = m.publisher_public_identity_ref
    JOIN public.publication_package_manifest_items it ON it.manifest_version_id = m.id
    JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
   WHERE e.id = p_experience_id
   ORDER BY it.item_ordinal;
END$$;

-- =====================================================================================================================
-- C. THE S5-02 AUTHORING PRODUCT BOUNDARY.
-- =====================================================================================================================

-- C.1 Deterministic persistence identities, derived from the actor and the caller's command id, so an equivalent retry
--     names the same rows and no caller supplies an Experience, manifest, version, item or approval identity.
CREATE FUNCTION public_authoring_private.derive_authoring_identity_v1(p_namespace text, p_actor uuid, p_command_id uuid, p_ordinal integer)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S5_02_PUBLIC_AUTHORING_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_actor::text) || E'\n' || lower(p_command_id::text) || E'\n'
                                          || p_ordinal::text, 'UTF8')), 'hex') AS h) d;
$$;

-- C.2 The authoring actor: exactly auth.uid(), admitted NOW by the frozen Public audience gate as a registered viewer.
CREATE FUNCTION public_authoring_private.require_authoring_actor_v1()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resolve_public_audience_admission_v1(v_user) a
                  WHERE a.admission = 'ADMITTED' AND a.viewer_class = 'REGISTERED') THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_NOT_ADMITTED' USING ERRCODE = '42501';
  END IF;
  RETURN v_user;
END$$;

-- C.3 Frozen refusal classes → the bounded, non-enumerating Product outcomes. NULL = not a Product outcome: re-raise.
CREATE FUNCTION public_authoring_private.classify_public_refusal_v1(p_message text)
RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE p_message
    WHEN 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' THEN 'UNAVAILABLE'
    WHEN 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' THEN 'UNAVAILABLE'
    WHEN 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' THEN 'UNAVAILABLE'
    WHEN 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' THEN 'NOT_PUBLISHABLE'
    WHEN 'PUBLIC_EXPERIENCE_SOURCE_KIND_RESERVED' THEN 'NOT_PUBLISHABLE'
    WHEN 'PUBLIC_EXPERIENCE_STALE' THEN 'STALE'
    WHEN 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' THEN 'NOT_DRAFT'
    WHEN 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE' THEN 'APPROVALS_INCOMPLETE'
    ELSE NULL END;
$$;

-- C.4 E2E-H-08: THE ONE PUBLIC IDENTITY, PROVISIONED AT FIRST REAL AUTHORSHIP. The account row is the serialization
--     point (FOR NO KEY UPDATE: it queues behind a Name / Public ID / display-mode change and blocks none of the foreign
--     key checks a concurrent preparation makes against this account), so two first authorings create ONE identity and
--     a concurrent display change can never leave the new identity with a stale label. Mode and label come from the ONE
--     S5-01 derivation; the opaque ref is random and server-side. Internal.
CREATE FUNCTION public_authoring_private.provision_own_public_identity_v1(p_actor uuid)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ref uuid;
  v_mode text;
  v_label text;
BEGIN
  IF p_actor IS NULL OR p_actor IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.users u WHERE u.id = p_actor FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT i.public_identity_ref INTO v_ref FROM public.public_identities i WHERE i.user_id = p_actor;
  IF v_ref IS NOT NULL THEN
    RETURN v_ref;
  END IF;
  SELECT d.label_mode, d.display_label INTO v_mode, v_label
    FROM public_world_private.derive_account_public_display_v1(p_actor) d;
  IF v_label IS NULL OR length(btrim(v_label)) = 0 OR length(v_label) > 80 THEN
    RAISE EXCEPTION 'PUBLIC_DISPLAY_LABEL_UNREPRESENTABLE' USING ERRCODE = 'P0001';
  END IF;
  SELECT e.public_identity_ref INTO v_ref
    FROM public.ensure_public_identity_v1(gen_random_uuid(), gen_random_uuid(), v_mode, v_label) e;
  RETURN v_ref;
END$$;

-- C.5 START A PUBLIC EXPERIENCE DRAFT — the first real authoring act. Provisions the identity, then the frozen Draft.
--     CREATED | ALREADY_CREATED. Control goes to the exact creating human (0093 / 0121).
CREATE FUNCTION public_authoring_private.start_own_public_experience_draft_v1(p_command_id uuid)
RETURNS TABLE (outcome text, experience_id uuid, current_lifecycle text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_experience uuid;
  r record;
BEGIN
  IF p_command_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_experience := public_authoring_private.derive_authoring_identity_v1('EXPERIENCE', v_user, p_command_id, 0);
  PERFORM public_authoring_private.provision_own_public_identity_v1(v_user);
  SELECT d.outcome, d.experience_id, d.current_lifecycle INTO r
    FROM public.create_public_experience_draft_v1(p_command_id, v_experience) d;
  RETURN QUERY SELECT CASE WHEN r.outcome = 'DRAFT_CREATED' THEN 'CREATED' ELSE 'ALREADY_CREATED' END,
                      r.experience_id, r.current_lifecycle;
END$$;

-- C.6 THE CONTROLLER'S OWN DRAFTS: Experiences this human controls that are not public (DRAFT, READY_FOR_REVIEW).
CREATE FUNCTION public_authoring_private.list_own_public_drafts_v1()
RETURNS TABLE (experience_id uuid, current_lifecycle text, created_at timestamptz, has_package boolean, item_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
BEGIN
  RETURN QUERY
    SELECT e.id, e.current_lifecycle, e.created_at, e.current_experience_version_id IS NOT NULL,
           coalesce((SELECT m.item_count FROM public.public_experience_versions v
                       JOIN public.publication_package_manifest_versions m ON m.id = v.package_manifest_version_id
                      WHERE v.id = e.current_experience_version_id), 0)
      FROM public.public_experiences e
      JOIN public.public_experience_controllers c ON c.experience_id = e.id AND c.controller_user_id = v_user
     WHERE e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW')
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT 50;
END$$;

-- C.7 ELIGIBLE EXISTING MATERIAL. The human's OWN committed Personal text (USER units; Personal QANDEEL analysis has no
--     resolvable authority and is not offered), and the text material of each Shared World they currently belong to
--     that the ONE frozen 0089 resolver lets them see, is still available, has a packageable kind and RESOLVED source
--     authority. Selection is not source-access authority: preparation re-proves every one of these under its own locks.
--     Nothing else is enumerable: no other human's Personal material, no World the human is not in, nothing hidden.
CREATE FUNCTION public_authoring_private.list_own_public_authoring_sources_v1()
RETURNS TABLE (source_kind text, source_id uuid, world_id uuid, material_kind text, established_at timestamptz,
               is_self boolean, author_name text, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_world uuid;
BEGIN
  RETURN QUERY
    SELECT 'PERSONAL'::text, cu.id, NULL::uuid, NULL::text, cu.created_at, true, NULL::text, cu.committed_text
      FROM public.conversation_units cu
     WHERE cu.user_id = v_user AND cu.source_role = 'USER'
     ORDER BY cu.created_at DESC, cu.id DESC
     LIMIT 50;
  FOR v_world IN
    SELECT e.world_id FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE'
     ORDER BY w.born_at, w.id
  LOOP
    RETURN QUERY
      SELECT 'SHARED'::text, m.material_id, m.world_id, m.material_kind, m.established_at,
             coalesce(m.author_user_id = v_user, false),
             CASE WHEN m.author_user_id IS NULL THEN NULL ELSE u.name END,
             m.text_body
        FROM public.resolve_shared_world_material_v1(v_world, v_user) m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id AND i.availability_state = 'AVAILABLE'
        JOIN public.shared_world_material_historical_authority ha
          ON ha.material_id = m.material_id
         AND ha.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT')
        LEFT JOIN public.users u ON u.id = m.author_user_id
       WHERE m.text_body IS NOT NULL AND m.material_kind IN ('HUMAN_TEXT', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')
       ORDER BY m.established_at DESC, m.material_id DESC
       LIMIT 50;
  END LOOP;
END$$;

-- C.8 PREPARE THE IMMUTABLE PACKAGE from 1–20 exact selected sources. The frozen 0119 preparation derives every body,
--     classification, ordinal, provenance, authority and rightsholder; this command supplies only which sources, and
--     opaque identities derived from its own command id. PREPARED | ALREADY_PREPARED | UNAVAILABLE | NOT_PUBLISHABLE |
--     STALE | NOT_DRAFT — one non-enumerating UNAVAILABLE for anything the human may not see or does not exist.
CREATE FUNCTION public_authoring_private.prepare_own_public_experience_package_v1(
  p_command_id uuid, p_experience_id uuid, p_personal_unit_ids uuid[], p_shared_world_ids uuid[], p_shared_material_ids uuid[]
) RETURNS TABLE (outcome text, item_count integer, required_approver_count integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_personal integer := coalesce(array_length(p_personal_unit_ids, 1), 0);
  v_shared integer := coalesce(array_length(p_shared_material_ids, 1), 0);
  v_personal_items uuid[];
  v_shared_items uuid[];
  v_class text;
  r record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_personal_unit_ids IS NULL OR p_shared_world_ids IS NULL
     OR p_shared_material_ids IS NULL OR v_shared <> coalesce(array_length(p_shared_world_ids, 1), 0)
     OR v_personal + v_shared < 1 OR v_personal + v_shared > 20 THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(public_authoring_private.derive_authoring_identity_v1('ITEM', v_user, p_command_id, g) ORDER BY g), ARRAY[]::uuid[])
    INTO v_personal_items FROM generate_series(1, v_personal) g;
  SELECT coalesce(array_agg(public_authoring_private.derive_authoring_identity_v1('ITEM', v_user, p_command_id, v_personal + g) ORDER BY g), ARRAY[]::uuid[])
    INTO v_shared_items FROM generate_series(1, v_shared) g;
  BEGIN
    SELECT d.outcome, d.item_count, d.required_approver_count INTO r
      FROM public.prepare_public_experience_manifest_v1(
             p_command_id, p_experience_id,
             public_authoring_private.derive_authoring_identity_v1('MANIFEST', v_user, p_command_id, 0),
             public_authoring_private.derive_authoring_identity_v1('VERSION', v_user, p_command_id, 0),
             v_personal_items, p_personal_unit_ids, v_shared_items, p_shared_world_ids, p_shared_material_ids) d;
  EXCEPTION WHEN OTHERS THEN
    v_class := public_authoring_private.classify_public_refusal_v1(SQLERRM);
    IF v_class IS NULL THEN RAISE; END IF;
    RETURN QUERY SELECT v_class, NULL::integer, NULL::integer;
    RETURN;
  END;
  RETURN QUERY SELECT CASE WHEN r.outcome = 'PACKAGE_PREPARED' THEN 'PREPARED' ELSE 'ALREADY_PREPARED' END,
                      r.item_count, r.required_approver_count;
END$$;

-- C.9 THE CONTROLLER'S REVIEW of exactly what is proposed to become public. Zero rows for a non-controller or an
--     Experience that does not exist (no oracle). NO_PACKAGE before preparation. UNAVAILABLE — with no item and no
--     byte — when the package is no longer whole (an erased item, a source no longer available at its captured
--     revision, unresolved or contradictory authority). CURRENT otherwise: one row per item with its exact public bytes,
--     the publisher's CURRENT public display, and bounded approval progress (counts, and this human's own state —
--     never another approver's identity). No sealed provenance, account identifier, World or Session leaves here.
CREATE FUNCTION public_authoring_private.read_own_public_experience_review_v1(p_experience_id uuid)
RETURNS TABLE (review_state text, current_lifecycle text, version_ordinal integer, manifest_version_id uuid, publisher_label_mode text,
               publisher_display_label text, item_count integer, required_approver_count integer,
               effective_approval_count integer, own_approval_state text, ready_allowed boolean,
               item_ordinal integer, derivative_classification text, public_text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_experience public.public_experiences;
  v_version public.public_experience_versions;
  v_manifest public.publication_package_manifest_versions;
  v_display public.public_identity_display_state;
  v_fingerprint text;
  v_required integer;
  v_effective integer;
  v_own text;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT e.* INTO v_experience FROM public.public_experiences e
    JOIN public.public_experience_controllers c ON c.experience_id = e.id AND c.controller_user_id = v_user
   WHERE e.id = p_experience_id AND e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW');
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT d.* INTO v_display FROM public.public_identity_display_state d
   WHERE d.public_identity_ref = v_experience.created_by_public_identity_ref;
  IF v_experience.current_experience_version_id IS NULL THEN
    RETURN QUERY SELECT 'NO_PACKAGE'::text, v_experience.current_lifecycle, NULL::integer, NULL::uuid, v_display.label_mode,
                        v_display.display_label, 0, 0, 0, 'NOT_REQUIRED'::text, false, NULL::integer, NULL::text, NULL::text;
    RETURN;
  END IF;
  SELECT v.* INTO v_version FROM public.public_experience_versions v WHERE v.id = v_experience.current_experience_version_id;
  SELECT m.* INTO v_manifest FROM public.publication_package_manifest_versions m WHERE m.id = v_version.package_manifest_version_id;
  IF public_authoring_private.public_package_state_v1(v_manifest.id) <> 'INTACT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, v_experience.current_lifecycle, v_version.version_ordinal, v_manifest.id, v_display.label_mode,
                        v_display.display_label, v_manifest.item_count, NULL::integer, NULL::integer, NULL::text, false,
                        NULL::integer, NULL::text, NULL::text;
    RETURN;
  END IF;
  SELECT d.authority_fingerprint INTO v_fingerprint FROM public.derive_public_publication_authority_v1(v_manifest.id) d;
  SELECT count(*)::integer INTO v_required FROM public.publication_manifest_required_approvers ra
   WHERE ra.manifest_version_id = v_manifest.id;
  SELECT count(*) FILTER (WHERE s.effective_state = 'EFFECTIVE' AND s.bound_authority_fingerprint = v_fingerprint)::integer
    INTO v_effective FROM public.derive_publication_manifest_effective_approvals_v1(v_manifest.id) s;
  SELECT CASE WHEN s.effective_state = 'EFFECTIVE' AND s.bound_authority_fingerprint IS DISTINCT FROM v_fingerprint
              THEN 'STALE' ELSE s.effective_state END
    INTO v_own FROM public.derive_publication_manifest_effective_approvals_v1(v_manifest.id) s
   WHERE s.approving_user_id = v_user;
  RETURN QUERY
    SELECT 'CURRENT'::text, v_experience.current_lifecycle, v_version.version_ordinal, v_manifest.id, v_display.label_mode,
           v_display.display_label, v_manifest.item_count, v_required, v_effective, coalesce(v_own, 'NOT_REQUIRED'),
           v_experience.current_lifecycle = 'DRAFT' AND v_effective = v_required,
           it.item_ordinal, it.derivative_classification, b.public_text_body
      FROM public.publication_package_manifest_items it
      JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
     WHERE it.manifest_version_id = v_manifest.id
     ORDER BY it.item_ordinal;
END$$;

-- C.10 THE APPROVER'S OWN REQUESTS. Every CURRENT package (the current version of a non-public Experience) that requires
--      THIS human's content approval. An intact request shows the publisher's public display, the package size, bounded
--      progress, this human's own approval state, and ONLY this human's own included material — the exact bytes they are
--      asked to let become public. Nothing of any other rightsholder's material, any approver's identity, any World, any
--      Session or any provenance. A request whose package is no longer whole is UNAVAILABLE with no byte.
CREATE FUNCTION public_authoring_private.list_own_public_approval_requests_v1()
RETURNS TABLE (manifest_version_id uuid, request_state text, current_lifecycle text, publisher_label_mode text,
               publisher_display_label text, item_count integer, own_item_count integer, required_approver_count integer,
               effective_approval_count integer, own_approval_state text, item_ordinal integer, public_text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  m record;
  v_fingerprint text;
  v_required integer;
  v_effective integer;
  v_own text;
  v_own_items integer;
BEGIN
  FOR m IN
    SELECT mv.id, mv.item_count, mv.created_at, e.current_lifecycle, d.label_mode, d.display_label
      FROM public.publication_manifest_required_approvers ra
      JOIN public.publication_package_manifest_versions mv ON mv.id = ra.manifest_version_id
      JOIN public.public_experience_versions v ON v.package_manifest_version_id = mv.id
      JOIN public.public_experiences e ON e.id = mv.experience_id AND e.current_experience_version_id = v.id
      JOIN public.public_identity_display_state d ON d.public_identity_ref = mv.publisher_public_identity_ref
     WHERE ra.approver_user_id = v_user AND e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW')
     ORDER BY mv.created_at DESC, mv.id DESC
     LIMIT 50
  LOOP
    IF public_authoring_private.public_package_state_v1(m.id) <> 'INTACT' THEN
      RETURN QUERY SELECT m.id, 'UNAVAILABLE'::text, m.current_lifecycle, m.label_mode, m.display_label, m.item_count,
                          NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::text;
      CONTINUE;
    END IF;
    SELECT d.authority_fingerprint INTO v_fingerprint FROM public.derive_public_publication_authority_v1(m.id) d;
    SELECT count(*)::integer INTO v_required FROM public.publication_manifest_required_approvers ra WHERE ra.manifest_version_id = m.id;
    SELECT count(*) FILTER (WHERE s.effective_state = 'EFFECTIVE' AND s.bound_authority_fingerprint = v_fingerprint)::integer
      INTO v_effective FROM public.derive_publication_manifest_effective_approvals_v1(m.id) s;
    SELECT CASE WHEN s.effective_state = 'EFFECTIVE' AND s.bound_authority_fingerprint IS DISTINCT FROM v_fingerprint
                THEN 'STALE' ELSE s.effective_state END
      INTO v_own FROM public.derive_publication_manifest_effective_approvals_v1(m.id) s WHERE s.approving_user_id = v_user;
    SELECT count(*)::integer INTO v_own_items
      FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = m.id
       AND ((p.source_class = 'MY_WORLD' AND p.personal_owner_user_id = v_user)
            OR (p.source_class = 'SHARED_WORLD' AND EXISTS (
                  SELECT 1 FROM public.shared_world_history_item_required_approvers hra
                   WHERE hra.history_item_id = p.shared_history_item_id AND hra.approver_user_id = v_user)));
    RETURN QUERY
      SELECT m.id, 'CURRENT'::text, m.current_lifecycle, m.label_mode, m.display_label, m.item_count, v_own_items,
             v_required, v_effective, coalesce(v_own, 'MISSING'), it.item_ordinal, b.public_text_body
        FROM public.publication_package_item_provenance p
        JOIN public.publication_package_manifest_items it ON it.package_item_id = p.package_item_id
        JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = p.package_item_id
       WHERE p.manifest_version_id = m.id
         AND ((p.source_class = 'MY_WORLD' AND p.personal_owner_user_id = v_user)
              OR (p.source_class = 'SHARED_WORLD' AND EXISTS (
                    SELECT 1 FROM public.shared_world_history_item_required_approvers hra
                     WHERE hra.history_item_id = p.shared_history_item_id AND hra.approver_user_id = v_user)))
       ORDER BY it.item_ordinal;
  END LOOP;
END$$;

-- C.11 APPROVE an exact CURRENT package as the exact required human. The frozen 0093 approval binds the exact manifest,
--      the CURRENT authority fingerprint and PUBLISH_TO_PUBLIC_WORLD; its composite key makes an approval by anyone the
--      manifest does not require unrepresentable. APPROVED | ALREADY_DECIDED (an approval — effective or withdrawn — of
--      this manifest already exists; a withdrawn one is never resurrected) | UNAVAILABLE | STALE | NOT_DRAFT.
CREATE FUNCTION public_authoring_private.approve_own_public_package_v1(p_command_id uuid, p_manifest_version_id uuid)
RETURNS TABLE (outcome text, own_approval_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_approval uuid;
  v_existing public.publication_manifest_approvals;
  v_class text;
BEGIN
  IF p_command_id IS NULL OR p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_approval := public_authoring_private.derive_authoring_identity_v1('APPROVAL', v_user, p_command_id, 0);
  -- A CURRENT request for THIS human, or one neutral answer.
  IF NOT EXISTS (
    SELECT 1 FROM public.publication_manifest_required_approvers ra
      JOIN public.publication_package_manifest_versions mv ON mv.id = ra.manifest_version_id
      JOIN public.public_experience_versions v ON v.package_manifest_version_id = mv.id
      JOIN public.public_experiences e ON e.id = mv.experience_id AND e.current_experience_version_id = v.id
     WHERE ra.manifest_version_id = p_manifest_version_id AND ra.approver_user_id = v_user
  ) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text;
    RETURN;
  END IF;
  SELECT a.* INTO v_existing FROM public.publication_manifest_approvals a
   WHERE a.manifest_version_id = p_manifest_version_id AND a.approver_user_id = v_user;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.id = v_approval THEN 'APPROVED' ELSE 'ALREADY_DECIDED' END,
                        (SELECT s.effective_state FROM public.derive_publication_approval_effective_state_v1(v_existing.id) s);
    RETURN;
  END IF;
  IF public_authoring_private.public_package_state_v1(p_manifest_version_id) <> 'INTACT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text;
    RETURN;
  END IF;
  BEGIN
    PERFORM 1 FROM public.approve_public_experience_manifest_v1(v_approval, p_manifest_version_id);
  EXCEPTION
    WHEN unique_violation THEN
      IF EXISTS (SELECT 1 FROM public.publication_manifest_approvals a
                  WHERE a.manifest_version_id = p_manifest_version_id AND a.approver_user_id = v_user) THEN
        RETURN QUERY SELECT 'ALREADY_DECIDED'::text, NULL::text;
        RETURN;
      END IF;
      RAISE;
    WHEN OTHERS THEN
      v_class := public_authoring_private.classify_public_refusal_v1(SQLERRM);
      IF v_class IS NULL THEN RAISE; END IF;
      RETURN QUERY SELECT v_class, NULL::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'APPROVED'::text, 'EFFECTIVE'::text;
END$$;

-- C.12 WITHDRAW this human's own approval of an exact package, through the frozen 0094 append-only withdrawal. In any
--      lifecycle; effective immediately. WITHDRAWN | ALREADY_WITHDRAWN | UNAVAILABLE.
CREATE FUNCTION public_authoring_private.withdraw_own_public_approval_v1(p_command_id uuid, p_manifest_version_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_approval uuid;
  v_class text;
  r record;
BEGIN
  IF p_command_id IS NULL OR p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.id INTO v_approval FROM public.publication_manifest_approvals a
   WHERE a.manifest_version_id = p_manifest_version_id AND a.approver_user_id = v_user;
  IF v_approval IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  BEGIN
    SELECT d.outcome, d.effective_state INTO r FROM public.withdraw_publication_approval_v1(p_command_id, v_approval) d;
  EXCEPTION WHEN OTHERS THEN
    v_class := public_authoring_private.classify_public_refusal_v1(SQLERRM);
    IF v_class IS NULL THEN RAISE; END IF;
    RETURN QUERY SELECT v_class;
    RETURN;
  END;
  RETURN QUERY SELECT CASE WHEN r.outcome = 'ALREADY_WITHDRAWN' THEN 'ALREADY_WITHDRAWN' ELSE 'WITHDRAWN' END;
END$$;

-- C.13 DRAFT → READY_FOR_REVIEW, only with CURRENT complete authority. Under the canonical Public prefix (the ONE Public
--      World, then the exact Experience — the same two locks every withdrawal takes first), the package must be whole
--      and EVERY required approval EFFECTIVE (never withdrawn, never superseded) and bound to the CURRENT authority
--      fingerprint; only then the frozen 0121 commit, which re-derives everything under the Shared source locks. A
--      controller can never stand in for a missing content approval. READY_FOR_REVIEW | ALREADY_READY |
--      APPROVALS_INCOMPLETE | NO_PACKAGE | UNAVAILABLE | STALE | NOT_DRAFT. Nothing here publishes.
CREATE FUNCTION public_authoring_private.commit_own_public_experience_ready_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text, current_lifecycle text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_experience public.public_experiences;
  v_manifest uuid;
  v_fingerprint text;
  v_class text;
  r record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT e.* INTO v_experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                               WHERE c.experience_id = p_experience_id AND c.controller_user_id = v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text;
    RETURN;
  END IF;
  -- An equivalent retry of a committed READY answers from the frozen command history.
  IF EXISTS (SELECT 1 FROM public.public_experience_review_ready_commands c WHERE c.id = p_command_id) THEN
    SELECT d.outcome, d.current_lifecycle INTO r
      FROM public.commit_public_experience_ready_for_review_v1(p_command_id, p_experience_id, v_experience.current_experience_version_id) d;
    RETURN QUERY SELECT 'ALREADY_READY'::text, r.current_lifecycle;
    RETURN;
  END IF;
  IF v_experience.current_lifecycle <> 'DRAFT' THEN
    RETURN QUERY SELECT 'NOT_DRAFT'::text, v_experience.current_lifecycle;
    RETURN;
  END IF;
  IF v_experience.current_experience_version_id IS NULL THEN
    RETURN QUERY SELECT 'NO_PACKAGE'::text, v_experience.current_lifecycle;
    RETURN;
  END IF;
  SELECT v.package_manifest_version_id INTO v_manifest FROM public.public_experience_versions v
   WHERE v.id = v_experience.current_experience_version_id;
  IF public_authoring_private.public_package_state_v1(v_manifest) <> 'INTACT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, v_experience.current_lifecycle;
    RETURN;
  END IF;
  SELECT d.authority_fingerprint INTO v_fingerprint FROM public.derive_public_publication_authority_v1(v_manifest) d;
  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(v_manifest) s
              WHERE s.effective_state <> 'EFFECTIVE' OR s.bound_authority_fingerprint IS DISTINCT FROM v_fingerprint) THEN
    RETURN QUERY SELECT 'APPROVALS_INCOMPLETE'::text, v_experience.current_lifecycle;
    RETURN;
  END IF;
  BEGIN
    SELECT d.outcome, d.current_lifecycle INTO r
      FROM public.commit_public_experience_ready_for_review_v1(p_command_id, p_experience_id, v_experience.current_experience_version_id) d;
  EXCEPTION WHEN OTHERS THEN
    v_class := public_authoring_private.classify_public_refusal_v1(SQLERRM);
    IF v_class IS NULL THEN RAISE; END IF;
    RETURN QUERY SELECT v_class, v_experience.current_lifecycle;
    RETURN;
  END;
  RETURN QUERY SELECT 'READY_FOR_REVIEW'::text, r.current_lifecycle;
END$$;

-- C.14 The exposed wrappers: SECURITY INVOKER, each a one-line call into its definer.
CREATE FUNCTION public.start_own_public_experience_draft_v1(p_command_id uuid)
RETURNS TABLE (outcome text, experience_id uuid, current_lifecycle text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.experience_id, r.current_lifecycle FROM public_authoring_private.start_own_public_experience_draft_v1(p_command_id) r;
$$;
CREATE FUNCTION public.list_own_public_drafts_v1()
RETURNS TABLE (experience_id uuid, current_lifecycle text, created_at timestamptz, has_package boolean, item_count integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.experience_id, r.current_lifecycle, r.created_at, r.has_package, r.item_count FROM public_authoring_private.list_own_public_drafts_v1() r;
$$;
CREATE FUNCTION public.list_own_public_authoring_sources_v1()
RETURNS TABLE (source_kind text, source_id uuid, world_id uuid, material_kind text, established_at timestamptz,
               is_self boolean, author_name text, text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.source_kind, r.source_id, r.world_id, r.material_kind, r.established_at, r.is_self, r.author_name, r.text_body
    FROM public_authoring_private.list_own_public_authoring_sources_v1() r;
$$;
CREATE FUNCTION public.prepare_own_public_experience_package_v1(
  p_command_id uuid, p_experience_id uuid, p_personal_unit_ids uuid[], p_shared_world_ids uuid[], p_shared_material_ids uuid[]
) RETURNS TABLE (outcome text, item_count integer, required_approver_count integer)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.item_count, r.required_approver_count
    FROM public_authoring_private.prepare_own_public_experience_package_v1(p_command_id, p_experience_id, p_personal_unit_ids,
           p_shared_world_ids, p_shared_material_ids) r;
$$;
CREATE FUNCTION public.read_own_public_experience_review_v1(p_experience_id uuid)
RETURNS TABLE (review_state text, current_lifecycle text, version_ordinal integer, manifest_version_id uuid, publisher_label_mode text,
               publisher_display_label text, item_count integer, required_approver_count integer,
               effective_approval_count integer, own_approval_state text, ready_allowed boolean,
               item_ordinal integer, derivative_classification text, public_text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.review_state, r.current_lifecycle, r.version_ordinal, r.manifest_version_id, r.publisher_label_mode, r.publisher_display_label, r.item_count,
         r.required_approver_count, r.effective_approval_count, r.own_approval_state, r.ready_allowed, r.item_ordinal,
         r.derivative_classification, r.public_text_body
    FROM public_authoring_private.read_own_public_experience_review_v1(p_experience_id) r;
$$;
CREATE FUNCTION public.list_own_public_approval_requests_v1()
RETURNS TABLE (manifest_version_id uuid, request_state text, current_lifecycle text, publisher_label_mode text,
               publisher_display_label text, item_count integer, own_item_count integer, required_approver_count integer,
               effective_approval_count integer, own_approval_state text, item_ordinal integer, public_text_body text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.manifest_version_id, r.request_state, r.current_lifecycle, r.publisher_label_mode, r.publisher_display_label,
         r.item_count, r.own_item_count, r.required_approver_count, r.effective_approval_count, r.own_approval_state,
         r.item_ordinal, r.public_text_body
    FROM public_authoring_private.list_own_public_approval_requests_v1() r;
$$;
CREATE FUNCTION public.approve_own_public_package_v1(p_command_id uuid, p_manifest_version_id uuid)
RETURNS TABLE (outcome text, own_approval_state text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.own_approval_state FROM public_authoring_private.approve_own_public_package_v1(p_command_id, p_manifest_version_id) r;
$$;
CREATE FUNCTION public.withdraw_own_public_approval_v1(p_command_id uuid, p_manifest_version_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM public_authoring_private.withdraw_own_public_approval_v1(p_command_id, p_manifest_version_id) r;
$$;
CREATE FUNCTION public.commit_own_public_experience_ready_v1(p_command_id uuid, p_experience_id uuid)
RETURNS TABLE (outcome text, current_lifecycle text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.current_lifecycle FROM public_authoring_private.commit_own_public_experience_ready_v1(p_command_id, p_experience_id) r;
$$;

-- =====================================================================================================================
-- D. PRIVILEGES. Ownership; default-deny by name; then the exact grants. Nothing relies on a default (0133).
-- =====================================================================================================================
DO $$
DECLARE
  v_fn text;
  v_owner_commands text[] := ARRAY[
    'public_authoring_private.start_own_public_experience_draft_v1(uuid)',
    'public_authoring_private.list_own_public_drafts_v1()',
    'public_authoring_private.list_own_public_authoring_sources_v1()',
    'public_authoring_private.prepare_own_public_experience_package_v1(uuid, uuid, uuid[], uuid[], uuid[])',
    'public_authoring_private.read_own_public_experience_review_v1(uuid)',
    'public_authoring_private.list_own_public_approval_requests_v1()',
    'public_authoring_private.approve_own_public_package_v1(uuid, uuid)',
    'public_authoring_private.withdraw_own_public_approval_v1(uuid, uuid)',
    'public_authoring_private.commit_own_public_experience_ready_v1(uuid, uuid)',
    'public.start_own_public_experience_draft_v1(uuid)',
    'public.list_own_public_drafts_v1()',
    'public.list_own_public_authoring_sources_v1()',
    'public.prepare_own_public_experience_package_v1(uuid, uuid, uuid[], uuid[], uuid[])',
    'public.read_own_public_experience_review_v1(uuid)',
    'public.list_own_public_approval_requests_v1()',
    'public.approve_own_public_package_v1(uuid, uuid)',
    'public.withdraw_own_public_approval_v1(uuid, uuid)',
    'public.commit_own_public_experience_ready_v1(uuid, uuid)'];
  v_internal text[] := ARRAY[
    'public_authoring_private.erase_owner_deleted_public_derivatives_v1(uuid, timestamptz)',
    'public_authoring_private.public_package_state_v1(uuid)',
    'public_authoring_private.derive_authoring_identity_v1(text, uuid, uuid, integer)',
    'public_authoring_private.require_authoring_actor_v1()',
    'public_authoring_private.classify_public_refusal_v1(text)',
    'public_authoring_private.provision_own_public_identity_v1(uuid)',
    'public_authoring_private.refuse_erased_body_resurrection_v1()'];
BEGIN
  FOREACH v_fn IN ARRAY v_owner_commands || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    -- The server channel holds nothing here: every S5-02 act is the human's own, under the human's own token.
    EXECUTE 'REVOKE ALL ON SCHEMA public_authoring_private FROM service_role';
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_authoring_private TO authenticated';
  FOREACH v_fn IN ARRAY v_owner_commands LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END$$;

-- =====================================================================================================================
-- E. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_fn text;
  v_role text;
  p record;
BEGIN
  -- E1. No application role executes a frozen I-05 primitive. The review resolver stays service_role-only.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.ensure_public_identity_v1(uuid, uuid, text, text)',
    'public.update_public_display_label_v1(uuid, text, text)',
    'public.create_public_experience_draft_v1(uuid, uuid)',
    'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])',
    'public.approve_public_experience_manifest_v1(uuid, uuid)',
    'public.withdraw_publication_approval_v1(uuid, uuid)',
    'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)',
    'public.publish_public_experience_v1(uuid, uuid, uuid)',
    'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
    'public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)'] LOOP
    IF has_function_privilege('public', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S5-02: PUBLIC executes the frozen primitive %', v_fn;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = v_role) AND has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S5-02: % executes the frozen primitive %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;
  IF has_function_privilege('authenticated', 'public.resolve_public_experience_review_v1(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.resolve_public_experience_review_v1(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S5-02: the frozen review resolver is client-executable';
  END IF;

  -- E2. Publication stays impossible: the CW2-08 seam answers NOT_EVALUATED, and nothing S5-02 owns names the publish
  --     boundary, the seam, or a public lifecycle.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'S5-02: the CW2-08 prerequisite seam must still answer NOT_EVALUATED';
  END IF;
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public_authoring_private'
               OR (n.nspname = 'public' AND pr.proname IN ('start_own_public_experience_draft_v1', 'list_own_public_drafts_v1',
                   'list_own_public_authoring_sources_v1', 'prepare_own_public_experience_package_v1',
                   'read_own_public_experience_review_v1', 'list_own_public_approval_requests_v1',
                   'approve_own_public_package_v1', 'withdraw_own_public_approval_v1', 'commit_own_public_experience_ready_v1')) LOOP
    IF p.prosrc ~ 'publish_public_experience_v1' OR p.prosrc ~ 'resolve_public_publication_prerequisites_v1'
       OR p.prosrc ~ '''PUBLISHED''' OR p.prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD' OR p.prosrc ~ 'semantic_placement'
       OR p.prosrc ~ 'public_discussion' OR p.prosrc ~ 'public_qandeel' OR p.prosrc ~ 'update_public_display_label_v1' THEN
      RAISE EXCEPTION 'S5-02: % reaches beyond DRAFT → READY_FOR_REVIEW', p.proname;
    END IF;
  END LOOP;

  -- E3. Every S5-02 function is a pinned postgres-owned SECURITY DEFINER (private) or a pinned INVOKER (public wrapper).
  FOR p IN SELECT n.nspname, pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'public_authoring_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S5-02: public_authoring_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;

  -- E4. The one-way guard is still the trigger function of all seven package relations, and owner deletion erases.
  IF (SELECT count(*) FROM pg_trigger tg WHERE NOT tg.tgisinternal
        AND tg.tgfoid = 'public.reject_publication_package_mutation_v1()'::regprocedure) <> 7 THEN
    RAISE EXCEPTION 'S5-02: all seven publication package relations must keep the one append-only guard';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = 'public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'public_authoring_private\.erase_owner_deleted_public_derivatives_v1\(p_material_id, delete_instant\)' THEN
    RAISE EXCEPTION 'S5-02: canonical owner deletion must erase the Public derivative in the same transaction and instant';
  END IF;

  -- E5. Exactly one function destroys a Public derivative body, and it is the erasure owner deletion calls.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND pr.prorettype <> 'trigger'::regtype
         AND pr.prosrc ~ 'DELETE FROM public\.public_experience_text_derivative_bodies') <> 1 THEN
    RAISE EXCEPTION 'S5-02: exactly one function may destroy a Public derivative body';
  END IF;

  -- E6. The signed-out policy is untouched and there is still one Public World.
  IF (SELECT count(*) FROM public.public_world_state) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state p2 WHERE p2.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'S5-02: one Public World, and the signed-out policy still UNRESOLVED';
  END IF;
END$$;

COMMIT;
