# QANDEEL — Stage 5.4 Candidate Package v1
## Historical Projection + Map Temporal Appearance Contract

**Status:** CANDIDATE v1 — for Product / Experience / Architecture review. **Not complete. Not frozen.**
**Date:** 2026-09-03
**Authority:** `QANDEEL_STAGE5_4_EXECUTION_AUTHORIZATION.md` (Pre-Flight APPROVED; RULING-01…03 binding), over the frozen checkpoint (Stages 0–4) and the frozen Stage 5.1, 5.2 and 5.3 contracts.
**Scope discipline:** no repository change, no code, no Replay, no final motion, no final colour/typography/iconography, no reopening of frozen stages, no resolution of deferred OPEN items.

Proposed rules are labelled **`H-nn`**. Findings surfaced during execution are **`F-nn`**. Binding tests are **AT-01…AT-24**; the additional required attacks are **X-01…X-16**.

---

## Decision index — the load-bearing claims

For reviewers who want the argument before the detail. Each links to its section.

| # | Claim | Why it is load-bearing | § |
|---|-------|------------------------|---|
| **1** | **`pos(e) = f(e)`** — canonical position is a function of the entity and its own establishment, **never of the rendered subset at `TC`**. | This single property makes historical compaction *impossible by construction* rather than merely forbidden, and it is what discharges AT-01, AT-02, AT-06, AT-24 and X-01/X-04 at once. | §3.4, §7, §8 |
| **2** | **Gate ordering: knowledge → context → validity → depth.** The depth gate is last and is the only non-temporal gate. | An object can only be "depth-withheld" after passing every temporal gate, so the two can never be confused (AT-13). | §3.2 |
| **3** | **Depth-invariance vs depth-monotonicity** is the operational test separating temporal absence from depth withholding: temporally unavailable ⇒ absent at *every* depth; depth-withheld ⇒ present at *some* deeper depth. | Makes AT-13 / X-12 checkable rather than assertable. | §13 |
| **4** | **Absence is rendered uniformly and reason-free**; presence carries state. | Disclosing *why* something is absent would leak that it will later exist. Reconciles AT-21, AT-22 and the no-hindsight rule. | §4.3, §7 |
| **5** | **Validity intervals are half-open `[VF, VT)`.** | Guarantees exactly one then-current version at every `TC` — no boundary double-currency, no gap. | §3.3 |
| **6** | **`KF` (knowledge) and `VF/VT` (validity) are independent axes; `RTO` is content on neither.** | The bitemporal separation is what lets a later correction leave earlier truth intact (AT-23). | §2.2, §10 |
| **7** | **RULING-03 finding:** `PREVALID` is **unreachable for analysis-derived versions** (`KF == VF` by construction) and **undetermined — flagged, not invented** for world-fact validity. | Executes RULING-03 exactly: inspected, not assumed. | §3.3, §10.3, F-05 |
| **8** | **Home-locus persistence is scoped**: persistent *from establishment onward*, never retroactively. | The precise mechanism preventing an Emerging focus from borrowing its future locus (AT-05, RULING-01). | §6.1 |
| **9** | **Neighbourhood expression legitimately varies with `TC`; the Home locus does not.** | Prevents a legitimate behaviour from being misread as compaction — and forbids sizing expression from future content. | §7.3, F-02 |
| **10** | **`IF` splits into `IF_ref` (retained, opaque) and `IF_render` (re-resolved every projection).** | Lets Exact Return stay exact while the Map refuses to render unavailable truth (AT-10, AT-11, FORBIDDEN-09). | §11 |
| **11** | **`MC` is orthogonal to `TC`.** A projection change never moves the camera; sparsity is a legitimate state, not an error. | AT-14, X-11, FORBIDDEN-10. | §12 |
| **12** | **Settle-equality invariant:** after settle, the authoritative Map equals `Resolve` over final `K(TC)` exactly — no residue. | AT-20, X-15, without touching motion. | §15 |

---

## 1. Pre-Flight compliance statement

**Frozen upstream preserved.** Stages 0–4, 5.1, 5.2 and 5.3 are binding and unreopened. This package adds **no member to `S`**, defines no navigation primitive, changes no Timeline disclosure rule, and moves no canonical geography. All resolution states introduced here are **architectural**, not user-facing labels.

**RULING-01 — Emerging / pre-geographic.** Applied. The frozen Stage 3 visual-language contract already establishes Emerging Focus as a legitimate world state ("Emerging Focus is pre-geographic and must not read as a smaller Established Thread", frozen at Stage 3.2 and restated in the Stage 3.5 state language). Stage 5.4 therefore **preserves** that representation under the four constraints of the ruling and **invents nothing**: §6.1 and `H-11`…`H-13`.

**RULING-02 — Confidence is versioned analytical state.** Applied, not researched as an open question. Confidence resolves through the ordinary version gate; only then-valid confidence is available; later confidence never leaks backward; confidence magnitude never alters geometry, distance, size, Home locus or spatial importance; visual disclosure remains governed by the frozen Map disclosure hierarchy; Stage 5.3's prohibition on confidence-over-time **as a Timeline class** is untouched: §5 class 9, `H-30`…`H-33`.

**RULING-03 — Knowledge-before-validity represented precisely, not forced.** Applied by inspection, per class, in §3.3 and §10.3. Vocabulary refined as the ruling permits: `KNOWN_HISTORICAL_NONCURRENT_AT_TC` → **`KNOWN_NONCURRENT_AT_TC`** with substates **`PREVALID`** / **`SUPERSEDED`**. No new user-facing label is created. The canonical requirement — *known does not automatically mean then-current* — is carried by `H-08`.

**Deferred OPEN items untouched.** OPEN-02, 06, 08, 09, 10, 12, 13, 14 are neither resolved nor silently narrowed. Where OPEN-09 borders §10/§11, the border is named and the decision stays on the projection side.

**Contradictions with frozen rules.** **None found.** Two places where a frozen rule forces a non-obvious consequence are reported as findings rather than treated as grounds to reinterpret anything: neighbourhood-expression variation (`F-02`) and the uniformity of rendered absence (`F-03`). One ontology question is reported as *undetermined and flagged* exactly as RULING-03 directs (`F-05`), not filled in by invention.

**Not present:** Replay; final motion, colour, typography, iconography or transition behaviour; lineage-comparison UI; runtime architecture, renderer, schema or coding strategy; any repository change.

---

## 2. Research synthesis

Targeted research only, on the questions the frozen contracts leave open. Sources are primary (W3C normative, vendor reference, and one named-author engineering source). **No source is adopted as a product decision, and no database, GIS or version-control implementation architecture is imported** — each supplies a transferable principle whose QANDEEL consequence is derived from the frozen contracts. **Unreachable sources:** none newly attempted; the three sources declared unreachable in Stages 5.2/5.3 (Esri TimeSlider, Apple HIG Sliders, WHATWG §4.8.11.9) remain unused and are not relied upon here.

### 2.1 Two independent time axes, and history that is never overwritten — Fowler, *Bitemporal History*

- **Reusable principle.** Two axes are required: **actual/valid time** ("when something genuinely occurred") and **record/knowledge time** ("when we learned about it"). Retrieval needs both — `salaryAt(actualDate, recordDate)` rather than `salary()`. Crucially, "record history itself *is* append only. We don't change what we thought we knew … We just append the later knowledge we gained."
- **QANDEEL implication.** This is precisely the frozen `KF` vs `VF/VT` separation, and it supplies the mechanism for AT-23: a later correction is an *append* on the knowledge axis, so the earlier projection continues to resolve `R1` as then-current. It also means the resolution function must take **both** `TC` and the entity's own two-axis metadata — never a single "when" (§3).
- **Pattern not to copy.** The storage schema, the as-of query API, and the payroll domain's notion that the *record* axis is a database transaction log. QANDEEL's knowledge axis is an epistemic contract about what the system could legitimately know, not a write log.

