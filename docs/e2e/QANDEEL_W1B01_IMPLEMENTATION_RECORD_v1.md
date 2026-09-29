# QANDEEL — W1B-01 Account Identity + Verified Sign-up + First Use — Implementation Record v1

**Task:** W1B-01 — Account Identity + Verified Sign-up + First Use — Production Integration v1 (E2E-01 wave W1B)
**Rows:** `E2E-A-09` (create account), `E2E-A-13` (first use / Welcome), `E2E-A-14` (First Conversation Opening),
`E2E-B-02` (normal new-conversation opener), `E2E-K-02` (empty Personal world / first start)
**Consumed Product decision:** `E2E-A-10` — mandatory Email verification by an in-app 6-digit code before QANDEEL
**Baseline:** `7c9ee5e5bcb5f567dc7ef1944bcde92e8cdf99de` (merge of PR #283, W1A-01)
**Branch:** `feat/w1b-01-account-identity-first-use`
**Status:** IMPLEMENTED — MERGED through PR #284 at `6b333df7774d33b034575243b3592d21f2603683` (final W1B head
`69ec0ba92a9763f1193b357e8493c83d8d14187b`; lifecycle line reconciled by W2-01, nothing else in this record changed).
One bounded, Product-Owner-authorized Production Integration slice; it opens no other wave or Product area.

---

## 1. Authorization

The Product Owner's W1B-01 task fixed the four sign-up fields, the Login ID's Product term and privacy, mandatory
Email verification by an in-app 6-digit code (the `E2E-A-10` decision), and the complete sign-up, verification,
Welcome and First Conversation Opening copy. During implementation one copy gate was raised — three states had no
approved truthful sentence — and the Product Owner answered it (§2.2). This record carries every decision verbatim
so that no string or behaviour is later guessed.

**The Lantern seam (Product Owner clarification).** The canonical v1 cold start is *static launch / system handoff
→ Lantern Gateway Identity Moment → signed-out Auth Gateway → Sign in / Create account / Verify Email*. W1B-01
implements none of the Lantern moment (`QAN-BL-LANTERN-01` keeps its owner) and does not close `E2E-A-03`. It
builds the Auth Gateway as a clean DESTINATION (`AccountEntry`), rendered by `ProductRoot`'s `SignedOutEntry`, so
the Lantern task can place its moment before it and hand off into it without rebuilding the sign-up flow (§4.5). The
visual proof is "Auth Gateway onward", never the cold-start journey.

## 2. Product copy — the implemented contract, verbatim

Every visible and assistive string W1B-01 adds is below, and nothing else. The one place they are written is
`apps/mobile/src/account/copy.ts`; the W1B-01 contract fails if any is altered or any other string is added there.
`{display_name}` is the account Name; `{email}` is the address the reader entered. Both are substituted as isolated
bidirectional runs (first-strong isolate … pop), which are invisible and are not copy.

### 2.1 Approved in the W1B-01 task

