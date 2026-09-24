# QANDEEL — Stage 6.5 Product / Architecture Blocker Resolution v1
## Semantic Domain Constitution + Moment Correction + Recovery Freeze Directive

**Architecture Verdict:** TARGETED REVISION REQUIRED — BLOCKERS RESOLVED BY UPSTREAM CANONICAL AUTHORITY  
**Base Candidate:** `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v2`  
**Next Candidate:** `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v3`  
**Canonical Repository Baseline:** `f322112ec5b862a83716bf9d65b4553b06931774`  
**Coding:** NOT AUTHORIZED

Do NOT repeat broad client-stack research.
Do NOT redo Stage 6.5 from scratch.
Do NOT modify the repository.
Do NOT fetch into the dirty clone.
Do NOT create branches, commits, migrations or PRs.

Preserve all unaffected v2 evidence.

---

# 1. Architecture Review Result

The v2 package correctly obeyed the Stop Rules by refusing to invent:

- the Thread Constitution Rule;
- the Live Focus Constitution Rule.

However, these are NOT genuinely missing from the overall QANDEEL canonical architecture.

The required Product authority exists upstream in the already-frozen Stage 0 / Stage 1 Experience + Conversational Analysis Architecture.

The v2 repository-only inspection did not have those detailed archive clauses in scope.

Therefore:

# **BLOCKER-01 — RESOLVED**
# **BLOCKER-02 — RESOLVED**

A third correction is required:

# **REV65-08 — Moment ≠ finalized exchange**

Stage 1.2 canonical Conversational Units prohibit the v2 exchange-level Moment mapping.

Stage 6.5 v3 must integrate all three rulings below before final freeze review.

---

# 2. REV65-08 — CANONICAL MOMENT CONSTITUTION
## Moment = one committed Conversational Unit

The v2 definition:

> “A Moment is the finalized USER + ASSISTANT exchange.”

is REJECTED.

Canonical Stage 1.2 defines a Conversational Unit (CU) as:

> the smallest contiguous span of committed conversational source material that constitutes one independently addressable conversational contribution.

Frozen CU properties include:

- one CU belongs to exactly one runtime turn;
- one turn may contain multiple CUs;
- a CU never crosses a runtime-turn boundary;
- USER and ASSISTANT contributions cannot form one CU;
- CU identity begins only when source wording, boundary, speaker/attribution and provenance are committed/stable enough;
- provisional/live/revisable source has no permanent analytical authority.

Therefore the Stage 5 Timeline implementation mapping is:

# **ONE COMMITTED CU = ONE `Moment(m)`**

and:

```text
SP(m)
= per-session ordinal of the committed CU

LH
= greatest committed CU SP in the current Session
```

---

# 3. Moment consequences

## MOM-01 — A runtime turn is not the Moment identity

A single runtime turn may produce:

```text
0..N committed CUs
```

depending on the frozen CU grammar.

Therefore:

```text
conversation_turn row != Moment
```

and:

```text
finalized exchange != Moment
```

---

## MOM-02 — USER and ASSISTANT source contributions remain separate

If a USER turn and an ASSISTANT turn each contain one CU:

```text
USER CU      → Moment m
ASSISTANT CU → Moment m+1
```

They are not merged into one Moment.

If either turn contains several independently addressable CUs, each committed CU receives its own Moment/SP.

---

## MOM-03 — SP allocation

`SP` is:

- session-scoped;
- integer;
- monotonic;
- gapless over committed CUs;
- never assigned to provisional/uncommitted source.

When multiple CUs become committed in one source-finalization operation:

- allocate one contiguous SP block atomically;
- preserve source conversational order;
- preserve `ordinal_within_turn`.

A timestamp is not `SP`.

---

## MOM-04 — Commitment boundary

Stage 6.5 must NOT make assistant-response completion the Product definition of CU commitment.

CU commitment occurs only after the source contribution satisfies Stage 1.2's finalized/committed-unit contract.

