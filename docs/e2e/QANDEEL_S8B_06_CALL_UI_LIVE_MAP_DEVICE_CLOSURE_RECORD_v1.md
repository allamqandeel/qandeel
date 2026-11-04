# QANDEEL S8B-06 — Call UI, Live Map & End-to-End Device Closure: Implementation Record v1

**Checkpoint:** S8B-06 CP3 — IN PROGRESS (2026-11-04). On `s8b/s8b-06-cp3`, not merged; merge only on the Product
Owner's explicit «ادمج». The target of this checkpoint is `S8B-06 = ENGINEERING COMPLETE / READY FOR PO MERGE REVIEW`,
not VOICE LAUNCH READY.

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
