# QANDEEL — S6-01 — Intelligent Matching Onboarding — Implementation Record v1

**Status:** `S6-01` — **IN PROGRESS — CP1 (authority and field contracts) recorded.** Not merged, nothing deployed, no
gate opened. CP2 (database and API), CP3 (copy / visual gate and mobile) and CP4 (exact-head verification and closure)
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

## 5. Database contract (CP2)

*Recorded at CP2.*

## 6. Application and onboarding contract (CP2 / CP3)

*Recorded at CP2 and CP3.*

## 7. Product Copy and Visual Gate (CP3)

*Recorded at CP3.* The historically approved C01–C07 pairs are preserved here verbatim when the gate package is
recorded, beside each controlled replacement; none is silently rewritten.

## 8. Validation

*Recorded per checkpoint.*

## 9. `QAN-BL-MATCH-04` — admitted at CP1

The Product Owner approved the admission in principle after a focused anti-duplication check (D7). The check and the
item are in the [canonical backlog](../qandeel-canonical-backlog-v1.md) §5 and §7. Owner: `Stage 8A — QANDEEL AI Brain
/ Production LLM Runtime`. `QAN-BL-MATCH-03` keeps the compatibility conclusion producer.

## 10. Closing change (BG-08 / BG-09)

*Recorded at CP4.* Planned: `QAN-BL-MATCH-01` re-owned to `S6-07 — Activity, Direct Entry and Final Integration`, with
a mandatory dependency on `ACCT-DEL-01`; it is not tombstoned while the six commands stay closed.
