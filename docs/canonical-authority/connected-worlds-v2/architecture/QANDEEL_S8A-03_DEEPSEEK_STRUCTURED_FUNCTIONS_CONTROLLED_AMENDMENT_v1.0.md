# QANDEEL — Stage 8A
## S8A-03 CP1 — DeepSeek Flash for the Seven Structured Functions — Narrow Controlled Amendment v1.0

**Status:** `CANONICAL CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE` (S8A-03 closing change, 2026-10-24). It binds
from the merge of the one S8A-03 pull request that carries it (PR #355), and the Founder merges only after approving it. Its model-visible texts (§5) are presented
verbatim for that approval  
**Scope:** the provider, model, transport and output mechanism of the seven structured AI functions, and the removal of
every non-DeepSeek production AI path. The semantics, ports, requests, validators, ledgers and budgets of those functions
are outside it  
**Amends, narrowly and only in that scope:** see §3 (the exact sentences, before and after)  
**Authority:** the Founder. Every date is local time, +03:00.
- *S8A-03 kickoff decisions* (2026-10-23): D1 — every production AI call goes to DeepSeek Flash, with no OpenAI, Gemini
  or Anthropic fallback and no Pro model; D3 — closed systems are consumed, through narrow controlled amendments only.
- *S8A-03 CP1 authorization* (2026-10-23): CP0's F1, F2, F3 and F10 approved within their CP0 scope; all seven structured
  functions move to DeepSeek Flash through Chat Completions with JSON Output and strict independent validation; every
  OpenAI, Gemini and Anthropic production path is removed without a hidden fallback; `SYNTHETIC_ONLY` applies to every
  adapter; the Controlled Amendment is prepared in the same change, with the new production texts shown verbatim.  
**Task:** `S8A-03` — CP1 (the DeepSeek-only brain). It is not a Connected Worlds phase  
**Implementation:** S8A-03, on branch `s8a/s8a-03-personal-understanding-reality` (§8)

This record is additive. No earlier record's bytes are changed. Each sentence it supersedes is quoted in §3 and binds as
superseded only after this record becomes effective. Historical records, bake-off evidence and their tests are kept as
the record of what was true when they were written.

---

# 1. Why an amendment is needed

Seven structured functions were bound, by their own contracts, to a named provider:

| # | Function | Port | Before S8A-03 |
|---|---|---|---|
| S1 | CU segmentation | `CuSegmentationProvider` | OpenAI Responses, `gpt-5-mini`, strict `json_schema` |
| S2 | Focus resolution | `FocusResolutionProvider` | OpenAI Responses, `gpt-5-mini`, strict `json_schema` |
| S3 | Thread establishment | `ThreadEstablishmentProvider` | OpenAI Responses, `gpt-5-mini`, strict `json_schema` |
| S4 | Thread continuity (screen, resolve) | `ThreadContinuityProvider` | OpenAI Responses, `gpt-5-mini`, strict `json_schema` |
| H1 | Hypothesis intent extraction | `HypothesisIntentExtractionProvider` | OpenAI Responses, `gpt-5-mini`, strict `json_schema` |
| H2 | Hypothesis candidate generation | `HypothesisCandidateGenerator` | Gemini `generateContent`, `gemini-2.5-flash`, `responseJsonSchema` |
| H3 | Hypothesis evidence association | `HypothesisEvidenceAssociationProvider` | Gemini `generateContent`, `gemini-2.5-flash-lite`, `responseJsonSchema` |

D1 makes DeepSeek Flash the only production provider. DeepSeek Chat Completions has no `json_schema` mode. It accepts
`response_format: {type: 'json_object'}` only, so each function's provider, model, transport and output clauses must
change. The reply router (S8A-01) was already on DeepSeek. Its OpenAI and Anthropic siblings, the two paid smokes and
the unaccounted live bake-off runner are removed with their providers.

# 2. The binding rule

For every one of S1–S4 and H1–H3:

1. **Provider and model.** The provider is `DEEPSEEK`, the model is `deepseek-flash`, and both are fixed in code. A
   leftover `<FUNCTION>_PROVIDER` other than `DEEPSEEK`, or a `<FUNCTION>_MODEL` other than `deepseek-flash`, fails
   loudly at the first use and is never silently ignored. No variable selects Pro; Pro needs a new Founder decision.
2. **One transport.** Every call is built by the shared module
   `apps/api/src/model-router/providers/deepseek/deepseek-client.ts`. It is the same module the reply router uses:
   - the fixed endpoint `https://api.deepseek.com`;
   - the SDK's `organization`, `project`, `adminAPIKey` and `webhookSecret` sources nulled;
   - logging off;
   - zero SDK retries.
3. **Qualification gate.** Every adapter passes `requireDeepSeekQualification` before it may exist:
   - a production process is refused;
   - `DEEPSEEK_QUALIFICATION_MODE=SYNTHETIC_ONLY` must be declared;
   - `DEEPSEEK_API_KEY` must be present.

   The gate runs lazily, at the first real call, never at bootstrap. No real user's data reaches DeepSeek
   (`QAN-BL-AI-01` stays open).
4. **Request.** Chat Completions, built by `deepSeekJsonRequest`. It has exactly six keys:
   - `model`;
   - `messages`: one system message and one user message;
   - `response_format: {type: 'json_object'}`;
   - `thinking: {type: 'disabled'}` (F3);
   - `max_tokens`;
   - `stream: false`.

   The system message is the function's existing instructions, then the JSON Output sentence and the function's closed
   schema (§5.2). The user message is the function's existing untrusted-data envelope, unchanged.
5. **Output.** A completion is accepted only when it has exactly one choice with `finish_reason: 'stop'` and non-empty
   content. Its content then goes to the function's existing fail-closed parser and deterministic validator. They are
   unchanged, except that H2 and H3 now read a one-key wrapper object (§5.3). Nothing is trusted because of the format
   flag. Every closed-schema rule the provider used to enforce (closed keys, enums, bounds and counts) is enforced by
   the parser and the validator.
6. **Errors.** The four existing error codes of each port are kept:
   - abort or connection timeout ⇒ `TIMEOUT`;
   - connection failure, HTTP 429 / 502 / 503 / 504, DeepSeek `insufficient_system_resource`, or a missing accounting
     intent ⇒ `UNAVAILABLE`;
   - any other provider failure ⇒ `PROVIDER_ERROR`;
   - unparseable or invalid output ⇒ `INVALID_STRUCTURED_OUTPUT`.

   No raw body, header, key, prompt or output is surfaced or logged.
7. **Accounting.** Each adapter's client is wrapped by `accountedDeepSeekChatCompletionsClient` under its existing
   AI-COST-01 family:
   - `CU_SEGMENTATION`, `FOCUS_RESOLUTION`, `THREAD_FORMATION` and `THREAD_CONTINUITY`;
   - `HYPOTHESIS_INTENT_EXTRACTION`, `HYPOTHESIS_CANDIDATE_GENERATION` and `HYPOTHESIS_EVIDENCE_ASSOCIATION`.

   The wrapper uses the existing `DEEPSEEK_CHAT_COMPLETIONS_CREATE` operation that migration 0170 admits. Each binding
   now requires its environment and its accounting decorator, so no composition can reach DeepSeek unaccounted. No
   adapter has a `fromEnvironment` of its own. No migration is added.
8. **Budgets.** Timeouts, retries and one request per invocation are unchanged. Output bounds are unchanged except H2:

| # | Timeout (default) | `max_tokens` | Prompt version |
|---|---|---|---|
| S1 | 5 000 ms | 2 048 | `cu-segmentation-anchored-v1` ⇒ `cu-segmentation-anchored-deepseek-v1` |
| S2 | 8 000 ms | 4 096 | `focus-resolution-anchored-v2` ⇒ `focus-resolution-anchored-deepseek-v1` |
| S3 | 8 000 ms | 1 024 | `thread-establishment-evidence-path-v1` ⇒ `thread-establishment-evidence-path-deepseek-v1` |
| S4 | 8 000 ms | 1 024 | `thread-continuity-identity-v1` ⇒ `thread-continuity-identity-deepseek-v1` |
| H1 | 5 000 ms | 256 | (no prompt version; schema version 1 unchanged) |
| H2 | 5 000 ms | **65 536 ⇒ default 4 096, maximum 8 192** | (schema version unchanged) |
| H3 | 5 000 ms | 256 default, 512 maximum | (schema version unchanged) |

   H2's old bound was Gemini 2.5 Flash's output ceiling, not a need. At most five bounded proposals
   (`MAX_GENERATED_HYPOTHESIS_CANDIDATES`) fit well inside 4 096 tokens, and 8 192 is the ceiling the configuration
   accepts.
9. **No other provider.** No production file imports, constructs, configures or reads a credential for OpenAI,
   Anthropic or Gemini:
   - `MODEL_PROVIDER` accepts `deepseek` only;
   - `@anthropic-ai/sdk` is removed from the API package;
   - the `openai` package stays only as the OpenAI-format SDK that the DeepSeek client is built with;
   - the AI-COST-01 contract's census proves all of this and fails on a planted regression.

   The ledger's provider vocabulary (`OPENAI`, `ANTHROPIC`, `GEMINI`, `DEEPSEEK`) mirrors the 0135 / 0170 database
   registries. It is kept as recorded history and has no transport behind it.

# 3. Superseded sentences — before and after

Each sentence below is superseded **in the provider / model / transport / output scope only**. Everything else in each
record (semantics, vocabularies, validators, bounds, laziness, privacy, error classes) is unchanged.

**3.1 `docs/hypothesis-intent-extraction-provider-binding-v1.md` (H1)**
- *Before:* "V1 binds the dedicated port to OpenAI Responses API Structured Outputs. The default profile is provider
  `OPENAI`, model `gpt-5-mini`, schema version 1, a 5,000 ms timeout, 256 maximum output tokens, zero retries, no
  fallback, and one request per adapter invocation. `HYPOTHESIS_INTENT_EXTRACTION_MODEL` and
  `HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS` are independently configurable; the existing `OPENAI_API_KEY` credential is
  reused without changing conversation-provider configuration."
- *After:* the port is bound to DeepSeek Chat Completions with JSON Output under §2. The profile is provider `DEEPSEEK`,
  model `deepseek-flash` (fixed), schema version 1, a 5,000 ms timeout, 256 maximum output tokens, zero retries, no
  fallback, and one request per adapter invocation. Only `HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS` is configurable; the
  credential is `DEEPSEEK_API_KEY` behind the §2.3 gate.
- *Before:* "The Responses API request uses `text.format` with `type: json_schema`, `strict: true`, and a closed object
  schema with `additionalProperties: false`."
- *After:* the request carries the same closed object schema inside the system instruction (§5.2), with
  `response_format: json_object`. The rest of that paragraph (the exact output keys, the bounds and every application
  rejection) is unchanged, and the parser now enforces the closed schema alone.
- *Before:* "Responses set `store: false`, use no streaming or tools, and perform no retry, fallback, or repair call."
- *After:* the request uses no streaming or tools and performs no retry, fallback or repair call. DeepSeek Chat
  Completions has no `store` parameter, so the request carries none. What DeepSeek may retain is a qualification
  question owned by `QAN-BL-AI-01`, and only synthetic data may reach it.

**3.2 `docs/controlled-hypothesis-candidate-generation-provider-binding-v1.md` (H2)**
- *Before:* "The production adapter is `GeminiHypothesisCandidateGenerator` … The model remains configurable and
  replaceable, with the v1 default fixed to `gemini-2.5-flash` and provider fixed to `GEMINI`."
- *After:* the production adapter is `DeepSeekHypothesisCandidateGenerator`, behind the same token. The provider is
  `DEEPSEEK` and the model `deepseek-flash`, both fixed in code.
- *Before:* "The adapter uses the Gemini Developer API REST `models/{model}:generateContent` mechanism through the
  platform `fetch` implementation; no SDK dependency is added. It sends text only, requests `application/json`, supplies
  a closed `responseJsonSchema`, sets `candidateCount: 1`, and fixes `thinkingBudget: 0`."
- *After:* the adapter uses DeepSeek Chat Completions through the shared client (§2.2). It sends text only, requests
  JSON Output, carries the closed schema in the system instruction, and disables thinking. A completion with more than
  one choice is rejected. The "no tools, search, grounding, …" sentence is unchanged.
- *Before:* "The output bound is 65,536 tokens, derived from the existing worst-case five-proposal text bounds and capped
  at Gemini 2.5 Flash's output limit."
- *After:* the output bound defaults to 4,096 tokens and accepts at most 8,192 (§2.8). The rest of that paragraph is
  unchanged.
- *Before (§31):* "raw Gemini bodies, headers, keys, prompts, output, and private content are not surfaced …"
- *After:* the same holds for DeepSeek.

**3.3 `docs/hypothesis-evidence-association-provider-binding-v1.md` (H3)**
- *Before:* "A2.2b binds the dormant `HypothesisEvidenceAssociationProvider` token to Gemini `gemini-2.5-flash-lite`. It
  uses one candidate, thinking budget `0`, a five-second timeout, 256 default output tokens (512 hard maximum), and zero
  retries, fallback, or repair calls."
- *After:* the token is bound to DeepSeek `deepseek-flash` under §2: one choice, thinking disabled, a five-second
  timeout, 256 default output tokens (512 hard maximum), and zero retries, fallback or repair calls.
- *Before:* "… authorization state reaches Gemini."
- *After:* the same holds for DeepSeek. The supplied-hypothesis-ID enum, which Gemini enforced, stays in the schema the
  model sees and is enforced by `validProposal`.

**3.4 `docs/reference-attention-focus-evaluator-v1.md` (S2)**
- *Before:* "A strict `json_schema` (`additionalProperties: false` at every level, every property required, frozen
  vocabularies as enums, `store: false`, zero SDK retries, explicit abort timeout, untrusted-data envelope)"
