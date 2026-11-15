# COSMOS Production Integration Contract — v1.3 (Slice B ACCEPTED by the PO; Slice C in progress on a dependent branch)

**Task:** COSMOS V5 Production Integration & Living Analysis Map Replacement (PO authorisation of 2026-11-15).
**Status:** `SLICE B — ACCEPTED BY THE PO (2026-11-15) ON DRAFT PR #394 (NOT MERGED) — SLICE C — APPROVED COSMOS CHROME, TIMELINE AND NAVIGATION INTEGRATION — AUTHORISED AND IN PROGRESS ON `cosmos/cosmos-int-01-slice-c` (FROM 48e88a70; DEPENDENT DRAFT PR) — BINDING DIRECTION §14 C-1 … C-10 + §7 — PLAN AND MIGRATION MATRIX §15 — SLICE D NOT AUTHORISED — PRs #391 / #392 / #393 UNTOUCHED — NO MERGE`. v1.1 recorded the PO's first batch (D-1, D-5, D-11, D-12, D-13, G-2, G-5, G-7); v1.2 records the Slice B entry decisions (D-2, D-14, D-9, D-10, G-6) and the Slice B delivery (§13).
**Author:** integration engineering (Claude), 2026-11-15 (v1.0), 2026-11-15 (v1.1), 2026-11-15 (v1.2), 2026-11-15 (v1.3).
**Change log v1.2 → v1.3.** The PO's message "COSMOS-INT-01 — PO Approval: Slice B Accepted, Start Slice C" (2026-11-15) is applied: Slice B is ACCEPTED (PR #394 stays a Draft, unmerged); Slice C is authorised under §14 C-1 … C-10 and §7, as a dependent branch of the Slice B head. New §15 is the concise implementation plan and the functional migration matrix for the old timeline and return controls the PO asked for first. §14's "NOT started" banner is superseded by §15.1. Every other decision keeps its status; no further approval is inferred; the accepted COSMOS visual and interaction experience stays frozen (C-9).

**Change log v1.0 → v1.1.** The PO's message "COSMOS-INT-01 — PO Decisions: First Batch of Approvals" is applied verbatim to the eight entries it names (§1.1), and to every section that depended on them: §3.8 (Skia 2.7.0 direction), §4.1 S8, §4.2 P8 / P9, §4.3 T12, §4.6 C4 / C6, §5 (package.json, PR dispositions, fringe), §6.1, §6.3 Personal, §6.4, §7 (fringe), §8 R1 / R3 / R5 / R7, §9 Slice B, §10 (the eight entries marked APPROVED; the rest PENDING; the Slice B blockers listed in §10.3), new §11 (the QAN-INF-03 path for RN Skia 2.7.0, with the exact tests) and new §12 (follow-on items recorded, not authorised). Every other decision and gap keeps its PENDING status; no further approval is inferred. The PO-accepted COSMOS visual and interaction experience stays frozen.
**Change log v1.1 → v1.2.** The PO's Slice B entry message is applied: D-2 (STAGE composition inside the ONE surface, no functionality lost), D-14 (the RN Skia 2.7.0 QAN-INF-03 amendment as a separately reviewable commit), D-9 (double-tap = one canonical step IN at the point), D-10 (proof tooling isolated, never in the release build), G-6 (EMERGING_FOCUS in the Personal stage) are marked APPROVED in §10 / §10.3; §13 records what Slice B delivered, the decisions engineering took inside that scope (B-1 … B-12, for the PO), the T-10 conflict audit (D-5), the #391 / #392 / #393 preservation check (D-1), the re-anchor register, the six Copy Gate rows (PROPOSED) and the verification. Every other decision keeps its status; no further approval is inferred. The accepted COSMOS visual and interaction experience stays frozen.

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

### 1.1 First batch of PO decisions (2026-11-15; recorded in v1.1; these supersede any conflicting v1.0 recommendation)