The implementation may need a new committed-CU runtime substrate because the current repo is turn-oriented.

Classify that honestly as:

```text
MISSING / BUILD
```

if no committed CU store already exists.

Do not weaken the Product rule to fit `finalize_conversation_turn`.

---

## MOM-05 — Required committed-CU substrate

Stage 6.5 v3 must specify an implementation contract equivalent to:

```text
conversation_units
```

with stable identity/provenance sufficient to preserve at least:

- user_id;
- session_id;
- source_turn_id;
- speaker;
- ordinal_within_turn;
- source-span provenance;
- commitment/finalization provenance;
- `SP`;
- committed timestamp as audit metadata;
- exact source reference needed by Stage 1 grammar.

Exact column names remain Engineering Architecture, but the semantics above are required.

---

## MOM-06 — LH delivery

The existing `ConversationTurnCompleted` outbox event may remain useful as operational evidence.

It is NOT the canonical Moment establishment event once Moment = committed CU.

Stage 6.5 v3 must define an equivalent of:

```text
ConversationalUnitsCommitted
```

or another explicit committed-CU event.

It must allow the client to learn that `LH` advanced without embedding analytical/future content.

A batched event MAY carry:

- latest committed `SP`;
- source/session identity;
- non-content lifecycle metadata.

The client re-reads entitled Timeline data through the canonical projection boundary.

---

# 4. RESOLUTION-01 — THREAD CONSTITUTION RULE
## Canonical Thread meaning

A QANDEEL Thread is:

# **a persistent, navigable locus of genuine conversational attention around one sufficiently identifiable, user-addressable focus/subject**

A Thread is NOT:

- a keyword;
- an entity mention;
- a person-name occurrence;
- a runtime turn;
- a Reading/Hypothesis;
- a connected component of competing hypotheses;
- an embedding/similarity cluster;
- something created because QANDEEL analytically finds it interesting.

Canonical lifecycle:

```text
Mention / Entity
    ↓
Emerging Focus
    ↓
Established Thread
    ↓
Active ↔ Dormant ↔ Reopened
```

Persistent geography begins only at:

# **Thread Establishment**

---

# 5. Thread subject continuity

The Thread's constitution comes from the Stage 1 conversational reference / attention grammar.

Committed CUs belong to the same focus continuity when their conversational subject/reference resolves to the same canonical focus identity.

The focus may be a sufficiently identifiable:

- person;
- topic;
- place;
- organization;
- relational focus;
- other conversational subject/context permitted by the frozen grammar.

Mere lexical similarity does not constitute continuity.

Same-name or ambiguous references must obey the frozen reference/coreference/disambiguation contract.

---

# 6. Emerging Focus

An Emerging Focus is:

- provisional;
- session/conversation-grounded;
- pre-geographic;
- not yet a permanent Thread;
- allowed to disappear without leaving Thread geography.

An Emerging Focus requires at least:

> **one committed CU containing genuine independent conversational-attention evidence.**

QANDEEL-generated:

- Readings;
- Unknowns;
- Questions;
- analytical interest

may strengthen an Emerging Focus.

They may NOT create one or establish a permanent Thread without conversational grounding.

---

# 7. Thread Establishment — canonical promotion test

A Thread is Established only when BOTH are true:

```text
A. genuine independent conversational attention
AND
B. user-addressable significance / stable subject identity
```

The frozen promotion paths are:

## TE-01 — Explicit user conversational selection

A single committed CU may establish the Thread if the user explicitly selects/addresses a sufficiently identifiable focus as the subject of attention.

Incidental mention is not enough.

## TE-02 — Sustained substantive engagement

Multiple committed CUs sustain substantive independent attention to the same Emerging Focus such that the subject is no longer incidental.

## TE-03 — Recurrent independent attention

The focus returns independently across committed conversation and demonstrates stable user-addressable continuity.

No generic numeric:

- score;
- similarity threshold;
- keyword count;
- timer

is frozen as the Product establishment rule.

