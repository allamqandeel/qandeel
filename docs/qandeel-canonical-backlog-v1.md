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
| `QAN-BL-NAV-02` | Analysis Replay | `S7-05 — Replay Final Integration, Device Proof & Stage Closure` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-VOICE-01` | Personal Voice / Live Call Runtime + Durable Audio Source | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-AUTH-01` | Mobile Product Sign-In Gateway | `T-14 — Mobile Product Sign-In Gateway v1` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-VIS-01` | Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof | `LA-SCALE-01 — Living Analysis Heavy-History / Dense-World Scale & LOD Proof` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-CTX-01` | Runtime-backed Conversational Relevance | `QAN-CTX-01 — Conversational Relevance Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-CW-01` | Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`) | `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-LANTERN-01` | Lantern Gateway Identity Moment v1 — Creative / Motion / Interaction Realization | `QANDEEL — Lantern Gateway Identity Moment v1` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-ACCT-01` | Account Deletion Across Connected Worlds — Explicit Connected-Worlds Deletion Blocker | `ACCT-DEL-02 — Account Deletion Across Shared STANDARD / Public` | `HIGH` | `DEFERRED — OWNED` |
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
| `QAN-BL-CW-02` | Shared Standing Context Product & Private-Source Integration | `SHARED-CTX-01 — Shared Standing Context Product Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-CW-03` | Shared World Living Analysis Map / Semantic Geography Product Integration | `SHARED-VIS-01 — Shared World Living Analysis Map Product Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-CW-04` | Public Lightweight Reactions Runtime (PG-07) | `PUBLIC-REACTIONS-01 — Public Lightweight Reactions Runtime` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-CW-05` | QANDEEL Conversational Output Cannot Be a Shared Semantic-Place Source | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-CW-06` | The Ended Shared World Has No Read-Only Living Analysis View | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-CW-07` | Shared World Temporal Navigation | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-MATCH-01` | Matching Setup Enrollment, Correction and Resume Suspended Before Launch (SEC-MATCH-00) | `S6-07 — Activity, Direct Entry and Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-PROD-06` | Data API Unbounded `40001` Retry on PostgREST Before v16 (Core Conversation, Hypothesis, Shared Standing Context, Matching, Shared ID Rotation) | `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-PROD-07` | Post-v16 PostgREST: Race-Converging `40001` Paths and Genuine Deadlocks Lose the Server-Side Re-run | `PROD-RETRY-02 — Post-v16 Data API Retry Semantics` | `LOW` | `DEFERRED — OWNED` |
| `QAN-BL-PROD-08` | Introduction Photo Object Store: Hosted Supabase Storage Provisioning and Live Conformance | `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-INTEL-01` | Personal Evidence Invalidation → Derived Understanding Re-evaluation (PG-02) | `INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02)` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-QIR-01` | General Question Bind-Time Version and Lifecycle Recheck (R3-G) | `QIR-006-R1 — Formal Question Bind-Time Version & Lifecycle Recheck` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-INTEL-02` | Post-Response Intelligence Ledger Content (`0029` Intent Span, `0033` Candidate Plan): Retention and Reuse After Forget / Do-Not-Rely | `INTEL-RET-01 — Post-Response Intelligence Ledger Retention & Provenance Review` | `HIGH` | `VALIDATION — OPEN` |
| `QAN-BL-CI-02` | Forward-Safety Mirror: the `QAN-INF-03` Expo Dependency-Validation Leg Fails Intermittently on Some Local Hosts | `QAN-INF-06 — Forward-Safety Mirror Expo Validation Determinism` | `MEDIUM` | `VALIDATION — OPEN` |
| `QAN-BL-INTEL-03` | Hypothesis Semantic Support: Legacy Never-Supported Hypotheses (R-G1a) and Support by Unrelated Eligible Evidence (R-G1b) | `INTEL-SV-01 — Hypothesis Semantic Support Verification` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-PRIV-03` | Export My Data Omits Whom Each Memory Is About (the Subject `about` Field) | `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-IP-01` | Personal Interaction Preferences Do Not Shape Public World QANDEEL Replies | `PUBLIC-PREF-01 — Public World Personal Interaction Preference Decision` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-IP-02` | Interaction Preferences: Real-Model Behavioural Quality (Seven Reply Languages / Dialects, Brevity, Humour, Explanation Style) | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `MEDIUM` | `VALIDATION — OPEN` |
| `QAN-BL-ACE-01` | The QANDEEL Personality Core Does Not Reach Shared / Public QANDEEL Replies (Gate B) | `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-ACE-02` | Adaptive Conversational Expression: Real-Model Personality Behaviour on the Golden Conversations Suite | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `MEDIUM` | `VALIDATION — OPEN` |
| `QAN-BL-GOV-01` | Locator and Closure-Record Drift After the IP-IMP-01, ACE-01 and SHARED-VIS-01 Merges | `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-LAUNCH-04` | Shared / Public Living Analysis — Physical Android Rapid-Interaction & Resize Stability Proof | `Stage 9 — Economy + Launch Closure (release-readiness gate)` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-MATCH-02` | Introduction-Phase Account Name Exposure Through Phase-Blind Shared World Reads | `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MATCH-03` | Safe Compatibility Conclusion Production Capability, AI Cost Attribution and Evaluation | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-PRIV-04` | Export My Data Omits the Reader's Matching and Introductions Data | `S6-07 — Activity, Direct Entry and Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-PRIV-05` | Export My Data Omits the Reader's Shared, Public and Replay World Data | `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-MATCH-04` | Understanding Readiness Before Real Matching | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-MATCH-05` | The Confirmed Introduction First Name Is Not the Canonical Matching First-Name Source | `S6-03 — Matching Proposal Pipeline & Intelligence Prerequisites` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MATCH-06` | No Runtime Producer Forwards a First-Approved Proposal to the Second Recipient | `S6-07 — Activity, Direct Entry and Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-LAUNCH-05` | Introduction Photos on iOS: Device Cache Proof and Store Review of the Purpose Strings | `Stage 9 — Economy + Launch Closure (release-readiness gate)` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-ACCT-02` | Replay Has No Account-Deletion Module: an Account's Replay Footprint Blocks Its Erasure | `S7-01 — Replay Secure Integration & Account Erasure` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-PROD-09` | No World Opens in Production Without an Automated Account-Deletion Coverage Check | `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-PROD-10` | A Photo Object Lost From the Private Store Blocks Its Owner's Export Bundle | `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-LAUNCH-06` | Export My Data's Photo Folder Save on iOS, Physical Android Devices and Read-Only Places | `Stage 9 — Economy + Launch Closure (release-readiness gate)` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-ACCT-03` | Account Erasure Outside the Personal Replay: Non-Personal Replay Sources and Replay Distribution | `Stage 9 — Economy + Launch Closure (Replay distribution / CW2-08)` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-RSP-03` | Arabic Global Switcher Destination Words Truncated at the Default Text Size on a Physical Phone | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-AI-01` | DeepSeek Real-User Enablement: Data Terms, Disclosure, Consent, Policy, In-App Report, Pseudonymous Identifier and Output Moderation | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-AI-02` | The Background and Semantic Model Calls Are Still Bound to OpenAI and Gemini | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-AI-03` | DeepSeek's Time-of-Day Pricing Cannot Be Represented by a Price Card | `Stage 9 — Economy + Launch Closure (release-readiness gate)` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-AI-04` | Shared and Public World DEEP Replies Keep the 10 s Budget Under DeepSeek | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-AI-05` | Complex Messages Routed FAST Rarely Complete Within the 3 s Budget Under DeepSeek | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-AI-06` | Two Shared World Participants With the Same Name Reach the Model as One Speaker | `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-AI-07` | Shared World Participants Without a Name All Reach the Model as One "A participant" | `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-AI-08` | QANDEEL's Earlier Shared Replies Reach the Model Without the Person They Answered | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-AI-09` | Text Inside One Participant's Shared Message Can Pose as Another Participant Speaking | `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-CI-03` | Android API 36 Emulator Boot Smoke: GitHub Runner Emulator Infrastructure (PO-WAIVED) | `CI-ANDROID-01 — Android Emulator CI Infrastructure Reliability` | `MEDIUM` | `DEFERRED — OWNED` |

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

> **Historical pre-closure schema.** This block records the item as it stood before S7-05's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-NAV-02` in §6 (S7-05).

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
- *(S7-02 dated note, 2026-10-19; not merged; no field changed.)* S7-02 delivers the Personal Conversation's Replay
  entry and the selection of the whole conversation or one contiguous part, saving a real draft through the S7-01 API
  behind the closed Personal Replay capability ([S7-02 record](e2e/QANDEEL_S7_02_IMPLEMENTATION_RECORD_v1.md)). It is
  not the surface this item names: no player, preview or analysis development exists (S7-03 / S7-04). The item stays
  `OPEN — UNASSIGNED`; the Stage 7 WP0 places its reconciliation at S7-05.
- *(S7-03 dated note, 2026-10-19; not merged; no field changed.)* S7-03 delivers the historical composite visual proof:
  one Replay moment's exact text and the analysis as it stood at that moment, read through the three S7-01 reads and drawn
  by the existing Living Analysis surface and Map through a governed adapter
  ([S7-03 record](e2e/QANDEEL_S7_03_IMPLEMENTATION_RECORD_v1.md)). It is a proof, not the surface this item names: no
  player, navigation or Analysis entry exists (S7-04). The item stays `OPEN — UNASSIGNED`; the Stage 7 WP0 places its
  reconciliation at S7-05.
- *(S7-04 dated note, 2026-10-20; not merged; no field changed.)* S7-04 delivers the production Replay player behind the
  closed Personal Replay capability: a passage over the Conversation or the Analysis with its two entries, the S7-03
  composite, the Replay Temporal Spine, play / pause at a declared reading pace, and the private preview / finalize /
  reopen through the existing S7-01 routes ([S7-04 record](e2e/QANDEEL_S7_04_IMPLEMENTATION_RECORD_v1.md)). Nothing is
  reachable while the gate is closed. The item stays `OPEN — UNASSIGNED`; the Stage 7 WP0 places its reconciliation at
  S7-05.
- *(S7-05 CP1 dated note, 2026-10-20; not merged; no field changed.)* S7-04 merged through PR #350 as `f9bc3947`. S7-05
  decides F-2 as Option B — a Reading's scope crosses the Replay wire as its class alone — and approves the 27 English
  rows of S7-02 and S7-03 ([S7-05 record](e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md)). The Product Owner approved this
  item's closure in principle (D4), at CP3 and only on complete evidence, including the real-device proof. The item stays
  `OPEN — UNASSIGNED` until then.
- *(S7-05 closing dated note, 2026-10-20; PR #351, not merged.)* Tombstoned by S7-05's closing change under D4, on the
  completed evidence ([S7-05 record](e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md) §7, §8, §10); see §6. The fields above are kept as they stood.
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
- **Arabic speech-pronunciation quality (Product Owner direction, 2026-10-20; Stage 8B handoff, no implementation authorized):** the future Voice runtime must have a **context-aware Arabic pronunciation/vocalization preparation step before TTS**, capable of resolving unvowelled words whose meaning/pronunciation changes with diacritics, respecting the user dialogue, intended meaning and relevant dialect. Evaluate selective diacritization or provider-compatible phonetic hints rather than indiscriminately rewriting all displayed words. The speech-only representation must not mutate user-visible conversation text, stored original utterances, Memories or factual meaning; avoid inventing a pronunciation when context does not establish it. Test ambiguous minimal pairs in context, Egyptian and supported Arabic dialects, proper names, latency/streaming fit and the chosen TTS voice. This is within **the existing VOICE-01 item** — no second backlog item, count/state/owner change. Stage 8A may preserve necessary text/context interfaces but does not implement, claim or close this TTS requirement.
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
- **Owner task:** `LA-SCALE-01 — Living Analysis Heavy-History / Dense-World Scale & LOD Proof` (Product Owner designation, S5-04 Decision Gate D6, 2026-10-08; previously `UNASSIGNED`)
- **Severity:** `HIGH`, because if reopened it can affect an already-frozen capability, the I-08B1 world.
- **Reopen condition:** Architecture or Product opens a world-scale density / level-of-detail proof task; or a production
  port, or real long-term history, shows the frozen world losing legibility, semantic truth or performance at scale.
- **Status:** `DEFERRED — OWNED` (from S5-04, at the Product Owner's D6 decision; previously `OPEN — UNASSIGNED`)

This entry defines no density, no level-of-detail rule, no token and no world change. Any change to the world still passes through I-08B1's own reopen rule. The Product Owner's ruling that the F1 / F2 North Star spectacle requirement is met (G3 closure §E) is a separate, fully dispositioned obligation and does not answer this G2 heavy-history stress item.

**Current-truth note (LA-VIS-01, 2026-10-07).** `LA-VIS-01`, the Product Owner's graphics-only Living Analysis redesign
(implementation `550ce07`, not merged; [S5-03B record](e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md)
§27), was accepted on sparse fixtures and proved on an Android emulator only. It does **not** close this item: real-phone
performance and heavy-history / world-scale density and level-of-detail stress remain unproved, and they stay here rather than
in a duplicate item. This note changes none of this item's fields: `UNASSIGNED`, `HIGH`, `OPEN — UNASSIGNED`. *(At the time; the
fields were changed by the S5-04 reconciliation below, at the Product Owner's decision.)*

**Re-ownership and family reconciliation (S5-04, Product Owner Decision Gate D6, 2026-10-08).** The Product Owner assigns
this item ONE future owner, `LA-SCALE-01 — Living Analysis Heavy-History / Dense-World Scale & LOD Proof`, and reconciles under it — with NO duplicate item — the whole bounded-v1 scale family that
Stage 5 recorded as OPEN PRODUCT GAPS: S5-03B's **G04** (the Public field and search re-derive every candidate at read time —
correct and stale-proof, not tuned for a large World) and **G05** (the field read's `LIMIT 400` and the absence of dense-field
aggregation), together with S5-03C's own read bounds in the same family (≤ 24 relation lines per Experience, ≤ 100 own
Experiences and ≤ 200 own relations per management read). The owner covers: `LIMIT 400` / dense-world behaviour, dense
aggregation, Public field / read / search performance at world scale, heavy-history density, level of detail and legibility,
and real-device scale / performance proof. The decision is ownership and reconciliation, not scope: S5-04 solved none of it,
and nothing here defines a density, a level-of-detail rule, an index or a world change. Severity stays `HIGH`; the reopen
condition is unchanged.

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
- **Owner task:** `ACCT-DEL-02 — Account Deletion Across Shared STANDARD / Public` (re-owned by ACCT-DEL-01's closing
  change, 2026-10-17, for the residue ACCT-DEL-01 does not cover; see the ACCT-DEL-01 closing note below. Before it:
  `ACCT-DEL-01 — Account Deletion Across Matching / Introductions` from its CP1, and `UNASSIGNED` before that)
- **Severity:** `HIGH`. If this is reopened, it decides whether any Connected World may launch (closure §8.4 item 9),
  and it lands on the frozen CW2-08 §2 non-waivable deleted-content non-serving law.
- **Reopen condition:** Architecture or the Product Owner opens a task to take any Connected World toward
  production-ready for users; or opens a Connected Worlds account-deletion or erasure task; or assigns an owner to
  `QAN-BL-CW-01`.
- **Required future property:** the one the closure already states, and no other. No Connected World is considered
  production-ready for users while Account Deletion cannot meet its deletion contract there.
- **Dated note (S6-03 closing change, 2026-10-15; effective from its merge):** three more relations join the
  Connected Worlds footprint, each `ON DELETE RESTRICT`: `matching_confirmed_fact_versions`,
  `matching_confirmed_fact_state` and `matching_eligibility_snapshot_fact_bindings` (`0156`). Any committed row makes
  the `0130` erasure answer a truthful `BLOCKED` with nothing erased (`verify-migration-0156` J02). No production row
  exists. Owner, severity and status unchanged ([S6-03 record](e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md) §7).
- **Dated note (S6-06 CP1, 2026-10-16; not merged; effective from its merge):** six relations join the Connected Worlds
  footprint in `introduction_sharing_private` (`0162`): `image_series` binds its owner `ON DELETE RESTRICT`, and the
  display-consent events bind the owner's exact disclosure version the same way. Photo bytes live outside PostgreSQL, in
  the private object store; an owner's removal erases them (DELETE + HEAD, from database truth), but no account-level
  deletion reaches them yet. No production row or object can exist (CW2-08 closed). Owner, severity and status unchanged
  ([S6-06 record](e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md) §8).
- **Status:** `DEFERRED — OWNED` (was `OPEN — UNASSIGNED` until the ACCT-DEL-01 re-owning, 2026-10-17; it stays open
  at ACCT-DEL-01's closure, P-1)

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

**Current-truth note (S5-03C, 2026-10-07).** S5-03C does not solve this item, and it adds to the footprint the item covers.
No S5-03C column names an account and no foreign key reaches one directly, but every explicit Public relation
(`public_relation_private.explicit_relations`) binds TWO Experience Versions and TWO S5-03A semantic interpretations
`ON DELETE RESTRICT`, and its authority acts (`explicit_relation_acts`) bind the relation `RESTRICT`; those interpretations
bind their `0096` placements, which bind their recorders' accounts. Those dependencies are recorded here as part of this
blocker and are not resolved by S5-03C. This item stays `HIGH`, `OPEN — UNASSIGNED`, its scope unchanged; the Public World is
still not launch-ready ([S5-03C record](e2e/QANDEEL_S5_03C_PUBLIC_EXPLICIT_RELATIONS_INTEGRITY_CLOSURE_IMPLEMENTATION_RECORD_v1.md) §14).

**Current-truth note (S5-04, 2026-10-08).** S5-04 does not solve this item. Its human discussion posts and Public QANDEEL
responses are rows of the frozen `0096` tables, whose author foreign keys (`public_discussion_posts` → `public_identities` /
`users`, `RESTRICT`) were already part of this blocker; S5-04 makes them application-reachable for the first time (behind the
fail-closed entitlement seam). Its own `public_discussion_private.qandeel_invocations` binds the invoking post and the one
response `RESTRICT` and names no account; its per-human work lease and grant rows reference `public.users` `ON DELETE CASCADE`.
A discussion post provisions the ONE Public Identity exactly as S5-02 does. These dependencies are recorded here as part of
this blocker. This item stays `HIGH`, `OPEN — UNASSIGNED`, its scope unchanged
([S5-04 record](e2e/QANDEEL_S5_04_PUBLIC_DISCUSSION_QANDEEL_FINAL_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §15).

**Current-truth note (SEC-MATCH-00, 2026-10-09; implemented, not merged).** SEC-MATCH-00 protects this item. It does
not solve it.

- **The proven risk (C0).** Any signed-in account could call four direct `0109` commands with no Matching history and
  commit a `matching_setup_locks` row (`ON DELETE RESTRICT` to the account). Every `0108` relation refuses `DELETE`,
  so the governed Personal erasure (`0130`) then answers `BLOCKED` with no governed recovery.
- **The protection.** Migration `0149` makes the six widening commands executable by no application role. An account
  that never had a Matching footprint can no longer acquire one through any client route; this is proven by real
  PostgreSQL and live PostgREST.
- **What it does not do.** It erases nothing. An account that already holds a Matching footprint keeps it, and its
  erasure stays truthfully `BLOCKED`, never relabeled as deleted. Every Matching `RESTRICT` reference to the account
  is unchanged.
- **The hosted environment** is `NOT_DEPLOYED` (C1, metadata only), so no production footprint can exist today.

This item stays `HIGH`, `OPEN — UNASSIGNED`, its scope unchanged
([SEC-MATCH-00 record](e2e/QANDEEL_SEC_MATCH_00_MATCHING_DIRECT_RPC_PROTECTION_IMPLEMENTATION_RECORD_v1.md) §7).

**Product Owner direction (Stage 6 WP0 final decision addendum, 2026-10-13; D3).** The Product Owner approves a
separately owned correction path for this item, provisionally named `ACCT-DEL-01`. It is to address deletion integrity
across the relevant worlds. No real Matching enrollment happens before the deletion-blocking footprint is resolved.
- **Verified:** the id `ACCT-DEL-01` is unused in the tree, in the history of every ref, and in GitHub issues and PRs.
  No other item or task carries Connected Worlds deletion
  ([WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14.14).
- **Not changed by this note:** none of this item's fields. Two things wait for the Product Owner to confirm the
  provisional name:
  - the formal re-owning to `ACCT-DEL-01`, as `DEFERRED — OWNED`;
  - the update of this item's index-row pin in `tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs`,
    made in the same change as the re-owning.
- **Not implemented:** nothing.

**Current-truth note (ACCT-DEL-01 CP1, 2026-10-17; the ACCT-DEL-01 pull request, not merged; effective from its
merge).** The Product Owner confirmed the name and approved the ACCT-DEL-01 WP0 v1.1 design with P-1 … P-4. This item is
re-owned to `ACCT-DEL-01` as `DEFERRED — OWNED`, and its index-row pin is updated in the same change, exactly as the note
above required. The item's earlier "Current truth" line ("no account-deletion code exists") was already superseded by
`0130` (Personal erasure, Connected Worlds `BLOCKED`); it is left as the record of its date.
- **Implemented in CP1 (`0164`, not deployed):** one governed account erasure that removes an account's whole Matching /
  Introductions footprint and runs the unchanged `0130` Personal erasure in the same transaction, or nothing. The
  counterpart keeps their own words (a retained view), an ordinary END and an exact Matching lineage. A footprint the
  erasure does not cover answers a truthful, recorded `BLOCKED` with its residue class, and nothing is touched; it is
  re-armed with a fresh grace when a module covers its class
  ([ACCT-DEL-01 record](e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md)).
- **Still open, and this item stays open (P-1):** Shared `STANDARD` (post-SUCCESS Worlds included) and Public — future
  owner `ACCT-DEL-02`; Replay — Stage 7. The coverage registry (`0164`) names every uncovered residue class and its owner,
  and CI refuses a new relation that references the account without one. No Connected World other than Matching /
  Introductions has a complete, proven account-deletion path; none is production-ready for users while its class is
  uncovered (closure §8.4 item 9). Account deletion in QANDEEL as a whole is **not** closed.
- **At CP2** (the same pull request): this item's narrowed disposition and its future owners are recorded, with
  `QAN-BL-MATCH-01`'s `ACCT-DEL-01` dependency marked met.

**ACCT-DEL-01 closing note (CP2, 2026-10-17; the ACCT-DEL-01 pull request, PR #345, not merged; effective from its
merge).** The Product Owner approved CP1 on its exact head `906813121683960fda4baaf08be1a39c3c6fc438` (API CI
`39030890618` and Mobile CI `39030890572` green, `verify-migration-0164` on real PostgreSQL included). BG-08 disposition:
**re-owned and narrowed, not tombstoned.**
- **Handled by ACCT-DEL-01:** account deletion across Matching / Introductions, the Introduction World's own dependencies
  included (`0164`, record §2–§4). That part of this item's finding no longer holds for an account whose footprint is
  Matching / Introductions and Personal only. Nothing is deployed: the hosted database stops at `0074`.
- **Still open, and this item stays open (P-1):** the account deletion of Shared `STANDARD` Worlds (post-SUCCESS
  Introduction Worlds included) and of the Public World. Owner: `ACCT-DEL-02 — Account Deletion Across Shared STANDARD /
  Public`, a future task with its own Product decisions and Task Contract; it is not opened or started by this note, and
  the descriptive half of its name is this change's until its Task Contract names it. `ACCT-DEL-02` covers its classes in
  `account_erasure_private.residue_class_coverage` in the same change as its erasure module, and can tombstone this item
  only once both classes are covered and proven (Replay's class is `QAN-BL-ACCT-02`'s).
- **Replay** is not in this item any more: its residue is admitted as `QAN-BL-ACCT-02` (owner `Stage 7 — Replay`), so
  that each residue class has exactly one owner (BG-02).
- **The release gate** (closure §8.4 item 9; P-1) is admitted as `QAN-BL-PROD-09` (owner `HOSTED-DEPLOY-01`): no World
  opens in production before an automated check on the hosted project proves that its account-deletion coverage is
  complete. The repository's own coverage truth (the coverage census in CI, `server_read_account_erasure_coverage_v1`) is
  not by itself an executable deployment block, and nothing claims it is.
- Account deletion in QANDEEL as a whole is **not** closed. The required future property above is unchanged.

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

> **Historical pre-closure schema.** This block records the item as it stood before S8A-04's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-CW-02` in §6 (S8A-04).

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
- **Current truth (BG-08 reconciliation at IP-IMP-01, PR open, not merged):** the owner's canonical Interaction Preferences
  record (migration `0153`: reply length, reply language / dialect, humour, explanation style) is a new Personal private
  source in exactly this item's sense. It shapes Personal-world replies only; the Shared reply builder still renders the
  fixed Text v1 guidance and offers no private candidate (proved structurally by IP-IMP-01's isolation spec). Whether a
  participant's preferences may ever shape a Shared group reply is decided here; the item's scope, owner, severity and
  status are unchanged, and no second item was admitted for it (anti-duplication).
- **Current truth (BG-08 reconciliation at ACE-SP-01, 2026-10-12; Draft PR, not merged):** the Shared reply builder now
  renders Text v1 + the Shared frame, then the world-neutral QANDEEL personality guidance (the ACE-SP-01 controlled
  amendment), plus the approved humour suspension on a Safety `GUIDED` turn. That guidance is the same for every
  participant, and no participant's preference is read. It still offers no private candidate, and the isolation spec stays
  unchanged and green. This item's scope, owner, severity and status are unchanged.
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

### `QAN-BL-CW-03` — Shared World Living Analysis Map / Semantic Geography Product Integration

> **Historical pre-closure schema.** This block records the item as admitted and as its owner task found it. It is not the
> current lifecycle state; the current state is the `CLOSED — TOMBSTONE` record in §6 below (SHARED-VIS-01, closed
> retroactively by GOV-REC-01).

- **Title / Finding:** the Stage-4 Shared World runtime, authority, conversation, governance, history, Activity and Direct
  Entry are delivered, but the production mobile World surface is still conversation-centric (`SharedWorldArea` +
  `SharedWorldThread`) rather than the Living Analysis semantic World described by the Shared Product North Star. It does
  not consume the Living Analysis Map renderer, shared semantic world surface, FAR / MID / NEAR visual physics, or a
  Shared-specific semantic projection. The current Product therefore delivers the Shared conversation and World shell,
  but not the full "world, not chat" spatial realization.
- **Source:** `QANDEEL_SHARED_WORLD_PRODUCT_DEFINITION_v1.md` §7, §8, §24 and §26 (live space, shared visual family,
  semantic zoom / pan / stable geography / Timeline, "world, not chat"); `QANDEEL_CW2-07_CROSS_WORLD_NAVIGATION_VISUAL_INTEGRATION_v1.0_FROZEN.md`
  §5, §21 and §47 (independent World-local camera / focus / semantic geography); current production mobile truth in
  `apps/mobile/src/shared-world/SharedWorldArea.tsx` / `SharedWorldThread.tsx`. Discovered during the S5-03B Product review
  on 2026-10-07 and explicitly designated by the Product Owner as a deferred gap.
- **Current truth:** Stage 4 remains `DONE / MERGED` for the work it actually delivered. No Shared authority, membership,
  material, governance, history, notification or Direct-Entry runtime is reopened. The missing piece is the Shared semantic
  projection / Living Analysis Product realization only. The generic Living Analysis renderer seam being extracted in
  S5-03B may later be consumed, but this item authorizes no implementation while Stage 5 is active.
- **Why deferred:** the Product Owner explicitly preserves the execution map: finish Public World / Stage 5 completely
  first, then return to this Shared visual-semantic correction. Starting it during S5-03B / S5-03C / S5-04 would fragment
  the active Public World stage and duplicate renderer work before the Public adoption settles.
- **Owner task:** `SHARED-VIS-01 — Shared World Living Analysis Map Product Integration`
- **Scope:** after Stage 5 is `DONE / MERGED`, consume the common Living Analysis renderer / world physics with a
  Shared-specific projection and independent viewer-local camera / focus / time state; preserve the existing Shared
  conversation, membership, governance, history, Activity and authority surfaces as the Shared World's own Product chrome
  and controls; do not map Shared truth into fake Personal Threads / Readings / Sessions and do not rebuild I-04.
- **Severity:** `HIGH` — without it, Shared World remains materially more like a shared conversation surface than the
  canonical semantic World experience promised by its Product North Star.
- **Reopen condition:** **only after Stage 5 — Public World Product Integration is fully `DONE / MERGED`**, and before the
  execution sequence proceeds past this owned correction unless the Product Owner explicitly changes sequencing.
- **Required future properties:** one Living Analysis renderer family across Personal / Shared / Public; exact-World
  semantic geography; no Personal camera / focus / timeline leakage; Shared viewer state remains independent; the World
  grows from Shared-native truth over time; no invented cross-World coordinate alignment; existing Shared authority and
  privacy laws remain unchanged; targeted non-regression proof for the already-merged Stage-4 journeys.
- **Status:** `DEFERRED — OWNED`

Admitted by explicit Product Owner decision on 2026-10-07. This admission records sequencing and ownership only; it does
not reopen Stage 4 now and does not authorize implementation before Public World is complete (BG-07).

**Current truth (SHARED-VIS-01, 2026-10-08):** Stage 5 is DONE / MERGED (PR #319, PR #320), and the owner task is **ACTIVE**
under the Product Owner's Decision Gate (Option A, D1–D7) on `feat/shared-vis-01-shared-living-analysis` — not merged, not
closed ([record](e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md)). This item stays
`DEFERRED — OWNED` until that task's closing change tombstones it (BG-08).

**Current-truth note (LA-VIS-01, 2026-10-07).** The accepted `LA-VIS-01` graphics land once in the shared Living Analysis stack
and serve Personal and Public. Shared World is still not integrated into that surface; when this item opens, Shared consumes
the same stack. This note changes none of this item's fields: `SHARED-VIS-01`, `HIGH`, `DEFERRED — OWNED`, and its
sequencing gate (only after Stage 5 is fully `DONE / MERGED`) is unchanged.

**Current truth (GOV-REC-01, 2026-10-12).** SHARED-VIS-01 merged through PR #321 as
`5973123153e26494d702a4a859a79631ede225cd` on 2026-10-09, but its closing change never landed, so this item stayed
`DEFERRED — OWNED` with no recorded disposition. GOV-REC-01 records that disposition retroactively under BG-08 / BG-09:
the item is `CLOSED — TOMBSTONE` (§6). The notes above are kept as written at their dates.

### `QAN-BL-CW-04` — Public Lightweight Reactions Runtime (PG-07)

- **Title / Finding:** the Public World has no reaction runtime. The previously approved Product direction allows
  lightweight Public reactions on Experiences and on individual replies; nothing in the frozen runtime (0091–0099) or in
  Stage 5 (0142–0147) implements one, and no reaction appears on any Public surface.
- **Source:** [I-08A4](canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md)
  §8 / §9 (the label «التفاعلات» / Reactions) and its preserved gap `PG-07 — Public Social Reaction Runtime` ("The Product must
  not pretend these gaps are implemented until they actually are"); the Public World Product Definition §20 (reactions not
  decided in detail); [E2E-01 gap matrix](e2e/QANDEEL_E2E01_GAP_MATRIX_v1.md) `E2E-H-06`; I-08N-01 D25 ("generic reactions"
  are usually Activity / Badge). Designated by the Product Owner in the S5-04 Decision Gate (D3, 2026-10-08), which also
  corrected the S5-04 First Report: the Product **direction** is decided (lightweight reactions on Experiences and on
  individual replies are allowed); what remains undecided is the exact reaction vocabulary / types, the UI, count
  visibility, any ranking effect and negative reactions.
- **Current truth:** not implemented anywhere; S5-04 implements no reaction, describes none as rejected or "out of v1",
  and shows no reaction count. `PG-07` had no representation in this register before, so it is admitted here exactly once.
- **Why deferred:** the Product Owner placed it outside S5-04; its open details (vocabulary, UI, count visibility, ranking
  effect, negative reactions) need their own Product decision before any runtime.
- **Owner task:** `PUBLIC-REACTIONS-01 — Public Lightweight Reactions Runtime`
- **Severity:** `MEDIUM` — the Public discussion, Activity and Direct Entry are complete without it; its absence removes an
  approved lightweight interaction, not a safety or privacy guarantee.
- **Reopen condition:** the Product Owner opens `PUBLIC-REACTIONS-01 — Public Lightweight Reactions Runtime` with the remaining details decided; Product-safe reactions then
  compose over the canonical Public visibility exactly as discussion does (disappearance darkens them; vitality never moves
  geography; any Activity follows I-08N-01 D25).
- **Status:** `DEFERRED — OWNED`

Admitted by S5-04 at the Product Owner's explicit D3 designation (2026-10-08). Admission authorizes no implementation (BG-07).

---

### `QAN-BL-CW-05` — QANDEEL Conversational Output Cannot Be a Shared Semantic-Place Source

- **Title / Finding:** a Shared semantic place (SHARED-VIS-01) is read only from the World's `HUMAN_TEXT`. QANDEEL's own
  conversational output (`QANDEEL_OUTPUT`) cannot be one of its sources: the frozen I-04G QANDEEL commit core, as 0119
  remediated it, records that output's additional human requirement as `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` (an
  `EXACT_HUMAN_APPROVER_SET` with no approver), and the same core's source-metadata check refuses exactly that shape as a
  `MATERIAL_DEPENDENCY` source (`SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE`), although 0119 also carries an
  unresolved-source arm that would propagate it. The Product Owner's D2 named "eligible human and QANDEEL contributions".
- **Source:** SHARED-VIS-01 Decision Gate D2 (2026-10-08);
  [SHARED-VIS-01 record](e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md) §3.1; migrations
  `0090` (the metadata check) and `0119` (QAN-CW-REM-01); proven by `database/verify-migration-0148.mjs`.
- **Current truth:** fail-closed, as frozen. A place never rests on QANDEEL's words; QANDEEL's replies stay historical
  discussion in the conversation; no unproven influence is recorded.
- **Why deferred:** admitting QANDEEL output as a source changes frozen I-04G authority semantics (controlled change), and
  whether a place may rest on QANDEEL's own words at all is a Product decision. The Product Owner deferred it to the Stage 8A
  authority / source review (2026-10-08).
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` (its authority / source review)
- **Severity:** `MEDIUM` — places are complete and truthful without it; it narrows what a place may be read from.
- **Reopen condition:** Stage 8A's authority / source review, with a Product Owner decision that QANDEEL's conversational
  output may ground a place, and a controlled change of the I-04G core that resolves the unresolved-source shape without
  weakening the fail-closed widening rules.
- **Status:** `DEFERRED — OWNED`

Admitted by SHARED-VIS-01 (2026-10-08); owned by Stage 8A at the Product Owner's deferral (2026-10-08). Admission authorizes no
implementation (BG-07).

---

### `QAN-BL-CW-06` — The Ended Shared World Has No Read-Only Living Analysis View

- **Title / Finding:** an ACTIVE Shared World opens on its Living Analysis field (SHARED-VIS-01); an ended World is still the
  S4-03 read-only conversation (its read now excludes semantic places), with no read-only semantic geography.
- **Source:** CW2-07 §22 (`READ_ONLY_HISTORICAL_VIEW`, bounded by the closed-view entitlement and later deletions);
  Shared World Product Definition §20 (an ended World stays viewable as history); the
  [SHARED-VIS-01 record](e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md) §8.
- **Current truth:** the 0148 member reads serve CURRENT members of ACTIVE Worlds only; an ended World serves no place.
- **Why deferred:** outside the SHARED-VIS-01 Decision Gate; a closed-view field needs the closed-view entitlement applied to
  places and a Product decision on what an ended World's geography shows. Deferred by the Product Owner (2026-10-08): the
  existing historical reading stays unchanged. No owner task is named, so it stays unassigned (BG-02).
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a Product Owner decision on the ended World's read-only semantic view.
- **Status:** `OPEN — UNASSIGNED`

Admitted by SHARED-VIS-01 (2026-10-08). Admission authorizes no implementation (BG-07).

---

### `QAN-BL-CW-07` — Shared World Temporal Navigation

- **Title / Finding:** the Shared World has no Timeline or temporal navigation. SHARED-VIS-01 keeps durable chronology and
  stable geography and composes the surface `CHROME_ONLY` (no temporal track); CW2-07 §6 defines FOLLOW_LIVE / PINNED(t) /
  Exact Return for MY_WORLD only.
- **Source:** SHARED-VIS-01 Decision Gate D5 (2026-10-08: "Future Shared temporal navigation remains a separate Product
  decision"); Shared World Product Definition §8 ("Timeline يحترم الحقيقة الزمنية"); CW2-07 §6, §45.
- **Current truth:** no Shared temporal UI; no Personal Timeline semantics are borrowed.
- **Why deferred:** by the Product Owner's D5; the Shared time rules (membership episodes, FROM_JOIN_FORWARD, grants) are
  undecided as navigation. Deferred by the Product Owner (2026-10-08) pending a dedicated Product decision. No owner task is
  named, so it stays unassigned (BG-02).
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a Product decision defining Shared temporal navigation.
- **Status:** `OPEN — UNASSIGNED`

Admitted by SHARED-VIS-01 at the Product Owner's D5 (2026-10-08). Admission authorizes no implementation (BG-07).

### `QAN-BL-MATCH-01` — Matching Setup Enrollment, Correction and Resume Suspended Before Launch (SEC-MATCH-00)

> **Historical pre-closure schema.** This block records the item as it stood before S6-07's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-MATCH-01` in §6 (S6-07 CP4).

- **Title / Finding:** migration `0149` (SEC-MATCH-00) withdraws direct `EXECUTE` from every application role on six
  `0109` Matching setup boundaries: `activate_matching_participation_v1`, `resume_matching_participation_v1`,
  `grant_matching_context_v1`, `set_introduction_profile_v1`, `set_matching_requirements_v1` and
  `grant_pre_match_disclosure_authority_v1`. Until a reviewed launch path exists, nobody can newly enroll in Matching,
  resume a pause, correct an Introduction Profile or requirement set, or grant or reconfirm either authority. Pause,
  turn off, both revocations and self-inspection stay available to every existing human.
- **Source:** [SEC-MATCH-00 implementation record](e2e/QANDEEL_SEC_MATCH_00_MATCHING_DIRECT_RPC_PROTECTION_IMPLEMENTATION_RECORD_v1.md)
  §5 and §8, and [Matching / Introduction Runtime §47](matching-introduction-runtime-v1.md). These record the Product
  Owner's decision `APPROVE_C2_PATCH_B` (2026-10-09): corrections and resume are suspended before launch, and C2
  invents no correction or enrollment wrapper.
- **Current truth:** the six are executable only by their owner. The I-07A bodies, the lock order and the authority
  independence are unchanged. No API route or mobile surface calls any Matching setup command.
- **Why deferred:** Matching is not launched and the `CW2-08` launch gates are closed. Reopening enrollment needs a
  reviewed, launch-gated, owner-authorized path. That path must not commit a deletion-blocking footprint for an
  account that has not truly enrolled (`QAN-BL-ACCT-01`). This is Stage 6 Product work, not a security hot-fix.
- **Owner task:** `S6-07 — Activity, Direct Entry and Final Integration`. Re-owned from `S6-01 — Intelligent Matching
  Onboarding` by S6-01's closing change (2026-10-14; effective from its merge), at the Product Owner's D1.
- **Dependency:** account-deletion integrity, the separately governed `ACCT-DEL-01` correction path of `QAN-BL-ACCT-01`
  (Stage 6 WP0 final decision addendum, D3). It is mandatory: no enrollment path, `CA-01` amendment or `CA-10` opens
  before it is resolved. The dependency is recorded here only; `QAN-BL-ACCT-01` keeps every field.
- **Severity:** `HIGH`. Matching cannot launch to users while enrollment and correction are closed. Reopening them
  carelessly would bring back the deletion-blocking exposure SEC-MATCH-00 closed.
- **Reopen condition:** automatic at S6-07's kickoff (BG-05), or when any task takes Matching toward users. Neither
  reopens the six commands before `ACCT-DEL-01` is resolved. *(Until S6-01's closing change: "automatic when S6-01 resumes, or when any task takes Matching toward
  users.")*
- **Required future property:** no application role regains direct `EXECUTE` on the six through a plain grant, a
  default privilege, a re-created function or a client-executable wrapper. Any reopening runs behind a reviewed,
  fail-closed, server-canonical launch path that the Product Owner approves. The deployment rule stays: `0108` /
  `0109` never reach live signed-in users without `0149` in the same controlled window.
- **Dated note (S6-03 closing change, 2026-10-15; effective from its merge):** [CW2-06B](canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06B_CONFIRMED_FACTS_ELIGIBILITY_NEUTRAL_PRESENTATION_REPROPOSAL_CONTROLLED_AMENDMENT_v1.0.md) fixes the interface this
  item wraps. Promotion writes confirmed facts only through the one internal writer
  `record_matching_confirmed_facts_core_v1` (`0156`; executable by no role, wrapped by nothing in S6-03), and writes
  requirement items in the CW2-06B-03 encoding v1. That writer is not evidence of consent (R5). Before any production
  caller of it exists, this item must add the explicit `auth.uid()`-derived human act, a durable promotion record bound
  to the exact fact version and the exact confirmed draft version, and that evidence as a precondition of the facts
  reader; and it owns `CA-10` (`NONE_ADDITIONAL` against `0109`'s non-empty requirement set) and post-enrollment
  correction, under NO_BACKDOOR and with the `ACCT-DEL-01` dependency. Owner, severity and status unchanged ([S6-03 record](e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md) §9).
- **Dated note (ACCT-DEL-01 closing change, 2026-10-17; PR #345, not merged; effective from its merge):** the
  `ACCT-DEL-01` dependency is **met in engineering**. `0164` erases an account's whole Matching / Introductions footprint
  together with its Personal erasure, in one transaction or nothing, with the counterparts' continuity; an account that
  also has a Shared `STANDARD`, Public or Replay footprint gets a truthful, recorded `BLOCKED` and nothing is erased. So an
  enrollment path would no longer commit a footprint that has no governed deletion
  ([ACCT-DEL-01 record](e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md) §8).
  - **What it does not do:** it reopens none of the six commands. They stay executable by no application role until
    `S6-07`'s own Task Contract and the Product Owner approve the launch path (`NO_BACKDOOR`, the required future
    property above). It opens no launch gate; `CW2-08` stays closed and nothing is deployed.
  - **What `S6-07` carries from it:** every new relation that references the account, or a Matching / Introductions
    relation, is registered in `account_erasure_private.coverage_registry` and erased by the module in the same change.
    CI refuses an unregistered one (`verify-migration-0164` A04 and the ACCT-DEL-01 static contract).
  - **What still blocks:** the residue that stays open (`QAN-BL-ACCT-01` for Shared `STANDARD` / Public, and
    `QAN-BL-ACCT-02` for Replay) does not reinstate this dependency. It does block the production opening of those worlds
    (`QAN-BL-PROD-09`).

  Owner, severity and status unchanged.
- **Status:** `DEFERRED — OWNED`

**S6-01 note (2026-10-13).** The reopen condition fired: the Product Owner's S6-01 Final Implementation Authorization
started S6-01. Its D1 keeps the six commands closed in S6-01: no wrapper, grant or re-created function, and
`NO_BACKDOOR` unchanged. S6-01 builds an erasable pre-enrollment preparation draft outside the I-07 relations instead
([CW2-06A](canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06A_MATCHING_ONBOARDING_PREPARATION_ASSISTANCE_CONTROLLED_AMENDMENT_v1.0.md)).
The secure enrollment path, any `CA-01` amendment and `CA-10` wait for account-deletion integrity (`ACCT-DEL-01`). At
S6-01's closing change this item is re-owned to `S6-07 — Activity, Direct Entry and Final Integration` with that
dependency; it is not tombstoned. Until then, its fields are unchanged.

**S6-01 closing note (2026-10-14; the S6-01 pull request, not merged).** Done as planned. S6-01 delivered the
pre-enrollment preparation (migration `0154`) and kept the six commands closed: no wrapper, grant, re-created function
or later migration names any of them, `verify-migration-0149` and `0150` pass unchanged, and no enrollment happens
([S6-01 record](e2e/QANDEEL_S6_01_INTELLIGENT_MATCHING_ONBOARDING_IMPLEMENTATION_RECORD_v1.md) §10). The obligation is
therefore not discharged: the owner is now `S6-07`, with the `ACCT-DEL-01` dependency above. Severity and status are
unchanged.

**S6-07 CP1 note (2026-10-18; the S6-07 pull request, not merged).** The Product Owner approved the S6-07 CP0 design and
its Controlled Amendments (CA-01-impl, CA-R5-impl, CA-08-impl, CA-10-impl, CA-GATE) and started CP1. Migration `0165`
delivers the reviewed launch path this item asked for: ONE named `authenticated` boundary,
`enroll_my_matching_setup_v1`, the human from `auth.uid()`, that promotes the owner's own reviewed draft and calls five of
the six with their frozen bodies under a closed-by-default operator gate (no gate row, no consent text: nothing can be
enrolled in production). The required future property holds as amended: no plain grant, no re-created command, no
`service_role` path, and no wrapper other than that one named, gated, `auth.uid()`-derived boundary (`verify-migration-0149`
`NO_BACKDOOR` and probes f14 – f17; the SEC-MATCH-00 static contract). Correction and resume run through the same boundary.
*(CP1 correction, 2026-10-18:)* under the Product Owner's D-CP1-1 = B, enrollment requires no optional profile field: a
third core executable by no role (`set_empty_introduction_profile_core_v1`, CA-D-CP1-1-impl) writes a real zero-field
profile version, reached only through the same boundary; the required future property is unchanged (`verify-migration-0149`
f17 probes all three cores). The item is **not** tombstoned at CP1: it is dispositioned at S6-07's closing change, under
BG-08, with the rest of the task ([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md), [I-07 runtime §50](matching-introduction-runtime-v1.md)).
Owner, severity and status unchanged.

**S6-07 CP3 note (2026-10-18; the S6-07 pull request, not merged).** After the Product Owner closed the CP3 Product Copy
Gate, the enrollment step and the three independent consents (each withdrawn on its own, through its own retained `0109`
command) are drawn in «التعارف مع قنديل» on the approved words, and the approved consent texts (version 1) are installed only
by a loopback-only operator installer that never touches a gate; no migration installs them, so nothing can be enrolled in
production. Opening `ENROLLMENT` and installing the texts on the hosted environment stay unauthorized. The item stays open
until S6-07's closing change (CP4).

Admitted by SEC-MATCH-00 under BG-08 / BG-06: it is a canonical record's explicit deferral to a named future task. The
entry chooses no launch mechanism, wrapper or gate. Nothing here authorizes implementation (BG-07).

---

### `QAN-BL-PROD-06` — Data API Unbounded `40001` Retry on PostgREST Before v16 (Core Conversation, Hypothesis, Shared Standing Context, Matching, Shared ID Rotation)

- **Title / Finding:** PostgREST before `v16.0` runs every request through `hasql-transaction`, which re-runs the whole
  transaction without any bound when it fails with `40001` (`serialization_failure`), and from `hasql-transaction` 1.1
  also with `40P01`. PostgREST `v16.0` stopped this (PostgREST #3673). Several QANDEEL functions answer a stale
  expectation with a **deterministic** `40001` by design, so through such a PostgREST one such request is never
  answered, and it keeps a pool connection re-running the transaction. QANDEEL's API reaches every function through the
  Data API (`rest/v1/rpc/...`, 5 s client timeout), so the hazard is **not Matching only**:
  - **Core conversation:** `commit_finalized_exchange_with_full_semantic_chain_v1` (`0071`) and
    `get_conversation_thread_identity_dossier_page_v1` (`0070`), service role, inside the API's normal turn flow. A
    designed stale outcome becomes a 5 s API failure instead of the handled stale state.
  - **Hypothesis:** `transition_hypothesis_v2` (`0036`) and `apply_hypothesis_evidence_update`, callable by a signed-in
    account that owns a hypothesis, which can send a stale version on purpose; and, through the service role,
    `background_apply_hypothesis_evidence_update_v1`, `persist_post_response_hypothesis_generation_v1` and
    `execute_post_response_hypothesis_update_batch_v1`.
  - **Shared Standing Context:** the `0078` grant / revoke commands.
  - **Matching:** the four `0109` commands `0149` retains (pause, turn off, both revocations).
- **Source:** [SEC-MATCH-00 implementation record](e2e/QANDEEL_SEC_MATCH_00_MATCHING_DIRECT_RPC_PROTECTION_IMPLEMENTATION_RECORD_v1.md)
  §9, §11.6 (blocking deployment condition) and §12; the
  [40001 retry risk report](e2e/QANDEEL_SEC_MATCH_00_40001_RETRY_HAZARD_RISK_REPORT_v1.md), which the Product Owner
  requested; and the Product Owner's designation at the SEC-MATCH-00 governance review (2026-10-10). Observed in API CI
  run `37971820700` (`d8afff6`): a request answered with a deterministic `40001` went unanswered for 300 s on `v12.2.9`.
- **Current truth:** the hosted project's PostgREST version is **unverified**. Supabase has publicly announced a move
  to PostgREST v14 and no move to v16; neither fact is evidence about the project itself. C1 (metadata only) puts the
  hosted schema at `0074`, so the core-conversation and Hypothesis entry points are probably present there, and the
  Shared Standing Context and Matching ones are not. Whether the API serves real traffic there is unknown. PR #323's
  CI is green on `v12.2.9`, `v13.0.8`, `v14.18` and `v16.4`, but its proofs deliberately send no deterministic `40001`,
  so CI is **not** evidence that this hazard is handled.
- **Why deferred:** closing it is either an infrastructure fact on the hosted project or a cross-domain forward
  migration that amends frozen refusal contracts (conversation focus and thread, Hypothesis, Shared Standing Context,
  I-07A). Neither is SEC-MATCH-00's scope, which protects Matching before launch and rebuilds no I-07A contract.
  *After PROD-RETRY-01:* the forward migration exists in the repository; what remains is a hosted deployment and evidence
  read on the hosted project itself, which need the Product Owner's separate approval and a hosted connection that
  PROD-RETRY-01 was not authorized to make.
- **Owner task:** `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate`. Re-owned from `PROD-RETRY-01 — Data API 40001 Retry Hazard Closure` by its closing change
  (2026-10-10), at the Product Owner's direction. It is the hosted catch-up deployment that brings the hosted database
  from `0074` forward; it opens only through its own Task Contract and the Product Owner's explicit deployment approval.
- **Severity:** `HIGH`. A signed-in user, or an ordinary concurrent turn, can make a Data API request that never
  completes and holds a pool connection, and the API's designed stale-state handling never runs. At the Product Owner's
  direction this is a **launch and deployment gate**, not a schedule (§2): see the required future property.
- **Reopen condition:** automatic, and in any case before the first of: a deployment that exposes any affected function
  through the hosted Data API (including the `0075`+ catch-up, and every deployment that reaches `0109`); exposing the
  hosted API to real signed-in users; or Matching / Shared World launch.
- **Required future property:** no affected function is reachable through a Data API whose PostgREST re-runs a `40001`
  transaction. One of these must hold first, and the choice is the Product Owner's:
  - **(a)** the hosted project runs PostgREST `v16.0` or later, verified on the project itself and never inferred from
    an upstream release or a changelog; or
  - **(b)** a separately approved forward migration answers each stale-state refusal with a SQLSTATE PostgREST never
    re-runs (`PT409` is the report's recommendation). It must keep the compare-and-swap, the refusal to write over a
    stale state and every semantic message, change no privilege and no user data, and carry the API's stale-state
    recognition with it.

  Moving these commands off the Data API is rejected for now. A green CI run is not closure evidence. The hazard must
  never be reproduced on the hosted environment. If `S6-01` restores the six suspended Matching commands
  (`QAN-BL-MATCH-01`), they carry the same rule.
- **Scope, amended by PROD-RETRY-01 (C0 / C1 / C2, 2026-10-10):** a cross-schema census (`public` and every `*_private`
  schema) finds 24 Data API entry points that reach a `40001` raise: 12 **deterministic** (the list above, plus
  `rotate_own_sealed_shared_id_v1` through `rotate_shared_world_invite_credential_v1` (`0081`) - a double-tap or a
  two-device Shared ID regeneration), 2 race-converging, 2 guarded and 8 absorbing. Corrections to the list above:
  `persist_post_response_hypothesis_generation_v1` cannot reach its stale raise (it activates only rows created in the same
  transaction), and `execute_post_response_hypothesis_update_batch_v1` absorbs it into a durable `UPDATES_REJECTED` -
  but its catcher is on the change path, so option (b) must extend it.
- **Repository resolution (PROD-RETRY-01 C2; implemented, pending the Product Owner's merge decision):** option **(b)**.
  Migration `0150` answers the 23 deterministic stale-state sites of the 11 raising bodies with `PT409` and extends the
  batch catcher to accept it; compare-and-swap, every message, privilege and row are unchanged, and the API recognises
  both codes. The cross-schema guard of `verify-migration-0150.mjs` proves no Data API entry point lets a deterministic
  `40001` escape, and the live wire proof answers every stale request at once on `v12.2.9`, `v13.0.8`, `v14.18` and
  `v16.4` ([implementation record](e2e/QANDEEL_PROD_RETRY_01_DATA_API_STALE_STATE_IMPLEMENTATION_RECORD_v1.md)). The
  hosted condition stays: the hosted project is at `0074`, its PostgREST version is unverified, and `0150` reaches it
  only in the `0075`+ catch-up (deployment rule in `database/README.md`, migration `0150` section).
- **Closing reconciliation (PROD-RETRY-01, 2026-10-10; Product Owner direction):**
  - **Repository: complete.** `0150` and the API change passed every required gate on the exact reviewed head
    `3a780baf0069e3464511e7bd6312d59006a11ac1` (PR #324): API CI `38019937801` and Mobile CI `38019937819` green;
    `verify-migration-0150` 28 / 28; the live PostgREST wire proof on `v12.2.9`, `v13.0.8`, `v14.18` and `v16.4`
    answers every deterministic stale refusal with HTTP 409 `PT409`, executed exactly once, with nothing written.
  - **Hosted: not closed.** `0150` is not deployed. The hosted database was at `0074` at the last approved metadata
    check, and its PostgREST version is unverified. The hazard therefore stands on the hosted project until the
    required future property holds there.
  - **Disposition.** The item is re-owned to `HOSTED-DEPLOY-01`, not tombstoned. It keeps `HIGH`,
    `DEFERRED — OWNED`, its reopen condition and its required future property, unchanged. Merging PR #324 changes none
    of this.
- **Closure condition:** `HOSTED-DEPLOY-01`'s closing change tombstones this item only by citing read-only evidence
  taken from the hosted project itself, never inferred from this repository, a CI run, an upstream release or a
  changelog. The evidence must show that one of these held before any affected function was exposed:
  - **(b), as delivered:** the hosted database carries `0150`. Its migration history records it, it applied under its
    own self-check, and the twelve bodies answer `PT409`. It arrived in the `0075`+ catch-up under the
    `database/README.md` deployment rule, with an API that accepts both codes deployed first or together.
  - **(a):** the hosted PostgREST is `v16.0` or later, verified on the project itself. `QAN-BL-PROD-07`'s reopen
    condition then fires.

  A retry-loop reproduction on the hosted environment is never evidence, and none may be attempted.
- **Dated note (ACCT-DEL-01 closing change, 2026-10-17; PR #345, not merged; effective from its merge):** `0164` adds
  four Data API entry points: `server_erase_account_v1`, `server_rearm_blocked_account_deletions_v1`,
  `server_read_account_erasure_operations_v1` and `server_read_account_erasure_coverage_v1`, all `service_role` only. The
  cross-schema guard of `verify-migration-0150` passes with `0164` applied, so none of them lets a deterministic `40001`
  escape. The coordinator answers lock contention with a recorded `RETRY` and a bounded backoff. Nothing in this item
  changes. The erasure's hosted timing (the `service_role` `statement_timeout`, the unindexed account columns) is
  `QAN-BL-PROD-09`'s.
- **Status:** `DEFERRED — OWNED`

Admitted by SEC-MATCH-00 under BG-08 / BG-06: Architecture and the Product Owner explicitly designated it at the
SEC-MATCH-00 governance review, and the record defers it to a named future task. It chooses neither (a) nor (b), and
nothing here authorizes implementation, an upgrade or a migration (BG-07).

---

### `QAN-BL-PROD-07` — Post-v16 PostgREST: Race-Converging `40001` Paths and Genuine Deadlocks Lose the Server-Side Re-run

- **Title / Finding:** PROD-RETRY-01 deliberately keeps `40001` where PostgREST's server-side re-run is the CORRECT
  answer before v16: the first-creation race of `ensure_public_identity_v1` (through
  `start_own_public_experience_draft_v1` and `post_own_public_discussion_v1`), whose re-run answers `ALREADY_PRESENT`, and a
  genuine deadlock (`40P01`, never raised by any function), whose re-run usually succeeds. PostgREST v16+ no longer
  re-runs either: the race loser and a deadlock victim then receive HTTP 500, and the API has no bounded retry for them.
- **Source:** [PROD-RETRY-01 C1 design](e2e/QANDEEL_PROD_RETRY_01_C1_DESIGN_v1.md) D7 (§4.4, §4.5, §11), accepted by
  the Product Owner at the C1 gate (2026-10-10) as a `LOW` deferred item that does not block launch.
- **Anti-duplication:** `QAN-BL-PROD-06` is the deterministic hazard on lines BEFORE v16 and is resolved in the
  repository by `0150`; no item covers the behavior of the race-converging and deadlock paths AFTER a move to v16.
  `QAN-BL-PROD-01` … `05` and `QAN-BL-LAUNCH-*` name neither.
- **Why deferred:** no QANDEEL environment is verified on PostgREST v16+, the race is a rare concurrent first identity
  creation, and lock-order discipline keeps deadlocks rare; the API may not retry a request it does not know to be
  idempotent, so the answer is a bounded, idempotency-aware retry design, not a code swap.
- **Owner task:** `PROD-RETRY-02 — Post-v16 Data API Retry Semantics`
- **Severity:** `LOW`. Not a launch gate.
- **Reopen condition:** before any QANDEEL environment (hosted included) is moved to PostgREST v16+, or when a
  race-converging path or a deadlock is observed failing a request.
- **Required future property:** on PostgREST v16+, a race-converging `40001` and a genuine `40P01` are retried a
  bounded number of times by the server channel that issued them, only where the request is idempotent, or are answered
  with a typed retryable outcome; nothing here weakens the `PT409` stale-state contract of `0150`.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-PROD-08` — Introduction Photo Object Store: Hosted Supabase Storage Provisioning and Live Conformance

- **Title / Finding:** S6-06 (D-01) stores Introduction photos in a private S3-protocol object store through one adapter
  (`apps/api/src/introductions-disclosure/introduction-media.store.ts`): Supabase Storage's S3 endpoint when hosted. CI
  proves the adapter, the database boundary and the erasure worker against `rclone serve s3` (`prove-0162`), which is a
  real S3 server but not Supabase. Nothing provisions the hosted bucket, holds its S3 keys or proves Supabase's own
  behaviour (Put / Get / Head / Delete / ListObjectsV2, deletion with no versioning, refusal of unsigned and
  session-token requests with no `storage.objects` policy).
- **Source:** [S6-06 implementation record](e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md) §1 (D-01, approved
  2026-10-16) and §5.
- **Anti-duplication:** `QAN-BL-PROD-06` is the Data API retry gate of the same deployment task and names no object
  store; no other item mentions media storage. `QAN-BL-LAUNCH-03` is the Shared ID sealing key, not storage credentials.
- **Why deferred:** S6-06 deploys nothing; enabling the S3 connection, creating the private bucket, generating its keys
  and placing them in the API's secret store are hosted deployment steps that need the Product Owner's separate approval.
- **Owner task:** `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate`.
- **Severity:** `HIGH`. Until it closes, the photo routes answer `UNAVAILABLE` on a hosted API (the adapter refuses an
  unconfigured or non-TLS endpoint), and CW2-08 keeps photos closed in any case.
- **Reopen condition:** automatic before the first hosted deployment that reaches `0162`, or before photos are offered to
  any real user.
- **Required future property:** a private bucket with no public access and no `storage.objects` policy; the S3 keys only
  in the API's secret store; `prove-0162`'s storage scenarios (P02 – P08) run against the hosted S3 endpoint with the
  evidence read on the hosted project itself; a deleted object proven absent by HEAD and by the provider's own object
  listing; nothing of QANDEEL's records changed.
- **Dated note (ACCT-DEL-01 closing change, 2026-10-17; PR #345, not merged; effective from its merge):** the governed
  account erasure (`0164`) queues every photo storage key of the erased account to the `0162` erasure queue, and tracks
  them for the request in `account_erasure_private.media_pending`. It sets `media_erased_at` only when the `0162` worker has
  deleted the last of them (DELETE, then HEAD 404). On a hosted API that second level depends on this item's object store:
  until it closes, the queue holds and `media_erased_at` stays empty, and the `ACCOUNT_ERASURE` telemetry reports it.
  `prove-0162` against the hosted endpoint covers the erasure's keys as well; nothing else is added to this item.
- **Status:** `DEFERRED — OWNED`

---

### `QAN-BL-QIR-01` — General Question Bind-Time Version and Lifecycle Recheck (R3-G)

- **Title / Finding:** migration `0151` closes the PG-02 withdrawal/correction race, but general `finalize_conversation_turn_v2` binding lacks an exact-version / questioning-eligible-lifecycle recheck for OTHER concurrent changes between SELECTED and BOUND. The later non-current status of a BOUND row does not prove no stale question was delivered.
- **Source:** INTEL-TM-01 implementation record §9, residue R3-G, and migration `0063`'s question binding / finalize v2.
- **Anti-duplication:** `QAN-BL-INTEL-01` covers evidence reliance after withdraw/correct; `QAN-BL-INTEL-02` covers durable ledger retention; `QAN-BL-CTX-01` covers conversational relevance. No indexed item owns general question bind-time version/lifecycle validity.
- **Why deferred:** separate from the approved PG-02 Controlled Changes. No general version/lifecycle semantics or historical SQL is changed in INTEL-TM-01.
- **Owner task:** `QIR-006-R1 — Formal Question Bind-Time Version & Lifecycle Recheck`.
- **Severity:** `MEDIUM`.
- **Reopen condition:** a QIR-006 finalization change, a claim that general bound questions are valid at commit, or a Stage 8A formal Question quality gate that relies on that property.
- **Required future property:** define and prove commit-point correctness for other version/lifecycle races with two-connection tests while preserving selection history, atomicity, idempotency and PG-02 safety. A future Product-approved Task Contract is required for any code.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-INTEL-02` — Post-Response Intelligence Ledger Content (`0029` Intent Span, `0033` Candidate Plan): Retention and Reuse After Forget / Do-Not-Rely

- **Title / Finding:** `public.post_response_intelligence_effects.result_payload` durably keeps user-derived text. The
  `INTENT_PROVIDER` effect stores `problem.text`, an extractive span of the user's own current turn (migration `0029`,
  durable intent provider result). The `CANDIDATE_PROVIDER` effect stores the validated candidate plan, whose statements
  are derived from the user's turn (migration `0033`). The CI-01 C1-B harness measured both on synthetic accounts (2 + 2
  rows on `main` `6a5fa42`). What is established at that baseline:
  - **stored by design and access-restricted.** The table has RLS enabled and is revoked from `anon` and `authenticated`
    (`0022`); only `service_role` reaches it, through `list_post_response_intelligence_effects_v1(execution_id)`.
  - **not telemetry and not the AI usage ledger.** It is not `AI-COST-01`'s `ai_provider_calls` and not an operational
    signal. C1-B measured 0 content hits in 2 596 telemetry records, 0 in the outbox and 0 in the executions table.
  - **currently read only to recover its own execution.** In `apps/api/src` at the baseline, the payload is read only by
    the dispatcher's durable-result readers (`durable-intent-provider-result.ts`, `durable-generation-result.ts`) for the
    same execution of the same source turn. No cross-turn, cross-session, export, evaluation or training reader was found.
  - **erased with the account, not with a forget.** The governed Personal erasure (`0130`) deletes every effect and
    execution of the user. The `0128` forget / do-not-rely commands do not touch this table. The Personal export (`0130`)
    does not include it.

  No violation is established. Stored text is state (a) "technically stored" under the D4 distinction, not proof of a
  current unauthorized use. What is **not decided** is whether these spans and derived statements may stay, or be read
  again, after the user forgets or stops relying on a Memory derived from the same turn, and under which provenance,
  retention and deletion rules.
- **Source:** the [CI-01 C1 Task Contract](e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) §8.2 and §16; the
  [Intelligence Evidence Baseline v1](intelligence-evidence-baseline-v1.md) §5.3 and §6; the C1-B results
  `scripts/ci-01/results/6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24.json` (`controls.durableLedgerContent`). Admitted at the
  Product Owner's C1 closing decision 2 (2026-10-10).
- **Anti-duplication:** `QAN-BL-INTEL-01` owns the re-evaluation of derived hypotheses, Confidence and Understanding after
  evidence loss; its phased scope leaves export and erasure paths unchanged and does not cover ledger copies.
  `QAN-BL-PRIV-01` / `02` are export completeness of named facts. `QAN-BL-ACCT-01` is Connected Worlds account deletion.
  `AI-COST-01` holds no content. No item covers the retention of post-response ledger content.
- **Why deferred:** CI-01 changes no runtime and no migration. A rule here needs a Product decision on provenance,
  retention and deletion of derived copies (D4: CI-01 invents no unified deletion rule).
- **Owner task:** `INTEL-RET-01 — Post-Response Intelligence Ledger Retention & Provenance Review`. The owner name was
  CI-01's proposal at the Product Owner's request and is PO-APPROVED (2026-10-10, PR #325 authorization). No ownership of
  any existing item moves.
- **Severity:** `HIGH` — if reopened, it touches the user's frozen authority over forget / do-not-rely.
- **Reopen condition:** any of:
  1. a code path reads an `INTENT_PROVIDER` or `CANDIDATE_PROVIDER` `result_payload` other than to recover its own
     execution: cross-turn, cross-session, export, evaluation, analytics or training;
  2. a Product surface or record claims that forgetting a Memory, or deleting a turn, removes every derived copy;
  3. `INTEL-TM-01` opens, or a turn-level deletion feature is designed;
  4. Stage 8A binds a real intent or candidate provider, so the stored spans become real-model output.
- **Required future property:** a forgotten or disabled source is never re-served through a ledger copy; any retention
  beyond the recovery of its own execution is decided explicitly, with provenance; nothing here weakens forget.
- **Triggered check (INTEL-TM-01, 2026-10-10):** reopen condition 3 fired when `INTEL-TM-01` opened. It is discharged by
  check, not absorbed: INTEL-TM-01 reads and writes no `0029` / `0033` `result_payload`, and it claims nothing for a
  Hypothesis without an evidence link (its record §7, limit L-1). Whether a withheld Hypothesis's candidate-plan text may
  stay in that ledger remains this item's question. Unchanged: `VALIDATION — OPEN`, owner `INTEL-RET-01`.
- **Status:** `VALIDATION — OPEN`

This entry decides no retention period and no deletion mechanism, and authorizes no change to `0029`, `0033` or `0130`
(BG-07).

---

### `QAN-BL-INTEL-03` — Hypothesis Semantic Support: Legacy Never-Supported Hypotheses (R-G1a) and Support by Unrelated Eligible Evidence (R-G1b)

- **Title / Finding:** MEM-AR-01C closed the creation path of unsupported generated Hypotheses (CC-H1: TypeScript
  `NO_SUPPORTING_EVIDENCE`; SQL `22023 CANDIDATE_WITHOUT_SUPPORT` in the `0033` completion, migration `0152`) and made
  personal Evidence SELF-only (CC-M1). Two residuals remain that no deterministic check inside MEM-AR-01 can close:
  **R-G1a** — Hypotheses created before `0152` that never had a supporting link stay `ACTIVE` with reliance `NONE` (shown
  as "needs more", passed to the model as provisional); **R-G1b** — a generated candidate may cite eligible SELF Evidence
  that is semantically unrelated to its statement, and it is accepted.
- **Source:** MEM-AR-01 WP0R Addendum A2 §G1.4–§G1.5 (A-4, A-5) and §G4.1, approved by the Product Owner with RD-1
  Option B (CC-H1) and the residual ownership; the
  [MEM-AR-01 implementation record](e2e/QANDEEL_MEM_AR_01_MEMORY_CORRECTION_ARABIC_ACQUISITION_IMPLEMENTATION_RECORD_v1.md)
  01C §9; INTEL-TM-01 record §7 limit L-1, which CC-H1 narrows to legacy rows only. Migration `0151`'s header already
  names "a separately authorized semantic verifier" as the only path that may lift a withheld Hypothesis.
- **Anti-duplication:** `QAN-BL-INTEL-01` (PG-02, tombstoned) withholds reliance after a withdrawal and claims nothing for
  unlinked items; `QAN-BL-INTEL-02` is ledger retention (`INTEL-RET-01`) and is not reused (BG-04); `QAN-BL-QIR-01` is
  question bind-time validity; `QAN-BL-CTX-01` is conversational relevance. No item covers zero-support, third-party or
  semantic-support Hypotheses. Searched again at the 01C closing change: still none.
- **Why deferred:** judging whether Evidence semantically supports a statement needs a verifier the Product Owner kept out
  of MEM-AR-01 (no Understanding, Confidence, HIM or semantic-scorer redesign); retiring or rewriting legacy Hypotheses
  needs a new reliance value, an L3 redefinition or a status write, each a separate Controlled Change.
- **Owner task:** `INTEL-SV-01 — Hypothesis Semantic Support Verification`.
- **Severity:** `MEDIUM` — the consequence is a provisional statement voiced tentatively by the model or shown as "needs
  more"; never Clear, and never relied on after a withdrawal.
- **Reopen condition:** `INTEL-SV-01` is scheduled, **or** an authorized aggregate count shows more than zero `ACTIVE`
  never-supported Hypotheses in a hosted environment.
- **Required future property:** no automatic restoration of a withheld Hypothesis by re-confirmation, attachment or
  correction; any lifting or retirement is an explicit, auditable decision of the semantic verifier; the provider schema
  is not tightened to force citations (that would push R-G1b).
- **Status:** `DEFERRED — OWNED`

Admitted by MEM-AR-01C under BG-06 (Architecture-designated, Product Owner approved) in its closing change. Nothing here
authorizes implementation (BG-07).

### `QAN-BL-CI-02` — Forward-Safety Mirror: the `QAN-INF-03` Expo Dependency-Validation Leg Fails Intermittently on Some Local Hosts

- **Title / Finding:** On some local Windows runs, `test:forward-safety-contract` reports 25 / 35. All ten failures are the
  mirror's replay of one leg of `qan-inf-03-deterministic-expo-dependency-validation-contract`: the offline
  `expo install --check` / `expo-doctor` / `npm explain` check under `doctor:mobile`. On other local runs and in API CI the
  same gate passes 35 / 35, and the contract passes 6 / 6 when run directly on the real tree. CI-01 observed both results
  on the same host on 2026-10-10, with no change to `apps/mobile`, `node_modules` or that contract between them: 25 / 35 at
  C1-A, then 35 / 35 at C1-B. Both results are kept. The later pass does not identify or fix the cause.
- **Source:** the S5-04 record (finding F11, forward-safety 25 / 35); the SEC-MATCH-00 record (forward-safety 25 / 35); the
  PROD-RETRY-01 record (10 / 35 failing locally, CI 35 / 35); the
  [CI-01 C1 Task Contract](e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) §8.1, §8.2 and §13. Admitted at the Product
  Owner's C1 closing decision 3 (2026-10-10).
- **Anti-duplication:** `QAN-INF-03` is a completed infrastructure contract with no backlog item and no active owner.
  `QAN-BL-CI-01` is iOS Maestro / XCTest startup in Mobile CI. No item covers the local mirror replay.
- **Why deferred:** no hosted CI run has failed on it, and the contract under replay passes on the real tree. It is a
  validation-reliability question in mobile tooling, outside CI-01's census. CI-01 does not touch `apps/mobile`, Expo
  Doctor or the `QAN-INF-03` contract.
- **Owner task:** `QAN-INF-06 — Forward-Safety Mirror Expo Validation Determinism`. The owner name was CI-01's proposal
  and is PO-APPROVED (2026-10-10, PR #325 authorization).
- **Severity:** `MEDIUM` — if reopened, a gate could report a failure unrelated to the change under review, or hide one.
- **Reopen condition:** any of:
  1. the leg fails in hosted API CI on any head;
  2. it is reproduced on a clean checkout after `npm ci` on a stated host, so the cause can be identified;
  3. a merge decision would have to rely on a local forward-safety result.
- **Required future property:** the mirror's replay of `QAN-INF-03` gives the same verdict as the contract on the real
  tree, or the gate states the host conditions it requires.
- **Status:** `VALIDATION — OPEN`

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

### `QAN-BL-PRIV-03` — Export My Data Omits Whom Each Memory Is About (the Subject `about` Field)

- **Title / Finding:** MEM-AR-01C (migration `0152`) records whom each Memory is about — SELF, OTHER, or not established
  — and serves it to the model as `about` (`USER` / `SOMEONE_ELSE` / `NOT_RECORDED`). The Personal export
  (`personal_data_private.build_personal_export_v1`, migration `0130`) lists every Memory with its words, kind and state,
  but not whom it is about.
- **Source:** MEM-AR-01 WP0R §3.3 and §9 (the export `about` field proposed for this ID), Task Contract §2.3 exclusions and
  §13.3; CQ-2 answered by the Product Owner (proposed, implementation deferred, admitted at the 01C closing change after
  anti-duplication); the [MEM-AR-01 implementation record](e2e/QANDEEL_MEM_AR_01_MEMORY_CORRECTION_ARABIC_ACQUISITION_IMPLEMENTATION_RECORD_v1.md) 01C §9.
- **Current truth:** nothing in the export is false: a Memory's own words name the person they concern. The attribution
  rows cascade with the Memory, so the governed erasure removes them with it.
- **Anti-duplication:** `QAN-BL-PRIV-01` (a later explicit agreement) and `QAN-BL-PRIV-02` (notification preferences) are
  other missing export facts of the same owner; `QAN-BL-ACCT-01` is Connected Worlds deletion. No item covers the
  Memory subject in the export.
- **Why deferred:** the export's content and shape are a Privacy & Data Product decision (the W3-MEGA-S export contract);
  adding a field from inside MEM-AR-01 would redefine the `0130` export body, which the contract excluded.
- **Owner task:** `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` — the owner of the export-completeness
  items `QAN-BL-PRIV-01` and `QAN-BL-PRIV-02`.
- **Severity:** `MEDIUM` — completeness of the reader's own exported data, not its truthfulness.
- **Reopen condition:** automatic when `PRIV-EXPORT-01` starts; it must also be reopened before Export My Data is declared
  complete for launch.
- **Required future properties:** export the subject as a readable fact in the reader's language (about you / about
  someone else / not recorded), never an internal basis code, command or execution id.
- **Status:** `DEFERRED — OWNED`

Admitted by MEM-AR-01C under BG-06 in its closing change (CQ-2). Nothing here authorizes implementation (BG-07).

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

### `QAN-BL-IP-01` — Personal Interaction Preferences Do Not Shape Public World QANDEEL Replies

- **Title / Finding:** IP-IMP-01 (migration `0153`) gives the owner ONE canonical record of durable interaction preferences
  (reply length, reply language / dialect, humour, explanation style), consumed by Personal-world replies only. A Public
  @qandeel reply is composed from Public material alone and never sees them.
- **Source:** the IP-IMP-01 R1 Task Contract (D-SP Option A, approved: implement the Personal world fully; register a
  qualifying item with a named future owner if Shared / Public cannot be integrated without changing frozen contracts) and
  the Product Owner's clarification C-2; CW2-04 §21 ("It may not use: Personal context") and §22 ("The invoking user's
  private QANDEEL history does not enrich that response"); the
  [IP-IMP-01 implementation record](e2e/QANDEEL_IP_IMP_01_INTERACTION_PREFERENCES_IMPLEMENTATION_RECORD_v1.md) §1.3.
- **Current truth:** frozen-contract compliant: no Personal preference enters a Public model input (structural proof:
  `interaction-preferences.isolation.spec.ts`). A reader's explicit request in their own visible Public post is World-native
  context and is unaffected.
- **Current truth (BG-08 reconciliation at ACE-SP-01, 2026-10-12; Draft PR, not merged):** Public QANDEEL responses now
  also carry the world-neutral QANDEEL personality guidance (the ACE-SP-01 controlled amendment). That guidance is
  identical for every reader and reads no preference. The isolation spec stays unchanged and green: still no Personal
  preference in a Public input. This item's scope, owner, severity and status are unchanged.
- **Anti-duplication:** `QAN-BL-CW-02` owns private Personal context in a Shared World only, through the Standing Context
  grant; no Public exception path exists in the frozen contracts and no item covers the Public World.
- **Why deferred:** honouring a private Personal preference in a Public reply would amend CW2-04 §21–§22, a frozen
  Connected Worlds contract; that is a Product / privacy decision, not engineering.
- **Owner task:** `PUBLIC-PREF-01 — Public World Personal Interaction Preference Decision` (name APPROVED by the Product
  Owner, IP-IMP-01 R2 approval, 2026-10-12).
- **Severity:** `MEDIUM` — the reader's own declared style is not applied in one World; nothing private leaks.
- **Reopen condition:** before any Public QANDEEL feature claims to honour a reader's Personal interaction preferences, and
  only after a reviewed Product decision amending CW2-04 §21–§22.
- **Required future properties:** whatever is decided, a Public reply is public material for every viewer: no private
  value is disclosed, implied or inferable from the reply, and the decision is recorded before any code.
- **Status:** `DEFERRED — OWNED`

Admitted by IP-IMP-01 under BG-06 / BG-08 in its closing change (D-SP Option A, C-2). Nothing here authorizes
implementation (BG-07).

### `QAN-BL-IP-02` — Interaction Preferences: Real-Model Behavioural Quality (Seven Reply Languages / Dialects, Brevity, Humour, Explanation Style)

- **Title / Finding:** IP-IMP-01 proves structurally that the owner's durable preferences reach the ONE provider request as
  exact Mandatory Core instructions with the right precedence. Whether a real production model follows them well — dialect
  fidelity for Egyptian, Modern Standard, Levantine, Gulf and Maghrebi Arabic and English; brevity; humour judgement
  (welcome without forcing, none when declined or under GUIDED Safety); simpler / direct explanation — is not measured.
- **Source:** the IP-IMP-01 R1 Task Contract WP7 ("The Golden Conversations suite and real dialect-performance evaluation
  remain Stage 8A"; "All seven are test candidates; their quality is proven in Stage 8A, and none may be removed"); the
  [IP-IMP-01 implementation record](e2e/QANDEEL_IP_IMP_01_INTERACTION_PREFERENCES_IMPLEMENTATION_RECORD_v1.md) §5.
- **Current truth:** nothing is known to be wrong; no paid model evaluation was run (contract WP7).
- **Anti-duplication:** `QAN-BL-CW-05` is a different Stage 8A obligation (Shared semantic-place sources); no item covers
  preference-following quality.
- **Why deferred:** real-model behaviour is Stage 8A's evaluation scope by the contract; claiming it from a deterministic
  router double would be fake proof.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `MEDIUM` — the reply quality of an approved Personal preference.
- **Reopen condition:** automatic when Stage 8A starts its Golden Conversations / dialect evaluation; and before any
  release claims the seven reply languages / dialects as supported.
- **Required future properties (validation set):** each of the seven reply languages / dialects, `ALWAYS_BRIEF`, `WELCOME`
  / `DECLINED` (and GUIDED suspension), and the three explanation styles evaluated on the production model, with the
  current-request precedence; none of the seven is removed without a Product decision.
- **Status:** `VALIDATION — OPEN`

Admitted by IP-IMP-01 under BG-06 / BG-08 in its closing change (the contract defers it to Stage 8A by name). Nothing here
authorizes implementation (BG-07).

### `QAN-BL-ACE-01` — The QANDEEL Personality Core Does Not Reach Shared / Public QANDEEL Replies (Gate B)

> **Historical pre-closure schema.** This block records the item as admitted by ACE-01. It is not the current lifecycle
> state; the current state is the `CLOSED — TOMBSTONE` record in §6 below (ACE-SP-01).

- **Title / Finding:** ACE-01 activates the approved ONE QANDEEL personality core in the Personal conversation (Text v2 =
  frozen Text v1 + the core). Shared World and Public World QANDEEL replies are still built on Text v1 alone, so they carry
  the frozen hard policy but not the personality wording.
- **Source:** the ACE-01 R0 Task Contract WP0 ("If changing frozen Shared/Public guidance requires a controlled authority
  amendment, stop at that specific decision gate") and Gate B; the Product Owner's execution authorization, rule 6; S4-02
  ("consumed as they are"; `tests/s4-02-shared-conversation-material-contract.test.mjs`: "the frozen Behavioral Response
  Policy, unchanged"); CW2-04 §21–§22 / S5-04; the [ACE-01 implementation record](e2e/QANDEEL_ACE_01_ADAPTIVE_CONVERSATIONAL_EXPRESSION_IMPLEMENTATION_RECORD_v1.md) §7.
- **Current truth:** frozen-contract compliant: Shared and Public model inputs are byte-identical to before ACE-01, with no
  personality core, no Personal preference and `locale: 'und'` (ACE-01 spec item 14, static contract).
- **Anti-duplication:** `QAN-BL-CW-02` owns private Personal context in a Shared World; `QAN-BL-IP-01` owns Personal
  interaction preferences in Public replies. Neither covers the non-private personality wording; no item did.
- **Why deferred:** sending the core to Shared / Public amends frozen Connected Worlds model inputs, and the core's
  "durable interaction preferences" clause has no authority there; that is a Product decision (Gate B), not engineering.
- **Owner task:** `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision`. The Product Owner approved the name
  on 2026-10-12.
- **Product Owner decision (2026-10-12):** Gate B — **Option A — APPROVED**. Shared / Public stay unchanged in ACE-01;
  parity is decided later by `ACE-SP-01` through a narrow controlled amendment of S4-02 and CW2-04 / S5-04, with a
  world-neutral core variant (no preference clause) passing its own Product Copy Gate. `ACE-SP-01` is not authorized by
  this decision.
- **Severity:** `MEDIUM` — personality consistency across Worlds; nothing private is involved and nothing leaks.
- **Reopen condition:** when the Product Owner authorizes `ACE-SP-01`, and before any Shared or Public feature claims the
  QANDEEL personality.
- **Required future properties:** one personality definition, never a second persona; any world-neutral wording passes the
  Product Copy Gate; Shared / Public inputs still carry no Personal data; the frozen records are amended before any code.
- **Status:** `DEFERRED — OWNED`

Admitted by ACE-01 under BG-06 / BG-08 in its closing change (the contract's Gate B). Nothing here authorizes implementation
(BG-07).

### `QAN-BL-ACE-02` — Adaptive Conversational Expression: Real-Model Personality Behaviour on the Golden Conversations Suite

- **Title / Finding:** ACE-01 proves structurally that the personality core and its Safety / preference boundaries reach
  the ONE provider request, and prepares the Golden Conversations suite (22 synthetic cases, 13-dimension blinded rubric,
  explicit unfit-register FAIL mark). Whether a real production model sounds natural and consistent, fits the register,
  initiates humour only where it fits, turns serious at once, avoids canned empathy, stays brief, disagrees respectfully,
  follows dialects, handles multi-turn shifts and honours explicit temporary requests is not measured.
- **Source:** the ACE-01 R0 Task Contract WP3 ("Real-model behavioral scoring belongs to Stage 8A"; "Not authorized now:
  paid evaluation, real-model comparison, production model selection"); conversational-personality-v1 §7–§8 (P8, P9); the
  [ACE-01 implementation record](e2e/QANDEEL_ACE_01_ADAPTIVE_CONVERSATIONAL_EXPRESSION_IMPLEMENTATION_RECORD_v1.md) §6.
- **Current truth:** nothing is known to be wrong; no paid evaluation was run and no score exists.
- **Anti-duplication:** `QAN-BL-IP-02` owns preference-following quality (dialect fidelity of the seven declared reply
  languages, brevity, humour and explanation preferences) and is not duplicated: its dimension is scored there.
  `QAN-BL-CW-05` is a different Stage 8A obligation. `QAN-BL-VOICE-01` owns voice; audio expression is Stage 8B.
- **Why deferred:** real-model behaviour is Stage 8A's scope by the contract; a deterministic double proves structure only.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `MEDIUM` — the quality of the approved Personal personality.
- **Reopen condition:** automatic when Stage 8A starts its Golden Conversations evaluation; and before any release claims
  the personality's behaviour as validated.
- **Required future properties (validation set):** the `golden-conversations` suite run blinded through the existing
  harness, every negative control scored with its FAIL condition, the unfit-register FAIL counts reported, no human review of
  private conversations, and no provider selected by the evaluation itself.
- **Scope extension (ACE-SP-01; Product Owner decision D-4, 2026-10-12):** the same validation, with the same owner, now
  also covers the world-neutral personality that ACE-SP-01 sends to Shared World and Public World QANDEEL replies. No new
  item is created.

  Cases to add to the validation set, synthetic and with no private conversation reviewed by a human:
  1. a Shared group whose participants write in different languages or dialects;
  2. one participant's explicit language or style request, followed by another participant's turn (the request must not
     become a standing preference for the others);
  3. disagreement between participants (no side taken by default; respectful disagreement without humiliating anyone);
  4. a public discussion under an Experience, where the reply is public material and must not read as a private
     conversation;
  5. a Safety `GUIDED` turn in each World (the humour suspension is honoured);
  6. fitting light humour in an everyday group moment, and none at anyone's expense.

  ACE-SP-01 proves the structure deterministically and runs no paid evaluation.
- **Evidence (S8A-01 CP4, 2026-10-21; seven synthetic DeepSeek calls, the Personal reply; [S8A-01 record](e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §8.3):**
  - Observations to score here. None is a score, and S8A-01 changes no copy.
  - One FAST reply used non-Egyptian forms in an Egyptian conversation ("أهلين", and "وش" for "what").
  - The DEEP replies were long (about 470 answer tokens) and used Markdown bold and bullets. Their fit on the mobile
    surface is a behaviour decision for this validation.
  - The FAST replies were otherwise brief, asked one question at a time and carried a three-turn context.
- **Status:** `VALIDATION — OPEN`

Admitted by ACE-01 under BG-06 / BG-08 in its closing change (the contract defers it to Stage 8A by name). Nothing here
authorizes implementation (BG-07).

### `QAN-BL-GOV-01` — Locator and Closure-Record Drift After the IP-IMP-01, ACE-01 and SHARED-VIS-01 Merges

> **Historical pre-closure schema.** This block records the item as admitted by ACE-SP-01; only its owner-name line is
> updated, with the Product Owner's approval. It is not the current lifecycle state; the current state is the
> `CLOSED — TOMBSTONE` record in §6 below (GOV-REC-01).

- **Title / Finding:** several repository locators and closure records still describe merged work as unmerged, or omit it.
  Each was verified on `main` at `141a3190deb02bc6695d2ace05da275e623a2754`:
  1. `QANDEEL_CURRENT_STATE.md` and `QANDEEL_PROJECT_MAP.md` have no IP-IMP-01 (PR #331, `424cd023`) or ACE-01 (PR #332,
     `141a3190`) row. The Project Map's INTEL-TM-01 checkpoint still calls them "later proposed C2 slices".
  2. The IP-IMP-01 and ACE-01 implementation records keep their pre-merge `**Status:**` banners ("READY FOR INDEPENDENT
     REVIEW AND THE PRODUCT OWNER'S MERGE DECISION"). Their closing-change paragraphs in §7 still read "PR open … not
     merged".
  3. SHARED-VIS-01 merged through PR #321 as `59731231`, but Current State (§3.7, §7) and this register's §9 owner row
     still show it as ACTIVE / not merged, and `QAN-BL-CW-03` is still `DEFERRED — OWNED` with no recorded disposition.
  4. The §9 owner row for `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` omits `QAN-BL-IP-02`.
  5. Current State §5 still counts 57 items while §4 holds more.
  6. The CI-01 baseline census (`docs/intelligence-evidence-baseline-v1.md`) rows C-30 and C-31 describe the pre-ACE-01
     guidance and locale ("one static string (8 lines)", `locale: 'und'` always). Rows C-22 and C-23 do not mention the
     world-neutral personality guidance added by ACE-SP-01. The census is dated (`census-v2`), so these rows are
     historical at their SHA, but nothing marks them so.
- **Source:** the Product Owner's *ACE-SP-01 — Final Product Approval & Implementation Authorization* (2026-10-12), §6:
  pre-existing drift is presented as one standalone, clearly owned item for later review and is not repaired inside
  ACE-SP-01. It was observed in the ACE-SP-01 WP0 report §12.
- **Current truth:** no runtime, Product or authority semantics are affected. The backlog's §4 index and §7 counts are
  current. ACE-SP-01 updated only its own rows (the Canonical Authority Index, Project Map rule 2, its Current State row
  and its own backlog items). It does not claim that the locators are reconciled.
- **Anti-duplication:** no item covers locator or closure-record drift. `QAN-BL-CW-03`'s own disposition belongs to
  SHARED-VIS-01's closing change and is not decided here.
- **Why deferred:** AGENTS.md §10.6 and BG-09 say that repairing a predecessor's closure record is a governance task, not
  ordinary inheritance. The Product Owner kept it out of ACE-SP-01's scope.
- **Owner task:** `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation`. Name **APPROVED** by the Product
  Owner on 2026-10-12. *(As admitted by ACE-SP-01: "ACE-SP-01 proposed this name; the Product Owner confirms it or
  renames it at review." The approval is recorded by GOV-REC-01.)*
- **Severity:** `MEDIUM` — locators that misstate lifecycle can mislead the next task's kickoff (BG-05). No runtime effect.
- **Reopen condition:** before the next task whose kickoff relies on Current State or the Project Map for the IP-IMP-01,
  ACE-01 or SHARED-VIS-01 lifecycle, and in any case before Stage 8A starts.
- **Required future property:** each listed locator and record states the true merged lifecycle with its PR and SHA. Each
  correction is recorded explicitly, never by quietly rewriting history (BG-09). `QAN-BL-CW-03` receives a recorded
  disposition. No Product semantics are reopened.
- **Status:** `DEFERRED — OWNED`

Admitted by ACE-SP-01 under BG-06 in its closing change, as the Product Owner designated (§6 of the authorization).
Nothing here authorizes implementation (BG-07).

### `QAN-BL-LAUNCH-04` — Shared / Public Living Analysis — Physical Android Rapid-Interaction & Resize Stability Proof

- **Title / Finding:** SHARED-VIS-01 (PR #321, merged as `5973123153e26494d702a4a859a79631ede225cd`) put the Shared World
  on the common Living Analysis stack and, through the Controlled Frozen Map Correction, changed the shared `WorldCanvas`
  so that a frame resize no longer resets the camera plane. Shared and Public consume that stack. The fix is proven only
  off-device: focused deterministic resize / camera race tests (12 / 12), 12 / 12 regular panel-scroll-Back cycles on an
  Android emulator, and emulator TalkBack checks for Shared and Public (named in the Product Owner's PR #321 merge decision;
  GOV-REC-01 record §2). No physical Android device was connected. The
  bounded emulator stress attempt of rapid open / Back cycles ended in an ANR / freeze; emulator software-GPU or memory
  pressure is a plausible contributing cause, and is not proof that the production app is unaffected. Whether the
  release app stays responsive and correct on real Android hardware under rapid interaction, and under resize during
  active camera motion, in both consumers, is **NOT PROVEN**.
- **Source:** GitHub [Issue #322](https://github.com/allamqandeel/qandeel/issues/322), *Physical Android rapid
  interaction & resize stability proof* — the Product Owner's binding pre-launch gate of 2026-10-09, the condition of the
  PR #321 merge (exact reviewed head `8563e5699a100fe88c3e5ef451ca825c98d4c18e`); the
  [SHARED-VIS-01 record](e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md) §11, §13.1
  and §14 (the native proof and the correction); the
  [GOV-REC-01 record](e2e/QANDEEL_GOV_REC_01_POST_MERGE_LOCATOR_CLOSURE_RECORD_RECONCILIATION_v1.md) §7 (the admission
  proposal); and the Product Owner's explicit approval of this admission in the Stage 6 WP0 brief (2026-10-13, §8),
  recorded in the [Stage 6 WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §9.
- **Current truth:** Issue #322 is `OPEN / NOT PROVEN / RELEASE BLOCKER`. Merging PR #321, green CI, the visual
  acceptance, the deterministic race tests and the emulator passes are not device evidence (Issue #322; the
  `QAN-BL-CW-03` tombstone). This admission closes, waives and reclassifies nothing, and does not reopen SHARED-VIS-01:
  the issue stays the home of the evidence, and this item is its register entry.
- **Anti-duplication:** no other item carries this obligation. `QAN-BL-NOTIF-05` covers the native-Push physical-device
  Exit Gates PD-01 … PD-09 only. `QAN-BL-VIS-01` covers heavy-history scale, LOD and real-device scale / performance (its
  D6, and LA-VIS-01's real-phone performance), not stability under rapid interaction or resize at any scale. `QAN-BL-MOT-03` and `QAN-BL-RSP-01` are T-12 tombstones for the Personal world on
  `02bff1b6…`, before the Shared consumer and the `WorldCanvas` correction existed. `QAN-BL-CW-03` is tombstoned and puts
  this release evidence explicitly outside its scope. `QAN-BL-CI-01` is the iOS simulator Maestro driver. The ID
  `QAN-BL-LAUNCH-04` was unused.
- **Why deferred:** the proof needs a physical Android phone and a release-representative build, which no task has had.
  The issue places the obligation at the release-readiness gate, or earlier when a device is available, and says it is
  not an instruction to reopen SHARED-VIS-01, run endless CI or change the visuals now.
- **Owner task:** `Stage 9 — Economy + Launch Closure (release-readiness gate)`. As the issue allows, an earlier explicit
  validation owner may take it when a physical Android device becomes available; that change is recorded here as a
  re-owning, never made silently.
- **Severity:** `HIGH`. A stall, lost touch or wrong focus in the Shared and Public Living Analysis consumers breaks the
  core World experience on real devices, and the Product Owner made the proof a release blocker.
- **Reopen condition:** automatic when Stage 9 / Release Hardening & Launch starts; earlier, when a physical Android device
  is available for validation; and in any case before any public production launch of QANDEEL.
- **Required future property (Exit Gate) — exactly the evidence Issue #322 defines:**
  1. a physical Android phone and a release-representative app build;
  2. both affected Living Analysis consumers, Shared and Public: FAR → MID → NEAR, focusing a semantic place,
     opening and scrolling the panel, Back, and the return to an interactive map;
  3. at least **12 panel-scroll-Back cycles and 4 rapid open / Back cycles** on the device, each with correct focus and
     labels, visible and hittable places, no stuck movement and correct camera / World isolation; the rapid cycles cover
     resize during active camera motion; a harness's stale coordinates or snapshots are not counted as Product failures;
  4. no ANR, unrecovered stall, lost touch, labels that stay missing, or incorrect focus / target — one observed Product
     failure is a FAIL, diagnosed and fixed before release;
  5. auditable proof — the exact tested SHA and APK hash, the device model and Android version, step-by-step PASS / FAIL,
     the relevant screenshots, device logs or screen recording, and any exception classification — with the outcome
     recorded in canonical release-readiness evidence;
  6. with no physical device the result stays `NOT PROVEN / LAUNCH BLOCKED`, never PASS. No waiver without a new
     explicit Product Owner decision recorded with the release risk.
- **Closure rule:** only the owning task tombstones this item, citing that evidence, and Issue #322 closes with the same
  evidence. Neither closes on CI, emulator runs, a merge or a visual acceptance.
- **Status:** `DEFERRED — OWNED`

Admitted under BG-06 / BG-08 at the Product Owner's explicit approval (Stage 6 WP0 brief, 2026-10-13, §8), as a
documentation-only governance change; GOV-REC-01 had left the admission to the Product Owner (its record §7). Issue #322
stays `OPEN / NOT PROVEN / RELEASE BLOCKER`. Nothing here authorizes implementation (BG-07).

---

### `QAN-BL-MATCH-02` — Introduction-Phase Account Name Exposure Through Phase-Blind Shared World Reads

> **Historical pre-closure schema.** This block records the item as admitted by the Stage 6 WP0, with one dated
> amendment note below. It is not the current lifecycle state; the current state is the `CLOSED — TOMBSTONE` record in
> §6 below (S6-02).

- **Title / Finding:** the Stage 4 Shared reads, and the Shared QANDEEL reply prompt built from them, admit a World by
  its lifecycle (`ACTIVE`) and never by its phase. They project the account Name (`public.users.name`, migration
  `0123:23-26`). An Introduction-phase World (`SHARED_WORLD` / `ACTIVE` / `INTRODUCTION`, born only by the I-07C Mutual
  Match) would therefore expose each matched person's account Name before that person discloses `FULL_NAME`, through
  three paths:
  - the member list, `list_own_shared_world_members_v1` (`0138:613-630`): `u.name` at `:623`, joined at `:627`, behind a
    lifecycle-only gate at `:625`;
  - the material list, `list_own_shared_world_material_v1` (`0139:110-149`): `author_name` is `u.name` (`:139`, joined at
    `:143`), behind a lifecycle-only gate at `:127-131`;
  - the Shared QANDEEL reply prompt, which renders each speaker's name from that material list and so sends it to the
    model provider (`apps/api/src/shared-world/shared-conversation-model-input.ts:26-47`, rendered at `:46`, fed through
    `shared-world-conversation.service.ts:172-178`).

  The same phase-blindness reaches two surfaces that carry the Name without showing it to the counterpart today, and any
  fence must still cover them. The Shared Activity source derivation returns the actor's account Name to the API for a
  human message (`0141:65-79`, `au.name` at `:71`, gate `:73`), but the producer replaces the sentence with the generic
  ambient line (`apps/api/src/shared-world/shared-activity.producer.ts:59-61`). The place-sources read (`0148:570-598`,
  `u.name` at `:590`) sits behind the lifecycle-only membership reader (`0148:251-257`), yet has no place to read before
  SUCCESS: semantic passes refuse anything but `ACTIVE` / `STANDARD` (`0148:310`). The `BIRTH`, `JOINED` and `LEFT`
  derivations of `0141` have no Introduction-phase source.
- **Source:** the [Stage 6 WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §2.5 (as
  corrected in its §14.10) and §14; the Product Owner's GATE-03 decision (2026-10-13). Frozen authority:
  - [P1](qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) §13. The Introductions cell of its
    account Name row (`:522`; scope `:514-515`) allows "the separately confirmed Introduction First Name only" before the
    Match, and the account Name later "only by the owner's progressive `FULL_NAME` disclosure".
  - P1 §4: the Introduction First Name.
  - [CW2-06](canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06_INTRODUCTIONS_MATCHING_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md)
    §12, §41 and §44–§46: first names before and at the Match; the full name only by owner-controlled, non-reciprocal
    progressive disclosure.
- **Current truth:** latent, read from code and not executed. No Introduction World can be born:
  - The only insert of an `ACTIVE` / `INTRODUCTION` / `MUTUAL_MATCH` World is inside `commit_matching_mutual_match_v1`
    (`0114:245`, `:504-505`).
  - That function is executable by no role, `service_role` included (`0114:706-719`, asserted at deploy, `:782-789`).
  - It also needs the CW2-08 prerequisite seam, which answers `NOT_EVALUATED` (`0111:305-317`).
  - No API route or screen exists for Matching, and no production provider is bound.

  A post-Match first name already has a store that no Shared read uses
  (`matching_match_handoff_subjects.presented_first_name`, `0113:589`). An ended Introduction
  (`READ_ONLY_CLOSED` / `INTRODUCTION`) is not exposed through these reads, which gate on `ACTIVE`.
- **Anti-duplication:** no item carries this obligation.
  - `QAN-BL-MATCH-01` is the setup suspension. Its ACE-SP-01 reconciliation note (§7) concerns Matching context, not the
    Name: Introduction-phase Shared Worlds "share the Shared reply path and gain no Matching or Introduction context".
  - `QAN-BL-CW-02` is private Personal context in Shared. The account Name is visible identity under P1 §13, not a
    private source.
  - Unrelated: `QAN-BL-ACCT-01`, `QAN-BL-CW-06` / `CW-07`, `QAN-BL-LAUNCH-03`, `QAN-BL-PRIV-01` … `03`, `QAN-BL-SEC-01`,
    `QAN-BL-VOICE-01`, `QAN-BL-ACE-02`, `QAN-BL-IP-01` / `IP-02`, and the `CW-01`, `CW-03` and `ACE-01` tombstones.
  - The I-07 closure record could not have recorded it: the phase-blind reads were written later, by Stage 4 (`0138` …
    `0141`) and SHARED-VIS-01 (`0148`), over the cores that `0118` widened.
  - Nothing outside the register carries it: not the E2E gap matrix, the P4 census, the S4 and SHARED-VIS-01 records, or
    any open GitHub issue. The ACE-SP-01 record noted that `0139` checks only the lifecycle, but it assessed context, not
    the Name.
  - The ID `QAN-BL-MATCH-02` was unused.
- **Why deferred:** nothing can reach it until a birth path exists. Fixing it redefines frozen Stage 4 functions through a
  forward migration (the `0118` precedent). This is Stage 6 work, not a hot-fix.
- **Owner task:** `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary`.
  - The Product Owner named the owner (GATE-03) and the task (the approved Stage 6 task map, 2026-10-13).
  - The task map is an approved planning direction, subject to the task's own Task Contract.
  - It is not the `S6-02` "Matching Intelligence & Eligibility" of the Product Owner's earlier local sketch (WP0 record
    §8.4).
  - A rename, renumbering or fold into another task is recorded here as a re-owning, never made silently.
- **Severity:** `HIGH`. If reopened, it decides whether a matched person's account Name reaches the counterpart or a model
  provider before that person's own `FULL_NAME` disclosure, against a frozen privacy rule (P1 §13).
- **Reopen condition:** automatic at S6-02's kickoff. In any case, also when any task proposes any of these:
  - a path that can birth an Introduction World (`EXECUTE` on the `0114` Mutual Match commit, or a wrapper over it);
  - making an Introduction-phase World readable through any Shared surface;
  - opening a Matching gate.
- **Required future property:**
  - In an Introduction-phase World, a member's account Name is withheld until that member's own `FULL_NAME` disclosure,
    per person and non-reciprocal (P1 §13; CW2-06 §44, §46). Until then:
    - no Shared read answers a counterpart with it;
    - no Activity item or notification carries it;
    - no model input contains it.
  - `STANDARD`-phase behaviour is unchanged.
  - Frozen P1 §13 binds every task. A task that opens a birth path while any surface it reaches exposes the account Name
    before `FULL_NAME` violates a frozen contract (BG-01).
  - Bound by the Product Owner's GATE-20 decision (2026-10-13, approved Product intent, not an implementation authority):
    - the dedicated isolation fence exists before any accessible Mutual Match birth;
    - its interim fails closed;
    - no birth path is reachable before the unilateral END capability is securely available.

    The confirmed Introduction First Name is a distinct source from the account Name, never resolved from `users.name`
    (GATE-12).
  - Still for S6-02's Task Contract, not decided here:
    - the exact interim answer of each surface;
    - which name applies after SUCCESS;
    - the presentation of the World (GATE-29: final visual design approved separately).
- **Amendment (Product Owner decisions A and A1, S6-02 Task Contract v1.1 / v1.2, 2026-10-15; binding over the required
  property above, which is stricter now, not weaker):** the protection follows the World's persisted origin
  (`birth_basis = 'MUTUAL_MATCH'`), not its current phase. The approved Introduction first name stays the display name
  across SUCCESS; the account Name never becomes the display name automatically, and the move to `STANDARD` is no
  consent to anything. A `FULL_NAME` disclosure is not a display consent: showing the full account Name as the display
  name needs its owner's own, separate, explicit authorization for that use (S6-06). One person's disclosure reveals
  nothing of the other's. A Matching-born World admits no third member and no rejoin in v1 (A1 / D3). Where no
  approved first name is proven, the answer is `NULL` and the existing neutral fallback, never `users.name` (D2).
- **Not in this item:** the GATE-03 admission is the account Name exposure only. The rest of the Introduction-phase fence
  that GATE-20 approved is, in the WP0 decision record's reading, S6-02's planning scope (§14.5; not an assignment: the
  scope is set by S6-02's Task Contract), not separate register items. It covers:
  - member and material views;
  - conversation and Model Router input;
  - Activity and notifications;
  - Shared semantic readers;
  - Direct Entry;
  - closed-history and former-own-material access;
  - the unilateral END boundary.

  Replay of Introduction material is excluded until Stage 7 (GATE-35).
- **Status:** `DEFERRED — OWNED`

Admitted under BG-06 / BG-08 at the Product Owner's explicit GATE-03 decision (Stage 6 WP0, 2026-10-13), after the
anti-duplication check above, as a documentation-only governance change. Nothing here authorizes implementation (BG-07).

---

### `QAN-BL-MATCH-03` — Safe Compatibility Conclusion Production Capability, AI Cost Attribution and Evaluation

- **Title / Finding:** a Matching proposal reaches a recipient only with a recipient-specific Safe Compatibility
  Conclusion that the deterministic Sensitive Conclusion Filter has permitted. The recipient view refuses anything else
  (`0120:462-468`, `MATCHING_SAFE_CONCLUSION_NOT_PERMITTED`), and never re-aims a conclusion at the other person
  (`:469-472`).
  - The frozen I-07B runtime stores a conclusion candidate as untrusted, caller-supplied input (`0111:757-808`: "Whatever
    produced it - a model, a template, a human - it is untrusted input").
  - It filters that candidate (`0111:810-914`). The filter is the only thing that can mint a permitted conclusion
    (`:1246-1253`).
  - Nothing produces a conclusion:
    - no model path: the Model Router has one task, `CONVERSATIONAL_RESPONSE` (`apps/api/src/model-router/model-router.types.ts:27-28`),
      and no production provider is selected (QIR-001, `integrated-intelligence-runtime-contract-v1.md:288`);
    - no template;
    - no AI-COST-01 feature family: the closed set at `0135:96-98`, mirrored at `apps/api/src/ai-usage/ai-usage.types.ts:20-31`,
      has none for Matching;
    - no evaluation suite: `apps/api/src/brain-eval/brain-eval.suites.ts:17-23` holds only `brain-bakeoff` and
      `golden-conversations`.
  - I-07A assigned "Safe Compatibility Conclusion generation" to I-07B ([runtime](matching-introduction-runtime-v1.md)
    `:243-245`). I-07B built only the intake and the filter, and neither its anti-scope nor the I-07 closure record names
    an owner for a producer.

  So no proposal, Mutual Match or Introduction can occur for a real user, whatever else is delivered.
- **Source:** the [Stage 6 WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §2.3, §6
  (as corrected in its §14.10) and §14; the Product Owner's GATE-03 decision (2026-10-13). Frozen authority:
  - [CW2-06](canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06_INTRODUCTIONS_MATCHING_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md)
    §20, §23–§26 and F20;
  - the I-07B [runtime](matching-introduction-runtime-v1.md) §18 and §20;
  - [CW2-08](canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md)
    §40–§41;
  - the migrations and source files cited above.
- **Current truth:** fail-closed, with zero proposals. Today no application role can submit a conclusion at all
  (`0111:1137-1145`). The Product Owner's GATE-02 decision binds the interim:
  - Stage 6 may reach engineering integration completion with the production provider unbound;
  - no compatibility conclusion, real proposal or Introduction is fabricated;
  - production eligibility stays fail-closed until the required Stage 8A and Stage 9 capabilities and evidence exist.

  A produced conclusion would still deliver nothing while these stay closed; each belongs to another owner:
  - the first-name seam (`0120:474-479`);
  - the proposal field policy (`0120:455-460`);
  - the CW2-08 seam.
- **Anti-duplication:** no item carries this obligation.
  - `QAN-BL-CW-05` (Stage 8A) is about QANDEEL output as a Shared place source.
  - `QAN-BL-IP-02` and `QAN-BL-ACE-02` (Stage 8A) validate the real-model quality of replies. Neither covers a Matching
    conclusion, and reply quality in Introduction-phase Worlds stays with them.
  - Unrelated: `QAN-BL-CTX-01`, `QAN-BL-INTEL-01` … `03`, `QAN-BL-QIR-01`, `QAN-BL-NOTIF-02` and `QAN-BL-MATCH-01`. The
    `QAN-BL-PROD-01` tombstone bounds the spend of conversation turns.
  - The Stage 8A provider bindings that S5-03A, S5-03B and SHARED-VIS-01 recorded (Current State §3.7 and §7) are separate ports.
    They were never admitted, and they are not folded in here.
  - No open GitHub issue carries it.
  - The ID `QAN-BL-MATCH-03` was unused.
- **Why deferred:** a production conclusion needs a production provider bound behind the Model Router's adapters, and no
  task before Stage 8A has one. The frozen I-07 runtime deliberately contains no intelligence, and CW2-06 §57 leaves the
  model implementation unfrozen.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `HIGH`. Without it, the frozen I-07 Matching capability delivers nothing to any user. If reopened, it
  decides what QANDEEL tells one person about another, inside the frozen limits of CW2-06 §24 and §25.
- **Reopen condition:** automatic at Stage 8A's kickoff (BG-05). In any case, also before any task makes either of these
  executable for a real proposal, or opens a Matching gate:
  - the conclusion submission (`0111`);
  - the recipient-view disclosure (`0120`).

  The Product Owner's GATE-22 decision (2026-10-13) keeps a refusing, provider-neutral port until Stage 8A supplies a
  properly evaluated real producer, so no non-model alternative is approved. If one is ever approved, that decision is
  recorded here as a re-owning or as a tombstone with its disposition, never silently.
- **Required future property (only what frozen authority already fixes):**
  1. The conclusion is recipient-specific, about the counterpart, and never re-aimed (CW2-06 §20, §23; `0120:469-472`).
  2. It expresses broad relational compatibility only, from authorized Matching context. It exposes no private memory,
     incident, direct private quote, hidden evidence or secret provenance (CW2-06 §24, F20).
  3. It stays untrusted input to the unchanged deterministic Sensitive Conclusion Filter and carries no safety label of
     its own. Model assistance may only add refusals (CW2-06 §25; `0110:165-167`; `0111:95-100`, `:804-808`).
  4. It carries no score, rank or percentage (CW2-06 §16, F14).
  5. It reads inputs only under the Matching Context Grant's fixed purpose, which never transfers to a Shared World
     (CW2-06 §7, F7, F33). No Matching operational state enters ordinary semantic Memory (CW2-08 §41).
  6. Provider-specific logic stays behind the Model Router's adapters (AGENTS.md §4). A model path is a census-listed,
     accounted transport, and its AI-COST-01 feature family is added by a reviewed forward change to the closed set at
     `0135:96-98`. Attribution is "appropriate" in this sense: none applies to a non-model alternative.
  7. It is evaluated before enablement, because an untested capability stays blocked (CW2-08 §40). The evaluation uses
     synthetic cases only: CW2-08A forbids human review of private QANDEEL conversation content.
  8. While unbound, untested or unconfigured, it fails closed, with no fallback or canned answer (CW2-08 §40; QIR-001 §6
     rule 7).
- **Product Owner decisions that bind the owner (2026-10-13; approved Product intent, not implementation authority):**
  - GATE-22: a refusing provider-neutral port until a properly evaluated real producer exists. There is no fake AI
    recommendation and no unauthorized combination of two humans' private contexts.
  - GATE-23: the initial pre-Match proposal displays only approved neutral QANDEEL copy, without names, detailed traits,
    individual agreement reasons or private evidence.
    - This conflicts with the frozen proposal-view assumptions: CW2-06 §20, and the 0120 recipient view, which binds a
      first name and a conclusion.
    - A controlled amendment resolves that conflict before implementation.
    - If the amendment changes whether a conclusion is needed at all, this item is narrowed or re-owned explicitly.
  - GATE-26: a deterministic Arabic / English privacy and contact-information refusal floor exists before any pre-Match
    disclosure path operates. Model-based checks are only additive.
- **Not decided here:**
  - what "authorized" means for one provider call that reads both people's contexts;
  - ranking and selection policy, and final copy (CW2-06 §57);
  - provider selection and pricing;
  - how the producer reconciles QIR-001 §4 rule 7.
- **Not in this item:** each of these belongs to Stage 6 or Stage 9 planning scope in the WP0 decision record, not to
  this item:
  - the deterministic refusal floor (GATE-26);
  - the filter policy and the `PROPOSAL_SAFE_FIELDS` values (GATE-24: the allowlist starts empty);
  - the CW2-08 seam (Stage 9);
  - the hard-requirement evaluator and the private reasoning notes;
  - the conversational offer, onboarding assistance, Introduction mode and QANDEEL suggestions (Stage 8A product intent,
    no register item);
  - Matching export (`QAN-BL-PRIV-04`);
  - media;
  - orchestrator visibility.
- **Status:** `DEFERRED — OWNED`

Admitted under BG-06 / BG-08 at the Product Owner's explicit GATE-03 decision (Stage 6 WP0, 2026-10-13), after the
anti-duplication check above, as a documentation-only governance change. Nothing here authorizes implementation (BG-07).

---

### `QAN-BL-PRIV-04` — Export My Data Omits the Reader's Matching and Introductions Data

> **Historical pre-closure schema.** This block records the item as it stood before S6-07's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-PRIV-04` in §6 (S6-07 CP4).

- **Title / Finding:** Export My Data (`personal_data_private.build_personal_export_v1`, live body `0153:224`) carries the
  account, conversations, Memory, Understanding and Interaction Preferences (`0153:232-313`). It reads no Matching or
  Introduction relation and names the category only in its `notYetIncluded` list (`'introductions'`, `0153:314`;
  `0130:15-16`). Matching setup is not named at all. Once Stage 6 lets a person enroll, data of two kinds would exist with
  no export path:
  - the reader's own Matching data: participation, consent and context-grant events, Introduction Profile and requirement
    versions, disclosure authorities (`0108:181-640`), reactivation commands (`0117:140`), and the reader's own decisions,
    disclosures, SUCCESS approvals and END (`0112` … `0116`);
  - pair-scoped rows that bind two humans: pairs, eligibility snapshots, hard-requirement results, private reasoning
    notes, conclusion candidates and permitted conclusions, filter refusals, proposals and recipient views
    (`0110:213-979`); the Mutual Match records and handoff subjects (`0113:191-644`); disclosure payloads (`0115`); and
    Introduction conversation on the Shared material cores (`0118`).
- **Source:** the Product Owner's GATE-19 decision (2026-10-13): "Matching and Introduction data must be addressed in the
  governed personal export scope without exposing the other participant's private data or confidential reasoning. Create
  the appropriate owned backlog obligation after anti-duplication review." The
  [Stage 6 WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) J12, §8.2 and §14.4. The
  W3-PDG-01 content principle
  ([closure](canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md)
  §7.3, `:212-227`). The
  [W3-MEGA-S record](e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md) item 9 (`:574`), which
  left world-scoped export to "each Connected World's integration (Stages 4 – 7: Shared, Public, Matching /
  Introductions, Replay)".
- **Current truth:** nothing exported is false. The package names the category as not yet included. No real footprint can
  exist yet:
  - `0149` closes the six widening setup commands (`QAN-BL-MATCH-01`);
  - the I-07B–D cores are executable by no application role;
  - the hosted database had no Matching table at the last approved metadata check (`0074`; not re-checked by WP0).
- **Anti-duplication:** no item carries this obligation.
  - `QAN-BL-PRIV-01` … `03` (owner `PRIV-EXPORT-01`) are single-owner Personal facts. They were deferred there because no
    Product authority defined the export's content. GATE-19 now supplies that authority for this domain.
  - `QAN-BL-ACCT-01` is deletion only. `QAN-BL-MATCH-01` is the setup suspension. `QAN-BL-PROD-05` is the export package's
    size, not its content.
  - The I-07 closure record admitted nothing, and its list of later work omits export. The W3-PDG-01 closure admits only
    `QAN-BL-ACCT-01`. W3-MEGA-S item 9 assigned world-scoped export to the stages and admitted nothing. The E2E gap
    matrix's export rows (E2E-D-16, E2E-D-17) predate W3.
  - No open GitHub issue carries it, and the ID was unused.
- **Why deferred:** no Matching footprint exists to export, and the section can only be built after S6-01 … S6-06 have
  created every relation it must cover. These include the first-name store (GATE-12), consent-version evidence (GATE-17)
  and any pre-enrollment preparation (GATE-05).
- **Owner task:** `S6-07 — Activity, Direct Entry and Final Integration`.
  - The name comes from the Product Owner's approved Stage 6 task map (2026-10-13), a planning direction subject to the
    task's own Task Contract. GATE-19 named no owner. WP0 assigned it to S6-07 (record §14.4), and the Product Owner
    confirmed the owner and the `HIGH` severity in the final decision addendum the same day (D2; record §14.14).
  - S6-07's scope here is the reader's Matching and Introductions export only (D2). It is not a cross-world export task:
    the Shared, Public and Replay categories are `QAN-BL-PRIV-05`'s (`PRIV-EXPORT-01`, D5).
  - S6-07 runs last, after the relations it must cover exist. WP0 §8.2 placed the export there.
  - A domain task adding its own export section has a precedent: IP-IMP-01 in `0153:27-28`, `:222-314`.
  - Every change re-states the whole `build_personal_export_v1` body (`0153:222-224`), so S6-07 reconciles with
    `PRIV-EXPORT-01` and does not overwrite it.
  - A rename, renumbering or fold into another task is recorded here as a re-owning.
- **Severity:** `HIGH` (WP0's rating, confirmed by the Product Owner in the final decision addendum, D2; record §14.4,
  §14.14). Unlike `QAN-BL-PRIV-01` … `03`, which add one owner's own facts (`MEDIUM`), this data binds two
  humans. Building the section means deciding whether a reader is added over frozen I-07 relations that were designed to
  have no downstream reader (`0110:491-493`, `:516-519`, `:621`, `:647-651`). If reopened, it decides what crosses from one person to the other, against frozen
  pair-privacy law (CW2-06 §28, §33, §38, §53; CW2-08 §2). That is the consequence class of `QAN-BL-MATCH-02`. Today
  nothing is violated: the severity states the consequence of the reopened work, not a present defect.
- **Reopen condition:**
  - automatic at S6-07's kickoff (BG-05);
  - in any case, before Export My Data is declared complete for launch (the `QAN-BL-PRIV-01` … `03` condition);
  - when any task re-states `personal_data_private.build_personal_export_v1` or reads a Matching or Introduction relation
    into it. `PRIV-EXPORT-01` is included, so the re-statements are reconciled, not overwritten.
- **Required future property** (1–6: only what GATE-19 and existing authority already fix; 7 is proposed):
  1. The reader's own Matching and Introduction data reaches the governed personal export as readable facts, within actual
     ownership and authority (GATE-19; W3-PDG-01 §7.3, `:214`, `:221`).
  2. No participant's export contains any of the following: another participant's private data or confidential
     reasoning; private reasoning notes, refusals, conclusion candidates or hard-requirement outcomes about anyone else
     (`0110:480-484`, `:516-519`, `:545-549`, `:647-651`); another participant's private reason; whether another
     participant's rejection, or an expiry, ended a proposal the reader did not end; competing activity or another Match
     (CW2-06 §28, §33, §38, F41); or any score or rank (§16, F14). The reader's own decisions are the reader's data
     (property 1).
  3. Nobody learns from an export that they were evaluated or considered unless the proposal flow reached them (CW2-06
     §53; the [I-07 runtime](matching-introduction-runtime-v1.md) `:438`).
  4. Raw evidence and the Matching Context Grant's contents stay out (CW2-06 §41, F32 / F33). The export carries no
     internal id, secret, token, score or reasoning (the W3-MEGA-S export contract, `:368`).
  5. Owner-deleted disclosures, and any content-verifying digest of them, are never exported (CW2-08 §2, deleted-content
     non-serving; `0122`).
  6. Until delivered, the package keeps naming the category as not yet included (`0130:15-16`; `0153:314`).
  7. Exit Gate (proposed, on the `QAN-BL-PRIV-02` precedent): an export test over a populated two-human Matching /
     Introduction footprint shows that neither participant's export holds anything the authority above withholds from
     them.
- **Not decided here (S6-07's Task Contract, under GATE-19):**
  - whether a recipient's own proposal views, and the counterpart's disclosures to the reader, are exported;
  - whether hard-requirement outcomes about the reader reach the reader at all (confidential reasoning is never
    exported: GATE-19);
  - whether an export names who ended an Introduction;
  - where Introduction conversation ends and the still-unowned `shared` category begins;
  - format, labels and copy (Copy Gate; the language rule);
  - consent-version evidence (GATE-17).
- **Not in this item:** the Shared, Public and Replay world-scoped export categories. They are still in `notYetIncluded`
  after Stages 4 and 5 closed, and no register item owns them. WP0 reports this to the Product Owner and admits nothing
  (§14.4). *(Final decision addendum, 2026-10-13: now carried by `QAN-BL-PRIV-05`, owner `PRIV-EXPORT-01`, D5.)* Deletion stays with `QAN-BL-ACCT-01`, and the export package's size with `QAN-BL-PROD-05`.
- **Dated note (S6-03 closing change, 2026-10-15; effective from its merge):** the three `0156` relations
  (`matching_confirmed_fact_versions`, `matching_confirmed_fact_state`, `matching_eligibility_snapshot_fact_bindings`)
  join this item's Matching export footprint. Owner, severity and status unchanged ([S6-03 record](e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md) §7).
- **Dated note (S6-06 CP1, 2026-10-16; not merged; effective from its merge):** the reader's own photo series and their
  stages, the photo bytes in the private object store (read through `server_read_introduction_media_key_v1` only), and
  the reader's own display-consent acts (`introduction_sharing_private`, `0162`) join this item's export footprint; the
  reader's own shares across every Introduction are already listed by `list_my_introduction_shares_v1`. Owner, severity
  and status unchanged ([S6-06 record](e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md) §8).
- **Dated note (ACCT-DEL-01 closing change, 2026-10-17; PR #345, not merged; effective from its merge):** a counterpart's
  retained view (`introduction_retained_views` / `_items`, `0164`) joins this item's export footprint. It holds the
  reader's own words in an Introduction whose other participant erased their account; P-2 gives the reader the right to
  export them, and no export reaches them yet. The export carries the reader's own items only: never the erased
  participant's words or name, which the retained view does not hold. The released Matching lineage
  (`matching_counterpart_erasure_releases`, the sibling reactivation commands) is the reader's Matching data too.
  Owner, severity and status unchanged ([ACCT-DEL-01 record](e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md) §8).
- **Status:** `DEFERRED — OWNED`

Admitted under BG-06 / BG-08 at the Product Owner's explicit GATE-19 decision (Stage 6 WP0 final approval package,
2026-10-13), after the anti-duplication check above, as a documentation-only governance change. Nothing here authorizes
implementation (BG-07).

---

### `QAN-BL-PRIV-05` — Export My Data Omits the Reader's Shared, Public and Replay World Data

- **Title / Finding:** Export My Data (`personal_data_private.build_personal_export_v1`, live body `0153:224`) reads no
  Shared, Public or Replay relation. It names `'shared'`, `'public'` and `'replay'` only in its `notYetIncluded` list
  (`0153:314`; `0130:15-16`).
  - W3-MEGA-S left world-scoped export to "each Connected World's integration (Stages 4 – 7: Shared, Public, Matching /
    Introductions, Replay)" (item 9, `:574`).
  - Stages 4 and 5 closed without delivering it. The Stage 5 records point their gaps at the stale E2E-D-16 row, and the
    Stage 4 records record no export gap.
  - No register item owned these categories (the [Stage 6 WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md)
    §14.4).
- **Source:** the Product Owner's final decision addendum to the Stage 6 WP0 (2026-10-13), D5: "Assign cross-world
  export completeness to a dedicated, explicitly owned `PRIV-EXPORT-01` planning path, coordinating with Stage 7 for
  Replay" (WP0 record §14.14). The W3-PDG-01 content principle
  ([closure](canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md)
  §7.3, `:212-227`).
- **Current truth:** nothing exported is false, because the package names each category as not yet included. Stages 4
  and 5 merged Shared and Public footprints into `main`. This states what is merged, not what is deployed.
- **Anti-duplication:**
  - `QAN-BL-PRIV-01` … `03` (the same owner) are single-owner Personal facts.
  - `QAN-BL-PRIV-04` is the reader's Matching and Introductions export only (the `'introductions'` category) and excludes
    these categories by its own text.
  - `QAN-BL-ACCT-01` is deletion. `QAN-BL-PROD-05` is the export package's size, not its content.
  - W3-MEGA-S item 9 assigned world-scoped export to the stages and admitted nothing. The E2E gap matrix's export rows
    (E2E-D-16, E2E-D-17) predate W3.
  - No open GitHub issue carries it. The ID `QAN-BL-PRIV-05` was unused in the tree, in the history of every ref, and in
    GitHub issues and PRs.
- **Why deferred:** what of a multi-member World belongs to one member's export needs a decision on ownership and
  authority for each World. W3-PDG-01 §7.3 leaves "the exact wording that excludes other people's material" as an
  implementation consideration. Replay's user-facing contract is Stage 7's.
- **Owner task:** `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` (the Product Owner's D5 designation).
  - The owner string is copied character-exact from `QAN-BL-PRIV-01` … `03`. Its name is narrower than its scope after
    D5, and a rename is recorded as a re-owning of all its items.
  - Replay is coordinated with Stage 7 (D5). Introduction material stays excluded from user-facing Replay until Stage 7
    defines and approves its contract (GATE-35).
  - `S6-07` does not take this item (D2), and `PRIV-EXPORT-01` does not take `QAN-BL-PRIV-04`. Every change re-states
    the whole `build_personal_export_v1` body (`0153:222-224`), so the two reconcile and neither overwrites the other.
- **Severity:** `HIGH` (the Product Owner's D5 designation; the rating follows `QAN-BL-PRIV-04`, confirmed by D2).
  - If reopened, the work decides what of a multi-member World crosses into one member's export: "only within the
    limits of actual ownership and authority" (W3-PDG-01 §7.3), with no "other person's material" (the W3-MEGA-S export
    contract, `:368`).
  - `QAN-BL-PRIV-01` … `03` are `MEDIUM` because each adds one owner's own facts.
  - Today nothing is violated: the severity states the consequence of the reopened work.
- **Reopen condition:**
  - automatic when `PRIV-EXPORT-01` starts (BG-05);
  - when Stage 7 defines the Replay contract;
  - when any task re-states `personal_data_private.build_personal_export_v1` or reads a Shared, Public or Replay
    relation into it;
  - in any case, before Export My Data is declared complete for launch.
- **Required future property** (only what existing authority fixes):
  1. The reader's own Shared and Public data reaches the governed export as readable facts, only within the limits of
     actual ownership and authority. Replay / audio material is included when it exists and the reader has a right to it
     (W3-PDG-01 §7.3).
  2. The export holds no internal id, secret, token, score, reasoning or other person's material (W3-MEGA-S `:368`).
  3. Until delivered, the package keeps naming each undelivered category as not yet included (`0153:314`).
- **Not decided here:**
  - the ownership rule for each World: authored material, replies, relations, member lists and reactions;
  - the Replay contract (Stage 7);
  - format, labels and copy (Copy Gate; the language rule).
- **Not in this item:** the `'introductions'` category (`QAN-BL-PRIV-04`, `S6-07`); deletion (`QAN-BL-ACCT-01`); the
  package size (`QAN-BL-PROD-05`).
- **Dated note (S7-01, 2026-10-19; changes no field):** the coordination interface for Replay, recorded only. S7-01
  adds no export and does not touch `build_personal_export_v1`; `'replay'` stays in `notYetIncluded`.
  - *What exists to export:* the reader's own Personal Replays (`0169`): per Replay its lifecycle, creation instant, the
    draft's range (first / last Session Position, coverage class) and each version's revision, finalization and render
    truth contract. All of it is the reader's own; no other human's material exists on this path.
  - *What it is not:* a moment's text is the reader's own conversation text, already in the Personal package; a moment's
    analysis is the canonical K(TC), re-derived and never a copy. Neither is a second source to export.
  - *The read boundary to reuse:* the creator-exact reads `read_my_replay_v1`, `read_my_replay_version_v1` and
    `list_my_conversation_replays_v1`, or their definers in `replay_private`. Internal identities (manifest, selection,
    projection, render-contract rows, Conversation Units, Turns) stay out (W3-MEGA-S `:368`).
  - *Out of the Personal path:* everything in `QAN-BL-ACCT-03`'s class.
  - The ordering question (export before the user-facing opening, the WP0's D8) is the Product Owner's; S7-01 opens nothing
    to users.
- **Status:** `DEFERRED — OWNED`

Admitted under BG-06 / BG-08 at the Product Owner's explicit D5 designation (Stage 6 WP0 final decision addendum,
2026-10-13), after the anti-duplication check above, as a documentation-only governance change. Nothing here authorizes
implementation (BG-07).

### `QAN-BL-MATCH-04` — Understanding Readiness Before Real Matching

- **Title / Finding:** the Product Owner's non-negotiable rule is **no real Matching without QANDEEL's actual,
  authorized, correctable and reusable understanding of the user** (S6-01 Intelligence Reality Check §0, 2026-10-09).
  Understanding must be real, evidenced, revisable, available across relevant time and context, and able to change both
  the onboarding questions and future proposal evaluation. Repository truth does not meet it yet, and no register item
  owns the gap:
  - **natural acquisition.** On the latest CI-01 evidence (`scripts/ci-01/results/023f68e4….json`, MEM-AR-01 01C),
    natural statements are not captured (N1 capture 0 / 4; K1 4 / 6). Only anchored first-person patterns become Memory;
  - **current, correctable understanding.** A natural reversal is not captured, and the stale item is still served
    (C1 stale served 2 / 3). An explicit correction works, and duplicates no longer survive it (C1 duplicates 0);
  - **meaningful cross-session retrieval.** Recall is lexical (K1 recall 2 / 4; N1 1 / 2);
  - **real-model behaviour.** No run has used a real, authorized model: every intelligence proof uses deterministic
    doubles;
  - **adequacy before eligibility.** Nothing decides whether QANDEEL understands a person well enough to make them
    eligible for real proposals;
  - **HIM.** HIM is organically empty (H1). Its permissible advisory contribution to Matching (for example adapting the
    conversation's style, with consent) was never reviewed. It must never become an eligibility criterion or a profile
    fact (the Product Owner's historical return gate item CI-05, kept conditional).
  What is proven: truth integrity, forgetting, subject identity (`SELF` / `OTHER`) and isolation. S6-01 delivers
  deterministic preparation and a consent-gated, item-by-item confirmation of the owner's own `SELF` Memory. It does not
  deliver understanding, and its preparation is never eligibility.
- **Source:** the S6-01 Intelligence Reality Check (2026-10-09) §0; the Product Owner's S6-01 Final Implementation
  Authorization (2026-10-13), D7 ("admit `QAN-BL-MATCH-04` after a focused anti-duplication check"); the
  [S6-01 record](e2e/QANDEEL_S6_01_INTELLIGENT_MATCHING_ONBOARDING_IMPLEMENTATION_RECORD_v1.md) §0 and §9; the
  [CW2-06A amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06A_MATCHING_ONBOARDING_PREPARATION_ASSISTANCE_CONTROLLED_AMENDMENT_v1.0.md)
  §1 and §8; the CI-01 results named above. The Product Owner's local roadmap notes of 2026-10-09 / 10 (the "return
  gate", CI-02 … CI-05) are context, not repository authority (WP0 record §6).
- **Anti-duplication:** checked against all 67 earlier IDs, every tombstone, the §7 paragraphs and the §9 rows.
  - `QAN-BL-MATCH-03` is the Safe Compatibility Conclusion producer only. It stays separate and unchanged.
  - `QAN-BL-CTX-01` is relevance to the current conversation, not acquisition, truth maintenance or adequacy.
  - `QAN-BL-INTEL-02` is ledger retention after forgetting; `QAN-BL-INTEL-03` is Hypothesis semantic support.
  - `QAN-BL-IP-02` and `QAN-BL-ACE-02` validate reply behaviour, not understanding.
  - `QAN-BL-CW-05` is Shared semantic-place sourcing.
  - The ID was unused in the tree, in the history of every ref, and in GitHub issues and PRs.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` (D7).
- **Severity:** `HIGH`. Real Matching cannot begin without it, and a weak substitute would present a person as
  understood or eligible when they are not.
- **Reopen condition:** automatic when Stage 8A starts; and before any task makes a person eligible for real Matching
  proposals.
- **Required future property:**
  1. Understanding is acquired from the user's own natural conversation, stays current and correctable (a reversal or
     correction governs every derivative), and is retrievable by meaning across sessions, within the existing Personal
     Core: no separate Matching intelligence engine.
  2. Real-model behaviour is verified with an authorized model on a synthetic corpus before it is relied on.
  3. An explicit adequacy condition must hold before a person becomes eligible for real proposals. Deterministic
     preparation never satisfies it alone.
  4. HIM's contribution, if any, is advisory, consented and reviewed. It is never an eligibility criterion, a profile
     fact or evidence of anyone's intent.
  5. Hypotheses stay hypotheses, information about other people never becomes the user's own, and every read for
     Matching is purpose-authorized (CW2-06 §7; CW2-06A §3).
- **Not in this item:** the compatibility conclusion (`QAN-BL-MATCH-03`); proposals, evaluation and the pair predicate
  (S6-03); enrollment (`QAN-BL-MATCH-01`); deletion (`QAN-BL-ACCT-01`).
- **Status:** `DEFERRED — OWNED`

Admitted under BG-06 / BG-08 by S6-01 at its CP1 (2026-10-13), at the Product Owner's D7 approval, after the
anti-duplication check above. Nothing here authorizes implementation (BG-07).

---

### `QAN-BL-MATCH-05` — The Confirmed Introduction First Name Is Not the Canonical Matching First-Name Source

> **Historical pre-closure schema.** This block records the item as admitted by S6-02. It is not the current lifecycle
> state; the current state is the `CLOSED — TOMBSTONE` record in §6 below (S6-03).

- **Title / Finding:** the person's separately confirmed Introduction First Name exists only in the S6-01 preparation
  draft (`introductions_preparation_private.declared_facts`: `first_name`, `first_name_state`, `first_name_confirmed_at`;
  migration `0154`). The canonical Matching first-name source the proposal views read,
  `resolve_matching_canonical_first_name_v1` (`0111`), still answers `UNRESOLVED_NO_CANONICAL_SOURCE` for everybody, so
  no recipient view and therefore no Match handoff (`matching_match_handoff_subjects.presented_first_name`, `0113` /
  `0114`) can carry a confirmed first name. S6-02 projects that handoff name and answers `NULL` without it.
- **Source:** the S6-02 Task Contract v1.1 / v1.2, decision D2 (Product Owner, 2026-10-15): "S6-03 owns wiring the
  confirmed first name of `0154` into `0111`'s canonical resolver and proving the source's authority"; the Product
  Owner's implementation authorization (2026-10-15): record this obligation under S6-03 at S6-02's closure without
  opening a new task. Frozen authority: [P1](qandeel-p1-user-identity-preferences-understanding-canonical-closure.md)
  §4 and §13 (the Introduction First Name is self-authored, separately confirmed and never split from the account Name);
  CW2-06 §12; GATE-12.
- **Current truth:** latent. No proposal, Match or Introduction World can exist (the six `0149` commands stay closed; the
  CW2-08 seams answer `NOT_EVALUATED`). `0154` exposes the draft to its owner only; nothing reads it as a Matching
  source. S6-02 neither reads the draft nor changes `0111`
  ([S6-02 record](e2e/QANDEEL_S6_02_IMPLEMENTATION_RECORD_v1.md)).
- **Anti-duplication:** checked against all 68 earlier IDs, every tombstone, the §7 paragraphs and the §9 rows, the WP0
  record (its J03 / J06 rows name the first name only as S6-03 planning scope, not as a register item), the S6-01 record,
  the E2E gap matrix and the open GitHub issues. `QAN-BL-MATCH-01` is enrollment; `QAN-BL-MATCH-03` is the compatibility
  conclusion; `QAN-BL-MATCH-04` is understanding readiness; `QAN-BL-PRIV-04` is export. None carries the first-name source.
  The ID had not been used.
- **Why deferred:** it belongs to the proposal pipeline that makes recipient views exist at all, which is S6-03's; S6-02
  is the privacy fence, and its contract forbids it to fix `0111` or to copy draft data into a Shared World.
- **Owner task:** `S6-03 — Matching Proposal Pipeline & Intelligence Prerequisites` (the Product Owner's approved Stage 6
  task map, 2026-10-13; the assignment is the Product Owner's D2).
- **Severity:** `HIGH`. Without it no Introduction can present an approved first name, and a weak substitute (the
  account Name, or an unconfirmed draft value) would break P1 §13.
- **Reopen condition:** automatic at S6-03's kickoff; and before any task makes a proposal presentable.
- **Required future property:** the canonical resolver answers only the owner's CONFIRMED Introduction First Name (never
  `users.name`, never a split of it, never a `DECLARED` or `CORRECTED`-but-unconfirmed value), at the moment of
  presentation, with its authority proven; a later correction never rewrites a handoff already presented; the S6-02
  projection keeps reading the handoff only.
- **Not in this item:** the S6-02 projection and fences (delivered, `QAN-BL-MATCH-02` tombstone); the Introduction
  surfaces that show the name (S6-05); `FULL_NAME` display consent (S6-06).
- **Status:** `DEFERRED — OWNED`

Admitted under BG-06 / BG-08 by S6-02 at its closing change (2026-10-15), at the Product Owner's D2 assignment and
implementation authorization, after the anti-duplication check above. Nothing here authorizes implementation (BG-07).

---

### `QAN-BL-MATCH-06` — No Runtime Producer Forwards a First-Approved Proposal to the Second Recipient

> **Historical pre-closure schema.** This block records the item as it stood before S6-07's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-MATCH-06` in §6 (S6-07 CP4).

- **Title / Finding:** after the first recipient approves forwarding (S6-04, `FIRST_FORWARD_APPROVED`), the proposal reaches
  the second recipient only through `forward_matching_proposal_to_second_core_v1` (`0112:560`, redefined `0120:690`),
  which materializes the candidate's view and moves the proposal to `FORWARDED_TO_SECOND`. That core is executable by
  nobody and nothing calls it: no producer, orchestrator, sweeper or boundary runs the step. So no real proposal can ever
  be offered to a second recipient, and the second recipient's acceptance (S6-05, migration `0159`) can be exercised only
  on synthetic fixtures that call the core as the owner.
- **Source:** the [S6-05 record](e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md) §1 (CP0, gap G-1, 2026-10-15) and §7; the
  Product Owner's ruling R-4 (2026-10-15): owner S6-07, severity `HIGH`, after a duplication check. Frozen authority:
  CW2-06 §16 and §35 (the second recipient receives an independent proposal only after the first party's forward
  approval); I-07 §21 – §22.
- **Current truth:** latent. No proposal can exist in production (no enrollment, policy or producer; the CW2-08 seams
  answer `NOT_EVALUATED`), so nothing waits to be forwarded. The verifiers bring a proposal to `FORWARDED_TO_SECOND` by
  calling the core directly as the owner (`matching-match-verifier-support.mjs`).
- **Anti-duplication:** checked against all 69 earlier IDs, every tombstone, the §7 paragraphs and the §9 rows.
  `QAN-BL-MATCH-01` is enrollment, correction and resume; `QAN-BL-MATCH-03` is the compatibility conclusion producer;
  `QAN-BL-MATCH-04` is understanding readiness; `QAN-BL-PRIV-04` is export. S6-04's BG-06 line names "notifications for
  a delivered proposal (S6-07)", which is the notification only, not the step that delivers. The ID was unused in the
  tree and in the history of every ref.
- **Why deferred:** S6-05's contract owns the second recipient's acceptance, the Mutual Match and the Introduction World,
  not the Matching runtime that delivers proposals; building the producer there would widen it past its contract.
- **Owner task:** `S6-07 — Activity, Direct Entry and Final Integration` (the Product Owner's R-4, 2026-10-15).
- **Severity:** `HIGH`. Without it the Mutual Match can never happen for real users, however complete every surface is.
- **Reopen condition:** automatic at S6-07's kickoff (BG-05); and before any task takes Matching toward real users.
- **Required future property:** the step runs only for a proposal in `FIRST_FORWARD_APPROVED` whose binding to the
  first recipient's exact approved view is still current, through the existing core and its one writer, under the same
  revalidation and launch seam, idempotently, and never as a human's decision; it reveals nothing to either human beyond
  the neutral projection; it composes with the S6-07 notifications rather than duplicating them.
- **Not in this item:** the acceptance and the Introduction World (S6-05); the notifications themselves and Direct Entry
  (S6-07's own scope); the conclusion producer (`QAN-BL-MATCH-03`); launch clearance and policies (Stage 9 / CW2-08).
- **Status:** `DEFERRED — OWNED`

**S6-07 CP2 note (2026-10-18; the S6-07 pull request, not merged).** Under the Product Owner's Q5′ and CA-SYS-02
(«S6-07 — CP1 CLOSED / Start CP2»), migration `0166` delivers the producer this item asked for: ONE `service_role`
dispatcher, `server_forward_approved_matching_proposals_v1`, the only caller of the frozen forward core, for a proposal in
`FIRST_FORWARD_APPROVED` whose first-recipient approval is still bound to their current exact view, through the existing
core and its one writer, under the same revalidation and launch seam, idempotently (the ids are minted once in its
ledger), and never as a human's decision; it reveals nothing beyond the neutral projection. It is dormant: the CW2-08 seam
answers `NOT_EVALUATED`, so nothing is forwarded in production (`verify-migration-0166`, `prove-0166`). The item is
**not** tombstoned at CP2: its required property "composes with the S6-07 notifications" is CP3's, and it is dispositioned
at S6-07's closing change, under BG-08 ([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §10,
[I-07 runtime §50](matching-introduction-runtime-v1.md)). Owner, severity and status unchanged.

**S6-07 CP3 note (2026-10-18; the S6-07 pull request, not merged).** The last required property, "composes with the S6-07
notifications", is delivered by migration `0167` and the Introductions Activity producer bound as the dispatcher's
notifier: a committed delivery is told to its recipient once, re-read at publish time, recovered after a crash, at L0
([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §11). Still dispositioned at S6-07's closing change; owner,
severity and status unchanged.

Admitted under BG-06 / BG-08 by S6-05 at CP2 (2026-10-16), at the Product Owner's R-4 decision, after the
anti-duplication check above. Nothing here authorizes implementation (BG-07).

### `QAN-BL-LAUNCH-05` — Introduction Photos on iOS: Device Cache Proof and Store Review of the Purpose Strings

Admitted under BG-06 / BG-08 by S6-06 at its closing change (2026-10-17): validation explicitly carried forward that no
task in this repository can perform. Nothing here authorizes implementation (BG-07).

- **Title / Finding:** S6-06 (CP2) proved on an Android emulator that no Introduction photo byte remains in the app's
  private storage after the photo flows (the picker's copy deleted, renditions drawn from memory with expo-image's cache
  off) and that the build requests no camera, microphone, storage or media permission. The same proof on **iOS** — no image
  file in `Library/Caches` or `tmp` after the flows (expo-image-picker's `ImagePicker` directory, and the Caches root
  when the caches path ends in "/") — needs an iOS simulator or device run that this Windows host cannot make; Mobile CI
  builds and boot-smokes iOS but runs no photo flow. And the iOS build removes the camera and microphone purpose strings
  (`cameraPermission` / `microphonePermission: false`) while keeping the app's own Photos purpose string (PD-83, Arabic
  and English): whether App Store review accepts that binary without ITMS-90683 is known only at a store submission.
- **Source:** [S6-06 implementation record](e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md) §11.5, §13.2 and §16; WP0 v1.1
  §5 (the iOS Simulator cache proof) and correction 4 (ITMS-90683), approved by the Product Owner on 2026-10-16.
- **Anti-duplication:** `QAN-BL-LAUNCH-04` is the physical-Android Living Analysis stability proof; `QAN-BL-NOTIF-05`
  the native-Push device gates; `QAN-BL-CI-01` the iOS simulator Maestro driver; `QAN-BL-PROD-08` the hosted object
  store. None carries the iOS photo-cache proof or the store review of the purpose strings. The ID `QAN-BL-LAUNCH-05` was
  unused.
- **Why deferred:** it needs a macOS host with the iOS simulator (or an iPhone) and an App Store Connect submission, which
  no task has had; in production photos are closed by CW2-08 in any case.
- **Owner task:** `Stage 9 — Economy + Launch Closure (release-readiness gate)`. An earlier validation owner may take it when a macOS host or an iPhone becomes available; that
  change is recorded here as a re-owning, never made silently.
- **Severity:** `MEDIUM`. A photo file left on an iPhone would break the Product Owner's no-retention rule for the most
  sensitive Introduction material; a rejected binary would delay the release, not expose data.
- **Reopen condition:** automatic before photos are offered to any real user on iOS, or before the first App Store
  submission that carries expo-image-picker.
- **Required future property:** after the S6-06 photo flows on iOS (choose, upload, preview two stages, draw the other
  person's photo), no JPEG / PNG / WebP / HEIC file under the app's container (`Library/Caches`, `tmp`, `Documents`),
  proven by a file scan and not by a listing alone; Info.plist with PD-83 and no camera, microphone or add-to-library key,
  accepted by App Store review without ITMS-90683.

### `QAN-BL-ACCT-02` — Replay Has No Account-Deletion Module: an Account's Replay Footprint Blocks Its Erasure

> **Historical pre-closure schema.** This block records the item as it stood before S7-01's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-ACCT-02` in §6 (S7-01).

Admitted under BG-06 / BG-08 by ACCT-DEL-01 at its closing change (2026-10-17; PR #345, not merged; effective from its
merge), at the Product Owner's P-1 designation (Replay's account deletion belongs to Stage 7). Nothing here authorizes
implementation (BG-07).

- **Title / Finding:** three I-06 Replay relations reference the account `ON DELETE RESTRICT`:
  - `replays.created_by_user_id` (`0100`);
  - `replay_distribution_required_approvers.approver_user_id` and
    `replay_distribution_authorizations.authorized_by_user_id` (`0104`).

  `replay_source_manifest_versions` / `_items` (`0100`) hang from `replays`. No erasure module covers any of them. The governed account erasure (`0164`) registers them as residue class `REPLAY`,
  uncovered. An account with any Replay row answers a truthful, recorded `BLOCKED (REPLAY)` and nothing is erased; it is
  re-armed with a fresh grace when the class is covered.
- **Source:** the Product Owner's P-1 (ACCT-DEL-01, 2026-10-17); the
  [ACCT-DEL-01 record](e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md) §6 and §8;
  `account_erasure_private.residue_class_coverage` (`0164`, owner `Stage 7 - Replay`). Before this admission the
  residue was part of `QAN-BL-ACCT-01`'s finding (Replay is one of the Connected Worlds it names).
- **Anti-duplication:** `QAN-BL-ACCT-01` keeps Shared `STANDARD` and Public (`ACCT-DEL-02`); `QAN-BL-PRIV-05` is the
  Replay export, not its deletion; GATE-35 keeps Introduction material out of user-facing Replay. No other item carries
  Replay's account deletion. The ID `QAN-BL-ACCT-02` was unused in the tree and in the history of every ref.
- **Current truth:** no API route or mobile surface calls a Replay function, and Replay stays closed until Stage 7, so
  no product path creates a Replay row today. Nothing is deployed.
- **Why deferred:** Replay's product contract, its retention and its distribution semantics are Stage 7's. A deletion
  module cannot be designed before them without inventing them.
- **Owner task:** `Stage 7 — Replay`.
- **Severity:** `HIGH`. If reopened, it decides whether Replay may launch (W3-PDG-01 closure §8.4 item 9), and it lands
  on the CW2-08 §2 deleted-content non-serving law.
- **Reopen condition:** automatic at Stage 7's kickoff (BG-05); and before any path, Product or server, creates a Replay
  row for a real account.
- **Required future property:** Stage 7 delivers Replay's erasure module in the same change as its first user-reachable
  Replay relation. That change also:
  - registers every Replay relation in `account_erasure_private.coverage_registry`;
  - covers `REPLAY` in `residue_class_coverage`;
  - proves on real PostgreSQL the same properties `verify-migration-0164` proves: one transaction or nothing, the lock
    order with no deadlock, a truthful `BLOCKED`, and the re-arm.

  The other participants' rights in a shared Replay are Stage 7's Product decision. Replay is not production-ready for
  users while this item is open.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-ACCT-03` — Account Erasure Outside the Personal Replay: Non-Personal Replay Sources and Replay Distribution

Admitted under BG-06 / BG-08 by S7-01 at its closing change (2026-10-19; not merged; effective from its merge). Nothing
here authorizes implementation, a distribution path or a gate (BG-07).

- **Title / Finding:** S7-01's Replay erasure module (`account_erasure_private.erase_personal_replays_v1`, migration `0169`)
  erases exactly the Personal Replay footprint: the caller's own Replays of their own `MY_WORLD` text conversations, every
  draft, version, sealed projection, render-contract binding and lifecycle event, and the S7-01 launch evidence. It cannot
  erase what belongs to someone else or to a distribution:
  - a row in `replay_distribution_required_approvers` / `replay_distribution_authorizations` (`0104`) names another human's
    right over a package and references the account `ON DELETE RESTRICT`;
  - a Replay over a non-`MY_WORLD` manifest (the Introduction World, `GATE-35`), a package, a reconciliation command or a
    source-availability reconciliation event belongs to a distribution path or to another World.

  The governed erasure's census classifies each as the new residue class `REPLAY_OUTSIDE_PERSONAL` (not covered). An account
  with such a row answers a truthful, recorded `BLOCKED` and nothing is erased; it is re-armed with a fresh grace when the
  class is covered. Real-PostgreSQL proof: `verify-migration-0169` R03 / R04.
- **Source:** the S7-01 brief («C. QAN-BL-ACCT-02 … handle ON DELETE RESTRICT without overriding others' rights»); the
  [S7-01 record](e2e/QANDEEL_S7_01_IMPLEMENTATION_RECORD_v1.md) §6; `account_erasure_private.residue_class_coverage`
  (`0169`, owner text `QAN-BL-ACCT-03 - not opened: non-Personal Replay sources and Replay distribution`).
- **Anti-duplication:** `QAN-BL-ACCT-02` was the Personal Replay module, delivered by S7-01. `QAN-BL-ACCT-01` keeps Shared
  `STANDARD` and Public. `QAN-BL-PROD-09` is the hosted release gate. `QAN-BL-PRIV-05` is export, not deletion. The ID
  `QAN-BL-ACCT-03` was unused in the tree and in the history of every ref.
- **Current truth:** no product path can create any row of this class. No API route or mobile surface reaches a
  distribution, a package, an approver or a non-`MY_WORLD` source; CW2-08 answers `NOT_EVALUATED`; every I-06C / I-06D
  distribution command stays executable by no application role. Nothing is deployed.
- **Why deferred:** the other humans' rights in a distributed Replay, the package's retention after one participant's
  erasure, and the CW2-08 §2 deleted-content non-serving law at distribution are the distribution path's Product and
  launch decisions. Deciding them now would invent them.
- **Owner task:** `Stage 9 — Economy + Launch Closure (Replay distribution / CW2-08)`, where Replay distribution is
  sequenced (the Stage 7 WP0, approved; CW2-08).
- **Severity:** `HIGH`. If reopened, it decides whether a Replay may ever be distributed (W3-PDG-01 closure §8.4 item 9).
- **Reopen condition:** automatic when any task opens a Replay distribution, package, approver or non-`MY_WORLD` source
  path (BG-05); before CW2-08 answers anything but `NOT_EVALUATED`.
- **Required future property:** that change delivers the erasure of its own footprint in the same change, registers every
  relation it adds, covers `REPLAY_OUTSIDE_PERSONAL`, and proves on real PostgreSQL what `verify-migration-0164` and
  `-0169` prove, without deleting a right another human holds.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-PROD-09` — No World Opens in Production Without an Automated Account-Deletion Coverage Check

Admitted under BG-06 / BG-08 by ACCT-DEL-01 at its closing change (2026-10-17; PR #345, not merged; effective from its
merge), at the Product Owner's direction at the CP1 approval (a mandatory condition of `HOSTED-DEPLOY-01`). Nothing here
authorizes implementation, a deployment or a gate (BG-07).

- **Title / Finding:** P-1 requires a release gate: no World launches without a complete, proven account-deletion path.
  ACCT-DEL-01 enforces it **only in the repository**:
  - the coverage census in CI (`verify-migration-0164` A04 / A05 and the static contract) refuses any relation that
    references the account but has no registered class;
  - `server_read_account_erasure_coverage_v1` (`service_role` only) reads each residue class, whether a module covers it,
    and its owner;
  - `QAN-BL-ACCT-01` and `QAN-BL-ACCT-02` stay open.

  None of these is an executable block on a production deployment or on a launch capability. The Shared launch
  capability has no notion of an environment, and six existing verifiers enable it, so ACCT-DEL-01 deliberately added no
  runtime block. Nothing may claim the coverage check stops a deployment.
- **Also part of a proven path on the hosted project:**
  - the erasure's bound there: the `service_role` `statement_timeout` against the API's 60 s erasure bound;
  - the 42 account columns that have no leading index and belong to other owners' relations (Personal, Public, Shared
    `STANDARD`). Each is a scan inside the erasure's final `DELETE` at production scale.

  The maximum Matching / Introductions footprint erases in 198 ms locally.
- **Source:** the Product Owner's P-1 and the CP1 approval (2026-10-17); the
  [ACCT-DEL-01 record](e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md) §3, §6 and §8; W3-PDG-01 closure §8.4
  item 9.
- **Anti-duplication:** `QAN-BL-ACCT-01` and `QAN-BL-ACCT-02` are the missing modules, not the gate that holds the
  worlds closed until they exist. `QAN-BL-PROD-06` is the Data API retry gate. `QAN-BL-PROD-08` is the photo object
  store. CW2-08 is the Product launch law. None requires an automated coverage check at the deployment that opens a
  World. The ID `QAN-BL-PROD-09` was unused in the tree and in the history of every ref.
- **Why deferred:** it is a hosted deployment and launch procedure. Nothing is deployed (the hosted database stops at
  `0074`), and opening any World needs the Product Owner's separate approval.
- **Owner task:** `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate`. A later launch task
  (Stage 9) that opens a World inherits the same check; it does not replace it.
- **Severity:** `HIGH`. Without it, a World could open in production with an account-deletion path that answers
  `BLOCKED` for every participant.
- **Reopen condition:** automatic at `HOSTED-DEPLOY-01`'s kickoff (BG-05), and before any deployment or configuration
  change that opens a World (a launch capability, a CW2-08 gate) to real users.
- **Required future property:** before a World opens in production, an automated, fail-closed check runs against the
  hosted project itself, and the opening is refused unless all of these hold:
  - every residue class that World can create is covered (`server_read_account_erasure_coverage_v1` or its successor);
  - the hosted catalog has no relation that references the account and is missing from the coverage registry;
  - the erasure has been measured within its bound at production-shaped scale.

  The evidence is read on the hosted project, never inferred from a CI run or from this repository. Matching /
  Introductions (covered by ACCT-DEL-01) still opens only under CW2-08 and the Product Owner's approval.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-PROD-10` — A Photo Object Lost From the Private Store Blocks Its Owner's Export Bundle

Admitted under BG-06 / BG-08 by S6-07 at its closing change (CP4, 2026-10-18; PR #346, not merged; effective from its
merge), as the residue the Product Owner's approved CP0 review addendum (§9.9) designated for admission at CP4. Nothing
here authorizes implementation, a deployment or a repair procedure (BG-07).

- **Title / Finding:** Export My Data's bundle (`GET /account/privacy/export/download/bundle` and its per-photo file
  route) answers `503` - never a partial package - when the private object store has no object for a photo rendition
  whose key the database still holds. That is the honest answer to an integrity defect, and it is visible
  (`PRIVACY_EXPORT` / `bundle` or `bundle_file` / `integrity_failure`). But it blocks that reader's export of every
  photo, and of the package through the bundle, until the object or the key is repaired. The package-only route still
  answers.
- **Source:** the S6-07 CP0 review addendum §9.6 and §9.9 (approved 2026-10-18); the [S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12.8.
- **Current truth:** latent. Nothing is deployed, the hosted object store is not provisioned (`QAN-BL-PROD-08`), and no
  photo can exist in production (every launch gate and CW2-08 stay closed). The erasure worker and its listing
  reconciliation (S6-06) keep database and store agreeing in the other direction.
- **Anti-duplication:** checked against all 74 earlier IDs and the history of every ref. `QAN-BL-PROD-08` provisions the
  hosted store and proves its conformance; it does not say what happens when an object is lost. `QAN-BL-PRIV-04` (closed
  by S6-07) delivered the export, and `QAN-BL-PROD-05` is the stored package's size. The ID was unused.
- **Why deferred:** an operational integrity procedure on the hosted project (detect, alert, repair or retire the key),
  which needs the hosted store and its operations to exist.
- **Owner task:** `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` (the owner of the hosted
  object store, `QAN-BL-PROD-08`).
- **Severity:** `MEDIUM`. No data is exposed or invented; a reader is blocked from exporting their photos until repair.
- **Reopen condition:** automatic at `HOSTED-DEPLOY-01`'s kickoff (BG-05), and on the first
  `PRIVACY_EXPORT` / `bundle*` / `integrity_failure` outcome observed anywhere.
- **Required future property:** a lost photo object is detected and repaired (or its rendition retired through the
  governed path, so it is no longer the reader's to download) within a stated bound, with the reader's export never
  answered partially and never claiming a photo it cannot deliver.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-LAUNCH-06` — Export My Data's Photo Folder Save on iOS, Physical Android Devices and Read-Only Places

Admitted under BG-06 / BG-08 by S6-07 at its closing change (CP4, 2026-10-18; PR #346, not merged; effective from its
merge): the device-save proofs the Product Owner's approved CP0 review addendum (§10.5, §10.6) named for CP4, beyond what
an emulator can prove. Nothing here authorizes implementation (BG-07).

- **Title / Finding:** with the reader's own photos, the app saves the export as one folder in the place the reader picks
  (the photo files first, each checked on disk, the server's manifest next, the package last; the folder removed on any
  failure). S6-07 proved it in Jest over a stood-in file system and on an Android emulator through the real Storage
  Access Framework picker ([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12.6). Not proven: iOS (the security-scoped folder and its children), a physical
  Android device, a read-only or offline provider (Google Drive offline, a USB stick) refusing the folder, and a
  rollback that itself fails (it leaves a folder WITHOUT the package - visibly incomplete, never a package that lists
  files it does not hold).
- **Source:** the S6-07 CP0 review addendum §10.5 / §10.6 (approved 2026-10-18); the [S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12.6 and §12.8.
- **Current truth:** nothing is launched; every gate stays closed, so no reader can have an Introductions photo to
  export.
- **Anti-duplication:** checked against all 75 earlier IDs and the history of every ref. `QAN-BL-LAUNCH-05` is the iOS
  photo CACHE and the store review of the purpose strings, not the export folder. `QAN-BL-LAUNCH-04` is a Living
  Analysis interaction proof. The ID was unused.
- **Why deferred:** physical iOS / Android devices and the store builds are Stage 9's release-readiness gate.
- **Owner task:** `Stage 9 — Economy + Launch Closure (release-readiness gate)`.
- **Severity:** `MEDIUM`. A platform difference would make an export fail loudly (`FAILED`, the existing sentence) -
  never silently thinner - but a reader could be unable to save their photos on that platform.
- **Reopen condition:** automatic at Stage 9's kickoff (BG-05), and before Introductions are offered on iOS or to real
  Android users.
- **Required future property:** on iOS and on a physical Android device, an export with photos saves whole into the
  picked place (every listed file present with its length, the package last), a refused place answers `FAILED` with
  nothing written, and a failed rollback leaves no folder that holds the package.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-RSP-03` — Arabic Global Switcher Destination Words Truncated at the Default Text Size on a Physical Phone

Admitted under BG-06 / BG-08 by S7-05 at its closing change (2026-10-20; PR #351, not merged; effective from its merge).
It was found independently during the S7-05 real-device proof and is not Replay code. Nothing here authorizes
implementation (BG-07).

- **Title / Finding:** on the Product Owner's HONOR ALI-NX1 (Android 15, 1200 × 2652 at 520 dpi), at font scale 1.0 with
  the app in Arabic, the three destination words of the bottom Global Switcher
  (`apps/mobile/src/shared-world/GlobalSwitcher.tsx`: one third of the width each, the word under its glyph,
  `numberOfLines={1}`) draw truncated: «قند…», «العالم المش…», «لعالم ال..». A cell is about 400 px wide, so even the
  short word «قنديل» should fit; the cause (the Arabic face's text measurement on Android, the cell's padding or
  something else) is not diagnosed. The accessible names (`accessibilityLabel`) carry the whole word. Seen in the S7-05
  proof build, which renders the production `RuntimePhaseSurface` and this same switcher; not checked in English, at
  other scales or on other devices.
- **Source:** [S7-05 record](e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md) §7.5 (the device screenshot is kept outside the repository, with the S7-05 evidence).
- **Why deferred:** it is outside S7-05's scope — the switcher is S4-01 / S5-01 chrome, not Replay (AGENTS.md §3) — and
  it violates no S7-05 contract (BG-01); its cause is not yet diagnosed.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH` — as `QAN-BL-RSP-02` (a clipped label): the primary navigation words of the Arabic-first Product
  are not readable whole at the default text size (release quality).
- **Reopen condition:** a task contract claims it. Its proof: the three destination words drawn whole, in Arabic and in
  English, at 100 %, 130 % and 200 % on a physical Android phone of this width class, with the accessible names unchanged.
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-AI-01` — DeepSeek Real-User Enablement: Data Terms, Disclosure, Consent, Policy, In-App Report, Pseudonymous Identifier and Output Moderation

Admitted under BG-06 / BG-08 by S8A-01 at CP2 (2026-10-21; the S8A-01 pull request, not merged; effective from its merge),
at the Product Owner's CP0 decision 5. Nothing here authorizes implementation (BG-07).

- **Title / Finding:** S8A-01 binds DeepSeek as QANDEEL's reply provider for **synthetic qualification only**. The router
  refuses to start in production or outside `DEEPSEEK_QUALIFICATION_MODE=SYNTHETIC_ONLY`
  (`apps/api/src/model-router/providers/deepseek/deepseek-model-router.config.ts`). Before any real user's conversation,
  Memory or HIM context may reach DeepSeek, all of these are required, and none exists:
  1. a reviewed decision on DeepSeek's data terms (storage and processing location, retention, use for training, the
     absence of a data-processing agreement), which the Product Owner accepts or rejects for QANDEEL;
  2. an in-app disclosure that QANDEEL's replies are produced by a third-party model provider, and what is sent to it;
  3. the user's consent where the reviewed terms require it, recorded and revocable;
  4. the privacy-policy text that names the provider and the data shared;
  5. an in-app way to report a reply, and an operational follow-up for reports;
  6. if an end-user identifier is ever sent for abuse monitoring, a pseudonymous one that is not the account id;
  7. output content moderation evidenced at the level the Product Owner requires. S8A-01's release guard is structural
     (empty, unreadable, internal container, guidance echo), not a harmful-content classifier, and the input Safety Gate
     is not trusted as one without evidence (CP0 decision 4).
- **Source:** [S8A-01 record](e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §5, §6; the
  Product Owner's CP0 decisions 4, 5 and 7 (2026-10-21).
- **Why deferred:** decision 5 records these requirements and their owner without implementing the compliance surfaces in
  S8A-01.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` (the S8A task that claims it; none is named yet).
- **Ownership split (the Product Owner, 2026-10-21):** Stage 8A owns the output protection (7), the DeepSeek provider
  disclosures (2, 4) and the core data-sharing requirements (1, 3, 6), and the in-app report (5) as their means. Stage 9
  keeps only the approval of the compliance surfaces and the final release requirements, inside its existing
  release-readiness gate; that is not a second item.
- **Severity:** `HIGH` — sending a real user's private conversation to a provider without disclosure and consent breaks
  the privacy contract.
- **Reopen condition:** a task contract claims it. It closes only on the seven items above, with the router's
  synthetic-only gate replaced by the reviewed real-user path in the same change.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-02` — The Background and Semantic Model Calls Are Still Bound to OpenAI and Gemini

Admitted under BG-06 / BG-08 by S8A-01 at CP2 (2026-10-21; the S8A-01 pull request, not merged; effective from its merge),
at the Product Owner's CP0 decision 3. Nothing here authorizes implementation (BG-07).

- **Title / Finding:** with `MODEL_PROVIDER=deepseek`, only the reply (`CONVERSATION_REPLY`) goes to DeepSeek. Seven
  adapters keep their own providers:
  - on OpenAI Responses: Focus Resolution, Thread Establishment, Thread Continuity and CU Segmentation (the Personal
    Phase-2 semantic chain, `apps/api/src/conversation/conversation.module.ts`) and Hypothesis intent extraction;
  - on Gemini: Hypothesis candidate generation and evidence association.
  The Personal Phase-2 chain needs OpenAI: without it a turn whose reply has already finalized answers 503. "DeepSeek
  only" is therefore not true for QANDEEL, and S8A-01 does not claim it.
- **Source:** [S8A-01 record](e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §9; the
  Product Owner's CP0 decision 3 (2026-10-21: do not rebuild the seven adapters now; record the move within the right
  Stage 8A tasks).
- **Why deferred:** each adapter is a frozen, separately proven contract; moving it is its own Stage 8A work with its own
  evaluation, not part of binding the reply.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` (the S8A task that binds each adapter; none is
  named yet).
- **Severity:** `HIGH` — the Product direction is a single model provider; until this closes, real conversation still
  depends on two other providers' data terms and keys.
- **Reopen condition:** a Stage 8A task contract claims one or more adapters. Binding the intent or candidate provider to
  a real model also fires `QAN-BL-INTEL-02`'s reopen condition 4, which that task must read. The item closes when no
  production composition outside DeepSeek remains, proved by the AI-COST-01 transport census.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-03` — DeepSeek's Time-of-Day Pricing Cannot Be Represented by a Price Card

Admitted under BG-06 / BG-08 by S8A-01 at CP2 (2026-10-21; the S8A-01 pull request, not merged; effective from its merge).
Nothing here authorizes implementation (BG-07).

- **Title / Finding:** DeepSeek prices tokens differently by time of day (a peak and an off-peak rate). An AI-COST-01
  Price Card (migration `0135`) is one effective-dated, non-overlapping interval per provider, model, operation and usage
  kind, with no time-of-day dimension: a daily peak / off-peak rate would need new cards for every period of every day.
  S8A-01 registers no Price Card: DeepSeek calls settle `UNPRICED`, which is truthful but leaves their cost unrated.
- **Source:** [S8A-01 record](e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §4.
- **Why deferred:** rating and pricing belong to the economy work; S8A-01 only admits DeepSeek to the ledger.
- **Owner task:** `Stage 9 — Economy + Launch Closure (release-readiness gate)`
- **Severity:** `MEDIUM` — cost per successful outcome is a Stage 8A measure; the token quantities are recorded exactly,
  so a cost can be computed afterwards.
- **Reopen condition:** a task contract claims it: a reviewed rating rule for time-of-day prices (a schema change through
  a forward migration, or an explicit decision to rate at one period), then DeepSeek's reviewed Price Cards.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-04` — Shared and Public World DEEP Replies Keep the 10 s Budget Under DeepSeek

Admitted under BG-06 / BG-08 by S8A-01 in its closing change (2026-10-21; the S8A-01 pull request, not merged; effective
from its merge). Nothing here authorizes implementation (BG-07).

- **Title / Finding:** CP4 measured DeepSeek's DEEP path (thinking at `low`): one call ran past 10 s, and the calls that
  completed took 8.7–8.8 s. At about 143 tokens/s, a full 2048-token completion needs about 15 s. The Product Owner raised
  the Personal DEEP budget to 20 s, in the Orchestrator and the DeepSeek router only (controlled change, 2026-10-21).
  The Shared World and Public World reply inputs (`shared-conversation-model-input.ts`,
  `public-qandeel-model-input.ts`) set their own `latencyBudgetMs: DEEP 10000`. The router applies `min(request budget,
  20 s)`, so with `MODEL_PROVIDER=deepseek` a Shared or Public DEEP reply is still cut at 10 s and fails closed: no
  reply is saved.
- **Source:** [S8A-01 record](e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §8.5–§8.6; the Product Owner's DEEP decision (2026-10-21), which names the Orchestrator and the
  DeepSeek router.
- **Current truth:** no Shared or Public reply has run on DeepSeek. S8A-01 qualifies the Personal reply only, on
  synthetic data. The OpenAI and Anthropic routers keep their own 10 s ceilings, so their behaviour is the same at either
  budget.
- **Anti-duplication:** `QAN-BL-AI-02` moves the background and semantic adapters, not the reply budgets.
  `QAN-BL-ACE-02` scores reply behaviour, not latency.
- **Why deferred:** the Product Owner's decision limits the change to the Personal path. Shared and Public replies on
  DeepSeek belong to the Stage 8A work that qualifies those Worlds.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `MEDIUM` — a fail-closed timeout, not a wrong or unsafe reply; it blocks only DeepSeek qualification of
  Shared and Public DEEP replies.
- **Reopen condition:** before any Shared or Public World reply is qualified or enabled on DeepSeek. That decision sets
  their DEEP budget from a measurement, and pins it with tests.
- **Dated note (S8A-02 closing change, 2026-10-23; effective from its merge):** S8A-02 CP3 (Product Owner Final
  Correction Approval, 2026-10-22) raised the DeepSeek router's ceiling to 25 s, with Personal DEEP at 25 s and DEEP
  `max_tokens` 2800. The Shared and Public inputs still set `DEEP 10000`, so `min(request budget, 25 s)` still cuts them
  at 10 s. S8A-02 CP2's Shared attribution path keeps 10 000 ms in total on DEEP, reading included; it was not measured on
  DEEP. No change of state.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-05` — Complex Messages Routed FAST Rarely Complete Within the 3 s Budget Under DeepSeek

Admitted under BG-06 / BG-08 by S8A-02 at the Product Owner's review of its Round 2 evaluation (2026-10-21; the S8A-02
pull request, not yet opened; effective from its merge), as a Stage 8A item with no separate task. Nothing here
authorizes implementation (BG-07).

- **Title / Finding:** S8A-02 Round 2 declared six short complex decisions (for example a parent's dementia care, two job
  offers, leaving a stable job) once on FAST and once on DEEP with identical content, two repeats each. Production routing
  (`decideFastDeepRoute`) sends all six FAST. FAST completed **2 / 12**: ten attempts were aborted at the 3 s request
  budget (FAST: thinking disabled, `max_tokens` 1024). DEEP completed **12 / 12** (p50 8.7 s, max 11.7 s, about 1,120
  output tokens), with the better depth and usefulness in the blind review. In the two Round 2 guidance arms, 22 / 116
  FAST attempts were aborted at 3 s, and two cases produced no FAST reply in six attempts: a Personal everyday case and
  the Public World Safety `GUIDED` case, whose real-model behaviour is therefore unmeasured.
- **Source:** the S8A-02 Round 2 evaluation (brain-eval `golden-round2-paths` and `golden-round2`; DeepSeek Flash,
  synthetic data, the accounted AI-COST-01 path; 2026-10-21), recorded in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7; the Product Owner's Round 2 review
  (2026-10-21), item 4.
- **Current truth:** an aborted FAST reply fails closed: no partial reply is released and the person gets no answer. The
  routing policy, the FAST budget and `max_tokens` are unchanged; S8A-02 changes copy only. No real user reaches DeepSeek
  (`QAN-BL-AI-01`).
- **Anti-duplication:** `QAN-BL-AI-04` is the Shared / Public DEEP 10 s budget, not FAST. `QAN-BL-ACE-02` scores reply
  behaviour, not completion. This item is FAST completion and the path chosen for short complex messages.
- **Why deferred:** the Product Owner kept routing out of the S8A-02 copy correction and placed the gap in Stage 8A.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `HIGH` — on the path production chooses, many complex messages, and a Safety-guided Public reply, get no
  answer at all.
- **Reopen condition:** before `QAN-BL-AI-01` lets any real user reach DeepSeek, and before any change to the FAST budget,
  FAST `max_tokens` or the FAST / DEEP routing. The correction is a measured controlled change, proven with the brain-eval
  path pairs and pinned by tests.
- **Dated note (S8A-02 closing change, 2026-10-23; effective from its merge):** the "FAST budget unchanged" sentence above
  is no longer true for Personal. S8A-02 CP3 (Product Owner Final Correction Approval, 2026-10-22) set the Personal FAST
  budget to 10 s as a measured controlled change (Round 9: FAST 120 / 120 within 10 s, max 6.5 s, synthetic data). Shared
  and Public FAST stay 3 s, apart from S8A-02 CP2's 6 s total on a Shared tier 1 / 2 turn. The routing and FAST `max_tokens`
  1024 are unchanged. The Shared / Public FAST gap and the path chosen for short complex messages stay open. No change of
  state.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-06` — Two Shared World Participants With the Same Name Reach the Model as One Speaker

> **Historical pre-closure schema.** This block records the item as it stood before S8A-02's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-AI-06` in §6 (S8A-02).

Admitted under BG-06 / BG-08 by S8A-02 at the Product Owner's Shared Attribution Engineering Decision (2026-10-21,
D5; the S8A-02 pull request, not yet opened; effective from its merge), as a Stage 8A item with no separate task. Nothing
here authorizes implementation (BG-07).

- **Title / Finding:** the Shared model input labels every human message with its author's visible Name and nothing else.
  A Name is not unique (`0123`: only the Login ID is). Two different people with the same Name reach the model as the
  same bytes as one person with that Name saying both things, in production's merged representation and in the separated
  candidate alike, so the model cannot tell what each of them said.
- **Source:** the S8A-02 Shared attribution engineering check (2026-10-21) and its free proof,
  `apps/api/src/brain-eval/brain-eval.shared-attribution.spec.ts` (the identity hazards), recorded in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7; the Product Owner's Shared Attribution Engineering
  Decision (2026-10-21), D5.
- **Current truth:** the `0139` material read returns `author_name` and `is_self` and no per-author key, so the Shared
  assembler has nothing to tell two people apart. No identifier reaches the model, and none may (Product Owner,
  2026-10-21).
- **Impact on trust and attribution:** a fact, opinion, decision or correction of one person can be read, and repeated by
  QANDEEL, as the other's, and neither person can see why.
- **Controlled change it may need:** a server-side distinction between authors within one request, for example an opaque
  per-read author ordinal from a new version of the `0139` read, used only inside the server to derive the label the
  model sees (such as the Name with a stable ordinal), never an identifier. That changes a frozen RPC and adds
  model-visible text (copy); each needs its own Product Owner decision.
- **Anti-duplication:** `QAN-BL-AI-07` is people with no Name; `QAN-BL-AI-08` is the person an earlier QANDEEL reply
  answered. `QAN-BL-ACE-02` scores reply behaviour, not the identity carried by the input.
- **Why deferred:** the Product Owner did not authorize changing the frozen database functions now, and kept the risk in
  Stage 8A rather than ignoring it.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `HIGH` — information can be attributed to the wrong person in a Shared World, and nothing in the input
  can prevent it.
- **Reopen condition:** a condition of the Shared World readiness assessment. It is not closed without a fix or an
  explicit Product decision based on evidence, and it is decided before any real Shared conversation reaches a production
  model.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-07` — Shared World Participants Without a Name All Reach the Model as One "A participant"

> **Historical pre-closure schema.** This block records the item as it stood before S8A-02's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-AI-07` in §6 (S8A-02).

Admitted under BG-06 / BG-08 by S8A-02 at the Product Owner's Shared Attribution Engineering Decision (2026-10-21,
D5; the S8A-02 pull request, not yet opened; effective from its merge), as a Stage 8A item with no separate task. Nothing
here authorizes implementation (BG-07).

- **Title / Finding:** an account provisioned without a Name keeps `NULL` (`0123`), and the `0139` read returns
  `NULL` for it. The Shared assembler renders every such message as `A participant: …`, so two or more people without a
  Name reach the model as one speaker, in both representations.
- **Source:** the S8A-02 Shared attribution engineering check (2026-10-21) and its free proof,
  `apps/api/src/brain-eval/brain-eval.shared-attribution.spec.ts` (the identity hazards), recorded in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7; the Product Owner's Shared Attribution Engineering
  Decision (2026-10-21), D5.
- **Current truth:** `UNNAMED_PARTICIPANT` is one fixed label (S4-02). No identifier reaches the model, and none may.
- **Impact on trust and attribution:** what several unnamed people said is merged into one voice; counts, opinions and
  decisions can be attributed to the wrong person or to nobody.
- **Controlled change it may need:** the same server-side, per-request author distinction as `QAN-BL-AI-06` (for example
  "A participant 1", "A participant 2", derived inside the server and never an identifier), which changes a frozen RPC
  and adds copy; or a Product decision that a Shared World member always has a Name.
- **Anti-duplication:** `QAN-BL-AI-06` is people who share a Name; this item is people with none.
- **Why deferred:** the Product Owner did not authorize changing the frozen database functions now, and kept the risk in
  Stage 8A rather than ignoring it.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `HIGH` — several people's words reach the model as one person's.
- **Reopen condition:** a condition of the Shared World readiness assessment. It is not closed without a fix or an
  explicit Product decision based on evidence, and it is decided before any real Shared conversation reaches a production
  model.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-08` — QANDEEL's Earlier Shared Replies Reach the Model Without the Person They Answered

Admitted under BG-06 / BG-08 by S8A-02 at the Product Owner's Shared Attribution Engineering Decision (2026-10-21,
D5; the S8A-02 pull request, not yet opened; effective from its merge), as a Stage 8A item with no separate task. Nothing
here authorizes implementation (BG-07).

- **Title / Finding:** a QANDEEL reply in a Shared World answers one person's message. The server composes it for that
  message (the `0139` reply work is bound to its command), but the material read returns no reply-to link, so the model
  sees an earlier reply only by its position. In production's merged input it follows a block of several people. In the
  separated candidate it follows the last message before it, which is not necessarily the one it answered: another person
  can write in between.
- **Source:** the S8A-02 Shared attribution engineering check (2026-10-21) and its free proof,
  `apps/api/src/brain-eval/brain-eval.shared-attribution.spec.ts` (the identity hazards), recorded in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7; the Product Owner's Shared Attribution Engineering
  Decision (2026-10-21), D5.
- **Current truth:** an earlier QANDEEL reply is an `assistant` message with its text only. S8A-02 Round 3's language
  failures followed an English reply to one person that the model then continued for others.
- **Impact on trust and attribution:** an earlier answer, its language, or a commitment in it can be read as given to the
  wrong person.
- **Controlled change it may need:** a new version of the `0139` read exposing the reply-to link, rendered as
  model-visible attribution (copy). It changes a frozen RPC; it needs its own Product Owner decision.
- **Anti-duplication:** `QAN-BL-AI-06` / `QAN-BL-AI-07` are the authors of human messages; this item is the addressee of
  QANDEEL's own replies.
- **Why deferred:** the Product Owner did not authorize changing the frozen database functions now, and kept the risk in
  Stage 8A rather than ignoring it.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `HIGH` — QANDEEL's own earlier words can be attached to the wrong person.
- **Reopen condition:** a condition of the Shared World readiness assessment. It is not closed without a fix or an
  explicit Product decision based on evidence, and it is decided before any real Shared conversation reaches a production
  model.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-AI-09` — Text Inside One Participant's Shared Message Can Pose as Another Participant Speaking

> **Historical pre-closure schema.** This block records the item as it stood before S8A-02's closing change; it is not the
> current lifecycle state. The current state is the `CLOSED — TOMBSTONE` record of `QAN-BL-AI-09` in §6 (S8A-02).

Admitted under BG-06 / BG-08 by S8A-02 at the Product Owner's Shared Attribution Integrity decision (2026-10-21; the
S8A-02 pull request, not yet opened; effective from its merge), as a Stage 8A item with no separate task. Nothing here
authorizes implementation (BG-07).

- **Title / Finding:** the Shared model input marks who is speaking only by a `Name:` prefix at the start of a line, in
  production's merged representation and in the separated candidate alike. A person's message can carry a line of the same
  shape: a quotation of someone else, or a line written in someone else's Name. Merged, Sara writing «ماشي» and then a line
  «كريم: …» reaches the model as the same bytes as Sara writing «ماشي» and Karim writing that line himself.
- **Source:** S8A-02 Part T (2026-10-21; 60 paid DeepSeek attempts, synthetic only): the quoted-speaker conversation was
  read as Karim's own statement in this conversation in 3 of 3 separated replies and 1 of 3 merged replies; recorded in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7; the Product Owner's Shared Attribution Integrity decision (2026-10-21).
  The focused check of the server-sourced candidate (2026-10-21; 30 paid attempts) found:
  - the quotation was no longer read as Karim speaking (0 / 3, against 2 / 3 in production);
  - a «كريم:» line written inside Sara's message, after «ماشي», was still taken as Karim speaking in 2 / 3 candidate
    replies, so the finding persists with the sender stated in the input.
- **Current truth:** production sends the merged representation; no part of it tells a person's own words from a line
  inside their message that names someone else.
- **Impact on trust and attribution:** a report, quotation or fabrication by one participant can be presented by QANDEEL as
  another participant's own statement here, including a commitment such as agreeing to pay; one participant can put words
  in another's name.
- **Controlled change it may need:** a model input in which the server, not the text, states who sent each message (the
  S8A-02 server-sourced candidate), with model-visible copy explaining it; it needs the Product Owner's copy decision and
  paid evidence that the model tells a person's own statement from another person's report of it. Structure alone is not
  accepted as that evidence (Product Owner, 2026-10-21).
- **Anti-duplication:** `QAN-BL-AI-06` / `QAN-BL-AI-07` are authors the input cannot tell apart; `QAN-BL-AI-08` is the
  person an earlier QANDEEL reply answered; this item is text inside a message posing as a speaker.
- **Why deferred:** S8A-02 is studying the server-sourced candidate under the Product Owner's decision; no representation is
  adopted. That candidate fixes the quotation case in its focused check but not a line written in another person's name.
  The Product Owner kept this item HIGH (2026-10-21) and asked for a server-enforced design. The fail-closed attribution
  guard that was designed was declined. A final free review on independent cases found:
  - only verbatim quotations can be verified from server data (12 of 50 misattributions in scope);
  - paraphrase, negation, pronoun and inference cannot be verified without interpreting meaning.

  The item cannot close on a guarantee. It waits on the Product Owner's choice: evidence-based acceptance, a narrower
  Shared behaviour, or deferral.
- **Owner task:** `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`
- **Severity:** `HIGH` — proven wrong-person attribution in paid tests, and a way for one participant to speak in
  another's name.
- **Reopen condition:** a condition of the Shared World readiness assessment. It is not closed without a fix proven in the
  approved tests or an explicit Product decision based on evidence, and it is decided before any real Shared conversation
  reaches a production model.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-CI-03` — Android API 36 Emulator Boot Smoke: GitHub Runner Emulator Infrastructure (PO-WAIVED)

- **Title / Finding:** on Draft PR #358 (S8A-04 CP3), Mobile CI's `Android (API 36 emulator boot smoke)` failed on three
  heads: `3f6dcf72` (run `40213689273`), `064feab1` (run `40219860461`) and `80c2e527` (run `40264979205`). `Validation
  evidence (VAL-01)` failed with it on each.
  - The cause: the runner had too little free disk for the emulator's data partition. The pixel_7 default is 6144 MB,
    and the emulator demands about 1.2× that free.
  - `disk-size: 3072M` reached `config.ini`, but the emulator still demanded 7372.80 MB.
  - On `06de0f1b` (run `40269916729`) the same job passed. The failure is intermittent infrastructure, not the app.
- **Source:** the [S8A-04 CP3 Task Contract](e2e/QANDEEL_S8A_04_CP3_IMPLEMENTATION_TASK_CONTRACT_v1.md) §8 / §8.1; the
  Product Owner's decision of 2026-10-25 (option C).
- **Current truth:** **`PO-WAIVED: GITHUB_ANDROID_EMULATOR_INFRASTRUCTURE`** (the Product Owner, 2026-10-25).
  - The Product Owner stopped all Android CI fixes on PR #358.
  - On a head where this job fails, Mobile CI's Android evidence is recorded NOT GREEN for this reason alone.
  - The waiver is not merge approval. The merge still needs the Product Owner's explicit order, which must name the
    waiver against `AGENTS.md` §8 ("Do not merge a failing CI change") when that job is red on the head.
  - The Android Release APK build producer did not fail in any of these four runs.
- **Why deferred:** runner, emulator image and disk provisioning are infrastructure outside S8A-04's product scope, the
  same shape as `QAN-BL-CI-01` (iOS, S4-01). No product contract is left violated (BG-01).
- **Owner task:** `CI-ANDROID-01 — Android Emulator CI Infrastructure Reliability` (identifier the Product Owner's; the
  descriptive half is this closing change's).
- **Severity:** `MEDIUM`. If reopened, it decides whether Mobile CI's Android boot smoke is dependable evidence. It gates
  no product truth; physical-device validation stays separately owned (`QAN-BL-NOTIF-05`, `QAN-BL-LAUNCH-04`).
- **Reopen condition:** the next Android API 36 boot smoke that fails for runner disk or emulator provisioning on any
  head; or before any task that relies on that smoke as release evidence.
- **Required future properties:**
  - a diagnosed cause with evidence: runner disk, AVD data partition or image;
  - a bounded change under VAL-01;
  - no change that weakens what the smoke proves.
- **Status:** `DEFERRED — OWNED`

Admitted by `S8A-04` at its closing change under BG-08 / BG-06, as the Product Owner directed on 2026-10-25. It is not
part of S8A-04's scope, and nothing here authorizes implementation (BG-07).

## 6. Tombstones

### `QAN-BL-INTEL-01` — Personal Evidence Invalidation → Derived Understanding Re-evaluation (PG-02)

- **Closing task:** `INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02)`
- **PR / SHA:** `#326` / `995d5ae9bf2530ac8e655b870526e0976be7cbf4`
- **Disposition:** repository implementation completed with migration `0151`; hosted deployment remains a separate gate. No global forgotten-content erasure claim.

- **Title / Finding:** When a user forgets a Memory (`DELETED`) or stops relying on it (`DISABLED`) through the `0128`
  commands, that Memory stops counting as Evidence at read time — but the hypotheses, Confidence evaluations and
  Understanding items derived from it keep their statement, status and visibility and are still injected into later
  sessions. The derivative is *technically stored* without being *currently usable*, and nothing re-evaluates it. Confirmed
  on a synthetic harness (CI-01 C0 report §4.4, scenario F1): after forget / do-not-rely, the linked hypotheses stayed
  `ACTIVE` and reached a new session.
- **Source:** frozen I-08A4 §18 (`PG-02 — Personal Evidence Invalidation → Derived Understanding Propagation`); P1 closure
  §11 / §18 ("The Product must not pretend these gaps are implemented"); the
  [W3-MEGA-U record](e2e/QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md) §5; the
  [CI-01 C0 Decision Report](e2e/QANDEEL_CI_01_C0_DECISION_REPORT_v1.md) §4.2 (D4) and §4.4; the
  [Intelligence Evidence Baseline v1](intelligence-evidence-baseline-v1.md) §5.3 and §6. Admitted under the Product Owner's
  C1 decision 3 (2026-10-10), recorded in the [C1 Task Contract](e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) §0.1.
- **Anti-duplication:** a search of this register for `PG-02`, "invalidation", "propagation" and "re-evaluation" finds no
  item. `QAN-BL-CTX-01` is conversational relevance; `QAN-BL-PRIV-01` / `02` are export completeness; `QAN-BL-CW-02` is
  the Shared private-source lane; W3-MEGA-M closed its Memory-control findings inside its own task and did not admit PG-02.
  Until now PG-02 was named only in frozen records and in Current State as an open gap with no owner.
- **Why deferred:** CI-01 is a baseline task (D1, D5) that changes no runtime; the Product Owner decomposed the repair
  (D6) into bounded slices after C1. The correct behaviour is **re-evaluation according to the derivative's state and the
  remaining evidence — not automatic falsification and not silent reliance**; it must not invent a Confidence number
  (`CI-01-L5`), must strengthen forget rather than weaken it (`CI-01-L6`), and needs a Product decision on what the owner
  sees for an item pending re-evaluation. Any change to frozen Confidence or lifecycle semantics is a Controlled Change.
- **Owner task:** `INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02)` — the first C2 slice after CI-01 C1 (C1
  contract §12, item 1).
- **Severity:** `HIGH` — it touches the user's frozen authority over forget / do-not-rely and the truth of the Understanding
  surface.
- **Phased scope (documentation; authorizes nothing):** (1) take the invalidation signal from the existing `0128` effect
  ledger when a Memory leaves `ACTIVE`; (2) re-evaluate the derived hypotheses through the existing Confidence core and
  transition functions (`0006`, `0035`, `0036`), never inventing a score; (3) let the Understanding projection reflect a
  pending re-evaluation under Product-approved wording (Copy Gate); (4) accept against the CI-01 C1-B synthetic scenario
  F1 re-run; export and erasure paths unchanged.
- **Dependencies:** the frozen Confidence / lifecycle cores; the `0128` effect ledger; coexistence with the `0134` contest
  semantics (a contested item that also lost evidence has two independent reasons for MIXED); the CI-01 C1-B harness as
  the measurement; a Product decision on the owner-visible wording.
- **Reopen condition:** automatic when `INTEL-TM-01` opens; it MUST be opened before any production feature claims that
  forgetting a Memory removes its influence from QANDEEL's Understanding, and before Stage 8A benchmarks hypothesis
  quality on real LLMs over data that a user may have asked QANDEEL to forget.
- **Required future property:** evidence loss ≠ hypothesis false; re-evaluation per state and remaining evidence; no
  numeric Confidence invented; forget and do-not-rely strengthened, never weakened; no unified deletion rule (D4); the
  derivative is never silently relied upon while its evidence is gone.
- **Current truth (INTEL-TM-01, 2026-10-10; merged, PR #326):** resolved in the repository by migration
  `0151` under the Product Owner's Implementation Task Contract (Controlled Changes CC-1 … CC-4): a Hypothesis known to
  depend on forgotten, disabled or corrected Memory is withheld from every provider-facing consumer, from question
  selection and binding, and shown to its owner without its statement — derived from committed facts, never a worker —
  and nothing is declared false. Record: [INTEL-TM-01 implementation record](e2e/QANDEEL_INTEL_TM_01_PERSONAL_EVIDENCE_TRUTH_MAINTENANCE_IMPLEMENTATION_RECORD_v1.md).
  It is `CLOSED — TOMBSTONE` through the post-merge BG-08/BG-09 reconciliation.
- **Status:** `CLOSED — TOMBSTONE`

This entry freezes **no algorithm** and no owner-visible wording. It does not decide whether a derivative is retired,
demoted or re-supported; that is the re-evaluation's job under its own Task Contract (BG-07).

---



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

### `QAN-BL-ACE-01` — The QANDEEL Personality Core Does Not Reach Shared / Public QANDEEL Replies (Gate B)

- **Closing task:** `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision`
- **PR / SHA:** PR #333, merged as `84dd486c905cd3512bb206e48a2d7a63aa1c2d9b` (2026-10-12; exact head
  `dbd3329f9f78bf17622862a599351ff15428a622`); no migration; not deployed. *(As first written, before the merge: "Draft
  PR #333 from branch `ace/ace-sp-01-shared-public-personality-core` (closing change `335bb09a`; the
  [ACE-SP-01 implementation record](e2e/QANDEEL_ACE_SP_01_SHARED_PUBLIC_PERSONALITY_CORE_IMPLEMENTATION_RECORD_v1.md)
  §9). The tombstone holds from that PR's merge, and the merge SHA is filled in at merge. Not merged; no migration; not
  deployed."; the merge SHA was filled in by GOV-REC-01's reconciliation.)*
- **Disposition:** completed for both Worlds, under the Product Owner's *ACE-SP-01 — Final Product Approval &
  Implementation Authorization* (2026-10-12; D-1 … D-4; Product Copy Gate CG-1 … CG-6 APPROVED 6 / 6).
  - **Amendment first.** The standalone [ACE-SP-01 controlled amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_ACE-SP-01_SHARED_PUBLIC_PERSONALITY_CORE_CONTROLLED_AMENDMENT_v1.0.md),
    registered in the Canonical Authority Index and Project Map rule 2, precedes the code in the same PR. CW2-03 / 04 / 08,
    `CW2_SOURCE_PROVENANCE.sha256` and the S4-02 / S5-04 records are untouched.
  - **One personality.** Shared World and Public World QANDEEL replies now carry Text v1 + their unchanged frame, then the
    world-neutral core derived by reference from the ONE approved core.
  - **GUIDED.** On a Safety `GUIDED` turn only, the approved humour-suspension line is added, immediately before the
    Safety block.
  - **Every required future property holds:**
    - one personality definition, no second persona;
    - the world-neutral wording passed the Product Copy Gate;
    - Shared / Public inputs carry no Personal data, no preference and no requester identity;
    - `locale: 'und'`;
    - BLOCK still makes zero provider calls;
    - Personal guidance is byte-identical;
    - the frozen records were amended before any code.
  - **Proof:** `apps/api/src/conversation/ace-sp-01-shared-public-personality-core.spec.ts` and
    `tests/ace-sp-01-shared-public-personality-core-contract.test.mjs`.
  - **Real-model behaviour** is validated under `QAN-BL-ACE-02` (validation set extended, D-4).
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-CW-03` — Shared World Living Analysis Map / Semantic Geography Product Integration

- **Closing task:** `SHARED-VIS-01 — Shared World Living Analysis Map Product Integration`. Its BG-08 half is recorded
  retroactively by `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation`: an explicit governance
  reconciliation under BG-09, not a quiet rewrite.
- **PR / SHA:** PR #321, merged as `5973123153e26494d702a4a859a79631ede225cd` (2026-10-09). The Product Owner's merge
  decision on that PR approved the exact head `8563e5699a100fe88c3e5ef451ca825c98d4c18e`, with an explicit pre-launch
  condition (Issue #322, below). This retroactive disposition holds from the merge of the GOV-REC-01 pull request,
  PR #334.
- **Why it is recorded late:** SHARED-VIS-01 planned its closing change: this tombstone, its record banner and the locator
  rows (record §10: the item "stays `DEFERRED — OWNED` … until this task's closing change tombstones it"). That change
  did not land before PR #321 merged. CI-01 recorded the drift as an independent documentation gap (C0 decision D10).
  ACE-SP-01 admitted it as `QAN-BL-GOV-01` at the Product Owner's direction, and GOV-REC-01 repairs it. Nothing below is
  decided anew: each fact is read from the merged record, PR #321 and the Product Owner's recorded decisions.
- **Disposition:** completed for its scope. It was delivered under the Product Owner's SHARED-VIS-01 Decision Gate
  (Option A, D1–D7, 2026-10-08), the Visual Layout Correction (2026-10-08) and the Controlled Frozen Map Correction
  (2026-10-09) ([SHARED-VIS-01 record](e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md)
  §3, §13, §14).
  - **Scope.** An ALLOWed Shared World opens on the ONE common Living Analysis surface (`LivingAnalysisSurface →
    WorldViewSurface → WorldCanvas`; FAR / MID / NEAR; `CHROME_ONLY`). It has a Shared-specific projection
    (`SharedFieldView`) and a World-local camera and focus owned by `SharedFieldController`. The S4-02 conversation and
    the membership, governance, history, Activity and authority surfaces stay the World's own chrome; the conversation is
    one entry away (D7). No Shared truth is mapped into Personal Threads, Readings or Sessions. I-04 is not rebuilt:
    migration `0148` is additive, in its own schema, over the frozen I-04G core.
  - **Required future properties, each held:**
    - one renderer family across Personal, Shared and Public (the common stack; no Shared renderer);
    - exact-World semantic geography (`QANDEEL_SHARED_FIELD_V1` World-local coordinates);
    - no Personal camera, focus or timeline leakage, and independent Shared viewer state (per-World anchors, keyed by
      the World; record §5);
    - no invented cross-World coordinate alignment;
    - Shared authority and privacy laws unchanged (D3: a place is served only when every source is visible; D4: it is
      removed by the frozen owner-deletion closure);
    - targeted non-regression proof for the merged Stage-4 journeys (record §9, the re-anchored S4 journeys).
  - **"The World grows from Shared-native truth over time."** A place is built from the World's own human text only.
    Its producer is provider-neutral and refuses until Stage 8A binds a provider (D2), so the production field is empty
    by truth until then. That binding is Stage 8A's delivery objective (Project Map §5.1), not a gap in this item.
  - **"Time state."** There is no Shared Timeline, by the Product Owner's D5. Shared temporal navigation is
    `QAN-BL-CW-07`.
  - **Dispositioned elsewhere by the Product Owner, not dropped:** `QAN-BL-CW-05` (Stage 8A); `QAN-BL-CW-06` and
    `QAN-BL-CW-07` (`OPEN — UNASSIGNED`); Shared density at scale under `QAN-BL-VIS-01` (`LA-SCALE-01`).
- **Release evidence — not part of this item:** GitHub Issue #322, *Physical Android rapid interaction & resize
  stability proof*, stays **OPEN / NOT PROVEN / RELEASE BLOCKER**.
  - The Product Owner made it the condition of the PR #321 merge (decision of 2026-10-09 on the PR).
  - The issue places it under the Stage 9 Economy + Launch Closure / release-readiness gate, or an earlier explicit
    validation owner.
  - The issue itself says it is not an instruction to reopen SHARED-VIS-01.
  - This tombstone is not evidence that the device condition is met; neither are the merge, green CI or the emulator
    proofs.
  - No register item carries it today: `QAN-BL-NOTIF-05` covers native Push only, and `QAN-BL-VIS-01` covers scale and
    LOD. Whether it is admitted as an item is left to the Product Owner (GOV-REC-01 record §7).
  - *(Stage 6 WP0, 2026-10-13:)* the Product Owner approved the admission. The obligation is now the register item
    `QAN-BL-LAUNCH-04` (§5; `HIGH`, `DEFERRED — OWNED`, owner `Stage 9 — Economy + Launch Closure (release-readiness
    gate)`). The issue itself stays open, and this tombstone's disposition is unchanged. The bullet above describes the
    register as GOV-REC-01 left it.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-GOV-01` — Locator and Closure-Record Drift After the IP-IMP-01, ACE-01 and SHARED-VIS-01 Merges

- **Closing task:** `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` (name APPROVED by the Product
  Owner, 2026-10-12).
- **PR / SHA:** PR #334 from branch `gov/gov-rec-01-post-merge-reconciliation`, from `main` at
  `84dd486c905cd3512bb206e48a2d7a63aa1c2d9b` (the merge of PR #333). The reconciliation evidence commit is
  `086325071f9147c4ba41810a6aaf91615334e36e`; the commits after it add only the PR number and the validation results.
  Documentation and governance only: no migration and no runtime change. The tombstone holds from the merge of PR #334.
  Until then this item is not closed.
- **Disposition:** completed. Each correction is recorded explicitly, and text that is history is kept and labelled
  ([GOV-REC-01 record](e2e/QANDEEL_GOV_REC_01_POST_MERGE_LOCATOR_CLOSURE_RECORD_RECONCILIATION_v1.md)). The six findings:
  1. Current State and the Project Map now have IP-IMP-01 (PR #331, `424cd023…`) and ACE-01 (PR #332, `141a3190…`). The
     INTEL-TM-01 checkpoint's "later proposed C2 slices" carries a dated note.
  2. The IP-IMP-01 and ACE-01 records carry a post-merge `**Status:**` and a dated post-merge governance reconciliation.
     Their pre-merge banners and closing-change paragraphs are kept, labelled historical.
  3. SHARED-VIS-01 is recorded merged (PR #321, `5973123…`) in Current State §3.7 and §7, the Project Map §5.1, the
     Roadmap and this register's §9. `QAN-BL-CW-03` is tombstoned (above).
  4. §9's Stage 8A row lists `QAN-BL-CW-05`, `QAN-BL-IP-02` and `QAN-BL-ACE-02`.
  5. Current State §5 counts the register mechanically from §4.
  6. The CI-01 baseline marks rows C-22, C-23, C-30 and C-31 as historical at their census version, with a dated
     post-merge note. No measurement changed.

  The comprehensive search found more of the same drift, corrected the same way: the ACE-SP-01, MEM-AR-01 and CI-01
  records' pre-merge banners; the ACE-01 tombstone's merge SHA; the Canonical Authority Index's ACE-SP-01 row; the §9
  entries of eight more open items whose owner had none (§7, GOV-REC-01 reconciliation); and the stale "open PR" /
  "not merged" labels in Current State §3.4, §3.6 and §4 (record §4).
- **Status:** `CLOSED — TOMBSTONE`

---

### `QAN-BL-MATCH-02` — Introduction-Phase Account Name Exposure Through Phase-Blind Shared World Reads

- **Closing task:** `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary`, under the Product Owner's
  approved Task Contract v1.2 and implementation authorization (2026-10-15; decisions A, A1, D1–D5).
- **PR / SHA:** the S6-02 pull request from branch `s6/s6-02-introduction-privacy-end-boundary`, from `main` at
  `2224c47f3dc83b16ad011ccbbdcf2aac19bf41f5` (the merge of PR #339). Implementation commits `83a67026` (migration
  `0155`, verifiers, wire proof, contract) and `144d6479` (the END route); the closing change records them. Not merged,
  not deployed. The tombstone holds from the merge of that pull request; until then this item is not closed.
- **Disposition:** completed, with the stricter rule of the dated amendment in §5
  ([S6-02 record](e2e/QANDEEL_S6_02_IMPLEMENTATION_RECORD_v1.md)):
  1. one recipient-scoped name projection (`shared_private.shared_person_name_v1`, `0155`) replaces every `users.name`
     projection of `0138`–`0141`, `0143` and `0148`: the account Name for an `ACCEPTED_INVITATION` World as before; for a
     Matching-born World only the proven handoff first name presented to that viewer, else `NULL` - before and after
     SUCCESS, never a `0154` draft name or a `FULL_NAME` disclosure;
  2. the member list, the material list (and so the Shared QANDEEL reply prompt built from it), the entry verdict,
     send, QANDEEL reply work, per-World alerts, the Activity source and the Shared field refuse an Introduction-phase
     World (D4);
  3. A1: no `ADD_MEMBER` or `REJOIN_MEMBER` in a Matching-born World; Replay and S5-02 Public authoring exclude
     Introduction-era material (D5); the one ungated END boundary over the frozen `0116` core (D1).

  Evidence on real PostgreSQL 17: `verify-migration-0155` 37 / 37 and the amended `verify-migration-0149` 22 / 22; the
  live PostgREST proof runs in API CI on every supported line. No Introduction World is reachable in production.
- **Status:** `CLOSED — TOMBSTONE`

---

### `QAN-BL-MATCH-05` — The Confirmed Introduction First Name Is Not the Canonical Matching First-Name Source

- **Closing task:** `S6-03 — Matching Proposal Pipeline & Intelligence Prerequisites`, under the Product Owner's Task
  Contract v1.3 and the approved Controlled Amendment [CW2-06B](canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06B_CONFIRMED_FACTS_ELIGIBILITY_NEUTRAL_PRESENTATION_REPROPOSAL_CONTROLLED_AMENDMENT_v1.0.md) (2026-10-15).
- **PR / SHA:** the S6-03 pull request from branch `s6/s6-03-matching-proposal-pipeline`, from `main` at
  `8e85b40dcf9b4ba35439f9424997ad0c3a0c1113` (the merge of PR #340); migrations `0156` and `0157`. Not merged, not
  deployed. The tombstone holds from the merge of that pull request; until then this item is not closed.
- **Disposition:** completed ([S6-03 record](e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md)):
  1. the durable confirmed-fact source on the I-07 side (`matching_confirmed_fact_versions` / `_state`, `0156`): only
     confirmed values exist, versioned along the owner's chain, with the exact S6-01 first-name shape; nothing reads or
     references the `0154` draft;
  2. `resolve_matching_canonical_first_name_v1` answers `RESOLVED` only with the CURRENT confirmed Introduction First
     Name, else the same unresolved answer with a NULL name - never `users.name`, a Public identity, the draft, or a
     declared or corrected-but-unconfirmed value; a later version rewrites no view and no Handoff copy;
  3. the S6-07 writer interface: the one internal writer `record_matching_confirmed_facts_core_v1`, executable by no
     role and wrapped by nothing in S6-03; its rows are not evidence of consent (R5), and S6-07 owns the human act, its
     evidence and the evidence precondition (`QAN-BL-MATCH-01` dated note).

  Evidence on real PostgreSQL 17: `verify-migration-0156` 31 / 31 (B01–B02, C01, G01 on the real resolver) and
  `verify-migration-0157` 32 / 32. The closure claims no real enrollment and no real-name availability for any
  production participant: no fact version exists in production and the six `0149` commands stay closed.
- **Status:** `CLOSED — TOMBSTONE`

---

### `QAN-BL-MATCH-01` — Matching Setup Enrollment, Correction and Resume Suspended Before Launch (SEC-MATCH-00)

- **Closing task:** `S6-07 — Activity, Direct Entry and Final Integration`.
- **PR / SHA:** PR #346 from branch `s6/s6-07-activity-direct-entry-final-integration`, from `main` at
  `1861df43943a8695a761edec7aa42f5e18f018ec` (the merge of PR #345). The closing change is the CP4 head recorded in the
  [S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12. The tombstone holds from the merge of PR #346; until then this item is not closed.
- **Disposition:** completed, under the rule the Product Owner approved with the S6-07 CP0 report (§9: tombstoned when
  the governed boundary ships behind a closed gate, no launch). Its required property holds: no application role regains
  `EXECUTE` on the six commands (verify-0149 / the SEC-MATCH-00 contract still refuse every role); enrollment,
  correction, resume and consent reconfirmation run only behind ONE reviewed, fail-closed, server-canonical boundary
  (`enroll_my_matching_setup_v1`, `0165`, CA-01-impl) under the closed-by-default `ENROLLMENT` gate, with the
  promotion record as the facts reader's precondition (CA-R5-impl), `CA-10` (the zero-item requirement core) and the
  zero-field profile and authority cores (CA-D-CP1-1-impl, CA-08-impl); refused during an account deletion; the
  `ACCT-DEL-01` dependency met. CP3 added the enrollment step, the three independent consents and the loopback-only
  governed install of the approved texts. The S6-01 annotation "not tombstoned while the six `0149` commands stay closed"
  is superseded: the six stay closed, and the boundary is the approved path. Opening the gate and installing the texts
  on the hosted environment are Stage 9 launch acts, not this item ([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §2 – §4, §11.10, §12.9).
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-PRIV-04` — Export My Data Omits the Reader's Matching and Introductions Data

- **Closing task:** `S6-07 — Activity, Direct Entry and Final Integration`.
- **PR / SHA:** PR #346 from branch `s6/s6-07-activity-direct-entry-final-integration`, from `main` at
  `1861df43943a8695a761edec7aa42f5e18f018ec` (the merge of PR #345). The closing change is the CP4 head recorded in the
  [S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12. The tombstone holds from the merge of PR #346; until then this item is not closed.
- **Disposition:** completed. Migration `0168` re-states `build_personal_export_v1` (the `0153` body byte for byte plus
  ONE section `matchingAndIntroductions`; `notYetIncluded` = shared, public, replay): the reader's own preparation,
  enrollment with its consent versions (GATE-17), confirmed facts, delivered proposals with the screen's own word and the
  reader's own decisions (no arrival instant, Q9), and per Introduction the reader's own messages, shares, photo facts,
  name-display acts and continuation approvals, the kept words after the other human's erasure, and the reader's
  reactivations. The photo BYTES travel beside the package on one owner-only bundle route and a per-photo file route
  (Q7′ / Q7″): every derived rendition the reader may still download, blurred and clear, each re-authorized on the
  reader's own token; the 32 MiB guard bounds one answer and never the export. Properties 1 – 7 are proven: the
  two-human negative tests (verify-0168 B03, the journey, the wire proof X03), CW2-06 §53 (B04, J03), owner deletion (B05),
  the category no longer listed. The one addition to CA-EXP - an owner-only photo reader (CA-EXP′) - was approved by the
  Product Owner on 2026-10-18, limited to that one reader. Residues admitted: `QAN-BL-PROD-10`, `QAN-BL-LAUNCH-06`. The Shared, Public and Replay
  categories stay with `QAN-BL-PRIV-05` ([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12).
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MATCH-06` — No Runtime Producer Forwards a First-Approved Proposal to the Second Recipient

- **Closing task:** `S6-07 — Activity, Direct Entry and Final Integration`.
- **PR / SHA:** PR #346 from branch `s6/s6-07-activity-direct-entry-final-integration`, from `main` at
  `1861df43943a8695a761edec7aa42f5e18f018ec` (the merge of PR #345). The closing change is the CP4 head recorded in the
  [S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12. The tombstone holds from the merge of PR #346; until then this item is not closed.
- **Disposition:** completed. CP2's ONE `service_role` dispatcher `server_forward_approved_matching_proposals_v1`
  (`0166`, CA-SYS-02-impl) runs the step only for a `FIRST_FORWARD_APPROVED` proposal whose approved view is current,
  through the frozen forward core and its writer, under the same revalidation and the CW2-08 seam, idempotently, the pair
  lock first, never as a human's decision, nothing while either human's deletion is pending; it reveals nothing beyond the
  neutral projection; and (CP3) it composes with the Introductions notifications as their producer's dispatcher. CP4's
  journey runs it between the two human approvals (J02, J07) ([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §10, §11, §12.4).
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-ACCT-02` — Replay Has No Account-Deletion Module: an Account's Replay Footprint Blocks Its Erasure

- **Closing task:** `S7-01 — Replay Secure Integration & Account Erasure`.
- **PR / SHA:** the S7-01 pull request from branch `s7/s7-01-replay-secure-integration`, from `main` at
  `3ea76f37` (the merge of PR #346). The closing change is the head recorded in the
  [S7-01 record](e2e/QANDEEL_S7_01_IMPLEMENTATION_RECORD_v1.md) §10. The tombstone holds from its merge; until then this item is not closed.
- **Disposition:** completed for the Personal Replay, in the same change as the first user-reachable Replay relation
  (`0169`). The module `account_erasure_private.erase_personal_replays_v1` deletes the whole footprint children first in
  foreign-key order. The coordinator locks the account's Replays in ascending order after the claims and before the users
  row. Every Replay relation (29 rows) is registered in `coverage_registry` and `REPLAY` is covered. The two I-06 history
  guards are narrowed in place to the ONE transaction-bound erasure, with the 0164 prefix. On real PostgreSQL
  (`verify-migration-0169` R01 – R05, G04 / G05) it proves:
  - a real footprint ERASED to zero rows;
  - a planted `RESTRICT` ending in RETRY with nothing deleted;
  - `BLOCKED` outside the Personal path;
  - the re-arm, and no deadlock against an in-flight revision.

  The residue it cannot cover without overriding another human's right is admitted as `QAN-BL-ACCT-03`.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-NAV-02` — Analysis Replay

- **Closing task:** `S7-05 — Replay Final Integration, Device Proof & Stage Closure`, under the Product Owner's D4 (2026-10-20: closure approved in principle, at CP3, on
  complete evidence only).
- **PR / SHA:** PR #351 from branch `s7/s7-05-replay-final-integration`, from `main` at
  `f9bc3947d840646385c618ea8db400914ca5aac4` (the merge of PR #350). The closing change is the head recorded in the
  [S7-05 record](e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md) §10. The tombstone holds from the merge of PR #351; until then this item is not closed.
- **Disposition:** completed for the Personal Analysis Replay — a surface through which a human watches, moment by moment,
  how the analysis of their own conversation developed. Stage 7 built it over the frozen `I-06` runtime in five tasks:
  - S7-01 (PR #347, `c152cb4b`): the Personal Replay boundary (`0169`) and its account erasure;
  - S7-02 (PR #348, `3ad4e414`): the entry and the selection of the whole conversation or one contiguous part;
  - S7-03 (PR #349, `0d8a7335`): one moment's exact text and its analysis at that moment, on the existing Living Analysis
    surface;
  - S7-04 (PR #350, `f9bc3947`): the player, a passage over the Conversation or the Analysis, with the Replay Temporal
    Spine, play / pause and the private preview / finalize / reopen;
  - S7-05 (PR #351): F-2 Option B, the English copy, the real-device proof and the four D5 proofs.

  The evidence is in the S7-05 record:
  - §7: the real-device render proof on the Product Owner's phone, kept apart from the API / DB proof. TalkBack is
    `NOT REQUIRED FOR S7-05 — PRODUCT OWNER WAIVER` (2026-10-20), not a pass.
  - §8: the account switch, the revise retry, the read after the gate closes (`verify-migration-0169` E15) and
    NOT_VIEWABLE through the real path.

  **Not covered, and not closed by this tombstone:**
  - Shared and Public World Replay: the Stage 7 WP0 is `MY_WORLD` only, and D4 excludes them.
  - Media, storage, transport and export (`CW2-05`'s deferral).
  - Distribution: `CW2-08` answers `NOT_EVALUATED`; see `QAN-BL-ACCT-03`.
  - Opening to users: the Personal Replay capability stays closed and nothing is deployed (`QAN-BL-PROD-09`).
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-AI-06` — Two Shared World Participants With the Same Name Reach the Model as One Speaker

- **Closing task:** `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality`, under the Product Owner's CP1 Controlled Amendment & Closure Gate (2026-10-22) and the
  Founder's S8A-02 closure decision (2026-10-23).
- **PR / SHA:** PR #354, merged as `378128452177508c5700a3ac3e86346c4eb33067` (2026-10-23), from branch
  `s8a/s8a-02-personality-deepseek-quality`; no migration; not deployed. *(As first written, before the merge: "the S8A-02
  pull request from branch `s8a/s8a-02-personality-deepseek-quality`, from `main` at
  `d566a7e7dc4d01e698df2fe48cd16c8765edf6ed` (the merge of PR #353, S8A-01). The closing change is that pull request's final head; the merge SHA is filled in at merge.
  The tombstone holds from that pull request's merge; until then this item is not closed. No migration; not deployed.";
  the merge SHA was filled in by S8A-03's reconciliation.)*
- **Disposition:** completed by S8A-02 CP1 (Trusted Speaker & Message Provenance), under the narrow controlled amendment in
  the [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §5.3.
  - The Shared reply input carries each person's message as its own model message, under the author the frozen `0089`
    resolver holds for its `material_id`.
  - Different people who share a Name get the collision-only labels " (1)", " (2)".
  - No identifier reaches the model: only request-local tokens leave the composition.
  - The frozen-RPC change the item anticipated was not needed, and no migration was added.
  - **Proof (zero calls):** `apps/api/src/connected-worlds/material-commit/shared-qandeel-reply.speaker-provenance.spec.ts`,
    at the Model Router boundary and in the DeepSeek request body.

  **Not covered:** how a model reads attribution (`QAN-BL-AI-09`, below), and the person an earlier QANDEEL reply
  answered (`QAN-BL-AI-08`, still open).
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-AI-07` — Shared World Participants Without a Name All Reach the Model as One "A participant"

- **Closing task:** `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality`, under the Product Owner's CP1 Controlled Amendment & Closure Gate (2026-10-22) and the
  Founder's S8A-02 closure decision (2026-10-23).
- **PR / SHA:** PR #354, merged as `378128452177508c5700a3ac3e86346c4eb33067` (2026-10-23), from branch
  `s8a/s8a-02-personality-deepseek-quality`; no migration; not deployed. *(As first written, before the merge: "the S8A-02
  pull request from branch `s8a/s8a-02-personality-deepseek-quality`, from `main` at
  `d566a7e7dc4d01e698df2fe48cd16c8765edf6ed` (the merge of PR #353, S8A-01). The closing change is that pull request's final head; the merge SHA is filled in at merge.
  The tombstone holds from that pull request's merge; until then this item is not closed. No migration; not deployed.";
  the merge SHA was filled in by S8A-03's reconciliation.)*
- **Disposition:** completed by S8A-02 CP1, under the same §5.3 amendment as `QAN-BL-AI-06`. Different people without a
  Name keep the fixed label `A participant`, now with the collision-only " (1)", " (2)", derived inside the server from
  the `0089` author and never an identifier. The proof is the same CP1 spec. No migration, RPC, Router, adapter or frame
  change.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-AI-09` — Text Inside One Participant's Shared Message Can Pose as Another Participant Speaking

- **Closing task:** `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality`, under the Founder's S8A-02 closure decision (2026-10-23): CP2's direction and
  implementation approved as a product, and closure without further research or paid rounds.
- **PR / SHA:** PR #354, merged as `378128452177508c5700a3ac3e86346c4eb33067` (2026-10-23), from branch
  `s8a/s8a-02-personality-deepseek-quality`; no migration; not deployed. *(As first written, before the merge: "the S8A-02
  pull request from branch `s8a/s8a-02-personality-deepseek-quality`, from `main` at
  `d566a7e7dc4d01e698df2fe48cd16c8765edf6ed` (the merge of PR #353, S8A-01). The closing change is that pull request's final head; the merge SHA is filled in at merge.
  The tombstone holds from that pull request's merge; until then this item is not closed. No migration; not deployed.";
  the merge SHA was filled in by S8A-03's reconciliation.)*
- **Disposition:** **accepted for the first release by the Founder's product decision.** It is not closed on a guarantee,
  and not on a passed criterion. What production now does:
  - CP1: the server, not the text, states who sent each message, and a «Name:» line stays inside its sender's own model
    message.
  - CP2, under the [S8A-02 CP2 Shared Attribution Layer Controlled Amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_CP2_SHARED_ATTRIBUTION_LAYER_CONTROLLED_AMENDMENT_v1.0.md):
    - tier 0 sends the request unchanged (B);
    - tiers 1 / 2 add server-sourced notes and one verified attribution reading (S+R);
    - a failed reading falls back to the notes alone (S).

  **Evidence kept** (DeepSeek Flash, synthetic data, the accounted path; recorded in the [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7 and the CP2 record):
  - Part T: 60 calls.
  - The focused check of the server-sourced candidate: 30 calls.
  - The free verifiability review: only verbatim quotations can be verified from server data.
  - Round 10:
    - 468 calls, USD 0.065 actual;
    - provisional blind AI verdicts on gated cases gave critical attribution errors of B 24.3%, S 15.7% and S+R 10.2%;
    - S vs B and S+R vs S both **failed** their preregistered criteria;
    - human review was not done.
  - Option (b) is a re-analysis of the same data by tier. The production distribution was not measured as deployed, and its
    DEEP reading path was never measured.

  **Known limits, accepted for v1:** Future Improvement 002 in
  `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`, non-blocking and unscheduled:
  - IND-11;
  - a wrong negation polarity the reading accepts;
  - an ambiguous pronoun;
  - an unmarked transfer (T-04);
  - corrections outside the gate;
  - unusual DeepSeek output.

  These limits are not a release blocker.

  **Not covered:** `QAN-BL-AI-08` (still open). No real user's data reaches DeepSeek (`QAN-BL-AI-01`).
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-CW-02` — Shared Standing Context Product & Private-Source Integration

- **Closing task:** `S8A-04 CP3 — Personal Knowledge in Shared World`, which delivers `SHARED-CTX-01` (its Task Contract
  names it). It closes under the Product Owner's D-9 decision (2026-10-26): `PO-ACCEPTED-KNOWN-RISK — DEFERRED UNTIL AFTER
  FIRST LAUNCH`.
- **PR / SHA:** Draft PR #358, from branch `s8a/s8a-04-cp3`, from `main` at `b0839fd4dec150f79e6292da991ef93dcca34d72` (the
  merge of PR #357, S8A-04 CP2). The closing change is that pull request's final head; the merge SHA is filled in at merge.
  - Migrations 0176, 0177 and 0178, not applied to any hosted database.
  - **The tombstone holds from that pull request's merge; until then this item is not closed.**
- **Disposition:** **delivered for its scope, and accepted with known risk by the Product Owner.** It is not closed on a
  guarantee, and not on a passed criterion. Under the
  [S8A-04 CP3 controlled amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT_v1.0.md)
  (R3 + §10 + R4 §11, which bind over CW2-02 §16–§22 and §32 and CW2-03 §23, §39 and §40 as they state), production now:
  - **Sources:** the owner's ACTIVE, current memories about themselves (PO-4) are the self-authored Personal source, read
    by a server-owned collector.
  - **Consent:**
    - The owner is asked just in time, privately and alone (CG-1).
    - One consent writes a reasoning grant and a disclosure grant (0176), bound to the membership episode and the human
      audience.
    - Consent is revocable, and leaving ends use.
    - Only the owner's `authenticated` command grants; relevance never does (D-1).
  - **Disclosure:**
    - A Disclosure Authorization is built for one exact operation.
    - A statement about an owner is a claim span whose owner Name the server writes (R4).
    - One CG-6b′ check runs per reply, and a reply it does not clear is withheld.
    - A digest-only source-state revalidation runs, and I-03F and the commit binder are bound to the delivered text.
  - **Every part fails closed.** Every AI call is paid by the sender of the causing message (AI-COST-01).
- **Evidence kept** (synthetic; DeepSeek Flash; the accounted path; amendment §11.0 and §11.8):
  - **CP3-D V1:** 120 calls; NOT ACCEPTED (3 / 75 misses, 7 / 45 false blocks).
  - **CP3-D V2 Tier 1:**
    - 150 calls, USD 0.0177 at peak;
    - **NOT ACCEPTED — original criteria failed:** leaks 36 / 90, false blocks 7 / 60, invalid 1 / 150;
    - every leak had an all-clear checker answer.
  - **Tier 2:** NOT RUN, deferred by explicit Product Owner decision. Tier 1 was not repeated.
- **Known limits, accepted until after the first launch:** Future Improvements 012 – 016 in
  `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`, each `POST-FIRST-LAUNCH / DEFERRED / NON-BLOCKING`:
  - 012 — disclosure outside the claim spans;
  - 013 — attribution protection;
  - 014 — dialect and hint semantics;
  - 015 — false blocks;
  - 016 — checker reliability, compound claims and the deferred end-to-end evaluation.

  The probabilistic disclosure and attribution errors remain, and **V2 gives no absolute privacy guarantee.** The T-D2
  failure alone is not a merge or first-launch blocker, by the Product Owner's exception (amendment §11.9).
- **Not covered:**
  - No real user's data reaches DeepSeek: `SYNTHETIC_ONLY` is unchanged, and `QAN-BL-AI-01` stays open.
  - Hosted application rides the hosted deployment items.
  - The exception removes no security, privacy or deployment gate.
  - *Reasoning only* (PO-2) and the advance grant from the Personal World (PO-3) stay deferred by the amendment, not
    admitted here.
- **Status:** `CLOSED — TOMBSTONE`

## 7. Counts at this baseline

| Status | Count |
| --- | ---: |
| `DEFERRED — OWNED` | 42 |
| `VALIDATION — OPEN` | 4 |
| `OPEN — UNASSIGNED` | 9 |
| `CLOSED — TOMBSTONE` | 33 |
| **Total** | **88** |

| Severity | Count |
| --- | ---: |
| `HIGH` | 51 |
| `MEDIUM` | 35 |
| `LOW` | 2 |

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
Product Owner names within Stage 8A — no item is admitted before that designation (BG-02). R1 (independent review):
Public field / search performance at scale and dense-field aggregation (record G04 / G05) are recorded as OPEN PRODUCT
GAPS awaiting the Product Owner's ownership decision — not self-assigned to S5-04 and not admitted before that decision;
the field read's `LIMIT 400` is a bounded v1, not the final whole-World behaviour at scale. Its Gap Matrix is §16 of its
[implementation record](e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md): **Orphan gaps = 0**.
The S5-03B task itself still admits no implementation-owned backlog item. During its Product review on 2026-10-07, the
Product Owner separately designates `QAN-BL-CW-03 — Shared World Living Analysis Map / Semantic Geography Product Integration`
as `HIGH`, `DEFERRED — OWNED`, owner `SHARED-VIS-01`, with an explicit sequencing gate: do not start it until Stage 5 / Public
World is fully `DONE / MERGED`. This does not reopen Stage 4 now and does not interrupt S5-03B / S5-03C / S5-04.
The register now holds **44** items: 17 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`; by severity, 27 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**LA-VIS-01 reconciliation (2026-10-07; graphics-only, not merged).** `LA-VIS-01` is the Product Owner's graphics-only Living
Analysis visual-redesign workstream, opened at the S5-03B pause checkpoint and closed on Product Owner visual acceptance
(implementation `550ce07`; primary record:
[S5-03B record](e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md) §27). It is not a phase and
not S5-03B's closure. It inherits no item by owner and admits none. `QAN-BL-VIS-01` stays `OPEN — UNASSIGNED`: LA-VIS-01 does
not close it, and real-phone performance and heavy-history / scale stress remain unproved under it, so no duplicate item is
admitted for them (current-truth note in §5). `QAN-BL-CW-03 / SHARED-VIS-01` stays `DEFERRED — OWNED`, unchanged: Shared World is
still not integrated into the shared Living Analysis surface (current-truth note in §5). The remaining gap against the
Product Owner's reference is semantic density, which BG-06 does not admit; it may not be filled by fabricated places. Every
other item is unchanged. The register still holds **44** items: 17 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9
`OPEN — UNASSIGNED` and 18 `CLOSED — TOMBSTONE`; by severity, 27 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from the
§4 index.

**S5-03C reconciliation (2026-10-07; closed, not merged).** S5-03B is merged (PR #317 at
`afd5e8caecc06884b5adfdb381eef8e650e03c1f`; its Product Copy Gate CLOSED, 13 / 13 APPROVED). S5-03C (Public Explicit Relations +
Integrity Closure, migration `0146`; the third of the Product Owner's three S5-03 tasks, under the Product Owner's R+ decision;
its Product Copy Gate CLOSED, 13 / 13 APPROVED; CLOSED / READY FOR THE PRODUCT OWNER'S MERGE DECISION on Draft PR #318)
inherits no item by owner (BG-05: no item names it; S5-03B's Gap-Matrix row G07 is delivered by it) and admits none (BG-08).
`QAN-BL-ACCT-01` stays `HIGH`, `OPEN — UNASSIGNED`, with a current-truth note (no direct account foreign key; its new
relation `RESTRICT` dependents are recorded as part of the blocker). `QAN-BL-VIS-01` stays `OPEN — UNASSIGNED`: S5-03C does not
close it, and relation density at real scale / on a real phone joins what it must one day prove, without a duplicate item.
`QAN-BL-CW-03 / SHARED-VIS-01` stays `DEFERRED — OWNED`, unchanged and still blocked until Stage 5 is fully `DONE / MERGED`:
Shared is untouched. S5-03B's G04 / G05 (scale, dense aggregation) stay OPEN PRODUCT GAPS awaiting the Product Owner's
ownership decision — not self-assigned to S5-03C and not admitted before that decision; S5-03C's own read bounds are recorded in
the same bounded-v1 family. Relation-request notifications are S5-04's by the Product Owner's decision; the export footprint is
`E2E-D-16`'s. Its Gap Matrix is §16 of its
[implementation record](e2e/QANDEEL_S5_03C_PUBLIC_EXPLICIT_RELATIONS_INTEGRITY_CLOSURE_IMPLEMENTATION_RECORD_v1.md): **Orphan gaps = 0**.
The register still holds **44** items: 17 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`; by severity, 27 `HIGH`, 16 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**S5-04 reconciliation (2026-10-08; closed, not merged).** S5-03C is merged (PR #318 at
`729fe4d8b5afa15d2b0c6ae3eba627b25450132f`). S5-04 (Public Discussion + @qandeel + Public Activity / Direct Entry + Final
Public Integration, migration `0147`; the final Stage-5 task; CLOSED / READY FOR THE PRODUCT OWNER'S MERGE DECISION) inherits
no item by owner (BG-05: no item names it; S5-03C's G03 relation-request notifications and S5-03B's G08 are delivered by it).
At the Product Owner's Decision Gate (2026-10-08): **D6** — `QAN-BL-VIS-01` is re-owned to
`LA-SCALE-01 — Living Analysis Heavy-History / Dense-World Scale & LOD Proof` and becomes `DEFERRED — OWNED`, and S5-03B's G04 /
G05 (with S5-03C's read bounds) are reconciled under it with no duplicate item — so no Stage-5 scale gap remains an orphan;
**D3** — `QAN-BL-CW-04` (Public Lightweight Reactions Runtime, `PG-07`; owner `PUBLIC-REACTIONS-01`, `MEDIUM`,
`DEFERRED — OWNED`) is admitted exactly once, as approved Product direction with its details undecided. `QAN-BL-VOICE-01` is
observed and left unchanged (it owns Public `VOICE_REPLY`; no duplicate). `QAN-BL-ACCT-01` stays `HIGH`, `OPEN — UNASSIGNED`
with a current-truth note (S5-04's invocation / work tables add no direct account edge beyond the frozen 0096 posts and
the per-human lease / grant rows, which cascade with the account). `QAN-BL-CW-03 / SHARED-VIS-01` stays `DEFERRED — OWNED` and
becomes NEXT only after S5-04 merges (not started here). `QAN-BL-NOTIF-02` … `05` are unchanged: S5-04 adds the Public source
producer only, through the ONE A3-01 boundary. The CW2-08 seams (publication, and the new discussion entitlement seam) answer
`NOT_EVALUATED`. Its Gap Matrix is §16 of its
[implementation record](e2e/QANDEEL_S5_04_PUBLIC_DISCUSSION_QANDEEL_FINAL_INTEGRATION_IMPLEMENTATION_RECORD_v1.md): **Orphan gaps = 0**.
*(At S5-04:)* the register then held **45** items: 19 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 8 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`; by severity, 27 `HIGH`, 17 `MEDIUM` and 1 `LOW`.

SHARED-VIS-01 (ACTIVE, not merged; 2026-10-08) owns `QAN-BL-CW-03`, which stays `DEFERRED — OWNED` until its closing change
tombstones it, and admits three `OPEN — UNASSIGNED`, `MEDIUM` items, each awaiting a Product Owner decision: `QAN-BL-CW-05`
(QANDEEL conversational output cannot ground a Shared semantic place under the frozen I-04G core), `QAN-BL-CW-06` (the ended
Shared World's read-only Living Analysis view) and `QAN-BL-CW-07` (Shared temporal navigation, D5). The register now holds
**48** items. At the Product Owner's deferral decision (2026-10-08) `QAN-BL-CW-05` is owned by Stage 8A (its authority / source
review; `DEFERRED — OWNED`), while `QAN-BL-CW-06` and `QAN-BL-CW-07` are deferred with no named owner and stay
`OPEN — UNASSIGNED`. Counts: 20 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`; by severity, 27 `HIGH`, 20 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**SEC-MATCH-00 reconciliation (2026-10-09; implemented, not merged).** SEC-MATCH-00 is the P0 Matching direct-RPC
and account-deletion protection, migration `0149`. It is a cross-cutting security checkpoint ahead of CI-01, not a
Product stage.

- **Inherited items (BG-05):** none by owner.
- **Admitted:** `QAN-BL-MATCH-01` (`HIGH`, `DEFERRED — OWNED`, owner `S6-01`). The Product Owner's decision suspends
  enrollment, correction and resume before launch; restoring them through a reviewed, launch-gated path is Stage 6
  work and must not survive only in a record.
- **`QAN-BL-ACCT-01`:** stays `HIGH`, `OPEN — UNASSIGNED`, with a current-truth note. `0149` stops new Matching
  footprints and erases nothing.
- **`QAN-BL-SEC-01`:** unchanged.

The register now holds **49** items: 21 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`. By severity: 28 `HIGH`, 20 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**SEC-MATCH-00 closure reconciliation (2026-10-10; CLOSED / READY FOR PO MERGE DECISION, not merged, not deployed).**
The independent review of PR #323 at `a0290f84c5e40b5bcde4944eb23d648fc337a078` passed technically; API CI
`37994876559` and Mobile CI `37994876560` are green on that head. This is the BG-08 half of the closing change.

- **Inherited items (BG-05):** none by owner.
- **Admitted:** `QAN-BL-PROD-06` (`HIGH`, `DEFERRED — OWNED`, owner `PROD-RETRY-01`), the Data API unbounded `40001`
  retry. Anti-duplication: no existing item covered it. `QAN-BL-PROD-01` … `05`, `QAN-BL-LAUNCH-01` and
  `QAN-BL-MATCH-01` name neither `40001` nor PostgREST's retry. It reaches core conversation and Hypothesis, not
  Matching alone, and it is a launch and deployment gate.
- **`QAN-BL-MATCH-01`:** unchanged; owner `S6-01`, `DEFERRED — OWNED`.
- **`QAN-BL-ACCT-01`:** unchanged; `HIGH`, `OPEN — UNASSIGNED`. `0149` stops new Matching footprints and erases nothing.
- **`QAN-BL-SEC-01`:** unchanged.

The register now holds **50** items: 22 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`. By severity: 29 `HIGH`, 20 `MEDIUM` and 1 `LOW`, counted mechanically from the §4 index.

**PROD-RETRY-01 reconciliation (2026-10-10; implemented, not merged).** PROD-RETRY-01 is the Data API `40001` retry
hazard closure, migration `0150`, under the Product Owner's C1 decision ("C1 ACCEPTED WITH CORRECTIONS — AUTHORIZE C2").

- **Inherited items (BG-05):** `QAN-BL-PROD-06`. Its scope is amended (the Shared ID rotation added; the generation and
  batch rows corrected) and its repository resolution is recorded; it stays `DEFERRED — OWNED` until the closing change
  at the Product Owner's merge decision, which disposes of it under BG-08.
- **Admitted:** `QAN-BL-PROD-07` (`LOW`, `DEFERRED — OWNED`, owner `PROD-RETRY-02 — Post-v16 Data API Retry Semantics`),
  the Product Owner's D7. Anti-duplication: no item covered the post-v16 behavior of the race-converging and deadlock
  paths. It is not a launch gate.
- **`QAN-BL-MATCH-01`**, **`QAN-BL-ACCT-01`**: unchanged.

The register now holds **51** items: 23 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`. By severity: 29 `HIGH`, 20 `MEDIUM` and 2 `LOW`, counted mechanically from the §4 index.

**PROD-RETRY-01 closure reconciliation (2026-10-10; CLOSED / READY FOR PO MERGE DECISION, not merged, not deployed).**
The Product Owner's technical review of PR #324 passed at the exact head `3a780baf0069e3464511e7bd6312d59006a11ac1` ("TECHNICAL REVIEW PASSED — AUTHORIZE
DOCUMENTATION CLOSURE ONLY"). API CI `38019937801` and Mobile CI `38019937819` are green on that head. This is the BG-08
half of the closing change, which is documentation only.

- **Inherited items (BG-05):** `QAN-BL-PROD-06` is **re-owned**, not tombstoned, to `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate`.
  - It keeps `HIGH` and `DEFERRED — OWNED`, and its reopen condition and required future property are unchanged.
    It now states a closure condition proven on the hosted project itself.
  - The repository implementation is complete, but `0150` is not deployed. The hosted database was at `0074` at the
    last approved check, and its PostgREST version is unverified. A tombstone would hide that deployment gate.
  - The C2 record planned a tombstone at the merge decision; the Product Owner directed this re-ownership instead.
  - Anti-duplication: one item stays one hazard, and no second item is admitted for the hosted remainder.
- **`QAN-BL-PROD-07`:** unchanged: `LOW`, `DEFERRED — OWNED`, owner `PROD-RETRY-02`. It is not a launch gate.
- **Admitted:** none.
- **`QAN-BL-MATCH-01`**, **`QAN-BL-ACCT-01`**: unchanged.
- **§7 correction:** the table above had not been moved for `QAN-BL-PROD-07`'s admission. It is corrected here,
  from the §4 index.

The register still holds **51** items: 23 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`. By severity: 29 `HIGH`, 20 `MEDIUM` and 2 `LOW`, counted mechanically from the §4 index.

**CI-01 C1-A admission (2026-10-10; implemented locally, not merged).** CI-01 (Shared Intelligence Learning Evidence &
Baseline) is a baseline and design task: no migration, no runtime change. Its C0 report (D1–D10) and Interaction Style
annex (P1–P9) were approved by the Product Owner with controlled amendments, and its
[C1 Task Contract](e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) was approved with mandatory amendments for slice C1-A
only.

- **Inherited items (BG-05):** none by owner. The C1-A records cite `QAN-BL-CTX-01`, `QAN-BL-CW-02`, `QAN-BL-CW-05`,
  `QAN-BL-PRIV-01` and `QAN-BL-PRIV-02` as the current owners of neighbouring gaps; each is unchanged, none is re-owned.
- **Admitted:** `QAN-BL-INTEL-01` (`HIGH`, `DEFERRED — OWNED`, owner `INTEL-TM-01 — Personal Evidence Truth Maintenance
  (PG-02)`), the PG-02 gap, at the Product Owner's explicit designation (C1 decision 3), after the anti-duplication check
  recorded on the item. Documentation only; no PG-02 repair starts in CI-01 (BG-07).
- **Not admitted (BG-06):** the Memory correction / Arabic acquisition defects, the `locale: 'und'` language signal and
  the Interaction Preferences design are proposed C2 slices in the C1 contract §12 and are not yet designated by a
  canonical document; the SHARED-VIS-01 stale banners are an independent governance gap (D10), not CI-01 residue.

The register now holds **52** items: 24 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`. By severity: 30 `HIGH`, 20 `MEDIUM` and 2 `LOW`, counted mechanically from the §4 index.

**CI-01 C1 closure reconciliation (2026-10-10; Draft PR #325 open, not merged; both owner names PO-APPROVED at the push authorization).**
The Product Owner reviewed the C1-B report and authorized a local closing change ("CLOSING CHANGE AUTHORIZED — LOCAL ONLY").
This is the BG-08 half of that change. It is documentation, one CI step and one harness control; it changes no runtime and
no migration.

- **Inherited items (BG-05):** none by owner. `QAN-BL-CTX-01`, `QAN-BL-CW-02`, `QAN-BL-CW-05`, `QAN-BL-PRIV-01` and
  `QAN-BL-PRIV-02` stay cited in the baseline's gap register, each unchanged and none re-owned.
- **`QAN-BL-INTEL-01`:** unchanged: `HIGH`, `DEFERRED — OWNED`, owner `INTEL-TM-01`. C1-B re-measured it on `6a5fa42`
  (one hypothesis `ACTIVE` over `DELETED` / `DISABLED` evidence, injected in 2 / 2 new-session turns).
- **Admitted — `QAN-BL-INTEL-02`** (`HIGH`, `VALIDATION — OPEN`, owner `INTEL-RET-01`, PO-APPROVED): the retention and reuse
  question for the `0029` / `0033` ledger content, at the Product Owner's closing decision 2, after the anti-duplication
  check recorded on the item. No violation is established; no migration changes.
- **Admitted — `QAN-BL-CI-02`** (`MEDIUM`, `VALIDATION — OPEN`, owner `QAN-INF-06`, PO-APPROVED): the intermittent local
  failure of the forward-safety mirror's `QAN-INF-03` leg, at the Product Owner's closing decision 3. `QAN-INF-03` had no
  backlog item and no active owner; S5-04, SEC-MATCH-00 and PROD-RETRY-01 recorded the same failure only in their records.
- **Not admitted (BG-06):** the Memory correction / Arabic acquisition defects, the subject marker, trigger precision and
  the `locale: 'und'` signal remain proposed C2 slices in the C1 contract §12, not designated by a canonical document. The
  SHARED-VIS-01 stale banners remain an independent governance gap (D10).

The register now holds **54** items: 24 `DEFERRED — OWNED`, 2 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`. By severity: 31 `HIGH`, 21 `MEDIUM` and 2 `LOW`, counted mechanically from the §4 index.

**INTEL-TM-01 reconciliation (2026-10-10; implemented, PR open, not merged, not deployed).** INTEL-TM-01 is Personal
Evidence Truth Maintenance (PG-02), migration `0151`, under the Product Owner's Implementation Task Contract
("APPROVED FOR BOUNDED IMPLEMENTATION"), from `main` `44a440c`.

- **Inherited items (BG-05):** `QAN-BL-INTEL-01`. Its repository resolution is recorded on the item; it stays
  `DEFERRED — OWNED` until the closing change at the Product Owner's merge decision, which disposes of it under BG-08.
- **`QAN-BL-INTEL-02`:** its reopen condition 3 fired; discharged by check and recorded on the item. Unchanged:
  `VALIDATION — OPEN`, owner `INTEL-RET-01`.
- **Admitted:** none. The general question-finalization version recheck (residue R3-G — finalize v2 binds without
  re-checking a Hypothesis version or lifecycle for causes other than PG-02) is preserved in the
  [INTEL-TM-01 record](e2e/QANDEEL_INTEL_TM_01_PERSONAL_EVIDENCE_TRUTH_MAINTENANCE_IMPLEMENTATION_RECORD_v1.md) §9 with a
  proposed owner for the Product Owner's decision, to be admitted or dispositioned by the closing change — not marked
  resolved, and no scope created.
- **Not admitted (BG-06):** the L-2 boundary (forgotten content in conversation history and other derived stores) is a
  stated limit of PG-02, not designated by a canonical document as an obligation; R2 (clarification-answer turns) stays an
  observation for the Memory-control owner.

The register still holds **54** items: 24 `DEFERRED — OWNED`, 2 `VALIDATION — OPEN`, 10 `OPEN — UNASSIGNED` and 18
`CLOSED — TOMBSTONE`. By severity: 31 `HIGH`, 21 `MEDIUM` and 2 `LOW`, counted mechanically from the §4 index.

---


**INTEL-TM-01 post-merge closure (2026-10-10).** PR #326 merged as `995d5ae9bf2530ac8e655b870526e0976be7cbf4`; its inherited `QAN-BL-INTEL-01` is `CLOSED — TOMBSTONE`, `QAN-BL-QIR-01` is admitted under `QIR-006-R1` as `MEDIUM / DEFERRED — OWNED`, and `QAN-BL-INTEL-02` remains `VALIDATION — OPEN` under `INTEL-RET-01`. L-1/L-2/R2 are limitations/observations, not duplicated backlog or global erasure claims. **Latest index: 55 items; 24 / 2 / 10 / 19 by status, 31 / 22 / 2 by severity.** C2 Memory Correction & Arabic Acquisition is research-next, not implementation-open.

**MEM-AR-01 closing change at 01C (2026-10-11; Draft PR, implementation complete, awaiting the Product Owner's merge decision; not merged, not deployed).** MEM-AR-01 (slices 01A, 01B merged through PRs #328 / #329; 01C with migration `0152`) inherited no item (BG-05: none names it; re-checked at each slice).
- **Admitted — `QAN-BL-INTEL-03`** (`MEDIUM`, `DEFERRED — OWNED`, owner `INTEL-SV-01 — Hypothesis Semantic Support Verification`, Product Owner approved): residuals R-G1a and R-G1b. Anti-duplication re-run against this register at the closing change.
- **Admitted — `QAN-BL-PRIV-03`** (`MEDIUM`, `DEFERRED — OWNED`, owner `PRIV-EXPORT-01`): the export `about` field (CQ-2). Anti-duplication re-run.
- **INTEL-TM-01 residue R2** (an observation, never an item): **fixed** by `background_record_memory_v1`'s `SKIPPED_COMMAND_TURN` (route spec `memory-control-words-answer.route.spec.ts`, `verify-migration-0152`, CI-01 U1 `forgottenServed` 0). INTEL-TM-01 limit **L-1** is narrowed: no new zero-support generated Hypothesis is accepted (CC-H1); legacy rows remain under `QAN-BL-INTEL-03`.
- **Untouched:** `QAN-BL-INTEL-02` (CC-H1 refuses payloads and changes no retention, so none of its reopen conditions fires), `QAN-BL-QIR-01`, `QAN-BL-CTX-01`. `QAN-BL-PROD-06` current truth: `0152` joins the undeployed catch-up queue with `0150` and `0151`.
- **Latest index: 57 items; 26 / 2 / 10 / 19 by status, 31 / 24 / 2 by severity**, recounted mechanically from §4.

**IP-IMP-01 closing change (2026-10-12; PR open, implementation complete, awaiting independent review and the Product Owner's merge decision; not merged, not migrated on any hosted database, not deployed).** IP-IMP-01 (Interaction Preferences, migration `0153`) inherited no item (BG-05: none names it; re-checked at closure).
- **Admitted — `QAN-BL-IP-01`** (`MEDIUM`, `DEFERRED — OWNED`, owner `PUBLIC-PREF-01 — Public World Personal Interaction Preference Decision`, name APPROVED by the Product Owner): Personal preferences do not shape Public replies (CW2-04 §21–§22). Anti-duplication run against the whole register.
- **Admitted — `QAN-BL-IP-02`** (`MEDIUM`, `VALIDATION — OPEN`, owner `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`): real-model preference-following quality for the seven reply languages / dialects, brevity, humour and explanation style. Anti-duplication run.
- **Reconciled, unchanged — `QAN-BL-CW-02`:** the Shared half; a current-truth note records the new Personal source; owner, scope, severity and status unchanged; no second item.
- **Untouched:** `QAN-BL-PRIV-01/02/03` (other export facts; the Interaction Preferences export section is IP-IMP-01's own contract scope, WP6), `QAN-BL-CW-05`, `QAN-BL-CTX-01`. `QAN-BL-PROD-06` current truth: `0153` joins the undeployed hosted catch-up queue with `0150`–`0152`.
- **Fixed inside the task, never backlog (BG-01):** the evaluator templates that stored a temporary «كلمني بالمصري» as an `INTERACTION_PREFERENCE` Memory (record §1.1 T-3, DD-6).
- **Latest index: 59 items; 27 / 3 / 10 / 19 by status, 31 / 26 / 2 by severity**, recounted mechanically from §4.

**ACE-01 closing change (2026-10-12; PR open, implementation complete, awaiting independent review and the Product Owner's merge decision; not merged, no migration, not deployed; Gate B decided: Option A APPROVED).** ACE-01 (Adaptive Conversational Expression: the approved personality core in the Personal guidance, the WP2 locale compiler, the Golden Conversations suite) inherited no item (BG-05: none names it; re-checked at closure).
- **Admitted — `QAN-BL-ACE-01`** (`MEDIUM`, `DEFERRED — OWNED`, owner `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision`, name approved by the Product Owner): the core does not reach Shared / Public replies. Gate B: Option A APPROVED (2026-10-12), so parity is future work under `ACE-SP-01`, not implemented now. Anti-duplication run against the whole register (`QAN-BL-CW-02`, `QAN-BL-IP-01` distinct).
- **Admitted — `QAN-BL-ACE-02`** (`MEDIUM`, `VALIDATION — OPEN`, owner `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`): real-model personality behaviour on the Golden Conversations suite. Anti-duplication run (`QAN-BL-IP-02` keeps preference following).
- **Untouched:** `QAN-BL-IP-01`, `QAN-BL-IP-02`, `QAN-BL-CW-02`, `QAN-BL-CW-05`, `QAN-BL-VOICE-01`. `QAN-BL-PROD-06` current truth unchanged: ACE-01 adds no migration.
- **Not backlog (BG-06):** the absent tone engine, the model-honoured temporary requests and the absent first-contact signal are design decisions recorded in the [ACE-01 record](e2e/QANDEEL_ACE_01_ADAPTIVE_CONVERSATIONAL_EXPRESSION_IMPLEMENTATION_RECORD_v1.md) §2, not obligations.
- **Latest index: 61 items; 28 / 4 / 10 / 19 by status, 31 / 28 / 2 by severity**, recounted mechanically from §4.

**ACE-SP-01 closing change (2026-10-12; Draft PR, implementation complete, ready for independent review and the Product
Owner's merge decision; not merged, no migration, not deployed).** ACE-SP-01 (Shared / Public QANDEEL Personality Core,
under the [ACE-SP-01 controlled amendment](canonical-authority/connected-worlds-v2/architecture/QANDEEL_ACE-SP-01_SHARED_PUBLIC_PERSONALITY_CORE_CONTROLLED_AMENDMENT_v1.0.md)).
Kickoff (BG-05): it inherited exactly one item, `QAN-BL-ACE-01`, included in its Task Contract. Re-checked at closure.
- **Tombstoned — `QAN-BL-ACE-01`:** both Worlds are delivered and the protection is proven (§6 tombstone). It holds from
  the PR's merge.
- **Scope extended, owner and status unchanged — `QAN-BL-ACE-02`** (Product Owner D-4): the Stage 8A validation set now
  also covers the world-neutral personality in Shared / Public — mixed-language groups, differing participants, the
  public discussion, `GUIDED` Safety, fitting humour. No duplicate item was created and no paid evaluation was run.
- **Admitted — `QAN-BL-GOV-01`** (`MEDIUM`, `DEFERRED — OWNED`, owner `GOV-REC-01 — Post-merge Locator & Closure-Record
  Reconciliation`, name APPROVED by the Product Owner on 2026-10-12 — *as written at this closing change: "name proposed
  for the Product Owner's confirmation"; the approval is recorded by GOV-REC-01*): pre-existing locator and closure-record drift
  after the IP-IMP-01, ACE-01 and SHARED-VIS-01 merges, presented as one standalone item at the Product Owner's direction
  (§6) and not repaired here. Anti-duplication run against the whole register.
- **Reconciled, owner and status unchanged:**
  - `QAN-BL-CW-02` (`SHARED-CTX-01`): a current-truth note records that the Shared assembler now adds the world-neutral
    personality guidance, and still offers no private candidate.
  - `QAN-BL-IP-01` (`PUBLIC-PREF-01`): a current-truth note records that no Personal preference enters a Public input.
  - `QAN-BL-MATCH-01`: Introduction-phase Shared Worlds share the Shared reply path and gain no Matching or Introduction
    context.
- **Untouched:** `QAN-BL-IP-02`, `QAN-BL-CW-03`, `QAN-BL-CW-05`, `QAN-BL-VOICE-01`, `QAN-BL-ACCT-01` (no account edge).
  `QAN-BL-PROD-06` current truth is unchanged: ACE-SP-01 adds no migration.
- **Latest index: 62 items; 28 / 4 / 10 / 20 by status, 31 / 29 / 2 by severity**, recounted mechanically from §4.

**GOV-REC-01 reconciliation (2026-10-12; documentation / governance only; from `main` at
`84dd486c905cd3512bb206e48a2d7a63aa1c2d9b`; PR #334; effective from its merge).** GOV-REC-01 — Post-merge Locator & Closure-Record
Reconciliation is not a Product stage and changes no runtime, migration, API, screen or Product decision. Its owner name
is **APPROVED** by the Product Owner (2026-10-12). Every place that still called it proposed (the ACE-SP-01 paragraph
above, the item's owner line, the §9 row and the ACE-SP-01 record §10) now records the approval and keeps the original
wording as history.

GitHub truth read at kickoff: PR #321 (SHARED-VIS-01) merged as `5973123…`; PR #325 (CI-01) as `44a440c…`; PRs #326 /
#327 (INTEL-TM-01); PRs #328 / #329 / #330 (MEM-AR-01A / 01B / 01C) as `04dfbf21…` / `20e33ae3…` / `3bec87ac…`; PR #331
(IP-IMP-01) as `424cd023…`; PR #332 (ACE-01) as `141a3190…`; PR #333 (ACE-SP-01) as `84dd486c…`. Every dated note in this
register that calls one of these tasks "PR open", "Draft PR" or "not merged" describes the state at its own date.

- **Inherited items (BG-05):** exactly one, `QAN-BL-GOV-01`, included in the task. Re-checked at closure.
- **Tombstoned — `QAN-BL-GOV-01`:** every listed finding is corrected (§6 tombstone). It holds from the merge of
  PR #334.
- **Tombstoned retroactively — `QAN-BL-CW-03`**, for SHARED-VIS-01 (PR #321), under BG-08 / BG-09. GOV-REC-01 finds no
  gap inside the item's own scope; the parts not delivered were already dispositioned by the Product Owner to
  `QAN-BL-CW-05` … `07`, `QAN-BL-VIS-01` and Stage 8A (§6 tombstone).
- **Merge SHA filled in:** the `QAN-BL-ACE-01` tombstone (PR #333, `84dd486c…`).
- **§9 corrected, owners and scopes unchanged:** the Stage 8A row lists `QAN-BL-CW-05`, `QAN-BL-IP-02` and
  `QAN-BL-ACE-02`. The open items whose owner had no §9 entry gain one, read mechanically from §4: `QAN-BL-PROD-04`,
  `QAN-BL-PROD-05`, `QAN-BL-LAUNCH-03`, `QAN-BL-CI-01`, `QAN-BL-MATCH-01`, `QAN-BL-INTEL-03`, `QAN-BL-PRIV-03` and
  `QAN-BL-IP-01`. IP-IMP-01 and MEM-AR-01 gain their task rows. The SHARED-VIS-01 and GOV-REC-01 rows record their
  closures.
- **Not admitted — a Product Owner decision:** GitHub Issue #322 (the physical-Android rapid-interaction and resize
  stability proof, `OPEN / NOT PROVEN / RELEASE BLOCKER`, Stage 9 release-readiness gate). No register item covers it
  (`QAN-BL-NOTIF-05` is native Push; `QAN-BL-VIS-01` is scale and LOD), and this task does not create a commitment the
  Product Owner has not approved for the register. It is referenced in the `QAN-BL-CW-03` tombstone and in the locators.
  Issue #322 is not closed.
- **Untouched:** every other item, owner, severity and status. `QAN-BL-PROD-06` current truth is unchanged: GOV-REC-01
  adds no migration.
- **Latest index: 62 items; 26 / 4 / 10 / 22 by status, 31 / 29 / 2 by severity**, recounted mechanically from §4.

**Stage 6 WP0 governance admission (2026-10-13; documentation / governance only; from `main` at
`135142004097136336d586e5d5ff6cfd119cd864`, the merge of PR #334; effective from the merge of the pull request that carries
it).** The Product Owner authorized WP0 of *Stage 6 — Matching & Introductions Kickoff*: research, anti-duplication and a
Product Decision Gate only. WP0 changes no Stage 6 lifecycle state (the locators still record Stage 6 as NEXT / not
started) and implements nothing: no runtime, migration, API, screen or frozen Product contract changes
([Stage 6 WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md)).

- **Admitted — `QAN-BL-LAUNCH-04`** (`HIGH`, `DEFERRED — OWNED`, owner `Stage 9 — Economy + Launch Closure
  (release-readiness gate)`): GitHub Issue #322, the physical-Android rapid-interaction and resize stability proof for the
  Shared and Public Living Analysis consumers. This is the Product Owner's explicit approval (WP0 brief §8) of the
  decision GOV-REC-01 left open (its record §7; the GOV-REC-01 paragraph above records the register before it). The
  anti-duplication check ran against the whole register first (§5 item). Issue #322 stays
  `OPEN / NOT PROVEN / RELEASE BLOCKER`; it is not closed, waived or reclassified, and SHARED-VIS-01 is not reopened. The
  `QAN-BL-CW-03` tombstone gains a dated pointer; its disposition is unchanged.
- **BG-05 at the kickoff (WP0 is not S6-01):** no open item names the WP0 or the Kickoff. `QAN-BL-MATCH-01` stays
  `DEFERRED — OWNED` by `S6-01 — Intelligent Matching Onboarding`, unchanged, because WP0 opens no implementation and does
  not resume S6-01. WP0 takes nothing toward users, so the reopen conditions of `QAN-BL-ACCT-01` and `QAN-BL-PROD-06` do
  not fire. It maps every inherited and adjacent item to the proposed Stage 6 tasks for the Product Owner's review (WP0
  record §8); none of that mapping is an assignment until the Product Owner approves it. The cross-task residue WP0 found
  — the Introduction-phase account-Name leak (record §2.5), the Stage 8A Matching conclusion producer with its AI-COST
  family and eval suite, and conditional others (record §8.5) — awaits the Product Owner's decision (record §10, GATE-03);
  none is admitted here. *(Decided the same day: the next paragraph records the Product Owner's GATE-03 decision and the
  two admissions it made.)*
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 63 items; 27 / 4 / 10 / 22 by status, 32 / 29 / 2 by severity**, recounted mechanically from §4.

**Stage 6 WP0 — Product Owner Tier 0 decisions and GATE-03 admissions (2026-10-13; documentation / governance only;
the same pull request as the paragraph above, PR #335; effective from its merge).** The Product Owner reviewed the WP0
record and approved the framework recommendations of GATE-01, GATE-02 and GATE-03
([WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14). The paragraph above stays as
the record of the register before that decision.

- **Admitted — `QAN-BL-MATCH-02`** (`HIGH`, `DEFERRED — OWNED`, owner `S6-02 — Introduction-Phase Privacy
  Isolation & Safe END Boundary`): the account Name exposure that phase-blind Stage 4 Shared reads and the Shared reply
  prompt would cause in an Introduction-phase World before `FULL_NAME`. It is latent, because no Introduction World can be born. It is the account
  Name exposure only (§5 item).
- **Admitted — `QAN-BL-MATCH-03`** (`HIGH`, `DEFERRED — OWNED`, owner `Stage 8A — QANDEEL AI Brain / Production LLM
  Runtime`): the Safe Compatibility Conclusion production capability, with its AI cost attribution and evaluation. Nothing
  produces a conclusion today, so no proposal can reach a recipient. It does not decide GATE-22 or GATE-23 (§5 item).
- **Anti-duplication:** both were checked before admission against the whole register (every item and tombstone, the §7
  paragraphs and the §9 closure records), the E2E gap matrix, the I-07 runtime record and open GitHub issues. Neither ID
  had been used.
- **Not admitted:** the conditional WP0 findings, which the Product Owner did not approve automatically:
  - Matching / Introductions export *(admitted later the same day as `QAN-BL-PRIV-04` at GATE-19; next paragraph)*;
  - the media / image pipeline;
  - the Arabic contact / sensitive floor;
  - orchestrator operational visibility;
  - the other §2.5 findings (an ended Introduction's closed history; the END route).

  The re-anchoring of the current-task pins and the WP0 §11 drift notes are not made here either.
- **GATE-01 and GATE-02 (recorded; no register effect beyond the two admissions):**
  - Stage 6 runs as S6-series execution tasks that consume the frozen I-07 runtime and the existing Connected Worlds
    authority, and it may prepare closed-by-default integration boundaries.
  - I-09 / Stage 9 retains launch authorization and gate opening.
  - `QAN-BL-MATCH-01` stays with `S6-01 — Intelligent Matching Onboarding`, unchanged.
  - Phase `I-08` is not declared closed.
  - Stage 6 may reach engineering integration completion with the production provider unbound, without fabricating
    conclusions, proposals or Introductions.
  - IMPLEMENTED / MERGED stays distinct from DEPLOYED / LAUNCH-READY.
  - Still open: the historical Return Gate (the "return gate" of the Product Owner's local notes, CI-02 … CI-05, not repository ids; WP0 record §6) and the S6-01 kickoff ordering need reconciliation, and whether S6-01 resumes
    or starts fresh (which decides when `QAN-BL-MATCH-01`'s automatic reopen fires) is undecided.
- **BG-05:** `QAN-BL-MATCH-02` is the second open item owned by a Stage 6 task, and `QAN-BL-MATCH-03` joins the Stage 8A
  items. The reopen conditions of `QAN-BL-ACCT-01` and `QAN-BL-PROD-06` do not fire.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 65 items; 29 / 4 / 10 / 22 by status, 34 / 29 / 2 by severity**, recounted mechanically from §4.

**Stage 6 WP0 — the Product Owner's consolidated final approval package and the GATE-19 admission (2026-10-13;
documentation / governance only; the same pull request, PR #335; effective from its merge).** The package restates the
Tier 0 approvals and decides every remaining WP0 gate (GATE-04 … GATE-37, GATE-39) at the level the WP0 record §14 states.
Each is recorded with the Product Owner's own label: APPROVED; APPROVED DIRECTION, NOT AN IMPLEMENTATION MECHANISM
(GATE-04); APPROVED PRODUCT INTENT, CONTROLLED ARCHITECTURE REQUIRED (GATE-11); APPROVED PRODUCT DIRECTION (GATE-23);
APPROVED AS INITIAL POLICY PROPOSAL (GATE-25). The package is APPROVED subject to the explicit architecture, privacy,
security and Copy Gate boundaries it states. It adds a binding QANDEEL-wide language rule for fixed
Arabic copy and approves the seven-task Stage 6 map as a planning direction
([WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14). It authorizes decision
recording and governance updates only: no implementation, migration, grant, API, screen, AI provider, frozen-contract
amendment, deployment or merge, and no S6-01 Task Contract. The paragraph above stays as the record of the register
before it.

- **Admitted — `QAN-BL-PRIV-04`** (`HIGH`, `DEFERRED — OWNED`, owner `S6-07 — Activity, Direct Entry and Final
  Integration`; owner and severity WP0's assignment under GATE-19, awaiting the Product Owner's confirmation). Export My Data omits the reader's
  Matching and Introductions data (GATE-19). It is `HIGH` because
  building it decides what crosses between two humans under frozen pair-privacy law. Today the export is truthful, since
  it names the category as not yet included (§5 item).
- **Owner names:** the owner strings are the Product Owner's approved task-map names, each subject to its task's own Task
  Contract. GATE-03 named S6-02 as `QAN-BL-MATCH-02`'s owner. GATE-19 named no owner: `QAN-BL-PRIV-04`'s assignment to
  S6-07, and its `HIGH` rating, are WP0's and await the Product Owner's confirmation.
- **Anti-duplication:** `QAN-BL-PRIV-04` was checked against all 65 earlier IDs, every tombstone, the §7 paragraphs and
  the §9 closure records (the I-07 record admitted none), the W3-PDG-01 and W3-MEGA-S records, the E2E gap matrix and the
  open GitHub issues. The ID had not been used.
- **Recorded in the WP0 record, not admitted.** Each of these is approved Product intent for a task's own scope, or a
  later-stage obligation that frozen authority already carries:
  - GATE-05: `QAN-BL-ACCT-01` stays `OPEN — UNASSIGNED`. A narrow deletion correction, if commissioned, needs a named
    owner first.
  - GATE-11: the onboarding-assistance permission waits for a controlled architecture amendment whose owner is not yet
    named.
  - GATE-26: the deterministic Arabic / English refusal floor must exist before any pre-Match disclosure path can
    operate.
  - GATE-35: Introduction material stays excluded from user-facing Replay until Stage 7 defines and approves its
    contract. WP0 reads the fence as S6-02 scope; only whether a register item is admitted for the Stage 7 contract is
    reconsidered at S6-02's closure.
  - GATE-36 and GATE-37 are Stage 9 obligations already carried by CW2-08 §13 / §20 and CW2-06 §57; the I-07 closure
    record refused to duplicate them.
  - GATE-29: `QAN-BL-VIS-01` and `QAN-BL-LAUNCH-04` bear only if S6-05 uses the Living Analysis stack.
  - The language rule's copy amendments are PROPOSED in a census of 109 units
    ([census](e2e/QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md)). Copy Gates are task-local. A QANDEEL-wide
    conformance sweep needs a Product Owner designation before any admission.
  - Observation: Shared, Public and Replay world-scoped export has no register owner. It is reported, not admitted.
- **BG-05:** `QAN-BL-PRIV-04` is the third open item owned by a Stage 6 task; S6-07 inherits it at its kickoff.
  `QAN-BL-MATCH-01` and `QAN-BL-ACCT-01` are unchanged, and the reopen conditions of `QAN-BL-ACCT-01` and
  `QAN-BL-PROD-06` do not fire.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 66 items; 30 / 4 / 10 / 22 by status, 35 / 29 / 2 by severity**, recounted mechanically from §4.

**Stage 6 WP0 — the Product Owner's final decision addendum (2026-10-13; documentation / governance only; the same pull
request, PR #335; effective from its merge).** The addendum records six decisions, D1–D6
([WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14.14). None authorizes
implementation. Neither planned workstream, LANG or S6, receives implementation authorization. The paragraph above stays
as the record of the register before it.
- **Confirmed — `QAN-BL-PRIV-04`** (D2): owner `S6-07 — Activity, Direct Entry and Final Integration`, and `HIGH`. Both
  were WP0's assignment until now. Its scope stays the reader's Matching and Introductions export only.
- **Admitted — `QAN-BL-PRIV-05`** (`HIGH`, `DEFERRED — OWNED`, owner `PRIV-EXPORT-01 — Export My Data: Understanding
  Resolution Facts`; D5): Export My Data omits the reader's Shared, Public and Replay world data. Replay is coordinated
  with Stage 7. It was checked against all 66 earlier IDs, every tombstone, the §7 paragraphs and the §9 rows, the
  W3-MEGA-S record, the E2E gap matrix and the open GitHub issues. The ID had not been used.
- **Direction recorded, not admitted — `QAN-BL-ACCT-01`** (D3): a separately owned correction path, provisionally
  `ACCT-DEL-01`; the id was verified unused. No real Matching enrollment happens before the deletion-blocking footprint
  is resolved. The item stays `UNASSIGNED` and `OPEN — UNASSIGNED` until the Product Owner confirms the name (dated note
  in §5).
- **No register item:**
  - D1 resolves GATE-16: Matching v1 proposes opposite-sex pairs only, on an explicitly declared and confirmed sex fact.
    The controlled architecture amendment it needs (CA-09) is recorded in the WP0 record.
  - D4 sets the default language of generated conversation.
  - D6 plans the LANG and S6 workstreams.
- **BG-05:** `PRIV-EXPORT-01` now owns four items, and S6-07 still owns one. `QAN-BL-MATCH-01` and `QAN-BL-PROD-06` are
  unchanged.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 67 items; 31 / 4 / 10 / 22 by status, 36 / 29 / 2 by severity**, recounted mechanically from §4.

**S6-01 CP1 (2026-10-13; the S6-01 pull request, not merged).** Under the Product Owner's S6-01 Final Implementation
Authorization, S6-01 is the current implementation task.
- **Admitted — `QAN-BL-MATCH-04`** (`HIGH`, `DEFERRED — OWNED`, owner `Stage 8A — QANDEEL AI Brain / Production LLM
  Runtime`; D7): understanding readiness before real Matching. Checked against all 67 earlier IDs, every tombstone, the
  §7 paragraphs and the §9 rows; the ID had not been used (§5 item).
- **Inherited — `QAN-BL-MATCH-01`:** unchanged until S6-01's closing change, which re-owns it (D1). It is not tombstoned
  while the six `0149` commands stay closed.
- **BG-05:** Stage 8A now owns five open items (`QAN-BL-CW-05`, `QAN-BL-IP-02`, `QAN-BL-ACE-02`, `QAN-BL-MATCH-03`,
  `QAN-BL-MATCH-04`). `QAN-BL-ACCT-01`, `QAN-BL-PROD-06` and `QAN-BL-PRIV-04` are unchanged.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 68 items; 32 / 4 / 10 / 22 by status, 37 / 29 / 2 by severity**, recounted mechanically from §4.

**S6-01 closing change (2026-10-14; the S6-01 pull request, not merged; effective from its merge).** BG-08 at S6-01's
closure ([S6-01 record](e2e/QANDEEL_S6_01_INTELLIGENT_MATCHING_ONBOARDING_IMPLEMENTATION_RECORD_v1.md) §10). The
paragraph above stays as the record of the register before it.
- **Re-owned — `QAN-BL-MATCH-01`:** from `S6-01` to `S6-07 — Activity, Direct Entry and Final Integration`, with a
  mandatory dependency on `ACCT-DEL-01` (D1). It is not tombstoned: the six `0149` commands stay closed. `HIGH` and
  `DEFERRED — OWNED` are unchanged.
- **Unchanged, with the dependency kept open:** `QAN-BL-ACCT-01` (`OPEN — UNASSIGNED`). The `ACCT-DEL-01` name still
  needs the Product Owner's confirmation (D3 note in §5). S6-01 neither closes nor absorbs it.
- **Checked and not admitted (BG-06):** S6-01 leaves no new qualifying cross-task residue.
  - Its deferrals already have owners: natural-language phrasing and understanding readiness (`QAN-BL-MATCH-04`), the
    compatibility conclusion (`QAN-BL-MATCH-03`), the export of the preparation draft (`QAN-BL-PRIV-04`), enrollment and
    the Introductions Settings group (`QAN-BL-MATCH-01`), and gate opening (CW2-08 / Stage 9).
  - Its Copy Gate rows were an active-task decision and stayed in the task (BG-01). The Product Owner approved them
    7 / 7 on 2026-10-14, so the gate is closed and nothing passes to a successor.
  - An optional D2R §1 light amendment is a possible future Product decision, not an obligation.
- **BG-05:** `S6-07` now owns two open items (`QAN-BL-PRIV-04`, `QAN-BL-MATCH-01`). S6-01 owns none.
- **Untouched:** every other item, owner, severity and status. This includes `QAN-BL-PROD-06`, `QAN-BL-MATCH-02`,
  `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN).
- **Latest index: 68 items; 32 / 4 / 10 / 22 by status, 37 / 29 / 2 by severity**, recounted mechanically from §4. A
  re-owning changes no count.

**S6-02 closing change (2026-10-15; the S6-02 pull request, not merged; effective from its merge).** BG-08 at S6-02's
closure ([S6-02 record](e2e/QANDEEL_S6_02_IMPLEMENTATION_RECORD_v1.md) §10). S6-01 merged as PR #339
(`2224c47f3dc83b16ad011ccbbdcf2aac19bf41f5`, 2026-10-14), so its re-owning of `QAN-BL-MATCH-01` holds. The paragraph
above stays as the record of the register before it.
- **Tombstoned — `QAN-BL-MATCH-02`** (§6), with the Product Owner's stricter decision A recorded as a dated amendment in
  its §5 block. It is S6-02's only inherited item.
- **Admitted — `QAN-BL-MATCH-05`** (`HIGH`, `DEFERRED — OWNED`, owner `S6-03 — Matching Proposal Pipeline &
  Intelligence Prerequisites`; D2): the confirmed Introduction First Name is not yet the canonical Matching first-name
  source. Checked against all 68 earlier IDs; the ID had not been used (§5 item). No new task is opened.
- **Checked and not admitted (BG-06):** the Introduction surfaces that consume the projection, the END mobile surface and
  the Introduction closed history are S6-05's by the approved task map; `FULL_NAME` display consent is S6-06's; Activity
  producers and Direct Entry are S6-07's; the Replay product is Stage 7's (GATE-35). Each is that task's own Task Contract
  scope, not a residue S6-02 leaves. The S5-02 Public authoring era rule is applied fail-closed and reported for the
  Product Owner's confirmation (record §9); it is not an open obligation.
- **BG-05:** `S6-03` owns one open item (`QAN-BL-MATCH-05`); `S6-07` still owns two (`QAN-BL-PRIV-04`, `QAN-BL-MATCH-01`);
  S6-02 owns none from the merge.
- **Untouched:** every other item, owner, severity and status. This includes `QAN-BL-ACCT-01`, `QAN-BL-PROD-06`,
  `QAN-BL-MATCH-01`, `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN).
- **Latest index: 69 items; 32 / 4 / 10 / 23 by status, 38 / 29 / 2 by severity**, recounted mechanically from §4.

**S6-03 closing change (2026-10-15; the S6-03 pull request, not merged; effective from its merge).** BG-08 at S6-03's
closure ([S6-03 record](e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md) §9). S6-02 merged as PR #340 (`8e85b40dcf9b4ba35439f9424997ad0c3a0c1113`, 2026-10-15), so its
tombstone of `QAN-BL-MATCH-02` and its admission of `QAN-BL-MATCH-05` hold. The paragraph above stays as the record of the
register before it.
- **Tombstoned — `QAN-BL-MATCH-05`** (§6). It is S6-03's only inherited item.
- **Dated notes, owners unchanged:** `QAN-BL-MATCH-01` (the writer interface S6-07 wraps, and the R5 obligations),
  `QAN-BL-ACCT-01` and `QAN-BL-PRIV-04` (the three new relations in each footprint), each in its §5 block.
- **Checked and not admitted (BG-06):** policy values and activation, the legal adult threshold and any re-proposal
  relaxation are Stage 9's by the approved roadmap and CW2-06B-12; CW2-08 clearance is the CW2-08 runtime's; the neutral
  proposal copy is the S6-04 Copy Gate's; the real conclusion producer and understanding readiness stay
  `QAN-BL-MATCH-03` / `QAN-BL-MATCH-04`. Each already has its owner, and the Task Contract creates no new Backlog ID
  (§7.1, §9.1). The privacy floor's documented false positives are the accepted fail-closed cost, not an obligation.
- **BG-05:** S6-03 owns no open item from the merge; `S6-07` still owns two (`QAN-BL-PRIV-04`, `QAN-BL-MATCH-01`).
- **Untouched:** every other item, owner, severity and status. This includes `QAN-BL-PROD-06`, `QAN-BL-MATCH-03`,
  `QAN-BL-MATCH-04` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN).
- **Latest index: 69 items; 31 / 4 / 10 / 24 by status, 38 / 29 / 2 by severity**, recounted mechanically from §4.

**S6-04 (2026-10-15; the S6-04 pull request, not merged).** BG-08 at S6-04 ([S6-04 record](e2e/QANDEEL_S6_04_IMPLEMENTATION_RECORD_v1.md) §9). S6-03 merged as PR #341
(`869b3ca63ec8dde830aaa31847588e7f03b55d05`, 2026-10-15), so its tombstone of `QAN-BL-MATCH-05` holds. The paragraph above stays as
the record of the register before it.
- **Inherited:** none (BG-05: no item is owned by `S6-04`).
- **Checked and not admitted (BG-06):** the second recipient's acceptance, the Mutual Match and the Introduction surfaces
  (S6-05, the approved task map); Activity, Direct Entry and notifications for a delivered proposal (S6-07); the real
  conclusion producer (Stage 8A); launch clearance, policies and limits (Stage 9 / CW2-08); the S6-04 Product Copy Gate was
  this task's own gate, closed by the Product Owner on 2026-10-15 (M-01's future display is Stage 8A-conditioned). Each
  has its owner.
- **Proposed, awaiting the Product Owner (not admitted):** a physical-device TalkBack proof of the S6-04 surfaces (the
  emulator run is not one), and finding F-1 — programmatic screen-reader focus not reliably honoured, a pattern shared by
  every surface ([S6-04 record](e2e/QANDEEL_S6_04_IMPLEMENTATION_RECORD_v1.md) §3.2, §10). The index below is unchanged
  until the Product Owner decides.
- **Untouched:** every item, owner, severity and status, including `QAN-BL-PROD-06`, `QAN-BL-ACCT-01`, `QAN-BL-PRIV-04`,
  `QAN-BL-MATCH-01`, `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN). S6-04 adds no
  relation, so no deletion or export footprint changes.
- **Latest index: 69 items; 31 / 4 / 10 / 24 by status, 38 / 29 / 2 by severity**, unchanged.

**S6-05 CP2 (2026-10-16; the S6-05 pull request, not merged; effective from its merge).** BG-06 / BG-08 at S6-05's CP2
([S6-05 record](e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md) §7). S6-04 merged as PR #342
(`35ad4e19ad7e449255e7d087d4420b5d3775cf86`, 2026-10-15). The paragraph above stays as the record of the register before it.
- **Inherited:** none (BG-05: no item is owned by `S6-05`).
- **Admitted — `QAN-BL-MATCH-06`** (`HIGH`, `DEFERRED — OWNED`, owner `S6-07 — Activity, Direct Entry and Final
  Integration`; the Product Owner's R-4, 2026-10-15): no runtime producer forwards a first-approved proposal to the second
  recipient (§5 item). Checked against all 69 earlier IDs; the ID had not been used.
- **Checked and not admitted (BG-06):** the Introduction reads and messaging, END on mobile and the closed history, and the
  mobile surfaces are S6-05's own later checkpoints (CP3 – CP5); Activity, Push and Direct Entry stay S6-07's; photos,
  disclosure, SUCCESS and reactivation S6-06's; Introduction intelligence Stage 8A's (GATE-30, R-1). Each has its owner.
- **BG-05:** `S6-07` now owns three open items (`QAN-BL-PRIV-04`, `QAN-BL-MATCH-01`, `QAN-BL-MATCH-06`).
- **Untouched:** every other item, owner, severity and status, including `QAN-BL-PROD-06`, `QAN-BL-ACCT-01`,
  `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN). S6-05 CP2 adds no relation, so no
  deletion or export footprint changes.
- **Latest index: 70 items; 32 / 4 / 10 / 24 by status, 39 / 29 / 2 by severity**, recounted mechanically from §4.

**S6-05 closing change (CP5, 2026-10-16; the S6-05 pull request, not merged; effective from its merge).** BG-08 / BG-09 at
S6-05's closure, in its last checkpoint ([S6-05 record](e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md) §16), under the
Product Owner's checkpoint rule (no separate documentation task). The paragraph above stays as the record of the register
before it.
- **Inherited:** none (BG-05: no item named `S6-05` at kickoff), so nothing is tombstoned or re-owned.
- **Admitted by S6-05:** `QAN-BL-MATCH-06` only (CP2; owner `S6-07`, the Product Owner's R-4); unchanged by CP3 – CP5.
- **Checked and not admitted (BG-06):** photos, progressive disclosure, SUCCESS and reactivation (S6-06); Activity, Push,
  Direct Entry and the forward producer (S6-07, `QAN-BL-MATCH-06`); Introduction intelligence (Stage 8A, R-1); launch
  clearance, policies and limits (Stage 9 / CW2-08). Each is that task's own Task Contract scope. GATE-29: S6-05 uses no
  Living Analysis stack (V-1, no field), so `QAN-BL-VIS-01` and `QAN-BL-LAUNCH-04` do not bear on it. The proof of the
  mobile surfaces on a physical device with TalkBack / VoiceOver is the same proposal S6-04 left with the Product Owner
  (record §15.7); it is reported, not admitted.
- **BG-05:** S6-05 owns no open item from its merge; `S6-07` owns three (`QAN-BL-PRIV-04`, `QAN-BL-MATCH-01`,
  `QAN-BL-MATCH-06`).
- **Untouched:** every other item, owner, severity and status, including `QAN-BL-PROD-06`, `QAN-BL-ACCT-01`,
  `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN). S6-05's migrations
  (`0159` – `0161`) create functions only and no relation, so no deletion or export footprint changes.
- **Latest index: 70 items; 32 / 4 / 10 / 24 by status, 39 / 29 / 2 by severity**, unchanged.

**S6-06 CP1 (2026-10-16; the S6-06 pull request, not merged; effective from its merge).** Under the Product Owner's
checkpoint rule (every checkpoint updates the record and the locators; the last one closes BG-08 / BG-09)
([S6-06 record](e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md) §8). S6-05 merged as PR #343 (`88a475ab`).
- **Inherited (BG-05):** no item names `S6-06`. The scope earlier tasks assigned it as "checked and not admitted" -
  photos, progressive disclosure, SUCCESS, reactivation and the `FULL_NAME` display consent (S6-02 A / A1) - is S6-06's
  own Task Contract scope and is delivered by `0162` / `0163` (D-09).
- **Admitted:** `QAN-BL-PROD-08` (`HIGH`, `DEFERRED — OWNED`, owner `HOSTED-DEPLOY-01`): the hosted Supabase Storage
  provisioning and live conformance of the photo object store (D-01).
- **Dated notes:** `QAN-BL-ACCT-01` and `QAN-BL-PRIV-04` record the new `0162` relations and the stored photo objects in
  their deletion and export footprints; owners, severities and statuses unchanged.
- **Untouched:** every other item, owner, severity and status, including `QAN-BL-PROD-06`, `QAN-BL-MATCH-01`,
  `QAN-BL-MATCH-06` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN).
- **Latest index: 71 items; 33 / 4 / 10 / 24 by status, 40 / 29 / 2 by severity**, recounted mechanically from §4.


**S6-06 closing change (CP2, 2026-10-17; the S6-06 pull request, not merged; effective from its merge).** BG-08 / BG-09 at
S6-06's closure, in its last checkpoint ([S6-06 record](e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md) §15), under the
Product Owner's checkpoint rule (no separate documentation task). The paragraph above stays as the record of the register
before it.
- **Inherited:** none (BG-05: no item named `S6-06` at kickoff), so nothing is tombstoned or re-owned. The scope earlier
  tasks assigned to S6-06 - photos, progressive disclosure, SUCCESS, reactivation and the `FULL_NAME` display consent -
  is delivered by CP1 (`0162`, `0163`, the API) and CP2 (mobile).
- **Admitted by S6-06:** `QAN-BL-PROD-08` (CP1; owner `HOSTED-DEPLOY-01`, unchanged) and, at this closure,
  `QAN-BL-LAUNCH-05` (`MEDIUM`, `DEFERRED — OWNED`, owner `Stage 9 — Economy + Launch Closure (release-readiness gate)`): the iOS photo-cache proof and the store
  review of the purpose strings (§5). Checked against all 71 earlier IDs; the ID had not been used.
- **Checked and not admitted (BG-06):** a SUCCESS producer and real transitions (Stage 8A, GATE-33); photo moderation and
  launch clearance (CW2-08 / Stage 9); Activity, Push and Direct Entry for shares (S6-07); the physical Android / TalkBack
  proof (the proposal S6-04 and S6-05 left with the Product Owner; reported, not admitted). Each has its owner.
- **BG-05:** S6-06 owns no open item from its merge; `S6-07` owns three (`QAN-BL-PRIV-04`, `QAN-BL-MATCH-01`,
  `QAN-BL-MATCH-06`).
- **Untouched:** every other item, owner, severity and status, including `QAN-BL-PROD-06`, `QAN-BL-ACCT-01`,
  `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and `QAN-BL-LAUNCH-04` (Issue #322 stays OPEN). CP2 adds no relation, so no
  deletion or export footprint changes beyond CP1's dated notes.
- **Latest index: 72 items; 34 / 4 / 10 / 24 by status, 40 / 30 / 2 by severity**, recounted mechanically from §4.

**ACCT-DEL-01 CP1 (2026-10-17; the ACCT-DEL-01 pull request, not merged; effective from its merge).** Under the Product
Owner's checkpoint rule ([ACCT-DEL-01 record](e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md) §6). S6-06 merged as
PR #344 (`4233c067`).
- **Inherited (BG-05):** `QAN-BL-ACCT-01`, re-owned in this change from `OPEN — UNASSIGNED` to `DEFERRED — OWNED`
  (owner `ACCT-DEL-01`), with its index-row pin; it stays open (P-1) and is dispositioned at CP2.
- **Admitted:** none in CP1.
- **Untouched:** every other item, owner, severity and status, including `QAN-BL-MATCH-01` (its dependency is recorded
  as met at CP2), `QAN-BL-PROD-06` and `QAN-BL-PROD-08`.
- **Latest index: 72 items; 35 / 4 / 9 / 24 by status, 40 / 30 / 2 by severity**, recounted mechanically from §4.

**ACCT-DEL-01 closing change (CP2, 2026-10-17; PR #345, not merged; effective from its merge).** BG-08 / BG-09 at
ACCT-DEL-01's closure, in its last checkpoint
([ACCT-DEL-01 record](e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md) §8), under the Product Owner's checkpoint rule
(no separate documentation task). The Product Owner approved CP1 on its exact head `90681312` (API CI `39030890618`,
Mobile CI `39030890572`, both green). The paragraph above stays as the record of the register before it.
- **Inherited (BG-05):** `QAN-BL-ACCT-01`. **Re-owned, not tombstoned** (P-1):
  - the Matching / Introductions part is delivered;
  - Shared `STANDARD` and Public stay with this item, now owned by `ACCT-DEL-02 — Account Deletion Across Shared
    STANDARD / Public`;
  - Replay is admitted separately (below), so that each residue has one owner (BG-02).

  The item's index-row pins in the contracts that read it are re-anchored in the same change.
- **Admitted (BG-06, at the Product Owner's designation):**
  - `QAN-BL-ACCT-02` (`HIGH`; owner `Stage 7 — Replay`): Replay's account-deletion module;
  - `QAN-BL-PROD-09` (`HIGH`; owner `HOSTED-DEPLOY-01`): no World opens in production without an automated, fail-closed
    account-deletion coverage check on the hosted project, together with the erasure's hosted bound.

  Both IDs were checked against all 72 earlier IDs and the history of every ref; neither had been used.
- **Dated notes:**
  - `QAN-BL-MATCH-01`: its `ACCT-DEL-01` dependency is met in engineering. The six commands, CW2-08 and every gate stay
    closed.
  - `QAN-BL-PROD-06`: the four new `service_role` entry points let no deterministic `40001` escape.
  - `QAN-BL-PROD-08`: the erasure's second photo level waits on the hosted object store.
  - `QAN-BL-PRIV-04`: the counterpart's retained view joins the export footprint.
- **Checked and not admitted (BG-06):**
  - the retained view in `Export My Data` (`QAN-BL-PRIV-04`, `S6-07`, which already covers the reader's Introductions
    data; recorded there as a dated note);
  - registering S6-07's new relations in the coverage registry (enforced by CI and recorded on `QAN-BL-MATCH-01`; no
    item is needed);
  - the hosted `NOT_DEPLOYED` state (`HOSTED-DEPLOY-01`).
- **BG-05:** ACCT-DEL-01 owns no open item from its merge.
  - `ACCT-DEL-02` owns `QAN-BL-ACCT-01`.
  - `Stage 7 — Replay` owns `QAN-BL-ACCT-02`.
  - `HOSTED-DEPLOY-01` owns `QAN-BL-PROD-06`, `QAN-BL-PROD-08` and `QAN-BL-PROD-09`.
  - `S6-07` keeps `QAN-BL-PRIV-04`, `QAN-BL-MATCH-01` and `QAN-BL-MATCH-06`.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 74 items; 37 / 4 / 9 / 24 by status, 42 / 30 / 2 by severity**, recounted mechanically from §4.

**S6-07 closing change (CP4, 2026-10-18; PR #346, not merged; effective from its merge).** BG-08 / BG-09 at S6-07's
closure, in its last checkpoint ([S6-07 record](e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12.9), under the Product Owner's checkpoint rule (no separate documentation
task). The Product Owner closed CP3 on its exact head `3aaad0fd` (API CI and Mobile CI green). The paragraph above stays
as the record of the register before it.
- **Inherited (BG-05):** `QAN-BL-MATCH-01`, `QAN-BL-MATCH-06`, `QAN-BL-PRIV-04` - all three **`CLOSED — TOMBSTONE`**, each
  with its §6 record (holding from the merge of PR #346). A3-01 G-17 is closed (its Exit Gate delivered in CP3). The
  index-row pin of `QAN-BL-MATCH-01` in the SEC-MATCH-00 contract is re-anchored in the same change.
- **Admitted (BG-06 / BG-08, as the approved CP0 addendum designated):**
  - `QAN-BL-PROD-10` (`MEDIUM`; owner `HOSTED-DEPLOY-01`): a photo object lost from the store blocks its owner's export
    bundle with a visible `503`;
  - `QAN-BL-LAUNCH-06` (`MEDIUM`; owner `Stage 9 — Economy + Launch Closure (release-readiness gate)`): the export folder
    save on iOS, physical Android devices and read-only places, and a failed rollback.

  Both IDs were checked against every earlier ID and the history of every ref; neither had been used.
- **Checked and not admitted (BG-06):** the Shared / Public / Replay export categories (`QAN-BL-PRIV-05`, unchanged); the
  conclusion producer (`QAN-BL-MATCH-03`, unchanged); opening the `ENROLLMENT` gate, installing the approved consent
  texts on the hosted environment and clearing CW2-08 (Stage 9 launch acts under CW2-08 and LS-02); CA-EXP′ (a Product
  Owner decision, approved on 2026-10-18; it leaves no obligation).
- **BG-05:** S6-07 owns no open item from its merge. `HOSTED-DEPLOY-01` owns `QAN-BL-PROD-06`, `QAN-BL-PROD-08`,
  `QAN-BL-PROD-09` and `QAN-BL-PROD-10`; Stage 9 owns `QAN-BL-LAUNCH-04`, `QAN-BL-LAUNCH-05` and `QAN-BL-LAUNCH-06`.
- **Untouched:** every other item, owner, severity and status, including `QAN-BL-ACCT-01`, `QAN-BL-ACCT-02`,
  `QAN-BL-PRIV-05` and `QAN-BL-MATCH-03` (Issue #322 stays OPEN).
- **Latest index: 76 items; 36 / 4 / 9 / 27 by status, 42 / 32 / 2 by severity**, recounted mechanically from §4.

**S7-01 closing change (2026-10-19; not merged; effective from its merge).** BG-08 / BG-09 at S7-01's closure
([S7-01 record](e2e/QANDEEL_S7_01_IMPLEMENTATION_RECORD_v1.md) §10), under the Product Owner's checkpoint rule (no separate
documentation task). The paragraph above stays as the record of the register before it. The §7 table, last refreshed at
ACCT-DEL-01, is recounted in the same change.
- **Inherited (BG-05):** `QAN-BL-ACCT-02` (`Stage 7 — Replay`) - **`CLOSED — TOMBSTONE`** for the Personal Replay, with
  its §6 record (holding from the merge). Its index-row pin in the ACCT-DEL-01 contract is re-anchored in the same change.
- **Admitted (BG-06 / BG-08):** `QAN-BL-ACCT-03` (`HIGH`; owner `Stage 9 — Economy + Launch Closure (Replay distribution /
  CW2-08)`): the account erasure of non-Personal Replay sources and Replay distribution, the residue class
  `REPLAY_OUTSIDE_PERSONAL` that S7-01 cannot cover without overriding another human's right. The ID was checked against
  every earlier ID and the history of every ref.
- **Dated note:** `QAN-BL-PRIV-05`: the Replay coordination interface and data boundaries (no field changed; S7-01 adds no
  export).
- **Checked and not admitted (BG-06):**
  - the open-head consequence (the newest message of a conversation can be replayed only once a newer one exists). It is
    the frozen I-06 / `0072` sealing law, answered as `MOMENT_NOT_SEALED`, and a Product presentation matter for S7-02 /
    S7-03 (record §8);
  - opening the Personal Replay capability (an operator act behind the Product Owner's approval; the gate ships with no
    row);
  - `QAN-BL-NAV-02` (`OPEN — UNASSIGNED`, unchanged): the WP0 places its reconciliation at S7-05;
  - `QAN-BL-PROD-09` and `QAN-BL-PROD-06` (`HOSTED-DEPLOY-01`, unchanged): S7-01's five commands let no `40001` / `PT409`
    escape (`verify-migration-0150`, re-anchored).
- **BG-05:** S7-01 owns no open item from its merge. Stage 9 owns `QAN-BL-ACCT-03`; `PRIV-EXPORT-01` keeps
  `QAN-BL-PRIV-05`; `HOSTED-DEPLOY-01` keeps `QAN-BL-PROD-06` and `QAN-BL-PROD-09`.
- **Untouched:** every other item, owner, severity and status, including `QAN-BL-ACCT-01`, `QAN-BL-NAV-02`,
  `QAN-BL-VOICE-01` and `QAN-BL-PRIV-05`'s fields.
- **Latest index: 77 items; 36 / 4 / 9 / 28 by status, 43 / 32 / 2 by severity**, recounted mechanically from §4.

**S7-02 closing change (2026-10-19; not merged).** BG-08 / BG-09 at S7-02's closure
([S7-02 record](e2e/QANDEEL_S7_02_IMPLEMENTATION_RECORD_v1.md) §10), under the Product Owner's checkpoint rule (no separate
documentation task). S7-01 merged through PR #347 as `c152cb4b5add0b47b080ae952b7f97ee3dbf866d`, so the paragraph above
is effective; it stays as written.
- **Inherited (BG-05):** none owned. Read in full: `QAN-BL-NAV-02` (`OPEN — UNASSIGNED`, unchanged, with a dated S7-02
  note in §4), `QAN-BL-ACCT-03`, `QAN-BL-PRIV-05` and `QAN-BL-VOICE-01` (untouched).
- **Admitted (BG-06 / BG-08):** none.
- **Checked and not admitted (BG-06):** each is placed in a named Stage 7 task by the S7-02 record's S7-03 handover (§11):
  - the same Replay entry at the Analysis depth (the S7-02 control is in the Conversation chrome only; the Analysis
    surfaces are untouched): S7-04, the production player and navigation;
  - the presentation of `MOMENT_NOT_SEALED` and `ANALYSIS_UNAVAILABLE` at preview: S7-03 (S7-02 states the open-head
    limit at selection only);
  - a device / TalkBack proof of the entry and selection: S7-04's production proof, before any user opening;
  - opening the Personal Replay capability: an operator act behind the Product Owner's approval (no gate row);
  - the S7-02 Product Copy Gate: S7-02's own gate, closed by the Product Owner on 2026-10-19 (every Arabic row
    APPROVED word for word; the English rows keep their earlier status). It is no backlog item.
- **Carried and honoured:** `QAN-BL-PROD-09` stays `HOSTED-DEPLOY-01`'s; `CW2-08` is not changed or opened
  (`NOT_EVALUATED`).
- **BG-05:** S7-02 owns no open item.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 77 items; 36 / 4 / 9 / 28 by status, 43 / 32 / 2 by severity**, unchanged.

**S7-03 closing change (2026-10-19; not merged).** BG-08 / BG-09 at S7-03's closure
([S7-03 record](e2e/QANDEEL_S7_03_IMPLEMENTATION_RECORD_v1.md) §10), under the Product Owner's checkpoint rule (no separate
documentation task). S7-02 merged through PR #348 as `3ad4e4143264f1af7a5fd759ccb0102f1b98d087`, so the paragraph above
is effective; it stays as written.
- **Inherited (BG-05):** none owned. Read in full: `QAN-BL-NAV-02` (`OPEN — UNASSIGNED`, unchanged, with a dated S7-03
  note in §4), `QAN-BL-ACCT-03`, `QAN-BL-PRIV-05` and `QAN-BL-VOICE-01` (untouched). S7-02's two S7-03 placements are
  discharged: the presentation of `MOMENT_NOT_SEALED` and `ANALYSIS_UNAVAILABLE` at preview is delivered as the
  composite's preview limits.
- **Admitted (BG-06 / BG-08):** none.
- **Checked and not admitted (BG-06):** each is placed in a named Stage 7 task by the S7-03 record's S7-04 handover (§11):
  - a Reading's `scope` carries the source conversation's session id across the Replay wire (finding F-2; the
    composite neither reads nor shows it; it is the creator's own conversation, served creator-exact): S7-04 decides, with
    the Product Owner, before any user opening, whether the wire keeps it;
  - `omittedBefore` is always 0 on the real Personal path (finding F-1; one contiguous range of whole messages), so a
    gap was shown only on a labelled derived specimen: no obligation, recorded as the reason the specimen exists;
  - inspection, the Timeline, the player and its navigation inside the composite (the adapter's bridge leaves inspection
    fail-closed and draws no Timeline): S7-04;
  - a real-device and TalkBack proof of the composite: S7-04's production proof, before any user opening;
  - the S7-03 Product Copy Gate: S7-03's own gate, CLOSED by the Product Owner on 2026-10-19 (all 14 Arabic rows
    APPROVED word for word; the English rows stay PROPOSED). It is no backlog item.
- **Carried and honoured:** `QAN-BL-PROD-09` stays `HOSTED-DEPLOY-01`'s; `CW2-08` is not changed or opened
  (`NOT_EVALUATED`); the Personal Replay capability stays closed (no gate row).
- **BG-05:** S7-03 owns no open item.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 77 items; 36 / 4 / 9 / 28 by status, 43 / 32 / 2 by severity**, unchanged.

**S7-04 closing change (2026-10-20; not merged).** BG-08 / BG-09 at S7-04's closure
([S7-04 record](e2e/QANDEEL_S7_04_IMPLEMENTATION_RECORD_v1.md) §10), under the Product Owner's checkpoint rule (no separate
documentation task). S7-03 merged through PR #349 as `0d8a73350f075402897421e9ebb88379fe165575`, so the paragraph above
is effective; it stays as written.
- **Inherited (BG-05):** none owned. Read in full: `QAN-BL-NAV-02` (`OPEN — UNASSIGNED`, unchanged, with a dated S7-04
  note in §4), `QAN-BL-ACCT-03`, `QAN-BL-PRIV-05` and `QAN-BL-VOICE-01` (untouched). S7-03's S7-04 placements are
  discharged or placed: the player and its navigation are delivered (inspection stays fail-closed; the composite still
  draws no Timeline, by the Product Owner's visual direction); F-2 is assessed — the player and the composite never read,
  show, log or send the Reading scope — and its wire question is placed below; the device proof is placed below.
- **Admitted (BG-06 / BG-08):** none.
- **Discharged within S7-04 (Product Owner decision, 2026-10-20), neither a backlog item:** G-1 — while a fresh draft
  existed, the 0169 list wrapper answered `current_version_finalized = false` beside a null version and the S7-01 summary
  decoder refused it, so the conversation list failed closed; the decoder now reads exactly that answer as "no version
  yet" and still refuses a contradiction (record §5B; no migration); and the S7-04 Product Copy Gate — CLOSED, all 13
  rows APPROVED in Arabic and English (record §7).
- **Checked and not admitted (BG-06):** each is placed in S7-05 by the S7-04 record's handover (§11), before any user
  opening:
  - F-2's wire question (whether the Replay wire keeps `CONVERSATION_SESSION:<sessionId>` in a Reading's scope): an API
    decision for the Product Owner, S7-05;
  - a real-device and TalkBack proof of the entry, the selection, the composite, the player and the Spine: S7-05;
  - F-1 (`omittedBefore` always 0 on the real path) is no obligation.
- **Carried and honoured:** `QAN-BL-PROD-09` stays `HOSTED-DEPLOY-01`'s; `CW2-08` is not changed or opened
  (`NOT_EVALUATED`); the Personal Replay capability stays closed (no gate row).
- **BG-05:** S7-04 owns no open item.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 77 items; 36 / 4 / 9 / 28 by status, 43 / 32 / 2 by severity**, unchanged.

**S7-05 closing change (2026-10-20; PR #351, not merged; effective from its merge).** BG-05 / BG-08 / BG-09 at S7-05's
closure ([S7-05 record](e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md) §10), under the Product Owner's checkpoint rule (no separate documentation task). S7-04 merged
through PR #350 as `f9bc3947d840646385c618ea8db400914ca5aac4`, so the paragraph above is effective; it stays as written.
- **Inherited (BG-05):** none owned. Claimed by the Product Owner's D4: `QAN-BL-NAV-02`. Read in full and left unchanged:
  `QAN-BL-ACCT-03`, `QAN-BL-PRIV-05`, `QAN-BL-PROD-09` and `QAN-BL-VOICE-01`. S7-04's two S7-05 placements are
  discharged: F-2's wire question is decided (D1, Option B) and implemented; the real-device proof is delivered (D3),
  with TalkBack `NOT REQUIRED FOR S7-05 — PRODUCT OWNER WAIVER` (2026-10-20).
- **Tombstoned:** `QAN-BL-NAV-02` (§6), completed for the Personal Analysis Replay; Shared and Public World Replay,
  media and distribution are outside it.
- **Admitted (BG-06 / BG-08):** `QAN-BL-RSP-03` — the Arabic Global Switcher's words drawn truncated on the Product Owner's
  phone, found independently during the device proof (`UNASSIGNED`, `HIGH`).
- **Checked and not admitted (BG-06):**
  - TalkBack on the device: waived for S7-05 by the Product Owner, who directed that it is no defect, no blocker, no
    backlog item and not moved to Stage 9.
  - Shared and Public World Replay: the Stage 7 WP0's anti-scope (`MY_WORLD` only) and D4's exclusion. No canonical
    document defers it to a named task, so it waits for a Product Owner designation.
  - Two proof-harness limits, not Product obligations: the whole conversation's save, which the captured journey never
    made, and the open-head draft's captured coverage.
  - One full-suite Jest run in which a suite failed with no failing test; it did not recur.
- **Carried and honoured:** `QAN-BL-PROD-09` stays `HOSTED-DEPLOY-01`'s; `CW2-08` is not changed or opened
  (`NOT_EVALUATED`); the Personal Replay capability stays closed (no gate row).
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 78 items; 36 / 4 / 9 / 29 by status, 44 / 32 / 2 by severity.**

**S8A-01 CP2 change (2026-10-21; the S8A-01 pull request, not merged; effective from its merge).** BG-05 / BG-06 at S8A-01's
CP1–CP3 ([S8A-01 record](e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §10), under the
Product Owner's checkpoint rule. S7-05 merged through PR #351 as `daa5c415cb1d3bbbb987ea6e9ce750ceb43768dd`, so the
paragraph above is effective; it stays as written.
- **Inherited (BG-05):** none owned by name. Read in full and left as they stand (owner Stage 8A, not claimed by S8A-01's
  contract): `QAN-BL-CW-05`, `QAN-BL-IP-02`, `QAN-BL-ACE-02`, `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04`. `QAN-BL-INTEL-02`:
  reopen condition 4 not triggered (the reply is bound; the intent and candidate providers are unchanged).
  `QAN-BL-VOICE-01`: untouched.
- **Admitted (BG-06 / BG-08), at the Product Owner's CP0 decisions 3 and 5:** `QAN-BL-AI-01` (DeepSeek real-user
  enablement, `HIGH`, Stage 8A; Stage 9 approves the compliance surfaces and the final release requirements), `QAN-BL-AI-02` (the background calls still on OpenAI / Gemini, `HIGH`, Stage 8A),
  `QAN-BL-AI-03` (time-of-day pricing, `MEDIUM`, Stage 9).
- **Checked and not admitted (BG-06):** the real-model evaluation of the existing Golden and preference suites with
  accounted DeepSeek calls is already `QAN-BL-IP-02` / `QAN-BL-ACE-02` (Stage 8A); CP4 is S8A-01's own checkpoint.
- **Not yet reconciled:** BG-08 / BG-09 at S8A-01's closing checkpoint (CP4).
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 81 items; 39 / 4 / 9 / 29 by status, 46 / 33 / 2 by severity.**

**S8A-01 closing change (2026-10-21; the S8A-01 pull request, not merged; effective from its merge).** BG-08 / BG-09 at
CP4, S8A-01's closing checkpoint ([S8A-01 record](e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md) §8, §10), after the Product Owner's DEEP decision (2026-10-21). The CP2
paragraph above stays as written.
- **Inherited (BG-05), reconciled (BG-08):** S8A-01 owned no item by name.
  - `QAN-BL-CW-05`, `QAN-BL-IP-02`, `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04` and `QAN-BL-VOICE-01` stay deferred as
    they stand: S8A-01's contract claims none of them.
  - `QAN-BL-ACE-02` stays `VALIDATION — OPEN` and carries CP4's observations as evidence (the dialect drift and the
    long Markdown DEEP replies). S8A-01 runs no Golden evaluation.
  - `QAN-BL-INTEL-02`: reopen condition 4 is not triggered.
- **S8A-01's own admissions:** owned, not closed by S8A-01, since none is S8A-01's work.
  - `QAN-BL-AI-01` stays Stage 8A's: the privacy and disclosure requirements, as the Product Owner decided.
  - `QAN-BL-AI-02` stays Stage 8A's.
  - `QAN-BL-AI-03` stays Stage 9's.
- **Admitted (BG-06 / BG-08):** `QAN-BL-AI-04` (Shared and Public World DEEP replies keep the 10 s budget under
  DeepSeek; `MEDIUM`, Stage 8A). It is the residue of the Product Owner's DEEP decision, which raised the Personal
  budget only.
- **Checked and not admitted:** the DEEP budget itself is S8A-01's own work, delivered (Personal DEEP 20 s).
- **Reconciled in §9:** the Stage 8A row now lists `QAN-BL-AI-01`, `QAN-BL-AI-02` and `QAN-BL-AI-04`, and the Stage 9
  row lists `QAN-BL-AI-03`. They were admitted at CP2 without these owner-row entries.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 82 items; 40 / 4 / 9 / 29 by status, 46 / 34 / 2 by severity.**

**S8A-02 Round 2 review change (2026-10-21; the S8A-02 pull request, not yet opened; effective from its merge).** BG-06 /
BG-08 at the Product Owner's review of the S8A-02 Round 2 evaluation (item 4). The paragraphs above stay as written.
- **Admitted (BG-06 / BG-08):** `QAN-BL-AI-05` (complex messages routed FAST rarely complete within the 3 s budget under
  DeepSeek; `HIGH`, Stage 8A, no separate task).
- **Evidence, no change of state:** `QAN-BL-AI-04` — the Round 2 Shared World DEEP case was aborted at the 10 s budget in
  5 of 6 attempts. `QAN-BL-ACE-02` and `QAN-BL-IP-02` — S8A-02's Round 1 and Round 2 evaluations ran; their reconciliation
  is S8A-02's closing change (BG-08 / BG-09).
- **Reconciled in §9:** the Stage 8A row lists `QAN-BL-AI-05`.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 83 items; 41 / 4 / 9 / 29 by status, 47 / 34 / 2 by severity.**

**S8A-02 Shared attribution change (2026-10-21; the S8A-02 pull request, not yet opened; effective from its merge).** BG-06
/ BG-08 at the Product Owner's Shared Attribution Engineering Decision (D5). The paragraphs above stay as written.
- **Admitted (BG-06 / BG-08):** `QAN-BL-AI-06` (two participants with the same Name reach the model as one speaker),
  `QAN-BL-AI-07` (participants without a Name all reach it as one "A participant") and `QAN-BL-AI-08` (QANDEEL's earlier
  Shared replies reach it without the person they answered); each `HIGH`, Stage 8A, no separate task, and each a
  condition of the Shared World readiness assessment.
- **Checked and not admitted:** the merging of consecutive speakers into one model message is S8A-02's own work (the
  separated candidate and its attribution test), not residue.
- **Reconciled in §9:** the Stage 8A row lists `QAN-BL-AI-06`, `QAN-BL-AI-07` and `QAN-BL-AI-08`.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 86 items; 44 / 4 / 9 / 29 by status, 50 / 34 / 2 by severity.**

**S8A-02 Shared attribution integrity change (2026-10-21; the S8A-02 pull request, not yet opened; effective from its
merge).** BG-06 / BG-08 at the Product Owner's Shared Attribution Integrity decision, after S8A-02 Part T. The paragraphs
above stay as written.
- **Admitted (BG-06 / BG-08):** `QAN-BL-AI-09` (text inside one participant's Shared message can pose as another
  participant speaking; `HIGH`, Stage 8A, no separate task, a condition of the Shared World readiness assessment).
- **Evidence, no change of state:** `QAN-BL-AI-06` / `QAN-BL-AI-07` — the reply composition already reads each message's
  author identity server-side (the frozen `0089` resolver it calls for every recipient returns `author_user_id`), so
  telling authors apart may need no database change; `QAN-BL-AI-08` — the link between a reply and the message it answered
  is stored (the `0139` reply identities derive from the human command) but no granted read returns it. Recorded in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7.
- **Reconciled in §9:** the Stage 8A row lists `QAN-BL-AI-09`.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 87 items; 45 / 4 / 9 / 29 by status, 51 / 34 / 2 by severity.**

**S8A-02 CP1 — Trusted Speaker & Message Provenance (2026-10-22; the S8A-02 pull request, not yet opened; effective from
its merge).** No admission and no change of state. The paragraphs above stay as written.
- **Evidence, no change of state:** `QAN-BL-AI-06` / `QAN-BL-AI-07` — production's Shared input now tells authors apart by
  the `0089` author of each `material_id`, with no database change: same-Name and unnamed people reach the model as
  different labels, proven at the Model Router boundary with zero calls. Their disposition is for the Product Owner's
  review and S8A-02's closing change. `QAN-BL-AI-09` — a "Name:" line inside a message now stays inside its sender's own
  model message, but how a model reads it is not proven; it stays open. `QAN-BL-AI-08` — untouched: no proven reply link
  is shown. Recorded in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §7.
- **Untouched:** every item, owner, severity and status.
- **Latest index: 87 items; 45 / 4 / 9 / 29 by status, 51 / 34 / 2 by severity.**

**S8A-02 CP1 Controlled Amendment (2026-10-22; the S8A-02 pull request, not yet opened; effective from its merge).** No
admission and no change of state. The paragraphs above stay as written.
- **Evidence, no change of state:** `QAN-BL-AI-06` / `QAN-BL-AI-07` — the model-visible text each said needs its own
  Product Owner decision is now authorized: separated messages and the collision-only " (n)" speaker label, by the narrow
  controlled amendment in the
  [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §5.3,
  with the Shared frame's bytes unchanged. The frozen-RPC change each anticipated was not needed: the `0089` resolver
  already returns each message's author. Their disposition stays with S8A-02's closing change. `QAN-BL-AI-08` /
  `QAN-BL-AI-09` — untouched; they stay open.
- **Untouched:** every item, owner, severity and status.
- **Latest index: 87 items; 45 / 4 / 9 / 29 by status, 51 / 34 / 2 by severity.**

**S8A-02 closing change (2026-10-23; the S8A-02 pull request, from `main` at `d566a7e7dc4d01e698df2fe48cd16c8765edf6ed`; effective from its merge).**
This is the BG-08 reconciliation under the Founder's closure decision (2026-10-23). The paragraphs above stay as written.
- **Tombstoned (§6):**
  - `QAN-BL-AI-06` / `QAN-BL-AI-07`, completed by CP1 (§5.3), whose disposition was left to this change;
  - `QAN-BL-AI-09`, accepted for the first release by the Founder's product decision, its evidence and limits kept.
  - Owner in §4: `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality`.
- **Stay open, owner and state unchanged:**
  - `QAN-BL-AI-04` and `QAN-BL-AI-05`, with dated notes (Personal FAST 10 s / DEEP 25 s from CP3).
  - `QAN-BL-AI-08`: no reply-to link is shown to the model; it remains a Shared readiness condition.
  - `QAN-BL-ACE-02` and `QAN-BL-IP-02` stay `VALIDATION — OPEN`, with S8A-02's evidence in the [S8A-02 amendment record](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §5.4 / §7. The
    Round 9 preference findings are Future Improvement 001.
  - `QAN-BL-AI-01`, `QAN-BL-AI-02`, `QAN-BL-CW-05`, `QAN-BL-MATCH-03` and `QAN-BL-MATCH-04` were read and left
    unchanged; they belong to the rest of Stage 8A (S8A-03 … S8A-08), which this change does not close.
- **Checked and not admitted (BG-06):**
  - Future Improvements 001 and 002. They are the Founder's product acceptances for v1, recorded as non-blocking and
    unscheduled improvements in `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`, not deferrals to a future
    task.
  - The experimental CP2 prototype (`63aad31f`), which is not wired.
  - The three defects the final engineering review found were corrected within S8A-02 (§8: closed work): the Safety
    gate's Arabic binding, the notes' label escaping, and the notes' echo check.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 87 items; 42 / 4 / 9 / 32 by status, 51 / 34 / 2 by severity.**

**S8A-03 reconciliation F10 (2026-10-23; the S8A-03 pull request, not yet opened; documentation only).** S8A-02 merged
through PR #354 as `378128452177508c5700a3ac3e86346c4eb33067` (2026-10-23), so its closing change above is effective. The
paragraphs above stay as written.
- **Filled in (§6):** the PR and merge SHA of the `QAN-BL-AI-06`, `QAN-BL-AI-07` and `QAN-BL-AI-09` tombstones.
- **Untouched:** every item, owner, severity and status. S8A-03 owns no item at kickoff; nothing is admitted, tombstoned
  or re-owned.
- **Latest index: 87 items; 42 / 4 / 9 / 32 by status, 51 / 34 / 2 by severity.**

**S8A-03 CP2 checkpoint (2026-10-23; the S8A-03 pull request, not yet opened; local, not pushed).** CP2 delivered
background natural acquisition and a semantic Memory retrieval index under the candidate S8A-03 CP2 Personal
Understanding Controlled Amendment (migration 0171, local only). The paragraphs above stay as written.
- **Evidence only, no change of state:** `QAN-BL-MATCH-04` gains local mechanism evidence for natural acquisition and
  cross-session retrieval (the 0171 verifier on real PostgreSQL); real-model behaviour is CP3's. `QAN-BL-AI-02` stays
  open.
- **Not admitted:** the task-local residues stay with S8A-03 itself, which is still open and must dispose of them at its
  closing change: real-model capture and paraphrase quality (CP3), and composing the capture stage into the hand-built
  A2 / Full Intelligence / Integrated Brain end-to-end harnesses. Hosted application of 0171 rides the existing hosted
  deployment items. The pre-CP3 corrections D-1 / D-2 (amendment §7.5, local) leave two more task-local limits with
  S8A-03: MSA first person written without the hamza, and the unchanged Memory-command exclusion of `MEMORY_WRITE` and
  Hypothesis generation eligibility.
- **Untouched:** every item, owner, severity and status; nothing is admitted, tombstoned or re-owned.
- **Latest index: 87 items; 42 / 4 / 9 / 32 by status, 51 / 34 / 2 by severity.**

**S8A-03 CP3 and Living Personal Memory checkpoint (2026-10-23; the S8A-03 pull request, not yet opened; local, not
pushed).** The paragraphs above stay as written.
- **CP3:** the one authorized live run was FAIL (amendment §9.1). The Founder then approved the Living Personal Memory
  design corrections, implemented locally under amendment §9 (migration 0172, local only).
- **Evidence only, no change of state:**
  - `QAN-BL-MATCH-04` gains local mechanism evidence: family relationship knowledge, the living current state, and a
    bounded read-time personal picture (the 0172 verifier on real PostgreSQL). Its real-model acceptance is not yet run.
  - `QAN-BL-AI-02` stays open.
- **Not admitted:** these task-local residues stay with S8A-03, which must dispose of each at its closing change.
  - The 0171 capture command keeps its grant but has no runtime caller after 0172.
  - The knowledge read is bounded at 120 rows, so a user with more eligible Memories is projected from the 120 best
    ordered.
  - Real-model quality of the family statements and of REAFFIRMED / ENDED has not been measured (no paid call).
  - The end-to-end harnesses still lack the capture stage (carried from CP2).
  - Three observations from the Living Personal Memory design review are not yet verified here:
    - copies of `introductions_preparation_private.notes` without forget propagation;
    - free text in some post-response `result_payload` shapes;
    - the historical projection at earlier turns.

  Hosted application of 0171 / 0172 rides the existing hosted deployment items.
- **Untouched:** every item, owner, severity and status; nothing is admitted, tombstoned or re-owned.
- **Latest index: 87 items; 42 / 4 / 9 / 32 by status, 51 / 34 / 2 by severity.**

**S8A-03 closing change (2026-10-24; PR #355, from `main` at `378128452177508c5700a3ac3e86346c4eb33067`; effective from its
merge).** This is the BG-08 reconciliation under the Product Owner's Open Understanding decision (2026-10-24,
[amendment §10](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-03_CP2_PERSONAL_UNDERSTANDING_CONTROLLED_AMENDMENT_v1.0.md)).
The paragraphs above stay as written. CP3 stays FAIL as run.

- **Checked and not admitted (BG-06), under the Product Owner's decision of 2026-10-24 that S8A-03 opens no new
  improvement commitment.** No canonical document defers either finding to a task. Both are recorded with their evidence
  in [amendment §10.9](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-03_CP2_PERSONAL_UNDERSTANDING_CONTROLLED_AMENDMENT_v1.0.md),
  and that disposition, not a register entry, is the record (BG-01).
  - **A background forget / correct is invisible to the 0152 background Memory writer.** This is a proven risk.
    - `public.background_record_memory_v1` (0152, frozen) checks only the foreground `memory_control_commands` for a
      later forget / correct.
    - Failure: an OLDER turn's `MEMORY_WRITE` effect runs after a NEWER turn's background forget / correct, for example
      on recovery. It can write the withdrawn words again as a new ACTIVE Memory with the same type and equivalence key.
    - The 0173 command itself refuses this (its verifier's G-1), and a foreground forget / correct is fully guarded.
    - It is to be weighed again before `QAN-BL-AI-01` lets any real user reach DeepSeek.
  - **The end-to-end runtime harnesses do not run the capture** (the CP2 harness residue). This is a verification gap,
    not a defect. The capture is proven by its specs and by the 0171–0173 verifiers on real PostgreSQL.
  - If the Product Owner later wants either tracked as a task obligation, it is admitted then, under a new identifier.
- **Disposed of within S8A-03 (task-local, not admitted):**
  - **Real-model quality** of capture, family statements and REAFFIRMED / ENDED (CP2 / CP3 residues). It was measured by
    the S8A-03 two-arm experiment (synthetic). The Product Owner adopted Open Understanding and accepted its seven
    remaining limits as known limitations deferred until after launch. They are recorded only as Future Improvements
    003–009 in `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`: Founder product acceptances, not
    deferrals to a task, and not in this register.
  - **MSA first person without the hamza** (D-1). Closed: Open Understanding removed the first-person word gate, so
    such a message is now read by the model and verified by grounding.
  - **The `MEMORY_WRITE` / Hypothesis eligibility exclusion of Memory commands** (D-2). Unchanged by design: the
    foreground Memory commands stay first and the capture never runs on a command turn (amendment §10.2).
  - **Superseded versions with no runtime caller:**
    - the 0171 / 0172 capture commands;
    - `background_current_state_memories_v1`;
    - `personal_knowledge_sources_v1`;
    - their API read (`listCurrentStateMemories`);
    - the v2 verifier's fact / context functions.

    They are kept unchanged, with their grants and their verifiers, as the record of what each version did
    (amendment §10.5).
  - **The 120-row knowledge bound.** An approved design bound (amendment §9.2 / §9.3), not a defect.
  - **The three Living Personal Memory review observations**, now verified:
    1. `introductions_preparation_private.notes` keeps a body the owner confirmed from an earlier understanding. By the
       CW2-06A design (0154) it is the owner's own draft note: it leaves with the draft or the account, and it is not a
       Memory that a forget targets.
    2. The free text in the `INTENT_PROVIDER` / `CANDIDATE_PROVIDER` result payloads is already `QAN-BL-INTEL-02`. The
       capture result (0171–0173) holds identifiers only.
    3. The personal picture is read at reply time, so a turn generated later (an idempotency replay of a RECEIVED turn)
       sees what is known then. That is the read-time design shared by every Memory read, not a defect.
  - **The person labels are not in the Personal export** (0168, frozen), like the subject attributions and the index
    rows. The export carries every Memory's words (amendment §10.5).
- **Evidence only, no change of state:**
  - `QAN-BL-MATCH-04` gains Open Understanding mechanism evidence: someone else's facts kept as that person's, plus
    background forget / correct (the 0173 verifier on real PostgreSQL).
  - `QAN-BL-AI-02` stays open.
- **Hosted application** of 0171–0173 rides the existing hosted deployment items. No hosted application is authorized.
- **Untouched:** every item, owner, severity and status; nothing is admitted, tombstoned or re-owned.
- **Latest index: 87 items; 42 / 4 / 9 / 32 by status, 51 / 34 / 2 by severity.**

**S8A-04 closing change (2026-10-26; Draft PR #358, from `main` at `b0839fd4dec150f79e6292da991ef93dcca34d72`; effective
from its merge).** This is the BG-08 reconciliation under the Product Owner's D-9 decision (2026-10-26):
`PO-ACCEPTED-KNOWN-RISK — DEFERRED UNTIL AFTER FIRST LAUNCH`
([amendment §11.9](canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT_v1.0.md)).
S8A-04's CP1 and CP2 merged through PRs #356 and #357 with no entry here: they admitted, tombstoned and re-owned nothing.
The paragraphs above stay as written. CP3-D V2 stays NOT ACCEPTED as run.
- **Tombstoned (§6):** `QAN-BL-CW-02`.
  - It was delivered for its scope by S8A-04 CP3 (`SHARED-CTX-01`), and accepted with known risk by the Product Owner.
  - It is not closed on a passed criterion: Tier 1 is NOT ACCEPTED (leaks 36 / 90, false blocks 7 / 60, invalid
    1 / 150), and Tier 2 is NOT RUN.
  - Its evidence and limits are kept.
- **Admitted (BG-06 / BG-08):** `QAN-BL-CI-03`.
  - It is the Android API 36 emulator boot smoke's runner infrastructure, `PO-WAIVED:
    GITHUB_ANDROID_EMULATOR_INFRASTRUCTURE`.
  - `MEDIUM`, `DEFERRED — OWNED`, owner `CI-ANDROID-01`.
  - The Product Owner directed it on 2026-10-25, for this closing change.
- **Checked and not admitted (BG-06):** Future Improvements 012 – 016 in
  `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`.
  - They cover disclosure outside the claim spans, attribution protection, dialect and hint semantics, false blocks, and
    checker reliability with the deferred end-to-end evaluation.
  - They are the Product Owner's product acceptances, `POST-FIRST-LAUNCH / DEFERRED / NON-BLOCKING`. They are not
    deferrals to a task, and by the Product Owner's decision they are not blocking items in this register.
- **Read and left unchanged:**
  - `QAN-BL-AI-01` — no real user's data reaches DeepSeek; `SYNTHETIC_ONLY` is unchanged.
  - `QAN-BL-AI-08` and `QAN-BL-CW-05`.
  - The hosted deployment items (0176 – 0178 applied to no hosted database).
  - `QAN-BL-CI-01`.
- **The Product Owner's exception** removes no security, privacy or deployment gate. The T-D2 failure alone is not a
  merge or first-launch blocker. The probabilistic disclosure and attribution errors remain.
- **Untouched:** every other item, owner, severity and status.
- **Latest index: 88 items; 42 / 4 / 9 / 33 by status, 51 / 35 / 2 by severity.**

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
| `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` | `QAN-BL-LAUNCH-02`; `QAN-BL-LAUNCH-03` (admitted by S4-01; listed here by GOV-REC-01) |
| `PROD-AUTH-01 — Auth Verification Path` | `QAN-BL-PROD-04` (PROD-READINESS-01 corrective admission; listed here by GOV-REC-01) |
| `PROD-DATA-01 — List/Fan-out Correction` | `QAN-BL-PROD-05` (PROD-READINESS-01 corrective admission; listed here by GOV-REC-01) |
| `CI-IOS-01 — Maestro / XCTest Driver Startup Reliability` | `QAN-BL-CI-01` (admitted by S4-01; listed here by GOV-REC-01) |
| `W3-CORR-U — Understanding Integrity` | none — U-1 … U-5 closed inside the task; admitted `QAN-BL-PRIV-01` |
| `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `QAN-BL-PRIV-01`, `QAN-BL-PRIV-02`; `QAN-BL-PRIV-03` (admitted by MEM-AR-01; listed here by GOV-REC-01); `QAN-BL-PRIV-05` (the Shared, Public and Replay world-scoped export; admitted by the Stage 6 WP0 final decision addendum at the Product Owner's D5 designation, 2026-10-13; Replay coordinated with Stage 7) |
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
| `SHARED-CTX-01 — Shared Standing Context Product Integration` | `QAN-BL-CW-02` — delivered by `S8A-04 CP3` (Draft PR #358) and tombstoned by S8A-04's closing change under the Product Owner's D-9 known-risk acceptance (2026-10-26; effective from its merge) |
| `SHARED-VIS-01 — Shared World Living Analysis Map Product Integration` | `QAN-BL-CW-03` — **delivered and merged through PR #321 (`5973123153e26494d702a4a859a79631ede225cd`, 2026-10-09); its closing change never landed, so `GOV-REC-01` tombstones it retroactively under BG-08 / BG-09; Issue #322 (physical-Android release evidence) stays OPEN, outside this item.** *As written on 2026-10-08:* ACTIVE since 2026-10-08 (Stage 5 DONE / MERGED); stays `DEFERRED — OWNED` until this task's closing change tombstones it; admitted `QAN-BL-CW-05` (owned by Stage 8A at the Product Owner's deferral), `QAN-BL-CW-06` and `QAN-BL-CW-07` (deferred by the Product Owner, unassigned); `QAN-BL-VIS-01` (Shared density at scale observed within `LA-SCALE-01`), `QAN-BL-ACCT-01` (0148 references no account) and `QAN-BL-VOICE-01` observed and left unchanged; the Stage-8A binding of the two Shared ports recorded |
| `S5-01 — Public World Reachability, Entry & Identity Foundation` | none — no item names it; `QAN-BL-CW-01` re-owned to `S5-02` (Product Owner designation); `QAN-BL-ACCT-01` observed and left unchanged; none admitted |
| `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` | `QAN-BL-CW-01` — delivered by migration `0143` before any Draft / review path became application-reachable; tombstoned by itself under BG-08 (effective from its merge); `E2E-H-08` CLOSED and the 64 → 80 reconciliation DONE by S5-02; the original assignment, kept as written: must close `ASSURE-F05` before any application-reachable Draft / review creation path is opened; Product Owner assignments (S5-01 R1, not backlog items): close `E2E-H-08` when the real authorship / Public-Identity creation path consumes the S5-01 display foundation, and when that path is opened reconcile the old I-05 64-character display-label implementation ceiling with the valid 80-character account Name by a reviewed forward migration so REAL_NAME represents the full canonical account Name (no silent truncation) |
| `S5-03A — Public Semantic Interpretation + Publisher Review` | none — no item names it; `QAN-BL-ACCT-01` observed, scope unchanged, its new Experience Version / Semantic Placement `RESTRICT` dependents recorded; none admitted; the Stage-8A provider binding recorded as a closure-time admission candidate pending the Product Owner's owner-task designation |
| `S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime` | none — no item names it; `QAN-BL-ACCT-01` observed, scope unchanged, its new Experience Version / S5-03A interpretation `RESTRICT` dependents recorded; none admitted; the Stage-8A spatial-placer provider binding recorded as a closure-time admission candidate pending the Product Owner's owner-task designation |
| `S5-03C — Public Explicit Relations + Integrity Closure` | none — no item names it; `QAN-BL-ACCT-01` observed, scope unchanged, its new relation `RESTRICT` dependents recorded; `QAN-BL-VIS-01` and `QAN-BL-CW-03` observed and left unchanged; none admitted |
| `S5-04 — Public Discussion + @qandeel + Public Activity / Direct Entry + Final Public Integration` | none — no item names it; `QAN-BL-VIS-01` re-owned to `LA-SCALE-01` (Product Owner D6; S5-03B G04 / G05 and S5-03C's read bounds reconciled under it); `QAN-BL-CW-04` admitted (Product Owner D3); `QAN-BL-VOICE-01`, `QAN-BL-ACCT-01`, `QAN-BL-CW-03` and `QAN-BL-NOTIF-02` … `05` observed and left unchanged |
| `LA-SCALE-01 — Living Analysis Heavy-History / Dense-World Scale & LOD Proof` | `QAN-BL-VIS-01` |
| `PUBLIC-REACTIONS-01 — Public Lightweight Reactions Runtime` | `QAN-BL-CW-04` |
| `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `QAN-BL-CW-05` (its authority / source review; Product Owner deferral, 2026-10-08); `QAN-BL-IP-02` (IP-IMP-01 closing change; listed here by GOV-REC-01); `QAN-BL-ACE-02` (ACE-01 closing change; validation set extended to Shared / Public by ACE-SP-01, D-4); `QAN-BL-MATCH-03` (the Safe Compatibility Conclusion production capability with its AI cost attribution and evaluation; admitted by the Stage 6 WP0 at the Product Owner's GATE-03 decision, 2026-10-13); `QAN-BL-MATCH-04` (understanding readiness before real Matching; admitted by S6-01 at its CP1 at the Product Owner's D7 approval, 2026-10-13); `QAN-BL-AI-01`, `QAN-BL-AI-02` (admitted by S8A-01 at CP2; listed here by its closing change); `QAN-BL-AI-04` (admitted by S8A-01's closing change); `QAN-BL-AI-05` (admitted by S8A-02 at the Product Owner's Round 2 review); `QAN-BL-AI-06`, `QAN-BL-AI-07`, `QAN-BL-AI-08` (admitted by S8A-02 at the Product Owner's Shared Attribution Engineering Decision, D5); `QAN-BL-AI-09` (admitted by S8A-02 at the Product Owner's Shared Attribution Integrity decision). *S8A-02 closing change (2026-10-23; effective from its merge):* `QAN-BL-AI-06`, `QAN-BL-AI-07` and `QAN-BL-AI-09` tombstoned and re-owned in §4 to S8A-02; the others above stay this row's |
| `S6-01 — Intelligent Matching Onboarding` | `QAN-BL-MATCH-01` (admitted by SEC-MATCH-00; listed here by GOV-REC-01). *S6-01 started 2026-10-13 (the Product Owner's Final Implementation Authorization); at its closing change the item is re-owned to `S6-07` with a dependency on `ACCT-DEL-01` (D1), not tombstoned*. *Closing change (2026-10-14; the S6-01 pull request, not merged; effective from its merge):* `QAN-BL-MATCH-01` re-owned to `S6-07` with the mandatory `ACCT-DEL-01` dependency; admitted `QAN-BL-MATCH-04` at CP1 (Stage 8A, D7); `QAN-BL-ACCT-01`, `QAN-BL-PROD-06`, `QAN-BL-PRIV-04`, `QAN-BL-MATCH-02`, `QAN-BL-MATCH-03` and `QAN-BL-LAUNCH-04` observed and left unchanged; no further admission (§7). S6-01 owns no open item |
| `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary` | `QAN-BL-MATCH-02` (admitted by the Stage 6 WP0 at the Product Owner's GATE-03 decision, 2026-10-13; the task id is the Product Owner's (GATE-03) and so is the name (the approved Stage 6 task map, same day); the task's scope beyond this item is set only by its own Task Contract). *Closing change (2026-10-15; the S6-02 pull request, not merged; effective from its merge):* `QAN-BL-MATCH-02` tombstoned with the Product Owner's stricter decision A; admitted `QAN-BL-MATCH-05` to `S6-03` (D2); nothing else admitted (§7). S6-02 owns no open item |
| `S6-03 — Matching Proposal Pipeline & Intelligence Prerequisites` | `QAN-BL-MATCH-05` (admitted by S6-02's closing change, 2026-10-15, at the Product Owner's D2 assignment; the name is the approved Stage 6 task map's). *S6-03 started 2026-10-15 (Task Contract v1.3; CW2-06B approved at CP1). Closing change (2026-10-15; the S6-03 pull request, not merged; effective from its merge):* `QAN-BL-MATCH-05` tombstoned; dated notes on `QAN-BL-MATCH-01`, `QAN-BL-ACCT-01` and `QAN-BL-PRIV-04`; nothing admitted (§7). S6-03 owns no open item |
| `S6-05 — Mutual Match & Introduction World` | none — no item names it at kickoff (BG-05). *CP2 (2026-10-16; the S6-05 pull request, not merged; effective from its merge):* admitted `QAN-BL-MATCH-06` (owner `S6-07`, the Product Owner's R-4); nothing tombstoned or re-owned (§7). S6-05 owns no open item. *Closing change (CP5, 2026-10-16; the S6-05 pull request, not merged; effective from its merge):* nothing inherited, tombstoned or re-owned; `QAN-BL-MATCH-06` stays with `S6-07`; S6-05 owns no open item (§7) |
| `S6-07 — Activity, Direct Entry and Final Integration` | `QAN-BL-PRIV-04` (admitted by the Stage 6 WP0 at the Product Owner's GATE-19 decision, 2026-10-13; the name is the Product Owner's approved Stage 6 task map, the assignment to it was WP0's, and the Product Owner confirmed it and the `HIGH` severity in the final decision addendum (D2), which also keeps S6-07 from becoming a cross-world export task; the task's scope beyond this item is set only by its own Task Contract); `QAN-BL-MATCH-01` (re-owned from `S6-01` by S6-01's closing change, 2026-10-14, effective from its merge, at the Product Owner's D1; mandatory dependency on `ACCT-DEL-01`; not tombstoned while the six `0149` commands stay closed); `QAN-BL-MATCH-06` (admitted by S6-05 at CP2, 2026-10-16, at the Product Owner's R-4: the runtime producer of the forward step). *ACCT-DEL-01 closing change (2026-10-17; PR #345, not merged; effective from its merge):* `QAN-BL-MATCH-01`'s `ACCT-DEL-01` dependency is met in engineering; the six commands, CW2-08 and every launch gate stay closed, and S6-07 registers its new relations in the account-erasure coverage registry. *S6-07 closing change (CP4, 2026-10-18; PR #346, not merged; effective from its merge):* all three delivered and `CLOSED — TOMBSTONE` (§6); S6-07 owns no open item from its merge; admitted `QAN-BL-PROD-10` and `QAN-BL-LAUNCH-06` (§7) |
| `ACCT-DEL-01 — Account Deletion Across Matching / Introductions` | `QAN-BL-ACCT-01` (re-owned from `UNASSIGNED` by ACCT-DEL-01 CP1, 2026-10-17, the Product Owner having confirmed the name and approved WP0 v1.1 with P-1 … P-4; effective from its merge; it stays open — Shared `STANDARD` and Public go to `ACCT-DEL-02` and Replay to Stage 7 at CP2, P-1). *Closing change (CP2, 2026-10-17; PR #345, not merged; effective from its merge):* the Matching / Introductions part delivered; `QAN-BL-ACCT-01` re-owned to `ACCT-DEL-02` (still open); admitted `QAN-BL-ACCT-02` (Stage 7) and `QAN-BL-PROD-09` (`HOSTED-DEPLOY-01`); dated notes on `QAN-BL-MATCH-01` (dependency met in engineering), `QAN-BL-PROD-06`, `QAN-BL-PROD-08` and `QAN-BL-PRIV-04` (§7). ACCT-DEL-01 owns no open item |
| `ACCT-DEL-02 — Account Deletion Across Shared STANDARD / Public` | `QAN-BL-ACCT-01` (re-owned from `ACCT-DEL-01` by its closing change, 2026-10-17, at the Product Owner's P-1; effective from its merge; a future task, not opened; the descriptive half of the name is ACCT-DEL-01's until its own Task Contract) |
| `Stage 7 — Replay` | `QAN-BL-ACCT-02` (admitted by ACCT-DEL-01's closing change, 2026-10-17, at the Product Owner's P-1; Replay's account-deletion module) |
| `S7-05 — Replay Final Integration, Device Proof & Stage Closure` | none owned at kickoff; `QAN-BL-NAV-02` claimed by the Product Owner's D4 and tombstoned by its closing change (PR #351; effective from its merge); admitted `QAN-BL-RSP-03` |
| `S8A-01 — DeepSeek Production Integration & First Real Conversation` | none owned at kickoff; the Stage 8A items read and left as they stand; *CP2 (2026-10-21; the S8A-01 pull request, not merged; effective from its merge):* admitted `QAN-BL-AI-01`, `QAN-BL-AI-02` and `QAN-BL-AI-03`; *Closing change (2026-10-21; effective from its merge):* CP4 passed (seven synthetic calls; Personal DEEP 20 s by the Product Owner's controlled change); BG-08 reconciled; admitted `QAN-BL-AI-04` |
| `S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality` | none owned at kickoff; the Stage 8A items read and left as they stand; admitted `QAN-BL-AI-05` (Round 2 review), `QAN-BL-AI-06` / `AI-07` / `AI-08` (D5) and `QAN-BL-AI-09` (Shared Attribution Integrity), all owned by Stage 8A. *Closing change (2026-10-23; the S8A-02 pull request; effective from its merge):* `QAN-BL-AI-06` / `AI-07` tombstoned (completed by CP1) and `QAN-BL-AI-09` tombstoned (Founder product acceptance for v1); dated notes on `QAN-BL-AI-04` / `AI-05`; `QAN-BL-AI-08`, `QAN-BL-ACE-02` and `QAN-BL-IP-02` left open with reasons; Future Improvements 001 / 002 checked and not admitted (§7). S8A-02 owns no open item |
| `S8A-04 — Shared Social Understanding, Shared Social Memory and Personal Knowledge in Shared World (CP1 – CP3)` | none owned at kickoff; CP1 (PR #356) and CP2 (PR #357) admitted, tombstoned and re-owned nothing; CP3 delivers `SHARED-CTX-01`. *Closing change (2026-10-26; Draft PR #358; effective from its merge):* `QAN-BL-CW-02` tombstoned (the Product Owner's D-9 known-risk acceptance; CP3-D V2 Tier 1 NOT ACCEPTED, Tier 2 NOT RUN); admitted `QAN-BL-CI-03` (PO-WAIVED Android emulator infrastructure); Future Improvements 012 – 016 checked and not admitted (§7). S8A-04 owns no open item |
| `S8A-05 — Public World (CP1 Write Your Topic, merged through PR #359; CP2 Publish from QANDEEL, merged through PR #360; CP3 Public Semantic Intelligence & Deterministic Spatial Placement; CP4 not started)` | none owned at kickoff (2026-10-26, from `main` at `9459245e`); *CP1 (the S8A-05 CP1 pull request, not merged):* admitted, tombstoned and re-owned nothing; observed and left as they stand: `QAN-BL-PRIV-05` (CP1 exports the reader's own topic drafts as `publicTopicDrafts`), `QAN-BL-ACCT-01` and `QAN-BL-PROD-09` (`public_compose_private.topic_drafts` is `ACCOUNT_CASCADE` and registered; a prepared topic exists only after the closed publication gate opens, then follows `ACCT-DEL-02`). *CP2 (2026-10-27; the S8A-05 CP2 pull request, not merged; effective from its merge):* admitted, tombstoned and re-owned nothing; read and left as they stand: `QAN-BL-CW-05` (Shared QANDEEL output stays unpublishable, outside A-3), `QAN-BL-PRIV-05` (each draft's source reference is exported under `publicTopicDrafts`), `QAN-BL-ACCT-01` and `QAN-BL-PROD-09` (the source lives on the `ACCOUNT_CASCADE` draft). *CP3 (2026-10-27; the S8A-05 CP3 pull request, not merged; effective from its merge):* admitted, tombstoned and re-owned nothing; read and left as they stand: `QAN-BL-AI-01` (the Public interpreter runs only under `SYNTHETIC_ONLY`; no real person's text reaches DeepSeek), `QAN-BL-VIS-01` (the field camera and scale stay `LA-SCALE-01`'s; A-4 finding F-2), `QAN-BL-PRIV-05`, `QAN-BL-ACCT-01` and `QAN-BL-PROD-09` (the 0181 region slots bind only a published Experience, and nothing can publish yet); the Tier S / Tier P quality evaluation ran once and is NOT ACCEPTED (fabrication; the deterministic half met). BG-08 / BG-09 at S8A-05's last checkpoint |
| `CI-ANDROID-01 — Android Emulator CI Infrastructure Reliability` | `QAN-BL-CI-03` (admitted by S8A-04's closing change; identifier the Product Owner's) |
| `LA-VIS-01 — Living Analysis graphics-only fidelity upgrade` | none — no item names it; `QAN-BL-VIS-01` observed and left `OPEN — UNASSIGNED` (not closed by LA-VIS-01); `QAN-BL-CW-03` left `DEFERRED — OWNED`, unchanged; none admitted |
| `PROD-RETRY-01 — Data API 40001 Retry Hazard Closure` | `QAN-BL-PROD-06` — scope amended and resolved in the repository (migration `0150`); re-owned by its closing change to `HOSTED-DEPLOY-01` (not tombstoned: `0150` is not deployed); admitted `QAN-BL-PROD-07` |
| `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` | `QAN-BL-PROD-06` — the hosted deployment gate; closes only on evidence read on the hosted project itself; `QAN-BL-PROD-08` (admitted by S6-06 CP1; listed here by ACCT-DEL-01); `QAN-BL-PROD-09` (admitted by ACCT-DEL-01's closing change, 2026-10-17, at the Product Owner's direction: a **mandatory condition** — no World opens in production without an automated, fail-closed account-deletion coverage check read on the hosted project); `QAN-BL-PROD-10` (admitted by S6-07's closing change, 2026-10-18: a photo object lost from the store blocks its owner's export bundle) |
| `PROD-RETRY-02 — Post-v16 Data API Retry Semantics` | `QAN-BL-PROD-07` |
| `CI-01 — Shared Intelligence Learning Evidence & Baseline` | none — no item names it; admitted `QAN-BL-INTEL-01` (C1-A, Product Owner decision 3), `QAN-BL-INTEL-02` and `QAN-BL-CI-02` (closing change, Product Owner closing decisions 2 and 3); `QAN-BL-CTX-01`, `QAN-BL-CW-02`, `QAN-BL-CW-05`, `QAN-BL-PRIV-01` and `QAN-BL-PRIV-02` cited and left unchanged |
| `INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02)` | `QAN-BL-INTEL-01` tombstoned after merged PR #326; `QAN-BL-QIR-01` admitted under `QIR-006-R1`; `QAN-BL-INTEL-02` remains `VALIDATION — OPEN` under `INTEL-RET-01`; no deployment or global erasure claim |
| `QIR-006-R1 — Formal Question Bind-Time Version & Lifecycle Recheck` | `QAN-BL-QIR-01` (admitted at INTEL-TM-01 post-merge closure) |
| `INTEL-RET-01 — Post-Response Intelligence Ledger Retention & Provenance Review` | `QAN-BL-INTEL-02` (owner name PO-APPROVED) |
| `QAN-INF-06 — Forward-Safety Mirror Expo Validation Determinism` | `QAN-BL-CI-02` (owner name PO-APPROVED) |
| `MEM-AR-01 — Memory Correction & Arabic Acquisition` | none — no item names it (re-checked at each slice); admitted `QAN-BL-INTEL-03` and `QAN-BL-PRIV-03`; merged through PRs #328, #329 and #330 (01C, `3bec87ac725c73db0aecc5a6fb4e01c90acce66b`) (row added by GOV-REC-01) |
| `INTEL-SV-01 — Hypothesis Semantic Support Verification` | `QAN-BL-INTEL-03` (admitted by MEM-AR-01; listed here by GOV-REC-01) |
| `IP-IMP-01 — Interaction Preferences` | none — no item names it; admitted `QAN-BL-IP-01` and `QAN-BL-IP-02`; `QAN-BL-CW-02` reconciled with owner unchanged; merged through PR #331 (`424cd0231429e5280a0e70be25c2f83437e117c8`) (row added by GOV-REC-01) |
| `PUBLIC-PREF-01 — Public World Personal Interaction Preference Decision` | `QAN-BL-IP-01` (owner name APPROVED by the Product Owner, IP-IMP-01 R2; listed here by GOV-REC-01) |
| `ACE-01 — Adaptive Conversational Expression v1` | none — no item names it; admitted `QAN-BL-ACE-01` (Gate B) and `QAN-BL-ACE-02` (Stage 8A); `QAN-BL-IP-01`, `QAN-BL-IP-02`, `QAN-BL-CW-02`, `QAN-BL-CW-05` and `QAN-BL-VOICE-01` observed and left unchanged |
| `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision` | `QAN-BL-ACE-01` — authorized by the Product Owner (2026-10-12; D-1 … D-4, Copy Gate 6 / 6); delivered for both Worlds under the ACE-SP-01 controlled amendment and tombstoned by itself under BG-08 (effective from its merge); `QAN-BL-ACE-02`'s validation set extended (D-4; owner and status unchanged); admitted `QAN-BL-GOV-01`; `QAN-BL-CW-02`, `QAN-BL-IP-01` and `QAN-BL-MATCH-01` reconciled with owners unchanged |
| `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` | `QAN-BL-GOV-01` (admitted by ACE-SP-01; owner name APPROVED by the Product Owner, 2026-10-12 — *as first written: "owner name proposed for the Product Owner's confirmation"*) — delivered; tombstoned by itself under BG-08 (effective from its merge); `QAN-BL-CW-03` tombstoned retroactively for SHARED-VIS-01; Issue #322 not admitted (a Product Owner decision); none admitted |
| `Stage 6 — Matching & Introductions Kickoff (WP0)` | none — no item names it; research and planning only, no implementation; `QAN-BL-MATCH-01` left with `S6-01`, unchanged (S6-01 not resumed); `QAN-BL-ACCT-01` and `QAN-BL-PROD-06` observed, reopen conditions not fired; admitted `QAN-BL-LAUNCH-04` (Issue #322) at the Product Owner's explicit approval; inherited and adjacent items mapped to the proposed Stage 6 tasks for Product Owner review only ([WP0 record](e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §8); proposed admissions found by WP0 (record §8.5: the Introduction-phase account-Name leak; the Stage 8A Matching conclusion producer, AI-COST family and eval suite; conditional others) await the Product Owner's GATE-03 decision — none admitted. *Product Owner Tier 0 decision (2026-10-13), same PR:* GATE-01 … GATE-03 approved; admitted `QAN-BL-MATCH-02` (owner `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary`) and `QAN-BL-MATCH-03` (owner `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`); the conditional findings not admitted; `QAN-BL-MATCH-01` unchanged. *Product Owner final approval package (2026-10-13), same PR:* every remaining gate decided as approved Product intent, direction or initial policy proposal, none authorizing implementation; the seven-task Stage 6 map approved as planning direction; admitted `QAN-BL-PRIV-04` (owner `S6-07 — Activity, Direct Entry and Final Integration`, WP0's assignment awaiting the Product Owner's confirmation) at GATE-19; no Task Contract written. *Product Owner final decision addendum (2026-10-13), same PR:* `QAN-BL-PRIV-04`'s owner and `HIGH` confirmed (D2); admitted `QAN-BL-PRIV-05` (owner `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts`, D5); `QAN-BL-ACCT-01` unchanged, with a dated D3 note (`ACCT-DEL-01` provisional, not yet admitted); GATE-16 resolved (D1; CA-09 identified, not implemented); the default language of generated conversation (D4) and the LANG / S6 workstreams (D6) recorded; no Task Contract written |
| `Stage 9 — Economy + Launch Closure (release-readiness gate)` | `QAN-BL-LAUNCH-04` (admitted by the Stage 6 WP0 at the Product Owner's approval, 2026-10-13; an earlier explicit validation owner may take it when a physical Android device is available, recorded as a re-owning); `QAN-BL-LAUNCH-05` (admitted by S6-06's closing change; listed here by S6-07); `QAN-BL-LAUNCH-06` (admitted by S6-07's closing change, 2026-10-18: the export folder save on iOS, physical Android devices and read-only places); `QAN-BL-AI-03` (admitted by S8A-01 at CP2; listed here by its closing change) |
| `LANG-01 — Arabic Language Authority & Fixed Copy Correction` | none — no item names it (kickoff, 2026-10-13; the LANG workstream of the Stage 6 WP0 final decision addendum, D6); `QAN-BL-VOICE-01` receives V-01 … V-03 as approved editorial references with its fields unchanged; `QAN-BL-IP-01`, `QAN-BL-IP-02`, `QAN-BL-ACE-02`, `QAN-BL-MATCH-01`, `QAN-BL-MATCH-02` and `QAN-BL-PRIV-04` observed and left unchanged; none admitted at kickoff; the SW-07 `fill()` defect is tracked by the [LANG-01 record](e2e/QANDEEL_LANG_01_ARABIC_LANGUAGE_AUTHORITY_FIXED_COPY_CORRECTION_RECORD_v1.md) §9 and reconciled at its closure |

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
