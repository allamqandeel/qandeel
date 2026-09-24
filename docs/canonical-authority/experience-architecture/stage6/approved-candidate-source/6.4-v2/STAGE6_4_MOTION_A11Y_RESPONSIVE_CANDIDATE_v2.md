# QANDEEL_STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v2
## Stage 6.4 — Motion + Accessibility + Responsive Experience Contract

**Status:** CANDIDATE v2 — Architecture corrections applied, for final review
**Date:** 2026-09-03
**Upstream:** Stages 0–5 · 6.1 · 6.2 · 6.3 — all CLOSED / FROZEN
**Owned:** OPEN-10 (motion) · accessibility topology · non-pointer reach · pointer/touch topology · responsive interaction expression · presentation interruption/cancellation
**Authority consumed:** `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` · Stage 6.1 / 6.2 / 6.3 Final Freeze Records · Stage 6.4 Pre-Flight Contract Gate · Stage 6.4 Execution Authorization · **`QANDEEL_STAGE6_4_ARCHITECTURE_RULING_v1.md`**

> **Stage 6.4 is NOT declared frozen by this package.** No frozen semantics were reopened. No new canonical state member was introduced. No repository file was touched. No code was written.

**Clause namespacing:** `MO-nn` motion · `AXT-nn` accessible topology · `RE-nn` reach · `PT-nn` pointer/touch · `RC-nn` responsive · `IN-nn` interruption.

---

# 0. v2 change note

Architecture approved six directions (A64-01…A64-06) and required **two load-bearing corrections plus four wording/authority narrowings**. Research was approved and is not repeated; unaffected matrices, tests and evidence are carried forward verbatim.

| Correction | What changed | Sections |
|---|---|---|
| **REV-64-01 — AX4-06 was not proven** | My v1 proof rested on acceleration plus direct routes. **Architecture is right that it is insufficient:** with a bounded rate cap, one-Moment traversal remains proportional to `n`, and the cited direct routes do not reach an arbitrary distant **already-disclosed** Moment that is outside the window and was never visited. v2 adds a **second, independent mechanism** — **disclosed-region window navigation**, which is presentation-only and moves the *viewport*, never the temporal cursor. | Decision Index, §19–§21, §26, §30, §32, §35–§38, §40, Board B |
| **REV-64-02 — responsive Preview rule must be singular** | v1's "either survives or is cancelled" left the choice to the implementer, which would let layout acquire semantic authority. **Responsive recomposition alone never cancels Preview**; only a genuine **input-stream cancellation** does. | §24 RC-P3, §25 IN-10, §31, §32 (X64-06A/B), Boards A and B |
| **REV-64-03 — narrow the topology freeze** | "Bounded range over the disclosed region" is narrowed to a **platform-neutral disclosed-region *target navigator***. A range implementation may be used only if 6.5 proves its metadata compatible. **AXT-03** is narrowed to forbid quantity/membership metadata **whose value depends on undisclosed/future material**, rather than all quantity. | §14–§16, §26, §30, Board B |
| **REV-64-04 — narrow the SC 2.5.7 attribution** | The standard requires *a* non-dragging single-pointer equivalent; it does **not** mandate held activation specifically. QANDEEL *selects* held activation as one such equivalent. | §2 S9, §3, §22, Board B |
| **REV-64-05 — pausable presentation ≠ pausable Live** | MO-06 is narrowed: the user may control **presentation behaviour**; authoritative state (`LH`, committed events, ingestion, analysis) continues to advance. Resuming resolves to current truth without replaying intermediate states. | §2 S2, §3, §7 MO-06 |
| **REV-64-06 — pointer cancellation is a default, not a universal rule** | Discrete actions keep the up-event/abort default; **continuous Preview may begin on pointer-down** while commit remains on release under the frozen grammar, and no down-event may create an irreversible commit. | §22 PT-02, §25 |

## Preserved unchanged (A64-01 … A64-06)

M4-A empty · semantic state independent of animation progress · immediate historical resolution with no ghost, no cross-fade, no relation persistence, no lifecycle rewind, no camera drift · one-Moment semantic traversal · held duration-based acceleration · interruption as presentation-level · chrome recomposes while canonical Map geography does not · Back reverses transactions not frames · no animation frame is an `RH` checkpoint · no-op receives no motion.

## Stop-Rule check — run before applying

The corrected model requires **none** of the nine prohibited things.

- **No semantic unit larger than one Moment.** Window navigation is **not a temporal act at all**: Stage 6.2 froze windowing as presentation-only — it changes simultaneity, not target identity, writes no `RH`, and does not commit `TC`. The temporal cursor still moves one Moment at a time, and no named or selectable temporal unit is created.
- **No future enumeration.** Window navigation operates **only within the current disclosure horizon**; it may not leap the window into undisclosed post-`TC` structure, which remains reachable solely by relative progressive Preview.
- **No responsive layout cancelling or committing Preview** — REV-64-02 removes exactly that.
- **No platform role frozen** whose metadata could leak — REV-64-03 narrows the topology to a platform-neutral navigator and defers mappings to 6.5.
- **No animation timing as authority, no motion as sole meaning, no new `RH` semantics, no Map re-layout, and no reopening of 6.2/6.3** — all unchanged from v1.

**Therefore no conflict is reported and the corrections are applied as ruled.**

---

# Stage 6.4 Decision Index *(v2)*

```text
OPEN-10 → MINIMUM SEMANTIC MOTION CONTRACT: motion is OPTIONAL EVERYWHERE.
          M4-A is empty — no distinction has motion as its sole carrier.
          Historical projection change RESOLVES IMMEDIATELY (no cross-fade, no ghost).
        → continuity across a projection change is already carried by frozen invariant
          geography: Home loci never move, so the scene needs no animation to stay
          recognisable. Interpolating instead would risk a frame asserting false truth.

ACCESSIBILITY TOPOLOGY → DISCLOSED-REGION TARGET NAVIGATOR + RELATIVE FORWARD ACTION
          + SEPARATE LIVE TARGET (platform-neutral; not canonically a range, listbox,
          grid or tree), plus two commit acts on the focused target
        → derived from epistemic compatibility first: the navigator addresses only
          legitimately disclosed targets and never publishes membership of undisclosed
          material, while the two non-metric affordances carry the parts that have no legal
          bounded expression. A range implementation is allowed only if 6.5 proves its
          required metadata compatible. [REV-64-03]

LONG-SESSION REACH → TWO INDEPENDENT MECHANISMS.
          (A) TEMPORAL TRAVERSAL — semantic unit ONE MOMENT, held duration-based
              acceleration; used for adjacency, Preview, and earning forward disclosure.
          (B) DISCLOSED-REGION WINDOW NAVIGATION — presentation-only viewport movement
              by screenful/scroll within the current horizon, then direct selection.
        → acceleration improves the constant factor but not the order, so rate alone
          cannot carry AX4-06. Window navigation moves the VIEWPORT, never the temporal
          cursor: it mutates no TM/TC/PTC, writes no RH, and names no temporal unit —
          which is why it is not OPEN-08. [REV-64-01]

RESPONSIVE CONTRACT → CHROME RECOMPOSES; CANONICAL MAP GEOGRAPHY DOES NOT.
          Recomposition BY ITSELF NEVER CANCELS PREVIEW — only a genuine input-stream
          cancellation does
        → layout has no semantic authority, so it may not be the thing that decides
          whether PTC survives; the two cases are separated deterministically. [REV-64-02]

INTERRUPTION MODEL → PRESENTATION RETARGETS; TRANSACTIONS ARE NEVER REWRITTEN.
          A newer authoritative act supersedes in-flight presentation and creates its own
          transaction if effective; no animation frame is ever an RH checkpoint
        → follows directly from "settle is a state-machine boundary, not an animation
          event": if timing cannot commit, interruption cannot un-commit.
```

---

# 1. Authorization compliance

| Requirement | Compliance |
|---|---|
| Targeted research R-64-01…R-64-05 only | §2 — five questions, nine sources, six-field records. Stage 6.2/6.3 research carried forward, not repeated. |
| EG-64-01 — semantic state commits independently of presentation | §4, §7 MO-01; every row of §5 names its authoritative boundary; X64-01/X64-02 prove it. |
| EG-64-02 — motion may reinforce, never carry alone | §6, §8 — every permitted cue names its non-motion carrier; **M4-A is empty**, verified per row. |
| EG-64-03 — no forbidden temporal overlap | §9 — historical projection resolves immediately; ghosting and simultaneous-current overlap are structurally impossible; X64-03, MA-03, MA-04. |
| EG-64-04 — topology from epistemic compatibility, not convention | §14–§16 — metadata-first comparison; no platform role frozen; the recommendation is platform-neutral. |
| EG-64-05 — reach by repetition, not a larger unit | §19–§21 — acceleration is duration-driven; unit remains one Moment; X64-04, X64-05. |
| EG-64-06 — interruption changes presentation, not history | §25 — twelve-row matrix, seven columns. |
| Do not revive OPEN-06/08/09/19 | Not revived; §38 carries the negative-scaffolding criteria. |
| Do not freeze decorative polish | No duration, easing, curve or choreography is fixed (§39). |
| Two proof boards only | §33, §34. |
| No repo changes / no coding | Confirmed. |
| Do not declare Stage 6.4 frozen | Not declared. |
| **AX4-06 STOP condition** | **Not triggered.** §21 shows practical reach without a semantic coarse step; the reasoning is given rather than asserted. |
| STOP on any Stop-Rule trigger | **None triggered.** §40 tests all thirteen. |

---

# 2. Research inventory

Five questions, nine sources. Each: source · authority/type · principle reused · QANDEEL implication · conflict with frozen semantics · pattern explicitly not copied.

## R-64-01 — Reduced motion / motion accessibility

**S1 · W3C WCAG 2.2 — SC 2.3.3 Animation from Interactions** (W3C Recommendation).
- **Principle reused:** "Motion animation triggered by interaction can be disabled, unless the animation is **essential** to the functionality or the information being conveyed." Its stated purpose is preventing distraction and vestibular symptoms.
- **QANDEEL implication — a clean derivation rather than a constraint to satisfy later:** Stage 6.4 presumes **M4-A is empty**, i.e. no motion is essential to any QANDEEL meaning. If that presumption holds — and §6 verifies it row by row — then **every** QANDEEL motion is non-essential by construction, and 2.3.3 is satisfied simply by making all of it disableable. The accessibility requirement and the product requirement turn out to be the same requirement.
- **Conflict:** none. The criterion's "essential" escape hatch is one QANDEEL must never need; using it would itself be the Architecture problem EG-64-02 says to report.
- **Not copied:** CSS/platform implementation as product semantics. `prefers-reduced-motion` is a signal an implementation reads, not a QANDEEL concept.

