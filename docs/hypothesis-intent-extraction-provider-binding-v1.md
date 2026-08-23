# Hypothesis Intent Extraction Provider Binding v1

## Separate provider boundary

Hypothesis intent extraction uses its own `HypothesisIntentExtractionProvider` port and DI token. It does not accept `ModelRouterRequest`, return `ModelRouterResult`, expose FAST/DEEP, or add an extraction task to the normal conversational router. Existing OpenAI and Anthropic conversation adapters and their selection remain unchanged.

V1 binds the dedicated port to OpenAI Responses API Structured Outputs. The default profile is provider `OPENAI`, model `gpt-5-mini`, schema version 1, a 5,000 ms timeout, 256 maximum output tokens, zero retries, no fallback, and one request per adapter invocation. `HYPOTHESIS_INTENT_EXTRACTION_MODEL` and `HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS` are independently configurable; the existing `OPENAI_API_KEY` credential is reused without changing conversation-provider configuration. The provider and model are operational choices and have no semantic authority.

## Request and strict schema

The dedicated request contains only bounded current USER text, a canonical positive Trigger reason, the exact frozen Hypothesis domains, a bounded eligible Evidence universe reduced to ID/kind/statement, the maximum Evidence selection, and schema version. It contains no history, assistant output, provenance UUIDs, session scope, HIM, Confidence, Hypotheses, Questions, unrestricted Memory, credentials, tools, or provider payloads.

The Responses API request uses `text.format` with `type: json_schema`, `strict: true`, and a closed object schema with `additionalProperties: false`. Provider output contains exactly `problemText`, one enumerated canonical `domain`, and `selectedEvidenceIds`. The Evidence array is schema-bounded to one through eight and each ID is enumerated from the supplied universe. Application validation additionally rejects malformed JSON, prose, missing or extra fields, invalid/custom domains, duplicates, over-bound arrays, and out-of-universe IDs. Provider output never contains source, turn provenance, scope, session identity, rationale, confidence, diagnosis, hypothesis fields, or Evidence roles.

## Input security and privacy

USER and Evidence strings are serialized as JSON inside an explicitly untrusted-data container. Markup characters are escaped so data cannot close or forge the delimiter, and server instructions state that embedded text is data rather than instructions. The strict schema and later Intent Authority remain the enforcement boundaries; no general prompt-security framework is introduced.

No extraction telemetry is added in this isolated binding. The adapter logs no text, Evidence IDs/content, credentials, identifiers, requests, responses, or provider diagnostics. Responses set `store: false`, use no streaming or tools, and perform no retry, fallback, or repair call.

## Errors, DI, and fake

All failures become `HypothesisIntentExtractionProviderError` with only `UNAVAILABLE`, `TIMEOUT`, `INVALID_STRUCTURED_OUTPUT`, or `PROVIDER_ERROR`. Raw provider errors and response bodies never escape. An abort signal enforces the configured timeout.

`HypothesisIntentExtractionProviderModule` exports only the dedicated token. Tests receive `FakeHypothesisIntentExtractionProvider` without credentials or network access; it returns configured structured output, emits configured sanitized failures, and records deterministic call counts. Production receives the OpenAI structured-output adapter.

## Explicit separation and limitations

This binding does not invoke extraction from Conversation Orchestrator, coordinate with Intent Authority, assemble a generation request, invoke Controlled Hypothesis Generation, create or mutate Hypotheses, assign Evidence roles, calculate Confidence, create Questions or Information Gaps, mutate Memory/Evidence/HIM, alter FAST/DEEP or assistant responses, add persistence/migrations/jobs, expose UI/Voice/API, or provide an Anthropic fallback. Model-Assisted Intent Extraction orchestration remains a separate next task.
