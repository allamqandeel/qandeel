# QANDEEL — W3-MEGA-A Account & Identity Completion + Security v1 — Implementation Record v1

**Task:** W3-MEGA-A — Account & Identity Completion + Security v1 (E2E-01 wave W3)
**Rows:** `E2E-D-03` (Name; Account Photo), `E2E-D-04` (Change Email), `E2E-D-05` (Change Login ID), `E2E-D-06`
(Security & Sign-in v1), `E2E-D-08` (Shared ID — format backend only), `E2E-D-02` (advanced only)
**Baseline:** `f3355e7e0aafacec4153d9049aa029b65a851c13` (merge of PR #294, W3-PDG-01)
**Branch:** `feat/w3-mega-a-account-identity-completion`
**Status:** IMPLEMENTED ON A DRAFT PR — NOT MERGED. `READY FOR INDEPENDENT REVIEW — DO NOT MERGE`. One bounded,
Product-Owner-authorized Production Integration slice; it opens no later stage, closes no phase and does not close W3.
**Product authority:** only the statements marked **PO** in the
[W3-PDG-01 closure](../canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md),
and P1 §2 / §8.1. No `IMPLEMENTATION CONSIDERATION — NOT FROZEN` item was turned into Product law.

---

## 1. Repo truth

- `origin/main` was exactly `f3355e7e0aafacec4153d9049aa029b65a851c13` at kickoff; the tree was clean; the branch was cut from it.
- Read before coding: `AGENTS.md`, `QANDEEL_CURRENT_STATE.md`, the backlog (rules, register and the three adjacent items),
  `docs/e2e/E2E01_READ_FIRST.md`, P1 §2–§8 / §13 / §16, the W3-PDG-01 closure, the W2-01 and W3-02 records (W1B-01 and
  W3-01 through their records' carried facts and contracts), migrations `0081`, `0123`, `0124`, `0125`, and the account,
  auth, relay, settings and runtime-entry code.
- The provider's behaviour was verified against the official Supabase Auth source, not assumed (§6).

## 2. Skills / G1

Inspected: the session roster (`react-native-best-practices` and its sub-skills, `sibawayh:designing-arabic-frontends`,
`sibawayh:writing-eloquent-arabic`, `security-review`, `code-review`, `impeccable`, `ui-ux-pro-max`, `emil-design-eng`,
the animation skills, `run`, and non-mobile skills).

Used:
- `react-native-best-practices` — the project is Expo / React Native. None of its sub-skills applied: this slice adds
  no animation, gesture, SVG, worklet, JSI or audio work (rows and forms over the existing `Control` / `TextInput`).
- `sibawayh:designing-arabic-frontends` — §4 mixed-direction boundaries: every Login ID and Email drawn inside an
  Arabic line is an LRI … PDI isolate; each Latin field (Login ID, Email, password, code) is its own explicit LTR
  context, while the Name field follows the reader's direction (a Name may be Arabic). §3: both Arabic-Indic digit
  ranges normalize in the code fields (W1B-01's `normalizeEmailCode`, reused).
- `sibawayh:writing-eloquent-arabic` — the four Arabic candidates (§7.6) were drafted in MSA to match their
  approved siblings' structure («كلمة المرور غير صحيحة.» beside «رمز التأكيد غير صحيح.»; «تم تسجيل الخروج من الأجهزة
  الأخرى.» beside «تم تغيير كلمة المرور.»). Drafting is not approval: the Product Owner approved them in R1, with C1 changed
  to «تم التحقق».

Could not run: `security-review` and `code-review` (their inline shell steps use the Bash tool, which this host's
application-control policy blocks). Their purpose is served by independent review agents on the finished diff (§12).

Not used: `impeccable` / `ui-ux-pro-max` / `emil-design-eng` (no new visual language — the W3-01 / W3-02 composition
is reused as is), the animation skills (no motion), `run` (no device run was performed; §11).

## 3. Anti-Duplication Gate

| Capability | Frozen Product authority | Existing backend / runtime | Existing mobile | Genuinely missing (built here) | Not rebuilt |
|---|---|---|---|---|---|
| Account projection | P1 §8.1 | Name + Login ID on `public.users` (0123); Public ID read (0125) | Account & Identity group, Public ID row | owner read of Name, Login ID, Email + status | Public ID read / route / UI |
| Name (D-03) | P1 §2.3 | `users.name` + 0123 shape CHECK | — | owner-only change | Name store; sign-up normalization |
| Account Photo (D-03) | P1 §2.5 | **no media / storage / upload primitive** | — | nothing (§9) | — |
| Login ID change (D-05) | P1 §2.1 | 0123 grammar, unique index; 0124 resolution | W1B rules + copy | change command + reauthentication | grammar, namespace, sign-in route |
| Reauthentication | W3-PDG-01 §2 step 1 | W2-01 relay → provider password grant | — | its reuse as proof (§8) | a second auth path |
| Change Email (D-04) | W3-PDG-01 §2 | provider secure email change | W1B code UI rules + copy | orchestration, `email_exists` masking | a verification engine |
| Change Password (D-06) | W3-PDG-01 §3 | provider `PUT /user` (ends other sessions) | W2-01 new-password copy | owner route + form | recovery flow |
| Sign out other devices | W3-PDG-01 §3 | provider `logout?scope=others` | W3-01 Sign out row | route + row | a device dashboard |
| Recovery ends others | W3-PDG-01 §3 | provider already ends all but the recovery session | W2-01 recovery | an explicit `scope=global` end | W2-01 copy or flow |
| Shared ID format (D-08) | W3-PDG-01 §4 | 0081 rotation + epoch invalidation | — (W6) | generator, normalizer, generated regeneration | 0081 core; any surface |

Preserved explicitly: the `public.users` row and W1B identity; the Login-ID grammar, uniqueness and non-enumeration; W2
Login ID OR Email sign-in; the W2 recovery ending (signed out); the ONE General Settings destination; the W3-02 Public
ID database, API and surface; the auth / session authority; migration `0081`; no Profile page; no second Settings
destination; no second auth provider; no client-visible Login ID → Email directory; no user-supplied account id in any
mutation.

## 4. Database — migration `0129_account_identity_completion_security_v1.sql`

Additive and forward-only; one ledger table and nine functions; 0001–0128 untouched. Every privileged part lives in the
non-exposed `account_private` schema (0125); every function in `public` is SECURITY INVOKER; `search_path = ''`
everywhere; default-deny by name; exact grants.

- `public.read_own_account_identity_v1()` — the caller's own Name and Login ID (RLS).
- `public.change_own_account_name_v1(name)` → private DEFINER: trimmed and bounded exactly as sign-up stores it;
  `CHANGED` / `UNCHANGED` / `INVALID`.
- `public.change_own_login_id_v1(command, login_id)` → private DEFINER. **Before anything is read or written** it
  demands `account_private.has_recent_password_proof_v1()`: the request's own provider-signed claims carry an `amr`
  entry with method `password` and a timestamp within the last minute (and not in the future). Then 0123's
  grammar, the caller's own Public ID refused as `INVALID` (0125's same-row rule), `UNCHANGED`, `UNAVAILABLE` from the
  unique index (names nobody). No cooldown, no lifetime limit. 0124 resolves only the current value, so the old Login
  ID stops signing in at the commit. The idempotency ledger `account_private.login_id_change_commands` keeps the command
  identity and a SHA-256 digest of the value — never the value — so a replay answers the committed truth and a late
  duplicate can never re-apply an old value; `ON DELETE CASCADE` with the account row.
- Shared ID (§10): `normalize_shared_id_v1`, `generate_shared_id_v1`, `regenerate_own_shared_id_v1` — executable by no
  client role and not by the server channel.

`database/verify-migration-0129.mjs` (`verify:account-identity-completion-security:integration`, API CI) proves the
catalog and the exact client-executable set; the identity read and Name change; the Login ID change refused with no,
a 90-second-old, a ten-minute-old, a future or a non-password proof and committed with one; the 0124 cut-over and the unchanged Email; replay,
conflict (also across accounts), every outcome, no cooldown; a digest-only ledger; the Shared ID normalizer, generator
(400 draws), first setup, replay, a typed lower-case Shared ID resolving through 0081, and regeneration invalidating the
old epoch's PENDING invitation; and committed two-connection races (two accounts, one Login ID → one holder; the same
command twice → one commit).

