# Hypothesis Generation Request Assembly v1

This is Phase II Track A Step 6/7. It is the deterministic bridge from an already `AUTHORIZED` intent to the existing `HypothesisGenerationInput` contract. It stops at an internal transient `READY` request; the later Step 7 invocation boundary consumes that request without changing this assembler's authority.

## Authority closure and exact mapping

An earlier assembly attempt stopped because problem, domain, scope, and Evidence selection did not yet have canonical authority. Intent Authority and Model-Assisted Intent Extraction now close those gaps. Assembly uses only the canonical authorized intent:

| Authorized intent | Generation input | Transformation | Authority |
| --- | --- | --- | --- |
| `problem.text` | `problem` | unchanged | Intent Authority extractive grounding |
| `domain` | `domain` | unchanged | frozen `HypothesisDomain` validation |
| `scope.serialized` | `scope` | unchanged | server-owned `CONVERSATION_SESSION:<uuid>` serialization |
| `evidenceIds` | `evidenceIds` | same IDs and order | Intent Authority eligible-universe selection |

The assembler accepts only `AuthorizedHypothesisGenerationIntent`. It does not accept provider output, raw USER text, Trigger or Eligibility alone, an unvalidated candidate, or an Evidence universe. Mechanical runtime checks fail closed as `INVALID_AUTHORIZED_INTENT`, `SCOPE_SERIALIZATION_FAILED`, `BOUND_VIOLATION`, or `INVARIANT_REJECTED`; they never truncate, normalize, remap, reorder, or repair input.

## Runtime placement and discipline

For a fresh finalized eligible turn, Conversation Orchestrator performs the existing single extraction call and Intent Authority validation. Only an `AUTHORIZED` result reaches assembly. A `READY` request remains internal; Step 7 may pass it unchanged to `HypothesisGenerationService`, while the assembler itself never calls a generator, persistence, or a queue.

The assembler is pure: zero database queries, zero Evidence or Memory reads, zero provider/model calls, zero N+1 behavior, and no semantic classification, extraction, selection, ranking, or Evidence role assignment. Non-eligible, replay, duplicate, claim-miss, provider-failure, invalid-output, and authority-rejection paths have zero assembly authority.

Assembly is post-finalization enrichment. Failure cannot invalidate the finalized assistant response and creates no generation authority. Telemetry contains only the low-cardinality outcome (`ready`, `not_ready`, or `invariant_rejected`), processing path, and contract version; it contains no problem, Evidence, scope/session, USER, provider, intent, or request content.

## Explicit boundary

This assembler does not invoke Controlled Hypothesis Generation; create or mutate Hypotheses; assign a Hypothesis type or Evidence roles; change extraction, Intent Authority, Trigger, Eligibility, Confidence, Questions, Memory, Evidence, HIM, routing, Model Router, or conversational providers; persist requests; or add migrations, jobs, API, UI, Voice, embeddings, or cross-session scope. The separate Step 7 Orchestrator boundary owns the single READY invocation.
