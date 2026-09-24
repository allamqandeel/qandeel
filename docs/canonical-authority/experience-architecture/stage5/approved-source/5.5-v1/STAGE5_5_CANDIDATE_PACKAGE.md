# QANDEEL — Stage 5.5 Candidate Package v1
## Temporal Orientation + Return + Edge-Case Integration

**Status:** CANDIDATE v1 — for Product / Experience / Architecture review. **Not complete. Not frozen.**
**Date:** 2026-09-03
**Authority:** `QANDEEL_STAGE5_5_EXECUTION_AUTHORIZATION.md` (Pre-Flight approved with one canonical correction; D1–D6 binding as rulings to be proven), over the frozen checkpoint (Stages 0–4) and frozen Stages 5.1, 5.2, 5.3, 5.4 — including **Stage 5.4 Freeze Addendum A-03**.
**Scope discipline:** no repository change, no code, no Replay, no final motion or styling, no new temporal mode, no new primitive, no resolution of deferred OPEN items.

Proposed rules are labelled **`G-nn`** (integration rules). Findings are **`F-nn`**. Binding tests are **AT-01…AT-36**; the sixteen additional required attacks are **Y-01…Y-16**.

---

## Decision index — the load-bearing integration rules

| # | Rule | Why it is load-bearing | § |
|---|------|------------------------|---|
| **1** | **Effective change is defined over the restorable tuple only** — `⟨TM, TC, IF_ref, MC.region, MC.depth⟩`. Derived re-resolution of `IF_render` or `K(TC)` is **not** change. | Without this, every live commit while pinned would look like a state change and D3 would be undecidable. It is the single definition that makes D3, D5 and the whole `RH` model deterministic. | §7.2, `G-20` |
| **2** | **Mode is part of the tuple, so `PINNED(LH) → FOLLOW_LIVE` is an effective change** even at identical coordinates. | Keeps D3 from silently erasing a real mode transition and preserves Stage 5.2's target-kind principle. | §10, `F-03` |
| **3** | **D1 binds the referent at activation; Stage 5.2 P3 evaluates reachability at settle.** These answer different questions and do not conflict. | The apparent tension between the two frozen/ruled behaviours is the most likely place a reviewer would call a contradiction. It is not one. | §8, `F-08` |
| **4** | **A committed action during Preview performs two separable things** — cancel (no `RH`) and execute (its own `RH`). One user act, one entry. | Prevents D2 from being read as either "preview commits" or "the cancel is itself an act". | §9, `F-05` |
| **5** | **D4's boundary is derived, not stipulated**: P3a is atomic *because* one act resolves a unique locate; where ambiguity requires a human choice, the choice is a new act by definition. | Shows D4 does not reopen Stage 5.2 atomicity — it states atomicity's precondition. | §11, `F-06` |
| **6** | **D1 + D5 together make it impossible for any return action to become a follow.** One-shot binding plus a preserved pre-act checkpoint means Live can never capture a historical user. | This is the composite guarantee the whole stage exists to produce. | §12, `F-04` |
| **7** | **The corrected spatial invariant**: projection changes never recompute canonical *spatial commitments*; non-anchored objects are **disclosed within contexts**, not positioned. "Renders elsewhere" always means "disclosed in another legitimate context". | Replaces the over-broad `pos(e)=f(e)` and changes how §17 cross-context and §13 Case B must be stated. | §1.2, `G-02` |
| **8** | **`IF_ref` is a reference; the Map renders projection truth.** They may legitimately disagree, and the disagreement must not be readable as a silent rebind. | The subtlest failure in the stage (Y-16): correct behaviour that *looks* like a violation. | §13, `F-07`, OPEN-18 |

---

## 1. Pre-Flight compliance + canonical correction acknowledgment

### 1.1 Compliance

Stages 0–4 and 5.1–5.4 are binding and unreopened. This package introduces **no new primitive, no new temporal mode, and no member of `S`**. Deferred OPEN items (02, 06, 08, 09, 10, 12, 13, 14, 15, 16, 17) are untouched, and no OPEN has been created to avoid proving D1–D6. D1–D6 are treated as **binding rulings to be proven adversarially**, not re-decided.

### 1.2 Canonical correction — accepted and applied

My Stage 5.4 Pre-Flight and package used **`pos(e) = f(e)`** as a universal invariant. That formulation was over-broad: it implied every canonical object owns an independent world-space coordinate, which is false. It is withdrawn and is **not** carried into Stage 5.5. The binding invariant, per **Stage 5.4 Freeze Addendum A-03**, is:

> **Projection changes never recompute canonical spatial commitments.**

`G-01.` For an Established Thread or another upstream-authorized permanent spatial commitment (the exceptional Cross-Thread Shared Anchor): `Home(e) := AssignAtEstablishment(e, then-legitimate world context)`, and once established, `Home(e, t ≥ establishment) = constant`.

`G-02.` **Not every canonical object owns a world coordinate.** Readings, Memories, Events, Relations, Evidence participations, Confidence states, Questions and ordinary contextual appearances do **not** acquire independent Home loci merely by being resolvable. Their "where" is **contextual disclosure**: they are disclosed *within* a context whose containing entity holds the spatial commitment, at an entitled semantic depth.

`G-03.` Consequently, throughout this package **"renders elsewhere" means "is disclosed within another legitimate context"**, never "sits at another coordinate". This is not cosmetic: it is what makes D6 Case B (§13) and cross-context navigation (§17) statable without implying that a Memory or Reading has a position of its own that could be recomputed.

All other Pre-Flight understanding was accepted and is carried forward unchanged.

### 1.3 Contradiction report

**No contradiction found.** Each of D1–D6 was tested against the frozen contract it most nearly touches (§8–§13). Two apparent tensions were examined and shown to be non-contradictions — D1 versus Stage 5.2's settle-time P3 evaluation (`F-08`), and D3/D4 versus Stage 5.2 `RH` atomicity (`F-06`, §10.1). No STOP condition arose.

---

## 2. Research synthesis

Targeted research only. Sources are primary (W3C normative, MDN reference, vendor framework reference). **No system's UI or implementation architecture is imported**; each source contributes a transferable principle whose QANDEEL consequence is derived from the frozen contracts. **Unreachable sources:** none newly attempted; those declared unreachable in Stages 5.2–5.3 remain unused.

### 2.1 A command binds its target when it is invoked — MDN, `setPointerCapture` / pointer capture

- **Reusable principle.** Capture designates an element "as the capture target of future pointer events"; thereafter "subsequent events for the pointer will be targeted at the capture element until capture is released" — **regardless of what is actually under the pointer**. The binding is made at the start of the interaction and deliberately survives the world moving underneath it.
- **QANDEEL implication.** This is the exact shape of **D1**. *Return to Live Focus* captures `LF*` at activation and continues to mean `LF*` even if `LF` becomes something else before settle. The transferable insight is that this is the *normal* discipline for a one-shot command over a moving referent, not a special case — and that the alternative (re-resolving the referent continuously) is precisely how a command turns into a follow.
- **Pattern not to copy.** Capture *duration* semantics — pointer capture persists until an explicit release, whereas QANDEEL's entitlement is strictly one-shot and expires at settle. QANDEEL must not acquire a "held" spatial capture.

