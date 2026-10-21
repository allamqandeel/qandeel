# QANDEEL — S8A-01 DeepSeek Production Integration & First Real Conversation — Implementation Record v1

**Task:** S8A-01 — DeepSeek Production Integration & First Real Conversation (Stage 8A)
**Status:** CP1–CP3 DELIVERED — CP4 (FIRST REAL CONVERSATION) AWAITING THE PRODUCT OWNER'S SEPARATE APPROVAL — NOT CLOSED — NOT MERGED / NOT DEPLOYED / SYNTHETIC QUALIFICATION ONLY / CLOSED TO USERS
**Date:** 2026-10-21
**Branch / base:** `s8a/s8a-01-deepseek-production-integration` from `main` at `26d05fff999b1188137ec0d2220f64ac5e7e456b`, the
merge of PR #352 (the Stage 8A DeepSeek-only direction, [S8A WP0](QANDEEL_S8A_WP0_DEEPSEEK_PRODUCT_DIRECTION_v1.md)). S7-05
merged through PR #351 as `daa5c415cb1d3bbbb987ea6e9ce750ceb43768dd`.
**Authority:** the Product Owner's S8A-01 Task Contract (CP0 research, then CP1 … CP4), and the S8A-01 CP0 Closure &
Implementation Direction (2026-10-21; seven binding decisions, §2). AI-COST-01 (migration `0135`, PR #303) and the
existing Model Router, FAST / DEEP, Behavioral Runtime, HIM and Memory contracts, all unchanged.

Merging, deploying, sending any real user's data to DeepSeek, opening any launch gate, running CP4 and starting S8A-02 each
need the Product Owner's explicit approval. None is done here. No paid call was made.

## 1. What S8A-01 delivers

| Checkpoint | Scope | State |
| --- | --- | --- |
| CP0 | Independent investigation and the Product Owner gate | DELIVERED (2026-10-21; report kept outside the repository); decided by the Closure & Implementation Direction (§2) |
| CP1 | The DeepSeek reply adapter behind the existing `ModelRouter`; FAST / DEEP profile; the synthetic-qualification gate | DELIVERED (§3) |
| CP2 | AI-COST-01 accounting for DeepSeek (migration `0170`); the output release guard | DELIVERED (§4, §5) |
| CP3 | Deterministic tests: unit, the real orchestrator over the accounted transport, real PostgreSQL | DELIVERED (§7) |
| CP4 | The first real conversation: synthetic data, at most 12 calls, a USD 0.30 cap | NOT RUN — awaits separate approval (§8) |

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
    the call, and the request is aborted at `min(latencyBudgetMs, 10 s)`.
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

## 8. CP4 — readiness (not run)

Ready on the code side; it runs only after the Product Owner's separate approval, with the key set by the Product Owner in
the local environment (never in the chat or a tracked file). The plan: one synthetic account in a local database, the real
Phase-1 conversation path (Safety, Behavioral Runtime, HIM, Memory, FAST / DEEP, the DeepSeek router, the AI-COST-01
ledger) with deterministic doubles for the subsidiary operations, a network allow-list of `api.deepseek.com` only, at most
12 calls and a USD 0.30 cap, measuring latency, tokens and the ledger's rows. A failure is reported, not retried around.

## 9. Deliberately not implemented

- The seven background / semantic adapters (Focus Resolution, Thread Establishment, Thread Continuity, CU Segmentation and
  Hypothesis intent extraction on OpenAI; Hypothesis candidate generation and evidence association on Gemini) are not
  moved to DeepSeek (decision 3; `QAN-BL-AI-02`). The Personal Phase-2 chain still needs OpenAI.
- No disclosure, consent, policy or report surface; no output content moderation (`QAN-BL-AI-01`).
- No Price Card, Credit or plan; no time-of-day pricing (`QAN-BL-AI-03`).
- No personality or copy change (S8A-02), no Shared / Public semantic binding, no Matching producer.
- No paid call, no deployment, no gate opened.

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
- **BG-08 / BG-09** are reconciled at CP4, the closing checkpoint; this record's banner moves to its final state then.
