# QANDEEL — W2-01 Final Account Access Lifecycle — Implementation Record v1

**Task:** W2-01 — Final Account Access Lifecycle: Login ID / Email Sign-in + Password Recovery + Session-End Product
Treatment (E2E-01 wave W2, first bounded implementation slice)
**Rows:** `E2E-A-06` (final sign-in surface), `E2E-A-07` (Login ID OR Email sign-in), `E2E-A-08` (generic failure +
Login ID help), `E2E-A-11` (password recovery), `E2E-A-12` (confirmed-ended session versus unknown auth state)
**Baseline:** `6b333df7774d33b034575243b3592d21f2603683` (merge of PR #284, W1B-01; final W1B head `69ec0ba`)
**Branch:** `feat/w2-01-final-account-access`
**Status:** IMPLEMENTED ON A DRAFT PR — NOT MERGED. One bounded, Product-Owner-authorized Production Integration
slice; it opens no other wave or Product area and closes no phase.

---

## 1. Authorization and scope

The Product Owner's W2-01 task fixed the final sign-in, its failure and help copy, the password-recovery contract, the
session-end rule ("Unknown ≠ Signed Out; confirmed ended session → Sign in with explanation") and their copy. During
implementation one copy gate was raised — twelve states had no approved words — and the Product Owner answered it,
with two edits (§2.2). This record carries every decision verbatim so that no string or behaviour is later guessed.

Outside this slice, and untouched: `E2E-A-01` static launch, `E2E-A-02` app icon, `E2E-D-07` the final Product sign-out
control, `E2E-A-03` / `QAN-BL-LANTERN-01`, W1C, W3 General Settings, broader `QAN-SEC-01`, social sign-in, phone recovery,
MFA / passkeys, and choosing or configuring an Email provider.

## 2. Product copy — the implemented contract, verbatim

The sign-in words live in T-14's copy module (`apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts`); the
recovery and unable-to-verify words in `apps/mobile/src/account/access/copy.ts`. The W2-01 contract fails if an approved
string is altered, if the access module gains an unapproved one, or if the superseded T-14 failure returns.

### 2.1 Approved in the W2-01 task

| Surface / state | Arabic | English |
|---|---|---|
| Identifier label | معرّف الدخول أو البريد الإلكتروني | Login ID or email |
| Persistent help | نسيت معرّف الدخول؟ يمكنك استخدام بريدك الإلكتروني بدلًا منه. | Forgot your Login ID? You can use your email instead. |
| Generic credential failure | تعذّر تسجيل الدخول بهذه البيانات. تأكد منها وحاول مرة أخرى. | We couldn’t sign you in with these details. Check them and try again. |
| Recovery entry | نسيت كلمة المرور؟ | Forgot password? |
| Recovery request result (always) | إذا كان هذا البريد مرتبطًا بحساب قنديل، أرسلنا لك رمزًا لإعادة تعيين كلمة المرور. | If this email is linked to a QANDEEL account, we sent a password reset code. |
| Recovery success | تم تغيير كلمة المرور. | Password changed. |
| Session ended (on Sign in) | انتهت جلستك. سجّل الدخول للمتابعة. | Your session has ended. Sign in to continue. |
| Unable to verify session | تعذّر التحقق من جلستك الآن. تحقق من اتصالك وحاول مرة أخرى. | We couldn’t verify your session right now. Check your connection and try again. |
| Retry | إعادة المحاولة | Try again |

### 2.2 Approved in the W2-01 copy gate (with the Product Owner's two edits)

| # | Surface / state | Arabic | English |
|---|---|---|---|
| N1 | Empty identifier | أدخل معرّف الدخول أو البريد الإلكتروني. | Enter your Login ID or email. |
| N2 | Title of every recovery step | إعادة تعيين كلمة المرور | Reset password |
| N3 | Request action | إرسال الرمز | Send code |
| N4 | Code field | رمز إعادة التعيين | Reset code |
| N5 | Code action | متابعة | Continue |
| N6 | Code shorter than six digits (local; **edited**: an incomplete code is not proved incorrect) | أدخل رمز إعادة التعيين المكوّن من 6 أرقام. | Enter the 6-digit reset code. |
| N7 | Code rejected by the provider (wrong or expired, indistinguishable) | تعذّر التحقق من الرمز. تأكد منه أو أرسل رمزًا جديدًا. | We couldn't verify this code. Check it or send a new one. |
| N8 | New password | كلمة المرور الجديدة | New password |
| N9 | Confirm new password | تأكيد كلمة المرور الجديدة | Confirm new password |
| N10 | Mismatch (local) | كلمتا المرور غير متطابقتين. | The passwords don't match. |
| N11 | Change action | تغيير كلمة المرور | Change password |
| N12 | Update failed (not network, not policy; **edited** English) | تعذّر تغيير كلمة المرور الآن. حاول مرة أخرى. | We couldn’t change your password right now. Try again. |

Usage choices approved with them: **(1)** a resend repeats the ONE generic request result and never says a code was sent
(W1B's «تم إرسال رمز جديد.» is not used by recovery); **(2)** success is its own state — «تم تغيير كلمة المرور.» /
"Password changed." with «العودة لتسجيل الدخول» / "Back to sign in" — and the reader ends signed out and signs in
explicitly.

### 2.3 Reused, already approved, verbatim

| Source | Use | Arabic | English |
|---|---|---|---|
| T-14 | Sign-in title | تسجيل الدخول | Sign in |
| T-14 | Sign-in action | دخول | Sign in |
| T-14 | Password label | كلمة المرور | Password |
| T-14 | In-flight status | جارٍ تسجيل الدخول | Signing in |
| T-14 | Empty password | أدخل كلمة المرور. | Enter your password. |
| T-14 | Network (sign-in and recovery) | تعذّر الاتصال. حاول مرة أخرى. | Couldn’t connect. Try again. |
| T-14 | Unexpected sign-in failure | تعذّر تسجيل الدخول الآن. حاول مرة أخرى. | Couldn’t sign in right now. Try again. |
| W1B-01 §2.1 | Recovery Email field | البريد الإلكتروني | Email |
| W1B-01 §2.1 | Implausible Email (recovery) | أدخل بريدًا إلكترونيًا صحيحًا. | Enter a valid email address. |
| W1B-01 §2.1 | Password rejected by the provider's rules | كلمة المرور لا تستوفي المتطلبات. | The password doesn't meet the requirements. |
| W1B-01 §2.1 | Resend the recovery code | لم يصلك الرمز؟ إعادة الإرسال | Didn't get the code? Send again |
| W1B-01 §2.2 | Back to Sign in (every recovery step and success) | العودة لتسجيل الدخول | Back to sign in |

**Superseded as Product copy (P1 §15.3):** T-14's «البريد الإلكتروني» field label for the identifier, «أدخل البريد الإلكتروني.» /
"Enter your email." and «البريد الإلكتروني أو كلمة المرور غير صحيحة.» / "Email or password is incorrect.". T-14 itself stays the
historical, `CLOSED / FROZEN` gateway; its runtime is extended in place under re-anchored contracts (§9).

## 3. Interaction behaviour — as implemented

| Decision | Implemented behaviour | Where |
|---|---|---|
| One identifier | exactly one identifier field plus Password; no modes, tabs, toggles or second form. The field is LTR inside an Arabic layout, Email keyboard, autofill intent `username`, persistent help visible and spoken as its hint | `ProductSignInGateway.tsx` |
| Routing | the auth authority decides: an identifier containing `@` is an Email and goes device → Supabase (`signInWithPassword`), anything else is a Login ID and goes through the server exchange (§4). Trimmed once at submit; never lowercased on the device (the server and database canonicalise) | `mobile-auth-authority.ts` `signInWithIdentifier` |
| Failures | rejected by Login ID or by Email → the ONE generic sentence; transport → T-14's network sentence; anything else → T-14's unexpected sentence. No provider word reaches a surface | `product-sign-in-copy.ts` |
| Unconfirmed Email | a PROVED password with an unverified Email continues into W1B's Verify Email: by Email for the typed address, by Login ID for the Email the proved password unlocked (`confirmationEmail`, §4.3) | gateway, `supabase-auth-port.ts` |
| One request | a synchronous ref refuses a second press; the control says busy; a completion after unmount changes nothing | gateway |
| Recovery entry | «نسيت كلمة المرور؟» below the password, drawn by the Auth Gateway destination through the gateway's `passwordAssist` seam | `AccountEntry.tsx` |
| Recovery request | Email only (a Login ID is refused locally as an invalid Email); every provider answer is the same result; only a request with no HTTP answer shows the network sentence and stays | `PasswordRecovery.tsx` |
| Recovery code | six digits (Arabic-Indic digits read as digits), numeric keyboard and one-time-code autofill, nothing auto-submits; fewer than six → N6 locally, nothing sent; provider rejection → N7 (never "wrong" or "expired"); no device clock | `PasswordRecovery.tsx` |
| Resend | re-asks, keeps the typed code, repeats the generic result | `PasswordRecovery.tsx` |
| New password | two masked fields, never trimmed; empty → the policy sentence; different → N10 locally, nothing sent; the provider's rules (`weak_password`, `same_password`) → the policy sentence; transport → network; anything else → N12 | `PasswordRecovery.tsx` |
| Success | "Password changed." then "Back to sign in"; the reader is signed out and signs in explicitly | `RecoveryCompleted` |
| Leaving recovery | the return control and Android Back go to Sign in (refused while a request is in flight) and retire any held recovery authority at once | `AccountEntry.tsx` |
| Session ended | only on the auth owner's evidence (§6): the ordinary Sign in with the notice in its one live region, calm tone; usable; no password kept or refilled; spent once the reader attempts a sign-in or moves on | gateway, `ProductRoot.tsx` |
| Unknown | the auth owner's `ERROR` state renders the approved recovery state and ONE act, "Try again": no credential asked, no world, nothing bootstrapped | `SessionVerificationRecovery.tsx`, `ProductRoot.tsx` |

## 4. Login ID sign-in — the selected architecture

### 4.1 Why a server boundary, and only one

P1 §3: one identifier accepts `Login ID OR Email`, failures are generic, and "a client never learns which Email belongs
to a Login ID". Supabase Auth validates a password only against an Email (or phone). Every design that keeps the device
from ever knowing a Login ID's Email therefore needs something server-side to turn the Login ID into the Email and spend
it at once. Rejected alternatives: a resolution endpoint that returns the Email (a directory — forbidden); a QANDEEL
password check (bypasses the provider — forbidden); an Edge Function (a second runtime); a synthetic identity per Login ID
(a broad identity redesign).

### 4.2 The route

1. **Device → QANDEEL API.** `POST /account/login-id-sign-in` with exactly `{ loginId, password }` in the body — never a
   URL (`supabase-auth-port.ts` `signInWithLoginId`). An Email identifier never takes this route.
2. **Resolution, server channel only.** `resolve_login_id_sign_in_email_v1` (migration `0124`, SECURITY DEFINER, empty
   `search_path`, EXECUTE revoked from PUBLIC / `anon` / `authenticated` by name and granted to `service_role` only)
   answers the Email of the account holding the canonical lowercase Login ID, or NULL. A malformed Login ID is not
   looked up.
3. **The provider's own password grant.** `SupabasePasswordGrantService` calls
   `POST /auth/v1/token?grant_type=password` with the resolved Email and the untouched password. An unresolved Login ID
   is NOT answered early: the same grant is spent against a reserved `.invalid` address no account can hold, so an
   unknown Login ID and a known one with a wrong password take the same path and upstream round trip, count against the
   same rate limit, and meet the same answer. An unresolved Login ID can never be answered with anything but a refusal.
4. **Answer.** `200 { accessToken, refreshToken }` for a proved password; `401 { outcome: 'INVALID_CREDENTIALS' }` for
   every refusal; `409 { outcome: 'EMAIL_NOT_CONFIRMED', email }` (§4.3); `503 { outcome: 'UNAVAILABLE' }`; `400` for a
   malformed body. No provider word, no account id.
5. **Adoption into the one client.** The device calls `client.auth.setSession` on the ONE Supabase client, which persists
   the session and notifies `SIGNED_IN` exactly as a password sign-in does; the authority's explicit-completion barrier
   is unchanged, and a superseded Login ID sign-in is discarded exactly like a superseded Email verification.

### 4.3 What leaves the server, and why it preserves P1

The only Email that ever leaves is the account's own, to a reader who PROVED ITS PASSWORD: in the `409` for an
unconfirmed Email — Supabase checks the password before it reports `email_not_confirmed` (verified in W1B-01, record
§4.3), and the W2-01 task allows exactly this ("do not reveal an unconfirmed Email to someone who has not proved the
password") — and inside the owner's own session after a successful sign-in, where every Supabase access token and user
record carries it, as it will in General Settings (P1 §8.1, Account & Identity). Nothing answers "which Email belongs to
this Login ID" to anyone who has not proved the credential: that is the directory P1 forbids, and none exists.

### 4.4 Abuse and rate limits — kept, not replaced

Supabase rate-limits the password grant per client IP. A server-side caller would otherwise be ONE IP for every reader
(a shared bucket and a trivial lock-out). The relay therefore sends the reader's address in `Sb-Forwarded-For` and
authorizes with a Supabase **secret** key (`SUPABASE_SECRET_KEY`) — the documented pairing (Supabase Auth, "Rate limits
→ IP address forwarding": publishable and legacy `anon` / `service_role` keys are not honoured, and forwarding must be
enabled for the project). Without a secret key the route **fails closed** (503, no lookup, no upstream call); it never
falls back to a shared bucket. QANDEEL adds no rate-limit subsystem: the per-reader bound is the provider's own, exactly
as for an Email sign-in. Nothing in the exchange is logged; Sentry drops request bodies (`sanitizeSentryEvent`).

### 4.5 T-12P's "the API stays a verifier" — re-anchored explicitly

T-12P's contract forbade any API file from naming the token endpoint. W2-01 re-anchors that single fact, visibly: exactly
one file (`account/supabase-password-grant.service.ts`) may relay the PASSWORD grant, once. Supabase remains the only
identity provider — it validates the password and issues the tokens. The API mints nothing, refreshes nothing (a refresh
grant is forbidden everywhere), stores no credential and verifies no password; every other API file is held to the
original prohibition. This is the one architectural boundary change in W2-01 and the first point for review.

## 5. Password recovery — containment of the recovery authority

**Verified against the installed SDK (`@supabase/auth-js` 2.116.0, `GoTrueClient.verifyOtp`):** a successful
`verifyOtp({ type: 'recovery' })` calls `_saveSession(session)` and then notifies subscribers of `PASSWORD_RECOVERY`. Using
it would PERSIST the recovery session into the one auth storage, so an app kill before the new password was set would
restore it at the next launch as an ordinary signed-in session — bootstrap, a Conversation Session, Personal state.

So recovery never touches the SDK session, and there is still ONE Supabase client and ONE auth authority:

- **Request** uses the SDK's `resetPasswordForEmail(email)`, which creates no session. Non-enumerating by construction:
  every answered request — sent, no such account, rate-limited, a 5xx — is one result, because each could differ between
  an Email with an account and one without; only a request with no HTTP answer is reported, and says nothing of any account.
- **Verify** calls the Auth REST endpoint the SDK itself calls (`POST {url}/auth/v1/verify` with
  `{ type: 'recovery', email, token }`, the publishable key and `X-Supabase-Api-Version: 2024-01-01`, the version whose
  errors carry `error_code`). The grant comes back as a `RecoveryGrant` — a pair of values, not a session snapshot, so
  nothing that consumes a snapshot can accept it — and goes NOWHERE else: not to the SDK's session, its storage or its
  subscribers. `otp_expired` / `validation_failed` are one `CODE_REJECTED` answer.
- **Hold.** The auth authority keeps the grant in memory, bound to the explicit command that verified it
  (`recoveryHold = { epoch, grant }`), refuses recovery beside an identity, and tells the entry only that the code
  verified. Nothing is published; `authenticate` is never reached.
- **Update** calls `PUT {url}/auth/v1/user` with `{ password }` and the grant as bearer, then retires the grant with
  `POST {url}/auth/v1/logout?scope=local`. The reader stays `SIGNED_OUT`.
- **Retirement.** A held grant is retired on success, on a later explicit command (it becomes unusable immediately and is
  retired when next touched), when the reader leaves recovery, when any identity is established, and on disposal. A code
  verified after a later command is retired at once and never held. A grant is never persisted, so a kill leaves nothing.

## 6. Session end versus unknown — "Unknown ≠ Signed Out"

| Evidence | State | Surface |
|---|---|---|
| First launch, no stored session | `SIGNED_OUT` | ordinary Sign in, no notice |
| The provider refused the persisted session at restore — a 4xx refresh refusal, or the SDK removed the stored session while initialising (observed by a subscription the port registers synchronously at construction, before the SDK's first await) | `SIGNED_OUT` + `sessionEnded` | Sign in with the approved notice |
| A live identity's session removed by the SDK while its epoch was NOT retired (no sign-out was asked for) | `SIGNED_OUT` + `sessionEnded` | Sign in with the notice; the runtime generation is retired |
| An explicit sign-out (the epoch is retired before the SDK's own `SIGNED_OUT` arrives) | `SIGNED_OUT` | no notice |
| Restore failed technically — transport (`status 0`), a 5xx / `AuthRetryableFetchError`, an unrecognised shape | `ERROR` | the approved unable-to-verify state; the session is left in place |

**Retry** (`retrySessionVerification`) runs only from `ERROR`, never passes back through `RESTORING`, joins a press
already in flight, and applies the SAME settlement as the first restore: restored → authenticated with one generation
(the integration runtime then bootstraps ONE Session); proved ended → Sign in with the notice; still unknown → stays.
The SDK caches a failed refresh of the same token for 60 s (`REFRESH_FAILURE_COOLDOWN_MS`), so a retry inside that window
honestly stays unknown. No clock in QANDEEL decides any of this.

## 7. Email delivery — the seam is ready; the provider is external

Nothing in the repository sends Email or names an Email vendor; delivery stays with Supabase Auth, the existing auth
provider boundary. No SMTP or API secret is committed. **Production configuration required, NOT verified from this
repository:**

1. Authentication → Email Templates → **Reset Password** (recovery) must emit the code `{{ .Token }}` (the in-app flow has
   no browser handoff); **Confirm signup** likewise (W1B-01 record §6);
2. **Email OTP length: 6**; **Email OTP expiration** (default 3600 s) — the entry never judges expiry itself;
3. a **production SMTP / transactional-email provider** and, when chosen, a **verified sender/domain** — Supabase's
   built-in sender delivers only to team addresses and is heavily rate-limited (2 emails / hour);
4. for Login ID sign-in: `SUPABASE_SECRET_KEY` (a new-format secret key) on the API, **IP address forwarding enabled** for
   the project, and an API edge configured so `request.ip` is the reader's real address (the API sets no trust-proxy rule
   today; behind a proxy every reader would share the proxy's address — still bounded, but a shared bucket).

**Live branded transactional Email delivery = EXTERNAL / NOT PROVED** until a production sender and delivery provider are
configured and tested against real inboxes. W2-01 does not mark this gate closed.

## 8. Files

- **Database:** `database/migrations/0124_login_id_sign_in_resolution_v1.sql`, `database/verify-migration-0124.mjs`
  (`verify:login-id-sign-in-resolution:integration`, one API CI step), `database/README.md` §W2-01.
- **API** (`apps/api/src/account/`): `login-id-sign-in.controller.ts`, `login-id-sign-in.service.ts`,
  `login-id-sign-in.repository.ts`, `supabase-password-grant.service.ts`, `account.module.ts` (composition only),
  `login-id-sign-in.spec.ts`. `account.service.ts` / `account.repository.ts` / `account.controller.ts` are unchanged.
- **Mobile auth:** `runtime-entry/auth/supabase-auth-port.ts`, `runtime-entry/auth/mobile-auth-authority.ts`,
  `runtime-entry/index.ts` (five result types exported).
- **Mobile Product:** `integration/auth-gateway/ProductSignInGateway.tsx`, `product-sign-in-copy.ts`, `index.ts`;
  `account/access/copy.ts`, `PasswordRecovery.tsx`, `SessionVerificationRecovery.tsx`; `account/entry/AccountEntry.tsx`;
  `account/index.ts`; `integration/composition/ProductRoot.tsx`. `account/copy.ts` is byte-identical.
- **Tests:** `runtime-entry/__tests__/account-access-authority.test.ts`, `account-access-port.test.ts`;
  `account/__tests__/access.test.tsx`; `integration/__tests__/w2-account-access.test.tsx`, `w2-proof-world.test.tsx`;
  `tests/w2-01-final-account-access-contract.test.mjs`.
- **Proof (validation only):** `integration/__validation__/w2-proof-world.ts`, `W2ProofRoot.tsx`, `w2-proof-entry.tsx`;
  `apps/mobile/scripts/select-w2-proof-entry.mjs`; `apps/mobile/.maestro/w2-01-*.yaml`; `scripts/w2/run-w2-01-proof.sh`;
  `.github/workflows/w2-01-visual-proof.yml`. `scripts/w1b/run-w1b-proof.sh` is not changed or used (the W2 flows reuse
  W1B's `w1b-01-type.yaml` typing guard read-only).
- **Re-anchored contracts and suites** (§9) and the narrow lifecycle reconciliation (§11).

## 9. Re-anchored contracts — every expired fact stated in place

- **T-14 contract:** the credential is still spent in ONE call — now `signInWithIdentifier(typed, password)` (the name
  and argument expired); `AUTH_ERROR` is the third reader-facing phase and is proved to render neither a sign-in nor a
  world ("exactly two" expired); the identifier field's label / hint / `username` autofill replace the Email ones; the
  notice colour condition may read `submitting || ended` (both branches still canonical palette roles). T-14's Jest suite
  pins the W2 copy with the same strictness, and its "no recovery action" rule now allows the approved help TEXT
  «نسيت معرّف الدخول؟» while still requiring exactly one press target in the gateway itself.
- **W1B-01 contract:** "one place a credential is spent" counts `signInWith(Password|Identifier)(`. W1B's entry test pins
  the new generic sentence.
- **T-12P contract:** the sign-out-site census is now five plain sites plus two ended-session sites, each named; the
  observed null-session line computes `ended` before retiring the epoch; "the API stays a verifier" allows exactly the one
  password-grant relay (§4.5). T-12P's AC-02.4 Jest proof now expects `sessionEnded` on an SDK-removed live session.
- **T-14 product-root suite:** `AUTH_ERROR` moves from the technical list to a W2 test of the Product recovery state.

## 10. Verification

Exact-head CI results are in the Draft PR description.

- **Database (API CI only — no PostgreSQL can run on the implementation host):** `verify-migration-0124.mjs` — catalog,
  grants (service_role only; `anon`, `authenticated`, PUBLIC refused), case-insensitive resolution, NULL for unknown /
  malformed / Login-ID-less accounts, a single text answer.
- **API:** `apps/api/src/account` — 2 suites, 40 tests (W1B's `account.spec.ts` unchanged and green).
- **Mobile:** the four W2 suites above plus the re-anchored ones; the full mobile Jest suite — 142 suites, 1,645 tests
  before the proof-world suite was added. Mobile and API typecheck clean.
- **Root:** `tests/w2-01-final-account-access-contract.test.mjs` (every guard proven against a planted defect), registered
  once in Mobile CI; the re-anchored T-14, W1B-01 and T-12P contracts, and T-12, T-12 activation, T-13, W1A-01, canonical
  state, QAN-INF-04 and the task-closure governance contract, all green.
- **Device proof:** the W2-01 visual-proof workflow — English and Arabic at default text size, Arabic at the largest text
  size, the nine required states, two keyboard measurements and on-device accessibility censuses. Its result is recorded
  in the PR, not here.

## 11. Residue, external gates and narrow reconciliation

- **External gates (§7):** Email templates emitting `{{ .Token }}`, OTP length 6, production SMTP / sender, the secret
  key + IP forwarding + real client IP for Login ID sign-in. Live Email delivery is not proved.
- **Other sessions after a password reset:** recovery retires only its own session (`scope=local`); whether a reset
  signs out other devices is a Security & Login Product decision (P1 §8.1) and is not invented here.
- **Observation, not fixed (outside scope):** migration `0123`'s `login_id_is_available_v1` revokes EXECUTE from PUBLIC
  only. On a hosted project whose default privileges grant new public functions to `anon` / `authenticated`, that boolean
  could be reachable from PostgREST directly. It returns a boolean only (the availability endpoint is already an
  acknowledged, unthrottled oracle — W1B-01 record §6) and W2-01 does not widen into it; `0124` names both roles explicitly.
- **Reduced motion:** W2-01 adds no motion (static opacity swaps through the existing `Control`), so there is no motion to
  reduce.
- **Lifecycle reconciliation (narrow):** W1B-01 is recorded as merged through PR #284 at `6b333df` in
  `docs/e2e/E2E01_READ_FIRST.md`, `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md` and the W1B-01 record's status line;
  W2-01 rows and locators are added as a Draft PR. The census and its planning baseline are not rewritten.

## 12. Backlog (BG-05 / BG-08)

W2-01 inherits no canonical backlog item (BG-05): none names it or W2 as owner. `QAN-BL-SEC-01` is respected — nothing new
is written to auth storage (a Login ID session is stored exactly as any sign-in's; a recovery grant never is) and no
credential hardening is attempted. `QAN-BL-LANTERN-01` is untouched. W2-01 is a Draft implementation slice and closes no
phase, so it records no closure; its residue (§11) is tracked by this record and the E2E-01 rows it names.

## 13. Skills / G1

- `sibawayh:writing-eloquent-arabic` — used to draft the Arabic candidates of the copy gate (§2.2) before the Product
  Owner approved them with edits. No other Skill materially fit this auth-lifecycle slice: it reuses the frozen visual
  primitives W1B already integrated, adds no motion, no new component system and no native module.