### 2.2 A transient interaction is cancelled, not completed, when something authoritative takes over — MDN, `pointercancel`

- **Reusable principle.** The browser fires `pointercancel` when it "determines that there are unlikely to be any more pointer events, or if after the `pointerdown` event is fired, the pointer is then used to manipulate the viewport by panning, zooming, or scrolling." The application "should treat `pointercancel` as a signal to abort the current interaction … and **not treat it as a completed action**."
- **QANDEEL implication.** This is **D2**. A committed return or navigation action is the authoritative takeover; the transient Preview is *cancelled*, never completed and never converted into a commit. The phrase "not a completed action" is the precise reading of FORBIDDEN-15: cancel is not a quiet commit.
- **Pattern not to copy.** The *implicit* cancellation trigger. In QANDEEL the takeover is always an explicit user act, never a system heuristic such as palm rejection — the system never decides on the user's behalf that an intent was accidental.

### 2.3 Not every state update deserves a history entry — MDN, `History.replaceState`

- **Reusable principle.** `pushState()` creates a new history entry while `replaceState()` "modifies the current history entry"; the guidance is to replace rather than push when "refining or correcting the current state without wanting users to navigate back through intermediate states".
- **QANDEEL implication.** This is the platform precedent for **D3**. History is a record of *where the user has meaningfully been*, not of *what they invoked*. A command that leaves the restorable tuple unchanged has nothing to return to, so writing an entry would create churn and, on repetition, a loop. It also supplies the shape of the rule: the decision is made against the resulting state, not against the act's name.
- **Pattern not to copy.** `replaceState`'s *replacement* behaviour. QANDEEL's answer to a no-op is **no entry at all**, not a rewritten entry — rewriting a prior checkpoint would corrupt Exact Return, which is frozen.

### 2.4 Compound commands undo as one; the stack records commands, not effects — Qt Undo Framework

- **Reusable principle.** Each command "knows how to undo its changes to bring the document back to its previous state"; a macro is "a sequence of commands, all of which are undone or redone in one step"; compression exists "to compress sequences of commands into a single command" so the undo experience matches user intent rather than internal granularity.
- **QANDEEL implication.** Confirms Stage 5.2's frozen atomicity from an independent direction and gives **D4** its vocabulary: a macro is atomic when the composite genuinely *is* one act. Where a composite cannot complete without a human decision, the decision is not part of the macro — it is the next command. That is the derivation behind `F-06`.
- **Pattern not to copy.** Command *compression* (merging adjacent similar commands). QANDEEL must never merge two explicit user acts into one `RH` entry — Exact Return depends on each captured viewpoint remaining individually restorable, and compression would silently delete reachable checkpoints.

### 2.5 Cancellation is signalled to an operation already in flight — MDN, `AbortController` / `AbortSignal`

- **Reusable principle.** The signal is "passed to the asynchronous operation when it begins", and aborting "aborts an asynchronous operation before it has completed", so the result is never consumed.
- **QANDEEL implication.** Supplies the discipline for the settle-window races (AT-22, AT-23, Y-14): an action that is in flight when the world changes must resolve against **what it captured**, and a cancelled action must produce **no** partial effect — no half-applied camera move, no orphan `RH` entry. It also justifies stating settle behaviour as a *correctness* requirement without specifying scheduling, which the authorization forbids.
- **Pattern not to copy.** Promise/async plumbing and any implication about implementation timing or scheduling; only the "captured at start, no partial result" discipline transfers.

### 2.6 Context changes only on request — W3C WCAG 2.2, Understanding SC 3.2.5 Change on Request

- **Reusable principle.** "Changes of context are initiated only by user request or a mechanism is available to turn off such changes." The intent is to "eliminate potential confusion that may be caused by unexpected changes of context", and something "cannot be regarded as user-initiated if it happens without the user explicitly requesting it."
- **QANDEEL implication.** This is the accessibility-normative statement of FORBIDDEN-01, FORBIDDEN-05 and FORBIDDEN-06 together. Live advancing while the user is historical is a change of *content*, never of *context*: it may not move `TC`, `MC`, `IF_ref` or `RH`. Equally, a temporal return may not move the camera and a spatial return may not move time — each would be an unrequested context change riding on a requested one.
- **Pattern not to copy.** The "or a mechanism is available to turn off such changes" escape clause. QANDEEL has no opt-out here: unrequested temporal or spatial context change is forbidden outright, not merely defeasible.

### 2.7 Synthesis

| Principle | Where it lands |
|-----------|----------------|
| A one-shot command binds its referent at invocation | **D1** · `G-22`…`G-24` |
| Authoritative takeover cancels a transient interaction; cancel ≠ complete | **D2** · `G-25`…`G-27` |
| History records meaningful positions, not invocations | **D3** · `G-28`…`G-30` |
| A macro is atomic only when it genuinely is one act; never merge two acts | **D4** · `G-31`…`G-33` |
| Captured-at-start, no partial result on cancel | §6 precedence · AT-22/23 · Y-14 |
| Context changes only on explicit request | FORBIDDEN-01/05/06 · §15 · §16 |

---

## 3. Five-axis orientation model

Orientation means the user can answer the question on each axis **without any axis silently answering for another**. Divergence across axes is the normal case in Stage 5.5, not an exception.

| Axis | Question | Components | Bounded by |
|------|----------|------------|------------|
| **T — Temporal** | *When am I?* | `TM`; `TC`; target kind of the last commit (`Moment(m)` vs `LIVE_EDGE`); whether a transient Preview is active | Stage 5.1 modes; Stage 5.2 target kinds and Model C |
| **S — Spatial** | *Where am I looking?* | `MC.region`; `MC.depth` | Stage 4 camera/depth; Stage 5.4 spatial-commitment invariant (`G-01`/`G-02`) |
| **I — Inspection** | *What am I examining?* | `IF_ref = (identity, appearance, version)`; `IF_render` | Stage 5.4 `IF_ref`/`IF_render` split |
| **L — Live** | *Where is the conversation now?* | `LH`; `LF` — disclosed to a historical user only as "Live continued" + route back | Stage 5.3 Live-meta bound |
| **R — Return** | *What will each way back do?* | `RH` transaction stack; the six return actions' distinct authority | Stage 5.1 restoration normalisation; Stage 5.2 atomicity |

`G-04.` The five axes are **orthogonal**: no axis may be mutated as a side effect of an act whose authority lies on another axis. This is the single sentence from which most of §5's forbidden cells follow.

---

## 4. Integrated canonical state tuple

`G-05.` Define the **orientation reading**

```
Ω = ⟨ T, S, I, L, R ⟩
  T = (TM, TC, lastTargetKind, previewActive?)
  S = (MC.region, MC.depth)
  I = (IF_ref = ⟨identity, appearance, version⟩, IF_render)
  L = (LH, LF)                       — disclosed only within the Stage 5.3 Live-meta bound
  R = RH
```

`G-06.` **Ω adds nothing to canonical state.** It is a *reading* of the frozen `S = { LH, LF, TM, TC, K(TC), IF, MC, RH }`: `IF_ref`/`IF_render` are Stage 5.4's frozen decomposition of `IF`; `lastTargetKind` and `previewActive?` are Stage 5.2 concepts that are gesture-scoped or provenance and explicitly **not** members of `S` (`PTC ∉ S`). No member is added; no temporal mode is added.

