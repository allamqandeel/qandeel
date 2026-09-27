# QANDEEL — P4 Read First

**Status:** `P4-C2 SYNCHRONIZED — ONLY DQ-06 LANTERN-IN-V1 REMAINS OPEN — P4 ACTIVE, NOT CLOSED`

---

## 1. Baseline and state

| | |
|---|---|
| Repository | `allamqandeel/qandeel` |
| P4-A census baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` (pre-P4 canonical main after PR #277) |
| P4-B amendment baseline | `576b010dcf78276c982f5052cfee7dd1bcbfcbcb` (canonical main after merged PR #278) |
| P1 · P2 · P3 | `CLOSED / FROZEN`, and unchanged by P4-A |
| **P4** | **ACTIVE — census / closure track opened by P4-A. NOT CLOSED, NOT FROZEN** |
| **APP-OPS-01** | **`PRODUCT / ARCHITECTURE CONTRACT CANDIDATE — NOT FROZEN`** |
| Correction pass | applies the Product Owner's three-rule boundary: operational telemetry is **always content-free**; APP-OPS-01 creates **no Company Operations private-content receipt path**; and No Human Review is **not narrowed** to Company Operations. Re-reading CW2-08 §8 confirmed one authority conflict (`P4-DQ-10`) |
| P4-B controlled amendment | on `576b010dcf78276c982f5052cfee7dd1bcbfcbcb`, P4-B adds the [CW2-08A controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md), effective on merge. `P4-DQ-10` is resolved |
| P4-C comparative proof | the [P4-C shell / placement / small-chrome decision proof](../design/p4-shell/QANDEEL_P4-C_SHELL_CHROME_INTEGRATED_DECISION_PROOF/P4C_READ_FIRST.md) remains the evidence package. P4-C itself still decides nothing |
| **P4-C1 Product decisions / amendment** | [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) selects **S-B + U-A + Q-A + SW-3**, retires the dedicated «سياق الكلام» / Live Context Product surface, preserves Context Activation + Live Focus, and records `P4-GAP-065` / `QAN-BL-CTX-01` |
| **P4-C2 Product decisions / amendment** | [P4-C2](../canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md) resolves DQ-05, DQ-07…09 and DQ-11…17; partially resolves DQ-06 sequencing. **Only one Product Owner decision remains open: whether the lantern gateway moment is in v1.** APP-OPS Product Owner decisions are complete; independent review / P4 closure remain |
| Implementation | **none authorized.** P4-C1 changes Product authority/documentation only. It adds one owned backlog obligation (`QAN-BL-CTX-01`) but creates no runtime, schema, migration, dependency or production UI |
| End-to-End Product Experience Completeness Audit | **not started** |

---

## 2. What P4-A is for

The roadmap defines P4 as the **Remaining Product / Visual Gaps Census & Closure**: close the residual decisions the
existing Product / design canon deliberately left open, **before** the End-to-End audit walks the Product, so that
the audit does not keep stopping on already-known gaps.

P4-A is the first bounded P4 work package. It does two things:

1. **The census.** A repository-wide, authority-aware evidence table of every residual item. Each is traced through
   later amendments to its current truth and classified.
2. **APP-OPS-01.** A closure-ready Product / Architecture **contract candidate** for the QANDEEL App ↔ QANDEEL
   Company Operations relationship. It is built only from approved Product Owner decisions and from consequences
   existing frozen authority forces.

P4-A decides nothing new. Every open choice goes to the Decision Queue. P4 closes only in a later change.

---

## 3. The one cross-cutting exception

P4 is normally limited to residual decisions **inside the existing Product / visual canon**.

> **APP-OPS-01 — QANDEEL App ↔ QANDEEL Company Operations Contract** is the one explicit, Product-Owner-approved
> cross-cutting exception to that boundary, classified
> `KNOWN CROSS-CUTTING PRODUCT GAP — PRODUCT / ARCHITECTURE CLOSURE ONLY`.

It does not widen P4 into a Company-platform program. It excludes Company backend, BI, CRM, support tooling, finance,
HR, admin tooling, generic analytics and internal automation.

---

## 4. Reading order

1. **This file.**
2. [`P4_RESIDUAL_GAP_CENSUS.md`](P4_RESIDUAL_GAP_CENSUS.md) — the evidence. There are 66 rows (`APP-OPS-01` plus
   `P4-GAP-001` … `P4-GAP-065`), each with its source, later authority, current truth and classification.
3. [`APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md`](APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md) —
   the contract candidate. It has 23 sections.
4. [`P4_AUTHORITY_COMPATIBILITY_MATRIX.md`](P4_AUTHORITY_COMPATIBILITY_MATRIX.md) — APP-OPS-01 against every
   authority it touches, plus the residual-canon precedence notes. It records **no open authority conflict**: the one
   conflict P4-A found (historical CW2-08 §8 / H7 let an authorized person reach case-scoped private conversation
   content) is superseded in that narrow scope by the CW2-08A controlled amendment.
5. [`P4_PRODUCT_OWNER_DECISION_QUEUE.md`](P4_PRODUCT_OWNER_DECISION_QUEUE.md) — **one open Product Owner row**: `P4-DQ-06`, narrowed to lantern-in-v1.
6. [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) — DQ-01 … DQ-04 + contextual-relevance re-ownership.
7. [P4-C2](../canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md) — DQ-05, partial DQ-06, DQ-07 … 09 and DQ-11 … 17.
8. [`P4_CARRY_FORWARD_MATRIX.md`](P4_CARRY_FORWARD_MATRIX.md) — future work that is not a Product decision.

---

## 5. How to tell the five kinds of statement apart

| Kind | How it is marked | Where it lives | Does it bind? |
|---|---|---|---|
| **Source authority** | a link to a closed record plus its section, for example "P2 §11.1", "CW2-08 §8" | the existing canonical records. P4-A quotes them and edits none | **yes.** It is the law. P4-A changes none of it |
| **Census classification** | one of the twelve Task Contract classes, for example `P4 — VISUAL DECISION REQUIRED`, `DEPENDENCY-GATED — CANNOT CLOSE YET` | the census, "Classification" column | no. It describes where an item stands |
| **Candidate decision** | `CANDIDATE`, or the `PO-OPS-nn` rows of the APP-OPS-01 candidate §3 | the APP-OPS-01 candidate | `PO-OPS-nn` rows record decisions the Product Owner has **already made**. Everything else marked `CANDIDATE` binds nothing until a later P4 closure freezes it |
| **Unresolved decision** | `OPEN → P4-DQ-nn` | the Decision Queue | no. A "Recommended" option is advice, not a decision |
| **Future carry-forward** | a row with a named future owner and trigger | the Carry-Forward Matrix | no. Nothing there is a backlog entry or authorizes work (BG-07) |

Two further markers appear in APP-OPS-01:

- **`FORCED BY`** names existing frozen authority that already fixes a point.
- **`IMPLEMENTED TODAY`** / **`NOT IMPLEMENTED`** describe code on `main`. They are facts, not Product authority. An
  approved operational domain is not evidence that the domain is collected today.

---

## 6. What P4-A, P4-B and P4-C1 did not do

- They did not close or freeze P4, or APP-OPS-01. P4 stays **ACTIVE, NOT CLOSED / NOT FROZEN**; APP-OPS-01 stays
  **CANDIDATE / NOT FROZEN**.
- P4-A amended no authority; it recorded the CW2-08 §8 / H7 conflict in `P4-DQ-10`. P4-B resolved it only by the
  additive CW2-08A amendment. Neither edited the original CW2-08 or its provenance, and neither invented a replacement
  moderation mechanism.
- P4-A decided no open Decision Queue row beyond recording Product Owner decisions already supplied. P4-B answered no
  Decision Queue row other than resolving `P4-DQ-10`. Neither wrote new Product copy or made a prototype, screenshot
  or design board.
- None of P4-A, P4-B or P4-C1 implements production behavior or starts the End-to-End audit. P4-C1 **does** make the named Product decisions and admit `QAN-BL-CTX-01`; it does not implement that future runtime.
- P4-A did not edit the backlog, the Canonical Authority Index, the Canonical Artifact Index, or the P1, P2, P3,
  G-series, I-08A, I-08N, CW2, T-series or implementation-foundation records. P4-B edited none of these either, apart
  from adding CW2-08A and its Canonical Authority Index entry.