**0125 verifier re-anchored (validation only).** Its catalog listed EVERY function of `account_private` and forbade any
other function named `*login_id*`, so any later account function failed W3-02's proof. Its lists are now scoped to the
Public-ID functions it owns, and its whole-schema client-executable list and no-oracle census name 0129's two owner
changes explicitly. The permanent claims — no broad grant, no lookup or availability oracle — are still asserted.

## 5. API — `apps/api/src/account/`

- `account-security.controller.ts` — seven routes, the whole controller guarded, no account in any path:
  `GET identity`; `POST name/change`, `login-id/change`, `email/change`, `email/confirm`, `password/change`,
  `sessions/sign-out-others`. Bodies are exact key sets; anything else is 400; no usable answer is 503.
- `account-security.service.ts` — the owner's changes. `account.service.ts` (W1B / W3-02) is unchanged and still never
  handles an Email (W1B / W2 contracts).
- `account-identity.repository.ts` — every call on a token (never the server channel); the Login ID change on the proof
  token.
- `supabase-password-grant.service.ts` (the W2-01 relay, the ONE file that talks to the provider as an account):
  `readOwnUser`, `requestEmailChange`, `verifyEmailChangeCode`, `changePassword`, `endSessions`. Still one password
  grant, once (T-12P); the secret key and the reader's forwarded address on every call; nothing logged; no provider word
  returned. Without `SUPABASE_SECRET_KEY` every new route fails closed.

