# QANDEEL — Stage 5.2 Freeze Candidate Package
## Timeline Navigation Grammar

**Status:** FREEZE CANDIDATE (v3) — for **final Product / Experience / Architecture sign-off**. **Not frozen** (only the sign-off may freeze it).
**Revision basis:** v2 was structurally accepted at Final Architecture Freeze Review with REV-01…REV-08 confirmed applied; `QANDEEL_STAGE5_2_FINAL_FREEZE_CORRECTIONS.md` required three narrow corrections, FREEZE-01…FREEZE-03, applied here. Change logs: `CHANGE_LOG_REV01-08.md` (v2), `CHANGE_LOG_FREEZE01-03.md` (v3). **All other v2 decisions are unchanged.**
**Date:** 2026-09-02 (v1, v2 and v3 same day)
**Track:** QANDEEL Living Analysis Map (binding authority: `QANDEEL_NAVIGATION_CANONICAL_CHECKPOINT_v1` + the frozen Stage 5.1 contract in `QANDEEL_STAGE5_2_CLAUDE_HANDOFF.md`).
**Scope discipline:** no repository changes, no code, no Replay, no final Timeline styling. Proof boards are architectural scaffolding.

---

## 0. Reading guide

| # | Section | Answers handoff item |
|---|---------|----------------------|
| 1 | Research Synthesis | Deliverable 1 |
| 2 | Timeline Navigation Vocabulary | Deliverable 2 |
| 3 | Formal Interaction Grammar | Deliverable 3 |
| 4 | Preview-vs-Commit Evaluation | Deliverable 4 (Models A/B/C) |
| 5 | Temporal-only vs Temporal+Locate Decision | Deliverable 5 |
| 6 | State Transition Matrix | Deliverable 6 |
| 7 | Return / Cancel / Resume Semantics | Deliverable 7 |
| 8 | Adversarial Findings (20 scenarios) | Deliverable 8 |
| 9 | Recommended Stage 5.2 Contract | Deliverable 9 |
| 10 | Proof Board A | Deliverable 10 → `boards/S5.2_A_Timeline_Navigation_Grammar_FREEZE_CANDIDATE.png` |
| 11 | Proof Board B | Deliverable 11 → `boards/S5.2_B_Temporal_Interaction_Adversarial_Stress_FREEZE_CANDIDATE.png` |
| 12 | Open Questions — remaining after Architecture rulings | Deliverable 12 |
| 13 | Final sign-off Handoff | Deliverable 13 |
| 14 | Change logs | `CHANGE_LOG_REV01-08.md` (v2) · `CHANGE_LOG_FREEZE01-03.md` (v3) |
| A | Core Questions 1–15 — direct answers index | Handoff "Core Questions" |

**Temporal domain (REV-01):** the Timeline is the **current-session** temporal navigator. `M_current = { m_0 < m_1 < … < LH }`, `m_0` = first committed Moment of the current Session. Past Sessions are inspectable spatial footprints in the Map (Stage 3/4), not ranges of this Timeline.

The frozen Stage 5.1 state `S = { LH, LF, TM, TC, K(TC), IF, MC, RH }` is used unchanged throughout. **This package adds no member to S.** It adds one gesture-scoped variable (`PTC`) that exists only while an input gesture is in progress and is explicitly *not* world state (§4.4).

---

## 1. Research Synthesis

Targeted research only; each finding is split into *reusable principle* / *QANDEEL implication* / *pattern not to copy*. Sources are primary (specifications, vendor documentation). Three intended sources could not be retrieved in this session and are **not** relied upon: Esri ArcGIS TimeSlider reference (404), Apple HIG Sliders (script-rendered, no body), WHATWG HTML §4.8.11.9 seeking algorithm (document truncated before the section). Where a media-seek behaviour is asserted below it is grounded in the MDN pages that were retrieved, not in the WHATWG algorithm.

### 1.1 Live edge as a *target*, not a *position* — RFC 8216 (HTTP Live Streaming)

- **Primary finding.** A live playlist is one that has no `EXT-X-ENDLIST`; the server "MUST make a new version of the Playlist file available that contains at least one new Media Segment." Start offsets may be negative — "a negative time offset from the end of the last Media Segment" — i.e. the live edge is addressed *relative to the moving end*, not as an absolute time. Clients are told to hold back from the very end ("SHOULD NOT be within three target durations of the end").
- **Reusable principle.** In a live system the *end* is a moving referent. Addressing "the end" and addressing "a moment" are different address types; conflating them produces drift when the end moves during the gesture.
- **QANDEEL implication.** The Timeline needs two target kinds: a **Moment** (absolute committed conversational position) and **LIVE_EDGE** (the moving referent `LH`). Grabbing the head at the live edge grabs LIVE_EDGE, not the moment that happened to be `LH` at grab time. This is what prevents Scenario 2 (Live advances during scrub) from silently pinning the user (§8, S-02).
- **Pattern not to copy.** Hold-back latency and buffering semantics are media-transport concerns. QANDEEL's `LH` is a committed conversational position; there is no "buffer" ahead of it and the Timeline must never show a region beyond `LH`.

### 1.2 Seek start vs seek completion — MDN `seeking` / `seeked` / `fastSeek()`

- **Primary finding.** Media seeking exposes two events: `seeking` fires "when a seek operation starts", `seeked` when it completes. `fastSeek()` "quickly seeks the media to the new time with precision tradeoff"; for precision "set `currentTime` instead."
- **Reusable principle.** A seek has a *start* (intent registered) and a *settle* (authoritative state reached), and an explicitly *approximate* path exists for rapid traversal that is never the final authority.
- **QANDEEL implication.** This is the model for §4: an approximate, structure-only projection during rapid scrub, and one authoritative `K(TC)` on settle. It licenses the phrase *commit ≠ settle* (§2.4) without introducing a third world state.
- **Pattern not to copy.** In media, approximation means *temporal imprecision* (landing near a keyframe). QANDEEL must never be temporally imprecise — `PTC` always resolves to an exact committed Moment. What is "approximate" during scrub is *disclosure depth*, never *time*.

### 1.3 Preview of a past state must not replace the live document — Google Docs version history

- **Primary finding.** Earlier versions are shown "without replacing the live document"; restoring "creates a new current version rather than deleting subsequent edits"; a back control returns "to the original current version".
- **Reusable principle.** Viewing history is a non-destructive projection; returning to the present is an explicit, always-available action; history is never truncated by viewing it.
- **QANDEEL implication.** `PINNED(t)` is a *view* of the same world, never a fork. `Return to Live Head` must remain a distinct explicit action (already frozen in 5.1 §6). No "restore" concept exists in Stage 5.2 — it would be a Replay/authoring concern and is out of scope.
- **Pattern not to copy.** Side-panel presentation. QANDEEL's history is shown *in the same world* (K(t) = Project(W,t)), not in a detached panel or list.

### 1.4 Detached HEAD — git-checkout documentation

- **Primary finding.** Detached HEAD "means simply that `HEAD` refers to a specific commit, as opposed to referring to a named branch." Work done there is "referenced only by `HEAD`" and can be recovered via `git reflog`.
- **Reusable principle.** "Pinned to a commit" vs "following a moving ref" is exactly one bit of mode, and the mode change must be *explicit* (`checkout <commit>` vs `checkout <branch>`). A reflog (ordered history of where HEAD has been) is what makes excursions recoverable.
- **QANDEEL implication.** `TM ∈ {FOLLOW_LIVE, PINNED(t)}` is the same one-bit distinction. `RH` plays the reflog role: every *committed* temporal step is recorded so `Back One Step` can unwind it (§7). Scrub *previews* are not recorded (they are not "where the user has been", only where the pointer passed).
- **Pattern not to copy.** Git's warning that detached work may be garbage-collected. In QANDEEL nothing is created while pinned; there is nothing to lose. Also: git allows *any* ref to be checked out; QANDEEL's Timeline is bounded to `[m_0, LH]` and the future beyond `LH` does not exist as a target.

### 1.5 Relative "now" ranges vs absolute ranges — Grafana time range controls

- **Primary finding.** Relative ranges are expressed against `now` ("now-5m" to "now"); absolute ranges are typed From/To values. Auto-refresh re-evaluates queries on an interval. The documentation does not state distinct behaviour for refresh against a fixed absolute range.
- **Reusable principle.** "Relative to now" is a *rule* that re-evaluates as time passes; "absolute" is a *value* that does not. Mixing them silently is the classic source of "my dashboard moved".
- **QANDEEL implication.** `FOLLOW_LIVE` is the relative rule (`TC = LH`); `PINNED(t)` is the absolute value. The candidate grammar forbids any relative-offset pin ("30 minutes before live") because it would advance silently as `LH` advances — a hidden temporal mutation the 5.1 contract prohibits.
- **Pattern not to copy.** Auto-refresh cadence, dashboard IA. The Timeline is a navigator inside one world, not a dashboard time picker.

### 1.6 Keyboard grammar for a value on an axis — WAI-ARIA APG Slider pattern

- **Primary finding.** Arrow keys move by one step, Home/End "set the slider to the first allowed value in its range" / last value, Page Up/Down optionally move by larger increments; `aria-valuetext` is required when the raw number "is not user-friendly", e.g. time formats.
- **Reusable principle.** A temporal axis needs a *step* vocabulary (fine step, coarse step, first, last) independent of pointer dragging, and the announced value must be the *meaning* (which Moment / which Session), not a coordinate.
- **QANDEEL implication.** The grammar defines **Step** (±1 Moment) as a discrete Temporal Jump, `Home` as the current-Session start `m_0`, `End` as the `LIVE_EDGE` target, and requires the announced value to name the Moment and the temporal mode **within the same no-hindsight boundary as the visual Track** — while pinned, no future-relative total or "x of N" (FREEZE-02, §3.3, §9 MUST). A coarser step *inside the current Session* is admitted in principle but its granularity is OPEN-08 (REV-01: no Session-level stepping — the Timeline is current-session only).
- **Pattern not to copy.** A slider whose thumb *is* the value. In QANDEEL the Timeline head is a target picker; the value of record is `TM/TC` in `S`, which changes only on commit.

### 1.7 Dragging must have a non-drag equivalent — WCAG 2.2 SC 2.5.7 Dragging Movements

