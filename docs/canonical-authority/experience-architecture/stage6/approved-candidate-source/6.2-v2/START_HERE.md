# START HERE — QANDEEL_STAGE6_2_TIMELINE_COMPLETION_CANDIDATE_v2

**Stage 6.2 — Timeline Interaction + Legibility Completion** · corrections applied, for final Architecture review · 2026-09-03

**Stage 6.2 is not declared frozen by this package.** No frozen Stage 5 semantics were reopened, no new semantic rule was invented, no repository file was touched, no code was written. Research was approved and not repeated; v1 is preserved intact alongside this package.

---

## The correction that matters

**v1 held the post-`TC` firewall by making later Moments unreachable from the Timeline. That was wrong.** Stage 5.3's post-`TC` rule is a **disclosure** firewall, not a navigation-coordinate prohibition, and frozen Stage 5 explicitly permits Preview to move to a later `PTC`. v2 restores navigation without restoring disclosure.

**How:** forward navigation past `TC` is **relative, never positional**. Input magnitude maps to a **count of single-Moment increments** applied to the prospective `PTC`; each increment discloses exactly one further step, appended at the constant step. At rest the Track shows `m0…TC` and nothing else.

**Why that closes the leak:** *relative mapping needs no extent to map onto.* There is no future coordinate space to lay out, so navigation can be unbounded while disclosure stays bounded. A user learns what lies beyond `TC` only by going there — which is the same truth committing there would legitimately give them (S5-TL-03). Reaching `LH` is **arrival**, not a disclosed bound.

**Why it is not coarse stepping:** the unit is always **one Moment** — the frozen ±1 adjacency. Input magnitude *repeats* the unit; it never enlarges it, and no coarser unit is defined, selectable, or exposed.

## The other three corrections

| | Change |
|---|---|
| **REV-02** | `LIVE_EDGE` is no longer a step after `Moment(LH)`. It is an **outboard non-metric Live control** anchored to the same Live boundary, consuming no ordinal distance. **Co-temporal, intent-distinct; affordances may be spatially distinct.** v1's version manufactured temporal distance the frozen semantics do not have. |
| **REV-03** | The accessibility conclusion is narrowed. Frozen: the **epistemic constraint**, plus the incompatibility of a **single full-session** range control while `PINNED`. **Not** frozen: "range topology is structurally unavailable" — restricted-region and `FOLLOW_LIVE` range semantics remain 6.4's to decide. No ARIA role is frozen. |
| **REV-04** | WCAG 2.5.8 is removed from the scale justification and from the contract. Pointer-target sizing is 6.4's; no per-Moment pixel target is canonical here. |
| **REV-05** | Timestamp wording narrowed: *the Stage 6.2 Timeline contract creates no new requirement to retain Moment timestamps **solely for Track geometry***. It no longer claims v1 has no timestamp obligation at all. |

## What is preserved

All three approved directions stand: **ordinal constant-step metric** for disclosed committed Moments; **no aggregation in v1** (now with the ruling's seven conditions proved in §17.1 — condition 6, post-`TC` navigation, is the one the correction changed from fail to pass); and **targets express temporal address while explicit acts express temporal-only vs Temporal+Locate intent**, as one user act and one `RH` transaction.

## Mandated re-runs — all PASS

DT-01, DT-02, DT-03, DT-06, DT-11, DT-13 · X-01, X-02, X-05, X-09 · X-10 re-evaluated after the board rebuild · **REV-AT-01** added, with a worked trace in **§24.1** (`LH = 100`, `TC = 40`, `PINNED(40)`). No other test's premises changed.

**REV-AT-01 against v1 would have FAILED** on "navigation is possible" — which is exactly why the correction was necessary rather than cosmetic.

## Reading order

1. **§0** — the v2 change note and the Stop-Rule check run *before* applying.
2. **§8 TL-16…TL-19** — the post-`TC` navigation contract.
3. **§24.1** — the REV-AT-01 worked trace.
4. **§10** — the three layers, with the relative mapping now explicit.
5. **§12 E-01 and §11** — the outboard Live control, and why E-γ was withdrawn.
6. **§17.1** — the seven no-aggregation conditions.
7. **§21** — the narrowed accessibility conclusion.
8. **§32** — Stop-Rule table and handoff.

## Contents

| File | What it is |
|---|---|
| `STAGE6_2_TIMELINE_COMPLETION_CANDIDATE_v2.md` | The corrected candidate — §0 change note plus all 32 sections and the Decision Index. |
| `boards/S6.2_A_Scale_and_Live_Edge.png` | Board A, rebuilt — scale, the two modes, the **co-temporal** case with the break glyph and `OUTBOARD · NON-METRIC` label, Live advance, the firewall **at rest**, and the **REV-AT-01 forward-traversal sequence**. |
| `boards/S6.2_B_P3a_and_Density.png` | Board B, rebuilt — the two acts as **one act, one transaction**, locus outcomes, no-aggregation under dense structure, pinned state with forward navigation preserved, per-act input equivalence. |
| `SHA256SUMS.txt` | Integrity checksums. |

Boards are Experience proof scaffolding, **not art direction** — rendered without decorative styling, which is X-10 and part of the evidence.
