# QANDEEL — W3-PDG-01 Account, Security & Privacy Decision Package v1

**Status:** `DECISION EVIDENCE / OPTIONS — NOT INDEPENDENT PRODUCT AUTHORITY`. On 2026-09-30 the Product Owner
explicitly approved the seven decision directions recorded in the
[W3-PDG-01 Product Decision Closure v1.0](../canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md)
(`CLOSED / FROZEN — PRODUCT DECISIONS`). That closure is the only Product authority. This package remains research
and options evidence. A recommendation or suggested Response-Sheet answer below becomes Product authority only if the
closure states it as a **PO** decision; appearing here is never enough. The closure's §10 lists where this package's
options differ from the approved decisions.

The package is otherwise kept unchanged below this banner. Its "NOT AUTHORITY" labels and its original "awaiting"
ending describe its state when it was written.
**Original status:** `PRODUCT DECISION PACKAGE — AWAITING PRODUCT OWNER DECISIONS`
**Task:** W3-PDG-01 — Account, Security & Privacy Product Decision Gate (document / decision package only)
**Baseline:** canonical `main` = `3c0ea458a22a17a2a50c616b708f097f5911fb34` (merge of PR #293), verified by `git fetch` on 2026-09-30
**Rows owned:** `E2E-D-04`, `E2E-D-06`, `E2E-D-08`, `E2E-D-11`, `E2E-D-12`, `E2E-D-16`, `E2E-D-17`
**Authority created by this document:** none. Nothing here is frozen. No E2E row is closed. Every recommendation is
`RECOMMENDATION — NOT AUTHORITY` until the Product Owner answers the Response Sheet (§8) and a later controlled change
records the answers in canonical authority.

---

## 1. Executive summary (plain language)

Seven account/privacy questions are still open. Since the E2E-01 audit was written, QANDEEL gained real sign-up, a
6-digit Email code, Login-ID-or-Email sign-in, password recovery, Sign out, Settings, Appearance and the Public ID.
None of those slices built **Change Email, Change Password, device/session control, Shared ID screens, a language
choice, an in-app accessibility setting, data export or account deletion**. So all seven rows are still genuinely open —
but several can now reuse what was built.

| Row | What is really open | Size of the decision | Recommendation (NOT AUTHORITY) in one line |
|---|---|---|---|
| D-04 Change Email | how you prove it's you, and who gets told | small | Password + code to the new Email + confirmation from the old Email; old Email stays active until done |
| D-06 Security & Login | which controls exist in v1 | small | Change Password, "Sign out of other devices", Email/recovery status. No phone, no 2FA, no device list in v1 |
| D-08 Shared ID | how the code looks and how regeneration feels | small | 12-character grouped code, case-insensitive; confirm before regenerating; decide now, show it when Shared invitations ship |
| D-11 App language | in-app switch or follow the phone | small | Follow the phone; add a "Language" row that opens the phone's per-app language setting; replies keep following the conversation |
| D-12 Accessibility | any in-app accessibility setting? | small | None in v1; keep honouring the phone's settings and close the three signals not yet honoured |
| D-16 Export my data | what, how, how delivered | medium | In-app request → password → prepared in background → download inside the app for a limited time |
| D-17 Delete my account | what deletion means everywhere | **large, partly blocked** | Real deletion (not deactivation) with a short cancel window. **End-to-end deletion across Shared / Public / Replay / Introductions is NOT possible truthfully today** (§6) |

**The one hard truth:** QANDEEL's database was deliberately built so that history cannot be deleted
(`database/README.md:13-15`, `:29-30`; Stage 6.6 ruling lines 681, 685). Account deletion therefore needs a separately
governed erasure exception — the very thing the Stage 6.6 ruling reserved for "a separately governed Product erasure
policy". Your D-17 answers become the Product side of that policy. And `QAN-BL-CW-01` (Public draft copies survive
owner deletion) is still `OPEN — UNASSIGNED`, so a promise of "everything I wrote is gone" cannot be made for Public
today.

**The smallest honest thing that can be frozen now for D-17** (§4.7.5): the deletion *journey* and the *Personal*
meaning, plus a gating rule — *no Connected World (Shared, Public, Replay, Introductions) may open to users until its
own account-deletion behaviour is implemented*. That lets launch readiness be judged truthfully instead of
pretending.

---

## 2. Repo truth and Anti-Duplication table

### 2.1 Repo Truth Gate

| Check | Result |
|---|---|
| Workspace clean | Yes (`git status --porcelain` empty) |
| `origin/main` after fetch | `3c0ea458a22a17a2a50c616b708f097f5911fb34` — equals the required baseline |
| Checked-out state | detached at `origin/main`; no branch created; no runtime/mobile/API/DB/test/CI file changed |
| Only file written | this package (untracked; not committed; no PR) |

### 2.2 What later slices changed (beyond E2E-01)

| Slice | Delivered | Relevance here |
|---|---|---|
| W1B-01 | Name + Login ID in `public.users` (0123); sign-up; mandatory in-app 6-digit Email code | reusable Email-code mechanism (D-04) |
| W2-01 | Login ID OR Email sign-in (0124, server-only Email lookup); password recovery by Email code; "session ended" handling; generic non-enumerating failures | reusable recovery + wording posture (D-04, D-06) |
| W3-01 | Settings foundation; Dark/Light/System; Sign out (this device only) under Support & About | Settings host (all rows) |
| W3-02 | Account & Identity group; Public ID with one lifetime change (0125) | contrast for Shared ID format (D-08) |
| W3-MEGA-U | Understanding + Contested (0126, 0127) | export form / deletion (D-16, D-17) |
| W3-MEGA-M | conversational Memory forget/disable (0128) — status change, not physical deletion | export / deletion honesty (D-16, D-17) |