- **Primary finding.** "All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging, unless dragging is essential…". A range slider satisfies this by letting users "click/tap anywhere on the slider track to move the thumb to that position", or by adjacent step controls / text input.
- **Reusable principle.** Scrub (drag) can never be the *only* way to navigate time.
- **QANDEEL implication.** Every temporal destination reachable by scrub must be reachable by a discrete **Temporal Jump** (tap a Moment on the Track, step controls, address entry). This is a MUST in §9 and is what makes Scrub *preview* safe: preview is a convenience layer over a jump grammar, not the grammar itself.
- **Pattern not to copy.** None; this is a hard accessibility floor.

### 1.8 Synthesis

| Principle | Where it lands in the grammar |
|-----------|-------------------------------|
| End of a live stream is a moving *target kind* | `LIVE_EDGE` target (§2.2) |
| Seek start ≠ seek settle; approximate path is never authority | Preview phase, structural projection, settle (§4) |
| History is a non-destructive view; return-to-present is explicit | `PINNED` is a view; `Return to Live Head` primitive (§3, §7) |
| Pinned vs following is one explicit bit; a reflog makes excursions safe | `TM`, `RH` records committed temporal steps (§6, §7) |
| Relative-to-now rules re-evaluate silently | No relative pins (§9 MUST NOT) |
| Step vocabulary + meaningful announced value | Step / Home (`m_0`) / End (`LIVE_EDGE`); announce Moment+mode (§3.3) |
| Drag needs a non-drag equivalent | Temporal Jump is the base grammar; Scrub is sugar (§3) |

---

## 2. Timeline Navigation Vocabulary

All terms below are *interaction* vocabulary. Nothing here is a visual component.

### 2.1 Time domain (REV-01 — current Session only)
- **Moment `m`** — one committed conversational position **of the current Session**. Conversational time is **discrete**: `M_current = { m_0 < m_1 < … < LH }`, where `m_0` is the first committed Moment of the currently live Session. There is no position between two Moments and none after `LH`.
- **Prior knowledge at `m_0`** — `K(m_0)` may already contain everything legitimately knowable before this Session began. The Timeline does not extend into earlier Sessions; past Sessions remain inspectable **spatial footprints in the Map** under the frozen Stage 3/4 model.
- **Track** — the Timeline's addressable span `[m_0, LH]` of the current Session. It has no future region. Its extent grows only when `LH` advances. It has no required internal structure (no boundary ticks).

### 2.2 Targets
- **Temporal target `τ ∈ M_current ∪ { LIVE_EDGE }`**.
  - A **Moment target `Moment(m)`** is an absolute Moment. It does not move when `LH` advances. **It remains an absolute Moment even when `m == LH` at the instant of selection.**
  - **`LIVE_EDGE`** is the moving referent "wherever `LH` is". Selecting it means `FOLLOW_LIVE`.
  - **Target kind controls intent; numeric equality does not** (REV-02). `Commit(LIVE_EDGE) → FOLLOW_LIVE`; `Commit(Moment(m)) → PINNED(m)` — including `PINNED(LH-at-commit)`, which is not self-decaying: it is an absolute Moment that simply ceases to equal the later Live Head. A physical endpoint of the Track may therefore host two semantic possibilities (follow the moving edge / select the latest absolute Moment); distinguishing them is later Experience work (OPEN-12), not solved here.
