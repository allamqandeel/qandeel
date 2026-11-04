# QANDEEL S8B-06 — Call UI, Live Map & End-to-End Device Closure: Implementation Record v1

**Checkpoint:** S8B-06 CP3, S8B-06's closing change — **S8B-06 = ENGINEERING COMPLETE / READY FOR PO MERGE REVIEW**
(2026-11-04). On `s8b/s8b-06-cp3` as a Draft PR from `main` at `b007afca`, **not merged; merge only on the Product Owner's
explicit «ادمج»**. Not VOICE LAUNCH READY: every voice gate stays `DISABLED`.

- **Android:** the twelve device items run on the real HONOR phone against the real S8B-05 server (synthetic providers,
  a throwaway local database). Three defects were found and fixed on the way (F-A, and F-C in two steps) (§5, §6).
- **Open for the Product Owner:** F-B, the Back key ending a call (§5). Item 5 is partial on the device (§6).
- **iOS:** by the approved method, CI (§8); the real iPhone is deferred (FI 019).
- **Latency N** is measured apart from the synthetic providers (§7).
- **The Copy Gate stays OPEN:** 36 rows, all PROPOSED (§4). No paid call was made.

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

All of it is phone code above CP2's call. **No server change, no migration, no protocol change, no native change**: CP1's
engine and CP2's lifecycle are reused byte for byte, and S8B-05's server is the one the device proof talks to.

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

## 4. The Copy Gate (D-05-03) — every row PROPOSED

