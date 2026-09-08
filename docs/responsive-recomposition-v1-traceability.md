# QANDEEL — Responsive Recomposition v1 (T-11) — Traceability

Every frozen invariant, every doctrine rule, `T11-A01…A80`, `PM-01…PM-30`, every static guard and
every Definition-of-Done clause, mapped to exact code, an exact test, a static proof, a visual proof
or `STRUCTURALLY IMPOSSIBLE` with its reason.

**No proxy proof.** A screenshot is not semantic parity. A semantic `deepEqual` is not an accessible
focus order. Unchanged coordinates are not the absence of a one-frame snap. An RTL screenshot is not
a 1:1 scrub. "No canonical import" is not "no consumer dispatch". Browser layout is not native
Dynamic Type. An idle test is not a mid-travel resize proof. Where a claim can only be made by one
kind of evidence, that is the evidence cited — and where the evidence does not exist yet, the row
says so and points at `QAN-BL-RSP-01`.

## Legend

| Token | Meaning |
| --- | --- |
| `plan` | `apps/mobile/src/responsive/__tests__/plan.test.ts` |
| `map` | `apps/mobile/src/responsive/__tests__/map-resize.test.tsx` |
| `time` | `apps/mobile/src/responsive/__tests__/timeline-resize.test.tsx` |
| `chrome` | `apps/mobile/src/responsive/__tests__/chrome-resize.test.tsx` |
| `cont` | `apps/mobile/src/responsive/__tests__/continuity.test.tsx` |
| `inset` | `apps/mobile/src/responsive/__tests__/inset-settlement.test.tsx` (R1) |
| `static` | `tests/t11-responsive-contract.test.mjs` |
| `fwd` | `tests/forward-safety-contract.test.mjs` |
| `visual` | the 27 rendered frames of `apps/mobile/src/responsive/__tests__/visual-proof.test.tsx`, covering §25 of the execution contract |
| `SI` | `STRUCTURALLY IMPOSSIBLE`, with the reason given |

---

## 1. Frozen invariants T-11 had to preserve

| Frozen contract | Where it is preserved | Proof |
| --- | --- | --- |
| T-04 §5 — resize recomputes the visible footprint only | `map/camera/viewport.ts` unchanged | `map` 1–2; `static` "the Map world is never mirrored, and never refits itself to a window" re-anchors the law's own words |
| T-04 §5 — no recenter, no zoom-to-fit, no compaction, no redistribution | no such call exists in `map/**` or `responsive/**` | `static`; `map` 1 |
| T-04 §6 — one completed drag is one `PAN`, from the finger's own translation | `map/camera/pan.ts`, `useMapPanGesture.ts` unchanged | `map` "T11-A21…A25" |
| T-04 — the ungeographic register is screen space | `map/renderer/map-geometry.ts` unchanged | `map` 4; `static` (register culled against rest) |
| T-05/T-06 §FCR-03 — ONE logical↔physical geometry, one mirror | `presentation-geometry.ts` unchanged | `time` "T11-A39"; T-06's own `rtl-geometry` suite still green |
| T-06 — `Moment(LH)` is not the Live Edge; the outboard slot is not a Moment | `TemporalTargetLayer.tsx` unchanged | `time` "T11-A29, T11-A30" |
| T-06 R1-02 / FCR-01 — the interaction epoch machine | `scrub.ts` unchanged; the new guard uses its `settle(epoch, false)` route | `time` (all five ownership tests); `static` §5 |
| T-07 — the six return acts and their execution | untouched | `chrome` parity matrix; full mobile suite green |
| T-08 §12.1 — the semantic model, offered set, order and words | untouched; the arrangement selects a style only | `chrome` "T11-A41…A43" × 4 axes; `static` "the arrangement seam" |
| T-08 §11 — the chrome reads no width, breakpoint or layout | still true; the arrangement is a token, not a measurement | `chrome` "reads no width, breakpoint or dimension"; `static` truth-module guard |
| T-08 — every control ≥ 44 points, nothing truncated | `minHeight: 44` floor kept in both arrangements | `chrome` "T11-A44…A49" |
| T-10 — nothing teleports; meaning resolves | the rigid-shift algebra | `cont` "T11-A59" |
| T-10 — presentation culling is conservative | corridor rebased by the transition, never by the envelope | `cont` "T11-A61"; `static` "a travel in flight is neither re-issued nor re-culled" |
| T-10 — an arrival is a membership transition, never a mount | membership asked of the scene | `cont` "T11-A63, T11-A64" |
| Phase VI VI-02 F-01…F-12 | no navigation, density or disclosure behaviour changed | `chrome` parity matrix; `static` (no width-driven disclosure decision) |

