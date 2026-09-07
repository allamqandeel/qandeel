# T-10.0 — Skill coverage and review log

The exploration contract (§10) names the skills and when they must be used. This is the evidence,
in execution order. Skills never own Product truth; the frozen contracts and the brief come first.

## Required BEFORE implementation

| Skill | When used | What it changed |
| --- | --- | --- |
| `react-native-best-practices` (+ `animations`, `gestures`, `canvas-animations`, `animation-functions`, `animations-performance`, `continuous-gestures` references) | After the substrate inspection, before writing any lab code. | Confirmed the architecture: one Skia canvas; shared/derived values as Skia props; gestures memoized; `.get()/.set()` only; `scheduleOnRN` only at a boundary (rest, tap, report) and never per frame; `withDecay` on release; `runOnJS` nowhere; the ~100/500 animated-view ceiling is why the world is not views. Audited: worklet/RN boundary (epoch-guarded rest commit), JS/canonical boundary (only executors dispatch), rerender/remount (call-time boxes, T-06 FCR-01 pattern), callback churn (boxes, not deps), interruption (grab cancels; acts retarget), stale closures (boxes), store replacement (session key), accessibility (T-04's accessible Map mounted over the plane), performance (measured, below). |
| `find-animation-opportunities` | Before building; over the baseline surfaces. | Produced `03-opportunity-and-anti-opportunity-inventory.md`: 8 opportunities, 13 moments deliberately kept still (including two candidates rejected during design: tether tension, inspection dimming). |
| `prototype` | The lab IS the prototype harness: one piece of UI (the world's motion), three genuinely different variants on a named axis each (camera / disclosure / field), a picker that switches instantly, full working interactions, real fixtures, the choice left to the human. The skill is `disable-model-invocation`; its instructions were read from disk and followed. | Variant axes stated per direction in `04-directions.md`; the picker is the harness chrome, not a contestant; nothing in production was touched. |
| `emil-design-eng` | Before fixing the motion grammar, and again while tuning. | Frequency gate applied (pan/scrub quietest; hero only for Ignition); every arrival under 300 ms except the deliberately long travel; ease-out everywhere on entrances; `scale(0)` never (0.6/0.9 starts); springs only where a finger or momentum is involved (P3); reduced motion as fewer and gentler, opacity kept; exit faster than enter (fold 180 vs unfold 340). |
| `animate-expo` | Before the Reanimated mechanics. | Duration/dampingRatio spring form throughout; velocity handed to springs only in C; `overshootClamping` not needed because cuts/critical damping are used where a hard edge exists; `useReducedMotion` OR'd with the harness toggle; `ReduceMotion.Never` on the explicit reduced choreography. |

## Required DURING

| Skill | Use | Notes |
| --- | --- | --- |
| `ui-ux-pro-max` | Its Python search helper cannot run here (this host has only the Store `python.exe` stub; Python was NOT installed, per §10). The readable `references/pro-rules.md` and the priority table were applied by hand. | Applied: 44 pt targets on every lab control; one duration token family per act, not one duration for all; no emoji icons (no icons at all in the lab); spacing on a 4/8 rhythm in the harness; motion conveys spatial continuity; reduced motion supported; drag has a non-drag alternative (T-04's accessible Map + the harness buttons). Correction: pressed feedback on the harness controls was claimed here before it existed; `/review-animations` caught it and it was added (instant pressed opacity, no transition, because a harness control is a 100+/session action). Recorded limitation: no database matches were consulted, so no "style" recommendation is claimed. |
| `frontend-design` | For the coherence of the motion idea rather than the look (VI-03 owns the look). | One signature per direction (A: the damped slide; B: the unfold; C: the field breath) and one shared rare signature under test (brass Ignition); everything else quiet. No template default was spent on the harness: neutral warm greys are placeholders and are stated as such. |
| `designing-arabic-frontends` | For the Arabic/RTL runs. | The lab's Product surfaces are T-08 (frozen bilingual copy, line-height 1.6+, no letter-spacing, no italics) and T-06 (RTL geometry mirrored through its one presentation-geometry rule). The harness sets `dir` on the frame and the `I18nManager.isRTL` flag on the web renderer before remounting, since the flag is inert there. The world plane has no text and is not mirrored (a map is not reading-order content); the register stays start-anchored through T-04's placement. Digits: Western in both languages (T-08's recorded decision; regional policy deferred to T-12). No new Arabic copy was authored, so `writing-eloquent-arabic` stays N/A. |
| `fixing-accessibility` | For reduced motion and the non-gesture routes. | Every act has a non-drag route: T-04's `MapAccessibilityLayer` (inspect, direct jump, context switch, semantic zoom, explore) is mounted over the lab plane; T-06's navigator and T-08's buttons are the production routes; the harness buttons are native `Pressable`s with roles and states. Reduced motion is an alternate choreography with the same acts and destinations; no information is carried only by standard motion (every arrival also fades; every departure is a removal; the preview veil is opacity). |

## Required AFTER the three directions exist

| Skill | Status |
| --- | --- |
| `design-critique` | Done, over the captured filmstrips and full-resolution frames of every run (A/B/C × S1–S5, real-pointer drag, reduced motion, Arabic/RTL, Ignition on/off) — the critique is `05-comparison-matrix.md`. |
| `/review-animations` | Run by the user at the final prototype review gate. Result below. |

## `/review-animations` result

Reviewed: `motion/profiles.ts`, `motion/settle.ts`, `motion/useLabCamera.ts`, `motion/world-presence.ts`, `world/LabNode.tsx`, `world/LabWorldCanvas.tsx`, `world/LabWorldSurface.tsx`, `harness/LabControls.tsx`, `MotionLab.tsx`, against the ten standards (justified motion, frequency, easing, sub-300 ms, origin/physicality, interruptibility, GPU-only, accessibility, asymmetry, cohesion).

### Findings

| Before | After | Why |
| --- | --- | --- |
| `useLabCamera.ts:143-157` — velocity low-pass `vx = vx·0.6 + ivx·0.4` never reaches zero; every node's radius derives from `speed` | **Fixed:** snap below 0.5 pt/s, write only on change | A plane at rest repainted the whole canvas 53–72×/s in C (measured); after the fix 2.6×/s idle (A: 2.2), 22–33×/s while moving. A recalc storm, not a property of the field idea. |
| `LabNode.tsx:149` — Ignition ring radius grows `5 + 16·ignition` under every profile | **Fixed:** `ignition.ringGrowthPoints` = 16 (A/B/C), **0 under reduced motion** | Reduced motion keeps opacity and drops movement; the ring expansion was movement the reduced profile claimed not to have. |
| `LabControls.tsx:43`, `MotionLab.tsx:288` — `Pressable` with no pressed state | **Fixed:** instant pressed opacity 0.6, no transition | Every pressable needs feedback; at 100+/session a harness control gets instant feedback, never an animation. |
| `profiles.ts:169` C zoom `spring(540, 0.86)` | `spring(≤ 320, 1)` | A depth step is a Product act with no finger on it: no bounce, and 540 ms is far over the UI budget. |
| `profiles.ts:171-172` C disclosure `spring(520, 0.72)`, temporal `spring(420, 0.74)` | critically damped, ≤ 300 ms | Bounce only where a gesture carried momentum; an arrival that overshoots reads as toy motion. |
| `profiles.ts:137` A zoom `spring(460, 1)` | `spring(≤ 320, 1)` | Over budget with no stated reason; the ×8 reinforcement is state indication, not a flight. |
| `profiles.ts:138, 154, 170` travel caps 560 / 380 / 640 ms | keep A/B with the stated reason (P1: a flight across one world, Q2); cut C to ≤ 560 | The one justified over-300 ms motion in the lab; C's cap has no extra reason. |
| `profiles.ts:136, 168` pan cancel settle 320 ms / `spring(360, 0.85)` | `spring(≤ 200, 1)` | A cancelled input is a system response: it snaps back, it does not perform. |
| `profiles.ts:156` B temporal stagger 28 ms | `0` | A temporal set becomes known at once; staggering it is "stagger because a list exists" and adds an order the record does not state. |
| `profiles.ts:138` A travel `carriesVelocity: false` | `true` (velocity tracking is now cheap at rest) | When an act interrupts momentum the travel starts from zero velocity: a visible break mid-flight. Springs should carry velocity through an interruption. |
| `LabNode.tsx:52` from-host grow starts at `0.6` | `0.85–0.9` | Nothing appears from (near) nothing; the travel from the host already says where it came from. |
| `useLabCamera.ts:317-319` resolve-in-place: opacity to 0.3 then fade, no transform | never the default for a long flight; if kept, pair with a `0.97 → 1` scale about the destination; keep the cut under reduced motion | A pure-fade entrance at the destination is a comes-from-nowhere; under reduced motion the cut is the point. |
| `profiles.ts:174-175`, `LabNode.tsx:108-112`, `LabWorldCanvas.tsx:95-100` field breath, arrival breath, ripple | delete | Decoration on a functional surface: size follows speed, neighbours react to an arrival. Both imply meaning the record does not carry. |
| `profiles.ts:153` B zoom delay 90 ms after a 340 ms unfold | delay ≤ 60, unfold ≤ 260, overlapping | Sequencing is the idea; the sum (≈ 430 ms + stagger) is not. |

### Verdict

1. **Feel-breaking:** C's overshoot on act-driven motion (zoom 0.86, disclosure 0.72, temporal 0.74); B's default cut on the long flights of Back and Exact Return (the world arrives from nowhere at the destination).
2. **Missed simplifications:** C's field breath, arrival breath and ripple; B's temporal stagger; B's brass disc under the Ignition ring adds little over the ring.
3. **Performance:** the idle repaint storm (fixed above). While moving, C still recomputes every node's radius from speed each frame, which is acceptable because a moving plane repaints anyway. All three pay a ~200 ms main-thread stall on a depth change in the dev bundle (React reconciliation of the new rung, not animation); measure on a release build before treating it as a finding.
4. **Interruptibility & timing:** A's and B's travel restart from zero velocity when an act interrupts momentum; cancel settles over 300 ms; A's 460 ms zoom.
5. **Origin, physicality & cohesion:** the 0.6 grow start; the Exact Return lock draws chrome on the world (Q7, a Product question); C's bouncy personality does not match an analysis surface, A and B are cohesive.
6. **Accessibility:** the reduced-motion ring (fixed above). Otherwise sound: reduced motion is an alternate choreography with the same acts, no hover motion exists, every act has a non-drag route.

**Decision: Block as production motion, as built; approved as the comparison instrument the shootout needs.** The three defects were fixed in the lab (none changes a direction's standard-motion choreography or any recording). The remaining rows are the conditions any chosen direction or hybrid must meet before production T-10, and they coincide with the matrix's recommendation: A's camera, B's depth disclosure only, no field, no default cut, critically damped everywhere a finger is not involved.

Verification after the fixes: typecheck, lint (local no-native config) and the lab's Jest suites — see the final report for the run results; the repaint re-measurement is in `E:\QANDEEL\CW\_t10-captures\fix-*` (`fix-C-idle` 2.6/s, `fix-A-idle` 2.2/s, `fix-C-S1` 32.8/s, `fix-C-S2` 22.1/s, in-page meter 60 fps in all four).

## Harness defects found by the review itself (and what was re-captured)

| Defect | Effect | Correction |
| --- | --- | --- |
| The capture driver read a chip's state from `aria-selected`, which the web renderer does not emit for a `Pressable`'s `accessibilityState`. The read was always `null`, so every chip whose default is ON was toggled OFF when the driver "ensured" it on. | The Ignition cue (default on) was OFF in every run labelled as on, and ON in the one run labelled `ignition-off`. Every other chip has a default of off, so language, RTL and reduced motion were set correctly (their readouts confirm it). | The driver now reads the chip's own label (": on", "RTL", "العربية") and verifies the state after the click. The five Ignition runs (`A/B/C-S5-ignition`, `C-ar-rtl-S5-ignition`, `B-S5-ignition-off-2`) were re-captured; the first-batch S5 runs are kept as the cue-off controls they actually are. |
| T-06's `TemporalTargetLayer` carries English-only presentation copy at the baseline (it has no language input; VI-01's bilingual authority reached T-08 only). | In the phone frame the visible strip under the world is English under Arabic copy; the T-08 chrome and the lab's act labels ARE Arabic but sit below the fold of the lower panel. | Two extra runs (`A/B-ar-rtl-S4-chrome`) scroll the lower panel so the Arabic, right-aligned T-08 orientation sentence and the Arabic Exact Return control are in frame. Recorded as an open item for production T-12 (Arabic copy for the temporal layer), not a shootout finding. |
| Two Ignition captures overlapped a heavy transcript scan on the same machine. | Capture-side frame rates dropped (the in-page meter is unaffected but the recordings stutter). | Re-captured on an idle machine. Every perf figure quoted in the matrix is from an idle-machine run. |
| Scrolling the lower panel BEFORE clicking a scenario chip left the scenario un-started (cause not established; the page and chip were unchanged). | Two chrome runs recorded nothing. | The driver scrolls AFTER the scenario chip is clicked; verified by the end state (`reversible history 5` at 4 s). |
