# Final Living Analysis Map Integration v1 — Traceability

Companion to [`final-living-analysis-map-integration-v1.md`](final-living-analysis-map-integration-v1.md).
Every claim maps to exact evidence: a Jest suite under `apps/mobile/src/integration/__tests__`, the
root static contract `tests/t12-integration-contract.test.mjs`, or a stated absence.

`T-12 backlog inheritance: 10 items`

Evidence keys: **RT** `runtime.test.ts` · **PJ** `projection.test.ts` · **JO** `journey-origin.test.ts`
· **SC** `spatial-cause.test.ts` · **MI** `meaning-ignition.test.ts` · **LO** `locale.test.ts`
· **CO** `composition.test.tsx` · **SG** the root static contract · **DOC** this document set
· **NONE** a stated absence, which is itself the evidence

---

## 1. Adversarial matrix — A01…A116

### Store / authority convergence

| ID | Claim | Evidence |
| --- | --- | --- |
| A01 | one Session ⇒ one CanonicalStore | RT |
| A02 | Map/Timeline/Chrome share the exact store | RT, CO |
| A03 | Map authority wired | RT, SG |
| A04 | Temporal authority wired | RT, SG |
| A05 | Return authority wired | RT, SG |
| A06 | no integration bypass dispatch | RT, SG (§28.5 barrel closure) |
| A07 | store replacement retires the generation | RT |
| A08 | an old callback cannot write the replacement store | RT, PJ |
| A09 | no persistence path | SG (§28.19) |
| A10 | no second canonical holder | SG (one `createCanonicalStore`) |

### Startup / credentials

| ID | Claim | Evidence |
| --- | --- | --- |
| A11 | no fixture Session in production | RT, SG (§28.8) |
| A12 | token absent from source and default config | SG (§28.7) |
| A13 | base URL / token / fetch explicit and authorized | RT, PJ |
| A14 | invalid startup snapshot fails closed | RT |
| A15 | foreign-Session snapshot refused | RT |
| A16 | `LH = null` stays technical absence | T-12P bootstrap (frozen), consumed unchanged |
| A17 | initial temporal/camera/inspection from frozen policy | T-12P bootstrap (frozen); T-12 supplies none |
| A18 | a missing binding cannot silently fall back | RT (config refused ⇒ no runtime) |
| A19 | no arbitrary polling interval | SG (§28.10) |
| A20 | a transport error creates no semantic state | PJ |

### Live mirrors

A21–A30 are T-12P's frozen properties, consumed unchanged. T-12 adds no writer of `LH` or `LF` and
obtains the driver rather than building one — SG (§28.10–11), RT (A30, generation retirement).

### Projection

| ID | Claim | Evidence |
| --- | --- | --- |
| A31 | identity includes Session/TC/depth | PJ, SG |
| A32 | a stale request is ignored | PJ (out-of-order race) |
| A33 | foreign-Session payload refused | PJ (both layers) |
| A34 | wrong TC refused | PJ (both layers) |
| A35 | wrong depth refused | PJ, SG (`answers`) |
| A36 | `NOT_FETCHED` distinct | PJ |
| A37 | `UNAVAILABLE` technical | PJ |
| A38 | no future-unavailable object | T-03C wire (frozen); T-12 derives nothing |
| A39 | sealed reuse follows T-03C | frozen cache, unmodified |
| A40 | open-head invalidation follows T-03C | frozen cache, unmodified |
| A41 | one cache only | PJ, SG (§28.14) |
| A42 | projection writes no CanonicalState | PJ, SG (§28.15) |
| A43 | Map/Chrome generations agree | CO (one read, one pass) |
| A44 | Return capability rejects a stale projection | T-07 freshness gate (frozen); PJ for retirement |
| A45 | a previous Session's response cannot enter a new Session | RT, PJ |

### Final composition

| ID | Claim | Evidence |
| --- | --- | --- |
| A46 | the route mounts the integrated root, not `FoundationShell` | SG |
| A47 | semantic navigation needs no extra routes | SG (§28.12–13) |
| A48 | real `MapSurface` | CO |
| A49 | real Timeline / T-06 surface | CO |
| A50 | real `OrientationChrome` | CO |
| A51 | `ResponsiveSurface` composes all three | CO |
| A52 | safe area presentation-only | CO, SG (§28.24) |
| A53 | real font scale feeds T-11 | CO, SG (§28.24) |
| A54 | no hidden duplicate controls | CO |
| A55 | boot smoke targets the integrated root only | SG (§28.26) |

