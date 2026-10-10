# CI-01 / C1 — Intelligence Evidence & Conversational Personality Baseline — DRAFT TASK CONTRACT

**Phase:** C1 — BASELINE RECORDS, STATIC CONTRACT, SYNTHETIC RECIPE · **Status:** `DRAFT TASK CONTRACT — NOT APPROVED · C1 NOT AUTHORIZED` · **Date:** 2026-10-10
**Parent:** [CI-01 C0 Decision Report](QANDEEL_CI_01_C0_DECISION_REPORT_v1.md) (D1–D10 approved with controlled amendments, 2026-10-10) and its [Interaction Style annex](QANDEEL_CI_01_C0_INTERACTION_STYLE_ANNEX_v1.md) (P1–P9).
**Task name (D2):** `CI-01 — Shared Intelligence Learning Evidence & Baseline`. Not `QAN-BL-CI-01` (iOS CI).

> This is a proposal for the Product Owner to approve, amend or reject. It authorizes nothing. Until the Product Owner approves it explicitly, no C1 file is written, no test is added, no harness is ported, no PR is opened. It inherits the Product Owner's non-negotiable rules (C0 report §0.1) in full.

---

## 1. Objective / user value

**Objective.** Turn the C0 research into repository truth that later intelligence work can be measured against: (a) a canonical, cited record of what QANDEEL's per-user intelligence can do today and under which authority each kind of evidence may be read, learned from or retained; (b) the Product rule set for privacy and learning (D3) and the three-state evidence vocabulary (D4); (c) the approved Conversational Personality v1 design and its adaptation limits (P1–P9) as a design record; (d) a reproducible, provider-free, synthetic harness that measures the structural capabilities named in D7 and stores its results as evidence pinned to a `main` SHA.

**User value.** Indirect but real: every later slice that makes QANDEEL remember, correct, or speak more naturally starts from a measured, honest baseline instead of an impression, and the user's privacy limits are written once as a rule rather than scattered across frozen clauses. No user-visible behaviour changes in C1.

**What C1 is not.** Not a learning runtime, not a model choice, not a Shared or aggregate path (D8, D9), not a personality implementation, not a Settings surface, not a migration.

---

## 2. Canonical baseline

