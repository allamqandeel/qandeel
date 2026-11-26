# QANDEEL — INTEL-LIVE-01 — CP0 Amendment A1 (v1.2): Semantic-Driven Continuous Understanding

**Status:** `INTEL-LIVE-01 CP0 v1.2 / AMENDMENT A1 DELIVERED — FOR PO REVIEW — NOT APPROVED FOR EXECUTION — NOTHING IMPLEMENTED`
**Date:** 2026-11-25
**Authority consumed:** the Product Owner's "INTEL-LIVE-01 — Binding PO Correction to CP0 v1.1 — Semantic-Driven Continuous
Understanding" (2026-11-25). It **rejects** the time-driven and word-count-driven trigger of v1.1 §3.2 and **retains** C2–C7.
**Amends:** v1.1 §3.2 (producer and trigger), the first-visible-change table, §5 acceptance, §6 cost, D-1, D-6, D-6b, D-7.
Every other section of v1.1 (and the v1.0 sections it kept) stands: attention marks (§3.7), referential settlement (§3.5),
append-only record (§3.4, extended below by one table), per-track Replay placement, protocol v3, retention, #410 plan, HONOR
gate. Baseline `main aa6fc0c8`; nothing was implemented, run, paid for, merged or changed in #414 / #410.

Evidence marks as before: [S] static inspection; [M] measurement on record; [E] estimate; [P] proposal; [W] provider page read
2026-11-25.

---

## ملخص التعديل (بالعربية)

- **السلطة الدلالية هي DeepSeek.** لا عتبة كلمات، لا مؤقت، لا "ذراع أولى"، لا موعد مُحدَّد لأول تغيّر. Speechmatics يقدّم الدليل،
  وDeepSeek يقرر إن كان فيه **تطوّر ذو معنى**؛ إن وُجد يصل إلى الخريطة فورًا (بحدود المعالجة والنقل والرسم فقط)، وإلا لا شيء يُرسَل.
- **الآلية:** كل مقطع FINAL (وحدة الدليل التي يصدرها ASR نفسه، لا كلمة ولا INTERIM) يُلحَق بدفتر دليل المكالمة ويطلب تقييمًا.
  التقييمات **متسلسلة** لكل مكالمة (واحد في الطيران)؛ عند انتهاء تقييم يبدأ التالي فورًا إن وُجد دليل معلّق، ويغطي **كل** الدليل
  منذ آخر علامة مياه. التجميع يؤجّل ولا يُسقِط. المقيِّم يرى نص الدور كله حتى الآن مع تمييز الجزء غير المُقيَّم، وحالة الانتباه
  المفتوحة، وThreads المستخدم (مرجعيًا).
- **عقد عدم الفقد:** دفتر تغطية `call_attention_evaluations` (جدول ثانٍ في 0204) يسجّل لكل تقييم نطاق الدليل الذي غطّاه ونتيجته
  (`DEVELOPMENTS | NONE | TIMEOUT | REFUSED | DEFERRED_PERMIT | MISSED_BUDGET | MISSED_HANDOVER`)؛ كل نطاق كلام يُحسَب إما مُغطًّى
  بتقييم أو بالاعتماد الدائم أو **مسجَّلًا صراحةً كفرصة حيّة ضائعة**. لا يُحرَّك خط المياه إلا بتقييم ناجح. المهلة والفشل والـpermit
  وإعادة الاتصال تؤجّل أو تسجّل، ولا تُسقِط. الدليل قبل الاعتماد مباشرة يحصل على **تقييم ذيل** بعد الاعتماد بتوقيته الحقيقي.
- **التكلفة والحِمل بلا فقد صامت:** التسلسل (1 في الطيران) هو المُجمِّع الطبيعي؛ إجابات "لا تطوّر" قصيرة؛ ترتيب الـprompt ثابت
  البادئة لاستغلال cache (S8A-05 قاس 80.2 % إصابات على سطح آخر)؛ الـpermit يؤجّل؛ ميزانية المكالمة عند النفاد **توقِف المسار
  وتسجّل** `MISSED_BUDGET` (قرار D-12). التقدير: ≈ 40–80 تقييمًا لدور 120 ث؛ ≈ USD 0.006–0.012 للدور مع cache (≈ 0.06 بلا cache)؛
  أرقام [E] حتى يقيسها CP1.
