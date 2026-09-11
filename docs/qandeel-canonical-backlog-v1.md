# QANDEEL — Canonical Backlog v1

**Status:** ACTIVE — governance authority  
**Established by:** QAN-GOV-01 (documentation-only normalization)  
**Canonical baseline:** `4473beb3d34993103baa82c034a76998bb40bc03` — merge of PR #213, which closed T-10 Living Analysis Map Motion System v1  
**Authority:** documentation and governance only. Nothing recorded here is executable, and nothing recorded here authorizes implementation, a migration, a dependency or a Product semantic.

This is QANDEEL's one canonical **cross-task** backlog. Active-task blockers remain owned by the active contract until they are fixed and never move here merely to close a task. Outside those active blockers, a cross-task obligation is tracked only when it is recorded here — and an obligation that *is* recorded here is not thereby scheduled.

---

## 1. Why this document exists

Review findings must not become an endless revision loop, and closing a task must not become a way of making a defect somebody else's problem. This register distinguishes:

1. **a current blocker** — fixed inside the active task;
2. **a deferred obligation** with a named future owner — `DEFERRED — OWNED`;
3. **a validation item** with a concrete reopen condition — `VALIDATION — OPEN`;
4. **an open future capability** — `OPEN — UNASSIGNED`;
5. **closed work retained for traceability** — `CLOSED — TOMBSTONE`.

The backlog is intentionally small enough to be read at every task kickoff.

---

## 2. Item schema

Every active item carries:

| Field | Meaning |
| --- | --- |
| **ID** | stable, never reused |
| **Title / Finding** | what is actually outstanding |
| **Source** | canonical source |
| **Why deferred** | why it is not current work |
| **Owner task** | one named future task, or `UNASSIGNED` |
| **Severity** | `HIGH` / `MEDIUM` / `LOW` |
| **Reopen condition** | evidence/event that makes it executable |
| **Status** | lifecycle state below |

Closed items retain their ID, closing task, PR, evidence SHA and a concise disposition.

### Statuses

| Status | Meaning |
| --- | --- |
| `DEFERRED — OWNED` | a real obligation with one named future owner |
| `VALIDATION — OPEN` | nothing is known to be wrong; stated evidence would reopen implementation |
| `OPEN — UNASSIGNED` | an open future capability with no frozen owner |
| `CLOSED — TOMBSTONE` | retired, retained with closure evidence and disposition |

### Severity

| Severity | Meaning |
| --- | --- |
| `HIGH` | if reopened, can affect Product truth, accessibility parity, major interaction correctness, release quality, security, or an already-frozen capability |
| `MEDIUM` | meaningful Product capability or quality work, not currently violating a frozen contract |
| `LOW` | optional or lower-risk future capability |

Severity is consequence, not schedule or estimate.

---

## 3. Governance rules

**BG-01 — No blocker laundering.** A finding that violates the ACTIVE task contract cannot be moved into this backlog merely so the task can close. It is fixed, unless Architecture explicitly changes or dispositions the active contract; then the disposition, not the backlog entry, is the record.

**BG-02 — Ownership is explicit.** Every active owned item names one future owner task or says `UNASSIGNED`. “Later”, “a future release” and “TBD” are not owners.

**BG-03 — Validation is conditional.** Every `VALIDATION — OPEN` item states exact evidence that reopens implementation.

**BG-04 — IDs are never reused.** A closed item remains as `CLOSED — TOMBSTONE` with its closing task, PR, evidence SHA and disposition.

**BG-05 — Future tasks inherit owned items.** At kickoff, Architecture reads this backlog and explicitly dispositions every item owned by that task.

**BG-06 — Anti-scope is not automatically backlog.** A task boundary becomes backlog only when an existing OPEN identifier, canonical deferral, carried validation obligation, or explicit Architecture designation requires it.

**BG-07 — Backlog is not Product authority.** An item becomes executable only through a future Task Contract.

**BG-08 — Closure reconciliation / backlog admission.** Before an ACTIVE task is declared CLOSED / FROZEN, Architecture reconciles every inherited item and admits every qualifying new cross-task residue. Current blockers remain inside the active task and are fixed there.

---

## 4. Index

