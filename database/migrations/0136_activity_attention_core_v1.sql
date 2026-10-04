-- A3-01 — Activity & Attention Core: the Product notification / Activity spine (Stage 3).
--
-- Authority consumed, never redefined: I-08N-01 (the Notification & Proactive Attention Product contract) and the P3
-- closure (its final Product realization). This migration is the durable half of the spine:
--
--   source event truth (owned by its source domain)
--     → a typed Product notification CANDIDATE, published by trusted server code only (server_publish_…)
--     → the per-user Activity PROJECTION (public.activity_items) — a user-facing projection, never the event store (D29)
--     → attention state on that projection (NEW → SEEN → OPENED) — attention only, never source resolution (D31, D40, D47)
--     → in-app presentation evidence (presented_in_app_at) — evidence only where it truly happened (D41, D56)
--
-- What this migration deliberately is NOT:
--   * not a source of truth for any event: an item carries an opaque `source_ref` back to its source and nothing here
--     writes, resolves or reads any source domain's table (no Shared / Public / Introductions / Replay / Memory table is
--     read; the Connected Worlds membership tables stay unreachable, as 0075 §3 requires);
--   * not the HIM / HSE "attention" measurement (0014, 0057): no table, function or column of those is referenced;
--   * not a Push transport: no device, token, provider, channel or category exists here (A3-02);
--   * not a score, weight, threshold or ranking: the interruption class (D10) is a fact the PRODUCER supplies;
--   * not a delivery queue: nothing here is ever "flushed".
--
-- ## Implementation policy (NOT Product authority)
--
-- I-08N-01 §21 and P3 §18 leave storage, pagination and retention unfrozen, and D32 says retention follows Product
-- meaning, not one universal expiry. No Product retention period is promised here. As a bounded, safe implementation
-- default only: a publish removes the recipient's items whose last occurrence is older than 90 days, and keeps at most
-- 2000 items per recipient (oldest first), at most 100 rows per publish. A coalesced item keeps at most 64 members.
-- Each is a constant in this file; changing one is an implementation change, not a Product change.
--
-- ## The privilege boundary (the W3-02 rule, restated after 0133)
--
-- Owner commands are SECURITY DEFINER functions in the non-exposed `activity_private`; the `public` Product RPCs are
-- SECURITY INVOKER pass-throughs, so the caller is only ever `auth.uid()` and no command takes an account parameter.
-- Owners may SELECT their own items, preferences and mutes (RLS) and nothing else; no client role may write any table.
-- The two server passes (publish, withdraw) are SECURITY DEFINER in `public` (the Data API's exposed schema) and are
-- executable by `service_role` ONLY. Nothing is granted to `anon`. Every grant is explicit (0133).
--
-- ## Erasure
--
-- Every table names its account with `user_id REFERENCES public.users (id) ON DELETE CASCADE`: the governed Personal
-- erasure (0130), which deletes `public.users` last, leaves no row linked to anybody — the same law 0135 relies on.
--
-- Forward-only. Migrations 0001–0135 are byte-unchanged.
BEGIN;

CREATE SCHEMA activity_private;
REVOKE ALL ON SCHEMA activity_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The per-user Activity projection.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.activity_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  -- I-08N-01 D28 / D30: the five semantic categories, kept per item. Activity is never a World.
  category text NOT NULL,
  -- The candidate kind: which frozen eligibility row (D23–D27) the source domain published under.
  kind text NOT NULL,
  -- D10: the event's interruption value, supplied by the producer. Class 1 is reserved to critical security.
  interruption_class smallint NOT NULL,
  -- D06 / D36 / P3 §9: the two exception facts, each only where its kind allows it.
  critical boolean NOT NULL DEFAULT false,
  requested boolean NOT NULL DEFAULT false,
  -- The originating context and its authority scope (D28). `context_ref` is an opaque reference the source domain owns.
  context_kind text NOT NULL,
  context_ref text,
  context_label_ar text,
  context_label_en text,
  -- D38–D43: one typed Direct Entry descriptor. Revalidated at open; never assumed from publish time.
  entry_destination text NOT NULL,
  entry_ref text,
  -- D18: who speaks. QANDEEL Voice only where QANDEEL genuinely initiates.
  speaker text NOT NULL,
  -- The bounded in-app presentation the producer rendered (D21): one primary sentence, optional secondary context.
  body_ar text,
  body_en text,
  secondary_ar text,
  secondary_en text,
  -- P3 §4: an item that still needs the user after it is seen keeps a WAITING mark.
  actionable boolean NOT NULL DEFAULT false,
  -- D14 / D17: what this ONE event's bounded safe projection can truthfully carry outside the Product (a fact about the
  -- event, never a category rule). Consumed by platform delivery (A3-02); the user's ceiling still bounds it.
  disclosure_max text NOT NULL,
  -- D09: same-context low-value repetition only. Computed here, never supplied by a producer.
  coalesce_key text,
  member_count integer NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL,
  last_occurred_at timestamptz NOT NULL,
  -- D59: the semantic expiry of the interruption's timing window, when the source knows one.
  expires_at timestamptz,
  -- The source event was withdrawn / revoked by its domain. A withdrawn item never resurrects.
  withdrawn_at timestamptz,
  -- Attention state (D31): NEW → SEEN → OPENED, forward only. Never the source event's state.
  attention text NOT NULL DEFAULT 'NEW',
  seen_at timestamptz,
  opened_at timestamptz,
  -- In-app presentation evidence (D41): the one ordinary strip actually shown; or the interruption settled without one
  -- (re-evaluated and not chosen — "no dump"). Neither touches the source.
  presented_in_app_at timestamptz,
  interruption_settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_items_category_check CHECK (category IN ('QANDEEL', 'SHARED', 'PUBLIC', 'INTRODUCTIONS', 'SYSTEM')),
  CONSTRAINT activity_items_kind_check CHECK (
    (category = 'QANDEEL' AND kind IN ('PROACTIVE', 'REMINDER'))
    OR (category = 'SHARED' AND kind = 'SHARED_ACTIVITY')
    OR (category = 'PUBLIC' AND kind IN ('PUBLIC_INTERACTION', 'PUBLIC_DISCOVERY'))
    OR (category = 'INTRODUCTIONS' AND kind = 'INTRODUCTION')
    OR (category = 'SYSTEM' AND kind IN ('ACCOUNT', 'SECURITY'))),
  CONSTRAINT activity_items_class_check CHECK (interruption_class BETWEEN 1 AND 4 AND (interruption_class <> 1 OR critical)),
  CONSTRAINT activity_items_critical_check CHECK (NOT critical OR kind = 'SECURITY'),
  CONSTRAINT activity_items_requested_check CHECK (NOT requested OR kind = 'REMINDER'),
  CONSTRAINT activity_items_context_check CHECK (
    (category = 'QANDEEL' AND context_kind = 'PERSONAL' AND context_ref IS NULL)
    OR (category = 'SHARED' AND context_kind = 'SHARED_WORLD' AND context_ref IS NOT NULL)
    OR (category = 'PUBLIC' AND context_kind = 'PUBLIC_WORLD')
    OR (category = 'INTRODUCTIONS' AND context_kind = 'INTRODUCTIONS')
    OR (category = 'SYSTEM' AND context_kind = 'ACCOUNT' AND context_ref IS NULL)),
  CONSTRAINT activity_items_context_ref_check CHECK (context_ref IS NULL OR char_length(context_ref) BETWEEN 1 AND 200),
  CONSTRAINT activity_items_context_label_check CHECK (
    (context_label_ar IS NULL OR char_length(context_label_ar) BETWEEN 1 AND 120)
    AND (context_label_en IS NULL OR char_length(context_label_en) BETWEEN 1 AND 120)),
  -- Direct Entry stays inside its own authority scope: no item can name a destination in another World (D43).
  CONSTRAINT activity_items_entry_check CHECK (
    entry_destination = 'NONE'
    OR (context_kind = 'PERSONAL' AND entry_destination IN ('PERSONAL_CONVERSATION', 'QANDEEL_UNDERSTANDING'))
    OR (context_kind = 'SHARED_WORLD' AND entry_destination IN ('SHARED_WORLD', 'REPLAY'))
    OR (context_kind = 'PUBLIC_WORLD' AND entry_destination = 'PUBLIC_WORLD')
    OR (context_kind = 'INTRODUCTIONS' AND entry_destination = 'INTRODUCTIONS')
    OR (context_kind = 'ACCOUNT' AND entry_destination = 'GENERAL_SETTINGS')),
  CONSTRAINT activity_items_entry_ref_check CHECK (
    (entry_destination IN ('NONE', 'PERSONAL_CONVERSATION', 'QANDEEL_UNDERSTANDING') AND entry_ref IS NULL)
    OR (entry_destination = 'GENERAL_SETTINGS' AND entry_ref IN ('SECURITY', 'ACCOUNT', 'NOTIFICATIONS'))
    OR (entry_destination IN ('SHARED_WORLD', 'PUBLIC_WORLD', 'INTRODUCTIONS', 'REPLAY')
        AND entry_ref IS NOT NULL AND char_length(entry_ref) BETWEEN 1 AND 200)),
  CONSTRAINT activity_items_speaker_check CHECK (speaker = 'PRODUCT' OR (speaker = 'QANDEEL' AND category = 'QANDEEL')),
  CONSTRAINT activity_items_body_check CHECK (
    (body_ar IS NOT NULL OR body_en IS NOT NULL)
    AND (body_ar IS NULL OR char_length(body_ar) BETWEEN 1 AND 280)
    AND (body_en IS NULL OR char_length(body_en) BETWEEN 1 AND 280)
    AND (secondary_ar IS NULL OR char_length(secondary_ar) BETWEEN 1 AND 280)
    AND (secondary_en IS NULL OR char_length(secondary_en) BETWEEN 1 AND 280)),
  CONSTRAINT activity_items_disclosure_check CHECK (disclosure_max IN ('L0', 'L1', 'L2', 'L3')),
  CONSTRAINT activity_items_member_count_check CHECK (member_count >= 1),
  CONSTRAINT activity_items_time_check CHECK (last_occurred_at >= occurred_at),
  CONSTRAINT activity_items_attention_check CHECK (
    (attention = 'NEW' AND seen_at IS NULL AND opened_at IS NULL)
    OR (attention = 'SEEN' AND seen_at IS NOT NULL AND opened_at IS NULL)
    OR (attention = 'OPENED' AND opened_at IS NOT NULL))
);

