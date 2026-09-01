# QANDEEL — VI-02 · RUNTIME DEPENDENCY & EDGE BOUNDARIES

**Canonical.** What VI-02 asks of the runtime (nothing), how far that answer reaches, and the
one exposure edge that must be investigated separately before it can ship.

- **Task:** VI-02 — Analysis Navigation & Density Scalability
- **Closure task:** VI-02-FREEZE-01
- **Governs:** clause F-12 of
  [`VI02_BEHAVIORAL_NAVIGATION_FREEZE.md`](VI02_BEHAVIORAL_NAVIGATION_FREEZE.md)

> **This document changes no runtime, schema, migration or database contract, and requests
> none.** It records a design verdict about existing data and states one precondition on a
> future implementation.

---

## 1. The question

Does solving analysis peer navigation at 1 → 32 peers require new runtime-supplied data —
specifically a short reading identity label — or is current data sufficient?

## 2. Verdict A — `NO NEW RUNTIME CONTRACT NEEDED` *(scoped — C3)*

> **No new runtime contract is required to freeze and later implement the currently validated
> Overview ⇄ Focus behavioral architecture for the tested current-data cases, including
> late-divergence peers, provided full-statement identity remains reachable without
> commitment. This is not a permanent prohibition on future runtime evolution.**

### 2.1 The evidence chain

1. The only guaranteed, human-language, per-reading field is `statement`.
2. Chip-scale derived labels **fail mechanically** on identical-opening peers in both
   languages — proven at 40, 60, 80, 160 and 240 characters. They separate only at a length
   that is no longer a label.
3. The validated architecture and its runner-up **never need a chip-scale label**: everywhere
   a reader answers "which reading is this?", the statement itself is present — whole, or
   abbreviated with the whole text reachable **without commitment** (F-06).
4. Both were proven against the density matrix (1–32), Arabic RTL and English at a true 375px,
   adversarial duplicate / thin / long / mixed content, and the structural accessibility bar,
   using fixture data shaped exactly like current runtime records and nothing else.
5. The families that *would* have needed a label to work — a persistent chip rail, a scaled
   pager — failed the evaluation for independent structural reasons. A label contract would not
   have rescued them.

### 2.2 Tested against the hardest case, not merely asserted

The late-divergence pair is the case that could have broken verdict A: two readings identical
for 262 (AR) / 336 (EN) characters, with identical record date, type, domain and scope, no
assumptions and no review conditions. **Every existing field either collides or is
machine-only.**

It resolved **without** a new field, because what the sighted reader lacked was space, not data
— and F-06 supplies space on the choosing surface without committing anything.

A short label would not have solved this case anyway. Two readings sharing 262 characters share
their subject, their frame and their opening claim; any label short enough to *be* a label
would be derived from that shared material and would collide too. The only label that separates
the pair is one carrying the divergence — i.e. a set-relative label (structurally dishonest and
rejected) or the whole statement (which is not a label). **The hardest case argues for the
current data, not against it.**

### 2.3 The scope of the sufficiency claim

Sufficiency is scoped to architectures whose identity surfaces **carry the statement itself and
can reach it in full without commitment.** The second clause is load-bearing: an architecture
that shows an excerpt with no non-committing route to the whole text **does not inherit this
verdict.**

---

## 3. The exact-duplicate boundary *(C2 — binding)*

> **VI-02 does not assume that full statements are globally unique across all valid Hypothesis
> records. Exact human-facing duplicates must never be cosmetically disambiguated with
> ordinals, letters, UUIDs, rank, or invented labels. If a production exposure path can surface
> materially distinct records whose human-facing identity is indistinguishable even with the
> full statement shown, that exposure requires a separate truth/runtime/product-contract
> investigation before shipping that state. VI-02 does not invent a UI distinction for data
> that does not contain one.**

### 3.1 Runtime truth at the reviewed baseline

- the controlled generation path **rejects normalized duplicate `statement + scope`** — a
  normalized collision key over statement and scope, rejecting both in-batch duplicates and
  duplicates against active hypotheses;
- `HypothesisService.create()` itself does **not** enforce a general collision/uniqueness
  invariant;
- therefore **"guaranteed distinct peers" remains forbidden** as a design assumption.

### 3.2 What must not be claimed

VI-02 does **not** claim, and no document derived from it may claim:

- that exact duplicates are impossible;
- that the statement is globally unique;
- that current data guarantees distinct human-readable peers.

### 3.3 What this is, and what it is not

This is an explicit **implementation / exposure precondition** — a condition on shipping a
state, not a defect report and not a request to modify runtime in this task. Two genuinely
identical statements remain honestly identical and must not be faked apart. If a shipping path
can actually surface materially distinct records whose human-facing identity is indistinguishable
with the full statement shown, that state requires its own truth / runtime / product-contract
investigation **before** it ships. See
[`VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md`](VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md).

---

## 4. No runtime label is designed here

**This document does not design, name, size, shape or schedule a runtime label.**

The mechanical findings above stand as evidence that **if** a later phase deliberately chooses a
persistent chip-scale reference surface — a rail, a dense cross-reference index, a voice or
realtime shorthand, or a spatial composition whose nodes must be short — current data cannot
make such references reliably distinguishing.

In that event, VI-01's standing note applies unchanged: a short reading identity label remains a
**`DEFERRED POSSIBILITY — NOT REQUESTED`**, to be investigated as its own task, with its own
runtime evidence, its own contract and its own review.

It must **never** be requested merely to make previews prettier, a composition tidier, or a
density number better. And the freeze must not be read the other way either: **F-12 is not a
permanent prohibition on future runtime evolution.**

---

## 5. Other edge boundaries carried forward

| Edge | Standing |
|---|---|
| **Statements that diverge past the field cap** | Not possible — the field is capped and the disclosure shows the whole field |
| **Two genuinely identical statements** | Honestly identical; never faked apart. Governed by §3 |
| **Compact references outside a choosing surface** (role lines, cross-references) | Permitted as pointers under F-05 §1.3; they may look alike when the readings are alike, must say they are opening words, and must land on the reading. Putting a disclosure control inside a sentence is a VI-03 visual-language decision, deliberately not taken here |
| **Deep entry into a reading** | Permitted under F-10 only with the whole-set return route intact |
| **Zero and single-peer states** | Unchanged from the frozen grammar; a single reading *is* the analysis, and there is nothing to choose |