| ID | Title / Finding | Owner task | Severity | Status |
| --- | --- | --- | --- | --- |
| `OPEN-06` | Bookmarks | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-08` | Coarse Temporal Step | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-09` | Object-Originated Version Jump | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-19` | Dedicated No-Op Acknowledgement | `UNASSIGNED` | `LOW` | `OPEN — UNASSIGNED` |
| `QAN-BL-T12-01` | Original Inspection Journey-Origin Binding | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-T12-02` | Locale Provider / Regional Numeral Policy | `T-12 — Final Integration` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-T12-03` | Final App-Shell Composition | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-01` | Meaning Ignition Authoritative Trigger | `T-12 — Final Integration` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-02` | Exact Composite Spatial-Cause Binding | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-03` | Physical Motion Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-04` | Direct-Drag Presentation Culling | `T-12 — Final Integration / pre-release physical validation gate` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-RSP-01` | Physical Responsive Recomposition Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-RSP-02` | Outboard Live Label Clipped at Large Text | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-T12-04` | Mobile Auth Session Storage Production Security + Device Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-SEC-01` | Mobile Credential Backup & Hardware Security Hardening | `QAN-SEC-01 — Pre-release Mobile Credential Security` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-T13-01` | Restart / Recovery / Persistence | `T-13 — Recovery / Persistence` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-NAV-01` | Cross-Session Timeline | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-NAV-02` | Analysis Replay | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |

---

## 5. Active items

### `OPEN-06` — Bookmarks

- **Title / Finding:** no bookmarking capability exists.
- **Source:** T-04 §14 and T-07 §12.
- **Why deferred:** a bookmark is a new destination type, not a gap in frozen Return semantics.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated bookmarking/navigation capability task or a future integration contract explicitly claims it.
- **Status:** `OPEN — UNASSIGNED`

No bookmark storage, identity, lifetime, sharing or restoration semantics are implied here.

### `OPEN-08` — Coarse Temporal Step

- **Title / Finding:** no coarse-grained temporal stepping exists; targeting is per disclosed Moment.
- **Source:** T-04 §14 and T-07 §12.
- **Why deferred:** not part of frozen temporal or Return contracts.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a future temporal-navigation task defines coarse stepping and its relationship to exact disclosed Moment targeting.
- **Status:** `OPEN — UNASSIGNED`

### `OPEN-09` — Object-Originated Version Jump

- **Title / Finding:** selecting an object does not authorize temporal/version navigation from it.
- **Source:** T-04 §14 and T-07 §12.
- **Why deferred:** inspection is not temporal authority.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a future Product contract explicitly authorizes object-originated temporal/version navigation and defines its truth/history semantics.
- **Status:** `OPEN — UNASSIGNED`

### `OPEN-19` — Dedicated No-Op Acknowledgement

