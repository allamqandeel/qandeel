# QANDEEL — VPORT-01 Living Analysis World — Final Production Visual Port — Implementation Record v1

**Task:** VPORT-01 — Living Analysis World — Final Production Visual Port (Execution Stage 2)
**Baseline:** `e87aac6b4e9ec6c1b6542d2ba3c82cc6cc9af6e8` (merge of PR #296, W3-MEGA-S) — `origin/main` at kickoff, exactly
**Branch:** `feat/vport-01-living-analysis-world-production-port`
**PR:** [allamqandeel/qandeel#297](https://github.com/allamqandeel/qandeel/pull/297) — merged at
`fe9d9155f122725cb669e9989fa35ff12916112a` (2026-10-01; PR head `119453dce5350fd0b77880b58f58136d2bb65d34`)
**Status:** **MERGED / CLOSED** — VPORT-01 is done. **Stage 2 is still open (ACTIVE)**: VPORT-01 merged does not close
Stage 2. VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence is the remaining Stage-2 implementation task and
is NEXT; this record does not open it (it needs its own Task Contract). Lifecycle reconciled by ROADMAP-REC-01
(2026-10-04); nothing below it was rewritten.
**Status at handoff (historical):** IMPLEMENTED ON A DRAFT PR — NOT MERGED. `VPORT-01 READY FOR INDEPENDENT REVIEW — DO NOT MERGE`. It closes no
phase, does not close Stage 2, and does not open VPORT-02.

> **The production Map now paints the frozen I-08B1 world. The world mechanics underneath it did not move.**

---

## 1. Execution map

> **Historical — the map at kickoff.** Current: Stage 2 ACTIVE, VPORT-01 DONE, VPORT-02 NEXT
> ([`QANDEEL_PROJECT_MAP.md`](../../QANDEEL_PROJECT_MAP.md) §5.1).

| Stage | State |
|---|---|
| Stage 1 — Personal Core / W3 core (through W3-MEGA-S) | DONE |
| T-04 → T-13 Analysis runtime and composition; I-08B1; I-08B2.5; I-08B3 A–F; G1–G3; P1–P4 | DONE (implemented or frozen as recorded in Current State) |
| **Stage 2 — VPORT-01 Living Analysis World — Final Production Visual Port** | **ACTIVE — this record** |
| Stage 2 — VPORT-02 Timeline + Orientation Chrome + P2 Final Coherence | NEXT — not opened |
| Activity + Notifications, Shared, Public, Matching / Introductions, Replay, Voice, Economy + Launch | LATER — not opened |

## 2. Repo truth

- Workspace clean at kickoff; `git fetch`; `origin/main` = `e87aac6b4e9ec6c1b6542d2ba3c82cc6cc9af6e8`; branch cut from it.
- Read before coding: `AGENTS.md`, `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md`, the
  canonical backlog **in full**; the I-08B1 README, canonical-state record, the unified source
  (`wf-living-constellation.html`, read for its palette, schedule, object, relation, strata and type passes) and the three
  hero boards; the artifact index (rows 28–31, 37, 44, 80–95); G2 closure §C; the G3.2 `app.js` world embedding and
  `tokens.mjs`; the D2R illumination tokens in full; the F1 increased-contrast override in full; the resolved E1R / F1 /
  D2R dark token tree; and, in production: `MapCanvas.tsx`, `MapSurface.tsx`, `map-geometry.ts`, `render-style.ts`,
  `map-scene.ts`, `camera.ts`, `zoom.ts`, the accessibility layer, `LivingAnalysisMap.tsx`, the T-10 presentation camera
  binding and `DisclosureArrival`, the Conversation visual generator and theme, the appearance owner, the Jest Skia
  stand-in, and every root contract that reads the Map (T-04, T-10, T-11, T-12, T-12P, forward-safety).
- Repo truth confirmed the task's description: `MapCanvas.tsx` declared itself a neutral placeholder; everything else in
  the Map was production mechanics.
- One repo fact the task did not state, and which shaped the design: **T-10 freezes "every animation package is named
  inside the motion owner, and nowhere else in the Map"**. The world's distance response therefore reads the T-10 residual
  through a new read-only seam in the motion owner (§7), not by importing the animation runtime into the Map.

## 3. Anti-Duplication Gate

| Concern | Existing production owner | Final canonical visual authority | Genuine missing work | Must remain untouched |
|---|---|---|---|---|
| scene entitlement | T-04 `deriveMapSceneFromDisclosure` | — | none | `MapScene`, `V` as sole source |
| Home placement | T-04 `placeScene` (canonical Home projection) | I-08B1 object material (place) | paint of a Home as a place | Home coordinates, `HOME_RADIUS_POINTS` |
| contextual appearance placement | T-04 ring slots by `ordinal` | I-08B1 minor tier + connection grammar | paint of appearance + tether | ring geometry; `ordinal` stays a tie-break |
| ungeographic register | T-04 screen-space register | I-08B1 truth rule (no false place) | paint of register marks | register geometry, screen space |
| camera | T-04 `MapCamera` / T-10 presentation camera | I-08B1 "zoom is distance" | optical approach from distance | camera semantics, rebase |
| semantic zoom | T-04 `semanticZoom` (×8 reinforcement) | I-08B1 FAR / MID / NEAR | material response to distance | rung lineage, scale arithmetic |
| panning | T-04 / T-10 pan gesture | D2R parallax rates | world-anchored strata drift | drag mechanics, corridor |
| hit testing | T-04 `hitTest` | — | none (paint kept inside hit radii) | `hitTest`, radii |
| accessibility tree | T-04 `MapAccessibilityLayer` | F1R2 | none | labels, actions, roles |
| disclosure arrival | T-10 `DisclosureArrival` | I-08B1 "meaning resolves" | none (new paint wrapped unchanged) | arrival plan / registry |
| motion | T-10 | T-10 + D2R reduced-motion contract | read-only reading of the residual | every token, curve, plan |
| responsive envelope | T-11 | T-11 + G3 amendments | none | envelope, plan, bands |
| appearance | W3-01 appearance authority | P1 §12, G2/G3 (Analysis dark) | none — world is dark-only | appearance authority |
| contrast | W1A `useIncreasedContrast` (reused) | F1 increased override | world's use of it | the hook itself |
| visual tokens | W1A conversation generator | B4R / C3 / D2R / E1R / F1 / F2 | world token resolution | conversation generated file |
| fonts | W1A Estedad assets | E3 | none — the world draws no words | font loading |
| world rendering | T-04 `MapCanvas` (placeholder) | **I-08B1** | **the final world paint — the genuine gap** | the canvas's truth guarantees |

Conclusion, as expected: **runtime mechanics already existed; final world paint/expression was the missing layer.**

## 4. Canonical source chain

| Source | Pin | What the port takes from it |
|---|---|---|
| `docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html` | `4dfd9d27d752c3a445168c0cc7067d71df4ada84bc61b806d12c8bb3202bc413` (asserted) | `P` material; `schedule(A)`; `sprite`/`shadeSprite` falloffs; `nodePath` morphologies; `dustTile` specks; star / nebula population laws and gradient passes; object, relation, ground, vignette, grain passes |
| `I-08B1-WS7R-NOTES.md` | hashed in header | "170 … the world's colour, and FAR is made of it" (asserted by text) |
| F2 FINAL resolver `f2-resolve.mjs` + its dark token tree (B4R, C3, D2R, E1R, F1, F2) | hashed in header | `analysis.node`, `analysis.relation` (standard / increased), `state.selected.*`, `world.fill`, F1 stroke-alpha sentinel, D2R parallax + reduced differential |
| G2 closure §C; artifact index row 90 | — | the world is the Analysis's dark immersive place under every appearance; FAR/MID/NEAR are zoom states, never controls |

Precedence applied: inside the Analysis, the I-08B1 world governs atmosphere and object material (index row 90, G2 §C.2);
D2R governs what Light may mean (event-only; no persistent glow; four categories); E1R governs interaction state; F1
governs the increased-contrast rung movement. No authority conflict needed a Product Owner ruling.

## 5. Placeholder removed

`MapCanvas.tsx` previously painted `GROUND rgb(246,246,244)`, `AMBIENT`, `EMPTY_SPACE`, `HOME_FILL`, `APPEARANCE_FILL`,
`TETHER`, `REGISTER_FILL` — plain circles for Homes and appearances, plain `Line` tethers, plain register circles. All are
gone. The canvas now composes `WorldGround`, `WorldAtmosphere`, `WorldTether`, `WorldObject`, `WorldVeil` and
`RegisterMark` from `apps/mobile/src/map/visual/`, and carries no colour literal, no `<Circle>` and no `<Line>` of its
own (guarded by `tests/vport-01-world-visual-contract.test.mjs`).

## 6. Runtime mechanics preserved

Unchanged files: `map-scene.ts`, `map-geometry.ts` (placement and hit radii 13 / 6 / 40 / 6), `render-style.ts` (still
exactly two channels), the accessibility layer, the inspection executors, the camera and zoom modules, every T-10 motion
module except one additive file, T-11, T-12, T-13. In `MapCanvas.tsx` the truth-bearing structure is byte-for-byte the
same idea: `planeNodes` / `registerNodes` from `presented`; the arrival OUTSIDE the counter-scale; the rebase as the last
child of the plane; the register outside every camera group; `newlyDisclosed.has(node.key)` as the only arrival cause.
`MapSurface.tsx` gained only the computation of the world's presentation facts (§8) and passes them to the canvas.

## 7. Token / asset provenance

- `apps/mobile/scripts/generate-world-visual.mjs` (deterministic; `--check` mode). It **executes** the canonical
  `dustTile`, `sprite`, `shadeSprite` and `nodePath` functions, lifted as text from the pinned source, against a recording
  2D context; **source-locks** every `S.* = …` schedule expression and dozens of material lines by exact text (the build
  fails if the canonical file stops containing them); and resolves tokens through F2 FINAL's own resolver.
- Outputs: `map/visual/world-visual.generated.ts` (material, morphology, schedule worklet, tokens) and
  `map/visual/world-field.generated.ts` (the canonical dust tile's 5,906 specks; 1,441 stars and 60 clouds). Both headers
  list every source path with its SHA-256 and state the no-hand-edit rule. CI re-runs `--check` in the proof workflow
  and in the VPORT-01 contract.
- Star and cloud **layouts** are generated on an authored presentation seed in a seamless tile (the canonical layouts are
  arranged around the fixture world's centre, which is fixture geography); their **material** (population mix, size and
  alpha laws, the three gradient passes) is the canonical one by exact text. D2R `atmosphere.contour` explicitly allows an
  authored, reseedable scene seed for ambient composition.
- Bucketing of speck size / alpha / hue into Skia draw batches is a presentation rounding (≤0.15 pt, ≤0.04 alpha, ≤4°).
- **Round 2 (after reading the first device captures).** The first run rendered correctly but read as "star wallpaper on
  navy": no world body, stars at hero-pixel size on a phone, and no tone pass. Three canonical facts were added, each by
  the same source lock:
  - the **tone curve** `out = (1−a)·w + a·w²`, `a = P.toneA = 0.46` (exact line asserted), applied as a Skia
    `RuntimeShader` image filter over the world — not over the veil or the register. T-11 forbids reading `PixelRatio`
    in a reusable surface, so the filter runs at the canvas's own resolution (no supersampling);
  - **stars at phone scale and under the dust mask**: speck radius `× heroPointsPerPixel`
    (`ceil(844·2100/1181)/2100`, from the G3.2 `REF_H` / `stageW` lines, asserted), and the population filtered by the
    canonical `dustTile` mask, so the sky clusters the way the canonical sky does instead of tiling evenly;
  - the **world atmosphere** (`P.atmo.ter`, the three-stop radial body every I-08B1 world sits in, scheduled by the
    canonical `S.atmo`) drawn as a soft body around each presented Thread Home. Its radius,
    `PLACE_ATMOSPHERE_WORLD_UNITS = 750 000` world units, is the one authored calibration of the port — the canonical
    file sizes it in fixture-world pixels, which have no production meaning. It is drawn only for **presented** Homes
    (T-10's culling), so a Home just outside the glass does not light its edge; a faint pop at the glass edge while panning
    is the known cost of not painting off-glass.

## 8. Truth Availability Gate

### Ported

| Primitive | Class | Production truth / authority chain |
|---|---|---|
| cosmos ground, map floor, vignette, grain | A | atmosphere; I-08B1 `P.ground`, floor rgba, `P.vignette`, `P.grain` |
| cloud, star and dust strata, world-anchored, D2R parallax | A | non-semantic; truth rule 1 |
| FAR / MID / NEAR material response | A | camera distance (§9) |
| Thread Home as a place: cleared ground, medium light, THREAD morphology (major tier) | B | `THREAD_HOME` locus from `V` |
| contextual Reading: READING morphology (minor tier) | B | `CONTEXTUAL_APPEARANCE` locus from `V` |
| hosting tether in the connection grammar (ground, NEAR body, core) | B | the placement's own host relation — the one relation the Map holds |
| ungeographic identity: morphology only, no ground, no light, screen space | B | `UNGEOGRAPHIC` (`loci.length === 0`) |
| Emerging Focus: the OPEN (stroked) slot | B | family `EMERGING_FOCUS`; always ungeographic |
| SELECTED: E1R attached marker + selected ink | B | `IF_ref` decoded by the Map's own `decodeInspectionRef`; named-appearance precision |
| increased contrast | B | platform setting → F1 override |

Every per-object quantity is constant per tier; the tier is the placement. Mark rotation is a meaning-free hash of the
scene key (I-08B1 gives every object an arbitrary `rot`). The I-08B1 morphology slots are, in its own words, "not a
taxonomy"; the port uses the slots whose names are the production families (THREAD → `THREAD`, READING → `READING`) and the
OPEN slot for the pregeographic Emerging Focus. Shape is never the sole carrier: the accessible label names the family.

### Not ported — blocked or absent by truth

`VISUAL PORT BLOCKER — REQUIRED SEMANTIC FACT NOT PRESENT IN PRODUCTION MAP INPUT` applies to:

1. **Territories / life domains** (العمل، الإيمان …) — their hulls, hue identities, membranes and names. No production fact
   groups Threads into domains.
2. **Sessions as regions** (جلسة ١٢ …) — rings, facets and interiors. `MapScene` holds no session region.
3. **Analytical relations between objects** (the 123 relations, beads, bows). Historical Disclosure carries
   `readingRelations` at the ANALYTICAL_OBJECT rung, but the Map derivation does not expose them, they have no Map
   geometry or accessible representation, and drawing them would need new Product semantics for the Map. Not drawn.
4. **Labels / names of any kind** — `MapScene` carries no object, Thread or session name; the world draws no words.
5. **The focus singleton ("الآن", the one light in the room, focus clearing, focus-facing limbs, working-set hierarchy)**
   — the fact *is* present in the disclosure (`world.liveFocus` at TC), but expressing it would make paint the sole
   carrier of "this is QANDEEL's current focus": no accessible equivalent or Product-approved wording exists for the Map.
   **Reported to the Product Owner rather than drawn.** Without it, every object is at full voice (no hierarchy is
   invented) and limbs face their own presentation angle.
6. **Background worlds** — they would assert the existence of other worlds; no production fact supports that.
7. **PATTERN and INSIGHT light** — no production truth. **CONNECTION as a Light *event*** — not shipped: T-12 closed
   `QAN-BL-MOT-01` with "NO MEANING IGNITION CUE SHIPS"; the tether is CONNECTION's neutral settled residue only.
8. **The appearance `current` flag** — present, but its visual meaning is not established by any authority; not expressed.
9. **Close-range body material** (`objMat` interior fill) — cosmetic compositing the declarative Skia port does not
   reproduce; recorded as a port limitation, not a blocker. (The I-08B1 tone curve, listed here in round 1, was ported in
   round 2 — §7.)

### Interaction states

REST (world material), SELECTED (E1R) — real and implemented. FOCUS — no keyboard focus exists on painted Map objects;
assistive-technology focus is the platform's, on the accessible node. PRESSED — the T-04 pointer route acts on release and
exposes no press phase; inventing one would show press feedback for what becomes a pan. DISABLED — every disclosed object
is inspectable. None of these three is drawn.

## 9. FAR / MID / NEAR

There is no canonical mapping from production rungs to I-08B1's approach `A` (G2 says only "zoom is distance"; G2/G3 used
fixture field widths). The port therefore reads **distance**: `A = clamp(ln(8192 / worldUnitsPerPoint) / ln 64)` — the
default viewpoint is FAR, one ×8 reinforcement step is MID, two are NEAR. It is optical only (never read by placement, hit
testing, membership or accessibility). It happens to coincide with disclosure (WORLD shows Homes, THREAD adds the hosted
Readings, SESSION adds the Emerging Focuses), which is why the result reads as I-08B1's "approaching discloses more". This
is the one presentation judgement of the port and is flagged for review.

During a travel the presented `A` follows the T-10 residual on the UI runtime, so the world resolves on the plane's own
frames; under Reduce Motion it cuts inside the plane's own resolve. Evidence: §12.

## 10. Accessibility, appearance and contrast

- The accessible tree is unchanged; paint, hit testing and the tree still derive from one scene. Every mark and the
  SELECTED marker sit inside the T-04 hit radius of their placement (tested).
- SELECTED is a shape (attached ring) plus ink, never colour alone; the T-08 chrome names the inspected object in words.
- Increased contrast: the tether core moves to `qandeel.analysis.relation` increased (`#afaca3`) and every analytical
  mark draws at full opacity (F1 sentinel); the atmosphere does not rise, so the analysis/atmosphere ratio widens.
- Reduce Motion: travels cut-and-resolve (T-10); world strata take D2R `parallax-differential = 0`.
- The Analysis world is dark under every appearance preference; the world reads no appearance preference.

## 11. Performance

Strata are recorded once per process into Skia pictures (dust, three star bands, three cloud passes) and drawn as a small
tile grid; per frame the UI runtime evaluates ~19 shared derived weights (not per object). Per object: ~6 retained Skia
elements, plus one atmosphere gradient per presented Home; no per-object derived value. The tone curve is one
full-canvas image filter (an extra offscreen pass). Device frame statistics: §12.

## 12. Tests, CI and visual proof

**Local, on the implementation head** (Windows host; the commands the repository supports):

- `tsc --noEmit` (mobile): 0 errors. ESLint on every changed file: 0 problems.
- Mobile Jest, full: 162 suites / 1,922 tests pass; after the round-2 changes the Map + motion suites (249 tests) re-ran
  green. New: `map/__tests__/world-visual.test.tsx` (20 tests).
- Root contracts: T-04 15/15, T-10 31/31, T-11 27/27, T-12 32/32, W1A 18/18, W3-01 15/15, forward-safety 35/35,
  task-closure governance 24/24, canonical-home-placement 10/10, **VPORT-01 9/9**
  (`npm run test:vport-01-world-visual-contract`, also wired into `mobile-ci.yml`).
- `node apps/mobile/scripts/generate-world-visual.mjs --check`: generated files current.

**PR CI:** the repository's own workflows on PR #297. Their result is the PR's check list. This record does not
restate it.

**Device visual proof** (`.github/workflows/vport-01-visual-proof.yml`, Release APK, API 36 emulator, Maestro 2.10.0):

| Run | Head | Result | Use |
|---|---|---|---|
| [36815395313](https://github.com/allamqandeel/qandeel/actions/runs/36815395313) | `61040e6` (round 1) | 8/8 flows PASS; the device a11y census read 0 (harness: `uiautomator` omits zero-size nodes) and was removed | the review that drove round 2 (§7) |
| [36819624480](https://github.com/allamqandeel/qandeel/actions/runs/36819624480) | `baa3f07` (round 2) | **8/8 flows PASS**; workflow `success` | the committed evidence |

Committed evidence: `docs/e2e/visual-production/vport-01/` (README indexes each file). It covers FAR, MID, NEAR, the
Thread Home, contextual Readings on tethers, the ungeographic register (Emerging Focus arcs, then ungrounded Reading
capsules), SELECTED, settled arrival, standard and increased contrast, Reduce Motion parity, Arabic, English, a 360 dp
phone, landscape, and both travels as recordings.

What the captures show: FAR reads as one world whose bodies are the Homes' atmospheres; one step in, the atmosphere gives
way and the hosted Readings resolve on their tethers; NEAR adds the register. Strata continuity across a rung (no cut) is proved by the drift-continuity test in
`world-visual.test.tsx`; the two travel recordings are attached for review and were not frame-analysed. Increased contrast lifts the tether cores and marks, not the atmosphere. Reduce Motion
reaches the same settled frames.

Frame statistics: `travel-standard-gfxinfo.txt` comes from a GPU-less, software-rendered CI emulator (50th percentile
150 ms; most frames "janky"). It is **not** a performance claim in either direction. Device performance on real
hardware is **not proven by this PR** and is a review item.

Observed outside scope: in the narrow and landscape legs the orientation / temporal chrome below the world rendered
dark-on-dark. VPORT-01 changed no chrome file. Recorded for VPORT-02.

## 13. Validation drift re-anchored (permanent claims kept)

| Test | Old anchor | New anchor | Claim kept |
|---|---|---|---|
| T-04 runtime contract file surface | 31 files | + 8 `visual/` files | the Map's production surface is exactly enumerated |
| T-10 "static visual language not redesigned by T-10" | placeholder colours present | placeholder gone, renderer paints `../visual`, motion owner still paints no colour | T-10 painted nothing |
| T-10 §13 counter-scale | `strokeWidth={motion.objectScale}` | `strokeScale={motion.objectScale}` read by `useReadingOf` | tether stroke is a screen quantity |
| OPEN-17 render-style | handles compared by identity | derived values compared by value | only `opacity` differs |
| `renderer.test` pan | Home = the `r:13` circle | Home = its major-tier ground circle | a pan moves what is painted |
| T-10 paint fixture, `scene-truth` | one circle per object | object anchor (origin-only group) per object, plus "no paint at a departed Home" | exactly current `V` is painted |

## 14. Backlog reconciliation

Inherited: none (no item names VPORT-01). `QAN-BL-VIS-01` stays `OPEN — UNASSIGNED` — the heavy-history stress proof was not
taken. Admitted: none. The focus-singleton expression (§8 item 5) is reported to the Product Owner for decision; it is not
admitted under BG-06 by this record.

## 15. Skills used

G1 Skills Gate: the session's skill list was inspected before any code.

| Skill | Used | Where |
|---|---|---|
| `react-native-best-practices` (Software Mansion) — the animations sub-skill, with its Skia canvas / shader / performance references | **Used** | retained-mode Skia elements; strata recorded once into `SkPicture`s (`createPicture`) and drawn as tiles; one shared set of derived values on the UI runtime instead of a per-object value; worklet closures kept to plain data; `RuntimeShader` image filter for the tone curve; Reduce Motion read from the platform through the motion owner |
| `impeccable`, `frontend-design` | Not used | web/HTML design skills; the port authors no new design — the authority is I-08B1 and its successors |
| `animate-expo` | Not used | VPORT-01 adds no animation; T-10 owns all motion and was not changed |
| `sibawayh` (Arabic design) | Not used | the world draws no words; Arabic proof captures only confirm the RTL composition of chrome VPORT-01 does not touch |
| `github-actions` | Not used | the proof workflow follows the repository's existing W1A / MOB-CI pattern |

## 16. VPORT-02 readiness

VPORT-02 (Timeline styling, Spine / Aperture P2, Return icons, OrientationChrome visuals, navigation iconography, Call
Rail) touches none of the files VPORT-01 changed: it reads no `map/visual/` export and the world composes under, not
over, the chrome. **VPORT-02 can start after this PR's independent review**, on the merged head, with two notes it
inherits rather than reopens:

1. the focus-singleton expression (§8 item 5) is a Product Owner decision; if the Owner rules it in, it is a Map task,
   not a VPORT-02 one;
2. the FAR / MID / NEAR distance mapping (§9) is the one presentation judgement of this port; the chrome's own FAR / MID /
   NEAR wording, if VPORT-02 adds any, must read the same mapping and must not invent a second one;
3. the dark-on-dark chrome observed in the narrow and landscape proof legs (§12) is OrientationChrome territory.

VPORT-02 is **not opened** by this record.

*Lifecycle note (ROADMAP-REC-01, 2026-10-04):* the review-and-merge precondition above is met — PR #297 merged at
`fe9d9155f122725cb669e9989fa35ff12916112a`. VPORT-02 is NEXT and still opens only through its own Task Contract; it
inherits the three notes above unchanged.
