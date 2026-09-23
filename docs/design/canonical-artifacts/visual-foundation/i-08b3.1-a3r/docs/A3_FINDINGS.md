# I-08B3.1-A3 — FINDINGS

> **Evidence class.** A3 is a set of **controlled browser renders under two raster conditions**.
> There are no participants, no perceptual measurement and no native platform validation. Every
> statement below is a statement about **what these boards show under these conditions**. Where
> something is not established, it says so.

> **A3 makes no decision.** No Primary is selected, `#101010` is preserved but not confirmed, no
> Product colour is declared canonical, nothing is frozen and B3.1-A is not closed. The words
> "P1 wins", "P2 wins", "final palette", "canonical" and "freeze complete" do not appear in this
> package as claims, and the ranked-recommendation format `design-critique` asks for was refused
> for the same reason.

> **A3R note — decisions taken AFTER this document was written.** Everything below is A3's
> evidence, unchanged. Following independent review the Design Director has selected the World
> Base `#101010` and the Primary Reading Neutral **P1 `#d8d5ca`**, retiring P2 `#d2cfc4` as the
> Primary finalist, and has kept the Secondary `#afaca3` and the Tertiary `#8b8982` in the
> neutral system. **That is a Product/Design decision made by the Director after independent
> visual review — it is not a numeric winner produced by A3**, and nothing in this document is
> reinterpreted to suggest otherwise. The decisions are recorded verbatim in
> `A3R_REVISION_RECORD.md`. Open questions 1 and 2 in §10 are answered there; questions 3 and 4
> are routed to **I-08B3.1-B** and **B3.1-F** rather than answered.

---

## 0. The one-paragraph answer

Both finalists are viable. Every candidate clears every published conformance floor on both
surfaces by a wide margin, so **no contrast ratio can separate P1 from P2** — the separation has
to come from the raster. What the raster and the measured OKLCH steps show is a genuine
trade-off with no dominant option: **P1 keeps more Primary/Secondary separation; P2 opens more
luminous headroom above the reading; both produce a more even three-level ramp than the A1
control does.** Neither depends on decorative treatment, neither reverses across the two raster
conditions, and neither collapses the hierarchy. The frozen Metadata role's already-permitted
500 weight materially improves the small text at true size without touching the Tertiary colour.
`#101010` carried every proof and exposed no contradiction. One genuine gap is open and A3 is
forbidden to close it: **the Tertiary is below Apple's 7:1 Dark Mode target for custom colours,
in exactly the small-text case Apple names.**

---

## 1. The five findings that matter

### 1. Lowering the Primary is clean in this direction — the hue does not move

| | hex | L | C | H |
|---|---|---|---|---|
| Control (A1 Primary) | `#e1ded3` | 0.8999 | 0.0151 | 94.2° |
| **P1** | `#d8d5ca` | 0.8723 | 0.0153 | **94.2°** |
| **P2** | `#d2cfc4` | 0.8538 | 0.0153 | **94.2°** |

Both finalists were regenerated from the control by subtracting OKLCH lightness with chroma and
hue held, and both reproduce the brief's hex **exactly** (preflight check 5). The measured hue
after 8-bit quantisation is identical to one decimal at all three values, and chroma moves by
0.0002 — a single quantisation step.

This is not a given. A2 found that reducing a Primary by the same ΔL 0.0475 **swung the hue of
the other thesis's ink from 236.5° to 247.9°**, because that ink's chroma sat below the 8-bit
hue-reliability floor at near-black. The selected direction's ink carries roughly 0.015 chroma,
comfortably above that floor, so the reduction is a clean lightness move and nothing else.
**That property is what makes P1 and P2 legitimate candidates rather than two accidental
colours.**

### 2. No contrast ratio can decide this board

Measured against both surfaces, worst case:

