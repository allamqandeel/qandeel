# INTEL-LIVE-01 — Incremental In-Speech Understanding & Living Map Attention: Execution Record v1

**Status:** `INTEL-LIVE-01 CP1 ACCEPTED (PRODUCT OWNER, 2026-11-25, HEAD 0044f56e; §3.6) — CP2 LIVE MAP DISCLOSURE DELIVERED / READY FOR PO REVIEW (§9) — NOT MERGED — NOT DEPLOYED — CP3 – CP4 NOT STARTED`
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
- The Product Owner's "INTEL-LIVE-01 — Binding PO Directive: Semantic Freedom & Targeted Cross-Platform Validation"
  (2026-11-25). It supersedes the previous CP1 review and the proposed blanket iOS exemption:
  - §1: DeepSeek is the semantic authority; the restrictive importance and granularity instructions are removed.
  - §2: the unannotated events are judged by what they are, never by the annotation list.
  - §3 / §4: iOS stays mandatory through a change-aware iOS Targeted Gate; validation scope is proportional to impact
    (the backlog's BG-10 clarification).
  - §5: impact-based CI, and the T-03B1b1 API CI failure corrected without weakening its assertions.
  - §6: one task, one PR (#415), four checkpoints.
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

## 0. The checkpoint plan and where each checkpoint stands

| Checkpoint | Scope (contract) | State |
|---|---|---|
| **CP1** | The producer: migration `0204`, the lane, its wiring, the proofs A0 – A12 and A8′, the iOS Targeted Gate (live call) | **ACCEPTED** by the Product Owner at checkpoint level (2026-11-25, head `0044f56e`; §3.6) |
| CP2 | The live map: Live Call protocol v3 (additive), the phone's consumption, B5′ / B6 (successful live disclosure); iOS Targeted Gate: v3 with v1 / v2 fallback, updates and withdrawals visible, reconnect / restore, COSMOS compatibility | **DELIVERED / READY FOR PO REVIEW** (§9) |
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
| The paid ceiling | Speechmatics ≈ USD 0.150, DeepSeek ≈ USD 0.266, combined ≈ USD 0.416 of 0.60 (§4) |
| Directive §1 — semantic freedom | prompt v5 (§1.2): what the conversation is about, its relations, placement, continuity and evolution, judged by DeepSeek; no fixed granularity, importance or category; grounding, privacy, identity, transport and chronology kept |
| Directive §2 — grounded discoveries are not false updates | §3.2: each unannotated event classed by the directive's categories; the original measurements kept |
| Directive §3 / §4 — iOS mandatory, proportional | the iOS Targeted Gate (live call), §3.6; the World gate no longer re-runs for the API or the database, which its app cannot reach (§6.1) |
| Directive §5 — CI | §6.1: impact-based triggers with written justification, measured times; the T-03B1b1 failure corrected (§6) |

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
  fail-closed parser (exactly the schema or `REFUSED`). Prompt version `intel-live-01-provisional-attention-v5` (§3.2).
  Under directive §1, v5 asks only how the understanding of what the conversation is about develops:
  - its principal axes, the relations between its subjects, where each belongs, and its continuity and evolution;
  - how broad or fine a subject is, and how much it matters, is DeepSeek's to judge in context;
  - `kind` serves presentation and never limits what a subject may be.

  The v2 / v3 restrictions are removed: the granularity rule, "details belong to their subject", the closed list of
  development types, and the mandatory WITHDRAW. Kept from the canonical understanding guidance, Live Focus and INTEL-04:
  - understanding rests on what was said; nothing is inferred about the speaker;
  - identity is semantic sameness of the referent, never wording;
  - a reframing subject is its own subject;
  - an incidental mention is not attention; reported speech stays the speaker's;
  - a label is a short neutral name, never a quotation, judgement, diagnosis or advice.

  The schema and parser are unchanged.
- **Mechanical duplication** (directive §2): `withoutRepeatedSets` in the tracker drops a SET identical to the subject
  already open (same key, label, kind, confidence and Thread). It never touches a WITHDRAW or a changed subject. A result
  left with nothing is recorded `NONE`, and it covers its span exactly as before.
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
- The iOS Targeted Gate (§3.6) reuses S8B-06 CP3's proof server (`apps/api/scripts/s8b-06-cp3-device-proof-server.ts`),
  which gains four things, all inert unless the gate asks for them:
  - with `PROOF_ATTENTION=ON`, the production lane composition (`liveCallAttentionOf`) over a fake evaluator, and the
    worker's attention settlement;
  - `POST /proof/speak?ms=`, a synthetic voiced signal over THIS proof's uplink (a runner has no microphone);
  - `GET /proof/attention`, counts only;
  - the FINALs of its scripted recognizer placed on the stream's clock.

## 2. What is deliberately not implemented

- No protocol message, no phone change, no map change (CP2). No Replay read (CP3). No COSMOS, Lane A, endpointer or
  First Audio path change. The iOS Targeted Gate adds validation files only (a workflow, a runner script, three Maestro
  flows); no Product mobile file changed.
- No relation field between subjects: relations are expressed through the subjects and their labels. A field would be a
  contract change, which the directive excludes.
- INTERIM is never evaluated (D-1b not chosen).
- No hosted migration, no deployment, no gate opened, no merge.

---

## 3. Acceptance (A1 §6 as amended by A2 §6)

### 3.1 Mechanism — the fake evaluator (free; local PostgreSQL, `0204` applied to a fresh clone)

13 scenarios, every assertion passed. The first run was `cp1-fake-r3`; after the duplication filter it was re-run as
`cp1-fake-r4`, again 13 / 13. Zero false updates and zero ordering errors in every scenario; zero events unbound to their
evidence.

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

DeepSeek Flash, the production prompt and parser, its own latencies placed on the virtual clock. Five runs, each
recorded and none overwritten (directive §2: the original measurements are kept). The reading is the agent's, from the
adjudication tables (`E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1/cp1-a8-r*/adjudication.md`); subject identity is semantic, so no
label-matching script decides it, and the Product Owner reviews it.

| Run | Prompt | Recall (annotated developments emitted) | Corrections / negations reflected | Events in all | Not in the annotation | Spend (peak list price) |
|---|---|---|---|---|---|---|
| `cp1-a8-r1` | v1 | 20 / 21 — (d)'s gym negation emitted no WITHDRAW | 3 / 4 | — | 36 (one subject per sentence) | USD 0.0412 |
| `cp1-a8-r2-v2` | v2: subjects at the level a person names a topic of their life; a negation MUST WITHDRAW the open subject | 20 / 21 — QANDEEL's question about Alexandria emitted nothing | 4 / 4 | — | 14 | USD 0.0405 |
| `cp1-a8-r3-v3` | v3: QANDEEL's own track; steps, arrangements, requests and people of an open subject belong to it | 21 / 21 | 4 / 4, each WITHDRAW before its replacing SET | 35 | 14 | USD 0.0392 |
| `cp1-a8-r4-v4` | v4: directive §1, the restrictions removed (first wording) | not adjudicated: the run failed on expression (below) | the cancelled gym plan re-SET, not withdrawn | 169 | — | USD 0.0741 |
| **`cp1-a8-r5-v5`** (shipped) | **v5**: directive §1, expression rules restored | **21 / 21** | **4 / 4**: Cairo → Alexandria; the gym cancelled, with the leg pain; Canada → the visa refused, with a grounded WITHDRAW of the awaited answer | 117 | 96 | USD 0.0705 |

- **Evidence accounting in every run:** every FINAL span is covered (`DEVELOPMENTS` / `NONE`), except where noted:
  - v4: 2 spans of (f) left `UNCOVERED_AT_END`, from 15 `REFUSED` evaluations;
  - v5: 1 `REFUSED`, its span covered by the next admission; v5's outcomes were 105 `DEVELOPMENTS`, 41 `NONE`, 1 `REFUSED`.

  v5's only failing check is the mechanism condition "(f) the development arrived while an evaluation was in flight" (F-3).
- **v4 was an expression failure of my prompt, not a semantic one.** It kept no rules on how a judgement is written down:
  - labels accumulated details past 40 characters, which the parser refused (15 times);
  - 58 SETs repeated the subject already open, unchanged;
  - some labels assumed the speaker's gender, for example «المتحدثة», although the speaker used the masculine «معجب»;
  - the cancelled gym plan was re-SET as «إلغاء الذهاب للجيم» instead of withdrawn.

  v5 restored the expression rules only, and v4's evidence is kept:
  - a label is the subject's new short name, never an accumulation of its details;
  - an unchanged open subject is not SET again;
  - nothing is inferred about who the speaker is;
  - a corrected or cancelled subject is withdrawn under its key.

  None of these limits what DeepSeek may judge.
- **The revised acceptance interpretation (directive §2).** A1 §6's literal false-update clause counted every emitted
  development absent from the annotation. Under the directive, an unannotated event is a false update only when it is one
  of the following; a grounded discovery is not, whatever the annotation lists:
  - a fabricated interpretation;
  - a factual contradiction;
  - an attribution error;
  - a meaningful omission;
  - actual mechanical duplication.

  The annotation's role is now recall only: every annotated development must be emitted. It is not the ceiling of what
  may be understood.
- **v5 adjudication against those categories** (agent's reading, every row in `cp1-a8-r5-v5/adjudication.md`):

  | Category | v5 |
  |---|---|
  | Fabricated interpretation | **0** |
  | Factual contradiction | **0**: each correction replaces its subject; no event states what a later FINAL contradicts while it stays open |
  | Attribution error | **0**: the person's subjects are first person or «المستخدم»; QANDEEL's own track carries QANDEEL's subjects; no speaker gender is inferred |
  | Meaningful omission | **0**: recall 21 / 21; every correction and negation reflected |
  | Mechanical duplication | **0 left**: 4 re-SETs differ only in confidence, which the filter keeps by design (a changed judgement); identical re-SETs are dropped before the write |

  The remaining unannotated events are grounded discoveries or evolutions of subjects the person spoke about. Examples:
  - (a) the late office hours, eating at the desk, the colleagues under the same pressure, the mother busy with the
    wedding preparations;
  - (b) the dishes cooked, and the person's view of themselves as a cook. Ten such events in the "no meaningful change"
    scenario are details of the one open subject, not false updates under the directive;
  - (j) cousin Ahmed and the family knowing.

  The v3 events are classed the same way:
  - 12 of its 14 unannotated events are grounded discoveries or evolutions;
  - one is mechanical duplication: (f) #4 «وهيسافر بعد شهرين», a re-SET of `friend_scholarship_germany`, now dropped by the
    filter;
  - one is the extra event on (j) #1's annotated segment.
- **Expression notes for CP2's presentation (not false updates):**
  - Some v5 labels nearly quote the speech, against "never a quotation of the speech". Examples: (a) #1
    «المدير بيطلب حاجات كتير في نفس الوقت», (a) #16, (d) #2.
  - One label is a grounded implication: (j) #8 «تغيّر الوضع قريبًا», from «لحد قريب».
  - The map's presentation (CP2) decides how a subject is shown; no further paid iteration was run for wording
    (directive: "no unnecessary paid prompt iterations").
- **Granularity is now DeepSeek's.** v5 emits about one subject per meaningful sentence: 98 new keys against v3's 30.
  Whether the map shows all of them, or how it groups them, is CP2's presentation, not the producer's.
- **Tokens (v5):** 328 981 prompt tokens over 147 calls, 141 440 of them cache hits; cache hit 31 – 78 % per scenario (31 %
  on the 761-word (j), where the window slides); 11 131 completion tokens. Evaluation latency T3 P50 1.03 – 1.34 s, P95
  1.29 – 1.94 s. For v3 the figures were 241 272 prompt and 4 723 completion tokens, T3 P50 0.77 – 1.09 s, P95 1.09 – 1.80 s.

### 3.3 Responsiveness, and in-speech vs tail (A2 §2's three metrics kept apart)

| Measure | Value | Source |
|---|---|---|
| T1 word end → FINAL at the server (Speechmatics, measured) | P50 722 – 756 ms, P95 900 – 939 ms per session | A0 |
| T3 admission → interpretation produced (DeepSeek) | v5: P50 1.03 – 1.34 s, P95 ≤ 1.94 s (v3: P50 0.77 – 1.09 s, P95 ≤ 1.80 s) | A8′ |
| Word end → interpretation produced, the 21 matched developments | v5: P50 2 072 ms, P95 2 602 ms (v3: 2 055 / 2 797 ms) | A8′ |
| **In-speech understanding** (produced before the turn's speech end) | **v5: 14 of 20 USER developments** (v3: 15 of 20) | A8′ |
| **Tail** (produced after the speech end; reported separately, not in-speech disclosure) | **v5: 6** — (a), (d) ×2, (g), (j) ×2. v3: 5, without (a). (a)'s Alexandria plan was produced 110 ms after its turn's speech end; the others are each in the turn's LAST FINAL, so they cannot precede the speech end | A8′ |
| QANDEEL-side developments | 1 of 1 (v3 and v5) | A8′ |
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

### 3.6 The iOS Targeted Gate — live call (directive §3; BG-10 clarification)

The gate is `.github/workflows/ios-targeted-gate.yml`, which runs `scripts/ios-targeted-gate/run-live-call-gate.sh` and
the Maestro flows `apps/mobile/.maestro/itg-call-*.yaml`.

**When it runs.** It is change-aware: the live-call backend (voice, voice media, call analysis, the attention lane, the
live-call reply), the migrations, the shared packages, the mobile call client and native call module, and its own files.
It also runs on every push to main.

**What it reuses.** The existing infrastructure, unchanged:
- the S8B-06 CP3 proof build: the PRODUCTION runtime, Conversation and call surfaces, and the REAL native call engine;
- the S8B-06 CP3 proof server: the REAL S8B-05 live call, over a fresh PostgreSQL carrying every migration through `0204`,
  with the attention lane ON;
- the S8B-03 iOS proof pattern: Xcode 26.6, iPhone 17 / iOS 26.5, Maestro 2.10.0 pinned by SHA-256, `bounded-run`, and the
  driver diagnostics.

**What it does not cover.** The real microphone, echo cancellation, CallKit, Bluetooth and a physical iPhone, which is a
separate future requirement; and CP2's map. One language and size: CP1 changes no UI (BG-10).

| Case | Asserts (real interaction on the simulator, host reads of the server) |
|---|---|
| ITG-01 launch | the proof build installs and launches; the Conversation's call entry (`qandeel-call-entry`) is drawn, which needs the runtime to have reached the server |
| ITG-02 connect | a tap on the call entry draws the call line's End; the server holds the call `ACTIVE` (the `qandeel.live-call.v1` HELLO accepted) |
| ITG-03 turn | `/proof/speak` arms a synthetic voiced signal; the endpointer commits, the reply is generated and closes `PLAYED_OUT`, which only the iOS engine's PLAYOUT confirmations produce; the call line is still drawn. After a server-confirmed connection loss before `PLAYED_OUT`, one recorded repeat on the reconnected call: `PASS AFTER RECOVERY`, never `PASS` (see below) |
| ITG-04 end | a tap on End removes the call line while the Analysis stays (S8B-06 CP3 J3: the person's own End does not move them); the door back to the Conversation then shows the call entry again; the server ends the call `USER_ENDED` |
| ITG-05 attention | the lane evaluated both tracks (`DEVELOPMENTS`), wrote `SET` events and settled both halves `COMPLETE`; no write failed |
| ITG-06 stability | the app is still running; no crash report names it |

**Local proof of the server half (Windows host, no simulator).** A loopback stand-in client ran one call against the
proof server, using the same protocol and PLAYOUT pacing:
- stimulus → endpointer → commit → reply 600 frames `PLAYED_OUT` → END `USER_ENDED`;
- `/proof/attention`: USER `DEVELOPMENTS` 1, QANDEEL `DEVELOPMENTS` 1 and `NONE` 1, `SET` 1 per track, settlements
  `COMPLETE` per track;
- 0 write failures.

That run proved three proof-harness defects were fixed:
- the RPC shim passed the events as a PG array instead of jsonb;
- the scripted FINALs sat at 0 – 0 ms;
- a stimulus armed before any call opened.

The gate's three host predicates were checked against that run's reads.

**The first simulator run.** Run 45571644129 on `6400dc37` (iPhone 17, iOS 26.5):

| Case | Result | Detail |
|---|---|---|
| ITG-01 | PASS | the call entry was drawn |
| ITG-02 | PASS | the server held the call `ACTIVE` |
| ITG-03 | PASS | the reply was `PLAYED_OUT`, 600 frames |
| ITG-04 | FAIL | after End, `qandeel-call-entry` was not visible within 60 s |
| ITG-05 | NOT TESTED | not reached |
| ITG-06 | NOT TESTED | not reached |

Times: the cases took about 7 min (08:27:53 → 08:35:01 UTC), the gate step 13 min and the job 43 min (mostly the native
build).

**ITG-04's diagnosis, from the run's evidence** (the artifact downloaded with the PO's approval, for this purpose only):
- **Screenshot:** the call line is gone; the app is on the Analysis, where the call was started (ITG-02's screenshot
  shows the call line on the Analysis).
- **Hierarchy at the failure:** no `qandeel-call-rail:*`, no `qandeel-call-entry`; the Analysis's door
  `qandeel-depth-to-conversation` is present.
- **Server events:** at 08:33:31 UTC, the second of the tap, the attention lane stopped, the analysis worker drained,
  and the history read went from `calls: 0` to `calls: 1`, the finished call's record.
- **Contract:** S8B-06 CP3 J3 says the person's own End "does not move them"; only an unchosen end returns them to the
  Conversation.

So the application did what its approved design says. **It was a test-harness defect**, not a simulator issue and not an
application defect: the flow waited for the call entry on a screen that never draws it.

**The correction** is the narrowest one. `itg-call-end.yaml` asserts the approved end, in order:
1. the tap on End;
2. the call line gone;
3. the Analysis still shown;
4. then the door back to the Conversation, where the call entry must be drawn again.

The server must still end the call `USER_ENDED`. No assertion is removed; one (J3) is added. The ITG contract pins the
order and J3's text.

Also observed in the run's events: both tracks resolved `DEVELOPMENTS` (USER 08:30:57, QANDEEL 08:31:04), so ITG-05's
evaluation has its evidence. Its settlement half is shown by the next run.

**The second simulator run.** Run 45586185915 on `1d64eb97`:

| Case | Result | Detail |
|---|---|---|
| ITG-01 | PASS | |
| ITG-02 | PASS | |
| ITG-03 | FAIL | no spoken turn's reply was `PLAYED_OUT` within 120 s |
| ITG-04 – 06 | NOT TESTED | not reached |

The native build took 24 min of the 44-minute job.

**ITG-03's diagnosis, from the run's evidence** (artifact `15012375786`, downloaded with the PO's approval; it was compared
with the first run's, where ITG-03 passed). Times are measured from `/proof/speak`.

| Stage | First run (PASS) | Second run |
|---|---|---|
| synthetic speech injection: 75 frames, `SPEECH_START`, stimulus end | 0.09 s / 1.49 s | 0.10 s / 1.49 s |
| endpointer commit: `FINALIZE`, `COMMIT_SILENCE`, `COMMITTED` | 1.99 / 2.29 / 2.35 s | 2.00 / 2.30 / 2.61 s |
| reply generation: `REPLY_OUTCOME COMPLETE` | 3.20 s | 3.63 s |
| first audio | 3.33 s | 3.76 s |
| **audio delivery** | complete: `REPLY_END` at 15.57 s | **lost at 11.76 s** |
| PLAYOUT confirmation | `PLAYED_OUT`, 12 000 ms heard | never reached |

**What happened in the second run:**
- From 8.75 s the server received nothing from the phone, neither audio nor `HEARTBEAT`. On the phone, both ride its JS
  thread: native capture → `onUplink` → `sendAudio`.
- At 11.76 s the frozen 3 s silence rule (`live-call.connection.ts`, `silenceTimeoutMs`) closed the connection with
  `4008 SILENCE`. By then 4.8 s of the 12 s reply had been delivered.
- The phone reconnected at epoch 2, and the call stayed live (the failure screenshot shows 2:42). As frozen, the
  interrupted reply was not resumed, so it could never close `PLAYED_OUT`.

**The cause of the phone's 3 s pause is not observable in this evidence**, which has no client-side trace.
- The pause began right after the phone's five map reads for the first subject.
- The first run made the same reads at the same moment, followed by pauses of only 410 and 414 ms.

That is a correlation seen in two runs, not a proven cause. CP1 changes no mobile code. Every server stage matched the
first run within 0.5 s.

**ITG-04 – 06 reviewed against the proof server before the next run:**
- `/proof/state` reports the latest call's `state` and `end_reason`.
- `/proof/attention` reports the exact fields ITG-05 reads: `evaluations` (track, outcome), `events` (track, op) and
  `settlements` (track, half_state).
- ITG-06 reads `launchctl` and the host's crash reports.

No wrong assumption was found.

**The recovery rule (PO, 2026-11-25, option 1).** The runner allows exactly ONE recorded repeat of ITG-03's spoken turn,
within the same run, and only after the server itself recorded the connection lost before `PLAYED_OUT`:
- **Stop and record.** The wait stops at once. The loss's code, reason, epoch and time after the stimulus are recorded.
  The first attempt's evidence is kept: `host/03-attempt-1.json`, `host/03-loss-1.jsonl`, a screenshot and a host `top`
  snapshot. The proof server now records each loss's connection epoch.
- **Reconnect first.** The turn is repeated only once the call is `ACTIVE` again at a later epoch and an uplink is open.
- **Report it as a recovery.** A repeat that plays out is recorded `PASS AFTER RECOVERY`, never `PASS`, and the run's
  summary says so.
- **A second loss fails the case.**
- **Nothing else changed.** The assertions are unchanged, and so are the 3 s rule, the audio engine, the heartbeat policy,
  prompt v5 and COSMOS.

The run also keeps lightweight client-side diagnostics in `client/` (from ITG-03 on until the fourth run; from before
ITG-01 since):
- the app's unified log at default level (this proof's synthetic data only);
- a once-a-second line of host load and the app's CPU;
- a `top` snapshot at each loss and each failure.

The ITG contract pins each element and plants its regression. If the repeat succeeds, the interruption is recorded as a
tracked, unresolved finding, and its cause is not claimed resolved.

**The third simulator run.** Run 45601664395 on `17b6c296`, with the recovery rule:

| Case | Result | Detail |
|---|---|---|
| ITG-01 / ITG-02 | PASS | |
| ITG-03 | FAIL | first attempt `4008 SILENCE`, epoch 1, 11 797 ms after the stimulus; the call was `ACTIVE` again at epoch 2; the one repeat lost its connection `4005 OVERLOADED`, epoch 2, 10 727 ms after its stimulus |
| ITG-04 – 06 | NOT TESTED | not reached |

No further repeat exists (PO).

**The root cause, from the evidence of all three runs** (artifact `15019600190`, PO-approved; its client log, host
samples and `top` snapshots compared with the server's events).

1. **The host was starved.** The 1 s samples and both snapshots cover ITG-03. Load average was 130 – 158 (1 min) and
   203 – 220 (5 min). CPU was 0 – 3 % idle, with 46 – 56 % of it in the kernel. Memory: 129 – 145 MB free, 2.6 GB
   compressed, 2.0 GB wired, 36 772 swap-outs. 82 processes were stuck at the failure. Even the host's own 1 s sampler
   missed 8 of its 45 ticks.
2. **The first loss (`4008`).** The phone sent nothing for 3.0 s, from 11:49:32.98 to 11:49:36.00. The client log shows
   the app compiling Metal shaders through that window: 11:49:33.03, 34.99, 35.06, 35.07, about 2 s each. That is the
   first map subject being drawn, the same moment as in runs 1 and 2, where the map's five reads also immediately
   preceded the pause. This is ordinary app work, which a starved host makes take seconds.
3. **The second loss (`4005`).** The condition is `live-call.connection.ts:237`: `this.queued >= frameBurst`. That means
   150 inbound frames, three seconds of audio, were waiting in the connection's own inbox. It is not the phone's send rate
   (`frames.take`, line 232). A run of uplink gaps of 400 – 1 127 ms preceded it. At 11:50:01.398, about 1.4 s before it,
   the simulator's audio engine logged `HALC_ProxyIOContext::IOWorkLoop: skipping cycle due to overload`, so even the
   real-time audio thread was starved. No shader compile was in that window.
4. **One root cause.** Both losses are the frozen protocol's correct responses to the same thing: multi-second
   starvation of the simulated phone and its host. Silence ≥ 3 s gives `4008`; a backlog ≥ 3 s gives `4005`. Run 1
   passed with pauses up to 1.7 s.
5. **What the cause is not:**
   - **The attention lane.** Measured locally with the same proof server, the same stand-in phone and one call each,
     lane ON vs OFF, twice:
     - CPU on the call: 3.63 / 3.25 s vs 3.58 / 3.23 s;
     - working set: 658 MB in all four runs;
     - no uplink gap, loss or refusal in any of them.

     On the simulator, every attention evaluation finished within 0.1 s of its FINAL. None was running during either
     pause.
   - **Audio transport.** It refused exactly what it is specified to refuse.
   - **The mobile runtime.** Its work at that moment is the approved first draw of the map, which is unchanged and fine
     on the device.
6. **The proof harness added measured load on that starved host:**
   - **The proof server type-checked itself in process.** Locally, one call, lane ON: 658 MB and 3.2 – 3.6 CPU-s, peak
     0.9 – 1.3 CPU-s in a second. With `--transpile-only`: 312 MB and 2.4 CPU-s, peak 0.42.
   - **Run 3's own continuous `log stream`.** `diagnosticd` ×2 and `log` took about 37 % of one core in both snapshots.
   - **Spotlight was indexing:** `mds_stores` up to 13.9 %, `mds` 8.3 %, many `mdworker_shared`.

**The correction is to the harness only.** No production code, assertion, frozen limit or timeout changes, and nothing
is repeated beyond the one approved repeat:
- the proof server is type-checked in its own step (`tsc -p apps/api/tsconfig.scripts.json`, 6 s locally), then runs
  `--transpile-only`;
- Spotlight indexing is switched off first on the ephemeral runner;
- the app log is read once when the run ends (`log show --start`), never streamed;
- each snapshot adds the largest resident processes, so a recurrence names what holds the memory;
- the app's pid is found by its exact process name, so its CPU is sampled.

The ITG contract pins each change and plants its reversal.

**What this does not prove.** The remaining load is the simulator and the app themselves on a 3-core, 7 GB runner. If a
pause still recurs, the next run's evidence will show what remains, including which processes hold the memory. The
harness's contribution is removed. The runner's capacity is not something CP1 can change without a paid or different
runner.

**The fourth simulator run.** Run 45612961224 on `885c89ed`, with the harness correction:

| Case | Result | Detail |
|---|---|---|
| ITG-01 | PASS | |
| ITG-02 | FAIL | a tap on the call entry did not draw the call line's End within 60 s |
| ITG-03 – 06 | NOT TESTED | not reached |

**ITG-02's diagnosis, from the run's evidence** (artifact `15023788500`, PO-approved). The app's log for the tap was
compared with the third run's, where ITG-02 passed with the same app source (`apps/mobile` is unchanged between the two
heads).

| Question | Evidence | Answer |
|---|---|---|
| Was the tap received? | The driver's `POST /touch` at 13:01:09.85 ("Tapping 322.0, 751.0", 0.46 s). The element under that point is `qandeel-call-entry` (`[300,729][344,773]`, enabled), with nothing above it: the full-screen overlay is `box-none`. UIKit delivered touch-down 13:01:10.070 and touch-up 10.256 to the app's window ("send gesture actions"). | **Yes, by the app's window.** |
| Did the call-start logic run? | Its first native step is `callCapability`, which reads the record permission (`tcc_send_request_authorization`). In run 3 that came 45 ms after the touch, then the call-truth read (`GET /voice/calls/truth`) and the audio session. In run 4 the app logged none of them: no permission read, no request but the Conversation's 5 s temporal poll, no audio session. | **No.** `CallOwner.start()` did not reach its capability read. |
| Did permissions or local state block it? | The microphone was granted twice (`simctl privacy grant`, and `launchApp` with `microphone: allow`). No system alert was on screen. No call notice (`qandeel-call-notice`) was drawn, which each of `start()`'s refusals (not available, already in a call, microphone) draws. The app was alive: its 5 s poll ran on until 13:02:19. | **No visible block.** |
| Did a connection attempt reach the server? | The server's events after the tap: only `analysis-read` temporal polls. No WebSocket, no `CALL_ACTIVATED`, no refusal. | **No.** |

**The cause was not established from run 4 alone** (it was after run 5; see below). The point of failure lies between UIKit's delivery and `CallOwner.start()`'s
capability read: React Native's touch handling, the Pressable's `onPress`, or `start()`'s first guard
(`!live() || controller !== null || preparing`), which returns without a notice. This Release proof build writes no
JavaScript log, so the evidence cannot tell those apart. The same app source passed ITG-02 in runs 1 – 3. No production
code is changed, and nothing is retried.

**The correction is to the diagnostic coverage only:**
- **Client diagnostics from before ITG-01.** They used to start at ITG-03, so run 4's ITG-02 had none. The app's log now
  covers the whole run, and the 1 Hz sampler finds the app's pid on each tick (ITG-01's launch replaces the process).
- **The proof server records each HTTP request** as `http` evidence: method, path, status and time. It never records
  the query, headers or body. A case that sees nothing happen then shows whether the app asked the server at all; the
  app's own log does not name the paths it read.

The ITG contract pins both and plants their reversals. A local stand-in call with this server played out as before:
`PLAYED_OUT`, `USER_ENDED`, attention settled, 313 MB, 2.2 CPU-s.

**ITG-01 – 06 reviewed together after four runs:**
- **Each run failed at a different case, for different reasons.** Run 1 failed ITG-04 on a harness defect (J3, fixed).
  Runs 2 and 3 failed ITG-03 on host starvation; the harness load was removed. Run 4 failed ITG-02 on a lost call start;
  its cause is not observable.
- **UI assumptions.** Each flow waits for an element the production surface draws only after the action took effect:
  - ITG-01: the call entry, drawn once a call owner exists;
  - ITG-02: the call line's End;
  - ITG-03: End still drawn;
  - ITG-04: J3's order.

  No flow hides the keyboard or retries.
- **Server predicates.** They read only `/proof/state` and `/proof/attention`, whose fields were checked against the
  proof server (ACTIVE, `PLAYED_OUT`, `USER_ENDED`, the attention evaluations, events and settlements).
- **Readiness conditions.**
  - The driver must answer before any Product step (122 s in run 4).
  - ITG-01 waits up to 180 s for the entry.
  - `/proof/speak` refuses a stimulus with no open uplink.
  - ITG-03's repeat waits for ACTIVE at a later epoch.
- **Resource consumption.** The proof server runs transpile-only, Spotlight is off, and the app log is read once at the
  end.
- **Diagnostic coverage.** It now spans ITG-01 – 06 on both sides: the client log and samples, and the server's events
  with its HTTP requests.

The stubbed runner simulation still gives the intended result for ITG-03's five paths: first-attempt PASS, PASS AFTER
RECOVERY, a second loss, no reconnection, and no turn. No retry or timeout was added.

**The fifth simulator run.** Run 45630621237 on `4b60bc85`:

| Case | Result | Detail |
|---|---|---|
| ITG-01 | PASS | |
| ITG-02 | FAIL | the same failure as run 4 |
| ITG-03 – 06 | NOT TESTED | not reached |

Driver readiness took 211 s, and the host reported 0 % idle CPU, 6 818 MB used and a load average of 376.87. The new
HTTP evidence shows the app's reads of the voice capability, pending notes and conversation turns after launch, and no
`/voice/calls` request after the tap.

**The cause of both ITG-02 failures: the simulator dropped the tap's touch.** The PO reviewed artifact `15034042942`
independently, then authorised its download. Both failed taps are compared here with the five call-control taps that
worked in runs 1 – 3, using backboardd's own touch log, which Maestro captures for each flow.

| | Each tap that worked | Run 4 (13:01:10) and run 5 (14:51:51) |
|---|---|---|
| XCTest's synthetic tap: touch-down, then touch-up 0.1 s later | yes | yes |
| backboardd takes the touch-down (`contact 2 presence: touching`) | yes | yes |
| Later events of that path | delivered; the touch-up `presence: none` | **10 dropped**: `didn't see a previous touch down or range-in event for pathIndex:2; skipping event` |
| When the synthetic digitizer detaches | no contact left | the contact is still `touching; locked` → `canceling paths` |
| What the app receives | a completed tap; the call starts | a **cancelled** touch: React Native's Pressable fires no `onPress`; the call never starts |

The `cancel -- digitizer did disappear` line is in every run, the passing ones included. It matters only when the
touch-up was dropped first. The fault is in the simulator's synthetic touch delivery, below the app, the proof server and
the attention lane.

**Not replaced by XCUITest (PO).** The COSMOS native XCUITests deliver their taps through the same testmanagerd →
backboardd path, so replacing Maestro would not remove the fault.

**The ONE infrastructure-recovery exception for ITG-02 (PO, 2026-11-25, option 1).** The call-entry tap is repeated
exactly once, and only when `scripts/ios-targeted-gate/touch-drop.mjs` confirms all of the following, read from the tap
flow's backboardd log, the server's events and its state:
- **T1:** exactly one touch path was touched (the one tap);
- **T2:** later events of that path were dropped;
- **T3:** the path never lifted, so the tap did not complete;
- **T4:** after its touch-down, the digitizer disappeared and the simulator cancelled the path while it was touching;
- **S1:** the server holds no call;
- **S2:** no call initiation reached the server since the tap began: no `/voice/calls` request and no `CALL_ACTIVATED`.

How the runner applies it:
- The first attempt's evidence is kept: `host/02-touch-1.log`, `host/02-touch-1.json`, `host/02-attempt-1-state.json`,
  a screenshot and a host snapshot.
- A repeat that opens a call the server holds ACTIVE is recorded **PASS AFTER RECOVERY**, never PASS.
- Each of these stays **FAIL**, with nothing repeated: a second failure, an unconfirmed or unverifiable cancellation,
  and a completed tap that did not start the call.
- No other case gained a repeat, and no timeout, production code or workflow changed.

**Verified locally before the push:**
- **The verifier on the real logs.** It confirms exactly the two dropped taps (runs 4 and 5) and refuses all four
  completed ones (T2).
- **Its refusals.** It refuses a held call (S1), a `/voice/calls/truth` request, a `CALL_ACTIVATED` (S2), two taps or
  none (T1), a missing cancellation (T4) and an unreadable input.
- **The runner's own ITG-02 block, with stubbed tools.**

  | Path | Result |
  |---|---|
  | first tap works | PASS |
  | confirmed drop, repeat works | PASS AFTER RECOVERY |
  | confirmed drop, repeat fails | FAIL |
  | completed tap that did not start the call | FAIL |
  | a call-truth request | FAIL |
  | a held call | FAIL |
  | no log | FAIL |

  Every FAIL path but the failed repeat repeats nothing.
- **The ITG contract.** It pins the conditions, the single repeat after the confirmation, the kept evidence and PASS
  AFTER RECOVERY, and plants seven reversals.

**The sixth run (45659136860, on `fdac42be`) did not pass.** The PO inspected artifact `15048156848` independently.

| Case | Result |
|---|---|
| ITG-01 | PASS |
| ITG-02 | **FAIL**: the tap did not draw End, and the verifier refused, `T1: 0 touch paths were touched in the window` |
| ITG-03 – ITG-06 | NOT TESTED (not reached) |

Why the exception could not operate: the native driver tapped from 17:41:27.259 to 17:41:28.558 UTC, but the simulator log
Maestro kept for that flow begins at 17:41:28.565, after the tap. The verifier read a log that did not cover the
interaction, so it confirmed nothing and nothing was repeated, as its rule requires. The defect was the evidence source
chosen for it, not the rule. The server held no call and kept serving the app's routine HTTP polling.

**The exception is withdrawn (PO, 2026-11-25, the final functional validation approach).** The ITG-02 touch-drop recovery
and its verifier (`touch-drop.mjs`) are removed, because the functional call no longer depends on a synthetic touch. The
findings above (runs 4 – 6, the touch-drop mechanism) stay as recorded. No other retry was added; ITG-03's one recorded
exception is unchanged.

**The functional cases start and end the call without a touch.** The proof root follows the proof server's call commands
(`apps/mobile/src/voice-call/__validation__/s806cp3-call-commands.ts`):
- `POST /proof/call?do=start|end` queues ONE command, refused while one is unanswered.
- `GET /proof/call/next` hands it out once. The server holds that request until a command is queued or 20 s pass, so the
  app keeps one open request and does not poll. A request whose connection closed while held takes nothing.
- The proof root calls exactly what the Conversation's controls call on the current session's own CallOwner: the call
  entry's `if (!preparing) void owner.start()` and the call line's End `owner.end()`.
- It then acknowledges what it did, with the owner's stage just after (`POST /proof/call/ack`, once per command). Each
  case waits for that acknowledgement in the server's evidence (`host/02-command.jsonl`, `host/04-command.jsonl`).

Everything after the command is the app's own call: capability, the server's truth, the microphone permission, consent,
the platform call, the native audio engine, the connection and protocol, the S8B-05 backend and the attention lane. The
assertions are unchanged: ACTIVE (ITG-02), PLAYED_OUT (ITG-03), USER_ENDED with the call line gone and the Analysis staying
(ITG-04), both tracks written and settled (ITG-05), and stability (ITG-06). The command mechanism is proof-only: the
proof root is mounted only by the proof build's selected entry, no Product module reaches it (pinned by the contract), and
the server routes live only in the proof server. It proves the call, not physical touch delivery.

**UI touch, reported separately.** After the functional cases, `ui-touch.tsv` records three real taps, each once, as
PASS / FAIL / NOT TESTED:
- UT-1: the door back to the Conversation draws the call entry again;
- UT-2: a tap on the call entry opens a second call the server holds ACTIVE;
- UT-3: a tap on End ends it USER_ENDED.

They never change the job's result and are never counted as functional evidence. The job summary shows them under their
own heading.

**Verified locally before the push:**
- **The real proof server and the real follower module together** (a throwaway clone, port 8826). Each command was taken
  and executed within about 20 ms of being queued. A second command while one was unanswered was refused (409), a replayed
  acknowledgement was refused, and an unknown command was refused (400). The follower made no request during 3 s idle.
- **The runner's own `call_command` helper against that server.** Start and end pass with their acknowledgements kept.
  With no app following, it fails after its 30 s wait with nothing executed. A follower killed while its request was held
  took nothing; the live follower then took and executed the command at once.
- **Jest** (`s806cp3-call-commands.test.ts`, 3 tests, plus the call suites: 83/83), the mobile type-check and lint, and
  the proof server's type-check.
- **The ITG contract** (6/6). It pins the command-driven ITG-02 and ITG-04, no touch in any functional case, the waited
  acknowledgement, single consumption, the loopback-only base, the proof-only reach, the separate exit-neutral UI touch
  section, and the removed exception. It plants fourteen new reversals.
- **Every root contract** (1 883 / 1 883) and the task-closure governance contract (25 / 25).

**The run on the final head — CP1 ACCEPTED at checkpoint level (Product Owner, "INTEL-LIVE-01 — CP1 Acceptance & CP2
Execution Authorization", 2026-11-25), on head `0044f56e` of #415:**

| Run | Result |
|---|---|
| iOS Targeted Gate `45678917888` | SUCCESS: ITG-01 – ITG-06 **6 / 6 PASS** |
| UI touch (separate, exit-neutral) | UT-1 **FAIL** (infrastructure: the simulator flow's timeout); UT-2 and UT-3 **NOT TESTED** (not reached). Kept as reported; never functional evidence |
| API CI `45678917950` | SUCCESS |
| Mobile CI `45678917980` | SUCCESS |
| World gate `45678918023` | **CANCELLED** under the Product Owner's CP1-only exception (never reported as passed). The exception ended with CP1: CP2 applies BG-10 and the impact planner (§6.2) |

The evidence of every CP1 run is kept. CP1's tests are not re-run unless CP2 has a real impact on them.

## 4. Paid spend (D-7)

| Provider | Ceiling | Spent (estimated at list price) | Basis |
|---|---|---|---|
| Speechmatics realtime Enhanced | USD 0.30 | **≈ USD 0.150** | 675 s of audio at USD 0.80 / h |
| DeepSeek Flash | USD 0.30 | **≈ USD 0.266** (5 runs: 0.0412 + 0.0405 + 0.0392 + 0.0741 + 0.0705) | provider usage fields at the PEAK list price (0.006 / 0.30 / 1.20 per M) |
| **Combined** | USD 0.60 | **≈ USD 0.416** | |

DeepSeek's remaining ≈ USD 0.034 does not cover another full A8′ run (≈ USD 0.07), so no further paid run is planned at CP1.

No cost ledger row was written (the proofs reach no hosted service). Keys were read from local files into memory only.

## 5. Findings for the Product Owner

- **F-1 — the lane needs provider capacity, and the critical window does not reclaim capacity already in use (A4
  stress, 2 shared slots, 4 calls):** First Audio ON − OFF = +1 578 ms P50 / +1 789 ms P95 (harness noise 85 / 143 ms), with
  ON and ON_UNGATED alike: the evaluations admitted before the commit still hold the slots when the reply asks for one. At
  the established capacity (8 slots, §3.4) the lane is within noise. The lane's demand is about one provider call in flight per
  speaking call; GCR-01-A's capacity proof (`QAN-BL-VOICE-07`'s gate, the +50 / +100 ms First Audio rule) must count it. No
  mechanism was added: reclaiming a slot from an in-flight evaluation would be a contract change.
  F-1 is retained under GCR-01-A (directive §6).
- **F-2 — A8′'s false-update clause (§3.2):** resolved by directive §2's interpretation. Under it, v5 has 0 fabricated
  interpretations, 0 factual contradictions, 0 attribution errors and 0 meaningful omissions, and no mechanical
  duplication is left. Recall is 21 / 21. The Product Owner reviews the reading.
- **F-4 — labels that nearly quote the speech (§3.2):** a presentation note for CP2. No paid iteration was spent on it.
- **F-3 — (f)'s "in flight" check** depends on the evaluator's latency: with the real evaluator (faster than the oracle's
  slowed evaluation) the development arrived when nothing was in flight. The mechanism is proven with the fake (§3.1).

## 6. Verification

```sh
npm run test:live-call-attention-contract
node --test tests/intel-live-01-provisional-attention-contract.test.mjs
npm run verify:live-call-attention:integration
npm run test:task-closure-governance-contract
```

- API jest (local, this machine): **350 suites, 7 898 passed, 1 skipped, 0 failed** (full `apps/api` suite, 2026-11-25, CP1 head `0cd3380b`); after the directive's changes, 7 901 passed (below).
- The lane's static contract and the touched contracts (AI-COST-01, S8B-02, S8B-05, canonical home placement, Thread
  establishment), the six files in one run: 139 / 139; `test:live-call-attention-contract` 15 / 15;
  `test:task-closure-governance-contract` 25 / 25.
- `database/verify-migration-0204.mjs` on a fresh local clone through `0204`: passed.
- The proofs: `cp1-corpus-proof.ts` (FAKE: 13 / 13 scenarios), `cp1-first-audio-proof.ts` (A4), `cp1-cadence-proof.ts`
  (A0), `cp1-corpus-proof.ts` (DEEPSEEK: A8′).
- The forward-safety suite has ten known local failures on this Windows machine; CI judges it.

**Directive §5: the T-03B1b1 API CI failure, corrected.** API CI run 45551333606 on `0cd3380b` failed two contracts:
- `tests/durable-reference-emerging-focus-sp-substrate-contract.test.mjs`: "the new writer, coordinator and context read
  are production-inert";
- `tests/durable-thread-home-same-sp-substrate-contract.test.mjs`.

**Cause.** Both scan every script for the substrate's tables. CP1's local corpus proof
(`apps/api/scripts/intel-live-01/cp1-corpus-proof.ts`) seeds its throwaway clone with one emerging-focus row and one
Thread row. INTEL-04's proof already had the same need, and an exact allowance for it.

**Correction, on INTEL-04's pattern.** The proof's two INSERT texts are pinned verbatim. Each must:
- occur exactly once;
- be a plain INSERT into its table;
- carry no UPDATE, DELETE, SELECT, CALL or `_v1(` call;
- sit beside the proof's loopback refusal.

The rest of the file is scanned exactly as before. No forbidden expression was loosened or removed. Negative test: a
substrate line appended to the proof makes both contracts fail; it was reverted in place.

**After the correction:**
- both contracts 10 / 10;
- every root contract `node --test tests/*.test.mjs`: **1 873 / 1 873** (811 s, this machine);
- the gate's own contract `tests/intel-live-01-ios-targeted-gate-contract.test.mjs` 4 / 4, wired into
  `test:live-call-attention-contract`; its planted regressions are each refused;
- the lane, call-turn and analysis suites 97 / 97; the full API jest **350 suites, 7 901 passed, 1 skipped, 0 failed**.

### 6.1 Impact-based CI (directive §4 / §5)

| Gate | Before (CP1 head `0cd3380b`) | Now | Skip justification |
|---|---|---|---|
| iOS World gate (3 cells × full COSMOS matrix) | ran for the API change: run 45551333609, **108.8 min** wall; cells SE 84.2 min (success), ar 80.8 min (**failure**: the Personal Analysis did not open, its cases NOT TESTED), en cancelled by me at 108.8 min | not triggered by `apps/api/**` or `database/**` | its app is the S401 proof build over the SYNTHETIC network: it reaches no API and no database (CI-SPEED-01), so no backend change can change one of its cases. Every suite, case and assertion is kept, and a push to main runs it in full |
| iOS Targeted Gate (live call) | did not exist | one cell (iPhone 17, iOS 26.5), triggered by the live-call backend and client; first run 45571644129: job 43 min, gate step 13 min, cases about 7 min (§3.6) | — |
| API CI `verify-api` | 2.3 min (failed early) | PENDING its run on this head | unchanged: VAL-01's planner already carries a green, unchanged result forward |
| Mobile CI | 7.0 min (no mobile change: VAL-01 carried the native gates forward) | unchanged | VAL-01 |

The World gate's ar failure on `0cd3380b` is not CP1's. CP1 changed no mobile file, and the gate cannot reach the API.
The same instability is on `main`: run 45525952531 on `aa6fc0c8` failed en and SE and passed ar. This is
`QAN-BL-CI-04`, which stays open and unowned.

On `6400dc37` the World gate ran once more, because that change edited the gate's own workflow file (its triggers
only). Run 45571643998 was cancelled, and it is recorded as cancelled, not passed.

### 6.2 The World gate, impact-aware (PO, 2026-11-25, on the CP1 resolution)

**The PO's correction.** Even without the API and the database, the World gate still ran for every `apps/mobile/**`
change, and on every push to main. That would bring the same unrelated full-matrix testing back during CP2 and CP3. It
now decides from the change itself.

**How it decides.** A `plan` job runs `scripts/cosmos-ios-world/world-gate-impact.mjs` before the three cells:
- for a pull request, on its merge-base diff;
- for a push to main, on the push's own `before..after`;
- for manual dispatch, it always answers RUN.

The gate is skipped only on the plan's literal `NOT_AFFECTED`. A failed, empty or doubtful plan runs every cell. The
plan's summary lists every changed file with its class and reason, and a skipped gate is stated as "did NOT run (not
passed)".

**What runs it:**
- the gate's own inputs: its workflow, scripts, flows and XCUITest, the S401 proof entry, root and selector, its
  composition contract, and the analysis with its test;
- the iOS binary's shared dependencies: the lock; the manifests beyond their `scripts` (read against the base; without a
  base, a manifest change runs it); the app config; the plugins; the assets; the locales; native iOS code; the shared
  packages;
- any mobile source in the **protected closure**.

**The protected closure** is what the protected surfaces import, directly or through any chain of imports. The surfaces
are COSMOS, the map layer it draws through, the orientation and return chrome, temporal navigation, the Analysis
composition hubs (`DepthComposition`, `LivingAnalysisMap`) and the S401 proof world. The import graph follows symbols
through barrels: importing one name from an `index.ts` reaches only the module that defines it. Type-only imports are not
followed. The hubs are followed in full, because the hooks and components they mount run while the gate navigates the
Analysis. On the current tree the closure is 376 of the 533 mobile sources.

**What does not run it:** the API, the database, documentation, Jest tests, other suites' Maestro flows, mobile tooling,
Android-only native code, and the 157 mobile sources no protected surface reaches.

**The functional scope (PO, 2026-11-25, on the CP1 report).** 376 of 533 shows that reachability alone is too broad a
regression scope. The analysis now decides only whether COSMOS can be affected. A functional classification of the change
decides how much of the gate that warrants. The plan's `scope` is one of three:

| Scope | When | What runs |
|---|---|---|
| `FULL` | the gate's own inputs, a shared dependency, a protected surface itself, a reached source no targeted gate owns, or any doubt (a failed, empty or unreadable plan included) | every cell, World and native gesture, unchanged |
| `COSMOS_CASES` | every reaching file belongs to a surface the Analysis mounts that has its own mandatory iOS Targeted Gate: today the live call (`src/call/`, `src/voice-call/`, the call engine's own Swift in `modules/qandeel-voice-call/ios/Core|Expo/`) | the reference cell only (`i17-en`); the Analysis entered with the surface mounted, the stage initialized, then P-TAP and F1-RESOLVED with their unchanged assertions; both must PASS |
| `NOT_AFFECTED` | as above | nothing; the summary says "did NOT run (not passed)" |

The widest scope any file needs wins. The vendored codec and the module's build files are `FULL`, because they change how
the binary builds. Under `COSMOS_CASES` the other cells, the other Worlds, the pans, the landscape cases and the native
zoom / pinch / pan run are not run. They get no row, the summary states it, and none is reported passed. The changed
surface itself is proven by its targeted gate. The test asserts that each targeted surface's paths are in its gate's
pull_request and push triggers.

**What it means for CP2 and CP3.** A change to what the stage renders still runs the full gate. A change confined to the
call client runs the iOS Targeted Gate and the COSMOS cases above, not the full matrix. Mixed with anything wider, it runs
the full gate.

**Unchanged:** the full gate's suites, cases, assertions, matrix and pass rule; the composition contract and its planted
regressions, as written. The iOS Targeted Gate's push to main is impact-aware the same way: it uses the same paths as its
pull requests.

**Tests.** `tests/cosmos-ios-world-gate-impact.test.mjs`, run inside `test:cosmos-ios-world-gate-composition-contract`
(API CI, and the gate itself before it builds). It covers:
- the parser: type-only imports, named re-exports, star re-exports and side-effect imports;
- every decision class;
- the real closure: COSMOS and the hubs in, no test, no other proof's entry or root;
- the workflow's fail-safe wiring;
- planted regressions: a lockfile or shared package never NOT_AFFECTED, a failing analysis answers RUN, a `RUN`-only
  condition refused;
- prose without naming it. The analysis asks VAL-01's own classifier what a doc is. Before this, the analysis's own
  `.md` path regex made VAL-01 count it as a reader of every doc, and the full root run caught that. The forward-safety
  mirror failed in 10 tests, because a docs-only delta lost its heavy-gate carry-forward. The test now asserts the
  analysis binds no doc; the old text was checked to bind one.

- the functional scope: every class's scope, the widest-wins rule, the targeted gates' triggers, the cell filter, the
  native steps skipped only for `COSMOS_CASES`, and the runner block (initialization first, both cases PASS, no pan,
  landscape or other World). A protected surface is never narrowed.

A manifest dependency edit was checked to answer RUN, and a scripts-only edit NOT_AFFECTED. The plan step's own shell,
run under `bash -e` on real history, answered:
- `RUN / COSMOS_CASES` with the cell `i17-en` for `6f7c0f7b` (a `call-owner.ts` change);
- `RUN / FULL` with all three cells for this change.

**Case selection exists for the targeted scope only.** `FULL` runs every case in every cell. The `COSMOS_CASES` path is
proven by its contracts and that simulation; it has not yet run on CI. Its first real run is the first call-client-only
change, CP2 or CP3, and it will be recorded there.

**This change's own plan.** It edits the gate's workflow, runner and analysis, which are gate-own inputs, so the plan
answers `RUN / FULL` on this head. That is correct: the gate itself changed. Its result is recorded as it actually ends.

**Measured reduction for a live-call backend change:** 3 World gate cells of about 80 – 110 min each, about 270 runner
minutes, become one targeted cell (its first run: 43 min for the job, 7 min for the cases). The iOS obligation is still met, by interaction with what
changed.

**Exact-input evidence (PO, 2026-11-25, after run 45601664654).** A pull request's change set is cumulative. Once one
commit edited the gate's own files, every later push ran all three cells again, including pushes that only corrected the
targeted gate.

On a pull request, a decision of RUN now becomes NOT_AFFECTED only when all of the following hold:
- an earlier head of the SAME pull request has a successful World gate run that passed **every** cell (a `COSMOS_CASES`
  or skipped run has fewer);
- that head is in the current head's history;
- the planner itself, run on everything changed since that head, answers NOT_AFFECTED. A change to the gate's own files
  never qualifies.

Any failed read leaves the decision RUN. A push to main never reuses evidence. The summary names the run and the head
reused, and says "did NOT run again".

The impact test pins each condition and plants each regression. The plan step's own shell, run under `bash -e` with a
stub run history, gave:
- evidence on `8c623882` with every cell passed → NOT_AFFECTED;
- the same evidence with one cell → RUN;
- evidence before the gate's own edit (`6400dc37`) → RUN;
- a head outside the history, no history, or the current head itself → RUN;
- an ineligible row, then an eligible one → the eligible one.

The change edits the gate's workflow, so its own plan answers `RUN / FULL` once. Later pushes that reach nothing reuse
that pass.

**That FULL run did not pass, so there is nothing to reuse.** Run 45612961126 on `885c89ed`: the iPhone 17 en and ar
cells failed, with no assertion failing.
- **en:** the wait for the Personal Analysis door (`p-door`, 109 s) timed out, so P-TAP-RAIL, P-TAP, F1-RESOLVED,
  P-PAN and P-PAN-RAIL are NOT TESTED. Every Shared, Public and native case passed.
- **ar:** the wait for the World list (`se-worlds`) timed out, so S-EMPTY is NOT TESTED.

Both are readiness waits that left cases NOT TESTED: the open `QAN-BL-CI-04` residue, which main records too. The PR
changes no application source the gate exercises; its `apps/mobile` changes are the targeted gate's own Maestro flows.
The rule is not relaxed for this, and the next head runs FULL again. It is not reported as passed. The iPhone SE (3rd
generation) / iPhone 16e en cell passed every case.

**The second FULL run did not pass either.** Run 45630621888 on `4b60bc85`: the SE / 16e and iPhone 17 ar cells passed
every case. The iPhone 17 en cell left U-TAP, U-LAND and U-EMPTY NOT TESTED: the waits for the Public field
(`u-field`) and the Public World (`ue-allow`) hung and were stopped by their bound (exit 124), the same `QAN-BL-CI-04`
residue. No assertion failed in either run. Every case has passed in at least one of the two runs, but the rule asks for
one run that passed every cell, so nothing is reused and the final head runs the gate FULL again.

**The third FULL run did not complete.** Run 45659136585 on `fdac42be`:
- **iPhone 17 en:** the Personal Analysis door wait (`p-door`) was not met, so P-TAP-RAIL, P-TAP, F1-RESOLVED, P-PAN and
  P-PAN-RAIL are NOT TESTED. Every other case passed, the native Personal XCUITests included.
- **iPhone 17 ar and SE / 16e:** never ran. GitHub reported "The job was not acquired by Runner of type hosted even after
  multiple attempts" (macOS arm64 capacity), and cancelled both after 15 minutes with no step run. Every case in them is NOT
  TESTED.

**The accumulated evidence, for a narrow CP1-specific PO exception (not a change to the permanent rule).**

| Cell | 885c89ed | 4b60bc85 | fdac42be | Every case passed in at least one run |
|---|---|---|---|---|
| iPhone 17 en | 26 PASS, 5 NOT TESTED (P-*) | 28 PASS, 3 NOT TESTED (U-TAP, U-LAND, U-EMPTY) | 26 PASS, 5 NOT TESTED (P-*) | yes: P-* in `4b60bc85`, U-* in `885c89ed` and `fdac42be` |
| iPhone 17 ar | 30 PASS, 1 NOT TESTED (S-EMPTY) | **31 / 31 PASS** | not run (no runner) | yes, all in one run |
| SE / 16e en | **31 / 31 PASS** | **31 / 31 PASS** | not run (no runner) | yes, all in one run (twice) |

- **No assertion failed** in any run: 0 FAIL across the seven cell runs. The same 31 cases ran in each.
- **Every NOT TESTED is infrastructure.** Each is a readiness wait not met or hung (`p-door` and `se-worlds` exit 1,
  `u-field` and `ue-allow` exit 124: `QAN-BL-CI-04`), or a cell GitHub never ran.
- **Protected-input equivalence.** The impact planner gives NOT_AFFECTED for `885c89ed..fdac42be` and
  `4b60bc85..fdac42be`, and for this head's change over `fdac42be`. Every file between them is outside the iOS binary
  or reached by no protected surface. Against main, the PR's only World gate inputs are the gate's own four files (its
  workflow, runner, planner and the planner's test), identical in all three runs. No application source, native input or
  asset the gate builds differs from main, and the root manifest differs only in its `scripts`.
- **Conclusion:** no affected application functionality is unverified in the accumulated results. Each case passed on
  equivalent inputs. This is not reported as one passing run.

**The PO's decision (2026-11-25): the narrow CP1-only World gate exception is APPROVED on this evidence.** The basis:
- 93 / 93 device-specific cases (31 cases × 3 cells) passed across equivalent-input runs;
- zero failed functional assertions;
- no affected COSMOS application source, native input or asset changed;
- the remaining incomplete cases are `QAN-BL-CI-04` or runner availability.

Its terms:
- It holds only for CP1, on the per-case matrix and the protected-input equivalence above, which are preserved as they are.
- It is not a successful World gate run and is never represented as one.
- The permanent World gate workflow and its requirements are unchanged.
- The full World gate run that the CP1 validation push starts automatically is cancelled under this exception. The
  targeted gate and the other required checks are not cancelled.

### 6.3 Migration 0204 and the earlier verifiers' exact sets

API CI 45571644014 on `6400dc37` failed in `verify-migration-0171` C-1 (`20 !== 19`): 0204 adds `LIVE_ATTENTION_EVALUATION`
to the cost-family CHECK. The CI job stops at its first failure. So every verify step after it was run locally, directly,
against a fresh clone migrated through 0204 on the local PostgreSQL (never `npm run verify:*`, never the `.env` database).
That run found the rest.

All twelve were re-anchored, migration-aware, in the repository's established forms. Each adds exactly 0204's part once
0204 is applied (detected by its own object) and holds it to the same rules. No assertion was removed, no migration
changed, and every rejection and integrity assertion stands.

| Pinned set | Verifiers | Re-anchor |
|---|---|---|
| the cost-family CHECK | 0171 C-1, 0174, 0175, 0176, 0181 B05, 0182 B06 | `database/live-attention-cost-family-0204.mjs` (probe and the one family; the 0184 voice-family form) |
| the `voice_private` function census | 0183 S0b, 0185 C0, 0186 C0b | `voiceInternals0204()` in `database/replay-rb2-census.mjs`, derived from 0204's ACL block (seven internals), never copied |
| the migration order after 0196 | 0194 S, 0195 S4, 0196 C1d | exactly 0204 follows 0203 |

**Local evidence.**
- The six cost-family verifiers pass on a pre-0204 clone and on a post-0204 clone.
- The census verifiers pass on the pre-0204 clone.
- The 37 verify steps from 0171's onward pass 33 / 37 on the post-0204 clone. The four left need Redis, which this machine
  does not run and CI provides: `post-response-dispatch`, `a2-e2e-runtime-smoke`, `full-intelligence-e2e-runtime` and
  `integrated-brain:e2e-hardening-v2`. They are NOT TESTED locally, not passed.
- The exact-head API CI run is the authority.

## 7. Draft PR #410 — transfer (CP0 v1.1 §8.3)

| File on #410 (head `55d016b6`) | Landed | Loss excluded by |
|---|---|---|
| `docs/e2e/QANDEEL_INTEL_LIVE_INCREMENTAL_UNDERSTANDING_GAP_v1.md` | same path, body verbatim + a dated addendum | `git diff 55d016b6:<path>` shows only the addendum |
| `docs/e2e/QANDEEL_S8B07_S4_INCREMENTAL_UNDERSTANDING_REPLAY_COMPATIBILITY_v1.md` | same path, verbatim + addendum | the same |
| `QAN-BL-INTEL-06` in the backlog | verbatim, four lines set by v1.1 §8.2 (each original quoted in the admission note) | side by side in the PR body |
| `QANDEEL_PROJECT_MAP.md` banner | superseded; its two document pointers are carried in the CP1 banner | the pointers |

#410 is closed only on the Product Owner's word, with a comment naming the CP1 commit.

## 8. Reports (outside the repository)

`E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1/`, all kept as measured:
- the mechanism runs: `cp1-fake-r3`, and `cp1-fake-r4` after the duplication filter;
- A8′, with their adjudication tables, rows and inputs: `cp1-a8-r1`, `cp1-a8-r2-v2`, `cp1-a8-r3-v3`, `cp1-a8-r4-v4`,
  `cp1-a8-r5-v5`;
- the cadence: `cp1-a0-r1`;
- A4: `cp1-a4-r1` (stress, 2 slots) and `cp1-a4-r2-slots8`.

The iOS Targeted Gate's evidence is the workflow artifact `ios-targeted-gate-live-call-<sha>`.

---

## 9. CP2 — Live Map Disclosure

**Authority:** the Product Owner's "INTEL-LIVE-01 — CP1 Acceptance & CP2 Execution Authorization" (2026-11-25): D-3 (an
additive protocol v3) and D-5 (the COSMOS presentation) approved, the B5′ / B6′ / B7 gates, the iOS Targeted Gate
extension, and the end of the CP1-only World gate exception. CP1's acceptance is recorded in §3.6 in this same change (no
documentation-only push).

**State:** `INTEL-LIVE-01 CP2 — DELIVERED / READY FOR PO REVIEW`. Not merged, not deployed. No product-readiness claim:
the product gate stays the HONOR Live + Replay proof. CP3 is not started.

### 9.1 What CP2 delivers

**Protocol v3** ([QANDEEL_LIVE_CALL_PROTOCOL_v3.md](../voice/QANDEEL_LIVE_CALL_PROTOCOL_v3.md)): v2 plus two server messages,
`ATTENTION` (one committed 0204 event) and `ATTENTION_STATE` (the call's open attention from one read of
`server_read_call_attention_state_v1`, in parts of at most 12). v1 and v2 are unchanged byte for byte; a phone that offers
only v2 or v1 is never sent a v3 frame. Android offers v3, v2, v1; iOS offers v3, v1 and answers every clock mark `null`.

**Server** (`apps/api/src/voice/call/live-call.protocol-v3.ts`, `live-call.connection.ts`, `live-call.gateway.ts`,
`live-attention/call-attention.tracker.ts`, `call-attention.repository.ts`, `live-attention.provider.ts`, the analysis
worker's settlement signal):
- the gateway selects v3 > v2 > v1 and accepts HELLO `v: 3` only on a v3 connection;
- after every `STATE ACTIVE` (fresh or resumed, any instance) the connection sends the database's attention state; the
  snapshot carries the call's highest `event_seq` in that read;
- every committed event is sent once, in `event_seq` order, the moment its write committed (`sentSeq` guard: never twice,
  never a snapshot older than an event already sent — such a read is discarded and read again);
- the state is re-read after a settlement written on this instance (the worker's signal), every 5 s for at most 120 s while
  open subjects remain after a committed turn (a settlement written by another instance), and 1 s after a dropped frame;
- **audio first:** an attention frame is never queued behind more than 64 KiB towards the phone; it is dropped and the
  state re-sent later. Nothing on the voice path awaits the disclosure;
- with the lane OFF, or on v1 / v2, nothing is sent (`NOT_LISTENING`).

**Phone** (`apps/mobile/src/voice-call/live-call-protocol-v3.ts`, `live-call-client.ts`,
`apps/mobile/src/call/provisional-attention.ts`, `call-owner.ts`):
- the client offers v3 (`offerAttention`), parses v3 frames strictly, and passes them to the call owner;
- `ProvisionalAttention` holds the call's layer: part 0 of a snapshot replaces it once the snapshot is whole and not older;
  afterwards only events with a higher `seq` apply; `SET` opens or updates, `WITHDRAW` / `CONFIRMED` / `EXPIRED` remove;
  a subject is `track` + `subjectKey` (USER and QANDEEL never merged);
- no debounce, no timer, no count gate, no meaning on the phone;
- the owner drops the layer at the call's end (a new call starts empty); after a reconnect the server's snapshot restores it.

**COSMOS (D-5)** (`apps/mobile/src/cosmos/core/stage.ts`, `product/owners/personal.ts`):
- `SceneInput.attention` (undefined: the stage is byte-identical to before — a golden pins every rung's digest);
- a subject on a Thread drawn at the rung is a **glow**: one PUFF in the body's own dye, alpha 0.28, 1.6× its halo;
- any other subject is an **ember**: one WARM SPARK, alpha 0.6, size 14, with an ordinary label, placed about the rung's
  drawn centroid by the stage's own `orbitOf` (a presentation position that carries no meaning);
- no hit target, no line, no new draw pass; at most 12 marks per rung (the newest); the Personal owner folds the call's
  layer into every rung's scene and recompiles only when the layer changes (it is part of the memo key);
- AR / EN and RTL / LTR follow the stage as before; protected assets, gestures and the Shared and Public worlds unchanged.

**Proof-only (never in a Product build):**
- `apps/mobile/src/voice-call/__validation__/s806cp3-attention-probe.ts`, mounted only by the S8B-06 CP3 proof root.
  It is OFF unless the proof server answers `{ on: true }` and only watches: the owner's attention notifications, a mirror
  of the Personal COSMOS owner's stage digest, and a 2 s tick of the layer's seq while a call runs. It reports numbers
  (instants on the server's clock, seq, mark count, digest) — never a label or a word. Nothing is injected into the layer,
  the reducer or the map.
- the proof server (`apps/api/scripts/s8b-06-cp3-device-proof-server.ts`): scenarios (a) and (d) from the CP1 corpus
  with the fake evaluator (`PROOF_ATTENTION=ON`), an optional CP1 latency model, `speak-scenario`, an attention hold for
  the open epochs, a socket drop, and the probe's endpoints.
- `scripts/ios-targeted-gate/attention-checks.mjs` and ITG-07 / ITG-08 / ITG-09 (§9.4).

**Not changed:** Prompt v5, the evaluator, semantic freedom, the producer's thresholds (none), migrations (no new
migration; `0204` unchanged), Lane A, Replay, the voice path, the endpointer, ASR, the model, any hosted resource.

### 9.2 B1 – B4

| Gate | Evidence |
|---|---|
| B1 — v3 additive; v1 / v2 unchanged | `live-call.protocol-v3.spec.ts`; the gateway e2e (v3 selected, v2 / v1 answered exactly as before, HELLO `v` checked); the static contract `tests/intel-live-01-live-call-protocol-v3-contract.test.mjs` |
| B2 — only committed events; snapshot after ACTIVE replaces; then only newer seqs; snapshot / event race | `call-attention.disclosure.spec.ts` (an event committed while a snapshot read is in flight: the older read is discarded and re-read; never a duplicate, never a regression); `provisional-attention.test.ts`; the CP1 corpus proof's B2 checks (FAKE) |
| B3 — bounded transport, First Audio priority | the 64 KiB bound and the dropped-frame re-read (`call-attention.disclosure.spec.ts`); no `await` of disclosure on the voice path (static contract) |
| B4 — phone: SET / WITHDRAW / EXPIRED / CONFIRMED, no gate, cleanup at end, restore after reconnect, no cross-call leakage, USER ≠ QANDEEL | `provisional-attention.test.ts`, `call-views.test.tsx`, `finished-call-record.test.tsx`, `cosmos-personal-attention.test.ts`, `attention-marks.test.ts` (and its golden) |

### 9.3 B5′ / B6′ — Android emulator evidence (fake providers, local)

Recipe: a local PostgreSQL clone with `0204`, the proof server with the fake evaluator, the proof APK
(`com.qandeel.mobile.s806proof`, x86_64 release, cleartext to the loopback reverse port only) on the emulator
`QANDEEL_API36` (720 × 1600), the per-app locale for AR / EN. These runs used proof APK `6cbafde8…`, built before the probe's 2 s tick was added (§9.4); the tick adds a row and changes no T4 measurement. The phone's stage digest is timed by the probe on the server's
clock (offset from the fastest of five round trips; the server's own handling ≈ 1 ms). T4 = server send → the phone's stage
digest change. A development is a **successful live disclosure** when it was on the phone's stage before the durable Lane A
disclosure of its subject while the call continued — or, for a subject withdrawn within the call, while it was open.

| Run | Language | Class | n | T4 P50 / P95 (ms) | On the stage before Lane A |
|---|---|---|---|---|---|
| (a) fake | EN / LTR | IN_SPEECH | 3 | 3 / 4 | 8.4 – 85.3 s |
| (a) fake | EN / LTR | QANDEEL | 1 | 3 | 11.6 s |
| (d) fake | AR / RTL | IN_SPEECH | 6 | 3 / 55 | 21.2 s and 8.1 s for the two that settled; the four others withdrawn within the call |
| (d) fake | AR / RTL | QANDEEL | 1 | 15 | 11.5 s |
| (a) CP1 latency | AR / RTL | IN_SPEECH / QANDEEL | 3 / 1 | 5 / 6; 6 | all |
| (d) CP1 latency | EN / LTR | IN_SPEECH / QANDEEL | 6 / 1 | 5 / 46; 4 | all |
| (d) speech ended on the negation | AR / RTL | IN_SPEECH | 4 | 5 / 19 | all |
| (d) speech ended on the negation | AR / RTL | **TAIL_AFTER_SPEECH_END** | 2 | 5 / 34 | 4.8 s |
| (d) speech ended on the negation | AR / RTL | QANDEEL | 1 | 5 | all |

Every development in every run was a successful live disclosure; 0 frames dropped. The upper bound of T4 (the report's
arrival) was 9 – 113 ms. The P95 tail (34 – 55 ms) is the second frame of a correction (its SET after its WITHDRAW, two
frames of one write).

Screens (`E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP2/b5/<run>/shots/`, each frame with its time, the digest that triggered it,
the pixel diff against the previous frame, and a contact sheet): before the call; the call active; after each development;
after each correction or withdrawal; the QANDEEL-side mark; after the reply; after the settlements; after the end (the map
as before the call). In (a), each development changed 1 491 – 3 649 pixels within the map; the settlements removed the
marks (7 111 pixels); the end restored the pre-call map. In (d), the person's correction (Cairo → Alexandria) and the
negation (gym tomorrow → leg pain) each replaced one ember with another; the QANDEEL ember appeared and left on its own.

**B6′ and TAIL:** with the fake evaluator (0 ms) and the CP1 latency model (650 – 1 500 ms), every USER development of a
full scenario was produced while the person was still speaking: TAIL arises only when speech ends right after the
development's words. It was exercised by ending the speech on the negation segment (the last row). IN_SPEECH and TAIL are
reported separately, never merged.

### 9.4 The iOS Targeted Gate — CP2 extension

Its server now runs `PROOF_ATTENTION=ON`, scenario (d), with the probe on. The command-driven start and end are reused;
the UI touch section stays separate and exit-neutral. Three cases are added, in this order:
`ITG-01 ITG-02 ITG-03 ITG-07 ITG-08 ITG-04 ITG-09 ITG-05 ITG-06`.
- **ITG-07 — v3 and disclosure:** v3 selected on the call's epoch (the snapshot sent); every clock mark answered `null`
  (iOS); scenario (d)'s first five segments spoken; the person's SET and WITHDRAW committed; the phone's layer reached the
  database's `seq` with its open subjects; the Personal stage's digest changed with marks; the reply still played out.
- **ITG-08 — reconnect and restore:** the attention frames of the open epoch are held (proof-only), the negation is spoken
  and committed; the phone is proven behind; the socket is dropped; the call resumes on a new epoch, the hold is lifted,
  and the snapshot restores the phone to the database's `seq` and open subjects.
- **ITG-09 — end cleanup:** after the command-driven end, the phone holds no mark, the stage digest has no mark, and the
  first applied row after the end is not ACTIVE.
- **v1 / v2 compatibility** stays proven by the API gateway e2e and the static contracts (the iOS app offers v3, v1 only).
- COSMOS compatibility is the World gate's (§9.6).

The gate's contract (`tests/intel-live-01-ios-targeted-gate-contract.test.mjs`) pins the case order, the checks and the
probe's limits (it reads, never dispatches; off by default; the hold limited to the open epochs) and plants 13 new
reversals.

**Rehearsed locally on Android before the push** (the same server, checks and sequence on the emulator, proof APK
`e5aea815…`; `E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP2/itg-local-android-r2/`): v3 OK (the state sent on epoch 1); applied OK
(database `lastSeq` 5, open 1; the phone at seq 5 holding 1); COSMOS OK (the digest changed with a mark); behind OK (the
phone at seq 6, the database at 9); dropped, resumed on epoch 2; restored OK (the state of seq 9 sent on epoch 2; the
phone at seq 9 holding 1); cleanup OK (no mark held or drawn after the end). `noclock` does not hold on Android, as
expected: Android answers marks with real positions; the check is iOS's. A first rehearsal failed `restored` because the
settlement reached the database before the resume, so the restored state equalled what the phone showed and nothing was
notified: the probe now reports the layer's seq every 2 s while a call runs (a tick), and ITG-08 drops the socket as soon as
the negation is written. The iOS run on the pushed head is the gate's evidence; nothing is reported for it before it ran.

**The first iOS run on the CP2 head (`d8d9edd7`, run `45716615306`): HARNESS failure, corrected.** ITG-01, ITG-02,
ITG-03 and **ITG-07 PASS** on iOS: v3 negotiated (the state sent on epoch 2), **143 of 143 clock marks answered `null`**,
a SET and its correction reached the phone, which matched the database (seq 7, 0 open), and the stage digest changed with
a mark. **ITG-08 FAIL:** "the lane did not write the scenario's negation within 120 s"; ITG-04, ITG-09, ITG-05 and ITG-06
NOT TESTED (not reached). Classification: **harness, not product**. The proof server's scripted recognizer answered each
FINAL with the next line of one script, counted per recognition session: which corpus words a spoken segment received
depended on how many FINALs came before it in that session — a reconnect (iOS was already on epoch 2) restarts the
count, and an endpointer that joins two segments into one utterance skips one. Either gives the lane other words than
the segment spoken. Which of them happened on that run is not determined from the log alone (the evidence artifact was
not downloaded); the case's own wait and assertions were not the cause. **Correction (proof-only):** under a scenario,
each FINAL now answers exactly the scenario segments whose stimulus was used up since the previous FINAL (all of them, in
order), in whichever session hears it; any other utterance answers the next numbered line, counted across sessions.
`FakeCallRecognizer` (testing only) accepts such a line source; the proof server records, as counts only, how many
segments each FINAL answered (`scripted-final`). No assertion, timeout or case changed. The Android rehearsal passes
again on a fresh clone (`itg-local-android-r3`: v3, applied, COSMOS, behind, restored on epoch 2 at seq 9, cleanup OK).
The run on the corrected head is the gate's evidence.

### 9.5 B7 — performance

| B7 requirement | Evidence |
|---|---|
| No await on the audio path | the disclosure is fire-and-forget behind the 64 KiB bound; the v3 static contract fails on an await of it in `voice/`; the A4 measurement (§3.4) is unchanged in kind: CP2 adds no provider call and no permit |
| COSMOS open time | with no call (attention undefined) the stage is byte-identical (the golden pins every rung's digest), so opening the map compiles exactly what it did |
| No gesture regression; no render loop | the Personal owner recompiles only when the layer's marks change (the marks are its memo key; a re-read or the glass returns the same compiled list — `cosmos-personal-attention.test.ts`); the layer notifies only when its marks change |
| `drawOpsAtRest` with 12 marks | a temporary benchmark (never committed; `E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP2/bench/b7-compile.json`), 24 / 72 entities per rung, 6 glows + 6 embers on every rung: `drawOpsAtRest` **1 / 25 / 25 / 25 / 25 with and without the marks**; sprites +12 per rung; hits unchanged; the five rungs' compile P50 311.9 → 316.4 ms, P95 349.2 → 360.6 ms (+1.4 % / +3.3 %, Node under jest, once per layer change) |
| F-1 | not claimed solved; unchanged (§5) |

The emulator runs (§9.3) played every reply out with the disclosure on; they are not a First Audio measurement (fake
providers on an emulator), and none is claimed.

### 9.6 CI on the CP2 head

**The first CP2 head, `d8d9edd7`:**

| Run | Result |
|---|---|
| API CI `45716615243` | **SUCCESS** |
| Mobile CI `45716615367` | **SUCCESS** |
| iOS Targeted Gate `45716615306` | FAILURE — ITG-01, ITG-02, ITG-03, **ITG-07 PASS**; ITG-08 FAIL (**harness**: the scripted recognizer's mapping, §9.4, corrected); ITG-04, ITG-09, ITG-05, ITG-06 NOT TESTED (not reached) |
| World gate `45716615254` (impact plan: **FULL**, CP2 changes `cosmos/`) | FAILURE — **92 / 93 PASS**: iPhone 17 en 31 / 31, iPhone SE 31 / 31, iPhone 17 ar 30 / 31. The one FAIL is **S-LAND** (the Shared World's detail sheet in landscape: the expand tap did not toggle the handle; the handle stayed on screen in every orientation). Classification: **not CP2** — the Shared World's stage receives no attention input and is byte-identical (the golden); S-LAND on `i17-ar` failed before on unchanged COSMOS inputs (the COSMOS-INT-01 contract's run table). Every Personal case, every pan and landscape case, and every native XCUITest passed in all three cells. No retry was started for it |

The corrected head's runs are reported in PR #415 and the delivery report; they are written here at the next executable
change, never by a documentation-only push.

**Local verification before the push:** API jest for the touched suites (`live-attention`, `voice/call`, `voice/call-turn`,
`live-analysis`): 17 suites, 193 / 193; API and API scripts type-check clean; mobile type-check and lint clean; mobile jest
for `call`, `cosmos`, `voice-call`, `integration`: 773 / 776 in one parallel run, the three failures being jest's 5 s
per-test timeout on `proof-root-deep-link` (2) and `cosmos-personal-centring` (1) under that run's load; each suite passes
alone, and the centring test's slowest case takes the same time with the base `personal.ts` (4.77 s) as with CP2's
(4.41 – 4.78 s); Mobile CI is the authority. The static contracts: v3 6 / 6, the lane 7 / 7, `test:live-call-attention-contract`
27 / 27, the ITG contract 6 / 6, the task-closure governance contract 25 / 25; every root contract `node --test tests/*.test.mjs`: 1 878 / 1 889. One failure was CP2's and is corrected: the T-12 barrel contract refused the probe's deep type import of `integration/runtime`; the probe now takes the runtime type from the Personal owner it mirrors (T-12 32 / 32). The other ten are the forward-safety mirror's known failures on this Windows machine (§6); CI judges them.

### 9.7 Findings (CP2)

- **CP2-F1 — settlements are EXPIRED in every synthetic run.** The synthetic Lane A does not confirm a subject; `CONFIRMED`
  removes a mark exactly as `EXPIRED` does and is covered by the unit tests, not by the emulator.
- **CP2-F2 — a correction is two frames.** The WITHDRAW and the SET of one write arrive 14 – 53 ms apart; with no debounce
  (directive), the stage shows the intermediate state for that long. The screenshots, taken 400 ms after a digest change,
  show the state after the second frame (a frame's file name is the digest that triggered it).
- **CP2-F3 — TAIL is rare under the measured latency** (§9.3); it was exercised, not inferred.
- **CP2-F4 — long labels are shortened** by the stage's frozen label rule (`LABEL_MAX_CHARS`), e.g. "الانتقال لإ…".
- **CP2-F5 — an ember label follows the frozen label placement.** Ember labels are ordinary labels: the greedy overlap,
  floor and edge rules may leave one out (observed in (d) with two embers open: both embers drawn, one label). The
  placement rules are protected; they were not changed.
- **CP2-F6 — no Live Focus Thread centre.** An ember is placed about the rung's drawn centroid, not a live focus.
- **CP2-F7 — the probe's mirror doubles the stage compile** in the proof build only (never in a Product build).
- **F-1 is not claimed solved** (B7): CP2 adds no provider call and leaves F-1 under GCR-01-A.

### 9.8 Reports (outside the repository)

`E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP2/`: `b5/` (every run: server events, screenshots with their times, the driver log, the
database's events, the analysis and the contact sheet; the first attempt kept as `scenario-a-attempt0`, the proof APK
without cleartext), `itg-local-android/`, `bench/`, `apk/` (the proof APK and its build logs).
