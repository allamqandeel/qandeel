# QANDEEL — PROD-SEC-01 — API Baseline Security Hardening + Trusted Client Boundary — Implementation Record v1

**Status:** `PROD-SEC-01` — **IMPLEMENTED — DRAFT PR #301, AWAITING INDEPENDENT REVIEW** (not merged by Claude).
**Baseline:** `main = df694fd4d86fca41c50790f24ef5463af711236f`. PR #299 (`PROD-SEC-02`) and PR #300 (`PROD-OPS-01`) are
merged; `0131` and `0132` are canonical.
**Branch:** `fix/prod-sec-01-api-baseline-hardening`. The **implementation evidence head** is `3239f6f`; every commit
after it is documentation / governance only.
**Migration:** `0133_supabase_default_privilege_drift_closure_v1.sql` (the next free slot).
**Backlog:** `QAN-BL-PROD-02` is widened to the whole direction (`SEC-A` … `SEC-H`) and tombstoned. Two named Final
Launch gates are admitted: `QAN-BL-LAUNCH-01` (edge / origin) and `QAN-BL-LAUNCH-02` (identifier key management).
**Claude did not merge anything.**

---

## 1. What changed, in plain words

- **Request floods.** Every API route now has a per-client request limit, checked before any login check, database
  call or AI call. The strictest limits are on the routes a stranger can call: Login ID availability, Login ID
  sign-in, code verification and resend. A refused request receives one short, identical answer.
- **Who the client is.** The API no longer guesses the client's address. Production must state how it is reached:
  directly, or through listed proxies. A forged "forwarded for" header is ignored. The address the API sends to
  Supabase, so that Supabase's own per-person limits work, is now always the real, validated one.
- **Response headers.** Every response carries the standard browser-safety headers, and no longer announces the
  server software.
- **Production refuses to start misconfigured.** A production process without the Supabase keys, without the one key
  allowed to forward addresses, or without a stated proxy topology refuses to start. Its error names the missing
  setting and never prints a value.
- **Database.** A hosted Supabase project grants some database functions to anonymous callers by default, and several
  migrations had not removed those grants. One of them would have let anyone check Login IDs directly, unthrottled.
  Migration `0133` removes exactly those grants and stops the defaults from recurring.
- **Outside the repository.** Two items depend on production choices the repository cannot make: the hosting / edge
  setup, and a managed key for hardening retired identifiers. Each is handed to a named launch gate.

## 2. Repo truth (G0)

