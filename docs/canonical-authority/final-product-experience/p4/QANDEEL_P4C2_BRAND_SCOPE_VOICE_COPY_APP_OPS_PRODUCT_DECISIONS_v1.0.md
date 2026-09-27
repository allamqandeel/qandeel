# QANDEEL — P4-C2 Brand / Scope / Voice / Copy / App-Ops Product Decisions v1.0

**Status:** `CANONICAL PRODUCT DECISION RECORD / CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`
**Date:** 2026-09-27
**Track:** P4 — Remaining Product / Visual Gaps Census & Closure
**Scope:** `P4-DQ-05` … `P4-DQ-09` and `P4-DQ-11` … `P4-DQ-17`
**P4 lifecycle:** **P4 remains ACTIVE, NOT CLOSED / NOT FROZEN.**

## 1. P4-DQ-05 — Brand — RESOLVED

- **I-08B2.5 is ratified as the final QANDEEL Brand Authority.**
- Keep the canonical app-icon SVG bytes unchanged; the stale pre-freeze internal comment remains only to preserve byte identity / hash. Its lifecycle meaning is superseded by this record.
- Confirm Android adaptive-icon framing at **48 dp**.
- Dedicated iOS dark / tinted app-icon variants are **not in v1** and require a later Product direction if reopened.
- No master geometry or inherited colour authority is changed.

## 2. P4-DQ-06 — Launch / splash / gateway — RESOLVED

The Product Owner selects the sequencing direction:

> **P4 closes the static launch / splash / gateway brand application before the End-to-End audit.**

The Product Owner now explicitly confirms:

> **The exceptional lantern gateway identity moment is in v1.**

P4 freezes only **presence and journey placement**. The lantern's visual design, motion design, interaction choreography, implementation technology and production proof are **not part of P4**. They are intentionally separated into a later standalone task:

> **QANDEEL — Lantern Gateway Identity Moment v1**

That future task must begin with its own research / skills / creative exploration and independent review. P4 performs none of that work and chooses no animation technology here.

## 3. P4-DQ-07 — Undrawn screens — RESOLVED

P4 does not expand into full-screen design for the never-drawn surfaces. The End-to-End Product Experience Completeness Audit owns later classification / scoped closure for General Settings, QANDEEL Understanding, sign-up, first-use Welcome, Shared / Public conversation surfaces and multi-human attribution.

## 4. P4-DQ-08 — Voice visual language — RESOLVED DIRECTION

Select **Split**.

P4 may freeze non-signal visuals:
- Voice Note representation in conversation history;
- finished-call history record;
- recording / idle / sent states whose truth does not depend on live audio levels;
- non-signal call-surface composition.

The following remain gated by `QAN-BL-VOICE-01` and MUST NOT be faked:
- live waveform;
- speaking / listening / activity morphology;
- live audio-level signals;
- runtime-dependent state wording.

The non-signal half still requires integrated AR / EN visual proof before P4 closes.

## 5. P4-DQ-09 — Residual copy — RESOLVED DISPOSITION

### Close in P4
- core Conversation / Analysis / Replay / Timeline / Live-edge wording;
- residual P3 copy on already-frozen P3 surfaces, excluding the permission-education sheet;
- P1 confidence-state wording, Settings group names and Public ID warning;
- English product-name casing: **QANDEEL**;
- confirm that the normal new-conversation opener and the First Conversation Opening are separate moments;
- write and prove the missing English normal new-conversation opener.

### Hand to End-to-End audit
- sign-in failure wording and Login ID help;
- remaining VI-01 `PROPOSED` / `OPEN` rendered-language residue;
- Matching proof lines and English Matching copy;
- P3 permission-education sheet and lower-priority journey copy.

### Runtime-gated
- Voice / call state strings remain gated by `QAN-BL-VOICE-01`.

This freezes the disposition, not unwritten copy.

## 6. P4-DQ-11 … P4-DQ-17 — APP-OPS Product Owner decisions — RESOLVED

### PO-OPS-13 — user-specific operational diagnostics
Automated per-user reliability rules may operate without human viewing. Human access to one user's operational diagnostics requires a **user-initiated support request**, scoped to that user and support purpose. No private conversation-content access is authorized. Identifier format, pseudonymization, storage/query mechanism and exact retention remain later Security / Privacy implementation choices.

### PO-OPS-14 — ratings / reviews
Company Operations may ingest aggregate app-store / marketplace ratings and public review text as published. APP-OPS-01 creates **no linkage** from a public store review to a QANDEEL account.

### PO-OPS-15 — control-state integrity
Every approved control family is **versioned and audited**. Exact TTL / expiry, signing/authentication, last-known-good / revert behavior and audit-retention duration are later Production Integration / Security design.

### PO-OPS-16 — Maintenance / Minimum Version user moments
P4 freezes the governing restriction laws only. The exact user-facing Maintenance Mode and Minimum Supported Version experiences go to the End-to-End audit.

### PO-OPS-17 — app-wide control law
CW2-08's server-canonical / fail-safe flag and launch-control laws extend app-wide to Personal conversation, Voice, Analysis and other QANDEEL capabilities, while CW2-08 remains the original authority for Connected Worlds. Disable preserves history; required unknown / unconfigured state fails safely; controls cannot manufacture privacy / ownership / consent / truth authority.

### PO-OPS-18 — Approved Remote Configuration family register
A Remote Configuration family requires **Product Owner + Architecture controlled approval**. P4 freezes no initial family set; Production Integration may propose it later.

### PO-OPS-19 — code delivery
Any new App code, whether store-delivered or through a future OTA bundle mechanism, is a **release** governed by release operations. It is not a Company → App control and cannot be generic remote execution. Whether QANDEEL ever adopts OTA code delivery remains a later release-operations decision.

## 7. Product Owner decision state

**No Product Owner decision row remains open after this record.**

P4 still has closure work — static launch / gateway proof excluding the standalone lantern animation task, non-signal Voice proof, P4-owned copy authoring/proof, APP-OPS independent review and final P4 reconciliation — but those are not additional Product Owner choices.

The standalone **QANDEEL — Lantern Gateway Identity Moment v1** task is carried forward deliberately and is not opened by this record.

This record implements no production code, schema, migration, dependency, provider choice or runtime.
