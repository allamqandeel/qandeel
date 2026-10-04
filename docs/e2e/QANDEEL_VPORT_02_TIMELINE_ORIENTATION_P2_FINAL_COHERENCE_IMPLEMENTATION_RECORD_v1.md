# QANDEEL — VPORT-02 Final Temporal / Orientation / Iconography Production Port + Stage-2 Coherence Closure — Implementation Record v1

**Task:** VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence (Execution Stage 2 — Final Visual Production Port)
**Task Contract:** `QANDEEL_VPORT_02_TASK_CONTRACT_v1.0.md` (Product Owner, supplied at kickoff)
**Baseline:** `04facdaaa17736949f0ce7d82dbbcd1bfa2398a1` — the merge of PR #304 (ROADMAP-REC-01), `origin/main` at kickoff, exactly
**Branch:** `feat/vport-02-temporal-orientation-p2-coherence`
**PR:** [allamqandeel/qandeel#306](https://github.com/allamqandeel/qandeel/pull/306) — **Draft**
**Implementation evidence head:** `c94a96e` (every runtime and test change; the later commits are this record, the backlog
reconciliation and the committed device evidence)
**Status:** **`VPORT-02 READY FOR INDEPENDENT REVIEW — DO NOT MERGE`**. Not merged; Claude does not merge it. It does not
call itself closed: the closure is the Product Owner's after independent review and green CI (§20).

> **The runtime was already real. VPORT-02 added the final production visual / coherence layer over it, made the T-10 camera
> and temporal motion follow Reduce Motion mid-session, and fixed the Stage-2 integration defects the evidence showed.**

---

## 1. Baseline, branch, PR, head

| | |
|---|---|
| Baseline | `04facdaaa17736949f0ce7d82dbbcd1bfa2398a1` |
| Branch | `feat/vport-02-temporal-orientation-p2-coherence`, cut from the baseline exactly |
| Commits | `f3eb742` implementation · `c94a96e` contract, tests, proof harness · then documentation / evidence only |
| PR | #306, Draft |

## 2. Repo Truth Gate

| Check | Result |
|---|---|
| Working tree clean at kickoff | yes |
| `git fetch`; `origin/main` | `04facdaaa17736949f0ce7d82dbbcd1bfa2398a1` — exactly the supplied baseline; no newer `main` |
| Branch cut from that SHA | yes |
| PR #297 (VPORT-01) | MERGED at `fe9d9155…` |
| PR #304 (ROADMAP-REC-01) | MERGED at `04facdaa…` (the baseline itself) |
| PR #305 (W3-MEGA-S-CLOSE-01) | MERGED at `b1ce9c90…` |
| CI on the baseline | API CI #875 `success`; Mobile CI #443 `success` |

Two host facts, recorded because they affect what "ran locally" means:

- the Windows checkout had `core.autocrlf` converting to CRLF, which makes the byte-pinning contracts fail on untouched
  files. The local checkout was re-normalised to LF (local git configuration only; the tree was clean);
- this machine holds an ignored, locally generated `apps/mobile/android/` project from earlier builds. Every
  "no native project in the tree" check fails on it, on the baseline too. Final verification therefore ran in a **clean git
  worktree** of the exact head (§14), where none of those checks fails.

## 3. Anti-Duplication Gate

Read before coding: `AGENTS.md`, `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md`, the
canonical backlog **in full**; the VPORT-01 record; the P2 closure and the P2-A package (authority, geometry, inventory,
state / motion / accessibility, Spine proof, Call Rail proof, feasibility, `sig.mjs`, `machines.mjs`, the `app.js` Temporal
Spine block, boards and captures); the G3 closure and both G3 amendments, the G2.3 Return amendment; and, in production,
`timeline/`, `temporal-navigation/`, `return-navigation/`, `orientation-chrome/`, `responsive/`, `motion/` (the presentation
camera, `DisclosureArrival`), `conversation/AnalysisReturnBar.tsx` and `conversation/visual/` (W1A's P2 glyph renderer, the
generated tokens, `reduce-motion.ts`), the T-12 composition and the VPORT-01 Map seam.

| Concern | Product / design frozen | Backend / runtime implemented | Production-implemented at baseline | Genuine missing work |
|---|---|---|---|---|
| Timeline / disclosed Track / windowing | T-05 | T-05 model, controller, window, virtualization | yes | ink and type only |
| Targeting, scrub, preview, commit, cancel | T-06 | T-06 state machine | yes | none (consumed) |
| `FOLLOW_LIVE` / `PINNED(t)` / Live Edge | T-06 | kernel | yes | the visible stance (Spine C) |
| Return to Live Head / Live Focus / World; Back One Step; Exact Return | T-07, T-08 | T-07 executors | yes | none (consumed); Return Live's one home (presentation) |
| OrientationChrome | T-08, G2.3, G3 Decision B | T-08 model and copy | yes, **unstyled** | ink, ground, type; the G3 line placement |
| Temporal Spine + Aperture | P2 §7 (C "Parting") | — | **no** (plain 2-pt bars) | the production port |
| P2 navigation glyphs | P2 §5 | — | no Global Switcher exists | none now (§11) |
| P2 utility sourcing | P2 §8 | — | W1A ships the curated back chevron / settings | none |
| Call Rail | P2 §6 (A "Keyed Seam") | **no Voice runtime** (`QAN-BL-VOICE-01`) | no | the visual machine, truth-safe, unmounted |
| Reduce Motion | T-10, F1R2, W3-PDG-01 §6.3 | — | W1A / W3 surfaces live; **T-10 hooks launch-only** | `QAN-BL-A11Y-01` |
| Increase Contrast | F1 | — | W1A `useIncreasedContrast` | reuse it for the chrome |
| RTL / LTR | T-06 one mirror rule, C3 §7.1 | — | yes | apply by layout only |
| Narrow / landscape composition | T-11 + G3 amendments | T-11 plan | yes, but **dark-on-dark** | the ground and ink; the line's yield |
| FAR / MID / NEAR | I-08B1; VPORT-01 §9 | — | VPORT-01 | none — consume only |
| Map / world boundary | I-08B1, VPORT-01 | T-04, T-10 | VPORT-01 | none — untouched |

**Conclusion, as the contract expected:** the runtime was real. The genuine VPORT-02 gap was the final production visual /
coherence layer (Spine C, the Live terminal, the chrome's ink / ground / type, the G3 line placement and Return Live's one
home), the owned mid-session Reduce Motion correction, and the Stage-2 integration defects the evidence showed. One thing
was larger than the contract's wording suggested, and §18 records it as found: the dark-on-dark defect is not a contrast
tweak — **the whole Analysis support chrome painted no ground and no ink at all** (§10).

## 4. Authority precedence used

Repository rule (Project Map §1): later explicit canonical amendments bind; a proof is not a decision. Applied:

1. **P2 closure** for the glyph and machine morphology (Spine C, Call Rail A, N1), by reference to the merged P2-A
   package; its comparison variants are evidence only and were never executed.
2. **G3 closure** Decision A (the Analysis is one dark place) and Decision B with its **T-11 / T-12 controlled amendment**
   (the temporal line belongs to the Timeline; Return Live keeps one home; the yield rule) — later than T-08 / T-11 / T-12
   and binding over them in that named scope.
3. **G2.3 T-11 amendment** («طرق العودة») — a permission, applied only where its own conditions hold (§21).
4. **T-05 … T-10, T-12** for every temporal, return, motion and composition semantic — consumed unchanged.
5. **E1R / F1 / F2** through the already-generated token tree for every ink, state and contrast value.

No conflict required inventing a rule. One presentation question needs the Product Owner's confirmation (§21, D-1).

## 5. Existing runtime reused, exactly

T-05 `TimelinePresentation`, controller, windowing and navigator · T-06 targeting, preview controller, scrub, commit
boundary, `useTemporalMotion` and its plan (two additive presentation fields) · T-07 every executor · T-08 model, copy,
`OrientationChrome`, `ReturnControls`, `InspectionOrientation` · T-10 presentation camera, travel plan, arrival · T-11 plan
(unchanged) and its row / band components · T-12 composition and journey binder · W1A `CANONICAL_VISUAL` tokens, `typeStyle`,
`useIncreasedContrast`, `Control`, the Estedad faces · W3-MEGA-S's live Reduce Motion reader · VPORT-01's world, untouched.

## 6. Files added or modified

**Added**
- `apps/mobile/scripts/generate-p2-production.mjs` → `src/iconography/p2-production.generated.ts` (deterministic, `--check`)
- `src/iconography/` — `TemporalMachine.tsx` (Parting aperture, Live terminal), `spine.ts`, `SpineLayer.tsx`, `CallRail.tsx`, `index.ts`
- `src/analysis-visual/index.ts` — the Analysis ink / ground / type (Dark by construction, F1 increased)
- `src/motion/runtime/reduce-motion.ts` — the ONE live Reduce Motion reader, moved here
- `src/orientation-chrome/TemporalOrientationLine.tsx` — T-08's line for the Timeline region
- tests: `motion/__tests__/reduce-motion-mid-session.test.tsx`, `iconography/__tests__/vport-02-temporal-orientation.test.tsx`,
  root `tests/vport-02-temporal-orientation-p2-contract.test.mjs`
- proof harness (validation only): `__validation__/Vport02ProofRoot.tsx`, `vport02-proof-entry.tsx`,
  `scripts/select-vport02-proof-entry.mjs`, `.maestro/vport-02-*.yaml`, `scripts/vport02/run-vport02-visual-proof.sh`,
  `.github/workflows/vport-02-visual-proof.yml`

**Modified (production)** — `motion/presentation-camera/usePresentationCamera.ts`, `motion/index.ts`,
`temporal-navigation/motion/{temporal-motion,useTemporalMotion}.ts`, `temporal-navigation/timeline-integration/{TemporalTargetLayer.tsx,index.ts}`,
`temporal-navigation/accessibility/TemporalNavigator.tsx`, `timeline/virtualization/TimelinePresentation.tsx`,
`timeline/accessibility/PresentationNavigator.tsx`, `orientation-chrome/{OrientationChrome,ReturnControls,InspectionOrientation}.tsx`,
`orientation-chrome/{model,product-copy,index}.ts`, `responsive/{ResponsiveTimelineRow,ResponsiveChromeBand}.tsx`,
`integration/composition/LivingAnalysisMap.tsx`, `conversation/visual/{reduce-motion.ts,Control.tsx}` (a re-export; one
additive role).

**Modified (tests / CI)** — `jest.setup.js` (Skia stand-in gains `RoundedRect`), `orientation-chrome/__tests__/boundaries.test.tsx`,
`tests/{temporal-navigation-layer,t11-responsive,w3-mega-s-personal-controls-settings,forward-safety}-contract.test.mjs`,
`package.json` (one script), `.github/workflows/mobile-ci.yml` (one step). Each re-anchor is in §14.

## 7. The VPORT-01 world was not redesigned

No file under `src/map/` changed (`git diff 04facda -- apps/mobile/src/map` is empty). The VPORT-02 contract pins the blob of
`MapCanvas.tsx`, `MapSurface.tsx` and all eight `map/visual/` files at their VPORT-01 bytes, and asserts that no chrome,
temporal, timeline or iconography module reads world paint, `useWorldResponse` or any FAR / MID / NEAR quantity. The one
composition change around the world is the Analysis ground under the whole surface (`ResponsiveSurface` background =
`analysis.world` = `#101010`), which the world paints over; no world pixel, membership, hit test or accessible node moved.

## 8. P2 port mapping — frozen source → production

| Frozen P2 material (P2-A package) | How it reaches production | Production consumer |
|---|---|---|
| `SPINE_RECOMMENDED = 'C'`, `STEP = 48`, `RAIL_H = 44` (`machines.mjs`) | imported and asserted by the generator | build refuses otherwise |
| Parting aperture (`app.js` `aperture('C', …)`) | the proof's own `aperture()` and `f2()` **executed** for C only | `Aperture` (committed: 1.5 stroke + 2 × 8 mark; preview: 1.0 stroke, no mark) |
| spine hairline, notch, target notch, discontinuity (`app.js` lines) | each line **source-locked** byte for byte, numbers read from it | `spinePresentation` + `SpineLayer` |
| Live terminal C (`app.js` `drawTerminal`) | line source-locked | `LiveTerminal` (stop bar; present line 3.0 engaged / 1.25 available) |
| settle `1 + 0.09 · settle` | asserted equal to T-06 M2's frozen 0.09 | T-06's own `committedStyle` |
| Call Rail A art, slots, `END_GLYPH_PX = 27` (`machines.mjs`) | `railArt('A')` executed; slot line locked | `CallRail` |
| mic / muted / routeMorph / endCall (`sig.mjs`, N1) | executed at 24 px (End 27 px) | `CallRail` glyphs |

The craft numbers (aperture 34 × 16, notch 6 / 12, terminal line, discontinuity) are emitted under the label "reference
CRAFT values, not Product law" (P2 §7), and nothing promotes them.

## 9. Timeline / Temporal / Return semantics preserved

- **Nothing temporal moved.** `spinePresentation` is told which Moment is committed (only while `PINNED`) and which is
  previewed, and never turns a coordinate into a Moment. The apertures ride T-06's two existing markers, with T-06's
  existing translate rule, motion, clip and testIDs; only the marker's paint changed (a zero-width anchor carrying the
  Parting drawing, `start: -17` — exact in both directions because the drawing is symmetric).
