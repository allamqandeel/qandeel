# QANDEEL — Canonical Backlog v1

**Status:** ACTIVE — governance authority
**Established by:** QAN-GOV-01 (documentation-only normalization)
**Canonical baseline:** `4473beb3d34993103baa82c034a76998bb40bc03` — the merge of PR #213, which
closed T-10 Living Analysis Map Motion System v1
**Authority:** documentation and governance only. Nothing recorded here is executable, and nothing
recorded here authorizes implementation, a migration, a dependency or a Product semantic.

This is QANDEEL's one canonical **cross-task** backlog. Active-task blockers remain owned by the
active contract until they are fixed and never move here merely to close a task. Outside those
active blockers, a cross-task obligation is tracked only when it is recorded here — and an
obligation that *is* recorded here is not thereby scheduled.

---

## 1. Why this document exists

Review findings must not become an endless revision loop, and closing a task must not become a way
of making a defect somebody else's problem. So this backlog distinguishes four things that a single
undifferentiated "todo" list would blur:

1. **a current blocker** — a finding that violates the ACTIVE task contract. It is fixed before that
   task closes and it never appears here (BG-01);
2. **a deferred obligation** with a known future owner — `DEFERRED — OWNED`;
3. **a validation item** that becomes implementation work only if a stated reopen condition is
   observed — `VALIDATION — OPEN`;
4. **an open future capability** deliberately not owned by any current roadmap stage —
   `OPEN — UNASSIGNED`.

The backlog is kept small enough to be read in full at every task kickoff. That is a functional
requirement, not a style preference: a register nobody can read is a register nobody checks.

---

## 2. Item schema

Every item carries all eight fields:

| Field | Meaning |
| --- | --- |
| **ID** | stable, never reused (BG-04) |
| **Title / Finding** | what is actually outstanding |
| **Source** | the exact canonical document and section that establishes it |
| **Why deferred** | the reason it is not current work |
| **Owner task** | one named future task, or `UNASSIGNED` (BG-02) |
| **Severity** | `HIGH` / `MEDIUM` / `LOW` |
| **Reopen condition** | the exact evidence or event that makes it executable (BG-03) |
| **Status** | one of the four below |

Some items additionally carry a **canonical disposition** token, a **current truth** statement, a
**required future property**, a **validation set**, or a stated **closure rule**. Those are recorded
because the canonical source states them, not because the schema requires them.

### The only four statuses

| Status | Meaning |
| --- | --- |
| `DEFERRED — OWNED` | a real obligation with one named future owner |
| `VALIDATION — OPEN` | nothing is known to be wrong; stated evidence would make it work |
| `OPEN — UNASSIGNED` | an open future capability with no frozen owner |
| `CLOSED — TOMBSTONE` | retired, retained with closure task / PR / SHA and disposition |

### Severity

| Severity | Meaning |
| --- | --- |
| `HIGH` | if reopened, can affect Product truth, accessibility parity, major interaction correctness, release quality, or an already-frozen capability |
| `MEDIUM` | meaningful Product capability or quality work, not currently violating a frozen contract |
| `LOW` | optional or lower-risk future capability |

Severity states the consequence *if the item is reopened*. It is not a schedule, a priority order or
an estimate, and this document holds none of those.

---

## 3. Governance rules

**BG-01 — No blocker laundering.** A finding that violates the ACTIVE task contract cannot be moved
into this backlog merely so the task can close. It is fixed, unless Architecture explicitly changes
or dispositions the active contract — and then the disposition, not the backlog entry, is the
record. Nothing in this document may be cited as authority for leaving a contract violated.

**BG-02 — Ownership is explicit.** Every item names one future owner task or says `UNASSIGNED`.
"Later", "a future release" and "TBD" are not owners.

**BG-03 — Validation is conditional.** Every `VALIDATION — OPEN` item states the exact evidence that
reopens implementation. "Check later" is not a reopen condition.

**BG-04 — IDs are never reused.** A closed item stays here as `CLOSED — TOMBSTONE` carrying its
closure task, PR and SHA and a short disposition. A retired ID is never re-issued to different work.