- **القبول:** مدوّنة سيناريوهات **مُعلَّمة مسبقًا** (تطوّرات مبكرة/وسطى/متأخرة، كلام طويل بلا تغيّر، تطوّرات متتابعة سريعة، تصحيح
  ونفي، موضوع جديد وThread موجود، دليل أثناء تقييم جارٍ، دليل قبل الاعتماد مباشرة، إعادة اتصال، فشل المقيِّم)؛ التقرير: الاستدعاء
  الدلالي، التطوّرات الضائعة بسببها، التحديثات الكاذبة، أخطاء الترتيب، تغطية الدليل، والاستجابة بخمس فترات مقيسة منفصلة.
  "ثلاثة تغيّرات دورية" لم تعد معيارًا.

---

# 1. Product authority (binding for CP1–CP4)

DeepSeek is the semantic authority of the provisional lane: it alone decides whether new evidence is a meaningful development.
Speechmatics supplies evidence (FINAL segments with word times); the tracker owns **evidence coverage and order**, never
meaning; COSMOS expresses; Replay preserves. No timer, word count, keyword or renderer rule decides *whether* understanding
happens. Backpressure (serialisation, permits, timeout, budget) decides only *when* evidence is admitted, and every deferral or
miss is recorded. The durable analysis remains the only authority for committed understanding (v1.1 §3.5 unchanged).

# 2. The incremental evaluation mechanism [P] (replaces v1.1 §3.2 "Trigger")

## 2.1 Evidence unit and ledger
- **Unit:** one FINAL segment as the recognizer emits it (`AddTranscript` → `{ text, startMs, endMs }` with word times, mapped
  to the call clock by `captureOf`; engine `:240-268, 302-308` [S]). Never a word, never an INTERIM (D-1 unchanged).
