# QANDEEL — S4-01 Shared World Reachability, Invitation & Birth — Implementation Record v1

**Task:** `S4-01 — Shared World Reachability, Invitation & Birth` (Stage 4 — Shared World Product Integration)
**Task Contract:** `QANDEEL_S4-01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_TASK.md` (Product Owner, approved 2026-10-05)
**Canonical baseline:** `09d8ec763b81ba85fce1e4b4f7fd0430d5dc1ade` (the merge of PR #309, VAL-01)
**Branch:** `feat/s4-01-shared-world-reachability-invitation-birth`
**PR:** see §1
**Status:** **`S4-01 IMPLEMENTED — READY FOR INDEPENDENT REVIEW — NOT MERGED`**. Claude does not merge it. The S4-01
Product Copy Gate is **CLOSED** (Product Owner, 2026-10-05): no S4-01 Product copy remains PROPOSED (§15).

> The first real Shared World journey a person can walk: reach «العالم المشترك» / Shared World from the production
> Global Switcher, see their Worlds and invitations, read / copy / regenerate their private Shared ID, invite someone by
> theirs without learning who it belongs to, accept or decline a real invitation, and — on acceptance — enter at once the
> one Shared World the frozen I-04 core births atomically. Shared conversation and material are S4-02's, and nothing here
> pretends otherwise.

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `09d8ec763b81ba85fce1e4b4f7fd0430d5dc1ade` — `origin/main` confirmed equal at kickoff; main did not move during the task |
| Branch | `feat/s4-01-shared-world-reachability-invitation-birth` |
| PR | #310, against `main`; draft until review readiness |
| Validated head | `ada631562686c7e05f607c5a4e0ce73664c1eed4` — the exact head whose full CI evidence §14 records |
| Final head | the S4-01 Product Copy Gate closure on top of `ada6315` (§15): the copy strings, their contract / test pins, the Journey B malformed-ID sentence, and this record and the backlog — no migration, API, behaviour or workflow change. Its own VAL-01 evidence is recorded in the PR conversation |

## 2. Repo Truth Gate and the execution map

- `origin/main` = `09d8ec7` (PR #309), tree clean. No intervening merge, so no re-cut.
- **A3-02 merged** through PR #308 at `06a960848faaccc6e294d38fbde2918b10ed1d74`; the Current State and Project Map
  still read "Draft PR". By the precedent A3-02 itself followed for A3-01, this change reconciles them: **Stage 3 is
  DONE / MERGED**; Stage 4 is **ACTIVE** with S4-01.

| Stage | State at this task |
|---|---|
| 1 — Personal Core / W3 core | DONE FOR THE CURRENT SEQUENCE, WITH NAMED RESIDUALS |
| 2 — Final Visual Production Port | DONE / MERGED |
| 3 — Activity & Notifications Production | DONE / MERGED (A3-01 #307, A3-02 #308) |
| **4 — Shared World Product Integration** | **ACTIVE — S4-01 (this PR)** |
| 5 — 9 | LATER |

## 3. Anti-duplication census (what existed, what was reused, what was missing)

| Area | Frozen Product / design | Backend / runtime that existed | Production before S4-01 | What S4-01 added |
|---|---|---|---|---|
| Shared World identity, membership episodes | CW2-01, CW2-03 | `0075` tables (sealed) | none | nothing new — consumed |
| Shared ID credential, epoch, invitation | CW2-03 §3–§5; P1 §5; W3-PDG-01 §4 | `0081` rotate / submit (granted to `authenticated`), `0129` format, normalizer, `sid1:` reference, server regeneration (no role) | none | the sealed owner-readable value; the gated non-enumerating submission; the client grant retired |
| Direct birth | CW2-03 §6–§8 | `0082` atomic core (no application role, pending a launch gate) | none | the launch-gated, server-owned acceptance wrapper |
| Decline | CW2-03 §3 status `DECLINED` | **no primitive** | none | `decline_shared_world_invitation_v1` |
| Launch gate | CW2-08 §24–§29, §40 | **none** (Public / Replay seams answer `NOT_EVALUATED`) | none | the minimal Shared-scoped gate (§7) |
| Leave, governance, settings, history, closure, material | CW2-03 | `0083`–`0090` | none | **nothing** — untouched (S4-02 / S4-03) |
| Global Switcher, navigation family | I-08A4 §3–§6; G1.2 §3; P2 §5; P4-C1 SW-3; CW2-07 | — | no production switcher; P2 nav glyphs not ported (VPORT-02 G-14) | the first production switcher, `navMine` / `navShared` generated from P2-A `sig.mjs` |
| Settings | P1 §8.1 (Shared ID in Account & Identity) | — | ONE General Settings destination (W3) | one real Shared ID row + page in the same destination |

**No parallel model:** no second World, membership, invitation, history, material or authority table exists. The
`shared_private` tables are a sealed value, the gate state, its audit, the birth's bound snapshot and decline
idempotency — none of which existed.

## 4. Product authority map

Consumed and not reopened: CW2-01, CW2-02, CW2-03, CW2-07, CW2-08 (+ CW2-08A), the Shared World Product Definition,
I-04, I-08A4, G1.2 §3, P1 §5 / §8 / §13, W3-PDG-01 §4, P2 §5 / §10, P3 §3, P4-C1 SW-3, and the S4-01 Task Contract's
approved decisions.

**One naming reconciliation, not a conflict.** The Task Contract names the Personal destination "My World". The frozen
shell (I-08A4 §3 / §8 / §9; rejected list §19 "mandatory `MY_WORLD` user taxonomy") names it «قنديل» / **QANDEEL**, and
the P2-A rail draws exactly that word above `navMine`. The code keeps `MY_WORLD` as the internal context identifier
(CW2-07 §3) and the switcher shows the canonical word; no name was invented.

## 5. Database — migration `0138` (forward-only)

`database/migrations/0138_shared_world_reachability_invitation_birth_v1.sql`. Every privileged part lives in the
non-exposed `shared_private` schema (pinned `SECURITY DEFINER`, `auth.uid()`-derived); every exposed function is a
`SECURITY INVOKER` one-liner granted to `authenticated` only. Historical migrations `0001`–`0137` are byte-unchanged.

| Part | What it does |
|---|---|
| `shared_id_sealed_values` | the CURRENT Shared ID as AES-256-GCM ciphertext + nonce + tag + key version, bound to the exact epoch and `sid1:` reference; `ON DELETE CASCADE` with the account; no clear column |
| `rotate_own_sealed_shared_id_v1` | first setup / regeneration: hands the derived reference to the frozen `0081` rotation (lock, epoch, invalidation) and upserts the sealed value for exactly that epoch — ONE transaction; a FIRST Shared ID is refused while the invitation capability is closed; regeneration of an existing one is always allowed |
| `read_own_shared_id_v1` | `ABSENT` / `SEALED` (only for the exact current epoch AND reference) / `UNSEALED` |
| `submit_shared_world_invitation_v1` | normalizes server-side; answers **one** outcome, `SUBMITTED`, for a person, nobody, a retired ID, the caller's own ID and a duplicate; `INVALID_SHARED_ID` only for a malformed value; `UNAVAILABLE` when the capability is closed; no World |
| `decline_shared_world_invitation_v1` | exact invitee only; credential row then invitation row (the canonical lock order); terminal `DECLINED`; idempotent; no World, no membership |
| `accept_shared_world_invitation_v1` | binds the birth gate snapshot `FOR SHARE`, refuses on DENY before any write, invokes the frozen `0082` core under the caller's own `auth.uid()`, writes the bound snapshot beside the World; idempotent by command and by invitation |
| reads | current Worlds (open episode + `ACTIVE`), their current members' Names, incoming `PENDING` invitations at the current epoch with the inviter's Name, the exact-World entry verdict (`ALLOW` / one neutral `UNAVAILABLE`) |
| **legacy path retired** | `REVOKE EXECUTE … FROM authenticated` on `rotate_shared_world_invite_credential_v1` and `submit_shared_world_direct_invitation_v1` — a privilege adjustment; bodies, epoch law and lock order unchanged |

**Historical verifiers re-anchored, not weakened.** Because `0138` retires the client grant, the frozen verifiers that
built fixtures through it (`verify-migration-0083` … `0090`, `0129`) now drive the frozen commands as the database owner
with the exact human's claims — the same server-owned path the `0082` verifier always used. `verify-migration-0081`'s
ACL leg now asserts that **no** application role executes either command (catalog and a real `42501`); every behavioural
proof it makes is unchanged.

## 6. Shared ID storage, rotation and key provisioning

- **Value:** 12 Crockford base-32 characters, `XXXX-XXXX-XXXX`, drawn by the API from Node's strong random source
  (`randomInt`, 60 bits) — never chosen by a client through the Product. Lookup stays 0129's `sid1:` SHA-256 reference.
- **Seal:** AES-256-GCM in the API (`apps/api/src/shared-world/shared-id-sealing.ts`); additional authenticated data
  `qandeel.shared-id.v1|<user>|<epoch>|<key version>`. The database stores and returns bytes it cannot open.
- **Read:** the API opens the sealed value and shows it ONLY if its plaintext re-derives the exact reference the database
  holds; anything else fails closed (503) and is never silently replaced.
- **Rotation:** one database transaction moves the reference, the epoch, the PENDING invalidation and the sealed value
  together. A credential rotated outside this path (pre-S4-01, or the no-role `0129` server function) reads as `UNSEALED`
  and is replaced by a fresh sealed one — never served stale.
- **Key material:** `QANDEEL_SHARED_ID_SEALING_KEYS=1:<base64 32 bytes>[,2:…]` and
  `QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION` — server secret configuration only (named, never valued, in `.env.example`).
  Older versions keep opening stored values after the active version moves. Absent or malformed configuration fails the
  Shared ID routes closed; no clear fallback exists. Production custody and rotation runbook: **`QAN-BL-LAUNCH-03`** (§16).
- **Residual stated plainly:** the sealing RPC is reachable with the reader's own token through the Data API (the
  repository's owner-RPC pattern). A person who bypasses the app can therefore choose their own canonical Shared ID or
  store a seal the server cannot open — affecting only their own reachability (format and uniqueness are enforced by the
  database; an unopenable seal fails closed).

## 7. The minimal Shared launch gate

- Two capability scopes, `SHARED_DIRECT_INVITATION` and `SHARED_DIRECT_WORLD_BIRTH`, each one server-canonical row:
  feature-flag state, mandatory launch-requirement state, monotonic restriction version, actor and basis, audited
  append-only. Written only by `shared_private.set_shared_launch_capability_v1`, which **no application role** executes.
- **ALLOW** = `ENABLED` and (`SATISFIED` or `WAIVED_BY_AUTHORIZED_GOVERNANCE`). Everything else denies: an absent row
  (UNCONFIGURED), UNKNOWN, UNSATISFIED, DISABLED, INTERNAL / LIMITED_ROLLOUT (no cohort runtime — no permissive guess),
  EMERGENCY_DISABLED (CW2-08 §40).
- **Bound before the irreversible commit** (CW2-08 §25 / H18): the acceptance holds the birth row `FOR SHARE`, so an
  emergency disable either commits first (no birth) or waits for the birth; the snapshot is recorded with the World.
- **No migration opens it.** Production Shared stays closed until an operator configures it — and Account Deletion
  across Connected Worlds (`QAN-BL-ACCT-01`) is a stated launch prerequisite. This is not a generic Safety / Moderation /
  Commercial platform: report / block / moderation / entitlement stay with `I-09` / `CW2-08`.

## 8. API boundary — `apps/api/src/shared-world/`

| Route | Rate class | Answer |
|---|---|---|
| `GET /shared` | AUTHENTICATED | capabilities (presentation hints), Worlds (members: Name + self), invitations (inviter Name) |
| `GET /shared/identity` | AUTHENTICATED | `READY` + Shared ID (provisioned on first read while open) or `UNAVAILABLE` |
| `POST /shared/identity/regenerate` | SECURITY_SENSITIVE | `{ commandId }` → the new Shared ID |
| `POST /shared/invitations` | SECURITY_SENSITIVE | `{ commandId, sharedId }` → `SUBMITTED` / `INVALID_SHARED_ID` / `UNAVAILABLE` |
| `POST /shared/invitations/:id/accept` | AUTHENTICATED | `BORN` + worldId / `UNAVAILABLE` / `NOT_ACCEPTABLE` |
| `POST /shared/invitations/:id/decline` | AUTHENTICATED | `DECLINED` / `NOT_DECLINABLE` |
| `GET /shared/worlds/:worldId` | AUTHENTICATED | `ALLOW` + world shell (members) / `UNAVAILABLE` |

Identity is the verified token only; no route takes a user id, inviter, target or World authority; no server channel is
used; nothing is logged. Module composed before `AccountModule`.

## 9. Mobile surfaces and navigation

- **Global Switcher** (`shared-world/GlobalSwitcher.tsx`): «قنديل» / QANDEEL and «العالم المشترك» / Shared World; SW-3
  Keyed Seam (plate, top hairline seam, SELECTED cell's seam thickened to the E1R marker + word weight; Brass identical at
  every state); P2 `navMine` / `navShared` above the word (decorative, never mirrored); radios with selected state; 44 pt.
  At the Conversation depth only — never in the Analysis, never over Settings / Understanding / Activity. No Public
  destination. Switching is not pushing.
- **State independence** (CW2-07 §4–§7, §21): the Shared area is drawn OVER the still-mounted Personal world (hidden from
  touch and assistive technology), so My World returns exactly as left; the Shared area is handed `controller`,
  `language`, `insets` and the Activity entry — no store, Session, camera, focus or time — so nothing Personal transfers.
  The Shared controller keeps the area's own viewer-scoped place; re-entry restores it **after** authority is resolved
  again (CW2-07 §43).
- **Authority-first entry** (CW2-07 §19–§20): until `ALLOW`, only a neutral transition shell (no Name, member, title or
  welcome); a denial is one neutral "not available".
- **Root:** current Worlds (birth order — no ranking), incoming invitations (inviter Name, Accept / Decline), ONE
  invite / create action (absent, with a calm notice, while Shared is not open); the one global Activity entry.
- **World shell:** the World's label (the other members' Names), current members (the reader as «أنت» / You), QANDEEL's
  approved welcome. No composer, no messages, no history, no setup.
- **Shared ID:** General Settings → Account & Identity row → page: value (one LTR isolate), Copy (`expo-clipboard`,
  Expo SDK 57's bundled module), privacy explanation, Regenerate behind a confirmation that says what stops working and
  what does not. Read only when the page opens.
- **Back:** local — inside a World to the Shared root; at the root nothing listens, so Back never returns to Personal.

## 10. Privacy / authority invariants — where each is proven

| Invariant (Task §9) | Proof |
|---|---|
| Shared ID not searchable; invalid IDs do not enumerate; no probing through responses | verifier 0138 §invitation; API spec; contract §2 |
| Acceptance exact-target only; no World before acceptance; birth atomic | verifier 0138 §birth (counts, episodes = exactly inviter + invitee, evidence, invitation ACCEPTED) |
| Retry births nothing new | verifier 0138 (same command / another command / concurrent identical) |
| Current membership controls entry; former ≠ current | verifier 0138 §former membership (a real `0083` leave) |
| No Personal access by existing; no coordinate / time / focus transfer | contract §4; integration test Journey C (store identity unchanged, no re-read) |
| No destination content before ALLOW | integration + surface tests; device legs `*-journey-c` |
| No ranking / hidden placement | reads ordered by birth / join time; surface test |
| Shared state never overwrites My World | Journey C integration + device |
| No broad application table access | verifier 0138 §boundary; migration self-assertions |
| Legacy rotation cannot desynchronize | verifier 0138 (authenticated → `42501`; `UNSEALED` never served) |

## 11. Account deletion — not absorbed

Lazy provisioning: a Shared ID (a `0081` credential row, `ON DELETE RESTRICT`) is created only on the owner's first
Shared ID read, and only while Shared is open. An account that never reaches Shared gains no Connected Worlds reference.
Once one exists, the Personal deletion (`0130`) truthfully marks a deletion `BLOCKED` exactly as it does for any
Connected Worlds participant today — `QAN-BL-ACCT-01` is unchanged and not solved here.

## 12. Out of scope — untouched

Shared text / voice / QANDEEL material sending; multi-human attribution; live calls; leave / remove / rejoin / settings /
history / closure UI; Public World; Matching; Introductions; Replay; Shared Activity producers and notification
integration; the full Safety / Moderation / Commercial platform; account deletion across Connected Worlds
(`QAN-BL-ACCT-01`); the Public DRAFT derivative gap (`QAN-BL-CW-01`). None was a blocker.

## 13. Validation — QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE

**VAL-01 plan for this delta** (planner rules, `scripts/validation/change-planner.mjs`): the delta touches `database/`,
`apps/api/`, `tests/`, `apps/mobile/` (JS + one dependency), `scripts/validation/`, `scripts/phase-m/` and
`.github/workflows/` → **every gate RUNs** (API_HEAVY, MOBILE_CONTRACT, MOBILE_NATIVE_BINARY); no carry-forward is
possible for a head with these paths. The native fingerprint moves (mobile JS, the lockfile), so Mobile CI and the S4
producer build once per moved fingerprint; a later flow-only or runner-only change reuses the binary (`prior-run`).

| Gate / leg | Why selected |
|---|---|
| Focused DB verification `migration-0138`, `migration-0081` | the new migration; the re-anchored historical ACL leg |
| API CI (all verifiers, API unit, database statics, root contracts) | `database/**`, `apps/api/**`, `tests/**` |
| Mobile CI (contracts, typecheck, lint, Jest, prebuild, Android + iOS build + boot smoke) | `apps/mobile/**`, lockfile |
| S4 proof legs `ar-journey-a`, `ar-journey-b`, `ar-journey-c`, `en-journey-c` | the four Task §12 journey legs (Journey C in both scripts) |
| **Not run** | the A3 proof suite (no A3 flow, runner or Activity/Push code changed; its legs would only repeat green proof) |

**Local results (this workstation, before push):** database statics `node --test database/tests/*.test.mjs` pass (incl.
the new 0138 contract); `verify:db:hazards` 0 findings; API Jest `shared-world.spec.ts` + route census pass; `tsc` (API,
mobile) clean; mobile lint clean for every S4-01 file; mobile Jest: all S4-01 suites pass; the full mobile suite's only
failures are the six host-locale tests the A3-02 record already names (`depth`, `w2-account-access`; this host resolves
Arabic) — classified ENVIRONMENT, untouched by S4-01; root contracts — see the PR conversation for the final run.
Real PostgreSQL is not available locally; it is proven in CI (§14).

## 14. Real-PostgreSQL and device evidence, and failure classification

| Run | Result | Classification / action |
|---|---|---|
| Focused `migration-0138` #1 (`eb261f7`) | FAIL at invitation stage, `42501` | **VALIDATION / PROOF** — the verifier read fixture counts while acting as `authenticated`; fixed in the verifier, no Product change |
| Focused `migration-0138` #2 (`fa50f52`) | FAIL in concurrency, `42501` (message hidden) | **UNKNOWN → fail-safe**; the verifier was changed only to keep the failing stage and print the database refusal |
| Focused `migration-0081` (`fa50f52`) | **PASS** | — |
| Focused `migration-0138` #3 (`fbfe803`) | FAIL, "permission denied for table shared_world_direct_invitations" | **VALIDATION / PROOF** — a fixture read after switching the transaction to the invitee (server log statement) |
| Focused `migration-0138` #4 (`8deccac`) | FAIL, same | the earlier role-reset fix was not the cause; the same ordering defect located at its exact line |
| Focused `migration-0138` #5 (`9048d6d`) | **PASS** — every stage including concurrency | — |

No run was repeated blindly: every rerun followed a classified, committed fix to the verifier.

**PR CI cycle.** Every push after the first was a single commit fixing failures already read from their exact logs and
classified; no workflow was re-run to obtain a different answer, except the one infrastructure retry below.

| Head | Failure (exact) | Classification | Correction |
|---|---|---|---|
| `b760674` | API CI `verify-migration-0082`: `42501` on the retired 0081 rotate command | VALIDATION / PROOF | fixture setup re-anchored to the owner identity; every ACL assertion kept; 0081 / 0082 untouched |
| `b760674` | S4 Journey C (ar + en): `assertNotVisible` on the still-mounted Personal thread | VALIDATION / PROOF | assertion replaced by selection / reachability proof; Product composition unchanged |
| `b760674` | S4 Journey B: no Account & Identity group, so no Shared ID row | VALIDATION / PROOF fixture gap | the proof world answers the signed-in account reads; focused test |
| `7311d80` | T-12P: deep import of the runtime entry in the new proof test; T-12 Phase M #611: an Email default inside `__validation__/` | VALIDATION / PROOF (deterministic contracts) | public barrel client; synthetic identity moved to `__fixtures__/`; no contract exception |
| `4779fc8` | S4 Journey C (ar + en): `assertNotVisible qandeel-shared-members` raced the stand-in's timed 1.5 s ALLOW | VALIDATION / PROOF (timing race) | deterministic hold until `qandeel://s401-proof/world/allow`; focused test |
| `77a2c4c` | S4 Journey B: the malformed-ID field empty after typing into the field the successful send had just cleared | VALIDATION / PROOF (device input) | a fresh invite session, the value asserted in the field before Send; focused test |
| `77a2c4c` | API CI `verify-migration-0133`: census measured pre-0133 against the latest CI ACL, which 0138 deliberately narrowed | VALIDATION / PROOF (stale historical verifier) | census measured before0133 → after0133; hosted == CI kept; downstream 0133–0138 audit found nothing else |

**Exact head `ada631562686c7e05f607c5a4e0ce73664c1eed4`.**

| Workflow / gate | Result |
|---|---|
| API CI `37298360081` | **PASS** — forward-safety gate; verifiers `0082`, `0133` (historical census), `0134`, `0135`, `0136`, `0137`, `0138`; runtime smokes; PostgREST refusal proof |
| S4 proof `37298356374` | **PASS** — producer build; `ar-journey-a`, `ar-journey-b`, `ar-journey-c`, `en-journey-c` |
| Mobile CI `37298360178` | fast contracts, Android Release build, Android boot smoke, iOS Release simulator build and iOS artifact provenance **PASS**; iOS boot smoke **FAIL — persistent infrastructure** (below); its `Validation evidence (VAL-01)` job is red only as the dependent record of that gate |

**The persistent iOS exception.** Both attempts of Mobile CI `37298360178` failed the iOS boot smoke at the same step,
`Maestro driver readiness (bounded)` (`maestro hierarchy`, 300 s bound), with the same
`xcuitest.installer.LocalXCTestInstaller$IOSDriverTimeoutException: iOS driver not ready in time` — attempt 1 after a
3 min 36 s simulator boot and install, attempt 2 (failed jobs only, the same exact-head simulator artifact, no rebuild)
after 2 min 46 s. That step only starts Maestro's XCTest driver on the booted simulator: **the app was never opened in
either attempt**, and the boot smoke itself was skipped. The iOS Release simulator build and its artifact provenance
passed in the same run. The immediately prior branch head `77a2c4c` (run `37293964488`) passed the identical step and
boot smoke, and no file of the `77a2c4c → ada6315` delta reaches the iOS app or the Maestro driver set-up.
Final classification: **PERSISTENT INFRASTRUCTURE — NOT PRODUCT / NOT VALIDATION LOGIC.**

**VAL-01 retry budget.** The one infrastructure retry was used (attempt 2) and the budget is exhausted; **no second retry
was performed**. No timeout, workflow or Product change was made to turn the check green. The follow-up is
`QAN-BL-CI-01` (`CI-IOS-01 — Maestro / XCTest Driver Startup Reliability`), outside S4-01's scope (§16).

## 15. S4-01 Product Copy Gate

**CLOSED — Product Owner, 2026-10-05.** Every string in `apps/mobile/src/shared-world/copy.ts` is CANON or APPROVED; none
is PROPOSED, and `SHARED_COPY_GATE` states the gate closed. Bound byte-for-byte and pinned by the S4-01 contract: the
CANON names («قنديل» / QANDEEL, «العالم المشترك» / Shared World), the two Task-Contract APPROVED meanings (the invitation
with the inviter's real Name; the welcome), and the three rows the Product Owner amended when closing the gate:

| Row | Retired | Final |
|---|---|---|
| `declined` (ar) | «رُفضت الدعوة.» | «تم رفض الدعوة.» |
| `invalidSharedId` | «هذا لا يبدو معرّفًا مشتركًا.» / "That doesn't look like a Shared ID." | «تأكد من المعرّف المشترك وحاول مرة أخرى.» / "Check the Shared ID and try again." |
| `switcherLabel` (accessible name only, never drawn) | «العوالم» / "Worlds" | «التنقل بين قنديل والعالم المشترك» / "Switch between QANDEEL and Shared World" |

Every other row — the invite field, the non-enumerating confirmation, Accept / Decline, the neutral unavailable line, the
Shared ID page (privacy explanation, Copy, Regenerate and its warning), the not-open notices — is APPROVED as drawn. The
closure is copy-only: no behaviour, surface or scope changed. Journey B's malformed-ID assertion
(`scripts/phase-m/run-s401-proof-leg.sh`) follows the amended Arabic sentence.

## 16. Backlog reconciliation (BG-05 / BG-08)

- **Inherited:** none. No backlog item names S4-01.
- **Reopen condition observed:** `QAN-BL-ACCT-01` ("a task to take any Connected World toward production-ready for
  users"). Disposition: stays `OPEN — UNASSIGNED`, unchanged in scope; S4-01 claims no production readiness, ships the
  gate closed, and records Account Deletion across Connected Worlds as a launch prerequisite of the Shared capability. A
  current-truth note is added to the item.
- **Admitted (BG-06, a genuine external dependency):** `QAN-BL-LAUNCH-03` — Shared ID Sealing Key: production custody,
  provisioning and rotation — owner `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate`, `MEDIUM`,
  `DEFERRED — OWNED`.
- **Admitted (BG-06, reviewer-designated follow-up):** `QAN-BL-CI-01` — iOS simulator Maestro / XCTest driver startup
  reliability in Mobile CI — owner `CI-IOS-01 — Maestro / XCTest Driver Startup Reliability`, `MEDIUM`,
  `DEFERRED — OWNED`. Not part of S4-01's scope (§14).
- **Unchanged:** `QAN-BL-CW-01`, `QAN-BL-NOTIF-02` … `05`, `QAN-BL-VOICE-01`, every other item.

## 17. Stage-4 Gap Matrix

Classes: (1) already closed · (2) implemented here · (3) in-scope gap fixed here · (4) owned by an existing backlog item ·
(5) true dependency with a named owner · (6) not an obligation.

| # | Candidate | Source | Class | Disposition |
|---|---|---|---|---|
| G-01 | Shared World reachability / root (`E2E-G-01`) | Task §1.7, §8.2 | 2 | §9 |
| G-02 | Invite with a Shared ID (`E2E-G-02`) | Task §1.3 | 2 | §5, §8, §9 |
| G-03 | Receive, accept, decline (`E2E-G-03`) | Task §1.4, §7.4 | 2 | decline primitive added (§5) |
| G-04 | Birth and welcome (`E2E-G-04`) | Task §1.5–§1.6 | 2 | World shell; the final birth-scene graphic (Product definition §7, §25) → **S4-03** |
| G-05 | Shared conversation / attribution (`E2E-G-05`) | Task §10 | 5 | **S4-02 — Shared Conversation & Material** |
| G-06 | Shared voice notes (`E2E-G-06`) | E2E row | 4 | `QAN-BL-VOICE-01` (with S4-02) |
| G-07 | Human live call (`E2E-G-07`) | CW2-03 §42 | 5 | `CW-I09` / pre-launch (unchanged) |
| G-08 | Standing context in a World (`E2E-G-08`) | E2E row | 5 | **S4-02** |
| G-09 – G-13 | Add / remove / rejoin, settings, history, leave, closure (`E2E-G-09` … `G-13`) | Task §10 | 5 | **S4-03 — Shared Membership Lifecycle & Governance** |
| G-14 | Delete own material (`E2E-G-14`) | E2E row | 5 | **S4-02**; `QAN-BL-CW-01` before Public drafts open |
| G-15a | Cross-World entry through the switcher, authority-first (`E2E-G-15`, the part here) | CW2-07 §19 | 2 | §9 |
| G-15b | Direct Entry into a Shared World from a link / notification | `E2E-G-15`; A3-01 G-15 | 5 | **S4-04 — Shared Activity, Notifications & Direct Entry** |
| G-16 | Shared Activity producer; per-World mute rows | A3-01 G-15 | 5 | **S4-04** (Exit Gate: publishes through `ActivityPublisher`) |
| G-17 | Permission education at first Shared entry | A3-02 G-12; P3 §11 | 5 | **S4-04** (Exit Gate: `push.offer(...)` at first entry) |
| G-18 | Restricted states; report / block (`E2E-G-16`, `G-17`) | CW2-08 §14, §44 | 5 | `CW-I09` / `CW2-08` (unchanged) |
| G-19 | Former member's own-material control (`E2E-G-18`) | CW2-03 §24 | 5 | **S4-03** (PO decision) |
| G-20 | Shared ID see / copy / regenerate (`E2E-D-08`) | P1 §5; W3-PDG-01 §4 | 2 | §6, §9 — the W6 surface |
| G-21 | Global Switcher (`E2E-B-01`) — QANDEEL + Shared World | I-08A4 §3; P4-C1 SW-3 | 2 | §9; the Public World destination → **Stage 5** |
| G-22 | P2 navigation family in production | VPORT-02 G-14 | 2 | `navMine`, `navShared` generated from `sig.mjs`; `navPublic` → Stage 5 |
| G-23 | Production enablement of the Shared launch gate; the full CW2-08 platform | CW2-08 | 5 | `I-09` / `CW2-08` launch work; prerequisite `QAN-BL-ACCT-01` |
| G-24 | Shared ID sealing key custody / rotation in production | §6 | 4 | **`QAN-BL-LAUNCH-03`** (admitted) |
| G-25 | World-Transition motion review (CW2-07 §41, §49) | CW2-07 | 5 | **S4-03** (a neutral cut ships; Reduce Motion parity holds) |
| G-26 | iOS device journeys | §14 | 5 | Mobile CI iOS build + boot smoke here; physical / iOS journey legs → `Release Hardening & Launch — physical iOS / Android device validation` |
| G-27 | PROPOSED copy rows | §15 | 1 | the S4-01 Product Copy Gate is CLOSED (Product Owner, 2026-10-05); none remains PROPOSED |
| G-28 | Six host-locale mobile Jest tests | host | 6 | environment; identical on the baseline |
| G-29 | Mobile CI iOS boot smoke: persistent Maestro / XCTest driver-readiness timeout on the exact head | §14 | 5 | **`QAN-BL-CI-01`** (admitted; `CI-IOS-01`) |

The S4-02 / S4-03 / S4-04 names are the Task Contract's own sequencing labels; each opens only through its own Task
Contract.

**Orphan gaps = 0.**

## 18. Stage-4 status

- ✔ the production Global Switcher reaches the Shared World; the root is real
- ✔ Shared ID obtained / copied / regenerated safely; lookup non-enumerating
- ✔ outgoing and incoming invitations real; decline real and creates no World
- ✔ acceptance launch-gated; births exactly one World atomically; immediate entry
- ✔ My / Shared state independence; multiple Worlds representable; no Shared conversation faked
- ✔ historical migrations untouched; no duplicated Shared model; no account-deletion scope absorbed

**Stage 4 stays ACTIVE** — S4-02 / S4-03 / S4-04 remain (§17).