**BG-05 — Future tasks inherit owned items.** At every task kickoff, Architecture reads this backlog
and lists every open item whose owner matches that task. Each such item is then included in the task
contract, explicitly re-owned, or explicitly left deferred with a reason. Silence is not a
disposition. See §9.

**BG-06 — Anti-scope is not automatically backlog.** A sentence saying a task did not do something
is not an obligation. An item enters this backlog only if it has an existing `OPEN` identifier, is
explicitly deferred to a future task by a canonical document, is explicitly carried forward for
validation, or Architecture explicitly designates it.

**BG-07 — Backlog is not Product authority.** An item becomes executable only through a future Task
Contract. Nothing here defines runtime semantics, and no reader may implement from an entry.

**BG-08 — Closure reconciliation / backlog admission.** Before an ACTIVE task may be declared
CLOSED / FROZEN, Architecture reconciles that task's cross-task residue against this backlog. Every
newly discovered item that is not a current blocker and qualifies under BG-06 is admitted here, with
the complete schema of §2, *before* closure. Every backlog item that task inherited is explicitly
updated as one of: completed → `CLOSED — TOMBSTONE`, re-owned to one named task, or still deferred
with a recorded reason. Once the task has closed, a qualifying item may not exist only in a review
comment, a final report, a task-local note or a model's memory. This adds no lifecycle state and
relaxes nothing: a current blocker is still fixed inside the active task (BG-01), anti-scope is
still not automatically backlog (BG-06), and admission still authorizes no implementation (BG-07).

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

## 5. Items

### `OPEN-06` — Bookmarks

- **Title / Finding:** no bookmarking capability exists. A reader cannot mark a position, an object
  or a viewpoint and return to it by name.
- **Source:** Architecture planning carry-forward — the `OPEN` register that issued this identifier
  is not itself a repository document. Corroborated in the repository as an explicit boundary by
  [T-04 §14 Anti-scope](living-analysis-map-runtime-v1.md) ("no bookmarks (OPEN-06)") and by
  [T-07 §12](return-navigation-layer-v1.md) ("no bookmarks").
- **Why deferred:** intentionally outside the frozen T-07 Return semantics. The six return
  identities are complete as frozen, and a bookmark is a seventh kind of destination rather than a
  gap in them.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated bookmarking / navigation capability task, or a
  future integration contract explicitly claims it.
- **Status:** `OPEN — UNASSIGNED`

No bookmark semantics — storage, identity, lifetime, sharing, restoration or relation to reversible
history — are defined here or implied by this entry.

### `OPEN-08` — Coarse Temporal Step

- **Title / Finding:** no coarse-grained temporal stepping exists. Temporal targeting is per
  disclosed Moment.
- **Source:** Architecture planning carry-forward. Corroborated as an explicit boundary by
  [T-04 §14](living-analysis-map-runtime-v1.md) ("no coarse temporal step (OPEN-08)") and by
  [T-07 §12](return-navigation-layer-v1.md) ("no coarse temporal stepping").
- **Why deferred:** not part of the current frozen temporal or Return contracts.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a future temporal-navigation task explicitly defines coarse stepping
  semantics *and* their relationship to exact disclosed Moment targeting.
- **Status:** `OPEN — UNASSIGNED`

The relationship named in the reopen condition is the hard part, and it is deliberately left
undefined here: T-06 keeps canonical Moment addressability and disclosed interaction availability as
two separate gates, and any coarse step would have to answer to both.

### `OPEN-09` — Object-Originated Version Jump

- **Title / Finding:** selecting an object does not authorize temporal or version navigation from
  it.
- **Source:** Architecture planning carry-forward. Corroborated as an explicit boundary by
  [T-04 §14](living-analysis-map-runtime-v1.md) ("no object-originated version jump (OPEN-09)") and
  by [T-07 §12](return-navigation-layer-v1.md) ("no object-originated version jumps").
- **Why deferred:** current object selection is inspection, not temporal authority. Inspecting is
  not navigating.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a future Product contract explicitly authorizes object-originated
  temporal / version navigation and defines its truth and history semantics.
- **Status:** `OPEN — UNASSIGNED`