### 2.3 Anti-Duplication classification

| Row | Product already frozen | Backend/runtime exists | Production UI exists | Genuinely undecided | Implementation detail only | Stale in E2E-01 |
|---|---|---|---|---|---|---|
| D-04 Change Email | Email private + verified; change does not change Login ID; never a Public/Shared/Introductions identity (P1 §2, lines 44-50, 66-72) | Email code mechanism (Supabase `verifyOtp`, `supabase-auth-port.ts:503,514`). **No change-email path**; test asserts `updateUser` is never called (`account-access-port.test.ts:219`) | None; Settings explicitly draws no Email row (`SettingsSurface.tsx:19-25`) | proof of identity; old-Email role; sessions after change; taken-address posture | provider call, code TTL, templates | "shares E2E-A-10's missing mechanism" — the code mechanism now exists (A-10 decided + built) |
| D-06 Security & Login | placement: password, devices/sessions, sign out other sessions, recovery methods, optional phone (P1 §8.1 l.265-277); password required; phone optional + private; no mandatory 2FA (P1 §2.4 l.84-86); 2FA/passkeys future (P1 §16.1 l.667) | Recovery by Email code; Sign out = this device only (`signOutOwn('local')`, `supabase-auth-port.ts:593-611`). **No** change-password, reauth primitive, session list, revoke-others, phone, MFA, security log | No Security & Login group at all | the v1 control set; whether a reset signs out other devices (left open by W2-01 §11 l.327-328) | provider scopes, timeouts | "no sign-out control" — stale (W3-01) |
| D-08 Shared ID | auto-generated, copyable, regeneratable any time; old ID invalid for new targeting; PENDING invitations of the old epoch invalid; born Worlds unaffected; non-enumerating; never searchable, never shown to anyone; distinct from Login/Public/internal IDs (P1 §5.1 l.148-163); **format explicitly not frozen** (l.162-163) | `shared_world_invite_credential_state` + `rotate_shared_world_invite_credential_v1` (0081 l.123-143, l.249, l.391-392) granted to `authenticated`. Stores only an opaque `credential_lookup_ref`; **the client currently supplies the new ref**; format/alphabet/length deliberately unfrozen (0081 l.52-60) | None (`QANDEEL_CURRENT_STATE.md:159`) | human-facing format; case/separators; copy/share UX; regeneration warning; reauth; **when to surface it** | server- vs client-side generation, hashing at rest | still accurate; note P4 `P4-GAP-047` calls the format "implementation only" while the matrix calls it a PO decision — this package treats it as PO |
| D-11 App language | placement "app language" in QANDEEL & Conversation (P1 §8.1 l.271); one locale authority; language and direction independent; region `EG`; `latn` digits (`QAN-BL-T12-02`, backlog l.554-561) | `product-locale.ts`; language = device locale via `Intl`, `ar*`→Arabic else English (`device-locale.ts:37-46`); direction = `I18nManager.isRTL`; read once per mount; no forceRTL, no stored preference. Replies: "respond in the user's language" (`behavioral-response-policy.service.ts:5`); orchestrator sends `locale:'und'` (`conversation-orchestrator.service.ts:503`) | None | in-app switch or device-only; relation to reply language | per-app locale config, restart mechanics | still accurate |
| D-12 Accessibility | "existing accessibility canon is preserved unchanged" (P1 §8.1 l.273); OS settings unaffected by Appearance (P1 §12.2 l.499-504); F1R2 contract: an accessibility setting changes representation only | Reduced Motion (Reanimated `useReducedMotion`), font scale up to 4× with no caps, Increased Contrast (`theme.ts:49-74`), screen-reader announcements. **Not read:** Reduce Transparency, Bold Text, screen-reader-enabled | Group named "Appearance & Accessibility" holds only Dark/Light/System (`settings/copy.ts:101`) | whether any in-app control exists | the three unread signals are parity engineering, not Product | "honoured by F1R2 / T-10" is only partly true in code (3 signals unread) |
| D-16 Export | placement only, journey deferred (P1 §8.1, §16.1 l.659) | Nothing. "Export" in 0105 is Replay's sanitized distribution descriptor, not user export | None | all of it | format, storage, expiry value | still accurate |
| D-17 Delete account | placement only, journey deferred; P1 "decides no deletion remedy" for `QAN-BL-CW-01` (l.724) | Nothing account-level. ~100 `ON DELETE RESTRICT` FKs; immutability triggers on conversation units (0064:171-185), Memory/Hypothesis historical guard (0072:1286-1288), HIM (0011/0012/0013), Public package (0092:515-545); `auth.users`↔`public.users` have no FK (0002:3-22). A test forbids `deleteAccount` (`tests/w3-01-…contract.test.mjs:270-292`) | None | the meaning everywhere; grace; retention stance | cleanup mechanics | still accurate |

**Also stale (noted, not repaired here — repair belongs to a governance task):** `QANDEEL_CURRENT_STATE.md:276-278`,
`E2E01_READ_FIRST.md:104` and `QANDEEL_PROJECT_MAP.md:212` still describe D-13 as on a Draft PR although `3c0ea45` is
its merge; `QANDEEL_CURRENT_STATE.md:159` still calls W3-MEGA-U unmerged while l.273/292 say merged; `W3-PDG-01`,
`W3-MEGA-A` and `W3-MEGA-S` are named nowhere in the repository yet.

