# QANDEEL MAP-VISUAL-REFRESH-01 — CAL-2: Bounded Run Plan v1

**Status:** `PLAN READY FOR PO RUN AUTHORIZATION — NOT AUTHORIZED — NO PAID CALL MADE`
**Parent:** [CP-A contract record](QANDEEL_MAP_VISUAL_REFRESH_01_CP_A_PERSONAL_MAP_TOPICS_CONTRACT_RECORD_v1.md) §6.11, §10.
**Revision:** **R1 (2026-11-10)**, after the PO review of Draft PR #388. It adds:
- the preconditions for any paid call (§9);
- the overlap units (§5.1);
- the ST / RT distinction (§7, §9.6);
- the INCOMPLETE rule (§9.5).

**Size and the USD 6.00 cap are unchanged.**
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
| Stage 2b (N4 prototype) attempts cap | **300** | path A on eligible Threads + path B on eligible packages + **both paths on 6 shared overlap scenarios** + the overlap units of §5.1 (drawn from the existing F3 and F8 personas; **no persona is added**) + 1 retry allowance |

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

## 5. N4 quality criteria (gates fixed here; the proposed numeric thresholds are in §9.3, for the PO to set before the run)
| Kind | Criterion |
|---|---|
| **Hard gate** | 0 fabricated names: a name or name word unsupported by its cited Readings or anchors, per both raters |
| **Hard gate** | 0 unsupported personal inferences in a name: diagnosis, motive, trait or judgement |
| **Hard gate** | 100% citation validity (validator) |
| **Hard gate** | 0 re-proposals of a rejected topic on the same evidence (scripted rejections in F6) |
| **Hard gate** | 0 N4 requests admitted while the simulated gate is closed (**ST only**, §7). **CAL-2 does not measure First Audio** |
| **Hard gate** | overlap: 0 memberships removed by a `DISTINCT_FROM` proposal; 0 true duplicates admitted; every injected O-4 fixture rejected by the validator (§5.1) |
| Threshold | abstention correctness on should-abstain units (F7, F9 mention-only, incidental-only packages) |
| Threshold | proposal precision: correct members **and** a name inside the acceptable set or rated acceptable |
| Threshold | coverage: share of labelled topics proposed |
| Threshold | duplicate detection: true duplicates (CP-A §6.6) are suppressed, even when the fingerprint differs |
| Threshold | overlap relation: on overlap units, the `EXTENDS` / `DISTINCT_FROM` / `SAME_AS` choice matches the label (§5.1) |
| Threshold | Arabic name rubric (both raters): understandable, short (≤ `NAME_MAX`), natural, no inference |
| Reported | **Single-Thread vs Multi-Thread:** each criterion per path, plus the 6 shared scenarios where both paths run on the same evidence (agreement, conflicts, extension behaviour) |
| Reported (stage 2a) | real-binding L1 association precision and recall against labels, ego-set package quality, and churn, at the K/S values preregistered for observation (**no K/S approval follows from CAL-2 alone**) |

### 5.1 Overlap units (R1; CP-A §6.1)
They are drawn from the F3 (overlapping topics) and F8 (star with a bridge) personas already in §2. Each unit gets a label, written and reviewed under §4.

| Unit | Situation | Expected |
|---|---|---|
| **O-1 Extension** | a topic exists; new Threads about **the same subject** share cited Readings with its members | `EXTENDS(topicId)`; a `MEMBER_PROPOSED`; nothing changes without acceptance |
| **O-2 Distinct topic through a shared Thread** | a Thread in topic X is also part of **a different subject** with other Threads, with evidence of its own | `DISTINCT_FROM(X)`; a new proposal; the Thread **keeps** its membership in X |
| **O-3 True duplicate, new fingerprint** | the same subject and members come back after new Readings arrive | `SAME_AS` or suppressed; **no second topic** |
| **O-4 False distinctness** (validator only, no model call) | a `DISTINCT_FROM` fixture citing only X's basis | rejected by validation |

**Minimum:** 2 units each of O-1, O-2 and O-3 per family (12 model units), plus O-4 fixtures. All are mandatory (§9.5).

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
- **ST, a synthetic scheduling test** (stage 2b; no extra paid call):
  - The N4 prototype runs under CP-A §6.9 against simulated signals: an active call, a 429, and a full N4 slot.
  - It must admit nothing while the gate is closed, and it must re-check the gate before sending (a hard gate).
  - **This is ST only.** It proves the gate's logic. **It does not measure First Audio, provider behaviour, or isolation.**
- **RT is outside CAL-2.** RT is the real-call performance test of CP-A §6.9. It needs its own authorization and cost cap, and it is a precondition of N4 activation. No CAL-2 result is ever reported as isolation evidence.

## 8. Outputs and stop
- A results record with:
  - ledger totals;
  - per-criterion verdicts against the preregistration;
  - Single-Thread vs Multi-Thread comparison;
  - failures kept as recorded.