---

## 2. Responsive doctrine

| Rule | Realisation | Proof |
| --- | --- | --- |
| The window changes, the world does not | canonical camera, `V`, Home addresses and RH untouched by any envelope | `map` "T11-A01…A07"; `plan` |
| The world is the subject, not the backdrop | the world is sized first at `max(floor, usable/2)` with `flexGrow: 1, flexShrink: 0`; both support regions yield, clip and keep their overflow reachable | `static` "the world is sized first, and the support around it yields"; `cont` "the world keeps its floor, and the support around it yields and stays reachable"; `visual` C7–C9 |
| A layer asserts no number it cannot know | no region carries a height ceiling; the vertical arithmetic is the layout engine's | `static` (same test); `plan` "composes every case" pins the chrome composition's exact key set |
| Recompose density, never meaning | the plan carries layout quantities only; no Product vocabulary can be spelled in it | `static` "the owner holds no Product vocabulary" |
| The world gets priority when space is scarce | whitespace, wrapping, band gap, pairing, then the Map shows less — with a floor | `plan` "composes every case"; `cont` "the world keeps its floor" |
| Wide does not mean dashboard | same acts, same word count, bounded measure, no new surface | `chrome` "T11-A48" |
| Compact does not mean simplified truth | identical model, acts, order, words at C1 | `chrome` "T11-A41…A43" |
| Breakpoints are consequences, not identities | two bands, both derived; no device token anywhere | `static` "no device, brand, model or platform"; `plan` |
| Continuous resize is direct manipulation | no animation, no easing, no timer in the owner | `static` "T-11 invents no motion vocabulary" |
| Measured container, never the display | three measuring containers; no display API anywhere | `static` "no reusable surface takes the display as its authority" |

---

## 3. `T11-A01 … T11-A80`

### Responsive authority

| ID | Proof |
| --- | --- |
| A01 resize writes no canonical state | `map` "T11-A01…A07" — store identity across a double sweep of C1…C9 plus inset changes; `static` (the owner can reach no store) |
| A02 resize appends no RH | same test — `history` length 0 throughout |
| A03 no `PAN` dispatched | same test; `SI` — `static` proves the owner names no executor and imports only `react`/`react-native` |
| A04 no semantic `ZOOM` dispatched | same |
| A05 no Return dispatched | same |
| A06 no `TC`/`TM` change | `map` "T11-A01…A07"; `time` "T11-A26…A33" |
| A07 no `V` change | same tests — the scene and the disclosed Track are identical by identity |
| A08 safe-inset change presentation-only | `plan` "T11-A08, T11-A09"; `chrome` "T11-A08" (padding moves, words do not) |
| A09 font-scale change presentation-only | `plan` "T11-A08, T11-A09"; `chrome` "T11-A56…A58" |
| A10 repeated measurement idempotent | `plan` "T11-A10" (band fixed point over 1160 widths) and "repeated identical measurements" (plan identity); and after R1 also across the inset authority — `inset` "R1-A04" proves six identical inset props produce the same plan OBJECT |

### Geography / Map

| ID | Proof |
| --- | --- |
| A11 Home coordinates equal across C1…C9 | `map` 1 — camera-relative offsets identical at all nine cases |
| A12 Map world unmirrored under RTL | `map` 3 — `placeScene` byte-identical with `I18nManager.isRTL` true; `static` (no direction token in `map/**`) |
| A13 larger viewport reveals footprint without reflow | `map` 2 — footprint grows around the same centre; offsets unchanged |
| A14 smaller viewport shows less without recenter | `map` 1–2 |
| A15 no fit-to-content | `static` — no `fitTo`/`fitBounds`/`zoomToFit`/`autoFit` in `map/**` or `responsive/**`; `map` 1 |
| A16 no width-derived Home redistribution | `map` 1 — node keys and relative offsets identical |
| A17 register remains screen-space | `map` 4 — same identities, same order, anchored to the inset; `static` (culled against rest) |
| A18 hit-test agrees after resize | `map` 5 (every visible node) and `map` "a tap after a resize" (real pointer through the real executor) |
| A19 accessibility target agrees after resize | `map` 5 — the accessible tree's within-footprint answer recomputed from the same footprint |
| A20 invalid envelope fails presentation safely | `plan` "T11-A20"; `cont` "a surface that has not been measured composes nothing rather than a guess" |