### `OPEN-19` — Dedicated No-Op Acknowledgement

- **Title / Finding:** there is no dedicated canonical acknowledgement state for a return act that
  correctly does nothing.
- **Source:** [T-08 §9](inspection-orientation-return-chrome-v1.md) states it by identifier — "There
  is no dedicated no-op acknowledgement state; `OPEN-19` stays deferred." Also carried as a boundary
  by [T-04 §14](living-analysis-map-runtime-v1.md) and [T-07 §12](return-navigation-layer-v1.md).
  The register that issued the identifier is an Architecture planning carry-forward.
- **Why deferred:** the frozen Return layer has no such state, and a no-op already resolves
  truthfully: no fabricated canonical state, no invented reversible-history entry, no invented camera
  movement, no persistent selected state.
- **Owner task:** `UNASSIGNED`
- **Severity:** `LOW`
- **Reopen condition:** product or user evidence shows that the existing truthful outcome and chrome
  feedback is insufficient, *and* Architecture opens a dedicated contract for the acknowledgement.
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-SEC-01` — Mobile Credential Backup & Hardware Security Hardening

- **Title / Finding:** the accepted-v1 auth storage boundary has two platform-security residues:
  Android `allowBackup` currently resolves to `true`, so the isolated auth database is eligible for
  Auto Backup; and the iOS functional storage contract is proven on a Release simulator rather than
  physical hardware, so iOS Data Protection / backup-exclusion behaviour is not physically attested.
- **Source:** [T-12 auth storage-at-rest disposition §§4, 6 and 7](t12-auth-storage-at-rest-disposition-v1.md),
  admitted by T-12 BG-08 closure reconciliation after AC-03 explicitly accepted the v1 storage risk.
- **Why deferred:** T-12 proved the functional auth-storage lifecycle on Android hardware and iOS
  Release simulator and Architecture/Security explicitly accepted the v1 SQLite threat boundary.
  Changing backup policy changes the native artifact and belongs in one deliberate pre-release
  credential-security pass rather than an unvalidated final T-12 edit.
- **Owner task:** `QAN-SEC-01 — Pre-release Mobile Credential Security`
- **Severity:** `HIGH`
- **Reopen condition:** automatic before the first production-store release, or earlier if the
  auth-storage mechanism, backup policy, platform credential model or mobile threat model changes.
- **Required future properties:** settle Android backup policy (`allowBackup: false` or precise
  auth-database exclusion); settle the equivalent iOS backup/Data-Protection policy; validate the
  generated native configuration; preserve sign-out removal, identity isolation, token replacement,
  and the prohibition on Product truth / QANDEEL conversation `sessionId` in auth storage; use
  maintained platform mechanisms only — no custom cryptography.
- **Status:** `DEFERRED — OWNED`

This item is platform-wide: Family, Match and any future QANDEEL surface using the shared mobile auth
foundation inherit the same credential-storage boundary.

### `QAN-BL-T12-04` — Mobile Auth Session Storage Production Security + Device Validation

> **Historical pre-closure schema retained for the frozen T-12P contract only.** This block records
> what T-12 inherited before physical validation. It is not the current lifecycle state; the current
> state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** production mobile auth-session storage security and native lifecycle/device validation were still outstanding at T-12P closure.
- **Source:** T-12P mobile runtime-entry preconditions and the original canonical backlog admission for `QAN-BL-T12-04`.
- **Why deferred:** T-12P established the runtime-entry boundary but deliberately left production physical validation to T-12 Final Integration.
- **Owner task:** `T-12 — Final Integration / pre-release physical validation gate`
- **Severity:** `HIGH`
- **Reopen condition:** T-12 physical validation gate reached with production-equivalent auth storage and native builds.
- **Status:** `VALIDATION — OPEN`
- **Validation set:** persistence/restore, token replacement, identity isolation, sign-out removal, auth-only storage boundary, Android hardware, and iOS Release-native evidence where available.

This historical validation residue was **not** T-13 Product persistence. Historical T-12 physical-gate inheritance included `QAN-BL-RSP-01`, `QAN-BL-T12-04`. T-12 subsequently discharged it; the only narrower future security residue is `QAN-BL-SEC-01`.

### `QAN-BL-T13-01` — Restart / Recovery / Persistence

- **Title / Finding:** restart, recovery and persistence of the reader's viewpoint and reversible
  history are unimplemented.
- **Source:** [T-07 §12](return-navigation-layer-v1.md) ("no T-13 restart or persistence");
  [T-08 §11](inspection-orientation-return-chrome-v1.md) ("restart and persistence to T-13").
- **Why deferred:** explicitly outside T-07, and already assigned to future recovery / persistence
  work by both canonical documents.
- **Owner task:** `T-13 — Recovery / Persistence`
- **Severity:** `HIGH`
- **Reopen condition:** automatic when T-13 begins.
- **Status:** `DEFERRED — OWNED`

No persistence semantics — what survives a restart, for how long, under what identity, and what
happens to reversible history — are defined here.

### `QAN-BL-NAV-01` — Cross-Session Timeline

- **Title / Finding:** the Timeline is Session-scoped. There is no cross-Session temporal
  navigation.
- **Source:** [T-07 §12](return-navigation-layer-v1.md) ("no cross-session Timeline").
- **Why deferred:** T-07 explicitly excludes it, and no current roadmap owner is frozen for it.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a future cross-Session temporal-navigation contract.
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-NAV-02` — Analysis Replay