**S2 · W3C WCAG — SC 2.2.2 Pause, Stop, Hide** (W3C Recommendation).
- **Principle reused:** the distinction that 2.2.2 governs motion the page starts **automatically**, whereas 2.3.3 governs motion the **user's interaction** starts.
- **QANDEEL implication *(narrowed in v2 — REV-64-05)*:** it partitions QANDEEL's motion cleanly. Almost all of it is interaction-triggered. The one class that is *not* is **presentation of passive Live evolution** — a Moment committing while the user does nothing. Where the criterion's applicability conditions are met, the user may pause, stop, hide or otherwise control that **presentation behaviour**. **Stage 6.4 gains no authority to pause authoritative state:** `LH`, committed conversational events, evidence ingestion, canonical Live analysis and runtime progression continue to advance regardless. On resume, presentation resolves to **current** authoritative truth and does not replay intermediate states as historical animation; passive evolution still writes no `RH`.
- **Not to be read as:** "pause Live" as product semantics. That would be a separate authorization.
- **Not copied:** blink/marquee-era framing; QANDEEL has no auto-playing decorative motion.

**S3 · W3C WAI — C39 / SCR40 techniques (`prefers-reduced-motion`)** (W3C techniques).
- **Principle reused:** users declare a motion preference at the system level and the interface honours it.
- **QANDEEL implication:** the preference may change **mid-session** (X64-06's cousin, tested as IN-11), so the contract must define behaviour on preference change, not only at load.
- **Not copied:** the technique's specific media-query mechanics.

## R-64-02 — Object constancy and state-transition presentation

**S4 · Interruptible-motion design practice (fluid-interface principles as documented in current design-engineering guidance)** — *design-practice source, not normative; weighted accordingly.*
- **Principle reused:** never lock out input during a transition; animate from the **current presentation value**, not the target; on interrupt, continue from where the element actually is rather than restarting.
- **QANDEEL implication:** this is a **presentation** principle and is adopted as one. It tells 6.4 how in-flight visuals should behave when superseded (§25's retarget column) while changing nothing about semantics — the transaction was already decided at the frozen boundary.
- **Conflict:** it would conflict if read as *state* guidance ("the user can reverse the action mid-flight"). In QANDEEL, reversing an **action** is `Back`, which operates on `RH`; grabbing a moving element reverses only the **animation**. §25 keeps those apart explicitly.
- **Not copied:** gesture-driven reversal as a semantic affordance; spring/physics prescriptions; any implication that interruption should undo a committed transaction.

**S5 · Stage 6.3 carried findings — visual stability and change detection** (already researched; **not repeated**).
- **Carried:** perceived position is judged relative to landmarks and context; displacement is readily misattributed; a zero layout-shift score proves nothing here.
- **QANDEEL implication for 6.4:** the same reasoning applies to *motion* — an animation that moves surrounding structure can produce apparent anchor migration exactly as a static change can. Motion inherits Stage 6.3's channel classification (§9, §10).

## R-64-03 — Accessible composite topology

**S6 · W3C WAI-ARIA APG — "Developing a Keyboard Interface"** (W3C authoring guidance).
- **Principle reused:** two focus-management strategies for composite widgets — **roving tabindex** (one element in the tab sequence at a time; the rest `-1`) and **`aria-activedescendant`** (only the container is in the tab sequence; the container names the active element). A stated benefit of roving tabindex is that the user agent scrolls the newly focused element into view.
- **QANDEEL implication — the decisive topology finding:** **focus management does not require set enumeration.** Neither strategy obliges an author to publish how many items exist; both operate on the elements that are present. So a composite built over **only the disclosed region** is epistemically legal, whereas a bounded-range role — which requires a current value inside declared bounds — is not, whenever those bounds would span post-`TC` material. This is what allows §16's recommendation to be derived rather than chosen by familiarity.
- **Conflict:** none, provided the composite's membership is exactly the disclosed set and never a virtual "full session".
- **Not copied:** any specific role (`listbox`, `tree`, `grid`, `toolbar`, `slider`); the assumption that a composite must expose position-in-set; and the DOM-specific mechanics of either strategy — 6.4 freezes **platform-neutral** semantics only (EG-64-04).

**S7 · Stage 6.2 carried finding — range-widget metadata** (already researched; **not repeated**).
- **Carried:** `aria-valuenow` is required for a range role and must lie within declared bounds; omission is available only where a role permits it. Therefore a **full-session** bounded range is incompatible with `PINNED`.
- **Used in 6.4 to settle the question 6.2 left open** (§15, §16).

## R-64-04 — Long-range non-pointer navigation

**S8 · Platform keyboard auto-repeat behaviour and accessibility settings (Windows/macOS/Android keyboard repeat delay and rate; Filter Keys)** (platform documentation).
- **Principle reused:** key auto-repeat is an **OS-level, user-configurable** behaviour with a repeat *delay* and a repeat *rate*, and these settings are themselves accessibility features — Filter Keys exists for users with motor tremor.
- **QANDEEL implication:** repetition of a single action is a native, expected input mechanic, which is exactly what Stage 6.2's one-Moment unit needs. But the contract must **compose with** platform repeat rather than fight it: QANDEEL acceleration must be defined so that a user who has deliberately slowed their repeat rate is not overridden.
- **Also carried as an implementation hazard:** documented failures where holding an arrow key over a **virtualised** list stops scrolling and loses focus. With a windowed Track and roving focus, that is a concrete acceptance criterion, not a theoretical risk (§38).
- **Not copied:** any specific repeat rate or acceleration curve; those are 6.5/implementation values, and QANDEEL freezes only the shape (duration-driven, bounded, interruptible).

## R-64-05 — Pointer / touch and responsive

**S9 · W3C WCAG 2.2 — SC 2.5.1 Pointer Gestures, SC 2.5.2 Pointer Cancellation, SC 2.5.7 Dragging Movements, SC 1.3.4 Orientation** (W3C Recommendation).
- **Principles reused:** path-based and multipoint gestures need a single-pointer alternative (2.5.1); single-pointer activation must be cancellable, and **the criterion permits more than one cancellation model** (2.5.2); **functionality achievable by dragging must have a single-pointer non-dragging equivalent** (2.5.7); content must not restrict itself to one display orientation unless essential (1.3.4).
- **QANDEEL implication — three v1 constraints, with attributions narrowed in v2:** (a) Stage 6.2's pointer forward traversal maps **drag delta** to increments, so **2.5.7 obliges *a* non-dragging single-pointer equivalent — it does not mandate held activation specifically**. QANDEEL v1 *selects* held activation as one such equivalent; other non-dragging controls could also satisfy the standard **(REV-64-04)**. (b) 2.5.2's up-event/abort behaviour is adopted as the **default for discrete activation**, not as a universal semantic rule — continuous Preview may legitimately begin on pointer-down while commit stays on release under the frozen grammar **(REV-64-06)**. (c) 1.3.4 makes rotation a first-class case (RP-03, X64-06A/B) rather than an edge case.
- **Conflict:** none. Note 2.5.8 target size was already analysed in Stage 6.2/6.3 and **is not re-researched**; it is simply now **6.4's to own**.
- **Not copied:** specific pixel values or platform gesture vocabularies; and the assumption that a drag affordance is the primary route to anything.

**Research authority rule observed:** sources rejected mechanisms (§14 Family A while pinned; drag-only traversal; interruption-as-undo) and shaped others. None altered temporal modes, `RH`, Preview/Commit/Settle, Map geography, `IF` semantics, lifecycle semantics, no-hindsight, or any Stage 6.2/6.3 decision. Where S4's interruption principle would have implied semantic reversal, **the source implication was narrowed to presentation** rather than adopted.

---

# 3. Research synthesis

1. **The accessibility standard and the product requirement coincide.** SC 2.3.3 allows interaction-triggered motion only if it is disableable *unless essential*. QANDEEL's own gate presumes nothing is essential. So proving M4-A empty (§6) does double duty: it discharges the product rule and satisfies the standard by construction, with no reliance on the "essential" exception.

2. **Focus management is not enumeration — this is what unlocks the topology.** The APG's two composite strategies operate over the elements that exist and oblige no set-size publication (S6). A composite over the **disclosed region only** is therefore legal where a full-session range is not (S7). The topology in §16 follows from that asymmetry rather than from picking a familiar control. *(v2, REV-64-03: the conclusion is a **target navigator**, stated platform-neutrally. v1 over-specified it as a bounded range, which imported metadata the product contract does not need.)*

2b. **Windowing was already available and I did not use it.** Stage 6.2 froze windowing as presentation-only — it changes simultaneity, not target identity, and writes no `RH`. v1's reach argument reached for acceleration alone and therefore had to claim more for it than it can carry. *(v2, REV-64-01: the second mechanism was there in the frozen material the whole time; §21 now uses it.)*

3. **Acceleration must be driven by duration, never by distance.** Platform key-repeat is duration-driven by nature (S8), which happens to be exactly what QANDEEL needs: an acceleration curve that consults *how long the user has held* requires no knowledge of how far there is to go — whereas any "ease into the target" curve would require a remaining count, which EG-64-05 forbids exposing and AF-01 permits knowing only outside the Experience path. The safe mechanic and the epistemically legal mechanic are the same mechanic.

4. **Dragging is not allowed to be the only route — but the standard does not pick the alternative.** SC 2.5.7 obliges *a* non-dragging single-pointer equivalent for anything achievable by dragging (S9), and Stage 6.2 froze pointer forward traversal as drag-delta-driven, so **an equivalent is required for pointer and touch, not only for keyboard**. Which equivalent is a **QANDEEL product choice**: v1 selects held activation. *(v2, REV-64-04: v1 wrote as though the standard mandated the mechanic itself. It does not.)*

5. **Interruption is a presentation concept only.** The design literature's "grab it mid-flight and reverse it" is about pixels; QANDEEL's reversal primitive is `Back` over `RH` (S4). Keeping those separate is the whole of §25, and it falls out of the frozen rule that settle is a state-machine boundary rather than an animation event.

---

# 4. Frozen cross-surface constraint register

| Source | Constraint | Where it binds |
|---|---|---|
| **S5-TL-03 / S5-TL-04** | Preview → Commit → Settle; `PTC ∉ S`; no Preview `RH`; spatial input cancels Preview | §13, §25 IN-01…IN-03 |
| **S5-TL-06 / S5-RET-07** | Settle-time locate; 1 / 0 / >1 outcomes; multi-locus choice is a separate transaction | §12, §18 |
| **S5-RET-06** | P5 post-live one-shot binding at the post-live boundary | §5, §12, X64-02 |
| **S5-RH-02/04/05** | `Φ_eff` defines effective change; true no-ops and passive events write no `RH` | §5 (no-op row), §25 IN-12 |
| **S5-STATE-01/02** | `S` membership fixed; exactly two temporal modes | §16 — no third mode, no new member |
| **S34-WORLD-05 / 06 / 08** | Home loci constant; geometry manufactures no meaning; narrow reduces simultaneity only | §9, §10, §23, §24 |
| **6.2 — ordinal constant step, windowing, horizon, relative traversal, outboard Live control, P3a, no aggregation** | consumed unchanged | §14–§22 |
| **6.2 freeze AF-01** | Epistemic rules bind derivation/exposure/use in the Experience path, not internal knowledge | §21, §26 — acceleration may not *use* a remainder; runtime may still know `LH` |
| **6.2 freeze AF-03** | The one-Moment unit is a 6.2 Experience decision compatible with frozen semantics | §19–§21 — cited as such, not as an older frozen clause |
| **6.3 — object-intrinsic lifecycle, presence floor, Reopened current-state only, no sparse trigger, content-independent orientation, channel classification, IF divergence** | consumed unchanged | §9–§11, §26 |
| **6.3 freeze AF63-01** | `PINNED` base meaning is *a pinned/fixed temporal projection*; "earlier than Live" only when true | §17, §26 — all announcements use the corrected form |
| **6.3 freeze AF63-02** | Truth-bearing structure may appear; forbidden are **secondary/ambient** spatial consequences | §9 — motion of legitimate truth is permitted; ambient compensation is not |
| **6.3 freeze AF63-05** | IF-D vs IF-E is distinguished by **the reason for non-display** | §11, §17 — announcements use the semantic form, never "a remedy exists" |
| **6.3 freeze AF63-06** | The projection-state expression owns no world coordinate | §23 — recomposing it is a chrome change |
| **6.1 freeze** | Reach obligation is v1; OPEN-08 deferred with nothing reserved | §19–§21 |

---

# 5. OPEN-10 event/state matrix

For each class: the authoritative semantic boundary (from frozen upstream), and the motion classification. **`FORBIDDEN`** · **`OPTIONAL — REINFORCEMENT ONLY`** · **`RECOMMENDED — STATIC EQUIVALENT REQUIRED`** · **`NO CONTRACT NEEDED`**.

| # | Event / state class | Authoritative semantic boundary | Motion class | Non-motion carrier |
|---|---|---|---|---|
| 1 | **Pan** | the act itself; camera is the state | `RECOMMENDED — static equivalent required` | final camera region; the world is unchanged |
| 2 | **Semantic Zoom** | depth change on the act | `RECOMMENDED — static equivalent required` | disclosed depth level and its content |
| 3 | **Ordinary temporal commit** | `Commit(Moment(m)) → PINNED(m)` | `OPTIONAL — reinforcement only` | active-target indicator position (6.2 TL-13) + projection content |
| 4 | **Timeline Preview** | none — `PTC ∉ S` | `OPTIONAL — reinforcement only` | structural preview state, visibly distinct from committed (§13) |
| 5 | **Preview cancel** | discard `PTC`; horizon returns to `TC` | `FORBIDDEN` *(must be immediate)* | disclosure withdrawn; committed state re-shown |
| 6 | **Return to Live Head** | `TM := FOLLOW_LIVE`, `TC := LH` at the act | `OPTIONAL — reinforcement only` | indicator moves to the outboard Live control |
| 7 | **Return to Live Focus** | activation-time binding `LF*`; locate at settle | `RECOMMENDED — static equivalent required` | final camera region |
| 8 | **Go Live + Locate (P5)** | **post-live one-shot binding**, then locate iff locatable | `RECOMMENDED — static equivalent required` | resulting mode + final camera region |
| 9 | **Exact Return** | restoration of the checkpoint tuple | `OPTIONAL — reinforcement only` | restored `TM/TC/IF_ref/MC` |
| 10 | **Back One Step** | reversal of the latest effective transaction | `OPTIONAL — reinforcement only` | the restored state itself |
| 11 | **Historical projection change** | `TC` change; `K(TC)` re-resolved | **`FORBIDDEN` for cross-state interpolation; immediate resolution** (§9) | invariant geography + changed truth |
| 12 | **Object appearance** | the object is legitimate in `K(TC)` | `FORBIDDEN` when caused by a projection change; `OPTIONAL` for a newly committed live fact | presence at its fixed locus |
| 13 | **Object disappearance** | the object is not legitimate in `K(TC)` | `FORBIDDEN` — no fade, no ghost | absence renders nothing |
| 14 | **Relation appearance/disappearance** | relation entitlement in `K(TC)` | `OPTIONAL` for newly committed; `FORBIDDEN` across a projection change | connector presence |
| 15 | **Lifecycle state change** | the then-valid state at `TC` | `OPTIONAL — reinforcement only`, **newly committed changes only** (§10) | boundary constitution + state notation (6.3 HL-02/03) |
| 16 | **IF divergence onset / clearance** | derived `IF_ref ≠ IF_render` | `OPTIONAL — reinforcement only` | standing retained-reference chrome state (6.3 IV-07) |
| 17 | **Responsive re-composition** | none — presentation only | `OPTIONAL — reinforcement only` | the recomposed layout itself |
| 18 | **No-op** | no effective change; **no `RH`** | **`FORBIDDEN`** | nothing — the state is already what was asked for |

**Row 18 is a rule, not an omission.** Any motion on a true no-op would assert that something changed, which is false, and would additionally re-open OPEN-19 by the back door. MA-09 tests it.

---

# 6. Motion classification — M4-A / M4-B / M4-C

## M4-A — motion required as sole carrier: **EMPTY**

Verified against every row of §5: each names a non-motion carrier that is already frozen upstream. Nothing in the register depends on motion to be understood, so **the M4-A set is empty** and no Architecture problem is reported under EG-64-02.

**This is the package's single most load-bearing result**, because it is what makes SC 2.3.3 satisfiable without invoking the "essential" exception, what makes MA-01/MA-02 pass by construction, and what makes every motion decision below a matter of comfort rather than of meaning.

## M4-B — motion may reinforce

Rows 1–4, 6–10, 12 (live case), 14 (live case), 15–17. In each, motion may depict a change the state machine has already decided, and the same information is present without it.

## M4-C — motion forbidden

- Anything that anticipates future unavailable truth.
- Anything that drags objects toward future loci.
- Morphing one canonical identity into another (rows 12, 13).
- Making a relation appear before entitlement (row 14).
- Making a no-op look like a state change (row 18).
- Passive camera rescue (any row) — the camera moves only when an act authorises it.
- Cross-state interpolation over a historical projection change (row 11, §9).
- Any lifecycle "rewind" replaying future-known transitions into an earlier `TC` (§10).

---

# 7. Recommended minimum motion contract

| ID | Clause |
|---|---|
| **MO-01** | **Motion never determines semantics.** Animation progress does not decide whether an act committed, whether an `RH` transaction exists, `TM`, `TC`, `IF_ref`, camera destination authority, locate entitlement, Preview ownership, P5 binding, or `Back` semantics. Skipping, shortening, reducing or interrupting motion **must not change the semantic result**. |
| **MO-02** | **Every motion cue names its non-motion carrier.** A cue with no carrier is rejected, and the absence of a carrier is reported as an Architecture problem rather than solved with motion. |
| **MO-03** | **No intermediate frame may assert a false semantic state** — nothing unavailable, nothing mutually exclusive, nothing not yet entitled. |
| **MO-04** | **Motion inherits the frozen channel classification.** It may not animate any channel that Stage 6.3 classed FORBIDDEN (position, scale, presence attenuation) and may not produce the secondary/ambient spatial consequences AF63-02 prohibits. |
| **MO-05** | **All interaction-triggered motion is disableable**, and the system must behave correctly when it is (SC 2.3.3, satisfied without the "essential" exception because M4-A is empty). |
| **MO-06** | **Passive-evolution *presentation* is controllable; authoritative state is not.** *(v2 — REV-64-05.)* Where the applicability conditions of SC 2.2.2 are met, the user may pause, stop, hide or otherwise control the **presentation behaviour** of automatically updating material, and it is never re-announced per commit. **Stage 6.4 gains no authority to pause `LH`, committed conversational events, evidence ingestion, canonical Live analysis, or any authoritative runtime progression** — these continue to advance. On resume, presentation resolves to **current** authoritative truth; it does not replay unavailable intermediate states as historical animation, and passive evolution still writes no `RH`. "Pause Live" is **not** product semantics and would require separate authorization. |
| **MO-07** | **Motion is interruptible at any moment**, never locks out input, and on interruption continues from the current presentation value rather than restarting (§25). |
| **MO-08** | **No production durations, easings, curves or choreography are frozen here** — only what motion may and may not assert. |

---

# 8. Reduced / no-motion contract

| ID | Clause |
|---|---|
| **MO-R1** | `motion = 0` is a **first-class baseline**, not a degraded mode. Every contract in this package is written so that it is the *default proof case* — both boards are rendered in it. |
| **MO-R2** | Under reduced or disabled motion, every state distinction, every mode, every lifecycle state, every divergence state and every camera destination remains fully understandable through its named carrier (§5). |
| **MO-R3** | No timing dependency of any kind: no distinction may require observing a transition to be perceived, and no act may require waiting for one to complete. |
| **MO-R4** | The motion preference may change **mid-session**; the contract applies from the moment of change, and any in-flight motion resolves immediately to its settled presentation without semantic consequence (IN-11). |
| **MO-R5** | Reduced motion may shorten or remove transitions; it may never remove, delay, or reorder information. |

---

# 9. Historical projection transition contract

# **Immediate resolution. No cross-state interpolation.**

| ID | Clause |
|---|---|
| **MO-H1** | A change of `TC` resolves the projection **immediately**. Material that is not legitimate in the new `K(TC)` is simply not rendered; material that is, simply is. |
| **MO-H2** | **No fade-out of future-unavailable material.** A ghost frame is disclosure of exactly what the firewall excludes (MA-03, X64-03). |
| **MO-H3** | **No cross-fade or morph between versions.** During any overlap, two versions would read as simultaneously current, which no state of the world ever is (MA-04, X64-03). |
| **MO-H4** | **No connector persistence** past the point where the relation is not entitled. |
| **MO-H5** | **No camera drift** introduced to smooth a disappearance — the camera moves only when an act authorises it (M-05). |
| **MO-H6** | Motion **may** accompany the *arrival* of the new projection as a whole (for example a uniform, content-independent settling of the surface) provided it asserts nothing about what changed, and provided it is absent under reduced motion. It may not be per-object. |

**Why immediate resolution rather than a safe interpolation.** The gate permits interpolation only where no intermediate frame asserts unavailable or mutually exclusive truth. For a projection change, almost every interesting interpolation does exactly that: fading an object out depicts it existing while it does not; cross-fading versions depicts two currents; sliding truth in from anywhere depicts a direction. **And the continuity that motion would normally provide is already supplied by frozen geography:** Home loci never move, so the scene remains recognisable across a projection change without any animation at all. Interpolation would therefore add risk to buy something the system already has.

---

# 10. Lifecycle transition-motion contract

| ID | Clause |
|---|---|
| **MO-L1** | **Two cases must never be conflated:** (a) a **newly committed** legitimate lifecycle state change, and (b) **rendering a historical projection at `TC`**. |
| **MO-L2** | In case (a), motion may reinforce the transition, confined to the object's own boundary constitution — the only channel lifecycle owns (6.3 HL-01/02). It may not move, resize, re-weight, or re-salience the Thread. |
| **MO-L3** | In case (b), there is **no transition to animate**. The projection renders the then-valid state directly. Any animation here would be a **lifecycle rewind**, replaying future-known history into an earlier `TC` — the MA-05 failure and a hindsight leak through motion. |
| **MO-L4** | **No persistent trace, no replay.** Reopened remains a current-state expression (6.3 HL-05); motion may not narrate an unavailable past even transiently. |
| **MO-L5** | The **presence floor** applies to motion: no lifecycle transition may pass through a low-presence or near-invisible intermediate frame, since that frame would momentarily depict absence (6.3 HL-04). |

---

# 11. IF divergence-motion contract

| ID | Clause |
|---|---|
| **MO-I1** | Divergence is a **standing derived relationship**; motion may reinforce its onset or clearance but must never turn it into a fleeting notice (6.3 IV-07). |
| **MO-I2** | **Never show the unavailable requested version** — not as a frame, a ghost, a thumbnail, or a morph target (6.3 IV-04). |
| **MO-I3** | **No morph from R1 to R2** where R2 is unavailable at `TC`: it would depict the unavailable and imply overwrite. |
| **MO-I4** | No camera movement and no contextual substitution for continuity (6.3 IV-05). |
| **MO-I5** | Under reduced motion the divergence state is fully legible from the standing chrome alone. |
| **MO-I6** | Any announcement accompanying onset uses the **semantic** distinction between IF-D and IF-E — *the reason for non-display* — never remedy-based phrasing (AF63-05). |

---

# 12. Camera / Return motion contract

| ID | Clause |
|---|---|
| **MO-C1** | Camera motion is permitted **only** where a frozen act authorises camera movement; projection change alone never moves it. |
| **MO-C2** | The **semantic destination is fixed by the frozen boundary**, not by where the animation ends: P3 resolves locate at settle; **P5 binds `P5_LF*` once at the post-live boundary**; Return to Live Focus binds at activation. Motion depicts the journey to a destination that is already decided. |
| **MO-C3** | **Interruption retargets presentation to the newest authoritative destination**; it never splits, merges, or rewrites a transaction (§25 IN-04). |
| **MO-C4** | **`Back` during motion reverses the latest effective transaction, not animation frames** (MA-07, IN-05). |
| **MO-C5** | If motion is skipped or reduced, the user is placed at the destination directly, with the same `RH` result. |
| **MO-C6** | **No animation frame is ever an `RH` checkpoint** (X64-02). |

---

# 13. Preview-motion contract

| ID | Clause |
|---|---|
| **MO-P1** | Preview presentation must be **structurally distinguishable** from committed state — not merely by an animation that has not finished. |
| **MO-P2** | No Preview animation may write `RH`, imply a hidden commit, reveal beyond what is legitimate at `PTC`, or continue after cancellation. |
| **MO-P3** | **Cancellation is immediate** (MO-H-style): `PTC` is discarded, transient disclosure is withdrawn, any associated transition stops at once, and no stale preview frame remains authoritative (MA-08, IN-01). |
| **MO-P4** | Deliberate spatial input cancels Preview **before** the spatial act executes, exactly as frozen (S5-TL-04). |
| **MO-P5** | Forward-traversal preview follows the frozen horizon rule: each increment discloses one further Moment; no animation may disclose ahead of the increment it depicts. |

---

# 14. Accessibility topology option space

Compared **metadata-first** per EG-64-04: what each family's required semantics would oblige QANDEEL to expose, before any ergonomics.

| Family | Structure | Required metadata | Epistemic verdict |
|---|---|---|---|
| **A — bounded-range-led** | one range control over the session | a current value inside declared bounds; conventionally also min/max | **Illegal while `PINNED`** if bounds span post-`TC` material (carried finding S7). Legal only if bounds never exceed the disclosure horizon — at which point it is Family C, not A. |
| **B — composite target/action** | explicit reachable targets + relative forward continuation + separate Live action | membership of the composite; per-element identity. **No set size is required** (S6). | **Legal.** Nothing obliges publication of what is not disclosed. |
| **C — disclosed-region target navigator + relative forward action + separate Live target** *(recommended; narrowed in v2 — REV-64-03)* | a **target navigator addressing only legitimately disclosed temporal targets**, **plus** a separate non-metric forward continuation, **plus** a separate Live target. It is **not canonically a range, listbox, grid or tree** — only a set of addressable disclosed targets with exact selection and window virtualisation | membership limited to disclosed targets; **no publication of future membership**; the two non-metric affordances expose no quantity at all | **Legal, platform-neutral, and structurally closest to the frozen model.** A bounded-range *implementation* may be used on a platform only if 6.5 proves its required metadata compatible. |
| **D — enumerate-all-and-hide** | full session in the accessible tree, future items marked unavailable | set size, position-in-set, and per-future focus stops | **Rejected outright** — it is precisely AX4-02 and F64-07. Recorded because it is the failure mode a conventional implementation drifts into. |

---

# 15. Accessibility comparative matrix

`✔` satisfies · `~` partial · `✘` fails.

| Criterion | A | B | **C (recommended)** | D |
|---|---|---|---|---|
| No future metadata leak while `PINNED` | ✘ | ✔ | ✔ | ✘ |
| Moment targeting within disclosed structure | ✔ | ✔ | ✔ | ✔ |
| `Moment(LH)` vs `LIVE_EDGE` by intent | ✘ *(one control cannot hold two kinds)* | ✔ | ✔ | ~ |
| P3a two distinct acts on a target | ~ | ✔ | ✔ | ~ |
| Preview / Cancel | ~ | ✔ | ✔ | ~ |
| Relative forward continuation past `TC` | ✘ *(a range implies a reachable bound)* | ✔ | ✔ | ✘ |
| Long-session reach | ~ | ~ | ✔ | ✔ *(but illegally)* |
| Screen-reader comprehension | ✔ | ~ | ✔ | ✔ |
| Keyboard | ✔ | ✔ | ✔ | ✔ |
| Touch | ✔ | ~ | ✔ | ~ |
| Mobile | ✔ | ~ | ✔ | ✘ |
| Implementation determinism | ✔ | ~ | ✔ | ✔ |
| Mirrors the frozen structure | ✘ | ~ | ✔ | ✘ |
| Platform-neutral — imposes no required metadata of its own | ✘ | ✔ | ✔ *(v2)* | ✘ |

**Answering the question Stage 6.2 left open — as narrowed by REV-64-03.** A **full-session** bounded range is **invalid** while `PINNED`. A bounded-range expression **confined to the disclosed region** is *not forbidden*, but Stage 6.4 does **not** canonically require one: the frozen contract is a **target navigator**, stated platform-neutrally, because a composite of addressable disclosed targets satisfies the product need without importing min/max/value semantics the contract never asked for. Whether a platform range mapping is used is **6.5's decision, after checking its metadata**. Neither the Live intent nor forward continuation is ever carried by a range.

---

# 16. Recommended platform-neutral accessible topology

# **Disclosed-region target navigator + relative forward action + separate Live target**

| ID | Clause |
|---|---|
| **AXT-01** | **Three distinct accessible affordances**, mirroring the frozen visual structure: (1) a **disclosed-region target navigator**; (2) a **forward continuation action**, relative and repeatable; (3) a **Live target**, non-metric and separately nameable. |
| **AXT-02** | *(narrowed — REV-64-03)* **The navigator contains and addresses only legitimately disclosed temporal targets** — under `PINNED(TC)` at rest, `m0…TC`; during forward Preview, `m0…PTC`. It **never includes undisclosed future material**, supports **exact target selection**, supports **focus/window virtualisation**, and **requires no publication of future membership**. It is **not canonically a slider, numeric range, listbox, grid or tree**; a bounded-range implementation may be used on a platform only if 6.5 proves its required metadata compatible. |
| **AXT-03** | *(narrowed — REV-64-03)* **No quantity or membership metadata whose value depends on undisclosed or future material may be exposed**, and none is derived for that purpose in the Experience path (AF-01). Information derived **solely from already-disclosed material** is not prohibited by Stage 6.4 merely for being quantitative — whether it is useful or necessary belongs to the platform mapping. **No future side channel is permitted in any state.** |
| **AXT-04** | **The forward continuation action exposes no quantity.** It is announced as a repeatable relative action; each invocation may report only what it has **reached**. It has no maximum, no end-stop that reveals arrival before it happens, and no target list. |
| **AXT-05** | **The Live target is separate and separately nameable, by kind and intent** — never described as later than, beyond, or a position relative to `Moment(LH)`. Both must be intentionally choosable (AX4-03). |
| **AXT-06** | **Two commit acts** are available on the focused target — temporal-only and Temporal+Locate — distinguishable **before** invocation and never distinguished only by outcome (AX4-04). |
| **AXT-07** | **Preview, Commit and Cancel are expressible** in every modality; Preview is announced as provisional and never as committed state. |
| **AXT-08** | **Current temporal mode is always available**, using the corrected base meaning — *a pinned/fixed temporal projection* — with "earlier than Live" stated only when true (AF63-01). |
| **AXT-09** | **Focus management operates over disclosed elements only.** Either composite strategy (roving focus or an active-descendant equivalent) is acceptable; neither may be implemented in a way that publishes membership of undisclosed material. **No platform role is frozen here** (EG-64-04); 6.5 supplies mappings. |
| **AXT-10** | **No third mode, no new state member, and no hidden control set** is introduced by the topology. |

---

# 17. Timeline accessible semantics

**What is announced, per state.**

| State | May be announced | Must not be announced |
|---|---|---|
| `FOLLOW_LIVE` | mode; the Live target by kind and intent; the disclosed region's bounds — all of which are past, since `TC = LH` | anything carried over from `PINNED`; per-Moment enumeration of the whole set |
| `PINNED(TC)` | mode as *a pinned/fixed temporal projection*; "earlier than current Live" **only when true**; the navigator's disclosed membership, which ends at the horizon; the Live target generically; that a route back exists | any quantity or membership figure whose value depends on undisclosed material — total/set size/position-in-set/remaining/extent spanning post-`TC`; "moment 40 of 100"; distance-to-live; direction |
| forward continuation | that the action is available and repeatable; what each increment **reached** | how far `LH` is; how many remain; any end-stop before arrival |
| Preview | that the state is provisional; the previewed target | that it is committed; anything beyond what is legitimate at `PTC` |
| lifecycle | present with its lifecycle state; Dormant as **present**, never disabled or unavailable (6.3 freeze §23) | any interaction restriction; any transition history not legitimate at `TC` |
| IF divergence | the standing relationship; identity only to the extent legitimate at `TC` | the unavailable side; remedy-based phrasing for the D/E distinction (AF63-05) |

---

# 18. P3a accessible semantics

- **AXT-P1** Both acts are available on the focused temporal target in every modality, and are **distinguishable before invocation** by name and structure.
- **AXT-P2** Neither act may be reachable **only** by hover, modifier, long-press, path gesture, or drag (F64-09; SC 2.5.1, 2.5.7). Accelerators may exist **in addition**.
- **AXT-P3** The locate act announces its temporal outcome; the spatial outcome is announced only where a landing occurred. **Zero-locus says nothing about the spatial outcome at all** (6.2 L-03) — no failure language, no acknowledgement.
- **AXT-P4** Multi-locus produces an explicit, separately announced contextual choice carrying no authority until selected.
- **AXT-P5** Identical settle, locus and `RH` behaviour across pointer, touch and non-pointer (X64-09).

---

# 19. Long-session reach option space

**What v1 got wrong, stated plainly.** v1 offered only *temporal* mechanisms and then had to claim more for acceleration than it can bear. Architecture's objection is correct and decisive: **with a bounded maximum repeat rate, traversing an arbitrary distant Moment by repeated one-Moment advancement remains proportional to the number of Moments once the cap is reached** — acceleration improves the constant factor, not the order. And the direct routes I cited (Return to Live Head, `Back`, Exact Return, already-visible targets) do **not** provide random reach to an arbitrary distant **already-disclosed** historical Moment that lies outside the current window and was never previously visited. `rate, not unit` remains the correct rule for *semantic traversal*; it simply cannot carry AX4-06 alone.

**The mechanism v1 failed to use was already frozen.** Stage 6.2 froze **windowing** as presentation-only: window movement changes simultaneity and visibility, **not** target identity, writes no `RH`, and does not commit `TC`. That gives a second, categorically different axis of movement — and it was available the whole time.

## Mechanism A — temporal traversal *(semantic)*
- **RE-α — Held activation with duration-based rate acceleration.** Holding the forward (or backward) continuation applies the **one-Moment** increment repeatedly, at a rate that increases with how long the input has been held, bounded by a maximum. Used for adjacency, Preview, and **earning forward disclosure beyond `TC`**.
- **RE-γ — Input-magnitude traversal.** Pointer/touch movement maps to a count of one-Moment increments — Stage 6.2's frozen pointer mechanic. Retained; **not the sole route**.

## Mechanism B — disclosed-region window navigation *(presentation)* — **new in v2**
- **RE-ζ — Window navigation.** Moves the **Timeline presentation window** through material **already inside the current disclosure horizon**, by a presentation amount such as a viewport span, a page-like screenful, a scroll operation, or another platform-neutral window movement. It is **viewport navigation, not temporal navigation**.
- **RE-β — Direct selection within the window.** Once the desired disclosed region is in view, the user **directly focuses and selects the exact Moment** under the frozen temporal grammar.

## Excluded
- **RE-δ — "Jump N Moments" / page-as-temporal-unit / session-fraction.** **Excluded** — a named or selectable *temporal* unit larger than one Moment is exactly OPEN-08. *(Note the distinction that makes RE-ζ legal and RE-δ not: a screenful of **window** is a quantity of presentation; a screenful of **cursor** would be a quantity of time.)*
- **RE-ε — Distance-aware easing.** **Excluded** — it requires a remaining count in the Experience path, which EG-64-05 forbids exposing and AF-01 confines to internals.

---

# 20. Long-session reach comparative matrix

| Test | **RE-ζ window nav** *(new)* | RE-α held + acceleration | RE-β direct selection | RE-γ input magnitude | RE-δ coarse step | RE-ε distance-aware |
|---|---|---|---|---|---|---|
| Is it a temporal act at all? | **No — presentation only** | yes | yes | yes | yes | yes |
| One-Moment semantic unit preserved | ✔ *(vacuously — moves no cursor)* | ✔ | ✔ | ✔ | ✘ | ✔ |
| Mutates `TM` / `TC` / `PTC` | **none** | `PTC` then `TC` on commit | `TC` on commit | `PTC`/`TC` | `TC` | `PTC`/`TC` |
| Writes `RH` | **no** | on commit only | on commit only | on commit only | on commit | on commit |
| No future count required | ✔ | ✔ *(duration-driven)* | ✔ | ✔ | ✘ | ✘ |
| No future focus-stop set required | ✔ | ✔ | ✔ | ✔ | ~ | ✔ |
| **Practical over arbitrary long distance** | **✔** | **✘ — O(n) after the rate cap** | ✔ *(within window only)* | ✘ | ✔ | ✔ |
| Can stop on an exact Moment | n/a — selection does that | ✔ | ✔ | ~ | ✔ | ~ |
| Low motor-precision demand | ✔ | ✔ | ✔ | ✘ | ✔ | ✘ |
| Mobile equivalent | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Assistive-technology equivalent | ✔ | ✔ | ✔ | ✘ | ✔ | ✘ |
| Windowing/virtualisation compatible | ✔ | ✔ *(with the focus rule, §38)* | ✔ | ✔ | ✔ | ✔ |
| May cross the horizon into undisclosed material | **✘ — forbidden** | ✔ *(that is how disclosure is earned)* | n/a | ✔ | — | — |
| Permitted in v1 | **✔** | ✔ | ✔ | ✔ *(not sole route)* | **✘ OPEN-08** | **✘ EG-64-05** |

**Read the "practical over arbitrary long distance" row against the row above it.** RE-α fails it, and that failure is precisely what invalidated v1's proof. RE-ζ passes it **without being a temporal act at all** — which is why the two together succeed where either alone does not.

---

# 21. Recommended reach grammar

# **Two independent mechanisms: temporal traversal (one Moment) + disclosed-region window navigation (presentation only)**

| ID | Clause |
|---|---|
| **RE-00** | **The grammar has two axes and they never merge.** *(v2 — REV-64-01.)* **(A) Temporal traversal** moves the temporal cursor and is semantic. **(B) Window navigation** moves the presentation viewport and is not. Long-distance movement through already-disclosed material is (B) followed by direct selection; movement past `TC` is (A) only. |
| **RE-01** | **The semantic unit of temporal traversal is one Moment, always.** Every advancement is one-Moment adjacency; nothing is skipped, and no larger unit is defined, named, selectable, or exposed. |
| **RE-02** | **Acceleration is a function of input duration only.** The rate at which the one-Moment increment repeats may increase the longer the input is held, up to a bounded maximum. It is **never** a function of distance to any target, and no remaining count is computed for it in the Experience path. |
| **RE-03** | **Stopping is exact.** Releasing the input stops on a Moment, never between Moments, and never overshoots into an inferred destination. |
| **RE-04** | **Compose with platform repeat, do not override it.** Auto-repeat delay and rate are user-configurable accessibility settings; the contract must respect a user's slower configuration rather than impose its own. |
| **RE-05** | **Direct selection inside the disclosed window** is always available as an alternative to traversal, in every modality. |
| **RE-06** | **The frozen direct routes remain the fastest paths where they apply:** Return to Live Head reaches the present in one act; Exact Return and `Back` reach previously visited states without traversal. Reach is not only forward stepping. |
| **RE-07** | **A non-dragging equivalent exists for every drag-driven traversal** (SC 2.5.7), and no path-based or multipoint gesture is the sole route to anything (SC 2.5.1). |
| **RE-08** | **No mechanism may accelerate by disclosing.** Acceleration must not reveal, and must not require, how much lies ahead. |
| **RE-09** | **Window navigation is presentation only.** *(v2.)* It moves the Timeline window by a presentation amount — a viewport span, a page-like screenful, a scroll operation, or another platform-neutral window movement. It **MUST NOT** mutate `TM`, mutate `TC`, create `PTC`, choose a Moment, write `RH`, or create a named semantic temporal unit. It changes what is simultaneously visible and nothing else. |
| **RE-10** | **Window navigation never crosses the horizon.** It may operate **only** on structure already within the current disclosure horizon, and may not leap the window into undisclosed post-`TC` material. For `TC < m ≤ LH` while pinned, future structure remains absent from the resting metric window and **relative progressive one-Moment traversal remains the only mechanism that earns disclosure**. |
| **RE-11** | **Reach is completed by selection, not by the window.** After the desired disclosed region is brought into view, the user **directly focuses and selects the exact Moment** under the frozen temporal grammar. The window movement decided nothing temporal; the selection does. |
| **RE-12** | **Both axes are available in every modality**, including non-pointer: window navigation must be operable without a pointer, and must not depend on drag or gesture as its sole route (PT-01). |

## Why AX4-06 passes — corrected argument

**The v1 argument is withdrawn as insufficient.** It rested on acceleration plus direct routes, and Architecture's objection stands: with a bounded rate cap, repeated one-Moment advancement remains proportional to `n`, and the direct routes do not reach an arbitrary distant already-disclosed Moment outside the window that was never visited.

**The corrected argument, against the revised AX4-06 requirement's four clauses:**

1. **A distant already-disclosed historical Moment, without one-by-one semantic traversal** — reached by **RE-ζ window navigation** (presentation-only, bounded by the horizon) followed by **RE-β direct selection**. The large movement applies to the *viewport*; the temporal act at the end is an ordinary single selection.
2. **A later undisclosed Moment, only by legitimate progressive Preview** — **RE-α** remains the sole route past `TC`, and **RE-10** forbids the window from leaping there. Disclosure is still earned one Moment at a time.
3. **Live via the explicit Live route** — the separate Live target (AXT-05), one act.
4. **Previously visited states through frozen return semantics** — `Back`, Exact Return, Return to Live Head, unchanged.

**Why this is not OPEN-08.** OPEN-08 is a *coarse temporal semantic unit* — a named or selectable quantity of **time** larger than one Moment. RE-ζ moves a quantity of **presentation**. It mutates no temporal state, writes no `RH`, chooses no Moment, and defines no unit that appears anywhere in the temporal grammar. Stage 6.2 already froze windowing with exactly these properties; v2 uses that frozen distinction rather than inventing one.

**Therefore AX4-06 passes and no STOP is reported.** Recorded so it can be audited: had practical reach required a *temporal* unit larger than one Moment, the correct action would have been to stop and report the dependency — and v1's error was not that it reached for the wrong mechanism, but that it declared PASS on a mechanism that could not carry the claim.

---

# 22. Pointer / touch topology

| ID | Clause |
|---|---|
| **PT-01** | Every act has a **single-pointer, non-dragging, non-path-gesture route** (SC 2.5.1, 2.5.7). Drag and gesture may exist only as accelerators. *(v2 — REV-64-04: the standard requires **an** equivalent; QANDEEL **selects** held activation as the primary one. Another non-dragging control could satisfy the standard equally.)* |
| **PT-02** | **Activation is cancellable — with two models, not one.** *(v2 — REV-64-06.)* **For discrete actions**, the v1 default is commit on activation/up within the target, aborting when released outside or otherwise cancelled — **unless** the platform's standard accessible activation semantics provide equivalent cancellation. **For continuous Preview**, pointer-down and movement **may** establish transient Preview, release **may** commit under the already-frozen grammar, and cancellation discards Preview. **In no model may a down-event create an irreversible semantic commit.** |
| **PT-03** | **No act requires hover.** Hover may reveal nothing that is not otherwise reachable. |
| **PT-04** | **Target sizing and spacing are owned here** and are specified as a requirement — every interactive affordance must meet the platform minimum target size or the equivalent spacing exception — while the constant-step Track's uniformity makes that satisfiable for every Moment identically. **No per-Moment pixel value is frozen**; the requirement is. |
| **PT-05** | **Accidental-activation resistance:** the Temporal+Locate act is never the adjacent default of the ordinary act in any modality, and no act is separated from another by timing alone. |
| **PT-06** | **Gesture collision:** Track traversal, window scrolling, and Map pan must be separable; no single gesture may be ambiguous between a temporal and a spatial act, since that would let position determine intent (6.2 P-01). |

---

# 23. Responsive re-composition matrix

| Element | May recompose | May not |
|---|---|---|
| Timeline chrome (placement, extent, orientation) | ✔ | change target identity, step meaning, or the horizon |
| Inspection / return chrome | ✔ | change divergence state or `IF_ref` |
| Projection-state expression | ✔ — it owns no world coordinate (AF63-06) | become a Map object or acquire a locus |
| Action controls, grouping, ordering, labels | ✔ | remove an act, or make one reachable only by gesture |
| Simultaneous disclosure (how much is shown at once) | ✔ — may reduce | reduce **truth** |
| **Canonical Map geography** | **✘** | — Home loci, spatial commitments and world coordinates are invariant |
| **Semantic neighbourhood coordinates** | **✘** | — no repacking, recentring, or compaction |
| Camera viewport | ✔ — which region is visible may change | re-anchor the world; a viewport change maps to the **same** world coordinates |

**RC-01** — *Chrome is interface; geography is world.* A responsive change may alter where an interface element sits on screen and never where anything in the world sits.
**RC-02** — **No responsive state may create new product semantics**, and no mobile-only rule exists.
**RC-03** — Narrow surfaces reduce simultaneity only; every semantic remains available, if sequentially.

---

# 24. Responsive state-preservation contract

Across any breakpoint change, rotation, or device transition:

| ID | Clause |
|---|---|
| **RC-P1** | **State is preserved** — `TM`, `TC`, `IF_ref`, `MC` and `RH` are untouched by re-composition. |
| **RC-P2** | **Focused target is preserved** where it still exists; if the affordance carrying it recomposed, focus moves to the equivalent affordance, never to nothing. |
| **RC-P3** | **Responsive recomposition by itself does NOT cancel Preview.** *(v2 — REV-64-02.)* If a breakpoint, resize or orientation change occurs while Preview is active: **`PTC` survives, target identity survives, `TM`/`TC` remain committed state, `RH` is unchanged.** The presentation re-maps the *same* Preview target into the recomposed interface, and focus moves to the equivalent affordance if needed. |
| **RC-P3a** | **Input-stream exception.** A device, OS or user agent may separately terminate the active pointer/gesture/input stream during rotation. That is an **input cancellation event**, not a responsive-layout rule, and the already-frozen Preview cancellation semantics then apply: discard `PTC`, withdraw transient disclosure, no commit, no `RH`. **Deterministic split:** `responsive recomposition alone → preserve Preview` · `actual input cancellation → cancel Preview`. This keeps layout from acquiring semantic authority. |
| **RC-P4** | **`RH` is preserved** exactly; re-composition is not an act and writes nothing. |
| **RC-P5** | **An in-flight act is not silently completed or abandoned** — §25 IN-10 states which. |
| **RC-P6** | **Camera viewport mapping:** the visible region may change extent or aspect; the world coordinates it maps onto do not move. No re-anchoring, no refit of content to fill the new shape. |
| **RC-P7** | Orientation is supported in both senses (SC 1.3.4); nothing is restricted to a single orientation. |

---

# 25. Interruption matrix

**Canonical principle:** a newer authoritative user act may supersede or cancel in-flight **presentation**, but never retroactively splits, merges, or rewrites an already-defined semantic transaction.

| # | Authoritative state before | Incoming act | Semantic authority | Presentation cancel / retarget | `RH` effect | Final state | Forbidden stale artefact |
|---|---|---|---|---|---|---|---|
| **IN-01** | Preview active (`PTC`) | deliberate spatial input | frozen: Preview cancels **first**, then the spatial act executes (S5-TL-04) | preview presentation stops immediately | none from Preview; spatial act per its own rules | committed `TM/TC` unchanged; spatial act applied | any disclosed post-horizon step; any preview marker |
| **IN-02** | Preview active | new temporal input | the new input owns Preview; old `PTC` discarded | retarget preview to the new target | none | new `PTC` | the previous preview target |
| **IN-03** | Preview active | Return to Live | Return executes from **authoritative committed state**, not from `PTC` | preview stops; disclosure withdrawn | one transaction if effective | `FOLLOW_LIVE` | any preview-derived disclosure |
| **IN-04** | camera motion in flight | new explicit camera act | first act's transaction stands as upstream defines it; second creates its own if effective | presentation **retargets** to the newest authoritative destination, continuing from the current on-screen value | at most one per effective act; **no frame is a checkpoint** | the second act's destination | a blended or queued destination |
| **IN-05** | camera motion in flight | `Back` | `Back` reverses the latest **effective transaction** | motion stops and resolves to the restored state | the reversal per frozen rules | restored state | animation-frame reversal; partial restoration |
| **IN-06** | camera motion in flight | Return to World | Return to World is spatial/depth-only from authoritative state | retarget | one if effective; none if no-op | World view | intermediate camera position treated as authoritative |
| **IN-07** | historical transition presenting | new `TC` act | the new commit is authoritative | previous transition abandoned immediately; new projection resolves | one per effective commit | new `K(TC)` | any object from the previous projection |
| **IN-08** | historical transition presenting | Return to Live | Return executes immediately from authoritative state | transition abandoned | one if effective | `FOLLOW_LIVE`, `TC = LH` | stale historical content |
| **IN-09** | P3a presentation settling | new explicit act | **P3a's own boundary is already frozen** — settle-time locate; P5's post-live binding — and is unaffected by the new act's arrival | presentation retargets | P3a's single transaction stands; the new act adds its own if effective | the new act's outcome | a second transaction attributed to P3a |
| **IN-10A** | Preview active (`PTC`) | responsive breakpoint / rotation, **input stream still active** | re-composition is **not an act** and has **no semantic authority** | layout recomposes; the **same** Preview target is re-mapped; focus moves to the equivalent affordance | **none** | **`PTC` survives**, same target; `TM`/`TC` unchanged | a cancelled Preview; a Preview whose disposition is implementation-chosen |
| **IN-10B** | Preview active (`PTC`) | **platform terminates the active input sequence** | this is an **input cancellation event**, and the frozen Preview cancellation rule applies | preview stops; transient disclosure withdrawn | **none** | committed state; no `PTC` | a hidden commit; any `RH` entry |
| **IN-10C** | any non-Preview interaction | responsive breakpoint / rotation | not an act; no semantic authority | layout recomposes; in-flight motion resolves immediately | **none** | state preserved per §24 | hidden commit; lost focus |
| **IN-11** | any presentation | reduced-motion preference changes | preference is a presentation setting | in-flight motion resolves immediately to its settled presentation | **none** | unchanged | a transition frozen mid-way |
| **IN-12** | any presentation | **no-op activation** | no effective change ⇒ **no transaction** (S5-RH-04) | nothing starts; nothing is cancelled | **none** | unchanged | any acknowledgement animation, which would imply change and re-open OPEN-19 |

**Two invariants across every row:** animation cancellation never manufactures a no-op acknowledgement or an `RH` entry; and no intermediate frame is ever authoritative for anything.

---

# 26. No-hindsight accessibility audit

| Prohibited disclosure | How the topology prevents it |
|---|---|
| Future Moment **count** | The navigator's membership never extends past the horizon (AXT-02); the forward action exposes no quantity (AXT-04); **no metadata whose value depends on undisclosed material is exposed or derived for exposure** (AXT-03, AF-01). |
| Future **set size / position-in-set** | Focus management operates over disclosed elements only and publishes no membership of undisclosed material (AXT-09, S6). **Window navigation cannot widen that set** — it moves the viewport within already-disclosed material and stops at the horizon (RE-10). |
| Future **range extent / progress ratio** | No full-session bounded expression exists while `PINNED` (§15). |
| Future **identity / context** | Announcements are content-gated per Stage 6.3's IF rules (§17). |
| Future **lifecycle history** | Only the then-valid state is announced; no transition history (§17, MO-L4). |
| Future **locus / direction** | No announcement is positional relative to undisclosed material; no cue points. |
| **Arrival as disclosure** | Reaching `LH` is arrival, not a published bound; no end-stop announces it in advance (AXT-04, RE-08). |
| **Acceleration as a side channel** | Acceleration depends on input duration only; a remaining count is neither used nor needed (RE-02). |
| **Dormant mis-description** | Dormant is announced as present with a lifecycle state, never disabled or unavailable (§17). |

---

# 27. Reduced-motion audit

| Question | Answer |
|---|---|
| Is any distinction carried only by motion? | **No** — M4-A is empty; §5 names a carrier for every row. |
| Does any act require a transition to complete? | No — MO-01, MO-R3. |
| Does reduced motion change any semantic outcome? | No — X64-01 tests 0 ms, short and long motion for identical results. |
| Is interaction-triggered motion disableable? | Yes — MO-05, satisfying SC 2.3.3 without the "essential" exception. |
| Is passive-evolution presentation controllable? | Yes — MO-06, per SC 2.2.2. |
| Can the preference change mid-session? | Yes — MO-R4 / IN-11, with immediate resolution and no semantic effect. |
| Do the proof boards demonstrate the zero-motion case? | Yes — both are static, so the baseline is the rendering itself. |

---

# 28. Mobile / narrow audit

| Question | Answer |
|---|---|
| Does canonical geography change? | No (RC-01, RP-01). |
| Do target meanings change on a narrow Timeline? | No — same targets, less simultaneous exposure (RP-02). |
| Does a breakpoint during interaction alter state, target, or `RH`? | No (RC-P1…RC-P5, IN-10, RP-03). |
| May orientation/IF chrome recompose? | Yes, with identical content truth (RP-04, AF63-06). |
| Is every act reachable without drag or gesture on touch? | Yes (PT-01, RE-07). |
| Are targets operable at narrow width? | Yes — the constant step makes uniform sizing achievable; the requirement is stated, values are not frozen (PT-04). |
| Any mobile-only semantics? | None (RC-02). |

---

# 29. MA-01 … MA-09 results

| Test | Result | Evidence |
|---|---|---|
| **MA-01** motion removed | **PASS** | M4-A empty (§6); every §5 row names a non-motion carrier. |
| **MA-02** reduced motion | **PASS** | MO-R1…MO-R5; no timing dependency anywhere. |
| **MA-03** future ghost attack | **PASS** | MO-H1/MO-H2 — immediate resolution; no fade of unavailable material. |
| **MA-04** supersession overlap | **PASS** | MO-H3 — no cross-fade or morph; two versions never co-present. |
| **MA-05** lifecycle rewind attack | **PASS** | MO-L1/MO-L3 — a historical projection has no transition to animate. |
| **MA-06** camera interrupted | **PASS** | IN-04 — one authoritative destination, one transaction per effective act. |
| **MA-07** `Back` during motion | **PASS** | MO-C4, IN-05 — reverses the transaction, not frames. |
| **MA-08** Preview cancelled mid-animation | **PASS** | MO-P3, IN-01 — immediate discard, no stale content. |
| **MA-09** no-op motion | **PASS** | §5 row 18, IN-12 — motion forbidden on a true no-op. |

---

# 30. AX4-01 … AX4-08 results

| Test | Result | Evidence |
|---|---|---|
| **AX4-01** full-session slider leak **[re-run v2]** | **PASS (rejection fixture)** | §14 Family A rejected while `PINNED`; **AXT-02 confines the navigator's membership to disclosed targets**, so a full-session range cannot arise. The rejection now rests on membership rather than on bounds arithmetic (REV-64-03). |
| **AX4-02** future focus-stop leak **[re-run v2]** | **PASS** | AXT-09 — focus over disclosed elements only; AXT-03 forbids membership metadata dependent on undisclosed material; Family D rejected. **RE-10 additionally prevents window navigation from bringing undisclosed structure into the focusable set.** |
| **AX4-03** Live vs latest | **PASS** | AXT-05 — separate, separately nameable, intent-distinct. |
| **AX4-04** P3a | **PASS** | AXT-06, AXT-P1 — two acts distinguishable before invocation. |
| **AX4-05** forward reach without disclosure **[re-run v2]** | **PASS** | AXT-04, RE-02, RE-08 — no quantity, no end-stop, duration-driven. **RE-10 confirms the new window mechanism cannot substitute for earned disclosure**: past `TC`, RE-α remains the only route. |
| **AX4-06** long-session practicality **[re-run v2 — v1 result withdrawn]** | **PASS — no STOP required** | §21's **corrected** argument against the revised four-clause requirement: RE-ζ window navigation + RE-β selection for distant disclosed material; RE-α alone for undisclosed; Live route; frozen returns. v1's rate-plus-direct-routes argument is withdrawn as insufficient. |
| **AX4-07** Dormant semantics | **PASS** | §17 — present with lifecycle state, never disabled/unavailable. |
| **AX4-08** IF cases | **PASS** | §17, MO-I1…MO-I6 — content-gated; D/E by reason for non-display (AF63-05). |

---

# 31. RP-01 … RP-04 results

| Test | Result | Evidence |
|---|---|---|
| **RP-01** narrow Map | **PASS** | RC-01 — geography invariant. |
| **RP-02** narrow Timeline | **PASS** | RC-03 — same targets, less simultaneity. |
| **RP-03** breakpoint during interaction **[re-run v2]** | **PASS** | **IN-10A / IN-10B / IN-10C** and RC-P3 / RC-P3a — recomposition alone preserves Preview; only a genuine input-stream cancellation cancels it. The implementer no longer chooses. |
| **RP-04** orientation chrome | **PASS** | §23, AF63-06 — recomposes; content truth identical. |

---

# 32. X64-01 … X64-10 results

| Test | Expected | Result |
|---|---|---|
| **X64-01** animation-duration attack | identical semantics at 0 ms / short / long | **PASS** — MO-01; the boundary is the state machine's, so duration is not an input. |
| **X64-02** frame-interruption at 10 / 50 / 90 % | same transaction rules; no frame checkpoint | **PASS** — MO-C6, IN-04…IN-09. |
| **X64-03** false overlap | no frame shows R1 and R2 as simultaneously current | **PASS** — MO-H3; immediate resolution leaves no overlap interval to misread. |
| **X64-04** acceleration is not a coarse step **[re-run v2]** | every advancement is one-Moment adjacency; no large-step command or exposed unit | **PASS** — RE-01/RE-02; only the repeat rate varies. **The newly added RE-ζ does not weaken this**: it advances no cursor at all, so it cannot constitute a step of any size (RE-09, and the §20 "is it a temporal act?" row). |
| **X64-05** unknown-remainder reach **[re-run v2]** | traversal continues without computing/exposing a remaining count | **PASS** — RE-02, RE-08; acceleration is duration-driven. Window navigation likewise consults no remainder: it moves a viewport within already-disclosed material and stops at the horizon (RE-09, RE-10). |
| **X64-06A** breakpoint/orientation change, **input stream remains active** *(new subcase)* | same `PTC`, same Preview target, recomposed presentation, no `RH` | **PASS** — RC-P3, IN-10A. Preview survives; only the presentation is re-mapped. |
| **X64-06B** platform **terminates the active input sequence** *(new subcase)* | Preview cancels under the existing rule; no hidden commit or `RH` | **PASS** — RC-P3a, IN-10B. The cancellation is attributed to the input event, never to the layout change. |
| **X64-07** reduced-motion historical projection | immediately understandable; no ghost, no lost orientation | **PASS** — MO-H1 makes the reduced-motion case *identical* to the default case; orientation is carried by invariant loci. |
| **X64-08** screen-reader future leak, 100 later Moments **[re-run v2]** | nothing reveals them | **PASS** — §26; **navigator membership stops at the horizon** (AXT-02) and no metadata depends on undisclosed material (AXT-03); window navigation cannot cross the horizon (RE-10). |
| **X64-09** P3a modality parity **[re-run v2]** | same two act kinds, same settle/locus/`RH` | **PASS** — AXT-P1…AXT-P5, PT-01, **PT-02's two cancellation models** — parity holds under both discrete activation and continuous Preview, and no down-event commits irreversibly. |
| **X64-10** mobile return semantics | **PASS — premise unchanged** | RC-02, RC-P1, §28. Re-evaluated per the ruling: responsive control placement does not change return reachability, since every return act remains reachable in the recomposed chrome and none is gesture-only (PT-01). |
| **REV64-AT-01** disclosed long-session reach *(new fixture)* — 10,000 Moments disclosed, `TC = m9000`, window near `m9000`, target `m500` | window moves efficiently toward the distant disclosed region; `TC`/`TM`/`PTC`/`RH` unchanged; `m500` brought into the interactive window; then selected under the frozen grammar; **no coarse temporal step created** | **PASS** — see §32.1. |

---

## 32.1 REV64-AT-01 — worked trace

**State.** 10,000 Moments legitimately disclosed · `TC = m9000` · `TM = PINNED(9000)` · the Timeline window currently shows material around `m9000` · target `m500`.

**Step 1 — move the presentation window.** The user invokes **window navigation** (RE-ζ): repeated screenful/scroll movements carry the viewport backward through disclosed material. **Nothing temporal happens:** `TM` stays `PINNED(9000)`, `TC` stays `m9000`, no `PTC` is created, no Moment is chosen, and no `RH` entry is written (RE-09). The number of window movements is proportional to *screenfuls*, not to Moments — which is what makes 8,500 Moments of distance tractable.

**Step 2 — the horizon is respected throughout.** Every Moment traversed by the window is already inside the disclosure horizon (`m0…m9000`). The window cannot be moved past `TC` into undisclosed structure (RE-10), so nothing about `m9001…m10000` becomes visible, focusable, countable, or inferable at any point.

**Step 3 — bring `m500` into the interactive window.** It is now among the addressable disclosed targets of the navigator (AXT-02), reachable by ordinary focus movement in any modality.

**Step 4 — select under the frozen grammar.** The user Previews and commits `Commit(Moment(m500)) → PINNED(m500)` — **one** ordinary temporal act, **one** `RH` transaction. Alternatively they invoke the Temporal+Locate act; the locus outcome follows the frozen settle-time rules unchanged.

**PASS criteria, checked one by one.**
1. *Window moves efficiently toward the distant disclosed region* — yes, by screenful, in every modality including non-pointer (RE-12).
2. *Without changing `TC`, `TM`, `PTC` or `RH`* — yes, by RE-09; the "mutates" and "writes `RH`" rows of §20 record it explicitly.
3. *`m500` brought into the interactive window* — yes.
4. *Then explicitly selected/Previewed/committed using the frozen temporal grammar* — yes, unchanged.
5. *No coarse temporal semantic step created* — yes: the quantity moved is presentation, no temporal unit is named or selectable, and the cursor never advanced by more than one Moment at any point.

**What this test would have shown against v1:** FAIL on criterion 1 — v1 offered only one-Moment traversal at a capped rate, which is 8,500 repetitions. That is the defect REV-64-01 identified.

---

# 33. Board A — Motion + Interruption

`boards/S6.4_A_Motion_and_Interruption.png` — Experience proof scaffolding, **not art direction**.

**Updated in v2 for the IN-10 split.** Proves: motion optionality with each row's non-motion carrier named; the zero-motion parity strip; the historical projection transition resolving immediately with the ghost and cross-fade variants shown **rejected**; camera interruption retargeting to one destination; `Back` during motion reversing the transaction; Preview cancellation; the distinction between a newly committed lifecycle change and rendering a historical projection; IF divergence onset; and the Interruption Matrix now carrying **IN-10A / IN-10B / IN-10C** — recomposition alone preserves Preview, and only an input-stream cancellation cancels it.

---

# 34. Board B — Accessibility + Responsive Reach

`boards/S6.4_B_Accessibility_and_Reach.png` — Experience proof scaffolding, **not art direction**.

**Rebuilt for v2.** Proves: the chosen **disclosed-region target navigator** against the rejected families, stated platform-neutrally; the `PINNED` future firewall with what each state may and may not announce; Live versus latest by intent; the two P3a acts; **the two reach axes side by side** — temporal traversal (one Moment, rate-not-unit) and presentation-only window navigation — with the **REV64-AT-01** trace from `m9000` to `m500`; the horizon boundary that stops the window; pointer/touch/non-pointer parity per act under both cancellation models; and the responsive table with the **recomposition-preserves-Preview** rule.

---

# 35. MUST

1. Semantic state MUST commit independently of presentation progress (MO-01).
2. Every motion cue MUST name its non-motion carrier (MO-02).
3. Every distinction MUST survive `motion = 0` (MO-R1, MO-R2).
4. Historical projection changes MUST resolve immediately (MO-H1).
5. Lifecycle motion MUST be confined to newly committed changes and to the object's own boundary constitution (MO-L1, MO-L2).
6. Accessible topology MUST be derived from epistemic compatibility before ergonomics (EG-64-04, §14).
7. The navigator's membership MUST never extend past the disclosure horizon (AXT-02).
8. The Live target and the disclosed-region navigator MUST be separate and separately nameable (AXT-05).
9. Both P3a acts MUST be available and distinguishable before invocation in every modality (AXT-06, AXT-P1).
10. The traversal unit MUST remain one Moment; acceleration MUST be duration-driven (RE-01, RE-02).
11. Every act MUST have a single-pointer, non-dragging, non-gesture route (PT-01).
12. Canonical Map geography MUST be invariant under re-composition (RC-01).
13. Interruption MUST retarget presentation without altering transactions (IN-01…IN-12).
14. **Long-session reach MUST provide both axes** — temporal traversal *and* presentation window navigation — in every modality (RE-00, RE-12).
15. **Window navigation MUST remain presentation-only** and MUST stop at the disclosure horizon (RE-09, RE-10).
16. **Responsive recomposition alone MUST preserve an active Preview**; only a genuine input-stream cancellation may cancel it (RC-P3, RC-P3a, IN-10A/B).

# 36. MUST NOT

1. MUST NOT let animation progress determine commit, `RH`, `TM`, `TC`, `IF_ref`, camera authority, locate entitlement, Preview ownership, P5 binding, or `Back` (MO-01).
2. MUST NOT carry any distinction in motion alone (MO-02).
3. MUST NOT fade, ghost, or cross-fade across a projection change (MO-H2, MO-H3).
4. MUST NOT persist a connector past entitlement, or drift the camera to smooth a change (MO-H4, MO-H5).
5. MUST NOT replay unavailable lifecycle history into an earlier `TC` (MO-L3).
6. MUST NOT depict the unavailable requested reference, or morph toward it (MO-I2, MO-I3).
7. MUST NOT animate a true no-op (§5 row 18, IN-12).
8. MUST NOT expose any quantity or membership metadata **whose value depends on undisclosed or future material**, in any state (AXT-03, §26).
9. MUST NOT choose a platform role because it is conventional, nor freeze one here; **the navigator is not canonically a range, listbox, grid or tree** (EG-64-04, AXT-02, AXT-09).
10. MUST NOT introduce a named or selectable **temporal** unit larger than one Moment (RE-01), nor accelerate as a function of distance remaining (RE-02).
10a. MUST NOT let window navigation mutate `TM`, `TM`'s mode, `TC`, or `PTC`, choose a Moment, write `RH`, or cross the disclosure horizon (RE-09, RE-10).
10b. MUST NOT let responsive layout cancel or commit Preview (RC-P3, IN-10A).
10c. MUST NOT let a down-event create an irreversible semantic commit in any input model (PT-02).
10d. MUST NOT pause, defer or rewind **authoritative** Live state in the name of presentation control (MO-06).
11. MUST NOT make any act reachable only by hover, modifier, long-press, drag, or path gesture (PT-01, PT-03).
12. MUST NOT re-layout Map geography, re-anchor the world, or refit content to a new viewport shape (RC-01, RC-P6).
13. MUST NOT create an `RH` entry, a hidden commit, or an acknowledgement from any interruption or cancellation (IN-12).

# 37. SHOULD / MAY

- **SHOULD** keep motion short enough that no act ever feels gated on it, since none is.
- **SHOULD** make Preview's structural distinction from committed state visible without relying on an in-progress animation.
- **MAY** provide accelerators — drag, gesture, modifier, long-press — **in addition to** the primary route (PT-01, AXT-P2).
- **MAY** apply a uniform, content-independent settling to the surface on projection arrival, provided it asserts nothing about what changed and is absent under reduced motion (MO-H6).
- **MAY** choose final durations, easings, choreography, and the visual treatment of every cue later; none is frozen here (MO-08).
- **MAY** decide platform role mappings in 6.5 against the platform-neutral semantics frozen here (AXT-09) — **including a bounded-range mapping for the navigator, but only if 6.5 first proves its required metadata compatible** (AXT-02, REV-64-03).
- **MAY** choose the presentation amount for window navigation — viewport span, screenful, scroll, or another platform-neutral movement — provided it carries no temporal meaning (RE-09).
- **MAY** expose information derived **solely from already-disclosed material** where a platform mapping needs it; Stage 6.4 does not prohibit quantity as such, only quantity that depends on undisclosed material (AXT-03).

---

# 38. Implementation-readiness outputs for Stage 6.5

1. **Boundary table** — for every act in §5, the authoritative semantic boundary, asserted as a test: the same act at 0 ms, short and long motion yields identical `TM/TC/IF_ref/MC/RH` (X64-01).
2. **No-frame-checkpoint assertion** — interrupting at any percentage produces no additional `RH` entry and no partial state (X64-02).
3. **Projection-change rendering contract** — immediate resolution; explicit assertions that no frame contains material illegitimate in the new `K(TC)` and that no two versions are ever simultaneously rendered as current.
4. **Accessible topology mapping** — platform mappings for the three affordances, with the constraint that the navigator's **membership** is computed from the **disclosure horizon** and never from `LH` while `PINNED`; an assertion that **no metadata whose value depends on undisclosed material** is emitted in any state; and, if a bounded-range mapping is proposed, a **metadata-compatibility proof before adoption** (REV-64-03).
4a. **Window-navigation contract** *(new)* — a presentation-only viewport movement with assertions that it mutates no `TM`/`TC`/`PTC`, chooses no Moment, writes no `RH`, defines no temporal unit, and **cannot move the window past the disclosure horizon**; plus non-pointer operability (RE-09, RE-10, RE-12).
5. **Acceleration function contract** — input duration → repeat rate, bounded, with an explicit assertion that **no remaining-count input exists in the Experience path** (AF-01 keeps runtime knowledge unaffected).
5a. **Presentation-vs-authority separation** *(new)* — an assertion that any pause/stop/hide of automatically updating presentation leaves `LH`, committed events, ingestion and analysis advancing, and that resuming resolves to current truth without replaying intermediate states (MO-06).
6. **Windowed-focus hazard** — a named acceptance criterion drawn from documented virtualisation failures: holding the forward action while the window advances must not lose focus, drop the active target, or stall traversal (S8).
7. **Pointer/touch criteria** — non-dragging equivalent for every drag route; up-event activation with abort-on-leave; target size and spacing requirements; gesture separability between temporal and spatial acts.
8. **Responsive preservation criteria** — state, focus, `RH`, camera-viewport mapping across breakpoint and rotation, with **IN-10A/IN-10B** as the test: recomposition alone **preserves** `PTC` and its target; only an input-stream termination cancels it, and the cancellation must be attributable to the input event in the implementation, not to the layout change.
9. **Negative-scaffolding criteria** — no coarse-step construct, no aggregation construct, no acknowledgement mechanism, no persistent lifecycle trace, nothing reserved for OPEN-06/08/09/19.
10. **Fixture set** — MA-01…09, AX4-01…08, RP-01…04, X64-01…05, **X64-06A/B**, X64-07…10, and **REV64-AT-01**; **AX4-01, AX4-02, X64-03, X64-04 and X64-08 are rejection fixtures**; **AX4-06 and REV64-AT-01 are practicality fixtures** whose failure is an Architecture escalation, not a bug.

---

# 39. Remaining presentation / polish details

Deliberately open, none semantically load-bearing: all durations, easings, curves and choreography; the visual treatment of Preview's structural distinction; the specific acceleration curve and its bounds; the visual and textual form of every announcement; control placement at each breakpoint; and the exact target sizes and spacing values. All are constrained by §35/§36; none may reintroduce a timing dependency, a quantity, a ghost, or a coarser unit.

**Explicitly handed to 6.5:** platform role mappings (AXT-09) and every acceptance criterion in §38.

---

# 40. Architecture Review Handoff

## Stop-Rule check — all thirteen triggers tested, none fired

| Trigger | Status |
|---|---|
| Animation timing as commit/state authority | **Not required.** MO-01; §5 names a frozen boundary per act. |
| Motion as sole semantic carrier | **Not required.** M4-A empty (§6). |
| Future ghosting during historical transition | **Not required.** MO-H1/MO-H2 — immediate resolution. |
| Simultaneous-current version overlap | **Not required.** MO-H3. |
| Historical replay of unavailable lifecycle state | **Not required.** MO-L3. |
| Future Moment enumeration | **Not required.** AXT-03, AXT-09. |
| Full-session `PINNED` range metadata leak | **Not required.** AXT-02 — bounds end at the horizon. |
| A semantic coarse temporal step | **Not required.** RE-01/RE-02 keep the unit at one Moment; the new mechanism (RE-ζ) moves the **viewport**, mutates no temporal state, and defines no temporal unit (RE-09, §20's "is it a temporal act?" row). |
| Future enumeration to make reach practical | **Not required.** RE-10 stops window navigation at the horizon; AXT-02/AXT-03 keep membership and metadata disclosed-only. |
| Responsive layout itself cancelling or committing Preview | **Not required.** RC-P3 preserves Preview; only an input-stream cancellation cancels it (RC-P3a, IN-10A/B). |
| A platform role whose required metadata leaks undisclosed material | **Not required.** AXT-02 is platform-neutral; a range mapping needs a 6.5 compatibility proof first. |
| Hidden third temporal mode | **Not required.** AXT-10. |
| Modifier/hover-only P3a route | **Not required.** PT-01, AXT-P2. |
| Responsive Map relayout | **Not required.** RC-01, RC-P6. |
| New `RH` semantics | **Not required.** §25 — no interruption writes anything. |
| Changing Stage 6.2 / 6.3 frozen meaning | **Not touched.** §4 register. |

**All obligations are met within frozen semantics. No new semantic rule was invented.**

## What changed in v2, and what did not

Two load-bearing corrections and four narrowings. **The reach grammar gained a second axis**; the accessible topology was **narrowed** from a bounded range to a platform-neutral target navigator; the responsive Preview rule became **singular**; and three standards attributions were tightened (SC 2.5.7, SC 2.2.2, SC 2.5.2). Everything in A64-01…A64-06 is carried forward verbatim.

**Note the direction of both corrections: each *removes* an over-claim.** v1 claimed more for acceleration than it can bear, and more for the bounded-range framing than the product needs. Neither correction added product surface — the second reach axis was already frozen in Stage 6.2 and had simply gone unused.

## What Architecture should scrutinise first *(v2)*

1. **§21's corrected AX4-06 argument and §32.1's REV64-AT-01 trace** — specifically the claim that RE-ζ is not OPEN-08 because it moves a quantity of *presentation* rather than a quantity of *time*. That distinction carries the whole correction; if it does not hold, the reach question genuinely reopens.
2. **RE-10 — the horizon boundary on window navigation.** It is what stops the new mechanism from becoming a disclosure route. Worth confirming the wording forecloses every leap, including any "scroll to end" affordance.
3. **AXT-02 / AXT-03 as narrowed (§16)** — the navigator is a *target navigator*, and the prohibition is on metadata **dependent on undisclosed material** rather than on quantity as such.
4. **RC-P3 / RC-P3a and IN-10A/B (§24, §25)** — the deterministic split between recomposition and input cancellation, and whether "input-stream termination" is defined tightly enough to be implementable.
5. **Unchanged but still load-bearing:** M4-A empty (§6) and immediate historical resolution (§9). If either is judged wrong, large parts of the motion contract move with it.

## Stop rule

**Stage 6.4 is not declared frozen, complete, or approved by this package.** The Architecture Ruling was applied exactly and only in its ruled areas; the Stop-Rule check in §0 ran before applying and found no conflict. No frozen Stage 0–5 / 6.1 / 6.2 / 6.3 semantics were reopened; OPEN-06, 08, 09 and 19 were not revived; no platform role was frozen; no repository file was touched; no code was written. The contracts are returned for final Architecture review.

---

**END — QANDEEL_STAGE6_4_MOTION_A11Y_RESPONSIVE_CANDIDATE_v2**
