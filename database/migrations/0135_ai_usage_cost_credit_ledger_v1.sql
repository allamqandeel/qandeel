-- AI-COST-01 - Provider-Neutral AI Usage & Cost Ledger + Credit Accounting Foundation v1.
--
-- QANDEEL's usage / economy unit is the Credit. A Credit is a QANDEEL Product unit: it is not a provider token, it is
-- not a currency, and it is provider-neutral. This migration builds the accounting foundation underneath it and keeps
-- four truths apart, because collapsing any two of them makes the books lie:
--
--   A. PROVIDER USAGE      what the provider reported for ONE external attempt, normalized into a DISJOINT partition
--                          of billable token kinds (ai_provider_calls + ai_provider_call_usage). Raw response bodies are
--                          never stored. A kind the provider did not report has NO row: absence is never zero.
--   B. RATED COST          an effective-dated Price Card applied to that usage at the instant the call STARTED
--                          (ai_price_cards, ai_cost_ratings, ai_cost_rating_components). Exact PostgreSQL numeric only.
--                          The name is RATED_APPLICATION_COST: it is an application-side rating, never called an actual
--                          or invoiced provider cost. A future RECONCILED_PROVIDER_COST is a seam, not a row.
--   C. CREDIT POLICY       a versioned translation of rated cost into Credits (ai_credit_policies, ai_credit_ratings).
--                          NO policy can be ACTIVE: the lifecycle check admits DRAFT only, so activating Credits is a
--                          later reviewed migration under an explicit Product decision. Production state:
--                          CREDIT_POLICY_NOT_ACTIVATED. No numeric formula, allowance, top-up or rollover is chosen here.
--   D. PLANS / BALANCES    not built. There is no balance table, and nothing here can debit anybody.
--
-- Unknown is a first-class state, never zero:
--   * a call is written PENDING BEFORE the external request starts; a crash leaves it PENDING, and the operational
--     summary reports it as stale - unknown cost, never manufactured afterwards;
--   * a success or failure without a usage object is *_USAGE_UNKNOWN, and its rating is USAGE_UNKNOWN;
--   * reported usage missing a kind the provider's partition requires is INCOMPLETE, rated USAGE_UNKNOWN;
--   * reported usage with no effective Price Card for a kind is UNPRICED, never $0;
--   * no Credit Policy is CREDIT_POLICY_NOT_ACTIVATED, never 0 Credits.
--
-- History is never rewritten: a call is rated by the card effective at its own start; a card referenced by a rating is
-- immutable; a new price is a new window; re-rating is an explicit, owner-only new version that keeps the old one.
--
-- Authority: every table is reachable by NO application role (row-level security on, zero policies, every privilege
-- revoked). The API holds exactly two commands (begin, settle) and three content-free reads (operations summary, cost
-- aggregates, Credit policy state) through the service-role channel. Price Cards and re-rating are database-owner acts only. Nothing here stores prompt, response, transcript,
-- Memory, Hypothesis or any user text, any exception text, or any email / Login ID / Public ID: identity is the internal
-- account UUID, and it disappears with the account (ON DELETE CASCADE from public.users, which the governed Personal
-- erasure of 0130 deletes last), so account deletion leaves no cost row linked to anybody.
--
-- PROD-SEC-02 (0131) is untouched: admission, work leases, the work-start budget and the deadline stay the abuse and
-- cost bound. Accounting adds a fact per call; it grants, refunds and limits nothing.
--
-- Migrations 0001-0134 are byte-unchanged.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Closed vocabularies (internal, IMMUTABLE). One place each, so a fourth provider or a new billable kind is a
--    reviewed change here, never an implicit widening.
-- ---------------------------------------------------------------------------------------------------------------

