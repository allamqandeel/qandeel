# INTEL-LIVE-01 — Incremental In-Speech Understanding & Living Map Attention: Execution Record v1

**Status:** `INTEL-LIVE-01 CP1 DELIVERED / READY FOR PO REVIEW — A8′ SEMANTIC GATE: RECALL MET (21 / 21), FALSE-UPDATE CLAUSE AWAITS THE HUMAN ADJUDICATION (14 unannotated events) — NOT MERGED — NOT DEPLOYED — CP2 – CP4 NOT STARTED`
- Draft PR "INTEL-LIVE-01 CP1 — continuous in-speech understanding (provisional attention lane)" from `intel/intel-live-01`,
  stacked on Draft PR #414 (the CP0 docs commit `53429017`, itself on `main` at `aa6fc0c8`).
- Merging needs the Product Owner's explicit «ادمج». Migration `0204` is **not hosted**; the next migration is `0205`.
- The lane is **OFF** unless `LIVE_CALL_PROVISIONAL_ATTENTION=ON`; every voice gate stays `DISABLED`.

**Product readiness (carried in every record from CP1 on, CP0 v1.1 §8.2):** DeepSeek is `SYNTHETIC_ONLY`; synthetic
acceptance proves the mechanism, not the product; the product gate is the HONOR Live + Replay proof (the Product Owner's
sequence, step 3).

**Backlog:** inherits and admits `QAN-BL-INTEL-06` (`HIGH`), transferred verbatim from Draft PR #410 and set
`DEFERRED — OWNED` by this task (CP0 v1.1 §8.2): reopen condition CP4 delivered, close condition the HONOR Live + Replay
proof recorded. CP4 moves it to `VALIDATION — OPEN`. No other item is admitted, re-owned or closed at CP1.

**Authority (binding in this order):**
- The Product Owner's "INTEL-LIVE-01 — Final PO Execution Authorization" (2026-11-25): D-2 and D-4 approved; D-7 paid
  ceilings Speechmatics USD 0.30, DeepSeek USD 0.30, combined USD 0.60; D-12 and D-13 as amended in A2; "Begin CP1
  immediately"; and its mandatory acceptance interpretations (§0.1 below).
- The CP0 contract stack, carried into the repository by this change:
  [v1.0](QANDEEL_INTEL_LIVE_01_CP0_EXECUTION_CONTRACT_v1.0.md) →
  [v1.1](QANDEEL_INTEL_LIVE_01_CP0_EXECUTION_CONTRACT_v1.1.md) (C1 – C7) →
  [A1 / v1.2](QANDEEL_INTEL_LIVE_01_CP0_EXECUTION_CONTRACT_v1.2_AMENDMENT_A1_SEMANTIC_DRIVEN.md) (semantic-driven) →
  [A2](QANDEEL_INTEL_LIVE_01_CP0_ADDENDUM_A2_FINAL_EXECUTION_CONDITIONS.md) (final execution conditions).
- The gap record and the Replay compatibility annex, transferred from #410:
  [gap record](QANDEEL_INTEL_LIVE_INCREMENTAL_UNDERSTANDING_GAP_v1.md),
  [S4 / S5 annex](QANDEEL_S8B07_S4_INCREMENTAL_UNDERSTANDING_REPLAY_COMPATIBILITY_v1.md).
- The S8B-05 §5.1 controlled amendment (D-2): the [S8B-05 record](QANDEEL_S8B_05_INTEGRATED_LIVE_CALL_IMPLEMENTATION_RECORD_v1.md) §13.

This record states what changed, why, what was deliberately not changed, and how it was verified. It contains no secret,
credential, transcript of a real person or hosted identifier. Every conversation in it is synthetic.

---

## 0. The checkpoint plan and where CP1 stands

| Checkpoint | Scope (contract) | State |
|---|---|---|
| **CP1** | The producer: migration `0204`, the lane, its wiring, the proofs A0 – A12 and A8′ | **DELIVERED / READY FOR PO REVIEW** (this record) |
| CP2 | The live map: Live Call protocol v3 (additive), the phone's consumption, B5′ / B6 (successful live disclosure) | not started |
| CP3 | Replay Lane B: the producer's events on Replay's clock, the §19 placement policy | not started |
| CP4 | Closure (BG-08 / BG-09), measured cost restated, `QAN-BL-INTEL-06` → `VALIDATION — OPEN` | not started |