### 2.2 Provenance describes what has already happened — W3C PROV-DM

- **Reusable principle.** PROV models an **Entity** ("a thing with some fixed aspects"), **`wasRevisionOf`** ("the resulting entity is a revised version of some original"), and **`specializationOf` / `alternateOf`** for entities "that refer to the same thing, expressing different perspectives or versions". Relation names deliberately use "past tense to express what happened in the past, as opposed to what may or will happen."
- **QANDEEL implication.** Three consequences. (i) A superseded Reading is a *retained entity related by revision*, not a deleted one — supersession is a relation, never an erasure (`H-25`, AT-08, FORBIDDEN-04). (ii) `specializationOf`/`alternateOf` is the right shape for **one canonical object with several contextual appearances**: same referent, different perspective, no ownership (§9). (iii) The past-tense discipline is the model for the whole stage: the historical projection states what *was* legitimate, never what will be.
- **Pattern not to copy.** PROV's graph serialisation and its agent/attribution machinery. QANDEEL must not render provenance as a node-edge graph — Stage 3's anti-drift list forbids exactly that.

### 2.3 Half-open intervals make "then-current" unambiguous — PostgreSQL range types

- **Reusable principle.** "An inclusive bound means that the boundary point itself is included in the range …, while an exclusive bound means that the boundary point is not included." The canonical form is `[)`, because half-open ranges "partition domains without gaps" — `[0,10)`, `[10,20)`, `[20,30)` — and `[)` is the assumed default.
- **QANDEEL implication.** Version validity is defined as the half-open interval `[VF, VT)`, giving **exactly one** then-current version at every `TC`: no instant at which two versions are simultaneously current, and no instant that falls between them. At a supersession boundary `t = VT(R1) = VF(R2)`, `R2` is current and `R1` is already `SUPERSEDED` — a single, checkable rule rather than a judgement call (`H-07`, AT-08).
- **Pattern not to copy.** Range operators, indexing and canonicalisation are storage concerns; the borrowed item is the interval convention only.

### 2.4 Identity-keyed joins give object constancy — d3-selection, data joins

- **Reusable principle.** A join may match data to elements **by key rather than by index**: "the datum for a given key is assigned to the element with the matching key", which preserves **object constancy** across updates. The complement — the default index join — reassigns elements positionally whenever the set changes size.
- **QANDEEL implication.** This names the exact failure mode Stage 5.4 must exclude. An index-like layout, where position derives from the *rendered subset*, causes remaining objects to shift whenever earlier ones vanish — historical compaction, arrived at accidentally. The contract therefore states positively that **`pos(e) = f(e)`**: canonical position is keyed to the entity's own identity and establishment, never recomputed from `K(TC)` membership (`H-09`, §7, §8). Removing an object from the projection cannot move any other object, because no other object's position ever read it.
- **Pattern not to copy.** Enter/update/exit as an interaction or animation model, and any suggestion that entities "enter" and "exit" the world — in QANDEEL the world is invariant and only the projection changes.

### 2.5 An absence should not have to explain itself — HTTP 404 vs 410 (MDN)

- **Reusable principle.** `410 Gone` "indicates that the target resource is no longer available … and that this condition is likely to be permanent", while `404` is used when owners "don't know whether this condition is temporary or permanent". The two differ precisely in **how much the absence discloses about itself**.
- **QANDEEL implication.** This yields `F-03` by inversion. QANDEEL must behave like a *uniform* absence and never like `410`: if a not-yet-known object were rendered absent-with-a-reason — "not yet available", a distinct empty treatment, a differently-shaped gap — the reason itself would disclose that the object exists later. Hence: **the internal resolution vocabulary is rich; the rendered absence is uniform and reason-free** (`H-10`). AT-22's requirement that *unknown* and *dormant* be semantically different is satisfied on the other side of the line: dormant is **present with state**, unknown is **not present at all** — a difference of presence, not of absence-flavour.
- **Pattern not to copy.** Status-code semantics as user-facing messaging, and the idea that clients deserve to know *why* something is missing. Here, explaining absence is the leak.

### 2.6 Hidden-but-present is a different fact from not-present — WAI-ARIA APG, Disclosure pattern

- **Reusable principle.** A disclosure "enables content to be either collapsed (hidden) or expanded (visible)"; `aria-expanded` conveys which. The control "doesn't create or destroy the content" — it toggles visibility of content that exists, which "contrasts with dynamically injected content that may not be present at all."
- **QANDEEL implication.** This is the accessibility-side statement of the depth/absence distinction. Semantic Zoom is a disclosure mechanism: an object withheld at the current depth **exists in `K(TC)`** and is disclosed by going deeper, whereas a temporally unavailable object does not exist in the projection at any depth. The distinction must therefore be carried by the *disclosure model and its lineage affordances* — not by a per-object marker on the withheld object, which would itself be a presence signal (§13, `H-35`, `H-36`).
- **Pattern not to copy.** `aria-expanded` on individual objects as the mechanism, and any per-object "there is more here" marker — Stage 4's aperture and lineage already carry depth orientation, and a per-object hint would leak existence at the wrong depth.

### 2.7 Synthesis

| Principle | Where it lands |
|-----------|----------------|
| Two independent axes; knowledge history is append-only | `H-01`…`H-08`; AT-23 |
| Revision retains the revised entity; same referent, several perspectives | `H-25` supersession; §9 contextual appearance |
| Half-open `[VF, VT)` ⇒ exactly one then-current version | `H-07` |
| Position keyed to identity, never to the rendered subset | `H-09`; §7; §8 |
| Absence must not disclose its own reason | `H-10`; `F-03` |
| Hidden-but-present ≠ not-present, and the distinction lives in the disclosure model | `H-35`, `H-36`; §13 |

---

## 3. Historical resolution model

### 3.1 What is resolved

Resolution applies to a **target triple** `x = (e, a, v)`:

- `e` — the canonical entity (Thread, Session, Reading, relation, evidence participation, Memory, Event, Question, Shared Anchor, provenance record).
- `a` — an optional **contextual appearance** of `e` in a particular Thread context. An appearance is *not* a copy of `e`; it is a perspective on the same referent (§2.2) and carries its **own** `KF`.
- `v` — an optional **version** of `e`'s analytical state, carrying its own `[VF, VT)`.

`H-01.` Resolution is performed **per triple**, never per object. One canonical object may resolve differently in two contexts at the same `TC` — this is what makes AT-07, AT-11 and AT-17 expressible at all.

### 3.2 The gates, and why their order is load-bearing

`H-02.` `Resolve(x, TC, depth)` evaluates gates in this fixed order:

```
1. KNOWLEDGE     ¬Known(e, TC)                    → UNKNOWN_AT_TC
2. CONTEXT       a ≠ ∅ ∧ ¬Known(a, TC)            → CONTEXT_UNAVAILABLE_AT_TC
3. VALIDITY      v ≠ ∅ ∧ TC ∉ [VF(v), VT(v))      → KNOWN_NONCURRENT_AT_TC
                     TC <  VF(v)                  →    · PREVALID
                     TC >= VT(v)                  →    · SUPERSEDED
4. DEPTH         ¬DepthEntitled(e, depth)         → AVAILABLE_BUT_DEPTH_WITHHELD
5. otherwise                                      → AVAILABLE_AND_RENDERABLE
```

`H-03.` Gates 1–3 are **temporal** and determine *presence in `K(TC)`*. Gate 4 is **not temporal**; it determines *default renderability at the current depth* and nothing else. Because gate 4 runs last, `AVAILABLE_BUT_DEPTH_WITHHELD` can only be reached by a target that has already passed every temporal gate — which is exactly why the two can never be conflated (AT-13). The ordering is the proof, not a convention.

