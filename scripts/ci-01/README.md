# CI-01 C1-B — Synthetic Intelligence Reality Baseline (dev-only harness)

**Status:** `C1-B DELIVERED LOCALLY · results recorded for main 6a5fa42 · CI-01 OPEN (closing change pending)`
**Owner task:** `CI-01 — Shared Intelligence Learning Evidence & Baseline`, C1 Task Contract
([docs/e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md](../../docs/e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md)) §4.2 and §0.3.
**Never a CI step.** Nothing here runs in any GitHub workflow, touches hosted Supabase, reads `.env`, or calls a provider.

## 1. What this is — and what the numbers are not

This directory re-measures, on a repository-resident harness, what the 2026-10-09 Intelligence Reality Check measured
from a scratchpad: the **structural yields** of QANDEEL's deterministic per-user intelligence pipeline on **synthetic
Egyptian-Arabic fixtures**, through the **real** production orchestrator and post-response dispatcher, over a **real**
PostgreSQL 17 built from every migration, with deterministic doubles only where a paid provider, Redis or PostgREST would
sit.

The results file `results/<baseline-sha>.json` records, per scenario: capture yield (value statements that became
Memory), recall (asked-back facts found by the retriever), truth maintenance (stale preference served after a reversal,
duplicate after a restatement, hypothesis injected after forget), third-party separation, HIM coverage, trigger
classification, background execution outcomes, and the mandatory controls (user isolation, content in telemetry / outbox /
ledgers, external HTTP).

**They are not** (C0 D7, C1 contract §4.2): a conversational-quality score, naturalness, calibration, "next-turn value",
or any statement about what a bound LLM would do. The three hypothesis providers and the conversational router are
doubles; a hypothesis statement in the results reads `SYNTHETIC_DOUBLE_CANDIDATE_n` because it *is* one. A `RUN` status
means the harness executed; it is **not** a capability PASS. Defects are **recorded, not repaired** (§0.4, decision 3).

## 2. Files

| File | Role |
|---|---|
| `local-db.mjs` | cluster lifecycle: `run-baseline` (start → prove → migrate → drive → stop, cleanup always), `start`, `prove <state>`, `stop <state>`, `drive <state> [results]` |
| `network-guard.cjs` | **preload** (`node --require`) that scrubs inherited env and makes every outbound transport throw; exposes `selfTest()` |
| `intelligence-reality.ts` | the driver: production composition + doubles + fixture execution + yields + controls |
| `fixtures/*.json` | one file per scenario (N1, K1, C1, P1, F1, H1, M1, X1) + `controls-isolation-telemetry.json`; synthetic texts, measurement definitions, no expected values |
| `results/<baseline-sha>.json` | the recorded run for that `main` SHA, with the isolation proofs, guard self-test, tool versions and file hashes |

## 3. Running it

Requirements: Node ≥ 24, the repository's `node_modules`, and PostgreSQL **17** binaries (`initdb`, `pg_ctl`, `postgres`)
in a directory you name. No running database, no Docker, no Redis, no `.env`.

```bash
QANDEEL_CI01_PG_BIN=/path/to/postgresql-17/bin npm run verify:ci-01:intelligence-reality:local
```

Optional: `QANDEEL_CI01_ONLY=<scenario>` runs one scenario (plus the controls when the scenario is `CONTROLS`).
Development iteration: `node scripts/ci-01/local-db.mjs start` → `drive <state.json> [results.json]` (defaults to a
scratch path, never `results/`) → `stop <state.json>`.

The committed results were produced with: Node v24.19.0, `pg` 8.23.0, ts-node 10.9.2, TypeScript 5.9.3,
`@opentelemetry/api` 1.9.0, PostgreSQL 17.10 (`@embedded-postgres/windows-x64` 17.10.0-beta.17 binaries), Windows 11.
The results file carries the SHA-256 of every harness file and fixture that produced it.

## 4. Isolation — enforced by code (C1 contract §0.3)

| Rule | How |
|---|---|
| inherited `PG*`, `DATABASE_URL`, `SUPABASE_*`, `REDIS*`, provider keys, `*_PROXY` | **deleted** from `process.env` by `local-db.mjs` and again by the preload in the driver; names recorded, values never read; the driver gets an **allowlisted** environment |
| `.env` | never read (no `--env-file`; pinned by the static contract) |
| cluster | `initdb` into a fresh `mkdtemp` directory under the OS temp dir, `pg_ctl` on `127.0.0.1` and a port this process found free, random password, `scram-sha-256` |
| positive identity proof — **before any migration** and **again in the driver before any read/write** | the connected server must report: `inet_server_addr() = 127.0.0.1`, `inet_server_port()` = our port, `current_database()` = our name, `version()` = PostgreSQL 17.x, `data_directory` = our directory, `pg_postmaster_start_time()` after our start, **no foreign databases**, and `pg_read_file('QANDEEL_CI01_HARNESS_MARKER.json')` returns **this run's nonce** and the parent pid |
| no DROP | the harness never issues `DROP DATABASE`; cleanup is `pg_ctl stop` + removal of the `mkdtemp` directory, and only after the file-level ownership proof (marker nonce, `PG_VERSION = 17`, directory under temp with the harness prefix) and, when reachable, the live proof |
| external calls | `fetch`, `http`/`https` request+get, `http2.connect`, `tls.connect`, `dgram`, `dns.*` (except `localhost`), and `net.Socket.prototype.connect` to any non-loopback host **or any port other than the harness port** all throw `QANDEEL_CI01_NETWORK_FORBIDDEN`; the driver runs `selfTest()` (14 probes) and **stops unless all are blocked**; attempts during the run are counted |
| failure | any failed proof → `QANDEEL_CI01_STOP`, exit 3, cluster torn down; **no alternative connection is ever tried** |
| data | synthetic accounts created by the driver in `auth.users`; every text comes from `fixtures/`; the results contain fixture texts and the Memory rows derived from them — synthetic by construction |

