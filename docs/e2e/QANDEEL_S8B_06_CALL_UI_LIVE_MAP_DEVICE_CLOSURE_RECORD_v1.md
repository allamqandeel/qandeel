# QANDEEL S8B-06 — Call UI, Live Map & End-to-End Device Closure: Implementation Record v1

**Checkpoint:** S8B-06 CP3, PO Review R1 and the Product Owner's R1 decisions (2026-11-04) — **S8B-06 = NOT CLOSED: the R1
corrections and R3 (the finished-call record from durable truth, migration `0193`) are delivered; R3's check on the real
phone is outstanding (the phone was not connected), and the gates of §13 wait on the Product Owner**.
On `s8b/s8b-06-cp3` as Draft PR #381 from `main` at `b007afca`, **not merged; merge only on the Product Owner's explicit
«ادمج»**. Not VOICE LAUNCH READY: every voice gate stays `DISABLED`.

- **PO Review R1** did not accept the earlier "ENGINEERING COMPLETE" and refused deferring CP3's functions to S8B-08.
  Its corrections are in this same PR (§5, §6.1):
  - R1 Back no longer ends a call;
  - R2 the Living Map is proven from speech to the phone;
  - R4: F-F found and fixed, F-E proven, F-D settled by a test;
  - plus a stall that dropped every first call of a process (F-G), found and fixed on the way.
