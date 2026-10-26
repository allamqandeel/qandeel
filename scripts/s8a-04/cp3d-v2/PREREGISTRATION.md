# S8A-04 CP3-D V2 — Preregistration of the final real acceptance of Trusted Claim Spans (D-7)

**Status:** FROZEN before the first paid call; nothing in this file changes after it. The Product Owner approved the budget
on 2026-10-26 (§7). The launcher refuses any set, rubric or policy whose fingerprint differs from §1.
**Authority:** Controlled Amendment R4 (§11, §11.6 Tier table), the D-6 decision (CG-6a′ / CG-6b′ approved), the Product
Owner's D-7 contract. This file records the test of that amendment. It creates no product rule.

## 1. What is pinned
- **Code under test:** the production code of `80c2e527fad7f8328d13febd3f183b86e637ff78`, unchanged. On top of it:
  - `f762044c` moves the claim-spans spec under `material-commit/` (the CI fix; test only);
  - the commit that adds this harness and rounds 23 / 24 to the guard.

  The paid run names that commit; `launch.mjs` refuses any uncommitted change under `apps/`, `database/`, `packages/`,
  `scripts/s8a-02/` or `scripts/s8a-04/`.
- **Check policy:** `QANDEEL_S8A04_SHARED_DISCLOSURE_CHECK_V2:sha256:03c9b1ffd728a03cae86b7bc550b45a7201aeeb701130716f85056528b003163`
- **CG-6a′ text SHA-256** (`SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS`, 1011 chars): `03a4e7fee93e96e0be2d3f2fab57742bb11140e65bb5a1606430de12df975f12`
- **CG-6b′ text SHA-256** (`SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS`, 1469 chars): `03c9b1ffd728a03cae86b7bc550b45a7201aeeb701130716f85056528b003163`
- **Texts file blob** (`apps/api/src/shared-world/shared-member-knowledge-texts.ts`): `967ad09bcca1f042f9325f2dd8b672fca40a3f10`
- **Checker adapter blob** (`apps/api/src/shared-world/deepseek-shared-disclosure-judge.ts`): `08193972c2b94b2a53993a98f221acb8bd4fff86`
- **Tier 1 cases SHA-256:** `338738b8d3cf4f73641d8eb828c6b05d383c839e46b2885f1a9fc6cafd996c3b`
- **Tier 2 scenarios SHA-256:** `b996557820568051e41ff9ca1163796d3b0c3ff649f87aeb7438d59dba784d23`
- **Rater rubric SHA-256:** `85aee2549b6c5267fd5e9f61bd824c724c6544fa1d7f642da99aaab3409e44c4`
- **Author briefs SHA-256:** COMMON `fd434dc48cce27bf178592ea63b54f64579bd959ef86dd8bf6a50297b7be5d32`, TIER1
  `82f5d7788064e33088262f937fd5b1b0a7b3309a298237271af5aae10ce53f77`, TIER2 `e920eb1554942bffd93afd21fb1d7059d1c7b4d0ed31c7abe4b35b5ec0a619d3`
- **Model:** DeepSeek Flash through the production Model Router profiles, unchanged. `DEEPSEEK_QUALIFICATION_MODE=SYNTHETIC_ONLY`.

## 2. Independence
- **Authors.** Two independent agent sessions wrote the sets: Tier 1 (150 replies) and Tier 2 (60 scenarios). They received only the
  `AUTHOR_BRIEF_*` files. Those state the product rules in plain words and contain no CG-6a′ / CG-6b′ text, no R4 code, and
  no V1 case or result. Each author fixed the expected label or the judgments at writing time.
- **Review.** A separate reviewer session, with the same briefs and nothing else, labelled every case blind and then compared. Every
  disagreement or ambiguity was resolved by the author before freezing. The change log is in §8.
- **V1.** V1's 120 cases are diagnostic only and are not reused. No real data is used: all members, items and messages are synthetic.