- **Title / Finding:** no dedicated canonical acknowledgement state exists for a Return act that correctly does nothing.
- **Source:** T-08 §9; also T-04 §14 and T-07 §12.
- **Why deferred:** the frozen Return layer already resolves no-op truthfully without fabricated state or motion.
- **Owner task:** `UNASSIGNED`
- **Severity:** `LOW`
- **Reopen condition:** Product/user evidence shows current truthful outcome and chrome feedback are insufficient and Architecture opens a dedicated contract.
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-SEC-01` — Mobile Credential Backup & Hardware Security Hardening

- **Title / Finding:** the accepted-v1 auth storage boundary still has two platform-security residues: Android `allowBackup` currently resolves to `true`, so the isolated auth database is eligible for Auto Backup; and the iOS functional storage contract is proven on a Release simulator, not physical hardware, so iOS Data Protection / backup-exclusion behaviour is not physically attested.
- **Source:** `docs/t12-auth-storage-at-rest-disposition-v1.md` §§4, 6 and 7; admitted by T-12 BG-08 closure reconciliation after AC-03 explicitly accepted the v1 storage risk.
- **Why deferred:** T-12 proved the functional auth-storage lifecycle on Android hardware and iOS Release simulator and Architecture/Security explicitly accepted the v1 SQLite threat boundary. Changing backup policy changes the native artifact and belongs in one deliberate pre-release credential-security pass rather than an unvalidated final T-12 edit.
- **Owner task:** `QAN-SEC-01 — Pre-release Mobile Credential Security`
- **Severity:** `HIGH`
- **Reopen condition:** automatic before the first production-store release, or earlier if the auth-storage mechanism, backup policy, platform credential model or mobile threat model changes.
- **Required future properties:** settle Android backup policy (`allowBackup: false` or precise auth-database exclusion); settle the equivalent iOS backup/data-protection policy; validate the generated native configuration; preserve sign-out removal, identity isolation, token replacement, and the prohibition on Product truth / QANDEEL conversation `sessionId` in auth storage; use maintained platform mechanisms only — no custom cryptography.
- **Status:** `DEFERRED — OWNED`

This item is platform-wide: Family, Match and any future QANDEEL surface using the shared mobile auth foundation inherit the same credential-storage boundary.

### `QAN-BL-T13-01` — Restart / Recovery / Persistence

- **Title / Finding:** restart, recovery and persistence of the reader's viewpoint and reversible history are unimplemented.
- **Source:** T-07 §12 and T-08 §11.
- **Why deferred:** explicitly outside T-07/T-08 and already assigned to recovery/persistence work.
- **Owner task:** `T-13 — Recovery / Persistence`
- **Severity:** `HIGH`
- **Reopen condition:** automatic when T-13 begins.
- **Status:** `DEFERRED — OWNED`

No persistence semantics are defined by this entry.

### `QAN-BL-NAV-01` — Cross-Session Timeline

- **Title / Finding:** the Timeline is Session-scoped; no cross-Session temporal navigation exists.
- **Source:** T-07 §12.
- **Why deferred:** explicitly excluded and no current roadmap owner is frozen.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a future cross-Session temporal-navigation contract.
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-NAV-02` — Analysis Replay

- **Title / Finding:** there is no Replay of how an analysis developed.
- **Source:** T-07 §12.
- **Why deferred:** explicitly excluded and no current owner is frozen.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated Replay contract.
- **Status:** `OPEN — UNASSIGNED`

---

## 6. Tombstones

All T-12 tombstones below were reconciled under BG-08 against **T-12 — Final Living Analysis Map Integration v1**, PR **#220**, with final validated/reconciled evidence head **`02bff1b61c65c33a0d186da52dfa25d25baebe9e`**. The subsequent BG-08 documentation commit changes governance records only.

### `QAN-BL-T12-01` — Original Inspection Journey-Origin Binding

- **Closing task:** `T-12 — Final Integration`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. T-12 supplies the real inspection-journey origin at the integration boundary; T-07 remains the final Return execution authority and no origin is manufactured by presentation.
- **Severity:** `HIGH`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-02` — Locale Provider / Regional Numeral Policy

- **Closing task:** `T-12 — Final Integration`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. One app-level locale authority is integrated; language and direction remain independent; Egypt is the v1 region where needed; Western `latn` digits remain the frozen v1 numeral policy unless a later Product contract changes it.
- **Severity:** `MEDIUM`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-03` — Final App-Shell Composition

- **Closing task:** `T-12 — Final Integration`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The real Product root composes the Living Analysis Map owners from one canonical runtime/store; the hidden FoundationShell path is not the Product route.
- **Severity:** `HIGH`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-01` — Meaning Ignition Authoritative Trigger

- **Closing task:** `T-12 — Final Integration`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed by the contract's explicit no-trigger branch: T-12 found no truthful authoritative semantic-crystallization signal, therefore **NO MEANING IGNITION CUE SHIPS**. No dormant or fabricated trigger was introduced.
- **Severity:** `MEDIUM`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-02` — Exact Composite Spatial-Cause Binding

