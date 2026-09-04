# Thread Establishment Evaluator + Prepared Promotion Evidence v1

**Task:** T-03B2a (first slice of canonical Product task T-03B2 — Thread Establishment) · **Status:** implementation contract · **Migration:** none

T-03B2 holds two independent architectural reasons, so Architecture split it before
coding. T-03B2a is the **Thread Establishment semantic judgment**: whether the committed
conversation, as of ONE committed Conversational Unit, now satisfies one of the frozen
TE-01 / TE-02 / TE-03 promotion paths for the stable Emerging Focus that T-03B1 already
identified. T-03B2b (not part of this slice) owns the **durable Thread + permanent Home
commitment**: stable Thread identity, Emerging→Thread lineage, the immutable Home Anchor,
the `ThreadEstablished` event and insertion into the same-SP per-Moment transaction
before LF.

T-03B2a is **production-inert**. It has no migration, no Thread row, no Thread id
allocation, no Home Anchor / Canonical Spatial Address, no durable event, no Session
Semantic Clock write, no service-role RPC, no ConversationService / ConversationModule
wiring, no mobile change, no lifecycle write and no LF. It produces only a strict PREPARED
semantic decision for T-03B2b to canonicalize and persist later.
`tests/thread-establishment-evaluator-contract.test.mjs` proves every one of those
statements statically in API CI.

## Frozen authority consumed

| clause | what the evaluator does with it |
| --- | --- |
| THR-01/02/03 | the only establishment target is the stable `emerging_focus_id` that canonical B1 attention (`START_NEW_FOCUS` / `ATTEND_EXISTING_FOCUS`) carries; a resolved Mention, a `NO_INDEPENDENT_FOCUS` CU or provisional material can never be a target, and the provider is not even consulted |
| THR-04/11 | identity-specific establishment is impossible while B1 supplies no stable identity; a `prepared:` or malformed id is rejected as input, never upgraded by lexical convenience — the evaluator never inspects names to override B1 |
| THR-05 | independent attention is B1's frozen classification, consumed as history entries; the Thread evaluator never re-classifies it |
| THR-06/13 | TE-02 and TE-03 need at least one USER CU among the evidence; QANDEEL's questions or analysis may strengthen but never establish alone |
| THR-07/22 | promotion is by evidence path only: no score, probability, threshold, frequency, similarity, embedding, rank or timer exists in the input, the provider schema or the validator |
| THR-08 | one committed USER CU that explicitly selects the focus («عايز نتكلم عن أحمد تحديدًا») establishes by TE-01 with zero prior repetition |
| THR-09 | without explicit selection, TE-02 needs multiple committed same-focus CUs and TE-03 needs a genuine return |
| THR-10 | continuity follows the stable focus identity, never repeated wording; the validator reads committed text only to map the TE-01 anchor |
| THR-12 | a selection wholly inside a `REPORTED_SPEECH` / `DIRECT_QUOTATION` attribution of the current CU is somebody else's selection and cannot satisfy TE-01; repeated quoted mentions are not evidence |
| THR-14…17 | an already-established focus is recognized only to prevent duplicate establishment (`ALREADY_ESTABLISHED`, zero provider); lifecycle belongs to T-03B3 |
| THR-18/19/20/21 | refinement of the same focus is the same focus; a reframed, independently addressable subject is a distinct target only when B1 already gave it its own `emerging_focus_id`, and it rewrites nothing about the original identity |
| Stage 6 promotion contract | `ESTABLISH_THREAD` only when genuine independent attention AND user-addressable stable identity are both defensible, through exactly one of TE-01 / TE-02 / TE-03 |
| Stage 2 / Home | nothing geographic is output or inferred: no Thread id, Home, spatial address, coordinates, region, parent or placement |

## The one-CU input boundary

```text
ThreadEstablishmentEvaluationInput
  sessionId
  currentCu              { cuId, sourceTurnId, sourceRole, committedText, ordinalWithinTurn }   ONE committed CU (B1 shape)
  currentFocusSemantics  CanonicalCuFocusSemanticPayload of exactly that CU (unit_id == cuId)
  priorContext           { priorCus, focusAttentionHistory, establishedFocusIds }
```

`priorCus` are ordered committed prior CUs with their B1 function / sequence context.
`focusAttentionHistory` holds one entry per prior CU whose B1 semantics exist —
`{ cuId, attentionKind, attentionReason, emergingFocusId }` — with no timestamp, no score
and no analytical-object count; every entry's CU must be in `priorCus`.
`establishedFocusIds` is focus-id membership only: no Thread id, no Home.

