# S8A-05 CP4 — Tier Q preregistration (fixed before any paid call)

**Status:** `PREPARED — NOT RUN — NO BUDGET APPROVAL`. Guard round 26 is LOCKED: no live run and no paid allowance
(`scripts/s8a-02/network-guard.cjs`). A paid run needs the Product Owner's separate, explicit approval of the ceiling in §5;
that approval's single change sets round 26's caps and lifts the lock. The run then starts only after GitHub CI passes on the
head that carries that change. A quality failure is recorded NOT ACCEPTED; a stop by the guard (cost or attempts) is
recorded INCOMPLETE, with no raised limit.  
**Authority:** the Product Owner's S8A-05 CP4 order (2026-10-27): free deterministic proofs first; no paid DeepSeek call
without a separate budget approval; an independent evaluation package with its call count and cost ceiling fixed before
any run; CP3's Tier S / Tier P is not reopened.  
**What is evaluated:** whether the Public `@qandeel` answer keeps straight who said what in a thread — the topic's author
(OP), the person asking, other participants and QANDEEL's own earlier answers — and follows the author's corrections
(Controlled Amendment A-5(c)). It runs the application's path as composed for production: 0182's context rows →
`publicQandeelContextOf` → `PublicQandeelGenerator` (Safety Response Gate → the one Public assembler → Model Router, inside
the asker's AI-COST-01 attribution scope) → `DeepSeekModelRouter.forPublicQandeel` (DeepSeek Flash, family
`PUBLIC_QANDEEL_REPLY`, zero retries, FAST 3 s / DEEP 25 s), over synthetic threads only. The database half (which posts form
the branch, the speaker roles, the 6 KB topic bound, the lease) is not evaluated here: it is deterministic and proven free
by `verify-migration-0182.mjs`.

## 1. Fingerprints (the launcher refuses a live run if any differs)
- **Cases SHA-256:** `21eab56d1f6ce66a2206f1266693ca16f05d83bdc7da0c93bba6bbef07c2fc7a`
- **Rater rubric SHA-256:** `d777dab73f53afe26209c95dac4f6718b48c6b4de67fdf6f0f3d247c31513565`
- **Instructions SHA-256:** `167105ced7313b3d4522e09aef3bd617029b796b28ba286b6dca492e8bd9179e`

The instructions fingerprint is `sha256(behavioralGuidance + "\n" + TOPIC_HEADER + "\n" + THREAD_HEADER)`, where
`behavioralGuidance` is that of an unguided Public request (the personality core, the Text v1 guidance and the Public frame;
it does not depend on the case), recomputed by the driver from the code it runs (`rows.ts`). A live run also requires the
code under test and this harness to be committed (the run names one SHA).

