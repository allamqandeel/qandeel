# QANDEEL S8B-06 — Native Call Lifecycle (Android Core-Telecom, iOS CallKit and the iOS engine): Implementation Record v1

**Checkpoint:** S8B-06 CP2 — DELIVERED / READY FOR THE PRODUCT OWNER'S MERGE REVIEW (2026-11-04). CP2 (Native Call
Lifecycle) is on `s8b/s8b-06-cp2` as Draft PR #380, **not merged; merge only on the Product Owner's explicit «ادمج»**.

- **Android** is proven on the API 36 emulator (§5) and on the **real phone**, HONOR ALI-NX1 on Android 15 with a secure
  lock screen (§6). Every phone scenario passes:
  - start and every end path, the second-call and microphone refusals;
  - earpiece ↔ speaker during a call;
  - a real cellular call (hold, MUTE, resume);
  - #21 with the secure lock, the link drop and the grace timeout;
  - #36 heard by the Product Owner with the phone locked;
  - swipe-away.
- **Not proven:** Bluetooth and wired routes, because no accessory was available (§6). `phoneCall` alone keeps the
  microphone live in the background, so no `microphone` type was added.
- **iOS:** the engine and lifecycle are proven by automated host and simulator tests, including the app-suspension
  review (§7.5). Real-iPhone tests are **deferred by the Product Owner** (2026-11-03, FI 019) and are not a merge or launch
  blocker.

S8B-06 is **not closed**. S8B-06 CP3 is **not started and not authorized**.

## 0. Authority, base, precedence

**Authority:** the Product Owner's S8B-06 CP2 execution order (2026-11-03), and the Product Owner's iOS-validation
decision made in the same task (2026-11-03, §7). The real-phone proof (§6) and the iOS suspension review (§7.5) were run under the Product
Owner's order "Real Android Device Proof & CP2 Closure" (2026-11-04).

- **Binding contract:** `S8B-05_S8B-06_INTEGRATED_LIVE_CALL_CONTRACT_v1.2_FINAL_FOR_PO_EXECUTION_APPROVAL.md`, in the
  Product Owner's reports folder `S8B-05`.
- **Precedence:** v1.2 Part A → A1 → v1.1 → v1.0.
- **Sections:** v1.0 §9 / §11 / §12; A6 06-CP2; A1 D-05-02 / D-05-06; A1 §5; acceptance #21 and #36.
- **Also binding:** the CP1 record
  [`QANDEEL_S8B_06_NATIVE_AUDIO_ENGINE_ANDROID_AEC_RECORD_v1.md`](QANDEEL_S8B_06_NATIVE_AUDIO_ENGINE_ANDROID_AEC_RECORD_v1.md),
  including the PO-approved 69–77 ms stop exception (≤ 50 ms is Future Improvement 018). CP2 does not rebuild CP1's
  audio pipeline.

**Base:** `main` at `c9ca164b`, the merge of PR #378 (GCR-01), after #379 (S8B-05 CP4, `47f84755`) and #376 (S8B-06
CP1, `e429ca35`).

**Branch:** `s8b/s8b-06-cp2`. **No migration.**

**Constraints kept:**

- `apps/api/`, `database/` and the frozen protocol `qandeel.live-call.v1` are **unchanged**. No new event and no second
  WebSocket client: the phone's one client is CP1's `LiveCallClient`, reused through `LiveCallSession`;
- no voice gate, no hosted deploy, no paid call, no provider. DeepSeek, Gemini and Speechmatics are untouched, and no
  paid TTS was generated;
- the Copy Gate is not approved: every live-call copy row stays `PROPOSED`. No F-01 file and no audio file is added;
  the warning's sound is a local tone (§2);
- no raw audio stored or logged. The evidence holds numbers and event codes only;
- the installed `com.qandeel.mobile` was never uninstalled, replaced or cleared. The proof runs as
  `com.qandeel.mobile.s806proof`;
- no merge without «ادمج».

## 1. Anti-Duplication Gate (what was reused, not rebuilt)

| Existing | Reused as | Not added |
|---|---|---|
| CP1's Android engine (`CallAudioEngine`, `OpusCodecs`, `ReplyLedger`, `SpeechOnsetDetector`) | The same pipeline, given an `AudioOwner` (`SELF` for CP1's proofs, `TELECOM` for a call): under Telecom it never sets the mode, the focus or the route | A second engine or capture path |
| CP1's `LiveCallClient` + `LiveCallSession` (TS) | Unchanged protocol logic; the session gains the platform audio owner and a hold gap (MUTE / UNMUTE, already in v1) | A second socket, a new event, a protocol change |
| The frozen `CALL_ENDING{endsInMs}` and `STATE.endsAt` | The 60-minute warning's two sources | A new warning event |
| The S8B-05 record §9.2 copy rows (all `PROPOSED`) | The notification, the CallKit name and the warning lines, character for character | Any new or approved copy |
| CP1's fake gateway and proof root / selector | Extended (maximum-length knob, `CALL_ENDING`, link counters; controller scenarios) | A second gateway or proof app |
| CP1's codec rules and the libopus fixture | Ported 1:1 to Swift, with the same fixture | Different codec settings on iOS |
| Expo autolinking + typed config mods (`withAndroidManifest`, `withInfoPlist`) | The plugin | `withDangerousMod`, committed `android/` / `ios/` |

**Dependencies (pinned):**

