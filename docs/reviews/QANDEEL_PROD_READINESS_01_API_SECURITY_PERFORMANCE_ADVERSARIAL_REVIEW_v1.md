# QANDEEL — PROD-READINESS-01 — API Security & Performance Adversarial Review v1

**Status:** `PROD-READINESS-01` — **REVIEW COMPLETE — AWAITING PRODUCT OWNER DECISION ON CORRECTIVE TASKS**
**Type:** Review / measurement / adversarial production-readiness gate. It implements nothing in production code.
**Baseline:** `main = fe9d9155f122725cb669e9989fa35ff12916112a` (merge of PR #297, `VPORT-01`). Confirmed by
`git fetch` at review time; `main` had not advanced.
**Branch:** `review/prod-readiness-01-api-security-performance`. Draft PR #298. Not merged; no auto-merge.

This record is evidence, not authority. It decides no Product semantics, chooses no infrastructure provider and
authorizes no implementation. Every corrective task in §16 waits for a Product Owner decision.

---

## 0. Method and evidence classes

| Class | Meaning in this record |
| --- | --- |
| **STATIC** | read from repository source at the baseline, with a `file:line` citation |
| **MEASURED** | produced by the bounded harness in §6, run in CI (run `36830247454`, artifact `prod-readiness-01-auth-path-measurement`) |
| **PRIMARY DOC** | current Supabase / provider documentation or upstream source, cited |
| **NOT ESTABLISHED** | depends on deployment or provider truth the repository does not hold |

The only non-documentation additions in this PR are the measurement harness
`scripts/prod-readiness-01/auth-path-measurement.mjs` and its proof workflow
`.github/workflows/prod-readiness-01-auth-path-proof.yml`. The workflow is triggered only by changes to those two
files, or manually. No production module, migration, mobile file or existing workflow is touched.

Two read-only tracing passes covered the API call graph per route (§10) and the mobile journeys (§9). Before any
finding was classified, its load-bearing claims were re-verified against source. Those re-checks are cited inline.

---

## 1. Exact repo truth (baseline `fe9d915`)

| Claim at hand-off | Verified | Evidence |
| --- | --- | --- |
| No global rate limiting | **TRUE** | `apps/api/src/main.ts:6-11`; no `ThrottlerModule`, `APP_GUARD`, `APP_INTERCEPTOR` or limiter anywhere in `apps/api/src` |
| No `ThrottlerModule` / `ThrottlerGuard` | **TRUE** | `apps/api/src/app.module.ts:17-20` |
| No security-header setup in `main.ts` | **TRUE** | `main.ts` only creates the app and listens on `0.0.0.0` |
| `@nestjs/throttler` / `helmet` absent | **TRUE** | `apps/api/package.json` |
| `infra/` proves no WAF / edge | **TRUE**, and stronger: the whole repo holds no deployment config | `infra/README.md` is the only file. There is no Dockerfile, compose, `fly.toml`, `render.yaml`, `railway.json`, Terraform/Pulumi, nginx/Caddy or `wrangler.toml` anywhere |
| Guard → `authenticate()` → `fetch /auth/v1/user` on every invocation | **TRUE** | `auth/supabase-auth.guard.ts:9-16`, `auth/supabase-auth.service.ts:21-24` (5 s abort) |
| Temporal pages bounded | **TRUE** | `MAX_TEMPORAL_EVENT_PAGE = 256`, default 64 (`conversation-unit/temporal-delivery.repository.ts:27-28`); the controller and SQL both refuse out-of-range limits |
| Historical Projection = one explicit read | **TRUE** | one RPC `get_session_historical_projection_v1` (`historical-projection/historical-projection.repository.ts:44`) |
| Mobile projection cache | **TRUE** | `apps/mobile/src/projection/historical-projection-cache.ts`, keyed `(sessionId, tc, depth)`, with in-flight dedupe in `integration/projection/projection-coordinator.ts:193-198` |
| `LivingAnalysisMap` uses idempotent `ensure()` | **TRUE** | `integration/composition/LivingAnalysisMap.tsx:85-100` |
| Conversation history paginated | **TRUE** | default 50, max 100, keyset cursor (`conversation/conversation.service.ts:40-41`, `conversation.repository.ts:137`) |

Framework facts (STATIC, from installed packages): NestJS `11.2.1`, Express `5.2.1`, body-parser `2.3.0`.

- The JSON / urlencoded body limit defaults to **100 KB** (`body-parser/lib/utils.js:61-63`).
- Express enables `x-powered-by` (`express/lib/application.js:94`).
- `trust proxy` defaults to `false` (`:99`).
- Nest calls no `enableCors`.

---

## 2. Route census (all externally reachable HTTP routes)

There are 37 routes in 9 controllers. **Connected Worlds has no HTTP surface:** there is no controller under
`apps/api/src/connected-worlds`, and `AppModule` does not import it. Memory, Hypothesis, Question, HIM,
Runtime-Events, Background and Post-Response Intelligence expose no controllers. The mobile client never calls
`GET /conversation/sessions/:id`, `PATCH …/cancel` or the context-binding routes, but they are still reachable.

| Group / route | Auth | R/W | Provider (model) cost | DB / upstream cost per call | Abuse consequence | Current limit / protection |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /account/login-id-availability` | **none** | R | none | 1 service-role RPC | Login-ID existence oracle (W1B-01 record §6 "acknowledged, unthrottled oracle"); service-role DB load | **none at any layer** |
| `POST /account/login-id-sign-in` | **none** | W | none | 0–1 service-role RPC + 1 Supabase password grant | credential stuffing by Login ID | Supabase per-IP limit only, keyed by `request.ip` (§3.3) |
| `POST /account/login-id-verify-email` | **none** | W | none | 0–1 RPC + 1 `/auth/v1/verify` | OTP guessing | Supabase per-IP limit (30 / 5 min) only |
| `POST /account/login-id-resend-verification` | **none** | W | none | 0–1 RPC + 1 `/auth/v1/resend` | mail flooding of a victim's unverified Email | Supabase per-IP and per-address limits only |
| `GET /health`, `/health/live` | none | R | none | 0 | none (static) | none needed |
| `GET /health/ready` | none | R | none | 1 `HEAD /rest/v1/` | 1:1 amplification into Supabase; discloses fixed dependency states only (by contract) | none |
| `POST /conversation/sessions/:id/turns` | guard | W | **1 reply + 2 segmentation + N focus + continuity screening** (§10.2) | ~9–15 Data API + ~7 service-role RPCs + Auth | **unbounded model spend**, provider quota exhaustion | **none:** no in-flight, rate or cost bound per session or per user |
| `PATCH …/turns/:turnId/cancel` | guard | W | none | 2 | low | none |
| `POST /conversation/sessions` | guard | W | none | 1 RPC | session-row growth | none |
| `GET /conversation/sessions/:id` | guard | R | none | 1 | low | none |
| `GET …/turns` | guard | R | none | 3 (+1 with cursor) | low; bounded page | page ≤ 100 |
| `GET …/temporal`, `…/temporal/events`, `…/temporal/live-focus-events` | guard | R | none | 1 RPC each | catch-up hammering; each call is also one Auth hop | page ≤ 256 |
| `GET …/historical-projection` | guard | R | none | 1 RPC that recomputes full `K(TC)` | `tc × depth` spray recomputes the whole projection every call | none (no server cache) |
| context-bindings `PUT` / `DELETE` / `GET` | guard | W/R | none | 1 RPC | low | none |
| `GET /understanding/items`, `GET /understanding/items/:ref` | guard | R | none | 1–4 / ~6, batched | low | list ≤ 32 |
| Understanding `POST`/`DELETE …/discussion`, `POST …/disagreement` | guard | W | none | 2 / 2 / ~7 | low | none |
| `GET /account/first-use`, `POST …/welcome`, `GET /account/public-id`, `POST …/public-id/change` | guard | R/W | none | 1 RPC | low (public-id change is one-per-lifetime in SQL) | none |
| `GET /account/identity` | guard | R | none | 1 RPC + 1 extra `/auth/v1/user` | low | none |
| `POST /account/{name,login-id,email,password}/…`, `POST /account/sessions/sign-out-others` | guard | W | none | 1–5 Supabase Auth calls (password proof, update, logout) | password-proof guessing from a stolen session | Supabase per-IP limits via `Sb-Forwarded-For` (§3.3) |
| `GET /account/privacy`, `POST …/export`, `GET …/export/download`, `POST …/deletion`, `POST …/deletion/cancel` | guard | R/W | none | 1 RPC + up to 3 Auth calls; the download returns the **whole export package** | heavy repeated export download | none (`Cache-Control: no-store` only) |

---

## 3. Security-header, rate-limit and transport census (Track A)

### 3.1 Rate limiting and throttling

- **Application layer:** absent on every route (§1).
- **Hidden equivalents searched for, none found:** middleware, interceptors, guards other than `SupabaseAuthGuard`,
  Redis at request time, a DB-side per-user counter on turn admission, per-user provider budgets.
  - Redis is used only by the outbox publisher and the post-response consumer
    (`runtime-events/runtime-event.publisher.ts:21,29`).
  - The only cost cap is `POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3` calls **per post-response execution, i.e.
    per turn** (`post-response-intelligence/post-response-provider-budget.ts:84`). It is not per user and does
    not cover the foreground path.
- **Provider-side protection that does exist:**
  - Supabase Auth's own per-IP limits on password grant, verify and resend. W2-01 kept these deliberately rather
    than replacing them (`docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md` §4.4; `account/supabase-password-grant.service.ts:18-24`).
  - These cover only the routes that relay to Supabase Auth. They do **not** cover
    `login-id-availability`, `health/ready`, or any Data-API or model-provider route.
- **Turn admission** (`database/migrations/0030_conversation_session_authority_hardening_v1.sql:88-108`, re-verified):
  - It checks ownership, `ACTIVE/TEXT` and content length ≤ 20 000, then inserts.
  - Nothing bounds concurrent `RECEIVED`/`GENERATING` turns per session or per user.
  - The only lock is the per-turn claim (`FOR UPDATE` in `0062`).

### 3.2 Security headers, CORS, body, timeouts

| Item | State | Assessment |
| --- | --- | --- |
| Helmet / native headers | none | The API is a JSON API consumed by a native app. CSP and frame headers protect browser documents and add little here. `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` are the useful ones on JSON. `no-store` is already set on every Privacy route. |
| `X-Powered-By: Express` | sent | Minor fingerprinting; trivially removable |
| HSTS | none at origin | It belongs to whatever terminates TLS (edge / platform). The origin should not own it while that is undecided. |
| CORS | not enabled, so browsers are denied cross-origin | **Correct** for a mobile-only API. Native clients do not use CORS. |
| Body limits | 100 KB default (JSON and urlencoded); turn content ≤ 20 000 chars in SQL and service | **Adequate.** An oversized body is refused with 413 before any handler runs. |
| Request / headers timeouts | Node defaults (`requestTimeout` 300 s, `headersTimeout` 60 s) | Bounds slow-header attacks. There is no **per-request work deadline** on `createTurn` (§10.2). |

### 3.3 Trusted proxy and client IP

- `trust proxy` is unset, so `request.ip` is the TCP peer.
- That value is forwarded to Supabase Auth as `Sb-Forwarded-For` by every Login-ID, identity, security and privacy
  route (`account/supabase-password-grant.service.ts:214,247`).
- **Behind any reverse proxy, every reader becomes the proxy's address.** The recommended backend host
  (`docs/implementation-foundation/QANDEEL_Recommended_TECH_STACK_v1.0.md` "Backend V1: Railway") puts a platform
  proxy in front of the service, so this applies to it.
  - With the default `30 requests / 5 min / IP`, a single shared bucket would cap Login-ID sign-in for **all users
    together**.
  - One attacker could exhaust it on purpose: a global lock-out.
- **The obvious fix is also a trap.** `trust proxy = true` would let a client spoof `X-Forwarded-For`, rotate
  "IPs" and bypass the provider's per-IP limit entirely. The correct setting is the exact hop count, or the exact
  proxy address range, of the chosen edge. That makes it deployment truth.
- **Anti-duplication:** W2-01 already recorded this as an external gate ("an API edge configured so `request.ip`
  is the reader's real address", record §7 item 4 and §11). This review confirms it at the baseline and classifies it. It
  does not re-own it.
- The other prerequisites of that gate are **NOT ESTABLISHED by repository**:
  - `SUPABASE_SECRET_KEY` appears in neither `.env.example` nor the CI secret names.
  - The project's `security_sb_forwarded_for_enabled` flag is not observable from code.
  - Without the secret key these routes **fail closed** with 503, which is safe.

### 3.4 Health / admin exposure

- **There is no admin or ops HTTP surface.** `/health` and `/health/live` are static. `/health/ready` discloses
  fixed dependency names and bounded states only (`docs/health-readiness-dependency-probes-v1.md`), which is
  acceptable disclosure.
- **MEASURED + PRIMARY DOC — the readiness probe cannot pass against the current project.**
  - The database probe sends `HEAD ${SUPABASE_URL}/rest/v1/` with the publishable key and treats any non-2xx as
    `unavailable` (`health/database-health.probe.ts:6`).
  - The harness sent exactly that request 20 times against the CI test project. **All 20 returned `401`** (§6).
  - Cause: Supabase withdrew access to the Data API root / OpenAPI schema for anon and publishable keys, as of
    11 March 2026 ([changelog: "Breaking Change: Removing access to OpenAPI spec via the anon key"](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key)).
  - Consequence: `/health/ready` reports `database: unavailable`, i.e. `503 not_ready`.
  - A load balancer configured as the health contract itself prescribes ("`/health/ready` for traffic admission")
    would **never admit traffic**.

### 3.5 Multi-instance implications

- Any QANDEEL-owned limiter must use **shared storage** (the existing Redis / Upstash) once more than one API
  instance runs. An in-memory limiter is correct only for an intentionally single-instance deployment, and
  instance count is NOT ESTABLISHED.
- **Storage-outage behaviour must be decided explicitly:**
  - fail-open (availability) for ordinary reads;
  - fail-closed or degrade-to-local for the unauthenticated credential routes and turn admission.
- **A per-user turn concurrency bound needs no Redis at all.** It belongs naturally in the existing turn-admission
  SQL, which is already the authority (§16, PROD-SEC-02).

---

## 4. Deployment / edge / WAF truth

| Property | Classification | Evidence |
| --- | --- | --- |
| Deployment definition (container, platform manifest, IaC) | **PROVEN ABSENT** | §1 file census |
| Hosting choice | recommended, not frozen as deployment | Tech Stack v1.0 "Backend V1: Railway". It is a recommendation; no manifest exists. |
| Reverse proxy / ingress / load balancer | **NOT ESTABLISHED BY REPOSITORY** | none in repo |
| Cloudflare / CDN / WAF | **NOT ESTABLISHED BY REPOSITORY** | Cloudflare appears only as Quick Tunnels used for proof runs (`docs/final-living-analysis-map-integration-v1-phase-m.md` §M), not as an edge |
| TLS termination / HSTS owner | **NOT ESTABLISHED** | none in repo |
| Origin exposure policy | **NOT ESTABLISHED** | `app.listen(port, '0.0.0.0')` binds all interfaces; nothing restricts the origin to an edge |

**This review chooses no provider (stop condition 2).** The required edge properties, for whichever edge the
Product Owner / Company selects:

1. TLS termination with HSTS owned at the edge.
2. Origin reachable **only** through the edge (platform private networking, or an origin allow-list / authenticated origin pull).
3. Edge rate limiting per client IP for the unauthenticated routes and an overall per-IP request ceiling.
4. Managed WAF rules where the provider offers them (malformed-body and L7 flood classes).
5. A **documented, fixed proxy hop count**, so the API's `trust proxy` can be set exactly (§3.3).
6. Edge logs that carry no request bodies, no `Authorization` header and no user content.

Edge controls do **not** replace the application-layer bounds that are semantic: per-user turn concurrency and
cost (§3.1), and per-account abuse of authenticated routes. An IP-based edge cannot see the user.

---

## 5. Auth path map (Track B)

```
mobile ──HTTPS──▶ QANDEEL API
                   └─ SupabaseAuthGuard ─▶ SupabaseAuthService.authenticate()
                         └─ GET {SUPABASE_URL}/auth/v1/user   (publishable key + bearer; 5 s abort)   ← hop A
                   └─ route work ─▶ Supabase Data API / RPC (user token or service role)              ← hops D…
                                 └─ (turns only) model provider(s)                                    ← hops P…
                                 └─ (account/privacy only) Supabase Auth again                        ← hops A′…
```

- **Guarded routes:** every route in §2 except the four unauthenticated `account` routes and the three `health`
  routes.
- **Hop A happens exactly once per guarded request.** The guard is applied once per controller or route, and there
  is no global guard to double it.
- **Representative external hop counts**, success path, excluding the mobile→API hop itself:

| Route | Auth hops | Data API / RPC hops | Provider hops |
| --- | --- | --- | --- |
| `GET …/temporal` (the 5 s poll) | 1 | 1 | 0 |
| `GET …/historical-projection` | 1 | 1 | 0 |
| `GET …/turns` | 1 | 3 (+1 with cursor) | 0 |
| `GET /understanding/items` | 1 | 1–4 (batched, parallel) | 0 |
| `GET /account/identity` | **2** (guard + `readOwnUser`) | 1 | 0 |
| `POST /account/privacy/export` | **4** (guard + user + password grant + logout) | 1 | 0 |
| `POST …/turns` (new, ALLOW) | 1 | ~16–22 incl. service-role | ≥ 1 + 2 + N + continuity |

**Upstream rate-limit check (PRIMARY DOC + upstream source).** The Supabase Auth rate-limit table lists
`/auth/v1/user` under the per-IP "sign-ups and sign-ins" class without naming a method
([Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)). If that applied to `GET`, every guarded
request leaving the API from one egress IP would share one 30 / 5 min bucket, which would be a P0.

The upstream Auth server source settles it: `r.Get("/", api.UserGet)` carries **no** limiter, and only
`r.With(api.limitHandler(api.limiterOpts.User)).Put("/", api.UserUpdate)` does (`supabase/auth`
`internal/api/api.go`). **The guard's `GET` hop is not per-IP rate-limited, so no shared-bucket blocker exists.**

---

## 6. Auth latency measurements (MEASURED)

**Harness:** `scripts/prod-readiness-01/auth-path-measurement.mjs`, run by CI run `36830247454`
(ubuntu-latest, Node 22.23.3) against the existing CI test project with the existing T-12 test account A.

- **Load:** one sign-in, 20 requests per measured hop, and one sign-out of the session the harness itself created
  (`scope=local`). No other session of the account was touched.
- **Output:** timings, counts, booleans and claim *names* only.

| Hop | Cold (ms) | Warm p50 (ms) | Warm p95 (ms) | Warm min / max (ms) | Status |
| --- | --- | --- | --- | --- | --- |
| **Guard hop A** `GET /auth/v1/user`, valid token | 482.3 | **441.4** | 479.0 | 157.9 / 479.0 | 200 |
| Guard hop A, invalid signature | — | 163.0 | 474.8 | 152.6 / 474.8 | 403 |
| Data API round trip `HEAD /rest/v1/` (baseline) | 12.4 | **31.8** | 47.2 | 25.0 / 47.2 | 401 (§3.4) |
| **Local ES256 verify** (WebCrypto, 500 iterations) | key import 2 ms | **0.145 per verify** | — | — | signature valid |

**Interpretation, bounded to what was measured:**

- **From the same runner, the guard's remote hop costs about 14× a Data API round trip at p50** (441 ms vs 32 ms).
  The gap is server-side processing in Supabase Auth, not network distance: both hops share the same host and path.
- The valid-token path is consistently slower than the reject path, about 440 vs 160 ms. That is consistent with
  Auth loading the user and session for a valid token.
- **These are runner→project numbers, not production truth.** The production API's region relative to the project
  is NOT ESTABLISHED, and the CI project's tier may differ from production. The *ratio* is the decision-relevant
  result; the absolute values must be re-measured from the chosen deployment region.
- **Timeout path:** a non-answer is cut at 5 s and becomes 503 (`supabase-auth.service.ts:21-27`). This was not
  induced, because the hand-off forbids destructive load.

**Load multiplier (STATIC, mobile).** The foreground live driver polls `GET …/temporal` every **5 000 ms on every
foreground screen** (`apps/mobile/src/runtime-entry/live/live-driver-scheduler.ts:30`; driver
`foreground-live-driver.ts:214`). Every foreground user therefore causes at least **12 guard hops per minute** to
Supabase Auth, before any interaction.

The scheduler's own comment ties the 5 s cadence to this hop's 5 s budget
(`live-driver-scheduler.ts:7-13`). The poll is deliberate, because there is no push channel. Supabase Auth
capacity at N concurrent users × 12 / min is **NOT ESTABLISHED**.

---

## 7. JWKS / local-verification feasibility (Track B3 / B4)

### 7.1 Project truth (MEASURED)

| Question | Answer |
| --- | --- |
| Signing algorithm | **ES256** (asymmetric, P-256). The token header carries a `kid` that is present in the JWKS. |
| JWKS available | **yes**: `GET /auth/v1/.well-known/jwks.json` → 200, 1 key (`kty: EC`, `crv: P-256`, `alg: ES256`) |
| Claims present | `aal, amr, app_metadata, aud, email, exp, iat, is_anonymous, iss, phone, role, session_id, sub, user_metadata` |
| Access-token lifetime | 3 600 s |
| Local verification cost | ≈ 0.145 ms per verify, 2 ms one-time key import |

### 7.2 The revocation experiment (MEASURED, decisive)

The harness signed out its own session (`POST /auth/v1/logout?scope=local` → 204) and then asked both verifiers
about the same, still-unexpired token:

| Verifier | Verdict on a signed-out session's token |
| --- | --- |
| Remote `GET /auth/v1/user` (today's guard) | **403: refuses it** |
| Local ES256 signature + `exp` check | **accepts it** (signature valid, token unexpired) |

This matches Supabase's own statement that local verification "cannot detect" session revocation, user sign-out or
account deletion, and that custom backends must account for this themselves
([JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)).

### 7.3 Consequences for QANDEEL's frozen semantics

QANDEEL relies on remote revocation in at least these places:

- `POST /account/sessions/sign-out-others`;
- password change ending other sessions (`CHANGED_SIGNED_OUT`);
- Login-ID / Email change ending the proof session;
- Privacy export / deletion proof sessions (`account-security.service.ts:120-213`, `privacy-data.service.ts:100-170`);
- account deletion.

**Replacing the remote hop with local-only verification globally is UNSAFE.** A token from a device that was
"signed out of other devices" would keep working against the API for up to 3 600 s. That silently changes frozen
security semantics (stop condition 3).

### 7.4 Options (for PROD-AUTH-01; this review chooses none)

| Option | Latency | Revocation semantics | Cost / risk |
| --- | --- | --- | --- |
| **O1 — keep remote verification** | about +440 ms per guarded request (measured ratio) | exact (today) | Auth-server load × poll rate (§6) |
| **O2 — hybrid: local ES256 verify + session-liveness check** | about +30 ms (one Data API round trip) instead of about +440 ms | exact, if the liveness check reads the authoritative session row for `session_id` | Needs a narrowly-granted definer read of session liveness, i.e. a schema / security change. Sensitive account and privacy routes keep the remote hop. |
| **O3 — local ES256 verify + short-TTL cache of remote verdicts** | ≈ 0 ms on a hit | revocation lag = TTL | Needs explicit PO acceptance of a lag (see below) |
| **O4 — local-only** | ≈ 0 ms | **broken** (§7.2) | rejected by evidence |

**What any local verifier must enforce, under every option:**

- `alg = ES256` only, so the `none` and HS256 downgrade is rejected;
- a `kid` that resolves in the JWKS;
- `iss = {SUPABASE_URL}/auth/v1` and `aud = authenticated`;
- `exp`, and `nbf` when present;
- `sub` matching the UUID pattern the guard already enforces;
- JWKS cached for **≤ 10 min**, with refetch on an unknown `kid`. Supabase says do not cache longer, and wait
  ≥ 20 min across standby / revoke.

**B4 answers for O3** (shown only so the trade-off is concrete):

| Question | Answer |
| --- | --- |
| Cache key | SHA-256 of the token, never the token itself |
| TTL | at most the accepted revocation lag, which is a PO decision |
| Key rotation | independent: the signature is re-checked on every request |
| Revocation, sign-out-others, password change | lag ≤ TTL. That is unacceptable unless the PO accepts it, and the routes that *perform* revocation must also evict the acting token's entries. |
| Identity change / account deletion | lag ≤ TTL; the deletion path must evict |
| Memory bound | an LRU with a fixed entry cap |
| Multi-instance | a per-instance cache makes eviction non-global, so it needs a shared store or a TTL short enough that this does not matter |

Under O3, **never cache a negative or 503 verdict as positive.**

---

## 8. List endpoint census (Track C1)

| Endpoint | Page / window bound | Ordering / cursor | DB calls | Index | Cache | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| `GET …/turns` | default 50, max 100; `limit+1` probe for `hasOlder` | `created_at desc, id desc`, keyset `before = userTurnId` | 3 (+1 anchor): session, user page, **one batched** `source_turn_id=in.(…)` | `(session_id, created_at, id)` `0001:69`; `UNIQUE(source_turn_id)` `0003:10` | none | **NO ISSUE**: bounded multi-query by design |
| `GET …/temporal` | single snapshot | — | 1 RPC, ownership checked in SQL | — | none | **NO ISSUE** |
| `GET …/temporal/events` | 1..256, default 64; SQL **rejects** out-of-range | `first_sp` asc, `afterSp` cursor | 1 RPC | `(session_id, first_sp)` `0065:167` | none | **NO ISSUE** |
| `GET …/temporal/live-focus-events` | 1..256, default 64 | `session_position` asc | 1 RPC | `(session_id, session_position DESC, …)` `0071` + unique | none | **NO ISSUE** |
| `GET …/historical-projection` | one projection at one `tc` | — | 1 RPC that recomputes full `K(TC)` | — | **server: none**; mobile: per `(sessionId, tc, depth)` | no network N+1; size **NOT ESTABLISHED** (§12) |
| `GET /understanding/items` | ≤ 32 (default = max) | most recently changed first | 1 + 3 parallel batched reads | `hypotheses_user_active_idx` `0005:43`, confidence `0006:46` | none | **NO ISSUE** |
| `GET /understanding/items/:ref` | updates and transitions ≤ 16 each | — | ~6, parallel | `0008:19`, `0036:120` | none | **NO ISSUE** |
| `GET /account/privacy` | single state row | — | 1 RPC | — | `no-store` | **NO ISSUE** |
| `GET /account/privacy/export/download` | **unbounded** single JSON package | — | 1 RPC that builds the whole package (`0130:545-616`) + 1 Auth | — | `no-store` | size **NOT ESTABLISHED** (§12) |
| Connected Worlds collections | **no HTTP surface** | — | — | — | — | **NO ISSUE**: not exposed |

---

## 9. Journey request fan-out matrix (Track C2, STATIC from mobile source)

Every mobile→API request below costs one Auth hop A on the server. There are no direct PostgREST, RPC or realtime
calls from mobile; the Supabase client is used for auth only (`runtime-entry/auth/supabase-auth-port.ts:348`).
There is no `StrictMode` wrapper, so double effects are not expected.

| # | Journey | Mobile→API requests | Parallel / waterfall | Duplicates | Cache | API→Auth | API→Data/RPC | N+1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Launch / resume | `GET /temporal` → `GET /historical-projection?tc=LH` (WORLD) → `GET /temporal` (driver) ∥ `GET /account/first-use` → `GET /turns?limit=50` | **waterfall of ~5 levels** | **`GET /temporal` ×2 within ms** | fills projection `(LH, WORLD)` | 5 | 1+1+1+1+3 = 7 | none |
| 2 | Send turn | `POST /turns` → `GET /temporal` → `GET /temporal/events` (→ `live-focus-events` if LF moved); +2 projection reads if Analysis is mounted | sequential (catch-up); projections in parallel | none in the normal path; a same-key `POST` replay on `OUTCOME_UNKNOWN` (idempotent) | projection at the new LH is always a miss | 3–6 | §10.2 + 1–2 | none |
| 3 | Enter Analysis | `?tc=LH&depth=WORLD` (usually a **hit**) + `?tc=LH&depth=SESSION` (miss) | parallel | none (in-flight dedupe) | 1 hit, 1 miss | 1–2 | 1–2 | none |
| 4 | Pan | **0** (one `PAN` dispatch at gesture end; same key) | — | — | hit | 0 | 0 | none |
| 5 | Semantic zoom | ≤ **1** per finished pinch (new rung) | — | none | hit if the rung was visited at this TC | 0–1 | 0–1 | none |
| 6 | Temporal preview (scrub) | **0** (preview reads the cache only) | — | — | cache only | 0 | 0 | none |
| 7 | Temporal commit | ≤ **2** (camera depth + SESSION track) | parallel | none | sealed `tc < LH` entries are kept forever, so a revisit costs 0 | 0–2 | 0–2 | none |
| 8 | Return Live | 0–**2** at `(LH, depth)` | parallel | none | usually a miss after LH advanced (open-head entries invalidate) | 0–2 | 0–2 | none |
| 9 | Older history | `GET /turns?limit=50&before=…`, one per page | one in flight | none | none (merged in memory) | 1 / page | 4 / page | none |
| 10 | Understanding | `GET /understanding/items` → `GET /understanding/items/:ref` → list again on back | sequential, user-driven | list re-read after each item | none | 1 each | 1–4 / ~6 | none |
| — | Idle on any foreground screen | `GET /temporal` every 5 s; catch-up pages only when behind (≤ 1 + 16×2 per cycle) | — | — | — | **12 / min** | 12 / min | none |

**Truth-boundary notes, i.e. what must NOT be merged:**

- The projection pair in journeys 3, 7 and 8 is **two distinct disclosures**: the camera's semantic depth and
  the Timeline's SESSION-depth track. Folding them into one request would merge two disclosure authorities.
  **NO ISSUE.**
- The `temporal` snapshot and the projection are **different truths** (live delivery vs historical disclosure),
  so they stay separate.
- The Understanding list re-read after an item may reflect a disagreement or discussion just recorded. It is one
  bounded request and reads as truth refresh: **NO ISSUE.**

**Avoidable client fan-out (STATIC, all P2):**

- **M-01 Launch waterfall.** The history read waits behind first-use (`account/first-use/FirstUseGate.tsx:34-39`)
  and the bootstrap projection, although neither is a data dependency of it.
- **M-02 Duplicate launch snapshot.** The driver's first cycle repeats bootstrap's `GET /temporal` immediately
  (`foreground-live-driver.ts:318-321`).
- **M-03 History re-read on every Analysis → Conversation return**, because `ConversationSurface` remounts
  (`conversation/ConversationSurface.tsx:241-243`) even though the controller already holds the exchanges.
- **M-04 First-use read retries forever.** It uses a 6 s attempt timeout and 1/2/4/8/15 s delays with the last
  repeating, and attempts can overlap (`account/account-controller.ts:67-69,107-118`).
- **M-05 `loadOlder` has no failure backoff.** A failed page clears `loadingOlder`, so scrolling near the top
  re-issues as often as every 64 ms (`conversation/conversation-controller.ts:370-382`, scroll throttle
  `ConversationSurface.tsx:445`). Re-verified.
- **M-06 The idle 5 s poll runs on screens that display no Live state.** It is deliberate (§6), so any change is
  an optimization that must keep foreground-resume and explicit catch-up immediate. It is **not** a removal
  candidate without a push-channel decision.

**Client correctness risks observed in passing (NOT ESTABLISHED, not performance):**

- A failed projection key is re-asked only on an unrelated store change, with no retry of its own
  (`projection-coordinator.ts`).
- A SESSION-depth `hold()` carrying a newer open-head revision can drop the camera-depth entry without
  re-requesting it (`historical-projection-cache.ts:65-75`, `LivingAnalysisMap.tsx:95-100`).
- Neither was reproduced. Both are routed to PROD-DATA-01 as *verify-first* items.

---

## 10. DB / Data API query-call matrix (Track C3, STATIC)

### 10.1 Per route

See §2 and §8 for the read routes. Every Data API or service-role call is one HTTP fetch with a 5 s timeout
(`conversation/supabase-data-api.service.ts:83`, `supabase-service-role-api.service.ts:27`).

### 10.2 `POST /conversation/sessions/:id/turns`, new turn, Safety ALLOW

Re-verified: semantic establishment runs **inline, before the response**
(`conversation/conversation.service.ts:63-112` → `establishSemanticChain`).

| Phase | Calls |
| --- | --- |
| Guard | Auth × 1 |
| Session check, idempotency lookup, admission RPC, claim RPC | Data API × 2–3, RPC × 2 |
| Context builder | Data API × 1–2 (last 4 completed exchanges, batched) |
| Parallel foreground lanes (HIM snapshot / reflection 300 ms, Question 300 ms, Memory / Hypothesis ≤ 5 s ceiling) | RPC × 3–5, Data API × 1–6 |
| Reply | provider × 1 (`max_output_tokens` 1024, timeout ≤ 10 s, `maxRetries 0`) |
| Finalize | service-role RPC × 1 |
| Semantic establishment (inline) | 3 RPCs; provider × 2 segmentation (parallel); **provider × N focus, sequential, one per CU** (`conversational-focus-evaluator.service.ts:157-158`); per new-focus CU, **⌈T/32⌉ dossier-page RPCs and ⌈T/32⌉ sequential `screen` provider calls** + 0–2 (T = the user's Thread count; `thread-continuity-evaluator.service.ts:77-94`); 1 commit RPC; one stale-context retry |

There is no per-request work deadline, and nothing aborts when the client disconnects. The client waits up to 120 s.

### 10.3 N+1 findings (Track C3)

| ID | Location | Classification |
| --- | --- | --- |
| N-01 | turns list: assistant pairing | **NO N+1**: one batched `in.(…)` (`conversation.repository.ts:143-159`) |
| N-02 | Understanding list and detail | **NO N+1**: batched, parallel |
| N-03 | temporal routes, projection, context bindings, account | **NO N+1**: one RPC each |
| N-04 | **dossier paging** `get_conversation_thread_identity_dossier_page_v1` | **AVOIDABLE.** Each page re-runs a whole-user `EXISTS … NOT EXISTS` completeness check before returning its 1–64 chunk (`0070:2122-2127`, re-verified), so one walk does O(T²/32) work |
| N-05 | memories read twice per turn: `MemoryRetrieverService` (limit 32) and `EvidenceService.listEligibleForUser` (limit 64), same predicate | **AVOIDABLE duplicate** (`memory-retriever.service.ts:36`, `evidence.service.ts:30`) |
| N-06 | `POST …/disagreement`: confidence snapshot reads memories twice (`confidence.service.ts:110-113` + `hypothesis.service.ts:21`) | **AVOIDABLE duplicate** |
| N-07 | `/auth/v1/user` fetched twice on identity, export, deletion and download | **AVOIDABLE duplicate**: the guard discards the user it already fetched |
| N-08 | session ownership pre-check then SQL re-check on turn and cancel | **BOUNDED MULTI-QUERY BY DESIGN**: defense in depth, and the pre-check maps to a stable 409. Keep. |
| N-09 | sequential focus and screening provider calls in the semantic phase | **UNKNOWN — NEEDS MEASUREMENT.** Sequential by the "no-hindsight" contract; grows with CU count and T |

---

## 11. Matrix cross-reference

The brief lists the journey fan-out matrix and the DB / Data API query-call matrix separately. They are §9 and §10 above, and N+1 findings are §10.3.

## 12. Payload / pagination findings (Track C4)

| ID | Finding | Classification |
| --- | --- | --- |
| P-01 | **Hard maximums.** Turns ≤ 100, temporal ≤ 256, Understanding ≤ 32, detail sub-lists ≤ 16; body ≤ 100 KB; turn content ≤ 20 000 | NO ISSUE |
| P-02 | **Cursor stability.** Turns use a keyset over `(created_at, id)` with an exclusive tie-break; temporal uses a monotonic SP cursor | NO ISSUE |
| P-03 | **Projection payload.** `K(TC)` carries every committed CU's `committedText` up to TC plus all families (`0072:2269`, re-verified), recomputed on every call whatever the depth. The DB→API payload grows with session length. API→mobile is depth-filtered by `disclose()`, so hidden rungs do not cross the wire. | **NOT ESTABLISHED**: needs a heavy-session measurement. Related to, but distinct from, `QAN-BL-VIS-01` (render density, not wire size) |
| P-04 | **Export package.** One unpaginated jsonb of every session, turn, memory and hypothesis (`0130:545-616`), parsed in memory and re-fetched on every download, under a 5 s Data API timeout | **NOT ESTABLISHED**: a heavy account may time out on every attempt; needs a measurement with a seeded heavy account |
| P-05 | **Repeated full snapshots where deltas exist.** None: catch-up already uses deltas (events after SP), and the snapshot is a fixed-size head | NO ISSUE |
| P-06 | **Under-fetch causing an immediate second request.** None found. The Understanding client sends no `limit` but the server default equals the max (32). | NO ISSUE |
| P-07 | **Over-fetch of withheld data to the client.** None: depth disclosure happens server-side | NO ISSUE |

---

## 13. Adversarial scenarios (defensive analysis; no load was generated)

| Scenario | Today's outcome | Layer that stops it | Finding |
| --- | --- | --- | --- |
| Unauthenticated request flood (guarded routes) | Each request costs one remote Auth hop before rejection (~160 ms measured on the reject path) | none in repo; edge NOT ESTABLISHED | S-01 |
| Unauthenticated flood of `login-id-availability` / `health/ready` | unlimited service-role RPCs / Data API HEADs | **none** | S-01 |
| Authenticated single-user flood | unlimited | none | S-01 |
| **Expensive conversation-turn spam** (parallel `POST /turns`) | each turn runs ≥ 4 provider calls; unlimited concurrency per session and user; no cost quota | **none** | **S-02** |
| Distributed IP flood | — | edge only; NOT ESTABLISHED | S-01 / §4 |
| Credential stuffing via Login ID | Supabase per-IP limit, but keyed by `request.ip` (§3.3) | provider (conditional on S-03) | S-03 |
| Historical-projection spray across `tc × depth` | 1 full `K(TC)` recompute per call, no server cache; depth multiplies nothing server-side (same RPC) | none | covered by S-01 limits; P-03 |
| Catch-up page hammering | bounded 256 / page; 1 RPC each | none | S-01 |
| Malformed-body flood | parse error 400 before the handler; body ≤ 100 KB | framework | NO ISSUE beyond S-01 |
| Oversized body | 413 at 100 KB | framework | NO ISSUE |
| Health / readiness probing | 1:1 Data API amplification; bounded disclosure | none | S-01; readiness defect S-05 |
| Repeated invalid bearer tokens | each costs one Auth hop; `GET /user` is not rate-limited upstream | none | S-01 |
| Valid but revoked / expired token | **refused** by remote verification (measured 403 after sign-out) | guard | NO ISSUE today; constrains A-02 |
| Proxy-spoofed `X-Forwarded-For` | ignored today (`trust proxy` false). Becomes a full per-IP-limit bypass if someone sets `trust proxy = true` | — | S-03 (trap) |
| Multi-instance throttling consistency | no throttling exists to be inconsistent | — | design constraint §3.5 |

---

## 14. Observability used

- **Existing infrastructure:** `RequestCorrelationMiddleware` (`x-request-id`), Sentry with body-dropping
  `sanitizeSentryEvent`, and OpenTelemetry HTTP / Express instrumentation.
  - No production telemetry was read, since no production deployment exists.
  - No instrumentation was added to production code.
- **Measurement:** the CI harness in §6 only. It is bounded (one sign-in, 20 samples per hop, one self sign-out),
  content-free, and prints no token, key, email or claim value. It runs only when its own two files change.
- **Recommended durable measurements for the corrective tasks**, all content-free: per-route latency and status;
  guard-hop duration as its own span; downstream call count per request; response byte size; and rate-limit
  outcome once one exists.
  - The OTel HTTP instrumentation already emits client spans for `fetch`. A span attribute naming the hop class
    (auth / data / provider) would make the §10 matrix measurable in production without user content.

---

## 15. Finding classification table

| ID | Finding | Proven? | Severity | Fix now? | Proposed owner |
| --- | --- | --- | --- | --- | --- |
| PR01-S01 | No application-layer rate limit on any route. Unauthenticated `login-id-availability` (service-role RPC) and `health/ready` are bounded by **no layer at all**. | YES (STATIC) | **P1 — PRE-LAUNCH REQUIRED** | before launch | PROD-SEC-01 |
| PR01-S02 | Turn admission has no per-session / per-user concurrency bound and no per-user provider cost bound; each turn fans into ≥ 4 provider calls with no request deadline. **Unbounded model spend from one authenticated account.** | YES (STATIC, re-verified `0030:88-108`, `conversation.service.ts:63-112`) | **P0 — PRODUCTION BLOCKER** | before any public exposure | PROD-SEC-02 |
| PR01-S03 | `trust proxy` unset. Behind the recommended platform proxy, Supabase's per-IP limits collapse into one global bucket (global Login-ID sign-in lock-out). `trust proxy = true` would instead be spoofable. | YES (STATIC; W2-01 external gate) | **P1 — PRE-LAUNCH REQUIRED** | with the deployment decision | PROD-SEC-01 (exact hop count from the chosen edge) |
| PR01-S04 | No security-header baseline; `X-Powered-By: Express` sent | YES | **P2 — OPTIMIZATION** (JSON-only native API; HSTS belongs to the edge) | no | PROD-SEC-01 (small bundle: disable `x-powered-by`, `nosniff`) |
| PR01-S05 | `/health/ready` database probe gets `401` from `/rest/v1/` with the publishable key since the Supabase March 2026 change, so readiness is always `503 not_ready` | YES (MEASURED 20/20 + PRIMARY DOC) | **P1 — PRE-LAUNCH REQUIRED** | before launch | PROD-OPS-01 |
| PR01-S06 | Edge / WAF / TLS / origin-exposure | NO (repo holds no deployment) | **NOT ESTABLISHED** | PO / Company decision | PO (stop condition 1/2) |
| PR01-S07 | `SUPABASE_SECRET_KEY` and IP forwarding not represented in env template or CI | NO (external config) | **NOT ESTABLISHED** (routes fail closed) | with deployment | PROD-SEC-01 verifies; W2-01 gate |
| PR01-S08 | CORS disabled; body limit 100 KB; Node header timeouts | YES | **NO ISSUE** | — | — |
| PR01-S09 | Health disclosure | YES | **NO ISSUE** (bounded by contract) | — | — |
| PR01-A01 | Remote Auth hop on every guarded request: **p50 441 ms vs 32 ms Data API** (≈ 14×), × 12 / min / foreground user from the poll | YES (MEASURED) | **P2 — OPTIMIZATION** (highest-value) | decision-gated | PROD-AUTH-01 |
| PR01-A02 | Local-only JWKS verification **accepts a signed-out session's token** | YES (MEASURED) | constraint, not a defect: O4 rejected | — | PROD-AUTH-01 must honour |
| PR01-A03 | `/auth/v1/user` fetched twice on identity / export / deletion / download | YES (STATIC) | **P2** | no | PROD-AUTH-01 |
| PR01-A04 | Supabase Auth capacity under N users × 12 hops / min | NO | **NOT ESTABLISHED** | — | PROD-AUTH-01 measurement |
| PR01-A05 | `GET /auth/v1/user` shared per-IP bucket | tested (upstream source) | **NO ISSUE** (not rate-limited) | — | — |
| PR01-D01 | Turns, temporal, Understanding, account list routes | YES | **NO ISSUE** (bounded, indexed, batched) | — | — |
| PR01-D02 | Historical projection: one RPC, in-flight dedupe, cache, gestures cost 0–2 requests | YES | **NO ISSUE** (the old Next.js-style fan-out concern **not reproduced**) | — | — |
| PR01-D03 | Dossier paging O(T²/32) completeness re-check (N-04) | YES (STATIC, re-verified) | **P2** | no | PROD-DATA-01 |
| PR01-D04 | Duplicate memories reads (N-05, N-06) | YES (STATIC) | **P2** | no | PROD-DATA-01 |
| PR01-D05 | Semantic-phase sequential provider calls scale with CU count and Thread count (N-09) | partially (shape STATIC; magnitude unmeasured) | **NOT ESTABLISHED** | — | PROD-DATA-01 measurement |
| PR01-D06 | Projection DB→API payload growth (P-03) | NO | **NOT ESTABLISHED** | — | PROD-DATA-01 measurement |
| PR01-D07 | Export package unbounded under 5 s timeout (P-04) | NO | **NOT ESTABLISHED** | — | PROD-DATA-01 measurement |
| PR01-M01 | Launch waterfall + duplicate launch snapshot (M-01, M-02) | YES (STATIC) | **P2** | no | PROD-DATA-01 |
| PR01-M02 | History re-read on every Analysis→Conversation return (M-03) | YES (STATIC) | **P2** | no | PROD-DATA-01 |
| PR01-M03 | Retry without backoff: first-use forever with overlap; `loadOlder` ~every 64 ms on failure (M-04, M-05) | YES (STATIC, re-verified) | **P2** | no | PROD-DATA-01 |
| PR01-M04 | 5 s poll on non-Live screens (M-06) | YES (deliberate) | **P2** | no; needs a push decision before any removal | PROD-DATA-01 (cadence scoping only) |
| PR01-M05 | Projection failed-key retry / open-head eviction stall | NO | **NOT ESTABLISHED** (correctness risk) | — | PROD-DATA-01 verify-first |
| PR01-C01 | Connected Worlds HTTP collections | YES | **NO ISSUE** (no HTTP surface) | — | — |

**Severity reasoning, stated so it can be challenged:**

- **S-02 is the only P0.** No layer in repository truth bounds it. Its consequence (direct provider spend and
  provider-quota exhaustion for every user) follows from a single ordinary account. And an IP edge cannot fully
  fix it, because the bound is per user and semantic.
- **S-01 and S-03 are P1 rather than P0.** An edge the PO has not yet chosen can legitimately own most of their
  mitigation. That edge does not exist yet.
- **A-01 stays P2.** It is latency and capacity, not correctness, and the only measured safe alternatives change
  security semantics and need a decision.

---

## 16. Recommended corrective tasks (each independently executable; none authorized here)

### PROD-SEC-02 — Turn Admission Concurrency & Cost Bound  *(P0: S-02)*

- **Scope:**
  - Bound in-flight turns per session, and per user, at the existing turn-admission authority (`create_user_conversation_turn`).
  - Add a per-user turn rate and provider-call budget with an explicit, typed refusal the client already
    distinguishes from failure.
  - Add an overall work deadline for `createTurn`.
- **Numbers:** engineering defaults and tunables, justified by legitimate burst (a human turn cadence of seconds to
  minutes). They are not Product law.
- **Decision needed:** the PO chooses the refusal wording / UX within the existing Conversation contract.
- **Out of scope:** model routing, semantic-phase redesign.
- **Verification:** a Focused DB test that the (N+1)th concurrent admission is refused; an API test for the deadline.

### PROD-SEC-01 — API Baseline Hardening  *(P1: S-01, S-03; P2: S-04; verifies S-07)*

- **Scope:**
  - `@nestjs/throttler`, or an equivalent supported by Nest 11, with a **shared Redis store** if multi-instance.
  - Route classes:
    - unauthenticated credential / oracle routes keyed by IP;
    - authenticated routes keyed by user id after the guard;
    - health keyed by IP or edge-only.
  - An explicit fail-open / fail-closed matrix (§3.5).
  - `trust proxy` set to the **exact** hop count of the chosen edge.
  - Disable `x-powered-by`; add `nosniff`.
  - A deployment checklist for the secret key, IP forwarding, and the anon EXECUTE posture of
    `login_id_is_available_v1` on the hosted project (W2-01 §11 observation).
- **Prerequisite:** PO / Company edge decision (§4). The `trust proxy` part cannot be done correctly before it.
- **Verification:** e2e tests for 429 per class, spoofed-XFF tests, and header snapshot tests.

### PROD-OPS-01 — Readiness Probe Correction  *(P1: S-05)*

- **Scope:** replace the `HEAD /rest/v1/` probe with a request the publishable key is still allowed to make, or a
  dedicated minimal readiness RPC, keeping the frozen health contract (no rows, no mutation, no identity, bounded
  states).
- **Verification:** the existing health tests, plus a live probe against the CI project returning `available`.

### PROD-AUTH-01 — Auth Verification Path  *(P2: A-01, A-03; measures A-04)*

- **Starts with a PO / security decision among O1–O3 (§7.4).** O4 is excluded by evidence.
  - If O2 is chosen: local ES256 verification under the §7.4 claim rules, a session-liveness read for
    `session_id`, and the remote hop kept for account / privacy / security routes.
- **Also in scope:**
  - Pass the guard's already-fetched user to the routes that refetch it (A-03).
  - Re-measure from the real deployment region.
- **Verification:** the §7.2 revocation experiment must still yield **refused** for every chosen path; key-rotation tests.

### PROD-DATA-01 — List / Fan-out Correction  *(P2: D-03, D-04, M-01..M-04; measures D-05, D-06, D-07; verifies M-05)*

- **Server:** check dossier completeness once per walk, not per page (N-04); one memories read per turn (N-05, N-06).
- **Client:**
  - parallelise the launch history read;
  - seed the driver's first tick from the bootstrap snapshot;
  - keep held history across Analysis returns;
  - add backoff to `loadOlder` and first-use;
  - scope the idle poll cadence to screens showing Live, while keeping immediate catch-up on resume and on explicit request.
- **Must not merge truth boundaries:** no projection-pair merging, no snapshot / projection merging.
- **Measurements:** heavy session (P-03), heavy export (P-04), semantic phase vs CU count and T (N-09).

No task is proposed for: the projection fan-out concern (not reproduced), temporal paging, the Understanding list,
CORS, body limits, or Connected Worlds HTTP (none exists).

---

## 17. Backlog reconciliation (BG-05 / BG-06 / BG-08)

- **Inherited items (BG-05):** `docs/qandeel-canonical-backlog-v1.md` §4 lists **no** item owned by
  `PROD-READINESS-01`, so there is nothing to tombstone, re-own or defer.
- **Adjacent items, checked for duplication:**
  - **`QAN-BL-SEC-01`** (Mobile Credential Backup & Hardware Security; owner `QAN-SEC-01`) covers mobile
    credential storage only. Its required properties contain no API throttling, headers or edge work, so
    PROD-SEC-01 / PROD-SEC-02 **do not duplicate it**.
    - W2-01 §11's "no QANDEEL throttle is added (`QAN-SEC-01` stays outside this slice)" is a scoping remark,
      not an ownership of API rate limiting.
  - **`QAN-BL-VIS-01`** (heavy-history render density) is related to, but distinct from, P-03 (wire / DB payload).
    It is not modified.
- **Admission (BG-06 / BG-08):** this review **does not close**. It awaits a Product Owner decision, so BG-08
  admission is not triggered by this PR, and this record is the canonical carrier of every finding until that
  decision.
  - When the PO accepts or declines the §16 tasks, the change that records the decision must admit each accepted
    or deferred qualifying item to the backlog under the full §2 schema, and update this banner to its final state
    (BG-09).
  - Proposed IDs for that change: `QAN-BL-PROD-01` (S-02), `QAN-BL-PROD-02` (S-01 / S-03), `QAN-BL-PROD-03`
    (S-05), `QAN-BL-PROD-04` (A-01 / A-03 / A-04), `QAN-BL-PROD-05` (D/M items and the measurements).
  - Nothing here authorizes implementation (BG-07).
- **Roadmap:** `QANDEEL_PRODUCT_ROADMAP.md` is not edited. Sequencing the corrective tasks belongs to the Product Owner.

---

## 18. Skills Used

| Skill | Inspected | Used | Reason |
| --- | --- | --- | --- |
| `security-review` | yes | no | It reviews the *pending diff* of a branch. This gate reviews the baseline itself, and its own diff is a harness and a document. |
| `code-review` | yes | no | Diff-scoped correctness review; same reason. |
| `react-native-best-practices` | yes | no | Rendering, threading and animation guidance. The mobile part of this gate is network fan-out traced from source; no RN code was written or changed. |
| `github-actions` | yes | no | Covers RN simulator / emulator build pipelines. The proof workflow follows the repository's own existing proof-workflow pattern instead. |
| All UI / design / motion / media skills | yes | no | Not relevant to an API security and performance review. |

No installed skill is specific to NestJS / API security or backend performance. The review relied instead on:

- current primary documentation: Supabase signing keys, JWTs, Auth rate limits, and the OpenAPI-access changelog;
- the upstream `supabase/auth` route source;
- the installed framework sources.

---

## 19. Validation of this PR

- **Harness:** `node --check` passes. Locally with no configuration it prints `{"outcome":"NOT_CONFIGURED"}` and
  exits 2. In CI it passed (run `36830247454`) with the results in §6.
- **No production code changed**, so the API and mobile suites were not re-run (QUALITY COMPLETE, VALIDATION
  PROPORTIONAL TO CHANGE).
- `npm run test:task-closure-governance-contract` was run because this PR adds a lifecycle-bannered record.
  Result: §20.

## 20. Governance check result

`npm run test:task-closure-governance-contract` → **24 / 24 pass**, 0 fail (local, at this PR's head). The gate scans top-level `docs/` only, and this record declares no `**Phase:**` or `**Slice:**` banner.

---

`PROD-READINESS-01 REVIEW COMPLETE — AWAITING PRODUCT OWNER DECISION ON CORRECTIVE TASKS`
