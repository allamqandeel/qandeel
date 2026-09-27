# QANDEEL — P4-C3 Residual Visual + Copy — Product Owner Approvals v1.0

**Status:** `CANONICAL PRODUCT DECISION RECORD / CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`
**Date:** 2026-09-27
**Track:** P4 — Remaining Product / Visual Gaps Census & Closure
**Scope:** exactly four Product Owner approvals made on review of the P4-C3 residual visual + copy proof
(`docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/`), applied by the P4-C3R correction pass
**P4 lifecycle:** **P4 remains ACTIVE, NOT CLOSED / NOT FROZEN.** This record closes neither P4-C3 nor P4, and does not
freeze APP-OPS-01.

The independent review found P4-C3 **APPROVED WITH MINOR CORRECTIONS**. The Product Owner then explicitly approved the
four decisions below and nothing else. Every other `PROPOSED_FOR_PO_REVIEW` row in the P4-C3 copy table stays proposed.

## 1. Launch appearance policy (P4-C3 finding F-01 / former question Q-1) — RESOLVED

- **iOS:** the system launch screen follows the **device / system appearance**. It does not try to reproduce the in-app
  QANDEEL Dark / Light / System preference (P1 §12). A reader who chose QANDEEL Dark on a Light device may see the
  system-Light launch surface, then the app's selected Dark appearance once app-owned UI takes over. That transition is
  accepted.
- **Android:** where the platform supports it, the system splash follows the **effective QANDEEL app appearance**
  selection, through the platform-supported application night-mode mechanism.
- Dark is **not** forced universally. **No duplicate custom splash** is created.
- The launch surface itself stays as P4-C3 proved it: one World colour on iOS; the I-08B2.5 adaptive icon on the World
  colour on Android 12+; no text, delay or second splash.

## 2. QANDEEL Understanding confidence — mixed / contested

| Arabic | English |
|---|---|
| **«يوجد تعارض»** | **Mixed** |

This replaces the reviewed Arabic candidate «فيه تعارض». The wording stays neutral and factual, and uses the more formal,
stable QANDEEL register. English is unchanged. The other confidence words are not changed by this record.

## 3. Public ID one-time-change warning — English body

> This is the only time you can manually change your Public ID. After you confirm, the new ID is permanent and can’t be changed again.

The approved Arabic warning is unchanged:
«هذا هو التغيير اليدوي الوحيد المتاح لمعرّفك العام طوال عمر الحساب. بعد التأكيد يصبح المعرّف الجديد دائمًا، ولا يمكن تغييره مرة أخرى.»

No fear language, urgency, extra confirmation step or new Product behaviour is introduced. The one-change law remains
P1 §6's.

## 4. Replay — user-facing Product name (P4-C3 finding F-02) — RESOLVED BY CONTROLLED AMENDMENT

| Arabic | English |
|---|---|
| **«إعادة العرض»** | **Replay** |

- This **supersedes** the older user-facing I-08A4 naming row «عرض الجلسة» / "Session Replay"
  (`final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md`
  §8 / §9) **for this Product-facing name only**.
- The I-08A4 file is **not edited**. Its bytes stay historical and preserved. It remains authority for everything this
  record does not name.
- **No Replay runtime, media, storage, transport, export or implementation semantics change.** I-06 Replay authority
  and every Replay runtime contract are untouched.
- `QAN-BL-NAV-02` remains untouched.

## 5. What this record does not do

- It performs **no lantern research, design, animation, timing, storyboard or technology selection**. The standalone
  later task **QANDEEL — Lantern Gateway Identity Moment v1** (P4-C2 §2) is not opened.
- It approves no other P4-C3 copy row, closes no P4-C3 finding other than F-01 and F-02, and reopens no P4-C1 / P4-C2
  decision.
- It implements no production code, runtime, schema, migration or dependency.
- It does not start the End-to-End Product Experience Completeness Audit.

A later P4 final closure may summarize this record but must not silently reopen these four decisions.