---

## 3. Shared facts every decision depends on

1. **Email is sent by Supabase's built-in sender only.** No mail adapter exists; live delivery is recorded as
   "EXTERNAL / NOT PROVED", and the built-in sender reaches team addresses only, about 2 per hour (W2-01 §7 l.243-259).
   Every Email-based flow below (change Email, security notices, export-ready notice, deletion confirmation) inherits
   this. **Production Email delivery is a shared blocker**, not a Product choice.
2. **There is no "re-enter your password" step anywhere.** Four rows need one (D-04, D-06, D-16, D-17).
3. **There is no "sign out everywhere else".** Sign out affects this device only. D-04, D-06 and D-17 need it.
4. **There is no security event log** (no auth/security table; auth code logs nothing by design).
5. **Deletion today means "status change, content kept"** in Memory (0026:136-159, 0128:214-228), never-deleted in
   Understanding (0127:3-15), and "body removed, tombstone kept" for Shared material (0090:1419-1468). No primitive
   erases an account.
6. **No Connected World (Shared, Public, Replay, Introductions) is reachable from the mobile app today.** Their
   database runtimes exist, and some RPCs are granted to `authenticated`, but no user surface creates that data yet.

---

## 4. Decision sections

### 4.1 `E2E-D-04` — Change Email

#### 4.1.1 Current QANDEEL truth
- **Authority:** Email is required, verified, private security/recovery data and a sign-in identifier; changing it does
  not change the Login ID; it is never a Public, Shared or Introductions identity (P1 §2 l.44-50, §2.2 l.66-72).
- **Implementation:** Email lives only in Supabase `auth.users`; `public.users` has no Email column (0001 l.3-8, 0123
  l.23-26). The Login-ID→Email mapping is server-only (`resolve_login_id_sign_in_email_v1`, 0124 l.19-38). No change
  flow exists.
- **Stale E2E-01 claim:** the "missing mechanism" — the 6-digit in-app code now exists and is reusable.
- **Reusable:** the 6-digit code screen and resend rules (W1B), the non-enumerating wording posture (W2-01 §2), the
  one-identifier sign-in (Email keeps working as sign-in identifier after change).

#### 4.1.2 External evidence
- OWASP Authentication Cheat Sheet: require current credentials before changing Email; **without MFA, require the
  password and send confirmation to both the old and the new address**.
- OWASP ASVS 5.0: 7.5.1 (L2) full re-authentication before changing sensitive attributes; 6.3.7 (L3) notify after
  Email changes; 7.4.3 (L2) offer ending other sessions after an authentication-factor change.
- NIST SP 800-63B-4 §4.6: account recovery SHALL notify the subscriber — relevant because Email *is* QANDEEL's only
  recovery channel.

#### 4.1.3 Real options

| Option | User experience | Security / privacy | Burden | Future / dependencies |
|---|---|---|---|---|
| **A. Password + code to new Email; old Email only notified** | 2 steps; works even if old inbox is lost | Anyone who learns the password can move the recovery Email and lock the owner out; the old-Email notice arrives too late to stop it | Low | Needs production mail |
| **B. Password + code to new Email + confirmation from old Email** | 3 steps; blocked if the old inbox is lost (then Support) | Strongest without 2FA: password alone cannot steal the account | Low-medium; matches Supabase's own "secure email change" pattern (provider config, unverified) | Needs production mail + a Support fallback |
| **C. Not in v1 — change Email through Support only** | Slow, manual | Depends on Support identity checks | Very low code, ongoing ops | Weak; P1 placed Change Email in Settings |

Sub-choices common to A/B:
- **Until the change completes, the old Email stays the active one.** An abandoned or expired attempt changes nothing.
- **Taken address:** either (i) a generic in-app refusal "This Email can't be used. Try another." (small leak, but the
  user is signed in, has re-entered the password, and attempts can be rate-limited), or (ii) always say "If this
  Email can be used, we sent a code" (no leak, but confusing when nothing arrives; the provider may not support it).
- **Sessions after change:** stay signed in here; other devices signed out (ties to D-06).

#### 4.1.4 Recommended option — `RECOMMENDATION — NOT AUTHORITY`
**Option B**, with: old Email stays active until both confirmations; expiry/abandonment changes nothing and the user
simply starts again; taken address → generic refusal (i); after success, this device stays signed in and all other
devices are signed out; the old Email receives a final "your Email was changed" notice. Lost old inbox → Support.
*Why:* with no 2FA, the Email is effectively the master key of the account. Option B stops a stolen password from
becoming a stolen account, at the cost of one extra step.

#### 4.1.5 Product Owner decision needed
- **Q1.** A, B or C?
- **Q2.** Taken new Email: generic refusal (i) or "if usable, we sent a code" (ii)?
- **Q3.** After the change: sign out other devices — yes / no?

---

### 4.2 `E2E-D-06` — Security & Login controls for v1

#### 4.2.1 Current QANDEEL truth
- **Authority:** P1 §8.1 places password, devices/sessions, sign out of other sessions/devices, recovery methods and
  optional phone in Security & Login and leaves the flows to later Account/Auth work; P1 §2.4 — password required,
  phone optional and private, no mandatory 2FA; §16.1 — 2FA/passkeys are future. These match the Product Owner's
  earlier statements (2FA not required at launch, phone optional, Email acceptable).
