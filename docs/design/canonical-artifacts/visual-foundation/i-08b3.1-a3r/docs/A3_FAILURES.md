# I-08B3.1-A3 — FAILURES

> **Evidence class.** A3 is a set of **controlled browser renders under two raster conditions**.
> No participants, no perceptual measurement, no native platform validation. Everything below is
> scoped to what these boards show under these conditions.

Failures are rendered and measured, not polished away. Three are shipped as captures in
`review/failures/`. Five more are defects **in this package's own tooling** that were found and
fixed during the run, and they are recorded because a proof whose method is not auditable is not
a proof. The last section lists what A3 simply cannot answer.

---

## 1. Shipped failure captures

### 1.1 The Tertiary is below Apple's Dark Mode 7:1 target — in exactly the case Apple names

`review/failures/FAILURE_TERTIARY_BELOW_APPLE_7TO1.png`

**The failure.** Apple's Dark Mode guidance says: "At a minimum, make sure the contrast ratio
between colors is no lower than 4.5:1. **For custom foreground and background colors, strive for
a contrast ratio of 7:1, especially in small text.**" *(Corrected at A3R — see
`A3R_REVISION_RECORD.md`.)* QANDEEL's current canonical visual expression is **dark-led** —
the frozen Visual Constitution is **DARK-LED, NOT DARK-LOCKED**, so the architecture remains
theme-capable — and this A3 proof evaluates custom foreground/background colours in that dark
expression. In that expression the Tertiary carries the Metadata role at 12/20, which *is* the
small text Apple's qualifier names.

Measured: **`#8b8982` reaches 5.435:1 on the World Base and 5.072:1 on the diagnostic Subtle.**
Both clear WCAG 2.2 SC 1.4.3's 4.5:1. Neither reaches 7:1. Every other reading value in the
system — the control, P1, P2 and the Secondary — meets it on both surfaces.

**Why it is not closed here.** A3 is explicitly forbidden to brighten the Tertiary to compensate
for a weight problem, and is forbidden to search for a new Tertiary. It did neither. The only
lever the brief permits is the 500 weight already inside the frozen role, and weight is not
contrast: heavier strokes do not change a ratio.

**Scope.** This is **not** a WCAG failure and is not caused by either finalist. It is a property
of the unchanged Tertiary and is identical under P1 and under P2 — which is why the capture is
rendered once rather than twice, and the capture says so on the board. It is an open item for the
Design Director, listed as open question 3 in `A3_FINDINGS.md`.

> **A3R note — where this item went.** The Design Director has kept `#8b8982` in the neutral
> system and **routed this item onward rather than closing it here**: the semantic rule for when
> small Metadata uses Secondary versus Tertiary belongs to **I-08B3.1-B — Surface / Content
> Hierarchy Refinement**, and accessibility-expression behaviour belongs later to **B3.1-F**.
> Nothing in A3's use of the Tertiary for 12/20 in these proofs is an application rule: it is a
> proof usage, and **A3 does not declare that every 12/20 Metadata instance canonically uses
> Tertiary**. The Tertiary was not brightened, no new Tertiary was created, and no further colour
> candidate was created. See `A3R_REVISION_RECORD.md`.

### 1.2 Metadata at weight 400 is visually fragile at true size

`review/failures/FAILURE_METADATA_400_IN_PRODUCT.png`, with the pixel-level evidence in
`review/METADATA_MAGNIFIED.png`

**The failure.** A real ENVIRONMENT 3 screen, identical in every respect to `ENV_P1_3_DEEP.png`
except that Metadata is drawn at weight 400 instead of 500 — the condition A2 measured. Same size,
same leading, same tracking, same Tertiary colour, same measure.

At 4× nearest-neighbour magnification **of the pixels Chrome actually drew**, the 400 specimen's
thin joins and fine strokes fall away; at 500, at the same colour, the letterforms hold as
continuous shapes. This reproduces A2's finding at A3's conditions rather than citing it.

