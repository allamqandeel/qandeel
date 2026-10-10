# CI-01 / C1 — Intelligence Evidence & Conversational Personality Baseline — TASK CONTRACT

**Phase:** C1 — BASELINE RECORDS, STATIC CONTRACT, SYNTHETIC RECIPE · **Status:** `TASK CONTRACT — APPROVED WITH MANDATORY AMENDMENTS (Product Owner, 2026-10-10) · C1-A CONDITIONALLY ACCEPTED · C1-B ACCEPTED FOR LOCAL BASELINE DELIVERY · C1 CLOSING CHANGE DELIVERED (2026-10-10) · DRAFT PR #325 OPEN · API / MOBILE CI VERIFIED GREEN ON a99a1b2 · REVIEW CORRECTION (§17) PENDING EXACT-HEAD VALIDATION · NOT MERGED · AT FINAL PR REVIEW GATE` · **Date:** 2026-10-10
**Parent:** [CI-01 C0 Decision Report](QANDEEL_CI_01_C0_DECISION_REPORT_v1.md) (D1–D10 approved with controlled amendments, 2026-10-10) and its [Interaction Style annex](QANDEEL_CI_01_C0_INTERACTION_STYLE_ANNEX_v1.md) (P1–P9).
**Task name (D2):** `CI-01 — Shared Intelligence Learning Evidence & Baseline`. Not `QAN-BL-CI-01` (iOS CI).
**Delivers (C1-A):** [`docs/intelligence-evidence-baseline-v1.md`](../intelligence-evidence-baseline-v1.md) · [`docs/conversational-personality-v1.md`](../conversational-personality-v1.md) · `tests/ci-01-intelligence-evidence-baseline-contract.test.mjs` · backlog item `QAN-BL-INTEL-01`.
**Delivers (C1-B):** [`scripts/ci-01/`](../../scripts/ci-01/README.md) — `local-db.mjs`, `network-guard.cjs`, `intelligence-reality.ts`, `fixtures/*.json`, `results/6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24.json`, `README.md` · `npm run verify:ci-01:intelligence-reality:local` · four C1-B authority pins in the static contract.

> **Approval scope.** The Product Owner approved this contract on 2026-10-10 as *one* contract with two ordered slices and authorized **C1-A only**; after the C1-A Review Gate (same day) C1-A was **conditionally accepted** and **C1-B authorized** with the scope and limits recorded in §0.5. Both slices are delivered locally. After the C1-B Review Gate the Product Owner authorized the closing change **locally only** (§0.6); it was pushed as Draft PR #325 (head `a99a1b2`, API CI and Mobile CI green on that head), and the Product Owner then authorized one limited review correction (§17), whose head is pending exact-head validation. Four lifecycle states stay apart: C0 Product decisions approved; C1 delivered; C1 verified on GitHub (on `a99a1b2`; the corrected head pending); C1 merged into `main` (not yet). The file keeps its historical name (`…_DRAFT_v1.md`) because the Product Owner named it when approving; the banner, not the file name, states the lifecycle. D1–D10 and P1–P9 are inherited unchanged and are not reopened here.

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

### 0.3 Mandatory Correction 2 — Local database isolation (binding on C1-B; designed in C1-A, executed and proven in C1-B — §8.2)

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

### 0.5 C1-B authorization (Product Owner, 2026-10-10, after the C1-A Review Gate)

**Decision:** C1-A CONDITIONALLY ACCEPTED; C1-B AUTHORIZED NOW; Push / PR / Merge NOT AUTHORIZED. Binding terms, all met by the delivery recorded in §8.2:

