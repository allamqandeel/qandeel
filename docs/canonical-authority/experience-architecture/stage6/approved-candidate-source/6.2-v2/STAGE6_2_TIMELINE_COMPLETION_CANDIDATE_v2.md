# QANDEEL_STAGE6_2_TIMELINE_COMPLETION_CANDIDATE_v2
## Stage 6.2 — Timeline Interaction + Legibility Completion

**Status:** CANDIDATE v2 — Architecture corrections applied, for final review
**Date:** 2026-09-03
**Upstream:** Stages 0–5 CLOSED / FROZEN · Stage 6.1 CLOSED / FROZEN
**Owned OPENs:** OPEN-13, OPEN-02, OPEN-12, OPEN-14
**Authority consumed:** `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` · `QANDEEL_STAGE6_1_FINAL_FREEZE_RECORD_v1.md` · Stage 6.2 Pre-Flight Contract Gate · Stage 6.2 Execution Authorization · **`QANDEEL_STAGE6_2_ARCHITECTURE_RULING_v1.md`**

> **Stage 6.2 is NOT declared frozen by this package.** No frozen Stage 5 semantics were reopened. No new semantic rule was invented. No repository file was touched. No code was written.

---

# 0. v2 change note

Architecture approved the three core directions (A-01 ordinal constant-step metric, A-02 no aggregation in v1, A-03 targets-address / acts-intent) and required **four narrow corrections plus two wording narrowings**. Research was approved and is not repeated; unaffected evidence is carried forward verbatim.

| Correction | What changed | Sections |
|---|---|---|
| **REV-01 — post-`TC` navigation must remain possible** | v1 held the firewall by making later Moments **unreachable** from the Timeline. That was wrong: Stage 5.3's post-`TC` rule is a **disclosure** firewall, not a navigation-coordinate prohibition, and frozen Stage 5 explicitly permits Preview to move to a later `PTC`. v2 adds a **relative progressive traversal** mechanism with **earned disclosure**, and proves it under REV-AT-01. | §8 (TL-16…TL-19), §9, §10, §19, §20, §24, §27–§30 |
| **REV-02 — `LIVE_EDGE` must not become a fake temporal step** | The v1 "terminus beyond the final step" wording manufactured ordinal distance where the frozen semantics have none. v2 replaces it with an **outboard non-metric Live control** anchored to the same Live boundary: **co-temporal, intent-distinct; affordances may be spatially distinct.** | §7–§13, §23, §24, Boards |
| **REV-03 — narrow the accessibility conclusion** | "Slider/range topology is structurally unavailable" was too absolute. v2 freezes only the epistemic constraint and the narrow incompatibility of a **full-session** range control while `PINNED`. 6.4 retains authority over restricted-region or `FOLLOW_LIVE` range semantics. | §1, §2, §3, §21, §23, §24 |
| **REV-04 — WCAG target size is not scale semantics** | The 24 × 24 claim is removed from the justification for ordinal scale and from the contract. 6.4 owns pointer-target topology; boards use generous hit areas as scaffolding only. | §2, §3, §5, §6, §8 (TL-08), §15, §17, §22, §27 |
| **REV-05 — narrow the timestamp statement** | Now: *the Stage 6.2 Timeline contract creates no new requirement to retain Moment timestamps **solely for Track geometry***. It no longer claims v1 has no timestamp obligation at all. | §30 |
| **OPEN-14 conditions** | The no-aggregation decision now carries an explicit seven-part proof (§17.1) as the ruling requires. | §17 |

## Preserved unchanged from v1

All research (§2) except the two narrowed implications; the OPEN-13 option space and matrix except the target-size row; the OPEN-02 grammar and locus contract (§14–§16) in full; DT-04, DT-05, DT-07…DT-10, DT-12, DT-14, DT-15; X-03, X-04, X-06, X-07, X-08; and the frozen-constraint register except where a clause's *application* changed.

## Stop-Rule check — run before applying

The corrected model requires **none** of the eight prohibited things.

- **No future enumeration.** Nothing is listed, sloted, counted, or made simultaneously reachable. Disclosure past `TC` happens one Moment at a time and only as the direct result of the user's own explicit forward navigation.
- **No future count / density / extent leakage.** At rest the Track discloses `m0…TC` and a fixed non-metric Live control; REV-AT-01's "no future count/extent recoverable merely from the resting control" is satisfied because the forward affordance has no proportional extent, no thumb position, and no scroll range that includes post-`TC` material.
- **No new temporal mode.** Forward traversal moves the prospective `PTC` only. `PTC ∉ S` is untouched, and `TM` remains `FOLLOW_LIVE | PINNED(t)`.
- **No coarse stepping.** The traversal unit is **one Moment** — the frozen ±1 adjacency. Input magnitude *repeats* that unit; it never enlarges it, and no coarser unit is defined, selectable, or exposed. (Coarse stepping is a navigation **unit** larger than one Moment; repetition of the unit is not one.)
- **No cross-session Timeline, no auto-locate, no `LIVE_EDGE` as a later temporal position** (REV-02 removes exactly that), and **no change to Preview / Commit / Settle** — the mechanism *uses* the frozen grammar rather than modifying it.

**Therefore no conflict is reported and the corrections are applied as ruled.**

---

# Stage 6.2 Decision Index *(v2)*

```text
OPEN-13 → ORDINAL CONSTANT-STEP METRIC FOR DISCLOSED COMMITTED MOMENTS, windowed viewport,
          plus RELATIVE PROGRESSIVE TRAVERSAL for later current-session time
        → distance expresses committed order only and never rescales; the firewall is a
          DISCLOSURE rule, so later Moments stay reachable — disclosure past TC is earned
          one Moment at a time by explicit navigation, never given passively. [REV-01]

OPEN-12 → CO-TEMPORAL, INTENT-DISTINCT; AFFORDANCES MAY BE SPATIALLY DISTINCT:
          Moment(LH) is the final ordinal step; LIVE_EDGE is an OUTBOARD NON-METRIC LIVE
          CONTROL anchored to the same Live boundary, consuming no ordinal distance
        → the active indicator's position still states the mode, but the separation is
          control composition, never temporal distance. [REV-02]

OPEN-02 → INTENT IS CHOSEN BY WHICH ACT IS INVOKED, NOT BY WHERE THE USER POINTS:
          one target set, two distinct commit acts — temporal-only, and Temporal+Locate
        → one user act, one RH transaction; ordinary selection can never become spatial,
          and no mode, state member, or persistent follow is introduced. [unchanged]

OPEN-14 → NO AGGREGATION IN V1
        → under a constant step there is no dense case to aggregate; total extent is
          handled by windowing and forward traversal. Frozen subject to the seven
          conditions proved in §17.1. Nothing dormant is retained.
```

---

# 1. Authorization compliance

| Requirement | Compliance |
|---|---|
| Targeted research R-01…R-04 only | Four questions, seven sources, recorded in §2 with the six required fields each. No Stage 5 research repeated. |
| OPEN-13 decided first | Decided in §5–§10 before any other item; OPEN-12 and OPEN-02 are resolved **under** the selected scale; OPEN-14 is resolved last. |
| EG-01 — distance meaning in every temporal condition | §8 (contract), §9 (Live vs pinned geometry), §10 (Preview/input mapping boundary). All three EG-01 layers separated explicitly. |
| EG-02 — no conventional slider/scrubber topology assumed | §21, **narrowed under REV-03**: what is frozen is the epistemic constraint plus the incompatibility of a **full-session** range control while `PINNED`. No ARIA role is frozen; 6.4 retains authority over restricted-region and `FOLLOW_LIVE` range semantics. |
| EG-03 — two intentionally selectable meanings, not necessarily two permanent controls | §11–§13, **corrected under REV-02**: the answer is one ordinal Track plus an **outboard non-metric Live control** — co-temporal with `Moment(LH)`, intent-distinct, consuming no ordinal distance. |
| EG-04 — combined intent without a mode | §14–§16. No persistent follow, no locate mode, no new state member, no silent locate. |
| EG-05 — aggregation stays a presentation construct | §17–§19. Resolved as **no aggregation in v1**, so the risk does not arise; nothing dormant is retained. |
| Visible semantics vs internal mapping distinguished | §10, as its own contract with three named layers. |
| Post-TC non-metric / no-enumeration firewall preserved | §20 — audited clause by clause. **Corrected under REV-01:** the firewall is enforced as a **disclosure** rule, not by making later Moments unreachable; forward navigation remains possible and is proved in §24 (REV-AT-01). |
| Architecture Ruling v1 applied exactly (REV-01…REV-05, §7 conditions) | §0 change note; the Stop-Rule check ran **before** applying and found no conflict. Only the ruled areas were changed; the mandated re-runs are marked **[re-run v2]** in §23–§24. |
| Do not revive OPEN-08 coarse stepping | Not proposed anywhere. §19 states explicitly that the density decision does not rest on it and does not presume 6.4's answer. |
| Do not resolve 6.3 / 6.4 OPENs | None resolved. Accessibility and mobile appear as **requirements**, with topology left to 6.4 (§21, §22). |
| Two proof boards, scaffolding only | §25, §26. No decorative styling; DT-15 and X-10 test exactly this. |
| No repo changes / no coding | Confirmed. Package is local, outside the repository. |
| Do not declare Stage 6.2 frozen | Not declared. |
| STOP if a new semantic rule is required | **Not required.** §32 records the Stop-Rule check against all eight listed triggers. |

---

# 2. Research inventory

Four questions, seven sources. Each recorded as: source · authority/type · principle reused · QANDEEL implication · conflict with frozen semantics · pattern explicitly not copied.

## R-01 — Temporal scale semantics

**S1 · EventLines: Time Compression for Discrete Event Timelines (arXiv 2507.17320, 2025)** — peer-reviewed-style research paper with user study.
- **Principle reused:** proportional time layout fails on bursty, irregularly spaced discrete events in three specific ways — dense bursts overlap and become individually indistinguishable, inactive periods consume screen space while conveying little, and dense regions become hard to target or read. Ordinal spacing (equal space between adjacent events regardless of elapsed time) is the readability answer.
- **QANDEEL implication:** the paper's stated cost of ordinal spacing — that it "severs the intuitive link between visual distance and temporal magnitude", leaving users with "no idea how much time each interval represents" — is, for QANDEEL, **the required behaviour, not a cost**. T-06 confines the Track to temporal orientation plus anonymous committed structure, and S34-WORLD-06 forbids geometry from manufacturing meaning. A scale that lets users infer elapsed magnitude from distance is doing more than QANDEEL permits.
- **Conflict with frozen semantics:** none, once the sign of the trade-off is inverted as above.
- **Not copied:** the paper's compression glyphs (coils, stipples, rectangles) that *encode* how much time a compressed gap represents. Those re-introduce a magnitude channel — forbidden generally by S34-WORLD-06 and fatally by T-07 anywhere near the post-`TC` boundary. QANDEEL takes the ordinal spacing and rejects the gap-magnitude glyph.
- **Also not copied:** the paper's finding that users *prefer* proportional layouts for absolute-time estimation is a finding about a task QANDEEL's Timeline does not offer. It is not a reason to adopt proportional geometry.

