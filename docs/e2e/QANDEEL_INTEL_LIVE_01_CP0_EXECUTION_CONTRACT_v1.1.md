# QANDEEL — INTEL-LIVE-01 — Incremental In-Speech Understanding & Living Map Attention
## CP0 — Execution Contract — v1.1 (FOCUSED CORRECTIONS C1–C7, FOR PRODUCT OWNER REVIEW)

**Status:** `INTEL-LIVE-01 CP0 v1.1 DELIVERED — CONTRACT PROPOSED — NOT APPROVED FOR EXECUTION — NOTHING IMPLEMENTED`
**Date:** 2026-11-25
**Supersedes:** v1.0 (same folder) for every section named in the change log below; sections not named stand as written in
v1.0 (§1.1, §1.2, §1.4, §1.5, §2, §3.1 #1 #2 #6, §3.3, §3.6, §7, §8.1, §8.4, §8.5, §10).
**Baseline:** `main` at `aa6fc0c8` (unchanged). Read again from `E:/intellive` (commit `53429017` = `aa6fc0c8` + the docs
of Draft PR #414). No runtime code, migration, protocol change, paid call, device run or merge was made for v1.1.
**Authority consumed:** the Product Owner's "INTEL-LIVE-01 CP0 v1.1 — Independent Review — Focused Corrections" (2026-11-25),
on top of v1.0's list. The general direction of the Provisional Attention lane is accepted by that review; this version
changes only what C1–C7 name.

Evidence marks as in v1.0: **[S]** static inspection of the baseline (`path:line`); **[M]** a recorded measurement
("synthetic" = fake providers); **[E]** an estimate or arithmetic; **[P]** a proposal; **[W]** a provider page read on
2026-11-25 (a quoted figure, not verified by a paid run).

### Change log (where each correction lands)

| Correction | What v1.0 said | What v1.1 says | Sections | CP impact |
|---|---|---|---|---|
| **C1** FINAL cadence and trigger | FINAL-only as a settled policy; a 15 s timer "so a slow speaker still gets an evaluation" | FINAL-only is a **test hypothesis (H-1)** with a measured gate and a decision procedure; the timer cannot create text and is redefined; starvation behaviour defined; speech→first-change time recomputed with the trigger wait shown | §3.2, §5 (A0), §6, D-1, D-1b, D-6 | CP1 gains step 0's gate and a STOP; CP2's B5 inherits the measured time |
| **C2** Real visual progression | Live cue through existing `SceneInput` fields only (`focusId`, `fringe`, `focusMotes`) | **Withdrawn**: `fringe` is not drawn by the production canvas, `focusId` is the approved selection look, `focusMotes` is a served count. Replaced by the **smallest controlled stage amendment**: attention marks (glow / ember) | §1 (corrected rows), §3.7, §5 (B4, B5), D-5 | CP2 contains the stage amendment and a visual before/after of three progressions |
| **C3** Historical truth in Lane B | One `anchor_capture_ms`; Replay places at certified availability else "the anchor (source order)" | **Five instants** distinguished, three stored; an event is **never displayed at its anchor**; the uncertified floor is the server's own produced position, never the words' position; each event bound to its track | §3.4, §3.7, §5 (C2, C7), D-10 | CP1 writes the instants; CP3 implements the placement |
| **C4** Settlement and reconnect | `CONFIRM` by normalised label match; `call_turn_index` nullable until commit; `settled_by_turn_id` on the row | **No label matching**: a referential `thread_ref` chosen from the user's existing Threads, validated server-side; otherwise `EXPIRED`, never "became a Thread". Event rows carry no turn id and no settlement state; settlement = new rows; instance-independent; call end expires by rule | §3.2, §3.4, §3.5, §5 (A6, A7, B2) | CP1 settlement redesigned; CP2 reconnect proof extended |
| **C5** Cost and capacity | Speechmatics Enhanced USD 0.80/h from the S8B-01 record | Provider pages **re-read today**: Enhanced is listed at **0.80**; the **0.40** figure is the Melia 1 model; QANDEEL runs Enhanced → 0.80 kept, a 0.40 sensitivity row added; published vs account vs load-test limits separated; tokens/calls kept [E] | §6, D-7 | CP1's calibration measures; CP4 restates with [M] |
| **C6** Qualification and closure | CP4 = governance closure incl. `QAN-BL-INTEL-06` disposition | Synthetic success ≠ product readiness: `SYNTHETIC_ONLY` and the HONOR Live + Replay proof are the product gate; CP4 leaves INTEL-06 **`VALIDATION — OPEN`**, never CLOSED | §5 (CP4), §8.2, D-11 | CP4's closure wording and backlog state |
| **C7** Governance | #410 "close as superseded, documents re-landed" | #414 kept Draft/unmerged and untouched by v1.1; #410 **not merged**; a file-by-file transfer plan with a no-loss check, then closure on the PO's word | §8.3, D-9 | CP1 carries the transfer |

---

## ملخص التصحيحات (بالعربية)

- **C1:** وصول FINAL أثناء كلام متصل 90–120 ثانية **فرضية اختبار** (H-1) لا قرار. المؤقت لا يصنع نصًا: لا FINAL ⇒ لا تقييم.
  انقطاع FINAL 20 ثانية مع استمرار الكلام يُسجَّل كقياس (`FINAL_STARVED`) بلا إشارة وبلا INTERIM وبلا ForceEndOfUtterance.
  بعد إثبات Speechmatics: إن كانت الفجوة P95 ≤ 5 ث والحد الأقصى ≤ 15 ث يكفي FINAL؛ وإلا **توقّف** ويُعرض على PO تعديل ضيق واحد
  (`max_delay_mode: fixed` كتعديل إعدادات، أو قاعدة "بادئة INTERIM مستقرة" كتعديل لـ§5.1) — لا يُنفَّذ أي منهما بلا موافقة.
  أول تغيّر مرئي ≈ **12–14 ث** بعد بداية الكلام، منها 10 ث انتظار الزناد نفسه (مُعلَن لا مُخفى)؛ خيار "زناد أول" 6 ث يجعله ≈ 8–10 ث.
- **C2:** `fringe` **لا يُرسم أصلًا** في لوحة الإنتاج، و`focusId` هو مظهر التحديد المعتمد (حلقات ذهبية ومسطرة)، و`focusMotes`
  عدّ مُقدَّم من الخادم. قاعدة v1.0 ما كانت لتُظهر شيئًا. البديل: **أصغر تعديل محكوم للمسرح**: حقل اختياري `attention` يرسم
  **وهجًا** ناعمًا بلون الجسم نفسه حول Thread موجود (بلا ذهب ولا حلقات)، و**جمرة** صغيرة بلون الدور الدافئ مع تسمية عادية
  لموضوع جديد بلا مكان، في موضع عرضي لا معنى له (كمدارات Readings). لا رسوم S3-R2 جديدة، لا كاميرا، رسمة Atlas واحدة كما هي.
- **C3:** خمس لحظات لكل حدث: موضع الكلمات (anchor)، وصول دليل ASR (evidence)، إنتاج التفسير (produced)، التزام الصف (stored →
  يُعتمَد بلقطات 0203)، وصوله للهاتف (**غير مثبت ولا يُخزَّن ولا يُدَّعى**). **لا يُعرض حدث عند موضع الكلام أبدًا**: أرضية العرض هي
  لحظة الإنتاج المسجلة بساعة المكالمة أو الاعتماد إن وُجد. كل حدث مربوط بمساره (USER capture clock / QANDEEL heard على
  ساعة المكالمة نفسها، كما يكتبها `call-reply.ts`).
- **C4:** لا مطابقة نصية. `thread_ref` مرجعي من قائمة Threads الحالية للمستخدم (تُمرَّر للمقيِّم، ويُتحقَّق منها في الخادم)، وإلا
  **`EXPIRED`** بلا ادعاء. الصف لا يحمل هوية دور ولا حالة تسوية؛ التسوية صفوف جديدة يكتبها عامل التحليل الدائم بعد اعتماد
  النصف (على أي Instance، idempotent)؛ نهاية المكالمة تُنهي كل انتباه مفتوح بقاعدة قراءة. إعادة الاتصال على خادم آخر: الحالة
  من قاعدة البيانات (`ATTENTION_STATE`)، التسلسل يعيّنه الخادم تحت قفل صف المكالمة وسور الـepoch.
- **C5:** صفحة Speechmatics اليوم: Real-time **Enhanced 0.80**، Standard 0.45، **Melia 1 0.40**، Linden 1 0.30. قنديل مضبوط على
  Enhanced ⇒ الأساس 0.80 يبقى مع صف حساسية عند 0.40. حدود التزامن المنشورة (Speechmatics Free 2 / Pro 50؛ DeepSeek flash
  2,500) ≠ حد حساب قنديل (`realtime_session_capacity = 2`) ≠ اختبارات تحميل (لا توجد لهذا المسار).
- **C6:** نجاح CP4 اصطناعيًا لا يغلق `QAN-BL-INTEL-06`؛ تبقى `VALIDATION — OPEN` حتى إثبات HONOR Live + Replay الحقيقي.
- **C7:** #414 يبقى Draft غير مدموج؛ #410 لا يُدمج؛ خطة نقل ملف-بملف مع فحص عدم الفقد ثم الإغلاق بكلمة PO.

---

# 1. Corrections and additions to the code-verified truth (v1.0 §1.3 rows replaced where they conflict)

| Fact (corrected / added) | Evidence |
|---|---|
| `focusId` draws **the approved selection look**: the gold instrument (ring, graduated scale, 72 ticks) around the ONE inspected entity and its bright major title. The stage's own rule: "the instrument rings of the ONE focused entity" | `apps/mobile/src/cosmos/core/stage.ts:12-13, 107-120, 138-141, 152-155, 180-186` [S] |
| `focusMotes` are drawn only around the focused entity and are "counted from a served detail … absent until served" | `stage.ts:14, 36, 116-119, 183` [S] |
| **`fringe` is a number carried on the Stage and is not drawn by the production canvas.** The only consumer that shows it is the validation proof root ("N not yet placed") | `stage.ts:59, 216`; `cosmos/skia/CosmosCanvas.tsx` (no `fringe` reference); `__validation__/CosmosProofRoot.tsx:491` [S] |
| An entity's label is drawn by the canvas's `placeLabels`; an unselected Thread gets an ordinary label in its own dye; label colours resolve through `lightRgbOf(tint)` with `-1` = white | `CosmosCanvas.tsx:215-262, 315-316`; `stage.ts:152-155` [S] |
| The stage has an amendment precedent: "AMENDED (PO directive 'COSMOS E-2 Final Corrections', 2026-11-21, §2)" inside `stage.ts`, and DEFECT-3's recorded rule: "the smallest documented amendment to the frozen COSMOS stage" | `stage.ts:152`; COSMOS-INT-01 contract `:3768` [S] |
| During a call the Analysis depth shows the Personal map (`driftPaused`) with the call-line box under it | `integration/composition/DepthComposition.tsx:759-790` [S] |
| QANDEEL's heard audio is written on the **QANDEEL track at call-clock instants**: `clockStartMs + packet × 20 ms`, where `clockStartMs` is fixed at the reply's first accepted `PLAYOUT` from the call's capture clock; a piece's range `[startMs, endMs)` is registered on the reply clock | `call-turn/call-reply.ts:236-275, 507-517` [S] |
| The USER track clock is the capture clock; `captureOf(streamMs)` maps a recognizer stream instant to it through `streamBreaks` | `live-call-turn.engine.ts:240-268` [S] |
| 0195 windows are per **track** (`USER` / `QANDEEL` / `NOTE`) with `clock_start_ms` / `clock_end_ms`; 0202 places a certified capture position in "the FIRST run … whose clock ends after X, at max(X, the run's clock start)"; the seam answers by `pg_visible_in_snapshot(xact_id, snapshot)` over echoed marks | `0195:115-124, 223-241`; `0202:43-50`; `0203:128-146` [S] |
| A resume moves the call's `epoch`; the older connection flushes and **commits what it received under its epoch** before the epoch moves on; 0189 fences every write of an older epoch; a RECONNECTING call past its 30 s grace ends `PEER_LOST_AFTER_GRACE` inside the authority's recovery functions | `voice/call/live-call.connection.ts:351-369, 395-421`; `0189:188, 291, 423-448, 491-520` [S] |
| The analysis worker runs in every API instance, one active worker per session across instances (semantic lease); a half is settled COMPLETE by its own commit; a crashed worker's half is replayed from storage with zero provider calls | `live-analysis/call-analysis.worker.ts:3-10, 184-236`; `call-analysis-worker.host.ts:13-20` [S] |
| QANDEEL's account limit today: `live_call_policy.realtime_session_capacity = 2` ("the evaluation account allows two concurrent realtime sessions") | `0189:66-71` [S] |
| Speechmatics docs: `max_delay` is "the delay in seconds between the end of a spoken word and returning the Final"; range 0.7–4, default 4; in `flexible` mode a Final "would be delayed until the entity is fully spoken" (unquantified); the `fixed`-mode example shows several Finals inside one utterance; EndOfUtterance is a separate silence-triggered mechanism | `docs.speechmatics.com/rt-api-ref`, `…/speech-to-text/realtime/output` [W] |

---

# 3. Recommended design — corrected sections

## 3.2 Producer and trigger (C1, C4) [P]

**H-1 (hypothesis, measured in CP1 step 0, not assumed):** during 90–120 s of continuous Egyptian speech at the call's
configuration (`ar_en`, `enhanced`, `max_delay 0.7 flexible`, partials on), Speechmatics delivers `AddTranscript` FINAL
segments with inter-arrival gaps short enough for a 10 s evaluation cadence. Documented support [W]: `max_delay` bounds the
Final per *word*, not per utterance, and the provider's own example shows Finals inside one utterance. Known holder [W]:
`flexible` delays a Final while an entity (number, date, currency) is being spoken, by an unquantified amount. Measured
support [M]: only short lines (~5 s) at `max_delay 1.0` (S8B-01 `:1114-1117`); a 3.8 s clip produced 9 finals at "the normal
cadence" (`:1164-1166`). **Nothing measured at 90–120 s.**

**Trigger (both arms need FINAL words; no timer creates text):** an evaluation starts when the pending FINAL words since the
last evaluation are ≥ `MIN_NEW_WORDS` (20) **and** either (a) the pending FINAL speech covers ≥ `MIN_NEW_SPEECH_MS` (10 000)
of the capture clock, or (b) ≥ `ELAPSED_ARM_MS` (15 000) have passed since the last evaluation (the elapsed arm only relaxes the
speech arm for a slow speaker; it never fires on zero pending words). One evaluation in flight per call; `MAX_EVALUATIONS_PER_TURN`
10; `MAX_EVALUATIONS_PER_CALL_MINUTE` 8; evaluator timeout 4 000 ms; skipped evaluations coalesce into the next trigger.
Optional **first-cue arm** (D-6b): the first evaluation of a turn may fire at ≥ 12 words ∧ ≥ 6 s, then the normal cadence
(+1 evaluation per turn worst case).

**FINAL starvation (what happens at 30 s / 60 s without a FINAL):** nothing is evaluated, nothing is shown, nothing is
invented. While the endpointer reports speech and no FINAL has arrived for ≥ `FINAL_STARVATION_MS` (20 000), the tracker
records one observation `ATTENTION_FINAL_STARVED { gapMs }` (counter + gap histogram, no text) and keeps waiting. It never
sends `ForceEndOfUtterance` (that would split the person's utterance and change the frozen turn engine), never reads INTERIM,
never retries. At the commit the whole turn still goes to the durable path exactly as today, so the map catches up after the
turn as it does now. A starved turn is a **measured product failure of H-1**, reported, not hidden.

**Decision procedure after the Speechmatics proof (CP1 step 0, D-7):** per session, record every FINAL's arrival with its
word-end instant; compute the FINAL inter-arrival gap during continuous speech (G-P50, G-P95, G-max) and the word-end→FINAL
lag (L-P50, L-P95). **Gate:** G-P95 ≤ 5 s ∧ G-max ≤ 15 s ∧ L-P95 ≤ 2.5 s → H-1 holds, D-1 becomes final, CP1 continues.
Otherwise **STOP and report**; the PO then chooses (D-1b) between two narrow amendments, neither executed before approval:
(i) `max_delay_mode: fixed` for the call recognizer — a configuration amendment of the frozen ASR config (S8B-01), measured in
the same proof as its own arm (§6), at the documented cost of number/date formatting; (ii) a **stable-INTERIM prefix** rule
(words unchanged across ≥ 3 consecutive partials and older than 3 s may feed the evaluator) — an amendment of the S8B-05 §5.1
partials clause, with the lower accuracy of early text; recommended only if (i) fails the same gate.

**Speech → first visible change (recomputed, nothing hidden):**

| Term | Value | Class |
|---|---|---|
| Trigger wait (the speech arm itself, from the turn's first word) | **10 s** (6 s with the first-cue arm) | [P] by design — the largest term |
| FINAL for the 10th second of speech | 0.7 s documented bound at `max_delay 0.7` [W]; 1.0–1.3 s measured at `max_delay 1.0` [M]; plus an unquantified `flexible` entity hold | [W]/[M] |
| Evaluation wall time | 1.07–1.73 s (S8A-01 FAST calls, another prompt) | [M] reference, [E] for this prompt |
| Push + fold + redraw | ~0.1–0.3 s (one text frame, one `compileStage`, the canvas's digest re-prepare) | [E] |
| **First visible change** | **≈ 12–14 s after the turn begins** (≈ 8–10 s with the first-cue arm); then one change per ≥ 10 s of further speech | [E] |
| Changes before speech ends | 90 s turn → ≈ 8 evaluations; 120 s turn → 10 (cap); a turn shorter than ≈ 22 s cannot show two changes | [E] |

**Evaluator input (C4):** the turn's FINAL text so far (last ~600 words), the open provisional subjects (≤ 12), the speaker,
**and the user's current durable Threads of the session as `{ threadId, name }` pairs** (read-only, the same context reader the
half path already uses). **Never:** Memory, retrieval snippets, other sessions, INTERIM text.
**Evaluator output:** `events: [{ op: SET|WITHDRAW, subjectKey, label ≤ 40, kind, confidence, threadRef: threadId|null,
dependsOnWordEndMs }]`. A `threadRef` not in the input list → the whole answer is refused (as every DeepSeek parser here).
`CONFIRM` is no longer an evaluator output (settlement writes it, §3.5).

## 3.4 Event record — migration `0204` candidate, revised (C3, C4) [P]

`voice_private.call_attention_events` (append-only; **no row is ever updated**; `ACCOUNT_CASCADE`; FK `calls` CASCADE):

| Column | Meaning |
|---|---|
| `call_id`, `user_id`, `session_id`, `connection_epoch` | binding and provenance (0203 posture) |
| `event_seq` | **assigned by the writer RPC** under the call row's lock (`max + 1`), so two instances (a resume) can never interleave; the old epoch's late writes are fenced exactly as 0189 fences audio |
| `op` | `SET | WITHDRAW` (producer) · `EXPIRED | CONFIRMED` (settlement rows, §3.5) |
| `subject_key`, `label`, `kind`, `confidence`, `source` (`USER | QANDEEL`) | content; no transcript text, no INTERIM |
| `thread_ref` (nullable, FK Thread) | the referential binding chosen from the evaluator's input list, validated server-side |
| `track` | `USER | QANDEEL` — which recording track the words the event is about are on |
| `anchor_clock_ms` | **(1) the words' position**: USER = `captureOf(lastWord.endMs)`; QANDEEL = `clockStartMs + piece.endMs` (heard, after PLAYOUT). On the call clock. Never a display instant |
| `evidence_clock_ms` | **(2) when the ASR evidence reached the server**, as the capture position the server had ingested at the FINAL's arrival (`captureOf(streamMs)` at receipt). QANDEEL: = anchor (its text is known before it is heard; nothing is shown before heard) |
| `produced_clock_ms`, `produced_at` | **(3) when the interpretation was produced**: the capture position ingested at the evaluator's answer, and wall time |
| `xact_id xid8 DEFAULT pg_current_xact_id()` | **(4) when the row was stored**: certified later by the 0203 snapshot test (RECORDED) or not (uncertified) |
| *(not stored)* | **(5) arrival / display on the phone: NOT PROVEN** (v3 has no echo); nothing claims it, live or in Replay. A future `ATTENTION_ACK` is out of scope |
| `settles_event_seq`, `call_turn_index` (settlement rows only) | which `SET` a settlement row closes and under which committed turn |

Removed from v1.0: `call_turn_index` on event rows, `settled_by_turn_id`, `delivered_at` (C3: unproven), `CONFIRM` /
`SUPERSEDED` as producer ops. Access, retention, privacy, verifier, re-anchors and the "not hosted" posture are as v1.0 §3.4.
A turn's identity is **derived at read time** (anchor inside the committed turn's clock window), never written back.

## 3.5 Settlement, call end, reconnect (C4) [P]

- **Who settles:** the Durable Ordered Analysis Worker, after a USER half (or EXCHANGE) is settled COMPLETE
  (`call-analysis.worker.ts:229-236`), calls one DB function `server_settle_call_attention_v1(call, call_turn_index)`. It reads
  the open `SET`s whose `anchor_clock_ms` lies inside that turn's clock window and the durable Thread ids the committed half
  bound its CUs to, and writes **one settlement row per open subject**: `CONFIRMED` iff `thread_ref IS NOT NULL` and the half's
  committed binding contains **that same Thread id** (id equality, never text); otherwise `EXPIRED`. Idempotent (no rows when
  the turn already has settlement rows), runs on **any** instance, needs no in-memory state, makes **no model call**. The
  durable path never reads provisional rows; the settlement function only reads durable ids after the durable commit.
- **Never a promotion:** a subject without a `thread_ref` ends `EXPIRED` even when the durable half created a Thread of the
  same name; the live cue disappears and the durable body appears by the normal catch-up. Two honest things, not one claim.
- **Call end:** no settlement rows. By rule, every open subject is `EXPIRED` at `calls.ended_at` (applied at read time by
  `ATTENTION_STATE`, never sent after end, and by the Replay reducer). This covers `USER_ENDED`, `PEER_LOST_AFTER_GRACE` and
  the recovery ends without touching 0189.
- **Reconnect on the same or another instance:** the old connection commits its turn at hand-over (`:395-421`), so the
  in-flight evaluation is aborted and its turn will be settled by the worker wherever it runs. The new connection sends
  `ATTENTION_STATE` from the DB reader (open `SET`s of the call minus settled minus ended). The phone replaces its layer, then
  applies `seq > snapshot.seq`. `event_seq` is DB-assigned (§3.4), so no duplicate and no gap across instances.
- **Mid-turn hand-over loses nothing true:** events already stored stay history; an evaluation that had not answered is simply
  absent (never reconstructed).

## 3.7 Live map expression (C2) and Replay placement (C3) [P]

### Live (CP2) — the smallest controlled amendment of the frozen stage

Why: the production map today can show provisional attention only by misusing the selection instrument, and nothing at all
for a subject that has no body yet (§1). So a controlled amendment is proposed instead of deferring the core feature.

- **`SceneInput.attention?: readonly AttentionMark[]`**, `AttentionMark = { subjectKey, label, entityId: string | null,
  confidence }`. `undefined` → the stage is **byte-identical** to today (every golden stays; `digestOf` unchanged for it).
- **Glow (resolved: `entityId` is a THREAD/READING on the rung, by `thread_ref`):** one extra `SPRITE.PUFF` in the **entity's
  own dye**, alpha 0.28, 1.6× the body's halo, at the entity's position. No gold, no ring, no scale, no title change, no new
  hit. It reads as "this body is being spoken about", not "selected".
- **Ember (unresolved: a new subject with no body):** one `SPRITE.SPARK` in `TINT.WARM`, alpha 0.6, size 14, plus an
  **ordinary** label (`major: false`, `emphasis: false`) with the ≤ 40-char provisional label, drawn in the warm role tint
  (`lightRgbOf` learns the three role tints — one declared canvas line). Position is **presentation only and carries no
  meaning**, by the same rule as Readings' orbits: `orbitOf(ordinal, turnOf(subjectKey))` about the current Live Focus Thread
  when one exists, else about the scene's centroid. No nebula, no halo, no line, **no hit target** (not inspectable in CP2).
- **Truth rules amended by one sentence** in `stage.ts`'s header: "An attention mark is not an entity: it emits no body and
  no line, is drawn only in the warm role tint or as a glow of a real body, and vanishes when withdrawn, settled or at call end."
- **Cost and protection:** ≤ 12 marks per rung → ≤ 12 sprites in the **same atlas draw** and ≤ 12 ordinary labels in the
  **existing label view**; no new draw pass; the camera engine, gestures, S3-R2 assets and every existing sprite are untouched;
  the ember/glow follow the camera like everything else. A withdrawal or settlement removes the mark; the stage digest changes
  and the canvas re-prepares as it does for any change.
- **Visible-change contract for CP2 (B5):** three topics → three embers (or glows) appearing one after another **before the
  speech ends**; the negation → one ember removed; one QANDEEL-side mark during QANDEEL's own speech. Proven with **before /
  after stills** of the map region at each step (pixel diff > 0 in the map region, digest change, and the stills put in
  front of the PO), not only by counting events.
- **Alternative considered and not recommended:** a host overlay strip under the map (no stage change). Rejected because the
  review requires a visible change **of the map**.

### Replay (CP3) — placement that never back-dates

For each event, the Replay read returns the three stored instants mapped through the version's 0195 run plan (as 0202 maps
X: first run of the recording whose clock ends after X, at max(X, run start)) **on the event's own track**, and the
certification of its `xact_id` by the 0203 seam:

- `displayFloorMs` = the certified availability when RECORDED (it is ≥ produced by construction), **else `produced_clock_ms`**
  placed by the same run mapping and labelled `SOURCE_RECORDED` (non-exact). **Never the anchor.** S4's SOURCE_ORDER keeps
  eligible history visible; it does not license a live-appearance instant the server did not record — the produced position
  *is* a server-recorded position of the live call, so using it fabricates nothing.
- `disclosedAt(e) = max(displayFloorMs, anchorPlacementMs, disclosedAt(previous on the same subject))`; the anchor is kept as
  what the event is about (never before the words), the floor as when it could first be seen.
- An event whose anchor lies in no presented window of its track stays out (the words it is about are not heard).
- `NOT_FOUND` / refused / other version / digest mismatch → empty lane, Lane A untouched (as v1.0).
- Worked example: anchor 10.0 s, evidence 10.9 s, produced 12.6 s, stored 12.65 s, certified by the next echoed mark ≤ 13.4 s
  → Replay shows the mark at 13.4 s (certified) or 12.6 s (uncertified, labelled) — **never at 10.0 s**. Live, the phone
  showed it at an unproven instant ≥ 12.6 s; Replay claims nothing about that.
- `event-track.ts` re-anchor (D-10): `anchorMs` stays; a new `floorMs` enters the reduction; the pre-correction "UNRECORDED
  refuses the track" rule is replaced by "uncertified → `floorMs` from the produced position, labelled"; Lane A unchanged.

---

# 5. Checkpoints — amended acceptance

| CP | Added / changed by v1.1 |
|---|---|
| **CP1** | **A0 (step 0, paid, D-7):** the cadence proof with the gate of §3.2 — PASS → continue; FAIL → **STOP**, report, D-1b. If D-7 is not authorised, CP1 is synthetic-only and H-1 stays `NOT PROVEN` on the record. **A1** also asserts: no evaluation without ≥ 20 pending FINAL words; `ATTENTION_FINAL_STARVED` observed when the fake recognizer withholds finals for 25 s. **A6 (settlement):** a `SET` with a valid `thread_ref` whose half binds that Thread id → `CONFIRMED`; the same label with no ref → `EXPIRED`; a ref outside the input list → answer refused; settlement idempotent; two-instance harness: the half completes on the other instance and settles. **A7 (instants):** every stored row has `anchor ≤ evidence ≤ produced` on the call clock; QANDEEL rows only after the PLAYOUT heard mark. |
| **CP2** | **B2 (reconnect):** the resume on the second instance gets `ATTENTION_STATE` from the DB; `event_seq` strictly rising across the hand-over; the old epoch's late write is fenced. **B4:** the stage amendment: `attention` undefined → byte-identical goldens; glow uses the entity's dye, never gold; ember has no hit; a `WITHDRAW` removes it. **B5:** the visual before/after of §3.7 (three progressions + one withdrawal + one QANDEEL-side mark) on the Android emulator with fake providers, stills delivered. |
| **CP3** | **C2 rewritten:** certified → placed at certification; uncertified → placed at the produced position, labelled; **no event is ever disclosed at its anchor alone**; an event outside its track's presented windows is out. **C7:** per-track proof — a QANDEEL-track event never appears inside a USER-only window. |
| **CP4** | **Closure wording (C6):** `INTEL-LIVE-01 CP1–CP4 DELIVERED (synthetic mechanism proven)`; `QAN-BL-INTEL-06` → **`VALIDATION — OPEN`** with the close condition "HONOR Live + Replay proof recorded"; the cost table restated with [M] from CP1's calibration; `SYNTHETIC_ONLY` carried as the product-readiness blocker (QAN-BL-AI-01). Never `CLOSED — TOMBSTONE` at CP4. |

---

# 6. Cost and capacity (C5) — re-based on the pages read today

**Prices [W], read 2026-11-25:**

| Provider / item | Figure | Note |
|---|---|---|
| Speechmatics Real-time **Enhanced** | **USD 0.80 / h** | QANDEEL's configured tier (`enhanced`, `ar_en`). The S8B-01 record's basis stands |
| Speechmatics Real-time Standard / **Melia 1** / Oak 1 / Linden 1 | 0.45 / **0.40** / 0.46 / 0.30 (Linden promotional, 0.40 before) | **0.40 is Melia 1**, a different model; Arabic coverage and S8B-01 qualification for it do not exist. Not assumed; shown as sensitivity |
| DeepSeek `deepseek-flash` (V4.1-Flash-1017) | per 1M tokens, peak: cache hit 0.006, miss 0.30, output 1.20; **off-peak half**; peak Mon–Fri 01:00–04:00 and 06:00–10:00 UTC | unchanged from the S8B-01 record. Cairo daytime (UTC+2) overlaps the second peak block |

INTEL-LIVE-01 adds **no ASR cost**: the recognizer already streams for the whole call (S8B-01 `:1856`). It adds DeepSeek
evaluations only.

| Quantity | Value | Class |
|---|---|---|
| Evaluations per 120 s USER turn | ≤ 10 (cap); ≈ 8 for 90 s; +1 with the first-cue arm | [P] |
| Tokens per evaluation | ≈ 1,400 in / ≈ 120 out — **an estimate until CP1's calibration measures it** | [E] |
| USD per evaluation (peak) | ≈ 0.00056 (miss) · ≈ 0.00033 with the fixed prompt cached | [E] |
| USD per 120 s turn, worst | ≈ 0.0056 (0.0062 with the first-cue arm) | [E] |
| USD per call minute added, worst / typical | ≈ 0.0053 / ≈ 0.003 (S8B-01's 4 exchanges per minute, QANDEEL 45 %) | [E] |
| Against the approved per-minute model (ASR at 0.80 → USD 0.026–0.029) | **+18–20 % worst, +10–12 % typical** | [E] |
| Sensitivity: if the ASR term were 0.40/h (base ≈ 0.019–0.022) | +24–28 % worst, +14–16 % typical — **only if the PO chose a different ASR model**, which is not proposed | [E] |
| 1,000 users / month | still **no approved usage profile**; S8B-01's rows 30 / 150 / 600 min per user-month → USD 160 / 800 / 3,200 worst peak, half off-peak | [E] |
| Paid proof: Speechmatics cadence | 6 sessions × ≤ 120 s = 12 min: **4 `flexible` (the configured mode) + 2 `fixed` (D-1b's arm)** → ≈ USD 0.16 at 0.80 (0.08 at 0.40); **cap USD 0.30** unchanged | [E] |
| Paid proof: DeepSeek calibration | 40 synthetic-script calls ≈ USD 0.02; **cap USD 0.10** | [E] |

**Capacity — three different numbers, never conflated:**

| Limit | Speechmatics real-time | DeepSeek | Class |
|---|---|---|---|
| **Published** | Free 2 / Pro 50 / Enterprise custom concurrent sessions; `quota_exceeded` → close 4005; the handshake reports `concurrent_session_usage` | `deepseek-flash` **2,500 concurrent requests per account**, HTTP 429 beyond; no RPM figure published | [W] |
| **QANDEEL's account today** | `realtime_session_capacity = 2` (evaluation account) → at most 2 live calls exist at once | the same account as every existing analysis call; no measured ceiling | [S] |
| **Load tests** | **None for this lane.** S8B-05 CP4's two-instance proofs are correctness proofs, not load tests. The 1,000-concurrent figure is GCR-01's worst-case *target*, not a capacity | — | [M] gap |
| Need of this lane | 0 extra sessions | ≤ 1 in flight per live call → ≤ (concurrent calls) requests, far under 2,500 at any plausible account limit | [P] |

Token sizes and call counts stay **[E] until measured**; CP4 restates them with [M].

---

# 8. Governance (C6, C7)

## 8.2 At CP1 (after approval) — amended
- Admit `QAN-BL-INTEL-06` on `main` as `DEFERRED — OWNED` (owner INTEL-LIVE-01), reopen condition "CP4 delivered", **close
  condition "HONOR Live + Replay proof recorded"** (C6). CP4 moves it to `VALIDATION — OPEN`, never to a tombstone.
- The S8B-05 §5.1 controlled amendment (D-2) stays as v1.0; if D-1b (ii) is ever chosen, that is a **second**, separate amendment.
- The product-readiness statement carried in every record from CP1 on: "DeepSeek is `SYNTHETIC_ONLY`; synthetic acceptance
  proves the mechanism, not the product; the product gate is the HONOR Live + Replay proof (PO sequence step 3)."

## 8.3 PR #410 — transfer plan, then closure (D-9)
#410 (head `55d016b6`, Draft, base `main`, conflicts in `QANDEEL_PROJECT_MAP.md`) is **not merged**. Its four files:

| File on #410 | Where it lands | How loss is excluded |
|---|---|---|
| `docs/e2e/QANDEEL_INTEL_LIVE_INCREMENTAL_UNDERSTANDING_GAP_v1.md` | `main` at CP1, same path, body **verbatim** + a dated status addendum (origin `55d016b6`; #408/#409/#413 merged; Lane B seam exists; this contract) | `git diff 55d016b6:<path> <CP1 copy>` must show only the addendum; the diff is pasted in the CP1 PR body |
| `docs/e2e/QANDEEL_S8B07_S4_INCREMENTAL_UNDERSTANDING_REPLAY_COMPATIBILITY_v1.md` | the same, same path (`event-track.ts` already cites its §3.1) | the same check |
| `docs/qandeel-canonical-backlog-v1.md` (the `QAN-BL-INTEL-06` entry) | the entry's text transferred **verbatim** into the CP1 admission on `main`, status per §8.2 | side-by-side in the CP1 PR body |
| `QANDEEL_PROJECT_MAP.md` (banner) | superseded by #414's banner and CP1's; only its two document pointers are carried | the pointers listed in the CP1 banner |

Then, and only then, #410 is closed **on the PO's word**, with a comment naming the CP1 commit. #414 stays Draft, unmerged and
**unchanged by v1.1** (its banner points at the CP0 folder, which now holds v1.0 and v1.1; CP1 updates the pointer).

## 8.6 Sequence (unchanged)
INTEL-LIVE-01 (CP1–CP4) → HONOR Live + Replay proof → S5 / CP2-A → CP2-B. S5 is not started; approved COSMOS work is not
modified beyond the one declared stage amendment of §3.7, which is itself a PO decision (D-5).

---

# 9. Decisions — final or conditional

| # | Decision | State in v1.1 | Needed before |
|---|---|---|---|
| **D-1** | FINAL segments only to DeepSeek; INTERIM never leaves the recognizer | **CONDITIONAL on the A0 gate** (G-P95 ≤ 5 s ∧ G-max ≤ 15 s ∧ L-P95 ≤ 2.5 s). Approve as the hypothesis to test | CP1 |
| **D-1b** *(new)* | If the gate fails: (i) `max_delay_mode: fixed` (ASR config amendment) or (ii) stable-INTERIM prefix (§5.1 partials amendment) | **Deferred to the proof's result**; the PO chooses then; nothing executed before | after A0 |
| **D-2** | Controlled amendment of S8B-05 §5.1 "DeepSeek starts after the commit", for the attention evaluator only; CA-05-01 §1.6 extended by the caps | Unchanged; approve as a narrow dated amendment | CP1 |
| **D-3** | Protocol v3 = v2 + `ATTENTION` / `ATTENTION_STATE`; iOS offers `v3, v1` | Unchanged | CP2 |
| **D-4** | Migration `0204` with the **revised** shape of §3.4 (three instants, track, `thread_ref`, DB-assigned `event_seq`, settlement rows; no turn id or settlement state on event rows; not hosted) | Revised; approve the shape | CP1 |
| **D-5** | **Replaced:** the smallest controlled stage amendment — `attention` marks (glow in the body's dye; warm ember + ordinary label for an unresolved subject; no hit; no gold) — instead of existing fields | New recommendation | CP2 |
| **D-6** | Starting values: `MIN_NEW_WORDS 20`, `MIN_NEW_SPEECH_MS 10 000`, `ELAPSED_ARM_MS 15 000` (relaxes the speech arm only), `FINAL_STARVATION_MS 20 000` (observation only), caps 10 / turn and 8 / min, timeout 4 000 ms, label ≤ 40 | Clarified; approve as configuration | CP1 |
| **D-6b** *(new)* | First-cue arm (12 words ∧ 6 s for the first evaluation of a turn) → first change ≈ 8–10 s instead of 12–14 s, +1 evaluation per turn | Recommend **yes** | CP1 |
| **D-7** | Paid proofs: Speechmatics 4 `flexible` + 2 `fixed` sessions ≤ 120 s (≈ USD 0.16, cap 0.30); DeepSeek 40 calls (≈ 0.02, cap 0.10); synthetic content, EU, training off | Re-based; authorise both | CP1 step 0 |
| **D-8** | Retention: rows live with the call (cascade). `delivered_at` **dropped** (unproven, C3) | Revised | 0204 text |
| **D-9** | #410: transfer per §8.3 at CP1, verified, then close on the PO's word; never merged | Revised | CP1 |
| **D-10** | Lane B re-anchor: floor = certified availability else the produced position (labelled); never the anchor alone; per-track windows | Revised | CP3 |
| **D-11** *(new)* | `QAN-BL-INTEL-06` closes only by the HONOR Live + Replay proof; CP4 leaves it `VALIDATION — OPEN` | New | CP4 |

Blocking CP1: D-1 (as hypothesis), D-2, D-4, D-6, D-7. Blocking CP2: D-3, D-5. D-1b only if A0 fails. D-8 before the 0204
text; D-9 at CP1; D-10 at CP3; D-11 at CP4.

---

# 10. What v1.1 did not do
No runtime code, no migration, no protocol change, no paid AI or ASR call, no device run, no hosted change, no merge, no edit
of #414 or of #410, no edit of frozen contracts, Lane A, COSMOS or Live Voice. HONOR and iOS: **NOT TESTED**. CP1 is not started.
