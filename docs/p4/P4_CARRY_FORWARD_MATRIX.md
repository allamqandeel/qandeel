# QANDEEL — P4 Carry-Forward Matrix

**Status:** `P4-A CARRY-FORWARD MATRIX — CANDIDATE — CREATES NO BACKLOG ITEM AND AUTHORIZES NO WORK`

| | |
|---|---|
| Track | P4, task P4-A |
| Canonical baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` |
| Role | separates **future work** from **Product decisions**. A Product decision is in the [Decision Queue](P4_PRODUCT_OWNER_DECISION_QUEUE.md). Everything here is work a later phase owns, bounded by a constraint that is already frozen or proposed |
| Governance | nothing here is a backlog entry (BG-07). §3 states the backlog-impact candidate for the later P4 closure to review under BG-06 / BG-08 |

---

## 1. The mandatory audit obligation

> **End-to-End Audit must add `Operational Events Required` and `Company Controls Required` to every relevant
> User Moment.**

This is `PO-OPS-11`, recorded in [APP-OPS-01 §19](APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md). The audit
extends the roadmap's gap matrix. It does not replace it. The extended matrix reads:

`User moment → User goal → Surface → Entry trigger → Existing Product decision → Existing implementation → Visual status → Missing decisions → Missing implementation → Operational Events Required → Company Controls Required → Owner`

The two new fields are filled inside the closed APP-OPS-01. Each uses only what the contract admits:

- **`Operational Events Required`** names events from the admitted domains (§5), never content (§6).
- **`Company Controls Required`** names controls from the seven families (§11), within §10.

The audit designs no schema and chooses no vendor. It has **not** started, and P4-A performs none of it.

---

## 2. Carry-forward rows

### 2.1 APP-OPS-01

| Carry-forward | Why not P4 | Frozen constraint (or candidate, once closed) | Future owner | Trigger / phase | Backlog disposition needed? |
|---|---|---|---|---|---|
| The two audit fields for every relevant User Moment | P4 closes Product decisions. It does not walk User Moments (Task Contract §23) | APP-OPS-01 §19; §5, §6, §11 | End-to-End Product Experience Completeness Audit | after P1–P4 close | **no.** The roadmap sequences the audit, and `PO-OPS-11` names the obligation |
| Implementation of APP-OPS-01: collectors, schemas, new outbox domains, queues, dashboards, alerting, Sentry / OTel changes, Company DB / warehouse, the control-plane service, the flag / Remote Config / kill-switch / rollout / maintenance / minimum-version / route-hold runtimes, the Command Center, RBAC, the audit log | P4 implements nothing (Task Contract §24) | APP-OPS-01 §4–§15, §20; no synchronous dependency; no content; no generic remote execution; CW2-08 §24–§29 | Production Integration | after the audit | **no.** This is later implementation of a frozen contract, and the roadmap sequences Production Integration. It is the same disposition as P2 §15 and P3 §20 |
| Control-plane authentication, control signing / integrity, freshness / TTL / last-known-good, audit retention | a security design choice that needs the audit's User Moments; `P4-DQ-13` recommends deferring it | APP-OPS-01 §10.1, §15: only a valid, authenticated, currently effective control acts; an outage is never a Kill Switch | Production Integration security design; Release Hardening validation | Production Integration | **no**, if `P4-DQ-13` is answered A. It is part of implementing the frozen contract, and not `QAN-BL-SEC-01`, which covers mobile credential storage only |
| User-diagnostic identifier format, pseudonymization, storage, query mechanism, retention duration | security / privacy implementation (`P4-DQ-11` parts 2 and 3) | `P4-DQ-11` part 1 (the access principle), once answered; no content; Least Retention | Production Integration security / privacy | Production Integration | **no** |
| Mobile crash / error reporting; mobile version adoption; call-status events; cost calculation; feature-usage events | these domains are approved but not implemented (APP-OPS-01 §5.1) | the approved domains only, content-free, non-semantic, fail-soft | Production Integration | Production Integration. Call status also needs `QAN-BL-VOICE-01` | **no** |
| The Approved Remote Configuration family register | `P4-DQ-16` recommends approval through controlled change | APP-OPS-01 §11 family 6; Foundation Freeze ceiling | Product Owner + Architecture | before any Remote Configuration exists | **no** |
| Code delivery (store / over-the-air) governance | a release-operations decision (`P4-DQ-17`) | APP-OPS-01 §12: code delivery is not a control | App Operations & Release Lead; Release Hardening | Release Hardening | **no** |
| Operational-readiness validation (observability, failure recovery) | validation, not decision | APP-OPS-01 §8, §15 | Release Hardening & Launch | Release Hardening | **no.** The roadmap §5 already names it |
| **The controlled CW2-08 amendment** (§8 / H7, and by dependency §7, §36, §44 item 5) | P4-A may not edit frozen CW2 authority (Task Contract §20, §33) | `PO-OPS-02`; APP-OPS-01 §18; `P4-DQ-10` | a controlled CW2-08 amendment task; the Product Owner opens it | before or together with APP-OPS-01 closure (APP-OPS-01 §23 item 2) | **conditional.** See §3 |

### 2.2 Residual Product / visual canon

| Carry-forward | Why not P4 | Frozen constraint | Future owner | Trigger / phase | Backlog disposition needed? |
|---|---|---|---|---|---|
| Model / Provider benchmark and selection, text and realtime / voice | the roadmap couples it to the audit, and it needs workload evidence | Model Router (provider-neutral, benchmark-driven); FAST / DEEP v2 (selection deferred); APP-OPS-01 §14 (a Route Hold is not selection) | End-to-End audit | the audit phase | **no.** The roadmap §3 owns it |
| Voice runtime dependencies: speaking indicator, native call behavior, Voice Note transcript, spoken-reply control, voice / call state strings (P4-GAP-023 … 026, 035) | they cannot close without runtime truth | P2 §11.1 (no fake signal); G1.2 §1–§5, §7; VI-01 ("A state string must name what the architecture actually does"); APP-OPS-01 §6 (no transcript or audio to the Company) | the future Voice runtime task under `QAN-BL-VOICE-01` | when `QAN-BL-VOICE-01` reopens | **no new item.** `QAN-BL-VOICE-01` already requires "truthful microphone and route state" and the Voice lifecycle, and a second entry would be a duplicate alias (backlog §8; P2 §15 precedent). The closing change should note the string dependency in that item's current truth, if the Product Owner agrees |
| Device / release validation: VoiceOver / TalkBack, CallKit / Telecom, status bar, 320 pt large text, on-device icons and adaptive-icon framing, real Push (P4-GAP-052, 014) | not provable in proofs | G1.2 §7; G3 §F; P2 §14.6; P3 §16, §18 | Release Hardening & Launch | pre-release | **no.** It is the same disposition G1.2, G3, P2 and P3 already took |
| App-store / release operations: store listings, ratings ingestion, version-adoption tracking, icon wiring (`app.json`), splash implementation | implementation and operations | APP-OPS-01 §5.3 (store signals only); `P4-DQ-05`, `P4-DQ-06` outcomes | App Operations & Release Lead; Production Integration; Release Hardening | Production Integration → Release | **no** |
| Residual copy the Product Owner leaves to the audit under `P4-DQ-09`: sign-in failure and Login ID help; the VI-01 `PROPOSED` / `OPEN` residue; P3's education sheet; any Matching lines not frozen in P4 | the audit's copy pass owns journey copy | P1 §3 (generic failure wording); VI-01 principles; P3 §11 | End-to-End audit, then its scoped closures | the audit phase | **no.** It is the same disposition as P3 §17 / §20 |
| Undrawn screens left to the audit under `P4-DQ-07`: Settings screen, Understanding surface, sign-up, first-use screen, Shared / Public surfaces, multi-human attribution | outside the residual-canon boundary | P1 §8, §11; I-08A4 §12–§16; G1.1 §5 | End-to-End audit; Connected Worlds `I-08` for navigation surfaces | the audit phase | **no** |
| Account lifecycle and economy (P4-GAP-048, 049, 020) | the roadmap §3 | P1; CW2-08 §20–§23 | End-to-End audit | the audit phase | **no** |
| Production ports and craft tuning (P4-GAP-008, 009, 011, 016, 017, 045, 047, 050, 051, 053, 054, 055) | implementation of frozen designs | their named closures | Production Integration | Production Integration | **no** |
| Connected Worlds-owned surfaces and launch policies (P4-GAP-043, 044) | named owners exist | CW2-06, CW2-08, G3 §D | Connected Worlds `I-08`; Connected Worlds `I-09` / CW2-08 | their own tasks | **no.** Owned by frozen contracts (backlog I-05 … I-07 closure-record precedent) |
| Orphaned owners: VI-01 "Phase VII" (voice strings), VI-01 "Brand Integration" (English casing), VI-02 "VI-10" (screen-reader validation) | the tracks do not exist | — | voice strings → the Voice runtime task (row above); English casing → `P4-DQ-09`; screen-reader validation → Release Hardening (device row) | P4 closure records the re-ownership | **no.** Each is re-owned to an existing owner above |

---

## 3. Backlog impact candidate

> **`Backlog impact candidate: PROPOSED — pending closure review`**

**P4-A itself changes no backlog row.** It admits nothing, tombstones nothing and re-owns nothing (Task Contract §32).
APP-OPS-01 gets no backlog row, because it is active inside the authorized P4 task.

**One conditional candidate for the later P4 closure.** If P4 closes **before** the controlled CW2-08 amendment has
landed, then a canonical document (the closed APP-OPS-01 / P4 record) will explicitly defer a concrete obligation to
a named future task, namely the CW2-08 amendment. That is BG-06's admission route "explicitly deferred to a future
task by a canonical document". A qualifying residue must not survive only in a closure note (BG-08).

The closing change must then decide, under independent review, between two options:

- **(a)** admit a backlog entry for it, with the full §2 schema; or
- **(b)** record why no entry is needed, for example because the amendment has already landed.

**P4-A invents no ID for it.**

**Every other carry-forward: NONE.** Each row above states why:

- implementation of a frozen contract that the roadmap already sequences;
- an existing backlog owner, so no duplicate alias;
- a named owner under a frozen contract;
- or roadmap-owned audit work.

This follows the precedents of P2 §15, P3 §20 and the I-04 … I-07 closure records.

---

## 4. What P4 still owes before it can close

These are not carry-forwards. They are the remainder of P4 itself. They are listed so no successor task inherits
them silently (AGENTS §10.6):

1. the Product Owner's answers to `P4-DQ-01` … `P4-DQ-09`, and the visual proofs they require;
2. the Product Owner's answers to `P4-DQ-10` … `P4-DQ-17`, and the independent review of APP-OPS-01;
3. the P4 closure change, which does all of the following:
   - moves APP-OPS-01 and the P4 record to their final lifecycle (BG-09);
   - performs the BG-08 reconciliation of §3;
   - updates the Canonical Authority Index, the Canonical Artifact Index, the Current State, the Project Map and the
     roadmap;
   - runs `npm run test:task-closure-governance-contract`.
