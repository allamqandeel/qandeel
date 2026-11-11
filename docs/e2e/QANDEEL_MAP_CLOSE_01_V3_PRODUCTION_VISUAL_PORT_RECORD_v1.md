# QANDEEL — MAP-CLOSE-01 Step 4 / V-3 — Production Visual Port of S3-R2 — Record v1

**Status:** `MAP-CLOSE-01 STEP 4 / V-3 — PART A (SLICE 1 + C1 / C2 / C3) DELIVERED ON A DRAFT PR — PART B (ANALYSIS SCREEN UI) ON A STACKED DRAFT PR — PO SCOPE CORRECTION (THE THREE WORLDS, §5B): PHONE PROOF RUN — FUNCTION 36 / 36 PASS — PO ADDENDUM (PREMIUM COMPACT UI, RTL / LTR, SCREEN SPACE) DELIVERED ON PART B — PO REVIEW CORRECTIONS (TIMELINE IN P2 C'S DIRECTION, RTL / LTR, COMPACT ACTS, CI) DELIVERED ON PART B, UNDER PO REVIEW — PAN PERFORMANCE NOT MET, AWAITS THE PO — NOT READY FOR CLOSURE — NOT MERGED`
**Task:** MAP-CLOSE-01 Step 4 / V-3, the production visual port of the approved S3-R2 art direction into the existing Personal Living Analysis map.
**Date:** 2026-11-10. **Baseline:** `main` at `5a21971d` (the merge of PR #390, MAP-CLOSE-01 Step 2). **Branch:** `map/map-close-01-v3-production-port`.
**Authority:** Product Owner, 2026-11-10, six messages:
1. **"PO Final Visual Approval & Step 4 / V-3":** S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION; close Step 3; V-3 is authorized.
2. **"إضافة محدودة إلى V-3 قبل الإغلاق":** the Analysis screen UI around the map joins V-3's scope, as a separate reviewable part after the drawing is proven (§11).
3. **"PO Decisions: FAR / MID / NEAR Visual Continuity":** D1 approved (MID and NEAR derive from S3-R2 as the same world, closer); D2 approved conditionally (a governed change of the world's response to distance, for the Personal Map only, separated from the frozen sources); D3 approved (ANALYTICAL is fixed in paint, not geometry); D4 keep (the register is unchanged). A derived reference comes first.
4. **"V-3: Final Visual Integration — PO APPROVED":** the derived continuity reference is approved for FAR / MID / NEAR / ANALYTICAL; C1, C2 and C3 are authorized inside V-3 (§5A); Part B follows once the map is proven; no new art round.
5. **"MAP-CLOSE-01 / V-3 — PO Scope Correction Before Merge":**
   - the Personal, Shared and Public worlds share one graphic language and one renderer, and differ only in their data, meanings and acts;
   - S3-R2 (the space materials, nebulae, threads, glow and continuity) and the transparent Analysis screen reach all three worlds, through the existing shared structure;
   - no Personal morphology, membership or relation reaches another world;
   - V-3 does not close before the three worlds are proven, including on a real Android phone (§5B).

   This replaces D2's "for the Personal Map only".
6. **"تحسين أداء التلاشي" (an addition to message 5):** evaluate, inside V-3, bounding the material layer to `envelope.height + 44`.
   - Implement it only if the measurements show a benefit, with no unacceptable visual difference, no transition defect and no new horizontal seam.
   - Record the before / after comparison in the closure report (§11 of the stacked Part B).

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
- **Shared and Public marks** keep the frozen grammar: only the Personal owner passes a chroma to a mark (the neutral Public circle, S5-03B D2). Since the scope correction, their WORLD is S3-R2's (§5B).
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
- A world's owner opts in: `MapCanvas` passes `continuity` to `WorldCanvas`, and since the PO's scope correction so do `SharedFieldView` and `PublicFieldView` (§5B). It is off by default.
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

## 5B. The three worlds (PO scope correction, 2026-11-10)
**The gap, exactly.**
- The three worlds already paint through ONE renderer: `WorldCanvas`, inside the one world view.
- They share one camera metric. The Shared field reuses the Public camera: FAR is the Map's default scale, with one frozen ×8 reinforcement per rung.
- The Shared and Public owners already hand the renderer each place's served address, for the LA-VIS-01 place colour.
- What was missing was one opt-in prop. Only `MapCanvas` passed `continuity`, and VPORT-01 asserted that the Shared and Public fields did not.
- The transparent screen is the stacked Part B's.

**The change (the smallest).**
- `SharedFieldView` and `PublicFieldView` pass `continuity` beside the address they already pass. Nothing else of theirs changes.
- `WorldCanvas` and `WorldContinuity` change in their comments only, which said the continuity was Personal's alone.

**What stays each world's own.**
- Data, disclosure, positions, the camera and every act.
- Hit testing: the targets are views outside the canvas.
- The marks: the Shared and Public fields keep the neutral circle (S5-03B D2) with no chroma.
- No Personal morphology, membership, tether or relation travels.
- The glow they share is the world's colour around each place (LA-VIS-01), which they already had.
- Their relations: Public draws only S5-03C's explicit relation lines; Shared draws none.
- Their distances:
  - the Shared and Public fields stop at NEAR, so C3 (which acts only past NEAR) never acts there;
  - the threads' four world sizes are read from the presented distance on the same metric, so FAR, MID and NEAR hand over exactly as in the Personal world.

**Contracts.**
- **VPORT-01 (controlled amendment):**
  - the "Personal only" rule becomes: every world's owner opts in, beside its served address, and takes nothing else of the Personal world (no chroma on a mark, no morphology, no tether);
  - the test also requires each field's behavioural proof below.
- **VPORT-02:** `WorldCanvas` and `WorldContinuity` are re-anchored. Their comments changed only, and both goldens are unchanged.
- **No other contract conflicts.** S5-03B (neutral circle, no colour of its own, no line of its own), S5-03C and SHARED-VIS-01 pass unchanged.

**The proof is behaviour, not a changed assertion.** Each field's own Jest suite (`shared-field.test.tsx`, `public-field.test.tsx`) walks the same World through FAR, MID and NEAR twice: as shipped, and with the generic canvas forced to paint WITHOUT the continuity. It finds:
- every target, label, panel and band identical (the whole host tree outside the canvas);
- every mark body, selection marker and circle identical;
- no line drawn;
- more recorded pictures with the continuity (the deep space and the fine threads).

**On the PO's phone (the stacked Part B's §11 carries the evidence).**
- Function: 36 / 36 PASS (Before, After and a fade variant × four legs × the three worlds).
- Pan performance: NOT MET. The continuity lowers the Shared and Public fields' presented frames by about a third, and the Personal port halves them against main. Awaits the PO's decision.
- A two-finger pinch is not proven (Maestro cannot pinch).

**The PR order is unchanged.** This commit is on Part A (#391). Part B (#392) merges it in, and no history is rewritten.

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
| **Three worlds (§5B):** VPORT-01 | the continuity test's "Shared and Public do not opt in" becomes "every world's owner opts in, beside its served address, and takes nothing else of the Personal world"; it also requires each field's behavioural proof | PO scope correction, 2026-11-10 |
| **Three worlds (§5B):** VPORT-02 world pins | `WorldCanvas` `69b6a183` → `43c66051` on Part A, and `54cefdf0` → `55e441d7` once merged into Part B; `WorldContinuity` `4c49a094` → `632de2b2` (comments only); recorded in the test with the previous pins | PO scope correction; both goldens unchanged |
| **Pan/Zoom performance slice (2026-11-11):** VPORT-02 world pin | `WorldStrata` `6f6b8b94` → `77ea34d7`: `FadedLayer` bounds its layer with an outer clip (the content's bounds plus 32). Recorded in the test with the previous pin | the PO's performance slice; both goldens re-recorded, and removing the added clip wrappers (607 in the map golden, 568 in the screen golden) gives the previous goldens exactly. On the PO's phone, 99.79–99.94 % of pixels are identical at rest; the rest are within 2 / 255 |
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

**The three worlds (§5B): repository checks.**
- `tsc`: clean.
- `eslint`: no error in the changed files. The warnings are in files this change does not touch.
- Jest (`src/map`, `src/integration`, `src/living-analysis`, `src/shared-world`, `src/public-world`): 737 / 743.
  - The 6 failures are the same baseline (`depth`, `w2-account-access`).
  - Both goldens pass unchanged.
- Shared and Public suites: 120 / 120, including the four new proof cases.
- Root contracts that read the world's visual or renderer code, the Shared or Public field, the Living Analysis surface or the locators: 438 / 438.

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
- **A physical phone:** none was connected at this run (the three worlds were later run on the PO's phone, §11).
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

### Pan performance on the PO's phone: diagnosis (2026-11-11)
Measured on the PO's phone (HONOR ALI-NX1, Snapdragon 6 Gen 1) with the proof package only. Frames are those SurfaceFlinger presented during six pans, two rounds per variant. The variants came from a measurement build that is never committed; a deep link turned paint parts off one at a time.

**Where the time goes (Personal, fps while panning).**

| Variant | fps |
|---|---|
| everything drawn | 5.3–5.4 |
| WorldTone off | 14.4–18.9 |
| WorldTone as one plain colour-filter layer (not the curve; cost only) | 15.2 |
| WorldTone clipped to the canvas | 5.3 |
| ground, strata, deep space, masses, threads, veil or material off, one at a time | 3.1–5.9 (no single part) |
| objects and connections off | 9.1 |
| the whole map off | 55.4 |

**The cause: the tone runs once per draw.** RN Skia 2.6.2 sets a Group's `<RuntimeShader>` on the paint its children inherit, not on a layer, so the tone curve opens an image-filter layer for every draw under it. The curve is meant to apply once, to the composite (`WorldTone`'s own comment; I-08B1 `renderComposite`).

**One fix adopted here, pixel-preserving.** `FadedLayer` bounds its layer (§6). Presented fps while panning (Before = Part B head; three rounds of six pans):

| World | Before | With the bound |
|---|---|---|
| Personal | 3.3 | 4.5 |
| Shared | 5.0 | 5.2 |
| Public | 5.9 | 16.7 |

**One fix NOT adopted: it changes the picture and awaits the PO.** With the tone applied once to the composite, as one layer:
- Personal goes from 5.3 to 33.1 fps (p50 100 → 33 ms);
- Shared goes from 3.9 to 26.7 fps;
- Public goes from 16.5 to 28.8 fps.

The world is darker, though. At rest in Personal, mean luma in the map goes from 50.7 to 37.0, and the mean per-pixel change is 17 / 255, against 0 between repeat captures. That is an S3-R2 appearance change, so it is not made without the PO.

The colour filters RN Skia 2.6.2 offers cannot reproduce the per-draw result exactly for transparent draws: there is no runtime colour filter, and soft light, the only blend that squares the destination, divides by its alpha. **Pan performance therefore remains NOT MET.**

**PO review (2026-11-11): candidates C, D and E, measured, none adopted.** See Part B §11, "PO review corrections". The composite layer is rasterized below screen resolution, which is why B is soft and fast. A fitted pass (C) restores luminance and colour but not the threads. The canonical curve as a per-draw colour filter (D) keeps A's look within 1.3 levels and reaches about 15 fps (Personal, Shared). Pan remains NOT MET.

## 10. Not done yet
- **Part A Slice 2:** delivered as C1 (§5A).
- **Part B:** the Analysis screen UI (§11).
- **A physical phone:** every device result before the scope correction is from the Android emulator and is never claimed as phone proof. The three worlds were run on the PO's phone (§11): function passes; pan performance is NOT MET and awaits the PO.
- **The three worlds on a real phone (§5B):** run on the PO's phone (Part B §11). Function passes; pan performance is NOT MET and awaits the PO's decision. V-3 does not close on it.
- **The PO review (Part B §11, 2026-11-11), awaiting the PO:**
  - the Timeline, acts and space corrections, with the controlled amendment to G3 §2.5;
  - WorldTone candidate D (or none);
  - the deferred Unified Timeline direction, first as one report and one visual concept.
- **The PO addendum (Part B §11), awaiting the PO:**
  - the composite tone (§9);
  - the Copy Gate (4 PROPOSED);
  - permission to switch the phone's font scale, contrast and motion for this addendum's legs.

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
| `LivingAnalysisMap`, `ReplayMomentComposite` | opt in. Since the PO's scope correction, `SharedLivingAnalysis` and `PublicLivingAnalysis` opt in too (below, "the three worlds") |
| `AnalysisReturnBar`, Replay `PlayerBar`, and (three worlds) the Shared and Public top bands | transparent ground (the scrim is under them); solid under increased contrast |
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

**Cost:** one canvas, as before. Only the ground, the strata tiles and the veil grow to the extra area; nodes, relations and place atmospheres do not, and nothing is drawn twice. Measured below.

### Part B: repository checks (at R3)
- `tsc` and `eslint` are clean.
- Mobile Jest 3471 / 3477. The 6 failures, in `depth` and `w2-account-access`, are the same as on `main` `5a21971d`.
- Root contracts: 546 / 546, every contract that reads the map, the renderer, the Replay, the record or the locators, including `test:task-closure-governance-contract`.

### Part B on the emulator (validation only; not phone proof)
**Setup:** Android emulator, API 36, swiftshader (CPU raster), 1080 × 2400, 420 dpi.
- **Before** = Part A (`v3-c123-c`). **After** = Part B at R3.
- Same proof world and same steps on both sides.
- Text at 100 % and the device density on every leg.
- The other proof packages stay disabled, so a deep link has one target.

The evidence is in `QANDEEL_REPORTS/MAP-CLOSE-01/V3/device/partb` and `boards/partb`.

| What | Result |
|---|---|
| Real touch: pan inside the frame, the return control on the support, a Timeline point, a scroll of the support, the top band's way back to the Conversation | 4 / 4 PASS After (ar, en, increased contrast, Reduce Motion), every step asserted; the same 4 / 4 Before |
| Replay: the Analysis, then the Replay player at a real moment | 2 / 2 PASS After (ar, increased contrast); 2 / 2 Before. After R3 the player line, caption and message stand exactly where they stood Before |
| The full VPORT-01 matrix (FAR, MID, NEAR, ANALYTICAL; ar, en, increased contrast, Reduce Motion, narrow, landscape, both travels) | 8 / 8 PASS After; all 32 captures show the map |
| Increased contrast | identical to Before: the frame ends the world and the bands are solid |
| The mark under the Timeline (R1, R2) | gone at R2: nothing of the plane stands below the frame |

**Found on the emulator and voided:** the first After matrix (R2) also reported 8 / 8 PASS. The emulator restart had enabled the other proof packages again, though, so from MID on its deep links opened Android's app chooser, and the captures show the chooser, not the map. Those results are void and kept as such (`device/partb-r2-matrix-void-chooser`). The flows' own assertions did not catch it.

**Inside the frame** (ar-standard, the same state, mean luminance per 100 px band):
- the frame's top is about 14 % darker: the scrim fades into the frame below the now-transparent top band;
- the frame's lower part is about 5–7 % brighter: the vignette now spans the whole screen, not only the frame;
- the middle is unchanged.

**Text over the world** (`contrast.mjs`, an approximation: the text's brightest pixels against the 99th percentile of the background, in WCAG terms):

| Where | Before worst / median | After worst / median |
|---|---|---|
| Analysis top band | 12.9 / 12.9 | 11.0 / 12.0 |
| Analysis support at rest | 8.4 / 8.4 | 6.4 / 8.1 |
| Analysis support with the return options (en) | 4.2 / 12.9 | 4.1 / 12.5 |
| Replay message | 11.2 / 12.1 | 9.4 / 12.2 |
| Replay caption line (secondary ink) | 3.3 / 5.4 | 3.2 / 5.2 |

The two lowest rows were low Before too. Their worst background pixel is a control (the Timeline's or the player's marks), not the world.

**Frames** (`dumpsys gfxinfo`, the whole leg, against the Part A matrix rerun on the SAME emulator boot, `matrix-before-sameboot`):

| Leg | Before p50 / p90 / p95 | After p50 / p90 / p95 |
|---|---|---|
| ar-standard | 77 / 1500 / 2200 ms | 85 / 2150 / 3200 ms |
| en-standard | 73 / 1450 / 2250 ms | 77 / 2200 / 3300 ms |
| travel-standard | 150 / 2250 / 2700 ms | 121 / 2350 / 3350 ms |
| ar-increased (no continuation) | 69 / 1350 / 1450 ms | 65 / 1350 / 1450 ms |
| ar-reduced | 65 / 750 / 750 ms | 65 / 1050 / 1100 ms |
| travel-reduced | 61 / 750 / 800 ms | 69 / 1000 / 1100 ms |
| ar-narrow | 65 / 900 / 1200 ms | 69 / 1050 / 1200 ms |
| ar-landscape | 81 / 1700 / 1800 ms | 81 / 2050 / 2300 ms |

**Reading:**
- The median frame is unchanged.
- The tail is longer wherever the world continues: on this CPU rasteriser the canvas covers about 1.76 × the frame's area, and the plane's material is composited through one fade layer.
- Under increased contrast, where the world does not continue, nothing changed: that is the control.
- A first comparison against the Part A matrix of an earlier emulator boot was not comparable (different frame counts) and is not used.
- Whether the longer tail exists on a phone's GPU is **not proven**.

**Memory** (`dumpsys meminfo`, KB PSS, the same boot, alternating A, B, A, B; the Analysis open 60 s, then one travel FAR → ANALYTICAL → FAR):

| Build | At rest: native / total | After the travel: native / total |
|---|---|---|
| Part A, run 1 | 101927 / 230394 | 106562 / 235896 |
| Part B, run 1 | 100966 / 232792 | 105622 / 235456 |
| Part A, run 2 | 101778 / 231442 | 106326 / 247135 |
| Part B, run 2 | 101534 / 230261 | 104514 / 244064 |

Part B is within the run-to-run noise of Part A: the larger canvas adds no retained memory (the tiles are the same tiles).

**Not proven for Part B:**
- a physical phone;
- the phone frame tail;
- the empty map on a device (Jest golden only).

### Part B: the three worlds (PO scope correction, 2026-11-10)
**The gap.** The Shared and Public screens are the same `LivingAnalysisSurface` as the Personal one, but they did not pass `continuousWorld`, and their top bands (`SharedBand`, `PublicBand`) painted a solid `palette.world`. Their world (the S3-R2 continuity) is Part A's §5B, merged into this branch.

**The change (UI only).**
- `SharedLivingAnalysis` and `PublicLivingAnalysis` pass `continuousWorld`. Off under increased contrast, as everywhere.
- Their top bands are transparent; solid under increased contrast (F1), exactly as the return band.
- Their panels, search field, search results and section list keep their own `palette.field` ground. They are fields the reader reads, not bands.
- Nothing else moves: the frame, the envelope, the plan, the targets, the labels, the camera, the controllers and every act.

**Controlled re-anchor.** `public-field.test.tsx` "is the Analysis place: dark under a light reader preference": the band now asserts `transparent`, and the ground under it (the Analysis surface's) asserts the Dark family. This is the same re-anchor as W3 E2E-D-10.

**Proof (Jest), in each world's own suite.**
- Standard contrast: the band is transparent, and the ONE canvas runs on to the screen's height behind the support band and takes no touch there (`pointerEvents="none"`).
- Increased contrast: the canvas ends at the frame and takes touch as before, and the band keeps its solid ground.

**Repository checks.**
- `tsc` is clean. `eslint` shows no errors; its warnings are in files this change does not touch.
- Shared and Public suites: 232 / 232.
- Root contracts that read the map, the renderer, the Living Analysis surface, the Replay, the Shared or Public field, or the locators: 488 / 488.

**On a device:** the three worlds were run on the PO's real phone (below), not on the emulator. The emulator shut itself down during the first attempt and was not used again.

### The three worlds on a real Android phone (PO scope correction and the fade addition, 2026-11-10)
**Device and method (validation only).**
- The PO's phone (HONOR, Android, 1200 × 2652). The Product app on it is never installed, launched, linked to or measured.
- Every APK is the S4-01 proof root (synthetic fixtures), built for the phone as a SEPARATE package (`com.qandeel.mobile.v3proof`, label "QANDEEL V3 Proof", arm64-v8a). The Product entry was restored after each build.
- Deep links go to that package alone (`am start -a VIEW -d … <package>`), because the Product app also answers `qandeel://`.
- Leg settings were switched only for their leg, with the PO's approval, and restored to the recorded originals: increased contrast = High contrast text; reduced motion = the three animation scales at 0. Read back after the runs, the originals were all in place.
- APKs: **main** = `5a21971d`; **Before** = `02b46ad3` (Part B before the scope correction: Shared and Public without the continuity, with solid bands); **After** = `da608237` (this branch); **Fade** = `da608237` plus the bounded material layer (measurement only, never committed).

**Function: 36 / 36 PASS.** Three APKs (Before, After, Fade) × four legs (Arabic, English, Arabic increased contrast, Arabic reduced motion) × three worlds. Every step asserts what it reached:
- **Personal Analysis:** FAR, a hand pan, the return control, a Timeline point, the support scroll, back to the Conversation.
- **Shared World:** FAR, a hand pan, MID by a tap on a place, NEAR by choosing a place (its panel), Back to MID, the World's conversation.
- **Public World:** FAR, a hand pan, MID by a tap, NEAR by choosing an Experience (its panel), Back to MID.

**What the captures show.**
- After brings the S3-R2 world (deep space, the fine threads, the glow) into the Shared and Public fields at FAR, MID and NEAR, and their top bands stand on it.
- Under increased contrast the bands keep their solid ground and the canvas ends at the frame.
- The targets, labels, panels and acts are the same as Before.

**Text over the world.** This is an approximation: for a band, it compares the brightest 0.5 % of pixels against the background's median and 99th percentile.

| Measured band | Before | After |
|---|---|---|
| Header and panel text | identical | identical |
| Place label at NEAR (Shared), median | 12.3:1 | 9.3:1 |
| Place label at NEAR (Shared), worst case | 2.6:1 | 2.4:1 |

- The median drops because the glow lifts the ground under the label.
- The worst case is a bright thread crossing the text, and it is the same in Before.
- At MID in both fields, the threads cross the place labels. This is an observation for the PO's visual review, not changed here.

**Cold Start** (`am start -W`, six runs each, TotalTime):

| APK | Range | Median |
|---|---|---|
| Before | 274–304 ms | 298.5 ms |
| After | 266–319 ms | 291.5 ms |
| Fade | 254–313 ms | 294.5 ms |

All three are within the spread.

**Pan performance.**

*Method.*
- `gfxinfo` sees only the host window's own work. The Skia canvas composes into that window, so the honest per-frame measure is SurfaceFlinger's present times on the window layer.
- Each APK, each world: three rounds of six hand-like pans (`input swipe`, 700 ms each), in the same state for every APK.
- "fps" counts the presented frames over the pan time. Gaps over 1.5 s, between swipes, are dropped.

*Frames presented (three rounds):*

| APK | Personal Analysis | Shared field (FAR) | Public field (FAR) |
|---|---|---|---|
| main `5a21971d` | 112 frames · 6.6 fps · p50 83 ms | 126 · 7.6 fps · p50 100 ms | 141 · 9.1 fps · p50 67 ms |
| Before `02b46ad3` | 51 · 2.6 fps · p50 333 ms | 130 · 7.3 fps · p50 67 ms | 129 · 8.0 fps · p50 83 ms |
| After `da608237` | 52 · 3.3 fps · p50 250 ms | 78 · 5.0 fps · p50 133 ms | 89 · 5.9 fps · p50 100 ms |
| Fade | 52 · 2.8 fps · p50 283 ms | 79 · 4.6 fps · p50 133 ms | 80 · 5.4 fps · p50 133 ms |

*What it shows.*
- **Not met.** Panning is not smooth on this phone in any APK, main included.
- **A regression.** The S3-R2 port roughly halves the Personal Analysis's presented frames against main (Part A, already in Before). The scope correction lowers the Shared and Public fields by about a third against Before.
- **Not adopted here.** Optimising the paint was not authorised under "no redesign, no engine rebuild". This regression is the PO's decision, and V-3 does not close on it (§10).
- **Window frames.** `gfxinfo` (whole walks, every leg) agrees in direction. The Shared and Public window frames were already slow in Before (p50 150–250 ms), and After adds about 50–150 ms at p90 in both. Memory (PSS, Graphics) is within the run-to-run spread.

**The fade's bound (PO addition): measured, not adopted.**
- **Bounding.** The material's offscreen layer, inside an outer clip of `envelope.height + 44`, was bounded in a separate APK. Skia saves a group's layer before its own clip, so the bound needs the group around it.
- **Visual check: nothing changed.** Same-step captures against After differ in at most 0.01 % of the pixels below the status bar, by at most 6 levels.
  - The per-row seam check finds no new horizontal edge: 0.00 at the frame's foot in the Personal Analysis.
  - The MID captures differ as much as two runs of the same APK do, because the hand pan is not pixel-repeatable.
- **Performance: no benefit.** Frames presented while panning (table above) and every `gfxinfo` and memory figure are within the spread of After.
- **Not adopted.** The PO's condition for implementing it, a measured benefit, is not met. The code stays as it is.

**Not proven.**
- A two-finger pinch: Maestro cannot pinch. The zoom is proven by the tap and by choosing a place, and the accessible step is proven in Jest.
- Pan performance at an acceptable level, in any of the three worlds.
- Any screen reader proof (PO, 2026-11-08: none).

**Evidence (reports folder, outside the repository).**
- `device/three-worlds/phone/{before,after,fade}`: captures, Maestro logs, gfxinfo, meminfo, Cold Start.
- `device/three-worlds/phone/pan/{main,before,after,fade}`: SurfaceFlinger latency dumps.
- `boards/three-worlds/phone/*.png`: per leg, plus Before / After / Fade.
- `scripts/run-phone.sh`, `pan-bench.sh`, `pan-summary.mjs`, `phone-pixcmp.mjs`, `contrast.mjs`, `build-phone-apk.sh`.

### Part B: Premium Compact UI, RTL / LTR and screen space (PO addendum, 2026-11-11)
**The PO's instruction (within the performance slice):**
- the map first;
- Arabic on the right and English on the left;
- no persistent explanatory paragraphs: actions read from their labels and states, and the guidance moves to a contextual path;
- semi-transparent dark glass without heavy blur;
- the existing tokens and components, and no new design system;
- each world keeps its own tools; no Timeline in Shared or Public; Replay logic untouched;
- Before / After space measurements;
- no performance regression.

**Skills actually used.** None of the named Design / UI skills is installed in this session, and none was installed. The work uses only the app's own sources:
- the Analysis ink and type (`useAnalysisInk`, `useAnalysisType`) and `withAlpha`;
- the 44-point target floor;
- the app's own direction rule: the physical reading side comes from the Product language, never from the platform layout direction. This is the `readerSide` pattern in `conversation/bidi.ts`, already used by ConversationSurface, ReplayMomentComposite and AnalysisReturnBar. The app never enables RTL layout, and Android ignores `writingDirection`.

**One visual direction: the reference's compact glass.**
- the world takes the room the support band does not need;
- one status row: the spatial sentence on the reader's side, and one "details" pill at the other end;
- the return acts as compact glass rows: the world ink at 0.56 with a hairline of the primary ink at 0.14, and no blur;
- the Timeline instrument unchanged.

**What changed (Personal Analysis).**

| Component | Change |
|---|---|
| `OrientationChrome` | optional `details` (shown, onToggle). With it, the chrome is COMPACT: a status row (the sentence plus a pill that shows or hides the details, `accessibilityRole="button"`, `accessibilityState.expanded`, min 44 pt). Without it, T-08's chrome is exactly as it was (Shared, Public and Replay pass none). Every sentence is aligned to the reader's side |
| `ReturnControls` | `presentation` PLAIN (default, unchanged) or COMPACT: the label only, on a glass ground. The hint stays the act's `accessibilityHint` and is shown with the details. The composite act's conditional promise (`GO_LIVE_AND_LOCATE`) is always shown. The acts, their order, their words and their availability are unchanged |
| `TemporalOrientationLine`, `InspectionOrientation`, `TemporalNavigator`, `PresentationNavigator` | `textAlign` by the reader's language, and 16 pt from the screen's edge |
| `TemporalTargetLayer` / `TemporalNavigator` | `tools` / `routes`: the exact-entry field and the step and rejoin buttons are details on request. The summary element (the temporal statement and every named act) always stays; with the details hidden and no temporary look, its duplicate words leave the screen (a one-point clipped line). Commit and cancel are always shown while a temporary look exists |
| `PresentationNavigator` / `TimelinePresentation` | `tools`: the typed command field, its helper and its act are details on request. The position element (the window's accessible route) always stays |
| `LivingAnalysisMap` | holds the one switch (starts hidden, not remembered) |
| `responsive/plan.ts`, `ResponsiveTimelineRow`, `LivingAnalysisSurface` | the Personal band is sized to what its Timeline and chrome measure, by SHARED-VIS-01's rule. The cap is the room the band had, so the world never gets less than before. The Timeline keeps its 136-point instrument floor. Over the cap, the chrome keeps up to its share and the Timeline takes the rest, and whatever does not fit stays in each region's scroller. Shared, Public and Replay (`CHROME_ONLY`) are unchanged |
| `product-copy.ts` | four words (Copy Gate below) |

**Not changed:**
- the Timeline's Track, strip, rail, steps, keys, window, Live edge and every temporal act;
- camera geometry, data coordinates and zoom;
- the Shared and Public tools;
- Replay recording, playback and export.

**Copy Gate: 4 PROPOSED, not approved.**

| Key | Arabic | English |
|---|---|---|
| `details.SHOW` | عرض التفاصيل | Show details |
| `details.HIDE` | إخفاء التفاصيل | Hide details |

**Controlled amendments (named).**

| Contract | Amendment |
|---|---|
| S7-03 / S7-04 criterion 12 | `LivingAnalysisSurface` and `LivingAnalysisMap` re-pinned ("PO ADDENDUM RE-ANCHOR", previous pins e623c27a / 17c56308) |
| SHARED-VIS-01 5b | Personal is measured too, by the same rule; a world with no track is still measured alone and as before |
| VPORT-02 G3 composition | the chrome band reports its content in every world; the line's room still comes from the chrome, never from the world |
| T-05 byte identity | `PresentationNavigator` (2d3cc7e7 →) and `TimelinePresentation` (a1938372 →) re-pinned; the permanent claims (no store authority, the strip directly under the Track, the imports) still pass unchanged |
| Living Analysis surface test | "a world with a temporal track never measures its chrome" becomes the measured-band rule (one region measured moves nothing; floors; cap) |
| Screen golden | re-recorded. The changes: the details pill and the Timeline content wrapper are added; the exact-entry field, the step and rejoin buttons and the typed command field leave the default tree (present again with the details); the summary element is in every case; `previewing` keeps commit and cancel |

**On the PO's phone (validation only).**
- **Device:** HONOR, 1200 × 2652, density 3.25.
- **Package:** the proof package `com.qandeel.mobile.v3proof` only.
- **APKs:**
  - Before = `da608237`, Part B before this addendum;
  - After = `2f959af7` plus this UI, `v3proof-ui4`.
- **Method:** a uiautomator dump of each state gives the map frame and the support band; px / 3.25 = pt.

| Personal Analysis (Arabic and English alike) | Before | After |
|---|---|---|
| Map frame at rest | 1469 px (452 pt) | **1843 px (567 pt), +374 px, +25 %** |
| Support band at rest | 1144 px | 770 px |
| Persistent explanatory paragraphs | 2 (the command key list; the return acts' two explanations after a pan) | **0** (shown with the details) |
| Map frame after a pan (two return acts shown) | 1469 px | 1492 px; the acts as labels on glass |
| Details shown | — | the band at its cap (1144 px, the room it had), and everything it holds scrolls |

**Alignment and layout.**
- Every line of the Analysis chrome starts on the reader's side: Arabic on the right, English on the left, 16 pt from the edge.
- Mixed Arabic and digits ("0% من نطاق العرض") read in order.
- Nothing overlaps or is clipped in any capture.
- The status row puts the sentence on the reader's side and the pill at the other end.

**The other worlds.**
- The Shared and Public screens pass no `details` and are unchanged by this addendum. Their Before and After captures, in Arabic and English, are pixel-identical below the status bar (0.00 %).
- The Arabic Public capture was taken again once, because the first run's flow stayed on the Conversation; that miss is kept as `ar-public-flowmiss`.
- Replay is untouched.

**Pan (presented fps, SurfaceFlinger, same session, three rounds of six pans).** Before = `da608237`; Bound = Part A's layer bound alone; After = this UI on top.

| World | Before | Bound | After |
|---|---|---|---|
| Personal | 3.6 | 4.4 | 4.0 |
| Shared | 4.1 | 17.1 | 9.8 |
| Public | 5.4 | 16.6 | 18.5 |

- The UI adds no paint to the map. Its only cost is a few compact `View`s.
- Shared varies from run to run: one earlier run of the same UI gave 15.0.
- **Pan performance remains NOT MET in Personal.** Its cause is the tone per draw (§9), and the fix awaits the PO.

**Evidence:** `device/ui/{before,after4}` (captures and dumps), `boards/…` and `device/ui/board-*.png`, and `device/three-worlds/phone/pan/{beforeb,p1b,ui4}`.

**Part B checks (on the final tree of this change).**
- **Contracts, all pass:**
  - S7-03 31, S7-04 63, SHARED-VIS-01 8;
  - VPORT-02 9, VPORT-01 12;
  - temporal navigation 29, T-11 responsive 27, inspection orientation 26;
  - S5-03B 13, S7-02 19, map runtime 15;
  - task-closure governance 24.
- **Mobile Jest:** 3480 / 3486. The 6 failures (`depth`, `w2-account-access`) are the locale baseline that fails on `main` too.
- **Types and lint:** `tsc` is clean, and `eslint` on the changed files is clean.
- **Not run locally:** `forward-safety` runs in CI only (it hangs locally).

**Tested only in Jest goldens, not on the phone:**
- large text (`large-text-200`, `ar-large-text-200`);
- short landscape;
- increased contrast.

The phone's font scale, contrast and motion settings were not changed for this addendum: that needs the PO's permission for this run. A narrow phone and the keyboard over the exact-entry field are **NOT PROVEN** on a device.

### Part B: PO review corrections — Timeline, RTL / LTR, compact acts, WorldTone and CI (2026-11-11)
**The PO's review** ("MAP-CLOSE-01 / V-3 PO Review — Timeline, RTL/LTR, Premium UI, WorldTone Performance & CI Corrections"):
- the Timeline matches P2 C "Parting" (board 07, the spine and aperture proof, the closure's §7) without being rebuilt, and its frozen temporal geometry is unchanged;
- Arabic starts on the right and English on the left, for the Timeline and for every line and container;
- the return acts sit side by side when there is room, with ≥ 44-point targets and a fallback for large text or a narrow screen;
- map space is measured at rest and after a pan;
- pan smoothness is reported as frame pacing, not as an average;
- a WorldTone candidate C must restore A's luminance, glow, local contrast, colour and fine threads;
- CI #391 is treated as infrastructure, and #392 gets the narrowest fix.

The PO then chose the Live words' placement: "Line above the Track". Arabic sits on the right and English on the left. The PO's conditions: no unnecessary height, no duplicated words, the line kept functionally tied to the Live Edge, no Moment covered, the amendment to G3 §2.5 recorded, and the result tested on the phone before it is accepted.

**Skills.** None of the named skills is installed in this session (`designing-arabic-frontends`, `apple-design`, `animate-expo`, `fixing-accessibility`), and none was installed. A listing of the available skills returned none of them. The rules applied are P2's own and the app's own (`readerSide`, the 44-point floor, the Analysis tokens).

**The Timeline (P2 C).**
- **Cause of the "wrong start".** The app never enables a right-to-left layout (`I18nManager.isRTL` is false), and T-05 / T-06 mirror only through it. So the Arabic Timeline ran from the left, and the Live end stood on the right. P2 K20: SP1 stands at the START edge, which is the right for an Arabic reader, and the Live terminal at the END.
- **The fix (T-06's one mirror rule, applied as layout).** For an Arabic reader on a layout that never runs right to left, `TimelinePresentation` reflects its instrument (Track, strip, rail) as layout, and each numeral reflects back. Every coordinate stays logical, and touch follows the transform. The step (48 pt), key, window, offset, position scale, the 44-point band, the 1:1 aperture motion, the Reduced Motion rules, and F-P2-01 / F-P2-02 are unchanged.
- **The cut end.** The instrument now keeps 16 points from each screen edge, so the spine's start reads as a start rather than a crop. The T-05 discontinuity mark (three points at the end edge) remains the extension indicator when the newest Moment is outside the window (spec §2).
- **The Live words: CONTROLLED AMENDMENT to G3 §2.5 (PO choice, 2026-11-11).** The Live words leave the outboard slot at the Track's end, where they took about half the width (550 px). They now stand on one line above the Track, on the reader's side.
  - The line IS the Live Edge target. The same `LiveEdgeTarget` element keeps its label, its act (Return Live / FOLLOW_LIVE), its 44-point height and its words. Only its container changed.
  - The outboard slot keeps its frozen width (T-12) for the Live terminal, and is silent to touch and to a screen reader.
  - The line never covers a Moment. On the phone it is 1603–1746 px, and the Moments start at 1746.
  - Its cost is exactly the 44-point target floor (143 px). In return, the window shows 5.4 Moments instead of 4.
- **Duplicated words.** During a temporary look, the navigator's summary repeated what the Live words and the temporal line already said. With the details hidden, it is now always the one-point clipped line, as P2 board 07 state 4 shows one preview sentence. Its label, value and named acts stay for a screen reader.

**The return acts.**
- T-11's PAIRED arrangement needs a 232-point cell, which the phone only reaches in short landscape.
- A new label-only arrangement (`labelArrangement`, `PAIRED_LABEL_CELL_POINTS = 152 × fontScale`) pairs the acts when their labels fit. It is used only while the details are hidden; with the details, the full T-11 arrangement applies.
- On the phone (369 pt) the acts pair, in two equal halves of 535 px (ui7). At font scale 1.15 they stack, and so do they on a 320-point screen (plan tests).
- The label-only acts stand in explicit lines of two, in the frozen order, and each grows from a zero basis. There is no percentage and no width read. A percentage basis fell back to each label's own width on the phone, run to run, giving 445 / 625 px.
- The composite act (`GO_LIVE_AND_LOCATE`) always shows its conditional promise, so it takes a line of its own.
- An Arabic line is reflected as layout and each act reflects back: the first act stands on the right. There is no `row-reverse`, the order is unchanged, and so are the acts, their words and their availability.

**Controlled amendments (named).**

| Contract | Amendment |
|---|---|
| G3 §2.5 (Live words in the outboard slot) | the Live words on a line above the Track, on the reader's side (PO choice); the outboard slot keeps its frozen width for the terminal |
| T-05 / T-06 mirror | the instrument is reflected as layout for an Arabic reader when the platform layout is not right to left; T-05's `TimelinePresentation` blob re-pinned (previous 0922b31f), with the named re-anchor in the temporal-navigation contract |
| T-11 | `labelArrangement` beside `arrangement`; PAIRED's own 232-point rule is unchanged |
| S7-03 / S7-04 criterion 12 | `LivingAnalysisMap` re-pinned ("PO REVIEW RE-ANCHOR", previous 8185f212) |
| Screen golden | re-recorded three times (R1, R2, R3). In all 15 cases, every text, testID, label and hint is identical. The only new element is `timeline-instrument` (R1) and a silent line wrapper where acts pair (R3) |

**On the PO's phone (validation only; HONOR, 1200 × 2652, density 3.25; the proof package only).**
APKs:
- ui5 = `27b22a45`;
- ui6 = `73cdf099` (R2);
- ui7 = `75731146` (R3).

Function is proven in both languages by `ui-proof7.sh` on ui6 and ui7. Every step asserts the state's own words in the dump:

| Step | Arabic | English |
|---|---|---|
| FOLLOW_LIVE | «متابعة المحادثة مفعّلة الآن» above the Track, right; SP1 at the right edge, the terminal ENGAGED at the left | the same, left; SP1 at the left edge, the terminal at the right |
| held scrub (finger down) | «نظرة مؤقتة على اللحظة 3، ولم يتغير موضعك.», the lighter parting with the 12-point notch, «الانتقال إلى اللحظة 3»; no duplicated line | "A temporary look at moment 3. Your position has not changed." |
| release | PINNED at 3: «أنت عند اللحظة 3…», the committed parting with its mark, the terminal AVAILABLE, «العودة لمتابعة المحادثة» above the Track | "Reading at moment 3…", "Rejoin the conversation" |
| Preview (navigator, next Moment) | «نظرة مؤقتة على اللحظة 4…», «الانتقال إلى اللحظة 4», «إلغاء النظرة المؤقتة» | "A temporary look at moment 4…", "Go to moment 4", "Cancel the temporary look" |
| Cancel | back to «أنت عند اللحظة 3» (nothing committed) | "Reading at moment 3" |
| Preview → Commit | «أنت عند اللحظة 4…» | "Reading at moment 4…" |
| Return Live (the line above the Track) | «متابعة المحادثة مفعّلة الآن» | "Following the conversation" |

**Space (map frame, px; px / 3.25 = pt).**

| Personal Analysis | Before (`da608237`) | ui4 (addendum) | ui7 (PO review) |
|---|---|---|---|
| At rest, FOLLOW_LIVE | 1469 | 1843 | 1700 (+231 px, +16 % on Before) |
| After a pan (two acts) | 1469 | 1492 | 1518 Arabic; 1469 English, where «Return to the whole world» wraps in its half and the band reaches its cap |
| PINNED (T-08 line, Live words, two acts) | — | — | 1469 (the band at its cap; the rest scrolls) |

The Live line costs 143 px at rest against ui4. That is the 44-point floor of the Live target, and nothing else: the line sits directly on the instrument. In return, the Track has the whole width (5.4 Moments visible, against 4).

**The other worlds.** Shared and Public, Arabic and English, are pixel-identical to ui4 below the status bar (0.00 %) in ui5, ui6 and ui7. Replay is untouched.

**WorldTone: A / B / C (and D, E), measured, NOT adopted.**
- **Method.** A measurement build only (never committed): a deep link switches the tone. Stills are taken in the SAME state (no pan before them; a repeat A is identical), on the map's crop.
- **Candidates:**
  - A = current (the curve per draw);
  - B = the curve once over the composite;
  - C = one composite pass with a fitted 3 × 3 matrix plus per-channel quadratic and cubic terms (15 coefficients; the residual of the fit is 1.2–1.7 levels);
  - D = the canonical curve as a COLOUR filter per draw: `lerp(0.6, identity, sRGB→linear)`. The built-in filters approximate `0.54c + 0.46c²` within 1.74 levels;
  - E = the same colour filter once over the composite.

| Personal, at rest | A | B | C | D | E |
|---|---|---|---|---|---|
| mean luma | 0.2092 | 0.1503 | 0.2095 | 0.2092 | 0.1559 |
| mean |Δ| from A (levels / 255) | 0 | 15.39 | 2.09 | 1.29 | 14.03 |
| local contrast σ | 0.0130 | 0.0076 | 0.0082 | 0.0131 | 0.0106 |
| colourfulness | 35.4 | 31.9 | 35.2 | 37.8 | 31.5 |
| fine-thread energy | 0.0543 | 0.0288 | 0.0315 | 0.0545 | 0.0441 |
| glow ≥ 0.6 | 0.27 % | 0.36 % | 0.35 % | 0.58 % | 0.37 % |

- **C restores luminance and colour but not the fine threads or local contrast** (−37 %, −42 %). A pixel curve cannot restore them: the composite layer is rasterized at a lower resolution than the screen (B and C are visibly soft in the zoom). This is also most of why B and C are fast. C therefore fails the PO's criterion.
- **D keeps A's look** (threads, contrast and luma). Its colourfulness is +7 %, and its glow covers 0.58 % against 0.27 %: transparent glows are toned by alpha rather than alpha² (the premultiplied difference recorded in §9).

**Pan pacing (presented frames while dragging; three rounds, each a continuous 1.5-s drag there and back; SurfaceFlinger).**

| World | A fps (p50 / p99 ms; > 33 ms) | B | C | D | E |
|---|---|---|---|---|---|
| Personal | 5.3–6.1 (117 / 733; 78–80 %) | 28.9 (33 / 117; 8 %) | 29.4 (33 / 117; 9 %) | 15.1–15.6 (50 / 200–250; 79–85 %) | 17.1 |
| Shared | 4.5 (233 / 782; 77–87 %) | 31.2 (33 / 83; 10 %) | 30.5 (33 / 100; 12 %) | 15.6–15.9 (50 / 200–216; 84–85 %) | 17.1 |
| Public | 15.1–26.1 (noisy) | 29.3 | 30.1 | 25.7–26.1 (33 / 133–167; 12–19 %) | 26.2 |

- **Reading.** No candidate both keeps A's picture and reaches 30 fps:
  - D removes the tone's whole cost (Personal ×2.7, Shared ×3.5) but stays near 15 fps. The rest of the cost is the full-resolution map itself.
  - B and C reach ~30 fps only by drawing the world at a lower resolution.
- **Pan performance therefore remains NOT MET.** D is the candidate that changes the picture least, and it is presented for the PO's decision, not adopted. Production S3-R2 is unchanged.
- **Live calls.** Live calls keep absolute priority through the S8B-06 banding, which is unchanged. Pan during a live call was not measured on the phone.
- **Zoom / semantic zoom per world.** This was not re-measured in this review. Zoom levels and FAR / MID / NEAR / ANALYTICAL are unchanged by it.

**CI.**
- **#391:** the iOS boot smoke failed in CoreSimulator's data migration before the app was installed. That is infrastructure, so only that job was re-run, and it passed. The head is fully green.
- **#392:** the forward-safety tests 5, 15 and 24 ("mutation matched nothing"). Their three chrome mutations anchored on the exact `react-native` import text, which Part B changed. They now anchor on the import's shape (`RN_IMPORT`), and each mutation is unchanged. Test 24 still refuses a chrome that reads the display.

**Copy Gate:** still 4 PROPOSED, not approved (عرض التفاصيل / إخفاء التفاصيل / Show details / Hide details).

**Accessibility settings on the phone: NOT PROVEN.**
- The PO's permission to change the phone's font scale, contrast, motion or display size was asked for and not given. Those settings were not touched.
- Large text, increased contrast and short landscape are covered by the screen golden and the plan tests only.
- No TalkBack / VoiceOver work (PO decision, 2026-11-08).

**Checks (on `75731146`).**
- **Contracts, all pass:**
  - S7-03 31, S7-04 63, SHARED-VIS-01 8;
  - VPORT-02 9, VPORT-01 12;
  - temporal navigation 29, T-11 27, T-12 32, T-12P 23, T-10 31;
  - inspection orientation 26, S7-02 19, S5-03B viewer 13, map runtime 15;
  - task-closure governance 24.
- **Mobile Jest:** 3481 / 3487. The 6 failures (`depth`, `w2-account-access`) are the locale baseline that fails on `main` too.
- **Types and lint:** `tsc` and `eslint` are clean.

**Evidence (reports folder, outside the repository):**
- `device/ui/after5`, `after6`, `after7b` and `after7c`, with `board-ui6-*-timeline.png`;
- `perf/tone5` and `perf/tone6` (stills, `board-ABCD.png`, latency dumps);
- the scripts `ui-proof7.sh`, `grip.cjs`, `tone-bench.sh`, `pacing-summary.mjs`, `tone-metrics.mjs` and `fit-tone.mjs`.

**Deferred by the PO (2026-11-11), not started.** "PO UX Correction — Unified Timeline, Navigation Simplicity & Screen Space" (a full-range timeline, no percentage line, no separate rail). It comes after this performance slice, and first as one report with one visual concept and the controlled amendments it needs.

## 12. Backlog
_(reconciled at V-3's closure.)_
