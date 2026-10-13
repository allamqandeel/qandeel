# QANDEEL — Stage 6 WP0 — Matching & Introductions — Repository Truth, Product Gap Census & Execution Plan — Record v1

**Task:** `Stage 6 — Matching & Introductions Kickoff`, work package `WP0 — Repository Truth, Product Gap Census & Execution
Plan`, authorized by the Product Owner's Stage 6 / WP0 brief (2026-10-13).
**Task type:** research and planning evidence, plus the one governance admission the Product Owner approved in the same
brief (Issue #322 → `QAN-BL-LAUNCH-04`, §9). After the Product Owner reviewed it the same day, this record also records
the Product Owner's decisions (§14): first Tier 0, then the consolidated final approval package. It covers every gate,
the binding fixed-Arabic-copy language rule and the approved seven-task map, and records three admissions:
`QAN-BL-MATCH-02`, `QAN-BL-MATCH-03` and `QAN-BL-PRIV-04`. A final decision addendum (§14.14) resolves GATE-16 and the
remaining questions and admits `QAN-BL-PRIV-05`. WP0 is not S6-01 and does not start, resume or contract it.
**Baseline:** `main = 135142004097136336d586e5d5ff6cfd119cd864`, the merge of PR #334 (GOV-REC-01). It was verified on
GitHub on 2026-10-13, matching the Product Owner's stated starting point. Issue #322 was read on GitHub the same day:
`OPEN`.
**Branch:** `s6/s6-wp0-matching-introductions-census`.
**Status:** `WP0 RESEARCH / PLANNING EVIDENCE AND PRODUCT OWNER DECISION RECORD — EVERY WP0 GATE DECIDED AT THE LEVEL §14 STATES (2026-10-13); SUB-QUESTIONS OPEN (§14.9) — APPROVED PRODUCT INTENT ONLY — AUTHORIZES NO IMPLEMENTATION, MIGRATION, DEPLOYMENT OR S6-01 TASK CONTRACT`.
*(First published at `30dff6f6` as `WP0 RESEARCH / PLANNING EVIDENCE — AWAITING PRODUCT OWNER REVIEW — CREATES NO PRODUCT
AUTHORITY — AUTHORIZES NO IMPLEMENTATION`.)*

> Everything in this record labelled PROPOSED or RECOMMENDED is for the Product Owner's review. Nothing here is approved,
> freezes a Product decision, fixes a task count, writes a Task Contract or authorizes implementation. No runtime,
> migration, API, screen, copy or frozen Product contract was changed. The only register change is the approved
> admission in §9.
>
> *(2026-10-13, after the Product Owner's decisions:)* the Product Owner has decided every gate at the level §14 records; the sub-questions those decisions leave open
> are listed in §14.9. Those decisions are
> approved Product intent, direction or initial policy proposals, and none authorizes implementation. The register
> changes are the admission in §9 and the three admissions in §14.4. Still true:
> - no runtime, migration, API, screen, copy or frozen Product contract was changed;
> - no Task Contract is written;
> - every proposed copy replacement (§14.8) and every controlled amendment (§14.7) awaits the Product Owner's approval.

---

## 1. Authority, baseline and method

**Authority.** The Product Owner's Stage 6 / WP0 brief (2026-10-13). Its rules:

- Repository truth over document claims.
- I-07 stays `CLOSED / FROZEN`. Matching v1 is exactly one capability, `MARRIAGE_INTRODUCTION`: private by default,
  hosted from `MY_WORLD`, mediated by QANDEEL. It is never a dating feed, directory, marketplace, direct-contact channel
  or second Shared World. A Mutual Match creates the Introduction Shared World through the existing lifecycle.
- `QAN-BL-MATCH-01`: Stage 6 must not simply restore the 0149 grants. Introduce no unauthorized enrollment,
  deletion-blocking footprint or privacy bypass.
- Invent no UI copy, screens or behaviour. Write no Task Contracts before the Product Owner approves the WP0 plan.
- One tightly scoped preparation PR (this admission plus this evidence). Proportional validation. No merge without the
  Product Owner's explicit order.

**Read in full or in the relevant parts** (AGENTS.md §1 order): `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`,
`QANDEEL_PRODUCT_ROADMAP.md`, the canonical backlog (BG-01…BG-09, the items in §8 below, the I-07 closure record), the
Canonical Authority Index, `docs/matching-introduction-runtime-v1.md` (I-07A–D, §47 SEC-MATCH-00, §48 PROD-RETRY-01),
CW2-00…CW2-08 and CW2-08A, the Matching Product Definition v1 (a Product Vision, not a freeze), I-08A4, G2 / G2.3 / G3,
P1–P4, I-08N-01, VI-01, W3-PDG-01, ACE-SP-01 and its amendment, the E2E-01 census and gap matrix, the SEC-MATCH-00,
PROD-RETRY-01, A3-01, A3-02, S4-01…S4-04, S5-04, SHARED-VIS-01, CI-01 C0 and GOV-REC-01 records, and the SQL of
migrations 0075, 0083, 0089, 0090, 0108–0122, 0130, 0135, 0136, 0138–0143, 0148–0153.

**Method.** Two read-only research passes over the detached baseline:

1. **Census.** Nine independent readers, one per area: frozen CW2 architecture; frozen Product / design / copy; the I-07
   record; database setup and proposals (0108–0112, 0120, 0149, 0150); database Mutual Match, Introduction and the Shared
   World interplay (0113–0119, 0122, 0138–0141, 0148); API, mobile, tests and CI (anti-duplication); the MATCH-01 safe-path
   design space; the intelligence boundary (Stage 8A / 9); governance and Issue #322. 387 evidence-cited findings.
2. **Synthesis and verification.** Two journey-census agents (J01–J06, J07–J12), one MATCH-01 design agent, three
   independent task decompositions (risk-first, journey-first, aligned with the Product Owner's local sketch), a judge
   panel, an adversarial verifier and a completeness critic.

The adversarial verifier re-read the repository for 43 load-bearing claims: **38 CONFIRMED, 5 PARTLY TRUE, 0 REFUTED.**
Its corrections are applied throughout and listed in §2.8. WP0 executed nothing against a database: every claim here was read from
code, SQL and documents, and the 43 load-bearing claims were re-read by the verifier. The marker *(read from code, not
executed)* flags claims whose truth depends on runtime behaviour. Line numbers cited for the backlog, Current State and
Project Map are those of the baseline `13514200`, before this change's own insertions.

The Product Owner's local planning notes (2026-10-09 and 2026-10-10) were used only as a comparison point (§6, §7.5,
§8.4; GATE-02, GATE-11). They are not repository authority, and nothing here cites them as authority.

---

## 2. Repository truth — what Matching / Introductions implements today

### 2.1 The database runtime exists and is frozen

The I-07 runtime is complete at the database level and `CLOSED / FROZEN` (record banner; backlog `### I-07 closure
record`, which inherited and admitted nothing and does not claim launch readiness).

| Slice | Migrations | What exists |
|---|---|---|
| I-07A setup | 0108, 0109 | 14 private setup relations. 11 human commands deriving the human from `auth.uid()`: activate, pause, resume, turn off, grant / revoke the Matching Context Grant, set the Introduction Profile (create and correct are one function), set requirements, grant / revoke the Pre-Match Disclosure Authority, self-inspection. |
| I-07B proposals | 0110–0112, 0120 | Canonical pair, eligibility snapshots, PASS / FAIL / UNKNOWN, private reasoning notes, conclusion candidates, the Sensitive Conclusion Filter, the disclosure gate, recipient views, the 11-state proposal choreography and neutral recipient projections. |
| I-07C Mutual Match | 0113, 0114 | One atomic, exactly-once Mutual Match that births one `SHARED_WORLD` `ACTIVE` / `INTRODUCTION` / `MUTUAL_MATCH`, one HELD slot per human, competing proposals closed neutrally, an immutable Match Handoff Package. |
| I-07D lifecycle | 0115–0118 (+ 0119 Introduction branches, 0122) | Owner-only, non-reciprocal progressive disclosure over five resource types; owner deletion of payload and verifier (0122); dual-approval SUCCESS to `STANDARD` on the same `world_id`; unilateral, ungated END to `READ_ONLY_CLOSED` / `INTRODUCTION`; explicit post-Introduction reactivation; ordinary human and QANDEEL material in an Introduction-phase World. |
| Amendments | 0149 (§47), 0150 (§48) | SEC-MATCH-00 narrowed six setup commands to owner-only. PROD-RETRY-01 made the retained commands' stale refusals non-retryable (`PT409`). |

Every relation is RLS-enabled with zero policies; every user foreign key is `ON DELETE RESTRICT`; immutability and
truth triggers refuse DELETE. `INTRODUCTION` is a **phase** of `SHARED_WORLD` (0075 CHECKs), not a World kind, and the
Connected Worlds kernel already encodes the Matching laws (`MATCHING` / `INTRODUCTION` are non-World kinds; a
`MUTUAL_MATCH` birth must be phase `INTRODUCTION` with exactly the matched pair; `ADD_MEMBER` is unavailable).

### 2.2 Who can execute what (after every migration through 0153)

- **`authenticated` — five I-07A boundaries only:** `pause_matching_participation_v1`, `turn_off_matching_participation_v1`,
  `revoke_matching_context_v1`, `revoke_pre_match_disclosure_authority_v1`, `get_my_matching_setup_v1`. Reachable only by
  a direct Data API RPC; no API route or screen calls them. The four reducers answer `PT409` on stale state (0150).
- **Owner-only (0149:57-87, revoked from PUBLIC, anon, authenticated, service_role and every other grantee):**
  `activate_matching_participation_v1`, `resume_matching_participation_v1`, `grant_matching_context_v1`,
  `set_introduction_profile_v1`, `set_matching_requirements_v1`, `grant_pre_match_disclosure_authority_v1`. A replay of a
  committed call answers `42501`. They still raise `40001` at 13 sites.
- **I-07B–D cores — executable by no role, `service_role` included:** discovery, evaluation, conclusion, filter, disclosure
  gate, offer / forward / decline / withdraw, expiry and revalidation, the recipient projections, Mutual Match, disclosure
  commit, SUCCESS, END and reactivation (0111:1116-1146; 0112; 0114; 0115:1496-1503; 0116:1655-1684; 0117:495-504; 0120).
- **Two `service_role` grants, both read-only:** `resolve_shared_world_introduction_disclosure_v1` (0115:1504) and
  `resolve_shared_world_history_visibility_v1` (0119:1798), whose body branches on `ACTIVE` / `INTRODUCTION` and
  `READ_ONLY_CLOSED` / `INTRODUCTION`. No API code calls either.
- **Latent, through Stage 4:** `authenticated` already holds EXECUTE on the S4-02 wrappers. `send_shared_world_human_text_v1`
  reaches the material core that 0118 widened to `ACTIVE` / `INTRODUCTION` (0139:186-200 → 0090 → 0118:262-283), and
  `delete_own_shared_world_material_v1` reaches the owner deletion that erases Introduction disclosures (0139:489-511 →
  0143:515-575). This is unreachable today only because no Introduction World can be born.

### 2.3 Five fail-closed seams and no policy

- Four CW2-08 prerequisite seams always answer `NOT_EVALUATED`, each checked last: proposal delivery and decisions
  (`resolve_matching_proposal_prerequisites_v1`, 0111:305-317), Introduction disclosure (0115:603-610), Introduction SUCCESS
  (0116:795-802) and post-Introduction reactivation (0117:219-226). END consults no seam (deploy-time assertion,
  0116:1905-1912). The setup commands have no seam.
- `resolve_matching_canonical_first_name_v1` always answers `UNRESOLVED_NO_CANONICAL_SOURCE` (0111:328-344), and a
  recipient view requires `RESOLVED` (0120:475-479). P1 §4 has since frozen a separately confirmed **Introduction First
  Name**; no store exists. The seam's comment that `public.users` has no name is stale since 0123 added `users.name`,
  which P1 still rules out as the source.
- No proposal policy row ships: cadence, pending maximum, expiry, `PROPOSAL_SAFE_FIELDS`, the filter policy (0110:241-260).
  The disclosure gate raises `MATCHING_PROPOSAL_POLICY_UNCONFIGURED` (0120:455-460).
- A recipient view requires a filter-`PERMITTED` Safe Compatibility Conclusion (0120:462-472). The conclusion is
  caller-supplied, untrusted input (0111:804-808), and **nothing in the repository produces one**: no model path, no
  template, no AI-COST feature family (0135:96-98), no eval suite, no backlog owner. *(Since the Product Owner's GATE-03
  decision of 2026-10-13, the production capability has an owner: `QAN-BL-MATCH-03`, Stage 8A; §14.)*

**Consequence** *(read from code, not executed)*. No proposal, Mutual Match or Introduction can occur in any deployed or
deployable configuration, even if EXECUTE were granted.

### 2.4 API, mobile, packages

- **API:** `apps/api/src/connected-worlds/matching/` holds four type-only vocabulary files that no TypeScript file imports
  (only `database/tests` read them, as text). No Matching / Introductions module, controller, service, repository or
  route exists; `app.module.ts` composes none.
- **Mobile:** no Introductions screen, entry, placeholder, Settings group or Direct Entry kind. The Global Switcher has
  exactly three areas (correct for Connected Worlds v2).
- **Existing Introductions plumbing (A3-01 / A3-02):** Activity category / context / destination `INTRODUCTIONS` and kind
  `INTRODUCTION`, with an L0 lock default (0136:102-128, :196); `INTRODUCTIONS_ENTERED` is the compile-time constant `false`
  (`activity-decision.ts:22-23`), so every Introductions item is silenced and the destination answers `UNAVAILABLE`; the
  Notifications group and Lock Screen row are hidden until `introductions.available`; push copy and the
  `category-introductions` channel exist; only three push-education moments exist (the Introductions moment is not built).
- **Two pre-entry artefacts a user can see today:** the «التعارف» Activity filter chip is always drawn and always empty
  (`ActivitySurface.tsx:162`), and the Android notification channel «التعارف» is registered unconditionally at push start
  (`push-controller.ts:84-87, 150-153`; `push/copy.ts:68-70`), so it shows in OS settings. Whether either is consistent with
  I-08N-01 D26 is a Product Owner question (§10, GATE-13).
- **Nothing produces anything:** no orchestrator, scheduler, worker, sweeper, policy writer, Introductions Activity
  producer, conversational doorway, media store or upload path.

### 2.5 Shared World interplay — a latent account-Name leak *(read from code, not executed)*

The S4 Shared reads and work paths gate on `lifecycle = 'ACTIVE'` (or on a core that admits `ACTIVE` / `INTRODUCTION`),
never on `phase = 'STANDARD'`. Those marked † also project the account Name (`users.name`):

- 0138: the World list (:607), the member list† (`u.name` :623, gate :625) and the entry verdict (:669);
- 0139: the material list† (`author_name` :139, gate :130); the send path (no gate of its own; the 0118 core admits
  `ACTIVE` / `INTRODUCTION`, 0118:268-283); the QANDEEL reply lease (:331-333);
- 0141: the Shared Activity recipient derivations† for `HUMAN_TEXT` (:65-78), `BIRTH` (:135-144) and `JOINED` / `LEFT`
  (:128-134, :146-156), and the alerts read (:174-190);
- 0148: the membership reader (:252-256), which gates the place-sources read† (`u.name` :590);
- `apps/api/src/shared-world/shared-conversation-model-input.ts:26-47`† (the speaker's name in the provider prompt,
  rendered at :46).

If an Introduction World were born, it would be listed in the Shared root and switcher, enterable through
`qandeel://shared/world/<id>`, conversable under the `SHARED_CONVERSATION` gate, notified as `SHARED` L2 Activity naming
the actor, and answered by the world-neutral ACE-SP-01 reply path with the account Name in the prompt. P1 §13 permits only
the Introduction First Name before the owner's `FULL_NAME` disclosure. Only 0140 governance and the 0141 proposal branch
filter `STANDARD`; 0148:310 refuses semantic work outside `ACTIVE` / `STANDARD`.

Conversely, every closed-World and former-own-material read is `STANDARD`-only (0140:495-512, 527, 554) and Shared leave
refuses `INTRODUCTION` (0083:327-333, reached through the 0140 wrapper at 0140:711).
So an **ended** Introduction would vanish from the Product, its
owners could not find their own words to delete them, and END has no route. No backlog item records any of this.

*(2026-10-13, after the Product Owner's GATE-03 decision:)* the account-Name exposure is now `QAN-BL-MATCH-02`, owned by
`S6-02`. The ended-Introduction, closed-view and END-route findings are still not register items: GATE-03 did not admit
them. The re-verification behind that admission corrected this section in three places (§14.10):
- the 0141 derivations do not name the actor to the counterpart;
- the 0148 place-sources read cannot be reached before SUCCESS;
- the citations are more precise.

### 2.6 Tests and CI

- API CI applies every migration to fresh PostgreSQL and runs every I-07 verifier (grouped I-07A / B / C / D steps, plus
  0119, 0120, 0122, 0149 and 0150), and proves the 0149 / 0150 refusals on the wire on PostgREST v12.2.9, v13.0.8, v14.18 and
  v16.4.
- The seven I-07 static contracts under `database/tests` run in API CI only indirectly: `npm run test:database`
  (`package.json:11`) is invoked inside `npm run verify:him-measurement-preflight` (`package.json:200`), which the
  `verify-api` job runs as the step "Verify HIM structured-measurement preflight" (`.github/workflows/api-ci.yml:146`).
  No CI step names them. The only Matching root contract CI runs by name is
  `tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs`.
- CI-enforced fences that any reopening must amend deliberately: the SEC-MATCH-00 contract (forward-regression check,
  0108 / 0109 sha256 pins, the MATCH-01 owner string, the ACCT-01 `UNASSIGNED` row, the I-07 banner); verify-0149
  `NO_BACKDOOR` (refuses any function body that names a suspended boundary, gated or not) and
  `DELETION_BASELINE_UNCHANGED`; the 0150 retry-hazard guard and its fixed ABSORBED / DETERMINISTIC / PT409 lists; the
  verify-0111 pins on `NOT_EVALUATED` and `UNRESOLVED_NO_CANONICAL_SOURCE` (:106-110, :812) and the byte-exact seam
  restore (`matching-proposal-verifier-support.mjs:460-466`); A3-01 test 7 (`EXECUTABLE_DESTINATIONS` without
  `INTRODUCTIONS`); the mobile pins holding the Introductions rows absent; the S4-01 `WorldArea` pins.

### 2.7 Hosted

The hosted database was at `0074` at the last approved metadata check (`QAN-BL-PROD-06`); WP0 did not re-check it. No
Matching function or table existed there at that check (SEC-MATCH-00 record). Its PostgREST version is unverified.
`0108` / `0109` may never reach live signed-in users without `0149` in the same controlled window,
and `0150` must precede any exposure (`QAN-BL-PROD-06`, owner `HOSTED-DEPLOY-01`). The next migration number is `0154`.

### 2.8 Corrections the adversarial pass made to the census

1. There are **two** `service_role` grants among the Introduction-related functions (0115:1504 and 0119:1798), not one.
2. `authenticated` already reaches Introduction-World conversation and owner deletion through the S4-02 wrappers (latent;
   §2.2).
3. The Android channel «التعارف» is not gated by `INTRODUCTIONS_ENTERED` (§2.4).
4. The live export is the `0153` replacement of `build_personal_export_v1` (0153:224); `'introductions'` is in
   `notYetIncluded` at 0153:314 (the census had cited 0130:615).
5. The profile and requirement setters exist (full-replacement versions with compare-and-swap) but are suspended; what
   is missing is owner **read-back** of one's own values (`get_my_matching_setup_v1` returns identities and states only).
6. A profile correction without disclosure re-approval leaves a stale-version authority "matchable": a **liveness**
   defect, not a leak, because the recipient-view composite FK (0110:874-878) makes a stale disclosure fail `23503`
   *(read from code, not executed)*.
7. The deterministic sensitive-fact floor runs only on conclusions (0111:877). Disclosed field **values** get only
   contact-route and provenance checks (0120:489-498), in any language. The contact / sensitive floor is ASCII / English
   only (0111:132-188): Arabic words and Arabic-Indic digits pass *(read from code, not executed)*.
8. 0117 reactivation checks grant, profile and requirements but not the Disclosure Authority (0117:441-449). A human who
   revoked the authority could reactivate but never become matchable while the re-grant is suspended.
9. CW2-08 is not entirely unimplemented: 0138 (extended by 0139 / 0140) ships an operator-only, server-canonical Shared
   launch gate with `FOR SHARE` snapshot binding. It has Shared scopes only.
10. `QAN-BL-ACCT-01`'s body still says "no account-deletion code exists on main", stale since 0130 (later dated notes
    acknowledge 0130).

---

## 3. Frozen decisions, authority tensions and open decisions

### 3.1 Frozen (binding on Stage 6)

| Area | Frozen decision | Source |
|---|---|---|
| Capability | One capability, `MARRIAGE_INTRODUCTION`, hosted from `MY_WORLD`; a doorway, not a World, feed, marketplace, ranking system or direct-contact channel; navigation `CAPABILITY_CONTEXT`; no fourth Area | CW2-06 §1 (:12-32), F1–F2; CW2-01; CW2-07 §30-§33; I-08A4 §3, §10, §17 |
| Naming | «التعارف» / Introductions; "Matching" is internal only | I-08A4 (:296-317) |
| Entry | Two channels (conversational, manual `MY_WORLD`); an offer is not activation; decline / ignore never activates and never justifies nagging | CW2-06 §2-§4 (:77-92) |
| Authorities | Participation (`OFF` / `ACTIVE` / `PAUSED`, five reasons), `MATCHING_CONTEXT_GRANT` (internal reasoning only; purpose fixed by table identity to candidate evaluation) and `PRE_MATCH_PROPOSAL_DISCLOSURE_AUTHORITY` are independent; QANDEEL is never a consent principal; no service credential manufactures consent | CW2-06 §2-§11; 0108:65-85; 0109:9-18 |
| Profile and truth | Versioned bounded Introduction Profile; no pre-Match photo; HARD vs SOFT (a hard dealbreaker is never overridden, soft preferences may be balanced), no visible score / rank / percentage; PASS / FAIL / UNKNOWN and UNKNOWN never passes; no inference of eligibility-critical facts; no KYC | CW2-06 §6-§14 |
| Proposals | Bounded (about 5 a week, configurable); canonical pair; candidate untold until the first recipient forward-approves; independent recipient-specific second proposal; exact-view acceptance; neutral non-completion; no browsable list, score, rank or feed; no direct pre-Match contact | CW2-06 §15-§33; G2 §D |
| Match and Introduction | Atomic, single-winner Mutual Match creates exactly one `SHARED_WORLD` / `INTRODUCTION`; one active Introduction per human; the Matching grant never transfers; bounded immutable handoff (F1) | CW2-06 §34-§43; CW2-03 §9-§10 |
| Disclosure | Owner-only, non-reciprocal progressive disclosure; a suggestion creates no authority; the account Name and contact only through `FULL_NAME` / `CONTACT_METHOD`; images in three sequential stages (Strong Blur → Medium Blur → Clear), never before the Match | CW2-06 §44-§46; P1 §4, §13, §14 |
| Lifecycle | SUCCESS = QANDEEL proposes and both approve, same `world_id` becomes `STANDARD`; END = unilateral, ungated, read-only closed history; after either, Matching stays paused until explicit reactivation | CW2-06 §47-§50; CW2-03 §12-§14 |
| Copy and attention | The G2.3 Arabic opening, proposal and privacy paragraphs and the seven-step process; no score, feed, photo or specific reason before the Introduction; Introductions notifications only after legitimate entry, L0 default, presence-only; P4-C4's three approved notification rows; a Matching moment never interrupts a Live Call | G2.3 §1-§3; I-08N-01 D26; P3; G3 §D |
| Settings | A General Settings "Introductions" group for activation and pause only | P1 §8.1 (:275) |
| Gating | `QAN-BL-MATCH-01`: the six stay suspended until a reviewed, fail-closed, server-canonical, Product Owner-approved launch path; never a plain re-grant, default privilege, re-created function or client-executable wrapper | backlog §5 (:1171-1199) |

### 3.2 Authority tensions — only the Product Owner can resolve them

1. **Proposal content.** CW2-06 §20 and I-07B carry a first name, approved fields and a recipient-specific conclusion in
   every view. G2 §D / G2.3 §2 forbid any specific agreement, trait or reason before the Introduction, and the frozen copy
   has no name or field slot (GATE-23).
2. **Handoff.** CW2-06 §41 / I-07C write a handoff for the opening. G2.3 §3 says neither the proposal nor the reasoning is
   carried (GATE-30).
3. **Mandatory grant.** The runtime requires the Matching Context Grant for matchability (0111:262-264). CW2-06 §15 omits
   it; §5 and §50 include it (GATE-10).
4. **Resume.** CW2-06 §50 requires Resume to revalidate everything; frozen 0109 resume lifts only a user pause (GATE-08).
5. **Address.** The frozen G2.3 opening and privacy paragraph address the reader in the masculine singular (e.g.
   «تتعرف»، «تختار أنت»، «تكون مرتاح ومطمئن»), and G2.3 :31 authorizes no gender-neutral rewrite. VI-01 §3.6 makes fixed
   copy gender-neutral by default wherever natural Arabic permits (GATE-28).
6. **SUCCESS initiation and Introduction mode.** CW2-00 says SUCCESS "requires QANDEEL suggestion"; CW2-03 §13 says QANDEEL
   "may propose" (GATE-33). Likewise CW2-00 :188 says QANDEEL "actively breaks the ice and guides early interaction",
   while CW2-03 §44 says it "may additionally" be more proactive (GATE-30).
7. **Ownership.** The I-07 record assigns the mobile Matching UI to Connected Worlds `I-08` and the production grant or
   wrapper, safety and Launch Gate to `I-09` / CW2-08; no locator maps either onto the 9-stage execution map (GATE-01).
   *(Decided 2026-10-13, GATE-01: S6-series tasks consume the I-07 runtime and may prepare closed-by-default integration
   boundaries; I-09 / Stage 9 retains launch authorization and gate opening; phase `I-08` is not declared closed. §14.2.)*
8. **"Candidate cards or feed".** I-07 record §24 and Current State's I-08 row name "candidate cards or feed" for I-08,
   against the frozen no-feed law (drift, §11).

### 3.3 Open — deferred by authority, undecided, or proof-only

Ranking / selection policy; cadence, pending, expiry and cooldown values; the Introduction Profile field catalogue and its
user-facing name; the `PROPOSAL_SAFE_FIELDS` allowlist; requirement dimensions and system eligibility facts (no gender
concept exists anywhere in CW2-06, the Product Definition or 0108–0122); image capture, storage and rendering; the entry
placement and glyph; the activation / onboarding flow and the "how Introductions works" explanation (E2E-I-03; P4-GAP-043:
no source); consent and revocation UX; the G2.3 §6 open lines (cue «ليه؟», acknowledgement, unavailable, second-accepter,
later arrival, welcome), the decline act, the phase word and all English Matching copy; the final Introduction screen;
progressive-disclosure UX; END, closed and reactivation presentation; Activity event sentences (only fixtures exist); error
copy; safety, report, block and `INTRODUCTION_BLOCK_POLICY`; pricing and entitlement. The Canonical Artifact Index confirms
no design source exists for the entry, onboarding, Introduction World or progressive-disclosure UX.

---

## 4. Journey census J01–J12

Each step is classified with exactly one class:

- **FROZEN** — FROZEN PRODUCT DECISION: a frozen law or presentation rule.
- **RUNTIME** — IMPLEMENTED RUNTIME: server runtime exists, reachable or not (suspended runtime is still runtime).
- **SURFACE** — EXISTING PRODUCT SURFACE: an API route or mobile surface a user can reach serves, or would serve, the step.
- **MISSING** — MISSING INTEGRATION: decided, but the runtime or application piece does not exist.
- **PO** — REQUIRES PO DECISION: authority leaves the content, placement or mechanism undecided.

Migration numbers stand for `database/migrations/<n>_*.sql`; `verify-<n>` for `database/verify-migration-<n>.mjs`.
"Indirect CI" marks the `database/tests` static contracts that CI runs only through `verify:him-measurement-preflight`
(§2.6). No step below is reachable through an API route or a screen today except where a row says SURFACE, and every such
SURFACE row is plumbing or a latent path, not a Matching feature. The five retained I-07A boundaries (pause, turn off,
both revocations, self-inspection) are callable only by a direct Data API RPC on a database at 0149 or later; the hosted
database (`0074` at the last approved check) has none of them (§2.7). A frozen law that runtime already enforces is classed
FROZEN when the row states the law and RUNTIME when the row states the enforcing mechanism.

### J01 — Discovering Introductions in `MY_WORLD`
**Verdict:** nobody can discover Introductions. There is no entry, screen, route, Direct Entry or conversational offer.

| Step | Class | Source | Tests |
|---|---|---|---|
| One capability hosted from `MY_WORLD`; not a fourth Area, World, feed, marketplace, directory or contact channel | FROZEN | CW2-06 :12-32; I-08A4 :70-81, :485-495; kernel `world.types.ts` | `tests/s4-01-…:68` (three areas) |
| Name «التعارف» / Introductions | FROZEN | I-08A4 :296-317; `apps/mobile/src/activity/copy.ts:131, 194` | `surfaces.test.tsx:118` |
| An offer is not activation; no nagging | FROZEN | CW2-06 :85-92; 0109:181-185 | verify-0109 |
| Quiet manual entry from Personal / a secondary entry: placement, presentation, glyph | PO | CW2-06 :77-92; I-08A4 :74-81; E2E-I-01 UNDRAWN | NONE |
| What a user sees while Matching is unavailable (hidden, disabled or an "unavailable" state) | PO | no authority decides it | NONE |
| Conversational entry channel: QANDEEL may offer; an offer is not activation (CW2-06 §4). The "expressed marriage intent" trigger is Product Vision only; timing and re-offer policy → GATE-13 | MISSING | CW2-06 :79-92; Product Definition :45 (vision); `activity-decision.ts:19-20` (Proactive Gate `ABSENT`) | NONE |
| Valid Direct Entry into Introductions | MISSING | I-08A4 :81; `activity.service.ts:194-196` (`UNAVAILABLE`); no mobile kind (`activity-api.ts:72-82`) | `tests/a3-01-…:167` (pins its absence) |
| Notifications / Activity only after legitimate entry, L0 default | FROZEN | I-08N-01 D26 (:858-876) | `activity-decision.spec.ts:32-33, 77` |
| Introductions plumbing: category, filter chip, Open Link mark, L0 lock, push channel | SURFACE | 0136:102-134; `ActivitySurface.tsx:162`; `push-controller.ts:84-87, 150-153` | `surfaces.test.tsx:118, 309-322` |
| Truthful "legitimately entered" (`INTRODUCTIONS_ENTERED` is the constant `false`) | MISSING | `activity-decision.ts:22-23`; A3-01 G-17 exit gate | `activity-decision.spec.ts:77` |
| Permission-education moment on entering Introductions | MISSING | P3 §11 (:388-391); `push-controller.ts:9, 27` (three moments) | NONE |

### J02 — Opting in: activation and consent
**Verdict:** nobody can opt in. The activate command exists but is owner-only (0149), and no route or screen exists.

| Step | Class | Source | Tests |
|---|---|---|---|
| Participation `OFF` / `ACTIVE` / `PAUSED`, five private pause reasons; absent = `OFF` | RUNTIME | CW2-06 :53-73; 0108:225-243 | verify-0108; `database/tests/matching-participation-…` (indirect CI) |
| Explicit activation act with entry-channel provenance (caller-supplied, not server-verified) | RUNTIME (suspended) | CW2-06 :77-92; 0109:164-190; 0149:57-87 | verify-0109, verify-0149, `prove-0149-…` (4 PostgREST releases), `tests/sec-match-00-…` |
| Reopening path: reviewed, fail-closed, server-canonical, PO-approved; mechanism unchosen | PO | backlog :1171-1199; 0149:43-54; 0138:28-35 (Shared precedent) | `tests/sec-match-00-…:41-60, 120-124, 211`; verify-0149 `NO_BACKDOOR`; retry guard |
| No deletion-blocking footprint for an account not "truly enrolled" (undefined) | PO | backlog :1185-1187, :587-614; 0108:181-186; 0130:1071-1081; W3-PDG-01 :279-291 | verify-0130 (hard-stop scenario) |
| "How Introductions works" explanation (E2E-I-03) | PO | E2E gap matrix :404; P4-GAP-043 (no source) | NONE |
| Short activation flow (CW2-06 §5: a short QANDEEL flow *may* establish intent, dealbreakers, preferences, profile and grant; the flow, screens, copy and whether it is scripted or conversational are not decided) | PO | CW2-06 :96-106; G2 :44-47 (G2 does not claim onboarding) | NONE |
| General Settings "Introductions" group (activation and pause only) | MISSING | P1 :275; `SettingsSurface.tsx:53` | `apps/mobile/src/settings/__tests__/privacy-data-settings.test.tsx:91-102` (exact Settings groups; no Introductions group) |
| Self-inspection of one's own setup (identities and states only) | RUNTIME | 0109:929-945; 0149:31-38 | verify-0109; `prove-0149-…` |
| Final execution law: a protected Connected Worlds action runs only when privacy, lifecycle, safety, entitlement and launch gate all allow | FROZEN | CW2-08 :12-24 | NONE (no Matching scope; 0140:89-91 has Shared scopes only) |
| Whether Matching setup is a protected (consequential) action under that law; pricing / entitlement | PO | CW2-06 :905; GATE-09, GATE-37 | NONE |

### J03 — Introduction Profile (first name, fields, images)
**Verdict:** nobody can create or edit a profile. The setter is suspended, the first name has no store, the catalogue is
undecided, read-back is missing and nothing can hold an image.

| Step | Class | Source | Tests |
|---|---|---|---|
| Versioned, bounded profile pre-authorized for proposal use; not a long Dating form | FROZEN | CW2-06 :106, :171-179 | NONE |
| Commit a version: key ban on contact / media / identity, append-only, compare-and-swap; creation and correction are one function | RUNTIME (suspended) | 0108:94-108, :415-425; 0109:566-650; 0149:57-64 | verify-0108, verify-0109, verify-0149; `database/tests/…` (indirect CI) |
| Field catalogue and the user-facing name "Introduction Profile" | PO | CW2-06 :892-906 (§57); P1 :135-136 | NONE (verifier keys are fixtures) |
| Introduction First Name: self-authored, explicitly confirmed, never split from the account Name | FROZEN | P1 :131-136, :522 | NONE |
| Store the confirmed first name and wire it into `resolve_matching_canonical_first_name_v1` | MISSING | 0111:328-343; 0120:476-477; P1 :676-678; 0123:22-31 | verify-0111 (pins `UNRESOLVED`) |
| Owner reads back their own values (deliberately deferred by I-07A; no Product authority requires it yet) | PO | 0109:929-945; record :205-208; GATE-12 | NONE |
| No photo, image or blur before the Match | FROZEN | CW2-06 :200-214; P1 :530-573 | verify-0108 |
| Capture and store the Introduction image for the three post-Match stages | PO | P1 :530-586; record :1219-1223; 0115:306-332 (opaque ref) | NONE |

### J04 — Hard requirements and soft preferences
**Verdict:** nobody can state requirements. Dimensions, eligibility facts and the empty-set rule are undecided; nothing
evaluates or reads soft preferences.

| Step | Class | Source | Tests |
|---|---|---|---|
| `HARD_DEALBREAKER` vs `SOFT_PREFERENCE`: a hard dealbreaker is never overridden; soft preferences may be balanced; no visible percentage, rank, score or browsable list | FROZEN | CW2-06 :218-229, :265-277; 0108:494-497 (runtime: I-07A has no weight / score / rank column) | verify-0108 |
| Commit a set: full replacement, non-empty, compare-and-swap | RUNTIME (suspended) | 0109:651-744 (non-empty at :671); 0149:57-64 | verify-0109, verify-0149 |
| PASS / FAIL / UNKNOWN; UNKNOWN never passes; every HARD item of both humans must PASS (enforced by 0110) | FROZEN | CW2-06 :231-243; 0110:469-477, :1204-1246 | verify-0110, verify-0111 |
| Self-truth only from self-authored knowledge, explicit answers, profile or account state; no inference | FROZEN | CW2-06 :143-167 | verify-0111 (label only; no store for explicit answers) |
| Dimensions, editing UI and copy, how UNKNOWN / blocking is explained | PO | CW2-06 :892-906; P1 :275 | NONE |
| System eligibility facts (legal policy, age, who may be proposed to whom) | PO | Product Definition :609-611; CW2-06 :110-120 | NONE |
| Whether an empty requirement set is matchable (runtime: no) | PO | 0109:671; 0111:262-264 | verify-0109 |
| Owner reads back their requirements (deliberately deferred by I-07A) | PO | 0109:929-945; GATE-12 | NONE |

### J05 — Matching Context Grant and Pre-Match Disclosure Authority
**Verdict:** nobody can grant either authority (suspended); the two revocations exist only as direct Data API RPC. The
consent UX is unfrozen, and whether the grant is mandatory is an authority tension.

| Step | Class | Source | Tests |
|---|---|---|---|
| Three independent authorities; none implies another (enforced by 0108 / 0109) | FROZEN | CW2-06 :36-49, :183-197; 0108:65-85 | verify-0108, verify-0109 |
| Grant / reconfirm the Context Grant (purpose fixed by table identity to candidate evaluation / safe compatibility reasoning; internal reasoning only) | RUNTIME (suspended) | CW2-06 :124-139; 0108:65-75; 0109:442-507 | verify-0109, verify-0149, `prove-0149-…` |
| Revoke the Context Grant (future use only) | RUNTIME | 0109:508-565; 0150 (`PT409`) | verify-0109, verify-0150, `prove-0150-…` |
| Grant the Disclosure Authority over approved fields of the exact current profile version | RUNTIME (suspended) | 0109:745-872; 0108:549-553 | verify-0109, verify-0111 |
| Revoke the Disclosure Authority | RUNTIME | 0109:873-928; 0149:31-38 | verify-0109, `prove-0149-…` |
| Consent and revocation screens and copy; whether the consent-text version is recorded (no column exists) | PO | G2.3 :41 (the privacy paragraph is frozen as copy; G2.3 defines no consent act or consent copy); 0108:65-85 | NONE |
| Whether the grant is mandatory for matchability | PO | 0111:262-264 vs CW2-06 :45-49, :247-261, :756-767 | verify-0111 |
| Which self-authored Personal sources the grant admits (definition owned by `QAN-BL-CW-02`) | PO | CW2-06 :124-152; backlog :972-1004; QIR rule 7 | NONE |
| Onboarding personalization is outside the grant's fixed purpose; using Personal context for it would need a new consent family by controlled CW2-06 amendment (GATE-11) | FROZEN | CW2-06 :126-133; 0108:65-75 | NONE |
| The Matching grant never transfers into Shared / Introduction | FROZEN | CW2-06 :136-139, :654-660 | verify-0114 |

### J06 — Receiving a privacy-safe proposal
**Verdict:** nobody can receive a proposal, and Stage 6 alone cannot change that: the pipeline is unexecutable and
unorchestrated, policies are empty, the first name is `UNRESOLVED`, no conclusion producer exists (Stage 8A or a
PO-approved alternative) and the CW2-08 seam answers `NOT_EVALUATED` (Stage 9).

| Step | Class | Source | Tests |
|---|---|---|---|
| Bounded internal discovery; no list, rank or score (ordered by user id, LIMIT ≤ 200) | RUNTIME | CW2-06 :265-277; 0111:442-489 | verify-0111 |
| Orchestration discover → snapshot → evaluate → conclude → filter → prepare → offer, and expiry / revalidation sweeps | MISSING | record :445-461; 0112:376, 489, 805, 842 | NONE |
| Eligibility snapshot, revalidated before surfacing, forwarding and commit | RUNTIME | CW2-06 :247-261; 0110:1204-1246; 0111:498-607 | verify-0110 / 0111 / 0112 |
| Cadence, pending maximum, expiry values, and a reviewed policy writer | PO | CW2-06 :281-295, :480-488, :892-906; 0110:241-247 | verify-0110 (structural floors) |
| One live proposal per canonical pair | RUNTIME | CW2-06 :299-305; 0110:697-702 | verify-0110, verify-0112 |
| Pair re-proposal / cooldown; candidate selection fairness | PO | CW2-06 :902; 0110:697-702 | NONE |
| Evaluation of hard dealbreakers and private reasoning (outcomes are caller-supplied; nothing reads SOFT items) | MISSING | 0111:608-633; CW2-06 :218-229 | verify-0111 (test-supplied outcomes) |
| Recipient-specific Safe Compatibility Conclusion | MISSING | CW2-06 :378-392; 0111:757-811; 0120:462-472; 0135:96-98 | NONE |
| Sensitive Conclusion Filter (unconfigured, refuses everything; ASCII / English floor only) | RUNTIME | CW2-06 :396-404; 0111:95-100, :132-188, :812-921 | verify-0111 (no Arabic case) |
| Disclosure gate → immutable recipient view | RUNTIME | CW2-06 :408-438; 0120:377-480 | verify-0111, verify-0120 |
| `PROPOSAL_SAFE_FIELDS` allowlist | PO | 0110:298-325; 0120:456-460 | NONE |
| CW2-08 prerequisites cleared (safety, moderation, entitlement, Launch Gate) | MISSING | CW2-08 :170-203; 0111:305-317 | verify-0111 (rolled-back replacement only) |
| Offer to the first recipient; the candidate is not told | RUNTIME | CW2-06 :329-337; 0120:592; 0112:86-99, :944-979 | verify-0112, verify-0120 |
| What the proposal shows (frozen G2.3 copy vs CW2-06 §20 name, fields and conclusion) | PO | G2.3 :35-46; CW2-06 :329-337; G2 :136-142 | NONE |
| Matching attention moment: Q mark, frozen Arabic opening, proposal and privacy paragraphs | FROZEN | G2.3 :16-31, :35-46, :60-70 | NONE (G3.2 proof is design evidence) |
| Placement outside the Analysis, Direct Entry landing, open lines, English, female address | PO | G2.3 :31, :39-41, :129-139; G3 :135, :196, :205 | NONE |
| Find or be notified of a proposal (L0, presence only, after entry; the pending list is J07 / GATE-27) | MISSING | I-08N-01 :858-881; 0112:944-963 | `activity-decision.spec.ts:77` |
| Never interrupt a Live Call | FROZEN | G3 :112-135; `call-truth.ts:1-13` (`NO_CALL_KNOWN`) | NONE Matching-specific |
| A blocked pair is `PAIR_INELIGIBLE` for proposal, Mutual Match and progressive disclosure; a pending proposal closes neutrally; no Block reason is exposed | FROZEN | CW2-08 :175-189; no Block relation or check exists in 0110–0112 (Stage 9) | NONE |

### J07 — Reviewing, accepting, declining; pause, resume, turn off
**Verdict:** no proposal can be materialized or decided. Pause, turn-off and the revocations exist only as direct Data
API RPC; resume and re-activation are suspended.

| Step | Class | Source | Tests |
|---|---|---|---|
| Reach a pending proposal (from the attention moment or an Activity row); anti-oracle listing | PO | G2.3 :60-68; P3 :664; 0112:944 (needs a known id) | `tests/a3-01-…` |
| Read the exact Recipient Proposal View | RUNTIME | CW2-06 :430-440; 0112:944-979, :989 | verify-0112, verify-0120; `database/tests/matching-proposal-privacy-…` (indirect CI) |
| What the proposal surface renders beyond the frozen copy | PO | CW2-06 :329-339 vs G2.3 :35-46 | NONE |
| First recipient approves forwarding | RUNTIME | CW2-06 :351-363; 0112:674; 0111:305-317 | verify-0112, verify-0114 |
| First recipient declines privately; the decline act and its copy are open («لأ، شكراً» is proof-only) | RUNTIME | CW2-06 :341-349; 0112:637-666 (→ 0120) | verify-0112, verify-0120 |
| First recipient withdraws (ungated; a `PREPARED` proposal cannot be withdrawn) | RUNTIME | CW2-06 :457-463; 0112:758-793 (→ 0120) | verify-0120 |
| Second recipient reviews an independent view; declines here, accepts in J08 | RUNTIME | CW2-06 :365-376, :442-455; 0112:720-750 | verify-0112, verify-0114 |
| Acknowledgement and neutral non-completion (law frozen; wording open) | RUNTIME | CW2-06 :442-455, :510-518; 0112:87-99, :891-925; G2.3 :126-139 | verify-0112 |
| Expiry, staleness and pause-to-terminal (lazy; no sweeper; a past-deadline proposal still shows `AWAITING_YOU`) | MISSING | CW2-06 :465-490; 0112:805, 842, :910-920 | verify-0120 |
| Pause (`USER_PAUSED`) | RUNTIME | CW2-06 :53-73; 0149 (retained); 0150 (`PT409`) | verify-0109 / 0149 / 0150; `prove-0149-…`, `prove-0150-…`; `tests/prod-retry-01-…` |
| The Settings control for pause (and activation) | MISSING | P1 :275; `SettingsSurface.tsx:53` | `apps/mobile/src/settings/__tests__/privacy-data-settings.test.tsx:91-102` |
| Resume after a user pause | RUNTIME (suspended) | 0109:55-62; 0149:57-64 | verify-0149 |
| Resume reopening path and revalidation (CW2-06 §50 vs 0109) | PO | backlog :1171-1199; CW2-06 :756-769 | `tests/sec-match-00-…` |
| Turn off (one-way today: activate is suspended) | RUNTIME | 0149 (retained); CW2-06 :53-61 | verify-0109 / 0149 / 0150 |
| Placement of resume and turn-off (P1 names activation and pause only) | PO | P1 :275 | NONE |

### J08 — Mutual Match and the Introduction World
**Verdict:** no Match can commit (no role; `NOT_EVALUATED`). Opened unchanged, the World would appear as an ordinary
Shared World labelled by account Names, with no notification, welcome or END.

| Step | Class | Source | Tests |
|---|---|---|---|
| The second recipient's acceptance commits the atomic, exactly-once Mutual Match (12 caller-supplied ids; eight `40001` raisers) | RUNTIME | CW2-06 :533-553; 0114:245-255, :696-720 | verify-0113, verify-0114; `database/tests/matching-mutual-match-…` (indirect CI) |
| One active Introduction per human; competing proposals end as `NO_LONGER_AVAILABLE` (enforced by 0113 / 0114) | FROZEN | CW2-06 :520-590; 0113:475-479 | verify-0113, verify-0114 (barrier-pinned races) |
| One `SHARED_WORLD` `ACTIVE` / `INTRODUCTION` / `MUTUAL_MATCH`; no third member | FROZEN | CW2-03 :163-177; CW2-07 :440-486; 0075:60-75 | verify-0114; kernel spec |
| Both humans paused `ACTIVE_INTRODUCTION`; no grant transfers | RUNTIME | CW2-06 :654-677 | verify-0114 |
| Immutable Match Handoff Package written (no reader exists) | RUNTIME | CW2-06 :628-652; CW2-07 :465-473; 0113:527-578 | verify-0113 |
| The opening: welcome, and what of the handoff is rendered | PO | CW2-03 :181-191; G2.3 :79-80, :126-139 | NONE |
| Second-accepter convergence and first-accepter truthful later arrival (wording open) | FROZEN | G2.3 :58-80 | NONE |
| Notify the counterpart that the Introduction began (L0, after entry); 0141 `BIRTH` reads direct invitations only | MISSING | I-08N-01 :858-882; 0141:135-143 | `activity-decision.spec.ts:77` |
| The Introduction World belongs to the Shared World area «العالم المشترك» and keeps the same `world_id` and navigation identity through SUCCESS | FROZEN | G2 :143-144 (G1.2 §3); I-08A4 :46-48; CW2-07 :453-459, :477-488 | NONE Introduction-specific |
| How it is presented inside the Shared area — phase marker, list placement, entry, final Introduction screen (today: phase-blind S4 reads would list and admit it — a RISK, §2.5) | PO | 0138:598-676; E2E-I-06 (`P4-GAP-043`) | `tests/s4-01-…`, verify-0138 (no `INTRODUCTION` case) |
| Each person named by the Introduction First Name; account Name only via `FULL_NAME` | MISSING | P1 :131-136, :514-526; 0138:623; 0139:139; `shared-conversation-model-input.ts:26-37` | NONE |

### J09 — Progressive disclosure
**Verdict:** no Introduction can exist; the disclosure command is unexecutable and seam-gated; no media store exists.

| Step | Class | Source | Tests |
|---|---|---|---|
| A suggestion (QANDEEL or counterpart) creates no authority | FROZEN | CW2-06 :681-693; P1 :555-568 | `database/tests/introduction-lifecycle-…` (indirect CI) |
| Owner discloses `FULL_NAME`, `CONTACT_METHOD` or `DEEPER_PERSONAL_FIELD`: one atomic, non-reciprocal act | RUNTIME | CW2-06 :695-717; 0115:206, :659; 0122:726; 0115:603 (seam) | verify-0115, verify-0122 |
| Owner-approval UI and copy; how a request is presented | PO | E2E-I-07 UNDRAWN; P1 :555-568 | NONE |
| Image stages one per approval, no skip (the DB accepts `FULL_IMAGE` with no prior `PARTIAL_IMAGE`) | MISSING | P1 :555-586; 0115:62, :325 | NONE |
| Capture, store and render the image and its blur derivatives | PO | P1 :530-586; record :1219-1223 | NONE |
| Owner and counterpart see delivered disclosures (service_role reader, no caller) | RUNTIME | 0115:1455-1504; 0089:180-185 | verify-0115 |
| Account Name and contact only through disclosure | FROZEN | P1 :514-526; CW2-06 :681-693 | NONE |
| Owner deletes a disclosure: payload and verifier erased | RUNTIME | CW2-03 :615-630; 0143:736-783; 0122:84-95; 0139:489-511 | verify-0122, verify-0139 |

### J10 — Conversation inside the Introduction World
**Verdict:** no World can be born. If one existed, S4-02 would already carry the conversation, but with account Names,
`SHARED` L2 Activity and the world-neutral reply path.

| Step | Class | Source | Tests |
|---|---|---|---|
| Send human text (two humans while the Record is `ACTIVE`) | SURFACE (latent) | CW2-03 :718-730; 0118:269, :316-324; 0139:186-200 | verify-0118, `tests/s4-02-…`, verify-0139 (no `INTRODUCTION` case) |
| Read the Introduction thread (`author_name = users.name`) | SURFACE (latent) | 0139:113-143; 0119:1654-1668 | `tests/s4-02-…` |
| Human voice notes | MISSING | CW2-03 :718-730; 0118; `QAN-BL-VOICE-01` | verify-0118 |
| QANDEEL answers on request through the world-neutral Shared path (provider unbound) | SURFACE (latent) | 0139:331-333; ACE-SP-01 amendment :89-90 | `tests/ace-sp-01-…`, `tests/s4-02-…` |
| Introduction-phase Worlds use the same world-neutral Shared reply guidance and gain no Matching or Introduction context | FROZEN | ACE-SP-01 amendment :59-70, :89-90 | `tests/ace-sp-01-…` |
| Whether the Shared reply path should answer at all in an Introduction before an Introduction mode exists (any different behaviour needs a controlled ACE-SP-01 amendment) | PO | ACE-SP-01 amendment :89-90; GATE-30 | NONE |
| QANDEEL Introduction mode (welcome, ice-breaking, safe reasons, propose disclosure / Standard) | PO | CW2-03 :764-777 ("may additionally"); CW2-00 :188 ("actively breaks the ice" — a tension, §3.2 item 6); CW2-07 :465-473 | NONE |
| Shared private reasoning needs a new Shared Standing Context grant | FROZEN | CW2-06 :654-662; CW2-03 :181-191; `QAN-BL-CW-02` | NONE |
| No add / remove / leave / manage in `INTRODUCTION` (enforced by 0083 / 0140) | FROZEN | CW2-03 :263-279; 0083:327-332; 0140:173-181 | verify-0140; `tests/s4-03-…` |
| Human-to-human live call | FROZEN | CW2-03 :732-745 (`DISABLED_BY_PRODUCT_LEGAL_GATE`) | NONE |
| Block / report during an Introduction; CW2-08A classification of Introduction conversation | PO | CW2-08 :193-203 (§13); CW2-08A :42-52; E2E-I-13 | NONE |
| Per-World alerts / mute for an Introduction World (the S4-04 alerts read would list it) | PO | 0141:170-189; P3 §12 | NONE |
| Whether an Introduction opens on the Living Analysis surface (0148 admits members; passes refuse) | PO | 0148:256, :310 | verify-0148; `tests/shared-vis-01-…` |
| Whether Introduction material may be a Replay source or distributed (0101 authorizes through the 0119 resolver, which has `INTRODUCTION` branches) | PO | CW2-05 §22-§23; 0101:344-362; 0119:1798 *(read from code)* | NONE |

### J11 — Ending or continuing an Introduction
**Verdict:** SUCCESS, END and reactivation exist only in the database and are unexecutable; END has no route and Shared
leave refuses `INTRODUCTION`; an ended Introduction would vanish.

| Step | Class | Source | Tests |
|---|---|---|---|
| Who may propose the transition to Standard; the actor-less prepare has no caller | PO | CW2-03 :241-260; CW2-00 :192; 0116:821 | verify-0116 |
| Both humans approve the exact version, withdrawable | RUNTIME | 0116:1069-1103 | verify-0116 |
| SUCCESS commit: same `world_id` → `ACTIVE` / `STANDARD` | RUNTIME | CW2-03 :222-260; CW2-06 :732-746; 0116:1110, :795-808 | verify-0116 |
| After SUCCESS the World is served by the S4 Standard surfaces; which name applies then | PO | 0140:173-181; CW2-07 :476-486 | `tests/s4-03-…`, verify-0140, verify-0148 |
| END: either human, alone, never gated → `READ_ONLY_CLOSED` / `INTRODUCTION` | RUNTIME | CW2-03 :263-279; CW2-06 :719-730; 0116:1388, :1905-1912 | verify-0116 |
| Reach END from inside the World (no wrapper, route or control) | MISSING | CW2-06 :664-677; record :1240-1244; 0083:327-332 | NONE |
| Neutral END notice to the counterpart (Product Definition §29 gives a vision example only): carrier and copy | PO | Product Definition :430-443 (vision); 0141:61 (no END source) | NONE |
| Read-only Closed Introduction (entitlements written, no Product reader) | MISSING | CW2-03 :604-613; 0116:548-553; 0119:1654-1668; 0140:507, 527, 554 | verify-0116, verify-0119 |
| After END the owner deletes their own words (primitive works; no read finds the ids) | RUNTIME | CW2-03 :615-630; 0139:489-511; 0140:590-600 | verify-0139, verify-0122 |
| Matching stays paused; explicit reactivation revalidates, revives no proposal (needs a current grant) | RUNTIME | CW2-06 :719-769; 0117:250, :219-226, :441-449 | verify-0117 |
| Presentation of one's own Matching status while paused by `ACTIVE_INTRODUCTION`, `POST_SUCCESS` or `POST_INTRODUCTION` | PO | CW2-06 §42-§43, §47-§50; 0114; 0116 | NONE |
| Re-introducing the same pair after a closed Introduction | PO | CW2-06 :892-906; 0110:697-702 | NONE |

### J12 — Errors, stale state, Live Call, notifications / Activity, export, deletion
**Verdict:** partial plumbing only. Activity / push exist but are silenced and unfed; the Live-Call rule holds only
vacuously; four commands answer `PT409`; export omits Introductions; any Matching footprint makes deletion permanently
`BLOCKED`.

| Step | Class | Source | Tests |
|---|---|---|---|
| Stale or concurrent refusals answer a bounded, never-retried outcome (only the four retained commands today) | MISSING | backlog :1243-1257; 0150:40-52; 40001 sites in 0109, 0111, 0112, 0114, 0116, 0117, 0120 | verify-0150; retry guard; `prove-0150-…`; `tests/prod-retry-01-…` |
| Matching error and stale copy (minimum audience-safe denial) | PO | CW2-02 :840-856; I-08N-01 :1073-1102 | NONE |
| Live-Call rule (an `INTRODUCTION` item is never call-safe; production call truth is `NO_CALL_KNOWN`) | FROZEN | G3 :112-135; P3 :278-290; `activity-decision.ts:41-42`; `call-truth.ts:10-13` | `activity-decision.spec.ts`; `tests/a3-01-…` |
| Introductions notification semantics: category, L0 default and D26 silence (`INTRODUCTIONS_NOT_ENTERED`); the Notifications group and Lock Screen row are not drawn until `introductions.available` | RUNTIME | I-08N-01 :858-882; 0136:102-134; `activity-decision.ts:22-23`; `NotificationsSection.tsx:249, 280-286` | `activity-decision.spec.ts:77`; `surfaces.test.tsx:309-322`; `tests/a3-01-…`, `tests/a3-02-…` |
| Whether pre-entry visibility (filter chip, Android channel) is consistent with D26 | PO | `ActivitySurface.tsx:162`; `push-controller.ts:84-87` | NONE |
| Truthful entry, Introductions Direct Entry, education moment | MISSING | `activity-decision.ts:21-23`; `activity.service.ts:194-196, 312`; `push-controller.ts:9, 27` | `tests/a3-01-…`, `surfaces.test.tsx` (pin absences) |
| Introductions Activity producers | MISSING | backlog :2440-2446 (A3-01 leaves them to Stage 6); 0141:135-143 | NONE |
| Category of events inside an Introduction World (`INTRODUCTIONS` or `SHARED`); event set and sentences | PO | 0136:107-134; 0141:65-78 | NONE |
| Export My Data for Matching / Introductions (no owner; Matching setup not even named) | PO | W3-PDG-01 :212-224; 0153:224, :314 | verify-0130; `tests/w3-mega-s-…` |
| Delete Account with a Matching / Introduction footprint (permanently `BLOCKED`; several rows bind two humans) | PO | W3-PDG-01 :277-294; backlog :587-617; 0130:44-50, :1068-1081 | verify-0130 |
| Matching operational events and company controls (feature usage, errors; flag, rollout, kill) | PO | E2E gap matrix :136-158, :402-414; CW2-08 §24 | NONE |

---

## 5. Gap matrix

Severity: **BLOCKER** = the journey cannot complete in any deployable configuration, even with every Stage 6 task merged
and its gates opened by an operator, because it needs a Stage 8A producer or a Stage 9 CW2-08 seam or policy. **HIGH** =
Stage 6 can make the journey completable behind closed gates. Every row, whatever its severity, reaches real users only
after `QAN-BL-PROD-06` (HOSTED-DEPLOY-01), `QAN-BL-ACCT-01` for any footprint, and the Stage 9 production gate opening
(§6). **8A** / **8B** / **9** mark a dependency on Stage 8A (production LLM / provider), Stage 8B (Voice) or Stage 9
(CW2-08 / I-09 safety, moderation, entitlement, Launch Gate, release hardening, economy).
Proposed owners refer to the PROPOSED tasks of §8 and are not assignments (since GATE-03, `S6-02` is the register
owner of `QAN-BL-MATCH-02`; §14.4). GATE ids are
the decisions of §10.

| Journey | Canonical authority | Repository implementation | Current state | Gap | Sev. | Dependencies | Proposed owner | PO decision |
|---|---|---|---|---|---|---|---|---|
| J01 Discover | CW2-06 §1, §4; I-08A4 §3, §17; I-08N-01 D26; P3 §11 | Entry channel as provenance only; Introductions Activity / push plumbing behind `INTRODUCTIONS_ENTERED = false`; no module, screen or Direct Entry kind | Nobody can discover Introductions; an empty chip and an OS channel are visible | Entry placement and presentation; surface; truthful entry; Direct Entry; education moment; conversational offer | HIGH | MATCH-01; PROD-06; **8A** (offer); NOTIF-02 (Proactive Gate); I-08 framing; A3-01 pin | S6-01 (manual entry, truthful entry, education); S6-07 (Direct Entry); offer → 8A | GATE-01, 13 |
| J02 Opt in | CW2-06 §2-§5; P1 §8.1; MATCH-01; W3-PDG-01 §8.4(9) | 0108 / 0109 commands; activate and resume owner-only (0149); no gate scope, API or Settings group | Nobody can enroll | Launch path and caller model; footprint strategy; flow and placement; gate scope; 40001 handling; surfaces | HIGH | MATCH-01; ACCT-01; PROD-06; **9** for production gate opening (as every row) and entitlement (GATE-37); CW2-08 for setup only if GATE-09 rules enrollment a consequential action; SEC-01; CW-02 | S6-01 | GATE-04…09, 14, 17, 37 |
| J03 Profile | CW2-06 §10, §12, §57; P1 §4, §13, §14 | Setter suspended; first-name seam `UNRESOLVED`; no store, read-back or media | Nobody can create a profile | Catalogue and name; first-name store and seam; read-back; reopened setter; image decision | HIGH | MATCH-01; ACCT-01; PROD-06; media provider (none) | S6-01; seam wiring S6-03; images S6-06 or excluded | GATE-12, 15, 18, 23, 24a |
| J04 Requirements | CW2-06 §8-§9, §13-§14, §57 | Setter suspended; PASS / FAIL / UNKNOWN relations; no explicit-answer store, read-back or evaluator | Nobody can state requirements | Dimensions, eligibility facts, empty-set rule; capture; read-back; evaluator method | HIGH | MATCH-01; ACCT-01; **8A** only for free-text evaluation; the legal-eligibility owner is undecided (GATE-16) | S6-01 (capture); S6-03 (evaluation) | GATE-16, 17 |
| J05 Grants | CW2-06 §2, §7, §11, §42, §50 | Grants suspended; revocations retained (`PT409`); grant mandatory in 0111; no collector | Revocation only by direct RPC; granting impossible | Reopen path; consent UX and version capture; mandatory-grant ruling; source definition | HIGH | MATCH-01; ACCT-01; CW-02; PROD-06; **8A** for anything that reads Personal context | S6-01 | GATE-10, 11, 17 |
| J06 Proposal | CW2-06 §12, §15-§33, §57; G2.3; G3 §D; D26 | Full I-07B pipeline, unexecutable; two seams fail closed; no policies, producer, orchestrator, listing or Activity producer | No proposal can exist in any configuration | Orchestrator and sweeper; policies and writer; allowlist; first name; evaluator; conclusion producer; Arabic floor; content ruling; listing; surfaces | BLOCKER | **8A** (conclusion); **9** (CW2-08 seam, the Block relation and the §12 pair-ineligibility check, entitlement); MATCH-01; VOICE-01; NOTIF-02; PROD-06; ACCT-01 | S6-03 (pipeline); S6-04 (surface) | GATE-21…28 |
| J07 Review / pause | CW2-06 §3, §19-§33, §50; G2.3; P1 §8.1; MATCH-01 | Decision cores unexecutable and seam-gated; pause / off / revoke retained; resume suspended; no listing or sweeper | No decision possible; resume / re-activation impossible | Gated wrappers; listing; sweeper; surfaces; Settings controls; resume path | BLOCKER | **9**; **8A** upstream; MATCH-01; PROD-06; ACCT-01; I-08 | S6-04 (review); S6-03 (expiry / pause terminalization sweeper); S6-01 (pause / resume / off) | GATE-04, 08, 14, 23, 25, 27, 28 |
| J08 Match / birth | CW2-06 §34-§43; CW2-03 §9-§10; G2 §D; CW2-07 §30-§33; G2.3 §3; P1 §4, §13 | 0113 / 0114 complete, unexecutable, seam-gated; handoff unread; S4 reads phase-blind | No Match can commit; if opened, Name leak and no END | Gated Match wrapper; phase isolation; first-name source; END no later than birth; birth Activity; opening | BLOCKER | **9**; **8A** upstream; MATCH-01; PROD-06; ACCT-01; I-08 | S6-02 (fence); S6-05 (Match, presentation) | GATE-20, 21, 23, 28, 29, 30, 31 |
| J09 Disclosure | CW2-06 §44-§46; P1 §13-§14; CW2-03 §35 | 0115 / 0122 unexecutable, seam-gated; service_role reader unused; no image sequencing or media | No disclosure possible | Wrapper; render path; image sequencing and media; UI; suggestion behaviour | BLOCKER | **9** (seam, block policy); **8A** (suggestions only); media provider; ACCT-01 | S6-06 | GATE-18, 21, 32 |
| J10 Conversation | CW2-03 §14, §41-§44; CW2-06 §42-§43; ACE-SP-01; P1 §13; CW2-08 §13 | 0118 widened cores; S4-02 phase-blind (latent); world-neutral reply; no mode, voice, block | No World exists | Phase-aware projection and model input; gating ruling; Activity routing; Standard-only controls hidden; mode; block / report | BLOCKER | **8A** (any reply; mode); **8B** (voice); **9** (block, report, CW2-08A); PROD-06; CW-02; CW-05…07 / #322 if Living Analysis | S6-02 (fence); S6-05 (conversation) | GATE-20, 29, 30, 31, 35, 36 |
| J11 End / continue | CW2-03 §12-§14, §33-§35; CW2-06 §43, §47-§50, §57 | 0116 / 0117 unexecutable; SUCCESS and reactivation seam-gated; END ungated, no route; closed views `STANDARD`-only | No user can end, complete or reactivate; an ended Introduction would vanish | END wrapper and control; SUCCESS caller and approvals; closed reader; former-own-material read; END notice; reactivation | BLOCKER | **9**; **8A** (if QANDEEL-only SUCCESS); MATCH-01; PROD-06; ACCT-01 | S6-02 (END boundary); S6-05 (control, closed view); S6-06 (SUCCESS, reactivation) | GATE-20, 21, 25, 33, 34, 39 |
| J12 Cross-cutting | G3 §D; P3; D26; CW2-02 §47; W3-PDG-01 §7.3, §8.4(9), §8.5 | Silenced plumbing; `NO_CALL_KNOWN`; `PT409` for four commands; export `notYetIncluded`; erasure `BLOCKED` | No event can be produced; deletion permanently blocked by any footprint | Truthful entry; producers; Direct Entry; 40001 handling in every wrapper; error copy; export owner; deletion contract | BLOCKER | **8B** / VOICE-01; **9** (NOTIF-05 physical proof); ACCT-01 (`OPEN — UNASSIGNED`); PROD-06; NOTIF-02; no export owner | S6-07; each wrapper task for 40001 | GATE-05, 13, 19, 21, 28, 31 |

---

## 6. What depends on Stage 8A, Stage 8B, Stage 9 and other owners

**The frozen I-07 runtime contains no intelligence.** Candidate evaluation calls no model; hard-requirement outcomes, the
evidence source class, private reasoning and the Safe Compatibility Conclusion are all caller-supplied. The Model Router
has one task literal (`CONVERSATIONAL_RESPONSE`), `MODEL_PROVIDER` is empty and the router fails closed. The repository's
honest interim for an unbound provider is the S5-03A / SHARED-VIS-01 refusing port (`NOT_RUN` / `NO_PROVIDER` before any
lease, read or spend). *(Made precise in §14.10: the "before any lease, read or spend" property belongs to SHARED-VIS-01.
S5-03A refuses with no provider call or spend, but stages the work and reads its input first.)*

**Deterministic without a model:** manual entry; the consent acts; a user-entered profile and requirements; pause, off and
revoke; a catalogue-based hard-requirement comparison (if the Product Owner chooses one); the progressive-disclosure acts;
SUCCESS approvals; END; reactivation.

| Owner | What stays with it |
|---|---|
| **Stage 8A** — production LLM / provider | The Safe Compatibility Conclusion producer (unless the Product Owner approves a non-model alternative — §10 GATE-22); any evaluator over Personal context (QIR-001 rule 7); free-text dealbreakers; conversational entry and the QANDEEL offer (intent detection; the Proactive Gate is `ABSENT`, `QAN-BL-NOTIF-02`); structured onboarding drafts; QANDEEL Introduction mode (CW2-03 §44; needs a controlled ACE-SP-01 amendment); QANDEEL-initiated disclosure or SUCCESS suggestions; reply quality in Introduction Worlds (`QAN-BL-ACE-02`, `IP-02`, `CW-05`); a Matching AI-COST feature family (none in 0135) and a Matching eval suite. *(Since GATE-03, 2026-10-13: the conclusion producer, with its AI cost attribution and evaluation, is `QAN-BL-MATCH-03`. The other Matching intelligence listed here is not a register item; §14.4.)* |
| **Stage 8B** — Voice (a roadmap stage; `QAN-BL-VOICE-01` itself stays `OPEN — UNASSIGNED`) | Real Live-Call truth (Stage 6 consumes only `NO_CALL_KNOWN`); Introduction voice notes. Human-to-human calls stay disabled by a Product / legal gate. |
| **Stage 9** — CW2-08 / Connected Worlds I-09, release hardening, economy | Replacing the four `NOT_EVALUATED` seams; `INTRODUCTION_BLOCK_POLICY`; report, block, moderation and the CW2-08A classification; entitlement and pricing; opening any Matching gate in production, rollout and cohorts; `QAN-BL-LAUNCH-01…04` and `QAN-BL-NOTIF-05` physical proofs; `QAN-BL-SEC-01` before the store release; the store deletion path and legal retention. |
| **HOSTED-DEPLOY-01** (`QAN-BL-PROD-06`) | The `0075+` catch-up: `0108` / `0109` only with `0149` and `0150` in the same controlled window, an API that accepts both `40001` and `PT409` first or together, none of it after any exposure of `0078` / `0081` / `0109` (0149:52-54; 0150:61-64), then every Stage 6 migration from `0154`; verifying the hosted PostgREST version; closing PROD-06 on hosted evidence. No Stage 6 surface reaches a real user before this. |
| **`QAN-BL-ACCT-01`** (`OPEN — UNASSIGNED`) | The Connected Worlds deletion contract for Matching / Introductions (two-human `RESTRICT` rows, cross-user private notes, CW2-06 F25 against W3-PDG-01 true deletion). |
| **Other owners** | `QAN-BL-CW-02` / SHARED-CTX-01: the "self-authored `MY_WORLD`" source definition and Shared Standing Context. `QAN-BL-CW-06` / `CW-07`: unassigned. `QAN-BL-PRIV-01…03`: Personal export. Stage 7: Replay of Introduction material, if allowed (GATE-35). |

**Intelligence risks that need a ruling before code (census area 8, the intelligence boundary; §1):**
the onboarding "personalization" purpose in the Product
Owner's local notes is **not** in repository authority (the grant's purpose is fixed by table identity to candidate
evaluation); HIM has no production writer and its charter forbids use as trait or readiness evidence; Matching statements
must not leak into ordinary Memory through the Personal orchestrator (CW2-08 §41); one model pass over two humans'
private contexts needs an explicit rule. The repository records no technical dependency of S6-01 on the Product Owner's local
"return gate" (named CI-02…05 in the Product Owner's local notes; these are not repository ids and are unrelated to
`QAN-BL-CI-02`). CI-01 C0 :323 records no forward dependency between CI-01 and S6-01, and also that S6-01 would consume the
same per-user understanding, which CI-01 C2-a would improve. Whether the return gate precedes S6-01 is the Product Owner's
sequencing decision (GATE-02); an explicit-input onboarding, if chosen (GATE-11, GATE-14), would read no Personal
understanding. *(GATE-02 was approved on 2026-10-13, but the Product Owner recorded that the historical Return Gate and
the S6-01 kickoff ordering still need reconciliation. That ordering is therefore not decided; §14.3.)*

---

## 7. `QAN-BL-MATCH-01` — a safe, server-canonical path: the design space

*Research only. Nothing here is decided.* MATCH-01 "chooses no launch mechanism, wrapper or gate" (backlog :1198-1199).

### 7.1 The six suspended boundaries

| Boundary | Frozen semantics | First footprint? |
|---|---|---|
| `activate_matching_participation_v1` | Explicit human act; human = `auth.uid()`; requires `OFF` / absent; entry channel recorded as caller-supplied provenance | **Yes** — upserts the caller's `matching_setup_locks` row (`RESTRICT`, DELETE refused for every role) plus immutable participation rows |
| `resume_matching_participation_v1` | Lifts only `USER_PAUSED`; reads no grant, profile or requirements (tension with CW2-06 §50) | No (needs existing state; a refused call rolls back its lock upsert) |
| `set_introduction_profile_v1` (create **and** correct) | Full-replacement immutable version, compare-and-swap; key ban; no catalogue; a disclosure authority stays bound to the old version | **Yes** on first creation; every correction adds a permanent version |
| `set_matching_requirements_v1` | HARD / SOFT; non-empty full replacement, compare-and-swap | **Yes** on first creation |
| `grant_matching_context_v1` | Purpose fixed by table identity to candidate evaluation; one `ACTIVE` grant; reconfirmation = new identity; nothing reads `MY_WORLD` under it yet | **Yes** on the first grant |
| `grant_pre_match_disclosure_authority_v1` | Binds the exact current profile version; approved keys only; never contact data | No (needs a current profile) |

After a first footprint, governed Personal erasure (0130) deletes `users` last, catches `foreign_key_violation` and marks
the request `BLOCKED` permanently; the owner can only cancel.

### 7.2 Two structural constraints

1. Frozen I-07A law forbids any service credential from manufacturing human Matching consent (0109:9-18; CW2-01 §7; CW2-08
   §2).
2. The API forwards the user's bearer token with the publishable key (`supabase-data-api.service.ts:66-82`), so every
   `authenticated` function is client-callable. **A launch gate has to live inside the database transaction.**

### 7.3 Options

| Option | Mechanism | Safety | Footprint | Controlled amendments | Precedent |
|---|---|---|---|---|---|
| **O-A Hold** | The six stay owner-only; Stage 6 builds no path that can commit a Matching row | Strongest; touches no frozen contract | None | None | 0149 itself |
| **O-B Gated wrappers** | A non-exposed Matching gate (operator-only state, absent = `UNCONFIGURED` = DENY, bound `FOR SHARE` as lock step 0); `authenticated` SECURITY DEFINER wrappers call the byte-identical six under the caller's own `auth.uid()`; public INVOKER one-liners; `service_role` revoked by name; every scope shipped closed. Variants: G-C adds a 0129 freshness proof; G-D is a seam only | Consent stays the human's own act; fail-closed; emergency disable serializes; a direct client call gets the same answer | Unchanged: needs F-1 (production closed until ACCT-01) or O-E | verify-0149 `NO_BACKDOOR` (refuses even a gated wrapper today) and IDEMPOTENT_RETRY; SEC-MATCH-00 contract header / wiring; verify-0150 ABSORBED list; a new I-07 record amendment section (lock order §9). The 0108 / 0109 bytes and the I-07 banner stay unchanged | S4-01 / 0138, almost exactly |
| **O-C Service-role path** | The API verifies the JWT and calls new service-only cores with an explicit human id, or forges claims | Not client-callable, but any holder of the service credential can manufacture consent | Unchanged | Reopens frozen consent law: I-07A, CW2-01 §7, CW2-08 §2, verify-0109 G02 | None for widening consent |
| **O-D Staged enrollment** | A deletable, account-scoped `CASCADE` pre-enrollment draft (non-authoritative, never read by I-07B or Memory), then **one** explicit gated enrollment act that commits the first versions and consumes the draft | No footprint before the explicit act | Zero before enrollment; full after (still needs F-1 or O-E) | Everything in O-B, plus verify-0149 `DELETION_BASELINE_UNCHANGED`, an Architecture ruling on I-07A §2 independence, draft retention / export rules | 0142, 0143, 0138 lazy provisioning |
| **O-E Setup-only erasure** | Redefine the 0108 truth / immutability triggers in place with the 0130 txid-bound prefix; erase the 14 setup relations inside governed erasure only when no I-07B+ row references the account | Setup-only accounts become truly deletable; no UPDATE path; other humans untouched | Setup-only becomes non-blocking; matched accounts stay `BLOCKED` | The 0108 durability law; 0130's hard-stop statement and body; W3-PDG-01 §8.5; ACCT-01 owner (re-anchors seven pins); verify-0108 / 0149 / 0130 | 0130, 0143, 0122 |

A naive `CASCADE` would probably fail as `55000` from the BEFORE DELETE triggers rather than answer `BLOCKED`, and it trips
`DELETION_BASELINE_UNCHANGED` *(inference, not executed)*.

### 7.4 Hosted ordering (items 1, 2 and 5 fixed by authority; items 3 and 4 combine the CI guard with this record's proposals)

1. The hosted database was at `0074` at the last approved check;
   hosted default privileges grant new public functions to client roles (0133 later
   removes the anon / authenticated defaults but not `service_role`'s).
2. The catch-up ships `0108` / `0109` only with `0149` in the same controlled window, and `0150` in that same window. An
   API that accepts both `40001` and `PT409` deploys first or together, and none of this happens after any exposure of
   `0078` / `0081` / `0109` (0149:52-54; 0150:61-64).
3. Even after `0150`, the six raise `40001` at 13 sites, so any exposure must keep them off a re-running Data API (PROD-06
   option (a) or (b), the Product Owner's choice). The current retry-hazard guard fails any new entry point that lets
   `40001` escape, so in practice R-1 or R-2 unless the guard is amended (see `QAN-BL-PROD-07`).
4. A Stage 6 migration (`0154+`) deploys only after `0149` and `0150`, revokes by name, asserts effective privileges, and
   leaves nothing executable that can commit a Matching row; under O-B it ships every scope `UNCONFIGURED`.
5. Opening any scope on the hosted project is a separate operator act needing explicit Product Owner approval, after
   PROD-06, ACCT-01 for Matching, the CW2-08 Matching requirements and `QAN-BL-SEC-01`.

### 7.5 Adjacent seams

- **G1, an "onboarding personalization" purpose.** Not in repository authority; it appears only in the Product Owner's
  local notes. Taking it would need a new, separately revocable consent family through a controlled CW2-06 amendment.
- **First name.** The seam is `UNRESOLVED`; P1 §4 froze the source (a confirmed Introduction First Name) but no store.
- **Owner read-back.** `get_my_matching_setup_v1` returns identities and states only.
- **Mandatory grant.** Required by the runtime, omitted by CW2-06 §15.
- **"Self-authored `MY_WORLD` context".** The same undefined notion whose definition and collector `QAN-BL-CW-02`
  (SHARED-CTX-01) owns.

### 7.6 Recommendation for the Product Owner (not a decision)

1. Rule first on whether a closed-by-default, in-database gate with `authenticated` SECURITY DEFINER wrappers (O-B) is the
   "server-canonical launch path" MATCH-01 permits or the "client-executable wrapper" it forbids. The repository calls the
   0138 **gate state** server-canonical and its wrapper path "server-owned"; it does not settle the MATCH-01 wording. Of the
   shapes that reopen enrollment, only O-B, and O-D, which builds on it, keep the frozen consent law intact; O-C does not.
2. Reject O-C unless the Product Owner deliberately reopens frozen consent law.
3. Footprint: F-1 now (every scope `UNCONFIGURED`; production closed until ACCT-01 is resolved for Matching; ACCT-01 stays
   `OPEN — UNASSIGNED` with a dated note). Consider commissioning O-E under a named owner as the narrowest ACCT-01
   increment; treat a full Matching / Introduction deletion contract as a launch prerequisite.
4. Retry: R-1 (absorb `40001` / `PT409` into a bounded STALE outcome; the six stay byte-identical); replay of a committed
   command answers its committed result (the S4-01 precedent).
5. Scopes: separate first creation from correction / resume / reconfirmation; open profile correction only together with
   disclosure re-approval, after reproducing the version-coherence finding on real PostgreSQL.
6. Define "truly enrolled" explicitly. One explicit enrollment act (O-D) lets onboarding exist without a footprint but needs
   an Architecture ruling; with no change to frozen consent or durability law (only the O-B controlled amendments listed in
   §7.3), use per-command reopening under F-1.
7. Keep G1, first-name storage, read-back, the mandatory grant and the CW-02 definition out of the launch path until each is
   decided (recommended: explicit input only; one CW-02-owned definition; keep the runtime's mandatory grant).

---

## 8. Proposed Stage 6 decomposition and backlog mapping (PROPOSED — not approved)

### 8.1 Basis and invariants

- **Honest closure.** With the provider unbound and the CW2-08 seams answering `NOT_EVALUATED`, Stage 6 can integrate
  every journey behind closed gates but delivers **zero** proposals and zero Introductions to real users: a recipient view
  needs a `PERMITTED` conclusion and the seam blocks every offer. Whether Stage 6 may close that way is GATE-02.
  *(Approved 2026-10-13: Stage 6 may reach engineering integration completion with the production provider unbound, and
  must fabricate no conclusion, proposal or Introduction; §14.3.)*
- **BG-05.** WP0 inherits nothing (no item names it). The only open item owned by a Stage 6 task is `QAN-BL-MATCH-01`
  (`S6-01 — Intelligent Matching Onboarding`, pinned at `tests/sec-match-00-…:211`), which S6-01 inherits at its own
  kickoff. No `S6-02…S6-07` id exists in the repository; the Product Owner's local sketch uses S6-02…S6-05 with different
  meanings (§8.4), so the numbers below are provisional labels only. *(Since GATE-03, 2026-10-13, `S6-02` is a register
  owner: `QAN-BL-MATCH-02`, owner `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary`. The id is the Product Owner's (GATE-03),
  and the name is the Product Owner's task-map name (§14.6); this record's proposal was §8.2's heading. The other numbers, the count and the scope of every task, S6-02
  included, are still provisional. Folding S6-02 into another task (§8.3) would re-own `QAN-BL-MATCH-02` explicitly.)*
  *(Then, in the final approval package the same day, the Product Owner approved the seven-task map and its names as the
  planning direction (§14.6). Only each task's scope stays provisional until its Task Contract, and a change to the
  count needs an explicit Product Owner decision.)*
- **Two hazards must be fenced before the path that exposes them:** the permanent deletion footprint (MATCH-01) before any
  Matching scope can open (S6-01), and the Introduction-phase account-Name leak (§2.5) before any birth path (S6-02 before
  S6-05). With them: an END boundary no later than birth — an inference from CW2-03 §14 / CW2-06 §43 (either matched
  person may end unilaterally, without counterpart approval), the 0116 header ("a human must always be able to leave",
  0116:1379-1381) and Product Definition §29 (a vision: "immediately").
- **Proposed invariants at every merge:** no migration or application code configures a gate open or replaces a CW2-08
  seam body (verifiers open gates only through the operator function in their disposable database and replace seams only
  inside rolled-back transactions, restored byte-exact); no Match wrapper merges before the isolation fence **and** before a
  server END boundary for Introduction Worlds exists (in S6-02, or in the same PR as the Match wrapper if GATE-20 so
  decides; if GATE-20 gives END to I-09, the Match wrapper waits for it); every new Data API entry point passes the retry
  guard and the PostgREST wire proofs; every migration (`0154+`) joins the undeployed catch-up behind PROD-06; no Matching
  state reaches ordinary Memory; every task closes "merged, not deployed, not launch-ready".
- **Conditional scope.** S6-01's sketch is written against the recommended package (O-B, F-1, R-1). If the Product Owner
  chooses differently at GATE-04…09, S6-01 changes materially. Every name of a screen or surface below is a placeholder for
  an undecided Product name, not proposed copy.

### 8.2 Proposed tasks (scope sketches, not Task Contracts)

Each block below is a scope sketch for the Product Owner's review, not a Task Contract. It fixes no scope, PR split,
evidence requirement, ordering or backlog obligation; each of those is set only by that task's own contract after the
Product Owner approves the plan. The judge panel scored three independent decompositions (risk-first 42 / 50, aligned with
the Product Owner's sketch 41 / 50, journey-first 39 / 50) and synthesized this one from the risk-first backbone and the
sketch-aligned cut.

*(2026-10-13: the Product Owner approved the seven-task structure as the planning direction, subject to final Task
Contracts, and named the tasks (§14.6). The names and sketches below are WP0's proposals as reviewed. Where a sketch
differs from a Product Owner decision in §14, the decision binds.)*

**S6-01 — Intelligent Matching Onboarding** (owner of `QAN-BL-MATCH-01`; owner string kept verbatim if GATE-01 (a) is
chosen). Possibly two ordered PRs (server, then mobile).
- *Objective.* Server: reopen the six suspended operations without restoring any 0149 grant, through the path the Product
  Owner approves (GATE-04); a footprint strategy (GATE-05); bounded `40001` handling (GATE-07); owner-only read-back
  (GATE-12); an Introduction First Name store and confirm act (never resolved from `users.name`; P1 §4 allows only an
  unconfirmed prefill suggestion from it); the server-side per-user `INTRODUCTIONS_ENTERED` truth, replacing the constant
  at `apps/api/src/activity/activity-decision.ts:23`, as GATE-13 defines "legitimately entered"; a NestJS Matching module
  over the gated path, the four retained reducers and the retained self-inspection read. Mobile: a manual `MY_WORLD` entry
  (no fourth Area); explicit activation kept distinct from both authorities; the consent acts; profile, first name,
  requirements and — only if GATE-23 / GATE-24a admit fields into a pre-Match proposal — pre-Match field approval;
  read-back and correction; pause / resume / off / revoke; the P1 Settings group (activation and pause); the fourth
  push-education moment; the closed-gate presentation the Product Owner decides (GATE-13); a Copy Gate whose rows are
  PROPOSED for the Product Owner's decision. No model; no Memory / Hypothesis / HIM read; nothing enabled in production.
- *Journeys.* J01 (manual entry only), J02, J03 (text and first name; images only if GATE-18 says so), J04 (capture), J05,
  J07 (pause / resume / off), J12 (footprint and deletion truth, stale state, entry truth, education).
- *Reuse.* 0138 gate, `FOR SHARE` bind and INVOKER / DEFINER pattern (:28-38, 226-246, 516-581); 0142 / 0130 footprint
  precedents; the 0150 `PT409` pattern and `database/data-api-retry-hazard-guard.mjs`; verify-0149, `prove-0149-…`,
  `database/matching-setup-verifier-support.mjs`, verify-0130; the `apps/api/src/shared-world/*` layering; the four
  matching type files (import only); the Settings / Notifications sections; `push-controller.ts`; the copy-gate module
  pattern; the validation-only proof root (`apps/mobile/src/integration/__validation__/S401ProofRoot.tsx`) and Maestro.
- *Missing.* The gate; the wrappers (server-side entry channel; `service_role` revoked); a lock-order proof against I-07A
  "own lock first"; the footprint strategy with a real-PostgreSQL proof; `40001` absorption; read-back; the first-name
  store; correction coupled with re-approval (GATE-06); API routes; controlled amendments of the SEC-MATCH-00 contract,
  verify-0149, verify-0150 and the I-07 record (a new amendment section; banner unchanged); the mobile surfaces;
  re-anchoring the mobile absence pins; a setup lane that never passes through the Personal Memory write.
- *Dependencies.* The Kickoff decisions (Tier 0) and Tier 1 of §10. Not Stage 8A; not the CW2-08 seams (setup has none);
  not S6-02. Production exposure also needs PROD-06, ACCT-01 (under F-1) and CW2-08 if enrollment is ruled a consequential
  action (GATE-09).
- *Backlog (proposed).* Would own MATCH-01 (proposed: tombstone it at closure if the approved path lands, or re-own the
  residue to one named task). Fires ACCT-01's reopen clause (a dated note; it stays unassigned unless the Product Owner
  assigns it). PROD-06 binds the restored six. Observes SEC-01, CW-02 (builds no collector), NOTIF-05, PROD-04,
  CI-01 / CI-02. Partly discharges the A3-01 G-17 exit gate.
- *Evidence a future contract could require (illustrative).* A real-PostgreSQL verifier: with the gate absent or closed,
  every reopened operation refuses and leaves zero Matching rows and no lock row; with the gate opened by the operator
  function in the verifier's disposable database, operations commit solely as `auth.uid()`; anon and `service_role`
  refused; scopes separate as ruled; the amended `NO_BACKDOOR` census lists exactly the reviewed wrappers; the six
  byte-identical (under R-1); verify-0130 truthful for every footprint class; two-connection lock-order races; read-back
  owner-only and no oracle. The retry guard green; a PostgREST wire proof on four releases. API tests (no user-id
  parameters); mobile jest; a Maestro journey on the validation-only proof root (an in-memory stand-in answering exactly as
  the new migration and API do; no database gate opened, no seam touched), plus the closed-gate state; RTL and TalkBack. A
  closed Copy Gate; an S6-01 static contract; `npm run test:database`; the governance test green.
- *Complexity.* XL. *Can close with the provider unbound:* yes, as explicit-input onboarding (if GATE-11 / GATE-14 choose
  it). A conversational reading of "Intelligent" cannot close unbound.

**S6-02 — Introduction-Phase Shared Isolation Fence and the END Server Boundary** *(the Product Owner's approved task map, 2026-10-13, names it `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary`; §14)* (new; proposed as a prerequisite of any
birth path).
- *Objective.* Before any path can birth an Introduction World, make every phase-blind S4 / SHARED-VIS-01 surface answer an
  Introduction-phase World with the interim the Product Owner confirms (GATE-20; the recommended interim is the non-member
  answer): the World list, members, entry verdict, material read, send, reply lease, alerts, the 0141 derivations, the
  0148 reader and the model input — and, if GATE-35 so decides, Replay source capture through the 0119 resolver
  (0101:354, :662). Cover `ACTIVE` / `INTRODUCTION`, `READ_ONLY_CLOSED` / `INTRODUCTION` and, if GATE-20 requires,
  `MUTUAL_MATCH`-born Worlds after SUCCESS. `STANDARD` behaviour stays byte-identical. If the Product Owner assigns it here
  (GATE-20), also deliver the ungated END as a server boundary (wrapper and route, both participation ids derived on the
  server, `40001` absorbed). No Product presentation is decided here.
- *Journeys.* J08, J10, J11 (END boundary), J12 — fence only.
- *Reuse.* The 0140 `is_current_shared_member_v1` phase filter; the 0141 proposal branch; the rolled-back Introduction
  births in `database/matching-match-verifier-support.mjs` and `database/introduction-lifecycle-verifier-support.mjs`;
  verify-0138…0141 and 0148 as the regression baseline; `commit_introduction_end_v1`; the 0139 identity-derivation pattern;
  the 0116 END-vs-SUCCESS races.
- *Missing.* A forward migration redefining the phase-blind functions (the 0118 forward-widening precedent; GATE-20 asks
  whether Stage 6 may do this); defensive phase handling in API views and the mobile link decoder; the END wrapper; a
  real-PostgreSQL verifier; a static contract; dated notes on the stale 0139 / 0111 comments.
- *Dependencies.* Tier 0 and Tier 2 of §10; can run in parallel with S6-01. Proposed invariant: merges before any wrapper
  over 0114, the 0116 SUCCESS or the 0118 Introduction conversation.
- *Backlog (proposed).* The proposed new item for the Name leak, if admitted (GATE-03) — *admitted 2026-10-13 as
  `QAN-BL-MATCH-02`, owner S6-02, covering the account Name exposure only (§14.4)*. PROD-06 (END is a new entry
  point); PROD-07 (END vs SUCCESS race). An ACCT-01 note (END writes `RESTRICT` closed-view rows).
- *Evidence a future contract could require (illustrative).* On Introduction Worlds born inside rolled-back transactions:
  every redefined function returns the interim answer; no output column carries `users.name`; send refuses; the 0141
  derivations yield zero recipients; 0148 membership is false; `STANDARD` fixtures byte-identical across verify-0138 / 0139
  / 0140 / 0141 / 0148. END: callable only by a current matched human, unilateral, succeeds while every seam answers
  `NOT_EVALUATED`, idempotent, exactly one terminal winner against SUCCESS. A PostgREST wire proof; the retry guard; a link
  to an Introduction World id answers `UNAVAILABLE`.
- *Complexity.* L. *Unbound:* yes.

**S6-03 — Proposal Pipeline Prerequisites and Disclosure Floor** (deterministic, fail-closed; a proposed re-scope of the
sketch's "Matching Intelligence & Eligibility").
- *Objective.* Make the pre-Match pipeline complete, honest and privacy-safe up to the CW2-08 seam and never past it: wire
  the confirmed Introduction First Name into the first-name seam (a reviewed forward replacement); a reviewed, owner-only
  path that installs only Product Owner-approved policy values (GATE-24, GATE-25); a deterministic hard-requirement
  evaluator over an approved catalogue, if GATE-16 chooses one; the conclusion behind a refusing provider-neutral port, if
  GATE-22 chooses it; the contact / sensitive floor for Arabic, if GATE-26 places it here; a non-enumerating orchestrator
  and an expire / revalidate sweeper. Reproduce the version-coherence, discovery-ordering, lazy-expiry and
  stranded-`PREPARED` findings first; any fix that changes frozen I-07B semantics needs its own Product Owner /
  Architecture decision. Proposed rule: never prepare a proposal or write a private note while delivery cannot clear (notes
  are `RESTRICT` on the counterpart; `PREPARED` proposals burn both budgets and cannot be withdrawn).
- *Journeys.* J04 (evaluation), J06 (up to the seam), J07 (expiry / pause terminalization), J12.
- *Reuse.* The 0110–0112 and 0120 cores; `database/matching-proposal-verifier-support.mjs`; the refusing-port pattern
  (`apps/api/src/shared-world/shared-semantic-interpreter.ts:143-155`); the 0111 classifiers as an add-only floor; the
  retry guard; the API worker pattern (`privacy-maintenance.worker.ts`, `push-dispatcher.worker.ts`,
  `ai-usage-operations.worker.ts`) for the orchestrator and sweeper.
- *Dependencies.* S6-01 (server); Tier 3. External: a conclusion producer (Stage 8A or a Product Owner-approved
  alternative) and Stage 9 CLEARED before any delivery.
- *Backlog (proposed).* Owns none. Proposed Kickoff admissions under Stage 8A (conclusion producer, AI-COST family, eval
  suite). Records the `QAN-BL-CTX-01` ruling. Observes PROD-05, PROD-06, ACCT-01. *(2026-10-13: the conclusion producer,
  with its AI cost attribution and evaluation, is admitted as `QAN-BL-MATCH-03` under Stage 8A, not S6-03; §14.4.)*
- *Evidence a future contract could require (illustrative).* The seam answers `RESOLVED` only for a confirmed Introduction
  First Name; with policies absent nothing is written; with production seams zero `PREPARED` rows and zero notes; a full
  discover-to-offer walk passes only with policies and seams installed inside rolled-back transactions, then restored
  byte-exact; UNKNOWN blocks; Arabic contact routes and sensitive terms refused, if in scope; each finding reproduced, then
  fixed or dispositioned; the sweeper terminalizes; no role can enumerate matchable humans; the refusing port answers
  `NOT_RUN` before any read or spend.
- *Complexity.* XL. *Unbound:* yes, integrationally, stating that it delivers zero proposals.

**S6-04 — Private Proposal Review and Decisions.**
- *Objective.* Let a recipient read and act on a delivered proposal exactly as frozen (the G2.3 opening, proposal and
  privacy copy; the seven-step process; neutral non-completion): if GATE-27 allows one, a recipient's own non-oracle pending
  listing (never a browsable candidate list, CW2-06 §16); closed-by-default wrappers over the neutral projections and over
  forward approval, first and second decline and first-recipient withdraw (if GATE-01 / GATE-21 give these wrappers to
  Stage 6 rather than I-09); clock enforcement after expiry; the mobile private-proposal surface (attention moment,
  first-accepter acknowledgement, neutral unavailable). Seam checked last. The second recipient's **accept** is the Mutual
  Match commit (0112:743-746), so it is proposed for S6-05.
- *Journeys.* J06 (delivery, attention, viewing), J07, J12.
- *Reuse.* The 0112 / 0120 cores and projections; `database/matching-proposal-verifier-support.mjs`; the 0138 wrapper
  pattern; the S4 / S5 copy modules and the S401 proof root.
- *Dependencies.* S6-03, S6-01; Tier 3. External: Stage 9 CLEARED and a conclusion producer for any real delivery.
- *Backlog (proposed).* Owns none. Observes PROD-06, PROD-07, VOICE-01 (consumer side), NOTIF-02 (classification,
  GATE-27), SEC-01.
- *Evidence a future contract could require (illustrative).* If a listing is approved, it returns only views the caller
  holds; the candidate holds nothing before forward approval; decline, expiry, invalidation and a competing Match all render
  `NO_LONGER_AVAILABLE`; the stale-view race reproduced through the wrapper; production seams fail every decision closed;
  the retry guard; API tests; a proof-root run rendering the frozen G2.3 strings byte-exact with RTL and TalkBack; a closed
  Copy Gate.
- *Complexity.* L. *Unbound:* yes, integrationally.

**S6-05 — Mutual Match, Introduction Birth and Introduction-World Presentation** (including the END control and the
closed Introduction).
- *Objective.* Expose the atomic Mutual Match (the second recipient's acceptance) through a closed-by-default wrapper: the
  nine new identities (World, Introduction Record, two membership episodes, two claims, two pause events, the handoff
  package) derived on the server; the command id, the proposal id and the exact expected view id stay caller-supplied, as
  exact-view acceptance requires (0114:245-251, :278, :306-307); `40001` absorbed. Present the two frozen perspectives
  (second-accepter convergence, first-accepter later arrival). Re-admit Introduction Worlds on the surfaces the Product
  Owner chooses (GATE-29) over the S6-02 fence, each person named by the confirmed Introduction First Name until
  `FULL_NAME` (P1 §13), read from the source GATE-12 / GATE-30 decide (the handoff's `presented_first_name` only if GATE-30
  allows the handoff to be read). Human text over the 0118-widened path. The END control (and, if S6-02 did not deliver
  it, the ungated END server boundary itself, merged no later than the Match wrapper), a closed-Introduction reader and an
  Introduction-phase former-own-material read. The opening renders only what the Product Owner allows; QANDEEL replies
  inside an Introduction follow GATE-30.
- *Journeys.* J07 (accept), J08, J10, J11 (END, closed view), J12.
- *Reuse.* The 0114 commit; `database/matching-match-verifier-support.mjs`; the S4-02 / S4-03 surfaces over the S6-02
  fence; the 0140 closed-view reads as the pattern.
- *Dependencies.* S6-02 (proposed as hard), S6-04, S6-03, S6-01; Tier 4. External: Stage 9 (seam,
  `INTRODUCTION_BLOCK_POLICY`).
- *Backlog (proposed).* Owns none. ACCT-01 note (births create two-human `RESTRICT` rows); PROD-06, PROD-07; CW-02 (no
  grant transfer); CW-05 / ACE-02 / IP-02 (reply quality, Stage 8A); CW-06 / CW-07 and LAUNCH-04 only if GATE-29 puts
  Introductions on Living Analysis; VOICE-01 (voice notes).
- *Evidence a future contract could require (illustrative).* Exactly-once commit, one winner per human; competing proposals
  `NO_LONGER_AVAILABLE`; no ghost after an injected late failure; both humans `PAUSED` / `ACTIVE_INTRODUCTION`; no grant
  transfers; no `users.name` in any read, Activity row or model input before `FULL_NAME`; END succeeds under
  `NOT_EVALUATED`; after END both see the bounded closed view and can delete their own words; the production seam fails the
  Match closed. A PostgREST proof; the retry guard; Maestro on the proof root for both accepter perspectives, END and the
  closed view; a static contract (no fourth area, no direct messages, `ADD_MEMBER` unavailable); a closed Copy Gate.
- *Complexity.* XL. *Unbound:* yes for birth, END, closed view, human text and naming; Introduction mode stays with 8A.

**S6-06 — Introduction Lifecycle: Progressive Disclosure, SUCCESS → STANDARD and Reactivation.**
- *Objective.* Owner-only, non-reciprocal disclosure (`FULL_NAME`, `CONTACT_METHOD`, `DEEPER_PERSONAL_FIELD`; the three
  image stages only if a media path is authorized, with the one-stage-per-act order enforced where GATE-18 says); an API
  render path over the `service_role` reader; dual-approval SUCCESS with a reviewed caller that never manufactures consent
  and an approval-pending projection (GATE-33); explicit reactivation after END or SUCCESS.
- *Journeys.* J09, J11, J07 (resume after an Introduction), J12.
- *Reuse.* The 0115 / 0116 / 0117 / 0122 cores; `database/introduction-lifecycle-verifier-support.mjs`;
  `apps/api/src/conversation/supabase-service-role-api.service.ts` for the read over 0115:1504; the 0140 Standard
  governance after SUCCESS.
- *Dependencies.* S6-05, S6-02, S6-01; Tier 4. External: Stage 9 seams; an authorized media provider if images are in
  scope; Stage 8A for QANDEEL suggestions.
- *Backlog (proposed).* Owns none. ACCT-01 note (disclosure rows are `RESTRICT` for both humans); PROD-06 / PROD-07; CW-02
  (a new Shared Standing grant after SUCCESS); SEC-01 (contact handling); a media-pipeline owner if images are deferred.
- *Evidence a future contract could require (illustrative).* Disclosure owner-only and non-reciprocal; a suggestion
  creates zero authority; `FULL_IMAGE` before both partial stages refused (if in scope); owner deletion erases payload and
  verifier; the account Name appears only after `FULL_NAME` (or under the post-SUCCESS rule GATE-20 decides); SUCCESS needs
  both current approvals on the exact version; SUCCESS vs END has one winner; the post-SUCCESS World passes the S4-03
  Standard gates; reactivation revalidates and revives no proposal; production seams keep everything closed; PostgREST
  proofs; Maestro on the proof root; a closed Copy Gate.
- *Complexity.* L (XL with images). *Unbound:* the deterministic human acts, yes; QANDEEL-initiated suggestions and a
  QANDEEL-only SUCCESS initiation, no (8A).

**S6-07 — Introductions Attention, Direct Entry, Data Rights and Stage 6 Final Integration** (the S4-04 / S5-04 precedent).
- *Objective.* Close the A3-01 G-17 exit gate and the J12 obligations: one Introductions producer through the single
  `ActivityPublisher` for the event set and category the Product Owner decides (GATE-31; L0 default, presence-only,
  deferred during a known Live Call); the per-World Introduction alerts / mute GATE-31 decides; the Introductions Direct
  Entry on server and mobile, revalidated at open; truthful deletion messaging where a Matching footprint makes erasure
  `BLOCKED`; the Product Owner's export disposition (GATE-19); a Stage 6 emulator proof suite; the Stage 6 governance
  closure.
- *Journeys.* J12; the attention legs of J06, J08 and J11; J01 Direct Entry.
- *Reuse.* `apps/api/src/activity/activity-publisher.service.ts`; the `shared-activity.producer.ts` /
  `public-activity.producer.ts` precedents; the `activity.service.ts` Direct Entry; the S401 proof root;
  `scripts/validation/proof-suites.mjs`.
- *Dependencies.* S6-01, S6-04, S6-05, S6-06; Tier 4. External: VOICE-01 (Voice) for real call truth; NOTIF-05 (Stage 9)
  for physical push.
- *Backlog (proposed).* Discharges A3-01 G-17. Records the NOTIF-02 classification; observes NOTIF-05, VOICE-01, SEC-01;
  the export item per GATE-19 *(now `QAN-BL-PRIV-04`, owned by S6-07; §14.4)*; final dispositions of ACCT-01, PROD-06,
  the I-08 relation and the Stage 8A residue.
- *Evidence a future contract could require (illustrative).* Items only after legitimate entry; Introduction events emitted
  in the category GATE-31 decides; nothing at L0 reveals Introductions; a producer failure never changes a command's answer;
  Direct Entry revalidates and fails closed; items deferred under a fake known call; an export verifier per the decided
  option; verify-0130 Matching scenarios answer a truthful `BLOCKED`; a J01 → J11 emulator suite on the validation-only
  proof root (in-memory stand-ins answering as the S6 migrations and API do; no gate opened and no seam replaced in any
  database), reported as fixture-only; every S6 Copy Gate closed; the governance test green; the closure says "not
  launch-ready".
- *Complexity.* L. *Unbound:* yes.

### 8.3 Proposed order

0. **Kickoff decisions** (Tier 0 of §10). Any governance edit they authorize — re-anchoring the current-task pins,
   admissions, dated drift notes — is its own reviewed change, not part of WP0. *(Tier 0 was approved on 2026-10-13, and
   at the Product Owner's direction the two GATE-03 admissions are made in this same PR (§14). The pin re-anchoring and
   the §11 drift notes are still not made here.)*
1. **S6-01** (server, then mobile) after Tier 1. **S6-02** in parallel, after Tier 2.
2. **S6-03** after S6-01's server part and Tier 3.
3. **S6-04** after S6-03 (its mobile surface may start on proof-root fixtures).
4. **S6-05** after S6-02, S6-04 and S6-01 have merged.
5. **S6-06** after S6-05.
6. **S6-07** last.

The critical path is the Product Owner's decision tiers, not engineering. The proposed count is seven (not fixed; the
count is the Product Owner's decision). It could fall to six by folding S6-02 into S6-05 (S6-02 would then lose its
independence and serialize the fence) and to five by also folding S6-07 into S6-06. *(Superseded 2026-10-13: the Product
Owner retained the seven-task structure as the approved planning direction (§14.6). A fold would change the approved
count, so it needs an explicit Product Owner decision.)*

### 8.4 Divergence from the Product Owner's local sketch (S6-01…S6-05)

| Sketch | Proposed | Why (repository evidence) |
|---|---|---|
| S6-01 Intelligent Matching Onboarding (A + B) | **S6-01**, kept as one task, possibly in two ordered PRs; owner string verbatim if GATE-01 (a) | Proposed re-scope (GATE-11, GATE-14) to explicit-entry onboarding: the "personalization" purpose has no basis in authority (0108:65-80; 0109:146-149 reads no `MY_WORLD`). Adds the launch path the sketch leaves implicit (gate, footprint, `40001`, read-back, first-name store). Whether the local "return gate" precedes S6-01 is GATE-02. *(GATE-01 (a) approved 2026-10-13: the owner string stays verbatim. The return-gate ordering is still to be reconciled; §14.3.)* *(GATE-11, 2026-10-13: the Product Owner approved, as Product intent, QANDEEL suggesting existing `MY_WORLD` facts for onboarding, but only after a separately defined, explicit and revocable permission, with no implementation until the controlled architecture amendment is approved; §14.5.)* |
| S6-02 Matching Intelligence & Eligibility | **S6-03**, deterministic and fail-closed | No repository path aggregates either party's knowledge: nothing reads Personal context under the grant, the conclusion is caller-supplied, CW-02 owns the source definition and QIR rule 7 applies. Proposed: the intelligence half to Stage 8A. |
| S6-03 Proposal & Safe Disclosure | **S6-04** | Split: the second recipient's *accept* is the Match commit (0112:743-746), so it is proposed for S6-05. "First name + safe info" collides with G2.3 §2 → GATE-23. |
| S6-04 Mutual Match & Shared Birth | **S6-05** | The sketch's worry that the grant leaks into Shared is already closed (0114 creates no Shared Standing grant). The real leak is the account Name (§2.5) → new S6-02 (forced by the phase-blind reads, confirmed by re-reading the SQL; not executed). END and the closed view are proposed here so an ended Introduction never strands words. |
| S6-05 Introduction Lifecycle | **S6-06** | Proposed: END earlier; "QANDEEL-led introduction" is Introduction mode (8A plus an ACE-SP-01 amendment); notifications and data rights in S6-07; reactivation added (0117 needs the S6-01 grant). |
| — | **S6-02** (new) | Proposed because of the phase-blind reads (confirmed by re-reading the SQL; not executed) and the END inference (§8.1); can run in parallel with S6-01. |
| — | **S6-07** (new) | A3-01 G-17 assigns the entry, Settings row, producer and Direct Entry to Stage 6; S4-04 / S5-04 consolidated producers and native proof the same way. |

The proposal reflects the sketch's "Stage 6 done" ("no Ready claim while fail-closed"; the independent blockers HOSTED-DEPLOY-01,
ACCT-01, CW2-08, #322 and 8A) and made explicit: an integrational closure delivers zero proposals.

### 8.5 Backlog mapping (BG-05 at the Kickoff; proposed, not assignments)

| Item | Disposition at WP0 | Proposed task |
|---|---|---|
| `QAN-BL-MATCH-01` (HIGH, `DEFERRED — OWNED`, S6-01) | **Not inherited by WP0** (no item names WP0). It is the only open item owned by a Stage 6 task: S6-01 inherits it under BG-05 at its own kickoff. Unchanged: WP0 does not start or resume S6-01. Reopens automatically when S6-01 resumes or any task takes Matching toward users. *(2026-10-13: owner kept by GATE-01. Since GATE-03, `QAN-BL-MATCH-02` is the second open item owned by a Stage 6 task. Whether S6-01 "resumes" or starts fresh is still undecided; §14.2.)* | S6-01 (owner string verbatim if GATE-01 (a); proposed: tombstone at closure if the approved path lands, or re-own the residue to one named task) |
| `QAN-BL-ACCT-01` (HIGH, `OPEN — UNASSIGNED`) | Bears on every footprint. Does **not** fire at WP0 (nothing goes toward users). Fires when S6-01 does. | Stays unassigned with dated notes, unless the Product Owner assigns it (GATE-05); assigning re-anchors seven pinned contracts |
| `QAN-BL-PROD-06` (HIGH, `DEFERRED — OWNED`, HOSTED-DEPLOY-01) | Does not fire at WP0. The restored six "carry the same rule". | Observed by every wrapper task; owner unchanged |
| `QAN-BL-PROD-07` (LOW, PROD-RETRY-02) | Bears: post-v16 race-converging `40001` paths (the 0114 / 0116 races) | Observed in S6-02 (END vs SUCCESS) and the S6-04…S6-06 wrapper designs |
| `QAN-BL-SEC-01` (HIGH, QAN-SEC-01) | Bears: names Match; fires before the first store release | Observed by every mobile task |
| `QAN-BL-VOICE-01` (HIGH, `OPEN — UNASSIGNED`; the roadmap places Voice in Stage 8B, not an owner) | Bears: the Live-Call rule (vacuous), voice notes; does not fire | Consumer side in S6-04 / S6-07 |
| `QAN-BL-NOTIF-02` (HIGH, PROACTIVE-EVT-01) | Bears: Proactive Gate `ABSENT`; whether a Matching moment is a Proactive candidate | Offer → 8A / PROACTIVE-EVT-01; classification recorded in S6-04 or S6-07 (GATE-27) |
| `QAN-BL-NOTIF-05` (HIGH, Release Hardening physical devices) | Bears: physical proof of the Introductions channel, education moment and L0 | Observed in S6-01 PR-B and S6-07 |
| `QAN-BL-NOTIF-03`, `NOTIF-04` | Outside (no Matching coupling) | — |
| A3-01 Gap Matrix G-17 (an exit gate, not a register item) | Inherited by the execution map: entry, Settings row, producer, Direct Entry, truthful entry | S6-01 PR-B and S6-07; re-anchor A3-01 test 7 and the mobile pins |
| `QAN-BL-CW-02` (HIGH, SHARED-CTX-01) | Bears: owns the "self-authored `MY_WORLD`" definition and collector; post-SUCCESS reasoning needs a new grant | S6-01 builds no collector (anti-duplication note); S6-06 records the post-SUCCESS need |
| `QAN-BL-CTX-01` (HIGH, QAN-CTX-01) | Bears if candidate evaluation counts as cross-domain relevance selection | S6-03 records the ruling |
| `QAN-BL-CW-05` (Stage 8A), `QAN-BL-ACE-02`, `QAN-BL-IP-02` (Stage 8A) | Bear: Introduction-phase Worlds use the Shared reply path; real-model quality is Stage 8A | Stage 8A; S6-05 records that replies answer `UNAVAILABLE` while unbound |
| `QAN-BL-CW-06`, `CW-07` (`OPEN — UNASSIGNED`) | Bear only if Introduction Worlds open on the Living Analysis surface (GATE-29) | Noted in S6-05 after GATE-29 |
| `QAN-BL-VIS-01` (LA-SCALE-01), `QAN-BL-LAUNCH-04` (Issue #322, §9) | Bear only under the same Living Analysis condition | Observed in S6-05 / S6-07 if so; otherwise outside |
| `QAN-BL-PRIV-01…03` (PRIV-EXPORT-01) | Bear: a candidate owner for Matching export (`0153:314`) | GATE-19 decides *(decided 2026-10-13: GATE-19 led to `QAN-BL-PRIV-04`; WP0 assigned it to S6-07, awaiting the Product Owner's confirmation, and did not choose `PRIV-EXPORT-01`; §14.4; the owner and severity were confirmed by D2, and the Shared, Public and Replay categories went to `PRIV-EXPORT-01` as `QAN-BL-PRIV-05` by D5, §14.14)* |
| `QAN-BL-PROD-04` (PROD-AUTH-01), `QAN-BL-PROD-05` (PROD-DATA-01) | Bear: auth-verification cost of new routes; discovery / listing fan-out | Observed in S6-01, S6-03, S6-04, S6-07 |
| `QAN-BL-CI-01`, `CI-02` | Bear: validation reopen hazards | Observed in every S6 validation |
| `QAN-BL-LAUNCH-01` | Bears at launch only | Stage 9 |
| `QAN-BL-NAV-02` (MEDIUM, `OPEN — UNASSIGNED`) | Bears only if GATE-35 allows Replay of Introduction material | Stage 7; outside Stage 6 |
| `QAN-BL-INTEL-02`, `INTEL-03`, `QIR-01`, `QAN-BL-IP-01` | Outside while Stage 6 reads no Personal intelligence (IP-01: Public replies only) | — |
| `QAN-BL-LAUNCH-02`, `LAUNCH-03`, `QAN-BL-NAV-01`, `QAN-BL-LANTERN-01`, `QAN-BL-CW-04` and the remaining items | Outside: no Matching / Introductions coupling (LAUNCH-03: an Introduction World is born by Match, not invitation — an inference) | — |
| I-07 deferrals to Connected Worlds `I-08` and `I-09` / CW2-08 (named owners, not register items) | Bear: the I-07 closure record assigned them; E2E Next Closure Waves maps E2E-I-01…I-10, I-12 to I-08 and I-13 to I-09 | GATE-01 decides whether Stage 6 discharges I-08; I-09 / Stage 9 keeps the seams, block policy and gate opening. *(GATE-01 approved 2026-10-13: S6-series tasks consume the I-07 runtime; I-09 / Stage 9 retains launch authorization and gate opening; phase `I-08` is not declared closed; §14.2.)* |
| **Proposed new admissions** (not made by WP0) | (i) the Introduction-phase account-Name leak; (ii) the Stage 8A Matching conclusion producer, AI-COST family and eval suite; conditional: the Matching / Introductions export item (GATE-19), the image / media pipeline item (GATE-18), the Arabic floor item (GATE-26), orchestrator operational visibility | Each with one named owner at the Kickoff, if the Product Owner approves (GATE-03). *(Decided 2026-10-13: (i) admitted as `QAN-BL-MATCH-02` (S6-02) and (ii) as `QAN-BL-MATCH-03` (Stage 8A), in this PR. The conditional items are not admitted; §14.4. The final approval package then admitted the export item as `QAN-BL-PRIV-04`, owner S6-07, at GATE-19; the image, Arabic floor and orchestrator items stay unadmitted.)* |

---

## 9. Issue #322 — admission as `QAN-BL-LAUNCH-04`

**Decision.** The Product Owner's WP0 brief (§8) approved admitting GitHub Issue #322 to the register as
`QAN-BL-LAUNCH-04`, *Shared / Public Living Analysis — Physical Android Rapid-Interaction & Resize Stability Proof*:
severity `HIGH`, status `DEFERRED — OWNED`, owner `Stage 9 — Economy + Launch Closure (release-readiness gate)`, source
Issue #322. GOV-REC-01 had proposed the admission and left it to the Product Owner (its record §7; its proposed title
differed slightly, with a hyphen in "Physical-Android" and an "(Issue #322)" suffix; the Product Owner's wording is
recorded).

**What does not change.** Issue #322 stays `OPEN / NOT PROVEN / RELEASE BLOCKER` on GitHub (read 2026-10-13). It is not
closed, waived or reclassified, and SHARED-VIS-01 is not reopened. The issue remains the home of the evidence; the item is
its register entry.

**Anti-duplication (checked before admitting).** The ID was unused (`git grep` and `git log --all -S` find no
`LAUNCH-04`; only `LAUNCH-01…03` exist). No live or tombstoned item carries the obligation:

- `QAN-BL-NOTIF-05` covers only the native-Push physical-device exit gates PD-01…PD-09.
- `QAN-BL-VIS-01` covers heavy-history scale, LOD and real-device scale / performance (its D6, and LA-VIS-01's
  real-phone performance) — not stability under rapid interaction or resize at any scale (GOV-REC-01 record §7; the
  `QAN-BL-LAUNCH-04` anti-duplication line states it explicitly).
- `QAN-BL-MOT-03` / `QAN-BL-RSP-01` are T-12 tombstones for the Personal world on `02bff1b6…`, before the Shared consumer
  and the `WorldCanvas` correction existed.
- `QAN-BL-CW-03`'s tombstone puts this release evidence explicitly outside its scope.
- `QAN-BL-CI-01` is the iOS simulator Maestro driver.
- VAL-01's only `PHYSICAL_DEVICE_REQUIRED` facts are the nine PD gates, all NOTIF-05's.

**Required future property.** Exactly the six evidence points of Issue #322 (read on GitHub, matching GOV-REC-01 §2 and
SHARED-VIS-01 §15): a physical Android phone and a release-representative build; both consumers (Shared and Public) through
FAR → MID → NEAR, focus, panel open / scroll, Back and return; at least 12 panel-scroll-Back cycles and 4 rapid open / Back
cycles, the rapid cycles covering resize during active camera motion; no ANR, unrecovered stall, lost touch, persistently
missing labels or wrong focus (one Product failure is a FAIL); auditable proof (SHA, APK hash, device and Android version,
step-by-step PASS / FAIL, screenshots / logs / recording, exception classification) recorded in canonical
release-readiness evidence; without a physical device the result stays `NOT PROVEN / LAUNCH BLOCKED`, and no waiver without
a new explicit Product Owner decision recorded with the release risk.

**Owner.** One named owner (BG-02). The issue's "or an earlier explicit validation owner when a physical device becomes
available" is recorded as a re-owning route — made explicitly in the register, never silently — not as a second owner.

**Files changed for the admission.** *(This table and the counts below describe the `QAN-BL-LAUNCH-04` admission at
`30dff6f6`. The later GATE-03 admissions and their files are in §14.)*

| File | Change |
|---|---|
| `docs/qandeel-canonical-backlog-v1.md` | §4: one index row after `QAN-BL-GOV-01`. §5: the full item (every §2 schema field, anti-duplication line, admission sentence). §6: a dated bullet inside the `QAN-BL-CW-03` tombstone before its Status line (its disposition unchanged; the Status line still ends the tombstone). §7: the counts table (27 / 4 / 10 / 22 = 63; 32 / 29 / 2) and a dated "Stage 6 WP0 governance admission" paragraph with its "Latest index" line. §9: rows for `Stage 6 — Matching & Introductions Kickoff (WP0)` and `Stage 9 — Economy + Launch Closure (release-readiness gate)`. Earlier dated paragraphs and rows are untouched. |
| `QANDEEL_CURRENT_STATE.md` | §1 snapshot cell: a dated WP0 sentence appended after GOV-REC-01's entry. §3.7 SHARED-VIS-01 row: GOV-REC-01's "not a register item" sentence kept verbatim, plus a dated admission note. §5: both count tables, a new dated recount note above GOV-REC-01's (kept verbatim), an appended "Latest update", "The 41 active items" with the `QAN-BL-LAUNCH-04` row at the end of index order. §7 Stage 9 owners row: names the item and its one owner; the old sentence kept as a quoted historical note. |
| `QANDEEL_PROJECT_MAP.md` | The GOV-REC-01 checkpoint's "not a backlog item" and "62 items" lines each gain a dated WP0 note. Nothing else (the current-task line is pinned; §11). |
| `docs/e2e/QANDEEL_SHARED_VIS_01_…_RECORD_v1.md` | §15's "It is not a backlog item" gains a dated note. §1–§14 and the Status banner are unchanged. |

**Counts, recounted mechanically from the §4 index** (the `INDEX_ROW` regex of the governance test):

| | Before (GOV-REC-01) | After the `QAN-BL-LAUNCH-04` admission |
|---|---|---|
| Total | 62 | **63** |
| `DEFERRED — OWNED` / `VALIDATION — OPEN` / `OPEN — UNASSIGNED` / `CLOSED — TOMBSTONE` | 26 / 4 / 10 / 22 | **27 / 4 / 10 / 22** |
| `HIGH` / `MEDIUM` / `LOW` | 31 / 29 / 2 | **32 / 29 / 2** |
| Active (not tombstoned) | 40 (14 / 24 / 2) | **41 (15 / 24 / 2)** |

No duplicate ID; the Current State active list has 41 rows in index order. The roadmap is unchanged: §6.6 already records
Issue #322 as `OPEN` under the Stage 9 release-readiness gate, which stays true. *(The roadmap later gains a §6.7 status
note for the Product Owner's decisions; §14.11. The §6.6 statement about Issue #322 is untouched.)*

---

## 10. Product Owner Decision Gate

The research produced overlapping decision lists. The completeness critic merged and de-duplicated them, and the review
pass re-tiered them by what each one blocks. Nothing is decided. "Recommended" is the research package's recommendation,
labelled as such; "none" means the research makes no recommendation. *(2026-10-13: the Product Owner has since decided
every gate, at the level §14 records (the sub-questions left open are in §14.9). Tier 0 came first, then a consolidated final approval package covering all tiers and the Stage 9 rows (§14).
The tables below keep the options and recommendations as they were put to the Product Owner. The decisions are in §14,
and none authorizes implementation.)*

### Tier 0 — before any Stage 6 Task Contract

*Decided by the Product Owner on 2026-10-13: all three approved (§14.2 … §14.4). The table is kept as it was put to the
Product Owner.*

| ID | Decision | Blocks | Options | Recommended |
|---|---|---|---|---|
| GATE-01 | **Framing and S6-01's lifecycle.** Are Stage 6 tasks S-series tasks that record discharging the Connected Worlds `I-08` surface ownership, or is Stage 6 phase `I-08` (`**Phase:**` banner and an `### I-08 closure record`)? Does Stage 6 also take over from `I-09` the reviewed, closed-by-default wrappers over the I-07B–D human-action cores (I-07 record §22, §43; 0112:28; 0114:696; 0116:1661), with I-09 / Stage 9 keeping the CW2-08 seams, `INTRODUCTION_BLOCK_POLICY` and every gate opening? Does S6-01 "resume" (which fires MATCH-01's automatic reopen) or start fresh under a new contract? Does MATCH-01 keep the owner string `S6-01 — Intelligent Matching Onboarding`? Which S6-01 brief or decisions govern — the S6-01 brief, Reality Check and D1–D6 that CI-01 C0 :323 cites are not in the repository, and Roadmap §6.3 says "Paused" while the Project Map says "Not started"? | Every Task Contract; the Kickoff change; BG-05 / BG-08 | (a) S-series + a dated I-08 note, Stage 6 builds closed wrappers and I-09 opens them, S6-01 keeps MATCH-01; (b) Stage 6 = phase I-08; (c) re-own MATCH-01 | (a) |
| GATE-02 | **Definition of done and sequencing.** May Stage 6 close integrationally with the provider unbound and every CW2-08 seam `NOT_EVALUATED` — zero proposals and Introductions for real users? Which journeys ship live versus dormant behind closed gates? Does the local "return gate" (CI-02…05: task names from the Product Owner's local notes, not repository ids and unrelated to `QAN-BL-CI-02`) precede S6-01? | The scope and evidence of every task; closure claims; S6-01's start | (a) J01 manual + J02–J05 behind closed gates, J06+ fail-closed, the closure says "not launch-ready, zero proposals"; (b) hold Stage 6 for an 8A Matching slice and CW2-08; (c) development / staging only until ACCT-01 and CW2-08 | (a); the return gate is the Product Owner's sequencing call |
| GATE-03 | **Kickoff governance actions.** Authorize BG-08 admissions: (i) the Introduction-phase account-Name leak (§2.5); (ii) the Stage 8A Matching conclusion producer, AI-COST family and eval suite; conditional: the Matching export item (owner in GATE-19), the media / image pipeline item and the Arabic floor item (owners in GATE-18 and GATE-26), orchestrator operational visibility. Also: re-anchoring the current-task pins; the dated drift notes of §11. | S6-02's ownership; S6-03's port design | Admit now with named owners; or carry each in its task's contract and admit at closure | Admit (i) → S6-02 and (ii) → Stage 8A at the Kickoff |

### Tier 1 — before S6-01

| ID | Decision | Blocks | Options | Recommended |
|---|---|---|---|---|
| GATE-04 | **MATCH-01 launch path and caller model:** is an in-database, closed-by-default gate with `authenticated` SECURITY DEFINER wrappers the permitted "server-canonical launch path" or the forbidden "client-executable wrapper"? (§7) | S6-01 server; every later wrapper | O-B gated wrappers; O-C service-role path (reopens frozen consent law); G-C + 0129 freshness; G-D seam only; O-A hold | O-B; reject O-C |
| GATE-05 | **Footprint and `QAN-BL-ACCT-01`:** what "truly enrolled" means; which strategy; refuse enrollment while a deletion is `SCHEDULED`; does ACCT-01 stay unassigned? | S6-01 server; launch of J02–J11 | F-1 closed until ACCT-01; O-D draft + one enrollment act; O-E setup-only erasure under a named owner; F-4 a full contract | F-1 now; commission O-E; F-4 before launch; refuse while `SCHEDULED` |
| GATE-06 | **Scopes and order:** first creation vs correction / resume / reconfirmation; correction coupled with disclosure re-approval? | S6-01 server | One scope; separate scopes; coupled correction; activation-first (needs an Architecture ruling) | Separate scopes; couple correction after reproducing the finding |
| GATE-07 | **`40001` and replay:** how the six's 13 raise sites are made safe; what a replay answers after a scope closes | S6-01 server; the same rule for every later wrapper | R-1 absorb; R-2 convert (re-creates the six); R-3 rely on v16 (fails the current guard; PROD-06 option (a)) | R-1, committed-result replay |
| GATE-08 | **Resume revalidation** (CW2-06 §50 vs 0109) | S6-01 resume scope | Bind a gate snapshot and rely on downstream revalidation; also require a CW2-08 seam; the wrapper revalidates | An Architecture ruling; the least-amending first option |
| GATE-09 | **Gate home, environments, consequential action, re-auth** | S6-01 migration design | A separate Matching gate or the shared CHECK; pilots on a separate environment; snapshot binding; a 0129 proof | A separate gate; no cohort runtime in Stage 6 |
| GATE-10 | **Is the Matching Context Grant mandatory for matchability?** | S6-01 activation content and revoke surface | Keep the runtime rule; make it optional by controlled amendment | Keep the runtime rule |
| GATE-11 | **Intelligence around Matching:** onboarding personalization from Personal context (outside the grant's fixed purpose); which intelligence classes Matching may ever read; HIM's role; QIR rule 7; who defines "self-authored `MY_WORLD`" (CW-02 or Stage 6) | Whether S6-01 reads Memory at all; later S6-03 inputs | No personalization (explicit input only); a new consent family by CW2-06 amendment; user-confirmed suggestions as input | No personalization in S6-01; one CW-02-owned definition |
| GATE-12 | **Introduction First Name store and owner read-back** (read-back was deliberately deferred by I-07A) | S6-01 server and mobile; S6-03 seam wiring | Reserved profile key; dedicated confirmed store; keep `UNRESOLVED`. Read-back: a new owner-only boundary, or no correction UI | Decide the store before any J03 UI; read-back with the correction scope |
| GATE-13 | **Entry and pre-entry visibility:** manual-entry placement, presentation and glyph; what a user sees while the gate is closed; whether the always-drawn chip and the unconditional Android channel fit D26; what "legitimately entered" means; whether the conversational offer comes now or at Stage 8A, and its re-offer policy | S6-01 (entry, closed-gate state, entry truth); the offer → Stage 8A | Manual only in Stage 6, offer at 8A; manual + Settings group only; both, the offer behind a refusing port | None (the research digests, which are not authority, lean to manual-only now) |
| GATE-14 | **Activation / onboarding flow and lane:** scripted or conversational (CW2-06 §5 is headed "activation conversation"); inside Introductions or a Settings toggle; where activate / pause / resume / off live; the E2E-I-03 "how Introductions works" explanation | S6-01 mobile | Scripted inside Introductions; a Settings toggle opening setup; conversational in a separate Matching lane (needs 8A) | None binding; every option bypasses the Personal Memory write |
| GATE-15 | **Profile field catalogue and user-facing names** ("Introduction Profile", "Introduction Phase", the activation control) | S6-01 profile editor and its Copy Gate | A bounded catalogue from the Product Definition examples; a minimal first name + intent | None |
| GATE-16 | **Requirement dimensions and eligibility facts** (age; who may be proposed to whom — no gender concept exists); whether an empty set is matchable | S6-01 capture; the evaluation method → S6-03 (Tier 3); the legal-policy owner → Stage 9 | Structured catalogue; free text judged by 8A; hybrid. Empty set: allow by change, or keep required | None (only the catalogue needs no 8A) |
| GATE-17 | **Consent / onboarding Copy Gate:** consent and revocation copy; consent-version capture (no column exists); first-name wording; requirement editing copy and how an UNKNOWN or blocking requirement is explained (J04); English | S6-01 Copy Gate | The S4 / S5 Copy Gate pattern; Arabic first; version capture by an additive relation or not at all | The Copy Gate pattern |
| GATE-18 | **Introduction image:** captured at setup (S6-01 scope, a new store) or at the first post-Match disclosure, or excluded from the first release; media provider; where the stage order is enforced | S6-01 scope if captured at setup; S6-06 | Capture after the Match; capture at setup; defer images | Exclude unless a media provider is explicitly authorized |
| GATE-19 | **Export of Matching / Introductions data:** owner and content — decided before S6-01 creates the first Matching footprint (the admission itself is made under GATE-03) | The export item; S6-07 | S6-01; a new item or PRIV-EXPORT-01; one cross-world export item; Stage 9 | Admit an item at the Kickoff *(not admitted by the GATE-03 approval of 2026-10-13, which covers (i) and (ii) only; then admitted the same day by the final approval package as `QAN-BL-PRIV-04`, owner S6-07; §14.4)* |
| GATE-23 | **What a pre-Match proposal displays** (G2.3 §2 vs CW2-06 §20) | S6-01 (whether field approval is built); S6-04 surface; the J08 handoff | Frozen copy only; + first name; + fields and conclusion by controlled amendment | None |
| GATE-24a | **Whether any Introduction Profile field may ever cross into a pre-Match proposal** (the field half of GATE-23; GATE-24's allowlist values stay in Tier 3) | Whether S6-01 builds the Pre-Match Disclosure Authority field-approval act at all | Frozen copy only (no field approval in S6-01); first name only; fields by controlled amendment | None |

### Tier 2 — before S6-02

| ID | Decision | Blocks | Options | Recommended |
|---|---|---|---|---|
| GATE-20 | **Interim isolation and naming:** confirm that until presentation is decided every phase-blind surface answers an Introduction-phase World as for a non-member; may Stage 6 forward-redefine Stage 4 functions (the 0118 precedent); which name applies, including after SUCCESS; who builds the ungated END wrapper (Stage 6 or I-09), and must it ship no later than any Match path? | S6-02; S6-05 and every birth path | Name: the first name until `FULL_NAME` for life; until `FULL_NAME` or SUCCESS; another rule. END: Stage 6 builds it closed; or only with the Match wrapper | The fail-closed interim; END no later than birth |
| GATE-35 | **Replay of Introduction material** (CW2-05 §22-§23; the 0119 resolver has `INTRODUCTION` branches) — this also decides whether S6-02 fences Replay | S6-02 scope; Stage 7 | Exclude until decided; internal Replay only; ordinary Shared rules | None |

### Tier 3 — before S6-03 / S6-04

| ID | Decision | Blocks | Options | Recommended |
|---|---|---|---|---|
| GATE-21 | **Launch gating of the proposal decisions (S6-04) and of the Introduction capabilities (S6-05 / S6-06: Match, disclosure, SUCCESS, reactivation, conversation);** a CW2-08 slice in Stage 6 or Stage 9; the mandatory launch requirements; company controls (flag, rollout, kill) and the Matching operational events (feature usage, errors) | S6-04, S6-05, S6-06 wrapper design; the Stage 9 boundary | Separate Introductions / Matching scopes; Shared scopes for conversation + Matching scopes for the rest; all closed until CW2-08 / I-09 | Stage 6 builds closed wrappers; Stage 9 opens them |
| GATE-22 | **Safe Compatibility Conclusion before Stage 8A;** may one provider call hold both humans' contexts? (decide with GATE-23) | S6-03 port; any J06–J11 delivery | A refusing port, zero proposals until 8A; a Product Owner-approved template (research reading, not an authority finding: the frozen clause «قنديل شايف إن بينكم نقاط اتفاق كثيرة، …» (G2.3 §2) would then rest on no model-produced understanding); a separately authorized 8A slice with per-side inputs | The refusing port |
| GATE-24 | **`PROPOSAL_SAFE_FIELDS` values and the policy-installation path** | S6-03 policy path; S6-04 views | A strict non-identifying subset by reviewed migration; first name only; defer | None |
| GATE-25 | **Policy values and selection rules:** cadence, pending maximum, expiry; pair cooldown and re-proposal (including after a closed Introduction); eager sweeping; discovery fairness; the first-recipient direction | S6-03 orchestrator, sweeper and policy rows; J07 / J11 re-introduction | About 5 a week (CW2-06 §17) with the other values to choose (no authority value exists for expiry, pending or cooldown); conservative values tuned through policy versions; no re-proposal after any terminal outcome. Fairness: keep the frozen ordering, or amend under Architecture review | None on values |
| GATE-26 | **Arabic contact / sensitive floor** before any disclosure path; a floor for field values; its owner (Stage 6 or CW2-08) | S6-03 floor; any J06 delivery | A deterministic Arabic floor as a prerequisite; model-assisted extra refusals (8A); first name and conclusion only until coverage exists | None |
| GATE-27 | **Matching moment placement outside the Analysis; the Direct Entry landing (the Introductions Direct Entry of J01 and the Matching moment's); a recipient's own pending list; is a Matching moment a Proactive candidate (NOTIF-02)?** | S6-04 surface and listing; S6-07 Direct Entry | The Analysis only + Activity Direct Entry; any non-Analysis Personal surface under P3; Activity only | None |
| GATE-28 | **Matching Copy Gate for the open lines** (cue, acknowledgement, unavailable, second-accepter, later arrival, welcome, decline act, phase word, English, error copy) **and how a woman is addressed** (§3.2 item 5) | S6-04, S6-05, S6-07 Copy Gates | Ratify the G3.2 proof lines; new PROPOSED rows; Arabic first. Address: keep; a neutral amendment; variants on an explicit preference | The Copy Gate pattern |

### Tier 4 — before S6-05…S6-07

| ID | Decision | Blocks | Options |
|---|---|---|---|
| GATE-29 | **How an Introduction World is presented** while active and after END, and its name. It belongs to the Shared World area «العالم المشترك» (frozen, G2 §D). Does it open on the Living Analysis surface (which decides CW-05…07, VIS-01 and #322 applicability)? | S6-05 | A distinct Introduction phase in the Shared root; reached only through Introductions until SUCCESS (requires a controlled amendment of G2 §D); both |
| GATE-30 | **The opening and QANDEEL Introduction mode:** may it read the handoff; until the mode exists, should the Shared reply path answer at all in an Introduction (any different behaviour needs a controlled ACE-SP-01 amendment)? | S6-05 | A neutral welcome, handoff not rendered; a QANDEEL-led opening by ACE-SP-01 amendment; defer the mode to 8A |
| GATE-31 | **Activity category of in-World events, the producer's event set and sentences, per-World mutes for Introduction Worlds** | S6-05 (in-World events); S6-07 | `INTRODUCTIONS` for all (L0); `SHARED` for messages and `INTRODUCTIONS` for lifecycle |
| GATE-32 | **Disclosure presentation and owner-approval UI; how a request is shown** | S6-06 | A separate panel; inline thread items; defer to the I-08 design pass |
| GATE-33 | **Who starts SUCCESS; the pending-approval presentation; the server caller for prepare / commit** | S6-06 | QANDEEL-only (dormant until 8A); either human or QANDEEL, both approve; defer |
| GATE-34 | **End and after:** the neutral END notice (carrier, copy); reactivation timing after SUCCESS (re-introducing a pair: GATE-25) | S6-05 (END), S6-06 (reactivation), S6-07 (notice) | Product Definition semantics via a Copy Gate; align with the closed Shared World name (E2E-G-13); reactivation only after the converted World ends |
| GATE-39 | **One's own Matching status while paused by `ACTIVE_INTRODUCTION`, `POST_SUCCESS` or `POST_INTRODUCTION`** (J11) | S6-05, S6-06 | Shown in the S6-01 read-back; shown only inside Introductions; not shown until reactivation |

### Stage 9 launch blockers to record now (not Stage 6 work)

| ID | Decision |
|---|---|
| GATE-36 | `INTRODUCTION_BLOCK_POLICY` and whether Introduction conversation is "private QANDEEL conversation content" under CW2-08A. CW2-08 §13 keeps the path disabled and forbids a hidden default; Stage 6 sets none. |
| GATE-37 | Introductions free in v1, or entitlement-gated (Plan / Usage). Recommended: no entitlement in Stage 6. |

### Resolved by the WP0 brief

| ID | Decision |
|---|---|
| GATE-38 | Admission of Issue #322 as `QAN-BL-LAUNCH-04` — **approved by the Product Owner; done in this change (§9).** |

### Decided by the Product Owner after review (2026-10-13)

| ID | Decision |
|---|---|
| GATE-01 | **APPROVED** — the framework recommendation (a), with the Product Owner's limits (§14.2). |
| GATE-02 | **APPROVED** — the framework recommendation (a), with the Product Owner's limits; the Return Gate and S6-01 kickoff ordering still need reconciliation (§14.3). |
| GATE-03 | **APPROVED** — admissions (i) and (ii) only: `QAN-BL-MATCH-02` (owner `S6-02`) and `QAN-BL-MATCH-03` (owner Stage 8A). The other conditional admissions are not approved automatically (§14.4). |
| GATE-04 … GATE-37, GATE-39 | **Decided in the Product Owner's consolidated final approval package** (2026-10-13), each as approved Product intent, direction or initial policy proposal. None authorizes implementation (§14.5). GATE-19's export obligation is admitted as `QAN-BL-PRIV-04` (§14.4). |

---

## 11. Locator drift observed (recorded, not fixed by WP0)

WP0 corrected only the statements the admission made false (§9). The rest belongs to the Kickoff change the Product Owner
authorizes (GATE-03), each as a dated note that keeps history. *(2026-10-13: the GATE-03 approval covers the two
admissions only. It does not cover these drift notes or the pin re-anchoring, which are still not made. The Tier 0
decisions and the final approval package added the dated notes that §14.11 lists.)*

1. `QANDEEL_PROJECT_MAP.md` — the single `> **CURRENT TASK: GOV-REC-01 …**` line still names a merged task. It is pinned by
   `tests/s5-03b-…` test 9 and `tests/s5-03c-…` test 8; the Stage 6 Kickoff re-anchors them (validation only), together
   with shared-vis-01 test 7's "no `Stage 6 … **ACTIVE`" pin on Current State. WP0 did not move it, because WP0 authorizes
   no Stage 6 lifecycle change.
2. `QANDEEL_PROJECT_MAP.md` §5.1 Stage 6 row: "NEXT after GOV-REC-01 closes … Not started"; its consumption list omits 0119,
   0149, 0150 and the Shared interplay (0138–0141, 0148). Its cross-cutting launch-gates table omits `QAN-BL-LAUNCH-03` and
   `QAN-BL-PROD-06` (pre-existing).
3. `QANDEEL_PRODUCT_ROADMAP.md` §6.3 "Paused: S6-01 … decision checkpoint" contradicts "Not started" elsewhere; §6.6
   "Current: GOV-REC-01" is superseded by the merge (a new §6.7 note at the Kickoff, by convention).
4. `QANDEEL_CURRENT_STATE.md` — the GOV-REC-01 checkpoint has expired with the merge; the §3.7 SEC-MATCH-00 row says
   "S6-01 stays paused; CI-01 follows SEC-MATCH-00's merge" (CI-01 has merged); line 107 says CW2-08 has "no executable
   runtime" (0138 ships the Shared subset); the I-08 owner row (and I-07 record §24) say "candidate cards or feed", against
   the frozen no-feed law.
5. `docs/matching-introduction-runtime-v1.md` — §47's lifecycle still reads "awaiting … merge decision" (PR #323 merged
   as `e07857b`); the header's migration list ends at 0118 (omits 0119, 0120, 0122, 0149, 0150).
6. `docs/e2e/QANDEEL_E2E01_GAP_MATRIX_v1.md` — section I and E2E-I-02 still say eleven setup commands are `authenticated`
   (pre-0149); E2E-D-03 says no Name store exists (0123 added one); E2E-D-17 predates 0130 and cites the tombstoned
   `QAN-BL-CW-01`. `QANDEEL_E2E01_NEXT_CLOSURE_WAVES_v1.md` maps E2E-I rows to I-08 / I-09 (re-map after GATE-01).
7. `docs/qandeel-canonical-backlog-v1.md` `QAN-BL-ACCT-01` — the body says "no account-deletion code exists on main" (stale
   since 0130) and a reopen clause names the tombstoned `QAN-BL-CW-01`. `tests/sec-match-00-…:209-213` pins this item's
   row and a note string ("implemented, not merged"), so editing either is a deliberate contract amendment.
8. Immutable migration comments — 0111:333-343 (users has no name) and 0139:154, 199 ("not ACTIVE / STANDARD") — need
   dated notes where Stage 6 records the fence, not edits.
9. Export citations should name the live `0153` replacement (0153:224, 314), not `0130:615`.
10. `apps/api/src/activity/activity-publisher.service.ts` doc comment says "nothing on main calls it"; S4-04 and S5-04
    producers do.

---

## 12. Validation (proportional to a documentation change)

The change is documentation and governance only: no code, migration, API, screen, copy, test or CI file. Validation is
therefore the static contracts that read the edited documents, the governance gate, the forward-safety mirror and a
mechanical recount, run locally on the branch.

All checks ran on the final state of the branch (base `13514200`), on Windows with Node.

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Task-closure governance gate (AGENTS.md §10.7) | `npm run test:task-closure-governance-contract` | **PASS 24 / 24** |
| 2 | The 24 static contracts that read the edited documents: `a3-01`, `ace-01`, `ace-sp-01`, `ci-01`, `intel-tm-01`, `prod-sec-01`, `s5-01`, `s5-02`, `s5-03a`, `s5-03b`, `s5-03c`, `s5-04`, `sec-match-00`, `shared-vis-01`, `t11`, `t12`, `t12p`, `t14`, `task-closure-governance`, `val-01`, `vport-02`, `w2-02`, `w3-mega-s` (under `tests/`) and `database/tests/replay-distribution-reconciliation-closure-v1` | `node --test <the 24 files>` | **PASS 367 / 367** |
| 3 | Forward-safety mirror | `node --test tests/forward-safety-contract.test.mjs` | **PASS 35 / 35** (396 s). A first attempt was stopped by my own 300-second bound, not by a failure. Under `QAN-BL-CI-02` a local forward-safety result is not relied on for a merge decision; CI runs it. *(Precisely: on a push to `main`, API CI runs it together with the governance gate (`api-ci.yml:110`, `:143`) under VAL-01's change-aware plan, which may carry an earlier green run forward and re-run only the root contracts that read the changed paths. Nothing runs it on this PR; see the correction below.)* |
| 4 | Mechanical recount of backlog §4 with the governance test's `INDEX_ROW` shape | a local Node script | 63 rows, no duplicate ID; 27 / 4 / 10 / 22; 32 / 29 / 2; 41 active (15 / 24 / 2); the `QAN-BL-LAUNCH-04` row parses; the Current State active list has the same 41 IDs in index order |
| 5 | Relative Markdown links in the five changed files | a local Node script | 499 checked, **0 broken** |
| 6 | Whitespace | `git diff --check`; a trailing-space search on the new record | clean |

GitHub was read, not written, for the baseline: `gh api repos/allamqandeel/qandeel/commits/main` →
`135142004097136336d586e5d5ff6cfd119cd864`; `gh issue view 322` → `OPEN`.

**Not run, deliberately:** database verifiers, API and mobile suites, Maestro, and any CI loop. Nothing they cover
changed. The PR's own CI is the remaining check. *(Corrected 2026-10-13: no CI workflow runs on this PR. Three
workflows have a `pull_request` trigger: `api-ci.yml`, `mobile-ci.yml`, and `focused-database-verification.yml`, which
runs only for its own files. None of their path filters matches `docs/**` or the root locator Markdown files, and GitHub
reports no checks for PR #335. The local checks above are therefore the PR's only validation; §14.12 records the same
for the decision update.)*

**Independent review before commit.** Five reviewers re-read the record and the diff against the repository, each with a
different lens: facts (§2, §6, §7), the census and gap matrix, governance consistency, overreach and Product Owner rules,
and the decomposition and decision gate. They reported 81 findings: 2 BLOCKER (a wrong CI claim — the `database/tests`
I-07 contracts do run, indirectly — and the then-unfilled validation table), 23 MAJOR and 56 MINOR. All were applied. One
was applied differently: the backlog line references keep their baseline numbers and §1 states that, instead of being
renumbered. The main corrections:

- GOV-REC-01's Current State sentence about Issue #322 is restored verbatim, with the dated note appended.
- The backlog §7 paragraph no longer says the Stage 6 Kickoff "began".
- The §8.2 blocks are labelled scope sketches with illustrative evidence, not Task Contracts.
- The §10 gates are re-tiered by what they block, with GATE-19, GATE-23, GATE-24a and GATE-39 placed or added.
- The census classes are corrected where frozen authority already decides a step.

---

## 13. Scope — what WP0 did not do

- No Matching functionality, screen, route, migration, grant restoration, gate, wrapper or copy; no frozen contract
  changed; no test or CI file changed.
- No Task Contract written; the task count, the decomposition and every decision in §10 remain the Product Owner's.
  *(2026-10-13: Tier 0 has since been decided, and then every remaining gate by the final approval package, which also
  approved the seven-task map as a planning direction (§14.5, §14.6). No Task Contract is written.)*
- S6-01 not started or resumed; Stage 7, 8A, 8B and 9 not started.
- `QAN-BL-MATCH-01`, `QAN-BL-ACCT-01`, `QAN-BL-PROD-06` and every other item keep their owner, severity, status and
  disposition. The only item text added besides the new `QAN-BL-LAUNCH-04` is a dated pointer in the `QAN-BL-CW-03`
  tombstone. No proposed admission in §8.5 was made. *(2026-10-13: after the Product Owner's GATE-03 decision, admissions
  (i) and (ii) were made as `QAN-BL-MATCH-02` and `QAN-BL-MATCH-03` (§14). The conditional ones were not, except that
  the final approval package then admitted the export obligation as `QAN-BL-PRIV-04` at GATE-19 (§14.4).)*
- Issue #322 not closed, waived or reclassified; SHARED-VIS-01 not reopened.
- The locator drift of §11 left for the Kickoff change, except the statements the admission itself made false (§9).
  *(2026-10-13: and, likewise, the statements the Product Owner's decisions made false; §14.11.)*
- No merge: the Product Owner decides, on review of this record and its PR.

---

## 14. Product Owner decisions (2026-10-13)

The Product Owner reviewed this record at `30dff6f6` (Draft PR #335) and decided in two messages on 2026-10-13:

1. **Tier 0 update.** GATE-01, GATE-02 and GATE-03 approved, with the two GATE-03 admissions recorded in this PR.
2. **Consolidated final approval package.** It restates those approvals. It decides every remaining gate, adds a binding
   QANDEEL-wide language rule, and approves the seven-task Stage 6 map as a planning direction.

The package is **APPROVED subject to the explicit architecture, privacy, security and Copy Gate boundaries it states**.
It authorizes **decision recording and governance updates only**: it authorizes no S6-01 implementation, runtime change,
migration, grant, API, screen, AI provider, frozen-contract amendment, deployment or merge. Throughout this section
**APPROVED PRODUCT INTENT** (or any of the Product Owner's labels: APPROVED, APPROVED DIRECTION, APPROVED PRODUCT
DIRECTION, APPROVED AS INITIAL POLICY PROPOSAL) means a decision that future Task Contracts must honour. GATE-25's values
are the exception in kind: they are starting limits to research and validate, not values a contract must adopt. None
of these labels means IMPLEMENTATION AUTHORIZED: no gate below authorizes implementation. The decisions are recorded at
the level the Product Owner stated them. The sub-questions they leave open are listed in §14.9. The tables
of §10 keep the options and recommendations as they were put to the Product Owner.

### 14.1 Binding language and localization rule (QANDEEL-wide)

**A. Dynamic QANDEEL conversation.** QANDEEL adapts its spoken and written conversational language to the user's
preferred language, dialect and interaction preferences: Egyptian Arabic for a user who prefers Egyptian Arabic, Gulf
Arabic for a user who prefers a Gulf dialect, Modern Standard Arabic or another supported language when preferred. This
concerns genuinely generated conversational responses.

**B. Fixed Arabic application copy.** **All** static Arabic application copy **must** use neutral Modern Standard Arabic
or simplified Modern Standard Arabic suitable for users across the Arab world. This includes:
- navigation and screen titles;
- buttons, labels and settings;
- onboarding and guided setup;
- **prewritten QANDEEL messages appearing in guided conversations**;
- consent and privacy explanations;
- Matching proposals and system notices;
- Activity and Push notifications;
- error, success and empty-state messages;
- accessibility labels and instructional copy;
- Introduction lifecycle and disclosure messages.

Egyptian colloquial Arabic, or any other regional dialect, is not used as the default for fixed strings. The Arabic is
natural, concise, welcoming, **gender-considerate** and understandable across Arabic-speaking regions. A scripted message
inside a chat bubble is not dynamically generated content, so it still follows the static-copy rule. English copy remains
separately reviewed.

**Scope.** The rule applies across QANDEEL, not only Matching.

**Controlled amendment.** Previously frozen G2 / G2.3 and other approved Arabic copy is inspected. Where it contains
dialect-specific phrasing or gender-dependent wording that conflicts with the decision:
1. identify the exact conflict;
2. propose a controlled Copy Amendment;
3. present the original and the recommended replacement;
4. preserve the original historical approval;
5. do not silently rewrite frozen text;
6. do not implement replacement copy before the required approval.

**Precedence until the amendments are approved** (this record's reading of steps 5 and 6): the rule binds every new or
amended fixed string at every Copy Gate. The conflicting frozen language authorities (census §3) stay in force as
written until their controlled amendments are approved, and nothing frozen is superseded here.

This record does not rewrite any frozen or approved copy. §14.8 summarizes the census of conflicts, and the full census
with every original and proposed replacement is a separate PROPOSED document. Every proposed replacement awaits the
Product Owner's Copy Gate.

### 14.2 GATE-01 — framing: APPROVED

- Stage 6 uses **S6-series execution tasks**.
- They reuse the frozen I-07 Matching runtime and the Connected Worlds authority.
- Stage 6 may prepare **closed-by-default integration boundaries**.
- **I-09 / Stage 9 retains production launch authorization and gate opening.**
- `QAN-BL-MATCH-01` stays owned by `S6-01 — Intelligent Matching Onboarding`. Its row and fields are unchanged.
- **Phase `I-08` is not declared closed.** Stage 6 is not phase I-08: no `**Phase:**` banner and no `### I-08 closure
  record` are written.
- **The historical S6-01 lifecycle references are reconciled before S6-01's Task Contract.** This covers roadmap §6.3
  "Paused" against "Not started" elsewhere, the S6-01 brief, Reality Check and D1–D6 that CI-01 C0 (`docs/e2e/QANDEEL_CI_01_C0_DECISION_REPORT_v1.md:323`) cites (none is
  in the repository), and whether S6-01 "resumes", which fires `QAN-BL-MATCH-01`'s automatic reopen, or starts fresh.
  This update does not reconcile them: the Product Owner asked that they not be rewritten without evidence.

### 14.3 GATE-02 — definition of done: APPROVED

- Stage 6 may reach **engineering integration completion with the production AI provider unbound**.
- Real Matching proposals and Introductions stay unavailable until Stage 8A and the required Stage 9 gates are
  satisfied.
- No compatibility conclusion is fabricated.
- **MERGED is always distinct from DEPLOYED and LAUNCH-READY.**
- **The historical Return Gate is reconciled before S6-01 starts** (§6; §8.4). This update does not reconcile it.

### 14.4 Admissions: GATE-03 (two items) and GATE-19 (one item)

Three independently owned obligations were admitted, each after a fresh anti-duplication check:

| ID | Title | Owner | Severity | Status | Decision |
|---|---|---|---|---|---|
| `QAN-BL-MATCH-02` | Introduction-Phase Account Name Exposure Through Phase-Blind Shared World Reads | `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary` | `HIGH` | `DEFERRED — OWNED` | GATE-03 |
| `QAN-BL-MATCH-03` | Safe Compatibility Conclusion Production Capability, AI Cost Attribution and Evaluation | `Stage 8A — QANDEEL AI Brain / Production LLM Runtime` | `HIGH` | `DEFERRED — OWNED` | GATE-03 |
| `QAN-BL-PRIV-04` | Export My Data Omits the Reader's Matching and Introductions Data | `S6-07 — Activity, Direct Entry and Final Integration` | `HIGH` | `DEFERRED — OWNED` | GATE-19 (owner and severity: WP0's assignment; confirmed by the addendum's D2, §14.14) |

Issue #322 stays `QAN-BL-LAUNCH-04` (Stage 9), `OPEN / NOT PROVEN / RELEASE BLOCKER` (§9; restated by the package).

**IDs.** Register families follow the obligation's domain, never its owner: `QAN-BL-CW-05`, `IP-02` and `ACE-02` keep
their domain families although Stage 8A owns them.
- `MATCH` is the register's Matching / Introductions family. Both GATE-03 obligations exist only because of
  Introductions, and `CW` would split Stage 6's BG-05 inheritance across two families.
- `PRIV` is the family of "Export My Data Omits …" items (`QAN-BL-PRIV-01` … `03`). The GATE-19 obligation is one of
  them, so it takes `PRIV-04`.
- All three IDs, and the alternatives `QAN-BL-CW-08`, `INTEL-04` and `AI-01`, were unused in the tree, in the history of
  every ref, and in GitHub issues and PRs.

**Severities.**
- `QAN-BL-MATCH-02` is `HIGH`. If reopened, it decides whether a matched person's account Name reaches the counterpart or
  a model provider before that person's own `FULL_NAME` disclosure. That would break a frozen privacy rule (P1 §13;
  backlog §2: "an already-frozen capability"). It is latent but known from the code, so it is `DEFERRED — OWNED`, not
  `VALIDATION — OPEN` (the `QAN-BL-CW-01` and `QAN-BL-CW-02` precedents).
- `QAN-BL-MATCH-03` is `HIGH`. Without it, no recipient view can exist, so the frozen I-07 capability delivers nothing.
  That matches `QAN-BL-MATCH-01` ("Matching cannot launch") and `QAN-BL-NOTIF-02` (a frozen behaviour with no producer).
  It is not `MEDIUM` / `VALIDATION — OPEN` like `IP-02` / `ACE-02`: those measure a feature that exists, while this
  capability is absent.
- `QAN-BL-PRIV-04` is `HIGH`. `QAN-BL-PRIV-01` … `03` are `MEDIUM` because each adds one owner's own facts. This data binds
  two humans. Building the section means deciding whether a reader is added over frozen I-07 relations that were designed
  to have no downstream reader (`0110:491-493`, `:516-519`, `:621`, `:647-651`). The work decides what crosses from one person to the other, against
  frozen pair-privacy law (CW2-06 §28, §33, §38, §53; CW2-08 §2). Today the export is truthful, because it names the
  category as not yet included (`0153:314`). The severity states the consequence of the reopened work, not a present
  defect. **For the Product Owner:** `MEDIUM` would follow the `PRIV-01` … `03` reading of export as completeness only.
  This record recommends `HIGH`. *(Confirmed by D2, §14.14.)*

**Owner strings.**
- The Stage 8A string is copied character-exact from the existing rows.
- `S6-02` and `S6-07` are the Product Owner's approved task-map names (§14.6). GATE-03 named S6-02 as the owner of the
  Name exposure. This S6-02 is not the "Matching Intelligence & Eligibility" of the Product Owner's earlier local sketch
  (§8.4).
- `S6-07` for the export follows WP0 §8.2, which placed the export there. S6-07 runs last, after S6-01 … S6-06 create
  every relation the export must cover. The approved name drops the "Data Rights" of WP0's proposed S6-07 name, so the
  assignment is recorded for the Product Owner's confirmation. *(Confirmed by D2, §14.14.)*
- `PRIV-EXPORT-01` was considered and not chosen:
  - it is named for Understanding facts and holds only single-owner Personal facts;
  - it appears in no stage of the Roadmap or execution map;
  - Shared and Public export, parked on non-task owners, is still missing after Stages 4 and 5 closed.

  S6-07 reconciles with `PRIV-EXPORT-01`, because every change re-states the whole export body (`0153:222-224`).
- A rename, renumbering or fold into another task is recorded in the register as a re-owning.

**Scope limits written into the items.**
- `QAN-BL-MATCH-02` is the account Name exposure only. The rest of the GATE-20 fence (member and material views,
  conversation and Model Router input, Activity and notifications, semantic readers, Direct Entry, closed history and
  former-own-material access, the END boundary) is, in this record's reading, S6-02's planning scope (§14.5 Carrier;
  not an assignment: S6-02's Task Contract sets it), not register items. Replay of Introduction material is excluded
  until Stage 7 (GATE-35).
- `QAN-BL-MATCH-03` is conclusion production, its AI cost attribution and its evaluation only.
  - GATE-22 keeps a refusing provider-neutral port until Stage 8A, so no non-model alternative is approved.
  - GATE-23 limits what a proposal shows. If its controlled amendment changes whether a conclusion is needed at all, the
    item is narrowed or re-owned explicitly.
  - It does not absorb the deterministic floor (GATE-26), the filter policy or the CW2-08 seam. Nor does it absorb the
    unadmitted Stage 8A provider bindings of S5-03A, S5-03B and SHARED-VIS-01.
- `QAN-BL-PRIV-04` is the reader's Matching and Introductions export only. It does not cover the Shared, Public or Replay
  categories, deletion (`QAN-BL-ACCT-01`) or the package size (`QAN-BL-PROD-05`). Its open content questions are S6-07's,
  under GATE-19: which of the reader's own proposal views and received disclosures are exported; whether reasoning about
  the reader reaches the reader; and whether an export names who ended an Introduction.

**Recorded, not admitted.** The package asked for one more admission only (GATE-19). The remaining decisions are
recorded in §14.5 as approved Product intent for task scope, or as later-stage obligations that frozen authority already
carries. Admitting any of them would duplicate an owner or precede the fence it depends on:
- the media / image pipeline (GATE-18: no media provider, S6-06 scope);
- the deterministic Arabic / English floor (GATE-26: a Stage 6 prerequisite, S6-03 or the first task that opens a
  disclosure path);
- the onboarding-assistance permission (GATE-11: the amendment has no named owner yet);
- a narrow deletion correction (GATE-05: "commission an explicitly owned, narrow deletion correction if justified").
  `QAN-BL-ACCT-01` stays `OPEN — UNASSIGNED`. WP0's assessment: a correction is justified only if no pre-enrollment
  design can avoid a permanent footprint (AR-02). It needs CA-02 and a named owner, which the Product Owner is asked to
  decide (§14.9 item 4) *(answered by D3, §14.14)*;
- the Replay contract (GATE-35: Introduction material stays excluded from user-facing Replay until Stage 7 defines and
  approves its contract; only whether a register item is admitted for that contract is reconsidered at S6-02's closure,
  when the fence exists);
- Stage 9 policy and entitlement (GATE-36, GATE-37: carried by CW2-08 §13 / §20 and CW2-06 §57; the I-07 closure record
  refused to duplicate them);
- Living Analysis dependencies (GATE-29: `QAN-BL-VIS-01` and `QAN-BL-LAUNCH-04` bear only if S6-05 uses the stack);
- orchestrator operational visibility;
- the QANDEEL-wide copy conformance sweep (§14.8: Copy Gates are task-local; a sweep needs a Product Owner designation).

**Observation reported, not admitted:** the Shared, Public and Replay world-scoped export categories have no register
owner. W3-MEGA-S item 9 left them to "each Connected World's integration (Stages 4 – 7)" (`:574`). Stages 4 and 5
closed with `'shared'` and `'public'` still in `notYetIncluded` (`0153:314`). The Stage 5 records point their gaps at the
stale E2E-D-16 row, and the Stage 4 records record no export gap. Admitting an owner needs a Product Owner designation (BG-06). *(Designated by D5: `QAN-BL-PRIV-05`, owner
`PRIV-EXPORT-01`; §14.14.)*

**Defect reported, not admitted:** on `main`, the Shared removal explanation renders a literal `{0}` in Arabic and
English. Its template has two `{0}`, and `fill()` replaces only the first (census §6; `apps/mobile/src/shared-world/copy.ts:147-149`).
It is a code defect in merged S4-03 work, outside Stage 6 and outside this documentation-only change. A separate fix
task is suggested; whether it becomes a register item is the Product Owner's designation.

**Anti-duplication method.**
- For MATCH-02 and MATCH-03, six independent read-only verifiers worked over the tree at `30dff6f6`:
  - two anti-duplication sweeps, one per item. They read the whole register (all 63 IDs then, every tombstone, the §7
    paragraphs, the §9 closure records), the E2E gap matrix, the P4 census, the I-07 runtime record, the S4 /
    SHARED-VIS-01 / ACE-SP-01 records and the open GitHub issues;
  - two line-by-line evidence checks;
  - an ID, severity and owner calibration;
  - a locator sweep.

  Neither obligation was carried in whole or in part. The nearest text was the ACE-SP-01 reconciliation note under
  `QAN-BL-MATCH-01` ("gain no Matching or Introduction context"), which concerns context, not the Name. I-07A had
  assigned "Safe Compatibility Conclusion generation" to I-07B (runtime `:243-245`). I-07B built only the intake and the
  filter, and no later record named an owner for a producer.
- For PRIV-04, a separate read-only verifier checked:
  - all 65 earlier IDs and every tombstone;
  - the §7 paragraphs and the §9 closure records, including the I-07 record ("Admitted: none");
  - the W3-PDG-01 closure (§7.3, §8.4, §11) and W3-MEGA-S (§18.2 item 9, §18.3);
  - migrations `0130` and `0153`, and the E2E gap matrix (E2E-D-16, E2E-D-17);
  - the S5 records' export gaps and the open GitHub issues.

  `QAN-BL-PRIV-01` … `03`, `ACCT-01`, `MATCH-01`, `PROD-05` and the `PROD-03` tombstone are each a different obligation.

**Counts, recounted mechanically from the backlog's §4 index:**

| | Before (§9, `30dff6f6`) | After GATE-03 | After GATE-19 (final) |
|---|---|---|---|
| Total | 63 | 65 | **66** |
| `DEFERRED — OWNED` / `VALIDATION — OPEN` / `OPEN — UNASSIGNED` / `CLOSED — TOMBSTONE` | 27 / 4 / 10 / 22 | 29 / 4 / 10 / 22 | **30 / 4 / 10 / 22** |
| `HIGH` / `MEDIUM` / `LOW` | 32 / 29 / 2 | 34 / 29 / 2 | **35 / 29 / 2** |
| Active (not tombstoned), as HIGH / MEDIUM / LOW | 41 (15 / 24 / 2) | 43 (17 / 24 / 2) | **44 (18 / 24 / 2)** |

### 14.5 The remaining gates: decision register

The register condenses the Product Owner's text, using the Product Owner's words where they are short. "Kind" is the
Product Owner's own label: **APPROVED** unless marked otherwise. **No gate authorizes implementation.** Each one is an
input that a future Task Contract must honour, through that task's Product Decision and Copy Gate. "Conflicts" points to
§14.7, which classifies each decision against frozen authority and current code. "Carrier" is this record's reading of
the task that would honour it, for orientation only; the task map is in §14.6. The conflict ids are defined in §14.7:
AR architecture review, CA controlled architecture amendment, CP controlled Product / copy amendment, EI existing
implementation conflict, LS later-stage obligation.

**Entry and onboarding**

| Gate | Product Owner decision (2026-10-13) | Kind | Conflicts (§14.7) | Carrier |
|---|---|---|---|---|
| GATE-13 | A manual Introductions entry inside `MY_WORLD`; no fourth top-level World area. QANDEEL may suggest Introductions conversationally after Stage 8A. A suggestion is never enrollment or consent; no repetitive or intrusive suggestions; no misleading pre-entry Activity or notification affordances | APPROVED | EI-01; CP-01; LS-07 | S6-01; S6-07; Stage 8A (suggestion) |
| GATE-14 | QANDEEL leads a progressive, step-by-step guided onboarding, not a long conventional form. Users can review, correct, return and resume later. Stage 6 uses a deterministic guided flow, and Stage 8A may add natural intelligent conversation. All fixed guided text uses simplified MSA | APPROVED | AR-07; LS-08 | S6-01; Stage 8A |
| GATE-15 | A progressive Introduction Profile with four required basics: a confirmed Introduction First Name; age, subject to eligibility rules; a broad geographic area, not a detailed address; marital status. Other personality, interest, lifestyle and relationship preferences stay progressive. The required profile and consent set must be complete before real-Matching eligibility. Nothing sensitive is inferred or silently imported | APPROVED | AR-08; LS-09 | S6-01 |
| GATE-16 | Hard dealbreakers are separate from soft preferences. An explicit, user-confirmed definition of the category of partner sought. Structured, reviewable criteria, not unverified AI inference. An incomplete required set is never matchable. Frozen PASS / FAIL / UNKNOWN semantics hold: UNKNOWN is never PASS | APPROVED | AR-09 (an open question for the Product Owner; §14.9); resolved by D1, which adds CA-09 (§14.14) | S6-01 (capture); S6-03 (evaluation) |
| GATE-17 | Distinct explicit consent steps; a user-readable confirmation before final enrollment; the approved consent wording and its version evidence preserved. Fixed Arabic follows the simplified-MSA rule. All new and amended wording goes through the Copy Gate | APPROVED | AR-10 | S6-01 |

**`MY_WORLD` context, consent and profile**

| Gate | Product Owner decision (2026-10-13) | Kind | Conflicts (§14.7) | Carrier |
|---|---|---|---|---|
| GATE-10 | The existing Matching Context Grant stays independently required for context-based eligibility, as in the frozen runtime. Profile preparation grants no context access | APPROVED | none | S6-01 |
| GATE-11 | QANDEEL may suggest existing `MY_WORLD` facts for onboarding, but **only** after a separately defined, explicit, revocable permission for that purpose. No automatic Memory read or copying. Candidate facts are shown one by one for confirmation or correction, and rejection means ordinary manual onboarding. The permission is separate from evaluation and disclosure permission, and the Matching Context Grant is never used for this. **No implementation until the controlled architecture amendment is approved** | **APPROVED PRODUCT INTENT, CONTROLLED ARCHITECTURE REQUIRED** | CA-05; LS-06 | the controlled amendment first (owner not named); S6-01 is explicit-input until it is approved |
| GATE-12 | The confirmed Introduction First Name is a distinct source from the account Name. No automatic resolution from `users.name`. Owner-only read-back and correction. The source is confirmed before the first-name seam is wired | APPROVED | AR-06 | S6-01 (store, read-back); S6-03 (seam); S6-02 (the name source of the fence) |
| GATE-06 | Separate scopes for first setup, profile and requirement correction, resume, and permission reconfirmation. A profile-version change never silently keeps an ineffective or obsolete disclosure permission | APPROVED | AR-03; CA-03 (conditional) | S6-01 |
| GATE-18 | No required photos during onboarding. Post-Match photos only when an authorized secure media path exists. The frozen three-stage progressive blur and disclosure order are kept. No premature image provider or media implementation | APPROVED | AR-11 | S6-06 |
| GATE-19 | Matching and Introduction data are addressed in the governed personal export scope without exposing the other participant's private data or confidential reasoning. An owned obligation is created after anti-duplication | APPROVED | AR-12 | `QAN-BL-PRIV-04` → S6-07 (§14.4) |

**Security and database boundaries**

| Gate | Product Owner decision (2026-10-13) | Kind | Conflicts (§14.7) | Carrier |
|---|---|---|---|---|
| GATE-04 | Closed-by-default in-database gating with properly authorized wrappers is the preferred **research direction**, and **not** authorization to bypass SEC-MATCH-00. O-B must first resolve the conflict between server-canonical authorization and the ban on client-executable wrappers. **If that cannot be resolved safely, the six operations stay closed.** No unrestricted service-role path and no manufactured consent | **APPROVED DIRECTION, NOT AN IMPLEMENTATION MECHANISM** | CA-01; AR-01; LS-02 | S6-01 (owner of `QAN-BL-MATCH-01`) |
| GATE-05 | No real enrollment before the account-deletion footprint problem is resolved. "Truly enrolled" means a completed explicit authorization act. Cancellable pre-enrollment preparation without a permanent footprint, where the architecture permits. Enrollment is refused during a scheduled deletion. An explicitly owned narrow deletion correction is commissioned if justified. Full Matching / Introduction deletion integrity remains a launch prerequisite | APPROVED | CA-02; AR-02; LS-03 | S6-01; `QAN-BL-ACCT-01` (unassigned) |
| GATE-07 | Bounded stale-state handling, preferably R-1 if verified. Safe retry and committed-result replay; no duplicate consent or operation. The frozen six-command bodies are kept unless a separately approved amendment is needed | APPROVED | AR-04; LS-04 | S6-01 and every later wrapper |
| GATE-08 | Resume requires fresh validation of state, profile, requirements and permissions before the user is matchable again. The frozen resume-contract tension is resolved through architecture review | APPROVED | AR-05; CA-04 (conditional) | S6-01 |
| GATE-09 | Separate Matching launch scopes, closed by default, operator-controlled and auditable. No live users or real proposals in Stage 6. Production gate opening stays with Stage 9. No unnecessary cohort or rollout runtime at this stage | APPROVED | LS-05 | S6-01 (gate); Stage 9 (opening) |
| GATE-20 | A dedicated Introduction-phase isolation fence before any accessible Mutual Match birth. It protects account names; member and material views; conversation and Model Router input; Activity and notifications; Shared semantic readers; Direct Entry; and closed-history and former-own-material access. The interim fails closed. **No birth path is reachable before the unilateral END capability is securely available** | APPROVED | EI-02; AR-13; CA-06 (conditional) | S6-02 (`QAN-BL-MATCH-02`) |
| GATE-21 | Stage 6 builds closed integration boundaries; Stage 9 owns launch clearance and activation | APPROVED | LS-10 | S6-04 … S6-06; Stage 9 |
| GATE-26 | A deterministic Arabic / English privacy and contact-information refusal floor, covering text and numeric representations, exists before any pre-Match disclosure path can operate. Model-based checks may be added later, never as the only protection | APPROVED | AR-15; LS-13 | S6-03, or the first task that opens a disclosure path |

**Proposal intelligence and policy**

| Gate | Product Owner decision (2026-10-13) | Kind | Conflicts (§14.7) | Carrier |
|---|---|---|---|---|
| GATE-22 | A refusing, provider-neutral Safe Compatibility Conclusion port until Stage 8A supplies a properly evaluated real producer. No fake AI recommendation and no unauthorized combination of two humans' private contexts | APPROVED | LS-11 | S6-03 (port); Stage 8A (`QAN-BL-MATCH-03`) |
| GATE-23 | The initial pre-Match proposal shows only approved neutral QANDEEL copy, with no names, detailed traits, individual agreement reasons or private evidence. The conflict with frozen proposal-view assumptions is documented and resolved by a controlled amendment **before implementation** | **APPROVED PRODUCT DIRECTION** | CA-07; CP-02 | a controlled amendment before S6-03 / S6-04 |
| GATE-24a | No Introduction Profile field is disclosed before the Mutual Match in the initial direction. Existing permission authority stays safe and inactive wherever it cannot yet be reconciled | APPROVED | CA-08 | S6-01 (whether to build field approval); S6-03 (policy) |
| GATE-24 | The pre-Match disclosure allowlist starts empty. Any widening needs an exact field catalogue, reviewed permission and a controlled change | APPROVED | none | S6-03 |
| GATE-25 | Research and validate these starting limits: about five proposals a week; at most two pending; expiry after 72 hours; no automatic re-proposal of the same person after a rejection or an ended Introduction. The final configuration is validated against frozen contracts, privacy rules and the journey before activation. **Do not treat these values as already present in the database** | **APPROVED AS INITIAL POLICY PROPOSAL** | AR-14; LS-12 | S6-03; Stage 9 (activation) |

**Proposal, Introduction and lifecycle experience**

| Gate | Product Owner decision (2026-10-13) | Kind | Conflicts (§14.7) | Carrier |
|---|---|---|---|---|
| GATE-27 | A person's own private incoming proposals, never a browsable candidate feed. Privacy-limited notifications. Direct Entry to the right Introductions destination. No repeated nagging. No disclosure that another person was considered before the authorized step | APPROVED | AR-16 | S6-04; S6-07 |
| GATE-28 | Fixed Arabic copy in universally understood simplified MSA; gender-considerate wording; dynamic conversation adapts to the user's dialect; new copy through the Copy Gate. Any collision with frozen G2 / G2.3 text needs an explicit controlled amendment | APPROVED | CP-03 (§14.8) | the S6 Copy Gates (S6-01, S6-04, S6-05, S6-07) |
| GATE-29 | A Mutual Match creates an `INTRODUCTION` phase of an existing `SHARED_WORLD`, not a new World type. It belongs to the Shared World area while presenting an explicitly distinct private Introduction experience. It reuses QANDEEL's visual language without leaking `MY_WORLD` analysis or private compatibility evidence. The final visual design is reviewed and approved separately before implementation. If the Living Analysis stack is used, the dependencies on scale and on Issue #322 physical-device proof are recorded, and existing release evidence is not claimed for Introduction behaviour | APPROVED | AR-17 | S6-05 (over S6-02) |
| GATE-30 | An initial approved neutral welcome. No private compatibility-reason disclosure and no unauthorized Handoff consumption. More intelligent facilitation waits for Stage 8A. ACE-SP-01 is kept, or amended through controlled change where necessary | APPROVED | LS-14 | S6-05; Stage 8A |
| GATE-31 | Introductions notifications default to privacy-limited L0. No unauthorized names or content on the Lock Screen. Per-World mute controls. Separate lifecycle and message categories are reviewed against the existing Activity law | APPROVED | EI-03; AR-18 | S6-05; S6-07 |
| GATE-32 | A clear progressive disclosure panel. Each person controls, previews and explicitly confirms what they release. Disclosure is non-reciprocal, and neither participant is pressured into equal disclosure | APPROVED | none | S6-06 |
| GATE-33 | QANDEEL may propose SUCCESS when appropriately capable; both humans must explicitly approve. No automatic conversion and no unilateral promotion to `STANDARD` | APPROVED | LS-15 | S6-06 (approval path closed); Stage 8A (proposer) |
| GATE-34 | Either human may end an Introduction unilaterally, without waiting for the other. Appropriate closed history, personal deletion rights and privacy are kept. Resuming Matching requires explicit user action and valid revalidation | APPROVED | EI-04; AR-19 | S6-02 (END); S6-05 (closed view); S6-06 (reactivation) |
| GATE-35 | Introduction material is excluded from user-facing Replay until Stage 7 defines and approves its privacy and presentation contract. Standard Shared Replay is never silently reused | APPROVED | AR-20; LS-16 | S6-02 (fence); Stage 7 |
| GATE-39 | Users can inspect their own participation state, including pauses caused by active or concluded Introductions, without exposing unrelated private state to the other participant | APPROVED | none | S6-01 (read surface); S6-05 / S6-06 |

**Stage 9 launch and economy**

| Gate | Product Owner decision (2026-10-13) | Kind | Conflicts (§14.7) | Carrier |
|---|---|---|---|---|
| GATE-36 | Before real Matching launch: a reviewed policy for blocking, reporting, harassment and safety, plus the relevant privacy and content classification. No hidden policy default; Stage 6 authorizes no launch | APPROVED | LS-17 | Stage 9 (I-09 / CW2-08) |
| GATE-37 | No paid Introductions entitlement is selected or enforced in Stage 6. A neutral, fail-closed entitlement boundary is kept. Final free-versus-paid Product and economic decisions belong to Stage 9 | APPROVED | LS-18 | S6-04 … S6-06 (neutral boundary); Stage 9 |

GATE-01 … GATE-03 are in §14.2 … §14.4, and GATE-38 is §9.

### 14.6 Approved Stage 6 task map (planning direction, subject to final Task Contracts)

The Product Owner kept the seven-task structure as the approved planning direction. The names are the Product Owner's.
The scope sketches of §8.2 remain WP0 proposals until each task's own contract fixes its scope.

| Task | Product Owner's name | Register items it owns today | Main approved decisions it consumes |
|---|---|---|---|
| `S6-01` | Intelligent Matching Onboarding | `QAN-BL-MATCH-01` | GATE-04 … GATE-10, GATE-11 (only after its amendment), GATE-12 … GATE-17, GATE-24a, GATE-28, GATE-39; the language rule (§14.1) |
| `S6-02` | Introduction-Phase Privacy Isolation & Safe END Boundary | `QAN-BL-MATCH-02` | GATE-20, GATE-12 (name source), GATE-34 (END), GATE-35 (Replay fence) |
| `S6-03` | Matching Proposal Pipeline & Intelligence Prerequisites | none | GATE-12 (seam), GATE-16 (evaluation), GATE-22, GATE-23 (its amendment first), GATE-24, GATE-24a, GATE-25, GATE-26 |
| `S6-04` | Private Proposal Review and Decisions | none | GATE-21, GATE-23, GATE-27, GATE-28, GATE-37 |
| `S6-05` | Mutual Match & Introduction World | none | GATE-21, GATE-28, GATE-29, GATE-30, GATE-31, GATE-34, GATE-37, GATE-39 |
| `S6-06` | Progressive Disclosure, SUCCESS and Reactivation | none | GATE-18 (post-Match images), GATE-21, GATE-32, GATE-33, GATE-34 (reactivation), GATE-37, GATE-39 |
| `S6-07` | Activity, Direct Entry and Final Integration | `QAN-BL-PRIV-04` | GATE-13 (pre-entry truth), GATE-19, GATE-27, GATE-28, GATE-31 |

The "decisions it consumes" column is this record's reading for orientation, not an assignment.

The Product Owner's package states that every task must undergo:
1. Research.
2. Repository truth.
3. Anti-duplication.
4. The Product Decision and Copy Gate, where required.
5. A Product Owner-approved Task Contract.
6. Proportional validation.
7. Independent review.
8. The Product Owner's explicit merge approval.

The package also states: "Avoid XL monolithic implementations. Split a task into focused, ordered work packages when
justified, without duplicating frozen I-07 work or changing the approved stage count silently." This record reads the
"stage count" as the seven-task count.

**The proposed order of §8.3 still applies as a proposal.** Two of the Product Owner's decisions now make parts of it
binding:
- GATE-20: the isolation fence comes before any accessible Mutual Match birth, and no birth path is reachable before the
  unilateral END capability is securely available.
- GATE-01 / GATE-02: the historical S6-01 references and the Return Gate are reconciled before S6-01's contract and
  start.

### 14.7 Conflict register: decisions against frozen authority and current code

A read-only reviewer classified every gate decision against frozen authority and the code on `main` (`13514200`). Its
81 rows, one or more per gate, fall into these classes:

| Class | Meaning | Rows |
|---|---|---:|
| NO CONFLICT | the decision fits frozen authority as written | 28 |
| ARCHITECTURE REVIEW (AR) | no frozen text is broken, but the design needs a reviewed decision before code | 20 |
| CONTROLLED ARCHITECTURE AMENDMENT (CA) | frozen architecture, a migration body or a verifier pin must change through a controlled amendment before code (three only if a particular design is chosen) | 8 |
| CONTROLLED PRODUCT / COPY AMENDMENT (CP) | frozen Product or copy text must change through a controlled amendment | 3 |
| EXISTING IMPLEMENTATION CONFLICT (EI) | code on `main` already contradicts the decision (live or latent) | 4 |
| LATER-STAGE OBLIGATION (LS) | the decision binds a later stage that already owns the work | 18 |

These ids are this record's own; IP-IMP-01's Copy Addendum decisions "CA-1" / "CA-2" are unrelated. Every CA, CP
and EI citation below was re-read against the tree. **No amendment is made or authorized here.** Each one
needs its own controlled change, approved by the Product Owner and Architecture, before any implementation it touches.

**Controlled architecture amendments**

| ID | Gate | Frozen authority in the way | What the amendment must settle | Before |
|---|---|---|---|---|
| CA-01 | GATE-04 | `QAN-BL-MATCH-01`'s required property forbids regaining `EXECUTE` on the six "through … a client-executable wrapper". `database/verify-migration-0149.mjs` NO_BACKDOOR and probe f3 (`:455`) refuse exactly an `authenticated` SECURITY DEFINER wrapper over a suspended command. The SEC-MATCH-00 static contract says a Stage 6 path "must amend this contract" | A ruling that a closed-by-default in-database gate plus wrappers is the permitted "server-canonical launch path". Then: amending the MATCH-01 property text, verify-0149 NO_BACKDOOR / f3, the SEC-MATCH-00 contract and the verify-0150 lists, plus an I-07 record amendment. The `0108` / `0109` bytes stay pinned. **If it cannot be resolved safely, the six stay closed** (GATE-04) | any S6-01 server work |
| CA-02 | GATE-05 | `0108:661` (UPDATE and DELETE refused for every role); `0130:46-47` (erasure touches no Matching row); verify-0149 DELETION_BASELINE_UNCHANGED | A narrow deletion correction contradicts all three, so it needs a controlled amendment and an explicitly named owner. `QAN-BL-ACCT-01` is `OPEN — UNASSIGNED` | a commissioned deletion correction |
| CA-03 | GATE-06 | `0109` bodies (BODIES_UNCHANGED; the `0109` hash pin) | *Conditional:* only if correction / authority coherence is enforced inside the frozen bodies. A wrapper design avoids it (AR-03) | S6-01, if that design is chosen |
| CA-04 | GATE-08 | `0109:42-44`: no command reads profile, requirements, grant or authority to decide participation | *Conditional:* only if the resume act itself is refused on that state. Gating matchability instead avoids it (AR-05) | S6-01, if that design is chosen |
| CA-05 | GATE-11 | CW2-06 §7 (`:128-135`): the Matching Context Grant's fixed purpose. `0108:66-74`: semantics fixed by table identity, with no column that could widen | A new consent family for onboarding assistance, by controlled CW2-06 / I-07A amendment. Confirmed values then enter as explicit Matching answers or profile evidence, which is already permitted. "Self-authored `MY_WORLD`" stays `QAN-BL-CW-02`'s definition | any onboarding assistance (GATE-11 already bars it until then) |
| CA-06 | GATE-20 | ACE-SP-01 (`:89-90`): Introduction-phase Worlds "use the same Shared reply path and gain no Matching or Introduction context" | *Conditional:* only if the fail-closed interim makes the Shared reply path behave differently in an Introduction-phase World. Swapping only the speaker label (the Introduction First Name for the account Name) does not need it | S6-02, if that design is chosen |
| CA-07 | GATE-23 | CW2-06 §20 (`:331-335`: the first recipient receives a first name, bounded approved information and a conclusion) and §23. The recipient view binds both (`0110:845-846`, `0112:945-946`) and cannot be materialized without a resolved first name and a permitted conclusion (`0120:462-479`) | A controlled CW2-06 §20 / §23 and I-07B amendment that changes what a recipient view must bind, consistent with neutral-copy-only proposals. If a conclusion is no longer needed, `QAN-BL-MATCH-03` is narrowed or re-owned | S6-03 and S6-04 |
| CA-08 | GATE-24a | CW2-06 §11 (`:185-189`) and F11 (`:856`): the Pre-Match Disclosure Authority is required to surface a candidate. `0109:768-771` refuses an empty approved-field set. Matchable needs an `ACTIVE` authority (`0111:263-264`) | With no field disclosable, the frozen rules leave two bad outcomes. Either nobody can ever be matchable, or users must approve a field that will never be shown, which is misleading consent. An amendment makes the authority optional or zero-field while the allowlist is empty, or decouples matchability from it. Until then, building it would mean approving a field that is never shown; whether S6-01 builds it is for its Task Contract (GATE-24a) | S6-01's field-approval scope |

*(Final decision addendum, 2026-10-13: CA-09, for GATE-16 as resolved by D1, is recorded in §14.14. The class counts
above are as first classified.)*

**Controlled Product / copy amendments**

| ID | Gate | Frozen text | What the amendment must settle |
|---|---|---|---|
| CP-01 | GATE-13 | P3 §3 (`:115-116`) freezes five Activity filters, Introductions included, with no entry condition | Hiding the Introductions filter before legitimate entry needs a P3 amendment, or a recorded Product Owner reading that P3 §12.2's entry condition (`:441`) extends to the filter. The Android channel is not frozen (P3 `:604`), so it needs only the implementation change |
| CP-02 | GATE-23 | CW2-00 (`:176`, `:182`) and P1 §4 (`:131-135`) frame the Introduction First Name and a safe compatibility explanation as pre-Match proposal content | A dated precedence note in CA-07's controlled change: the ceiling is not breached, the field is still needed after the Match (CW2-06 §41 `:636`; P1 `:522`), but P1's "This field supplies CW2-06 §12's "first name" disclosure" (`:135`) would become inoperative once that controlled change is approved |
| CP-03 | GATE-28 and the language rule | G2.3 §1-§2 (`:20`, `:31`, `:39-41`): Egyptian Matching copy, masculine-singular at `:20` and `:41`, and "No gender-neutral rewrite is authorized by G2.3" | A controlled G2.3 Copy Amendment, together with the language-authority amendments of §14.8. The three replacement drafts are units M-01 … M-03 of the copy census |

**Existing implementation conflicts** (code on `main`; none is changed here)

| ID | Gate | Code | Status | Carrier |
|---|---|---|---|---|
| EI-01 | GATE-13 | An always-drawn, always-empty «التعارف» Activity filter (`apps/mobile/src/activity/ActivitySurface.tsx:162`, pinned by `surfaces.test.tsx:118`). An Android `category-introductions` channel registered unconditionally at push start (`apps/mobile/src/push/push-controller.ts:153`, pinned by `push.test.ts:165`). The server already silences the items (`activity-decision.ts:22-23`) | **live**: pre-entry affordances that GATE-13 rules out | S6-01 (entry truth); S6-07 (Activity / push) |
| EI-02 | GATE-20 | The phase-blind Stage 4 reads and the Shared reply prompt (`0138:623-625`, `0139:139`, `shared-conversation-model-input.ts:46`; also `0141:71-73`, `0148:255-256`) | latent: no birth path exists | S6-02 (`QAN-BL-MATCH-02`) |
| EI-03 | GATE-31 | The Shared Activity derivation and the per-World alerts list are phase-blind (`0141:71-73`, `:188`). An Introduction-phase message would become ordinary `SHARED` Activity, at the L2 default | latent | S6-02 (fence); S6-07 |
| EI-04 | GATE-34 | Every closed-World reader and the former-own-material read are `STANDARD`-only (`0140:507`, `:527`, `:554`, `:597`). An ended Introduction would vanish, and its owners could not find their own words to delete them | latent | S6-05 (closed view); S6-02 (END) |

**Architecture review items** (a reviewed design decision before code; no frozen text broken)

| ID | Gate | What needs review |
|---|---|---|
| AR-01 | GATE-04 | Consent stays the human's own act: the byte-identical six run under the caller's `auth.uid()`, `service_role` is revoked by name, and the gate is operator-only with absent meaning DENY (the `0138:28-34` precedent) |
| AR-02 | GATE-05 | Every committed call of the six leaves a permanent `RESTRICT` footprint, so cancellable preparation must be client-held or a separate deletable store. Refusal during a scheduled deletion needs a reviewed read of `account_deletions` (`0130:108`) |
| AR-03 | GATE-06 | Separate scopes in wrappers, keyed on the expected predecessor. Correction must be coupled to an explicit re-approval or revocation in the same act, because `0109` keeps an `ACTIVE` authority on the old version |
| AR-04 | GATE-07 | R-1 absorbs `40001` / `PT409` in the wrapper (the verify-0150 ABSORBED list). Still needed: a deliberate verifier edit, the replay answer after a scope closes, and proof of no duplicate consent row |
| AR-05 | GATE-08 | The least-amending resume is a wrapper that binds the gate snapshot and adds a version-coherence check before the user counts as matchable (`0109:358-360`; the `0117:440-446` precedent) |
| AR-06 | GATE-12 | The first-name store: a reserved profile key (each correction re-binds the authority) or a dedicated store (a new footprint under GATE-05). Owner read-back is a new no-oracle boundary. Seam wiring re-anchors the verify-0111 A03 pins |
| AR-07 | GATE-14 | "Return and resume later" needs a non-footprint draft (GATE-05), and "review and correct" needs read-back (GATE-12). The flow never passes through the Personal Memory write |
| AR-08 | GATE-15 | The geographic key must avoid the `0108:421-424` key-ban tokens (`geo`, `address`, `street`, `gps`). Progressive steps belong in a pre-enrollment draft. "Four required categories" is enforced by a reviewed wrapper or catalogue. Age is self-declared only |
| AR-09 | GATE-16 | A user-confirmed "category of partner sought" can only PASS against a matching self-declared fact about the candidate. If the category is the counterpart's sex (no gender concept exists, §10 GATE-16), none of GATE-15's four required categories can match it, so every candidate would evaluate UNKNOWN (§14.9). The evaluator over the catalogue is S6-03 work. *Answered by D1 (§14.14): the category is the counterpart's sex; CA-09* |
| AR-10 | GATE-17 | Consent-wording version evidence has no column (`0108:202-210`, `:329-335`; the grant's fixed semantics, `:73-74`). It needs an additive relation, itself a footprint under GATE-05 and the verify-0149 naming regex |
| AR-11 | GATE-18 | `0115:62-64`: the two image stages are independent versions, so the frozen order is enforced in the S6-06 wrapper. No media boundary exists |
| AR-12 | GATE-19 | Several Matching rows bind two humans (`0110:213-979`), and Matching operational state is private (CW2-06 `:608-624`), so the export content rule, including what counts as confidential reasoning, needs review. That is `QAN-BL-PRIV-04` |
| AR-13 | GATE-20 | The fence forward-redefines S4 / SHARED-VIS-01 functions (the `0118` precedent), with `STANDARD` behaviour byte-identical. The END core is executable by no role, so S6-02 needs a wrapper and route that is never launch- or seam-gated (`0116:1380-1381`, `:1910-1912`). WP0 proposes (§8.1) that no Match wrapper merges before END and the fence |
| AR-14 | GATE-25 | No cooldown policy kind exists (`0110:258-260`), and the pair index allows a fresh proposal after any terminal state (`0110:697-702`). The no-re-proposal rule must live in a reviewed new layer, or come by controlled amendment |
| AR-15 | GATE-26 | An add-only floor extension is anticipated (`0111:95-99`). But the `0110` CHECKs inline English-only regexes, so an extended classifier must stay in agreement with them (`0111:88-93`). Disclosed field values get only contact and provenance checks, and Arabic words and Arabic-Indic digits are uncovered |
| AR-16 | GATE-27 | A person's own pending list needs a new owner-only, non-enumerating read. The Direct Entry and listing placement must be reconciled with G2's process, which begins with Analysis attention (`:146`). The A3-01 destinations pin is re-anchored deliberately |
| AR-17 | GATE-29 | The Living Analysis stack refuses semantic work outside `ACTIVE` / `STANDARD` (`0148:310`). If used, `QAN-BL-LAUNCH-04` and `QAN-BL-VIS-01` bear without existing release evidence |
| AR-18 | GATE-31 | Per-World mutes accept only `SHARED_WORLD` contexts (`0136:473-474`), and the silence decision ignores mutes for `INTRODUCTIONS` (`activity-decision.ts:54-56`) |
| AR-19 | GATE-34 | The frozen reactivation (`0117:441-443`) does not re-check the Disclosure Authority or version coherence. The gap is liveness, not leakage, because matchability still requires the authority |
| AR-20 | GATE-35 | CW2-05 (`:336`) is permissive under "Product / runtime rules", so a Product exclusion needs no amendment. The Replay draft path already authorizes Introduction-phase material through the `0119` resolver (unreachable today), so S6-02 decides whether to fence it |

**Later-stage obligations** (the decision binds a stage that already owns the work)

| ID | Gate | Bound stage and why |
|---|---|---|
| LS-01 | GATE-02 | Real proposal delivery and decisions need the CW2-08 seam (`0111:309-313`, Stage 9) and a producer (`QAN-BL-MATCH-03`, Stage 8A) |
| LS-02 | GATE-04 | Any wrapper migration deploys only after `0149` / `0150`; the hosted PostgREST line is verified; production opening is a Stage 9 operator act (`QAN-BL-PROD-06`) |
| LS-03 | GATE-05 | Full Matching / Introduction deletion integrity is a launch gate (W3-PDG-01 `:279-280`; `QAN-BL-ACCT-01`) |
| LS-04 | GATE-07 | Never through a hosted PostgREST that re-runs `40001` (runtime `:1445-1447`; `QAN-BL-PROD-06`) |
| LS-05 | GATE-09 | Opening any Matching scope, cohort or rollout is a Stage 9 operator act (`0138:31-34`) |
| LS-06 | GATE-11 | Producing candidate facts from Memory is a Stage 8A capability under QIR-001 rule 7 (`integrated-intelligence-runtime-contract-v1.md:316-318`); the source definition is `QAN-BL-CW-02` |
| LS-07 | GATE-13 | A conversational suggestion needs Stage 8A intent detection and the Proactive Gate (`QAN-BL-NOTIF-02`), under the no-nagging law (CW2-06 `:92`) |
| LS-08 | GATE-14 | Natural onboarding conversation needs the production provider (Stage 8A) |
| LS-09 | GATE-15 | Age eligibility rules belong to the CW2-08 legal and safety policy (Stage 9). Until then the snapshot treats them as unconfigured and fails closed |
| LS-10 | GATE-21 | Replacing the four `NOT_EVALUATED` seams, the block policy, entitlement and gate opening stay with Stage 9 (`0111:312-313`) |
| LS-11 | GATE-22 | The production producer, its cost attribution and evaluation (`QAN-BL-MATCH-03`, Stage 8A) |
| LS-12 | GATE-25 | Validating and activating policy rows happens at launch clearance (CW2-08 `:566-579`: "No permissive guess") |
| LS-13 | GATE-26 | Model-assisted checks are additive and later (`0111:97-99`; Stage 8A / Stage 9) |
| LS-14 | GATE-30 | Active ice-breaking (CW2-00 `:188`; CW2-03 `:766-774`) binds Stage 8A, together with a controlled ACE-SP-01 amendment |
| LS-15 | GATE-33 | SUCCESS starts from a QANDEEL suggestion (CW2-00 `:192`), so it stays dormant until a Stage 8A proposer exists; S6-06 builds the approval path closed |
| LS-16 | GATE-35 | The Introduction Replay contract is Stage 7's (`activity.service.ts:194-195`); `QAN-BL-NAV-02` bears only if it is allowed |
| LS-17 | GATE-36 | `INTRODUCTION_BLOCK_POLICY`, the PAIR_INELIGIBLE check and the CW2-08A classification are real-launch prerequisites (CW2-08 `:195-201`) |
| LS-18 | GATE-37 | Pricing is deferred (CW2-06 `:905`); the final decision and enforcement are Stage 9's |

### 14.8 The fixed Arabic copy census (summary)

The language rule of §14.1 asks for every conflict to be identified, with the original and a recommended replacement.
The full census is a separate document:
[`QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md`](QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md).
Its status is **PROPOSED: not approved, nothing implemented**. Every original keeps its approval as history, and no
string in code, tests, frozen records or proofs is changed.

**Method.** Seven read-only reviewers covered the tree at `30dff6f6` (code = `main` `13514200`):
- every fixed Arabic string in `apps/mobile/src` and `apps/api/src`, by domain;
- the design and canonical copy authorities: G2 / G2.3 / G3, VI-01, I-08A4, I-08N-01, P3 / P4, W1B-01 and the e2e Copy
  Gate records.

They reviewed 925 strings: 776 conform, 147 rows conflict, and 2 are historical. Input recognisers, tests, fixtures,
evaluation suites, model prompts, generated output, comments and English were out of scope. After strings that appear
in several places were merged, the 147 rows are **109 amendment units**. Every quoted original was checked verbatim
against its file, and an independent Arabic-quality review corrected 16 proposals before publication. No Arabic copy was found in migrations, and the remaining Arabic-bearing source files hold only
comments or proof generators.

| Result | Units |
|---|---:|
| Approved or frozen copy in force: **controlled Copy Amendment required** | 87 |
| Prewritten safety replies in force **with no recorded copy approval**: Egyptian, four of them also masculine; PO copy approval and safety review required | 6 |
| Not yet approved copy (OPEN proof lines, fixtures, Product Vision examples, provisional voice strings): **authored in MSA at the owning Copy Gate**, with no amendment | 16 |
| **Total** | **109** |

By kind: 34 dialect, 57 gender and 18 both. Nine of the gender units are third-person agreement with a named person,
for example «{0} يقترح» where `{0}` may be a woman. Matching and Introductions account for 16 units: the three frozen
G2.3 paragraphs (CP-03) and thirteen not-yet-approved lines. The rest are QANDEEL-wide:
- the first-use and opener messages;
- memory control;
- push education;
- account and sign-in;
- Shared and Public World;
- interaction preferences;
- personal chrome;
- one name row;
- the deterministic safety replies;
- Activity settings;
- the provisional voice and call strings.

**The language authorities themselves.** The census identifies conflicts in the documents that set the language:
- VI-01's T2 tier, which makes QANDEEL's voice restrained Egyptian for every conversational turn, scripted or generated;
- VI-01's T3b analysis-prose tier;
- VI-01 §3.2, where "neutral" is "not MSA-by-default" and the flavour gate is only a review preference;
- G2.3's "No gender-neutral rewrite is authorized";
- the G1.1 / P4-C4 `opener` row and the P4-C3 check that freezes its colloquial spelling;
- W1B-01 §3.1–§3.2 and its "needs no amendment" finding for the opener;
- A3-02 §24a;
- W3-MEGA-M §6, whose Egyptian conversational register covers all memory-control replies;
- MEM-AR-01 L-10 / L-11;
- the E1R register table.

It recommends one controlled VI-01 amendment. That amendment splits generated turns, which adapt under rule A, from
scripted turns, which are simplified MSA. It is consistent with what already matches the rule: VI-01's T1 / T3a / T4
"neutral contemporary Arabic" and its §3.6 gender policy, I-08A4 §11's chrome register, I-08N-01 D18A ("no hard-coded
Egyptian") and IP-IMP-01's dialect preference.

**Open question for the Product Owner.** Rule A does not say which dialect a generated reply uses when the user has
stated no preference. I-08A4 §11 (`:337`) allows an Egyptian-compatible default, and I-08N-01 (`:651`) points to a
neutral fallback.

**Observations outside the language rule** (reported, not acted on):
- the Shared removal explanation template uses `{0}` twice, but `fill()` replaces only the first, so the second renders
  literally today (`apps/mobile/src/shared-world/copy.ts:147-149`; `lifecycle-copy.ts:153`; the test builds its
  expectation with the same `fill()`);
- the memory subject recogniser knows only colloquial answers (`memory-control.interpreter.ts:329-331`), and a regex
  derives one memory heading from its Egyptian wording (`memory-control.copy.ts:88`). Any amendment there changes code
  with the copy;
- the Matching Product Definition's example proposal names reason categories, which G2 §D forbids before the
  Introduction. That is a content conflict, not a language one.

### 14.9 Unresolved implementation blockers

Nothing below is resolved by this update. The list is ordered by what each item blocks. "Needs" names the decision or
controlled change, not an implementation.

| # | Blocker | Blocks | Needs |
|---|---|---|---|
| 1 | The historical S6-01 lifecycle references are not reconciled: Roadmap §6.3 "Paused" against "Not started"; the S6-01 brief, Reality Check and D1–D6 cited by CI-01 C0 (`docs/e2e/QANDEEL_CI_01_C0_DECISION_REPORT_v1.md:323`) are not in the repository; "resume" (which fires `QAN-BL-MATCH-01`'s reopen) or a fresh start | S6-01's Task Contract | reconciliation on evidence (GATE-01) |
| 2 | The historical Return Gate is not reconciled | S6-01's start | reconciliation (GATE-02) |
| 3 | The O-B wrapper shape is forbidden by `QAN-BL-MATCH-01`'s property, verify-0149 NO_BACKDOOR / f3 and the SEC-MATCH-00 contract | any S6-01 server path | CA-01, or the six stay closed (GATE-04) |
| 4 | Real enrollment would leave a deletion-blocking footprint; `QAN-BL-ACCT-01` is unassigned | real enrollment (GATE-05); launch | a pre-enrollment design that leaves no footprint (AR-02). The Product Owner is asked whether a narrow correction is justified (§14.4) and who owns it; if so, CA-02. *D3 approves the direction (`ACCT-DEL-01`, provisional); item 21, §14.14* |
| 5 | An inactive Pre-Match Disclosure Authority makes nobody matchable, and a non-empty approved set would be misleading consent | S6-01's field-approval scope; any matchability | CA-08 (GATE-24a) |
| 6 | If GATE-16's "category of partner sought" is a dimension that none of GATE-15's four required categories records (for example the counterpart's sex: no gender concept exists, §10 GATE-16), no candidate fact can satisfy it, and every candidate would evaluate UNKNOWN | real Matching | an open question for the Product Owner: define the category and the structured, user-declared fact about the candidate that it is checked against (AR-09). *Resolved by D1; replaced by item 20, §14.14* |
| 7 | Onboarding assistance needs a new consent family, and nobody owns that amendment | any use of `MY_WORLD` facts in onboarding | CA-05 with a named owner (GATE-11); S6-01 stays explicit-input meanwhile |
| 8 | Pre-entry Introductions affordances exist on `main` (the filter chip and the Android channel), and P3 freezes the five filters | S6-01 entry truth | EI-01 fix inside an S6 task; CP-01 |
| 9 | Consent-version evidence and the first-name store have no home, and both are footprints | S6-01 consent and profile scope | AR-10, AR-06 (GATE-17, GATE-12) |
| 10 | Proposal views must bind a first name and a conclusion, against GATE-23 | S6-03; S6-04 | CA-07 and CP-02 |
| 11 | No cooldown policy kind exists, and the GATE-25 values are proposals that are not in the database | S6-03 policy | AR-14; validation before activation |
| 12 | The deterministic floor is English-only and does not cover Arabic words or Arabic-Indic digits | any pre-Match disclosure path | the GATE-26 floor (AR-15) |
| 13 | No conclusion producer exists | any real proposal | `QAN-BL-MATCH-03` (Stage 8A); the refusing port meanwhile (GATE-22) |
| 14 | Phase-blind Shared reads would expose account Names; no END wrapper exists | any birth path | the S6-02 fence and END (`QAN-BL-MATCH-02`; GATE-20; AR-13); END never launch-gated |
| 15 | Closed-World readers are `STANDARD`-only; reactivation skips the Disclosure Authority; Introduction mutes do not work | S6-05; S6-06 | EI-04, AR-19, AR-18 |
| 16 | 87 approved or frozen copy units, and the language authorities, conflict with the language rule. The 6 safety replies have no approval record | any Copy Gate that touches them; every S6 Copy Gate (G2.3) | Product Owner Copy Gate approvals (census); one VI-01 amendment; safety review |
| 17 | Launch: the CW2-08 seams, `INTRODUCTION_BLOCK_POLICY`, entitlement, `QAN-BL-PROD-06`, `QAN-BL-ACCT-01`, `QAN-BL-LAUNCH-04`, `QAN-BL-MATCH-03` | any real user | Stage 9 and Stage 8A (LS rows) |
| 18 | Shared, Public and Replay world-scoped export has no register owner | Export completeness for launch | a Product Owner designation (§14.4). *Designated by D5: `QAN-BL-PRIV-05`, §14.14* |
| 19 | `QAN-BL-PRIV-04`'s owner (S6-07) and `HIGH` rating are WP0's assignment under GATE-19 | S6-07's kickoff (BG-05) | the Product Owner's confirmation (§14.4). *Confirmed by D2, §14.14* |

**Sub-questions the decisions leave open.** The Product Owner decided each gate at the level of the decision text.
These questions, put under those gates in §10, are not answered by it. Each is for the owning task's Product Decision
Gate or Task Contract, unless the Product Owner decides it earlier:

| Gate | Open sub-question (§10) |
|---|---|
| GATE-09 | environments for pilots; consequential-action re-authentication |
| GATE-13 | the manual entry's placement, presentation and glyph; what "legitimately entered" means |
| GATE-14 | where activate, pause, resume and turn-off live; the "how Introductions works" explanation (E2E-I-03) |
| GATE-15 | the user-facing names ("Introduction Profile", "Introduction Phase", the activation control); the field catalogue beyond the four required categories |
| GATE-16 | who may be proposed to whom, and the category of partner sought (row 6 above). *Answered by D1, §14.14* |
| GATE-20 | which name applies to each member, including after SUCCESS |
| GATE-21 | company controls (flag, rollout, kill) and the Matching operational events |
| GATE-25 | eager sweeping; discovery fairness; the first-recipient direction |
| GATE-27 | whether a Matching moment is a Proactive candidate (`QAN-BL-NOTIF-02`) |
| GATE-29 | the Introduction World's name, while active and after END |
| GATE-31 | the producer's event set and sentences |
| GATE-33 | how a pending SUCCESS approval is shown; the server caller for prepare / commit |
| GATE-34 | the neutral END notice (carrier and copy); reactivation timing after SUCCESS |
| Language rule | which dialect a generated reply uses when the user has stated no preference (§14.8). *Answered by D4, §14.14* |

### 14.10 Corrections made by the re-verification

These correct this record's own text, which has not been merged. The original sentences stay in place. Items 1–3 are
pointed to from §2.5, item 4 from §6, and item 5 is stated in place in §12; the §2.8 item 7 citation `0111:877` (item 4)
is one branch of the filter range given here.

1. **§2.5, 0141.** The Shared Activity source derivation returns `au.name` to the API for a human message (`0141:65-79`,
   `:71`). But the producer replaces the sentence with the generic ambient line
   (`apps/api/src/shared-world/shared-activity.producer.ts:59-61`), so no recipient sees the actor's Name. "Notified as
   `SHARED` L2 Activity naming the actor" is therefore wrong as to the naming. The Activity item would still be produced,
   phase-blind, as ambient `SHARED` Activity, and its category is GATE-31's question. The `BIRTH`, `JOINED` and `LEFT`
   derivations have no Introduction-phase source:
   - BIRTH reads only direct-invitation acceptances (`0082:357`);
   - JOINED needs `STANDARD`-only governance;
   - leave refuses `INTRODUCTION` (`0083:331-333`).
2. **§2.5, 0148.** The place-sources read (`0148:570-598`, `u.name` `:590`) cannot be reached during the Introduction
   phase. Semantic passes refuse anything but `ACTIVE` / `STANDARD` (`0148:310`), and the phase only ever moves
   `INTRODUCTION` → `STANDARD` (`0116:1286`). It becomes reachable after SUCCESS, where the naming rule is open (GATE-20).
3. **§2.5, precise citations.**
   - The reachable Name paths in an Introduction-phase World are:
     - the 0138 member list (`0138:613-630`, `u.name` `:623`, gate `:625`);
     - the 0139 material list (`0139:110-149`, `author_name` `:139`, gate `:127-131`);
     - the Shared reply prompt (`shared-conversation-model-input.ts:46`, fed through
       `shared-world-conversation.service.ts:172-178`).
   - The send path runs `0139:157-207` → `0090:770-784` → `0118:113` (phase branch `0118:267-284`).
   - Further `STANDARD` filters exist that §2.5 omits:
     - the 0141 member-request branch (`:112`);
     - the former-own-material read (`0140:597`);
     - the closed read `0148:619`.
4. **§2.3 and §6, conclusion citations.**
   - The Sensitive Conclusion Filter spans `0111:810-914`, and `:877` is one branch. It is the only minter of a permitted
     conclusion (`:1246-1253`).
   - The definition of the Safe Compatibility Conclusion is CW2-06 §24, and the filter is §25. §20 only lists the
     conclusion among what a first recipient receives.
   - "QIR-001 rule 7" (§6) and "QIR rule 7" (GATE-11) refer to a ban on an extra LLM pass that interprets Personal context
     (`integrated-intelligence-runtime-contract-v1.md:316-318`). Applying it to "any evaluator over Personal context" is
     this record's reading, not the rule's text.
   - The refusing-port property is SHARED-VIS-01's alone (§6 note above).
5. **§12.** No CI runs on this PR (the correction in §12).

### 14.11 Files changed by the decision updates

| File | Change |
|---|---|
| `docs/qandeel-canonical-backlog-v1.md` | §4: three index rows after `QAN-BL-LAUNCH-04`. §5: the three items, with every §2 schema field, after `QAN-BL-LAUNCH-04` and before §6. §7: counts (66; 30 / 4 / 10 / 22; 35 / 29 / 2); a dated pointer closing the WP0 paragraph's "none is admitted here"; two new dated paragraphs (Tier 0 and the final package), each with its "Latest index" line. §9: the WP0 row gains two dated decision clauses (its earlier wording kept); the Stage 8A row gains `QAN-BL-MATCH-03`; new `S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary` and `S6-07 — Activity, Direct Entry and Final Integration` rows. |
| `QANDEEL_CURRENT_STATE.md` | §1 snapshot: a dated sentence. §3.6: a new "Fixed Arabic copy language" row (the binding decision). §4: a dated note on the Matching / Introductions row. §5: the count tables, the recount note, two "Latest update" sentences and "The 44 active items" with three rows. §7 owners: dated GATE-01 notes on the `I-08` and `I-09` / `CW2-08` rows; `QAN-BL-MATCH-03` on the Stage 8A row; new S6-02 and S6-07 rows. No lifecycle row changes, and no `Stage 6 … **ACTIVE`. |
| `QANDEEL_PROJECT_MAP.md` | §3: a "Where do I look" row for the language of fixed Arabic copy. The GOV-REC-01 checkpoint's WP0 count note (63, then 65, then 66). A dated note on the §5.1 Stage 6 row, which stays "Not started". The pinned current-task line is untouched. |
| `QANDEEL_PRODUCT_ROADMAP.md` | A new §6.7 execution note recording the decisions, the approved task map and what stays open. §6.1–§6.6 are untouched. |
| This record | The status banner (the first wording kept), the header and blockquote; dated notes in §2.3, §2.5, §3.2, §5, §6, §8.1–§8.5, §9, §10, §11, §12 and §13; this §14. |
| `docs/e2e/QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md` | New: the PROPOSED fixed Arabic copy census (§14.8). |

Unchanged:
- `QAN-BL-MATCH-01` (its row is pinned by `tests/sec-match-00-…:211`), `QAN-BL-ACCT-01`, `QAN-BL-PROD-06` and every
  other item;
- every test and CI file;
- every runtime, migration, API, screen, copy string and frozen Product or copy contract. That includes G2.3, VI-01,
  `docs/matching-introduction-runtime-v1.md` (whose stale lines §11 already lists) and the proofs.

### 14.12 Validation of the decision updates

The decision updates are documentation and governance only. Validation is therefore the governance gate, the static
contracts that read the edited documents, the forward-safety mirror, a mechanical recount, a link check and a whitespace
check. All of them ran locally on the branch (base `13514200`), on Windows with Node, on the final content of the six
changed files.

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Task-closure governance gate (AGENTS.md §10.7) | `npm run test:task-closure-governance-contract` | **PASS 24 / 24** |
| 2 | The 24 static contracts that read the edited documents (the list of §12, row 2) | `node --test <the 24 files>` | **PASS 367 / 367** |
| 3 | Forward-safety mirror | `node --test tests/forward-safety-contract.test.mjs` | **PASS 35 / 35** (357 s). An earlier run, before the review corrections, also passed 35 / 35 (456 s) |
| 4 | Mechanical recount of backlog §4 with the governance test's `INDEX_ROW` shape | a local Node script | 66 rows, no duplicate ID; 30 / 4 / 10 / 22 by status; 35 / 29 / 2 by severity; 44 active (HIGH 18 / MEDIUM 24 / LOW 2). Every index ID has a §5 item or a §6 tombstone. The §7 tables, the last "Latest index" line and the Current State §5 tables agree. The Current State active list holds the 44 index rows byte for byte, in index order. No Current State line matches `Stage 6 … **ACTIVE` |
| 5 | Relative Markdown links in the six changed files | a local Node script | 547 checked, **0 broken** |
| 6 | The copy census | a local Node script | All 147 quoted originals found verbatim in their cited files; no stray non-Arabic letters; PW-09 keeps its U+200E mark |
| 7 | Whitespace | `git diff --check` | clean |

**CI.** No CI workflow runs on this PR. Three workflows have a `pull_request` trigger (`api-ci.yml`, `mobile-ci.yml`,
`focused-database-verification.yml`), and none of their path filters matches `docs/**` or the root locator Markdown
files (§12). The local checks above are therefore the PR's only validation. Under `QAN-BL-CI-02` a local forward-safety
result is not relied on for a merge decision.

**Independent review before commit.** Five read-only reviewers re-read the change, each with one lens:
- facts and citations (about 120 citations checked): 1 MAJOR, 12 MINOR;
- governance consistency: 1 BLOCKER (this section, then still unfilled), 9 MINOR;
- fidelity to the Product Owner's text: 5 MAJOR, 16 MINOR;
- the Arabic of the copy census: 1 MAJOR, 15 MINOR proposals, and 5 wrong linguistic claims;
- scope, overreach and clarity: 1 BLOCKER (the same), 4 MAJOR, 17 MINOR.

All were applied, with these exceptions:
- the "stage count" wording is kept, because it is the Product Owner's own;
- the Current State Stage 9 owner cell and the §6 / §9 original sentences, which predate the decisions, are left as written.

The main corrections:
- `QAN-BL-PRIV-04`'s owner and severity are marked as WP0's assignment awaiting the Product Owner's confirmation;
- "every gate decided" is qualified, and the open sub-questions are listed (§14.9);
- task-scope readings are no longer presented as approved scope;
- GATE-35's exclusion is stated in the Product Owner's words;
- the language rule is recorded in full, with its precedence until the amendments are approved;
- 16 census proposals were corrected;
- `QAN-BL-PRIV-04`'s property 2 no longer withholds the reader's own decisions.

**Not run, deliberately:** database verifiers, API and mobile suites, Maestro, and any CI loop. Nothing they cover
changed.

### 14.13 What these updates did not do

- They wrote no Task Contract. In particular they did not write S6-01's, as the Product Owner directed. The task map is a
  planning direction, not a plan of record.
- They started no S6 task. Stage 6's lifecycle stays NEXT / not started in every locator.
- They changed no runtime, migration, grant, API, screen, copy string, test, CI file or frozen contract. They made and
  approved no amendment: §14.7 and the census propose and classify only.
- They did not reconcile the historical S6-01 references or the Return Gate (§14.9 items 1–2), re-anchor the
  current-task pins, or make the §11 drift notes.
- They did not merge. The Product Owner decides.

### 14.14 Final decision addendum (2026-10-13)

After §14.1–§14.13 were committed (`e9c7bb9f`), the Product Owner approved the remaining decisions and a parallel
execution strategy in a **final decision addendum**, D1–D6. It is documentation only: it authorizes no implementation,
migration, grant, API, screen, copy change, frozen-contract amendment, deployment or merge. It does not authorize S6-01
or the LANG workstream. The earlier subsections stay as written, and dated pointers in them lead here.

#### D1 — GATE-16: opposite-sex matching rule — APPROVED

This is the Product Owner's precise resolution of GATE-16. It supersedes the earlier, ambiguous phrase "category of
partner sought" (§14.5; §14.9 item 6; AR-09).
- Matching v1 proposes opposite-sex male / female pairs only. A man may be matched with a woman only, and a woman with a
  man only. Same-sex pairings are ineligible in this product capability.
- The user's sex must be explicitly declared and confirmed as Male / Female. It is never inferred from name, voice,
  Personal Memory, HIM, model output or other indirect evidence.
- It is an additional required eligibility fact, alongside GATE-15's four required basic profile categories.
- A missing or unconfirmed required fact evaluates as UNKNOWN and never counts as eligible. The candidate's
  corresponding fact must also be explicitly available and confirmed.
- It is not disclosed beyond the approved privacy boundaries.
- It is not implemented in production as part of WP0.

**Architectural implication, identified and not implemented: CA-09.** The I-07 runtime on `main` has no sex dimension,
and nothing in it can express a pair-level eligibility rule of this kind:
- **Discovery.** `discover_matching_candidates_core_v1` (`0111:442-480`) returns every other currently matchable
  participant. It excludes only those holding an active Introduction or an open proposal with the requester.
- **Matchability.** `resolve_matching_setup_state_v1` (`0111:227-275`, rule at `:263`) is `ACTIVE` participation plus
  the current grant, profile, requirement and disclosure-authority identities. It reads no field value.
- **The eligibility snapshot.** The snapshot (`0110:345-425`; captured at `0111:498-605`) binds both humans' versions
  and counts their `HARD_DEALBREAKER` items. It has no pair-level eligibility column.
- **Hard-requirement outcomes.** These (`0110:441-478`) are keyed to each human's own requirement items (`item_fk`,
  `:460`). A Product-wide rule therefore has no row of its own, and writing it as a requirement item would misstate it as
  that person's own dealbreaker. The parts that already fit D1:
  - the outcome law, under which `UNKNOWN` holds exactly when the source is `NOT_ESTABLISHED` (`:476`);
  - the source classes (`:469-475`), which cannot spell an inference.
- **The Introduction Profile.** A profile field (`0108:406-435`) could hold a self-declared value without a schema
  change. But the profile records no per-field confirmation. And any profile field can be selected by a Pre-Match
  Disclosure Authority (`0108:578-597`), which makes it a disclosure candidate.

The controlled architecture amendment must settle:
1. where the declared and confirmed fact lives, and how its confirmation is evidenced;
2. the pair-level opposite-sex predicate in discovery and snapshot capture, which must fail closed, so that a missing or
   unconfirmed fact on either side is UNKNOWN and never eligible;
3. that the fact is never a Pre-Match Disclosure Authority field or a `matching_proposal_safe_field_keys` value
   (`0110:298-319`), unless the Product Owner approves a privacy boundary that allows it;
4. how the frozen-body verifiers of the migrations it touches are amended.

The new fact is also part of the reader's own export (`QAN-BL-PRIV-04` property 1) and of the deletion footprint
(`QAN-BL-ACCT-01`). The amendment is needed before S6-01 captures the fact and before S6-03 evaluates it. Its owner is
set by those tasks' Task Contracts. No frozen Product text found in this review states a gender-neutral matching rule,
so the amendment is classed CA, not CP.

| ID | Gate | Frozen authority in the way | What the amendment must settle | Before |
|---|---|---|---|---|
| CA-09 | GATE-16 (D1) | `0111:442-480` (discovery has no pair predicate beyond matchability, an active Introduction and an open proposal); `0111:227-275` (matchability reads no field value); `0110:345-425`, `:441-478` (no pair-level eligibility row; outcomes keyed to the owner's own requirement items); `0108:406-435`, `:578-597` (profile fields are unconfirmed and disclosure-selectable) | Items 1–4 above | S6-01 (capture); S6-03 (evaluation); any real Matching |

AR-09 is answered: the category is the counterpart's sex, and each human's own declared and confirmed fact is what the
rule checks. §14.9 item 6 is replaced by item 20 below.

#### D2 — `QAN-BL-PRIV-04` — APPROVED

The Product Owner confirms both values that WP0 had assigned under GATE-19:
- **Owner:** `S6-07 — Activity, Direct Entry and Final Integration`.
- **Severity:** `HIGH`.

The scope is the reader's Matching and Introductions export only, and it respects the other participant's privacy. S6-07
is not silently expanded into a complete cross-world export implementation. The backlog item, §7, §9, Current State,
the Project Map and the Roadmap now record the owner and severity as confirmed, not as awaiting confirmation (§14.9
item 19).

#### D3 — Account deletion — APPROVED DIRECTION

The Product Owner approves a separately owned correction path for `QAN-BL-ACCT-01`, provisionally named `ACCT-DEL-01`:
- naming and anti-duplication are verified before formal admission;
- it addresses deletion integrity across the relevant worlds;
- no real Matching enrollment happens before the deletion-blocking footprint is resolved;
- the correction is not implemented in WP0.

**Naming and anti-duplication, verified.**
- The id `ACCT-DEL-01` is unused in the tree, in the history of every ref, and in GitHub issues and PRs.
- No register item or task other than `QAN-BL-ACCT-01` carries Connected Worlds account deletion:
  - `ACCOUNT-SEC-EVT-01` owns security-event producers (`QAN-BL-NOTIF-04`);
  - `QAN-BL-PROD-05` is the export package's size;
  - `QAN-BL-MATCH-01` and SEC-MATCH-00 stop new Matching footprints and erase nothing;
  - the W3-MEGA-S Personal deletion is Personal-only.

**Not yet formally admitted.** `QAN-BL-ACCT-01` keeps its index row (`UNASSIGNED`, `HIGH`, `OPEN — UNASSIGNED`), and a
dated note in its §5 item records the direction. Two things remain before the item can be formally re-owned to
`ACCT-DEL-01` and become `DEFERRED — OWNED`:
- the Product Owner's confirmation of the provisional name;
- the matching update of the index-row pin in `tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs`,
  made in the same change.

GATE-05's question (§14.4; §14.9 item 4) is answered: a correction is commissioned, and real enrollment waits for it.

#### D4 — Generated conversation default language — APPROVED

- Respect an explicitly chosen language or dialect.
- Otherwise, follow the user's dialect when it is reasonably clear from the conversation.
- If no preference or dialect can be determined, default to neutral simplified Modern Standard Arabic.
- Do not default every Arabic user to Egyptian.
- All fixed Arabic application copy remains simplified Modern Standard Arabic, regardless of the user's dialect
  (§14.1).

This answers the open question of the language rule (§14.9 sub-questions; census §6). It is identified against the
repository here and changes nothing:
- **Language authorities.**
  - LANG-01, VI-01 T2 ("restrained Egyptian for the launch experience"), now conflicts for the undetermined case as well.
  - LANG-14, I-08A4 §11 (`:337`, Egyptian-compatible warmth "may remain the current/default conversational profile"), is
    superseded for that case.
  - I-08N-01 (`:651`, "fall back to the appropriate neutral localized language") already agrees.
- **Runtime.** The approved model-facing guidance says only to match the user's language or dialect when it is
  "reasonably inferable" or "reliably supported" (`apps/api/src/conversation/behavioral-response-policy.service.ts:11`,
  `:29`, `:47`). It states no fallback, and a `DEFAULT` reply-language preference adds no guidance line
  (`apps/api/src/interaction-preferences/interaction-preference-guidance.ts:58`).
- **What it needs.** Making D4's fallback explicit is a controlled change to approved model-facing text, and the VI-01
  and I-08A4 conflicts need language-authority amendments. Both belong to the LANG workstream (D6 rule 3). Neither is
  made here.

#### D5 — Shared / Public / Replay export — APPROVED DIRECTION

The Product Owner assigns cross-world export completeness to a dedicated, explicitly owned `PRIV-EXPORT-01` planning
path, coordinating with Stage 7 for Replay. The whole cross-world export problem is not put into S6-07.

**Ownership and anti-duplication, verified.**
- `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` exists in the register as the owner of
  `QAN-BL-PRIV-01` … `03`, which are single-owner Personal facts. It is in no Roadmap stage, and no test pins its owner
  string.
- No item carries the `'shared'`, `'public'` or `'replay'` categories that `build_personal_export_v1` still lists in
  `notYetIncluded` (`0153:314`):
  - `QAN-BL-PRIV-04` excludes them by its own text;
  - `QAN-BL-ACCT-01` is deletion;
  - `QAN-BL-PROD-05` is the package size;
  - W3-MEGA-S item 9 (`:574`) and the E2E rows E2E-D-16 and E2E-D-17 admitted nothing.
- The id `QAN-BL-PRIV-05` is unused in the tree, in the history of every ref, and in GitHub issues and PRs.

**Admitted: `QAN-BL-PRIV-05`**, "Export My Data Omits the Reader's Shared, Public and Replay World Data". It is `HIGH`
and `DEFERRED — OWNED`, owned by `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts`, the owner string
copied character-exact.
- **Severity.** It is `HIGH` for the reason `QAN-BL-PRIV-04` is: the reopened work decides what of a multi-member World
  crosses into one member's export (W3-PDG-01 §7.3: "only within the limits of actual ownership and authority").
- **Owner name.** The owner's name is narrower than its scope after D5. A rename is recorded as a re-owning of all its
  items.
- **Replay.** Replay is coordinated with Stage 7. Introduction material stays excluded from user-facing Replay until
  Stage 7 approves its contract (GATE-35).

#### D6 — Parallel execution strategy — APPROVED

After WP0 closes, two independent workstreams are planned:
- **LANG:** controlled Arabic authority amendments, Product Owner copy approvals and focused corrections, using the
  existing 109-unit census.
- **S6:** Stage 6 Matching implementation, starting with S6-01 after its historical Return Gate and the required
  architecture decisions are reconciled.

Rules:
1. Independent branches and PRs.
2. No duplicated implementation.
3. LANG owns existing Arabic copy and its language-authority amendments.
4. S6 owns new Matching UX and follows the approved simplified-MSA rule.
5. Shared text or frozen-contract dependencies are resolved in the owning workstream first.
6. Focused verification per workstream, with proportionate integration verification.
7. The full 109-unit Arabic census is maintained without restarting the research.
8. Neither workstream receives implementation authorization through this addendum.

D6 creates no register item. The census stays PROPOSED, and none of its 109 units is approved by the addendum. The
QANDEEL-wide copy sweep that §14.4 recorded as needing a Product Owner designation is now designated as the LANG
workstream's planning scope. Each workstream's register representation is decided at its own kickoff (BG-05 / BG-06).

#### Register change

| | Before the addendum | After the addendum |
|---|---|---|
| Total | 66 | **67** |
| `DEFERRED — OWNED` / `VALIDATION — OPEN` / `OPEN — UNASSIGNED` / `CLOSED — TOMBSTONE` | 30 / 4 / 10 / 22 | **31 / 4 / 10 / 22** |
| `HIGH` / `MEDIUM` / `LOW` | 35 / 29 / 2 | **36 / 29 / 2** |
| Active, as HIGH / MEDIUM / LOW | 44 (18 / 24 / 2) | **45 (19 / 24 / 2)** |

Only `QAN-BL-PRIV-05` is admitted. `QAN-BL-PRIV-04`'s fields are unchanged, and only the wording of its confirmation
changes. `QAN-BL-ACCT-01`, `QAN-BL-MATCH-01` and `QAN-BL-PROD-06` are unchanged.

#### Blockers after the addendum

Resolved or narrowed in §14.9:
- item 6 is resolved by D1 and replaced by item 20;
- item 18 by D5 (`QAN-BL-PRIV-05`);
- item 19 by D2;
- item 4 is narrowed by D3: the direction is approved, and the name, the formal admission and the correction itself
  remain;
- the GATE-16 and language-rule sub-questions are answered by D1 and D4.

Added:

| # | Blocker | Blocks | Needs |
|---|---|---|---|
| 20 | The I-07 runtime has no sex dimension and no pair-level eligibility rule (CA-09) | S6-01's capture of the fact; S6-03's evaluation; any real Matching | the CA-09 controlled architecture amendment, approved before implementation |
| 21 | `ACCT-DEL-01` is provisional: `QAN-BL-ACCT-01` is not formally re-owned, and its index row is pinned by the SEC-MATCH-00 contract test | real Matching enrollment (D3); launch | the Product Owner's confirmation of the name; one change that re-owns the item and updates the pin; then the correction (CA-02 if `0108` / `0130` bodies change) |
| 22 | D4's fallback to neutral simplified MSA is not stated in the approved model-facing guidance, and VI-01 T2 and I-08A4 §11 conflict with it | generated replies conforming to D4 | a LANG-workstream controlled change to the guidance and the language-authority amendments (D6 rule 3) |

Items 1–3, 5, 7–17 of §14.9 stay open as written.

#### Files changed by the addendum

| File | Change |
|---|---|
| `docs/qandeel-canonical-backlog-v1.md` | §4: the `QAN-BL-PRIV-05` row. §5: `QAN-BL-PRIV-04`'s owner and severity marked confirmed (D2), with a pointer in its "Not in this item"; a dated D3 note in `QAN-BL-ACCT-01` (fields unchanged); the new `QAN-BL-PRIV-05` item. §7: counts (67; 31 / 4 / 10 / 22; 36 / 29 / 2) and a dated addendum paragraph. §9: the `PRIV-EXPORT-01`, `S6-07` and WP0 rows |
| `QANDEEL_CURRENT_STATE.md` | §1 snapshot sentence; §3.6 language row (D4); §4 Matching note (D1); §5 tables, the recount note, a "Latest update" sentence and "The 45 active items"; the §7 `S6-07` and `PRIV-EXPORT-01` rows |
| `QANDEEL_PROJECT_MAP.md` | The count note (67); the language row (D4); the Stage 6 row (D1, D2, D6). The pinned current-task line is untouched |
| `QANDEEL_PRODUCT_ROADMAP.md` | A pointer in §6.7 and a new §6.8 execution note (D1–D6) |
| This record | Header; dated pointers in §14.4, §14.5, §14.7 and §14.9; this §14.14 |
| `docs/e2e/QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md` | One dated note in §6 (the default-language question answered by D4). No unit, original or proposal changed |

#### Validation of the addendum

The addendum is documentation only, so validation is proportional. Every check ran locally on the branch, on Windows
with Node, on the final content of the six changed files. No new reviewer panel was run, because no concrete defect
called for one.

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Task-closure governance gate (AGENTS.md §10.7) | `npm run test:task-closure-governance-contract` | **PASS 24 / 24** |
| 2 | Every static contract under `tests/` and `database/tests/` that reads one of the edited documents (the same 24 files as §14.12) | `node --test <the 24 files>` | **PASS 367 / 367** |
| 3 | Forward-safety mirror | `node --test tests/forward-safety-contract.test.mjs` | **PASS 35 / 35** (369 s) |
| 4 | Mechanical recount of backlog §4 (the governance test's `INDEX_ROW` shape) | a local Node script | 67 rows, no duplicate ID: 31 / 4 / 10 / 22 by status, 36 / 29 / 2 by severity, 45 active (HIGH 19 / MEDIUM 24 / LOW 2). Every index ID has a §5 item or a §6 tombstone. The §7 tables, the last "Latest index" line and the Current State §5 tables agree. The Current State active list holds the 45 index rows byte for byte, in index order. No Current State line matches `Stage 6 … **ACTIVE`. The pinned `QAN-BL-ACCT-01` and `QAN-BL-MATCH-01` rows are unchanged |
| 5 | Relative Markdown links in the six changed files | a local Node script | 553 checked, **0 broken** |
| 6 | The copy census | `git diff` | One dated note in §6; no unit, original or proposal changed |
| 7 | Whitespace | `git diff --check` | clean |

**CI.** No workflow runs on this PR, for the reason given in §14.12.

#### What the addendum did not do

- It changed no runtime, migration, grant, API, screen, copy string, test, CI file or frozen contract. CA-09 and the D4
  guidance change are identified only.
- It did not re-own `QAN-BL-ACCT-01` (D3 needs the name first), and it did not admit any LANG or S6 workstream item.
- It wrote no Task Contract, started neither workstream, and did not merge.