`H-04.` For Threads and focus, an **orthogonal lifecycle state** is resolved alongside the gates (§6): `EMERGING_PREGEOGRAPHIC` · `ESTABLISHED_ACTIVE` · `ESTABLISHED_DORMANT` · `ESTABLISHED_REOPENED`. Lifecycle is a *state of a present entity*; it never substitutes for gate 1.

`H-05.` The model yields **three distinct outputs**, which the contract keeps separate everywhere:

| Output | Question it answers | Governed by |
|--------|--------------------|-------------|
| **Presence in `K(TC)`** | Is this in the projection at all? | gates 1–3 |
| **Default renderability** | Is it rendered by default, here, now? | gate 4 + then-current rule |
| **Retrievability** | Can it be reached through lineage/provenance? | knowledge persistence |

`KNOWN_NONCURRENT_AT_TC` is the state where these three visibly diverge: present in `K(TC)`, not default-rendered, retrievable at provenance depth.

### 3.3 Knowledge and validity are independent — and `PREVALID` is inspected, not assumed

`H-06.` `Known(e, TC) ⇔ KF(e) ≤ TC`. Knowledge, once acquired, **persists**: `Known` is monotonic in `TC`. Superseded ≠ forgotten.

`H-07.` Version validity is the **half-open interval `[VF, VT)`** (§2.3). Exactly one version of a versioned entity is then-current at any `TC` within its lifetime. At a supersession boundary `t = VT(R1) = VF(R2)`, `R2` is then-current and `R1` is already `SUPERSEDED`.

`H-08.` **Known does not automatically mean then-current** (RULING-03 canonical requirement). Default Map rendering resolves from **then-valid state**, never from mere existence in lineage.

**RULING-03 inspection, per class (`F-05`).**

| Version type | `KF` vs `VF` | `PREVALID` reachable? |
|---|---|---|
| Analysis-derived versions — Reading, relation, evidence participation, confidence state, Question lifecycle state | The version comes into existence *by being produced*: QANDEEL knows it at the instant it becomes current. `KF(v) == VF(v)` by construction. | **No — unreachable.** Marked invalid for these types. |
| World-fact validity — a stated circumstance whose validity begins later than the statement (e.g. a fact asserted now as taking effect later) | Would require `KF ≤ TC < VF`. The frozen ontology available to this stage (Stage 1 Data Reality, Stage 3.3 epistemic families) establishes `RTO` as *referenced content* and does **not** establish a forward validity interval for such facts. | **Undetermined — flagged, not invented.** |

`H-08a.` Because `PREVALID` is unreachable for analysis-derived versions, **AT-12's premise does not arise for Readings**: a live `R2` cannot be *known* at a `TC` where `R1` is then-current. This is reported as an ontology finding (RULING-03 step 2), not engineered around. The contract nonetheless retains the `PREVALID` substate so that, **if** Architecture later establishes forward-valid world facts, the rule is already in place: a `PREVALID` version is present in `K(TC)` as lineage, is **never** default-rendered, and **never displaces** the then-current version (`H-27`).

### 3.4 Position is not an output of resolution

`H-09.` **`pos(e) = f(e)`.** Canonical position is a function of the entity and its own establishment event alone. It is **never** computed from, normalised against, or packed within the set of entities present at `TC`. Consequences, all of which follow rather than being separately legislated:

- removing an entity from the projection **cannot** move any other entity (AT-01, X-01);
- a relation that does not yet exist **cannot** have pulled its endpoints together (AT-06, AT-24, X-04);
- a device or depth change cannot repack the world (AT-19, X-14);
- there is no "historical layout" to design — only membership and state.

`H-10.` **Rendered absence is uniform and reason-free.** A target that fails gates 1–3 is simply not present: no ghost, outline, slot, anchor, target, label, marker, differentiated gap, or distinguishing empty treatment. Different *internal* resolution states (`UNKNOWN_AT_TC`, `CONTEXT_UNAVAILABLE_AT_TC`, `KNOWN_NONCURRENT_AT_TC`) must be **indistinguishable in the rendered surface**, because a distinguishable absence discloses the future (`F-03`).

---

## 4. State vocabulary

Architectural resolution states, not UI labels. No user-facing name is proposed.

| State | Meaning | Present in `K(TC)`? | Default-rendered? | Retrievable? |
|-------|---------|---------------------|-------------------|--------------|
| `UNKNOWN_AT_TC` | `KF(e) > TC`. Not in the projection in any form. | No | No | No |
| `KNOWN_AND_CURRENT_AT_TC` | Known and then-valid. | Yes | Yes, if depth-entitled | Yes |
| `KNOWN_NONCURRENT_AT_TC · PREVALID` | Known; validity has not begun. Unreachable for analysis-derived versions (`F-05`). | Yes (lineage) | **No** | Yes, at provenance depth |
| `KNOWN_NONCURRENT_AT_TC · SUPERSEDED` | Known; validity ended before `TC`. | Yes (lineage) | **No** | Yes, at provenance depth |
| `CONTEXT_UNAVAILABLE_AT_TC` | This appearance has `KF(a) > TC`; the canonical entity may resolve elsewhere. | Appearance: no. Entity: possibly yes elsewhere | No | Entity yes, appearance no |
| `AVAILABLE_BUT_DEPTH_WITHHELD` | Passed every temporal gate; not disclosed at this depth. | Yes | Not here — **yes deeper** | Yes |
| `AVAILABLE_AND_RENDERABLE` | Passes all gates. | Yes | Yes | Yes |

Thread/focus lifecycle, orthogonal to the above:

| State | Meaning |
|-------|---------|
| `EMERGING_PREGEOGRAPHIC` | Legitimate focus, **no established Home locus yet**. Present without canonical position. |
| `ESTABLISHED_ACTIVE` | Established; Home locus exists and is persistent from this point onward. |
| `ESTABLISHED_DORMANT` | Same identity, same Home locus, then-valid dormant state. **Present**, not absent. |
| `ESTABLISHED_REOPENED` | Same identity, same Home locus, state changed. **No second Thread.** |

### 4.3 The distinctions that must never collapse

- `UNKNOWN_AT_TC` **≠** `ESTABLISHED_DORMANT` — absence versus presence-with-state. Not two shades of the same thing (AT-22, X-02).
- `CONTEXT_UNAVAILABLE_AT_TC` **≠** entity nonexistence — an appearance vanished, an identity did not (AT-07, AT-11, X-05).
- `AVAILABLE_BUT_DEPTH_WITHHELD` **≠** historical absence — non-temporal axis, depth-monotonic (AT-13, X-12).
- `KNOWN_NONCURRENT_AT_TC` **≠** deleted, false, rejected or low-confidence (AT-21, X-07, X-16).
- `EMERGING_PREGEOGRAPHIC` **≠** an Established Thread with hidden styling (AT-05, X-13).
- `ESTABLISHED_REOPENED` **≠** a new identity (AT-04, X-03).

`H-10` applies **only to the rendered surface**: internally these remain fully distinct; externally, everything that fails gates 1–3 renders the same way — as nothing.

---

## 5. Entity-class projection / renderability matrix

Depth abbreviations follow the frozen lineage: **Z0** World · **Z1** Thread · **Z2** Session / local analytical field · **Z3** Reading / analytical object · **SRC** Source / Provenance. Cells give *default* disclosure. No new canonical class is invented.

