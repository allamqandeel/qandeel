# Confidence Runtime v1

## Position and definition

This internal gate extends `Memory -> Evidence -> Controlled Hypothesis Generation -> Hypothesis Runtime` with a provider-neutral Confidence Runtime. Canonically, confidence is the current degree of justified reliance on a scoped claim. It is not truth, certainty, probability, model fluency, memory extraction confidence, evidence, or hypothesis lifecycle state.

The canonical ABS Confidence specification intentionally leaves the mathematical model and band thresholds open pending integrated calibration. V1 therefore persists no numeric score and assigns no confidence band. Both fields are database-constrained to `NULL`; this is deliberate restraint, not an implicit zero or "very low" rating.

## Inputs and output

`ConfidenceService` accepts an authenticated user, an existing owned hypothesis, and evidence already attached through Hypothesis Runtime. It intersects historical links with the current eligible Evidence Layer view. Supporting and contradicting IDs remain separate. The output is a separate immutable assessment record attached to the exact hypothesis version.

The structured record includes target/version, eligible evidence IDs by role, bounded assumptions, competing-hypothesis IDs, bounded missing-information reason codes, lifecycle state, calibration/stability state, policy version, provenance, and timestamps. It contains no statement text, transcript, provider payload, chain-of-thought, scratchpad, diagnosis, personality value, or free-form internal reasoning.

## Evaluation semantics

V1 deterministically snapshots only canonically known structure. It records `NO_ELIGIBLE_EVIDENCE`, `UNVERIFIED_ASSUMPTIONS`, and `COMPETING_HYPOTHESES_UNASSESSED` when those mechanical conditions exist, plus `CONFIDENCE_MODEL_UNCALIBRATED`. It does not claim those factors have calibrated weights. Supporting evidence is not counted into a score; contradiction is not assigned an invented penalty; assumptions and alternatives are preserved rather than numerically weighted.

Historical evaluations are inserted, never updated. Re-evaluation creates another record tied to the then-current hypothesis version. Confidence evaluation does not mutate hypothesis status or version.

## Ownership, RLS, and evidence grounding

The table has owner-only select RLS and no direct authenticated insert/update/delete privilege. Its authenticated creation function derives ownership from `auth.uid()`, verifies the owned hypothesis and exact version, requires each evidence ID to be attached to that hypothesis, and rechecks current Memory/Evidence eligibility. The service also performs the eligibility intersection before persistence. Cross-user targets and evidence fail closed.

## Boundaries and non-goals

There are zero Claude, OpenAI, Gemini, embedding, or other paid calls. The runtime has no Model Router, provider, Context Builder, Question Runtime, HIM, Personality, Recommendation, Safety response, FAST/DEEP, client, or normal conversation-path dependency. It is not automatically invoked and is not user-visible.

V1 does not calculate evidence quality/reliability because the current Evidence Layer exposes memory extraction confidence and importance, explicitly neither truth nor evidential strength. It does not compare competing hypotheses beyond preserving their IDs, generate missing-information questions, calibrate outcomes, select cognitive actions, or implement the full canonical Confidence lifecycle.

## Known canonical gaps and next gate

The unresolved canonical decisions are the numeric model, dimension assessments, evidence quality/reliability contract, independence/dependence rules, relevance/directness semantics, recency treatment, assumption impact, alternative-comparison method, stability rules, score bounds beyond the absent score, band thresholds, stakes and cognitive-action thresholds, validity periods, and calibration/update policy. These require controlled product/intelligence decisions and empirical calibration.

The next controlled gate is **Question / Information Gap Runtime**. It must not treat these structural reason codes as an authorization to generate or ask a question without its own canonical contract.
