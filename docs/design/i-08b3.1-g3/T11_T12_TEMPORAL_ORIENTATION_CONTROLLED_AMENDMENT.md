# QANDEEL — T-11 / T-12 Controlled Amendment
## The Temporal Orientation Line Belongs to the Timeline

**Status:** `CANONICAL CONTROLLED AMENDMENT — FROZEN WITH I-08B3.1-G3`\
**Amends:** `docs/responsive-recomposition-v1.md` (T-11) §3, "The world is sized first, at half — and the support
yields", including its T-12 correction paragraph; and `docs/final-living-analysis-map-integration-v1.md` (T-12) §5,
"Final composition". Nothing else in either document\
**Resolves:** G2 closure §E "Placement boundary (G2.1 seam S-04)" and the G3 handoff §7 row for orientation placed above
the Timeline\
**Does not amend:** T-08 (any Return meaning, offered set, order, label, hint, executor, or any temporal word); T-05,
T-06, T-07, T-10; the T-12 canonical state and historical firewall; the G2.3 «طرق العودة» amendment\
**Closure record:** `docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`\
**Product proof:** `I-08B3.1-G3.2-TARGETED-COHERENCE-REFINEMENT`, ZIP SHA-256
`D6AF79DAEEE0B6F09197084E8E35961112B5A30BC2B4CF2524D1FD2B769CE9B0`, preserved at
`docs/design/canonical-artifacts/product-proofs/g3/g3.2/`

This record is additive. `docs/responsive-recomposition-v1.md` and `docs/final-living-analysis-map-integration-v1.md`
remain the historical closure records of T-11 and T-12, and their bytes are not changed. For the placement and yield
question below, this later record is authoritative. The binding takes effect on the merge of the pull request that
carries it.

---

## 1. Why an amendment is needed

Two frozen statements placed T-08's temporal orientation sentence **below** the Timeline:

- **T-11 §3:** the composition is the column [world, temporal surface, chrome], and T-08's orientation, temporal line
  included, lives in the chrome.
- **T-12 §5:** `ResponsiveTimelineRow → TemporalTargetLayer`, then `ResponsiveChromeBand → OrientationChrome`.
  OrientationChrome renders T-08's orientation, the temporal sentence included.

G3.1 found the cost of that in the canonical column (G3.1 finding F-04, question N1): while PINNED, the Track stood
between the sentence «أنت عند اللحظة 14…» and its own way back, the Live-edge act. The G2 proofs had moved the whole
orientation above the Timeline, which G2 §E recorded as evidence only.

The Product Owner chose the narrower composition, G3.2 proved it, and independent Product review accepted it.

## 2. The composition

```text
Living Analysis World
→ temporal orientation line      (only when truthful temporal context exists)
→ Timeline / Temporal Surface    (the Track; Return Live at the Live edge)
→ OrientationChrome              (the rest of T-08's orientation; «طرق العودة» and the other Return acts)
```

1. **The line belongs spatially to the Timeline / Temporal Surface region.** It stands directly above the Track, at the
   top of the Timeline row, and moves with that row.
2. **T-08 still owns its words, its presence and its truth.** The line says exactly T-08's temporal sentence, from
   T-08's one copy file, under T-08's conditions. No new copy source exists, and no sentence is rewritten.
3. **It covers both kinds of temporal context:**
   - `PINNED`: T-08's pinned sentence, with its second sentence only when the conversation did continue;
   - a temporary Moment preview: T-08's preview sentence, which says what is being looked at and that the reader's own
     position has not moved (T-08 §13).

   It appears only when that context truthfully exists. Following Live, it renders nothing and holds no gap (G3.2 K11).
4. **Said once.** OrientationChrome no longer renders the temporal line. It keeps every other part of T-08's
   orientation: the inspection line, context, «طرق العودة», and every other Return act permitted by the G2.3 T-11
   amendment.
5. **Return Live keeps its one canonical home, the Live edge.** It is not duplicated inside «طرق العودة» (T-11
   amendment §2, condition 8).

### The amended T-12 §5 tree

```
ProductRoot
  └── ResponsiveSurface
        ├── ResponsiveMapFrame    → MapSurface                              (T-04)
        ├── ResponsiveTimelineRow → T-08's temporal orientation line, then
        │                           TemporalTargetLayer                     (T-06 over T-05)
        └── ResponsiveChromeBand  → OrientationChrome, without the temporal line (T-08)
```

The row owns the line's **placement**. T-08 owns what it **says** and **whether it exists**. No component name, prop or
file is prescribed here.

## 3. Sizing and the yield order

The world is still sized first, exactly as T-11 §3 says: `max(MAP_MIN_HEIGHT_POINTS, usableHeight / 2)`, with
`MAP_MIN_HEIGHT_POINTS = 160`. The line is support, and it is paid for by the support, never by the world.

The reviewed yield rule:

1. **The world floor is authoritative.** No support region, and no fixed minimum of any support region, may take the
   world below it.
2. **The temporal line and Return Live never scroll away.** They are never inside a scroller.
3. **OrientationChrome yields first.** It clips to the room it is given and keeps the rest reachable by scrolling
   inside its own region, as T-11 §3 already requires of every support region.