- **`FOLLOW_LIVE` vs `PINNED(t)`.** Following Live opens no Moment: the committed aperture's opacity is 0 and the terminal is
  engaged. `PINNED(t)` opens the spine at `t`. Both come from the committed mode alone (`committedPresent`, beside
  `temporalStance`), so they hold with motion off and under Reduce Motion.
- **`Moment(LH) ≠ Live Edge`.** Committing the newest Moment gives `PINNED(LH)`: the aperture opens, the terminal is
  available and the Live act stays offered (tested).
- **Preview vs commit vs cancel.** The preview opening is lighter (0.72, T-06 M4), unmarked, and never moves committed
  truth; cancel is lossless (tested).
- **48 / 44.** The step, the 44-point strip and its viewport are T-05's and unchanged; the notch for SP n sits at
  `(n − 1)·48 + 24`.
- **F-P2-02.** The Live terminal sits in the strip's row **beside** the strip (a sibling, never a descendant), so no Moment
  in the window can lose a touch to it; T-05's outboard slot was already beside the list. Tested.
- **Return Live's one home.** P2 §7 and the G3 amendment §2 item 5: the Timeline's outboard Live target (which already says
  Return Live's words, «العودة لمتابعة المحادثة» / "Rejoin the conversation", per the W1A Product Owner supersession) is the
  home; on the production route OrientationChrome no longer presents the same act a second time (`returnLiveHome="LIVE_EDGE"`).
  T-08's model, offered set, order, meanings and executors are unchanged; standalone, the chrome is exactly T-08's. See D-1.
- **Exact Return / Back One Step / Live Focus / World** — unchanged, still offered by the chrome.

## 10. OrientationChrome — the dark-on-dark correction

**What the evidence showed.** In VPORT-01's captures the support region below the world shows the *window* background:
light in the standard leg (so the Analysis was not one dark place there either), near-black in the narrow and landscape
legs. The Timeline numerals, the Live words, the T-05 / T-06 navigators, the orientation lines and every Return label and hint
were React Native's default black on top — dark-on-dark.

**Root cause.** None of T-05, T-06 or T-08 set an ink, and nothing set the Analysis ground. T-08 had even asserted "the chrome
paints none" (§14).

**Correction.**
- The Analysis ground under the whole surface: `analysis.world` (`#101010`), independent of the appearance preference
  (G3 Decision A).
- One source of chrome ink and type, `analysis-visual`: the Dark family W1A already generates from the frozen token tree,
  Standard or F1 Increased (rest ink tertiary → secondary, focus 2 → 3 pt). Primary for acts and the line, secondary for
  orientation and hints, tertiary for numerals and the spine, the rest ink for the available terminal; E3 roles in Estedad
  (a role names its face only once the faces are registered).
- E1R PRESSED on the ground (the pressed ink at its 0.1 presence) instead of fading the words (P2 F-P2-06's rule).
- **No new word, no reordering, no icon.** Return acts stay text-led (P2 inventory `TEXT/NO_ICON_REQUIRED`; T-08: "no icon,
  arrow or chevron"); the contract guards it.
- **G3 Decision B** — T-08's temporal line (PINNED: the pinned sentence and, when the conversation continued, its second
  sentence; preview: the preview sentence; following Live: nothing) now stands at the top of the Timeline row, outside its
  scroller, and is "said once": the chrome no longer renders it on the production route. The words are T-08's, joined in
  `product-copy.ts` (`temporalLineSentence`); no sentence was written or changed. The row measures only that line, and the
  chrome band yields exactly that room (amendment §3 rule 3); the world's floor and share are untouched (rule 1).

## 11. Navigation iconography — production mapping

| P2 member | Stage-2 production surface | Disposition |
|---|---|---|
| `depth` (Conversation → Analysis door), `send` | Conversation surface | already production (W1A, generated from `sig.mjs`) |
| back chevron (Hugeicons Free, curated) | `AnalysisReturnBar` | already production (W1A, `utility.mjs`) |
| settings (utility) | General Settings | already production (W3, same generator) |
| Temporal Spine, Aperture, Live terminal | Timeline | **ported here** |
| Call Rail A, mic / muted / route / End | no Live Call surface exists | **ported here as a component**, unmounted (§12) |
| `navMine` / `navShared` / `navPublic` | **none**: no production Global Switcher exists | not ported (contract: no future-stage port); §18 G-14 |
| `replay`, `call`, `play` / `pause` / `stop` | none (Replay, Voice Note, Live Call surfaces absent) | owned by `QAN-BL-NAV-02` / `QAN-BL-VOICE-01` |

No runtime icon package and no `react-native-svg` entered; the renderer is the Skia already installed and already used for
W1A's P2 glyphs and VPORT-01's world (P2 §14 items 2–5 leave the mechanism to implementation).

## 12. Call Rail — production mapping and the Voice anti-scope

`CallRail` draws Rail A from generated geometry: one hairline plate for Mic + Route rounded on its start side and slanted
on its end, the End terminal keyed 7 pt away along the parallel seam, laid out with logical `end` offsets (End [12, 56], Mic
[78, 122], Route [122, 166]) so it sits at the END edge in both scripts; the art mirrors as layout, the glyphs never mirror.
Targets are 44 × 44 through W1A's `Control` (E1R pressed ground, F1 focus perimeter). Mute = the slash **and** a band of
negative space cut through the microphone (`blendMode="clear"` in a layer); Route = body fill **and** the second wave; both
morph by drawing, 180 ms craft, kept under Reduce Motion (a draw is not travel) and pinned to `ReduceMotion.Never` so the
behaviour is the same whichever way the device launched. End Call is the one solid mark, 27 px, primary ink — no red, no
Brass. The toggles are `togglebutton`s with `checked` state and the call owner's action labels.

**Truth boundary.** There is no Voice runtime (`QAN-BL-VOICE-01`). The component is controlled: muted, route (or `null` =
unknown, which removes the route control rather than guessing it), every word and every press belong to the future call
owner. It has **no** input for level, activity, speaking or listening, and none can be added without changing its type; the
contract forbids those words in it. It is mounted on no Product route; the proof renders it only in a validation specimen
labelled as such. Mounting it — with truthful microphone and route state — is `QAN-BL-VOICE-01`'s, unchanged.

## 13. `QAN-BL-A11Y-01` — the correction architecture

- **One owner.** W3-MEGA-S's reader (launch value from Reanimated, then the platform's `reduceMotionChanged`, ONE
  process-wide store and ONE platform listener) moved **unchanged in behaviour** into the T-10 motion owner
  (`motion/runtime/reduce-motion.ts`) — the only place T-10's import closure lets the camera read from. The W1A / W3 path
  (`conversation/visual/reduce-motion.ts`) re-exports it: one store, one listener (contract-asserted: exactly one
  `addEventListener('reduceMotionChanged'` in the app).
- **The hooks.** `usePresentationCamera` and `useTemporalMotion` read `useReduceMotion()`; neither names
  `useReducedMotion` any more.
- **No library second authority.** Every `withTiming` / `withSpring` in both hooks names `ReduceMotion.Never`. Reanimated's
  default (`System`) reads the setting once at launch, so without this a reader who launched with Reduce Motion on and later
  turned it off would still get jumped animations, and the T-06 preview presence fade (which T-06 keeps under Reduce Motion)
  would disappear for launch-time readers only. The plans — already reduced-motion-aware — are now the only authority.
- **Parity is T-10 / T-06's, unchanged:** travel → cut-and-resolve; cursor, cancel and settle → 0 ms; the opacity resolves
  stay; stance, Moments and offered acts identical.
- **Proof.** Mounted with Reduce Motion OFF (full plan; a long travel is `TRAVEL`), the platform signal changed to ON with
  nothing remounted (the same camera now plans `CUT_AND_RESOLVE`; cursor / cancel / settle are 0; preview presence kept;
  stance and Moments unchanged), back OFF (truthful again, same mounted camera), launched-ON-then-OFF, mounted-after-change,
  one listener, no reader left after unmount. On the device: §15, `motion-midsession`.

## 14. Test results

All runs are on this Windows host unless stated; "clean worktree" is a fresh `git worktree` of the exact head with the
repository's own `node_modules`.

| Gate | Result |
|---|---|
| `tsc --noEmit` (mobile) | 0 errors |
| ESLint on every changed / added mobile file | 0 problems |
| `generate-p2-production.mjs --check` | current |
| New: `iconography/__tests__/vport-02-temporal-orientation.test.tsx` | 19 / 19 |
| New: `motion/__tests__/reduce-motion-mid-session.test.tsx` | 3 / 3 |
| Mobile Jest, full | see the addendum below |
| Root contracts, clean worktree at `c94a96e` | every `tests/*-contract.test.mjs` green except the VPORT-02 closure guard, which waited for this record and the backlog by design (it is what refuses a closure claim while `QAN-BL-A11Y-01` is unreconciled); forward-safety's only failures were that same guard inside its mirror |
| New root contract `test:vport-02-temporal-orientation-p2-contract` | 9 tests; green once this record and the backlog landed (§17) |
| PR CI (Mobile CI, API CI) on PR #306 | the PR's check list is the record |

**Pre-existing host failures, not introduced here.** Two suites, `integration/__tests__/depth.test.tsx` and
`integration/__tests__/w2-account-access.test.tsx`, fail 6 tests **on the untouched baseline** on this host (verified by
stashing every change): they resolve the device language to Arabic here. Linux CI is the arbiter.

**Validation drift re-anchored — the permanent claim kept each time.**

| Test | Old anchor | New anchor | Claim kept |
|---|---|---|---|
| T-06 FCR-03 release handoff | `withTiming(…, { duration: cursorMs, easing: EASE_OUT })` | the same + `reduceMotion: NEVER` | the cursor continues from the finger |
| T-06 zero-duration cancel | `{ duration: 0 }` | `{ duration: 0, reduceMotion: NEVER }` | a timing, never a zero-duration spring |
| T-06 FCR-03 marker | `width: MARKER_WIDTH` | `width: 0` (anchor) | same start, inset, height, clip, translate rule |
| T-06 T-05 byte pins | `PresentationNavigator`, `TimelinePresentation` blobs | re-pinned | the permanent claims below the pin, all still asserted; the step style is byte-identical |
| T-06 T-05 import closure | T-05, React, `analysis-language` | + `analysis-visual` | no store, dispatch or temporal authority reaches T-05 |
| T-08 L108 | "the chrome paints no colour" | every colour is a frozen Analysis ink / ground token; no error ink; words still carry every state | colour is never an indicator |
| T-11 measurement owner | 3 measuring files | + `ResponsiveTimelineRow` measuring only the line it places | measurement lives in the responsive owner; nothing reads the display |
| W3-MEGA-S Reduce Motion | listener in `conversation/visual/reduce-motion.ts` | listener in the motion owner; the old path a re-export; the T-10 hooks added to the readers | one live reader, followed mid-session |
| forward-safety T-11 mutation (×2) | anchored on the retired `pressed` opacity | anchored on the `group` style | authorized presentation work breaks no T-08 contract |

**Addendum — full Jest result:** recorded in §14a after the final run.

## 15. Device / visual proof matrix

Workflow `.github/workflows/vport-02-visual-proof.yml` (Release APK whose root is the VPORT-02 proof root — the production
`RuntimePhaseSurface` over the production integration runtime with the VPORT-01 proof world; Android API 36 emulator,
Pixel 7 profile, Maestro 2.10.0). Each temporal leg walks FOLLOW_LIVE → PINNED(6) → preview(3) → PINNED(12 = LH) →
**Return Live by tapping the Live edge** → the world one step in → the Call Rail specimen (live / muted + loudspeaker /
connecting).

Results and committed evidence: §15a (filled from the run).

## 16. Performance notes

- The spine is plain layout: one hairline and one notch per Moment **in the window** (≤ viewport / 48 + 3), re-rendered only
  when the window, the stance or the preview changes — the same renders T-06's layer already made. No per-frame JS work.
- The apertures ride T-06's existing animated styles on the UI runtime; each is one static Skia canvas inside the moving
  view — nothing is regenerated per frame.
- The Track's `renderItem` stays referentially stable across scrolls (the numeral style is memoised and the type styles
  are module-level frozen objects), so windowing behaviour is unchanged.