- **`main`:** `origin/main = df694fd` (merge of PR #300). PR #299 merged as `ce2b86d`. `0131` and `0132` are present;
  `0133` is free.
- **Tree:** clean.
- **Toolchain:** Node `v24.19.0`, npm `11.17.0`; engines `node >=22.13.0`, `npm >=10`. CI runs Node 22.
- **Branch:** `fix/prod-sec-01-api-baseline-hardening`, from `df694fd`; `main` has not advanced.
- **Dependencies:** `@nestjs/throttler@^6.7.1` (official, peer `@nestjs/* ^11`) and `helmet@^8.3.0` were added to
  `@qandeel/api`. The lockfile gains exactly those two packages. Nest is **not** upgraded.

## 3. Skills (G1)

| Skill | Used | Why / effect |
|---|---|---|
| `security-review` | **Inspected; could not run** | Its first embedded shell step (`git status`) fails on this host, where the Bash runtime is blocked by Windows Smart App Control (recorded host limitation). The skill was not forced, as the Task Contract requires. Its job was done by hand instead: an adversarial pass over all 27 planted defects of §16, each encoded as a detector in `tests/prod-sec-01-api-baseline-security-contract.test.mjs` and each proven to reject its defect. |
| `code-review` (high) | **Yes** | It reviewed `origin/main...HEAD` and returned 9 findings: 8 fixed, 1 deliberately not changed (§12). |
| backend / NestJS, API security, database, testing | Searched the skill catalogue | No materially relevant skill exists beyond the two above. The available skills are mobile, design, documents and animation. Unused. |

## 4. SEC-A — rate limiting

**Mechanism.** One `@nestjs/throttler` global guard (`QandeelThrottlerGuard`, `APP_GUARD`) runs before every
controller-level guard. A refused request therefore reaches no Supabase Auth call, no database and no provider. The
storage is Nest's **in-memory store**, so each instance is bounded by itself. This is **origin defence in depth, not a
distributed limit**. Global, cross-instance enforcement and direct-origin protection belong to `LAUNCH-EDGE-SECURITY-GATE`.
There is no external store, so no storage outage can mean "unlimited", and Redis is not touched.

**Key.** The trusted client address only (§5), with IPv6 grouped by /64, held as a SHA-256 digest for the window's
lifetime. A key never contains a Login ID, Email, Public ID, token, body or user text; a test proves that two Login
IDs from one client touch identical digests. Nothing is logged.

**Windows.**
- `client`: all routes together, per address, **1200 / min**.
- `route_minute`: per route, per address, set by the route's class.
- `route_hour`: per route, per address, only for the classes that carry one.

**Refusal.** HTTP 429 `{ "outcome": "RATE_LIMITED" }` with `Retry-After`. There are no `X-RateLimit-*` counters, and
the answer is the same for every identifier, so non-enumeration is unchanged.

**Configuration.** None. The numbers are code-level engineering defaults, checked at startup to be positive integers;
no environment variable can lower them to zero, raise them to infinity or disable the guard.

**Route census** (`apps/api/src/http-security/route-rate-limit.census.ts`, keyed `METHOD /path`):

| Class | / min | / hour | Routes |
|---|---:|---:|---|
| `HEALTH` | 240 | — | `GET /health`, `/health/live`, `/health/ready` |
| `PRE_AUTH_LOOKUP` | 30 | 300 | `POST /account/login-id-availability` |
| `PRE_AUTH_CREDENTIAL` | 20 | 300 | `POST /account/login-id-sign-in`, `POST /account/login-id-verify-email` |
| `PRE_AUTH_MAIL` | 3 | 20 | `POST /account/login-id-resend-verification` |
| `AUTHENTICATED` | 600 | — | first-use read + Welcome, Public ID read, identity read, Name change, Privacy state, the 5 Understanding routes |
| `AUTHENTICATED_MAIL` | 3 | 20 | `POST /account/email/change` |
| `SECURITY_SENSITIVE` | 20 | 120 | Public ID change, Login ID change, Email confirm, password change, sign-out-others, export request + download, deletion request + cancel |
| `CONVERSATION` | 300 | — | the 12 conversation / temporal / projection / context-binding routes |
| `UNCLASSIFIED` (fallback) | 10 | 60 | none; the census spec fails CI for any unclassified route |

All 40 routes are classified, and none is admin or server-only. The 7 routes without an authentication guard are
exactly the health and pre-authentication classes; a spec walks the real `AppModule` graph to prove this.

**Why these numbers.**
- *Pre-authentication sign-in / verify* sit next to Supabase's own per-IP default of 30 per 5 minutes (360 an hour).
  They stop a burst before the database lookup and the provider, and are never a stricter hourly lock-out than the
  provider already applies.
- *Ordinary use.* The 5-second foreground poll is about 12 requests a minute per route per reader. Ten readers behind
  one shared address fit inside the class with room to spare.
- *Health.* A balancer probing every few seconds stays far inside 240 / min per route.
- *PROD-SEC-02.* `0131`'s database-owned admission and work-start budget remain the only AI-cost authority; HTTP
  throttling does not replace or touch them.

## 5. SEC-B — trusted client address

- **Topology.** `QANDEEL_API_PROXY_MODE=direct` (Express `trust proxy = false`; the socket peer is the client; every
  `X-Forwarded-For` is ignored) or `trusted_proxy` with `QANDEEL_API_TRUSTED_PROXIES`, a list of literal IPs / CIDRs.
  Express trusts only those peers and resolves the first untrusted hop.
- **Refused configurations.** `true`; a hop count; Express's named ranges; `/0`; IPv4-mapped IPv6 ranges (which can
  cover every IPv4 peer); an empty or invalid list. The topology is parsed **once**, at startup.
- **Production.** Any environment that is not an explicit `development` / `test` run is held to production's rules.
  A forgotten `NODE_ENV` therefore fails closed instead of starting with a default.
- **No hand-read headers.** No source reads a forwarding header by hand; a static detector checks every production
  file. No provider-specific header is an authority, and no body, query or route field is ever read as an address.
- **The provider relay.** `SupabasePasswordGrantService` normalizes and validates the Express-resolved address
  (IPv4-mapped to IPv4, zone dropped) at the one point where it leaves the process. It forwards it as
  `Sb-Forwarded-For` **only with `SUPABASE_SECRET_KEY`** and fails closed on an invalid address. There is no fallback
  credential.
