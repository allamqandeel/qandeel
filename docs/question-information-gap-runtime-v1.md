# Question / Information Gap Runtime v1

## Architectural position

This internal, provider-neutral foundation follows Confidence Runtime. It represents an unknown before proposing a question. It is not a question-text feature and is not connected to the conversation response path.

## Runtime objects

`InformationGap` records the bounded information needed, why it matters, owned hypothesis targets, an optional consistent owned confidence evaluation, explicit or unassessed user answerability, an optional canonical preferred question type, immutable v1 provenance, and an `OPEN` state.

`QuestionCandidate` records internal text, canonical type, explicit gap, bounded hypothesis targets and dependencies, information needed, answer format, provenance, and the only implemented terminal gate: `VALIDATED`. Candidate proposals are untrusted and are persisted only after deterministic validation.

## Ownership and integrity

All durable rows carry the authenticated owner. RLS permits owned reads and denies direct authenticated mutation. Security-definer creation functions derive ownership and lifecycle metadata from `auth.uid()` and canonical targets. Hypotheses and confidence references must be owned; a hypothesis-targeted confidence evaluation must target one of the gap hypotheses. The runtime never treats `CONFIDENCE_MODEL_UNCALIBRATED` alone as a user-answerable gap.

## Proposal and validation boundary

`QuestionCandidateGenerator.generate` is provider neutral. Tests use deterministic fakes; v1 has no production provider adapter. Validation enforces UUIDs, bounds, canonical taxonomies, explicit gap linkage, targets contained by the gap, allowed fields only, and normalized duplicate rejection. `DIAGNOSTIC` is an intent label, not authorization to diagnose.

## Deliberately unavailable behavior

Expected information gain and question utility remain `null`; ranking is `UNASSESSED`. V1 does not implement Ranked, Selected, Asked, Answered, Declined, Converted to Evidence, Closed, or Follow-Up transitions. It defines no weights, budgets, sensitivity classifier, emotional-cost formula, timing score, thresholds, or winner selection.

No controller, client API, UI, Context Builder, Behavioral Response Policy, Safety Response Gate, Model Router, FAST/DEEP path, or automatic per-turn invocation is added. There is no confidence or hypothesis mutation, and no automatic Evidence or Memory write. Refusal and answers have no persistence or inference path in v1.

Forbidden durable data includes chain-of-thought, scratchpads, hidden rationale, provider payloads, unrestricted transcripts, diagnoses, personality inferences, and invented scores. Question text remains internal.

## Known limitations and next gate

The canonical calibration and lifecycle decisions listed above remain open. A future policy layer must address safety, privacy, timing, burden, ranking, selection, asking, refusal, and answer handling before user-visible invocation. The next architectural gate is the **Hypothesis Update Loop**.
