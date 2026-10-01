# QANDEEL — AI-COST-01 — Provider-Neutral AI Usage & Cost Ledger + Credit Accounting Foundation — Implementation Record v1

**Status:** `AI-COST-01` — **IMPLEMENTED — DRAFT PR #303, AWAITING INDEPENDENT REVIEW** (not merged by Claude).
**Baseline:** `main = c9add460be785fc5d4dd930146e217cee2972706` (PR #302, W3-CORR-U, merged). Migrations through `0134`
are canonical.
**Branch:** `feat/ai-cost-01-provider-neutral-cost-credit-ledger`.
- **Implementation commit:** `2b273d9`.
- **Code-review corrections:** `04d61c1`.
- **CI corrections:** `316b9da` (verifier counts are semantic, hazard H4) and `1c7fa3e` (the OpenAI smoke script treats
  unknown usage as a failed smoke). `1c7fa3e` is the **implementation evidence head**: API CI `36921034566` and
  focused `migration-0135` run `36922278357` both passed on it.

Every commit after `1c7fa3e` is documentation / governance only.
**Migration:** `0135_ai_usage_cost_credit_ledger_v1.sql` (the next free slot).
**Backlog:** no item names this task, so it inherits none (BG-05). No item is admitted (§13).
**Claude did not merge anything.**

---

## 1. Plain explanation for the Product Owner

- **Every AI call now leaves a receipt.** Before QANDEEL contacts an AI provider, it writes a durable "about to call"
  row. After the provider answers, it records what the provider said it used. That row says which account, which
  feature, which provider and model, and which FAST / DEEP path. If the server crashes in between, the row stays "open",
  and the operations summary shows it as stale. Nothing is guessed afterwards.
- **"We don't know" is never written as "free".** A missing usage report stays *unknown*. So does a failed call that
  might still have been billed. A usage with no price on file stays *unpriced*. None of them is ever counted as zero.
- **Prices are versioned, never hard-coded.** A price is a dated "Price Card" that an operator registers. A call is
  priced by the card that was valid when the call started. A new price never rewrites old history. No price is shipped,
  so every real call is honestly *UNPRICED* until a verified price is registered.
- **Credits are named, built for, and not switched on.** QANDEEL's unit is the **Credit**. A Credit is not a token and
  not dollars, and it does not depend on any provider. The machinery that will turn priced usage into Credits exists
  and can be simulated. But **no Credit formula, allowance, top-up, rollover or exhaustion value is chosen**, and the
  database cannot activate a policy until a later, reviewed Product decision does. The answer today is
  `CREDIT_POLICY_NOT_ACTIVATED`. Nobody's balance is touched, because no balance exists.
- **No provider was chosen.** The same accounting works for OpenAI, Anthropic, Gemini, and any provider added later.
- **The abuse bounds are unchanged.** PROD-SEC-02's turn admission and work limits are exactly as they were. Credits
  are not a security boundary.
- **Privacy.** The ledger holds identifiers and numbers only: no message, prompt, reply, Memory or error text. Deleting
  the account deletes its accounting rows.

## 2. G0 — repository truth

- **Main.** `git fetch` gave `origin/main = c9add460be785fc5d4dd930146e217cee2972706`, the merge of PR #302. The tree was
  clean. Main had not advanced, so there was no overlapping diff to inspect.
- **Migrations.** They end at `0134_understanding_integrity_v1.sql`, so `0135` is next.
- **Toolchain.** Node `v24.19.0`, npm `11.17.0`.
- **Branch.** `feat/ai-cost-01-provider-neutral-cost-credit-ledger`, created from `origin/main`.

## 3. G1 — Skills

| Skill | Inspected | Used | Why | Concrete effect |
|---|---|---|---|---|
| `code-review` (high) | yes | yes | Mandatory; a recall-oriented review of the full branch diff. | 9 findings. **Fixed:** the Price-Card window-close vs concurrent-rating race (per-key shared / exclusive locks, plus a committed race in the verifier); the silent invalid-model refusal; duplicate UUID validation. **Dispositioned:** the other 6 (§11). |
| `security-review` | yes | no (it cannot run here) | Mandatory; its shell steps need Bash, which App Control blocks on this host (known since PROD-OPS-01). | Replaced by a manual adversarial security pass, encoded permanently as the 41 planted defects of the static contract (§10) and the privilege / isolation / privacy sections of the real-PostgreSQL verifier. |
| Catalog search: PostgreSQL, database, observability, NestJS, FinOps / cost accounting, concurrency, reliability | yes | none available | `SearchSkills` returned no catalog skill for any of these keywords. | None. The repository's own verifier patterns (0131 / 0132 / 0133 / 0134) were followed instead. |
| Design / mobile skills listed in the session | reviewed for relevance | no | AI-COST-01 is backend / database only, and no mobile production code changes (§24 of the task). | None. |

## 4. Research refresh — primary sources (2026-10-01)

| Source | What it justifies | What it does NOT authorize |
|---|---|---|
| OpenTelemetry GenAI semantic conventions, attribute registry (`opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/`); the GenAI conventions now live in `open-telemetry/semantic-conventions-genai` | Input and output tokens are distinct. Cache-read and cache-creation input "SHOULD be included in" the input total, and reasoning output in the output total. Message / prompt content "is likely to contain sensitive information" and is not captured. So a **disjoint partition** is needed to avoid double charging, and nothing in the ledger carries content. | No GenAI attribute is adopted as a metric label. The `gen_ai.usage.*` attributes are now marked deprecated in the registry, so QANDEEL keeps its own bounded `qandeel.ai_usage.*` metric names, and the database is the authority. |
| FinOps Foundation — Unit Economics (`finops.org/framework/capabilities/unit-economics/`) | Cost per customer, transaction and token requires joining usage with billing data. Unit cost is used in architecture decisions *before* consumption. This supports per-call attribution (account, feature, path) and a simulator for comparing candidates. | Any target unit cost, margin, plan price or allowance. |
| FinOps cost-allocation principle: provider bill vs application request data; a price change must not rewrite history | The ledger's rating is named `RATED_APPLICATION_COST`, never "actual cost". A `RECONCILED_PROVIDER_COST` seam is named but not admitted. Price windows are effective-dated and immutable once used. | Invoice reconciliation: no real billing source exists in the repository. |
| OpenAI prompt caching (`developers.openai.com/api/docs/guides/prompt-caching`); OpenAI SDK 6.49 `ResponseUsage` types | `input_tokens` **includes** `input_tokens_details.cached_tokens` and `.cache_write_tokens`. Each input token is billed at exactly one of the uncached, cached or cache-write rates, and these rates differ. `output_tokens` includes `reasoning_tokens`. | Any OpenAI price, and any choice of OpenAI. |
| Anthropic prompt caching (`platform.claude.com/docs/en/build-with-claude/prompt-caching`); SDK 0.117 `Usage` | `input_tokens` **excludes** `cache_read_input_tokens` and `cache_creation_input_tokens`. 5-minute and 1-hour cache writes have different rates, so a 1-hour write is treated as unknown (§7), never mispriced. | Any Anthropic price, and any choice of Anthropic. |
| Gemini `UsageMetadata` (`ai.google.dev/api/generate-content`); Gemini token-counting docs | `promptTokenCount` **includes** `cachedContentTokenCount`. `thoughtsTokenCount` is **not** in `candidatesTokenCount` and is billed as output. The REST surface is proto3 JSON, which omits zero-valued scalars. | Any Gemini price, and any choice of Gemini. |

## 5. G2 — the full provider-call census (§20)

Every production provider transport in `apps/api/src` was found by scanning for `responses.create(`,
`messages.create(`, `generativelanguage.googleapis.com`, `new OpenAI(` and `new Anthropic(`. There are exactly nine.
The static contract pins this census, so a tenth path fails CI until it is listed and accounted.

| Provider path | Billable? | Provider / model authority | Feature family · path | User attribution | Session / turn | Usage returned | Retries | Several billable attempts per logical request? | Telemetry before | Ledger integrated? | Usage capture | Cost state | Proof |
|---|---:|---|---|---|---|---|---|---|---|---:|---|---|---|
| Model Router — OpenAI (`openai-model-router.ts`) | yes | `MODEL_PROVIDER`, model from `model-profile.registry` | `CONVERSATION_REPLY` · FAST / DEEP | yes (`createTurn`) | yes (canonical correlation) | yes (`usage`) | SDK `maxRetries: 0`; replay re-generates only through the bounded PROD-SEC-02 work-start budget | yes, across replays: each one is a new row | provider / model / path spans and token counters | **yes** | input / cached / cache-write / output | RATED / UNPRICED / USAGE_UNKNOWN | accounting + integration specs; contract census; verifier |
| Model Router — Anthropic (`claude-model-router.ts`) | yes | same | `CONVERSATION_REPLY` · FAST / DEEP | yes | yes | yes | `maxRetries: 0` | same | same | **yes** | input / cache read / cache write / output | same | same |
| CU segmentation (`openai-cu-segmentation.provider.ts`, frozen) | yes | `CU_SEGMENTATION_MODEL` (default `gpt-5-mini`) | `CU_SEGMENTATION` | yes | yes | yes, in the raw response; the adapter reads only `output_text` | `maxRetries: 0`; the stale-context retry reuses the segmentation (no second call) | yes: user half + assistant half, and replays | none | **yes**, at its binding, and the adapter is byte-identical | as OpenAI | same | contract blob pin + composition |
| Focus resolution (`openai-focus-resolution.provider.ts`, frozen) | yes | `FOCUS_RESOLUTION_MODEL` | `FOCUS_RESOLUTION` | yes | yes | yes (raw) | `maxRetries: 0`; one stale-context retry may call again (a new row) | yes | none | **yes** (decorated binding) | as OpenAI | same | same |
| Thread establishment (`openai-thread-establishment.provider.ts`, frozen) | yes | `THREAD_ESTABLISHMENT_MODEL` | `THREAD_FORMATION`* | yes | yes | yes (raw) | `maxRetries: 0` | yes | none | **yes** | as OpenAI | same | same |
| Thread continuity (`openai-thread-continuity.provider.ts`, frozen) | yes | `THREAD_CONTINUITY_MODEL` | `THREAD_CONTINUITY` (screen and resolve) | yes | yes | yes (raw) | `maxRetries: 0` | yes (screen + resolve) | none | **yes** | as OpenAI | same | same |
| Hypothesis intent extraction (`openai-hypothesis-intent-extraction.provider.ts`, frozen) | yes | `HYPOTHESIS_INTENT_EXTRACTION_MODEL` | `HYPOTHESIS_INTENT_EXTRACTION` · the turn's path | yes (post-response subject) | yes (event) | yes (raw) | `maxRetries: 0`; QIR-005 allows one slot per durable execution | no (one durable slot) | outcome counters | **yes** | as OpenAI | same | same |
| Hypothesis evidence association (`gemini-hypothesis-evidence-association.provider.ts`, frozen) | yes | `HYPOTHESIS_EVIDENCE_ASSOCIATION_MODEL` | `HYPOTHESIS_EVIDENCE_ASSOCIATION` | yes | yes | yes (`usageMetadata`) | no retry; one QIR-005 slot | no | none | **yes** (accounted transport) | input / cached / output | same | same |
| Hypothesis candidate generation (`gemini-hypothesis-candidate.generator.ts`, frozen) | yes | `HYPOTHESIS_CANDIDATE_GENERATION_MODEL` | `HYPOTHESIS_CANDIDATE_GENERATION` | yes | yes | yes | one QIR-005 slot | no | outcome counters | **yes** | input / cached / output | same | same |
| Health probes (`apps/api/src/health/`) | **no** | — | — | — | — | — | — | — | — | not applicable | — | — | the contract proves no provider transport exists in `health/` |
| `brain-eval` harness (`apps/api/scripts/brain-eval.ts`, `apps/api/src/brain-eval/`) | yes, but **operator-only, not production** | the routers' `fromEnvironment()` without accounting | evaluation | no reader | — | yes | gated by `QANDEEL_ALLOW_PAID_EVAL=1` | — | — | **not production**: owned by the roadmap's *QANDEEL-specific Model / Provider Benchmark & Selection* | its usage is now `null` when unknown, never 0 | its prices stay `null` (contract-pinned) | the contract proves nothing in production imports it |

| Operator smoke scripts (`apps/api/scripts/verify-openai-smoke.ts`, `verify-claude-smoke.ts`) | yes, one call per manual run, **operator-only, not production** | the routers' `fromEnvironment()` without accounting | smoke | no reader | — | yes | none | no | — | **not production**: manual, credential-gated provider liveness checks, owned by the same benchmark / selection work as `brain-eval` | they now fail when usage is unknown, instead of comparing `null` | — | the scripts' TypeScript project is type-checked in API CI |

\* The feature family is named `THREAD_FORMATION`. The Thread-layer contract forbids the `thread_establish` substring
in any later migration, and the family name is stored in 0135's CHECK constraint.

**Attribution entries.** Exactly two production entries start provider work, and each opens one attribution scope.
`ConversationService.createTurn` opens it for the authenticated reader; the session and user turn come from the
canonical correlation. The post-response consumer opens it for the event's subject, and the dispatcher reaches a
provider only after the canonical authority has verified that subject. The ledger's `begin` command checks the session
and turn against the account again. A call with no scope, or with a non-UUID identity, is refused before the provider
is contacted.

## 6. Migration 0135

Forward-only. Migrations 0001–0134 are byte-unchanged.

- **Layer A — the call ledger.**
  - `ai_provider_calls` has one row per external attempt. Its account link is
    `user_id → public.users ON DELETE CASCADE`. Its correlation is session and source turn, verified against the
    account. Provider, operation, model, feature family and path are closed vocabularies. `attempt_number` is numbered
    by the database per (account, source turn, feature).
  - A call is written `PENDING` with `started_at = clock_timestamp()`. `settled_at` and a SHA-256 settlement digest are
    added at settlement. A shape CHECK binds each state to its completeness.
  - `ai_provider_call_usage` holds one row per **reported** normalized kind. A missing kind has no row.
- **Lifecycle (§5.2).**
  - `PENDING` → `SUCCEEDED_USAGE_REPORTED` / `SUCCEEDED_USAGE_UNKNOWN` / `FAILED_USAGE_REPORTED` /
    `FAILED_USAGE_UNKNOWN` / `CANCELLED_BEFORE_PROVIDER`.
  - The guard trigger permits exactly one transition, `PENDING` → settled, and never changes identity.
- **Layer B — Price Cards.** `ai_price_cards` records:
  - provider, model, operation and usage kind;
  - an exact `numeric` unit price, a basis of 1, 1 000 or 1 000 000 units, and an ISO currency;
  - `effective_from` and `effective_to`, and a bounded source reference;
  - the class, `PRODUCTION` or `TEST_ONLY`. A CHECK makes `TEST_ONLY` possible **only** for `TEST_PROVIDER`, whose calls
    no API path can create, so a synthetic price cannot rate production usage.

  The guard behaves as follows:
  - **Overlap.** It refuses any overlap of one pricing key's windows (`23P01`), deciding under a per-key lock.
  - **Updates.** It permits only the closing of an open window, and only where no rated event would fall outside it
    (`AI_PRICE_CARD_WINDOW_IN_USE`).
  - **Deletion.** A referenced card cannot be deleted (`RESTRICT`).

  **No price is registered by the migration.** `register_ai_price_card_v1` is a database-owner act only.
- **Layer B — ratings.**
  - `ai_cost_ratings` is versioned per call, with exactly one canonical version. Its cost basis is
    `RATED_APPLICATION_COST`, and its state is `RATED` / `UNPRICED (NO_EFFECTIVE_PRICE_CARD | MIXED_CURRENCY)` /
    `USAGE_UNKNOWN`. `PENDING` means a call with no rating yet.
  - `ai_cost_rating_components` keeps the exact card, unit price, basis and amount of each kind.
  - Ratings are immutable. The only change allowed is losing canonical status to an explicit, owner-only re-rating
    (`EXPLICIT_RERATE_PRICE_CARD_CORRECTION | _BACKFILL`), which keeps the old version.
- **Exact math.** Each component is `quantity × unit_price × {1 | 0.001 | 0.000001}` in PostgreSQL `numeric`: a
  multiplication only, so nothing is rounded. A rating takes each pricing key's lock **shared** before it reads cards,
  and the card guard takes it **exclusively**, so a window cannot close under a rating being written.
- **Layer C — Credit Policy foundation.** `ai_credit_policies` holds the key, version, effective window, formula family
  `RATED_COST_LINEAR_V1`, cost currency, `credits_per_cost_unit`, scale, rounding mode and an optional Product
  authorization reference.
  - **The activation gate is `CHECK (lifecycle IN ('DRAFT'))`.**
  - `ai_credit_ratings` can be written only under an `ACTIVE` policy (trigger), and is immutable.
  - `ai_credits_for_rated_cost_v1` is the pure formula: rated cost × rate, rounded `CEILING`, `FLOOR` or `HALF_UP`,
    exactly.
  - `server_read_ai_credit_policy_state_v1()` → `CREDIT_POLICY_NOT_ACTIVATED`.
- **Reads.** Three content-free reads: the two below and `server_read_ai_credit_policy_state_v1()` above.
  - `server_read_ai_usage_operations_summary_v1()` returns numbers only: pending, **stale pending** (older than 5
    minutes, which no live attempt can reach) with its oldest age, and the 24-hour settled / failed / cancelled /
    unknown / rated / unpriced counts.
  - `server_read_ai_cost_aggregates_v1(from, to)` returns UTC-day × provider × model × feature × path × state ×
    currency rows: counts, reported quantities and the exact rated total as a decimal string. It is never per account,
    and its window is capped at 93 days.
- **Authority.**
  - All seven tables have RLS on, zero policies, and every privilege revoked from `PUBLIC`, `anon`, `authenticated` and
    `service_role`.
  - Exactly five functions are `EXECUTE`-able by `service_role`: `begin`, `settle`, the summary, the aggregates and the
    Credit state, so two commands and three content-free reads. Every other function is executable by no application role.
  - Owner `postgres`, `search_path = ''`. There are no sequences.

## 7. Normalized usage registry

The kinds are `INPUT_TOKEN` (uncached), `CACHE_READ_INPUT_TOKEN`, `CACHE_WRITE_INPUT_TOKEN` and `OUTPUT_TOKEN`
(reasoning / thinking included). They are a disjoint partition, so each is rated independently.

| Provider | COMPLETE partition | Rule |
|---|---|---|
| OpenAI | all four | `INPUT = input_tokens − cached_tokens − cache_write_tokens`. A missing or contradictory cache field leaves the input unknown, and the call is INCOMPLETE. |
| Anthropic | all four | Fields map one to one. A `null` field is unknown. Any 1-hour cache write makes the call INCOMPLETE, because its rate differs. |
| Gemini | input, cache read, output | `INPUT = promptTokenCount − cachedContentTokenCount`; `OUTPUT = candidates + thoughts`. An optional count missing from a **present** `usageMetadata` is proto3's omitted zero. A missing `promptTokenCount` or `usageMetadata` is never assumed. Tool-use prompt tokens make the call INCOMPLETE. |

Only `COMPLETE` usage is rated. `INCOMPLETE` stores the certain kinds and rates `USAGE_UNKNOWN`. No audio or other unit
exists: that needs a reviewed extension backed by provider billing truth.

## 8. API boundary

The boundary lives in `apps/api/src/ai-usage/`.

- **`AiProviderCallAccounting.track`** runs attribution → `begin` → provider → `settle`.
  - **Before the provider:** no scope, a bad model identity or a begin failure all raise one 503-shaped error before
    any contact. Each adapter's existing classifier maps it to its bounded failure: the reply fails through the
    canonical turn failure; the semantic chain stays retryable; a post-response effect is quarantined under QIR-005.
  - **Cancellation:** an abort observed before the request is `CANCELLED_BEFORE_PROVIDER`.
  - **Provider failure:** `FAILED` with absent usage, and the error is rethrown unchanged.
  - **Success:** usage is normalized; anything unreadable is absent.
  - **Settlement:** one retry, then a visible failure. The Product answer is never changed.
- **Transport wrappers.** These are `accountedOpenAIResponsesClient`, `accountedAnthropicMessagesClient` and
  `accountedGeminiTransport`.
  - The provider is fixed by the wrapper.
  - The model comes from the server-built request or the server config.
  - One wrapped call is one row.
- **Composition (the only places the adapters are built):**
  - `createConfiguredModelRouter`;
  - `conversation.module.ts`, through `costLedgerDecorator(...)`, which is passed to the three semantic binding
    factories as an optional client decorator (they import nothing new) and applied to CU segmentation;
  - the three hypothesis provider modules.
- **Telemetry.**
  - `qandeel.ai_usage.accounting {stage, outcome}`.
  - `qandeel.ai_usage.provider_calls {provider, feature_family, outcome, usage_completeness}`.
  - `qandeel.ai_usage.tokens {provider, feature_family, usage_kind}`, with the quantity as the value.
  - The `qandeel.ai_usage.operations.*` gauges, from the summary every 60 s (the worker lives in `AiUsageModule`,
    under `ModelRouterModule`).
  - The scan's own health, through the PROD-OPS-01 operational-outcome mechanism (independent review correction A):
    `qandeel.operations.outcomes {domain: AI_USAGE_ACCOUNTING, operation: operations_scan, outcome, policy_version}`.
    - `outcome` is `success | transport_failure | integrity_failure`. A failed RPC or a malformed answer is classified by
      the existing `classifyOperationalFailure` (by error kind only, never its text).
    - The scan stays fail-soft: `runOnce()` resolves, emits no gauge for a failed read, and the next cycle retries.
    - Read + parse is judged first. The outcome and the gauges are emitted afterwards through a `quietly` wrapper, so a
      throwing telemetry object is never counted as a failed scan and changes no accounting.
    - The combination is admitted in the shared finite registry `OPERATIONAL_OUTCOMES`; nothing outside it is emitted.

  Labels are closed registries. No account, session, turn or call id, no model string and no money ever becomes a
  label.

## 9. Simulator (§10)

- **Implementation.** `simulateAiCost` (`apps/api/src/ai-usage/ai-cost-simulation.ts`) uses BigInt-backed exact
  decimals and no JavaScript number arithmetic on money.
- **Input.** Normalized usage, versioned Price Cards with their sources, an optional Credit Policy and a label.
- **Output.**
  - the usage breakdown;
  - per-kind components;
  - the pricing state (`RATED` / `UNPRICED` / `USAGE_UNKNOWN`);
  - the exact rated cost;
  - Credits only when a policy is supplied and its currency matches. Otherwise the answer is
    `CREDIT_POLICY_NOT_SUPPLIED` or `NOT_COMPUTABLE`, never 0.
- **Purity.** It imports only its types and the decimal module, and touches no database, web page or balance.
- **CLI.** `npm run simulate:ai-cost -- docs/ai-cost/scenarios/TEST_ONLY-synthetic-four-kind-fixture.json` gives
  `0.00075225` and `0.76` Credits under the synthetic `TEST_ONLY` policy, and `CREDIT_POLICY_NOT_SUPPLIED` without one.
- **Proof.** The real-PostgreSQL verifier proves the compiled simulator equals the stored rating, component by
  component, and that the Credit formula equals `ai_credits_for_rated_cost_v1`.

## 10. Verification

- **Real PostgreSQL 17 (Focused Database Verification, run one at a time).** Each run passed.

  | Run | Verifier | Head |
  |---|---|---|
  | `36914274063` | `migration-0135` | `2b273d9` |
  | `36916020098` | `migration-0135` | corrected head `04d61c1`, including the new lock race |
  | `36922278357` | `migration-0135` | implementation evidence head `1c7fa3e` (semantic H4 counts) |
  | `36914565010` | `migration-0133` | — |
  | `36914848316` | `migration-0130` | — |
  | `36915084073` | `migration-0131` | — |
  | `36915356295` | `migration-0132` | — |

  The 0135 verifier proves:
  - all 16 points of the task's §18 and the math of §19;
  - the catalog, privilege and privacy census;
  - erasure through the real governed `server_erase_personal_account_v1`;
  - committed multi-connection races: identical settlements converge, conflicting ones refuse one, concurrent begins of
    one id converge, attempts are numbered without gaps, two accounts never wait on each other, and a window cannot
    close under a rating being written.
- **Root static contracts: 1081 / 1081** (after correction A), including the forward-safety mirror and PROD-OPS-01. The
  new `tests/ai-cost-01-provider-neutral-cost-credit-ledger-contract.test.mjs` has:
  - 3 structural tests (census and frozen adapters, a clean tree, forward-only);
  - **48 planted defects**: all 28 of §21, plus census, attribution and variant plants, and 7 operations-scan plants
    (a silent inner or outer `catch`, error text in the signal, no success outcome, gauges or signal outside the
    fail-soft wrapper, the registry entry dropped);
  - registration.
- **Independent review correction A (local).** API Jest 215 / 215 suites, 4904 tests (all but `api-http-bootstrap`),
  including the reworked `ai-usage-operations.worker.spec` (success, transport, integrity, throwing telemetry,
  no private data) and `observability.spec` (the registry's legal relation). Both TypeScript projects are clean.
- **Database static contracts:** 1281 / 1281 with 0135.
- **API Jest (local).** Every suite passes except the known host limitation: `api-http-bootstrap` cannot load the
  platform adapter here.
  - The full run before the attribution change was 214 / 215 suites. The one failure was `conversation.service.spec`,
    which uses non-UUID fixture ids. It was fixed by making an invalid attribution fail closed instead of throwing.
  - The rerun of the affected suites is green, and the 7 new `ai-usage` suites have 64+ tests.
- **TypeScript build:** clean.
- **Full API CI on PR #303:** see the PR checks. It is the authority for the API gate.
- **Re-anchored contracts (AI-COST-01).** Each keeps its own property:
  - `prod-sec-02`: every binding is still `guardForegroundBinding`;
  - `effective-live-focus` cutover: the factories are still registered, never their products;
  - the focus, Thread-runtime and continuity readiness contracts: the bindings are still lazy, and only an optional
    client decorator was added.

## 11. Review findings and dispositions

| # | Finding | Disposition |
|---|---|---|
| 1 | A Price-Card window close could race a concurrent rating. | **Fixed** (`04d61c1`): shared / exclusive per-key locks, plus a committed race in the verifier. |
| 2 | OpenAI usage requires `cache_write_tokens`. | **No change — deliberate.** The SDK types declare it required. Assuming its absence to be zero is exactly the forbidden "missing cache fields → uncached". If a model omits it, those calls are honestly USAGE_UNKNOWN, and the `usage_unknown_24h` gauge shows it at once. |
| 3 | `attempt_number` counts distinct calls of one feature, not only retries. | **Kept, documented.** It is the database-numbered ordinal of external attempts per (account, source turn, feature). Each external attempt is its own row (§5.3). The column is not a retry counter. |
| 4 | The awaited settlement adds a round trip per call. | **Kept.** A deterministic, durable settlement before the answer is the stronger truth. The cost is bounded (one RPC) and stays inside the PROD-SEC-02 deadline. A background settle is a later, measured optimization. |
| 5 | The per-account begin lock serializes one reader's parallel begins. | **Kept.** It makes attempt numbering exact. The lock is held for one indexed insert; two accounts never wait on each other (proven). |
| 6 | Gemini adapters classify an accounting outage as `PROVIDER_ERROR`. | **Kept.** Both are the adapter's existing bounded failure, and the frozen adapter cannot change. The outage itself is visible on `qandeel.ai_usage.accounting{begin,failure}`. |
| 7 | The invalid-model refusal was silent. | **Fixed.** |
| 8 | Duplicate UUID validation in the consumer. | **Fixed.** |
| 9 | The operations worker mirrors the privacy worker's timer. | **Kept.** Each one is about 40 lines, and sharing them would couple two unrelated domains. |
| IR-A | *Independent review:* a failed or malformed operations scan was swallowed by a silent `catch`, so the ledger's own monitor could go blind (PROD-OPS-01 posture). | **Fixed.** Fail-soft but visible: `AI_USAGE_ACCOUNTING / operations_scan` emits `success / transport_failure / integrity_failure` through the existing PROD-OPS-01 mechanism (§8). Proven by the worker spec and 7 planted defects. |
| IR-B | *Independent review:* the 0135 header said "two content-free reads". | **Fixed.** Three: the operations summary, the cost aggregates and the Credit policy state. Corrected in the migration comment, `database/README.md` and §6 here. Comment only; no SQL changed. |

## 12. Privacy, deletion and PROD-SEC-02

- **Content-free.** The tables hold UUIDs, closed vocabularies, model identifiers, integers, numerics, timestamps and a
  digest. There is no JSON column. The verifier proves no column names content, and every text column is closed by a
  CHECK. The ledger repository sends exactly the identity and normalized-quantity parameters (contract-pinned).
- **Deletion.**
  - `ai_provider_calls.user_id` cascades from `public.users`, which the governed 0130 erasure deletes last, inside its
    transaction. Usage, ratings, components and Credit ratings cascade in turn. The guards allow a cascading delete
    (`pg_trigger_depth() > 1`) and refuse any direct one.
  - After erasure, `begin` fails on the foreign key, so no call can start for an erased account.
  - Price cards are not personal data and stay.
  - **No new retention rule was invented.** No per-account cost row survives the account.
- **Export My Data.** Unchanged. Cost accounting is operational data about QANDEEL's spend, not the reader's content.
  Whether a future export shows usage or Credits belongs to the Plans / Credits / Usage Economy Product decision and to
  the existing Privacy & Data owner. No silent change was made.
- **PROD-SEC-02.** Preserved: 0131, `foreground-turn-work.ts` and `conversation-turn-work.repository.ts` are
  byte-identical (contract-pinned blob ids). The routers still check the deadline before their provider call, and all
  four semantic bindings stay inside `guardForegroundBinding`. Credits are not, and do not replace, the abuse bound.

## 13. Governance (BG-05 / BG-06 / BG-08)

- **Inherited: none.** No backlog item names AI-COST-01.
- **Admitted: none.** Every residue already has an owner:
  - **Numeric Credit formula, plans, allowances, balances, exhaustion and Text Continuity.** Owned by the roadmap's
    *Plans / Credits / Usage Economy* (`QANDEEL_PRODUCT_ROADMAP.md` §3). That work is to be decided from the measured
    economics this ledger now produces.
  - **Provider / model selection and registering verified production prices.** Owned by *QANDEEL-specific Model /
    Provider Benchmark & Selection* (same section). It is also the owner of the operator-only `brain-eval` harness.
  - **A `RECONCILED_PROVIDER_COST` against real bills.** Named as a seam. It needs a billing source, which belongs to
    Release Hardening's store / billing readiness.
  - **Company Ops consumption of the aggregates.** Owned by APP-OPS-01's implementation (Production Integration).

  None qualifies under BG-06's four routes as a new obligation (BG-06 forbids admitting anti-scope).
- **Re-anchored contracts** are listed in §10; no frozen semantics changed.
- **Lifecycle (BG-09).** This record is the task's primary document. Its banner reads *IMPLEMENTED — DRAFT PR, AWAITING
  INDEPENDENT REVIEW*. The task is not claimed `CLOSED / FROZEN` by Claude.

## 14. Final Gap Closure Matrix

| Gap | Final disposition | Evidence / owner |
|---|---|---|
| C-1 No durable per-provider-call usage ledger | **FIXED** | `ai_provider_calls` + `ai_provider_call_usage`. A PENDING intent is written before every attempt of all 9 census paths. Verifier §2–§3; contract census. |
| C-2 Usage categories incomplete / provider-specific | **FIXED BOUNDEDLY** | A disjoint 4-kind partition with per-provider normalizers (§7). Audio / other units need a reviewed registry extension. |
| C-3 No effective-dated Price Card authority | **FIXED** | `ai_price_cards`: effective windows, no overlap, immutable once used, TEST_ONLY isolation, owner-only. Verifier §4. |
| C-4 No truthful rated-cost lifecycle | **FIXED** | `RATED_APPLICATION_COST` ratings: `RATED / UNPRICED / USAGE_UNKNOWN / PENDING`, exact numeric math, explicit versioned re-rating, a reconciled-cost seam. |
| C-5 Unknown usage / cost can look like zero | **FIXED** | Unknown, failed and unpriced are never zero (normalizers, boundary and SQL). The stale-PENDING summary covers crashes, and the scan that reads it is itself visible when it fails (IR-A). 8 planted defects on this, plus 7 on the scan. |
| C-6 No QANDEEL Credit accounting abstraction | **FIXED FOUNDATION; numeric formula NOT ACTIVATED** | Credit Policy contract, formula family, activation gate (`DRAFT` only), `CREDIT_POLICY_NOT_ACTIVATED`, simulator. No balance. |
| C-7 Provider calls not fully attributed | **FIXED** | Account, session, turn, feature family and FAST / DEEP path on every production call, through the two attribution entries. `brain-eval` is non-production and owned by the benchmark roadmap item. |
| C-8 Account deletion / privacy coverage | **FIXED** | Cascade from `public.users` through the governed erasure (verifier §8). Content-free schema and payloads. Export unchanged (§12). |
| C-9 PROD-SEC-02 relationship | **PROVED PRESERVED** | Byte-identical 0131 and foreground scope (blob pins). Router and binding guards intact. The 0131 verifier passed (`36915084073`). |
| C-10 Provider / model selection | **NOT REQUIRED BY THIS TASK** | No provider or model chosen, no price registered. Owned by *QANDEEL-specific Model / Provider Benchmark & Selection*. |

**Orphan gaps = 0.**

**Credits** is recorded as QANDEEL's canonical usage / economy unit. **The numeric Credit formula is not frozen**, and
no Credit Policy is active.
