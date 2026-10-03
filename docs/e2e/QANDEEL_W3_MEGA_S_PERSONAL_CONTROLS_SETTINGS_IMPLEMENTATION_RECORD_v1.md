# QANDEEL — W3-MEGA-S Personal Controls & Settings Integration v1 — Implementation Record v1

**Task:** W3-MEGA-S — Personal Controls & Settings Integration v1 (E2E-01 wave W3)
**Rows:** `E2E-D-11` (App Language), `E2E-D-12` (Accessibility parity), `E2E-D-16` (Export My Data), `E2E-D-17` (Delete
Account — **Personal world only**), `E2E-D-02` (advanced only)
**Baseline:** `1e7b681052c7af09576197bcfb204e1b39775554` (merge of PR #295, W3-MEGA-A)
**Branch:** `feat/w3-mega-s-personal-controls-settings`
**Status:** **MERGED / CLOSED** — merged through PR #296 at `e87aac6b4e9ec6c1b6542d2ba3c82cc6cc9af6e8` (2026-10-01;
PR head `b8580921fcd373d0bcd73ad3e220bc2533e70dad`). The slice is closed as merged work; it closed no phase and did not
close W3, whose named residual rows stay as §14 records them. Its §9 copy is still recorded here as PROPOSED — NOT
APPROVED: no repository record shows the Product Owner's approval of it, and this reconciliation does not decide it.
Lifecycle reconciled by ROADMAP-REC-01 (2026-10-04); nothing below it was rewritten.
**Status at handoff (historical):** IMPLEMENTED ON A DRAFT PR — NOT MERGED. `W3-MEGA-S READY FOR INDEPENDENT REVIEW — DO NOT MERGE`. One bounded,
Product-Owner-authorized Production Integration slice; it opens no later stage, closes no phase and does not close W3.
**Product authority:** only the statements marked **PO** in the
[W3-PDG-01 closure](../canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md)
§5 – §8, P1 §8.1 (placement) and P4-C4 §4 (group names). No `IMPLEMENTATION CONSIDERATION — NOT FROZEN` item and no
package recommendation was turned into Product law; where this slice had to choose one, it is labelled here as an
implementation detail.

The truth this slice establishes, and nothing wider:

> **`D-17 PERSONAL-WORLD IMPLEMENTATION — READY`**
> **`D-17 FULL ACCOUNT DELETION — BLOCKED BY CONNECTED WORLDS`**

---

## 1. Execution map

> **Historical — the map at kickoff.** The current map is
> [`QANDEEL_PROJECT_MAP.md`](../../QANDEEL_PROJECT_MAP.md) §5.1.

| Stage | State |
|---|---|
| W1A, W1B, W2, W3-01, W3-02, W3-MEGA-U, W3-MEGA-M, W3-PDG-01, W3-MEGA-A | DONE (merged) |
| **W3-MEGA-S — Personal Controls & Settings Integration v1** | **ACTIVE — this record** |
| Stage 2 — Final Visual Production Port | NEXT (not opened) |
| Activity + Notifications, Shared, Public, Matching / Introductions, Replay, Voice, Economy + Launch | LATER (not opened) |

## 2. Repo truth

- `origin/main` was exactly `1e7b681052c7af09576197bcfb204e1b39775554` at kickoff; the tree was clean; the branch was cut
  from it.
- Read before coding: `AGENTS.md`, `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md`, the
  canonical backlog **in full**, `docs/e2e/E2E01_READ_FIRST.md`, the gap-matrix rows D-01 … D-18, P1 §8.1, the W3-PDG-01
  closure and its decision package (§4.4 – §4.7 as evidence only), the W3-MEGA-A record (and, through their records'
  carried facts, W3-01, W3-02, W3-MEGA-M, W3-MEGA-U), the Stage 6.6 ruling on historical deletion, the F1R2 platform
  mapping, migrations 0001 – 0129 (a full per-user census, §5.1), the account / auth / relay / settings / locale code.
- Provider facts were verified in the official Supabase Auth source, not assumed (§8.4).

## 3. Skills / G1

Inspected: the session roster (`react-native-best-practices` and its sub-skills, `sibawayh:writing-eloquent-arabic`,
`sibawayh:designing-arabic-frontends`, `impeccable`, `ui-ux-pro-max`, `emil-design-eng`, the animation skills,
`security-review`, `code-review`, `run`, and the non-mobile skills).

Used:
- `react-native-best-practices` — Expo / React Native project. No sub-skill applied (no animation, gesture, SVG, worklet,
  JSI or audio work). It shaped two choices: the Reduce Motion reader subscribes to the platform event rather than
  trusting a launch value (§6.1), and the export download uses the already-linked Expo module instead of a new native
  package (§7.4).
- `sibawayh:writing-eloquent-arabic` — every new Arabic candidate is MSA (account / destructive / legal-adjacent
  register), verb-first («سيُحذف حسابك…», «يتعذّر إتمام الحذف…»), process-framed failures («تعذّر تجهيز النسخة»), no
  calqued «لك», sibling-consistent with the approved «تم تغيير كلمة المرور.» («تم إلغاء الحذف.», «تم حفظ الملف.»).
  Drafting is not approval (§9).
- `sibawayh:designing-arabic-frontends` — §3: dates go through the ONE locale authority's numeral policy (Egypt, Western
  `latn`, QAN-BL-T12-02) with the Gregorian calendar pinned (`…-u-nu-latn-ca-gregory`), never hand-built; §4: the English
  language name inside an Arabic line is an isolated LRI … PDI run, and every password field is its own LTR context
  (reused W3-MEGA-A `ChangeForm`).