Implementation may use deterministic evidence predicates/reason codes.

It may not replace these semantic paths with a generic score.

---

# 8. Thread establishment event

The runtime event that establishes a Thread is:

# **`ThreadEstablished`**

or an equivalent explicit domain event.

It occurs after a committed CU makes one of TE-01 / TE-02 / TE-03 true under the frozen Thread Establishment grammar.

The establishment transaction must record:

- stable Thread identity;
- establishing `SP`;
- establishing Session;
- establishment reason/path;
- grounding focus identity;
- permanent Home locus.

Home is assigned exactly once using then-legitimate world context.

No Thread exists in `K(t)` before its establishment SP.

No future Home is borrowed backward.

---

# 9. Thread identity refinement vs reframing

Refinement of the same focus:

```text
preserves Thread identity
```

Genuine reframing into a different conversational subject:

```text
creates a new Thread
```

Do not merge two established Threads merely because later analytical relations or competing Readings connect them.

Relations do not constitute Thread identity.

---

# 10. Reading ↔ Thread binding

The v2 disproof of:

```text
Thread = connected component(competing_hypothesis_ids)
```

is ACCEPTED.

Canonical rule:

> Readings are analytical interpretations associated with a conversational focus; they do not constitute the focus itself.

A Reading/Hypothesis may receive a Thread contextual binding only when its subject grounding legitimately resolves to that Thread/focus.

The implementation may use an owner-scoped append-only validity-aware binding table.

Important:

- binding does not duplicate Reading identity;
- contextual appearance does not create ownership;
- a canonical Reading may have more than one legitimate contextual appearance if upstream truth supports it;
- relation/similarity alone cannot silently create Thread membership.

---

# 11. Thread lifecycle

## Active

Established Thread currently receiving conversational attention.

## Dormant

Same Thread identity/Home after attention has stably shifted away.

Dormancy is conversational, not clock/timer based.

## Reopened

A committed conversational return to a Dormant Thread.

Reopened:

- preserves canonical Thread identity;
- preserves Home;
- does not create a new Thread.

The append-only lifecycle-history direction proposed in v2 remains APPROVED.

---

# 12. RESOLUTION-02 — LIVE FOCUS CONSTITUTION RULE

Canonical `LF` means:

# **CURRENT LIVE CONVERSATIONAL ATTENTION ONLY**

It is NOT:

- importance;
- rank;
- centrality;
- confidence;
- analytical strength;
- permanent priority;
- current inspected object;
- latest Map click;
- user-owned context activation.

---

# 13. LF value domain

Canonical implementation value domain:

```text
LF =
    NONE
  | EmergingFocus(emerging_focus_id)
  | EstablishedThread(thread_id)
```

`NONE` is legitimate before a stable Live conversational focus exists or after attention leaves a prior focus without establishing another.

Eligible LF targets are:

- Emerging Focus;
- Established Thread.

Not direct LF targets:

- Reading/Hypothesis;
- Material;
- Question;
- Information Gap;
- Evidence edge;
- Confidence object.

Those may be inspected or participate in analysis without becoming Live conversational focus.

---

# 14. LF is analysis-derived from committed conversation

`LF` is:

# **analysis-derived from committed conversational attention**

It is NOT user-declared Map state.

It may change without a navigation act when committed conversation changes focus.

The authoritative input is the frozen committed-CU / reference / attention grammar.

A Map action such as:

- inspection;
- Pan;
- Zoom;
- contextual navigation

does NOT change LF.

Stage 4's distinction remains:

```text
Live Focus != Inspected Focus
```

---

# 15. Explicit user selection and LF

An explicit conversational selection can affect LF because it is itself committed conversational evidence.

Example:

A committed user CU explicitly makes Focus X the subject of conversation.

That may:

- create/update Emerging Focus X;
- establish Thread X under TE-01;
- make X the current LF.

This does NOT mean:

> clicking/selecting X in the Map sets LF.

Conversational intent and UI inspection remain separate.