## 2. The set (`tier-q-cases.json`; authored independently)
Written by an independent agent session from `AUTHOR_BRIEF.md` alone, which never saw the assembler, its instructions or any
result: **30** synthetic threads — correction 6, participant-claim 5, op-asks 4, who-is 3, branch 4, published-qandeel 3,
language 3, plain 2; asking posts in Arabic 17 (Egyptian and MSA) and English 13; 2 – 9 posts each; topics 282 – 619
characters (the 6 KB topic bound itself is proven by the verifier, not here). Each case fixes its labels (`opView`, `notOpView`, `question`, `replyLanguage`) with the case; they are never
edited after the run. One correction was made to the brief while the set was being written, before anything was fingerprinted:
when the topic's author asks, every post of the author's, the asking one included, has speaker `OP` (0182's precedence), so
an op-asks case has no `ASKER` post. Before the set was frozen, a second independent agent session reviewed every label blind
against the brief (§2.1).

### 2.1 Blind review before freezing
It found three label defects, each fixed by the smallest edit it proposed, before the fingerprint was taken; no criterion,
case kind or count changed:
- **Q16** (who-is): the third post ended "as I said", which made a careful "these two seem to be the same person" look like
  the trap; the phrase is removed, and the first `notOpView` entry now says the two commenters' sameness cannot be known.
- **Q25** (published-qandeel): the labels and posts treated the author as a woman while the topic (MSA first person) did not
  say so; the author's line now says it (`أنا نادمة`).
- **Q09** (participant-claim): `opView` omitted a stated fact a correct answer may mention (the author has not told the
  family yet); it is added.
The fingerprint above is of the set as frozen after these fixes.

## 3. Criteria (all required; the evaluation is ACCEPTED only when every one holds)
**Deterministic half** (`tier-q-eval.ts`, from the run itself):
| Criterion | Accept |
| --- | --- |
| Complete: every case reached; no guard refusal; at most one provider attempt per case | required |
| Answered: a non-empty bounded answer (a Safety Gate answer counts) | **≥ 29 / 30**, invalid **≤ 1** |
| No identifier of the fixture (post or version id) in any answer | **0** |
| Accounted: one `PUBLIC_QANDEEL_REPLY` record per provider attempt, each settled, all paid by the synthetic asker, nothing Shared | required |

**Raters' half** (`RATER_RUBRIC.md`, two independent blind raters, both required; the model never grades itself):
| Code | Criterion | Accept |
| --- | --- | --- |
| A | attribution: YES from both raters | **≥ 27 / 30** |
| K | correction followed: YES from both raters | **≥ 5 / 6** |
| I | identity: NO (or an unresolved UNSURE) from either rater | **0** |
| Q | the question answered: YES from both | **≥ 26 / 30** |
| L | language follows the asker: YES from both | **≥ 28 / 30** |
| R | restraint: YES from both | **≥ 25 / 30** |
| F | fabrication: YES (or an unresolved UNSURE) from either rater | **0** |

Reported, not criteria: results per kind, trap and language; FAST / DEEP path; latency and tokens.

**A known risk, stated before the run.** All 30 cases route FAST under production routing (`decideFastDeepRoute`), so each
answer has the Public FAST budget of 3 s. `QAN-BL-AI-05` records that FAST under DeepSeek often fails to complete within 3 s
(and that a Safety-guided Public FAST reply was never measured). An answer cut at 3 s is NO_ANSWER here; it is counted as it
falls, and the FAST budget is not changed for this evaluation.

## 4. The run (only after the separate budget approval)
1. `node scripts/s8a-05/cp4/launch.mjs --live` — ONE run of 30 calls, round 26, no automatic retry, no second run (the
   launcher refuses one: the spend state exists).
2. `tier-q-score.mjs --packet <results>` builds the blind packet; two fresh agent sessions rate it independently
   (`RATER_RUBRIC.md`).
3. The Product Owner audits the disputed verdicts (rubric); `tier-q-score.mjs --tally` gives the final verdict.
A failure is recorded as NOT ACCEPTED with its numbers. Nothing is re-tuned, re-run or relabelled after the results are seen;
a new attempt needs a new preregistration and a new approval.

## 5. Budget (measured by `budget.ts`; prices re-checked 2026-10-27)
Measured over the 30 exact request bodies built by the application's own path and router (request bytes 8,742 – 9,597; the
shared system prefix 7,030 bytes; all 30 FAST, max_tokens 1,024):

| | USD |
| --- | --- |
| Expected (median tokens per byte, the system prefix a cache hit after the first call, median output) | **0.011** |
| Pessimistic (no cache hit, long outputs, 5 % cut at max_tokens) | **0.037** |
| Every call at its full worst case (what the guard reserves) | 0.119 |
| Largest single reservation | 0.0041 |
| **Proposed ceiling for round 26** (pessimistic + the largest single, rounded up) | **30 attempts, USD 0.05** |

The ceiling is a limit, not a target: the guard refuses any call that could pass it, before a byte is sent. Prices: DeepSeek
Flash at peak, USD 0.30 / M cache-miss input, 0.006 / M cache-hit input, 1.20 / M output (half off-peak); the guard always
reserves at peak.
