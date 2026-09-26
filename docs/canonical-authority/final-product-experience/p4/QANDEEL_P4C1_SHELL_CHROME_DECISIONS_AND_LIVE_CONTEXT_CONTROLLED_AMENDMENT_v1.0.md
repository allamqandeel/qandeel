# QANDEEL — P4-C1 Shell / Chrome Product Decisions + Live Context Controlled Amendment v1.0

**Status:** `CANONICAL PRODUCT DECISION RECORD / CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`
**Date:** 2026-09-27
**Track:** P4 — Remaining Product / Visual Gaps Census & Closure
**Evidence:** [P4-C comparative proof](../../../design/p4-shell/QANDEEL_P4-C_SHELL_CHROME_INTEGRATED_DECISION_PROOF/P4C_READ_FIRST.md) at pre-decision proof head `65fc05e4c5f37ee4936956f187585a4044e059e6`
**Scope:** `P4-DQ-01` … `P4-DQ-04` only, plus the narrow retirement of the dedicated Live Context Product surface and the preservation/re-ownership of contextual relevance as a future runtime-backed capability.
**P4 lifecycle:** **P4 remains ACTIVE, NOT CLOSED / NOT FROZEN.**

---

## 1. Product Owner decisions

The P4-C proof compared candidates and decided nothing. The Product Owner reviewed those candidates and selected the following.

| Decision | Frozen Product decision | Evidence candidate |
|---|---|---|
| `P4-DQ-01` — General Settings entry | The one General Settings destination remains global in scope, but its **entry is reached from Personal QANDEEL's own surface**. It is not a persistent upper-chrome utility. | **S-B** |
| `P4-DQ-02` — QANDEEL Understanding entry | **QANDEEL Understanding / «فهم قنديل» is a persistent Personal-QANDEEL row beneath the upper chrome.** It is not moved into General Settings and is not promoted beside the Conversation / Analysis control. | **U-A** |
| `P4-DQ-03` — canonical Q | **No persistent shell Q.** The canonical Q appears only at named identity moments. The normal QANDEEL conversation opening is an identity moment; the already-frozen Matching attention moment remains one. This decision does **not** answer `P4-DQ-06` launch / splash / gateway composition. | **Q-A** |
| `P4-DQ-04A` — Global Switcher form | The Global Switcher uses the **Keyed Seam** container treatment, consuming the already-frozen P2 / E1R selected-state language without inventing a new state channel. | **SW-3** |
| `P4-DQ-04B` — «سياق الكلام» | **The dedicated Live Context / «سياق الكلام» Product surface, entry control, drawer/panel and empty-state UI are retired from the canonical Product shell. There is no placement to choose.** | X-A / X-B / X-C are all retired as Product candidates |

These decisions bind on merge of the change that carries this record.

---

## 2. General Settings remains global even though its entry is Personal-rooted

Selecting S-B changes **placement**, not authority or scope.

General Settings remains the one application-wide destination for account, privacy, appearance, notifications and other settings already owned by P1 / P3. The Personal-QANDEEL placement MUST NOT be interpreted as creating a second "QANDEEL-only settings" destination.

A user in another World may need to return to Personal QANDEEL before entering General Settings. That navigation cost is an accepted consequence of this Product decision; it is not a reason to re-add a persistent settings glyph to the upper chrome.

---

## 3. Exact Live Context retirement

The old Live Context idea is retired as a **dedicated Product surface**. This amendment does not erase the historical Phase V / VI evidence; it narrows what remains current.

The following older statements no longer bind as requirements to ship a dedicated Live Context surface:

- Phase V V10 A17: "Live Context is adjacent, lightweight and bounded";
- Phase V's "Live Context final form" open item and any surface-specific boundary/placement requirement;
- VI-01 S03 (`Live Context` / «سياق الكلام»), A01 (Open Live Context), A02 (Close Live Context), T13 (Empty Live Context), and Live-Context-specific exposure of A03 / A04 / A08;
- G3 §G's open Product placement question for «سياق الكلام»;
- `P4-GAP-005` as a placement problem.

Those records remain historical and byte-identical. This later amendment binds in the named scope.

No replacement drawer, sheet, page, popover or hidden equivalent is authorized by this record.

---

## 4. What is explicitly preserved

Retiring the surface MUST NOT be misread as deleting the capabilities underneath it.

Preserved unchanged:

1. **Explicit Session Context Activation** for exact user-owned `GOAL / SITUATION / DECISION / RELATIONSHIP` targets. The user's explicit activation remains the authority; QANDEEL may not silently infer or auto-bind one from conversation content.
2. **Effective Live Focus** — the production semantic chain's current conversational attention (`NONE / EMERGING / THREAD`). Live Focus is attention, not importance, rank, confidence or a generic item-relevance score.
3. Existing Memory, Human Intelligence, Hypothesis / Recommendation and Question foreground lanes and the integrated provider-context budget.
4. The Living Analysis World, temporal truth and its current navigation / return semantics.
5. Phase V A15's non-equivalence law and A23's accessibility requirement.

