# S8A-04 / CP3 — Personal Knowledge in Shared World — IMPLEMENTATION TASK CONTRACT

**Status:** `TASK CONTRACT — WRITTEN UNDER THE PRODUCT OWNER'S FINAL IMPLEMENTATION AUTHORIZATION (2026-10-25) · CP3-A
DELIVERED LOCALLY · CP3-B DELIVERED LOCALLY · CP3-C DELIVERED LOCALLY (CP3-C authorization 2026-10-25; D-1 APPROVED WITH
CONDITIONS; COPY GATE APPROVED 6/6) · CP3-D V1 RUN ONCE (D-3) AND NOT ACCEPTED · CP3-D V2 — CONTROLLED AMENDMENT R4,
TRUSTED CLAIM SPANS — IMPLEMENTED LOCALLY UNDER THE PRODUCT OWNER'S CP3-D V2 FINAL IMPLEMENTATION CONTRACT (2026-10-26),
FREE PROOFS ONLY, NOT PUSHED; CG-6a′ / CG-6b′ PROPOSED, NOT APPROVED; CP3-D V2 NOT RUN (no budget) · BRANCH
s8a/s8a-04-cp3, DRAFT PR #358 — NOT MERGED` · **Date:** 2026-10-25 (R4: 2026-10-26)
**Design authority:** [CP3 Controlled Amendment v1.0](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT_v1.0.md)
(R3, approved for implementation with two binding corrections, recorded in its §10; CP3-C's decisions and record in
its §10.5 – §10.6). This contract creates no Product
semantics; where it and the amendment differ, the amendment binds.
**Delivers:** `SHARED-CTX-01` / `QAN-BL-CW-02` (the private-context portion of `G-08`) — at the closure of S8A-04, not
before (§8).