| # | Term | How C1-B met it |
|---|---|---|
| 1 | verify Git status and the C0 / C1-A commit chain first; do not re-execute or reopen C1-A | chain `6a5fa42 → 8d78384 → d42995b → 4bf2e68` verified, tree clean, `origin/main` unchanged; no C1-A file re-opened (the static contract gained four C1-B pins only) |
| 2 | exactly the §4.2 outputs; reuse the 2026-10-09 recipe; real production services with deterministic doubles; no production / router / Memory / HIM / Confidence / migration change | B1–B5 delivered plus one preload file the guard needs (`network-guard.cjs`, listed in §4.2); `apps/`, `database/`, `packages/` untouched (recorded in the results as `productionTreeIdenticalToBaseline`) |
| 3 | PostgreSQL isolation as §0.3, with a **positive** identity proof, a dedicated port, no inherited env, no real data or keys, cleanup only of harness-created resources, external calls blocked **by code**, STOP on any failure | implemented in `local-db.mjs` + `network-guard.cjs` + the driver's own re-proof; details in [`scripts/ci-01/README.md`](../../scripts/ci-01/README.md) §4 and the recorded proofs in the results file |
| 4 | re-measure N1, K1, C1, P1, F1, H1, M1 / X1 and the controls; record real results even when bad; **no repair during measurement**; no fixture tuning; separate run success from capability from defects from deferred gaps | §8.2 and README §6; fixtures carry the 2026-10-09 texts verbatim and define measurements, never expected values |
| 5 | keep the forward-safety failure record; separate environment failure from CI-01 changes; name a follow-up path at C1 closing; no gratuitous re-run; treat a new C1-B-related failure in scope | §8.2 row for `test:forward-safety-contract`; follow-up path recorded in §13 |
| 6 | Validation Impact Census before running; proportional validation; no Full API / Mobile / Hosted CI | §8 (C1-B column) and §8.2 |
| 7 | nothing from the forbidden list (Memory / PG-02 repair, HIM / Confidence, Behavioral Runtime, Interaction Preferences UI / DB, brain-eval, LLM choice, hosted Supabase, locators describing C1 as complete, Push / PR / Merge) | none touched; locators unchanged |
| 8 | ten-item report, then **STOP AT C1-B REVIEW GATE** | delivered with the local commit |

---

### 0.6 Closing change (Product Owner, 2026-10-10, after the C1-B Review Gate — "CLOSING CHANGE AUTHORIZED — LOCAL ONLY")

| Decision | Ruling | Where it is executed |
|---|---|---|
| 1 — Network guard | `scripts/ci-01/network-guard.cjs` is accepted as part of C1-B: the guard must load before production modules and ts-node. No new transport, no parallel test structure | §4.2; [`scripts/ci-01/README.md`](../../scripts/ci-01/README.md) §4 |
| 2 — `0029` / `0033` durable result content | record a data-retention review, not a production fix; distinguish historical authorized storage from a current unauthorized use; no change to `0029`, `0033` or `0130` | baseline §5.3 / §6; backlog `QAN-BL-INTEL-02` (`VALIDATION — OPEN`); §16 |
| 3 — `QAN-INF-03` follow-up | keep both forward-safety results (25 / 35 at C1-A, 35 / 35 at C1-B); the later pass proves no cause and no fix; link to an existing owner or admit one item, no duplicate; no change to Mobile dependencies, Expo Doctor or the `QAN-INF-03` contract | backlog `QAN-BL-CI-02` (`VALIDATION — OPEN`); §16 |
| 4 — Closing-change scope | documentation, the `api-ci.yml` registration of the static contract and the locators; no production change | §16 |
| RLS evidence clarification | prove owner-can-read **and** non-owner-cannot-read on synthetic data; a zero from a case with nothing readable is not isolation; one focused check inside the existing harness if missing; no RLS policy or migration change | §16.1 |

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

### 4.2 C1-B — Synthetic Intelligence Reality Baseline (local, synthetic, provider-free) — AUTHORIZED 2026-10-10 · DELIVERED LOCALLY

Design approved (decision 2); execution authorized by the Product Owner after the C1-A Review Gate (§0.5) and delivered the same day (§8.2). Every item below is additionally bound by §0.3. One file was added to the list below because the guard cannot be installed from inside the driver: **`scripts/ci-01/network-guard.cjs`**, the `node --require` preload that scrubs inherited environment and replaces every outbound transport with a thrower before ts-node or any production module loads (§0.3 "by code, not by agreement").

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

