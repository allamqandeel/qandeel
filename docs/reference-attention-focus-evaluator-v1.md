# Reference / Attention Resolution Evaluator + Prepared Focus Semantics v1

**Task:** T-03B1a (first slice of canonical Product task T-03B1) · **Status:** implementation contract · **Migration:** none

T-03B1 (Reference / Focus Continuity + Emerging Focus) is one canonical Product task
implemented through two bounded slices. T-03B1a is the **linguistic / semantic
evaluator**: reference, coreference, claim attribution, conversational function,
sequence position and independent attention for ONE committed Conversational Unit at a
time, using PRIOR context only. T-03B1b (not part of this slice) will integrate the
prepared result into the SP-native Session Semantic Clock transaction, assign durable
reference-handle and `emerging_focus_id` identity, and write.

T-03B1a is **production-inert**. It has no migration, no durable write, no Nest
decorator, no module, no bootstrap registration, no mobile code, no Thread, no LF, and
no runtime path reaches it. `tests/reference-attention-focus-evaluator-contract.test.mjs`
proves every one of those statements statically in API CI.

## Frozen authority consumed

| clause | what the evaluator does with it |
| --- | --- |
| CU-10 | every material reference is exactly one of `RESOLVED` / `AMBIGUOUS` / `UNRESOLVED`; cardinality is validated per state, never guessed |
| CU-11 | identity is an opaque server-supplied handle, never a name; two handles may share `أحمد`, and no candidate is ever "picked" |
| CU-12 | pronouns, omitted subjects and ellipsis resolve only through the supplied prior grounding; an omitted subject or elliptical answer is anchored by the exact committed surface that carries it (`بيتجنبني`, `لسه`), and no omitted word is ever synthesized into the committed text |
| CU-13 | `sourceRole` is copied from the committed CU and is absent from the provider schema; the claimant is a separate validated fact |
| CU-14 | a claim carries a frame (`DIRECT_ASSERTION` / `REPORTED_SPEECH` / `DIRECT_QUOTATION`); an ambiguous quotation source stays `UNRESOLVED` |
| CU-15 | code-switching is nothing: an English surface may resolve to an Arabic-grounded handle, and creates no focus by itself |
| CU-16 | an `AMBIGUOUS` / `UNRESOLVED` mention can neither ground a new focus nor continue an existing one |
| CU-04/05/06 | the twelve frozen functions (several per CU, `FUNCTION_UNRESOLVED` alone), the four sequence positions, and a prior-CU target binding |
| THR-01 | a resolved reference never becomes a focus on its own; attention is a separate proposal |
| THR-02 | `START_NEW_FOCUS` needs extractive grounding that this same CU resolved as a reference; an analytical label is refused |
| THR-03 | inputs are committed CUs only; nothing provisional exists in the input types |
| THR-04/10/11/12 | continuity of an existing focus needs a `RESOLVED` link to one of its grounding handles, or a reference-clean local continuation of the current focus |

## The one-CU input boundary

```text
ConversationalFocusEvaluationInput
  sessionId
  currentCu     { cuId, sourceTurnId, sourceRole, committedText, ordinalWithinTurn }   ONE committed CU
  priorContext  { priorCus, referenceHandles, focusCandidates, currentFocusCandidateId }
```

`priorContext` may hold only material legitimate BEFORE the current CU. The evaluator
refuses, before any provider call, a prior context that contains the current CU, a
later CU of the same source turn, or any grounding that points at the current CU
(`FUTURE_CONTEXT_FORBIDDEN`), and any reference-handle or focus-candidate grounding CU
that is not itself in the supplied `priorCus` (`PRIOR_GROUNDING_NOT_AVAILABLE`,
FIX-T03B1A-01). Unknown grounding is rejected, never silently discarded.

The two no-hindsight responsibilities are exactly:

```text
T-03B1a:
  forbids current/later-CU leakage within the supplied sequence
  and requires every reference/focus grounding to be closed over supplied priorCus.

T-03B1b:
  constructs that priorCus set from the authoritative SP-native historical cut
  when the evaluator becomes production-active.
```

Production-inert T-03B1a alone does not prove global cross-turn chronology; that proof
needs the T-03B1b authoritative context builder.

## The provider proposal

A strict `json_schema` (`additionalProperties: false` at every level, every property
required, frozen vocabularies as enums, `store: false`, zero SDK retries, explicit
abort timeout, untrusted-data envelope):