- The Call Rail is static canvases plus two shared values.
- One extra layout pass when the temporal line appears or disappears (its height reported once).
- Real-hardware frame behaviour is not proven by this PR (as VPORT-01 §12 stated for the world); it is a Release Hardening
  device gate (§18 G-29).

## 17. Backlog reconciliation (BG-05 at kickoff, BG-08 here)

- **Inherited (BG-05):** exactly one — `QAN-BL-A11Y-01` (`HIGH`, `DEFERRED — OWNED`, owner VPORT-02). **Included and
  delivered**: tombstoned in this change (§6 of the backlog; PR #306, evidence head `c94a96e`; holds from merge).
- **Not absorbed (unchanged):** `QAN-BL-VIS-01`, `QAN-BL-VOICE-01`, `QAN-BL-NAV-01`, `QAN-BL-NAV-02`, `OPEN-06/08/09/19`,
  `QAN-BL-SEC-01`, `QAN-BL-CTX-01`, `QAN-BL-CW-01`, `QAN-BL-ACCT-01`, `QAN-BL-LANTERN-01`, `QAN-BL-PROD-04/05`,
  `QAN-BL-LAUNCH-01/02`, `QAN-BL-PRIV-01`.
- **Admitted:** none (§18 shows why each residue does not qualify or is already owned).
- **Counts:** 34 items — 8 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED`, 16 `CLOSED — TOMBSTONE`;
  21 `HIGH`, 12 `MEDIUM`, 1 `LOW` (mechanically from the §4 index).
- `E2E-D-12` (W3) keeps its own residual — Bold Text; its Reduce Motion half is this tombstone.

## 18. Stage-2 Gap Closure Matrix

The sweep ran before coding (the Anti-Duplication reading, §3) and again before this record, over the VPORT-01 record, the
P2 closure §12 / §14, the P2-A docs' gaps, the G3 closure §F / §G, both G3 amendments' implementation-status sections, the
G2.3 amendment, the backlog and the production code. Classes: **1** already closed · **2** already implemented, no work ·
**3** in-scope VPORT-02 gap (fixed here) · **4** owned by an existing backlog item / task · **5** true dependency, named owner
+ Exit Gate · **6** not an obligation.

| # | Candidate | Source | Class | Disposition |
|---|---|---|---|---|
| G-01 | Orientation / temporal chrome dark-on-dark | VPORT-01 §12, §16.3 | 3 | **Fixed** (§10); device-proved (§15) |
| G-02 | Analysis support region showed the window's light ground | VPORT-01 captures; G3 Decision A | 3 | **Fixed** — the Analysis ground |
| G-03 | Reduce Motion launch-only in the T-10 / T-06 hooks | `QAN-BL-A11Y-01` | 3 | **Fixed**, tombstoned (§13, §17) |
| G-04 | Temporal Spine + Aperture C not in production | P2 §14 item 1 | 3 | **Fixed** (§8, §9) |
| G-05 | Live Edge terminal C | P2 §7 | 3 | **Fixed** |
| G-06 | Return Live hit region must not cover the Track | P2 F-P2-02, §14 item 7 | 3 | **Fixed / proved** — terminal beside the strip; tested |
| G-07 | Floating Moment number collides with Live label | P2 F-P2-03 | 1 | closed in P2; production draws none |
| G-08 | 320 pt shows ~5 Moments | P2 F-P2-04 | 6 | accepted T-05 consequence; window / navigators reach the rest |
| G-09 | Temporal line placement + yield rule unimplemented | G3 §F; amendment §7 | 3 | **Fixed** (§10) |
| G-10 | Return Live duplicated (Live edge + chrome) | G3 amendment §2.5; P2 §7 | 3 | **Fixed** (presentation, §9); executor identity → D-1 |
| G-11 | Compact «طرق العودة» grouping | G2.3 amendment §7; G3 §G | 6 | a **permission**, not an obligation; its rule 10 keeps acts directly presented when no Product context names a dominant act, and none does in production; G2.3 §3 forbids inventing the rank → D-2 |
| G-12 | Call Rail A production component | P2 §14 item 1 | 3 | **Fixed** as a truth-safe component (§12) |
| G-13 | Mounting the rail with truthful mic / route state; speaking indicator; audio strip | P2 §11.1; G1.2 §6 | 4 | `QAN-BL-VOICE-01` (no alias). **Exit Gate:** the Voice / Live Call runtime task mounts `CallRail` with its own truthful state and words |
| G-14 | P2 navigation glyphs (`navMine/Shared/Public`) | P2 §5, §14 item 1 | 5 | no production Global Switcher exists. **Owner:** the task that first ships the production Global Switcher (I-08A4 shell realization; in the current map first needed by **Stage 4 — Shared World Product Integration**, the first second World destination). **Exit Gate:** that switcher draws P2's navigation family above the destination words, generated from `sig.mjs` like every P2 glyph here; not admitted (P2 §15: implementation of a frozen design, sequenced by the roadmap) |
| G-15 | Utility glyph sourcing | P2 §8 | 2 | W1A / W3 already curate Hugeicons Free through the generator; no new utility glyph needed |
| G-16 | Replay glyph / surface | P2 inventory §4 | 4 | `QAN-BL-NAV-02` |
| G-17 | Focus-singleton Map expression | VPORT-01 §8 item 5, §16.1 | 6 (outside) | a Map concern awaiting a Product Owner decision; not designed, not admitted (contract §7.1) |
| G-18 | FAR / MID / NEAR mapping | VPORT-01 §9, §16.2 | 2 | consumed only; the chrome shows no distance wording (contract-guarded) |
| G-19 | Increase Contrast on the chrome | P2-A §4; F1 | 3 | **Fixed** — F1 increased family; device leg `ar-increased` |
| G-20 | Large text at 320 pt | G3 §G F-08; amendment §7 | 3 | proved by `ar-narrow-large` (200 %, 320 dp); the densest call state needs a call surface → G-13 |
| G-21 | Heavy-history density / LOD | `QAN-BL-VIS-01` | 4 | unchanged, `OPEN — UNASSIGNED` |
| G-22 | `LocusChoiceSurface` unstyled, one English literal | T-06 | 6 | not mounted on any production route; no canonical document defers it; recorded so it is not lost, not admitted (BG-06) |
| G-23 | T-05 / T-06 navigators visible beneath the Track | T-05, T-06 | 2 | existing accessible routes; ink applied, behaviour unchanged |
| G-24 | Analysis status content / cross-fade | G2 / F2 amendment | 2 | W1A (`AppearanceStatusBar`, `DepthComposition`) |
| G-25 | Legibility falloff under the line | G3 amendment §4 | 6 | accepted craft, not required; the line sits on the support ground, not over the world |
| G-26 | Device VoiceOver / TalkBack, touch latency, focus perimeter on the rail at 3 pt | P2 §14 item 6 | 5 | **Owner:** Release Hardening & Launch (roadmap §5, "physical iOS / Android device validation"). **Exit Gate:** a physical-device AT and touch pass on the Stage-2 surfaces |
| G-27 | iOS evidence | contract §11.6 | 5 | this environment proves Android only. **Owner / Exit Gate:** as G-26 (iOS Release on device) |
| G-28 | Copy items G3 §G keeps `OPEN COPY` (Timeline accessible name, preview routes, Live-edge wording while following) | G3 §G | 1 | the Live-edge wording is the W1A Product Owner supersession already on `main`; no word is written here |
| G-29 | Real-hardware frame behaviour | VPORT-01 §12; contract §12 | 5 | **Owner:** Release Hardening (performance validation). **Exit Gate:** device frame statistics on reference hardware |

**Orphan gaps = 0.** Every candidate is fixed here, already closed or implemented, owned by an existing backlog item, given a
named owner with an Exit Gate, or shown not to be an obligation; none survives only in this prose without a disposition, and
no backlog alias was created.

## 19. Orphan gaps

**Orphan gaps = 0** (matrix above).

## 20. Stage-2 closure recommendation

Against the contract's §14 gate: the VPORT-01 world is intact (§7); Spine C and the Live terminal are production-integrated
(§8–§9); OrientationChrome's final coherence is integrated, including G3 Decision B (§10); the dark-on-dark defect is fixed
(§10, §15); the Stage-2 navigation iconography uses P2 where a surface exists (§11); the Call Rail's non-signal machine is
ported without fake truth (§12); `QAN-BL-A11Y-01` is reconciled (§13, §17); no architecture was duplicated (§3, §5); no
Stage-2 residue is unowned (§18).

**Recommendation: Stage 2 may be closed when PR #306 is independently reviewed and merged on green CI, and the Product
Owner has answered D-1 (and, if wanted, D-2).** This record does not close it.

## 21. Items requiring a Product Owner decision — separate from implementation defects

- **D-1 — Return Live's one home: which act the home performs.** G3 and P2 freeze that Return Live has one home, the Live
  edge, with its words. Production's Live-edge control is T-06's `COMMIT_LIVE_EDGE` (`FOLLOW_LIVE`); T-08's offered act is
  T-07's `RETURN_LIVE_HEAD` (`FOLLOW_LIVE`, camera and inspection untouched). Their canonical effect is identical (both set
  only `TM := FOLLOW_LIVE`, both effective transactions; the inspection journey is unaffected either way), and their words
  are identical by the W1A supersession. VPORT-02 changed **no executor**: the home keeps T-06's act, and the chrome no
  longer shows the duplicate. **Please confirm** this reading, or direct that the home run `RETURN_LIVE_HEAD` while pinned
  (a one-line change of executor, which this task would not make without that direction).
- **D-2 — «طرق العودة» (optional).** The compact grouping is permitted, not required, and needs a Product designation of
  the "clearly dominant" Return act per context (G2.3 §3 forbids T-11 or Engineering inventing that rank). If the Product
  Owner wants it, it needs that designation; until then the acts stay directly presented, which is compliant.
- **D-3 — sequencing confirmation (non-blocking).** G-14 names the first Global Switcher task (expected in Stage 4) as the
  owner of the P2 navigation family's production use.

No implementation defect is waiting on any of these.
