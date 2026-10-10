# CI-01 / C1 — Intelligence Evidence & Conversational Personality Baseline — TASK CONTRACT

**Phase:** C1 — BASELINE RECORDS, STATIC CONTRACT, SYNTHETIC RECIPE · **Status:** `TASK CONTRACT — APPROVED WITH MANDATORY AMENDMENTS (Product Owner, 2026-10-10) · C1-A AUTHORIZED AND DELIVERED LOCALLY · C1-B NOT AUTHORIZED (separate gate)` · **Date:** 2026-10-10
**Parent:** [CI-01 C0 Decision Report](QANDEEL_CI_01_C0_DECISION_REPORT_v1.md) (D1–D10 approved with controlled amendments, 2026-10-10) and its [Interaction Style annex](QANDEEL_CI_01_C0_INTERACTION_STYLE_ANNEX_v1.md) (P1–P9).
**Task name (D2):** `CI-01 — Shared Intelligence Learning Evidence & Baseline`. Not `QAN-BL-CI-01` (iOS CI).
**Delivers (C1-A):** [`docs/intelligence-evidence-baseline-v1.md`](../intelligence-evidence-baseline-v1.md) · [`docs/conversational-personality-v1.md`](../conversational-personality-v1.md) · `tests/ci-01-intelligence-evidence-baseline-contract.test.mjs` · backlog item `QAN-BL-INTEL-01`.

> **Approval scope.** The Product Owner approved this contract on 2026-10-10 as *one* contract with two ordered slices and authorized **C1-A only**. C1-B (§4.2) starts only on a further explicit approval after the C1-A Review Gate. The file keeps its historical name (`…_DRAFT_v1.md`) because the Product Owner named it when approving; the banner, not the file name, states the lifecycle. D1–D10 and P1–P9 are inherited unchanged and are not reopened here.

---

## 0. Product Owner decisions on this contract (2026-10-10)

### 0.1 The six decisions (§15 of the draft, now closed)

| # | Decision asked | Decision |
|---|---|---|
| 1 | One contract or two | **One contract, two ordered slices C1-A then C1-B.** A mandatory review point after C1-A. C1-B does not start before the next approval. No separate PR per slice without an approved need. |
| 2 | Dev-only scripts under `scripts/ci-01/` | **Allowed to be designed** for C1-B: dev-only, isolated, re-runnable, bound to no hosted environment. **Not executed now**; the current execution permission covers C1-A only. |
| 3 | Admit `QAN-BL-INTEL-01` for PG-02 | **Approved, severity `HIGH`.** Owner, phased scope and dependencies must be documented; a duplicate-record check precedes the entry. Documentation only; no PG-02 repair starts in C1. |
| 4 | Record file names | **Approved:** `docs/intelligence-evidence-baseline-v1.md` and `docs/conversational-personality-v1.md`. |
| 5 | Golden Conversations | **Stay Design + Evaluation Contract inside C1.** `apps/api/src/brain-eval/` is not modified now. At Stage 8A a second suite may be added inside the same harness to respect the 20–30 bound; no parallel harness. No claim of personality quality before a real-LLM test. |
| 6 | Canonical locators | **Approved for the C1 closing change**, in Current State, Project Map and Product Roadmap, within status and sequencing only. No other Product decision changes; no Release Gate is declared closed; the SHARED-VIS-01 documentary gap is not treated in C1. |

### 0.2 Mandatory Correction 1 — Branch and commit integrity

The draft proposed a C1 branch from `origin/main`, which does not contain the local C0 documents. Corrected procedure, executed before any C1 file was written:

1. Verify `git status`, `HEAD`, `origin/main` (after `git fetch origin main`) and local changes.
2. Create the C1 branch **from the C0 branch head**, so its history contains the approved C0 commits (`8d78384`, `d42995b`) above `6a5fa42`.
3. Lose or replace no file or local change.
4. Verify the commit chain and the diff scope against `origin/main`.
5. No automatic merge, no push.
6. If `main` moved since the last check, examine the effect before acting.

Result recorded in §2.

### 0.3 Mandatory Correction 2 — Local database isolation (binding on C1-B; designed now, executed later)