| # | Class | Knowledge gate | Validity / lifecycle gate | Context gate | Default disclosure by depth | Lineage retrievability | If unavailable | If noncurrent | Spatial locus? | Identity rule |
|---|-------|----------------|---------------------------|--------------|------------------------------|------------------------|----------------|---------------|----------------|---------------|
| 1 | **Thread / Focus** | `KF(Thread)` = legitimate establishment or emergence | Lifecycle: Emerging → Active → Dormant → Reopened | — (a Thread *is* a context) | Z0 place; Z1 field | State history at SRC | Absent entirely (`H-10`) | n/a — lifecycle state, not version | **Yes**, from establishment onward (`H-14`) | One identity across all states; Reopened is not new |
| 2 | **Session** | `KF` = the session's own occurrence | Sessions do not supersede | Inherits its Thread | Footprint at Z1; interior at Z2 | Yes at SRC | Footprint absent | n/a | **Derived** from containing Thread; no independent locus | Session is not a Thread; no Home Anchor |
| 3 | **Reading / analytical object** | `KF(R)` = when produced | `[VF, VT)`; `KF == VF` (`F-05`) | Lives in a Session field | Z2 as material; Z3 as the claim | Superseded versions at SRC | Absent | Not default-rendered; SRC-retrievable | No independent locus | Peer Readings unranked (Stage 3.3) |
| 4 | **Relation (GSR)** | `KF(R)` — **independent of endpoints** | May be retired/superseded | Both endpoints must resolve | Z1/Z2 where entitled | Yes at SRC | **No geometry at all** (§8) | Historical relation not rendered as current | No locus of its own | A relation is not an object; no ownership |
| 5 | **Evidence participation** | `KF` of the participation | Follows its Reading version | Both ends must resolve | Z2/Z3 | Yes at SRC | Absent | Absent as current | No locus | Participation ≠ GSR; never strength |
| 6 | **Memory** | `KF(M)` | Provenance-sensitive; may have versions | **Per appearance** | Z2 as material | Yes at SRC | Absent | Then-valid version only | No locus; appears via appearances | One identity across contexts |
| 7 | **Event** | `KF(E)` — *not* `RTO` | Then-valid state | Per appearance | Z2 as material | Yes at SRC | Absent | Then-valid only | No locus | `RTO` is content, never position or validity |
| 8 | **Contextual appearance** | **Own `KF(a)`** | Follows the referent's version | It *is* the context gate | Wherever its context is disclosed | Appearance history at SRC | Appearance absent; entity may resolve elsewhere | Follows referent | Rendered within its context only | Appearance never implies ownership (`H-28`) |
| 9 | **Confidence version / state** | Follows its analytical object | `[VF, VT)` — **RULING-02** | Follows its object | Only at the depth that entitles the object's analytical state (Z3 typically) | Yes at SRC | Absent | Then-valid confidence only; never today's | **No** — never geometric (`H-32`) | A property version, not an object |
| 10 | **Question / Information gap** | `KF(Q)` | Lifecycle OPEN / RESOLVED / IRRELEVANT / SUPERSEDED (Stage 3.5) | Lives in a Session field | Z2 | Yes at SRC | Absent | Then-valid lifecycle state | No independent locus | Lifecycle state ≠ new object |
| 11 | **Source / Provenance lineage** | `KF` of the source-bound record | Records do not supersede; readings about them do | Per appearance | **SRC only** by default | This *is* the retrieval path | Absent | n/a | No locus | Provenance describes the past (§2.2) |
| 12 | **Cross-Thread Shared Anchor** (exceptional, Stage 3.4/4.3) | `KF(anchor)` = when the anchor itself became legitimate | Persists once established | — | Z0/Z1 as a permanent spatial commitment | Yes at SRC | **Absent, and its later existence never pre-shapes geography** (`H-09`) | n/a | **Yes**, from establishment onward | Anchor ≠ ordinary shared appearance |

`H-15.` No class defaults to rendering its full lineage; every class renders its **then-current** resolution only (`H-08`).

---

## 6. Thread lifecycle contract

### 6.1 Emerging / pre-geographic (RULING-01)

`H-11.` An `EMERGING_PREGEOGRAPHIC` focus is **present** in `K(TC)` while its emergence is legitimate, and **has no canonical position**. Stage 5.4 preserves the frozen Stage 3 representation and invents no new visual object.

`H-12.` It MUST NOT: borrow the later Thread Home locus backward; be rendered as an Established Thread place; create an anticipatory geographic slot, outline, anchor, label or future-shaped hole; or read as a smaller Established Thread.

`H-13.` Any placement its representation receives is **presentation-only and carries no canonical position claim**, and MUST NOT be derivable from the future Home locus. Its legitimacy ends when the Emerging state ends — an Emerging representation is not retained beside the Established Thread afterwards.

`H-14.` **Home-locus persistence is scoped**: a Home locus exists **from establishment onward** and is fixed thereafter. It does not exist at any `TC` before establishment, and is never applied retroactively. This is the precise mechanism behind AT-05.

### 6.2 Established / Active · Dormant · Reopened

`H-16.` `ESTABLISHED_ACTIVE`: Home locus exists and is spatially persistent from this point.

`H-17.` `ESTABLISHED_DORMANT`: the **same** identity at the **same** Home locus, in a then-valid dormant state. A dormant Thread is **present** and MUST NOT be removed, thinned to nothing, or otherwise rendered as though unknown. Dormancy is a state modifier, never an identity change (Stage 3.5, FORBIDDEN-06).

`H-18.` `ESTABLISHED_REOPENED`: the **same** identity at the **same** Home locus with a changed current state. Reopening creates **no** second Thread, no second locus, and no duplicate (FORBIDDEN-07).

`H-19.` **Transitions resolve in both directions.** Moving `TC` backward across establishment yields `EMERGING_PREGEOGRAPHIC` or `UNKNOWN_AT_TC`; backward across dormancy yields `ESTABLISHED_ACTIVE`; forward across reopening yields `ESTABLISHED_REOPENED` — with the Home locus unchanged at every step from establishment onward. No transition alters position.

---

## 7. Future-Thread absence contract

`H-20.` A Thread not legitimate in `K(TC)` is **absent**: no label, no Home locus exposure, no target, outline, anchor or ghost, and no geometry constructed with knowledge of its future existence.

`H-21.` Simultaneously: established Home loci **do not move**, the Map is **not compacted**, and the camera is **not rescued elsewhere**. This is guaranteed by `H-09`, not by vigilance.

`H-22.` **The empty-space rule.** Empty space may exist because the fixed world currently holds less legitimate material. Empty space MUST NOT be shaped, sized, bounded, framed or annotated using knowledge of future material. The operative test is **derivation, not appearance**: nothing about an empty region may be computed from, or marked because of, an entity that is not in `K(TC)`. A region that is empty *because nothing legitimate is there* is correct; a region that is empty *in the shape of what will arrive* is a violation (AT-02).

### 7.3 Neighbourhood expression — a legitimate variation, precisely bounded (`F-02`)

The frozen Stage 3.2 contract specifies "one stable perceptual Home locus per Established Thread" **and** "adaptive organic Neighbourhood expression around the fixed locus", with sparse and dense states remaining the same place family.

`H-23.` **Neighbourhood expression is a function of then-legitimate content; the Home locus is not.** A Thread's field therefore legitimately reads as sparser at a historical `TC` than at Live. This is *not* compaction: the locus is invariant, the place family is unchanged, and no other Thread moves.

`H-24.` Neighbourhood expression MUST NOT be sized, bounded or shaped using content outside `K(TC)`, and its variation MUST NOT be usable to infer how much material arrives later. Expression follows presence; it never anticipates it.

This is reported as a finding because a reviewer could reasonably mistake legitimate expression variation for forbidden relayout, or conversely could freeze expression and thereby leak future volume.

---

## 8. Relation and geometry firewall

`H-25a.` Before a relation is legitimate in `K(TC)`: no relation geometry, no connector, no current, no pull, no alignment, no grouping adjustment, no special proximity, and no ownership inference.

`H-26.` If both endpoints are independently legitimate, they render with **only their own** independently legitimate geography. Their positions are `f(A)` and `f(B)` — functions of themselves alone (`H-09`).

**Proof that later relation knowledge cannot alter earlier geometry.** Position is keyed to identity and establishment (`H-09`); it takes no input from the relation set, at any `TC`. Therefore for all `TC₁ < TC₂`, `pos(A)` and `pos(B)` are identical whether or not a relation `R` with `KF(R) ∈ (TC₁, TC₂]` exists. The firewall is **inherited from frozen geography rather than newly legislated**; Stage 5.4's contribution is to state the derived invariant and to close the presentation-level substitutes — halo, tint, clustering, alignment, spacing or emphasis introduced *around* the endpoints in anticipation — which `H-25a` forbids explicitly (AT-24, X-04).