**C1-B census (2026-10-10).** Files touched by C1-B: `scripts/ci-01/**` (new), `package.json` (one script), `tests/ci-01-intelligence-evidence-baseline-contract.test.mjs` (four pins), this contract. Therefore: the CI-01 contract **runs**; `test:forward-safety-contract` **runs** (its census includes every `tests/*.test.mjs`, `package.json` and the mirrored `scripts/`); the harness itself **runs once** on a fresh process-owned cluster through the one npm script; `git diff --check` and the secret / unintended-change scan **run**. Not affected, not run: `test:task-closure-governance-contract` (its census — top-level `docs/*.md`, the backlog, `AGENTS.md` — did not change in C1-B), `test:prod-retry-01-…` (backlog unchanged), Jest API, database verifiers, `brain-eval`, Mobile, GitHub CI.

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

### 8.2 Results — C1-B (2026-10-10, same branch, tested on the working tree that became the C1-B commit)

**Harness run** (`npm run verify:ci-01:intelligence-reality:local`, `QANDEEL_CI01_PG_BIN` → PostgreSQL 17.10 binaries): `RUN_COMPLETE`; fresh cluster on `127.0.0.1:53586` → identity proof passed in the parent (9 checks) and again in the driver (8 checks); 150 migrations applied from zero in 5.2 s; 8 scenarios, 10 synthetic users, 15 sessions, 47 user turns, 43 router-double calls, 2 intent + 2 candidate double calls; network-guard self-test 14 / 14 probes blocked, 0 outbound attempts during the run; cluster stopped and its `mkdtemp` directory removed; total 18 s. Results: `scripts/ci-01/results/6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24.json` (`productionTreeIdenticalToBaseline: true`). The run was executed three times while the harness was being finished (two development iterations against a started cluster, then the recorded baseline, then one regeneration after the ledger surface was given a per-effect-key breakdown); every scenario summary was identical across the three. Inherited variables the harness deleted before running (names only): `ANTHROPIC_BASE_URL`, `npm_config_noproxy`.

**Separation the Product Owner required:**

| Layer | Result |
|---|---|
| run success | the harness executed every fixture step and every control without a harness failure |
| capabilities that worked | anchored Memory capture (`أنا بحب` / `هدفي` / `قررت` / `أنا بفضل` / `انا ساكن…`) and the explicit-remember path; exact-token recall; explicit correction superseding v1; FORGET → `DELETED` and DO-NOT-RELY → `DISABLED` honoured at retrieval (0 / 2 forgotten items served); contradiction trigger → background generation completed when the semantic chain exists; HIM seeded measurement consumed within its session (`PARTIAL`, 3 instruction IDs); RLS + retriever isolation (0 / 0 / 0); telemetry content-free (0 / 12 214 strings); outbox `contains_content` 0 / 47 |
| defects the test proved (recorded, not repaired) | N1 natural value statements 0 / 4 captured; feminine «ساكنة» stored as masculine «ساكن»; recall misses on inflection / paraphrase (K1 1 / 4, N1 0 / 2); natural reversal leaves the stale preference served (2 / 3 probes) and a restatement leaves 1 duplicate ACTIVE pair after the explicit correction; a third-party fact becomes the user's `PERSONAL_FACT` through explicit remember (no subject marker); **PG-02** — 1 hypothesis stays `ACTIVE` over `DELETED` / `DISABLED` evidence and is injected in 2 / 2 new-session turns; HIM organically `EMPTY` and the seeded value does not reach the next session; «ليه أنا دايما…» classified `GENERIC_QUESTION` (recurring-pattern trigger does not fire); «بسهر» fires the contradiction trigger |
| deferred to C2 / other owners | PG-02 → `QAN-BL-INTEL-01` / `INTEL-TM-01` (admitted in C1-A); Memory correction & Arabic acquisition, subject marker, trigger precision → proposed C2 slices (§12); HIM capture surface → HIM owners; **new documentary item** — `post_response_intelligence_effects.result_payload` (0029 / 0033) durably stores an extractive span of the user's own turn and the candidate statements on the service-role-only ledger (2 + 2 rows here): not telemetry, not a defect pin, a retention question for the ledger's owner, to be added to the baseline census at the closing change |

**Gates:**

