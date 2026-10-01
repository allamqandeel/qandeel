# QANDEEL — Launch Edge Security Contract v1 (vendor-neutral)

**Status:** `PROD-SEC-01` (SEC-F) — **CONTRACT DEFINED; PRODUCTION PROOF OWNED BY `LAUNCH-EDGE-SECURITY-GATE`**.
**Owner of the proof:** `LAUNCH-EDGE-SECURITY-GATE — Trusted Proxy / Edge / Origin Production Proof`, a named Final
Launch exit gate. It is recorded in the canonical backlog as `QAN-BL-LAUNCH-01`.
**Provider:** none selected. This document names no hosting, CDN, WAF or cloud vendor, and choosing one is not part of it.

This file says what any production edge must prove **before QANDEEL is publicly reachable**. The API's own share of
the boundary is implemented and tested in `apps/api/src/http-security/`. Everything listed here exists outside the
repository, and a repository test cannot observe it.

## 1. What the API already guarantees (repo-owned, implemented by PROD-SEC-01)

| Concern | API behaviour |
|---|---|
| Client address | Resolved by Express from an explicit topology parsed once at startup: `QANDEEL_API_PROXY_MODE=direct` (trust nothing; forwarding headers are ignored) or `trusted_proxy` with `QANDEEL_API_TRUSTED_PROXIES` = literal IPs / CIDRs. Never `trust proxy = true`, never a hop count. Production refuses to start without an explicit mode, and refuses an empty, invalid or `/0` trust list. |
| Supabase Auth per-IP limits | The resolved, normalized address is the only value sent as `Sb-Forwarded-For`, and only with `SUPABASE_SECRET_KEY`. Production refuses to start without that key, or with a key that is the publishable or service-role key. |
| Request rate | A process-local global guard: a per-address aggregate window plus per-route windows by class. It is **per instance**. It is defence in depth, not a global or distributed limit. |
| Headers | Helmet defaults on every answer (2xx, 404, errors, 429); no `X-Powered-By`; no CORS. |
| Body size | The existing 100 kB JSON / urlencoded parser bound; there is no upload route. |

## 2. What the edge must prove (the `LAUNCH-EDGE-SECURITY-GATE` checklist)

Each item needs evidence from the real deployment before launch, such as a configuration export, a recorded request or
a provider attestation. A plan does not count as evidence.

1. **TLS only to users.** Every public hostname serves HTTPS only, with a current certificate and modern protocol
   versions. Plain HTTP either redirects or is refused, and never serves API content. HSTS, which the API already
   sends, is not undermined by the edge.
2. **Network and edge DoS protection is active** for the API hostname: volumetric and protocol-level absorption on
   the provider's network.
3. **Distributed, global rate limits** exist for the abuse-sensitive routes, keyed by client address across every
   instance:
   - `/account/login-id-availability`
   - `/account/login-id-sign-in`
   - `/account/login-id-verify-email`
   - `/account/login-id-resend-verification`
   - `/account/email/change`
   - `/account/password/change`
   - the Privacy & Data command routes

   They are set at or below the API's own per-instance numbers multiplied by the instance count.
4. **Forwarding headers are sanitized.** The last proxy before the API overwrites `X-Forwarded-For` (and
   `X-Forwarded-Proto` / `-Host`) and does not append to a client-supplied value it did not verify. A recorded request
   carrying a forged `X-Forwarded-For` shows the API resolving the real client.
5. **Topology matches SEC-B.** `QANDEEL_API_PROXY_MODE` and `QANDEEL_API_TRUSTED_PROXIES` are set to the exact
   addresses or ranges of the last-hop proxies, with no broader range. If the provider's egress ranges change, the
   list is updated through the same review.
6. **The origin cannot be reached around the edge.** Direct access to the origin's address or hostname is blocked by
   network policy, or the origin accepts only authenticated edge traffic (for example mutual TLS or a private network
   attachment). A recorded direct request to the origin must fail. Without this, every edge throttle, WAF rule and
   header sanitation above can be bypassed, and this gate is **not** passed.
7. **Health checks stay usable.** The load balancer's probes reach `/health/live` and `/health/ready` from addresses
   the topology accounts for, at a cadence inside the API's `HEALTH` class (240 per minute per address per route). No
   security rule evicts healthy instances. `/health/ready` keeps PROD-OPS-01's coalesced single-flight check.
8. **WebSocket / Voice follows the same law** when a Voice runtime exists (`QAN-BL-VOICE-01`): the same TLS, origin
   restriction, trusted topology and global limits. No second path to the origin is opened for it.
9. **Failure is fail-safe.** If the edge or a TLS step fails, traffic is refused. It is never routed straight to the
   origin, and never downgraded to plain HTTP.
10. **Supabase Auth IP forwarding is enabled and proven.** The hosted project has *Authentication → Rate Limits → IP
    address forwarding* enabled. One controlled request through the real API shows that the address Supabase Auth
    rate-limits on is the end user's, not the API host's. The proof records no secret value, no token and no
    end-user address beyond the controlled tester's own.
11. **The hosted database carries migration `0133`.** On the real project, an anonymous Data API call to
    `rpc/login_id_is_available_v1` is refused, while the API's own availability route still answers. The repository
    proves the same closure against a database built with Supabase's default privileges
    (`database/verify-migration-0133.mjs`); this proof confirms that the real project received it.

## 3. What this contract does not decide

- It decides no vendor, product, region or price. The task forbids choosing one.
- It records no CIDRs. They do not exist until the topology exists, and inventing them would be the spoofing hole
  SEC-B closes.
- It does not set the edge's numbers beyond item 3's ceiling. Those are tuned to measured traffic at launch.

## 4. Gate status

`LAUNCH-EDGE-SECURITY-GATE` is **OPEN**. It is not passed until every item in §2 carries real-deployment evidence. A
gate marked passed while item 6 is unproven is a false pass.