---

## 9. Contextual appearance contract

`H-27a.` One canonical object has **one identity** and may have several contextual appearances; each appearance is a perspective on the same referent (§2.2), not a copy.

`H-28.` Each appearance is **independently knowledge- and context-gated** by its own `KF(a)`. An appearance with `KF(a) > TC` is absent.

`H-29.` Loss of one appearance does **not** erase canonical identity where another legitimate path exists; the object remains reachable through its legitimate contexts.

`H-28b.` **Contextual presence never implies canonical ownership** (FORBIDDEN-08). A containing Thread does not become the owner of an object that appears in it.

`H-29b.` No unavailable context's **name or locus** may leak through inspection or return chrome — carried forward from the frozen Stage 5.3 knowledge-gated naming rule (AT-11, X-05).

---

## 10. Version / supersession contract

### 10.1 While `R1` is then-current

`H-30a.` At any `TC ∈ [VF(R1), VT(R1))`, `R1` is the then-current analytical version and is rendered as such where semantic depth entitles it. It is rendered as **then-current, not as historical** — the projection must not mark it with knowledge of its later supersession (AT-23).

### 10.2 After `R2` supersedes `R1`

`H-25.` `R2` becomes then-current. `R1` **remains canonical historical lineage** and is **not deleted** (FORBIDDEN-04). `R1` is **not** automatically rendered beside `R2` at ordinary Map depths (FORBIDDEN-05); it is retrievable through Source/Provenance inspection where legitimate. A later correction does not rewrite the earlier projection.

`H-26b.` Supersession is a **relation between retained versions** (`wasRevisionOf`, §2.2), never an erasure and never a judgement that the earlier version was false (AT-21).

### 10.3 `PREVALID`

`H-27.` If a `PREVALID` known-but-not-yet-valid version is legitimate for some object type, it is present as lineage, is **never** default-rendered, and **never displaces** the then-current version. Per `F-05`, this state is **unreachable for analysis-derived versions** and **undetermined** for world-fact validity; the rule exists so that the model is complete if Architecture later establishes such facts. This is the border with deferred **OPEN-09**, which is named and not crossed.

---

## 11. Inspection resolution contract

`H-30.` **`IF` splits into two things**, and keeping them apart is what lets Exact Return stay exact while the Map stays truthful:

- **`IF_ref`** — the opaque canonical inspection reference retained in `RH`. Never cleared by a temporal move; carries no rendering authority.
- **`IF_render`** — the target actually rendered, **re-resolved against `K(TC)` on every projection change**.

`H-31.` `RH` retaining `IF_ref` is **never** a licence to render unavailable truth (FORBIDDEN-09). The four cases:

| Case | Condition | Map behaviour | Chrome |
|------|-----------|---------------|--------|
| **A** | Identity unknown at `TC` | `IF_render = ∅`; target not rendered; aperture closes to the deepest lineage level that exists in `K(TC)` | Generic return affordance only; **no future name** (frozen Stage 5.3 knowledge-gating) |
| **B** | Identity known; inspected **appearance** unavailable | Appearance not rendered; canonical object may remain available through other legitimate contexts; **no automatic substitution** into another context | Known canonical name may remain; unavailable context name and locus never disclosed |
| **C** | Identity/version known; inspected **version noncurrent** | Default projection shows the **then-current** version; inspection semantics and lineage identity preserved; the live version is never presented as then-current historically | Lineage switching/comparison UI is **out of scope** (Q4) |
| **D** | Available, but current depth withholds it | **Not** historical absence; normal frozen Stage 4 Semantic Zoom behaviour applies | Ordinary depth/lineage orientation |

`H-32a.` Case B's "no automatic substitution" is load-bearing: silently re-pointing inspection at another context would manufacture exactly the ownership inference `H-28b` forbids.

`H-33a.` Final message and chrome design are **not** specified here — only what `IF` *is* versus what is *renderable*.

---

## 12. Camera / orientation contract

`H-34.` **`MC` is orthogonal to `TC`.** A change of historical projection MUST NOT move the camera by itself — not position, not scale, not depth (unless a separate frozen navigation rule changes depth).

`H-35a.` If the selected projection makes the viewport sparse or empty: preserve the camera; do not recenter; do not auto-zoom; do not fabricate placeholders; do not treat sparsity as an error state. A sparse historical viewport is a **correct** rendering of a **true** projection (AT-14, FORBIDDEN-10).

`H-36a.` Camera movement remains available only through separately entitled navigation actions under the frozen Stage 5.2 rules (explicit one-shot locate entitlement, legitimate locus). Projection changes and navigation actions remain distinct causes.

---

## 13. Semantic-depth distinction

`H-35.` **Temporally unavailable** and **temporally available but depth-withheld** are different states on different axes and MUST NOT share one semantic state (`H-02`, gate ordering).

`H-36.` **The operational test — depth-invariance vs depth-monotonicity:**

- `UNAVAILABLE_AT_TC` (gates 1–3 failed) ⇒ absent at **every** depth. Deepening the zoom never reveals it.
- `AVAILABLE_BUT_DEPTH_WITHHELD` (gate 4 only) ⇒ absent at this depth, present at **some deeper** depth. Deepening the zoom reveals it.

This makes the distinction checkable rather than merely asserted: resolve the same target at successive depths and observe whether the outcome can change.

`H-37.` **Deeper zoom reveals already-legitimate content; it never creates.** Formally, changing depth may move a target only between `AVAILABLE_BUT_DEPTH_WITHHELD` and `AVAILABLE_AND_RENDERABLE`; it can never change the outcome of gates 1–3.

`H-38.` The depth distinction is carried by the **disclosure model and its frozen lineage/aperture affordances**, never by a per-object marker on the withheld object — such a marker would itself be a presence signal at a depth that does not disclose the object (§2.6).

---

## 14. Source / Provenance contract

`H-39.` At Source/Provenance depth, historical lineage **may** expose known noncurrent versions where legitimate, because knowledge persists.

`H-40.` Requirements: version identity is preserved; current versus noncurrent status is truthful **relative to the selected projection**, not to Live; supersession does not erase earlier provenance; provenance retrieval does **not** force simultaneous clutter at higher Map depths; and later provenance never leaks into an earlier `K(TC)` before its knowledge boundary.

`H-41.` Provenance describes what has already happened (§2.2). A provenance view at historical `TC` shows the lineage **as it stood at `TC`** — it does not import later revisions.

`H-42.` No comparison interface is designed here (Q4 — out of scope).

---

## 15. Preview / settle truth constraints

Stage 5.2's Preview grammar is **not** reopened. Stage 5.4 states Map-truth constraints only.

`H-43.` **During active Preview:** any preview Map projection remains within the frozen Stage 5.2 preview envelope; it MUST NOT expose future-unavailable analytical detail beyond that envelope; and it MUST NOT mutate authoritative `TM`, `TC`, `RH`, `IF_ref` or `MC`.

`H-44.` **Settle-equality invariant.** At settle, the authoritative Map state **exactly equals** `Resolve` applied over the final `K(TC)` for every target — no stale object, version, relation, appearance or lifecycle state from any intermediate Preview may remain, regardless of how many intermediate positions were traversed (AT-20, X-15).

`H-45.` No motion, fade, transition duration or sequencing is defined (FORBIDDEN-12; OPEN-10 remains deferred).

---

## 16. Mobile / narrow contract

`H-46.` The same `TC` MUST resolve to the same canonical identity, knowledge, version, lifecycle state and context legitimacy on every projection. **Truth is device-invariant.**