| Item | Value |
|---|---|
| Repository | `allamqandeel/qandeel` |
| `origin/main` | `6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24` (merge of PR #324, PROD-RETRY-01); migrations `0001`–`0150`; `0150` NOT DEPLOYED |
| Working branch | `ci/ci-01-c0-decision-report` (local; `8d78384` + the decision-update commit; not pushed, no PR) — C1 would continue on a dedicated `ci/ci-01-c1-baseline` branch from `origin/main` |
| Authority read first | AGENTS.md §1 order; `QANDEEL_CURRENT_STATE.md`; `QANDEEL_PROJECT_MAP.md`; roadmap §6.3 / §6.4; backlog in full (BG-05); Foundation Freeze; QHIA freeze; QIR contract; Memory Runtime, Behavioral Runtime, Model Router, Core Runtime foundation docs; P1 closure §9–§13; W3-MEGA-U §5; CW2-08 §2 / §42 / §43; CW2-08A |
| Evidence inherited | C0 report §3.1 capability matrix, §4.1 baseline matrix, §4.4 synthetic scenario results (2026-10-09, `main` `5973123`); annex §1.2 / §1.3 |
| Stale locators (documentary, D10) | SHARED-VIS-01 banners in Project Map §5.1, Current State :140 / :167, record banner, `QAN-BL-CW-03` row — **not** repaired by C1 |

---

## 3. Inherited decisions (binding)

- **D1** D now, A the only learning direction; no Learning Runtime, no training.
- **D2** full task name kept.
- **D3** the eight limits (C0 §5.1) become a named Product rule set, widening nothing.
- **D4** readable / learnable / retainable, with the three-state distinction stored / usable / retainable; no unified deletion rule.
- **D5** C1-A (canonical baseline + rules + classification + static tests) and C1-B (synthetic reality baseline on local PostgreSQL); organisational split; no production change.
- **D6** C2-a decomposed into bounded slices after C1; evidence loss ≠ falsity; frozen-semantics change = Controlled Change.
- **D7** structural, synthetic measurements only; no conversation-quality number before a real LLM test.
- **D8 / D9** no Shared, cross-user, aggregate, training or fine-tuning path; synthetic evaluation permitted.
- **D10** stale SHARED-VIS-01 banners are an independent gap; Issue #322 and Release Gates stay open.
- **P1–P9** ONE QANDEEL PERSONALITY — ADAPTIVE NATURAL EXPRESSION; constraints by deterministic rule, expression by the model's understanding in the one generation; canonical Interaction Preferences designed, not built; bounded humour initiative; `brain-eval` extended, never paralleled; same personality across channels.
- **§0.1 rules** no change to User Ownership, Consent / Privacy, Safety Authority, Evidence Provenance, Memory / HIM scientific boundaries, Confidence semantics, Orchestrator authority, Shared / Public audience constraints, Model Router authority, AI-COST-01, Matching, Hosted Deployment; no LLM choice; no real user data; QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE.

---

## 4. Exact scope

### 4.1 C1-A — Canonical Evidence Baseline (documentation + static checks)

| # | Deliverable | Content | Form |
|---|---|---|---|
| A1 | **`docs/intelligence-evidence-baseline-v1.md`** — *QANDEEL Intelligence Evidence Baseline v1* | the capability census (C0 §3.1) and the evidence baseline matrix (C0 §4.1), every row cited to a repository path; the eight limits as rule set **`CI-01-L1 … L8`** (D3) each mapped to its existing authority and enforcement; the three evidence classes with the D4 three-state distinction (C0 §4.2); the gap register for Direction A with each gap's **current** owner (PG-02 — no backlog item; `QAN-BL-CTX-01` → `QAN-CTX-01`; `QAN-BL-CW-02` → `SHARED-CTX-01`; `QAN-BL-CW-05` → Stage 8A; `QAN-BL-PRIV-01/02` → their owners); the Direction B / C closure statement (D8, D9) | new canonical record, top-level `docs/` (see §8 for the banner shape the governance gate expects) |
| A2 | **`docs/conversational-personality-v1.md`** — *QANDEEL Conversational Personality & Interaction Adaptation v1 (design)* | §3.0 approved core, §3.1 invariants, §3.2 expressive range, §3.3 constraints-by-rule / expression-by-understanding mechanism with the candidate directive IDs and the two withdrawn ones, §4 three sources + precedence, §4.2 Interaction Preferences design, §5 guards, §6 Golden Conversation suite design (20 scenarios, 4 added rubric items, the validator constraint), §7 stage split, §8 non-claims — all from the annex, every conversational text marked **OPEN COPY** | new design record, top-level `docs/`; **design only** (P9 C1) |
| A3 | **`tests/ci-01-intelligence-evidence-baseline-contract.test.mjs`** | a static contract (file reads only, no database, no network) that fails when a cited capability's state changes without the record: the two records exist with their banners and the rule IDs `CI-01-L1…L8`; `0006` keeps its `numeric_score` / `confidence_band` NULL CHECK text; the memory write evaluator imports no provider or router module; the orchestrator still passes the literal `locale: 'und'` (so that the C2 language-constraint slice must update the record); `transition_hypothesis_v2` keeps its `GRANT … TO authenticated` line in `0036`; `apps/api/src` contains no fine-tuning, training-job or cross-account memory reader (negative regex sweep); `brain-eval.validation.ts` keeps the 20–30 bound (so a Golden suite cannot be slipped into the existing suite unnoticed); `BehavioralResponsePolicyService.buildTextGuidance` remains one static string. Pins are semantic regexes, never line numbers or whole-file hashes, and must pass the forward-safety "ceiling" scan (§8) | new file; registered as `npm run test:ci-01-intelligence-evidence-baseline-contract` in the root `package.json`; **added to `api-ci.yml` only in the closing change, when the Product Owner authorizes the PR** |
| A4 | **Locator updates** (closing change only) | one row in `QANDEEL_CURRENT_STATE.md`, one pointer in `QANDEEL_PROJECT_MAP.md`, one execution note in `QANDEEL_PRODUCT_ROADMAP.md` §6.5 recording that CI-01 C0 / C1 exist and what they do **not** authorize | top-level locators; status notes only, no semantics |

### 4.2 C1-B — Synthetic Intelligence Reality Baseline (local, synthetic, provider-free)

| # | Deliverable | Content | Form |
|---|---|---|---|
| B1 | **`scripts/ci-01/local-db.mjs`** | bootstrap a disposable local PostgreSQL 17 cluster (`initdb` / `pg_ctl` or an already-running local server given by env), create the database, apply `database/migrations/0001…0150` from zero as whole-file batches (the prior recipe did this without `psql`); refuse any non-local host | dev-only script; port of the 2026-10-09 recipe (90 lines) |
| B2 | **`scripts/ci-01/intelligence-reality.ts`** | drive the **real** `ConversationOrchestratorService`, Memory, Evidence, Hypothesis, Confidence, Question and HIM services with deterministic doubles for the Model Router, the three hypothesis providers and Redis; **global `fetch` replaced by a thrower** so no external or paid call is possible; synthetic accounts created by the script itself; scenarios N1, K1, C1, P1, F1, H1, M1/X1 and the isolation controls (C0 §4.4) read from fixture files; emits only the structural yields of D7 — capture yield, recall, truth maintenance (stale after reversal / duplicate after correction / hypothesis after forget), privacy isolation (cross-user retrieval = 0, telemetry content = none), cost-ledger shape (rows without content) | dev-only script; port of the 2026-10-09 `s601-reality.ts` (445 lines) + `pg-fg-adapters.ts` (312 lines); imports production services read-only; **modifies none** |
| B3 | **`scripts/ci-01/fixtures/*.json`** | the synthetic Arabic / English statements per scenario (first-person self-description, preferences / goals / decisions, natural reversal + explicit restatement, third-party statements, forget / do-not-rely, stressed-day statement, «ليه أنا دايما…» / «عايز… بس خايف» triggers) — synthetic persons, no real names or data | fixtures |
| B4 | **`scripts/ci-01/results/<main-sha>.json`** + a short `scripts/ci-01/README.md` | the recorded yields for `6a5fa42` (or the then-current `main`), with the recipe's exact command, PostgreSQL version and double versions; the README states what the numbers are **not** (D7: no conversation quality, no intelligence score) | evidence files |
| B5 | `npm run verify:ci-01:intelligence-reality:local` | one script entry; **never** added to any CI workflow (local PostgreSQL only) | `package.json` script |

### 4.3 What enters neither sub-slice
Any change under `apps/api/src`, `apps/mobile`, `database/migrations`, `packages`; any provider key or binding; any Golden-case TypeScript fixture inside `apps/api/src/brain-eval` (that is the C2-b slice — see §15 decision 5); any backlog item admission (see §13); any repair of the SHARED-VIS-01 banners (D10).

### 4.4 One contract or two?
**Recommendation: one contract, two ordered sub-slices, one closing change.** Reasons: both are documentation-and-evidence work on the same baseline with no production change; C1-B's README cites C1-A's record and C1-A's gap register cites C1-B's results, so closing them together keeps one truth; one PR and one governance reconciliation instead of two. The stop point between them (§14) protects the Product Owner's ability to halt after C1-A. **Alternative:** two contracts if the Product Owner wants C1-A merged before any script enters the repository, at the cost of a second kickoff / closure cycle and a temporary record whose results column says "pending C1-B".

---

## 5. Anti-duplication matrix

| C1 would add | Existing thing checked | Verdict |
|---|---|---|
| Evidence Baseline record | `docs/intelligence-evidence-layer-v1.md` (the Evidence projection contract), `docs/confidence-runtime-v1.md`, QIR-008 closure | different purpose: those freeze runtime semantics; the baseline records *measured capability and authority per evidence kind* and changes none of them |
| Rule set `CI-01-L1…L8` | Foundation Freeze privacy clauses, QHIA non-inference, CW2-08 §2 / §42, CW2-08A, PO-OPS-03, correlation-telemetry doc | the rule set **cites** each; it adds the one missing explicit statement ("no training / fine-tuning on private conversations without explicit approved consent") and widens nothing (D3) |
| Three-state evidence vocabulary | 0128 FORGET semantics, F05 lineage erasure, W3-MEGA-U §5 PG-02 | vocabulary over existing behaviours; no new deletion rule (D4) |
| Static contract test | 95 `tests/*-contract.test.mjs`; `prod-retry-01-…`, `integrated-intelligence-runtime-contract`, `human-intelligence-provider-semantics-consolidation-contract` | same pattern; new pins only on facts no other contract pins (checked at kickoff by grep for each regex) |
| Synthetic harness | `verify:full-intelligence-e2e-runtime`, `verify:integrated-brain:e2e-hardening-v2`, `verify:a2-e2e-runtime-smoke` (all need `.env` / running infrastructure and are runtime smokes), `brain-eval` (paid provider bake-off) | none measures capture yield / recall / truth maintenance on fixtures with doubles against a disposable local database; the 2026-10-09 recipe is the only prior art and is being **ported**, not re-derived (C0 anti-dup 7) |
| Personality design record | Behavioral Runtime v1.0 spec, VI-01 register, `BehavioralResponsePolicyService` | the record is the Product personality the spec asked for ("Personality" named as an ABS capability with no contract); it changes no spec and no code |
| Interaction Preferences design | Memory `INTERACTION_PREFERENCE`, W3-MEGA-S General Settings, 0128 commands | design only; the later slice must prove non-duplication against these three before building |
| Golden Conversation suite design | `apps/api/src/brain-eval` 24-case suite and 9-item rubric | extension design (second named suite / raised bound), not a second harness (P8) |

---

## 6. Files and modules likely to be affected

**Added:** `docs/intelligence-evidence-baseline-v1.md` · `docs/conversational-personality-v1.md` · `tests/ci-01-intelligence-evidence-baseline-contract.test.mjs` · `scripts/ci-01/{local-db.mjs, intelligence-reality.ts, README.md, fixtures/*.json, results/<sha>.json}`.
**Edited (minimal):** `package.json` (two script entries) · closing change only: `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md` (§6.5 note), `.github/workflows/api-ci.yml` (one `run:` line for A3), the two C0 documents' banners (`C1 IN PROGRESS` → final state).
**Read, never written:** everything under `apps/api/src`, `database/`, `apps/mobile`, `packages/`, `docs/implementation-foundation/`, `docs/qandeel-canonical-backlog-v1.md` (unless §13 is approved).

---

## 7. Data and privacy boundaries

- **No real user data.** C1-B creates its own synthetic accounts in a disposable local database and destroys the cluster at the end; fixtures contain invented statements only.
- **No hosted connection.** `local-db.mjs` refuses any host other than `localhost` / `127.0.0.1` / `::1`; no `SUPABASE_*` or `DATABASE_URL` from `.env` is read.
- **No provider.** Global `fetch` throws; no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / Gemini key is read; the doubles return fixed, content-free structures.
- **No content in evidence files.** `results/<sha>.json` stores counts, ids and states — never a synthetic transcript verbatim beyond the fixture file that already holds it.
- **No telemetry change, no ledger change**; the harness asserts the existing content-free shapes.
- **No human review of private conversations** anywhere in C1 (CW2-08A); reviewers see synthetic cases only.
- **The records widen nothing**: every rule in `CI-01-L1…L8` cites the authority it restates; where none exists (training / fine-tuning), the rule is stated as the Product Owner's D3 / D9 decision, not as a derived permission.

---

## 8. Validation Impact Census (before execution)

Which existing gates read which files C1 would touch, and what each costs. The rule: a gate runs only when a file in its census changed.

| Gate | Census | Touched by C1? | Cost (local) | Run when |
|---|---|---|---|---|
| `test:task-closure-governance-contract` | top-level `docs/*.md` (H1 with a `T-NN` id → task doc; `**Phase:** I-NN` → Connected Worlds phase record), the backlog, AGENTS.md | **yes** — A1 / A2 are top-level docs. Shape rule: their H1 carries no `T-NN` and their banner is `**Status:**`, never `**Phase:** I-…`; so they are visible to the scan and governed by nothing until a closure claims them | ~2–3 min | after A1 / A2 exist; again at closure |
| `test:forward-safety-contract` | every `tests/*.test.mjs`; the "ceiling" regex scan; the `package.json` / `api-ci.yml` registration check | **yes** — A3 joins `ALL_CONTRACTS`; its pins must not match any ceiling shape (no migration-band enumeration, no gated-job count) | ~3–4 min | after A3 exists; again at closure |
| A3 itself | the files it pins | new | < 5 s | every change |
| Jest `test:api` (`apps/api`) | `apps/api/**` | **no** | — | not run |
| `test:database` verifiers | `database/**` | **no** | — | not run |
| `brain-eval.spec.ts` / `eval:brain:validate` | `apps/api/src/brain-eval/**` | **no** (design only in C1) | — | not run |
| Mobile Jest / native CI | `apps/mobile/**` | **no** | — | not run |
| C1-B recipe | its own scripts + a local PostgreSQL 17 | new | bootstrap ~1–2 min (150 migrations) + run < 1 min; requires local PG17 binaries (present on the 2026-10-09 machine) | once per baseline SHA; re-run only if a fixture or double changes |
| GitHub CI (`api-ci.yml` paths: `apps/api/**`, `database/**`, `tests/**`, `package.json`, …) | — | would trigger on `tests/**` and `package.json` **only when a PR is opened** | one cycle | only on the Product Owner's PR authorization |

**Total proportional cost of C1:** the two governance gates twice, the new contract test, one local synthetic run. Nothing hosted, nothing paid.

---

## 9. Acceptance criteria

1. A1 and A2 exist, cite every claim to a repository path, carry `**Status:**` banners, and mark every conversational text OPEN COPY.
2. A1 states `CI-01-L1…L8` with authority and enforcement per rule, and the three-state evidence distinction exactly as D4 requires, with PG-02 classified as stored-not-usable-pending-re-evaluation.
3. A1's gap register names each gap's current owner and transfers no ownership.
4. A3 passes; `test:task-closure-governance-contract` and `test:forward-safety-contract` pass with A3 in their census; `git diff --check` clean; no secret in the diff.
5. B1–B5 run end-to-end on a disposable local PostgreSQL 17 with the `fetch` guard active, on synthetic accounts, and reproduce the C0 §4.4 findings on the current `main` SHA (any divergence is recorded as a finding, not hidden).
6. `results/<sha>.json` contains only structural yields and states; the README says what they are not (D7).
7. No file under `apps/api/src`, `apps/mobile`, `database/`, `packages/` changed; no migration; no provider key read; no hosted host contacted; no CI run before PR authorization.
8. The closing change performs AGENTS.md §10 in full (§13 below) and moves the two C0 documents and the C1 record to their final banners in the same commit.

---

## 10. Out of scope (closed for C1)

Direction B and C (D8, D9) · any Learning Runtime · PG-02 propagation code · Memory capture / recall code · Arabic trigger repairs · subject marker or third-party screen · any `locale` or directive compiler code · any Mandatory Core / `composeServerGuidance` text change · Interaction Preferences table, UI, save path or migration · Golden-case TypeScript fixtures or rubric code · any `brain-eval` run (`validate`, `dry-run` or paid) · provider selection or binding · Hosted Supabase · GitHub CI before PR authorization · SHARED-VIS-01 banner repair · Matching, Stage 8A, 8B, 9.

---

## 11. Dependencies and risks

| Dependency / risk | Handling |
|---|---|
| Local PostgreSQL 17 binaries for C1-B | present on the 2026-10-09 machine; if absent, C1-B stops and reports (stop condition 3) |
| The governance gate's `PRE_CLOSURE` regex (`CANDIDATE` / `awaiting`) | applies only to tasks the backlog records as closed; CI-01 is not such a task; the new records avoid the word "awaiting" in their banners anyway |
| Forward-safety "ceiling" scan rejecting an over-broad pin | pins are semantic regexes on single facts; no migration-band or workflow-count enumeration |
| Over-pinning volatile code in A3 (e.g. `locale: 'und'`) | intended: the pin forces the C2 slice that changes it to update the record in the same change (the contract pattern used by `prod-retry-01-…`) |
| Drift between C0 §4.4 (run on `5973123`) and C1-B (run on `6a5fa42`) | expected to be nil (0149 / 0150 touch Matching privileges and SQLSTATEs); any difference is a recorded finding |
| The 2026-10-09 recipe lives in a session scratchpad | ported into `scripts/ci-01/`; absolute `E:/…` imports become repository-relative |
| Temptation to fix defects the harness exposes | forbidden in C1 (stop condition 2); each defect maps to a C2 slice (§12) |
| No forward dependency on S6-01, Stage 8A, Hosted Deployment or a Launch Gate | C0 §9; C1 runs entirely before them |

---

## 12. Proposed delivery order

**Inside C1:** C1-A (A1 → A2 → A3, gates) → **stop point** (Product Owner may halt) → C1-B (B1 → B3 → B2 → B4 → B5, local run) → closing change (A4, §13) → Product Owner merge decision.

**After C1 — proposed order of the next slices (proposal only; none is opened by this contract):**
1. **Personal Evidence Truth Maintenance / PG-02** — re-evaluation of derivatives when evidence leaves `ACTIVE`, through the existing Confidence / transition cores; evidence loss ≠ falsity; no Confidence invented (D6-1). First because it strengthens the user's forget / do-not-rely authority and is deterministic.
2. **Memory correction & Arabic acquisition** — duplicate supersession, natural reversal, feminine form, Unicode boundaries, third-party confusion (D6-2/3/4; the subject marker needs a Product decision). Deterministic; measurable by the C1-B recipe.
3. **Interaction Preferences** — the canonical user-owned record designed in annex §4.2 (P4): table, command path, Settings row, export / erasure; anti-dup against W3-MEGA-S and 0128.
4. **Adaptive Conversational Expression** — current-turn language constraint replacing `locale: 'und'`, the constraint compiler and directive rendering inside the existing guidance, the personality text through the Product Copy Gate (P3, P5, P6); a controlled change to the Mandatory Core text under QIR-004 byte accounting.
5. **Golden Conversation model benchmarking — Stage 8A** — the second named `brain-eval` suite with the 20 scenarios and 4 rubric items; `validate` / `dry-run` first, then the paid blinded run on real LLMs; followed by 8B voice carry-over.

Slice 5 of D6 (relevance retrieval review) is folded into the Stage 8A / `QAN-CTX-01` discussion rather than opened as its own slice, to avoid duplicating `QAN-BL-CTX-01`.

---

## 13. Backlog / governance obligations

- **BG-05 at kickoff:** read the backlog in full; record the inherited items in the C1 record: `QAN-BL-CTX-01`, `QAN-BL-CW-02`, `QAN-BL-CW-05`, `QAN-BL-PRIV-01`, `QAN-BL-PRIV-02` (all referenced, none re-owned).
- **BG-08 at closure:** reconcile each inherited item (stays with its owner; the C1 record cites it); admit new qualifying residue if any.
- **Candidate admission (Product Owner decision, §15-3):** PG-02 has no backlog item today. If the Product Owner wants it tracked, C1's closing change admits **`QAN-BL-INTEL-01 — Personal Evidence Invalidation → Derived Understanding Re-evaluation (PG-02)`**, severity `HIGH`, owner the first C2 slice of §12, status `DEFERRED — OWNED`. Admission authorizes no implementation (BG-07).
- **BG-09:** the C1 record's banner reaches its final lifecycle state in the closing change; the two C0 documents' banners move to `C0 CLOSED — decisions recorded; C1 delivered` in the same change.
- **AGENTS.md §10.7:** `npm run test:task-closure-governance-contract` in the closing change.
- **No `### I-0N closure record`**: CI-01 is a task, not a Connected Worlds phase.
- **Locators:** Current State row, Project Map pointer, roadmap §6.5 execution note (status only).

---

## 14. Stop conditions

1. **Before any file:** the Product Owner has not approved this contract explicitly → nothing is written.
2. **A defect is found that tempts a code fix** (capture, recall, PG-02, trigger) → record it in the results and the gap register; do not fix; no `apps/api/src` change.
3. **C1-B cannot run locally** (no PostgreSQL 17, port conflict, migration failure on the disposable cluster) → stop C1-B, report the exact failure, deliver C1-A alone.
4. **A gate fails on a file C1 did not touch** → report; do not repair a predecessor's closure (AGENTS.md §10.6).
5. **Any pin in A3 requires enumerating a migration band or a workflow's job count** → redesign the pin; never weaken the forward-safety scan.
6. **Any need to read `.env`, a hosted host, a provider key or real user rows** → stop; that is outside C1 by construction.
7. **A Product-contract gap appears** (e.g. the subject-marker question, the Interaction Preferences field list) → record it as a decision for the owning slice; do not resolve it in C1.
8. **End of C1-A** → stop point: the Product Owner may halt before C1-B.
9. **Push, PR, CI, merge** → only on the Product Owner's explicit instruction.

---

## 15. Decisions still needed before this contract can be approved

| # | Decision | Recommendation |
|---|---|---|
| 1 | One contract with two sub-slices, or two contracts (§4.4) | **one contract**, stop point after C1-A |
| 2 | May dev-only scripts under `scripts/ci-01/` enter the repository in C1 (they import production services read-only and change none) — or must C1 stay documentation-only with the recipe kept outside the repo? | **allow**: a baseline that cannot be re-run is not a baseline; `scripts/` already hosts dev-only verifiers |
| 3 | Admit `QAN-BL-INTEL-01` (PG-02) to the backlog in the closing change, with the first C2 slice as owner? | **admit**; today PG-02 is named only inside two closure documents |
| 4 | Record file names (`docs/intelligence-evidence-baseline-v1.md`, `docs/conversational-personality-v1.md`) | approve or rename |
| 5 | Whether the 20 Golden scenarios may be written as a validate-only TypeScript fixture in C1 (code under `apps/api/src/brain-eval`, non-runtime) or stay in the design record until the Stage 8A slice | **stay in the record** in C1 (keeps `apps/api/src` untouched); the 8A slice ports them |
| 6 | Whether A4 locator updates are made by C1's closing change or by a Product-Owner-sequenced governance note | **C1 closing change**, status-only wording |

**STOP AT C1 TASK CONTRACT APPROVAL GATE.** No C1 work starts, no production code, no migration, no PR, no GitHub CI, no Hosted Supabase, until the Product Owner approves this contract explicitly.