### Direct pan / resize

| ID | Proof |
| --- | --- |
| A21 audited mid-drag resize behavior owner-safe | `map` "T11-A21…A25" — the drag continues across a centre AND diagonal replacement and commits correctly; the audit and its disposition are §5 of the document |
| A22 no stale-geometry `PAN` commit | same — the committed anchor is the finger's own translation through `camera.scale`; the mapping never consulted the envelope |
| A23 no double `PAN` | same — one outcome, one checkpoint, and a second `onFinalize` adds nothing |
| A24 no old gesture adoption | `map` "a drag whose AUTHORITY was replaced during a resize is dropped, in both stores" |
| A25 1:1 manipulation preserved when continuation valid | `map` "T11-A21…A25"; `SI` for the mechanism — `dragBy` divides by the residual zoom and reads no envelope |

### Timeline

| ID | Proof |
| --- | --- |
| A26 width changes no `TC` | `time` "T11-A26…A33" — store identity across six widths |
| A27 width creates no Preview | same — preview `IDLE` throughout |
| A28 width commits no Preview | same |
| A29 Live edge remains outboard at C1 | `time` "T11-A29, T11-A30" |
| A30 Live edge remains outboard in RTL | same, run under `I18nManager.isRTL` |
| A31 no fake Moment | same — the rendered steps are exactly the disclosed prefix |
| A32 disclosed Moment identity unchanged | `time` "T11-A26…A33" — the Track is the same object |
| A33 resize leaks no future knowledge | same — six disclosed steps at every width with `LH` at 6 |
| A34 same Timeline semantics C1/C5/C8 | `time` "T11-A34, T11-A40" |

### Timeline gesture authority

| ID | Proof |
| --- | --- |
| A35 mid-scrub resize cannot commit a stale-mapped target | `time` "T11-A35, T11-A36, T11-A37" — a successful release after a viewport change commits nothing |
| A36 stale Preview retarget rejected/retired | same — the Preview is discarded and a later `targetIndex` is `INTERACTION_CLOSED` |
| A37 old callback not adopted by a new geometry generation | same; and the reaction gate is anchored in `static` §5 |
| A38 unmount/replacement leaves no late commit | `time` "T11-A38" |
| A39 RTL mid-scrub resize physically truthful | `time` "T11-A39" — a direction change is a mapping change and is treated as one |
| A40 screen-reader temporal route unaffected | `time` "T11-A34, T11-A40" |

### Chrome / Return

| ID | Proof |
| --- | --- |
| A41 `semanticModel` deep-equal C1…C9 | `chrome` parity matrix × 4 language/direction axes — `orientationModel` recomputed and `toEqual` at every case |
| A42 offered Return set identical C1…C9 | same — the press-target testIDs |
| A43 every Product word identical C1…C9 | same — `readableText` of the whole chrome subtree, labels and hints included |
| A44 no available control hidden at C1 | `chrome` "T11-A44…A49" |
| A45 no available control hidden at C5 | same (C5 is in the loop) |
| A46 every control ≥ 44pt | same — `minHeight: 44`, no `height`, no `maxHeight` |
| A47 no essential copy ellipsized/truncated | same — no `numberOfLines`, `ellipsizeMode` or `overflow: hidden` anywhere in the chrome; `static` |
| A48 wide adds no new control or summary | `chrome` "T11-A48" — identical acts AND identical text-node count |
| A49 compact adds no "More" indirection | `chrome` "T11-A44…A49"; `static` (no such token in the owner) |
| A50 pointer-through reaches Map outside controls | `chrome` "T11-A50" — every press target in the chrome is a named control at every width |

### Arabic / RTL / large text

