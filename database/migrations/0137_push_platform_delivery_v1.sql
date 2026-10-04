-- A3-02 — Native Push, Permission & Platform Delivery: the durable half of platform delivery (Stage 3).
--
-- Authority consumed, never redefined: I-08N-01 (D41, D49–D59 above all), the P3 closure (§10, §11, §14, §15) and the
-- A3-01 Activity spine (0136). A3-01 decides what may interrupt and what the reader sees; this migration only lets the
-- server deliver an ELIGIBLE A3-01 item to the reader's own devices, and keep the evidence it actually holds.
--
--   public.activity_items (0136)                       the ONE notification model — this migration adds no second one
--     → public.push_delivery_attempts                  one delivery INTENT per (item, device) (D57) — never the event
--     → revalidated at every claim by the API          platformVerdict, disclosure, Quiet Hours / Snooze, expiry (D54)
--     → provider acceptance / rejection                transport evidence only; NEVER "delivered" (D41, D56)
--     → opened_at                                      a tap on THAT device only; never claimed for another (D53)
--
-- What this migration deliberately is NOT:
--   * not an event store and not a second notification model: an attempt references an Activity item and holds no
--     sentence, no context label and no disclosure-bearing text — the words are rendered by the API at send time from
--     the CURRENT item and the CURRENT ceiling, so a retry never reuses copy current policy no longer permits (D54);
--   * not user identity: a push token is a transport address. It never identifies a user, is never returned to any
--     client, and moves to whichever account the installation is signed in to now;
--   * not hardware identity: `installation_id` is a random UUID the app creates for itself on first run;
--   * no "delivered" and no "presented" column exists, by construction: neither FCM nor APNs reports them on this
--     transport (no notification service extension, no delivery receipts), so unknown stays unknown (D56);
--   * no score, weight, threshold or ranking: every eligibility fact is A3-01's.
--
-- ## Implementation policy (NOT Product authority)
--
-- A first attempt waits 60 s after the item was projected, so a reader who is in the app is reached in-app first
-- (A3-01 presents or settles the item, which then never pushes — D51); at most 10 ACTIVE devices per account (the
-- least recently synced is detached); a registration not synced for 30 days receives nothing; at most 6 transport
-- attempts per intent; only items projected within the last 24 h are planned. Each is a constant here or in
-- `apps/api/src/push/push.types.ts`; changing one is an implementation change, not a Product change.
--
-- ## The privilege boundary (the 0133 / 0136 rule)
--
-- No client role can read or write either table: the API answers only outcomes, never a token, an attempt or another
-- device. Owner commands are SECURITY DEFINER in the non-exposed `push_private` behind `public` SECURITY INVOKER
-- pass-throughs, so the caller is only ever `auth.uid()`. The four server passes are SECURITY DEFINER in `public` and
-- executable by `service_role` ONLY. Nothing is granted to `anon`. Every grant is explicit.
--
-- ## Erasure
--
-- Both tables name their account with `user_id REFERENCES public.users (id) ON DELETE CASCADE` (attempts also cascade
-- from their item and device): the governed Personal erasure (0130) leaves no row behind.
--
-- Forward-only. Migrations 0001–0136 are byte-unchanged.
BEGIN;

