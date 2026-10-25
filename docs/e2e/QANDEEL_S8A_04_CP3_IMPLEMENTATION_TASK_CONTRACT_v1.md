# S8A-04 / CP3 — Personal Knowledge in Shared World — IMPLEMENTATION TASK CONTRACT

**Status:** `TASK CONTRACT — WRITTEN UNDER THE PRODUCT OWNER'S FINAL IMPLEMENTATION AUTHORIZATION (2026-10-25) · CP3-A
DELIVERED LOCALLY · CP3-B DELIVERED LOCALLY · CP3-C DELIVERED LOCALLY (CP3-C authorization 2026-10-25; D-1 APPROVED WITH
CONDITIONS; COPY GATE APPROVED 6/6) · CP3-D NOT STARTED (no budget) · LOCAL
BRANCH s8a/s8a-04-cp3 ONLY — NOT PUSHED, NO PR, NOT MERGED` · **Date:** 2026-10-25
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
| CP3-D | the preregistered judge evaluation (§5) | not started; budget request first |

**Out of scope:** the relevance model (removed, amendment §10.1); Public World and Matching; the graphics engine; CP2, round
20 and Future Improvement 011 (not reopened); Stage 9 economics, Credits, usage budget and launch gates; any hosted
database; any real user's data; SYNTHETIC_ONLY (unchanged).

## 2. Authority limits
- No push, PR or merge without the Product Owner's explicit instruction; no revert, force push or rewrite of `main`.
- No paid DeepSeek call without a new budget approval; guard round 21 has no paid allowance (dry and simulated only).
- 0176 is applied to no hosted database.
- No unrelated local edit is committed (the old `api-ci.yml` 0173 hunk and the guard's rounds 12–17 stay uncommitted).
- The six Copy Gate texts are wired verbatim; APPROVED 6/6 by the Product Owner (2026-10-25). A material change returns to
  the Product Owner.
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
| T-D | CP3-D: 120 preregistered synthetic cases (30 natural mentions, 15 influenced advice, 75 must-block); accept only with 0 / 75 misses, ≤ 3 / 45 false blocks, ≤ 2 malformed; any miss rejects the policy | ≈ USD 0.05 per run at peak; **not authorized** — budget request first |

## 6. Close and merge conditions
- CP3 closes only when T-A to T-D pass, the Copy Gate is closed, CP3-C's device check is recorded, and the S8A-04 BG-08 /
  BG-09 closure is made in the same change (the amendment's banner to its final state; `QAN-BL-CW-02` disposed).
- One PR for S8A-04 CP3, opened only on the Product Owner's instruction; merged only on the Product Owner's explicit
  order, on a green exact head.

## 7. Decisions reserved to the Product Owner
- **D-1** Confirm the authority basis of the local relevance read (amendment §10.1), or close the path. — **APPROVED WITH
  CONDITIONS** (2026-10-25; amendment §10.5).
- **D-2** Approve the six Copy Gate texts (linguistic correction only) before CP3-C. — **APPROVED 6/6** (2026-10-25).
- **D-3** Approve CP3-D's budget (the preregistered 120-case set) before any paid call.
- **D-4** Push / PR / merge.

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