- **Proven over real sockets.**
  - Direct mode ignores a forged header, and the provider receives the socket address.
  - A trusted proxy's client is resolved.
  - A chain resolves the first untrusted hop, ignoring client-written entries before it.
  - An untrusted peer cannot name a client.
  - A query `ip=` is ignored.
- **External.** The real proxy CIDRs do not exist until hosting is chosen. That is `LAUNCH-EDGE-SECURITY-GATE` item 5.

## 6. SEC-C — security headers

- **Registration.** `configureHttpSecurity` runs in `main.ts` immediately after `NestFactory.create` and before
  `listen` / `init`. It applies `app.disable('x-powered-by')` and Helmet 8 with its defaults kept whole, so the headers
  run in front of every route, the 404 answer, errors, 429s and parser 413s.
- **CSP.** Helmet's default CSP is kept: the API serves JSON only, and no exception is invented for web assets that do
  not exist.
- **CORS.** CORS is not enabled.
- **Proven** on 2xx, 404, an application error and a 429, on a test app and on the real `AppModule`:
  - `X-Powered-By` is absent;
  - `nosniff`, CSP, HSTS, `X-Frame-Options`, COOP and `Referrer-Policy` are present;
  - there is no `Access-Control-Allow-Origin`, including on a preflight from a foreign origin;
  - JSON bodies are unchanged.

## 7. SEC-D — production configuration preflight

`runSecurityPreflight(process.env)` runs in `main.ts` before the application exists. Outside an explicit
development / test run it requires:
- `SUPABASE_URL`, which must be https;
- `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_SECRET_KEY`;
- the proxy mode.

The secret key may not be:
- the publishable key;
- any `sb_publishable_` key;
- a legacy JWT whose role claim is `anon` or `service_role`.

One new-format secret key may serve as both the service-role and the forwarding key. The secret key's own format is
not pinned. Errors name variables and rules, never a value; a test proves that no key fragment appears in a message.
It is not a configuration-framework migration.

The T-12 Phase M gate still boots the real `AppModule` with no Supabase configuration, because the preflight lives in
`main.ts`, not in a module. The hosted project's *IP address forwarding* toggle cannot be observed from the repository
and is `LAUNCH-EDGE-SECURITY-GATE` item 10.

## 8. SEC-E — Data API privilege census and migration 0133

**Root cause.** CI bootstraps a plain PostgreSQL, where a new object is granted to nobody but `PUBLIC`. A hosted
Supabase project's `public` default privileges grant every new function, table and sequence to `anon`,
`authenticated` and `service_role`. So `REVOKE … FROM PUBLIC` is correct in CI and wrong in production.

**Census.** `database/verify-migration-0133.mjs` builds a scratch database carrying Supabase's real `public` default
privileges and replays every migration. **All of `0001`–`0132` apply unchanged.** It then compares each object's
effective privileges against the CI database, whose ACL is exactly what the migrations grant. Measured result:

| Object | Drift on a hosted project | Disposition |
|---|---|---|
| `login_id_is_available_v1(text)` | `anon`, `authenticated` | Server-only (the W2-01 observation). Revoked; `service_role` kept. |
| `read_account_first_use_v1()` | `anon` | Intended `authenticated` owner RPC. `anon` revoked; grant kept. |
| `complete_first_use_welcome_v1()` | `anon` | Same as above. |
| `handle_new_auth_user()` | `anon`, `authenticated` | DEFINER trigger. No direct execution. |
| `provision_qandeel_account_identity_v1()` | `anon`, `authenticated` | DEFINER trigger. No direct execution. |
| 14 `public` trigger functions | `PUBLIC` (in CI as well) | No direct execution. Firing a trigger never checks EXECUTE. |
| `conversation_turn_work_grants_id_seq` (`0131`) | `anon` / `authenticated` `SELECT`, `UPDATE` | Revoked from every application role, matching its table. |
| Every other function, table, view and sequence | none | Unchanged. |

Nothing was ambiguous, so there was no STOP. The only `anon`-executable `public` function left is the deliberate
`qandeel_keepalive()`.

**Migration 0133.** It changes privileges only:
- named revokes for exactly the rows above, re-stating the three intended grants;
- `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE … FROM anon, authenticated` for functions, tables and sequences of
  the migration role, so a hosted project behaves like CI from now on;
- a deploy-time self-assertion that also checks the migration role's default ACL.

It does not edit `0123` or any other migration, and has no broad schema-wide revoke.