4. **No fixed OrientationChrome minimum may squeeze the world below its floor.** `CHROME_FLOOR_POINTS` keeps its T-11
   role as an input to `SHORT_HEIGHT_POINTS`. It is not an allocation that outranks rule 1.
5. **The line's measure keeps T-08's longest reviewed temporal sentence to two lines** at the reviewed narrow phone
   width (320 pt), in Arabic and in English, without rewriting the sentence. G3.2 did this by letting the line run
   closer to the end edge than the chrome's end padding (F-09).

### Exact supersession inside T-11 §3

| T-11 §3 text | Now reads |
|---|---|
| "a column of [world, temporal surface, chrome]" | a column of [world, temporal surface with its temporal orientation line at its top, chrome] |
| T-12 correction: "The plan now computes the room each support region gets — from the measured surface and these two minimums" | unchanged, except that the orientation minimum may never take the world below its floor (rules 1 and 4) |
| T-12 correction: "the instrument still yields at twice the orientation's rate" | superseded only where it would take room from the temporal line or Return Live before OrientationChrome has yielded (rules 2 and 3) |

Everything else in T-11 stays in force. Only the stacked arrangement was reviewed; below `SHORT_HEIGHT_POINTS`,
T-11's across-composition is unchanged, and the line still belongs to the temporal region there. That includes:
- the bands, `EXPANSIVE_MIN_WIDTH`, `SHORT_HEIGHT_POINTS`, the chrome measure clamp and hysteresis;
- the Map and Timeline invariants;
- the responsive motion policy;
- RTL;
- Dynamic Type;
- the across-composition below `SHORT_HEIGHT_POINTS`.

### The evidence, stated from the final checks

G3.2 check **K14** measured the world in 37 Analysis captures, with 0 failures. The tightest reviewed case is
**320 × 568, in a Live Call, PINNED**, with and without «طرق العودة» open:

> **161 pt of world against the 160 pt floor.**

The closest margin to the half-height rule is capture `s320-near-open` at 320 × 568: 192 pt against 191.5 pt.

Two passages of candidate prose inside the preserved package describe the call-and-PINNED case as sitting on its floor
with nothing to spare: `G3.2_PRODUCT_DECISIONS_PROVED.md` (Decision B, "Paid by the support") and
`G3.2_INTEGRATION_FINDINGS.md` (F-08). The final measured check data above supersedes that prose. The preserved bytes are
not edited.

## 4. Presentation craft accepted, not frozen as tokens

- **The legibility falloff.** While the line is shown, the world's own material falloff may strengthen locally
  beneath it, so the line has the same ground every chrome word has. Its limits:
  - it is not a card, banner, Surface or Light veil;
  - it changes no I-08B1 world pixel or truth (K06, K07);
  - the proof's `.88` stop is craft evidence, not a Product value.
- **Motion.** The line resolves in and out with its state. It never translates or travels on its own (K23). Under
  Reduced Motion it keeps the same truth with no movement (K22). General and final motion stay with T-10. The proof's
  durations (220 ms / 140 ms, and 140 ms / cut under Reduced Motion) are evidence, not frozen quantities.
- **The Live-edge act's box.** The proof began the act's hit box at its label row, so its target and focus indicator
  never cover the line (F-02). Frozen here is only the requirement that no act's target or focus indicator covers the
  line. The 44 pt minimum target is unchanged.

## 5. Accessibility, direction and digits

- **Order.** Reading order and focus order equal visual order: the line is reached before the Timeline's controls, then
  the Timeline, then OrientationChrome (K25).
- **It is text, not a control.** The line adds no Return act.
- **«طرق العودة» is unchanged.** Its requirements stay exactly those of the G2.3 T-11 amendment §4:
  - 44 pt targets;
  - expanded-state truth;
  - visual order = focus order;
  - T-08 order;
  - focus recovery;
  - Reduced Motion parity.
- **Direction.** The line starts at the reading-start edge, and Return Live stays at the Live edge on the end side, in
  both directions (K27). Placement is stated in start / end terms, never left / right.
- **Digits.** Moment numbers use the one locale authority's numeral policy (T-12 §9). This record sets no digit or
  calendar policy.
- **Copy.** No English or Arabic word is added, changed or translated.

## 6. What this record does not change

- **T-08:** its six Return meanings, the offered-set derivation, canonical order, labels, hints, executors, and every
  temporal word.
- **The Timeline:** its semantics, T-05's Track and step, T-06's preview and targeting, T-07's executors.
- **T-12:** the canonical state, one store, the historical Live firewall, the locale authority.
- **T-11:** its world-first sizing and responsive truth, apart from §3's statements listed above.
- **The G2.3 amendment:** «طرق العودة» stays the only permitted Return grouping, beside a directly visible dominant act.

## 7. Implementation status

This record freezes the Product / composition contract only. It does **not** claim that production `ResponsiveSurface`,
`TemporalTargetLayer`, `OrientationChrome` or `ReturnControls` implement it. No production, runtime or test file is
changed by it.

A later implementation must show the yield rule on devices, including at large text on the narrowest phone (G3.2
finding F-08). The proof harness could not exercise that path, so the rule is correct by construction there but
unmeasured. That evidence belongs to the implementation. It does not reopen this Product decision unless it shows a
Product contradiction.

> **T-11 / T-12 TEMPORAL ORIENTATION CONTROLLED AMENDMENT — FROZEN**