`G-07.` **The restorable sub-tuple** — the components an `RH` entry must capture and a restoration must reproduce — is

```
Φ = ⟨ TM_provenance, TC, IF_ref, MC.region, MC.depth ⟩
```

with `TM_provenance` recorded but **non-restoring**: `RestoreTemporal(entry) := PINNED(entry.capturedTC)` always (Stage 5.1, frozen). `K(TC)`, `IF_render`, `LH` and `LF` are **derived or live** and are never captured as authority.

---

## 5. Action-authority matrix

Legend — **D** direct mutation by the act · **R** derived re-resolution caused by changed `K(TC)` (not a mutation by the act) · **C** conditional, only under an explicit entitlement and a legitimacy guard · **✘** forbidden mutation · **—** no effect.

| Action | `TM` | `TC` | `IF_ref` | `IF_render` | `MC.region` | depth | context appearance | `RH` | Preview / `PTC` | Live following |
|--------|------|------|----------|-------------|-------------|-------|--------------------|------|------------------|----------------|
| **Back One Step** | D → `PINNED(capturedTC)` | D | D (restores captured) | R | D | D | D (captured) | D — consumes one entry | D — cancels first (D2) | ✘ never establishes |
| **Return to Original Inspection** | D → `PINNED(capturedTC)` | D | D (exact captured ref) | R | D | D | D (captured) | D — per Stage 4 | D — cancels first | ✘ |
| **Return to Live Head** | D → `FOLLOW_LIVE` | D → `LH` | ✘ | R | ✘ | ✘ | ✘ | D — one entry unless no-op (D3/D5) | D — cancels first | D — establishes |
| **Return to Live Focus** | ✘ | ✘ | ✘ | — | C — iff `Locatable(LF*, K(TC))` | C — Stage 4 landing context | ✘ | D — one entry unless no-op | D — cancels first | ✘ one-shot, no follow |
| **Return to World** | ✘ | ✘ | ✘ | R (depth-withheld) | D | D → Z0 | ✘ | D — unless no-op | D — cancels first | ✘ |
| **Go Live + Locate** | D → `FOLLOW_LIVE` | D → `LH` | ✘ | R | C — iff `Locatable(LF, K(LH))` | C | ✘ | D — **one** transaction for the composite | D — cancels first | D |
| **Temporal `Moment(m)` commit** | D → `PINNED(m)` | D | ✘ | R | ✘ | ✘ | ✘ | D | D — gesture end | ✘ |
| **`LIVE_EDGE` commit** | D → `FOLLOW_LIVE` | D → `LH` | ✘ | R | ✘ | ✘ | ✘ | D | D — gesture end | D |
| **Direct spatial jump** | ✘ | ✘ | D — only if legitimate in `K(TC)`; else no landing | R | D | D | D | D | D — cancels first | ✘ |
| **Cross-context navigation** | ✘ | ✘ | D — *appearance only*; identity invariant | R | D | C | D | D | D — cancels first | ✘ |
| **Semantic Zoom** | ✘ | ✘ | — | R (withheld/revealed) | — | D | — | D | D — cancels (Stage 5.2 spatial input) | ✘ |
| **Pan** | ✘ | ✘ | — | — | D | — | — | D | D — cancels | ✘ |
| **Explicit contextual choice** (D4) | ✘ | ✘ | D — appearance | R | D | C | D | D — **separate** entry | — | ✘ |
| **Cancel Preview** | — | — | — | — | — | — | — | ✘ — never writes | D — discards `PTC` | — |

`G-08.` Every **R** cell is a consequence of `K(TC)` having changed, never an action mutating inspection. `G-09.` Every **✘** cell is a forbidden mutation, not merely an unused one — an implementation that produced it would violate a frozen contract or a D-ruling. `G-10.` Every **C** cell requires both an explicit entitlement and a legitimacy guard evaluated at settle.

---

## 6. Action-precedence matrix

| Condition | Rule | Authority |
|-----------|------|-----------|
| **Preview active + committed action** | Cancel Preview → discard `PTC` → **no `RH` for the Preview** → restore authoritative projection from committed `TM/TC` → execute the action from canonical committed state | **D2**, `G-25`…`G-27` |
| **Live commit arrives while user is historical** | `LH`/`LF` update truthfully; `TC`, `MC`, `IF_ref`, `RH` untouched; only Stage 5.3 Live meta is disclosed | FORBIDDEN-01/02; §15 |
| **Live commit arrives during Exact Return** | The captured return target is fixed at capture; restoration resolves to `PINNED(capturedTC)` regardless | Stage 5.1; §2.5 |
| **Live commit arrives during Return to Live Head** | The act establishes `FOLLOW_LIVE`; at settle effective `TC` is the authoritative current `LH`. No stale pin is created. **No implementation scheduling is specified.** | **D5**; AT-23 |
| **`LF` changes during Return to Live Focus** | The act targets captured `LF*`; it does not chase the new focus | **D1**, `G-22`…`G-24` |
| **Projection makes `IF` unavailable** | `IF_ref` retained exactly; `IF_render` unavailable; `MC` unmoved; no `RH` write from the projection change alone | **D6**, §13 |
| **Multi-locus locate at settle** | Temporal commit stands; no camera move; contextual choice surfaced; the later choice is a separate act | **D4**, §11 |
| **Effective no-op** | No `RH` entry; transient acknowledgement is not navigation state | **D3**, §10 |
| **Two conditions at once** | Preview cancellation (D2) is evaluated **first**, because every other rule is defined over *committed* state | `G-27` |

---

## 7. `RH` transaction model

### 7.1 Entry shape and restoration

`G-11.` An `RH` entry captures exactly `Φ` (§4): `capturedTC`; `capturedTM` as **provenance only**; `IF_ref` including its appearance and version components; `MC.region`; `MC.depth`.

`G-12.` `RestoreTemporal(entry) := PINNED(entry.capturedTC)` on **every** restoration path. `capturedTM` can never reattach `FOLLOW_LIVE` (Stage 5.1, frozen).

`G-13.` **Passive events never write `RH`:** a new Live commit; an `LF` update; re-resolution of `K(TC)` or `IF_render` caused by an already-committed `TC`; Preview movement; Preview cancellation.

`G-14.` **Explicit effective acts write exactly one entry**, under Stage 5.2 atomicity — composites included. `G-15.` **Entries are never merged, rewritten or compressed**; each captured viewpoint remains individually restorable (§2.4, pattern not to copy).

### 7.2 The definition that makes D3 decidable

`G-20.` **An act produces effective change iff it changes at least one component of `Φ`** — `TM`, `TC`, `IF_ref`, `MC.region`, `MC.depth`. Derived re-resolution of `K(TC)` or `IF_render`, and any change in `LH`/`LF`, are **not** effective change.

This is stated first because everything else depends on it. Without it, a live commit arriving while the user is pinned would re-resolve `IF_render` and thereby look like a state change, and D3 would be undecidable (`F-02`).

---

## 8. D1 — captured-`LF` target contract

`G-22.` On explicit invocation of **Return to Live Focus**: `LF* := LF_at_activation`. The act is a one-shot spatial intent targeting `LF*`.