**S2 · LifeLines / LifeLines2 (HCIL, University of Maryland)** — foundational research system for dense personal-history timelines.
- **Principle reused:** overview-plus-detail with direct access from overview to detail; rescaling and filtering as the density remedy.
- **QANDEEL implication:** confirms density is a real and long-studied problem, and that the standard remedies are *rescaling* and *filtering* — both of which QANDEEL must refuse (rescaling changes what distance means; filtering the Track would make it selective about anonymous structure). This pushed the density answer toward **windowing** (reduced simultaneity, unchanged geometry) rather than either remedy.
- **Not copied:** LifeLines' use of **line colour and thickness to indicate relationships or significance**. Encoding significance in a temporal display is precisely what S34-WORLD-06 forbids; QANDEEL's Track may never say that anything on it matters more than anything else.

## R-02 — Live edge vs absolute position

**S3 · Vidstack Player — Live API documentation** — implementation-authoritative for a widely used live playback client.
- **Principle reused:** "at the live edge" and "at the latest available position" are tracked as **separate states** (`live`, `liveEdge`, `userBehindLiveEdge`), and returning to the edge is an **explicit user act** — the player "will consider the user not to be at the edge and **not catch them up automatically**".
- **QANDEEL implication:** independent corroboration of frozen S5-STATE-02 and S5-RET-03 — falling behind must not self-heal, and returning to Live must be explicit. It also shows a working system distinguishing "following" from "at the newest point", which is exactly OPEN-12's problem.
- **Conflict with frozen semantics:** the model's *mechanism* conflicts. Vidstack defines the edge as a **tolerance window** (`liveEdgeStart` → `seekableEnd`) and "behind" as a threshold (a deliberate seek of more than ~2 seconds). QANDEEL's distinction is **categorical, not proximity-based**: `Moment(LH) ≠ LIVE_EDGE` by target kind (T-02), even at identical coordinates and zero elapsed difference.
- **Not copied:** the tolerance window, the threshold definition of "behind", and media-player scrubber chrome generally. A proximity rule would make the frozen distinction an approximation.

**S4 · hls.js / native iOS live-edge behaviour (as documented in S3 and the HLS ecosystem)** — implementation reference.
- **Principle reused:** implementations differ on where the edge *is* (a configured delay versus the furthest seekable point), which is evidence that "the edge" is a **defined construct**, not a self-evident coordinate.
- **QANDEEL implication:** the Track must **define** its terminus explicitly rather than let it emerge from layout — which is what §8 TL-09/TL-10 do.
- **Not copied:** buffer-derived or latency-derived edge positioning. QANDEEL's terminus is fixed-extent and content-independent.

## R-03 — Accessible temporal / range navigation

**S5 · W3C WAI-ARIA APG — "Communicating Value and Limits for Range Widgets"** — normative-adjacent W3C authoring guidance.
- **Principle reused:** `aria-valuenow` is **required** for the `slider` role; where a value is indeterminate or unknown the guidance is to **omit** the property; `aria-valuetext` replaces the numeric value when the number is not meaningful.
- **QANDEEL implication *(narrowed in v2 under REV-03)*:** a **single full-session** range control whose exposed bounds and value encode extent spanning post-`TC` material is **incompatible with `PINNED`** — `aria-valuenow` is required for `slider` and must sit inside declared bounds, and the guidance's omission remedy is not available to that role. What this does **not** establish is that range semantics are unavailable in general: they may yet be valid for a restricted disclosed region, under `FOLLOW_LIVE`, or in combination with a separate non-metric forward-navigation mechanism. **That determination belongs to 6.4.** Stage 6.2 freezes only the epistemic constraint (§21).
- **Conflict with frozen semantics:** yes, and the frozen rule wins. T-07 and S5-DISC-07 forbid exposing future-relative extent, count or position in any surface, including accessibility metadata.
- **Not copied:** a **full-session** `role="slider"` with min/max/value spanning post-`TC` material; the APG Media Seek Slider example as a topology template; per-Moment focus enumeration of a whole session; `aria-setsize`/`aria-posinset` over the committed set.

**S6 · W3C WCAG 2.2 — Success Criterion 2.5.8 Target Size (Minimum)** — W3C Recommendation.
- **Principle reused:** pointer targets must be at least 24 × 24 CSS pixels, subject to five documented exceptions (spacing, equivalent, inline, user-agent, essential).
- **QANDEEL implication *(narrowed in v2 under REV-04)*:** this is a **pointer-target sizing criterion owned by 6.4**, not a semantic property of the temporal scale. It does not require each semantic Moment to become an independently exposed 24 × 24 target, and a spatial-value control can constitute a single target for the criterion. **It is therefore not used as a reason to select ordinal scale**, and no per-Moment pixel target is canonical in Stage 6.2.
- **Not copied:** the criterion as a *scale* justification; that inference was withdrawn in v2.

**S7 · W3C WAI-ARIA APG — Slider Pattern** — W3C authoring guidance.
- **Principle reused:** the pattern's own attribute requirements, used as the test subject for EG-02 rather than as a template.
- **Not copied:** the pattern itself, for the reason in S5.

## R-04 — Dense temporal navigation / neutral aggregation

Covered by **S1** and **S2** above; no additional source was needed once the density question resolved into a geometry question (§17).
- **Principle reused (S1):** the readability problem in dense timelines is created by *variable* space per event; equalising space per event removes it at the root.
- **QANDEEL implication:** if the step is constant, density per unit distance is invariant and there is no dense case in the geometric sense — which is why §17 concludes v1 needs no aggregation at all.
- **Not copied (S2):** clustering that communicates cluster weight, and any aggregate whose visual amplitude tracks how much it contains.

**Research authority rule observed throughout:** external sources challenged proposals and shaped them; none was permitted to alter `S`, target kinds, no-hindsight, Timeline domain, `RH` semantics, historical projection, or Map authority. Where S3's mechanism conflicted with T-02, the source implication was **rejected**, not the frozen rule.

---

# 3. Research synthesis

Four findings, each of which changed or hardened a decision:

1. **Ordinal spacing's famous weakness is QANDEEL's requirement.** S1 documents that ordinal layouts stop users inferring elapsed duration from distance. Every other product treats that as the price of readability; QANDEEL needs it as a property, because the Track is forbidden from encoding anything but committed order (T-06, S34-WORLD-06). This converted a trade-off into an alignment and is the single strongest argument for the selected policy.

