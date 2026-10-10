# QANDEEL — Intelligence Evidence Baseline v1

**Status:** `CANONICAL BASELINE RECORD — C1-A DELIVERED LOCALLY · CI-01 OPEN (C1-B and closing change pending)` · **Task:** `CI-01 — Shared Intelligence Learning Evidence & Baseline` · **Date:** 2026-10-10
**Baseline SHA:** `main` `6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24` (merge of PR #324; migrations `0001`–`0150`; `0150` NOT DEPLOYED) · **Census version:** `census-v1 @ 6a5fa42`
**Authority:** [CI-01 C0 Decision Report](e2e/QANDEEL_CI_01_C0_DECISION_REPORT_v1.md) (D1–D10, Product Owner 2026-10-10) · [C1 Task Contract](e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md) (approved with mandatory amendments, 2026-10-10) · **Static contract:** `tests/ci-01-intelligence-evidence-baseline-contract.test.mjs`
**Companion:** [QANDEEL Conversational Personality & Interaction Adaptation v1](conversational-personality-v1.md)

> **What this record is.** The measured, cited truth of what QANDEEL's per-user intelligence can do at the baseline SHA, and the rule under which each kind of evidence may be read, learned from or retained. It changes no runtime, no schema, no frozen semantics and no Product decision. It is a **versioned baseline**: §2 (the Capability Census) describes the current state, defects included; an authorized later task that repairs a row updates that row and bumps the census version in the same change. Nothing in §2 is a rule. The rules are §4 (`CI-01-L1…L8`) and §5 (evidence classes); only those, and the authorities they cite, are pinned by the static contract.
>
> **What this record is not.** Not a learning runtime, not a training or fine-tuning path, not a Shared or aggregate learning design (D8, D9), not a quality score, not a deletion rule (D4), not an authorization to repair any defect listed here (each repair needs its own Task Contract).

---

## 1. Decisions this record implements

| Decision | Content | Where in this record |
|---|---|---|
| D1 | CI-01 is reading D (Evidence & Evaluation Baseline) now; A (QANDEEL learns from the user's own evidence inside Memory / HIM limits) is the only learning direction; no Learning Runtime, no training | §1, §6, §7 |
| D2 | the full task name is kept; `QAN-BL-CI-01` is unrelated iOS CI | banner |
| D3 | the eight Product Owner limits become a named rule set, widening nothing | §4 |
| D4 | Readable / Learnable / Retainable, with technically stored / currently usable / legitimately retainable kept apart; no unified deletion rule | §5 |
| D6 | PG-02 and its neighbours are bounded C2 slices after C1; evidence loss ≠ hypothesis false; re-evaluation without inventing Confidence | §6, `QAN-BL-INTEL-01` |
| D7 | only structural, synthetic measurements before a real LLM test | §3, §7 |
| D8 / D9 | no Shared, cross-user, aggregate, training or fine-tuning path; synthetic evaluation permitted | §4 (L1, L2), §7 |
| D10 | the stale SHARED-VIS-01 banners are an independent documentary gap, not repaired here | §8 |
| Mandatory Correction 3 | no defect pinning: §2 is a baseline, not a contract | preamble, §2, §9 |

---

## 2. Capability Census (`census-v1 @ 6a5fa42`) — current state, cited; **not a rule**

Legend: **ACTIVE** = implemented and runs on `main` without a provider; **PROVIDER-GATED** = implemented, needs a key or the Stage-8A binding; **DECIDED-NOT-IMPL** = frozen vocabulary / contract with no producer; **DEFERRED** = explicitly deferred, owner shown; **ABSENT** = nothing exists and nothing is decided.

| # | Capability | What it is at the baseline | State | Evidence (repository path) |
|---|---|---|---|---|
| C-01 | Memory store | `public.memories`: 8 types, 5 sources, 6 statuses, extraction `confidence`, `importance`, `version`, `supersedes_memory_id`; no subject / person, session / turn or world column; rows immutable except `status` / `updated_at`; owner-only RLS | ACTIVE | `database/migrations/0004_memory_runtime.sql` (table, `memories_select_own` / `_insert_own` / `_update_own` on `auth.uid()`); `0026`; `0072`; `0130` |
| C-02 | Memory capture | deterministic regex evaluator, no model: ~8 first-person patterns (EN / AR), one candidate per turn, always `USER_STATED` / `ACTIVE`, confidence 0.95 / 0.98 = extraction clarity | ACTIVE (background; needs the Redis consumer) | `apps/api/src/memory/memory-write-evaluator.service.ts` (imports only `@nestjs/common` and local types) |
| C-03 | Memory sources `USER_CONFIRMED`, `SYSTEM_DERIVED`, `PENDING_CONFIRMATION`; type `DERIVED_INSIGHT` | vocabulary only; no writer | DECIDED-NOT-IMPL | evaluator doc comment; `0004` |
| C-04 | Memory retrieval | lexical, deterministic: 32 candidates → 4 selected, 2,400 chars; score `relevance*100 + importance*5 + confidence*2`; no vector index; no "prior successful use" | ACTIVE | `apps/api/src/memory/memory-retriever.service.ts` |
| C-05 | Conversational Memory control | inspect / remember / correct (supersede) / forget (`DELETED`, content kept) / do-not-rely (`DISABLED`); immutable `memory_control_commands`; one transaction with the reply | ACTIVE (E2E-D-13) | `0128`; `apps/api/src/memory/memory-control.service.ts` |
| C-06 | Evidence layer | a projection, not a table: newest 64 `ACTIVE` unexpired `USER_STATED` / `USER_CONFIRMED` non-derived memories, exact dedup, id `memory:<uuid>`; SQL mirror `canonical_eligible_memory_ids_v1` | ACTIVE | `apps/api/src/memory/evidence.service.ts`; `0028`; [Evidence layer v1](intelligence-evidence-layer-v1.md) |
| C-07 | Evidence history | `historical_evidence_participation_events` (ATTACHED / DETACHED, world version), immutable | ACTIVE | `0072` |
| C-08 | Hypothesis store & lifecycle | free-text LLM statements, 9 types, 6 domains, scope `CONVERSATION_SESSION:<id>`, 8-state graph; only auto transition CANDIDATE → ACTIVE; `transition_hypothesis_v2` is granted to `authenticated` (an owner JWT can move status directly); owner-only RLS | ACTIVE | `0005` (`hypotheses_select_own` / `_insert_own`); `0036`; `apps/api/src/hypothesis/hypothesis-lifecycle.ts` |
| C-09 | Auto SUPPORTED / WEAK / REJECTED / RETIRED, evidence weights, thresholds | "capability only" until a calibrated Confidence exists | DEFERRED (no owner) | lifecycle doc §8–§9; update-loop doc |
| C-10 | Hypothesis generation / intent / association | bound to Gemini 2.5 flash / flash-lite and OpenAI gpt-5-mini outside the Model Router; fail closed without keys; no fallback; post-response budget of 3 | PROVIDER-GATED | `apps/api/src/hypothesis/hypothesis-*-provider.config.ts`; `post-response-provider-budget.ts` |
| C-11 | Trigger classification | deterministic regex: `PREFERENCE_OR_GOAL → NO_TRIGGER`; fires on why-self, recurring, contradiction, relational, unclear-outcome; some Arabic patterns use ASCII `\b` | ACTIVE | `apps/api/src/hypothesis/hypothesis-generation-trigger-classification.service.ts` |
| C-12 | Confidence | structural, insert-only per exact version; `numeric_score` and `confidence_band` forced NULL by CHECK; `UNCALIBRATED`, `UNASSESSED`; N1 NOT EXPOSED | ACTIVE (calibration DEFERRED) | `0006_confidence_runtime.sql` (`confidence_score_unassigned_check`, `confidence_band_unassigned_check`); `apps/api/src/hypothesis/confidence.service.ts`; [Confidence runtime v1](confidence-runtime-v1.md) |
| C-13 | Information Gap / Question | gaps materialized from 3 Confidence codes; oldest OPEN gap per session, fixed objective, model only phrases; closure only via Confidence state, never answer detection; utility / EIG NULL (N2 NOT EXPOSED) | ACTIVE | `0038`; `0063`; `0007` |
| C-14 | Understanding surface | owner-only projection of hypotheses (ACTIVE / SUPPORTED / MIXED / WEAK) with eligible Memory as evidence / contradictions; qualitative 4-state confidence from structure; CLEAR requires `SUPPORTED` (unreachable by app code) | ACTIVE (E2E-D-14 / 15) | `apps/api/src/understanding/understanding-projection.ts`; W3-MEGA-U record §2.3 |
| C-15 | Disagreement → Contested | explicit, exact-version, immutable `understanding_contests`; moves the item to MIXED; resolved only by the user's confirmation or withdrawal; provider sees `userContest: 'UNDER_REVIEW'` | ACTIVE (PG-01 closed) | `0127`; `0134`; `apps/api/src/hypothesis/hypothesis-user-signal.repository.ts` |
| C-16 | **PG-02 propagation** | a forgotten / disabled Memory stops counting as Evidence at read time; hypothesis text / status untouched; no re-evaluation triggered | **NOT IMPLEMENTED** — `QAN-BL-INTEL-01` | W3-MEGA-U record §5; C0 §4.4 scenario F1 |
| C-17 | HIM | 17 ordinal metrics produced only by a direct structured self-report scored deterministically; `CALIBRATED` = governance approval of a deterministic v1 model, not statistical; confidence / freshness `UNASSESSED`; no API or mobile caller writes a measurement; `him_calibration_evaluations` never written by the app | ACTIVE infrastructure, organically EMPTY | `apps/api/src/human-model/initial-him-metrics.catalog.ts`; [HSE measurement model](hse-energy-measurement-model-v1.md); [HIM calibration runtime](him-metric-calculation-calibration-runtime-v1.md) |
| C-18 | HIM Brain Context bridge | 8 frozen slots materialized post-response, zero foreground wait, no trend / average | ACTIVE | QHIA-012; `0061` |
| C-19 | HIM trends / calibration evaluations | infrastructure exists; `HimTrendService` not registered; `comparisonStatus: RECORDED_NOT_EVALUATED` | DECIDED-NOT-IMPL / DEFERRED | QHIA freeze; `apps/api/src/human-model/him-calculation.types.ts` |
| C-20 | Model Router (conversational) | Claude + OpenAI adapters, FAST / DEEP deterministic routing (no LLM classifier), `MODEL_PROVIDER` empty, throws on first generate; no fallback / ranking | PROVIDER-GATED (Stage 8A) | `apps/api/src/model-router/model-router.module.ts`; `.env.example` |
| C-21 | Structured ports | `PublicSemanticInterpreter`, `PublicSpatialPlacer`, `SharedSemanticInterpreter`, `SharedSpatialPlacer` refuse; never a fallback | PROVIDER-GATED (Stage 8A) | `apps/api/src/public-world/public-semantic-interpreter.ts`; `apps/api/src/shared-world/shared-semantic-interpreter.ts` |
| C-22 | Shared QANDEEL reply context | Shared-native history only through EffectiveContext; private lane fail-closed and unused; "Personal Memory, Understanding, HIM, hypotheses and conversation never enter a Shared reply" | ACTIVE (bounded) | S4-02 record §7.1; backlog `QAN-BL-CW-02` |
| C-23 | Public QANDEEL reply context | served version, reviewed meaning, package items, last 40 posts, last 20 responses, related meanings; no author, Personal, Shared, memory, human-model or hypothesis material | ACTIVE behind a fail-closed entitlement seam | S5-04 record §8 |
| C-24 | Public semantic review | publisher accepts or corrects QANDEEL's proposed meaning before publication; `semantic_reviews.decision IN (ACCEPTED, CORRECTED)` per version; no code reads it as a feedback or quality signal; lineage-based F05 erasure covers it | ACTIVE (interpreter PROVIDER-GATED) | `0144`; S5-03A record §13; `0143` |
| C-25 | AI usage / cost ledger | per call: account, session, turn, provider, model, one of 8 feature families, FAST / DEEP path, token kinds; no prompt / response / transcript, no latency, no quality field; no Price Card registered; Credit Policy DRAFT-only | ACTIVE | `0135` |
| C-26 | Brain bake-off harness | 24 synthetic conversations, blinded 1–5 rubric (9 items), paid run gated; never run; `validateEvaluationSuite` requires 20–30 cases per suite | IMPLEMENTED, NOT RUN | [Brain bake-off harness](brain-bakeoff-harness.md); `apps/api/src/brain-eval/brain-eval.validation.ts` |
| C-27 | Telemetry / outbox | closed label registries; anything else dropped; outbox rows carry ids only, `contains_content = false` by CHECK | ACTIVE | `apps/api/src/runtime-events/runtime-event.types.ts`; `0019_runtime_event_outbox_publisher_v1.sql` |
| C-28 | Export My Data | memory in every state (labelled "forgotten" / "not relied on" / "replaced"), Understanding items + disagreements; excludes scores, evidence refs, HIM, command records | ACTIVE (`QAN-BL-PRIV-01 / 02` open) | `0130` |
| C-29 | Personal erasure | physical delete of memory, hypotheses, confidence, contests, HIM through 16 guards; `BLOCKED` by Connected Worlds (`QAN-BL-ACCT-01`) | ACTIVE for Personal | `0130` |
| C-30 | Conversational language signal | the conversational request carries `locale: 'und'` always; dialect is left to the model under the guidance line "when reasonably inferable" | current state (a C2 slice will replace it; **not pinned**) | `apps/api/src/conversation/conversation-orchestrator.service.ts`; `public-qandeel-model-input.ts`; `shared-conversation-model-input.ts` |
| C-31 | Behavioural guidance text | `BehavioralResponsePolicyService.buildTextGuidance()` returns one static string (8 lines) rendered by `composeServerGuidance` | ACTIVE (policy text, not a runtime; **not pinned**) | `apps/api/src/conversation/behavioral-response-policy.service.ts`; `apps/api/src/model-router/model-router.types.ts` |
| C-32 | Any cross-user, aggregate, training, fine-tuning, reward or outcome-feedback mechanism | none; every "cross-user" mention in code or docs is a prohibition | **ABSENT** (and forbidden without consent by L1 / L2) | comment-stripped sweep of `apps/api/src` for fine-tuning / training-job / reward-model identifiers: 0 hits at the baseline |

### 2.1 Synthetic reality findings carried from C0 (2026-10-09, `main` `5973123`; synthetic accounts only; not repository authority until C1-B re-runs them)

| Scenario | Observed (synthetic) | Census rows affected |
|---|---|---|
| N1 natural self-description | 0 of 4 value statements stored; one location statement stored with the feminine form rewritten to the masculine | C-02 |
| K1 explicit preferences / goals / decisions | 3 of 6 stored (anchored «أنا بحب», «هدفي», «قررت»); asking back about an unstored topic returned 0 memories | C-02, C-04 |
| C1 natural reversal then explicit restatement | reversal left the old preference `ACTIVE`; restatement superseded v1 but a second `ACTIVE` duplicate remained | C-05 |
| P1 third-party statement | stored as the user's own `PERSONAL_FACT` via the explicit-remember path | C-02, C-05 |
| F1 forget / do-not-rely | Memory moved to `DELETED` / `DISABLED`; linked hypotheses stayed `ACTIVE` and were injected in a new session | **C-16 (PG-02)** |
| H1 stressed-day statement | HIM `coverageState: EMPTY`, 0 known metrics | C-17 |
| M1 / X1 triggers | «ليه أنا» trigger dead (ASCII `\b`); contradiction trigger fires; «بس» inside a longer word also fires | C-11 |
| Controls | the other synthetic user sees 0 memories via RLS; 0 cross-user retrieval; 46 router calls, 0 external HTTP | C-01, C-08, C-20, C-27 — the authorities hold |

Migrations `0149` / `0150` touch Matching privileges and stale-state SQLSTATEs only; the citations above were re-checked on `6a5fa42`. C1-B re-measures these on a process-owned disposable PostgreSQL under the C1 contract §0.3 isolation rules; any divergence is recorded as a finding.

---

## 3. Evidence Matrix — source, authority and consequence per kind of evidence

Columns: Source · Ownership / authorized audience · Quality & provenance · Freshness / version · Contradiction / correction · Consent / revocation · Deletion consequence · Existing runtime consumer · Missing capability (→ owner) · Verification method at the baseline.

| Source of evidence | Ownership / audience | Quality & provenance | Freshness / version | Contradiction / correction | Consent / revocation | Deletion consequence | Existing consumer | Missing capability (→ owner) | Verification (today) |
|---|---|---|---|---|---|---|---|---|---|
| **Memory row** (`USER_STATED`) | owner only (RLS); never Shared / Public | `source`, extraction `confidence`, `importance`; turn only via effect ledger / command row | `version`, `updated_at`, `expires_at`; supersession chain | supersede (CORRECT), `DISABLED`, `DELETED`; natural reversal not detected | implicit in use of Personal QANDEEL; FORGET = status only | content retained until account erasure; export labels it "forgotten" | retriever (4 items), Evidence, Understanding detail, export | subject marker; `USER_CONFIRMED` writer; duplicate supersession; semantic recall (→ C2 *Memory correction & Arabic acquisition*) | `verify-migration-0004 / 0026 / 0128`; synthetic N1 / K1 / C1 / F1 |
| **Evidence item** (projection) | owner only | mechanical kind by type; confidence ≠ truth | recomputed per read; newest-64 window | separate items, no adjudication | none beyond Memory | disappears at read time when Memory leaves `ACTIVE` | hypothesis attach / update, Confidence, Understanding | nothing older than the window; no weight (→ deferred, no owner) | `0028` verifier; evidence-layer contract |
| **Hypothesis** (`SYSTEM_GENERATED`) | owner only; provider sees ≤ 8 | LLM free text; assumptions ≤ 8; supporting / contradicting ids; audit of transitions | exact version per change; session scope tag (read cross-session) | user disagreement → MIXED / UNDER_REVIEW; **no propagation from Memory invalidation (PG-02)** | none; `transition_hypothesis_v2` reachable by the owner JWT | erased with account; survives Memory forget (state (a) only, §5) | reasoning context, Understanding, Question | PG-02 re-evaluation (→ `QAN-BL-INTEL-01`); weighting; cross-session consolidation; language rewrite (→ unowned) | `0036`, `0127`, `0134` verifiers; synthetic F1 |
| **Confidence evaluation** | owner only | structural codes; NULL score by CHECK | insert-only per exact version | re-evaluated on contest | — | erased with account | Understanding state, gap materialization | numeric / calibrated model (→ deferred) | `0006`, `0035` verifiers |
| **Understanding contest** | owner only | explicit act, exact version, command id | immutable; resolution facts | user confirm / withdrawal only | revocable by the user's own resolution | erased with account; agreement fact missing from export (→ `QAN-BL-PRIV-01`, `PRIV-EXPORT-01`) | provider `userContest`, Understanding | export completeness (owned) | `0127`, `0134` verifiers |
| **HIM measurement** | owner only; exact context | deterministic v1 model; `UNASSESSED` confidence / freshness | observation time; no trend consumed | none (no re-measure path) | — | erased with account | foreground 300 ms lanes, Brain Context | capture surface; scientific calibration (→ QHIA change control; outside CI-01) | 17 model verifiers; `him-structured-measurement-preflight` |
| **Information Gap / Question** | owner, same session | fixed server text; code-derived | OPEN / RESOLVED / SUPERSEDED, epochs | closure only via Confidence | — | erased with account | one phrased question per turn | utility, answer detection (→ deferred) | `0063` verifier |
| **Shared-native history** | current members by EffectiveContext; former-member entitlements | author = `auth.uid()`; audience derived | World version | owner deletion narrows serving | membership; Standing Context grant exists in DB, unused | owner deletion honoured; account deletion `BLOCKED` (`QAN-BL-ACCT-01`) | Shared reply, semantic places (`0148`) | Personal → Shared path (→ `QAN-BL-CW-02`, `SHARED-CTX-01`) | `0139`, `0148` verifiers; S4-02 contract |
| **Public reviewed meaning** | public audience only (fail-closed seam) | publisher accept / correct per version; lineage provenance | version-bound | publisher correction | publication = consent; withdrawal | F05 lineage-based erasure (state (c), §5) | Public QANDEEL context, field placement | provider binding (→ Stage 8A); QANDEEL output as a Shared source (→ `QAN-BL-CW-05`, Stage 8A) | `0143`–`0147` verifiers |
| **AI cost ledger** | Company, content-free | provider-reported tokens; Price Cards | per call start | re-rating = new version | — | cascades with account | ops summary | nothing for learning, by design | `ai-cost-01` contract |
| **Synthetic harness run** | repository / engineering | deterministic doubles, fixtures | pinned to a `main` SHA | re-run | — | n/a | none yet | the repo-resident recipe (→ C1-B) | this record §2.1 |

---

## 4. Privacy and learning rule set `CI-01-L1 … L8` (D3; Product rule, widening nothing)

Each rule restates an existing authority or, where none existed by name, the Product Owner's D3 / D9 decision. Enforcement names what exists at the baseline. A rule is **pinned** when the static contract asserts the cited enforcement.

| Rule | Statement | Existing authority | Enforced today by | Pinned by the static contract |
|---|---|---|---|---|
| **`CI-01-L1`** | No Personal memory, hypothesis, Confidence, HIM or Understanding content is transferred between users by default; knowledge possession is not audience permission | Foundation Freeze (cross-user prohibited); P1 §11.7; CW2-01 | owner-only RLS on `memories` (`0004`) and `hypotheses` (`0005`); the fail-closed Shared private lane (`QAN-BL-CW-02`); the Public-only assembler (S5-04) | **yes** — `0004` / `0005` owner policies on `auth.uid()` |
| **`CI-01-L2`** | No training, fine-tuning, reward modelling or outcome-feedback learning on private conversations or Personal data without the Product Owner's explicit approved consent design; synthetic evaluation is permitted (D9) | **D3 / D9 (Product Owner, 2026-10-10)** — no earlier record named it | the absence of any such pipeline; content-free telemetry and ledger | **yes** — comment-stripped negative sweep of `apps/api/src` for fine-tuning / training-job / reward-model identifiers; an authorized future design lifts this by Controlled Change together with its consent record |
| **`CI-01-L3`** | No Shared World content leaves its authorized audience | I-03 EffectiveContext; CW2-08 non-waivable audience boundaries | `0139` / `0148` verifiers; S4 contracts | no (owned by the Shared contracts) |
| **`CI-01-L4`** | No new personality trait, HIM metric or HIM score without an approved deterministic model under QHIA change control | QHIA freeze: "No uncalibrated metric may be silently estimated or promoted" | 17 model verifiers; `him-structured-measurement-preflight` | no (owned by QHIA) |
| **`CI-01-L5`** | No invented Confidence number, baseline, calibration or improvement indicator from insufficient data; the baseline publishes structural, synthetic yields only (D7) | `0006` CHECKs; N1 / N2 NOT EXPOSED; QHIA "no comparison to an inferred baseline" | `confidence_score_unassigned_check`, `confidence_band_unassigned_check` (`0006`); the Understanding projection | **yes** — the two `0006` CHECKs (the frozen Confidence semantics; a later authorized model arrives as a new migration and updates this row) |
| **`CI-01-L6`** | No change to the user's authority over their data: inspect, correct, forget, do-not-rely, export, erase, disagree stay as frozen; any PG-02 work must **strengthen** forget, never weaken it | W3-PDG-01; `0128`; `0130`; `0134` | the implemented commands and guards | no (owned by W3-MEGA-M / W3-MEGA-S / W3-CORR-U) |
| **`CI-01-L7`** | No conversation or Memory content in telemetry, outbox or evidence files | APP-OPS-01 PO-OPS-03; [correlation telemetry](correlation-telemetry-foundation-v1.md) | closed label registries; outbox `contains_content = false` CHECK (`0019`) | **yes** — the `0019` CHECK |
| **`CI-01-L8`** | No bypass of Safety, Consent, Provenance or Ownership by any evidence or learning path; Safety `BLOCK` short-circuits before any provider or style decision | Safety as a runtime constraint (Foundation Freeze); CW2-08 H1–H27 | the orchestrator's `BLOCK` branch returning the deterministic response; seams answering `NOT_EVALUATED` | **yes** — the orchestrator's `BLOCK` disposition branch |

**Widening check.** L3, L4, L6, L8 restate frozen clauses verbatim in substance. L1 restates the Foundation Freeze. L5 restates the `0006` design and D7. L7 restates PO-OPS-03. L2 is the one statement with no earlier record by name; it is recorded as the Product Owner's decision, not as a derived permission, and it permits nothing that was forbidden.

---

## 5. Evidence classes and the three-state distinction (D4)

### 5.1 The classes

1. **Readable** — may be read to answer the current turn under existing authority (Memory retrieval, HIM lanes, Shared / Public context). Everything in §3 with an "existing consumer".
2. **Learnable** — may change a durable *per-user* derived state (hypothesis status, Confidence, Memory supersession). At the baseline: only the user's own explicit acts and the post-response pipeline on the user's own turns. **No cross-user source is learnable** (L1, L2).
3. **Retainable** — a derived result may legitimately be kept after its source is gone — only as §5.2 (c).

### 5.2 Inside "retained": three states, never collapsed

| State | Meaning | Is it a permission? |
|---|---|---|
| **(a) technically stored** | the row still exists in the database | **no** — presence after the evidence was deleted is state (a) only |
| **(b) currently usable** | existing authority permits reading or relying on it now | only if the owning system's approved rules say so |
| **(c) legitimately retainable** | Product and law permit keeping it after the source has gone | only by an explicit frozen Product decision |

### 5.3 Classification at the baseline

| Case | Classification | Governing rule |
|---|---|---|
| A hypothesis that outlives a forgotten or disabled Memory (PG-02) | **(a) without (b)** — technically stored, not currently usable, **pending re-evaluation** according to its state and the remaining evidence; neither automatically false nor silently relied upon (D6) | `QAN-BL-INTEL-01`; the re-evaluation must not invent Confidence (L5) |
| Memory content in `DELETED` status | (a) by the frozen `0128` design ("content kept, status only"); excluded from (b) at read time; export labels it "forgotten" | `0128`, `0130` |
| Memory content in `DISABLED` status | (a); excluded from Evidence at read time; still inspectable by the owner ("not relied on") | `0128`, `0130` |
| A Public reviewed meaning after F05 lineage erasure | **(c)** by a frozen Product decision | S5-02 / S5-03A |
| Historical evidence participation events (`0072`) | (a) and (b) as immutable history, by the frozen Living Analysis design | `0072` |
| Confidence evaluations of a hypothesis whose evidence was forgotten | (a); the next evaluation is the re-evaluation PG-02 owes | `QAN-BL-INTEL-01` |

Each system's own approved deletion and history behaviour governs. **CI-01 invents no unified deletion rule.**

---

## 6. Gap register for Direction A — current owners and dependencies (no ownership transferred by this record)

| Gap | Current owner | Dependencies | Disposition in CI-01 |
|---|---|---|---|
| **PG-02** — Personal Evidence Invalidation → Derived Understanding Re-evaluation | **`QAN-BL-INTEL-01`** → owner task `INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02)` (admitted by C1-A, `HIGH`, `DEFERRED — OWNED`) | existing Confidence core and transition functions (`0006`, `0035`, `0036`); the `0128` effect ledger as the invalidation signal; L5 (no invented Confidence); L6 (strengthens forget); a Product decision on what the user sees for a "pending re-evaluation" item | documented; **not repaired** |
| Memory correction & Arabic acquisition (duplicate supersession, natural reversal, feminine form, Unicode `\b`, third-party statements) | no backlog item; proposed C2 slice 2 of the C1 contract §12 | a Product decision on the subject marker (own vs other); `0128` command path; L1 | documented; proposed slice; no admission (BG-06: not yet designated) |
| `PG-04` — Selective Understanding Sharing | none (P1 §11.7 names the gap) | Shared Standing Context (`QAN-BL-CW-02`) | documented only |
| Runtime-backed Conversational Relevance | `QAN-BL-CTX-01` → `QAN-CTX-01` | — | referenced; unchanged |
| Shared Standing Context Product & private-source integration | `QAN-BL-CW-02` → `SHARED-CTX-01` | the `0083` grant; Product Definition divergence noted in C0 §11.4 | referenced; unchanged |
| QANDEEL output as a Shared semantic-place source | `QAN-BL-CW-05` → Stage 8A | provider binding | referenced; unchanged |
| Export completeness (agreement facts; preferences and mutes) | `QAN-BL-PRIV-01`, `QAN-BL-PRIV-02` → `PRIV-EXPORT-01` | — | referenced; unchanged |
| Auto SUPPORTED / WEAK / REJECTED / RETIRED; evidence weights | deferred, no owner (lifecycle doc §8–§9) | calibrated Confidence | documented only |
| ABS Part 9 experiment framework / outcome attribution / learning feedback | none (`docs/reasoning-recommendation-integration-v1.md`) | L2 consent design; Stage 8A | documented only; **forbidden without L2 consent** |
| Conversational language / dialect signal (`locale: 'und'`) | proposed C2 slice 4 (*Adaptive Conversational Expression*) | the companion record; QIR-004 byte accounting | documented; not pinned |

---

## 7. Directions B and C — closed for CI-01 (D8, D9)

- **B — Shared World learning from members' authorized knowledge:** not CI-01. Its only legitimate path is `SHARED-CTX-01` (`QAN-BL-CW-02`), by explicit grant; semantic places are `0148`. No Shared memory, no Shared learning store.
- **C — General quality improvement from aggregated evidence:** not CI-01. No cross-user, aggregate, training or fine-tuning path exists or is authorized (L1, L2). The only aggregate that exists is the content-free AI cost ledger (C-25). **Synthetic evaluation** (the `brain-eval` harness and the C1-B recipe) is permitted and is the sole quality-measurement path until Stage 8A.
- **D7 non-claim:** no conversational-quality score, naturalness figure, "intelligence score" or calibration number is producible or published before a real LLM test; the C1-B yields are structural counts on synthetic fixtures and are labelled so.

---

## 8. Documentary notes (no action in CI-01)

1. **Stale SHARED-VIS-01 banners** (Project Map §5.1, Current State :140 / :167, record banner, `QAN-BL-CW-03` row): an independent governance-reconciliation gap (D10). Issue #322 and every Release Gate stay open.
2. **Two stale docs** predate the association wiring (`docs/fresh-evidence-hypothesis-association-authority-foundation-v1.md`, `docs/hypothesis-evidence-association-provider-binding-v1.md`); the dispatcher does run the Gemini-bound association today.
3. **Name collision** `CI-01` vs `QAN-BL-CI-01` (D2).
4. **Leave-vs-grant divergence** between `0083` / `database/README.md` and the Shared World Product Definition; relevant to `SHARED-CTX-01` only.

---

## 9. How this record evolves

- **Census rows (§2, §2.1, §3 "missing capability")** are a versioned baseline. The task that repairs a row updates it, cites the repair, and bumps `census-v1` to the next version in the same change. The static contract does **not** fail on such a repair.
- **Rules (§4) and classes (§5)** change only by Controlled Change with the Product Owner's decision; the static contract pins their cited enforcement and this record's presence.
- **Gap register (§6)** moves with the backlog: an admission, re-ownership or tombstone is recorded here in the same change that records it in the backlog.
- **C1-B** appends the first repository-resident measurement (`scripts/ci-01/results/<sha>.json`) and replaces §2.1's "carried from C0" provenance with the re-run on the then-current `main`.