| Dependency | Version | Where | Why |
|---|---|---|---|
| `androidx.core:core-telecom` | **1.0.1** (stable; 1.1.0 is only RC) | Android module | `CallsManager` / `CallControlScope`, `requestEndpointChange` |
| `io.github.jaredmdobson:concentus` | 1.0.2 (CP1, unchanged) | Android module | Opus with FEC |
| libopus | **1.5.2**, vendored C source (no DNN) | `ios/opus/` (`QandeelOpus.podspec`, `COpus`) | The real libopus on iOS. Apple's Opus codec exposes no in-band FEC setting. Downloaded from xiph.org with the Product Owner's approval and verified by sha256 (`ios/opus/VENDORED.md`) |

## 2. What CP2 delivers

| Item | Delivered | Where |
|---|---|---|
| **Android platform call** | Core-Telecom 1.0.1 `CallsManager.addCall`, OUTGOING, audio, hold supported, self-managed (not in the call log). Explicit refusal before anything opens: `API_BELOW_26`, `NO_TELECOM`, `MIC_PERMISSION_DENIED`, `ALREADY_IN_CALL`. One call per process. One `CallLifecycleMachine` merges every end source: APP, NOTIFICATION, SYSTEM, MICROPHONE, ENGINE, SERVICE, TASK_REMOVED, APP_GONE, START_FAILED. The first end wins and later callbacks are counted. | `LiveCallRegistry.kt`, `CallLifecycleMachine.kt` |
| **Foreground service + CallStyle** | The one `CallForegroundService`, type `phoneCall`, not exported, started while the app is visible. A `CallStyle.forOngoingCall` notification with a real End (Hang Up) that ends the call. Its line follows the call: ongoing / held / reconnecting / T-5 / T-1. | `CallForegroundService.kt`, `CallNotification.kt` |
| **Routes** | Only through `requestEndpointChange`; the endpoints reported as types only (no device names). | `LiveCallRegistry.kt` |
| **Hold / focus / cellular call** | Telecom's `onSetInactive` releases the microphone and speaker and sends MUTE (a MUTED gap). `onSetActive`, or the other call's end, resumes and sends UNMUTE. A microphone that cannot resume ends the call as MICROPHONE and never reports RESUMED. | `LiveCallRegistry.kt`, `CallAudioEngine.kt` |
| **iOS platform call** | CallKit, outgoing only (`CXStartCallAction`), `includesCallsInRecents = false`, no PushKit, no incoming call. Audio starts only after `didActivate`; `didDeactivate` and interruptions are holds; CallKit's mute is the person's mute. The simulator uses an audio-session-only backend, since CallKit has no simulator audio. | `CallCoordinator.swift`, `CallKitBackend.swift`, `CallLifecycleMachine.swift` |
| **iOS engine (complete)** | `AVAudioEngine` with voice processing (`setVoiceProcessingEnabled`), `playAndRecord` / `voiceChat`, Bluetooth HFP. Capture → 16 kHz frames → Opus uplink (libopus: 20 ms mono, 24 kbps, in-band FEC, DTX off) **before** the detector judges the frame. Downlink libopus at 24 kHz. CP1's onset detector (200 ms, adaptive floor, echo guard), reply ledger and barge-in with an 8 ms fade. PLAYOUT and HEARD come only from the **presented** frame: host time + output latency + I/O buffer. | `ios/Core/*` |
| **Shared JS controller** | `LiveCallController`: one call; the platform first, then the socket, then the engine inside the ACTIVE call. One end latch for every source, with the server's verdict final (`serverConfirmed`). Held, LOST/reconnecting and ended are three different states. | `live-call-controller.ts` |
| **Timers that survive the background** | Found on the emulator: Android pauses JS timers in the background, which stalled the heartbeat and the reconnect backoff. Both engines now emit a 250 ms native `tick`, and `NativePacedTimers` fires every call timer from native events. Each fires once per due time and never bursts. | `native-paced-timers.ts`, `CallAudioEngine.kt`, `CallEngineCore.swift` |
| **60-minute warning** | Two sources: `CALL_ENDING` queues at once; every STATE's `endsAt` schedules on the **engine's** clock (works while locked). A fixed id per warning makes it play once, and T-1 supersedes a waiting T-5. It plays at the first silence (QANDEEL not audible, the person silent), and is forced at the latest 30 s (T-5) / 15 s (T-1) after it falls due, never over QANDEEL. It counts as heard **only** from the presented position. The sound is a local tone in the call's own track: no TTS, no file. The notification line updates. | `call-ending-warning.ts`, `CuePlayer.kt` / `.swift`, `CueSchedule.kt` |
| **Config plugin** | Typed mods only. Android: FOREGROUND_SERVICE, FOREGROUND_SERVICE_PHONE_CALL, MANAGE_OWN_CALLS and the one service. iOS: `UIBackgroundModes` = `audio` only (no `voip`). | `plugins/with-qandeel-voice-call.js`, `app.json` |
| **Guards** | `verify-voice-note-native.mjs` re-anchored: the one call service of type `phoneCall`, `audio` alone, and Voice Notes still stop in the background and never reach the call engine (16 planted faults, all caught). `mobile-foundation-toolchain-contract` and the plugin-list contracts re-anchored. A new CP2 contract. A native-call workflow. | `scripts/`, `tests/`, `.github/workflows/` |

