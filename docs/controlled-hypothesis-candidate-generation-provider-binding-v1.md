# Controlled Hypothesis Candidate Generation Provider Binding v1

This is the prerequisite for Phase II Track A Step 7/7. Step 7 correctly stopped because Controlled Hypothesis Generation had a provider-neutral `HypothesisCandidateGenerator` port but no approved production binding. This change binds that port to Google Gemini without invoking it from Conversation Orchestrator.

## Dedicated Gemini boundary

The production adapter is `GeminiHypothesisCandidateGenerator`, registered behind the dedicated `HYPOTHESIS_CANDIDATE_GENERATOR` token. It is separate from normal `ModelRouter`, FAST/DEEP routing, conversational OpenAI/Anthropic adapters, and the OpenAI Intent Extraction binding. The model remains configurable and replaceable, with the v1 default fixed to `gemini-2.5-flash` and provider fixed to `GEMINI`.

The adapter uses the Gemini Developer API REST `models/{model}:generateContent` mechanism through the platform `fetch` implementation; no SDK dependency is added. It sends text only, requests `application/json`, supplies a closed `responseJsonSchema`, sets `candidateCount: 1`, and fixes `thinkingBudget: 0`. It configures no tools, search, grounding, streaming, multimodal input, code execution, URL context, or cached context.

## Proposal schema and bounds

The root output is an array of zero to the existing maximum five proposals. Every proposal has exactly the frozen fields:

- `statement`: bounded string;
- `type`: frozen `HypothesisType`;
- `domain`: exact request domain;
- `scope`: exact request scope;
- `supportingEvidenceIds` and `contradictingEvidenceIds`: arrays containing only request Evidence IDs;
- `assumptions`: at most eight bounded strings;
- `disconfirmingConditions`: at most eight bounded strings.

Unknown/missing fields, invalid enums, malformed JSON, over-count output, invalid arrays, duplicate list members, out-of-universe Evidence IDs, Confidence, diagnosis, and extra rationale fail closed during application parsing. The existing Controlled Generation gate remains authoritative for domain/scope grounding, role conflicts, duplicate/collision handling, persistence, and `SYSTEM_GENERATED` / `CANDIDATE` semantics.

The default timeout is 5,000 ms. The output bound is 65,536 tokens, derived from the existing worst-case five-proposal text bounds and capped at Gemini 2.5 Flash's output limit. Each `generate` invocation performs at most one request, with zero retry, repair, fallback, parallel call, or normal ModelRouter call. Timeout aborts the request.

## Data, errors, and testing

Only bounded generator input needed for proposals is serialized. `userId`, provider metadata, timestamps, and other Evidence provenance are not sent. USER/Evidence/Hypothesis strings are JSON serialized inside an explicitly untrusted-data delimiter; delimiter markup is escaped. Instructions state that embedded text is data and that Evidence roles remain proposals subject to server validation.

Errors expose only `UNAVAILABLE`, `TIMEOUT`, `INVALID_STRUCTURED_OUTPUT`, or `PROVIDER_ERROR`; raw Gemini bodies, headers, keys, prompts, output, and private content are not surfaced or logged. `GOOGLE_AI_API_KEY` is the canonical server credential. Tests receive a deterministic fake through the same port and never require network access or a credential.

## Explicit boundary

This binding does not connect Controlled Generation to Conversation Orchestrator, call a provider automatically, or persist a Hypothesis. It does not change Controlled Generation, Hypothesis Update, Confidence, Questions, Memory, Evidence, HIM, Trigger, Eligibility, Intent, Assembly, ModelRouter, FAST/DEEP, API, UI, Voice, migrations, jobs, or vector search. Step 7 invocation remains the next task after this binding is reviewed and merged.