## 6. Provider facts, verified against the official Supabase Auth source

- `User.UpdatePassword(tx, sessionID)` ends every session but `sessionID` (`LogoutAllExceptMe`), or all of them when
  none is given. So a password change on the owner's session ends every OTHER session, and a recovery update ends every
  session but the recovery grant's.
- `PUT /user` with an address another account holds answers `422 email_exists` — an oracle the relay masks (§7.2).
- Secure email change: `sendEmailChange` hashes the new-Email code with the new address and — only when "Secure email
  change" is enabled — the current-Email code with the current address. `emailChangeVerify` returns a message after the
  first confirmation and changes the Email (and issues a session) only after the second.
- `UserUpdate` enforces "Secure password change" (a nonce for sessions older than 24 h) and, when configured,
  `current_password`.

## 7. Product journeys as implemented

### 7.1 Name (D-03, Name part)
Row → a state of the destination: the Name term, the current Name, one field (reader's direction, no First / Last
split), Confirm change. Empty → W1B's «أدخل الاسم.». The row shows the server's Name after the commit; a lost answer is
reconciled by reading.

### 7.2 Change Email (D-04), exactly W3-PDG-01 §2
1. password + new Email → the server proves the password on the caller's own Email, ends that proof session, and asks
   the provider to start the change. An address another account holds answers exactly like a free one (`ACCEPTED`).
2. The codes step names both addresses with W1B's own instruction («أرسلنا رمزًا إلى {email}…», the reader typed both),
   two six-digit fields, «تأكيد البريد» / Verify email and W1B's resend (which says nothing of its own — W2-01 posture).
3. The server verifies the **current-Email code first**, then the new one. A project without "Secure email change" has
   no current-Email code, so the change can never complete on the new Email alone — it fails closed.
