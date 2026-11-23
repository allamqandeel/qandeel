# QANDEEL — Post-Replay Execution Gap Register and No-Repeat Map
**Date:** 2026-11-23  
**Status:** Documentation-only planning reconciliation; no product code, migrations, deployment, PR merge, feature gate or paid testing authorized.  
**Source-of-truth order:** frozen Product/Architecture contracts → latest merged implementation/evidence → canonical backlog item status and owner → this working sequencing map. Historical snapshots in the Project Map/Roadmap do not become current truth merely because they remain in the file.

## 0. Exact checkpoint and scope
- COSMOS-INT-01 (including COSMOS-FINAL-01 and E-2): **ACCEPTED / MERGED / CLOSED**, PRs #402 and #403, 2026-11-21. Preserve S3-R2 FAR → MID → NEAR → ANALYTICAL, painter, camera, gestures, shared/public/personal parity. Do not reopen design or re-run already accepted device proofs without new regression evidence.
- Stage 6 Matching/Introductions S6-01 through S6-07: **engineering delivered/merged**, ending PR #346. Consume its onboarding, consent, proposal lifecycle, sender/recipient decision, Introductions, activity/direct entry and export machinery. **Real Matching is NOT enabled or production-ready**; see S8A-06/07 and Stage 9.
- Stage 7 Personal text Replay: **engineering merged**, ending PR #351. S8B-07 CP1-A/CP1-B source and original-audio listening: engineering merged through PRs #383/#385. Do not rebuild these.
- Stage 8A S8A-01 through S8A-05: **engineering merged** (through PR #363). S8A-06/07/08 remain **NOT STARTED / NOT AUTHORIZED**, separate from S8B-08. Do not reimplement the first five tasks. Some real-model and compliance validation obligations remain in the backlog.
- Stage 8B S8B-01 through S8B-06: substantial voice engineering merged, including #381, but not hosted, voice gates DISABLED and no real-user launch. S8B-07 Replay is current. S8B-08 real-provider voice evidence is a **separate future task**, not S8A-08.
- Current Replay Draft PR #404 on branch replay/replay-cosmos-01: last reviewed head **ecf5ea08469ffe2e67b1d8a286eaf7c36beb5212**, **NOT MERGED**. COSMOS reuse and RB-1 synthetic A/V clock implemented; FC-0 changes 100→300ms in commit 11e7105a, and iOS gate composition maintenance in ecf5ea08. At last checked exact-head CI, Mobile CI 45146914659 PASS; API CI 45146914686 and iOS gate 45146914768 **IN PROGRESS**. Do not call this head green or merged before new direct evidence.
- HONOR ALI-NX1 **built-in speaker only** FC-0 proof: 17 focused runs, 53 reveal observations, zero early reveals on tested path; minimum measured positive separation +127.6ms, median +259.5ms, maximum +409ms, reported measurement uncertainty ≈15ms. The PO accepts this as **the pre-launch Replay audio-synchronization acceptance path**. Do not schedule Replay Bluetooth/wired/USB/route-switch tests as blockers, but DO NOT claim universal output-route safety. This narrow Replay decision does not silently waive separately owned voice-note/voice-launch or official store requirements.
- First-tap issue SE-FU-1: **accepted V1 limitation**, Future Improvements item 022, not a pre-launch blocker or a new task. On #404 the mandatory iOS gate composition excludes its fresh-install XCUITest, retaining real touch checks after an ungated init; verify the actual final gate result. Preserve historical FAIL/NOT TESTED truth, no automatic PASS conversion and no re-opening of the deferred limitation.
- Hosted migrations 0197–0200: merged into source but **NOT applied to hosted Supabase** at the referenced checkpoint. Proposed 0201–0205 for Replay are **NOT WRITTEN / NOT APPROVED**. Other pre-existing unapplied migrations are reconciled by HOSTED-DEPLOY-01, not guessed from repository numbering.

## 1. No-repeat and decision gates
Every new work authorization MUST start with an Anti-Duplication Gate recording:
1. **Already frozen:** contract/version and explicit PO decisions, including exceptions and safety limits.
2. **Already merged:** exact PR/commit and existing runtime, migrations, UI and tests reused.
3. **Implemented but unproven:** exact synthetic/local/device scope; NOT TESTED is never PASS.
4. **Genuinely missing:** smallest code or proof delta, named owner, dependencies, cost/deployment boundary.
5. **Release classification:** explicit MUST-BEFORE-LAUNCH vs required only when capability opens vs post-launch improvement; HIGH severity alone does not authorize work or automatically block every launch configuration.
6. **Closure:** update backlog ID, Project Map, Current State, Roadmap only with grounded evidence; no reopened closed task, duplicate migration, parallel timing/model authority or silent deferral.
Project sequence is **not** execution permission. No PR merge except explicit PO «ادمج»; no hosted deployment, provider purchase, paid test, real-customer content or gate opening without separate scope-specific permission.

## 2. Remaining S8B-07 Replay, in dependency order
The following are **not closed merely because RB-1 or #404 tests pass**.

| Step | Work not yet proved/implemented | Consume / do not duplicate | Acceptance and dependency |
| --- | --- | --- | --- |
| R0 | Finish exact-head #404 CI/evidence review, record iOS actual statuses, review the in-app/MP4 synthetic parity and FC-0 report; PO merge decision separately | COSMOS #402/#403, current #404 RB-1 and FC-0, Stage 7 and S8B-07 CP1 source | Evidence complete; no repeat of successful HONOR built-in speaker matrix; no automatic merge |
| R1 — RB-2 | Authoritative **historical semantic availability**: no analytical/map disclosure before both the contributing spoken window ends and the knowledge is provably historically available | CP1-B audio presentation plan; current RB-1 stage clock | Distinguish transaction trigger from COMMIT and post-commit observation; prove rollback, SET CONSTRAINTS IMMEDIATE, delayed commits, concurrency, observers, monotonic clock, missing history and fail-closed fallback. After-commit observation may be conservative, not a fabricated exact commit instant. No unsafe backward reveal |
| R2 — RB-3 | Historical Thread/topic names and renames as-of the approved disclosure/availability policy | Existing Thread semantics and frozen Live COSMOS labels | Prove no future names, zero-name (unlabelled), equal-time tie breaks, delayed observer/rename edge, deletion and multiple sessions. Do not alter Live COSMOS |
| R3 — RB-4 | Durable **completed-call cut** (terminal audio/last SP), stable after subsequent exchanges in same Session | Existing call-end authority; no fabricated closing SP | No shortening or retroactive final movement; settle late analysis safely; multiple calls, interleaving, crash/retry, retention/consent. Resolve CALL_INTERLEAVED and availability races with explicit evidence |
| R4 — RB-5 / RS-7 | Original full silence; server-authorized exact selection/crop, one playback/MP4 truth. FULL is default, Highlights optional | CP1-B original window and presentation clock; do not replace source | No D-05.1 >3s pause shortening or silent skip; exact start/end samples, digest and privacy boundaries. Proposed migration 0204/0205 depends on approvals |
| R5 | Decide end-of-Replay last analytical moment (E-2s/E-2 or other) before implementation | Preserve complete original audio; no synthetic ending speech | Last disclosure cannot disappear or be moved to an earlier frame; display after audio only under grounded availability and an approved tail policy; state what happens if availability arrives beyond a cap |
| R6 | Dynamic complete-sequence parity, visual gate, 5-minute and long-call performance, resource isolation | Frozen S3-R2 COSMOS and proven static synthetic renderer | No reading-pace/wall-clock competition with audio; no hypothetical 1.85ms static-frame result treated as full dynamic proof; measure MP4 export, memory/thermals, correct Arabic labels, interrupted/seek/pause, real device; no Skia private patch without separate approval |
| R7 — CP2-B | Phone DOWNLOAD, SHARE_EXTERNALLY, PUBLISH_TO_PUBLIC_WORLD | Existing consent/rights/storage and I-06/Stage 7 secure Replay boundaries | All participants' required consent before public publishing; protected-person subject authority (AUTH-SUBJ-01) before relevant distribution; private preview + ownership; final exported video has no fixed auto-expiry; source call only replayable while existing/authorized; producer and recipient erasure/privacy |
| R8 | Hosted Replay Media Pool and operational exit, **separate owner HOSTED-DEPLOY-01** | INFRA-07 Replay pool separation and existing worker/service | No Replay work on Live Voice pool; no fallback; measured V-24b real two-environment isolation, First Audio unaffected under concurrent video rendering, role limits, watchdog and alerting, data erasure and live rejection when overloaded; no service deployed merely because source merges |

**Proposed migrations 0201→0205** currently belong to planning dependencies, not effective authority. Revalidate free slots and S7-04's migration allowlist/forward-safety contract at each authorized implementation. No migration is approved by this register. The exact original audio clipping, available-at map and finished-call source must resolve together before declaring Replay historically synchronized.

## 3. Stage 8A remaining after Replay (QANDEEL AI Brain)
S8A-01–05 are merged and consumed. Do NOT restart model-provider bake-offs or rebuild Personal/Shared/Public already integrated. The three provisional numbered tasks need explicit anti-dup scope/contracts before coding.

| Planned task | Genuine missing work | Acceptance / dependent gates |
| --- | --- | --- |
| **S8A-06 — Matching Understanding Readiness** | QAN-BL-MATCH-04: real authorized, current, correctable understanding from natural conversation; semantic cross-session retrieval; explicit adequacy test before proposal eligibility; revisions/forgetting honored; optional HIM advisory under consent, never eligibility | Synthetic/authorized real-model evidence and privacy, no MATCHING gate until reliable adequacy established. Reuse S8A-03, Memory/HIM and S6-01, no second Matching brain |
| **S8A-07 — Safe Compatibility Conclusion producer** | QAN-BL-MATCH-03: model-backed recipient-specific broad compatibility conclusion, model router adapter, usage accounting and evaluation | Feed untrusted conclusion through unchanged deterministic Sensitive Conclusion Filter; no percentage/score, counterpart secrets, private evidence or cross-person re-aim; safe refusal; no invented user proposal. Needs S8A-06 and Stage 9/CW2-08 release decision |
| **S8A-08 — Cross-world real-model, performance & economics exit proof** | Cross-Personal/Shared/Public/Matching truth, dialects, latency, load, quality, consent, provider usage and safe failure | Real provider account/privacy preconditions; clearly distinguish benchmarks and real-user readiness, replay of old tests only on proven regression. This is NOT S8B-08 |

**Other Stage 8A-owned/open quality obligations:** QAN-BL-AI-01 real-user DeepSeek terms/consent, AI-02 background/semantic provider binding, AI-05 FAST latency, AI-08 speaker attribution in prior Shared replies; QAN-BL-IP-02 and QAN-BL-ACE-02 real-model style/personality validation; AI-04 DEEP budget; CW-05 scope and related readiness. They must be reconciled under their existing owners/PO-accepted risks, not automatically reopened as new tasks.

## 4. S8B-08 — Voice Cost, Privacy & Launch Evidence
**Separate from S8A-08.** S8B-01–06 engineering is reused, not rerun. Remaining owner-specific obligations QAN-BL-VOICE-02/03/04/05/08 (see appendix): real Speechmatics and TTS/ASR latency/quality/cost, voice-note duration and endpointer, actual quota, physical/hosted evidence and privacy. Include approved Arabic pronunciation/vocalization requirements without changing visible transcripts. Costed real-provider runs require explicit PO budget/permission. Keep existing PO iOS/reader deferrals in force; do not silently broaden the scoped Replay speaker-only waiver to other independent voice or store requirements.

## 5. GCR-01 — mandatory Growth & Capacity Readiness before voice/public launch
S8B-05 CP1–CP4 are engineering-merged; GCR-01 fixes **separately owned launch residue**, not the original feature implementation.
- **QAN-BL-VOICE-07 HIGH:** crash of a live instance with an uncommitted utterance may lose the transcript; design and prove durable audio/ASR recovery, consent, order, idempotency, no fabricated speech, bounded and visible gaps.
- Resolve cross-user/shared-provider First Audio contention and **SHIPPED** performance misses (+69ms P50/+131ms P95 vs +50/+100ms objective); **Live Focus P95 ≤ 2.0s** target vs observed 3.9s. Separate SHIPPED and CALIBRATED verification; priority/admission and provider-aware resource budgets.
- PO worst-case capacity gate: prove **1,000 simultaneous full real-time calls for launch** with quota-backed real provider evidence; certify 10,000 before reaching 1,000 registered accounts, and 50,000 before 10,000. Synthetic progression 10/50/100/500/1,000, then bounded authorized provider proof. No claim that seven synthetic calls proves production capacity.
- Protect Live Voice speed under heavy independent Replay render loads and other simultaneous inference. Do not starve durable semantic tasks or discard them merely to pass performance.
- Provider contracts/quotas, distributed database/Redis/ASR/TTS capacity, observability, recovery and cost must be measured. No migration, provider commitment or paid proof without PO approval.

## 6. HOSTED-DEPLOY-01 — runtime and data authority actually deployed
- Inventory **all** source migrations not yet applied on hosted. Explicitly include 0197–0200 and later approved Replay migrations when they exist. Do not assume hosted is current or run 0201–0205 merely because proposed.
- Order migrations and application/API release safely with rollback strategy; verify Supabase/PostgREST version, 40001 retry paths (QAN-BL-PROD-06), data/API access, auth roles, erasure and export coverage (PROD-09), object storage and Introductions photos (PROD-08/10), and account/Shared/Public data isolation.
- Provision and prove **physically isolated Replay compute pool** per INFRA-07; role connection/timeouts, alerts, erasure ledger, V-24b/V-35b and real dual-environment isolation (PROD-12), no Live Voice fallback.
- Stage and validate consent versions, voice/provider configurations, secrets, object retention, privacy and operational monitoring. All voice/Replay/publishing gates remain DISABLED until owner-specific authorization.
- Hosted production proof is not replaced by local PostgreSQL, device fixture or passing GitHub CI.

## 7. Stage 9 — unified economy + launch policy and public eligibility
- One finite shared Credit wallet for **text, analysis, voice notes, live calls, paid inference and Replay media compute**; resource-cost ledger, reservation/settlement, idempotent retry and no final charge for failed undelivered job. Do not add an unapproved rate/rollover/top-up or a hard global Replay spend cap that disables paid customers. The previously discussed 650 EGP/60min and 1,000 EGP/120min are illustrative only.
- Subscription/payment/taxes/store billing/margins, entitlements and user-facing balance/usage; finance and provider capacity reconciliation.
- Mandatory capability-specific safety/moderation/identity/privacy CW2-08/I-09 policies: Matching and Public publication independently fail-closed; no launch merely because engineering merged.
- **PUB-REV-01** published topic revisions and version-continuous public discussion: explicit pre-launch blocker before production publishing (QAN-BL-PUB-REV-01).
- **AUTH-SUBJ-01** protected-human analytical subject authority: HIGH, owner-specific precondition before relevant Replay distribution (QAN-BL-PRIV-06); consent of all participants for Public World publication.
- Account deletion across connected worlds (ACCT-DEL-02/ACCT-03), Replay and introductions footprints, complete export (PRIV-EXPORT-01), data rights, privacy, security event sources and purpose-grant consistency.
- Production keys/rotation (LAUNCH-02/03), edge/proxy security (LAUNCH-01), mobile credential hardening (QAN-SEC-01), crash/logging/monitoring, native push exit gates and real production observability. Preserve explicit accessibility/iOS deferrals; external store requirements may require separately documented action rather than an invented automatic waiver.

## 8. Long-term product gaps and optional/non-blocking work
The canonical backlog also owns deferred or currently unassigned tasks such as cross-session timeline/bookmarks, Shared ended-world view, Shared temporal navigation, Public reactions, Personal full detail beyond PEEK, long-history world density/LOD proof, notifications/proactive/reminders, visual polish and various CI infrastructure improvements. Do not silently declare these to be release blockers. For each, obtain a PO launch-scope classification when the capability is in the launch matrix, otherwise retain its current owner/status. Do not reopen the already accepted COSMOS S3-R2, first-tap V1 limitation, historical test waivers or previously frozen UX without a separately proven contradiction.

## 9. Exact closure/anti-omission checklist
Before saying 'Replay CLOSED' or 'Stage 8A CLOSED', require:
- PR/commit, CI exact-head status, affected feature/capability gate, tests that were PASS/FAIL/NOT TESTED, and device/synthetic/hosted distinctions.
- The product effect verified: finished call full-audio preservation, no analytical knowledge before contributing spoken audio or historical availability, correct names, safe call sealing, final reveal, export/publication consent, and Live Voice isolation (for Replay).
- Every introduced migration and test pin has the correct authority and an assigned hosted owner; no undocumented source-truth clock or new rendering path.
- A per-backlog-ID disposition for tasks in scope, plus explicit carry-forward owner and release gate for external dependencies.
- Update dated forward banners in Project Map, Current State and Product Roadmap, keeping superseded historical entries intact.
- No unreviewed reopening of accepted Future Improvements, including first-tap item 022, no automatic PR merging and no release gate opening.

## 10. Complete OPEN canonical-backlog census (snapshot only)
Source: docs/qandeel-canonical-backlog-v1.md, Index section on main at this reconciliation. The index is the **only authoritative lifecycle/status register**, not this snapshot. A HIGH or DEFERRED row is not automatically a universal launch blocker; inspect its owner and frozen contract. Closed tombstones are intentionally not duplicated below.

- **Total entries:** 112; **CLOSED — TOMBSTONE:** 37; **not closed:** 75 = 54 DEFERRED — OWNED + 4 VALIDATION — OPEN + 17 OPEN — UNASSIGNED.


### DEFERRED — OWNED (54)
- **QAN-BL-ACCT-01** [HIGH] Account Deletion Across Connected Worlds — Explicit Connected-Worlds Deletion Blocker — Owner: ACCT-DEL-02 — Account Deletion Across Shared STANDARD / Public
- **QAN-BL-ACCT-03** [HIGH] Account Erasure Outside the Personal Replay: Non-Personal Replay Sources and Replay Distribution — Owner: Stage 9 — Economy + Launch Closure (Replay distribution / CW2-08)
- **QAN-BL-AI-01** [HIGH] DeepSeek Real-User Enablement: Data Terms, Disclosure, Consent, Policy, In-App Report, Pseudonymous Identifier and Output Moderation — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-AI-02** [HIGH] The Background and Semantic Model Calls Are Still Bound to OpenAI and Gemini — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-AI-03** [MEDIUM] DeepSeek's Time-of-Day Pricing Cannot Be Represented by a Price Card — Owner: Stage 9 — Economy + Launch Closure (release-readiness gate)
- **QAN-BL-AI-04** [MEDIUM] Shared and Public World DEEP Replies Keep the 10 s Budget Under DeepSeek — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-AI-05** [HIGH] Complex Messages Routed FAST Rarely Complete Within the 3 s Budget Under DeepSeek — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-AI-08** [HIGH] QANDEEL's Earlier Shared Replies Reach the Model Without the Person They Answered — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-CI-01** [MEDIUM] iOS Simulator Maestro / XCTest Driver Startup Reliability in Mobile CI — Owner: CI-IOS-01 — Maestro / XCTest Driver Startup Reliability
- **QAN-BL-CI-03** [MEDIUM] Android API 36 Emulator Boot Smoke: GitHub Runner Emulator Infrastructure (PO-WAIVED) — Owner: CI-ANDROID-01 — Android Emulator CI Infrastructure Reliability
- **QAN-BL-CTX-01** [HIGH] Runtime-backed Conversational Relevance — Owner: QAN-CTX-01 — Conversational Relevance Runtime
- **QAN-BL-CW-04** [MEDIUM] Public Lightweight Reactions Runtime (PG-07) — Owner: PUBLIC-REACTIONS-01 — Public Lightweight Reactions Runtime
- **QAN-BL-CW-05** [MEDIUM] QANDEEL Conversational Output Cannot Be a Shared Semantic-Place Source — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-INTEL-03** [MEDIUM] Hypothesis Semantic Support: Legacy Never-Supported Hypotheses (R-G1a) and Support by Unrelated Eligible Evidence (R-G1b) — Owner: INTEL-SV-01 — Hypothesis Semantic Support Verification
- **QAN-BL-IP-01** [MEDIUM] Personal Interaction Preferences Do Not Shape Public World QANDEEL Replies — Owner: PUBLIC-PREF-01 — Public World Personal Interaction Preference Decision
- **QAN-BL-LANTERN-01** [HIGH] Lantern Gateway Identity Moment v1 — Creative / Motion / Interaction Realization — Owner: QANDEEL — Lantern Gateway Identity Moment v1
- **QAN-BL-LAUNCH-01** [HIGH] Trusted Proxy / Edge / Origin Production Proof — Owner: LAUNCH-EDGE-SECURITY-GATE — Trusted Proxy / Edge / Origin Production Proof
- **QAN-BL-LAUNCH-02** [MEDIUM] Retired Login ID / Public ID Digest: Keyed (HMAC) Hardening Under Managed Key Custody (P-7) — Owner: FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate
- **QAN-BL-LAUNCH-03** [MEDIUM] Shared ID Sealing Key: Production Custody, Provisioning and Rotation — Owner: FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate
- **QAN-BL-LAUNCH-04** [HIGH] Shared / Public Living Analysis — Physical Android Rapid-Interaction & Resize Stability Proof — Owner: Stage 9 — Economy + Launch Closure (release-readiness gate)
- **QAN-BL-LAUNCH-05** [MEDIUM] Introduction Photos on iOS: Device Cache Proof and Store Review of the Purpose Strings — Owner: Stage 9 — Economy + Launch Closure (release-readiness gate)
- **QAN-BL-LAUNCH-06** [MEDIUM] Export My Data's Photo Folder Save on iOS, Physical Android Devices and Read-Only Places — Owner: Stage 9 — Economy + Launch Closure (release-readiness gate)
- **QAN-BL-MATCH-03** [HIGH] Safe Compatibility Conclusion Production Capability, AI Cost Attribution and Evaluation — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-MATCH-04** [HIGH] Understanding Readiness Before Real Matching — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-MOB-01** [HIGH] Local expo-sqlite Stores Fail After BACK and a Relaunch in the Same Process (NullPointerException) — Owner: Stage 9 — Economy + Launch Closure (release-readiness gate)
- **QAN-BL-NOTIF-02** [HIGH] No Proactive QANDEEL Gate and No Proactive Event Producer — Owner: PROACTIVE-EVT-01 — Proactive QANDEEL Gate & Event-Producer Integration
- **QAN-BL-NOTIF-03** [MEDIUM] No User-Requested Exact-Time Reminder Runtime and No Reminder Event Producer — Owner: REMINDER-EVT-01 — User-Requested Reminder Runtime & Event Producer
- **QAN-BL-NOTIF-04** [HIGH] No Security / Sign-in / Account Event Source for Activity — Owner: ACCOUNT-SEC-EVT-01 — Account & Security Event-Producer Integration
- **QAN-BL-NOTIF-05** [HIGH] Native Push Physical-Device Exit Gates (PD-01 … PD-09) — Owner: Release Hardening & Launch — physical iOS / Android device validation
- **QAN-BL-PRIV-01** [MEDIUM] Export My Data Omits the Reader's Later Explicit Agreement with a Disagreed Understanding Item — Owner: PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts
- **QAN-BL-PRIV-02** [MEDIUM] Export My Data Omits the Reader's Notifications & Activity Preferences and Context Mutes — Owner: PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts
- **QAN-BL-PRIV-03** [MEDIUM] Export My Data Omits Whom Each Memory Is About (the Subject about Field) — Owner: PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts
- **QAN-BL-PRIV-05** [HIGH] Export My Data Omits the Reader's Shared, Public and Replay World Data — Owner: PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts
- **QAN-BL-PRIV-06** [HIGH] Protected-Human Analytical Subject-Authority Producer for Replay Distribution — Owner: AUTH-SUBJ-01 — Protected-Human Analytical Subject-Authority Producer
- **QAN-BL-PROD-04** [MEDIUM] Remote Auth Verification Cost and Capacity (PR01-A01 / A-03 / A-04) — Owner: PROD-AUTH-01 — Auth Verification Path
- **QAN-BL-PROD-05** [MEDIUM] List / Fan-out Corrections and Unmeasured Payload / Semantic-Phase Sizes (PR01-D/M) — Owner: PROD-DATA-01 — List/Fan-out Correction
- **QAN-BL-PROD-06** [HIGH] Data API Unbounded 40001 Retry on PostgREST Before v16 (Core Conversation, Hypothesis, Shared Standing Context, Matching, Shared ID Rotation) — Owner: HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate
- **QAN-BL-PROD-07** [LOW] Post-v16 PostgREST: Race-Converging 40001 Paths and Genuine Deadlocks Lose the Server-Side Re-run — Owner: PROD-RETRY-02 — Post-v16 Data API Retry Semantics
- **QAN-BL-PROD-08** [HIGH] Introduction Photo Object Store: Hosted Supabase Storage Provisioning and Live Conformance — Owner: HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate
- **QAN-BL-PROD-09** [HIGH] No World Opens in Production Without an Automated Account-Deletion Coverage Check — Owner: HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate
- **QAN-BL-PROD-10** [MEDIUM] A Photo Object Lost From the Private Store Blocks Its Owner's Export Bundle — Owner: HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate
- **QAN-BL-PROD-11** [MEDIUM] Replay Generation Hand-over: the Phone's Content-free TRANSIENT_HANDOVER_DEGRADED Has No Receiver, and the Server Cannot Tell a Degraded Switch From an Ordinary End — Owner: HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate
- **QAN-BL-PROD-12** [HIGH] Hosted Replay Pool Isolation & Monitoring Proofs — Owner: HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate
- **QAN-BL-PUB-REV-01** [HIGH] Published Topic Revisions and Version-Continuous Public Discussion (PRE-LAUNCH BLOCKER) — Owner: PUB-REV-01 — Published Topic Revisions & Version-Continuous Public Discussion
- **QAN-BL-QIR-01** [MEDIUM] General Question Bind-Time Version and Lifecycle Recheck (R3-G) — Owner: QIR-006-R1 — Formal Question Bind-Time Version & Lifecycle Recheck
- **QAN-BL-SEC-01** [HIGH] Mobile Credential Backup & Hardware Security Hardening — Owner: QAN-SEC-01 — Pre-release Mobile Credential Security
- **QAN-BL-VIS-01** [HIGH] Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof — Owner: LA-SCALE-01 — Living Analysis Heavy-History / Dense-World Scale & LOD Proof
- **QAN-BL-VOICE-01** [HIGH] Personal Voice / Live Call Runtime + Durable Audio Source — Owner: Stage 8B — Voice Runtime
- **QAN-BL-VOICE-02** [HIGH] Personal Voice Note Gate-Opening Conditions: the Open External Proof Conditions PC-S1 … PC-S7 and PC-D — Owner: S8B-08 — Voice Cost, Privacy & Launch Evidence
- **QAN-BL-VOICE-03** [HIGH] A Real Android Recording Refused by the Voice Note Duration Proof (First AAC Frame of 1792 Ticks) — Owner: S8B-08 — Voice Cost, Privacy & Launch Evidence
- **QAN-BL-VOICE-04** [HIGH] Personal Voice Note Physical-Device Proof List (Call, Headset, TalkBack / VoiceOver, Sign-out Cycle, Backup Run, C-53, iOS Device) — Owner: S8B-08 — Voice Cost, Privacy & Launch Evidence
- **QAN-BL-VOICE-05** [HIGH] QANDEEL's Voice Paid Evidence Not Run: Real Speed, Live-Transcript Quality, Voice Quality (D-S5, Speechmatics Realtime, P-1) and Their Preconditions — Owner: S8B-08 — Voice Cost, Privacy & Launch Evidence
- **QAN-BL-VOICE-07** [HIGH] Live Call Launch Capacity Residue: an Instance Crash Loses an Uncommitted Utterance's Transcript; Cross-User First Audio Contention (#34 under SHIPPED) and the ≤ 2 s Live Focus P95 Target — Owner: GCR-01 — Growth & Capacity Readiness (GCR-01-A)
- **QAN-BL-VOICE-08** [MEDIUM] Live Call Endpointer on Real Speech: Room Sound on the Speaker Route Arms Utterance Ends — Owner: S8B-08 — Voice Cost, Privacy & Launch Evidence

### VALIDATION — OPEN (4)
- **QAN-BL-ACE-02** [MEDIUM] Adaptive Conversational Expression: Real-Model Personality Behaviour on the Golden Conversations Suite — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime
- **QAN-BL-CI-02** [MEDIUM] Forward-Safety Mirror: the QAN-INF-03 Expo Dependency-Validation Leg Fails Intermittently on Some Local Hosts — Owner: QAN-INF-06 — Forward-Safety Mirror Expo Validation Determinism
- **QAN-BL-INTEL-02** [HIGH] Post-Response Intelligence Ledger Content (0029 Intent Span, 0033 Candidate Plan): Retention and Reuse After Forget / Do-Not-Rely — Owner: INTEL-RET-01 — Post-Response Intelligence Ledger Retention & Provenance Review
- **QAN-BL-IP-02** [MEDIUM] Interaction Preferences: Real-Model Behavioural Quality (Seven Reply Languages / Dialects, Brevity, Humour, Explanation Style) — Owner: Stage 8A — QANDEEL AI Brain / Production LLM Runtime

### OPEN — UNASSIGNED (17)
- **OPEN-06** [MEDIUM] Bookmarks — Owner: UNASSIGNED
- **OPEN-08** [MEDIUM] Coarse Temporal Step — Owner: UNASSIGNED
- **OPEN-09** [MEDIUM] Object-Originated Version Jump — Owner: UNASSIGNED
- **OPEN-19** [LOW] Dedicated No-Op Acknowledgement — Owner: UNASSIGNED
- **QAN-BL-CI-04** [MEDIUM] iOS World Gate (BG-10): Maestro Hangs Leave Cases NOT TESTED, Evidence Is Lost When the Job Is Cancelled, and the iPhone SE Cell Exceeds Its Time Budget — Owner: UNASSIGNED
- **QAN-BL-CW-06** [MEDIUM] The Ended Shared World Has No Read-Only Living Analysis View — Owner: UNASSIGNED
- **QAN-BL-CW-07** [MEDIUM] Shared World Temporal Navigation — Owner: UNASSIGNED
- **QAN-BL-CW-08** [MEDIUM] Shared World: No Navigation From a Semantic Place's Source to Its Position in the World's Conversation — Owner: UNASSIGNED
- **QAN-BL-INTEL-05** [MEDIUM] Analysis Refusal Handling: a Deterministic Semantic-Establishment Refusal Is Treated as Transient (a Call Item Parks and Retries With No Terminal State; a Written Exchange's Chain Is Silently Skipped) — Owner: UNASSIGNED
- **QAN-BL-MOB-02** [MEDIUM] Written Composer on Android: the Last Composing Word Returns at the Start of the Next Message — Owner: UNASSIGNED
- **QAN-BL-MOB-03** [MEDIUM] Conversation History Order on an Equal Timestamp: Two Exchanges Whose User Turns Share One createdAt Are Ordered by Their Random Id, Not by Write Order — Owner: UNASSIGNED
- **QAN-BL-NAV-01** [MEDIUM] Cross-Session Timeline — Owner: UNASSIGNED
- **QAN-BL-NAV-03** [MEDIUM] Shared / Public World Replay Surface — Owner: UNASSIGNED
- **QAN-BL-NAV-04** [MEDIUM] No Full Personal Detail Surface Beyond the PEEK (PERSONAL-DETAIL-01) — Owner: UNASSIGNED
- **QAN-BL-RSP-03** [HIGH] Arabic Global Switcher Destination Words Truncated at the Default Text Size on a Physical Phone — Owner: UNASSIGNED
- **QAN-BL-VIS-02** [MEDIUM] Replay's Personal Map Still Draws With the Pre-COSMOS Renderer (REPLAY-COSMOS-01) — Owner: UNASSIGNED
- **QAN-BL-VOICE-09** [LOW] Live Call 60-Minute Notice After a Late Rejoin: No CALL_ENDING Is Repeated on a Connection That Resumes Inside the Last Minute — Owner: UNASSIGNED

## 11. Change log / boundary
- **2026-11-23:** Documentation-only reconciliation identifies Stage 6 Matching as merged engineering and explicitly restores S8A-06/07/08 to the forward execution map, distinct from S8B-08. Preserves Replay FC-0 and iOS deferral evidence, post-Replay safety/hosting/launch gates, and all 75 non-closed backlog items as a reference snapshot.
- **Never infer completion** from an old project-map banner, a proposed migration, a local proof or a synthetic video. Use the latest verified PR and the canonical backlog, and keep all changes subject to PO review.

**NO IMPLEMENTATION AUTHORIZATION. NO NEW PR. NO MERGE. NO DEPLOYMENT.**