| Surface / state | Arabic | English |
|---|---|---|
| Screen title / entry | إنشاء حساب | Create account |
| Name | الاسم | Name |
| Login ID | معرّف الدخول | Login ID |
| Login ID persistent help | معرّف خاص تستخدمه لتسجيل الدخول إلى قنديل. احتفظ به؛ لن يظهر للآخرين. | A private ID you can use to sign in to QANDEEL. Keep it safe; it won't be shown to others. |
| Email | البريد الإلكتروني | Email |
| Password | كلمة المرور | Password |
| Create action | إنشاء الحساب | Create account |
| Empty Name | أدخل الاسم. | Enter your name. |
| Invalid Email | أدخل بريدًا إلكترونيًا صحيحًا. | Enter a valid email address. |
| Password rejected by actual policy | كلمة المرور لا تستوفي المتطلبات. | The password doesn't meet the requirements. |
| Login ID unavailable | معرّف الدخول هذا غير متاح. اختر معرّفًا آخر. | This Login ID isn't available. Choose another one. |
| Generic account-creation refusal | تعذّر إنشاء الحساب بهذه البيانات. | The account couldn't be created with these details. |
| Network failure (T-14's frozen sentence, reused) | تعذّر الاتصال. حاول مرة أخرى. | Couldn’t connect. Try again. |
| Verify — title | تأكيد البريد الإلكتروني | Verify your email |
| Verify — instruction | أرسلنا رمزًا إلى {email}. أدخل الرمز لتأكيد بريدك. | We sent a code to {email}. Enter it to verify your email. |
| Verify — field | رمز التأكيد | Verification code |
| Verify — action | تأكيد البريد | Verify email |
| Resend | لم يصلك الرمز؟ إعادة الإرسال | Didn't get the code? Send again |
| Resend success | تم إرسال رمز جديد. | A new code was sent. |
| Incorrect code | رمز التأكيد غير صحيح. | The verification code is incorrect. |
| Expired code | انتهت صلاحية رمز التأكيد. أرسل رمزًا جديدًا. | This verification code has expired. Send a new one. |
| Resend failure | تعذّر إرسال رمز التأكيد. حاول مرة أخرى. | The verification code couldn't be sent. Try again. |

**First-use Welcome** (controlled amendment to I-08A4 §14, §3):

| Line | Arabic | English |
|---|---|---|
| Greeting | أهلًا يا {display_name}. | Welcome, {display_name}. |
| Definition | أنا قنديل. كل ما نتكلم أكثر، أفهمك أكثر وأتذكر ما يهمك، علشان أساعدك تشوف نفسك وحياتك بشكل أوضح. | I'm QANDEEL. The more we talk, the better I understand you and remember what matters to you, so I can help you see yourself and your life more clearly. |
| Start (also the start act) | ابدأ بما يشغلك الآن. | Start with what's on your mind. |

**First Conversation Opening** (controlled amendment to I-08A4 §15, §3):

| Line | Arabic | English |
|---|---|---|
| Presence | أنا معك يا {display_name}. | I'm with you, {display_name}. |
| Invitation | ابدأ بما يشغلك الآن… حتى لو كان شيئًا لا تعرف كيف تصفه بعد. ونبدأ من هناك. | Start with what's on your mind… even if it's something you don't quite know how to describe yet. We'll begin there. |

**Normal new-conversation opener** — unchanged (G1.1 §1, P4-C4 `opener`): اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ /
Hi {display_name} ... I'm here, ready when you are ... let's begin

### 2.2 Approved in the W1B-01 copy gate

| Surface / state | Arabic | English |
|---|---|---|
| Empty Login ID | أدخل معرّف الدخول. | Enter your Login ID. |
| Malformed Login ID | استخدم من 3 إلى 30 حرفًا أو رقمًا بالإنجليزية. ويمكن استخدام . أو - أو _ بين الحروف والأرقام. | Use 3–30 English letters or numbers. You can use . - or _ between letters and numbers. |
| Verification failure that is neither incorrect, expired nor network | تعذّر تأكيد البريد الإلكتروني الآن. حاول مرة أخرى. | We couldn't verify your email right now. Try again. |
| Return from Create account | لديك حساب بالفعل؟ تسجيل الدخول | Already have an account? Sign in |
| Return from Verify Email | العودة لتسجيل الدخول | Back to sign in |

The Product Owner also approved the behaviour of §3 "Sign in with an unverified Email", and kept "Login ID
unavailable" for a genuinely taken identifier only.

### 2.3 Reused, already approved — and deliberately silent

- The opening's assistive attribution is W1A-01's approved QANDEEL-turn attribution («قنديل: {text}» / "QANDEEL: {text}").
- Silent, with no invented word: every in-flight state (a busy control says so through its accessibility state);
  the wait for the account before the reader's world; an account with no Name (no Welcome, no opener, no fallback); any
  provider, server or database message; any test id or engineering term.

## 3. Interaction behaviour — as implemented

| Decision | Implemented behaviour | Where |
|---|---|---|
| Entry states | Sign in (T-14's own form), Create account and Verify Email are LOCAL entry state of one Auth Gateway destination under the one route. No router stack, no page, no integration phase; moving between them authenticates nobody and creates no Session | `account/entry/AccountEntry.tsx` |
| Sign in → Create account | the approved «إنشاء حساب» / "Create account" entry, drawn below T-14's form through its `footer` seam | `AccountEntry.tsx`, `ProductSignInGateway.tsx` |
| Fields | exactly Name, Login ID, Email, Password (P1 §4). Name single field, max 80, natural direction; Login ID, Email and Password LTR inside an Arabic layout; Email keyboard; password masked, never trimmed or transformed; Login ID help is persistent text and the field's spoken hint | `CreateAccountForm.tsx`, `EntryParts.tsx` |
| Local judgement | empty Name; empty or malformed Login ID; an implausible Email (something@something.tld); an empty password (the approved policy sentence). Messages show under their field, are announced, and focus moves to the first; nothing is sent | `entry-rules.ts`, `CreateAccountForm.tsx` |
| Login ID grammar | 3–30 characters of English letters and digits, with `.` `-` `_` only between letters and digits; case-insensitive, canonical lowercase. Identical in the database, the API and the app (§4.1) | `entry-rules.ts`, migration 0123, `account.service.ts` |
| Login ID availability | asked once per submission, by canonical form, as a POST body: TAKEN → the approved "unavailable" sentence under the field; no answer over the network → the network sentence; a server that cannot answer → sign-up proceeds and the database decides | `CreateAccountForm.tsx` |
| Sign-up outcome | success → Verify Email for that address, still signed out. `INVALID_EMAIL` / `WEAK_PASSWORD` → their field sentences; `NETWORK` → network; every other refusal — including an existing account where the provider says so, a Login ID taken meanwhile, a rate limit — → the ONE generic refusal, so nothing reveals whether an Email exists | `CreateAccountForm.tsx`, `supabase-auth-port.ts` |
| One request | a second press while a submission is in flight is ignored by a synchronous ref; the action says busy; the return control and Android Back are refused meanwhile | `CreateAccountForm.tsx`, `VerifyEmailForm.tsx` |
| Verify — code | digits only, at most six; Arabic-Indic and Extended Arabic-Indic digits are read as digits; numeric keyboard and one-time-code autofill; nothing auto-submits — the reader presses Verify | `VerifyEmailForm.tsx`, `entry-rules.ts` |
| Verify — outcomes | fewer than six digits → incorrect (nothing sent) — the one rejection the entry can prove. A provider rejection is ambiguous (wrong and expired are one answer, §4.3), so it is the approved generic verification fallback, never a guessed "incorrect" or "expired"; network → network; anything else → the same fallback. The approved expired-code sentence stays in §2.2 and the copy module, displayed by nothing until a provider state can truthfully prove expiry. Success is the explicit completion that authenticates, and the runtime replaces the entry | `VerifyEmailForm.tsx` |
| Resend | its own bounded in-flight state; never clears the typed code; success → «تم إرسال رمز جديد.»; network → network; any refusal (including the provider's 60-second resend limit) → the approved resend failure | `VerifyEmailForm.tsx` |
| Leaving verification | the approved return control and Android Back go to Sign in (refused while a request is in flight). Nothing is lost: the account stays unverified and cannot enter QANDEEL | `VerifyEmailForm.tsx` |
| Sign in with an unverified Email | Supabase Auth checks the password FIRST and only then reports `email_not_confirmed` (verified in the official source, §4.3). Only then does the gateway go straight to Verify Email for that address, with Resend; a wrong password is still T-14's one generic sentence | `supabase-auth-port.ts`, `ProductSignInGateway.tsx` |
| Arrival | after verification, the reader's world waits (the Dark World only) until the account read answers; then the Welcome if owed, else the Conversation. A failed read, or one unanswered after 6 s, is asked again (1, 2, 4, 8, then every 15 s) and never opens the Conversation in its place — unknown account state delays first use and never erases it (§5) | `FirstUseGate.tsx`, `account-controller.ts` |
| Welcome | shown to a NAMED account that has not completed it and has never conversed; three lines; the last line is the start act; pressing it moves the reader into the Conversation at once (a cut — no transition is frozen for this moment) and writes the completion once | `WelcomeSurface.tsx`, `account-controller.ts` |
| First Conversation Opening | in a Conversation whose authoritative history is READ and EMPTY, while the account has never committed a turn; on QANDEEL's side, open on the World, composer below | `ConversationOpening.tsx`, `ConversationSurface.tsx` |
| Normal opener | the same place, once the account has committed a turn: every later genuinely empty Conversation Session the runtime supplies. No Session browser or "new conversation" control is added | `ConversationOpening.tsx` |
| Never | an opening above a committed turn; both openings together; an opening while history is loading or failed; any opening or Welcome without a Name | `ConversationOpening.tsx`, `ConversationSurface.tsx` |

## 4. Architecture and data

### 4.1 Canonical identity — migration `0123_account_identity_first_use_v1.sql`

The existing account row, `public.users`, gains three nullable columns — `name`, `login_id`, `first_use_completed_at` —
a Name shape check (trimmed, 1–80, no control characters), the Login ID grammar check, a pair rule (both or neither)
and `users_login_id_key`, a unique index on the canonical lowercase value (case-insensitive uniqueness). There is no
second identity store. Migrations 0001 and 0002 are untouched.

**Sign-up handoff.** `auth.signUp` carries exactly two bounded, namespaced metadata values, `qandeel_name` and
`qandeel_login_id`. A second AFTER INSERT trigger on `auth.users`, `provision_qandeel_user_identity`, fires after the
0002 provisioning trigger (same event, name order), reads them once, trims the Name, lowercases the Login ID and
writes them into the row 0002 created. The database's own checks and unique index validate them: a malformed or
duplicate value refuses the whole `auth.users` insert, so a modified client cannot bypass validation, and exactly
one account row still exists per auth user. Nothing in QANDEEL reads auth metadata after that insert; the canonical
truth is `public.users`. An account created without the two values keeps NULL — no fallback, no generated Login ID.

**Functions.** `login_id_is_available_v1(text)` returns a boolean only, and only to `service_role`.
`read_account_first_use_v1()` (SECURITY INVOKER, under the caller's own row-level security) returns the caller's Name,
whether the Welcome is complete, and whether the caller has ever committed a USER turn. `complete_first_use_welcome_v1()`
idempotently completes the caller's own Welcome. No client gains a table write on `public.users`.

### 4.2 API — `AccountModule` (`apps/api/src/account/`)

| Route | Guard | Channel | Answer |
|---|---|---|---|
| `GET /account/first-use` | `SupabaseAuthGuard` | caller's token (RLS) | `{ displayName, welcomePending, firstConversationOpening }` — no Login ID, no Email |
| `POST /account/first-use/welcome` | `SupabaseAuthGuard` | caller's token | `204` |
| `POST /account/login-id-availability` | none — chosen before an account exists | server channel (`login_id_is_available_v1` only) | `{ available }`; malformed → `false` without a database call; the Login ID is in the body, never a URL |

`AccountModule` is composed by the application root, `app.module.ts`: account identity is not a Conversation
capability, and `ConversationModule` is byte-identical to the baseline. The three contracts that byte-pinned
`app.module.ts` are re-anchored (§7): every byte except the one import and the one list entry stays pinned.

### 4.3 Auth runtime

The one Supabase client stays in `supabase-auth-port.ts`. The port gains `signUp`, `verifyEmailCode`
(`verifyOtp({ email, token, type: 'email' })`) and `resendEmailCode` (`resend({ type: 'signup', email })`), each
mapping the provider's answer to a typed KIND — never a Product sentence. Verified against the installed
`@supabase/auth-js` 2.116 and the official `supabase/auth` source:

- `signUp` with Email confirmation on returns no session; an existing CONFIRMED Email gets an obfuscated user and no
  Email; an existing UNCONFIRMED Email gets its confirmation re-sent and NO metadata or password change. A project
  that returns a session (confirmation off) is refused: the session is discarded locally and never authenticates.
- `verifyOtp` answers a wrong code and an expired code with the SAME `otp_expired` (403), and the project's OTP expiry
  is external configuration. The entry therefore claims neither: a provider rejection is the approved generic
  verification fallback, and no device clock or assumed lifetime is used to manufacture the distinction.
- A transport failure is status 0 (`AuthRetryableFetchError`); every 5xx, including a trigger refusal ("Database
  error saving new user"), arrives with no code and is never described as a connection failure.
- The password grant verifies the password before `email_not_confirmed` (400), so that answer reveals nothing to
  someone without the credential. T-14's sign-in now maps a status-0 transport failure to its frozen network
  sentence (it previously fell to the "unexpected" sentence).

**The authority.** `signUp` and `verifyEmailCode` are explicit commands on the existing operation epoch. Sign-up
authenticates nobody. Only a CURRENT verification completion may establish the identity, exactly like a sign-in; a
verification superseded by a later command is abandoned, and its session (already persisted by the SDK) is discarded
while nobody is authenticated, so no later launch restores what the reader abandoned. The observed-event barrier is
unchanged. `resendEmailCode` establishes and supersedes nothing. The refresh token never crosses the port; no
password, code or token enters a log, an error message, state other than the owning component's, or a proof artifact.

### 4.4 Mobile layers

- `runtime-entry/account/account-api.ts` — `AccountApiClient` on the AC-01 seam bound to the bundle's own auth
  generation (`MobileRuntimeEntry.accountFor`), and `LoginIdAvailabilityClient` with no credential (`entry.loginIds`).
- `account/` — the new owner layer: `copy.ts` (§2), `entry-rules.ts`, `account-controller.ts` (one per runtime
  generation, retired with it), `entry/` (the Auth Gateway destination and its two forms), `first-use/` (the gate, the
  Welcome, the openings).
- `conversation/` — publishes its resolved visual foundation for the account layer, gains E3's `statement` display role
  (generated, sha-pinned), an `accessibilityState` on `Control`, and an `opening` slot drawn only over a READ, EMPTY
  history. It writes none of the opening's words.
- `integration/` — `ProductRoot`'s `SignedOutEntry` renders the destination with T-14's form through its seam;
  `DepthComposition` stands `FirstUseGate` before the unchanged depth pair and hands the Conversation its opening; the
  integration runtime builds and retires the account controller with the generation and exposes `loginIds`.

### 4.5 The Auth Gateway destination and the Lantern seam

`AccountEntry` assumes nothing about what precedes it. `ProductRoot` still maps exactly two phases to Product surfaces
(`READY`, `SIGNED_OUT`), and `SIGNED_OUT` renders `SignedOutEntry` → `AccountEntry`. The future Lantern task inserts its
moment inside `SignedOutEntry`, before `AccountEntry`, and hands off into it; neither the forms nor the auth flow need
rebuilding. No Lantern visual, motion, interaction, timing or technology exists in W1B-01.

### 4.6 Existing accounts

Before W1B-01 the live project held three `auth.users` rows, all test identities (T-12 Phase M record); no real
account exists. Every pre-W1B account keeps a NULL Name and Login ID: it signs in exactly as before and meets the
Conversation silently, with no Welcome and no opener, exactly as W1A-01 left it — no fallback name, no hidden Login
ID, no profile-completion journey. Giving such an account a Name is W3 identity editing, not W1B.

## 5. First-use durability — the precise semantics

| Moment | Owed while | Consumed by | After an abnormal interruption |
|---|---|---|---|
| Welcome | the account is named, `first_use_completed_at` is NULL, and it has never committed a turn | the start act, written once through `complete_first_use_welcome_v1` | if the write did not land, it is owed again at the next launch — unless the account has conversed since, in which case it is never shown |
| First Conversation Opening | the account has never committed a USER turn (`has_conversed` false) | the account's first committed turn — durable in its own right; nothing marks it consumed on display | shown again: repeated rather than lost |
| Normal opener | a genuinely empty Conversation after the first committed turn | — | — |

No "exactly once rendering" is claimed. The opening is presentation and is never stored as a turn or sent to a model.

**Unknown account state delays first use; it never erases it.** Both first-use moments are retired by the first
committed turn, so the Conversation — the only place a turn can be committed — is never opened while the account's
first-use state is unknown. A read that fails, or has not answered, is asked again; a timeout or a transport failure
consumes, completes and bypasses nothing, and any later successful answer resolves normally.

## 6. Residue and external gates

- **Reserved-but-unverified Login ID (§7.3 of the task).** A Login ID is written at sign-up, before verification, so an
  abandoned unverified sign-up keeps holding it, and a reader who retries sign-up with the same Email gets the code
  re-sent while their FIRST Name and Login ID stay (Supabase changes no metadata for an unconfirmed user). No expiry
  or cleanup policy is invented here — it is a Product/security decision for a later task.
- **Login ID availability hardening — deferred to deployment / security hardening.** `POST
  /account/login-id-availability` is unauthenticated by design (it is asked before an account exists) and is NOT
  rate-limited by QANDEEL: its boolean answer can be asked repeatedly to probe which Login IDs are taken. W1B-01
  keeps the endpoint and its Product behaviour as they are and adds no rate-limit subsystem, gateway rule or
  dependency; per-client throttling belongs to the later deployment/security hardening of the API edge. Supabase's
  own sign-up and Email rate limits still apply to sign-up itself.
- **A silent wait while the account cannot be read.** If the first-use read keeps failing (the API or the database is
  unreachable), a signed-in reader sees the Dark World until a retry answers (§5). No approved words exist for that
  moment, so none are shown; a visible treatment for it needs Product Owner copy in a later task.
- **The sign-up metadata stays in the auth record.** Supabase keeps `qandeel_name` / `qandeel_login_id` as the auth
  user's metadata, which also rides in that user's own access token. It never leaves the auth context (the token
  goes only to the QANDEEL API, which never logs it), QANDEEL never reads it after the insert, and a later change
  to it changes nothing canonical. W3 identity editing should decide whether to clear it.
- **Supabase project configuration — required for the live flow, and NOT verified from this repository** (the
  repository holds no Supabase config and this task has no project access):
  1. Authentication → Email → **Confirm email: ON** (the app refuses a sign-up that returns a session, so with it OFF
     sign-up fails closed with the generic refusal rather than bypassing verification);
  2. the **Confirm signup** Email template must emit the code — `{{ .Token }}` — rather than only `{{ .ConfirmationURL }}`;
  3. **Email OTP length: 6** and **Email OTP expiration: 3600 s** (Supabase's default; the entry does not judge
     expiry itself);
  4. a production SMTP provider: Supabase's default sender only delivers to project team addresses and is heavily
     rate-limited.
  Live Email delivery is therefore **not proved** by W1B-01.

## 7. Verification

Exact-head results are in the Draft PR description.

- **Database:** `database/verify-migration-0123.mjs`, registered as `verify:account-identity-first-use:integration`
  and run once in API CI against the fully migrated database: catalog and grants; exactly one account row per sign-up
  with trimmed Name and canonical Login ID; NULL identity without the values; case-insensitive duplicate refusal;
  seventeen malformed shapes refused with no auth account left behind; the grammar's legal edges; the availability
  boolean and its grants; the caller-only first-use read and idempotent Welcome completion; a new account still owning
  Sessions and turns through the existing foreign keys and row-level security.
- **API:** `apps/api/src/account/account.spec.ts` — first-use semantics, availability (grammar, body shape, failures),
  transports and channels, route guards.
- **Mobile:** `runtime-entry/__tests__/account-auth.test.ts` (sign-up / verify / resend races on the real authority),
  `account-auth-port.test.ts` (the production port over the SDK's real error shapes), `account/__tests__/*` (rules,
  controller, the entry flows on the real authority, first use and openings on the production surfaces).
- **Root:** `tests/w1b-01-account-identity-first-use-contract.test.mjs`, registered once in Mobile CI.

**Re-anchored, with the expired delivery fact stated in place:** T-14 "the surface names no colour at all" (now: every
colour is one the canonical palette resolves), T-14's `SignedOutEntry` pin (now also carries `loginIds`), the T-12P
public-barrel census (three deliberate additions) and AC-01.1's wire list (the account read carries the refreshed token).
The W1B-01 correction re-anchors the `app.module.ts` blob pin in the T-03C historical-projection, T-03B3 thread-lifecycle
and T-03D live-focus contracts: the AccountModule composition is subtracted and the remainder must still be the
baseline blob `fc3ce9c`.

## 8. What W1B-01 deliberately does not do

Login-ID sign-in (`E2E-A-07`, W2); password recovery (`A-11`); session-expired treatment (`A-12`); the Lantern moment
(`QAN-BL-LANTERN-01`, `E2E-A-03`); the Global Shell, Shared and Public worlds; identity editing and General Settings (W3);
an account photo; Voice; Replay; Plans / Credits; provider selection; the W4 Living Analysis World port; a Session
browser or "new conversation" control; an unverified-account expiry policy; social sign-in.

## 9. Backlog (BG-05 / BG-08)

W1B-01 inherits no canonical backlog item (BG-05); `QAN-BL-SEC-01`'s constraint is respected — nothing new is put in
auth storage and no credential hardening is attempted; `QAN-BL-LANTERN-01` is untouched. W1B-01 is a Draft
implementation slice and closes no phase, so it records no closure. Its residue (§6) is tracked by the E2E-01 gap
matrix rows it names, and the external Supabase configuration gate is recorded here for the Product Owner.
