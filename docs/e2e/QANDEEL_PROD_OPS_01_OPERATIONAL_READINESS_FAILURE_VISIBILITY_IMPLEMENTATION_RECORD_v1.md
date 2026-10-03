# QANDEEL — PROD-OPS-01 — Operational Readiness & Silent-Failure Visibility — Implementation Record v1

**Status:** `PROD-OPS-01` — **MERGED / CLOSED** — merged through PR #300 at `df694fd4d86fca41c50790f24ef5463af711236f`
(2026-10-01; PR head `a97be9d423b00398d1896c85ae2d96b29e4adaa5`). Lifecycle reconciled by ROADMAP-REC-01 (2026-10-04);
nothing below it was rewritten.
**Status at handoff (historical):** `PROD-OPS-01` — **IMPLEMENTED — DRAFT PR #300, AWAITING INDEPENDENT REVIEW** (not merged by Claude).
**Baseline:** `main = ce2b86d0caaeb063ec4593663d9dbf806e51b4f4` (PR #299 merged; PR #298 closed unmerged, evidence only).
**Branch:** `fix/prod-ops-01-readiness-failure-visibility` — `c0ac489` (implementation), `76d1d4b` (review fix:
readiness coalescing and bounded read; **implementation evidence head**), then documentation / governance only.
**Migration:** `0132_operational_readiness_failure_visibility_v1.sql` (next free slot; `0131` canonical).
**Backlog:** `QAN-BL-PROD-03` widened to the whole direction and tombstoned; `QAN-BL-PROD-01` tombstoned (PR #299).
**Claude did not merge anything.**

---

## 1. What is now observable (plain words)

Before this task, five things could fail with nobody able to see it:

1. `/health/ready` could never pass against the real Supabase project, because the probe asked the Data API root with
   the publishable key, which Supabase refuses since 11 March 2026.
2. The Privacy & Data pass (export preparation, account deletion) caught every failure and said nothing — including a
   provider account removal that answers `UNAVAILABLE` forever.
3. An export that failed three times became `FAILED` with no reason anyone could read.
4. A failed Understanding Confidence re-evaluation became `PENDING_RETRY` silently.
5. Nothing could tell, after a restart, that Privacy or export work had been stuck for hours.

Now: readiness is a real database check; every step of those passes emits one **content-free** signal from a closed
list; a failed export attempt records one of four closed failure classes; and a numbers-only summary of stuck and
failed work is emitted as gauges every pass. Nothing user-facing changed.

## 2. Readiness design (OPS-A)

- **RPC:** `public.server_database_ready_v1()` — `LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''`,
  `SELECT true`. Zero parameters, no table, no row, no mutation. Owner `postgres`; `REVOKE ALL … FROM PUBLIC, anon,
  authenticated`; `GRANT EXECUTE … TO service_role`. No new client-reachable surface.
- **Why an RPC and not the alternatives:** the Data API root is refused to the publishable key (Supabase changelog,
  *Breaking Change: Removing access to OpenAPI spec via the anon key*); PostgREST's admin `/ready` checks pool + schema
  cache but lives on an admin port Supabase Hosted does not expose; a table read would couple readiness to product data.
  A successful RPC call proves the gateway, a pooled connection, the schema cache holding QANDEEL's migrated surface and
  the role switch — the narrowest reliable check through QANDEEL's real dependency path.
- **Probe:** `POST ${SUPABASE_URL}/rest/v1/rpc/server_database_ready_v1` with `SUPABASE_SERVICE_ROLE_KEY` (the
  canonical server credential every server pass already uses; no new secret name), body `{}`.
  - `available` — HTTP 200 and the body is exactly `true` (whitespace-trimmed), read through a reader that stops past
    16 bytes;
  - `not_configured` — `SUPABASE_URL` or the server credential absent; no network call;
  - `timeout` — the unchanged 100–5000 ms clamp (`HEALTH_DATABASE_TIMEOUT_MS`, default 1500 ms);
  - `unavailable` — every other status, shape, length or transport failure. The body is never returned or logged.
- **Coalescing (review fix):** `/health/ready` is unauthenticated and each real check now takes a pooled database
  connection. Concurrent checks share one request and a result is reused for 1 s, so no request rate becomes more than
  ~1 database round trip per second per instance.
- **Unchanged:** the `/health`, `/health/live`, `/health/ready` response schema; required = database + model provider;
  optional = runtime events + observability. Operational / stuck state is **not** a readiness input (pinned by spec and
  contract): a broken maintenance job alerts Operations, it never evicts healthy instances.

## 3. Operational metric contract (finite, source-auditable)

All through the existing `TelemetryService` (no second service, no vendor, no queue). Every recorder validates against
a frozen registry and **drops** anything outside it; every call is wrapped fail-soft at the call site as well.

**`qandeel.operations.outcomes`** (counter, value 1) — labels `domain`, `operation`, `outcome`, `policy_version="1"`,
and `failure_class` only on `retry_pending` (required there). Legal relation (anything else is dropped):

| domain | operation | outcomes |
|---|---|---|
| `PRIVACY_EXPORT` | `prepare`, `stuck_scan` | `success`, `transport_failure`, `integrity_failure` |
| `ACCOUNT_DELETION` | `claim`, `complete`, `stuck_scan` | `success`, `transport_failure`, `integrity_failure` |
| `ACCOUNT_DELETION` | `erase` | `success`, `blocked_expected`, `superseded_expected`, `transport_failure`, `integrity_failure` |
| `ACCOUNT_DELETION` | `provider_remove` | `success`, `provider_unavailable` |
| `UNDERSTANDING_CONFIDENCE` | `confidence_reevaluate` | `success`, `retry_pending` (+ `failure_class` ∈ `TRANSPORT`, `INTEGRITY`) |

`transport_failure` / `integrity_failure` / `TRANSPORT` / `INTEGRITY` come from `classifyOperationalFailure`, which reads
the error's **kind** only (Nest `ServiceUnavailableException`, `DataApiError` status class, `TimeoutError` /
`AbortError`, a network `TypeError` with a cause) — never a message, database code or body. `blocked_expected` is
Connected Worlds `BLOCKED`; `superseded_expected` is a cancelled or not-yet-due request.

**`qandeel.operations.privacy.state_count`** (gauge) — `domain`, `state`, `policy_version`:
`PRIVACY_EXPORT` × {`preparing`, `retrying`, `stuck_preparing`, `failed_total`, `failed_recent`};
`ACCOUNT_DELETION` × {`stuck_due`, `stuck_provider_pending`}.
**`qandeel.operations.privacy.oldest_age`** (gauge, unit `s`) — same labels, only for the three `stuck_*` states.
**`qandeel.operations.privacy_export.recent_failures`** (gauge) — `failure_class` ∈ the four DB classes,
`policy_version`.

Never a label: user / session / turn / deletion / export / hypothesis / evaluation id, Login ID, Public ID, email, text,
exception message, SQL error, SQLSTATE, URL, body or JSON. Counts and ages are values.

**Reading the gauges:** the summary is global and every API instance records it (each under its own resource
identity); aggregate across instances with **max**, not sum. Alert on `stuck_scan` failure outcomes too: a gauge keeps
its last value while the scan itself is failing.

## 4. OPS-B — Privacy deletion pass (`P-1`)

Instrumented without changing a decision: prepare / claim / erase / provider_remove / complete each emit one outcome;
the aggregate scan runs after the deletions. A non-row-set claim answer or non-number preparation answer is now a
typed `PrivacyMaintenanceAnswerError` (an `integrity_failure`); the worker still treats them exactly as before (claims
nothing, continues). Provider `UNAVAILABLE` (and a thrown removal) is `provider_unavailable` and the request stays
`ERASED` and retryable. A completion that fails or answers anything but `COMPLETED` stays retryable. **No attempt
cutoff** was added to deletion. `BLOCKED` stops exactly as before.

## 5. OPS-C — Export preparation (`P-5`, migration `0132`)

`personal_data_private.data_exports` gains `failure_class` (closed CHECK: `TRANSIENT_DATABASE`,
`CONSTRAINT_OR_INTEGRITY`, `RESOURCE_OR_CAPACITY`, `INTERNAL_OTHER`) and `last_failure_at`; both-or-neither; only on
`PREPARING` / `FAILED` rows. `prepare_data_exports_v1` is redefined in place: the static contract proves its body equals
0130's once the three marked additions are removed (one variable; success clears both fields; the handler reads
`RETURNED_SQLSTATE`, maps it through `export_failure_class_v1` and stamps the time). The SQLSTATE class decides
(`08/40/57/58` + `55P03/55006` → transient; `22/23/27/44` → constraint; `53/54` → resource; else internal). The raw
SQLSTATE and exception text are never stored. Three attempts, one-minute backoff, five-minute lease, atomic READY
artifact and owner-facing `FAILED` are unchanged. The classifier is executable by no role. The fields live on the export
row, so the governed erasure (explicit delete + `ON DELETE CASCADE`) removes them; proven.