CREATE SCHEMA push_private;
REVOKE ALL ON SCHEMA push_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Device registrations: one row per (account, app installation).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  -- A random identity the app creates for its own installation. Never a hardware identifier.
  installation_id uuid NOT NULL,
  platform text NOT NULL,
  -- The platform's own push service. No third-party relay exists in this path.
  transport text NOT NULL,
  -- APNs only: which APNs environment issued the token.
  apns_environment text,
  -- The transport address. Server-only; never returned to any client; NULL when no deliverable token is held.
  push_token text,
  token_digest text,
  token_updated_at timestamptz,
  -- D50: the OS permission as the device last reported it — the hard boundary. Never inferred.
  os_permission text NOT NULL,
  -- P3 §13: Quiet Hours are device-local, so the device's own IANA zone is kept (backlog QAN-BL-NOTIF-01 Exit Gate).
  time_zone text NOT NULL,
  -- Which of the item's two rendered languages this device reads.
  locale text NOT NULL,
  app_version text,
  status text NOT NULL DEFAULT 'ACTIVE',
  last_synced_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detached_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT push_devices_installation_unique UNIQUE (user_id, installation_id),
  CONSTRAINT push_devices_platform_check CHECK (
    (platform = 'ANDROID' AND transport = 'FCM' AND apns_environment IS NULL)
    OR (platform = 'IOS' AND transport = 'APNS' AND apns_environment IS NOT NULL AND apns_environment IN ('PRODUCTION', 'SANDBOX'))),
  CONSTRAINT push_devices_token_check CHECK (
    (push_token IS NULL AND token_digest IS NULL)
    OR (push_token IS NOT NULL AND char_length(push_token) BETWEEN 1 AND 4096 AND token_digest ~ '^[0-9a-f]{64}$'
        AND token_updated_at IS NOT NULL)),
  CONSTRAINT push_devices_permission_check CHECK (os_permission IN ('GRANTED', 'DENIED', 'NOT_REQUESTED')),
  CONSTRAINT push_devices_zone_check CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  CONSTRAINT push_devices_locale_check CHECK (locale IN ('ar', 'en')),
  CONSTRAINT push_devices_version_check CHECK (app_version IS NULL OR char_length(app_version) BETWEEN 1 AND 32),
  CONSTRAINT push_devices_status_check CHECK (
    (status = 'ACTIVE' AND detached_at IS NULL AND invalidated_at IS NULL)
    OR (status = 'DETACHED' AND detached_at IS NOT NULL AND push_token IS NULL)
    OR (status = 'INVALIDATED' AND invalidated_at IS NOT NULL AND push_token IS NULL))
);

-- A token addresses ONE live registration: when it moves (another account signs in on the device) the old one detaches.
CREATE UNIQUE INDEX push_devices_active_token_idx ON public.push_devices (token_digest)
  WHERE status = 'ACTIVE' AND token_digest IS NOT NULL;
CREATE INDEX push_devices_user_active_idx ON public.push_devices (user_id) WHERE status = 'ACTIVE';
CREATE INDEX push_devices_installation_idx ON public.push_devices (installation_id) WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Delivery intents and their per-device evidence: one row per (Activity item, device) — D57's stable identity.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.push_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.activity_items (id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.push_devices (id) ON DELETE CASCADE,
  -- PENDING / DEFERRED wait for a claim; every other state is terminal for this intent.
  --   ACCEPTED       the platform push service accepted the message — NOT delivered, NOT presented (D41, D56)
  --   SUPPRESSED     current revalidation said no (the reason says which law)
  --   EXPIRED        the semantic timing window ended first; never retried past it (D59)
  --   TOKEN_INVALID  the provider said this address is dead; the device was invalidated
  --   REJECTED       the provider refused this message permanently
  --   EXHAUSTED      the bounded transport retries were used up; unknown stays unknown
  state text NOT NULL DEFAULT 'PENDING',
  -- A finite, content-free reason label (the decision or the outcome class).
  reason text,
  attempt_count smallint NOT NULL DEFAULT 0,
  -- True once this intent waited out Quiet Hours / Snooze: at most ONE such intent per reader interrupts per pass.
  reevaluation boolean NOT NULL DEFAULT false,
  next_attempt_at timestamptz NOT NULL,
  lease_until timestamptz,
  claim_token uuid,
  -- The disclosure level the accepted message was rendered at (never above the reader's ceiling, D17).
  disclosure_level text,
  provider_accepted_at timestamptz,
  -- Evidence from THIS device only: the reader tapped this device's notification (D53).
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT push_delivery_attempts_intent_unique UNIQUE (item_id, device_id),
  CONSTRAINT push_delivery_attempts_state_check CHECK (
    state IN ('PENDING', 'DEFERRED', 'ACCEPTED', 'SUPPRESSED', 'EXPIRED', 'TOKEN_INVALID', 'REJECTED', 'EXHAUSTED')),
  CONSTRAINT push_delivery_attempts_reason_check CHECK (reason IS NULL OR reason ~ '^[a-z0-9_-]{1,48}$'),
  CONSTRAINT push_delivery_attempts_count_check CHECK (attempt_count BETWEEN 0 AND 6),
  CONSTRAINT push_delivery_attempts_level_check CHECK (disclosure_level IS NULL OR disclosure_level IN ('L0', 'L1', 'L2', 'L3')),
  CONSTRAINT push_delivery_attempts_accepted_check CHECK (
    (state = 'ACCEPTED') = (provider_accepted_at IS NOT NULL)
    AND (state <> 'ACCEPTED' OR disclosure_level IS NOT NULL)),
  -- Opened is only ever evidence about a message this device was sent.
  CONSTRAINT push_delivery_attempts_opened_check CHECK (opened_at IS NULL OR state = 'ACCEPTED')
);
CREATE INDEX push_delivery_attempts_due_idx ON public.push_delivery_attempts (next_attempt_at)
  WHERE state IN ('PENDING', 'DEFERRED');