`H-47.` Narrow projections may disclose fewer targets simultaneously, under the frozen disclosure constraints — that is a *depth/simultaneity* difference (gate 4), never a temporal one (gates 1–3).

`H-48.` A narrow projection MUST NOT: use different historical truth; move Home loci; create canonical reflow; retain future objects that the wide surface excludes; or hide historically required state in a way that changes meaning. Accessibility parity from the frozen Stage 5.3 contract applies identically here.

---

## 17. Adversarial findings

Verdict scale, chosen to permit failure: **PASS** · **PASS-WITH-FINDING** (resolves, and surfaces something a reviewer must see) · **PASS-WITH-OPEN** (resolves, but a declared OPEN affects the surface) · **FAIL**.

### 17.1 Findings surfaced during execution

- **`F-01` — Compaction is prevented by construction, not by rule.** `pos(e) = f(e)` means no other entity's position ever reads the projection's membership. Most of the "forbidden relayout" family is therefore a *consequence*, not a separate prohibition to police. The residual risk is entirely at presentation level (clustering, alignment, emphasis), which is why `H-25a` names those explicitly.
- **`F-02` — Neighbourhood expression legitimately varies with `TC`.** A Thread reads sparser historically. This is not compaction (locus fixed, place family unchanged), but it must not be sized from future content, and it must not be frozen either — freezing it would leak future volume. §7.3.
- **`F-03` — A distinguishable absence is a disclosure.** If not-yet-known absence looked different from any other absence, the difference would itself announce the future object. Hence uniform, reason-free rendered absence (`H-10`) with a rich internal vocabulary behind it. AT-22 is satisfied by presence-vs-absence, not by absence-flavour.
- **`F-04` — Depth withholding needs a *behavioural* test, not a marker.** Any per-object "more here" hint at a non-disclosing depth is itself a presence signal. The distinction is carried by depth-monotonicity plus the frozen aperture/lineage affordances (`H-36`, `H-38`).
- **`F-05` — RULING-03 inspection result.** `PREVALID` is **unreachable** for analysis-derived versions (`KF == VF` by construction) and **undetermined — flagged, not invented** for world-fact validity. AT-12's premise consequently does not arise for Readings. §3.3, §10.3.
- **`F-06` — Half-open intervals remove a whole class of boundary bugs.** `[VF, VT)` makes "then-current" total and unique; without it, the supersession instant would admit either two current versions or none.
- **`F-07` — `IF` had to be split.** Without separating `IF_ref` from `IF_render`, either Exact Return stops being exact or the Map renders unavailable truth. The split is what satisfies both AT-10 and FORBIDDEN-09 simultaneously.

### 17.2 Binding acceptance tests AT-01…AT-24

| # | Attack | Behaviour under this contract | Verdict |
|---|--------|-------------------------------|---------|
| AT-01 | Future Thread absent, geography stable | `KF(B) > TC` ⇒ `UNKNOWN_AT_TC`, absent with no label/ghost/target (`H-20`); other loci cannot move because `pos(e) = f(e)` (`H-09`, `H-21`) | PASS |
| AT-02 | No future-shaped hole | Emptiness is a residue, never a construct; derivation test — nothing about the empty region may be computed from or marked because of an entity outside `K(TC)` (`H-22`) | PASS |
| AT-03 | Dormant Thread persists | Same identity, same Home locus, then-valid `ESTABLISHED_DORMANT`, present (`H-17`) | PASS |
| AT-04 | Reopened retains identity | `ESTABLISHED_REOPENED`, same identity and locus, no second Thread (`H-18`) | PASS |
| AT-05 | Emerging pre-geographic | Home locus exists only from establishment onward (`H-14`); no backward borrowing, no anticipatory slot; frozen Stage 3 representation preserved, nothing invented (RULING-01, `H-11`…`H-13`) | PASS |
| AT-06 | Relation later than endpoints | `KF(R) > TC` ⇒ relation absent; endpoints keep only their own geography; no connector or proximity implication (`H-25a`, `H-26`) | PASS |
| AT-07 | Contextual appearance later | Appearance gated by its own `KF(a)`; M remains available via Family; Ahmed appearance absent; no ownership inference (`H-28`, `H-28b`) | PASS |
| AT-08 | Reading supersession | `[VF, VT)` gives exactly one then-current version: R1 at `TC=70`, R2 at `TC=110`; R1 retained as lineage, not rendered beside R2, retrievable at SRC (`H-07`, `H-25`) | PASS |
| AT-09 | Confidence does not leak backward | Confidence is a versioned property; only then-valid confidence, only where depth entitles; never geometric (RULING-02, `H-30`…`H-33`, class 9) | PASS |
| AT-10 | `IF` identity unknown after backward jump | `IF_render = ∅`; R2 not rendered and not named; `IF_ref` retained opaquely in `RH` (`H-30`, `H-31` Case A) | PASS |
| AT-11 | `IF` known, context unavailable | Appearance absent; canonical object may remain legitimate elsewhere; no substitution, no future context name or locus (`H-31` Case B, `H-29b`) | PASS |
| AT-12 | `IF` version not then-current | Case C preserves inspection semantics while the default projection stays then-current. **Ontology finding:** the stated combination requires `KF(R2) ≤ TC < VF(R2)`, which is **unreachable for analysis-derived versions** — flagged per RULING-03 step 2, not invented (`F-05`, `H-08a`) | PASS-WITH-FINDING |
| AT-13 | Semantic-depth withholding | Gate 4 runs last, so this state is reachable only after all temporal gates pass; distinguished operationally by depth-monotonicity (`H-02`, `H-36`) | PASS |
| AT-14 | Sparse historical viewport | Camera preserved; no recentering, auto-zoom, placeholders or error framing; sparsity is correct (`H-34`, `H-35a`) | PASS |
| AT-15 | Return to World at historical `TC` | World-level orientation resolves over the same `K(TC)`; `TM/TC` unchanged; no switch to Live; no relayout (`H-09`, `H-34`) | PASS |
| AT-16 | Direct spatial jump historical | If the target resolves `AVAILABLE_AND_RENDERABLE` in `K(TC)`, Stage 5.2's entitled spatial navigation proceeds and `TC` is untouched; if unavailable, no fabricated landing and no silent temporal jump (`H-34`, `H-36a`) | PASS |
| AT-17 | Cross-context identity | One identity, two legitimate appearances if both are entitled; no duplicate canonical object; no relation manufactured between contexts (`H-27a`, `H-01`) | PASS |
| AT-18 | Historical version provenance | Noncurrent versions retrievable at SRC; status truthful relative to the selected projection; no higher-depth clutter; no later provenance imported (`H-39`…`H-41`) | PASS |
| AT-19 | Mobile parity | Same resolution outcomes; only gate-4 simultaneity differs; no reflow, no device-only future objects (`H-46`…`H-48`) | PASS |
| AT-20 | Rapid temporal movement | Settle-equality invariant: authoritative Map equals `Resolve` over final `K(TC)`; no intermediate residue (`H-44`) | PASS |
| AT-21 | Absence is not falsity | Absence is uniform and reason-free (`H-10`); supersession is revision, not judgement (`H-26b`); nothing implies false, rejected, low-confidence or deleted | PASS |
| AT-22 | Not-known vs known-dormant | Categorically different: dormant is **present with state** at its locus; unknown is **not present**. The difference is presence, not absence-flavour (`H-17`, `F-03`) | PASS |
| AT-23 | Historical correction does not rewrite earlier truth | Knowledge is append-only (§2.1); at `t1`, `R1` resolves then-current and is not marked with later knowledge (`H-30a`) | PASS |
| AT-24 | Geometry cannot hint future relation | `pos(A)`, `pos(B)` are independent of the relation set at every `TC` (proof in §8); presentation-level substitutes forbidden explicitly (`H-25a`) | PASS |

### 17.3 Additional required attacks X-01…X-16