This amendment creates no new runtime endpoint, model call, database table, provider selection, scoring algorithm or production UI.

---

## 5. Contextual Relevance survives; its old surface scope does not

Phase V A22 identified a legitimate future semantic:

> relatedness to what the current conversation is about right now.

That semantic is **not deleted**.

What is superseded is A22's phrase **"scoped to Live Context"**. A dedicated Live Context surface no longer owns the capability.

The surviving Product law is:

- contextual relevance is allowed only when backed by an explicit runtime contract;
- it is not importance, truth, confidence, evidence strength, priority, rank, certainty or correctness;
- absence of a relevance signal is absence, never a fabricated neutral/default score;
- any spatial expression must have a non-spatial accessible equivalent and reduced-motion parity;
- explicit user-owned Context Activation remains explicit and may not be replaced by inferred relevance.

Until a runtime contract exists, production UI MUST NOT claim system-driven item-level contextual relevance or move/recompose analytical material as though that signal existed.

---

## 6. Newly recorded runtime / architecture gap — P4-GAP-065

Repository review during the Product decision found that current QANDEEL has strong adjacent capabilities but no single runtime/client contract for **item-level conversational relevance** across the material that may appear in the Living Analysis World.

What exists today is intentionally different:

- T-03D **Live Focus** identifies current conversational attention as an Emerging Focus or Thread;
- explicit Session Context Activation binds user-chosen Goal / Situation / Decision / Relationship contexts;
- Memory retrieval is a bounded retrieval mechanism, not the canonical cross-domain relevance authority;
- HIM, Hypothesis / Recommendation and Question lanes feed provider context under their own authority;
- the Living Analysis client consumes disclosed analytical truth, but has no client-readable general "this object is more/less related to the conversation now" signal.

Therefore P4 admits one owned cross-task obligation:

> **`QAN-BL-CTX-01` — Runtime-backed Conversational Relevance**

Owner task:

> **`QAN-CTX-01 — Conversational Relevance Runtime`**

The future task must define the runtime authority and integration boundary before any Product behavior claims contextual-relevance-driven world recomposition or item-level relevance behavior. The backlog entry is not executable authority by itself.

---

## 7. Narrow supersession map

| Earlier authority / open item | P4-C1 effect |
|---|---|
| V10 A17 dedicated Live Context surface law | **SUPERSEDED** — no dedicated Live Context Product surface |
| V10 A22 "scoped to Live Context" | **NARROWLY AMENDED** — contextual relevance remains reserved, but is no longer owned by a dedicated Live Context surface |
| V10 A15 non-equivalence law | **PRESERVED** |
| V10 A23 accessibility law | **PRESERVED** for any future contextual relevance expression |
| VI-01 S03 / A01 / A02 / T13 Live Context vocabulary | **RETIRED FROM CURRENT PRODUCT VOCABULARY** |
| VI-01 A03 / A04 / A08 | **NO CURRENT LIVE-CONTEXT SURFACE EXPOSURE**; no new placement is invented |
| G3 §G «سياق الكلام» placement | **RESOLVED BY DELETION OF THE DEDICATED SURFACE** |
| P4-GAP-005 | **RESOLVED / SUPERSEDED** |
| Explicit Context Activation runtime | **UNCHANGED / PRESERVED** |
| T-03D Live Focus | **UNCHANGED / PRESERVED** |

---

## 8. What this record does not decide

This record does **not**:

- close P4;
- ratify I-08B2.5 (`P4-DQ-05`);
- decide launch / splash / gateway (`P4-DQ-06`);
- decide undrawn-screen scope (`P4-DQ-07`);
- decide Voice visual language (`P4-DQ-08`);
- close residual copy (`P4-DQ-09`);
- decide APP-OPS-01 rows `P4-DQ-11` … `17`;
- design or implement `QAN-CTX-01`;
- invent a relevance score, threshold, rank, embedding policy or model/provider;
- delete or weaken explicit Context Activation, Memory, HIM, Hypothesis, Recommendation, Question, Live Focus, Safety or world-scoped authority.

---

## 9. Effective state on merge

On merge:

- `P4-DQ-01`, `02`, `03`, `04` become resolved records;
- `P4-GAP-001` … `005` no longer require a P4 decision;
- the dedicated Live Context / «سياق الكلام» surface is not part of the canonical Product shell;
- contextual relevance remains an important runtime-backed future capability, now tracked as `P4-GAP-065` and `QAN-BL-CTX-01`;
- P4 remains **ACTIVE, NOT CLOSED / NOT FROZEN**.
