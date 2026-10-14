# QANDEEL — S6-01 — Intelligent Matching Onboarding — Implementation Record v1

**Status:** `S6-01` — **CLOSED (CP4) — PRODUCT COPY GATE CLOSED — READY FOR THE PRODUCT OWNER'S MERGE DECISION — NOT
MERGED / NOT DEPLOYED.** CP1–CP4 are recorded on one draft pull request, PR #339 (§10). The Product Owner approved rows
95–101 byte-exact, 7 / 7, without modification, on 2026-10-14. That closed the Product Copy Gate (§7, §10.4). Merging
needs the Product Owner's separate explicit authorization. Nothing is deployed, no gate is opened and no enrollment
happens.

*As written at CP4:* `S6-01` — CLOSED (CP4) — READY FOR PRODUCT OWNER REVIEW — NOT MERGED / NOT DEPLOYED. The Product
Copy Gate was still open for seven rows (95–101, PROPOSED).

*As written at CP1:* `S6-01` — IN PROGRESS — CP1 (authority and field contracts) recorded. Not merged, nothing deployed,
no gate opened. CP2 (database and API), CP3 (copy / visual gate and mobile) and CP4 (exact-head verification and closure)
follow in the same pull request.

**Authority:** the Product Owner's **S6-01 Final Implementation Authorization** (2026-10-13; "APPROVED — PROCEED WITH
IMPLEMENTATION"), decisions D1–D7. It approves the consolidated WP-A R1 decisions with corrections and names its evidence:
- the original S6-01 Task Contract (2026-10-09, *One-PR, Privacy-First Product Integration Task Contract*);
- the S6-01 Intelligence Reality Check (2026-10-09);
- the merged Stage 6 WP0 decisions
  ([WP0 record](QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14, final addendum §14.14);
- WP-A R1 (2026-10-13, read-only, not committed).

Where the Product Owner's latest explicit decision supersedes an earlier plan, the latest decision binds. The binding
rules of the authorization: ONE task, ONE PR, multiple internal checkpoints; no merge without the Product Owner's
explicit authorization; no hosted deployment and no gate opening; no production LLM and no fake compatibility
inference; the six commands closed by `0149` stay closed.

**Baseline:** `main = af94748de73cca744c466d8db526984427b94b38` (the merge of PR #335, Stage 6 WP0), re-verified as
`origin/main` before branching. Migrations `0001`–`0153`; `0154` is the next free number.

**Branch:** `s6/s6-01-intelligent-matching-onboarding`, in its own worktree. The LANG workstream runs in a separate
worktree and branch; this task edits no existing language file and absorbs none of the 109-unit census.

**Controlled amendment carried:**
[CW2-06A](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06A_MATCHING_ONBOARDING_PREPARATION_ASSISTANCE_CONTROLLED_AMENDMENT_v1.0.md)
— pre-enrollment preparation, the `MATCHING_ONBOARDING_ASSISTANCE` consent family (`CA-05`) and the declared sex fact
(`CA-09` part 1).

---

## 0. What S6-01 is, and what it is not

S6-01 delivers a dignified, guided, private **preparation** for Marriage Introductions inside `MY_WORLD`. The user can
learn what Introductions with QANDEEL is and whether it is available, prepare a private draft one purposeful step at a
time, let QANDEEL show what it already understands about them (only with a separate permission, and only for them to
confirm, correct or reject), separate hard requirements from soft preferences, leave and resume, review the draft, and
see that real enrollment is not yet available.

The closure statement this task must use, and no stronger one:

> **Preparation functionality delivered — real enrollment still unavailable — actual Matching intelligence not yet
> complete — no production deployment — no launch clearance.**

S6-01 is not "Intelligent Matching complete". Deterministic preparation is not proof of QANDEEL understanding. The
Product Owner's rule stands: **no real Matching without QANDEEL's actual, authorized, correctable and reusable
understanding of the user** (Reality Check §0). The work that rule needs is admitted as `QAN-BL-MATCH-04` (Stage 8A; §9).

---

## 1. Authority reconciliation

### 1.1 Recovered prior decisions and how they apply

| Prior decision (source) | What it said | Disposition in S6-01 |
|---|---|---|
| One task / one PR (contract §2, §8) | S6-01 is one task and one draft PR with internal checkpoints | **Binding.** One PR; checkpoints CP1–CP4 (authorization §4) |
| Adaptive onboarding (contract §0, WP3, §5, §9) | Question *objectives* vary with authorized understanding and current answers; N / K / C personas; no fixed questionnaire | **Binding.** A deterministic objective selector (§6.3, CP3); the natural-language phrasing port is `UNBOUND` until Stage 8A |
| C01–C07 approved AR / EN pairs (contract §6) | Seven fixed copy pairs | Historically approved and preserved in the audit trail. C01 is used unchanged. C02–C06 conflict with the later simplified-MSA rule (WP0 §14.1), C03 bundles two purposes, C07 conflicts with GATE-24a: controlled replacements go to the CP3 Copy Gate; C07 is deferred and not displayed (§7) |
| D1 (WP0 report, 2026-10-09) | Lawful basis for `MY_WORLD`-informed onboarding: A new consent / B widened grant / C no read | Superseded by the Product Owner's HIM-first direction, then by GATE-11 (approved Product intent) and **D3 of the final authorization**: a separate `MATCHING_ONBOARDING_ASSISTANCE` consent under CW2-06A (option A) |
| D2 (HIM-first amendment, 2026-10-09) | A purpose-exact, independent consent text | Binding. The consent text and its version evidence are implemented (§4.3); its wording goes through the CP3 Copy Gate |
| D3 (HIM-first amendment) | First name confirmed; short introduction reviewed; city and work field optional | Reconciled with GATE-15 by **D5 of the final authorization**: the four required basics plus the sex fact; short introduction and work field optional and progressive; city replaced by a country and first-level region catalogue |
| D4 (HIM-first amendment) | No exposure to real production users before deletion and launch safety are resolved | Binding. Both gates start closed; nothing is deployed; real enrollment stays closed (`0149`) |
| D5 (HIM-first amendment) | The SHARED-VIS-01 closure | Discharged by GOV-REC-01 (PR #334); nothing to do here |
| D6 (HIM-first amendment) | Entry in My World plus a bounded Settings section; 320pt AR / EN proof before implementation | Binding. The Settings section appears only for an enrolled person, so it is not drawn while enrollment is closed (contract WP4: no non-functional Settings group). 320pt proof is part of the CP3 gate |
| Readiness concepts (HIM-first amendment §5) | `PARTICIPATION_ACTIVE` … `ACTUALLY_ELIGIBLE_FOR_PROPOSALS`, conceptual, no new DB states | Applied as truthful presentation: preparation never reads as participation, readiness or eligibility (§6.4) |

### 1.2 The historical "Paused" status

The Product Roadmap §6.3 recorded S6-01 as "Paused" at its 2026-10-09 decision checkpoint, while other locators said
"not started". Both were true at their dates. The Product Owner's final authorization (2026-10-13) starts S6-01 as a new
repository task on this branch. The locators now record S6-01 as the current implementation task (Roadmap execution note,
Current State, Project Map).

### 1.3 Kickoff census (BG-05)

**Inherited:** `QAN-BL-MATCH-01` (`HIGH`, `DEFERRED — OWNED`, owner S6-01). The Product Owner's D1 keeps the six
commands closed. At closure it is re-owned, not tombstoned, to `S6-07 — Activity, Direct Entry and Final Integration`,
with a mandatory dependency on the separately governed `ACCT-DEL-01` correction (§10).

**Bearing, unchanged:**
- `QAN-BL-ACCT-01` (deletion across Connected Worlds; direction `ACCT-DEL-01`, D3 of the WP0 addendum). S6-01 adds no
  deletion-blocking footprint (§5.2).
- `QAN-BL-PROD-06` (`40001` retry on PostgREST before v16). S6-01 adds no `40001` path: a stale command is an ordinary
  `STALE_VERSION` answer.
- `QAN-BL-PRIV-04` (Matching / Introductions export, S6-07). The preparation draft is new Matching data of the reader's;
  its export is S6-07's under that item. Export My Data is not changed here.
- `QAN-BL-MATCH-02`, `QAN-BL-MATCH-03`, `QAN-BL-LAUNCH-04` (Issue #322, still OPEN as a release blocker).

**Admitted at CP1:** `QAN-BL-MATCH-04` (D7; §9).

---

## 2. The approved decisions as implemented contracts

| ID | Decision (Product Owner, 2026-10-13) | Contract in this task |
|---|---|---|
| D1 | `CA-01`: the six `0149` commands stay closed; no wrapper; `NO_BACKDOOR`, SEC-MATCH-00 and historical migration bodies unchanged | No function in `0154` names, calls or writes through any of the six or any I-07 relation. `verify-migration-0149` and `verify-migration-0150` are re-run unchanged. No enrollment happens. `QAN-BL-MATCH-01` → S6-07 at closure |
| D2 | A server-side, erasable pre-enrollment draft behind a closed operator gate | CW2-06A §2. The new verifier enumerates every new relation, foreign key, grant, command, audit row and deletion dependency itself (§5) and proves an account with a draft completes the governed erasure |
| D3 | `CA-05`: `MATCHING_ONBOARDING_ASSISTANCE`, independent, OFF by default, revocable, purpose-restricted; bounded deterministic read of the owner's SELF / ACTIVE Memory classes | CW2-06A §3; §4.3 and §5.3 below |
| D4 | `CA-09`: Male / Female declared and independently confirmed; never inferred; separate from optional profile fields | CW2-06A §4; §4.1 below. S6-03 owns the predicate |
| D5 | Age as year and month, UNKNOWN when uncertain; country and first-level region catalogue; four marital statuses; four basics plus sex required; short introduction and work field optional; "no additional hard dealbreakers" valid; zero soft preferences valid | §4.1–§4.2 |
| D6 | `CA-08`: no Pre-Match disclosure | No disclosure authority, field approval or recipient-visible field. C07 not displayed |
| D7 | Admit `QAN-BL-MATCH-04` (Stage 8A) | §9 |

---

## 3. Scope matrix

| Area | In S6-01 | Not in S6-01 (owner) |
|---|---|---|
| Entry | Manual entry in `MY_WORLD`, drawn only while preparation is available or the person already has a draft | Conversational offer (Stage 8A; GATE-13) |
| Preparation draft | Server-side draft, owner commands, versioned compare-and-set, idempotent command ids, refusal during scheduled deletion, discard | Enrollment, participation, profile / requirement versions (`0149` stays closed; enrollment path S6-07 with `ACCT-DEL-01`) |
| Declared facts | First name, sex, birth year-month, broad area, marital status, each with its own confirmation state | Pair-level opposite-sex predicate, legal-age threshold, jurisdiction policy (S6-03; Stage 9) |
| Requirements | Hard requirements and soft preferences on structured dimensions; explicit "no additional hard dealbreakers"; zero soft preferences | Evaluation (S6-03); free-text requirement evaluation (Stage 8A); `CA-10` (enrollment path) |
| Assistance | `MATCHING_ONBOARDING_ASSISTANCE` grant / revoke / consent version; bounded deterministic reader; item-by-item confirm / correct / reject into the draft | Natural acquisition, semantic retrieval, model phrasing, understanding adequacy, HIM advisory review (`QAN-BL-MATCH-04`) |
| Objectives | Deterministic objective selector with N / K / C branching and an `UNBOUND` phrasing port | Live natural-language onboarding (Stage 8A) |
| Disclosure | None | `CA-07` / `CA-08` reconciliation (S6-03); disclosure UI (S6-06) |
| Gates | Two operator gates, `PREPARATION` and `ONBOARDING_ASSISTANCE`, absent = closed | Opening any gate (Stage 9 / an explicit operator decision) |
| Settings | Nothing new (no enrolled person exists) | The bounded Introductions Settings group (with the enrollment path) |
| Export | Not changed | `QAN-BL-PRIV-04` (S6-07) |

---

## 4. Field and consent catalogue

### 4.1 Declared facts (required)

Each fact carries its own confirmation state: `DECLARED` (entered, not yet confirmed), `CONFIRMED`, or `CORRECTED`
(changed after it had been confirmed; it needs confirming again). Only `CONFIRMED` counts as complete. A missing or
unconfirmed fact is `UNKNOWN` for any future eligibility.

| Key | Value | Validation | Source rule |
|---|---|---|---|
| `INTRODUCTION_FIRST_NAME` | text | 1–32 characters after trimming; Arabic or Latin letters, with single spaces, hyphens or apostrophes between letters; no digits or symbols | The Introduction First Name is a distinct source from the account Name (P1 §4, GATE-12); never copied from `users.name` |
| `SEX` | `MALE` / `FEMALE` | closed | Declared, then confirmed in a separate act (D4). Never inferred |
| `BIRTH_YEAR_MONTH` | year, month | year 1900 … current year; month 1–12; not in the future | Exact day not collected (D5). Private; never disclosed before a Match |
| `BROAD_AREA` | country code, region code | country from the catalogue (§4.4); a region from that country's first-level catalogue when the catalogue lists regions for it | No street, district, city or coordinates |
| `MARITAL_STATUS` | `NEVER_MARRIED` / `DIVORCED` / `WIDOWED` / `CURRENTLY_MARRIED` | closed | A truthful declaration. Recording any value decides no eligibility (D5) |

**Age interpretation.** A legal-adult conclusion is drawn only when it holds for every possible day in the declared
month; otherwise it is `UNKNOWN`. The legal threshold and its jurisdictions are Stage 9 decisions, so S6-01 computes
no eligibility from age at all; it stores the source fact only.

### 4.2 Optional profile and requirements

| Key | Value | Rule |
|---|---|---|
| `SHORT_INTRODUCTION` | text, 20–280 characters | optional, progressive, the user's own words; may be skipped |
| `WORK_FIELD` | `HEALTH`, `EDUCATION`, `ENGINEERING_TECHNOLOGY`, `BUSINESS_FINANCE`, `LAW_GOVERNMENT`, `MEDIA_ARTS`, `SCIENCE_RESEARCH`, `CRAFTS_TRADES`, `SERVICES_HOSPITALITY`, `AGRICULTURE_ENVIRONMENT`, `STUDENT`, `NOT_CURRENTLY_WORKING`, `OTHER` | optional, progressive; a broad field, never an employer |
| Hard requirements | `NONE_ADDITIONAL` (confirmed: no additional personal hard dealbreakers) or `ITEMS` (1–3 items) | at most one item per dimension |
| Soft preferences | `NONE` (confirmed: no soft preference) or `ITEMS` (1–3 items) | at most one item per dimension |
| Requirement dimensions | `AGE_RANGE` (minimum and maximum, 18–99, minimum ≤ maximum); `MARITAL_STATUS` (a non-empty subset of the four values); `AREA` (one country, optionally a non-empty set of its listed regions) | Only dimensions for which a confirmed candidate fact will exist (§4.1), so S6-03 can evaluate them; 18–99 is an input range for a preference, not the legal threshold |
| Private notes | at most 8 notes, 2–500 characters; kind `ABOUT_ME` or `WHAT_MATTERS`; origin `USER_AUTHORED`, `CONFIRMED_FROM_PRIOR_UNDERSTANDING` or `CORRECTED_FROM_PRIOR_UNDERSTANDING` | Private preparation content. Never evaluated or disclosed in S6-01 |

Product-wide eligibility rules (opposite sex, legal age) are system rules and are never written as a user's hard
requirement. A discrepancy between a hard requirement and a soft preference on the same dimension (a soft age range
outside the hard range, soft marital statuses outside the hard set, a soft area in another country) is resolved with
the user before review; QANDEEL never resolves it silently.

### 4.3 Consent catalogue

| Purpose | Version | Default | Grant | Revoke | Evidence |
|---|---|---|---|---|---|
| `MATCHING_ONBOARDING_ASSISTANCE` | the current version in the consent-text catalogue (Arabic and English text with their SHA-256) | OFF | the human's explicit act, naming the exact version shown; refused for a version that is not current | the human's act, at any time; effective immediately | one row per grant: version, granted time, revoked time, the command ids. No Memory content |

The Matching Context Grant and the Pre-Match Proposal Disclosure Authority are not created, granted, read or implied.

### 4.4 Broad-area catalogue (v1)

The catalogue is a **preparation catalogue, not launch policy.** Which countries and jurisdictions real Matching serves
is a later Product decision; nothing here decides it.

- **Countries (22):** the member states of the Arab League, by ISO 3166-1 alpha-2: `AE`, `BH`, `DJ`, `DZ`, `EG`, `IQ`,
  `JO`, `KM`, `KW`, `LB`, `LY`, `MA`, `MR`, `OM`, `PS`, `QA`, `SA`, `SD`, `SO`, `SY`, `TN`, `YE`.
- **First-level regions listed in v1:** Egypt (27 governorates), Saudi Arabia (13 regions), the UAE (7 emirates),
  Kuwait (6 governorates), Qatar (8 municipalities), Bahrain (4 governorates), Oman (11 governorates), Jordan
  (12 governorates), keyed by ISO 3166-2 code.
- For the other 14 countries the broad area is the country alone until their regions are added by a later reviewed
  migration. The database catalogue and the mobile display catalogue are proved identical by a contract test.

---

## 5. Database contract (CP2) — migration `0154`

`database/migrations/0154_matching_onboarding_preparation_v1.sql`; schema `introductions_preparation_private`, not
exposed through the Data API. Forward-only; `0001`–`0153` byte-unchanged.

### 5.1 Relations (every one enumerated by `verify-migration-0154`, not by any earlier verifier's name pattern)

| Relation | Holds | Account reference | Delete rule |
|---|---|---|---|
| `gate_states`, `gate_events` | the `PREPARATION` and `ONBOARDING_ASSISTANCE` gates and their audit (0138 pattern) | — | events → states RESTRICT |
| `area_countries`, `area_regions` | the preparation area catalogue | — | regions → countries RESTRICT |
| `consent_texts` | each consent version: Arabic, English, SHA-256 of each (a CHECK proves the digests) | — | — |
| `drafts` | version, optional profile, hard / soft answers and items, skipped steps, review | `user_id` → `public.users` | **CASCADE** |
| `declared_facts` | the five facts, each with `DECLARED` / `CONFIRMED` / `CORRECTED` and a confirmation time | → `drafts` | **CASCADE** |
| `notes` | the owner's private notes (written, confirmed or corrected from prior understanding) | → `drafts` | **CASCADE** |
| `prior_understanding_decisions` | the owner's decision per shown item, **no content**, no FK to Memory | → `drafts` | **CASCADE** |
| `assistance_consents` | version-bound grants and revocations (no content) | → `public.users` | **CASCADE** |
| `command_ledger` | each applied command once: kind, SHA-256 fingerprint, outcome, version (no content) | → `public.users` | **CASCADE** |

No relation outside the schema references it, and no trigger is defined on it, so nothing here can make the governed
erasure fail or wait. The schema and table names avoid `verify-migration-0149`'s Matching name pattern because these
relations are **not** I-07 relations; the pattern is not relied on for anything — the new verifier enumerates and
asserts every foreign key and delete rule itself (Product Owner D2 security warning).

### 5.2 Entry points and authority

| Exposed (SECURITY INVOKER pass-through) | Owner entry (DEFINER, `auth.uid()` only) | Gate(s) bound | Live deletion |
|---|---|---|---|
| `read_matching_preparation_availability_v1()` | `read_availability_v1` | hint only | — |
| `read_own_matching_preparation_v1()` | `read_own_preparation_v1` | none (the owner's own data) | readable |
| `apply_own_matching_preparation_command_v1(command_id, expected_version, kind, payload)` | `apply_own_command_v1` | `PREPARATION` (+ `ONBOARDING_ASSISTANCE` for a prior-item decision) | refused |
| `discard_own_matching_preparation_v1(command_id)` | `discard_own_v1` | none | allowed |
| `grant_own_matching_onboarding_assistance_v1(command_id, consent_version)` | `grant_own_assistance_v1` | both | refused |
| `revoke_own_matching_onboarding_assistance_v1(command_id)` | `revoke_own_assistance_v1` | none | allowed |
| `read_own_matching_onboarding_assistance_items_v1()` | `read_own_assistance_items_v1` | both, FOR SHARE, and the current consent FOR SHARE | — |

`authenticated` runs these fourteen functions and nothing else; no application role reads or writes a table; `anon`,
`service_role` and `PUBLIC` reach nothing. The operator functions (`set_gate_v1`, `bind_gate_v1`) and every internal
core run for no application role. Commands: `SET_FACT`, `CONFIRM_FACT`, `SET_PROFILE`, `SET_REQUIREMENTS`, `ADD_NOTE`,
`REMOVE_NOTE`, `RECORD_PRIOR_UNDERSTANDING`, `SKIP_STEP`, `CONFIRM_REVIEW`. Outcomes that change nothing (and are not
ledgered): `UNAVAILABLE`, `ACCOUNT_DELETION_PENDING`, `STALE_VERSION`, `COMMAND_ID_REUSED`, `NOT_ELIGIBLE`,
`ALREADY_DECIDED`, `NOTE_LIMIT_REACHED`, `NOTHING_TO_CONFIRM`, `NOT_READY_FOR_REVIEW`; an invalid request is `22023`.
No path raises `40001` (`QAN-BL-PROD-06`).

**Lock order** (never reversed): the account row `FOR KEY SHARE` (a deletion request and the erasure take it
`FOR UPDATE`) → the owner's advisory lock → the gate row(s) `FOR SHARE` → the current consent `FOR SHARE` → the draft
`FOR UPDATE` → a Memory row `FOR SHARE`.

### 5.3 The `MATCHING_ONBOARDING_ASSISTANCE` reader (CW2-06A §3)

Returns at most 12 of the caller's Memories that are `ACTIVE`, unexpired, `USER_STATED` / `USER_CONFIRMED`, of type
`PERSONAL_FACT`, `STABLE_PREFERENCE`, `GOAL` or `DECISION_COMMITMENT`, attributed `SELF`, 2–500 characters, not yet
decided on — newest first, words exactly as stored, with a deterministic recency (`CURRENT` within 365 days, else
`NEEDS_RECHECK`). It infers, summarizes and ranks nothing, calls no model, and writes nothing. A confirmation re-reads
the item under the same rules in the command's own transaction and copies its words; a client cannot assert where a note
came from. A correction or rejection changes the draft only — never the Memory.

## 6. Application contract (CP2 / CP3)

### 6.1 API — `apps/api/src/introductions-preparation` (composed through `AccountModule`; the application root is pinned)

| Route | Body | Answer |
|---|---|---|
| `GET /introductions/availability` | — | `{ preparation, assistance, enrollment: false, hasDraft }` |
| `GET /introductions/preparation` | — | the record, the authorized prior items, the objective plan, `phrasing: 'UNBOUND'` |
| `POST /introductions/preparation/commands` | `{ commandId, expectedVersion, kind, payload }` (exact shapes) | `{ outcome, view }` |
| `POST /introductions/preparation/discard` | `{ commandId }` | `{ outcome, view }` |
| `POST /introductions/preparation/assistance/grant` | `{ commandId, consentVersion }` | `{ outcome, view }` |
| `POST /introductions/preparation/assistance/revoke` | `{ commandId }` | `{ outcome, view }` |

Caller's token only; no route takes a user id. Every database answer is decoded strictly — doubt fails closed as one
sanitized `503`; the database's `22023` is a `400`. Nothing is logged. The module imports no Conversation, Memory,
Hypothesis, HIM, Model Router, Shared or Public source, and names no I-07 command or relation (structural spec).

### 6.2 The Matching Onboarding Objective selector (Task Contract WP3)

`onboarding-objective-selector.ts`, deterministic and provider-neutral. Inputs: the server-confirmed draft and, only
with the permission granted and both gates open, the bounded prior items. Order pursued: `OFFER_ASSISTANCE` (once;
declining is kept) → `RESOLVE_DISCREPANCY` → `RECONFIRM_CORRECTED_FACT` → `CLARIFY_PRIOR_ITEM` (older items first,
never presumed) → `CONFIRM_PRIOR_ITEM` (at most 5 per plan; "stop showing" ends them) → each required fact
`ESTABLISH_FACT` / `CONFIRM_DECLARED_FACT` (a confirmed one is skipped) → `ESTABLISH_HARD_REQUIREMENTS` →
`ESTABLISH_SOFT_PREFERENCES` → optional `ESTABLISH_PRIORITIES` (skipped as already known when the owner confirmed what
matters to them), `OFFER_SHORT_INTRODUCTION`, `OFFER_WORK_FIELD` → `REVIEW` → nothing. Path: `NEW` / `KNOWN` / `MIXED`.
An item never answers a required fact. Enrollment is always `UNAVAILABLE`. The phrasing seam is `UNBOUND`
(Stage 8A; `QAN-BL-MATCH-04`).

### 6.3 Mobile — `apps/mobile/src/introductions`

The manual entry «التعارف مع قنديل» on Personal QANDEEL's own row (after «فهم قنديل»), drawn only while preparation is
available or a draft exists; the preparation surface over the still-mounted Personal world (a `DepthComposition`
overlay like Understanding; not a route, tab or World; Android Back and the header Back return exactly; inner editors
take Back first). The `IntroductionsApiClient` decodes strictly — no answer can claim enrollment or a bound phrasing
provider. The controller is built per runtime generation and retired with it (no persistence, nothing crosses accounts);
a change is bound to the draft version shown; a lost answer is retried with the same command id. The attention law
treats the surface as a non-Analysis Personal depth (`ProductSurface` `INTRODUCTIONS`). No Settings group is drawn (no
enrolled person exists).

## 7. Product Copy and Visual Gate (CP3) — CLOSED

**Status at closure (2026-10-14):** `CLOSED — 101 / 101 rows APPROVED`.
- The Product Owner's **S6-01 Final Product Copy Approval** (2026-10-14, "APPROVED — 7/7") approves the exact Arabic and
  English of rows 95–101 in `copy.ts`, without modification. Their wording is in §10.4.
- This closes the gate, together with the 94 rows and the C01–C07 treatment approved earlier the same day (7.6), and
  the controlled replacements (7.2).
- Every earlier Copy Gate decision stands as recorded:
  - C01 is used unchanged;
  - C02–C06 keep their controlled replacements;
  - C03 stays split into two rows;
  - **C07 stays DEFERRED and is never displayed**;
  - `systemRulesNote` (row 58) carries the Product Owner's own correction.
- No copy string, application code, database, design or architecture changed for this approval.
- The in-code status markers of `copy.ts` are left as written, because the approval directs that no application code
  changes. These are `INTRODUCTIONS_COPY_GATE.status`, `INTRODUCTIONS_COPY_DELTA.status` and the per-row comments.
  The same applies to the status column of 7.3. Where they say OPEN or PROPOSED, this section and §10.4 bind.

*As written at CP4 (2026-10-14):* `OPEN — seven rows PROPOSED`.
- On 2026-10-14 the Product Owner approved the 94 rows and the C01–C07 treatment (7.6). `systemRulesNote` carries the
  Product Owner's own correction (row 58).
- The seven VIS-2 delta rows, 95–101, are PROPOSED. Their formal byte-exact decision has not been given (§10.4).
- The per-row tags in `copy.ts` and in 7.3 are left as written. The gate is marked CLOSED there only by that decision.

*As written at CP3:* `OPEN — every new and replacement row PROPOSED`. The words live in one place,
`apps/mobile/src/introductions/copy.ts` (`INTRODUCTIONS_COPY_GATE`); the table below is generated from that file, so the
package and the code cannot differ. Fixed Arabic is simplified MSA and gender-considerate: where a second-person verb
would mark gender, a row uses a noun or a form spelled alike for both (WP0 §14.1, GATE-28). S6 owns this new Matching
copy (D6 rule 4); no existing language file is touched and none of the 109 LANG units is absorbed.

### 7.1 Screen structure (the approved structure: a Personal-world overlay; nothing new at the World level)

| # | Screen | When | What it shows |
|---|---|---|---|
| 0 | Personal row entry | preparation available, or a draft exists | the word «التعارف مع قنديل» after «فهم قنديل» on Personal QANDEEL's own row; nothing is drawn while both gates are closed and nothing was prepared |
| 1 | Intro | no draft yet | C01 title; C02 replacement; private note; "enrollment isn't available yet"; the path line (NEW / KNOWN / MIXED); Start |
| 2 | Assistance offer | assistance available, never decided | C03 (a) title; the consent text of the current version (stored with its SHA-256); Allow / Continue without it |
| 3 | Prior item — confirm (K) | permission granted, a CURRENT item | C04 replacement; the owner's words, quoted as stored; Yes / Correct the wording / No longer true / Don't use it; "won't change what QANDEEL remembers"; Stop showing |
| 4 | Prior item — clarify (C) | an older item | the clarification lead and question instead of a presumption |
| 5 | Fact — establish | a required fact is missing | first name (with "can differ from your account name"); sex (Male / Female, with "QANDEEL never infers this"); month + year of birth; country, then region; marital status (four values) |
| 6 | Fact — confirm / reconfirm | declared, or changed after confirmation | the value; "Is this correct?" (sex: its own separate-step line); Yes / Edit |
| 7 | Dealbreakers | not answered | "No additional dealbreakers" or set: age range, accepted marital statuses, area; the system-rules note |
| 8 | Preferences | not answered | "No preferences" or set, on the same three dimensions |
| 9 | Conflict | a preference outside a dealbreaker on the same point | names the point; Edit the dealbreaker / Edit the preference |
| 10 | What matters (optional) | no notes, not skipped | free words, private; Save / Skip |
| 11 | Short introduction / work field (optional) | not answered, not skipped | 20–280 characters, not shown before a mutual match; thirteen broad fields; Skip |
| 12 | Review | everything required confirmed | C06 replacement; the whole draft, each part editable; "enrollment isn't available yet"; Confirm review |
| 13 | Reviewed | review confirmed and unchanged | "Your preparation is complete. Enrolling isn't available yet…"; the draft; the assistance permission (withdraw / allow); Delete preparation |
| 14 | Read-only | gates closed, or account deletion pending | the reason; the draft read-only; Delete preparation |

Notices (one polite live region): changed on another device; unavailable now; deletion pending; note limit; couldn't
save (retry is the same command); value not accepted.

### 7.2 The historically approved pairs and their disposition

| ID | Disposition | Row |
|---|---|---|
| C01 | **used unchanged** (AR and EN) | `name` |
| C02 | Arabic: controlled replacement (dialect «خليني … اللي», masculine «تختارها» → «ضمن حدود من اختيارك»); English kept as approved | `opening` |
| C03 | **split in two purpose-exact rows** (one sentence carried onboarding personalization AND "help with matching"; GATE-11 / GATE-17 / CW2-06A §3): (a) the onboarding-assistance permission title, displayed; (b) the Matching Context Grant label, recorded for the enrollment path and **not displayed** in S6-01 | `assistanceOfferTitle`, `matchingContextGrantLabel` |
| C04 | Arabic: controlled replacement (dialect «هسألك … مخصوصة ليك … مع بعض»); English kept as approved; shown only when the authorized reader returned a CURRENT item | `pathKnown` |
| C05 | Arabic: controlled replacement (dialect «لسه … ده … خليني … شوية … إيه … ليك»); English kept as approved | `pathNew` |
| C06 | Arabic: controlled replacement (dialect and the masculine imperatives «راجعها … عدّل»); English kept as approved | `reviewLead` |
| C07 | **deferred, never displayed** (GATE-24a, CA-08: no profile field is disclosed before a Mutual Match) | — |

### 7.3 Every row (generated from `copy.ts`)

| ID | Arabic (approved 2026-10-09, verbatim) | English (approved, verbatim) |
|---|---|---|
| C01 | التعارف مع قنديل | Introductions with QANDEEL |
| C02 | خليني أساعدك تكتشف فرصة تعارف مناسبة بهدف الزواج، بطريقتك وبالحدود اللي تختارها. | Let me help you explore a meaningful introduction for marriage, on your terms. |
| C03 | تحب أستفيد من فهمي السابق ليك علشان أخصص حوارنا وأساعدك في التوفيق؟ | May I use what I've learned about you to personalize our conversation and help with matching? |
| C04 | عندي فهم سابق لبعض أولوياتك. هسألك أسئلة مخصوصة ليك علشان نتأكد من فهمي ونكمل الصورة مع بعض. | I already have some understanding of your priorities. I'll ask questions tailored to you so we can check my understanding together. |
| C05 | لسه بنتعرف على بعض، وده طبيعي. خليني أسألك شوية أسئلة تساعدني أفهم إيه المهم ليك فعلًا. | We're still getting to know each other. I'll ask a few questions to understand what truly matters to you. |
| C06 | دي الصورة اللي وصلنا لها مع بعض. راجعها وعدّل أي حاجة مش بتعبّر عنك. | Here's the introduction profile we've put together. Review it and change anything that doesn't feel right. |
| C07 | اختار المعلومات اللي تسمح لقنديل يعرضها عند اقتراح تعارف. بياناتك وتحليلاتك الخاصة مش جزء من البطاقة. | Choose what QANDEEL may show in an introduction proposal. Your private data and analysis are not part of this profile. |

| # | Key | Arabic | English | Status |
|---|---|---|---|---|
| 1 | `name` | التعارف مع قنديل | Introductions with QANDEEL | APPROVED — C01 (Product Owner, 2026-10-09), unchanged |
| 2 | `opening` | سأساعدك على استكشاف فرصة تعارف مناسبة بهدف الزواج، بطريقتك وضمن حدود من اختيارك. | Let me help you explore a meaningful introduction for marriage, on your terms. | PROPOSED — controlled replacement of C02 (Arabic); English as approved |
| 3 | `privateNote` | هذا تحضير خاص بك وحدك، ولا يراه أحد غيرك. | This is a private preparation, for you only. No one else sees it. | PROPOSED |
| 4 | `enrollmentUnavailable` | التسجيل في التعارف غير متاح حاليًا. يمكنك التحضير الآن ومراجعة ما أعددته في أي وقت. | Enrolling in Introductions isn't available yet. You can prepare now and review what you've prepared at any time. | PROPOSED |
| 5 | `start` | بدء التحضير | Start preparing | PROPOSED |
| 6 | `continue` | متابعة التحضير | Continue preparing | PROPOSED |
| 7 | `pathNew` | ما زلنا في بداية التعارف، وهذا طبيعي. سأطرح عليك بعض الأسئلة لأفهم ما يهمك فعلًا. | We're still getting to know each other. I'll ask a few questions to understand what truly matters to you. | PROPOSED — controlled replacement of C05 (Arabic); English as approved |
| 8 | `pathKnown` | لديّ فهم سابق لبعض أولوياتك. سأطرح عليك أسئلة خاصة بك لنتأكد من فهمي ونكمل الصورة معًا. | I already have some understanding of your priorities. I'll ask questions tailored to you so we can check my understanding together. | PROPOSED — controlled replacement of C04 (Arabic); English as approved |
| 9 | `pathMixed` | بعض ما أعرفه عنك ربما تغيّر. سأسألك عنه أولًا قبل أن أعتمد عليه. | Some of what I know about you may have changed. I'll ask you about it first before relying on it. | PROPOSED |
| 10 | `assistanceOfferTitle` | الاستفادة مما يعرفه قنديل عنك في التحضير | Using what QANDEEL knows about you to prepare | PROPOSED — C03 split (a): the onboarding-assistance permission |
| 11 | `matchingContextGrantLabel` | السماح باستخدام فهم قنديل لك في التوفيق | Allow QANDEEL's understanding of you to be used for matching | PROPOSED — C03 split (b): the Matching Context Grant; NOT DISPLAYED in S6-01 |
| 12 | `allowAssistance` | السماح | Allow | PROPOSED |
| 13 | `continueWithout` | المتابعة دون ذلك | Continue without it | PROPOSED |
| 14 | `assistanceOn` | يستفيد قنديل مما يعرفه عنك في التحضير. | QANDEEL uses what it knows about you to help you prepare. | PROPOSED |
| 15 | `assistanceOff` | لا يستفيد قنديل مما يعرفه عنك في التحضير. | QANDEEL doesn't use what it knows about you to help you prepare. | PROPOSED |
| 16 | `stopAssistance` | إيقاف هذا الإذن | Withdraw this permission | PROPOSED |
| 17 | `priorLead` | مما شاركته معي سابقًا: | Something you've shared with me: | PROPOSED |
| 18 | `priorConfirmQuestion` | هل ما زال هذا صحيحًا ومهمًا لك في التعارف؟ | Is this still true, and does it matter to you for Introductions? | PROPOSED |
| 19 | `priorClarifyLead` | شاركت هذا معي منذ مدة، وربما تغيّر: | You shared this with me a while ago, and it may have changed: | PROPOSED |
| 20 | `priorClarifyQuestion` | هل ما زال يعبّر عنك؟ | Does it still describe you? | PROPOSED |
| 21 | `priorYes` | نعم، صحيح | Yes, that's right | PROPOSED |
| 22 | `priorEdit` | تصحيح الصياغة | Correct the wording | PROPOSED |
| 23 | `priorNoLonger` | لم يعد صحيحًا | No longer true | PROPOSED |
| 24 | `priorDecline` | عدم استخدامه | Don't use it | PROPOSED |
| 25 | `priorCorrectionLabel` | الصياغة الصحيحة بكلماتك | The right wording, in your words | PROPOSED |
| 26 | `priorMemoryNote` | لن يغيّر ذلك ما يتذكره قنديل في محادثاتك. | This won't change what QANDEEL remembers in your conversations. | PROPOSED |
| 27 | `priorStop` | التوقف عن عرض ما أعرفه | Stop showing what I know | PROPOSED |
| 28 | `firstNameTitle` | الاسم الأول للتعارف | First name for Introductions | PROPOSED |
| 29 | `firstNameHint` | الاسم الذي يُستخدم في التعارف، وقد يختلف عن اسم حسابك. | The name used in Introductions. It can differ from your account name. | PROPOSED |
| 30 | `sexTitle` | الجنس | Sex | PROPOSED |
| 31 | `sexHint` | يكون التعارف بين رجل وامرأة فقط. لا يستنتج قنديل هذه المعلومة من أي شيء آخر. | Introductions are only between a man and a woman. QANDEEL never infers this from anything else. | PROPOSED |
| 32 | `male` | ذكر | Male | PROPOSED |
| 33 | `female` | أنثى | Female | PROPOSED |
| 34 | `sexConfirmQuestion` | هل هذه المعلومة صحيحة؟ تأكيدها خطوة مستقلة عن إدخالها. | Is this correct? Confirming it is a separate step from entering it. | PROPOSED |
| 35 | `birthTitle` | شهر الميلاد وسنته | Month and year of birth | PROPOSED |
| 36 | `birthHint` | لا نطلب يوم الميلاد، وتبقى هذه المعلومة خاصة. | We don't ask for the day, and this stays private. | PROPOSED |
| 37 | `birthYear` | السنة | Year | PROPOSED |
| 38 | `birthMonth` | الشهر | Month | PROPOSED |
| 39 | `areaTitle` | المنطقة | Area | PROPOSED |
| 40 | `areaHint` | منطقة عامة فقط، دون عنوان. | A broad area only, no address. | PROPOSED |
| 41 | `country` | الدولة | Country | PROPOSED |
| 42 | `region` | المنطقة داخل الدولة | Region | PROPOSED |
| 43 | `maritalTitle` | الحالة الاجتماعية | Marital status | PROPOSED |
| 44 | `NEVER_MARRIED` | لم يسبق الزواج | Never married | PROPOSED |
| 45 | `DIVORCED` | مطلّق أو مطلّقة | Divorced | PROPOSED |
| 46 | `WIDOWED` | أرمل أو أرملة | Widowed | PROPOSED |
| 47 | `CURRENTLY_MARRIED` | متزوج أو متزوجة حاليًا | Currently married | PROPOSED |
| 48 | `factConfirmQuestion` | هل هذه المعلومة صحيحة؟ | Is this correct? | PROPOSED |
| 49 | `factReconfirm` | غُيّرت هذه المعلومة بعد تأكيدها. هل القيمة الجديدة صحيحة؟ | This changed after it was confirmed. Is the new value correct? | PROPOSED |
| 50 | `yesCorrect` | نعم، صحيحة | Yes, it's correct | PROPOSED |
| 51 | `edit` | تعديل | Edit | PROPOSED |
| 52 | `save` | حفظ | Save | PROPOSED |
| 53 | `cancel` | إلغاء | Cancel | PROPOSED |
| 54 | `hardTitle` | الشروط الأساسية | Dealbreakers | PROPOSED |
| 55 | `hardBody` | ما لا يمكن قبوله في شريك الحياة. | What you can't accept in a life partner. | PROPOSED |
| 56 | `hardNone` | لا توجد شروط أساسية إضافية | No additional dealbreakers | PROPOSED |
| 57 | `hardSet` | تحديد شروط أساسية | Set dealbreakers | PROPOSED |
| 58 | `systemRulesNote` | عند إتاحة التعارف، ستُطبَّق قواعد الأهلية المعتمدة، بما فيها السن القانونية. وهذه ليست شروطًا شخصية تختارها. | When Introductions becomes available, the approved eligibility rules, including the applicable legal age, will apply. These are not your personal dealbreakers. | CORRECTED — the Product Owner's future-facing wording (CP3 redesign brief), applied in VIS-2 |
| 59 | `softTitle` | التفضيلات | Preferences | PROPOSED |
| 60 | `softBody` | ما يُفضَّل لديك دون أن يكون شرطًا. | What you prefer, without it being a dealbreaker. | PROPOSED |
| 61 | `softNone` | لا توجد تفضيلات | No preferences | PROPOSED |
| 62 | `softSet` | تحديد تفضيلات | Set preferences | PROPOSED |
| 63 | `AGE_RANGE` | العمر | Age | PROPOSED |
| 64 | `MARITAL_STATUS` | الحالة الاجتماعية | Marital status | PROPOSED |
| 65 | `AREA` | المنطقة | Area | PROPOSED |
| 66 | `ageFrom` | من | From | PROPOSED |
| 67 | `ageTo` | إلى | To | PROPOSED |
| 68 | `ageRange` | من {min} إلى {max} | {min} to {max} | PROPOSED — words, not a dash: unambiguous in right-to-left text |
| 69 | `discrepancyTitle` | تعارض يحتاج إلى قرارك | A conflict that needs your decision | PROPOSED |
| 70 | `discrepancyBody` | أحد تفضيلاتك يقع خارج شرط أساسي في البند نفسه: | One of your preferences falls outside a dealbreaker on the same point: | PROPOSED |
| 71 | `editHard` | تعديل الشرط | Edit the dealbreaker | PROPOSED |
| 72 | `editSoft` | تعديل التفضيل | Edit the preference | PROPOSED |
| 73 | `prioritiesTitle` | ما الذي يهمك في شريك الحياة؟ | What matters to you in a life partner? | PROPOSED |
| 74 | `prioritiesHint` | بكلماتك. لا يراه أحد غيرك. | In your own words. No one else sees it. | PROPOSED |
| 75 | `shortIntroTitle` | نبذة قصيرة عنك (اختيارية) | A short introduction (optional) | PROPOSED |
| 76 | `shortIntroHint` | من 20 إلى 280 حرفًا. لا تُعرض على أحد قبل التوافق المتبادل. | 20 to 280 characters. Not shown to anyone before a mutual match. | PROPOSED |
| 77 | `workFieldTitle` | مجال العمل (اختياري) | Work field (optional) | PROPOSED |
| 78 | `skip` | تخطي هذه الخطوة | Skip this step | PROPOSED |
| 79 | `reviewLead` | هذه الصورة التي وصلنا إليها معًا. يمكنك مراجعتها وتعديل أي شيء لا يعبّر عنك. | Here's the introduction profile we've put together. Review it and change anything that doesn't feel right. | PROPOSED — controlled replacement of C06 (Arabic); English as approved |
| 80 | `reviewConfirm` | تأكيد المراجعة | Confirm review | PROPOSED |
| 81 | `reviewed` | اكتمل تحضيرك. التسجيل في التعارف غير متاح بعد، ويبقى ما أعددته محفوظًا لك وحدك. | Your preparation is complete. Enrolling in Introductions isn't available yet, and what you've prepared stays saved, for you only. | PROPOSED |
| 82 | `notesHeading` | ما يهمك | What matters to you | PROPOSED |
| 83 | `notSet` | لم يُحدَّد بعد | Not set yet | PROPOSED |
| 84 | `discard` | حذف التحضير | Delete preparation | PROPOSED |
| 85 | `discardConfirm` | سيُحذف كل ما أعددته هنا نهائيًا. | Everything you've prepared here will be deleted permanently. | PROPOSED |
| 86 | `discardYes` | حذف | Delete | PROPOSED |
| 87 | `unavailable` | التحضير للتعارف غير متاح الآن. | Preparing for Introductions isn't available right now. | PROPOSED |
| 88 | `deletionPending` | لا يمكن تعديل التحضير أثناء طلب حذف الحساب. | Your preparation can't be changed while your account deletion is pending. | PROPOSED |
| 89 | `changedElsewhere` | تغيّر التحضير من جهاز آخر، وهذه أحدث نسخة منه. | Your preparation changed on another device. This is the latest version. | PROPOSED |
| 90 | `noteLimit` | وصلت إلى الحد الأقصى من الملاحظات. | You've reached the most notes you can add. | PROPOSED |
| 91 | `failed` | تعذّر الحفظ. يمكن المحاولة مرة أخرى. | Couldn't save. Please try again. | PROPOSED |
| 92 | `invalid` | هذه القيمة غير مقبولة. | This value isn't accepted. | PROPOSED |
| 93 | `tryAgain` | إعادة المحاولة | Try again | REUSED meaning — PROPOSED wording |
| 94 | `back` | رجوع | Back | PROPOSED |
| 95 | `clusterAbout` | عنك | About you | PROPOSED — VIS-2 delta r1 (7.6) |
| 96 | `clusterBounds` | الشروط والتفضيلات | Dealbreakers and preferences | PROPOSED — VIS-2 delta r1 (7.6) |
| 97 | `clusterOpen` | لم يُحسم بعد | Not settled yet | PROPOSED — VIS-2 delta r1 (7.6) |
| 98 | `afterConfirmPrior` | عند التأكيد، يُضاف إلى تحضيرك بكلماتك كما هي. | Once confirmed, it's added to your preparation in your own words. | PROPOSED — VIS-2 delta r1 (7.6) |
| 99 | `added` | أُضيف إلى تحضيرك. | Added to your preparation. | PROPOSED — VIS-2 delta r1 (7.6) |
| 100 | `stateDeclared` | لم يُؤكَّد بعد | Not confirmed yet | PROPOSED — VIS-2 delta r1 (7.6) |
| 101 | `stateNotIncluded` | غير مُضمَّن | Not included | PROPOSED — VIS-2 delta r1 (7.6) |

### 7.4 Visual proof (320 dp, Arabic and English)

Native Android, the validation-only S4-01 proof root (`S401_SHARED_PROOF=1`; the product entry restored after the build; the
Introductions data come from the synthetic stand-in `s601-proof-introductions.ts`, never from the API). Built from `a3708210`;
APK SHA-256 `d16fa6a349dcf38fad4f8b6a4255efeed33c9f5696266a00b90ddeb4286d6924`. Emulator `QANDEEL_API36`, display overridden
to 640×1386 at 320 dpi (= 320 × 693 dp, recorded in `<leg>-device.txt`), app locale `ar-EG` / `en-US`. Flow
`apps/mobile/.maestro/s6-01-journey.yaml` — **PASS on both legs**, 21 screenshots each. The evidence stays outside the
repository, in `.s6-01-visual-proof/shots-ar-narrow/2026-10-14_005807` and `shots-en-narrow/2026-10-14_010051`.

| # | Screen |
|---|---|
| 01 | `closed-no-entry` — both gates closed, no draft: nothing drawn on the Personal row |
| 02 | `personal-row-entry` — preparation open: «التعارف مع قنديل» after «فهم قنديل» |
| 03 | `intro` — C01, C02 replacement, private note, enrollment unavailable, NEW path (C05 replacement), Start |
| 04 | `assistance-permission` — C03 (a) title, consent text v1, Allow / Continue without it at equal weight |
| 05 | `first-name` |
| 06 | `first-name-confirm` |
| 07 | `sex` — Male / Female, "never inferred" |
| 08 | `sex-confirm` — its own separate confirmation line |
| 09 | `birth` — month and year only |
| 10 | `area` — country, then region |
| 11 | `marital` — the four values |
| 12 | `dealbreakers` — "No additional dealbreakers" / set; the system-rules note |
| 13 | `preferences` — "No preferences" / set |
| 14 | `what-matters` — optional, private; Save / Skip |
| 15 | `work-field` — the thirteen broad fields |
| 16 | `review` — C06 replacement; every part editable («تعديل», the field named for the screen reader) |
| 17 | `reviewed` — complete; enrollment unavailable |
| 18 | `known-intro` — KNOWN path (C04 replacement), shown only with a CURRENT item |
| 19 | `known-item` — the owner's words quoted as stored; Yes / Correct the wording / No longer true / Don't use it; the Memory note |
| 20 | `mixed-conflict` — a preference outside a dealbreaker on the same point (Age) |
| 21 | `closed-read-only` — gates closed: the reason and the draft, read-only; Delete preparation |

Fixed after the first Arabic run (an earlier build, before `dbcc3ecf` / `26d215d9`): the opening crowded 320 dp in the display
role; primary acts drawn in a dim ink; choice labels centred; a new step inheriting the previous scroll position; the age
range written with a dash, ambiguous in right-to-left text. None remains.

Observed, and put to the Product Owner rather than changed (7.5): in English only, at 320 dp, (a) the approved C01 name wraps
to two lines in the title role; (b) the Personal row shows two entries side by side and truncates both («QANDEEL Un…»,
«Introductions w…»); the full name stays the accessible label. Arabic fits on one line in both places.

### 7.5 What the Product Owner is asked to decide

1. Approve, revise or reject each PROPOSED row (7.3), including the controlled replacements of C02–C06 and the two C03 rows.
2. Confirm C01 unchanged and C07 deferred (not displayed).
3. Approve the screen structure (7.1) on the 320 dp proof (7.4).
4. The two English-only 320 dp observations of 7.4: accept them as they are, or ask for a layout change (a smaller title
   role for a long name; the two Personal-row entries on two lines).

Until then the gate is OPEN, and S6-01 is not ready for merge (Task Contract §8 item 4).

### 7.6 VIS-2 / VIS-3 — the Living Portrait (direction A), natively

**Decision.** On 2026-10-14 the Product Owner approved the 94 rows and the C01–C07 treatment, required a redesign of the
experience («Living Introduction»), rejected the first prototype round, and then selected direction **A — Living Portrait**
over B — Editorial Intelligence, *approved with four binding refinements* (R1–R4), as the design reference for native
implementation. This section records how the native surface resolves each refinement. It is a presentation change only:
migration `0154`, the API and controller, the objective selector (N / K / C), confirmation and correction semantics, the
assistance permission and its revocation, account-deletion safety, draft versioning, SEC-MATCH-00, the closed enrollment
commands and every launch gate are unchanged.

**Structure.** One pure projection, `portrait-projection.ts` (`projectPortrait`), places the canonical `IntroductionsView`:
what the server says is settled is drawn on the World as the owner's portrait (`Portrait.tsx`, three groups: About you,
What matters to you, Dealbreakers and preferences); the one thing the current step is about waits in "Not settled yet"
(the band) with a ring mark; the current question is the one prominent act, on the Field (the sheet). The portrait is
never a second source of truth.

| | Refinement | Resolution |
|---|---|---|
| R1 | The portrait grows from real understanding | Only server-confirmed content is drawn: CONFIRMED facts, the owner's profile choices, the owner's notes (written, or confirmed from prior understanding — `0154` makes a PERSONAL_FACT an ABOUT_ME note, anything else WHAT_MATTERS) and answered requirements. DECLARED / CORRECTED facts, remembered items awaiting the owner and conflicts are in "Not settled yet" with a ring (awaiting confirmation) or an open ring (to decide), never inside the portrait. Nothing is drawn for what is missing: no empty diagram, no slot, no count; the beginning shows no portrait at all. A remembered item's destination is shown as a dashed landing place with words, never as content. |
| R2 | The question stays primary | While preparing, the portrait is COMPACT (each group keeps its newest words, two lines) unless the screen has room (≥ 720 pt at the reader's text size) or the owner opens it; it is always compact while the keyboard is up. The group name is the disclosure (button, `expanded` state; no new words). The question is a header in the 20/32 role and is where the screen reader arrives on every step. `KeyboardAvoidingView` keeps the sheet above the keyboard; the focused field is brought into view with its question above it, and a saved answer closes the keyboard so the next step is never left beneath it. The REVIEW step opens with its lead question, before the portrait it introduces. No fixed widths; text scales with the system. |
| R3 | REVIEWED is a meaningful portrait | The review (REVIEW step and REVIEWED) is the COMPOSED portrait: the first name in 24/38, confirmed facts as plain lines, the owner's priorities in their own quoted words, a dealbreaker as a closed outline and a preference as an open one (four corners) — shape and ink only (E1). Details and edits are disclosed per part by its own Edit (About you: the five facts, work field, short introduction; Dealbreakers and preferences: each side); every existing editor, correction, deletion, the assistance permission and Delete preparation remain. Skipped optional steps are named once ("Not included"). The completion line — the preparation is complete, enrolling is not available yet, it stays private — opens REVIEWED, before the portrait it completes. |
| R4 | Light communicates a real event | **Not authorized within scope; no light is used.** QANDEEL Light is governed by D2R (`docs/design/canonical-artifacts/qandeel-light/i-08b3.1-d2r/D2R_IMPLEMENTATION_BOUNDARIES.md` §1): its four categories (FIELD, DIRECTION, CONVERGENCE, EMERGENCE) are analytical events of the Analysis map, "a fifth kind of light event is a new Product decision", and "Meaning Light is never used for activity, loading, focus, selection or confidence". The mobile illumination tokens exist only in the Analysis map visuals (`map/visual/*.generated.ts`); the conversation palette carries none. The non-illuminated transition is used instead: after an APPLIED answer, the words that the change ADDED rise into place (opacity and a 12 pt rise, T-10 **M3** semantic disclosure, ≤ 260 ms, `QANDEEL_EASE_OUT`), "Added to your preparation." is written under them, and it is announced to the screen reader — whether or not motion runs. Reduced Motion shows the same words at once. Nothing is shown arriving before the server applied it; a declined item never lands. The narrowest legitimate amendment, should the Product Owner want light here later: a controlled amendment of D2R §1 admitting one new event kind ("owner-confirmed preparation content", Personal depth only, decaying to exactly zero, with a Reduced-Motion residue), owned by the visual-authority track — not by S6-01. |

**Typography** (the approved calmer hierarchy; local sizes on the shipped Estedad Medium face, no generated token and no
new weight): header 17/30 Medium; question 20/32 Medium; first name 24/38 Medium in the composed (review) portrait only;
body 17/30, supporting 15/25, action 14/23 Medium, metadata 12/20 from E3. The 32/50 statement role is no longer used here.

**Personal row.** The two entries («فهم قنديل», «التعارف مع قنديل») wrap onto two lines instead of being cut short; the row
is at least 44 pt (the W3 pin now reads `height ?? minHeight`). This resolves 7.4 observation (b).

**Copy delta r1** (`INTRODUCTIONS_COPY_DELTA` in `copy.ts`; rows 95–101 of 7.3) — accepted as a design direction,
**PROPOSED** until the Product Owner's final byte-exact approval. No other fixed copy was added; the disclosure controls use
the group names and the platform's own expanded / collapsed announcement.

| Key | Arabic | English | Where |
|---|---|---|---|
| `clusterAbout` | عنك | About you | the first group of the portrait |
| `clusterBounds` | الشروط والتفضيلات | Dealbreakers and preferences | the third group |
| `clusterOpen` | لم يُحسم بعد | Not settled yet | the band holding the current unsettled item; read-only unsettled facts |
| `afterConfirmPrior` | عند التأكيد، يُضاف إلى تحضيرك بكلماتك كما هي. | Once confirmed, it's added to your preparation in your own words. | inside the landing place of a remembered item |
| `added` | أُضيف إلى تحضيرك. | Added to your preparation. | under words that just arrived; announced |
| `stateDeclared` | لم يُؤكَّد بعد | Not confirmed yet | the accessible name of an item awaiting confirmation |
| `stateNotIncluded` | غير مُضمَّن | Not included | skipped optional steps in the review; an empty optional value in a part's details |

`systemRulesNote` carries the Product Owner's future-facing correction (row 58).

**Visual critique and corrective pass (on the native screens, before the proof).** One deliberate critique of the first
native runs (Arabic and English; 320 dp, then 1.3× text) found eight defects; each was corrected and is pinned by a test:

| # | Seen on the device | Correction | Commit |
|---|---|---|---|
| 1 | After Save, the keyboard stayed up over the next step (the declared value's confirmation, the Sex choice) | The keyboard closes as an answer is sent, while its field still exists (dismissing after the server's answer was too late: the step had already replaced the focused field) | `8c97e780`, `fe69c0a0` |
| 2 | REVIEW at 320 dp: the composed portrait filled the screen and its question was below the fold (against R2) | The review's lead question opens the screen; the portrait follows; Confirm review rests below | `8c97e780` |
| 3 | REVIEWED looked like REVIEW: "Your preparation is complete…" was below the fold (against R3) | The completion line opens REVIEWED, before the portrait it completes | `8c97e780` |
| 4 | English, 320 dp: Delete preparation opened its confirmation and Cancel below the fold, so nothing visibly changed | The page's last block is brought into view when the confirmation opens | `a0bfdd8b` |
| 5 | English: "Yes, that's right" / "Yes, it's correct" drawn as "Yes, that's" / "Yes, it's" (last word clipped after a re-render) | The primary label spans its button and is centred by alignment instead of being shrink-wrapped | `b7d80156` |
| 6 | 1.3× text, keyboard up: Save beneath the keyboard (the field's scroll was clamped before the keyboard shrank the page) | The field is placed again when the page shrinks; its act comes first, its question's context only when there is room; the step's own opening place is never re-applied while the keyboard is up | `02c4adc1`, `647e1455` |
| 7 | 1.3× text, English: "Not settled yet" broken inside a word beside "Stop showing what I know" | The caption never shrinks; the action wraps under it | `02c4adc1` |
| 8 | 1.3× text: the item, its question and its act did not fit under the 35 % portrait glimpse — and with a smaller glimpse "Added to your preparation." opened above the screen | 12 % glimpse at a large text size; whenever an arrival is shown, the step opens with that line in view | `02c4adc1`, `111b4664` |

**VIS-3 — native proof (APK `2fa4d300…` from `111b4664`, Android 16 emulator, the S4-01 proof entry over the S6-01
SYNTHETIC stand-in; nothing is a real person, a model or a launched capability).** Flow `apps/mobile/.maestro/s6-01-vis3-portrait.yaml`
(18 scenes: v01 Personal row · v02 NEW beginning · v03 KNOWN item awaiting confirmation · v04 after "Yes" (arrival, "Added") ·
v05 NEW first question · v06 keyboard up (field and Save in view) · v07 the declared value waits in "Not settled yet" · v08 confirmed ·
v09 MIXED conflict · v10 dealbreaker editor (hard beside soft) · v11 REVIEW · v12 Confirm review reached · v13 REVIEWED ·
v14 one part's details open · v15 its editor · v16 the last control reached and acted (Delete → Cancel) · v17 READ-ONLY (no Edit) ·
v18 Back to the same Personal world) and the regression journey `s6-01-journey.yaml` (21 scenes). Screenshots and contact sheets:
`.s6-01-visual-proof/vis3/` (local, untracked).

| Leg | Language | Width | Text | Motion | Journey | Portrait (18) |
|---|---|---|---|---|---|---|
| ar-narrow | Arabic | 320 dp | 1.0 | on | **PASS** | **PASS** |
| en-narrow | English | 320 dp | 1.0 | on | **PASS** | **PASS** |
| ar-normal | Arabic | 411 dp | 1.0 | on | — | **PASS** |
| en-normal | English | 411 dp | 1.0 | on | — | **PASS** |
| ar-large | Arabic | 320 dp | 1.3 | on | — | **PASS** |
| en-large | English | 320 dp | 1.3 | on | — | **PASS** |
| ar-still | Arabic | 320 dp | 1.0 | off (Reduced Motion) | — | **PASS** |

Screen-reader semantics on the device (uiautomator, Arabic and English): the item awaiting the owner is one element named
"Not confirmed yet: <words>" / «لم يُؤكَّد بعد: …»; the step's question is its own element; a group name is a disclosure; an open
part's control reads "Cancel: Dealbreakers and preferences", its rows "Edit: Dealbreakers" / "Edit: Preferences". While the
surface is open the Personal world beneath is hidden from accessibility: the compressed (accessibility-only) dump holds the
introductions surface and no node of the conversation (the full dump lists hidden views too). Reduced Motion
shows the same words and the same "Added" line (and the announcement is pinned in jest). No English label is truncated in any
leg; nothing undecided is drawn as known (v03, v07, v09); no score, percentage or matching state appears anywhere.
Device runs only: no hosted environment, no gate, no enrollment command.

### 7.7 VIS-3P — premium visual polish (Product Owner authorization 2026-10-14; one bounded cycle)

Focused visual craft on the approved direction A. **No copy was added or changed**: the seven VIS-2 rows (95–101) stay
**PROPOSED**, and the `systemRulesNote` correction is unchanged. No behaviour, sequencing, contract, consent, Memory,
deletion or enrollment change was made, and no test identifier changed. Only `IntroductionsParts.tsx`,
`Portrait.tsx`, `IntroductionsSurface.tsx` (secondary rows → chips) and their test were touched. The audit used the design
principles it names (Taste, High-End Visual Design, Impeccable, Redesign Existing Projects, Minimalist UI), applied to the
VIS-3 native screens:

| # | Weakness seen natively (VIS-3) | Principle | Correction | Component |
|---|---|---|---|---|
| 1 | REVIEWED: the name floated above its own part; the "About you" caption and its Edit separated it from the facts it heads | composition, hierarchy (High-End) | the name heads the About part (caption → name 24/38 → facts) in every mode | `Portrait` |
| 2 | every fact line had the same bright weight as the owner's words | hierarchy by ink, not size (Impeccable, Minimalist) | facts are the name's quieter subtitle (secondary ink); the owner's own words are the brightest text after the name | `Portrait` |
| 3 | quoted statements formed one undifferentiated stack; the opening mark broke the left (right, in Arabic) edge of every wrapped line | typographic craft (Taste) | hanging punctuation: the opening mark in its own column in the margin, both marks in the quiet ink; more space between statements | `Quote` |
| 4 | the parts ran together as a vertical report | rhythm, section transitions (High-End) | an even 22-point rhythm and a hairline between parts (the band's own hairline grammar) | `Portrait` |
| 5 | the open preference outline (four corner brackets) read as a camera viewfinder or debug overlay; strokes were heavy | intentional detail, restraint (Taste, Minimalist) | dealbreaker: closed hairline outline; preference: one bracket on the reading side; kind (secondary) › label (tertiary) › value (primary). Each frame is announced as one item that begins with its kind, so the meaning never depends on the shape | `Frame` |
| 6 | the landing place was a dashed box around a sentence, like a drop zone | meaningful destination (Redesign) | a blank dashed line opened by a quotation mark, where the owner's words will be written, with its existing sentence beneath | `Landing` |
| 7 | secondary choices were bare grey words with no affordance beside an outlined primary | interaction clarity (Impeccable) | quiet 44-point chips on the World's ground, aligned with the primary's edges, never outlined | `Action chip`, `ActionRow chips` |

**Critique and the one corrective pass** (APK `58e8225d…` from `530da7e6` → APK `530897e1…` from `4d992de6`):
(a) in Arabic the hung mark sat at the far side of its column, which Android resolves the text alignment against the
text's own direction. It is now placed by layout (`alignItems: 'flex-end'`), which mirrors. (b) The landing line clipped its
last dash; it now draws whole dashes only. (c) English chips wrapped 1 + 2 at 320 dp; with tighter padding they wrap 2 + 1,
as the words did.

**Native proof (final APK `530897e1…` from `4d992de6`)** — flow `s6-01-vis3-portrait.yaml` (the 18 scenes of §7.6). The
journey was re-run where the chips changed what is tapped. Screenshots: `.s6-01-visual-proof/vis3p/` (first pass in
`vis3p-pass1/`); before/after sheets beside them.

| Leg | Language | Width | Text | Journey | Portrait (18) |
|---|---|---|---|---|---|
| ar-narrow | Arabic | 320 dp | 1.0 | **PASS** | **PASS** |
| en-narrow | English | 320 dp | 1.0 | — | **PASS** |
| ar-normal | Arabic | 411 dp | 1.0 | — | **PASS** |
| ar-large | Arabic | 320 dp | 1.3 | — | **PASS** |
| en-large | English | 320 dp | 1.3 | — | **PASS** |

The screen reader (compressed dump, Arabic and English, KNOWN and REVIEWED) passes. Frames read "Dealbreakers, Area: Egypt"
and «الشروط الأساسية، المنطقة: مصر»; the hung opening mark is not announced; the conversation beneath contributes 0
nodes. The SR harness now scrolls to the Dealbreakers Edit before tapping it, because with the new rhythm that Edit sits
just below the fold at 320 dp in English. **Reused unchanged from VIS-3:** en-normal, and ar-still (Reduced Motion). The
arrival motion (`Arrival`) is unchanged, and the moved name keeps its arrival wrapper; Reduced Motion parity stays pinned in
jest.

An observation from that proof, corrected below (R1): at 320 dp in English, on the first KNOWN item (v03), the secondary chips
started just below the fold.

**VIS-3P R1 — secondary-choice discoverability (Product Owner final review of `0c8d1786`).** The PO required that the
correction, no-longer-accurate and decline choices for a remembered item be clearly discoverable beside "Yes". The fix
uses the smallest layout change, with no content, copy, target or semantic change:

- `353cd3e4`: a step whose item waits in the band (a decision) opens at least at the existing portrait glimpse. From
  there it scrolls further toward the page's end, where its choices are, as far as it can while the band (the complete
  remembered statement) and any arrival stay in view. The portrait keeps the room left above.
- `9c8f1faa`: the native large-text check found that the new reach could scroll "Added to your preparation." (R4) out of
  view, because that line was measured only once and sometimes before it was laid out. It is now measured whenever the
  place is applied (band layout, page size, and its own layout). Until then, the step keeps the glimpse.
- `fe3e0943` + `4e996fb1`: a repeated probe found a pre-existing placement race. The same probe on the earlier VIS-3
  build misplaced this step in 3 of 6 runs. The race came from two causes: a step's layout reported before the
  step-change effect (which then reset the page to the top), and a scroll applied while the native page still had the
  previous step's height (clamped to 0). Each step is now placed once by the first layout that reports it. The effect
  does not reset a placed step. The place is applied again over the next two frames, unless the owner scrolls or the
  keyboard comes up.

Native verification (final APK `45a8d9c5…` from `4e996fb1`):

- **Repeated KNOWN probe** (fresh app state each run): English 1.3× text, 10 of 10 placed, with "Yes" and all three
  choices in view and the band at the top. English 320 dp, 5 of 5 placed, with every choice and the memory note in view.
  Arabic 320 dp, 3 of 3 placed; two further runs met the emulator's render stall (a blank app window after many cold
  launches, also seen before this change).
- **Flow legs** `s6-01-vis3-portrait.yaml`, en-narrow, ar-narrow and en-large: **PASS** each. This includes the R4
  "Added" assertion after "Yes" and Save with the keyboard up.

At 1.3× text after an arrival, "Added" keeps priority: "Yes" and the first choice are in full view, and the next chip
row is visibly cut at the bottom edge, so more choices are evident. Evidence is in `.s6-01-visual-proof/vis3p-r1/`, with
the superseded builds' runs kept and labelled. The before/after ZIP is `S6-01-VIS-3P-final-before-after.zip`. The
emulator render stall needed two emulator restarts during this check; it is an environment limit (class C), not an app
defect.

## 8. Validation (actually run; proportional to each boundary)

### 8.1 CP2 — PostgreSQL and API

| # | Check | Where | Result |
|---|---|---|---|
| 1 | `verify-migration-0154` (own enumeration of the schema; gates; CAS; idempotency; validation; isolation; consent and reader; no Memory / attribution / Hypothesis / HIM write; revocation, first-write and deletion races on two connections; erasure `ERASED` with zero rows) | local disposable PostgreSQL 17 (embedded, port 55461), full migration chain | **PASS**, twice on the same database (fixtures removed and checked) |
| 2 | the same | GitHub focused workflow, `migration-0154`, on `dde3d289` | **PASS** — run [38390942196](https://github.com/allamqandeel/qandeel/actions/runs/38390942196) |
| 3 | `verify-migration-0149` (SEC-MATCH-00, `NO_BACKDOOR`, deletion baseline), `0150` (no `40001` escape), `0152` (Memory writers), `0153`, `0026` (Memory authority surface), `0132`, `0108`, `0109` — unchanged | local PostgreSQL 17 with `0154` applied | **PASS** each |
| 4 | `verify-migration-0130` (governed erasure, footprint) — unchanged | local | **PASS** on the second run; the first failed the known Windows clock-skew assertion (`grace <= 7`, class C, seen in S5-02) |
| 5 | `verify-migration-0133` (hosted default-privilege replay), `0134`, `0135` — unchanged | GitHub focused workflow on `dde3d289` (locally: no `psql`; `spawnSync npm.cmd EINVAL` on Node 24 — class C) | **PASS** — runs [38390947016](https://github.com/allamqandeel/qandeel/actions/runs/38390947016), [38390950974](https://github.com/allamqandeel/qandeel/actions/runs/38390950974), [38390955074](https://github.com/allamqandeel/qandeel/actions/runs/38390955074) |
| 6 | API: selector (N / K / C), service (exact shapes, fail-closed decoding, consent-gated reader, no phrasing provider), structural isolation, route census | `npx jest src/introductions-preparation src/http-security` | **152 / 152** |
| 7 | API full suite | `npx jest --ci` (apps/api) | **5780 / 5780** |
| 8 | Static contracts (every `tests/*.mjs` but the forward-safety mirror) | `node --test` | **1321 / 1321** |
| 9 | Verifier hazard lint | `node --test database/tests/verifier-hazard-contract-v1.test.mjs` | **33 / 33** (three H4 literal counts converted to deltas / exact lists) |

### 8.2 CP3 — mobile

| # | Check | Where | Result |
|---|---|---|---|
| 1 | Introductions surface (incl. the Living Portrait R1–R4, the copy delta and the corrective pass), controller, entry, transport, catalogue / consent-text parity with `0154`, copy-gate integrity (C01 unchanged, C07 never displayed, no dialect in Arabic rows) | `npx jest src/introductions src/runtime-entry` | **314 / 314** (on `111b4664`) |
| 2 | Proof stand-in guard; W3 Personal-row pin | `npx jest src/integration/__tests__/s6-01-proof-introductions src/integration/__tests__/w3-settings-appearance-signout` | **19 / 19** |
| 3 | Mobile full suite | `npx jest --ci` (apps/mobile), on `111b4664` | **2474 pass, 6 fail** — exactly the known `ar-EG` host-locale baseline (`depth.test.tsx` 3, `w2-account-access.test.tsx` 3: English labels expected, Arabic rendered; class B, recorded since S5-03A) |
| 4 | Typecheck; lint of every touched file | `tsc --noEmit`; `eslint` | clean; no error (pre-existing warnings only, in lines this task did not change) |
| 5 | VIS-3 native proof, seven legs + screen-reader dump | §7.6 | **PASS** every leg |
| 6 | VIS-3P: Introductions surface + runtime entry (incl. two new VIS-3P tests: hierarchy, hung quiet marks, frame announcements, chips, landing) | `npx jest src/introductions src/runtime-entry`, on `4d992de6` | **318 / 318** |
| 7 | VIS-3P: proof guard, W3 Personal row, Activity surfaces | `npx jest src/integration/__tests__/s6-01-proof-introductions src/integration/__tests__/w3-settings-appearance-signout src/activity/__tests__/surfaces` | **40 / 40** |
| 8 | VIS-3P: typecheck; lint of the touched files | `tsc --noEmit`; `eslint src/introductions` | clean |
| 9 | VIS-3P native proof, five legs + screen-reader dump | §7.7 | **PASS** every leg |
| 10 | VIS-3P R1: Introductions surface + runtime entry (incl. three new placement tests: the decision's reach, the arrival kept in view before and after it can be measured) | `npx jest src/introductions src/runtime-entry`, on `4e996fb1` | **322 / 322** |
| 11 | VIS-3P R1: proof guard, W3 Personal row, Activity surfaces; typecheck; lint | as rows 7–8, on `4e996fb1` | **40 / 40**; clean |
| 12 | VIS-3P R1 native: repeated KNOWN probe and three flow legs | §7.7 | **PASS** (probe 18 of 18 placed on the runs the emulator rendered) |

### 8.3 CP4 — the closing change (proportional)

The closing change touches documentation and one contract pin. No code, migration, copy row or screen changes in it.
- **Code:** no file under `apps/`, `packages/` or `database/` changed after `4e996fb1`, so rows 10–12 of 8.2 still stand
  for the code.
- **Database and API:** neither `database/` nor `apps/api/src/introductions-preparation` changed after `dde3d289`, so
  the focused runs of 8.1 still stand. The only API change in that range is the LANG-01 merge from `main`.
- **Native proof:** not repeated, because nothing it covers has changed.

| # | Check | Where | Result |
|---|---|---|---|
| 1 | Task-closure governance (BG-09, closure rules) | `npm run test:task-closure-governance-contract` | **24 / 24** |
| 2 | SEC-MATCH-00 contract, `QAN-BL-MATCH-01` pin re-anchored to S6-07 plus its `ACCT-DEL-01` dependency | `node --test tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs` | **9 / 9** |
| 3 | Every static contract except the forward-safety mirror (incl. the S6-01 locator pins of s5-03b, s5-03c and shared-vis-01) | `node --test tests/*.test.mjs` | **1332 / 1332** |
| 4 | Seven-row byte check: rows 95–101 of §10.4 against `copy.ts` | a one-off byte comparison (Arabic and English) | **7 / 7 identical** |
| 5 | Exact-head CI (API CI, Mobile CI) on the pull request's final head | GitHub, PR #339 | Reported on the pull request. A record cannot carry the result of the commit that contains it |
| 6 | Copy Gate closure (2026-10-14): rows 95–101 of §10.4 re-checked byte for byte against `copy.ts`, and the governance, SEC-MATCH-00 and static contracts re-run. The change is documentation only, with no file under `apps/`, `packages/` or `database/` | as rows 1–4 | **7 / 7 identical**; **24 / 24**; **9 / 9**; **1332 / 1332** |
| 7 | CI-R1, iOS driver readiness (2026-10-14; Product Owner's CI-R1 authorization). On `4b94c04d` (run `38570981700`) the iOS consumer failed with Maestro's `IOSDriverTimeoutException` after 185 s, before any app launch. The same failure hit unrelated code on `be73bdc5` (run `38222765239`). Cause: Maestro 2.10.0 waits a fixed 120 s for its XCTest driver unless `MAESTRO_DRIVER_STARTUP_TIMEOUT` is set, so that limit fired before the 300 s readiness bound could. Fix, CI only and in `.github/workflows/mobile-ci.yml` `verify-ios` alone: `MAESTRO_DRIVER_STARTUP_TIMEOUT=300000` (the value of `t12-phase-m-cloud-validation.yml`); the readiness bound 480 s / step 9 min, which encloses it; a failure-only, read-only log step. No Product file, assertion or other job changed | `node --test` VAL-01, QAN-INF-04, mobile-foundation and native-impact contracts; then as row 3; then exact-head Mobile CI | **73 / 73**; **1332 / 1332**; CI on the pull request |

## 9. `QAN-BL-MATCH-04` — admitted at CP1

The Product Owner approved the admission in principle after a focused anti-duplication check (D7). The check and the
item are in the [canonical backlog](../qandeel-canonical-backlog-v1.md) §5 and §7. Owner: `Stage 8A — QANDEEL AI Brain
/ Production LLM Runtime`. `QAN-BL-MATCH-03` keeps the compatibility conclusion producer.

## 10. Closing change (BG-08 / BG-09)

Recorded at CP4 (2026-10-14), under the Product Owner's direction "S6-01 — Final CP4 Closure Only".
- **Before the closing change:** the branch head was `d0b98ee2a095617443a8c1a49f683f8f185b46eb`. It contains `main` at
  `8bc10060bb5ebb05f0cdec24523b1907ba4b4b18` (the merge of PR #338).
- **The closing change:** documentation and one re-anchored contract pin. It changes no code, migration, copy row or
  screen.
- **Pull request:** one draft, PR #339.

*As planned at CP1:* `QAN-BL-MATCH-01` re-owned to `S6-07 — Activity, Direct Entry and Final Integration`, with a
mandatory dependency on `ACCT-DEL-01`; it is not tombstoned while the six commands stay closed.

### 10.1 Closure statement (§0, unchanged)

> **Preparation functionality delivered — real enrollment still unavailable — actual Matching intelligence not yet
> complete — no production deployment — no launch clearance.**

S6-01 is not "Intelligent Matching complete".

### 10.2 BG-08 — every item the task inherited or bore

| Item | How S6-01 met it | Disposition at closure |
|---|---|---|
| `QAN-BL-MATCH-01` | inherited (owner S6-01) | **Re-owned** to `S6-07 — Activity, Direct Entry and Final Integration`, with a mandatory dependency on `ACCT-DEL-01` (D1); effective from the merge. Not tombstoned: the six `0149` commands stay closed. `HIGH`, `DEFERRED — OWNED`, unchanged |
| `QAN-BL-MATCH-04` | admitted at CP1 (D7; §9) | Stage 8A, `DEFERRED — OWNED`, unchanged |
| `QAN-BL-ACCT-01` | bearing | **Unchanged**, `OPEN — UNASSIGNED`. S6-01 adds no deletion-blocking footprint (§5.2). The `ACCT-DEL-01` name still needs the Product Owner's confirmation (backlog §5, D3 note). S6-01 does not close or absorb the dependency |
| `QAN-BL-PROD-06` | bearing | Unchanged; S6-01 adds no `40001` path (§1.3) |
| `QAN-BL-PRIV-04` | bearing | Unchanged, owner S6-07; the export of the preparation draft is inside its scope |
| `QAN-BL-MATCH-02`, `QAN-BL-MATCH-03` | bearing | Unchanged |
| `QAN-BL-LAUNCH-04` | bearing | Unchanged; Issue #322 stays OPEN as a release blocker |

**BG-06 — new residue: none admitted.**
- Every deferral S6-01 makes already has an owner:
  - natural-language phrasing and understanding readiness: `QAN-BL-MATCH-04`;
  - the compatibility conclusion: `QAN-BL-MATCH-03`;
  - the export of the draft: `QAN-BL-PRIV-04`;
  - enrollment and the Introductions Settings group: `QAN-BL-MATCH-01`;
  - gate opening: CW2-08 / Stage 9.
- The Copy Gate rows were an active-task decision and stayed here (BG-01). The Product Owner approved them 7 / 7 on
  2026-10-14, so nothing about them is left for a successor (§10.4).
- An optional D2R §1 light amendment (7.6, R4) is a possible future Product decision, not an obligation.

**Register:** 68 items; 32 / 4 / 10 / 22 by status; 37 / 29 / 2 by severity. It was recounted mechanically, and a
re-owning changes no count.

**BG-09:** this record's banner moves from its CP1 state to its closure state in this same change.

**Locators** updated in the same change:
- the [canonical backlog](../qandeel-canonical-backlog-v1.md): §4 index row, §5 item, §7 paragraph, §9 rows for
  S6-01 and S6-07;
- `QANDEEL_CURRENT_STATE.md`;
- `QANDEEL_PROJECT_MAP.md`;
- `QANDEEL_PRODUCT_ROADMAP.md` §6.10;
- the `QAN-BL-MATCH-01` index-row pin in `tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs`
  (re-anchored, validation only).

### 10.3 Enrollment and launch gates: all closed

- The two operator gates, `PREPARATION` and `ONBOARDING_ASSISTANCE`, are absent, which means closed. S6-01 opens neither,
  on any environment.
- No enrollment can happen:
  - the six `0149` commands stay closed;
  - `NO_BACKDOOR` and the SEC-MATCH-00 protections are unchanged;
  - no migration after `0149` names any of the six (pinned by the SEC-MATCH-00 contract);
  - `verify-migration-0149` and `0150` pass unchanged (§8.1).
- Nothing is deployed. Migration `0154` has not reached the hosted database, and `QAN-BL-PROD-06` still gates hosted
  deployment.
- There is no production LLM and no compatibility inference: the phrasing port is `UNBOUND` (§6.2).
- The CW2-08 launch gates are closed, and Issue #322 stays OPEN.
- The native proof ran only on the validation-only S4-01 proof root, over a synthetic stand-in (§7.4). The product entry
  is unchanged.

### 10.4 Product Owner decisions

1. **The Product Copy Gate for the seven VIS-2 delta rows — APPROVED, 7 / 7 (Product Owner, 2026-10-14).**
   - **Decision:** the S6-01 Final Product Copy Approval, which approves the exact Arabic and English below, as
     `copy.ts` holds them, without modification. It closes the gate (§7).
   - **Check:** the wording was re-checked byte for byte against `copy.ts` after the decision (§8.3, row 6).
   - **Before the decision:** item 1 stood open, and the seven tags stayed PROPOSED.

   *As written at CP4:* "They have not been approved; their formal decision is not recorded anywhere", and "Until that
   decision the gate stays open for these rows (Task Contract §8 item 4)."

   | # | Key | Arabic | English |
   |---|---|---|---|
   | 95 | `clusterAbout` | عنك | About you |
   | 96 | `clusterBounds` | الشروط والتفضيلات | Dealbreakers and preferences |
   | 97 | `clusterOpen` | لم يُحسم بعد | Not settled yet |
   | 98 | `afterConfirmPrior` | عند التأكيد، يُضاف إلى تحضيرك بكلماتك كما هي. | Once confirmed, it's added to your preparation in your own words. |
   | 99 | `added` | أُضيف إلى تحضيرك. | Added to your preparation. |
   | 100 | `stateDeclared` | لم يُؤكَّد بعد | Not confirmed yet |
   | 101 | `stateNotIncluded` | غير مُضمَّن | Not included |

2. **Still pending: the merge of PR #339.** Merging needs the Product Owner's separate explicit authorization.
   Deploying and opening any gate each need their own authorization too.

Outside S6-01, and not a condition of this merge: the Product Owner's confirmation of the `ACCT-DEL-01` name
(`QAN-BL-ACCT-01`, WP0 addendum D3). It gates the S6-07 enrollment path, not this pull request.
