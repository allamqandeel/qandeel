# QANDEEL — P4 Read First

**Status:** `P4-A — RESIDUAL GAP CENSUS + APP-OPS-01 CONTRACT CANDIDATE — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW — P4 ACTIVE, NOT CLOSED`

---

## 1. Baseline and state

| | |
|---|---|
| Repository | `allamqandeel/qandeel` |
| Canonical baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` (GitHub `main`, PR #277) |
| P1 · P2 · P3 | `CLOSED / FROZEN`, and unchanged by P4-A |
| **P4** | **ACTIVE — census / closure track opened by P4-A. NOT CLOSED, NOT FROZEN** |
| **APP-OPS-01** | **`PRODUCT / ARCHITECTURE CONTRACT CANDIDATE — NOT FROZEN`** |
| Correction pass | applies Product Owner clarification A: the Human Review prohibition belongs to Company Operations / App Operations. CW2-08's separate case-scoped Safety / Moderation authority is **preserved unchanged**. `P4-DQ-10` is resolved; **16** Product Owner decisions remain open |
| Implementation | **none authorized.** P4-A changes no code, schema, migration, dependency, workflow, backlog row or canonical authority record |
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
2. [`P4_RESIDUAL_GAP_CENSUS.md`](P4_RESIDUAL_GAP_CENSUS.md) — the evidence. There are 65 rows (`APP-OPS-01` plus
   `P4-GAP-001` … `P4-GAP-064`), each with its source, later authority, current truth and classification.
3. [`APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md`](APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md) —
   the contract candidate. It has 23 sections.
4. [`P4_AUTHORITY_COMPATIBILITY_MATRIX.md`](P4_AUTHORITY_COMPATIBILITY_MATRIX.md) — APP-OPS-01 against every
   authority it touches, plus the residual-canon precedence notes. It finds **no authority conflict after Product
   Owner clarification A**: APP-OPS-01 governs Company Operations, CW2-08 governs case-scoped Safety / Moderation.
5. [`P4_PRODUCT_OWNER_DECISION_QUEUE.md`](P4_PRODUCT_OWNER_DECISION_QUEUE.md) — the **16 open** questions only the
   Product Owner can answer: `P4-DQ-01` … `P4-DQ-09` for the residual canon, and `P4-DQ-11` … `P4-DQ-17` for
   APP-OPS-01. `P4-DQ-10` stays as a resolved record (option A / scope clarification).
6. [`P4_CARRY_FORWARD_MATRIX.md`](P4_CARRY_FORWARD_MATRIX.md) — the future work that is not a P4 decision. It
   includes the mandatory audit fields and the backlog-impact candidate.

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

## 6. What P4-A did not do

- It did not close or freeze P4, or APP-OPS-01.
- It did not amend CW2-08 or any other authority. No CW2-08 amendment is required by APP-OPS-01 (`P4-DQ-10`,
  resolved).
- It did not decide any open Decision Queue row. It only recorded the Product Owner's own resolution of `P4-DQ-10`.
  It did not write new Product copy. It made no prototype, screenshot or
  design board.
- It did not implement anything. It did not start P4-B, and it did not start the End-to-End audit.
- It did not edit the backlog, the Canonical Authority Index, the Canonical Artifact Index, or the P1, P2, P3, G-series,
  I-08A, I-08N, CW2, T-series or implementation-foundation records.
