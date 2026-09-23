# I-08B3.1-A3 — METHOD

## What class of evidence this is

**A3 is a set of controlled browser renders produced under two raster conditions.** There are no
participants, no perceptual measurement and no native platform validation. Every statement in
this package is a statement about **what these boards show under these conditions**, and is
scoped that way in `A3_FINDINGS.md` and `A3_FAILURES.md`.

This limitation is stated here, at the top, so that every claim downstream inherits it rather
than being read as more than it is. It is the standing correction from I-08B3.1-A2R, carried
forward as a constraint on how A3 is allowed to write, not as a thing to be worked around.

## What A3 was asked to do, and what it did not do

A3 is **not** another thesis search. The Design Director settled the thesis direction after A2R:
thesis A advances alone, thesis B is retired as challenger, thesis C remains retired. A3's job is
to close the one remaining perceptual uncertainty inside the selected direction — **which Primary
Reading Neutral should close B3.1-A** — by producing evidence.

**A3 makes no decision.** It does not select a finalist, does not confirm the World, does not
freeze anything, and does not close B3.1-A. Those are the Design Director's, after independent
review of this package.

Not designed, not proposed and not frozen here: surface hierarchy, a Subtle ladder, cards,
outlines, a non-text edge system, interaction colours, status colours, Living Brass, QANDEEL
Light, a light theme, a high-contrast theme, or any production token.

---

## 1. The model — what varies and what does not

| | Value | Status |
|---|---|---|
| World Base | `#101010` | **sole incumbent, preserved.** A3 does not search for another and does not micro-adjust this one. **NOT canonical** |
| Secondary | `#afaca3` | unchanged, **not under test**. A3 asks whether each finalist works *with* it |
| Tertiary | `#8b8982` | unchanged, **not under test**. Explicitly **not** brightened to compensate for anything |
| Control | `#e1ded3` | the A1 Primary. **Reference only.** Not a third finalist |
| **P1** | `#d8d5ca` | **finalist** — A1 Primary at OKLCH L −0.0275 |
| **P2** | `#d2cfc4` | **finalist** — A1 Primary at OKLCH L −0.0475 |
| Diagnostic Subtle | World + ΔL 0.035 → `#181818` | **NON-CANONICAL proof scaffolding**, carried from A2 |
| Diagnostic map edge | solved to 3:1 → `#646464` | **NON-CANONICAL proof scaffolding**, carried from A2 |
| Achromatic probe | L 0.92 / 0.95 / 0.98 / 1.00 | **NON-CANONICAL DIAGNOSTIC ONLY.** Not QANDEEL Light, not a proposal for it |

The two finalist hexes were supplied by the brief. `tools/a3-preflight.mjs` check 5 **regenerates
both from the control** — control OKLCH lightness minus 0.0275 and minus 0.0475, chroma and hue
held, validated against the rendered sRGB — and confirms each reproduces the brief's hex exactly.
They are checked, not trusted.

Neither retired thesis exists anywhere in `tools/a3-model.mjs`, so neither can be rendered by
accident. Preflight check 7 and the packager both scan every text file in the package for their
ten A1 hex values.

## 2. The fairness contract, proved rather than promised

**A candidate contributes exactly ONE CSS custom property: `--ink-1`.** Six values reach the
shared product template and five of them — `--world`, `--subtle`, `--ink-2`, `--ink-3`, `--edge` —
are identical in every render in this package. Preflight check 5 diffs the two variable blocks
and requires exactly one difference, by name.

Everything else is a literal constant in `tools/a3-env.mjs`: geometry, DOM order, element count,
type roles, spacing, copy, direction, font.

That is easy to promise and easy to break by accident, so it is checked mechanically. While each
environment renders, the page reports a **structural fingerprint**: for every element inside the
product frame, its tag, its laid-out box in CSS pixels, and the length of its text if it is a
leaf. Colour appears nowhere in it. `tools/a3-fairness.mjs` compares the candidates element by
element and the run fails on any difference.

**Result: PASS, in both raster conditions.**

```
deep    A2      P1 vs P2     15 elements   IDENTICAL
deep    MOBILE  P1 vs P2     15 elements   IDENTICAL
map     A2      P1 vs P2     39 elements   IDENTICAL
quiet   A2      P1 vs P2     12 elements   IDENTICAL
util    A2      P1 vs P2     38 elements   IDENTICAL
```

