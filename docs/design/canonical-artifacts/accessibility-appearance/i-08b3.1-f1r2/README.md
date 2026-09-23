# I-08B3.1-F1R2 — ACCESSIBILITY TRANSFORMATIONS + SEMANTIC PARITY

**REVIEW CANDIDATE. NOT FROZEN. F REMAINS OPEN until I-08B3.1-F2 completes. F2 NOT STARTED.**

**This is the twice-revised package.** Two independent reviews of I-08B3.1-F1 required targeted
repairs of its **proof architecture, semantic authority, token classification and documentation** —
not of its visual craft. Every finding in both was correct.

| revision | what it repaired | record |
|---|---|---|
| **F1R** | proofs that could pass with the object gone; a renderer authoring semantic truth; an ablation claiming more than it proved; a sentence that gave array order Product authority | **`docs/F1R_REVISION.md`** |
| **F1R2** | a bounded fixture describing itself as the Product's semantic model; an announced word where V said nothing; a `?? raw id` fallback that would have expanded disclosure; a decorative depth cue frozen as a required semantic carrier; a measured line-height frozen as universal law | **`docs/F1R2_REVISION.md`** |

Both revisions have the same shape: **a bounded, local or instrumental fact written down at a
higher authority than it has.** A reviewer coming to this package after reading F1 should read both
records, F1R first.

**No accepted default visual experience changed, in either revision.** The Living Analysis World's
default raster is **byte-identical** to the pre-revision one — sha256 `0a8cb8e0c2ecaf2d…`, the same
value F1 shipped.

---

## The claim, in one sentence

> **THE SAME QANDEEL TRUTH SURVIVES DIFFERENT ACCESSIBILITY EXPRESSIONS — and the inherited
> default expression is unchanged.**

Both halves are measured rather than asserted, and F1R separated the second into the two
different claims F1 had run together:

- **DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION** (D-02) — every accessibility override file is
  replaced with an empty stub and the default document is rendered again. It is byte-identical,
  HTML and PNG. *This proves the default does not notice the overrides. It does **not** prove the
  default matches the inherited package, because both sides run F1's own scene builder.*
- **INHERITED-DEFAULT NON-REGRESSION** (I-01, I-02, I-03) — the inherited atmosphere layer is
  compared **against I-08B3.1-D2R's own exported functions**: 25 elements × 7 written attributes
  with no differences, and a raster that is **pixel-identical** to a reference page built from
  those functions with no F1 code in it at all.

## The three things a reviewer should check first

1. **Did the default get weaker?** No — `docs/F1_SPECTACLE_PRESERVATION.md` and Board K. Two
   independent proofs, above; D-01 and D-03 are why the first holds.
2. **Did any analytical object disappear anywhere?** No — `docs/F1_ANALYTICAL_TRUTH_PARITY.md`.
   132 cells read back out of **rendered documents**, where existence is decided by the object's
   **own** render identity, and **four planted removals** — one Topic, the Connection, the
   Pattern, the Insight — each of which must fail parity for that object and for no other. It is a
   **bounded** proof of the tested semantic dimensions; the contract that no user-exposable
   disclosed truth is lost is wider, and its exhaustive mapping is validated against the real
   canonical V schema at integration.
3. **Did accessibility invent importance?** No — `docs/F1_INCREASED_CONTRAST.md`. Importance is a
   **ratio**, so the guard is on the ratio: 1.2914 → **1.524**. The gap widens.

And the two questions F1R added:

4. **Did the accessibility layer invent any semantic truth?** No — it may not.
   `ACCESSIBLE SEMANTICS = PROJECT(V)` is a product-contract token, the test values arrive from a
   fixture stamped **SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA**, and no renderer file writes a
   semantic literal. Checks **A-01** … **A-04**.
5. **Does the traversal order mean anything?** No, and it is not allowed to. Peers are `EQUAL,
   UNRANKED`; the order is an explicitly **non-semantic** deterministic rule; and permuting the
   source array changes neither the order nor one fact. Checks **R-02**, **R-03**.

And the three F1R2 added:

6. **Does the projection say anything V did not?** No. Where V supplies no value, **nothing is
   announced** — not a plausible default, and not the «unspecified» word F1R announced, because the
   absence of a field does not tell you which of five different things it means. Check **A-05**.
7. **Can the accessible expression disclose MORE than the visual one?** No. It operates from the
   **same disclosed V** and **fails closed**: an undisclosed reference yields no raw id, no
   recovered name and no prose, and the broken reference is reported. Check **A-06**.
8. **Is the parity matrix claiming more than it tested?** No, and it now says so on its own face.
   It is **bounded** to the semantic dimensions the fixture supplies; the Product contract is
   wider and its mapping is written at integration. Checks **B-01** … **B-03**.

## Where to start