- *After:* the same closed schema (`additionalProperties: false` at every level, every property required, frozen
  vocabularies as enums) travels in the system instruction under JSON Output, with zero SDK retries, an explicit abort
  timeout and the untrusted-data envelope. The exported fail-closed parser `parseFocusResolutionOutput` enforces it,
  and `store` is gone (§3.1).
- *Before:* "`FOCUS_RESOLUTION_PROVIDER` (`OPENAI`), `OPENAI_API_KEY`, `FOCUS_RESOLUTION_MODEL` (default `gpt-5-mini`),
  `FOCUS_RESOLUTION_TIMEOUT_MS` (1000..20000, default 8000). Nothing reads these at bootstrap;
  `OpenAiFocusResolutionProvider.fromEnvironment()` is the only reader …"
- *After:* `FOCUS_RESOLUTION_TIMEOUT_MS` (1000..20000, default 8000) is the only function setting. The credential is
  `DEEPSEEK_API_KEY` behind the §2.3 gate, and `FOCUS_RESOLUTION_PROVIDER` / `_MODEL` may only name `DEEPSEEK` /
  `deepseek-flash`. Nothing reads these at bootstrap. The lazy binding `deepSeekFocusResolutionBinding`, built with the
  accounting decorator, is the only reader. The adapter has no `fromEnvironment`.