- **Title / Finding:** there is no Replay of how an analysis developed.
- **Source:** [T-07 §12](return-navigation-layer-v1.md) ("no Replay").
- **Why deferred:** T-07 explicitly excludes Replay, and no current owner is frozen.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated Replay contract.
- **Status:** `OPEN — UNASSIGNED`

---

## 6. Tombstones

All T-12 tombstones below were reconciled under BG-08 against **T-12 — Final Living Analysis Map
Integration v1**, PR **#220**, with final implementation/validation evidence head
**`02bff1b61c65c33a0d186da52dfa25d25baebe9e`**. The BG-08 commits after that head are governance-
record changes only and do not modify Product/runtime code.

### `QAN-BL-T12-01` — Original Inspection Journey-Origin Binding

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. T-12 supplies the real inspection-journey origin at the integration
  boundary; T-07 remains the final Return execution authority and no origin is manufactured by
  presentation.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-02` — Locale Provider / Regional Numeral Policy

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. One app-level locale authority is integrated; language and direction
  remain independent; Egypt is the v1 region where needed; Western `latn` digits remain the v1
  numeral policy unless a later Product contract changes it.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-03` — Final App-Shell Composition

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The real Product root composes the Living Analysis Map owners from one
  canonical runtime/store; the FoundationShell validation path is not the Product route.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-01` — Meaning Ignition Authoritative Trigger

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed by the canonical no-trigger branch. T-12 found no truthful authoritative
  semantic-crystallization signal, therefore **NO MEANING IGNITION CUE SHIPS**. No dormant or
  fabricated trigger was introduced.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-02` — Exact Composite Spatial-Cause Binding

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The exact `GO_LIVE_AND_LOCATE` cause is bound one-shot to its exact
  camera transition and cannot be borrowed by an unrelated act.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-03` — Physical Motion Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** passed under the T-12 platform matrix. Release-equivalent Android hardware evidence
  on the Honor X9b plus iOS Release native/simulator evidence showed no blocking teleport, jank or
  truth/parity violation. The protected Pan baseline remained 0.00% janky in measured runs and the
  user's physical judgement was smooth, fast, direct and comfortable.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-04` — Direct-Drag Presentation Culling

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** hardware testing reopened this item by proving blank-entry / sudden pop-in. T-12
  fixed the stale live-drag visibility corridor with bounded presentation admission; before/after
  evidence reduced the largest release-time admission jump from **+26.55 points to 0.00**, and the
  user confirmed the visible pop-in was completely gone while Pan feel improved.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-RSP-01` — Physical Responsive Recomposition Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** passed after T-12 corrected the short-landscape allocation defect. Android physical
  portrait↔landscape round-trips and iOS Release native composition kept all truth-bearing regions
  visible; no zero-height support region remained; affected large-text/RTL coverage passed.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-RSP-02` — Outboard Live Label Clipped at Large Text

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The final integrated responsive composition preserves visible and
  accessible Live wording at the required large-text envelope while keeping the outboard control
  separate from Moment-targeting space and preserving T-05 measurement authority.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-04` — Mobile Auth Session Storage Production Security + Device Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed for T-12. Android hardware and iOS Release-simulator lifecycle validation
  proved persist/restore, token replacement, sign-out removal, identity isolation and auth-only
  restoration. Architecture/Security produced
  [`t12-auth-storage-at-rest-disposition-v1.md`](t12-auth-storage-at-rest-disposition-v1.md) and
  explicitly accepted the v1 isolated SQLite risk boundary; no custom cryptography was introduced.
  The narrower platform-hardening residue — Android backup policy and physical iOS backup/Data-
  Protection attestation — is admitted separately as `QAN-BL-SEC-01`, not left hidden inside this
  closed item.
- **Status:** `CLOSED — TOMBSTONE`

---

## 7. Counts at this baseline

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

T-12 inherited ten items and all ten are now tombstoned. `QAN-BL-SEC-01` is the sole new BG-08
admission from T-12 closure residue.

---

## 8. What is deliberately not in this backlog

- **Current unresolved blockers.** By BG-01 they do not belong here at all.
- **Speculative features.** Nothing enters because it might be nice.
- **Every anti-scope sentence.** Task documents state many boundaries; a boundary is not an
  obligation (BG-06).
- **Implementation design for T-11, T-12 or T-13.** Entries name obligations, never solutions.
- **Estimates, priorities and schedules.** Severity is consequence, not order.
- **Detailed code solutions and duplicate aliases** for items already recorded.
- **Already-closed work**, except as a tombstone.

Items resolved *within* the tasks that raised them — the T-10 R1 / R2 / R3 corrections, the T-06
FCR findings, the T-08 R1 / R2 / R3 corrections, `OPEN-17` — are closed work and are not recorded
here. Their record is the canonical document of the owning task.

---

## 9. Task lifecycle checklist (BG-05 at kickoff, BG-08 at closure)

### At kickoff (BG-05)

At the kickoff of any future task, Architecture:

1. reads this document in full;
2. lists every open item whose **Owner task** matches the task being opened;
3. for each, records one of: *included in this contract*, *re-owned to <named task>*, or *remains
   deferred, because <reason>*;
4. confirms that no finding from the previous task's review was moved here in violation of BG-01;
5. leaves any `OPEN — UNASSIGNED` item alone unless the task contract explicitly claims it.

Inherited after T-12 closure reconciliation:

| Task | Items it inherits on kickoff |
| --- | --- |
| `T-11` | none |
| `QAN-SEC-01 — Pre-release Mobile Credential Security` | `QAN-BL-SEC-01` |
| `T-13 — Recovery / Persistence` | `QAN-BL-T13-01` |
| `T-12 — Final Integration` | none — reconciled and tombstoned under BG-08 / PR #220 |

T-11 inherits nothing from this backlog. That historical kickoff invariant remains true after T-12 closure reconciliation.

### At closure (BG-08)

Before any task is declared CLOSED / FROZEN, Architecture:

1. reconciles every backlog item that task inherited — completed → `CLOSED — TOMBSTONE` with the
   closing task, PR and SHA and disposition; re-owned to one named task; or still deferred with a
   recorded reason;
2. admits every newly accepted cross-task deferral that qualifies under BG-06, with the complete
   schema of §2;
3. leaves every current blocker where it belongs — inside the active task, fixed (BG-01);
4. does not declare the task CLOSED / FROZEN while a qualifying cross-task residue exists only
   outside this document.

### T-12 closure record

T-12 BG-08 reconciliation is complete on PR #220 against final implementation/validation evidence
head `02bff1b61c65c33a0d186da52dfa25d25baebe9e`: all ten inherited items are tombstoned, the one
qualifying new security residue is admitted as `QAN-BL-SEC-01`, and no T-12 Product, validation,
Architecture or Security blocker remains open in this register. The BG-08 commits after that head
are documentation-only governance records and do not alter Product/runtime code.