-- The feed's keyset (newest first) and the coalescing probe.
CREATE INDEX activity_items_feed_idx ON public.activity_items (user_id, last_occurred_at DESC, id DESC);
CREATE INDEX activity_items_coalesce_idx ON public.activity_items (user_id, coalesce_key)
  WHERE coalesce_key IS NOT NULL AND attention = 'NEW' AND withdrawn_at IS NULL;

-- One delivery intent = one member (D57): a stable candidate identity, de-duplicated per recipient. A coalesced item has
-- several members; each keeps its own source reference, so withdrawing one source is exact. Server-only.
CREATE TABLE public.activity_item_members (
  item_id uuid NOT NULL REFERENCES public.activity_items (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  source_ref text NOT NULL,
  occurred_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  CONSTRAINT activity_item_members_pkey PRIMARY KEY (user_id, candidate_key),
  CONSTRAINT activity_item_members_key_check CHECK (char_length(candidate_key) BETWEEN 1 AND 200),
  CONSTRAINT activity_item_members_source_check CHECK (char_length(source_ref) BETWEEN 1 AND 200)
);
CREATE INDEX activity_item_members_item_idx ON public.activity_item_members (item_id);
CREATE INDEX activity_item_members_source_idx ON public.activity_item_members (user_id, source_ref);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The user's notification preferences (P3 §12–§13; I-08N-01 D33–D37). No row = the frozen defaults.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.activity_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  -- P3 §12.1: Allow / Reduce / Off. Interruption only (D35); never Memory, Understanding or Analysis.
  proactive text NOT NULL DEFAULT 'ALLOW',
  shared_alerts boolean NOT NULL DEFAULT true,
  public_interactions boolean NOT NULL DEFAULT true,
  -- D03 / P3 §12.2: Public Discovery is opt-in — OFF until chosen.
  public_discovery boolean NOT NULL DEFAULT false,
  introductions_alerts boolean NOT NULL DEFAULT true,
  -- "Other account updates". Critical security has NO off switch (D36) and therefore no column.
  account_updates boolean NOT NULL DEFAULT true,
  -- P3 §13: Quiet Hours ON, 23:00 → 08:00 device-local, as minutes of the day.
  quiet_hours_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start smallint NOT NULL DEFAULT 1380,
  quiet_hours_end smallint NOT NULL DEFAULT 480,
  snooze_until timestamptz,
  -- D15 defaults; each a CEILING, never a requirement (D17). L3 is never a default.
  lock_qandeel text NOT NULL DEFAULT 'L1',
  lock_shared text NOT NULL DEFAULT 'L2',
  lock_public text NOT NULL DEFAULT 'L2',
  lock_discovery text NOT NULL DEFAULT 'L1',
  lock_introductions text NOT NULL DEFAULT 'L0',
  lock_reminders text NOT NULL DEFAULT 'L2',
  lock_account text NOT NULL DEFAULT 'L2',
  lock_security text NOT NULL DEFAULT 'L2',
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_preferences_proactive_check CHECK (proactive IN ('ALLOW', 'REDUCE', 'OFF')),
  CONSTRAINT activity_preferences_quiet_check CHECK (
    quiet_hours_start BETWEEN 0 AND 1439 AND quiet_hours_end BETWEEN 0 AND 1439 AND quiet_hours_start <> quiet_hours_end),
  CONSTRAINT activity_preferences_lock_check CHECK (
    lock_qandeel IN ('L0', 'L1', 'L2', 'L3') AND lock_shared IN ('L0', 'L1', 'L2', 'L3')
    AND lock_public IN ('L0', 'L1', 'L2', 'L3') AND lock_discovery IN ('L0', 'L1', 'L2', 'L3')
    AND lock_introductions IN ('L0', 'L1', 'L2', 'L3') AND lock_reminders IN ('L0', 'L1', 'L2', 'L3')
    AND lock_account IN ('L0', 'L1', 'L2', 'L3') AND lock_security IN ('L0', 'L1', 'L2', 'L3'))
);