### Original Inspection journey

| ID | Claim | Evidence |
| --- | --- | --- |
| A56 | an arbitrary valid checkpoint cannot mint an origin | JO, T-08 `origin-boundary.test.tsx` |
| A57 | a Return-to-World checkpoint cannot be an origin | JO, T-08 `origin-boundary.test.tsx` |
| A58 | a real journey start binds the origin | JO |
| A59 | same-store provenance | JO |
| A60 | a consumed origin disappears for ever | JO |
| A61 | history regrowth cannot resurrect it | JO |
| A62 | store replacement retires it | JO |
| A63 | a new journey's replacement is deterministic | JO (a later inspection continues, never rebinds) |
| A64 | Exact Return still re-proves its target | T-07 (frozen), JO |

### Composite spatial cause

| ID | Claim | Evidence |
| --- | --- | --- |
| A65 | a legitimate landing binds the exact cause | SC |
| A66 | no landing ⇒ no spatial cause | SC |
| A67 | already there ⇒ no invented travel | SC |
| A68 | an unrelated camera act cannot consume it | SC |
| A69 | an intervening act invalidates it | SC |
| A70 | store replacement invalidates it | SC |
| A71 | consumed once | SC |
| A72 | no timeout or timestamp authority | SC, SG (§28.17) |
| A73 | reduced motion, same truth | T-10 plan (frozen); the cause changes only the beat |
| A74 | an unrepresentable cut earns no illegal beat | T-10 `travel-plan.ts` R3-03 (frozen, unmodified) |
| A75 | ordinary travel never gets a composite beat | SC |

### Meaning Ignition

| ID | Claim | Evidence |
| --- | --- | --- |
| A76–A81 | fetch, remount, viewport entry, Return, Preview and projection replacement cannot trigger a cue | MI, SG (§28.18) |
| A82 | no signal ⇒ no cue | MI, DOC §8 |
| A83 | an authoritative event ⇒ one cue | **NONE** — no such event exists; nothing dormant shipped |
| A84 | reduced-motion acknowledgement if a cue exists | **NONE** — vacuous: no cue exists |

### Live label / RTL / locale

| ID | Claim | Evidence |
| --- | --- | --- |
| A85 | 200 % EN Live label not clipped | SG (§28.25 — the clip is gone, the extent is a floor) |
| A86 | 200 % AR Live label not clipped | SG (§28.25); the slot is language-agnostic |
| A87 | the Live edge stays outboard | SG (§28.25), T-06 `rtl-geometry.test.tsx` |
| A88 | no fake Moment | T-06 `rtl-geometry.test.tsx` (frozen claim, re-verified) |
| A89 | 1:1 scrub LTR | T-06 (frozen); T-12 changed no scrub code |
| A90 | 1:1 scrub RTL | T-06 (frozen); T-12 changed no scrub code |
| A91 | language and direction independent | LO, CO |
| A92 | the Map is never mirrored | T-04 (frozen); T-12 passes no direction to it |
| A93 | v1 numeral policy stable | LO (asserted through `Intl`, not by inspection) |
| A94 | a locale switch changes no Product truth | LO, CO |

### Accessibility / responsive

| ID | Claim | Evidence |
| --- | --- | --- |
| A95 | controls ≥ 44pt | CO (whole composed tree) |
| A96 | compact hides no Return act | CO |
| A97 | one screen-reader copy of each act | CO |
| A98 | coherent focus order after recomposition | CO (single tree, no duplicates); **native order unproven** |
| A99 | large text keeps essential words | CO, SG (§28.25) |
| A100 | insets change no canonical field | CO |
| A101 | mid-motion resize, no teleport | T-11 (frozen); **native unproven — `QAN-BL-RSP-01`** |
| A102 | reduced motion, same capabilities | T-10 (frozen); T-12 removes no capability |
| A103 | Arabic compact operable | CO |
| A104 | short landscape operable | CO |

### Visual boundary

