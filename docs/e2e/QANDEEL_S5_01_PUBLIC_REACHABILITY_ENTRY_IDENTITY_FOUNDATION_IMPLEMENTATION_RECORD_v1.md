# QANDEEL — S5-01 Public Reachability, Entry & Identity Foundation — Implementation Record v1

**Task:** `S5-01 — Public Reachability + Entry + Identity Foundation` (Stage 5 — Public World Product Integration; the first
Stage-5 task)
**Task Contract:** the Product Owner's S5-01 Task Contract (2026-10-06)
**Canonical baseline:** `5cf98a267d9eed7e9019f0ca5ed93bd8884a1b36` (the merge of PR #313, S4-04)
**Branch:** `feat/s5-01-public-reachability-entry-identity`
**Status:** **`S5-01 IMPLEMENTED — REVIEW CANDIDATE (Draft PR) — S5-01 PRODUCT COPY GATE CLOSED — NOT MERGED`**.
Claude does not merge it.

> Public World becomes the third real Global Switcher destination. Entering it asks the server, NOW, whether the
> authenticated reader may enter under the CURRENT Public audience policy — the neutral pre-authority shell until ALLOW,
> then a structurally real, truthfully content-empty Public root. `qandeel://public` enters through the same controller.
> The account's Public ID is bound to the frozen I-05 Public display model: the reader chooses only a mode — PSEUDONYM
> (the CURRENT Public ID) or REAL_NAME (the CURRENT Name) — in General Settings → Account & Identity, and no rendering can
> go stale. Nothing is published, drafted, served, searched, placed, discussed or launched.

---

## 1. Baseline / branch / PR / head

| | |
|---|---|
| Baseline | `5cf98a267d9eed7e9019f0ca5ed93bd8884a1b36` — `origin/main` confirmed equal at kickoff, working tree clean (`main` had not moved) |
| Branch | `feat/s5-01-public-reachability-entry-identity`, cut from `origin/main` |
| PR | `S5-01 — Public Reachability, Entry & Identity Foundation` — a Draft PR opened at the first push (number in the PR conversation) |
| Head | the commit carrying this record; the exact SHA is reported in the PR and the completion report |
| Migration | `0142_public_world_entry_identity_product_v1.sql` (the highest on `main` was `0141_shared_activity_notifications_v1.sql`) |

## 2. Anti-Duplication Gate

| Need | Existing authority / runtime | Gap | What S5-01 adds |
|---|---|---|---|
| Global Switcher / shell area | `GlobalSwitcher` (S4-01, SW-3 Keyed Seam), the area state in `DepthComposition` (local, never persisted), the Shared overlay pattern | two destinations; the source comment says Public waits for its stage | the third item (typed `PUBLIC_WORLD`), the Public overlay beside the Shared one; no second switcher, rail or tab bar |
| P2 `navPublic` | frozen in P2 §5; the source is `P2-A …/source/src/sig.mjs` `navPublic`; the generator already executes `navMine` / `navShared` | not emitted | the generator executes `SIG.navPublic(OPEN, 24)` exactly as it does the others; nothing is drawn by hand |
| Public entry authority | I-05: the `0091` singleton `public_world_state`, the `0091` `public_audience_policy_state` (`REGISTERED_ONLY` / `UNRESOLVED`), the `0095` gate `resolve_public_audience_admission_v1` (executable by nobody) | no application boundary asks it | ONE owner command composing the frozen gate (§4.1); no second policy |
| Runtime entry / link inbox | the Shared link source over RN `Linking`, the S4-04 inbox pattern, signed-out drop | no Public link | `qandeel://public` (exact) through the SAME source and the same drop rule; a one-slot inbox |
| Shared pre-auth transition pattern | `SharedWorldArea`: resolve first, neutral shell until ALLOW, one neutral refusal | — | the same law in `PublicWorldArea` and its own controller; nothing is shared with the Shared controller |
| Account Public ID | W3-02 (`0125`): `public.users.public_id`, `read_own_public_id_v1`, the one lifetime change; the Name (`0123` / `0129`) | I-05 `PSEUDONYM` not bound to it (`E2E-H-08`) | ONE derivation from the account row and a sync into an existing I-05 display row (§4.1) |
| I-05 public identity | `public_identities` (one per account, opaque ref, `ON DELETE RESTRICT` to the account), `public_identity_display_state`, `ensure_public_identity_v1` / `update_public_display_label_v1` (executable by nobody; caller-supplied label) | nothing reaches them; provisioning one would block the governed Personal erasure (`0130`) | no identity is provisioned; no frozen primitive is granted or called; the mode is an account-scoped preference that cascades |
| Route rate-limit census | `ROUTE_RATE_LIMIT_CENSUS` + its AppModule walk | three new routes | three `AUTHENTICATED` rows; no new class |
| Persistence / restoration | the area is never persisted (S4-01); T-13 recovery holds no area | — | nothing: a restart lands on the Personal world, so no restored value is ever authority |

## 3. Authority map

| Subject | Authority (binding) |
|---|---|
| Three first-class areas; switching ≠ pushing; Direct Entry precedence | I-08A4 §3–§5 (and its §8 / §9 names) |
| Public World is one World, a genuine transition, its own viewer state | CW2-04 §1; CW2-07 §23–§24; I-05 (`0091` singleton) |
| Content renders only after the current audience policy allows | CW2-07 §25; CW2-04 §11 / D13 |
| Signed-out viewing unresolved, fail-closed | CW2-04 §36; CW2-08 §31 / §40 / §44; `0091` (`UNRESOLVED`) |
| Public identity: stable ref, mutable label, alias non-semantic, no contact route | CW2-04 §9, §10, §23 / D10–D12; P1 §6 |
| PSEUDONYM = Public ID, REAL_NAME = Name, choice in Account & Identity, no Public Settings page | P1 §6, §8.1 |
| Navigation glyphs | P2 §5, §10 |
| Launch / Safety stays fail-closed | CW2-08; `resolve_public_publication_prerequisites_v1` (`NOT_EVALUATED`) |
| The Public runtime itself | `database/README.md` (I-05, `0091`–`0099`) and the backlog's I-05 closure record |
| Patterns consumed | S4-01 … S4-04 records (the switcher, the authority-first shell, the link inbox, the copy-gate discipline) |

## 4. Implementation

| Layer | Files |
|---|---|
| Database | `database/migrations/0142_public_world_entry_identity_product_v1.sql`; `database/verify-migration-0142.mjs`; `database/README.md` (S5-01 section) |
| API | `apps/api/src/public-world/` — `public-world.module.ts`, `public-world.controller.ts`, `public-world.service.ts`, `public-world.repository.ts`, `public-world.spec.ts`; `app.module.ts` (composes `PublicWorldModule`); `http-security/route-rate-limit.census.ts` (three rows) |
| Mobile — Public area | `apps/mobile/src/public-world/` — `public-world-controller.ts`, `PublicWorldArea.tsx`, `public-link.ts`, `copy.ts`, `index.ts`, `__tests__/public-world.test.tsx`; `runtime-entry/public-world-api.ts` (+ `index.ts`, `mobile-runtime-entry.ts` `publicWorldFor`) |
| Mobile — shell | `shared-world/GlobalSwitcher.tsx` (third destination); `iconography/NavGlyph.tsx`, `iconography/index.ts`, `iconography/p2-production.generated.ts` (regenerated), `scripts/generate-p2-production.mjs`; `activity/presentation.ts` (`PUBLIC_WORLD` surface); `integration/composition/DepthComposition.tsx` (the Public overlay, the link consumer); `integration/runtime/integration-runtime.ts` (controllers, inbox, drop) |
| Mobile — Settings | `settings/public-display-controller.ts`, `settings/PublicDisplaySection.tsx`, `settings/SettingsSurface.tsx` (inside Account & Identity) |
| Device proof | `apps/mobile/.maestro/s5-01-journey-a.yaml`; `scripts/phase-m/run-s501-proof-leg.sh`; `.github/workflows/s5-proof.yml`; `scripts/validation/proof-suites.mjs` (`s5`); `integration/__validation__/S401ProofRoot.tsx` + `s401-proof-world.ts` (the Public hook) |
| Tests / contracts | `tests/s5-01-public-reachability-entry-identity-contract.test.mjs`; `integration/__tests__/s5-01-public-world.test.tsx`; re-anchors listed in §10 |
| Governance | this record; `docs/qandeel-canonical-backlog-v1.md`; `QANDEEL_CURRENT_STATE.md`; `QANDEEL_PROJECT_MAP.md`; a current-truth note in the W3-02 record §11 |

### 4.1 Migration `0142` — grant map

New schema `public_world_private` (owner `postgres`; `REVOKE ALL FROM PUBLIC`; `USAGE` to `authenticated` only, for the
INVOKER wrappers). One table, `account_public_display_choices (user_id → public.users ON DELETE CASCADE, label_mode,
choice_revision, updated_at)`: RLS on, zero policies, no grant to any role. No row = `PSEUDONYM`.

| Function | Kind | Executable by |
|---|---|---|
| `public_world_private.derive_account_public_display_v1(uuid)` — the ONE derivation: mode from the choice, label from the account row (Public ID without `@`, or Name) | DEFINER, pinned | nobody |
| `public_world_private.sync_account_public_display_v1(uuid)` — if an I-05 identity exists, make its display row equal the derivation (new `label_revision`); refuse an unrepresentable label (P0001) | DEFINER, pinned | nobody |
| `public_world_private.sync_public_display_after_account_change_v1()` — trigger `AFTER UPDATE OF public_id, name ON public.users` | DEFINER, pinned | nobody |
| `public_world_private.read_public_world_entry_v1()` → `ALLOW` / `UNAVAILABLE`; 42501 without an identity; composes `resolve_public_audience_admission_v1(auth.uid())` | DEFINER, pinned | `authenticated` |
| `public_world_private.read_own_public_display_v1()` → mode, derived label, whether a Name exists | DEFINER, pinned | `authenticated` |
| `public_world_private.set_own_public_display_mode_v1(text)` → UPDATED / UNCHANGED / UNAVAILABLE (no Name); 22023 for anything but the two modes | DEFINER, pinned | `authenticated` |
| `public.read_public_world_entry_v1()`, `public.read_own_public_display_v1()`, `public.set_own_public_display_mode_v1(text)` | INVOKER one-liners | `authenticated` |

No frozen primitive is granted, wrapped or called except the read-only audience gate. Deploy-time self-assertions refuse a
client reach to the internal functions, a client reach to the frozen identity / Draft / prerequisite / publish primitives,
a second Public World and a resolved signed-out policy.

## 5. Entry law

1. A switcher tap, a `qandeel://public` link or a previous ALLOW is never authority: every entry (the area's mount, a
   re-entry, a retry, a link while already there) asks `GET /public/entry` again.
2. The server answers from current truth only: the verified token's human, the ONE Public World, the CURRENT policy.
3. Until it answers: `qandeel-public-transition` — the area's ground, an accessible "Opening" (the approved Shared shell
   word), nothing of the destination (no name, no field, no count).