- **The Product Owner's R1 decisions** (2026-11-04, §13):
  - **R3, option A, delivered here:** migration `0193` (one service-role read of a Session's finished calls) and an
    additive `calls` field on the history page. The record's length and «توقفت» come from the server's `started_at`,
    `ended_at` and `end_reason`, so they survive a restart, and a call that left no turn keeps its record (§2.1, §9.3).
  - **F-H, `0070`:** a real engine defect, owned by a separate high-priority task `INTEL-04` in its own PR, never in this
    one (`QAN-BL-INTEL-04`). It blocks the live analysis's launch readiness, and R2's proof is not a proof of every Thread
    lifecycle case.
- **Android:** the twelve items run on the real HONOR phone against the real S8B-05 server (synthetic providers, a
  throwaway local database) (§6), and R1's items on APKs 5 and 6 (§6.1).
- **iOS:** by the approved method, CI (§8); the real iPhone is deferred (FI 019).
- **Latency N** is measured apart from the synthetic providers (§7).
- **The Copy Gate stays OPEN:** 36 rows, all PROPOSED (§4), with one review pack for the Product Owner. No paid call
  was made.

## 0. Authority, base, precedence

**Authority:** the Product Owner's `S8B-06 CP3 PO EXECUTION ORDER — Call UI, Live Map & End-to-End Device Closure`
(2026-11-04), status AUTHORIZED TO EXECUTE CP3.

- Binding contract: `S8B-05_S8B-06_INTEGRATED_LIVE_CALL_CONTRACT_v1.2_FINAL_FOR_PO_EXECUTION_APPROVAL.md`.
  **Precedence:** v1.2 Part A → A1 → v1.1 → v1.0; A6 06-CP3; D-05-02 / 03 / 06 / 07; v1.0 §§9–12; acceptance #14, #22,
  #23, #24, #40; QAN-BL-VOICE-01 / 06; the CP2 record §7 / §9 / §10; G1.2, P4-C3, DepthComposition, CallRail.
- **Base:** `main` at `b007afca`, the merge of PR #380 (S8B-06 CP2). **No migration.** The frozen protocol
  `qandeel.live-call.v1` is unchanged.

## 1. Anti-Duplication Gate (bounded, run before implementation)

| Piece the order needs | Existing on main | Decision |
|---|---|---|
| The call (platform call, engine, protocol session, one end latch) | CP2 `LiveCallController` / CP1 `LiveCallSession` / `LiveCallClient` | **Reused as is.** No second call model. |
| CallRail (mute, route, end) | VPORT-02 `iconography/CallRail.tsx`, mounted only in a validation root | **Mounted**, unchanged. |
| The call-safe strip and the call-safe decision | A3-01 `CallSafeStrip`, `decidePresentation`, `call?: () => CallTruth` | **Mounted and fed** with the owner's truth. |
| The server's call truth | `GET /voice/calls/truth` (S8B-05 CP1) | **Read** by a new thin client (`runtime-entry/call-truth-api.ts`); no new route. |
| The consent | the Voice Notes consent (VOICE_RECORDING_V3) and its sheet | **Reused** (`prepareCall`); no second consent. |
| Typed during a call (T1) | the server's TEXT_TURN (S8B-05 CP4) | **Used**; the phone's sender is new (it did not exist). |
| The Analysis catch-up | `requestImmediateCatchUp()` of the Foreground Live Driver | **Called** on every committed call turn and reply end; no analysis on the phone. |
| A call reply's delivery state | the history's additive `deliveryState` (S8B-05 CP2) | **Decoded** on the phone (it was ignored). |
| A call owner above the composition, the call UI, the J7 record, the Matching deferral during a call | none | **New**, in `apps/mobile/src/call/`. |

## 2. What CP3 delivers

All of it is phone code above CP2's call, **except R3** (§2.1): no other server change, no other migration, and no
protocol change. CP1's engine and CP2's lifecycle are reused, and S8B-05's server is the one the device proof talks to.

*PO Review R1* added three narrow changes beneath this layer (§5, §8):
- F-B: Android's `moveToBackground`;
- F-F: the native barge-in mark, on Android and iOS;
- F-G: the Living Map's raster painting, on the JS thread.

- **One call owner** (`apps/mobile/src/call/call-owner.ts`), in memory, built once per runtime generation above
  `DepthComposition` and retired with it, the only Product constructor of CP2's `LiveCallController`. It owns:
  - **The start's order:** the server's call truth (`GET /voice/calls/truth`, through `runtime-entry/call-truth-api.ts`);
    a call the server still holds is never started twice (`ALREADY_IN_CALL`, nothing opened). Then the microphone
    permission (LC-08 / LC-09 on refusal), then the Voice Notes consent (`VOICE_RECORDING_V3`, `prepareCall`), and only
    then the controller.
  - **The notices:** `noticeOf` maps every end and refusal to one row, and says whether the person chose it (J3). The
    length limit is told by the server's own count: CALL_ENDING, or a STATE's `endsAt` when one carries it. The phone's
    count from its ACTIVE is the fallback (§5, F-C).
  - **J7, the record:** a finished call leaves one non-interactive "Voice call · {length}" line. LC-21 "stopped" marks an
    end the person did not choose.
  - **D-05-07 T1:** a message typed during a live call rides the call (TEXT_TURN). It goes through the Conversation's ONE
    transport (`call-text-transport.ts`). Sending cuts QANDEEL's voice locally, the heard mark goes out first, and no
    BARGE_IN is sent. The message is written normally only when the call proved it did not commit it.
  - **QAN-BL-VOICE-06:** a resumed connection re-reads the history (4bbf8b04). A reply cut by the outage then closes
    with what was heard, and a drained turn shows as said and unanswered. Every reply resends ONE PLAYOUT, its newest
    (§5, F-A).
- **The call screen** (`apps/mobile/src/call/CallViews.tsx`):
  - the call line, with CONNECTING (with the LC-01 disclosure, in CONNECTING only), RECONNECTING, HELD and the call time;
  - VPORT-02's `CallRail`, unchanged, fed only by the owner's state and commands (mute, route, End);
  - the notice, and the record;
  - the assistive status rows.
- **The composition** (`DepthComposition.tsx`):
  - **G1.2, Analysis-first:** once the call is really connecting, the reader is taken to the Analysis. This happens only
    from the Conversation of My World.
  - **J3:** an end the reader did not choose returns them to the Conversation, where the notice says why.
  - **The call-safe strip** (A3-01) is mounted once, fed by the owner's truth, only while a call is live.
- **The Living Map during a call:** analysis-first. A committed call turn or a reply's end asks the Foreground Live
  Driver for an immediate catch-up (`requestImmediateCatchUp()`). The phone runs no analysis and starts no engine.
- **The thread:** the history's additive `deliveryState` (S8B-05 CP2) is decoded, so an interrupted reply carries LC-15.
- **Voice Notes:** the call asks for the microphone by the same recorder rule (`microphoneForCall`: the OS prompt only
  while the answer is undetermined) and for the same consent (`prepareCall`, VOICE_RECORDING_V3). There is no second
  consent, and the call never starts on a consent the phone cannot read.
- **The Copy Gate:** 36 rows, all PROPOSED, in simplified neutral Modern Standard Arabic by the Product Owner's direction
  (§4). Approved copy is untouched.

**Jest (the suites CP3 adds or changes):**

| Suite | Scope |
|---|---|
| `call/__tests__/call-owner.test.ts` | the owner (start order, notices, J3 / J7, T1, VOICE-06, the length limit) |
| `call/__tests__/call-views.test.tsx` | the call line, the rail, the record |
| `integration/__tests__/s8b-06-cp3-call-composition.test.tsx` | G1.2 / J3 in the composition, the strip |
| `runtime-entry/__tests__/conversation-call-history.test.ts` | `deliveryState` decoded |
| `voice-note/__tests__/voice-note-session.test.ts` | the call's microphone rule and its consent (`prepareCall`) |
| `voice-call/__tests__/live-call-client.test.ts`, `live-call-controller.test.ts` | F-A and the CP3 controller additions |

**Root contract:** `tests/s8b-06-cp3-call-ui-contract.test.mjs` (`npm run test:s8b-06-cp3-call-ui-contract`, in Mobile
CI) pins the owner, the truth, analysis-first, T1, the call screen, the copy both ways, and that no audio file or TTS call
was added.

**Re-anchored pins (each explained in place, each with its counter-test):**
- `a3-01`: the call-safe strip is now mounted, once, under the owner, and only one owner-fed ACTIVE truth exists.
- `s8b-05`: the phone's call rows are checked against this record's §4.
- `vport-02`: the CallRail has exactly one Product consumer, `CallViews.tsx`, with the owner's props only.
- `w1a-01`: the one turn route is wrapped by the call-aware transport, and obtained once.
- The glyph pin admits `call`.
- `runtime-entry/scope`: three exports are added.

### 2.1 R3 — the finished-call record from durable truth (the Product Owner's R1 decision, option A)

- **Migration `0193`** (`database/migrations/0193_s8b_06_session_finished_calls_read_v1.sql`; the number was checked
  free on `main` and every remote branch before use; forward-only, one transaction, **not applied to any hosted
  database**): `public.server_read_session_finished_calls_v1(p_user_id, p_session_id, p_ended_from, p_ended_before)`.
  - A pinned, STABLE security definer, EXECUTE to `service_role` only, like every `server_*` read.
  - It reads `voice_private.calls` and nothing else: no turn, no content, no transcript, no recording.
  - It returns only the person's calls of that Session that are `ENDED` and became `ACTIVE` (`started_at IS NOT NULL`):
    a call refused before ACTIVE was not a call, and the live call stays call truth's (0189). At most 100, the newest.
  - It changes no table, no call transition, no recording rule, no retention (V3, 30 days from the start), no Replay and
    no export; its deploy guard keeps the four voice scopes `DISABLED` and every call definer away from client roles.
- **The API** (`ConversationService.listTurns`, through `VoiceNotesRepository.sessionFinishedCalls`): the history page
  carries `calls: [{ callId, startedAt, endedAt, endReason }]`, **only when the page's window holds one**, so the page an
  older phone reads is byte-for-byte the earlier shape. The window is the page's own, `[its oldest user turn, the
  cursor)`, open at the newest end and, on the oldest page, at the old end: every finished call is on exactly one page,
  a zero-turn call included. The read uses the caller's own identity after the owner check of the Session.
- **The phone** (`decodeHistoryResponse`, the conversation controller, `useCallSurface`, a `threadHead` slot of the
  Conversation):
  - the decoder takes `calls` strictly (real instants, the end not before the start, a known end reason); a page
    without it is unchanged;
  - the controller keeps the calls of every page read, one per call;
  - the record's length is the server's `endedAt − startedAt`, and «توقفت» (LC-21) is any `endReason` but
    `USER_ENDED`;
  - a call with turns keeps its record after its last turn; a call that left none is drawn at its end's place (after
    the last exchange that began before it ended, before the first one, or alone in an empty thread);
  - the phone's own count stands only for the call it just saw end, until a read carries the server's record (the end
    already re-reads the history); the live call is never drawn as finished.
- **The device proof server** reads the same `0193` through the API's repository with the same window rule (its
  history route is the proof's stand-in for the API's, as before).

## 3. Design compliance (the order's binding points)

| Point | How CP3 meets it |
|---|---|
| G1.2 Analysis-first START | `DepthComposition` crosses to ANALYSIS when the owner moves to CONNECTING, only from the Conversation of My World |
| J3 | an unchosen end returns to the Conversation (`unchosenEnds`); the person's own End (app, notification, system UI) does not move them (§6 item 8 and item 11) |
| J7 | one record line per finished call, never interactive; LC-21 when not chosen |
| D-05-02 | **no** F-01 file, no T-5 / T-1 clip and no TTS call: they wait on the separate paid approval (P-A). CP2's local warning tone is unchanged |
| D-05-03 | every call row is the §4 gate row, PROPOSED; nothing approved on the PO's behalf |
| D-05-06 | T-5 / T-1 in the app (LC-06 / LC-07) and on the notification (LC-13 / LC-19); the end at the limit LC-05 |
| D-05-07 T1 / #40 | composer and typing do not cut the voice; the send cuts it, the mark goes first, TEXT_TURN, INTERRUPTED (P2) |
| #14 / #22 | the Analysis is shown during the call; the person moves Conversation ↔ Analysis without ending it |
| #23 | Android on the real HONOR phone against the real S8B-05 server (§6); iOS by the approved method: automated simulator tests in CI, real iPhone deferred by the PO (FI 019) (§8) |
| #24 | Voice Notes, Text and the Analysis: the Jest suites run unchanged, and the root contracts pass (§9) |
| Analysis-first, no analysis on the phone | catch-up requests only; the root contract refuses an engine in `call/` |
| Privacy | no transcript, audio, token or memory content in any log; the proof server's evidence lines carry ids, counts and timings only |

## 4. The Copy Gate (D-05-03) — every row APPROVED by the Product Owner (2026-11-04)

**Register (the Product Owner's direction, 2026-11-04):** the Arabic is simplified, neutral Modern Standard Arabic, not
colloquial. The S8B-05 drafts that were colloquial are redrafted here; this table supersedes those rows for the phone.
Previously approved copy (F-01, TM-02, C-12, the G1.1 depth words, the Voice Notes rows) is not touched. The phone carries exactly these rows (`apps/mobile/src/voice-call/live-call-copy.ts`).

| ID | Status | Arabic | English | Moment |
|---|---|---|---|---|
| LCE-01 | APPROVED | مكالمة صوتية | Voice call | the call control in the Conversation (accessible name) |
| LCE-02 | APPROVED | مكالمة صوتية | Voice call | the finished-call record (J7), its word |
| LCE-03 | APPROVED | مكالمة صوتية انتهت، مدتها {d} | Voice call ended, {d} | the record's accessible summary |
| LCE-04 | APPROVED | كتم الميكروفون | Mute microphone | CallRail mute |
| LCE-05 | APPROVED | تشغيل الميكروفون | Turn microphone on | CallRail unmute |
| LCE-06 | APPROVED | إنهاء المكالمة | End call | CallRail end |
| LCE-07 | APPROVED | السماعة الخارجية | Speaker | CallRail route toggle |
| LCE-08 | APPROVED | المكالمة مستمرة | the call continues | accessible suffix of the depth controls during a call |
| LCE-09 | APPROVED | جارٍ الاتصال | Connecting | the CONNECTING line |
| LCE-10 | APPROVED | الميكروفون يعمل | Microphone on | assistive status only |
| LCE-11 | APPROVED | الميكروفون مكتوم | Microphone muted | assistive status only |
| LCE-12 | APPROVED | مدة المكالمة {d} | Call time {d} | the call time, accessible |
| LCE-19 | APPROVED | انقطع الاتصال. جارٍ إعادة الاتصال. | The call dropped. Reconnecting. | the RECONNECTING line in the app |
| LCE-20 | APPROVED | توقفت المكالمة. يمكنك المتابعة كتابةً. | The call stopped. You can keep going in writing. | a failed start / an end the reader did not choose (J3) |
| LCE-21 | APPROVED | الميكروفون غير متاح لقنديل. الكتابة متاحة. | The microphone isn't available to Qandeel. Writing is available. | the microphone stopped during the call |
| LC-01 | APPROVED | يُحتفظ بتسجيل المكالمة لمدة ٣٠ يومًا من بدايتها. | The call recording is kept for 30 days from its start. | the disclosure line, CONNECTING only |
| LC-02 | APPROVED | خدمة المكالمات مشغولة حاليًا. حاول بعد قليل، ويمكنك المتابعة كتابةً. | Calls are busy right now. Try again shortly; writing is available. | CAPACITY_FULL |
| LC-03 | APPROVED | المكالمة جارية على جهاز آخر. | The call is active on another device. | OTHER_DEVICE |
| LC-04 | APPROVED | جارٍ إعادة الاتصال… | Reconnecting… | the notification's reconnecting line |
| LC-05 | APPROVED | انتهت المكالمة بعد ٦٠ دقيقة. يمكنك المتابعة كتابةً أو بدء مكالمة جديدة. | The call ended after 60 minutes. You can keep going in writing or start a new call. | the end at the maximum length |
| LC-06 | APPROVED | بقيت خمس دقائق على نهاية المكالمة. | Five minutes left in this call. | T-5 in the app; the T-5 clip's spoken text |
| LC-07 | APPROVED | بقيت دقيقة واحدة على نهاية المكالمة. | One minute left in this call. | T-1 in the app; the T-1 clip's spoken text |
| LC-08 | APPROVED | يحتاج قنديل إلى إذن الميكروفون لإجراء المكالمة. الكتابة متاحة. | Qandeel needs microphone access for the call. Writing is available. | microphone permission refused |
| LC-09 | APPROVED | افتح الإعدادات | Open settings | the action beside LC-08 |
| LC-10 | APPROVED | المكالمة متوقفة مؤقتًا بسبب مكالمة أخرى. | The call is paused for another call. | HELD (app and notification) |
| LC-11 | APPROVED | مكالمة مع قنديل | Call with QANDEEL | the ongoing-call notification line |
| LC-12 | APPROVED | QANDEEL | QANDEEL | the display name and notification title |
| LC-13 | APPROVED | تنتهي المكالمة خلال ٥ دقائق | The call ends in 5 minutes | the notification at T-5 |
| LC-15 | APPROVED | تمت مقاطعة الرد | Reply interrupted | the interrupted-reply marker |
| LC-16 | APPROVED | تحتاج المكالمة إلى موافقتك على تسجيل الصوت. | A call needs your consent to voice recording. | CONSENT_REQUIRED |
| LC-17 | APPROVED | المكالمات غير متاحة الآن. الكتابة متاحة. | Calls aren't available right now. Writing is available. | NOT_AVAILABLE_NOW / the call gate closed |
| LC-18 | APPROVED | لديك مكالمة جارية بالفعل. | You already have a call in progress. | ALREADY_IN_CALL |
| LC-19 | APPROVED | تنتهي المكالمة خلال دقيقة | The call ends in 1 minute | NEW: the notification at T-1 (CP2 used LC-07) |
| LC-20 | APPROVED | المكالمات | Calls | NEW: the Android notification channel name (CP2 used LC-11) |
| LC-21 | APPROVED | توقفت | stopped | NEW: the record's suffix when the reader did not end the call |
| LC-22 | APPROVED | قنديل يتحدث | QANDEEL is speaking | NEW: the assistive status while QANDEEL is audible |

**Gate status: CLOSED** — **all 36 rows APPROVED by the Product Owner** ("QANDEEL — S8B-06 CP3, PO Approval — Copy Gate &
Final Android Device Verification", 2026-11-04): a formal approval of the 36 rows of the review table
(`R3/S8B-06_CP3_COPY_GATE_REVIEW_TABLE.md`), with these decisions and corrections, applied as given:
- **D1 — digits (option C):** Arabic-Indic digits inside Arabic sentences (٣٠, ٦٠, ٥, ١); Western digits in the call time
  and the lengths (`05:30`, `12:45`); English uses Western digits. **LC-13** is corrected to «٥». **LC-19**'s Arabic
  «تنتهي المكالمة خلال دقيقة» carries no digit at all (the number is said in the word «دقيقة»), so it already meets the
  rule and is unchanged; no wording was invented for it.
- **D2 — the name:** QANDEEL is the brand in the notification title and the display name (**LC-12** QANDEEL); inside a
  natural Arabic sentence «قنديل» (**LC-11** «مكالمة مع قنديل», "Call with QANDEEL").
- **D3 — option A:** **LCE-20** «توقفت المكالمة. يمكنك المتابعة كتابةً.» / "The call stopped. You can keep going in
  writing." No line implies an unproven fault, and no end is shown as certain before the server's truth arrives.
- **D4:** two lines kept: **LCE-19** in the app, **LC-04** in the notification.
- **D5:** **LC-06** and **LC-07** approved, Arabic and English, shown and spoken. Approving the text authorizes no paid voice:
  no TTS call is made until a separate permission (P-A); CP2's local tone plays.
- **D6:** the call's natural end at the 60-minute maximum is **not** «توقفت». The record tells the three ends apart from the
  server's truth: the person's own end (`USER_ENDED`), the maximum length, and a stop (a lost connection, a failure, an
  early server end). Because `SERVER_ENDED` is not bound to one cause, the reason alone does not decide: `0193` returns
  `at_max_length`, true only for a `SERVER_ENDED` call that lasted the policy's `max_call_seconds` (within 15 s), §2.1.
- **Corrections:** **LC-02** «خدمة المكالمات مشغولة حاليًا. حاول بعد قليل، ويمكنك المتابعة كتابةً.» (English unchanged);
  **LC-15** «تمت مقاطعة الرد» / "Reply interrupted"; **LC-01** «يُحتفظ بتسجيل المكالمة لمدة ٣٠ يومًا من بدايتها.» / "The call
  recording is kept for 30 days from its start." (the wording only: the retention, 30 days from the start, and the privacy
  policy are unchanged).

No copy approved earlier outside this gate was reopened.

## 5. Defects found by the device proof, and findings

| # | Kind | What | Disposition |
|---|---|---|---|
| F-A | defect, **fixed** (004aa557) | VOICE-06 resume loop: during an outage the client's replay log kept every unacknowledged PLAYOUT. The resume resent them all and overflowed the server's control budget (OVERLOADED 4005), and the call looped through epochs 1 → 34 (APK 1) | the client keeps ONE PLAYOUT per reply, its newest (P1–P3: only a higher mark advances). New test fails without the fix; the CP1 resume test re-anchored to another reply's PLAYOUT, assertions unchanged. APK 2: one resume, ACTIVE 978 ms after the network returned |
| F-C | defect, **fixed in two steps** (004aa557, 6f7c0f7b) | at the server's length limit the phone said STOPPED (LCE-20) instead of LC-05: the notice relied on the phone's own count from its ACTIVE. The first fix read a STATE's `endsAt`, but the server sends its opening STATE **before** it has read `endsAt`, so the phone never got one (APK 2, still STOPPED) | the phone now takes the end from CALL_ENDING (T-5 / T-1), in its own clock (no device clock skew); a STATE's `endsAt` still counts. The new test of the real server order fails without the change; its counter-test (an end minutes early) stays STOPPED. **APK 3: LC-05 shown and back to Writing** |
| F-B | defect, **fixed (R1)** | Back at the root during a call finished the activity, the task was removed, and the call ended as USER_ENDED (CP2's TASK_REMOVED path) | the call owner holds the lowest-priority Back handler during a call (every stage but IDLE / PREPARING). The depth's own Back goes first (Analysis → Conversation), then the app moves to the background (Android `moveTaskToBack`, a new native `moveToBackground`) and the call continues. End and CP2's removal from Recents still end it. Five owner tests and a composition test; the device proof is §6.1 (R1) |
| F-D | harness, **settled (R1)** | the server endpointer (RMS ≥ 300 counts as speech) arms an utterance end from room sound on the speaker route, and most proof turns came from the room | the endpointer only marks an utterance end; a turn needs the recognizer's words. The proof's scripted recognizer answered every utterance end with a line, so room sound became turns. A real recognizer that hears no words commits nothing. New engine test: a loud stretch with no words makes no turn, and the next words are committed whole. Nothing in production changed, so first-word capture and barge-in are untouched. Whether room sound costs anything with the real recognizer is a paid measurement: `QAN-BL-VOICE-08` (S8B-08) |
| F-E | **proven (R1)** | once, a capacity refusal about 4 s after the press left the reader on the Analysis with no notice | two composition tests: a refusal inside the start's act, and one after the Analysis is drawn and laid out. Both return to the Conversation with LC-02, and both pass without a code change. On the phone (APK 6) with 0 seats: a refusal held 2.5 s per direction by the relay (it reached the phone about 10.8 s after the press, with the Analysis drawn and CONNECTING shown), and the first refusal straight after a fresh microphone grant. Each gave LC-02 and Writing (§6.1). The original once-seen case is consistent with F-G (a JS stall in the first draw) and was not seen again |
| F-F | defect, **found and fixed (R1)** | PROTOCOL_VIOLATION closes (4002) around barge-ins | **cause:** the native barge-in cut the newest ADMITTED reply (`ledger.currentTurn`) but sent the last heard mark. When an older reply's queued audio was still playing (the server closed it at the next commit; nothing had cut it locally), that mark belonged to the older reply. The phone sent PLAYOUT(newer reply, the older reply's chunk), past what the server had sent for that reply (run 5: turn 38, chunk 209, 154 packets sent), and the server closed 4002. **Fix:** `ReplyLedger.cutFinal` (Kotlin and Swift) returns only a mark of the reply cut, and nothing when nothing of it was heard. A failing-first Kotlin test reproduces run 5's sequence. After the fix: 37 / 37 module tests, and on the phone 7 overlap-shaped barge-ins with 0 violations (run 6; run 5 had 5 and 3) |
| F-G | defect, **found and fixed (R1)** | the first Living Map draw of a process held the JS thread for **3.3 s** (measured on the phone: the nebula's three raster passes 1 146 / 1 053 / 1 012 ms, dust and stars 57 ms). The call's uplink passes through the JS thread, so the server closed the call 4008 SILENCE after 3 s and the phone reconnected. It hit every first call of a process whose first projection arrived during ACTIVE (runs 4 – 7, deterministic). It is LA-VIS-01's code, but CP3's Analysis-first start puts that draw inside the call | each raster pass is painted in 8 bands of rows, with the JS thread released before each band, on the same surface with a non-anti-aliased clip. Every step of the drawing is per pixel (no blur), so the image is the one a single pass paints, drawn back exactly as before. The nebula draws nothing until it is painted, so the first frame shows the dust and the stars. A new test proves the banding: every row once, the same transform, a release before each band, one snapshot. The golden tree is unchanged. **APK 6 (run 8): the same fresh-database condition, with a Thread drawn: no 4008, no uplink gap ≥ 400 ms** |
| F-H | pre-existing defect, **outside CP3 (PO decision)** | R2 found that `0070`'s relation counts the CU establishing a Thread as away from it, so the next CU's lifecycle payload is refused (`THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL`) and the Session's analysis stalls. Reproduced in run 4 and again in run 8 (turn 2's USER half refused three times, PARKED) | decision memo `R1/S8B-06_CP3_R2_THREAD_LIFECYCLE_0070_DECISION.md`. Admitted `QAN-BL-INTEL-04`. **The Product Owner's decision (2026-11-04):** a real engine defect, owned by `INTEL-04 — Thread Lifecycle Derivation Correction`, a separate high-priority PR of the analysis engine and Semantic Establishment path, never inside PR #381; option A preferred once tests prove the `bound_sp` change right and harmless to the earlier cases and the order of Threads; a blocker of the live analysis's launch readiness. CP3 changes nothing in the engine |
| F-I | pre-existing defect, **outside CP3** | the written composer: after a send, the keyboard's last composing word returns at the start of the next message ("ime check one" sent, then "two" typed, gave "oneime check two"). Reproduced with no call | admitted `QAN-BL-MOB-02` (`UNASSIGNED`) |
| T1 | observation | once in the PO's own run, «تعذّر التأكد من إرسال الرسالة.» (UNCONFIRMED) for a typed message. Not reproduced in 9 tries; the PO's 4 retries all committed | it coincided with the 4008 SILENCE of F-G at 15:51:35, so the message was typed into the dropped connection. The UNCONFIRMED notice was the honest one. With F-G fixed that drop is gone |

## 6. Device evidence (HONOR ALI-NX1, Android 15, the real S8B-05 server)

**Set-up.**
- **Phone:** HONOR ALI-NX1 (`AWCX6R4603003224`), secure lock screen. The proof app is `com.qandeel.mobile.s806cp3proof`
  ("QANDEEL CP3 Proof"), a separate package; **the original `com.qandeel.mobile` was never removed, replaced or cleared.**
- **APKs:** APK 1 `3f543a6a…`, APK 2 `34717d0c…` (F-A and the first F-C step) and APK 3 `e5ca067a…` (6f7c0f7b).
  - APK 3 = commit 6f7c0f7b plus the proof files as they stood. Their exact sources and hashes are archived in
    `E:\QANDEEL_REPORTS\S8B-06\CP3\apk3-source\`.
  - The committed proof world differs only by dropping that build's request counter (CP2: nothing in `voice-call/` is
    logged).
- **Server:** `apps/api/scripts/s8b-06-cp3-device-proof-server.ts`, the real S8B-05 gateway, connection, authority, turn
  engine, reply service, truth controller and Voice Notes controller. It runs over the throwaway local PG17 database
  `proof806` (`0189` – `0192`), with synthetic providers only and F-01 not installed.
- **Path:** phone `127.0.0.1:8806` → `adb reverse` → a droppable relay → the server. **Not** CP2's Fake Gateway.
- **No paid call was made.** No hosted deploy or migration. The gates were opened only in the throwaway database.
- **Evidence** is in `E:\QANDEEL_REPORTS\S8B-06\CP3\device-proof\`:
  - the server's evidence lines (`server-events.jsonl`) and the relay log;
  - the phone log and a per-second call-state log (`po-session-state.log`, the DB state, Telecom and keyguard);
  - the screenshots, the interim `PROGRESS.md`, and latency N (§7).

**The matrix (the order's items 1 – 12).** Items marked PO were run by the Product Owner, speaking.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | start from the Conversation | **PASS** — Telecom ACTIVE, the foreground service, MODE_IN_COMMUNICATION; server ACTIVE epoch 1, the recording RECORDING with retention `started_at` + 30 d; the Analysis opened by itself (G1.2); the LC-01 disclosure only in CONNECTING | m01-*.png |
| 2 | audio received, the reply generated and played | **PASS** — committed turns, tone replies played; a reply played out has heard = produced (12 000 ms, PLAYED_OUT) | server-events.jsonl |
| 3 | barge-in: only the heard part is kept | **PASS** (PO, speaking over the tone) — interrupted replies keep the text of the segments heard: heard 9 200 / 9 860 / 10 220 ms kept the first segment (38 chars), heard 5 200 ms kept none (the text is segment-granular, each tone segment about 6 s) | DB exchanges |
| 4 | typed while QANDEEL speaks (T1, #40) | **PASS** — the TEXT turn cut the playing reply at heard 2 320 ms (NEXT_TURN, INTERRUPTED) and was answered TEXT_REPLIED (text only, no audio) | m04-*.png |
| 5 | the Analysis / Living Map during the call | **PASS after R1 (R2, §6.1)** — the full path on the phone: speech → the real S8B-05 CP3 analysis worker and Semantic Establishment (only the four layer providers synthetic) → Live Focus and the historical projection → the phone's map. *(R0 had shown only the catch-up, with fixture content.)* | §6.1 |
| 6 | Conversation ↔ Analysis during the call | **PASS** — both ways with the call running, the CallRail in both | m06, m10 |
| 7 | reconnect during an incomplete reply (VOICE-06) | **PASS on APK 2 after F-A** — an 8 s outage: one resume (epoch 1 → 2), ACTIVE 978 ms after the network returned, the history re-read at once, the in-flight reply closed with heard 0 (nothing was confirmed through the outage) | relay.log, m07-loop.png (APK 1) |
| 8 | the end: app, server, system | **PASS** for the app's End (USER_ENDED, close 1000), the server's end (SERVER_ENDED at the limit) and the notification's Hang up (PO; USER_ENDED, the reply it cut closed CALL_ENDING with heard 9 860 ms). The person's own end leaves them where they are (J3). System Back: **F-B**, fixed in R1 (§6.1) | po-session-state.log |
| 9 | lock, background, a real cellular call | **PASS** (PO) — locked 14:17:26 – 31 with turns committed while locked; a real incoming call put the call ON_HOLD 14:17:51 – 59 (the server stayed ACTIVE), then ACTIVE again. Background by Back: fixed in R1 (§6.1) | po-session-state.log |
| 10 | the warnings and the maximum length | **PASS** — T-5: LC-06 on screen and LC-13 on the notification; T-1: LC-07 (APK 3, with the rail); the server's end at the limit; LC-05 on APK 3 (F-C) | m10-*.png, m10-t1-apk3.png, m10-lc05-apk3.png |
| 11 | the record and the return to Writing | **PASS** — "Voice call · {length}" (LC-21 "stopped" when not chosen), the composer and the call entry back after an unchosen end | m11-after-end.png |
| 12 | microphone denial, capacity, a second call, a failure | **PASS** — denial: LC-08 + LC-09, no call created (7 calls before and after). Capacity (0 seats): LC-02 and back to Writing, 4 / 4 after F-E. A second call: ALREADY_IN_CALL (4004), the first untouched. A failure: a start the server refused showed LCE-20 honestly | m12-*.png |

**Recording retention:** `started_at` + 30 days, verified in the database. **No raw audio, transcript or token** is in
any evidence file. The evidence lines carry ids, counts and timings; the recognizer's script is synthetic.

### 6.1 PO Review R1 on the phone (2026-11-04, APK 5 and APK 6)

- **APKs:**
  - APK 5 `83054ea2…1902`: R1, F-F and the R2 wiring. Source in `R1/apk5-source/`.
  - The measurement build `eeaeeb65…0578`: timing logs only, never committed (`stall-proof/`).
  - APK 6 `8a4e76ea…7d17e`: F-G. Source in `stall-proof/apk6-source/`.
  - All are under `E:\QANDEEL_REPORTS\S8B-06\CP3\` and use the same separate proof package. The original
    `com.qandeel.mobile` was never removed, replaced or cleared.
- **The server** is the same proof server, now also running the real analysis path:
  - S8B-05 CP3's `CallAnalysisWorker` and Semantic Establishment;
  - the real temporal and historical-projection controllers;
  - only the four layer providers (segmentation, focus, thread, relation) are synthetic, and no model is called.
  - `PROOF_R2_THREAD=none` keeps the thread layer from establishing a Thread, which is the S8B-05 CP3 proof's own
    configuration.
  - It reports a PLAYOUT the engine judged a VIOLATION, and an uplink gap ≥ 400 ms, in numbers only.
  - Each run starts from a fresh throwaway database; the earlier ones are archived as `proof806r2_run4` … `_run7`.

| Item | Result | Evidence |
|---|---|---|
| **R1 Back** (APK 5) | **PASS** — during a live call: Back on the Analysis returns to the Conversation; Back again moves the app to the background and the call goes on (the server ACTIVE, Telecom ACTIVE, turns still committed). Reopening shows the live call; End then gives ENDED USER_ENDED and Telecom none. Swiping the proof card out of Recents still ends it (CP2). Hiding the screen was not taken as proof: the server and Telecom state were read each time | `R1/r1-*.png`, `R1/r1-session.log` |
| **R2 with a Thread** (run 4, APK 5) | **PASS, then stalled by F-H** — turn 1 established a Thread, Live Focus moved to it, and the phone drew it. Turn 2 was then refused by `0070` (F-H) and the analysis stopped | `r2-proof/`, `R1/r2-lifecycle-stall-evidence.txt` |
| **R2 without a Thread** (run 5, APK 5) | **PASS** — 72 halves established, 36 Live Focus transitions, 0 RPC errors. The live head went 1 → 80, the projection was re-read after every turn, and the phone's Analysis visibly advanced (empty → 1, 2 → 1 – 4 …) | `r2-proof/r5-map-*.png`, `r5-analysis-*.png` |
| **R2 with a Thread on APK 6** (run 8) | **PASS** — a fresh conversation. Turn 1 established a Thread; the first projection carried it during ACTIVE; the phone drew the nebula and the Thread's mass while the call went on (0:18, 0:44). F-H then refused turn 2 again | `stall-proof/run8/r8-*.png`, `run8/server-events.jsonl` |
| **F-F** (run 6, APK 5) | **PASS** — 7 barge-ins over an older reply's queued audio, 0 PLAYOUT violations, 0 closes 4002 | `ff-proof/` |
| **F-G** (runs 5 – 7, the measurement build, run 8) | **found, measured, fixed** — before: one 4008 SILENCE at the first projection in runs 5, 6 and 7 (3.07 s, 3.07 s, 3.08 s after it). Measured on the phone: 1 146 + 1 053 + 1 012 ms of nebula raster in one JS task. After (APK 6, run 8, the same condition): no close, no uplink gap ≥ 400 ms, 11 turns committed | `stall-proof/` |
| **F-E** (APK 6) | **PASS** — 0 seats. A refusal held 2.5 s each way: the Analysis drawn, CONNECTING with LC-01, then LC-02 and Writing. The first refusal after a fresh microphone grant also gave LC-02 and Writing. *(That grant was given by a tap on the proof app's own one-time prompt; the proof app's grant stays one-time, and the original app was not touched.)* A first try that held every byte 4 s was not a refusal at all: the server's 3 s wait for HELLO closed it (4008), and the phone showed LCE-20 and Writing, honestly. That is a setting no network produces | `stall-proof/run8/fe*.png` |

### 6.2 R3 on the phone — outstanding

The Product Owner asked for an app-restart test on the phone. **It has not run: the phone was not connected when R3 was
delivered.** APK 7 (R3, the separate proof package) is built and waiting (§9.3). The check, on a fresh throwaway
database with `0193`:
1. a call with turns, ended by the person; a zero-turn call; a call the server refuses (0 seats, never ACTIVE);
2. force-stop the proof app and open it again;
3. read the Conversation's tree (not a screenshot): the first call's record with the server's length, the zero-turn
   call's record at its place, and no record of the refused call.

## 7. Latency N (phone, transport and playback, apart from the synthetic providers)

All figures are measured on the phone's own capture clock, over the 75 replies of the device proof that started on a free
QANDEEL track. A reply that had to wait for the previous reply's audio is excluded: that wait is the track's order, not
latency. Script: `E:\QANDEEL_REPORTS\S8B-06\CP3\scripts\latency.mjs`; result: `device-proof/latency-n.json`.

| Segment | p50 | p90 | min | max |
|---|---:|---:|---:|---:|
| end of speech → QANDEEL heard (total) | 1 720 ms | 1 800 ms | 1 680 ms | 4 680 ms |
| — the endpointer's commit silence (policy constant) | 800 ms | | | |
| — the server, commit silence seen → first reply packet sent | 745 ms | 814 ms | 709 ms | 934 ms |
| &nbsp;&nbsp;of which the synthetic DeepSeek first release (fixture) | 442 ms | 456 ms | 429 ms | 514 ms |
| — **N: the phone's uplink, the downlink, the jitter buffer and the output** | **175 ms** | **200 ms** | 148 ms | 3 117 ms |

- The one 3.1 s outlier is a reply of the APK 1 call around the VOICE-06 outage.
- The provider figures are fixtures: the real speech latency (real ASR, DeepSeek and TTS) is the paid evidence
  `QAN-BL-VOICE-05` (S8B-08), not run.
- The transport here is USB (`adb reverse`), not a radio network.

## 8. iOS

- CP3 R0 added no native code. **R1 adds two narrow native changes:**
  - Android's `moveToBackground` (F-B). It is Android only: iOS has no Back key.
  - `ReplyLedger.cutFinal` (F-F), in Kotlin and in Swift (`CallEngineCore.swift`), with the same two rule tests in
    `ReplyLedgerTest.kt` and `CoreRulesTests.swift`.
  - The iOS engine and CallKit are otherwise CP2's, unchanged.
- The Swift tests run in CI only (`s8b-06-native-call-tests.yml`); the Kotlin tests ran locally (37 / 37).
- iOS is proven by the approved method (#23): Mobile CI's iOS lanes on the Draft PR head (the Jest suites, and CP2's
  native call tests on the simulator).
- Real-iPhone tests stay **deferred by the Product Owner** (2026-11-03, FI 019), not a merge or launch blocker.
- No iOS device evidence is claimed by this record.

## 9. Verification

- **Mobile Jest:** the call, voice-call, voice-note, runtime-entry and CP3 composition suites pass, 45 suites / 612 tests.
  The repository's known baseline failures (`w2-account-access` 3, `depth/s4-03` 4) are unchanged, and none of them is
  CP3's.
- **TypeScript** (`tsc --noEmit`, the mobile project and the API scripts project) and **ESLint** on the touched code are
  clean.
- **Root contracts:** the full suite except `forward-safety`, which hangs locally and is run by CI, was run.
  - The first run found 4 failures, all from CP3 files; they are fixed in 5b743fed (two narrow re-anchors, each checked
    against a planted violation).
  - The re-run is in §9.1.
- **CI:** the Draft PR's exact-head checks are recorded in §9.1.

### 9.1 The final re-run (2026-11-04, after this closing change's documentation)

- **Root contracts:** the 123 files except `forward-safety`, run with `node --test --test-concurrency=4`:
  **1,740 / 1,740 pass**, 0 fail (log `E:\QANDEEL_REPORTS\S8B-06\CP3\root-contracts-final.log`).
- `npm run test:task-closure-governance-contract`: **24 / 24 pass**.
- **CI on PR #381:** the exact-head checks of this closing commit are reported on the pull request itself. This record
  claims no CI result it has not seen; `forward-safety` is proven only there.

### 9.2 PO Review R1 verification (2026-11-04)

- **Kotlin** (`:qandeel-voice-call:testDebugUnitTest`, local):
  - before the F-F fix, only the new reproduction test fails (`R1/ff-kotlin-prefix.log`);
  - after it, 37 / 37 pass (`R1/ff-kotlin-fixed.log`).
- **Mobile Jest:** the call, voice-call, voice-note, integration, map and runtime-entry suites, `R1/jest-r1-final.log`:
  112 suites, 1 114 tests: 1 108 pass. The 6 failures are the known baseline (`w2-account-access` 3, `depth` 3, which look up an English label in a tree that renders Arabic), and none is from CP3. The new banding test (`map/__tests__/world-strata-bands.test.ts`) and the golden-equivalence suite pass, so the golden tree is unchanged.
- **TypeScript and ESLint:** `tsc --noEmit` is clean for the mobile project and the API scripts project, and ESLint is
  clean on the touched map files.
- **API:** the call-turn engine spec, the F-D test included: 16 / 16.
- **Root contracts:** the files except `forward-safety`, `R1/root-contracts-r1.log`: **1 740 / 1 740 pass**.
  - The first run found six failures, all from this change. The backlog edit had dropped the `## 6. Tombstones` heading, now restored.
  - F-G meets three frozen pins of the world: the T-10 §16 and VPORT-01 timer scans, and the VPORT-02 byte pin of `WorldStrata.tsx`.
  - Each is re-anchored narrowly with counter-tests, marked PROPOSED to the Product Owner (§13 item 8). A delayed timer planted in `WorldStrata.tsx` is still rejected by both scans.
  - `npm run test:task-closure-governance-contract` is in this run.
