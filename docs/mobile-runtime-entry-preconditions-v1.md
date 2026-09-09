# Mobile Runtime Entry Preconditions v1 — T-12P

**Status:** CANDIDATE — awaiting independent Architecture + Security review
**Baseline:** `abfde68dcdf24d2dcd57968bc8656de70f35fd08`
**Branch:** `feat/t12p-mobile-runtime-entry-preconditions-v1`
**Owner of:** the mobile identity runtime, the public-config boundary, the canonical bootstrap, the foreground live-delivery driver
**Not owner of:** any Product surface, any Product copy, any motion, any visual language, any persistence of Product truth

> **The app may now hold a Session. It still holds no Product.**

---

## 1. Why T-12 was blocked, and what this closes

T-12 (Final Living Analysis Map Integration) stopped at its Phase-A readiness gate with three blockers:

```text
STOP — T12 READINESS BLOCKER: NO AUTHORIZED MOBILE SESSION/CREDENTIAL SOURCE
STOP — T12 READINESS BLOCKER: INITIAL CANONICAL ENTRY STATE IS NOT OWNED
STOP — T12 READINESS BLOCKER: LIVE DELIVERY DRIVER IS NOT FROZEN
```

All three had one root cause: **the mobile app had no way to obtain a Session.** The frozen T-03
transports demanded an injected `{ baseUrl, accessToken, fetch }` and a `sessionId`; nothing in the
repository produced any of them. `createCanonicalStore` had no production call site at all — every
one of its 26 references was the module itself, its barrel, a test, a fixture or a static contract.
And the `sessionId` was not a config value an integrator could supply: it is minted only by
`POST /conversation/sessions`, itself behind the Supabase auth guard, so it strictly depended on
already holding a token.

T-12P closes exactly those three and nothing else. T-12 remains blocked until this merges.

---

## 2. Identity authority — direct Supabase Auth on mobile

The mobile app obtains its own Supabase Auth session and forwards the resulting **access token** to
the existing QANDEEL API as `Authorization: Bearer <token>`. The API stays the verifier: it continues
to validate the bearer against `GET /auth/v1/user` and to derive Session ownership from the
authenticated identity. No backend-issued substitute token exists, no second token format was
introduced, and the API gained no route.

The mandatory official-source review confirmed this is not merely the authorized choice but the only
supported one: **Supabase has no endpoint that lets a backend mint a session.** `/admin/generate_link`
returns `action_link`, `email_otp`, `hashed_token`, `verification_type` and `redirect_to` — no tokens;
`admin.createUser` returns a user. The documented backend-assisted path still ends with the *client*
calling `POST /verify` to receive its own tokens. A "backend-issued session" topology would therefore
not remove Supabase tokens from the client; it would only add a proxy in front of them, while making
the QANDEEL API a credential custodian it has never been.

### Sources inspected