- **Per-call evidence ledger (in memory on the producing instance):** `finalSeq` rising by 1 per FINAL; each entry
  `{ finalSeq, clockStartMs, clockEndMs, arrivedClockMs }` where `arrivedClockMs = captureOf(streamMs at receipt)` (the capture
  position the server had ingested when the evidence arrived — v1.1's *evidence* instant). The text itself stays in `finals[]`
  exactly as today; the ledger adds order and clock, nothing else.
- **Watermark:** `coveredThroughFinalSeq` — the last FINAL included in a **successful** evaluation. Only a `DEVELOPMENTS` or
  `NONE` result advances it. Pending evidence = every FINAL above the watermark.

## 2.2 Admission loop (no thresholds)
```
on FINAL arrival         → append to ledger; if no evaluation in flight → admit now
on evaluation resolved   → write its coverage record (§3); if pending evidence exists → admit now
admit(span = (watermark, latestFinalSeq])
  permit? (kind PROVISIONAL_ATTENTION, maxWait 0, skip in L2)   no → record DEFERRED_PERMIT, retry in PERMIT_RETRY_MS (1 000)
  budget left? (MAX_EVALUATIONS_PER_CALL)                        no → suspend lane, record MISSED_BUDGET for the span (§3)
  call evaluator with: fixed prompt | turn text so far (append-only) | open state | Threads{id,name} | marker: new evidence = span
  resolve: DEVELOPMENTS(events) | NONE | TIMEOUT | REFUSED
```
- **One evaluation in flight per call.** The in-flight time (≈ 1–2 s [M reference]) is the only "batching"; a FINAL that arrives
  during an evaluation is **not lost**: it is pending and is covered by the next admission, which starts the moment the current
  one resolves. Coalescing therefore combines spans; it never drops one and never reorders (spans are contiguous and rising).
- **Early, middle, late developments** are treated identically: the first FINAL of a turn admits the first evaluation; a
  development spoken in the 3rd second can be on the map after ≈ FINAL latency + evaluation + push — a **measurement (§5)**,
  not a target.
- **Extended speech without change:** every admission returns `NONE` (a short answer); nothing is emitted; the watermark
  advances; coverage is complete.

## 2.3 What the evaluator decides (DeepSeek, closed JSON schema)
Input order is **prefix-stable** for the provider's context cache: `[system prompt] [turn FINAL text so far, append-only]
[open subjects ≤ 24 with keys, labels, threadRef] [Threads {id,name}] [NEW EVIDENCE marker: the span's text repeated]`.
Output: `{ developments: [{ op: SET|WITHDRAW, subjectKey, label ≤ 40, kind, confidence, threadRef|null, dependsOnFinalSeq }] }`
or `{ developments: [] }`. The prompt defines a development as: a new subject of attention; a shift to another open subject;
a correction or negation of an earlier one (WITHDRAW, optionally a SET of the corrected subject); a reference to an existing
Thread (`threadRef` from the list only); a materially changed framing of an open subject (SET replaces the label). It is told
explicitly: no update for restatement, filler, or elaboration that changes nothing. Unknown keys, a `threadRef` outside the
list, or `dependsOnFinalSeq` outside the span → `REFUSED` (the span stays pending). Nothing here thresholds by time or count;
the model's judgement is the only filter. Every emitted development is drawn (v1.1 §3.7); `confidence` is recorded, not gated.

## 2.4 Turn end, tail evidence, QANDEEL's side
- **Commit does not abort** (changes v1.1 §3.2 "abort on commit"): an in-flight evaluation completes and is written. If pending
  evidence exists at `COMMIT_SILENCE` — the case "important evidence immediately before turn completion" — exactly **one tail
  evaluation** is admitted after the commit, with its real `produced_clock_ms` (after speech end; Replay shows it there, never
  earlier). The durable half's result then settles the turn's subjects as in v1.1 §3.5; if the durable result lands first, the
  tail evaluation's events are written and immediately settled (`EXPIRED`/`CONFIRMED`) — recorded truth, never a fabrication.
- **QANDEEL-side** (v1.1 §3.3 unchanged in principle): each released piece is evidence once heard (PLAYOUT); admission is the
  same loop on the QANDEEL track; one evaluation covers all pieces heard since the watermark.

## 2.5 Context bound without loss
The turn text sent is bounded to the last `MAX_TURN_TEXT_WORDS` (600). Earlier text is not lost semantically: its developments
already live in the open-subject state that is always sent. If the open-subject state would exceed 24, the oldest `SET`
subjects are **folded** (kept as `{ subjectKey, label }` only) and a coverage record notes `STATE_FOLDED` — recorded, not silent.

# 3. Coverage and no-loss contract [P] (extends v1.1 §3.4 by one table)

`voice_private.call_attention_evaluations` (append-only, `ACCOUNT_CASCADE`, FK `calls` CASCADE), one row per admission or
recorded miss:

| Column | Meaning |
|---|---|
| `call_id`, `user_id`, `session_id`, `connection_epoch`, `eval_seq` (DB-assigned under the call row lock) | binding, order, fence (as events) |
| `track` (`USER | QANDEEL`), `covers_from_final_seq`, `covers_to_final_seq`, `covers_from_clock_ms`, `covers_to_clock_ms` | **the evidence span** this row accounts for |
| `outcome` | `DEVELOPMENTS | NONE | TIMEOUT | REFUSED | DEFERRED_PERMIT | MISSED_BUDGET | MISSED_HANDOVER | STATE_FOLDED` |
| `admitted_clock_ms`, `produced_clock_ms`, `produced_at`, `provider_ms`, `prompt_tokens`, `cache_hit_tokens`, `completion_tokens` | the responsiveness and cost measurements of §5, from the provider's usage fields; null for misses |
| `xact_id` | stored instant, certified by 0203 as the events are |

Events (`call_attention_events`, v1.1 §3.4) gain `eval_seq` (FK) so every event is traceable to the evidence span it came from.

**Rules (each is an acceptance assertion):**
1. **Every FINAL of a call is accounted for** exactly once as *covered* (`DEVELOPMENTS | NONE`) or *missed* (`MISSED_*`), or lies
   above the last watermark at call end (then covered by the durable commit alone and reported as `UNCOVERED_AT_END` in the
   acceptance metric, never hidden).
2. `TIMEOUT`, `REFUSED`, `DEFERRED_PERMIT` **do not advance the watermark**; their span merges into the next admission. After
   two consecutive `TIMEOUT|REFUSED` the next admission waits `PROVIDER_BACKOFF_MS` (5 000) or the next FINAL, whichever is
   later-safe; pending evidence is retained throughout. The provider being down for a whole turn costs ≤ one attempt per
   backoff window and loses nothing: the commit covers the turn durably.
3. **Ordering:** evaluations are serial per call; events carry `eval_seq` and `event_seq` both rising; the phone and Replay
   apply in `event_seq` order. A span is never evaluated after a later span.
4. **Hand-over (resume on this or another instance):** the old connection, in its existing hand-over flush
   (`live-call.connection.ts:395-421` [S]: what it received is written under its epoch before the epoch moves on), writes one
   `MISSED_HANDOVER` row for `(watermark, lastFinalSeq]` if that span is non-empty; its in-flight evaluation's late result is
   fenced by epoch and discarded (its span is already recorded as missed). The new connection's tracker starts with the DB
   watermark (reader) and its own fresh turn. A crash with no flush leaves the span unrecorded; the acceptance metric reports it
   as `UNCOVERED_AT_END` from the recording's clock, never as covered.
5. **Budget:** when `MAX_EVALUATIONS_PER_CALL` is reached the lane **suspends for the rest of the call** and writes one
   `MISSED_BUDGET` row per further turn span at commit. The map stops changing in-speech; the durable path is untouched; Replay
   shows exactly what was produced. The value is the PO's (D-12).
6. **Nothing provisional is ever reconstructed** from the final transcript, the recording or the durable result. A missed live
   opportunity stays missed and visible as such in the acceptance report and the coverage rows.

# 4. Provider load and cost without silent loss [P]

| Control | Effect | Loss? |
|---|---|---|
| Serialisation: 1 evaluation in flight per call | natural batching at the evaluation's own latency; ≤ 1 concurrent request per live call (account cap today 2 calls; published DeepSeek cap 2,500 [W]) | none (pending merges) |
| Prefix-stable prompt (§2.3) | the fixed prompt and the already-sent turn text hit the provider's context cache; S8A-05 measured **80.2 % cache hits** on another structured surface [M]; the calibration measures this prompt's ratio | none |
| Short `NONE` answers | an admission without development costs ≈ 15 output tokens | none |
| Permit gate (`PROVISIONAL_ATTENTION`, `maxWait 0`, skip in any L2 window) | protects First Audio and the durable chain's permits; **defers**, retries at `PERMIT_RETRY_MS` or the next FINAL | none (recorded `DEFERRED_PERMIT`) |
| Timeout 4 000 ms, 0 retries, backoff after 2 failures | bounds provider hang; **defers** | none (recorded) |
| `MAX_EVALUATIONS_PER_CALL` (D-12) | the only hard stop; suspends and **records** `MISSED_BUDGET` | honest, recorded miss |

**Cost model [E] — all figures estimates until CP1's calibration measures tokens, cache ratio and evaluation count:**

| Quantity | Value | Basis |
|---|---|---|
| Admissions per 120 s continuous USER turn | ≈ 40–80 (bounded above by FINAL count and below by evaluation latency; a FINAL every ~1–3 s and ~1.2–1.7 s per evaluation) | H-1 cadence [W]/[M short lines]; S8A-01 FAST wall [M] |
| Input per admission | ≈ 1,200–2,200 tokens (prompt + growing turn text + state); Egyptian Arabic is token-dense | [E] |
| USD per admission, peak, **80 % cache hits** | input ≈ (0.2×2,000×0.30 + 0.8×2,000×0.006)/10⁶ ≈ 0.00013; output ≈ 40 avg × 1.2/10⁶ ≈ 0.00005 → **≈ 0.00018** | [E] over [W] prices |
| USD per admission, peak, **no cache** (worst) | ≈ 0.0006 + 0.00005–0.00014 ≈ **0.00065–0.00074** | [E] |
| USD per 120 s turn | **≈ 0.007–0.014 with cache; ≈ 0.03–0.06 worst without cache**; off-peak half | [E] |
| USD per call minute added (continuous speaker ≈ 30 admissions/min; S8B-01 mix ≈ 55 % user speech → ≈ 17) | cache: ≈ 0.003–0.0055 → **+10–20 %** on the approved USD 0.026–0.029; worst no-cache: ≈ 0.011–0.022 → **+40–85 %** | [E] |
| 1,000 users / month (S8B-01's 30 / 150 / 600 min rows, no approved profile) | cache: ≈ USD 90–165 / 450–825 / 1,800–3,300; worst no-cache ≈ 4× those | [E] |
| Paid calibration (D-7 revised) | 4 annotated 120 s scenarios through the real evaluator ≈ 160–320 admissions ≈ USD 0.03–0.25 → **cap USD 0.30** (was 0.10) | [E] |

The approved per-minute model is exceeded in the worst row; the calibration run's measured cache ratio decides which row is
real. CP4 restates with [M]. ASR cost is unchanged (the stream already runs for the whole call).

# 5. Timing and performance — measured, never a condition

Five intervals, each recorded per development from the coverage/event rows and the phone's test hook, reported as P50/P95:

| # | Interval | Source |
|---|---|---|
| T1 | word end (Speechmatics word time) → FINAL arrival at the server | `anchor_clock_ms` → `arrivedClockMs`; the A0 cadence proof measures the same |
| T2 | FINAL arrival → evaluation admission (pending wait: in-flight, permit, backoff) | ledger → `admitted_clock_ms` |
| T3 | admission → semantic result | `admitted_clock_ms` → `produced_clock_ms`, `provider_ms` |
| T4 | result → visible map change | server send instant → the phone's stage-digest change (emulator hook; on device **NOT PROVEN** until the HONOR proof) |
| T5 | end of user speech → QANDEEL's first audible packet | the existing `FIRST_AUDIO` observation, **producer ON vs OFF** on the CP3 synthetic matrix |

Protected and asserted: no synchronous work on the voice path; evaluations skip L2 windows; T5 ON−OFF within harness noise;
COSMOS opening, rendering, camera and gestures untouched (the attention marks are sprites and ordinary labels in the existing
draws — v1.1 §3.7).

**H-1 and A0 (FINAL availability):** still a hypothesis measured by the paid Speechmatics proof (D-7). Its gate is re-expressed
as evidence availability, not cadence: **STOP for the PO (D-1b)** if the word-end→FINAL lag L-P95 > 5 s or any FINAL gap > 20 s
is observed while the person speaks, because then in-speech evidence itself is unavailable. The proof's `fixed`-mode arm stays.
FINAL-only is not permission to introduce INTERIM processing; D-1b remains the PO's choice after evidence.

# 6. Acceptance — replaces v1.1 §5 for CP1/CP2 and extends CP3/CP4

**The corpus:** pre-annotated Egyptian scenarios (synthetic content, no real person), each ≈ 90–120 s of scripted FINAL segments
with word times, and an **annotation** listing every expected important development `{ evidenceFinalSeq, op, subject, kind,
threadRef? }`. Required scenarios: (a) early + middle + late developments; (b) ≥ 40 s without meaningful change; (c) three
developments within 6 s; (d) a correction and a negation; (e) a new subject and a reference to an existing Thread; (f) important
evidence arriving during an in-flight evaluation; (g) important evidence in the last FINAL before the commit; (h) a resume
(same and other instance) mid-turn; (i) evaluator timeout/refusal for 15 s then recovery.

**Two evaluators:** the **fake evaluator** (scripted to the annotations) proves the *mechanism* — coverage, order, no-loss,
timing plumbing — deterministically and free; the **real evaluator** (capped, D-7) measures *semantic recall* on the same corpus,
judged against the annotation by a human reviewer (subject identity is semantic, so no label-matching script decides it).

**Report (per scenario and overall):** semantic recall (expected developments emitted); missed developments with reason
(`NOT_DETECTED | TIMEOUT | DEFERRED | MISSED_BUDGET | MISSED_HANDOVER | UNCOVERED_AT_END`); false updates (emitted developments
absent from the annotation); ordering errors; evidence coverage (% of FINAL spans `DEVELOPMENTS|NONE`, % missed, % uncovered);
responsiveness T1–T5. **Every annotated development is accounted for** in exactly one of these classes.

| CP | Acceptance (amended) |
|---|---|
| **CP1** | **A0** cadence proof with the §5 STOP rule. **A1′** corpus (a)–(i) with the fake evaluator: coverage 100 % accounted; watermark advances only on success; (f) the in-flight-time FINAL is covered by the very next admission; (g) exactly one tail evaluation after the commit with `produced_clock_ms` > speech end; (h) a `MISSED_HANDOVER` row for the open span, DB watermark picked up by the new tracker, `eval_seq`/`event_seq` rising across epochs, the old epoch's late result fenced; (i) no watermark movement during the outage, backoff honoured, the span covered at recovery; budget exhaustion → suspension + `MISSED_BUDGET`, durable path unaffected. **A2** (no provisional→durable leakage), **A3** (failure leaves audio untouched), **A4** (T5 ON vs OFF), **A5** (0204 verifier incl. the second table), **A6** (referential settlement), **A7** (`anchor ≤ evidence ≤ produced`) as v1.1. **A8** real-evaluator calibration on the corpus: recall / false-update / token / cache-ratio report, [M]. |
| **CP2** | **B1–B4** as v1.1. **B5′** visual progression evidence: for scenario (a) and (d), a still of the map region at each annotated development and at the withdrawal, each with the event's `produced_clock_ms`; pixel diff > 0 and digest change per step; the stills are delivered to the PO. No periodic-change criterion. **B6** T4 measured on the emulator (hook), reported. |
| **CP3** | **C1–C7** as v1.1. **C8** the corpus call's Replay shows exactly the recorded events at their certified or produced floors, nothing at anchors, nothing for `MISSED_*` spans (no reconstruction), and `UNCOVERED_AT_END` spans show the durable Lane A disclosure only. |
| **CP4** | **D1/D2** as v1.1 plus the full §6 report with [M]; `QAN-BL-INTEL-06` → `VALIDATION — OPEN` (D-11); the product gate remains the HONOR Live + Replay proof. Cost restated against the approved model with the measured cache ratio. |

# 7. Decisions changed by A1

| # | v1.1 | A1 (v1.2) |
|---|---|---|
| **D-1** | FINAL-only, conditional on a cadence gate | FINAL-only stays a hypothesis; gate re-expressed as **evidence availability** (L-P95 ≤ 5 s, no gap > 20 s while speaking). D-1b unchanged: INTERIM only by the PO's later choice |
| **D-4** | 0204 = one table | 0204 = **two tables** (`call_attention_evaluations` coverage ledger + `call_attention_events` with `eval_seq`); verifier covers both |
| **D-6** | word / speech / elapsed arms, starvation timer | **Withdrawn.** Remaining configuration is backpressure only: evaluator timeout 4 000 ms; `PROVIDER_BACKOFF_MS` 5 000 after 2 failures; `PERMIT_RETRY_MS` 1 000; `MAX_TURN_TEXT_WORDS` 600; `MAX_OPEN_SUBJECTS` 24; label ≤ 40 |
| **D-6b** | first-cue arm | **Withdrawn** |
| **D-7** | Speechmatics cap 0.30; DeepSeek 40 calls cap 0.10 | Speechmatics unchanged; DeepSeek **corpus calibration, cap USD 0.30** (≈ 160–320 admissions) — both still need explicit authorisation |
| **D-12** *(new)* | — | `MAX_EVALUATIONS_PER_CALL`: the only hard stop; suspension + recorded `MISSED_BUDGET`. Proposed **600** (≈ 20 min of continuous speech; ≈ USD 0.11 cached / 0.44 worst per call at the cap) |
| **D-13** *(new)* | — | Tail evaluation after the commit (one, real timing) — approve; the alternative is a recorded `MISSED_TAIL` with no evaluation |

D-2, D-3, D-5, D-8, D-9, D-10, D-11 are unchanged. Blocking CP1: D-1 (hypothesis), D-2, D-4, D-7, D-12, D-13.

# 8. Not done
No runtime code, migration, protocol change, paid call, device run, hosted change or merge. #414 Draft untouched; #410 untouched.
CP1 is not started. INTEL-LIVE-01 remains one task, one implementation PR, four checkpoints; the objective is unchanged: close
the understanding gap and return to Replay S5 / CP2-A.