**Merged permissions (Core-Telecom's own manifest, merged by Gradle, not by the plugin):** `BLUETOOTH_CONNECT`,
`MANAGE_OWN_CALLS` and `MODIFY_AUDIO_SETTINGS`. Also its `JetpackConnectionService`, which is exported but bindable only
with `BIND_TELECOM_CONNECTION_SERVICE`. QANDEEL never asks the person for `BLUETOOTH_CONNECT`; Bluetooth routing is
Telecom's. Verified in the proof APK's merged manifest.

**Not delivered, as authorized (CP3 or later):** CallRail, the call UI over DepthComposition, Analysis-first, the
Live Map, `call-truth` / CallSafeStrip, Replay, F-01 spoken clips, the Copy Gate, S8B-07, GCR-01, the SHARED permit or
deferral, First Audio, Live Focus, QAN-BL-VOICE-07, Stage 9, paid tests.

## 3. Defects found and fixed during CP2

| # | Defect | Where found | Fix |
|---|---|---|---|
| D1 | JS timers paused in the background, so a held or locked call would lose its heartbeat (the server closes after 3 s of silence) and could not reconnect | Design review against RN Android behaviour; then proven on the emulator (§5, C4 / C6) | A native 250 ms tick plus `NativePacedTimers` (both platforms) |
| D2 | `ENDPOINT_REQUEST`: the route type overwrote the event's `type` key | Review, both platforms | `endpoint: {type}` |
| D3 | `RESUMED` was reported after a microphone that failed to resume | Review, both platforms | The call ends as MICROPHONE; no RESUMED |
| D4 | The warning phase went PLAYING → QUEUED when the engine's two threads reported out of order | Emulator, C4; the same order seen on the real phone (§6 D4-H), where the fix held | A QUEUED or DUE after STARTED is ignored; only REQUEUED (a hold) goes back. Test added |

## 4. Host proofs

| Proof | Result |
|---|---|
| Mobile Jest `src/voice-call` (protocol, client, session, controller, warning, paced timers), including the 4 app-suspension tests of §7.5 | **75 / 75 pass** (local) |
| Native JUnit `:qandeel-voice-call:testDebugUnitTest` (CP1's 18, plus lifecycle machine 6, cue player 6, cue schedule 5) | **35 / 35 pass** (local Gradle 9.3.1) |
| `tests/s8b-06-native-call-lifecycle-contract.test.mjs` (8) and CP1's `tests/s8b-06-native-audio-engine-contract.test.mjs` (14) | **22 / 22 pass** (local) |
| `prebuild:verify` (idempotency), `prebuild:verify-voice-note` (16 plants caught), launch identity, introduction photo | pass (local, Android) |
| `tsc --noEmit`, ESLint | clean |
| `tests/s8b-05-live-call-contract.test.mjs` test 7, **re-anchored** (CI R2; it was CP1's "no call copy on the phone"): the call copy may live in one file only, `live-call-copy.ts`. Every row there must equal the S8B-05 record's row character for character and still be `PROPOSED`, and every other mobile file still carries no call id and no call text. A planted one-character change is caught | **16 / 16 pass** (local) |
| Swift (`swift test`, macOS host) and `xcodebuild test` (iOS simulator), the Kotlin JUnit job, API CI and Mobile CI (with the Release simulator build) | **green** in CI on `b3c4399c` (§8) |

## 5. Android emulator proof (API 36)

**Device:** AVD `QANDEEL_API36`, `sdk_gphone64_x86_64`, Android 16 (API 36), Google APIs.

**Build:** the proof APK `a70cde599443065ce27d6aceabbfb8d557930046556c28fd64cca385c9622688` (arm64-v8a + x86_64),
built with CP1's recipe:

- `S806_DEVICE_PROOF=1 node scripts/select-s806-proof-entry.mjs --apply`;
- in the generated project only: `applicationId "com.qandeel.mobile.s806proof"`, cleartext loopback;
- `assembleRelease`.

The selector was restored. The APK is kept with the evidence outside the repository.

**Evidence:** `QANDEEL_REPORTS/S8B-06/CP2/emulator-proof/` holds the reports 001–014 and the host logs
`c4`/`c5`/`c5b`/`c5c`/`c6`/`c6b`. It contains numbers and event codes only.

**Method:**

- The production `LiveCallController` runs with the real Core-Telecom platform and the real engine against the fake
  gateway, reached over `adb reverse`.
- The host drives each scenario: the screen, a cellular call, the gateway's knobs, and stopping the gateway.
- Platform state is read from `dumpsys telecom`, `dumpsys activity services`, `dumpsys notification --noredact` and
  `dumpsys power`.
- "Locked" here means the screen asleep (`mWakefulness=Asleep`) with the app in the background. The AVD has no secure
  keyguard.

| # | Scenario | Result |
|---|---|---|
| C1 | Start, then the person's End | **PASS.** Telecom ACTIVE, self-managed, hold-capable. Service `phoneCall` in the foreground; CallStyle `category=call` with one action. End: `PERSON / USER_ENDED`, server-confirmed 20 ms after END. Afterwards: Telecom 0, service 0, audio mode NORMAL. Capture clock unbroken, 0 violations |
| C2 | End from the notification's **Hang Up** | **PASS.** `PLATFORM / NOTIFICATION / USER_ENDED`, server-confirmed; Telecom, service and notification cleaned up |
| C3 | The server ends the call | **PASS.** `SERVER / SERVER_ENDED`; Telecom 0, service 0, notification 0 |
| C2nd | A second call while one is open | **PASS.** Refused `ALREADY_IN_CALL`: no session, no new gateway call, the first call still ACTIVE |
| CP0 | A start without microphone permission | **PASS.** Refused `MIC_PERMISSION_DENIED` before any socket or Telecom call |
| C4 | **#36 + background / lock + a link drop while locked**: a 6-minute call, put in the background with the screen off at 11 s | **PASS** (emulator). See the C4 detail below. 18,023 uplink packets with 0 capture or seq breaks, and 0 silence closes (355 heartbeats). T-5 and T-1 each played once (`CALL_ENDING` and the local schedule de-duplicated) |
| C5b | An incoming cellular call, answered through Telecom | **PASS.** See the C5b detail below |
| C5c | An outgoing cellular call during the call, then QANDEEL's End while held | **PASS.** ON_HOLD, MUTE, uplink stopped, held line. The End while held: `USER_ENDED`, service 0; only the cellular call stays in Telecom |
| C6 | **The server unreachable past the 30 s grace**, screen asleep | **PASS.** See the C6 detail below |
| C7 | Routes | **PARTIAL.** SPEAKER via `requestEndpointChange` returns `ENDPOINT_REQUEST SPEAKER SUCCESS`. The AVD exposes only SPEAKER, so EARPIECE and BLUETOOTH are refused locally. EARPIECE / Bluetooth / wired: **NOT PROVEN** (the phone, §6) |

**C4 detail (screen off throughout):**

- the link dropped at 27 s and came back in 0.28 s on epoch 2. The audio was resent (`audioResent` 14) and the
  notification went "Reconnecting…" → ongoing;
- at T-5 (61.1 s): `CALL_ENDING 300000` arrived, the notification read **"The call ends in 5 minutes"**, and the cue
  went STARTED → **HEARD at +589 ms, from the presented `TIMESTAMP`**;
- at T-1 (301.1 s): the notification read **"One minute left in this call."**, and the cue was **HEARD at +792 ms**
  (`TIMESTAMP`);
- at 360 s: the server's end (`SERVER_ENDED`) left Telecom 0, the service 0 and the notification gone, all while
  locked.

**C5b detail (incoming cellular call):**

- while it rang, QANDEEL's call stayed ACTIVE;
- once it was answered, QANDEEL's call went **ON_HOLD**: the uplink stopped, MUTE was sent and the notification read
  **"The call is paused for another call."**. Heartbeats kept the link up (0 silence closes);
- when the cellular call ended, the call resumed: UNMUTE, a MUTED gap of 15.28–29.58 s accepted, and the ongoing line
  back.

**C6 detail (server unreachable):**

- the notification read **"Reconnecting…"** throughout the grace, and 9 backoff attempts ran with the screen asleep;
- the call ended **32.3 s after the loss** as `SERVER / LOST` with **`serverConfirmed: false`**. It was never reported
  as completed;
- Telecom and the service were cleaned up while locked.

**Emulator observation (not a defect).** The emulator console's `gsm accept` for an incoming call makes the modem call
active without Telecom's answer flow. Telecom then lists both calls ACTIVE and never holds QANDEEL's (host log `c5`).
A real answer, which on a phone always goes through Telecom, holds it (C5b). The engine's own guard, the audio mode
leaving IN_CALL, resumes but does not detect a call Telecom never reported. On the real phone, a real cellular call answered on the
HONOR held QANDEEL's call correctly (§6 D5).

## 6. Real Android phone (HONOR ALI-NX1, Android 15 / API 35)

**Device:**
- HONOR ALI-NX1, serial `AWCX6R4603003224`, build `ALI-N21 9.0.0.226`, Android 15 (API 35);
- a **secure lock screen** (`KeyguardServiceDelegate secure=true`); locked means `deviceLocked=1` in `dumpsys trust`;
- engine report: Qualcomm Fluence AEC attached and enabled, NS available, capture `VOICE_COMMUNICATION` at 16 kHz;
- Telecom exposed `SPEAKER | EARPIECE`. No Bluetooth or wired headset was available (the Product Owner confirmed none).

**Build:** the same proof APK as §5, `a70cde59…` (`adb install -r`). It is the separate package
`com.qandeel.mobile.s806proof`. The installed `com.qandeel.mobile` (versionName 0.1.0, last updated 2026-09-11) was
**not touched**: not uninstalled, replaced, cleared or launched.

**Run:** 2026-11-04, 07:51–08:28 local time. The fake gateway ran on the laptop, reached over `adb reverse tcp:8806`.

**Evidence:** `QANDEEL_REPORTS/S8B-06/CP2/device-proof/`, numbers and event codes only:
- the device reports 001–011 (006 is a short probe call for the liveness read-out);
- the host logs `c4p`, `c4h`, `c5p` and `c6p`;
- the gateway's events;
- two screenshots: the notification shade (the CallStyle notification) and the Recents card before the swipe;
- the host scripts, in `QANDEEL_REPORTS/S8B-06/CP2/scripts/` (`c4p`, `c4h`, `c5p`, `c6p`, `mic`, `st`).

**Microphone liveness.** Android can feed a background microphone silence instead of refusing it. Packet counts
therefore prove nothing on their own, so at every step the host also read:
- the AudioRecord's `silenced` flag (`dumpsys audio`);
- the recording events that say "silenced";
- the appops `RECORD_AUDIO` rejects;
- the uid's process state;
- the uplink's decoded level percentiles. A real microphone shows room noise; a silenced one decodes to digital zero.

| # | Scenario | Result |
|---|---|---|
| D1 | Start, then the person's End | **PASS.** Telecom ACTIVE (self-managed), service `phoneCall` (`types=0x4`), audio mode `MODE_IN_COMMUNICATION` on the earpiece. End: `PERSON / USER_ENDED`, server-confirmed. Afterwards Telecom 0, service 0, notification 0, `MODE_NORMAL`. 1,089 packets, 0 capture or seq breaks, 0 violations (report 001) |
| D2 | End from the notification's **Hang up** | **PASS.** `PLATFORM / NOTIFICATION / USER_ENDED`, server-confirmed; everything cleaned up (report 002). The CallStyle notification (`category=call`, one "Hang up" action, ongoing call timer) **was shown although `POST_NOTIFICATIONS` was never granted**. The proof app never requests it, and Android exempts a self-managed call's CallStyle |
| D3 | The server ends the call | **PASS.** `SERVER / SERVER_ENDED`, server-confirmed; Telecom 0, service 0, notification 0, `MODE_NORMAL` (report 004) |
| D2nd | A second call while one is open | **PASS.** `ALREADY_IN_CALL`: no session, no new gateway call, the first call still ACTIVE (report 003) |
| D0 | A start without microphone permission | **PASS.** Permission revoked on the proof package only (`pm revoke`, granted again afterwards). `MIC_PERMISSION_DENIED`: no session, no gateway call, no Telecom call, no service (report 005) |
| D7 | Routes, switched during one call | **PASS for SPEAKER and EARPIECE.** The sequence was SPEAKER, EARPIECE, BLUETOOTH, SPEAKER (report 004 trace). Each request through `requestEndpointChange` → `ENDPOINT_REQUEST … SUCCESS`, and Android's active communication device followed (`speaker` / `earpiece`). Capture went on across every switch: 0 capture breaks, 0 seq breaks. BLUETOOTH was refused locally (`requested=false`: no such endpoint). **Bluetooth and wired: NOT PROVEN** (no accessory available) |
| D4 | **#21 + #36 with the secure lock screen**: a 6-minute call on the speaker, locked at 17 s, a link drop while locked, a 6 s reply while locked | **PASS** (report 007, host log `c4p`). See the D4 detail. Someone unlocked the phone at about 3 minutes, so T-1 in D4 ran unlocked; D4-H re-ran both warnings locked |
| D4-H | **#36 heard by the Product Owner**: a 320 s call on the speaker, secure lock for the whole call | **PASS** (report 008, host log `c4h`). See the D4-H detail |
| D5 | **A real incoming cellular call** (placed by the Product Owner from another phone, answered on the HONOR) | **PASS** (report 009, host log `c5p`). See the D5 detail |
| D6 | **The server unreachable past the 30 s grace**, secure lock | **PASS** (report 010, host log `c6p`). See the D6 detail |
| D8 | **Swipe away** (the proof app's card removed from Recents) during a call | **PASS** (report 011). `PLATFORM / TASK_REMOVED / USER_ENDED`, **server-confirmed 42 ms after** the platform's end. Telecom 0, service 0, notification 0, `MODE_NORMAL`. The process stayed alive long enough to send END and report. Only the proof app's card was removed |

**D4 detail (secure lock from 17 s):**
- the call stayed ACTIVE locked: Telecom ACTIVE, service in the foreground, uid state `fgsvc`;
- the microphone was never silenced: `silenced:false`, 0 appops rejects, 0 silenced events. Locked uplink levels showed room
  noise (p10 ≈ −82 dB, p90 ≈ −47 to −38 dB), with **no digital-zero frame** in any 10 s window;
- the link dropped at 31.4 s and came back in **0.3 s on epoch 2** (`audioResent` 16). The notification went
  "Reconnecting…" → ongoing;
- the 6 s reply played to the end while locked: the gateway closed it `COMPLETE` with `playedMs` 6000, 29 PLAYOUTs;
- at T-5: `CALL_ENDING 300000`, the notification read **"The call ends in 5 minutes"**, and the cue was **HEARD from
  `TIMESTAMP`** (started at +63.9 s after waiting for a silence; HEARD at +64.5 s);
- at T-1: `CALL_ENDING 60000`, the notification read **"One minute left in this call."**, and the cue was HEARD from
  `TIMESTAMP` (+302.3 s);
- the server's end at 360 s: `SERVER_ENDED`, server-confirmed; Telecom 0, service 0, notification 0;
- totals: 18,001 packets over 360 s, 0 capture or seq breaks, 0 silence closes (358 heartbeats), 0 violations. Each
  warning played once.

**D4-H detail (the Product Owner listening, locked throughout):**
- T-5 at 20.7 s: the notification read "The call ends in 5 minutes", and the cue was HEARD from `TIMESTAMP` at +21.3 s;
- T-1 at 260.7 s: the notification read "One minute left in this call.", and the cue was HEARD from `TIMESTAMP` at
  +261.9 s;
- **The Product Owner confirmed hearing both warnings on the HONOR's speaker** (2026-11-04);
- the trace shows a T-5 QUEUED reaching JS after its STARTED, the D4 defect's order, on the real phone. The phase
  still ended HEARD, so D4's fix is confirmed on the device;
- the server's end at 320 s cleaned everything up, still locked. Totals: 16,001 packets, 0 breaks, 0 silence closes,
  each warning once.

**D5 detail (a real cellular call):**
- while it rang (`RINGING`, `com.android.phone`), QANDEEL's call stayed ACTIVE and kept sending;
- once it was answered, Telecom put QANDEEL's call **ON_HOLD** (the cellular call ACTIVE, audio mode
  `MODE_IN_CALL`):
  - the engine reported `hold: TELECOM_INACTIVE`;
  - MUTE was sent and the uplink stopped;
  - the notification read **"The call is paused for another call."**;
  - heartbeats kept the link up (0 silence closes over about 22 s);
- when the cellular call ended:
  - `RESUMED`, UNMUTE, the ongoing line back;
  - the uplink resumed on the continuing capture clock: one declared MUTED gap, 139.44 → 161.62 s. The gateway counts
    that gap as its one capture break, as in §5 C5b; 0 violations;
- the End afterwards: `USER_ENDED`, server-confirmed; everything cleaned up and back to `MODE_NORMAL`;
- the HONOR placed no call.

**D6 detail (server unreachable, secure lock):**
- the gateway was stopped 23 s into the call, with the phone locked;
- the notification read **"Reconnecting…"** throughout the grace. 9 backoff attempts ran locked;
- the call ended **32.35 s after the loss** as `SERVER / LOST`, **`serverConfirmed: false`**. It was never reported as
  completed;
- Telecom and the service were cleaned up while still locked (`deviceLocked=1`).

**The foreground service type (G1.2).** **`phoneCall` alone is sufficient on this phone**, so `microphone` is not
added:
- the service ran with `types=0x00000004`;
- capture stayed live in the background and under the secure lock: uid `fgsvc`, `silenced:false`, real levels, 0
  rejects;
- that held through the drop, the reply, T-5 and T-1.

**Not proven on the phone:**
- Bluetooth and wired routes (no accessory);
- the warning heard on the earpiece. The Product Owner listened on the speaker, the route under test. The earpiece uses
  the same playback path, and the route switch is proven by D7;
- the person's own speech during a warning. That the cue never starts over QANDEEL or over the person's speech rests on
  the unit and simulation tests (§4, §7.2); on the phone, T-5 waited 3.35 s for a silence in D4.

## 7. iOS — the Product Owner's decision and what is proven

**Product Owner decision (2026-11-03):**

- Real-iPhone acoustic tests are **deferred until a real iPhone exists**. They are not a merge blocker and not a launch
  blocker. Nothing is to be bought, rented or used from a cloud lab. The deferred tests: AEC on the speaker,
  double-talk, barge-in in a real room, noise false cuts, routes, and interruption / lock recovery.
- The exception does **not** cover an incomplete engine, known functional faults, failing builds or tests, privacy or
  call-integrity breaches, or moving CP2 work to CP3.
- Recorded as **Future Improvement 019**, «iOS — Real-Device Acoustic Echo Cancellation & Live Audio Validation», in the
  local `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`.

**7.1 Proven by automated tests (host `swift test` and the iOS simulator `xcodebuild test`):**

- libopus settings read back from the encoder: 20 ms mono, LBRR FEC present in ≥ 120 / 149 SILK packets, DTX off;
- CP1's 64 real libopus downlink packets (hybrid + SILK) decoded within ± 3 dB, and the 24 kHz round trip;
- CP1's rules ported 1:1: the ledger, the detector and its defaults, the cue player and schedule, and the lifecycle
  machine;
- the coordinator through injected CallKit / AVAudioSession events. Covered:
  - start at `didActivate` only; microphone denied;
  - one call; CallKit's refusal; the start timeout; an end during the start;
  - the person's end; CallKit's SYSTEM end; a media-services reset; an engine stop; APP_GONE;
  - late callbacks; another call's events ignored;
  - hold / resume; deactivation as a hold; a microphone resume failure (no RESUMED); an end while held;
  - `SYSTEM_MUTE`; routes as types only; the event keys shared with Kotlin;
- in the simulator: the `voiceChat` session configuration; the simulator call path from start to end; microphone denial
  → `PERMISSION_DENIED`.

**7.2 Proven by simulation only (synthetic signals through the real `CallEngineCore`; NOT evidence of physical AEC):**

- QANDEEL's echo (residual 0.1, 30 ms latency) never cuts;
- steady −45 dB noise and a short burst do not cut;
- silence sends every frame;
- the first words are sent from the onset's first frame;
- a double-talk cut at detect − onset = 180 ms, late packets refused `LATE_AFTER_CUT`, the next reply after a barge-in
  plays, and report-only and mute behave;
- hold / resume: the clock keeps running, ticks continue while held, and nothing plays after the hold;
- the warning cue: due on the engine clock, waits for the gap, plays once, T-5 superseded by T-1, requeued on a hold,
  dropped at the end, and HEARD only after the presented position passes it.

**7.3 NOT DEVICE-VERIFIED (deferred by the Product Owner):**

- physical AEC, double-talk and barge-in in a room, real stop latency, noise false cuts;
- the real output latency used by PLAYOUT;
- Bluetooth / receiver / speaker routing;
- a real cellular-call interruption;
- background suspension during a CallKit hold, and lock recovery. The JS side of a suspension is reviewed and tested in
  §7.5; the device behaviour stays NOT DEVICE-VERIFIED;
- the CallKit system UI.

Also a CallKit availability risk: CallKit's VoIP use is restricted in mainland China. The app refuses
`CALLKIT_UNAVAILABLE` rather than faking a call.

**Known iOS limits recorded, not hidden:**

- the app's mute is not pushed to CallKit's mute button (CallKit's mute → the app is synced);
- after the engine stops in the background, the server-verdict wait may complete only on foreground. The latch is
  already closed and the microphone already stopped, so this is cosmetic.

### 7.4 CP1's Android lessons carried to iOS, and their regression tests

| Android lesson (CP1 / CP2) | iOS design | iOS regression test (Swift) | Evidence class |
|---|---|---|---|
| Platform AEC works only with the voice-communication path; a positive control is needed | `voiceChat` + `setVoiceProcessingEnabled`; the detector reads the processed frame | `CallEngineCoreSimulationTests` echo never cuts; `IOSSimulatorIntegrationTests` session config | Simulation; physical AEC deferred |
| Noise false cuts (Q-01) | CP1's adaptive floor, absolute floor and echo guard ported | Steady noise; short burst; detector defaults | Simulation |
| The user's first words kept (uplink before the detector) | The uplink is encoded before the detector judges the frame | First words from frame 0; contract pin `uplink-before-detector` | Automated |
| Stop speed is the output queue (69–77 ms on Android) | A render ring ≈ 40 ms ahead with an 8 ms fade by cut generation | Double-talk cut timing; cutGeneration | Simulation; real latency deferred |
| Concentus decodes HYBRID packets to silence below 48 kHz | The real libopus on iOS | The hybrid fixture within ± 3 dB | Automated |
| PLAYOUT only from presented frames | Presented = host time + output latency + I/O buffer | HEARD only after presentation; no playouts after a hold | Automated (simulated clock) |
| The engine must not own the session under the platform call | CallKit owns activation; `ownsSession = false`; audio only after `didActivate` | Coordinator start-at-didActivate | Automated (injected events) |
| Routes only through the platform | The session override / preferred input; types only | Routes as types only | Automated |
| Interruptions are holds, never ends | `didDeactivate` / interruption → hold; a resume failure → MICROPHONE end | Deactivation as hold; mic-resume failure | Automated |
| JS timers pause in the background (D1) | The core's 250 ms tick while running or held | Ticks ≥ 11 while held | Automated |
| Microphone denial / start failure is explicit | `PERMISSION_DENIED`; CallKit start errors | Mic denial (host + simulator) | Automated |
| Cleanup / restore (H1) | Idempotent stop; deactivate only an owned session; an end drops the cues | Simulator start / end; end drops cues | Automated |
| `ENDPOINT_REQUEST` key and RESUMED-after-failure (D2 / D3) | Fixed in the shared coordinator | Event keys; mic-resume failure | Automated |
| Cue events out of order (D4) | Fixed in the shared JS | `call-ending-warning.test.ts` | Automated (Jest) |

### 7.5 iOS app suspension and resume: a bounded review (2026-11-04)

The Product Owner asked for a review of the suspend / resume path, and especially of `NativePacedTimers` relying on
native events while JS is in the background.

**What can happen.** With a CallKit call active, the audio session keeps the app running: the engine's 20 ms timer
(`VoiceProcessingAudioIO`) drives the 250 ms tick, while active and while held. If iOS ever suspends the app, for
example during a long hold with the session deactivated, then neither JS timers nor native events run. The first
event after the suspension is the resume.

**Reviewed:**
- `NativePacedTimers`: on resume, each overdue timeout fires once and an interval fires once, never in a burst;
- the client's reconnect: the grace is measured from when the phone saw the loss;
- the controller's end latch, `onServerEnded` (`serverConfirmed` is false only for the local `LOST`), and the verdict
  wait;
- the warning schedule: it is re-applied from `endsAt` on every STATE.

**Result: no defect.** The PO's three questions are answered by 4 new Jest tests in `live-call-controller.test.ts`,
under "a suspension (no JS, no native event for minutes), then the resume":

| Question | Test | Result |
|---|---|---|
| A completed call without the server's confirmation? | a link lost before a held suspension: on resume one reconnect, then `LOST`, `serverConfirmed:false`; an End just before a suspension: `NO_SERVER_VERDICT`, unconfirmed, and a later `ENDED` changes nothing | never |
| HELD / LOST lost? | the held line is kept through the suspension; RESUMED after it clears the hold with UNMUTE where the capture clock continues; a link the server closed during the suspension reconnects and the server's verdict (`PEER_LOST_AFTER_GRACE`, confirmed) decides | kept |
| Late timers wrong on resume? | 10 minutes suspended: exactly one heartbeat on resume, no catch-up burst; the reconnect timer fires once | correct |

A planted fault, the interval's due time not advanced, fails the no-burst test.

**Recorded, not changed:**
- the iOS engine clock is `mach_absolute_time`, which does not advance while the device sleeps. After a suspension
  with the device asleep, a warning cue scheduled on that clock would fall due late;
- the server's `CALL_ENDING` (queued at its own moment) and every STATE after a reconnect re-schedule from the wall
  clock, so the warning is not lost. A real-iPhone check belongs to the deferred tests (FI 019);
- an End sent just before a suspension resolves as `NO_SERVER_VERDICT` (unconfirmed) when the wait runs out on
  resume. That is honest, never "completed", and the microphone and the CallKit call are already stopped.

## 8. CI on the Draft PR

**All green on `b3c4399c`** (runs 41733417026, 41733417032 and 41733417240):

| Workflow | Job | Result |
|---|---|---|
| S8B-06 native call tests | iOS engine + coordinator (`swift test`, macOS host) | **success**: 75 tests, 0 failures |
| S8B-06 native call tests | iOS engine + adapters (`xcodebuild test`, iPhone simulator) | **success**: 79 tests, 0 failures. The 4 simulator integration tests ran (none skipped), including the microphone denial |
| S8B-06 native call tests | Android module JUnit (Kotlin) | **success**: 35 tests |
| API CI | verify-api; validation evidence | **success** |
| Mobile CI | fast mobile contract gate (including both S8B-06 contracts) | **success** |
| Mobile CI | Android Release APK (x86_64); Android API 36 emulator boot smoke | **success** |
| Mobile CI | **iOS Release simulator app**; iPhone 17 / iOS 26.5 simulator boot smoke | **success** |

**CI rounds (CP2-caused, fixed narrowly, no assertion weakened):**

- **R1** (`26af9464`). The first Swift compile on macOS refused three optional buffer pointers in a **test helper**
  (`OpusTestSupport.swift`): libopus's annotated headers make them non-null. They are unwrapped there. The engine
  itself compiled on the first run.
- **R2** (`b3c4399c`). S8B-05's `s8b-05-live-call-contract` test 7 (CP1's "no call copy on the phone") was
  re-anchored as §4 describes. The re-anchored test is stricter for the one file it allows.
- **Not changed:** the only Swift warning, `.allowBluetooth` renamed `.allowBluetoothHFP` in the iOS 26 SDK. Using the
  new name would tie the module to the newest Xcode.

## 9. Acceptance (the CP2 order; contract #21 and #36 in 06-CP2)

| # | Item | Verdict | Source |
|---|---|---|---|
| 1 | One call; a second refused | **PASS** (phone, emulator, unit) | §6 D2nd; §5 C2nd; Jest; Swift coordinator |
| 2 | Start / refuse / end from every source | **PASS on the phone**: app, notification Hang up, server, swipe-away (`TASK_REMOVED`), microphone denial, second call. Telecom, the service and the notification were cleaned up after each end, and the audio mode restored. Unit-only: SYSTEM / MICROPHONE / ENGINE / SERVICE / APP_GONE | §6 D1–D3, D0, D2nd, D8; §5; Kotlin machine; Swift coordinator; Jest |
| 3 | Late callbacks | **PASS** (unit) | Jest (`ignoredLate`), Swift, Kotlin machine |
| 4 | Focus / cellular call | **PASS on the phone**: a real incoming cellular call → ON_HOLD, MUTE, uplink stopped, held line; UNMUTE and resume on the continuing clock; no state lost. Also the emulator (C5b / C5c) | §6 D5; §5 |
| 5 | Background / lock (#21) | **PASS on the phone** with the **secure** lock screen: session, timers and heartbeats kept (0 silence closes), microphone live (not silenced). iOS NOT DEVICE-VERIFIED (JS side §7.5) | §6 D4 / D4-H / D6; §5 C4 / C6; §7 |
| 6 | Routes | **PASS for SPEAKER and EARPIECE on the phone**, switched during the call with capture unbroken. **Bluetooth and wired: NOT PROVEN** (no accessory available; not marked PASS) | §6 D7; §5 C7 |
| 7 | Reconnect within 30 s; a timeout with no false completion | **PASS on the phone**, locked: epoch 2 in 0.3 s; past the grace `LOST`, `serverConfirmed:false`, 32.35 s after the loss | §6 D4 / D6; §5 C4 / C6 |
| 8 | Server END synchronised with the Telecom / CallKit cleanup | **PASS on the phone** (D3, D4, D4-H, locked); iOS automated | §6; §5; §7.1 |
| 9 | T-5 / T-1 (#36): heard with the screen locked, the notification updated | **PASS on the phone**: with the secure lock, both notification lines shown, each cue once, HEARD only from the presented `TIMESTAMP`; **heard by the Product Owner on the speaker**. iOS background playback: simulation and simulator only | §6 D4 / D4-H; §5 C4; §7.2 |
| 10 | No paid provider; no raw audio in logs | **PASS** | Contract pins; the evidence |
| 11 | Kotlin unit, Android build, API 36 emulator, real phone | **PASS** | §4, §5, §6 |
| 12 | Swift tests, iOS Release simulator build, simulator lifecycle tests | **PASS** (CI): 75 / 75 on the host, 79 / 79 on the simulator, Release simulator app built, boot smoke | §8 |
| 13 | Jest, tsc, ESLint, prebuild idempotency, re-anchoring | **PASS** (local): Jest 75 / 75 | §4 |
| 14 | API and Mobile CI on the Draft PR | **PASS** on `b3c4399c`; see §8 for the later heads | §8 |
| 15 | No gates, no migration, no protocol change | **PASS** | §0 |
| 16 | The `phoneCall` FGS type alone (G1.2) | **PASS on the phone**: `microphone` not needed, not added | §6 |

**Copy gaps for the Copy Gate (not decided here):**

- there is no row for the T-1 notification line; LC-07 stands in;
- there is no row for the Android channel name; LC-11 stands in.

## 10. CP3 boundary

CP3 owns:

- the call UI over DepthComposition, CallRail, Analysis-first, the conversation ↔ analysis navigation;
- `call-truth` / CallSafeStrip, J3 / J7, the disclosure line, the live map update;
- E2E on the real phone against the local S8B-05 server with synthetic providers;
- the iOS simulator E2E, on-device N, F-01 files (D-05-02), the Stage 9 list, and S8B-06's closure.

CP2 hands CP3:

- the controller events (phase / held / reconnecting / warning / notification / ended);
- the copy gaps above;
- from §6, Bluetooth and wired routes (no accessory was available on 2026-11-04). They are to be proven with CP3's
  real-phone E2E when an accessory exists.

They are recorded here so that none is silently carried.

## 11. Backlog (BG-05 at kickoff; CP2 is not the closing change)

S8B-06 works `QAN-BL-VOICE-01` (Stage 8B), which stays `DEFERRED — OWNED`, `HIGH`: worked, not delivered. It owns
`QAN-BL-VOICE-06` (admitted by S8B-05 CP4; owner "S8B-06 CP3: the call UI and device acceptance"). CP2 read it and
leaves it to CP3: what the person sees or hears after a drained turn is call-UI behaviour, and CP2 adds none. CP2's
controller keeps the resume path that item needs (epoch, resend, the reconnecting state, §5 C4). `QAN-BL-VOICE-07` is GCR-01's and is
untouched. CP2 admits and tombstones nothing.