`G-23.` At settle, locate **iff** `Locatable(LF*, K(TC))`. `TC` does not change. If `LF` changes from A to B during the act, the act does **not** chase B. If `LF*` is no longer locatable in the authoritative settled projection, **no camera move occurs**. No persistent or implicit follow is created. A later explicit invocation may target the then-current `LF`.

`G-24.` This ruling governs **Return to Live Focus only**. It does not redefine **Go Live + Locate**, whose temporal part first returns to authoritative Live and whose locate guard remains the frozen P5 evaluation against `K(LH)`.

**`F-08` — D1 and Stage 5.2's settle-time P3 evaluation do not conflict.** They answer different questions: D1 fixes *which referent the act means* (bound at activation); P3 fixes *whether the meant target is reachable* (evaluated at settle). A command may therefore have a fixed referent and a settle-time guard simultaneously — indeed it must, or it would either chase a moving target or act on a stale reachability result. This is the apparent tension most likely to be mistaken for a contradiction; it is not one.

---

## 9. D2 — Preview-precedence contract

`G-25.` When Preview is active and the user invokes any committed action — Back, Original Inspection, Return to Live Head, Return to Live Focus, Return to World, Go Live + Locate, or another committed temporal action — the sequence is: **(1)** cancel Preview; **(2)** discard `PTC`; **(3)** write **no** `RH` entry for the Preview; **(4)** restore the authoritative committed projection from `TM/TC`; **(5)** execute the explicit action under its own frozen semantics.

`G-26.` Preview has no authority to survive or alter a committed return. The action is evaluated **from canonical committed state**, never from transient `PTC`.

`G-27.` Preview cancellation is evaluated **before** every other precedence rule, because all other rules are defined over committed state.

**`F-05` — one user act, one entry.** A committed action during Preview performs two separable things: a cancellation, which is not an act and writes nothing, and the action, which writes its own entry under its own rules. Conflating them would either produce a phantom "cancel" entry or, worse, read the cancel as a commit — the FORBIDDEN-15 failure.

---

## 10. D3 — no-op history contract

`G-28.` **No effective state change → no `RH` transaction.** An explicit command that leaves `Φ` unchanged writes no entry and creates no duplicate step.

`G-29.` Worked cases: **Return to Live Head while already `FOLLOW_LIVE`** — no component of `Φ` changes, so no entry. **Return to World while already at World-equivalent camera and depth** — no entry. **Return to Live Focus when `MC` already equals the entitled locate result for `LF*`** — no entry.

`G-30.` A product **may** provide transient orientation acknowledgement; transient acknowledgement is **not** navigation state and is **not** `RH`. Repeated reaffirmation must not create a loop.

**`F-03` — mode counts.** `PINNED(LH) → Return to Live Head` **is** an effective change: `TM` differs even though `TC` is numerically identical. D3 is evaluated over `Φ`, never over coordinates. Deciding it on coordinates would silently erase a real mode transition and contradict Stage 5.2's principle that target kind controls intent at coincident coordinates.

### 10.1 D3 does not contradict Stage 5.2 atomicity

Atomicity states that one explicit act yields **at most one** reversible transaction; D3 states the **minimum** — none, when nothing restorable changed. An act with nothing to return to has no checkpoint to write. The two rules bound the same quantity from opposite sides and are jointly consistent.

---

## 11. D4 — contextual-choice transaction contract

`G-31.` When P3 settle finds `UniqueLocatable(x, K(TC)) = false` because more than one legitimate contextual locus exists: the temporal commit **remains valid**; **no arbitrary camera movement** occurs; the frozen Stage 4.3 contextual choice may be surfaced.

`G-32.` The user's later explicit context selection is a **new user-visible act** and creates its own `RH` transaction **if it changes effective state** (`G-20`). The normal chain is therefore: temporal act → entry; explicit context choice → separate entry. **Back reverses the context choice first.** A cancelled or unmade choice produces no camera move and no entry.

`G-33.` This does not reopen Stage 5.2 P3a atomicity.

**`F-06` — the boundary is derived, not stipulated.** P3a is atomic precisely *because* a single explicit act can legitimately resolve a unique locate. Where the projection is ambiguous, the act cannot complete on its own; the human decision that resolves it is, by definition, a further act. D4 therefore states P3a's **precondition** rather than amending its scope — the same conclusion Qt's macro/compression distinction reaches from the other direction (§2.4).

---

## 12. D5 — Return-to-Live history preservation

`G-34.` When **Return to Live Head** changes state: capture the full pre-act reversible checkpoint in `RH`; establish `FOLLOW_LIVE`; resolve effective `TC` to the authoritative `LH`; **do not erase the historical excursion checkpoint**.

`G-35.` Therefore `PINNED(60) → Return to Live Head → FOLLOW_LIVE@LH → Back` restores `PINNED(60)` **plus** the captured pre-act spatial and inspection viewpoint.

`G-36.` If Return to Live Head is an effective no-op, D3 applies and no entry is created. For **Go Live + Locate**, the whole explicit composite remains **one** `RH` transaction under Stage 5.2.

**`F-04` — the composite guarantee.** D1 (a one-shot command binds at activation and creates no follow) and D5 (returning Live preserves the excursion) together make it **impossible for any return action to become a follow, or for a historical excursion to become unreachable**. Live can advance freely; the user's way back is always exactly one Back away. This is the property the whole stage exists to produce.

---

## 13. D6 — `IF_ref` / `IF_render` integration

`G-37.` **Canonical invariant.** `IF_ref` remains exact unless the user performs an explicit inspection or navigation act that changes it. `IF_render` is re-resolved independently against `K(TC)`. **A projection change alone never replaces `IF_ref`.**

| Case | Condition | `IF_ref` | `IF_render` | Map | Chrome |
|------|-----------|----------|-------------|-----|--------|
| **A** | canonical identity unknown at `TC` | retained internally / in `RH` | unavailable | no future name, identity or locus | generic knowledge-safe orientation only |
| **B** | identity known, requested **appearance** unavailable | requested context retained | unavailable *for that appearance* | the canonical object may independently be **disclosed within another legitimate context** as part of the projection (`G-03`) — never a silent substitution of `IF_ref` | future context name/locus withheld |
| **C** | requested **version** known but noncurrent | remains that version/lineage reference | — | default projection renders the **then-current** version where entitled; **no silent rebind** | deliberate Source/Provenance inspection may expose the known noncurrent version where legitimate |
| **D** | temporally entitled but **depth-withheld** | remains valid | withheld at this depth | ordinary Stage 4 Semantic Zoom behaviour | **not** classified as temporal absence |

`G-38.` **`RH` and camera:** passive projection changes write no `RH`; explicit acts write only per their frozen transaction semantics; **projection unavailability alone never moves `MC`**.

`G-39.` Any generic orientation or return chrome obeys the frozen Stage 5.3 knowledge-gating and no-hindsight rules. Final wording and visual treatment are out of scope.

**`F-07` — correct behaviour that can look like a violation.** In Case C the Map legitimately renders `R1` while `IF_ref` still references `R2`. Nothing has been rebound, but a user — or a reviewer — could read the divergence as a silent substitution. The semantics are settled by D6; how the distinction is made *perceivable* needs visual evidence and is proposed as **OPEN-18**. Note carefully: OPEN-18 does not defer any part of D6; it defers only the legibility of a decided semantics.