| ID | Claim | Evidence |
| --- | --- | --- |
| A105 | neutral paint not declared final | DOC §12, SG (§28.22–23) |
| A106 | no new final palette or material contract | SG (§28.22–23) |
| A107 | no static guard freezes placeholder colours | SG (§28.22–23, self-check) |
| A108 | QAN-GOV-02 remains the authority boundary | SG (§28.21, self-check) |
| A109 | no false relation from integration decoration | SG (the layer defines no colour and draws nothing) |
| A110 | VI-03 remains open | DOC §12 |

### BG-08 / physical

| ID | Claim | Evidence |
| --- | --- | --- |
| A111 | all **10** inherited IDs dispositioned | SG (§28.27), DOC §15 |
| A112 | no blocker laundered | DOC §14–15 — the four open items stay open and T-12 stays ACTIVE |
| A113 | no physical item passed without evidence | DOC §15 — none is passed |
| A114 | drag culling changes only with an actual defect | **NONE** — unchanged; no defect observable without hardware |
| A115 | new legitimate residue admitted before closure | DOC §14 — recorded; admission happens at BG-08 |
| A116 | the T-13 item stays T-13-owned | SG (§28.28), DOC §13 |

---

## 2. Pre-mortem — PM-01…PM-50

**Prevented structurally** (the defect is unrepresentable, not merely untested):