Could not run: `security-review` and `code-review` (their inline shell steps use the Bash tool, which this host's
application-control policy blocks). Their purpose is served by independent review agents on the finished diff (§12).

Not used: `impeccable` / `ui-ux-pro-max` / `emil-design-eng` (no new visual language: the W3-01 / W3-MEGA-A composition is
reused as is), the animation skills (no new motion), `run` (no device run; §11).

## 4. Anti-Duplication Gate

| Capability | Frozen Product authority | Existing backend / runtime | Existing mobile | Genuinely missing (built here) | Not rebuilt |
|---|---|---|---|---|---|
| App language (D-11) | W3-PDG-01 §5 | — | one locale authority `device-locale.ts` / `product-locale.ts` (read at mount) | a Language row → the SYSTEM setting; iOS `CFBundleLocalizations` | any language engine, toggle, stored preference or second locale authority |
| Accessibility (D-12) | W3-PDG-01 §6 | — | contrast honoured live; Reduce Motion read at launch only; font scale honoured; announcements | Reduce Motion followed mid-session on the W1A / W3 surfaces; audit | any in-app accessibility switch or preferences engine |
| Settings hierarchy (D-02) | P1 §8.1; P4-C4 §4 | — | ONE destination, four groups | two real groups: QANDEEL & Conversation, Privacy & Data | a second Settings root, a Privacy destination, placeholder groups |
| Re-authentication | W3-PDG-01 §7.2 step 2, §8.2 | W2-01 relay; 0129 `has_recent_password_proof_v1` | W3-MEGA-A `ChangeForm` password field | its reuse by two new requests | a second verification mechanism |
| Export (D-16) | W3-PDG-01 §7 | owner-scoped reads exist per domain; **no** async job framework (only the in-process interval supervisor of the runtime-event publisher) | — | server-owned request, preparation pass, owner-only expiring download | a job framework, a generic dump API, a mobile-built package |
| Personal deletion (D-17) | W3-PDG-01 §8 | per-domain lifecycle "deletion" is a status (Memory `DELETED`), never physical; **16 guards refuse DELETE for every role** | W3-01 sign-out; W2-01 session-ended treatment | state machine, governed erasure, provider removal | a generic delete primitive; any Connected Worlds deletion |
| Identifier non-reuse (D-17 §8.3) | W3-PDG-01 §8.3 | 0123 / 0125 / 0129 uniqueness answers `UNAVAILABLE` | W1B / W3-02 / W3-MEGA-A wording | retired digests answered through those same answers | new identifier wording or oracle |

Preserved explicitly: the ONE General Settings destination and every W3-01 / W3-02 / W3-MEGA-A group, row and word;
appearance behaviour; the product locale and RTL/LTR authority (ProductRoot's one read is byte-unchanged); Memory
through conversation (no Memory editor); the Understanding entry outside Settings; the auth / session / provider
machinery; the Personal conversation history model; every Connected Worlds runtime; no Profile page.

## 5. Database — migration `0130_personal_privacy_export_account_deletion_v1.sql`

### 5.1 The census it rests on

Every table of migrations 0001 – 0129 carrying an account column was listed with its foreign keys and guards. The
Personal world is 76 tables (account, conversation, the T-03 unit / focus / Thread / Live Focus substrate, historical
projection, Memory, Hypothesis / Confidence / Question / Information Gap, Understanding contests and focus, HIM,
post-response bookkeeping, Memory-control records). Sixteen guard functions refuse DELETE for every role with no bypass;
most foreign keys to `public.users` are `ON DELETE RESTRICT`; six HIM tables cascade from `auth.users` into immutable
guards (so the provider account could never be removed while they exist); and about seventy Connected Worlds tables
reference `public.users` `ON DELETE RESTRICT` (`ASSURE-O04`).

### 5.2 What it adds

A new non-exposed schema `personal_data_private` (four tables, RLS on, no client or server-role table privilege); every
function in `public` is SECURITY INVOKER; no account parameter anywhere — the owner is `auth.uid()`.

- **Owner acts** (`authenticated` only): `read_own_privacy_state_v1()`; `request_own_data_export_v1(command)` and
  `request_own_account_deletion_v1(command)` — both refuse to read or write anything without 0129's recent provider
  password proof (reused, not rebuilt); `read_own_data_export_v1()`; `cancel_own_account_deletion_v1()`.
- **Server passes** (`service_role` only): `server_prepare_data_exports_v1`, `server_claim_due_account_deletions_v1`,
  `server_erase_personal_account_v1`, `server_complete_account_deletion_v1`.

### 5.3 The controlled erasure boundary (the Stage 6.6 "separately governed Product erasure policy")

Stage 6.6 denies physical DELETE of historical canonical rows "unless a separately governed Product erasure policy
explicitly owns it"; W3-PDG-01 §8.3 / §8.6 is that policy for the Personal world. The sixteen guards (0011, 0012 / 0013,
0055, 0063, 0064, 0065, 0066, 0068, 0070, 0071, 0072) are redefined **in place** — same name and OID, directly executable by no
role (a trigger function is never EXECUTE-checked when it fires; the four that had kept PUBLIC's default are revoked here), still
SECURITY INVOKER with an empty search_path, the original body kept byte-for-byte after ONE prefix that admits a
**DELETE, never an UPDATE**, only when BOTH hold: the transaction-local `qandeel.personal_erasure` equals the current
transaction id, **and** an authorization row for that transaction exists in `personal_data_private.erasure_authorizations`
(a table no client or server role can touch). Both are created only inside `erase_personal_account_v1`, which runs only
for a request that is SCHEDULED, was re-authenticated, is past its grace period and is not cancelled. It is not a generic
history-delete: it takes a deletion-request id, never an account id; it is executable only by the server role; it deletes
only that request's account's rows, in foreign-key order, with the account row LAST; and normal immutability is
unchanged for every other statement (proved: the owner with the setting forged, with the row planted, and any UPDATE are
all still refused).

**Residual sweep.** The six HIM tables reference the PROVIDER account (0011 – 0013), not `public.users`, so a session still
valid at the provider can write a measurement after the erasure; its immutability guard would then refuse the provider's
cascading delete for ever. `erase_personal_account_v1` on an ERASED request therefore sweeps those rows again, under a
fresh authorization of the same request, and answers `ALREADY_ERASED`; the server passes through it right before every
provider-removal attempt. Proved in the verifier (a target written after ERASED, then swept).

### 5.4 The state machines

Deletion: `SCHEDULED` (grace; cancellable) → `ERASED` (Personal world erased in one transaction; provider removal
pending) → `COMPLETED` (provider account removed); `SCHEDULED` → `CANCELLED`; `SCHEDULED` → `BLOCKED` (a Connected Worlds
row still references the account: nothing erased; the owner may cancel). The owner reads `NONE | SCHEDULED | FINALIZING |
BLOCKED`; `FINALIZING` is shown from the end of the grace period — never "deleted" before the final deletion. Export:
`PREPARING` → `READY` (artifact held, available for a limited time) → `EXPIRED` (artifact discarded); three failed
preparations → `FAILED`. One live request of each kind per account; a replayed command answers its own request; a
cancelled command never re-schedules; leases make every server step single-owner and resumable; lock order (account row,
then request) serializes cancellation against erasure.

`IMPLEMENTATION DETAIL — NOT PRODUCT-FROZEN`: a **7-day** grace period; **7-day** export availability; 5-minute leases;
one JSON document (`qandeel.personal-data-export.v1`).

### 5.5 Identifier non-reuse

At erasure the Login ID and Public ID are retired as one-way digests (`lid1:` / `pid1:` + SHA-256; no account link). A
trigger on `public.users` refuses a retired value through the EXISTING unique-violation answers (the constraint names
0125 / 0129 already map to `UNAVAILABLE`); `login_id_is_available_v1` and 0125's generator (redefined in place,
otherwise unchanged) never offer one; an erased account row can never be re-created. "Not reused directly" is met by a
reservation with no expiry — the length of any reservation is not frozen (W3-PDG-01 §10) and is an implementation detail.