- **Implementation:** recovery by Email code ends signed out but does **not** sign out other devices (W2-01 §11
  l.327-328 explicitly left this to you). Sign out is this device only and lives under Support & About. No
  change-password, no session list, no revoke-others, no phone, no MFA, no security log. Auth endpoints have no
  QANDEEL rate limiter (provider per-IP limits apply).
- **W3-01 precedent:** Settings draws "no placeholders / coming soon" rows (`SettingsSurface.tsx:8, 19-25`).

#### 4.2.2 External evidence
- OWASP Session Management: let users see active sessions and remotely end them; regenerate sessions after a
  password change. OWASP Forgot Password: offer or force ending all sessions after a reset; notify the user.
- ASVS 5.0: 6.2.3 (L1) change password needs current + new; 7.4.3 (L2) option to end other sessions after a factor
  change; 7.5.2 (L2) view and end sessions after re-authentication.
- NIST 800-63B-4: MFA "SHOULD" be offered at AAL1 but is not mandatory for a consumer app; passwords used as the only
  factor should be at least 15 characters (§3.1.1.2) — noted for engineering/security review, not decided here.

#### 4.2.3 Real options

| Option | What the user sees | Security | Burden | Dependencies |
|---|---|---|---|---|
| **A. Minimal honest set** | Change Password (current + new); "Sign out of other devices" (one action); Email shown masked with "verified", as the recovery method | Covers stolen-password clean-up; meets ASVS L1 + part of L2 | Low — provider supports the needed scopes (verify in implementation) | reauth step; production mail for notices |
| **B. A + device list** | each device with name/last seen, end one at a time | Better visibility | Medium-high: needs QANDEEL's own session/device records and labels | new server records; privacy of device data |
| **C. A + phone** | optional phone for recovery | Adds SMS risk (SIM swap) and cost | High: SMS provider, verification, telecom/legal gates | Roadmap §5 telecom gates |
| **D. Placeholder rows for 2FA/passkeys ("coming soon")** | disabled rows | none | Low | Conflicts with W3-01's no-placeholder rule |

Also decide: **a successful password reset or password change signs out all other devices** (yes/no); **security
activity log** — recommend not in v1; instead Email notices for password changed, Email changed, reset done.

#### 4.2.4 Recommended option — `RECOMMENDATION — NOT AUTHORITY`
**Option A**, plus: reset and password change both sign out other devices; Email notices for the three events; phone
**absent** in v1 (P1 says optional, which permits "not offered yet" — please confirm); 2FA/passkeys **completely
absent** (no disabled rows); Sign out stays where it is. *Why:* it gives users the two things that matter after a scare
— change the password and kick everyone else out — without building device tracking, SMS or fake controls.

#### 4.2.5 Product Owner decision needed
- **Q4.** A, A+B, A+C?
- **Q5.** Password reset / change signs out other devices — yes / no?
- **Q6.** Phone in v1: absent / present?  **Q7.** 2FA & passkeys: absent / shown disabled?

---

### 4.3 `E2E-D-08` — Human-facing Shared ID

#### 4.3.1 Current QANDEEL truth
- **Authority:** P1 §5.1-5.3 (frozen properties in §2.3 above); format unfrozen (P1 l.162-163; 0081 l.52-60).
- **Implementation:** backend only. Rotation increments an epoch and in the same transaction sets every PENDING
  invitation aimed at the old epoch to `INVALIDATED` (0081 l.391-392); acceptance re-checks the epoch (0082 l.256,
  l.315); lookups are non-enumerating (`SHARED_INVITE_TARGET_NOT_USABLE`). Invitations have no expiry. **Today the
  client chooses the new secret** — an engineering point any format decision must fix (server generation recommended).
- **No mobile surface, and no way in the app to invite anyone yet** — the Shared World surface is W6.
- **Contrast:** Public ID is a friendly, readable handle (two words + number, lowercase, e.g. `quietlamp27`, 0125
  l.110-151). The Shared ID is a secret; it must not look like the Public ID.

#### 4.3.2 External evidence
No store or standards rule governs this. General practice for human-copyable secrets: avoid look-alike characters
(0/O, 1/I/L), group characters for reading aloud, accept any case and ignore separators when typed, and show a warning
before destroying a credential others may be using. (Engineering practice, not a cited mandate.)

#### 4.3.3 Real options

