# S8A-04 / CP3 — Personal Knowledge in Shared World — IMPLEMENTATION TASK CONTRACT

**Status:** `TASK CONTRACT — WRITTEN UNDER THE PRODUCT OWNER'S FINAL IMPLEMENTATION AUTHORIZATION (2026-10-25) · CP3-A
DELIVERED LOCALLY · CP3-B DELIVERED LOCALLY · CP3-C NOT STARTED (Copy Gate 0 of 6) · CP3-D NOT STARTED (no budget) · LOCAL
BRANCH s8a/s8a-04-cp3 ONLY — NOT PUSHED, NO PR, NOT MERGED` · **Date:** 2026-10-25
**Design authority:** [CP3 Controlled Amendment v1.0](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT_v1.0.md)
(R3, approved for implementation with two binding corrections, recorded in its §10). This contract creates no Product
semantics; where it and the amendment differ, the amendment binds.
**Delivers:** `SHARED-CTX-01` / `QAN-BL-CW-02` (the private-context portion of `G-08`) — at the closure of S8A-04, not
before (§8).

## 1. Scope
| Phase | Contents | State |
|---|---|---|
| CP3-A | migration `0176_s8a_04_personal_knowledge_in_shared_world_v1.sql` (consent pair, events, private requests, cooldowns, use record, the owner's `authenticated` commands, the server's `service_role` reads, `complete_shared_world_qandeel_reply_v2`) and `database/verify-migration-0176.mjs` on real PostgreSQL 17; the census re-anchors (0150, 0171, 0174, 0175); API CI step and focused group `s8a-04-cp3` | delivered locally |
| CP3-B | `apps/api/src/connected-worlds/member-knowledge/` (collector, item grant resolver, source-state resolver, Disclosure Authorization evaluator, the I-03G authorized-disclosure lane, disclosure revalidator, lane readiness); `shared-world/deepseek-shared-disclosure-judge.ts`, `shared-disclosure-judge-provider.ts`, `shared-member-knowledge-texts.ts`; reply plumbing in `shared-qandeel-reply.service.ts` and the generator; AI-COST-01 family `SHARED_DISCLOSURE_JUDGE`; the free suites and the integrated proof `scripts/s8a-04/cp3-*` | delivered locally |
| CP3-C | the owner's routes and mobile surfaces (request, list, allow later, withdraw, reconfirm) — prepared only after the six Copy Gate texts are approved; emulator check in Arabic and English | not started |
| CP3-D | the preregistered judge evaluation (§5) | not started; budget request first |

**Out of scope:** the relevance model (removed, amendment §10.1); Public World and Matching; the graphics engine; CP2, round
20 and Future Improvement 011 (not reopened); Stage 9 economics, Credits, usage budget and launch gates; any hosted
database; any real user's data; SYNTHETIC_ONLY (unchanged).

## 2. Authority limits
- No push, PR or merge without the Product Owner's explicit instruction; no revert, force push or rewrite of `main`.
- No paid DeepSeek call without a new budget approval; guard round 21 has no paid allowance (dry and simulated only).
- 0176 is applied to no hosted database.
- No unrelated local edit is committed (the old `api-ci.yml` 0173 hunk and the guard's rounds 12–17 stay uncommitted).
- The six Copy Gate texts are wired verbatim and marked PROPOSED; none is adopted in a user-facing surface before approval.
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
  `authenticated` command does.

## 5. Test and cost gates
| Gate | What | Cost |
|---|---|---|
| T-A | `verify-migration-0176.mjs` + the re-anchored census verifiers on real PostgreSQL 17 | free |
| T-B | API jest (whole suite), `tsc`, AI-COST-01 contract, I-03 closure contract, the root contracts | free |
| T-B2 | the integrated proof `node scripts/s8a-04/cp3-launch.mjs --simulate=<tag>` (and `--dry`) | free |
| T-C | the Copy Gate (six texts) closed by the Product Owner; then the emulator check (AR, EN) | free |
| T-D | CP3-D: 120 preregistered synthetic cases (30 natural mentions, 15 influenced advice, 75 must-block); accept only with 0 / 75 misses, ≤ 3 / 45 false blocks, ≤ 2 malformed; any miss rejects the policy | ≈ USD 0.05 per run at peak; **not authorized** — budget request first |

## 6. Close and merge conditions
- CP3 closes only when T-A to T-D pass, the Copy Gate is closed, CP3-C's device check is recorded, and the S8A-04 BG-08 /
  BG-09 closure is made in the same change (the amendment's banner to its final state; `QAN-BL-CW-02` disposed).
- One PR for S8A-04 CP3, opened only on the Product Owner's instruction; merged only on the Product Owner's explicit
  order, on a green exact head.

## 7. Decisions reserved to the Product Owner
- **D-1** Confirm the authority basis of the local relevance read (amendment §10.1), or close the path.
- **D-2** Approve the six Copy Gate texts (linguistic correction only) before CP3-C.
- **D-3** Approve CP3-D's budget (the preregistered 120-case set) before any paid call.
- **D-4** Push / PR / merge.

## 8. Verification record (2026-10-25, local, free)
- `verify-migration-0176.mjs`: passed on the local PostgreSQL 17 cluster; `verify-migration-0150.mjs`: passed after the
  re-anchor.
- API jest: the CP3 suites 66 / 66 (lane 37, reply 12, judge 17); the whole suite and `tsc` clean.
- Integrated proof `simulated-r4`: 90 / 90 checks, 100 simulated requests, nothing sent; `dry`: 1 / 1 (the guard refused
  every request).