**Register (the Product Owner's direction, 2026-11-04):** the Arabic is simplified, neutral Modern Standard Arabic, not
colloquial. The S8B-05 drafts that were colloquial are redrafted here; this table supersedes those rows for the phone.
The English is unchanged. No row is approved by this record; previously approved copy (F-01, TM-02, C-12, the G1.1 depth
words, the Voice Notes rows) is not touched. The phone carries exactly these rows (`apps/mobile/src/voice-call/live-call-copy.ts`).

| ID | Status | Arabic | English | Moment |
|---|---|---|---|---|
| LCE-01 | PROPOSED | مكالمة صوتية | Voice call | the call control in the Conversation (accessible name) |
| LCE-02 | PROPOSED | مكالمة صوتية | Voice call | the finished-call record (J7), its word |
| LCE-03 | PROPOSED | مكالمة صوتية انتهت، مدتها {d} | Voice call ended, {d} | the record's accessible summary |
| LCE-04 | PROPOSED | كتم الميكروفون | Mute microphone | CallRail mute |
| LCE-05 | PROPOSED | تشغيل الميكروفون | Turn microphone on | CallRail unmute |
| LCE-06 | PROPOSED | إنهاء المكالمة | End call | CallRail end |
| LCE-07 | PROPOSED | السماعة الخارجية | Speaker | CallRail route toggle |
| LCE-08 | PROPOSED | المكالمة مستمرة | the call continues | accessible suffix of the depth controls during a call |
| LCE-09 | PROPOSED | جارٍ الاتصال | Connecting | the CONNECTING line |
| LCE-10 | PROPOSED | الميكروفون يعمل | Microphone on | assistive status only |
| LCE-11 | PROPOSED | الميكروفون مكتوم | Microphone muted | assistive status only |
| LCE-12 | PROPOSED | مدة المكالمة {d} | Call time {d} | the call time, accessible |
| LCE-19 | PROPOSED | انقطع الاتصال. جارٍ إعادة الاتصال. | The call dropped. Reconnecting. | the RECONNECTING line in the app |
| LCE-20 | PROPOSED | توقفت المكالمة. الكتابة متاحة. | The call isn't working. You can keep going in writing. | a failed start / an end the reader did not choose (J3) |
| LCE-21 | PROPOSED | الميكروفون غير متاح لقنديل. الكتابة متاحة. | The microphone isn't available to Qandeel. Writing is available. | the microphone stopped during the call |
| LC-01 | PROPOSED | يُحفظ صوت المكالمة ٣٠ يومًا من بدايتها. | The call's audio is kept for 30 days from its start. | the disclosure line, CONNECTING only |
| LC-02 | PROPOSED | المكالمات مشغولة الآن. حاول بعد قليل، والكتابة متاحة. | Calls are busy right now. Try again shortly; writing is available. | CAPACITY_FULL |
| LC-03 | PROPOSED | المكالمة جارية على جهاز آخر. | The call is active on another device. | OTHER_DEVICE |
| LC-04 | PROPOSED | جارٍ إعادة الاتصال… | Reconnecting… | the notification's reconnecting line |
| LC-05 | PROPOSED | انتهت المكالمة بعد ٦٠ دقيقة. يمكنك المتابعة كتابةً أو بدء مكالمة جديدة. | The call ended after 60 minutes. You can keep going in writing or start a new call. | the end at the maximum length |
| LC-06 | PROPOSED | بقيت خمس دقائق على نهاية المكالمة. | Five minutes left in this call. | T-5 in the app; the T-5 clip's spoken text |
| LC-07 | PROPOSED | بقيت دقيقة واحدة على نهاية المكالمة. | One minute left in this call. | T-1 in the app; the T-1 clip's spoken text |
| LC-08 | PROPOSED | يحتاج قنديل إلى إذن الميكروفون لإجراء المكالمة. الكتابة متاحة. | Qandeel needs microphone access for the call. Writing is available. | microphone permission refused |
| LC-09 | PROPOSED | افتح الإعدادات | Open settings | the action beside LC-08 |
| LC-10 | PROPOSED | المكالمة متوقفة مؤقتًا بسبب مكالمة أخرى. | The call is paused for another call. | HELD (app and notification) |
| LC-11 | PROPOSED | مكالمة مع QANDEEL | Call with QANDEEL | the ongoing-call notification line |
| LC-12 | PROPOSED | QANDEEL | QANDEEL | the display name and notification title |
| LC-13 | PROPOSED | تنتهي المكالمة خلال 5 دقائق | The call ends in 5 minutes | the notification at T-5 |
| LC-15 | PROPOSED | قوطِع | Interrupted | the interrupted-reply marker |
| LC-16 | PROPOSED | تحتاج المكالمة إلى موافقتك على تسجيل الصوت. | A call needs your consent to voice recording. | CONSENT_REQUIRED |
| LC-17 | PROPOSED | المكالمات غير متاحة الآن. الكتابة متاحة. | Calls aren't available right now. Writing is available. | NOT_AVAILABLE_NOW / the call gate closed |
| LC-18 | PROPOSED | لديك مكالمة جارية بالفعل. | You already have a call in progress. | ALREADY_IN_CALL |
| LC-19 | PROPOSED | تنتهي المكالمة خلال دقيقة | The call ends in 1 minute | NEW: the notification at T-1 (CP2 used LC-07) |
| LC-20 | PROPOSED | المكالمات | Calls | NEW: the Android notification channel name (CP2 used LC-11) |
| LC-21 | PROPOSED | توقفت | stopped | NEW: the record's suffix when the reader did not end the call |
| LC-22 | PROPOSED | قنديل يتحدث | QANDEEL is speaking | NEW: the assistive status while QANDEEL is audible |

**Gate status: OPEN** — awaiting the Product Owner's decision per row.

## 5. Defects found by the device proof, and findings

| # | Kind | What | Disposition |
|---|---|---|---|
| F-A | defect, **fixed** (004aa557) | VOICE-06 resume loop: during an outage the client's replay log kept every unacknowledged PLAYOUT. The resume resent them all and overflowed the server's control budget (OVERLOADED 4005), and the call looped through epochs 1 → 34 (APK 1) | the client keeps ONE PLAYOUT per reply, its newest (P1–P3: only a higher mark advances). New test fails without the fix; the CP1 resume test re-anchored to another reply's PLAYOUT, assertions unchanged. APK 2: one resume, ACTIVE 978 ms after the network returned |
| F-C | defect, **fixed in two steps** (004aa557, 6f7c0f7b) | at the server's length limit the phone said STOPPED (LCE-20) instead of LC-05: the notice relied on the phone's own count from its ACTIVE. The first fix read a STATE's `endsAt`, but the server sends its opening STATE **before** it has read `endsAt`, so the phone never got one (APK 2, still STOPPED) | the phone now takes the end from CALL_ENDING (T-5 / T-1), in its own clock (no device clock skew); a STATE's `endsAt` still counts. The new test of the real server order fails without the change; its counter-test (an end minutes early) stays STOPPED. **APK 3: LC-05 shown and back to Writing** |
| F-B | finding, **open (PO decision)** | Back at the root during a call finishes the activity (app-request), the task is removed, and the call ends as USER_ENDED (CP2's TASK_REMOVED path). A person who presses Back to leave the app ends their call | proposed: Back during a live call moves the app to the background instead (the platform-call convention). This needs a native call and an APK, so it is not done without the PO's decision. Admitted in `QAN-BL-VOICE-08` (§12) |
| F-D | environment | the server endpointer (RMS ≥ 300 counts as speech) commits turns from ordinary room sound on the speaker route, so most proof turns came from the room | a server tuning observation for the paid real-speech evidence; nothing changed. `QAN-BL-VOICE-08` |
| F-E | observation, not reproduced | the first capacity refusal after a permission grant left the reader on the Analysis with no visible notice (the refusal arrived about 4 s after the press); the next four were correct (LC-02, back to Writing) | recorded; `QAN-BL-VOICE-08` |
| F-F | observation, not reproduced | one PROTOCOL_VIOLATION close (4002) at 14:17:40.112 during the PO's run, around a barge-in just after the unlock. The phone resumed once (epoch 1 → 2) and nothing was lost. The connection's checks were traced: the PLAYOUT bounds and the barge-in onset are consistent, so the trigger is unidentified. The proof server now records the refusing check and every close code; three later calls with lock / unlock and barge-ins produced none | recorded; `QAN-BL-VOICE-08` |

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
| 5 | the Analysis / Living Map during the call | **PARTIAL on the device** — the Analysis stays open through the call and every committed call turn asks it again (the catch-up; the history is re-read after each turn). The map's CONTENT on the device is a fixture: the server-side map during a call is S8B-05 CP3's proof (real PG + Jest) | logcat.txt, server `history` lines |
| 6 | Conversation ↔ Analysis during the call | **PASS** — both ways with the call running, the CallRail in both | m06, m10 |
| 7 | reconnect during an incomplete reply (VOICE-06) | **PASS on APK 2 after F-A** — an 8 s outage: one resume (epoch 1 → 2), ACTIVE 978 ms after the network returned, the history re-read at once, the in-flight reply closed with heard 0 (nothing was confirmed through the outage) | relay.log, m07-loop.png (APK 1) |
| 8 | the end: app, server, system | **PASS** for the app's End (USER_ENDED, close 1000), the server's end (SERVER_ENDED at the limit) and the notification's Hang up (PO; USER_ENDED, the reply it cut closed CALL_ENDING with heard 9 860 ms). The person's own end leaves them where they are (J3). System Back: **F-B** | po-session-state.log |
| 9 | lock, background, a real cellular call | **PASS** (PO) — locked 14:17:26 – 31 with turns committed while locked; a real incoming call put the call ON_HOLD 14:17:51 – 59 (the server stayed ACTIVE), then ACTIVE again. Background by Back: **F-B** | po-session-state.log |
| 10 | the warnings and the maximum length | **PASS** — T-5: LC-06 on screen and LC-13 on the notification; T-1: LC-07 (APK 3, with the rail); the server's end at the limit; LC-05 on APK 3 (F-C) | m10-*.png, m10-t1-apk3.png, m10-lc05-apk3.png |
| 11 | the record and the return to Writing | **PASS** — "Voice call · {length}" (LC-21 "stopped" when not chosen), the composer and the call entry back after an unchosen end | m11-after-end.png |
| 12 | microphone denial, capacity, a second call, a failure | **PASS** — denial: LC-08 + LC-09, no call created (7 calls before and after). Capacity (0 seats): LC-02 and back to Writing, 4 / 4 after F-E. A second call: ALREADY_IN_CALL (4004), the first untouched. A failure: a start the server refused showed LCE-20 honestly | m12-*.png |

**Recording retention:** `started_at` + 30 days, verified in the database. **No raw audio, transcript or token** is in
any evidence file. The evidence lines carry ids, counts and timings; the recognizer's script is synthetic.

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

- CP3 adds **no native code**: the call owner, the views and the composition are shared TypeScript over CP2's lifecycle.
  The iOS engine and CallKit are CP2's, unchanged.
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

## 10. Acceptance (the order)

| Order item | Status |
|---|---|
| Device E2E items 1 – 12 on the real HONOR phone against the real S8B-05 server, a separate proof app | **MET**, with item 5 partial on the device (map content a fixture) and F-B open for the PO (§6) |
| iOS through CI as far as possible | **MET by the approved method** (§8); real iPhone deferred (FI 019) |
| Latency N apart from the synthetic provider latency | **MET** (§7) |
| No paid call; no original app touched; no Fake Gateway in place of the integrated server; no copy approved; CP2's tone unchanged | **MET** |
| Record, locators, backlog, memory, report, one Draft PR | this change |

## 11. Limitations (not hidden)

- **A past call's length:** a record read back from the history after a relaunch shows "Voice call" without its length,
  because the length is the phone's runtime knowledge. The same holds for LC-21 "stopped".
- **A call with no committed turn** leaves no durable record after a relaunch.
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

## 13. Decision and what the Product Owner decides

**S8B-06 = ENGINEERING COMPLETE / READY FOR PO MERGE REVIEW.** Not VOICE LAUNCH READY: every voice gate stays `DISABLED`.

The Product Owner's decisions, none taken by this record:
1. **The Copy Gate:** the 36 rows of §4 (ar + en), every one PROPOSED, including the LC-13 / LC-19 digit style (§11).
2. **P-A:** the paid TTS generation of F-01 and of the T-5 / T-1 clips (D-05-02); nothing generated.
3. **P-B:** keep CP2's local tone, or replace it with the clips once generated.
4. **D-CP3-1, the call entry:** the entry is offered whenever the platform supports a call, and a closed call gate is
   refused at the start with LC-17. Hiding the entry while the gate is closed would need a new capability read, which is
   a migration, so it is not done.
5. **D-CP3-2, VOICE-06 behaviour (1):** a turn drained by a drop stays in the thread as said and unanswered, and the
   person goes on. The alternative is that QANDEEL answers it after the resume.
6. **F-B:** Back during a call ends it today; the proposed fix is that Back moves the app to the background.
7. **The merge:** only on «ادمج».