| Option | Example | Pros | Risks |
|---|---|---|---|
| **A. Grouped random code** | `K7QM-4XWD-P9TR` (12 characters from an alphabet without look-alikes, ≈60 bits) | Clearly a secret; easy to read aloud; hard to guess | Less memorable (it doesn't need to be) |
| **B. Word-style like Public ID** | `amber-river-42` | Memorable | Guessable; confusable with the Public ID; weakens "credential" |
| **C. Link / QR only** | share link | One-tap sharing | No deep-link infrastructure yet; links travel further than intended |

Surfacing choice: **(i) show it in Account & Identity during W3**, or **(ii) freeze the format now, show it when
Shared invitations become usable (W6)** — a credential with nothing to use it for is confusing and contradicts W3-01's
no-placeholder principle.

#### 4.3.4 Recommended option — `RECOMMENDATION — NOT AUTHORITY`
**Option A**, case-insensitive, separators ignored when typed, generated by the server. Copy button + phone share
sheet (text only). Regenerate: a confirmation sheet — "Your current Shared ID will stop working. Invitations that
haven't been accepted yet will no longer work. Your existing Shared Worlds are not affected." The old ID is never shown
again. **No password re-entry** for regeneration (it only ever makes you *less* reachable). Wording avoids "epoch",
"credential", "invalidate". **Surfacing: (ii)**. *Why:* a secret should look like a secret, and a screen that does
nothing yet would confuse people.

#### 4.3.5 Product Owner decision needed
- **Q8.** Format A, B or C?  **Q9.** Show in W3 (i) or with Shared invitations in W6 (ii)?
- **Q10.** Password before regenerating — no / yes?

---

### 4.4 `E2E-D-11` — App language

#### 4.4.1 Current QANDEEL truth
- **Authority:** one locale authority; language and direction independent; Egypt region; Western digits (`latn`) in
  both languages (`QAN-BL-T12-02`). "App language" placed in QANDEEL & Conversation (P1 §8.1). Chrome register frozen
  per language (I-08A4 §11); QANDEEL Voice inherits the conversational language profile (I-08N-01 l.587).
- **Implementation:** device language only (`device-locale.ts:37-46`; a future preference "replaces this one call");
  no in-app switch, no stored preference, no RTL forcing. QANDEEL replies in the language the user writes/speaks
  (`behavioral-response-policy.service.ts:5`); the client sends no language.

#### 4.4.2 External evidence
- iOS 13+ and Android 13+ both offer a **per-app language** in the phone's Settings; Expo's `expo-localization`
  `supportedLocales` turns this on. iOS relaunches the app on change; Android does not by default.
- Apple (WWDC19 session 403) advises **against** building an in-app switcher and suggests linking to Settings.
- React Native: changing RTL direction takes effect only on next app start; forcing RTL in production is discouraged.

#### 4.4.3 Real options

| Option | Experience | Risk | Burden |
|---|---|---|---|
| **A. Device only, no row** (today) | nothing to find | users who want Arabic app on an English phone can't find how | none |
| **B. "Language" row that opens the phone's per-app language setting** | one tap to the system screen; app reopens in the new language | Android 12 and older have no per-app setting (row explains or hides) | Low; keeps the single locale authority intact |
| **C. True in-app switch** (stored per account) | switch inside QANDEEL | restart for direction change; a second language authority to reconcile with the device; sync across devices | Medium-high |

In every option: **the UI language does not force QANDEEL's reply language.** QANDEEL keeps answering in the language
the person uses in conversation (Arabic-English code-switching stays natural).

#### 4.4.4 Recommended option — `RECOMMENDATION — NOT AUTHORITY`
**Option B** placed in QANDEEL & Conversation, showing the current language; fallback English for unsupported device
languages (as today); replies keep following the conversation. *Why:* users get the choice using the platform's own
reliable mechanism, and QANDEEL avoids a second language authority and a risky restart flow.

#### 4.4.5 Product Owner decision needed
- **Q11.** A, B or C?  **Q12.** Confirm: UI language never changes QANDEEL's reply language — yes / no?

---

### 4.5 `E2E-D-12` — In-app accessibility preferences

#### 4.5.1 Current QANDEEL truth
- **Authority:** existing accessibility canon preserved unchanged; F1R2: an accessibility setting changes
  representation only; OS settings are unaffected by the in-app Appearance choice.
- **Implementation:** honours phone Reduced Motion, text size (up to 4×, no caps — tests forbid caps), Increased
  Contrast, screen-reader announcements. **Not yet read:** Reduce Transparency, Bold Text, screen-reader-enabled (F1R2
  maps them in `F1_PLATFORM_MAPPING.md:15-27`). The group is named "Appearance & Accessibility" but contains only
  Dark/Light/System.

#### 4.5.2 External evidence
Apple HIG and Android 14 guidance: respect the system's text size (Android up to 200%, nonlinear) and Reduce Motion;
WCAG 2.2 1.4.4 (200% text without loss) and 2.3.3 (motion from interaction can be disabled). Platform guidance favours
honouring system settings over duplicating them.

#### 4.5.3 Real options

| Option | Experience | Risk | Burden |
|---|---|---|---|
| **A. No in-app controls; rely on phone settings + close the 3 unread signals** | consistent with every other app on the phone | none known | Low (parity engineering) |
| **B. A + in-app "Reduce motion" override** | for people who want calm QANDEEL but animated phone | two sources of truth; F1R2 semantics to extend | Medium |
| **C. A + in-app text size** | duplicate of system size | breaks T-11 responsive contract assumptions | High |

Naming sub-question: the group label promises accessibility but holds none. Either keep the name and add one short
line ("QANDEEL follows your phone's accessibility settings"), or rename to "Appearance".

#### 4.5.4 Recommended option — `RECOMMENDATION — NOT AUTHORITY`
**Option A**, keep the group name with the one informative line. *Why:* QANDEEL already honours the phone's settings
well; duplicating them adds confusion without a Product reason.

#### 4.5.5 Product Owner decision needed
- **Q13.** A, B or C?  **Q14.** Group name: keep + info line / rename to "Appearance"?

---

### 4.6 `E2E-D-16` — Export my data

#### 4.6.1 Current QANDEEL truth
- **Authority:** placement in Privacy & Data only; journey deferred. Engineering principle "Least Data / Least Access /
  Least Retention" (Foundation Freeze l.29). No retention durations frozen anywhere (I-08N-01 l.981).
- **Implementation:** nothing. Relevant data today: account (Name, Login ID, Public ID; Email in the provider),
  Personal conversation (text only — `source_modality = 'TEXT'`, 0064:147), Memory including forgotten/disabled items
  (kept as status), Understanding + Contested, HIM measurements, Appearance (device-local only). **No audio is stored
  anywhere** (Shared voice notes hold only an opaque reference; no storage provider exists).
- **Shared / Public / Replay / Introductions:** runtime exists, no user surface yet. Several tables hold data *about
  another person* (e.g. Matching `about_user_id` notes, 0110:494-510).

#### 4.6.2 External evidence
- Apple and Google **do not require** data export (they require deletion).
- GDPR Art. 15 (copy of data, one month, free) and Art. 20 (machine-readable for data the user provided); Art. 15(4):
  the copy must not harm other people's rights — relevant to shared spaces.
- Egypt PDPL (Law 151/2020): right of access; Executive Regulations issued by Decree 816/2025; compliance window
  reportedly ends around 2026-11-01 (secondary sources; response deadline not verified from primary text). Saudi PDPL:
  30 days, extendable (secondary source). **This is framing, not legal advice.**
- Industry: WhatsApp prepares a report in ~3 days with a limited download window; Discord emails a link valid 30 days;
  Instagram emails a link (sources in §5).

#### 4.6.3 Real options

| Option | Experience | Privacy | Burden |
|---|---|---|---|
| **A. In-app request → password → prepared in background → "ready" notice → download inside the app, limited time** | clear, self-service | file only reachable while signed in; link expires | Medium |
| **B. Same, but the file is emailed as a link** | familiar | a link in email travels further; depends on mail | Medium |
| **C. v1 via Support request only** | slow, manual | depends on Support identity checks | Low code, ongoing ops; may struggle at scale |

Content rule (all options): **"what QANDEEL holds about me, that I have the right to see"**:
- account info; full Personal conversation (both sides — it is the user's conversation); Memory **including items
  marked forgotten or turned off, labelled as such** (because QANDEEL still holds them — the honest answer); what
  QANDEEL understands about me in plain sentences with the user's own contests; preferences.
- Connected Worlds, when they open: only material **I authored** and my own settings — never other people's material
  or private notes written about someone else.
- Excluded: internal system identifiers, security secrets, raw model reasoning.
- Format: a readable document plus a machine-readable file (e.g. HTML + JSON). The exact expiry length and file layout
  are implementation/privacy-review detail, not invented here.

#### 4.6.4 Recommended option — `RECOMMENDATION — NOT AUTHORITY`
**Option A** with the content rule above. *Why:* it serves people fairly, keeps the file inside the signed-in app, and
fits the privacy direction in Egypt and elsewhere without committing to legal promises. If launch pressure is high,
**C** is an acceptable temporary v1, as long as the Privacy & Data row honestly says "Request a copy of your data" and
leads to Support.

#### 4.6.5 Product Owner decision needed
- **Q15.** A, B or C?  **Q16.** Include forgotten/disabled Memory items (labelled) — yes / no?
- **Q17.** Understanding in export — plain sentences / omit?

---

### 4.7 `E2E-D-17` — Delete my account

#### 4.7.1 Current QANDEEL truth
- **Authority:** placement in Privacy & Data; journey deferred; P1 decides no deletion remedy. Stage 6.6: historical
  rows may be deleted only "unless a separately governed Product erasure policy explicitly owns it"; "Legal/account
  erasure … must never be invented by implementation". `ASSURE-O04`: Connected Worlds participants "can never be
  hard-deleted by any path" — recorded as by-design, with a future erasure capability to be designed against it.
  CW2-02 §27 / CW2-03 §37 / CW2-08 §2: owner deletion must make source content non-serving; a minimal non-content
  trace may remain; prior analytical results may remain historical.
- **Implementation (what blocks a truthful deletion today):**
  1. ~100 `ON DELETE RESTRICT` references to `public.users`; no cascade path.
  2. Conversation text and Memory/Understanding history refuse deletion for every role (0064:171-185; 0072:1286-1288).
  3. HIM history cascades from `auth.users` but refuses deletion — so deleting the sign-in record fails for anyone
     with HIM data, and for others it succeeds but leaves all QANDEEL data orphaned (no FK between the two account
     rows).
  4. The Public ID guard refuses clearing the Public ID (0125:205-241).
  5. Shared: owner deletion exists (body removed, tombstone kept); leaving keeps material visible to baseline viewers.
  6. Public: package, derivative and discussion rows are immutable; disappearance "is not an account-deletion or
     erasure engine" (0099:116); **`QAN-BL-CW-01` open** — deleted text survives in Public draft copies.
  7. Replay: analytical layers built from others' material are never erased; exported copies cannot be recalled.
  8. Introductions: immutable, hold data about the counterpart; the only "erasure" nulls two hashes (0122:624-627).
  9. No web page for deletion exists (Google Play requires one).
  10. Production Email delivery unproven.

#### 4.7.2 External evidence
- **Apple 5.1.1(v):** in-app deletion of the whole account record and associated personal data; deactivation is not
  enough; deletion need not be instant but the user must be told how long; identity/intent confirmation steps
  allowed; legally required data may be kept; users expect deletion to include content shared with others.
- **Google Play:** discoverable in-app path **and** a web page to request deletion (linked in the Data safety form);
  deactivation/"freezing" does not qualify; associated data must be deleted; retention for security, fraud prevention
  or regulatory reasons allowed if disclosed.
- **ASVS 7.4.2 (L1):** end all sessions when an account is deleted.
- Industry: Instagram — 30-day window then permanent; Discord — ~14-day restore, then "Deleted User" with messages kept
  in servers (a frequent complaint, and in tension with Apple's expectation).

#### 4.7.3 Real options

**Journey**

| Option | Experience | Notes |
|---|---|---|
| **J1. Immediate, irreversible** | done at once | no regret window; any cleanup failure is visible to the user |
| **J2. Short cancel window, then permanent** | signed out everywhere and hidden at once; signing back in during the window cancels | Allowed by Apple ("inform how long"); protects against mistakes and hijack; window length is your choice |
| ~~J3. Deactivation only~~ | — | **Not allowed** by Apple or Google |

**Meaning in each world**

| Area | Option I — erase | Option II — anonymise / keep | Existing primitive |
|---|---|---|---|
| Account (Name, Login ID, Email, Public ID, password) | erase; sessions end | — | none (needs governed exception) |
| Personal conversation, Memory, Understanding, HIM | erase | — | none; guards forbid it (needs governed exception) |
| My Shared material | owner-delete all (body gone, "deleted" trace stays) | keep, shown as "former member" | I-04G owner deletion exists |
| My Shared memberships | end (like leaving) | — | I-04C leave exists |
| My Public material | remove from Public World | — | I-05C disappearance exists; **CW-01 open** |
| Replay | my own Replays unavailable; others' analytical results keep only non-content history | — | I-06D source availability exists |
| Matching / Introductions | ended; counterpart sees "no longer available" | — | turn-off/terminal exist; counterpart data rules undefined |
| Login ID / Public ID after deletion | released for reuse | **never reusable** (prevents impersonation; needs a minimal non-reversible reservation) | — |
| Minimal record that the account existed and was deleted | kept for security/legal, no content | — | — |

**Partial failure:** the user is never told "deleted" until it is actually complete; the status says "scheduled — will
complete by [date]"; the system retries internally.

#### 4.7.4 Recommended option — `RECOMMENDATION — NOT AUTHORITY`
- **Where:** Privacy & Data, plus the required web page.
- **Journey J2:** password re-entry → one plain screen listing what will happen → type-or-tap confirmation → signed out
  on every device → cancel window (length: your choice) → permanent erasure.
- **Meaning:** Option I everywhere (erase Personal; owner-delete my Shared material with a non-content trace; remove my
  Public material; end Matching/Introductions); Login ID and Public ID **not reusable**; a minimal non-content record
  kept. *Why:* it matches what Apple says users expect ("my content is gone"), reuses QANDEEL's existing owner-deletion
  law, and avoids the "Deleted User but my words stay" complaint.

#### 4.7.5 The honest blocker and the smallest freezable decision
End-to-end deletion **cannot be truthfully claimed** today because of items 1-10 above; above all `QAN-BL-CW-01` and
the missing Connected-World account-deletion contract (`ASSURE-O04`). The smallest honest decision you can freeze now:

1. The journey (J1 or J2) and the Personal + account meaning.
2. The cross-world *intent* (Option I or II) as direction, not as a claim that it works.
3. **A gating rule:** no Connected World opens to users until its account-deletion behaviour is implemented and
   verified; and QANDEEL does not launch in the stores until account deletion works for every world that is open at
   launch.
4. Explicit acknowledgement that implementing (1) requires a controlled change to the history-preservation guards —
   the "separately governed Product erasure policy" that Stage 6.6 anticipated — and that `QAN-BL-CW-01` needs an owner
   before Public opens.

#### 4.7.6 Product Owner decision needed
- **Q18.** J1 or J2? If J2, window length (e.g. 7 / 14 / 30 days)?
- **Q19.** Shared material on deletion: erase (I) / keep as "former member" (II) / let the user choose?
- **Q20.** Login ID & Public ID after deletion: reusable / never reusable?
- **Q21.** Accept the gating rule in §4.7.5(3) — yes / no?
- **Q22.** Authorise the erasure exception to history preservation as a direction (implemented only through controlled
  change) — yes / no?

---

## 5. External evidence summary (sources)

| Topic | Source (primary unless marked) |
|---|---|
| Apple 5.1.1(v) | https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/support/offering-account-deletion-in-your-app/ |
| Google Play deletion | https://support.google.com/googleplay/android-developer/answer/10144311 ; https://support.google.com/googleplay/android-developer/answer/13327111 |
| OWASP | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html ; …/Forgot_Password_Cheat_Sheet.html ; …/Session_Management_Cheat_Sheet.html ; ASVS 5.0 https://github.com/OWASP/ASVS/tree/master/5.0/en |
| NIST | SP 800-63B-4 (final 2025-08-26) https://pages.nist.gov/800-63-4/sp800-63b.html |
| Per-app language | https://developer.android.com/guide/topics/resources/app-languages ; https://docs.expo.dev/guides/localization/ ; Apple WWDC19 session 403 https://developer.apple.com/videos/play/wwdc2019/403/ ; React Native I18nManager docs |
| Accessibility | https://developer.apple.com/design/human-interface-guidelines/typography ; …/accessibility ; https://developer.android.com/about/versions/14/features ; https://www.w3.org/TR/WCAG22/ |
| GDPR | Art. 12, 15, 20 (read via gdpr-info.eu mirror — not EUR-Lex) |
| Egypt PDPL | Law 151/2020; Decree 816/2025 — **secondary** (Baker McKenzie 2026-01-09; Legal500 2026-01-12). Official text and response deadline **not verified** |
| Saudi PDPL | **secondary** (Clyde & Co, 2023-09) |
| Industry | Instagram help 139886812848894 / 181231772500920 (snippets); WhatsApp FAQ 526463418847093 / 565386554257543; Discord support (403 — snippets only, **unverified**) |

External guidance is evidence only; none of it has been converted into a QANDEEL decision.

---

## 6. Cross-dependency map and blockers

```
Production Email delivery ──► D-04 (codes), D-06 (notices), D-16 (ready notice), D-17 (confirmation)
Re-enter-password step ─────► D-04, D-06, D-16, D-17
Sign out other devices ─────► D-04 (after change), D-06, D-17 (all devices)
History-preservation erasure exception (controlled change) ──► D-17 Personal
QAN-BL-CW-01 (unowned) ─────► D-17 Public; any Public opening
ASSURE-O04 Connected-World erasure design ──► D-17 Shared / Replay / Introductions
Shared invitation surface (W6) ──► D-08 surfacing
Web deletion page (company-side) ──► D-17 Google Play compliance
```

**Blockers (real, not Product choices):**
- **B-1 Production Email delivery** is unproven (built-in sender, team-only, ~2/hour).
- **B-2 Personal erasure** needs a controlled change to immutable-history guards (0064, 0072, HIM, Public ID guard) and
  a fix for the `auth.users` ↔ `public.users` split.
- **B-3 `QAN-BL-CW-01`** is `OPEN — UNASSIGNED`; its own open Product ruling (destroy retained bytes, needing a
  reviewed exception to the 0092 guard) is **not** answered by this package.
- **B-4 No Connected-World account-deletion contract** exists (`ASSURE-O04`).
- **B-5 No web deletion page** exists (Google Play).

---

## 7. Recommended decision set — `RECOMMENDATION — NOT AUTHORITY`

| Row | Recommendation |
|---|---|
| D-04 | B: password + new-Email code + old-Email confirmation; generic refusal for taken address; other devices signed out |
| D-06 | A: Change Password, Sign out of other devices, Email/recovery status; reset/change sign out others; Email notices; no phone; no 2FA rows |
| D-08 | A: 12-character grouped code, case-insensitive, server-generated; confirm before regenerate; no password; surface with W6 invitations |
| D-11 | B: Language row → phone's per-app setting; replies follow conversation |
| D-12 | A: no in-app controls; close 3 unread signals; keep name + info line |
| D-16 | A: in-app async, password, in-app download for a limited time; content rule §4.6.3; forgotten Memory included and labelled |
| D-17 | J2 + Option I + IDs not reusable + gating rule + erasure exception as direction; end-to-end not claimed until B-1…B-5 clear |

---

## 8. Product Owner Response Sheet

Reply per line with the letter/answer (e.g. `Q1: B`). "R" = accept the recommendation.

| # | Question | Choices | Recommended |
|---|---|---|---|
| Q1 | Change Email method | A / B / C | B |
| Q2 | New Email already taken | (i) generic refusal / (ii) "if usable, we sent a code" | (i) |
| Q3 | Sign out other devices after Email change | yes / no | yes |
| Q4 | Security & Login set | A / A+B / A+C | A |
| Q5 | Password reset or change signs out other devices | yes / no | yes |
| Q6 | Phone in v1 | absent / present | absent |
| Q7 | 2FA & passkeys in v1 | absent / shown disabled | absent |
| Q8 | Shared ID format | A / B / C | A |
| Q9 | When Shared ID appears | (i) W3 / (ii) with W6 invitations | (ii) |
| Q10 | Password before regenerating Shared ID | no / yes | no |
| Q11 | App language | A / B / C | B |
| Q12 | UI language never changes reply language | yes / no | yes |
| Q13 | In-app accessibility controls | A / B / C | A |
| Q14 | "Appearance & Accessibility" name | keep + info line / rename | keep + info line |
| Q15 | Export delivery | A / B / C | A |
| Q16 | Include forgotten / turned-off Memory (labelled) | yes / no | yes |
| Q17 | Understanding in export | plain sentences / omit | plain sentences |
| Q18 | Deletion journey | J1 / J2 (+ days) | J2 (days: your choice) |
| Q19 | My Shared material on deletion | I erase / II keep as former member / user chooses | I |
| Q20 | Login ID & Public ID after deletion | reusable / never reusable | never reusable |
| Q21 | Gating rule §4.7.5(3) | yes / no | yes |
| Q22 | Erasure exception as direction (via controlled change) | yes / no | yes |
| Q23 | Commit this package to the repo as a documentation PR | yes / no | your call |

---

## 9. Proposed decomposition after approval (outline only — not task contracts)

- **W3-MEGA-A — Account & Identity Completion:** re-enter-password step; Change Email (D-04); Security & Login group
  with Change Password + sign out other devices + recovery status (D-06); reset signs out others; security Email
  notices; Shared ID format fixed in authority (D-08) — surface only if Q9 = (i). Precondition: B-1.
- **W3-MEGA-S — Personal Controls & Settings Integration:** Language row (D-11); accessibility resolution + 3 parity
  signals (D-12); Privacy & Data group; Export (D-16); account deletion journey + Personal/account erasure (D-17).
  Preconditions: B-1, B-2 (controlled change), B-5.
- **Outside W3 (to be owned separately, not opened here):** Connected-World account-deletion contract (B-4) and an
  owner for `QAN-BL-CW-01` (B-3) before any Public/Shared/Replay/Introductions surface opens.

---

## 10. Skills Used

- **G1 Skills Gate:** the installed skill list was inspected. It is dominated by UI/animation/React Native build
  skills, Arabic copy/RTL skills, and document-format skills. None governs a Product decision package: no UI is built,
  no Arabic user-facing copy is proposed for freezing, and the output is repository Markdown by convention.
- **Skills Used: none.** The work used repository reading (read-only sub-agents with file:line evidence) and web
  research against primary sources (§5).

---

W3-PDG-01 DECISION PACKAGE READY — AWAITING PRODUCT OWNER DECISIONS