| Gate | Result |
|---|---|
| `test:ci-01-intelligence-evidence-baseline-contract` | **16 / 16 PASS** (12 C1-A + 4 C1-B authority pins: dev-only script never in a workflow and never a dotenv read; guard scrubs + preload; positive proof before read / write / removal, no `DROP DATABASE`, explicit loopback parameters; the committed results record passed proofs, a fully blocked guard and intact isolation — no yield is pinned) |
| `test:forward-safety-contract` | **35 / 35 PASS** on the final C1-B tree (every `tests/*.test.mjs` executed inside the mirror under every mutation, the CI-01 contract among them). The 10 `qan-inf-03` / expo-doctor child failures recorded in §8.1 **did not reproduce**: run directly, `qan-inf-03-deterministic-expo-dependency-validation-contract` now passes 6 / 6. CI-01 changed nothing under `apps/mobile`, `node_modules` or that contract between the two runs, so the §8.1 failure was environment-dependent (non-deterministic `npm explain` under `doctor:mobile`); cause not identified. The §8.1 record stays as written; the non-reproduction is itself the evidence for the §13 follow-up. |
| `git diff --check` | clean (staged C1-B diff: 17 files, +4 849 / −8, only `scripts/ci-01/**`, `package.json`, the CI-01 contract test and this contract) |
| secret scan of the diff | no secret-shaped string (key / token / JWT / connection-URL / private-key patterns) in any added line; the only password in the harness is the per-run random one written inside the process-owned temp directory and removed with it |
| harness self-controls | isolation holds; telemetry 0 content hits; outbox 0; executions 0; `ai_provider_calls` 0 rows; ledger content reported separately (above) |
| not run | `test:task-closure-governance-contract` (census unchanged), `test:prod-retry-01-…` (backlog unchanged), Jest API, database verifiers, `brain-eval`, Mobile, GitHub CI — no file in their census changed |

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
- **BG-08 at closure — done in the local closing change (2026-10-10):** every referenced item stays with its owner, unchanged; `QAN-BL-INTEL-01` unchanged; admitted `QAN-BL-INTEL-02` and `QAN-BL-CI-02` (`VALIDATION — OPEN`, Product Owner closing decisions 2 and 3); the register holds 54 items (backlog §7, "CI-01 C1 closure reconciliation").
- **BG-09 — done for the local state:** this contract, the two C0 documents, both C1-A records and the harness README read `C1 LOCAL CLOSURE PREPARED — NOT PUSHED · NOT VERIFIED ON GITHUB · NOT MERGED` at the local closing change, and the §17 review correction moved them to `DRAFT PR #325 OPEN · … · NOT MERGED`. `CLOSED` and `MERGED` are not used before a verified GitHub run and the actual merge (Product Owner closing instruction §5).
- **AGENTS.md §10.7:** `npm run test:task-closure-governance-contract` in the closing change (and already in C1-A, because the backlog and top-level docs changed).
- **No `### I-0N closure record`**: CI-01 is a task, not a Connected Worlds phase.
- **Locators (decision 6) — done:** Current State (§1, §3.7 row, §4, §5 mirror recounted to 54, §7), Project Map (§5 checkpoint note) and Product Roadmap (§6.5), status and sequencing wording only.

---

**Follow-up path for the forward-safety failure (Product Owner, C1-B term 5).** The 10 failing children of `test:forward-safety-contract` seen at C1-A were one assertion of `qan-inf-03-deterministic-expo-dependency-validation-contract` (`npm explain` of three Expo packages under `doctor:mobile`) that failed identically on the real tree that day and **passed 35 / 35 and 6 / 6 at C1-B without any change to its inputs** (§8.2): an environment-dependent, non-deterministic failure of a contract whose claim is determinism — an `apps/mobile` tooling / local `node_modules` matter outside CI-01's census. At the closing change CI-01 records it in the backlog under its existing owner line (`QAN-INF-03`) as a validation finding with the evidence from §8.1 / §8.2, or re-owns it to the mobile-infrastructure task the Product Owner names; CI-01 itself does not touch `apps/mobile`, QAN-INF-03 or the forward-safety contract. **Executed at the closing change:** `QAN-INF-03` has no backlog item and no active owner, so the follow-up is admitted as `QAN-BL-CI-02` (`VALIDATION — OPEN`, owner `QAN-INF-06`, PO-APPROVED). The §8.1 and §8.2 results both stay as written.