| ID | Proof |
| --- | --- |
| A51 Arabic+RTL C1 wraps cleanly | `chrome` (no truncation, no clamp, 44pt floor, ar+RTL at C1) for the structural half; `visual` 1 for the rendered half. Real type-engine layout at the largest system sizes is `QAN-BL-RSP-01` |
| A52 Arabic+LTR same semantic answer | `chrome` parity matrix, `ar` LTR axis |
| A53 English+RTL same semantic answer | `chrome` parity matrix, `en` RTL axis |
| A54 world not mirrored in all combinations | `map` 3; `static` |
| A55 Timeline not double-mirrored | `SI` — one mirror function exists (`presentationX`) and T-11 adds none; `static` (`useTemporalScrub` still calls it once); T-06's own `rtl-geometry` suite green |
| A56 large text keeps every act reachable | `chrome` "T11-A56…A58" at scales 1, 1.35, 2, 3.5 |
| A57 large text keeps essential wording reachable | same — every word and hint identical — for everything T-11 composes. The ONE exception is found and recorded rather than claimed: T-05's outboard Live slot has a fixed 64-point width with `overflow: 'hidden'`, so its label clips at 200 % text (`visual` P07, P07b). Pre-existing, in a byte-frozen owner, and admitted as `QAN-BL-RSP-02` |
| A58 large text creates no Product-state difference | same — model deep-equal, store identity, RH empty |

### T-10 continuity

| ID | Proof |
| --- | --- |
| A59 resize mid-M4 no one-frame teleport | `cont` "T11-A59" — the plane shifts rigidly by the centre delta over six residuals × four resizes × every node |
| A60 canonical camera destination unchanged | `map` "T11-A01…A07" (store identity); `SI` — a resize cannot write `MC` |
| A61 mid-travel culling keeps visible current-`V` objects | `cont` "T11-A61" — the corridor is still applied after the geometry change |
| A62 corridor retires after resize + rest | `static` "a travel in flight is neither re-issued nor re-culled" — the corridor is rebased by the transition and retired on the settled edge, neither of which a resize causes; the retirement itself is proven by T-10's own suite (`t10-motion-contract`, `motion/__tests__`) |
| A63 resize mid-M3 does not replay disclosure | `cont` "T11-A63, T11-A64" — membership is viewport-free, so `newlyDisclosedKeys` is empty |
| A64 no duplicate arrival identity | same; and `static` "nothing is keyed by a width" — no arrival can be remounted by a measurement |
| A65 resize cannot trigger Meaning Ignition | `SI` — the cue has no trigger in v1 (`QAN-BL-MOT-01`) and the responsive owner names no cue, holds no clock and imports no animation API; `cont` "T11-A65"; `static`; `fwd` (a responsive module that invents a motion vocabulary is refused) |
| A66 reduced-motion resize same capability | `cont` "T11-A66" — identical acts and words at three widths under both settings |
| A67 `CUT_AND_RESOLVE` remains covered | `static` — the rebase runs only for a canonical transition, so a resize neither issues nor cancels one; the choreography itself is proven by T-10's own suite |
| A68 register does not inherit world residual | `cont` "T11-A68"; `static` (`RESIDUAL_ENVELOPE_AT_REST` for the register) |

### Recomposition lifecycle

| ID | Proof |
| --- | --- |
| A69 threshold jitter does not flip indefinitely | `plan` "T11-A69" — settled bands survive ±7pt noise in both directions |
| A70 rapid resize does not remount canonical world owner | `map` "T11-A70" — same instances after a 29-step sweep |
| A71 wide → narrow → wide returns an equivalent plan | `plan` "T11-A71" |
| A72 narrow → landscape → narrow preserves the semantic model | `plan` "T11-A72"; `chrome` "short landscape … and going back restores the column, with the same answer" |
| A73 inset changes create no layout loop | `cont` "T11-A73" — 50 identical measurements, one composition; and no region's size is derived from its own content, so nothing it does can change the measurement it was composed from. The plan hands out no vertical ceiling at all (`static`) |
| A74 no resize-triggered fetch/projection request | `map` "T11-A01…A07" (no outcome, no state change); `static` (no `fetch`, no transport token in any changed file) |
| A75 no app-shell mount | `static` "T-11 never reaches for the app shell, and the shell may reach T-11 only through its barrel" (permanent invariant) + §15 closure evidence: `app/**` and `shell/**` byte-identical to the baseline. Deliberately not frozen as a ceiling — mounting is T-12's job |
| A76 no new dependency | `static` "the owner names only packages the mobile app already declares, and only two of them"; both manifests and the lockfile unchanged (§15) |
| A77 no Product copy change | `static` — no arrangement, width or band token in `product-copy.ts`; `chrome` — every word identical at every width, language and scale; §15 closure evidence: `product-copy.ts` unchanged |
| A78 no device-brand branch | `static` "no device, brand, model or platform is a responsive category anywhere" |
| A79 no global-screen authority in a reusable responsive owner | `static` "no reusable surface takes the display as its authority" — covers the owner, the chrome, the Map and the scrub |
| A80 backlog kickoff says T-11 inherits NONE | `static` "the canonical backlog still says T-11 inherits nothing, and T-11 records it" |

