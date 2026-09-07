# T-10 — traceability and anti-proxy gate

Every frozen invariant, decision, pre-mortem, adversarial row, static guard and Definition-of-Done
line, mapped to the exact proof that carries it. `STRUCTURALLY IMPOSSIBLE` means the defect cannot
be written, not that it was tested for and not found.

Short names used below:

| Key | File |
| --- | --- |
| **CAM** | `apps/mobile/src/motion/__tests__/presentation-camera.test.tsx` |
| **PAN** | `apps/mobile/src/motion/__tests__/pan.test.tsx` |
| **SCENE** | `apps/mobile/src/motion/__tests__/scene-truth.test.tsx` |
| **RET** | `apps/mobile/src/motion/__tests__/returns.test.tsx` |
| **PAR** | `apps/mobile/src/motion/__tests__/parity.test.tsx` |
| **GATE** | `tests/t10-motion-contract.test.mjs` |
| **T04/T06/T07/T08** | the frozen root contract of that task, re-run unchanged |

---

## 1. Frozen invariants (§3)

| Invariant | Proof |
| --- | --- |
| One persistent world; stable Homes; geometry cannot invent meaning | T04 (unchanged); GATE "the static visual language was not redesigned"; placement is read from canonical `bigint` addresses only |
| Semantic Zoom = disclosure, not magnification | CAM "a Semantic Zoom deeper/shallower reproduces every canonical Home exactly" + "a preserved frame keeps its SIZES" (PM-04); GATE counter-scale pins |
| Live Focus ≠ Inspected Focus; `FOLLOW_LIVE` / `PINNED(t)` only; strict `K(t)` | T02/T07 (unchanged); GATE "T-10 adds no canonical field, no Product act and no temporal mode" |
| Future-unavailable material is absent, never ghosted | SCENE A21–A24; GATE §6.1 — no exit path exists to ghost with |
| Preview ≠ committed `TC`; Return Live Head ≠ Return Live Focus; Return World ≠ Back | RET A38/A46/A50; T07 (unchanged) |
| Exact Return restores the captured tuple; every restoration is `PINNED(capturedTC)` | RET A53; T07 (unchanged) |
| Go Live + Locate is ONE transaction with a conditional spatial half | RET A48, A49 |
| T-08 chrome is presentation, never authority | T08 (unchanged); T-08 was not modified by T-10 |
| Accessibility parity is Product truth | PAR A59/A60/A61; GATE §14 |
| Reduced motion preserves capability and final truth | PAR A56/A57/A58; RET "reduced motion reaches the same canonical state by the same acts" |

## 2. Q1–Q8 (§5)

| | Proof |
| --- | --- |
| **Q1** no momentum, one PAN at gesture end from the finger's translation | PAN A03/A04/A05/A06/A07/A08; GATE "Q1 — one completed drag is one PAN"; `withDecay`, `deceleration`, `velocityX/Y`, `momentum`, `inertia` all refused repository-wide |
| **Q2** travels, never cuts; capped | CAM "an exceptional same-world flight travels, never cuts, and stays under the ceiling"; `CUT_AND_RESOLVE` has exactly two causes and distance is not one |
| **Q3** disclosure leads, reinforcement overlaps, one 320 ms budget | CAM "a depth step reinforces within the allowed overlap"; GATE token-band test asserts `delay + duration ≤ 320` and `disclosure ≤ delay + duration` |
| **Q4** `MEANING_IGNITION_TRIGGER_DEFERRED_TO_T12` | PAR A64–A72; GATE "Meaning Ignition ships no trigger and no cue" |
| **Q5** cut + local opacity resolve | CAM "reduced motion cuts the travel and keeps an opacity resolve"; PAR |
| **Q6** no Preview veil | GATE §2.8 — the owner cannot see a Preview at all; plane opacity has exactly two writers |
| **Q7** no Exact Return lock frame | RET A53/A54 — Back and Exact Return produce the same plan keys; GATE refuses every lock primitive |
| **Q8** no field response | GATE §16 — no velocity is measured, so nothing can follow it; no neighbour is reachable, so nothing can respond to one |

