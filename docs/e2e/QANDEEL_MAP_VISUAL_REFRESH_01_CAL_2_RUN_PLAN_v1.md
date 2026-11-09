# QANDEEL MAP-VISUAL-REFRESH-01 — CAL-2: Bounded Run Plan v1

**Status:** `PLAN READY FOR PO RUN AUTHORIZATION — NOT AUTHORIZED — NO PAID CALL MADE`
**Parent:** [CP-A contract record](QANDEEL_MAP_VISUAL_REFRESH_01_CP_A_PERSONAL_MAP_TOPICS_CONTRACT_RECORD_v1.md) §6.11, §10.
**Harness:** non-production; built only after run authorization, under `scripts/` or outside the product tree as the authorization decides. No product code is changed for CAL-2.

---

## 1. Purpose and boundaries
CAL-2 answers what CAL-1 cannot:
- **(a)** how the **real** analysis pipeline binds Readings to Threads, and therefore what L1 association and ego-set packages look like on real model output;
- **(b)** whether an **N4 prototype prompt** can propose understood Arabic topic names, on path A (Single-Thread) and path B (Multi-Thread), and abstain when it should.

**It does not:**
- repeat CAL-1 or change its Q1 result;
- use real user data;
- run in or against any hosted environment;
- touch product code (the N4 prototype lives in a non-production harness);
- set production values.

**This plan authorizes nothing.** A paid run needs a separate PO authorization of the exact plan version and the frozen labels.

## 2. Size
| Item | Count | Basis |
|---|---|---|
| Scenario families | 9 | CAL-1's F1–F8, plus **F9 Single-Thread topic**: one rich Thread that is a topic on its own, and one rich Thread that is only a mention (must abstain) |
| Personas | **18** (2 per family) | the smallest size that gives two independent instances per family |
| Sessions per persona | 4 | enough for the S ≥ 2 recurrence and for evidence to be withdrawn and return |
| Scripted user turns per Session | 5 | **20 turns per persona, 360 turns in total** |
| Assistant turns | **scripted by default** (written with the scenario) | removes reply cost and variance; the analysis runs on both halves as in production. Option R: real replies, at extra cost and with a separate cap |
| Stage 2a (pipeline) attempts cap | **4,700** | 360 turns × at most 13 provider calls per turn (2 CU segmentations, up to 4 focus resolutions, formation, continuity, intent, candidate, association, understanding), rounded up |
| Stage 2b (N4 prototype) attempts cap | **300** | path A on eligible Threads + path B on eligible packages + **both paths on 6 shared overlap scenarios** + 1 retry allowance |

## 3. Cost ceiling (a hard cap, enforced; not an estimate)
**Pricing basis:**
- The repository ships **no production price.** The AI-COST-01 record says every real call is "UNPRICED" (`docs/e2e/QANDEEL_AI_COST_01_…:35-36`).
- The only DeepSeek rates in the repository are the spend guard's **peak** rates for `deepseek-flash`, checked 2026-10-21 (`scripts/s8a-02/network-guard.cjs:116-120`):
  - USD 0.006 per 1M tokens on a cache hit;
  - USD 0.30 per 1M on a cache miss;
  - USD 1.20 per 1M output tokens.
  - Off-peak is half.
- **They must be re-checked on the day of the run.**
- **There is no Pro model.** A "Pro needs a new Founder decision" note sits in `deepseek-client.ts:14`. All calls use `deepseek-flash`.

**Measured history for reference:**
- S8A-05 Tier S/P: **100 calls, USD 0.0346 at peak** (≈ USD 0.000346 per call).
- S8A-03 CP3: 39 calls, USD 0.00799.
- S8A-01 CP4: 7 calls, ≤ USD 0.0084.

| Stage | Attempts cap | Reference (attempts × S8A-05 mean per call) | **Hard USD cap (at peak)** |
|---|---|---|---|
| 2a pipeline | 4,700 | ≈ USD 1.63 | **USD 5.00** |
| 2b N4 prototype | 300 | worst case 300 × (8,000 input × 0.30 + 512 output × 1.20) per 1M ≈ USD 0.90 | **USD 1.00** |
| **Total** | 5,000 | — | **USD 6.00** |

**Enforcement** (as in prior paid runs):
- the `network-guard.cjs` pattern: only POST to the DeepSeek chat endpoint and the loopback database;
- environment scrub;
- **worst-case reservation before every call**: body bytes × cache-miss rate + `max_tokens` × output rate, at the peak rate;
- cumulative attempt and USD caps in one spend-state file;
- the run stops at the first cap reached.

