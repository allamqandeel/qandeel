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

**BG-09 — Same-task closure-state synchronization.** A task may not be treated as CLOSED / FROZEN
while its primary canonical task document still advertises a pre-closure lifecycle state such as
`CANDIDATE — awaiting independent review`. The closing task — the change that closes it — performs
BOTH halves itself: the BG-08 backlog reconciliation above, and the update of its own primary
document from its candidate/review banner to its final lifecycle state. A later ordinary task must
not be relied upon to finish a predecessor's closure record. Where a historical omission is
discovered after the fact, it is repaired by an explicit governance-reconciliation task that records
the correction without reopening Product semantics — never by quietly rewriting the record so that
the omission appears not to have happened.

This complements BG-08; it does not replace it, duplicate it or relax it. BG-08 remains the one
authority for what the backlog must say at closure, and this document remains the one backlog: BG-09
adds no second register, no second lifecycle model and no new Product state. It governs only the
agreement between a closed task's own banner and the closure the register already records.

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
| `QAN-BL-T13-01` | Restart / Recovery / Persistence | `T-13 — Recovery / Persistence v1` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-NAV-01` | Cross-Session Timeline | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-NAV-02` | Analysis Replay | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-VOICE-01` | Personal Voice / Live Call Runtime + Durable Audio Source | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-AUTH-01` | Mobile Product Sign-In Gateway | `T-14 — Mobile Product Sign-In Gateway v1` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-VIS-01` | Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-CTX-01` | Runtime-backed Conversational Relevance | `QAN-CTX-01 — Conversational Relevance Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-CW-01` | Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`) | `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-LANTERN-01` | Lantern Gateway Identity Moment v1 — Creative / Motion / Interaction Realization | `QANDEEL — Lantern Gateway Identity Moment v1` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-ACCT-01` | Account Deletion Across Connected Worlds — Explicit Connected-Worlds Deletion Blocker | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-PROD-01` | Unbounded Per-Account Turn Admission and Foreground AI Spend (PR01-S02) | `PROD-SEC-02 — Turn Admission Concurrency & Cost Bound` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-PROD-02` | API Baseline Hardening: Rate Limiting, Trusted Proxy, Header Baseline (PR01-S01 / S-03 / S-04) | `PROD-SEC-01 — API Baseline Hardening` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-PROD-03` | Operational Readiness & Silent-Failure Visibility: Readiness Probe (PR01-S05), Privacy Deletion / Export Preparation / Confidence Re-evaluation Silent Failures (P-1 / P-5 / U-4), Stuck-Job Visibility | `PROD-OPS-01 — Operational Readiness & Silent-Failure Visibility` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-PROD-04` | Remote Auth Verification Cost and Capacity (PR01-A01 / A-03 / A-04) | `PROD-AUTH-01 — Auth Verification Path` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-PROD-05` | List / Fan-out Corrections and Unmeasured Payload / Semantic-Phase Sizes (PR01-D/M) | `PROD-DATA-01 — List/Fan-out Correction` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-LAUNCH-01` | Trusted Proxy / Edge / Origin Production Proof | `LAUNCH-EDGE-SECURITY-GATE — Trusted Proxy / Edge / Origin Production Proof` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-LAUNCH-02` | Retired Login ID / Public ID Digest: Keyed (HMAC) Hardening Under Managed Key Custody (P-7) | `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-PRIV-01` | Export My Data Omits the Reader's Later Explicit Agreement with a Disagreed Understanding Item | `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-A11Y-01` | Reduce Motion Read Only at Launch by the T-10 Camera / Temporal Motion Hooks | `VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-NOTIF-01` | Native Push, OS Permission and Platform Delivery for the A3-01 Activity Spine | `A3-02 — Native Push, Permission & Platform Delivery Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-NOTIF-02` | No Proactive QANDEEL Gate and No Proactive Event Producer | `PROACTIVE-EVT-01 — Proactive QANDEEL Gate & Event-Producer Integration` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-NOTIF-03` | No User-Requested Exact-Time Reminder Runtime and No Reminder Event Producer | `REMINDER-EVT-01 — User-Requested Reminder Runtime & Event Producer` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-NOTIF-04` | No Security / Sign-in / Account Event Source for Activity | `ACCOUNT-SEC-EVT-01 — Account & Security Event-Producer Integration` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-PRIV-02` | Export My Data Omits the Reader's Notifications & Activity Preferences and Context Mutes | `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-NOTIF-05` | Native Push Physical-Device Exit Gates (PD-01 … PD-09) | `Release Hardening & Launch — physical iOS / Android device validation` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-LAUNCH-03` | Shared ID Sealing Key: Production Custody, Provisioning and Rotation | `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-CI-01` | iOS Simulator Maestro / XCTest Driver Startup Reliability in Mobile CI | `CI-IOS-01 — Maestro / XCTest Driver Startup Reliability` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-CW-02` | Shared Standing Context Product & Private-Source Integration | `SHARED-CTX-01 — Shared Standing Context Product Integration` | `HIGH` | `DEFERRED — OWNED` |

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

> **Historical pre-closure schema retained for the frozen T-07 / T-08 deferrals only.** This block
> records what T-13 inherited before it ran. It is not the current lifecycle state; the current state
> is the `CLOSED — TOMBSTONE` record in §6 below.

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
- **Why deferred:** T-07 explicitly excludes Replay, and no current owner is frozen. The Replay
  *backend runtime* has since been built and closed by `I-06`; what this item names — a surface
  through which a human can actually watch an analysis develop — has no frozen owner still.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated Replay contract. *(Satisfied and consumed for
  the runtime half: `CW2-05 — Replay Runtime Architecture v1.0` is `CLOSED / FROZEN` and `I-06`
  implemented it. The condition is retained as written rather than rewritten, because the record of
  what was asked for is what makes the remaining gap legible. For the remaining half the condition is
  narrower: a canonical contract opens the mobile / Product Analysis Replay surface, and the CW2-08
  and analytical subject-authority prerequisites in the current truth below are resolved.)*
- **Current truth (BG-08 reconciliation at `I-06` closure):** the Replay **backend runtime** exists and
  is `CLOSED / FROZEN` — migrations `0100`–`0107` implement authorized source capture and draft
  construction, the analytical projection and render truth contract, preview and finalization,
  distribution packaging, distribution authority, export privacy sanitization, the Public
  `REPLAY_ARTIFACT` bridge, post-finalization source availability and current delivery eligibility.
  None of that is the thing this item names. The **final mobile / Product Analysis Replay surface is
  still not implemented** and is outside `I-06`. **Media, storage and transport remain outside `I-06`**
  and deferred by `CW2-05` — no encoder, codec, container, object store, CDN, public URL or delivery
  path exists, and `QANDEEL` guarantees no recall of already-exported copies. **Production Replay
  distribution is `NOT CLEARED / FAIL-CLOSED`** while two prerequisites are unresolved: the
  protected-human analytical subject authority, whose canonical seam answers
  `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT`, and the `CW2-08` Safety / moderation / entitlement /
  feature / Launch Gate runtime, whose canonical seam answers `NOT_EVALUATED` on every dimension.
  Neither is deferred *here*: each fails closed in the runtime itself and is owned by its own frozen
  `CW2-0N` contract, which is why no new backlog item is admitted for either (`BG-01`, `BG-06`).
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-VOICE-01` — Personal Voice / Live Call Runtime + Durable Audio Source

- **Title / Finding:** the Product interaction for Writing / Voice Note / Live Call is now closed at
  proof level, including Analysis-first Live Call, background continuation and exact in-call surface
  restoration, but the repository still has **no canonical Personal Voice / Live Call runtime** and
  no durable Personal original-audio source.
- **Source:** `I-08B3.1-G1.2 — Voice + Live Conversation Experience Proof`, closed after independent
  Product / Design review. Reviewed proof ZIP SHA-256:
  `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96`; bounded R1 direct
  correction ZIP SHA-256:
  `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11`.
- **Why deferred:** G1.2 deliberately proves Product behavior without inventing the provider,
  realtime transport, native call lifecycle, media persistence, audio retention/deletion,
  interruption semantics, device integration or production permission/service declarations.
  Personal Replay original audio remains non-producible until a reviewed durable source exists.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`
- **Reopen condition:** Architecture opens the Personal Voice / Live Call runtime implementation
  track, or a production implementation task explicitly claims realtime two-way audio, Voice Note
  persistence/playback, background-call lifecycle, or durable Personal original audio.
- **Required future properties:** one canonical call/session authority; provider-agnostic realtime
  audio boundary; native iOS/Android call lifecycle and background behavior; truthful microphone and
  route state; interruption/reconnection semantics; durable Voice Note audio if history playback is
  shipped; consent/retention/deletion for any Personal original audio; and a reviewed source
  contract before audio-led Replay can claim the original call.
- **Status:** `OPEN — UNASSIGNED`

This item does not reopen G1.2 Product proof. It records the implementation/runtime residue that G1.2
was explicitly forbidden to invent.

**Current truth (BG-08 reconciliation at P4 closure).** P4 adds no alias for this item and changes none of its fields.
It records the P4 residues that wait on this item's future runtime truth, so they stay discoverable here:

- signal-bearing Voice morphology — live waveform, speaking / listening / activity morphology, live audio levels — which
  [P4-C2 §4](canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md)
  keeps gated here and forbids faking. The non-signal Voice visuals are frozen by the P4 closure;
- Voice / call state strings (P4-C2 §5; VI-01 V01–V07, whose "Phase VII" owner does not exist), including the call words
  P3-A's copy table had marked `CANON` (P4-C3 finding F-03);
- the P4 census rows that depend on it: the truthful speaking indicator (`P4-GAP-023`), whether a Voice Note gains a
  machine transcript (`P4-GAP-024`), native call behaviour (`P4-GAP-025`) and a spoken-reply control (`P4-GAP-026`);
  the transcript and spoken-reply rows also need provider evidence from the End-to-End audit;
- APP-OPS-01's approved call-status operational domain, which cannot be emitted before a call authority exists.

None of these is decided here, and none authorizes implementation (BG-07).

### `QAN-BL-AUTH-01` — Mobile Product Sign-In Gateway

> **Historical pre-closure schema retained for the frozen T-12 / T-12P residue only.** This block
> records the obligation as it was admitted, with no owner. It is not the current lifecycle state;
> the current state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** there is no Product mobile sign-in experience, and no task owns one. The
  Product has no entry path for a signed-out reader.