## 3. Pre-mortem (§18)

| | Failure shape | Proof it cannot happen |
| --- | --- | --- |
| PM-01 | motion completion becomes authority | GATE "no animation completion can reach canonical state" — no `with*` call takes a callback, and the owner's import closure cannot name a store |
| PM-02 | momentum reopens T-04 / two RH entries | PAN A03/A05 (exactly one act, nothing after the end); GATE momentum denylist |
| PM-03 | one-frame stale `V` | SCENE A21–A24 — painted set equals the current placement exactly; STRUCTURALLY IMPOSSIBLE: no exit path |
| PM-04 | Semantic Zoom becomes optical zoom | CAM "a preserved frame keeps its SIZES"; GATE counter-scale pins. **Found by the visual proof, not by a test.** |
| PM-05 | from-host motion invents a relationship | SCENE A30/A31 — the origin comes from the same placement the tether is drawn from |
| PM-06 | stagger invents order | SCENE A32 — the arrival plan has no delay/index/ordinal field at all |
| PM-07 | field response returns as polish | GATE §16 token sweep + the planted-defect half |
| PM-08 | camera / paint / hit-test disagree | CAM A37 (inverse is exact); SCENE A37 (a touch mid-travel selects what is drawn) |
| PM-09 | accessibility overlay blocks gesture | PAR A60; GATE §14 `pointerEvents="box-none"` |
| PM-10 | Skia outer/inner commit race | GATE §13 — the rebase is the LAST child of the transformed plane, in a layout effect; CAM's rebase invariant makes the preserved frame exact rather than fast |
| PM-11 | reduced motion changes capability | PAR; RET reduced-motion case reaches the same canonical state |
| PM-12 | Preview veil changes semantic weight | GATE §2.8 |
| PM-13 | Exact Return gets a gimmick | RET A54 |
| PM-14 | Ignition becomes a "new item" animation | PAR A64–A72 — no cue exists to be repurposed |
| PM-15 | interruptibility queues actions | CAM "an interruption is structural: there is no queue"; RET A52 |
| PM-16 | React rerenders every frame | PAN A11 — 60 gesture frames, zero renders |
| PM-17 | motion leaks T-11 responsive policy | GATE "T-11 responsive policy … untouched" |
| PM-18 | motion leaks T-12 integration/copy | GATE — no copy module, no Arabic, no sentence-shaped literal |
| PM-19 | 60 fps Chrome treated as native proof | Stated as `PHYSICAL MOTION REVIEW PENDING`; the visual proof page names what is real and what is not |
| PM-20 | green tests substitute for taste | The design critique ran over the RUNNING proof and produced two fixes no test had caught (PM-04, the 360 ms reinforcement budget) |

## 4. Adversarial matrix (§20)

