# Controlled Hypothesis Generation Invocation v1

This is Phase II Track A Step 7/7. It closes the automatic hypothesis-generation vertical slice by connecting the existing post-finalization `READY` request to Controlled Hypothesis Generation through the prerequisite dedicated Gemini Candidate Generator binding.

## Lifecycle and invocation authority

The only automatic path is:

`fresh finalized USER turn → Memory completion → Evidence projection → Trigger Classification → Eligibility → Intent Extraction → Intent Authority AUTHORIZED → Request Assembly READY → HypothesisGenerationService.generate`

Conversation Orchestrator passes the assembled `HypothesisGenerationInput` unchanged to `HypothesisGenerationService.generate(userId, accessToken, request, candidateGenerator)`. The injected `HYPOTHESIS_CANDIDATE_GENERATOR` binding supplies the production `GeminiHypothesisCandidateGenerator`; the Orchestrator does not call Gemini or the normal Model Router, build another prompt, assign Evidence roles, or persist Hypotheses.

One fresh READY processing path makes at most one Controlled Generation invocation and therefore at most one Candidate Generator request. There is no retry, repair, fallback, parallel model, recursion, or background recovery. NOT_READY, non-trigger, ineligible, ambiguous, Safety-ineligible, no-Evidence, extraction failure, authority rejection, replay, duplicate, and claim-miss paths have zero generation authority. Existing turn claim/finalization semantics prevent replayed or unclaimed work from reaching READY; no new persistence marker is introduced.

## Validation, persistence, and bounded outcomes

Controlled Generation remains the sole authority for rebuilding the current eligible Evidence universe, loading active Hypotheses, validating proposal shape/domain/scope/Evidence roles and conflicts, enforcing candidate bounds, handling duplicates and active collisions, and linking accepted competitors. Accepted records persist only through `HypothesisService`, retaining server-owned `SYSTEM_GENERATED` origin, initial `CANDIDATE` status, canonical ownership/domain/scope, validated Evidence links, and existing version/history behavior. READY requests, extraction candidates, raw provider output, rejected proposals, errors, and hidden reasoning are not persisted.

Zero accepted proposals is a successful bounded outcome and never causes retry. Candidate Generator unavailability, timeout, invalid structured output, provider error, validation rejection, zero acceptance, Controlled Generation failure, or persistence failure is contained after response finalization. The authoritative assistant response is neither invalidated nor rewritten, and no recovery job is enqueued.

Telemetry records only bounded outcomes (`invoked`, `accepted_nonzero`, `accepted_zero`, `generator_unavailable`, `generator_timeout`, `invalid_generator_output`, or `generation_failed`), processing path, and contract version. It contains no USER/problem/Hypothesis/Evidence text or IDs, scope/session/turn/user identifiers, request/proposal/provider payload, raw error, key, or hidden reasoning.

## Explicit boundary

This Step 7 boundary itself does not invoke the Hypothesis Update Loop, calculate or write Confidence, create Information Gaps or Questions, mutate HIM, write more Memory, alter Evidence persistence, produce a second response, or expose a new public API. The later Track A2 Step A2.1 integration may evaluate an existing Confidence Runtime snapshot after successful generation without changing this invocation boundary. Trigger Classification, Eligibility, Intent Extraction, Intent Authority, Request Assembly, the Candidate Generator schema/model/thinking budget/timeout, normal Model Router and FAST/DEEP routing, UI, Voice, migrations, queues, embeddings, and cross-session behavior remain unchanged.