- **CI:** the exact-head checks of this commit are reported on PR #381, and this record claims none it has not seen.

### 9.3 R3 and the R1 decisions (2026-11-04; logs in `E:\QANDEEL_REPORTS\S8B-06\CP3\R3\`)

- **Migration `0193` against real PostgreSQL 17** (a throwaway local database migrated `0001` – `0192`, then `0193`):
  - `verify-migration-0193`: **9 / 9** (the catalogue; a zero-turn call and a call with turns with the server's instants
    and end reason, newest first; never a call that did not become ACTIVE, never the live call; the person's and the
    Session's isolation; the window; no client role) (`verify-0193.log`);
  - **its counter-test:** the same verifier against a weakened read (the `started_at IS NOT NULL` rule removed) fails
    T0b and T2, 7 / 9 (`verify-0193-weakened-counter-test.log`);
  - the verifiers that census or replace what 0193 sits beside, on the same `0193` database: `0150` 28 / 28, `0183`
    20 / 20, `0185` 3 / 3, `0186` 29 / 29, `0189` 24 / 24, `0190` 18 / 18, `0191` 28 / 28, `0192` 15 / 15;
  - CI runs `verify-migration-0193` after the CP4 closure proof (`api-ci.yml`), on its fresh database of every migration.
- **API:** `conversation-history-finished-calls.spec.ts` with the existing history spec, **31 / 31**; `tsc --noEmit`
  clean (the API project and the scripts project).
- **Phone:** `call/__tests__/finished-call-record.test.tsx` (the decoder strict, the controller across pages, the
  record after a restart, the server's record over the phone's count, the zero-turn call at its place and alone, the
  never-ACTIVE counter-test, the live call never finished) **15 / 15**; the CP3 composition suite with the new restart
  test over `DepthComposition` **6 / 6**; `tsc --noEmit` clean.
- **Contracts:** the S8B-05 contract's migration-tail pin is re-anchored to name exactly `0193` after `0192` (any other
  migration still fails it).