-- D34: muting one context mutes no other. A mute names a Shared context the recipient's own Activity already knows.
CREATE TABLE public.activity_context_mutes (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  context_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_context_mutes_pkey PRIMARY KEY (user_id, context_ref),
  CONSTRAINT activity_context_mutes_ref_check CHECK (char_length(context_ref) BETWEEN 1 AND 200)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. The server passes: publish one candidate for one recipient; withdraw a source. service_role only.
-- ---------------------------------------------------------------------------------------------------------------------

-- Publishes ONE candidate to ONE recipient. Idempotent per (recipient, candidate_key): a replay answers DUPLICATE and
-- changes nothing (D57 — technical repetition is never a new notification). Every candidate is judged by every frozen
-- constraint as its own row first. Low-value repetition in the SAME exact context, of the same kind, class, voice and
-- Direct Entry, then coalesces into the still-unseen item (D09); nothing actionable,
-- critical or Class ≤ 2 ever coalesces, and nothing across categories, contexts or authorities can (the key holds all
-- of them). A coalesced item shows its latest member's sentence; coalescing creates no truth.
CREATE FUNCTION public.server_publish_activity_candidate_v1(
  p_user_id uuid, p_candidate_key text, p_source_ref text, p_category text, p_kind text, p_interruption_class integer,
  p_critical boolean, p_requested boolean, p_context_kind text, p_context_ref text, p_context_label_ar text,
  p_context_label_en text, p_entry_destination text, p_entry_ref text, p_speaker text, p_body_ar text, p_body_en text,
  p_secondary_ar text, p_secondary_en text, p_actionable boolean, p_disclosure_max text, p_occurred_at timestamptz,
  p_expires_at timestamptz)
RETURNS TABLE (outcome text, item_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_key text;
  v_target uuid;
  v_new uuid;
BEGIN
  IF p_user_id IS NULL OR p_candidate_key IS NULL OR p_source_ref IS NULL OR p_occurred_at IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_CANDIDATE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= p_occurred_at THEN
    RAISE EXCEPTION 'ACTIVITY_CANDIDATE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'ACTIVITY_RECIPIENT_UNKNOWN' USING ERRCODE = '22023';
  END IF;

  -- One recipient's publications serialize; the per-candidate primary key settles every race.
  PERFORM pg_advisory_xact_lock(hashtextextended('qandeel.activity:' || p_user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.activity_item_members m WHERE m.user_id = p_user_id AND m.candidate_key = p_candidate_key) THEN
    RETURN QUERY SELECT 'DUPLICATE'::text, m.item_id FROM public.activity_item_members m
      WHERE m.user_id = p_user_id AND m.candidate_key = p_candidate_key;
    RETURN;
  END IF;

  IF p_interruption_class >= 3 AND NOT coalesce(p_actionable, false) AND NOT coalesce(p_critical, false) THEN
    v_key := concat_ws('|', p_category, p_kind, p_interruption_class::text, p_speaker, p_context_kind, coalesce(p_context_ref, '-'),
      p_entry_destination, coalesce(p_entry_ref, '-'));
  END IF;

  -- EVERY candidate is first written as its own row, so every frozen constraint of the projection judges ITS facts —
  -- a coalescing candidate included (an invalid one is refused here, never silently absorbed into another item).
  INSERT INTO public.activity_items (user_id, category, kind, interruption_class, critical, requested, context_kind,
      context_ref, context_label_ar, context_label_en, entry_destination, entry_ref, speaker, body_ar, body_en,
      secondary_ar, secondary_en, actionable, disclosure_max, coalesce_key, occurred_at, last_occurred_at, expires_at)
    VALUES (p_user_id, p_category, p_kind, p_interruption_class::smallint, coalesce(p_critical, false),
      coalesce(p_requested, false), p_context_kind, p_context_ref, p_context_label_ar, p_context_label_en,
      p_entry_destination, p_entry_ref, p_speaker, p_body_ar, p_body_en, p_secondary_ar, p_secondary_en,
      coalesce(p_actionable, false), p_disclosure_max, v_key, p_occurred_at, p_occurred_at, p_expires_at)
    RETURNING id INTO v_new;

  IF v_key IS NOT NULL THEN
    SELECT i.id INTO v_target FROM public.activity_items i
     WHERE i.user_id = p_user_id AND i.coalesce_key = v_key AND i.id <> v_new AND i.attention = 'NEW'
       AND i.withdrawn_at IS NULL AND (i.expires_at IS NULL OR i.expires_at > CURRENT_TIMESTAMP) AND i.member_count < 64
     ORDER BY i.last_occurred_at DESC LIMIT 1 FOR UPDATE;
  END IF;

  IF v_target IS NOT NULL THEN
    -- Same category, kind, class, voice, exact context and Direct Entry: the low-value repetition folds into the
    -- still-unseen item, which shows its latest member's sentence. The validated row is not kept.
    DELETE FROM public.activity_items i WHERE i.id = v_new;
    UPDATE public.activity_items i SET
        member_count = i.member_count + 1,
        last_occurred_at = greatest(i.last_occurred_at, p_occurred_at),
        body_ar = p_body_ar, body_en = p_body_en, secondary_ar = p_secondary_ar, secondary_en = p_secondary_en,
        context_label_ar = p_context_label_ar, context_label_en = p_context_label_en,
        expires_at = CASE WHEN i.expires_at IS NULL OR p_expires_at IS NULL THEN NULL ELSE greatest(i.expires_at, p_expires_at) END,
        disclosure_max = CASE WHEN p_disclosure_max < i.disclosure_max THEN p_disclosure_max ELSE i.disclosure_max END,
        updated_at = CURRENT_TIMESTAMP
      WHERE i.id = v_target;
    INSERT INTO public.activity_item_members (item_id, user_id, candidate_key, source_ref, occurred_at)
      VALUES (v_target, p_user_id, p_candidate_key, p_source_ref, p_occurred_at);
    RETURN QUERY SELECT 'COALESCED'::text, v_target;
    RETURN;
  END IF;

  INSERT INTO public.activity_item_members (item_id, user_id, candidate_key, source_ref, occurred_at)
    VALUES (v_new, p_user_id, p_candidate_key, p_source_ref, p_occurred_at);

  -- Implementation policy (header): bounded retention, at most 100 rows per publish.
  DELETE FROM public.activity_items i WHERE i.id IN (
    SELECT x.id FROM public.activity_items x
     WHERE x.user_id = p_user_id AND x.id <> v_new
       AND (x.last_occurred_at < CURRENT_TIMESTAMP - interval '90 days'
            OR x.id IN (SELECT y.id FROM public.activity_items y WHERE y.user_id = p_user_id
                         ORDER BY y.last_occurred_at DESC, y.id DESC OFFSET 2000))
     LIMIT 100);

  RETURN QUERY SELECT 'PUBLISHED'::text, v_new;
END;$$;

-- A source domain withdraws / revokes a source event: every member naming it is withdrawn, and an item whose members are
-- all withdrawn is withdrawn (it then reads stale and never resurrects). The attention state is left as it was.
CREATE FUNCTION public.server_withdraw_activity_source_v1(p_user_id uuid, p_source_ref text)
RETURNS TABLE (withdrawn_items integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_source_ref IS NULL THEN RAISE EXCEPTION 'ACTIVITY_SOURCE_INVALID' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('qandeel.activity:' || p_user_id::text, 0));
  UPDATE public.activity_item_members m SET withdrawn_at = CURRENT_TIMESTAMP
   WHERE m.user_id = p_user_id AND m.source_ref = p_source_ref AND m.withdrawn_at IS NULL;
  UPDATE public.activity_items i SET withdrawn_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
   WHERE i.user_id = p_user_id AND i.withdrawn_at IS NULL
     AND EXISTS (SELECT 1 FROM public.activity_item_members m WHERE m.item_id = i.id AND m.source_ref = p_source_ref)
     AND NOT EXISTS (SELECT 1 FROM public.activity_item_members m WHERE m.item_id = i.id AND m.withdrawn_at IS NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The owner's commands. Attention state and preferences only: none of them reads or writes any source domain.
-- ---------------------------------------------------------------------------------------------------------------------

-- Seen (D31): only NEW → SEEN, only the caller's own items, at most 64 per call. Seen is not resolution.
CREATE FUNCTION activity_private.mark_own_activity_items_seen_v1(p_item_ids uuid[])
RETURNS TABLE (seen integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_item_ids IS NULL OR cardinality(p_item_ids) NOT BETWEEN 1 AND 64 OR array_position(p_item_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'ACTIVITY_SEEN_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE public.activity_items i SET attention = 'SEEN', seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
   WHERE i.user_id = v_user AND i.id = ANY (p_item_ids) AND i.attention = 'NEW';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;$$;

-- Opened (D40): the user entered the item. It answers the Direct Entry facts the API revalidates at this moment
-- (D38); it resolves nothing. A stale, withdrawn or foreign item answers nothing but its own staleness.
CREATE FUNCTION activity_private.open_own_activity_item_v1(p_item_id uuid)
RETURNS TABLE (outcome text, category text, context_kind text, context_ref text, entry_destination text, entry_ref text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_item public.activity_items;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_item FROM public.activity_items i WHERE i.id = p_item_id AND i.user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  UPDATE public.activity_items i SET attention = 'OPENED', seen_at = coalesce(i.seen_at, CURRENT_TIMESTAMP),
      opened_at = coalesce(i.opened_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
   WHERE i.id = v_item.id;
  IF v_item.withdrawn_at IS NOT NULL OR (v_item.expires_at IS NOT NULL AND v_item.expires_at <= CURRENT_TIMESTAMP) THEN
    RETURN QUERY SELECT 'STALE'::text, v_item.category, v_item.context_kind, v_item.context_ref, NULL::text, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'OPENED'::text, v_item.category, v_item.context_kind, v_item.context_ref, v_item.entry_destination,
    v_item.entry_ref;
END;$$;

-- In-app presentation evidence: the ONE ordinary strip that was actually shown, and the candidates re-evaluated and not
-- chosen (settled to Activity only — "no dump"). Only the caller's own NEW, not-yet-settled items move.
CREATE FUNCTION activity_private.record_own_activity_strip_v1(p_presented_item_id uuid, p_settled_item_ids uuid[])
RETURNS TABLE (presented integer, settled integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_presented integer := 0;
  v_settled integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_settled_item_ids IS NULL OR cardinality(p_settled_item_ids) > 64 OR array_position(p_settled_item_ids, NULL) IS NOT NULL
     OR (p_presented_item_id IS NULL AND cardinality(p_settled_item_ids) = 0)
     OR (p_presented_item_id IS NOT NULL AND p_presented_item_id = ANY (p_settled_item_ids)) THEN
    RAISE EXCEPTION 'ACTIVITY_STRIP_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_presented_item_id IS NOT NULL THEN
    UPDATE public.activity_items i SET presented_in_app_at = CURRENT_TIMESTAMP,
        interruption_settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE i.id = p_presented_item_id AND i.user_id = v_user AND i.interruption_settled_at IS NULL;
    GET DIAGNOSTICS v_presented = ROW_COUNT;
  END IF;
  IF cardinality(p_settled_item_ids) > 0 THEN
    UPDATE public.activity_items i SET interruption_settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE i.user_id = v_user AND i.id = ANY (p_settled_item_ids) AND i.interruption_settled_at IS NULL;
    GET DIAGNOSTICS v_settled = ROW_COUNT;
  END IF;
  RETURN QUERY SELECT v_presented, v_settled;
END;$$;

-- The whole preference row, replaced in one statement. Snooze is its own command.
CREATE FUNCTION activity_private.set_own_activity_preferences_v1(
  p_proactive text, p_shared_alerts boolean, p_public_interactions boolean, p_public_discovery boolean,
  p_introductions_alerts boolean, p_account_updates boolean, p_quiet_hours_enabled boolean, p_quiet_hours_start integer,
  p_quiet_hours_end integer, p_lock_qandeel text, p_lock_shared text, p_lock_public text, p_lock_discovery text,
  p_lock_introductions text, p_lock_reminders text, p_lock_account text, p_lock_security text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.activity_preferences AS p (user_id, proactive, shared_alerts, public_interactions, public_discovery,
      introductions_alerts, account_updates, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, lock_qandeel,
      lock_shared, lock_public, lock_discovery, lock_introductions, lock_reminders, lock_account, lock_security, updated_at)
    VALUES (v_user, p_proactive, p_shared_alerts, p_public_interactions, p_public_discovery, p_introductions_alerts,
      p_account_updates, p_quiet_hours_enabled, p_quiet_hours_start::smallint, p_quiet_hours_end::smallint, p_lock_qandeel,
      p_lock_shared, p_lock_public, p_lock_discovery, p_lock_introductions, p_lock_reminders, p_lock_account,
      p_lock_security, CURRENT_TIMESTAMP)
  ON CONFLICT (user_id) DO UPDATE SET proactive = EXCLUDED.proactive, shared_alerts = EXCLUDED.shared_alerts,
      public_interactions = EXCLUDED.public_interactions, public_discovery = EXCLUDED.public_discovery,
      introductions_alerts = EXCLUDED.introductions_alerts, account_updates = EXCLUDED.account_updates,
      quiet_hours_enabled = EXCLUDED.quiet_hours_enabled, quiet_hours_start = EXCLUDED.quiet_hours_start,
      quiet_hours_end = EXCLUDED.quiet_hours_end, lock_qandeel = EXCLUDED.lock_qandeel, lock_shared = EXCLUDED.lock_shared,
      lock_public = EXCLUDED.lock_public, lock_discovery = EXCLUDED.lock_discovery,
      lock_introductions = EXCLUDED.lock_introductions, lock_reminders = EXCLUDED.lock_reminders,
      lock_account = EXCLUDED.lock_account, lock_security = EXCLUDED.lock_security, updated_at = CURRENT_TIMESTAMP;
  RETURN QUERY SELECT 'SAVED'::text;
END;$$;

-- Snooze (P3 §13): until a moment in the next 7 days (implementation bound), or NULL to end it. Interruption only.
CREATE FUNCTION activity_private.set_own_activity_snooze_v1(p_until timestamptz)
RETURNS TABLE (outcome text, snooze_until timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_until IS NOT NULL AND (p_until <= CURRENT_TIMESTAMP OR p_until > CURRENT_TIMESTAMP + interval '7 days') THEN
    RAISE EXCEPTION 'ACTIVITY_SNOOZE_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.activity_preferences AS p (user_id, snooze_until, updated_at) VALUES (v_user, p_until, CURRENT_TIMESTAMP)
  ON CONFLICT (user_id) DO UPDATE SET snooze_until = EXCLUDED.snooze_until, updated_at = CURRENT_TIMESTAMP;
  RETURN QUERY SELECT CASE WHEN p_until IS NULL THEN 'ENDED' ELSE 'SNOOZED' END, p_until;
END;$$;

-- Per-World mute (D34). Only a Shared context the caller's own Activity already holds (so it was published by a trusted
-- server producer for this user); nothing reads a Connected Worlds table.
CREATE FUNCTION activity_private.set_own_activity_context_mute_v1(p_context_ref text, p_muted boolean)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_context_ref IS NULL OR p_muted IS NULL THEN RAISE EXCEPTION 'ACTIVITY_MUTE_INVALID' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.activity_items i
                  WHERE i.user_id = v_user AND i.context_kind = 'SHARED_WORLD' AND i.context_ref = p_context_ref) THEN
    RETURN QUERY SELECT 'UNKNOWN_CONTEXT'::text;
    RETURN;
  END IF;
  IF p_muted THEN
    INSERT INTO public.activity_context_mutes (user_id, context_ref) VALUES (v_user, p_context_ref) ON CONFLICT DO NOTHING;
    RETURN QUERY SELECT 'MUTED'::text;
  ELSE
    DELETE FROM public.activity_context_mutes m WHERE m.user_id = v_user AND m.context_ref = p_context_ref;
    RETURN QUERY SELECT 'UNMUTED'::text;
  END IF;
END;$$;

-- The Product boundary on the Data API: INVOKER pass-throughs. The caller is still only `auth.uid()`.
CREATE FUNCTION public.mark_own_activity_items_seen_v1(p_item_ids uuid[])
RETURNS TABLE (seen integer) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.seen FROM activity_private.mark_own_activity_items_seen_v1(p_item_ids) c;
$$;
CREATE FUNCTION public.open_own_activity_item_v1(p_item_id uuid)
RETURNS TABLE (outcome text, category text, context_kind text, context_ref text, entry_destination text, entry_ref text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome, c.category, c.context_kind, c.context_ref, c.entry_destination, c.entry_ref
    FROM activity_private.open_own_activity_item_v1(p_item_id) c;
$$;
CREATE FUNCTION public.record_own_activity_strip_v1(p_presented_item_id uuid, p_settled_item_ids uuid[])
RETURNS TABLE (presented integer, settled integer) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.presented, c.settled FROM activity_private.record_own_activity_strip_v1(p_presented_item_id, p_settled_item_ids) c;
$$;
CREATE FUNCTION public.set_own_activity_preferences_v1(
  p_proactive text, p_shared_alerts boolean, p_public_interactions boolean, p_public_discovery boolean,
  p_introductions_alerts boolean, p_account_updates boolean, p_quiet_hours_enabled boolean, p_quiet_hours_start integer,
  p_quiet_hours_end integer, p_lock_qandeel text, p_lock_shared text, p_lock_public text, p_lock_discovery text,
  p_lock_introductions text, p_lock_reminders text, p_lock_account text, p_lock_security text)
RETURNS TABLE (outcome text) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome FROM activity_private.set_own_activity_preferences_v1(p_proactive, p_shared_alerts, p_public_interactions,
    p_public_discovery, p_introductions_alerts, p_account_updates, p_quiet_hours_enabled, p_quiet_hours_start,
    p_quiet_hours_end, p_lock_qandeel, p_lock_shared, p_lock_public, p_lock_discovery, p_lock_introductions,
    p_lock_reminders, p_lock_account, p_lock_security) c;
$$;
CREATE FUNCTION public.set_own_activity_snooze_v1(p_until timestamptz)
RETURNS TABLE (outcome text, snooze_until timestamptz) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome, c.snooze_until FROM activity_private.set_own_activity_snooze_v1(p_until) c;
$$;
CREATE FUNCTION public.set_own_activity_context_mute_v1(p_context_ref text, p_muted boolean)
RETURNS TABLE (outcome text) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome FROM activity_private.set_own_activity_context_mute_v1(p_context_ref, p_muted) c;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Privileges, every one explicit (0133 removed the hosted default privileges; nothing here relies on a default).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.activity_items OWNER TO postgres;
ALTER TABLE public.activity_item_members OWNER TO postgres;
ALTER TABLE public.activity_preferences OWNER TO postgres;
ALTER TABLE public.activity_context_mutes OWNER TO postgres;
ALTER TABLE public.activity_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_item_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_context_mutes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activity_items, public.activity_item_members, public.activity_preferences,
  public.activity_context_mutes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.activity_items, public.activity_preferences, public.activity_context_mutes TO authenticated;
CREATE POLICY activity_items_select_own ON public.activity_items
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY activity_preferences_select_own ON public.activity_preferences
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY activity_context_mutes_select_own ON public.activity_context_mutes
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- The members table (candidate identities, source references) has no client privilege and no policy at all.

ALTER FUNCTION public.server_publish_activity_candidate_v1(uuid, text, text, text, text, integer, boolean, boolean, text,
  text, text, text, text, text, text, text, text, text, text, boolean, text, timestamptz, timestamptz) OWNER TO postgres;
ALTER FUNCTION public.server_withdraw_activity_source_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION activity_private.mark_own_activity_items_seen_v1(uuid[]) OWNER TO postgres;
ALTER FUNCTION activity_private.open_own_activity_item_v1(uuid) OWNER TO postgres;
ALTER FUNCTION activity_private.record_own_activity_strip_v1(uuid, uuid[]) OWNER TO postgres;
ALTER FUNCTION activity_private.set_own_activity_preferences_v1(text, boolean, boolean, boolean, boolean, boolean, boolean,
  integer, integer, text, text, text, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION activity_private.set_own_activity_snooze_v1(timestamptz) OWNER TO postgres;
ALTER FUNCTION activity_private.set_own_activity_context_mute_v1(text, boolean) OWNER TO postgres;
ALTER FUNCTION public.mark_own_activity_items_seen_v1(uuid[]) OWNER TO postgres;
ALTER FUNCTION public.open_own_activity_item_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.record_own_activity_strip_v1(uuid, uuid[]) OWNER TO postgres;
ALTER FUNCTION public.set_own_activity_preferences_v1(text, boolean, boolean, boolean, boolean, boolean, boolean, integer,
  integer, text, text, text, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.set_own_activity_snooze_v1(timestamptz) OWNER TO postgres;
ALTER FUNCTION public.set_own_activity_context_mute_v1(text, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public.server_publish_activity_candidate_v1(uuid, text, text, text, text, integer, boolean, boolean, text, text, text,
    text, text, text, text, text, text, text, text, boolean, text, timestamptz, timestamptz),
  public.server_withdraw_activity_source_v1(uuid, text),
  activity_private.mark_own_activity_items_seen_v1(uuid[]),
  activity_private.open_own_activity_item_v1(uuid),
  activity_private.record_own_activity_strip_v1(uuid, uuid[]),
  activity_private.set_own_activity_preferences_v1(text, boolean, boolean, boolean, boolean, boolean, boolean, integer,
    integer, text, text, text, text, text, text, text, text),
  activity_private.set_own_activity_snooze_v1(timestamptz),
  activity_private.set_own_activity_context_mute_v1(text, boolean),
  public.mark_own_activity_items_seen_v1(uuid[]),
  public.open_own_activity_item_v1(uuid),
  public.record_own_activity_strip_v1(uuid, uuid[]),
  public.set_own_activity_preferences_v1(text, boolean, boolean, boolean, boolean, boolean, boolean, integer, integer, text,
    text, text, text, text, text, text, text),
  public.set_own_activity_snooze_v1(timestamptz),
  public.set_own_activity_context_mute_v1(text, boolean)
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  -- The server channel reads and writes nothing directly and runs no owner command: it publishes and withdraws only.
  EXECUTE 'REVOKE ALL ON TABLE public.activity_items, public.activity_item_members, public.activity_preferences, public.activity_context_mutes FROM service_role';
  EXECUTE 'REVOKE ALL ON SCHEMA activity_private FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.mark_own_activity_items_seen_v1(uuid[]), public.open_own_activity_item_v1(uuid), public.record_own_activity_strip_v1(uuid, uuid[]), public.set_own_activity_snooze_v1(timestamptz), public.set_own_activity_context_mute_v1(text, boolean) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.set_own_activity_preferences_v1(text, boolean, boolean, boolean, boolean, boolean, boolean, integer, integer, text, text, text, text, text, text, text, text) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_publish_activity_candidate_v1(uuid, text, text, text, text, integer, boolean, boolean, text, text, text, text, text, text, text, text, text, text, text, boolean, text, timestamptz, timestamptz) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_withdraw_activity_source_v1(uuid, text) TO service_role';
END IF; END$$;

GRANT USAGE ON SCHEMA activity_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  activity_private.mark_own_activity_items_seen_v1(uuid[]),
  activity_private.open_own_activity_item_v1(uuid),
  activity_private.record_own_activity_strip_v1(uuid, uuid[]),
  activity_private.set_own_activity_preferences_v1(text, boolean, boolean, boolean, boolean, boolean, boolean, integer,
    integer, text, text, text, text, text, text, text, text),
  activity_private.set_own_activity_snooze_v1(timestamptz),
  activity_private.set_own_activity_context_mute_v1(text, boolean),
  public.mark_own_activity_items_seen_v1(uuid[]),
  public.open_own_activity_item_v1(uuid),
  public.record_own_activity_strip_v1(uuid, uuid[]),
  public.set_own_activity_preferences_v1(text, boolean, boolean, boolean, boolean, boolean, boolean, integer, integer, text,
    text, text, text, text, text, text, text),
  public.set_own_activity_snooze_v1(timestamptz),
  public.set_own_activity_context_mute_v1(text, boolean)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Deploy-time self-assertions: the migration refuses to leave a reachable write, an anon privilege, or a server
--    pass a client could run.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.activity_items', 'public.activity_item_members', 'public.activity_preferences',
                           'public.activity_context_mutes'] LOOP
    IF has_table_privilege('anon', t, 'SELECT,INSERT,UPDATE,DELETE')
       OR has_table_privilege('authenticated', t, 'INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION '0136: a client role can write or anon can read %', t;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.activity_item_members', 'SELECT') THEN
    RAISE EXCEPTION '0136: the members table is reachable by a client';
  END IF;
  IF has_function_privilege('authenticated', 'public.server_withdraw_activity_source_v1(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.server_withdraw_activity_source_v1(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.server_publish_activity_candidate_v1(uuid, text, text, text, text, integer, boolean, boolean, text, text, text, text, text, text, text, text, text, text, text, boolean, text, timestamptz, timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.server_publish_activity_candidate_v1(uuid, text, text, text, text, integer, boolean, boolean, text, text, text, text, text, text, text, text, text, text, text, boolean, text, timestamptz, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION '0136: a client role can run a server pass';
  END IF;
  IF has_function_privilege('anon', 'public.open_own_activity_item_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0136: anon can run an owner command';
  END IF;
END$$;

COMMIT;