### 5.6 Verifier

`database/verify-migration-0130.mjs` (`npm run verify:personal-privacy-export-account-deletion:integration`, API CI)
proves the catalog and exact grants; the narrowed guards' refusals; the export journey (re-authentication, owner-only,
one in flight, replay, server-only preparation, content, no ids / another reader's material / reasoning, expiry discarding
the artifact); the deletion journey with the erasure of a **real populated** Personal footprint — committed units through
the real pipeline, a Memory-control command, Memory in three states, a contested Hypothesis through the real disagreement
command, a HIM target and a HIM measurement calculated to its snapshot — to **zero rows in every table carrying the account**, while another reader's footprint is
untouched; idempotent retry and completion; retired identifiers through the existing Login ID / Public ID answers; no
resurrection; the BLOCKED hard stop; and committed two-connection races (a cancellation after the committed erasure is
refused; two erasures erase once).

## 6. Accessibility parity (`E2E-D-12`) — audit and fixes

| Platform signal | Before | After this slice |
|---|---|---|
| Reduce Motion | read by Reanimated's `useReducedMotion`, which reports the value **at app start** only (F1R2 mapping §3 item 4) | **fixed** on the W1A / W3 surfaces (the depth cross-fade and the Conversation scroll): `useReduceMotion()` starts from the launch value and follows `reduceMotionChanged`. New journeys have no motion. The T-10 camera / temporal motion hooks (CLOSED / FROZEN T-10 / T-12 code) still read the launch value — **residual** (§13) |
| Dynamic / scalable text | honoured (no caps anywhere in Settings; `minHeight`, never `height`, on rows) | every new row and form keeps it: no `numberOfLines`, `allowFontScaling={false}` or `maxFontSizeMultiplier`; 44-pt minimum targets (test-pinned) |
| Screen reader | names, roles, headings, polite live regions, focus on titles and back to the opening row | every new state is announced once (preparing, ready until …, saved, will be deleted on …, cancelled, cannot be cancelled); the destructive form reads title → consequence → password → act; status rows are single accessible elements. The screen-reader-ENABLED flag is not needed: nothing is hidden behind a gesture or a timeout |
| Bold Text (iOS only) | not honoured: the text is set in two static Estedad faces (400, 500); the canonical expression steps every weight +100 (F2 validation) | **not honoured — asset gap**: it needs the Estedad v8.5 600 static face, and W1A-01's Product Owner font authorization covers only the 400 / 500 faces. Not faked (a synthetic bold would misrepresent the canon) — **open** (§13) |
| Reduce Transparency (iOS only) | — | **not materially applicable**: no production surface paints a translucent material (the only alpha is the transient pressed presence); the Living Brass / Light translucency lives in the unported I-08B world (Stage 2) |
| Increased contrast | honoured live (`useIncreasedContrast`) | unchanged; the new rows use the same palette |

## 7. Product journeys as implemented