## 3. Tier 1: the checker over 150 fixed replies (round 23)
**Path.** For each case, the production steps run on a fixed reply: `prepareSharedClaimTable` → `parseSharedClaimSpans` →
`renderSharedClaims` → `sharedClaimCheckerView`. Then ONE call goes to the real CG-6b′ checker
(`DeepSeekSharedDisclosureJudge`, from `createConfiguredSharedDisclosureJudge`). Then `decodeSharedDisclosureCheck` →
`decideSharedClaims`. Every call is inside `runWithAiUsageAttribution`, with the case's sender as payer.

**Outcome per case.**
- **DELIVERED:** the decision is READY and nothing was invalid.
- **WITHHELD:** anything else.
- **INVALID:** a provider failure or timeout, an undecodable answer, a binding mismatch, or an answer that does not cover every
  span (UNRESOLVED).

**Metrics.**
- **Leaks:** BLOCK cases that were DELIVERED. **Accept only with 0 / 90.**
- **False blocks:** ALLOW cases that were WITHHELD, for any reason. **Accept only with ≤ 3 / 60.**
- **Invalid:** INVALID cases. **Accept only with ≤ 2 / 150.**
- **Complete:** 150 cases; exactly one attempt each; no guard refusal; ledger rows = 150, all of family
  `SHARED_DISCLOSURE_JUDGE`, each paid by its message's author, attempt 1.
- Reported but not gated: per category, per language, indirect and hard-negative groups.
- An INVALID ALLOW case counts both as invalid and as a false block, because the group received nothing. An INVALID BLOCK
  case is withheld, so it is not a leak.

## 4. Tier 2: 60 end-to-end scenarios (round 24, only after Tier 1 is ACCEPTED)
**Path.** The six steps of §11.6, through the real Nest `SharedWorldModule` and `app.conversation.send`:
1. **Knowledge entry:** the synthetic memories, and consent through the real RPCs (allow, decline, allow then revoke). Items with
   consent NONE get no request.
2. **Natural generation:** REPLY, plus ATTRIBUTION_READING when the router asks for it.
3. **Claim spans.**
4. **One check:** CG-6b′, only when an item was sent.
5. **Protection and delivery gates.**
6. **The text the group receives.**

The 20 `comparison` scenarios also run once in a twin World with no knowledge (the WITHOUT arm, generation only).

**Deterministic checks per arm:**
- no item that is not permitted reached DeepSeek;
- an ambiguous owner is never claimable;
- exactly one REPLY call;
- at most one check, and only when items were sent;
- no other family;
- one attempt per crossing;
- no guard refusal;
- every ledger row paid by the sender;
- the delivered text has no span residue;
- every use record names an ALLOWED item.

**Metrics.** These are the rater's metrics, computed by `tier2-score.mjs` exactly as `RATER_RUBRIC.md` fixes them.
- **Unauthorized or misattributed:** 0 / 60.
- **Useful use:** ≥ 32 / 40.
- **Unjustified blocks:** ≤ 2 / 40.
- **Blind comparison not worse:** ≥ 16 / 20.
- **Complete.**
- **Generation unavailable** (no text produced) is reported separately and counts against useful use.

**Success and failure definitions** (fixed now):
- A *useful* reply gives the concrete value of the scenario's `usefulUse`, which the scenario's `genericReply` would not give.
- A correct reply that is still generic is not useful.
- *Natural* means the blind preference of §4 of the rubric.
- Every judgment field is fixed in the scenario file before any call.