2. **Constant step removes the density case at its root.** S1 identifies *variable* space per event as the cause of overlap, illegibility and unreachable targets; equalising space per event removes it. That is the argument for constant step — and it is a **legibility and neutrality** argument, not an accessibility-sizing one. *(v2, REV-04: the earlier version of this finding leaned on WCAG 2.5.8; that inference is withdrawn — pointer-target sizing is 6.4's, and it never belonged in the scale justification.)*

3. **A full-session range control cannot be made compliant while pinned.** S5 shows `slider` requires a current value inside declared bounds, and that omission is the guidance only where a role permits it. While `PINNED`, an honest bound for a *whole-session* control describes extent including post-`TC` material. EG-02's suspicion is therefore confirmed **for that specific topology**. *(v2, REV-03: it does not generalise — restricted-region or `FOLLOW_LIVE` range semantics remain open, and 6.4 decides.)* The contract states epistemic requirements and leaves topology to 6.4.

4. **Distinguishing "following" from "at the newest point" is a solved problem — but not by proximity, and not by distance either.** S3 shows a real system keeping the two states separate and refusing to auto-catch-up, corroborating frozen behaviour; its tolerance-window mechanism is rejected because QANDEEL's distinction is categorical. *(v2, REV-02: v1 over-corrected by giving `LIVE_EDGE` its own ordinal position. The distinction is one of **intent**, not of temporal distance — so the Live affordance is now outboard and non-metric, spatially distinct but co-temporal.)*

---

# 4. Frozen Timeline constraint register

Every clause below bound at least one decision in this package. None was reinterpreted.

| ID | Constraint | Where it bound a decision |
|---|---|---|
| **T-01 / S5-TL-01** | Current Session only, `M_current = { m0 < … < LH }` | Scale is a within-session commitment; no cross-session extent exists to draw (§8). |
| **T-02 / S5-TL-02** | Two target kinds; `Moment(LH) ≠ LIVE_EDGE`; commit semantics per kind | The entire OPEN-12 contract (§12) and the outboard non-metric Live control (TL-09/10). **The kinds differ in intent, not in temporal coordinate** — v2's REV-02 correction. |
| **T-03 / S5-TL-03** | Preview → Commit → Settle; `PTC ∉ S`; no Preview `RH`; no hidden commit | The input-mapping layer (§10) and the P3a grammar (§15). |
| **S5-TL-04** | Deliberate spatial input cancels Preview and discards `PTC` | §10 mapping contract. |
| **T-04 / S5-TL-05** | Temporal intent ≠ spatial intent; locate needs explicit authority | OPEN-02's whole shape (§14–16); the rule that position never determines intent. |
| **S5-TL-06 / S5-RET-07** | Settle-time locate; 1 / 0 / >1 outcomes; multi-locus choice is a separate transaction | §16 locus contract. |
| **T-05 / S5-DISC-04** | Current-session `SP` is the only Track address | Steps are `SP`-ordered; no `RTO`/`KF`/`VF-VT`/age/Map position enters geometry (§8). |
| **T-06 / S5-DISC-01,02** | Temporal orientation + anonymous committed structure only; no analytical disclosure | TL-01/TL-03; the rejection of aggregate weight (§17). |
| **T-07 / S5-DISC-05** | Post-`TC` non-metric; no count, density, magnitude, markers, subdivision, focus-stop enumeration | TL-11 and TL-16…TL-19. **Read correctly in v2 (REV-01): this is a *disclosure* firewall, not a navigation-coordinate prohibition.** Later current-session Moments remain reachable; what is forbidden is *passively disclosing* how much lies beyond `TC`. |
| **S5-DISC-06** | Live meta may say only "live continued" and "a route back exists" | §12 E-06; terminus content while pinned. |
| **T-08 / S5-DISC-07** | Accessibility parity; final topology not frozen | §21 in full. |
| **S5-RH-02** | Mode is an effective difference at equal coordinates | Why the indicator's position, not a label, carries mode (§12). |
| **S5-RH-04/05** | True no-op writes no `RH`; passive events write no `RH` | §16 L-03; window scrolling and Preview write nothing. |
| **S34-WORLD-06** | Geometry must not manufacture meaning | TL-01/TL-03/TL-05 and the entire aggregation refusal. |
| **S34-WORLD-08** | Narrow may reduce simultaneity, never truth | TL-06 windowing; §22. |
| **S5-PROOF-03** | "No per-Moment future enumeration" is frozen; a single composite control is not | §21's requirement-not-topology stance. |
| **S5-PROOF-05** | A pending contextual choice carries no canonical authority until selection | §16 L-04. |

| **S5-TL-03 (Preview)** | Preview may legitimately move to a later `PTC`; later Preview reveals only truth legitimate at that `PTC` | The whole forward-navigation mechanism (TL-16…TL-19). v2's model **uses** this frozen behaviour rather than adding anything: disclosure past `TC` is Preview disclosure, earned act by act. |

**Explicit non-conflict, recorded because it is the obvious challenge.** The Track is **not** the Map. `S34-WORLD-05` (`Home(e, t ≥ establishment) = constant`) governs canonical Map loci; Track coordinates are Timeline geometry addressed from `SP` and are not world-space commitments. Nothing in this package assigns, moves, or implies a Map locus. Likewise `S5-PROJ-02` (future-unavailable material is absent, no future-shaped slot) governs Map material: the non-metric Live control expresses the **present** Live boundary, and the forward-traversal affordance is the **frozen non-metric reachability Stage 5.3 explicitly permits** — neither is a slot standing in for absent future content, and neither occupies ordinal Track distance.

---

# 5. OPEN-13 option space

Four families were carried to comparison. Arbitrary spacing is not an option (gate §4) and was not evaluated.

## A1 — Ordinal, constant step *(committed-position scale)*
Visible distance expresses committed conversational order; every committed Moment occupies one step of identical, fixed extent; the Track is longer when there are more Moments, and the viewport is a window over it.

**Attacked with:** long pauses (a pause commits nothing, so it consumes no distance — truthful under an order axis); dense bursts (N Moments occupy N steps exactly as N spread Moments would); perception of equal importance (equal spacing asserts *no* comparative claim, which is what S34-WORLD-06 requires — the failure mode would be *unequal* spacing); mobile density (fewer steps visible, identical step size); post-`TC` firewall (the metric region simply stops at `TC`).

## A2 — Ordinal, fit-to-width
Same ordinal premise, but the step is computed so the whole session fits the available width: `step = width / |M_current|`.

**Attacked with:** the step shrinks as the session grows, so **distance silently changes meaning** from "one Moment" to "one Moment out of however many exist"; every Moment's position moves whenever a new one is committed, destroying spatial memory; in a long session steps become too small to distinguish or operate; and under `PINNED`, fitting "the session" raises the question of whether post-`TC` material is included in the fit — if yes, the total extent leaks future magnitude directly. **Fails on three independent grounds.** *(v2: the operability point is stated as legibility, not as a WCAG threshold — REV-04.)*

## B — Duration-proportional
Visible distance expresses elapsed current-session time.

**Attacked with:** long silences consume large empty distance that reads as a section break or significance (S1's documented failure, and a S34-WORLD-06 violation); dense bursts collapse below usable; it requires per-Moment timing to reach the view layer (a storage/contract dependency, the CUT-05 trap Stage 6.1 flagged); accessible value semantics would describe elapsed magnitude; and under `PINNED` the post-`TC` region's natural extent would be proportional to elapsed time since `TC`, **leaking future magnitude directly** — the T-07 breach is structural, not incidental.

## C — Adaptive / hybrid
Scale varies with local density to keep both duration information and usability.

**Attacked with:** the adaptation itself is a density encoding — the very magnitude channel T-06/T-07 and S34-WORLD-06 exclude; the meaning of distance changes across the Track and over time, so no single sentence can state what distance means (failing EG-01 at its first requirement); positions shift as density changes, destroying spatial memory; determinism and testability suffer; and near `TC` the adaptation would have to consult post-`TC` material to decide the local scale, which is a firewall breach at the calculation layer.

---

# 6. OPEN-13 comparative decision matrix

`✔` satisfies · `~` partial / conditional · `✘` fails.

| Criterion | A1 constant step | A2 fit-to-width | B duration-proportional | C adaptive |
|---|---|---|---|---|
| Semantic clarity — one sentence states what distance means | ✔ | ~ *(meaning drifts with session size)* | ✔ | ✘ |
| Stage 5 compatibility | ✔ | ~ | ~ | ✘ |
| No-hindsight safety (T-07) | ✔ *(metric region stops at `TC`)* | ✘ *(fit may include post-`TC`)* | ✘ *(extent ∝ elapsed since `TC`)* | ✘ *(adaptation consults post-`TC`)* |
| Live ↔ pinned continuity | ✔ *(same step both modes)* | ✘ *(refit on entering pinned)* | ~ | ✘ |
| Dense-session usability | ✔ *(density per distance invariant)* | ✘ | ✘ | ~ |
| Long-gap usability | ✔ *(gaps cost nothing)* | ✔ | ✘ *(empty expanse)* | ~ |
| Touch / mobile viability — legibility and operability of a step | ✔ *(uniform, predictable extent; sizing topology is 6.4's)* | ✘ | ✘ | ~ |
| Accessibility viability | ✔ *(no extent semantics needed)* | ✘ | ✘ *(value = elapsed magnitude)* | ✘ |
| Implementation determinism | ✔ | ✔ | ~ *(timing dependency)* | ✘ |
| Aggregation compatibility | ✔ *(removes the need — §17)* | ✘ | ✘ | ~ |
| Testability without styling (DT-15) | ✔ | ✔ | ~ | ✘ |
| Spatial memory | ✔ | ✘ | ~ | ✘ |

**A1 is the only family whose *disclosed* geometry is safe under the no-hindsight rule without consulting or encoding anything beyond `TC`.** The other three either include post-`TC` material in a fit, take extent from elapsed time since `TC`, or must inspect post-`TC` density to choose a local scale.

---

# 7. OPEN-13 recommended v1 policy *(revised — REV-01, REV-02, REV-04)*

# **A1 — Ordinal constant-step metric for disclosed committed Moments**

with a **windowed viewport**, an **outboard non-metric Live control**, and **relative progressive traversal** for later current-session time.

**Why, in one paragraph.** The Track's only frozen job is temporal orientation over anonymous committed structure. A constant step says exactly that and nothing more: it asserts order and adjacency and makes no claim about duration, importance, or density. Because the step never varies, real-time density has no geometric consequence and every disclosed Moment is represented identically. The one thing A1 gives up — reading elapsed time off the axis — is a disclosure QANDEEL is not permitted to make.

**What v2 corrects in this recommendation.** v1 attached two things to the scale that do not belong to it. **First**, it treated the firewall as a property of geometry — "the metric region ends at `TC`, so there is nothing after it to measure" — and then hardened that into unreachability. The geometry claim is right and is kept; the unreachability conclusion is wrong and is removed (REV-01). Later current-session Moments remain navigable through §8's traversal contract. **Second**, it justified the scale partly by pointer-target sizing; that is 6.4's concern and is withdrawn (REV-04). Neither correction changes the selected policy: A1 wins on semantic clarity, neutrality, spatial memory and disclosure safety alone.

---

# 8. OPEN-13 full semantic scale contract

| ID | Clause |
|---|---|
| **TL-01** | **Meaning of distance.** Distance along the metric region expresses **the number of committed Moments between two positions** — nothing else. The Track asserts order and adjacency. It asserts nothing about elapsed time, duration, importance, density, confidence, or content. |
| **TL-02** | **Constant step.** Every committed Moment of the current Session occupies exactly one *step* of identical extent. The step does not vary with Moment count, session length, elapsed real time, viewport width, content, or mode. |
| **TL-03** | **No duration claim.** The Track carries no elapsed-time encoding: no time axis, no duration labels, no gap glyphs, no compression indicators whose size or form expresses how much time passed. Elapsed time between Moments is not a Track disclosure. |
| **TL-04** | **Pauses cost nothing.** Real time passing with no committed Moment consumes no distance. This is truthful under TL-01: a pause commits nothing, and the axis counts commitments. |
| **TL-05** | **Bursts cost exactly their count.** `N` Moments committed in a short real interval occupy `N` steps, identically to `N` Moments spread over hours. Real-time density has **no** geometric consequence. This is the neutrality guarantee. |
| **TL-06** | **Windowed viewport.** The visible Track is a window over the metric region. Window position is an interaction concern with no semantic content: moving the window discloses nothing, commits nothing, changes no state, and writes no `RH` (S5-RH-04/05). |
| **TL-07** | **No rescale, ever.** The step is never recomputed to fit content, viewport, session length, or mode. Fit-to-width is rejected: it would make distance mean "one Moment out of however many exist", changing what the axis asserts as the session grows. |
| **TL-08** | **Step extent is uniform; pointer sizing is not a Stage 6.2 semantic.** Ordinal separation — that every disclosed Moment occupies an identical extent — is contractual. The **pixel size** of that extent, hit-area shape, spacing technique and any conformance target are **6.4's pointer-target/accessibility topology**, not scale semantics. No per-Moment pixel target is canonical here, and proof boards use generous hit areas as scaffolding only. *(v2 — REV-04.)* |
| **TL-09** | **Outboard non-metric Live control.** `LIVE_EDGE` is expressed by a **non-metric Live control anchored to the Live boundary**, outboard of the ordinal Track. It **consumes no ordinal Track distance**, is unsubdivided, is a single target — never a range — and its extent is a design constant depending on nothing: not `LH`, not elapsed time, not what exists beyond `TC`. **It is not a step, and there is no "Moment after `LH`".** *(v2 — REV-02.)* |
| **TL-10** | **Co-temporal, intent-distinct.** The Live control and `Moment(LH)` refer to the **same current temporal boundary**; they differ in target kind and in future behaviour, not in temporal position. Spatial separation between them is **control composition for operability**, and the UI must never imply elapsed or ordinal distance between them. Under `PINNED(TC)` the same control additionally carries permitted Live meta — live continued, a route back exists (S5-DISC-06). One construct, two roles, no third mode. |
| **TL-11** | **Disclosed metric region.** The ordinal constant-step metric applies to **disclosed legitimate Moments up to the current disclosure horizon** (TL-17). At rest the horizon is `TC`, so material after `TC` is not stepped, not positioned, not hit-tested, not counted, and not included in the Track's resting extent or scroll range. |
| **TL-12** | **Live ↔ pinned continuity.** The same step and the same geometry serve both modes. Entering or leaving `PINNED` does not re-lay-out the metric region; the position of every Moment `≤ TC` is unchanged. Spatial memory of the Track survives every temporal act. |
| **TL-13** | **Active-target indication.** Exactly one active-target indicator exists. Its **position** states the temporal mode: on the step of `TC` when `PINNED(TC)`; on the **Live control** when `FOLLOW_LIVE`. Mode is shown structurally, not inferred from styling and not carried only by a label. Because the Live control is outboard and non-metric, this states mode **without** asserting that following is "one position later" than pinning at `LH`. |
| **TL-14** | **Discontinuity indicator.** When the window is scrolled such that the final disclosed position is not adjacent to the Live control, a fixed-extent, non-metric discontinuity indicator marks the break. It states only *that* the Track continues; it never encodes how far, how many, or how long. |
| **TL-15** | **No Track element derives from forbidden facts.** No position, extent, subdivision, or indicator on the Track may be computed from `RTO`, `KF`, `VF/VT`, object age, Thread age, Map position, or any undisclosed material after the current horizon (T-05, T-07). |

## Post-`TC` navigation contract *(v2 — REV-01)*

| ID | Clause |
|---|---|
| **TL-16** | **Later current-session time remains reachable.** While `PINNED(TC)`, explicit temporal navigation toward `TC < m ≤ LH` **must remain possible** — Preview may move to a later `PTC` and a later `Moment(m)` may be committed under the frozen grammar. The post-`TC` rule is a **disclosure** firewall (S5-DISC-05), never a prohibition on navigation coordinates or input mapping. |
| **TL-17** | **Disclosure horizon.** The Track discloses the ordinal metric region up to a **disclosure horizon** `H`: at rest `H = TC`; during an active forward Preview `H = PTC`. Newly disclosed Moments append **one step at a time at the constant step**, so no earlier position moves and nothing rescales (TL-07, TL-12). On Preview cancellation `H` returns to `TC` and the transiently disclosed steps are withdrawn — `PTC ∉ S`, and nothing was committed or recorded (T-03, S5-RH-05). |
| **TL-18** | **Relative progressive traversal — the forward mechanism.** Forward navigation past `TC` is **relative, never positional**. Input magnitude (drag delta, key repeat, held activation) maps to a **count of single-Moment increments** applied to the prospective `PTC`. The unit is always **one Moment** — the frozen ±1 adjacency of `M_current`. No coarser unit is defined, selectable, or exposed, and no input position anywhere maps to a chosen distance-into-the-future. |
| **TL-19** | **The forward affordance discloses nothing at rest.** It has **no proportional extent, no thumb whose position implies a remainder, no scroll range including undisclosed material, no tick, no end-stop that reveals how far away `LH` is, and no enumeration or set of future targets**. It affords *direction and continuation only*. A user learns how much lies beyond `TC` **only** by traversing there — which is the same knowledge committing there would legitimately give them (S5-TL-03: later Preview reveals only truth legitimate at that `PTC`). Reaching `LH` is arrival, not disclosure. |

---

# 9. Live vs pinned geometry contract

| | `FOLLOW_LIVE` | `PINNED(TC)` |
|---|---|---|
| **Disclosed metric region** | `m0 … LH`, constant step | `m0 … TC` at rest, constant step, **identical positions** for every Moment ≤ `TC`; extends to `PTC` **only** during an active forward Preview (TL-17) |
| **Live control** | expresses `LIVE_EDGE`; outboard, non-metric, fixed extent, **no ordinal distance consumed** | same control, same extent; additionally carries permitted Live meta |
| **Forward traversal affordance** | not applicable — there is nothing later than `LH` | present; relative and non-positional (TL-18); discloses nothing at rest (TL-19) |
| **Active indicator** | on the Live control | on the step of `TC` |
| **On a new live commit** | one step appends; the window shifts by one step so the Live control stays anchored; **no rescale**; the indicator does not move relative to the Live control, so "following" is visibly stable | the disclosed region does not change; the Live control does not change extent; the forward affordance does not change; only permitted Live meta may update — *live has continued*, and a route back exists |
| **Does the Track rescale as Live advances?** | **No.** The step is invariant (TL-07); the Track grows by one step and the window moves. | **No.** Nothing grows visibly at all. |
| **What a user can infer about post-`TC` at rest** | not applicable — `TC = LH` | **only** that live continued, that later time exists and is reachable, and that a route back exists. Not how much, not how many, not how long, not how far |
| **What a user can learn by acting** | — | exactly as much as they have **traversed**, one Moment at a time, which is the same truth committing there would legitimately give them (TL-19, S5-TL-03) |

**Spatial memory retained under `PINNED`:** because TL-12 forbids re-layout and TL-11 excludes undisclosed material from resting extent, moving from Live to a much earlier `TC` leaves every remembered Moment position exactly where it was; the Track does not reflow, recentre, or compact (the Timeline analogue of the frozen no-relayout discipline). Forward traversal appends without moving anything already disclosed, so the same holds while navigating.

---

# 10. Preview / input-mapping boundary

EG-01 requires three layers to be told apart. They are:

## Layer 1 — User-visible semantic geometry
The constant-step metric region up to the disclosure horizon (TL-01/02/11/17), the outboard non-metric Live control (TL-09/10), the forward traversal affordance (TL-18/19), the active indicator (TL-13), the discontinuity indicator (TL-14). **This layer is the only one that makes claims to the user**, and its claims are exactly TL-01's — plus, for the two non-metric affordances, *that live exists* and *that later time is reachable*, with no quantity attached to either.

## Layer 2 — Interaction mapping (input → prospective target)
- **Positional, within the disclosed metric region:** a pointer/gesture position maps to the **step that contains it** → prospective target `Moment(m)`.
- **Single-target:** any position on the Live control maps to `LIVE_EDGE`. It is not a range and never resolves an internal position to a different target.
- **Relative, for later time (v2 — REV-01):** input on the forward traversal affordance maps to a **count of single-Moment increments** applied to the prospective `PTC` (TL-18). **The mapping is from input magnitude to a repetition count, never from input position to a temporal distance** — which is precisely why it can afford unbounded forward navigation while revealing no bound. Each increment advances the horizon by one (TL-17).
- **Non-pointer traversal** moves between adjacent targets — the disclosed steps, the Live control, and forward by single increments. This is the frozen ±1 adjacency of `M_current` (S5-TL-02, S5-DISC-04); **it is not coarse stepping and does not depend on it.**
- Preview remains transient throughout: `PTC ∉ S`, no `RH` write, no hidden commit (T-03), and deliberate Pan/Zoom/inspection cancels Preview and discards `PTC` before executing the spatial act (S5-TL-04). Cancelling also withdraws the transient disclosure (TL-17).

## Layer 3 — Derived hidden calculation
**Permitted:** which step contains a given position; how many single increments an input magnitude represents; which target a traversal step reaches; whether the window is scrolled away from the Live control (for TL-14).
**Forbidden, and not computed even privately for display purposes:** the number of Moments beyond the current horizon, the extent or duration of undisclosed material, `LH − TC` as a quantity, elapsed time between Moments as a geometric quantity, and any ordering derived from `RTO`/`KF`/`VF-VT`/Map position. **An increment must not be clamped against a privately computed remaining count**; traversal simply stops advancing when the horizon reaches `LH`, which is arrival rather than a disclosed bound.

**Answering EG-01's caution directly, as v2 restates it.** A visually non-metric affordance *can* support temporal targeting — and the ruling is right that this is the point. The Live control targets one thing; the forward affordance targets *the next Moment, repeatedly*. Neither requires future structure to be laid out, enumerated, or measured, because **relative mapping needs no extent to map onto**. That is the whole mechanism: navigation is preserved without a coordinate space for what has not been disclosed.

---

# 11. OPEN-12 option space

- **E-α — Two permanent separate controls** (a Track plus a detached "Live" button). Works, but EG-03 warns against assuming it, and it weakens the relationship between the two intents: the Live intent stops being a *place on the Track* and becomes chrome, making "how far behind am I" a question the user answers by inference — and any answer to it is a magnitude.
- **E-β — One target, disambiguated by act** (point at the current end; choose "pin here" or "follow live"). Preserves the distinction but only at the moment of acting: the *state* afterwards is not structurally legible, and DT-02 (Live advances after selecting `Moment(LH)`) is answered only by a label.
- **E-γ — A later ordinal step for `LIVE_EDGE`** ("the terminus beyond the final step"). **This was v1's recommendation and it is withdrawn under REV-02.** It answered the operability problem but paid for it with a falsehood: it manufactured ordinal distance between two things the frozen semantics place at the **same** temporal boundary, and so invited exactly the inference the Track must never support — that following live is "one position later" than pinning at `LH`.
- **E-ε — Outboard non-metric Live control anchored to the Live boundary.** *(recommended, v2)* The Live intent is a **control composed alongside** the ordinal Track, not a position within it. It consumes no ordinal distance, so no distance claim is made; the two intents remain separately discoverable and operable; and the active indicator's position still states the mode. **Co-temporal, intent-distinct; affordances may be spatially distinct.**
- **E-δ — Proximity/tolerance rule** ("near enough to the end counts as live"). **Rejected outright** — it converts a frozen categorical distinction into a threshold (S3's mechanism, explicitly not imported).

**What separates E-ε from E-γ.** Both put the Live affordance somewhere other than on top of the last step, and both therefore solve operability. The difference is what the separation *means*: under E-γ the gap sits **inside** the ordinal axis, where every distance is a claim about committed order; under E-ε it sits **outside** it, where distance carries no temporal meaning at all. The frozen requirement is an intent distinction, and only E-ε supplies one without also supplying a false temporal one.

---

# 12. OPEN-12 recommended structural Experience contract

| ID | Clause |
|---|---|
| **E-01** | **Co-temporal, intent-distinct; affordances may be spatially distinct.** *(v2 — REV-02.)* `Moment(LH)` is the final ordinal step. `LIVE_EDGE` is an **outboard non-metric Live control** anchored to the same Live boundary. They refer to the **same current temporal coordinate** and differ in target kind and future behaviour. The Live control **consumes no ordinal distance**, is not a step, and creates no "Moment after `LH`"; any spatial separation is control composition for operability and **must never be read, labelled, or animated as temporal or ordinal distance**. |
| **E-02** | **Discoverability.** Both are reachable by the same means (pointer, touch, non-pointer traversal), and each is separately nameable. Neither requires a hidden gesture, a modifier, or hover. |
| **E-03** | **Mode legibility.** The active-indicator position states the mode (TL-13): on a step ⇒ `PINNED`; on the **Live control** ⇒ `FOLLOW_LIVE`. A textual state statement accompanies it for non-visual and small-surface parity; the statement never carries counts. |
| **E-04** | **Live advance.** Under `FOLLOW_LIVE`: steps append, the Live control stays anchored, the indicator stays on it — nothing about the user's position changes, which is what following *means*. Under `PINNED(LH)`: a step appends **after** the pinned one and the indicator does not move, so the user sees they are now behind — **without any count, distance-to-live, or "n new" figure**. Note the asymmetry is honest: the appended step is a genuine ordinal successor of `Moment(LH)`, whereas the Live control never was one. |
| **E-05** | **Selecting the latest Moment never follows.** `Commit(Moment(LH)) → PINNED(LH)`, permanently, regardless of what Live does next. |
| **E-06** | **Return to Live is explicit.** It happens by committing the Live control (`Commit(LIVE_EDGE) → FOLLOW_LIVE`) or by the frozen Return to Live Head act. Nothing auto-catches-up, and nothing about being behind decays into following. Committing the Live control is **not** the same act as traversing forward to `Moment(LH)` (TL-18) — the first establishes `FOLLOW_LIVE`, the second `PINNED(LH)`, which is the frozen distinction expressed as two different routes. |
| **E-07** | **Forbidden metadata (any surface).** No count of Moments after `TC`; no "n new"; no distance-to-live magnitude; no progress-through-session ratio; no direction hint beyond the permitted "live has continued, a route back exists". |
| **E-08** | **Live-control persistence.** The Live control remains reachable at the leading edge of the viewport even when the disclosed region is scrolled; TL-14's fixed-extent discontinuity indicator marks the break without encoding its size. The route back to Live therefore always exists (S5-DISC-06) and survives narrow layouts. Being outboard, it is unaffected by how much of the ordinal Track is visible. |

---

# 13. OPEN-12 accessibility / mobile contract *(requirements — topology belongs to 6.4)*

- **A-01** The two targets must be separately reachable and separately nameable, with names that state kind and intent — a selected absolute moment versus the live edge — and **never** a position-in-range. The naming must not imply that one is later than the other.
- **A-02** While `PINNED`, the Track's non-visual representation must expose **no** value, maximum, extent, total, position-in-set, or step count whose value depends on material beyond the disclosure horizon. Under `FOLLOW_LIVE` no post-`TC` material exists; whether any bounded description of committed structure is exposed is **6.4's decision**, not made here.
- **A-03** The Live control must be announced as a **single target with generic meaning**, never as a range, a remainder, or an amount. The forward traversal affordance must be announced as a **direction**, never as a distance or a remaining count.
- **A-04** Mode changes must be perceivable non-visually; "live has continued" is a polite status and must not be re-announced per commit.
- **A-05** The full committed set must not be enumerated as a precondition of navigation, and no future Moment may appear in the accessible tree in any state (S5-PROOF-03).
- **A-06 (mobile)** Narrow viewports reduce the number of visible steps. The step size, the Live-control extent, the forward affordance, the target kinds, and every semantic above are unchanged (S34-WORLD-08). The Live control stays anchored and outboard (E-08), so the intent distinction survives narrow layout by construction — and because it is outboard, narrowing never compresses it into the ordinal Track.

---

# 14. OPEN-02 option space

Two structurally different grammars were compared, plus two rejected shapes. Icon variants were not treated as options.

- **P-A — Distinct commit act on the same target.** *(recommended)* One target set; **intent is chosen by which act is invoked, not by where the user points**. The ordinary commit is temporal-only. A second, explicitly named commit act on the same target carries the one-shot locate entitlement.
- **P-B — Pre-armed locate intent.** A toggle armed before navigating, after which temporal selections also locate. **Rejected:** it is a mode in everything but name (EG-04), it makes ordinary temporal selection spatial while armed (F-02), and being persistent and user-visible it would behave like state.
- **P-C — Post-commit locate.** Commit temporally, then invoke a separate locate act. **Rejected:** P3a is frozen as a *single* act with one entitlement resolved at settle; splitting it produces two transactions, and a generic "locate the current temporal position" act does not exist in frozen semantics — inventing one would be a new semantic rule and would trigger the Stop Rule rather than solve the OPEN.
- **P-D — Modifier-only expression** (e.g. modified click or long-press as the sole route). **Rejected as a sole mechanism:** it fails non-pointer equivalence (DT-12) and discoverability; it may exist only as an *accelerator* alongside P-A.

---

# 15. OPEN-02 recommended interaction grammar

| ID | Clause |
|---|---|
| **P-01** | **The governing principle: the Track expresses *targets*; acts express *intent*.** Position never determines intent. This is the same principle that resolves OPEN-12, applied to the second axis. |
| **P-02** | **Two distinct commit acts** are available on a temporal target: *commit temporally*, and *commit temporally and locate*. Both are explicit, both are named, and the second is never the default. |
| **P-03** | **Ordinary selection is never spatial.** No ordinary temporal commit moves the camera under any circumstance (T-04, F-02). |
| **P-04** | **Recognisability.** The second act must be distinguishable from the first *before* invocation, by name and structure, not only by outcome. Final iconography and copy polish are not frozen here; the requirement that the two acts be distinguishable is. |
| **P-05** | **Pointer / touch.** The Temporal+Locate act is presented as a discrete affordance associated with the target, satisfying the minimum target size (TL-08). It must not be reachable *only* by hover, drag, or modifier. |
| **P-06** | **Non-pointer equivalence.** With a target focused, the two acts are two distinct activations. Equivalent intent must not require pointer-only mechanics (DT-12). The specific activation topology belongs to 6.4. |
| **P-07** | **Accidental-activation resistance.** The locate act must not be the adjacent default of the ordinary act in any input modality — no shared activation with only timing to separate them. |
| **P-08** | **No mode, no state.** The entitlement is one-shot and act-local: no persistent follow, no "locate mode", no addition to `S`, no `RH` marker of its own (EG-04). |

---

# 16. P3a unique / zero / multiple-locus contract

| ID | Clause |
|---|---|
| **L-01** | **One act, one transaction.** The temporal commit is a single `RH` transaction regardless of the locus outcome. The locate entitlement adds no second transaction. |
| **L-02** | **Unique locus.** At settle, `UniqueLocatable(x, K(TC))` yields exactly one locus ⇒ locate once. |
| **L-03** | **Zero loci — temporal success with no entitled spatial landing.** The temporal commit stands; the camera does not move; **the Experience makes no statement about the spatial outcome at all.** Success is evidenced by the temporal state change already visible (TL-13). No failure semantics, no error, no "could not locate", and — consistent with OPEN-19's deferral — **no dedicated acknowledgement is required**. Nothing failed, so nothing is reported. |
| **L-04** | **Multiple loci.** No arbitrary landing. An explicit contextual choice is offered as a **separate act**; it carries no canonical or `RH` authority until selected (S5-PROOF-05); if selected and effective it is its own transaction (S5-RET-07). |
| **L-05** | **Unlocatable at settle** (Emerging / pre-geographic / not legitimate in `K(TC)`) ⇒ treated exactly as L-03. No anticipatory geography is created (S5-HIST-06). |
| **L-06** | **Nothing persists.** After settle, no entitlement, no follow, no residue in `S`. |

---

# 17. OPEN-14 necessity determination

**Question, as the authorization requires it to be asked:** does v1 need aggregation at all under the selected scale and realistic session density?

**Determination: NO.**

1. **Under TL-02 the density problem does not arise geometrically.** Aggregation exists to remedy *variable* space per event — S1 identifies exactly that as the cause of overlap, illegibility and unreachable targets. With a constant step, every disclosed Moment always occupies the same extent, so nothing ever overlaps and nothing collapses. Density per unit distance is **invariant by construction**. *(v2: stated as legibility, not as a target-size threshold — REV-04.)*
2. **What actually grows is total extent, and TL-06 already answers it.** A long session makes the Track longer, not denser. Windowing reduces *simultaneity*, which is precisely the remedy S34-WORLD-08 sanctions and Stage 5 repeatedly permits — as against rescaling or filtering (S2's remedies), both of which QANDEEL must refuse.
3. **Aggregation would introduce a quantity channel with nothing to gain.** Any aggregate must communicate *something* about what it contains, or it is not an aggregate; whatever that is becomes a magnitude on a surface forbidden from carrying magnitudes (S34-WORLD-06, T-06), and near `TC` any such quantity risks T-07 directly.
4. **It would also be a new construct with no frozen semantics** — precisely what EG-05 hedges against and what S5-PROOF-05's discipline discourages.

**Therefore OPEN-14 resolves as "no aggregation in v1", and nothing dormant is retained:** no aggregation UI, no collapsed-cluster state, no aggregation seam, no strategy hook, no fixture asserting aggregate behaviour.

**Honest residual, stated rather than hidden.** Constant-step geometry means reaching a distant Moment in a very long session requires traversing or scrolling the Track. That is a **reach** question, and reach is the frozen v1 obligation Stage 6.1 assigned to **6.4** (truthful non-pointer temporal access, keyboard/assistive equivalence, accessibility parity). This decision does not presume 6.4's answer, does not depend on it, and **does not revive OPEN-08 coarse stepping** — which the Stage 6.1 freeze forbids reviving silently and which is not proposed here in any form. If 6.4 finds the obligation unsatisfiable, the freeze record already directs it to report new dependency evidence; that would be a 6.4 finding, and it would not be answered by reinstating aggregation, which solves a different problem.

## 17.1 The seven conditions on which no-aggregation may freeze *(v2 — Ruling §7)*

| # | Condition | Proof |
|---|---|---|
| 1 | Disclosed ordinal steps keep deterministic meaning | TL-01/02/07: one step = one committed Moment, invariant. The disclosure horizon (TL-17) changes **how many** steps are shown, never **what a step means** — a Moment disclosed under Preview occupies the same extent it will occupy once committed to. |
| 2 | Windowing does not alter semantic target identity | TL-06: window position is an interaction concern with no semantic content. A step's identity is its `SP`-addressed Moment (T-05), which is unaffected by visibility. Scrolling writes no `RH` and commits nothing (S5-RH-04/05). |
| 3 | Long current Sessions remain temporally navigable | Within the disclosed region: direct positional targeting of any visible step, plus windowing to bring others into view. Beyond it: relative progressive traversal (TL-18). Neither depends on aggregation. |
| 4 | Mobile exposes less simultaneously without changing meaning | §22 and A-06: fewer steps visible; step extent, target kinds, the outboard Live control, and every semantic unchanged (S34-WORLD-08). |
| 5 | Non-pointer reach remains 6.4's obligation without reviving OPEN-08 | AX-10 and §17's residual. Nothing here defines, exposes, or assumes a navigation unit larger than one Moment; TL-18 fixes the unit at one and makes magnitude a repetition count. |
| 6 | Post-`TC` navigation remains possible under REV-01 | TL-16…TL-19, proved in REV-AT-01 (§24). Removing aggregation removes no forward route, because the forward route was never an aggregate. |
| 7 | No hidden aggregation or count metadata appears | G-01/G-02; §10 Layer 3's forbidden-computation list; AX-01/A-02. No aggregate object, no cluster count, no set size, and no privately computed remainder exists anywhere in the Timeline path. |

**All seven hold, so the no-aggregation decision is returned as ready to freeze** — with the note that condition 6 is the one the correction materially changed: under v1's unreachability model, condition 6 would have **failed**.

---

# 18. OPEN-14 contract — no aggregation in v1

| ID | Clause |
|---|---|
| **G-01** | **No aggregation exists in the v1 Track.** Every committed Moment ≤ `TC` is individually represented at one constant step. |
| **G-02** | **No dormant aggregation.** No collapsed state, no cluster object, no expand/collapse affordance, no aggregation parameter, and no implementation seam is retained for a future aggregation feature (CUT-06 discipline, carried from the Stage 6.1 freeze). |
| **G-03** | **If aggregation is ever revisited**, it must return through Architecture with the pre-`TC` / post-`TC` rules of EG-05 satisfied. Nothing in this contract prepares for it. |
| **G-04** | **Neither non-metric affordance is an aggregate.** The Live control is a fixed-extent single target (TL-09/10); the forward traversal affordance affords direction only (TL-19). Neither summarises, counts, or represents anything beyond the horizon — together they afford *reachability*, which is exactly what Stage 5.3 froze as permitted. |

---

# 19. Density behaviour

| Situation | Behaviour under this contract |
|---|---|
| **Long real-time pause, no commits** | No distance is consumed (TL-04); the Track is unchanged; neither non-metric affordance grows. A user learns nothing about how long the pause was — correctly, because the Track counts commitments. |
| **Burst of many Moments in seconds** | `N` steps append, each identical in extent to any other step (TL-05). No compression, no overlap, no visual intensity. |
| **Very long session** | The Track is long; the window shows a portion (TL-06); step size is unchanged; each visible Moment remains directly addressable. Reach beyond the window is the 6.4 obligation (§17). |
| **Narrow / mobile** | Fewer steps visible; identical step size and semantics; Live control anchored and outboard (E-08). Simultaneity reduced, truth unchanged (S34-WORLD-08). |
| **Dense structure immediately before `TC`** | Nothing special happens — the density case does not exist geometrically. No aggregation is triggered because none exists. |
| **Large committed region after `TC` while pinned — at rest** | Invisible in every respect: not stepped, not counted, not included in resting extent or scroll range (TL-11); the Live control and the forward affordance look and behave identically whether one Moment or a thousand lie beyond `TC` (TL-09, TL-19). |
| **Large committed region after `TC` while pinned — under forward traversal** *(v2)* | The user advances the prospective `PTC` one Moment at a time; each increment discloses exactly one further step at the constant step (TL-17/18). They learn only what they have reached, never what remains. Cancelling withdraws the transient disclosure and writes nothing (T-03, S5-RH-05). |

---

# 20. Post-`TC` no-hindsight audit

**The audit is now stated as the ruling requires: the firewall governs *passive disclosure*, while navigation remains possible.** Every row below therefore asks whether the prohibited fact can be obtained **without the user having navigated there**.

| Frozen prohibition (T-07 / S5-DISC-05) | How this contract prevents it |
|---|---|
| Future **count** | Nothing beyond the horizon is stepped or enumerated (TL-11); no count — including `LH − TC` — is computed even privately, and increments are never clamped against a remaining count (§10 Layer 3). |
| Future **density** | Nothing beyond the horizon has geometry; both non-metric affordances are unsubdivided (TL-09, TL-19). |
| Future **magnitude / extent** | The Live control's extent is a **design constant** (TL-09) and the forward affordance has **no proportional extent, thumb, or end-stop** (TL-19). A thousand Moments and one Moment produce an identical resting picture. |
| Future **semantic markers** | Only permitted Live meta — live continued, route back exists (S5-DISC-06, E-07). |
| Future **subdivisions** | Forbidden (TL-09, TL-19); neither affordance is a range (§10 Layer 2). |
| Future **structure** | No structure beyond the horizon exists in the visible layer, the mapping layer, or the accessible tree (A-02, A-05). |
| Future **focus-stop enumeration** | Traversal targets are the disclosed steps, the Live control, and *the next Moment* as a repeated relative act. There is **no set of future focus stops**, because a relative act needs no target list (§10 Layer 2, TL-18). |
| **Scroll-extent side channel** | Undisclosed material is excluded from the Track's resting extent and scroll range (TL-11), so scrollbar proportions cannot leak it. |
| **Discontinuity side channel** | TL-14's indicator is fixed extent and states only that the Track continues — never how far (E-08). |
| **Aggregate side channel** | No aggregate exists (G-01); neither non-metric affordance is one (G-04). |
| **Navigation side channel** *(v2 — the channel the correction opens, and closes)* | Forward traversal *does* let a determined user discover how much lies beyond `TC` — by going there, one Moment at a time. That is not a leak: it is the truth Preview legitimately reveals at each `PTC` (S5-TL-03), earned act by act, and identical to what committing forward would show. What remains impossible is learning it **without** navigating — from the resting control, from a glance, or from metadata (TL-19, AX-01). |

**X-01, X-05, X-08 and REV-AT-01 all test this section and pass** (§24).

---

# 21. Accessibility epistemic audit

## The EG-02 finding, reported rather than worked around — **narrowed under REV-03**

**What Stage 6.2 freezes is the epistemic constraint:** accessible value or range metadata must not reveal future-relative count, magnitude, position, density or extent while `PINNED`.

**What the research additionally establishes, narrowly:** a **single full-session range control** whose exposed bounds and value encode extent spanning post-`TC` material is **incompatible with `PINNED`**. Per W3C APG guidance (S5), `aria-valuenow` is required for the `slider` role and must sit within declared bounds, and the omission remedy is available only to roles that permit it — so for that particular topology the leak cannot be remedied by choosing better values.

**What v2 explicitly does *not* freeze** *(the v1 over-statement, withdrawn)*: that "slider/range topology is structurally unavailable". That is too absolute. **Stage 6.4 retains authority** to determine whether range semantics may be valid for a **restricted disclosed region**, under **`FOLLOW_LIVE`**, in combination with a separate non-metric forward-navigation mechanism, or not at all. **No web-specific ARIA role is frozen here.**

| ID | Requirement |
|---|---|
| **AX-01** | No surface may expose value, maximum, minimum, extent, total, position-in-set, set size, or step semantics **whose value depends on material beyond the disclosure horizon**. |
| **AX-02** | *(narrowed — REV-03)* A **single full-session** bounded-range expression of the Track is invalid while `PINNED`, because its bounds would span post-`TC` material. Whether a range expression is valid for a **restricted disclosed region** or under `FOLLOW_LIVE` is **6.4's decision**; Stage 6.2 neither grants nor forbids it, and freezes no role. |
| **AX-03** | The Live control is announced as a single target with generic meaning — never a remainder, a range, or an amount — and the forward traversal affordance as a **direction**, never a distance or a remaining count (A-03). |
| **AX-04** | `Moment(LH)` and `LIVE_EDGE` must be separately reachable and separately named, distinguished by **kind and intent** — never by position-in-range, and never in a way implying one is temporally later than the other (A-01, E-01). |
| **AX-05** | Temporal mode must be perceivable non-visually and must correspond to the same structural fact the indicator's position expresses (TL-13, E-03). |
| **AX-06** | "Live has continued" is a polite status; it must not be re-announced per commit and must carry no count (A-04). |
| **AX-07** | Navigation must not require enumerating the full committed set, and no future Moment may appear in the accessible tree in any state (A-05, S5-PROOF-03). |
| **AX-08** | Both P3a acts must be invocable without pointer-only mechanics, and distinguishable before invocation (P-04, P-06). |
| **AX-09** | Under `FOLLOW_LIVE` there is no post-`TC` material, so a bounded description of committed structure is **not forbidden**. Whether to expose one is **6.4's decision**; this package neither requires nor supplies it. |
| **AX-10** | **No requirement here is satisfied by reviving coarse stepping.** Non-pointer reach remains 6.4's frozen obligation (Stage 6.1 freeze §3). |
| **AX-11** | *(v2 — REV-01)* Forward navigation past `TC` must be available non-visually as a **relative act** — "move to the next Moment", repeatable — with no exposed target list, no set size, no remaining count, and no announcement of how far `LH` is. Each increment may announce only what it has reached. |
| **AX-12** | *(v2 — REV-04)* Pointer-target sizing, spacing and hit-area topology are **6.4's**, not fixed here. Nothing in this package may be read as freezing a per-Moment pixel target. |

---

# 22. Mobile / narrow audit

| Question | Answer |
|---|---|
| Does the semantic scale survive narrow width? | Yes. The step is constant (TL-02/07); narrow width shows fewer steps, not smaller ones. |
| Is truth reduced? | No — only simultaneity (S34-WORLD-08, TL-06). |
| Do targets remain operable? | Step extent is uniform and predictable, so operability does not degrade with density. **Pixel sizing and hit-area topology are 6.4's** (TL-08, AX-12 — REV-04). |
| Does the `Moment(LH)` / `LIVE_EDGE` distinction survive? | Yes. The Live control is **outboard**, so narrowing reduces visible steps without ever compressing it into the ordinal Track (E-01, E-08). **X-09 passes.** |
| Does forward navigation survive narrow width? | Yes. Relative traversal needs no extent to map onto (TL-18), so it is width-independent. |
| Does anything become metric that was not? | No. Both non-metric affordances have constant extent and do not scale with viewport (TL-09, TL-19). |
| Is any Track semantics device-specific? | No. Layer 1 and Layer 2 are identical across surfaces; only how much of Layer 1 is visible differs. |
| Does dense structure behave differently? | No — the density case does not exist (§19). |

---

# 23. DT-01 … DT-15 results

| Test | Result | Evidence |
|---|---|---|
| **DT-01** **[re-run v2 — hard case, not removed]** `temporal coordinate(Moment(LH)) = temporal boundary(LIVE_EDGE)`; can the user intentionally invoke either without reading visual separation as temporal distance? | **PASS** | v2 keeps the two **co-temporal** (E-01) and distinguishes them by **kind and act**: the final ordinal step commits `Moment(LH) → PINNED(LH)`; the outboard **non-metric Live control** commits `LIVE_EDGE → FOLLOW_LIVE`. The separation is control composition outside the ordinal axis, so it carries no distance claim (TL-09/10), and the board labels it **NON-METRIC LIVE CONTROL** rather than a later step. |
| **DT-02** **[re-run v2]** Live advances right after selecting `Moment(LH)`; does it stay pinned? | **PASS** | `PINNED(LH)` persists (E-05). A step appends after the pinned one — a genuine ordinal successor — and the indicator does not move (E-04): visibly behind, with no count. The Live control is unchanged throughout, because it never occupied an ordinal position. |
| **DT-03** **[re-run v2]** Live advances while `FOLLOW_LIVE`; is the edge intelligible without future structure? | **PASS** | Steps append, the outboard Live control stays anchored, the indicator stays on it (E-04). The control carries no structure and no quantity (TL-09), and its position is unrelated to how many steps exist. |
| **DT-04** long pause, no commits; does geometry keep its declared meaning? | **PASS** | TL-04 — a commitment axis is unaffected by uncommitted time. |
| **DT-05** burst of Moments; usable without implying density? | **PASS** | TL-05 — `N` Moments cost `N` steps regardless of real-time spacing. |
| **DT-06** **[re-run v2]** historical `TC`, large post-`TC` region; is it non-metric and non-enumerative — **while remaining navigable**? | **PASS** | Non-metric and non-enumerative at rest: TL-11, TL-19, §20 — an identical picture for one or a thousand. **And navigable**: TL-16…TL-18 keep later Moments reachable by relative traversal, which is what v1 wrongly foreclosed. The two properties are independent, which is the point of REV-01. |
| **DT-07** dense committed structure before `TC`; can aggregation stay neutral? | **PASS (by removal)** | No aggregation exists (G-01); the density case does not arise (§17). |
| **DT-08** P3a to a unique locus; is combined intent explicit? | **PASS** | P-02/P-04 — a distinct named act; L-02 locates once. |
| **DT-09** P3a to zero loci; temporal success legible without spatial-failure semantics? | **PASS** | L-03 — the temporal change is the evidence; nothing is said about the camera. |
| **DT-10** P3a settles with >1 loci; is contextual choice a separate act? | **PASS** | L-04, S5-RET-07, S5-PROOF-05. |
| **DT-11** **[re-run v2]** screen reader at `Moment(LH)` vs `LIVE_EDGE` without future enumeration | **PASS** | AX-04 distinguishes by **kind and intent**, and forbids naming that implies one is later; AX-01 forbids metadata beyond the horizon; AX-02 *(narrowed)* rules out a full-session bounded range while `PINNED` while leaving restricted-region and `FOLLOW_LIVE` options to 6.4; AX-03 makes the Live control one target and the forward affordance a direction; AX-11 keeps forward navigation available as a repeatable relative act with no set size. |
| **DT-12** keyboard/non-pointer P3a without hover/drag | **PASS** | P-06, AX-08 — two distinct activations on a focused target. |
| **DT-13** **[re-run v2]** mobile narrow Track under dense structure | **PASS** | §22 — fewer steps, same step, same semantics. The Live control is **outboard**, so narrowing never compresses it into the ordinal axis (E-01/E-08), and relative forward traversal is width-independent because it maps magnitude rather than position (TL-18). |
| **DT-14** aggregation expand/collapse alters target meaning or `RH`? | **PASS (vacuously, and deliberately so)** | No aggregation exists (G-01), so no such interaction can exist. Window scrolling writes no `RH` (TL-06, S5-RH-04/05). |
| **DT-15** no visual styling; is the contract still deterministic? | **PASS** | TL-01…TL-19, E-01…E-08, P-01…P-08, L-01…L-06 and G-01…G-04 are stated without reference to colour, icon, type, or motion. Board A and Board B are rendered without decorative styling. |

---

# 24. X-01 … X-10 results

| Test | Expected | Result |
|---|---|---|
| **X-01** **[re-run v2]** non-visual control exposes max/value representing future-relative extent | candidate rejected | **PASS** — AX-01 forbids any metadata whose value depends on material beyond the horizon, and AX-02 rules out a **full-session** bounded range while `PINNED`. The rejection stands on the epistemic constraint, which is what v2 freezes; it no longer relies on the withdrawn absolute claim about range topology (REV-03). |
| **X-02** **[re-run v2]** co-temporal targets, user cannot intentionally choose | candidate rejected | **PASS** — v2 keeps the two **co-temporal** and separates them by kind and act (E-01). A candidate offering no way to choose is rejected; so is one that manufactures ordinal distance to achieve the choice (E-γ, withdrawn) or one that decides by proximity (E-δ). |
| **X-03** long silence | scale stays truthful and usable | **PASS** — TL-04. |
| **X-04** dense burst | usable without implying importance | **PASS** — TL-05 (uniform extent; no intensity channel). |
| **X-05** **[re-run v2]** Live → much earlier `TC` | post-`TC` firewall-compliant; no Map change; no enumeration | **PASS** — the disclosure horizon drops to `TC` and the disclosed region is unchanged in position (TL-11/12/17); the Live control and forward affordance are unchanged in extent; nothing is enumerated (§20); nothing in this package touches Map geography (§4 non-conflict note). **And the transition leaves later Moments reachable** (TL-16), which is the property v1 lost. |
| **X-06** P3a zero-locus comprehension | no communication of temporal failure | **PASS** — L-03 says nothing about the spatial outcome at all. |
| **X-07** P3a multiple loci | choice appears after commit, separate act | **PASS** — L-04. |
| **X-08** pinned state attempts to expose future aggregate density/count | rejected | **PASS** — no aggregate exists (G-01/G-04); the terminus is a constant (TL-09); extent and scroll range exclude post-`TC` (TL-11). |
| **X-09** **[re-run v2]** mobile co-location | distinction survives narrow layout | **PASS** — the Live control is outboard and anchored (E-01/E-08), so it is never compressed into the ordinal Track; forward traversal is width-independent (TL-18). §22. |
| **X-10** **[re-evaluated v2 after board changes]** strip colour/icon/motion polish | semantics remain understandable and deterministic | **PASS** — the rebuilt boards are produced in exactly this state. The two corrections *improve* this result: the Live control is labelled **NON-METRIC LIVE CONTROL** and drawn outside the ordinal axis, and the forward affordance is drawn as a direction with no extent — so neither relies on styling to avoid asserting distance. |
| **REV-AT-01** *(new, mandated)* `LH = 100`, `TC = 40`, `TM = PINNED(40)`. Without exposing 60 future Moments, proportional future extent, or any marker/count/density, can the user intentionally navigate/Preview toward a later `PTC` and commit a later `Moment(m)`? | navigation possible **and** passive disclosure firewall-compliant **and** no future count/extent recoverable from the resting control | **PASS** — see §24.1. |

---

## 24.1 REV-AT-01 — worked trace

**State:** `LH = 100`, `TC = 40`, `TM = PINNED(40)`.

**At rest.** The Track discloses `m0…m40` at the constant step. Outboard sits the non-metric Live control; alongside it the forward traversal affordance. Neither has proportional extent, a thumb, a tick, an end-stop, or a scroll range that includes anything after `m40`. **What the resting control makes recoverable:** that live has continued, that later time exists and is reachable, and that a route back to Live exists. **What it does not:** that there are 60 further Moments, or any quantity from which 60 could be inferred — no extent, no ratio, no density, no set size, no privately computed remainder (TL-19, §10 Layer 3, AX-01).

**The act.** The user invokes forward traversal. Each increment advances the prospective `PTC` by **one Moment** (TL-18) and the horizon with it (TL-17): `PTC = 41` discloses one further step, appended at the constant step, with no earlier position moved and no rescale. Continuing yields 42, 43, … Input magnitude determines **how many single increments** are applied, never how far into the future a position lands — so a long drag advances further without ever having had a distance to aim at.

**Commit.** At any point the user commits: `Commit(Moment(m)) → PINNED(m)`, one `RH` transaction, under the frozen grammar. If instead they cancel, `PTC` is discarded, the horizon returns to `40`, the transiently disclosed steps are withdrawn, and nothing is written (`PTC ∉ S`; T-03; S5-RH-05).

**Why each PASS criterion holds.**
1. **Navigation is possible** — the user reached `m41…m100` and could commit any of them.
2. **Passive disclosure remains firewall-compliant** — everything disclosed was disclosed *as the direct result of the user's own explicit navigation*, which is exactly what frozen S5-TL-03 permits Preview to reveal at each `PTC`. Nothing was disclosed by the Track sitting there.
3. **No future count or extent is recoverable from the resting control** — the resting picture is identical whether 1 or 1,000 Moments lie beyond `TC`, and reaching `LH` is *arrival*, not a disclosed bound: traversal simply stops advancing, and no remaining count was ever computed to clamp against.

**What this test would have shown against v1:** FAIL on criterion 1. That is precisely the defect REV-01 identified, and it is why the correction was necessary rather than cosmetic.

---

# 25. Board A — Scale + Live Edge / Latest Moment

`boards/S6.2_A_Scale_and_Live_Edge.png` — Experience proof scaffolding, **not art direction**.

**Rebuilt for v2.** Shows, as schematic Track diagrams with annotation: the chosen scale meaning (TL-01/02); a long pause consuming no distance; a dense burst consuming exactly its count; `FOLLOW_LIVE` with the indicator on the **outboard non-metric Live control**; `PINNED(TC)` with the indicator on a step; the **co-temporal** case drawn with the Live control explicitly labelled `NON-METRIC LIVE CONTROL` and set outside the ordinal axis with a break glyph, so no ordinal distance is implied (REV-02); Live advance in both modes; the post-`TC` firewall as *identical* resting pictures for one and for many post-`TC` Moments; **the REV-AT-01 forward-traversal sequence** showing earned one-step-at-a-time disclosure at `TC = 40`, `LH = 100`; narrow/mobile; and a non-visual semantic annotation column stating what each state may and may not announce.

---

# 26. Board B — P3a + Dense Structure / Aggregation

`boards/S6.2_B_P3a_and_Density.png` — Experience proof scaffolding, **not art direction**.

**Rebuilt for v2.** Shows: ordinary temporal selection (no camera movement); the explicit Temporal+Locate act as a distinct named act on the same target — **one user act, one `RH` transaction**, never two sequential acts (A-03 of the ruling); unique-locus, zero-locus and multiple-loci outcomes with their transaction boundaries; the separate contextual-choice act carrying no authority until selected; the **no-aggregation** contract under dense committed structure, with the constant step shown as the reason none is needed; the pinned no-hindsight case **with forward traversal available**; and touch plus non-pointer equivalence annotated per act, including the relative forward act (AX-11).

---

# 27. MUST

1. Track distance MUST express committed conversational order only (TL-01).
2. The step MUST be constant and MUST NOT rescale for any reason (TL-02, TL-07).
3. Every disclosed Moment MUST occupy an identical extent; **pointer-target sizing is 6.4's and is not fixed here** (TL-08, AX-12).
4. At rest under `PINNED(TC)`, the disclosed region MUST cover `m0…TC` only, and material beyond the horizon MUST be excluded from geometry, resting extent, scroll range, hit-testing and enumeration (TL-11).
5. The Live control MUST be **outboard, non-metric, unsubdivided, of constant extent, and a single target** in both modes, and MUST consume no ordinal Track distance (TL-09/10).
6. `Moment(LH)` and `LIVE_EDGE` MUST remain **co-temporal, intent-distinct and intentionally selectable**; any spatial separation MUST be control composition only (E-01/E-02).
6a. Explicit temporal navigation toward `TC < m ≤ LH` MUST remain possible while `PINNED` (TL-16), by a **relative** mechanism whose unit is one Moment (TL-18) and which discloses nothing at rest (TL-19).
7. The active-indicator position MUST state the temporal mode (TL-13, E-03).
8. Return to Live MUST be explicit (E-06).
9. Combined Temporal+Locate intent MUST be expressed by a distinct act, never by position (P-01/P-02).
10. Zero-locus outcomes MUST be presented as temporal success with no statement about the spatial outcome (L-03).
11. Multi-locus contextual choice MUST be a separate act with no authority until selected (L-04).
12. Every Track element MUST be derivable from current-session `SP` only (TL-15).
13. Non-visual surfaces MUST obey AX-01…AX-08.

# 28. MUST NOT

1. MUST NOT encode elapsed duration in distance, labels, or gap glyphs (TL-03).
2. MUST NOT let real-time density have geometric consequence (TL-05).
3. MUST NOT rescale or refit the Track (TL-07) — including on entering or leaving `PINNED` (TL-12).
4. MUST NOT expose count, density, magnitude, extent, subdivision, structure or focus stops for material beyond the disclosure horizon, on any surface (T-07, §20, AX-01).
5. MUST NOT express the Track as a **single full-session** bounded range while `PINNED` (AX-02) — and MUST NOT read this as a general prohibition on range semantics, which is 6.4's to decide.
5a. MUST NOT make later current-session Moments unreachable in order to satisfy the firewall (TL-16) — the v1 error this ruling corrects.
5b. MUST NOT give `LIVE_EDGE` an ordinal position, a step, or any implied temporal distance from `Moment(LH)` (TL-09/10, E-01).
5c. MUST NOT map input **position** to a temporal distance beyond the horizon, expose a proportional forward extent or thumb, or clamp an increment against a privately computed remaining count (TL-18/19, §10 Layer 3).
6. MUST NOT let ordinary temporal selection move the camera (P-03, F-02).
7. MUST NOT introduce a locate mode, persistent follow, new state member, or third temporal mode (P-08, F-07).
8. MUST NOT use proximity or tolerance to decide whether the user is "at live" (E-δ rejected).
9. MUST NOT aggregate, nor retain dormant aggregation UI, state, or seam (G-01/G-02).
10. MUST NOT revive coarse temporal stepping in any form (AX-10, Stage 6.1 freeze).
11. MUST NOT use `RTO`, `KF`, `VF/VT`, object age, Thread age, or Map position as geometry or address (TL-15, F-03/F-04).
12. MUST NOT auto-catch-up to Live, and MUST NOT let being behind decay into following (E-06).

# 29. SHOULD / MAY

- **SHOULD** keep the Live control visually and structurally distinguishable from a step without relying on colour alone, and make its *outboard* character evident so no ordinal reading is invited (structural distinction is required; the specific treatment is not frozen).
- **SHOULD** make the forward traversal affordance's relative character evident — a direction, not a distance.
- **SHOULD** provide the Temporal+Locate act as an accelerator (modifier or long-press) *in addition to* the discrete affordance — never instead of it (P-D).
- **MAY** expose a bounded description of committed structure non-visually **under `FOLLOW_LIVE` only**, where no post-`TC` material exists — 6.4's decision (AX-09).
- **MAY** choose final iconography, copy, and the Live control's visual treatment later; none is frozen here (F-11).
- **MAY** decide, in 6.4, whether range semantics apply to a **restricted disclosed region** or under `FOLLOW_LIVE`; Stage 6.2 neither grants nor forbids it (AX-02, REV-03).
- **MAY** decide window-scroll mechanics (momentum, snapping to steps, keyboard scroll) in 6.4/6.5 — they carry no semantics (TL-06).

---

# 30. Implementation-readiness outputs for Stage 6.5

1. **Track geometry contract** — constant step as a declared design constant; resting Track extent = `|{m ∈ M_current : SP(m) ≤ TC}|` × step; Live-control extent as a second constant, **outboard and outside the ordinal axis**, independent of all content.
2. **Data-requirement statement *(narrowed — REV-05)*:** **the Stage 6.2 Timeline contract creates no new requirement to retain Moment timestamps solely for Track geometry** — ordinal geometry needs committed order only. This says nothing about other obligations: runtime, evidence, audit, provenance, analytics or later contracts may independently require timestamps, and this package neither grants nor removes any such requirement.
3. **Target-resolution functions** — (a) *positional*: position → step → `Moment(m)`, defined only within the disclosed region; (b) *single-target*: any position on the Live control → `LIVE_EDGE`; (c) *relative*: input magnitude → integer count of single-Moment increments applied to the prospective `PTC` (TL-18). Acceptance criteria: **no positional input resolves to a Moment beyond the disclosure horizon**, and **no relative increment is computed from, or clamped against, a count of what remains**.
3a. **Disclosure-horizon contract** — `H = TC` at rest, `H = PTC` during forward Preview; appended disclosure never moves an existing position; cancellation withdraws transient disclosure and writes nothing.
4. **Two commit acts** — `commit(target)` and `commit(target, locate: one-shot)`; the second is act-local, resolved at settle, never persisted.
5. **Prohibited computations list** (§10 Layer 3) as explicit test assertions — no beyond-horizon count, no `LH − TC` quantity, no extent, and no elapsed-time quantity is computed anywhere in the Timeline path, including privately for clamping.
6. **Accessibility acceptance criteria** AX-01…AX-12, asserted per temporal mode; the topology itself arrives from 6.4, which also retains the restricted-region / `FOLLOW_LIVE` range question (AX-02) and all pointer-target sizing (AX-12).
7. **Negative-scaffolding criteria** — no aggregation construct, no coarse-step construct, no locate mode, no acknowledgement mechanism (carrying the Stage 6.1 freeze's deferrals for OPEN-06/08/09/19 into the Timeline surface).
8. **Fixture set** — DT-01…DT-15, X-01…X-10 and **REV-AT-01** as behavioural fixtures; X-01, X-02 and X-08 are *rejection* fixtures that must fail a non-compliant implementation, and REV-AT-01 is a **liveness** fixture that must fail an implementation which makes later Moments unreachable.

---

# 31. Remaining Stage 6.2 presentation details

Deliberately left open, none semantically load-bearing: the Live control's visual treatment and its outboard placement geometry; the forward affordance's visual treatment; the active indicator's visual treatment; step tick treatment or its absence; final names and copy for the two commit acts and for the forward act; the discontinuity indicator's treatment; window-scroll and traversal feel (rate curve, repeat rate); and whether the Track shows a step boundary at all (only the constant *extent* is contractual). All are constrained by §27/§28 and by F-11's exclusion of decorative freezing; none may reintroduce a magnitude, a duration claim, a range, or an implied ordinal distance for `LIVE_EDGE`.

**Handed to 6.4 rather than decided here:** pointer-target sizing and hit-area topology (AX-12); whether range semantics apply to a restricted disclosed region or under `FOLLOW_LIVE` (AX-02); the accessible activation topology for both commit acts and for the relative forward act (AX-08, AX-11); and non-pointer reach across a long Track (AX-10).

---

# 32. Architecture Review Handoff

## Stop-Rule check — all eight triggers tested against the **corrected** model, none fired

| Trigger | Status |
|---|---|
| Post-`TC` future Moment enumeration | **Not required.** Nothing is listed, slotted, or made simultaneously reachable; relative traversal needs no target list (TL-18, §20). |
| Future count / density / extent leakage | **Not required.** The resting picture is invariant to what lies beyond the horizon; no remaining count is computed even privately (TL-19, §10 Layer 3). |
| A new temporal mode | **Not required.** Forward traversal moves the prospective `PTC` only; `PTC ∉ S`, and `TM` remains the two frozen modes (TL-17). |
| Coarse stepping as a v1 feature | **Not proposed.** The unit is one Moment; input magnitude repeats it and never enlarges it, and no coarser unit is defined, selectable or exposed (TL-18, AX-10). |
| Cross-session Timeline | **Not required.** Everything is within `M_current` (T-01). |
| Ordinary temporal selection auto-locating | **Not required.** P-03; intent comes from the act, never the position. |
| `LIVE_EDGE` becoming a fictitious later temporal position | **Removed.** That was v1's error; TL-09/10 and E-01 replace it with an outboard non-metric control — co-temporal, intent-distinct (REV-02). |
| Changing Stage 5 Preview / Commit / Settle semantics | **Not required.** The mechanism *uses* the frozen grammar: Preview moves to a later `PTC` exactly as Stage 5 permits, `PTC ∉ S`, no Preview `RH`, spatial input still cancels (T-03, S5-TL-03/04). |

Also unchanged: `RTO`/`KF`/`VF-VT` are not used as address or geometry (TL-15); no new `RH` semantics (L-01, TL-06); Map geography untouched (§4).

**All four OPENs are resolved within frozen semantics. No new semantic rule was invented.**

## What Architecture should scrutinise first *(v2)*

1. **The forward-navigation mechanism (TL-16…TL-19 and §24.1)** — the load-bearing addition. Its whole claim rests on one property: **relative mapping needs no extent to map onto**, so navigation can be unbounded while disclosure stays bounded. If Architecture judges that repeated single increments driven by input magnitude are *effectively* coarse stepping, that judgement would reopen the mechanism — v2's position is that a unit is coarse only if it is larger than one Moment, and this one never is.
2. **The earned-disclosure principle (TL-17)** — that Preview legitimately discloses at each `PTC`, so advancing the horizon is not a leak. This reads S5-TL-03 exactly as the ruling states it; if that reading is wrong, the mechanism needs a different disclosure rule rather than a different navigation rule.
3. **The outboard Live control (TL-09/10, E-01)** — now co-temporal and non-metric. Worth confirming the phrasing matches Architecture's intent: *co-temporal, intent-distinct; affordances may be spatially distinct.*
4. **§17.1's seven conditions** — condition 6 is the one the correction changed from fail to pass; the other six held under v1 as well.
5. **The two narrowings (§21 AX-02, §30 item 2)** — both now say less than v1 did, deliberately. Worth confirming they now say *enough*.

## Stop rule

**Stage 6.2 is not declared frozen, complete, or approved by this package.** The Architecture Ruling was applied exactly and only in its ruled areas; the Stop-Rule check ran before applying and found no conflict. No frozen Stage 5 semantics were reopened, no OPEN outside 6.2's ownership was resolved, no repository file was touched, and no code was written. The four contracts are returned for final Architecture review.

---

**END — QANDEEL_STAGE6_2_TIMELINE_COMPLETION_CANDIDATE_v2**