## 6. OPS-D — Understanding Confidence (`U-4`)

`reevaluateConfidence` emits `success`, or `retry_pending` with `TRANSPORT` / `INTEGRITY`. Still one call per request,
no new retry, same answer (specs compare the response byte-for-byte with and without a failure, and with telemetry
throwing). No identifier or text reaches telemetry. U-1 focus continuity was not touched.

## 7. OPS-E — Stuck-job visibility

`public.server_read_privacy_operations_summary_v1()` — `SECURITY DEFINER`, `STABLE`, empty `search_path`, no
parameter, `service_role` only; one row of 14 integers. Thresholds are engineering monitoring defaults, fixed in SQL so
no configuration can alter them or disable a Product operation:

| state | threshold | reasoning |
|---|---|---|
| stuck export | `PREPARING` ≥ 30 min since request | a healthy preparation ends READY/FAILED in ~4 min (3 attempts, 1-min backoff, 30-s pass, 10 per pass); also catches a pass that never commits (an uncatchable failure rolls back the whole pass, so no attempt is counted) |
| stuck due deletion | `SCHEDULED` ≥ 30 min past `final_at` | claimed by the first 30-s pass; a crashed lease frees in 5 min; 30 min = 6 leases |
| stuck provider removal | `ERASED` ≥ 30 min since erasure | retried every pass under the same 5-min lease |
| recent failure | failed attempt in the last 24 h | daily alerting window |

