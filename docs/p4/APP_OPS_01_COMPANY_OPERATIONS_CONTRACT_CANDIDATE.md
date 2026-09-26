# QANDEEL — APP-OPS-01
## QANDEEL App ↔ QANDEEL Company Operations Contract — Candidate

**Status:** `APP-OPS-01 — PRODUCT / ARCHITECTURE CONTRACT CANDIDATE — NOT FROZEN`

---

## 1. Status / authority / baseline

| | |
|---|---|
| Identifier | `APP-OPS-01` — QANDEEL App ↔ QANDEEL Company Operations Contract |
| Classification | `KNOWN CROSS-CUTTING PRODUCT GAP — PRODUCT / ARCHITECTURE CLOSURE ONLY` |
| Track | P4 — Remaining Product / Visual Gaps Census & Closure, task P4-A. It is the one cross-cutting exception the Product Owner admitted into P4 by direct decision ([P4_READ_FIRST.md](P4_READ_FIRST.md) §3) |
| Canonical baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` (GitHub `main`, PR #277) |
| Lifecycle | **candidate, not frozen.** It is closed only by a later P4 closure change after Product Owner and independent review (§23) |
| Inputs | the Product Owner decisions recorded in §3, which are authoritative input to this candidate and are not reopened here; plus consequences that existing frozen authority forces, each cited |
| Implementation | **none.** This document creates, changes and authorizes no code, schema, migration, dependency, event, API, service, dashboard, vendor or configuration (§20, §21) |

Reading conventions:

- **`PO-APPROVED`** marks a decision the Product Owner made. This candidate records it and does not reopen it.
- **`FORCED BY`** marks a consequence that existing frozen authority already fixes. The authority is named.
- **`CANDIDATE`** marks wording this document proposes for closure. It binds nothing until P4 closes it.
- **`OPEN → P4-DQ-nn`** marks a question this candidate refuses to answer. It sits in the
  [Product Owner Decision Queue](P4_PRODUCT_OWNER_DECISION_QUEUE.md).
- **`IMPLEMENTED TODAY`** / **`NOT IMPLEMENTED`** describe code on `main` at the baseline. Neither is Product authority.

---

## 2. Purpose

After launch, the QANDEEL Company has to be able to operate, observe and govern the released QANDEEL App. No
canonical record defines that relationship today. The repository has operational foundations: bounded telemetry, a
content-free outbox, health probes and a provider-neutral Model Router. CW2-08 adds feature-flag and Launch Gate law
for Connected Worlds. But no record says:

- what the Company may receive from the App;
- what it may never receive;
- what it may change in the App, and what it may never change;
- what happens to users when the Company side is unavailable.

APP-OPS-01 is the Product / Architecture contract for those four questions. It stays at the boundary level. It
designs no Company platform, BI system, CRM, support tool, finance, HR, admin tooling, analytics platform or internal
automation (§21).

---

## 3. Product Owner approved decisions

Each row is `PO-APPROVED` input to this candidate.

| ID | Decision |
|---|---|
| `PO-OPS-01` | **Operational relationship.** QANDEEL Company must be operationally connected to the QANDEEL App after launch, so that the Company can operate, observe and govern the released Product. This is a Product / Architecture relationship only. It authorizes no implementation |
| `PO-OPS-02` | **No Human Review of private conversation content.** No routine or exceptional human review of private QANDEEL conversation content is authorized through QANDEEL Company Operations / App Operations **or safety-monitoring flows**. This decision is not narrowed to Company Operations in order to preserve CW2-08. The resulting authority conflict with CW2-08 §8 / H7 is resolved by the later binding [CW2-08A controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md) (§18; `P4-DQ-10`, resolved) |
| `PO-OPS-03` | **Company private-content boundary.** **Operational telemetry is always content-free. APP-OPS-01 establishes no Company Operations path for receiving private user content.** Any future user-initiated support path in which the user deliberately shares selected content is **outside APP-OPS-01**, requires separate explicit Product authority, and is not established here (§6) |
| `PO-OPS-04` | **Operational telemetry only (App → Company).** The admitted domains are: service / app health; crashes / errors; latency / performance; session status; call status; AI provider; model; runtime path / runtime state; cost / usage cost; feature usage; subscriptions / business metrics; releases / version adoption; ratings / reviews; and user-specific operational diagnostics without user content (§5) |
| `PO-OPS-05` | **Asynchronous, off every critical path.** App → Company integration is asynchronous / event-driven and outside all user critical paths (§8) |
| `PO-OPS-06` | **Deterministic monitoring.** Monitoring is deterministic / event-driven by default. It is not continuous LLM polling (§9) |
| `PO-OPS-07` | **Governed control families (Company → App).** Feature Flags; Kill Switch; Maintenance Mode; Rollout Control; Minimum Supported Version; approved Remote Configuration; Model / Provider Route Hold (§10, §11) |
| `PO-OPS-08` | **No generic remote execution** (§12) |
| `PO-OPS-09` | **Persistent Company role.** «QANDEEL App Operations & Release Lead», reporting under the Product Director (§16) |
| `PO-OPS-10` | **Founder interaction.** The Founder interacts conversationally and exception-first through the Company Command Center (§17) |
| `PO-OPS-11` | **End-to-End Audit handoff.** For every relevant User Moment, the audit adds `Operational Events Required` and `Company Controls Required` (§19) |
| `PO-OPS-12` | **Production Integration ownership.** Production Integration owns implementation, after the End-to-End audit (§20) |

The control-plane limits in §10.2 are **not** a separate Product Owner decision. Each one is either `FORCED BY` an
existing authority in the scope that authority governs, supported by `PO-OPS-07` / `PO-OPS-08`, or `CANDIDATE`.
§10.2 names the source of each.

---

## 4. Company Operations vs QANDEEL runtime boundary

**CANDIDATE.** Two systems. Neither is the other's authority.

| | QANDEEL runtime | QANDEEL Company Operations |
|---|---|---|
| What it is | the App: mobile client, API, PostgreSQL and their frozen runtime owners (Conversation Orchestrator, Model Router, Safety Runtime, Behavioral Runtime, Memory, Connected Worlds authority) | the Company-side function that operates the released App: the App Operations & Release Lead (§16), the Company Command Center (§17), and any future monitoring destination or control surface Production Integration builds (§20) |
| What it owns | all Product truth: conversation, Memory, Analysis, World, Matching, Public and authority state. It also owns the **effective** value of every operational control, which it holds in its own canonical state (§10.1) | the operational picture, the incident decisions, and the **issuing** of governed controls within §10 |
| What it may not do | depend synchronously on Company Operations for normal work (§8) | create, read or change Product truth; receive private user content **through APP-OPS-01** (§6); execute code in the App (§12) |

Operational state that crosses the boundary is **operational, not semantic.** It must not become:

- Memory;
- Analysis;
- World truth;
- Matching truth;
- Public ranking truth;
- psychological inference;
- behavioral scoring.

This is `PO-APPROVED`, and it is `FORCED BY` existing law as well:

- CW2-08 §42: rollout / incident metrics "do not become semantic World truth, candidate truth, Public importance/rank truth, user-visible social scoring";
- FAST / DEEP policy v2 §2: "no subsystem gains semantic authority from the routing decision";
- Model Router: complexity "is a routing signal—not a measure of the user"; the Router must not "infer psychological state".

---

## 5. App → Company operational data plane

### 5.1 Admitted domains

`PO-APPROVED` as domains. **Approval of a domain is not evidence that it is collected today.** The right-hand column
keeps the two apart, from the records named in the
[compatibility matrix](P4_AUTHORITY_COMPATIBILITY_MATRIX.md).

| Domain | Operational meaning (CANDIDATE) | On `main` at the baseline |
|---|---|---|
| service / app health | liveness and bounded readiness of App services and their dependencies | **IMPLEMENTED TODAY, API only:** `/health`, `/health/live`, `/health/ready` return bounded states (Health / Readiness v1). No mobile health signal |
| crashes / errors | error and crash occurrence, with structural fields only | **IMPLEMENTED TODAY, API only:** Sentry with PII disabled and project sanitization. **NOT IMPLEMENTED** for the mobile client (no crash-reporting dependency in `apps/mobile/package.json`) |
| latency / performance | durations and outcomes of runtime work | **IMPLEMENTED TODAY, API only:** OpenTelemetry engine / provider duration metrics (Correlation & Telemetry v1) |
| session status | conversation turn and session lifecycle outcomes | **PARTLY:** turn-outcome metrics; the outbox `ConversationTurnCompleted / Failed / Cancelled` envelopes. Session-start events are deferred (Outbox v1) |
| call status | Voice Note and Live Call lifecycle state | **NOT IMPLEMENTED.** No Voice runtime exists (`QAN-BL-VOICE-01`); voice correlation is deferred (Telemetry v1) |
| AI provider · model | which adapter / model served a call | **IMPLEMENTED TODAY:** `provider` and `model` metric dimensions (Telemetry v1). Never exposed to the mobile Product (Model Router) |
| runtime path / runtime state | FAST / DEEP path, bounded routing reason, orchestration outcome | **IMPLEMENTED TODAY:** `qandeel.routing.decisions` with four bounded dimensions (FAST / DEEP v2 §12); the outbox payload's processing path and routing reason |
| cost / usage cost | resource consumption per call and its monetary cost | **PARTLY:** token usage metrics from provider-returned usage. **Monetary cost is not calculated** (Telemetry v1). `PO-OPS-04` approves the domain; it does not make cost telemetry exist |
| feature usage | use of Product capabilities, as operational counts | **NOT IMPLEMENTED.** Product analytics is deferred (Telemetry v1) |
| subscriptions / business metrics | plan, entitlement and revenue operations | **NOT IMPLEMENTED.** No plan, credit or billing system exists; the economy is coupled to the End-to-End audit (roadmap §3) |
| releases / version adoption | which App versions are live and in use | **PARTLY:** API service / environment / version resource metadata (Telemetry v1). No mobile version-adoption signal |
| ratings / reviews | app-store / marketplace rating and review signals (§5.3) | **NOT IMPLEMENTED** |
| user-specific operational diagnostics | one user's operational state, without content (§7) | **NOT IMPLEMENTED.** Health v1 states it "is not a … user-specific diagnostic … system" |

### 5.2 Data-plane properties

`PO-APPROVED` (§3) unless marked otherwise.

- **Always content-free.** Operational telemetry carries no private user content. APP-OPS-01 creates no other Company Operations path for receiving private user content (§6).
- **Non-semantic** (§4).
- **Asynchronous and off the critical path** (§8).
- **Failure-isolated.** An export failure never fails successful user work. `FORCED BY` Telemetry v1: "Export
  failures must not fail successful runtime work".
- **Bounded.** `FORCED BY` Telemetry v1, Outbox v1, FAST / DEEP v2 §12 and Health v1:
  - bounded dimensions and states;
  - no raw errors, endpoints, credentials or payloads;
  - no correlation identifiers or idempotency keys as metric labels.

  APP-OPS-01 widens none of these for the domains that already exist.

### 5.3 Ratings / reviews boundary

**CANDIDATE.** "Ratings / reviews" means signals the user published on an **app-store or marketplace**. It is never
permission to read private in-product content, and it opens no path by which private QANDEEL content becomes a
"review".

Three questions stay open, and this candidate answers none of them:

- whether the text of store reviews is ingested at all;
- whether a store review may be linked to a QANDEEL account;
- how the two kinds of source are held apart.

→ **`OPEN → P4-DQ-12`**.

---

## 6. Private-content boundary / No Human Review

### 6.1 No Human Review law

`PO-APPROVED` (`PO-OPS-02`):

> **No routine or exceptional human review of private QANDEEL conversation content is authorized through Company
> Operations / App Operations or safety-monitoring flows.**

This is not narrowed to the App Operations role, the Company Command Center, or ordinary telemetry. It is the
Product Owner's human-review boundary. Historical CW2-08 §8 / H7 wording let a person reach case-scoped private
evidence; rather than narrowing this decision, the CW2-08A controlled amendment supersedes that wording (§18).

### 6.2 Operational telemetry is always content-free

`PO-APPROVED` (`PO-OPS-03`) and consistent with the existing Telemetry / Outbox foundations:

> **Operational telemetry is always content-free.**

The APP-OPS operational path does not carry:

| Not carried | Also not carried |
|---|---|
| conversation text | prompts |
| audio (Voice Notes, Live Call) | model outputs |
| transcripts | HIM / hypothesis payloads |
| Memory content | private World content (Personal, Shared, Introduction) |
| Analysis content, including QANDEEL Understanding | raw request bodies |
| | credentials |

Existing implementation is already narrower in the same direction:

- Telemetry v1: "Telemetry never contains messages, outputs, prompts, Memory or HIM payloads, credentials, bodies,
  query strings, raw rows";
- Outbox v1: `contains_content=false`, and conversation text, provider data, prompts, Memory / HIM data and
  credentials are prohibited;
- Safety Runtime: "Private conversation content must not become ordinary telemetry"; "Raw audio is not logged by
  default";
- AGENTS.md §5.

### 6.3 APP-OPS-01 establishes no Company content-receipt path

> **APP-OPS-01 establishes no Company Operations path for receiving private user content.**

That statement is stronger and more precise than a bare "does not receive by default": this contract contains no
unspecified operational exception.

A future **user-initiated support flow** in which the user deliberately chooses to share selected content:

- is **outside APP-OPS-01**;
- requires separate, explicit Product authority before it exists;
- does not become operational telemetry;
- does not retroactively widen this contract.

APP-OPS-01 therefore neither authorizes nor designs such a path.

### 6.4 Safety / Moderation: the conflict is resolved by CW2-08A

Historical CW2-08 §8 bound `CASE_SCOPED_MODERATION_ACCESS` to an exact case, evidence scope, purpose, "authorized
role/service/person", validity and audit, and excluded only **blanket** private-World browsing. Read with §7's
`REPORT_CASE` evidence, it let a human "person" reach case-scoped private conversation content, contrary to
`PO-OPS-02`. P4-A recorded that conflict and did not resolve it by reinterpretation.

P4-B resolved it with the later binding
[CW2-08A controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md):
no human role or person may receive, inspect or review private QANDEEL conversation content under Safety /
Moderation authority, routinely or exceptionally. §18 records the reconciliation. No replacement moderation mechanism
was invented.

### 6.5 Incidents create no Company Operations exception

An operational incident is diagnosed from the content-free operational state admitted by §5. APP-OPS-01 creates no
incident exception that routes private user content into Company Operations.

## 7. User-specific operational diagnostics boundary

**CANDIDATE**, within `PO-OPS-04`:

- diagnostics may be scoped to **one user's operational state**. Examples: turn outcomes, failure classes, runtime
  path, provider availability for that user's calls, App version, entitlement state as an operational fact;
- **no content** of any kind (§6.2);
- **no semantic profiling.** Diagnostics feed no Memory, Analysis, HIM, Matching, ranking or scoring (§4);
- **no human review** of private conversation content (§6.1);
- **purpose:** troubleshooting, operational support and reliability. Nothing else.

This candidate chooses none of the following:

- identifier format, hashing or pseudonymization;
- retention;
- query mechanism or storage location;
- which operator may see user-linked state, and on what trigger;
- the support lookup flow.

→ **`OPEN → P4-DQ-11` — `IDENTITY / RETENTION / ACCESS MODEL FOR USER-SPECIFIC OPERATIONAL DIAGNOSTICS`**, which
classifies each part.

Existing facts that row must respect:

- the outbox envelope already carries opaque user / session / turn IDs, classed `SENSITIVE` with
  `OPERATIONAL_EVENT_V1` retention (Outbox v1);
- Telemetry v1 forbids correlation identifiers as metric labels;
- P1 §13 keeps the internal `user_id` hidden in every context.

---

## 8. Async / critical-path isolation

`PO-APPROVED` (`PO-OPS-05`):

1. Chat does not synchronously wait for Company Operations.
2. Voice does not synchronously wait for Company Operations.
3. Live Call does not synchronously wait for Company Operations.
4. Analysis does not synchronously wait for Company Operations.
5. Normal QANDEEL runtime does not synchronously wait for Company Operations.
6. A monitoring export failure never turns successful user work into failure.
7. Company Operations availability is not a prerequisite for normal interaction.

Existing evidence consistent with this law (evidence, not the law itself):

- the interactive path never contacts Redis, and the API continues when the transport is unavailable (Outbox v1,
  Startup Recovery v1);
- observability is fail-soft and "does not participate in database transactions" (Telemetry v1);
- optional observability / runtime-event degradation does not make readiness fail (Health v1).

APP-OPS-01 consumes these as architectural evidence. It does **not** freeze any of them as the required mechanism
(§20).

---

## 9. Deterministic / event-driven monitoring principle

`PO-APPROVED` (`PO-OPS-06`), frozen at principle level only:

- operational correctness never depends on an LLM continuously watching production;
- alerts and operational state transitions derive by default from explicit events, thresholds, state machines or
  deterministic rules;
- where Company Operations later uses an LLM, it is advisory: summarization, investigation assistance, conversational
  surfacing (§17). It is not the authoritative trigger for core operational correctness, unless a future controlled
  contract explicitly says so;
- no LLM polls private user content, continuously or otherwise (§6).

This candidate chooses no monitoring vendor, alerting vendor, queue, dashboard, data warehouse, LLM provider,
polling interval, threshold, SLO or SLA (§21).

---

## 10. Company → App governed control plane

### 10.1 Properties

| Property | Source |
|---|---|
| **Approved families only.** Only the currently approved control-family set of §11 exists. A future additional family requires explicit controlled Product / Architecture approval before it can enter this contract (§12) | `PO-OPS-07`, `PO-OPS-08` |
| **Explicit scope.** Every control names what it governs: capability, surface, cohort, version range or route | `PO-OPS-07`; `FORCED BY` CW2-08 §28 ("Every `LAUNCH_REQUIREMENT` binds an exact `CAPABILITY_SCOPE`") for Connected Worlds |
| **Runtime-held effective state.** A control takes effect only as state the QANDEEL runtime holds canonically and reads locally. The runtime never asks Company Operations synchronously whether it may proceed | **CANDIDATE**, and the only reading consistent with two approved laws together: `PO-OPS-05` (no synchronous dependency) and CW2-08 §24 (`FEATURE_FLAG_STATE` is "Server-canonical") |
| **Only a valid, authenticated, currently effective control acts.** A missing, failed, unreachable or unauthenticated Company Operations response is never a control, and never an implicit Kill Switch | `PO-OPS-05` and the task's approved outage-isolation law. The authentication mechanism → §20 |
| **Cannot manufacture Product authority** | `FORCED BY` CW2-08 §1, §2, H1, H17 and CW2-02 §46, B31 in Connected Worlds scope. Outside that scope, **CANDIDATE** (§10.2) |
| **No generic remote execution** | `PO-OPS-08` (§12) |
| **Auditable** | `FORCED BY` CW2-08 §5 and §36 for Safety / launch restrictions. For the other families, the audit and versioning guarantee → `OPEN → P4-DQ-13` |

### 10.2 What controls may and may not do

These limits are not a separate Product Owner decision. Each row names its actual source. A `FORCED BY` CW2-08 /
CW2-02 row binds in the scope that authority governs, which is Connected Worlds. Its extension to the rest of the App
is **CANDIDATE** until `P4-DQ-15` is answered.

**Controls MAY** narrow, disable, hold, gate rollout, require upgrade or enter maintenance. These are the acts of the
currently approved families (`PO-OPS-07`, §11).

| Controls MAY NOT | Source |
|---|---|
| manufacture user consent, or any privacy / ownership authority | `FORCED BY` CW2-08 §2, H1, H17 ("Feature enablement never grants privacy authority"); CW2-02 §46, B31 |
| widen an audience | `FORCED BY` CW2-08 §24, H17 |
| move information across Worlds | `FORCED BY` CW2-08 §2 ("source isolation", "cross-world geography separation") |
| alter historical truth | `FORCED BY` CW2-08 §26, H19 (disable / rollback stops new actions without rewriting history) |
| delete owned content merely because a feature is disabled | `FORCED BY` CW2-08 §26, H19 |
| override non-waivable Safety / privacy invariants | `FORCED BY` CW2-08 §2; Safety Runtime ("Safety requirements are hard constraints") |
| impose unsupported shared-state transitions across cohorts | `FORCED BY` CW2-08 §27, H20 |
| leave a required unknown / unconfigured state open | `FORCED BY` CW2-08 §40, H4, which fails it closed |
| perform arbitrary code execution | `PO-OPS-08` (§12) |

### 10.3 Invariant test of every family

Each family was tested against the ten dimensions the task names. The result, per dimension:

| Dimension | Result for each currently approved family | Authority |
|---|---|---|
| privacy / ownership | a control can only remove permission. It never grants privacy or ownership authority | CW2-08 §2, H1, H17; CW2-02 B30–B31 |
| World boundaries | no control moves material, context or identity across Worlds | CW2-08 §2 ("source isolation", "cross-world geography separation") |
| safety | no control relaxes a Safety restriction or a non-waivable invariant. A Route Hold cannot force a route that fails safety requirements | CW2-08 §2, §29; Safety Runtime "Routing Safety" |
| entitlement | a control is not an entitlement, and entitlement is not a control. Either may restrict; neither grants the other | CW2-08 §20, H16; CW2-02 §45 |
| launch gates | a control never marks a Launch Requirement `SATISFIED` and never waives a non-waivable one. `EMERGENCY_DISABLED` invalidates stale in-flight eligibility | CW2-08 §25, §29, §40, H18, H22 |
| Direct Entry / user state | a disable, maintenance or version gate may stop an action. It cannot delete or rewrite the user's history, Memory or World state, and restoring the capability resurrects nothing owner-deleted | CW2-08 §16, §26, H12, H19 |
| multi-user consistency | a cohort-scoped control cannot impose an unsupported shared-state transition on a participant in another cohort | CW2-08 §27, H20 |
| provider neutrality | only the Route Hold touches providers, and only negatively (§14) | Model Router |
| offline / stale state | old or unknown client state fails safely, and the server revalidates at commit. The effective state is runtime-held (§10.1). Freshness, expiry and last-known-good → `OPEN → P4-DQ-13` | CW2-08 §38, H26 |
| failure isolation | a Company Operations outage changes no effective control (§15) | `PO-OPS-05` |

No family needed a semantic that is not approved, **except** the three rows the Decision Queue carries:

- **`P4-DQ-13`** — freshness, integrity and audit guarantees for control state outside CW2-08;
- **`P4-DQ-14`** — the user-facing behavior of Maintenance Mode and Minimum Supported Version;
- **`P4-DQ-15`** — whether CW2-08's feature-flag and Launch Gate laws extend to capabilities outside Connected Worlds.

---

## 11. Control-family definitions

These are the **currently approved** Company → App operational control families, all seven `PO-APPROVED` as
families (`PO-OPS-07`). The set is not permanently exhaustive, but it grows only by controlled change (§12). The
definitions are **CANDIDATE** unless marked otherwise.

| # | Family | Definition | Boundary |
|---|---|---|---|
| 1 | **Feature Flags** | the CW2-08 `FEATURE_FLAG_STATE` (`DISABLED`, `INTERNAL`, `LIMITED_ROLLOUT`, `ENABLED`, `EMERGENCY_DISABLED`), issued by Company Operations | **CW2-08 §24 stays the one feature-flag authority** (§13). Client flags are presentation hints only |
| 2 | **Kill Switch** | the emergency act of taking an exact capability scope out of service at once. For a Connected Worlds capability it is the move to `EMERGENCY_DISABLED` (CW2-08 §24–§25), which invalidates stale in-flight eligibility | stops new actions and, where required, serving. It never deletes or rewrites history (CW2-08 §26). Its reach over non-Connected-Worlds capabilities → `P4-DQ-15` |
| 3 | **Maintenance Mode** | a declared, scoped period in which named capabilities, or the whole App, are held unavailable for operational reasons | an intentional restriction, distinct from an outage (§15). What the user sees, and what stays readable → `P4-DQ-14` |
| 4 | **Rollout Control** | cohort-scoped exposure: `INTERNAL` and `LIMITED_ROLLOUT` through to `ENABLED` | CW2-08 §27, H20: one participant's cohort cannot impose unsupported transitions on another |
| 5 | **Minimum Supported Version** | a declared lowest App version allowed to perform a scoped set of actions | `FORCED BY` CW2-08 §38: "Old/unknown client states fail safely. Server checks current authority, entitlement, feature and launch gates at commit." The upgrade experience → `P4-DQ-14` |
| 6 | **Approved Remote Configuration** | runtime values in a configuration family that has been explicitly approved | see the rules below this table. The family register and its guarantees → `P4-DQ-16` |
| 7 | **Model / Provider Route Hold** | a negative operational constraint: an otherwise eligible provider or route is held out of eligibility for operational reasons | §14 |

Rules for family 6, Approved Remote Configuration:

- The value must be typed, bounded and scope-limited.
- The family must be explicitly recognized as approved.
- It must be unable to create privacy, ownership or truth authority.
- It must be unable to rewrite frozen Product semantics.
- It must be unable to inject executable code.
- It must be unable to become generic remote execution.
- The ceiling is the Foundation Freeze's "Configurable Without Breaking Freeze" list. Behavior-changing prompt
  wording is outside that list, so no remote configuration can carry it.

---

## 12. No generic remote execution

`PO-APPROVED` (`PO-OPS-08`). Company Operations has no control that:

- runs code, scripts, queries or commands in the App, API or database;
- injects executable content, rules or expressions into the App;
- changes behavior beyond the typed value of an approved family (§11);
- reaches a user's data or session in order to act on it.

The seven families of §11 are the currently approved control-family set. A future additional family requires
explicit controlled Product / Architecture approval before it can enter this contract. No family can be added
through Remote Configuration or any other control.

**Out of scope for this contract:** delivering new App code, whether by store release or by any over-the-air
mechanism. That is a release, not a control. No such mechanism exists in `apps/mobile/` at the baseline. How it is
classified → `OPEN → P4-DQ-17`.

---

## 13. Feature flag / rollout / launch compatibility

APP-OPS-01 **consumes** CW2-08. It does not restate it as a second authority. For Connected Worlds capabilities these
laws stay in force unchanged, and Company Operations is only the operator that issues state under them:

| CW2-08 law | Where |
|---|---|
| `FEATURE_FLAG_STATE` is server-canonical; client flags are presentation hints only | §24 |
| feature enablement never grants privacy authority | §24, H17 |
| emergency disable invalidates stale launch eligibility | §25, H18 |
| disable / rollback stops new actions without rewriting history | §26, H19 |
| multi-user shared semantics stay server-canonical across cohorts | §27, H20 |
| launch requirements are capability-scoped | §28, H21 |
| unknown / unconfigured required state fails closed | §40, H4 |
| rollout / incident metrics are operational data, not semantic truth | §42 |

These rules hold beside it:

- **An outage is not `UNKNOWN`.** A Company Operations outage leaves the runtime-held canonical state as it was
  (§10.1). An unconfigured required state still fails closed under CW2-08 §40. That comes from CW2-08 and has
  nothing to do with the outage.
- **Personal capabilities.** CW2-08 is written for Connected Worlds. Whether its flag, snapshot and fail-closed laws
  also bind Personal conversation, Voice, Analysis and the rest of the App is not answered by any record →
  `OPEN → P4-DQ-15`.

---

## 14. Model / Provider Route Hold compatibility

> **A Route Hold is a negative operational constraint. It is not provider selection.**

**CANDIDATE**, `FORCED BY` the Model Router, FAST / DEEP v2 and the Safety Runtime:

- A Route Hold acts only where the Model Router already acts: "Remove unhealthy providers" and eligibility filtering.
  It removes eligibility. It never adds eligibility, and never ranks.
- It does not:
  - choose the final provider or model;
  - hard-code "the Qandeel brain";
  - pre-empt the benchmark-driven selection the roadmap places with the End-to-End audit.
- It cannot force a route that violates required behavior or safety. Fallback "must never downgrade required behavior
  or safety" (Model Router); "Safety requirements are hard constraints" (Safety Runtime). If a hold leaves no eligible
  route for a required capability, the runtime follows its own existing safe-failure law. The hold does not weaken
  the requirement.
- It never exposes provider identity to the mobile Product. The Router must not "expose provider details to mobile".
- It does not change FAST / DEEP. FAST / DEEP is "execution / routing authority only" (FAST / DEEP v2 §2), and a hold
  does not alter the path decision's semantics.
- It invents no Product behavior.

No route-hold state, schema or data model is defined here (§21).

---

## 15. Failure semantics

**CANDIDATE**, assembled from `PO-OPS-05` and the cited laws.

| Situation | What happens | Source |
|---|---|---|
| Company Operations control plane or monitoring destination unavailable, slow or erroring | normal runtime continues. Effective controls are unchanged. Operational data is delayed or lost according to its own durability class. User work does not fail | `PO-OPS-05`; Telemetry v1; Outbox v1 |
| operational export fails | fail-soft; the user outcome is unchanged | Telemetry v1; Outbox v1 |
| a control is absent, cannot be fetched, or fails authentication | not a control. **Never an implicit Kill Switch** | approved outage-isolation law; §10.1 |
| a valid, authenticated, currently effective Kill Switch / Maintenance / Minimum Version / rollout restriction / Route Hold | intentionally restricts **only** the scope it names | `PO-OPS-07`; CW2-08 §28 |
| required CW2-08 launch / feature state is unknown or unconfigured **in the runtime's own canonical state** | the scoped capability fails closed. That is CW2-08, not an outage effect | CW2-08 §40, H4 |
| a control is stale, or conflicts with a newer one | `OPEN → P4-DQ-13` | — |
| a Route Hold leaves no eligible route | the existing safe failure / degradation law. No downgrade | Model Router; Safety Runtime "Failure Behavior" |

---

## 16. Persistent Company role

`PO-APPROVED` (`PO-OPS-09`):

> **QANDEEL App Operations & Release Lead**, reporting under the **Product Director**.

Product-level responsibilities:

- app operational health;
- releases;
- rollout controls;
- approved operational diagnostics (§7);
- provider / model operational route holds (§14);
- operational incident coordination;
- maintaining the App ↔ Company Operations contract (this document, once closed).

The role's access is bounded by this contract, and later by security implementation (§20). The role never grants
access to private content (§6). This candidate defines no employee identity, hiring, HR, RBAC implementation,
on-call rotation, salary or staffing count.

---

## 17. Founder / Company Command Center relationship

`PO-APPROVED` (`PO-OPS-10`). At Product / Architecture intent level:

- the Founder does not need to watch dashboards continuously;
- meaningful exceptions and operational decisions are surfaced conversationally;
- the Command Center may summarize approved operational telemetry (§5);
- the Command Center gains **no** access to private user content through APP-OPS-01 (§6);
- the Founder interface is not an authority bypass. Consequential controls still follow §10 and §11.

No Company canonical source defining the Command Center exists in this repository. The only mentions are the P4-A
package itself, found by a repository search at the baseline. So no Command Center UI or behavior is designed here,
and none is implemented.

---

## 18. Safety / Moderation authority reconciliation

> **Conflict resolved by the later binding CW2-08A controlled amendment.**

P4-A re-checked the frozen source rather than reconciling it by scope narrowing, and recorded a real conflict. P4-B
resolved it with an additive controlled amendment:
[`QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md`](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md),
effective on merge.

### 18.1 The historical conflicting authority

Historical CW2-08 §8, **Moderator operational access**, defines:

> `CASE_SCOPED_MODERATION_ACCESS`

bound to:

- exact case;
- evidence scope;
- purpose;
- **authorized role/service/person**;
- validity;
- audit.

It then states:

> No blanket private-World browsing follows from the moderator role itself.

Related authority:

- CW2-08 §7: `REPORT_CASE` is protected operational state bound to an exact target/context and carries report
  evidence;
- CW2-08 H7: "Moderator access is case-scoped and auditable";
- CW2-08 §36 records actor / role in protected operational actions;
- CW2-08 §44 item 5 leaves detailed moderation / report UX + appeals intentionally open.

### 18.2 Why it was a conflict

That text did not merely authorize an automated service. It explicitly included an authorized **person**, gave that
actor an **evidence scope**, and limited only **blanket** private-World browsing. Its plain reading permitted human,
case-scoped access to private-World evidence within the exact moderation case.

Where that evidence is private QANDEEL conversation content, it conflicted with the Product Owner decision
`PO-OPS-02`:

> **No routine or exceptional human review of private QANDEEL conversation content is authorized through Company
> Operations or safety-monitoring flows.**

The conflict could not be removed by narrowing `PO-OPS-02` to Company Operations, or by reinterpreting "person" to
mean "service".

### 18.3 How CW2-08A resolves it

- **CW2-08A is the later binding authority** for CW2-08 §8's actor / access wording, H7, and the §44 item 5
  boundary. The original CW2-08 remains frozen, historical and byte-identical.
- **Safety / Moderation cannot use human review of private conversation content.** Where a case's evidence scope
  contains it, only authorized non-human Safety / Moderation processing under existing Safety authority may reach it.
  Case scope, purpose, validity and audit still apply. `ESCALATE` does not by itself authorize human access.
- **Automated Safety processing remains allowed**, purpose-limited and least-data, and never becomes ordinary
  telemetry.
- **No replacement moderation mechanism was selected**: no service, classifier, vendor, queue, dashboard, appeal
  process or schema.
- **Not decided:** moderation of content that is not private conversation content, including Public moderation; and
  any future user-initiated support-sharing flow, which stays outside APP-OPS-01 (§6.3).
- **The Company Operations content boundary is unchanged** (§6): telemetry is always content-free, and APP-OPS-01
  establishes no Company Operations path for receiving private user content.

### 18.4 Non-conflicting CW2-08 authority remains preserved

Every non-conflicting part of CW2-08 remains binding (CW2-08A §6), including:

- typed and versioned Safety restrictions;
- `SAFETY_PRIVATE_OPERATIONAL_STATE`;
- protected `REPORT_CASE` state;
- Block and anti-enumeration law;
- Public moderation serving states and owner-deletion precedence;
- entitlements;
- feature flags, Launch Gate, fail-closed launch law and non-regression;
- operational telemetry as non-semantic state;
- capability-scoped launch requirements.

CW2-08A is narrowly scoped to the human-access conflict and reopens none of these laws.

### 18.5 Effect on APP-OPS-01 / P4

- `P4-DQ-10` is **RESOLVED BY CONTROLLED CW2-08A AMENDMENT** and no longer blocks APP-OPS-01 or P4 closure.
- APP-OPS-01 itself remains **`CANDIDATE / NOT FROZEN`**: other decisions are still open (§22), and its closure
  conditions (§23) still apply.

## 19. End-to-End Audit handoff

`PO-APPROVED` (`PO-OPS-11`):

> **The QANDEEL End-to-End Product Experience Completeness Audit must add `Operational Events Required` and
> `Company Controls Required` to every relevant User Moment.**

The audit consumes the **closed** APP-OPS-01. Illustrative moments only; the audit itself defines them:

- app launch;
- sign-in;
- conversation send / response;
- provider failure;
- Voice Note;
- Live Call start / reconnect / failure;
- Analysis entry;
- notification delivery;
- Shared / Public / Introduction actions;
- billing / entitlement;
- account / security events;
- version / maintenance gates.

For each field, the audit names the events and controls the moment needs, inside §5, §6 and §11. It does not
design schemas. The audit has **not** started, and P4-A performs none of it
([Carry-Forward Matrix](P4_CARRY_FORWARD_MATRIX.md)).

---

## 20. Production Integration handoff

`PO-APPROVED` (`PO-OPS-12`):

> **Production Integration owns the implementation of APP-OPS-01, after the End-to-End audit.**

Nothing below is built by P4. Each item is owned by Production Integration, and scoped by the audit's result:

- APIs, migrations, telemetry collectors, SDK wiring;
- event schemas, and new outbox event domains;
- Redis / queue changes;
- dashboards, alerting;
- Sentry and OpenTelemetry changes;
- Company database, data warehouse;
- control-plane service, feature-flag service, Remote Config service;
- kill-switch, rollout, maintenance, minimum-version and route-hold runtimes;
- Command Center;
- RBAC, audit-log infrastructure;
- control-plane authentication.

Production Integration may consume or extend the existing outbox, telemetry and health infrastructure if it proves
appropriate. **APP-OPS-01 does not require the Redis Streams transport, or any existing mechanism, as the Company
Operations channel.**

---

## 21. Explicit non-scope

APP-OPS-01 does not decide, design or implement any of the following.

**Schemas and interfaces:**

- operational event schema or telemetry field names;
- control API;
- remote-config schema;
- route-hold data model.

**Vendors and infrastructure:**

- AI provider, monitoring, alerting or logging vendors;
- dashboard or Command Center UI;
- data warehouse.

**Numbers and policies:**

- data retention durations;
- alert thresholds, SLOs, SLAs;
- cost calculation algorithm, pricing or credits.

**Security mechanisms:**

- user-diagnostic lookup identity mechanism;
- encryption or signing implementation;
- RBAC implementation;
- on-call process.

**Product specifics:**

- exact kill-switch scopes;
- exact maintenance or forced-upgrade screens;
- final voice provider;
- any new Product copy.

**Company-wide systems:**

- Company backend, BI, CRM, support tooling, finance, HR, general admin tooling;
- a generic analytics platform;
- internal automation.

---

## 22. Unresolved decisions

These sit in the [Product Owner Decision Queue](P4_PRODUCT_OWNER_DECISION_QUEUE.md) and are not answered here.
`P4-DQ-10` is no longer open: it is **RESOLVED BY CONTROLLED CW2-08A AMENDMENT** (§18) and kept in the queue as a
resolved record.

| Row | Question | Blocks APP-OPS-01 closure? |
|---|---|---|
| `P4-DQ-11` | identity / retention / access model for user-specific operational diagnostics | the **access principle** part: yes. The mechanism: no |
| `P4-DQ-12` | ratings / reviews exact boundary | no, if closure keeps §5.3's narrower default |
| `P4-DQ-13` | control-state freshness, integrity and audit guarantees outside CW2-08 | no. The principle is set (§10.1, §15); the mechanism goes to Production Integration |
| `P4-DQ-14` | Maintenance Mode / Minimum Supported Version user-facing behavior | no, if it is handed to the End-to-End audit |
| `P4-DQ-15` | whether the CW2-08 flag / snapshot / fail-closed laws extend to non-Connected-Worlds capabilities | yes. It fixes the reach of families 1, 2 and 4 |
| `P4-DQ-16` | the Approved Remote Configuration family register and its guarantees | no, for P4. Yes, before any Remote Configuration exists |
| `P4-DQ-17` | classifying code delivery (store release or over-the-air) relative to "no generic remote execution" | no |

---

## 23. Closure conditions

APP-OPS-01 may move from this candidate to `CLOSED / FROZEN` only in a later P4 closure change, and only when all of
the following hold:

1. The Product Owner and an independent reviewer have reviewed this candidate.
2. The CW2-08A controlled amendment that resolves `P4-DQ-10` is merged, so Safety / Moderation authority no longer
   authorizes human review of private conversation content contrary to `PO-OPS-02`. P4-B carries it; this condition
   is met once that change merges.
3. `P4-DQ-11` (access principle) and `P4-DQ-15` are answered by the Product Owner. The other open APP-OPS rows are
   either answered or explicitly carried forward, each with a named owner.
4. The closing change reconciles every APP-OPS carry-forward under BG-06 / BG-08 against the canonical backlog, and
   decides whether any concrete obligation deferred to a named future task needs a backlog entry
   ([Carry-Forward Matrix](P4_CARRY_FORWARD_MATRIX.md) §3).
5. The closing change moves this document's banner to its final lifecycle state (BG-09), and updates the entry
   points and the indexes it names.
6. `npm run test:task-closure-governance-contract` passes on the closing head.

Until then, APP-OPS-01 is **NOT FROZEN**. It binds no implementation, and nothing may be built from it (§20).