Accepting `localhost` is **not sufficient**: port forwarding or a misleading local configuration can place a hosted or shared database behind a local port. The C1-B scripts must therefore satisfy all of the following, and the C1-B kickoff may not begin until the design shows each one:

| Rule | Design obligation for `scripts/ci-01/` |
|---|---|
| **Process-owned disposable cluster** | the harness creates its own PostgreSQL cluster (`initdb` into a fresh temp directory, `pg_ctl` on a free port chosen by the harness) or, at minimum, its own database with a harness-generated unique name; it never adopts a pre-existing database by name |
| **Positive identity and ownership proof before any migration or deletion** | before the first `CREATE`, `ALTER`, `DROP` or `TRUNCATE`, the harness proves it is talking to the cluster it created: it reads `inet_server_addr()`, `inet_server_port()`, `current_database()`, `version()` and the `data_directory` setting, and compares them to the values it generated; it also writes and reads back a harness-unique marker (a comment on the database or a one-row marker table) created at bootstrap. Any mismatch is a **STOP**, never a retry on another database |
| **Forbidden sources** | no `DATABASE_URL`, `SUPABASE_*`, `PG*` environment variables or `.env*` files are read; no project secrets file is opened; a `--database-url` style override does not exist |
| **Never drop what the harness did not create** | `DROP DATABASE` / `pg_ctl stop` / directory removal target only the identifiers and paths the harness generated in the current run and recorded in its own manifest |
| **Synthetic accounts only** | every `auth.users` row is created by the harness with synthetic identifiers; no export, dump or fixture derived from a real account enters the cluster |
| **External and paid calls are prevented by construction** | global `fetch` is replaced by a thrower before any production module loads; `http`/`https` request functions are likewise replaced; the Model Router and the three hypothesis providers are replaced by deterministic doubles; **no provider key is read** (the harness unsets `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` in its own process). Enforcement is code, not agreement |
| **Isolation failure = STOP** | any failed proof above ends the run with a non-zero exit and a reason; the harness never falls back to another cluster, database or host |
| **Bounded cleanup** | cleanup removes only the cluster directory, database and temp files the harness created; nothing else on the machine is touched |
| **Repeatability** | each run uses fresh identifiers; two runs may not share a database |

These rules are part of the C1-B acceptance criteria (§9.5). The 2026-10-09 recipe satisfies the `fetch` guard and the synthetic-account rule and does **not** yet satisfy the identity proof, the process-owned cluster rule or the forbidden-sources rule; the port must add them.

### 0.4 Mandatory Correction 3 — No defect pinning

A static contract may freeze **approved rules that must not be crossed** — Ownership, Consent, Safety, Privacy, Provenance, no content leakage, no unauthorized training path. It may **not** turn a current defect or limitation into a contract that blocks its authorized future repair. Concretely, the following are **not** pinned by A3 (they are recorded in the census as a versioned baseline instead):

- `locale: 'und'` in the orchestrator request — the current state, not a value to preserve;
- `GRANT … TO authenticated` on `transition_hypothesis_v2` (`0036`) — the existence of a grant is not an obligation to keep that privilege;
- the absence of any learning mechanism today — no static test may forbid an authorized later development;
- the `brain-eval` 20–30 case bound — must remain changeable by Controlled Change;
- the regex-only Memory capture, the exact-token retrieval, the eight static lines of `BehavioralResponsePolicyService.buildTextGuidance`, the PG-02 behaviour itself.

A3 uses **narrow semantic assertions** on single facts, never broad regexes or whole-file hashes, and strips comments before any negative sweep so that prose about a forbidden thing is not a false positive. The Capability Census in A1 carries a **baseline SHA** and a version; when an authorized repair lands, the repairing task updates the census row, and A3 does not stand in its way.

---

## 1. Objective / user value

**Objective.** Turn the C0 research into repository truth that later intelligence work can be measured against: (a) a canonical, cited record of what QANDEEL's per-user intelligence can do today and under which authority each kind of evidence may be read, learned from or retained; (b) the Product rule set for privacy and learning (D3) and the three-state evidence vocabulary (D4); (c) the approved Conversational Personality v1 design and its adaptation limits (P1–P9) as a design record; (d) in C1-B, a reproducible, provider-free, synthetic harness that measures the structural capabilities named in D7 and stores its results as evidence pinned to a `main` SHA.