-- The provider and the exact operation it was asked to perform. TEST_PROVIDER exists only so a verifier can rate
-- synthetic TEST_ONLY prices: the begin command refuses it, so no API path can ever create one of its calls.
CREATE FUNCTION public.ai_provider_operation_is_known_v1(p_provider text, p_operation text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT (p_provider, p_operation) IN (('OPENAI', 'OPENAI_RESPONSES_CREATE'),
                                       ('ANTHROPIC', 'ANTHROPIC_MESSAGES_CREATE'),
                                       ('GEMINI', 'GEMINI_GENERATE_CONTENT'),
                                       ('TEST_PROVIDER', 'TEST_OPERATION'))
$$;

-- The disjoint billable partition each provider's COMPLETE usage carries (research record: OpenAI's input_tokens
-- includes cached and cache-written tokens; Anthropic's input_tokens excludes both; Gemini's promptTokenCount includes
-- cached content and its implicit caching has no write charge). Each kind is rated independently, so no token can be
-- charged twice. Reasoning / thinking tokens are OUTPUT_TOKEN.
CREATE FUNCTION public.ai_complete_usage_kinds_v1(p_provider text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE p_provider
    WHEN 'OPENAI' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    WHEN 'ANTHROPIC' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    WHEN 'GEMINI' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
    WHEN 'TEST_PROVIDER' THEN ARRAY['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']
  END
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Layer A - the provider-call ledger. One row per EXTERNAL provider attempt, written before the attempt starts.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE public.ai_provider_calls (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  -- Bounded canonical correlation only, verified against the account by the begin command; never a client value.
  session_id uuid,
  source_turn_id uuid,
  provider text NOT NULL,
  requested_model text NOT NULL,
  operation text NOT NULL,
  feature_family text NOT NULL,
  processing_path text,
  attempt_number integer NOT NULL,
  call_state text NOT NULL,
  usage_completeness text,
  started_at timestamptz NOT NULL,
  settled_at timestamptz,
  settlement_digest text,
  CONSTRAINT ai_provider_calls_operation_check CHECK (public.ai_provider_operation_is_known_v1(provider, operation)),
  CONSTRAINT ai_provider_calls_model_check CHECK (requested_model ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
    'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
    'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION')),
  CONSTRAINT ai_provider_calls_processing_path_check CHECK (processing_path IN ('FAST', 'DEEP')),
  CONSTRAINT ai_provider_calls_reply_path_check CHECK (feature_family <> 'CONVERSATION_REPLY' OR processing_path IS NOT NULL),
  CONSTRAINT ai_provider_calls_attempt_check CHECK (attempt_number >= 1),
  CONSTRAINT ai_provider_calls_state_check CHECK (call_state IN (
    'PENDING', 'SUCCEEDED_USAGE_REPORTED', 'SUCCEEDED_USAGE_UNKNOWN', 'FAILED_USAGE_REPORTED', 'FAILED_USAGE_UNKNOWN',
    'CANCELLED_BEFORE_PROVIDER')),
  CONSTRAINT ai_provider_calls_completeness_check CHECK (usage_completeness IN ('COMPLETE', 'INCOMPLETE', 'ABSENT')),
  -- The shape of each state: PENDING carries no settlement at all; "reported" means some usage was reported;
  -- "unknown" and "cancelled" mean none was.
  CONSTRAINT ai_provider_calls_state_shape_check CHECK (
    CASE call_state
      WHEN 'PENDING' THEN settled_at IS NULL AND usage_completeness IS NULL AND settlement_digest IS NULL
      WHEN 'SUCCEEDED_USAGE_REPORTED' THEN usage_completeness IN ('COMPLETE', 'INCOMPLETE')
      WHEN 'FAILED_USAGE_REPORTED' THEN usage_completeness IN ('COMPLETE', 'INCOMPLETE')
      ELSE usage_completeness = 'ABSENT'
    END
    AND (call_state = 'PENDING' OR (settled_at IS NOT NULL AND settlement_digest ~ '^[0-9a-f]{64}$'))),
  CONSTRAINT ai_provider_calls_settled_after_start_check CHECK (settled_at IS NULL OR settled_at >= started_at)
);
CREATE INDEX ai_provider_calls_user_started_idx ON public.ai_provider_calls (user_id, started_at);
CREATE INDEX ai_provider_calls_started_idx ON public.ai_provider_calls (started_at);
CREATE INDEX ai_provider_calls_pending_idx ON public.ai_provider_calls (started_at) WHERE call_state = 'PENDING';
CREATE INDEX ai_provider_calls_attempt_idx ON public.ai_provider_calls (user_id, source_turn_id, feature_family)
  WHERE source_turn_id IS NOT NULL;