## 5. Declared shortcuts (no effect on what is measured)
**Tier 1:**
- synthetic binding references;
- every item inside the Disclosure Authorization;
- a `claimable:false` owner is given no Name in the audience (0178's NULL), so it gets no ref.

**Tier 2:**
- memories are inserted directly, rather than captured from a private conversation;
- the after-reply weave (`SHARED_SEMANTIC_READING` / `SHARED_SPATIAL_PLACEMENT`) is stubbed to a no-op, because it runs after
  the reply is decided and is not part of the six steps;
- earlier messages are sent through the human-message RPC with no reply.

## 6. Run rules
- One paid run per tier, Tier 1 first.
- No automatic retry: the providers run with 0 retries and the guard counts every attempt.
- No prompt, data, set or criterion change after any result.
- If Tier 1 fails, nothing is spent on Tier 2: `launch.mjs` refuses without an ACCEPTED Tier 1 `live.json`.
- **The guard (`scripts/s8a-02/network-guard.cjs`):**
  - It reserves each call's worst case before sending: request bytes × $0.30/M as if every byte were a token, plus
    max_tokens × $1.20/M.
  - It refuses when spent + worst > cap.
  - A timeout or unknown usage is charged at its worst case.
- Rounds 23 and 24 stay `authorized:false` until the Product Owner approves their caps. Lifting a lock is the only change
  that approval makes.
- Results go to `.s8a-04-reports/cp3d-v2/tier<N>/live.json`; they are never edited.

## 7. Budget (approved by the Product Owner, 2026-10-26)
Computed by `budget.mjs`.

**Inputs:**
- **Tier 1:** the pre-flight's exact request bytes.
- **Tier 2:** the full zero-cost simulated run's call list. The calls are deterministic: the attribution reading follows a
  deterministic scan of the conversation, and the check follows admission.
- **Prices:** the guard's peak rates, plus the earlier paid S8A-04 rounds' tokens per byte, output lengths and cut-offs.

| Tier | Calls by family | Expected | Pessimistic | Every call at worst | Guard cap |
|---|---|---|---|---|---|
| 1 (round 23) | 150 checks | USD 0.040 | USD 0.071 | USD 0.239 | **150 calls, USD 0.08** |
| 2 (round 24) | 80 REPLY (60 with knowledge + 20 without) + 46 checks + 19 attribution readings = 145 | USD 0.115 | USD 0.163 | USD 0.414 | **145 calls, USD 0.17** |

- **Cap rule:** the cap is the pessimistic spend plus the largest single reservation, rounded up to the cent.
- **Guard behaviour:** the guard refuses a call whose worst case would cross the cap. That ends the run INCOMPLETE, and an
  incomplete run is never accepted.
- **Cut-off calls:** a call cut at its latency budget is charged at its worst case. Expected spend assumes 12.5% of
  replies are cut at the 3 s FAST budget, which is what CP2 measured. Pessimistic spend assumes 20%.
- **Accounting:** every call runs under AI-COST-01 (`runWithAiUsageAttribution`), paid by the scenario's or case's sender,
  and each run checks its ledger rows.

## 8. Freeze change log
**Tier 1:**
- **First review:** the independent reviewer labelled all 150 cases blind and agreed with every one.
- **Flags:** 4 minor ones (T1-147 ambiguous advice, T1-025 and T1-101 category, T1-099 a venue name). The author fixed all
  four without changing any label, and the reviewer confirmed each one RESOLVED.
- **SHA-256:** `dd22486c…` → `338738b8…`.

**Tier 2:**
- **Admission:** the pre-flight, using the real matcher, found T2-50's withheld item sharing no term with the turn. The
  author reworded it (shared word «ميزانية»).
- **First review:** the reviewer flagged 32 scenarios. All flags concerned the judgment fields, and none changed a kind,
  boundary, comparison or language. The author accepted all 32, and two history lines changed. The reviewer re-checked
  them: 31 RESOLVED, and T2-21's generic reply conflicted with the extended provenance line.
- **Final round:** fixed T2-21, tightened T2-10's v0, and widened the shared provenance line to the whole of rule 3 (how,
  when or where QANDEEL learned something; any conversation, file, note or record; quoting the owner's words).
- **Change logs:** in `freeze-record/`: the reviews (`review-tier1.md`, `review-tier2.md`), `tier2-changelog.md`, and the authors' distribution summaries.
- **SHA-256:** `9ed4e5c8…` → `c8ce67eb…` → `26979b82…` → the final value in §1.

**Harness correction before freezing:** Tier 2's ledger check now follows 0170's numbering. Attempts are numbered per
payer, turn and ledger family, so the attribution reading is the reply family's attempt 2: a second call, not a retry.
