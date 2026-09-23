# I-08B3.1-A3 — WORLD + READING NEUTRAL CLOSURE PROOF

**EXECUTION COMPLETE / READY FOR INDEPENDENT DESIGN DIRECTOR CLOSURE REVIEW / NOT APPROVED /
NOT FROZEN**

> **Evidence class.** Controlled browser renders under **two** raster conditions. No participants,
> no perceptual measurement, no native platform validation. Every claim in this package is scoped
> to what these boards show under these conditions.

> **A3 makes no decision.** No Primary is selected. `#101010` is **preserved, not confirmed**. No
> Product colour is declared canonical. Nothing is frozen and B3.1-A is not closed. The closure
> decision is the Design Director's, after independent review of this package.

> **A3R — canonical-state correction, and the decisions taken after this package.** Revision A3R
> corrects one documentation contradiction: A3 twice described QANDEEL as "a permanently dark
> product". **QANDEEL is DARK-LED, NOT DARK-LOCKED** — B3.1 is establishing the canonical dark
> expression while the architecture remains theme-capable. **No raster changed, no measurement
> changed and no colour value changed.** Following independent review the Design Director has
> selected `#101010` and **P1 `#d8d5ca`**, retiring P2 as the Primary finalist; the Secondary and
> Tertiary remain in the neutral system. Those are the Director's Product/Design decisions after
> independent visual review, **not a winner produced by A3**. All of it is recorded in
> **`A3R_REVISION_RECORD.md`**, which is the first thing to read in this package.

---

## What this is

The Design Director settled the thesis direction after A2R: **thesis A advances alone**, thesis B
is retired as challenger, thesis C remains retired. A3 is **not** another thesis search. Its job
is to close the one remaining perceptual uncertainty inside the selected direction —

**which Primary Reading Neutral should close B3.1-A** —

by producing controlled, reproducible evidence and handing it over.

| | Value | Status |
|---|---|---|
| World Base | `#101010` | sole incumbent, **preserved**, not searched, not adjusted, **not canonical** |
| Secondary | `#afaca3` | unchanged, not under test |
| Tertiary | `#8b8982` | unchanged, not under test, **not brightened** |
| Control | `#e1ded3` | the A1 Primary. **Reference only — not a third finalist** |
| **P1** | `#d8d5ca` | **finalist**, A1 Primary at OKLCH L −0.0275 |
| **P2** | `#d2cfc4` | **finalist**, A1 Primary at OKLCH L −0.0475 |

## The answer in one paragraph

Both finalists are viable. Every candidate clears every published conformance floor on both
surfaces by a wide margin, so **no contrast ratio can separate P1 from P2** — the separation has
to come from the raster. What the raster and the measured OKLCH steps show is a real trade-off
with no dominant option: **P1 keeps more Primary/Secondary separation (ΔL 0.1280 vs 0.1095); P2
opens more luminous headroom above the reading (0.1462 vs 0.1277) and lands closest to an even
three-level ramp (step ratio 0.956 vs 1.117); both are more even than the A1 control's 1.358.**
Neither depends on decorative treatment, neither collapses the hierarchy, and neither reverses
across the two raster conditions. The frozen Metadata role's already-permitted 500 weight
materially improves the small text at true size without touching the Tertiary colour.
`#101010` carried every proof and exposed no contradiction. **One genuine gap is open and A3 was
forbidden to close it: the Tertiary measures 5.435:1 / 5.072:1, below Apple's 7:1 Dark Mode
target for custom colours "especially in small text".**

## Pass condition

The brief's nine conditions, each answered:

| Condition | Status |
|---|---|
| `#101010` remains viable across all proofs | **yes** — four environments, both finalists, both raster conditions, three captures; no functional failure |
| At least one of P1/P2 supports sustained Arabic reading | **yes — both do**, on `READING_02_LONG_FORM.png` and the blind board |
| Primary/Secondary/Tertiary hierarchy remains coherent | **yes**, at both finalists, on both surfaces, against a zero-separation control |
| No finalist depends on decorative treatment | **yes** — 14 refusal patterns asserted against every frame before rasterising; there is no decoration to depend on |
| Diagnostic luminous headroom remains credible | **yes**, and wider at both finalists than at the A1 control |
| Metadata 500 is viable at true size | **yes** for the rendering fragility; it does **not** change the contrast gap in §1.1 of `A3_FAILURES.md` |
| The result does not reverse across the tested raster conditions | **yes** — no reversal; the dpr 2 condition is the conservative one |
| All accessibility floors remain satisfied | **WCAG 2.2 floors: yes**, every value, both surfaces. Apple's 7:1 is a stated **target**, not a conformance floor, and the Tertiary is below it — reported, not hidden |
| No later-stage colour family had to be invented | **yes** — no Brass, no QANDEEL Light, no interaction colour, no status colour. Preflight check 6 verifies it by chroma census and vocabulary scan |

**A3 is ready for closure review.** It is not BLOCKED, and no P3 was invented.

---

## Reading order

0. **`A3R_REVISION_RECORD.md`** — the canonical-state correction, the proof that no raster and no
   measurement changed, and the Design Director's post-review decisions recorded verbatim.
