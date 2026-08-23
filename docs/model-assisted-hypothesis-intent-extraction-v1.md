# Model-Assisted Hypothesis Intent Extraction v1

This is Phase II Step 5B/7. It connects the dedicated Hypothesis intent-extraction provider binding to the existing Intent Authority and stops at an internal `AUTHORIZED | NOT_AUTHORIZED` intent outcome. Generation Request Assembly and Controlled Hypothesis Generation invocation remain later steps.

## Lifecycle and call authority

Conversation Orchestrator evaluates this capability only after the authenticated USER turn and assistant response are atomically finalized and the post-finalization Memory evaluator/write has completed. The existing eligibility evaluation performs one bounded Evidence projection read and one deterministic Trigger Classification. Its internal assessment preserves those exact values for extraction; it does not repeat either operation.

A fresh eligible turn receives at most one extraction call. Non-eligible, replay, duplicate, and claim-miss paths receive zero calls. There is no retry, repair, fallback, recursive extraction, or second provider. The dedicated binding retains its five-second timeout, 256-output-token limit, and `gpt-5-mini` default. Normal conversational Model Router adapters and FAST/DEEP routing are unchanged.

## Bounded request and authority

The request contains only current finalized USER text, the exact positive Trigger reason, the frozen `HypothesisDomain` values, a mechanical bounded projection of the already-read eligible Evidence (`evidenceId`, `evidenceKind`, bounded `statement`), the maximum selected-Evidence bound, and schema version 1. It contains no assistant response, transcript, HIM, Confidence, Hypotheses, Questions, unrestricted Memory, Safety history, routing internals, or user profile.

Provider output is transient semantic data only: `problemText`, `domain`, and `selectedEvidenceIds`. The server injects `CURRENT_USER_TURN`, the canonical finalized turn ID, `CONVERSATION_SESSION`, and the canonical session ID. The provider cannot control provenance or scope.

Every candidate passes unchanged through `HypothesisGenerationIntentAuthorityService`. Its NFKC and whitespace normalization, 2,000-character bound, contiguous normalized-span grounding, frozen domain taxonomy, session/turn provenance, selected-Evidence bounds, duplicate rejection, and eligible-universe checks remain authoritative. Rejected provider semantics are not rewritten or repaired.

## Failure isolation and telemetry

Provider errors map to bounded internal reasons: unavailable, timeout, invalid provider output, or generic provider failure. Authority rejection has a bounded machine reason and may retain the existing bounded authority code. No raw error, response body, candidate, USER/Evidence text, or free-text reason is surfaced.

Extraction occurs after response finalization, so every failure fails closed without invalidating the user-visible response and without persistence. Telemetry records only low-cardinality outcome, processing path, and contract version. It never records content, Evidence/Memory IDs, intent contents, identifiers, keys, provider bodies, or raw errors.

## Explicit boundary

This step does not assemble or invoke Controlled Hypothesis Generation; persist an intent; create, update, or transition Hypotheses; assign Evidence roles; calculate Confidence; create Information Gaps or Questions; mutate Memory, Evidence, or HIM; alter routing or normal provider behavior; add migrations, jobs, public API, UI, Voice, embeddings, or cross-session scope.