**Verification on real PostgreSQL** (focused run `36877293133`, then again after the review fixes):
- the CI matrix holds;
- the server channel still answers availability, and `anon` / `authenticated` get `42501`;
- the owner RPCs still work for their owner and refuse `anon`;
- in the Supabase-defaults database:
  - the census is reproduced exactly, including a real `anon` call to the oracle before `0133`;
  - after `0133`, hosted equals CI for every `public` object;
  - nothing gained a privilege;
  - RLS flags, forced RLS, view options and every policy are unchanged;
  - only the census objects were narrowed;
  - a NEW function, table or sequence is granted to no client role.

## 9. SEC-G — retired identifier digest (P-7): re-owned, not improvised

`identifier_digest_v1()` (`0130`) is `kind:sha256(lower(value))` in a private table that no client role can execute.

**Feasibility evidence:**
1. *Managed secret.* Supabase Vault keeps its root key outside the database and its backups, which suits HMAC custody.
   But it exists only on Supabase infrastructure; the CI database is stock PostgreSQL 17 without it. No migration
   using it could be verified by any QANDEEL gate.
2. *Project capability and data.* This task has no hosted-project database credential: CI holds only the URL, the
   publishable key and test accounts. So neither Vault availability nor an **aggregate** `retired_account_identifiers`
   row count could be read. Nothing was printed or exported.
3. *Legacy rows.* A `v1` digest cannot be converted to HMAC without the original identifier, so a cutover needs a
   proven-zero row count or a dual-read law, and both need the evidence in 1–2.

**Decision.** Under the Task Contract §10.2 and stop condition 6 this is a genuine external key-management
dependency. `0133` carries no digest change at all; a detector rejects any. SEC-G is re-owned to
`FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` (`QAN-BL-LAUNCH-02`). That item records the required
properties: HMAC-SHA-256 under a managed key, `lid2` / `pid2` prefixes, dual-read refusal that keeps `v1` rows, and a
rotation law. Retired-ID reuse prevention is unchanged.

## 10. SEC-F and SEC-H

**SEC-F.** [`infra/LAUNCH_EDGE_SECURITY_CONTRACT_v1.md`](../../infra/LAUNCH_EDGE_SECURITY_CONTRACT_v1.md) is the
vendor-neutral contract, eleven proofs required before public launch:
1. TLS only to users;
2. edge DoS protection;
3. distributed limits;
4. header sanitation by the last proxy;
5. topology matching SEC-B;
6. direct-origin bypass prevention;
7. health compatibility;
8. the same law for WebSocket / Voice;
9. fail-safe edge failure;
10. Supabase IP forwarding live proof;
11. hosted `0133` proof.

It names no provider. The gate is `OPEN`, owned by `LAUNCH-EDGE-SECURITY-GATE` (`QAN-BL-LAUNCH-01`).

**SEC-H — negative evidence.**
- *CORS.* None anywhere; a static detector scans every source.
- *Body size.* Nest's default JSON / urlencoded parsers stay bounded at 100 kB: a 200 kB body is a 413 before any
  route, with headers. No size was changed, so no Product message-length decision was needed.
- *Uploads.* There is no upload or multipart route.
- *PROD-SEC-02.* `0131`, the turn service and `login-id-sign-in.service.ts` are byte-identical (pinned).
- *Readiness.* `PROD-OPS-01`'s single-flight readiness is untouched; health runs at balancer cadence in the spec.
- *Telemetry.* Spans keep an allowlist with no address attribute, and the security boundary logs nothing.

## 11. Verification

| Check | Result |
|---|---|
| API TypeScript build (`tsc --noEmit`) | clean |
| API Jest, full suite (local, host resolver shim) | **209 suites / 4814 tests passed** at the pre-review head; the `http-security` suites re-run after the review fixes: 83/83 |
| `tests/prod-sec-01-api-baseline-security-contract.test.mjs` | 31/31: shipped tree compliant, **27/27 planted defects caught**, plus a coverage guard |
| Root contract suite, all `tests/*.test.mjs` (incl. forward-safety mirror, QHIA-011A, governance) | **990/990** locally |
| `database/tests/*.test.mjs` | **1281/1281** |
| `verify-migration-0133.mjs` on real PostgreSQL 17 (focused gate) | passed, run `36877293133`; re-run after the self-assertion fix: run `36880141952` |
| Task-closure governance contract | 24/24 |
| API CI on the PR head | see PR #301 checks |

