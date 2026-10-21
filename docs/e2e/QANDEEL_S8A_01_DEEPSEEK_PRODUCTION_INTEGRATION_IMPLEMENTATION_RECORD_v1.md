# QANDEEL — S8A-01 DeepSeek Production Integration & First Real Conversation — Implementation Record v1

**Task:** S8A-01 — DeepSeek Production Integration & First Real Conversation (Stage 8A)
**Status:** CLOSED / AT THE S8A-01 FINAL REVIEW & MERGE GATE — CP1–CP4 DELIVERED — CP4 PASSED (7 SYNTHETIC CALLS, ≤ USD 0.0084; PERSONAL DEEP BUDGET 20 s BY THE PRODUCT OWNER'S CONTROLLED CHANGE, 2026-10-21) — BG-08 / BG-09 RECONCILED — NOT MERGED / NOT DEPLOYED / SYNTHETIC QUALIFICATION ONLY / CLOSED TO USERS
**Date:** 2026-10-21
**Branch / base:** `s8a/s8a-01-deepseek-production-integration` from `main` at `26d05fff999b1188137ec0d2220f64ac5e7e456b`, the
merge of PR #352 (the Stage 8A DeepSeek-only direction, [S8A WP0](QANDEEL_S8A_WP0_DEEPSEEK_PRODUCT_DIRECTION_v1.md)). S7-05
merged through PR #351 as `daa5c415cb1d3bbbb987ea6e9ce750ceb43768dd`.
**Authority:** the Product Owner's S8A-01 Task Contract (CP0 research, then CP1 … CP4), and the S8A-01 CP0 Closure &
Implementation Direction (2026-10-21; seven binding decisions, §2). AI-COST-01 (migration `0135`, PR #303) and the
existing Model Router, FAST / DEEP, Behavioral Runtime, HIM and Memory contracts, all unchanged.

Merging, deploying, sending any real user's data to DeepSeek, opening any launch gate and starting S8A-02 each need the
Product Owner's explicit approval. None is done here. CP4 ran under the Product Owner's CP4 Authorization and DEEP decision
(2026-10-21): seven paid calls, synthetic data only (§8).

## 1. What S8A-01 delivers

| Checkpoint | Scope | State |
| --- | --- | --- |
| CP0 | Independent investigation and the Product Owner gate | DELIVERED (2026-10-21; report kept outside the repository); decided by the Closure & Implementation Direction (§2) |
| CP1 | The DeepSeek reply adapter behind the existing `ModelRouter`; FAST / DEEP profile; the synthetic-qualification gate | DELIVERED (§3) |
| CP2 | AI-COST-01 accounting for DeepSeek (migration `0170`); the output release guard | DELIVERED (§4, §5) |
| CP3 | Deterministic tests: unit, the real orchestrator over the accounted transport, real PostgreSQL | DELIVERED (§7) |
| CP4 | The first real conversation: synthetic data, at most 12 calls, a USD 0.30 cap | PASSED 2026-10-21 (§8): FAST passed; DEEP passed at 8.7 s after the Product Owner's DEEP decision raised its budget to 20 s (§8.6); the closing checkpoint (§10) |

## 2. The Product Owner's CP0 decisions (2026-10-21)

1. **API:** Chat Completions, model `deepseek-flash` only. No comparison with other DeepSeek APIs or models.
2. **FAST / DEEP:** FAST without thinking; DEEP with thinking at `low` effort. The existing latency policy is kept
   (FAST 3 s, DEEP 10 s, the 90 s turn deadline); it changes only if testing proves it impractical.
3. **Scope:** DeepSeek serves the **reply** (`CONVERSATION_REPLY`) in S8A-01. The real conversation is tested with
   synthetic data and deterministic doubles for the subsidiary operations. Moving the background calls to DeepSeek is
   recorded for the right Stage 8A tasks (`QAN-BL-AI-02`). The seven existing adapters are not rebuilt now, and
   DeepSeek-only is **not** claimed for production.
4. **Output protection:** an initial, specific, tested check before a reply is saved or shown. The input Safety Gate is
   not used as a trusted output classifier without evidence; no large moderation platform; a path that cannot reach the
   required protection stays closed.
5. **Data:** DeepSeek is synthetic-qualification only. Real users' data is not sent until the data-sharing, disclosure and
   consent requirements are met; those requirements and their owners are recorded (`QAN-BL-AI-01`), including in-app
   reporting, without implementing the compliance surfaces now.
6. **Ledger:** one forward-only migration admits DeepSeek correctly, including every closed-list and usage function;
   `0170` verified as next; no older migration changed; Credits not activated.
7. **Identity:** no real user identifier is sent during synthetic qualification.

## 3. CP1 — the DeepSeek reply adapter

- `apps/api/src/model-router/providers/deepseek/deepseek-model-router.ts` — `DeepSeekModelRouter implements ModelRouter`,
  selected by `MODEL_PROVIDER=deepseek` in `model-router.module.ts`. It is the only new provider path; the Anthropic and
  OpenAI routers are unchanged.
  - One request per turn to `https://api.deepseek.com` `POST /chat/completions` (`stream: false`, `maxRetries: 0`), with
    the ONE server guidance from `composeServerGuidance` as the `system` message, then the canonical history. The body
    carries only `model`, `messages`, `max_tokens`, `thinking` and, on DEEP, `reasoning_effort`: no `user` / `user_id`,
    no tools, no sampling parameters.
  - The reply is `choices[0].message.content` of exactly one choice whose `finish_reason` is `stop`. A filtered,
    truncated, aborted or resource-starved completion, no choice, two choices or a non-string content is a refusal to
    answer (`ModelRouterProviderError`), never a partial reply. `reasoning_content` is never read, kept, logged or sent
    back.
  - Usage the provider did not report stays unknown (`null`), never zero.
  - Each failure becomes the existing bounded "provider unavailable" outcome. The foreground budget is checked before
    the call, and the request is aborted at `min(latencyBudgetMs, 20 s)` (10 s until the Product Owner's DEEP decision, §8.6).
  - The SDK client is built with `organization`, `project`, `adminAPIKey` and `webhookSecret` set to `null` and a fixed
    `baseURL`, because the `openai` SDK would otherwise read `OPENAI_*` variables and send them to DeepSeek as headers or
    redirect the call. A wire test proves it.
- `model-profile.registry.ts` — `DEEPSEEK_MODEL_PROFILE`: FAST `deepseek-flash` / thinking `disabled`; DEEP
  `deepseek-flash` / thinking `enabled` / `reasoning_effort: low`. Output caps 1 024 (FAST) and 2 048 (DEEP), because
  DEEP's completion includes the reasoning.
- `deepseek-model-router.config.ts` — the **synthetic-qualification gate**: the router refuses to start when
  `NODE_ENV=production`, when `DEEPSEEK_QUALIFICATION_MODE` is not exactly `SYNTHETIC_ONLY`, or without
  `DEEPSEEK_API_KEY`. The key is server-only, read from the environment and never written to a tracked file; the
  readiness probe (`model-provider-health.probe.ts`) reports `configured` only when the same gate passes.

## 4. CP2 — AI-COST-01 accounting (migration `0170`)

- **Transport:** `accountedDeepSeekChatCompletionsClient` (`ai-usage/accounted-provider-clients.ts`) puts the reply's
  `chat.completions.create` behind the existing boundary: a durable PENDING row before the request, a settlement after,
  and no request at all when the intent cannot be written. `DeepSeekModelRouter.fromEnvironment` requires the accounting,
  so no unaccounted DeepSeek composition exists; the AI-COST-01 transport census now counts ten compositions and fails
  on an unaccounted DeepSeek client.
- **Usage partition:** `normalizeDeepSeekChatCompletionsUsage` — `INPUT_TOKEN` = `prompt_cache_miss_tokens`,
  `CACHE_READ_INPUT_TOKEN` = `prompt_cache_hit_tokens`, `OUTPUT_TOKEN` = `completion_tokens` (the reasoning is output,
  as 0135 rules). COMPLETE only when hit + miss = `prompt_tokens` and the output is known; a contradiction drops the
  affected kinds to INCOMPLETE rather than guessing.
- **Migration `0170_s8a_01_deepseek_provider_ledger_admission_v1.sql`** (forward-only, one transaction): replaces in place
  `ai_provider_operation_is_known_v1` (adds `DEEPSEEK` / `DEEPSEEK_CHAT_COMPLETIONS_CREATE`), `ai_complete_usage_kinds_v1`
  (adds the DeepSeek partition **and** an `ELSE` that answers an empty partition) and `begin_ai_provider_call_v1` (0135's
  body with one allow-list line changed). The three move together: in 0135 the CASE had no `ELSE`, so admitting a
  provider at begin alone would have let a NULL comparison pass the settlement and Price Card checks. Same signatures,
  volatility, security posture, `search_path`, owner and grants; the service-role surface stays the five 0135 functions;
  no table, row, price, Price Card, Credit policy or grant changes. DeepSeek calls settle `UNPRICED` until an operator
  registers a reviewed Price Card. Credits stay `CREDIT_POLICY_NOT_ACTIVATED`. Migrations `0001`–`0169` are unchanged.
  The next migration is `0171`. Documented in [`database/README.md`](../../database/README.md) (the 0170 section, with a
  forward-amendment note in the AI-COST-01 section).
- **Pricing truth:** DeepSeek's price differs by time of day; a Price Card has one effective window per kind, so that
  cannot be represented yet (`QAN-BL-AI-03`). Nothing is priced here.

## 5. CP2 — the output release guard

`apps/api/src/model-router/model-output-release-guard.ts` — `releaseModelOutput(candidate, serverGuidance)`, applied by the
DeepSeek router before the reply reaches the orchestrator, so a withheld output is never saved or shown (the turn fails
closed). It is a **structural** check, deliberately not a content classifier:

| Withheld as | When |
| --- | --- |
| `EMPTY` | nothing but whitespace |
| `UNREADABLE` | C0 / C1 control characters or U+FFFD |
| `INTERNAL_CONTAINER` | an opening or closing tag of a server context container (`user_memory_context`, `him_reasoning_context`, `him_brain_context`, `hypothesis_reasoning_context`, `recommendation_grounding_context`, `question_context`) or `think` |
| `GUIDANCE_ECHO` | a server-authored guidance sentence of 48 characters or more reproduced verbatim (whitespace-insensitive); the user's own data blocks are excluded, so a reply that repeats a Memory is not withheld |

The input Safety Gate is not used on the output (decision 4). Harmful-content moderation of a model's reply is not claimed:
it is one of the conditions before any real user reaches DeepSeek (`QAN-BL-AI-01`), and DeepSeek's own `content_filter`
finish is already a refusal (§3).

## 6. Data protection

- No real user's data reaches DeepSeek: the router cannot start in production or outside `SYNTHETIC_ONLY`, and CP4 is
  synthetic. The provider data terms, disclosure, consent, privacy-policy text, in-app report and its follow-up, a
  pseudonymous identifier and output moderation are recorded with their owner in `QAN-BL-AI-01`, not implemented.
- No end-user identifier is sent; the ledger and the provider span carry identities and numbers only (proved, §7).
- No transcript, guidance, Memory or reasoning is logged; the SDK's own logging is off.

## 7. CP3 — verification (local, 2026-10-21)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (apps/api) | clean |
| Jest `src/model-router`, `src/ai-usage`, `src/health` | 22 suites, 282 tests pass |
| Jest `conversation-orchestrator.service.spec.ts`, S8A-01 block (the real orchestrator, the real accounted transport, only the network replaced) | 4 pass: intent recorded before the request, the guidance as the system message, only the released reply persisted, no private text in the ledger or the span; a filtered completion fails the turn closed after one accounted attempt; a leaked container is never saved; a Safety BLOCK reaches neither the ledger nor DeepSeek |
| The full API Jest suite | 266 suites, 6 230 tests pass |
| AI-COST-01 contract (`tests/ai-cost-01-…`) | 53 / 53, with the planted defect "the DeepSeek reply client is composed unaccounted" caught |
| `database/verify-migration-0170.mjs` on PostgreSQL 17 (bootstrap + 0001–0170) | pass; the 0135 and 0150 verifiers also pass on 170 migrations |
| Negative control: the 0170 verifier on 0001–0169 | fails, as it must |
| The S8A-01 static contract (`tests/s8a-01-deepseek-production-integration-contract.test.mjs`, API CI) | 5 / 5, every detector shown to catch a planted defect |
| Root static contracts (113 scripts, every `test:*` script except forward-safety) | 113 pass |
| Forward-safety mirror contract | 35 / 35 |

### 7.1 Forward-safety and CI

The forward-safety mirror re-ran every contract against the authorized future changes (35 / 35 locally). The pull
request's GitHub CI is reported with the pull request; no CI result is claimed here before it ran.

### 7.2 Re-anchored pins

- `tests/prod-retry-01-data-api-stale-state-contract.test.mjs`: 0170 re-carries 0135's one `PT409`
  (`AI_PROVIDER_CALL_IDENTITY_CONFLICT`) and no other.
- `tests/s7-04-replay-player-navigation-contract.test.mjs`: "no Replay migration follows 0169", instead of "no migration".
- The current-task pins of the S5-03B, S5-03C, S7-03 and S7-04 contracts name S8A-01, with S7-05 kept as the previous
  task as written at its closing change. They had been failing on `main` since PR #352 replaced that line (API CI and
  Mobile CI on `26d05fff`); this change restores one current-task line.

## 8. CP4 — the first real conversation (2026-10-21)

Run under the Product Owner's CP4 Authorization (2026-10-21). CP1–CP3 were proven on GitHub at `5716bc8a` (API CI and
Mobile CI green, as the Product Owner reported). Six calls to `deepseek-flash` in all, between 06:51 and 06:53 UTC. All
input was synthetic and invented; no real person, account or identifier was used.

### 8.1 How it ran

- **Path.** The real Phase-1 conversation path, composed as production composes it:
  `ConversationRepository` (admission, claim, finalize) → `ConversationOrchestratorService` (Safety, Behavioral Runtime,
  HIM, Memory, Hypothesis, Question, Interaction Preferences, the Integrated Context Budget, FAST / DEEP) →
  `DeepSeekModelRouter.fromEnvironment` → the accounted DeepSeek transport → the AI-COST-01 ledger
  (`SupabaseAiProviderCallLedger`).
- **Database.** A disposable local PostgreSQL 17 built from the bootstrap and every migration through `0170`. The Data API
  was the CI-01 bounded SQL transport: same role and JWT claim per request, and an allow-list of tables and RPCs.
- **Doubles.** Only the foreground lease gate and the transport token were doubles. DeepSeek's reply was never simulated.
  Not exercised: the Phase-2 semantic chain and the post-response background work (CP0 decision 3); no OpenAI or Gemini
  client was composed.
- **Preconditions, checked before any call:**
  - `NODE_ENV=development`.
  - `DEEPSEEK_QUALIFICATION_MODE=SYNTHETIC_ONLY`.
  - The key present: read from a per-user file outside the repository into the child process only, never printed or written.
  - No other provider variable.
  - The composed router is a `DeepSeekModelRouter`, not a `FakeModelRouter`.
  - The database is the harness's own cluster on 127.0.0.1.
- **Network guard (preloaded before every module):**
  - Only `POST https://api.deepseek.com/chat/completions` and the local database were reachable. Every other fetch, HTTP,
    HTTP/2, TLS, socket, DNS and UDP path threw; a 13-probe self-test passed before each run.
  - The guard enforced the 12-attempt cap and the USD 0.30 cap itself.
  - Before each request it reserved the worst case at the peak rate: every request byte priced as a cache-miss token,
    plus the whole `max_tokens` priced as output.
  - Unknown usage was charged at that worst case, never as zero.
- **Zero-cost dry runs.** The same harness with the attempt cap at 0 proved the wiring first: the ledger intent was
  written before the refused request, the call settled `FAILED_USAGE_UNKNOWN`, and the turn failed closed.
- **Harness location.** Kept outside the repository, with the results (`.s8a-01-reports/`, untracked). It is a dev-only
  paid test, never a CI step.

### 8.2 Results

| # | Scenario | Path (decided = stored) | Provider wall time | Tokens: prompt (cache hit) / completion (reasoning) | `finish_reason` | Ledger |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | S1 greeting, one turn | FAST | 1.25 s | 1,216 (0) / 34 | `stop` | `SUCCEEDED_USAGE_REPORTED`, `COMPLETE`, `UNPRICED` |
| 2 | S2 a decision with three questions | DEEP (`MULTI_QUESTION`) | **10.03 s — aborted at the 10 s ceiling** | unknown | — | `FAILED_USAGE_UNKNOWN`, `ABSENT`, `USAGE_UNKNOWN` |
| 3 | S3 turn 1 (name, work, city) | FAST | 1.15 s | 1,223 (1,024) / 47 | `stop` | `SUCCEEDED_USAGE_REPORTED`, `COMPLETE`, `UNPRICED` |
| 4 | S3 turn 2 (tomorrow's recording) | FAST | 1.73 s | 1,295 (1,152) / 77 | `stop` | `SUCCEEDED_USAGE_REPORTED`, `COMPLETE`, `UNPRICED` |
| 5 | S3 turn 3 ("do you remember what I do and where?") | FAST | 1.07 s | 1,389 (1,152) / 35 | `stop` | `SUCCEEDED_USAGE_REPORTED`, `COMPLETE`, `UNPRICED` |
| 6 | S2 again, measurement only (§8.5) | DEEP | 8.82 s (headers at 0.62 s) | 1,428 (1,280) / 1,168 (697) | `stop` | `SUCCEEDED_USAGE_REPORTED`, `COMPLETE`, `UNPRICED` |

**Requests and ledger rows.**
- Every request carried exactly `model`, `messages`, `max_tokens`, `thinking`, `stream` and, for DEEP only,
  `reasoning_effort: low`. FAST had `thinking: disabled` and `max_tokens` 1024; DEEP had `thinking: enabled` and 2048. No
  `user` field or other identifier was sent.
- Every ledger row was written before its request, bound to its session and its source turn, with provider `DEEPSEEK`,
  operation `DEEPSEEK_CHAT_COMPLETIONS_CREATE`, family `CONVERSATION_REPLY`, attempt 1 and the stored path.
- Usage split as designed: cache hit → `CACHE_READ_INPUT_TOKEN`, cache miss → `INPUT_TOKEN`, completion (reasoning
  included) → `OUTPUT_TOKEN`. With no Price Card, the rating is `UNPRICED`.

**Controls.**
- No user text, reply or reasoning appeared in the telemetry or the ledger: 0 matches for every word of five or more
  letters.
- No Data API request was refused.
- The router never read the reasoning trace (CP1).

**Cost** (official `deepseek-flash` rates; every call ran in a peak window, so the applicable rate is peak):

| Item | Estimate (USD) |
| --- | --- |
| FAST, 4 calls (reported usage) | 0.000790 |
| DEEP measurement call (reported usage) | 0.001454 |
| DEEP aborted call (usage unknown; charged at its worst case, never as zero) | ≤ 0.004740 |
| **Total** | **≤ 0.006984 (≈ 2.3 % of the USD 0.30 cap)** |

- Cache reads began from the second call: the shared server-guidance prefix was cached, 1,024–1,280 tokens.
- Calls: 6 of the 12 authorised; no retry. The router's single attempt (`maxRetries: 0`) held.

**One blocked network attempt.**
- In the run with the aborted DEEP call, the guard refused one network attempt besides its self-test. Its destination was
  not recorded: the guard recorded it after that run.
- It was refused before any connection opened, so nothing left the process.
- The measurement run, recording every refusal, had none. It is reported here; it is not explained.

### 8.3 Reply quality (synthetic; the texts stay in the untracked results)

- **FAST.** Short, warm, in Egyptian Arabic, one question at a time, no lecture. The tomorrow's-recording turn offered a
  concrete choice of three worries instead of reassurance.
- **Context carried.** Asked "do you remember what I do and where?", the third S3 turn answered in one line: the work, the
  city, the studio and tomorrow's recording, all from the session's history.
- **Dialect drift.** One FAST reply used non-Egyptian forms ("أهلين" and "وش" for "what"). That is an S8A-02 matter
  (personality and dialects); CP4 changes no copy.
- **DEEP (the measurement call).**
  - It answered the user's three direct questions with concrete criteria: paid deposits, repeat clients, side income over
    three months, and a stop rule for the savings.
  - It ended with one clarifying question.
  - It was long, about 470 answer tokens, and used Markdown bold and bullets. Whether such length and formatting are
    acceptable on the mobile surface is an S8A-02 behaviour decision; nothing here changes it.

### 8.4 What CP4 proves, and what it does not

- **Proven:**
  - DeepSeek replies through QANDEEL's real foreground path with the instructions applied.
  - FAST fits its 3 s ceiling with room: 1.07–1.73 s.
  - Multi-turn context is carried.
  - The AI-COST-01 ledger records every call, success or failure, with the right state.
  - No content leaks to telemetry or the ledger.
  - A provider failure fails the turn closed, with nothing saved.
- **Not proven:**
  - That DEEP is reliable inside 10 s (§8.5).
  - Anything about real users, the Phase-2 chain, the background adapters or production.

### 8.5 The DEEP ceiling: measurement and proposal (decision for the Product Owner)

**Measured:**
- The aborted DEEP call ran past 10 s.
- The same prompt then took 8.82 s with the ceiling raised in the harness only: 0.62 s to headers, then 1,168 completion
  tokens (697 of them reasoning) at about 143 tokens/s.
- DEEP's `max_tokens` is 2048, reasoning included. A completion that uses it fully needs about 0.6 s + 2048 ÷ 143 ≈ 15 s.
- At `reasoning_effort: low`, DEEP therefore exceeds 10 s in ordinary use. One of the two runs did.

**The 10 s ceiling is not DeepSeek's alone.**
- The router uses `min(request.latencyBudgetMs, 10 s)`.
- The orchestrator's `latencyBudgetMs: DEEP 10000 / FAST 3000` is pinned by the FAST / DEEP v2 and Integrated Context
  Budget contracts.
- Changing it is a controlled change, not a CP4 fix. It is not made here.

**Proposal:**
- **Recommended:** raise DEEP's latency budget to 16 s (the orchestrator's DEEP budget and DeepSeek's DEEP timeout), with
  FAST unchanged at 3 s and the 90 s turn deadline unchanged. The figure is the full 2048-token completion at the
  measured throughput, plus margin. Done inside this pull request, with its contract pins and a test.
- **Alternatives, not recommended:**
  - Keep 10 s and lower DEEP's `max_tokens` to about 1,300. A long answer would then end in `length` and be refused, so
    the failures move rather than stop.
  - Stream DEEP. That is a larger change, outside S8A-01's scope.

### 8.6 The Product Owner's DEEP decision and its verification (2026-10-21)

**The decision.** The Product Owner approved a controlled change to the DEEP budget inside this pull request. No new task
was opened and no frozen contract was rewritten.
- DEEP: 20,000 ms instead of 10,000 ms, in the Orchestrator and the DeepSeek router.
- FAST stays 3,000 ms. DEEP's `max_tokens` stays 2,048, and the 90 s turn deadline is unchanged.
- The older OpenAI and Anthropic routers keep their own ceilings.

**Delivered:**
- `conversation-orchestrator.service.ts`: `latencyBudgetMs: selection.path === 'DEEP' ? 20000 : 3000`.
- `deepseek-model-router.config.ts`: `DEEPSEEK_PROVIDER_TIMEOUT_MS = 20_000`.
  - The router applies `min(request budget, this ceiling)`, so FAST is still cut at 3 s.
- The OpenAI and Anthropic routers are unchanged.
  - Each still applies `min(request budget, its own 10_000 ms)`, so their DEEP calls are still cut at 10 s: the same
    behaviour as before.
- The pins that named the old value are updated, each with a note of this change, and nothing else:
  - the S8A-01 blocks of `conversation-orchestrator.service.spec.ts` and `deepseek-model-router.spec.ts`;
  - `tests/fast-deep-runtime-decision-policy-v2-contract.test.mjs`: the source of its re-budget mutation;
  - `tests/integrated-context-budget-conflict-resolution-v1-contract.test.mjs`: the carried value;
  - `apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts`: the DEEP assertion.
- The frozen QIR-001 contract (`docs/integrated-intelligence-runtime-contract-v1.md`) still describes its own baseline
  (10000 DEEP) and is not rewritten. For the Personal DEEP budget, this record binds over it from its merge.
- **Not changed:** the Shared World and Public World reply inputs keep `DEEP 10000`. The decision names the Orchestrator
  and the DeepSeek router only. With DeepSeek, their DEEP replies are still cut at 10 s; the residue is
  `QAN-BL-AI-04` (§10).

**The verification call:**
- One real DEEP call, with the same synthetic three-question message, on the production router and budgets. No ceiling
  was raised in the harness.
- It counts against CP4's original caps: the guard carried the six earlier calls and their estimated cost in, so at most
  six more calls were possible.

| Provider wall time | Headers | Tokens: prompt (cache hit) / completion (reasoning) | `finish_reason` | Ledger |
| --- | --- | --- | --- | --- |
| 8.73 s (turn 8.82 s), under the 20 s budget | 0.38 s | 1,428 (1,280) / 1,071 (429) | `stop` | `SUCCEEDED_USAGE_REPORTED`, `COMPLETE`, `UNPRICED`, bound to its session and turn |

- The reply was complete and in Egyptian Arabic.
- It answered the three questions with testable criteria: paid deposits, repeat bookings, a monthly-income threshold over
  three months, and a stop rule.
- It ended with one question.
- It was again long and used Markdown, an observation for `QAN-BL-ACE-02`.
- Controls: no content in the telemetry or the ledger, and no network attempt refused.

**CP4 totals:**
- 7 of the 12 authorised calls.
- Cost: ≤ USD 0.008321 at the peak rate, the applicable one since every call ran in a peak window. This counts the
  aborted call at its worst case.
- **CP4 passed.**

**Verification of the change (local, 2026-10-21):**
- `tsc --noEmit` is clean.
- The affected Jest suites pass: the orchestrator, every Model Router, AI usage and ACE-SP-01, 19 suites in all.
- The root contracts that read the Orchestrator, the DeepSeek router, the locators, the backlog or this record pass.
- The task-closure governance contract passes.

## 9. Deliberately not implemented

- The seven background / semantic adapters (Focus Resolution, Thread Establishment, Thread Continuity, CU Segmentation and
  Hypothesis intent extraction on OpenAI; Hypothesis candidate generation and evidence association on Gemini) are not
  moved to DeepSeek (decision 3; `QAN-BL-AI-02`). The Personal Phase-2 chain still needs OpenAI.
- No disclosure, consent, policy or report surface; no output content moderation (`QAN-BL-AI-01`).
- No Price Card, Credit or plan; no time-of-day pricing (`QAN-BL-AI-03`).
- No personality or copy change (S8A-02), no Shared / Public semantic binding, no Matching producer.
- No deployment, no gate opened; the only paid calls are CP4's seven synthetic calls (§8).
- The Shared World and Public World DEEP budgets are not changed (`QAN-BL-AI-04`).

## 10. Backlog (BG-05 / BG-06)

- **Inherited at kickoff (BG-05):** S8A-01 owns no item by name. The Stage 8A items `QAN-BL-CW-05`, `QAN-BL-IP-02`,
  `QAN-BL-ACE-02`, `QAN-BL-MATCH-03` and `QAN-BL-MATCH-04` were read in full and are left as they stand (owner Stage 8A):
  none is claimed by S8A-01's contract. `QAN-BL-INTEL-02`'s reopen condition 4 ("Stage 8A binds a real intent or
  candidate provider") is not triggered: S8A-01 binds the reply only, and the intent and candidate providers are
  unchanged; `QAN-BL-AI-02` names the condition so that the task which moves them reads it. `QAN-BL-VOICE-01` is untouched.
- **Admitted at CP2 (effective from the merge):** `QAN-BL-AI-01` (real-user enablement for DeepSeek, `HIGH`, owner Stage 8A: output
  protection, the provider disclosures and the core data-sharing requirements; Stage 9 keeps the approval of the
  compliance surfaces and the final release requirements, Product Owner 2026-10-21),
  `QAN-BL-AI-02` (the background calls still bound to OpenAI / Gemini, `HIGH`, owner Stage 8A) and `QAN-BL-AI-03`
  (time-of-day pricing, `MEDIUM`).
- **BG-08 (the closing change, 2026-10-21):**
  - Inherited and left as they stand: `QAN-BL-CW-05`, `QAN-BL-IP-02`, `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and
    `QAN-BL-VOICE-01`. S8A-01's contract claims none of them.
  - `QAN-BL-ACE-02` stays `VALIDATION — OPEN` and carries CP4's Arabic-quality observations as evidence (§8.3, §8.6),
    as the Product Owner directed for the S8A-02 work.
  - `QAN-BL-INTEL-02`'s reopen condition 4 is not triggered.
  - `QAN-BL-AI-01` (the privacy and disclosure requirements, Stage 8A, as decided), `QAN-BL-AI-02` and
    `QAN-BL-AI-03` stay with their owners.
  - **Admitted:** `QAN-BL-AI-04` (Shared and Public World DEEP replies keep the 10 s budget under DeepSeek; `MEDIUM`,
    Stage 8A).
  - The register's §9 owner rows now list `QAN-BL-AI-01` … `AI-04`.
  - 82 items: 40 / 4 / 9 / 29 by status, 46 / 34 / 2 by severity.
  - The DEEP budget itself is S8A-01's own work and is delivered (§8.6). No item for it survives in a review comment or
    a report.
- **BG-09:** this record's banner is at its final state for the merge gate. The pull request is not merged.