1. **`A3_FINDINGS.md`** — the five findings that matter, then each brief section answered in turn,
   then what is and is not established, then six open questions for the Director.
2. **`A3_FAILURES.md`** — three shipped failure captures, four defects in this package's own
   tooling found and fixed during the run, and what A3 cannot answer.
3. **`A3_METHOD.md`** — the model, the fairness contract and how it is proved, the anti-generic
   refusal system, the board list, the two raster conditions, typography, measurement,
   reproduction commands.
4. **`A3_PREFLIGHT.md`** — 12 checks, each a measurement. Exits non-zero on failure.
5. **`A3_SKILL_GATE.md`** — 55 skills re-enumerated from disk and re-decided against A3's
   questions, with hashes checked against the A2R baseline.
6. **`A3_REFERENCE_GATE.md`** — every primary source re-fetched in this session, with what changed
   since A2 and one attribution A2 got wrong.
7. **`A3_MEASUREMENTS.csv` / `.json`** — the machine-readable record. Nothing is quoted in
   `A3_FINDINGS.md` that is not in here.
8. **`A3_MANIFEST.md`** — every file with its SHA-256.

## The boards

**A3.1 / A3.3 — reading**

| | |
|---|---|
| `READING_01_ROLE_MATRIX.png` | the five frozen type roles at true size, in all three candidates |
| `READING_02_LONG_FORM.png` | six paragraphs of real QANDEEL Arabic at 17/30/400, 560 px measure |
| `BLIND_READING_X_Y.png` | the same pixels, finalists only, unlabelled. **X = P2, Y = P1** — recorded here and in `A3_MEASUREMENTS.json`, and nowhere in the image |

**A3.2 / A3.5 / A3.6 — ramp, headroom, small text**

| | |
|---|---|
| `HIERARCHY_RAMP.png` | Primary vs Secondary vs Tertiary, on both surfaces, all three candidates, with the OKLCH step table |
| `HEADROOM_P1_P2.png` | the achromatic diagnostic probe above the reading. **Not QANDEEL Light** |
| `METADATA_TRUE_SIZE.png` | Metadata 12/20 at weight 400 and 500, both finalists, both surfaces |
| `METADATA_MAGNIFIED.png` | the same pixels at 4× nearest neighbour, cut from the raster above |

**A3.4 — the four environments, both finalists**

`ENV_P1_1_QUIET` · `ENV_P1_2_MAP` · `ENV_P1_3_DEEP` · `ENV_P1_4_UTIL`
`ENV_P2_1_QUIET` · `ENV_P2_2_MAP` · `ENV_P2_3_DEEP` · `ENV_P2_4_UTIL`

**A3.7 — the second raster condition**

| | |
|---|---|
| `ROBUSTNESS_MOBILE_P1.png`, `_P2.png` | the deep reading at 390 CSS px, deviceScaleFactor 3 |
| `ROBUSTNESS_MOBILE_PAIR.png` | the two side by side, native pixels, cut from the above |
| `ROBUSTNESS_METADATA_4X.png` | the same Metadata line from **both** conditions at one logical scale |

**Failure and control captures** — `review/failures/`

| | |
|---|---|
| `FAILURE_TERTIARY_BELOW_APPLE_7TO1.png` | the open contrast gap A3 was forbidden to close |
| `FAILURE_METADATA_400_IN_PRODUCT.png` | weight 400 in a real screen — the condition A2 measured |
| `CONTROL_COLLAPSED_HIERARCHY.png` | Primary set to the Secondary value: the zero-separation floor |

## What is scaffolding, not a proposal

Three values in this package exist only so a reading value can be judged, and **none of them is
canonical or proposed**:

- **Diagnostic Subtle `#181818`** (World + ΔL 0.035), carried from A2, so a reading value can be
  judged on both surfaces it will land on. **No Subtle ladder is being designed.**
- **Diagnostic map edge `#646464`**, solved to WCAG 1.4.11's 3:1 against the *worse* surface,
  because ENVIRONMENT 2 cannot be drawn without a line colour. **Not promoted into a token.**
- **The achromatic probe** at L 0.92 / 0.95 / 0.98 / 1.00, chroma exactly 0.0000, no hue, no glow,
  no gradient, no aura. **It is not QANDEEL Light and is not a proposal for it. QANDEEL Light
  remains entirely undesigned.**

## Reproduce

```
node tools/color.test.mjs      # 40 known-answer colour tests
node tools/a3-boards.mjs       # every raster in review/
node tools/a3-fairness.mjs     # the structural fairness proof
node tools/a3-preflight.mjs    # 12 checks, exits non-zero on failure
node tools/a3-measure.mjs      # A3_MEASUREMENTS.csv and .json
node tools/a3-package.mjs      # A3_MANIFEST.md, the archive, and its verification
```

Requires Node 22+, Google Chrome, and the Estedad v8.5 binary at the path in `tools/a3-ui.mjs`.
**The font is referenced, not redistributed** — see `fonts-info/` for its identity, hash and
licence.

## Fairness, in one line

A candidate contributes **exactly one CSS custom property**, `--ink-1`. Five of the six values
reaching the shared template are identical in every render in this package, and the two finalists
are proved to lay out identically element by element — 12 / 39 / 15 / 38 elements across the four
environments, in **both** raster conditions.