**3.5 `docs/thread-establishment-evaluator-v1.md` (S3)**
- *Before:* "A strict `json_schema` (`additionalProperties: false` at every level, every property required, exact
  enums, `store: false`, zero SDK retries, explicit abort timeout, untrusted-data envelope
  `<thread_establishment_source>`)"
- *After:* the same closed schema travels in the system instruction under JSON Output, enforced by
  `parseThreadEstablishmentOutput`, with zero SDK retries, an explicit abort timeout and the
  `<thread_establishment_source>` envelope. There is no `store`.
- *Before:* "`THREAD_ESTABLISHMENT_PROVIDER` (`OPENAI`), `OPENAI_API_KEY`, `THREAD_ESTABLISHMENT_MODEL` (default
  `gpt-5-mini`), `THREAD_ESTABLISHMENT_TIMEOUT_MS` (1000..20000, default 8000). Nothing reads these at bootstrap;
  `OpenAiThreadEstablishmentProvider.fromEnvironment()` is the only reader …"
- *After:* as §3.4, for `THREAD_ESTABLISHMENT_*` and `deepSeekThreadEstablishmentBinding`. The pinned prompt version
  becomes `thread-establishment-evidence-path-deepseek-v1` (§4).

**3.6 `docs/committed-conversational-unit-substrate-v1.md` (S1, Stage 6.5)**
- *Before:* "Strict `json_schema`, `additionalProperties:false`, bounded unit count and excerpt length, `store:false`,
  zero SDK retries, an explicit AbortController timeout, and the source wrapped in an untrusted-data envelope."