### 0.1 The Product Owner's mandatory acceptance interpretations, and where each is met

| Interpretation | Where |
|---|---|
| DeepSeek remains the semantic authority | the tracker owns coverage and order only; the evaluator decides every development (§1.2); static contract |
| Understanding continues throughout the call | one evaluation in flight per call, the next admitted the moment the previous resolves (§1.2); (k20): 390 admissions in 20 minutes, every span covered |
| No fixed time or word-count prerequisites | the configuration is backpressure and the context bound only; the static contract fails on any `minWords`, `debounce`, keyword or threshold in the tracker |
| Important developments are never silently lost | every FINAL span is covered, explicitly missed or still pending (§3.1, A1′); a failure never advances the watermark |
| A development shown only after the speech ends is not in-speech disclosure; tails reported separately | every development is classed `IN_SPEECH` or `TAIL_AFTER_SPEECH_END` by its produced instant against the turn's speech end (§3.3) |
| The context-boundary scenario exceeds the actual word window | (j): 761 words, the correction's admission no longer contains the early subject's words, carry present (§3.1) |
| Semantic recall and responsiveness on USER and QANDEEL evidence | A8′ on both tracks (§3.2); T1 – T3 and word-end → understanding (§3.3) |
| Protect Live Voice, First Audio, COSMOS | A3, A4 (§3.4); no mobile or COSMOS file changed |
| Truthful Replay timing | `anchor ≤ evidence ≤ produced` on the call clock, never backdated (A7); Replay consumes nothing before CP3 |
| The paid ceiling | Speechmatics ≈ USD 0.150, DeepSeek ≈ USD 0.121, combined ≈ USD 0.271 of 0.60 (§4) |

---

## 1. What CP1 delivers

### 1.1 Migration `0204` (`database/migrations/0204_intel_live_01_call_attention_v1.sql`)

- **The coverage ledger** `voice_private.call_attention_evaluations`: one row per admission or recorded miss, the evidence
  span it accounts for (track + call-clock range), its outcome, its instants and token counts; no text.
- **The attention events** `voice_private.call_attention_events`: SET / WITHDRAW from an evaluation, CONFIRMED / EXPIRED from
  settlement. A subject key, a label of at most 40 characters, a kind, a confidence and an optional reference to one of the
  person's own Threads. Never a transcript, an INTERIM or audio.
- **Settlement markers** `voice_private.call_attention_settlements`, one per settled half.
- **The one writer** `server_record_call_attention_evaluation_v1`: the row, its events and the watermark's advance in one
  transaction under the call's lock; fenced by the connection epoch; idempotent; a late or overlapping result is recorded and
  refused (`STALE_RESULT`, `STALE_AFTER_SETTLEMENT`, `STALE_AFTER_END`).
- **Readers** (state, Threads), **settlement** by identity (a subject is CONFIRMED when the Thread it references is one the
  durable half bound, otherwise EXPIRED) and its due-sweep, erasure coverage for all three relations, and two narrow
  widenings: the permit kind `PROVISIONAL_ATTENTION` and the cost family `LIVE_ATTENTION_EVALUATION`.
- Nothing provisional reaches CUs, Threads, Live Focus, Memory, the semantic clock or `0201`'s ledger.

### 1.2 The lane (`apps/api/src/live-attention/`)

- **`CallAttentionTracker`** — per call. Evidence units are FINAL segments (USER) and whole heard pieces (QANDEEL). One
  evaluation in flight per call; the span is ALL pending evidence of a track (a span over 600 words is admitted as whole
  sub-spans, never cut). Only `DEVELOPMENTS` / `NONE` and the explicit misses advance the watermark; `TIMEOUT` /
  `REFUSED` / `PROVIDER_FAILED` / `DEFERRED_PERMIT` leave the span pending. Backpressure: a 4 s evaluator timeout, a 5 s
  backoff after two consecutive failures, a 1 s permit retry; the `PROVISIONAL_ATTENTION` permit with the critical window
  respected and no wait. The emergency per-call spend guard is **null by default**; six consecutive capacity refusals or the
  guard put the lane in DEGRADED, recorded as `DEGRADED_SUSPENDED` rows (a product failure, never a success). A hand-over
  records `MISSED_HANDOVER` under the old epoch; a new connection starts from the database watermark.