-- Normalized usage quantities. A row exists only for a kind the provider actually reported.
CREATE TABLE public.ai_provider_call_usage (
  provider_call_id uuid NOT NULL REFERENCES public.ai_provider_calls (id) ON DELETE CASCADE,
  usage_kind text NOT NULL,
  quantity bigint NOT NULL,
  PRIMARY KEY (provider_call_id, usage_kind),
  CONSTRAINT ai_provider_call_usage_kind_check CHECK (usage_kind IN (
    'INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN')),
  CONSTRAINT ai_provider_call_usage_quantity_check CHECK (quantity >= 0)
);

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Layer B - Price Cards. Server-only, owner-registered, effective-dated, never overlapping, immutable once used.
--    This migration registers NO price: no provider rate is hard-coded anywhere.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE public.ai_price_cards (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  card_class text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  operation text NOT NULL,
  usage_kind text NOT NULL,
  unit_price numeric NOT NULL,
  price_basis_units bigint NOT NULL,
  currency text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source_reference text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ai_price_cards_class_check CHECK (card_class IN ('PRODUCTION', 'TEST_ONLY')),
  -- A TEST_ONLY price can only ever name the TEST_PROVIDER, whose calls no API path can create, and a PRODUCTION
  -- price can never name it: a synthetic price is structurally unable to rate production usage.
  CONSTRAINT ai_price_cards_test_isolation_check CHECK ((card_class = 'TEST_ONLY') = (provider = 'TEST_PROVIDER')),
  CONSTRAINT ai_price_cards_operation_check CHECK (public.ai_provider_operation_is_known_v1(provider, operation)),
  CONSTRAINT ai_price_cards_model_check CHECK (model ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  CONSTRAINT ai_price_cards_kind_check CHECK (usage_kind = ANY (public.ai_complete_usage_kinds_v1(provider))),
  CONSTRAINT ai_price_cards_price_check CHECK (unit_price >= 0 AND unit_price < 1000000000),
  CONSTRAINT ai_price_cards_basis_check CHECK (price_basis_units IN (1, 1000, 1000000)),
  CONSTRAINT ai_price_cards_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT ai_price_cards_window_check CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT ai_price_cards_source_check CHECK (length(source_reference) BETWEEN 1 AND 300)
);
CREATE INDEX ai_price_cards_key_idx ON public.ai_price_cards (provider, model, operation, usage_kind, effective_from);

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Layer B - ratings. Versioned per call; exactly one canonical version; components keep the exact card used.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE public.ai_cost_ratings (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  provider_call_id uuid NOT NULL REFERENCES public.ai_provider_calls (id) ON DELETE CASCADE,
  rating_version integer NOT NULL,
  cost_basis text NOT NULL,
  rating_state text NOT NULL,
  unpriced_reason text,
  currency text,
  total_amount numeric,
  event_at timestamptz NOT NULL,
  rated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  is_canonical boolean NOT NULL,
  canonical_reason text NOT NULL,
  CONSTRAINT ai_cost_ratings_version_unique UNIQUE (provider_call_id, rating_version),
  CONSTRAINT ai_cost_ratings_version_check CHECK (rating_version >= 1),
  -- The seam for a future reconciled provider bill: it is named here and admitted nowhere until a real bill exists.
  CONSTRAINT ai_cost_ratings_basis_check CHECK (cost_basis = 'RATED_APPLICATION_COST'),
  CONSTRAINT ai_cost_ratings_state_check CHECK (rating_state IN ('RATED', 'UNPRICED', 'USAGE_UNKNOWN')),
  CONSTRAINT ai_cost_ratings_reason_check CHECK (canonical_reason IN (
    'INITIAL_SETTLEMENT', 'EXPLICIT_RERATE_PRICE_CARD_CORRECTION', 'EXPLICIT_RERATE_PRICE_CARD_BACKFILL')),
  CONSTRAINT ai_cost_ratings_reason_version_check CHECK ((canonical_reason = 'INITIAL_SETTLEMENT') = (rating_version = 1)),
  CONSTRAINT ai_cost_ratings_shape_check CHECK (
    CASE rating_state
      WHEN 'RATED' THEN currency ~ '^[A-Z]{3}$' AND total_amount >= 0 AND unpriced_reason IS NULL
      WHEN 'UNPRICED' THEN currency IS NULL AND total_amount IS NULL
                           AND unpriced_reason IN ('NO_EFFECTIVE_PRICE_CARD', 'MIXED_CURRENCY')
      ELSE currency IS NULL AND total_amount IS NULL AND unpriced_reason IS NULL
    END)
);
CREATE UNIQUE INDEX ai_cost_ratings_one_canonical_idx ON public.ai_cost_ratings (provider_call_id) WHERE is_canonical;

CREATE TABLE public.ai_cost_rating_components (
  cost_rating_id uuid NOT NULL REFERENCES public.ai_cost_ratings (id) ON DELETE CASCADE,
  usage_kind text NOT NULL,
  quantity bigint NOT NULL,
  price_card_id uuid NOT NULL REFERENCES public.ai_price_cards (id) ON DELETE RESTRICT,
  unit_price numeric NOT NULL,
  price_basis_units bigint NOT NULL,
  amount numeric NOT NULL,
  PRIMARY KEY (cost_rating_id, usage_kind),
  CONSTRAINT ai_cost_rating_components_kind_check CHECK (usage_kind IN (
    'INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN')),
  CONSTRAINT ai_cost_rating_components_quantity_check CHECK (quantity >= 0),
  CONSTRAINT ai_cost_rating_components_amount_check CHECK (amount >= 0)
);
CREATE INDEX ai_cost_rating_components_card_idx ON public.ai_cost_rating_components (price_card_id);

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Layer C - the Credit Policy contract. The name and the architecture are frozen; the numbers are not.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE public.ai_credit_policies (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  policy_key text NOT NULL,
  policy_version integer NOT NULL,
  lifecycle text NOT NULL,
  formula_kind text NOT NULL,
  cost_currency text NOT NULL,
  credits_per_cost_unit numeric NOT NULL,
  credit_scale smallint NOT NULL,
  rounding_mode text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  product_authorization_reference text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ai_credit_policies_version_unique UNIQUE (policy_key, policy_version),
  CONSTRAINT ai_credit_policies_key_check CHECK (policy_key ~ '^[a-z][a-z0-9_]{2,62}$'),
  CONSTRAINT ai_credit_policies_version_check CHECK (policy_version >= 1),
  -- THE activation gate. Only DRAFT exists: a policy can be simulated, never applied. Activating Credits requires a
  -- reviewed forward migration that widens this check under an explicit Product decision.
  CONSTRAINT ai_credit_policies_activation_gate_check CHECK (lifecycle IN ('DRAFT')),
  -- The one formula family v1: credits = rated application cost (in cost_currency) x credits_per_cost_unit, rounded
  -- to credit_scale decimals by rounding_mode. The family is fixed; every number in it belongs to a later policy.
  CONSTRAINT ai_credit_policies_formula_check CHECK (formula_kind = 'RATED_COST_LINEAR_V1'),
  CONSTRAINT ai_credit_policies_currency_check CHECK (cost_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT ai_credit_policies_rate_check CHECK (credits_per_cost_unit > 0),
  CONSTRAINT ai_credit_policies_scale_check CHECK (credit_scale BETWEEN 0 AND 6),
  CONSTRAINT ai_credit_policies_rounding_check CHECK (rounding_mode IN ('CEILING', 'FLOOR', 'HALF_UP')),
  CONSTRAINT ai_credit_policies_window_check CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT ai_credit_policies_authorization_check CHECK (
    product_authorization_reference IS NULL OR length(product_authorization_reference) BETWEEN 1 AND 300)
);

-- Historical Credit attribution, keyed to the exact cost rating and the exact policy version. It can hold a row only
-- under an ACTIVE policy (the trigger below), and no policy can be ACTIVE: no Credit is rated or debited anywhere.
CREATE TABLE public.ai_credit_ratings (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  cost_rating_id uuid NOT NULL REFERENCES public.ai_cost_ratings (id) ON DELETE CASCADE,
  credit_policy_id uuid NOT NULL REFERENCES public.ai_credit_policies (id) ON DELETE RESTRICT,
  credits numeric NOT NULL,
  rated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ai_credit_ratings_once_per_policy UNIQUE (cost_rating_id, credit_policy_id),
  CONSTRAINT ai_credit_ratings_credits_check CHECK (credits >= 0)
);

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Integrity triggers. History is append-only; the one permitted mutation of each relation is named exactly.
--    A cascading delete (pg_trigger_depth() > 0: the account's erasure reaching its rows) is always allowed.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.guard_ai_provider_call_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  -- Only the one settlement: PENDING -> settled, identity untouched.
  IF OLD.call_state <> 'PENDING' OR NEW.call_state = 'PENDING'
     OR (NEW.id, NEW.user_id, NEW.session_id, NEW.source_turn_id, NEW.provider, NEW.requested_model, NEW.operation,
         NEW.feature_family, NEW.processing_path, NEW.attempt_number, NEW.started_at)
        IS DISTINCT FROM
        (OLD.id, OLD.user_id, OLD.session_id, OLD.source_turn_id, OLD.provider, OLD.requested_model, OLD.operation,
         OLD.feature_family, OLD.processing_path, OLD.attempt_number, OLD.started_at) THEN
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ai_provider_call_mutation_v1 BEFORE UPDATE OR DELETE ON public.ai_provider_calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_provider_call_mutation_v1();

-- Usage, rating components and Credit ratings: never updated, deleted only with their parent.
CREATE FUNCTION public.reject_ai_accounting_fact_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_catalog.pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'AI_ACCOUNTING_FACT_IMMUTABLE' USING ERRCODE = '55000';
END $$;
CREATE TRIGGER reject_ai_provider_call_usage_mutation_v1 BEFORE UPDATE OR DELETE ON public.ai_provider_call_usage
  FOR EACH ROW EXECUTE FUNCTION public.reject_ai_accounting_fact_mutation_v1();
CREATE TRIGGER reject_ai_cost_rating_component_mutation_v1 BEFORE UPDATE OR DELETE ON public.ai_cost_rating_components
  FOR EACH ROW EXECUTE FUNCTION public.reject_ai_accounting_fact_mutation_v1();
CREATE TRIGGER reject_ai_credit_rating_mutation_v1 BEFORE UPDATE OR DELETE ON public.ai_credit_ratings
  FOR EACH ROW EXECUTE FUNCTION public.reject_ai_accounting_fact_mutation_v1();
CREATE TRIGGER reject_ai_credit_policy_mutation_v1 BEFORE UPDATE OR DELETE ON public.ai_credit_policies
  FOR EACH ROW EXECUTE FUNCTION public.reject_ai_accounting_fact_mutation_v1();

-- A rating is never rewritten; the only change is losing canonical status to an explicit newer version.
CREATE FUNCTION public.guard_ai_cost_rating_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'AI_COST_RATING_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF NOT (OLD.is_canonical AND NOT NEW.is_canonical)
     OR (to_jsonb(NEW) - 'is_canonical') IS DISTINCT FROM (to_jsonb(OLD) - 'is_canonical') THEN
    RAISE EXCEPTION 'AI_COST_RATING_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ai_cost_rating_mutation_v1 BEFORE UPDATE OR DELETE ON public.ai_cost_ratings
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_cost_rating_mutation_v1();

-- A Credit rating may exist only under an ACTIVE policy. The activation gate makes that impossible in this migration.
CREATE FUNCTION public.require_active_ai_credit_policy_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ai_credit_policies p WHERE p.id = NEW.credit_policy_id AND p.lifecycle = 'ACTIVE') THEN
    RAISE EXCEPTION 'CREDIT_POLICY_NOT_ACTIVATED' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER require_active_ai_credit_policy_v1 BEFORE INSERT ON public.ai_credit_ratings
  FOR EACH ROW EXECUTE FUNCTION public.require_active_ai_credit_policy_v1();

-- Price Cards: no two windows of one pricing key overlap (decided under a per-key lock, so concurrent registrations
-- cannot both pass); the only update is closing an open window, and only where no rated event would fall outside it.
CREATE FUNCTION public.guard_ai_price_card_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- An unreferenced card may be withdrawn; a referenced one is held by the components' RESTRICT foreign key.
    RETURN OLD;
  END IF;
  -- Exclusive per pricing key, taken before anything is judged. A rating takes the same key SHARED before it reads
  -- cards, so a window can never close while a rating against it is being written.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'qandeel.ai-price-card.v1:' || NEW.provider || '/' || NEW.model || '/' || NEW.operation || '/' || NEW.usage_kind, 0));
  IF TG_OP = 'UPDATE' THEN
    IF OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL
       OR (to_jsonb(NEW) - 'effective_to') IS DISTINCT FROM (to_jsonb(OLD) - 'effective_to') THEN
      RAISE EXCEPTION 'AI_PRICE_CARD_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    IF EXISTS (SELECT 1 FROM public.ai_cost_rating_components c JOIN public.ai_cost_ratings r ON r.id = c.cost_rating_id
                WHERE c.price_card_id = OLD.id AND r.event_at >= NEW.effective_to) THEN
      RAISE EXCEPTION 'AI_PRICE_CARD_WINDOW_IN_USE' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ai_price_cards p
              WHERE p.id <> NEW.id AND p.provider = NEW.provider AND p.model = NEW.model AND p.operation = NEW.operation
                AND p.usage_kind = NEW.usage_kind
                AND tstzrange(p.effective_from, p.effective_to, '[)') && tstzrange(NEW.effective_from, NEW.effective_to, '[)')) THEN
    RAISE EXCEPTION 'AI_PRICE_CARD_OVERLAP' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ai_price_card_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.ai_price_cards
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_price_card_v1();

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Exact arithmetic (internal, IMMUTABLE). Division never happens: the basis is a power of ten, applied as an exact
--    multiplication, so a sub-cent amount keeps every digit.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ai_rated_component_amount_v1(p_quantity bigint, p_unit_price numeric, p_basis bigint) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = '' AS $$
  SELECT p_quantity::numeric * p_unit_price * CASE p_basis WHEN 1 THEN 1::numeric WHEN 1000 THEN 0.001 WHEN 1000000 THEN 0.000001 END
