# COSMOS Production Integration Contract — v1.0 (Slice A deliverable)

**Task:** COSMOS V5 Production Integration & Living Analysis Map Replacement (PO authorisation of 2026-11-15).
**Status:** `SLICE A — INTEGRATION INVENTORY AND CONTRACT — DELIVERED FOR PO REVIEW — NOTHING IMPLEMENTED IN THE PRODUCT — NO MERGE`.
**Author:** integration engineering (Claude), 2026-11-15.
**Branch / worktree for the project:** `cosmos/cosmos-production-integration` at `E:\cosmosint`, created from `origin/main` `5a21971d` (the base is itself decision D-1 below; nothing is committed on it yet). `E:\cosmosv5` (the proof, uncommitted), `E:\QANDEEL_APP` (branch `s8a/s8a-04-cp3`, only the register changed) and every `E:\map*` worktree are untouched.

This document is the first deliverable the authorisation asks for: the audit, the preservation matrix, the migration plan, the detail-sheet and timeline mappings, the risk map, the slices, and the explicit gaps. It authorises nothing by itself; Slice B starts only on the PO's answers to §10.

---

## 0. How this contract was produced, and what it binds

Audited, read-only: `origin/main` (`5a21971d`, checked out at `E:\cosmosint`), the COSMOS worktree `E:\cosmosv5` (HEAD `d5c45571` plus its uncommitted pinch-focus correction), the production-map PR chain #391 / #392 / #393 (their branches, diffs and merge-tree against the COSMOS branch), and the governance locators (`QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, the canonical backlog and the records they point to). Every file named below was opened; every count is from `git` or `grep` on 2026-11-15.

What binds: the PO's frozen decisions (§1), the existing canonical contracts the matrix cites (T-04 … T-13, VPORT-01/02, S4, S5-03B/03C/04, S8A-05, SHARED-VIS-01, S7-03/04, S8B-06 CP3, MAP-PERF-01's CA-Z1 / CA-O1 / CA-O2), the Future Improvements register item 021 (memory, accepted V1 risk), and QAN-INF-03 for dependencies. Nothing here redefines a product contract; where a requirement needs one, it is listed in §10 as a gap, not implemented.

Vocabulary used throughout:
- **old renderer** = `MapSurface` / `WorldViewSurface` / `WorldCanvas` and `map/visual/*` (Skia pictures of marks, strata, masses), with the field views `SharedFieldView` / `PublicFieldView` over it;
- **the ONE surface** = `LivingAnalysisSurface` (S5-03B R1): the screen every world is analysed in (top band, measured world frame, support band = timeline row + chrome band);
- **COSMOS** = `apps/mobile/src/cosmos/{core,skia,assets}` (the stage compiler, the Skia host `CosmosCanvas`, the baked plates and light atlas) — the accepted renderer;
- **owner** = the proof's seam (`__validation__/owners.ts`) between fingers and one world's production authority; this contract productionises it;
- **authority** = the canonical store and executors (Personal) or the field controllers (Shared / Public); it alone decides what a pan, a step, a tap or Back does.

---

## 1. Decisions already frozen by the PO (restated, not reopened)

1. COSMOS is the selected Living Analysis Map direction; alternative map designs are closed. The cosmic world, nebula materials, lights, colours, motion and the corrected two-finger focal behaviour are preserved as accepted on the HONOR.
2. Preserved in appearance and intended behaviour: the nearest-topic indicator with its direct navigation act; the right-side semantic zoom-level rail; the top Overview control; the top Back control (meaningful one-step backward navigation); the segmented / dashed bottom timeline rail, whose look is final and whose function must connect to the existing authorised temporal system where it exists.
3. Removed from the production surface: FPS / performance instrumentation, FULL / overdraw labels, synthetic-fixture notices, measurement controls, fault modes, the standalone language toggle. Language follows the app's locale and RTL / LTR system.
4. Replace the old map presentation, not the product: Personal / Shared / Public authority, data, navigation, services, consent, privacy, publication and disclosure boundaries stay. No fixture state in production, no fabricated names / relations / sessions / media, no N4 naming.
5. New functional requirement: the compact-peek → full-screen → return detail sheet over the live canvas, per world, reusing existing content, discussion and session components and their authorisation.
6. Memory retention = register item 021, accepted V1 risk, not reopened. RN Skia 2.7.0's Expo exclusion must pass QAN-INF-03 before production integration.
7. Controlled, reviewable slices; no merge to `main` and no production adoption before integration validation and PO review; the existing map PRs are neither merged nor superseded blindly.

---

## 2. Audit findings that shape the integration

### 2.1 Where COSMOS actually sits in history

