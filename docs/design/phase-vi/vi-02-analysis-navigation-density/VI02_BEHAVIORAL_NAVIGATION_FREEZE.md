# QANDEEL — VI-02 · BEHAVIORAL / NAVIGATION FREEZE

**Canonical.** This document is the frozen behavioural and navigation contract for the
QANDEEL analysis surface when more than one peer reading exists.

- **Phase:** VI — Final Visual Design + Design Systemization
- **Task:** VI-02 — Analysis Navigation & Density Scalability
- **Closure task:** VI-02-FREEZE-01
- **Status:** `VI-02 — CLOSED / FROZEN AS BEHAVIORAL + NAVIGATION ARCHITECTURE`
- **Final visual morphology:** **NOT FROZEN. OPEN. Carried into VI-03.**

---

## 0. What altitude this freeze is written at

VI-02 froze **what is true for the reader**. It did not freeze what the reader looks at.

The exploration proved its case with a prototype whose peers are drawn as full-width
vertical rows. **The row is evidence. It is not the product.** Every clause below is
deliberately written without naming a shape, a widget, a direction or a material, so that a
freeze of behaviour cannot be misread as a freeze of form.

The behavioural reference architecture is **F3 — «الفرش ثم التركيز» · Overview ⇄ Focus**.
F2 — «قراءة مركّزة + مختار الأقران» · Focused Reading + Equal-Peer Chooser — is recorded as
the evaluated runner-up for provenance only, and is **not** the frozen primary architecture.

---

## 1. The frozen clauses — F-01 … F-12

### F-01 · The set precedes the reading

When more than one peer reading needs selecting, the reader encounters the whole available
set before any reading is system-foregrounded. No reading is foregrounded until a reader
raises it.

### F-02 · No system-selected winner

Nothing is pre-staged, pre-opened, pre-scrolled-to, recommended, ranked, scored, graded or
ordered by relevance. **A default the reader did not choose is a rank.** There is no
primary, strongest, best, most-relevant or recommended peer.

### F-03 · Peers are equals, and are said to be

Peers are equal and unranked. The equality is stated **in words** on every choosing surface,
and reaches assistive technology as words — never as arrangement alone.

F-03 does not mandate a sentence per surface. Equality must reach the reader in words; where
and how those words sit — a header line, a spoken description, a persistent caption — is
open, provided assistive technology receives the same statement.

### F-04 · Every exposed peer is reachable

Every peer the product exposes remains reachable **and** discoverable. Reachable means usable
*and* findable: no peer may exist only behind an affordance the reader must already know
about.

### F-05 · The statement is the canonical identity source *(corrected — C1)*

> **The full statement is the canonical human-facing identity source for a reading under the
> current runtime. A derived title, excerpt, ordinal, letter, position, machine ID, or
> set-relative fragment must never be the sole human-facing discriminator on a choosing
> surface. Compact excerpts may exist only as clearly secondary references/pointers when the
> full statement is reachable under F-06 without commitment.**

This binds the accessible name exactly as strictly as the visible text: no `aria-label`,
`aria-labelledby` or equivalent may substitute an excerpt for the statement on a peer.

Preserved without qualification:

- **no ordinal identity** — no numbering, no first/second/last, no `aria-posinset` /
  `aria-setsize` used as identity;
- **no position identity** — identity may not be derived from where a reading sits;
- **no user-visible machine ID** — no UUID or internal identifier on a human surface;
- **no fake set-relative disambiguation** — identity that changes when the peer set changes
  is identity derived from position, and is forbidden;
- **accessible identity truth** — what a sighted reader can determine and what assistive
  technology is told must be the same truth.

**F-05 is not a ban on all excerpts.** A compact reference — a role line, a cross-reference,
a pointer from elsewhere in the product — may carry an excerpt, provided it is clearly a
pointer, is honest about being opening words rather than an identity, and lands on the
reading. What F-05 forbids is an excerpt (or any derived fragment) being *the* thing a reader
must use to tell two peers apart while choosing.

**A future runtime-supplied label is not permanently banned.** It remains
**`DEFERRED POSSIBILITY — NOT REQUESTED`**, subject to its own future contract and its own
review. See F-12 and `VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md`.

### F-06 · Identity is reachable without commitment

Wherever a reading is represented by less than its whole statement, the reader must be able
to reach the whole statement **on that surface** — without foregrounding it, without choosing
it, without dismissing the choosing surface, and without losing their place.

