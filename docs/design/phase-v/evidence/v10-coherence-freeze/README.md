# V10 — Cross-Screen Coherence Freeze · Reviewer Stress Harness

**NON-CANONICAL.** Phase V — Visual Language Discovery, task V10.
Not a visual language, not an art direction, not a design system, not production code.
**No canonical visual decision is taken here, and V10 does not freeze QANDEEL's appearance.**

Open `index.html` directly in a browser. No build, no server, no dependency, no network
request (system fonts only; no webfont, no image, no generated artwork).

**Read `TRUTH-MANIFEST.md` before reviewing anything.** Two of the fixtures in this
harness are *simulated test density* built to break the grammar. They are not user data
and must never be read as runtime output.

---

## What this is

V10 is the freeze gate for Phase V. It does not redesign V9. It takes V9's grammar,
puts it under the density, peer count, language length and state pressure the runtime
actually permits, and reports what survived.

The harness contains exactly four things beyond V9:

1. **Reviewer stress fixtures** — dense, three-peer, five-item context field, long
   Arabic — declared simulated.
2. **The minimum structural adaptation** those fixtures proved necessary: an N-peer
   stage instead of a hardwired two-peer stage, and a shared-material region that can
   hold more than one shared record.
3. **A falsification self-check** that asserts the properties the freeze depends on.
4. **Reviewer chrome** — the evaluator strip and a stress-state picker.

Palette, type stack, spacing, radii, object forms, motion curves and the exact margin
artwork are carried from V9 **byte-for-byte** and remain temporary.

---

## How to review

### Reviewer routes

The numbered buttons `1`–`17` in the dark evaluator strip are the review states. The
strip is **not product UI**.

```
 1  v9-reference-home-375              10  three-peer-analysis-375-peer-3
 2  v9-reference-conversation-375      11  three-peer-shared-material-375
 3  v9-reference-live-context-375      12  live-context-five-items-375
 4  v9-reference-analysis-two-peer-375 13  long-arabic-analysis-375
 5  dense-analysis-desktop             14  correction-resize-stability-375
 6  dense-analysis-375                 15  shared-target-navigation-375
 7  three-peer-analysis-desktop        16  three-peer-below-column-floor   (optional)
 8  three-peer-analysis-375-peer-1     17  dense-analysis-desktop-foreground (optional)
 9  three-peer-analysis-375-peer-2
```

States 1–4 reproduce V9's own states on V9's own fixture, unchanged, so the stress
states can be compared against the accepted baseline in one place. States 16–17 are
optional and exist because they carry evidence the freeze decision rests on: 16 is the
state that proves the column-floor rule does not invent a hierarchy, 17 is the
non-ordinal audit at density.

### Deep links

`index.html?r=<route-name>` reproduces any state exactly. `;` is accepted instead of
`&` so the link survives shells that treat `&` as a control character.

```
index.html?r=three-peer-analysis-375-peer-3;shot=1
index.html?r=dense-analysis-desktop;gray=1;rm=1
index.html?state=p3;view=scene;narrow=1;pane=3
```

- `shot=1` hides all reviewer chrome and pins the clamped 375px frame to the capture
  origin. It changes nothing inside the frame.
- `probe=check` runs the self-check and prints the result into the page title and a
  small overlay, so a headless run can be verified without reading a screenshot.
- `probe=geom` prints the live stage geometry — stage mode, column widths, pane list,
  pager labels, the measured column floor, band heights.

### Toggles

`375px` (frame clamp — behaves exactly like a 375px viewport, because every layout
decision is keyed on `body[data-w]` / `body[data-stage]` and never on a media query),
`1000px col-floor` (a wide viewport with a narrow content column, used to reach the
measured floor), `Grayscale`, `Reduced motion`, `Mark simulated`, `Long Arabic`,
`Truth manifest`, `Truth + freeze self-check`.

`Long Arabic` is not V9's subject-only swap. It replaces the subject anchor, the peer
statements **and** several recorded fragments with long forms carrying Arabic
punctuation, because §13 asks for all three at once.

### The stress-state picker

The floating dark pill at the bottom flips between the four stress states plus the V9
reference. Number keys `1`–`5` switch, `←`/`→` step, `R` re-mounts. It is harness
chrome and is hidden under `shot=1`.

Its markup, styles and highlight behaviour are the `prototype` skill's `PICKER.md`
spec, verbatim. Two behavioural deviations were required and are deliberate:

- it persists `?r=<route>` instead of `?v=<n>`, so a reload reproduces the exact
  reviewer state in the deep-link form the rest of the phase already uses;
- its `←`/`→` handler stands down while focus is inside the paged stage, where those
  keys already page between peers.

The picker is **not** used for divergent directions. V10 has no variants: there is one
build and the picker addresses stress states.

---

## The self-check

`Truth + freeze self-check` runs against the live DOM and the live fixture in whatever
state is on screen. It carries every V9 assertion unchanged and adds the ones the V10
freeze depends on — including the three that would have caught the V9 defects below.

**2,955 / 2,955 pass** across 17 routes × 5 modes (plain, grayscale, reduced motion,
long Arabic, 375 clamp): 591 assertions per mode.

Added in V10:

- every peer reading is present on the stage, and every pane has its own pager control;
- peer columns are equal in width, and none is below the Arabic measure floor;
- every role line in the shared region sits in **its own** reading's column;
- no two shared records occupy the same space, and each has real height;
- no pager label is clipped;
- every item in the context field is identical at rest, and nothing is brought forward
  unless the reader did it;
- no reading role is stated outside Deep Analysis;
- every pressable target is at least 44px tall, and focus order is DOM order;
- composer draft, caret, focus, current peer and open disclosures all survive a real
  breakpoint crossing;
- foreground survives a benign recomposition;
- the correction sheet is a real modal, takes initial focus and returns it;
- reduced motion changes nothing that carries meaning.

Run it on a settled state.

---

## What this harness fixes, and why V9 is untouched

Three defects were reproduced **in V9** by measurement. None is reachable from V9's own
fixtures, because V9 never holds more than two readings or more than one shared record.
They are fixed here and **V9 is byte-unchanged**.

| | Defect in V9 | Measured |
|---|---|---|
| **B1** | 3+ peers: readings beyond the second are dropped from the paged stage — no pane, no pager entry, no trace | panes `[أ, المشترك, ب]` with three readings loaded |
| **B2** | 3+ peers on desktop: unequal columns, and the third peer's role line lands in the first peer's column | columns `260 / 260 / 408px`; ج's role line at x=972, identical to أ's |
| **B3** | 2+ shared records: every band pinned to `grid-row:3`, painted on top of each other | two bands, both `top 654 → bottom 843` |

Five more were found while building the stress states and are fixed here; they are
listed with their evidence in `QANDEEL_V10_COHERENCE_FREEZE_REPORT.md` §3.

---

## Review screenshots

`review-screenshots/` was captured from these routes with `shot=1`, at 2× device pixel
ratio, 1280px CSS for desktop states and 375px CSS for narrow states. Actual rendered
states, unedited, no annotation, no decoration.

The dense and three-peer screenshots show **simulated test density**. The filenames say
so and `TRUTH-MANIFEST.md` records the boundary; nothing is stamped onto the images,
because a stamp would be screenshot decoration.

---

## Do not freeze

Palette, type stack, radii, spacing, surfaces, object forms, the exact margin artwork,
navigation labels, motion curves, the Arabic-Indic numeral choice and every measure
value in this build are **temporary**. They exist only to test the structural grammar.

What V10 proposes to freeze — and what it explicitly leaves open — is in
`QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md`.
