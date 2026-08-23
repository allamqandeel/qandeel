# Hypothesis Generation Intent Authority Foundation v1

## Purpose and boundary

This internal foundation separates a transient semantic extraction proposal from server authority. A future caller may ask a bounded provider-neutral extractor to propose an intent only after a finalized USER turn has received `ELIGIBLE / TRIGGER_AND_EVIDENCE_AVAILABLE`. The candidate is never authoritative until the pure `HypothesisGenerationIntentAuthorityService` validates and canonicalizes it.

This version is isolated from Conversation Orchestrator and has no concrete extractor, provider selection, provider call, persistence, telemetry, controller, or client surface. It does not assemble or invoke Controlled Hypothesis Generation.

## Candidate and authority contracts

The candidate contains exactly one problem `{ text, source: CURRENT_USER_TURN, sourceTurnId }`, one frozen `HypothesisDomain`, one scope `{ kind: CONVERSATION_SESSION, sessionId }`, and one to eight Evidence IDs. Extra fields are rejected, preventing hypothesis statements/types, Evidence roles, confidence, diagnosis, personality, motive, HIM values, Questions, hidden reasoning, scratchpads, and provider payloads from entering the authority boundary.

The result is either `AUTHORIZED` with the canonical problem, unchanged canonical domain, server-derived canonical scope, and ordered Evidence IDs, or `NOT_AUTHORIZED` with one bounded code: `PROBLEM_NOT_GROUNDED`, `INVALID_DOMAIN`, `INVALID_SCOPE_AUTHORITY`, `NO_SELECTED_EVIDENCE`, `TOO_MANY_SELECTED_EVIDENCE`, `EVIDENCE_OUT_OF_UNIVERSE`, `DUPLICATE_EVIDENCE`, `TURN_PROVENANCE_MISMATCH`, `SESSION_PROVENANCE_MISMATCH`, `INVALID_CANDIDATE`, `INPUT_BOUND_EXCEEDED`, or `EVIDENCE_UNIVERSE_INVALID`. No free-text rejection reason is produced.

## Extractive problem authority

The current finalized USER text and candidate problem are bounded before Unicode normalization. Both use Unicode NFKC, trimming, and whitespace collapse. The normalized problem must be non-empty, no longer than the existing 2,000-character Hypothesis statement bound, and a contiguous span of the normalized current USER text. The service never truncates. Paraphrases and inferred explanations are rejected because they cannot pass the extractive check. Candidate source and turn UUID must exactly match the canonical current turn; assistant output and unrestricted history are not inputs.

## Domain and session scope

Domain authority reuses only `GENERAL`, `RELATIONSHIP`, `WORK`, `DECISION`, `GOAL`, and `INTERACTION`. The service validates the proposed value and provides no default, fallback, Trigger mapping, Evidence-kind mapping, or HIM mapping.

Scope is always derived from the canonical finalized turn's session UUID. Candidate scope kind and session must match it exactly. Authorized output includes the deterministic internal serialization `CONVERSATION_SESSION:<session UUID>`, which fits the existing 500-character Hypothesis scope bound. V1 intentionally prevents global/person-wide scope and defers all cross-session reconciliation.

## Evidence association

The caller supplies the already bounded canonical eligible Evidence universe directly from the existing Evidence authority. The service performs no query. It validates canonical `memory:<UUID>` identity/provenance, rejects malformed or duplicate universes, requires one to eight unique selected IDs, rejects IDs outside that universe, and emits the selected subset in the universe's stable canonical order regardless of proposal order.

Association means only that an eligible item is candidate context for this generation intent. It assigns no SUPPORTING/CONTRADICTING role, evidential strength, rank, truth, or hypothesis relationship. There is no automatic “first eight” selection and no Evidence creation or persistence.

## Provider-neutral extractor port and privacy

The proposal port receives only current USER turn text/turn/session identifiers, Trigger Classification, bounded eligible Evidence, the frozen allowed domains, and server bounds. It receives no history, assistant response, Safety history, unrestricted Memory, HIM, Confidence, provider payload, or cross-user data. No adapter or default provider exists in this foundation.

The service is deterministic, dependency-free, non-persistent, and adds no telemetry. It logs no user/problem text, Evidence content or IDs, Memory IDs, domain/problem combinations, identifiers, candidates, or provider data.

## Explicit limitations and separation

This foundation does not integrate the Orchestrator; invoke or assemble Controlled Hypothesis Generation; create, update, or transition Hypotheses; assign Hypothesis type or Evidence roles; calculate Confidence; create Questions or Information Gaps; mutate Memory, Evidence, or HIM; alter FAST/DEEP routing or assistant responses; add UI, Voice, API, migration, queue, retry, embedding, NLP dependency, or concrete provider behavior. Generation Request Assembly remains a separate future gate that may consume only an `AUTHORIZED` intent.