4. Only when the provider accepted both: its new session and the caller's own session are ended, and the device signs
   out through the ONE W3-01 sign-out → Sign in. The Login ID is untouched; 0124 then resolves to the new Email.
5. Any rejection (wrong, expired, or an address another account holds) is ONE answer, W2-01's approved N7 «تعذّر التحقق
   من الرمز. تأكد منه أو أرسل رمزًا جديدًا.» / "We couldn't verify this code. Check it or send a new one." — which also
   points the reader to the resend when the provider has consumed the current-Email code (§13 item 6).
   Expiry or abandonment leaves the old Email exactly as it was (the provider changes nothing before step 4).

### 7.3 Change Login ID (D-05)
New Login ID with W1B's persistent help, then the password. The server proves the password and makes the change **on
the proof token**, which the database checks (§4). Answers: W1B's malformed / empty / unavailable sentences; the
password refusal (C4, §7.6); the network sentence after a lost answer that the read-back does not show committed.

### 7.4 Security & Sign-in v1 (D-06)
Exactly: Change password; Sign out from other devices; the current Email and its status as the recovery method. No
Phone, 2FA, Passkeys, device list, activity log or disabled row.
- **Change password:** current password, new, confirmation (W2-01's words). The server proves the current password and
  changes it on the owner's session; the provider ends every other session; `logout?scope=others` makes it explicit.
  This device continues and «تم تغيير كلمة المرور.» is said at the row. If the project requires a fresh session
  (Secure password change), the change is made on the proof session instead and this device is signed out too — the
  secure mechanism does not allow the current device to continue, and the surface says so by returning to Sign in.
- **Sign out from other devices:** the provider's `logout?scope=others` with the owner's token; said only when the
  provider confirmed it; this device stays signed in.
- **Recovery ends all other sessions:** W2-01's recovery update now ends every session of the account
  (`logout?scope=global` with the grant) before it retires the grant as before; the reader still ends signed out.

### 7.5 Copy — reused, by reference

| Use | Source (verbatim, imported, not re-typed) |
|---|---|
| «الأمان وتسجيل الدخول» / Security & Sign-in | P4-C4 §4 `gSecurity` |
| Current / New / Confirm change | P4-C4 §5 `pidCurrent`, `pidNew`, `pidConfirm` |
| Name, Login ID, Login ID help, Email, Password; empty Name / Login ID; malformed / unavailable Login ID; invalid Email; verification code, instruction, Verify email, resend, incomplete code | W1B-01 `accountEntryCopy` |
| Change password, New password, Confirm new password, mismatch, password rules, "Password changed.", the rejected code (N7) | W2-01 `accountAccessCopy` |
| «تعذّر الاتصال. حاول مرة أخرى.» | T-14 network sentence |

### 7.6 The four new pairs — `APPROVED — PRODUCT OWNER (W3-MEGA-A R1)`

| # | Use | Arabic | English |
|---|---|---|---|
| C1 | Email status (recovery method) | تم التحقق | Verified |
| C2 | The action (the English is the PO's own row name, W3-PDG-01 §3) | تسجيل الخروج من الأجهزة الأخرى | Sign out from other devices |
| C3 | Its confirmed result | تم تسجيل الخروج من الأجهزة الأخرى. | Signed out from other devices. |
| C4 | A re-entered password the provider refused | كلمة المرور غير صحيحة. | The password is incorrect. |

The Product Owner approved C1–C4 in R1, replacing the first C1 candidate «مؤكَّد» with «تم التحقق»; C2–C4 are approved
as proposed. They are frozen for this slice, live only in `apps/mobile/src/settings/copy.ts`, and are pinned byte-for-byte
by the W3-MEGA-A contract. No other new copy exists. Noted for the Product Owner, reused rather than new: the W1B
instruction "We sent a code to {email}" is shown for the new Email even when another account holds it (nothing is sent
then) — the same non-enumerating posture W1B-01 sign-up already has for an existing address.

## 8. `E2E-D-05` verification-boundary disposition — RESOLVED BY REUSE — PRODUCT OWNER APPROVED

P1 §2.1 requires "appropriate identity verification" and freezes no mechanism. W3-PDG-01 §2 froze current-password
re-entry as the first step of changing an identifier (the Email), and W2-01 already relays a password to the provider's
own password grant. W3-MEGA-A reuses exactly that: the password is proved by the provider on the caller's own Email, and
the database accepts the change only on a token that carries that fresh provider password authentication. No new
journey, no OTP invented, no weaker check. This is an implementation detail, not new Product authority.

**`D-05 verification-boundary interpretation — PRODUCT OWNER APPROVED` (R1).** The Product Owner approved that re-entering
the password through the provider's password grant is "appropriate identity verification", that reusing this path needs
no new Product journey, and that the current recent-password-proof window (about one minute) is accepted as an
implementation detail and recorded residual (§13 item 12). No reauthentication subsystem is to be built.

Independent security review (§12) noted that the database cannot tell the API's proof session from any other session
whose password sign-in is equally fresh: the Product RPC is callable by `authenticated`, so a session signed in with a
password moments ago also qualifies. That session's own `amr` IS a provider password authentication, so the rule holds
("recently proved the password"), but the window was narrowed from five minutes to **one minute** in response (the API
spends a proof within milliseconds). A token stolen within that minute of a password sign-in could change the Login ID
without re-entering the password; that residual is recorded in §13.

## 9. Account Photo — `Account Photo — BLOCKED / DEFERRED BY MEDIA STORAGE IMPLEMENTATION BOUNDARY`

No production media, storage or upload primitive exists: no storage bucket, upload route, image picker or media
relation in any migration or app; I-04's closure lists "a media storage provider, upload path or storage credential" as
its boundary; I-06 keeps media outside; P1 §16.1 defers media storage. Owner authority, replacement / removal, no
automatic Public exposure and no Shared exposure before acceptance cannot be proven on nothing, and inventing a media
subsystem is out of scope. No local-only photo and no external URL were faked. **`E2E-D-03` stays OPEN**: Name
implemented, Photo blocked.

## 10. `E2E-D-08` — Shared ID backend format ready; surface waits for W6

Backend: `generate_shared_id_v1` (12 Crockford base-32 characters grouped 3 × 4, 60 bits from `gen_random_uuid()`, no
account data), `normalize_shared_id_v1` (case-insensitive; spaces and hyphens ignored; O → 0, I / L → 1),
`shared_id_lookup_ref_v1` and `regenerate_own_shared_id_v1(command)`. The regeneration takes no value and hands the
generated value's **derived reference** to 0081's frozen rotation — so PENDING invitations of the older epoch are
INVALIDATED and born Worlds are untouched, by 0081's own law — and returns the value once, storing it nowhere.

0081's representation boundary says persistence holds "only an opaque derived `credential_lookup_ref`" and that "a later
reviewed adapter may change how a human secret becomes this reference". `shared_id_lookup_ref_v1` is that adapter:
`sid1:` + SHA-256 of the canonical Shared ID. So no Shared ID — current or past — is stored in clear, in the credential
state or in the command history, and a typed Shared ID resolves case-insensitively through its reference. (The first
draft stored the Shared ID itself as the reference; independent correctness review caught that it contradicted 0081, and
it was corrected before the first push.) A replay of a committed regeneration answers its epoch with no value. Where the
owner later reads a current Shared ID ("copyable") is the W6 surface's storage decision. Alphabet, look-alikes,
separators and the reference derivation are implementation detail. No client role can execute any of it; no API route,
no mobile code, no Settings row exists. The frozen 0081 rotation still accepts a client-supplied reference from `authenticated`:
nine frozen I-04 verifiers exercise that grant, and W3-PDG-01 §4 places "where generation happens" with the task that
surfaces the Shared ID. The W6 surface must route regeneration through the generated command and decide that legacy
grant; the owner's read of the Shared ID is W6's. **`E2E-D-08`: DECIDED; backend format ready; the user journey is NOT
closed.**

## 11. Verification (local; CI results are in the Draft PR)

| Gate | Result |
|---|---|
| `database/verify-migration-0129.mjs`, re-anchored `verify-migration-0125.mjs` (real PostgreSQL) | registered in API CI; **not runnable on this host** (no local PostgreSQL — application control) — proven by CI on the pushed head |
| Static database contracts `node --test database/tests/*.test.mjs` | 1281 / 1281 |
| API `src/account` Jest (incl. new `account-security.spec.ts`) | 4 suites, 113 / 113 |
| `apps/api` `tsc --noEmit` | pass |
| Full mobile Jest (`jest --ci`), incl. `account-identity-controller`, `account-security-settings` (AR + EN), `w3-mega-a-account-security` (production surface), re-anchored `account-access-port` | 156 suites, 1853 / 1853 |
| `npm run typecheck:mobile` (`tsc --noEmit -p tsconfig.json`) | pass — re-run after the last test edit (it caught a TS2345 in the new integration test that Jest cannot see; the test's type was fixed) |
| ESLint on every changed mobile file | 0 problems — import-resolution rules off locally (blocked native resolver binding); a planted hooks violation proved the config live; CI lints on Linux |
| W3-MEGA-A root contract `npm run test:w3-mega-a-account-identity-security-contract` | 15 / 15; every critical predicate rejects its planted defect |
| Every root contract that reads a touched file (60 contracts: re-anchored W3-01 and W3-02; W1B-01, W2-01, T-12P, T-14, W3-MEGA-M, U1–U3, current-state and task-closure governance, among others) | 864 / 864 |

No device (Maestro) run was performed: this slice is Settings rows and forms over the frozen composition, proven in
RNTL for AR / EN, RTL / LTR, accessibility names, live regions and focus return.

Failure classification during the work: the recovery port test (validation — it pinned W2-01's call list, superseded
by W3-PDG-01 §3; re-anchored, the app was not reverted); the W3-01 and W3-02 contract tests that refused `gSecurity`
and any non-Public-ID Account row (validation — scope boundaries this task supersedes; re-anchored keeping their
permanent claims); the 0125 verifier's whole-schema catalog (validation — re-anchored, §4); two guards of the new
W3-MEGA-A contract that did not reject their own planted defects, and a type error in the new integration test
(validation — both in this task's own proof, fixed there). No Product or infrastructure failure was found locally.

## 12. Security and privacy

- Owner-only everywhere: the account is the verified token's; no route, body or function takes an account id.
- No Login ID → Email directory: the only Email the server reads is the caller's own, from the caller's own token. The
  owner sees their own Login ID and Email in Settings (P1 §8.1 places both there), which is the owner's session data,
  not an answer about a Login ID.
- No oracle: a taken new Email is indistinguishable; a taken Login ID answers `UNAVAILABLE` only behind a proved
  password and names nobody; no availability or lookup function was added.
- No client-only enforcement: the Login ID reauthentication is enforced by the database; grammar, uniqueness and the
  same-row rule are database rules. The password and Email changes are the provider's; the server's password step is
  in front of them (§13 item 4).
- Nothing logged; no password, code, token, Email or id in telemetry; a typed password lives only in the form's state.

**Independent adversarial security review** (a separate reviewer agent over the finished diff, in place of the
`security-review` skill): no HIGH finding. MEDIUM — the Login ID proof window (narrowed to one minute, §8, §13 item 12);
the provider accepting direct changes from any live session (recorded as external configuration, §13 items 2 and 4);
the pre-existing 0081 client-supplied rotation (§10, §13 item 15). LOW — the current-Email code consumed after a rejected
new-Email code (§13 item 6); the Email-change password held until the change closes (comment corrected); an unanswered
proof-session logout (§13 item 13); send-time timing (§13 item 14). Checked and sound: claims inside the DEFINER, owner
binding, exact grants, no DEFINER added to `public`, the ledger, the generator's randomness, non-enumeration of a taken
Email, current-Email-first ordering, session ending after a password or Email change, and no logging.

**Independent correctness review** (a separate reviewer agent that traced 0129 and its verifier by hand against
PostgreSQL 17 semantics, since this host cannot run PostgreSQL): nothing found that would fail in CI — RETURNS TABLE
names, row / record variables, the `bit(60)` casts, `sha256` under an empty `search_path`, the 0125 guard trigger and
CHECK interplay, READ COMMITTED race behaviour and every expected SQLSTATE were checked. Acted on: the Shared ID stored in
clear (corrected, §10); the rejected-code message now steers to "send a new one" (W2-01's approved N7, §7.2); the Name
length counted in code points like the database; the proof check's cast made order-safe. Recorded: the burned
current-Email code (§13 item 6), the password-change retry wording (§13 item 5), and a legacy account without a Login ID
getting 503 instead of INVALID (unreachable: its row is not drawn).

## 13. Residues and external dependencies

1. **Copy gate — RESOLVED in R1:** the Product Owner approved C1–C4 (§7.6); no copy decision remains.
2. **External configuration, not held by this repository:** "Secure email change" ON (otherwise Change Email fails
   closed, by design); the change-email template emitting the six-digit code to BOTH addresses; OTP length 6;
   `SUPABASE_SECRET_KEY` with IP forwarding (W2-01 §7). Live Email delivery remains **EXTERNAL / NOT PROVED**.
3. **Signed-out devices:** the provider revokes their sessions and refresh tokens; an access token already issued lives
   until its expiry (the project's JWT lifetime) on surfaces that verify the signature only.
4. The provider itself accepts a password or Email change from any live session of the account (plus, for the Email,
   the old-inbox confirmation). QANDEEL's password step is enforced on its own routes; making the provider demand it
   too is project configuration ("Secure password change" / current-password requirement).
5. After a lost password-change answer nothing readable says whether it committed: the surface says "try again", and a
   retry may meet "The password is incorrect." if it had committed. Never a false success.
6. If the current-Email code is accepted and the new-Email code then rejected, the provider has consumed the
   current-Email code: the reader asks for new codes ("Send again").
7. A released Login ID is immediately available to another account (P1 is silent on reservation; none invented).
8. No QANDEEL rate limit on Login ID / Email / password attempts beyond the provider's per-reader limits.
9. The frozen 0081 client-supplied rotation and the owner's Shared ID read are W6's (§10).
10. Account deletion (W3-MEGA-S / `QAN-BL-ACCT-01`) must cover `account_private.login_id_change_commands` (it cascades
    with the account row).
11. Real-PostgreSQL proof is CI-only on this host.
12. **Login ID reauthentication window (review finding, narrowed not removed; ACCEPTED by the Product Owner in R1 as an
    implementation detail):** any session whose provider password
    authentication is under a minute old satisfies the database check (§8).
13. A proof session whose `logout?scope=local` gets no answer stays alive until the provider expires it; its refresh
    token was discarded, and "Sign out from other devices" ends it.
14. Starting an Email change for an address another account holds skips the provider's send, so it can answer faster
    than a real send (timing only; the content and status are identical).
15. The frozen 0081 rotation is itself a SECURITY DEFINER in `public` granted to `authenticated` and accepts any
    non-blank reference (pre-existing, I-04); 0129 neither widens nor uses that grant for clients (§10, W6).

## 14. Rows

| Row | Status after this slice |
|---|---|
| `E2E-D-03` | ADVANCED — Name implemented; **Account Photo BLOCKED / DEFERRED BY MEDIA STORAGE IMPLEMENTATION BOUNDARY**; row NOT closed |
| `E2E-D-04` | IMPLEMENTED on the Draft PR (server + mobile, both confirmations, no partial change, signed out after, non-enumerating); copy approved (R1); closes when this PR merges green; live delivery EXTERNAL / NOT PROVED |
| `E2E-D-05` | IMPLEMENTED on the Draft PR (reauthentication resolved by reuse — PRODUCT OWNER APPROVED, §8); closes when this PR merges green |
| `E2E-D-06` | IMPLEMENTED on the Draft PR (v1 exactly; change / recovery end other sessions); copy approved (R1); closes when this PR merges green |
| `E2E-D-08` | DECIDED — backend format ready; surface sequenced to W6; user journey NOT closed |
| `E2E-D-02` | ADVANCED — four real groups; the nine-group hierarchy is NOT closed |

W3 stays ACTIVE. No row is `COMPLETE / PRODUCTION-READY`.

## 15. Backlog (BG-05 / BG-08)

BG-05: no backlog item names W3-MEGA-A or W3 as its owner; nothing is inherited. `QAN-BL-SEC-01` stays `DEFERRED —
OWNED` (its reopen condition is not met: no auth-storage mechanism, backup policy, credential model or mobile threat
model changed — the recovery amendment is a provider call, and no password is stored). `QAN-BL-ACCT-01` and
`QAN-BL-CW-01` are untouched and stay `OPEN — UNASSIGNED`; no Connected-Worlds deletion and no account deletion is
implemented. BG-08: this Draft slice closes no phase and no `CLOSED / FROZEN` task; its residues (§13) are tracked by
this record and the E2E rows they name, and the copy items are active-task blockers (BG-01), not backlog. No item is
admitted.

## 16. R1 — independent-review correction (same branch, same Draft PR #295)

A narrow correction on reviewed head `906ebf59fdca2ebd8893c19aafef3115143a8769`. No scope, design or Product decision was
reopened; migration `0129` is unchanged.

- **First API CI failure — VALIDATION / PROOF defect, not implementation.** API CI run `36754110029` failed in the step
  "Verify W3-MEGA-A account identity completion and the Shared ID format against real PostgreSQL", at the stage
  `shared id: the derived lookup reference (0081 representation boundary)`. The fixture `'not a shared id'` was assumed
  invalid, but with its spaces ignored it is `NOTASHAREDID` — twelve characters of the Crockford alphabet, so a valid
  Shared ID whose reference is non-NULL. The fixture is now `'K7QM 4XWD P9TU'` (U is outside the alphabet and not a
  look-alike). Every earlier 0129 stage — catalog, identity read, Name, the Login ID reauthentication and cut-over, the
  normalizer and the generator — had already passed on PostgreSQL 17 in that run.
- **First Mobile CI failure — INFRASTRUCTURE FLAKE.** Mobile CI run `36754109766` failed only in "iOS (iPhone 17 / iOS
  26.5 simulator boot smoke)": the Maestro / XCTest iOS driver was not ready in time. The iOS build producer, artifact
  provenance, simulator boot and install, the Android smoke and the fast mobile contract gate all passed. No application,
  timeout or workflow change was made for it.
- **Product Owner decisions recorded:** `D-05 verification-boundary interpretation — PRODUCT OWNER APPROVED` (§8); C1–C4
  approved, with C1's final Arabic «تم التحقق» (§7.6).
- **R1 files:** `database/verify-migration-0129.mjs` (the fixture), `apps/mobile/src/settings/copy.ts` (C1 and the
  approved block), `tests/w3-mega-a-account-identity-security-contract.test.mjs` (the four approved pairs pinned
  byte-for-byte), this record, `docs/e2e/E2E01_READ_FIRST.md` and `QANDEEL_CURRENT_STATE.md` (locator wording).
