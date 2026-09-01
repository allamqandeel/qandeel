# QANDEEL — VI-02 · OPEN ITEMS & VI-03 CARRY-FORWARDS

**Canonical.** What VI-02 deliberately left open, and who owns each item next.

Nothing in this list is a defect. Each entry is a decision VI-02 was not scoped to make, or a
question its evidence could not honestly answer.

- **Task:** VI-02 — Analysis Navigation & Density Scalability
- **Closure task:** VI-02-FREEZE-01
- **Next task:** **`VI-03 — Visual North Star + Graphic Language`**

---

## 1. Final visual morphology — OPEN

**The single most important item in this archive.**

VI-02 froze behaviour and navigation. **It did not freeze what any of it looks like.** The
following are all open and carried into VI-03:

vertical rows · paragraph-heavy presentation · the prototype's white styling · cards · the
number of visible lines · final set morphology · final small-count composition · typography ·
colour · surfaces and materials · iconography · brand expression · motion · generative
graphics · final density styling · search / filter / jump behaviour · visual anchors · spatial
field · circles and grouping · relation threads and lines · transformation and recomposition
animation.

**Do not read "full-width vertical rows" into the freeze.** The row was a scalability proof.
Whether the set is drawn as rows, as equal columns, as a spatial field, as a threaded sequence
of nodes, as facing pairs, as a composed constellation, or as something not yet imagined is
**entirely VI-03's to decide** — provided clauses F-01…F-12 and the visual-truth rule hold.

---

## 2. Graphic and spatial attention aids — EXPECTED TO BE EXPLORED

The product owner's guardrail is canonical carry-forward:

> The final QANDEEL analysis experience must not default to paragraph/list bureaucracy. VI-03
> and later phases must actively investigate meaningful graphic/spatial structures — circles,
> grouping, threads, anchors, motion, recomposition, and other non-textual structures — when
> they improve attention/comprehension/navigation and remain semantically truthful.

Specifically available, and expected to be considered on their merits:

- **circles, containers and grouping** — where the grouping is true;
- **relation lines and threads** between readings, or between a shared record and the readings
  that stand on it — where the relation is recorded;
- **motion and visual transformation** — assembly, recomposition, arrival, return;
- **visual anchors** that let the eye find its place before reading everything;
- **non-textual structure** — rhythm, weight, spacing, adjacency, field — that helps the eye
  understand the shape of a set before parsing its content.

**This is a permission, not a requirement.** It is not a mandate to add decorative circles or
motion. Each device must earn its place by improving attention, comprehension, relation or
navigation, and none may invent meaning the runtime does not carry:

> **A visual relationship may be drawn only if it is true of the runtime.**

Two permissions worth restating, because the tested prototype makes them easy to forget:

- **F-06 does not mandate a text link.** "Reach the whole statement without commitment" is
  satisfied by a per-row control today; a node that opens in place, a preview expanding inside a
  spatial field, or a composition that never abbreviates would satisfy it equally.
- **F-03 does not mandate a sentence per surface.** Equality must reach the reader in words;
  where and how those words sit is open, provided assistive technology receives the same
  statement.

---

## 3. Live screen-reader validation → VI-10

The identity model is proven **structurally and programmatically**, at a true 375px, in Arabic
and English. That is strong, and it is **not** a substitute for a live NVDA/JAWS session.

VI-02 raises the stakes of that pass rather than lowering them: a peer's accessible name is now
its **whole statement**, so real-world verbosity at 24–32 peers is exactly what a live session
must judge. Presentational answers exist (heading-per-peer skimming, list semantics that expose
the statement once per item) and are deliberately left open.

**Owner: VI-10.**

---

## 4. Exact-duplicate exposure edge → separate investigation, if a shipping path can reach it

Binding, from `VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` §3:

> If a production exposure path can surface materially distinct records whose human-facing
> identity is indistinguishable even with the full statement shown, that exposure requires a
> separate truth/runtime/product-contract investigation before shipping that state.