`BLOCKED`, `CANCELLED` and `COMPLETED` are never counted.

## 8. Verification

| Layer | Result |
|---|---|
| API Jest, full suite locally (bootstrap spec excluded — known host block) | 205 / 205 suites, 4729 / 4729 tests (`c0ac489`); probe/health re-run after review fix 19 / 19 |
| Database static tests (`npm run test:database`) | 1281 / 1281 |
| New static contract (incl. 27 planted defects of §13) | 29 / 29 |
| W3-U1/U2/U3, W3-MEGA-S, QIR telemetry contracts, PROD-SEC-02, W1B-01 | 135 / 135 |
| Forward-safety gate | 35 / 35 |
| Task-closure governance contract | 24 / 24 |
| `tsc --noEmit` (API) | clean |
| `verify-migration-0132.mjs` (real PostgreSQL) | **pass** (CI, §8.1) |
| `verify-migration-0130.mjs` regression | **pass** (CI, §8.1) |
| Live PostgREST v12.2.9 / v13.0.8 / v14.18 / v16.4 wire proof with the compiled probe + repository | **pass ×4** (CI, §8.1) |

Locally there is no PostgreSQL (App Control blocks `initdb`), so the verifier and wire proof run in API CI only. The
wire proof's plumbing (path-prefix gateway, compiled probe and repository, `apikey` stripping, unreachable gateway) was
smoke-tested locally against a fake PostgREST.