---

## 3a. `T11-R1-01` — the settled band follows the usable width (independent review, R1)

The usable width has three authorities — measured width, left inset, right inset — and only one is
an event. Settling the band in the layout handler was correct for that one and stale for the other
two, and hysteresis is path-dependent, so a stale predecessor is a wrong band.

Every row is proven through the REAL hook inside the REAL component, with `onLayout` fired once at
setup and every step afterwards changing props only.

| ID | Proof |
| --- | --- |
| R1-A01 inset-only down-cross | `inset` "R1-A01" — 560 usable → `EXPANSIVE`; insets to 12+12 → usable 536, no layout event → `COMPACT` |
| R1-A02 history after an inset-only change | `inset` "R1-A02" — insets to 6+6 → usable 548 → stays `COMPACT`, held by the `COMPACT` up-threshold (552) rather than the stale `EXPANSIVE` down-threshold (544). **This is the discriminating test: it FAILS on the pre-R1 hook** |
| R1-A03 true up-cross | `inset` "R1-A03" — 550 still `COMPACT`; 552 becomes `EXPANSIVE`; exactly two band changes across the whole sequence. **Also fails on the pre-R1 hook** |
| R1-A04 reverse and no oscillation | `inset` "R1-A04" — 548 from above stays `EXPANSIVE`; six identical inset props produce the same plan OBJECT; 536 becomes `COMPACT` |
| R1-A05 Product authority | `inset` "R1-A05" — store identity across a seven-step inset sweep in both directions, semantic model deep-equal, same words, same acts in the same order, `MapSurface` and `MapAccessibilityLayer` the same instances throughout, zero outcomes, RH empty |
| the closed boundary | `inset` "the closed boundary…" — `544` is the last expansive width and `543` crosses, so the dead zone is the half-open `[544, 552)` and the hysteresis is exactly its documented 8 points |
| either authority reaches the same composition | `inset` "a width change and an inset change…" — 560 with 12+12 insets and a measured 536 settle the same band and the same arrangement |
| the invariant cannot regress | `static` "R1 — the settled band is keyed to the usable width…" — refuses a band settled from the layout event, an inset in the handler's dependencies, a band on the measurement, an effect, a ref, a timer and a remount. **Verified to fail on the pre-R1 hook** with `the band is not settled from the layout event` |