- **Closing task:** `T-12 — Final Integration`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The exact `GO_LIVE_AND_LOCATE` cause is bound one-shot to its exact camera transition and cannot be borrowed by an unrelated act.
- **Severity:** `HIGH`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-03` — Physical Motion Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** passed under the T-12 platform matrix. Release-equivalent Android hardware evidence on the Honor X9b plus iOS Release-simulator/native evidence showed no blocking teleport/jank/parity violation. The protected Pan baseline remained 0.00% janky in measured runs and the user's physical judgement was smooth, fast, direct and comfortable.
- **Severity:** `HIGH`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-04` — Direct-Drag Presentation Culling

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** hardware testing reopened this item by proving blank-entry / sudden pop-in. T-12 fixed the stale live-drag visibility corridor with bounded presentation admission; before/after evidence reduced the largest release-time admission jump from **+26.55 points to 0.00**, and the user confirmed the visible pop-in was completely gone while Pan feel improved.
- **Severity:** `MEDIUM`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-RSP-01` — Physical Responsive Recomposition Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** passed after T-12 corrected the short-landscape allocation defect. Android physical portrait↔landscape round-trips and iOS Release native composition kept all truth-bearing regions visible; no zero-height support region remained; large-text/RTL affected coverage passed.
- **Severity:** `HIGH`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-RSP-02` — Outboard Live Label Clipped at Large Text

- **Closing task:** `T-12 — Final Integration`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The final integrated responsive composition preserves visible/accessible Live wording at the required large-text envelope while keeping the outboard control separate from Moment-targeting space and preserving T-05 measurement authority.
- **Severity:** `HIGH`
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-04` — Mobile Auth Session Storage Production Security + Device Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / evidence SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed for T-12. Android hardware and iOS Release-simulator lifecycle validation proved persist/restore, token replacement, sign-out removal, identity isolation and auth-only restoration. Architecture/Security produced `docs/t12-auth-storage-at-rest-disposition-v1.md` and explicitly accepted the v1 isolated SQLite risk boundary; no custom cryptography was introduced. The narrower platform-hardening residue (Android backup policy and physical iOS backup/Data-Protection attestation) is admitted separately as `QAN-BL-SEC-01`, not left hidden inside this closed item.
- **Severity:** `HIGH`
- **Status:** `CLOSED — TOMBSTONE`

---

## 7. Counts after T-12 BG-08 reconciliation

| Status | Count |
| --- | ---: |
| `DEFERRED — OWNED` | 2 |
| `VALIDATION — OPEN` | 0 |
| `OPEN — UNASSIGNED` | 6 |
| `CLOSED — TOMBSTONE` | 10 |
| **Total** | **18** |

| Severity | Count |
| --- | ---: |
| `HIGH` | 9 |
| `MEDIUM` | 8 |
| `LOW` | 1 |

T-12 inherited ten items and all ten are now tombstoned. `QAN-BL-SEC-01` is the sole new BG-08 admission from T-12 closure residue.

---

## 8. What is deliberately not in this backlog

- Current unresolved blockers — they remain in the active task and are fixed there.
- Speculative features.
- Every anti-scope sentence.
- Implementation design for future tasks.
- Estimates, priorities and schedules.
- Duplicate aliases for already-recorded items.
- Already-closed work except as tombstones.

---

## 9. Task lifecycle checklist

### At kickoff (BG-05)

Architecture:

1. reads this document in full;
2. lists every active item whose **Owner task** matches the task being opened;
3. records one of: included, re-owned to one named task, or remains deferred with reason;
4. confirms no blocker was laundered into the register;
5. leaves `OPEN — UNASSIGNED` alone unless the task explicitly claims it.

Current inheritance:

| Task | Items inherited on kickoff |
| --- | --- |
| `QAN-SEC-01 — Pre-release Mobile Credential Security` | `QAN-BL-SEC-01` |
| `T-13 — Recovery / Persistence` | `QAN-BL-T13-01` |
| `T-12 — Final Integration` | none — closure reconciled under BG-08 / PR #220 |

### At closure (BG-08)

Before a task is declared CLOSED / FROZEN, Architecture:

1. reconciles every inherited item — completed → `CLOSED — TOMBSTONE`, re-owned, or still deferred with a recorded reason;
2. admits every newly accepted cross-task deferral that qualifies under BG-06;
3. leaves current blockers inside the active task until fixed;
4. does not close while qualifying residue exists only outside this document.

### T-12 closure record

T-12 BG-08 reconciliation is complete on PR #220 against validated/reconciled evidence head `02bff1b61c65c33a0d186da52dfa25d25baebe9e`: all ten inherited items are tombstoned, the one qualifying new security residue is admitted as `QAN-BL-SEC-01`, and no T-12 Product / validation / Architecture blocker remains open in this register.