- **Spatial locate target `x`** — a canonical object or Session footprint whose place in the world may be sought. A locate target is always *explicit* (named by the user's action); it is never inferred from the temporal target.

### 2.3 Gesture-scoped preview
- **Preview cursor `PTC`** — the target under an *in-progress* temporal gesture. `PTC` exists only between gesture start and gesture end. It is not a member of `S`, is not recorded in `RH`, and has no authority over `K`.
- **Structural preview `P(τ)`** — `K(τ)` restricted to disclosure depth ≤ Z1 (existence and placement of Thread places, Home loci, Session footprints) with depth ≥ Z2 content **veiled** (uniformly withheld, not shown stale). `P(τ) ⊆ K(τ)` by construction, so it cannot leak future knowledge.

### 2.4 Phases (presentation status — not world state)
- **Idle** — no temporal gesture in progress. `S` is authoritative and fully presented.
- **Preview** — a temporal gesture is in progress; `PTC` moves; the world shows `P(PTC)`; `TM/TC/K(TC)` unchanged.
- **Settling** — a commit has occurred (`TM/TC` already changed) and the full `K(TC)` is being presented; any one-shot locate entitlement executes at the end of this phase.
- **Settled** = Idle with `K(TC)` fully presented. *Settled is not a third state; it is Idle after a commit.*

### 2.5 Commit
- **Commit** — the instant a temporal gesture ends with a target `τ`. It is the *only* moment at which `TM/TC` change as a result of Timeline interaction:
  - `τ = LIVE_EDGE` → `TM := FOLLOW_LIVE` (no-op if already `FOLLOW_LIVE`).
  - `τ = Moment(m)` → `TM := PINNED(m)`, `TC := m` — **for every `m`, including `m == LH`** (REV-02). Example: at commit `LH = CU-184`; target `LIVE_EDGE` → `FOLLOW_LIVE`, and when CU-185 arrives `TC = 185`; target `Moment(CU-184)` → `PINNED(184)`, and when CU-185 arrives `TC` remains 184.
- **Gesture end** is input-class specific: pointer release, touch end, key-up after held stepping, activation of a marker, confirmation of an address. There is no time-based auto-commit (no debounce commit).

### 2.6 Entitlements
- **Locate entitlement `E(x)`** — a one-shot permission for the camera `MC` to reorient to the legitimate place of `x` in `K(TC)`. Granted only by an explicit Temporal+Locate or Go-Live+Locate action; consumed at settle; discarded by any competing input (§5.4).

### 2.7 History
Every `RH` entry stores `capturedTC` (the absolute Moment that was `TC` at capture) and `capturedTM` (how that viewpoint was reached: `FOLLOW_LIVE` or `PINNED`). **`capturedTM` is provenance only.**

- **Temporal step** — an `RH` entry recording a commit, holding the pre-commit viewpoint (`capturedTC`, `capturedTM`) and the camera at commit time. Previews create no entries.
- **Checkpoint** — an `RH` entry captured by an inspection transition (Stage 4), which per 5.1 §6 includes the viewpoint at capture time.
- **Composite transaction** (REV-05) — one `RH` entry written by one explicit composite user act (P3a, P5). It holds the complete pre-act viewpoint + inspection + camera state, so P8 restores it in **one** action. Rule: **one explicit user-visible navigation act = one reversible `RH` transaction.** Internal storage may keep sub-effects; canonical history is grouped by user act.
- **Canonical restoration rule** (FREEZE-01) — for **every** restoration path (P7 Exact Return, P8 Back One Step, including P8 over a composite transaction):

  `RestoreTemporal(entry) := PINNED(entry.capturedTC)`

  A checkpoint captured at `PINNED(t0)` restores `PINNED(t0)`; a checkpoint captured at `FOLLOW_LIVE @ t0` **also** restores `PINNED(t0)`. Restoration never reattaches to the moving Live Head. **Only P4 Return to Live Head (or the temporal part of P5) may establish `FOLLOW_LIVE`.** This is the frozen Stage 5.1 exact-viewpoint semantics; Stage 5.2 does not weaken it.

---

## 3. Formal Interaction Grammar

### 3.1 Primitive set (evaluated against the handoff list)

| Handoff candidate | Verdict | Grammar primitive |
|-------------------|---------|-------------------|
| Enter Historical | **Rejected as a control**; retained as a *transition event* | The transition `FOLLOW_LIVE → PINNED(t)` caused by any commit with `τ ≠ LIVE_EDGE`. A mode switch without a `t` is meaningless, so no standalone control exists. |
| Scrub Preview | **Accepted** | **P1 Scrub** |
| Commit Historical Position | **Accepted as gesture end, not as a separate control** | Commit is the end of P1 / the activation in P2. No "confirm" button. |
| Temporal Jump | **Accepted** | **P2 Jump** (includes Step ±1 Moment as a unit-distance jump; any coarser in-session granularity is OPEN-08) |
| Temporal + Locate | **Accepted, two forms** | **P3 Temporal+Locate**: P3a composite (single explicit act, only when `x` has exactly one legitimate locus in `K(τ)`), P3b two-step (commit, then explicit Locate) |
| Return to Live Head | **Accepted** | **P4 Return to Live Head** (temporal-only) |
| Go Live + Locate | **Accepted as a composite macro** (= P4 ∘ Stage 4 *Return to Live Focus*), locate sub-effect **guarded** by `Locatable(LF, K(LH))` (REV-04) | **P5 Go Live + Locate Live Focus** — the only single act that resolves 5.1 §7 when `LF` is unlocatable at historical `TC`; if `LF` is Emerging / pre-geographic, the temporal part still executes and no camera moves |
| Cancel / abandon temporal excursion | **Accepted, preview-only** | **P6 Cancel** — valid only during Preview; after commit, "cancel" is P8 Back One Step |
| Resume prior inspection | **Accepted as the existing Stage 4 Exact Return, exactly as frozen in 5.1 §6** (REV-03: no Stage 5.2 exception) | **P7 Exact Return** — always restores `PINNED(capturedTC)` |
| Back One Step | **Accepted, extended to temporal steps; composite acts unwind atomically** (REV-05) | **P8 Back One Step** |
| *(not in list)* Persistent temporal-camera follow | **Rejected for Stage 5.2** (§5.5, Core Q15) | — |
| *(not in list)* Relative pin ("N before live") | **Rejected** (§1.5) | — |

Eight primitives, three of which (P4, P7, P8) already exist in Stage 4 and are only *extended*. No new control is introduced without semantic necessity.

### 3.2 Primitive definitions

Notation: `pre` precondition; `Δ` effect on `S`; `RH` history effect; `MC` camera effect; `K` projection presented.

**P1 Scrub** — continuous temporal traversal.
- `pre`: any `TM`; phase Idle → Preview.
- Input: pointer/touch drag on the Track; *held* keyboard stepping (key-repeat) is a Scrub, a single key actuation is a P2 Step.
- `Δ` during gesture: none. `PTC` moves over `M_current ∪ {LIVE_EDGE}`; `PTC` is snapped to Moments (time is discrete). The Track's end hosts the **Live-Edge affordance**: a scrub that explicitly ends on it resolves `PTC = LIVE_EDGE`; a scrub that ends on the latest Moment *as a Moment* resolves `PTC = Moment(LH)` (REV-02 — the two are distinct; their affordance is OPEN-12).
- `K` during gesture: `P(PTC)` (structural, depth veiled).
- `MC`: **unchanged** (camera preservation is the frozen default during scrub).
- Gesture end → **Commit** with `τ = PTC` (§2.5). If the pointer never left `LIVE_EDGE`, the commit is `FOLLOW_LIVE` and is a no-op.
- `RH`: one *temporal step* entry on commit **iff** `TM/TC` actually changed. Nothing during preview.

**P2 Jump** — discrete temporal traversal to a named target.
- `pre`: any `TM`; phase Idle.
- Input: tap/click a Moment on the Track; single Step (`±1` Moment); `Home` (`m_0`, current-Session start); `End` (`LIVE_EDGE`); explicit Moment address (deep link to a committed Moment of the current Session); a temporal bookmark (OPEN-06, current-Session scope only). No Session-level step exists (REV-01); a coarser in-session granularity is OPEN-08.
- `Δ`: immediate Commit with `τ` = the named target — `Moment(m)` → `PINNED(m)` even when `m == LH`; `LIVE_EDGE` → `FOLLOW_LIVE` (REV-02). No Preview phase; intermediate Moments are not traversed.
- `K`: `K(TC)` on settle.
- `MC`: unchanged.
- `RH`: one temporal step entry iff `TM/TC` changed.
- Difference from P1 (Core Q8): P2 is *addressed*, atomic, and traverses nothing; P1 is *traversed*, previewed, and commits only at gesture end. A P2 Jump is also the WCAG 2.5.7 non-drag equivalent of every P1 destination.

**P3 Temporal+Locate** — temporal commit *plus* a one-shot spatial locate of an explicit `x`.
- `pre`: `x` explicit; phase Idle.
- **P3a composite** (single act): offered when `x` appears to have exactly one legitimate contextual locus at grant time, but **entitled only at settle** (FREEZE-03). Effect: Commit(τ); grant `E(x)`; at settle evaluate `UniqueLocatable(x, K(TC))` — exactly one legitimate contextual locus in the **authoritative settled projection**:
  - exactly one locus → `E(x)` executes once; `MC` reorients to it (Stage 4 direct-jump rules apply: enough containing context is re-established; no isolated screen);
  - zero loci → locate refused, no camera movement (truthful statement as below);
  - more than one locus → no ownership is chosen; the contextual choice is surfaced under the frozen Stage 4.3 rule.
  For `PINNED(t)` the projection is stable unless another explicit act supersedes. For `τ = LIVE_EDGE` (`FOLLOW_LIVE`), Live may advance between commit and settle, so uniqueness is **re-evaluated against the then-current `K(LH)` at settle**. **No camera movement may ever use a stale grant-time uniqueness result.** This is a precision rule, not a new primitive or state.
- **P3b two-step**: Commit(τ) as P1/P2; then, from the settled state, the user explicitly activates **Locate x** (e.g. on a listed contextual appearance, or on a Track marker if the disclosure stage later approves such markers). Effect: grant `E(x)` and execute immediately.
- If `x` has multiple legitimate appearances in `K(τ)`: **P3a is not entitled**. The temporal part commits; the locate part surfaces the appearances for an explicit choice (Stage 4.3 direct-jump rule: no silent ownership choice), *or* restores an explicitly preserved user context if the action originated from an `RH` checkpoint that captured one.
- If `¬Locatable(x, K(τ))`: temporal part commits (the user chose `τ` explicitly); locate is **refused with a truthful statement** ("not present at this moment"); no silent alternative `τ'`. Because the user explicitly arrived with target `x`, the experience MAY offer a **symbolic** explicit act semantically "go to when this becomes available" (REV-06 ruling on OPEN-05): before activation it discloses **nothing** — not the Moment, not a Track marker, not distance/count, not locus, not content; activation is itself the explicit P2-style committed Jump that resolves to `Moment(KF(x))`, and only the resulting `K(TC)` discloses that state. `KF` is never visible UI language. The system never proactively offers this for objects the user did not target.
- `RH` (REV-05): **P3a** writes **one atomic composite transaction** (pre-act `TM/TC` + inspection + camera); **P3b** writes two entries because it is two user acts (temporal step, then checkpoint).

**P4 Return to Live Head** — temporal-only.
- `pre`: `TM = PINNED(t)`.
- `Δ`: `TM := FOLLOW_LIVE` (`TC = LH`).
- `MC`: **unchanged**. `IF` unchanged (every object in `K(t)` exists in `K(LH)`; superseded is not forgotten).
- `RH`: one temporal step entry.
- Equivalences: P2 `End`; P1 commit at `LIVE_EDGE` while pinned.

**P5 Go Live + Locate Live Focus** — composite macro = P4 then Stage 4 *Return to Live Focus*, with the locate sub-effect **guarded** (REV-04).
- `pre`: `TM = PINNED(t)`.
- `Δ`: (1) `TM := FOLLOW_LIVE` — always; (2) `E(LF)` granted and executed **only if `Locatable(LF, K(LH)) = true`**. If `LF` is an Emerging / pre-geographic Focus, or otherwise has no legitimate current locus, **no camera movement and no fabricated locus** — the act completes as a temporal return with a truthful statement that the Live Focus has no place yet.
- Live Focus is **not** locatable "by definition" or "always": under the frozen Stage 3 / 5.1 model an Emerging Focus may be provisional and pre-geographic.
- `RH` (REV-05): **one atomic composite transaction**; P8 restores the pre-P5 state in one action.
- Availability: prefer to expose P5 only where its locate semantics are currently meaningful; exact availability rules are later Experience work.
- Rationale for acceptance: when `¬Locatable(LF, K(TC))`, 5.1 §7 forbids *Return to Live Focus* from moving the camera and requires an explicit temporal change first. P5 is that explicit temporal change fused with the guarded spatial return in one *explicit* act. It is a macro over existing primitives, not new semantics.

**P6 Cancel** — abandon an in-progress Preview.
- `pre`: phase Preview.
- Input: Escape / cancel gesture / pointer leaves and releases outside the Track (input-class detail: OPEN-02 family); **and any deliberate spatial navigation or inspection input during an active Preview** (REV-07 ruling, closes OPEN-03).
- `Δ`: none. `PTC` discarded; phase → Idle; world returns to `K(TC)`.
- `RH`: nothing.
- **Spatial input during Preview** (REV-07): (1) cancels the uncommitted Preview; (2) discards `PTC`; (3) leaves committed `TM/TC` untouched; (4) then performs the spatial action under Stage 4. It MUST NOT implicitly commit the previewed temporal position — manual spatial intent must not silently become temporal intent.
- Outside Preview, "cancel" has no meaning; the user uses P8.

**P7 Exact Return** — Stage 4 primitive (Return to Previous / Original Inspection).
- Behaviour exactly as frozen in 5.1 §6, **with no Stage 5.2 exception** (REV-03): Exact Return / Original Inspection **always** restores the captured viewpoint as `PINNED(capturedTC)` plus the exact canonical object, contextual appearance / lineage, semantic depth and camera. This holds even if the checkpoint was captured while `FOLLOW_LIVE`, and even if the current `LH` still happens to equal `capturedTC`. Exact Return restores a *stable captured viewpoint*; only P4 Return to Live Head reattaches the cursor to `FOLLOW_LIVE`.
- `RH`: consumes back to the checkpoint per Stage 4.

**P8 Back One Step** — Stage 4 primitive, extended.
- `pre`: `RH` non-empty.
- `Δ`: unwinds the most recent `RH` entry, whichever kind — a temporal step, an inspection transition (Stage 4 behaviour), or a **composite transaction** (complete pre-act viewpoint + inspection + camera in **one** action — REV-05; OPEN-07 closed). In every case the temporal part is restored by the canonical rule (FREEZE-01): **`RestoreTemporal(entry) := PINNED(entry.capturedTC)`** together with the camera at that entry. P8 never restores `FOLLOW_LIVE`, even if the entry was captured while following Live; `capturedTM` is provenance only.
- Adversarial example (FREEZE-01): `FOLLOW_LIVE@30 → P2 Jump PINNED(12) → LH advances to 44 → P8` yields **`PINNED(30)`**, not `FOLLOW_LIVE@44`. The user then re-establishes Live only via P4 (or P5).
- P3b remains two reversible steps because it is two user acts.

### 3.3 Input-class mapping (grammar, not styling)

| Input class | P1 Scrub | P2 Jump | Commit point |
|-------------|----------|---------|--------------|
| Pointer drag on Track | yes | — | pointer release |
| Pointer click on Track / marker | — | yes (target = Moment under pointer / marker) | on click |
| Touch drag | yes | — | touch end |
| Touch tap on marker | — | yes | on tap |
| Keyboard `←/→` single press | — | Step ±1 Moment | key-up |
| Keyboard `←/→` held (repeat) | yes (preview runs) | — | key-up |
| Keyboard `PgUp/PgDn` | — | coarser in-session step — granularity OPEN-08 (never Session-level) | key-up |
| Keyboard `Home` / `End` | — | `m_0` (current-Session start) / `LIVE_EDGE` | key-up |
| Address entry (moment link) | — | yes (current-Session Moment) | on confirmation |
| Assistive tech value change | — | Step | on value change |

Announced value (WAI-ARIA `aria-valuetext` principle): *mode + target meaning*, never a coordinate — **and never a hindsight surface** (FREEZE-02). Accessibility is not exempt from epistemic truth. While `TM = PINNED(TC)`, assistive announcements and nonvisual navigation chrome MUST NOT disclose, relative to `TC`: the total current-session Moment count; "x of N" where `N` includes Moments after `TC`; future labels, semantic markers, structural subdivisions, or object/session/CU names. A pinned announcement may state the temporal mode, the selected Moment using only information legitimate at `TC`, and past-inclusive information where useful. Safe forms: "Pinned — selected moment."; "Pinned — moment 4." **only if** that index describes already-traversed/current information and exposes no future total; "Following live." During Preview, announcements may expose only what `P(PTC)` permits at that preview target. If Track marker classes are later approved (OPEN-11), spoken content stays governed by the same `K`/`PTC` knowledge boundary.

Unifying rule (Core Q4): **`TM` becomes `PINNED(t)` at gesture end, never before.** For a single key press gesture end is the key-up, so a step feels immediate while a held key produces a preview run that commits once.

### 3.4 What Timeline interaction never does
- never moves `MC` without `E(x)`;
- never changes `IF` (inspection is suspended, not replaced, when `¬Locatable(IF, K(TC))`, §7.3);
- never recomputes geography (Home loci fixed in `K(t)` per 5.1 §4);
- never writes `RH` during Preview;
- never commits on a timer.

---

## 4. Preview-vs-Commit Evaluation

### 4.1 The three models as specified

- **Model A — Immediate Commit.** Every scrub movement mutates `TM/TC` and presents full `K(TC)`.
- **Model B — Preview then Commit.** Scrub moves a transient cursor; `TM/TC/K` change only on release. During scrub the world does not change (only the Track shows the cursor).
- **Model C — Hybrid.** During scrub a lightweight projection previews; authoritative `K(TC)` only after settle.

### 4.2 Evaluation matrix

Scale: ✔ satisfies · ◐ partial / conditional · ✘ fails.

| Criterion | A Immediate | B Blind preview | C Structural preview |
|-----------|-------------|-----------------|----------------------|
| No hindsight leakage | ✔ (each tick is a true `K`) | ✔ (world never leaves `K(TC)`) | ✔ (`P(τ) ⊆ K(τ)`; veil is uniform, not object-specific) |
| Camera stability | ◐ — safe only if no locate entitlement can attach to ticks; any per-tick entitlement makes the camera chase | ✔ | ✔ (camera frozen during Preview by rule) |
| Analytical truth | ✘ — intermediate ticks present then-current Reading versions/relations that the user never chose; passing over a version boundary flashes an unchosen analytical state as authority | ✔ | ✔ — depth ≥ Z2 is veiled during Preview, so no analytical version is ever asserted mid-gesture |
| Rapid scrub | ✘ — full projection thrash per tick (conceptual cost and readability) | ✔ | ✔ — structure-only projection is bounded |
| Exact Return / `RH` hygiene | ✘ — either every tick is a temporal step (history pollution) or ticks are silently dropped (inconsistent) | ✔ | ✔ — one entry per commit |
| Interaction latency (conceptual) | ✘ — authoritative projection on every tick | ✔ | ✔ — cheap preview, one authoritative settle |
| Accessibility | ◐ — natural for discrete steps, poor for held keys (commit storm) | ◐ — screen-reader users get value announcements but sighted preview is blind | ✔ — held keys preview, key-up commits; announced value carries meaning |
| Narrow screens | ◐ — thrash is worse when the map is small | ✔ | ✔ — Track + mode indicator carry orientation; structure-only preview is legible at small size |
| Live continuing underneath | ✘ — a tick at `LH` pins the user at a Moment that stops being `LH` a second later | ✔ (with `LIVE_EDGE` target) | ✔ (with `LIVE_EDGE` target) |
| False state from intermediate ticks | ✘ — this is precisely what A produces | ✔ | ✔ — Preview is declared *unsettled* and shows no depth content; nothing false is asserted |
| Usefulness of scrub as *finding* tool | ✔ | ✘ — user sees nothing until release; scrub degenerates into guess-and-check | ✔ — the user sees *what exists where* at each τ, which is what scrubbing a world is for |

### 4.3 Decision

**Model C — Structural preview, veiled depth, committed truth on settle** is recommended.

Precise definition of "lightweight projection" (this is the load-bearing part; a vague "lightweight" would reopen the false-state problem):

1. During Preview the world presents `P(PTC) = K(PTC) ↾ depth ≤ Z1`: Thread places that exist at `PTC`, their fixed Home loci, Session footprints that exist at `PTC`, and the Live-Focus / Inspected-Focus marks **only if locatable in `K(PTC)`**.
2. All depth ≥ Z2 content (Session interiors, CU/Memory/Event/Readings/relations) is **veiled uniformly** — withheld regardless of whether it exists at `PTC`. Veiling is a declared "unsettled" condition of the whole depth layer, not a per-object dimming (per-object treatment would leak existence/non-existence at depth and would count as ghosting).
3. Threads that do *not* exist at `PTC` are simply absent — never ghosted, dimmed, outlined, counted, or hinted (5.1 §4).
4. The camera does not move.
5. On commit, the full `K(TC)` is presented (Settling → Idle). If the user is inspecting at depth ≥ Z2 when the commit lands, the aperture re-discloses from `K(TC)`; if the inspected object is not in `K(TC)`, inspection is suspended (§7.3).

Why the preview cannot be a false state: nothing it shows is untrue of `K(PTC)`; everything it withholds is withheld *as a class* and marked unsettled. The user is never shown "an analytical state at τ" until they have committed to τ.

### 4.4 Is `PTC` new state? (handoff: "do not introduce new state unless necessary")

`PTC` is **necessary** (Model A fails four criteria outright; Model B destroys scrub's purpose) and is **not world state**:

- it exists only during an input gesture;
- it is not a member of `S`;
- it is never persisted, never recorded in `RH`, never serialised into a checkpoint;
- no other member of `S` reads it;
- discarding it (P6 Cancel) has zero effect on `S`.

`S = { LH, LF, TM, TC, K(TC), IF, MC, RH }` is unchanged. The candidate contract states this explicitly (§9 MUST NOT).

### 4.5 Three phases, two states (Core Q3)

Preview position, committed selection and settled state are distinguishable **and only two of them are states**: *preview* is gesture status (`PTC`), *committed* is `TM/TC` in `S`, *settled* is the completion of presenting `K(TC)` (and the execution point for `E(x)`). Settled adds no member to `S`.

---

## 5. Temporal-only vs Temporal+Locate Decision

### 5.1 The rule

**Temporal intent never implies spatial intent.** A temporal action changes `TM/TC/K` and leaves `MC` alone. Spatial reorientation happens only under a one-shot locate entitlement `E(x)` that is granted by an act whose *own semantics* name a locate target `x`.

No hidden inference: not from the Moment (a Moment has no place), not from any Track marker's temporal affordance (if the disclosure stage later approves markers, tapping one is a temporal jump unless a *distinct* locate affordance is what was activated), not from `LF`, not from `IF`, not from where the camera happens to be.

### 5.2 Patterns compared

| Pattern | Intent clarity | Hidden inference risk | Verdict |
|---------|----------------|-----------------------|---------|
| **Auto-locate on commit** (camera follows the "active locus" of the committed Moment) | poor — the user asked for a time, got a place | high — "active locus" is an inference; also violates camera preservation and can hijack manual inspection | **Rejected** |
| **Two-step: commit, then explicit Locate** (P3b) | high — two separate acts, each with one meaning | none | **Accepted as the default form** |
| **Composite on a placed marker** (P3a: the Session/object marker carries a distinct locate affordance whose activation means "go to this moment *and* to this place") | high, provided the affordance is *distinct* from the temporal-jump affordance of the same marker | low — entitled only when `x` has exactly one legitimate locus in `K(τ)` | **Accepted as an entitled shortcut** |
| **Modifier-gated locate** (e.g. long-press / secondary activation = locate) | medium — modifiers are learnable but invisible | medium — discoverability; may be the *implementation* of P3a's distinct affordance on touch | **Deferred** to input-vocabulary work (OPEN-02); not part of the grammar's meaning |
| **Persistent "camera follows time" mode** | low — a standing rule that moves the camera without a per-act request | high — camera hijack by definition; conflicts with Stage 4 Live-Focus divergence rule | **Rejected for 5.2** (see §5.5) |
| **Locate from the world, not the Track** (activate "Locate at this time" on a listed contextual appearance after commit) | high | none | Accepted as a P3b entry point |

### 5.3 Legitimacy check before any locate

`E(x)` executes only if the legitimacy predicate holds **at settle**, against the **committed** `TC`, never `PTC`: for P3b and P5 that predicate is `Locatable(x, K(TC))`; for P3a it is the stricter `UniqueLocatable(x, K(TC))` — exactly one legitimate contextual locus in the settled projection (FREEZE-03). If Live advanced between the composite's commit and its settle, that is irrelevant for `PINNED(t)` (`TC` did not move); for `FOLLOW_LIVE` the predicate is re-evaluated against the then-current `K(LH)` at settle (Scenario 17 / 2). A target that was unique at grant time may have zero or several appearances by settle; the settle-time result alone governs.

### 5.4 Entitlement lifecycle (Core Q10)

`E(x)` is **granted** by P3a / P3b / P5 only; **executes** at settle; **expires** immediately after execution.

`E(x)` is **discarded** (never executes) when, before settle:
- the user issues any spatial input (pan, zoom, inspection) — manual camera always wins, no hijack;
- the user begins another temporal gesture (P1/P2/P3) — the new act's entitlement, if any, governs (Scenario 17);
- the user cancels (P6 applies only to Preview; a P3a has no Preview, so a cancel between commit and settle is P8);
- the settle-time predicate fails: `¬Locatable(x, K(TC))` (P3b/P5), or for P3a `¬UniqueLocatable(x, K(TC))` — zero loci → refused; more than one → explicit contextual choice, no ownership chosen (FREEZE-03).

`E(x)` is **not preserved** across a later temporal action. There is no standing entitlement, and no grant-time uniqueness result survives to settle — the entitlement is *permission to evaluate at settle*, not a pre-approved camera move.

### 5.5 One-time locate vs persistent follow (Core Q15)

**One-time locate is sufficient for Stage 5.2.** Arguments:

- Every use case offered for a persistent follow ("keep the camera on the action while I scrub") is either (a) Replay — out of scope, Stage 13 — or (b) satisfiable by P3a on the next marker.
- A persistent follow contradicts the frozen Stage 4 rule that Live Focus movement must not hijack the camera; a temporal follow is the same hijack with a different trigger.
- A persistent follow forces a per-tick "active locus" inference during Preview, reintroducing Model A's problems through the camera.
- It would be a **new member of `S`** (a standing camera policy). The handoff forbids new state without necessity; no necessity was found.

Recorded as **REJECTED for 5.2 / OPEN for Stage 13** where Replay may legitimately define a bounded, explicitly-entered follow.

---

## 6. State Transition Matrix

Rows: `(TM, phase)`. Columns: events. Cell: effect on `TM/TC`, `MC`, `K` presented, `RH`. "—" = no change. `E` = a pending locate entitlement.

| Event ↓ / State → | **FOLLOW_LIVE · Idle** | **FOLLOW_LIVE · Preview** | **PINNED(t) · Idle** | **PINNED(t) · Preview** |
|---|---|---|---|---|
| **Begin scrub** (P1) | → Preview; `PTC := LIVE_EDGE` (grab at head) or the Moment under pointer; `MC` —; `K` → `P(PTC)`; `RH` — | n/a (already) | → Preview; `PTC := t` or Moment under pointer; `MC` —; `K` → `P(PTC)`; `RH` — | n/a |
| **Scrub move** to Moment `m` | n/a | `PTC := m`; `K` → `P(m)`; `MC` —; `RH` — | n/a | same |
| **Scrub move** to Track end | n/a | `PTC := LIVE_EDGE`; `K` → `P(LH)`; `RH` — | n/a | same |
| **Release at `Moment(m)`** — any `m`, **including `m == LH`** (REV-02) | n/a | Commit → `PINNED(m)`; Settling → `K(m)`; `MC` —; `RH` += temporal step | n/a | Commit → `PINNED(m)` (`RH` += step iff `m ≠ t`) |
| **Release on the Live-Edge affordance** (`PTC = LIVE_EDGE`) | n/a | Commit no-op → stays `FOLLOW_LIVE`; `K(LH)`; `RH` — | n/a | Commit → `FOLLOW_LIVE`; `K(LH)`; `MC` —; `RH` += step |
| **Cancel** (P6) | — | → Idle; `PTC` discarded; `K(LH)`; `RH` — | — | → Idle; `K(t)`; `RH` — |
| **Jump `Moment(m)`** (P2) — incl. `m == LH` | Commit → `PINNED(m)`; `RH` += step | Preview cancelled first (REV-07), then Jump | Commit → `PINNED(m)`; `RH` += step iff `m ≠ t` | as left column |
| **Jump `End` (`LIVE_EDGE`) / P4** | — (no-op) | Preview cancelled first, then no-op | → `FOLLOW_LIVE`; `MC` —; `RH` += step | Preview cancelled first, then as left |
| **Temporal+Locate `(τ, x)`** (P3a) | Commit(τ); `E(x)` pending; **at settle evaluate `UniqueLocatable(x, K(TC))` against the then-current `K(LH)` when `τ = LIVE_EDGE`** (FREEZE-03): 1 locus → `MC` → locus(x) once; 0 → refused, `MC` —; >1 → explicit contextual choice, `MC` —; **`RH` += one composite transaction** in all three cases (REV-05); no stale grant-time result is used | n/a | same, evaluated against the stable `K(t)` | n/a |
| **Locate `x`** post-commit (P3b) | `E(x)` executes now (checked against `K(LH)`); `RH` += checkpoint (second user act) | n/a | `E(x)` executes now (checked against `K(t)`); `RH` += checkpoint | n/a |
| **Go Live + Locate Live Focus** (P5) | equivalent to Stage 4 Return to Live Focus (guarded) | n/a | → `FOLLOW_LIVE` always; `MC` → locus(LF) **iff `Locatable(LF, K(LH))`**, else no camera move (REV-04); **`RH` += one composite transaction** | n/a |
| **Live advances** (`LH → LH'`) | `TC = LH'` (frozen 5.1 exception); Track extends; `K(LH')`; `MC` — | Track extends; if `PTC = LIVE_EDGE` preview shows `P(LH')`; if `PTC` is a Moment it stays; `RH` — | `TC` —; `K(t)` —; Track extends by non-semantic extent only + "live continued" meta indication (REV-06, §8 S-19); `MC` — | as left, `PTC` unaffected |
| **Pan / Zoom / inspect** (Stage 4) | Stage 4 behaviour; `TM` — | **REV-07:** Preview cancelled, `PTC` discarded, `TM/TC` untouched, then Stage 4 action; never an implicit commit | Stage 4 behaviour over `K(t)`; `TM` — | as Preview column |
| **Spatial input while `E` pending** | `E` discarded | n/a | `E` discarded | n/a |
| **Back One Step** (P8) | unwinds last `RH` entry; temporal part **always** `PINNED(entry.capturedTC)` + camera at that entry (FREEZE-01) — never `FOLLOW_LIVE`, even if the entry was captured while following; inspection → Stage 4; composite transaction → full pre-act state in one action | Preview cancelled first, then unwinds | same | same |
| **Exact Return** (P7) | restores checkpoint as `PINNED(capturedTC)` + object + lineage + depth + camera (5.1 §6, no exception — REV-03) | Preview cancelled first | same | same |
| **Return to Live Focus** (Stage 4) | spatial-only iff `Locatable(LF, K(LH))` (Emerging `LF` may be pre-geographic — REV-04) | Preview cancelled first | spatial-only iff `Locatable(LF, K(t))`; otherwise refused, no hint, P5 offered where meaningful | same |
| **Return to World** (Stage 4) | camera → Z0; `TM` — | ends Preview first | camera → Z0 over `K(t)`; `TM` — | same |

Invariants checkable from the matrix:
1. `TM/TC` change only in cells labelled *Commit*, in P4/P5, in P7/P8, and in the frozen Live-advance exception.
2. `MC` changes only in Stage 4 spatial cells and where `E(x)` executes.
3. `RH` never changes in a Preview column except via the Cancel-then-act sequence.
4. No cell moves `MC` and `TM` together except P3a (at settle) and P5 — both explicit composites, each one `RH` transaction.
5. No cell turns a Preview into a commit by any input other than the temporal gesture's own end (REV-07).
6. `Commit(Moment(m))` never yields `FOLLOW_LIVE`, and `Commit(LIVE_EDGE)` never yields `PINNED` (REV-02).
7. No restoration cell (P7, P8) yields `FOLLOW_LIVE`; `FOLLOW_LIVE` is established only by P4, the temporal part of P5, commit on the Live-Edge affordance, and the frozen Live-advance exception (FREEZE-01).
8. No cell moves `MC` on a grant-time result; every `E(x)` cell evaluates its predicate at settle (FREEZE-03).

---

## 7. Return / Cancel / Resume Semantics

### 7.1 Five returns, five destinations (Core Q11)

| Action | Temporal effect | Spatial effect | Precondition / guard | After a temporal action |
|--------|-----------------|----------------|----------------------|--------------------------|
| **Back One Step** (P8) | `PINNED(entry.capturedTC)` for every entry kind — never `FOLLOW_LIVE` (FREEZE-01) | restores camera at that entry | `RH` non-empty | after a commit **or a composite act (P3a/P5)**: exactly one press returns to the pre-act viewpoint, inspection and camera (REV-05); e.g. `FOLLOW_LIVE@30 → PINNED(12) → LH 44 → Back` = `PINNED(30)` |
| **Exact Return / Original Inspection** (P7) | **always** `PINNED(capturedTC)` — also when captured at `FOLLOW_LIVE`, also when `LH` still equals `capturedTC` (5.1 §6, no exception — REV-03) | restores captured object, lineage, depth, camera | checkpoint exists | never drifts to `FOLLOW_LIVE`; only P4 reattaches to Live |
| **Return to Live Head** (P4) | `FOLLOW_LIVE` | none | `PINNED` | camera stays; `IF` stays |
| **Return to Live Focus** (Stage 4) | none | camera → `LF` | `Locatable(LF, K(TC))`; else refused without hint (an Emerging `LF` may be unlocatable even at `LH` — REV-04) | while pinned with unlocatable `LF`: refused; P5 is the explicit way, itself guarded |
| **Return to World** (Stage 4) | none | camera → Z0 | — | operates over `K(TC)`; a historical world at Z0 shows only then-existing places |

### 7.2 Cancel
- Applies only to Preview. Discards `PTC`; nothing else. No `RH` entry.
- After commit, there is no "undo temporal" distinct from P8 — creating one would be a duplicate control (handoff: do not proliferate).

### 7.3 Suspension of Inspected Focus
When a commit lands at `t` with `¬Locatable(IF, K(t))` (Scenario 5, 13-analogue for `IF`):
- `IF` is **not** cleared (it is user state, and `RH` still refers to it).
- The inspected object is not rendered, not ghosted, not hinted spatially; the aperture closes to the deepest lineage level that *does* exist in `K(t)` (Thread if the Thread exists; World otherwise).
- The inspection is marked **suspended** in the lineage/return affordance. Naming is **knowledge-gated** (REV-06 ruling, closes OPEN-04): `RH` retains the exact canonical inspection reference internally; visible chrome may use the object's name only if its canonical identity is **Known in `K(TC)`**; if the identity is not yet Known at `TC`, no future name is displayed — a generic affordance ("Return to previous inspection") is used; if the identity is known but a later contextual appearance is unavailable, the known canonical name may remain while the unavailable future context name/locus is not disclosed. No Map or Timeline annotation may reveal the suspended future object.
- P4 / P7 / P8 resume it exactly.

### 7.4 Resume after a long excursion (Scenario 10)
P4 restores `FOLLOW_LIVE` only. The camera remains where the user left it in the historical projection — which is a legitimate place in `K(LH)` too (places never vanish forward in time). Nothing snaps. If the user wants the live action, that is P5 or Stage 4 Return to Live Focus, both explicit.

---

## 8. Adversarial Findings

Verdict scale for this *revised candidate*: **HOLDS** (the grammar as written resolves the attack with no new primitive), **HOLDS-WITH-OPEN** (resolves, but a remaining OPEN item affects the exact surface), **FAILS** (would require a grammar change). No scenario is marked FAILS; that is a claim for the Final Freeze Review to attack, not a declaration of freeze. Rows changed in v2 are marked **[REV-nn]**; rows changed in v3 are marked **[FREEZE-nn]**. All scenarios now operate on the current-Session Track (REV-01); Threads that "come into existence" during the Session model Emerging → Established transitions inside the live Session, and `K(m_0)` already contains prior knowledge.

| # | Scenario | Expected behaviour under the candidate grammar | Verdict |
|---|----------|-----------------------------------------------|---------|
| S-01 | `FOLLOW_LIVE`, begins scrub backward, cancels before commit | Preview shows `P(PTC)`; P6 discards `PTC`; `S` untouched; `RH` empty; world returns to `K(LH)`; camera never moved | HOLDS |
| S-02 **[REV-02]** | Scrubs backward while `LH` advances several commits | `PTC` is a Moment → unaffected by `LH`; Track extends at the end; commit pins the Moment the user is holding, not a relative offset. If the user grabbed the **Live-Edge affordance** without moving, `PTC = LIVE_EDGE` → release is a no-op `FOLLOW_LIVE`. If the user had instead explicitly selected `Moment(LH-at-grab)` as a Moment, release pins that Moment — an absolute pin that simply ceases to equal the later `LH`; this is intended, not accidental, because the target kind was chosen | HOLDS |
| S-03 | Rapid scrub across Readings / relations / version boundaries | Preview veils depth ≥ Z2 uniformly; no then-current Reading version is ever presented mid-gesture; only Thread/Session existence changes as `PTC` crosses boundaries; on commit one `K(TC)` with the then-current version *and* superseded lineage (5.1 §4) | HOLDS |
| S-04 | Stops on a Moment whose active semantic locus is off-screen | Camera preservation: `MC` unchanged; the user sees `K(t)` in their current viewport. No auto-locate. Orientation: Track position + mode indicator + Stage 4 lineage. P3b Locate available explicitly | HOLDS |
| S-05 **[REV-06]** | Commits a historical Moment while manually inspecting another Thread | If the inspected object exists in `K(t)` the aperture re-discloses from `K(t)` (possibly a different then-current Reading); if not, inspection is suspended (§7.3), camera stays, no hint. Return chrome is knowledge-gated: the name appears only if the identity is Known in `K(t)`, otherwise "Return to previous inspection" | HOLDS |
| S-06 **[REV-05]** | Temporal+Locate to a CU with one valid contextual locus | P3a entitled: commit τ, `E(CU)` executes at settle, camera lands with containing context (Stage 4 direct-jump rule); `RH` += **one composite transaction**; P8 restores the pre-act state in one press | HOLDS |
| S-07 | Same CU/object has multiple legitimate appearances in `K(τ)` | P3a not entitled: temporal part commits; the appearances are surfaced for explicit choice (Stage 4.3 no-silent-ownership); an explicitly preserved context from an `RH` checkpoint may be restored instead | HOLDS |
| S-08 **[REV-06]** | Target object does not exist in `K(TC)` | Temporal part commits; locate refused with a truthful statement; **no silent teleport** to a τ' where it exists. Because the user explicitly arrived with `x`, a **symbolic** act "go to when this becomes available" MAY be offered: before activation it discloses no Moment, marker, distance/count, locus or content; activation is the explicit committed Jump to `Moment(KF(x))`; disclosure happens only through the resulting `K(TC)`. Never offered proactively for untargeted objects; `KF` never appears as UI language | HOLDS |
| S-09 **[REV-02]** | Scrubs back to `LH` | Ending the scrub on the **Live-Edge affordance** resolves `PTC = LIVE_EDGE`; release → `FOLLOW_LIVE` (from `PINNED`: one temporal step; from `FOLLOW_LIVE`: no-op). Ending on the latest Moment *as a Moment* (or Step to it) resolves `Moment(LH)` → `PINNED(LH-at-commit)`: an absolute pin that later ceases to equal `LH` — correct by target kind, not a decay. How the endpoint distinguishes the two intents is OPEN-12 (Experience) | HOLDS-WITH-OPEN |
| S-10 | Returns to Live after a long historical excursion | P4: `FOLLOW_LIVE`, camera unchanged, `IF` unchanged; live-edge indicator had shown "live continued" without content; user may then P5 / Return to Live Focus explicitly | HOLDS |
| S-11 **[REV-05, FREEZE-01]** | Back One Step after a temporal commit, Live having advanced | User at `FOLLOW_LIVE@30` jumps to `PINNED(12)`; Live advances to 44; P8 restores **`PINNED(30)`** + camera-at-commit — **not** `FOLLOW_LIVE@44`, because `RestoreTemporal(entry) := PINNED(entry.capturedTC)` and `capturedTM = FOLLOW_LIVE` is provenance only. Only P4/P5 re-establish Live. If the commit was a P3a or P5, the single press restores the complete pre-act viewpoint + inspection + camera (one act = one transaction). P3b remains two presses because it was two acts | HOLDS |
| S-12 **[REV-03]** | Exact Return to an origin captured while Live later advanced | 5.1 §6 verbatim: restores `PINNED(capturedTC)` + object + lineage + depth + camera; never `FOLLOW_LIVE @ t1`. Also when `LH` has *not* advanced: still `PINNED(capturedTC)` — no Stage 5.2 exception. Only P4 reattaches to Live | HOLDS (frozen upstream) |
| S-13 **[REV-04]** | Present `LF` unavailable in historical `K(TC)` | Stage 4 Return to Live Focus refused; camera does not move; no hint, no ghost, no count; the `LF` mark is absent from `P(τ)`/`K(t)`; P5 offered where meaningful: its temporal part always returns to `FOLLOW_LIVE`, its locate part executes only if `Locatable(LF, K(LH))` — an Emerging / pre-geographic `LF` yields no camera move and no fabricated locus | HOLDS |
| S-14 **[REV-08]** | Old real-world Event with `RTO` far before the current Session | Whether the Event is shown on the Track at all is a disclosure-stage question (OPEN-11). **If** a marker for it is later approved, its Timeline address MUST derive from current-session `SP` (when it was spoken about), never from `RTO`; `RTO` is disclosed at depth as content; scrubbing to `RTO`'s calendar date is impossible because the Track is current-session conversational time only | HOLDS-WITH-OPEN |
| S-15 | Mobile / narrow viewport with Timeline interaction | Same Track, same targets, same commit rule; the Timeline may be reduced to an edge control but the Map stays primary; a persistent mode indicator (Following live / Pinned) is required on narrow; P3a is expected to be used more (less context visible) but stays explicit | HOLDS |
| S-16 **[REV-07]** | Alternates temporal scrub and manual Pan repeatedly | Pan never pushes `RH` (Stage 4); scrub Preview never pushes `RH`; only commits do. A Pan begun during Preview **cancels** the Preview (discards `PTC`, `TM/TC` untouched) and then pans under Stage 4 — never an implicit commit of the previewed position. Neither input contaminates the other's state: `MC` from pans, `TM/TC` from commits | HOLDS |
| S-17 **[FREEZE-03]** | Begins a second temporal action before the first temporal+locate has settled; and a P3a at `LIVE_EDGE` whose target gains/loses loci before settle | Pending `E(x₁)` discarded; second act governs; `RH` records the first commit (it happened) and the second; the camera moves at most once, for the second act if it carries an entitlement. Separately: P3a `(LIVE_EDGE, CU-9)` with one locus at grant; Live advances before settle and `CU-9` now has two legitimate appearances in `K(LH)` → `UniqueLocatable` fails at settle → no camera movement, explicit Stage 4.3 choice surfaced; had it gained zero loci → refused; the grant-time uniqueness result is never used | HOLDS |
| S-18 | Historical position has superseded lineage but a different then-current Reading | `K(t)` shows the then-current Reading as current *and* the earlier superseded lineage (5.1 §4 "without erasing superseded historical lineage"); the later Reading that superseded *this* one is absent (future knowledge). Peer Readings unranked (Stage 4.2) | HOLDS (frozen upstream) |
| S-19 **[REV-06, FREEZE-02]** | No-hindsight attack via labels, target hints, camera, counts, disabled future controls — **visual and nonvisual** | While `PINNED(TC)`, the Track segment after `TC` up to `LIVE_EDGE` exposes only the minimum non-semantic navigation extent needed to reach later current-session Moments plus a Live-edge / "live continued" meta indication. It MUST NOT expose, relative to `TC`: Session/CU/object labels, semantic markers, subdivision counts, structural ticks revealing later conversational structure, or disabled future controls (ruling closes OPEN-01: **not allowed**). **The same firewall governs assistive announcements and nonvisual chrome**: no total Moment count, no "moment 4 of 9", no future names — "Pinned — selected moment" / "Pinned — moment 4" (past-inclusive index only) / "Following live" are the safe forms. When the user explicitly moves Preview to a later `PTC`, `P(PTC)` may reveal — and announcements may speak — only the truthful then-available structure at that target. Camera never moves to a future locus (5.1 §7) | HOLDS |
| S-20 | Attempt to make Timeline the primary IA | Every primitive changes `TM/TC` or executes a one-shot locate *into the Map*; nothing in the grammar renders content on the Timeline; Session disclosure remains inside the Thread field (Stage 3.6 / 4.2); there is no Timeline "page" | HOLDS |

### 8.1 Additional findings surfaced while writing the proofs
- **F-01 (revised, REV-02) Target kind controls intent; numeric equality does not.** The Live-Edge affordance selects the moving referent (`FOLLOW_LIVE`); the latest Moment selected *as a Moment* pins an absolute position (`PINNED(LH-at-commit)`) that later merely ceases to equal `LH`. Neither collapses into the other; the v1 wording "self-decaying" was wrong — an absolute Moment does not decay.
- **F-02 Held-key stepping is a scrub.** Without this, keyboard users get a commit storm (Model A through the keyboard).
- **F-03 (revised, REV-05) One explicit user act = one `RH` transaction.** P3a and P5 each write one atomic composite entry; P3b writes two because it is two acts. OPEN-07 closed.
- **F-04 Suspended inspection is a real state of affairs but not a state of `S`.** It is derivable: `IF ≠ ∅ ∧ ¬Locatable(IF, K(TC))`.
- **F-05 (FREEZE-01) "Restore prior `TM/TC`" was an under-specified phrase.** Restoring a stored `TM = FOLLOW_LIVE` would reattach to the moving Live Head and reproduce the contradiction 5.1 already closed for P7. All restoration now normalises to `PINNED(capturedTC)`; `capturedTM` is provenance.
- **F-06 (FREEZE-02) Announcements are a disclosure surface.** "Moment 4 of 9" leaked a future subdivision count through the assistive channel while the visual Track was compliant. The no-hindsight boundary is channel-independent.
- **F-07 (FREEZE-03) Entitlement ≠ pre-approved camera move.** For `τ = LIVE_EDGE` the projection can change between commit and settle; uniqueness is a settle-time predicate.

---

## 9. Recommended Stage 5.2 Contract (freeze candidate v3)

### MUST
1. Temporal navigation changes `TM/TC` **only at commit**: gesture end (P1), activation (P2/P3), P4/P5, or restoration (P7/P8); plus the frozen Live-advance exception.
2. **[REV-01]** The Timeline's temporal domain is the **current Session only**: `M_current = { m_0 < … < LH }`, `m_0` = first committed Moment of the current Session. Past Sessions are Map footprints (Stage 3/4), not Timeline ranges. `Home` = `m_0`; `End` = `LIVE_EDGE`; P2 addresses committed Moments of the current Session.
3. **[REV-02]** Temporal targets are `M_current ∪ { LIVE_EDGE }`. `Commit(LIVE_EDGE) → FOLLOW_LIVE`; `Commit(Moment(m)) → PINNED(m)` **for every `m`, including `m == LH` at the instant of commit**. Target kind controls intent; numeric equality does not.
4. During Preview the world presents `P(PTC) = K(PTC) ↾ depth ≤ Z1` with depth ≥ Z2 veiled **uniformly**; absent Threads are absent (no ghost, dim, outline, count, hint).
5. `MC` is unchanged by every temporal action unless a one-shot entitlement `E(x)` was granted by an act that explicitly names `x`.
6. **[FREEZE-03]** `E(x)` executes only if its legitimacy predicate holds **at settle** against the authoritative settled projection (`Locatable(x, K(TC))` for P3b/P5; `UniqueLocatable(x, K(TC))` for P3a); for `FOLLOW_LIVE` the predicate is re-evaluated against the then-current `K(LH)` at settle; it is discarded by any spatial input, any new temporal act, or cancel; and expires after one execution. No camera movement may use a stale grant-time result.
7. **[FREEZE-03]** P3a at settle: exactly one legitimate contextual locus → execute once; zero → refuse locate, no camera movement; more than one → do not choose ownership, surface the explicit contextual choice under the frozen Stage 4.3 rule. The temporal part commits in all three cases.
8. Every scrub destination is reachable by a discrete Jump (Moment on the Track, Step, Home/End, address) — non-drag equivalence.
9. **[REV-05]** One explicit user-visible navigation act = one reversible `RH` transaction. P3a and P5 each write one atomic composite entry (pre-act viewpoint `capturedTC`/`capturedTM` + inspection + camera); P3b writes two because it is two acts. `RH` is never written during Preview.
10. **[REV-05, FREEZE-01]** P8 Back One Step unwinds temporal steps, inspection transitions and composite transactions; a composite act is restored in **one** action; the temporal part of every restoration is `RestoreTemporal(entry) := PINNED(entry.capturedTC)`.
11. **[REV-03, FREEZE-01]** **Every** `RH` restoration path — P7 Exact Return / Original Inspection and P8 Back One Step, including P8 over a P3a/P5 composite transaction — restores the captured viewpoint as `PINNED(capturedTC)` plus the exact object, contextual appearance/lineage, semantic depth and camera — also when captured at `FOLLOW_LIVE`, also when `LH` still equals `capturedTC`. `capturedTM` is provenance only. **Only P4 Return to Live Head (or the temporal part of P5) may establish `FOLLOW_LIVE`.**
12. **[REV-04]** P4 Return to Live Head is temporal-only. P5 Go Live + Locate Live Focus is the only single act combining it with a spatial return; its temporal part always executes; its locate part executes **only if `Locatable(LF, K(LH))`** — an Emerging / pre-geographic `LF` yields no camera movement and no fabricated locus.
13. **[REV-07]** Any deliberate spatial navigation/inspection input during an active Preview cancels the Preview, discards `PTC`, leaves committed `TM/TC` untouched, and then performs the spatial action under Stage 4.
14. **[REV-06]** While `PINNED(TC)`, the Track after `TC` exposes only the minimum non-semantic navigation extent needed to reach later current-session Moments plus a Live-edge / "live continued" meta indication.
15. **[REV-06]** Visible return/navigation chrome for a suspended inspection is knowledge-gated: a name is shown only if the canonical identity is Known in `K(TC)`; otherwise a generic "Return to previous inspection"; an unavailable future context name/locus is never disclosed. `RH` may keep the exact reference internally.
16. **[REV-08]** **If** a content/semantic marker is later approved for presentation on the current-session Timeline, its Timeline address MUST derive from current-session `SP`, never from `RTO`, `KF`, `VF/VT`, object age, Thread age or spatial position.
17. **[FREEZE-02]** Announced/assistive value of the Timeline names the **mode and the Moment meaning**, never a coordinate, and obeys the same no-hindsight firewall as the visual Track: while `PINNED(TC)` it uses only information legitimate at `TC` (safe forms: "Pinned — selected moment", "Pinned — moment 4" only with a past-inclusive index, "Following live"); during Preview only what `P(PTC)` permits.
18. On narrow projections a persistent temporal-mode indicator is present whenever `TM = PINNED`.

### MUST NOT
1. Add any member to `S`; `PTC` and phases are gesture/presentation status only.
2. Commit on a timer, debounce, or idle threshold.
3. **[REV-07]** Implicitly commit a previewed temporal position because of spatial input.
4. **[REV-02]** Collapse `Moment(LH)` into `LIVE_EDGE`, or yield `FOLLOW_LIVE` from a Moment target, or yield `PINNED` from the `LIVE_EDGE` target.
5. **[REV-01]** Extend the Timeline into earlier Sessions; offer Session-level stepping; require Session-boundary ticks; let temporal bookmarks expand Stage 5.2 into a cross-session Timeline.
6. Infer a locate target from the Moment, a Track marker's temporal affordance, `LF`, `IF`, viewport, or "active locus".
7. Offer a relative pin ("N before live") or any pin that re-evaluates as `LH` advances.
8. Render any region, control, label, marker, or count beyond `LH`.
9. **[REV-06, FREEZE-02]** While pinned, expose after `TC` — visually **or through assistive announcements / nonvisual chrome**: Session/CU/object labels, semantic markers, subdivision counts, the total current-session Moment count, "x of N" where `N` includes Moments after `TC`, structural ticks revealing later conversational structure, future object/session/CU names, or disabled future controls.
10. Silently substitute another Moment when a locate target is not in `K(TC)`.
11. **[REV-06]** Before activation of the symbolic "go to when this becomes available" act, disclose the `KF(x)` Moment, a future Track marker, temporal distance/count, spatial locus, or any content at `KF(x)`; surface such an act proactively for untargeted objects; use `KF` as visible UI language.
12. Move the camera to, or hint at, a future-unavailable locus (5.1 §7), including through the `LF`/`IF` marks in `P(τ)`.
13. **[REV-04]** State or assume that Live Focus is spatially locatable "by definition" or "always"; move the camera or fabricate a locus for an Emerging / pre-geographic `LF`.
14. Present depth ≥ Z2 content during Preview, stale or fresh.
15. **[REV-08]** Address or order any Track marker by `RTO`, `KF`, `VF/VT`, object age, Thread age, or spatial position.
16. Provide a persistent temporal-camera follow in Stage 5.2.
17. Render Session content, analytical objects, or relations *on* the Timeline as part of the navigation grammar (what the Track may disclose is OPEN-11, a later disclosure-stage decision).
18. Clear `IF` on temporal commit; suspend it instead.
19. **[REV-03, FREEZE-01]** Introduce any restoration path (P7, P8, composite unwind) that restores `FOLLOW_LIVE`, or describe restoration as "restore prior `TM/TC`" without the `PINNED(capturedTC)` normalisation.
20. **[REV-06]** Annotate the Map or Timeline in any way that reveals a suspended future object.
21. **[FREEZE-03]** Move the camera under a P3a entitlement on the basis of a grant-time uniqueness result; choose ownership when the settled projection holds more than one legitimate locus.

### SHOULD
1. Make the P3a locate affordance perceptibly distinct from any temporal-jump affordance at the same place.
2. Show, while pinned, that Live has continued (non-semantic extent growth + Live-edge meta indication) without any content.
3. Re-disclose an existing inspected object from `K(t)` after commit rather than closing the aperture.
4. Expect P3a to carry more of the load on narrow projections.
5. **[REV-04]** Expose P5 only where its locate semantics are currently meaningful.
6. **[REV-02]** Expect the physical Track endpoint to host two semantic possibilities (follow the moving edge / select the latest absolute Moment) and reserve their distinction for Experience work (OPEN-12).

### MAY
1. **[REV-06]** Offer, after a refused locate for an explicitly targeted `x`, the symbolic explicit act "go to when this becomes available", under the disclosure constraints in MUST NOT 11.
2. Provide temporal bookmarks as named P2 targets within the current Session (OPEN-06).
3. **[REV-01]** Provide a coarser in-session step whose granularity is decided under OPEN-08.

### OPEN
See §12 — remaining after the Architecture rulings.

---

## 10. Proof Board A — Timeline Navigation Grammar

`boards/S5.2_A_Timeline_Navigation_Grammar_FREEZE_CANDIDATE.png` (source: `boards/S5.2_A_Timeline_Navigation_Grammar_FREEZE_CANDIDATE.html`).

Revised in v2: current-session Track without boundary ticks (REV-01); `Moment(LH)` vs `LIVE_EDGE` kept distinct (REV-02); Exact Return row, P5 guard, atomic composite `RH`, REV-07 matrix cell, P2/P7/P8 strip text. Corrected in v3: P8 strip and Back row now state `RestoreTemporal := PINNED(capturedTC)` with the `FOLLOW_LIVE@30 → PINNED(12) → LH 44 → Back = PINNED(30)` example (FREEZE-01); the announcement caption no longer shows "4 of 9" and states the nonvisual firewall (FREEZE-02); P3 strip and the composite matrix row carry the settle-time `UniqueLocatable` rule (FREEZE-03); a dedicated P8 matrix row added.

What it proves (each cell is a schematic of the *same* Organic Living Field with fixed Home loci; the Track under each world is scaffolding):
1. State key `S` + the two targets + the three phases.
2. Sequence: `FOLLOW_LIVE` idle → scrub Preview (structure only, depth veiled, camera fixed) → release → `PINNED(m)` settle → P4 → `FOLLOW_LIVE` with camera unchanged.
3. `LIVE_EDGE` vs `Moment(LH)` when Live advances mid-gesture — both outcomes shown.
4. Temporal-only vs P3b two-step vs P3a composite.
5. Suspended inspection.
6. Five returns → five destinations.
7. The primitive vocabulary strip and the input-class mapping.

Not canonical in it: any shape, colour, glyph, layout, control placement, copy.

## 11. Proof Board B — Temporal Interaction Adversarial Stress

`boards/S5.2_B_Temporal_Interaction_Adversarial_Stress_FREEZE_CANDIDATE.png` (source `.html` alongside).

Twenty cells, one per scenario S-01…S-20, each showing before/after worlds with the current-session Track and mode, and the verdict. Cells changed in v2 carry their REV tag; cells changed in v3 carry a FREEZE tag: S-11 (now the `FOLLOW_LIVE@30 → PINNED(12) → LH 44 → Back = PINNED(30)` proof), S-17 (settle-time uniqueness at `LIVE_EDGE`: one locus at grant, two at settle → explicit choice, no camera move), S-19 (nonvisual count leakage named). The result column is a **candidate** result awaiting final sign-off, not a PASS declaration.

---

## 12. Open Questions — remaining after Architecture rulings

### Closed by the targeted revision
| ID | Ruling | Where applied |
|----|--------|---------------|
| OPEN-01 | **NOT ALLOWED** — no future structural ticks/markers/counts/labels/disabled controls after `TC` while pinned; minimum non-semantic extent + Live-edge meta indication only; explicit Preview to a later `PTC` may reveal `P(PTC)` (REV-06) | §6, §8 S-19, §9 MUST 14 / MUST NOT 9 |
| OPEN-03 | Spatial input during Preview **cancels** the Preview, never commits it (REV-07) | §3.2 P6, §6, §8 S-16, §9 MUST 13 / MUST NOT 3 |
| OPEN-04 | Suspended-`IF` naming is **knowledge-gated** (REV-06) | §7.3, §8 S-05, §9 MUST 15 / MUST NOT 20 |
| OPEN-05 | "Jump to `KF(x)`" allowed **only as symbolic explicit navigation with no pre-disclosure** (REV-06) | §3.2 P3, §8 S-08, §9 MAY 1 / MUST NOT 11 |
| OPEN-07 | Composite acts are **atomic** in `RH`; one act = one transaction (REV-05) | §2.7, §3.2 P3/P5/P8, §6, §8 S-06/S-11 |

### Remaining OPEN
| ID | Question | Why still open | Suggested owner |
|----|----------|----------------|-----------------|
| OPEN-02 | Exact input vocabulary for the P3a distinct locate affordance on touch/pointer/keyboard | Stage 4 left gesture vocabulary open; styling-adjacent | Experience |
| OPEN-06 | Temporal bookmarks as named P2 targets **within the current Session** — persistence, naming; must not expand into a cross-session Timeline (REV-01) | Data/persistence concern; may belong with Stage 13 | Product |
| OPEN-08 | Granularity of a coarser in-session step / of the Track under very long Sessions (never Session-level, REV-01) | Scale; interacts with Stage 4's performance non-blockers | Architecture |
| OPEN-09 | Whether an object-originated temporal jump ("show the world when this Reading became current" = `VF` start) is permitted as a P2 source | Must be proven not to conflate `VF`/`KF`/`RTO`; interacts with REV-08 | Architecture |
| OPEN-10 | Motion of the veil / settle | Stage 12 | — |
| OPEN-11 **(new, REV-08)** | Which object classes / markers, if any, may be presented on the current-session Track; and whether announcements may name Session content | Timeline disclosure stage — deliberately not pre-designed here | Next Stage 5 sub-stage |
| OPEN-12 **(new, REV-02)** | How the physical Track endpoint distinguishes "follow the moving Live Edge" from "select the latest absolute Moment" | Final affordance is Experience work; grammar only fixes that both intents exist and never collapse | Experience |

No OPEN item was opened or closed by FREEZE-01…03; they are precision corrections. The remaining list is unchanged from v2.

Explicitly **not** open (accepted direction, confirmed at Final Architecture Freeze Review): `LIVE_EDGE` as a distinct moving target; Model C; `PTC ∉ S`; temporal intent ≠ spatial intent; one-shot locate entitlement; no persistent follow; commit at gesture end only; Preview never writes `RH`; non-drag equivalents; Return to Live Head temporal-only; no relative pins; Preview preserves no-hindsight and fixed geography.

---

## 13. Final sign-off Handoff (Product / Experience / Architecture)

**Confirmation:** REV-01…REV-08 and every other accepted v2 decision remain unchanged. FREEZE-01…03 are precision corrections applied only where `CHANGE_LOG_FREEZE01-03.md` says; no primitive, state member, OPEN item or scenario was added or removed.

**What is being asked of sign-off:** verify the three corrections landed exactly, then confirm the grammar may be frozen. This package does not declare itself frozen.

Suggested final checks (in addition to the v2 attack list below):
- **FREEZE-01:** search for any restoration wording without the `PINNED(capturedTC)` normalisation; run `FOLLOW_LIVE@30 → PINNED(12) → LH 44 → Back` through §2.7, P8, §6, §7.1, S-11 and Board A/B — all must give `PINNED(30)`.
- **FREEZE-02:** search the package and boards for any "x of N" or total-count example; confirm §3.3, MUST 17, MUST NOT 9, S-19 and Board A caption agree.
- **FREEZE-03:** confirm P3a, §5.3, §5.4, §6 P3a cell, MUST 6–7, MUST NOT 21, S-17 all state settle-time `UniqueLocatable` with the 1/0/>1 outcomes and `FOLLOW_LIVE` re-evaluation.

v2 attack order (still valid):
1. **Try to make `TM/TC` change without a commit** (matrix §6 invariant 1) — including via spatial input during Preview (REV-07, invariant 5).
2. **Try to make `MC` move without an explicit `E(x)`** (invariant 2, §5.4) — including P5 with an Emerging `LF` (REV-04).
3. **Try to make Preview assert something false or leak something future** — the veil must be uniform; look for any per-object treatment; try the post-`TC` Track segment while pinned (REV-06).
4. **Try to collapse `Moment(LH)` and `LIVE_EDGE`** in either direction (REV-02, invariant 6).
5. **Try to pollute `RH`** through alternating scrub/pan/jump, and try to find a composite act that needs two presses (REV-05).
6. **Try to force a new member of `S`** — if any scenario needs one, the candidate fails its own constraint.
7. **Try to find any Session-level assumption** left in the grammar, matrix, scenarios or boards (REV-01).
8. **Try to make Exact Return yield `FOLLOW_LIVE`** by any route (REV-03).

**Upstream freezes touched and confirmed untouched:** Stage 4 return actions (extended, not redefined); Stage 4 camera-preservation and no-hijack; Stage 4.3 no-silent-ownership; Stage 3.5 Emerging Focus provisional/pre-geographic; Stage 3.6 in-place Session disclosure; 5.1 §1–§7 verbatim (the v1 Exact Return exception is withdrawn).

**Deliberately absent:** Replay; Timeline styling, typography, iconography, colour; motion; renderer; persistence; any repository change.

**If review passes:** the next sub-stage should be the Timeline's *disclosure model* (OPEN-11: what the current-session Track itself may show while remaining a navigator, under the REV-08 `SP`-address rule), then Stage 5 closure proofs.

---

## Appendix A — Core Questions 1–15, direct answers

1. **Enter historical from `FOLLOW_LIVE`?** By committing any `Moment(m)` target — scrub release at a Moment, Jump to a Moment/Step/address, or P3a — including `Moment(LH)` (REV-02). No mode control.
2. **What is a scrub?** A continuous gesture moving a gesture-scoped `PTC` over `M_current ∪ {LIVE_EDGE}` (current Session only, REV-01), presenting `P(PTC)`, camera fixed, committing once at gesture end (§3.2 P1).
3. **Preview / committed / settled distinct?** Yes — but only committed is world state; preview is gesture status; settled is completion of presenting `K(TC)` (§4.5).
4. **When does `TM` become `PINNED(t)`?** At gesture end / activation, never earlier, never on a timer (§3.3).
5. **Does preview mutate full `K(t)`?** No. Preview presents `P(PTC) ⊆ K(PTC)` at depth ≤ Z1 with depth veiled; full `K(TC)` only after commit (§4.3).
6. **Release on the same Live Head position?** Depends on the **target kind**, not the coordinate (REV-02): releasing on the Live-Edge affordance → `FOLLOW_LIVE` (no-op if already following; Return to Live Head if pinned); releasing on `Moment(LH)` as a Moment → `PINNED(LH-at-commit)`, an absolute pin that later ceases to equal `LH` (§8 S-09; endpoint affordance OPEN-12).
7. **Which actions mean what?** Temporal-only: P1, P2, P4. Temporal+locate: P3a, P3b, P5. Return to live: P4 (temporal), P5 (temporal+spatial). Jump to a conversational moment: P2 with a Moment address/marker (§3.1).
8. **Direct jump vs scrub?** Jump is addressed, atomic, traverses nothing, commits immediately; scrub is traversed, previewed, commits at gesture end; Jump is also the non-drag equivalent (§3.2 P2).
9. **Live advances during preview vs after pin?** Preview: `PTC` Moments hold, `LIVE_EDGE` follows; Track extends. After pin: `TC/K(t)` unchanged; extent grows; "live continued" indicator without content (§6 row "Live advances").
10. **What cancels/preserves a locate entitlement?** One-shot; discarded by spatial input, a new temporal act, cancel, or a failed settle-time predicate (`Locatable`, or `UniqueLocatable` for P3a, re-evaluated against then-current `K(LH)` under `FOLLOW_LIVE`); never preserved across acts; never executed on a grant-time result (§5.4, FREEZE-03).
11. **Returns after temporal actions?** §7.1 table — five distinct destinations; **every** restoration (P7 and P8, including composite unwind) yields `PINNED(capturedTC)` (REV-03, FREEZE-01); composite acts unwind in one press (REV-05); P5's locate is guarded (REV-04); only P4/P5 establish `FOLLOW_LIVE`.
12. **Rapid scrub and narrow?** Structure-only preview, camera fixed, mode indicator persistent on narrow; same current-session Track and targets (§8 S-03, S-15).
13. **Unavailable targets?** Temporal part commits; locate refused truthfully; no silent substitute; a symbolic "go to when this becomes available" act MAY be offered for an explicitly targeted `x` with no pre-disclosure (REV-06, §8 S-08).
14. **Never inferred from `RTO` / age / location?** Any Timeline address (if markers are later approved) derives from current-session `SP` only; never importance, staleness, causality, rank, activity, or any temporal fact from `RTO`, `KF`, `VF/VT`, object age, Thread age or spatial position (REV-08, §9 MUST 16 / MUST NOT 15).
15. **One-time locate sufficient?** Yes for 5.2; persistent follow rejected (would add state, hijacks camera, duplicates Replay) (§5.5).