| # | Attack | Response | Verdict |
|---|--------|----------|---------|
| X-01 | Future-shaped empty area inferred from a not-yet-known Thread | `H-22` derivation test; `H-09` makes surrounding geography independent of B entirely | PASS |
| X-02 | Dormant Thread incorrectly removed | `H-17`: present, same identity, same locus, then-valid dormant state; removal would assert non-existence of something demonstrably known | PASS |
| X-03 | Reopened Thread duplicated | `H-18`: one identity, one locus, state change only | PASS |
| X-04 | Relation geometry leaking before `KF(R)` | `H-25a` + the §8 proof; no connector, pull, alignment, grouping or proximity | PASS |
| X-05 | Contextual appearance turning into ownership | `H-28b`; appearance is a perspective on one referent, never a claim on it | PASS |
| X-06 | Later confidence leaking backward | RULING-02 + version gate: only then-valid confidence; never today's; never geometric | PASS |
| X-07 | Superseded lineage deleted | `H-25`, `H-26b`: revision retains the revised entity; SRC retrieval preserved | PASS |
| X-08 | All lineage versions rendered simultaneously | `H-08`, `H-15`: default rendering resolves from then-valid state only; lineage is retrievable, not ambient | PASS |
| X-09 | `IF` kept visible despite unknown identity | `H-30`/`H-31` Case A: `IF_ref` is opaque and confers no rendering authority | PASS |
| X-10 | `IF` silently substituted into another context | `H-31` Case B + `H-32a`: substitution would manufacture ownership; forbidden | PASS |
| X-11 | Camera recenters to hide sparse historical truth | `H-34`, `H-35a`: `MC` orthogonal to `TC`; sparsity is a correct rendering | PASS |
| X-12 | Depth-withholding mistaken for temporal absence | `H-36` depth-monotonicity vs depth-invariance; `H-37` deeper zoom never creates | PASS |
| X-13 | Pre-geographic Emerging borrowing later Home locus | `H-14` scoping + `H-12`/`H-13`: the locus does not exist before establishment, so there is nothing to borrow | PASS |
| X-14 | Mobile projection producing different historical truth | `H-46`…`H-48`: gates 1–3 are device-invariant; only gate 4 differs | PASS |
| X-15 | Rapid preview leaving stale later version after settle | `H-44` settle-equality invariant | PASS |
| X-16 | Absence interpreted as false / deleted / rejected | `H-10` uniform reason-free absence; `H-26b` supersession is not judgement; absence carries no evaluative content | PASS |

### 17.4 Honest summary

Twenty-four binding tests and sixteen required attacks were evaluated on a scale that permits FAIL. **No FAIL was found.** One test is **PASS-WITH-FINDING** (AT-12, whose premise is unreachable for analysis-derived versions — reported, not engineered around). The nearest misses are recorded rather than smoothed: neighbourhood-expression variation (`F-02`) could be mistaken for relayout in either direction, and the uniformity of rendered absence (`F-03`) is a constraint reviewers may find counter-intuitive precisely because it forbids helpful-seeming explanation.

**No contradiction with any frozen rule was encountered**, so no STOP condition arose.

---

## 18. Recommended Stage 5.4 contract

### MUST

1. `H-01` Resolve per target triple `(entity, appearance, version)`, never per object.
2. `H-02`/`H-03` Apply gates in order — knowledge → context → validity → depth — with the depth gate last and non-temporal.
3. `H-05` Keep presence, default renderability and retrievability as three separate outputs.
4. `H-06`/`H-07` Treat knowledge as monotonic and persistent; define version validity as half-open `[VF, VT)` yielding exactly one then-current version.
5. `H-08` Resolve default rendering from then-valid state, never from existence in lineage.
6. `H-09` Compute canonical position as `f(entity, establishment)` only — never from the set present at `TC`.
7. `H-10` Render every failed-temporal-gate outcome as uniform, reason-free absence.
8. `H-14` Scope Home-locus persistence to establishment-onward; never retroactive.
9. `H-11`…`H-13` Preserve the frozen Emerging representation as non-established, non-owning, non-locating, and valid only while Emerging is legitimate.
10. `H-17`/`H-18` Render Dormant and Reopened as the same identity at the same locus with then-valid state.
11. `H-22` Apply the derivation test to empty space.
12. `H-25a`/`H-26` Withhold all relation geometry and every presentation-level substitute before `KF(R)`.
13. `H-28`/`H-28b`/`H-29` Gate each appearance by its own `KF(a)`; preserve identity through other legitimate paths; never infer ownership.
14. `H-25`/`H-26b` Retain superseded lineage as revision, retrievable at Source/Provenance, not rendered beside the current version by default.
15. `H-30`/`H-31` Split `IF` into `IF_ref` and `IF_render`; re-resolve rendering every projection change; handle Cases A–D as specified.
16. `H-34`/`H-35a` Keep `MC` orthogonal to `TC`; preserve the camera through sparse projections.
17. `H-36`/`H-37` Enforce depth-invariance for temporal unavailability and depth-monotonicity for depth withholding.
18. `H-39`…`H-41` Keep provenance truthful to the selected projection and free of later imports.
19. `H-43`/`H-44` Constrain Preview to the frozen envelope and enforce settle-equality.
20. `H-46`…`H-48` Keep historical truth device-invariant.
21. RULING-02: expose only then-valid confidence, at entitled depth, never as geometry.

### MUST NOT

1. Compact, recenter, rearrange, or produce an alternate historical map or device-specific canonical reflow.
2. Render a ghost, placeholder, faded outline, dashed node, empty clickable target, future label, anchor, or deliberately shaped hole for anything outside `K(TC)`.
3. Let geometry, spacing, proximity, clustering, alignment or emphasis imply relation, ownership, importance, confidence or future emergence.
4. Delete superseded canonical lineage, or treat supersession as falsity, rejection or deletion.
5. Render all known historical versions simultaneously by default.
6. Remove a dormant Thread, or render it as though unknown.
7. Create a second Thread identity or locus on reopening.
8. Treat a contextual appearance as canonical ownership, or substitute another context automatically when one becomes unavailable.
9. Render a future-unavailable target because `RH` retains an inspection reference, or expose its name.
10. Move the camera because the projection changed; recenter, auto-zoom or fabricate placeholders to avoid sparsity; or treat sparsity as an error.
11. Distinguish one kind of absence from another in the rendered surface, or annotate an absence with its reason.
12. Mark a per-object "more here" hint at a depth that does not disclose the object.
13. Let deeper zoom change any temporal gate outcome, or let a projection change appear to create objects.
14. Size or shape Neighbourhood expression using content outside `K(TC)`.
15. Borrow a future Home locus backward, or give an Emerging focus a canonical position claim.
16. Leak later confidence backward, or let confidence alter geometry, distance, size, locus or spatial importance.
17. Retain any intermediate Preview state after settle.
18. Reopen Stage 5.2 or 5.3 navigation, Preview, or Timeline disclosure rules.
19. Freeze final motion, colour, typography, iconography, or transition behaviour.
20. Invent a new canonical object class, a new user-facing label, or a `PREVALID` semantics not established upstream.

### SHOULD

1. Treat the resolution states as internal architecture and name them differently in any later user-facing work.
2. Route a request for something unavailable at `TC` back through explicit temporal navigation rather than through Map substitution.
3. Prefer absence over any explanatory placeholder wherever a target fails a temporal gate.
4. Express Neighbourhood expression variation as a consequence of then-legitimate content rather than as a designed historical style.
5. Keep provenance retrieval a deliberate depth transition rather than an ambient disclosure.

### MAY

1. Preserve the frozen Emerging representation under `H-11`…`H-13`.
2. Expose known noncurrent versions at Source/Provenance depth where legitimate (`H-39`).
3. Let Neighbourhood expression read sparser at historical `TC` (`H-23`).
4. Retain the `PREVALID` substate as an unreachable-but-defined state pending Architecture's ruling on world-fact validity.

### OPEN