$$;

-- The Credit formula family v1, as a pure function of its inputs. Used for simulation and by a later activated
-- policy; it writes nothing and reads no policy table.
CREATE FUNCTION public.ai_credits_for_rated_cost_v1(p_rated_amount numeric, p_credits_per_cost_unit numeric,
  p_credit_scale integer, p_rounding_mode text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE STRICT SET search_path = '' AS $$
DECLARE v_raw numeric; v_factor numeric;
BEGIN
  IF p_rated_amount < 0 OR p_credits_per_cost_unit <= 0 OR p_credit_scale NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'INVALID_CREDIT_POLICY_INPUT' USING ERRCODE = '22023';
  END IF;
  v_raw := p_rated_amount * p_credits_per_cost_unit;
  v_factor := pg_catalog.power(10::numeric, p_credit_scale)::numeric;
  RETURN pg_catalog.round(CASE p_rounding_mode
    WHEN 'CEILING' THEN pg_catalog.ceil(v_raw * v_factor) / v_factor
    WHEN 'FLOOR' THEN pg_catalog.floor(v_raw * v_factor) / v_factor
    WHEN 'HALF_UP' THEN pg_catalog.round(v_raw, p_credit_scale)
  END, p_credit_scale);
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Rating (internal). Rates one settled call at the instant it STARTED, by the cards effective then.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.ai_rate_provider_call_v1(p_call_id uuid, p_reason text) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  c public.ai_provider_calls;
  v_version integer;
  v_state text;
  v_reason text;
  v_currency text;
  v_total numeric;
  v_unpriced integer;
  v_currencies integer;
  v_rating uuid := pg_catalog.gen_random_uuid();
BEGIN
  SELECT * INTO c FROM public.ai_provider_calls x WHERE x.id = p_call_id FOR UPDATE;
  IF c.id IS NULL OR c.call_state IN ('PENDING', 'CANCELLED_BEFORE_PROVIDER') THEN
    RAISE EXCEPTION 'AI_PROVIDER_CALL_NOT_RATEABLE' USING ERRCODE = '55000';
  END IF;
  SELECT COALESCE(max(r.rating_version), 0) + 1 INTO v_version FROM public.ai_cost_ratings r WHERE r.provider_call_id = c.id;

  IF c.usage_completeness <> 'COMPLETE' THEN
    v_state := 'USAGE_UNKNOWN';
  ELSE
    -- Each pricing key this call reads, SHARED and in one order: ratings never block each other, and a card window
    -- cannot be closed or overlapped (the card guard takes the key exclusively) while this rating is written.
    PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(
      'qandeel.ai-price-card.v1:' || c.provider || '/' || c.requested_model || '/' || c.operation || '/' || k.usage_kind, 0))
      FROM (SELECT u.usage_kind FROM public.ai_provider_call_usage u WHERE u.provider_call_id = c.id
             ORDER BY u.usage_kind COLLATE "C") k;
    SELECT count(*) FILTER (WHERE p.id IS NULL), count(DISTINCT p.currency), min(p.currency),
           sum(public.ai_rated_component_amount_v1(u.quantity, p.unit_price, p.price_basis_units))
      INTO v_unpriced, v_currencies, v_currency, v_total
      FROM public.ai_provider_call_usage u
      LEFT JOIN LATERAL (
        SELECT q.id, q.currency, q.unit_price, q.price_basis_units FROM public.ai_price_cards q
         WHERE q.provider = c.provider AND q.model = c.requested_model AND q.operation = c.operation
           AND q.usage_kind = u.usage_kind AND q.effective_from <= c.started_at
           AND (q.effective_to IS NULL OR c.started_at < q.effective_to)) p ON true
     WHERE u.provider_call_id = c.id;
    IF v_unpriced > 0 THEN
      v_state := 'UNPRICED'; v_reason := 'NO_EFFECTIVE_PRICE_CARD';
    ELSIF v_currencies <> 1 THEN
      v_state := 'UNPRICED'; v_reason := 'MIXED_CURRENCY';
    ELSE
      v_state := 'RATED';
    END IF;
  END IF;

  UPDATE public.ai_cost_ratings r SET is_canonical = false WHERE r.provider_call_id = c.id AND r.is_canonical;
  INSERT INTO public.ai_cost_ratings (id, provider_call_id, rating_version, cost_basis, rating_state, unpriced_reason,
                                      currency, total_amount, event_at, is_canonical, canonical_reason)
  VALUES (v_rating, c.id, v_version, 'RATED_APPLICATION_COST', v_state, v_reason,
          CASE WHEN v_state = 'RATED' THEN v_currency END, CASE WHEN v_state = 'RATED' THEN v_total END,
          c.started_at, true, p_reason);
  IF v_state = 'RATED' THEN
    INSERT INTO public.ai_cost_rating_components (cost_rating_id, usage_kind, quantity, price_card_id, unit_price,
                                                  price_basis_units, amount)
    SELECT v_rating, u.usage_kind, u.quantity, q.id, q.unit_price, q.price_basis_units,
           public.ai_rated_component_amount_v1(u.quantity, q.unit_price, q.price_basis_units)
      FROM public.ai_provider_call_usage u
      JOIN public.ai_price_cards q
        ON q.provider = c.provider AND q.model = c.requested_model AND q.operation = c.operation
       AND q.usage_kind = u.usage_kind AND q.effective_from <= c.started_at
       AND (q.effective_to IS NULL OR c.started_at < q.effective_to)
     WHERE u.provider_call_id = c.id;
  END IF;
  RETURN v_state;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. The API's two commands (service role only). Ownership is explicit: the server names the account, and every