VI-02 does **not** assume statements are globally unique, does **not** claim exact duplicates
are impossible, and does **not** invent a UI distinction for data that does not contain one.
Cosmetic disambiguation by ordinal, letter, UUID, rank or invented label is forbidden in every
case.

**Trigger: a real shipping exposure path. Owner: a separate investigation, not VI-03's visual
work.**

---

## 5. Chip-scale / persistent reading label → DEFERRED POSSIBILITY, NOT REQUESTED

No label contract is requested now, and none is designed, named, sized or scheduled anywhere in
this archive.

It becomes worth investigating **only** if a future visual or voice surface genuinely requires
it — a persistent chip-scale rail, a dense cross-reference index, a voice or realtime shorthand,
or a spatial composition whose nodes must be short. In that event it is **its own task, with its
own runtime evidence, its own contract and its own review.**

It must never be requested to make previews prettier, a composition tidier, or a density number
better. Equally, **F-12 is not a permanent prohibition on future runtime evolution** — the
deferral is a scoping decision, not a ban.

**Standing: `DEFERRED POSSIBILITY — NOT REQUESTED`.**

---

## 6. Numeral policy — OPEN

Unfrozen. Every numeral rendering in the VI-02 evidence is **provisional**. One numeral system
per surface was observed as a working rule, and the separator-beside-Eastern-digits constraint
held, but the policy itself is not settled and belongs to a later Phase VI decision.

---

## 7. Final Arabic rendered-surface microcopy — SUBJECT TO LATER APPLICATION REVIEW

The Arabic chrome strings introduced in the VI-02 prototypes are **provisional for
rendered-surface testing**. The register mix between frozen product strings and neutral chrome
is intentional and unresolved, and English role words remain provisional mirrors of the frozen
Arabic role vocabulary.

Final wording is subject to a later **VI-01-application review** on real rendered surfaces.
Nothing in this archive freezes a sentence.

---

## 8. `VI-02-VIS-01` — COMPLETED VISUAL RESEARCH ONLY

Directions **A / B / C / D** are:

- **not selected**;
- **not canonical**;
- **not frozen**;
- **not constraints on VI-03**.

Nothing in this archive adopts, rejects or ranks them. Useful product-owner learning is recorded
in the README: the polish and quality level was encouraging, and paragraph-heavy presentation is
**not** the desired final QANDEEL experience.

---

## 9. Legacy quality dimensions to protect — VI-03

Three of five legacy quality dimensions are `AT RISK` and must be **actively protected** in
VI-03: **analytical presence**, **narrative / spatial intelligibility**, and **conversation ↔
analysis continuity**. They are at risk from the drawing, not from the behaviour — so only VI-03
can protect them. See
[`VI02_LEGACY_ANTI_REGRESSION_GUARDRAIL.md`](VI02_LEGACY_ANTI_REGRESSION_GUARDRAIL.md).

The sharpest form of the problem: **the legacy bought its spatial density by asserting a
taxonomy the runtime never had. Recovering that density honestly is VI-03's real problem.**

---

## 10. Carried forward from the density findings

- **Scanning is hardest in the normal case**, not the adversarial one — sets crowded with
  related readings that share an opening. Resolving ambiguity and reducing travel are in direct
  tension.
- **The least-composed surface is the smallest one.** At two or three peers the tested drawing
  is honest, readable and inert. It is the surface most in need of VI-03's attention.
- **Search, filtering, sorting, grouping, jump-to and sticky indexes are neither frozen in nor
  frozen out.** They were simply not VI-02's to invent.
- **No measured number in the density findings is a frozen UI metric.**

---

## 11. Minor items carried unchanged

- Inline foreign terms inside statement text need presentation-layer handling in production;
  deliberately not faked in fixture data.
- Zero-state wording polish.
- English role words remain provisional mirrors of the frozen Arabic role vocabulary.
- Exact English `Live Context`, foreground/return and remove-from-current-context wording,
  inherited as open from VI-01, remain a VI-03 application concern.

---

## Next task

**`VI-03 — Visual North Star + Graphic Language`**

VI-03 inherits the frozen behavioural architecture above and owns the visual answer VI-02
deliberately did not prescribe.