See §22. Three new Stage-5.4-specific OPEN items are proposed, each requiring later visual evidence.

---

## 19. Proof Board A — Historical Projection Across One Fixed World

`boards/S5.4_A_Historical_Projection_One_Fixed_World_CANDIDATE.png` (source `.html` alongside).

The same canonical geography at four temporal positions plus two version panels and a camera panel, proving: **truth changes; geography does not.** Panels show `TC=30` (before Thread B's establishment — B absent, no hole), `TC=75` (B established/active, relation now legitimate), `TC=90` (Thread A dormant — present, same locus), `TC=130` (A reopened — same identity, no duplicate); the relation absent-then-present pair; the R1-then-current → R2-current pair; and a manual camera held stable across a sparse historical projection. A locus registry strip prints the identical coordinates under every panel, so the invariance is checkable rather than merely visible.

Scaffolding only. Nothing visual is proposed.

## 20. Proof Board B — Historical Projection Adversarial Stress

`boards/S5.4_B_Historical_Projection_Adversarial_Stress_CANDIDATE.png` (source `.html` alongside).

Sixteen cells, X-01…X-16, each pairing the forbidden form (✘) with the contract's response (✔): unknown vs dormant, no future-shaped hole, the Emerging guard, the relation-geometry firewall, appearance availability, superseded lineage without clutter, the three `IF` cases, depth-withheld vs temporally unavailable, historical confidence correctness, mobile parity, no camera rescue, and absence ≠ falsity. Verdicts are printed per cell on a scale that permits FAIL.

Scaffolding only. No final styling or motion.

---

## 21. AT-01…AT-24 traceability matrix

| AT | Rules that carry it | § |
|----|---------------------|---|
| AT-01 | `H-09`, `H-20`, `H-21` | 3.4, 7 |
| AT-02 | `H-22` | 7 |
| AT-03 | `H-17` | 6.2 |
| AT-04 | `H-18` | 6.2 |
| AT-05 | `H-11`…`H-14` (RULING-01) | 6.1 |
| AT-06 | `H-25a`, `H-26`, `H-09` | 8 |
| AT-07 | `H-28`, `H-29`, `H-28b` | 9 |
| AT-08 | `H-07`, `H-25` | 3.3, 10 |
| AT-09 | RULING-02, `H-30`…`H-33`, class 9 | 5 |
| AT-10 | `H-30`, `H-31` A | 11 |
| AT-11 | `H-31` B, `H-29b`, `H-32a` | 11, 9 |
| AT-12 | `H-31` C, `H-08a`, `F-05` | 11, 3.3 |
| AT-13 | `H-02`, `H-35`, `H-36` | 3.2, 13 |
| AT-14 | `H-34`, `H-35a` | 12 |
| AT-15 | `H-09`, `H-34` | 3.4, 12 |
| AT-16 | `H-34`, `H-36a` | 12 |
| AT-17 | `H-27a`, `H-01` | 9, 3.1 |
| AT-18 | `H-39`…`H-41` | 14 |
| AT-19 | `H-46`…`H-48` | 16 |
| AT-20 | `H-44` | 15 |
| AT-21 | `H-10`, `H-26b` | 3.4, 10 |
| AT-22 | `H-17`, `H-10`, `F-03` | 6.2, 4.3 |
| AT-23 | `H-30a`, §2.1 | 10.1 |
| AT-24 | `H-09`, `H-25a`, §8 proof | 8 |

---

## 22. Remaining OPEN items

### Inherited — all preserved as DEFER, untouched

OPEN-02 (P3a affordance vocabulary) · OPEN-06 (in-session bookmarks) · OPEN-08 (coarse-step granularity) · OPEN-09 (object-originated jump involving version-validity semantics — border named at §10.3, not crossed) · OPEN-10 (motion) · OPEN-12 (Live-Edge vs latest-Moment affordance) · OPEN-13 (Timeline axis metric) · OPEN-14 (Timeline aggregate encoding).

### Newly proposed — Stage-5.4-specific, each requiring later visual evidence

| ID | Question | Why it cannot be settled here | Suggested owner |
|----|----------|-------------------------------|-----------------|
| **OPEN-15** | **Lifecycle-state legibility.** How `ESTABLISHED_ACTIVE`, `ESTABLISHED_DORMANT` and `ESTABLISHED_REOPENED` are made perceptually distinct — and how `EMERGING_PREGEOGRAPHIC` reads as non-locating — without any of them reading as absence or as a different identity. | The semantic requirement is frozen here (`H-17`, `H-18`, `H-11`…`H-13`); the encoding depends on material behaviour in the frozen Living Field and cannot be chosen without visual testing. Freezing it now would breach FORBIDDEN-12. | Experience |
| **OPEN-16** | **Sparse-projection orientation.** How a legitimately sparse historical viewport communicates "historical and correct" rather than "empty because something failed", given that no placeholder, camera rescue or per-object explanation is permitted. | The prohibitions are settled (`H-35a`, `H-10`); what remains is which non-fabricating orientation cue suffices, which needs evidence at real density and on narrow projections. | Experience + Architecture |
| **OPEN-17** | **Neighbourhood-expression variation bounds.** How much a Thread's field may legitimately vary with `TC` before the variation reads as movement of the place rather than as a change of content. | `H-23`/`H-24` fix the *rule* (expression follows then-legitimate content; never sized from future content); the perceptual threshold between "same place, less content" and "the place moved" is a visual question. | Experience |

No inherited item was resolved, and no new item substitutes for one.

---

## 23. Architecture Review Handoff

**What is being asked of review.** Attack the resolution model, not the boards' aesthetics. The decision index (top of this document) lists the twelve load-bearing claims; each is stated so it can be falsified.

Suggested attack order:

1. **Attack `pos(e) = f(e)`.** Find any legitimate case where canonical position must depend on what is present at `TC`. If one exists, `H-09` — and with it AT-01/02/06/24 — needs rework rather than restatement.
2. **Attack the gate ordering.** Construct a target that should be depth-withheld *and* temporally unavailable in a way the ordering mishandles, or a case where the depth gate must run earlier.
3. **Attack uniform absence (`H-10`, `F-03`).** Decide whether a reason-free absence is acceptable product behaviour; if not, the alternative must be found without letting the reason disclose the future.
4. **Attack the `IF` split.** Try to construct a case where `IF_ref`'s existence forces something onto the rendered surface, or where Case B's no-substitution rule strands the user with no legitimate path.
5. **Rule on `F-05`.** Confirm whether world-fact forward validity exists in the frozen ontology; if it does, `PREVALID` becomes reachable and §10.3 activates.
6. **Rule on `F-02`/OPEN-17.** Confirm that Neighbourhood-expression variation with `TC` is legitimate and correctly bounded.
7. **Verify no deferred item moved.** OPEN-02/06/08/09/10/12/13/14 should be untouched; check §10.3's border with OPEN-09 in particular.
8. **Check the settle-equality invariant (`H-44`)** against any sequence of Preview and commits.

**Upstream freezes touched and confirmed untouched.** Stage 3's persistent world, Home loci, state-modifies-identity rule, Emerging pre-geographic state, epistemic families, and the prohibition on geometry manufacturing meaning; Stage 4's Semantic Zoom lineage, camera preservation, no-hijack, no-silent-ownership, exact return and device rules; Stage 5.1's `S`, temporal facts, `K(t)` rules and restoration semantics; Stage 5.2's navigation grammar and Preview envelope; Stage 5.3's Timeline disclosure boundary, post-`TC` firewall, addressing rule, accessibility parity and Live-meta bound.

**Deliberately absent.** Replay; final motion, colour, typography, iconography, transition behaviour; lineage-comparison UI; runtime architecture, renderer, schema, coding strategy; any repository change; any resolution of deferred OPEN items.

**Status.** Stage 5.4 is **not** declared complete or frozen. Returned for Product / Experience / Architecture review.