- **`DeepSeekAttentionEvaluator`** — DeepSeek Flash behind `SYNTHETIC_ONLY`, one accounted client
  (`costLedgerDecorator('LIVE_ATTENTION_EVALUATION')` in production), the prompt in the prefix-stable order (A1 §2.3), a
  fail-closed parser (exactly the schema or `REFUSED`). Prompt version `intel-live-01-provisional-attention-v3` (§3.2).
- **`CallAttentionRepository`** (0204 RPCs only) and **`productionLiveCallAttention`** (OFF unless
  `LIVE_CALL_PROVISIONAL_ATTENTION=ON`; never bound under `NODE_ENV=test`).

### 1.3 Wiring

- **`voice/` stays provider-free and permit-free.** `live-call-attention.port.ts` imports only `@nestjs/common`; the engine
  and the reply import nothing of the lane. The conversation module registers the lane into the port's binding.
- **The engine** hands each FINAL to the lane at exactly one site (INTERIM never). A FINAL ending while QANDEEL's reply plays is
  held until the reply ends or is interrupted; one ending inside a barged reply's (start, onset] is dropped as echo. The
  only lane await on the voice path is the bounded hand-over flush.
- **`CallReply`** reports each piece the phone confirmed it played (its range ends at or before the PLAYOUT mark) as QANDEEL
  evidence, at its call-clock position.
- **The call analysis worker** settles attention after a USER or ASSISTANT half settles (fire-and-forget, never awaited on
  its queue) and sweeps due settlements on each scan.

### 1.4 Proof tools (`apps/api/scripts/intel-live-01/`)

- `corpus.ts` — the annotated synthetic corpus (a) – (k), with the recall gate set a – g, j.
- `cp1-corpus-proof.ts` — the real tracker, `0204` and the permits on a local PostgreSQL on a VIRTUAL clock; evaluator
  FAKE (the annotation oracle) or DEEPSEEK (paid, metered, ceiling-stopped).
- `cp1-first-audio-proof.ts` — A4 in real time on the S8B-05 CP3 pattern.
- `cp1-cadence-proof.ts` — A0 through the production Speechmatics adapter (paid, metered).

## 2. What is deliberately not implemented

- No protocol message, no phone change, no map change (CP2). No Replay read (CP3). No COSMOS, Lane A, endpointer or
  First Audio path change.
- INTERIM is never evaluated (D-1b not chosen).
- No hosted migration, no deployment, no gate opened, no merge.

---

## 3. Acceptance (A1 §6 as amended by A2 §6)

### 3.1 Mechanism — the fake evaluator (free; local PostgreSQL, `0204` applied to a fresh clone)

13 scenarios, every assertion passed (run `cp1-fake-r3`). Zero false updates and zero ordering errors in every scenario;
zero events unbound to their evidence.

