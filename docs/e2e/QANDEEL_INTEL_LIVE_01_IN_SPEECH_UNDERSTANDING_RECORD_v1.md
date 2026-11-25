# INTEL-LIVE-01 — Incremental In-Speech Understanding & Living Map Attention: Execution Record v1

**Status:** `INTEL-LIVE-01 CP1 RESOLVED UNDER THE PO DIRECTIVE OF 2026-11-25 / READY FOR PO REVIEW — A8′: RECALL 21 / 21 (PROMPT v5), THE UNANNOTATED EVENTS ADJUDICATED BY THE DIRECTIVE'S CATEGORIES (§3.2) — iOS TARGETED GATE (LIVE CALL): SEE §3.6 — API CI T-03B1b1 FAILURE CORRECTED — NOT MERGED — NOT DEPLOYED — CP2 NEXT, CP3 – CP4 NOT STARTED`
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

## 0. The checkpoint plan and where CP1 stands

| Checkpoint | Scope (contract) | State |
|---|---|---|
| **CP1** | The producer: migration `0204`, the lane, its wiring, the proofs A0 – A12 and A8′, the iOS Targeted Gate (live call) | **RESOLVED UNDER THE DIRECTIVE / READY FOR PO REVIEW** (this record) |
| CP2 | The live map: Live Call protocol v3 (additive), the phone's consumption, B5′ / B6 (successful live disclosure); iOS Targeted Gate: v3 with v1 / v2 fallback, updates and withdrawals visible, reconnect / restore, COSMOS compatibility | next |
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
| ITG-03 turn | `/proof/speak` arms a synthetic voiced signal; the endpointer commits, the reply is generated and closes `PLAYED_OUT`, which only the iOS engine's PLAYOUT confirmations produce; the call line is still drawn |
| ITG-04 end | a tap on End draws the call entry again; the server ends the call `USER_ENDED` |
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

**The simulator run:** `PENDING — the first run on this change's head`. Its result is recorded here as PASS / FAIL /
NOT TESTED per case. No case is reported before it ran.

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
| iOS Targeted Gate (live call) | did not exist | one cell (iPhone 17, iOS 26.5), triggered by the live-call backend and client; its time is PENDING its first run on this head | — |
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
minutes, become one targeted cell (its measured time PENDING its first run). The iOS obligation is still met, by interaction with what
changed.

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
