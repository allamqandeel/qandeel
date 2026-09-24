# START HERE — QANDEEL_STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v2

**Stage 6.4 — Motion + Accessibility + Responsive Experience Contract** · corrections applied, for final Architecture review · 2026-09-03

**Stage 6.4 is not declared frozen by this package.** No frozen Stage 0–5 / 6.1 / 6.2 / 6.3 semantics were reopened, no new canonical state member was introduced, no platform accessibility role was frozen, OPEN-06/08/09/19 were not revived, no repository file was touched, no code was written. v1 is preserved intact.

---

## The correction that matters

**My v1 AX4-06 proof was insufficient, and Architecture's objection is correct.** With a bounded maximum repeat rate, repeated one-Moment advancement remains **proportional to `n`** once the cap is reached — acceleration improves the constant factor, not the order. And the direct routes I cited (Return to Live Head, `Back`, Exact Return, visible targets) do **not** reach an arbitrary distant **already-disclosed** Moment that lies outside the window and was never visited. `rate, not unit` is the right rule for *semantic traversal*; it simply cannot carry AX4-06 alone.

**The fix uses a mechanism that was already frozen and had gone unused.** Stage 6.2 froze **windowing** as presentation-only. So v2's reach grammar has **two independent axes**:

| Axis | What it moves | Semantics |
|---|---|---|
| **A — temporal traversal** | the temporal cursor | one Moment per advancement; held duration-based acceleration; the **only** route past `TC`, where disclosure is earned |
| **B — window navigation** *(new)* | the presentation viewport | **no `TM`, no `TC`, no `PTC`, no `RH`, no Moment chosen, no temporal unit named**; stops at the disclosure horizon |

Long-distance movement through already-disclosed material is **B, then direct selection**. **Why it is not OPEN-08: a screenful of *window* is a quantity of presentation; a screenful of *cursor* would be a quantity of time.** The worked trace is §32.1 (REV64-AT-01: 10,000 Moments, `TC = m9000`, target `m500`).

## The other five corrections

| | Change |
|---|---|
| **REV-64-02** | **Responsive recomposition alone never cancels Preview.** `PTC`, target identity, `TM`/`TC` and `RH` all survive; the same target is re-mapped. Only a genuine **input-stream cancellation** cancels it — an input event, not a layout rule. IN-10 splits into **IN-10A / IN-10B / IN-10C**; X64-06 splits into **A/B**. |
| **REV-64-03** | The topology is narrowed from "bounded range over the disclosed region" to a **platform-neutral disclosed-region *target navigator***. **AXT-03** now forbids quantity/membership metadata **whose value depends on undisclosed material**, rather than all quantity. A range implementation needs a 6.5 metadata-compatibility proof. |
| **REV-64-04** | SC 2.5.7 requires **an** equivalent, not held activation specifically. QANDEEL *selects* held activation. |
| **REV-64-05** | Pausable **presentation** ≠ pausable Live. `LH`, committed events, ingestion and analysis keep advancing; resume resolves to current truth without replaying intermediates. |
| **REV-64-06** | Pointer cancellation is a **default with two models**: up-event abort for discrete actions; continuous Preview may begin on pointer-down with commit on release. No down-event may commit irreversibly. |

## What did not change

All six approved directions carry forward verbatim: **M4-A empty** · semantic state independent of animation progress · **immediate historical resolution** with no ghost, no cross-fade, no relation persistence, no lifecycle rewind, no camera drift · one-Moment traversal · held duration-based acceleration · interruption as presentation-level · chrome recomposes while canonical Map geography does not.

**Note the direction of both load-bearing corrections: each *removes* an over-claim.** Neither added product surface.

## What Architecture should scrutinise first

1. **§21 and §32.1** — the claim that RE-ζ moves presentation rather than time. That distinction carries the whole correction.
2. **RE-10** — the horizon boundary that stops window navigation from becoming a disclosure route.
3. **AXT-02 / AXT-03 as narrowed** (§16).
4. **RC-P3 / RC-P3a and IN-10A/B** (§24, §25) — whether "input-stream termination" is tight enough to implement.
5. **Unchanged but load-bearing:** M4-A empty (§6) and immediate historical resolution (§9).

## Reading order

1. **§0** — the v2 change note and the Stop-Rule check run *before* applying.
2. **§19–§21** — the two-axis reach grammar and the corrected AX4-06 argument.
3. **§32.1** — the REV64-AT-01 worked trace.
4. **§14–§16** — the narrowed topology.
5. **§24–§25** — RC-P3/RC-P3a and the Interruption Matrix with IN-10A/B/C.
6. **§29–§32** — all test results, with **[re-run v2]** markers.
7. **§40** — Stop-Rule table and handoff.

## Contents

| File | What it is |
|---|---|
| `STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v2.md` | The corrected candidate — §0 change note plus all 40 sections and the Decision Index. |
| `boards/S6.4_A_Motion_and_Interruption.png` | Board A — updated for the **IN-10A/B/C** split; otherwise the approved motion evidence. |
| `boards/S6.4_B_Accessibility_and_Reach.png` | Board B — rebuilt: the narrowed topology, the **two reach axes with the REV64-AT-01 trace**, the corrected four-clause AX4-06 table, window navigation in the parity table, and the Preview-preservation row. |
| `SHA256SUMS.txt` | Integrity checksums, POSIX-style paths, no BOM. |

Both boards are rendered at `motion = 0`, so MA-01 and MA-02 remain the rendering itself.