| ID | PO decision (binding text, abridged only where marked) | Applied in |
|---|---|---|
| D-11 | APPROVED (Claude's recommendation): the host's top band stays visible while the detail sheet is expanded; the sheet occupies the remaining usable application area beneath it. | §6.1 |
| D-12 | APPROVED: preserve inspection on sheet dismissal. Closing or collapsing the sheet is presentation-only; it must not automatically execute `backOneStep`, clear `IF_ref`, move the camera, or discard the selected context. A deliberate Back navigation action remains separate and retains its canonical meaning. | §4.6 C4 / C6, §6.4 |
| G-7 | APPROVED (recommended V1 scope): Personal detail uses the existing PEEK, the authorised Conversation entry and the available Replay entry. The new full Personal detail surface is deferred to a clearly recorded follow-on item; nothing is fabricated or claimed implemented. | §6.3, §12 |
| G-2 | APPROVED: remove the proof-only "not yet placed" count and its text from the production screen; entity data, disclosure and placement rules unchanged. | §4.3 T12, §7, §5 |
| D-13 | APPROVED: preserve the tested RN Skia 2.7.0 direction; do not silently downgrade COSMOS to 2.6.2. Document the controlled QAN-INF-03 compliance and contract-amendment path (Expo exception, exact tests). This does not authorise bypassing dependency gates or merging the version change without validation. | §3.8, §8 R3, §11 |
| G-5 | APPROVED: temporary Replay coexistence only — the old Replay renderer may remain during staged integration; not a permanent visual decision. Record an explicit follow-on path to render Replay with COSMOS, preserving Replay's authority, temporal truth and media contracts. Do not start Replay implementation yet. | §4.1 S8, §8 R7, §12 |
| D-1 | APPROVED: controlled authority port with PR preservation — port the necessary CA-Z1 / CA-O1 / CA-O2 authority and camera behaviour through separately reviewable changes rather than bringing unnecessary old-renderer paint into the integration. Do not close, merge or label PRs #391 / #392 / #393 fully superseded before verifying preservation of their functional and contractual decisions and receiving explicit PO approval. | §8 R1, §5, §9 Slice B |
| D-5 | APPROVED, conditional on functional preservation: the accepted COSMOS motion and settle take precedence. Preserve any necessary T-10 meaning, navigation causality, disclosure, return or accessibility functionality; if a conflict exists, identify it before altering the accepted COSMOS motion. Do not reintroduce old animation merely for visual similarity. | §4.2 P8 / P9, §8 R5, §9 Slice B |

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
- **D-13 (PO, v1.1):** the integration preserves the tested **RN Skia 2.7.0** direction; COSMOS is not downgraded to 2.6.2. 2.7.0 enters the product only through the controlled QAN-INF-03 path of §11: a declared `expo.install.exclude` exception for `@shopify/react-native-skia` beside the existing `typescript` one, with every pinning contract re-anchored by name, the offline `deps:check:mobile` + `doctor:mobile` gate still mandatory and still passing, and the native-impact CI rebuilt. Slice B's Draft PR carries that amendment as its own reviewable commit (the vehicle is decision D-14, §10.3); no dependency gate is bypassed and the version change is not merged without validation. The `WorldMarks` R2 clip work-around for a 2.6.2 save / restore bug is old-renderer code and retires with it.

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
| S8 | Replay passage: the Personal map AT A MOMENT under the player | `ReplayMomentComposite` → `MapSurface` | The composite draws T-04's map at the historical viewpoint | **G-5 APPROVED (temporary coexistence only):** not migrated in Slices B–D; keeps `FRAMED` + the old renderer during the staged integration. Not a permanent visual decision: the follow-on "Replay on COSMOS" path is recorded in §12 (Replay's authority, temporal truth and media contracts preserved); no Replay implementation starts in this task | COEXIST (temporary) | Replay contract tests pin `MapSurface` and stay green unchanged | S7-03 / S7-04 |
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
| P8 | Journey (T-07) and composite spatial cause (T-10 / T-12): `observeAct`, `spatialCause.arm/take`, `witness` | `LivingAnalysisMap` callbacks | Arrival choreography and exact-return origin | The owner reports every act outcome to the host's `observeMapOutcome` / `observeReturnOutcome` unchanged (the journey and the exact-return origin are T-07 facts, kept); `takeSpatialCause` is still asked once at the settle so the binding is consumed, never borrowed. **D-5 APPROVED (conditional):** the COSMOS settle is the presentation; before any T-10 plan is replaced, Slice B runs a T-10 conflict audit (each T-10 meaning — travel cause, arrival, cut vs motion, reduced motion, the accessibility announcements — checked for a functional dependency; any conflict is reported to the PO before the accepted COSMOS motion is altered). No old animation is reintroduced for visual similarity | RECONNECT (function) / ADAPT (presentation) | `t10-motion` contract re-anchored only for the presentation plan; functional assertions (cause consumption, journey, reduced motion) stay | T-10 (frozen motion) — D-5 approved with the preservation condition |
| P9 | Disclosure arrival (new objects "resolve" from their host) | `motion/presence/DisclosureArrival`, `newlyDisclosed` | Objects arriving in `V` animate from their host | Not in COSMOS (entities appear with the stage). The MEANING (a membership transition in the authoritative scene, distinct from viewport entry) is kept as a record (`newlyDisclosed` keys), available to the accessible tree and to any later presentation; the old choreography is not reintroduced | ADAPT (D-5) | part of the Slice B T-10 conflict audit | T-10 — D-5 |
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
| T12 | Fringe: "not yet placed" count | `list.fringe` (COSMOS) from the Personal scene | **G-2 APPROVED: removed from the production screen** (the count and its text); `list.fringe` stays an internal stage fact, and no entity datum, disclosure or placement rule changes | — |
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
| C4 | Top Back | `back()` = leave overview → authority Back → at rung 0 with a pan, `goTo(0,0)` | Hierarchical order (§6.4): collapse the sheet (presentation only, D-12) → leave the overview → the canonical Back (`backOneStep` / `controller.back()`, which is what releases an inspection or a focus) → `returnWorld` (Personal) / pan home (fields). Label words from T-08 | ADAPT |
| C5 | Bottom timeline rail (`PositionTicks`) | Ticks 1..LH, lit ≤ TC, gold dot at TC, "Live" / "Position a of b", fringe; tap = `commitMoment`; "Live" = `commitLiveEdge`; hidden while the card is open | Same look; function = the T-05 / T-06 / T-08 contract (§7); the fringe text removed (G-2) | ADAPT |
| C6 | Card (fixed peek 156 pt) | Title / meta / lines from the owner; close = Back (the proof's close releases the focus / inspection); `liftsFocus` moves the presentation focus up (fields) | Becomes the detail sheet's PEEK state (§6). **D-12:** closing the sheet is presentation-only — the inspection / focus, the canonical camera and the selected context survive; the proof's "close = Back" is NOT carried. The lift is released as presentation only (no canonical camera write) | ADAPT |
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
| `apps/mobile/package.json`, `package-lock.json` | A (D-13) | RN Skia 2.6.2 → 2.7.0 and `@shopify/react-native-skia` in `expo.install.exclude`, as one separately reviewable commit carrying the QAN-INF-03 amendment of §11 (every pin re-anchored by name, the offline gate still mandatory). No other new dependency (no sheet library). |

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
| EXPANDED | **D-11 APPROVED:** the host's top band stays visible; the sheet occupies the remaining usable application area beneath it (status bar and band excluded; safe-area and keyboard insets applied) | mounted, not visible, not interactive (`pointerEvents="none"`, hidden from a11y), its camera untouched | the complete authorised detail, scrolling, text input |

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
| Personal | family word (Thread / Reading), the T-08 inspection statement and lineage, acts: switch context, go to place (direct jump), exact return, **"Open the conversation"** (= the authorised `cross('CONVERSATION')`) and **the Replay entry** (= the existing `ReplayAnalysisEntry` act, `player.openLatest()`), where each is available | **G-7 APPROVED (V1 scope): no EXPANDED state for Personal in this task.** The PEEK is the Personal detail; no content is fabricated and no full detail is claimed | `inspectObject`, `switchContext`, `directJump`, `orientationModel`, `cross`, `player.openLatest()` | the full Personal detail surface (Thread / Reading / Session content, linked conversation at the moment, analysis, original recording) is deferred to the follow-on item recorded in §12 (PERSONAL-DETAIL-01 candidate); it needs a product contract and is not authorised here |

### 6.4 Back / sheet / world precedence (one ordered list, used by every world)

1. EXPANDED sheet → PEEK (presentation only).
2. PEEK → CLOSED (**D-12 APPROVED: presentation only, in every world**): no `backOneStep`, no `IF_ref` clear, no `controller.back()`, no canonical camera write; the inspection (Personal) or the focus (fields) and the selected context survive, and the field's presentation lift is released without a canonical act. A tap on the still-focused node, or the chrome's detail affordance, re-opens the PEEK. A deliberate Back (the top control or the hardware key, steps 4–6) keeps its canonical meaning and is what releases an inspection or a focus.
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
| Fringe "not yet placed" (proof) | removed from the production screen (G-2 APPROVED) | — |
| Hidden while the card is open (proof) | the rail hides under the PEEK sheet; EXPANDED covers it | — |

What is explicitly NOT done: no Shared / Public rail (SHARED-VIS-01 D5; QAN-BL-CW-07 stays open and unassigned), no decorative ticks that are not Moments, no second temporal cursor.

---

## 8. Dependency, PR and worktree risk map

| # | Dependency / risk | Fact | Consequence | Handling |
|---|---|---|---|---|
| R1 | COSMOS's base is the #393 chain (`a06181b0`), not `main` | §2.1; hard dependency on CA-Z1 (`9edb41fd`) for the focal step | The integration branch cannot sit on `main` and run the proof's owners unchanged | **D-1 APPROVED (controlled authority port with PR preservation):** the integration branch stays on `main`; the necessary CA-Z1 / CA-O1 / CA-O2 authority and camera behaviour (the `focal` argument on `zoomSemanticStep`, the field controllers' `step(dir, focal)`, the steady envelope, the chrome anchor rule) is ported from `9edb41fd` as separately reviewable commits, each citing the PO's approval of 2026-11-14 recorded in the V3 record on `map/map-perf-01-production`, with their tests. No old-renderer paint from #391 / #392 / #393 enters the integration. **PRs #391 / #392 / #393 are not closed, merged or labelled superseded**: Slice B's report includes a preservation check of each PR's functional and contractual decisions (which are carried by the port or by the STAGE presentation — e.g. #392's transparent bands and continuous world — and which are not, e.g. #392's `details` toggle, #391 / #393 paint), and the PRs' disposition is the PO's explicit decision after that check. |
| R2 | The CA-Z1 / CA-O1 / CA-O2 / MAP-PERF-01 records exist only on unmerged branches | governance audit | On `main` the focal-step authority is unrecorded | Whichever D-1 path, the record that lands with Slice B must carry the CA-Z1 decision text (from the V3 record on `map/map-perf-01-production`). |
| R3 | RN Skia 2.6.2 is pinned in 7 root contracts (11 assertions) and the lockfile; `expo.install.exclude` is asserted as exactly `['typescript']`; the CI step is found by its exact name; QAN-INF-03 runs `deps:check` + `doctor` offline | §11 lists every pin by file and line | 2.7.0 cannot enter without the declared re-anchors and the offline gate still passing | **D-13 APPROVED:** keep the tested 2.7.0 direction; the controlled QAN-INF-03 path of §11 is the only way in (the exception, the exact tests, the CI step name, the README, the lockfile; native-impact CI rebuilt). Carried as its own commit in Slice B's Draft PR (D-14); not merged without validation; no gate bypassed. |
| R4 | 15 root contract tests + 2 goldens pin the old renderer / surface | §2.3 | Slice B will break pins by design | First step of Slice B: run the full root suite on the branch, list every failure, re-anchor each with its reason; none weakened; the `living-analysis-map-runtime` allowlist (Skia, react, RN, RNGH, runtime types) must learn `react-native-reanimated` / `react-native-worklets` for the COSMOS host (they are already production deps used by `temporal-navigation` and `motion`). |
| R5 | T-10 motion (frozen) describes the presentation camera's travel / arrival plans for the Personal map; COSMOS replaces them with its settle | §4.2 P8 / P9 | A frozen contract's presentation is superseded | **D-5 APPROVED, conditional:** the COSMOS motion takes precedence; Slice B's T-10 conflict audit lists every T-10 meaning (cause, arrival, cut vs motion, reduced motion, announcements, return causality, disclosure) with its disposition (kept as function / presentation replaced); any conflict is brought to the PO before the accepted motion is altered; the controlled amendment is recorded with Slice B. No old animation reintroduced for similarity. |
| R6 | VPORT-01 / LA-VIS-01 / SHARED-VIS-01 visual chain = CURRENT PRODUCTION in the Visual Source Registry; Step 3 "not authorized"; V-3 "not opened" on `main` | governance audit | COSMOS supersedes the recorded visual chain | **D-6**: the registry gets a new category / entry for COSMOS (the accepted HONOR captures as its source, with hashes), and the chain is marked superseded on merge. |
| R7 | Replay composite still draws with the old renderer | §4.1 S8 | Two renderers in the product during the staged integration | **G-5 APPROVED (temporary coexistence only):** the old renderer stays for Replay in Slices B–E and is not deleted; the follow-on "Replay on COSMOS" path is recorded in §12 and not started. |
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
| **B** COSMOS renderer inside the real product | Commit 1: the D-1 authority port (CA-Z1 / CA-O1 / CA-O2 behaviour + tests, cited to the PO's 2026-11-14 approval). Commit 2: the D-13 RN Skia 2.7.0 amendment (§11). Then: `cosmos/product/owners/*` over the real runtime / controllers; `CosmosWorldView`; STAGE presentation; the three hosts render COSMOS; proof-only UI, probe, overdraw, fixtures, faults, language toggle, `gc` links and the fringe count (G-2) absent from the product bundle; the three pinch rules + tests; the T-10 conflict audit (D-5) in the report; the #391 / #392 / #393 preservation check (D-1) in the report | (1) each world draws its own server-authoritative data in the app (real sign-in on the HONOR, Personal session; a real Shared World; the Public field); (2) one canonical act per gesture (store / controller logs); (3) refusals ease back; (4) no fixture, fault or measurement symbol reachable from `ProductRoot` (static grep + bundle check); (5) opening speed and 60 fps on the HONOR not worse than the proof's rounds, on 2.7.0; (6) memory not re-measured (021); (7) the offline QAN-INF-03 gate passes with the declared exception; (8) the T-10 audit and the PR preservation check are in the report with no silent disposition | headless: owners (ported `proof-owners`), `pinch-focus`, `proof-root-pinch` re-targeted, cosmos core / worklet parity / headless pixels; mobile suites green; root `tests/*.mjs` green after the declared re-anchors of §5 and §11; `tsc`, `eslint`; CI mobile incl. the QAN-INF-03 step (renamed per §11) and the native-impact rebuild |
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
| G-2 | "Not yet placed" count under the rail | It is a COSMOS fact (entities without a held rung placement), not a recorded product fact | **APPROVED (PO, v1.1): removed from the production UI; data, disclosure and placement rules untouched.** |
| G-3 | Shared: navigate from a source (material) to its place in the conversation | No act exists (`loadOlder` only); would need a "scroll to material" contract and possibly a server cursor | PENDING. Recommendation: record as a new backlog item (QAN-BL-CW-08 candidate); the sheet offers "Open the conversation" only. |
| G-4 | Public contribution in production: the entitlement seam answers NOT_EVALUATED (Stage 9 / CW2-08), so the composer is absent | Server-side; not this task | PENDING (statement only). The client is correct as is. |
| G-5 | Replay composite renderer | Two renderers in the product during the staged integration | **APPROVED (PO, v1.1): temporary coexistence only; the "Replay on COSMOS" follow-on path is recorded in §12; Replay implementation does not start.** |
| G-6 | EMERGING_FOCUS family in the Personal stage | `personalScene` emits THREAD / READING hits only; the old map inspects EMERGING_FOCUS too | **APPROVED (PO, Slice B entry):** the family is in the Personal stage with hit testing and the existing T-08 family word, no new look (§13; an emerging focus disclosed with no place is listed unplaced and stays inspectable). |
| G-7 | Personal expanded detail content | No Thread / Reading / Session content surface exists in the product; the PO's requirement names "full conversation, session, analysis and any available original recording" | **APPROVED (PO, v1.1): V1 = the PEEK with the authorised Conversation entry and the available Replay entry; the full Personal detail surface is the follow-on item of §12 (PERSONAL-DETAIL-01 candidate); nothing fabricated or claimed implemented.** |
| G-8 | Public "permitted audio / voice media" | Public is the text path only; VOICE_REPLY belongs to QAN-BL-VOICE-01 | None in this task; recorded. |
| G-9 | Projection reads per viewpoint: the proof asks for all five Personal rungs at every viewpoint (so the rail / overview can hold them); the product reads the viewpoint + the track rung (+ adjacent rungs after CA-Z1's prefetch) | More server reads per temporal commit | Read the viewpoint + track rung first, the other rungs lazily on the first settle; measure the count in Slice B. |

Decisions (D-x). APPROVED = the PO's first batch (v1.1, §1.1); PENDING = still the PO's to make; the recommendation is kept for the pending ones only.

| ID | Decision | Status / recommendation |
|---|---|---|
| D-1 | Base of the integration branch (R1) | **APPROVED (PO):** controlled authority port of CA-Z1 / CA-O1 / CA-O2 through separately reviewable changes; no old-renderer paint; PRs #391 / #392 / #393 not closed, merged or labelled superseded before a preservation check and explicit PO approval. |
| D-2 | Screen composition: STAGE presentation inside the ONE surface; #392's `details` toggle not ported | **APPROVED (PO, Slice B entry):** the stage composes inside the ONE surface; the old support band / #392 details toggle need not be reproduced provided no existing product functionality is lost. Applied in §13 (the band stays as the carrier of the Timeline / chrome function until Slice C, drawn as glass over the stage). |
| D-3 | Placement of the six return acts and the inspection orientation in the COSMOS chrome (§4.2 P6 / P7) | PENDING (Slice C) — **now bound by §14 C-3 / C-4 (PO direction, 2026-11-15)**. Recommendation: Back = BACK_ONE_STEP / EXACT_RETURN; the rail's Live mark = the three Live acts; RETURN_WORLD = the canonical act behind "Whole world" at the top rung (Overview stays presentation-only); the inspection statement + lineage + context acts = the sheet's PEEK. |
| D-4 | Increased contrast: #392 switches the continuous world off; COSMOS has no "framed" look | PENDING (not blocking: Slice B keeps the stage under increased contrast until decided). Recommendation: keep the stage; raise the chrome's contrast only. |
| D-5 | T-10 motion for the Personal map superseded by the COSMOS settle (controlled amendment) | **APPROVED (PO), conditional on functional preservation:** the T-10 conflict audit precedes any alteration of the accepted motion; no old animation for similarity. |
| D-6 | Visual Source Registry entry for COSMOS; the VPORT-01 → S8B-06 F-G chain marked superseded on merge | PENDING (needed at merge, not for Slice B). Recommendation: yes, with the accepted HONOR captures as the source (hashes recorded). |
| D-7 | The rail's ticks / dot replace the Temporal Spine + Aperture (P2 C) drawing for the Personal map | PENDING (Slice C) — **now bound by §14 C-1 / C-2 / C-9 (PO direction, 2026-11-15): the exact approved rail, functions reconnected, no redesign**. Recommendation: yes (the PO froze the rail's look). |
| D-8 | Public: section list / search results / section-near shown in the sheet's PEEK when no Experience is focused (instead of the chrome band) | PENDING (Slice D). Recommendation: yes. |
| D-9 | Keep the proof's double-tap = one step IN at the point | **APPROVED (PO, Slice B entry):** one canonical zoom-IN step at the tapped point. |
| D-10 | Keep a measurement build path (proof root) for future device measurement | **APPROVED (PO, Slice B entry):** proof tooling isolated under `cosmos/__validation__` / `cosmos/__tests__`; no proof UI, synthetic fixtures, measurement controls or production-scheme collisions in the release build (§13.5). |
| D-11 | EXPANDED sheet: the host's top band stays visible | **APPROVED (PO):** the sheet occupies the remaining usable area beneath the band. |
| D-12 | Closing the sheet and the inspection / focus | **APPROVED (PO):** closing / collapsing is presentation-only (no `backOneStep`, no `IF_ref` clear, no camera move, no context discard); a deliberate Back keeps its canonical meaning. |
| D-13 | RN Skia 2.7.0 | **APPROVED (PO):** the tested 2.7.0 direction is preserved; the QAN-INF-03 compliance and amendment path is §11; no gate bypassed, no merge without validation. |
| D-14 | The vehicle for the QAN-INF-03 amendment (new, from D-13) | **APPROVED (PO, Slice B entry):** Slice B's Draft PR carries the RN Skia 2.7.0 + QAN-INF-03 amendment as its own separately reviewable commit (ba4741a8); no gate bypassed or weakened; no silent downgrade. |

### 10.3 What still blocks Slice B (and nothing else)

**v1.2: all five were answered by the PO (APPROVED, Slice B entry) and Slice B was delivered (§13).** Kept as written for provenance. Only these five need an answer before Slice B starts; every other pending item belongs to Slice C or D, to the merge, or is a statement.

| ID | Question | Recommendation (one line) |
|---|---|---|
| D-2 | Is the STAGE presentation inside the ONE surface (world fills the surface under the top band, no support band, chrome overlaid; #392's `details` toggle not ported) the production composition? | Yes — it is the composition the PO accepted on the HONOR. |
| D-14 | May Slice B's Draft PR carry the RN Skia 2.7.0 QAN-INF-03 amendment (§11) as its own commit, for review at Slice B review? | Yes — otherwise Slice B's CI cannot be green on 2.7.0 (D-13). |
| D-9 | Keep double-tap = one canonical step IN at the tapped point (proof behaviour)? | Yes — one act, same authority as the pinch. |
| D-10 | Keep the proof root as a validation-only measurement build (never bundled), or remove the measurement paths entirely? | Keep, validation-only. |
| G-6 | Add the EMERGING_FOCUS family to the Personal stage (hit + the T-08 family word, no new look) so the old map's third inspectable family is not lost? | Yes. |

Not blocking Slice B: D-3, D-7 (Slice C), D-8, G-3 (Slice D), D-4 (default kept until decided), D-6 (merge), G-1 (Slice C), G-4 / G-8 (statements), G-9 (measured inside Slice B; the lazy-rung reading is engineering's call within the one-cache rule).

---

## 11. The QAN-INF-03 path for RN Skia 2.7.0 (D-13; documentation of the controlled route, not its execution)

**Mechanism.** Expo 57 pins `@shopify/react-native-skia` at exactly 2.6.2 in `expo/bundledNativeModules.json`; QAN-INF-03's mandatory CI step runs `npm run deps:check:mobile` and `npm run doctor:mobile` offline (`EXPO_OFFLINE=1`, `EXPO_DOCTOR_ENABLE_DIRECTORY_CHECK=0`) with no `continue-on-error`. The only documented way for 2.7.0 to pass that gate is the mechanism already used for TypeScript: `expo.install.exclude`. The 2.7.0 experiment (`COSMOS_V5_SKIA270_EXPERIMENT_REPORT.md`) proved in the isolated worktree that with `"@shopify/react-native-skia"` added to the exclude list both commands pass offline, that the native build succeeds (RN Skia 2.7.0 = `react-native-skia-android` / `-apple-ios` 150.0.0), that the COSMOS proof and the old-renderer surfaces run on it, and that no contract was changed there.

**The controlled change (one reviewable commit in Slice B, D-14), item by item:**

| # | File | Line(s) on `main` 5a21971d | Change |
|---|---|---|---|
| 1 | `apps/mobile/package.json` | `dependencies['@shopify/react-native-skia']`; `expo.install.exclude` | `2.6.2` → `2.7.0`; exclude `['typescript', '@shopify/react-native-skia']` with the justification comment beside the TypeScript one |
| 2 | `package-lock.json` | `packages['node_modules/@shopify/react-native-skia'].version` (8883), `react-native-skia-android` / `react-native-skia-apple-ios` 147.1.0 (8890–8891), `packages['apps/mobile'].dependencies` | 2.7.0; platform packages 150.0.0 (the experiment's lock delta, reproduced by `npm install` from the manifest, never hand-edited) |
| 3 | `tests/mobile-foundation-toolchain-contract.test.mjs` | 34 (the pinned manifest), 159 (`deepEqual(mobilePackage.expo, { install: { exclude: ['typescript'] } })`) | pin 2.7.0; the exclude assertion becomes the two-entry list, with the second exception's reason asserted (a comment / `why` string), so the exclusion stays intentional and enumerable |
| 4 | `tests/living-analysis-map-runtime-contract.test.mjs` | 193, 195, 196 | 2.7.0 (manifest, lock, lock-workspace) |
| 5 | `tests/durable-thread-home-same-sp-substrate-contract.test.mjs` | 453 (lock), 479 (manifest) | 2.7.0 |
| 6 | `tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs` | 525 (manifest), 563 (lock) | 2.7.0 |
| 7 | `tests/historical-projection-contract.test.mjs` | 311 (manifest), 420 (lock) | 2.7.0 |
| 8 | `tests/mobile-canonical-state-contract.test.mjs` | 207 | 2.7.0 |
| 9 | `tests/return-navigation-layer-contract.test.mjs` | 637 | 2.7.0 |
| 10 | `.github/workflows/mobile-ci.yml` | 175: step `Expo dependency validation (intentional typescript exclusion)` | step renamed `Expo dependency validation (intentional typescript and react-native-skia exclusions)`; command and env unchanged |
| 11 | `tests/qan-inf-03-deterministic-expo-dependency-validation-contract.test.mjs` | 83 (`stepLine(fast, 'Expo dependency validation (intentional typescript exclusion)')`) | the step is found by the new name; the determinism assertions (offline env, no `continue-on-error`, no `\|\|`) unchanged |
| 12 | `apps/mobile/README.md` | 566–573 "Intentional TypeScript exception" | a parallel "Intentional react-native-skia exception" paragraph: why (COSMOS was accepted and proven on 2.7.0; the 2.6.2 save / restore clip bug that `WorldMarks` R2 worked around), what still runs (`deps:check` / `doctor` offline, never skipped), and the return condition (Expo's bundled pin reaching 2.7.0 removes the exception) |
| 13 | `.github/workflows/mobile-expo-dependency-drift-advisory.yml` | — | unchanged (the non-blocking live-registry advisory will report the drift; that is its purpose) |
| 14 | native-impact CI (QAN-INF-04) | — | the Android / iOS builds rebuild on the version change; must be green on the Slice B head |
| 15 | `tests/t10-motion-contract.test.mjs` | 131 (the renderer import allowlist) | not a version pin; unchanged by this item (its allowlist is handled in §5 for the COSMOS host's `react-native-reanimated` / `react-native-worklets` imports) |

**Rules of the change.** The gate is never weakened: both commands keep running offline and must pass; no `continue-on-error`, no `||`, no skipped step. Every pin above is re-anchored with its reason in the assertion message. The commit lands first in Slice B's PR so every later commit is validated on 2.7.0. A record note (the task record §Dependencies) carries the experiment report as evidence, the exception's return condition, and the fact that `iconography/*` and `conversation/visual/Glyph.tsx` (also Skia consumers) run on 2.7.0 as proven by the experiment's device round. Merging the version change into `main` remains part of the integration's merge decision, never earlier.

---

## 12. Follow-on items recorded (not authorised; to be admitted to the backlog under BG-06 / BG-08 at the task's closure)

| Candidate ID | Item | What it preserves | Status |
|---|---|---|---|
| REPLAY-COSMOS-01 | Render the Replay passage's Personal map at a moment with COSMOS, through `ReplayMomentComposite` (the governed projection adapter and viewpoint store unchanged), so the product has one renderer | S7-01 secure integration, S7-03 composite truth (the historical viewpoint, the honest states), S7-04 player navigation, the original-audio / transient-media contracts (`ReplayAudioViews`, presentation map, playback owner); Replay's own spine and moment controls | recorded by G-5 (PO, v1.1); not started; old renderer kept meanwhile |
| PERSONAL-DETAIL-01 | A full Personal detail surface for a Thread / Reading / Session: the linked conversation at the moment, the analysis, the original recording where it exists, reached from the sheet's PEEK | the historical projection's `inspectFamily` / `inspectId` read, the conversation session API, the Replay audio contracts, T-07 return, the no-fabrication rule | recorded by G-7 (PO, v1.1); needs a product contract; not started |
| QAN-BL-CW-08 (candidate) | Shared: navigate from a place's source (material) to its position in the World's conversation | S4-02 conversation, SHARED-VIS-01 D3 visibility | proposed under G-3 (PENDING) |
| QAN-INF-03 amendment record | The react-native-skia exception's standing record (return condition: Expo's bundled pin reaches 2.7.0) | QAN-INF-03 determinism | recorded by D-13; executed in Slice B (D-14 pending) |

---

## 13. Slice B delivery record (v1.2, 2026-11-15)

**Report:** `E:\QANDEEL_REPORTS\COSMOS-V5\integration\COSMOS_INT_01_SLICE_B_REPORT.md` (the full §9 deliverable: capability matrix, T-10 audit, PR preservation check, re-anchor register, Copy Gate rows, verification, device proof). This section is its binding summary in the repository.

### 13.1 Commits on `cosmos/cosmos-production-integration` (base `main` 5a21971d)

| # | Commit | Content |
|---|---|---|
| 1/n | 167f8e6d | D-1 controlled authority port of CA-Z1 / CA-O1 / CA-O2 onto main, with tests; no old-renderer paint |
| 2/n | ba4741a8 | D-13 / D-14: RN Skia 2.7.0 as the second declared QAN-INF-03 exception (§11 executed: manifest, lockfile, every pin re-anchored by name, CI step renamed, README); offline gate mandatory |
| 3/n | 55b77bf5 | The COSMOS V5 sources as frozen by the proof (add-only) |
| 4/n | 5b4bb686 | The frozen sources reach the runtime entry and T-12 through their barrels |
| 5/n | 3c0d0c22 | The PO-accepted proof corrections (pinch about the fingers + Android-lift guard; deep link once), with tests |
| 6/n | 096c1c53 | The production seam: `cosmos/product/*` (owner core, Personal / Shared / Public owners, `CosmosWorldView`, product copy), the STAGE presentation of `LivingAnalysisSurface`, `LivingAnalysisMap` / `SharedLivingAnalysis` / `PublicLivingAnalysis` rendering the stage, `DepthComposition` drift pause while a call is live, additive `CosmosCanvas` props |
| 7/n | 186115f6 | Tests for the seam; the contractual re-anchors (D-2) of the old paint-structure proofs; golden regenerated; root-contract pins |
| 8/n | 6c05af8f | v1.2 (docs only) |
| 9/n | 10b5df6d | The PO's second batch: the rail stays on the right in both languages (override), Copy Gate CLOSED, B-1 / B-11 approved; B-11 headless assertion |
| 9b/n | a7391b1b | The rail test's style helper typed over the test renderer's instance (tsc clean) |
| 10/n | 1baf99d1 | The rail correction completed for every host: the view root pins its layout direction (the Shared / Public Arabic rail label had sat outboard and clipped under native RTL mirroring — found by the HONOR proof of a7391b1b) |
| 11/n | eeed03e4 | The Living Analysis screen golden re-anchored to the rail override (fixture only; the structural diff is exactly the override: 65 beads' conditional, 15 `row-reverse`, 3 Arabic rails `left` → `right`, the root's `direction: 'ltr'` ×13) |
| 12/n | this change | v1.2 §13.9 – §13.10 + §14 (docs only): the second batch, the HONOR proof of 1baf99d1, the PO's Slice C direction |

### 13.2 What is in the product now

- The three worlds (Personal Analysis, Shared field, Public field) are drawn by the ONE COSMOS stage view over the real runtime / controllers: the same acts (`PAN`, `ZOOM_SEMANTIC` with CA-Z1's focal, `INSPECT_OBJECT` through T-04; `controller.step / tapField / focus / back`), the same outcomes to the journey, the same ONE projection cache, the composite spatial cause consumed at each canonical camera change (D-5).
- The STAGE presentation (D-2): the stage fills the surface under the host's top band; the frame reports the glass and takes no touch; the support band (Timeline + T-08 chrome for Personal; the field bands) is drawn as glass over the stage. The `world=` (FRAMED) path is byte-identical, so Replay keeps `MapSurface` (G-5).
- The accepted chrome: right rung rail (left in RTL), Back pill, presentation-only Overview, the nearest-place note; 44-pt press targets; words from the app's locale (T-08 depth / family words reused; six new rows PROPOSED, §13.6).
- G-6: EMERGING_FOCUS is in the Personal stage (unplaced list, inspectable, family word).
- D-10: no proof tab bar, language toggle, fixtures, faults, probe, overdraw, `gc` links or fringe count (G-2) in the product bundle; T-12's barrel guard enumerates the proof's two fixture imports exactly.

### 13.3 Decisions engineering took inside the approved scope (for the PO to confirm or redirect; none inferred as approved)

| ID | Decision |
|---|---|
| B-1 | The stage's Back (Personal) = one canonical `ZOOM_SEMANTIC` OUT; at the WORLD rung away from the origin, one `PAN` home. T-07's history Back keeps its one home in the T-08 Return controls (D-3 remains Slice C's). **APPROVED (PO, 2026-11-15, §13.9).** |
| B-2 | The Personal owner reads the other four rungs once per viewpoint through the ONE cache (idempotent); the viewpoint's own depth stays the composition's read (QAN-BL-MOB-05). G-9 measured: four extra idempotent reads per viewpoint. |
| B-3 | Public search results recede non-results on the stage; a result is activated from the existing compact list (FAR has no stage hit targets). |
| B-4 | Overview is presentation-only, as accepted; its word is a Copy Gate row. |
| B-5 | The timeline rail's FUNCTION is not moved in Slice B: the T-05 / T-06 / T-08 band stays the carrier, drawn as glass over the stage; the accepted rail look is Slice C (D-3 / D-7). |
| B-6 | No detail sheet (Slice D); the Shared / Public panels stay in their hosts' bands. |
| B-7 | Personal keeps T-04's `MapAccessibilityLayer` over the stage (the stage's own marks off: one object is never two nodes); in the fields the stage's marks are accessible only under a screen reader, the step node and the relation nodes always. Headless only (the PO's 2026-11-08 accessibility scope). |
| B-8 | The composite spatial cause is asked with the destination at every canonical camera change and consumed, never played. |
| B-9 | Double-tap = one canonical step IN at the point (D-9), the proof's canvas unchanged. |
| B-10 | Increased contrast keeps the stage (D-4 pending). |
| B-11 | A live call pauses the stage's drift; nothing else of the call path is touched — the map stays interactive (pan, pinch and the other controls). **APPROVED (PO, 2026-11-15, §13.9).** |
| B-12 | Personal marks are named by T-08's family word alone (no N4); Shared / Public labels are the controllers' served labels. |

### 13.4 T-10 conflict audit (D-5) — outcome

No conflict requiring an alteration of the accepted COSMOS motion. Kept as function: the travel-cause binding lifecycle (asked and consumed at each canonical camera change), reduced motion (settle 0 ms, drift off), return causality (same journey callbacks), the composition's "adds no motion of its own" rule, T-04's accessible tree. Presentation replaced by the accepted settle: arrival choreography, the drag corridor / rebase / culling. Not reproduced: the disclosure-arrival animation (P9) — its meaning (membership transition) stays in the authoritative projection and the accessible tree. `tests/t10-motion-contract.test.mjs` passes unchanged (its renderer pins describe `MapSurface`, which Replay still mounts).

### 13.5 PR #391 / #392 / #393 preservation check (D-1) — outcome

Nothing closed, merged or labelled. Carried: #392's continuous world under transparent bands (as the STAGE composition); #393's CA-Z1 / CA-O1 / CA-O2 (ported, commit 1/n); #391's real-data / no-naming rule. Superseded by the accepted COSMOS visuals (paint only): #391's S3-R2 world, #393's candidate F paint, prepared-raster store, Treatment A labels and strata atlas. Superseded by B-2: #393's adjacent-depth prefetch. Not ported: #392's `details` toggle (D-2), #392's increased-contrast switch (D-4 pending), #393's Z-2 rows (they named the old rung chrome). Memory item 021 not reopened. The PRs' disposition is the PO's decision after this check.

### 13.6 Copy Gate (`cosmos/product/copy.ts`, `COSMOS_PRODUCT_COPY_GATE`) — **CLOSED: 6 rows APPROVED (PO, 2026-11-15)**

rungFar «بعيد» / Far · rungMid «متوسط» / Mid · rungNear «قريب» / Near (Shared / Public rail) · nearest «اذهب إلى الأقرب» / Go to the nearest · regionEmpty «لا شيء في هذه المنطقة.» / Nothing in this region. · overview «نظرة عامة» / Overview — all six APPROVED exactly as documented here (the PO's message of 2026-11-15); `COSMOS_PRODUCT_COPY_GATE.status` says CLOSED, `proposed` is empty and `approved` lists the six keys. Reused APPROVED words carry no row (T-08 depth and family words, `analysisCopy.moreDetail / lessDetail`, the field labels, the field copies' Back).

### 13.7 Verification (local, on the committed tree)

Mobile jest 292 suites / 3 579 tests, failures = the known Arabic host-locale baseline only (6); root contracts 128 / 128 (forward-safety excluded locally as always); `tsc` 0; `expo lint` 0 errors. The QAN-INF-03 offline gate and the device proof are in the report §10 / §12; CI (mobile incl. the renamed QAN-INF-03 step, native-impact rebuild on 2.7.0) runs on the Draft PR — **green on head 6c05af8f (10 pass, 2 path-filtered skips).** After the second batch (1baf99d1): jest 292 / 3 581 with 19 failures = the 6 baseline + 13 `living-analysis-screen-golden` cases broken by the rail override, re-anchored in eeed03e4 (15 / 15 twice); root contracts 128 / 128; `tsc` 0; eslint 0 on the changed files. The CI result on the final head is reported in the PR, baseline failures named if any.

### 13.8 Gaps and open items carried out of Slice B

- Acceptance criterion (1) "real sign-in on the HONOR": no hosted backend exists (HOSTED-DEPLOY-01 not authorised), so the phone proof runs on the S4-01 proof ENTRY — ProductRoot over the labelled synthetic network under the production clients, controllers and runtime, the vehicle of every previous production map phone check. A genuine-account proof needs a hosted environment the PO provides. Reported, not hidden.
- D-3, D-4, D-7 (Slice C), D-8 and G-3 (Slice D), D-6 (merge) unchanged. G-1 (long histories on the rail) is Slice C's.
- Slice C and the merge are not authorised by this record.

---

### 13.9 The PO's second batch (2026-11-15, "PO Decisions Confirmed + HONOR Device Proof Authorization")

| ID | PO decision (binding text, abridged only where marked) | Applied |
|---|---|---|
| B-1 | APPROVED: keep the COSMOS Back as implemented — one semantic zoom level OUT per press, with the existing WORLD-level return-to-centre; QANDEEL's other return-navigation capabilities preserved for Slice C. | no change; §13.3 |
| Rail | **PO OVERRIDE:** the zoom-level rail stays on the RIGHT side of the screen in BOTH Arabic and English; its side is not mirrored in RTL; the accepted visual design, labels, size and interactions preserved. The only newly authorised visual correction. | `CosmosWorldView`: the rail and its line are always right-anchored; the bead keeps the right-rail layout (label inboard, then the dot) in both languages; focused tests (Arabic right + inboard label, English right) in `cosmos-world-view.test.tsx` (10b5df6d, a7391b1b). The HONOR proof of a7391b1b then showed the correction complete in the Personal world but not in the Shared / Public fields (label outboard and clipped; top row flipped) because those hosts run under native RTL mirroring while the Conversation surface pins `ltr`; 1baf99d1 pins the layout direction on the view's own root, so every host renders the one accepted layout (focused test: the root style carries it). The APK was rebuilt from 1baf99d1 before device acceptance (§13.10). |
| B-11 | APPROVED: pause the ambient cosmic drift while a live call is active, protecting live-call performance; the map stays interactive with normal pan, pinch and other controls. | no change; a focused headless assertion added to `s8b-06-cp3-call-composition.test.tsx` (the stage's canvas has `drift={false}` while CONNECTING / ACTIVE and its gesture surface stays mounted) |
| Copy Gate | APPROVED: all six Arabic / English pairs exactly as documented in v1.2 §13.6. | `copy.ts` gate CLOSED (status, `approved`, per-row comments) |

The same message authorised the HONOR device proof of Slice B on the integration APK (not the standalone COSMOS proof APK), with checksum and installed-build verification, and asked for the evidence to be appended to the report and PR #394 (§13.10). Not authorised by it: Slice C, Slice D, any change to the accepted COSMOS artwork, the timeline appearance, the nearest-topic indicator, the Overview, other navigation controls or production authority; any change to PRs #391–#393; any merge.

### 13.10 HONOR device proof (integration APK) — RUN 2026-11-15, acceptance run on commit 1baf99d1

Full record: the report §12 (`E:\QANDEEL_REPORTS\COSMOS-V5\integration\COSMOS_INT_01_SLICE_B_REPORT.md`, evidence `proof/1baf99d1/`). Summary:

- **Build / install:** `apk/cosmosint-1baf99d1.apk`, sha256 `8bc5f674479981cc625777a73d1eaaa4700406b63c9ab45b0d21f085bf68ddd9`, installed on the HONOR (the only device on `adb`) with the file sha = installed `base.apk` sha verified before any evidence; `com.qandeel.mobile.cosmosint`; the S4-01 proof ENTRY over the labelled synthetic network (no hosted backend exists — production controllers driven by synthetic proof transports; **no real-user authentication proof is claimed**).
- **Protocol (all 17 PO items):** opening 245–300 ms cold, door → stage 60.1 fps; visual parity with the accepted captures in all three worlds; stationary pinch, moving-midpoint pinch with the Android lift, OUT refusal at WORLD, sub-threshold settle, double tap (D-9), one-level Back ×3 with the WORLD home (B-1), Overview on / off, nearest-topic navigation; **the rail on the RIGHT in Arabic and English in Personal, Shared and Public with its label inboard and RTL text correct**; Shared / Public FAR → MID → NEAR about an entity with the PEEK panel and Back ×2; no proof-only controls anywhere; frame pacing 59.4–60.1 fps at rest / pan / pinch in every world with 0 stalls > 50 ms; memory +22.8 MB total PSS over 5 Analysis cycles with graphics flat (observation only, item 021 not reopened); the live-call path not executable on this vehicle (no call fixture, no hosted call) — covered headlessly (drift paused, map interactive).
- **Found by the first run (a7391b1b) and fixed before acceptance:** the Shared / Public Arabic rail label clipped (native RTL mirroring doubled the view's own handling; the root now pins `direction: 'ltr'`, 1baf99d1). Not defects (recorded): the Public tab re-entry shows S5-01's pre-authority shell until the (synthetic, link-released) verdict — "a previous ALLOW is never kept as authority"; IN at MID in an empty field region does not step to NEAR (NEAR is about an entity).
- Compared with the proof rounds (60 fps, 250–260 ms) and the old map (pan 21–28 / 11–14 / 7–9 fps): the integrated product performs as the accepted proof did.

---

## 14. Slice C — the Product Owner's mandatory UI direction (2026-11-15; BINDING acceptance requirement; Slice C authorised and started on 2026-11-15 — see §15)

Received during the Slice B HONOR proof ("COSMOS-INT-01 — Mandatory PO UI Direction for Slice C"). Recorded here verbatim in substance as the binding acceptance requirement of Slice C. The same message states that it **does not authorise starting Slice C before the existing Slice B review gate, merging PR #394, or changing unrelated COSMOS visuals** — so nothing below is implemented by this record.

**The PO's finding on the Slice B screen.** The cosmic rendering is accepted, but the current Personal Analysis composition is not the approved final COSMOS experience: the old timeline, the large Return World / Back One Step controls, the explanatory paragraphs and the orientation text consume too much of the screen. The central reason COSMOS was selected is its full-screen cosmic experience, efficient use of space and compact, intelligent navigation controls. The PO does not want the old layout placed transparently over COSMOS; the old layout must be replaced by the accepted COSMOS composition, with its functions reconnected.

**Mandatory requirements for Slice C (C-1 … C-10):**

| ID | Requirement (PO, binding) | Contract cross-reference |
|---|---|---|
| C-1 | Replace the old large timeline UI with the exact PO-approved COSMOS segmented / dashed bottom rail. Preserve its visual design, positioning and compactness. | §7 (function → rail mapping), D-7 |
| C-2 | Connect all existing authorised Personal timeline functions to that rail: historical position, preview, scrub, commit, disclosure horizon and return to the live edge. | §7, T-05 / T-06, G-1 |
| C-3 | Remove the old large text-based navigation blocks and their explanatory paragraphs from the visible Analysis layout. | §4.2 P6 / P7, D-3 |
| C-4 | Expose the necessary return / navigation functions through the approved compact COSMOS controls. Preserve the distinctions between semantic-zoom Back, canonical return-to-world, historical Back and the other T-07 return actions. Do not silently discard functionality. | D-3, B-1 (approved), §4.2 |
| C-5 | Remove unnecessary presentation text such as "0% of display range" and redundant orientation explanations. Keep necessary product meaning accessible through compact, contextual presentation. | §4.2, Copy Gate |
| C-6 | Reclaim the freed screen area for the actual cosmic world. Do not leave invisible spacers or reserve the old support band's height. | §3 (STAGE presentation), B-5 |
| C-7 | Preserve the approved COSMOS top controls, right-side zoom rail, nearest-topic indicator, graphics, animations and corrected pinch behaviour. | §13.9 (rail override), D-9, G-6 |
| C-8 | Keep the zoom-level rail on the RIGHT in both Arabic and English. | §13.9 |
| C-9 | Do not redesign the COSMOS bottom rail or replace it with a variation of the old timeline. | §7, D-7 |
| C-10 | Ensure the final Arabic RTL and English layouts are both balanced, responsive and visually consistent. | §13.10 (the Slice B ar / en captures) |

**Acceptance criterion (PO):** the Personal Analysis screen must look and feel like the previously approved full-screen COSMOS proof, not like the old QANDEEL map UI with COSMOS graphics behind it. Slice C's delivery must include **before / after HONOR screenshots demonstrating the reclaimed screen area**; the "before" set is the Slice B proof of §13.10 (`proof/a7391b1b/personal-ar-01-analysis.png`, `en-01-analysis.png` and their siblings), taken on the integration APK before any Slice C change.

**Consequences for the pending decisions.** D-3 (placement of the return acts), D-7 (the rail replaces the Temporal Spine + Aperture drawing) and G-1 (long histories on the rail) are now constrained by C-1 … C-10 rather than open to the recommendations of §10; the recommendations stay as provenance. B-5 (the band stays the carrier in Slice B) is confirmed as a Slice B-only state. Slice C still needs the PO's explicit start authorisation after the Slice B review gate.

---

## 15. Slice C — implementation plan and functional migration matrix (v1.3, 2026-11-15; PO: "Slice B Accepted, Start Slice C")

### 15.1 Authorisation, scope and the branch

The Product Owner accepted Slice B and authorised **Slice C — Approved COSMOS Chrome, Timeline and Navigation Integration** (2026-11-15). The authorisation does not permit merging PR #394 into `main`, does not begin Slice D (the detail sheet, §6), does not reopen the visual design (C-9), does not reopen Future Improvements item 021 and does not touch PRs #391 / #392 / #393. The binding direction is §14 C-1 … C-10 over §7's function → rail mapping; §10's D-3 / D-7 / G-1 recommendations are provenance only.

Slice C is implemented as a separately reviewable continuation of the Slice B head: branch `cosmos/cosmos-int-01-slice-c` from `48e88a70` (the Slice B head of PR #394), delivered as a dependent Draft PR whose base is `cosmos/cosmos-production-integration`. The worktree is `E:\cosmosint`; `E:\cosmosv5` and the map worktrees are untouched.

### 15.2 The plan (what is built, in order)

1. **The rail** — `cosmos/product/chrome/CosmosTimelineRail.tsx` (+ `useRailScrub.ts`): the accepted segmented bottom rail (`PositionTicks` of the proof, byte-for-byte styles: `left/right 18`, row height 44, 1 × 9 hairline segments, 1 × 13 gold-dim lit segments, the 7 × 7 gold dot, the 11-pt quiet words row, `bottom = inset + 12`) over T-05's presentation controller, T-06's preview controller and T-06's scrub coordinator. Its segments are the DISCLOSED Moments of the presentation window; its gesture is T-06's one interaction (tap previews and commits, drag previews each step and commits on release, every other ending cancels), reached through `createScrubCoordinator` / `createScrubForwarder` with the rail's own segment-pitch geometry; its gold dot and its preview ring are driven by `useTemporalMotion` (D-7); its Live mark is outboard, with T-06's words; the T-08 line stands directly above it; the T-05 and T-06 navigators are mounted beside it headless. No file is added under `temporal-navigation/` or `timeline/` (their production censuses are contract-pinned); nothing of T-05 / T-06 / T-07 / T-08 is edited.
2. **The reclaimed area** — the Personal composition stops bringing a `timeline` and a `chrome` to the ONE Living Analysis surface. Under the surface's own frozen rules (S5-03B R1 `CHROME_ONLY`; SHARED-VIS-01 Option 1: "the band is what the chrome needs — never less than the bottom safe area it sits on") a world with no temporal track and a chrome that measures nothing gets a support band exactly the height of the bottom safe area and no gap. The STAGE's glass therefore has the safe area as its bottom inset, the stage occupies everything above the top band, and no reserved height, spacer or transparent block survives (C-6). `LivingAnalysisSurface.tsx` and `responsive/plan.ts` are not edited: the FRAMED presentation (Replay, G-5) stays byte-identical, and the two sha-256 pins on the surface hold.
3. **The stage's host seams** — `CosmosWorldView` gains three optional seams for its host and nothing else changes in it: `rail` (what the host lays along the bottom edge; the G-6 register moves up above it), `acts` (the compact contextual controls, in a row under the top row), and `home` (the canonical act behind the Back chip at the first rung when the host has one; without it the chip pans to the centre as in Slice B — the field worlds).
4. **The compact contextual controls** — `cosmos/product/chrome/CosmosContextualActs.tsx`: T-08's `orientationModel` unchanged, T-07's six executors unchanged, the frozen order unchanged, "absent, never disabled" unchanged, 44-point targets, T-08's own labels and hints as the accessible name and hint — presented as compact glass chips (the label only; the hint is spoken, not drawn). The context chooser (an inspected object that appears in more than one place) is the same chip row.
5. **The Personal composition** — `LivingAnalysisMap.tsx` composes 1–4 over the same runtime, the same observers (`observeMapOutcome`, `observeReturnOutcome`, the journey, the composite spatial cause) and the same owner.
6. **Tests** — focused suites for the rail (segments = disclosed window, tap / drag → preview → commit through T-06, cancel, Live, horizon, windowing, RTL), for the contextual acts (one executor per act, context chips, refusal retirement) and for the view's seams; every affected existing suite and root contract is re-anchored with its justification recorded (§15.5); full mobile typecheck, lint, affected jest; the root contracts.
7. **The device proof** — the integration APK rebuilt from the Slice C head (checksum-guarded install), the Slice B captures of §13.10 as BEFORE, the same protocol as AFTER plus the timeline scenarios (long history, preview, scrub, return to live), Back vs the T-07 acts, frame pacing. Then the Draft PR, the record and the report; stop at the PO's review.

### 15.3 Functional migration matrix — the old timeline and return elements

Every row names the old element, where its function now lives, the binding (unchanged owner), and its status. "REPLACED" keeps the function with a new presentation; "REMOVED" removes presentation whose meaning is said elsewhere or is reserved for Slice D; nothing is REMOVED that is a function.

**A. The old timeline row (`ResponsiveTimelineRow` → `TemporalTargetLayer` → `TimelinePresentation` + the two navigators)**

| Old element (owner) | Function | Slice C presentation | Binding | Status |
|---|---|---|---|---|
| The 48-pt Track of numbered Moment steps (T-05 `TimelinePresentation`) | shows the disclosed Moments | the rail's segments: one per DISCLOSED Moment of the presentation window; the numeral is not drawn (the line above says the position); each segment's accessible name is T-05's own `timelinePoint(n)`, selected when committed | `presentation.getSnapshot().track` (T-05), `temporalTargeting` (T-06) | REPLACED (C-1, §7 row 1) |
| Presentation window: scroll, position rail drag, refine, widen, first / last, the command field (T-05 controller + `PresentationNavigator`) | moves the window over a long track | the rail shows at most `capacity = ⌊width / 8⌋` Moments at once; a track that fits shows every Moment at the accepted pitch; a longer one shows a contiguous window whose START follows T-05's own offset. The "…" discontinuity mark at either end of the window (§7, G-1) is the press that pages the window (`controller.page(±1)`); the window also follows the committed Moment when it leaves the window. Refine / widen / first / last / command: `PresentationNavigator` headless | `createPresentationController` unchanged; the rail sets the controller's viewport to `capacity × TIMELINE_STEP` so T-05's offset / maximum / position are the rail's window, one authority | WINDOWED (G-1: no new decoration; the contract's own "…" becomes a press target — recorded for the PO, §15.6) |
| "0% of the view range" / "٠٪ من نطاق العرض", the helper text, the command field, "Move the timeline view" (T-05 `PresentationNavigator`) | the non-drag route to the window | mounted HEADLESS (a 1 × 1 clipped host that is not hidden from assistive technology); nothing of it is visible | unchanged | REMOVED from the visible screen (C-5); the route is kept |
| The temporal target strip (T-06 `useTemporalScrub`): tap previews + commits, drag previews per step + commits on release, cancellation on interruption, the per-gesture epoch, the geometry generation that retires a live finger | the pointer route to a Moment | the segment row IS the strip. The rail's own hook maps the finger to a segment index (pitch, window start, direction) and hands the index to T-06's coordinator; the epoch, the "one coordinator per store + preview", the forwarder, the retirement, and the geometry generation that interrupts a live finger when the mapping changes are reproduced exactly (three `scheduleOnRN` sites: target index, end, finalize) | `createScrubCoordinator` / `createScrubForwarder` (T-06) decide everything: NOT_DISCLOSED, SESSION_MISMATCH, preview, commit, cancel; `useTemporalScrub` itself is bound to the 48-pt step and T-05's measured FlatList viewport and is not mounted | REPLACED (C-2, §7 row 3) |
| The committed Aperture (P2 C) | where the reader is | the gold 7 × 7 dot, placed and eased by `useTemporalMotion.committedStyle` (the commit acknowledgement included); absent while following Live (T-06: following Live opens no Moment) | `useTemporalMotion` (T-06 / T-10) | REPLACED (D-7) |
| The preview Aperture | what is being looked at | a hollow gold ring at the previewed segment, `useTemporalMotion.cursorStyle` (1:1 under the finger, eases to rest, 0.72 presence) | same | REPLACED (D-7) |
| The Spine notches | the Moments between | the segments themselves (lit up to the committed Moment) | — | REPLACED (D-7) |
| The Live terminal + the outboard Live words «متابعة المحادثة مفعّلة الآن» / «العودة لمتابعة المحادثة» (T-06 `LiveEdgeTarget`) | the one home of Return Live (VPORT-02) | the mark outboard of the last segment and the words at the end of the rail's words row: quiet while following, the gold act while pinned | `commitLiveEdgeIntent` | REPLACED (§7 row "Live edge"); `RETURN_LIVE_HEAD` keeps this one home |
| The temporal orientation line (T-08, VPORT-02) | "Reading at moment N." / the preview sentence / "the conversation has continued" | directly above the rail, the same component | `TemporalOrientationLine` unchanged | KEPT (§7) |
| T-06 `TemporalNavigator`: the summary with its four named actions, exact-Moment entry, "Preview the next moment", "Go to moment n" / "Cancel the temporary look", "Rejoin the conversation" | the non-drag route to every temporal act | mounted HEADLESS beside the rail (the same 1 × 1 host) | unchanged | REMOVED from the visible screen; every route kept |
| The fringe "n not yet placed" (proof) | — | not in the product | — | REMOVED (G-2, Slice B) |
| The row's reserved height (≥ 136 pt + the line) and the band gap | — | 0: the composition brings no timeline | S5-03B R1 `CHROME_ONLY` | REMOVED (C-6) |

**B. The old chrome band (`ResponsiveChromeBand` → `OrientationChrome` → `InspectionOrientation` + `ReturnControls`)**

| Old element (owner) | Function | Slice C presentation | Binding | Status |
|---|---|---|---|---|
| `:spatial` "Showing threads." / «المعروض الآن: الخيوط.» | which rung the camera is on | the right rail's lit rung label (approved); the stage's accessible name `world · rung` | — | REMOVED as text (C-3 / C-5); the meaning is on the rail |
| `:temporal`, `:preview`, `:live` sentences | — | already said once by the line above the rail (VPORT-02) | — | unchanged |
| `InspectionOrientation` `:statement` for a RENDERABLE inspection ("You are inspecting a thread.") | what is inspected | the inspected mark is lit on the stage (Slice B); its accessible name is the family word | — | REMOVED as text; the sheet of Slice D is where the inspection's words will be said (reserved, §6) |
| `:statement` for the technical states ("This moment is not ready to show yet." / "cannot be shown right now." / "Catching up with where you are.") and the stage's own UNAVAILABLE | the Product cannot show this viewpoint | the stage's absence note (the same glass note as the nearest-topic note) says T-08's own sentence for the technical kinds, with the owner's status; no new words | `inspectionSentence` (T-08 copy) | REPLACED (compact, contextual — C-5) |
| `:lineage` "Inside a thread, inside a place." | the disclosed route | not drawn in Slice C | — | DEFERRED to the Slice D sheet (recorded §15.6; it is a sentence, not an act) |
| The context chooser (title, ordering note, one button per appearance) | switch the inspected object's contextual appearance | compact chips in the acts row, one per appearance, with T-08's option labels; the title and the ordering note are the chips' accessible hint | `switchContext` (T-04) unchanged | REPLACED (C-4) |
| `BACK_ONE_STEP` "Back one step" | restore the latest captured viewpoint | a compact chip (label; hint spoken) | `backOneStep` (T-07) | REPLACED (C-4; distinct from the COSMOS semantic Back) |
| `EXACT_RETURN` "Return to the original inspection" | restore the bound inspection exactly | a compact chip; a refused origin is retired exactly as T-08 retires it | `exactReturn` (T-07), `exactReturnTargetFor` (T-08) | REPLACED |
| `RETURN_LIVE_HEAD` "Rejoin the conversation" | follow Live again | the rail's Live mark and words (its one home since VPORT-02) | `returnLiveHead` ≡ `commitLiveEdgeIntent` route as before | unchanged home |
| `RETURN_LIVE_FOCUS` "Move to where attention is now" | locate Live attention once | a compact chip, offered only on the projection-bound answer | `returnLiveFocus` (T-07) | REPLACED |
| `RETURN_WORLD` "Return to the whole world" | the canonical World camera at the same Moment | at the first rung, away from the centre, the COSMOS Back chip («العالم كله» / "the whole world") IS this act (it replaces Slice B's pan to the origin); at a deeper rung, when offered, a compact chip | `returnWorld` (T-07) | REPLACED (D-3) |
| `GO_LIVE_AND_LOCATE` "Rejoin the conversation and move there" | go Live and locate once | a compact chip; its conditional promise is its spoken hint | `goLiveAndLocate` (T-07), `liveContext` capability as before | REPLACED |
| The rendered hint under every act | the act's promise, visible | spoken (accessibilityHint), not drawn | — | CHANGED (compactness; recorded for the PO, §15.6) |
| The band's reserved height (≥ 159 pt), its gap, the glass scrim | — | the band is the bottom safe area only (no content, no gap) | SHARED-VIS-01 rule | REMOVED (C-6) |

**C. The COSMOS chrome (unchanged, with one semantic correction)**

| Element | Slice B | Slice C |
|---|---|---|
| Back chip, rung > 0 | one semantic step OUT (`owner.back`) | unchanged |
| Back chip, rung 0 away from the centre | a pan to the origin (`goTo(0, 0)`) | the host's canonical act: Personal `RETURN_WORLD` (T-07, recorded in history, observed by the journey); the fields keep the pan |
| Overview, right rail (RIGHT in both languages), nearest-topic note, double tap, the corrected pinch, drift pause under a live call, the three owners, `direction: 'ltr'` root | — | unchanged (C-7, C-8) |
| The G-6 register | at the bottom edge | above the rail when the host brings one |

### 15.4 What is deliberately not done in Slice C

No Shared / Public rail (SHARED-VIS-01 D5; QAN-BL-CW-07 unassigned). No sheet (Slice D). No edit to T-05, T-06, T-07, T-08, the responsive owner or the ONE surface. No second temporal state: the rail holds no cursor, no window of its own beyond T-05's offset, no clock. No undisclosed Moment is a target (the rail draws nothing beyond the disclosed horizon; the Live mark is not a Moment). No new reader-facing word: every sentence and label on the Personal screen is an already-approved T-05 / T-06 / T-08 / COSMOS word (the Copy Gate stays CLOSED with 0 PROPOSED rows).

### 15.5 Test re-anchors (each with its contractual justification; completed in the Slice C report)

The composition change the PO ordered (C-1, C-3, C-5, C-6) necessarily moves pins that recorded the VPORT-02 / S5-03B composition of the Personal screen: the whole-file sha-256 of `LivingAnalysisMap.tsx` (s7-03, s7-04), the `<TemporalTargetLayer` / `<OrientationChrome` / `line: <TemporalOrientationLine` / `temporalLine="WITH_TIMELINE"` / `returnLiveHome="LIVE_EDGE"` string pins (s5-03b, vport-02), the screen golden (12 cases), the continuity owners list, the T12 composition cases that query the chrome band, and the product-root TECHNICAL-state check. Each is re-anchored to the Slice C composition with this section as its justification, never loosened: the property each pin protects (one copy of each act, 44-pt targets, no disabled affordance, nothing remounted on resize, no Product sentence in the composition) is asserted again on the new elements. No test is weakened to pass.

### 15.6 Recorded for the Product Owner's review (not decisions taken as approved)

1. **G-1 windowing**: the "…" marks the contract already places at the window's ends are the press targets that page the window; no other control or decoration is added. If the PO prefers a visible scroller, it is a Slice C follow-up, not a redesign.
2. **The hint is spoken, not drawn** on the compact chips (T-08 rendered it because the composite's promise is conditional). The conditional promise stays in the accessible hint; nothing is promised in a label that was not promised before.
3. **Following Live shows no gold dot** (T-06: following Live opens no Moment); the Live mark is lit instead. The proof drew the dot at the live head because it had no FOLLOW_LIVE stance.
4. **The lineage sentence** ("Inside a thread, inside a place.") is not drawn until the Slice D sheet.
5. **Headless navigators are structural, NOT PROVEN with assistive technology** (PO scope decision of 2026-11-08: no further TalkBack / VoiceOver proofs).
6. The first layout pass of the Analysis screen measures the empty chrome band once (the surface's own SHARED-VIS-01 rule); the band collapses to the safe area in the same frame sequence as every Shared / Public open does today.

---

## Appendix A — files opened for this contract (main @ `5a21971d`, cosmos @ `d5c45571` + working tree)

`integration/composition/{ProductRoot,DepthComposition,LivingAnalysisMap}.tsx`, `living-analysis/LivingAnalysisSurface.tsx`, `map/renderer/{MapSurface,WorldViewSurface,WorldCanvas,MapCanvas}.tsx`, `map/camera/*`, `map/inspection/map-actions.ts`, `map/accessibility/*`, `orientation-chrome/{index.ts,types.ts,InspectionOrientation.tsx,ReturnControls.tsx}`, `return-navigation/{return-actions,surface}.ts`, `temporal-navigation/timeline-integration/TemporalTargetLayer.tsx`, `temporal-navigation/accessibility/*`, `temporal-navigation/targeting/*`, `timeline/{window/controller.ts,virtualization/TimelinePresentation.tsx,accessibility/*}`, `shared-world/{SharedWorldArea,SharedWorldThread}.tsx`, `shared-world/shared-world-controller.ts`, `shared-world/field/*`, `runtime-entry/{shared-field-api,public-field-api,public-discussion-api}.ts`, `public-world/{PublicWorldArea.tsx,public-world-controller.ts}`, `public-world/field/*`, `replay-composite/ReplayMomentComposite.tsx`, `replay-player/ReplayPlayer.tsx`, `original-audio/index.ts`, `voice-note/index.ts`, `call/*`, `apps/mobile/package.json`, `app.json`, `tests/*.mjs` (grep); `cosmos/core/*`, `cosmos/skia/*`, `cosmos/__validation__/*`, `cosmos/__tests__/*`, `docs/experiments/living-world-cosmic-v5/*`; the PR branches' diffs; `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `docs/qandeel-canonical-backlog-v1.md` and the records cited in §4.
