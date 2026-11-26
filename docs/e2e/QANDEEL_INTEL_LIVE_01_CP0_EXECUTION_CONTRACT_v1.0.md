# QANDEEL — INTEL-LIVE-01 — Incremental In-Speech Understanding & Living Map Attention
## CP0 — Execution Contract & Engineering Readiness — v1.0 (FOR PRODUCT OWNER REVIEW)

**Status:** `INTEL-LIVE-01 CP0 DELIVERED — CONTRACT PROPOSED — NOTHING IMPLEMENTED — READY FOR PO REVIEW`
**Date:** 2026-11-25
**Baseline:** `main` at `aa6fc0c8cd2fe023070df9bc8c19505b00bf783f` (PR #413 merged: RB-2 / S4 + S4-CORRECTION-01). Read from a clean
detached worktree of that commit (`E:/intellive`). No runtime code, migration, protocol change, paid AI call or merge was made.
**Authority consumed (binding, not re-opened):** the Product Owner's direction "INTEL-LIVE-01 / CP0" (2026-11-25); S4-CORRECTION-01
(S8B-07 record §19); the S8B-05 contract v1.2 FINAL (Part A normative) and its merged implementation (CP1–CP4); the Live Call
protocol v1 (frozen) and v2 (frozen, M-2); migrations `0189` – `0203`; the COSMOS S3-R2 frozen visual authority; the #410 gap record
and S4/S5 compatibility annex (Draft, unmerged, read for direction only).
**Owner of this task:** `INTEL-LIVE-01` (named by the PO on 2026-11-25). Backlog target: `QAN-BL-INTEL-06`, which today exists
**only on the unmerged #410 branch** (§8.3).

### Evidence classes

| Mark | Meaning |
|---|---|
| **[S]** | Static inspection of `aa6fc0c8` (`path:line`). |
| **[M]** | A measurement already recorded in the repository or in `E:/QANDEEL_REPORTS` (device, paid run, CI or real-PostgreSQL run); "synthetic" marks a fake-provider run. |
| **[E]** | An estimate: a price read from a provider page, or arithmetic over [M] and stated assumptions. Never a measurement. |
| **[P]** | A proposal of this contract. Nothing marked [P] exists in code. |

---

## ملخص تنفيذي (بالعربية)

- **الفجوة مثبتة في الكود:** Speechmatics يرسل FINAL وINTERIM أثناء الكلام، لكن محرك الدور يحتفظ بالـFINAL فقط حتى اعتماد الدور
  بعد صمت 800 ms، والعامل الدلالي يحلّل الأنصاف المعتمدة فقط. لا تصل أي معرفة إلى الخريطة قبل نهاية الدور. ولا يوجد اليوم أي
  مفهوم "انتباه مؤقت" أو "سحب" في الخادم أو في COSMOS أو في Replay (Lane B حدّ مكتوب فارغ فقط).
- **التصميم الموصى به:** مسار **Provisional Attention** منفصل تمامًا عن المعرفة الدائمة: يستهلك مقاطع **FINAL** المستقرة التي تصل
  أثناء الكلام (لا INTERIM إلى DeepSeek أبدًا — يحافظ على §5.1 من عقد S8B-05)، يستدعي DeepSeek Flash مرة واحدة لكل ≥ 10 ثوانٍ من
  كلام جديد (لا استدعاء لكل كلمة)، ينتج أحداث `SET / WITHDRAW` قابلة للتصحيح، يكتبها في جدول ملحق واحد (الترحيل المرشح
  `0204`)، ويدفعها إلى الهاتف عبر **بروتوكول v3 إضافي** (v1/v2 بلا تغيير). المعرفة الدائمة والذاكرة وThreads تبقى على مسار
  الاعتماد الحالي كما هو؛ لا يكتب المسار المؤقت فيها شيئًا.
- **Replay:** أحداث الانتباه الفعلية تُسجَّل مع لحظة التزامها في قاعدة البيانات وتُعتمَد زمنيًا بنفس آلية M-2 (لقطات 0203)؛
  Lane B الموجود يستهلكها، مع إعادة تثبيته على سياسة S4-CORRECTION-01 (نقص الشهادة = ترتيب المصدر، لا إخفاء). لا اختلاق لأحداث
  لم تحدث.
- **التكلفة (تقدير محسوب لا قياس):** ≤ 10 استدعاءات لدور 120 ثانية؛ ≈ USD 0.004 – 0.006 للدور في أسوأ حالة ذروة؛ ≈ +18 – 20 %
  على نموذج تكلفة الدقيقة المعتمد (USD 0.026 – 0.029). أرقام 1,000 مستخدم تُحسب فقط على افتراضات S8B-01 المسجلة لأنه **لا يوجد
  نمط استخدام معتمد**.
- **القرارات المطلوبة (§9):** D-1 … D-10، أهمها: تعديل محكوم لعقد S8B-05 §5.1 (بدء DeepSeek قبل الاعتماد لمسار الانتباه فقط)،
  بروتوكول v3، الترحيل 0204، التعبير البصري داخل بدائل COSMOS الحالية، إثبات Speechmatics المدفوع المحدود (سقف USD 0.30)،
  مصير PR #410.

---

# 1. Code-verified current truth (Before)

## 1.1 ASR and the call turn (server)

| Fact | Evidence |
|---|---|
| Speechmatics realtime is configured `ar_en`, `enhanced`, `enable_partials: true`, `max_delay 0.7` (`flexible`), provider end-of-utterance trigger **off** | `apps/api/src/voice/speechmatics/speechmatics-realtime.config.ts:17-26`; `speechmatics-realtime.adapter.ts:424-435` [S] |
| `AddTranscript` → `FINAL`, `AddPartialTranscript` → `INTERIM`; consecutive INTERIMs coalesce in the queue | `speechmatics-realtime.adapter.ts:95-108, 356-359` [S] |
| **The turn engine keeps only FINAL words; an INTERIM never leaves `readEvents`** | `apps/api/src/voice/call-turn/live-call-turn.engine.ts:302-308` [S] |
| FINAL words accumulate in `finals[]` **during** the turn; they are consumed only by `takeUtterance()` after `COMMIT_SILENCE` | engine `:224-227, 334-340` [S] |
| Endpointer: VAD 20 ms frames, RMS ≥ 300, `FINALIZE` after 500 ms silence → ForceEndOfUtterance; `COMMIT_SILENCE` after 800 ms → commit; speech resuming before the commit is the SAME turn | `call-endpointer.ts:1-22, 75-108` [S] |
| The commit writes the USER turn (`content` = FINAL text, ≤ 4000 chars, `MACHINE_ASR`) and queues its half for analysis in the same transaction | `0191:1345-1432`; engine `:412-427` [S] |
| Kicks to the analysis worker: `TURN_COMMITTED`, `FIRST_AUDIO`, `EXCHANGE_CLOSED` (in memory, never awaited) | `live-call-analysis.signal.ts`; engine `:140-143` [S] |
| QANDEEL's reply is released piece by piece (`release(piece, speech)`), each piece registered with its text and its range on the reply clock; the heard mark comes from the phone's `PLAYOUT` | `call-reply.ts:178-194, 236-275, 508-517` [S] |
| **Frozen contract clause:** "النصوص المؤقتة (Partials) لا تذهب إلى DeepSeek ولا الذاكرة أبدًا" and "بدء DeepSeek: فقط بعد Turn Commit" | S8B-05 contract v1.2 FINAL §5.1 (`E:/QANDEEL_REPORTS/S8B-05/…v1.2_FINAL…md:609-622`); mirrored in record §3 (`docs/e2e/QANDEEL_S8B_05_…RECORD_v1.md:394`) |
| Speechmatics FINAL cadence during a **90–120 s uninterrupted turn: NOT MEASURED anywhere.** The two paid S8B-01 runs used ~5 s lines (30 s ceiling); "a final arrives about 1.0 s after the audio it covers" was observed at `max_delay 1.0`, and a 3.8 s clip produced 9 finals and 17 partials | S8B-01 record `:881-882, 1116-1117, 1166` [M, short lines] |

## 1.2 Semantic intelligence (server)

| Fact | Evidence |
|---|---|
| The Durable Ordered Analysis Worker claims queued halves FIFO by `call_turn_index`, one worker per session (semantic lease), default start `AFTER_FIRST_AUDIO` (M1), `AT_COMMIT` opt-in | `call-analysis.worker.ts:36-56, 131-240`; `0191:147, 158-180` [S] |
| One half = four sequential DeepSeek Flash calls (segmentation → focus per CU → Thread establishment → continuity) + a pure Live Focus reducer, committed in **one** SQL transaction that writes CUs, focus semantics, **durable Threads**, lifecycle and Live Focus transitions | `conversation-semantic-establishment.service.ts:355-409, 583-690`; `0191:1527, 782-964` [S] |
| "LH and LF never retract"; no withdraw / retract / supersede exists for CUs, Threads or Live Focus; the only "provisional" ids are in-memory `prepared:` ids | service `:470`; `conversational-focus-evaluator.service.ts:44-49` [S] |
| Memory is written by the post-response path from the exchange-close outbox event, not by the half path | `post-response-intelligence-dispatcher.service.ts:65`; `0192:169` [S] |
| Background permits: `B_total 16, B_min 2, k 2, 2 per person`, L2 critical window 10 s; permit kinds `CALL_ANALYSIS | TEXT_SEMANTIC_ANALYSIS | POST_RESPONSE_INTELLIGENCE` | `0191:82-85, 237-251`; `background-permits.ts:16` [S] |
| DeepSeek is **`SYNTHETIC_ONLY`** in every environment (`requireDeepSeekQualification`), `deepseek-flash`, `maxRetries 0`, JSON mode; no Model Router in the structured path (shared client + cost-ledger decorator) | `deepseek-client.ts:15-33, 52, 106`; `production-ai-provider-call-accounting.ts:22` [S] |
| Measured today (synthetic, fake providers): 6.62 analysis calls per exchange; commit → Live Focus P50 1.2–1.8 s, best P95 3.9 s (target ≤ 2 s NOT MET); First Audio M1 +69/+131 ms (NOT MET, GCR-01-A) | S8B-05 record `:762-789, 1546-1569` [M, synthetic] |

## 1.3 Mobile and the live COSMOS map

| Fact | Evidence |
|---|---|
| **The call socket carries no analysis.** The map refreshes by HTTP polling: a foreground catch-up every 5 s plus an immediate catch-up on `TURN_COMMITTED` / `REPLY_END` / resumed `ACTIVE` | `live-driver-scheduler.ts:30`; `integration-runtime.ts:707-710`; `call-owner.ts:364, 384, 388` [S] |
| Catch-up = `fetchSessionTemporalState` + `fetchCommittedEvents` + `fetchLiveFocusEvents`, then `projection.ensure({sessionId, tc, depth})` per rung; the canvas re-prepares on `stage.digest` | `foreground-live-driver.ts:209-276`; `projection-coordinator.ts:177-229`; `CosmosCanvas.tsx:701` [S] |
| `SceneInput = { world, rungs, entities, ties?, focusId, receded?, fringe?, focusMotes?, rtl }`; the Personal scene has `THREAD`, `READING` entities and counts `EMERGING_FOCUS` (no loci) into `fringe` | `cosmos/core/stage.ts:30-39`; `adapters.ts:73-91`; `map-scene.ts:42` [S] |
| **No transient / provisional / attention overlay exists** on the live map; `focusId` (gold rings) is derived only from the canonical inspection; `focusMotes` is a numeric count drawn by `instrument()` | `stage.ts:110-123, 177`; `personal.ts:126-128` [S] |
| Protocol v2 was added as a separate module beside frozen v1, negotiated by WebSocket subprotocol; Android offers `v2, v1`, iOS offers v1 only; the phone's parser accepts exactly 7 server message types | `live-call-client.ts:255-271, 289-321`; `live-call-protocol-v2.ts` (36 lines) [S] |
| Reconnection: 30 s grace, backoff 250–2000 ms; the client replays unacknowledged controls and the last 2 s of audio after the first `STATE`; `epoch` and `v2` are per socket | `live-call-client.ts:99-100, 345-376, 394-411` [S] |
| During a call the Analysis depth shows the Personal COSMOS map with the call line under it (`driftPaused` while live) | `DepthComposition.tsx:676-690, 759-790` [S] |

## 1.4 Replay (after S4-CORRECTION-01)

| Fact | Evidence |
|---|---|
| Lane A: `disclosedAt(k) = max(availability, windowStart, completeAt, previous)`; stage kinds `ORDINAL_ONLY | CERTIFIED | SOURCE_ORDER | NEUTRAL`; closing display; NOT_FOUND alone is neutral | `timeline.ts`, `stage-timeline.ts`, record §19 [S] |
| **Lane B (`event-track.ts`) is a typed boundary with no producer, no store, no fetch, no drawing**; events `SET / WITHDRAW` one `subjectKey`, from `USER | QANDEEL`, with `anchorMs`, `availability`, `sequence`, open `payload`; bound to `{replayId, versionId, revision, mapDigest}`; reduced purely on Lane A's clock | `event-track.ts:25-109, 171-174`; record §18.4 [S] |
| Lane B still carries the **pre-correction** rule: "an UNRECORDED event refuses the whole track, AFTER_END is never inside the Replay" — contrary to §19's placement policy for uncertified history | `event-track.ts:14-19` [S] |
| `frame.tsx` composes Lane A knowledge and the camera plan only; `ReplayCosmosScene` has no Lane B field; nothing assembles a Lane B binding | `frame.tsx:25-27, 51-62, 186-222` [S] |
| S3's availability answer is an exact-key decoder (`replay-availability.ts`); S7-01 pins exactly two `/replay/` routes in the media client | record §18.5; `tests/s7-01-…contract.test.mjs` [S] |
| Certification mechanism (M-2): a ledger row's `xact_id` is tested with `pg_visible_in_snapshot(xact_id, snapshot)` against the slot snapshot the phone echoed | `0203:134`; `0201:71-93` [S] |

## 1.5 PR #410 (Draft, unmerged, stale)

- Branched from `f45400a8`; its locator banner conflicts with `main` (`git merge-tree` CONFLICT in `QANDEEL_PROJECT_MAP.md`); its
  statements "S3 #408 / M-2 #409 Draft", "S4 open", "no Lane B seam" are superseded by the merges of #408, #409 and #413 [S].
- Its two documents (the gap record and the S4/S5 compatibility annex) remain the right direction and are consumed here; the
  annex's Lane B concept is what S4-E built. Disposition in §8.3 (D-9).

---

# 2. Data-path map — Before / After

```
BEFORE (aa6fc0c8)
 phone audio ─► gateway ─► Speechmatics (FINAL + INTERIM) ─► turn engine: finals[] (held) ─ 800 ms silence ─► COMMIT
   ─► call_analysis_queue ─► worker (M1: after FIRST_AUDIO) ─► 4 DeepSeek calls ─► ONE tx: CUs, Threads, LF ─► 0201 ledger row
   ─► phone polls (5 s / on TURN_COMMITTED) ─► projection.ensure ─► COSMOS redraw            ─► M-2 marks certify ─► S3 ─► Lane A
 During a 120 s turn: nothing reaches analysis, the map, or Replay. Lane B: empty.

AFTER (proposed) — one added lane, the existing path unchanged
 phone audio ─► gateway ─► Speechmatics ─► turn engine: finals[] ──┬── (unchanged) COMMIT ─► worker ─► durable chain ─► Lane A
                                                                   └─► [P] ProvisionalAttentionTracker (same instance, in memory)
                                                                        trigger: ≥ 10 s of new FINAL speech AND ≥ 20 new words
                                                                        ─► 1 DeepSeek Flash call (attention evaluator, permit-gated)
                                                                        ─► events SET/WITHDRAW/CONFIRM (subjectKey, label, anchor)
                                                                        ─► 0204 call_attention_events (append-only, xact_id)
                                                                        ─► v3 ATTENTION push ─► phone provisional layer ─► stage
                                                                        ─► M-2 snapshots certify the row ─► Lane B read ─► Replay
 QANDEEL's reply: released pieces ─► one evaluator call per reply ─► events anchored to the piece's HEARD end (after PLAYOUT)
 On COMMIT: in-flight evaluation cancelled; provisional state for that turn is CONFIRMED or WITHDRAWN by the durable result (§3.5)
```

---

# 3. Recommended design

## 3.1 Principles (binding for CP1–CP4)

1. **Two truths, one direction.** Provisional attention never writes to CUs, Threads, Live Focus, Memory, the 0201 ledger or the
   semantic clock. The durable path is untouched. Provisional → durable happens only through the existing commit (§3.5).
2. **FINAL only to DeepSeek.** INTERIM text never leaves the recognizer loop (as today). This keeps S8B-05 v1.2 §5.1's partials
   clause intact; only the "DeepSeek starts after the commit" row needs a narrow controlled amendment (D-2).
3. **No per-word or per-ASR-update calls.** One evaluation needs both ≥ `MIN_NEW_SPEECH_MS` (10 000) of new speech and
   ≥ `MIN_NEW_WORDS` (20) new FINAL words since the last evaluation, with one evaluation in flight per call, a hard cap of
   `MAX_EVALUATIONS_PER_TURN` (10) and `MAX_EVALUATIONS_PER_CALL_MINUTE` (8). Values are **starting values** (D-6).
4. **Lossy by design, never blocking.** No permit, a timeout (4 000 ms), a provider error or the budget → the evaluation is
   skipped and its text is coalesced into the next trigger. No retry. Nothing on the voice path awaits it.
5. **Never before speech, never before availability.** An event's `anchorCaptureMs` is the capture-clock end of the last FINAL
   word it depends on (`captureOf(word.endMs)`, engine `:255-268`); for QANDEEL, the heard end of the piece. Replay placement
   uses the M-2 certification of the row's commit, else source order (S4-CORRECTION-01).
6. **No fabricated history.** Only events actually produced during the call are stored; nothing is derived afterwards from the
   final transcript or the final map.
7. **COSMOS graphics and camera engine unchanged.** The live cue uses existing stage inputs only (§3.6, D-5).

## 3.2 Producer: `ProvisionalAttentionTracker` [P]

- **Where:** `apps/api/src/voice/call-turn/provisional-attention/` (new folder), one tracker per `CallTurnSession`, fed from
  `readEvents` with each FINAL (`{text, band, startMs, endMs}` → capture clock via `captureOf`). The engine's only change is a
  one-line hand-off; `finals[]`, `takeUtterance`, `commitSpoken` are unchanged.
- **Trigger policy (§3.1 #3)** evaluated on each FINAL arrival; also a `MAX_SILENT_EVAL_GAP_MS` (15 000) timer so a slow
  speaker still gets an evaluation when ≥ 20 words are pending.
- **Evaluation input:** the turn's FINAL text so far (bounded to the last ~600 words), the current provisional state (subject
  keys + labels, ≤ 12), the current Live Focus label (read-only, from the context reader already used by the half path), and
  the speaker (`USER` / `QANDEEL`). **Never:** Memory, retrieval snippets, other sessions, INTERIM text.
- **Evaluation output (JSON, closed schema):** `events: [{ op: SET|WITHDRAW|CONFIRM, subjectKey, label (≤ 40 chars),
  kind: TOPIC|PERSON|PLACE|EXPERIENCE|CONCERN|CORRECTION, confidence: HIGH|MEDIUM|LOW, dependsOnWordEndMs }]`. A correction or
  negation of an earlier subject is a `WITHDRAW` (and optionally a `SET` of the corrected subject). Unknown keys → the whole
  answer is refused (as every DeepSeek parser here does).
- **Provider:** DeepSeek Flash through the existing shared client (`deepSeekJsonRequest`, thinking off, 4 000 ms timeout,
  0 retries), a new prompt `attention-evaluator-deepseek-v1`, wrapped by `costLedgerDecorator('PROVISIONAL_ATTENTION')` and the
  `SYNTHETIC_ONLY` qualification (unchanged). It is a **new provider function**, not a reuse of the four-call half chain (that
  chain is 885–950 ms of sequential service time and writes durable rows).
- **Permit:** a new kind `PROVISIONAL_ATTENTION` on the existing `DatabaseBackgroundPermitGate`, `respectCriticalWindow: true`,
  `maxWaitMs: 0` (take it or skip). Evaluations never run inside any user's L2 window and never queue.
- **Commit boundary:** on `COMMIT_SILENCE → commitTurn()` the tracker aborts any in-flight evaluation and freezes the turn's
  provisional set; §3.5 settles it.

## 3.3 QANDEEL-side attention [P]

- One evaluation per reply over the released pieces (text known before it is heard), run when the generation ends or at the
  5th piece, whichever is first; output events carry `pieceIndex`.
- An event is **sent and stored only after** the phone's `PLAYOUT` confirms the heard mark ≥ that piece's `endMs`
  (`CallReply.playout`, `heard`), with `anchorCaptureMs = reply_clock_start_ms + piece.endMs`. An interrupted reply
  (barge-in) drops the unheard pieces' events. Cost: ≤ 1 call per reply.

## 3.4 Event record and storage — migration `0204` candidate [P]

Why a table and not an existing one: `call_reply_segments` is deleted at exchange close; `conversation_live_focus_transitions`
is durable truth; the 0201 ledger is the semantic clock. Nothing existing may hold provisional, retractable rows.

`voice_private.call_attention_events` (append-only, `ACCOUNT_CASCADE`):

| Column | Meaning |
|---|---|
| `call_id` (FK → `voice_private.calls` CASCADE), `user_id` (FK → users CASCADE), `session_id` | binding; same posture as 0203's tables |
| `event_seq` (PK with `call_id`) | the producer's order; rises by 1 per call |
| `connection_epoch`, `call_turn_index` (nullable until commit), `source` (`USER | QANDEEL`) | provenance |
| `op` (`SET | WITHDRAW | CONFIRM | SUPERSEDED`), `subject_key`, `label` (≤ 40 chars), `kind`, `confidence` | content (no transcript text, no INTERIM) |
| `anchor_capture_ms` | the speech instant the event depends on (capture clock; multiple of 20) |
| `produced_at`, `xact_id xid8 DEFAULT pg_current_xact_id()` | availability: certified later by the 0203 snapshot visibility test, exactly as 0201 rows are |
| `settled_by_turn_id` (nullable) | §3.5 |

- **Access:** no grant to any role; `SECURITY DEFINER` writer `server_record_call_attention_events_v1` (batched per evaluation)
  and reader `server_read_call_attention_events_v1` (for the reconnect snapshot); a `qandeel_replay_media` read
  `server_read_replay_version_attention_v1` (§3.7). Registered in `coverage_registry`.
- **Retention / erasure:** rows live with the call: cascade from `calls` (account erasure, Personal erasure, session deletion
  by 0130). Consent revocation deletes nothing (as 0183 rules). Replay reads them only while the version is CURRENT and the
  owner's (as 0202). Option to expire with the recording (`started_at + 30 d`) is D-8.
- **Privacy:** labels are short derived phrases of the same class as Thread names; no transcript, no INTERIM, no audio;
  nothing logged. The evaluator's prompt receives the turn's FINAL text (the same text the commit stores in
  `conversation_turns.content`), no more.
- **Cost of 0204 [E]:** one migration file, one verifier (`verify-migration-0204.mjs`), re-anchors of the five "0203 is last"
  pins (`verify-0194:576`, `verify-0195:406`, `verify-0196:437`, `tests/s8b-05-live-call-contract.test.mjs:145`,
  `database/tests/live-call-clock-marks-v1.test.mjs:24`), the `voice_private` census helper, README section. Comparable to
  0203's footprint. **Not hosted** (HOSTED-DEPLOY-01).

## 3.5 Provisional → durable settlement [P]

When the turn commits and its durable analysis completes (the existing worker, unchanged), a settlement step in the tracker's
instance (kicked by `EXCHANGE_CLOSED` / the half's completion) writes **one** `CONFIRM` or `SUPERSEDED` event per open
provisional subject, by a deterministic rule: a subject whose label matches a CU / Thread / Live Focus label of that half
(normalised, same canonicaliser as Thread aliases) is `CONFIRM`ed with a reference to the durable id; any other is
`SUPERSEDED` (the durable map now shows the truth; the provisional cue fades). **No model call** in settlement. Provisional
rows are never promoted to durable truth; the durable path never reads them.

## 3.6 Delivery to the phone — least complex safe path [P]

| Option | What changes | Latency | Scale cost | Verdict |
|---|---|---|---|---|
| **A. Poll faster during a call** (phone-only) | live driver cadence 5 s → 1 s while ACTIVE + a new read | ≥ 1 s + fetch | +1 req/s per active call (1,000 calls = 1,000 req/s) | Rejected: load, latency, foreground-only |
| **B. Protocol v3 = v2 + `ATTENTION`** (additive, negotiated) | server `live-call.protocol-v3.ts` + doc + contract test (M-2 precedent: ~70 server lines, 36 phone lines); phone parser + provisional layer | ~RTT | 0 extra DB reads; events flow from the instance that produced them | **Recommended** |
| C. Separate channel (Supabase realtime / SSE) | new transport, auth, lifecycle | variable | new infra | Rejected: no precedent, more surface |

**v3 messages (server → phone):** `ATTENTION { seq, op, subjectKey, label, kind, confidence, source, anchorCaptureMs,
turnRef }` and `ATTENTION_STATE { seq, entries[] }` (sent once after `STATE ACTIVE` on every connection, fresh or resumed, from
the 0204 reader: reconnection = replace the local layer with the snapshot, then apply `seq > snapshot.seq`). Phone → server:
**nothing new** (no echo needed: the capture-clock certificate comes from the DB row, §3.7). Negotiation as v2: the phone offers
`v3, v2, v1` (Android) or `v3, v1` (iOS, D-3); the server selects the highest offered; a v1/v2 phone is never sent a v3
message. v1 and v2 files and docs stay byte-identical; `tests/s8b-05-live-call-contract.test.mjs` and
`tests/rb2-m2-live-call-protocol-v2-contract.test.mjs` are unchanged; a new `tests/intel-live-01-live-call-protocol-v3-contract.test.mjs`.

**Preserved:** First Audio priority (the push is a text frame on the existing outbound queue, bounded by
`maxOutboundBufferBytes`; dropped, never queued, when the connection is a stalled consumer); audio continuity (the tracker is
a sibling of the engine; its failure leaves the call untouched); ordering (`seq`); reconnection (snapshot + `seq`); no Thread or
relation is created from a provisional event (§3.1 #1).

## 3.7 Live map expression and Replay consumption [P]

- **Live (CP2):** the phone keeps a `ProvisionalAttentionLayer` (in memory, per call, cleared at call end) and the Personal
  owner's `build()` folds it into the existing `SceneInput` **only through existing fields**: a subject resolved to an existing
  THREAD/READING (by `CONFIRM`'s durable id, or by alias match) becomes the `focusId` emphasis **when nothing is inspected**
  (`inspectedId === null`); unresolved subjects add to `fringe` / `focusMotes`. A `WITHDRAW` removes the emphasis. The
  renderer, the camera engine and the S3-R2 art are untouched. Whether a visually distinct provisional cue is wanted is **D-5**;
  it would be a separate controlled COSMOS amendment, after the HONOR proof.
- **Replay (CP3):** a sibling read `GET /replay/:replayId/versions/:versionId/attention` (same guard, `no-store`, owner + CURRENT
  only; a declared S7-01 re-anchor: three `/replay/` routes) returns `{ replayId, versionId, revision, mapDigest, events: [{
  eventId, subjectKey, op, source, momentOrdinal, anchorPlacement: {runIndex, fileMs}, availability: RECORDED{runIndex,fileMs}
  | AFTER_END, sequence, label, kind, confidence }] }`, where `availability` comes from the **same** 0203 snapshot test applied
  to the row's `xact_id`, and `anchorPlacement` maps `anchor_capture_ms` through the version's audio plan (0195) exactly as
  0202 places moments. The phone's strict decoder (sibling of `replay-availability.ts`, exact keys) builds the
  `ReplayHistoricalEventTrack`; `ReplayCosmosWorld` builds the Lane B timeline beside Lane A and `frame.tsx` gains one field
  (`attention`) reduced by `attentionAt(t)` / `attentionOnFrame`, drawn with the same existing-field rule as live.
  **Lane B re-anchor (required):** `event-track.ts` adopts §19's policy — an event with no certified instant is placed at its
  anchor (source order, labelled non-exact), never dropped; `NOT_FOUND` / refused reads keep the lane empty; an event outside
  every selected window stays out (no leakage into earlier audio). The frozen Lane A timeline does not change.
- **Video (S5 / CP2-A, later):** consumes the same track and reducer; nothing new is analysed at export.

---

# 4. Reuse vs. add (by file)

| Reused unchanged | Added [P] | Changed (small, declared) |
|---|---|---|
| `speechmatics-realtime.adapter.ts`, `speech-recognition.adapter.ts` (ports) | `voice/call-turn/provisional-attention/{tracker,trigger-policy,attention-evaluator.provider,attention-event.types}.ts` | `live-call-turn.engine.ts`: hand each FINAL to the tracker; abort on commit; settlement kick |
| `call-endpointer.ts`, `call-reply.ts` (heard mark), `live-call-analysis.signal.ts` | `voice/call/live-call.protocol-v3.ts`; `docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v3.md`; `tests/intel-live-01-live-call-protocol-v3-contract.test.mjs` | `live-call.connection.ts`: select v3, send `ATTENTION_STATE` after ACTIVE, forward `ATTENTION` |
| `deepseek-client.ts`, `costLedgerDecorator`, `requireDeepSeekQualification` | `database/migrations/0204_intel_live_01_call_attention_events_v1.sql` + `verify-migration-0204.mjs` + README section | `background-permits.ts`: kind `PROVISIONAL_ATTENTION` (policy row via 0204) |
| `background-permits.ts` gate, `0191` permit tables | `voice/call-turn/provisional-attention/attention.repository.ts` (0204 RPCs) | five "0203 is last" pins; `route-rate-limit.census.ts` (+1 route); S7-01 (3 routes) |
| `call-analysis.worker.ts`, the whole durable chain, `0201`–`0203` | `replay-media`: `attention(userId, replayId, versionId)` on `transient-playback.service.ts` + repository read | `event-track.ts`: §19 policy re-anchor (tests re-pinned) |
| phone: `live-call-client.ts` dispatch, `live-call-session.ts`, `call-owner.ts`, the live driver, `projection-coordinator.ts` | phone: `voice-call/live-call-protocol-v3.ts`; `call/provisional-attention-layer.ts`; `original-audio/replay-attention.ts` (decoder) + source | phone: `personal.ts build()` folds the layer; `ReplayCosmosWorld.tsx` + `frame.tsx` carry Lane B; `CosmosCanvas`, `stage.ts`, camera: **untouched** |
| `fake-call-recognizer.ts` | `testing/fake-attention-evaluator.ts`; a 120 s Egyptian synthetic script fixture | `fake-call-recognizer.ts`: scripted FINAL cadence **during** audio (today it emits FINALs only on `finalize()`) |

---

# 5. Checkpoints, each with its acceptance test

| CP | Scope | Acceptance (local / synthetic unless stated) | Not in it |
|---|---|---|---|
| **CP1 — Evidence + producer core (server only)** | (0) Speechmatics FINAL-cadence proof on 90–120 s continuous Egyptian speech, **paid, capped (D-7)**; if not authorised, CP1 proceeds synthetic-only and the gap stays `NOT PROVEN`. (1) tracker + trigger policy + fake evaluator; (2) DeepSeek attention evaluator behind the shared client (synthetic data only) with one capped calibration run (D-7) to measure real tokens/latency; (3) migration 0204 + verifier; (4) settlement (§3.5). | **A1** 120 s scripted turn (3 topics + a negation) → ≥ 2 `SET` before `COMMIT_SILENCE`, 1 `WITHDRAW` after the negation, ≤ 10 evaluations, 0 per-word calls (counter), events stored with rising `seq`. **A2** DB assertion: before commit, zero new rows in CUs / Threads / LF / Memory / 0201. **A3** evaluator timeout / no permit / provider error → skipped and coalesced; audio path unaffected (engine spec). **A4** First Audio: the CP3 synthetic matrix (M0 vs M1, 7 calls) with the producer ON vs OFF — report P50/P95; the ON−OFF delta must stay within the run-to-run noise of that harness (reported, PO judges). **A5** `verify-migration-0204` on real PG, cascades proven by account erasure. | phone, protocol, Replay, any UI |
| **CP2 — Delivery + live map** | protocol v3 (server + phone + doc + contract test); `ATTENTION_STATE` on connect/resume; iOS offer (D-3); provisional layer folded into the Personal stage through existing fields (D-5). | **B1** live-call contract tests: v1 and v2 byte-identical, v3 additive. **B2** reconnect proof (CP4 harness, two instances): the snapshot replaces the layer, no duplicate, no stale entry. **B3** a v1/v2 phone never receives v3 frames. **B4** mobile tests: layer applies `seq`-ordered SET/WITHDRAW/CONFIRM; `focusId` emphasis only when nothing is inspected; cleared at call end. **B5** Android emulator run of the synthetic 120 s script with the real S8B-05 server and fake providers (no device claim). | HONOR, paid providers, Replay |
| **CP3 — Replay (Lane B producer read + display)** | 0204 Replay read (same 0203 certification), phone decoder + source, Lane B §19 re-anchor, `frame.tsx` attention field, S7-01 / S7-03 declared re-anchors, camera plan untouched. | **C1** a version with zero events: byte-identical Lane A disclosures and frames (golden). **C2** events certified (RECORDED) place at `max(availability, anchor, previous on subject)`; uncertified place at the anchor, labelled; `NOT_FOUND` → empty lane. **C3** seek back/forward, restart, RANGE: identical state at equal t (pure function). **C4** a correction: SET → WITHDRAW reproduces the live order; the earlier state is not rewritten. **C5** revocation / other version / digest mismatch → lane refused, Lane A unaffected. **C6** export facts: `attentionOnFrame` parity with the in-app state at equal frames (video not built). | video export, CP2-A |
| **CP4 — Closure** | governance closure (BG-08/09): `QAN-BL-INTEL-06` disposition, record, locators, backlog residue; the cost report with the **measured** numbers from CP1's calibration; GCR-01 carry-forwards (added DeepSeek volume, permits). | **D1** `test:task-closure-governance-contract` + the doc-reading contracts green; **D2** the cost table re-stated with [M] marks where CP1 measured. | HONOR proof (= PO sequence step 3, separately authorised) |

**Sequence after CP4:** HONOR Live + Replay proof (step 3) → CP2-A → CP2-B. S5 is not started by this task; the approved
COSMOS work is not modified.

---

# 6. Cost and performance model

All prices are **[E] read from provider pages** (S8B-01 record `:1842-1845`): Speechmatics realtime Enhanced USD 0.80 / h;
DeepSeek Flash per 1M tokens, peak: cache hit 0.006, cache miss 0.30, output 1.20 (off-peak half). Token sizes are **[E] from
S8A-01's measured FAST calls** (prompt 1,216–1,389 tokens, output 34–77; record `:192-196`) as the reference size of one
structured call. No real token count for the attention evaluator exists; CP1's calibration run measures it.

| Quantity | Value | Class |
|---|---|---|
| Evaluations per 120 s uninterrupted USER turn | ≤ 10 (trigger: ≥ 10 s new speech ∧ ≥ 20 words; cap 10) — typical 6–8 | [P] |
| Per-word / per-ASR-update calls | 0 by construction (trigger thresholds + one in flight + caps); counted and asserted in A1 | [P] |
| Tokens per evaluation (worst, cache miss) | ≈ 1,400 in / ≈ 120 out | [E] |
| USD per evaluation (peak) | ≈ 0.00042 + 0.00014 ≈ **0.00056** (with the fixed prompt cached: ≈ 0.0004) | [E] |
| USD per 120 s turn (worst) | ≈ **0.0056** (10 evaluations) | [E] |
| USD per call minute added | ≤ 5.5 USER evaluations + ≤ 4 reply evaluations (4 exchanges/min, QANDEEL 45 % of the minute — S8B-01 `:1858-1859`) ≈ 9.5 × 0.00056 ≈ **0.0053** worst; ≈ 0.003 typical | [E] |
| Against the approved per-minute model (USD 0.026–0.029) | **+18–20 % worst case**, +10 % typical | [E] |
| DeepSeek request volume | today ≈ 26.5 analysis calls per call-minute (6.62 × 4 exchanges, [M] synthetic); added ≤ 9.5 → **+36 % requests** worst case | [E] over [M] |
| 1,000 users | **No PO-approved usage profile exists** ([M] gap). On S8B-01's own assumption rows: 30 / 150 / 600 min per user-month → +USD 0.16 / 0.80 / 3.2 per user-month → **USD 160 / 800 / 3,200 per month for 1,000 users, worst-case peak**; off-peak halves it | [E] |
| 1,000 concurrent calls (GCR-01 worst-case proof target) | ≤ 158 attention req/s added to ≈ 442 req/s of existing analysis; both are GCR-01 / S8B-08 matters; provider concurrency is **not documented** | [E] |
| First Audio | no synchronous work on the voice path; evaluations skip inside any L2 window; cross-user contention goes through the same permits (B_total 16, k 2) — the only path by which this task could touch First Audio, measured in A4. Today's M1 is already +69/+131 ms NOT MET (GCR-01-A); this task must not add to it beyond harness noise | [M] baseline, [P] rule |
| Latency, speech → cue (target to **prove**, not a promise) | FINAL ≈ 0.7–1.0 s after the word ([M] at max_delay 1.0; 0.7 not measured) + trigger wait (0–10 s by design) + evaluation (S8A-01 FAST wall 1.07–1.73 s [M]) + push RTT → first cue **≈ 2–4 s after the speech that caused it**, then every ≥ 10 s | [E] |
| Slow / unavailable provisional analysis | skip + coalesce; the map waits for Lane A as today; no retry, no queue growth, no audio effect | [P] |
| Storage | ≤ ~60 rows per 120 s turn, ~150 B each → < 10 KB per turn; WAL negligible beside M-2's 103 B/s per call | [E] |

**Provider proof budget requested (D-7):** Speechmatics continuous-speech cadence, 6 sessions × ≤ 120 s ≈ 12 min ≈ USD 0.16 at
0.80/h → cap **USD 0.30**; DeepSeek evaluator calibration, 40 synthetic-script calls ≈ USD 0.02 → cap **USD 0.10**. Both
synthetic content only, EU endpoint, training off, no real person.

---

# 7. Risks (real ones)

| # | Risk | Mitigation in this contract |
|---|---|---|
| R1 | FINAL cadence during long speech is unproven at `max_delay 0.7`; `flexible` mode may hold finals on numbers/dates | CP1 step 0 measures it; the trigger has a time arm (15 s) so a held final cannot starve the cue |
| R2 | Provisional labels leak into durable truth | by construction (§3.1 #1) and asserted (A2); settlement never promotes |
| R3 | Added DeepSeek volume worsens First Audio under contention (GCR-01-A is already NOT MET) | permit kind with `maxWaitMs 0`, skip in L2 windows, caps; A4 measures ON vs OFF |
| R4 | Wrong or embarrassing provisional cue (10–25 % lower accuracy of early text per Speechmatics; model error) | FINAL only; confidence band; `WITHDRAW` path; durable settlement supersedes within seconds of the commit; D-5 keeps the cue subtle |
| R5 | A Replay shows a cue the user never saw live (event stored but the push was dropped) | the row is still true history ("produced"); Replay labels it by its certified availability, the same honesty rule as Lane A; optional: store `delivered_at` null when the push failed (D-8) |
| R6 | iOS has no capture-clock certificate | the row's DB-commit certificate needs no phone echo; placement is certified wherever M-2 marks exist (Android), source order otherwise — no blank Replay |
| R7 | Protocol surface grows | one additive version with the M-2 pattern; v1/v2 pinned byte-identical |
| R8 | 0204 re-anchors five "last migration" pins and the Replay route census | declared re-anchors, as 0203 did |
| R9 | DeepSeek `SYNTHETIC_ONLY` everywhere: no real-user value until qualification (QAN-BL-AI-01) | unchanged scope; the task is proven on synthetic scripts and the HONOR step |

---

# 8. Governance and reconciliation plan

## 8.1 Done in this CP0 (documentation only, Draft PR from `main` `aa6fc0c8`)
- `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`: a new dated status banner — **S4 + S4-CORRECTION-01 MERGED through PR
  #413 as `aa6fc0c8`** (not hosted; next migration still `0204`), INTEL-LIVE-01 CP0 delivered for review, the PO sequence.
  Older banners kept as written.
- S8B-07 record §19.9: merge status addendum (no rewrite of §18/§19).
- Backlog `QAN-BL-VIS-02`: a progress note (S4 merged; Lane B producer = INTEL-LIVE-01).
- This contract, in `E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP0/` (outside the repository, as S8B-05 / S8B-07 CP0 were); it enters the
  repository as `docs/e2e/QANDEEL_INTEL_LIVE_01_…_RECORD_v1.md` at CP1 once approved.

## 8.2 At CP1 (after approval)
- Admit `QAN-BL-INTEL-06` to the backlog on `main` with the full §2 schema, owner `INTEL-LIVE-01`, `HIGH`, status
  `DEFERRED — OWNED` (the four-status rule; it is the task's own obligation), reopen condition = the CP4 acceptance.
- Carry #410's gap record and compatibility annex into the repository as v1.1 (status headers corrected: #408/#409/#413 merged,
  Lane B seam exists), citing #410's commit `55d016b6` as their origin.
- Controlled amendment of the S8B-05 contract v1.2 §5.1 row "بدء DeepSeek — فقط بعد Turn Commit" (D-2), recorded in the S8B-05
  record as a dated amendment, not an edit.

## 8.3 PR #410 (D-9)
Recommended: **close without merge as superseded** (conflicts with `main`; stale statements), its documents re-landed by CP1 as
above. Alternative: rebase and merge #410 first, then correct at CP1 (two edits of the same text).

## 8.4 S8B-07 Replay record and Lane B
- CP3 adds §20 to the record (Lane B producer, the §19 re-anchor of `event-track.ts`, the sibling read, S7-01/S7-03 re-anchors).
- `QAN-BL-VIS-02` stays `OPEN — UNASSIGNED` (renderer fidelity is not this task).

## 8.5 Protecting S4, call speed and COSMOS
- Lane A (`timeline.ts`, `stage-timeline.ts`, `presentation-clock.ts`, availability decoding/binding) is **not edited** by
  CP1–CP4; the S7-03 pins on it stay as they are. Only `event-track.ts` (Lane B) and the frame's composition gain Lane B.
- The voice path gains one in-memory hand-off and no await; A3/A4 guard it; permits bound the provider side.
- COSMOS renderer, camera engine, gestures and S3-R2 art: not edited; the cue uses `SceneInput` fields that exist today.

---

# 9. Decisions requested from the Product Owner

| # | Decision | Recommendation |
|---|---|---|
| **D-1** | INTERIM policy: FINAL segments only to DeepSeek; INTERIM never leaves the recognizer (even if the cadence proof shows gaps) | Yes. Keeps §5.1's partials clause and the privacy posture; the time arm covers slow finals |
| **D-2** | Controlled amendment of S8B-05 v1.2 §5.1: the reply's DeepSeek call stays after the commit; the provisional attention evaluator may read FINAL text before the commit; CA-05-01 §1.6 call-volume clause extended by the caps of §3.1 | Approve as a narrow dated amendment |
| **D-3** | Protocol v3 = v2 + `ATTENTION` / `ATTENTION_STATE`; iOS offers `v3, v1` (it then also receives `CLOCK_MARK` and answers `null`) **or** iOS offers v1 only and gets no live cue | Recommend iOS offers v3 (null echoes are legal v2 behaviour; otherwise iOS has no in-speech map) |
| **D-4** | Migration `0204` `voice_private.call_attention_events` as in §3.4 (not hosted) | Approve the number and shape; verifier and re-anchors as 0203 |
| **D-5** | Live expression within existing stage fields (`focusId` when nothing is inspected; `fringe`/`focusMotes` for unresolved) — no new graphics now; a distinct provisional look, if wanted, is a later controlled COSMOS amendment after the HONOR proof | Approve the existing-fields rule for CP2 |
| **D-6** | Starting values: `MIN_NEW_SPEECH_MS 10 000`, `MIN_NEW_WORDS 20`, `MAX_SILENT_EVAL_GAP_MS 15 000`, `MAX_EVALUATIONS_PER_TURN 10`, `MAX_EVALUATIONS_PER_CALL_MINUTE 8`, evaluator timeout 4 000 ms, label ≤ 40 chars | Approve as starting values (controlled configuration, not law) |
| **D-7** | Paid proofs: Speechmatics continuous-speech cadence (cap USD 0.30) and DeepSeek evaluator calibration (cap USD 0.10), synthetic content, EU, training off | Authorise both; without the first, R1 stays `NOT PROVEN` |
| **D-8** | Retention: rows live with the call (cascade) **or** expire with the recording at `started_at + 30 d`; and whether to record `delivered_at` | Recommend: live with the call (text history outlives audio per PO decision 10); record `delivered_at` |
| **D-9** | PR #410: close as superseded, documents re-landed at CP1 as v1.1 | Close |
| **D-10** | Lane B re-anchor to the §19 policy (uncertified → source order, never dropped) in CP3 | Approve |

No theoretical question blocks CP1 beyond D-1, D-2, D-4, D-6 and D-7; D-3 and D-5 are needed before CP2; D-8 before 0204's
final text; D-9/D-10 at CP1/CP3.

---

# 10. What this CP0 did not do
No runtime code, no migration, no protocol change, no paid AI or ASR call, no device run, no hosted change, no merge, no
edit of frozen contracts or of S4's Lane A, no S5/CP2-A work, no COSMOS change. HONOR and iOS: **NOT TESTED** (step 3 of the
PO sequence).