| Item | Result |
|---|---|
| **A1′** coverage | Every FINAL span of every normal scenario covered (`DEVELOPMENTS` / `NONE`); failures never advance the watermark; each failed span is covered by a later success from the same watermark |
| (f) in-flight arrival | the development arrived while the previous evaluation was in flight and is covered by the very next admission |
| (g) tail | the last FINAL's evaluation is produced after the speech end, at its real instant; its events are settled; the Thread-less subject EXPIRES |
| (g2) / **A12** | a tail result after the durable settlement is recorded `STALE_AFTER_SETTLEMENT` and writes no event |
| (h) / **A10** | MISSED_HANDOVER under epoch 1 and under epoch 2; the old epoch's late result `FENCED`; three epochs, `eval_seq` / `event_seq` gap-free and rising; the new tracker continues from the database watermark |
| (i) outage | 15 s of TIMEOUT / REFUSED, all recorded; the 5 s backoff after two failures; the watermark unmoved; the first success after recovery covers everything since |
| **A1′-j** | 761 words before the correction (window 600); the correction's admission no longer contains the early subject's words; the carried context travels; the early subject is still open in its input |
| **A1′-k** | the guard set low: DEGRADED (`EMERGENCY_SPEND`), `DEGRADED_SUSPENDED` rows for what was not evaluated; (k20) with the default `null`, a 20-minute call never suspends and every one of its 390 spans is covered |
| (e) / **A6** | the Thread reference is the person's own Thread id; the subject whose Thread the durable half bound is CONFIRMED (identity by id), the other EXPIRES |
| **A7** | every producer event has `anchor ≤ evidence ≤ produced`; every success is produced after its admission |
| **A9** | every producer event belongs to a `DEVELOPMENTS` row; row and events are one write |
| **A11** | the crash window: a terminal half of a call with events and no settlement marker (a crash between the durable completion and the settlement) is settled by the sweep (verifier S-06); the worker sweeps on every scan and a failing settlement never fails its queue (worker spec) |
| **A2** | nothing provisional is durable outside `0204` (the static contract and the migration contract: its only write targets are its own tables, 0191's permit rows and the erasure registry) |
| **A5** | `database/verify-migration-0204.mjs` on a fresh clone: catalogue, writer, readers, settlement, erasure — passed |

### 3.2 A8′ — semantic recall with the real evaluator (paid; the recall gate a – g, j)

DeepSeek Flash, the production prompt and parser, its own latencies placed on the virtual clock. Three runs, each
recorded; the prompt was iterated twice inside the ceiling as A2 allows. The table is the agent's **provisional** reading
of the adjudication tables (`E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1/cp1-a8-r*/adjudication.md`); **the gate is judged by the
human reviewer** (subject identity is semantic; no label-matching script decides it).

| Run | Prompt | Recall (annotated developments emitted) | Corrections / negations reflected | No-change scenario (b) | Emitted, not in the annotation | Spend (peak list price) |
|---|---|---|---|---|---|---|
| `cp1-a8-r1` | v1 | 20 / 21 — (d)'s gym negation emitted no WITHDRAW | 3 / 4 | 0 | 36 (one subject per sentence) | USD 0.0412 |
| `cp1-a8-r2-v2` | v2: subjects at the level a person names a topic of their life; a negation MUST WITHDRAW the open subject | 20 / 21 — QANDEEL's question about Alexandria emitted nothing | 4 / 4 | 0 | 14 | USD 0.0405 |
| `cp1-a8-r3-v3` | v3: QANDEEL's own track; steps, arrangements, requests and people of an open subject belong to it | **21 / 21** | **4 / 4**, each WITHDRAW before its replacing SET | **0** | **14** | USD 0.0392 |

- **Evidence accounting in every run:** 100 % of FINAL spans `DEVELOPMENTS` / `NONE`; 0 missed; 0 uncovered.
- **The 14 v3 events the annotation does not have**, for the reviewer: (a) the work subject re-labelled at its second
  sentence, "exhaustion at home", "wedding preparations", "help booking the venue and photographer", and QANDEEL's own
  reflection "a busy week of work and wedding preparations"; (c) "watching the football match"; (d) "a job interview next
  week", "change the train booking", "two weeks without the gym"; (f) "study and exams" and a same-key re-SET; (g) "the doctor
  visit for the back"; (j) "cousin Ahmed" beside the Canada plan, and "the family knew about the emigration". None is
  unsupported by the speech; whether each is an important development the annotation omitted or a false update is the
  reviewer's decision. **Under the contract's literal definition (A1 §6: emitted developments absent from the annotation)
  the false-update clause is not met; CP1 is not accepted until the Product Owner rules on it** (accept the events as
  annotation omissions, or require another prompt iteration inside the remaining DeepSeek ceiling of ≈ USD 0.18).
- **Tokens (v3):** 241 272 prompt tokens over 147 calls, cache hits 45 – 76 % per scenario (45 % on the 761-word (j),
  where the window slides), 4 723 completion tokens. Evaluation latency T3 P50 0.77 – 1.09 s, P95 1.09 – 1.80 s.

### 3.3 Responsiveness, and in-speech vs tail (A2 §2's three metrics kept apart)

| Measure | Value | Source |
|---|---|---|
| T1 word end → FINAL at the server (Speechmatics, measured) | P50 722 – 756 ms, P95 900 – 939 ms per session | A0 |
| T3 admission → interpretation produced (DeepSeek, v3) | P50 0.77 – 1.09 s, P95 ≤ 1.80 s | A8′ |
| Word end → interpretation produced, the 21 matched developments (v3) | P50 2 055 ms, P95 2 797 ms | A8′ |
| **In-speech understanding** (produced before the turn's speech end) | **15 of 20 USER developments** | A8′ v3 |
| **Tail** (produced after the speech end; reported separately, not in-speech disclosure) | **5**: (d) ×2, (g), (j) ×2 — each a development in the turn's LAST FINAL, so it cannot precede the speech end | A8′ v3 |
| QANDEEL-side developments | 1 of 1 | A8′ v3 |
| Successful live disclosure (on the phone's stage before Lane A) | **not measured at CP1**: CP2's metric (B5′ / B6) | — |

### 3.4 Protection of the voice path

- **A3 — a lane failure leaves audio untouched.** The engine spec: a lane whose `open` throws signals
  `attention / integrity_failure` and the call continues; an evaluator that throws synchronously or asynchronously becomes
  `PROVIDER_FAILED` inside the tracker; the voice path's only await on the lane is the bounded hand-over flush (static
  contract).
- **A4 — First Audio (T5: the end of the person's speech → QANDEEL's first audio), lane ON vs OFF, tail included.** Real
  time; 4 concurrent calls × 6 turns × 4 rounds per mode, modes interleaved; the reply's first token and the lane's
  evaluations on ONE shared fake provider capacity; every turn's last FINAL reaches the lane around the commit.

  | Run | Provider slots | Mode | T5 P50 | T5 P95 | Δ vs OFF P50 / P95 | Lane evaluations (deferred by the permit) | Tails admitted before first audio |
  |---|---|---|---|---|---|---|---|
  | `cp1-a4-r2-slots8` (**acceptance**) | 8 | OFF | 1 346 ms | 1 483 ms | — | 0 | — |
  | | 8 | ON (DB permits) | 1 347 ms | 1 483 ms | **+0.9 / −0.2 ms** | 480 (51) | 44 |
  | | 8 | ON_UNGATED | 1 350 ms | 1 502 ms | +3.5 / +18.7 ms | 480 (0) | 96 |
  | `cp1-a4-r1` (stress, F-1) | 2 | OFF | 1 387 ms | 2 129 ms | — | 0 | — |
  | | 2 | ON (DB permits) | 2 965 ms | 3 918 ms | +1 578 / +1 789 ms | 395 (138) | 11 |
  | | 2 | ON_UNGATED | 3 034 ms | 4 101 ms | +1 647 / +1 972 ms | 398 (0) | 86 |

  Per-round P50 at 8 slots: OFF 1 368 / 1 344 / 1 297 / 1 374 ms; ON 1 361 / 1 334 / 1 299 / 1 367 ms; ON_UNGATED
  1 349 / 1 350 / 1 288 / 1 400 ms. Harness noise (the spread of OFF across rounds): 77.5 ms P50, 28.8 ms P95.
  **A4 PASS at the established capacity:** ON − OFF ≤ max(noise, 20 ms) at P50 and ≤ max(noise, 40 ms) at P95. Every
  evaluation resolved; the 0191 permit deferred 51 admissions inside the critical window. **At 2 slots A4 FAILS** (noise
  85 / 143 ms), and ON behaves like ON_UNGATED: the critical window refuses new permits but does not reclaim the slots
  in-flight evaluations already hold — finding F-1 (§5). Reports: `E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1/cp1-a4-r2-slots8/`
  and `.../cp1-a4-r1/`.

### 3.5 A0 — Speechmatics FINAL availability (paid; production adapter, frozen configuration)

Six sessions of ≈ 110 s of continuous synthetic Arabic (S8B-01's TTS corpus, Achird / Sulafat), streamed in real time.

| Arm | Sessions | Audio | FINALs / min | L (word end → FINAL) P50 / P95 / max | Gap between FINALs while speaking P95 / max |
|---|---|---|---|---|---|
| `flexible` (configured) | 4 | 451.6 s | 94.3 | 722 – 756 / **917** / 1 254 ms | 1 419 / **1 841** ms |
| `fixed` (D-1b's arm) | 2 | 223.4 s | 90.8 | 729 – 749 / 936 / 1 202 ms | 1 462 / 2 543 ms |

**STOP rule (A1 §5): L-P95 > 5 s or any gap > 20 s while speaking — not triggered.** In-speech evidence is available: a
FINAL about every 0.65 s, under a second after its words. D-1 (FINAL-only) stands; D-1b is not needed.

## 4. Paid spend (D-7)

| Provider | Ceiling | Spent (estimated at list price) | Basis |
|---|---|---|---|
| Speechmatics realtime Enhanced | USD 0.30 | **≈ USD 0.150** | 675 s of audio at USD 0.80 / h |
| DeepSeek Flash | USD 0.30 | **≈ USD 0.121** (3 runs) | provider usage fields at the PEAK list price (0.006 / 0.30 / 1.20 per M) |
| **Combined** | USD 0.60 | **≈ USD 0.271** | |

No cost ledger row was written (the proofs reach no hosted service). Keys were read from local files into memory only.

## 5. Findings for the Product Owner

- **F-1 — the lane needs provider capacity, and the critical window does not reclaim capacity already in use (A4
  stress, 2 shared slots, 4 calls):** First Audio ON − OFF = +1 578 ms P50 / +1 789 ms P95 (harness noise 85 / 143 ms), with
  ON and ON_UNGATED alike: the evaluations admitted before the commit still hold the slots when the reply asks for one. At
  the established capacity (8 slots, §3.4) the lane is within noise. The lane's demand is about one provider call in flight per
  speaking call; GCR-01-A's capacity proof (`QAN-BL-VOICE-07`'s gate, the +50 / +100 ms First Audio rule) must count it. No
  mechanism was added: reclaiming a slot from an in-flight evaluation would be a contract change.
- **F-2 — A8′'s false-update clause (§3.2)** awaits the human adjudication; recall is met.
- **F-3 — (f)'s "in flight" check** depends on the evaluator's latency: with the real evaluator (faster than the oracle's
  slowed evaluation) the development arrived when nothing was in flight. The mechanism is proven with the fake (§3.1).

## 6. Verification

```sh
npm run test:live-call-attention-contract
node --test tests/intel-live-01-provisional-attention-contract.test.mjs
npm run verify:live-call-attention:integration
npm run test:task-closure-governance-contract
```

- API jest (local, this machine): **350 suites, 7 898 passed, 1 skipped, 0 failed** (full `apps/api` suite, 2026-11-25).
- The lane's static contract and the touched contracts (AI-COST-01, S8B-02, S8B-05, canonical home placement, Thread
  establishment), the six files in one run: 139 / 139; `test:live-call-attention-contract` 15 / 15;
  `test:task-closure-governance-contract` 25 / 25.
- `database/verify-migration-0204.mjs` on a fresh local clone through `0204`: passed.
- The proofs: `cp1-corpus-proof.ts` (FAKE: 13 / 13 scenarios), `cp1-first-audio-proof.ts` (A4), `cp1-cadence-proof.ts`
  (A0), `cp1-corpus-proof.ts` (DEEPSEEK: A8′).
- The forward-safety suite has ten known local failures on this Windows machine; CI judges it.

## 7. Draft PR #410 — transfer (CP0 v1.1 §8.3)

| File on #410 (head `55d016b6`) | Landed | Loss excluded by |
|---|---|---|
| `docs/e2e/QANDEEL_INTEL_LIVE_INCREMENTAL_UNDERSTANDING_GAP_v1.md` | same path, body verbatim + a dated addendum | `git diff 55d016b6:<path>` shows only the addendum |
| `docs/e2e/QANDEEL_S8B07_S4_INCREMENTAL_UNDERSTANDING_REPLAY_COMPATIBILITY_v1.md` | same path, verbatim + addendum | the same |
| `QAN-BL-INTEL-06` in the backlog | verbatim, four lines set by v1.1 §8.2 (each original quoted in the admission note) | side by side in the PR body |
| `QANDEEL_PROJECT_MAP.md` banner | superseded; its two document pointers are carried in the CP1 banner | the pointers |

#410 is closed only on the Product Owner's word, with a comment naming the CP1 commit.

## 8. Reports (outside the repository)

`E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1/`: `cp1-fake-r3` (mechanism), `cp1-a8-r1`, `cp1-a8-r2-v2`, `cp1-a8-r3-v3`
(adjudication tables, rows, inputs), `cp1-a0-r1` (cadence), `cp1-a4-r1` (stress, 2 slots), `cp1-a4-r2-slots8` (A4).
