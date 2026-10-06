# QANDEEL — W3-02 Account & Identity Foundation + Public ID v1 — Implementation Record v1

**Task:** W3-02 — Account & Identity Foundation + Public ID v1 (E2E-01 wave W3, second bounded slice)
**Rows:** `E2E-D-09` (Public ID / one lifetime manual change) — and `E2E-D-02` (find a setting in its group)
**advanced only, NOT CLOSED**
**Baseline:** `023cb9874376ac69db5848db099d06034d5deb54` (merge of PR #287, W3-01)
**Branch:** `feat/w3-02-account-identity-public-id`
**Status:** MERGED / CLOSED — merged through PR #288 at `92444c3ab8c35f7d819888be76aa6395c93d94b8` (head
`f4cf2015428c7bdbe7d55788f0bfbed577560efd`, 2026-09-29T22:54:21Z). One bounded, Product-Owner-authorized Production
Integration slice; it opens no other wave or Product area, closes no phase, and does not close W3 or Account & Identity.
(Reconciled by W3-MEGA-U U0; the implementation record below is otherwise unchanged. §12's pre-merge wording is kept
as written at hand-off.)

---

## 1. Starting baseline and map reconciliation

- `origin/main` was exactly `023cb9874376ac69db5848db099d06034d5deb54`; PR #287 (W3-01) is MERGED with that merge
  commit (`2026-09-29T20:18:45Z`, head `c15cfac`). Tree clean; the branch was created from it.