**What was done about it.** A3's Product proofs use weight 500, which is **already inside** the
frozen 12/20/400–500 role. Nothing about the typography system was reopened: no size, no leading,
no tracking, and no colour change. Weight 400 survives as a control on `METADATA_TRUE_SIZE.png`
and in this capture, so the change stays traceable rather than assumed.

**What it does not fix.** §1.1. Weight is not contrast.

### 1.3 The zero-separation control — what a collapsed ramp actually looks like

`review/failures/CONTROL_COLLAPSED_HIERARCHY.png`

Not a failure of a candidate: a **floor** the A3.2 question is measured against. The Primary is
set to the Secondary value `#afaca3`, so the top two levels of the reading ramp are literally the
same colour. Nothing else differs from ENVIRONMENT 3.

It exists because `ui-ux-pro-max`'s `visual-hierarchy` rule — "establish hierarchy via size,
spacing, contrast, not colour alone" — cuts both ways: a claim that a ramp *holds* needs
something to hold against. Any Primary candidate that could not be told apart from this panel
would have compressed the hierarchy too far. Neither finalist resembles it.

---

## 2. Defects in this package's own tooling, found and fixed during the run

### 2.1 The mobile raster was silently cut, and the reported boxes caught it

**The defect.** Chrome on Windows refuses a browser window narrower than roughly 500 CSS px. The
first mobile render asked for `--window-size=390`: the raster came back at exactly 390 × dpr 3 =
1170 px wide, the width assertion passed, the blank-render guard passed, and the board *looked*
plausible. But the layout viewport was 488, the RTL root pushed the 390 px document to the right
of it, and the capture took x 0–390 — so **the right-hand end of the product was off the raster
and a strip of page background was on the other side**.

**How it was caught.** Not by looking at it. The reported element box for the Metadata line came
back as `x 118, width 350` inside a 390 px capture — a box whose right edge is at 468. A magnified
crop anchored on that box produced a tile with an unexplained empty band, and chasing the
discrepancy between the reported geometry and the raster is what exposed it.

**The fix.** The product frame is laid out at a fixed 390 CSS px inside a deliberately wider
780 px window, the body is set LTR so a narrower-than-viewport block starts at x 0
deterministically, and the frame is **cut out of the raster by its own reported box**. `render()`
asserts the frame laid out at 390 before cropping. Preflight check 12 records both numbers so the
host constraint is in the record rather than hidden by it.

**Worth carrying forward:** a raster whose *dimensions* are right is not a raster whose *contents*
are right.

### 2.2 A magnification crop anchored on the element box cut the first word off every specimen

**The defect.** The first magnified tiles were cropped `rect.x + rect.w − cropWidth`, i.e.
anchored on the paragraph's border box. An RTL paragraph's box is the full column width while its
glyphs occupy only part of it, and the two edges do not have to coincide in every context.

**The fix.** `inkExtent()` scans the reported box for the rightmost **inked** column — luminance
above the known surface by a margin, so an antialiased glyph edge counts and a quantisation wobble
in the ground does not — and every tile is cut from there. Whatever the box says, the crop now
ends where the glyphs end. This is the same family of defect A2 hit from the other direction, when
a missed CSS class sent an RTL crop into empty ground.

### 2.3 The failure captures were overwriting the fingerprints of the boards they are captures of

**The defect.** The fairness fingerprint is keyed by candidate, environment and raster condition.
Two of the three failure captures are also P1 / deep / A2 condition, so they overwrote the
fingerprint of `ENV_P1_3_DEEP` — and the collapsed-hierarchy control, whose longer explanatory
header pushes the frame down the page, then appeared in the comparison as a **structural
difference**. The fairness proof failed, correctly, on a board that was not actually unfair.

**The fix.** Only the shipped environment boards feed the proof. A capture is evidence about a
defect, not a member of the A/B comparison, and `a3-boards.mjs` says so at the line that decides
it. The proof then passes on the merits: 12 / 39 / 15 / 38 elements, identical, in both raster
conditions.