**What `verify-migration-0132.mjs` proves:** catalog posture and exact grants of the three new functions and the
redefined pass; the private schema's executable census unchanged; operational columns unreadable by every role and
absent from every owner answer; readiness `true` for `service_role` inside a `READ ONLY` transaction and refused to anon
/ authenticated; the full SQLSTATE → class mapping; real injected build failures (`40001` → `23505` → `53200`):
PREPARING with the one-minute backoff, then FAILED at attempt 3 exactly as 0130, owner sees the same state, FAILED never
retried, no secret text or raw SQLSTATE persisted, CHECKs refuse a raw SQLSTATE / half-shape / class on READY; a
retrying export (`P0001`, `54000`) that succeeds on attempt 3 is READY with the class cleared; the summary with synthetic
timestamps (aged vs fresh, due vs not-due, ERASED aged vs fresh, BLOCKED / COMPLETED / CANCELLED never counted, a stuck
due deletion that becomes BLOCKED leaves the count, failed total vs recent, recent classes); exactly 14 numeric columns
and no identity; the erasure removes a classified export row with no orphan.

### 8.1 CI

On implementation evidence head `76d1d4b`, first round, no repair loop:

- **API CI `verify-api` — pass** (run `36867184468`, 13 m 34 s): API Jest **206 / 206 suites, 4739 / 4739 tests**;
  every static contract including the new one; fresh migration chain `0001`–`0132`;
  `Verified migration 0132 …`; regressions `Verified migration 0130 …` and `Verified migration 0131 …` (and every
  earlier verifier in the job); live PostgREST **v12.2.9, v13.0.8, v14.18, v16.4**: `Verified PROD-OPS-01 through live
  PostgREST …` for each, beside the unchanged PROD-SEC-02 proof.
- **Mobile CI fast contract gate — pass**; native build / smoke jobs skipped by path (no mobile code changed).

The documentation / governance commit after `76d1d4b` re-runs the same gates on the final head.

## 9. Review (G1) and dispositions