| Role | hex | vs World `#101010` | vs Diagnostic Subtle `#181818` | WCAG 4.5:1 | Apple dark 7:1 |
|---|---|---|---|---|---|
| Control Primary | `#e1ded3` | 14.127:1 | 13.182:1 | pass | meets |
| **P1** Primary | `#d8d5ca` | 12.948:1 | 12.083:1 | pass | meets |
| **P2** Primary | `#d2cfc4` | 12.198:1 | 11.383:1 | pass | meets |
| Secondary | `#afaca3` | 8.384:1 | 7.823:1 | pass | meets |
| Tertiary | `#8b8982` | 5.435:1 | 5.072:1 | pass | **below** |

Every candidate clears WCAG 2.2 SC 1.4.3 by more than 2.5×, and all three clear Apple's 7:1 on
both surfaces. **The legal region contains all of them.** That is why A3 exists as a set of
renders rather than a spreadsheet, and it is why the rest of this document talks about what the
boards show.

### 3. Both finalists make the three-level ramp MORE even than A1 did

The content ramp measured as OKLCH lightness steps, with the Secondary and Tertiary unchanged:

| | Primary → Secondary | Secondary → Tertiary | step ratio |
|---|---|---|---|
| Control (A1) | 0.1556 | 0.1146 | **1.358** |
| **P1** | 0.1280 | 0.1146 | **1.117** |
| **P2** | 0.1095 | 0.1146 | **0.956** |

A ratio of 1.000 would be a perfectly even three-level ramp. A1's Primary sat 36 % further from
the Secondary than the Secondary sits from the Tertiary — a top-heavy ramp with a big jump at
the top and a smaller one below. **P1 nearly evens it; P2 passes just through even and becomes
marginally bottom-heavy.**

On the boards, at both finalist values and on **both** surfaces, the three levels remain
individually distinguishable, and neither resembles
`failures/CONTROL_COLLAPSED_HIERARCHY.png`, where the Primary is set to the Secondary value and
the top two levels become one. The smallest step present anywhere in the finalists is P2's
0.1095, which is **96 % of a step the reading system already relies on** and which the same board
shows plainly.

**What this does not establish.** It does not establish a perceptual threshold, a minimum usable
step, or that a smaller step would fail. There were no participants. It establishes that on
these boards, under these conditions, neither finalist's ramp collapsed and the zero-separation
floor looks nothing like either of them.

### 4. The headroom above the reading is materially wider at both finalists, and widest at P2

Lightness remaining above the Primary on the OKLCH axis, and the gap to the lowest achromatic
diagnostic probe step (L 0.92):

| | lightness above Primary | gap to probe L 0.92 |
|---|---|---|
| Control | 0.1001 | 0.0201 |
| **P1** | 0.1277 (+28 %) | 0.0477 |
| **P2** | 0.1462 (+46 %) | **0.0662** |

On `HEADROOM_P1_P2.png` the four probe fills are individually distinguishable above all three
candidates, and the distance between the reading and the bottom of that band is visibly larger at
P2 than at the control.

**What this does not establish.** The probe is four solid rectangles, chroma exactly 0.0000, no
hue, no glow, no gradient. It establishes that meaningful differentiation remains available in
that band **for sufficiently sized area or fill expressions, under this render condition**. It
does **not** establish final QANDEEL Light levels, a number of usable levels, a production token
ladder, equivalent distinction for **text**, or equivalent distinction for **small marks**.
**QANDEEL Light remains entirely undesigned and non-canonical.** This is the A2R scope
correction, carried forward deliberately.

### 5. Weight 500 materially improves the Metadata role — and cannot fix its contrast

`METADATA_MAGNIFIED.png` shows the same string in the same Tertiary colour at weight 400 and
weight 500, magnified 4× nearest-neighbour **from the pixels Chrome actually drew**, on both
surfaces and for both finalists. At 400 the thin joins and the fine strokes fall away; at 500 the
letterforms hold as continuous shapes. The same pair, in a real product screen, is
`failures/FAILURE_METADATA_400_IN_PRODUCT.png` against `ENV_P1_3_DEEP.png`.

