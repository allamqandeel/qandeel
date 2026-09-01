# QANDEEL — VI-02 · LEGACY QUALITY / ANTI-REGRESSION GUARDRAIL

**Canonical.** The legacy benchmark is a **quality and ambition floor only**. It is not a
canonical visual direction, not a style source, and nothing in it was copied.

It answers exactly one question:

> Does the VI-02 architecture preserve the *experiential ambition* of the strongest previous
> QANDEEL work while removing its rejected visual and semantic liabilities?

No aesthetic score is computed and no total is given.

- **Task:** VI-02 — Analysis Navigation & Density Scalability
- **Closure task:** VI-02-FREEZE-01

---

## 1. What the previous work was actually good at

Its strength was never its palette. It was that **the previous work treated understanding as
something with shape**: a graded expressive language where expression rises only when meaning
does; one continuous mark language across conversation → reflection → map, with a published
legend of marks that each had a stated job; a map built outward from the current understanding
in steps, moving because something changed; and a timeline that threaded several findings down
one screen as nodes on a curve, varying their rhythm, and ended on an open question.

That last one is the direct ancestor of VI-02's problem — several analytical statements, one
vertical screen — and it is manifestly **not a list.**

---

## 2. The five quality dimensions — verdicts

| Quality | Verdict |
|---|---|
| **Analytical presence** | `AT RISK — MUST BE ACTIVELY PROTECTED IN VI-03` |
| **Narrative / spatial intelligibility** | `AT RISK — MUST BE ACTIVELY PROTECTED IN VI-03` |
| **Conversation ↔ Analysis continuity** | `AT RISK — MUST BE ACTIVELY PROTECTED IN VI-03` |
| Distinct product character | `PRESERVED BY ARCHITECTURE` |
| Meaning-led hierarchy | `PRESERVED BY ARCHITECTURE` |

Nothing is `REGRESSED`. **Every at-risk quality is at risk from the *drawing* and from how a
freeze is worded — not from the behaviour.**

### 2.1 Analytical presence — `AT RISK`

The behaviour organises understanding: the whole set precedes any focus, focus is a
recomposition rather than a page, the return recomputes nothing, and every reading names what
it stands on. None of that is settings-UI behaviour.

But **nothing in the frozen semantics prevents this from being drawn as a settings list** — and
the tested prototype, honestly, is drawn as one. At two peers it is two paragraphs and a
hairline; at thirty-two it is thirty-two of them. The prototype's job was to prove scalability
and identity safety, and it did; it was never asked to have presence.

**The risk is a freeze written at the wrong altitude quietly converting "the row proved the
behaviour" into "the row is the behaviour".** That is what
[`VI02_BEHAVIORAL_NAVIGATION_FREEZE.md`](VI02_BEHAVIORAL_NAVIGATION_FREEZE.md) §3 and this
archive's README exist to prevent.

### 2.2 Narrative / spatial intelligibility — `AT RISK`

Split honestly:

- **Recomposition is preserved by the architecture.** Overview ⇄ Focus is anchor → presence →
  focus → recomposition, restoring state rather than rebuilding it.
- **Time, relation, adjacency and grouping are absent from the tested surface.** Peers are an
  undifferentiated vertical sequence in record order; the only relation drawn anywhere is the
  shared-record material inside a focused reading. The legacy's threads, brackets and temporal
  rhythm have no counterpart yet.

Their absence is not a VI-02 failure — VI-02 was scoped to navigation and density, and drawing
relations the runtime does not record would be invention. It is a **standing risk**, because the
easiest way to freeze VI-02 badly is to freeze the sequence-of-rows form that makes those marks
look like additions rather than the language they should be.

### 2.3 Conversation ↔ Analysis continuity — `AT RISK`

A single language crossing three depths — the same marks, the same voice, the same materials, so
that going deeper reads as *the same intelligence opening further* — is the quality most easily
lost here, for two structural reasons:

1. **The isolated prototype cannot demonstrate it.** Both prototypes begin at a subject anchor
   with no conversation above them. Continuity is untested, not preserved.
2. **Entering on the set adds a stage.** Where the frozen pager went conversation → reading, the
   validated architecture goes conversation → *set* → reading. That extra boundary is the price
   of the no-system-foreground argument, and it is the most likely place for the product to
   start feeling like a dashboard.