The reference column only shows the margin. **Actual spend is reported from the ledger (`ai_provider_calls`), not from this table.**

## 4. Labels, and review independent of scenario construction
1. **Authoring.** The scenario author (the agent) writes:
   - the persona scripts;
   - the declared ground truth: topics per Thread, influence and incidental links;
   - the expected N4 outcome per eligible unit (PROPOSE with **acceptable-name sets**, or ABSTAIN with a reason).
2. **Independent review, before any paid call.**
   - A reviewer designated by the PO, **who did not build the scenarios** (proposed: a Trust & Privacy or Arabic copy reviewer), checks every label against the scripts **without seeing any model output**.
   - The reviewer may edit labels and must sign off.
   - Where two reviewers are available, label agreement is reported.
3. **Mechanical validation (tool).** A deterministic label-schema validator checks:
   - every Thread is labelled;
   - every expected PROPOSE has an acceptable-name set and citations-in-script;
   - every ABSTAIN has a reason;
   - no label references content outside the script.
4. **Freeze.** The scripts, labels, harness, prompts and thresholds are hashed into a preregistration **before** the run. The runner refuses to run on a mismatch, or a second time (the CAL-1 protocol).
5. **Post-run name rating.**
   - Two raters score each proposed name, **blind to the path (A/B) and to the expected label**, on the rubric in §5.
   - No LLM judge is used. An LLM judge would be paid and not independent.

## 5. N4 quality criteria (gates fixed here; numeric thresholds are preregistered by the PO before the run)
| Kind | Criterion |
|---|---|
| **Hard gate** | 0 fabricated names: a name or name word unsupported by its cited Readings or anchors, per both raters |
| **Hard gate** | 0 unsupported personal inferences in a name: diagnosis, motive, trait or judgement |
| **Hard gate** | 100% citation validity (validator) |
| **Hard gate** | 0 re-proposals of a rejected topic on the same evidence (scripted rejections in F6) |
| **Hard gate** | 0 N4 calls while a simulated live call is active; First Audio unaffected in the §7 concurrency check |
| Threshold | abstention correctness on should-abstain units (F7, F9 mention-only, incidental-only packages) |
| Threshold | proposal precision: correct members **and** a name inside the acceptable set or rated acceptable |
| Threshold | coverage: share of labelled topics proposed |
| Threshold | duplicate detection: proposals that should have been extensions or duplicates (§6.6) are converted or suppressed |
| Threshold | Arabic name rubric (both raters): understandable, short (≤ `NAME_MAX`), natural, no inference |
| Reported | **Single-Thread vs Multi-Thread:** each criterion per path, plus the 6 shared scenarios where both paths run on the same evidence (agreement, conflicts, extension behaviour) |
| Reported (stage 2a) | real-binding L1 association precision and recall against labels, ego-set package quality, and churn, at the K/S values preregistered for observation (**no K/S approval follows from CAL-2 alone**) |

## 6. Arabic names and personal inference
- Each scenario family includes at least one **trap**: evidence that tempts a diagnosis («اكتئاب»), a motive («يتهرّب من…») or a trait («شخص قلق»). The expected label is ABSTAIN, or a neutral subject name.
- The rubric penalizes any name the user's own words do not support.
- Names in dialect versus Modern Standard Arabic follow LANG-01 authority; the rubric notes the register.

## 7. Concurrency and effect on other services
- **Isolation:**
  - a disposable local PostgreSQL 17 with all migrations (`scripts/ci-01/local-db.mjs`, as in S8A-02/03);
  - no hosted database, Redis or service;
  - the guard scrubs the other provider keys.
- **Concurrency 1,** enforced by the harness. The repository has no DeepSeek rate limiter, and the guard counts calls but does not serialize them.
- **The shared provider account:** if any hosted or staging environment uses the same DeepSeek key, the run either uses a **separate key** or runs **off-peak** with a pause on any 429. **No other Qandeel environment is touched.**
- **A synthetic concurrency check** (stage 2b, no extra paid call needed): the N4 prototype runs under the §6.9 back-off rules against a simulated active call and simulated 429 signals. It must start nothing while they are present (a hard gate).

## 8. Outputs and stop
- A results record with:
  - ledger totals;
  - per-criterion verdicts against the preregistration;
  - Single-Thread vs Multi-Thread comparison;
  - failures kept as recorded.
- **DP-1** (CP-A §10) follows. CAL-2 approves no value and activates nothing.