Weight 500 is **already inside** the frozen 12/20/400–500 role, so nothing about the typography
system was reopened, no size or leading moved, tracking stayed at zero, and the Tertiary colour
was **not** raised to compensate.

**But weight is not contrast.** Making the strokes heavier does not change the 5.435:1 / 5.072:1
the Tertiary measures, and Apple's 7:1 target for custom colours in Dark Mode is attached
"especially in small text". So A3's answer to the brief's question — *does the already-permitted
500 weight remove the visual fragility enough that Tertiary colour does not need to be changed?* —
is **yes for the rendering fragility, and no for the contrast target**. See §4 and
`A3_FAILURES.md`.

---

## 2. A3.1 — the frozen roles at true size

`READING_01_ROLE_MATRIX.png` renders Screen Title 26/42/600, Meaningful Statement 32/52/500,
Compact Meaningful Statement 26/42/500, Section Title 20/33/600 and Primary Body 17/30/400 in
identical realistic Arabic, at the identical 560 px measure, in the identical order, on the
identical World Base, in all three candidates. The only difference between the columns is the
Primary Reading Neutral.

What the board shows: **all five roles remain fully legible at all three values**, and the
hierarchy between the roles — which is carried by size and weight, not by colour — is unchanged
across the columns, as it must be, since only one colour moved. The large roles (32/52 and
26/42) are where the difference between the candidates is most visible as an amount of light on
the page; the Primary Body is where it is least visible.

## 3. A3.3 — sustained Arabic reading

`READING_02_LONG_FORM.png` is six paragraphs of real QANDEEL analytical prose at Primary Body
17/30/400 in a 560 px column, with the Compact Meaningful Statement and Section Title that
precede them and the Supporting Body and Metadata that follow — all three candidates, identical
copy, identical geometry. No Lorem Ipsum and no specimen filler.

`BLIND_READING_X_Y.png` is the same pixels with the control removed and the two finalists
relabelled. **The mapping is READING X = P2, READING Y = P1**; it appears nowhere in the image
and is recorded here and in `A3_MEASUREMENTS.json` only.

What the boards show, stated as what they show: **both finalists sustain a full page of Arabic**.
Neither goes dull and neither glares. Read against the control in the same board, both finalists
put less light on the page; P2 puts the least. The difference between X and Y in the blind board
is a difference of **quietness, not of legibility** — nothing in either column becomes harder to
resolve.

**What this does not establish.** Sustained comfort over a real reading session is a property of
a person reading for minutes, not of a raster. A3 had no participants. What a board can show is
whether anything falls apart on a page of type, and nothing does.

## 4. A3.2 — hierarchy coherence with the unchanged Secondary and Tertiary

Answering the brief's six questions directly, from `HIERARCHY_RAMP.png` and the measurements:

- **Is Primary still unmistakably Primary?** On these boards, yes at both finalists, on both
  surfaces. The Primary→Secondary step is 0.1280 at P1 and 0.1095 at P2, against a
  zero-separation control that looks nothing like either.
- **Does Secondary remain clearly subordinate?** Yes. The Secondary is unchanged and its step to
  the Tertiary is unchanged at 0.1146, so its position relative to the Tertiary did not move at
  all; only its distance from the Primary changed.
- **Does Tertiary remain quiet but usable?** Quiet, yes — and usable at weight 500 in the
  rendering sense (§1.5). **Its contrast is the open item**, at 5.07:1 on the worse surface
  against Apple's 7:1 target for small custom-coloured text. That is not a WCAG failure and it is
  not caused by either finalist; it is a property of the unchanged Tertiary, and it is unchanged
  by which finalist is chosen.
- **Does P2 compress the Primary/Secondary hierarchy too far?** Not on this evidence. Its
  Primary→Secondary step is 96 % of the Secondary→Tertiary step the system already uses, and both
  remain distinguishable on both surfaces. A3 cannot say whether a reader over a long session
  would feel the top of the ramp flatten; that would need a study.