| Rows | Proof |
| --- | --- |
| A01, A02 | PAN "the finger moves the plane 1:1"; CAM "a drag is 1:1 in the plane" |
| A03 – A08 | PAN, one test each |
| A09, A10 | PAN — a replaced store receives the act and the old one does not; one gesture object across every render |
| A11, A12 | PAN "a whole drag costs zero React renders and zero crossings"; GATE per-frame path allows exactly `camera.dragBy(` |
| A13 | CAM rebase invariant (pan, long pan, single-axis, zoom in, zoom out) |
| A14, A15, A16 | CAM "a rebase arriving mid-travel composes onto the residual on screen"; "an interruption is structural" |
| A17, A20 | CAM long-flight test — travels, capped, monotonic, never a cut |
| A18 | CAM reduced-motion plan |
| A19, A34 | CAM "no act-driven motion is ever underdamped"; GATE `ACT_DAMPING_RATIO = 1` is the only damping value |
| A21 – A24 | SCENE — the painted set equals the current placement, exactly |
| A25 – A29 | SCENE "a surface that stops painting a world leaves no residual behind"; T04's stale-`V` firewall re-run unchanged |
| A30, A31, A32 | SCENE arrivals block |
| A33 | CAM depth-step overlap and budget |
| A35 | SCENE "a shallower rung removes the detail it no longer discloses" |
| A36 | CAM rebase invariant — the first frame after a change IS the previous frame |
| A37 | CAM inverse exactness; SCENE touch mid-travel |
| A38 | RET "Return to Live Head moves no camera at all" |
| A39 | PAR/GATE — the owner cannot see a Preview |
| A40 | SCENE A21–A24 |
| A41, A45 | T06 (unchanged, re-run); PAR "the refined temporal numbers stay inside their frozen bands" |
| A42, A43 | T06 — the commit is dispatched with the store's answer already in hand and the acknowledgement is called afterwards; PAR band test |
| A44 | T06 RTL geometry suite (unchanged); GATE — T-06's ONE presentation rule still owns the mirroring |
| A46 – A55 | RET, one test each |
| A56, A57, A58 | PAR; RET reduced-motion case |
| A59, A60, A61 | PAR; GATE §14 |
| A62, A63 | PAR; GATE "the world is a world, not reading-order content" |
| A64 – A72 | PAR; GATE — satisfied structurally: no trigger surface and no cue exist |

**Anti-proxy notes.** The one-PAN claim is carried by six separate endings, not one. Store
replacement is proven by driving the SAME gesture object after the swap. "No stale `V`" is proven
as an equality against the current placement, not as the absence of one named ghost. RTL is proven
by the absence of any directional concept in the owner plus T-06's unchanged geometry suite, not by
a screenshot. Reduced motion is proven by reaching the same canonical state through the same acts,
not by a flag being read.

## 5. Static guards (§21)

| | Guard | Where |
| --- | --- | --- |
| 1–3 | no new canonical field, Product act or temporal mode | GATE "T-10 adds no canonical field…" |
| 4 | no dependency / lockfile change | GATE — every package the owner names is already declared; no second animation library is installed |
| 5 | no app-shell mount | GATE "the app shell still mounts no world" |
| 6 | no backend / database / schema change | GATE "T-10 is mobile-only" |
| 7 | motion owner cannot dispatch | GATE import-closure + identity sweep |
| 8 | no animation completion reaches store/executor | GATE "no animation completion can reach canonical state" |
| 9 | no `withRepeat` / infinite motion | GATE §16 |
| 10 | no field / ripple / breath | GATE §16 + planted-defect half |
| 11 | no stagger token | GATE — the arrival plan has no delay of any kind |
| 12 | no Preview world veil | GATE §2.8 |
| 13 | no Exact Return lock primitive | GATE §2.9 |
| 14 | no post-release `withDecay` | GATE Q1 |
| 15 | no per-frame React-state pan path | GATE Q1 — the removed API names are refused |
| 16 | production cannot import `motion-lab` | GATE "the motion lab is not in production" |
| 17 | PR #212 does not enter the dependency graph | GATE — the exploration head sha is refused in every mobile source |
| 18 | T-11 owners untouched | GATE |
| 19 | T-12 integration / copy owners untouched | GATE |
| 20 | static visual language not redesigned | GATE — every palette value and radius pinned |

**Forward safety.** No whole-repo file count, no migration ceiling, no whole-file workflow hash as
primary proof, no global test-count pin, no mutable-global ceiling. `npm run test:forward-safety-contract`
runs the whole contract set — this one included — against a tree carrying the authorized future
mobile gate, migration, T-10 motion, T-11 responsive work, T-12 shell integration and root
devDependency, together.

## 6. Definition of Done (§31)

Every line is carried by the rows above, plus: canonical baseline verified against the remote
(`9d07d7db…`); exclusive workspace ownership verified by `Verify-QandeelWorkspace.ps1`; the
exploration used as evidence only (no merge, no cherry-pick, no lab code in production);
`/review-animations` and its applied findings recorded in the final report; one candidate push;
Draft PR, not merged.