- *After:* the same closed schema (`additionalProperties:false`, bounded unit count and excerpt length) travels in the
  system instruction under JSON Output and is enforced by the adapter's parser. Zero SDK retries, the explicit
  AbortController timeout and the untrusted-data envelope are unchanged, and there is no `store`.

**3.7 `docs/thread-lifecycle-cross-session-continuity-v1.md` (S4, Stage 6.5)**
- This record names no provider, model or transport. Its provider facts lived in code, in the T-03B3 contract and in the
  AI-COST-01 record. Those facts move under §2, and the record's own sentences are unchanged.

# 4. Prompt versions and replay

The four Stage 6.5 prompt versions change (§2.8) because the model-visible request changed: the provider, the system
composition and the schema's carrier. The schema bytes themselves did not change, except that the OpenAI-only `name`
fields (`conversational_focus_resolution_v1`, `thread_establishment_evidence_path_v1`, …) are gone. Those names had no
DeepSeek carrier.

Provenance already recorded under an old version stays valid as the history of what produced it. Replay of a recorded
exchange is the canonical replay, which is unchanged and makes no provider call. Only synthetic data has ever been
evaluated, so no real-user record is affected.

# 5. Model-visible texts — verbatim, for approval (CP0 F6-3)

These are texts for the model, not for the user. **Every instruction sentence of the seven functions is byte-identical
to its pre-S8A-03 text, except the one line in §5.3.** That was proven by comparing every instruction literal of each
retired adapter with its successor.