---

## 14. Return-action distinction contract

`G-40.` The six actions remain distinct, with the authority given in §5. They are **never** collapsed into a generic back / home / reset / live behaviour.

| Action | Restores or changes | Explicitly does **not** |
|--------|--------------------|--------------------------|
| **Back One Step** | preceding `RH` transaction as `PINNED(capturedTC)` + exact captured viewpoint and reference | mean "go live" |
| **Return to Original Inspection** | the **named** checkpoint: `PINNED(capturedTC)`, exact `IF_ref`, exact context/lineage reference, exact camera, exact depth — **restores, never recomputes**; `IF_render` then obeys historical truth | recompute an "equivalent current state" |
| **Return to Live Head** | `FOLLOW_LIVE`, `TC = LH` | move the camera or change inspection directly |
| **Return to Live Focus** | one-shot spatial locate of `LF*` (D1) | change `TC` |
| **Return to World** | World-level orientation at the same `TM/TC/K` | change time |
| **Go Live + Locate** | temporal Live return **and** guarded `LF` locate under frozen P5 — **one** `RH` transaction | be two Back steps, or locate without the guard |

`G-41.` Two orthogonality rules keep the set honest: a **temporal** return never moves the camera; a **spatial** return never moves time. Only the explicit composite does both, as one reversible act.

---

## 15. Live-continuity-while-historical contract

`G-42.` While `PINNED(TC)`: `LH` may advance, `LF` may change, and current Live analytical truth may evolve — genuinely. Historical inspection never freezes the Live system.

`G-43.` `TC`, `MC`, `IF_ref` and `RH` remain under historical user control and are changed **only** by an explicit user act. Live evolution never hijacks historical inspection (FORBIDDEN-01/02; §2.6).

`G-44.` The historical user receives only the Stage-5.3-permitted Live meta: *Live has continued* and *a route back exists*. Historical chrome must not reveal future `LF` identity, future Thread identity, direction, locus, count, content, or future analytical state.

---

## 16. Temporal-commit-while-inspecting contract

`G-45.` A temporal commit **without locate intent**: changes temporal state; re-resolves `K(TC)`; re-resolves `IF_render`; **does not** directly move `MC`; **does not** change `IF_ref`; **does not** auto-locate the semantic locus of the selected Moment.

`G-46.` If `IF_ref` becomes unavailable under the new projection, **D6** applies — and only D6; no compensating camera move, substitution or chrome invention is permitted to make the view look occupied.

---

## 17. Cross-context historical integration

`G-47.` When a canonical object has multiple legitimate contextual appearances at the selected `TC`: there is **one canonical identity**; context navigation may change the inspected contextual appearance and the camera; `TC` remains unchanged; **no ownership is created and no relation is manufactured**; `RH` records the effective explicit navigation act.

`G-48.` If the requested target context is unavailable at `TC`: **no fabricated landing**; no future context name or locus; **no silent temporal jump**; no arbitrary substitution into a different context.

`G-49.` Per `G-02`/`G-03`, "the object is available in another context" means it is **disclosed within** that context — not that it holds a second coordinate. Cross-context navigation moves the camera to the *containing context's* spatial commitment and discloses the object there; it never relocates the object.

---

## 18. Sparse historical orientation state contract

`G-50.` If the exact historical state leaves the viewport sparse: preserve `MC`; preserve `TC`; preserve fixed canonical spatial commitments; **no auto-recenter, no auto-zoom, no placeholder rescue**. Back and Original Inspection remain exact.

`G-51.` Stage 5.5 freezes the **state semantics** only. The eventual visible orientation cue remains governed by **OPEN-16** and is not designed here.

---

## 19. Mobile / narrow integration

`G-52.` The same canonical state resolves identically on every projection: identity, knowledge, version, lifecycle state, context legitimacy, `TM/TC`, `IF_ref`, `RH` semantics and every return action's authority.

`G-53.` Narrow projections may disclose **less simultaneously**. They must not introduce device-specific temporal or return semantics, reflow canonical geography, alter spatial commitments, or expose anything the wide surface withholds. Accessibility parity from the frozen Stage 5.3 contract applies identically.

`G-54.` A mixed Back chain executes **identically** on narrow and wide surfaces — the same transactions in the same order restoring the same `Φ` (Y-13).

---

## 20. Adversarial findings

Verdict scale, permitting failure: **PASS** · **PASS-WITH-FINDING** (resolves, and surfaces something review must see) · **PASS-WITH-OPEN** (resolves; a declared OPEN affects the surface only) · **FAIL**.

### 20.1 Findings

- **`F-01` The corrected spatial invariant changes the argument's shape.** Camera and geography stability is a statement about *spatial commitments* and *contextual disclosure*, not about a universal position function. Everything in §13 Case B and §17 had to be restated accordingly; the over-broad `pos(e)=f(e)` is withdrawn.
- **`F-02` "Effective change" must be defined over restorable components only.** Otherwise a live commit arriving while pinned re-resolves `IF_render` and masquerades as a state change, making D3 undecidable and generating phantom transactions.
- **`F-03` Mode is part of the tuple.** `PINNED(LH) → FOLLOW_LIVE` is a real change at identical coordinates.
- **`F-04` D1 + D5 = no return action can become a follow, and no excursion can become unreachable.**
- **`F-05` A committed action during Preview does two separable things**; conflating them yields either a phantom entry or a silent commit.
- **`F-06` D4's boundary is derived from P3a's precondition**, so atomicity is stated, not amended.
- **`F-07` Case C is correct behaviour that can read as a violation** — `IF_ref = R2` while the Map shows `R1`. Semantics settled by D6; legibility proposed as OPEN-18.
- **`F-08` D1 (referent binding) and P3 (settle-time reachability) answer different questions** and are jointly necessary.
- **`F-09` No contradiction with any frozen contract was found** across all six rulings; the two apparent tensions are `F-06` and `F-08`, both resolved without amending anything upstream.

### 20.2 Binding acceptance tests AT-01…AT-36