| you want | read |
|---|---|
| **what the second revision changed** | **`docs/F1R2_REVISION.md`** |
| **what the first revision changed** | **`docs/F1R_REVISION.md`** |
| the law and what it forbids | `docs/F1_ACCESSIBILITY_CONTRACT.md` |
| the contradictions found | `docs/F1_CONTRADICTIONS.md` |
| the boards | `docs/F1_REVIEW_BOARD.md`, then `review/board/` |
| what is open | `docs/F1_KNOWN_LIMITATIONS.md`, `docs/F1_F2_CARRY_FORWARD.md` |
| the gates | `docs/F1_SKILL_GATE.md`, `docs/F1_REFERENCE_GATE.md` |
| every check | `docs/F1_VALIDATION_RESULTS.md` |

## What F1 adds to QANDEEL

**No colour.** Compare I-08B3.1-E1, which added exactly one and said so. F1 adds none — every
colour it authors is an alias to a frozen rung of the I-08B3.0 reading ramp, and the single
literal in the package, `#080808`, is the **computed** opaque equivalent of the scrim over the
World. Check **S-02**. **F1R adds none either**: its four new tokens are semantic *requirements*
that had been living inside implementation values' descriptions with nothing naming them.

That is not modesty. A transformation that needed a new colour would be describing something the
default cannot express, which would make it a design change wearing an accessibility name.

## What F1 does NOT do

- **No Light Appearance.** The palette is not inverted; no provisional light mode exists to fill a
  matrix; resolving `appearance: light` still fails loudly. §18.
- **No global motion system.** Not one millisecond of the frozen lifecycle is retuned. §19.
- **No reopening of a frozen argument.** WCAG 2.2 SC 1.4.11's 3:1 is **adopted as a target** for
  the increased-contrast expression and explicitly not imposed on the default.

## Running it

Every tool runs from a bare extraction of this package with Node and headless Chrome. In order:

```
node tools/f1-derive.mjs           # the increased-contrast search  -> data/F1_DERIVATION.json
node tools/f1-motion.mjs           # the motion audit               -> data/F1_MOTION.json
node tools/f1-references.mjs       # the reference gate             -> data/F1_REFERENCES.json
node tools/f1-skills.mjs           # the skill gate                 -> data/F1_SKILLS.json
node tools/f1-sr.mjs               # projection, AX tree, ordering  -> data/F1_SCREEN_READER.json
node tools/f1-parity.mjs           # truth matrix + planted removals-> data/F1_PARITY.json
node tools/f1-inherit.mjs          # inherited-default vs D2R       -> data/F1_INHERITED_DEFAULT.json
node tools/f1-spectacle.mjs <ns>   # override isolation + North Star-> data/F1_SPECTACLE.json
node tools/f1-boards.mjs           # the eleven boards              -> review/board/
node tools/f1-verify.mjs           # all 52 checks                  -> data/F1_VALIDATION.json
node tools/f1-consistency.mjs      # the shipped surfaces, re-read
node tools/f1-docs.mjs             # the generated documents + manifest
```

`tools/f1-spectacle.mjs` takes the North Star image path as its argument; without one it still
runs the override-isolation half and reports the North Star half as not supplied.

## Result

**59/59 checks. 59/59 probes rejecting. Every shipped surface agrees.** Every guard is fed an
input that must make it fail, because a check that cannot fail is a sentence — including every
guard F1R and F1R2 added.

## Inheritance

```
I-08B3.0  visual foundation        FROZEN
I-08B3.1-B4R  Surface              FROZEN
I-08B3.1-C3   Living Brass         FROZEN
I-08B3.1-D    QANDEEL Light        CLOSED / FROZEN   (D2R is the governing state)
I-08B3.1-E    interaction + status CLOSED / FROZEN   (E1R is the governing state)
I-08B3.1-F1R  accessibility        REVIEW CANDIDATE  ← this package
I-08B3.1-F2   Light Appearance     NOT STARTED
```

I-08B3.1-F1 described D and E as freeze candidates. They are not: **I-08B3.1-D — QANDEEL LIGHT
SYSTEM is CLOSED / FROZEN, and I-08B3.1-E — INTERACTION + SYSTEM SEMANTIC COLORS is CLOSED /
FROZEN.** F1R corrects that everywhere this package speaks in its own voice, and reopens neither.

**The vendored copies still say "FREEZE CANDIDATE" and are deliberately left alone.**
`vendor/d2r/**` and `vendor/e1/**` are byte-for-byte copies of the sealed packages, verified by
check V-01 against their sources. Editing one to update its status would break the provenance
chain in order to improve a sentence — so the language inside a sealed copy is the language it was
authored with, and check W-01 asserts both halves: F1R's own surfaces say CLOSED / FROZEN, and the
vendored bytes are untouched.

Every inherited file is vendored **byte-exact** with the sha256 of the sealed package it came
from, and `tools/f1-resolve.mjs` re-checks both ends. A directory name is not provenance.