Deterministic gates run before any provider call (task §10): identities and source role;
`unit_id == cuId` (`FOCUS_SEMANTICS_MISMATCH`); no current or later same-turn material as
"prior" (`FUTURE_CONTEXT_FORBIDDEN`) — an EARLIER committed CU of the current source turn is
legitimate prior context, because the frozen committed-CU contract allows forward progress
within one turn (FIX-T03B2A-01); every history CU closed over `priorCus`
(`PRIOR_EVIDENCE_NOT_AVAILABLE`); ordered, unique prior CUs; one canonical source role per
source turn, in prior context, in the sequence and across the same-turn boundary — a
mixed-role turn is refused, never re-labelled (FIX-T03B2A-03, `INVALID_EVALUATION_INPUT`);
the exact frozen B1 attention vocabulary and stable (never `prepared:`) focus ids
(`INVALID_ATTENTION_HISTORY`). A malformed context is never treated as truthful
non-establishment. Then:

```text
B1 attention NO_INDEPENDENT_FOCUS          -> NO_ESTABLISHMENT / NO_INDEPENDENT_FOCUS   zero provider
target focus already in establishedFocusIds -> NO_ESTABLISHMENT / ALREADY_ESTABLISHED    zero provider
otherwise                                  -> provider proposal -> deterministic validation
```

## The provider proposal

A strict `json_schema` (`additionalProperties: false` at every level, every property
required, exact enums, `store: false`, zero SDK retries, explicit abort timeout,
untrusted-data envelope `<thread_establishment_source>`):

```text
decision                NO_ESTABLISHMENT | ESTABLISH_THREAD
path                    null | TE-01 | TE-02 | TE-03
evidenceCuIds[]         committed CU ids, bounded by the supplied CUs
explicitSelectionAnchor null | { text, occurrence }      TE-01 only, extractive
```

The request contains only `schemaVersion`, `currentCu`, `currentFocusSemantics`,
`priorCus` and `focusAttentionHistory`. There is no key for a Thread id, Home or spatial
value, Reading / Unknown / Question / Evidence count, confidence, importance, rank,
similarity, embedding, wall-clock, SP, LF or Map state, and no free-form rationale. The
anchor is mapped by the T-03A1 exact code-point mapper (frontier 0, one anchor alone);
the provider never authors an offset.

## Deterministic validation

| rule | rejection |
| --- | --- |
| decision / path / evidence / anchor outside the closed shape | `INVALID_PROVIDER_PAYLOAD` |
| `NO_ESTABLISHMENT` with a path, evidence or anchor; `ESTABLISH_THREAD` without a path; TE-01 with more than the current CU; TE-02 / TE-03 with an anchor | `INVALID_PROMOTION_PATH` |
| `ESTABLISH_THREAD` while B1 supplies no stable focus identity | `ESTABLISHMENT_WITHOUT_FOCUS` |
| `ESTABLISH_THREAD` for a focus already promoted | `FOCUS_ALREADY_ESTABLISHED` |
| current CU missing from the evidence | `CURRENT_CU_EVIDENCE_REQUIRED` |
| an evidence CU that is neither the current CU nor a supplied prior CU (unknown, future) | `UNKNOWN_EVIDENCE_CU` |
| a repeated evidence id | `DUPLICATE_EVIDENCE_CU` |
| a prior evidence CU whose B1 attention is not START/ATTEND of the SAME target focus | `EVIDENCE_NOT_FOCUS_BOUND` |
| TE-02 / TE-03 evidence carried by ASSISTANT CUs alone | `USER_EVIDENCE_REQUIRED` |
| TE-01 for an ASSISTANT CU | `EXPLICIT_SELECTION_ROLE_FORBIDDEN` |
| TE-01 without an anchor | `EXPLICIT_SELECTION_REQUIRED` |
| anchor not an exact code-point substring of the current committed text | `NON_EXTRACTIVE_SELECTION` |
| named repetition does not exist | `OCCURRENCE_OUT_OF_RANGE` |
| anchor wholly inside a `REPORTED_SPEECH` / `DIRECT_QUOTATION` span of the current CU | `ATTRIBUTED_SELECTION_FORBIDDEN` |
| TE-02 with fewer than two distinct committed CUs, or no prior same-focus CU | `INSUFFICIENT_SUSTAINED_EVIDENCE` |
| TE-03 without a prior same-focus CU; not citing the LATEST prior same-focus CU (derived from the full supplied history, never from the cited evidence — FIX-T03B2A-02); without a committed CU strictly after that latest CU whose known attention lay elsewhere (and was not a local clarification); or with a current CU that is itself a `LOCAL_CLARIFICATION_OR_CORRECTION` | `RECURRENCE_NOT_PROVEN` |
| provider outage / timeout / transport error | `THREAD_PROVIDER_UNAVAILABLE` |
| malformed structured output | `INVALID_PROVIDER_PAYLOAD` |