## 5. Doubles (verification-side; prove nothing about a real model)

conversational Model Router (records the assembled request, answers a fixed string) · intent / candidate / association
hypothesis providers (deterministic, content-free) · CU/Focus/Thread semantic establishment (frozen A2 two-Moment fixture,
no Thread) · Redis (in-process hand-off of the exact envelope the **real** publisher claimed from the **real** outbox) ·
PostgREST (bounded SQL transport with the same per-request role and `request.jwt.claims`, autocommit per request;
fails closed on any request shape a production repository does not emit) · OpenTelemetry (recording meter + tracer so
that "no content in telemetry" is **measured**). `service_role` receives `BYPASSRLS` as Supabase grants it.

## 6. Results for `main` `6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24` (2026-10-10)

Production tree (`apps/`, `database/`, `packages/`) byte-identical to the baseline when run. Harness: `RUN_COMPLETE`,
8 scenarios + controls, 10 synthetic users, 15 sessions, 47 user turns, 43 conversational router calls, 2 intent + 2 candidate
double calls, 0 external attempts; cluster lifetime 18 s including 150 migrations (5.2 s). Controls **hold**.

| Scenario | Measured (synthetic) | Same as 2026-10-09? |
|---|---|---|
| N1 natural self-description | value statements captured **0/4**; the one anchored fact captured 1/1 but stored as «أنا ساكن في مدينة نصر.» (feminine «ساكنة» rewritten to masculine); recall **0/2** in the new session | yes |
| K1 preferences / goals / decisions | captured **3/6** (anchored «أنا بحب», «هدفي», «قررت»); recall **1/4** — only the exact token «الهدوء» hit; «للهدوء», «التدخين» (stored «بيدخن») and the open question missed | yes |
| C1 reversal → restatement → correction | natural reversal stored nothing; stale Cairo preference served **2/3** probes; restatement created a second ACTIVE copy; explicit correction superseded v1 but **1 duplicate ACTIVE pair** remained at the end | yes |
| P1 third-party separation | third-party statements stored as the user's Memory **1/3** — the explicit «افتكر إن أختي…» became a `PERSONAL_FACT` of the user; «أحمد صاحبي» and the brother-preference stored as the user's own (correct) | yes |
| F1 forget / do-not-rely → PG-02 | FORGET → `DELETED`, DO_NOT_RELY → `DISABLED`; forgotten content served **0/2** (forget honoured at retrieval); the hypothesis derived from them stayed `ACTIVE` and was **injected in both new-session turns**; **1** ACTIVE hypothesis over non-ACTIVE evidence | yes (PG-02 confirmed) |
| H1 HIM coverage | organic stressed-day turns: `EMPTY`, 0 known metrics, 0 instructions; seeded canonical `hse.stress=HIGH`: `PARTIAL`, 1 known, 3 behavioural instruction IDs **in that session only**; next session `EMPTY` again | yes |
| M1 Arabic triggers | compound anecdote captured 0 (`AMBIGUOUS_OR_SPECULATIVE`), anchored compound captured as one Memory, hedged «يمكن…» correctly not stored, «ليه أنا دايما…» → `GENERIC_QUESTION` (recurring-pattern trigger does not fire), «عايز… بس خايف» → `INTERNAL_CONTRADICTION` → generation completed (+1 synthetic hypothesis); «بسهر» in F1.2 also fires the contradiction trigger | yes |
| X1 semantic-chain dependency | contradiction trigger without the semantic chain → `SKIPPED/NOT_ELIGIBLE` (no hang this time because no eligible Memory existed); with the chain but no Memory → `SKIPPED/NOT_ELIGIBLE` | consistent |
| Controls | probe user sees **0** of K1's memories/hypotheses via RLS, retrieves **0**; telemetry: 2 596 records, 12 214 strings, **0** content hits, **0** Arabic strings; outbox 47 rows, `contains_content` **0**; executions 47 rows, **0** hits; `ai_provider_calls` 0 rows; **0** network attempts | yes |

**New documentary finding (not a defect pin, not repaired):** `post_response_intelligence_effects.result_payload`
(migration **0029**, durable intent-provider result) stores `problem.text`, an extractive span of the user's **own**
current turn, on the `INTENT_PROVIDER` effect — 2 rows in this run (the two generation turns); 2 further `CANDIDATE_PROVIDER`
rows hold the (synthetic) candidate statements (migration 0033). The table is RLS-enabled
and `REVOKE`d from `anon`/`authenticated` (0022), service-role only. This is a **durable ledger**, not telemetry, and is
reported separately as `controls.durableLedgerContent`; its retention is a question for the ledger's owner and is listed
in the C1 contract §8.1 for the closing change. (The intent double here returns the whole turn; a production provider
returns a span of it — the column holds user content either way.)

Every number above is read from `results/6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24.json`; the per-turn records there
show the evaluator decision, trigger classification, served Memory context, HIM coverage, outbox/dispatch outcome,
effects, new Memory rows and provider-double calls for each fixture step.

## 7. Evolution rules

- A repair that changes a yield re-runs this harness on its own `main` SHA and adds `results/<new-sha>.json`; it never
  edits an older results file. The static contract pins only the isolation authorities and the recorded proofs, never a
  yield (C1 contract §0.4).
- Fixtures are changed only to add scenarios or to fix a fixture error, never to improve a number (Product Owner, C1-B
  decision). A fixture change invalidates comparability and must say so in the results `readThisFirst`.
- A real-LLM run (Stage 8A) is a different instrument with its own contract; it does not reuse these doubles.