- **Post-W3-01 reconciliation (its own commit, before this implementation):** the Current State, the Project Map,
  `E2E01_READ_FIRST.md` §6 and the W3-01 record now say W3-01 is MERGED / CLOSED through PR #287 at the baseline;
  `E2E-D-01`, `D-07`, `D-10` are CLOSED in production; `E2E-D-02` is advanced only; **W2 is CLOSED; W3 is ACTIVE**; the
  End-to-End phase is ACTIVE (the Project Map's 2026-09-27 checkpoint no longer reads "has not started"); the Map's
  migration range was stale at 0122. The W3-01 contract's record-status predicate was re-anchored to the merged
  truth (its permanent claim — W3 is not closed — is kept). No historical census, matrix or wave baseline was
  rewritten, and no Gap Matrix classification was changed.

## 2. Skills / G1

Discovered (this session's roster): `react-native-best-practices` (+ sub-skills), `sibawayh:designing-arabic-frontends`,
`sibawayh:writing-eloquent-arabic`, `security-review`, `code-review`, `impeccable`, `ui-ux-pro-max`, `emil-design-eng`,
the animation skills, `run`, and non-mobile skills. No Postgres / Supabase or dedicated accessibility / testing skill is
installed.

Used:
- `react-native-best-practices` — the project is Expo / React Native. None of its sub-skills applied: W3-02 adds no
  animation, gesture, SVG, worklet or JSI work (the change is a state of the existing Settings destination, with no
  motion).
- `sibawayh:designing-arabic-frontends` — §4 "mixed-direction boundaries" is exactly the Public ID problem: a Latin
  handle beginning with a neutral `@` inside an Arabic line. Applied: every drawn handle is an LRI … PDI isolate, and
  the field is its own explicit LTR direction context (input and anything in its row share one direction). Its digit
  advice (§3) is why Arabic-Indic digits typed into the field normalize to 0–9, identically in the database.
- `security-review` — invoked on the finished change; it could not execute on this host (the skill shells out through
  Bash, which the host's application-control policy blocks). Its purpose was served instead by an independent
  adversarial security review of the staged diff by a separate reviewer agent against the invariants in task §7 / §9
  (outcome in the PR report).

Not used: `writing-eloquent-arabic` (no Arabic was written — every string is frozen or Product-Owner approved);
`impeccable` / `ui-ux-pro-max` / `emil-design-eng` (no new visual language — the frozen W3-01 / P4-C3 composition is
reused); animation skills (no motion); `run` (no device run is required for ordinary static Settings work — task §11).

## 3. Research refresh (official Supabase guidance) and its implication

Read before choosing the boundary: Supabase *Database Functions* (SECURITY INVOKER is the default and best practice;
a SECURITY DEFINER function must set `search_path`, and with `search_path = ''` every relation is schema-qualified;
restrict EXECUTE by revoking from `public` and the roles, then granting selectively), *Row Level Security* (a SECURITY
DEFINER function in an exposed schema is callable over the Data API with the owner's privileges; check
`auth.uid() IS NOT NULL`; wrap it as `(select auth.uid())`; a missing grant raises 42501 before any policy), and
*Managing User Data* (application user data in a `public` table keyed to `auth.users`, with RLS).

Implication, reconciled with repository truth, **as corrected by R1 (§13)**. The read is SECURITY INVOKER under the
existing own-row policy. The one write needs owner privilege, because `authenticated` has, and keeps, no UPDATE on
`public.users`.

That privilege lives ONLY in the non-exposed schema `account_private`, created by 0125 and exposed nowhere. The
project exposes `public` only (`database/README.md`), and a new schema is exposed only when someone adds it by
hand.

The Product RPC `public.change_own_public_id_v1` is SECURITY INVOKER: a pass-through to
`account_private.change_own_public_id_v1`, which is SECURITY DEFINER. A client calling the Product RPC directly
over the Data API meets the identical rules: the private implementation and the guard trigger are the final
authority, not the API.

The protections: `search_path = ''` on every function; schema-qualified relations; an explicit `auth.uid()` null
check; EXECUTE revoked from `PUBLIC, anon, authenticated` (and `service_role`) by name on every function. Only
then are the grants made, all to `authenticated`: the two Product functions, plus USAGE on `account_private` and
EXECUTE on its one change implementation.

(The first head, `860d555`, kept the DEFINER write in `public` on the W1B-01 `complete_first_use_welcome_v1`
precedent. Independent review rejected that: `search_path` and restrictive grants do not replace the non-exposed
boundary.)

## 4. Product Copy Gate

Frozen and reused byte-for-byte from the pinned P4-C3 registry: `gAccount` «الحساب والهوية» / Account & Identity (P4-C4
§4); `pidTerm`, `pidAvailable`, `pidUsed`, `pidTitle`, `pidCurrent`, `pidNew`, `pidConfirm`, `pidKeep` (P4-C4 §5);
`pidBody` (P4-C3R approval). The fixtures `@nightlamp27` / `@noor.writes` are evidence and appear only in tests.

**Product Owner Copy Gate — APPROVED / FROZEN FOR W3-02** (granted in the task, no further gate):

| State | Arabic | English |
|---|---|---|
| Invalid | «أدخل معرّفًا عامًا صالحًا.» | Enter a valid Public ID. |
| Unavailable | «المعرّف العام هذا غير متاح. اختر معرّفًا آخر.» | This Public ID isn't available. Choose another one. |

Generic failure: T-14's frozen network sentence «تعذّر الاتصال. حاول مرة أخرى.» / "Couldn’t connect. Try again." is
reused verbatim, as W1B-01 and W2-01 reuse it (W2-01 also for an answered-but-failed request). It is shown only when a
change did not commit, or when it is still unknown whether it did after the canonical state was read again — i.e. "it
did not go through; try again". No other copy exists: no progress, no success sentence, no "already used" error (the
row shows the canonical value and `pidUsed`). All words live in `apps/mobile/src/settings/copy.ts`.

## 5. Public-ID grammar — implementation detail, not Product authority

P1 §6 / §16.1 leave the generation grammar and normalization to implementation. W3-02 fixes, in the database
(`0125`) and mirrored on the client (`settings/public-id.ts`):

- stored without the `@` the Product shows in front of it;
- 3–24 lowercase English letters and digits, starting with a letter, with `.` or `_` only between letters and digits
  (`nightlamp27`, `noor.writes`); the canonical form is lowercase, so the unique index IS case-insensitive uniqueness;
- a typed value is trimmed, one leading `@` dropped, Arabic-Indic and Extended Arabic-Indic digits turned into 0–9,
  and lowercased;
- generated IDs: two words from fixed neutral English lists plus a 2–4 digit number (e.g. `quietlamp27`), drawn again
  on a collision, never derived from any account data.

It differs deliberately from the Login ID grammar (0123): a Public ID must start with a letter and admits no `-`,
so a generated or chosen handle reads as a handle.

**Product Owner decision (W3-02 R1, APPROVED):** a Public ID never equals the SAME account's private Login ID. This
is a rule within one row only. The Public-ID namespace is never compared with ANY OTHER account's Login ID, so there
is no Login-ID lookup or oracle (§6, §10).

## 6. Database authority — migration `0125_account_public_id_v1.sql`

On the canonical account row `public.users` (P1 §6 "account-held"; beside W1B-01's Name and Login ID), additive:

- `public_id text NOT NULL` (shape CHECK, unique index `users_public_id_key`), `public_id_changed_at timestamptz`,
  `public_id_change_command_id uuid` (pair CHECK: both or neither);
- **`users_public_id_not_own_login_id_check`** — `CHECK (login_id IS NULL OR public_id <> login_id)`, validated. Both
  values are stored canonical lowercase, so this is the case-insensitive rule. Every path meets it: a modified client,
  the server channel, the table owner, a retry, a race.
- **the schema `account_private`**, not exposed, holds every privileged part:
  - the change implementation and the two trigger functions (SECURITY DEFINER);
  - `generate_public_id_v1(p_excluded)` and the pure helpers `normalize_public_id_v1` / `is_well_formed_public_id_v1`
    (SECURITY INVOKER; they only ever run inside the privileged callers or the migration).
- **backfill** of every existing account, one row at a time (each draw sees the previous ones), excluding each row's
  own Login ID;
- **`assign_public_id`** BEFORE INSERT trigger: every new account gets its Public ID from the server generator,
  excluding the row's own Login ID; a supplied value is ignored;
- **`guard_public_id_lifetime_change`** BEFORE UPDATE trigger admits two writes to the Public ID:
  1. "from a never-changed Public ID to a different one, consuming the change with its command identity";
  2. the server's own redraw when sign-up first assigns a Login ID equal to the freshly drawn Public ID. 0123 sets
     the Login ID one statement after the insert. The redraw value is drawn in the trigger and never taken from the
     writer, and it consumes nothing. It fires only for a row created in the same transaction, and only for a
     write made from inside a trigger (`pg_trigger_depth() > 1`). A direct statement, however privileged, cannot
     clear and re-assign a Login ID to re-roll a Public ID; the R1 review raised this as a LOW finding, and it is
     now fixed and proven in the verifier.

  Both bind whoever writes, including the table owner and the server channel. A second change, un-consuming, or a
  change without consuming are impossible by construction.
- **`public.read_own_public_id_v1()`** — SECURITY INVOKER, own row by RLS: `(current_public_id, change_available)`;
- **`public.change_own_public_id_v1(p_command_id uuid, p_public_id text)`** — SECURITY INVOKER Product RPC, a
  pass-through to **`account_private.change_own_public_id_v1`** (SECURITY DEFINER, caller = `auth.uid()`, no account
  parameter). It locks the caller's row and answers one of these, each with the caller's own resulting state:
  - `CHANGED` (also the SAME command replayed after it committed);
  - `UNCHANGED` (the current ID; nothing consumed);
  - `INVALID` (malformed, or the caller's OWN Login ID read from the caller's own locked row; nothing consumed);
  - `ALREADY_USED`;
  - `UNAVAILABLE` (unique index; nothing about the holder is returned).

  The order is: replay, malformed, current value, own Login ID, allowance, namespace. The current value can never
  equal the own Login ID, so UNCHANGED and the own-Login-ID INVALID never meet. A command identity reused for a different value
  is refused (`23505 PUBLIC_ID_COMMAND_CONFLICT`). The command identity is recorded only by a commit, so that
  refusal covers a command that COMMITTED; a non-committing outcome (INVALID / UNCHANGED / UNAVAILABLE) records nothing,
  and the client never reuses an identity for another value (one identity per requested value);
- **one namespace lock:** the generator and the change take the same transaction-scoped advisory lock
  (`qandeel.public_id.namespace`) before checking or writing a Public ID, so a sign-up can never draw a value a
  concurrent sign-up or change is committing (which would otherwise fail that sign-up on the unique index). One key,
  not one per value, so the backfill holds a single lock; Public ID commits are therefore serialized globally
  (brief, and rare);
- EXECUTE on all eight functions and USAGE on `account_private` are also revoked from `service_role` where it exists:
  the API needs none of them.

The I-05 Public runtime is untouched: `public_identities.public_identity_ref` stays the opaque internal ref, the
`public_identity_display_state` relation and `ensure_public_identity_v1` / `update_public_display_label_v1` are not
read, written or granted. No compatibility change was required: no I-05 state is derived from or displayed as the
Public ID today, and binding the `PSEUDONYM` label to it is `E2E-H-08` (§11).

## 7. API boundary

`AccountModule` (no second identity subsystem, no second auth authority):

- `GET /account/public-id` (guarded) → `{ publicId, changeAvailable }` — nothing else (no id, Name, Login ID, Email,
  Shared ID or Public ref);
- `POST /account/public-id/change` (guarded, 200) — body exactly `{ commandId (UUID), publicId (≤ 64) }`; any other
  key, including a user / account id, is 400. Both run on the caller's token through the Data API; the server channel
  is not used. The database's bounded outcome is returned as `{ outcome, publicId, changeAvailable }`; the command
  conflict is 409; every other failure is 503 (never a guessed outcome). There is no preflight availability route.

## 8. Mobile Product realization

- **Account & Identity** is the third REAL group of the ONE General Settings destination, drawn first, and holds exactly
  one function: the Public ID row (`pidTerm`, the handle as an isolated LTR run, `pidAvailable` / `pidUsed`). It is
  drawn once the Public ID has been read (the read starts when Settings is shown and retries 1/2/4/8/15 s; nothing is
  shown for it until then — no loading copy). No Name, photo, Login ID, Email, Shared ID or Security row exists,
  disabled or otherwise.
- **Change** is a state of this destination (no route, dialog, world, Session or generation): `pidTitle` + `pidBody`
  BEFORE anything can commit, `pidCurrent` + the handle, `pidNew` + an LTR field (no auto-capitalize / correct /
  complete), `pidKeep` and `pidConfirm`. Settings' Back and Android Back leave the change (not Settings); Keep leaves it
  without a request. Confirm is refused while one commit is in flight (ref + controller), is busy / disabled and
  dimmed, and Keep / Back cannot abandon it half-way.
- **One command identity per requested value** (UUID-shaped, minted locally); the value sent is the normalized one.
  Outcomes: CHANGED / ALREADY_USED → back to Account & Identity with the canonical value and `pidUsed`, the row no
  longer pressable, focus back on it; UNCHANGED → back, allowance intact; INVALID (told at once for a value that can
  never be one, else the server's verdict) and UNAVAILABLE → the approved sentence in a polite live region, announced.
- **Lost / ambiguous answer** (no answer, 5xx, undecodable, conflict): the canonical state is READ before anything is
  said. Used → the change is over and shown (never a false failure). Still available → the network sentence and a
  retry that is the SAME command (idempotent on the server). Read fails too → the same: still unknown, same command.
- The controller is built per runtime generation beside the account controller, on the same account transport bound
  to the identity, and retired with the generation (sign-out included).
- Appearance: unchanged. Settings and the change paint the effective non-Analysis family (Dark / Light / System); the
  Analysis is not involved. 44 × 44 minimum targets, no fixed widths, wrapping actions, no text caps; the row's
  accessible name is `Public ID, @handle, <allowance>`; no internal identifier is announced.

## 9. Verification

| Gate | Result |
|---|---|
| `database/verify-migration-0125.mjs` (real PostgreSQL) | registered in API CI (`verify:account-public-id:integration`); **not runnable on this host** (no local PostgreSQL) — proven by CI on the pushed head |
| API `src/account` Jest (incl. new `public-id.spec.ts`) | 3 suites, 73 / 73 |
| `apps/api` `tsc --noEmit` | pass |
| `settings/__tests__/public-id-controller.test.ts` | pass (in the 36 of `src/settings` with the W3-01 suite) |
| `settings/__tests__/public-id-settings.test.tsx` (AR + EN) | 31 / 31 |
| `integration/__tests__/w3-02-public-id.test.tsx` + re-anchored W3-01 production suite | 18 / 18 |
| Full mobile Jest (`jest --ci`) | 150 suites, 1774 / 1774 |
| `npm run typecheck:mobile` | reported "pass" at `860d555`, but that was WRONG: `public-id-settings.test.tsx` failed TS2345, locally and in Mobile CI. It was repaired in R1 (§13); the local typecheck was re-run and passes |
| W3-02 root contract `npm run test:w3-02-account-identity-public-id-contract` | 14 / 14; every critical predicate rejects its planted defect (Public ID = `user_id`, = Login ID, = internal Public ref; client-supplied user id in SQL and API; direct authenticated table UPDATE; missing uniqueness; a second manual change; UI-only enforcement; optimistic client consumption; an API and a SQL availability oracle; a second Public Settings destination; a placeholder Account row; words written outside `copy.ts`; guessing after a lost answer) |
| W3-01, W1A, W1B, W2-01, W2-02, T-12, T-12P, T-13, T-14 root contracts | 167 / 167 |
| `npm run test:task-closure-governance-contract` | 24 / 24 |
| Static database contracts `node --test database/tests/*.test.mjs` | 1257 / 1257 (the verifier-hazard linter first caught a `SET updated_at = now()` write-back in the new verifier; fixed to `clock_timestamp()`) |
| ESLint on every changed mobile file | 0 errors, 0 warnings — import-resolution rules off locally (the `unrs-resolver` native binding is blocked on this host); CI lints on Linux |

The database verifier proves: catalog, grants and no oracle function; backfill; generation not derived from private
identity, with a seeded real collision; every outcome; replay; the command conflict; that a private Login ID is not in
the Public namespace; the guard refusing a second / un-consumed change even from the owner; `anon` / `authenticated`
refusals; and, on committed rows across two connections whose second attempt is shown to block, that two commands of
one account cannot both win, the same command twice is one change, and two accounts racing for one Public ID leave one
holder.

## 10. Privacy and non-enumeration

- No lookup, search or availability route or function exists; the only way to learn that a handle is held is to try
  to commit it, and the answer names nobody. What it reveals — that some account displays that pseudonym — is the
  same fact the Public World shows by design.
- Before the one change is used, a reader can try several handles (UNAVAILABLE consumes nothing). No rate limit is
  added in W3-02 (residue 2), exactly as W1B-01 recorded for Login-ID availability.
- No OTHER account's Login ID is ever consulted: the only Login ID read is the caller's own, from the caller's own
  locked row, and a value equal to another account's Login ID is simply a free Public ID. So the change cannot
  reveal a private Login ID (proven in the verifier and guarded by planted defects in the root contract).
- Nothing is logged: no Public ID, request, command identity or outcome in the API or the app.

## 11. Residues

1. **`E2E-H-08` (Public World display choice) is not closed.** The I-05 `PSEUDONYM` display label is not yet bound to
   the canonical Public ID; that integration, and any Public-World surface, is later work.
   *(Current truth, recorded by S5-01 without rewriting this residue: S5-01 implements the binding — PSEUDONYM =
   the CURRENT Public ID, REAL_NAME = the CURRENT Name, migration `0142` — on its Draft PR; `E2E-H-08` closes on that
   merge. See the [S5-01 record](QANDEEL_S5_01_PUBLIC_REACHABILITY_ENTRY_IDENTITY_FOUNDATION_IMPLEMENTATION_RECORD_v1.md).)*
2. **No rate limit on change attempts** before the one change is used (a bounded pseudonym-probing surface; §10). The
   function is also reachable directly over the Data API with the reader's own token, which an API-edge limit would
   not cover; a rate limit (API and RPC) is a later hardening item, like W1B-01's Login-ID availability.
3. **Released handles are reusable.** After a reader changes from a generated handle, the old one returns to the
   namespace. Holding released handles would be new Product policy; none exists (P1 §6 is silent), so none is invented.
4. **Whitespace:** the database trims spaces; the client trims all whitespace and sends the normalized value, so the
   server always sees the canonical form from this app.
5. **Real-PostgreSQL proof is CI-only** on this host; the verifier is validated by the pushed head's API CI (§13).
6. W3-01's own §12 residues are unchanged and remain recorded there; W3-02 inherits none of them.
7. **`authenticated` holds USAGE on `account_private`.** The INVOKER Product wrapper requires it. PostgreSQL cannot
   withdraw its global PUBLIC EXECUTE per schema, so a FUTURE function added to that schema must revoke itself by
   name, as every 0125 function does. The verifier checks the whole schema, and exactly one function is executable
   by any client role.

(The first head's residue "a reader may choose a Public ID equal to their own Login ID" is removed: the Product
Owner decided it in R1, and the database now refuses it, §5 / §6.)

No cross-task backlog item is admitted: W3-02 closes no phase or `CLOSED / FROZEN` task (BG-08 runs at a closure), and
residues 1–7 are owned by the End-to-End audit / Production Integration (`E2E-H-08` is its own row).

## 12. Lifecycle truth (see also §13)

**Post-merge (W3-MEGA-U U0):** PR #288 MERGED at `92444c3ab8c35f7d819888be76aa6395c93d94b8`, so `E2E-D-09` is CLOSED
in production. The paragraph that follows is the hand-off wording.

W3-02 was implemented on a **Draft PR and was not merged at hand-off**. `E2E-D-09` is implemented and proven server + mobile end to end
as above, and closes only once this PR merges green. `E2E-D-02` is advanced (three real groups), NOT CLOSED. W3 remains
ACTIVE; `E2E-D-03`, `D-05`, `D-13`, `D-14` and `D-15` remain open. This record does not claim Account & Identity
complete: Name, photo, Login ID, Email, Shared ID and Security are not implemented.

## 13. R1 — Security boundary, identity separation and CI correction

A narrow correction on the same Draft PR, following independent review of head `860d555`. It did not reopen the
Product slice. Migration 0125 was edited in place because it is not merged; there is no 0126.

- **Security boundary.** No W3-02 SECURITY DEFINER function remains in the exposed `public` schema. The two Product
  RPCs there are SECURITY INVOKER. Every privileged part — the change implementation and the two trigger functions —
  lives in the non-exposed `account_private` schema. The generator and the pure helpers are INVOKER and live there too.
  - Grants are exact: USAGE on the schema and EXECUTE on its one change implementation, both to `authenticated`
    (because the INVOKER wrapper runs as it), plus the two Product functions to `authenticated`.
  - Nothing is granted to `anon` or `service_role`.
  - No private helper is a Data API RPC.
- **Public ID ≠ the same account's Login ID (Product Owner decision).**
  - A validated CHECK on `public.users` enforces it.
  - The manual change answers `INVALID` for the caller's own Login ID and consumes nothing. It uses the approved
    invalid copy; no new copy was added.
  - The generator refuses the row's own Login ID as a candidate (backfill and new accounts).
  - The guard trigger redraws a sign-up whose Login ID equals its freshly drawn Public ID.
  - No other account's Login ID is ever read.
- **API CI.** The T-03B1b2 contract's exact reader allowlist of `readDataApiUpstreamIdentity()` names
  `apps/api/src/account/account.service.ts` as its fourth reader. The list stays exact: a fifth reader still fails it.
  The contract now also pins that this reader reads the identity once, matches only
  `23505 / PUBLIC_ID_COMMAND_CONFLICT`, and never logs, interpolates or returns it.
- **Mobile CI.** The BackHandler test handler type is derived from the React Native API (`HardwareBackPressEvent`)
  and is invoked with a typed event. Production navigation is unchanged.
- **Real PostgreSQL.** R1 is the first head on which API CI reaches the 0125 verifier: at `860d555` API CI stopped at
  T-03B1b2 before any migration ran. Its result on the R1 head is recorded in PR #288.