### 7.1 App language (`E2E-D-11`)
«قنديل والمحادثة» / QANDEEL & Conversation (P4-C4 `gQandeel`, P1 §8.1 placement) holds ONE row: «اللغة» / Language, with
the current language by its own name. It opens the SYSTEM setting and stores nothing: on **iOS** the app's own Settings
page, which offers a per-app language because `app.json` now declares `CFBundleLocalizations: ["ar", "en"]` (iOS relaunches
the app on a change); on **Android** the device language setting. Android 13+ offers a per-app language only when the app
declares a locale-configuration resource; on this project that is a generated native resource — a **Level-4 CNG change**
under the T-01 hierarchy that needs Engineering Architecture review — so it is NOT added here (§13). The reply language is
untouched (the client still sends no language); RTL / LTR still come from the one locale authority, read at mount exactly
as before (ProductRoot's read is byte-unchanged and still pinned by T-14).

### 7.2 Privacy & Data (placement)
«الخصوصية والبيانات» / Privacy & Data (P4-C4 `gPrivacy`), drawn only once the server's state is read (never a
placeholder), after Appearance & Accessibility and before Support & About (P1 §8.1 order). Each request is a STATE of the
ONE destination (the W3-MEGA-A `ChangeForm`): no route, dialog or second Settings root.

### 7.3 Export My Data (`E2E-D-16`) — exact scope
Journey: Export my data → the export promise (PRODUCT COPY DECISION REQUIRED) → the password → the server holds ONE request
(replay-safe) → «جارٍ تجهيز…» / "Preparing…" (re-read every 15 s while shown and on every return to Settings) → "Ready to
download until {date}" + Download → the system folder picker → one JSON file written where the reader chose → expired →
not downloadable, a new copy can be requested. The package is built by the server, never by the app; it is not emailed.

| Category | In the package |
|---|---|
| Account | Name, Login ID, Public ID, account creation time; Email and its verification (added by the API at download from the owner's own provider session) |
| Personal conversation | every session, both sides: the owner's turns and QANDEEL's completed replies with times; no failed or system text |
| Memory | every lifecycle state still held, labelled `active` / `not relied on` / `forgotten` / `replaced by a correction`, with times and expiry |
| QANDEEL Understanding | each statement the owner could have been shown — current now, or current before it was reconsidered or withdrawn — labelled `current` / `being reconsidered` / `withdrawn`, when it formed and last changed, and the owner's own disagreements. A never-admitted CANDIDATE is QANDEEL's unshown reasoning and is not exported (hypothesis restraint) |
| Shared / Public / Replay / Introductions | **`NOT YET INCLUDED — WORLD-SCOPED EXPORT AUTHORITY NOT IMPLEMENTED`** (the package names them in `notYetIncluded`) |

Never included: internal ids, idempotency keys, routing, scores (confidence, importance), evidence references, hypothesis
assumptions or disconfirming conditions (system reasoning), Information-Gap / Question planning, HIM measurements, secrets
or tokens, and any other person's material. HIM measurements and QANDEEL's own question planning have no form the owner can
read yet: excluded, and listed here so the exclusion is a recorded choice (§13).

### 7.4 Delete Account — exact Personal-world scope (`E2E-D-17`)
Journey: Delete account → the consequence (PRODUCT COPY DECISION REQUIRED) → the password → SCHEDULED: "Your account will
be deleted on {date}" + Cancel deletion; the reader stays signed in during the grace period → after it: "being deleted
now", no cancellation → the server's pass: the governed Personal erasure (§5.3) → the provider account removed (every
session and refresh token gone; a live access token is refused by the API's guard, which asks the provider on every
request) → COMPLETED. Erased: the account row and name, Login ID, Public ID (retired, not reused), every Personal
conversation and every derivative of it, Memory (every state), Understanding (hypotheses, updates, lifecycle, contests,
discussion focus), Confidence / Question / Information-Gap history, HIM measurements, Memory-control records, post-response
bookkeeping, the operational outbox rows naming the account, and pending export artifacts. Kept, by design and justified:
the deletion request itself (ids and timestamps only — retry safety, lost-response reconciliation, resurrection refusal)
and the retired identifiers' digests (no reuse, no link to anyone).

### 7.5 Copy
Reused by reference: P4-C4 `gQandeel` / `gPrivacy` (verbatim), W1B-01's password label, W3-MEGA-A's approved C4
«كلمة المرور غير صحيحة.», T-14's network sentence, and each language's own name. Every other pair is in ONE block,
`PROPOSED_W3_MEGA_S` in `apps/mobile/src/settings/copy.ts`, and is listed in §9.

## 8. Server side

