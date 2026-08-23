# Hypothesis Generation Trigger Classification v1

## Purpose and position

This internal provider-free policy classifies whether one authoritative finalized USER text contains a sufficiently explicit hypothesis-worthy explanatory trigger. Its bounded output is `TRIGGER`, `NO_TRIGGER`, or `AMBIGUOUS` with a canonical reason code.

Classification does not authorize generation. The policy is isolated from Conversation Orchestrator in this version and is not persisted or exposed through a client contract.

## Input boundary

The only inputs are the authoritative current USER text and the structured Safety disposition. The policy receives no history, assistant output, ContextBuilder messages, Memory, Evidence, Hypotheses, HIM, Behavioral guidance, provider output, or FAST/DEEP metadata. It performs no query or external call.

`ALLOW` is classified normally. `GUIDED` and `BLOCK` always return `NO_TRIGGER / SAFETY_INELIGIBLE` before text semantics are inspected.

## Positive taxonomy

- `EXPLICIT_WHY_SELF`: an explicit first-person request to understand why the user acts or responds in a stated way.
- `RECURRING_PATTERN`: explicit first-person recurring structure paired with a repeated outcome or action.
- `INTERNAL_CONTRADICTION`: an explicit first-person intention, desire, or decision opposed by the user's stated action.
- `RELATIONAL_PATTERN`: explicit recurring first-person behavior in a relationship/closeness structure.
- `OUTCOME_WITH_UNCLEAR_CAUSE`: an explicit outcome paired with the user's stated inability to explain why or how it occurred.

These codes describe surface linguistic structures. They are not causes, diagnoses, personality labels, inferred motives, probabilities, or truth claims. Where structures overlap, the deterministic order is relational pattern, unclear-cause outcome, explicit self-directed why, recurring pattern, then internal contradiction. This is taxonomy determinism, not ranking.

## Exclusion taxonomy

`NO_TRIGGER` reasons are `ORDINARY_FACT`, `PREFERENCE_OR_GOAL`, `COMMAND_OR_REQUEST`, `GENERIC_QUESTION`, `GREETING_OR_ACK`, `TRANSIENT_STATE_ONLY`, `QUOTED_OR_THIRD_PARTY`, `INSUFFICIENT_SIGNAL`, and `SAFETY_INELIGIBLE`.

The rules conservatively exclude isolated durable facts, preferences/goals, advice or action requests, ordinary factual questions, greetings, acknowledgements, explicitly transient emotions, and clearly quoted or third-party statements. Mechanically indistinguishable residual text is `INSUFFICIENT_SIGNAL`; the policy does not invent meaning to force a more specific exclusion.

## AMBIGUOUS

`TRIGGER_LIKE_BUT_UNRESOLVED` means bounded trigger-like wording exists without one of the approved explicit structures. `INPUT_BOUND_EXCEEDED` means normalized text exceeds the supported bound. `AMBIGUOUS` is never a trigger and authorizes no downstream behavior.

## Languages, normalization, and bounds

V1 includes narrow high-confidence English, Arabic, and Egyptian Arabic structures. It does not perform general language detection or translation. Input is normalized with Unicode NFKC, trim, and whitespace collapse. Identical normalized inputs produce identical results.

The maximum normalized input length is 4,000 Unicode characters. A conservative 8,000 UTF-16-code-unit raw guard bounds normalization itself; normalized character length is then checked before pattern evaluation. Oversized input is not truncated and returns `AMBIGUOUS / INPUT_BOUND_EXCEEDED`, preventing a truncated false positive. Patterns use bounded spans over the already bounded input and no probabilistic score.

## Deliberate limitations and separation

V1 prefers false negatives. Paraphrases, implicit patterns, multi-turn meaning, sarcasm, indirect causality, mixed language outside the explicit patterns, and trigger-like wording without explicit first-person structure may remain ambiguous or unrecognized.

The classifier does not infer personality, motive, psychological state, causal truth, problem, domain, or scope. It does not generate a hypothesis, assemble a Generation Request, select Evidence, assign Evidence roles, rank hypotheses, calculate Confidence, create Questions/Information Gaps, mutate Memory/HIM, route models, call providers, or persist results.

Generation Request Assembly and Controlled Hypothesis Generation remain separate future/invoked boundaries. A later integration contract must decide when and how a `TRIGGER` result participates in eligibility; this classifier makes no such decision.