- **Source:** [T-12 §14 residual limitations](final-living-analysis-map-integration-v1.md) — "There
  is no mobile sign-in experience, and no task owns one. T-12P shipped the capability and named no
  owner for the gateway. It is not T-12's, and it is not registered in the canonical backlog."
  Corroborated by [T-12P §8](mobile-runtime-entry-preconditions-v1.md) ("No login experience.
  `signInWithPassword` is a runtime capability for a future auth gateway to call.") and by
  [T-12 Phase M §11](final-living-analysis-map-integration-v1-phase-m.md), which routes around the
  absent gateway rather than building one.
- **Why deferred:** T-12P owns authentication/runtime capability and T-12 owns final Living Analysis
  Map integration, but neither task owns or defines the Product-facing login/onboarding gateway.
  Implementing it requires a dedicated Product/experience contract rather than being smuggled into
  T-12 closure or T-13 recovery.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`
- **Reopen condition:** Architecture opens a dedicated Product authentication / onboarding gateway
  task, or pre-release readiness requires a real Product entry path for signed-out users.
- **Status:** `OPEN — UNASSIGNED`

This entry authorizes **no implementation**. Its boundaries, stated so the obligation is not
misread as a decision:

- the validation-only T12-04 auth harness is **not** the Product login experience and must not be
  promoted into one by implication;
- the existence of Supabase auth capability, auth-session persistence, or `signInWithPassword` is
  not the same thing as a Product login gateway;
- `T-13 — Recovery / Persistence` does not own this item merely because T-13 interacts with
  authenticated identity;
- `QAN-SEC-01 — Pre-release Mobile Credential Security` does not own this Product experience merely
  because it owns credential security (`QAN-BL-SEC-01`);
- no visual language, onboarding flow, registration flow, password-recovery flow, social auth,
  account creation, account linking, or credential UX semantics are defined by this entry.

The backlog records the obligation only (BG-07).

### `QAN-BL-CTX-01` — Runtime-backed Conversational Relevance

- **Title / Finding:** QANDEEL has current conversational attention (Live Focus), explicit user-owned cross-context bindings, Memory/HIM/Hypothesis/Question foreground lanes and a Living Analysis World, but no single runtime/client authority that says which eligible analytical items are more or less related to **what the current conversation is about right now**.
- **Source:** [P4-C1 §5–§6](canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md), preserving and re-owning Phase V V10 A22/A23 after retiring the dedicated Live Context Product surface.
- **Why deferred:** P4 closes Product / visual decisions and implements no runtime. P4-C1 deliberately removes the obsolete dedicated Live Context drawer/panel rather than shipping a UI that pretends the missing relevance signal exists. The runtime authority, integration contract and proof need one dedicated Architecture/Runtime task.
- **Owner task:** `QAN-CTX-01 — Conversational Relevance Runtime`
- **Severity:** `HIGH`
- **Reopen condition:** automatic when `QAN-CTX-01` starts; and it MUST be opened before any production feature claims that item-level contextual relevance drives Living Analysis spatial recomposition, motion, presence, or a general cross-domain relevance selection.
- **Required future properties:** one explicit runtime-backed relevance contract; fail-closed absence (no fabricated default/neutral score); preserve A15 non-equivalence (relevance is not importance, truth, confidence, evidence strength, priority, rank, certainty or correctness); preserve explicit user Context Activation as explicit and never silently auto-bind Goal / Situation / Decision / Relationship targets from inferred relevance; expose a client-consumable signal before visual spatialization; provide a non-spatial accessible equivalent and reduced-motion parity for any visual expression; do not let response-context selection and visual-world behavior silently invent incompatible independent meanings of "relevant".
- **Status:** `DEFERRED — OWNED`

This entry freezes **no algorithm**. It does not choose embeddings, scores, thresholds, provider/model, storage, refresh cadence, ranking shape or UI. Those require the future Task Contract. The dedicated «سياق الكلام» / Live Context surface remains retired by P4-C1.

### `QAN-BL-VIS-01` — Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof

- **Title / Finding:** the canonical I-08B1 Living Analysis World has only been proved on its fixture world. Nothing
  shows how its density, level of detail, legibility and performance behave when a reader's conversation history is
  long-term and heavy.
- **Source:** [G2 closure §G item 8](design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md) ("HEAVY-HISTORY /
  LONG-TERM WORLD DENSITY + LOD STRESS PROOF — future stress proof"), carried unchanged by the
  [G3 readiness handoff §7](design/i-08b3.1-g2/QANDEEL_G3_READINESS_HANDOFF.md), and admitted by the
  [I-08B3.1-G3 closure §H](design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) when parent G closed.
- **Why deferred:** G3 was forbidden to redesign I-08B1, and its fixture world stays canonical. A stress proof needs
  heavy-history material and may need a reconciliation with the frozen D-track contract. Parent G closes without it and
  can no longer hold it.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`, because if reopened it can affect an already-frozen capability, the I-08B1 world.
- **Reopen condition:** Architecture or Product opens a world-scale density / level-of-detail proof task; or a production
  port, or real long-term history, shows the frozen world losing legibility, semantic truth or performance at scale.
- **Status:** `OPEN — UNASSIGNED`

This entry defines no density, no level-of-detail rule, no token and no world change. Any change to the world still passes through I-08B1's own reopen rule. The Product Owner's ruling that the F1 / F2 North Star spectacle requirement is met (G3 closure §E) is a separate, fully dispositioned obligation and does not answer this G2 heavy-history stress item.

### `QAN-BL-CW-01` — Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`)

> **Historical pre-closure schema.** This block records the item as admitted and re-owned. It is not the current lifecycle
> state; the current state is the `CLOSED — TOMBSTONE` record in §6 below (S5-02).

- **Title / Finding:** owner deletion of Shared material never reaches the Public DRAFT derivative. Preparing a
  Public Experience manifest copies the author's Shared material into
  `public_experience_text_derivative_bodies` as a `SOURCE_CONTENT_BEARING_DERIVATIVE`. That row has no deleter
  and is immutable. `resolve_public_experience_review_v1`, executable by `service_role`, returns the body
  without checking current source availability. After the author deletes the material, a different human, the
  Experience's controller, can still read the deleted text through that review boundary, permanently. Every
  outward Public surface correctly goes dark; the internal controller review surface does not.
- **Source:** assurance finding `ASSURE-F05` (severity `HIGH`), in the `QAN-CW-ASSURE-01` register, preserved as
  evidence in
  [`assurance/connected-worlds/QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md`](assurance/connected-worlds/QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md)
  (SHA-256 `53ccf85f…68d8fe4`). The frozen invariants it cites are CW2-02 §27 (B19 / B20), CW2-03 §37 (C32),
  CW2-01 A18 and CW2-08 §2 ("deleted-content non-serving" is non-waivable), now preserved in
  [`canonical-authority/connected-worlds-v2/architecture/`](canonical-authority/connected-worlds-v2/architecture/).
- **Current truth:** not implemented on `main` in any form. Migration `0121` states "It implements no part of
  ASSURE-F05". Migration `0122` states "ASSURE-F05 is not implemented here in any form", and its deploy-time
  self-assertion `B7` refuses an owner-deletion body that touches Public state ("ASSURE-F05 is not authorized
  here"). Their tests assert that neither implements it
  (`database/tests/public-replay-consistency-historical-retry-remediation-v1.test.mjs`,
  `database/tests/introduction-disclosure-privacy-erasure-v1.test.mjs`).
- **Why deferred:** no remediation task has owned it. `QAN-CW-REM-01` … `REM-03` remediated other findings of
  the same register and explicitly excluded this one. The finding is cross-phase: I-05A owns the derivative
  and review boundary, I-04G / I-07D the deletion primitive, and I-05C the disappearance census. Its full
  remedy includes an open Product ruling: whether the retained bytes must also be destroyed, which would need
  a reviewed exception to the `0092` immutability guard. No write path reaches it today, because
  `prepare_public_experience_manifest_v1` is executable by no application role. The read boundary is already
  `service_role`-reachable.
- **Owner task:** `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` (re-owned by S5-01 at the Product
  Owner's designation, 2026-10-06; previously `UNASSIGNED`)
- **Severity:** `HIGH`, as the source states. The register keeps HIGH over one refuter's MEDIUM, because CW2-08
  §2 makes deleted-content non-serving non-waivable and the retention is permanent.
- **Reopen condition:** Architecture opens a Connected Worlds remediation or integration task for Public
  derivative source availability; or any task proposes opening Public draft creation or manifest preparation
  to an application role (the CW2-08 launch gate); or any task adds a reader of
  `public_experience_text_derivative_bodies`.
- **Required future property:** after owner deletion, no internal or public boundary serves a
  source-content-bearing Public derivative of the deleted material. This is the property CW2-02 §27 and CW2-08
  §2 already state; this entry adds none.
- **Status:** `DEFERRED — OWNED` (previously `OPEN — UNASSIGNED`)

Admitted by the recovered canonical authority preservation, at the explicit direction of Architecture / the
Product Owner (BG-06). This entry chooses no remedy. The register's "remediation direction" is evidence, not a
decision, and nothing here authorizes implementation (BG-07).

**Current-truth note (W3-PDG-01, 2026-09-30).** The
[W3-PDG-01 Product Decision Closure](canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md)
§8.5 names this item as one cause of the `EXPLICIT CONNECTED-WORLDS DELETION BLOCKER` on account deletion, carried
as `QAN-BL-ACCT-01`. This note changes none of this item's fields: it stays `UNASSIGNED`, `HIGH`,
`OPEN — UNASSIGNED`, and its own open Product ruling on the retained bytes is still not answered.

**Current-truth note (S5-01, 2026-10-06; Product Owner decision, recorded — not implemented).** The Product Owner has
answered this item's open Product ruling, as a binding Stage-5 decision:

> When owner deletion makes a source-content-bearing Public derivative derive from deleted owner content, the
> derivative's retained CONTENT BYTES must be physically erased. Audit/provenance identity needed to truthfully record
> that an item existed may remain, but the deleted source content must not remain recoverable through Public
> Draft/review storage.

The Product Owner assigned the item to `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure`, which must close
`ASSURE-F05` before any application-reachable Draft / review creation path is opened. S5-01 implements no part of it:
migration `0142` opens no Draft, manifest or review path and adds no reader of `public_experience_text_derivative_bodies`,
so the finding is not made newly reachable. The finding itself, its source, severity, required future property and
reopen condition are unchanged; only the owner and the status move (`OPEN — UNASSIGNED` → `DEFERRED — OWNED`). The
physical erasure needs the reviewed exception to the `0092` immutability guard that this item already names; that
exception, too, is S5-02's. `QAN-BL-ACCT-01` is not absorbed and stays `OPEN — UNASSIGNED`.

### `QAN-BL-ACCT-01` — Account Deletion Across Connected Worlds — Explicit Connected-Worlds Deletion Blocker

- **Title / Finding:** the Product Owner froze the Delete Account journey and principles: true deletion, not disable;
  re-authentication; a short grace period; final deletion after it; sessions ending; Personal-world deletion intent;
  removal of the user's own Shared / Public material where authority allows. No Connected World (Shared, Public,
  Replay, Introductions) has an end-to-end account-deletion contract sufficient to prove that account deletion can be
  carried out there completely, safely and truthfully.
- **Source:** [W3-PDG-01 Product Decision Closure](canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md)
  §8.4 item 9 (the Launch Gate) and §8.5 (`EXPLICIT CONNECTED-WORLDS DELETION BLOCKER`). The evidence is in the
  [decision package](e2e/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_DECISION_PACKAGE_v1.md) §4.7 and §6. It rests on
  `QAN-BL-CW-01` (`ASSURE-F05`) and on `ASSURE-O04` in the
  [assurance register](assurance/connected-worlds/QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md): `ON DELETE
  RESTRICT` chains leave Connected Worlds participants with no hard-deletion path.
- **Current truth:** no account-deletion code exists on `main`. The Connected Worlds runtimes (I-04 … I-07) are
  database / server only, with no user surface. Their owner-deletion, disappearance and source-availability primitives
  exist per world. No account-level deletion contract joins them.
- **Why deferred:** the Product Owner explicitly left the exact Shared / Public / Connected Worlds deletion behaviour
  open (closure §8.5), and forbade inventing a remedy for foreign keys or retained derivatives inside W3-PDG-01. The
  proposed W3 tasks, which are not opened, cover the Personal world only (closure §9).
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`. If this is reopened, it decides whether any Connected World may launch (closure §8.4 item 9),
  and it lands on the frozen CW2-08 §2 non-waivable deleted-content non-serving law.
- **Reopen condition:** Architecture or the Product Owner opens a task to take any Connected World toward
  production-ready for users; or opens a Connected Worlds account-deletion or erasure task; or assigns an owner to
  `QAN-BL-CW-01`.
- **Required future property:** the one the closure already states, and no other. No Connected World is considered
  production-ready for users while Account Deletion cannot meet its deletion contract there.
- **Status:** `OPEN — UNASSIGNED`

Admitted by the W3-PDG-01 Product Decision Closure under BG-06, as a canonical record's explicit deferral. This
entry chooses no deletion mechanism, erasure exception or retention rule. Nothing here authorizes implementation
(BG-07).

**Current-truth note (S4-01, 2026-10-05).** S4-01 takes the Shared World toward users (the reopen condition's first
clause) and records the disposition here: this item stays `OPEN — UNASSIGNED` and unchanged in scope. S4-01 ships the
Shared launch gate CLOSED (no migration configures it), claims no production readiness, provisions a Shared ID only on
the owner's first Shared ID read while Shared is open (so an account that never reaches Shared gains no Connected Worlds
reference), and states Account Deletion across Connected Worlds as a launch prerequisite of the Shared capability
([S4-01 record](e2e/QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md) §7, §11, §16).

**Current-truth note (S5-01, 2026-10-06).** Two of this item's reopen clauses are observed: S5-01 takes the Public World
toward users (an authenticated, content-empty Public root), and `QAN-BL-CW-01` now has an owner (`S5-02`). At the Product
Owner's direction this item is not absorbed: it stays `OPEN — UNASSIGNED`, unchanged in scope, as the separate launch
blocker it is. S5-01 provisions no I-05 Public Identity (the `public_identities` row is `ON DELETE RESTRICT` to the
account), so no account becomes undeletable by opening Public World or choosing a Public display mode; the display choice
row cascades with the account. S5-01 claims no production readiness for the Public World
([S5-01 record](e2e/QANDEEL_S5_01_PUBLIC_REACHABILITY_ENTRY_IDENTITY_FOUNDATION_IMPLEMENTATION_RECORD_v1.md) §6, §12).

**Current-truth note (S5-02, 2026-10-06).** S5-02 creates a real Public authoring footprint, which makes this item MORE
important and does not solve it. The first real authoring act provisions the ONE I-05 Public Identity (`ON DELETE
RESTRICT` to the account), and a prepared package's sealed provenance references the author's Personal committed units
(`RESTRICT`), so the governed Personal erasure (`0130`) truthfully answers BLOCKED for an account that has authored. The
Public World is NOT production-launch-ready while this item is unresolved, and `CW2-08` stays closed: S5-02 ends at
`READY_FOR_REVIEW`, which is not public. This item stays `HIGH`, `OPEN — UNASSIGNED`, unchanged in scope; S5-02 invents no
Connected-Worlds account-deletion contract
([S5-02 record](e2e/QANDEEL_S5_02_PUBLIC_PUBLISHING_RIGHTS_DRAFT_REVIEW_PRIVACY_CLOSURE_IMPLEMENTATION_RECORD_v1.md) §13).

**Current-truth note (S5-03A, 2026-10-06).** S5-03A does not solve this item, and it adds to the footprint the item covers.
No S5-03A column names an account and no foreign key reaches one directly, but its semantic relations bind the Experience
Version and the 0096 Semantic Placement `ON DELETE RESTRICT`, and every 0096 revision it writes through the frozen primitive
binds its recorder's Public identity and account (`RESTRICT`, as I-05 froze it). Those dependencies — Experience Version,
Semantic Placement, `ON DELETE RESTRICT` — are recorded here as part of this blocker and are not resolved by S5-03A. An
author's governed Personal erasure was already BLOCKED (S5-02 note above) and still is. This item stays `HIGH`,
`OPEN — UNASSIGNED`, its scope unchanged; the Public World is still not launch-ready ([S5-03A record](e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md) §15).

**Current-truth note (S5-03B, 2026-10-06).** S5-03B does not solve this item, and it adds to the footprint the item covers.
No S5-03B column names an account and no foreign key reaches one directly, but its two spatial relations
(`public_spatial_private.spatial_requests`, `spatial_placements`) bind the Experience Version and the S5-03A semantic
interpretation `ON DELETE RESTRICT` — and that interpretation binds its `0096` placement, which binds its recorder's account.
Those dependencies — Experience Version, S5-03A interpretation, `ON DELETE RESTRICT` — are recorded here as part of this
blocker and are not resolved by S5-03B. This item stays `HIGH`, `OPEN — UNASSIGNED`, its scope unchanged; the Public World
is still not launch-ready ([S5-03B record](e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md) §15).

### `QAN-BL-LANTERN-01` — Lantern Gateway Identity Moment v1 — Creative / Motion / Interaction Realization

- **Title / Finding:** the exceptional lantern gateway identity moment is frozen as **present in v1**, but it has no
  design, motion, interaction choreography, implementation technology or proof. P4 froze only its presence and journey
  placement: the gateway identity moment of the launch journey, beyond the static launch → system handoff that P4-C3
  proved and the P4 closure froze.
- **Source:** [P4-C2 §2](canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md)
  ("The exceptional lantern gateway identity moment is in v1"; its visual design, motion design, interaction
  choreography, implementation technology and production proof "are intentionally separated into a later standalone
  task"), which rests on C3's authorization of an exceptional gateway identity object (C3 expressive headroom §4).
  Carried as census row `P4-GAP-019` and admitted by the
  [P4 final closure §9](canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md).
- **Why deferred:** the Product Owner took the work out of P4 by decision (P4-C2 §2). The future task "must begin with
  its own research / skills / creative exploration and independent review"; P4 performed none of that, and P4-C3 drew
  nothing past the lantern boundary. P4 closes and can no longer hold it.
- **Owner task:** `QANDEEL — Lantern Gateway Identity Moment v1`
- **Severity:** `HIGH`, because if reopened the work lands on a capability already frozen as present in v1, at the
  launch / gateway moment every user passes through, next to the frozen static launch → system handoff.
- **Reopen condition:** automatic when `QANDEEL — Lantern Gateway Identity Moment v1` is opened by its own Task Contract;
  and it must be opened before any v1 release, because P4-C2 §2 freezes the moment as present in v1.
- **Required future properties:** the ones existing authority already states, and no others — presence in v1 at the
  gateway identity moment of the launch journey (P4-C2 §2); the static launch → system handoff and the P4-C3R launch
  appearance policy stay as frozen unless that task opens a controlled change; the task begins with its own research,
  creative exploration and independent review (P4-C2 §2); any motion it proposes stays subject to the existing frozen
  motion and accessibility authority (T-10, `QAN-GOV-02`, F1R2), which this entry does not restate or extend.
- **Status:** `DEFERRED — OWNED`

This entry defines **no** animation technology, motion choreography, timing, Q reveal behaviour, interaction mechanics,
visual composition or implementation. Those belong to the named task and its own Task Contract. The entry records the
obligation only (BG-07).

### `QAN-BL-PROD-01` — Unbounded Per-Account Turn Admission and Foreground AI Spend (PR01-S02)

> **Historical pre-closure schema.** This block records the item as admitted, including its pre-merge wording. It is
> not the current lifecycle state; the current state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** one authenticated account could admit any number of cost-bearing conversation turns at once and
  keep doing so: `create_user_conversation_turn` bounded nothing, `claim_conversation_turn` only stops two claimants of
  the same turn, and every turn fans into several model-provider calls (reply, segmentation, focus, Thread continuity
  and establishment), with no request deadline.
- **Source:** `PROD-READINESS-01` review record §15 / §16 (`PR01-S02`, the review's only P0), Draft PR #298 at
  `03685fd55257e1dea5b5eb2049dc0ac0a79b4aa2`, accepted by the Product Owner as the `PROD-SEC-02` corrective.
- **Why deferred:** it is not deferred work but the active corrective. It is admitted here so the obligation never
  survives only in a review record (BG-08), and it stays open until the corrective is implemented, validated and
  accepted.
- **Owner task:** `PROD-SEC-02 — Turn Admission Concurrency & Cost Bound`
- **Severity:** `HIGH`: unbounded provider spend and provider-quota exhaustion for every user, from one ordinary account.
- **Reopen condition:** none needed; the owner task is active.
- **Current truth:** implemented in Draft PR #299
  ([implementation record](e2e/QANDEEL_PROD_SEC_02_TURN_ADMISSION_CONCURRENCY_COST_BOUND_IMPLEMENTATION_RECORD_v1.md)),
  including the R2 correction that bounds replays and semantic retries over time with a durable per-user
  work-start budget and proves the `PT429` → HTTP 429 refusal through live PostgREST; not merged. It becomes `CLOSED — TOMBSTONE` in the change that records the Product Owner's acceptance of that PR.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-PROD-02` — API Baseline Hardening: Rate Limiting, Trusted Proxy, Header Baseline (PR01-S01 / S-03 / S-04)

> **Historical pre-closure schema.** This block records the item as admitted. It is not the current lifecycle state; the
> current state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** no application-layer rate limit on any route, and the unauthenticated
  `/account/login-id-availability` and `/health/ready` are bounded by no layer (S-01). `trust proxy` is unset while
  `request.ip` is forwarded to Supabase Auth as `Sb-Forwarded-For`, so behind a platform proxy the provider's per-IP
  limits collapse into one shared bucket, and `trust proxy = true` would be spoofable (S-03). No header baseline, and
  `X-Powered-By: Express` is sent (S-04).
- **Source:** `PROD-READINESS-01` review record §3 / §15 / §16 (Draft PR #298, `03685fd`); S-03 is also the recorded W2-01
  external gate ([W2-01 record](e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md) §7 item 4 and §11).
- **Why deferred:** its exact trusted-proxy setting depends on the edge / hosting decision that the repository does not
  yet hold (review §4), and it is a separate corrective from the per-account bound.
- **Owner task:** `PROD-SEC-01 — API Baseline Hardening`
- **Severity:** `HIGH`: required before any public production exposure.
- **Reopen condition:** automatic when the Product Owner / Company records the edge and hosting decision, and in any
  case before public production exposure.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-PROD-03` — Operational Readiness & Silent-Failure Visibility (PR01-S05; P-1 / P-5 / U-4; stuck-job visibility)

> **Historical pre-closure schema.** This block records what `PROD-OPS-01` inherited and the direction the Product
> Owner widened it to. It is not the current lifecycle state; the current state is the `CLOSED — TOMBSTONE` record in
> §6 below.

- **Title / Finding:** originally `PR01-S05` alone: the database readiness probe sends `HEAD /rest/v1/` with the
  publishable key and treats any non-2xx as unavailable. Supabase withdrew Data API root access for anon / publishable
  keys (11 March 2026), so the probe received `401` in 20 of 20 measured requests and `/health/ready` always reports
  `503 not_ready`. The Product Owner's `PROD-OPS-01` Task Contract widened the item to the whole Operational Readiness &
  Failure Visibility direction, so these are ONE item with ONE owner rather than orphan rows:
  - `PR01-S05` — the readiness probe above;
  - `P-1` (independent W3 review) — the Privacy deletion pass swallowed every failure: preparation and claim errors,
    erasure and completion errors, and a provider removal that stays `UNAVAILABLE` forever, all with no signal;
  - `P-5` (independent W3 review) — export preparation failed into `FAILED` after three attempts with no bounded
    operational reason;
  - `U-4` (independent W3 review) — the Understanding Confidence re-evaluation failure was swallowed into
    `PENDING_RETRY` with no signal;
  - stuck-job visibility — per-attempt signals do not survive a restart, so stuck Privacy / export work had no
    deterministic aggregate signal.
- **Source:** `PROD-READINESS-01` review record §3.4 / §15 (Draft PR #298, `03685fd`; measurement run `36830247454`); the
  independent W3 review findings `P-1`, `P-5` and `U-4`; the `PROD-OPS-01` Task Contract.
- **Why deferred:** a separate, small operational corrective. No deployment admits traffic through this probe yet.
- **Owner task:** `PROD-OPS-01 — Operational Readiness & Silent-Failure Visibility` (originally named
  `PROD-OPS-01 — Readiness Probe Correction`)
- **Severity:** `HIGH`: a load balancer configured as the health contract prescribes would never admit traffic.
- **Reopen condition:** automatic before any deployment uses `/health/ready` for traffic admission.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-PROD-04` — Remote Auth Verification Cost and Capacity (PR01-A01 / A-03 / A-04)

- **Title / Finding:** every guarded request makes one remote `GET /auth/v1/user` (measured p50 441 ms against 32 ms for a
  Data API round trip), multiplied by the 5-second foreground poll. `/auth/v1/user` is fetched twice on the identity,
  export, deletion and download routes. Supabase Auth capacity under that load is not established. Local ES256
  verification alone was measured to accept a signed-out session's token, so it is excluded.
- **Source:** `PROD-READINESS-01` review record §5–§7 / §15 / §16 (Draft PR #298, `03685fd`).
- **Why deferred:** it needs a Product Owner / security decision among the review's options O1–O3 before any change,
  because it touches session-revocation semantics.
- **Owner task:** `PROD-AUTH-01 — Auth Verification Path`
- **Severity:** `MEDIUM`: latency and capacity, not correctness.
- **Reopen condition:** the Product Owner's choice among O1–O3, or a measured capacity limit from the chosen deployment
  region.
- **Status:** `DEFERRED — OWNED`

**Current-truth note (A3-01, 2026-10-04).** A3-01 adds one authenticated foreground read, `GET /activity/attention`, on a
30-second cadence while the app is in the foreground (never in the background), plus reads when the reader opens
Activity or leaves the Analysis. Each is one more `/auth/v1/user` verification under this item's measurement. This note
changes none of this item's fields.

### `QAN-BL-PROD-05` — List / Fan-out Corrections and Unmeasured Payload / Semantic-Phase Sizes (PR01-D/M)

- **Title / Finding:** the review's optimisations and measurements:
  - **Server:** the O(T²/32) dossier-page completeness re-check; the duplicate memories reads per turn and on
    disagreement.
  - **Mobile:** the launch waterfall; the duplicate launch snapshot; the history re-read on every Analysis return;
    retry without backoff (first-use, `loadOlder`); the idle poll on non-Live screens.
  - **Not yet established, to be measured:** the semantic-phase provider-call count against CU count and Thread count;
    the historical-projection payload; the export-package size; the projection failed-key / open-head stall risk.
  - **Recorded by `PROD-SEC-02`:** its request deadline (default 90 s) stops a semantic walk that would need longer;
    nothing is committed and the exchange stays retryable, but a walk that always needs longer than the deadline
    cannot complete. Measuring that bound against real Thread counts belongs to the same measurement. This is a
    completion / latency item only: the cost of retrying such a walk is already bounded by `PROD-SEC-02`'s durable
    work-start budget, so no AI-cost path is deferred here.
- **Source:** `PROD-READINESS-01` review record §9–§12 / §15 / §16 (Draft PR #298, `03685fd`); the deadline residual from
  the
  [`PROD-SEC-02` implementation record](e2e/QANDEEL_PROD_SEC_02_TURN_ADMISSION_CONCURRENCY_COST_BOUND_IMPLEMENTATION_RECORD_v1.md).
- **Why deferred:** all P2 or not established. None is a defect of a frozen contract, and none may merge distinct truth
  boundaries.
- **Owner task:** `PROD-DATA-01 — List/Fan-out Correction`
- **Severity:** `MEDIUM`
- **Reopen condition:** the Product Owner opens `PROD-DATA-01`; or, for the semantic-phase deadline residual, any
  measurement or production report of a semantic walk that does not complete within the `PROD-SEC-02` deadline.
- **Status:** `DEFERRED — OWNED`

These five entries add no Product semantics and authorize no implementation (BG-07). `QAN-BL-SEC-01` (mobile credential
storage) is a different obligation and is neither duplicated nor re-owned here.

### `QAN-BL-LAUNCH-01` — Trusted Proxy / Edge / Origin Production Proof

- **Title / Finding:** QANDEEL's API now keeps its own boundary: an explicit trusted-proxy topology, a process-local
  rate limit, a header baseline, and a production preflight. What lies outside the repository is still unproven, because
  no hosting or edge provider has been chosen:
  - TLS-only exposure;
  - edge DoS protection;
  - distributed, global rate limits for the abuse-sensitive routes;
  - forwarding-header sanitation by the last proxy;
  - the real proxy addresses for `QANDEEL_API_TRUSTED_PROXIES`;
  - direct-origin bypass prevention;
  - health-check compatibility;
  - the same law for a future WebSocket / Voice path;
  - fail-safe edge failure;
  - Supabase Auth *IP address forwarding* enabled on the hosted project, with one controlled live proof;
  - migration `0133`'s privilege closure confirmed on the hosted project, with an anon call to
    `login_id_is_available_v1` refused there.
- **Source:** `PROD-SEC-01` Task Contract §5.2, §7.2 and §9, and the
  [Launch Edge Security Contract](../infra/LAUNCH_EDGE_SECURITY_CONTRACT_v1.md) §2. That contract is vendor-neutral and
  is the full checklist.
- **Why deferred:** each proof needs the real deployment, which the repository does not hold. Choosing a provider is
  not `PROD-SEC-01`'s decision. The API's own share of every row is implemented and tested, so nothing implementable is
  deferred.
- **Owner task:** `LAUNCH-EDGE-SECURITY-GATE — Trusted Proxy / Edge / Origin Production Proof`, a Final Launch exit
  gate under the roadmap's Release Hardening & Launch layer.
- **Severity:** `HIGH`. Without the origin restriction, every edge control can be bypassed, and without real
  topology the provider's per-IP limits collapse.
- **Reopen condition:** automatic when the Product Owner / Company records the hosting and edge decision, and in any
  case before public production exposure.
- **Required future property:** every item of the contract's §2 carries real-deployment evidence. A gate marked passed
  while the direct-origin proof is missing is a false pass.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-LAUNCH-02` — Retired Login ID / Public ID Digest: Keyed (HMAC) Hardening Under Managed Key Custody (P-7)

- **Title / Finding:** `personal_data_private.identifier_digest_v1()` (migration `0130`) stores retired Login IDs
  and Public IDs as `kind:sha256(lower(value))`. The digest is deterministic and unkeyed. The table is private and
  executable by no client role, so this is not a current direct leak. If the table or a backup were disclosed, though,
  low-entropy identifiers could be guessed offline.
- **Source:** the independent W3 Privacy review's `P-7`, carried into the `PROD-SEC-01` Task Contract as `SEC-G`,
  §10. Its feasibility evidence is in the
  [`PROD-SEC-01` implementation record](e2e/QANDEEL_PROD_SEC_01_API_BASELINE_SECURITY_HARDENING_IMPLEMENTATION_RECORD_v1.md)
  §8.
- **Why deferred:** a safe keyed digest needs a managed secret whose root key lives outside the database and its
  backups, with a provisioning, rotation and dual-read law. None of that can be proven today:
  - the CI database is stock PostgreSQL 17, which has no Supabase Vault, so no migration using it can be verified;
  - this task holds no hosted-project credential, so neither Vault capability nor an aggregate retired-row count could
    be read;
  - the legacy `v1` digests cannot be converted without the original identifiers.

  Improvising would be the "fake hardening" the Task Contract forbids: a public salt, a key in the repository, or a key
  stored beside the data.
- **Owner task:** `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate`
- **Severity:** `MEDIUM`. The residual is offline guessing after a data disclosure, not a reachable defect.
- **Reopen condition:** a managed secret facility is proven both on the hosted project and in a reproducible verifier;
  and in any case before real users can retire identifiers in production.
- **Required future properties:**
  - HMAC-SHA-256 under a managed key that is never in the repository or migrations;
  - a versioned digest prefix (`lid2` / `pid2`) beside the `v1` rows;
  - a dual-read refusal law that keeps every legacy `v1` row refusing reuse until proven absent;
  - an explicit rotation law;
  - structural, O(1) reuse prevention, unchanged.
- **Status:** `DEFERRED — OWNED`

These two launch gates are admitted by `PROD-SEC-01` under BG-08, because a genuine external dependency may not survive
only in a task record. Neither authorizes implementation (BG-07).

### `QAN-BL-LAUNCH-03` — Shared ID Sealing Key: Production Custody, Provisioning and Rotation

- **Title / Finding:** S4-01 (migration `0138`) keeps each owner's CURRENT Shared ID only as an AES-256-GCM ciphertext
  the database cannot open, sealed and opened by the API under `QANDEEL_SHARED_ID_SEALING_KEYS` /
  `QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION`. The key must live outside the repository, the database and its backups.
  The repository holds the mechanism, the fail-closed behaviour and the versioned dual-read (older versions keep opening
  stored values); it cannot hold the production secret, its custody, its provisioning or a rotation runbook.
- **Source:** the [S4-01 implementation record](e2e/QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md)
  §6 and §16; the S4-01 Task Contract §5 items 7–8.
- **Current truth:** with no key configured the Shared ID routes answer 503 and nothing is sealed, opened or shown; no
  clear value exists anywhere. Nothing is exposed; Shared reachability is simply unavailable on that deployment.
- **Why deferred:** a managed secret facility, its custody and its rotation law belong with the hosted deployment, which
  this repository does not hold — the same external dependency `QAN-BL-LAUNCH-02` records for the identifier digest key.
- **Owner task:** `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate`
- **Severity:** `MEDIUM`. If reopened, it decides whether the Shared ID is available in production; a mis-provisioned key
  fails closed rather than leaking.
- **Reopen condition:** before the Shared launch capability (`SHARED_DIRECT_INVITATION`) is enabled on any hosted
  project; or when a managed secret facility is provisioned for the API.
- **Required future properties:** a 256-bit key per version from a managed secret store, never in the repository,
  migrations or database; an explicit active version; old versions retained until no stored value uses them (a
  regeneration re-seals under the active version); loss of a key is handled by regeneration, never by a clear fallback.
- **Status:** `DEFERRED — OWNED`

Admitted by `S4-01` under BG-08 / BG-06 (a genuine external dependency). Nothing here authorizes implementation (BG-07).

---

### `QAN-BL-CI-01` — iOS Simulator Maestro / XCTest Driver Startup Reliability in Mobile CI

- **Title / Finding:** on S4-01's exact head `ada631562686c7e05f607c5a4e0ce73664c1eed4`, Mobile CI run `37298360178` failed
  its iOS boot smoke twice (attempt 1, and the one VAL-01 infrastructure retry, attempt 2) at the same step, `Maestro
  driver readiness (bounded)` (`maestro hierarchy` under a 300 s bound), with the same
  `xcuitest.installer.LocalXCTestInstaller$IOSDriverTimeoutException: iOS driver not ready in time`. The step only
  starts Maestro's XCTest driver on the booted simulator; the app was never opened in either attempt and the boot smoke
  itself was skipped. The iOS Release simulator build and its artifact provenance passed in the same run; the immediately
  prior branch head (`77a2c4c`, run `37293964488`) passed the identical step and smoke, as did every earlier Mobile CI
  run that reached it.
- **Source:** the [S4-01 implementation record](e2e/QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md) §14 (exact-head CI cycle and the persistent iOS exception).
- **Current truth:** classified **PERSISTENT INFRASTRUCTURE — NOT PRODUCT / NOT VALIDATION LOGIC**. The VAL-01 retry
  budget (one infrastructure retry) was spent and exhausted; no second retry was made, and no timeout, workflow or Product
  change was made to turn the check green. The Mobile CI `MOBILE_NATIVE_BINARY` evidence for that head is recorded
  NOT GREEN for this reason alone.
- **Why deferred:** CI runner / simulator / Maestro driver reliability is infrastructure, outside S4-01's Product scope;
  the reviewer dispositioned the red check as an isolated infrastructure exception and excluded it from S4-01 (BG-01: no
  Product contract is left violated; the S4-01 Product proof — API CI, the S4 device suite — is green on that head).
- **Owner task:** `CI-IOS-01 — Maestro / XCTest Driver Startup Reliability`
- **Severity:** `MEDIUM`. If reopened, it decides whether Mobile CI's iOS boot smoke is dependable evidence; it gates no
  Product truth, and physical-device iOS validation stays separately owned (`QAN-BL-NOTIF-05`).
- **Reopen condition:** the next Mobile CI iOS boot smoke that fails at driver readiness on any head; or before any task
  that relies on the iOS boot smoke as release evidence.
- **Required future properties:** a diagnosed cause (runner image, simulator boot state, Maestro / XCTest driver
  startup) with evidence; any timeout or retry change justified by measurement and kept bounded under VAL-01; no change
  that weakens what the smoke proves.
- **Status:** `DEFERRED — OWNED`

Admitted by `S4-01` under BG-08 / BG-06 (explicitly designated by the reviewer as a named follow-up). It is not part of
S4-01's scope, and nothing here authorizes implementation (BG-07).

---

### `QAN-BL-CW-02` — Shared Standing Context Product & Private-Source Integration

- **Title / Finding:** S4-02 delivers the request-driven Shared QANDEEL reply over the frozen I-03 chain with Shared-native
  history only. Its census (S4-02 record §7.1) found no canonical way for Personal context to reach a Shared reply: the
  Standing Context grant exists in the database (`0076`–`0078`) but no Product surface, request or copy reaches it; no
  document defines which self-authored `MY_WORLD` source a `SharedPrivateContextCandidate` is drawn from or how it is
  selected, and no collector exists; the Source Disclosure detector (`SHARED_SOURCE_DISCLOSURE_DETECTOR`) and the
  Personal source-state resolver (`SHARED_PRIVATE_SOURCE_STATE_RESOLVER`) have no implementation.
- **Source:** the [S4-02 implementation record](e2e/QANDEEL_S4_02_SHARED_CONVERSATION_MATERIAL_IMPLEMENTATION_RECORD_v1.md)
  §7.1 and §13 (`G-08`); CW2-02 §16–§21, §58; CW2-03 §39; I-03E / I-03F / I-03G; E2E row `E2E-G-08`. Designated by the
  Product Owner at the S4-02 final pre-push decision (2026-10-05).
- **Current truth:** S4-02 offers the frozen EffectiveContext NO private candidate and binds both dependency contracts to
  fail-closed implementations (never CLEAR, never AVAILABLE), unused with zero candidates. Personal Memory, Understanding,
  HIM, hypotheses and conversation never enter a Shared reply. The Shared-history portion of `G-08` is delivered; the
  private-context portion is NOT closed.
- **Why deferred:** each missing part is a reviewed Product / privacy boundary of its own; inventing a Personal source,
  collector, detector or source-state resolver inside S4-02 would be engineering inventing Product and authority logic
  (`AGENTS.md` §2). It does not block S4-02's Shared conversation over Shared-native history.
- **Owner task:** `SHARED-CTX-01 — Shared Standing Context Product Integration`
- **Scope:** the canonical self-authored `MY_WORLD` source definition and its server-owned collector; the JIT Standing
  Context permission Product surface and its copy; `SharedPrivateContextCandidate` production; the server-owned Source
  Disclosure detector implementation; the Personal source-state resolver; the authority and privacy proofs.
- **Severity:** `HIGH` — if reopened, it decides whether a participant's private Personal context can influence what
  QANDEEL says to other people in a Shared World.
- **Reopen condition:** before any production Shared QANDEEL feature claims to consume Personal / private context.
- **Required future properties:** relevance never becomes authority; the grant is requested just in time, privately, to
  the exact grantor and revocable for future reasoning; the detector is bound to one exact operation; the source-state
  resolver is digest-only; admitted context stays reasoning-only and never becomes material consent or a material
  dependency; every part fails closed.
- **Status:** `DEFERRED — OWNED`

Admitted by `S4-02` under BG-08 / BG-06 (explicitly designated by the Product Owner as a named follow-up). It is not part
of S4-02's scope, and nothing here authorizes implementation (BG-07).

---

### `QAN-BL-PRIV-01` — Export My Data Omits the Reader's Later Explicit Agreement with a Disagreed Understanding Item

- **Title / Finding:** W3-CORR-U (migration `0134`) lets the reader resolve their own disagreement explicitly («أوافق
  عليه الآن» / "I agree with this now"), recorded as durable owner-only facts on `public.understanding_contests`. The
  Personal export (`personal_data_private.build_personal_export_v1`, migration `0130`) lists every disagreement
  (`yourDisagreements`), which stays complete and true. It does not carry the reader's later explicit agreement.
- **Source:** the W3-CORR-U Gap Sweep
  ([implementation record](e2e/QANDEEL_W3_CORR_U_UNDERSTANDING_INTEGRITY_IMPLEMENTATION_RECORD_v1.md) §5 and §10).
  The current export contract is the [W3-MEGA-S record](e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md)
  under the W3-PDG-01 Product decisions.
- **Current truth:** nothing in the export is false. A withdrawal-resolved contest is not the reader's act and must
  never be exported as one.
- **Why deferred:** the export's content and shape are a Privacy & Data Product decision. Adding a field from inside an
  Understanding corrective would invent it (AGENTS.md §2).
- **Owner task:** `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts`
- **Severity:** `MEDIUM`. If reopened, it concerns the completeness of the reader's own exported data, not its
  truthfulness.
- **Reopen condition:** automatic when `PRIV-EXPORT-01` starts. It must also be reopened before Export My Data is
  declared complete for launch.
- **Required future properties:** export only the reader's OWN explicit agreements (never a withdrawal) as readable
  facts; no internal id, command id or reason code; the disagreements stay listed.
- **Status:** `DEFERRED — OWNED`

Admitted by W3-CORR-U under BG-06, designated by Architecture in its closing change. Nothing here authorizes
implementation (BG-07).

### `QAN-BL-A11Y-01` — Reduce Motion Read Only at Launch by the T-10 Camera / Temporal Motion Hooks

> **Historical pre-closure schema.** This block records the item as admitted. It is not the current lifecycle state; the
> current state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** W3-MEGA-S made the W1A / W3 surfaces follow the platform's Reduce Motion setting mid-session
  (`useReduceMotion()`). The T-10 presentation-camera and temporal-motion hooks (`usePresentationCamera.ts`,
  `useTemporalMotion.ts`) still read Reanimated's `useReducedMotion()`, which reports the value at app start only, and so
  does any Reanimated animation left on its default `ReduceMotion.System`. A reader who turns Reduce Motion on during a
  session still gets those motions until the app restarts.
- **Source:** the [W3-MEGA-S record](e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md) §6 and
  §13 item 4, disposed to Stage 2 by its closing reconciliation (§18.2 item 4, `W3-MEGA-S-CLOSE-01`). The obligation is
  W3-PDG-01 §6.3's (Reduce Motion is a platform signal QANDEEL must honour).
- **Current truth:** reconfirmed in code at `7221a635`. Nothing is faked and no surface is wrong at launch; only a change
  during a session is missed.
- **Why deferred:** the hooks are CLOSED / FROZEN T-10 / T-12 code outside W3-MEGA-S's contract. Changing them is a
  controlled change for the task that ports the Timeline and the Map's motion, and Stage 2 consumes them.
- **Owner task:** `VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence`
- **Severity:** `HIGH` — accessibility parity.
- **Reopen condition:** automatic when `VPORT-02` starts; and in any case before `E2E-D-12` is closed.
- **Required future property:** every Living Analysis camera and temporal motion follows a mid-session change of the
  platform Reduce Motion setting, with the parity T-10 and F1R2 already define. This entry adds no motion law.
- **Status:** `DEFERRED — OWNED`

Admitted by `W3-MEGA-S-CLOSE-01` under BG-06 (a canonical record's deferral to a named future task), so that `VPORT-02`
inherits it at kickoff (BG-05). Nothing here authorizes implementation (BG-07).

### `QAN-BL-NOTIF-01` — Native Push, OS Permission and Platform Delivery for the A3-01 Activity Spine

> **Historical pre-closure schema.** This block records the item as admitted. It is not the current lifecycle state; the
> current state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** A3-01 builds the provider-neutral Product notification spine — the typed candidate boundary
  (`ActivityPublisher`), the per-user Activity projection (migration `0136`), the server-side eligibility decision, the
  provider-neutral platform verdict (`platformVerdict`, the P3 §14 ceilings over delivery evidence, the disclosure
  level) and the in-app surfaces. Nothing delivers outside the app: there is no APNs / FCM transport, no device-token
  registration, rotation or removal, no per-device delivery evidence, no multi-device de-duplication, no background
  delivery or retry, no OS permission prompt, no permission-education → real OS prompt boundary, no iOS categories, no
  Android channels, no platform Lock Screen projection (the Lock Screen ceilings are stored preferences only), no
  app-icon badge, no notification-specific OS settings hand-off (the row opens the app's settings), no Direct Entry from
  a native notification, and no physical iOS / Android notification proof.
- **Source:** the A3-01 Task Contract §0, §17 ("Record exactly one future task: `A3-02 — Native Push, Permission &
  Platform Delivery Integration`"); P3 §18 (Push provider, APNs / FCM, tokens, categories / channels, OS-level mapping,
  badge, permission wording, device validation carried forward); I-08N-01 §21 *Platform implementation*; the
  [A3-01 implementation record](e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md) §21.
- **Why deferred:** the Product Owner split Stage 3 deliberately: platform transport is a separate engineering
  boundary (Task Contract §0). A3-01 must not choose or integrate a provider.
- **Owner task:** `A3-02 — Native Push, Permission & Platform Delivery Integration`
- **Severity:** `HIGH` — Stage 3 cannot close without it, and every interrupting background notification depends on it.
- **Reopen condition:** automatic when `A3-02` is opened by its Task Contract.
- **Required future properties (Exit Gate):** consume A3-01's ONE candidate boundary, projection and Direct Entry
  contract (no second notification model); ask `platformVerdict` before every platform delivery and record per-user,
  per-device delivery evidence it actually holds (D41, D53, D56 — never inferred); keep user-level attention separate
  from per-device evidence; re-evaluate (never flush) after Quiet Hours / Snooze, with at most one interruption per
  re-evaluation pass; persist the device's IANA time zone so background Quiet Hours stay device-local; render only the
  bounded projection at `disclosureLevel` (never above the user's ceiling, never relying on the OS to hide more);
  request OS permission only at a legitimate contextual moment, with the education sheet's copy approved first (it is
  `AUDIT_OWNED`); revalidate Direct Entry from a native notification through the same `open` boundary; physical
  iOS and Android evidence. **Stage 3 does not close before this gate.**
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-NOTIF-02` — No Proactive QANDEEL Gate and No Proactive Event Producer

- **Title / Finding:** I-08N-01 §4 requires every proactive candidate to pass the Proactive Gate (P1–P7), and P3 §12.1
  freezes Reduce as a tighter Gate decision, "not a numeric score or threshold". No Gate runtime exists on `main`, and
  nothing produces a proactive candidate. A3-01 therefore fails closed: under Allow and Reduce alike, a proactive item may
  enter Activity but never interrupts (`PROACTIVE_GATE_ABSENT`), and no proactive candidate is ever published.
- **Source:** I-08N-01 §4, D01, D04, D05, D23, D35; P3 §12.1; A3-01 Task Contract §7; the
  [A3-01 implementation record](e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md) §3.2, §9.
- **Why deferred:** a Proactive Gate is QANDEEL intelligence and source-domain semantics, not Activity infrastructure;
  inventing one inside A3-01 would be exactly the score / threshold the Task Contract forbids.
- **Owner task:** `PROACTIVE-EVT-01 — Proactive QANDEEL Gate & Event-Producer Integration`
- **Severity:** `HIGH` — Proactive QANDEEL is a frozen v1 behaviour (D01) and Allow / Reduce have no effect until it exists.
- **Reopen condition:** automatic when the task opens; and it must open before any real Proactive QANDEEL notification
  can be emitted.
- **Required future properties (Exit Gate):** the Gate's own authoritative verdict (including its stronger Reduce
  decision) reaches the A3-01 decision as a typed fact replacing `PROACTIVE_GATE = 'ABSENT'` — never a score, weight,
  class rule or threshold; candidates are published only through `ActivityPublisher` with QANDEEL Voice and the reader's
  language / dialect profile (D18–D18B); no manipulative copy (D20); silence is never evidence (D05); the event sentences
  carry Product-approved copy; the From QANDEEL row source glyph question is settled with the P2 navigation-family owner.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-NOTIF-03` — No User-Requested Exact-Time Reminder Runtime and No Reminder Event Producer

- **Title / Finding:** I-08N-01 D06 / D37 and P3 §9 / §13 name an exact-time reminder the user explicitly requested as
  one of the two exceptions (Quiet Hours, ordinary budget, Live Call). A3-01 carries the typed fact (`requested`, kind
  `REMINDER`) and its exception path end to end, but no reminder runtime exists (Memory explicitly classes reminder cues
  as not-Memory), so nothing produces one.
- **Source:** I-08N-01 D06, D08, D10, D37; P3 §9, §13; A3-01 Task Contract §8; the
  [A3-01 implementation record](e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md) §3.2.
- **Why deferred:** a reminder runtime (capture, scheduling, delivery-time truth, cancellation) is its own source domain.
- **Owner task:** `REMINDER-EVT-01 — User-Requested Reminder Runtime & Event Producer`
- **Severity:** `MEDIUM` — a Product capability not yet present; it violates no frozen contract while absent.
- **Reopen condition:** automatic when the task opens; and it must open before exact-time requested reminders can emit
  real notification events.
- **Required future properties (Exit Gate):** publish only through `ActivityPublisher` with `requested: true` set only
  for a reminder the reader explicitly asked for at an exact time, an honest `expiresAt`, and approved copy.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-NOTIF-04` — No Security / Sign-in / Account Event Source for Activity

- **Title / Finding:** I-08N-01 D27 / D36 and P3 §9 / §12.2 make a genuinely critical security / account event the
  other exception, with no in-app off switch. A3-01 implements that path (`critical`, kind `SECURITY`; the statement row
  in Notifications & Activity; the call-safe component), but nothing on `main` records a security or sign-in event: the
  W3-MEGA-A account acts are provider calls that write no event, and no new-sign-in detection exists.
- **Source:** I-08N-01 D10, D27, D36; P3 §9, §12.2; the [A3-01 implementation record](e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md) §3.2.
- **Why deferred:** detecting and recording security events is Account & Security source truth, not Activity.
- **Owner task:** `ACCOUNT-SEC-EVT-01 — Account & Security Event-Producer Integration`
- **Severity:** `HIGH` — critical-security notification is a frozen exception whose absence leaves a security journey without
  its Product signal.
- **Reopen condition:** automatic when the task opens; and it must open before Security / Account Activity events can be
  emitted.
- **Required future properties (Exit Gate):** publish only through `ActivityPublisher`; `critical` only for a genuinely
  critical event (Class 1); Direct Entry `GENERAL_SETTINGS` / `SECURITY` (or `ACCOUNT`), revalidated at open; disclosure
  bounded at L2 by default and never raised by importance (D14); any inline action (for example a "review" act) and every
  event sentence Product-approved.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-PRIV-02` — Export My Data Omits the Reader's Notifications & Activity Preferences and Context Mutes

- **Title / Finding:** A3-01 adds per-reader data: Notifications & Activity preferences and per-context mutes (migration
  `0136`). The Personal export (`personal_data_private.build_personal_export_v1`, migration `0130`) does not carry them.
  The Activity projection itself is a presentation of other domains' events and carries no source content of its own
  beyond the bounded sentences producers render.
- **Source:** W3-PDG-01 §7.3 (export what belongs to the user, including account data); the
  [A3-01 implementation record](e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md) §19. The precedent is `QAN-BL-PRIV-01`.
- **Current truth:** nothing in the export is false; it is incomplete for these new rows. No producer exists, so the
  projection is empty in production.
- **Current truth (BG-08 reconciliation at S4-04, open PR):** a Shared source producer now publishes into the projection,
  and the reader's per-World Shared mutes are now set from Notifications & Activity into the same `activity_context_mutes`
  table (migration `0141`). The export still carries neither; the item's scope, owner, severity and status are unchanged.
- **Why deferred:** the export's content and shape are a Privacy & Data Product decision; adding a section from inside the
  Activity task would invent it (AGENTS.md §2), exactly as W3-CORR-U found for `QAN-BL-PRIV-01`.
- **Owner task:** `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` (the named Export completeness task)
- **Severity:** `MEDIUM` — completeness of the reader's own export, not its truthfulness.
- **Reopen condition:** automatic when `PRIV-EXPORT-01` starts; and before Export My Data is declared complete for launch.
- **Required future properties (Exit Gate):** the reader's own Notifications & Activity preferences and context mutes
  appear in Export My Data as readable facts, proved by an export test over a populated `0136` footprint; whether
  Activity items belong in the export is decided there, not here.
- **Status:** `DEFERRED — OWNED`

Admitted by A3-01 under BG-06 (the A3-01 Task Contract defers `QAN-BL-NOTIF-01` to the named `A3-02` by name; the
Product Owner's A3-01 kickoff decisions name the owners of `NOTIF-02` … `NOTIF-04`; `PRIV-02` follows the
`QAN-BL-PRIV-01` precedent). Nothing here authorizes implementation (BG-07).

### `QAN-BL-NOTIF-05` — Native Push Physical-Device Exit Gates (PD-01 … PD-09)

- **Title / Finding:** A3-02 implements and proves native Push on emulators / simulators only: the server-rendered
  messages are presented through the real OS notification systems, but no real FCM / APNs message is received (no
  production credential exists in CI), and no physical Lock Screen, real OS tray tap, real permission prompt, badge
  absence or VoiceOver / TalkBack behaviour on the new surfaces is attested on hardware. The gates are named PD-01 …
  PD-09 in the A3-02 record §20 (credentials provisioned by name; real FCM receipt; real APNs receipt, production and
  sandbox; Lock Screen at L0 and L2; token rotation / reinstall / account switch; tray tap → Direct Entry, stale, another
  account's item; the real prompts and settings hand-off; no app-icon badge; assistive technology on the education sheet
  and the device section).
- **Source:** the A3-02 Task Contract §12 ("record named Exit Gates for any capability that cannot be honestly proven in
  CI"); the `QAN-BL-NOTIF-01` Exit Gate ("physical iOS and Android evidence"); P3 §18 (device validation carried
  forward); the roadmap §5 ("physical iOS / Android device validation"); the
  [A3-02 implementation record](e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md) §20.
- **Current truth:** the production boundary is implemented and fails closed without credentials (the transports answer
  `NOT_CONFIGURED` and send nothing; a build without the Firebase client file registers no token).
- **Why deferred:** real platform delivery needs production credentials and physical hardware, which the roadmap places in
  Release Hardening & Launch; claiming them from emulators would be fake proof.
- **Owner task:** `Release Hardening & Launch — physical iOS / Android device validation`
- **Severity:** `HIGH` — every background notification a reader would receive depends on it.
- **Reopen condition:** automatic when Release Hardening & Launch starts; and before any production build enables Push.
- **Required future properties (Exit Gate):** PD-01 … PD-09 each pass on physical iOS and Android hardware against the
  production API, with evidence recorded; nothing in the A3-02 law (disclosure, revalidation, per-device evidence,
  no badge, no relay) is relaxed to pass them.
- **Status:** `DEFERRED — OWNED`

Admitted by A3-02 under BG-06 (the A3-02 Task Contract defers physical-device proof to named pre-release gates; the roadmap
§5 names the owner). It re-owns the physical-evidence clause of `QAN-BL-NOTIF-01` and is not an alias of any item.
Nothing here authorizes implementation (BG-07).

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

### `QAN-BL-T13-01` — Restart / Recovery / Persistence

- **Closing task:** `T-13 — Recovery / Persistence v1`
- **PR / SHA:** `#223` / `5d9ba46efc6cf2d391096fcb3784bf2a5588ae15`
- **Disposition:** completed. Restart, recovery and persistence of the reader's viewpoint and
  reversible history are delivered. Product recovery is identity-scoped and separate from auth
  persistence: a signed-out launch reads no Product recovery at all, a record is validated before any
  Session is resumed, and a record that cannot be trusted fails closed rather than minting a
  replacement Session.
- **Status:** `CLOSED — TOMBSTONE`

This tombstone was recorded by `T-14 — Mobile Product Sign-In Gateway v1` under BG-08. T-13 closed
without reconciling its own inherited item, and this is that reconciliation; it reopens nothing and
changes no T-13 semantics.

### `QAN-BL-PROD-01` — Unbounded Per-Account Turn Admission and Foreground AI Spend (PR01-S02)

- **Closing task:** `PROD-SEC-02 — Turn Admission Concurrency & Cost Bound`
- **PR / SHA:** `#299` / merged as `ce2b86d0caaeb063ec4593663d9dbf806e51b4f4` (implementation head `a6c9ca5`)
- **Disposition:** completed. Migration `0131` bounds turn admission atomically at the database (one in-flight turn
  per session, two per user, rolling 10-minute and 24-hour allowances, one typed `PT429` refusal proven as HTTP 429
  through live PostgREST), leases every provider-bearing exchange, and charges a durable per-user work-start budget
  so replays and semantic retries are bounded over time as well as in concurrency. The foreground AI-cost direction is
  closed.
- **Status:** `CLOSED — TOMBSTONE`

This tombstone was recorded by `PROD-OPS-01` under BG-08, as that task's Task Contract (§10) instructs: PR #299 merged
while this register still carried its pre-merge wording. It is a register correction, not a lifecycle change, and it
reopens nothing in `PROD-SEC-02`.

### `QAN-BL-PROD-03` — Operational Readiness & Silent-Failure Visibility (PR01-S05; P-1 / P-5 / U-4; stuck-job visibility)

- **Closing task:** `PROD-OPS-01 — Operational Readiness & Silent-Failure Visibility`
- **PR / SHA:** `#300` / implementation evidence head `76d1d4b` — every runtime, migration and test change of the
  task. The commits after it are this BG-08 record and the implementation record; neither changes runtime behaviour.
  The tombstone is true from the merge of PR #300, which happens only after independent review on green CI.
- **Disposition:** completed, all five rows FIXED + VALIDATED.
  - **Readiness (`PR01-S05`):** the probe calls one zero-parameter, row-free, read-only RPC
    (`server_database_ready_v1`, migration `0132`) with the canonical server credential, executable by `service_role`
    only; `available` only for HTTP 200 with exactly `true`; concurrent checks coalesce. Proven through live PostgREST
    with the API's compiled probe.
  - **Privacy deletion (`P-1`):** every step of the pass emits one content-free outcome; provider `UNAVAILABLE` stays
    retryable and is visible; Connected Worlds `BLOCKED` is `blocked_expected`, never a failure; no attempt cutoff.
  - **Export preparation (`P-5`):** a failed attempt records one closed class (`TRANSIENT_DATABASE`,
    `CONSTRAINT_OR_INTEGRITY`, `RESOURCE_OR_CAPACITY`, `INTERNAL_OTHER`) and its time, never the SQLSTATE or text; three
    attempts, the one-minute backoff and owner-facing `FAILED` are unchanged; a success clears the class.
  - **Confidence re-evaluation (`U-4`):** `success` or `retry_pending` with a two-value failure class; the answer and
    the lifecycle are unchanged; no automatic retry was added.
  - **Stuck-job visibility:** a service-role-only aggregate summary (counts and ages only) emitted as gauges; it is
    not a readiness input.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-PROD-02` — API Baseline Hardening: Rate Limiting, Trusted Proxy, Header Baseline (PR01-S01 / S-03 / S-04)

- **Closing task:** `PROD-SEC-01 — API Baseline Hardening` (widened by its Task Contract to the whole API Baseline
  Security direction, `SEC-A` … `SEC-H`)
- **PR / SHA:** `#301` / implementation evidence head `3239f6f`. That head carries every runtime, migration and test
  change of the task; the commits after it are this BG-08 record and the implementation record. The tombstone holds from
  the merge of PR #301, which happens only after independent review on green CI.
- **Disposition:** every repo-owned row is completed, and the two genuine external dependencies are re-owned by name:
  - **SEC-A, rate limiting.** One process-local global guard bounds every routed request per trusted client address,
    before any auth, database or provider work. It runs a per-address aggregate window plus per-route windows by class:
    - health;
    - pre-auth lookup, credential and mail;
    - authenticated and authenticated mail;
    - security-sensitive;
    - conversation;
    - a strict fallback for unclassified routes.

    A refusal is one generic 429. No limit is configurable. `PROD-SEC-02`'s database cost authority is unchanged.
  - **SEC-B, trusted client address.** An explicit topology is parsed once: `direct`, or `trusted_proxy` with an IP /
    CIDR list. It is never `trust proxy = true` and never a hop count. The provider relay forwards only the normalized
    resolved address.
  - **SEC-C, header baseline.** Helmet runs before routes; `X-Powered-By` is off; there is no CORS.
  - **SEC-D, secrets.** A production preflight requires the Supabase URL and keys, a secret key that substitutes for no
    other key, and the proxy mode.
  - **SEC-E, privilege drift.** Migration `0133` closes the Supabase default-privilege census: 5 functions, 14
    trigger functions and 1 sequence. Hosted equals CI for every public object, proven on real PostgreSQL.
  - **SEC-H, negative baseline.** Proven: no wildcard CORS, bounded bodies, no upload route, readiness single-flight
    intact.
  - **SEC-F** (edge / WAF / TLS / origin) is re-owned to `QAN-BL-LAUNCH-01`. **SEC-G** (keyed retired-identifier
    digest) is re-owned to `QAN-BL-LAUNCH-02`.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-AUTH-01` — Mobile Product Sign-In Gateway

- **Closing task:** `T-14 — Mobile Product Sign-In Gateway v1`
- **PR / SHA:** `#225` / `784d8de75d97410d08dd9149ce822138ecfe9748` — the implementation evidence
  head, carrying every Product and test change of T-14. The commits after it are this BG-08
  governance record and one documentation correction; neither changes Product, runtime or test
  behaviour, and standard PR CI is green on the final head.
- **Disposition:** completed. A signed-out reader has one real Product entry surface, and it consumes
  only the already-frozen `MobileAuthAuthority.signInWithPassword`. A successful sign-in hands control
  back to the existing integration runtime, which owns
  `AUTHENTICATED → RECOVERING → BOOTSTRAPPING → READY`; the gateway creates no client, no storage, no
  Session and no route, and it navigates nothing. No onboarding, registration, password-recovery,
  social auth, account linking or credential-UX semantics were defined — the entry described by this
  item is the whole of what was built.
- **Status:** `CLOSED — TOMBSTONE`

The boundaries this item stated remain true: the validation-only T12-04 auth harness was not promoted
into a Product experience, and `QAN-SEC-01 — Pre-release Mobile Credential Security` still owns
credential security through `QAN-BL-SEC-01`, which T-14 left untouched.

### `QAN-BL-NOTIF-01` — Native Push, OS Permission and Platform Delivery for the A3-01 Activity Spine

- **Closing task:** `A3-02 — Native Push, Permission & Platform Delivery Integration`
- **PR / SHA:** the A3-02 Draft PR / the final code head recorded in the A3-02 record §24. The tombstone holds from that
  PR's merge, which happens only after independent review on green CI.
- **Disposition:** completed for every implementation obligation of its Exit Gate: A3-01's ONE projection, candidate
  boundary and `open` contract consumed (no second model); `platformVerdict` asked before every delivery, re-judged at
  every attempt; per-device evidence that claims only provider acceptance and THIS device's tap (no delivered / presented
  column exists); user-level attention untouched; Quiet Hours / Snooze deferral re-evaluated with at most one item per
  reader per pass; the device's IANA zone persisted; the bounded projection rendered at `disclosureLevel` with the
  approved Lock Screen words and L0 on a neutral channel; OS permission requested only after QANDEEL's education at a
  legitimate moment (its copy through the A3-02 Product Copy Gate, APPROVED by the Product Owner); native Direct Entry through Activity's `open`;
  device registration, rotation, detach, detach-others, invalidation and erasure (migration `0137`, real-PostgreSQL
  verifier); FCM HTTP v1 and APNs HTTP/2 directly, no relay; Android channels, no iOS category, no badge. Proved by unit,
  integration and database tests and on Android / iOS emulators through isolated proof legs. Its physical-evidence clause
  is re-owned, not dropped, to `QAN-BL-NOTIF-05`.
- **Status:** `CLOSED — TOMBSTONE`

---

### `QAN-BL-A11Y-01` — Reduce Motion Read Only at Launch by the T-10 Camera / Temporal Motion Hooks

- **Closing task:** `VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence`
- **PR / SHA:** `#306` / implementation evidence head `c94a96e` — every runtime and test change of the correction. The commits
  after it are the VPORT-02 implementation record, this BG-08 record and the device evidence; none changes the Reduce
  Motion path. The tombstone holds from the merge of PR #306, which happens only after independent review on green CI.
- **Disposition:** completed. The ONE live Reduce Motion reader (W3-MEGA-S's `useReduceMotion`: Reanimated's launch value,
  then the platform's `reduceMotionChanged` event; one process-wide store; one platform listener) moved unchanged into the
  T-10 motion owner (`motion/runtime/reduce-motion.ts`). The W1A / W3 path re-exports it, so no second store or listener
  exists. `usePresentationCamera` and `useTemporalMotion` read it instead of Reanimated's launch-only
  `useReducedMotion()`, and every animation in both hooks names `ReduceMotion.Never`, so the plan computed from the live
  setting is the only reduced-motion authority in either direction (turned on mid-session, or launched on and turned
  off). The reduced counterpart is T-10's and T-06's own, unchanged: the same act, stance, Moments and offered acts; travel,
  settle and cursor movement go; the opacity resolves stay. Proved mounted, without a remount: OFF → full plan, ON →
  cut-and-resolve and zero-duration temporal motion, OFF again, one listener, no reader left after unmount
  (`motion/__tests__/reduce-motion-mid-session.test.tsx`); and on an Android emulator with Reduce Motion turned on while
  the app kept running (the VPORT-02 implementation record §15). No motion law was added.
- **Status:** `CLOSED — TOMBSTONE`

---

### `QAN-BL-CW-01` — Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`)

- **Closing task:** `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure`
- **PR / SHA:** PR #315, merged as `1a10127672f8db7ff475bca4732635bf88536730` (the S5-02 Product Copy Gate CLOSED — 27 rows
  APPROVED (Product Owner, 2026-10-06)). *(As first written, before the merge: "the S5-02 Draft PR / the head recorded in the
  S5-02 record. The tombstone holds from that PR's merge"; the merge SHA was filled in by S5-03A's reconciliation.)*
- **Disposition:** completed, in the Product Owner's physical-erasure terms. Migration `0143` makes the canonical Shared
  owner deletion (`delete_shared_world_owned_material_v1`, forward-replaced from `0122` with its lock order and semantics
  unchanged) erase, in the SAME transaction at the SAME canonical instant, every Public package copy of a Shared material
  that deletion physically erases — the deleted material and its transitive `MATERIAL_DEPENDENCY` closure, whatever the
  item's historical classification (S5-02 R1): the public body row and both durable content verifiers (`public_body_digest`,
  `captured_source_digest`); audit identity survives; a one-way, canonically-proven exception inside the unchanged `0092`
  guard (plus a no-resurrection INSERT guard) is the only way in; already-unsafe rows are erased forward and contradictory
  state refuses deployment; both review boundaries are dark for a package that is no longer whole and never present a
  partial one; a `REASONING_DEPENDENCY` target's copy is not erased. Proven against real PostgreSQL by
  `database/verify-migration-0143.mjs`: the erasure, a whole-database census that finds neither the bytes nor their
  digest, the dark reviews, the reconciliation, one-way immutability, retry re-proof, and the delete-vs-prepare races on
  two connections with no deadlock.
- **Status:** `CLOSED — TOMBSTONE`

---

## 7. Counts at this baseline

| Status | Count |
| --- | ---: |
| `DEFERRED — OWNED` | 16 |
| `VALIDATION — OPEN` | 0 |
| `OPEN — UNASSIGNED` | 9 |
| `CLOSED — TOMBSTONE` | 18 |
| **Total** | **43** |

| Severity | Count |
| --- | ---: |
| `HIGH` | 26 |
| `MEDIUM` | 16 |
| `LOW` | 1 |

These totals are counted mechanically from the §4 index, one row per ID.

T-12 inherited ten items and all ten are now tombstoned. `QAN-BL-SEC-01` was the sole new BG-08
admission made *at* T-12 closure. `QAN-BL-AUTH-01` is a later BG-08 reconciliation: the residue was
explicitly named in the T-12 document but missed this register, and it was admitted afterwards by
`PRE-T13 — T-12 Documentation / Governance Reconciliation`. Admitting it reopens nothing — T-12
remains `CLOSED / FROZEN`.

T-14 tombstoned two: its own `QAN-BL-AUTH-01`, and `QAN-BL-T13-01`, which T-13 delivered but did not
reconcile here before closing. At T-14 closure, `QAN-BL-SEC-01` was the only `DEFERRED — OWNED` item in the
register, and it was unchanged. **T-14 admitted no new item.** Its anti-scope — sign-up, email
verification, password reset, magic link, OTP, social auth, biometrics, passkeys, profile,
onboarding, account deletion, account linking, "remember me", a password visibility toggle and
sign-out chrome — is anti-scope, and BG-06 admits none of it: none has an existing `OPEN` identifier,
none is deferred to a future task by a canonical document, none is carried forward for validation,
and Architecture designated none.

The I-08B3.1-G3 closure admitted `QAN-BL-VIS-01`. It is the one open item parent `I-08B3.1-G` could no longer hold once
it closed, so the register now counts seven `OPEN — UNASSIGNED` items.

**Count correction (recovered canonical authority preservation, 2026-09-24).** The table above had gone
stale. At the PR #268 baseline (`84f507d0`) the §4 index held 21 rows, not 20:

- 8 `OPEN — UNASSIGNED`, not 7;
- 12 `HIGH`, not 11.

The sentence above is left as it was written. It undercounted by one: the §4 index already held eight open
items once `QAN-BL-VIS-01` was admitted.

The preservation then admitted `QAN-BL-CW-01` (`ASSURE-F05`, `HIGH`, `OPEN — UNASSIGNED`). That brought the register to 22 items.

**P4-C1 admission (2026-09-27).** P4-C1 retires the dedicated Live Context Product surface while preserving the runtime-gated contextual-relevance capability and admits `QAN-BL-CTX-01` (`HIGH`, `DEFERRED — OWNED`) with owner `QAN-CTX-01 — Conversational Relevance Runtime`. The register now holds **23** items: 2 `DEFERRED — OWNED`, 9 `OPEN — UNASSIGNED`, 12 `CLOSED — TOMBSTONE`, and 14 `HIGH`. This admission authorizes no implementation (BG-07).

**P4 closure admission (2026-09-27).** The P4 final closure admits `QAN-BL-LANTERN-01` (`HIGH`, `DEFERRED — OWNED`) with
owner `QANDEEL — Lantern Gateway Identity Moment v1`, and adds a current-truth note to `QAN-BL-VOICE-01` without changing
its fields. The register now holds **24** items: 3 `DEFERRED — OWNED`, 9 `OPEN — UNASSIGNED`, 12 `CLOSED — TOMBSTONE`,
and 15 `HIGH`. The sentences above are left as they were written at their own baselines. This admission authorizes no
implementation (BG-07).

**W3-PDG-01 admission (2026-09-30).** The W3-PDG-01 Product Decision Closure admits `QAN-BL-ACCT-01` (`HIGH`,
`OPEN — UNASSIGNED`), the Connected Worlds account-deletion blocker, and adds a current-truth note to `QAN-BL-CW-01`
without changing its fields. The register now holds **25** items: 3 `DEFERRED — OWNED`, 10 `OPEN — UNASSIGNED`,
12 `CLOSED — TOMBSTONE`, and 16 `HIGH`. This admission authorizes no implementation (BG-07).

**PROD-READINESS-01 corrective admission (2026-10-01).** The Product Owner accepted the corrective roadmap of the
`PROD-READINESS-01` review (Draft PR #298, `03685fd`). The first change after that decision, `PROD-SEC-02` (Draft
PR #299), admits all five accepted findings in one step, so none survives only in the review record (BG-08):

- `QAN-BL-PROD-01` (`HIGH`), owned by the active `PROD-SEC-02`;
- documentation-only, exactly the scope of the review: `QAN-BL-PROD-02` (`HIGH`, `PROD-SEC-01`), `QAN-BL-PROD-03`
  (`HIGH`, `PROD-OPS-01`), `QAN-BL-PROD-04` (`MEDIUM`, `PROD-AUTH-01`) and `QAN-BL-PROD-05` (`MEDIUM`, `PROD-DATA-01`).

All five are `DEFERRED — OWNED`. The register now holds **30** items: 8 `DEFERRED — OWNED`, 10 `OPEN — UNASSIGNED`,
12 `CLOSED — TOMBSTONE`; 19 `HIGH`, 10 `MEDIUM`, 1 `LOW`. These admissions authorize no implementation beyond
`PROD-SEC-02`'s own Task Contract (BG-07).

**PROD-OPS-01 reconciliation (2026-10-01).** Two tombstones and no admission. `QAN-BL-PROD-01` is tombstoned for
`PROD-SEC-02` (PR #299, merged as `ce2b86d`), whose pre-merge wording this register still carried. `QAN-BL-PROD-03`
was widened by the `PROD-OPS-01` Task Contract to the whole Operational Readiness & Failure Visibility direction —
`PR01-S05` plus the independent W3 review's `P-1`, `P-5` and `U-4` and stuck-job visibility, kept as ONE item with ONE
owner rather than orphan rows — and is tombstoned by `PROD-OPS-01` itself (PR #300). No new item qualifies under BG-06;
the record's §12 gives each residue's disposition. `PROD-SEC-01`, `PROD-AUTH-01` and `PROD-DATA-01` keep their items
unchanged. The register now holds **30** items: 6 `DEFERRED — OWNED`, 10 `OPEN — UNASSIGNED`, 14 `CLOSED — TOMBSTONE`;
19 `HIGH`, 10 `MEDIUM`, 1 `LOW`, counted mechanically from the §4 index.

**PROD-SEC-01 reconciliation (2026-10-01).** One tombstone and two admissions. `QAN-BL-PROD-02` was widened by the
`PROD-SEC-01` Task Contract to the whole API Baseline Security direction (`SEC-A` … `SEC-H`) and is tombstoned by
`PROD-SEC-01` itself (PR #301). Two rows depend on an external choice the repository does not hold, and each is
admitted with one named Final Launch owner:
- `QAN-BL-LAUNCH-01` (`HIGH`, `LAUNCH-EDGE-SECURITY-GATE`) covers the edge, the origin, the real proxy topology,
  and the live Supabase IP-forwarding and `0133` proofs;
- `QAN-BL-LAUNCH-02` (`MEDIUM`, `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate`) covers `P-7`'s keyed
  digest, under managed key custody.

`PROD-AUTH-01` and `PROD-DATA-01` keep their items unchanged, and no duplicate row is created for them. The register
now holds **32** items: 7 `DEFERRED — OWNED`, 10 `OPEN — UNASSIGNED` and 15 `CLOSED — TOMBSTONE`; by severity, 20
`HIGH`, 11 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**W3-CORR-U reconciliation (2026-10-01).** W3-CORR-U (Understanding Integrity, migration `0134`) inherits no item.
U-1 … U-5 were active-direction gaps, so they are closed inside the task and are not entered here (BG-01). Its record's
§13 is the Gap Closure Matrix. `QAN-BL-CTX-01` is unchanged and still owns general conversational relevance. The task
orders the provider context only by the reader's own explicit focus and contests, under the unchanged bound. One
residue is admitted with a named owner: `QAN-BL-PRIV-01` (`MEDIUM`, `PRIV-EXPORT-01`). The register now holds **33**
items: 8 `DEFERRED — OWNED`, 10 `OPEN — UNASSIGNED` and 15 `CLOSED — TOMBSTONE`; by severity, 20 `HIGH`, 12 `MEDIUM`
and 1 `LOW`, counted mechanically from the §4 index.

**AI-COST-01 reconciliation (2026-10-01).** AI-COST-01 (provider-neutral AI usage / cost ledger + Credit accounting
foundation, migration `0135`, PR #303, merged as `7221a635a6a7fe7564fb3f1e2e19c1ca189164c4` on 2026-10-01 — lifecycle corrected from "Draft PR #303" by ROADMAP-REC-01) inherits no item and admits none. Its residues already have owners and
qualify under none of BG-06's routes: the numeric Credit formula, plans, allowances, balances and exhaustion belong to the
roadmap's *Plans / Credits / Usage Economy*; provider / model selection, registering verified production prices and the
operator-only `brain-eval` harness belong to *QANDEEL-specific Model / Provider Benchmark & Selection*; a reconciled
provider bill belongs to Release Hardening's billing readiness; Company Ops consumption belongs to APP-OPS-01's
implementation. Its Gap Closure Matrix is §14 of its
[implementation record](e2e/QANDEEL_AI_COST_01_PROVIDER_NEUTRAL_COST_CREDIT_LEDGER_IMPLEMENTATION_RECORD_v1.md). The
register is unchanged: **33** items, 8 `DEFERRED — OWNED`, 10 `OPEN — UNASSIGNED`, 15 `CLOSED — TOMBSTONE`.

**W3-MEGA-S-CLOSE-01 reconciliation (2026-10-04).** The Product Owner closed W3-MEGA-S's Copy Gate, and the task closes
W3-MEGA-S (PR #296, merged as `e87aac6b`) as its bounded slice. It inherits no item. It admits one: `QAN-BL-A11Y-01`
(`HIGH`, `DEFERRED — OWNED`, `VPORT-02`), Reduce Motion in the T-10 hooks, which the W3-MEGA-S record now defers to that
named task. Every other residue is closed, already owned (`QAN-BL-PROD-05`, `QAN-BL-LAUNCH-02`, `QAN-BL-PRIV-01`,
`QAN-BL-ACCT-01`, `QAN-BL-CW-01`, all unchanged), or carried by its open E2E row and the execution map's Stage 9. The
record's §18.2 is the Gap Closure Matrix. The register now holds **34** items: 9 `DEFERRED — OWNED`, 10
`OPEN — UNASSIGNED` and 15 `CLOSED — TOMBSTONE`; by severity, 21 `HIGH`, 12 `MEDIUM` and 1 `LOW`, counted mechanically
from the §4 index.

**ROADMAP-REC-01 reconciliation (2026-10-04, refreshed after PR #305).** A documentation / governance reconciliation of the entry points and merged-task lifecycle truth through the current main ([record](e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md)). It inherits no item, admits none and changes no item's fields. It corrects the AI-COST-01 merge truth above, consumes W3-MEGA-S-CLOSE-01 as already-merged authority, preserves `QAN-BL-A11Y-01` under `VPORT-02`, and keeps `QAN-BL-PROD-04` / `05` and all Final Launch owners unchanged. No `W3-CORR-M` is created. The register remains **34** items: 9 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED`, 15 `CLOSED — TOMBSTONE`; 21 `HIGH`, 12 `MEDIUM`, 1 `LOW`.

**VPORT-02 reconciliation (2026-10-04).** VPORT-02 (Final Temporal / Orientation / Iconography Production Port + Stage-2
Coherence Closure, Draft PR #306) inherits exactly one item and tombstones it: `QAN-BL-A11Y-01` (§6). It admits none. Every
Stage-2 residue its sweep found is fixed inside the task (BG-01), already owned by an existing item or roadmap owner
(`QAN-BL-VOICE-01` for the Call Rail's runtime truth and the speaking indicator, `QAN-BL-NAV-02` for Replay,
`QAN-BL-VIS-01` for heavy-history density, the Release Hardening device gates), or not an obligation under BG-06; none
is aliased. Its Stage-2 Gap Closure Matrix is §18 of its
[implementation record](e2e/QANDEEL_VPORT_02_TIMELINE_ORIENTATION_P2_FINAL_COHERENCE_IMPLEMENTATION_RECORD_v1.md):
**Orphan gaps = 0**. The register now holds **34** items: 8 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10
`OPEN — UNASSIGNED` and 16 `CLOSED — TOMBSTONE`; by severity, 21 `HIGH`, 12 `MEDIUM` and 1 `LOW`, counted mechanically
from the §4 index. The tombstone holds from the merge of PR #306.

**A3-01 reconciliation (2026-10-04).** A3-01 (Activity & Attention Core + In-App Production Integration, migration
`0136`) inherits no item and admits five, each with one named owner and an Exit Gate: `QAN-BL-NOTIF-01` (`HIGH`,
`A3-02`), `QAN-BL-NOTIF-02` (`HIGH`, `PROACTIVE-EVT-01`), `QAN-BL-NOTIF-03` (`MEDIUM`, `REMINDER-EVT-01`),
`QAN-BL-NOTIF-04` (`HIGH`, `ACCOUNT-SEC-EVT-01`) and `QAN-BL-PRIV-02` (`MEDIUM`, `PRIV-EXPORT-01`). It adds a
current-truth note to `QAN-BL-PROD-04` and leaves every other item unchanged: `QAN-BL-VOICE-01` still owns the canonical
Live Call truth the call-safe path waits for; the Shared / Public / Introductions producers stay with Stages 4 / 5 / 6 of
the execution map. Its Stage-3 Gap Matrix is §23 of its [implementation record](e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md): **Orphan gaps = 0**. The
register now holds **39** items: 13 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 16
`CLOSED — TOMBSTONE`; by severity, 24 `HIGH`, 14 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**A3-02 reconciliation (2026-10-04).** A3-02 (Native Push, Permission & Platform Delivery Integration, migration `0137`)
inherits exactly one item and tombstones it: `QAN-BL-NOTIF-01` (§6). It admits one: `QAN-BL-NOTIF-05` (`HIGH`,
`DEFERRED — OWNED`, Release Hardening & Launch), the physical-device Exit Gates PD-01 … PD-09 that emulators cannot
honestly prove. `QAN-BL-NOTIF-02` … `04` and `QAN-BL-PRIV-02` are unchanged: their producers publish through A3-01, and
A3-02 delivers what they publish. Its Stage-3 Gap Matrix is §22 of its
[implementation record](e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md): **Orphan gaps = 0**.
The register now holds **40** items: 13 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 17
`CLOSED — TOMBSTONE`; by severity, 25 `HIGH`, 14 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index. The
tombstone holds from the merge of the A3-02 PR.

**S4-01 reconciliation (2026-10-05).** S4-01 (Shared World Reachability, Invitation & Birth, migration `0138`) inherits
no item. It observes `QAN-BL-ACCT-01`'s reopen condition and records its disposition in that item's current-truth note
(unchanged, still `OPEN — UNASSIGNED`). It admits one: `QAN-BL-LAUNCH-03` (`MEDIUM`, `DEFERRED — OWNED`,
`FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate`), the Shared ID sealing key's production custody. Every other
Stage-4 residue is owned by a later Stage-4 task (S4-02 / S4-03 / S4-04), by `I-09` / `CW2-08`, or by an unchanged
item; its Stage-4 Gap Matrix is §17 of its
[implementation record](e2e/QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md):
**Orphan gaps = 0**. The register now holds **41** items: 14 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10
`OPEN — UNASSIGNED` and 17 `CLOSED — TOMBSTONE`; by severity, 25 `HIGH`, 15 `MEDIUM` and 1 `LOW`, counted mechanically
from the §4 index.

**S4-01 exact-head CI admission (2026-10-05).** On S4-01's exact head `ada6315` the one Mobile CI failure is the iOS
simulator boot smoke's Maestro / XCTest driver readiness, twice with the same `IOSDriverTimeoutException` and the app
never opened, after the one VAL-01 infrastructure retry; classified PERSISTENT INFRASTRUCTURE — NOT PRODUCT / NOT
VALIDATION LOGIC. S4-01 admits `QAN-BL-CI-01` (`MEDIUM`, `DEFERRED — OWNED`,
`CI-IOS-01 — Maestro / XCTest Driver Startup Reliability`) at the reviewer's explicit designation; it is outside S4-01's
scope. The §7 table, which had not been moved for `QAN-BL-LAUNCH-03`, is corrected with it. The register now holds
**42** items: 15 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 17 `CLOSED — TOMBSTONE`; by
severity, 25 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**S4-02 reconciliation (2026-10-05; merged through PR #311 at `5ea952027d8c230d5d22d82e206394a985954934`, recorded by S4-03).** S4-02 (Shared Conversation & Material, migration
`0139`) inherits no item by owner. `QAN-BL-VOICE-01`'s reopen condition is not met — S4-02 claims no Voice Note
persistence or playback, and Shared Voice Notes (`E2E-G-06`) stay blocked on it; it is unchanged. `QAN-BL-CW-01`,
`QAN-BL-ACCT-01`, `QAN-BL-CI-01` and `QAN-BL-LAUNCH-03` are unchanged. The one S4-02-owned obligation it could not
truthfully satisfy — Personal Standing Context reaching a Shared reply (the private-context portion of `E2E-G-08`) — was
reported with its census in §7.1 of its
[implementation record](e2e/QANDEEL_S4_02_SHARED_CONVERSATION_MATERIAL_IMPLEMENTATION_RECORD_v1.md); the Product Owner
then designated it: S4-02 admits `QAN-BL-CW-02` (`HIGH`, `DEFERRED — OWNED`, owner `SHARED-CTX-01 — Shared Standing Context Product Integration`). The Shared-history
portion of `G-08` is delivered; the private-context portion is not closed. Its Stage-4 Gap Matrix is §13 of the same
record. The register now holds **43** items: 16 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 17
`CLOSED — TOMBSTONE`; by severity, 26 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**S4-03 reconciliation (2026-10-05; merged through PR #312 at `71015d0f031a3e161542d5aad7d5796230bdb353`, recorded by S4-04).** S4-03 (Shared Membership Lifecycle, Governance,
Settings & Historical Access, migration `0140`) inherits no item by owner. `QAN-BL-ACCT-01`'s reopen condition is observed —
S4-03 takes the Shared World further toward users — and the item stays `OPEN — UNASSIGNED`, unchanged in scope; both new
launch scopes ship closed and claim no production readiness. `QAN-BL-VOICE-01` is not claimed (no S4-03 read carries a
Voice Note) and is unchanged. `QAN-BL-CW-01`, `QAN-BL-CW-02`, `QAN-BL-CI-01` and `QAN-BL-LAUNCH-03` are unchanged. The two
Product Owner gates its Task Contract names — governed add-member / rejoin target presentation and the birth /
World-transition visuals — were current-task decisions (BG-01), not backlog residue: the Product Owner decided both at the
pre-push checkpoint (add / rejoin by the target's CURRENT Shared ID, epoch-bound; T-A + B-A), and they are implemented /
recorded in §4 of its [implementation record](e2e/QANDEEL_S4_03_SHARED_LIFECYCLE_GOVERNANCE_IMPLEMENTATION_RECORD_v1.md),
whose §14 is its Stage-4 Gap Matrix. It admits nothing: the register still holds **43** items with the counts above.

**S4-04 reconciliation (2026-10-06; review candidate, not merged).** S4-04 (Shared Activity, Notifications & Direct Entry,
migration `0141`) inherits no item by owner. `QAN-BL-PRIV-02`'s current truth changes — a Shared source producer now
exists and per-World mute rows now reach the same mute table — so a current-truth note is added; its scope, owner and
status are unchanged. `QAN-BL-NOTIF-05` is not claimed (no physical-device gate is run). `QAN-BL-ACCT-01` stays
`OPEN — UNASSIGNED`, unchanged in scope; no launch scope is opened. `QAN-BL-NAV-02` is not absorbed: Replay Direct Entry
stays fail-closed (Stage 7). `QAN-BL-VOICE-01`, `QAN-BL-CW-01`, `QAN-BL-CW-02`, `QAN-BL-LAUNCH-03`, `QAN-BL-CI-01` and
`QAN-BL-NOTIF-02` … `04` are unchanged. Its final Stage-4 Gap Matrix is §13 of its
[implementation record](e2e/QANDEEL_S4_04_SHARED_ACTIVITY_NOTIFICATIONS_DIRECT_ENTRY_IMPLEMENTATION_RECORD_v1.md):
**Orphan gaps = 0**. It admits nothing: the register still holds **43** items with the counts above.

**S5-01 reconciliation (2026-10-06; Draft PR, not merged).** S5-01 (Public World Reachability, Entry & Identity
Foundation, migration `0142`; the first Stage-5 task) inherits no item by owner. At the Product Owner's designation it
re-owns `QAN-BL-CW-01` (`ASSURE-F05`) to `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure`, records the Product
Owner's answer to its open ruling (the derivative's retained content bytes must be physically erased) and moves it from
`OPEN — UNASSIGNED` to `DEFERRED — OWNED`; nothing of it is implemented and its finding is unchanged. `QAN-BL-ACCT-01`'s
reopen condition is observed and the item stays `OPEN — UNASSIGNED` (current-truth note). `QAN-BL-NOTIF-02` … `05`,
`QAN-BL-PRIV-02`, `QAN-BL-NAV-02`, `QAN-BL-VOICE-01`, `QAN-BL-LAUNCH-01` … `03`, `QAN-BL-CI-01` and `QAN-BL-CW-02` are
unchanged: no Public Activity producer, Public push, Replay, Voice or Launch path is opened. At R1 the Product Owner
assigned two further obligations to `S5-02`, recorded on its row in §9 (neither is a backlog item): the final closure of
`E2E-H-08` — ADVANCED / S5-02 OWNED — NOT CLOSED (S5-01 establishes the display foundation and creates no I-05 Public Identity), and the Name-length
reconciliation (when the real Public Identity creation path is opened, the old I-05 64-character display-label implementation ceiling is reconciled with the valid 80-character account Name by a reviewed forward migration, so REAL_NAME can represent the full canonical account Name; no silent truncation, and the account Name limit is not redefined). It admits nothing; its Gap
Matrix is §13 of its [implementation record](e2e/QANDEEL_S5_01_PUBLIC_REACHABILITY_ENTRY_IDENTITY_FOUNDATION_IMPLEMENTATION_RECORD_v1.md):
**Orphan gaps = 0**. The register still holds **43** items: 17 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9
`OPEN — UNASSIGNED` and 17 `CLOSED — TOMBSTONE`; by severity, 26 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from
the §4 index.

**S5-02 reconciliation (2026-10-06; Draft PR, not merged).** S5-02 (Public Publishing, Rights, Draft / Review & Privacy
Closure, migration `0143`) inherits `QAN-BL-CW-01` and tombstones it (§6; effective from its merge): the Product Owner's
physical-erasure decision is implemented and proven against real PostgreSQL before any Draft / review path became
application-reachable. It also closes the two Product Owner assignments recorded on its §9 row, which are not backlog
items: `E2E-H-08` (CLOSED — the first real authorship provisions the ONE I-05 Public Identity from the S5-01 display
choice) and the 64 → 80 Name reconciliation (DONE, no truncation). `QAN-BL-ACCT-01` stays `HIGH`, `OPEN — UNASSIGNED`, and
gains a current-truth note (an author's Personal erasure is now truthfully BLOCKED; the Public World is not launch-ready).
`QAN-BL-VOICE-01`, `QAN-BL-NAV-02` and every launch item are unchanged: no Public Voice, Replay, Activity or Launch path is
opened. It admits nothing; its Gap Matrix is §14 of its
[implementation record](e2e/QANDEEL_S5_02_PUBLIC_PUBLISHING_RIGHTS_DRAFT_REVIEW_PRIVACY_CLOSURE_IMPLEMENTATION_RECORD_v1.md):
**Orphan gaps = 0**. The register still holds **43** items: 16 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9
`OPEN — UNASSIGNED` and 18 `CLOSED — TOMBSTONE`; by severity, 26 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from
the §4 index.

**S5-03A reconciliation (2026-10-06; Draft PR #316, not merged).** S5-02 is merged (PR #315 at
`1a10127672f8db7ff475bca4732635bf88536730`): the `QAN-BL-CW-01` tombstone's PR / SHA is filled in (§6). S5-03A (Public
Semantic Interpretation + Publisher Review, migration `0144`; the first of the Product Owner's three S5-03 tasks) inherits
no item by owner and admits none. `QAN-BL-ACCT-01` stays `HIGH`, `OPEN — UNASSIGNED`, with a current-truth note (no direct
account foreign key; its new Experience Version / Semantic Placement `RESTRICT` dependents are recorded as part of the blocker). `QAN-BL-VOICE-01`, `QAN-BL-NAV-02` and every launch item are unchanged: no Public Voice, Replay, Activity or
Launch path is opened, and the CW2-08 seam still answers `NOT_EVALUATED`. The production provider for the semantic
interpreter is the Product Owner's Stage 8A (QANDEEL AI Brain / Production LLM Runtime) by the Task Contract; S5-03A
records it in its Gap Matrix as a closure-time admission candidate whose owner task the Product Owner names within
Stage 8A — no item is admitted before that designation (BG-02). Its Gap Matrix is §16 of its
[implementation record](e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md): **Orphan gaps = 0**. The register still holds **43** items: 16 `DEFERRED — OWNED`, 0
`VALIDATION — OPEN`, 9 `OPEN — UNASSIGNED` and 18 `CLOSED — TOMBSTONE`; by severity, 26 `HIGH`, 16 `MEDIUM` and 1 `LOW`,
counted mechanically from the §4 index.

**S5-03B reconciliation (2026-10-06; not merged).** S5-03A is merged (PR #316 at
`c9338af9ecbfcecccc281f96f52fab335ad9bc7b`; its Product Copy Gate CLOSED, 21 / 21 APPROVED). S5-03B (Public Semantic Field + Stable Spatial Placement +
Viewer Runtime, migration `0145`; the second of the Product Owner's three S5-03 tasks) inherits no item by owner and admits
none. `QAN-BL-ACCT-01` stays `HIGH`, `OPEN — UNASSIGNED`, with a current-truth note (no direct account foreign key; its new
Experience Version / S5-03A interpretation `RESTRICT` dependents are recorded as part of the blocker). `QAN-BL-VOICE-01`,
`QAN-BL-NAV-02` and every launch item are unchanged: no Public Voice, Replay, Activity or Launch path is opened, and the
CW2-08 seam still answers `NOT_EVALUATED`. The production provider behind the spatial placer is the Product Owner's
Stage 8A, beside the S5-03A interpreter's; S5-03B records it as a closure-time admission candidate whose owner task the
Product Owner names within Stage 8A — no item is admitted before that designation (BG-02). Its Gap Matrix is §16 of its
[implementation record](e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md): **Orphan gaps = 0**.
The register still holds **43** items: 16 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`; by severity, 26 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.
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
| `QAN-CTX-01 — Conversational Relevance Runtime` | `QAN-BL-CTX-01` |
| `QANDEEL — Lantern Gateway Identity Moment v1` | `QAN-BL-LANTERN-01` |
| `T-13 — Recovery / Persistence` | `QAN-BL-T13-01` — delivered; tombstoned under BG-08 by T-14 |
| `T-12 — Final Integration` | none — reconciled and tombstoned under BG-08 / PR #220 |
| `T-14 — Mobile Product Sign-In Gateway v1` | `QAN-BL-AUTH-01` — explicitly claimed by the T-14 contract |
| `PROD-SEC-02 — Turn Admission Concurrency & Cost Bound` | `QAN-BL-PROD-01` — delivered by PR #299; tombstoned under BG-08 by `PROD-OPS-01` |
| `PROD-OPS-01 — Operational Readiness & Silent-Failure Visibility` | `QAN-BL-PROD-03` — widened by its contract and delivered; tombstoned by itself under BG-08 |
| `PROD-SEC-01 — API Baseline Hardening` | `QAN-BL-PROD-02` — widened by its contract to SEC-A … SEC-H and delivered; tombstoned by itself under BG-08 |
| `LAUNCH-EDGE-SECURITY-GATE — Trusted Proxy / Edge / Origin Production Proof` | `QAN-BL-LAUNCH-01` |
| `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` | `QAN-BL-LAUNCH-02` |
| `W3-CORR-U — Understanding Integrity` | none — U-1 … U-5 closed inside the task; admitted `QAN-BL-PRIV-01` |
| `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `QAN-BL-PRIV-01`, `QAN-BL-PRIV-02` |
| `AI-COST-01 — Provider-Neutral AI Usage & Cost Ledger + Credit Accounting Foundation` | none — no item names it; none admitted |
| `W3-MEGA-S-CLOSE-01 — Product Copy Approval + Residual Reconciliation` | none — admitted `QAN-BL-A11Y-01` |
| `ROADMAP-REC-01 — Canonical Roadmap & Current-State Reconciliation` | none — no item names it; none admitted |
| `VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence` | `QAN-BL-A11Y-01` — delivered by PR #306; tombstoned by itself under BG-08 |
| `A3-01 — Activity & Attention Core + In-App Production Integration` | none — no item names it; admitted `QAN-BL-NOTIF-01` … `04` and `QAN-BL-PRIV-02` |
| `A3-02 — Native Push, Permission & Platform Delivery Integration` | `QAN-BL-NOTIF-01` — delivered; tombstoned by itself under BG-08; admitted `QAN-BL-NOTIF-05` |
| `S4-02 — Shared Conversation & Material Production Integration` | none — no item names it; `QAN-BL-VOICE-01` observed and left open; admitted `QAN-BL-CW-02` (designated by the Product Owner) |
| `S4-03 — Shared Membership Lifecycle, Governance, Settings & Historical Access` | none — no item names it; `QAN-BL-ACCT-01` and `QAN-BL-VOICE-01` observed and left unchanged; none admitted |
| `Release Hardening & Launch — physical iOS / Android device validation` | `QAN-BL-NOTIF-05` |
| `PROACTIVE-EVT-01 — Proactive QANDEEL Gate & Event-Producer Integration` | `QAN-BL-NOTIF-02` |
| `REMINDER-EVT-01 — User-Requested Reminder Runtime & Event Producer` | `QAN-BL-NOTIF-03` |
| `ACCOUNT-SEC-EVT-01 — Account & Security Event-Producer Integration` | `QAN-BL-NOTIF-04` |
| `SHARED-CTX-01 — Shared Standing Context Product Integration` | `QAN-BL-CW-02` |
| `S5-01 — Public World Reachability, Entry & Identity Foundation` | none — no item names it; `QAN-BL-CW-01` re-owned to `S5-02` (Product Owner designation); `QAN-BL-ACCT-01` observed and left unchanged; none admitted |
| `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` | `QAN-BL-CW-01` — delivered by migration `0143` before any Draft / review path became application-reachable; tombstoned by itself under BG-08 (effective from its merge); `E2E-H-08` CLOSED and the 64 → 80 reconciliation DONE by S5-02; the original assignment, kept as written: must close `ASSURE-F05` before any application-reachable Draft / review creation path is opened; Product Owner assignments (S5-01 R1, not backlog items): close `E2E-H-08` when the real authorship / Public-Identity creation path consumes the S5-01 display foundation, and when that path is opened reconcile the old I-05 64-character display-label implementation ceiling with the valid 80-character account Name by a reviewed forward migration so REAL_NAME represents the full canonical account Name (no silent truncation) |
| `S5-03A — Public Semantic Interpretation + Publisher Review` | none — no item names it; `QAN-BL-ACCT-01` observed, scope unchanged, its new Experience Version / Semantic Placement `RESTRICT` dependents recorded; none admitted; the Stage-8A provider binding recorded as a closure-time admission candidate pending the Product Owner's owner-task designation |
| `S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime` | none — no item names it; `QAN-BL-ACCT-01` observed, scope unchanged, its new Experience Version / S5-03A interpretation `RESTRICT` dependents recorded; none admitted; the Stage-8A spatial-placer provider binding recorded as a closure-time admission candidate pending the Product Owner's owner-task designation |

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
   outside this document;
5. updates that task's own primary canonical document from its candidate/review banner to its final
   lifecycle state, in the same closing change (BG-09), leaving no successor task to do it.

### T-12 closure record

T-12 BG-08 reconciliation is complete on PR #220 against final implementation/validation evidence
head `02bff1b61c65c33a0d186da52dfa25d25baebe9e`: all ten inherited items are tombstoned, the one
qualifying new security residue is admitted as `QAN-BL-SEC-01`, and no T-12 Product, validation,
Architecture or Security blocker remains open in this register. The BG-08 commits after that head
are documentation-only governance records and do not alter Product/runtime code.

**Late BG-08 reconciliation.** One qualifying cross-task residue named by T-12 — the absent Product
mobile sign-in gateway — was recorded only in the task document and did not reach this register
before closure. It is admitted here as `QAN-BL-AUTH-01 — Mobile Product Sign-In Gateway`,
`OPEN — UNASSIGNED`, by `PRE-T13 — T-12 Documentation / Governance Reconciliation`, so that no
qualifying residue exists only in a task-local note. This is a register correction, not a lifecycle
change: T-12 stays `CLOSED / FROZEN`, no blocker is laundered (BG-01), no owner is invented (BG-02),
and no implementation is authorized (BG-07).

### T-14 closure record

T-14 BG-08 reconciliation covers two items.

`QAN-BL-AUTH-01` is the item T-14 opened by claiming: the contract names it, the task implements
exactly the Product entry it describes and nothing beside it, and the tombstone in §6 records the
disposition. `QAN-BL-T13-01` is a **late reconciliation of a predecessor**, in the same shape as the
`QAN-BL-AUTH-01` admission above: T-13 delivered restart, recovery and persistence and closed, but
left its own inherited item reading `DEFERRED — OWNED` here. T-14 records the tombstone rather than
leaving the register disagreeing with a closed task. That is a register correction, not a lifecycle
change — T-13 stays `CLOSED / FROZEN`, nothing about its semantics is reopened, and T-14 claims none
of its work.

`QAN-BL-SEC-01` remains `DEFERRED — OWNED` by `QAN-SEC-01 — Pre-release Mobile Credential Security`,
untouched: T-14 changed no auth persistence, no storage mechanism, no backup policy and no platform
credential model, and introduced no cryptography. No new item was admitted (BG-06), and no T-14
finding was moved here in order to close (BG-01).

### I-04 closure record (Connected Worlds v2 — Shared World Lifecycle / Conversation Runtime)

**Inherited: none.** At the kickoff of `I-04G`, the phase-closing slice, this register was read in
full. No item names `I-04`, `I-04G`, or any earlier `I-04` slice as its **Owner task**, and no item's
reopen condition is met by anything I-04 built. The only `DEFERRED — OWNED` item in the register,
`QAN-BL-SEC-01`, is owned by `QAN-SEC-01` and is untouched: I-04 changed no mobile auth persistence, no
storage mechanism, no backup policy and no platform credential model, and introduced no cryptography.

**Admitted: none.** I-04G's anti-scope is anti-scope, and `BG-06` admits none of it. The boundaries
I-04 stated and kept — `CW2-08` Safety / moderation / entitlement / Launch Gate; authenticated Product
routes, controllers and public RPC; mobile surfaces; a media storage provider, upload path or storage
credential; history-grant withdrawal after viewing; Introduction birth, success and end; Matching;
Public World; Replay; human-to-human live call; and the explicit-disclosure and World-event-derived
material producers — qualify under none of BG-06's four admission routes. None carries an existing
`OPEN` identifier; none is deferred to a future task **by a canonical document** as an obligation rather
than as a scope boundary; none is carried forward for validation; and Architecture designated none.
Several are owned by their own frozen `CW2-0N` contracts, which is where they belong: `CW2-04` owns
Public World, `CW2-05` owns Replay, `CW2-06` owns Matching and Introduction runtime, and `CW2-08` owns
safety, moderation, entitlements and launch integration. A contract that already owns a capability does
not also need a backlog entry claiming it.

**The unresolved-authority boundary is implemented, not deferred.** Phase-wide assurance later proved
that the original I-04G implementation did not fully satisfy this law: an empty dependency/approver set
could still be written as `RESOLVED_NO_HUMAN_REQUIREMENT`, and an unresolved source with known approvers
could be laundered to `RESOLVED_EXACT_HUMAN_REQUIREMENT` through `MATERIAL_DEPENDENCY`. These were active
correctness defects, not backlog candidates. `QAN-CW-REM-01` fixes both in forward migration `0119`:
zero-dependency QANDEEL material and every QANDEEL descendant of unresolved material remain
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` for later widening, while known approver rows and exact
baseline-audience delivery remain intact. Already-persisted affected rows are reconciled transitively
in the fail-closed direction without rewriting source history.

Because that boundary is complete inside this PR, **no backlog item is admitted for it**. There is no
outstanding correctness obligation to record, and BG-01 forbids moving an active-contract requirement
here rather than fixing it. The *enabling* capability — a future reviewed protected-human
subject-authority resolver — is owned by the frozen `CW2-08` and later domain contracts rather than by
an unassigned backlog entry, and qualifies under none of BG-06's four admission routes: it has no
existing `OPEN` identifier, no canonical document defers it to a named future task as an obligation, it
is not carried forward for validation, and Architecture designated none. The representation I-04G ships
is additive precisely so that resolver can extend it without reopening anything, which is recorded in
§4 of [`docs/shared-world-lifecycle-conversation-runtime-v1.md`](shared-world-lifecycle-conversation-runtime-v1.md).

**Independent closure review.** Exact implementation head `18dc934e67b951592838f7af33ecd7066efd84ab` passed independent ChatGPT
Architecture / Privacy / Database / Concurrency review after the accepted authority defect and the
same-class transitive propagation defect were corrected. `ASSURE-F04` was reproduced on real
PostgreSQL before correction and the same barrier-pinned race proved the cycle broken afterward. Two
complete Focused Database Verification rounds for `0119`, all required predecessor regressions, API
CI and Mobile CI were green on the exact accepted implementation head.

**BG-08:** no new cross-task backlog item is admitted. The authority and locking findings were active
I-04 correctness defects and were fixed before closure under BG-01. Existing Product/launch boundaries
remain owned by their already-frozen later contracts; `QAN-BL-SEC-01` remains owned by
`QAN-SEC-01` and is untouched.

**BG-09:** this same closure synchronization changes the primary I-04 banner to
`CLOSED / FROZEN`. No successor task is left to synchronize lifecycle state.

### QAN-GOV-03 lifecycle reconciliation

Two closed tasks were still advertising a pre-closure banner. `docs/recovery-persistence-v1.md`
(T-13) and `docs/mobile-product-sign-in-gateway-v1.md` (T-14) both read
`CANDIDATE — awaiting independent review` long after each had been reviewed, accepted and merged —
T-13 by PR #223 at `5d9ba46efc6cf2d391096fcb3784bf2a5588ae15`, T-14 by PR #225 at
`615e586f42be39a300370dcf32ef018d40cfaa94`. `QAN-GOV-03` corrected both banners and added BG-09
above, which is the rule whose absence allowed the drift.

**This changes no lifecycle and reopens nothing.** Both tasks were already CLOSED / FROZEN; only the
documents disagreed with the register. No Product semantics, ownership, security disposition or
acceptance criterion was touched, no backlog item changed status, and no implementation is authorized
(BG-07).

**The record of what went wrong stays.** The three late reconciliations above — `QAN-BL-AUTH-01`
admitted after T-12 closed, `QAN-BL-T13-01` tombstoned by T-14 after T-13 closed, and these two stale
banners — are the evidence BG-09 exists for. They are deliberately not rewritten to read as though
each task closed cleanly. The pattern is the point: in every case a successor absorbed work its
predecessor owed, which is precisely what BG-09 now forbids.

A bounded read-only sweep for the exact phrase `CANDIDATE — awaiting independent review` found these
two documents and no others. Two near-variant banners were found, classified and deliberately left
alone: `docs/mobile-runtime-entry-preconditions-v1.md` (T-12P) reads
`CANDIDATE — awaiting independent Architecture + Security review`, and
`docs/living-analysis-map-runtime-v1.md` (T-04) reads `implemented, awaiting independent Architecture
review`. Neither task carries a CLOSED / FROZEN closure record in this register, so neither is an
established stale banner, and repairing either on inference would be exactly the opportunistic
history-editing BG-09 warns against. They are reported to Architecture rather than corrected here.

### I-05 closure record (Connected Worlds v2 — Public World Runtime)

**Inherited: none.** At the kickoff of `I-05C`, the phase-closing slice, this register was read in
full. No item names `I-05`, `I-05A`, `I-05B`, `I-05C` or Public World as its **Owner task**, and no
item's reopen condition is met by anything I-05 built. `OPEN-06`, `OPEN-08`, `OPEN-09` and `OPEN-19`
are `OPEN — UNASSIGNED` navigation and acknowledgement capabilities that I-05 neither implements nor
blocks; `QAN-BL-SEC-01` is owned by `QAN-SEC-01` and is untouched — I-05 changed no mobile auth
persistence, no storage mechanism, no backup policy and no platform credential model, and introduced
no cryptography beyond the SHA-256 request and authority digests migrations 0091-0093 already
established. `QAN-BL-NAV-01` and `QAN-BL-NAV-02` are Personal navigation and Replay items and are
untouched: I-05C wrote no Replay producer and no Timeline surface.

**Admitted: none.** I-05's anti-scope is anti-scope, and `BG-06` admits none of it. The boundaries
I-05 stated and kept — `CW2-08` Safety / moderation / commercial entitlement / Launch Gate; the
`SIGNED_OUT_PUBLIC_VIEW_POLICY` launch requirement; authenticated Product routes, controllers and
public RPC; mobile surfaces; a public media boundary for `PUBLIC_VOICE`; Replay; successor-package
publication and republication of an absent Experience; historical alias-label rendering; a spatial or
ranking model over semantic placement; and general account deletion or erasure — qualify under none of
BG-06's four admission routes. None carries an existing `OPEN` identifier; none is deferred to a future
task **by a canonical document** as an obligation rather than as a scope boundary; none is carried
forward for validation; and Architecture designated none. Several are owned by their own frozen
`CW2-0N` contracts, which is where they belong: `CW2-04` owns Public World, `CW2-05` owns Replay and
`CW2-08` owns safety, moderation, entitlements and launch integration.

**The launch prerequisite is implemented as a fail-closed seam, not deferred.** No executable canonical
runtime for System / Safety policy, the Launch Gate or commercial entitlement exists in this
repository. I-05B created ONE seam, `resolve_public_publication_prerequisites_v1`, whose only answer is
`NOT_EVALUATED`, and made the publish boundary require exactly `CLEARED` from it as its LAST gate;
I-05C changed none of that and added no permissive constant, no launch-ready row and no
application-role grant. Production publication therefore fails closed on
`PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED` even when every authority gate is satisfied, and the
signed-out audience is still not admitted. Because that boundary is complete inside the phase, **no
backlog item is admitted for it**: there is no outstanding correctness obligation to record, and
`BG-01` forbids moving an active-contract requirement here rather than fixing it. The *enabling*
capability is owned by the frozen `CW2-08` contract rather than by an unassigned backlog entry, and the
seam is additive precisely so that slice can replace it without reopening anything. This is the same
disposition the I-04 closure record above records for the same boundary, on the same basis.

**Controller loss has no canonical producer, and I-05C did not invent one.** `I-05C`'s task contract
required a STOP if controller-loss semantics were essential to correctness and the frozen contracts did
not define whether controller loss invalidates an existing publication. They are not essential:
`create_public_experience_draft_v1` is the ONLY writer of `public_experience_controllers` in this
repository and there is no removal, transfer or revocation counterpart, so the event the policy would
govern cannot be produced by any canonical primitive. I-05C therefore implements the frozen reading —
control decides who may ISSUE a control action, and every consequential primitive re-checks it at
execution time — and continuing public eligibility reads no control at all. No backlog item is admitted:
a future reviewed multi-controller or transfer slice is an unbuilt capability owned by `CW2-04`, not an
outstanding obligation, and it qualifies under none of BG-06's routes.

**Post-publication source AVAILABILITY is a continuing condition; actor source ACCESS is not, and no
backlog item is admitted for the difference.** The frozen `0095` gate 6 is labelled `CURRENT SOURCE
ACCESS FOR THE PUBLISHING HUMAN` and asks the canonical I-04F entry point whether `auth.uid()` may still
see each included Shared history item at the consequential instant of publication. Nothing in
`0091`-`0097` re-asks it afterwards, so I-05C does not: re-asking it forever would let one human's later
loss of Shared browsing delete everyone else's Public view, which is a Product policy no frozen contract
states, and inferring it from the publish-time gate is exactly the inference that is unavailable.
Continuing eligibility instead consumes the actor-free availability and integrity truth the ONE I-05A
derivation already owns — availability state, captured availability revision, and the captured digest of
the Shared body and of the Personal committed unit — so owner deletion and source corruption fail closed
for the reason that is true, while a departed publisher's browsing status changes nothing. Migration
`0098` refuses at deploy time if that distinction is ever collapsed, and the real-PostgreSQL verifier
proves both directions against one fixture. This is a preserved frozen distinction rather than an
outstanding obligation, and it qualifies under none of BG-06's routes.

**I-05 implementation is complete; launch readiness is a different claim.** Migrations 0091-0099 leave
no Public World capability that I-05A, I-05B or I-05C deferred to a later slice. The Public World is
NOT product-launch ready and this record does not say otherwise: nothing in it can serve anybody in
production while the `CW2-08` prerequisite is unimplemented.

**Banner state.** `I-05` has no primary canonical document of its own — the canonical Public World
runtime documentation is [`database/README.md`](../database/README.md) — so `BG-09` has no stale banner
to correct here. Independent architecture, privacy, security and database-runtime review is complete;
this closure record is durable and intentionally carries no transient pull-request or merge-status text.

### I-06 closure record (Connected Worlds v2 — Replay Runtime)

**Inherited: one, and it is reconciled rather than tombstoned.** At the kickoff of `I-06D`, the
phase-closing slice, this register was read in full. Exactly one item names what `I-06` built:
`QAN-BL-NAV-02 — Analysis Replay`, whose finding is "there is no Replay of how an analysis developed"
and whose reopen condition is "Architecture opens a dedicated Replay contract". That condition was
satisfied by `CW2-05 — Replay Runtime Architecture v1.0 — CLOSED / FROZEN`, and `I-06` implemented it
in migrations `0100`-`0107`. It is nevertheless **not** tombstoned, and the reason is the whole of the
disposition: `I-06` closes the Replay *backend runtime*, and opens no Product surface through which a
human can watch an analysis develop. Tombstoning would record a capability this repository does not
have. `BG-08` permits three dispositions; `CLOSED — TOMBSTONE` would be untrue and `DEFERRED — OWNED`
would require naming an owner that does not exist, which `BG-02` and `BG-08` both forbid inventing. The
item therefore stays `OPEN — UNASSIGNED` with its **current truth** updated in §5 to record what now
exists, what still does not, and what remains fail-closed. Every other item is untouched: `OPEN-06`,
`OPEN-08`, `OPEN-09`, `OPEN-19` and `QAN-BL-NAV-01` are navigation, acknowledgement and Timeline
capabilities `I-06` neither implements nor blocks, and `QAN-BL-SEC-01` is owned by `QAN-SEC-01` — `I-06`
changed no mobile auth persistence, no storage mechanism and no credential model, and introduced no
cryptography beyond the SHA-256 request, authority and content digests migrations `0091`-`0105` already
established.

**Admitted: none.** `I-06`'s anti-scope is anti-scope, and `BG-06` admits none of it. The boundaries
`I-06` stated and kept — the video encoder, codec, container, bitrate, resolution, object storage, CDN,
public URL, signed URL, watermark and DRM; email, SMS, social and share-sheet transport; any external
provider contract, delivery receipt or recall capability; the final Replay player and the mobile Replay
Product surface; a protected-human analytical subject-authority resolver; a Shared or Public historical
analytical substrate; and `CW2-08` Safety / moderation / commercial entitlement / feature gate / Launch
Gate — qualify under none of `BG-06`'s four admission routes. None carries an existing `OPEN`
identifier; none is deferred to a future task **by a canonical document** as an obligation rather than
as a scope boundary; none is carried forward for validation; and Architecture designated none. They are
owned by their own frozen contracts, which is where they belong: `CW2-05` owns Replay and defers the
media and transport craft explicitly, and `CW2-08` owns safety, moderation, entitlements and launch
integration.

**Both launch prerequisites are implemented as fail-closed seams, not deferred.** This is the same
disposition the `I-04` and `I-05` closure records above take, for the same reason, and `I-06` has two
of them rather than one. `resolve_replay_analytical_distribution_authority_v1` answers
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT`, because the protected-human SUBJECT half of a QANDEEL
analysis authority requirement has no canonical producer in this repository; migration `0104` makes that
state **unrepresentable inside a distribution package** rather than merely refused, so unresolved can
never be reinterpreted as zero approvers. `resolve_replay_distribution_prerequisites_v1` answers
`NOT_EVALUATED` on every `CW2-08` dimension, and both the authorization boundary and the `I-06D` current
eligibility derivation require exactly `CLEARED` from it as their LAST gate, after every privacy and
ownership gate. Production Replay distribution therefore fails closed even when every authority gate is
satisfied. Because each boundary is complete inside the phase, **no backlog item is admitted for
either**: there is no outstanding correctness obligation to record, and `BG-01` forbids moving an
active-contract requirement here rather than fixing it. The enabling capabilities are owned by the
frozen `CW2-08` contract and by a future reviewed subject-authority slice, and both seams are additive
precisely so those can replace them without reopening anything.

**Source loss after finalization is implemented, and no Public rule was invented for it.** `CW2-05`
declines to invent automatic Public withdrawal solely because a private source later became
unavailable, and `I-06D` implements that as written: current source availability, current
complete-Replay usability and current delivery eligibility are all derived live and all fail closed on
source loss, while the canonical Public visibility resolver is consumed unchanged and no Public
lifecycle transition is performed. Everything the Public runtime already fails closed on — approval
withdrawal, controller disappearance, `ABSENT_FROM_PUBLIC_WORLD` and every other `I-05C`
continuing-eligibility failure — still does, immediately, and no Replay state resurrects an Experience
after any of them. `QANDEEL` cannot guarantee recall of already-exported external copies and this
runtime records no claim that it can. These are preserved frozen distinctions rather than outstanding
obligations, and they qualify under none of `BG-06`'s routes.

**`I-06` implementation is complete; launch readiness is a different claim.** Migrations `0100`-`0107`
leave no Replay runtime capability that `I-06A`, `I-06B`, `I-06C` or `I-06D` deferred to a later slice
of `I-06`. Replay is NOT product-launch ready and this record does not say otherwise: nothing in it can
distribute anything to anybody in production while the two prerequisites above are unimplemented, and
there is no media, storage or transport for it to distribute through.

**Banner state (`BG-09`).** `I-06` does have a primary canonical document —
[`docs/replay-runtime-v1.md`](replay-runtime-v1.md) — so `BG-09` applies here, and both halves were
performed by the closing change itself rather than left to a successor. Two stale banners existed and
both are recorded rather than erased: `I-06C` still read `CANDIDATE — awaiting independent ChatGPT
review` after the pull request that merged it, normalized by `I-06D` as the parent-closing slice and as
governance reconciliation only; and `I-06D`'s own candidate banner was moved to `CLOSED / FROZEN` by
the closure-sync change. Section 63 of that document carries the reviewed implementation SHA, the pull
request, and the statement that final merge still requires review and CI on the exact closure-sync
head. This register entry is durable and intentionally carries no transient merge-status text of its
own.

### I-07 closure record (Connected Worlds v2 — Matching / Introductions Runtime)

**Inherited: none.** The canonical backlog was read in full at I-07D kickoff. No open item names
`I-07`, `I-07D`, Matching or Introduction as its Owner task, and no existing reopen condition is
satisfied by this phase. `OPEN-06`, `OPEN-08`, `OPEN-09`, `OPEN-19`, `QAN-BL-NAV-01` and
`QAN-BL-NAV-02` remain navigation, acknowledgement, Timeline and Replay-surface items outside the
Matching/Introduction backend closure. `QAN-BL-SEC-01` remains `DEFERRED — OWNED` by `QAN-SEC-01`.

**Admitted: none.** I-07's anti-scope remains anti-scope under BG-06. The frozen later work — mobile
integration, final Product copy and visual treatment, exact progressive-image rendering, safety,
moderation, report/block, entitlements, pricing, feature rollout and Launch Gate integration — is
already owned by `I-08`, `I-09`, `CW2-06` or `CW2-08`. No new backlog item is invented merely to
repeat those ownership boundaries.

**Review findings were fixed, not deferred.** Independent review found `I07D-IDEM-01` and
`I07D-SCOPE-01`. Both were confirmed and corrected inside I-07D before acceptance: reactivation command
identity now binds entry-channel provenance on both historical retry paths, and migration `0118`
forward-extends the canonical Shared material cores so an `ACTIVE / INTRODUCTION` World supports normal
human/QANDEEL conversation without a parallel material or history model. BG-01 therefore has no defect
to move into this register.

**Phase state.** Exact accepted implementation head
`9be1757fc4686bdf76a3c39e39ba099f98d7181a` passed independent Architecture / Privacy / Database / Concurrency review after the fixes,
two complete Focused Database Verification rounds for migrations `0115`–`0118`, the required
predecessor regressions, and exact-head API/Mobile CI. `I-07A`, `I-07B`, `I-07C`, `I-07D` and parent
`I-07` are now `CLOSED / FROZEN`. Launch readiness is explicitly not implied; production-enabling
safety/entitlement/Launch Gate work remains fail-closed and owned by the later launch phase.

### I-08B3.1-G3 and parent I-08B3.1-G — design-track BG-08 reconciliation

This is a design-track record. `I-08B3.1-G3` is not Connected Worlds phase `I-08`, and this section is not a phase
record for it. The primary record is
[`design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`](design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md), and it
carries G3's and parent G's lifecycle state itself (BG-09).

**Inherited: none.** No item names G3, parent G or any I-08B3.1 task as its Owner task. The adjacent items stay where
they are:
- `QAN-BL-NAV-02` still owns the Product Analysis Replay surface;
- `QAN-BL-VOICE-01` still owns the Personal Voice / Live Call runtime. The G3 Matching / Live-Call rule consumes that
  item's future call authority and takes nothing from it;
- `QAN-BL-SEC-01` is untouched.

**Admitted: one, `QAN-BL-VIS-01`.**
- **Why it qualifies:** it is the heavy-history density / level-of-detail stress proof that G2 §G deferred by name and the G3 readiness handoff carried forward unchanged.
- **Why now:** parent G closes and can no longer hold it.
- **Why it is not a laundered blocker (BG-01):** G3's contract forbade touching the world.

**Not admitted:** every other G3 carry-forward, for the reasons the closure record §H states. None is admitted (BG-06):
- the proof copy;
- the device gates;
- the production implementation of the frozen presentation contracts;
- the Matching / Live-Call presentation, owned by Connected Worlds `I-08`.

**A disposition that needs no backlog entry.** The F1 / F2 North Star spectacle requirement, which the F records gave to
G, is dispositioned by the Product Owner's decision recorded in the closure record §E: met by the accepted canonical
I-08B1 world. That leaves no obligation to register.

### P4 — design-track BG-08 reconciliation

This is a Product-track record. P4 is neither a `T-` task nor a Connected Worlds `I-0N` phase, so it has no index
tombstone and no phase closure heading. Its primary record is
[`canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md`](canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md),
and it carries P4's and `APP-OPS-01`'s lifecycle state itself (BG-09).

**Inherited: none.** No item names P4, a P4 slice or `APP-OPS-01` as its Owner task. `QAN-BL-CTX-01` is P4's own
admission, made by P4-C1, and stays `DEFERRED — OWNED` by `QAN-CTX-01` because that runtime task has not opened.

**Existing items reused, not aliased.** `QAN-BL-VOICE-01` gains a current-truth note naming the P4 residues that wait on
its runtime truth; its owner, severity, status and reopen condition are unchanged. `QAN-BL-NAV-02` (the Replay surface,
now named «إعادة العرض» / Replay by P4-C3R — a name, not the surface), `QAN-BL-VIS-01`, `QAN-BL-CW-01` and
`QAN-BL-SEC-01` are unchanged. Control-plane authentication is not `QAN-BL-SEC-01`, which owns mobile credential storage.

**Admitted: one, `QAN-BL-LANTERN-01`.**
- **Why it qualifies:** P4-C2 §2 defers a real v1 obligation to the named future task `QANDEEL — Lantern Gateway Identity
  Moment v1` — BG-06's second route.
- **Why now:** P4 closes and can no longer hold it; it may not live only in the P4 carry-forward matrix.
- **Why it is not a laundered blocker (BG-01):** the Product Owner took the work out of P4 by decision.

**Not admitted.** The APP-OPS carry-forwards (the two audit fields, implementation, control-plane security mechanics,
diagnostic identity, the Remote Configuration family register, release / OTA governance, operational readiness), the
undrawn screens, journey copy, account lifecycle, economy, provider selection, device gates, production ports and craft,
and the Connected Worlds-owned surfaces. Each is already owned by the End-to-End audit, Production Integration, Release
Hardening, Product Owner + Architecture controlled approval, or Connected Worlds `I-08` / `I-09`, and none qualifies under
BG-06. The P4 final closure §9 gives the reason row by row.

**BG-01.** No P4 finding was moved here in order to close. The P4-C3 findings were resolved inside P4-C3 / P4-C3R or are
dispositioned in the P4 final closure §6.
