# Controlled Hypothesis Generation v1

## Architecture and invocation boundary

The internal pipeline is `Generation Request -> Candidate Generator Port -> transient proposals -> validation/grounding gate -> HypothesisService`. The generator is a provider-neutral proposal interface passed explicitly to the internal service. There is no default provider adapter, prompt, controller, client contract, automatic trigger, or connection to Conversation Orchestrator, ContextBuilder, ModelRouter, Behavioral Policy, Safety response output, or FAST/DEEP routing.

## Contracts and bounds

The authenticated service constructs the request from an explicit problem, canonical domain, explicit scope, at most 32 explicitly selected eligible evidence items, at most 32 existing active hypotheses, and a server-owned cap of five proposals. It supplies no full conversation history, unrestricted memory, cross-user data, safety history, provider payload, raw transcript, or hidden reasoning.

Proposals may contain only statement, canonical type, matching domain and scope, separate supporting and contradicting evidence IDs, assumptions, and disconfirming conditions. They contain no confidence, probability, ranking, personality, diagnosis, HIM, chain-of-thought, scratchpad, raw transcript, or provider payload. Assumptions and disconfirming conditions retain the existing limits of eight unique strings of 500 characters; statement and scope retain the Hypothesis Runtime bounds.

## Grounding, collision, and persistence

Proposals remain transient until validation. Every evidence reference must be in the request's bounded evidence set, which EvidenceService has confirmed is currently eligible and owned by the authenticated user. An ID cannot occupy both evidence roles. Invalid types, mismatched domain/scope, malformed or oversized fields, out-of-universe evidence, role conflicts, exact normalized batch duplicates, and exact normalized statement-and-scope collisions with active hypotheses are rejected.

Accepted proposals persist only through HypothesisService with origin `SYSTEM_GENERATED` and initial status `CANDIDATE`; evidence is attached through its existing eligibility boundary. Distinct accepted alternatives are linked with its existing symmetric competitor operation. No candidate is ranked or selected as a winner, and zero supporting evidence is valid for a provisional unevaluated candidate.

Exact duplicate detection uses Unicode normalization, whitespace collapse, and trimming. Semantic near-duplicates are a documented limitation: v1 deliberately makes no embedding or provider call and does not invent pseudo-semantic inference rules. Generation never modifies, reopens, merges, splits, or transitions an existing hypothesis; a future Hypothesis Update Loop owns those operations.

## Privacy and guarantees

The implementation logs no raw statements and adds no persistence table. Existing UUID ownership, RLS, lifecycle, evidence, versioning, and active-set contracts remain authoritative. It makes zero Claude, OpenAI, Gemini, embedding, or paid calls. It computes no confidence, probability, ranking, questions, information gaps, personality, diagnosis, Human Model, or HIM value, and it exposes nothing to users or the normal response path.

The next controlled gate is Confidence Runtime. Question generation, the Hypothesis Update Loop, Human Model/HIM, provider adapters, automatic invocation, and user exposure remain deferred.