Re-anchors made openly:
- Three historical contracts blob-pin `AppModule` through a documented strip chain. Each gains one `PROD-SEC-01`
  re-anchor line stripping the `HttpSecurityModule` composition; every other byte stays frozen.
- The frozen QHIA-011A contract forbids any non-owner source from naming the context-activation controller. The census
  is therefore keyed by route, not by controller class, and imports no controller.

## 12. Review findings and their disposition

`code-review` (high) found 9. Fixed:
1. The preflight falsely refused one secret key used as both server keys.
2. An unset `NODE_ENV` failed open.
3. IPv4-mapped IPv6 trusted ranges could trust every IPv4 peer.
4. `0133`'s default-ACL prevention was not self-asserted.
5. The census cache ignored the controller.
6. The static detector skipped non-literal route paths.
7. A tautological assertion.
8. An inefficient 1,200-socket burst.

**Not changed, deliberately: carrier-grade NAT sharing.** Readers behind one carrier address share the per-address
pre-auth buckets. The classes are sized next to the provider's own per-IP limits, which share the same way. Ordinary
authenticated use is generous (600 / 300 per minute), and mail is the only tight class, as the Task Contract requires.
Per-user or distributed keying at the edge is `LAUNCH-EDGE-SECURITY-GATE` item 3, and the numbers are engineering
defaults to tune from launch traffic. This is a recorded trade-off, not an open defect.

## 13. BG-08 reconciliation

- **Inherited:** `QAN-BL-PROD-02`, widened by the Task Contract to the whole direction and tombstoned by this task.
- **Admitted, each with one named owner:** `QAN-BL-LAUNCH-01` (`HIGH`, `LAUNCH-EDGE-SECURITY-GATE`) and
  `QAN-BL-LAUNCH-02` (`MEDIUM`, `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate`).
- **Unchanged:** `PROD-AUTH-01` and `PROD-DATA-01` keep their items; no duplicate row is created for them, W3
  Understanding, W3 Memory or Connected Worlds deletion.
- **Register:** 32 items — 7 `DEFERRED — OWNED`, 10 `OPEN — UNASSIGNED`, 15 `CLOSED — TOMBSTONE`.

## 14. SEC-A..H Gap Closure Matrix

| Gap | Final disposition | Evidence / owner |
|---|---|---|
| SEC-A rate limiting | **FIXED** (origin, per instance) + distributed limit → **DEPENDENCY** | Global guard + route census (§4); e2e 429s per class, polling / health cadence, aggregate window, key purity; distributed / global → `LAUNCH-EDGE-SECURITY-GATE` item 3 |
| SEC-B trusted client IP | **FIXED** (mechanism) + real CIDRs → **DEPENDENCY** | Explicit topology, never `true` or a hop count; real-socket direct / trusted / chain / untrusted-peer proofs; normalized `Sb-Forwarded-For` (§5); CIDRs → gate item 5 |
| SEC-C security headers | **FIXED** | Helmet before routes, `X-Powered-By` off, no CORS; proven on 2xx / 404 / error / 429 / 413 and on the real `AppModule` (§6) |
| SEC-D secrets / IP forwarding | **FIXED** (repo preflight) + hosted toggle → **DEPENDENCY** | `runSecurityPreflight` in `main.ts`; no substitute key, no value printed (§7); hosted IP forwarding live proof → gate item 10 |
| SEC-E RPC privilege drift | **FIXED** | `0133` + Supabase-defaults census verifier on real PostgreSQL: 5 functions, 14 trigger functions, 1 sequence; hosted == CI; nothing broadened (§8); hosted application proof → gate item 11 |
| SEC-F edge / WAF / TLS / origin | **DEPENDENCY** | Vendor-neutral contract `infra/LAUNCH_EDGE_SECURITY_CONTRACT_v1.md`; `LAUNCH-EDGE-SECURITY-GATE` (`QAN-BL-LAUNCH-01`), `OPEN` |
| SEC-G retired identifier digest | **DEPENDENCY** | Feasibility evidence §9; no fake hardening; `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` (`QAN-BL-LAUNCH-02`) |
| SEC-H negative baseline | **NO ISSUE** (proven) | No CORS, 100 kB parser bound → 413, no upload route, PROD-SEC-02 / non-enumeration / telemetry pinned, readiness single-flight intact (§10) |

**Orphan gaps: 0.** Every row is fixed, proven not an issue, or owned by one named Exit Gate recorded in the canonical
backlog.
