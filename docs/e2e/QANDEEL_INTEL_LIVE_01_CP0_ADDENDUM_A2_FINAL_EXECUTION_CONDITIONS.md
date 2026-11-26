# QANDEEL — INTEL-LIVE-01 — CP0 Addendum A2: Final Execution Conditions (binding)

**Status:** `ADDENDUM A2 RECORDED — A1 ACCEPTED IN PRINCIPLE BY THE PO — EXECUTION NOT YET AUTHORISED — NOTHING IMPLEMENTED`
**Date:** 2026-11-25
**Authority:** the Product Owner's "INTEL-LIVE-01 — A1 Review and Final Execution Conditions" (2026-11-25). This addendum
records its six corrections and inserts their assertions into the acceptance matrix of A1 (v1.2 §6). It changes no architecture
and reopens nothing. Contract stack, binding in this order: v1.0 → v1.1 (C1–C7) → A1 v1.2 (semantic-driven) → **A2 (this)**.
**Discipline:** one task, one implementation PR, four checkpoints (CP1 continuous understanding · CP2 living map · CP3 Replay ·
CP4 integrated validation and governance). No discovery phase, no further contract revision. HONOR Live + Replay remains the
product gate. **Paid tests:** combined ceiling **USD 0.60** (Speechmatics cadence 0.30 + DeepSeek corpus calibration 0.30) —
**awaiting the PO's explicit authorisation; nothing spent.** No merge without the PO's word.

---

## الملحق بالعربية (مختصر)

1. **فهم مستمر طوال المكالمة:** لا توقّف عادي بعد عدد تقييمات (600 مرفوض). تبقى المحاسبة والـcache والتسلسل وحماية المزود؛ أي
   تعليق طارئ = **حالة منتج متدنية** تُسجَّل كذلك، لا تشغيل ناجح. التكلفة الحقيقية (USER + QANDEEL) تُقاس أولًا ثم تُقترح ميزانية إنتاج.
2. **الاستدعاء الدلالي بوابة قبول:** في مدوّنة التشغيل العادي: كل تطوّر مُعلَّم يُكتشف، لا إسقاط صامت، التصحيح/النفي صحيحان، ترتيب
   التطوّرات داخل نطاق مُجمَّع محفوظ، صفر تغيّرات كاذبة في سيناريوهات اللا-تغيّر. ثلاثة مقاييس منفصلة: محاسبة الدليل، الاستدعاء
   الدلالي، الإفشاء الحي الناجح. ضياع في سيناريو حقن-فشل لا يُحسَب فهمًا حيًّا.
3. **حفظ السياق:** لا يُقتطع دليل غير مُقيَّم أبدًا (النطاق الكبير يُقسَّم إلى إدخالات متتابعة بالترتيب). المواضيع المطوية تحتفظ
   بالمفتاح والتسمية والنوع والمرجع، ويحمل المقيِّم نفسه `contextCarry` قصيرًا يُحدّثه (DeepSeek ذاته، لا سلطة أخرى). سيناريو
   (j) يُثبت أن تصحيحًا متأخرًا لموضوع مبكر يبقى مفهومًا عبر حدّ النافذة.
4. **سلامة التخزين والاستعادة:** صف التغطية وأحداثه وتقدّم خط المياه في **معاملة واحدة**؛ مفتاح عدم التكرار؛ هوية الدليل بساعة
   المكالمة والمسار (لا برقم محلي)؛ كنس تسوية في مسح العامل الموجود يغطي الانهيار بين الاعتماد الدائم والتسوية؛ نتيجة متأخرة لا
   تكتب على فهم أحدث (`STALE_RESULT` / `STALE_AFTER_SETTLEMENT`)؛ توقيت Replay صادق في الصمت والتعليق وبعد الاعتماد.
5. **الأداء والتكلفة:** المسار المؤقت تابع لـLive Voice وFirst Audio؛ تُقاس التكلفة الفعلية ونسبة الـcache وعدد الإدخالات
   والاستدعاء وزمن النتيجة→الخريطة؛ فتح COSMOS والإيماءات محميان ومُقاسان؛ لا عتبات زمن/كلمات. تقييم الذيل (D-13) مقبول بشرطيه.
6. **الانضباط:** مهمة واحدة، PR واحد، أربع نقاط؛ السقف المدفوع المشترك USD 0.60 ينتظر إذنًا صريحًا.

---

# 1. Continuous understanding throughout the call (D-12 revised)

- **No normal-operation stop.** `MAX_EVALUATIONS_PER_CALL` as a product policy is withdrawn. The lane runs for the whole call,
  USER and QANDEEL sides, bounded only by serialisation, caching, permits, timeout/backoff and the provider's own limits.