**5.1 The JSON Output sentence** (`DEEPSEEK_JSON_OUTPUT_INSTRUCTION`, shared by all seven):

> Respond with exactly one json object and nothing else: no prose, no markdown, no code fence. The object must conform to the following JSON Schema; the server rejects any other key, type, value, length or count.

It contains the lowercase word "json", as DeepSeek JSON Output requires.

**5.2 The system message composition** (`deepSeekJsonRequest`):

```text
<the function's existing instructions>

<the JSON Output sentence (5.1)>
<the function's closed JSON Schema, as one line of JSON>
```

The user message is the function's existing untrusted-data envelope, byte for byte. No example output is added: CP0
§2.2 mentioned one, but an example is model-visible content that could steer the answer, and the schema plus the
validators suffice. Adding an example later needs this same approval.

**5.3 The one changed instruction line** (H2). DeepSeek JSON Output returns an object, so the candidate array travels
as `{"candidates": [...]}`:
- *Before:* "Return only the schema-conforming array of candidate hypothesis proposals."
- *After:* "Return only the schema-conforming object whose candidates array holds the candidate hypothesis proposals."

H3 also travels as `{"associations": [...]}`. Its instruction ("Return only schema-conforming association proposals.")
did not mention the array, so it is unchanged. Both parsers accept exactly that one key and nothing else.

# 6. Operator surface

- `.env.example` — the AI block becomes:

  ```text
  # AI provider (S8A-03 D1): DeepSeek Flash for every AI call - the reply router and the seven structured adapters.
  # There is no OpenAI, Anthropic or Gemini provider and no fallback. Qualification only: DeepSeek may process synthetic
  # data only, a production process refuses it, and DEEPSEEK_QUALIFICATION_MODE must be declared (QAN-BL-AI-01).
  MODEL_PROVIDER=deepseek
  DEEPSEEK_API_KEY=
  DEEPSEEK_QUALIFICATION_MODE=SYNTHETIC_ONLY
  HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS=5000
  HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS=4096
  ```
- `apps/api/README.md` — the provider section describes DeepSeek Flash only. The Claude and OpenAI smoke sections are
  replaced by a removal note.
- Removed:
  - root scripts `verify:claude:smoke`, `verify:openai:smoke` and `eval:brain:run`;
  - `apps/api/scripts/verify-claude-smoke.ts` and `verify-openai-smoke.ts`.

  The bake-off harness's zero-call `validate`, `dry-run` and `summarize`, its recorded evidence and
  `docs/brain-bakeoff-harness.md` (now marked as a historical record) are kept.