### 8.1 API — `apps/api/src/account/` (inside the existing `AccountModule`; `app.module.ts` is untouched)
`privacy-data.controller.ts` — five guarded routes under `/account/privacy` (`GET` state, `POST export`, `GET
export/download`, `POST deletion`, `POST deletion/cancel`); exact bodies (`{ commandId, password }` or `{}`); 400 / 503
otherwise. `privacy-data.service.ts` — re-authentication reused exactly as W3-MEGA-A does it (the owner's own Email, the
provider's password grant, the request on the PROOF token, the proof session always ended); the download adds the owner's
Email from the owner's own provider session. Nothing is logged.

### 8.2 The asynchronous pass
`privacy-maintenance.worker.ts` — one single-flight cycle on a timer (the runtime-event publisher's shape, not a job
framework; off under tests; switchable off): prepare exports and discard expired ones; claim due deletions; erase, then
remove the provider account, then complete. Every step is judged again by the database, so a crash anywhere resumes and a
deletion is never reported complete before the provider removal is confirmed.

### 8.3 Provider removal
`provider-account-removal.service.ts` — `DELETE /auth/v1/admin/users/{id}` (`should_soft_delete: false`) with the server
credential, only for an account the database has already ERASED (the id comes from the database's own claim). Only the
provider's own `user_not_found` counts as "already gone"; a bare 404 does not. It lives apart from the owner relay, which
still never reaches an admin endpoint.

### 8.4 Provider facts, verified in the official Supabase Auth source
`adminUserDelete` hard-deletes with `tx.Destroy(user)` unless `should_soft_delete`; a ban (`banned_until`) blocks only new
credentials and is not used. The sequence is therefore: erase in the database first (the HIM rows would otherwise block
the provider's delete), then remove the provider account.

## 9. Copy — `PRODUCT COPY DECISION REQUIRED`

All pairs below are PROPOSED — NOT APPROVED and are merge blockers under the Copy Gate. Rows marked **★** define a deletion
consequence, the grace behaviour, the export promise or expiry, or irreversibility, and are
**`PRODUCT COPY DECISION REQUIRED`**; the others are minimal implementation-owned labels proposed for confirmation.

| Key | Arabic | English |
|---|---|---|
| languageTerm | اللغة | Language |
| exportAction | تصدير بياناتي | Export my data |
| exportExplain ★ | سنجهّز نسخة من بياناتك، ويمكنك تنزيلها من هنا حين تجهز لمدة محدودة. | We'll prepare a copy of your data. When it's ready, you can download it here for a limited time. |
| exportConfirm | طلب نسخة | Request a copy |
| exportPreparing | جارٍ تجهيز نسخة من بياناتك | Preparing a copy of your data |
| exportReady ★ | النسخة جاهزة للتنزيل حتى {date} | Ready to download until {date} |
| exportDownload | تنزيل | Download |
| exportSaved | تم حفظ الملف. | File saved. |
| exportSaveFailed | تعذّر حفظ الملف. | The file couldn't be saved. |
| exportExpired ★ | انتهت مدة التنزيل. يمكنك طلب نسخة جديدة. | The download period has ended. You can request a new copy. |
| exportFailed | تعذّر تجهيز النسخة. يمكنك طلبها مرة أخرى. | The copy couldn't be prepared. You can request it again. |
| deleteAction / deleteConfirm | حذف الحساب | Delete account |
| deleteExplain ★ | سيُحذف حسابك وبياناتك الشخصية نهائيًا، ومنها محادثاتك وما يحتفظ به قنديل عنك، بعد مهلة قصيرة يمكنك الإلغاء خلالها. وبعد انقضائها لا يمكن التراجع عن الحذف. | Your account and your personal data, including your conversations and what QANDEEL keeps about you, will be deleted permanently after a short waiting period. You can cancel during it. After it ends, the deletion can’t be undone. |
| deleteScheduled ★ | سيُحذف حسابك في {date} | Your account will be deleted on {date} |
| deleteCancel | إلغاء الحذف | Cancel deletion |
| deleteCancelled | تم إلغاء الحذف. | Deletion cancelled. |
| deleteFinalizing ★ | يجري حذف حسابك الآن. | Your account is being deleted now. |
| deleteNotCancellable ★ | لم يعد إلغاء الحذف ممكنًا. | The deletion can no longer be cancelled. |
| deleteBlocked ★ | يتعذّر إتمام الحذف حاليًا، ويبقى حسابك كما هو. | The deletion can't be completed right now. Your account stays as it is. |
| enterPassword | أدخل كلمة المرور. | Enter your password. |

Language names («العربية», "English") are each language's own name for itself, not copy. No word says "deleted" before
the final deletion; no guilt or pressure wording; the export explanation promises no format, retention or date.

## 10. Connected Worlds deletion blocker — kept explicit

`QAN-BL-ACCT-01`, `QAN-BL-CW-01`, `ASSURE-F05` and `ASSURE-O04` are untouched and stay `OPEN — UNASSIGNED`. No Shared,
Public, Replay or Matching / Introductions row is deleted, re-guarded or read by the erasure. An account that any
Connected Worlds row references (or whose Personal conversation one references) cannot be erased: the foreign keys refuse,
the whole erasure is undone, and the request is BLOCKED — never erased and never called deleted (proved in the verifier).
Because no Connected World has a user surface today, no production account can currently reach BLOCKED; the moment one
does, full account deletion is truthfully impossible, which is exactly the Launch Gate (W3-PDG-01 §8.4 item 9).

**`D-17 PERSONAL-WORLD IMPLEMENTATION — READY`** — subject to this PR's review, CI and the §9 copy decisions.
**`D-17 FULL ACCOUNT DELETION — BLOCKED BY CONNECTED WORLDS`.**

## 11. Verification (local; CI results are in the Draft PR)

| Gate | Result |
|---|---|
| `database/verify-migration-0130.mjs` (real PostgreSQL) | registered in API CI; **not runnable on this host** (no local PostgreSQL — application control) — proven by CI on the pushed head |
| Static database contracts `node --test database/tests/*.test.mjs` | 1281 / 1281 |
| API `src/account` Jest (incl. new `privacy-data.spec.ts`) | 5 suites, 145 / 145 |
| `apps/api` `tsc --noEmit` | pass |
| Full mobile Jest (`jest --ci`), incl. `privacy-data-controller`, `privacy-data-settings` (AR + EN), `w3-mega-s-privacy-data` (production surface), `reduce-motion`, `export-file` | 161 suites, 1902 / 1902 |
| `npm run typecheck:mobile` | pass — re-run after the last test edit |
| ESLint on every changed mobile file | 0 problems |
| W3-MEGA-S root contract | pass (inside the run below) |
| Every root contract (the forward-safety mirror excluded, see below) | 882 / 882 |

No device (Maestro) run was performed: this slice is Settings rows and forms over the frozen composition, proven in RNTL
for AR / EN, RTL / LTR, accessible names, live regions, focus, large text and reduced motion.

Failure classification during the work (none was fixed by changing production code to satisfy a proof):
- the W3-01 group-name and heading-count boundary, the pinned word / heading / control lists of five settings suites, and
  the T-01 mobile dependency pin — **validation** (scope boundaries this task supersedes; re-anchored keeping their
  permanent claims: Plan & Usage and any placeholder are still refused; the dependency re-anchor follows the W1A-01
  `expo-font` precedent);
- the T-03 Thread / Home content bans on later migrations — **validation**: re-anchored so ONLY the erasure migration may
  name those tables, and only in `DELETE` statements (plus its in-place redefinition of 0070's own guard); it still may
  create, insert into, update, alter or drop none of them;
- four frozen contracts that pin the app's plugin list and W2-02's Level-4 confinement — **Product/architecture boundary,
  not re-anchored**: the Android locale-configuration plugin was removed instead (§7.1, §13);
- a Privacy & Data test whose unawaited `unmount()` left an open `act` scope and a `Platform.Version` getter — **validation**
  (the test's own defects);
- a Settings return that did not re-read the Privacy & Data state — **implementation** (fixed: the controller reads again
  each time Settings is shown);
- the independent review's findings (§16) — each classified there; production fixes were made only for implementation
  defects, never to satisfy a proof.

The ten "mirror" tests of the forward-safety contract fail locally at any baseline on this host (the mirror lacks the root
Expo module; documented host fact) and are left to CI.

## 12. Security and privacy

- Owner-only everywhere: the account is the verified token's; no route, body or function takes an account id. The server
  passes act only on ids from the database's own claim.
- Re-authentication before export and deletion is enforced by the DATABASE (0129's proof), not the client.
- No generic history-delete: see §5.3; the boundary is transaction-bound AND row-authorized, opened only by the erasure,
  never for an UPDATE.
- The export holds no internal id, secret, token, score, reasoning or other person's material; it is downloadable only by
  its owner, only while available; the artifact is discarded at expiry. No payload is logged.
- Races: account-row-then-request locking; leases; replay-safe commands; lost answers reconciled by reading (client) or
  by re-judging committed state (server).
- Stale sessions after final deletion: the provider's refresh tokens and sessions are destroyed with the account; a live
  access token fails at the API guard (it asks the provider); between the erasure and the provider removal, every owner
  function finds no account row and every write fails its foreign key (fail closed).

Independent review: §16.

## 13. Residues and external dependencies

1. **Copy Gate** (§9): every new pair awaits the Product Owner; ★ rows are PRODUCT COPY DECISION REQUIRED. Merge blocker.
2. **Android per-app language** needs a `localeConfig` resource — a Level-4 CNG change requiring Engineering Architecture
   review (T-01 hierarchy; W2-02's approved exception is confined to its own plugin). Until then Android routes to the
   device language setting.
3. **Bold Text (iOS)** needs the Estedad v8.5 600 static face; W1A-01's PO font authorization covers 400 / 500 only. `E2E-D-12`
   stays open on it.
4. **Reduce Motion in the T-10 camera / temporal hooks** (CLOSED / FROZEN code) still reads the launch value, and so does any
   Reanimated animation left on its default `ReduceMotion.System`; changing them is a controlled change for their owner (the
   Stage 2 port consumes them).
5. **Real-PostgreSQL proof** is CI-only on this host.
6. **Hosted-provider facts not provable here:** the admin delete with the project's server credential; the API guard
   refusing a deleted account's live token (Supabase `/auth/v1/user`); both follow the verified source, neither is proved
   against the live project.
7. **Google Play web deletion-request path** — `EXTERNAL / STORE COMPLIANCE REQUIREMENT` (W3-PDG-01 §8.2): not built; no
   approved web surface exists. A launch dependency.
8. **Legal retention** beyond the minimal deletion record and identifier digests is not decided (W3-PDG-01 §7.4 / §8.3).
9. **World-scoped export** — `NOT YET INCLUDED — WORLD-SCOPED EXPORT AUTHORITY NOT IMPLEMENTED`; it belongs with each
   Connected World's own integration.
10. HIM measurements and QANDEEL's question planning are not exported (no owner-readable form).
11. A reserved identifier digest of a low-entropy Login ID can confirm that a given Login ID once belonged to a deleted
    account (it names nobody); accepted as the cost of "not reused directly".
12. No device validation (large text, VoiceOver / TalkBack, the folder picker on both platforms, the iOS per-app language,
    Hermes' `DateTimeFormat` with `-u-nu-latn`, and whether Android's Activity re-creation after a device-language change
    re-reads the locale that ProductRoot reads once at mount).
13. **Download re-authentication (security review, not decided).** Requesting a package demands a fresh password; downloading
    a READY one needs only a valid session, so a stolen access token could fetch it (with the Email) while it is available.
    The same token already reads the same Personal material through the product's own surfaces, and W3-PDG-01 §7.2 asks
    re-authentication for the request only; binding the download to a fresh proof or a one-time grant is a Product /
    security decision, not taken here. Likewise a session can cancel a scheduled deletion without a password (it only keeps
    the account; W3-PDG-01 does not ask for more).
14. **Very large accounts.** A database `statement_timeout` cancels a statement past PL/pgSQL's `EXCEPTION` handlers: a package
    or an erasure that exceeds it rolls back its whole pass and is retried each cycle (the export never reaches FAILED; the
    deletion stays FINALIZING). Nothing is lost or half-done — the invariants hold — but it does not finish. Bounded,
    committed batches are the follow-up if real account sizes approach the limit.
15. **Expired-artifact discard depends on the pass running.** A READY package past its date is never served (the read refuses
    it), but its content is nulled only by the pass or by the owner's next request; a production deployment must run the
    pass (it is off without the server credential or with `PRIVACY_MAINTENANCE_DISABLED=true`).
16. **Hardening not taken:** the erasure authorization is per-transaction, not bound to the account in every guard (every
    erasure DELETE filters by the account and no cross-account cascade exists today); every foreign-key refusal during the
    erasure is reported as BLOCKED, not only a Connected Worlds one (fail-safe: nothing is erased); the retired-identifier
    digests are unsalted (the table is readable by no application role); the verifier's `footprint()` census covers ten
    account-column names, not every name a Connected Worlds table uses.
17. **The iOS `CFBundleLocalizations` key** is an `app.json` value Expo writes into Info.plist (no config plugin, no dangerous
    mod); it passed the frozen plugin-list and Level-4 confinement contracts. It is recorded here so its CNG level is
    confirmed at the same architecture review as item 2.
18. While a package is being prepared, the app reads its state every 15 s for the rest of the runtime generation, also when
    Settings is closed (it stops at READY / EXPIRED / FAILED or when the generation retires).
19. A reader whose Email is unconfirmed cannot pass the password proof; the request is answered as unavailable. W2-01 creates
    no such session today.

## 14. Rows

> **Historical — the state at handoff on the Draft PR.** PR #296 has since merged (see Status). The current row states
> are kept in [`E2E01_READ_FIRST.md`](E2E01_READ_FIRST.md); this table is not rewritten.

| Row | Status after this slice |
|---|---|
| `E2E-D-11` | IMPLEMENTED on the Draft PR — the Language row to the system setting; iOS per-app language declared; Android device-level only (§13 item 2). NOT closed here: device validation and the Android decision remain |
| `E2E-D-12` | ADVANCED — audit done; Reduce Motion followed mid-session on the W1A / W3 surfaces; text scaling, screen reader and contrast verified on every new surface; Reduce Transparency not materially applicable; **Bold Text open** (§13 item 3); row NOT closed |
| `E2E-D-16` | IMPLEMENTED on the Draft PR within the Personal world (§7.3); world-scoped categories NOT YET INCLUDED; closes when this PR merges green and the §9 copy is approved |
| `E2E-D-17` | **`D-17 PERSONAL-WORLD IMPLEMENTATION — READY`**; **`D-17 FULL ACCOUNT DELETION — BLOCKED BY CONNECTED WORLDS`**. The row is NOT closed |
| `E2E-D-02` | ADVANCED — six real groups (Account & Identity, Security & Sign-in, QANDEEL & Conversation, Appearance & Accessibility, Privacy & Data, Support & About); Notifications, Introductions and Plan & Usage have no function yet; NOT closed |

W3 stays ACTIVE. No row is `COMPLETE / PRODUCTION-READY`. **W3 is not yet ready for phase-closure review**: `E2E-D-03`
(Account Photo) is blocked by the media-storage boundary, `E2E-D-12` has an open Bold Text gap, `E2E-D-11` has an open
Android decision, and this slice's copy is unapproved.

## 15. Backlog (BG-05 / BG-08)

BG-05: the backlog was read in full; no item names W3-MEGA-S or W3 as its owner; nothing is inherited. `QAN-BL-ACCT-01`
and `QAN-BL-CW-01` are adjacent and untouched (`OPEN — UNASSIGNED`); `QAN-BL-SEC-01` stays `DEFERRED — OWNED` (its reopen
condition is not met: no auth-storage mechanism, backup policy or credential model changed); `QAN-BL-CTX-01`,
`QAN-BL-LANTERN-01` and `QAN-BL-VOICE-01` are unrelated and untouched. BG-08: this Draft slice closes no phase and no
`CLOSED / FROZEN` task; its residues (§13) are tracked by this record and the E2E rows they name; the copy items are
active-task blockers (BG-01), not backlog. No item is admitted.

## 16. Independent review (before the PR) — findings and dispositions

Three read-only reviewers traced the first commit (`d10ff94`) by hand: the migration and its verifier, security / privacy,
and API ↔ mobile correctness. Each finding was checked against the source before it was acted on.

| # | Finding | Class | Disposition |
|---|---|---|---|
| R1 | Four narrowed guards (0011, 0012, two of 0063) still had PUBLIC's default EXECUTE; the verifier's catalog stage would fail | implementation | fixed — EXECUTE revoked on those four (the other twelve were already revoked by their own migrations; §5.3) |
| R2 | The verifier committed units as `service_role`, which 0071 revoked | validation / proof | fixed — commits as the owner, as `verify-migration-0072` does |
| R3 | `VALUES ($1, $1::text)` raises 42P08, not the asserted 42501 | validation / proof | fixed — `$1::uuid` |
| R4 | The erasure deleted HIM calculation results and observations before the snapshots that reference them: every account with a calculated HIM measurement would have been BLOCKED | **implementation (real)** | fixed — snapshots first; the fixture now calculates a measurement to its snapshot, so the order is proven |
| R5 | A still-valid session can write a HIM row after ERASED; the provider's cascading delete is then refused for ever | **implementation (real)** | fixed — residual sweep before every removal (§5.3); proved |
| R6 | The export included never-admitted (CANDIDATE) interpretations and internal status names | **implementation (real)** | fixed — only interpretations the owner could have been shown, with readable labels (§7.3); proved |
| R7 | The download response had no `Cache-Control: no-store` | implementation | fixed on all five routes; pinned |
| R8 | Reduce Motion was per-component: a surface mounted after a change started from the launch value | implementation | fixed — one process-wide store with one platform listener; pinned (remount test) |
| R9 | `formatDay` could throw while drawing on an unreadable instant | implementation | fixed at three layers: the API normalizes to ISO-8601 UTC, the app refuses an unreadable instant, the formatter never throws; literal AR / EN dates pinned on the database's microsecond form |
| R10 | iOS refuses to create a file that exists: a second download the same day failed | implementation | fixed — the next free name; tested |
| R11 | One failed poll read stopped the preparing poll; an unrequested read could overwrite a newer act's answer; a command could stay unsettled after its request was found held | implementation | fixed — re-armed, overtaken reads dropped, commands settled on sight; each pinned |
| R12 | The sentence said aloud after a lost answer could differ from the state (BLOCKED said as "being deleted") | implementation | fixed — the announcement is the row's own sentence; pinned |
| R13 | Focus was lost after an accepted request or a cancellation | implementation (accessibility) | fixed — the status rows carry the return target; focus returns to Delete account after Cancel |
| R14 | A `null` row in the claim answer dropped the whole batch (found by the new repository test) | implementation | fixed |
| R15 | Reduce Motion in the T-10 hooks / Reanimated defaults | — | already disclosed; residual §13 item 4 widened |
| R16 | Download and cancellation need no fresh password; very large accounts under a statement timeout; expired-artifact discard depends on the pass; per-transaction (not per-account) authorization; FK-only BLOCKED detection; unsalted digests; footprint census names; iOS Info.plist CNG level; polling while Settings is closed; unconfirmed Email | Product / security decision or accepted limitation | recorded, not changed: §13 items 12 – 19 |

No reviewer found a way to open the erasure boundary, an erasure or export across accounts, a logging leak, or an API ↔
database or API ↔ app contract mismatch.

## 17. R2 — the first CI round on Draft PR #296 (head `c7ea9af`)

### 17.1 API CI — the initial failure was in the 0122 verifier, not in 0130
`verify-api` failed at `database/verify-migration-0122.mjs` (QAN-CW-REM-03), scenario `P01 posture: signatures, ACLs, the
guard and the absent erasure RPC` — 22 of its 23 scenarios passed. The failing assertion counted EVERY non-trigger
function in `public` whose name contains `eras` and required zero: a repository-wide "no erasure RPC" ban, wider than
0122's own authority (the Introduction disclosure alone). 0130's separately governed Personal-account erasure
(`public.server_erase_personal_account_v1`, service role only, pinned by its own verifier) matched the name. Because the
0122 verifier stopped the job, the later API CI steps — including the 0130 verifier — did not run on `c7ea9af`.

Classification: **`VALIDATION / PROOF DEFECT — STALE CROSS-TASK ASSERTION`**. No production SQL changed (neither 0122 nor
0130), no Introduction deletion semantics, no guard, no privilege.

R2 re-anchored the assertion to the Introduction-disclosure scope only, in every application schema:
- **(a)** no erasure-named callable function — nor any function its body calls — names the Introduction disclosure, so no
  erasure command can reach a disclosure verifier or payload outside owner deletion; and
- **(b)** whatever its name, no callable function other than `public.delete_shared_world_owned_material_v1` writes
  (`UPDATE` / `DELETE`) the disclosure command relation. This widens the existing `public`-only "exactly one eraser"
  check to every application schema.

A disclosure-erasure bypass (for example a `server_erase_…` wrapper delegating to a private function that updates the
disclosure) still fails both (a) and (b); a Personal-account erasure that never names the disclosure does not.

### 17.2 Android — first failure
`Android (API 36 emulator boot smoke)` failed on `c7ea9af` after the build producer passed, the APK installed and the
emulator reported `sys.boot_completed=1`: `maestro test apps/mobile/.maestro/boot-smoke.yaml` failed after `Launch app …
with clear state`, with ADB `device offline` instability in the boot log. No application code was changed for it. Per the
workflow's own documented retry, the failed job is re-run once (consumer only, no rebuild); its classification is recorded
in §17.3.

### 17.3 Results after R2 (R2 head `e91578d`)
- **API CI** — run `36782307459`: success. `verify-migration-0122.mjs` 23/23 scenarios, `P01` passes. The 0130 verifier
  (`Verify W3-MEGA-S Personal export and Personal-world account deletion against real PostgreSQL`) ran and passed on
  PostgreSQL 17, so PostgreSQL showed no new 0130 defect and 0130 was not touched. The W3-MEGA-S root contract step also
  passed; R2 did not touch that contract.
- **iOS** — the `c7ea9af` iOS smoke was `cancelled`, not failed: pushing R2 started Mobile CI run `36782307445` on the
  same ref, and the workflow's `cancel-in-progress` concurrency stopped the older run. Nothing about R2 caused a failure.
  On `e91578d`, iOS (iPhone 17 / iOS 26.5) smoke: success (attempt 1 and attempt 2).
- **Android** — the R2 push's own Mobile CI run (`36782307445`, attempt 1) failed in the same way as on `c7ea9af`. The
  step was the same, the failure came after `Launch app "com.qandeel.mobile" with clear state...`, the boot log showed the
  same ADB `device offline` instability, and Maestro gave no assertion or crash message. The workflow does not upload the
  Maestro debug directory, so there is no screenshot or logcat for either failure. That run's failed jobs were then
  re-run with GitHub's "re-run failed jobs", with no workflow, timeout or code change (attempt 2). Result: **success**.
  The code and head were the same in both attempts, `main` (`1e7b681`) is green on the same smoke, and iOS passed. The
  first failure is therefore classified **`INFRASTRUCTURE / HARNESS FLAKE`**, not an app-level defect.

The E2E rows' closure state is unchanged by R2.