*Inspecting a reading is not choosing it.* This is the clause that lets a presentation
abbreviate at all, and the clause that makes the runtime-sufficiency verdict survive the
hardest identity case on record (`VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` §3).

**F-06 does not mandate a text link.** A per-row disclosure control satisfies it today; a node
that opens in place, a preview that expands within a spatial field, or a composition that
never abbreviates at all would satisfy it equally. **The rule is frozen; the mechanism is
not.**

### F-07 · Reader-chosen foreground is reversible

Foreground follows a reader's act, and that act is undoable. Returning to the whole set
restores it as it was left and **recomputes nothing**.

F-07's "restores" is a behavioural promise. It says nothing about whether the change is drawn
as an instant swap or as a movement.

### F-08 · Return is always available, and names its destination

The route back to the whole set is present the entire time a reading is foregrounded, and it
names where it goes. The return route is the architecture's spine and may never disappear.

### F-09 · Orientation is not currency

Restoring scroll position and keyboard focus to the reading a reader last opened is
**orientation**. It must never be expressed as `current`, primary, selected, active, or
ranked — not visually, and not to assistive technology. A surface that foregrounds nothing
must expose no current peer, including in its URL state.

A surface that *does* have an actual foregrounded reading (as F2 does) may legitimately state
that state — in words the sighted reader can see and in the matching accessible state, saying
the same thing through both channels.

### F-10 · Deep links land on the reading, with the return route intact

Any external route into a reading — a role line today, a conversation link later — may land
directly on that reading, focused and announced after arrival, **only** with the whole-set
return route intact.

### F-11 · Bilingual and assistive parity is part of the architecture

Everything above holds identically in Arabic RTL and English LTR at 375px, by keyboard, and to
assistive technology. Direction is expressed logically (forward/back), never as left/right.
Parity is a property of the frozen architecture, not a later remediation pass.

### F-12 · No new runtime contract is required *(scoped — C3)*

> **No new runtime contract is required to freeze and later implement the currently validated
> Overview ⇄ Focus behavioral architecture for the tested current-data cases, including
> late-divergence peers, provided full-statement identity remains reachable without
> commitment. This is not a permanent prohibition on future runtime evolution.**

Explicit carry-forward:

- persistent chip-scale labels, voice shorthand, or future dense spatial references **may**
  justify a separate label-contract investigation later;
- **no label contract is requested now**;
- F-12 is scoped by the exact-duplicate exposure precondition in
  `VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` §3 (C2).

---

## 2. The rule that governs everything the freeze leaves open

> **A visual relationship may be drawn only if it is true of the runtime.**

Grouping asserts that things belong together. A line asserts a relation. A weight asserts
strength. A direction asserts influence. A number asserts a quantity. Motion asserts that
something changed. Each of those is a claim, and QANDEEL may make it only where a record
supports it.

**The gate is truth, not restraint.** This rule is what separates real design intelligence
from invented authority; it does not license timidity, and it is not a reason to leave a
surface unstructured.

---

## 3. What this freeze explicitly does NOT freeze

Binding. Stated at length in `README.md` §"What VI-02 does NOT freeze" and in
`VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md`. In summary: **the entire visual morphology.**

Vertical rows · paragraph-heavy presentation · the prototype's white styling · cards · the
number of visible lines · final set morphology · final small-count composition · typography ·
colour · surfaces and materials · iconography · brand expression · motion · generative
graphics · final density styling · search / filter / jump behaviour · visual anchors ·
spatial field · circles and grouping · relation threads and lines · transformation and
recomposition animation.

None of these is settled by F-01…F-12, and none may be inferred from the prototype that
proved them.

---

## 4. What would reopen this freeze

Stated so the freeze is falsifiable rather than merely asserted:

- a runtime change or exposure path that makes two readings indistinguishable to a human even
  with their whole statements shown (F-05/F-06 would need rework — the *drawing* would not);
- evidence from live screen-reader validation that whole-statement peer names are unusable at
  24–32 peers in a way no presentation can fix
  (`VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` §5);
- a truth bug in Phase V or VI-01 that changes what a reading *is*;
- a decision to expose a relation the runtime does not currently record, which needs its own
  task, its own runtime evidence and its own review before any line is drawn.

**Ordinary visual dissatisfaction with the prototype's appearance is not grounds to reopen
this freeze.** That is precisely what §3 is for: the appearance was never frozen.