- **Does P1 leave unnecessarily little luminous headroom?** P1 leaves 0.1277 above the Primary
  against the control's 0.1001 and P2's 0.1462 — more than A1 had, less than P2 offers. Whether
  that is "too little" depends on what QANDEEL Light is eventually asked to do, which is
  undesigned, so A3 states the quantity and does not judge it.
- **Does either make long Arabic reading feel dull or overly bright?** On these boards, neither.
  The control is the brightest of the three and P2 the quietest, and all three hold.

## 5. A3.4 — the four environments

Eight boards, four environments × two finalists, through the one shared template.

- **1 The Quiet Core.** A calm personal conversation. Both finalists carry the QANDEEL turns in
  the Primary and the human turns in the Secondary; the two speakers stay distinguishable at both.
- **2 The Proprietary World.** The Living Analysis Map. All six nodes are drawn in exactly the
  same two inks with no colour used to make any node look more important, and every label restates
  something the conversation in environment 1 actually contains. The analytical structure survives
  at both finalists; the node titles sit in the Primary and the counts in the Tertiary, and the
  Tertiary's quietness is the same question §1.5 raises, in its most demanding place.
- **3 The Intellectual Test.** Deep analysis reading at the 560 px measure. The board that carries
  the most weight, and the one the blind comparison is cut from.
- **4 The Boring-Screen Test.** The settings screen — no dividers, no cards, no accent, an
  unavailable row that says so in words as well as in tone. **This is the screen where a reading
  value has the least help**, and both finalists hold it: labels in the Primary, values in the
  Secondary, group names and notes in the Tertiary, separated by spacing alone.

Across all eight boards there is no logo, no mark, no glow, no gradient, no shadow, no blur, no
glass, no card, no accent, no brass and no brand light — asserted against the exact markup before
each was rasterised, by 14 refusal patterns. **Neither finalist depends on decorative treatment,
because there is no decoration available to depend on.**

## 6. A3.7 — the finalists do not reverse across raster conditions

The finalists were rendered a second time with the product laid out at **390 CSS px at
deviceScaleFactor 3**, with colour profile, antialiasing and every compositor flag held identical
to the A2 condition. `ROBUSTNESS_MOBILE_P1.png`, `ROBUSTNESS_MOBILE_P2.png` and the side-by-side
`ROBUSTNESS_MOBILE_PAIR.png`.

**The relationship between the finalists is the same in both conditions.** P2 remains the quieter
of the two, both remain fully legible, and nothing about which is which changes. **No blocker.**

`ROBUSTNESS_METADATA_4X.png` puts the same Metadata line from both conditions at the same logical
scale — 6 output pixels per CSS pixel in every tile, so the dpr 2 crop is upscaled 3× and the
dpr 3 crop 2×. At dpr 3 the same 12/20/500 specimen is built from more device pixels and resolves
visibly more solidly. **The A2 condition is therefore the conservative one**: a specimen that
holds there holds at the higher density, not the other way round.

Two limits on this condition, stated rather than glossed:

- The mobile reading measure is **350 px, below the frozen 520–600 comfort zone**, because a phone
  does not have 560 px to give. This condition is a **raster** robustness check, not a
  reading-measure proof. Within it the two finalists are identical to each other, which is what
  the robustness question asks.
- **This is not native validation and does not pretend to be.** Two browser raster conditions
  answer whether the comparison survives a change of raster. Whether 12 CSS px behaves like
  12 native iOS pt is a different claim in a different unit system, and A3 does not make it.

## 7. Units — WCAG CSS points and Apple native points are separate claims

Stated separately and deliberately, carrying forward the I-08B3.1-A2R correction:

**WCAG — CSS units, established by this proof.** Using the CSS typographic relationship
1 pt = 1.333 px, **12 CSS px is 9 CSS pt**. WCAG 2.2 defines large scale as 18 pt or 14 pt bold,
so the Metadata specimen is **ordinary text** and owes **4.5:1**. It measures 5.435:1 and 5.072:1
and passes. This classification is what `A3_MEASUREMENTS.csv` uses, and `tools/a3-measure.mjs`
says so at the line where the conversion happens.