A rejection is a rejection. It is never reported as `NO_ESTABLISHMENT`, because a
technical failure is not truthful non-establishment.

The structural minima are the semantic minima and nothing above them: TE-02 is "multiple"
(two distinct committed CUs including the current one, at least one prior), TE-03 is the
latest prior same-focus CU plus committed material after it whose attention lay elsewhere.
Attention that already returned to the focus after an earlier departure moves that boundary
forward, so a later same-focus CU is a continuation of that return, not a new recurrence:
`Ahmed → Manager → Ahmed → CURRENT Ahmed` cannot be promoted by citing only the old Ahmed CU.
There is no fixed count above that, no elapsed time and no token frequency. Whether a
sequence is substantively sustained, or a return is genuinely independent, is the provider's
semantic proposal within those bounds.

## Prepared result

```text
PreparedThreadEstablishmentResult
  sessionId, cuId, sourceTurnId, sourceRole        copied from the committed CU
  emergingFocusId                                  the stable B1 focus, or null (NO_INDEPENDENT_FOCUS)
  decision, path, noEstablishmentReason
  evidenceCuIds                                    prior same-focus CUs in committed order, then the current CU
  explicitSelectionGrounding                       TE-01 only: exact anchor + code-point span
  provenance                                       evaluatorVersion, policyVersion, provider, model, promptVersion, schemaVersion
```

No Thread id. No Home. No SP. No LF. No wall-clock value. `noEstablishmentReason` is an
engineering-only field limited to `NO_INDEPENDENT_FOCUS`, `ALREADY_ESTABLISHED` and
`NO_PROMOTION_PATH_PROVEN`; it is not a Product taxonomy.

## Sequential evaluation without hindsight

`evaluateSequence(sessionId, sequence, history)` processes `{ cu, focusSemantics }` pairs
in the frozen finalized-exchange order (every USER CU, then every ASSISTANT CU; the B1
`orderFinalizedExchange` yields it). For each CU it evaluates with the context as it stood
BEFORE that CU, then appends the CU and its canonical attention to the in-memory prior
context; a CU that ESTABLISHES a focus adds the focus id to the in-memory established set,
so later same-focus CUs short-circuit as `ALREADY_ESTABLISHED` with zero provider calls.
No request contains a later CU, and no assistant CU can help establish an earlier USER CU.
The in-memory set is technical sequence state only: it allocates no Thread id and creates
no canonical truth.

The history a sequence starts from is judged per source turn. A prior CU whose id is in the
sequence is hindsight. A prior CU of a turn the sequence continues is legitimate only when
its ordinal is below the first sequence ordinal of that turn and its source role is that
turn's role; the first sequence ordinal or any later one is overlapping / current / future
material (`FUTURE_CONTEXT_FORBIDDEN`), and a different role is malformed
(`INVALID_EVALUATION_INPUT`). Global `ordinalWithinTurn` values supplied by B1 / T-03A are
preserved, never renumbered.

## Global chronology handoff

T-03B2a carries no SP in its provider boundary and does not invent cross-turn chronology
from opaque `sourceTurnId` values. The responsibilities are exactly:

```text
T-03B2a
  validates:
    - unique/order-consistent CUs inside each source turn;
    - same-turn past/current/future boundary;
    - provider evidence against the supplied ordered prior cut.

T-03B2b
  MUST construct:
    - global priorCus order
    - focusAttentionHistory order
  from authoritative SP-native canonical history.
```

Production-inert T-03B2a alone does not prove arbitrary cross-turn global chronology; that
proof needs the T-03B2b authoritative context builder.

## Configuration

`THREAD_ESTABLISHMENT_PROVIDER` (`OPENAI`), `OPENAI_API_KEY`, `THREAD_ESTABLISHMENT_MODEL`
(default `gpt-5-mini`), `THREAD_ESTABLISHMENT_TIMEOUT_MS` (1000..20000, default 8000).
Nothing reads these at bootstrap; `OpenAiThreadEstablishmentProvider.fromEnvironment()`
is the only reader, and no runtime path calls it in T-03B2a. Provenance is
`thread-establishment-evaluator-v1` / `stage-1.3-thread-establishment-v1` /
`thread-establishment-evidence-path-v1` / schema 1.

## What T-03B2b consumes

`PreparedThreadEstablishmentResult` and `PreparedThreadEstablishmentSequence` from
`apps/api/src/thread-establishment/index.ts`, built from the canonical B1 units of the same
exchange (`CanonicalFocusSequence.units` paired one-to-one with the ordered CUs) and a
`ThreadEstablishmentPriorContext` constructed from the authoritative SP-native historical
cut. T-03B2b allocates the durable Thread identity, the Emerging→Thread lineage, the
immutable Home Anchor and the `ThreadEstablished` event inside the same per-Moment SP
transaction, after B1 and before LF.
