# Hypothesis Reasoning Consumption Integration v1

## Architectural position

This Phase II read-side integration consumes existing owned active Hypotheses in the authenticated TEXT Conversation Orchestrator. It runs only after Safety permits reasoning and supplies the Model Router with an independent, provider-neutral structured-data channel. It is separate from conversation history, user messages, Memory, HIM, Behavioral guidance, and Safety guidance. Central guidance composition is the only adapter-facing semantic boundary.

## Bounded contract

`HypothesisReasoningContext` has `contractVersion: 1`, source `QANDEEL_HYPOTHESIS_REASONING_CONTEXT`, `coverageState: AVAILABLE`, bounded candidate/included counts, `truncated`, and complete hypothesis items. The active repository candidate cap remains 32. The model projection contains at most eight complete items and at most 24,000 Unicode string characters across item fields. Individual strings are never truncated. Inclusion stops at the first item that would exceed the budget, so later smaller items are not substituted.

Items contain only canonical statement/type/domain/scope/origin/status/version, current eligible Evidence linkage counts, assumptions, disconfirming conditions, and either exact-current-version uncalibrated Confidence metadata or `NOT_EVALUATED_FOR_CURRENT_VERSION`. Database IDs, Evidence IDs/content, evaluation IDs, owner/correlation/audit IDs, provider metadata, scores, bands, weights, rankings, truth labels, diagnoses, generated explanations, and hidden reasoning are excluded.

## Deterministic ordering and Confidence

The projection preserves the repository order `updated_at DESC, id ASC`; it performs no relevance or semantic ranking. FAST and DEEP receive the same projection. Confidence is bulk-read for the bounded target/version pairs and ordered `created_at DESC, id ASC`; the first valid exact-current-version row wins. Older-version-only history means `NOT_EVALUATED_FOR_CURRENT_VERSION` and is never a fallback. Ownership, target, type, version, provenance, policy, lifecycle, null-score/band, calibration, stability, and structural invariants are validated fail-closed. Confidence is neither recalculated nor written.

## Evidence and query strategy

The path performs one bounded active-Hypothesis query. When candidates exist, it then performs exactly one current-eligibility EvidenceService read and one bounded bulk Confidence read in parallel. An in-memory eligible-ID set produces role-specific structural counts. Ineligible historical links are excluded without changing persistence. Duplicate same-role links or cross-role links are invariant failures. There is no per-hypothesis query and no schema migration.

## Safety, EMPTY, and failure

Safety `BLOCK` finalizes its deterministic response before any Hypothesis, Evidence, Confidence, Memory, HIM, or Model Router consumption. `ALLOW` and `GUIDED` build the context and preserve existing route selection and single-router invocation. A successful zero-candidate query is `EMPTY`, omits `hypothesisContext`, and continues normally. Candidates that cannot yield one safe complete item, malformed canonical data, ownership/provenance/target mismatch, or query failure prevent provider invocation and use the existing sanitized failed-turn path.

## Guidance, telemetry, and privacy

Central guidance marks hypotheses as provisional structured data, lifecycle states and linkage counts as non-probabilistic, null score/band and uncalibrated state as intentional, older evaluations as unusable, and assumptions as unverified. It requires uncertainty, preserves alternatives, and prohibits diagnosis, personality labeling, manipulation, or fact presentation. The existing markup-escaping function protects the container. Safety and Behavioral guidance remain higher authority; Anthropic and OpenAI adapters add no provider-specific semantics.

Low-cardinality, fail-soft telemetry distinguishes `available`, `consumed`, `empty`, `rejected`, and `failed`, with processing path and contract version only. It records no content, IDs, user/session/turn/orchestration dimensions, Memory/HIM/provider payloads, or request bodies.

## Explicit non-goals and limitations

This integration does not generate, mutate, transition, rank, confirm, reject, or update Hypotheses; attach or write Evidence; calculate or write Confidence; create Questions or Information Gaps; alter Memory/HIM; change FAST/DEEP or provider selection; add provider, voice, realtime, UI, background-job, client API, event-taxonomy, or schema behavior. V1 uses the repository's structural recency order rather than conversation relevance. It exposes Evidence linkage counts only, not Evidence content or strength.

## Verification

Verification covers focused projection, Orchestrator, central guidance, both provider adapters, Hypothesis/Evidence/Confidence regressions, the full API and database contract suites, TypeScript, API build, Foundation/HIM gates, toolchain, formatting, privacy/scope audits, secret scanning, and the repository-supported npm audit. No real or paid provider calls are made.