```text
functions[]        frozen vocabulary
sequencePosition   UNMARKED | INITIATING | RESPONSIVE | FOLLOW_UP
targetCuId         a priorCus.cuId or null
references[]       { anchor{text,occurrence}, state, resolvedHandleId, candidateHandleIds[], newReference }
claimAttributions[]{ anchor, claimant{kind, handleId, referenceIndex}, frame }
attention          { kind, existingFocusCandidateId, groundingAnchor, reason }
```

There is no key for an offset, a score, the speaker, a Thread, an LF or an emerging
focus id. Anchors are `{ text, occurrence }`; the deterministic mapper (the T-03A1
code-point mapper, reused, frontier 0, one anchor at a time) computes 0-based half-open
Unicode code-point coordinates. A paraphrase has no location.

## Deterministic validation

| rule | rejection |
| --- | --- |
| function outside the vocabulary, duplicated, or `FUNCTION_UNRESOLVED` with another | `INVALID_PROVIDER_PAYLOAD` |
| target not a prior allowlisted CU (current, future, unknown) | `UNKNOWN_TARGET_CU` |
| anchor not an exact code-point substring | `NON_EXTRACTIVE_REFERENCE` |
| named repetition does not exist | `OCCURRENCE_OUT_OF_RANGE` |
| any handle id outside the allowlist (reference, candidate, claimant) | `UNKNOWN_REFERENCE_HANDLE` |
| `RESOLVED` without exactly one identity, `AMBIGUOUS` with fewer than two distinct handles, `UNRESOLVED` asserting anything | `INVALID_REFERENCE_CARDINALITY` |
| claimant shape inconsistent with its kind, or a new-reference claimant not pointing at a `RESOLVED` new reference | `INVALID_CLAIM_ATTRIBUTION` |
| focus id outside the allowlist | `UNKNOWN_FOCUS_CANDIDATE` |
| `START_NEW_FOCUS` without grounding, or grounding that is not a `RESOLVED` reference of this CU | `FOCUS_GROUNDING_REQUIRED` |
| `START_NEW_FOCUS` grounded on a prior handle that already grounds a supplied focus candidate (FIX-T03B1A-02); attend it instead. A prior handle with no focus candidate, or a NEW current-CU reference, may still start a focus | `EXISTING_FOCUS_CONTINUITY_REQUIRED` |
| handle or focus grounding CU absent from the supplied `priorCus` (FIX-T03B1A-01) | `PRIOR_GROUNDING_NOT_AVAILABLE` |
| `ATTEND_EXISTING_FOCUS` with no `RESOLVED` link to that focus and no reference-clean local continuation of the current focus | `UNGROUNDED_FOCUS_CONTINUITY` |
| provider outage / timeout / transport error | `FOCUS_PROVIDER_UNAVAILABLE` |
| malformed structured output | `INVALID_PROVIDER_PAYLOAD` |

A rejection is a rejection. It is never reported as `NO_INDEPENDENT_FOCUS`, because a
technical failure is not truthful absence.

## Sequential evaluation without hindsight

`evaluateSequence(sessionId, sequence, history)` evaluates a canonical ordered
sequence one CU at a time and threads a PREPARED transient context:

```text
evaluate CU-1 with history only            -> update transient context
evaluate CU-2 with history + CU-1 prepared -> update
evaluate CU-3 ...
```

`orderFinalizedExchange(userCus, assistantCus)` yields every USER CU in source order,
then every ASSISTANT CU. The provider request for CU-1 cannot contain CU-2. New
references and new focus candidates discovered by an earlier CU of the sequence become
selectable for later CUs under `prepared:` ids that are batch-local, non-canonical, not
client-visible and not historically queryable. T-03B1b assigns durable identity.

## Provenance

Every prepared result carries `evaluatorVersion`, `policyVersion`, `provider`,
`model`, `promptVersion` and `schemaVersion`. No wall-clock value, no SP.

## Configuration

`FOCUS_RESOLUTION_PROVIDER` (`OPENAI`), `OPENAI_API_KEY`, `FOCUS_RESOLUTION_MODEL`
(default `gpt-5-mini`), `FOCUS_RESOLUTION_TIMEOUT_MS` (1000..20000, default 8000).
Nothing reads these at bootstrap; `OpenAiFocusResolutionProvider.fromEnvironment()` is
the only reader, and no runtime path calls it in T-03B1a.