| # | Attack | Behaviour under this contract | Verdict |
|---|--------|-------------------------------|---------|
| AT-01 | Live advances while pinned | `TC` stays 70; `IF_ref`/`MC` untouched; only Live meta discloses continuation; no `RH` write (`G-13`, `G-42`…`G-44`) | PASS |
| AT-02 | `LF` changes while historical | `TC`/`MC`/`IF_ref` unchanged; no future Ahmed locus unless legitimate in `K(70)` (`G-43`, `G-44`) | PASS |
| AT-03 | Back after Live advanced | `PINNED(100)` — restoration normalises; never `FOLLOW_LIVE@105` (`G-12`) | PASS |
| AT-04 | Original Inspection after Live advanced | `PINNED(100)`, exact `IF_ref = R1`, exact Work/Z3 camera and depth; `IF_render` re-resolved against `K(100)` (`G-11`, `G-40`) | PASS |
| AT-05 | Return to Live Head from historical Family inspection | `FOLLOW_LIVE`, `TC = 105`; camera **stays** Family/Z3 (`MC` is ✘ for this act); `IF_ref` unchanged (✘ column); projection updates to `K(105)`. The Pre-Flight's "may remain" is now determinate: `IF_ref` **remains** | PASS |
| AT-06 | Return to Live Focus locatable historically | `TC` stays 70; camera may locate the then-legitimate Work locus; no temporal change (`G-22`, `G-41`) | PASS |
| AT-07 | Return to Live Focus unavailable historically | No camera move, no B label/locus/direction, `TC` stays 40; explicit temporal act required first (`G-23`) | PASS |
| AT-08 | Go Live + Locate with established `LF` | `FOLLOW_LIVE`, `TC = 100`, locate Work; **one** transaction; one Back restores `PINNED(40)` (`G-36`, `G-40`) | PASS |
| AT-09 | Go Live + Locate with Emerging `LF` | Temporal part returns Live; guard fails, so **no fabricated camera location**; still one explicit act; Back restores pre-act viewpoint (`G-24`, `G-36`) | PASS |
| AT-10 | Back after composite Go Live + Locate | `PINNED(40)` + Family/Z2 restored; **no intermediate "Live but old camera" stop** (`G-14`, `G-36`) | PASS |
| AT-11 | Spatial input during Preview | Preview cancelled, `TC` stays 40, no `RH` for Preview, Pan executes as a Stage 4 act, disclosure reverts to committed `K(40)` (Stage 5.2 frozen + `G-25`) | PASS |
| AT-12 | Temporal commit while inspecting another Thread | `TC = 70`; `MC` stays Family; `IF_ref` preserved; `IF_render` re-resolved; **no auto-pan** to the Moment's semantic locus (`G-45`) | PASS |
| AT-13 | `IF` becomes unknown after backward commit | `IF_ref` preserved; `IF_render` absent; no future R2 name; generic chrome (`G-37` Case A) | PASS |
| AT-14 | `IF` context disappears, identity remains | Appearance absent; **no silent substitution**; canonical M may be disclosed within another legitimate context; `RH` preserves the requested context (`G-37` Case B, `G-49`) | PASS |
| AT-15 | `IF` version becomes noncurrent | Default projection renders then-current R1; `IF_ref` stays R2; no rebind; provenance may later retrieve R2 (`G-37` Case C) | PASS-WITH-OPEN (legibility — OPEN-18) |
| AT-16 | `IF` depth-withheld, not absent | `IF_ref` persists; object withheld by depth; **not** classified unavailable (`G-37` Case D) | PASS |
| AT-17 | Return to World while historical | `TC = 70` preserved, World/Z0, `K(70)` preserved, no Live return; `RH` records the spatial/depth act (`G-40`) | PASS |
| AT-18 | Cross-context same object while pinned | One identity; `TC` unchanged; appearance and camera change; one `RH` act; no relation or ownership (`G-47`, `G-49`) | PASS |
| AT-19 | Cross-context target unavailable historically | No fabricated landing, no future appearance or locus, `TC` unchanged, no silent jump to 80 (`G-48`) | PASS |
| AT-20 | Sparse historical camera + Back | Exact prior camera/depth checkpoints restored; no auto-recenter; each restored checkpoint carries its own correct `TC` (`G-50`, `G-11`) | PASS |
| AT-21 | Rapid temporal + spatial alternation | Preview never writes `RH`; committed acts do; Back restores the exact previous transaction; final `Φ` deterministic (`G-13`, `G-20`, `G-25`) | PASS |
| AT-22 | Live arrives during Exact Return | Restoration resolves to `PINNED(100)`; the captured target is fixed at capture; no race to `FOLLOW_LIVE` or 106 (§2.5, `G-12`) | PASS |
| AT-23 | Live arrives during Return to Live Head | Establishes `FOLLOW_LIVE`; effective `TC` is the authoritative current `LH` at settle; no stale `PINNED(105)`. Stated as settle-correctness; **no scheduling specified** | PASS |
| AT-24 | `LF` changes during Return to Live Focus | Targets captured `LF*` (D1); does not chase B; if `LF*` is unlocatable at settle, no camera move (`G-22`, `G-23`) | PASS |
| AT-25 | Context choice after multi-locus P3 | Temporal commit stands; no arbitrary camera move; choice surfaced as an explicit separate act; `RH` remains reversible (`G-31`, `G-32`) | PASS |
| AT-26 | Back from context-choice chain | Back reverses the **context choice** first, then the temporal commit — two entries by D4, without reopening P3a atomicity (`G-32`, `F-06`) | PASS |
| AT-27 | Historical Live meta + unavailable `LF` | Allowed: "Live continued", route back. Forbidden: `LF`/Thread name, direction, spatial hint, future count, content (`G-44`) | PASS |
| AT-28 | Mobile narrow historical divergence | Same canonical state and same return semantics; less simultaneous disclosure only (`G-52`, `G-53`) | PASS |
| AT-29 | Back through mixed temporal/spatial chain | Each Back reverses exactly one explicit transaction in reverse order; every restored checkpoint normalises to `PINNED(capturedTC)`; no Back means "go Live" (`G-12`, `G-14`) | PASS |
| AT-30 | Original Inspection target unavailable at `capturedTC` | Exact `capturedTC`, camera, depth and reference restored; Map stays truthful; `IF_render` may be unavailable; **no recompute or substitution to make the return look occupied** (`G-40`, `G-37`) | PASS |
| AT-31 | Return action while Preview active | D2 precedence: cancel → discard `PTC` → no Preview `RH` → restore committed projection → execute the action (`G-25`…`G-27`) | PASS |
| AT-32 | Direct jump then Back while historical | `TC` stays 60; Back restores the prior spatial/inspection checkpoint; no temporal drift (§5 row, `G-12`) | PASS |
| AT-33 | Return to Live Head does not erase inspection history | Pre-act checkpoint captured; Back returns to `PINNED(60)` with the captured viewpoint (`G-34`, `G-35`) | PASS |
| AT-34 | Repeated Return to Live Head | Already `FOLLOW_LIVE` ⇒ `Φ` unchanged ⇒ **no entry**, no loop. From `PINNED(LH)` it **is** a change (`F-03`) | PASS |
| AT-35 | Return to World when already World | `Φ` unchanged ⇒ no entry (`G-28`, `G-29`) | PASS |
| AT-36 | Return to Live Focus when already at the entitled result | `Φ` unchanged ⇒ no entry; transient acknowledgement is not `RH` (`G-29`, `G-30`) | PASS |

### 20.3 Additional required attacks Y-01…Y-16