## 14. Stop conditions

1. **Before any C1-B file:** the Product Owner has not approved C1-B explicitly → nothing under `scripts/ci-01/` is written.
2. **A defect is found that tempts a code fix** (capture, recall, PG-02, trigger) → record it in the census / gap register; do not fix; no `apps/api/src` change.
3. **C1-B cannot run locally** (no PostgreSQL 17, port conflict, migration failure on the disposable cluster) → stop C1-B, report the exact failure.
4. **Any §0.3 isolation proof fails** → STOP with the reason; no retry on another database, host or cluster.
5. **A gate fails on a file C1 did not touch** → report; do not repair a predecessor's closure (AGENTS.md §10.6).
6. **Any pin in A3 would freeze a §0.4 item or require enumerating a migration band or a workflow's job count** → redesign the pin; never weaken the forward-safety scan.
7. **Any need to read `.env`, a hosted host, a provider key or real user rows** → stop; that is outside C1 by construction.
8. **A Product-contract gap appears** (e.g. the subject-marker question, the Interaction Preferences field list) → record it as a decision for the owning slice; do not resolve it in C1.
9. **End of C1-A** → C1-A Review Gate (passed 2026-10-10, conditional acceptance); **end of C1-B** → C1-B Review Gate (passed 2026-10-10; closing change authorized local only); **end of the closing change** → Local C1 Closure Review Gate: the Product Owner reviews before any push, PR or merge.
10. **Push, PR, CI, merge** → only on the Product Owner's explicit instruction.

---

## 15. Decisions (closed 2026-10-10)

The six decisions of the draft are closed in §0.1. C1-B received its go on 2026-10-10 (§0.5) and is delivered (§8.2). The three items left open at the C1-B Review Gate were decided on 2026-10-10 (§0.6): (a) the `0029` / `0033` retention question is recorded as `QAN-BL-INTEL-02`; (b) the forward-safety follow-up is `QAN-BL-CI-02`; (c) the closing-change scope is §16. At the Local C1 Closure Review Gate the Product Owner approved both owner names (`INTEL-RET-01`, `QAN-INF-06`) and authorized the push and Draft PR #325 (§17). Open: the merge decision.

---

## 16. Closing change — local (2026-10-10, same branch, on top of `0e49622`)

Authorized by the Product Owner after the C1-B Review Gate, **local only** (§0.6). It changes no file under `apps/`,
`database/` or `packages/` and no migration.

### 16.1 RLS evidence — what "0 / 0" meant, and the two-sided proof

The C1-B control reported the non-owner side only. Its "owner" count was read through the observer connection, which
bypasses RLS, so it did not prove that the owner can read its rows **through RLS**. Its hypothesis zero was vacuous:
the target K1 owned no hypothesis. The closing change replaced that control with one focused, two-sided check inside the
same harness and the same isolated PostgreSQL mechanism. The fixture names a second target (`hypothesisTargetUser: "F1"`),
because F1 owns the only hypotheses; no RLS policy or migration changed.