**User value.** Indirect but real: every later slice that makes QANDEEL remember, correct, or speak more naturally starts from a measured, honest baseline instead of an impression, and the user's privacy limits are written once as a rule rather than scattered across frozen clauses. No user-visible behaviour changes in C1.

**What C1 is not.** Not a learning runtime, not a model choice, not a Shared or aggregate path (D8, D9), not a personality implementation, not a Settings surface, not a migration.

---

## 2. Canonical baseline

| Item | Value |
|---|---|
| Repository | `allamqandeel/qandeel` |
| `origin/main` | `6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24` (merge of PR #324, PROD-RETRY-01); migrations `0001`–`0150`; `0150` NOT DEPLOYED. Re-fetched 2026-10-10 before branching: unchanged |
| C0 branch | `ci/ci-01-c0-decision-report` = `6a5fa42` → `8d78384` → `d42995b` (local; not pushed; no PR) |
| C1 branch (Correction 1) | `ci/ci-01-c1-intelligence-personality-baseline`, created from `d42995b`; `6a5fa42` verified as ancestor; working tree clean apart from untracked report folders that belong to no task; diff vs `origin/main` before C1 = the three C0 documents only (`A`, `A`, `A`) |
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
- **§0.1 rules of the C0 report** no change to User Ownership, Consent / Privacy, Safety Authority, Evidence Provenance, Memory / HIM scientific boundaries, Confidence semantics, Orchestrator authority, Shared / Public audience constraints, Model Router authority, AI-COST-01, Matching, Hosted Deployment; no LLM choice; no real user data; QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE.

---

## 4. Exact scope

### 4.1 C1-A — Canonical Evidence Baseline (documentation + static checks) — AUTHORIZED

| # | Deliverable | Content | Form |
|---|---|---|---|
| A1 | **`docs/intelligence-evidence-baseline-v1.md`** — *QANDEEL Intelligence Evidence Baseline v1* | the Capability Census (C0 §3.1) as a **versioned baseline** pinned to a `main` SHA, every row cited to a repository path; the Evidence Matrix (C0 §4.1); the eight limits as rule set **`CI-01-L1 … L8`** (D3) each mapped to its existing authority and enforcement; the Readable / Learnable / Retainable classes with the D4 distinction technically stored / currently usable / legitimately retainable (C0 §4.2); the gap register for Direction A with each gap's **current** owner and dependencies (PG-02 → `QAN-BL-INTEL-01`; `QAN-BL-CTX-01` → `QAN-CTX-01`; `QAN-BL-CW-02` → `SHARED-CTX-01`; `QAN-BL-CW-05` → Stage 8A; `QAN-BL-PRIV-01/02` → `PRIV-EXPORT-01`); the Direction B / C closure statement (D8, D9) | new canonical record, top-level `docs/`, `**Status:**` banner |
| A2 | **`docs/conversational-personality-v1.md`** — *QANDEEL Conversational Personality & Interaction Adaptation v1 (design)* | ONE QANDEEL PERSONALITY — ADAPTIVE NATURAL EXPRESSION; the fixed identity; natural adaptation to the user; appropriate humour initiative; respectful disagreement; explicit, editable, revocable preferences; reliance on the LLM's contextual understanding inside the one generation; no rigid Tone Engine or parallel runtime; the Golden Conversation Evaluation Design; the Stage 8A / 8B split; every conversational text **OPEN COPY** until the Product Copy Gate | new design record, top-level `docs/`; **design only** (P9 C1) |
| A3 | **`tests/ci-01-intelligence-evidence-baseline-contract.test.mjs`** | a static contract (file reads only; no database, no network, no `.env`) that pins **only authorities and boundaries** (§0.4): the two records exist with their banners, the rule IDs `CI-01-L1…L8`, the three-state vocabulary, the baseline SHA and the OPEN COPY marking; owner-scoped RLS on `public.memories` (`0004`) and `public.hypotheses` (`0005`); the `0006` Confidence `CHECK`s that keep `numeric_score` / `confidence_band` NULL (the frozen Confidence semantics; a later authorized change arrives as a new migration and updates the record); the `0019` outbox `contains_content = false` CHECK; the Safety `BLOCK` short-circuit in the orchestrator; a comment-stripped negative sweep of `apps/api/src` for fine-tuning / training-job / reward-model identifiers (the unauthorized-training-path rule, `CI-01-L2`); the backlog carries `QAN-BL-INTEL-01` as `HIGH`, `DEFERRED — OWNED`. **Not pinned:** anything in §0.4 | new file; registered as `npm run test:ci-01-intelligence-evidence-baseline-contract` in the root `package.json`; its `api-ci.yml` step is added in the closing change (decision 6: locators and CI wiring belong to closure, and no CI runs before the Product Owner's PR authorization) |
| A4 | **Backlog admission `QAN-BL-INTEL-01`** | *Personal Evidence Invalidation → Derived Understanding Re-evaluation (PG-02)*, `HIGH`, `DEFERRED — OWNED`, owner the first C2 slice (§12 item 1), full §2 schema, anti-duplication check recorded, phased scope and dependencies stated; the §4 index, the §7 counts and a dated reconciliation paragraph | edit to `docs/qandeel-canonical-backlog-v1.md`; documentation only (BG-07) |
| A5 | **Locator updates** (closing change only, decision 6) | one row in `QANDEEL_CURRENT_STATE.md`, one pointer in `QANDEEL_PROJECT_MAP.md`, one execution note in `QANDEEL_PRODUCT_ROADMAP.md` recording that CI-01 C0 / C1 exist and what they do **not** authorize; the backlog mirror table in Current State gains the `QAN-BL-INTEL-01` row | status and sequencing only; no Product semantics; no Release Gate declared closed; SHARED-VIS-01 banners untouched |

### 4.2 C1-B — Synthetic Intelligence Reality Baseline (local, synthetic, provider-free) — NOT AUTHORIZED YET

Design approved (decision 2); execution waits for the Product Owner's approval after the C1-A Review Gate. Every item below is additionally bound by §0.3.

| # | Deliverable | Content | Form |
|---|---|---|---|
| B1 | **`scripts/ci-01/local-db.mjs`** | bootstrap a **process-owned disposable** PostgreSQL 17 cluster (`initdb` into a fresh temp directory, `pg_ctl` on a harness-chosen free port), create a uniquely named database, write the harness marker, run the §0.3 identity proof, then apply `database/migrations/0001…0150` from zero as whole-file batches (the prior recipe did this without `psql`); refuse to proceed on any proof failure | dev-only script; port of the 2026-10-09 recipe (90 lines) + the §0.3 proofs |
| B2 | **`scripts/ci-01/intelligence-reality.ts`** | drive the **real** `ConversationOrchestratorService`, Memory, Evidence, Hypothesis, Confidence, Question and HIM services with deterministic doubles for the Model Router, the three hypothesis providers and Redis; **global `fetch` and `http`/`https` requests replaced by throwers** before production modules load; provider keys unset in-process; synthetic accounts created by the script itself; scenarios N1, K1, C1, P1, F1, H1, M1/X1 and the isolation controls (C0 §4.4) read from fixture files; emits only the structural yields of D7 — capture yield, recall, truth maintenance (stale after reversal / duplicate after correction / hypothesis after forget), privacy isolation (cross-user retrieval = 0, telemetry content = none), cost-ledger shape (rows without content) | dev-only script; port of the 2026-10-09 `s601-reality.ts` (445 lines) + `pg-fg-adapters.ts` (312 lines); imports production services read-only; **modifies none** |
| B3 | **`scripts/ci-01/fixtures/*.json`** | the synthetic Arabic / English statements per scenario — synthetic persons, no real names or data | fixtures |
| B4 | **`scripts/ci-01/results/<main-sha>.json`** + `scripts/ci-01/README.md` | the recorded yields for the then-current `main`, with the recipe's exact command, PostgreSQL version, double versions and the §0.3 proof outputs (host, port, data directory, marker); the README states what the numbers are **not** (D7) | evidence files |
| B5 | `npm run verify:ci-01:intelligence-reality:local` | one script entry; **never** added to any CI workflow | `package.json` script |

### 4.3 What enters neither slice
Any change under `apps/api/src`, `apps/mobile`, `database/migrations`, `packages`; any provider key or binding; any Golden-case TypeScript fixture inside `apps/api/src/brain-eval` (decision 5); any repair of the SHARED-VIS-01 banners (D10); any PG-02 repair (decision 3).

### 4.4 One contract, two slices (decided)
One contract, two ordered slices, one closing change; a mandatory Review Gate after C1-A; C1-B on a further explicit approval; no separate PR per slice without an approved need.

---

## 5. Anti-duplication matrix

| C1 adds | Existing thing checked | Verdict |
|---|---|---|
| Evidence Baseline record | `docs/intelligence-evidence-layer-v1.md` (the Evidence projection contract), `docs/confidence-runtime-v1.md`, QIR-008 closure | different purpose: those freeze runtime semantics; the baseline records *measured capability and authority per evidence kind* and changes none of them |
| Rule set `CI-01-L1…L8` | Foundation Freeze privacy clauses, QHIA non-inference, CW2-08 §2 / §42, CW2-08A, PO-OPS-03, correlation-telemetry doc | the rule set **cites** each; it adds the one missing explicit statement ("no training / fine-tuning on private conversations without explicit approved consent") and widens nothing (D3) |
| Three-state evidence vocabulary | 0128 FORGET semantics, F05 lineage erasure, W3-MEGA-U §5 PG-02 | vocabulary over existing behaviours; no new deletion rule (D4) |
| `QAN-BL-INTEL-01` | backlog index and items (grep `PG-02`, `invalidation`, `propagation`, `re-evaluation`): no item names PG-02; `QAN-BL-CTX-01` is relevance, `QAN-BL-PRIV-01/02` are export completeness, `QAN-BL-CW-02` is Shared context; PG-02 is named only in frozen I-08A4 §18, P1 closure §11 / §18, W3-MEGA-U record §5 and Current State :360 / :468 as an open gap with no owner | **admit once**, no alias |
| Static contract test | 96 `tests/*-contract.test.mjs`; `prod-retry-01-…`, `integrated-intelligence-runtime-contract`, `human-intelligence-provider-semantics-consolidation-contract`, `w3-mega-m-conversational-memory-control-contract` | same pattern; new pins only on facts no other contract pins in the same form |
| Synthetic harness (C1-B) | `verify:full-intelligence-e2e-runtime`, `verify:integrated-brain:e2e-hardening-v2`, `verify:a2-e2e-runtime-smoke` (all need `.env` / running infrastructure and are runtime smokes), `brain-eval` (paid provider bake-off) | none measures capture yield / recall / truth maintenance on fixtures with doubles against a disposable local database; the 2026-10-09 recipe is the only prior art and is being **ported** (C0 anti-dup 7) |
| Personality design record | Behavioral Runtime v1.0 spec, VI-01 register, `BehavioralResponsePolicyService` | the record is the Product personality the spec asked for ("Personality" named as an ABS capability with no contract); it changes no spec and no code |
| Interaction Preferences design | Memory `INTERACTION_PREFERENCE`, W3-MEGA-S General Settings, 0128 commands | design only; the later slice must prove non-duplication against these three before building |
| Golden Conversation suite design | `apps/api/src/brain-eval` 24-case suite and 9-item rubric | extension design (second named suite at 8A), not a second harness (P8, decision 5) |

---

## 6. Files and modules affected

**C1-A added:** `docs/intelligence-evidence-baseline-v1.md` · `docs/conversational-personality-v1.md` · `tests/ci-01-intelligence-evidence-baseline-contract.test.mjs`.
**C1-A edited (minimal):** `docs/qandeel-canonical-backlog-v1.md` (index row, item, §7 counts, reconciliation paragraph) · `package.json` (one script entry) · this contract (banner, §0) · the two C0 documents (banner: C1-A delivered).
**C1-B would add (not now):** `scripts/ci-01/{local-db.mjs, intelligence-reality.ts, README.md, fixtures/*.json, results/<sha>.json}` · `package.json` (one script entry).
**Closing change only:** `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md`, `.github/workflows/api-ci.yml` (one `run:` line for A3), final banners.
**Read, never written:** everything under `apps/api/src`, `database/`, `apps/mobile`, `packages/`, `docs/implementation-foundation/`.

---

## 7. Data and privacy boundaries

- **No real user data.** C1-A reads source files only. C1-B creates its own synthetic accounts in a process-owned disposable cluster and destroys only that cluster at the end; fixtures contain invented statements only.
- **No hosted connection.** §0.3 in full: process-owned cluster, positive identity proof, no `DATABASE_URL` / `SUPABASE_*` / `PG*` / `.env*` read, STOP on any proof failure.
- **No provider.** Global `fetch` and `http`/`https` throw; provider keys unset in-process; the doubles return fixed, content-free structures.
- **No content in evidence files.** `results/<sha>.json` stores counts, ids and states — never a synthetic transcript verbatim beyond the fixture file that already holds it.
- **No telemetry change, no ledger change**; the harness asserts the existing content-free shapes.
- **No human review of private conversations** anywhere in C1 (CW2-08A); reviewers see synthetic cases only.
- **The records widen nothing**: every rule in `CI-01-L1…L8` cites the authority it restates; where none exists (training / fine-tuning), the rule is stated as the Product Owner's D3 / D9 decision, not as a derived permission.

---

## 8. Validation Impact Census

The rule: a gate runs only when a file in its census changed. Census re-checked against the files C1-A actually touched.

| Gate | Census | Touched by C1-A? | Cost (local) | Decision |
|---|---|---|---|---|
| A3 itself | the files it pins | new | < 5 s | **run** |
| `test:task-closure-governance-contract` | top-level `docs/*.md` (H1 with a `T-NN` id → task doc; `**Phase:** I-NN` → phase record), the backlog, AGENTS.md | **yes** — A1 / A2 are top-level docs (carrying `**Status:**`, no `T-NN`, no `**Phase:** I-…`, so visible but ungoverned) and the backlog changed | ~2–3 min | **run** |
| `test:forward-safety-contract` | every `tests/*.test.mjs` (the new contract joins `ALL_CONTRACTS` and is executed inside the mirror), the ceiling scan, `package.json` | **yes** — A3 and `package.json` | ~3–5 min | **run** |
| `test:prod-retry-01-data-api-stale-state-contract` | pins backlog rows `QAN-BL-PROD-06/07` | backlog edited (rows added, none changed) | < 5 s | **run** (cheap; confirms the rows it pins are intact) |
| `git diff --check`; secret / unintended-change scan of the diff | the diff | yes | seconds | **run** |
| Jest `test:api` (`apps/api`) | `apps/api/**` | **no** | — | not run |
| `test:database` verifiers | `database/**` | **no** | — | not run |
| `brain-eval.spec.ts` / `eval:brain:validate` | `apps/api/src/brain-eval/**` | **no** (decision 5) | — | not run |
| Mobile Jest / native CI | `apps/mobile/**` | **no** | — | not run |
| GitHub CI | PR only | — | — | not run (no PR) |
| C1-B recipe | its own scripts + local PostgreSQL 17 | not in C1-A | — | not run |

### 8.1 Results — C1-A (2026-10-10, branch `ci/ci-01-c1-intelligence-personality-baseline`, tested on the working tree that became the C1-A commit)

| Gate | Result |
|---|---|
| `test:ci-01-intelligence-evidence-baseline-contract` | **12 / 12 PASS** |
| `test:task-closure-governance-contract` | **24 / 24 PASS** |
| `test:prod-retry-01-data-api-stale-state-contract` | **9 / 9 PASS** (the backlog rows it pins are intact) |
| `test:forward-safety-contract` | **25 / 35 — 10 FAIL, none caused by C1-A.** Every failure is the same child assertion inside the mirror: `qan-inf-03-deterministic-expo-dependency-validation-contract` → "expo install --check and expo-doctor both pass deterministically, offline, on the committed baseline" (`npm explain` exits non-zero for `@unimodules/react-native-adapter`, `expo-cli`, `@expo/vector-icons` under `doctor:mobile`). Run directly against the real repository it fails the same way (5 / 6). It lives in `apps/mobile` tooling / local `node_modules` state that C1-A did not touch. The CI-01 contract appears in no failure line, so it survives every mirror mutation. **Stop condition 5:** reported, not repaired. |
| `git diff --check` | clean |
| secret scan of the diff | no secret-shaped string |
| not run | Jest API, database verifiers, `brain-eval`, Mobile Jest / native CI, GitHub CI, C1-B recipe — no file in their census changed |

---

## 9. Acceptance criteria

1. A1 and A2 exist, cite every claim to a repository path, carry `**Status:**` banners, state the baseline SHA, and mark every conversational text OPEN COPY.
2. A1 states `CI-01-L1…L8` with authority and enforcement per rule, and the three-state evidence distinction exactly as D4 requires, with PG-02 classified as technically stored without currently usable, pending re-evaluation.
3. A1's gap register names each gap's current owner and dependencies and transfers no ownership; PG-02's owner is the `QAN-BL-INTEL-01` owner task.
4. A3 passes; A3 pins no §0.4 item; `test:task-closure-governance-contract` and `test:forward-safety-contract` pass with A3 in their census; `git diff --check` clean; no secret in the diff.
5. **(C1-B)** B1–B5 run end-to-end on a process-owned disposable PostgreSQL 17 with every §0.3 proof passing and recorded, the `fetch` / `http` guards active, on synthetic accounts, and reproduce the C0 §4.4 findings on the current `main` SHA (any divergence is recorded as a finding, not hidden).
6. **(C1-B)** `results/<sha>.json` contains only structural yields, states and the isolation proof outputs; the README says what they are not (D7).
7. No file under `apps/api/src`, `apps/mobile`, `database/`, `packages/` changed; no migration; no provider key read; no hosted host contacted; no CI run before PR authorization.
8. The closing change performs AGENTS.md §10 in full (§13) and moves the two C0 documents and this contract to their final banners in the same commit.
9. `C1-A PASS` is **not** `C1 MERGED`.

---

## 10. Out of scope (closed for C1)

Direction B and C (D8, D9) · any Learning Runtime · PG-02 propagation code · Memory capture / recall code · Arabic trigger repairs · subject marker or third-party screen · any `locale` or directive compiler code · any Mandatory Core / `composeServerGuidance` text change · HIM, Memory, Behavioral Runtime or Model Router changes · Interaction Preferences table, UI, save path or migration · Golden-case TypeScript fixtures or rubric code · any `brain-eval` run (`validate`, `dry-run` or paid) or production `brain-eval` change · provider / LLM selection or binding · Hosted Supabase / Hosted Deployment · GitHub CI before PR authorization · PR / Push / Merge · SHARED-VIS-01 banner repair · real user data · Matching, Stage 8A, 8B, 9.

---

## 11. Dependencies and risks

| Dependency / risk | Handling |
|---|---|
| Local PostgreSQL 17 binaries for C1-B | present on the 2026-10-09 machine; if absent, C1-B stops and reports (stop condition 3) |
| A local port that forwards to a non-local database | §0.3 identity proof (server address, port, data directory, marker) — STOP on mismatch |
| The governance gate's `PRE_CLOSURE` regex (`CANDIDATE` / `awaiting`) | applies only to tasks the backlog records as closed; CI-01 is not such a task; the new records avoid both words in their banners anyway |
| Forward-safety ceiling scan rejecting an over-broad pin | pins are semantic regexes on single facts; no migration-band or workflow-count enumeration |
| A3 pinning a defect (§0.4) | forbidden; the census records it instead; reviewed line by line at the C1-A Review Gate |
| Drift between C0 §4.4 (run on `5973123`) and C1-B (run on the then-current `main`) | expected to be nil; any difference is a recorded finding |
| Temptation to fix defects the records or harness expose | forbidden in C1 (stop condition 2); each defect maps to a C2 slice (§12) |
| No forward dependency on S6-01, Stage 8A, Hosted Deployment or a Launch Gate | C0 §9; C1 runs entirely before them |

---

## 12. Delivery order

**Inside C1:** C1-A (A1 → A2 → A3 → A4, gates) → **C1-A Review Gate (Product Owner)** → C1-B (B1 → B3 → B2 → B4 → B5, local run under §0.3) → closing change (A5, §13) → Product Owner merge decision.

**After C1 — order of the next slices (proposal only; none is opened by this contract):**
1. **Personal Evidence Truth Maintenance / PG-02** (`QAN-BL-INTEL-01`, owner task `INTEL-TM-01`) — re-evaluation of derivatives when evidence leaves `ACTIVE`, through the existing Confidence / transition cores; evidence loss ≠ falsity; no Confidence invented (D6-1).
2. **Memory correction & Arabic acquisition** — duplicate supersession, natural reversal, feminine form, Unicode boundaries, third-party confusion (D6-2/3/4; the subject marker needs a Product decision).
3. **Interaction Preferences** — the canonical user-owned record designed in A2 §5 (P4): table, command path, Settings row, export / erasure; anti-dup against W3-MEGA-S and 0128.
4. **Adaptive Conversational Expression** — current-turn language constraint replacing `locale: 'und'`, the constraint compiler and directive rendering inside the existing guidance, the personality text through the Product Copy Gate (P3, P5, P6); a controlled change to the Mandatory Core text under QIR-004 byte accounting.
5. **Golden Conversation model benchmarking — Stage 8A** — the second named `brain-eval` suite with the 20 scenarios and 4 rubric items; `validate` / `dry-run` first, then the paid blinded run on real LLMs; followed by 8B voice carry-over.

Slice 5 of D6 (relevance retrieval review) is folded into the Stage 8A / `QAN-CTX-01` discussion rather than opened as its own slice, to avoid duplicating `QAN-BL-CTX-01`.

---

## 13. Backlog / governance obligations

- **BG-05 at kickoff (done in C1-A):** backlog read in full; no item names CI-01 as owner; referenced items `QAN-BL-CTX-01`, `QAN-BL-CW-02`, `QAN-BL-CW-05`, `QAN-BL-PRIV-01`, `QAN-BL-PRIV-02` are cited in A1's gap register, none re-owned.
- **Admission in C1-A (decision 3):** `QAN-BL-INTEL-01 — Personal Evidence Invalidation → Derived Understanding Re-evaluation (PG-02)`, `HIGH`, `DEFERRED — OWNED`, owner `INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02)` (the first C2 slice of §12). Admission authorizes no implementation (BG-07).
- **BG-08 at closure:** reconcile each referenced item (stays with its owner); admit new qualifying residue if any.
- **BG-09:** this contract's banner and the two C0 documents' banners reach their final lifecycle state in the closing change.
- **AGENTS.md §10.7:** `npm run test:task-closure-governance-contract` in the closing change (and already in C1-A, because the backlog and top-level docs changed).
- **No `### I-0N closure record`**: CI-01 is a task, not a Connected Worlds phase.
- **Locators (decision 6):** closing change only; status and sequencing wording.

---

## 14. Stop conditions

1. **Before any C1-B file:** the Product Owner has not approved C1-B explicitly → nothing under `scripts/ci-01/` is written.
2. **A defect is found that tempts a code fix** (capture, recall, PG-02, trigger) → record it in the census / gap register; do not fix; no `apps/api/src` change.
3. **C1-B cannot run locally** (no PostgreSQL 17, port conflict, migration failure on the disposable cluster) → stop C1-B, report the exact failure.
4. **Any §0.3 isolation proof fails** → STOP with the reason; no retry on another database, host or cluster.
5. **A gate fails on a file C1 did not touch** → report; do not repair a predecessor's closure (AGENTS.md §10.6).
6. **Any pin in A3 would freeze a §0.4 item or require enumerating a migration band or a workflow's job count** → redesign the pin; never weaken the forward-safety scan.
7. **Any need to read `.env`, a hosted host, a provider key or real user rows** → stop; that is outside C1 by construction.
8. **A Product-contract gap appears** (e.g. the subject-marker question, the Interaction Preferences field list) → record it as a decision for the owning slice; do not resolve it in C1.
9. **End of C1-A** → C1-A Review Gate: the Product Owner reviews before C1-B.
10. **Push, PR, CI, merge** → only on the Product Owner's explicit instruction.

---

## 15. Decisions (closed 2026-10-10)

The six decisions of the draft are closed in §0.1. No decision blocks C1-A. **C1-B** waits for one decision only: the Product Owner's explicit go after the C1-A Review Gate, with §0.3 as its acceptance basis.

**STOP AT C1-A REVIEW GATE.** C1-B does not start, no production code, no migration, no PR, no GitHub CI, no Hosted Supabase, until the Product Owner reviews C1-A and approves C1-B explicitly.