| Source | What it established |
| --- | --- |
| [supabase.com/docs/guides/api/api-keys](https://supabase.com/docs/guides/api/api-keys) | Current key model: `sb_publishable_…` (client-safe, RLS-bounded) vs `sb_secret_…` (bypasses RLS, never shipped). `anon`/`service_role` are legacy and deprecate by end of 2026. |
| [supabase.com/docs/guides/auth/quickstarts/react-native](https://supabase.com/docs/guides/auth/quickstarts/react-native) | The official RN client shape and the `AppState`-driven refresh requirement. |
| [docs.expo.dev/guides/using-supabase](https://docs.expo.dev/guides/using-supabase) | Expo's own guidance: `expo-sqlite` storage, and that `react-native-url-polyfill` is unnecessary on Expo, which ships `URL`, `structuredClone` and `TextEncoder` as globals. |
| [supabase.com/docs/guides/auth/sessions](https://supabase.com/docs/guides/auth/sessions) | Access token default 3600 s; refresh tokens never expire but are single-use with a 10-second reuse interval; reuse outside it revokes the whole session. |
| [supabase.com/docs/reference/javascript/auth-getuser](https://supabase.com/docs/reference/javascript/auth-getuser) | `getUser()` performs a network request and is therefore authoritative — confirming the API's existing guard is the documented trustworthy pattern. |
| [docs.expo.dev/versions/latest/sdk/securestore](https://docs.expo.dev/versions/latest/sdk/securestore) | SecureStore has no web support and a historical ~2048-byte iOS value limit. |
| [docs.expo.dev/guides/environment-variables](https://docs.expo.dev/guides/environment-variables) | `EXPO_PUBLIC_*` is statically inlined by Metro and visible in plain text in the compiled app. |
| `github.com/supabase/auth` `openapi.yaml` | `POST /auth/v1/token` requires only the `apikey` header; the response carries a server-computed `expires_at`. No admin session-minting operation exists. |

### Establishing authentication vs. observing it (R1-01, corrected by R2-01)

A sign-out — or a restore that finds nothing — **retires the auth epoch**. Two paths then exist, and
only one of them may establish authentication:

| Path | May it establish across a retirement? |
| --- | --- |
| `acceptObservedAuthChange` — any SDK subscriber event | **No.** It may retire, refresh a live identity's credential, or carry an already-authorized replacement while a runtime is live. |
| `acceptExplicitSignInCompletion` — the awaited `signInWithPassword` result | **Yes**, if its captured operation epoch is still current, the authority is not disposed, and no later explicit command superseded it. |

**Event kind is not operation provenance.** This is the correction R2 required, and the maintained
SDK is why. `GoTrueClient.signInWithPassword` does:

```js
await this._saveSession(data.session);
await this._notifyAllSubscribers('SIGNED_IN', data.session);
return this._returnResult({ ... });
```

— the subscriber sees `SIGNED_IN` **before** the promise resolves. So a sign-in that raced a sign-out
delivers a perfectly genuine-looking `SIGNED_IN` callback while the reader is already signed out, and
any rule that lets the *kind* authorize crossing the barrier resurrects them. An epoch check that
runs only after the `await` is too late: the damage is done by then. The barrier therefore does not
consult the kind at all, and the operation epoch guards the completion.

Two earlier rules are gone, both because they answered the wrong question:

- comparing the retired `{userId, accessToken}` pair — a refresh completing after a sign-out carries
  the *same user* with a *different token*, so the pair never matched;
- allowing a subscriber `SIGNED_IN` through — that is precisely the event a stale sign-in emits.

The epoch closes **before** the sign-out round trip is awaited, so a callback landing mid-flight is
already outside it. A refresh is still not a new identity: the auth generation is unchanged, so no
second conversation Session is created.

**Adopted pattern:** the official React Native client options exactly — `autoRefreshToken: true`,
`persistSession: true`, `detectSessionInUrl: false` — with `startAutoRefresh`/`stopAutoRefresh` bound
to app state. **Deviation:** no `react-native-url-polyfill`, per Expo's explicit guidance that it is
unnecessary on this SDK. This is recorded rather than silent.

---

## 3. Public configuration boundary

```text
build-time app.config.js  →  Expo `extra`  →  expo-constants  →  typed MobilePublicConfig
```

Three facts are public mobile configuration, not secrets: the QANDEEL API base URL, the Supabase
project URL and the Supabase **publishable** key. `apps/mobile/app.config.js` is the ONE place an
environment variable becomes public config; `config/mobile-public-config.ts` is the ONE place the
ambient Expo config is read. No runtime module reads `process.env`, and the static contract proves
both claims by census rather than by convention.

`app.json` is untouched and still carries no `extra` — the static identity of the app stays where it
was, which is also why the three contracts that pin `expo.plugins` are unaffected.

Everything in `extra` ships inside the bundle and is readable by anyone holding the binary. The
config authority therefore **fails closed** on a missing, blank, non-string or malformed value, and
additionally **refuses an elevated key outright**, producing a typed `FORBIDDEN_SECRET` failure so
that no runtime is built at all. The refusal never echoes the offending value.

The key check is an **allowlist**, not a denylist (R1-04A). Exactly two shapes are accepted:

1. a new-format publishable key, `sb_publishable_` followed by a **non-empty payload**; or
2. a legacy key — a JWT — whose decoded `role` claim is exactly `anon`.

**The prefix alone is not validation (R2-02).** Before any shape is classified, the value must be an
opaque header token: non-empty, and printable non-space ASCII throughout. That refuses the bare
prefix, a whitespace or control-character suffix, and anything non-ASCII — all of which would
otherwise be interpolated into an HTTP `apikey` header.

Nothing narrower is imposed, deliberately. Supabase documents the prefix and that these are "short
strings, not JWTs"; it documents **no** character set and **no** length, and `supabase-js` itself
validates nothing beyond `startsWith`. Guessing an alphabet or a length would reject a valid
production key and take the app down, whereas a slightly-too-permissive structural check merely lets
a malformed key reach Supabase, which rejects it. The security question — *is this a secret?* — is
answered exactly and separately, by the `sb_secret_` prefix and the decoded legacy role.

Values are validated **raw**, not trimmed. Trimming would silently repair a key or origin that
arrived with a stray newline from a build pipeline, and a value that needs repairing is evidence the
pipeline is wrong. The same rule refuses whitespace in an origin, which would otherwise be
concatenated into every request URL.

Everything else fails closed. `sb_secret_…` is `FORBIDDEN_SECRET` because it bypasses Row Level
Security. A legacy `service_role` is `FORBIDDEN_SECRET` for the same reason, and `authenticated` is
too, because its presence would mean somebody pasted a *user's own access token* into build
configuration. A malformed JWT, a JWT with a missing or non-string role, an unknown prefix and an
arbitrary string are all `UNSUPPORTED_KEY_SHAPE`: an unrecognised key is not evidence of safety, and
the SDK is not the right place to find out.

The legacy check **decodes** rather than substring-matching, because a substring scan would miss the
exact mistake it exists to catch: a legacy key's privilege lives in the base64url-encoded payload, so
the text `service_role` never appears literally. Nothing here verifies a signature — classifying
public build config does not make the app a JWT trust authority, and a forged key simply fails
against Supabase.

**Origins must be HTTPS** (R1-04B). Every request built on them carries a bearer token, and the
sign-in that produces it carries a password; a cleartext remote origin would put both on the wire.
`http:` is refused outright. There is one narrow development seam — `allowLoopbackHttp` — which is
off by default and, even when opened, admits **loopback hosts only**. An arbitrary remote
`http://…` can never be valid config, with or without the seam.

The identity SDK is pinned **exactly** (`2.116.0`), not as a caret range: the credential-handling
dependency that ships must be the one an Architecture and Security review audited, and a range would
also reintroduce the live-registry drift QAN-INF-02 had to close.

Environment variable names deliberately avoid the literals `EXPO_PUBLIC_` and
`SUPABASE_PUBLISHABLE_KEY`, both of which the mobile foundation contract forbids anywhere in the
workspace: they are `QANDEEL_API_BASE_URL`, `QANDEEL_SUPABASE_URL` and `QANDEEL_SUPABASE_PUBLIC_KEY`.

---

## 4. Credential persistence is not Product persistence

T-13 still owns restart, recovery and Product persistence. T-12P persists **authentication material
only**, through the official Supabase mechanism, in `auth/auth-session-storage.ts` — the single
module in the layer that may touch storage at all.

**Mechanism:** `expo-sqlite/kv-store`, whose exported `SQLiteStorage` is documented as a drop-in
replacement for `@react-native-async-storage/async-storage`. It is the current official
Supabase-on-Expo recommendation (both Supabase's Expo quickstart and Expo's own guide route session
storage through `expo-sqlite`), and it needs no custom cryptography. The store is given its **own
database file**, `qandeel-auth-session.db`, so nothing else in the app can read or clobber session
material through an unrelated key, and the adapter exposes only `getItem` / `setItem` / `removeItem`
— the wider SQLite surface is unreachable through the seam.

### The security trade-off, stated plainly

**This storage is not encrypted at rest.**

Official guidance is **mixed**, and an earlier draft of this document overstated it — corrected here
after the R1 review. All four of these are current official positions:

| Source | Storage it uses for the session |
| --- | --- |
| Supabase — React Native quickstart | `@react-native-async-storage/async-storage` (unencrypted) |
| Supabase — Expo quickstart | `expo-sqlite` (unencrypted) |
| Expo — "Using Supabase" guide | `expo-sqlite` (unencrypted) |
| Supabase — JS client reference | a `LargeSecureStore` class: an AES-256 key in `expo-secure-store`, ciphertext in AsyncStorage |
| Expo — authentication guide | recommends `expo-secure-store` for access tokens, and says AsyncStorage is not secure for this |

So it is **not** true that official guidance avoids SecureStore. What is true is that the
SecureStore-backed session pattern Supabase publishes wraps it in **hand-rolled AES**, because a
serialised session can exceed SecureStore's value-size limit — and hand-rolled cryptography is
exactly what this task is instructed not to introduce. T-12P therefore takes the unencrypted
official Expo path, isolates it, and refers the encrypted-at-rest question to a gate that can decide
it against real evidence instead of guessing now.

**Changing the mechanism is a one-file change** — nothing outside `auth-session-storage.ts` names the
package, and the static contract enforces that.

What is forbidden from this store regardless: `CanonicalState`, the camera, TC/PTC, RH, inspection,
Live Focus, Return state, the disclosure cache and the conversation `sessionId`. Those are T-13's.

**What no local gate proves.** Jest does not exercise the native SQLite persistence path at all —
constructing the real store under `jest-expo` kills the worker. The Android and iOS native jobs prove
build, install and boot, **not** session write, restore, refresh or sign-out. That gap is admitted as
`QAN-BL-T12-04` (`VALIDATION — OPEN`, HIGH, owned by the T-12 pre-release physical validation gate),
which also requires Architecture and Security to explicitly disposition encrypted-at-rest storage
against the then-current official pattern and the observed session size. No custom or hand-rolled
cryptography is authorized, then or now.

The four lockfile denylists and one manifest denylist that previously banned `expo-sqlite` were
re-anchored narrowly, each with a comment naming this authority and pointing at the confinement proof.
The invariant each list defends — that no state-management or persistence library joins this app — is
unchanged and still proven, by the import censuses those same contracts already carry and by the
T-12P contract's proof that exactly one module may reach storage.

**Not persisted, by construction:** `CanonicalState`, the camera, TC/PTC, RH, inspection, Live Focus,
Return state, the disclosure cache, and the conversation `sessionId`.

---

## 5. Conversation Session acquisition

`POST /conversation/sessions` with the Supabase access token. The server mints the id; the client
never synthesises one, never reuses another identity's Session, and never treats the auth user id as
a Session id.

### The route is not idempotent, and that is handled honestly

The audit established this rather than assuming it: `ConversationService.createSession` generates a
fresh `randomUUID()` per call, and `create_conversation_session_v1` performs an unconditional
`INSERT`. There is no `ON CONFLICT`, no `Idempotency-Key` read anywhere in the API, and no reuse of an
open Session. Worse, the API's upstream Supabase verification aborts at five seconds and surfaces as a
`503` — by which time the `INSERT` may already have committed. The id is never returned on failure and
there is no list-sessions route, so a client that did not receive a response **cannot discover whether
one was created**.

Therefore the client reports a typed `OUTCOME_UNKNOWN` (`NETWORK`, `SERVER_ERROR` or
`MALFORMED_RESPONSE`) and **never retries automatically**. Retrying would silently create a second
orphaned Session on every flaky network. Recovery needs either a deliberate human decision or
server-side idempotency that does not exist today; both are outside T-12P, and making the backend
idempotent is explicitly out of scope for this task.

Definitive outcomes are kept distinct: `401`/`403` is `UNAUTHENTICATED` and `4xx` is `REFUSED` — in
both, no Session was created.

**Duplicate prevention** lives in one owner. `createMobileRuntimeEntry` memoises its in-flight
bootstrap per auth generation, so a rerender, a remount or a second call returns the *same* attempt. A
token refresh does not change the auth generation and therefore never reaches the create call. The
client itself deliberately holds no memo: a client that replayed a previous result would hide a
duplicate rather than prevent one.

---

## 6. The canonical bootstrap

One owner, one sequence, and either a complete runtime or none:

```text
WAITING_FOR_AUTH
  → ACQUIRING_CONVERSATION_SESSION
  → FETCHING_INITIAL_SNAPSHOT
  → FETCHING_INITIAL_DISCLOSURE   (only where legal)
  → READY
```

The store is created **last**, after every authoritative fact is in hand, so no partial
`CanonicalStore` can exist. Each attempt captures its runtime generation and re-checks it before every
step and immediately before construction: a superseded attempt creates nothing and reports `RETIRED`.

### The initial canonical state comes only from frozen laws

| Field | Value | Why it is not a choice made here |
| --- | --- | --- |
| `session` | the acquired `sessionId` | server-minted |
| `live` | `liveTruthFromSnapshot(snapshot)` | the only authorized snapshot → mirror conversion |
| `temporal` | `{ kind: 'FOLLOW_LIVE' }` | the only mode the kernel accepts at construction: `PINNED` is rejected while `LH` is `null`, and neither act that establishes `FOLLOW_LIVE` can run without a Live Head |
| `inspection` | `null` | the canonical "inspecting nothing" |
| `camera` | `initialCameraIntent()` | the canonical World/Z0 target T-07 compares against — any other anchor, scale or depth would silently change what "Return to World" is a no-op against |
| `history` | omitted | T-12P persists no reversible history |

### The empty/new Session

A brand-new Session has no addressable position. `LH` is `null`, which the kernel already defines as a
technical absence sentinel — not `SP(0)`, not a Moment, never addressable. So: **no `SP(1)` is
fabricated, no `V` is fabricated, and no historical projection is requested at all**, because with no
Live Head there is no legal `tc` to request one for. `initialDisclosure` records `NOT_APPLICABLE`.

Where a Live Head does exist, exactly one WORLD disclosure is requested at it. A typed refusal is held
as `UNAVAILABLE` — that is knowledge, and it stays distinct from "not fetched". A transport failure
holds nothing and stays `NOT_FETCHED`, which is the truthful "we do not know" and remains retryable.
Neither becomes an empty world, and neither blocks `READY`: a reader with no projection sees the
technical state, which is correct.

### Store dependencies

The bootstrap accepts `StoreDependencies` and T-12P supplies none. The Map, temporal and Return
authorities belong to T-04, T-06 and T-07, and wiring them is T-12's composition job. A store built
without them still ingests authoritative live truth — all T-12P needs — and executes no promoted act
at all, which is the correct fail-closed posture for a runtime with no Product surface.

---

## 7. The foreground live-delivery driver

HTTP catch-up over the existing authenticated transports. **No WebSocket, no SSE, no background
polling.** The driver owns no temporal authority: everything it applies goes through T-03's own
`applyCommittedUnitsPage` / `applyLiveFocusEventsPage` seams, which are the only authorized writers of
`LH` and `LF`. It decides only *when* to ask and *from what cursor*.

### Lifecycle

Runs only while an authenticated Supabase session exists, a conversation Session exists, the bootstrap
generation is current, and the app is foregrounded. Stops on sign-out, user replacement, Session
replacement, generation replacement, disposal and backgrounding. Backgrounding halts new requests
immediately, and a cycle already in flight stops paging at its next checkpoint.

The foreground signal is the repository's **first** `AppState` observer — nothing under `apps/`
observed app lifecycle before now — and it is deliberately one observer shared by both consumers that
need it, the Supabase refresh loop and the driver, rather than two subscriptions racing the same event.

### Cadence — 5000 ms, and why

`FOREGROUND_CATCH_UP_INTERVAL_MS = 5_000`, pinned in one owner, injectable everywhere:

1. Every authenticated request costs the API one upstream Supabase verification, and the API gives
   that call a 5000 ms abort budget. Matching the cadence to it means at most one catch-up cycle is
   outstanding per verification window.
2. The catch-up routes are pull-only paged reads with a 256-event server cap — a recovery shape, not a
   per-second streaming shape.
3. What is followed is committed conversational units: human conversation cadence.
4. There is deliberately no push channel, so this is the latency floor. Five seconds is the largest
   number that still reads as keeping up — which is why the driver *also* catches up immediately on
   foreground resume and on explicit request rather than waiting out a tick.

Repeated failure backs off exponentially, jittered into [50 %, 100 %] of the computed delay and capped
at `MAX_CATCH_UP_BACKOFF_MS = 60_000`, never below the cadence. No Product semantics depend on any of
these numbers — a cadence that changed meaning would be temporal authority, which this is not.

### Generation and cursor rules

Every application is gated on the runtime generation still being current **and** the authenticated
identity still being the one the driver was built for. That single gate is what makes sign-out, user
replacement, Session replacement and disposal all produce zero late canonical writes.

The driver tracks its **own** cursor. This matters: nothing in the transport or the sync seams returns
one, and the mirrored `LH` is **not** a cursor — the bootstrap snapshot writes `LH` too, and a `STALE`
delivery leaves it untouched while the event was still delivered. The cursor advances to the last
outcome the sync owner did not `REJECT`; `REJECTED` means the payload never became client truth, the
seam stops the page there, and so does the cursor. A cursor never moves backwards. Paging is bounded
per cycle so one cycle cannot page forever against a fast-moving Session.

### Strict cross-stream Session Position order (R1-03)

Draining committed pages fully and Live Focus pages afterwards leaves each stream internally ordered
and the delivery as a whole out of order: committed 10, LF 11, committed 12 would apply 10 → 12 → 11.
So the driver fetches bounded pages from **both** streams and applies them merged by authoritative
Session Position — `lastSp` for a committed CU, `atSp` for a Live Focus transition — through the
existing T-03 sync owners, one delivery at a time. It adds no temporal authority; it decides only the
order in which the frozen owners are called.

**The tie rule is read off frozen semantics, not invented.** Within one Session Position the server
reserves same-SP sequence 1 for the committed CU and sequence 3 for the Live Focus transition, so at
an equal SP the committed CU is applied first.

**A full page holds back what it cannot yet order.** If a stream's page comes back full, events
beyond its last position may still exist below the other stream's, so nothing past that watermark is
applied in that iteration. Whatever is held back is simply re-fetched, because the cursors advanced
only for what was actually applied. Session-mismatch refusal, cursor monotonicity, idempotent
redelivery, stale classification, bounded pages, no overlap and the per-application generation check
are all unchanged.

### Credential freshness at every request boundary (R1-02)

`TemporalApiConfig` captures the access token at construction and exposes no setter, so a client
built once per cycle keeps the token it was born with. If the token refreshed after the snapshot but
before the next page, that page would go out stale. The driver therefore reads the current credential
and builds the transport **immediately before every request** — snapshot, committed page and Live
Focus page alike — and the generation check rides along, so a request can never be issued for an
identity that has already been replaced. A refresh is not a generation change and does not interrupt
the catch-up in progress.

A failure never invents state and never rewinds truth: the cursor is untouched and the next cycle asks
again from the last position genuinely accepted.

There is at most **one driver per runtime generation**: `liveDriverFor` returns the same driver when
asked twice, because two drivers on one generation would poll the same streams concurrently — exactly
the overlap the contract forbids. Retiring a generation *disposes* its driver rather than orphaning
it: the driver holds a foreground subscription and a scheduled timer, so an orphan would keep issuing
requests for an identity that no longer exists, even though its own generation gate would correctly
refuse to apply anything they returned.

---

## 8. What T-12P did not do

- **No Product surface.** No Map, Timeline, chrome, responsive composition, locale provider, Meaning
  Ignition or composite spatial cause. The layer contains no `.tsx` file at all.
- **No login experience.** `signInWithPassword` is a runtime capability for a future auth gateway to
  call. There is no screen, no Product copy, no provider buttons, no onboarding.
- **No app-shell mount.** `FoundationShell` remains the route output and is byte-unchanged; the router
  root is still exactly `_layout.tsx` and `index.tsx`; the boot smoke still asserts the technical
  shell. Replacing it is T-12's entire job.
- **No T-12 backlog item.** The nine inherited items remain T-12's.
- **No T-13 work.** No restart, no recovery, no Product persistence.
- **No backend change.** The API gained no route and no idempotency; making
  `POST /conversation/sessions` idempotent is explicitly out of scope.

---

## 9. Native and physical validation limits

Honest boundaries on what the local gates prove:

- **The `expo-sqlite` auth store is not exercised by any test on this machine.** It is a native module
  with no implementation under `jest-expo`; constructing it in a test kills the Jest worker outright.
  What *is* proven locally is everything above it: the real `createClient` constructs, the port adapts
  it, and a restore with nothing stored resolves to `SIGNED_OUT`. **The SQLite-backed store must be
  exercised on a device or emulator before this is relied on in production.**
- **No live Supabase project was contacted.** Every auth test drives an injected port. The repository
  does not carry credentials for a live smoke, which is a pre-existing condition.
- **The `AppState` binding is proven through the injected seam, not on hardware.** The manual signal
  proves every lifecycle rule; that `AppState` reports the transitions this layer expects is a device
  claim.
- **No end-to-end run against the real API was performed.** The transports, decoders and sync seams are
  the frozen ones and are exercised with wire-legal bodies, but no request left this machine.

---

## 10. The T-12 handoff

T-12 consumes `apps/mobile/src/runtime-entry` through its public barrel and nothing deeper. Three
implementations stay private and are reachable only through `createMobileRuntimeEntry`: the auth
session storage, the Supabase client, and the scheduler internals.

| Gate | Result | Evidence |
| --- | --- | --- |
| **1 — authorized mobile session/credential source** | PASS | direct Supabase Auth authority, typed fail-closed public config, current access token exposed to the runtime, authenticated Session acquisition, elevated key refused at the boundary |
| **2 — initial canonical entry state owned** | PASS | deterministic bootstrap owner, exact empty/new-Session law, exactly-once store creation, no invented temporal or disclosure truth |
| **3 — live delivery driver frozen** | PASS | foreground HTTP catch-up, exact lifecycle/generation/cursor semantics, no WS/SSE, no background polling, stale callbacks cannot write |

T-12 remains BLOCKED until this merges. T-13 is not started.