CREATE INDEX push_delivery_attempts_evidence_idx ON public.push_delivery_attempts (user_id, provider_accepted_at)
  WHERE provider_accepted_at IS NOT NULL;
CREATE INDEX push_delivery_attempts_device_idx ON public.push_delivery_attempts (device_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Owner commands: the caller's own installation only (auth.uid()).
-- ---------------------------------------------------------------------------------------------------------------------

-- Register / refresh / rotate this installation's registration for the signed-in account. The installation and the
-- token belong to whoever is signed in on the device NOW: any other account's live registration of either detaches.
CREATE FUNCTION push_private.sync_own_push_device_v1(
  p_installation_id uuid, p_platform text, p_token text, p_apns_environment text, p_os_permission text,
  p_time_zone text, p_locale text, p_app_version text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_digest text;
  v_existing public.push_devices;
  v_outcome text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_installation_id IS NULL OR p_platform NOT IN ('ANDROID', 'IOS') THEN
    RAISE EXCEPTION 'PUSH_DEVICE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_token IS NOT NULL AND char_length(p_token) NOT BETWEEN 1 AND 4096 THEN
    RAISE EXCEPTION 'PUSH_DEVICE_INVALID' USING ERRCODE = '22023';
  END IF;
  v_digest := CASE WHEN p_token IS NULL THEN NULL ELSE encode(sha256(convert_to(p_token, 'UTF8')), 'hex') END;

  -- One installation's registrations serialize; a token's do too.
  PERFORM pg_advisory_xact_lock(hashtextextended('qandeel.push.installation:' || p_installation_id::text, 0));
  IF v_digest IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('qandeel.push.token:' || v_digest, 0)); END IF;

  -- The installation now belongs to this account: another account's live registration of it stops receiving.
  UPDATE public.push_devices d SET status = 'DETACHED', push_token = NULL, token_digest = NULL, detached_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
   WHERE d.installation_id = p_installation_id AND d.user_id <> v_user AND d.status = 'ACTIVE';
  -- A token is a transport address, not identity: wherever else it is live, it is not any more.
  IF v_digest IS NOT NULL THEN
    UPDATE public.push_devices d SET status = 'DETACHED', push_token = NULL, token_digest = NULL,
        detached_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE d.token_digest = v_digest AND d.status = 'ACTIVE' AND NOT (d.user_id = v_user AND d.installation_id = p_installation_id);
  END IF;

  SELECT * INTO v_existing FROM public.push_devices d WHERE d.user_id = v_user AND d.installation_id = p_installation_id FOR UPDATE;
  IF NOT FOUND THEN
    v_outcome := 'REGISTERED';
  ELSIF v_existing.status <> 'ACTIVE' THEN
    v_outcome := 'REATTACHED';
  ELSIF v_existing.token_digest IS DISTINCT FROM v_digest THEN
    v_outcome := 'ROTATED';
  ELSE
    v_outcome := 'UPDATED';
  END IF;

  INSERT INTO public.push_devices AS d (user_id, installation_id, platform, transport, apns_environment, push_token,
      token_digest, token_updated_at, os_permission, time_zone, locale, app_version, status, last_synced_at)
    VALUES (v_user, p_installation_id, p_platform, CASE WHEN p_platform = 'IOS' THEN 'APNS' ELSE 'FCM' END,
      p_apns_environment, p_token, v_digest, CASE WHEN p_token IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END,
      p_os_permission, p_time_zone, p_locale, p_app_version, 'ACTIVE', CURRENT_TIMESTAMP)
  ON CONFLICT (user_id, installation_id) DO UPDATE SET
      platform = EXCLUDED.platform, transport = EXCLUDED.transport, apns_environment = EXCLUDED.apns_environment,
      push_token = EXCLUDED.push_token, token_digest = EXCLUDED.token_digest,
      token_updated_at = CASE WHEN d.token_digest IS NOT DISTINCT FROM EXCLUDED.token_digest AND d.status = 'ACTIVE'
                              THEN d.token_updated_at ELSE EXCLUDED.token_updated_at END,
      os_permission = EXCLUDED.os_permission, time_zone = EXCLUDED.time_zone, locale = EXCLUDED.locale,
      app_version = EXCLUDED.app_version, status = 'ACTIVE', detached_at = NULL, invalidated_at = NULL,
      last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP;

  -- A rotated or withdrawn token never receives a pending intent planned for the old one.
  IF v_outcome IN ('ROTATED', 'REATTACHED') OR p_token IS NULL OR p_os_permission <> 'GRANTED' THEN
    UPDATE public.push_delivery_attempts a SET state = 'SUPPRESSED', reason = 'device_changed', lease_until = NULL,
        claim_token = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE a.device_id = (SELECT d.id FROM public.push_devices d WHERE d.user_id = v_user AND d.installation_id = p_installation_id)
       AND a.state IN ('PENDING', 'DEFERRED');
  END IF;

  -- Implementation policy (header): at most 10 live registrations per account; the least recently synced detaches.
  UPDATE public.push_devices d SET status = 'DETACHED', push_token = NULL, token_digest = NULL, detached_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
   WHERE d.id IN (SELECT x.id FROM public.push_devices x WHERE x.user_id = v_user AND x.status = 'ACTIVE'
                   ORDER BY x.last_synced_at DESC, x.id DESC OFFSET 10);

  RETURN QUERY SELECT v_outcome;
END;$$;

-- Sign-out: this installation stops receiving for this account, and forgets its token.
CREATE FUNCTION push_private.detach_own_push_device_v1(p_installation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_device uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_installation_id IS NULL THEN RAISE EXCEPTION 'PUSH_DEVICE_INVALID' USING ERRCODE = '22023'; END IF;
  UPDATE public.push_devices d SET status = 'DETACHED', push_token = NULL, token_digest = NULL, detached_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
   WHERE d.user_id = v_user AND d.installation_id = p_installation_id AND d.status = 'ACTIVE'
  RETURNING d.id INTO v_device;
  IF v_device IS NULL THEN RETURN QUERY SELECT 'NOT_ATTACHED'::text; RETURN; END IF;
  UPDATE public.push_delivery_attempts a SET state = 'SUPPRESSED', reason = 'device_detached', lease_until = NULL,
      claim_token = NULL, updated_at = CURRENT_TIMESTAMP
   WHERE a.device_id = v_device AND a.state IN ('PENDING', 'DEFERRED');
  RETURN QUERY SELECT 'DETACHED'::text;
END;$$;

-- "Sign out from other devices": every other live registration of this account stops receiving.
CREATE FUNCTION push_private.detach_own_other_push_devices_v1(p_installation_id uuid)
RETURNS TABLE (detached integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_installation_id IS NULL THEN RAISE EXCEPTION 'PUSH_DEVICE_INVALID' USING ERRCODE = '22023'; END IF;
  UPDATE public.push_delivery_attempts a SET state = 'SUPPRESSED', reason = 'device_detached', lease_until = NULL,
      claim_token = NULL, updated_at = CURRENT_TIMESTAMP
   WHERE a.user_id = v_user AND a.state IN ('PENDING', 'DEFERRED')
     AND a.device_id IN (SELECT d.id FROM public.push_devices d WHERE d.user_id = v_user AND d.status = 'ACTIVE'
                          AND d.installation_id <> p_installation_id);
  UPDATE public.push_devices d SET status = 'DETACHED', push_token = NULL, token_digest = NULL, detached_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
   WHERE d.user_id = v_user AND d.status = 'ACTIVE' AND d.installation_id <> p_installation_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;$$;

-- Opened evidence (D41, D53): the reader tapped the notification on THIS installation. Only a message this device was
-- actually sent can be opened; nothing is claimed for any other device, and the user-level attention lifecycle is the
-- Activity `open` boundary's (0136), which the app calls separately.
CREATE FUNCTION push_private.record_own_push_open_v1(p_installation_id uuid, p_item_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF p_installation_id IS NULL OR p_item_id IS NULL THEN RAISE EXCEPTION 'PUSH_OPEN_INVALID' USING ERRCODE = '22023'; END IF;
  UPDATE public.push_delivery_attempts a SET opened_at = coalesce(a.opened_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
   WHERE a.user_id = v_user AND a.item_id = p_item_id AND a.state = 'ACCEPTED'
     AND a.device_id IN (SELECT d.id FROM public.push_devices d WHERE d.user_id = v_user AND d.installation_id = p_installation_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT CASE WHEN v_count > 0 THEN 'RECORDED' ELSE 'NO_EVIDENCE' END;
END;$$;

CREATE FUNCTION public.sync_own_push_device_v1(
  p_installation_id uuid, p_platform text, p_token text, p_apns_environment text, p_os_permission text,
  p_time_zone text, p_locale text, p_app_version text)
RETURNS TABLE (outcome text) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome FROM push_private.sync_own_push_device_v1(p_installation_id, p_platform, p_token, p_apns_environment,
    p_os_permission, p_time_zone, p_locale, p_app_version) c;
$$;
CREATE FUNCTION public.detach_own_push_device_v1(p_installation_id uuid)
RETURNS TABLE (outcome text) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome FROM push_private.detach_own_push_device_v1(p_installation_id) c;
$$;
CREATE FUNCTION public.detach_own_other_push_devices_v1(p_installation_id uuid)
RETURNS TABLE (detached integer) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.detached FROM push_private.detach_own_other_push_devices_v1(p_installation_id) c;
$$;
CREATE FUNCTION public.record_own_push_open_v1(p_installation_id uuid, p_item_id uuid)
RETURNS TABLE (outcome text) LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.outcome FROM push_private.record_own_push_open_v1(p_installation_id, p_item_id) c;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The server passes (service_role only): plan, claim, record. The API revalidates every claimed intent against
--    CURRENT truth before any transport (D54, D55); these passes only move intents and evidence.
-- ---------------------------------------------------------------------------------------------------------------------

-- Plans one intent per (item, device) for every item that could still interrupt — NEW, not settled in-app, not
-- withdrawn, not expired, not ambient, projected in the last 24 h after the device registered — and every live device
-- whose OS permission is granted, holding a token, synced within 30 days. Idempotent (the intent key), bounded.
CREATE FUNCTION public.server_plan_push_attempts_v1(p_limit integer)
RETURNS TABLE (planned integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'PUSH_PLAN_INVALID' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.push_delivery_attempts (user_id, item_id, device_id, next_attempt_at)
  SELECT i.user_id, i.id, d.id, i.created_at + interval '60 seconds'
    FROM public.activity_items i
    JOIN public.push_devices d ON d.user_id = i.user_id
   WHERE i.attention = 'NEW' AND i.interruption_settled_at IS NULL AND i.withdrawn_at IS NULL
     AND (i.expires_at IS NULL OR i.expires_at > CURRENT_TIMESTAMP)
     AND i.interruption_class < 4
     AND i.created_at > CURRENT_TIMESTAMP - interval '24 hours'
     AND i.created_at >= d.created_at
     AND d.status = 'ACTIVE' AND d.push_token IS NOT NULL AND d.os_permission = 'GRANTED'
     AND d.last_synced_at > CURRENT_TIMESTAMP - interval '30 days'
     AND NOT EXISTS (SELECT 1 FROM public.push_delivery_attempts a WHERE a.item_id = i.id AND a.device_id = d.id)
   ORDER BY i.created_at
   LIMIT p_limit
  ON CONFLICT ON CONSTRAINT push_delivery_attempts_intent_unique DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;$$;

-- Claims due intents under a short lease (several API processes never send one intent twice) and answers, per intent,
-- exactly the CURRENT facts the API needs to revalidate it: the item's projection (never its member / source rows),
-- the reader's preferences and whether the item's context is muted, the device, and the reader's own provider-accepted
-- interruptions of the last 7 days (the P3 §14 ceilings count delivery evidence, one per item). The token leaves the
-- database only here, to the server channel.
CREATE FUNCTION public.server_claim_push_attempts_v1(p_limit integer, p_lease_seconds integer, p_claim_token uuid)
RETURNS TABLE (claim jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 10 AND 600
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'PUSH_CLAIM_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH due AS (
    SELECT a.id FROM public.push_delivery_attempts a
     WHERE a.state IN ('PENDING', 'DEFERRED') AND a.next_attempt_at <= CURRENT_TIMESTAMP
       AND (a.lease_until IS NULL OR a.lease_until <= CURRENT_TIMESTAMP)
     ORDER BY a.user_id, a.next_attempt_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.push_delivery_attempts a SET lease_until = CURRENT_TIMESTAMP + make_interval(secs => p_lease_seconds),
        claim_token = p_claim_token, updated_at = CURRENT_TIMESTAMP
      FROM due WHERE a.id = due.id
    RETURNING a.*
  )
  SELECT jsonb_build_object(
    'attemptId', c.id, 'userId', c.user_id, 'attemptCount', c.attempt_count, 'reevaluation', c.reevaluation,
    'device', jsonb_build_object('id', d.id, 'platform', d.platform, 'transport', d.transport,
      'apnsEnvironment', d.apns_environment, 'token', d.push_token, 'status', d.status, 'osPermission', d.os_permission,
      'timeZone', d.time_zone, 'locale', d.locale),
    'item', jsonb_build_object('id', i.id, 'category', i.category, 'kind', i.kind,
      'interruption_class', i.interruption_class, 'critical', i.critical, 'requested', i.requested,
      'context_kind', i.context_kind, 'context_ref', i.context_ref, 'context_label_ar', i.context_label_ar,
      'context_label_en', i.context_label_en, 'entry_destination', i.entry_destination, 'entry_ref', i.entry_ref,
      'speaker', i.speaker, 'body_ar', i.body_ar, 'body_en', i.body_en, 'secondary_ar', i.secondary_ar,
      'secondary_en', i.secondary_en, 'actionable', i.actionable, 'disclosure_max', i.disclosure_max,
      'member_count', i.member_count, 'occurred_at', i.occurred_at, 'last_occurred_at', i.last_occurred_at,
      'expires_at', i.expires_at, 'withdrawn_at', i.withdrawn_at, 'attention', i.attention,
      'presented_in_app_at', i.presented_in_app_at, 'interruption_settled_at', i.interruption_settled_at,
      'created_at', i.created_at),
    'preferences', (SELECT to_jsonb(p) - 'user_id' - 'updated_at' FROM public.activity_preferences p WHERE p.user_id = c.user_id),
    'muted', (i.context_ref IS NOT NULL AND EXISTS (SELECT 1 FROM public.activity_context_mutes m
                                                     WHERE m.user_id = c.user_id AND m.context_ref = i.context_ref)),
    'evidence', coalesce((
      SELECT jsonb_agg(jsonb_build_object('at', e.at, 'kind', e.kind, 'critical', e.critical, 'requested', e.requested))
        FROM (SELECT min(x.provider_accepted_at) AS at, xi.kind, xi.critical, xi.requested
                FROM public.push_delivery_attempts x JOIN public.activity_items xi ON xi.id = x.item_id
               WHERE x.user_id = c.user_id AND x.provider_accepted_at > CURRENT_TIMESTAMP - interval '7 days'
               GROUP BY x.item_id, xi.kind, xi.critical, xi.requested) e), '[]'::jsonb),
    'now', CURRENT_TIMESTAMP)
  FROM claimed c
  JOIN public.activity_items i ON i.id = c.item_id
  JOIN public.push_devices d ON d.id = c.device_id;
END;$$;

-- Records what happened to ONE claimed intent, under the claim token. A provider's dead-token answer invalidates the
-- device (and every other waiting intent for it). A retry or a Quiet Hours / Snooze deferral releases the lease with
-- the next moment; nothing is ever recorded as delivered or presented.
CREATE FUNCTION public.server_record_push_attempt_v1(
  p_attempt_id uuid, p_claim_token uuid, p_state text, p_reason text, p_next_attempt_at timestamptz,
  p_disclosure_level text, p_counted boolean)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_attempt public.push_delivery_attempts;
BEGIN
  IF p_attempt_id IS NULL OR p_claim_token IS NULL OR p_state IS NULL OR p_counted IS NULL
     OR (p_state IN ('PENDING', 'DEFERRED') AND p_next_attempt_at IS NULL)
     OR (p_state = 'ACCEPTED' AND p_disclosure_level IS NULL) THEN
    RAISE EXCEPTION 'PUSH_RECORD_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_attempt FROM public.push_delivery_attempts a WHERE a.id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.claim_token IS DISTINCT FROM p_claim_token OR v_attempt.state NOT IN ('PENDING', 'DEFERRED') THEN
    RETURN QUERY SELECT 'NOT_CLAIMED'::text;
    RETURN;
  END IF;
  UPDATE public.push_delivery_attempts a SET
      state = p_state, reason = p_reason,
      attempt_count = a.attempt_count + CASE WHEN p_counted THEN 1 ELSE 0 END,
      reevaluation = a.reevaluation OR p_state = 'DEFERRED',
      next_attempt_at = coalesce(p_next_attempt_at, a.next_attempt_at),
      disclosure_level = CASE WHEN p_state = 'ACCEPTED' THEN p_disclosure_level ELSE NULL END,
      provider_accepted_at = CASE WHEN p_state = 'ACCEPTED' THEN CURRENT_TIMESTAMP ELSE NULL END,
      lease_until = NULL, claim_token = NULL, updated_at = CURRENT_TIMESTAMP
   WHERE a.id = p_attempt_id;
  IF p_state = 'TOKEN_INVALID' THEN
    UPDATE public.push_devices d SET status = 'INVALIDATED', push_token = NULL, token_digest = NULL,
        invalidated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE d.id = v_attempt.device_id AND d.status = 'ACTIVE';
    UPDATE public.push_delivery_attempts a SET state = 'SUPPRESSED', reason = 'device_invalidated', lease_until = NULL,
        claim_token = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE a.device_id = v_attempt.device_id AND a.id <> p_attempt_id AND a.state IN ('PENDING', 'DEFERRED');
  END IF;
  RETURN QUERY SELECT 'RECORDED'::text;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Privileges, every one explicit.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.push_devices OWNER TO postgres;
ALTER TABLE public.push_delivery_attempts OWNER TO postgres;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_attempts ENABLE ROW LEVEL SECURITY;
-- No client privilege and no policy on either table: tokens and per-device evidence are server-only.
REVOKE ALL ON TABLE public.push_devices, public.push_delivery_attempts FROM PUBLIC, anon, authenticated;

ALTER FUNCTION push_private.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION push_private.detach_own_push_device_v1(uuid) OWNER TO postgres;
ALTER FUNCTION push_private.detach_own_other_push_devices_v1(uuid) OWNER TO postgres;
ALTER FUNCTION push_private.record_own_push_open_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.detach_own_push_device_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.detach_own_other_push_devices_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.record_own_push_open_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.server_plan_push_attempts_v1(integer) OWNER TO postgres;
ALTER FUNCTION public.server_claim_push_attempts_v1(integer, integer, uuid) OWNER TO postgres;
ALTER FUNCTION public.server_record_push_attempt_v1(uuid, uuid, text, text, timestamptz, text, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  push_private.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text),
  push_private.detach_own_push_device_v1(uuid),
  push_private.detach_own_other_push_devices_v1(uuid),
  push_private.record_own_push_open_v1(uuid, uuid),
  public.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text),
  public.detach_own_push_device_v1(uuid),
  public.detach_own_other_push_devices_v1(uuid),
  public.record_own_push_open_v1(uuid, uuid),
  public.server_plan_push_attempts_v1(integer),
  public.server_claim_push_attempts_v1(integer, integer, uuid),
  public.server_record_push_attempt_v1(uuid, uuid, text, text, timestamptz, text, boolean)
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  -- The server channel reads and writes nothing directly and runs no owner command: it plans, claims and records only.
  EXECUTE 'REVOKE ALL ON TABLE public.push_devices, public.push_delivery_attempts FROM service_role';
  EXECUTE 'REVOKE ALL ON SCHEMA push_private FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text), public.detach_own_push_device_v1(uuid), public.detach_own_other_push_devices_v1(uuid), public.record_own_push_open_v1(uuid, uuid) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_plan_push_attempts_v1(integer) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_claim_push_attempts_v1(integer, integer, uuid) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_record_push_attempt_v1(uuid, uuid, text, text, timestamptz, text, boolean) TO service_role';
END IF; END$$;

GRANT USAGE ON SCHEMA push_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  push_private.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text),
  push_private.detach_own_push_device_v1(uuid),
  push_private.detach_own_other_push_devices_v1(uuid),
  push_private.record_own_push_open_v1(uuid, uuid),
  public.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text),
  public.detach_own_push_device_v1(uuid),
  public.detach_own_other_push_devices_v1(uuid),
  public.record_own_push_open_v1(uuid, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Deploy-time self-assertions.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  f text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.push_devices', 'public.push_delivery_attempts'] LOOP
    IF has_table_privilege('anon', t, 'SELECT,INSERT,UPDATE,DELETE')
       OR has_table_privilege('authenticated', t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION '0137: a client role can reach %', t;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.server_plan_push_attempts_v1(integer)',
                           'public.server_claim_push_attempts_v1(integer, integer, uuid)',
                           'public.server_record_push_attempt_v1(uuid, uuid, text, text, timestamptz, text, boolean)'] LOOP
    IF has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION '0137: a client role can run the server pass %', f;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.sync_own_push_device_v1(uuid, text, text, text, text, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0137: anon can run an owner command';
  END IF;
END$$;

COMMIT;