--    correlation identity it supplies must belong to that account.
-- ---------------------------------------------------------------------------------------------------------------

-- Record the intent of ONE external provider attempt, BEFORE it starts. Replaying the same begin is idempotent; the
-- same id with any other identity is refused. An erased (or unknown) account cannot begin: the foreign key refuses,
-- so no provider call can start for it.
CREATE FUNCTION public.begin_ai_provider_call_v1(
  p_call_id uuid, p_user_id uuid, p_session_id uuid, p_source_turn_id uuid, p_provider text, p_requested_model text,
  p_operation text, p_feature_family text, p_processing_path text
) RETURNS TABLE (begin_outcome text, attempt_number integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.ai_provider_calls; v_attempt integer;
BEGIN
  IF p_call_id IS NULL OR p_user_id IS NULL OR p_provider IS NULL OR p_requested_model IS NULL OR p_operation IS NULL
     OR p_feature_family IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF p_provider NOT IN ('OPENAI', 'ANTHROPIC', 'GEMINI') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL' USING ERRCODE = '22023';
  END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_source_turn_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversation_turns t
     WHERE t.id = p_source_turn_id AND t.user_id = p_user_id AND (p_session_id IS NULL OR t.session_id = p_session_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- One account's begins are serialized (attempt numbering); different accounts never wait on each other.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.ai-provider-call.v1:' || p_user_id::text, 0));
  SELECT * INTO existing FROM public.ai_provider_calls c WHERE c.id = p_call_id;
  IF existing.id IS NOT NULL THEN
    IF (existing.user_id, existing.session_id, existing.source_turn_id, existing.provider, existing.requested_model,
        existing.operation, existing.feature_family, existing.processing_path)
       IS NOT DISTINCT FROM
       (p_user_id, p_session_id, p_source_turn_id, p_provider, p_requested_model, p_operation, p_feature_family, p_processing_path) THEN
      RETURN QUERY SELECT 'ALREADY_BEGUN'::text, existing.attempt_number; RETURN;
    END IF;
    RAISE EXCEPTION 'AI_PROVIDER_CALL_IDENTITY_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  -- Each external attempt for the same work and feature is its own numbered row: a retry is never folded into one.
  SELECT CASE WHEN p_source_turn_id IS NULL THEN 1 ELSE count(*)::integer + 1 END INTO v_attempt
    FROM public.ai_provider_calls c
   WHERE c.user_id = p_user_id AND c.source_turn_id = p_source_turn_id AND c.feature_family = p_feature_family;
  INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, provider, requested_model, operation,
                                        feature_family, processing_path, attempt_number, call_state, started_at)
  VALUES (p_call_id, p_user_id, p_session_id, p_source_turn_id, p_provider, p_requested_model, p_operation,
          p_feature_family, p_processing_path, v_attempt, 'PENDING', clock_timestamp());
  RETURN QUERY SELECT 'BEGUN'::text, v_attempt;