Mechanisms the finding rules out, and where each is refused: Product state (`static` §1 closure — the
owner can reach none), global `Dimensions` (`static` "no reusable surface takes the display as its
authority"), timers, effect-driven render loops, refs read during render, hidden device classes
(`static` "no device, brand, model or platform"), disabled hysteresis (`bandFor` unchanged; `plan`
still asserts the 8-point rhythm), and remounting the responsive world (`static` "nothing is keyed by
a width, a height or a band"; `inset` R1-A05 asserts instance identity).

---

## 4. `PM-01 … PM-30`

| ID | Disposition |
| --- | --- |
| PM-01 resize becomes Product authority | `SI` — the owner imports `react` and `react-native` only, and can reach no store, executor or projection (`static`; `fwd` refusal) |
| PM-02 fit-to-content moves the world | guarded: no fit/recenter token exists (`static`); `map` 1 |
| PM-03 wide mode becomes a separate dashboard Product | guarded: `chrome` "T11-A48"; the composition is one column at every width (`chrome` "never a drawer, sidebar or inspector") |
| PM-04 compact hides truth | guarded: `chrome` "T11-A44…A49" and the parity matrix |
| PM-05 breakpoint becomes semantic | `SI` — the truth modules may not name a width, a viewport or an arrangement (`static`); `fwd` refusal for a sideways import |
| PM-06 global screen size replaces local container authority | guarded: `static` "no reusable surface takes the display as its authority"; `fwd` refusal |
| PM-07 RTL mirrors the world | guarded: `map` 3; `static` (no direction token in `map/**`) |
| PM-08 Timeline double-mirrors | `SI` — one mirror function, and T-11 adds none (`static`) |
| PM-09 Timeline geometry changes mid-scrub and the wrong Moment commits | **found and fixed.** `time` "T11-A35…A37", "T11-A39"; `static` §5. This was a real defect at the baseline |
| PM-10 Map gesture crosses stale geometry authority | audited and dispositioned: the `PAN` mapping is envelope-independent, so continuation is correct. `map` "T11-A21…A25" and the authority-replacement test |
| PM-11 camera teleports on a viewport-centre change | `SI` by arithmetic — `p` and `c` move together, so the plane shifts rigidly. `cont` "T11-A59" over the residual space |
| PM-12 travel culling uses the old envelope | guarded: `cont` "T11-A61"; `static` (the corridor is never derived from the envelope) |
| PM-13 resize remount replays M3 | guarded: `cont` "T11-A63, T11-A64"; `static` (nothing is keyed by a measurement) |
| PM-14 resize fires Meaning Ignition | `SI` — see A65 |
| PM-15 safe area changes world geography | guarded: `plan` "T11-A08"; `map` sweep with insets; insets reach `envelopeCenter` and the cull rectangle only |
| PM-16 short landscape hides chrome | guarded: `chrome` "short landscape pairs the acts, keeps every word"; the band never hides, it pairs and yields |
| PM-17 large text clips essential wording | guarded structurally (`chrome` "T11-A56…A58"; no clamp anywhere); real type layout is `QAN-BL-RSP-01` |
| PM-18 focus order diverges after reflow | guarded: `chrome` parity matrix asserts `focusOrder` at every case; `row wrap` in the reading direction preserves it |
| PM-19 44pt target shrinks | guarded: `chrome` "T11-A44…A49"; `static` (`minHeight: 44`, no cell ceiling) |
| PM-20 `onLayout` feedback loop | `SI` — the plan is a function of the container alone, and nothing the band does changes the container. `cont` "T11-A73" |
| PM-21 breakpoint jitter | guarded: bounded pure hysteresis; `plan` "T11-A69" |
| PM-22 width-band key remounts the world | guarded: `static` "nothing is keyed by a width, a height or a band"; `map` "T11-A70" |
| PM-23 responsive transition invents a motion language | `SI` — no animation API, no duration, no easing in the owner (`static`; `fwd` refusal). §8 records the full `KEEP STILL` inventory |
| PM-24 reduced motion loses capability | guarded: `cont` "T11-A66" |
| PM-25 screen-space register joins the camera transform | guarded: `cont` "T11-A68"; `static` |
| PM-26 responsive owner deep-imports truth owners | `SI` — the owner's relative imports are restricted to its own siblings by assertion (`static`); `fwd` refusals |
| PM-27 T-11 mounts the app shell | guarded: `static` (barrel-only boundary) + §15 closure evidence |
| PM-28 T-11 fixes T-12 backlog items | guarded: `static` "T-12 and T-13 remain unstarted"; no provider, no locale authority, no journey origin, no persistence |
| PM-29 browser proof called native proof | addressed in prose, not code: §11 and §16 state exactly what each kind of evidence proves, and every row above that rests on a simulated or browser layout says so |
| PM-30 new cross-task residue misses BG-08 admission | addressed: `QAN-BL-RSP-01` and `QAN-BL-RSP-02` both admitted with the full §2 schema BEFORE closure; §17 records the reconciliation, including why RSP-02 qualifies under BG-06 and not under BG-01 |

---

## 5. Static guards (execution contract §24)

| # | Guard | Where |
| --- | --- | --- |
| 1 | no new canonical field | `static` "T-11 adds no canonical field, no Product act and no temporal mode" |
| 2 | no new Product act | same |
| 3 | no new temporal mode | same |
| 4 | no dependency change | `static` "only packages the mobile app already declares, and only two of them"; lockfile unchanged (§15) |
| 5 | no app-shell mount | `static` (barrel-only, permanent) + §15 closure evidence |
| 6 | no backend/database/schema change | `static` "T-11 touches no backend, database, schema or migration" |
| 7 | responsive owner cannot import canonical executors or store authority | `static` "the owner can reach no store, executor, projection, act or provider" |
| 8 | no device-brand/device-class branch | `static` "no device, brand, model or platform" |
| 9 | no global `Dimensions` authority in a reusable owner | `static` "no reusable surface takes the display as its authority" |
| 10 | no Map RTL mirror | `static` "the Map world is never mirrored" |
| 11 | no fit-to-content / recenter on resize | same test |
| 12 | no width/height-driven semantic or disclosure decision | `static` "no T-08 truth module can see a layout" |
| 13 | no width/height-driven Return offered-set decision | `static` "the arrangement seam" (never touches `offered`) |
| 14 | no width/height-driven Product copy decision | same (never reaches `product-copy.ts`) |
| 15 | no responsive "More" hiding acts | `static` "compactness removes space, never truth" |
| 16 | no essential single-line ellipsis in the chrome | same test |
| 17 | no width/band key remount | `static` "nothing is keyed by a width, a height or a band" |
| 18 | no resize-triggered canonical dispatch | `static` §1 (closure) + `map` "T11-A01…A07" |
| 19 | no resize-triggered Meaning Ignition | `static` "T-11 invents no motion vocabulary, and cannot fire a cue" |
| 20 | no new responsive animation vocabulary | same test |
| 21 | no safe-area dependency or provider | `static` §1 and "T-12 and T-13 remain unstarted" |
| 22 | T-12 integration seams untouched | `static` "T-12 and T-13 remain unstarted"; §15 |
| 23 | T-13 untouched | same |
| 24 | backlog kickoff says T-11 inherits NONE | `static` "the canonical backlog still says T-11 inherits nothing" |

Behavioural proof is used wherever a static guard would be unsuitable — the parity matrix, the
mid-scrub retirement, the rigid shift, the drag continuation. No brittle global file count, no
whole-file hash and no dependency census appears anywhere in the T-11 contract.

---

## 6. Definition of Done

| Clause | Status |
| --- | --- |
| exact baseline / exclusive ownership verified | `1615cea0` = remote `main`; fresh single-writer clone at `E:\QANDEEL\CW\T-11` |
| T-11 inherits NONE | `static`; §17 |
| responsive authority presentation-only | `static` §1; A01…A10 |
| measured container drives recomposition | `static`; §2 |
| no new Product state / act / mode | guard 1–3 |
| no canonical camera change on resize | A01, A60 |
| no Home/geography reflow or fit-to-content | A11, A15, A16 |
| Map never mirrors in RTL | A12, A54 |
| paint / hit-test / accessibility agree | A18, A19 |
| direct-pan resize behaviour audited and safe | A21…A25; §5 |
| Timeline width changes no temporal truth | A26…A34 |
| Live edge remains outboard | A29, A30 |
| stale scrub geometry cannot commit | A35…A39 |
| T-08 model / offered set / words identical | A41…A43 |
| every control reachable and ≥ 44pt | A44…A46 |
| compact hides no truth | A44…A49 |
| wide creates no dashboard or sidebar | A48; `chrome` "never a drawer, sidebar or inspector" |
| short landscape remains capable | A45; `chrome` "short landscape pairs the acts" |
| Arabic / RTL / LTR matrix truthful | A51…A55 |
| Dynamic Type preserves capability | A56…A58; limit stated in §11 and admitted as `QAN-BL-RSP-01` |
| safe-area presentation-only | A08 |
| no teleport during T-10 motion | A59 |
| resize during M3 does not replay disclosure | A63 |
| resize cannot fire Meaning Ignition | A65 |
| reduced-motion parity preserved | A66 |
| no new responsive motion vocabulary | A65; §8 |
| no app-shell mount | A75 |
| no new dependency | A76 |
| no Product copy change | A77 |
| no T-12 / T-13 work | PM-28; guards 21–23 |
| required skills complete | §23 of the final report |
| design critique complete | §24 of the final report |
| `/review-animations` complete | §25 of the final report |
| A01…A80 covered | this document, §3 |
| PM-01…PM-30 dispositioned | this document, §4 |
| static guards / traceability / local closure green | this document, §5; the closure section of the final report |
| BG-08 reconciliation complete | §17 of `responsive-recomposition-v1.md` |
| one candidate push, exact-head CI reported, PR remains Draft | the final report |