## 1. Scope
| Phase | Contents | State |
|---|---|---|
| CP3-A | migration `0176_s8a_04_personal_knowledge_in_shared_world_v1.sql` (consent pair, events, private requests, cooldowns, use record, the owner's `authenticated` commands, the server's `service_role` reads, `complete_shared_world_qandeel_reply_v2`) and `database/verify-migration-0176.mjs` on real PostgreSQL 17; the census re-anchors (0150, 0171, 0174, 0175); API CI step and focused group `s8a-04-cp3` | delivered locally |
| CP3-B | `apps/api/src/connected-worlds/member-knowledge/` (collector, item grant resolver, source-state resolver, Disclosure Authorization evaluator, the I-03G authorized-disclosure lane, disclosure revalidator, lane readiness); `shared-world/deepseek-shared-disclosure-judge.ts`, `shared-disclosure-judge-provider.ts`, `shared-member-knowledge-texts.ts`; reply plumbing in `shared-qandeel-reply.service.ts` and the generator; AI-COST-01 family `SHARED_DISCLOSURE_JUDGE`; the free suites and the integrated proof `scripts/s8a-04/cp3-*` | delivered locally |
| CP3-C | migration `0177_s8a_04_shared_knowledge_owner_surface_v2.sql` (the owner's v2 read and commands: names, an opaque audience reference, no user id; the v1 id-carrying surface retired for a person) and `database/verify-migration-0177.mjs`; the owner's four API routes (`shared-world-permissions.{repository,service}.ts`); the mobile surfaces in `apps/mobile/src/shared-world/permissions/` (CG-1 request pinned in the World's conversation screen; CG-3 – CG-5 in Manage World); scenario C and the Activity scenario A of the integrated proof; the emulator check in Arabic and English | delivered locally |
| CP3-D | V1: the preregistered judge evaluation (§5, T-D) | run once (D-3), **NOT ACCEPTED** (amendment §11.0) |
| CP3-D V2 | Controlled Amendment R4 — Trusted Claim Spans (amendment §11): migration `0178_s8a_04_shared_audience_names_v1.sql` + `database/verify-migration-0178.mjs` (the audience Names read; service_role only; read-only); `member-knowledge/shared-claim-spans.ts` (pure); the lane's `authorize` → `claims` → `readiness` path; the reply service (claim refs, the rendered text committed, per-item cooldown); the V2 check adapter (one call per reply, opaque ids) and its test checker; CG-6a′ / CG-6b′; the integrated proof's V2 stand-in; the free cost rehearsal `scripts/s8a-04/cp3d-v2-cost-rehearsal.ts`; then the two-tier evaluation (T-D2) | implemented locally, free proofs only; T-D2 not run, no budget |

**Out of scope:** the relevance model (removed, amendment §10.1); Public World and Matching; the graphics engine; CP2, round
20 and Future Improvement 011 (not reopened); Stage 9 economics, Credits, usage budget and launch gates; any hosted
database; any real user's data; SYNTHETIC_ONLY (unchanged).

## 2. Authority limits
- No push, PR or merge without the Product Owner's explicit instruction; no revert, force push or rewrite of `main`.
- No paid DeepSeek call without a new budget approval; guard round 21 has no paid allowance (dry and simulated only).
- 0176 is applied to no hosted database.
- No unrelated local edit is committed (the old `api-ci.yml` 0173 hunk and the guard's rounds 12–17 stay uncommitted).
- The six Copy Gate texts are wired verbatim; APPROVED 6/6 by the Product Owner (2026-10-25). A material change returns to
  the Product Owner. Under R4, CG-6a′ / CG-6b′ (amendment §11.5) replace CG-6a / CG-6b in the code so the free tests run
  their exact bytes; they are PROPOSED, not approved, and no paid call runs with them before their approval and a budget.
- CP3-D V2 contract limits (2026-10-26): no paid DeepSeek; no push before the Product Owner's gate; no GitHub CI and no
  Android (the PO-WAIVED Android CI record and `QAN-BL-CI-03` stay as decided, not reopened); no reopening of CP1, CP2 or
  CP3-A / B / C; no Foundation Freeze change, consent or audience widening, hosted database, new PR, merge or release; no
  prompt-tuning loop. `scripts/s8a-04/cp3d-eval.ts` stays the V1 record (it does not compile against the V2 adapter).
- Stop and report on any fundamental privacy or accounting defect.

## 3. Acceptance criteria — function
1. With no consent, no judge, or no relevant item, the reply is exactly the pre-CP3 reply (the frozen I-03 chain).
2. A consented, relevant item reaches the reply generator only from a later turn, under CG-6a, with the owner's label.
3. A mention of an allowed item, attributed to its owner, passes as `AUTHORIZED_DISCLOSURE` (never a relabelled `CLEAR`)
   only after I-03F (unchanged) and the disclosure revalidation are CURRENT for the same output, audience and items.
4. The commit re-checks each pair under lock and writes one `REASONING_DEPENDENCY` and one use record per item; any
   failure writes nothing.
5. Decline stops automatic requests for that item; the owner can allow it later; a wider audience needs reconfirmation.

## 4. Acceptance criteria — privacy and accounting
- **Privacy:** no AI call before consent; no item text, summary or derivative leaves the database before consent; the
  request reaches its owner alone; another member can neither read nor answer it; no item of a non-consenting, declining
  or non-present member reaches any model; no item in the map, readings, placement, recall or Activity; a withheld reply
  is the neutral provider-failure answer; revoke, join, leave, correction or forget during generation never commits.
- **Accounting:** every AI call after consent is paid by the verified author of the causing HUMAN_TEXT through
  `begin_ai_provider_call_v2`; a payer who is not the author is refused before any provider request; one ledger row per
  attempt; no charge or usage row names the owner or another member for a message they did not send.
- **Authority of the internal read (D-1, §7):** the local relevance read creates no grant; only the owner's
  `authenticated` command does. D-1's conditions (amendment §10.5) bind: relevance detection and the private request only;
  server-only; nothing to DeepSeek, the shared reply, the map or Activity; the request to its owner alone.

## 5. Test and cost gates
| Gate | What | Cost |
|---|---|---|
| T-A | `verify-migration-0176.mjs` + the re-anchored census verifiers on real PostgreSQL 17 | free |
| T-B | API jest (whole suite), `tsc`, AI-COST-01 contract, I-03 closure contract, the root contracts | free |
| T-B2 | the integrated proof `node scripts/s8a-04/cp3-launch.mjs --simulate=<tag>` (and `--dry`) | free |
| T-C | the Copy Gate (six texts) closed by the Product Owner (CLOSED 6/6); `verify-migration-0177.mjs`; the integrated proof's scenarios C and A; the emulator check (AR, EN) | free |
| T-D | CP3-D V1: 120 preregistered synthetic cases (30 natural mentions, 15 influenced advice, 75 must-block); accept only with 0 / 75 misses, ≤ 3 / 45 false blocks, ≤ 2 malformed; any miss rejects the policy | run once (USD 0.0181 at peak): **NOT ACCEPTED** — 3 / 75 misses, 7 / 45 false blocks, 0 invalid |
| T-D2 | CP3-D V2 (amendment §11.6): Tier 1 — 150 checks (90 block, 60 allow): 0 leaks, false blocks ≤ 3 / 60, invalid ≤ 2 / 150; Tier 2 — 60 end-to-end cases (40 relevant, 20 boundary): 0 unauthorized or misattributed, useful use ≥ 32 / 40, unjustified blocks ≤ 2 / 40, blind rating not worse ≥ 16 / 20; definitions, cases and SHA fixed before any paid call | free rehearsal (§8): expected ≈ USD 0.12, pessimistic ≈ USD 0.24, guard worst-case reservation ≈ USD 0.67 for both tiers; **not authorized** — budget approval first |

## 6. Close and merge conditions
- CP3 closes only when T-A to T-D pass, the Copy Gate is closed, CP3-C's device check is recorded, and the S8A-04 BG-08 /
  BG-09 closure is made in the same change (the amendment's banner to its final state; `QAN-BL-CW-02` disposed).
- One PR for S8A-04 CP3, opened only on the Product Owner's instruction; merged only on the Product Owner's explicit
  order, on a green exact head.

## 7. Decisions reserved to the Product Owner
- **D-1** Confirm the authority basis of the local relevance read (amendment §10.1), or close the path. — **APPROVED WITH
  CONDITIONS** (2026-10-25; amendment §10.5).
- **D-2** Approve the six Copy Gate texts (linguistic correction only) before CP3-C. — **APPROVED 6/6** (2026-10-25).
- **D-3** Approve CP3-D's budget (the preregistered 120-case set) before any paid call. — **APPROVED and run once**
  (2026-10-25, guard round 22, USD 0.05 / 120 calls): NOT ACCEPTED; policy V1 rejected (amendment §11.0).
- **D-4** Push / PR / merge. — Draft PR #358 opened on the Product Owner's instruction (2026-10-25); no merge.
- **D-5** The V2 direction. — The Product Owner's CP3-D V2 Final Implementation Contract (2026-10-26) authorizes R4 —
  Trusted Claim Spans — locally, free proofs only, with the instruction to execute it to its end (amendment §11).
- **D-6** Close the Copy Gate for CG-6a′ / CG-6b′ (amendment §11.5, full texts and diff). — **OPEN** (PROPOSED).
- **D-7** Approve the CP3-D V2 preregistration (Tier 1 / Tier 2 definitions, cases and SHA) and its budget. — **OPEN**.
- **D-8** Push of the R4 commits to Draft PR #358 and the CI run (the plan in §8). — **OPEN**.

## 8. Verification record (2026-10-25, local, free)
- `verify-migration-0176.mjs`: passed on the local PostgreSQL 17 cluster; `verify-migration-0150.mjs`: passed after the
  re-anchor.
- API jest: the CP3 suites 66 / 66 (lane 37, reply 12, judge 17); the whole suite and `tsc` clean.
- Integrated proof `simulated-r4`: 90 / 90 checks, 100 simulated requests, nothing sent; `dry`: 1 / 1 (the guard refused
  every request).

**CP3-C (2026-10-25, local, free; amendment §10.5 – §10.6):**
- A fresh PostgreSQL 17 with all 177 migrations: `verify-migration-0177.mjs` and `verify-migration-0176.mjs` (re-anchored)
  passed, with 0175, 0174, 0173, 0171, 0170, 0150 and the Shared Activity, conversation-material, lifecycle-governance and
  cost-ledger verifiers. The whole CI verifier list on that cluster: 150 passed; 7 did not run to completion locally and
  are not CP3's — six need Redis or the `psql` client, which this machine does not have (startup recovery, post-response
  dispatch, the A2 / full-intelligence / integrated-brain end-to-end smokes, the default-privilege drift check), and
  `verify-migration-0130.mjs` stops at its 7-day export-expiry assertion, which compares the database's clock with the
  local machine's (0130's export; no CP3 object is involved; it failed the same way in this branch's earlier local run).
- API: jest 292 / 292 suites (6 891 tests, 1 skipped), `tsc` clean. Mobile: jest 228 / 230 suites — the two failing suites
  are the known locale baseline (`w2-account-access`, `depth` W1A-01), unchanged — `tsc` clean;
  `permissions.test.tsx` 17 / 17, `shared-permissions-api.test.ts` 3 / 3, `s8a-04-proof-permissions.test.ts` 3 / 3.
  `test:task-closure-governance-contract` 24 / 24. Root contracts `node --test tests/*.test.mjs`: 1 639 / 1 639 (after two
  contract findings on the new mobile files were fixed: the test reached the runtime entry past its barrel, and the World
  client named the audience reference — the decoder tests moved into `runtime-entry/__tests__/`, the command bodies into
  `shared-permissions-api.ts`).
- **PR #358 Mobile CI correction (Jest did not exit).** On GitHub the Fast mobile contract gate ran Jest in one process
  (231 / 231 passed, 2 918 tests) and then stayed open until the job timeout. Cause, proven by an in-band run with a
  per-file timer probe (temporary, not committed) under the runner's en-US locale: two existing integration suites —
  `w3-mega-s-privacy-data` (4) and `w3-mega-a-account-security` (3) — never disposed the runtime they built, so the Account
  & Identity and Privacy & Data read retries (15 s, while LOADING) stayed armed after the run. `main` leaks the same 7: its
  last run used Jest workers, and the log shows the worker «force exited»; none comes from the CP3-C suites. Fix: both suites
  dispose every runtime a test built after each test (no `--forceExit`, no timeout change, no production change). After the
  fix: the whole suite in band 231 / 231 (2 918 tests) and Jest exited by itself with code 0; with workers the same, and no
  forced worker exit; `--detectOpenHandles` on the two suites exits 0 (unfixed: still open at 120 s).
- Integrated proof `simulated-c5` (fresh cluster): 127 / 127 checks — scenario C (the ten-step journey through the
  controller's own routes; decline and «اسمح الآن»; withdraw; correct and forget; audience growth; leave and the governed
  rejoin) and scenario A (Activity, its members, push attempts and the outbox byte-identical under every permission act;
  a live Activity channel; the same attention to the owner as to another member; no words, ids or permission words in any
  attention row; every call paid by the member who spoke; a whole-database scan); `dry` 1 / 1.
- **Device** — Android emulator API 36 (x86_64), the S4-01 proof build (validation-only entry; the permissions route served
  by `s8a04-proof-permissions.ts`; final APK `sha256 706aa8ef…74ae2`), Arabic and English (per-app locale), screenshots in
  `.s8a-04-reports/cp3c-device/` (not committed): the CG-1 request in the World's own screen, verbatim, every inserted value
  isolated («V60», «10» and the names in their place in RTL); «اسمح» → the CG-2 confirmation, the card gone, nothing in the
  conversation; Manage World: «ما سمحت به هنا» with «مسموح», «رفضته» + «اسمح الآن», the endings (left; forgotten without
  words; corrected after `knowledge/correct`); withdraw after its consequence (the item moves to «رفضته»); «اسمح الآن»
  naming the members; growth: the new member named, both items waiting for reconfirmation ABOVE «مسموح» and no longer
  under it, «اسمح للجميع» restoring one, «أوقف استخدامها» moving the other to «رفضته»; «لا» → the CG-2 decline
  confirmation. The same in English. **Four defects found on the device and fixed before this record:** (1) the request
  sat inside the conversation's scroll (out of sight behind a long history) — now pinned between the header and the
  conversation; (2) a pinned request taller than its bound hid «اسمح» / «لا» below its fold — now one request at a time,
  its words bounded (30% of the window, visible scrollbar) and its answers always in sight; (3) the CG-2 confirmation was
  repeated on Manage World — a confirmation now stays on the screen of its act; (4) items waiting for reconfirmation were
  listed under «مسموح» — now shown before it. Each has a regression test in `permissions.test.tsx`.
- **Not proved on the device:** the real server and database (the proof build serves the permissions route from a local
  fixture; the server path is the integrated proof's), a screen reader (TalkBack not run), iOS, other screen sizes and
  font scales, push notifications (none exist for CP3), and a real model's mention quality (CP3-D).

**CP3-D V2 — Controlled Amendment R4, Trusted Claim Spans (2026-10-26, local, free; amendment §11):**
- **0178 on real PostgreSQL 17** (a local cluster with all 178 migrations): `verify-migration-0178.mjs` passed — the
  boundary (service_role only; `anon` / `authenticated` 42501; a NULL World 22023), every member of the exact audience
  (silent members included, other Worlds excluded), identical Names both answered, a member with no Name NULL, a Name
  change read live, a departed member gone, a member alone NULL, nothing written (every table count and grant row
  unchanged). The focused group `s8a-04-cp3d-v2` (0178, 0177, 0176, 0175, 0174, 0171, 0139, 0140, 0150, 0155, 0164): 11 / 11,
  after one re-anchor of `verify-migration-0176.mjs` (its privilege census now names 0178's server read where 0178 is
  applied).
- **Unit and composition suites:** `shared-claim-spans.spec.ts` 67 / 67 (the 63 tests ported from the free engineering
  proof, adapted to production as its header states, plus 4); the lane 58 / 58; the check adapter 18 / 18; the reply with
  member knowledge 24 / 24. Each changed expectation of the V1 suites is an intended R4 change, stated in its file's header:
  the committed body is the server's rendering; a checker failure cools nothing (R4-3); only the proven-unsafe item is
  cooled; one check per reply.
- **Mutation checks** (each deterministic R4 rule broken in turn, the suites re-run, the file restored): **16 / 16 caught**
  — a Name in a span, a residual marker, a duplicate ref, an identical Name given a ref, an item outside the DA sent, an
  ADDS span passing, an outside passage ignored, a sealed passage ignored, a claim without a current disclosure grant
  READY, a changed disclosure authorization accepted, the claim ref shown to the checker, the Name not written, READY
  carrying the generated text, Names that are not exactly the audience used, duplicate Names rows accepted, every item
  cooled. The first run left three alive; the tests that now catch them were added (two owners in one check — only the
  unsafe item cooled, each item under its own owner's Name; the 0178 decoder), and one of the three was a weaker,
  equivalent mutation, replaced by the whole rule.
- **The integrated proof** `node scripts/s8a-04/cp3-launch.mjs --simulate=d2v2` (a fresh PostgreSQL 17 with every
  migration; Nest's `SharedWorldModule`; the stand-in answering CG-6b′ with the test checker's rule and writing items in
  their spans; the network guard, round 21; nothing sent): **130 / 130 checks**, 152 DeepSeek requests simulated (150
  reached the guard; the two injected HTTP 500s are answered before it). New or changed under R4: the reply request
  carries CG-6a′ and the item with its claim ref; ONE check per reply carrying both owners' items (P5); the check request
  carries no member Name, no claim ref and no id; the committed body is the rendered text ("محمد ‹item›", "سارة ‹item›",
  each under its own owner, no marker left) and the I-03 evidence binds the digest of exactly that text; a quote, a sealed
  source, OTHER_PERSON and ADDS withhold the reply and cool that item; an HTTP 500 and a malformed answer withhold it
  and cool nothing, and the next message uses the item again with one check (R4-3); revoke / join / leave / correct /
  forget during the check STALE, nothing written, nothing cooled; scenarios C and A unchanged and green.
- **Consent, ownership and final-text integrity** (where each is proved): no item outside the DA reaches the model
  (lane, reply spec, M05); an item whose owner has no unambiguous Name never gets a ref (0178 verifier, reply spec, M04,
  M14); the Name is written by the server and never by the model (claim-spans spec, M01, M12; P4 / P5 / C10 of the
  integrated proof); a forged or foreign ref is withheld before any check (reply spec, M03); the checker never sees a
  Name or ref (P4, M11); the gate, I-03F, the disclosure revalidation, the binder and the commit all carry the rendered
  text and its digest (lane spec, M13, P4's evidence digest).
- **The whole API suite:** 293 / 293 suites, 6 992 tests passed (1 skipped); `tsc` clean. AI-COST-01 contract 76 / 76
  after its documented re-pin of the check adapter. Root contracts `node --test tests/*.test.mjs`: 1 639 / 1 639, re-run on a clean worktree of the commit (without
  the two unrelated local hunks the branch keeps uncommitted).
  `test:task-closure-governance-contract`: 24 / 24.
- **Free cost rehearsal** `scripts/s8a-04/cp3d-v2-cost-rehearsal.ts` (the real check adapter and reply-block builder into
  a recording client; nothing sent): a check request is 2 726 – 3 660 bytes (1 – 3 items, replies of 160 – 520 characters);
  the member-knowledge block adds 1 340 bytes to a reply request (the simulation's replies: median 8 672, max 10 554
  bytes). At the guard's peak rate with no cache credit: **Tier 1** (150 checks) expected ≈ USD 0.048, pessimistic
  ≈ USD 0.098, worst-case reservation ≈ USD 0.273; **Tier 2** (60 × reply + check = 120 calls) expected ≈ USD 0.074,
  pessimistic ≈ USD 0.139, reservation ≈ USD 0.394; **both** 270 calls, expected ≈ USD 0.12, pessimistic ≈ USD 0.24, the
  guard's reservation ≈ USD 0.67. Assumes an isolated harness (no Shared reading or placement per turn). No approval is
  implied.
- **Not proved:** the meaning of free text — a real checker's misses (an outside statement it does not report, an
  addition it calls ENTAILED, a pronoun co-subject) and false blocks, and the generator's span compliance and usefulness
  (CP3-D V2's two tiers, budget first); the hosted database (0178 applied nowhere hosted); GitHub CI and Android (not run
  under the V2 contract).
- **CI plan (after the Product Owner's gate only):** push the R4 commits to Draft PR #358; API CI runs the new 0178 step,
  the re-anchored 0176 step and the whole API suite; the focused database gate can select `s8a-04-cp3d-v2`; Mobile CI also runs
  (the root `package.json` and `api-ci.yml` are in its triggers) although R4 changes no mobile file, and its Android job stays
  under the recorded PO waiver (`QAN-BL-CI-03`, at the CP3 closure); no merge without the Product Owner's order.