- **The whole mobile Jest suite** (`jest-r3-full-clean.log`): 267 suites, **3 346 tests: 3 340 pass**. The 6
  failures are `w2-account-access` 3 and `depth` 3.
  - **They are on `main` too, with the same cause** (the Product Owner's item 7): the same two suites on a clean
    worktree of `main` at `b007afca` fail the same 6 tests with the same messages (`R1/jest-baseline-main-b007afca.log`).
  - **The cause:** these tests expect the English copy, and the app takes its language from the device's `Intl`
    locale (`device-locale.ts`). This machine's runtime resolves `ar-EG` (`new Intl.DateTimeFormat().resolvedOptions()`),
    so the tree renders Arabic ("المحادثة" where "Conversation" is expected). On CI (`en-US`) both suites pass: on
    `ed1ced8c` the full suite was 266 suites, 3 330 / 3 330 (`R1/jest-ci-ed1ced8c-excerpt.txt`). They are not counted
    as passing here.
  - **A first full run under load is not counted:** run while the APK build compiled, it failed 64 tests in 7 suites,
    mostly 5 s timeouts and "Unable to find" while each suite took 65 – 126 s (`jest-r3-full.log`). The seven suites
    alone then failed only the same 6 (`jest-r3-seven-rerun.log`), and the clean full run above is the figure.
- **Root contracts** except `forward-safety` (CI runs it): **1 740 / 1 740** (`root-contracts-r3.log`).
- **APK 7** (R3, the separate proof package): `40260eef568a1f86fb4cd907c55fabb356b1a6ac8d6ac0455aac2a0ae5490e58`
  (`R3/s806cp3proof-apk7.apk`, `R3/build-apk7.log`); `apps/mobile/android` removed after the build.
- **CI:** the exact-head checks are on PR #381; this record claims none it has not seen. On `ed1ced8c` every Linux check
  passed; the three iOS jobs were never run (the hosted macOS runners were not acquired, the jobs cancelled with no step)
  and VAL-01's native evidence failed only because of them.

## 10. Acceptance (the order)

| Order item | Status |
|---|---|
| Device E2E items 1 – 12 on the real HONOR phone against the real S8B-05 server, a separate proof app | **MET** after R1 (§6, §6.1): item 5 through the real analysis path, F-B fixed |
| R1 Back | **MET** (§6.1) |
| R2 the Living Map from speech | **MET** (§6.1). The `0070` stall it found is reported, not passed (F-H) |
| R3 the finished-call record from durable truth | **MET in code, against real PostgreSQL and in the phone's tests** (option A, §2.1, §9.3). **The app-restart check on the real phone is outstanding** (§6.2): the phone was not connected |
| R4 F-D, F-E, F-F | **MET** (§5, §6.1) |
| R5 one Copy Gate review pack; no paid TTS; the local tone kept | **MET** — `R1/S8B-06_CP3_COPY_GATE_REVIEW_PACK_AND_AUDIO_PLAN.md`: 36 rows ar + en with IDs, none approved, and the generation plan with its exact cost (at most USD 0.023, a hard cap of USD 0.05) for a separate decision. No audio fixture is pinned as a production asset |
| R6 tests, record, backlog, PROJECT_MAP, VOICE-08 | this change; R3 and the R1 decisions in §9.3, §12, §13 |
| iOS through CI as far as possible | **MET by the approved method** (§8); real iPhone deferred (FI 019) |
| Latency N apart from the synthetic provider latency | **MET** (§7) |
| No paid call; no original app touched; no Fake Gateway in place of the integrated server; no copy approved; CP2's tone unchanged | **MET** |
| Record, locators, backlog, memory, report, one Draft PR | this change |

## 11. Limitations (not hidden)

- **R3 on the phone:** the length after a relaunch and the zero-turn record are proven in code, against real PostgreSQL
  and in the phone's tests, not yet on the phone (§6.2). Before R3, APK 6 showed "Voice call" with no length after a
  relaunch.
- **A record older than the loaded pages** appears when its page is read (scrolling up), like the turns beside it. At
  most 100 finished calls are carried per page window.
- **A server without `0193`** cannot serve the history at all once this API is deployed (the read is not optional). The
  migration goes before the API, through `HOSTED-DEPLOY-01` (`QAN-BL-PROD-06` / `08`); nothing is hosted here.
- **INTEL-04 (`0070`):** until it is fixed, a Conversation's Living Map can still freeze, and R2's map-update proof is not
  a proof of every Thread lifecycle case.
- **A Thread's mass sprite** (`world-mass.ts`, 448 px) is still recorded in one JS task when first drawn. It was not
  measured alone. By pixels it is about a tenth of one nebula pass, and run 8 drew one with no uplink gap ≥ 400 ms. Many
  new Threads in one projection are not measured.
- **The nebula on a first draw** now appears about 3 s after the dust and the stars (F-G), instead of the whole screen
  freezing for 3.3 s.
- **"0% of the view range"** shows under the Analysis after a call. It was seen and not investigated; it is not call copy.
- **OS push during a call:** only in-app attention is deferred; the platform's push is not suppressed.
- **The token check** runs on a 60 s cadence during a call.
- **Item 5** is partial on the device (§6).
- **LC-13 / LC-19 digits:** they show Western digits ("5", "1") while LC-01 / LC-05 use Arabic-Indic digits ("٣٠", "٦٠").
  This is a Copy Gate consistency question for the Product Owner.
- **The first call after APK 2's reinstall** ended FAILED in 3 s (an activation refusal, transient); the retry worked.
- **Not proven:** Bluetooth and wired routes (no accessory; CP2's finding).
- **Not real speech:** the proof used the synthetic tone. Real TTS, F-01 and the T-5 / T-1 clips wait on P-A.
- **Not a radio network:** the path was USB (§7).

## 12. Backlog (BG-08 at S8B-06's closing change)

- **Tombstoned:** `QAN-BL-VOICE-06`. All three behaviours are decided and proven on the real phone:
  - (1) a drained turn stays as said and unanswered, and the next turn goes on;
  - (2) a resumed connection re-reads the history (4bbf8b04);
  - (3) one PLAYOUT per reply is resent, and the server keeps heard ≤ recorded (F-A).

  Behaviour (1) is presented to the PO with this record (D-CP3-2, §13).
- **Admitted (BG-06):** `QAN-BL-VOICE-08`, the call's device-proof residue: F-B, F-D, F-E, F-F, a past call's length and
  the zero-turn record. Owner S8B-08, `HIGH`, `DEFERRED — OWNED`.
- **`QAN-BL-VOICE-01`:** worked by S8B-06 and **not delivered**. The native call, the call UI and the device proof
  exist; the paid evidence, Replay audio, capacity and the hosted migrations remain. Owner, severity and status are
  unchanged.
- **Read and left unchanged:** `QAN-BL-VOICE-02` … `05`, `QAN-BL-VOICE-07`, `QAN-BL-PROD-06` / `08` (`0189` – `0192` not
  hosted), `QAN-BL-MOB-01`, `QAN-BL-LAUNCH-01`.

**PO Review R1 (the same PR):**
- **`QAN-BL-VOICE-08` narrowed** to F-D, the endpointer on real speech, a paid-provider measurement. Severity `MEDIUM`.
  F-B and F-F are fixed and F-E is proven here. The finished-call record is CP3's own open work (R3, §13), not backlog.
  Nothing that is CP3's stays in it.
- **Admitted (BG-06):**
  - `QAN-BL-INTEL-04`, the `0070` Thread-lifecycle disagreement (F-H): `HIGH`, `OPEN — UNASSIGNED`, and the Product
    Owner names the owner;
  - `QAN-BL-MOB-02`, the Android composer's composing word (F-I): `MEDIUM`, `OPEN — UNASSIGNED`.
- **BG-09:** S8B-06 is not closed, and this record's banner says so.

**The Product Owner's R1 decisions (the same PR):**
- **R3** is delivered here (option A), not backlog; nothing of it is deferred.
- **`QAN-BL-INTEL-04` owned** by `INTEL-04 — Thread Lifecycle Derivation Correction` (`DEFERRED — OWNED`, `HIGH`), a
  separate PR of the analysis engine and Semantic Establishment path after this work, never inside PR #381; a blocker of
  the live analysis's launch readiness.
- **Read and left unchanged:** `QAN-BL-VOICE-01` … `05`, `07`, `08`, `QAN-BL-MOB-01` / `02`, `QAN-BL-PROD-06` / `08`
  (`0189` – `0193` not hosted).
- **Index: 99 items; 52 / 4 / 9 / 34 by status, 59 / 38 / 2 by severity.**

## 13. Decision and what the Product Owner decides

**S8B-06 = NOT CLOSED.**
- The R1 corrections and R3 are delivered on Draft PR #381.
- What remains before CP3's final review: R3's app-restart check on the real phone (§6.2), CI on the last commit, and the
  Product Owner's gates below.
- Not VOICE LAUNCH READY: every voice gate stays `DISABLED`.

**The Product Owner's R1 decisions (2026-11-04)**, recorded as given:
- **R3:** option A approved, and `0193` on PR #381 once the number was checked free (it was) — **delivered** (§2.1).
- **F-H / `0070`:** a real engine defect; `INTEL-04`, a separate high-priority PR, never in PR #381; option A preferred
  once tests prove it; a launch blocker of the live analysis (§5, §12).
- **F-G:** the banded nebula accepted **in principle**, as a performance correction and not a redesign. Its **final**
  approval waits on: the final image proven identical; LA-VIS-01's contracts unbroken; the T-10 / VPORT exceptions kept
  minimal with a counter-test (they are: one zero-delay release, set aside only when it occurs exactly once, with three
  counter-tests, and a pin moved by one blob); no audio freeze or drop on the first draw (run 8: none); and the first
  nebula appearance's delay documented and reviewed visually by the Product Owner (§11: about 3 s after the dust and the
  stars). No frozen contract is weakened or widened.
- **Copy Gate:** one review table of the 36 rows, Arabic and English with each row's ID, the decisions needing a choice
  marked (D1 – D6): `R3/S8B-06_CP3_COPY_GATE_REVIEW_TABLE.md`. **No text is approved by this record.**
- **P-A / P-B:** no paid TTS is authorized. CP2's local tone stays for now, unchanged. The F-01, T-5 and T-1 plan with its
  cost and assets is kept for a separate decision (`R1/…_AUDIO_PLAN.md` §3). No production audio file is claimed
  installed.
- **D-CP3-1: accepted for now.** The call entry shows on supporting devices, with a safe, clear refusal (LC-17) while the
  gate is closed; no gate is opened.
- **D-CP3-2: approved.** A turn cut before its reply arrived stays visible as said and unanswered; no reply is invented or
  repeated.
- **CI and final review:** the affected tests and CI on the last commit; the six Jest failures proven on `main` with the
  same cause (§9.3).

**Still the Product Owner's** (none taken by this record): the 36 Copy Gate rows and D1 – D6, P-A and P-B, F-G's final approval, and the merge, only on «ادمج». The list as it was put at PO Review R1 follows, for the trail:
1. **R3, the finished-call record (J7):** memo `R1/S8B-06_CP3_R3_CALL_HISTORY_DECISION.md`.
   - **A (recommended):** migration `0193`, a service-role read of the Session's ended calls, plus an additive `calls`
     field on the history page. The record is then drawn from the server's `started_at` / `ended_at` / `end_reason`.
   - **B:** the same read behind a separate route.
   - **C:** derive the record from the call turns; it does not meet the zero-turn case.
   - **And whether `0193` may be added on PR #381.**
2. **F-H, `0070`** (`QAN-BL-INTEL-04`): memo `R1/S8B-06_CP3_R2_THREAD_LIFECYCLE_0070_DECISION.md`, A / B / C and the owning
   task.
3. **The Copy Gate:** the 36 rows (§4; the review pack in `R1/`), every one PROPOSED, including the LC-13 / LC-19 digit
   style (§11).
4. **P-A:** the paid TTS generation of F-01 and of the T-5 / T-1 clips (D-05-02). The plan and its exact cost are in the
   pack; nothing is generated.
5. **P-B:** keep CP2's local tone (the interim), or replace it with the clips once generated.
6. **D-CP3-1, the call entry:** the entry is offered whenever the platform supports a call, and a closed call gate is
   refused at the start with LC-17.
7. **D-CP3-2, VOICE-06 behaviour (1):** a turn drained by a drop stays in the thread as said and unanswered.
8. **F-G, a change in LA-VIS-01's code** (the nebula painted in bands): the pixels are unchanged, but the nebula now appears
   about 3 s after the rest on a first draw. Noted for the Product Owner.
9. **The merge:** only on «ادمج».