PM-01, PM-02 (one runtime, never published; one bundle per generation) · PM-03 (SG pins all three
authorities) · PM-04 (no act identity in the layer) · PM-05, PM-06 (SG §28.7–8) · PM-07, PM-11-adjacent
(SG §28.10: no timer at all) · PM-13, PM-14 (Preview stays T-06's; nothing here writes it) ·
PM-15, PM-16 (SG §28.12–13: no router reference anywhere in the layer) · PM-17 (the mint refuses a
non-journey checkpoint) · PM-19 (the cause is an argument, not a channel) · PM-25 (MI) · PM-26, PM-27
(SG §28.25) · PM-28 (LO: two axes, two platform facts) · PM-30, PM-31, PM-32 (presentation facts reach
no canonical field) · PM-34, PM-35 (SG: nothing references `FoundationShell`) · PM-36, PM-37 (SG §28.19)
· PM-38, PM-39, PM-40 (SG §28.21–23) · PM-41 (the layer draws nothing) · PM-46 (no clock in the layer).

**Prevented by test:** PM-08, PM-09, PM-10, PM-12 (RT, PJ) · PM-18, PM-20, PM-21 (JO, SC) · PM-22,
PM-23, PM-24 (MI) · PM-29 (CO) · PM-33 (CO) · PM-42 (CO) · PM-43, PM-44 (PJ) · PM-45 (SC).

**Prevented by disposition, and the honesty is the point:** PM-47, PM-48 — no physical validation is
claimed; the four device items are OPEN with their exact missing evidence in DOC §14. PM-49 — no
blocker was moved to the backlog; T-12 stays ACTIVE instead. PM-50 — all ten inherited items carry a
disposition in DOC §15.

---

## 3. Frozen invariants preserved

| Invariant | Owner | How T-12 preserves it |
| --- | --- | --- |
| the canonical state has exactly six keys | T-02 | SG asserts the frozen list; T-12 adds none |
| three promoted families, three separate authorities | T-02/04/06/07 | wired as three distinct objects |
| `LH`/`LF` are written only through T-03's sync seams | T-03 | T-12 has no writer |
| one disclosure cache, three technical states | T-03C | one cache; the epoch gate adds no fourth state |
| the Map is the only spatial authority | T-04 | T-12 dispatches no camera act |
| the Track is the complete SP1-anchored prefix | T-05 | derived, never filtered or reordered |
| one physical RTL scrub law | T-06 | no scrub code changed |
| six return acts, provenance re-proven at execution | T-07 | one narrower provenance QUESTION added; no executor changed |
| every reader-facing word lives in one copy module | T-08 | the layer writes no Product word |
| motion is presentation-only and invents no truth | T-10 | the cause is evidence about a transition, never a claim |
| a resize changes what is visible, never what is true | T-11 | CO asserts it over the composed tree |
| T-12P owns identity, bootstrap and live delivery | T-12P | consumed through the barrel; the test seam is banned |

---

## 4. Owner seam changes — declared, not incidental

Four frozen owners were touched. Each is narrow, each strengthens or discharges a recorded
obligation, and each carries its own re-anchored guard.

| Owner | Change | Why it is authorized | Re-anchor |
| --- | --- | --- | --- |
| T-07 `checkpoint-target.ts` | `+ INSPECTION_JOURNEY_ORIGIN_ACTS`, `+ isInspectionJourneyOriginFor` | §14: the smallest owner-approved seam correction; reads the entry's ACT, no checkpoint internal, holds nothing | barrel allowlist in `return-navigation-layer-contract` and `authority.test.ts` |
| T-08 `exact-return-origin.ts` | the mint now requires a journey origin, and is public again | §14: closes R3-04 at the mint instead of by obscurity — strictly stronger | `inspection-orientation-return-chrome-contract` (two guards), `origin-boundary.test.tsx` rewritten as a behavioural proof |
| T-10 `usePresentationCamera.ts` + T-04 `MapSurface`/`MapCanvas` | `applyCanonicalChange(change, cause)` and a destination-keyed resolver | §15: T-10 explicitly deferred the binding to T-12; the mailbox stays impossible | `t10-motion-contract` R3-04 guard rewritten to pin the SHAPE; `t11-responsive-contract` rebase regex |
| T-05 `TimelinePresentation.tsx` | the outboard slot's fixed width and clip became a floor | §17: T-12 is explicitly authorized to make the correction T-11 could not | two blob pins in `temporal-navigation-layer-contract`, plus new permanent assertions beside them |

Also re-anchored: `t12p-mobile-runtime-entry-contract`'s boot-smoke assertion, whose own comment
recorded that it would expire ("because no Product root exists yet"); and
`forward-safety-contract`'s hypothetical future gate, advanced past the name T-12 has now registered.

---

## 5. Static guards — §28.1…30

| # | Guard | Status |
| --- | --- | --- |
| 1–3 | no new canonical field, Product act or temporal mode | asserted |
| 4 | no second store implementation | asserted (census) |
| 5 | composition uses public owner surfaces | asserted (import closure) |
| 6 | owner seam changes documented and allowlisted | asserted (§4 above) |
| 7–9 | no hardcoded token, fixture Session or credential in public config | asserted |
| 10–11 | no polling magic number, no WebSocket/SSE | asserted (no timer at all) |
| 12–13 | no route per depth, Thread or Reading | asserted |
| 14 | no duplicate projection cache | asserted (census) |
| 15 | no Product state write from projection | asserted |
| 16–17 | no generic pending cause, no timeout authority | asserted |
| 18 | no Meaning Ignition on mount/fetch/navigation | asserted |
| 19–20 | no persistence, no T-13 implementation | asserted |
| 21 | no new blanket visual ban | asserted (self-check over this contract) |
| 22–23 | no placeholder palette freeze, no Graphic Language token | asserted (self-check) |
| 24 | safe-area provider uses the declared package | asserted |
| 25 | large-text Live fix retains outboard identity | asserted |
| 26 | boot smoke no longer asserts the technical shell | asserted |
| 27 | exact T-12 backlog inheritance list (**10**) | asserted |
| 28 | `QAN-BL-T13-01` not claimed | asserted |
| 29 | no dependency drift | asserted (T-12's own imports) |
| 30 | forward-safety green | the gate passes; its hypothetical advanced to T-13 |

No whole-file hashes of shared artifacts, no global file-count ceilings and no repository-wide
test-count pins were added.

---

## 6. What is NOT proven here

Stated so no reader mistakes coverage for evidence:

- **Nothing perceptual.** No travel was felt, no scrub was tracked with a finger, no acknowledgement
  was judged. `QAN-BL-MOT-03` and `QAN-BL-MOT-04` are open.
- **Nothing laid out by a real type engine, inset provider or window manager.** `jest-expo` performs
  no layout; every composed assertion is made against a supplied measurement. `QAN-BL-RSP-01` is open.
- **Nothing about the real auth-session storage path.** No device, and no live identity to sign in
  with. `QAN-BL-T12-04` is open, and its blocker is two-part.
- **No end-to-end run against the real API.** The transports and decoders are the frozen ones and are
  exercised with wire-legal bodies, but no request left this machine.