| Ref | Head | Relation |
|---|---|---|
| `origin/main` | `5a21971d` | MAP-CLOSE-01 Step 2 merged (PR #390). The old renderer is in force. |
| PR #391 `map/map-close-01-v3-production-port` → main | 8 commits, 28 files | S3-R2 paint on the old renderer: `WorldContinuity.tsx`, `WorldMarks`, `WorldStrata` layer clip (pan perf), per-mark chroma; goldens re-recorded. |
| PR #392 `map/map-close-01-v3-screen-ui` → #391 | 18 commits (5 merges), 44 files | "one continuous world" screen: `WorldContinuationContext` (the canvas paints under the bands), `continuousWorld` prop on the ONE surface, transparent `AnalysisReturnBar` / Replay bar, the Premium Compact `details` toggle in the chrome, Arabic Timeline mirrored, Live words above the Track. |
| PR #393 `map/map-perf-01-production` → #392 | 10 commits, 58 files | Candidate F (per-draw tone, prepared rasters), **CA-Z1** (a pinch step keeps the world point under the fingers: new `focal` argument on `zoomSemanticStep` and on the Shared / Public `step()`), CA-O1 steady envelope, CA-O2 chrome anchor, Treatment A, zoom-rung prefetch; the last commit `630ee0fd` = strata sprite atlas. |
| COSMOS `experiment/living-world-cosmic-v5` | `d5c45571` | **Based on `a06181b0` = PR #393 minus `630ee0fd`.** `origin/main..cosmos` = 41 commits: 8 (#391) + 18 (#392) + 9 (#393) + 6 COSMOS. The 6 COSMOS commits add 42 files (+5594 / −0), all under `apps/mobile/src/cosmos/`, `apps/mobile/experiments/cosmos-*`, one script and four experiment records; they modify no production file. |

**Hard dependency.** `owners.ts` calls `zoomSemanticStep(store, direction, { envelope, point })` and `controller.step(direction, focal)` on both field controllers. Those signatures exist only after `9edb41fd` (CA-Z1, in #393). Everything else COSMOS imports (26 files) exists on `main` unchanged. COSMOS imports nothing from the old renderer, `WorldContinuity`, the ONE surface, `responsive` or `timeline`: its tie to #391 / #392 is ancestry, not code.

`git merge-tree --write-tree cosmos map/map-perf-01-production` is conflict-free; the only delta is `630ee0fd` (4 files, none touched by COSMOS). The COSMOS branch fast-forwards from `main`.

### 2.2 The uncommitted proof state (not part of the product)

`E:\cosmosv5` working tree: `package.json` / `package-lock.json` (RN Skia 2.6.2 → 2.7.0 + `expo.install.exclude`, the approved experiment, worktree-only), `CosmosCanvas.tsx` (+24 / −6: two-finger focal tracking, pan suppressed while pinching, the `numberOfPointers < 2` Android-lift guard, gesture test ids), `CosmosProofRoot.tsx` (fix A deep-link loop, `gc` / `gcauto` measurement links, pinch-end commits the pan at the rung scale about the fingers before asking for a step), `measure.ts` (measurement only), and three untracked tests (`pinch-focus`, `proof-root-pinch`, `proof-root-deep-link`). Verified: pinch tests 12 / 12, cosmos suite 59 / 59, `tsc` and `eslint` clean, HONOR before / after proof (report `COSMOS_V5_PINCH_FOCUS_AND_REGISTER_REPORT.md`). The APK on the phone is `cosmosproof-fixA-skia270-pinch2.apk` (`16ffeb56…`).

The pinch correction must travel into the product as three rules with its two test files (§3.5). The deep-link fix and the `gc` links are proof-only.

### 2.3 What the product composes today (the integration ownership points)

- **No routes.** `app/index.tsx` renders `ProductRoot`; `app/_layout.tsx` is a bare Stack. Worlds, depth, Thread, Reading and time are canonical state, never pages.
- **`ProductRoot` → `DepthComposition`** (929 lines): the ONE depth pair of the reader's own world, `CONVERSATION ↔ ANALYSIS` (a local cross-fade, no canonical write), the area switcher `MY_WORLD | SHARED_WORLD | PUBLIC_WORLD` (`GlobalSwitcher`, CONVERSATION depth only), and the overlays (Settings, Understanding, Activity, Introductions, Proposals, Replay passage, attention strips, the call-safe strip).
- **Personal map** = `LivingAnalysisMap` (260 lines) at the ANALYSIS depth: it owns the two subscriptions (store, projection revision), issues `projection.ensure` for the viewpoint and the Timeline track rung, derives `mapInspectionContext` and `chromeProjection`, hands T-07's journey / spatial cause the outcomes, and composes the ONE surface with `world = MapSurface`, `timeline = { TemporalOrientationLine, TemporalTargetLayer }`, `chrome = OrientationChrome` (`temporalLine="WITH_TIMELINE"`, `returnLiveHome="LIVE_EDGE"`). Its top band is `AnalysisReturnBar` (the way back to the Conversation, `ReplayAnalysisEntry` at its end). During a live call the Analysis also carries the call-line box (`qandeel-analysis-call-box`, `CallLine`), and **a call reaching CONNECTING crosses the reader to the Analysis automatically** (`DepthComposition` 647–653): the Personal map is the active-call surface.
- **Shared** = `SharedWorldArea` (over the still-mounted Personal world, CONVERSATION depth): `place.kind` ROOT / WORLD / MANAGE / CLOSED; at WORLD after the entry verdict ALLOW and `worldView === 'MAP'` it renders `SharedLivingAnalysis` over `controller.field` (a `SharedFieldController`), with `onBack → toRoot`, `onConversation → openConversation` (a full-area screen: `SharedThread` + `SharedSendBar`, text only, own-material delete), `onManage → openManage`. Permissions, proposals, invitations and the introduction world surface live in the same area. `timeline = null` (CHROME_ONLY); the chrome band shows the focused place's panel (meaning, themes, exact sources) or the empty / unavailable state.
- **Public** = `PublicWorldArea` after `GET /public/entry` ALLOW: `PublicLivingAnalysis` over `controller.field` (a `PublicFieldController`); top band = heading + search + section control + search scope; `timeline = null`; the chrome band shows ONE thing at a time: the section list, the focused Experience's panel (title, section, publisher, date, the Discussion entry with its human count, themes, `PublicTopicContent` pages, nearby), `PublicDiscussion` over the panel, the search results, or the field's state. Local Back order: sections → panel → search → chosen section.
- **Replay** = `ReplayMomentComposite` (S7-03) is the **fourth consumer of the ONE surface and of `MapSurface`**: the Personal map AT A MOMENT, under the Replay passage. Any renderer replacement must say what Replay paints (§10, G-5).
- **Old-renderer consumers outside the four surfaces:** none paint; the rest (`orientation-chrome/*`, `return-navigation/*`, `temporal-navigation/*`, `recovery/schema`, `replay-composite/*`, `projection-coordinator`) import only the `map` module's models, camera maths and actions, which COSMOS keeps.
- **Tests pinning the old renderer / surface:** 15 root contract tests under `tests/*.mjs` (`living-analysis-map-runtime`, `vport-01`, `vport-02`, `t10-motion`, `t11-responsive`, `t12-product-activation`, `t12p-mobile-runtime-entry`, `shared-vis-01`, `s5-03b`, `s5-03c`, `s7-01..04`, `intel-04`), two goldens (`living-analysis-screen.golden.json`, `personal-map.golden.json`), the mobile suites under `map/__tests__` (21), `integration/__tests__` (composition, depth, screen golden, continuity), `shared-world/field/__tests__`, `public-world/field/__tests__`, `replay-composite/__tests__`.
- **Dependencies:** RN Skia **2.6.2** (also used by `iconography/*` and `conversation/visual/Glyph.tsx`), Reanimated 4.5.1, worklets 0.10.1, RNGH 2.32, expo-router 57, safe-area-context 5.7. **No bottom-sheet library and no shared sheet primitive** (two hand-rolled ones: `PermissionEducationSheet`, the introductions sharing sheet).
- **Language / direction:** `ProductLocale { language, direction, region, numbering }` from `deviceProductLocale()`; direction from `I18nManager.isRTL`; copy per module (`*-copy.ts`), Arabic the generated-language default (LANG-01); new strings go through the Copy Gate.
- **Accessibility scope:** the PO's 2026-11-08 decision stands (no further TalkBack / VoiceOver proofs; historical proofs = NOT PROVEN). Accessible routes are still kept as code and headless tests.

### 2.4 What COSMOS already does over production authority (proof, headless-tested)

The proof is **not** a standalone renderer over fixtures: its owners already drive the production controllers (`createPublicFieldController`, `createSharedFieldController`) and the production integration runtime (`createIntegrationRuntime` → store, projection cache, T-04 executors, T-07 `backOneStep`, temporal `commitMoment` / `commitLiveEdge`), with only the TRANSPORTS faked (`fixture-transports.ts` over the S5-03B, SHARED-VIS-01 and VPORT-01 fixtures). The production acts it dispatches are exactly the product's: `panByTranslation`, `zoomSemanticStep` (with the CA-Z1 focal), `inspectObject`, `backOneStep`, `commitMoment`, `commitLiveEdge`; `controller.pan / step / tapField / focus / back / revalidate`. The stage is compiled from production read models by `core/adapters.ts` (`personalScene` from `MapScene`, `publicScene` from `PublicFieldEntry[]` + the served panel, `sharedScene` from `SharedFieldEntry[]`). The Personal world draws no name (N4 not authorised; label = family word only); hue is identity only; no ranking, no free relations, no synthetic sections (Visual Gate R2 decisions).

Two recorded departures the PO has since accepted on the device: optical magnification under the fingers during the pinch (the canonical act is still one step at release), and the presentation-only Overview (dispatches nothing canonical).

---

## 3. Integration architecture

### 3.1 The principle

> COSMOS becomes the **world view and the chrome** of the ONE Living Analysis surface. The **owners stay the owners.**

Concretely: every place that today renders the old renderer inside the ONE surface renders a `CosmosWorldView` instead, driven by a production owner over the world's EXISTING authority; the three worlds' chrome (Back, Overview, rail, nearest indicator, timeline rail, sheet) is COSMOS's accepted chrome fed by the product's EXISTING models (T-08 orientation model, T-05 / T-06 temporal controllers, the field controllers' state). No new store, no second projection cache, no second camera truth, no second temporal source: the canonical camera is still the only committed camera, and COSMOS's presentation camera settles to it after every act exactly as the proof does.

### 3.2 Module layout (target)

```
apps/mobile/src/cosmos/
  core/        stage, camera, absence, atmosphere, adapters      KEEP (as is)
  skia/        CosmosCanvas, parts, prepare, worklets             KEEP, minus the probe / overdraw instrumentation (§5)
  assets/      plates + light atlas (0.6 MB)                      KEEP
  product/     NEW — the production seam (no fixture, no fault, no measurement):
    owners/    personal-owner.ts  (over an IntegrationSessionRuntime handed in; never creates a runtime)
               shared-owner.ts    (over the area's SharedFieldController; never opens/forgets a World itself)
               public-owner.ts    (over the area's PublicFieldController; entry verdict stays the area's)
               owner.ts           (the CosmosWorldOwner interface and the shared field-owner seam, lifted from the proof)
    CosmosWorldView.tsx            the canvas + gesture wiring + settle (lifted from CosmosProofRoot, without proof state)
    chrome/    CosmosBack.tsx, CosmosOverview.tsx, CosmosRail.tsx (zoom levels), CosmosNearest.tsx (absence + bearing),
               CosmosTimelineRail.tsx (Personal; the accepted ticks over the T-05/T-06 contract, §7)
    sheet/     CosmosDetailSheet.tsx (peek / expanded / closed; RNGH + Reanimated; no library)   §6
    copy.ts    product copy for the COSMOS words (Copy Gate rows), replacing __validation__/copy.ts
  __validation__/  the proof root, fixture transports, measure, proof copy   KEEP as validation only (never bundled by the product entry)
```

The production entry is unchanged (`"main": "expo-router/entry"`); the proof entry stays behind `select-cosmos-proof-entry.mjs` for device proofs.

### 3.3 Per-world wiring

| | Personal | Shared | Public |
|---|---|---|---|
| Host today | `LivingAnalysisMap` (ANALYSIS depth) | `SharedLivingAnalysis` (area, WORLD + ALLOW + MAP) | `PublicLivingAnalysis` (area, after entry ALLOW) |
| Authority the owner wraps | `runtime` = `IntegrationSessionRuntime` already held by `LivingAnalysisMap` (store, projection, bundle, returnSurface, presentation, preview, journey, spatialCause, witness) | `controller.field` (`SharedFieldController`) opened by `SharedWorldArea`; `isCurrent` from the area | `controller.field` (`PublicFieldController`); entry verdict by `PublicWorldController` |
| What the proof owner did that production must NOT | `createIntegrationRuntime` with inert ports, its own `ensureAll` | `forget` + `open(SHARED_FIXTURE_WORLD_ID)`, simulated denial | simulated entry refusal, `isCurrent: () => true` |
| Scene source | `mapInspectionContext(bundle.projection.lookup(sessionId, tc, depth))` per held rung (5 rungs), `personalScene` | `state.entries`, `focus.panel.place.sources.length`, `sharedScene` | `state.entries`, panel relations / content count / section, `publicScene` |
| Camera truth | `currentCamera(store)` → `cosmosCameraOf` | `state.camera` (FAR / MID / NEAR) | `state.camera` |
| Pan | `panByTranslation(store, tx, ty)` — one `PAN` per completed drag | `controller.pan(tx, ty)` | `controller.pan(tx, ty)` |
| Step | `zoomSemanticStep(store, dir, { envelope, point })` (CA-Z1 focal) | `controller.step(dir, focal)` | `controller.step(dir, focal)` |
| Tap on a node | `inspectObject(store, context, ref)` (writes `IF_ref`, no camera) | `controller.focus(id)` | `controller.focus(id)` |
| Tap on the field at FAR | — (no field tap in Personal) | `controller.tapField(p)` (discloses MID) | `controller.tapField(p)` |
| Back | `backOneStep(returnSurface)` (T-07) | `controller.back()` then `step('OUT')` | `controller.back()` (its local order) then `step('OUT')` |
| Nearest | one `panByTranslation` toward the nearest SERVED point | one `controller.pan` | one `controller.pan` |
| Time | `commitMoment` / `commitLiveEdge` + the T-05 / T-06 / T-08 temporal models (§7) | none (D5) | none |
| Detail (sheet) | InspectionOrientation model + return acts; §6 | place panel + sources; §6 | Experience panel + topic content + discussion; §6 |

The owner interface of the proof (`getSnapshot / subscribe / setView / pan / step / tap / focus / back / goTo / labelOf / commitMoment? / goLive?`) is kept; `enter()` / `dispose()` become `attach(authority)` / `detach()` because the lifecycle belongs to the host (the depth pair, the area), not to COSMOS.

### 3.4 The screen: full-bleed stage inside the ONE surface

The accepted COSMOS look is a full-screen stage with the chrome laid over it (rail at the side, Back / Overview at the top, the timeline rail and the card at the bottom). The ONE surface today lays the world in a measured frame with a support band beneath (timeline row + chrome band; #392 lets the canvas continue under the bands). This contract keeps `LivingAnalysisSurface` as the screen owner and adds one capability instead of a second screen:

- `presentation: 'FRAMED' | 'STAGE'` — `STAGE` makes the world frame the whole surface below the top band, mounts no support band, and gives the world's chrome an overlay slot with the plan's insets (safe area, keyboard, the call box). `FRAMED` is byte-identical to today, so Replay (G-5) and the goldens of surfaces not yet migrated keep working during the slices.
- The top band stays the host's (Analysis return bar; Shared band; Public heading / search / sections) and stays transparent over the stage (#392's decision, already accepted visually in the proof's captures where the tabs float over the stage).
- The T-11 responsive plan still owns insets, font scale and the envelope; COSMOS reads the envelope it is given (the proof's `onViewSize`) and never measures the window itself.

### 3.5 The camera and gesture contract (unchanged, now written down for the product)

1. One canonical act per gesture, at its END: a completed drag is one pan; a completed pinch is at most one semantic step, decided by the ratio at release against the 1.125 threshold; a tap is one inspection / focus; a cancelled or insufficient gesture writes nothing (T-12's single-crossing discipline, kept by `finish()`).
2. The three pinch rules proven on the HONOR travel with their tests (`pinch-focus.test.tsx`, `proof-root-pinch.test.tsx`): the pinch tracks its own two-finger focal and ignores a one-finger update (the Android lift); the pan is ignored while two fingers pinch; the release commits the pan at the rung scale about the fingers, then asks the authority for the step with that focal, then settles keeping the anchor when the step applied about the fingers and otherwise to the canonical camera.
3. The authority decides: a refused step (floor / ceiling, `AT_RUNG_BOUNDARY`, a field `AT_BOUNDARY`) eases the presentation back to the rung about the fingers; the product never fakes a step.
4. The presentation camera settles to the canonical camera after every act (`settleTo`, 320 ms, 0 under Reduce Motion); the canonical camera is the only one persisted (T-13 recovery record) or read by any other owner.
5. Optical magnification during the pinch and the presentation-only Overview are the accepted departures; the Overview writes nothing, disables entity taps, and leaves on any tap, gesture end or Back.

### 3.6 Language, direction, copy, appearance

- `language` and `direction` come from the host's `ProductLocale` (as every surface today); the proof's language state, toggle and `lang/` links are removed. A language change must not re-create the owner (the proof keyed owners by language; the product owner takes `language` as an input for labels only).
- `rtl` for the canvas and the chrome follows `direction === 'RTL'`.
- COSMOS words that reach the reader (rung names WORLD / THREAD / SESSION / OBJECT / SOURCE and FAR / MID / NEAR, the five absence sentences, "Go to the nearest", Retry, Overview, Back, Live / position / "not yet placed", the card words, zoom-in / zoom-out labels) are new product copy: Arabic and English rows in a Copy Gate table (PROPOSED until approved). Where a production word already exists (T-08 `product-copy.ts` family / rung words, `analysisCopy` moreDetail / lessDetail, the field copies), the existing word is reused and no row is added.
- The Analysis place is dark under every appearance (`AnalysisAppearanceScope`); COSMOS's void `#05060f` is its ground. Increased-contrast behaviour (the #392 switch-off of the continuous world) is listed as decision D-4.

### 3.7 The live-call path

The Personal map is where a connecting call puts the reader, and the call-line box sits under it. Rule for COSMOS in production: while `callLive`, the drift clock is off (`drift = false`, the same path Reduce Motion already takes), no probe or frame callback does work beyond the drift gate, label relayout runs only on settle (as now), and no decode or `prepareStage` is triggered by the call itself (the stage is prepared once per projection revision, not per frame). Slice E measures the call path on the HONOR (SurfaceFlinger per layer while a call is live) against S8B-06 CP3's record.

### 3.8 Memory and the Skia version

- Register item 021 covers the native retention; the product build ships with the memory links and the open / close cycle removed. No new investigation.
- The product stays on **RN Skia 2.6.2** (Expo 57's pin) for Slices B–D; the headless suites and the device proof of Slice B run on 2.6.2. 2.7.0 is a separate QAN-INF-03 item with the experiment report as its evidence; it is not a precondition of the integration. The `WorldMarks` R2 clip work-around for a 2.6.2 save / restore bug is old-renderer code and retires with it.

---

## 4. Old Map → COSMOS feature preservation matrix

Status codes: **WORKS** = COSMOS already performs it over the production authority (proof, headless-tested); **RECONNECT** = exists in the product and only needs wiring into the COSMOS host; **ADAPT** = exists and keeps its function, but its presentation moves into the accepted COSMOS chrome; **RETIRE** = old-renderer paint that the accepted COSMOS visuals supersede (no function lost); **ABSENT** = not in the product today and no backend for it; **BACKEND** = needs a server entitlement / contract (PO before implementation); **DEFER** = explicitly out of this task's scope. "Contract" says whether changing it would touch an approved contract (— = none).

### 4.1 Screen, composition and lifecycle

| # | Feature | Source of truth / implementation | Behaviour today | COSMOS equivalent / adapter | Status | Risk · validation | Contract |
|---|---|---|---|---|---|---|---|
| S1 | The ONE Living Analysis surface (top band, world frame, support band) | `LivingAnalysisSurface` + `responsive/*` (T-11) | One column; world in a measured frame; timeline row + chrome band beneath; CHROME_ONLY for worlds without time | Same owner, new `presentation: 'STAGE'` (§3.4): the world fills the surface, chrome overlays | ADAPT | T-11 responsive contract + screen golden; `t11-responsive`, `living-analysis-surface` tests re-anchored | T-11 (frozen): insets / font scale / one column unchanged; the support band's absence is a new capability, listed D-2 |
| S2 | Depth pair Conversation ↔ Analysis, cross-fade, Android Back at Analysis | `DepthComposition` (W1A-01, G3) | Local cross; Back returns to the Conversation; the Analysis reports `onComposed` for the fade | Unchanged host; `CosmosWorldView` reports its first stage frame as `onComposed` (the proof's `onFirstStageFrame`, kept for this one purpose) | RECONNECT | `depth`, `depth-band` tests; QAN-BL-MOB-05 "never before it is drawn" | — |
| S3 | Area switcher, Shared / Public areas over the mounted Personal world | `DepthComposition`, `GlobalSwitcher`, `SharedWorldArea`, `PublicWorldArea` | Areas are overlays at the CONVERSATION depth | Unchanged; the proof's PERSONAL / SHARED / PUBLIC tabs are NOT ported (they were the proof's navigation) | RECONNECT | The switcher band inset is already passed to the areas | — |
| S4 | Analysis top band (`AnalysisReturnBar`: Conversation, Replay entry, call suffix) | `conversation/AnalysisReturnBar.tsx` | Measured; its height is the world's top inset; transparent since #392 | Unchanged, over the stage | RECONNECT | band height → `CosmosWorldView` insets | — |
| S5 | Appearance: Analysis always dark; status bar decision per depth | `AnalysisAppearanceScope`, `AppearanceStatusBar` | Dark under every preference | Unchanged; COSMOS void is the ground | WORKS | increased-contrast behaviour: D-4 | P1 §12.2 |
| S6 | Live call: auto-cross to Analysis on CONNECTING, call-line box under the world, call-safe strip | `DepthComposition` 598–660, `CallLine` | The Analysis is the active-call surface | Unchanged host; COSMOS obeys §3.7 (drift off, no extra frame work while `callLive`); the call box height is a bottom inset of the stage | RECONNECT | **Slice E device measurement during a live call**; S8B-06 CP3 record | S8B-06 CP3 (call priority) |
| S7 | Recovery record (T-13) persists the canonical camera / viewpoint | `recovery/schema/recovery-record.ts` | After restart the reader lands in the Conversation; the canonical state is restored | Unchanged: COSMOS settles to the restored canonical camera on first READY (`jumpTo`) | WORKS | `recovery` tests | T-13 (frozen) |
| S8 | Replay passage: the Personal map AT A MOMENT under the player | `ReplayMomentComposite` → `MapSurface` | The composite draws T-04's map at the historical viewpoint | Not migrated in Slices B–D: keeps `FRAMED` + old renderer (two renderers coexist during the project) | DEFER → G-5 | Replay contract tests pin `MapSurface`; a later slice may port Replay to COSMOS | S7-03 / S7-04 |
| S9 | Introductions world surface | `IntroductionWorldSurface` | No map renderer involved | Not affected | — | — | — |

### 4.2 Personal world — projection, camera, inspection, chrome

| # | Feature | Source of truth / implementation | Behaviour today | COSMOS equivalent / adapter | Status | Risk · validation | Contract |
|---|---|---|---|---|---|---|---|
| P1 | Server-authoritative disclosure | `GET /conversation/sessions/:id/historical-projection?tc&depth`, ONE projection cache (`projection-coordinator`, `bundle.projection`) | `ensure(request)` per viewpoint; freshness rule empties the map on a stale tuple | The owner asks the SAME cache for the viewpoint and the other held rungs (the proof's `ensureAll`); the stage is rebuilt per projection revision | WORKS | prefetch of 5 rungs per viewpoint = more reads than today (today: viewpoint + track rung; #393 prefetches adjacent rungs). Validate request counts in `projection` tests; G-9 | T-04 (freshness), T-12 §1 (one cache) |
| P2 | Freshness / stale gap: nothing of an old projection painted, hit-tested or announced | `mapContextFreshness` in `MapSurface` | Structurally empty surface until the fresh `V` | The owner compiles only from `mapInspectionContext(...)` of the CURRENT request; a stale tuple yields LOADING (empty stage) | WORKS | `stale-projection` test ported to the owner | T-04 R1 |
| P3 | Five-rung lineage WORLD → THREAD → SESSION → ANALYTICAL_OBJECT → SOURCE_PROVENANCE, ×8 per rung | `state/classes.ts`, `camera/zoom.ts`, `zoomSemanticStep` | Pinch = one step at END; floor / ceiling refused | Same executor with the CA-Z1 focal; rail shows the five rungs | WORKS | `semantic-zoom*` tests; HONOR pinch proof already done | T-12 (semantic, never optical — optical magnification is the accepted departure) |
| P4 | Pan = one canonical `PAN` per completed drag | `panByTranslation`, `useMapPanGesture` (1 pointer) | — | Same executor; COSMOS pan allows 2 pointers only to coexist with the pinch; still one act at release | WORKS | `pan` tests | T-04 |
| P5 | Inspection of THREAD / READING / EMERGING_FOCUS by tap; `switch-context`; `direct-jump` | `inspectObject`, `switchContext`, `directJump` (`map/inspection`) | Tap writes `IF_ref`, no camera; the orientation chrome offers context switch / "go to place" | Tap → `inspectObject` (WORKS). `switchContext` / `directJump` are accessible-route and chrome acts today; they move into the sheet's peek actions (§6) | WORKS / ADAPT | `inspection`, `direct-jump` tests; EMERGING_FOCUS family must get a hit in the stage (adapters emit THREAD / READING only today) → G-6 | T-04 §inspection: "no silent selection" (the nearest indicator is a tap, never a selection) |
| P6 | Orientation chrome: inspection statement, lineage ("inside a thread, then a place"), context choice | `OrientationChrome`, `InspectionOrientation`, `orientationModel` (T-08) | In the chrome band | The SAME model renders inside the sheet's peek (title = family word, statement, lineage; actions = context choice, go to place, exact return) | ADAPT | T-08's words stay in `product-copy.ts` (R2-03); `orientation-chrome` tests keep the model; the band component retires for Personal | T-08: meaning unchanged; placement changes (D-3) |
| P7 | Six return acts: BACK_ONE_STEP, EXACT_RETURN, RETURN_LIVE_HEAD, RETURN_LIVE_FOCUS, RETURN_WORLD, GO_LIVE_AND_LOCATE | `return-navigation/return-actions.ts` (T-07), `ReturnControls` (T-08, context-sensitive) | Only the meaningful acts are rendered, in the chrome band | Mapping (D-3): BACK_ONE_STEP = top Back; RETURN_LIVE_HEAD / RETURN_LIVE_FOCUS / GO_LIVE_AND_LOCATE = the timeline rail's Live mark (VPORT-02: Return Live has ONE home, the Live edge); EXACT_RETURN = Back while a journey origin exists (T-07 journey) — shown as the Back label; RETURN_WORLD = the canonical "whole world" act behind Overview's exit, or behind the Back label "Whole world" at rung 0 (the proof's `goTo(0,0)` pan is replaced by `returnWorld`) | ADAPT | `return-navigation` + `orientation-chrome` tests; every act stays one executor call (no `navigate()`) | T-07 (six fixed acts; no bookmarks / coarse steps) |
| P8 | Journey (T-07) and composite spatial cause (T-10 / T-12): `observeAct`, `spatialCause.arm/take`, `witness` | `LivingAnalysisMap` callbacks | Arrival choreography and exact-return origin | The owner reports every act outcome to the host's `observeMapOutcome` / `observeReturnOutcome`; `takeSpatialCause` is asked at the settle (COSMOS has no arrival choreography of its own — motion is the settle) | RECONNECT | `t10-motion` contract pins the presentation plan: decision D-5 (COSMOS motion replaces T-10's arrival / travel plans for the Personal map) | T-10 (frozen motion) — D-5 |
| P9 | Disclosure arrival (new objects "resolve" from their host) | `motion/presence/DisclosureArrival`, `newlyDisclosed` | Objects arriving in `V` animate from their host | Not in COSMOS (entities appear with the stage) | RETIRE (D-5) | PO already accepted the COSMOS motion on the device | T-10 — D-5 |
| P10 | Accessible map: container label, viewport actions (zoom-in/out, explore ×4), node actions (inspect, switch-context, direct-jump), tree over the SAME freshness rule | `MapAccessibilityLayer`, `map-accessibility.ts` | TalkBack tree of the scene | COSMOS has container `accessibilityActions` zoom-in / zoom-out and per-node marks (inspect / focus) while a screen reader is on; explore ×4 and node switch-context / direct-jump are not offered | ADAPT (headless only; PO a11y scope) | Keep the accessible tree builder and its tests; re-wire to the stage's hits; no device proof (PO 2026-11-08) | Stage 6.2 §14 accessibility epistemic contract — words only, no proofs |
| P11 | Semantic absence vs culling vs change of world (R1 distinctions) | `MapSurface` header | — | `absenceOf` keeps NONE / LOADING / UNAVAILABLE / REFUSED / WORLD_EMPTY / REGION_EMPTY distinct; culling is the canvas's | WORKS | `core` tests | T-04 R1 |
| P12 | N4 / names: the Personal map names nothing | VPORT-01, CP-A (N4 not authorised) | Family word only | `labelOf` = family word; `personalScene` emits no label | WORKS | adapter test "no Personal labels" | binding |
| P13 | Old-renderer paint: strata, masses, marks, tethers, continuity atmosphere, candidate F rasters, strata atlas | `map/visual/*`, `WorldCanvas`, #391 / #393 | — | Superseded by the accepted COSMOS stage | RETIRE | goldens `personal-map`, `living-analysis-screen` re-recorded or retired; `world-visual`, `golden-equivalence`, `strata-*` tests retired with the renderer | VPORT-01 / LA-VIS-01 visual chain: superseded by the PO's COSMOS decision — must be recorded (D-6) |

### 4.3 Personal timeline (temporal navigation) — see §7 for the element mapping

| # | Function | Source of truth / implementation | Status | Contract |
|---|---|---|---|---|
| T1 | TC / TM / LH / LF in the canonical store; the only writes are COMMIT_MOMENT, COMMIT_LIVE_EDGE, COMMIT_MOMENT_AND_LOCATE, CHOOSE_LOCUS | `state/*`, `temporal-navigation/targeting/commit.ts` | WORKS (the proof already commits through `commitMoment` / `commitLiveEdge`) | T-06 §6, "no second temporal source" (enforced by `temporal-navigation-layer-contract` :709) |
| T2 | Disclosed track = the disclosed prefix SP1…SP(H) from the track-rung projection | `trackFromDisclosure`, `disclosedTrack` (T-05) | RECONNECT: the rail's ticks come from the T-05 track, not from `1..liveHead` as the proof draws (the proof draws every position; T-05 draws only DISCLOSED moments) | T-05 (frozen) |
| T3 | Presentation window (scroll, refine, widen, position rail) for long histories | `createPresentationController`, `TimelinePresentation` (FlatList, 48 pt steps) | ADAPT: the rail must window a long track (G-1: the accepted rail shows a handful of segments; T-05's window / discontinuity "…" must be expressed in the rail's visual language) | T-05 |
| T4 | Scrub strip: tap previews then commits; drag previews each step and commits on release; epoch / geometry guards | `useTemporalScrub`, `createScrubCoordinator` (T-06) | ADAPT: the rail's ticks become the target strip; the same coordinator drives preview + commit (the proof commits on tap with no preview) | T-06 (frozen) |
| T5 | Preview controller (PTC), preview marker, cancel precedence | `preview-state.ts`, `Aperture PREVIEW` | ADAPT: the rail shows a preview mark distinct from the committed dot | T-06 §1 (PTC is not canonical) |
| T6 | Committed marker (Aperture COMMITTED), Temporal Spine notches | `useTemporalMotion`, `SpineLayer` (P2 C) | ADAPT: the rail's gold dot = committed; the segments = spine notches | P2 (frozen iconography) — D-7: the accepted rail replaces the Spine / Aperture drawing for the Personal map |
| T7 | Live edge: OUTBOARD, never a Moment; "Following the conversation" / "Rejoin the conversation"; the word "Live" is never shown | `LiveEdgeTarget`, `LiveTerminal`, `commitLiveEdgeIntent` | ADAPT: the rail's Live mark is the outboard terminal; its words are T-06's (the proof's "Live" label is NOT product copy → Copy Gate) | Stage 6.2 §8 (outboard non-metric live control) |
| T8 | Disclosure horizon / exact-target maximum; beginning / end; discontinuity | `temporal-accessibility.ts` (`exactTargetMaximum`), T-05 `trackContinues` | ADAPT: the rail marks the disclosed end (horizon) and the beginning; history beyond the window = discontinuity mark | T-05 / Stage 6.2 §5 |
| T9 | Temporal orientation line (the sentence above the Track) | `TemporalOrientationLine`, `temporalLineModel` | ADAPT: said once, above the rail (T11/T12 amendment: directly above the Track) | T11/T12 controlled amendment (frozen) |
| T10 | Accessible temporal navigator: summary value, actions preview-later-moment / commit-previewed-moment / cancel-preview / commit-live-edge, exact-moment entry, forward continuation 180 ms | `TemporalNavigator`, `PresentationNavigator` | RECONNECT (the components mount beside the rail unchanged; headless tests only) | T-06 §accessibility |
| T11 | Live head sync / live focus sync (LH, LF events) | `temporal/live-head-sync.ts`, `live-focus-sync.ts` | WORKS (store-level, untouched) | — |
| T12 | Fringe: "not yet placed" count | `list.fringe` (COSMOS) from the Personal scene | ADAPT: is this a product fact? The proof shows "◌ N not yet placed" from entities without a held rung placement — G-2 | — |
| T13 | Locus choice surface | `LocusChoiceSurface` (exported, NOT mounted) | unchanged (not mounted) | — |
| T14 | Shared / Public time | none (SHARED-VIS-01 D5; S5-03B) | ABSENT by contract: the rail is Personal-only; no decorative ticks elsewhere (QAN-BL-CW-07 stays OPEN / UNASSIGNED) | SHARED-VIS-01 D5 |

### 4.4 Shared World

| # | Feature | Source of truth / implementation | Behaviour today | COSMOS equivalent / adapter | Status | Risk · validation | Contract |
|---|---|---|---|---|---|---|---|
| H1 | Entry verdict, membership, DENIED → neutral message, CLOSED world | `shared-world-controller` (`/shared/worlds/:id`), `SharedWorldArea` | Map only after ALLOW + MAP view | Unchanged host; the owner attaches to `controller.field` only in that state | RECONNECT | `surfaces`, `s4-01` tests | I-04, S4-01/03 |
| H2 | Field read: `GET /shared/worlds/:id/field`, places visible only when every source is permitted (D3), PEER_HIDDEN filtered | `shared-field-controller`, `shared-field-api` | — | Same controller; `sharedScene` from `state.entries` | WORKS | `shared-field` tests | SHARED-VIS-01 D3 |
| H3 | Camera FAR / MID / NEAR, pan, step (CA-Z1 focal), tap at FAR discloses MID, tap at MID / NEAR focuses the place | `public-field-camera` (shared re-export), controller acts | — | Owner seam (`createFieldOwner`) | WORKS | proof-owners Shared tests; **Issue #322 physical proof (QAN-BL-LAUNCH-04)** is inherited | SHARED-VIS-01 |
| H4 | Place panel: meaning, themes, exact attributed sources (producer SELF / HUMAN / QANDEEL, author, text, establishedAt) | `GET …/field/places/:id`, `Panel` in `SharedLivingAnalysis` | Chrome band | Sheet peek = meaning + themes + source count; expanded = the full source list (same decoder) | ADAPT | `shared-field` panel tests | SHARED-VIS-01 (no QANDEEL output as a source: QAN-BL-CW-05) |
| H5 | Per-World anchor (camera + focus) restored after a fresh read; D7 Back returns to the same World, camera, depth, focus | controller anchor | — | The owner reads `state.camera` / `focus` after the read, settles to it | WORKS | `shared-field` anchor test | SHARED-VIS-01 D7 |
| H6 | Back order: Manage → World; conversation → field; focus → release; else root; hardware Back releases a focused place first | `SharedWorldArea`, `controller.back()` | — | Top Back = `controller.back()` then `step('OUT')`; sheet close = release focus; the area keeps the rest | WORKS | `surfaces` tests | SHARED-VIS-01 §5 |
| H7 | The World's conversation (`SharedThread`, `SharedSendBar`), Manage World, permissions cards, proposals / invitations | `SharedWorldArea` screens | Full-area screens from the top band | Unchanged: the band's controls stay; the sheet offers "Open the conversation" = `openConversation()` (a screen switch, not a sheet state) | RECONNECT | — | S4-02 / S4-03 |
| H8 | Navigate from a source to its place in the conversation | none | — | ABSENT: no "scroll to material" act exists (`loadOlder` only) → G-3 | ABSENT | — | would need a product contract |
| H9 | "Sessions" in Shared | none (the Shared field has places and SOURCES = materials; no session object) | — | The PO's "session" maps to a SOURCE (material); no inferred sessions | ABSENT (by data model) | — | SHARED-VIS-01 §8 (no interpreter / placer) |
| H10 | Audio in Shared | none (text only) | — | — | ABSENT | — | — |
| H11 | Deep link `qandeel://shared/world/<id>` (S4-04 Direct Entry) | `shared-link.ts`, `runtime.sharedLinks` | Re-validated by the server entry | Unchanged | RECONNECT | `s4-04` tests | S4-04 |
| H12 | Ended World read-only map | none | — | — | ABSENT (QAN-BL-CW-06 OPEN) | — | — |
| H13 | Old-renderer Shared paint (SHARED-VIS-01 look, continuity) | `SharedFieldView` → `WorldCanvas` | — | Superseded | RETIRE | `shared-vis-01` contract test re-anchored | SHARED-VIS-01 visuals → D-6 |

### 4.5 Public World

| # | Feature | Source of truth / implementation | Behaviour today | COSMOS equivalent / adapter | Status | Risk · validation | Contract |
|---|---|---|---|---|---|---|---|
| U1 | Entry verdict `GET /public/entry`; the area draws the field only after ALLOW | `public-world-controller`, `PublicWorldArea` | — | Unchanged host | RECONNECT | `public-world` tests | S5-01 |
| U2 | Field read `GET /public/field` (whole world, then the glass), `revalidate`, `LIMIT 400` | `public-field-controller`, `public-field-api` | — | Same controller; `publicScene`; the owner re-reads the glass when the sheet lifts the anchor (CA-O1 envelope) | WORKS | QAN-BL-VIS-01 density stays DEFERRED (LA-SCALE-01) | S5-03B |
| U3 | Camera FAR / MID / NEAR; step IN at MID = focus the place nearest the glass centre (AT_BOUNDARY if none); OUT releases focus; tap at FAR discloses MID | `public-field-camera`, controller | — | Owner seam; IN at MID hands the fingers' world point so the controller picks the nearest to THE FINGERS (proof) | WORKS | proof-owners Public tests; **#322 physical proof inherited** | S5-03B |
| U4 | Search (`/public/field/search?q&within`), section control (WP1 §2.5), search scope, section list, up to 3 nearest topics of the section | `PublicLivingAnalysis` band + chrome | Top band + chrome band | Band unchanged; the section list and search results (chrome band content today) move into the sheet's peek when no Experience is focused (D-8) | ADAPT | `public-field-section` tests | S8A-05 CP1 |
| U5 | Experience panel: title, section, publisher label (PSEUDONYM / REAL_NAME), published day, the Discussion entry with the human count, themes, nearby, relations | `/public/field/experiences/:id`, `ServedPanel` | Chrome band | Sheet peek = title + publisher + day + themes + discussion count; expanded = full panel + content + discussion | ADAPT | `public-field` panel tests | S5-03B / S5-04 (counts never move anything) |
| U6 | Topic content pages (`/public/compose/topics/:id/items?page`) with roles WRITTEN / YOUR_MESSAGE / QANDEEL_REPLY / QANDEEL_UNDERSTANDING | `PublicTopicContent`, `controller.contentPage` | Paged inside the panel | Reused as is inside the expanded sheet | RECONNECT | `public-topic-content` tests | S8A-05 (published content only; never the private source conversation) |
| U7 | Discussion: read (`GET …/discussion[?after]`, loadMore, refresh), threads with one reply depth, author tag, reply-to line with scroll | `PublicDiscussion`, `public-discussion-controller` | In the chrome band over the panel | Reused as is inside the expanded sheet (nested scrolling, keyboard) | RECONNECT | `public-discussion*` tests | S5-04, A-5 |
| U8 | Contribute: post / reply (`POST …/discussion`), `@qandeel` invocation (bounded context), retry QANDEEL (`POST …/:postId/qandeel`); composer only while `canContribute` | same | The entitlement seam answers NOT_EVALUATED in production → composer absent | Reused; no fake posting; the composer appears exactly when the server says so | RECONNECT (client) / **BACKEND** (entitlement: Stage 9 / CW2-08 — not this task) | G-4 states it | S5-04 §15, A-5; PUB-REV-01 pre-launch blocker unchanged |
| U9 | Audio / voice in Public (`VOICE_REPLY`) | none (text path only; owned by QAN-BL-VOICE-01) | — | — | BACKEND / DEFER | — | S5-04 §15 |
| U10 | Explicit relations at NEAR (`PublicRelationLines`) | S5-03C, panel `relations` | Lines at NEAR only | COSMOS strands for the served relations of the focus (already in `publicScene`) | WORKS | `s5-03c` contract test re-anchored | S5-03C (no free relations) |
| U11 | Direct entry `enterAt(id, 'PANEL' | 'DISCUSSION')`, `target`, `qandeel://public` | controller, `public-link.ts`, `runtime.publicLinks` | S5-04 §10: no new grammar; Back discussion → panel → field | Unchanged acts; the sheet opens in the matching state | RECONNECT | `s5-04` tests | S5-04 §10 |
| U12 | Authoring / compose entry from the heading; share from Understanding | `PublicWorldArea`, `public-compose` | Replace the field inside the area | Unchanged | RECONNECT | — | S8A-05 CP2 |
| U13 | Local Back: sections → panel (discussion first) → search → chosen section | `PublicLivingAnalysis` BackHandler + `controller.back()` | — | Sheet close precedes the controller's order (§6.4) | ADAPT | `public-field` Back tests | S5-04 §10 |
| U14 | Old-renderer Public paint (`PublicExperienceMark`, continuity, candidate F) | `PublicFieldView` | — | Superseded | RETIRE | `s5-03b` contract test re-anchored | LA-VIS-01 visuals → D-6 |

### 4.6 COSMOS-only elements (the accepted chrome) and their production meaning

| # | Element | Proof behaviour | Production binding | Status |
|---|---|---|---|---|
| C1 | Nearest-topic indicator (REGION_EMPTY + bearing) | Appears only when nothing served is in view; "Go to the nearest" = one pan toward the nearest point the client was SERVED (whole-world evidence or the current read); never invents a target | Same; the target set is the authority's served entries (Personal: the WORLD rung read; fields: the whole-world read captured once per entry). It is an explicit tap, never a silent selection (T-04). Words → Copy Gate | WORKS |
| C2 | Right zoom rail | Current rung lit with its label; shallower rungs tappable (= repeated canonical OUT steps); deeper disabled | Same; labels from product copy (T-08 rung words exist for Personal; FAR / MID / NEAR words from the field copies) | WORKS |
| C3 | Top Overview | Presentation-only framing of every held entity; dispatches nothing; tag "overview (presentation only)"; entity taps disabled; leaves on any act | Same (accepted); the tag's wording → Copy Gate; relation to RETURN_WORLD → D-3 | WORKS |
| C4 | Top Back | `back()` = leave overview → authority Back → at rung 0 with a pan, `goTo(0,0)` | Hierarchical order (§6.4): collapse the sheet → close the card / release focus → `backOneStep` / `controller.back()` → `returnWorld` (Personal) / pan home (fields). Label words from T-08 | ADAPT |
| C5 | Bottom timeline rail (`PositionTicks`) | Ticks 1..LH, lit ≤ TC, gold dot at TC, "Live" / "Position a of b", fringe; tap = `commitMoment`; "Live" = `commitLiveEdge`; hidden while the card is open | Same look; function = the T-05 / T-06 / T-08 contract (§7) | ADAPT |
| C6 | Card (fixed peek 156 pt) | Title / meta / lines from the owner; close = Back; `liftsFocus` moves the camera focus up (fields) | Becomes the detail sheet's PEEK state (§6); the lift stays | ADAPT |
| C7 | Absence states LOADING / UNAVAILABLE (+Retry) / REFUSED / WORLD_EMPTY | Sentences in the proof copy | Product copy (the field copies already have unavailable / empty / retry words; reuse) | WORKS |
| C8 | Double-tap = step IN at the point | proof | Keep (one canonical step) — listed for the PO as a kept proof behaviour (D-9) | WORKS |

---

## 5. Screen / component migration plan

Disposition per file (K = keep as is, A = adapt, N = new, R = retire from the product surface, V = validation-only). Nothing is deleted in Slices B–D: retired components stay in the tree until Replay (G-5) and the contract tests have moved, then a separate retirement change removes them with their goldens.

| File | Disposition | What changes |
|---|---|---|
| `integration/composition/DepthComposition.tsx` | K | Nothing of the depth pair, areas, overlays or call rules. |
| `integration/composition/LivingAnalysisMap.tsx` | A | Keeps the store / projection subscriptions, `ensure`, the T-07 journey and spatial-cause bindings. `world` = `CosmosWorldView` over `createPersonalCosmosOwner(runtime)`; `timeline` = `{ line: TemporalOrientationLine, layer: CosmosTimelineRail }` (the rail hosts `TemporalTargetLayer`'s function, §7); `chrome` = COSMOS chrome fed by `chromeProjection` / `orientationModel`; `presentation="STAGE"`. The `details` toggle from #392 (Premium Compact) is not ported: the accepted COSMOS chrome has no label-only arrangement (D-2). |
| `living-analysis/LivingAnalysisSurface.tsx` | A | Adds `presentation: 'FRAMED' | 'STAGE'` and an `overlay` slot; FRAMED path byte-identical. |
| `responsive/plan.ts`, `ResponsiveSurface` | A (minimal) | A `STAGE` plan: map frame = the whole surface under the top band; support = none; chrome insets exposed for the overlay. |
| `map/renderer/MapSurface.tsx`, `WorldViewSurface.tsx`, `WorldCanvas.tsx`, `MapCanvas.tsx`, `useWorldSurface.ts`, `map/visual/*` | R (deferred) | Still mounted by Replay until G-5 is decided; no longer mounted by the three worlds. |
| `map/camera/*`, `map/inspection/*`, `map/projection/*`, `map/world/*`, `map/accessibility/map-accessibility.ts` | K | The authority, maths, models and the accessible tree builder stay; `MapAccessibilityLayer` is re-hosted over the stage's hits (headless). |
| `orientation-chrome/model.ts`, `product-copy.ts`, `inspection-orientation.ts`, `return-orientation.ts`, `exact-return-origin.ts` | K | The models and words are the product's; COSMOS chrome renders them. |
| `orientation-chrome/OrientationChrome.tsx`, `ReturnControls.tsx`, `InspectionOrientation.tsx` | R for the three worlds (K for Replay) | Their models move into `CosmosBack`, the rail's Live mark and the sheet's peek (D-3). |
| `temporal-navigation/timeline-integration/TemporalTargetLayer.tsx`, `useTemporalScrub.ts`, `scrub.ts`, `motion/*`, `preview/*`, `targeting/*`, `accessibility/*` | K (coordinator, preview, motion binding, navigator) / A (the drawing) | `CosmosTimelineRail` composes the SAME scrub coordinator, preview controller, motion binding and `TemporalNavigator` over the rail's geometry; `SpineLayer` / `Aperture` drawing is replaced by the rail's ticks and dot (D-7). |
| `timeline/*` (T-05 track, presentation controller, `PresentationNavigator`) | K / A | The controller and navigator stay; `TimelinePresentation`'s FlatList is replaced by the rail's windowed segments (G-1). |
| `shared-world/field/SharedLivingAnalysis.tsx` | A | `world` = `CosmosWorldView` over `createSharedCosmosOwner(controller)`; the band unchanged; `chrome` = COSMOS chrome + sheet (place panel). |
| `shared-world/field/SharedFieldView.tsx`, `shared-field-projection.ts` | R (deferred) | Old renderer. |
| `shared-world/field/shared-field-controller.ts`, `shared-field-camera.ts` | K | Authority (with CA-Z1 focal from the PR chain, D-1). |
| `public-world/field/PublicLivingAnalysis.tsx` | A | `world` = `CosmosWorldView` over `createPublicCosmosOwner(controller)`; band unchanged; chrome band content → sheet / peek (D-8). |
| `public-world/field/PublicFieldView.tsx`, `PublicExperienceMark.tsx`, `PublicRelationLines.tsx`, `public-field-projection.ts` | R (deferred) | Old renderer. |
| `public-world/field/PublicDiscussion.tsx`, `PublicTopicContent.tsx`, `public-discussion-controller.ts`, `public-field-controller.ts` | K | Reused inside the sheet unchanged (their scroll containers become nested). |
| `replay-composite/ReplayMomentComposite.tsx` | K (FRAMED) | Until G-5. |
| `cosmos/core/*`, `cosmos/assets/*` | K | — |
| `cosmos/skia/CosmosCanvas.tsx` | A | Remove `mode` / `opaqueSurface` / `onProbe` and the probe rings; keep `drift`, `onFirstStageFrame` (as `onComposed`), the a11y marks, the three pinch rules and the test ids. |
| `cosmos/skia/parts.tsx`, `prepare.ts` | A | Remove the NO_BODIES / PLATES_ONLY branches and `PreparedRung.lights`. |
| `cosmos/__validation__/*` | V | Stays for device proofs; gains nothing. The proof root keeps a copy of the removed measurement paths only if the PO wants future measurement builds (D-10). |
| `cosmos/product/**` | N | §3.2. |
| `cosmos/__tests__/pinch-focus.test.tsx`, `proof-root-pinch.test.tsx` | A | Re-targeted at `CosmosWorldView` + the product owners; committed with Slice B. |
| `apps/mobile/experiments/cosmos-*`, `scripts/select-cosmos-proof-entry.mjs` | V | Tooling; not bundled. |
| `apps/mobile/package.json` | K | RN Skia stays 2.6.2 (§3.8); no new dependency (no sheet library). |

Tests and goldens:
- Re-record: `integration/__tests__/__golden__/living-analysis-screen.golden.json` (the STAGE composition), with its continuity test retired for the three worlds.
- Retire with the old renderer (when Replay moves): `map/__tests__/__golden__/personal-map.golden.json`, `golden-equivalence`, `world-visual`, `strata-*`, `semantic-zoom-focal` (the semantics move to the owner tests).
- Root contract tests to re-anchor in Slice B (first step: run the full `tests/*.mjs` suite on the integration branch and list every failure before changing any pin): `living-analysis-map-runtime` (renderer structure and the 2.6.2 pin stay), `t10-motion`, `t11-responsive`, `t12-product-activation`, `t12p-mobile-runtime-entry`, `vport-01`, `vport-02`, `shared-vis-01`, `s5-03b`, `s5-03c`, `s7-01..04` (should pass unchanged while Replay keeps the old renderer), `intel-04`. A pin is re-anchored only with the contract reason written next to it (BG discipline); none is weakened.

---

## 6. The detail sheet (peek → full-screen → return)

### 6.1 States and geometry

| State | Height | Canvas | What it shows |
|---|---|---|---|
| CLOSED | 0 | full stage, full gestures | — |
| PEEK | the accepted card height (156 pt incl. its rule) + bottom inset; the fields lift the camera focus by half the peek (the proof's `focusYOf`) | visible, pannable / pinchable above the sheet | title, meaningful summary, the available acts (per world, §6.3) |
| EXPANDED | the usable screen minus the top band (status bar + the host band remain visible; D-11: whether the top band hides) | mounted, not visible, not interactive (`pointerEvents="none"`, hidden from a11y), its camera untouched | the complete authorised detail, scrolling, text input |

The sheet is a sibling overlay of `CosmosWorldView` inside the ONE surface's overlay slot; the canvas is never unmounted or re-keyed by a sheet transition (the proof already keeps the canvas while the card opens). Expanding writes no canonical state and moves no canonical camera; collapsing restores the exact presentation camera because nothing moved it.

### 6.2 Gestures and input (RNGH + Reanimated, no library)

- The sheet's handle and header carry a `Gesture.Pan` whose handler is declared `blocksExternalGesture(canvasPan, canvasPinch)` and the canvas gestures `requireExternalGestureToFail(sheetPan)` is NOT used (it would delay the canvas); instead the sheet view is a separate RNGH root above the canvas, so touches that start on the sheet never reach the canvas, and touches on the canvas never move the sheet. A drag up past 40 % of the travel expands; a drag down past 40 % collapses to PEEK, and from PEEK past 50 % closes; velocity thresholds as in the T-10 reduced-motion rule (instant under Reduce Motion).
- Nested scrolling: the expanded content is a `ScrollView` / the existing `PublicDiscussion` scroll; the sheet pan activates only when the content is at its top and the drag is downward (`simultaneousWithExternalGesture` with the scroll, offset check on the UI thread).
- Keyboard: the composer (Public discussion) keeps `KeyboardAvoidingView` behaviour of the current component; the EXPANDED sheet reduces its height by the keyboard inset; PEEK never hosts text input.
- Safe area: bottom inset from the responsive plan (`composition.bottomInset`), the call box height added while `callLive`.
- Android Back order (one listener, the host's): EXPANDED → PEEK; PEEK → CLOSED (= release focus / close the card); then the world's own Back (§4.6 C4); then the area's / depth's Back as today. This refines, and does not replace, S5-04 §10 "discussion → panel → field" and SHARED-VIS-01 §5 "releases a focused place first".
- Accessibility (headless only): `accessibilityViewIsModal` while EXPANDED, header role, escape action collapses; the canvas marks hidden while EXPANDED.

### 6.3 Content per world — what exists and what does not

| World | PEEK (compact) | EXPANDED (full) | Existing component / controller | Missing |
|---|---|---|---|---|
| Public | title, publisher label, published day, themes, Discussion entry with human count (`ServedPanel` facts) | the panel in full, `PublicTopicContent` (paged, roles tagged), `PublicDiscussion` (read, load more, reply-to, author tag, scroll to the answered post, `@qandeel` hint, composer only when `canContribute`, QANDEEL block clearly labelled, retry) | `public-field-controller` (`focus`, `contentPage`, `openDiscussion`), `public-discussion-controller` | audio / voice (BACKEND, VOICE-01); contribution entitlement in production (BACKEND, Stage 9) — G-4; nothing else is missing: every action the PO lists for Public exists except voice |
| Shared | meaning, themes, source count | the full source list (producer SELF / HUMAN / QANDEEL, author, text, date), "Open the conversation" (`openConversation`, a screen switch) | `shared-field-controller` (`focus`), `SharedWorldArea` | per-source navigation into the conversation (G-3); "sessions" do not exist as objects (H9); no audio (H10) |
| Personal | family word (Thread / Reading), the T-08 inspection statement and lineage, acts: switch context, go to place (direct jump), exact return | **no existing content surface** for a Thread / Reading / Session (the product shows orientation only; conversation = the CONVERSATION depth; history at a moment = the Replay passage; original audio = Replay audio) → G-7 | `inspectObject`, `switchContext`, `directJump`, `orientationModel`, `player.openLatest()` | the whole expanded Personal detail is a product gap: which existing surfaces compose it (Replay at the inspected moment? a cross to the Conversation? the historical projection's `inspectFamily/inspectId` read?) is the PO's decision; nothing is fabricated meanwhile (the sheet offers PEEK only, with "Open the conversation" = `cross('CONVERSATION')` and "Replay" = the existing entry) |

### 6.4 Back / sheet / world precedence (one ordered list, used by every world)

1. EXPANDED sheet → PEEK.
2. PEEK → CLOSED: Personal clears nothing canonical (inspection stays `IF_ref` until the next act — D-12 whether closing the card clears the inspection, as the proof's Back does through `backOneStep`); fields release the focus (`controller.back()`).
3. Overview → leave.
4. World Back: Personal `backOneStep`; fields `controller.back()` (their local order), then `step('OUT')`.
5. At the top rung with a pan: Personal `returnWorld`; fields pan home.
6. Nothing registered → the area's / depth's Back.

---

## 7. Timeline: function → accepted rail mapping (Personal only)

The rail's LOOK is final: a row of thin segments across the bottom, lit segments up to the committed position, a gold dot at it, a small line of words under it. The FUNCTION is T-05 / T-06 / T-07 / T-08's, reached through their existing controllers — never a second cursor, cache or clock.

| Existing function (owner) | Rail element | Binding |
|---|---|---|
| Disclosed track SP1…SP(H) (T-05, `trackFromDisclosure`) | the segments | one segment per DISCLOSED Moment of the presentation window; nothing for undisclosed positions (the proof's `1..liveHead` is replaced) |
| Presentation window: move / position / refine / widen (T-05 controller) | the window the segments show; a discontinuity mark "…" at the end(s) where the track continues; the position rail = horizontal drag on the segment row outside the target strip? — **G-1** (how a long track is windowed in the accepted look) | `createPresentationController` unchanged; `PresentationNavigator` unchanged (headless) |
| Temporal target strip: tap previews + commits; drag previews per step and commits on release; epoch / geometry guards (T-06 `useTemporalScrub`) | the segment row IS the target strip (same 48-pt step geometry mapped onto the segments' pitch) | `createScrubCoordinator` / `createScrubHandlers` unchanged; geometry supplied by the rail |
| Preview (PTC) and its marker | a hollow dot / distinct lit state on the previewed segment | `createTemporalPreviewController` unchanged; the rail renders `preview.ptc` |
| Committed marker (Aperture) | the gold dot | `motion.committedStyle` from `useTemporalMotion` drives the dot's translate (same binding, different glyph) — D-7 |
| Spine notches (P2 C) | the segments themselves | D-7 |
| Live edge, outboard, never a Moment; words "Following the conversation" / "Rejoin the conversation" (T-06) | the mark at the END of the rail, outside the last segment, with T-06's words under the rail (the proof's "Live" / "Position a of b" are replaced by the product sentences; the temporal orientation line says the position) | `commitLiveEdgeIntent` / `commitLiveEdge`; `RETURN_LIVE_HEAD` / `GO_LIVE_AND_LOCATE` / `RETURN_LIVE_FOCUS` offered here when the T-08 model says they are meaningful (VPORT-02: one home) |
| Beginning / end / disclosure horizon (`exactTargetMaximum`) | the first segment = the beginning (when the window starts there); the last disclosed segment = the horizon; beyond it only the outboard Live mark | T-06 availability gates unchanged |
| Commit of a Moment: `COMMIT_MOMENT` (T-06 §6) → the Map's projection is invalidated by the store, COSMOS re-reads | unchanged | the owner rebuilds the stage on the new `tc` (the proof already does this) |
| Temporal orientation line (T11/T12 amendment: directly above the Track) | one line directly above the rail | `TemporalOrientationLine` unchanged |
| Accessible navigator (T-06): summary, 4 actions, exact-Moment entry, forward continuation | mounted beside the rail, unchanged, headless-tested | `TemporalNavigator`, `PresentationNavigator` |
| Fringe "not yet placed" (proof) | the small count under the rail, if kept | G-2 |
| Hidden while the card is open (proof) | the rail hides under the PEEK sheet; EXPANDED covers it | — |

What is explicitly NOT done: no Shared / Public rail (SHARED-VIS-01 D5; QAN-BL-CW-07 stays open and unassigned), no decorative ticks that are not Moments, no second temporal cursor.

---

## 8. Dependency, PR and worktree risk map

| # | Dependency / risk | Fact | Consequence | Handling |
|---|---|---|---|---|
| R1 | COSMOS's base is the #393 chain (`a06181b0`), not `main` | §2.1; hard dependency on CA-Z1 (`9edb41fd`) for the focal step | The integration branch cannot sit on `main` and run the proof's owners unchanged | **D-1**: (a) re-base the integration worktree on `map/map-perf-01-production` (630ee0fd; merge-tree clean) so #391 / #392 / #393 are prerequisites merged in their own order; or (b) port CA-Z1's authority change alone onto `main` (the `focal` argument on `zoomSemanticStep`, the field controllers' `step(dir, focal)`, `useSteadyEnvelope` for CA-O1) as a small, separately reviewed commit, leaving #391 / #392 / #393's old-renderer paint unmerged (it is superseded by COSMOS). (b) duplicates ~300 lines of approved work; (a) merges ~200 KB of old-renderer paint and goldens that retire. Recommendation: **(b)**, recorded as a controlled port with the PO's CA-Z1 approval of 2026-11-14 as its authority, and #391 / #392 / #393 marked SUPERSEDED-BY-COSMOS except for their authority and screen decisions (#392's transparent bands and continuous world are carried by the STAGE presentation; its `details` toggle is not). |
| R2 | The CA-Z1 / CA-O1 / CA-O2 / MAP-PERF-01 records exist only on unmerged branches | governance audit | On `main` the focal-step authority is unrecorded | Whichever D-1 path, the record that lands with Slice B must carry the CA-Z1 decision text (from the V3 record on `map/map-perf-01-production`). |
| R3 | RN Skia 2.6.2 is pinned in ~8 root contracts and the lockfile; `expo.install.exclude` is asserted as exactly `['typescript']`; QAN-INF-03 runs `deps:check` + `doctor` offline | governance audit | 2.7.0 cannot enter without a Task Contract and declared re-anchors | §3.8: stay on 2.6.2. The 2.7.0 experiment report is the evidence for a separate QAN-INF-03 item (D-13: open it now or after integration). |
| R4 | 15 root contract tests + 2 goldens pin the old renderer / surface | §2.3 | Slice B will break pins by design | First step of Slice B: run the full root suite on the branch, list every failure, re-anchor each with its reason; none weakened; the `living-analysis-map-runtime` allowlist (Skia, react, RN, RNGH, runtime types) must learn `react-native-reanimated` / `react-native-worklets` for the COSMOS host (they are already production deps used by `temporal-navigation` and `motion`). |
| R5 | T-10 motion (frozen) describes the presentation camera's travel / arrival plans for the Personal map; COSMOS replaces them with its settle | §4.2 P8 / P9 | A frozen contract's presentation is superseded | **D-5** + a controlled amendment recorded with Slice B (the PO accepted the COSMOS motion on the device). |
| R6 | VPORT-01 / LA-VIS-01 / SHARED-VIS-01 visual chain = CURRENT PRODUCTION in the Visual Source Registry; Step 3 "not authorized"; V-3 "not opened" on `main` | governance audit | COSMOS supersedes the recorded visual chain | **D-6**: the registry gets a new category / entry for COSMOS (the accepted HONOR captures as its source, with hashes), and the chain is marked superseded on merge. |
| R7 | Replay composite still draws with the old renderer | §4.1 S8 | Two renderers in the product until G-5 | Accepted for Slices B–D; the old renderer is not deleted until Replay's disposition. |
| R8 | The proof root's chrome words are not product copy; W3-PDG-01 forbids a custom language toggle | §3.6 | Copy Gate rows (ar / en, PROPOSED) for every new word; toggle removed | Slice C carries the Copy Gate table in the record. |
| R9 | Issue #322 (QAN-BL-LAUNCH-04): physical-Android rapid-interaction / resize proof for Shared and Public is still open on the old renderer | backlog | The new renderer needs the same proof | Slice E runs the #322 Exit Gate on COSMOS (≥12 panel-scroll-Back cycles, 4 rapid cycles) on the HONOR; the item is re-owned to this task (BG-05). |
| R10 | Memory 021 | accepted | — | No reopening; the open / close cycle and `gc` links are not in the product. |
| R11 | Worktrees | `E:\cosmosint` (integration), `E:\cosmosv5` (proof, uncommitted), `E:\mapv3*`, `E:\mapperf*`, `E:\QANDEEL_APP` (s8a branch, register only) | The proof's uncommitted correction must reach the integration branch by file copy + the two tests, not by committing the experiment branch | Slice B copies `CosmosCanvas.tsx`'s working-tree version and the two pinch tests; the proof branch stays uncommitted / experimental. The generated `apps/mobile/android` in `E:\cosmosv5` is removed before any build. |
| R12 | Live call path | §3.7 | A heavy frame during a call is a release concern | Slice E measurement; INTEL-05 (a refused analysis stalling a call's map) stays OPEN / UNASSIGNED, noted. |
| R13 | Backlog items this task inherits at kickoff (BG-05) | VIS-01 (LA-SCALE-01: density / LOD / device perf), LAUNCH-04 (#322), CW-05, CW-06, CW-07, NAV-03, INTEL-05, RSP-03, VOICE-01, PUB-REV-01, OPEN-06/08/09, OPEN-19 | Each needs a disposition in the task record | Proposed: re-own LAUNCH-04's Exit Gate to this task (Slice E); keep VIS-01 DEFERRED with LA-SCALE-01 but note COSMOS's atlas path as its candidate; leave CW-05/06/07, NAV-03, INTEL-05, RSP-03, VOICE-01, PUB-REV-01, OPEN-* with their owners / unassigned (none is delivered or blocked by this task). |
| R14 | Stale locators on `main` (Step 2 banner says "not merged"; backlog count 89 vs 108) | governance audit | Not this task's to fix silently | Noted for the PO; the task record will not repair them (governance task). |
| R15 | New task identity | none assigned | The record path needs an ID | Proposed `COSMOS-INT-01`, record `docs/e2e/QANDEEL_COSMOS_INT_01_PRODUCTION_INTEGRATION_RECORD_v1.md`; this contract is its §0 once the PO assigns the ID. |

---

## 9. Development slices, acceptance criteria and test gates

Every slice is one reviewable Draft PR on `cosmos/cosmos-production-integration` (or on its D-1 base), docs in the same change (record + locators), no merge without «ادمج». Device proofs on the HONOR with the existing scripts (`E:\QANDEEL_REPORTS\COSMOS-V5\scripts`), sha-256-guarded installs, captures in the report folder.

| Slice | Scope | Acceptance criteria | Test gates |
|---|---|---|---|
| **A** (this document) | Inventory, matrix, architecture, plan, gaps | PO review of §10 | — |
| **B** COSMOS renderer inside the real product | `cosmos/product/owners/*` over the real runtime / controllers; `CosmosWorldView`; STAGE presentation; the three hosts render COSMOS; proof-only UI, probe, overdraw, fixtures, faults, language toggle, `gc` links absent from the product bundle; the three pinch rules + tests; D-1 base in place | (1) each world draws its own server-authoritative data in the app (real sign-in on the HONOR, Personal session; a real Shared World; the Public field); (2) one canonical act per gesture (store / controller logs); (3) refusals ease back; (4) no fixture, fault or measurement symbol reachable from `ProductRoot` (static grep + bundle check); (5) opening speed and 60 fps on the HONOR not worse than the proof's rounds; (6) memory not re-measured (021) | headless: owners (ported `proof-owners`), `pinch-focus`, `proof-root-pinch` re-targeted, cosmos core / worklet parity / headless pixels; mobile suites green; root `tests/*.mjs` green after declared re-anchors; `tsc`, `eslint`; CI mobile + QAN-INF-03 offline gate unchanged |
| **C** Approved chrome and timeline function | Back (hierarchy), Overview, rail, nearest indicator, absence states, the timeline rail over T-05 / T-06 / T-08 (§7), the six return acts (D-3), Copy Gate table | (1) every return act reachable and runs its one executor; (2) commit / preview / live edge / horizon / beginning behave as T-06 on the HONOR (tap, drag, release, cancel); (3) no second temporal source (`temporal-navigation-layer-contract` green); (4) Arabic + English, RTL mirrored rail and chrome; (5) chrome identical to the accepted captures except product words | `temporal-navigation/__tests__` (13) green over the rail; `return-navigation`, `orientation-chrome` model tests; Copy Gate rows PROPOSED → the PO; device captures per state |
| **D** Expandable detail surfaces | `CosmosDetailSheet` (§6) in all three worlds; Public panel + content + discussion; Shared panel + sources + conversation entry; Personal peek + the G-7 decision's content | (1) no canvas remount across open / expand / collapse (instrumented test: same canvas instance, camera unchanged); (2) sheet drags never pan / pinch the world; (3) nested scroll, keyboard, Back order per §6.4; (4) every action is an existing controller act; composer appears only when `canContribute`; (5) RTL / Arabic; (6) accessibility headless (modal, escape, hidden canvas) | `public-discussion*`, `public-topic-content`, `public-field`, `shared-field` suites green inside the sheet; new sheet tests (gesture arbitration with `fireGestureHandler`, Back precedence); HONOR captures for the three states per world |
| **E** Integration validation | functional, authorization, privacy, a11y (headless), ar / en, navigation, media (Replay + call), screen lifecycle (background / resize / rotation / keyboard), real-device regression; #322 Exit Gate on COSMOS; live-call measurement; "nothing dropped" audit = this matrix re-walked row by row with evidence | (1) every WORKS / RECONNECT / ADAPT row has a passing check; every RETIRE row is confirmed superseded; every ABSENT / BACKEND row is unchanged and recorded; (2) call path: 60 fps during a live call on the Analysis, no frame work added by COSMOS beyond the drift gate; (3) #322 Exit Gate passed on the HONOR; (4) QAN-INF-03 untouched (2.6.2); (5) record closure per AGENTS.md §10 (BG-05/08/09, `test:task-closure-governance-contract`) | full CI; device report; PO review before any merge |

Order: B → C → D → E. C and D may be developed in parallel branches off B once B is reviewed; E only after D.

---

## 10. Explicit unresolved gaps and the decisions requested

Gaps (functional; nothing is implemented for them without the PO):

| ID | Gap | Why it is a gap | Recommendation |
|---|---|---|---|
| G-1 | Long Personal histories on the accepted rail: T-05 windows the track (48-pt steps, scroll, refine / widen, discontinuity "…"); the accepted rail shows a handful of segments across the width | The rail's look is final; how it expresses a window and a discontinuity is a presentation decision not covered by the proof (its fixture has few positions) | Window the track to the segments that fit; a short "…" mark at the end where the track continues; the position rail = a horizontal drag on the rail's margin. PO to confirm the marks. |
| G-2 | "Not yet placed" count under the rail | It is a COSMOS fact (entities without a held rung placement), not a recorded product fact | Drop it from the product unless the PO wants it recorded as a product statement. |
| G-3 | Shared: navigate from a source (material) to its place in the conversation | No act exists (`loadOlder` only); would need a "scroll to material" contract and possibly a server cursor | Record as a new backlog item (QAN-BL-CW-08 candidate); the sheet offers "Open the conversation" only. |
| G-4 | Public contribution in production: the entitlement seam answers NOT_EVALUATED (Stage 9 / CW2-08), so the composer is absent | Server-side; not this task | State it in the record; the client is correct as is. |
| G-5 | Replay composite renderer | Two renderers in the product until decided | Recommend a later slice "Replay on COSMOS" (one picture track, the bench already exists); until then FRAMED + old renderer. PO decides whether that slice joins this task or stays a backlog item. |
| G-6 | EMERGING_FOCUS family in the Personal stage | `personalScene` emits THREAD / READING hits only; the old map inspects EMERGING_FOCUS too | Slice B adds the family to the adapter (hit + family word), no visual change; confirm with the PO that it needs no new look. |
| G-7 | Personal expanded detail content | No Thread / Reading / Session content surface exists in the product; the PO's requirement names "full conversation, session, analysis and any available original recording" | Options: (i) PEEK only + "Open the conversation" (`cross`) + the Replay entry (existing acts); (ii) a new Personal detail surface over the historical projection's `inspectFamily/inspectId` read and the conversation session API = a new product contract (not authorised by this task). Recommendation: (i) now, (ii) as a PO-specified follow-on. |
| G-8 | Public "permitted audio / voice media" | Public is the text path only; VOICE_REPLY belongs to QAN-BL-VOICE-01 | None in this task; recorded. |
| G-9 | Projection reads per viewpoint: the proof asks for all five Personal rungs at every viewpoint (so the rail / overview can hold them); the product reads the viewpoint + the track rung (+ adjacent rungs after CA-Z1's prefetch) | More server reads per temporal commit | Read the viewpoint + track rung first, the other rungs lazily on the first settle; measure the count in Slice B. |

Decisions requested (D-x), with the recommendation first:

| ID | Decision | Recommendation |
|---|---|---|
| D-1 | Base of the integration branch (R1) | (b): port CA-Z1 / CA-O1 authority onto `main` as a separately reviewed commit; mark #391 / #392 / #393 superseded by COSMOS except their authority and screen decisions. |
| D-2 | Screen composition: STAGE presentation inside the ONE surface (no support band; chrome overlaid); #392's `details` toggle not ported | Yes. |
| D-3 | Placement of the six return acts and the inspection orientation in the COSMOS chrome (§4.2 P6 / P7) | Back = BACK_ONE_STEP / EXACT_RETURN; the rail's Live mark = the three Live acts; RETURN_WORLD = the canonical act behind "Whole world" at the top rung (Overview stays presentation-only); the inspection statement + lineage + context acts = the sheet's PEEK. |
| D-4 | Increased contrast: #392 switches the continuous world off; COSMOS has no "framed" look | Keep the stage; raise the chrome's contrast only. |
| D-5 | T-10 motion for the Personal map superseded by the COSMOS settle (controlled amendment) | Yes, recorded with Slice B. |
| D-6 | Visual Source Registry entry for COSMOS; the VPORT-01 → S8B-06 F-G chain marked superseded on merge | Yes, with the accepted HONOR captures as the source (hashes recorded). |
| D-7 | The rail's ticks / dot replace the Temporal Spine + Aperture (P2 C) drawing for the Personal map | Yes (the PO froze the rail's look). |
| D-8 | Public: section list / search results / section-near shown in the sheet's PEEK when no Experience is focused (instead of the chrome band) | Yes. |
| D-9 | Keep the proof's double-tap = one step IN at the point | Yes. |
| D-10 | Keep a measurement build path (proof root) for future device measurement | Yes, validation-only, never bundled. |
| D-11 | EXPANDED sheet: the host's top band stays visible (Conversation / Shared Back / Public heading) | Yes (one way back always visible). |
| D-12 | Closing the Personal PEEK: clear the inspection (`backOneStep`, as the proof) or keep `IF_ref` | Clear it, through `backOneStep` (one recorded act, reversible). |
| D-13 | RN Skia 2.7.0 under QAN-INF-03: open the item now in parallel, or after integration | After Slice B's device proof on 2.6.2, so the integration never depends on it. |

---

## Appendix A — files opened for this contract (main @ `5a21971d`, cosmos @ `d5c45571` + working tree)

`integration/composition/{ProductRoot,DepthComposition,LivingAnalysisMap}.tsx`, `living-analysis/LivingAnalysisSurface.tsx`, `map/renderer/{MapSurface,WorldViewSurface,WorldCanvas,MapCanvas}.tsx`, `map/camera/*`, `map/inspection/map-actions.ts`, `map/accessibility/*`, `orientation-chrome/{index.ts,types.ts,InspectionOrientation.tsx,ReturnControls.tsx}`, `return-navigation/{return-actions,surface}.ts`, `temporal-navigation/timeline-integration/TemporalTargetLayer.tsx`, `temporal-navigation/accessibility/*`, `temporal-navigation/targeting/*`, `timeline/{window/controller.ts,virtualization/TimelinePresentation.tsx,accessibility/*}`, `shared-world/{SharedWorldArea,SharedWorldThread}.tsx`, `shared-world/shared-world-controller.ts`, `shared-world/field/*`, `runtime-entry/{shared-field-api,public-field-api,public-discussion-api}.ts`, `public-world/{PublicWorldArea.tsx,public-world-controller.ts}`, `public-world/field/*`, `replay-composite/ReplayMomentComposite.tsx`, `replay-player/ReplayPlayer.tsx`, `original-audio/index.ts`, `voice-note/index.ts`, `call/*`, `apps/mobile/package.json`, `app.json`, `tests/*.mjs` (grep); `cosmos/core/*`, `cosmos/skia/*`, `cosmos/__validation__/*`, `cosmos/__tests__/*`, `docs/experiments/living-world-cosmic-v5/*`; the PR branches' diffs; `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `docs/qandeel-canonical-backlog-v1.md` and the records cited in §4.