- **`code-review` (high):** 5 findings. Fixed: unauthenticated readiness amplification onto the DB pool (coalescing +
  1-s reuse); unbounded readiness body read (bounded reader). Kept by design: global gauges recorded by every instance
  (aggregate with max; documented in §3); gauges keep the last value while a scan fails (alert on `stuck_scan`
  failures; documented); the fail-soft contract pins exact source shape (the repository's static-contract convention).
- **`security-review`:** the skill could not run on this host (its embedded shell commands need Bash, which Windows App
  Control blocks here). The security pass was performed against the task's §13 adversarial list instead, and every item
  is a planted defect the new static contract proves it rejects (table below).

| §13 adversarial item | Rejected by |
|---|---|
| probe still calling `/rest/v1/` root; publishable key | `readinessViolations` (planted ×2) |
| readiness RPC executable by anon / authenticated | `readinessViolations` (planted ×2) + verifier grants + wire proof |
| readiness leaking upstream body / secret | `readinessViolations` + probe spec + health spec |
| readiness depending on a table / mutating | `readinessViolations` (planted ×2) + verifier `SELECT true` / READ ONLY |
| ids / exception text / SQLSTATE as labels; `console.error(error)` | `telemetryContentViolations` (planted ×4) + specs' content-free assertions |
| raw SQL error text / raw SQLSTATE persisted | `semanticsViolations` (planted ×2) + verifier |
| telemetry failure altering deletion / export / Understanding | `failSoftViolations` (planted ×2) + specs with throwing telemetry |
| BLOCKED counted as a failure (worker or summary) | `semanticsViolations` (planted ×2) + verifier |
| deletion max-attempt cutoff; export retry / backoff changed | `semanticsViolations` (planted ×3) + verifier |
| new automatic Confidence retry | `semanticsViolations` (planted) + Understanding spec |
| stuck state wired into `/health/ready` | `healthIsolationViolations` (planted) + health spec |
| high-cardinality labels | finite registries quoted in contract + observability spec enumeration |
| full APP-OPS implementation smuggled in | none added: no Company backend, Command Center, vendor, queue or new module |

## 10. Skills Used

| Skill | Inspected | Used | Reason |
|---|---|---|---|
| `security-review` | yes | **no — could not execute** | its shell steps run through Bash, blocked on this host; replaced by the §13 adversarial pass above |
| `code-review` | yes | yes (high) | 5 findings, 2 fixed, 3 dispositioned |
| `simplify` | yes | no | `code-review` already covers cleanup angles at high effort |
| observability / backend / database skills | searched the listing | none exist | — |
| UI / mobile / design skills | yes | no | no mobile or UI change |

Research refresh (primary sources): Supabase changelog *Removing access to OpenAPI spec via the anon key*
(root refused to anon from 2026-03-11; secret/service keys still allowed); PostgREST Admin Server `/ready` (pool +
schema cache, admin port only); OpenTelemetry *Error handling* (never throw into the app; suppressed errors need
self-diagnostics; bounded dimensions).

## 11. Gap Closure Matrix

| Gap | Final disposition | Evidence |
|---|---|---|
| OPS-A readiness | **FIXED + VALIDATED** | migration 0132 RPC; probe + 8 probe tests + 4 `/health/ready` composition tests (200 / 503 / optional failure / no stuck input); verifier grants + READ ONLY; live PostgREST proof across 4 versions with the compiled probe |
| OPS-B deletion silent failure | **FIXED + VALIDATED** | worker outcomes for prepare/claim/erase/provider_remove/complete + BLOCKED expected + 26-cycle UNAVAILABLE retry + throwing-telemetry parity (`privacy-maintenance.observability.spec.ts`) |
| OPS-C export silent failure | **FIXED + VALIDATED** | closed `failure_class` + time; verifier with real injected failures; contract proves 0130 body preserved |
| OPS-D Confidence silent failure | **FIXED + VALIDATED** | `success` / `retry_pending` + class; byte-identical answers; throwing telemetry; no retry added |
| OPS-E stuck-job visibility | **FIXED + VALIDATED** | service-role summary + gauges; verifier with synthetic timestamps; wire proof decodes it through the real repository |

**PROD-OPS-01 is complete in its direction: no row is unresolved.**

## 12. Residues and their direction (BG-08)

No new backlog item qualifies (BG-06). Each residue observed, and why it is not this direction's open work:

- **Rate limiting of `/health/ready`** at the edge — `QAN-BL-PROD-02` / `PROD-SEC-01` (unchanged). The amplification
  this task introduced is closed in-process (§2).
- **An uncatchable failure inside export preparation** (e.g. a statement timeout) rolls back the whole pass, so no
  attempt is counted and the queue cannot advance. It is no longer silent: every pass emits
  `PRIVACY_EXPORT:prepare:transport_failure` and the summary reports the aged `stuck_preparing` export with its age.
  Changing the pass to commit per export would change preparation semantics, which this task's contract forbids; it is
  not a known occurrence (the server role carries no statement timeout here).
- **User-specific operational diagnostics, alert rules and dashboards** — APP-OPS-01 Company Operations, outside this
  task by its contract (§3, item 8).
- **Understanding U-1 focus continuity** — the Understanding direction. Untouched.
- **Connected Worlds full account deletion** — `QAN-BL-ACCT-01`. Untouched; BLOCKED behaviour preserved.

## 13. Files changed

- `database/migrations/0132_operational_readiness_failure_visibility_v1.sql` (new)
- `database/verify-migration-0132.mjs`, `database/prove-0132-readiness-postgrest.mjs` (new)
- `apps/api/src/health/database-health.probe.ts` (+ spec)
- `apps/api/src/observability/telemetry.service.ts`, `operational-failure.ts` (new) (+ `observability.spec.ts`)
- `apps/api/src/account/privacy-maintenance.worker.ts`, `privacy-maintenance.repository.ts`, `account.module.ts`
  (+ `privacy-data.spec.ts`, `privacy-maintenance.observability.spec.ts` new)
- `apps/api/src/understanding/understanding.service.ts`, `understanding.module.ts` (+ spec)
- `tests/prod-ops-01-operational-readiness-failure-visibility-contract.test.mjs` (new);
  `tests/w3-mega-u1-understanding-projection-contract.test.mjs` (module imports now admit exactly `ObservabilityModule`)
- `package.json`, `.github/workflows/api-ci.yml` (static gate, verifier step, wire proof in the PostgREST loop)
- `docs/health-readiness-dependency-probes-v1.md`, `docs/qandeel-canonical-backlog-v1.md`, this record

## 14. Merge statement

Claude did not merge. Independent ChatGPT review decides; under the current Product Owner rule it merges if no real
blocker remains.
