# QANDEEL — P4 Carry-Forward Matrix

**Status:** `P4 FINAL CARRY-FORWARD RECONCILIATION — CLOSED / FROZEN WITH P4 — P4 OWES NOTHING; EVERY FUTURE OBLIGATION HAS ONE OWNER`

| | |
|---|---|
| Track | P4, task P4-A; finalized by the [P4 final closure](../canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md) |
| Canonical baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` |
| Role | separates **future work** from **Product decisions**. Every Product decision is resolved in the [Decision Queue](P4_PRODUCT_OWNER_DECISION_QUEUE.md). Everything here is work a later phase owns, bounded by a constraint that is already frozen |
| Governance | this matrix is not a backlog (BG-07). §3 records the BG-06 / BG-08 result at P4 closure: `QAN-BL-CTX-01` (admitted by P4-C1) and `QAN-BL-LANTERN-01` (admitted by the P4 closure) are the only P4 backlog admissions; every other row stays with its named owner |

---

## 1. The mandatory audit obligation

> **End-to-End Audit must add `Operational Events Required` and `Company Controls Required` to every relevant
> User Moment.**

This is `PO-OPS-11`, recorded in [APP-OPS-01 §19](APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md). The audit
extends the roadmap's gap matrix. It does not replace it. The extended matrix reads:

`User moment → User goal → Surface → Entry trigger → Existing Product decision → Existing implementation → Visual status → Missing decisions → Missing implementation → Operational Events Required → Company Controls Required → Owner`

The two new fields are filled inside APP-OPS-01, which is now `CLOSED / FROZEN`. Each uses only what the contract admits:

- **`Operational Events Required`** names events from the admitted domains (§5), never content (§6).
- **`Company Controls Required`** names controls from the currently approved control families (§11), within §10.

The audit designs no schema and chooses no vendor. It has **not** started, and P4-A performs none of it.

---

## 2. Carry-forward rows

### 2.1 APP-OPS-01

| Carry-forward | Why not P4 | Frozen constraint (APP-OPS-01, now closed) | Future owner | Trigger / phase | Backlog disposition needed? |
|---|---|---|---|---|---|
| The two audit fields for every relevant User Moment | P4 closes Product decisions. It does not walk User Moments (Task Contract §23) | APP-OPS-01 §19; §5, §6, §11 | End-to-End Product Experience Completeness Audit | after P1–P4 close | **no.** The roadmap sequences the audit, and `PO-OPS-11` names the obligation |
| Implementation of APP-OPS-01: collectors, schemas, new outbox domains, queues, dashboards, alerting, Sentry / OTel changes, Company DB / warehouse, the control-plane service, the flag / Remote Config / kill-switch / rollout / maintenance / minimum-version / route-hold runtimes, the Command Center, RBAC, the audit log | P4 implements nothing (Task Contract §24) | APP-OPS-01 §4–§15, §20; no synchronous dependency; no content; no generic remote execution; CW2-08 §24–§29 | Production Integration | after the audit | **no.** This is later implementation of a frozen contract, and the roadmap sequences Production Integration. It is the same disposition as P2 §15 and P3 §20 |
| Control-plane authentication, control signing / integrity, freshness / TTL / last-known-good, audit retention | `PO-OPS-15` freezes versioning + audit and leaves exact mechanisms to Production Integration / Security design | APP-OPS-01 §10.1, §15: only a valid, authenticated, currently effective control acts; an outage is never a Kill Switch | Production Integration security design; Release Hardening validation | Production Integration | **no.** It is later implementation of the Product boundary, not `QAN-BL-SEC-01` |
| User-diagnostic identifier format, pseudonymization, storage, query mechanism, retention duration | security / privacy implementation after `PO-OPS-13` fixed the access principle | human access only after a user-initiated support request; no content; Least Access / Least Retention | Production Integration security / privacy | Production Integration | **no** |
| Mobile crash / error reporting; mobile version adoption; call-status events; cost calculation; feature-usage events | these domains are approved but not implemented (APP-OPS-01 §5.1) | the approved domains only, content-free, non-semantic, fail-soft | Production Integration | Production Integration. Call status also needs `QAN-BL-VOICE-01` | **no** |
| The Approved Remote Configuration family register | `PO-OPS-18` requires Product Owner + Architecture controlled approval; no initial family set is frozen in P4 | APP-OPS-01 §11 family 6; Foundation Freeze ceiling | Product Owner + Architecture | before any Remote Configuration exists | **no** |
| Code delivery (store / over-the-air) governance | `PO-OPS-19`: code delivery is always a release outside the control plane; whether OTA is ever used remains a later release-operations decision | APP-OPS-01 §12: code delivery is not a control | App Operations & Release Lead; Release Hardening | Release Hardening | **no** |
| Operational-readiness validation (observability, failure recovery) | validation, not decision | APP-OPS-01 §8, §15 | Release Hardening & Launch | Release Hardening | **no.** The roadmap §5 already names it |

The controlled CW2-08 amendment that P4-A deferred is **no longer a carry-forward**: P4-B lands it as the
[CW2-08A controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md)
(`P4-DQ-10`, resolved). Any future moderation / report UX and appeals stay with their existing owner, Connected Worlds
`I-09` / CW2-08 §44 item 5, and must obey CW2-08A. That owner and item already exist, so nothing new is deferred.

### 2.2 Residual Product / visual canon

| Carry-forward | Why not P4 | Frozen constraint | Future owner | Trigger / phase | Backlog disposition needed? |
|---|---|---|---|---|---|
| Model / Provider benchmark and selection, text and realtime / voice | the roadmap couples it to the audit, and it needs workload evidence | Model Router (provider-neutral, benchmark-driven); FAST / DEEP v2 (selection deferred); APP-OPS-01 §14 (a Route Hold is not selection) | End-to-End audit | the audit phase | **no.** The roadmap §3 owns it |
| Voice runtime dependencies: speaking indicator, native call behavior, Voice Note transcript, spoken-reply control, voice / call state strings (P4-GAP-023 … 026, 035) | they cannot close without runtime truth | P2 §11.1 (no fake signal); G1.2 §1–§5, §7; VI-01 ("A state string must name what the architecture actually does"); APP-OPS-01 §6 (no transcript or audio to the Company) | the future Voice runtime task under `QAN-BL-VOICE-01` | when `QAN-BL-VOICE-01` reopens | **no new item.** `QAN-BL-VOICE-01` already requires "truthful microphone and route state" and the Voice lifecycle, and a second entry would be a duplicate alias (backlog §8; P2 §15 precedent). **Done at P4 closure:** the item's current truth now names these dependencies (P4-C2 §4–§5 already gate them there); its fields are unchanged |
| Runtime-backed Conversational Relevance (`P4-GAP-065`) | P4-C1 retires the old dedicated Live Context surface and freezes only the Product boundary; the relevance runtime/architecture does not exist yet and P4 implements nothing | P4-C1 §5–§6; V10 A15/A22/A23: relevance is runtime-backed, non-ordinal, not importance/truth/confidence/rank, and any spatial expression needs accessible non-spatial parity; explicit Context Activation stays explicit | `QAN-CTX-01 — Conversational Relevance Runtime` | automatic when `QAN-CTX-01` opens; must precede any production claim that contextual relevance drives Living Analysis recomposition / item-level relevance behavior | **yes — `QAN-BL-CTX-01` admitted by P4-C1** |
| Device / release validation: VoiceOver / TalkBack, CallKit / Telecom, status bar, 320 pt large text, on-device icons and adaptive-icon framing, real Push (P4-GAP-052, 014) | not provable in proofs | G1.2 §7; G3 §F; P2 §14.6; P3 §16, §18 | Release Hardening & Launch | pre-release | **no.** It is the same disposition G1.2, G3, P2 and P3 already took |
| App-store / release operations: store listings, ratings ingestion, version-adoption tracking, icon wiring (`app.json`), splash implementation | implementation and operations | APP-OPS-01 §5.3 (store signals only); `P4-DQ-05`, `P4-DQ-06` outcomes | App Operations & Release Lead; Production Integration; Release Hardening | Production Integration → Release | **no** |
| **QANDEEL — Lantern Gateway Identity Moment v1** (`P4-GAP-019`) | Product Owner confirms the exceptional lantern identity moment is in v1, but explicitly separates its animation / creative direction from P4 | C3 §4: exceptional gateway identity object; P4-C2 §2: presence in v1 is frozen, while design, motion, interaction choreography, technology choice and proof remain unfrozen | `QANDEEL — Lantern Gateway Identity Moment v1` | open only when its turn arrives, by its own Task Contract; before v1 release | **yes — `QAN-BL-LANTERN-01` admitted at P4 closure** (`HIGH`, `DEFERRED — OWNED`): P4-C2 §2 defers a real v1 obligation to a named future task (BG-06). No research or implementation in P4, and the entry decides no design, motion, timing, interaction or technology |
| Residual copy the Product Owner leaves to the audit under `P4-DQ-09`: sign-in failure and Login ID help; the VI-01 `PROPOSED` / `OPEN` residue; P3's education sheet; any Matching lines not frozen in P4 | the audit's copy pass owns journey copy | P1 §3 (generic failure wording); VI-01 principles; P3 §11 | End-to-End audit, then its scoped closures | the audit phase | **no.** It is the same disposition as P3 §17 / §20 |
| Undrawn screens left to the audit under `P4-DQ-07`: Settings screen, Understanding surface, sign-up, first-use screen, Shared / Public surfaces, multi-human attribution | outside the residual-canon boundary | P1 §8, §11; I-08A4 §12–§16; G1.1 §5 | End-to-End audit; Connected Worlds `I-08` for navigation surfaces | the audit phase | **no** |
| Account lifecycle and economy (P4-GAP-048, 049, 020) | the roadmap §3 | P1; CW2-08 §20–§23 | End-to-End audit | the audit phase | **no** |
| Production ports and craft tuning (P4-GAP-008, 009, 011, 016, 017, 045, 047, 050, 051, 053, 054, 055) | implementation of frozen designs | their named closures | Production Integration | Production Integration | **no** |
| Connected Worlds-owned surfaces and launch policies (P4-GAP-043, 044) | named owners exist | CW2-06, CW2-08, G3 §D | Connected Worlds `I-08`; Connected Worlds `I-09` / CW2-08 | their own tasks | **no.** Owned by frozen contracts (backlog I-05 … I-07 closure-record precedent) |
| Orphaned owners: VI-01 "Phase VII" (voice strings), VI-01 "Brand Integration" (English casing), VI-02 "VI-10" (screen-reader validation) | the tracks do not exist | — | voice strings → the Voice runtime task (`QAN-BL-VOICE-01`); **English casing is resolved as QANDEEL by P4-C2**; screen-reader validation → Release Hardening | **recorded by the P4 closure** (§9 there; `QAN-BL-VOICE-01` current truth) | **no.** Each is re-owned or resolved |
| Device-side target sizes: Android's 48 dp recommendation against the frozen 44 pt targets (P4-C3 finding F-05) | no frozen value changes; it is a device check | P2 §10; P3 §16 | Release Hardening | pre-release | **no.** A device gate, like the rows above |

---

## 3. Backlog impact

> **P4 backlog admissions: `QAN-BL-CTX-01` (P4-C1) and `QAN-BL-LANTERN-01` (P4 closure)**

P4-A and P4-B admitted no backlog row. **P4-C1 admits one owned HIGH-severity obligation:** `QAN-BL-CTX-01 — Runtime-backed Conversational Relevance`, owned by `QAN-CTX-01 — Conversational Relevance Runtime`.

**The P4 closure admits one more:** `QAN-BL-LANTERN-01 — Lantern Gateway Identity Moment v1 — Creative / Motion /
Interaction Realization`, `HIGH`, `DEFERRED — OWNED`, owned by `QANDEEL — Lantern Gateway Identity Moment v1`. It
qualifies under BG-06's second route because P4-C2 §2 defers a real v1 obligation to that named task, and BG-08 requires
it to reach the register because P4 can no longer hold it. It records the obligation only; it decides no design,
motion, timing, interaction or technology.

**Existing items reused, not aliased:** `QAN-BL-VOICE-01` (current-truth note added; fields unchanged),
`QAN-BL-NAV-02`, `QAN-BL-VIS-01`, `QAN-BL-CW-01` and `QAN-BL-SEC-01` (unchanged).

P4-A's one conditional candidate, the controlled CW2-08 amendment in `P4-DQ-10`, is gone:

- the concrete amendment obligation is completed in P4-B itself (CW2-08A);
- no new future task is deferred for `P4-DQ-10`;
- the remaining moderation / report work is existing named-owner work (Connected Worlds `I-09` / CW2-08 §44 item 5),
  now bounded by CW2-08A.

Every other carry-forward stays with its named owner and is not admitted: each is later implementation of a frozen
contract, a device / release gate, audit-owned journey work, or owned by a frozen contract, and none qualifies under
BG-06 (the P4 final closure §9 gives the reason row by row). P4-C1's admission exists because Architecture explicitly
designates the contextual-relevance residue under BG-06 / BG-08; neither backlog entry authorizes implementation by
itself (BG-07).

This follows the precedents of P2 §15, P3 §20, the G3 closure's `QAN-BL-VIS-01` admission and the I-04 … I-07 closure
records.

---

## 4. P4's own obligations — all discharged

P4 owes nothing. The five obligations this section listed before closure are discharged. None moved to a successor:

| # | Former P4 obligation | Discharged by |
|---|---|---|
| 1 | visual proof for the P4-owned **static** launch / gateway application, excluding the standalone lantern task | P4-C3 boards 01–02 and the P4-C3R launch appearance policy (P4-C3R §1); frozen by the P4 closure §6 |
| 2 | integrated AR / EN proof for the non-signal Voice visual language | P4-C3 boards 03–07; frozen by the P4 closure §6 |
| 3 | authoring + rendered proof for the P4-owned copy clusters | proved by P4-C3 (boards 08–12); ratified by P4-C3R (three rows) and P4-C4 (all 104 remaining rows) |
| 4 | independent review of APP-OPS-01 | complete; APP-OPS-01 is `CLOSED / FROZEN` (its §23.1) |
| 5 | the final P4 closure / reconciliation | the [P4 final closure](../canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md): BG-08 / BG-09, indexes, Current State, Project Map, roadmap and the governance gate, in one change — binding on its independent review and merge |

Everything in §1–§2 stays outside P4, with the owner named in its row.

