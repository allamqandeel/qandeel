# CI-01 / C0 — Shared Intelligence Learning Evidence & Baseline: Research, Repo Truth & Product Decision Gate

**Phase:** C0 — RESEARCH / REPO TRUTH / DECISION GATE · **Status:** `C0 DECISION REPORT — PRODUCT DECISIONS APPROVED WITH CONTROLLED AMENDMENTS (D1–D10, P1–P9; Product Owner, 2026-10-10) · C1 TASK CONTRACT APPROVED WITH MANDATORY AMENDMENTS (2026-10-10) · C1-A DELIVERED LOCALLY · C1-B DELIVERED LOCALLY · C1 LOCAL CLOSURE PREPARED (2026-10-10) — NOT PUSHED · NOT VERIFIED ON GITHUB · NOT MERGED` · **Date:** 2026-10-10 (research and decisions the same day)
**C1 Task Contract:** [DRAFT — CI-01 / C1 — Intelligence Evidence & Conversational Personality Baseline](QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) — a proposal only; implementation of C1 begins only on the Product Owner's explicit approval of that contract.
**Baseline:** `origin/main` = `6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24` (merge of PR #324, PROD-RETRY-01). Migrations `0001`–`0150`. Migration `0150` is complete in the repository and **NOT DEPLOYED**.
**Branch:** `ci/ci-01-c0-decision-report` (documentation only; nothing else is written).
**Annex (added scope, Product Owner 2026-10-10):** [Adaptive Conversational Presence & Interaction Style](QANDEEL_CI_01_C0_INTERACTION_STYLE_ANNEX_v1.md) — the Interaction Style Capability Gap Matrix, the proposed Conversational Personality v1, the Golden Conversation suite and decisions P1–P9.
**Evidence rule:** every statement below is either cited to a repository file (path and line) or to a prior-session synthetic harness run whose provenance is stated in §4.4. No SQL, API, mobile, migration, provider binding, hosted connection, real user data or GitHub CI was touched or run.

> This document is research evidence and, since 2026-10-10, the record of the Product Owner's C0 decisions (§0). It creates no runtime semantics, opens no implementation, and widens no permission: the decisions reopen no frozen contract, and the frozen records cited below remain the authority (AGENTS.md §2, backlog BG-07). Where a C0 recommendation differed from the decision, the decision is binding and the affected section carries the amendment (§0.2).

---

## 0. Product Owner decisions (2026-10-10) — APPROVED WITH CONTROLLED AMENDMENTS

The decisions below are recorded in substance as the Product Owner stated them. "C0 recommendation" is what this report proposed; "Decision" is what binds CI-01 from here on.

| # | Decision asked | C0 recommendation | Decision (Product Owner, 2026-10-10) |
|---|---|---|---|
| D1 | What "Shared Intelligence Learning" means for CI-01 (§2: A / B / C / D) | D now, A as the only learning direction | **APPROVED.** CI-01 v1 starts with Direction **D — Evidence & Evaluation Baseline**. Direction **A** — improving QANDEEL's understanding of the user from the user's own authorized evidence — is the **only** learning direction this programme may design for at present. The approval authorizes **no new Learning Runtime and no model training**. |
| D2 | Rename or disambiguate (collision with `QAN-BL-CI-01`) | keep the roadmap name, never abbreviate | **APPROVED.** The full name `CI-01 — Shared Intelligence Learning Evidence & Baseline` is kept. It must never be confused with `QAN-BL-CI-01` (iOS CI). |
| D3 | Admit the learning prohibitions as a named Product rule | one-page controlled record in C1 | **APPROVED.** The eight privacy-and-learning limits of §5.1 are adopted as a clear Product rule, including: no transfer of personal data between users; no training on private content without explicit authority and explicit consent; no leakage of content into Telemetry. The existing canonical rules are preserved; the new record is **not** a source of widened permissions. |
| D4 | Define readable / learnable / retainable evidence classes (§4.2) | approve as written | **APPROVED WITH AMENDMENT.** The three classes are adopted, with a mandatory further distinction between (i) a result that is **still technically stored**, (ii) a result that **may currently be used**, and (iii) a result that **may legitimately be kept**, as Product and as law, after its source has disappeared. The existence of a derivative in the database after its evidence was deleted is **not** a permission to keep relying on it. The deletion and history behaviours actually approved in each system are followed; **no unified deletion rule may be invented** that contradicts the frozen contracts. §4.2 is amended accordingly. |
| D5 | Scope of the v1 baseline (C1) | documentation + static checks + synthetic recipe | **APPROVED WITH SCOPE SPLIT.** C1 is organised internally as **C1-A — Canonical Evidence Baseline**, the privacy rules and the evidence classification, with the appropriate documentary and static tests; and **C1-B — Synthetic Intelligence Reality Baseline**, a reproducible test recipe on **local PostgreSQL with synthetic data only**. The split is organisational, **not an implementation authorization**. No production change in either; no external run; no user data. §6 and §7 are amended accordingly. |
| D6 | Whether CI-01 opens C2 at all (§7) | C2-a as one separately contracted slice | **APPROVED WITH CONTROLLED DECOMPOSITION.** Direction C2-a is approved for treating the personal-understanding shortfall **after C1 is accepted**, but never as one large task. Its scope is cut into bounded slices, for example: (1) PG-02 — propagation of evidence withdrawal and re-evaluation of derivatives; (2) correction and duplicate repair in Memory; (3) Arabic capture improvement that preserves the user's meaning and wording; (4) the confusion between the user's information and other people's; (5) review of relevant-information retrieval under existing authorities, without duplicating `QAN-BL-CTX-01`. These are examples of the cut, **not** approval of any contract change. **The disappearance of evidence does not automatically make a hypothesis false**: it must be re-evaluated according to its state, the remaining evidence and the approved rules, without inventing Confidence or a new truth. Any change to frozen semantics requires Controlled Change and a separate decision. §7 is amended accordingly. |
| D7 | Quality baseline without a provider (§4.3) | structural yields on synthetic fixtures only | **APPROVED.** Before Stage 8A, structural capabilities are measured on synthetic data — capture yield, recall, truth maintenance, privacy isolation. **No number may claim to measure natural conversation quality or QANDEEL's real intelligence without an actual LLM test.** |
| D8 | Shared World learning (B) | defer to `SHARED-CTX-01` | **APPROVED.** Learning or use of personal context inside the Shared World is deferred to the competent authority, notably `SHARED-CTX-01`. No new Shared learning path opens in CI-01. |
| D9 | Aggregate learning (C), training, fine-tuning | CLOSED for CI-01 | **APPROVED.** No general cross-user learning, no fine-tuning, no collection of private content for training or evaluation. Any future programme needs its own independent Product Consent and Privacy Authority. **Evaluation with synthetic cases is authorized within the current limits.** |
| P1–P9 | Interaction style (annex §0) | see annex | **APPROVED WITH CONTROLLED AMENDMENTS** under the principle **ONE QANDEEL PERSONALITY — ADAPTIVE NATURAL EXPRESSION**; recorded in the [annex](QANDEEL_CI_01_C0_INTERACTION_STYLE_ANNEX_v1.md) §0. Approval of the personality design is **not** evidence that any LLM will reach the required quality; that proof is Stage 8A. |
| D10 | Documentary note: stale SHARED-VIS-01 banners (§11.1) | acknowledge | **ACKNOWLEDGED.** Recorded as an independent documentation gap. PR #321 is merged, but the old records need Governance Reconciliation. It is **not** repaired within CI-01, and neither Issue #322 nor any Release Gate is considered closed. |

### 0.1 Non-negotiable execution rules (Product Owner, 2026-10-10)
These decisions reopen no frozen contract. **No change** to: User Ownership · Consent / Privacy · Safety Authority · Evidence Provenance · Memory / HIM scientific boundaries · Confidence semantics · Conversation Orchestrator authority · Shared / Public audience constraints · Model Router authority · AI-COST-01 · Matching · Hosted Deployment. The coding agent does **not** choose an LLM. **No real user data** may be used in C1 tests. Rule: *QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE* — no broad or repeated test cycles for reassurance when the systems under test are unaffected.

### 0.2 Reconciliation of C0 recommendations with the decisions
| Decision | What changed in this report / the annex |
|---|---|
| D4 | §4.2 class 3 now separates *technically stored* / *currently usable* / *legitimately retainable*; the PG-02 derivative is classified as stored-but-not-usable-as-is, to be re-evaluated (D6), never silently relied on and never auto-falsified |
| D5 | §6 is split into C1-A and C1-B; §8 gives each its own proportional validation; the C1 Task Contract draft names what enters each |
| D6 | §7 replaces the single C2-a slice with the decomposed candidate slices, each its own bounded Task Contract, and states the "evidence loss ≠ falsity" rule |
| D10 | §11.1 records the gap as independent, with Issue #322 and the Release Gates explicitly open |
| P3 / P5 | annex §3.3: the compiler emits **constraints, permissions and declared preferences**, never a tone; the C0 candidates `SERIOUS_REGISTER` and `LIGHT_REGISTER_PERMITTED` are withdrawn; register choice stays with the model's contextual understanding inside the one generation |
| P4 | annex §4: C0's "(a) now, (b) later" is replaced by the approved design of canonical, user-owned Interaction Preferences (§4.2) with the precedence rule "explicit current request > durable preference"; no table, UI or save path is authorized now |
| P6 | annex §0, §3.2, §5: C0's "only when the user initiated lightness" is replaced by QANDEEL's own, bounded humour initiative |
| P8 | annex §6: the twelve measurement items, negative controls, a multi-turn tone-shift case, and the structural constraint of the existing validator (20–30 cases per suite) |
| §1.4 | the four "still undefined" questions are marked resolved against D1, D4 and D7 |

---

## 1. What CI-01 means according to existing sources, and what is still undefined

### 1.1 Where the name comes from
- The task name **"CI-01 — Shared Intelligence Learning Evidence & Baseline"** appears in exactly three places on `main`: `QANDEEL_PRODUCT_ROADMAP.md` §6.3 and §6.4 ("Next after SEC-MATCH-00 closes… It has not started"), and the SEC-MATCH-00 record §15 (`docs/e2e/QANDEEL_SEC_MATCH_00_MATCHING_DIRECT_RPC_PROTECTION_IMPLEMENTATION_RECORD_v1.md:396`).
- **No Task Contract, design record, backlog item, roadmap stage row or canonical document defines its scope.** It is a sequencing name only. Nothing in the repository says what "Shared Intelligence" or "Learning" means for it.
- **Naming collision.** `QAN-BL-CI-01` is the backlog ID of *iOS Simulator Maestro / XCTest Driver Startup Reliability in Mobile CI* (owner `CI-IOS-01`, `docs/qandeel-canonical-backlog-v1.md:928`). CI-01 the task and `QAN-BL-CI-01` the item are unrelated (D2).

### 1.2 What the frozen contracts already decide about learning
The repository contains **no learning runtime and no decision to build one**. It contains strong, repeated boundaries that any learning must respect:

| Frozen statement | Source |
|---|---|
| "Memory is selective, user-scoped, provenance-aware, and bounded." "Cross-user retrieval is prohibited." "Derived insight must not silently become fact." | `docs/implementation-foundation/QANDEEL_FOUNDATION_FREEZE_v1.0.md` (Frozen Engineering Principles; Memory Freeze) |
| "Shared/family memory requires a separate explicit scope and consent model." "No cross-user retrieval." | `docs/implementation-foundation/QANDEEL_MEMORY_RUNTIME_v1.0.md` Scope, Privacy |
| "Session-bound state must not become a global trait inference." "No composite human, wellbeing, or readiness score is authorized." | `docs/foundation-freeze-v1.md` HIM scientific invariants |
| "no global personality/trait inference… no comparison of Brain signals to each other or to an inferred baseline" | `docs/human-intelligence-activation-freeze-v1.md` Privacy, security, and scientific non-inference |
| QIR-001 rule 7: "No extra LLM pass may be introduced merely to interpret, merge, summarize, classify, or reconcile Human Intelligence, Memory, Hypothesis, Recommendation, or Question context." | `docs/integrated-intelligence-runtime-contract-v1.md:316-318` |
| "Knowledge possession is not audience permission." Understanding "is not copied automatically into a Shared World, the Public World or Introductions." `PG-04 — Selective Understanding Sharing` stays an unimplemented gap | P1 closure §11.7 (`docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md:442-457`) |
| Operational telemetry "is always content-free"; no Company path for private user content | APP-OPS-01 `PO-OPS-03` (`docs/p4/APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md:65,180-205`) |
| Telemetry "never contains messages, outputs, prompts, Memory or HIM payloads…" | `docs/correlation-telemetry-foundation-v1.md:9` |
| "Rollout/incident metrics remain operational data. They do not become semantic World truth; candidate truth; Public importance/rank truth; user-visible social scoring." Non-waivable: source isolation, deleted-content non-serving, audience boundaries | CW2-08 §2, §42 |
| `H13.` "Public QANDEEL uses only Public Servable Context." | CW2-08 §43 |
| "No routine or exceptional human review of private QANDEEL conversation content is authorized" (automated Safety processing excepted) | CW2-08A `:23-24` |
| Forbidden implicit transitions include `MY_WORLD → automatic Shared copy`, `PUBLIC_WORLD → automatic MY_WORLD memory import`, `PUBLIC_WORLD → hidden private-context enrichment`; "Context Admission never becomes hidden source copying" | CW2-01 §37 `:747-767`, §41.10-11 |
| HIM measurements are only a `DIRECT_STRUCTURED_USER_REPORT`: "no transcript, Memory, behavior, voice, provider, embedding, or inferred signal is an input" | `docs/hse-energy-measurement-model-v1.md:9` (same in every model doc) |
| "Benchmark with Qandeel-specific Golden Conversation tests, not generic leaderboards alone." Final model selection is "benchmark-driven using Qandeel outcomes" | Foundation Freeze v1.0 Model & Provider Policy; `QANDEEL_MODEL_ROUTER_v1.0.md` Benchmark Requirement |

### 1.3 The only canonical gaps that name learning-adjacent capability
- `PG-02 — Personal Evidence Invalidation → Derived Understanding Propagation` — **NOT IMPLEMENTED** (I-08A4 §18; W3-MEGA-U record §5 `:470-472`). A forgotten or disabled Memory stops counting as Evidence at read time, but hypotheses derived from it keep their statement, status and visibility.
- `PG-04 — Selective Understanding Sharing` — **NOT IMPLEMENTED** (P1 §11.7).
- `QAN-BL-CW-02` — Shared Standing Context: "Personal Memory, Understanding, HIM, hypotheses and conversation never enter a Shared reply" today; owner `SHARED-CTX-01` (backlog `:961-997`).
- `QAN-BL-CTX-01` — Runtime-backed Conversational Relevance; owner `QAN-CTX-01` (backlog `:455-468`).
- `QAN-BL-CW-05` — QANDEEL output cannot ground a Shared semantic place; owner Stage 8A.
- ABS Part 9 "experiment framework, outcome attribution, learning feedback… **open**" (`docs/reasoning-recommendation-integration-v1.md:17-22`); no owner.
- The Project Map §5 "working planning discussion — NOT FROZEN": a "short real-LLM/runtime calibration and cost/evaluation instrumentation step" was discussed and never sequenced.

### 1.4 What is still undefined (and therefore needs the Product Owner)
1. Which of the four readings A–D is the task (§2).
2. Whether "evidence" in the title means *user evidence* (Memory/Evidence layer) or *evaluation evidence* (quality baselines). Today both words are used; the repo's `Evidence` layer is the former.
3. Whether any derived artefact may be retained from a learning step (§5.2 class 3).
4. Whether a quality baseline is allowed to exist before a provider is chosen (D7).

*Resolved 2026-10-10:* 1 → D1 (D now, A the only learning direction); 2 → both readings are in scope — the baseline measures *evaluation evidence* (D), and the only learnable *user evidence* is the user's own (A); 3 → D4 amendment: a retained derivative is at most *technically stored* until its own system's approved rules say it is usable or retainable; 4 → D7: yes, but structural and synthetic only.

---

## 2. Learning / Evidence Architecture Options (A–D)

Nothing below is adopted. Each row records value, authorized source, what exists, gaps, risks and dependencies.

### A — QANDEEL learns from the user's own evidence (Personal, within Memory / HIM limits)
- **User value:** QANDEEL stops forgetting what the user said, honours corrections, and stops relying on withdrawn evidence. This is the "exceptional intelligence" the user feels first.
- **Authorized source:** the user's own `USER_STATED` Memory (0004/0026), their hypotheses and contests (0005/0127/0134), their explicit commands (0128). All owner-scoped under RLS. Already authorized by the Foundation Freeze and P1 §9/§11.
- **What exists:** the full per-user pipeline Memory → Evidence → Hypothesis → Confidence → Question (§3). Correction by supersession, forget, do-not-rely, disagreement → Contested with real re-evaluation.
- **Gaps (verified, §4.4):** regex-only capture misses natural Arabic statements; exact-token recall; a natural reversal leaves the stale preference `ACTIVE`; an explicit correction supersedes only one of two duplicates; third-party facts stored as `PERSONAL_FACT`; `USER_CONFIRMED` / `SYSTEM_DERIVED` / `PENDING_CONFIRMATION` have no writer; hypothesis stays `ACTIVE` after its evidence is `DELETED`/`DISABLED` (PG-02); hypotheses are read cross-session despite the session scope tag; Confidence has no numeric model (DB-forced NULL); no relevance ranking (`QAN-BL-CTX-01`).
- **Risks:** inventing "truth maintenance" semantics beyond what P1/Memory Runtime froze (controlled change); provider-dependent parts (generation, association, intent) are bound to Gemini/OpenAI keys outside the Model Router and are a Stage-8A matter.
- **Dependencies:** none on a provider for the deterministic parts (capture repair, duplicate supersession, PG-02 propagation). Everything model-assisted waits for Stage 8A.

### B — The Shared World benefits from knowledge its members authorized to share
- **User value:** a Shared QANDEEL that remembers what *this World* established, without touching anyone's Personal world.
- **Authorized source:** Shared-native history only (`0139`, S4-02 record §7); Shared semantic places as `QANDEEL_ANALYSIS` materials with `MATERIAL_DEPENDENCY` provenance (`0148`, SHARED-VIS-01). Personal → Shared requires a Standing Context Grant (CW2-02 §16–21, `0076`–`0078`) whose collector, disclosure detector and source-state resolver **do not exist** (`QAN-BL-CW-02`).
- **What exists:** EffectiveContext / audience chain (I-03), fail-closed private lane, provider-neutral `SharedSemanticInterpreter` / `SharedSpatialPlacer` that refuse until bound (§3).
- **Gaps:** any "Shared learning" today is either (i) already the Shared-native history the reply reads, or (ii) `QAN-BL-CW-02`, owned elsewhere. There is no Shared-World memory store and no record deciding one should exist.
- **Risks:** HIGH. The backlog says `QAN-BL-CW-02` "decides whether a participant's private Personal context can influence what QANDEEL says to other people"; former-member rights, deletion (`QAN-BL-ACCT-01`, `ON DELETE RESTRICT` chains) and "deleted-content non-serving" are non-waivable (CW2-08 §2).
- **Dependencies:** `SHARED-CTX-01`, Stage 8A binding, `QAN-BL-ACCT-01`. **Recommendation: CI-01 does not open B** (D8).

### C — General quality improvement from aggregated, authorized evaluation evidence
- **User value:** QANDEEL's replies get better for everyone over time.
- **Authorized source:** **none exists.** No consent record, no Product decision and no data class authorizes aggregating user conversations, Memory or Understanding for quality work. Only the AI-COST-01 ledger (0135) is cross-account, and it is content-free by construction ("Nothing here stores prompt, response, transcript, Memory, Hypothesis or any user text", `0135:33-35`). APP-OPS-01 PO-OPS-03 forbids content in telemetry.
- **What exists:** the brain bake-off harness (`apps/api/src/brain-eval/`, 24 **synthetic** conversations, blinded human rubric, "No real bake-off was run"); deterministic behavioural policy tests; the ledger.
- **Gaps:** no Golden Conversation suite despite the Foundation Freeze naming it as the benchmark; no quality metric; no persisted evaluation result.
- **Risks:** this is the direction the Product Owner's limits §3 exclude unless explicit consent exists. Training or fine-tuning on private conversations is **not** authorized by any record, and CW2-08A forbids even human review of private conversation content. Any aggregate quality work would therefore have to start from synthetic fixtures or from a new, explicit consent class that does not exist.
- **Dependencies:** Stage 8A (provider), Stage 9 (economy), a consent/ToS Product record that does not exist. **Recommendation: closed for CI-01** (D9). Synthetic-only evaluation remains allowed.

### D — Evidence & Evaluation Baseline only (no learning runtime in this task)
- **User value:** indirect; it makes every later intelligence task honest about what QANDEEL can do, and gives Stage 8A a measured starting point.
- **Authorized source:** repository truth and synthetic fixtures. No user data.
- **What exists:** this report's census (§3, §4), the prior synthetic harness (§4.4), the 95 static contract gates in `tests/`, the Foundation/QHIA/QIR verification tails.
- **Gaps:** the census is not yet a canonical record with a pinning test; the harness recipe lives in a session scratchpad, not the repo.
- **Risks:** low. The only risk is over-claiming a "readiness number" (D7).
- **Dependencies:** none. **Recommendation: D is CI-01's C1** (D1, D5).

---

## 3. Existing Intelligence Capability Matrix and Anti-duplication Findings

Legend: **ACTIVE** = implemented and runs on `main` without a provider; **PROVIDER-GATED** = implemented, needs a key or the Stage-8A binding; **DECIDED-NOT-IMPL** = frozen vocabulary/contract with no producer; **DEFERRED** = explicitly deferred, owner shown.

### 3.1 Capability matrix

| Capability | What it really is today | State | Evidence |
|---|---|---|---|
| Memory store | `public.memories`: 8 types, 5 sources, 6 statuses, extraction `confidence`, `importance`, version, `supersedes_memory_id`; **no subject/person, no session/turn, no world column**; rows physically immutable except `status`/`updated_at` | ACTIVE | `0004:3-45`; `0026`; `0072:1413`; `0130:505-535` |
| Memory capture | **Deterministic regex evaluator, no model**: ~8 first-person patterns (EN/AR), one candidate per turn, always `USER_STATED/ACTIVE`, confidence 0.95/0.98 = extraction clarity | ACTIVE (background, needs Redis consumer) | `apps/api/src/memory/memory-write-evaluator.service.ts:35-38,113-151`; dispatcher `:60` |
| Memory sources `USER_CONFIRMED`, `SYSTEM_DERIVED`, `PENDING_CONFIRMATION`, type `DERIVED_INSIGHT` | vocabulary only; **no writer** | DECIDED-NOT-IMPL | evaluator doc `:25`; `0004:40-42` |
| Memory retrieval | lexical, deterministic: 32 candidates → 4 selected, 2,400 chars; score `relevance*100+importance*5+confidence*2`; no vector/pgvector, no "prior successful use" | ACTIVE | `memory-retriever.service.ts:6-8,50`; retrieval doc `:26` |
| Conversational Memory control | inspect / remember / correct (supersede) / forget (`DELETED`, content kept) / do-not-rely (`DISABLED`); immutable `memory_control_commands`; one transaction with the reply | ACTIVE (E2E-D-13) | `0128`; `memory-control.service.ts:94-200` |
| Evidence layer | **a projection, not a table**: newest 64 `ACTIVE` unexpired `USER_STATED/USER_CONFIRMED` non-derived memories, exact dedup, id `memory:<uuid>`; SQL mirror `canonical_eligible_memory_ids_v1` | ACTIVE | `evidence.service.ts:6-7,71-77`; `0028:89-113` |
| Evidence history | `historical_evidence_participation_events` (ATTACHED/DETACHED, world version), immutable | ACTIVE | `0072:330-352` |
| Hypothesis store & lifecycle | free-text LLM statements, 9 types, 6 domains, scope `CONVERSATION_SESSION:<id>`, 8-state graph; only auto transition CANDIDATE→ACTIVE; `transition_hypothesis_v2` is **GRANTed to authenticated** (owner JWT can move status directly) | ACTIVE | `0005`; `0036:196-212`; `hypothesis-lifecycle.ts` |
| Auto SUPPORTED/WEAK/REJECTED/RETIRED, evidence weights, thresholds | "capability only" until calibrated Confidence exists | DEFERRED (no owner) | lifecycle doc §8–9 `:312-346`; update-loop doc `:29` |
| Hypothesis generation / intent / association | **bound to Gemini 2.5 flash / flash-lite and OpenAI gpt-5-mini outside the Model Router**; fail closed without keys; no fallback; post-response budget of 3 | PROVIDER-GATED | `hypothesis-*-provider.config.ts`; `post-response-provider-budget.ts:18-22` |
| Trigger classification | deterministic regex: `PREFERENCE_OR_GOAL → NO_TRIGGER`; fires only on why-self, recurring, contradiction, relational, unclear-outcome; some Arabic patterns use ASCII `\b` | ACTIVE | `hypothesis-generation-trigger-classification.service.ts:14-59` |
| Confidence | structural, insert-only per exact version; `numeric_score`, `confidence_band` **DB-forced NULL**, `UNCALIBRATED`, `UNASSESSED`; N1 NOT EXPOSED | ACTIVE (calibration DEFERRED) | `0006:29-31`; `confidence.service.ts:109-132`; `docs/confidence-runtime-v1.md:7,33` |
| Information Gap / Question | gaps materialized from 3 Confidence codes; oldest OPEN gap per session, fixed objective, model only phrases; closure only via Confidence state, **never answer detection**; utility/EIG NULL (N2 NOT EXPOSED) | ACTIVE | `0038`; `0063:12-16,285-331`; `0007:36` |
| Understanding surface | owner-only projection of hypotheses (ACTIVE/SUPPORTED/MIXED/WEAK) with eligible Memory as evidence/contradictions; qualitative 4-state confidence derived from structure; CLEAR requires `SUPPORTED` (unreachable by app code) | ACTIVE (E2E-D-14/15) | `understanding-projection.ts:31-62`; W3-MEGA-U record §2.3 |
| Disagreement → Contested | explicit, exact-version, immutable `understanding_contests`; moves item to MIXED, real re-evaluation; resolved only by the user's confirmation or withdrawal; provider sees `userContest:'UNDER_REVIEW'` | ACTIVE (PG-01 closed) | `0127`; `0134:46-64,93-112`; `hypothesis-user-signal.repository.ts:40-53` |
| PG-02 propagation | forgotten/disabled Memory stops counting at read time; **hypothesis text/status untouched**; no re-evaluation triggered | NOT IMPLEMENTED | W3-MEGA-U §5 `:470-472`; §4.4 scenario F1 |
| HIM | 17 ordinal metrics produced **only by a direct structured self-report scored deterministically** (nothing inferred from conversation), each bound to an exact owned context; `CALIBRATED` = governance approval of a deterministic v1 model, **not** statistical ("Calibration rows, test success, evidence count, or authorship never cause promotion"); confidence/freshness `UNASSESSED`; **no API or mobile caller writes a measurement** (only verifier scripts); `him_calibration_evaluations` never written by the app | ACTIVE infrastructure, organically EMPTY | `initial-him-metrics.catalog.ts:30-48`; `hse-energy-measurement-model-v1.md:9,23,39`; `him-metric-calculation-calibration-runtime-v1.md:11,25`; §4.4 scenario H1 |
| HIM Brain Context bridge | 8 frozen slots materialized post-response, zero foreground wait, no trend/average | ACTIVE | QHIA-012, `0061` |
| HIM trends | infrastructure exists, `HimTrendService` not registered; no provider consumption | DECIDED-NOT-IMPL | QHIA freeze "Non-blocking observations" |
| HIM calibration evaluations | `comparisonStatus: RECORDED_NOT_EVALUATED`, bias `UNASSESSED`; "No thresholds, statistics, sample-size rules" | DEFERRED | `him-calculation.types.ts:37-41`; `him-metric-calculation-calibration-runtime-v1.md:25` |
| Model Router (conversational) | Claude + OpenAI adapters, FAST/DEEP deterministic routing (no LLM classifier), `MODEL_PROVIDER` empty, throws on first generate; no fallback/ranking despite the spec | PROVIDER-GATED (Stage 8A) | `model-router.module.ts:18-56`; `.env.example:23` |
| Structured ports | `PublicSemanticInterpreter`, `PublicSpatialPlacer`, `SharedSemanticInterpreter`, `SharedSpatialPlacer` "refuse. Never a fallback" | PROVIDER-GATED (Stage 8A) | `public-world/public-semantic-interpreter.ts:173`; `shared-world/shared-semantic-interpreter.ts:143` |
| Shared QANDEEL reply context | Shared-native history only through EffectiveContext; private lane fail-closed and unused; "Personal Memory, Understanding, HIM, hypotheses and conversation never enter a Shared reply" | ACTIVE (bounded) | S4-02 record §7.1; backlog `QAN-BL-CW-02` |
| Public QANDEEL reply context | served version, reviewed meaning, package items, last 40 posts, last 20 responses, related meanings; "no author… Personal / Shared / memory / human-model / hypothesis…" | ACTIVE behind fail-closed entitlement seam | S5-04 record §8 `:140-152` |
| Public semantic review | publisher accepts or corrects QANDEEL's proposed meaning before publication; persisted as `semantic_reviews.decision IN (ACCEPTED, CORRECTED)` per version (no REJECTED state); **no code reads it as a feedback or quality signal**; lineage-based F05 erasure covers it | ACTIVE (interpreter PROVIDER-GATED) | `0144:308-319`; S5-03A record §13; `0143` |
| AI usage / cost ledger | per call: account, session, turn, provider, model, one of 8 feature families (CONVERSATION_REPLY, CU_SEGMENTATION, FOCUS_RESOLUTION, THREAD_FORMATION, THREAD_CONTINUITY, HYPOTHESIS_INTENT_EXTRACTION / EVIDENCE_ASSOCIATION / CANDIDATE_GENERATION), FAST/DEEP path, token kinds; **no prompt/response/transcript, no latency, no quality field**; no Price Card registered (every call UNPRICED); Credit Policy DRAFT-only | ACTIVE | `0135:1-35,77-117,221-240,624` |
| Brain bake-off harness | 24 synthetic conversations, blinded 1–5 rubric, paid run gated; **never run**; results would be local only | IMPLEMENTED, NOT RUN | `docs/brain-bakeoff-harness.md`; `apps/api/src/brain-eval/` |
| Telemetry / outbox | closed label registries; anything else dropped; outbox `contains_content=false`, carries ids only | ACTIVE | `telemetry.service.ts:11-99` (main); `0019:3-34` |
| Export My Data | memory in every state (labelled forgotten/not relied on/replaced), Understanding items + disagreements; excludes scores, evidence refs, HIM, command records | ACTIVE (`QAN-BL-PRIV-01/02` open) | `0130:545-616` |
| Personal erasure | physical delete of memory, hypotheses, confidence, contests, HIM through 16 guards; `BLOCKED` by Connected Worlds (`QAN-BL-ACCT-01`) | ACTIVE for Personal | `0130:913-1090` |
| Any cross-user, aggregate, training, fine-tuning, reward or outcome-feedback mechanism | **none**; every "cross-user" hit is a prohibition | ABSENT | sweep of `apps/api/src` and `docs` |

### 3.2 Anti-duplication findings
1. **Do not build a learning runtime beside the existing per-user pipeline.** Memory → Evidence → Hypothesis → Confidence → Question → Understanding is complete as a bounded, fail-closed per-user system (QIR-008 closed). Every "learning" improvement in direction A is a *change inside* an existing engine, under its change-control rule, not a new engine.
2. **Do not build a second evaluation harness.** `apps/api/src/brain-eval/` already defines suite, blinded review, summary and pricing files. A Golden Conversation baseline should extend that suite, not create another.
3. **Do not build a Shared-World memory.** The Shared reply already reads Shared-native history; Personal → Shared is `QAN-BL-CW-02` / `SHARED-CTX-01`; semantic places are `0148`.
4. **Do not add a feedback widget** (thumbs, ratings). The only reply-level user signals that exist and are Product-approved are the Understanding contest (0127/0134), the Memory commands (0128) and the Public meaning correction (0144). A rating control has no Product decision and would collide with the "no user-visible social scoring" law (CW2-08 §42) and the anti-lecture behavioural freeze.
5. **Do not add a confidence number.** N1/N2 are frozen NOT EXPOSED; the Understanding projection is explicitly built to "not invent the calibration it lacks" (`understanding-projection.ts:13-14`).
6. **Do not reopen provider binding.** Candidate generation, association and intent are already bound to concrete Gemini/OpenAI models outside the Model Router; the conversational provider and the four structured ports are Stage 8A. CI-01 must not select or rebind any of them.
7. **The 2026-10-09 S6-01 Intelligence Reality Check already measured capability A's defects** on a synthetic harness (§4.4). CI-01 should reuse its recipe and findings rather than re-derive them.

---

## 4. Intelligence Evidence Baseline (design only)

### 4.1 The matrix (design, not implementation)

Columns requested by the Product Owner: Source · Ownership / authorized audience · Quality & provenance · Freshness / version · Contradiction / correction · Consent / revocation · Deletion consequence · Existing runtime consumer · Missing capability · Verification method.

| Source of evidence | Ownership / audience | Quality & provenance | Freshness / version | Contradiction / correction | Consent / revocation | Deletion consequence | Existing consumer | Missing capability | Verification method (today) |
|---|---|---|---|---|---|---|---|---|---|
| **Memory row** (`USER_STATED`) | owner only (RLS); never Shared/Public | `source`, extraction `confidence`, `importance`; turn only via effect ledger / command row | `version`, `updated_at`, `expires_at`; supersession chain | supersede (CORRECT), `DISABLED`, `DELETED`; natural reversal **not** detected | implicit in use of Personal QANDEEL; FORGET = status only | content retained until account erasure; export labels it "forgotten" | retriever (4 items), Evidence, Understanding detail, export | subject marker; `USER_CONFIRMED` writer; duplicate supersession; semantic recall | `verify-migration-0004/0026/0128`; synthetic harness scenarios N1/K1/C1/F1 |
| **Evidence item** (projection) | owner only | mechanical kind by type; confidence ≠ truth | recomputed per read; newest-64 window | separate items, no adjudication | none beyond Memory | disappears at read time when Memory leaves `ACTIVE` | hypothesis attach/update, Confidence, Understanding | nothing older than window; no weight | `0028` verifier; evidence-layer contract |
| **Hypothesis** (`SYSTEM_GENERATED`) | owner only; provider sees ≤8 | LLM free text; assumptions ≤8; supporting/contradicting ids; audit of transitions | exact version per change; session scope tag (read cross-session) | user disagreement → MIXED/UNDER_REVIEW; **no propagation from Memory invalidation (PG-02)** | none; `transition_hypothesis_v2` reachable by owner JWT | erased with account; survives Memory forget | reasoning context, Understanding, Question | PG-02; weighting; cross-session consolidation; language rewrite | `0036`, `0127`, `0134` verifiers; harness F1 |
| **Confidence evaluation** | owner only | structural codes; NULL score by CHECK | insert-only per exact version | re-evaluated on contest | — | erased with account | Understanding state, gap materialization | numeric/calibrated model (deferred) | `0006`, `0035` verifiers |
| **Understanding contest** | owner only | explicit act, exact version, command id | immutable; resolution facts | user confirm / withdrawal only | revocable by the user's own resolution | erased with account; agreement fact missing from export (`QAN-BL-PRIV-01`) | provider `userContest`, Understanding | export completeness (owned) | `0127`, `0134` verifiers |
| **HIM measurement** | owner only; exact context | deterministic v1 model; `UNASSESSED` confidence/freshness | observation time; no trend consumed | none (no re-measure path) | — | erased with account | foreground 300 ms lanes, Brain Context | capture surface; scientific calibration | 17 model verifiers; `him-structured-measurement-preflight` |
| **Information Gap / Question** | owner, same session | fixed server text; code-derived | OPEN/RESOLVED/SUPERSEDED, epochs | closure only via Confidence | — | erased with account | one phrased question per turn | utility, answer detection (deferred) | `0063` verifier |
| **Shared-native history** | current members by EffectiveContext; former-member entitlements | author = `auth.uid()`; audience derived | World version | owner deletion narrows serving | membership; Standing Context grant exists in DB, unused | owner deletion honoured; account deletion `BLOCKED` (`QAN-BL-ACCT-01`) | Shared reply, semantic places (0148) | Personal → Shared path (`QAN-BL-CW-02`) | `0139`, `0148` verifiers; S4-02 contract |
| **Public reviewed meaning** | public audience only (fail-closed seam) | publisher accept/correct per version; lineage provenance | version-bound | publisher correction | publication = consent; withdrawal | F05 lineage-based erasure | Public QANDEEL context, field placement | provider binding (8A) | `0143`–`0147` verifiers |
| **AI cost ledger** | Company, content-free | provider-reported tokens; Price Cards | per call start | re-rating = new version | — | cascades with account | ops summary | nothing for learning (by design) | `ai-cost-01` contract |
| **Synthetic harness run** | repository / engineering | deterministic doubles, fixtures | pinned to a `main` SHA | re-run | — | n/a | none yet | a repo-resident recipe + pinning test | this is the proposed C1 |

### 4.2 Three classes of evidence (proposed vocabulary, D4)
1. **Readable** — may be read to answer the current turn under existing authority (Memory retrieval, HIM lanes, Shared/Public context). Everything in §4.1 that has an "existing consumer".
2. **Learnable** — may change a durable *per-user* derived state (hypothesis status, Confidence, Memory supersession). Today: only the user's own explicit acts and the post-response pipeline on the user's own turns. **No cross-user source is learnable.**
3. **Retainable** — a derived result may legitimately be kept after its source is gone.

**D4 amendment (binding).** Inside "retained" three states are kept apart and never collapsed:
- **(a) technically stored** — the row still exists in the database;
- **(b) currently usable** — existing authority permits reading or relying on it now;
- **(c) legitimately retainable** — Product and law permit keeping it after the source has gone.

Presence in the database after the evidence was deleted is state (a) only; it is **not** a permission for (b) or (c). Today: a hypothesis that outlives a forgotten or disabled Memory is (a) **without** (b) — the PG-02 defect, whose correct handling is **re-evaluation according to its state and the remaining evidence**, not automatic falsification and not silent reliance (D6); Memory content in `DELETED` status is (a) by the frozen 0128 design ("content kept, status only") and is excluded from (b) at read time; a Public reviewed meaning after F05 lineage erasure is (c) by a frozen Product decision (S5-02 / S5-03A). Each system's own approved deletion and history behaviour governs; CI-01 invents **no unified deletion rule**.

### 4.3 What a baseline can honestly measure before Stage 8A
Only **structural** yields on **synthetic Arabic/English fixtures** through the real orchestrator with deterministic provider doubles:
- capture yield (statements that become Memory / total value statements);
- recall (asked-back facts found in retrieval);
- truth maintenance (stale after natural reversal; duplicate after correction; hypothesis after forget);
- authority (zero cross-user leakage; zero content in telemetry);
- cost accounting (one ledger row per provider call, no content).

No conversational-quality score, naturalness, "next-turn value" or calibration figure is producible without a bound provider, and none should be published.

### 4.4 Proof of what QANDEEL can do today (prior-session synthetic evidence)
**Provenance.** On 2026-10-09 a read-only Intelligence Reality Check ran the real `ConversationOrchestrator` and post-response dispatcher against a disposable local PostgreSQL 17 built from `main` `5973123` (migrations 0001–0148), with doubles for the Model Router, the three hypothesis providers and Redis, on **synthetic accounts only**. Artefacts are in that session's scratchpad (`rc/results.json`, 12 synthetic users, 9 scenarios) and are **not** repository authority. Migrations `0149`/`0150` touch Matching privileges and stale-state SQLSTATEs only, so the findings hold on `6a5fa42`; the code citations in §3.1 were re-checked on this baseline today.

| Scenario | Observed (synthetic) | Implication |
|---|---|---|
| N1 — natural self-description (name, age, job, values) | 0 of 4 value statements stored; only «انا ساكنة في مدينة نصر» stored, rewritten to the masculine «أنا ساكن» | capture yield is pattern-bound; gender form altered |
| K1 — explicit preferences/goals/decisions | 3 of 6 stored (anchored «أنا بحب», «هدفي», «قررت»); «الدين… أساسية» and «نفسي أعيش قريب من أهلي» not stored; asking back about «التدخين» returned 0 memories | recall is exact-token |
| C1 — natural reversal then explicit restatement | reversal left the old preference `ACTIVE`; explicit restatement superseded v1 but a second `ACTIVE` duplicate remained | truth maintenance gap |
| P1 — third-party statements | «أختي مش بتحب الأطفال» stored as `PERSONAL_FACT` via the explicit-remember path | no subject marker |
| F1 — forget / do-not-rely | Memory moved to `DELETED` / `DISABLED`; linked hypotheses stayed `ACTIVE` and were injected in a new session | PG-02 confirmed |
| H1 — stressed-day statement | HIM `coverageState: EMPTY`, 0 known metrics; a seeded value changed behavioural instructions only within its session | HIM is organically empty |
| M1 / X1 — «ليه أنا دايما…», «عايز… بس خايف» | «ليه أنا» trigger dead (ASCII `\b`); contradiction trigger fires; «بس» inside «بسهر» also fires | trigger precision issues |
| Controls | other user sees 0 memories via RLS; 0 retrieved cross-user; 46 conversational router calls, 0 external HTTP | isolation and provider boundary hold |

---

## 5. Privacy and Consent Decision Matrix

### 5.1 The eight mandatory limits, mapped to existing authority and to a CI-01 obligation

| Limit (Product Owner) | Existing authority | Enforced today by | CI-01 obligation |
|---|---|---|---|
| No Personal memory transfer between users by default | Foundation Freeze (cross-user prohibited); P1 §11.7; CW2-01 "knowledge possession is not audience permission" | RLS owner policies; `QAN-BL-CW-02` fail-closed lane; S5-04 Public-only assembler | state it once in the C1 record; add a static test that no new reader of `memories`/`hypotheses` lacks an owner filter |
| No training / fine-tuning on private conversations without explicit approved consent | **no record permits it; no record forbids it by name** | absence of any pipeline; content-free telemetry/ledger | D3: name it explicitly |
| No Shared World content outside its authorized audience | I-03 EffectiveContext; CW2-08 non-waivable audience boundaries | `0139`/`0148` verifiers | none new |
| No new personality traits or HIM scores without an approved model | QHIA freeze change-control rule; "No uncalibrated metric may be silently estimated or promoted" | 17-model verifiers, preflight | none new |
| No invented Confidence / baselines / improvement indicators from insufficient data | `0006` CHECKs; N1/N2 NOT EXPOSED; QHIA "no comparison… to an inferred baseline" | DB constraints; projection | D7: baseline publishes structural yields only, labelled synthetic |
| No change to user authority over data, deletion, consent withdrawal | W3-PDG-01; `0128`; `0130`; `0134` | implemented commands | none new; PG-02 work must *strengthen* forget |
| No conversation or Memory content in telemetry | APP-OPS-01 PO-OPS-03; correlation telemetry doc | closed label registries; outbox `contains_content=false` | none new |
| No bypass of Safety, Consent, Provenance, Ownership | Safety BLOCK short-circuit; CW2-08 H1–H27 | orchestrator order; seams `NOT_EVALUATED` | none new |

### 5.2 Decision matrix by evidence class and direction

| Evidence | Read (A) | Learn per-user (A) | Read in Shared (B) | Learn aggregate (C) |
|---|---|---|---|---|
| `USER_STATED` Memory | allowed | allowed (supersede/forget/disable exist) | **no** without `QAN-BL-CW-02` grant + collector | **no** (no consent record) |
| Hypothesis / Confidence | allowed (≤8) | allowed via contest; PG-02 fix allowed | no | no |
| HIM measurement | allowed in frozen lanes | only through approved models | no | no |
| Shared-native history | n/a | n/a | allowed to members | no |
| Public reviewed meaning | n/a | n/a | n/a | public already; aggregation still unconsented |
| Conversation transcript | read for the turn only | **not** a learning source (not every message becomes memory) | no | **no** |
| Cost ledger | content-free | n/a | n/a | allowed (already aggregate, content-free) |
| Synthetic fixtures | yes | yes | yes | yes |

---

## 6. Recommended narrow v1 scope

**CI-01 v1 = Direction D, written so that Direction A is the only learning path later tasks may design against** (D1, APPROVED).

**D5 split — organisational, not an implementation authorization.** Neither sub-slice changes production runtime behaviour, runs anything outside the local machine, or touches user data. The [C1 Task Contract draft](QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) states exactly what enters each and recommends the delivery form.

**C1-A — Canonical Evidence Baseline** (documentation + static checks):
1. A canonical record `QANDEEL — Intelligence Evidence Baseline v1` holding §3.1 and §4.1 as the census of record, each row cited, with a static contract test that fails when a cited capability's state changes without the record (same pattern as `tests/*-contract.test.mjs`; file reads only, no database).
2. The eight limits of §5.1 as one named rule set (D3), and the three evidence classes of §4.2 **with the D4 three-state distinction** (stored / usable / retainable).
3. The gap register for A, each gap with its **current** owner, unchanged: PG-02 (no backlog item; named in I-08A4 §18 and W3-MEGA-U §5 — admission is a Product Owner decision, see the contract), capture/recall repairs (Memory Runtime change control), `QAN-BL-CTX-01`, `QAN-BL-CW-02`, `QAN-BL-CW-05`, `QAN-BL-PRIV-01/02`. **CI-01 transfers no ownership implicitly.**
4. The Conversational Personality v1 design, the three-source separation and precedence rule, the Interaction Preferences design and the Golden Conversation suite design of the annex, as a design record with every conversational text marked OPEN COPY (P1, P9).

**C1-B — Synthetic Intelligence Reality Baseline:**
5. A repository-resident, provider-free **synthetic intelligence-reality recipe** (fixtures + driver + local PostgreSQL bootstrap; deterministic doubles for the Model Router, the hypothesis providers and Redis; zero external HTTP asserted) that reproduces §4.4 and reports **only** the structural yields of §4.3 (D7). Synthetic accounts only. Results are evidence files pinned to a `main` SHA, never a score in a Product surface.

Out of scope (closed by this report unless the Product Owner reopens): B, C, any provider selection or binding, any new memory source type writer, any Shared store, any feedback UI, any confidence number, any hosted or CI run.

---

## 7. Proposed implementation slices

| Slice | Content | Gate | Pre-8A? |
|---|---|---|---|
| **C1 = C1-A + C1-B** (D5) | items 1–5 of §6; no runtime change; no migration; no provider | the Product Owner approves the **C1 Task Contract** (D1, D3–D5, D7 approved 2026-10-10; the contract itself is still a draft) | yes |
| **C2-a — Personal Understanding Acquisition** (D6: APPROVED as a direction, **decomposed**; each slice its own bounded Task Contract, only after C1 is accepted) | candidate slices, in the proposed order: **(1) Personal Evidence Truth Maintenance / PG-02** — when supporting evidence leaves `ACTIVE`, the hypothesis is **re-evaluated** through the existing Confidence / transition cores according to its state and the remaining evidence; evidence loss never means "false", no Confidence value is invented, no new truth is created; **(2) Memory correction & duplicates** — CORRECT supersedes every exact duplicate, natural-reversal handling, under Memory Runtime change control; **(3) Arabic acquisition** — capture repairs that preserve the user's meaning and wording (feminine form kept, Unicode-aware boundaries); **(4) user-vs-others confusion** — third-party statements (subject marker or explicit-remember screen; **Product decision required**); **(5) relevance retrieval review** under existing authorities, without duplicating `QAN-BL-CTX-01`. One forward migration at most per slice, only where that slice proves the need | C1 accepted; a controlled-change note for Memory Runtime / Hypothesis lifecycle per slice; **any frozen-semantics change = Controlled Change + separate decision**; no provider | yes |
| **C2-b — Golden Conversation suite extension** (P8: extends `brain-eval`, never a parallel harness) | synthetic cases and the added rubric items of the annex §6; **structural `validate` / `dry-run` only before Stage 8A**; the paid blinded run and model comparison are Stage 8A | D7, P8 | validate only |
| **C2-c — Interaction Preferences** and **C2-d — Adaptive Conversational Expression** (P3–P6) | separate slices owned by the annex design; ordering proposal in the C1 contract §12 | separate Task Contracts after C1 | design yes; proof 8A |

Not proposed: any Shared learning slice (D8), any aggregate slice (D9).

---

## 8. Focused validation strategy

Rule: *QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE.*

- **C0 (this report):** documentation only. Validation = the repository's own gates that read `docs/`: `npm run test:task-closure-governance-contract` and `npm run test:forward-safety-contract` (run locally; results in §10). No CI, no database, no provider.
- **C1-A:** the new static contract test; `test:task-closure-governance-contract` (its census includes every top-level `docs/*.md`, which the new record joins) and `test:forward-safety-contract` (its census includes every `tests/*.test.mjs`, which the new contract test joins); `git diff --check`; credential scan. No database, no provider.
- **C1-B:** the synthetic recipe run once on a disposable local PostgreSQL 17 with deterministic doubles (zero external HTTP, asserted by a fetch guard as in the prior run); synthetic accounts only; results committed as evidence files. No hosted connection, no Redis requirement, no provider key.
- **Rule (Product Owner):** a gate runs only when a file in its census changed; no broad or repeated cycles for reassurance.
- **C2-a:** real-PostgreSQL verifier for the one migration (if any) via the focused-verification runner; Jest for touched services; the synthetic recipe re-run showing the defect rows of §4.4 flipped; Understanding and Memory-control contract tests green; one exact-head API CI cycle only when the Product Owner authorizes the PR.

---

## 9. Dependencies and staging

| Question | Answer | Evidence |
|---|---|---|
| What can run before Stage 8A / LLM choice? | all of C1; all of C2-a (deterministic); C2-b `validate`/`dry-run` | §3.1 states; `brain-bakeoff-harness.md` |
| What needs a real provider? | any quality score; hypothesis generation/association/intent in a live run; Public/Shared interpreters; Golden Conversation paid run | Model Router unbound (`model-router.module.ts:18-56`); refusing ports |
| Is there a real dependency between CI-01 and S6-01 Matching? | **No forward dependency.** S6-01 would *consume* the same per-user understanding; its Reality Check already showed that understanding is thin. CI-01 C2-a would improve S6-01's inputs but S6-01 stays paused on its own gates (`QAN-BL-MATCH-01`, `QAN-BL-ACCT-01`, PO decisions D1–D6) | S6-01 brief; backlog `:1140` |
| What must stay independent of Matching? | everything in CI-01: no Matching grant, no 0108–0122 read, no onboarding context | CW2-06 §7 purpose law |
| Dependency on Hosted Deployment or a Launch Gate? | none for C1/C2-a. `QAN-BL-PROD-06` (`HOSTED-DEPLOY-01`) gates any *hosted* run, not this analysis. CW2-08 seams stay `NOT_EVALUATED` | roadmap §6.4 |

---

## 10. Validation performed for C0

See §10.1 after the gates were run (filled in the same change).

### 10.1 Results

| Check | Result |
|---|---|
| `npm run test:task-closure-governance-contract` | **24 / 24 PASS** (local, 2026-10-10) |
| `npm run test:forward-safety-contract` | **35 / 35 PASS** (local, 2026-10-10) |
| `git diff --check` | clean |
| Database, API, mobile, migrations, provider, hosted project, GitHub CI | **not touched, not run** (C0 scope) |
| Prior-session synthetic harness | **not re-run**; its 2026-10-09 results are cited as evidence with their baseline stated (§4.4) |

### 10.2 Validation performed for the decision update (2026-10-10, same day)
Documentation change only, in `docs/e2e/` (outside every gate's census: the governance gate scans top-level `docs/*.md` and the backlog; forward-safety scans `tests/`). Results are recorded exactly as run:

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm run test:task-closure-governance-contract` (run once as the AGENTS.md §10.7 gate, although no governed file changed) | **24 / 24 PASS** (local, 2026-10-10, after the decision update) |
| `test:forward-safety-contract`, Jest, database verifiers, brain-eval, mobile, GitHub CI, hosted project | **not run** — no file in their census changed |

---

## 11. Documentary notes (no action in CI-01)

1. **Stale SHARED-VIS-01 banners.** PR #321 merged as `5973123` ("Merge PR #321: SHARED-VIS-01 Living Analysis Shared World") but its closing change never landed: `QANDEEL_PROJECT_MAP.md` §5.1 still reads "CURRENT IMPLEMENTATION TASK: SHARED-VIS-01 … NOT MERGED, NOT CLOSED"; `QANDEEL_CURRENT_STATE.md:140,167` still says ACTIVE / NOT MERGED; the record banner is `ACTIVE — … NOT MERGED; NOT CLOSED`; `QAN-BL-CW-03` is still `DEFERRED — OWNED`. Repair is a governance-reconciliation task under AGENTS.md §10.6 / BG-09, not part of CI-01. Issue #322 (physical-device stress proof) stays an open pre-launch blocker and is not in the backlog. **D10 (ACKNOWLEDGED, 2026-10-10):** an independent documentation gap needing Governance Reconciliation; not repaired in CI-01; Issue #322 and every Release Gate remain open.
2. **Two stale docs** predate the association wiring: `docs/fresh-evidence-hypothesis-association-authority-foundation-v1.md:15` ("no production adapter") and `docs/hypothesis-evidence-association-provider-binding-v1.md:19` ("no dispatcher integration"). The dispatcher does run the Gemini-bound association today.
3. **Name collision** `CI-01` vs `QAN-BL-CI-01` (D2).
4. **Doc divergence on leaving a Shared World.** Migration `0083` and `database/README.md:878-892` keep a Standing Context Grant alive after the grantor leaves ("Membership loss and grant revocation are separate canonical truths"); the Shared World Product Definition (`product-vision/QANDEEL_SHARED_WORLD_PRODUCT_DEFINITION_v1.md:391`) says the permission stops on exit. The database is the implemented authority; the divergence matters only if `SHARED-CTX-01` ever admits a private candidate. Recorded for that task, not for CI-01.

---

## 12. Readiness estimate (capability-based, not a single number)

Readiness is stated per capability with its evidence; the aggregate is a reading of the table, not a computed score.

| Capability needed for "QANDEEL learns from the user's own evidence" | State | Evidence |
|---|---|---|
| User-scoped storage, isolation, provenance, lifecycle vocabulary | COMPLETE | §3.1 rows 1, 5, 6; isolation controls §4.4 |
| User correction / forget / disagreement channels | COMPLETE for Memory and Understanding | 0128, 0127, 0134 |
| Capture of natural Arabic self-statements | PARTIAL — pattern-bound, ~3/10 in the synthetic set | §4.4 N1, K1 |
| Recall of what was captured | PARTIAL — exact-token | §4.4 K1 |
| Truth maintenance (reversal, duplicates, PG-02) | DEFECTIVE | §4.4 C1, F1 |
| Confidence as a calibrated signal | ABSENT by design (deferred) | 0006 CHECKs |
| HIM as an organically populated signal | ABSENT (no capture surface) | §4.4 H1 |
| Model-assisted understanding (generation, association) | PRESENT but provider-gated outside the Router; Stage 8A | §3.1 |
| Quality baseline / Golden Conversations | ABSENT (harness exists, never run) | `brain-bakeoff-harness.md` |
| Shared / aggregate learning | ABSENT and not authorized | §2 B, C |

Reading: the **foundation** (storage, authority, correction, privacy) is complete and proven; the **acquisition** layer (capture, recall, truth maintenance) is partial-to-defective on the deterministic path; the **model-assisted** and **evaluation** layers wait for Stage 8A. Roughly: foundation 3/3 complete, acquisition 1/3, model/evaluation 0/3 — stated as counts of capabilities with cited evidence, not as a percentage of "intelligence".

**C0 Decision Gate: PASSED — D1–D10 and P1–P9 APPROVED WITH CONTROLLED AMENDMENTS (Product Owner, 2026-10-10). The [C1 Task Contract](QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) was approved with mandatory amendments the same day; C1-A (the two canonical records, the static contract, the `QAN-BL-INTEL-01` admission) is delivered locally and waits at the C1-A Review Gate; C1-B is NOT AUTHORIZED until the Product Owner approves it explicitly.**
