# QANDEEL — MAP-CLOSE-01 Step 4 / V-3 — Production Visual Port of S3-R2 — Record v1

**Status:** `MAP-CLOSE-01 STEP 4 / V-3 — PART A (SLICE 1 + C1 / C2 / C3) DELIVERED ON A DRAFT PR — PART B (ANALYSIS SCREEN UI) ON A STACKED DRAFT PR — READY FOR PO VISUAL & MERGE REVIEW — NOT MERGED`
**Task:** MAP-CLOSE-01 Step 4 / V-3, the production visual port of the approved S3-R2 art direction into the existing Personal Living Analysis map.
**Date:** 2026-11-10. **Baseline:** `main` at `5a21971d` (the merge of PR #390, MAP-CLOSE-01 Step 2). **Branch:** `map/map-close-01-v3-production-port`.
**Authority:** Product Owner, 2026-11-10, four messages:
1. **"PO Final Visual Approval & Step 4 / V-3":** S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION; close Step 3; V-3 is authorized.
2. **"إضافة محدودة إلى V-3 قبل الإغلاق":** the Analysis screen UI around the map joins V-3's scope, as a separate reviewable part after the drawing is proven (§11).
3. **"PO Decisions: FAR / MID / NEAR Visual Continuity":** D1 approved (MID and NEAR derive from S3-R2 as the same world, closer); D2 approved conditionally (a governed change of the world's response to distance, for the Personal Map only, separated from the frozen sources); D3 approved (ANALYTICAL is fixed in paint, not geometry); D4 keep (the register is unchanged). A derived reference comes first.
4. **"V-3: Final Visual Integration — PO APPROVED":** the derived continuity reference is approved for FAR / MID / NEAR / ANALYTICAL; C1, C2 and C3 are authorized inside V-3 (§5A); Part B follows once the map is proven; no new art round.

**Merge rule:** production changes are not merged before the PO's approval.

> **The production map now draws its nodes and relations in the S3-R2 grammar, from real data only. Its world is S3-R2's world at every distance: FAR, MID, NEAR and ANALYTICAL are one world approached. The engine, the camera, the placement, the interactions and every meaning underneath it did not move.**

---

## 1. Scope and limits
**In scope (PO):**
- port S3-R2 into the existing production map: the current engine, real data, its interactions, the contracts in force;
- space depth, coloured lighting, node shapes, relations, organic threads, quiet fill;
- keep interaction, zoom, pan and accessibility;
- phone performance from the start; the priority of active calls;
- test the real Personal map on Android: FAR / MID / NEAR, empty and full, touch and zoom, Arabic font, performance;
- keep the drawing reusable for Replay, without starting Replay.

**Limits (PO), all held:**
- no N4 and no CAL-2;
- no change to Qandeel's intelligence, to data facts or to their semantic order;
- no silent change to a frozen contract: every amendment is named in §6;
- Dashboard01 and the private references are not published (none is in this change);
- no art redesign from scratch, no new engine, no research phase.

## 2. The source, pinned
- **Target:** S3-R2, as pinned in the [Visual Source Registry](../design/canonical-artifacts/living-analysis/VISUAL-SOURCE-REGISTRY.md) §3.3: `proto/web.js` `ffc81c4b…`, `proto/hero.html` `0bcb1f3d…`, the approved frame `6bd02896…`.
- **Reproduced before any port work:** S3-R2 re-renders byte for byte (`6bd02896…`) from the repo copy alone, with the app's Estedad fonts (registry §3.5).
- **No fallback:** the registry's rule §2.6 binds V-3 to S3-R2. It never falls back to I-08B1, AD-4, S3-R1 or Dashboard01 as the target. A missing or mismatched S3-R2 file stops the work.
- **Historical contracts kept as they are:** I-08B1 / VPORT-01 and their frozen contracts stay in force for everything V-3 does not amend (§6).

## 3. Technical review: the smallest change
**The owners that draw the Personal map:**
- `DepthComposition` → `LivingAnalysisMap` → `LivingAnalysisSurface` → `MapSurface` → `WorldViewSurface` → `useWorldSurface`;
- `MapCanvas`: the Personal owner of the paint (what a Home is, what a hosted appearance is, which tether joins them);
- `WorldCanvas`: the generic composition (tone, ground, atmosphere strata, plane, place atmospheres, objects, veil, register);
- `WorldMarks`: the node and relation grammar; `WorldStrata`: ground, nebula, stars, dust, veil; `world-chroma`: the six presentation families.

**What production data offers (and what it does not):**

| S3-R2 element | Production data | Ported |
|---|---|---|
| node light (coloured bloom, hot core, rays, ring) | every disclosed Home (`THREAD_HOME`) and hosted appearance (`CONTEXTUAL_APPEARANCE`) | **yes**, Slice 1 |
| relations as lines of light | the Home → appearance hosting relation (the tether), and nothing else | **yes**, Slice 1, on the hosting relation only |
| colour around each place | the world's chroma at the Home's canonical address (LA-VIS-01), meaning-free | **yes**: a mark and its tether take their PLACE's chroma |
| deep-space depth, fine threads inside a place's own mass, quiet fill | world-anchored strata and the place masses already in production | **not yet** (Slice 2, §10) |
| named groups / clusters, colour by group | **none in production** | **no: needs L2** |
| topic labels or Arabic names on the map | **none in production** | **no: needs L2** |
| relations between nodes of different places | **none in production** (only hosting tethers) | **no: needs L2** |
| "transition" threads between groups | **none** | **no: needs L2** |

The L2 elements wait for the governed L2 / N4 contract (CP-A record, planning only). Drawing them now would invent semantic groups. **Proximity and colour never mean membership here:** a colour is a function of a Home's canonical address only.

**The smallest change that does the port:** two files of paint, and nothing that decides.
- `MapCanvas` hands each mark and each tether one optional `chroma`: the chroma at its place — its own Home's address, or the address of the Home that hosts it (one helper, `placeChromaOf`). The register is unchanged.
- `WorldMarks` draws the S3-R2 node grammar (`ChromaticMark`) and the S3-R2 relation (a line of light with a gentle bow) when a chroma is given, under standard contrast. Under increased contrast, and wherever no chroma is given, the frozen grammar is drawn exactly as before.

## 4. Truth and meaning (unchanged)
- **Placement, hit testing, camera, membership, accessibility:** untouched. The structural diff of both goldens proves the host tree and every anchor are identical in every case (§7).
- **Selection** is still a shape: the frozen SELECTED marker replaces the ring; the ring is drawn as light (a gradient-filled disc), never as a second outline.
- **Family** is still a shape: each mark's centre is its family's own morphology, smaller and near-white.
- **The bow of a relation** is presentation only: its side is a fixed function of its two ends, and its ends are exactly the placement's.
- **Ray angles and lengths** come from the mark's meaning-free presentation angle, like its rotation.
- **Shared and Public worlds** keep the frozen grammar: only the Personal owner passes a chroma.
- **Increased contrast** keeps F1's full-width relation core and the frozen grammar.

## 5. What changed
| File | Change |
|---|---|
| `apps/mobile/src/map/renderer/MapCanvas.tsx` | `placeChromaOf`; `chroma` on each `WorldTether` and `WorldObject` |
| `apps/mobile/src/map/visual/WorldMarks.tsx` | optional `chroma` on the object, mark and tether props; `ChromaticMark`, `LitRim`, `rayPath`, `bowedPath`; the `CHROMATIC` shares and lifts (sizes, weights and lifts only; every hue and saturation is the place's chroma) |
| both goldens | re-recorded after the structural diff (§7) |
| `tests/vport-02-…` | controlled re-anchor of the two pins (§6) |
| `tests/vport-01-…` | the V-3 chroma rule made explicit (§6) |
| registry, `VISUAL-SOURCE.sha256`, `approved-art/s3-r2/` | Step 3's closure (§8) |

**R1 (after the first device comparison):** the first build drew a large white centre inside a pale ring, and the relations read as dim rails. R1 makes the centre smaller and the hot point whiter, draws the ring closer and more saturated, strengthens the bloom, and draws each relation as a single bowed line of light (no dark ground and no wide body under it).

## 5A. C1 / C2 / C3 — one world at every distance (PO, 2026-11-10)
**The reference.** S3-R2 is one still frame with no camera. The approved derived reference (`QANDEEL_REPORTS/MAP-CLOSE-01/V3/ref`) fixed the rule. It is `web-cam.js`, generated from the pinned `web.js`, and without a camera it is byte-identical to `6bd02896…`. The rule:
- closer, the SAME material is revealed at a finer scale, so it stays about its FAR size on the glass;
- a place keeps its colour;
- nodes and relations keep their size.

**Where it lives.** One new module, `apps/mobile/src/map/visual/WorldContinuity.tsx`.
- Only the Personal owner opts in: `MapCanvas` passes `continuity` to `WorldCanvas`. It is off by default, and the Shared and Public worlds never pass it.
- It READS the generated I-08B1 schedule and never edits it. `world-visual.generated.ts`, `world-field.generated.ts` and `useWorldResponse.ts` are unchanged.

**C1: the S3-R2 material.**
- *What:*
  - **Deep space** (S3-R2 `amb` + `fill`): soft cool clouds in the world's own deepest cloud hues (its generated hue ladder), faint ridges where those clouds are, and quiet wisps.
  - **Fine threads** of each place (S3-R2 `fine` / `farweb`): hairline walkers on a flow field, clumped by a density field so dark voids stay. They take the colour the world has at the place's ADDRESS.
- *How (paint only):*
  - Two tiles, each painted ONCE per process in the S8B-06 bands (`rasterTile`, which releases the JS thread between bands).
  - The walk uses one shared periodic flow grid. It costs about 0.1 s of JS, once (measured without a JIT).
  - Each thread path is built from one string, so it costs one native call.

**C2: continuity.**
- *What:*
  - The deep space has one weight at every distance.
  - I-08B1's fade of the deep clouds is held to 35 % of itself (`ContinuityAtmosphere`).
  - I-08B1's FAR colour layer keeps 30 % after FAR.
  - The threads are drawn at FOUR world sizes (FAR, MID, NEAR, ANALYTICAL), one ×8 rung apart. They hand over to one another along the presented distance, on the plane's own frames, with no animation of their own.
- *How (paint only):*
  - The threads are world-anchored: the tile's origin is where the world's origin falls, computed from a place's exact address, so they travel and scale with the world.
  - The deep space sits at the clouds' depth plane.

**C3: ANALYTICAL.**
- *What:*
  - Past NEAR, a place's mass keeps its NEAR size on the glass (`NearCap`: a paint scale about the place's own point, exactly 1 at or before NEAR).
  - The threads take over the close-in texture, so the glass shows the place's material with its voids, not a fog.
- *How (paint only):*
  - The camera, placement, hit testing and accessibility are untouched.
  - The cap is a plain transform with no origin. It is never an anchor.

**Truth (unchanged).**
- Nothing in C1–C3 is an object, a relation, a group or a membership.
- The deep space is the same everywhere.
- A place's threads are the same material at every place, in the colour of the world at its address.
- No group, topic, name or synthetic membership from the reference was brought into the app.

## 6. Controlled amendments (named; none silent)
| Contract | Amendment | Why it is allowed |
|---|---|---|
| VPORT-02 world pins (`tests/vport-02-temporal-orientation-p2-contract.test.mjs`) | `MapCanvas` `a82f761f` → `cabef8ef`; `WorldMarks` `8b81a4e4` → the R1 blob; recorded in the test as "MAP-CLOSE-01 V-3 — CONTROLLED RE-ANCHOR" with the previous pins | PO authorization of V-3 (2026-11-10); paint-only by the structural diff |
| VPORT-01 chroma rule (`tests/vport-01-world-visual-contract.test.mjs`) | **tightened**, not relaxed: the Personal owner reads the chroma in `placeChromaOf` only, by a Home's address or its host Home's, and passes it to a tether and an object only. A mutation that colours a mark by anything else fails the test | makes the V-3 extension explicit |
| Personal map and screen goldens | re-recorded | paint-only by the structural diff (§7) |
| **C1–C3:** VPORT-02 world pins | `MapCanvas`, `WorldCanvas` and `WorldStrata` re-anchored; `WorldContinuity.tsx` pinned; recorded in the test as "MAP-CLOSE-01 V-3 C1–C3 — CONTROLLED RE-ANCHOR" with the previous pins | PO "V-3: Final Visual Integration — PO APPROVED" (2026-11-10); paint-only by the structural diff (§7) |
| **C1–C3:** VPORT-01 | `WorldContinuity.tsx` joins the hand-written visual owner under every rule (no colour literal, no forbidden read, no timer). `worldAddressOf` is read once more, for the continuity places only (count 3 → 4, the line pinned). A new test pins the module's imports, its Personal-only opt-in, the cap as a plain paint transform, and that nothing that decides reads it | makes the amendment explicit and narrow |
| **C1–C3:** Map runtime census | `visual/WorldContinuity.tsx` added to the authorized file surface | the new paint module is declared, not slipped in |
| **C1–C3:** `WorldStrata.tsx` | `Stratum` exported, otherwise unchanged | the deep space reuses the one stratum grid |
| **Part B:** S7-03 and S7-04 criterion-12 pins | `LivingAnalysisSurface.tsx` and `LivingAnalysisMap.tsx` re-anchored, each with a "MAP-CLOSE-01 V-3 Part B RE-ANCHOR" comment and its previous pin | PO addition to V-3 (2026-11-10); the projection, the cache, the frame, the plan, every touch and every refusal unchanged |
| **Part B:** S5-03B criterion 12 and the surface's own Jest rule | the screen's import list gains the theme (contrast, alpha) and the renderer seam; a new assertion admits ONLY `WorldContinuationContext` from the seam | the screen still holds no world, store, projection, inspection, time or Personal owner |
| **Part B:** VPORT-02 world pin | `WorldCanvas` re-anchored again, with its previous pin | without a continuation the canvas is exactly what it was: the Personal map golden is unchanged |
| **Part B:** T-10 §13 and S5-03B criterion 11 (the camera rebase) | the rule "the rebase is the LAST child of the transformed plane" is asserted on `WorldPlane`: its `children` come last inside the one `planeTransform` group (and, in a continuous world, inside the frame clip around that same group), and the rebase is the last of those children | the plane is drawn by one small component so that, without a continuation, the tree stays exactly what it was; the ordering the rule protects is unchanged |
| **Part B:** W3 E2E-D-10 (Analysis under a Light preference) | the return band now asserts `transparent`, and the ground under it, the Analysis surface's, asserts the Dark family | the band stands on the world; the Analysis is still the dark place under a Light preference |
| **Part B:** VPORT-01 plain-line rule | the substring test `includes('<Line')` became the element test `/<Line\b/u`, because it also matched the scrim's `<LinearGradient` | the rule is unchanged: the renderer draws no plain line of its own |
| **Part B R2:** VPORT-02 world pin, and both goldens | `WorldMarks` re-anchored ("MAP-CLOSE-01 V-3 Part B R2 — CONTROLLED RE-ANCHOR", with the previous pin): a mark's anchor carries an unbounded clip so that Skia's native recorder really saves for it (§11). Both goldens re-recorded | a renderer defect, found on the emulator and fixed at its source; the structural diff shows that clip on every anchor and nothing else |
| **R1 test re-anchor:** `world-visual.test.tsx` | the tether rule accepts S3-R2's bowed line (`M a Q c b`) and still asserts its two ends exactly (the Home and the appearance) | Slice 1 drew the bow, but the rule still asserted a straight `L`; it had been failing since R1 and was found here |

No other frozen file changed. The chroma families (`world-chroma.ts`), every token, both generated modules and `useWorldResponse.ts` are unchanged.

## 7. Verification
**Static and unit.**
- `tsc` and `eslint` are clean.
- Jest (`apps/mobile`): `src/map`, `src/shared-world`, `src/public-world`, `src/integration`, `src/living-analysis`, `src/replay-composite` and `src/replay-player` give 832 / 838.
- The 6 failures are in `depth.test.tsx` and `w2-account-access.test.tsx`. They fail identically on `main` `5a21971d`, so they are baseline and not caused by V-3.

**Contracts.** All pass:
- VPORT-01 12 / 12, VPORT-02 9 / 9, Map runtime 15 / 15;
- T-10 31, T-11 27, S5-03B 13, S5-03C 8, SHARED-VIS-01 8;
- S7-02 19, S7-03 31, S7-04 63;
- task-closure governance 24;
- every contract that reads the Map's visual or renderer code, and every one that reads the locators.

**Goldens: structural diff, not trust.**
- Both goldens were re-recorded. Each was compared with the R1 recording as a one-line-per-node outline (`git diff --no-index`).
- Personal map: the differences are only additions (the deep stratum, the four thread layers, the `NearCap` wrappers) and the nebula mask's opacity values (C2).
- Screen golden: identical once the C1–C3 additions are removed.
- A second commit re-records both goldens at the final tuning. The first recording predated the last tuning round and failed 22 cases. Every difference is one of two animated paint weights: thread weight 0.9 → 0.8 and deep-cloud alpha 0.45 → 0.4.
- The evidence is in `QANDEEL_REPORTS/MAP-CLOSE-01/V3/golden-c123`.

**Found and fixed.** The `world-visual.test.tsx` tether rule had been failing since R1 (§6).

**Device: the Android emulator, not a phone.**
- Setup: `sdk_gphone64_x86_64`, Android 16 / API 36, 1080 × 2400 at 420 dpi, software renderer (swiftshader).
- APK `v3-c123-c` (`ffca9014…`): the VPORT-01 proof root over the production integration runtime. Its sources are this branch's code.
- The matrix had 8 legs: `ar-standard`, `en-standard`, `travel-standard`, `ar-increased`, `ar-reduced` (Reduce Motion), `travel-reduced`, `ar-narrow` (360 dp) and `ar-landscape`. **All 8 PASS.**
- Each leg covers FAR, MID, NEAR, NEAR with a selection, and ANALYTICAL with the register, from the same proof world and camera steps.
- Two legs were rerun, and their invalid captures are archived, not counted:
  - `ar-standard`: a stray pointer event on the emulator's window during the ANALYTICAL step;
  - `ar-landscape`: the flow forced portrait. It now has its own landscape flow.
- Before / After boards (derived reference | `main` | R1 | C1–C3, at FAR / MID / NEAR / ANALYTICAL) are in `QANDEEL_REPORTS/MAP-CLOSE-01/V3/boards/c123` (`ar-standard`, `ar-increased`, `ar-reduced`, `ar-landscape`).

**What the device shows (a reading, not a test).**
- FAR, MID, NEAR and ANALYTICAL read as one world: the deep space, the place threads in each place's colour, and the nodes and relations unchanged.
- ANALYTICAL shows the place's material with its voids. R1 and `main` showed a fog there.
- The Timeline, the controls and the register are in place in every leg.

**Not proven.**
- **The empty map on a device:** the proof root has no empty-world entry. The empty world is covered only by the Jest golden case `surface:empty-world`.
- **A physical phone:** none is connected.
- **Accessibility with a screen reader:** not in scope (PO, 2026-11-08).

## 8. Step 3's closure (recorded here and in the registry)
- S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION; no S3-R3; AD-4 and S3-R1 are historical.
- The registry gains the S3-R2 rows (§3.3), the archive row (§3.5) and rule §2.6; its hash file checks 25 / 25.
- The S3-R2 archive v1 is a private draft release (`archive-map-close-01-s3-r2-final-art-v1`), with no third-party image.

## 9. Performance and the active call
**One-time JS cost.**
- The two tiles (threads, deep space) are painted once per process, in the S8B-06 bands (`rasterTile`), which release the JS thread between bands. This is the same mechanism as the nebula, the constraint that keeps live calls alive.
- Generating the threads costs about 0.12 s of JS, and the wisps about 0.03 s. Both were measured on the development machine without a JIT (`node --jitless`). They are not phone numbers.

**First paint on the emulator.**
- The tiles appear 35–60 s after the Analysis opens. This was measured on build `v3-c123-b`, which has the same painting path.
- Until then the world draws without the threads and the deep space, and nothing else waits on them.
- The emulator rasterises on the CPU (swiftshader), so this is not a phone number. **Phone first-paint time is NOT PROVEN.**

**Frames on the emulator (`dumpsys gfxinfo`, whole leg; same flow, same proof world).** The software renderer makes about 85 % of frames "janky" on every build, `main` included. These numbers compare builds; they do not judge smoothness.

| Leg | `main`: frames / p50 / p90 (ms) | R1: frames / p50 / p90 (ms) | C1–C3: frames / p50 / p90 (ms) |
|---|---|---|---|
| ar-standard | 66 / 97 / 1800 | 71 / 81 / 2000 | 72 / 89 / 1800 |
| ar-landscape | — | 69 / 93 / 2100 | 71 / 109 / 2100 |
| travel-standard | 77 / 300 / 2600 | 88–91 / 150–400 / 2400–2500 | 97 / 150 / 3450 |
| ar-increased | 71 / 113 / 2050 | 68 / 101 / 1950 | 73 / 93 / 2250 |
| travel-reduced | — | 45 / 81 / 1000 | 49 / 89 / 1250 |

- The travel tail is longer with C1–C3: p90 3450 ms against 2400–2600 ms.
- On the emulator, the four thread layers and the deep space cost frame time while the world travels. Whether that matters on a phone's GPU is **NOT PROVEN**.

**Memory on the emulator (`dumpsys meminfo`, one sample each).** The Analysis was open for 60 s, then travelled FAR → ANALYTICAL → FAR. Values are PSS in MB.

| Build | Total at rest | Native at rest | Total after travel | Native after travel |
|---|---|---|---|---|
| `main` | 230.4 | 96.0 | 249.6 | 102.8 |
| R1 | 234.8 | 97.2 | 232.9 | 102.7 |
| C1–C3 | 231.8 | 100.9 | 248.3 | 104.3 |

- Graphics memory reads 0 on swiftshader, so the tiles live in the native heap. C1–C3 is about 3.7 MB above R1 at rest and about 1.6 MB after travel. That is the size of the two tiles.
- The totals are within the run-to-run spread.

**During an active call.** This was not measured on a device. The protection is the S8B-06 banding, unchanged.

## 10. Not done yet
- **Part A Slice 2:** delivered as C1 (§5A).
- **Part B:** the Analysis screen UI (§11).
- **A physical phone:** none is connected. Every device result in this record is from the Android emulator, and is never claimed as phone proof.

## 11. Part B — the Analysis screen UI (PO addition, 2026-11-10)
**The PO's instruction:**
- the map extends as a continuous background behind the messages and controls, instead of ending at a hard horizontal edge;
- solid grey and black backgrounds become partly transparent dark layers, with local darkening where needed;
- text, playback and navigation controls and the Timeline stay clear and easy to use;
- the same map drawing surface is reused: no second engine, no doubled rendering;
- UI only: no change to Replay, recording, video or export logic; no frozen contract changed without governance;
- a separate, reviewable part of V-3, after the drawing is proven; not merged without the PO's approval.

**Reference:** the PO's reference image (a Replay screen over the S3-R2 art). Its topic names, groups and memberships are synthetic study data and are **not** carried into the app (§2).

**What the code already gave:** the map frame starts at the top of the screen. Its envelope's `insetTop` is the top band's measured height, so the placement already keeps everything the reader must see out from under the band. The band hid the world only because it painted a solid ground.

**The change (one surface, one canvas):**

| Where | Change |
|---|---|
| `WorldCanvas` | a `WorldContinuationContext` a surface may provide. With it, the ONE canvas paints its ground, strata and veil `below` points further than the frame, takes no touch of its own (`pointerEvents="none"`), and lays the surface's ink as a scrim over the top inset and over the continuation (fading into the frame). **Without it the canvas is exactly what it was.** Nodes, tethers, the register, the envelope, the camera and hit testing keep the frame: `WorldPlane` clips the plane's objects to it and fades its material out below it |
| `LivingAnalysisSurface` | `continuousWorld` (opt-in, default off) provides the continuation: `below` is the measured column below the frame; the scrim is the Analysis's own ink. **Off under increased contrast** (F1: no word stands on the world's light) |
| `LivingAnalysisMap`, `ReplayMomentComposite` | opt in. Shared and Public worlds do not, and are unchanged |
| `AnalysisReturnBar`, Replay `PlayerBar` | transparent ground (the scrim is under them); solid under increased contrast |
| Replay message fields | a dark, partly transparent field (`field` at 0.76) with a faint edge; solid under increased contrast. R3: the edge's 1 pt comes out of the field's padding, so the box keeps its size. On the emulator, the first build's edge had lifted everything above the message by about 2 pt |

**Goldens.** The Personal map golden is unchanged. In the screen golden, 11 of 15 cases changed, and the increased-contrast cases did not. Every View, Text, layout, testID and touch handler is identical in all 15 cases (the host outline, 1010 lines before and after). The Skia layer changes only in these ways:
- the Canvas is taller and takes no touch (`pointerEvents="none"`);
- the ground, the strata tiles and the veil cover the extra area;
- the scrim adds two gradient rects.

**Found on the emulator and fixed: the plane must not run on.** The first build let the whole plane run on below the frame. In `touch-after`, a place's mark and glow then stood under the Timeline, outside the frame, where no touch reaches it.
- Before Part B, the canvas ended at the frame. A place the presentation keeps just outside the frame, so a pan can bring it in, was cut off there.
- Now `WorldPlane` keeps that boundary in a continuous world:
  - the plane's material (place atmospheres, threads) fades out over the scrim's own 44 pt below the frame's edge (a `dstIn` mask);
  - its relations and objects keep the frame exactly (a clip);
  - only the ground, the deep space, the clouds and the veil continue.
- The structural diff against the first Part B recording: in each of the 11 changed cases, every node is identical apart from the new wrappers (the fade layer, its mask, the frame clip, and the second plane transform).

**Found on the emulator and fixed at its source (R2): a mark popped a save that was not its own.** The R1 build still showed one place's mark under the Timeline, although its glow now faded.
- **How it was found:** a diagnostic build, never committed, moved the frame clip to half the frame's height and drew a line at each edge. The two places drawn first lost their marks below the line. The three drawn after them kept theirs, so the clip held for some objects and not others.
- **The cause** is in Skia 2.6.2:
  - a mark's anchor (`MarkBody`) is a group carrying only an origin;
  - the JS recorder issues a save and a restore for it;
  - the native recorder saves only for a transform, matrix, clip or layer, but restores anyway.
- **The effect:** each mark popped one save belonging to its enclosing groups (its object transform, then the plane transform, then the frame clip). At rest every one of those transforms is the identity, so nothing showed before Part B. The frame clip was the first of them whose loss can be seen.
- **The fix:** the anchor carries an unbounded clip (`ANCHOR_SAVE`). Its save becomes real, and it cuts nothing. The anchor is still the one group with an origin and no transform, so every reader of the paint finds it unchanged.
- **Goldens:** both re-recorded. The structural diff shows exactly one change: that clip on every anchor (36 in the screen golden, 67 in the Personal map golden). The evidence is in `QANDEEL_REPORTS/MAP-CLOSE-01/V3/golden-anchor`.
- **Reach:** the Shared and Public worlds draw the same anchor, so they get the same correction. Their tests pass unchanged.
- **Not proven:** that, before this fix, later marks lost the plane's transform during a camera travel on any map. The mechanism implies it, but it was neither observed nor measured here.

The evidence is in `QANDEEL_REPORTS/MAP-CLOSE-01/V3/golden-partb`.

**Cost:** one canvas, as before. Only the ground, the strata tiles and the veil grow to the extra area; nodes, relations and place atmospheres do not, and nothing is drawn twice. Measured in §9.

## 12. Backlog
_(reconciled at V-3's closure.)_
