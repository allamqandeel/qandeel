# S8A-05 CP3 — Tier S / Tier P preregistration (fixed before any paid call)

**Status:** `PREPARED — NOT RUN — AWAITING THE PRODUCT OWNER'S EXPLICIT BUDGET APPROVAL`. Guard round 25 is locked (no live
run, no paid allowance) until that approval; lifting the lock and setting its caps is the single change the approval makes.  
**Authority:** the Product Owner's S8A-05 CP3 order (2026-10-27): prepare the paid evaluation fully; ask for explicit approval
of the ceiling before any paid call; one preregistered run; a failure stays NOT ACCEPTED. The criteria are WP1 §5.4 with the
WP1-R1 correction: a compound is tested by its dominant region plus its secondary meanings, never as "between regions".  
**What is evaluated:** the production adapter `DeepSeekPublicSemanticInterpreter` (DeepSeek Flash, JSON Output, closed schema,
zero retries) as composed for production, over synthetic packages only. The placement rule itself is not evaluated here:
it is deterministic and proven free (verifier 0181, `placement-sim.mjs`).

## 1. Fingerprints (the launcher refuses a live run if any differs)
- **Cases SHA-256:** `eb96016369a52cae8230059dd1faa098019f3b16ae85c8520319c1091af14541`
- **Rater rubric SHA-256:** `0d4164fb4ec730f501de0f01f918250cb3163a4117b619db8828c50e5e2d5dce`
- **Instructions SHA-256:** `afbb988f3796d22455e89cd11ccf0f3fc16c5e7987e62954878d41883b5921c0`
- **Adapter git blob:** `d5eedac546ccd570df63858dd44242ed77bf63fd` (`apps/api/src/public-world/deepseek-public-semantic-interpreter.ts`;
  also pinned by the AI-COST-01 contract)

The instructions fingerprint is `sha256(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS + "\n\n" + PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS)`,
recomputed by the driver from the code it runs. A live run also requires the code under test and this harness to be
committed (the run names one SHA).

## 2. The set (`tier-s-cases.json`; authored independently)
Written by an independent agent session from `AUTHOR_BRIEF.md` alone, which never saw the adapter, its instructions or any
result: **80** synthetic packages (40 authored, 30 conversation, 10 earlier-kind; Egyptian Arabic, MSA, English, mixed;
every major at least 4 times; 10 compounds; traps: section labels, injected instructions, thin topics, near misses, long
conversations, QANDEEL-heavy packages), **20** corrections (10 fair, 10 unsupported) and **40** triplets over the 80 cases.
The labels are fixed with the cases and are never edited after the run. Before the set was frozen, a second independent agent session reviewed every label, correction and triplet blind against the brief: it found one defect (S59, a compound whose QANDEEL question steered which meaning came first), fixed by a two-line edit of that package (a neutral question; the closing line leads with the dominant meaning), with its labels unchanged. The fingerprint below is of the fixed set.

## 3. Criteria (all required; the evaluation is ACCEPTED only when every one holds)
**Deterministic half** (`tier-s-eval.ts`, from the run itself):
| Criterion | Measure | Accept |
| --- | --- | --- |
| Major | the dominant sub-region's major is the case's expected major (or one of a thin case's acceptable majors) | **≥ 72 / 80 (90 %)** |
| Sub-region | the dominant sub-region is one of the case's expected sub-regions (thin cases excluded) | **≥ 75 %** of the scored cases |
| Corrections, fair | `CONSISTENT` | **≥ 9 / 10** |
| Corrections, unsupported | `NOT_SUPPORTED_BY_PACKAGE` | **≥ 9 / 10** |
| Tier P similar-closer | with every proposal placed by the exact P-dom mirror in the case order, the anchor is strictly closer to `similar` than to `different` | **≥ 34 / 40 (85 %)** |
| Compounds, dominant | the compound's dominant sub-region is in its expected (dominant) major | **≥ 8 / 10** |
| Invalid | provider error, timeout or an answer the strict decoder refuses (each counts as wrong wherever it is scored) | **≤ 2 / 100** |
| Complete and accounted | every request made exactly one attempt; no guard refusal; one `PUBLIC_SEMANTIC_INTERPRETATION` record per attempt, paid by the synthetic publisher, nothing Shared | required |

**Raters' half** (`RATER_RUBRIC.md`, two independent blind raters, both required; the model never grades itself):
| Criterion | Accept |
| --- | --- |
| Fidelity: F = YES from both raters | **≥ 72 / 80** |
| Fabrication: A = YES (or an unresolved UNSURE) from either rater | **0** |
| Compounds keep their secondary meaning: C = YES from both raters | **≥ 8 / 10** |

Reported, not criteria: language per language, results per trap and per kind, whether a fair correction's profile stays in
the case's major, the compounds' secondary sub-region in the profile, latency and tokens.

## 4. The run
1. `node scripts/s8a-05/cp3/launch.mjs --live` — ONE run of 100 calls (80 proposals, then 20 assessments), round 25, no
   automatic retry, no second run (the launcher refuses one: the spend state exists). Tier P makes no call.
2. `tier-s-score.mjs --packet` builds the blind packet; two fresh agent sessions rate it independently (`RATER_RUBRIC.md`).
3. The Product Owner audits the listed verdicts (rubric §4); `tier-s-score.mjs --tally` gives the final verdict.
A failure is recorded as NOT ACCEPTED with its numbers. Nothing is re-tuned, re-run or relabelled after the results are
seen; a new attempt needs a new preregistration and a new approval.

## 5. Budget (measured by `budget.ts`; prices re-checked 2026-10-27)
Measured over the 100 exact request bodies built by the application's own builders (request bytes 9,020 – 11,105; the shared instruction prefix 8,905 / 8,574 bytes; max_tokens 1,024):

| | USD |
| --- | --- |
| Expected (median tokens per byte, the instruction prefix a cache hit after the first call, median output) | **0.034** |
| Pessimistic (no cache hit, long outputs, 2 % cut at max_tokens) | **0.127** |
| Every call at its full worst case (what the guard reserves) | 0.411 |
| Largest single reservation | 0.0046 |
| **Proposed ceiling for round 25** (pessimistic + the largest single, rounded up) | **100 attempts, USD 0.14** |

The ceiling is a limit, not a target: the guard refuses any call that could pass it, before a byte is sent. Prices: DeepSeek Flash at peak, USD 0.30 / M cache-miss input,
0.006 / M cache-hit input, 1.20 / M output (half off-peak); the guard always reserves at peak.