| # | Attack | Response | Verdict |
|---|--------|----------|---------|
| Y-01 | Captured `LF*` changes before settle | Act targets `LF*`; does not chase (`G-22`) | PASS |
| Y-02 | Captured `LF*` becomes unlocatable before settle | No camera move; no fallback target; no substitution (`G-23`) | PASS |
| Y-03 | Repeated Return to Live Head no-op | No entry; no loop (`G-28`) | PASS |
| Y-04 | Repeated Return to World no-op | No entry (`G-28`) | PASS |
| Y-05 | Repeated Return to Live Focus no-op | No entry (`G-29`) | PASS |
| Y-06 | Preview active + Back | Cancel (no `RH`) → restore committed → Back consumes one entry (`G-25`, `F-05`) | PASS |
| Y-07 | Preview active + Original Inspection | Same precedence; the named checkpoint is restored from committed state, never from `PTC` (`G-26`) | PASS |
| Y-08 | Preview active + Return to Live Head | Same precedence; then `FOLLOW_LIVE`, one entry unless no-op | PASS |
| Y-09 | Multi-locus P3 → choice → Back → Back | First Back reverses the choice; second reverses the temporal commit (`G-32`) | PASS |
| Y-10 | Return Live → Live advances again → Back | Back restores the pre-act `PINNED(60)` checkpoint; later `LH` movement is irrelevant to a captured entry (`G-34`, `G-12`) | PASS |
| Y-11 | Unavailable `IF` + sparse camera + Live advancing at once | Three independent axes: `IF_render` unavailable, `MC` unmoved, Live meta only; none writes `RH`; none moves another axis (`G-04`, `G-13`, `G-38`, `G-50`) | PASS |
| Y-12 | Cross-context navigation while `IF` version is noncurrent | Appearance changes; version reference untouched; default projection still renders then-current; no rebind (`G-47`, `G-37` C) | PASS-WITH-OPEN (OPEN-18) |
| Y-13 | Mobile executes the same mixed Back chain | Identical transactions, order and restored `Φ` (`G-54`) | PASS |
| Y-14 | Exact Return while a new Live commit arrives | Captured target fixed; resolves `PINNED(capturedTC)`; no partial effect (§2.5) | PASS |
| Y-15 | No-op action erases or rewrites `RH` | Forbidden: entries are never merged, rewritten or compressed; a no-op writes nothing and **removes** nothing (`G-15`, `G-28`) | PASS |
| Y-16 | Default current version mistaken for silent `IF_ref` substitution | Nothing is rebound (`G-37` C); the divergence is correct. Perceivability is OPEN-18 — a legibility question, not a semantic gap (`F-07`) | PASS-WITH-OPEN |

### 20.4 Honest summary

Thirty-six binding tests and sixteen required attacks were evaluated on a scale that permits FAIL. **No FAIL was found.** Three results are **PASS-WITH-OPEN** — AT-15, Y-12 and Y-16 — all the same issue: D6 Case C's semantics are settled, but making the `IF_ref`-versus-rendered-version distinction *perceivable* needs visual evidence (OPEN-18). Two apparent contradictions were examined and dismissed with argument rather than assertion (`F-06`, `F-08`). **No D-ruling contradicted a frozen contract**, so no STOP arose.

---

## 21. Recommended Stage 5.5 contract

### MUST

1. `G-01`/`G-02` Reason in terms of **canonical spatial commitments and contextual disclosure**; never assume a universal entity-position function.
2. `G-04` Keep the five orientation axes orthogonal: no act mutates an axis outside its authority.
3. `G-05`…`G-07` Treat Ω as a reading of the frozen `S`; capture and restore exactly `Φ`.
4. `G-12` Normalise every restoration to `PINNED(capturedTC)`; `capturedTM` is provenance only.
5. `G-13` Write no `RH` for passive events — live commits, `LF` updates, projection re-resolution, Preview movement or cancellation.
6. `G-14`/`G-15` One explicit effective act = one entry; never merge, rewrite or compress entries.
7. `G-20` Define effective change over `Φ` only.
8. `G-22`…`G-24` Bind Return to Live Focus to `LF*` at activation; guard the locate at settle; create no follow.
9. `G-25`…`G-27` On a committed action during Preview: cancel, discard `PTC`, write no Preview entry, restore committed projection, then execute.
10. `G-28`…`G-30` Write no entry for an effective no-op; keep transient acknowledgement out of `RH`.
11. `G-31`…`G-33` Keep the multi-locus contextual choice a separate explicit transaction; Back reverses it first.
12. `G-34`…`G-36` Capture the pre-act checkpoint on an effective Return to Live Head; keep Go Live + Locate one transaction.
13. `G-37`…`G-39` Keep `IF_ref` exact and `IF_render` independently re-resolved across Cases A–D; move no camera and write no history from unavailability alone.
14. `G-40`/`G-41` Preserve the six distinct return actions and both orthogonality rules.
15. `G-42`…`G-44` Let Live evolve genuinely while historical, disclosed only within the Stage 5.3 Live-meta bound.
16. `G-45`/`G-46` Keep a temporal commit free of camera movement, `IF_ref` change and auto-locate.
17. `G-47`…`G-49` Preserve one identity across contexts; disclose within contexts; refuse fabricated landings.
18. `G-50`/`G-51` Preserve camera and commitments through sparse projections; freeze state semantics only.
19. `G-52`…`G-54` Keep canonical state, return semantics and Back chains device-invariant.

### MUST NOT

1. Introduce a new primitive, a member of `S`, or a third temporal mode.
2. Carry `pos(e) = f(e)` or any universal entity-position function into any reasoning.
3. Let a live commit or `LF` change move `TC`, `MC`, `IF_ref` or `RH`.
4. Let Back, or any restoration, establish `FOLLOW_LIVE`.
5. Let Original Inspection recompute an equivalent current state instead of restoring the captured one.
6. Let Return to Live Head move the camera, or Return to Live Focus / Return to World move time.
7. Let Return to Live Focus chase a changed `LF`, or create any persistent or implicit follow.
8. Let Preview survive, alter, or be committed by a committed action; or let a cancellation write history.
9. Write an `RH` entry for an act that leaves `Φ` unchanged; or merge, rewrite, compress or delete existing entries.
10. Decide no-op status on coordinates rather than on `Φ` (mode counts).
11. Move the camera arbitrarily when a locate resolves to zero or several loci.
12. Silently rebind `IF_ref` on projection change, substitute another context, or render an unavailable target to keep inspection occupied.
13. Move `MC` because a projection made something unavailable, or auto-recenter, auto-zoom or placeholder-rescue a sparse viewport.
14. Fabricate a landing, leak a future context name or locus, or perform a silent temporal jump when a requested context is unavailable at `TC`.
15. Create ownership or manufacture a relation through cross-context navigation, or change canonical identity.
16. Leak future `LF`/Thread identity, direction, locus, count, content or analytical state through historical chrome.
17. Introduce device-specific temporal or return semantics.
18. Freeze final motion, styling, wording, iconography or transition behaviour.

### SHOULD

1. Express settle behaviour as correctness conditions rather than scheduling.
2. Surface the multi-locus contextual choice rather than resolving ambiguity silently.
3. Keep `IF_ref` visible as a *reference* distinct from what the projection renders (subject to OPEN-18).
4. Prefer no chrome over invented chrome when a return lands on an unavailable target.

### MAY

1. Provide transient, non-`RH` orientation acknowledgement for effective no-ops (`G-30`).
2. Expose a known noncurrent version through deliberate Source/Provenance inspection where legitimate (`G-37` C).
3. Reduce simultaneous disclosure on narrow projections (`G-53`).

### OPEN

See §26. Two new Experience-level OPEN items are proposed; neither defers any part of D1–D6.

---

## 22. Proof Board A — Divergent Orientation + Exact Return Chain

`boards/S5.5_A_Divergent_Orientation_Return_Chain_CANDIDATE.png` (source `.html` alongside).