- **Emergency guard = degraded state, recorded.** One configurable guard remains, **disabled by default**: a per-call spend
  ceiling in USD computed from the provider's usage fields (`EMERGENCY_CALL_SPEND_USD`, default `null`). If ever reached, or if the
  provider returns sustained 429/5xx beyond the backoff, the lane enters `DEGRADED` and writes `DEGRADED_SUSPENDED` coverage rows
  for every further span. `DEGRADED` is reported as a product failure in every acceptance and operations report, never as success.
- **Budget comes after measurement:** CP1's calibration (A8) and CP4's report give measured cost per call minute for **both
  sides**; only then is a sustainable production budget proposed to the PO (CP4 deliverable, not configuration now).

# 2. Semantic recall is an acceptance gate

Three metrics, reported separately and never merged:

| Metric | Definition | Source |
|---|---|---|
| **Evidence accounting** | % of FINAL spans with `DEVELOPMENTS|NONE`, % `MISSED_*`, % `UNCOVERED_AT_END` | coverage ledger |
| **Semantic recall** | annotated important developments the **real evaluator** emitted (judged by a human reviewer against the annotation; subject identity is semantic) | A8 calibration |
| **Successful live disclosure** | developments whose event was applied on the phone's stage (digest change, emulator hook) **before the turn's durable Lane A disclosure of the same content** and while the call continued | B6 / B5′ |

**Gate for the normal-operation corpus** (scenarios a–g and j, real evaluator): recall **100 %** of annotated important
developments; **0** silently discarded spans; every correction and negation reflected as the annotated `WITHDRAW` (and `SET`
where annotated); within one coalesced span, emitted developments **in annotated evidence order** (`dependsOnFinalSeq` rising,
then model order); **0 false semantic changes** in the no-change scenario (b) and in no-change stretches of the others. A failing
gate means CP1 is **not accepted**; prompt iteration is allowed only inside the authorised paid ceiling and is recorded.
Failure-injection scenarios (h resume, i outage, k emergency guard) may show honest degraded behaviour; their misses are counted
as **not understood live**, never as success. Accounting for a miss is not understanding.

# 3. Context preservation (no meaning lost)

- **Unevaluated evidence is never truncated.** If the pending span exceeds `MAX_TURN_TEXT_WORDS`, it is admitted as consecutive
  sub-spans in order, each sent whole; the watermark advances per sub-span. The bound caps *older* text only.
- **Folded subjects keep their meaning:** `{ subjectKey, label, kind, threadRef, confidence }` (not key + label only), and the
  state cap (24) is a fold threshold, never a drop.
- **`contextCarry` by the same authority:** the evaluator's output gains an optional `contextCarry` (≤ 80 words) that DeepSeek
  itself rewrites whenever text is about to leave the window; it is sent back in the next admission. No second model, no
  independent summariser, no heuristic — the one evaluator carries its own context, as the half path's context reader carries
  Live Focus today.
- **Proof (new scenario j):** a ≥ 150 s turn whose last FINAL corrects or negates a subject introduced in its first 20 s, beyond the
  600-word window; the real evaluator must emit the annotated `WITHDRAW`; the fake-evaluator run asserts the plumbing (the
  subject and carry are present in the admission input). If (j) fails, the bound is raised and re-measured for cost before any
  other change is proposed.

# 4. Storage and recovery integrity

- **Atomic outcome:** one writer RPC `server_record_call_attention_evaluation_v1` writes the coverage row, its attention events and
  the watermark advance (`covers_to_clock_ms`) in **one transaction**, assigning `eval_seq` and `event_seq` under the call row lock
  and the epoch fence. The in-memory watermark moves only after the RPC commits. **Idempotency:** unique
  `(call_id, track, covers_from_clock_ms)` for successful outcomes; a repeated write after a lost ack is answered
  `ALREADY_COVERED` and the tracker adopts the DB watermark — no duplicate events, no double count.
- **Evidence identity** is `(call_id, track, clockStartMs, clockEndMs)` on the call's capture clock — continuous across turns,
  epochs and instances; the per-connection `finalSeq` is a local order only and is never stored as identity. QANDEEL spans are
  heard ranges on the QANDEEL track. Ordering across epochs is proven by `eval_seq`/`event_seq` rising and by `covers_from ≥`
  the previous `covers_to` per track.
- **Crash between durable completion and settlement:** settlement stays idempotent and is additionally found by the worker's
  **existing scan** ("the scan that finds work no kick announced", `call-analysis.worker.ts:44` [S]): a committed turn whose half
  is COMPLETE, with open `SET`s in its clock window and no settlement rows, is settled on the next scan on any instance. The
  durable commit itself never reads or writes provisional rows.
- **No late result overwrites newer understanding:** the writer refuses an evaluation whose `covers_to_clock_ms` is not above the
  track's last successful coverage (`STALE_RESULT`, recorded, no events) and refuses events for a turn that already has settlement
  rows (`STALE_AFTER_SETTLEMENT`, recorded, no events). Reducers (phone, Replay) apply strictly by `event_seq`.