Fingerprints are grouped by (environment, raster condition) and compared only within a group,
because the two conditions lay out at different widths on purpose and are not claimed to be the
same composition. **Only the shipped environment boards feed the proof.** A failure capture
carries a longer explanatory header, which moves the product frame down the page; letting one
into the comparison would make an honest board look like a structural difference, and two of the
captures are also P1/deep, so they would have overwritten the fingerprint of the board they are
captures *of*.

## 3. The anti-generic contract, as a refusal

`assertNoDecor()` runs **14 refusal patterns against the exact markup of every product frame
before it is rasterised** — gradient, box/text/drop shadow, backdrop-filter, `filter:`, `blur(`,
non-zero border-radius, partial opacity, `<img>`/`<use>`/`xlink:href`, monospace, ALL-CAPS
transform, non-zero letter-spacing, middle dot, arrow, and brass/brand-light vocabulary. A frame
that trips any of them fails the run instead of shipping.

Logo-Off and Glow-Off are therefore not a separate render. They are the condition every board in
this package is already in, and the assertion is the evidence. Nothing in this package contains a
logo, a mark, a glow, a bloom, a gradient, a shadow, a blur, a glass surface, a card, an accent,
a brass value or a brand light. Preflight check 6 confirms it from the other direction, with a
chroma census of the values actually painted (highest 0.0153 against a 0.016 ceiling) and a
vocabulary scan of every text file.

## 4. The boards

| Board | Question | Canvas |
|---|---|---|
| `READING_01_ROLE_MATRIX` | A3.1 — the five frozen roles at true size, in all three candidates | 1990 × dpr 2 |
| `READING_02_LONG_FORM` | A3.3 — sustained Arabic analytical reading, six paragraphs, 560 px measure | 1990 × dpr 2 |
| `BLIND_READING_X_Y` | A3.3 — the same pixels, finalists only, unlabelled | cut from the above |
| `HIERARCHY_RAMP` | A3.2 — Primary vs Secondary vs Tertiary, on both surfaces, all three candidates | 1440 × dpr 2 |
| `HEADROOM_P1_P2` | A3.5 — is credible perceptual headroom left above the reading? | 1990 × dpr 2 |
| `METADATA_TRUE_SIZE` | A3.6 — Metadata 12/20 at 400 and 500, both finalists, both surfaces | 1440 × dpr 2 |
| `METADATA_MAGNIFIED` | A3.6 — the same pixels at 4× nearest neighbour | cut from the above |
| `ENV_P1_1..4`, `ENV_P2_1..4` | A3.4 — the four frozen environments, both finalists | 1440 × dpr 2 |
| `ROBUSTNESS_MOBILE_P1`, `_P2` | A3.7 — the same reading at 390 CSS px, dpr 3 | 390 × dpr 3 |
| `ROBUSTNESS_MOBILE_PAIR` | A3.7 — the two side by side, native pixels | cut from the above |
| `ROBUSTNESS_METADATA_4X` | A3.7 — the Metadata line from **both** conditions at one logical scale | cut from both |
| `failures/FAILURE_TERTIARY_BELOW_APPLE_7TO1` | the Tertiary's shortfall against Apple's Dark Mode 7:1 | 1440 × dpr 2 |
| `failures/FAILURE_METADATA_400_IN_PRODUCT` | Metadata at weight 400 in a real screen — the condition A2 measured | 1440 × dpr 2 |
| `failures/CONTROL_COLLAPSED_HIERARCHY` | Primary set to the Secondary value — the zero-separation floor | 1440 × dpr 2 |

**The reading boards use a wider bench canvas (1990 CSS px) and nothing else changes.** Three
columns each have to carry the full frozen 560 px Arabic measure; shrinking the measure to fit a
1440 board would have made the reading proof test a narrower column than the Product uses, which
is the one thing a reading proof may not do. deviceScaleFactor, colour profile and antialiasing
are identical to the A2 condition. The bench is board chrome, not part of what is being tested.

**Derived boards are cut from the pixels of the boards above them and are never re-rendered.**
The blind board is literally the same pixels as the labelled one, so nothing can drift between
them.

## 5. The two raster conditions (A3.7)

