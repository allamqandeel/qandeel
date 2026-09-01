# QANDEEL — VI-02 · DENSITY & SCALABILITY FINDINGS

**Canonical findings. Not frozen UI metrics.**

Every number in this document was measured on a **throwaway row drawing** whose only job was
to prove that peers stay reachable, equal and identifiable at scale. The numbers say what that
provisional drawing costs. They say nothing about what a designed surface must cost, and
**none of them is a frozen metric.**

- **Task:** VI-02 — Analysis Navigation & Density Scalability
- **Closure task:** VI-02-FREEZE-01
- **Measured:** real headless Chrome, inside a **true 375×812 viewport**, Arabic and English

---

## 1. The honest reassessment

The exploration's first evaluation matrix scored scanability **strong** at 6, 12, 24 and 32
peers. That score was earned by **reachability** — every peer present in one scrollable set —
and was then reported as **scanability**. The review corrected it.

Re-scored (● strong · ◐ adequate · ○ weak):

| Criterion | F2 (was → now) | F3 (was → now) |
|---|---|---|
| Scanability at 6 | ● → **●** | ● → **●** |
| Scanability at 12 | ● → **◐ adequate** | ● → **◐ adequate** |
| Scanability at 24 | ● → **◐ adequate** | ● → **◐ adequate** |
| Scanability at 32 | ● → **○ weak** | ● → **◐ adequate (low end)** |
| Speed of finding a known peer | ● → **◐** | ● → **◐** |
| Duplicate resilience | ● → **◐** | ● → **◐** |

The re-score did not change the recommendation — F3 remains the behavioural reference and F2
the runner-up, because both families move together and F3 moves less. It changed what a freeze
is allowed to **claim**:

> This architecture is proven **scalable and identity-safe** to 32 peers. It is **not proven
> pleasant to scan** at 32, and no document may imply that it is.

---

## 2. What the tested row prototype actually held

**Around four peers per 375×812 viewport**, plus a fifth partly visible — at every count above
five, in both languages, in both families. That number is set by the four-line preview and
Arabic's line-height, **not by the architecture**, and it does not improve with N.

Extra screenfuls of travel to sweep the whole set once (Arabic / English):

| n | F3 — Overview (page scroll) | F2 — Chooser (dialog scroll) |
|---|---|---|
| 2 | **0 / 0** — the whole set on one screen | **0 / 0** — the whole set in the box |
| 3 | **0 / 0** — the whole set on one screen | **0 / 0** — the whole set in the box |
| 6 | 0.33 / 0.40 | 0.36 / 0.50 |
| 12 | 1.32 / 1.56 | 1.62 / 1.89 |
| 24 | 3.29 / 3.77 | 3.99 / 4.63 |
| 32 | **4.70 / 5.25** | **5.65 / 6.52** |

**F2 is consistently worse on travel than F3.** Its chooser scrolls inside a dialog box of
about 615 usable pixels behind a sticky head; F3's overview scrolls the 812px page the reader
already stands on. At 32 peers that is 5.65–6.52 extra screenfuls against 4.70–5.25 — and F2's
box cannot be left partly scrolled while the reader thinks. That is why F2 is scored **weak**
at 32 where F3 is a low **adequate**.

**A measurement correction worth keeping:** for a chooser, the scrolling box is the **dialog**,
not the list inside it, and a sticky head must be subtracted. Measuring the inner list reported
"every peer fully visible, zero travel" at 32 — an unearned *strong*. A peer behind a sticky
header is not scannable.

---

## 3. Where scanning is actually hardest

Not at the adversarial edge — at the **normal case**.

The four-line preview held roughly 170–185 characters. Readings about one subject open with the
same frame by nature. When several peers share an opening, the reader is scanning four peers at
a time whose *visible* halves are near-identical, and the divergence may sit past the cut
(proven — `VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` §3).

F-06's disclosure makes those peers separable, but **each reveal makes the set longer**. So
resolving ambiguity and reducing travel are in **direct tension**. Scanning is hardest exactly
where a set is most crowded with related readings — which is the ordinary case, not the
adversarial one.

**This is the finding VI-03 most needs to carry.**

---

## 4. Why "adequate" is still freezable

Because nothing **degrades structurally** between 2 peers and 32.

Every peer stays present, reachable, equal and identifiable; the return route is constant;
targeted switching costs the same two reader-steps at any N. **What grows is distance, not
brokenness.** A freeze of behavioural architecture can absorb "adequate scanning"; it could not
have absorbed "some peers become unreachable" or "identity fails at scale", and neither
happens.

---

## 5. Low counts — n = 2 and n = 3

At two and three peers the whole-set surface is **not a menu of things to read — it is the
reading, plural.** Every statement fits whole (nothing is cut, so no disclosure control is even
offered), each with its record date, under the subject anchor and the equality sentence. Zero
extra screenfuls. A reader who never activates anything has still read the analysis's
substance.

**A gate you can read through is not a gate.** That is the honest answer to the toll-gate
objection against entering on the set.

The cost is real and small: one activation still stands between entry and any single reading's
*depth*. At n=2 that is the least defensible it will ever be, and it is paid to keep the clause
that is the architecture's whole case — no reading is foregrounded that the reader did not
choose.

There is also a **rhythm cost** that measurement does not capture: at n=2 the tested drawing is
two paragraphs in a large empty screen with a hairline between them. It is honest, it is
readable, and it is **inert**. It does not look like an intelligence organising something —
which is precisely the quality
[`VI02_LEGACY_ANTI_REGRESSION_GUARDRAIL.md`](VI02_LEGACY_ANTI_REGRESSION_GUARDRAIL.md) flags as
at risk.

**Verdict: useful content, not a toll gate — but the least-composed surface in the
architecture, and the one most in need of VI-03's attention.**

---

## 6. What is NOT frozen by this document

**None of the measured numbers.** Four-peers-per-screen, the 170–185 character preview, the
screenful counts, the row height spread, the preview length, the four-line clamp itself — all
are properties of one provisional drawing.

VI-03 is free to change every one of them: shorter previews with a denser rhythm, a spatial
field, columns, grouping that carries no rank, anchors that let the eye find its place before
reading everything, a composition that never abbreviates at all. **That freedom is worth more
than any score in the table above.**

**Small-count composition is explicitly open.** VI-03 may compose two or three peers
differently from twelve or thirty-two — side by side, as facing columns, as a single composed
field, with basis or shared-record material brought forward, with relational marks between
them, or with motion that assembles the pair on arrival — **provided the frozen semantics
hold**: no system-selected winner, no rank, no ordinal identity, every peer equally present and
equally reachable, foreground only after a reader's act, and every visual relationship truthful
to the runtime. A small-set composition is not a second architecture; it is the same behaviour
drawn for a set that fits.

**Search, filtering, sorting, grouping, jump-to and sticky indexes remain open.** They are
neither frozen in nor frozen out. VI-02 did not invent them because each would be either a new
navigation system or a visual composition decision — both of which belong to a later phase, not
to a density proof.