**Apple — native units, NOT established by this proof.** Apple's iOS minimum of **11 pt is a
native platform point**, and the 17 pt default likewise. **This browser render establishes no
parity between a CSS pt and a native iOS pt**, so A3 makes no claim about how close the frozen
Metadata role sits to Apple's minimum. Native size parity must be validated when the Product is
rendered in the real iOS / React Native environment, outside A3.

The two claims are about different things and are never combined into one sentence anywhere in
this package.

## 8. `#101010` remains viable, and remains not canonical

The World Base carried all four environments, both finalists, both raster conditions, the three
failure captures and every reading board, and **exposed no functional failure and no
contradiction**. It is preserved exactly as the brief requires: no search for an alternative, no
micro-adjustment, no second candidate generated because another hex could be.

It is **not confirmed by A3 and is not canonical.** A3 did not re-run A2's generic-charcoal swap
test: the Director settled the World direction after A2R, and re-running a closed question would
be decoration. What A3 adds is narrower and honest — `#101010` did not become a problem when the
reading came down on top of it.

---

## 9. What A3 establishes, and what it does not

| Claim | Status |
|---|---|
| P1 and P2 reproduce exactly from the control by an OKLCH lightness move, hue held | **established** |
| Every candidate clears WCAG 2.2 SC 1.4.3 on both surfaces | **established** |
| Control, P1, P2 and the Secondary meet Apple's 7:1 Dark Mode target on both surfaces | **established** |
| The Tertiary is below that 7:1 target on both surfaces | **established** (5.435:1 / 5.072:1) |
| Both finalists give a more even three-level ramp than the A1 control | **established** as measured OKLCH steps |
| Neither finalist collapses the ramp on these boards | **established for these boards** |
| Metadata 12/20/500 holds materially better than 400 at true size | **established for these two raster conditions** |
| The finalist comparison does not reverse between the two raster conditions | **established** |
| `#101010` exposed no contradiction across every A3 proof | **established** |
| P1 maintains more Primary/Secondary separation than P2 | **established** (0.1280 vs 0.1095) |
| P2 opens more luminous headroom than P1 | **established** (0.1462 vs 0.1277) |
| Which finalist a reader would prefer over a long session | **NOT established** — no participants |
| A perceptual threshold, or a minimum usable ramp step | **NOT established** — not a psychophysical study |
| Any number of usable QANDEEL Light levels | **NOT established** — the probe renders solid fills only |
| Parity between 12 CSS px and 12 native iOS pt | **NOT established** — browser raster |
| Behaviour under varied ambient lighting | **NOT established** — not tested |
| That `#101010` is the right World value | **NOT established by A3** — it is preserved, not confirmed |

---

## 10. Open questions for the Design Director

1. **Which finalist closes B3.1-A?** The trade-off is stated and quantified: P1 keeps more
   Primary/Secondary separation (0.1280 vs 0.1095); P2 opens more headroom above the reading
   (0.1462 vs 0.1277) and lands closest to an even ramp (0.956 vs 1.117). Both hold every proof.
   A3 does not choose.
2. **Is `#101010` confirmed?** A3 preserved it and found no contradiction. Confirming it is a
   Product decision.
3. **The Tertiary is below Apple's 7:1 for small custom-coloured text.** A3 was forbidden to
   brighten it and did not. Does the Director want that gap closed at a later stage, accepted as
   a deliberate quietness, or re-examined once QANDEEL Light exists?
4. **Metadata weight 500 in the Product.** A3 used it because the frozen role permits it and the
   raster supports it. Should 500 become the standing Product usage for Metadata, with 400
   reserved, or does that belong to a later typography-application stage?
5. **Native validation is outstanding.** Nothing here establishes native point parity. When
   should that be run, and against which device class?
6. **The Analysis Map has no phone layout.** A3 refused to invent one rather than improvise a
   design decision it has no authority to make. That is a real gap in the Product, and it belongs
   to a later stage.