**Worth carrying forward:** the test was right and the harness was wrong — which is the opposite
of the A2 case where the board was right and the test was wrong, and both are worth remembering.

### 2.4 The anti-accent scan reported its own refusal machinery

**The defect.** Preflight check 6 scans every text file for later-stage vocabulary — brass,
lantern, gold, glow, bloom, aura, halo — used affirmatively. It flagged three lines of
`tools/a3-env.mjs`: the table of **refusal patterns that exists precisely to forbid those words**,
and the comment naming the Glow-Off test.

**The fix.** The scan exempts a negation and exempts the refusal machinery itself, and says why in
the code. This is the same move `a2-package.mjs` made when it excluded itself from its own hex
scan: the file that defines the needles will always contain the needles. The substantive proof is
the chroma census of what is actually painted, which never had this problem.

### 2.5 A failing preflight wrote its own failure into the file it scans next time

**The defect.** Preflight check 7 scans every text file in the package for the ten retired
thesis B and thesis C hex values. When it fails it prints the offending values into
`docs/A3_PREFLIGHT.md` — which is a text file in the package. The next run then found them there
and failed again, on evidence it had manufactured itself. A single real failure became permanent
and its origin became untraceable.

**The fix.** Three files are excluded from the needle searches and the exclusion is named and
explained in the code: this preflight and the packager, because both *define* the needles and a
scanner that reports itself teaches nothing, and **the preflight's own output document**, because
a check must not be able to poison its own next run. Removing it structurally is the point —
deleting the stale file by hand would have made the run pass while leaving the trap armed.

**Worth carrying forward:** any check that writes a report into the tree it inspects needs to
exclude that report, or its first failure becomes its last useful one.

---

## 3. What A3 cannot answer

Listed explicitly, because an omission reads as an oversight rather than as a limit.

- **Which finalist a reader would prefer over a real reading session.** That is a property of a
  person reading for minutes. A3 has no participants and makes no such claim. Both finalists
  sustain a full page of Arabic on these boards; that is a different and much weaker statement,
  and it is the one A3 makes.
- **Any perceptual threshold.** No minimum usable ramp step, no "below threshold" for any
  lightness difference, no claim about what a smaller step would do. A3 is not a psychophysical
  or JND study.
- **Native platform behaviour.** Two browser raster conditions do not establish parity between a
  CSS pt and a native iOS pt, and do not validate Apple's 11 pt minimum for this Metadata role.
  Named and deferred, not answered.
- **Ambient lighting.** Apple's own guidance asks for testing under varied lighting conditions,
  and notes that in dark environments colours appear brighter and more saturated. A3 renders in
  one fixed condition per raster. Untested.
- **The Analysis Map on a phone.** Its node positions are a fixed composition authored for an
  848 px content width. Re-laying it out for a 350 px column would be a new design decision about
  how the Living Analysis Map behaves on a phone, and A3 has no authority to make it.
  `productFrame()` **refuses** the combination rather than improvising, and that refusal is a real
  Product gap belonging to a later stage.
- **Whether `#101010` is the right World value.** A3 preserved it and found no contradiction
  under it. That is not the same as confirming it, and A3 does not confirm it.

---

## 4. What did NOT fail

Stated because failure-first reporting can leave a false impression if the passes are implicit.

- The fairness proof passed on the merits in **both** raster conditions, element by element.
- All 12 preflight checks passed, including the two the Reference Gate added.
- All 40 known-answer colour tests passed in this tree.
- Every colour in the package is inside the sRGB gamut, so **no gamut-mapping algorithm is ever
  invoked** — which matters because the current CSS Color 4 draft names three and lets an
  implementation choose.
- Every authored colour is painted bit-identically in the rendered PNG.
- The Estedad binary matched its pinned hash and the variable `wght` axis was live in every
  render, which is what makes the 400/500 comparison meaningful at all.
- Arabic direction and zero tracking were verified from **computed style on a real render**, not
  asserted from source.
- `#101010` carried every environment, both finalists, both raster conditions and all three
  captures without a functional failure.