- **Truthful Replay timing in silence, pause and after commit:** `produced_clock_ms` is the capture position ingested at the
  result; captured silence advances it normally. Inside a **held interval** (0195 holds carry exact `elapsed_ms`) the capture
  clock does not advance, so the row also stores `produced_at` and Replay places the floor at the hold's elapsed offset, never
  at the hold's start. A tail evaluation's floor lies after speech end by construction; Replay shows it there.

# 5. Performance and cost

- **Subordination:** provisional admissions are background permits (`maxWait 0`, skipped in any L2 window); no await on the voice
  path; the reply generation, First Audio and the durable chain keep their priority. **A4** (T5 ON vs OFF, tail evaluation
  included) is a gate: the ON−OFF delta must stay within the CP3 harness's run-to-run noise.
- **Measured, not assumed (A8, B6, CP4):** provider cost per call minute (USER + QANDEEL), cache-hit ratio, admissions per
  minute, semantic recall, T1–T5 including result→map (T4) on the emulator; COSMOS opening time and gesture frame cost from the
  existing COSMOS performance checks, with the attention layer empty outside a call and marks present inside one
  (`drawOpsAtRest` unchanged: marks are sprites in the same atlas draw and ordinary labels in the existing label view).
- **No fixed time or word threshold** is reintroduced anywhere as a semantic prerequisite (asserted by test: the admission policy
  has no such parameter).
- **D-13 tail evaluation accepted with two conditions, both asserted:** (1) it never delays the audible reply — it is a background
  admission after the commit, never on the reply path (A4 includes it); (2) it cannot leave stale attention — if the durable
  settlement has already happened, the writer refuses its events (`STALE_AFTER_SETTLEMENT`); otherwise its events are settled by
  the same settlement rows as the turn's others.

# 6. Acceptance matrix — assertions inserted (ids are additive to A1 §6)

| CP | New / changed assertions |
|---|---|
| **CP1** | **A1′-k** emergency guard: with `EMERGENCY_CALL_SPEND_USD` set low in a test, the lane enters `DEGRADED`, writes `DEGRADED_SUSPENDED` rows, the durable path is unaffected, and the report classes the call as degraded; with the default `null`, a 20-minute synthetic call never suspends. **A1′-j** context plumbing (subject + carry present across the window). **A9 atomicity:** the writer commits coverage + events + watermark together; a lost ack → `ALREADY_COVERED`, no duplicate; a sub-span split keeps order. **A10 identity:** two epochs, one call — `covers_from ≥` previous `covers_to` per track, `eval_seq`/`event_seq` rising, no cross-track mixing. **A11 crash window:** kill the worker between the half's commit and settlement → the next scan settles on another instance. **A12 staleness:** a result covering an already-covered span → `STALE_RESULT`, no events; a tail result after settlement → `STALE_AFTER_SETTLEMENT`, no events; a tail result before settlement → events written then settled. **A8′ (gate):** real-evaluator run on scenarios a–g, j: recall 100 %, false updates 0 in no-change content, corrections/negations reflected, intra-span order preserved — **CP1 is not accepted without it**, so D-7's authorisation is a CP1 prerequisite. **A4** now a gate (ON−OFF within noise, tail included). |
| **CP2** | **B6′** T4 per development on the emulator, and "successful live disclosure" computed per annotated development. **B7** COSMOS opening time and gesture frame cost unchanged with the layer empty; `drawOpsAtRest` unchanged with ≤ 12 marks. **B5′** unchanged (stills per annotated development). |
| **CP3** | **C9** hold timing: an event produced inside a held interval is placed at the hold's elapsed offset; a tail event is placed after speech end; nothing at an anchor. **C10** a `STALE_*` or `DEGRADED_SUSPENDED` row produces no Replay mark. |
| **CP4** | **D3** the three metrics reported separately for every scenario; degraded runs labelled; the measured cost (both sides) and cache ratio stated against the approved per-minute model; a **sustainable production budget proposed** to the PO from those measurements; `QAN-BL-INTEL-06` → `VALIDATION — OPEN` (D-11). |

# 7. Decisions after A2

| # | State |
|---|---|
| D-12 | **Replaced:** no normal-operation stop; emergency spend guard default `null`; budget proposed at CP4 from measurements |
| D-13 | **Accepted** with the two asserted conditions (§5) |
| D-7 | Combined paid ceiling **USD 0.60** (0.30 + 0.30) — **awaiting explicit PO authorisation**; A8′ is a CP1 acceptance prerequisite |
| D-1, D-2, D-3, D-4 (two tables, writer RPC atomic), D-5, D-8, D-9, D-10, D-11 | unchanged |

**Blocking CP1 start:** D-2, D-4 and the paid-ceiling authorisation (D-7). Everything else is recorded and binding as above.

# 8. Not done
No runtime code, migration, protocol change, paid call, device run, hosted change or merge. #414 Draft untouched; #410 untouched.
HONOR and iOS NOT TESTED. CP1 awaits the PO's explicit execution authorisation and the USD 0.60 ceiling.