END $$;

-- Close ONE attempt exactly once and rate it in the same transaction. p_usage is an object of normalized kind ->
-- non-negative whole number, carrying only the kinds the provider reported. The same settlement replayed answers
-- ALREADY_SETTLED; a different one is refused (PT409); concurrent settlements serialize on the call row and converge.
CREATE FUNCTION public.settle_ai_provider_call_v1(
  p_call_id uuid, p_user_id uuid, p_outcome text, p_usage_completeness text, p_usage jsonb
) RETURNS TABLE (settle_outcome text, call_state text, rating_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.ai_provider_calls;
  v_kinds text[];
  v_required text[];
  v_state text;
  v_digest text;
  v_rating text;
BEGIN
  IF p_call_id IS NULL OR p_user_id IS NULL OR p_outcome IS NULL OR p_usage_completeness IS NULL
     OR p_outcome NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED_BEFORE_PROVIDER')
     OR p_usage_completeness NOT IN ('COMPLETE', 'INCOMPLETE', 'ABSENT')
     OR p_usage IS NULL OR pg_catalog.jsonb_typeof(p_usage) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL_SETTLEMENT' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(p_usage) e
              WHERE e.key NOT IN ('INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN')
                 OR pg_catalog.jsonb_typeof(e.value) <> 'number' OR e.value::text !~ '^[0-9]{1,16}$') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL_SETTLEMENT' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(e.key ORDER BY e.key COLLATE "C"), ARRAY[]::text[]) INTO v_kinds FROM pg_catalog.jsonb_object_keys(p_usage) e(key);

  SELECT * INTO c FROM public.ai_provider_calls x WHERE x.id = p_call_id AND x.user_id = p_user_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;

  v_required := public.ai_complete_usage_kinds_v1(c.provider);
  IF (p_usage_completeness = 'ABSENT') <> (cardinality(v_kinds) = 0)
     OR (p_usage_completeness = 'COMPLETE' AND v_kinds <> v_required)
     OR (p_usage_completeness = 'INCOMPLETE' AND (NOT v_kinds <@ v_required OR v_kinds = v_required))
     OR (p_outcome = 'CANCELLED_BEFORE_PROVIDER' AND p_usage_completeness <> 'ABSENT') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CALL_SETTLEMENT' USING ERRCODE = '22023';
  END IF;

  v_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    p_outcome || '|' || p_usage_completeness || '|' ||
    COALESCE((SELECT string_agg(e.key || '=' || (e.value #>> '{}'), ',' ORDER BY e.key) FROM pg_catalog.jsonb_each(p_usage) e), ''),
    'UTF8')), 'hex');
  IF c.call_state <> 'PENDING' THEN
    IF c.settlement_digest = v_digest THEN
      SELECT r.rating_state INTO v_rating FROM public.ai_cost_ratings r WHERE r.provider_call_id = c.id AND r.is_canonical;
      RETURN QUERY SELECT 'ALREADY_SETTLED'::text, c.call_state, v_rating; RETURN;
    END IF;
    RAISE EXCEPTION 'AI_PROVIDER_CALL_SETTLEMENT_CONFLICT' USING ERRCODE = 'PT409';
  END IF;

  v_state := CASE
    WHEN p_outcome = 'CANCELLED_BEFORE_PROVIDER' THEN 'CANCELLED_BEFORE_PROVIDER'
    WHEN p_usage_completeness = 'ABSENT' THEN p_outcome || '_USAGE_UNKNOWN'
    ELSE p_outcome || '_USAGE_REPORTED' END;
  UPDATE public.ai_provider_calls x
     SET call_state = v_state, usage_completeness = p_usage_completeness, settled_at = clock_timestamp(),
         settlement_digest = v_digest
   WHERE x.id = c.id;
  INSERT INTO public.ai_provider_call_usage (provider_call_id, usage_kind, quantity)
  SELECT c.id, e.key, (e.value #>> '{}')::bigint FROM pg_catalog.jsonb_each(p_usage) e;
  IF v_state <> 'CANCELLED_BEFORE_PROVIDER' THEN
    v_rating := public.ai_rate_provider_call_v1(c.id, 'INITIAL_SETTLEMENT');
  END IF;
  RETURN QUERY SELECT 'SETTLED'::text, v_state, v_rating;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 10. Owner-only acts: register a Price Card, re-rate explicitly. No application role can execute either.
-- ---------------------------------------------------------------------------------------------------------------

-- Registers one price window. An open-ended predecessor of the same key is closed at the new start, which the guard
-- permits only when no rated event of the predecessor falls at or after it. A backdated window that overlaps an
-- existing one is refused.
CREATE FUNCTION public.register_ai_price_card_v1(
  p_card_class text, p_provider text, p_model text, p_operation text, p_usage_kind text, p_unit_price numeric,
  p_price_basis_units bigint, p_currency text, p_effective_from timestamptz, p_source_reference text
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_id uuid := pg_catalog.gen_random_uuid();
BEGIN
  UPDATE public.ai_price_cards p SET effective_to = p_effective_from
   WHERE p.provider = p_provider AND p.model = p_model AND p.operation = p_operation AND p.usage_kind = p_usage_kind
     AND p.effective_to IS NULL AND p.effective_from < p_effective_from;
  INSERT INTO public.ai_price_cards (id, card_class, provider, model, operation, usage_kind, unit_price, price_basis_units,
                                     currency, effective_from, source_reference)
  VALUES (v_id, p_card_class, p_provider, p_model, p_operation, p_usage_kind, p_unit_price, p_price_basis_units,
          p_currency, p_effective_from, p_source_reference);
  RETURN v_id;
END $$;

-- Explicit re-rating: a NEW version marked canonical for a stated reason. The previous version stays, auditable.
CREATE FUNCTION public.rerate_ai_provider_call_v1(p_call_id uuid, p_reason text) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF p_reason NOT IN ('EXPLICIT_RERATE_PRICE_CARD_CORRECTION', 'EXPLICIT_RERATE_PRICE_CARD_BACKFILL') THEN
    RAISE EXCEPTION 'INVALID_RERATE_REASON' USING ERRCODE = '22023';
  END IF;
  RETURN public.ai_rate_provider_call_v1(p_call_id, p_reason);
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 11. Content-free reads (service role only). Numbers and closed labels; no account, session or turn identity.
-- ---------------------------------------------------------------------------------------------------------------

-- Operational truth: how much accounting is open, stale (a crash between begin and settle) or unknown. A PENDING
-- call older than five minutes is stale: no provider timeout, foreground deadline (90 s) or work lease (120 s) lets a
-- live attempt run that long, so its cost is unknown and stays unknown.
CREATE FUNCTION public.server_read_ai_usage_operations_summary_v1()
RETURNS TABLE (
  pending_calls bigint, stale_pending_calls bigint, stale_pending_oldest_age_seconds bigint,
  settled_calls_24h bigint, failed_calls_24h bigint, cancelled_calls_24h bigint, usage_unknown_calls_24h bigint,
  rated_calls_24h bigint, unpriced_calls_24h bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    (SELECT count(*) FROM public.ai_provider_calls c WHERE c.call_state = 'PENDING'),
    (SELECT count(*) FROM public.ai_provider_calls c
      WHERE c.call_state = 'PENDING' AND c.started_at < clock_timestamp() - interval '5 minutes'),
    (SELECT COALESCE(floor(extract(epoch FROM clock_timestamp() - min(c.started_at)))::bigint, 0) FROM public.ai_provider_calls c
      WHERE c.call_state = 'PENDING' AND c.started_at < clock_timestamp() - interval '5 minutes'),
    count(*) FILTER (WHERE c.call_state <> 'PENDING'),
    count(*) FILTER (WHERE c.call_state IN ('FAILED_USAGE_REPORTED', 'FAILED_USAGE_UNKNOWN')),
    count(*) FILTER (WHERE c.call_state = 'CANCELLED_BEFORE_PROVIDER'),
    count(*) FILTER (WHERE r.rating_state = 'USAGE_UNKNOWN'),
    count(*) FILTER (WHERE r.rating_state = 'RATED'),
    count(*) FILTER (WHERE r.rating_state = 'UNPRICED')
  FROM public.ai_provider_calls c
  LEFT JOIN public.ai_cost_ratings r ON r.provider_call_id = c.id AND r.is_canonical
  WHERE c.started_at >= clock_timestamp() - interval '24 hours'
$$;

-- Attribution for operations: one row per UTC day x provider x model x feature x path x call state x rating state x
-- currency, with call counts, reported token quantities and the exact rated total as a decimal string. Never per
-- account: per-user diagnostics stay a database-owner act.
CREATE FUNCTION public.server_read_ai_cost_aggregates_v1(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  usage_day date, provider text, requested_model text, feature_family text, processing_path text, call_state text,
  rating_state text, currency text, calls bigint, input_tokens bigint, output_tokens bigint,
  cache_read_input_tokens bigint, cache_write_input_tokens bigint, rated_total_amount text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '93 days' THEN
    RAISE EXCEPTION 'INVALID_AGGREGATE_WINDOW' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT (c.started_at AT TIME ZONE 'UTC')::date, c.provider, c.requested_model, c.feature_family, c.processing_path,
         c.call_state, COALESCE(r.rating_state, CASE WHEN c.call_state = 'PENDING' THEN 'PENDING' ELSE 'NOT_RATED' END),
         r.currency, count(*),
         sum(u.input_tokens)::bigint, sum(u.output_tokens)::bigint, sum(u.cache_read)::bigint, sum(u.cache_write)::bigint,
         (sum(r.total_amount))::text
    FROM public.ai_provider_calls c
    LEFT JOIN public.ai_cost_ratings r ON r.provider_call_id = c.id AND r.is_canonical
    LEFT JOIN LATERAL (
      SELECT max(x.quantity) FILTER (WHERE x.usage_kind = 'INPUT_TOKEN') AS input_tokens,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'OUTPUT_TOKEN') AS output_tokens,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'CACHE_READ_INPUT_TOKEN') AS cache_read,
             max(x.quantity) FILTER (WHERE x.usage_kind = 'CACHE_WRITE_INPUT_TOKEN') AS cache_write
        FROM public.ai_provider_call_usage x WHERE x.provider_call_id = c.id) u ON true
   WHERE c.started_at >= p_from AND c.started_at < p_to
   GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
   ORDER BY 1, 2, 3, 4, 5, 6, 7, 8;
END $$;

-- The production Credit state. It is computed, never configured: CREDIT_POLICY_NOT_ACTIVATED while no policy is
-- ACTIVE - which the activation gate makes permanent until a reviewed migration widens it.
CREATE FUNCTION public.server_read_ai_credit_policy_state_v1() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.ai_credit_policies p WHERE p.lifecycle = 'ACTIVE')
              THEN 'CREDIT_POLICY_ACTIVE' ELSE 'CREDIT_POLICY_NOT_ACTIVATED' END
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 12. Ownership, row-level security and least privilege.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.ai_provider_calls OWNER TO postgres;
ALTER TABLE public.ai_provider_call_usage OWNER TO postgres;
ALTER TABLE public.ai_price_cards OWNER TO postgres;
ALTER TABLE public.ai_cost_ratings OWNER TO postgres;
ALTER TABLE public.ai_cost_rating_components OWNER TO postgres;
ALTER TABLE public.ai_credit_policies OWNER TO postgres;
ALTER TABLE public.ai_credit_ratings OWNER TO postgres;

ALTER TABLE public.ai_provider_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_call_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_price_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cost_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cost_rating_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_provider_calls, public.ai_provider_call_usage, public.ai_price_cards,
  public.ai_cost_ratings, public.ai_cost_rating_components, public.ai_credit_policies, public.ai_credit_ratings
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.ai_provider_operation_is_known_v1(text, text) OWNER TO postgres;
ALTER FUNCTION public.ai_complete_usage_kinds_v1(text) OWNER TO postgres;
ALTER FUNCTION public.guard_ai_provider_call_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.reject_ai_accounting_fact_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.guard_ai_cost_rating_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.require_active_ai_credit_policy_v1() OWNER TO postgres;
ALTER FUNCTION public.guard_ai_price_card_v1() OWNER TO postgres;
ALTER FUNCTION public.ai_rated_component_amount_v1(bigint, numeric, bigint) OWNER TO postgres;
ALTER FUNCTION public.ai_credits_for_rated_cost_v1(numeric, numeric, integer, text) OWNER TO postgres;
ALTER FUNCTION public.ai_rate_provider_call_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.begin_ai_provider_call_v1(uuid, uuid, uuid, uuid, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.settle_ai_provider_call_v1(uuid, uuid, text, text, jsonb) OWNER TO postgres;
ALTER FUNCTION public.register_ai_price_card_v1(text, text, text, text, text, numeric, bigint, text, timestamptz, text) OWNER TO postgres;
ALTER FUNCTION public.rerate_ai_provider_call_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.server_read_ai_usage_operations_summary_v1() OWNER TO postgres;
ALTER FUNCTION public.server_read_ai_cost_aggregates_v1(timestamptz, timestamptz) OWNER TO postgres;
ALTER FUNCTION public.server_read_ai_credit_policy_state_v1() OWNER TO postgres;

-- Every function is first closed to every role; then exactly the API's surface is opened to the server channel.
REVOKE ALL ON FUNCTION
  public.ai_provider_operation_is_known_v1(text, text), public.ai_complete_usage_kinds_v1(text),
  public.guard_ai_provider_call_mutation_v1(), public.reject_ai_accounting_fact_mutation_v1(),
  public.guard_ai_cost_rating_mutation_v1(), public.require_active_ai_credit_policy_v1(), public.guard_ai_price_card_v1(),
  public.ai_rated_component_amount_v1(bigint, numeric, bigint), public.ai_credits_for_rated_cost_v1(numeric, numeric, integer, text),
  public.ai_rate_provider_call_v1(uuid, text),
  public.begin_ai_provider_call_v1(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.settle_ai_provider_call_v1(uuid, uuid, text, text, jsonb),
  public.register_ai_price_card_v1(text, text, text, text, text, numeric, bigint, text, timestamptz, text),
  public.rerate_ai_provider_call_v1(uuid, text),
  public.server_read_ai_usage_operations_summary_v1(), public.server_read_ai_cost_aggregates_v1(timestamptz, timestamptz),
  public.server_read_ai_credit_policy_state_v1()
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.begin_ai_provider_call_v1(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.settle_ai_provider_call_v1(uuid, uuid, text, text, jsonb),
  public.server_read_ai_usage_operations_summary_v1(),
  public.server_read_ai_cost_aggregates_v1(timestamptz, timestamptz),
  public.server_read_ai_credit_policy_state_v1()
  TO service_role;

COMMIT;