| | A2 condition | Mobile condition |
|---|---|---|
| CSS viewport | 1440 | 780 window, **product frame a fixed 390** |
| deviceScaleFactor | 2 | 3 |
| Product frame | 960 CSS px | 390 CSS px |
| Reading measure | 560 CSS px | 350 CSS px |
| Colour profile | sRGB forced | sRGB forced |
| Antialiasing | greyscale forced | greyscale forced |
| Compositor / virtual time | identical | identical |

**Only viewport and deviceScaleFactor differ.** Every other flag is held as a control and is
listed in `A3_MEASUREMENTS.json` under `render.constantAcrossConditions`.

Two honest notes about this condition, both recorded rather than smoothed over:

**The window is wider than the frame, and has to be.** Chrome on Windows refuses a browser window
narrower than roughly 500 CSS px: ask for 390 and the layout viewport comes back 488 while the
screenshot is still taken at 390, so the right-hand end of the document is silently cut off the
raster and a strip of page background appears on the other side. The first mobile run of this
package had exactly that defect, and the **reported element boxes are what exposed it** — a box
at x 118 with width 350 inside a 390 px capture. So the product frame is laid out at a fixed
390 CSS px inside a 780 px window and **cut out of the raster by its own reported box**. What
ships is exactly 390 CSS px at dpr 3, and `render()` asserts the frame laid out at 390 before
cropping.

**The mobile measure is 350 px, below the frozen 520–600 comfort zone**, because a phone does not
have 560 px to give. That is a property of the device, not a choice A3 made. It means the mobile
condition is a **raster robustness check, not a reading-measure proof** — but within the
condition the two finalists are identical to each other, which is what the robustness question
actually asks.

**The Analysis Map has no mobile geometry and is refused at that condition rather than
improvised.** Its node positions are a fixed composition authored for an 848 px content width;
re-laying it out for a 350 px column would be a new design decision about how the Living Analysis
Map behaves on a phone, and A3 has no authority to make it. `productFrame()` throws.

## 6. Typography

**Estedad v8.5 is frozen and is not reopened.** The binary is identity-checked by SHA-256 against
the pinned digest before it is embedded, because this host carries a second, different file with
the same name. It is embedded base64 in every document, so no network or system lookup can
substitute it, and every render measures a **three-weight fingerprint** — 400 / 500 / 600 — and
refuses to proceed if the widths drift or if all three come back equal, which is what a dead
variable `wght` axis looks like.

That guard matters more at A3 than at any earlier stage, because A3.6 asks whether weight 500
rescues the Metadata role. A board with a dead axis would answer that question falsely.

**Metadata is set at weight 500 in the Product proofs.** That is inside the frozen 12/20/400–500
role and is what the A3 brief directs after A2 found 400 visually fragile at true size. Weight
400 survives as a dedicated control on `METADATA_TRUE_SIZE` and in one failure capture. **No
size, leading or tracking changed, and the Tertiary colour was not raised to compensate.**

Arabic tracking is zero everywhere, enforced three ways: `letter-spacing:0` on every element, a
refusal pattern in `assertNoDecor()`, and **preflight check 10, which reads the computed
`direction`, `letter-spacing` and `text-align` off a rendered ENVIRONMENT 3** and reports the
distinct states found. A2 asserted this from source; A3 measures it from a render.

## 7. Measurement

Authored OKLCH goes in; the value recovered from the **quantised hex the browser paints** comes
out, and both are reported, with the drift between them, for every colour. Rendered output is the
authority. Contrast is computed from the 8-bit displayed values, as WCAG defines it.

`tools/color.mjs` transcribes the CSS Color 4 conversions directly — 64-bit LMS matrices, sRGB↔XYZ
as exact rational fractions, the `oklch()` powerless-hue epsilon of `0.000004` — and carries
**40 known-answer tests** in `tools/color.test.mjs`, all passing in this tree.

## 8. Reproducing this package

```
node tools/color.test.mjs      # 40 known-answer colour tests
node tools/a3-boards.mjs       # every raster in review/
node tools/a3-fairness.mjs     # the structural fairness proof
node tools/a3-preflight.mjs    # 12 checks, exits non-zero on failure
node tools/a3-measure.mjs      # A3_MEASUREMENTS.csv and .json
node tools/a3-package.mjs      # A3_MANIFEST.md, the archive, and its verification
```

Requires Node 22+ and Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`,
plus the Estedad v8.5 binary at the path in `tools/a3-ui.mjs` (referenced, **not redistributed** —
see `fonts-info/`).