- **Verdict.** The run as a whole is exactly one of:
  - `PASS`;
  - `FAIL`;
  - `INCOMPLETE` (§9.5);
  - `INVALID` (§9.5).

  Each criterion has its own verdict, and a criterion whose raters or data are missing is `NOT RUN`.
- **DP-1** (CP-A §10) follows. CAL-2 approves no value and activates nothing.

## 9. Preconditions before any paid call (R1)
**All must be evidenced and recorded in the preregistration before the PO authorizes the run.** None is met today.

### 9.1 Spend-guard proof (free; status `NOT PROVEN`)
A recorded run of the harness guard, using the guard's simulated-cap mode (the `simulatedCaps` path of `scripts/s8a-02/network-guard.cjs`), with no network beyond loopback. It must show:
- any request to a host other than the DeepSeek chat endpoint and the loopback database is refused;
- the worst-case cost is reserved before every call;
- the attempt cap and the USD cap each stop the run at the first breach;
- the spend-state file survives a restart and is never reset by one;
- a second concurrent request is refused (concurrency 1);
- reaching a cap ends the run as `INCOMPLETE`, never `PASS`.

### 9.2 Price review on the run day
1. On the day of the run, read the provider's official pricing page. Record the rates, the UTC time, the URL and the model id (`deepseek-flash`) in the preregistration.
2. The guard uses the **higher** of the recorded rates and its own, always at the peak rate.
3. If, at the recorded rates, the worst-case reservation for the mandatory units (§9.5) exceeds a stage's USD cap, **the run does not start.** The caps are never raised without the PO.

### 9.3 Numeric acceptance thresholds (proposed; the PO sets them before the run)
| Criterion (each per path, A and B) | Proposed |
|---|---|
| abstention correctness on should-abstain units | ≥ 0.90 |
| proposal precision | ≥ 0.80 |
| coverage | ≥ 0.60 |
| true-duplicate suppression | ≥ 0.95 |
| overlap relation correctness (§5.1) | ≥ 0.80 |
| name acceptability, by both raters | ≥ 0.85 |
| rater agreement on names (Cohen's κ) | ≥ 0.60. Below it, the name criteria are `INCONCLUSIVE`, never `PASS` |

- Hard gates stay at 0 / 100 %.
- A verdict is taken on the point estimate, and the Wilson 95 % interval is reported beside it.
- With 18 personas, results are evidence for DP-1 only, **never a production approval.**
- Stage 2a has no thresholds. It is reported only, and Q1 is not changed.

### 9.4 Independent reviewers, and how their labels are approved
**Roles,** named by the PO in the run authorization:
- one or two **label reviewers**;
- two **name raters**.

**Eligibility:**
- No role may be filled by the scenario author (the agent).
- Every role needs fluent Arabic, including register (LANG-01).
- Label reviewers never see model output.
- **Raters are not label reviewers,** because they would know the expected labels. Raters are blind to the path and to the expected label.

**Tools:**
- The deterministic label validator (§4.3) is a tool, not a reviewer.
- No LLM judge is used.

**Approval method:**
1. Each reviewer works independently.
2. Every edit is recorded as a diff against the author's labels, with a reason.
3. Where two reviewers disagree, the PO adjudicates, and agreement is reported.
4. Sign-off records each reviewer's name or role, the date, and the sha256 of the final label file in the preregistration. The runner refuses any label file whose hash differs.

**If the PO cannot designate** the reviewers or raters, the run is not authorized. A criterion that has no raters is `NOT RUN`, never `PASS`.

### 9.5 Mandatory units, INCOMPLETE and INVALID
**Mandatory units** are:
- every hard-gate unit;
- ≥ 2 units per family and per eligible path;
- the 6 shared A/B scenarios;
- the overlap units O-1..O-4;
- the F6 scripted rejections.

**Rules:**
- **Order:** the runner schedules mandatory units first within each stage.
- **INCOMPLETE:** if an attempt or USD cap is reached before every mandatory unit completes, the run is `INCOMPLETE`. It is **never `PASS`**, whatever the completed units show, and partial figures are reported as partial.
- **INVALID:** a guard breach, a hash mismatch, or a second run makes the run `INVALID`.

### 9.6 ST is not RT
| | **ST: synthetic scheduling test** | **RT: real-call performance test** |
|---|---|---|
| Where | inside CAL-2 (§7) and later in CP-E | outside CAL-2; before N4 activation |
| Provider | none (simulated signals) | real providers, synthetic users, local or test environment |
| Proves | the gate, slot and abort logic | the First Audio difference ≤ `ΔFA` and no rise in live-path errors |
| Never proves | First Audio, provider behaviour, isolation | anything about N4's naming quality |
| Cost | 0 | its own authorization and cap (not in the USD 6.00) |