What protects it so far: deep-landing is proven, the return route is permanent, and the
vocabulary on both surfaces is the product's own rather than dashboard language. **What does not
protect it: nothing visual, yet.**

### 2.4 Distinct product character — `PRESERVED BY ARCHITECTURE`

The strongest verdict in the gate, and it depends on no drawing at all. Every comparable product
ranks, scores and summarises: a best answer, a confidence, a headline. QANDEEL's architecture
**structurally refuses all three** — no system-selected winner, no rank, no ordinal, no score,
**the reading's own human-facing statement as its identity**, and foreground only after a
reader's act.

*(A reading's statement is the record's own human-facing content. It is **not** necessarily the
user's literal wording: a Hypothesis may be `SYSTEM_GENERATED`, and nothing here implies literal
user quotation.)*

That refusal is ownable, it is a *structure* rather than chrome, and it is the one legacy
quality that **improved**: the benchmark carried percentages, graded relations and numbered
badges, all of which asserted authority the runtime never had.

### 2.5 Meaning-led hierarchy — `PRESERVED BY ARCHITECTURE`

The legacy stated the rule; VI-02's revision enforced it three times: an emphasis that did not
follow meaning was removed; a name that did not follow content was replaced by the content; and
the one new affordance appears **only where meaning is actually being cut** (in the validated
prototype, detected from live layout — one proven method, not a frozen one). Emphasis follows
meaning and reader action. Nothing is emphasised decoratively.

---

## 3. Legacy elements explicitly NOT restored

None of the following appears in the VI-02 work, and none may be reintroduced as QANDEEL's
language:

| Rejected legacy element | Present? |
|---|---|
| Automatic dark-purple + brass/gold as QANDEEL's language | **no** |
| Glow everywhere | **no** |
| Particles / decorative stars | **no** |
| A physical lantern outside the Authentication Gateway | **no** |
| Numeric confidence percentages | **no** |
| Graded `strong / medium / weak` relationship claims | **no** |
| Numbered node badges as meaning | **no** |
| Fixed life-domain maps | **no** |
| Unsupported causal arrows | **no** |
| Sci-fi / HUD spectacle | **no** |
| Generic card overload | **no** |
| Any visual fact the runtime does not support | **no** |

Relation direction words are permitted where a relation is recorded; **relation strength grades
are not**, because the runtime does not carry strength.

---

## 4. The finding that matters most for VI-03

**The legacy's spatial density was bought with labels no existing runtime field supplies.**

The legacy mobile map fits nine related nodes and their connections onto one 375px screen —
genuinely more legible-at-a-glance than four peers per screen with five screenfuls of travel.
But it achieves that by reducing each node to **two words** drawn from a life-domain taxonomy
**the product invented**, and by grading the connections between them. Neither the labels nor
the grades exist in the runtime. **The compression is not craft; it is a claim.**

QANDEEL's real records are long human-facing statements, with no label, no title and no summary —
and **excerpt-derived** labels short enough to sit in a node were proven mechanically to collide
on the **tested late-divergence peers**, which are valid, plausible related peer readings rather
than an artificial edge case. That is the scope of the finding: it is a result about excerpt
derivation on realistic related peers, not a proof that no short label of any kind could ever
work. See
[`VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md`](VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md)
§2.2.1.

So the honest comparison is not "the legacy was denser, VI-02 regressed". It is:

> The legacy bought density by asserting a taxonomy. VI-02 refuses the assertion and pays for it
> in vertical distance. **Recovering that density honestly is VI-03's real problem** — and it is
> solvable, because the constraint is not "statements must be shown as rows". The constraint is:
> *wherever a reading is represented by less than its statement, the whole statement must be
> reachable there without committing to it.*

A per-row disclosure control is one instance of that rule. **A spatial composition whose nodes
open in place would be another.** That is the bridge between the legacy's ambition and the
runtime's honesty, and it is written into the freeze as a **permission, not a requirement**.

---

## 5. The standing instruction to VI-03

The three `AT RISK` qualities — **analytical presence**, **narrative / spatial
intelligibility**, and **conversation ↔ analysis continuity** — must be **actively protected in
VI-03**. They are not protected by the frozen behaviour; they are protected only by what VI-03
draws.

Protecting them means investigating meaningful graphic and spatial structure on its merits, not
adding decoration. The governing rule remains:

> **A visual relationship may be drawn only if it is true of the runtime.**