- **Loud failure, by design:** a local `.env` that still sets `MODEL_PROVIDER=openai|anthropic`, or a
  `<FUNCTION>_PROVIDER` / `_MODEL` naming OpenAI, Gemini or a GPT / Gemini model, now refuses to start or to make the
  call. It names the variable and is never silently ignored.

# 7. CP2 corrections fixed into the plan (Founder, 2026-10-23) — recorded, not implemented

CP1 implements none of these. They bind the CP2 design that CP0 §3–§4 proposed, with no new research:

1. **Retrieval quality proof.** Semantic-key retrieval must be proven on an independent paraphrase set, with memories
   placed outside the last-32 window. The proof must not rely on examples of keys the model itself produced.
2. **A verbatim quote is not truth.** An exact SELF excerpt does not prove that the information is true, that it
   belongs to the user, or that it is their latest stance. CP2 adds independent server checks for negation, speaker,
   time, correction and conflict before a capture is written.
3. **One `MEMORY_WRITE` effect.** The background writer keeps its single `MEMORY_WRITE` effect, so no turn writes three
   memories unless a separately justified controlled amendment allows it. The fourth post-response call, if approved
   under F4, is tied to a durable claim, crash recovery and no replay.
4. **Indexing covers every writer.** That means:
   - background writes, the direct REMEMBER / CORRECT commands and prior data (backfill);
   - forgotten, corrected or superseded, disabled and expired memories are excluded **at retrieval time**,
     immediately, and not only by a later cleanup.
5. **Conflict detection is related, not merely different.** Only related values are brought together, and the
   detection respects person identity (`about`) and temporal context. Two different values are not a conflict by that
   fact alone.
6. **Keys are personal data.** Keys and derived indexes are user-scoped, under RLS and the 0130 erasure path. Expiry is a
   time, not an event, and fires no trigger. CP2 must therefore exclude expired memories in the retrieval predicate
   itself, and clean up their keys by an explicit path.
7. **No `SHARED_ATTRIBUTION_READING` family.** The optional family of CP0 F7 is not added.
8. **Backlog.** No other backlog item's ownership moves automatically. `QAN-BL-AI-02` is not closed before the migration
   is proven complete; CP1's census is evidence toward it, not its closure.

# 8. Explicit non-amendments, implementation and status

- **Not amended:**
  - any port, request type, validator, ledger (0029 / 0033), RPC or migration;
  - the post-response budget (QIR-005) and QIR-001 / QIR-004 / QIR-006;
  - Memory, HIM or any Shared / Public contract;
  - the reply router's contract (S8A-01 / S8A-02, unchanged);
  - every semantic vocabulary.

  No CW2 sentence is superseded. There is no paid call, no live-environment change, and no hosted deployment.
- **Implemented by S8A-03 CP1 in:**
  - `apps/api/src/model-router/providers/deepseek/deepseek-client.ts`;
  - the seven `deepseek-*` adapters, their `*-provider.config.ts`, bindings and modules (`conversation-unit/`,
    `conversational-focus/`, `thread-establishment/`, `thread-lifecycle/`, `hypothesis/`);
  - `model-router/model-router.module.ts` and `model-profile.registry.ts`;
  - `ai-usage/accounted-provider-clients.ts`;
  - `.env.example`, `apps/api/README.md`, `package.json` and `apps/api/package.json`.

  The removed files are the OpenAI and Anthropic reply routers, the five OpenAI and two Gemini structured adapters, and
  the two paid smokes.
- **Verified (local, no network):**
  - the API jest suite;
  - the API build and the scripts type-check;
  - every `tests/*.test.mjs` contract, including the AI-COST-01 census of the nine DeepSeek call sites with blob pins
    and its D1 non-DeepSeek detector.

  Re-anchored contracts say so where they change. Real-model quality of the seven functions on DeepSeek Flash is
  **not** claimed here; it is CP3's measured question (CP0 §5.2).
- **Status:** a candidate until the Founder's review of CP1. It binds on the merge of the one S8A-03 pull request.
