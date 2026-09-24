# QANDEEL — Stage 5.5 Architecture Freeze Addendum
## Temporal Orientation + Return + Edge-Case Integration v1

**Architecture Verdict:** APPROVED / CLOSED / FROZEN  
**Base Candidate:** `QANDEEL_STAGE5_5_CANDIDATE_PACKAGE_v1`  
**Authority:** This addendum is canonical and overrides/narrows the candidate wherever wording differs. All candidate rules not modified below are accepted.

---

# A-01 — Separate the effective-change tuple from the RH checkpoint payload

The candidate uses one symbol `Φ` for two related but not identical concepts:

1. the components used to decide whether an explicit act produced an effective change; and
2. the data captured in an `RH` checkpoint.

That must be separated.

## Effective-change tuple

Use:

`Φ_eff = ⟨ TM, TC, IF_ref, MC.region, MC.depth ⟩`

An explicit act is an effective navigation/inspection change only when the act itself changes at least one component of `Φ_eff`.

This preserves the important candidate finding:

`PINNED(LH) -> FOLLOW_LIVE`

is a real effective change even at the same numeric `TC`, because `TM` changed.

## RH checkpoint payload

Use an equivalent of:

`C_RH = ⟨ capturedTM_provenance, capturedTC, capturedIF_ref, capturedMC.region, capturedMC.depth ⟩`

`capturedTM_provenance` is historical provenance only.

Restoration remains:

`RestoreTemporal(C_RH) := PINNED(C_RH.capturedTC)`

The captured temporal mode is **not** restored as authority.

Therefore an RH checkpoint is not literally a tuple that is reproduced component-for-component. It is a checkpoint payload interpreted through the frozen Stage 5.1 restoration rule.

This clarification replaces candidate wording that calls the same `Φ` both “restorable” and mode-sensitive while also saying captured mode never restores.

---

# A-02 — Effective change means action-attributable change, not raw activation-to-settle delta

Candidate `G-20` is approved with this mandatory precision:

> **No-op classification is based on the change attributable to the explicit act, after accounting for independent passive/live evolution — not on a naive before/after comparison of `Φ_eff`.**

This matters when asynchronous Live truth changes during an action.

Example:

- user is already `FOLLOW_LIVE @ 105`;
- user invokes Return to Live Head;
- a passive Live commit advances `LH`, and therefore effective `TC`, to 106 before settle.

The raw snapshots differ (`TC 105 -> 106`), but that delta was caused by FOLLOW_LIVE's frozen automatic advancement, not by the Return-to-Live invocation.

Therefore:

- the invocation is still an effective **no-op**;
- it creates no `RH` entry;
- the passive Live commit creates no `RH` entry.

Likewise, a spatial no-op occurring while FOLLOW_LIVE advances must not acquire history merely because passive temporal state changed concurrently.

Canonical rule:

> **Passive events may change authoritative state, but they never make an otherwise no-op user command into an RH transaction.**

No implementation scheduling or counterfactual algorithm is frozen here; only the semantic result is.

---

# A-03 — Narrow the candidate's “composite guarantee”

Candidate `F-04` / Decision Index #6 is directionally correct but over-broad.

Do NOT freeze these literal claims:

- “no return action can become a follow”; or
- “the historical excursion is always exactly one Back away.”

They are false if read generally:

- Return to Live Head and Go Live + Locate explicitly establish temporal `FOLLOW_LIVE`;
- after the user performs another explicit act following a Return-to-Live transaction, that later act sits above the historical checkpoint in `RH`.

The canonical guarantee is:

## Spatial-follow guarantee

D1 ensures:

> **Return to Live Focus is a one-shot spatial command and can never turn into persistent camera/focus following.**

Its captured `LF*` does not chase later `LF` changes.

## Excursion-reachability guarantee

D5 ensures:

> **An effective Return to Live Head or Go Live + Locate preserves the full pre-act historical checkpoint as the transaction immediately beneath that return act.**

Therefore, **immediately after that return transaction**, one Back restores the pre-act historical viewpoint.

If the user subsequently performs additional effective acts, Back reverses those newer transactions first, exactly as normal stack semantics require.

The historical checkpoint remains reachable; it is not necessarily forever “one Back away.”

---

# A-04 — The action-authority matrix cannot expand Stage 4 spatial authority

The candidate action-authority matrix is accepted as an **integration matrix**, not as a new definition of Stage 4 landing mechanics.

In particular, cells that mark `MC.depth`, `IF_ref`, or contextual appearance as `D` or `C` for:

- Return to Live Focus;
- Go Live + Locate;
- Direct spatial jump;
- Cross-context navigation;
- explicit contextual choice;

must be read as:

> **only to the extent already authorized by the exact frozen Stage 4 primitive / landing contract being invoked.**

Stage 5.5 freezes:

- whether time may change;
- whether spatial movement is permitted;
- whether the action is one-shot/composite;
- legitimacy/locatability guards;
- transaction boundaries;
- return/history semantics.

Stage 5.5 does **not** newly decide that every spatial locate:

- changes Semantic Zoom depth;
- changes `IF_ref`;
- creates an inspection;
- or adopts a particular landing-depth policy.

Examples:

- Return to Live Focus may mutate only the `MC` components that the frozen Locate behaviour is already entitled to mutate.
- A “direct spatial jump” that is purely camera navigation must not be converted by this matrix into inspection merely because the matrix shows an `IF_ref` mutation for an object-oriented jump case.
- Cross-context navigation may change the inspected contextual appearance where that is the frozen action semantics, but Stage 5.5 does not generalize that to every spatial navigation.

Canonical boundary:

> **Integration may constrain an upstream primitive; it may not silently enlarge that primitive's authority.**

---

# Accepted Stage 5.5 Core

Subject to A-01…A-04, the following candidate directions are APPROVED and FROZEN:

1. The five orientation dimensions — temporal, spatial, inspection, live, return — remain independently legible concepts.
2. `Ω` is an explanatory reading of frozen state, not a new canonical state object.
3. No new member is added to `S`; no third temporal mode exists.
4. Back, Original Inspection, Live Head, Live Focus, World and Go Live + Locate remain distinct actions with distinct authority.
5. Every RH temporal restoration normalizes to `PINNED(capturedTC)`.
6. `capturedTM` remains provenance only.
7. Passive Live commits, LF updates, projection re-resolution and Preview do not write RH.
8. One explicit effective user act yields at most one RH transaction under frozen atomicity.
9. Effective no-ops yield no RH transaction.
10. Mode differences count as effective state differences even at equal temporal coordinates.
11. Return to Live Focus binds `LF*` at activation and evaluates its locatability at settle.
12. Return to Live Focus does not chase later Live Focus changes and creates no persistent follow.
13. A committed action cancels Preview first; Preview writes no RH and cannot become a silent commit.
14. A later human contextual choice required by a multi-locus result is a separate explicit transaction.
15. Return to Live preserves the pre-act historical checkpoint; Back can unwind it normally.
16. `IF_ref` remains exact while `IF_render` is independently re-resolved against historical truth.
17. Projection unavailability alone never moves the camera and never writes RH.
18. A temporal commit without locate intent does not auto-pan or silently change inspection reference.
19. Historical Live evolution does not hijack `TC`, `MC`, `IF_ref`, or `RH`.
20. Historical inspection does not freeze actual Live truth.
21. Cross-context navigation preserves canonical identity and creates no ownership/relation.
22. An unavailable historical context cannot fabricate a landing or silently move time.
23. Sparse historical orientation preserves camera and historical state.
24. Mobile/narrow projection preserves identical canonical return semantics.
25. The same mixed RH chain unwinds in the same semantic order across device projections.
26. No final wording, motion, styling, iconography, implementation scheduling, runtime or database architecture is frozen here.

---

# OPEN-18 / OPEN-19

Both proposed OPEN items are accepted as **non-blocking**.

## OPEN-18 — Inspection-reference vs rendered-version legibility

Retain.

The semantics are frozen:

- `IF_ref` may remain R2;
- default historical Map projection may legitimately display then-current R1;
- this is not silent rebinding.

Only the later Experience solution for making this divergence legible remains open.

## OPEN-19 — Transient no-op acknowledgement form

Retain.

The semantics are frozen:

- a true no-op writes no RH;
- any acknowledgement is transient and non-navigational.

Its eventual presentation remains open.

---

# Proof Status

## Proof Board A

**ACCEPTED as architectural proof scaffolding**, with these interpretive corrections:

- the displayed `Φ` banner is read as `Φ_eff` for effective-change reasoning;
- RH rows are interpreted through `C_RH` + `RestoreTemporal`, not literal component-for-component tuple restoration;
- the transaction ledger's no-op conclusions remain valid under A-02;
- any spatial depth/inspection mutations shown are examples bounded by the frozen Stage 4 primitive, per A-04.

## Proof Board B

**ACCEPTED as adversarial proof scaffolding**, with candidate statements equivalent to F-04 read through A-03.

No visual styling, color, typography, layout, or wording on either board is canonical.

---

# Remaining OPEN Items

Inherited and still DEFER:

- OPEN-02
- OPEN-06
- OPEN-08
- OPEN-09
- OPEN-10
- OPEN-12
- OPEN-13
- OPEN-14
- OPEN-15
- OPEN-16
- OPEN-17

Stage-5.5-specific:

- OPEN-18 — inspection-reference vs rendered-version legibility
- OPEN-19 — transient no-op acknowledgement form

No additional OPEN item is required by this addendum.

---

# Final Status

## Stage 5.5 — Temporal Orientation + Return + Edge-Case Integration v1

**APPROVED / CLOSED / FROZEN**

The canonical Stage 5.5 record is:

1. `QANDEEL_STAGE5_5_CANDIDATE_PACKAGE_v1`
2. this `QANDEEL_STAGE5_5_ARCHITECTURE_FREEZE_ADDENDUM`

No repository implementation is authorized by this freeze.