---

# 16. LF change rule

LF changes when the committed conversational-attention resolver concludes one of:

## LF-01 — New independent focus

Committed CU grounds a real shift to a new Emerging Focus or Established Thread.

## LF-02 — Continued local focus

Attention remains on the current focus.

No LF transition required.

## LF-03 — Return

Committed CU returns to an existing Established Thread.

LF becomes that same Thread.

If it was Dormant, the Thread lifecycle may transition to Reopened under the same committed conversational evidence.

## LF-04 — Stable departure with no replacement focus

LF may become:

```text
NONE
```

Brief interruptions do not necessarily change LF.

No wall-clock timer alone changes LF.

---

# 17. LF and Thread establishment at the same Moment

Within one committed CU/SP, use this semantic order:

```text
1. CU is committed / receives SP
2. references + conversational focus are resolved
3. Emerging Focus continuity is resolved
4. optional Thread establishment occurs
5. effective LF for that SP is resolved
```

If the same CU establishes the currently attended Emerging Focus as a Thread:

> the effective LF at that SP is the newly Established Thread.

Earlier SPs retain the Emerging Focus history.

No historical rewrite occurs.

---

# 18. Emerging Focus identity

The v2 proposal that an Emerging LF may have:

```text
focus_ref = NULL
```

is REJECTED.

Two distinct Emerging Focuses must not collapse into one anonymous value.

Every Emerging Focus that may become LF receives a:

# **stable session-scoped `emerging_focus_id`**

This identity is:

- provisional;
- non-geographic;
- not a Thread ID;
- sufficient for focus continuity/history;
- allowed to terminate/disappear.

If promoted:

```text
EmergingFocus(id)
    --promoted_to-->
Thread(thread_id)
```

The pre-establishment object is not retroactively a Thread.

---

# 19. LF history / transport

The v2 append-only direction is APPROVED with this correction.

Use an equivalent of:

```text
live_focus_transitions
```

anchored to committed CU `SP`.

The transition value records:

```text
NONE
EMERGING(emerging_focus_id)
THREAD(thread_id)
```

rather than nullable anonymous Emerging focus.

The transition history is required so Stage 5.5 can bind:

- `LF_at_activation`;
- `LF_at_post-live-boundary`

without re-deriving today's focus for a historical boundary.

Delivery to the client must be non-content-leaking and must re-read entitled state through the normal domain boundary.

---

# 20. Context Activation contract is NOT LF

The repository's explicit `conversation-context-activation` contract remains valid.

Its rule that QANDEEL must not silently infer/auto-bind a user-owned context from conversation content does NOT redefine `LF`.

Canonical distinction:

```text
Explicit Context Activation
= user-owned context binding

Live Focus
= analysis-derived current conversational attention
```

Do not reuse one as the implementation of the other.

No contradiction exists.

---

# 21. Recovery policy — FINAL PRODUCT RULING FOR v1

Stage 6.5 v2 recommends:

```text
R-02 — Same-device local committed-navigation persistence
```

Architecture APPROVES R-02 for v1.

Persist a versioned app-private local checkpoint containing committed navigation intent sufficient to restore:

- `TM`;
- `TC`;
- `IF_ref`;
- canonical camera intent;
- `RH`;
- session identity/checkpoint version.

Do NOT persist:

- `PTC`;
- animation progress;
- input-stream state;
- Timeline presentation window/position;
- responsive layout;
- cached `K(TC)`;
- cached depth-disclosed view.

On restart:

- re-read authoritative `LH`;
- re-read authoritative `LF`;
- recompute `K(TC)`;
- recompute depth-disclosed view;
- restore no presentation animation.

Restart itself:

- is not a user act;
- writes no RH;
- is not Back-reversible.

---

# 22. Recovery correction — closed / expired Session

The v2 phrase:

> “discard checkpoint and return to Live”

is too broad.

If the checkpoint's Session is no longer an active/current Session:

- discard the checkpoint whole;
- do NOT synthesize `FOLLOW_LIVE` for a Session that has no active Live edge;
- enter the canonical app/session entry flow for the current authoritative runtime state.

No RH entry is written.

The exact navigation screen/chrome of that entry flow is implementation routing, not a new Stage 5 temporal semantic.

---

# 23. Stage 6.5 v3 — required Semantic Domain Mapping status

After this ruling:

## SDM-01 — Moment / SP / LH
**RESOLVED BY ARCHITECTURE — REWRITE v2**

Mapping:

```text
Moment = committed CU
```

not finalized exchange.

Committed-CU runtime substrate may classify `MISSING / BUILD`.

## SDM-02 — Thread
**RESOLVED BY ARCHITECTURE**

Implement the constitution rule in §§4–11.

## SDM-03 — Reading ontology
v2 direction may remain unless another contradiction appears.

## SDM-04 — LF
**RESOLVED BY ARCHITECTURE**

Implement §§12–20.

## SDM-05 / SDM-06
Retain v2 reconstructability findings and update them for:

- committed CU history;
- Emerging Focus history;
- Thread establishment/history;
- LF transitions.

---

# 24. Architecture Delta Register — required additions

v3 must update/add explicit rows for:

- committed Conversational Unit substrate;
- CU commitment producer;
- CU → SP allocation;
- CU-commit/LH event delivery;
- Emerging Focus entity/continuity;
- Emerging → Thread promotion lineage;
- Thread constitution/evaluator;
- Thread establishment event;
- immutable Home assignment;
- Thread Reading/context bindings;
- Thread lifecycle history;
- LF resolver;
- LF transition history;
- LF client delivery;
- R-02 local committed-navigation checkpoint.

No Product-semantic row may remain `UNKNOWN`.

---

# 25. Task-sequence consequences

The v2 14-task plan may be adjusted.

Required changes:

## T-03A

No longer implement:

```text
Moment = finalized exchange
```

T-03A must implement the **committed CU temporal substrate**:

- committed CU persistence;
- SP allocation;
- LH derivation;
- client observable LH advancement.

If this is too large for one architectural reason, split it into:

```text
T-03A1 — Committed CU substrate
T-03A2 — SP / LH / delivery
```

Do not preserve task count for cosmetic consistency.

## T-03B

No longer BLOCKED.

Implement the now-frozen:

- Emerging Focus;
- Thread constitution;
- establishment;
- Home;
- lifecycle;
- bindings.

## T-04 / T-08 / Map half of T-09

No longer blocked by Thread constitution after T-03B.

## T-07

`RETURN_LIVE_FOCUS` and `GO_LIVE_AND_LOCATE` are no longer Product-blocked once the LF substrate is implemented.

## Recovery task

T-13 may consume the now-approved R-02 policy.

---

# 26. Required new / corrected proofs

## P65-02R — CU → Moment commitment

Fixture must include:

- one turn → one CU;
- one turn → multiple CUs;
- provisional/live source;
- revised source before commitment;
- cancelled/failed source;
- USER CU;
- ASSISTANT CU;
- USER + ASSISTANT exchange.

Expected:

- only committed CUs become Moments;
- one CU = one Moment;
- no CU crosses turn boundary;
- exchange is never one Moment merely because it finalizes atomically;
- SP is gapless over committed CUs.

---

## P65-08 — Thread establishment

Test at minimum:

1. incidental mention → no Emerging/Thread establishment unless independent attention exists;
2. one committed CU with genuine independent attention → Emerging Focus;
3. explicit user conversational selection → may establish immediately;
4. sustained substantive engagement → establish;
5. recurrent independent attention → establish;
6. analytical Reading alone → cannot establish;
7. similarity/peer relation alone → cannot establish;
8. refinement → same Thread;
9. genuine reframing → new Thread;
10. establishment at SP n → absent from K(t < n), present at fixed Home for t ≥ n.

---

## P65-09 — LF constitution

Test at minimum:

1. no stable focus → `LF = NONE`;
2. Emerging focus current → `LF = EmergingFocus(id)`;
3. same CU establishes Thread → LF resolves to Thread at that SP;
4. brief interruption → LF unchanged;
5. stable conversational shift → LF changes;
6. Map inspection elsewhere → LF unchanged;
7. explicit conversational selection → LF may change;
8. return to Dormant Thread → same Thread + lifecycle Reopened;
9. two distinct Emerging Focuses retain distinct IDs;
10. P5 activation/post-live boundaries read append-only LF history correctly.

---

## P65-10 — Context activation ≠ LF

Prove:

- explicit context activation can change user-owned context state;
- it does not automatically set LF;
- LF can change from committed conversation without context activation;
- neither contract violates the other.

---

# 27. Required v3 update scope

Create:

# `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v3`

Do NOT redo unaffected work.

Update:

1. Ruling compliance map;
2. Implementation Decision Index;
3. Semantic Domain Mapping Record;
4. SDM-01;
5. SDM-02;
6. SDM-04;
7. historical reconstructability matrix;
8. Architecture Delta Register;
9. state-class inventory;
10. State Ownership Matrix;
11. Action Catalog / event flow;
12. backend/API delta;
13. schema/persistence delta;
14. two-layer projection architecture as affected;
15. Map architecture as affected;
16. Timeline architecture as affected by CU Moments;
17. LF / return architecture;
18. R-02 recovery policy and fixture;
19. Test architecture / traceability;
20. implementation Task/BR sequence;
21. task contracts;
22. dependency graph;
23. migration order;
24. blockers section;
25. risks;
26. Stage 6.6 inputs;
27. MUST / MUST NOT;
28. P65-02R / P65-08 / P65-09 / P65-10;
29. Architecture Review Handoff;
30. diagram / START_HERE / checksums.

Preserve unaffected:

- CS-01 client-stack research;
- RN + Expo CNG direction;
- K(TC) vs depth-disclosed view separation;
- AF64-02 presentation-position work;
- Map accessibility mapping;
- OPEN-17 seam proof direction;
- native escape-hatch policy;
- technical evidence already accepted.

---

# 28. v3 blocker expectation

After applying this ruling:

```text
BLOCKER-01 = RESOLVED
BLOCKER-02 = RESOLVED
```

Do NOT replace them with new implementation TODOs that ask coding to decide Product semantics.

If targeted repository inspection shows a technical inability to implement the now-frozen constitution rules:

report a TECHNICAL blocker.

Do not reopen the Product rule.

---

# 29. Stop Rules

STOP and report if v3 implementation planning would require:

- merging committed CUs across turn boundaries;
- treating a raw turn or finalized exchange as the canonical Moment;
- using hypothesis graph connectivity to constitute Threads;
- using generic similarity/score thresholds as the Thread establishment rule;
- letting QANDEEL analytical interest alone establish Thread geography;
- using Map inspection/context activation as LF;
- giving two Emerging LF targets no distinct identity;
- changing Home after establishment;
- re-deriving historical LF from present analysis instead of history;
- changing Stage 5 temporal/return semantics;
- reopening deferred OPEN-06/08/09/19.

Otherwise return v3 for final Stage 6.5 Architecture review.

No coding is authorized.

---

# 30. Current Status

```text
Stages 0–5                              CLOSED / FROZEN
Stage 6.1                              CLOSED / FROZEN
Stage 6.2                              CLOSED / FROZEN
Stage 6.3                              CLOSED / FROZEN
Stage 6.4                              CLOSED / FROZEN
Stage 6.5 v2                           REVIEWED
Thread Product blocker                RESOLVED
Live Focus Product blocker            RESOLVED
Moment mapping                        CORRECTED
Recovery policy R-02                  APPROVED
Stage 6.5 v3                           TARGETED REVISION NEXT
Stage 6.6                              NOT AUTHORIZED YET
Implementation                        NOT AUTHORIZED
```