One scenario in which all five axes diverge — Live has moved, `TC` is pinned historically, the camera sits elsewhere at another depth, `IF_ref` is preserved while `IF_render` is unavailable or noncurrent, and `RH` holds a mixed temporal / spatial / context chain. The board prints an explicit **Ω state tuple and transaction id at every step**, so the chain is inspectable rather than merely illustrated: twelve steps `T0…T11` covering the excursion, a passive live commit that writes nothing, a multi-locus choice, and then the return actions — Back chain, Original Inspection, Return to Live Head, Return to Live Focus, Return to World — plus two no-op invocations that produce no entry.

Scaffolding only. Nothing visual is proposed.

## 23. Proof Board B — Integration Adversarial Stress

`boards/S5.5_B_Integration_Adversarial_Stress_CANDIDATE.png` (source `.html` alongside).

Sixteen cells, Y-01…Y-16, each pairing the forbidden outcome (✘) with the contract's outcome (✔) as before/after Ω tuples: the D1 `LF` race, D2 preview precedence in three forms, D3 no-op loops in three forms, D4's choice boundary and its Back order, D5's preserved excursion, D6's unavailable and noncurrent cases, cross-context under a noncurrent version, mobile parity, the Exact-Return race, `RH` integrity under no-ops, and the "looks like a rebind" case. Verdicts printed per cell on a scale that permits FAIL.

Scaffolding only. No final UI or motion.

---

## 24. AT-01…AT-36 traceability

| AT | Rules | AT | Rules | AT | Rules |
|----|-------|----|-------|----|-------|
| 01 | `G-13`, `G-42`…`G-44` | 13 | `G-37` A | 25 | `G-31`, `G-32` |
| 02 | `G-43`, `G-44` | 14 | `G-37` B, `G-49` | 26 | `G-32`, `F-06` |
| 03 | `G-12` | 15 | `G-37` C, OPEN-18 | 27 | `G-44` |
| 04 | `G-11`, `G-40` | 16 | `G-37` D | 28 | `G-52`, `G-53` |
| 05 | §5 row, `G-40` | 17 | `G-40` | 29 | `G-12`, `G-14` |
| 06 | `G-22`, `G-41` | 18 | `G-47`, `G-49` | 30 | `G-40`, `G-37` |
| 07 | `G-23` | 19 | `G-48` | 31 | `G-25`…`G-27` |
| 08 | `G-36`, `G-40` | 20 | `G-50`, `G-11` | 32 | §5 row, `G-12` |
| 09 | `G-24`, `G-36` | 21 | `G-13`, `G-20`, `G-25` | 33 | `G-34`, `G-35` |
| 10 | `G-14`, `G-36` | 22 | `G-12`, §2.5 | 34 | `G-28`, `F-03` |
| 11 | `G-25` + Stage 5.2 | 23 | `G-34`, settle-correctness | 35 | `G-28` |
| 12 | `G-45` | 24 | `G-22`, `G-23` | 36 | `G-29`, `G-30` |

## 25. D1…D6 traceability

| D | Contract § | Rules | Proven by |
|---|-----------|-------|-----------|
| **D1** | §8 | `G-22`…`G-24` | AT-06, AT-07, AT-24 · Y-01, Y-02 · `F-08` |
| **D2** | §9 | `G-25`…`G-27` | AT-11, AT-31 · Y-06, Y-07, Y-08 · `F-05` |
| **D3** | §10 | `G-28`…`G-30` | AT-34, AT-35, AT-36 · Y-03, Y-04, Y-05, Y-15 · `F-02`, `F-03` |
| **D4** | §11 | `G-31`…`G-33` | AT-25, AT-26 · Y-09 · `F-06` |
| **D5** | §12 | `G-34`…`G-36` | AT-08, AT-10, AT-33 · Y-10 · `F-04` |
| **D6** | §13 | `G-37`…`G-39` | AT-13…AT-16, AT-30 · Y-11, Y-12, Y-16 · `F-07` |

---

## 26. Remaining OPEN items

### Inherited — all preserved as DEFER, untouched

OPEN-02 (P3a affordance vocabulary — border with D4 named at §11, not crossed) · OPEN-06 · OPEN-08 · OPEN-09 · OPEN-10 · OPEN-12 · OPEN-13 · OPEN-14 · OPEN-15 · OPEN-16 (governs the sparse-viewport visual cue; §18 freezes only state semantics) · OPEN-17.

### Newly proposed — Experience-level only

| ID | Question | Why it cannot be settled here | Owner |
|----|----------|-------------------------------|-------|
| **OPEN-18** | **Inspection-reference vs rendered-version legibility.** How a person perceives that `IF_ref` still references `R2` while the projection legitimately renders `R1` — without that divergence reading as a silent substitution, and without breaching knowledge gating. | D6 settles the semantics completely; only *perceivability* is open, and it needs visual evidence. It defers no part of D1–D6. | Experience |
| **OPEN-19** | **Transient no-op acknowledgement form.** `G-30` permits transient orientation feedback for an effective no-op and forbids it from becoming navigation state; which form communicates "you are already there" without implying that something happened needs testing. | The rule is frozen here; only the surface is open. | Experience |

Neither substitutes for an integration decision, and no OPEN was created to avoid proving D1–D6.

---

## 27. Architecture Review Handoff

**What is being asked of review.** Confirm the canonical correction is correctly applied throughout, then attack the integration rules. The decision index lists the eight most load-bearing claims; each is falsifiable.

Suggested attack order:

1. **Attack `G-20`** — the definition of effective change. Find an act that changes something a user would call state but leaves `Φ` untouched, or vice versa. Everything about D3 and `RH` hygiene rests on this one line.
2. **Attack `F-08`** — try to show D1's activation binding and P3's settle-time evaluation genuinely conflict rather than answering different questions.
3. **Attack `F-06`** — try to show D4 amends rather than states P3a's precondition.
4. **Attack the orthogonality rule `G-04`** — find a legitimate act that must mutate an axis outside its authority. If one exists, the authority matrix needs a new row, not a relaxed rule.
5. **Attack `F-04`** — construct a sequence in which Live captures a historical user, or an excursion becomes unreachable by Back.
6. **Attack the corrected spatial invariant's application** — find any place where I have implicitly reasoned as if a Reading, Memory, relation or appearance owned a coordinate.
7. **Rule on OPEN-18** — whether Case C's divergence needs a legibility solution before Stage 5.5 can freeze, or whether it belongs to later Experience work.
8. **Verify no deferred item moved** — OPEN-02/06/08/09/10/12/13/14/15/16/17 untouched.

**Upstream freezes touched and confirmed untouched.** Stage 4 return actions, camera preservation, no-silent-ownership, direct-jump context, Semantic Zoom as disclosure; Stage 5.1 `S`, modes, restoration normalisation, Live-Focus guard; Stage 5.2 domain, target kinds, Model C, `PTC ∉ S`, temporal ≠ spatial intent, `RH` atomicity, P3 settle-time uniqueness; Stage 5.3 Timeline boundary, post-`TC` firewall, Live-meta bound, accessibility parity; Stage 5.4 spatial-commitment invariant **as corrected by Addendum A-03**, `IF_ref`/`IF_render` split, projection-never-moves-camera, lineage retrievability.

**Deliberately absent.** Replay; final motion, styling, wording, iconography; implementation, scheduling, runtime or database design; cross-session navigation; any repository change; any resolution of deferred OPEN items.

**Status.** Stage 5.5 is **not** declared complete or frozen. Returned for Product / Experience / Architecture review.