4. ALLOW: the root — the Public World's own name as its title, its own ground, the global Activity entry. Nothing else:
   S5-01 has no Experience, field, feed, ranking or sample to show, and draws none (S5-03 realizes the field).
5. Anything else (refused, unknown, transport failure): one neutral «هذا غير متاح الآن.» / "This isn't available right
   now." with «إعادة المحاولة» / "Try again" — never a reason, a policy or an object.
6. Signed out: there is no Public World; a pending link is dropped and never carried to the next account.
7. Back at the Public root registers nothing (local-only Back; never a silent return to the Personal world).
8. Precedence is unchanged (I-08A4 §5): a valid link is an explicit Direct Entry; there is no restoration of the area; the
   default is the Personal world.

## 6. Public identity law (E2E-H-08)

| Property | How it holds |
|---|---|
| default = the canonical Public ID | no choice row → `PSEUDONYM`; the label is `users.public_id` |
| PSEUDONYM → the CURRENT Public ID; REAL_NAME → the CURRENT Name | derived at every read by one function; never stored as text in S5-01 |
| no arbitrary label, no caller-supplied text | the only input anywhere is the mode (DB: one `text` parameter checked against two values; API: the body's only key is `mode`; mobile: `{ mode }`) |
| switching the mode edits neither the Public ID nor the Name | proven by the verifier (the account row before and after) |
| no stale rendering | Settings re-reads on every draw; an existing I-05 display row is synchronized in the same transaction as the Public ID / Name / mode change |
| alias change ≠ Experience change | the sync writes `public_identity_display_state` alone (no FK to any Experience, version or manifest) — proven by counts and the unchanged ref |
| internal ref never leaves the database | no application boundary (owner command or wrapper) accepts, returns or exposes `public_identity_ref` or `user_id`; the internal, non-executable derivation / sync helpers carry an internal user identity supplied only by `auth.uid()` or the account trigger |
| no lookup / availability oracle; nobody else's state | every command is the caller's own; no parameter can name another account |
| no DM / Shared route | nothing here reads or writes Shared or contact state |
| no Public Settings page | one radio group inside the existing Account & Identity group |

**Why no I-05 identity is provisioned here.** `public_identities.user_id` is `ON DELETE RESTRICT` (`0091`): an identity row
for every reader who opens Public World or chooses a mode would make the governed Personal erasure (`0130`) answer BLOCKED
for an account that has published nothing. The choice is therefore an account-scoped preference that cascades with the
account; the I-05 display row becomes its synchronized projection when an identity exists — the authorship path that
creates one is S5-02's (§12).

**`E2E-H-08` — ADVANCED / S5-02 OWNED — NOT CLOSED** (Product Owner, R1, 2026-10-06). S5-01 establishes the canonical Public display choice, PSEUDONYM → the
CURRENT Public ID, REAL_NAME → the CURRENT account Name, and stale-label synchronization once an I-05 identity exists
(Settings → API → `0142` → the derivation → the I-05 bridge, proven against real PostgreSQL). Because S5-01 deliberately
creates no I-05 Public Identity, the row's final closure belongs to `S5-02`, when the real authorship / Public-Identity
creation path exists and consumes this foundation. S5-01 adds no identity auto-provisioning to close it.

## 7. Privacy / security proof (Task Contract §10)

| # | Criterion | Proof |
|---|---|---|
| 1 | no Public content before ALLOW | `PublicWorldArea` branches; integration A1, unit area test; device leg steps 3–4 |
| 2 | link / switcher / restoration grant nothing | every entry re-asks (integration A3, B1; device step 5–6); the area is never persisted |
| 3 | signed-out fail-closed | 42501 before the gate (verifier, even with a fixture `ALLOWED`); the link is dropped signed out (integration B1) |
| 4 | no Launch / Safety weakening | `0142` never names the prerequisite seam except in its closure assertion; contract §2 |
| 5 | no Draft / publish / discussion / serving authority | verifier: no application role reaches any frozen consequential primitive; contract §2–§3 |
| 6 | no sealed provenance readable | no S5-01 function body names provenance, Experience or derivative relations (verifier, contract) |
| 7 | no private identifier in Public rendering | the label is the Public ID or the Name only; no Login ID, Email, phone, Shared ID or `user_id` is read |
| 8 | no internal ref to mobile | API and mobile decoders have no such field; verifier: returned columns are exactly mode / label / availability |
| 9 | no arbitrary label | the mode is the only input (all three layers) |
| 10–11 | PSEUDONYM / REAL_NAME bound to the current values | verifier `choice` and `bridge` stages |
| 12 | no stale identity | verifier: Public ID change → pseudonym follows; Name change → Name follows; revision not spent when nothing changes |
| 13 | no DM / Shared route | nothing reaches Shared or contact state |
| 14 | area switching changes no Personal / Shared truth | integration A1 / A3 (store identity, Shared place unchanged) |
| 15 | no fake content or geography | content-empty root; contract §5 word scan |

Nothing is logged in the API or the app (no Public ID, Name, mode or verdict).

## 8. Copy census and Product Copy Gate — **CLOSED (Product Owner, 2026-10-06)**

| Key | Surface | Arabic | English | Source | Status |
|---|---|---|---|---|---|
| `publicWorld` | switcher word, Public root title | «العالم العام» | Public World | I-08A4 §8 / §9 | **CANON** |
| `personalWorld`, `sharedWorld` | switcher words | «قنديل» / «العالم المشترك» | QANDEEL / Shared World | I-08A4; G1.2 §3 | **CANON** (unchanged) |
| `opening` | pre-authority shell (accessible name) | «جارٍ الفتح» | Opening | S4-01 Product Copy Gate | **APPROVED** (reused) |
| `worldUnavailable` | neutral refusal | «هذا غير متاح الآن.» | This isn't available right now. | S4-01 Product Copy Gate | **APPROVED** (reused) |
| `retry` | refusal action | «إعادة المحاولة» | Try again | S4-01 Product Copy Gate | **APPROVED** (reused) |
| `pidTerm` | display option | «المعرّف العام» | Public ID | P4-C4 §5 | **APPROVED** (reused) |
| `nameLabel` | display option | «الاسم» | Name | W1B-01 | **APPROVED** (reused) |
| network | a choice that did not go through | «تعذّر الاتصال. حاول مرة أخرى.» | Couldn’t connect. Try again. | T-14 (as W3-02 reuses it) | **APPROVED** (reused) |
| `switcherLabel` | the Global Switcher's accessible name (three destinations), accessible name only | «التنقل بين قنديل والعالم المشترك والعالم العام» | Switch between QANDEEL, Shared World and Public World | the S4-01 approved pattern, extended to the third name | **APPROVED** (Product Owner, 2026-10-06) |
| `displayHeading` | Account & Identity: the heading of the Public display choice | «الظهور في العالم العام» | Shown in Public World as | new (P1 §6 names the control, not its words) | **APPROVED** (Product Owner, 2026-10-06) |

Both new rows live only in `apps/mobile/src/public-world/copy.ts`, each marked `// APPROVED — S5-01 Product Copy Gate
(Product Owner, 2026-10-06)`, and are pinned by the S5-01 contract; the Product Owner approved both exactly as proposed (R1).
The S4-01 two-destination `switcherLabel` row stays in the S4-01 copy module unchanged (its gate is CLOSED); the
switcher's accessible name is the S5-01 one. No other human-visible word is new. No row is PROPOSED.

*S4-04 reconciliation (copy governance only):* the Product Owner also approved the merged S4-04 `joined` row —
«انضم {0} إلى هذا العالم.» / "{0} joined this world." — exactly as merged; `shared-activity-copy.ts` and the S4-04 record now
state that gate CLOSED. S4-04 behaviour and bytes are unchanged.

## 9. What is deliberately NOT implemented (explicit non-scope)

Public Experience Draft, publication-package preparation, approvals / READY_FOR_REVIEW, PUBLISHED, update / republication,
Experience serving, cards or details, semantic placement, search / lenses / panels, vitality, relation lines (S5-02 /
S5-03); replies, voice replies, reactions, Public QANDEEL, a Public Activity producer, Public push (S5-04); any change to
`resolve_public_publication_prerequisites_v1`, CW2-08 safety / moderation / entitlements / Launch Gate, Premium, the
signed-out policy; Matching, Replay, Voice, Public media, Public avatar, historical alias rendering, Public contact,
account deletion across Connected Worlds; `ASSURE-F05` (`QAN-BL-CW-01`, S5-02's). No I-05 identity is provisioned. No
production readiness of the Public World is claimed.

## 10. Validation (local, before the first push)

| Check | Result |
|---|---|
| `node --check database/verify-migration-0142.mjs`; verifier-hazard lint | clean; `database/tests/verifier-hazard-contract-v1.test.mjs` 33 / 33 |
| Real-PostgreSQL verifier `0142` | **CI only** (no PostgreSQL on this workstation; the `.env` database is the hosted project and is never targeted) |
| API `tsc --noEmit` | clean |
| API jest — S5-01 spec + route census | 14 / 14 |
| API jest — full | see §10.1 |
| Mobile `tsc --noEmit` | clean |
| Mobile jest — S5-01 integration (6) + unit (9) | 15 / 15 |
| Mobile jest — re-anchored S4-01 switcher suites | 19 / 19 |
| Mobile jest — full | see §10.1 |
| P2 geometry `generate-p2-production.mjs --check` | current |
| Root contracts | see §10.1 |
| Forward-only | `0001`–`0141` byte-identical to `origin/main`; the I-05 predecessors pinned by content (contract §2) |

**Re-anchors (each B / Validation: the pin asserted the pre-S5-01 baseline that this Task Contract changes on purpose):**
`tests/s4-01-shared-world-reachability-contract.test.mjs` §4 (three destinations); `shared-world/__tests__/surfaces.test.tsx`
and `integration/__tests__/s4-01-shared-world.test.tsx` (three destinations, `navPublic` now emitted);
`tests/w3-02-account-identity-public-id-contract.test.mjs` (the `<SettingsSurface …/>` props gain `publicDisplay`);
`tests/w3-mega-s-personal-controls-settings-contract.test.mjs` (`QAN-BL-CW-01` stays open — now owned, never closed);
`apps/mobile/src/runtime-entry/__tests__/scope.test.ts` (the runtime-entry barrel gains exactly `PublicWorldApiClient`, as A3-02 and S4-01 each added one);
the AppModule blob pins in `tests/historical-projection-contract.test.mjs`,
`tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs` and
`tests/thread-lifecycle-cross-session-continuity-contract.test.mjs` (strip `PublicWorldModule` first, as every module
addition before it did).

**Device proof.** One bounded Android leg, `ar-s501-journey-a` (`s5-01-journey-a.yaml`), in its own VAL-01 suite `s5`
(`s5-proof.yml`, runner `run-s501-proof-leg.sh`) over the S4 proof binary, so the S4 matrix is not re-run for a change it
does not own (Task Contract §9). It covers the seven proof steps: Personal root; three destinations; Public through the
real entry verdict (held until released — never timed); no pre-authority leak; Shared and back with the verdict asked
again; `qandeel://public` through the same controller; the display choice in Account & Identity.

### 10.1 Full-run results (local, on the tree this record is committed with)

| Check | Result |
|---|---|
| Root contracts (`node --test tests/*.test.mjs`, the ignored `apps/mobile/android` moved aside) | **1179 / 1179** |
| Static database tests (`test:database`) / `database/verifier-hazards.mjs` | **1304 / 1304** / 0 findings |
| `test:task-closure-governance-contract` | 24 / 24 |
| API jest — full | **226 suites, 5091 / 5091** |
| Mobile jest — full | **2168 / 2174**; the 6 failures (`depth.test.tsx`, `w2-account-access.test.tsx`) are the Arabic host locale, identical on the baseline (S4-03 / S4-04 records) — **C — Infrastructure (environment)**; CI's locale does not hit them |
| Mobile `eslint` (every changed / added mobile file) | clean (one finding in S5-01's own new code — a ref written during render — fixed before commit) |

CI results for the exact head are added in the PR conversation.

### 10.2 Failure classification

| Failure | Class | Disposition |
|---|---|---|
| S4-01 / W3-02 / W3-MEGA-S / AppModule-blob pins (above) | **B — Validation / Proof** | re-anchored to the new mandated truth; no Product code changed to satisfy them |
| Forward-safety mirror tests (`✖` while the pins above failed) | **B** | they re-run every contract in a mirror; green once the pins were re-anchored |
| S5-01 contract §7 before this record existed | **B** | expected ordering; green once this record was written |
| `0142` verifier: an erasure probe that swallowed an expected refusal | **B** (caught by the hazard lint before any run) | removed; the cascade is proven by its foreign-key rule instead |
| API CI #918, Step 187 (`boundary: privileged functions are pinned private definers`): `derive_account_public_display_v1 accepts no trusted identity input` | **B — Validation / Proof** (independent review, R1) | the verifier applied the application-boundary "no identity argument" rule to the internal, non-executable helpers. Corrected in the verifier only: the owner commands and wrappers take only `p_label_mode`; the internal helpers may take `p_user_id` and are proven unreachable to PUBLIC / anon / authenticated / service_role; the trigger function takes no input. No Product code changed |

No **A — Product / Security** and no **C — Infrastructure** failure was encountered locally. CI classifications are
added in the PR conversation.

## 11. Residuals for the Product Owner (reported, not admitted)

1. **Name length vs the frozen I-05 label ceiling — Product Owner decision recorded (R1, 2026-10-06), owner `S5-02`.**
   A Name may be up to 80 characters (`0123`); an I-05 display label at most 64 (`0091`). S5-01 shows any Name in
   Settings, and its I-05 bridge REFUSES (never truncates) a longer Name for an account that HAS an I-05 identity in
   REAL_NAME mode; no identity exists before S5-02, so nothing is reachable today. Decision: when the real Public Identity creation path is opened, the old I-05 64-character display-label implementation ceiling is reconciled with the valid 80-character account Name by a reviewed forward migration, so REAL_NAME can represent the full canonical account Name; no silent truncation, and the account Name limit is not redefined. Not
   implemented in S5-01; recorded on the S5-02 row of the backlog (§9).
2. **Export My Data does not carry the Public display choice.** The precedent is `QAN-BL-PRIV-02`; the export's content is
   a Privacy & Data Product decision. Proposed owner: `PRIV-EXPORT-01`.
3. **S4-04 merged with its Copy Gate open — RESOLVED (R1).** The Product Owner approved the `joined` row exactly as
   merged; reconciled as copy governance only (§8).

Item 1 is designated to S5-02 by the Product Owner. Item 2 is not admitted to the backlog by S5-01 on its own authority
(BG-06: admission needs a canonical deferral or an explicit designation); it needs the Product Owner's designation before
S5-01 closes (BG-08).

## 12. Backlog reconciliation (BG-05 / BG-08)

- **Inherited:** none — no backlog item names S5-01 as owner.
- **Re-owned (Product Owner designation):** `QAN-BL-CW-01` (`ASSURE-F05`) → `S5-02 — Publishing + Rights + Draft/Review +
  Privacy Closure`, `OPEN — UNASSIGNED` → `DEFERRED — OWNED`, with the Product Owner's decision recorded verbatim (the
  derivative's retained content bytes must be physically erased; audit / provenance identity may remain). Not implemented;
  not closed; S5-02 must close it before any application-reachable Draft / review creation path opens. S5-01 opens none,
  so the finding is not made newly reachable.
- **Observed, unchanged:** `QAN-BL-ACCT-01` (two reopen clauses observed; it stays `OPEN — UNASSIGNED`, not absorbed; S5-01
  makes no account undeletable). `QAN-BL-NOTIF-02` … `05`, `QAN-BL-PRIV-02`, `QAN-BL-NAV-02`, `QAN-BL-VOICE-01`,
  `QAN-BL-LAUNCH-01` … `03`, `QAN-BL-CI-01`, `QAN-BL-CW-02` and every other item are unchanged.
- **Admitted:** none. The register holds **43** items: 17 `DEFERRED — OWNED`, 0 `VALIDATION — OPEN`, 9 `OPEN — UNASSIGNED`,
  17 `CLOSED — TOMBSTONE`.

## 13. Stage-5 Gap Matrix (S5-01)

Classes: (1) already closed · (2) implemented here · (4) owned by an existing backlog item · (5) owned by a named later
task · (6) not an obligation.

| # | Candidate | Class | Disposition |
|---|---|---|---|
| P-01 | Public World as the third Global Area | 2 | §4, §5 |
| P-02 | Public entry from current audience truth; signed-out fail-closed | 2 | §4.1, §5 |
| P-03 | Public root / controller, content-empty and truthful | 2 | §5 |
| P-04 | `qandeel://public` Direct Entry | 2 | §5 |
| P-05 | `E2E-H-08` — Public display choice bound to the Public ID / Name | 2 / 5 | §6; foundation implemented here; ADVANCED / S5-02 OWNED — NOT CLOSED |
| P-06 | Draft / publication / rights / review; `ASSURE-F05` | 4 / 5 | `QAN-BL-CW-01` → S5-02 |
| P-07 | Experiences, semantic field, search, lenses, vitality | 5 | S5-03 |
| P-08 | Discussion, Public QANDEEL, reactions, Public Activity / push | 5 | S5-04 |
| P-09 | CW2-08 Safety / Launch Gate, signed-out policy, Premium | 5 | `CW2-08` / `I-09`, Stage 9 |
| P-10 | Account deletion across Connected Worlds | 4 | `QAN-BL-ACCT-01` |
| P-11 | Name > 64 vs the I-05 label ceiling | 5 | Product Owner decision recorded (§11.1); owner S5-02 (reviewed forward migration, no truncation) |
| P-12 | Export of the display choice | 5 | reported (§11.2), proposed owner PRIV-EXPORT-01 |
| P-13 | The two new copy rows | 1 | APPROVED by the Product Owner (§8) |
| P-14 | iOS / physical-device Public journey | 5 | Release Hardening & Launch |

**Orphan gaps = 0.**

## 14. Next task

**S5-02 — Publishing + Rights + Draft/Review + Privacy Closure** only. S5-01 prepares nothing of it and begins no
S5-02, S5-03, S5-04 or later-stage work.