| Check (synthetic users, through the production RLS path: role `authenticated` + the reader's own JWT claims) | K1 | F1 |
|---|---:|---:|
| ground truth via observer: memories / hypotheses | 3 / 0 | 2 / 1 |
| **owner** reads own memories / hypotheses through RLS (rows identical to ground truth) | **3 / 0** ✓ | **2 / 1** ✓ |
| **owner** retrieval for the K1 query | **2 items** | — |
| **non-owner** reads by `user_id`: memories / hypotheses | **0 / 0** | **0 / 0** |
| **non-owner** reads by the target's row ids: memories / hypotheses | **0 / 0** | **0 / 0** |
| **non-owner** retrieval for the same query | **0** | — |

The non-owner also reads **0 / 0 unfiltered**, while 13 memories and 2 hypotheses exist for 6 other users. `holds`
now requires `positiveOwnership`, `negativeCrossUser` and four non-vacuity flags: owner memories seen, owner hypotheses
seen, owner retrieval non-empty, other users hold rows. All are `true`. The static contract pins those fields (no yield is
pinned).

**Why one full harness run.** A fresh process-owned cluster needs all 150 migrations; the positive control needs K1's and
F1's data, which their scenarios create; and the results file locks the SHA-256 of the driver and fixtures, so it must be
regenerated from the edited harness. The run on `127.0.0.1:54526` passed every identity proof, applied 150 migrations
in 5.0 s, blocked 14 / 14 guard probes, made 0 outbound attempts, and removed its cluster (15 s in all). Every scenario
summary and every other control is byte-identical to the C1-B run.

### 16.2 Data-retention review of the `0029` / `0033` ledger content (decision 2)

| Question | Finding at `6a5fa42` |
|---|---|
| what is stored | `INTENT_PROVIDER` `result_payload.problem.text` (span of the user's own turn, `0029`); `CANDIDATE_PROVIDER` candidate plan (`0033`) |
| who can read it | `service_role` only (RLS on; revoked from `anon` / `authenticated`, `0022`) |
| who does read it | the dispatcher's durable-result readers, to recover the **same** execution of the same source turn; no other reader in `apps/api/src` |
| telemetry / AI-COST-01 | not telemetry and not `ai_provider_calls`; C1-B found 0 content hits in telemetry, outbox and executions |
| deletion | Personal erasure (`0130`) deletes it; `0128` forget / do-not-rely does not; export omits it |
| classification (D4) | (a) technically stored by design; (b) usable only for its own execution recovery; (c) undecided |

No violation is established. The undecided part, whether such text may stay or be read again after a forget /
do-not-rely and under which provenance, retention and deletion rules, is `QAN-BL-INTEL-02` (`HIGH`, `VALIDATION — OPEN`,
owner `INTEL-RET-01`, PO-APPROVED). No migration changes.

### 16.3 Files changed by the closing change

| File | Change |
|---|---|
| `scripts/ci-01/intelligence-reality.ts`, `scripts/ci-01/fixtures/controls-isolation-telemetry.json` | the two-sided, non-vacuous isolation control (§16.1) |
| `scripts/ci-01/results/6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24.json` | regenerated once by the run above |
| `tests/ci-01-intelligence-evidence-baseline-contract.test.mjs` | pins the two-sided isolation fields; pins one `api-ci.yml` step before forward-safety (17 tests) |
| `.github/workflows/api-ci.yml` | one step in the existing static-contract list: `npm run test:ci-01-intelligence-evidence-baseline-contract`; no job, condition or dependency changed; the harness is not added |
| `docs/qandeel-canonical-backlog-v1.md` | `QAN-BL-INTEL-02`, `QAN-BL-CI-02`, §7 counts and reconciliation, §9 rows |
| `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md` | locator status / sequencing; mirror recounted to 54; PROD-RETRY-01 recorded as merged (`6a5fa42`) |
| this contract, both C0 documents, both C1-A records, `scripts/ci-01/README.md` | banners and the closing record |

### 16.4 Gates (proportional to the files above)

| Gate | Result |
|---|---|
| harness run (once, fresh isolated cluster) | `RUN_COMPLETE`; controls hold; isolation two-sided and non-vacuous (§16.1) |
| `test:ci-01-intelligence-evidence-baseline-contract` | **17 / 17 PASS** |
| `test:task-closure-governance-contract` | **24 / 24 PASS** |
| every static contract that reads a changed file (71 files: the backlog, the three locators, `api-ci.yml`, `scripts/ci-01` or the CI-01 records), forward-safety excluded | **934 / 934 PASS** |
| `test:forward-safety-contract` (its inputs changed: `api-ci.yml`, `tests/`, the backlog) | **25 / 35 — FAIL (not a pass).** All 10 failures are one child in every mutation: the `QAN-INF-03` leg "expo install --check and expo-doctor both pass deterministically, offline". No CI-01 child failed in the mirror. Run directly on the real tree, `qan-inf-03-deterministic-expo-dependency-validation-contract` passes 6 / 6, and nothing under `apps/mobile` or `node_modules` changed. This is the intermittent local failure recorded as `QAN-BL-CI-02` (25 / 35 at C1-A, 35 / 35 at C1-B, 25 / 35 now). It was not re-run for reassurance. API CI on the pushed head is the authority |
| backlog recount | §4 index 54 rows = §7 (24 / 2 / 10 / 18; 31 / 21 / 2); the Current State's 36 active rows equal the index rows one for one |
| `git diff --check`; secret scan; path scan | clean; no secret-shaped string added; no path under `apps/`, `database/` or `packages/` |
| not run | Jest API, database verifiers, `brain-eval`, Mobile, GitHub CI — no file in their census changed; the full harness was not re-run beyond §16.1 |

---

## 17. PR #325 — push, Draft PR and final review correction (2026-10-10)

**Push and Draft PR.** The Product Owner approved the local closing change at `a99a1b2`, approved the owner names
`INTEL-RET-01` (`QAN-BL-INTEL-02`) and `QAN-INF-06` (`QAN-BL-CI-02`) without changing either item's severity or status,
accepted the PROD-RETRY-01 locator correction, and authorized the push and a Draft PR only. The branch was pushed with
no rebase or merge (`origin/main` still `6a5fa42`) and opened as Draft PR #325. On head `a99a1b2` GitHub ran API CI
(SUCCESS, forward-safety included) and Mobile CI (SUCCESS). That result does not carry over to the corrected head.

**Review correction (limited, Product Owner authorized).** Two findings only:

1. *Portable, privacy-safe results.* The committed results file published machine-local absolute paths: the PostgreSQL
   bin directory and the harness-owned temporary cluster directory (five values). The driver now writes the file through
   a redaction step. The identity proofs still run on the real paths first and are unchanged. Those two locations are
   then written as `<QANDEEL_CI01_PG_BIN>` and `<harness-temp-root>` and listed under `portability`. A run that would
   publish any other absolute path stops instead. The driver's SHA-256 changed, so the harness was re-run **once** on a
   fresh isolated cluster and the results file regenerated. `summary`, `controls` (isolation included) and `census` are
   identical to the `a99a1b2` file. Only run identifiers changed: timestamps, port, database name, marker nonce, the random
   hypothesis ids and the driver hash. The network-guard, local-db and fixture hashes are unchanged. The static contract
   adds one test that the published file holds no absolute local path and is written only through the redaction step.
2. *Lifecycle wording.* The banners of this contract, both C0 documents, both C1-A records and the harness README,
   together with the three locators and the backlog, now read Draft PR #325 open. They record API / Mobile CI green on
   `a99a1b2`, the corrected head pending exact-head validation, and not merged. Where the old "proposed owner" wording
   remained, `INTEL-RET-01` and `QAN-INF-06` now read PO-APPROVED.

No file under `apps/`, `database/` or `packages/` changed, and no migration, RLS policy, fixture or Product decision changed.

| Gate (corrected head, local) | Result |
|---|---|
| harness run (once, fresh isolated cluster) | `RUN_COMPLETE`; controls hold; measurements identical to `a99a1b2` |
| `test:ci-01-intelligence-evidence-baseline-contract` | **18 / 18 PASS** (17 plus the new no-absolute-path test) |
| `test:task-closure-governance-contract` | **24 / 24 PASS** |
| every other static contract that reads a changed file, forward-safety excluded | 36 files (20 that name a changed file, the two contracts above included, plus 16 that scan the docs, scripts or tests directories): **590 / 590 PASS** |
| `test:forward-safety-contract` | not re-run locally (known `QAN-BL-CI-02` local failure; it passed on GitHub at `a99a1b2`); API CI on the corrected head is the authority |
| `git diff --check`; secret scan; absolute-path scan of the results file | clean; no secret-shaped string added; 0 absolute local paths in the results file; no path under `apps/`, `database/` or `packages/` |

**STOP AT FINAL PR REVIEW GATE.** The PR stays a draft. No Ready for Review, no merge, and no C2 or PG-02 without the Product Owner's explicit decision.
