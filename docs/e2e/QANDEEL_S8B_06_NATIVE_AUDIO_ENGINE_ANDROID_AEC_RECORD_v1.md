# QANDEEL S8B-06 — Native Call Audio Engine & Real Android AEC Proof: Implementation Record v1

**Checkpoint:** S8B-06 CP1 — CLOSED / READY FOR PO MERGE DECISION (2026-11-02). CP1 (Native Audio Engine & Real
Android AEC Proof) is on `s8b/s8b-06-cp1` as Draft PR #376, **not merged; merge only on the Product Owner's explicit
«ادمج»**.

- **Proven on a real phone:** AEC; B1 / B2, 20 / 20; the user's first words kept.
- **Stop latency:** the measured 69–77 ms is accepted by the Product Owner for the first release as an approved
  exception (§9). Stop ≤ 50 ms is still recorded as not met, and the goal moves to Future Improvement 018.

S8B-06 is **not closed**. S8B-06 CP2 / CP3 are **not started and not authorized**.

## 0. Authority, base, precedence

**Authority:** the Product Owner's S8B-06 CP1 execution authorization (2026-11-02) and its execution task
(`S8B-06_CP1_CLAUDE_EXECUTION_TASK.md`, kept outside the repository), in parallel with S8B-05 CP2 (D-05-05).

- Binding contract: `S8B-05_S8B-06_INTEGRATED_LIVE_CALL_CONTRACT_v1.2_FINAL_FOR_PO_EXECUTION_APPROVAL.md` (the Product
  Owner's reports folder `S8B-05`). **Precedence:** v1.2 Part A → A1 → v1.1 → v1.0, with D-05-05, A6 (06-CP1 = v1.0 §12)
  and v1.0 §9 / §11 / §12.
- The pack also named `SOURCE_INDEX.md` and `DEVICE_PROOF_CHECKLIST.md`; neither file was present on disk at kickoff.
  The execution task's own acceptance list (§9 here) was used as the checklist.

**Base:** `main` at `50938001`, the merge of PR #374 (S8B-05 CP1, protocol v1 frozen).

**Branch:** `s8b/s8b-06-cp1`, in its own worktree. **No migration.**

**Constraints kept:**

- `apps/api/`, `database/`, the frozen protocol (`docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md`,
  `apps/api/src/voice/call/live-call.protocol.ts`) and migration `0189` are **unchanged** (`git diff main -- apps/api
  database docs/voice` is empty);
- no voice gate opened, no production identity changed, no hosted deploy, no paid call, no provider called
  (DeepSeek / Gemini / Speechmatics untouched);
- no raw audio stored or logged; the evidence holds numbers, and the only audio files are the gateway's synthetic reply
  and the host's synthetic stimulus;
- the user's installed `com.qandeel.mobile` was never uninstalled, replaced or cleared; the proof ran as
  `com.qandeel.mobile.s806proof` ("QANDEEL S806 Proof");
- no merge without «ادمج».

## 1. What CP1 delivers

| Item | Delivered | Where |
|---|---|---|
| **1. Native Android audio engine** | One full-duplex engine, not `expo-audio`: `AudioRecord(VOICE_COMMUNICATION)` with the platform `AcousticEchoCanceler` attached to its session, `AudioTrack(USAGE_VOICE_COMMUNICATION, CONTENT_TYPE_SPEECH)` low-latency, `MODE_IN_COMMUNICATION`, transient audio focus, earpiece / speaker routing (`setCommunicationDevice` on API 31+), the previous mode, speaker state and focus restored at stop; idempotent stop; faults (`CAPTURE_LOST`, `PLAYBACK_LOST`), focus loss and route changes reported. Android only; no manifest of its own (no permission or service added). | `apps/mobile/modules/qandeel-voice-call/` (`CallAudioEngine.kt`, `QandeelVoiceCallModule.kt`) |
| **2. Opus** | Uplink 16 kHz mono, 20 ms (320 samples), VOIP, 24 kbps, **in-band FEC on** (expected loss 10 %), **DTX off**; downlink 24 kHz, 20 ms, **decoded at 48 kHz and halved** by a 47-tap half-band low-pass (Concentus decodes libopus's HYBRID packets to silence below 48 kHz — found by the device proof, §5.3). Concentus 1.0.2 (a pure-Java libopus port, BSD-3, no dependency, pinned) — chosen because Android's MediaCodec Opus encoder cannot enable FEC. Packets are carried byte for byte in the frozen frames. | `OpusCodecs.kt`; `build.gradle` |
| **3. VAD after AEC** | The speech-onset detector reads the **processed** (post-canceller) frame: an adaptive noise floor + 10 dB, an absolute floor of −50 dBFS, and while QANDEEL is audible an echo guard (the frame must reach the loudest reply packet written in the last 400 ms − 18 dB). **Onset after 10 consecutive 20 ms frames = 200 ms**; the onset instant is back-dated to the run's first frame. | `SpeechOnsetDetector.kt` |
| **4. Local barge-in** | At an onset while QANDEEL is audible: an 8 ms `VolumeShaper` fade (click-free), the heard position read, the reply's unheard packets struck, every later packet of that turn refused (`LATE_AFTER_CUT`), the volume restored only after the cut frames pass the mixer. **The microphone is never stopped**: the uplink is encoded and sent before the detector judges the frame. `REPORT_ONLY` mode counts candidates without cutting (proof only). | `CallAudioEngine.bargeIn`, `ReplyLedger.cut` |
| **5. Playout truth** | PLAYOUT comes only from frames the platform **presented** (`AudioTrack.getTimestamp` frame position; a pessimistic head − latency fallback when no timestamp exists, labelled). A mark names the last reply packet whose every frame was presented; a packet faded to silence by a cut is never confirmed. The track is written continuously (silence between replies) so positions never jump. | `ReplyLedger.advance`, `CallAudioEngine.reportPlayout`; `live-call-session.ts` |
| **6. Protocol client (TS)** | `LiveCallClient`: the frozen upgrade (subprotocol + `Authorization: Bearer` header, never the URL), HELLO / resume, heartbeat, exact-key messages, the seq / capture-clock rules, one replay log in production order (the last 2 s of audio + unacknowledged controls) resent after `STATE` from `resumeFromCaptureMs`, epoch-checked REPLY_AUDIO, reconnect backoff inside the 30 s grace, FENCED / refusal / ENDED stops. `LiveCallSession` joins it to the engine. `wss://` only; `ws://` loopback only for the proof. | `apps/mobile/src/voice-call/` |
| **7. Fake Gateway** | Protocol-exact (upgrade refusals, RFC 6455 bounds, exact keys, epochs, fencing, seq / capture rules, REFUSED + 4002, silence 4008, grace); libopus (opusscript) synthetic replies at 24 kHz paced at 20 ms; simulated PLAYOUT (highest mark) and BARGE_IN (REPLY_END INTERRUPTED); late, repeated, reordered, jittered and wrong-epoch packets; drop / durable lag; FEC read from the SILK LBRR flag; content-free evidence. No provider, no environment. | `scripts/s8b-06/fake-call-gateway.cjs` (+ `ws-test-client.cjs`, `host-stimulus.cjs`) |
| **8. Device proof** | A separate proof root and build selector (S8B-04 precedent). | `apps/mobile/src/voice-call/__validation__/`, `apps/mobile/scripts/select-s806-proof-entry.mjs` |

**Not delivered, as authorized (not in CP1):** Core-Telecom, `MANAGE_OWN_CALLS`, a `phoneCall` foreground service,
CallStyle, CallKit, iOS audio (`loadVoiceCallEngine()` is null on iOS), `UIBackgroundModes audio`, background / lock,
full Bluetooth routing, a config plugin, any call UI, the Live Map, Replay, any real provider (DeepSeek / Gemini /
Speechmatics), F-01, S8B-08 paid tests. Nothing in `runtime-entry/` or `integration/` reaches the live call; no
`notifee`; no persistence of call truth on the phone.

## 2. Design notes

- **One clock.** The capture clock is the engine's frame counter × 20 ms from the call's first packet; muted audio is not
  produced (no seq is spent; MUTE / UNMUTE carry the jump), and resent packets keep their original seq and `captureMs`.
- **Order at a cut.** The final heard mark (PLAYOUT) goes first, then BARGE_IN with the onset instant, on the same ordered
  connection (A3.2 P4). The CP1 server refuses both `NOT_SUPPORTED_YET`; the client settles them on the refusal. The
  phone never claims the server accepted a barge-in.
- **Stop-latency measurement.** `stopLatencyMs = stamp.nanoTime + (head − stamp.framePosition) / rate + ramp − detectedAt`:
  the moment the last frame written before the fade leaves the speaker, by the platform's own presentation timestamp,
  plus the 8 ms ramp. Timestamp origin: `CLOCK_MONOTONIC` (`System.nanoTime`), detection taken on the capture thread
  when the 10th frame of the run is read. Cross-checked acoustically (A1, §5).
- **What the stop latency does not include:** the 200 ms onset run (by design), and the acoustic path from the mouth to
  the microphone.

## 3. Host proofs (free, local and in CI)

| Proof | Result |
|---|---|
| `tests/s8b-06-native-audio-engine-contract.test.mjs` (root, wired in API CI and Mobile CI) — the phone's and the gateway's protocol statements compared with the frozen server code on a corpus of ~200 client messages, every server message shape, binary frames byte for byte, all 256 TOC bytes, and the document's JSON block; the gateway e2e on a real socket (upgrade refusals, 1009 / 1002 / exact keys, libopus uplink with FEC, seq / capture rules, MUTED gap, violation → 4002 suspended, resume / fencing / OTHER_DEVICE, simulated REPLY_AUDIO / PLAYOUT / BARGE_IN / late); the CP1 boundaries | **14 / 14 pass** |
| Mobile Jest `src/voice-call` (protocol, client 13, session 7) | **28 / 28 pass** |
| Native JUnit `:qandeel-voice-call:testDebugUnitTest` (detector 8, ledger 6, Opus 4: mono 20 ms TOC with FEC read from the LBRR flag and decodable, no DTX on silence, 24 kHz decode, and **64 real libopus downlink packets — hybrid and SILK — each decoded to libopus's own level ± 3 dB**, fixture `src/test/resources/s806-libopus-downlink-hybrid.txt`) | **18 / 18 pass**, 0 failures (local Gradle 9.3.1, §4) |
| `tsc --noEmit`, ESLint (`src/voice-call`, the selector) | clean |

**CI fix (on `df9d2ccb`).** API CI and Mobile CI run Node 22, and there the contract's gateway tests (5–14) were
cancelled with "Promise resolution is still pending but the event loop has already resolved". Locally they pass on
Node 24.

- **Reproduction.** The failure was reproduced locally on Node 22.
- **Cause.** `server.close()` waits for every socket the fake gateway accepted. A refused upgrade (`socket.end` only),
  or a wire closed with an unref'd destroy timer, can stay half-open. On Node 22 `close()` then never settled, so the
  test's `withGateway` hung on it while nothing else kept the event loop alive.
- **Fix.** The narrowest one, in the fake gateway only: it tracks its sockets and destroys those still open when it
  closes. No assertion and no protocol rule changed.
- **Result.** 14 / 14 on Node 22 and on Node 24.

## 4. Native build

- `S806_DEVICE_PROOF=1 node scripts/select-s806-proof-entry.mjs --apply` (the one-line `main` switch), `expo prebuild
  --platform android`, then in the **generated** project only: `applicationId "com.qandeel.mobile.s806proof"`, `app_name`
  "QANDEEL S806 Proof", `android:usesCleartextTraffic="true"` (the `ws://127.0.0.1` loopback through `adb reverse`).
  `app.json`, the production identity and the committed manifest inputs are unchanged; the selector was restored and
  `apps/mobile/android` deleted after the build.
- `gradlew :qandeel-voice-call:testDebugUnitTest` → BUILD SUCCESSFUL, 18 / 18.
- `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` → BUILD SUCCESSFUL. The proof APK measured in §5 is
  sha256 `ce7fb1491f552bb47b1e2ea532052f1dcffd22a25a01162ca6ab64731c9d150c` (58.2 MB; `aapt dump badging`: package
  `com.qandeel.mobile.s806proof`, label "QANDEEL S806 Proof"), the fourth build: `40dab4fd…` (first device session),
  `de460901…` (RAW_MEDIA_PROOF control), `1cbc50c1…` (the RAW_* source variants) preceded it; every echo figure in §5
  comes from `ce7fb149…` (reports 041–063 and 079–081), the first build with the downlink fix. A fifth build,
  `264077cf…` (a 48 kHz track, reports 064–078), was measured and rejected (§5.6). The source in this change is
  `ce7fb149…`'s. The microphone permission is the one the app already declares (expo-audio); the module
  adds none. The APK and the JUnit XML are kept with the evidence outside the repository
  (`QANDEEL_REPORTS/S8B-06/CP1/`).

## 5. Real Android proof

Evidence: `QANDEEL_REPORTS/S8B-06/CP1/device-proof/` holds the following, numbers only, no audio:

- the proof app's reports and the gateway's reports;
- the series logs;
- the pooled analyses;
- `device-conditions-start.txt`.

### 5.1 Device, build, conditions

- **Phone.** Identity was read over `adb` before every install:
  - serial `AWCX6R4603003224`, `HONOR ALI-NX1` (the contract's "Huawei ALI-NX1" is this model under the Honor brand);
  - Android 15 (API 35), build `ALI-N21 9.0.0.226(C185E14R3P1)`;
  - Qualcomm: the platform canceller reports `Acoustic Echo Canceler` by `Qualcomm Fluence`, available, attached and
    enabled. NS is available; AGC is not.
- **App.** `com.qandeel.mobile.s806proof` only; the installed `com.qandeel.mobile` was not touched.
- **Conditions,** logged in `device-conditions-start.txt` with every install:
  - mains power, battery 99–100 %, 31–34 °C;
  - `STREAM_VOICE_CALL` 10 / 10 on earpiece and speaker;
  - phone flat on a table.

  The user's rooms are not quiet. The user moved to a quieter room once (19:29); every acceptance figure below is from
  after that move. The method does not ask for silence (§5.2).
- **Platform facts found on this phone:**
  - **Honor preprocessing.** Read from `dumpsys media.audio_policy` 8 s into every run. The system attaches its own
    "Honor Audio Preprocessing Effect" to `MIC`, `CAMCORDER` and `UNPROCESSED` capture, but not to
    `VOICE_PERFORMANCE`. `VOICE_COMMUNICATION` carries exactly `Acoustic Echo Canceler` + `Noise Suppression`; with the
    canceller disabled (E3), it carries `Noise Suppression` alone.
  - **Hotword service.** A hotword service holds the microphone in the background (`VOICE_RECOGNITION`).
  - **Output path.** The 24 kHz `USAGE_VOICE_COMMUNICATION` track is mixed by the primary output. It is not granted the
    FAST path (`lowLatency: false`).
- **APKs (§4).** The measured builds:
  - `ce7fb149…`: reports 041–063 and 079–081;
  - `264077cf…`: reports 064–078, an attempt rejected in §5.6.

  Reports 001–040 belong to the earlier builds and to the two defects of §5.3. No acceptance figure is taken from them,
  except the P0 permission check (report 001).

### 5.2 Method: no quiet room, QANDEEL's own signal as the reference

- **Known reference.** The fake gateway plays a synthetic voiced reply (libopus, 24 kHz). A seeded pseudo-random ON/OFF
  pattern gates it: segments of 300–800 ms, starting OFF; in the "duck" variant, OFF = −40 dB. The gateway reports each
  packet's level and send time, never samples.
- **Heard timeline.** The phone's own PLAYOUT marks place every reply packet on the phone's clock:
  `t[c] = markAt − (k − c + 1) · 20 ms`. The uplink's per-frame levels are aligned to it. These are post-processing
  levels, the frames the server would receive.
- **Pairs.** Each ON segment is compared with its neighbouring OFF segment at a fixed acoustic lag, taken from the
  positive control (20 ms; 40 ms is checked as well).
- **Contamination.** An OFF segment holding any frame > baseline + 12 dB makes its pair *contaminated*. Such pairs are
  set aside for the echo estimate only; they still count for the false-barge-in test. Room noise is therefore excluded
  from the AEC figure, but never from the robustness figure.
- **Sufficiency.**
  - A run is analysable with ≥ 12 valid pairs, ≥ 60 % of its pairs.
  - A condition is decided on the pooled valid pairs of its repetitions: ≥ 24 pairs over ≥ 2 runs. Otherwise it is
    reported as "insufficient", never as a pass.
- **Decision.**
  - The test is a sign test of the pooled ON − OFF differences: echo is detected when p < 0.01 and the median is > 0.
  - The leak is the median added power.
  - Spearman correlation and a permutation null are reported per run.
- **No invented threshold.** The contract fixes no AEC acceptance number, and none is invented here. The verdict reads
  "echo detected / not detected in the uplink at this sample size", stated beside the leak level and the false-cut count.
- **Tooling.**
  - `scripts/s8b-06/device-echo-series.cjs` drives the runs over adb.
  - `echo-analysis.cjs` is the analysis.
  - `echo-pool.cjs` re-analyses any run offline from its stored numbers.
  - `device-scenarios.cjs` drives A1 / L1 / R1 / H1 / B1 / B2.

### 5.3 Two defects found by the positive control, both fixed before any echo figure was taken

The first sessions could not find the reply even on a raw microphone. The method itself was therefore tested first,
with a positive control: the same pattern captured with no canceller.

1. **Gateway synthesis (validation tooling).** The synthetic reply's frequency drifted inside each packet. It now
   uses phase accumulation.
2. **Downlink decode (product code).**
   - Concentus 1.0.2 decodes libopus HYBRID packets to **silence** at output rates below 48 kHz. These are configs
     12–15, which libopus chooses for 24 kHz speech after a pause. SILK-only packets decode correctly, so replies went
     silent part-way through.
   - The defect was reproduced on the host against real libopus packets.
   - The downlink is now decoded at 48 kHz and halved (§1 item 2). On the host this matches libopus to within 0.63 dB.
   - The 64-packet JUnit fixture pins the fix (§3).

The user suggested the phone's old microphone or hardware might be at fault; this was checked and ruled out. A
continuous tone raised the microphone's p90 level from −32 to −19 dBFS.

### 5.4 Echo-only (QANDEEL speaking, user silent): `ce7fb149…`, reports 041–058, fixed lag 20 ms

Pooled with `echo-pool.cjs <dir> --lag 20 --from 41`; the result is kept as `echo-pool-lag20-from041.json`.

| Condition | Capture (effects read from the platform) | Runs | Valid pairs | Median ON − OFF | Positive | p (sign) | Leak | Echo in uplink | False cuts |
|---|---|---|---|---|---|---|---|---|---|
| **E7** positive control, speaker | `VOICE_PERFORMANCE` [none] | 2 | 36 | +28.6 dB | 36 / 36 | < 10⁻⁵ | −23.4 dBFS | **detected** (the method sees the reply) | — |
| E6 positive control | `MIC` [Honor preprocessing] | 2 | 10 | +46.2 dB | 10 / 10 | 0.001 | −24.6 dBFS | insufficient (< 24 pairs) | — |
| **E3** voice path, canceller **disabled** | `VOICE_COMMUNICATION` [NS] | 2 | 26 | +26.0 dB | 26 / 26 | < 10⁻⁵ | −61.6 dBFS | **detected** | 0 |
| **E5** speaker, canceller on, report-only | `VOICE_COMMUNICATION` [AEC, NS] | 3 | 26 | +0.3 dB | 15 / 26 | 0.28 | −100.4 dBFS | **not detected** | — (0 candidates) |
| **E1** speaker, canceller on, barge-in armed | `VOICE_COMMUNICATION` [AEC, NS] | 3 | 27 | −0.3 dB | 5 / 27 | 0.9998 | −120 dBFS | **not detected** | 1, external noise (below) |
| **E2** earpiece, canceller on, barge-in armed | `VOICE_COMMUNICATION` [AEC, NS] | 3 | 45 | −0.7 dB | 14 / 45 | 0.997 | −120 dBFS | **not detected** | 0 |

- **What the canceller does.** E3 against E5 / E1 / E2 compares the processed and unprocessed paths on the same
  source. With the canceller disabled, the reply is present in every pair at about −62 dBFS. With it enabled, the
  reply cannot be told apart from the OFF segments. At a 40 ms lag the verdict is the same (E5 p 0.035, not < 0.01).
- **False barge-in from echo: 0** in every armed run (E1 × 3, E2 × 3).
- **The one E1 cut was external noise, not echo.** It fell at capture 3500 ms, 160 ms into an **OFF** segment, while
  nothing was being played. It followed a quiet gap (−72 to −81 dBFS) and rose to −34 dBFS for ~400 ms.
- **Robustness to the room** (a separate measure). With the gateway silent, E5 counted 3 report-only candidates in
  40 s of the room alone. This is the detector's false-trigger rate from external noise, as tuned: an onset run of
  200 ms above floor + 10 dB. It is a VAD robustness figure, not an echo figure. It is reported, not accepted or
  rejected, since the contract sets no number for it.
- **Quality note Q-01: external noise, kept apart from AEC** (Product Owner, 2026-11-02). The false cuts and
  report-only candidates caused by street and room noise are kept as a separate VAD quality observation, classified for
  later evaluation and improvement.
  - They are **not** evidence that AEC failed: they fell while the reply was silent or absent.
  - The current results do **not** prove that the detector tells human speech apart from every possible noise. The
    onset rule is level and duration, not a speech classifier.
  - Q-01 is not an acceptance criterion and blocks nothing.

### 5.5 True barge-in with the user's voice: `ce7fb149…`, reports 079 (B1, speaker) and 080 (B2, earpiece)

In each run QANDEEL plays a reply and the user speaks over it after an on-screen cue. The platform canceller is on and
barge-in is armed. There were 10 repetitions per route.

| | B1 speaker | B2 earpiece |
|---|---|---|
| Cuts after the cue / before the cue / missed | **10 / 0 / 0** | **10 / 0 / 0** |
| Onset run → detection (capture clock) | 180 ms each (the 10-frame run, onset back-dated to its first frame) | 180 ms each |
| **Stop latency, detection → silence** (source `TIMESTAMP`, every sample) | **P50 76.18 · P95 76.67 · Max 76.67** (min 74.68) ms | **P50 69.77 · P95 72.43 · Max 72.43** (min 69.18) ms |
| Fade start after detection | 2.4–16.7 ms | 3.5–12.3 ms |
| First words: uplink packets from 400 ms before to 280 ms after the onset, received / expected, holes | 35 / 35, 0 holes, in each of the 10 | 35 / 35, 0 holes, in each of the 10 |
| First words: uplink level, first 100 ms of speech vs before the onset (median of runs) | −15.3 vs −63.3 dBFS | −24.2 vs −85.8 dBFS |
| Reply packets of the cut turn refused afterwards (`LATE_AFTER_CUT`) | 6–7 per cut | 6–7 per cut |
| PLAYOUT ahead of admitted / ahead of time | 0 / 0 | 0 / 0 |

- **First words.** The microphone is never stopped, and the user's first words reached the gateway intact while the
  reply was being cut. ASR is not claimed: the gateway decodes the user's packets with libopus and checks only their
  count, order and level.
- **Stop ≤ 50 ms is NOT met on this phone: every sample is 69–77 ms.**
  - The figure comes from the platform's own presentation timestamp of the last frame written before the fade, plus
    the 8 ms ramp (§2). It is not a JS estimate.
  - The cut itself begins 2–17 ms after detection. The rest is the output path's own queue: the primary mixer's
    write-to-presentation latency measured ~70 ms on this phone.
- **A1 cross-check** (report 059, 10 repetitions, same build).
  - The timestamp estimate gave P50 69.92 · P95 76.53 · Max 76.53 ms.
  - The acoustic drop seen at the microphone gave P50 231 · Max 247 ms.
  - The acoustic figure is only an *upper* bound: it also contains the unmeasured input latency of the capture path,
    so it decides nothing.

### 5.6 The one attempt to shorten the output path (rejected)

`264077cf…` opened the track at 48 kHz, which the platform routes to its `DIRECT | VOIP_RX` output (960-frame HAL
buffer). It produced reports 064–078.

- The stop estimate improved but still did not reach ≤ 50 ms (A1 P50 56.75 · Max 68.74 ms).
- That output's timestamps ran ~100 ms early: the measured echo lag moved from 20 to 120 ms. An estimate built on them
  cannot be trusted.
- With the same canceller, a residual echo appeared (`echo-pool-48k-lag120-from065.json`):
  - E5: +3.4 dB, p 0.001, −84.9 dBFS;
  - E1: +1.1 dB, p 0.0001, −95.2 dBFS.
- It was rejected. The source was returned to `ce7fb149…` byte for byte, and that APK was reinstalled for B1 / B2.

The remaining route that might shorten the output path is AAudio MMAP through the NDK; the phone's policy reports MMAP
support (policy 2). That would be a native C++ audio path, outside CP1. It is not attempted here. The Product Owner
decided not to open it now (§9); it is recorded in Future Improvement 018.

### 5.7 Late / reordered / wrong-epoch packets (L1, report 060)

The gateway sent one turn as 183 packets (164 distinct):

- 19 repeats and 32 reordered;
- 15 with the wrong epoch;
- 8 sent after the barge-in.

**What the phone refused:**

- `ACCEPT` 125, `REPEATED_OR_REORDERED` 49, `LATE_AFTER_CUT` 9.
- Wrong epoch: **15 / 15 dropped**.

**Reconciliation:**

- **Repeated / reordered.** The 51 repeats and reorders account for 49 `REPEATED_OR_REORDERED` + 2 that arrived after
  the cut and were refused as late.
- **Late after the cut.** 8 were sent after the gateway's cut, plus 1 in flight.
- **Harness checks.** Two equality checks printed `false` only because they demand exact count equality per category,
  which is too strict for this split. No refused packet was played.

**PLAYOUT:**

- The gateway saw no PLAYOUT above what it had sent (`playoutAboveSent: 0`).
- The phone's `aheadOfAdmitted: 41` is a count × 20 ms artefact of this scenario's deliberate holes: it compares
  positions, not packets. In every loss-free run (B1, B2, E series) it is 0.

### 5.8 Resume and capture clock (R1, report 061)

- **Resume.** After a forced disconnect, the call resumed at epoch 2 from `resumeFromCaptureMs` 2680.
  - 35 audio frames were resent with their original seq and capture time.
  - The clock was not reset to zero, and there was 1 reconnect.
- **Mute / unmute.** These left exactly one `MUTED` gap (5400–6420 ms) as the only capture break; `seqBreaks` 0.
- **Uplink packets.** All were mono 20 ms, with no DTX and no decode error.

### 5.9 Lifecycle (P0, H1: reports 001, 062, 081)

- **P0.** With the permission refused, start fails `PERMISSION_DENIED` and the call ends cleanly (0 uplink packets).
- **H1.** Five open → end cycles, alternating earpiece and speaker; each ended `USER_ENDED / ENGINE_STOPPED`.
- **Restoration, from the platform's own log.** The proof root's own during/after fields were mostly empty
  (`describe()` read too early), so restoration is taken from the platform log after H1 #2 (report 081,
  `h1-2-platform-audio-events.txt`):
  - 5 / 5 `requestAudioFocus` → `abandonAudioFocus` pairs;
  - 5 / 5 `setCommunicationDevice` → `clearCommunicationDevice` pairs;
  - the mode history ends in `MODE_NORMAL`, with mode owner "None" (back-to-back cycles under 0.5 s apart appear
    coalesced in that log);
  - the same restoration to `MODE_NORMAL` after every session shows for the 10 sessions logged 20:32–20:45 (8 on `264077cf…`, whose lifecycle code is the same, and B1 / B2).
- **Microphone released.** After the proof, `media.audio_policy` held no capture client for the proof app's uid.

## 9. Acceptance (the execution task's list; contract v1.0 §11 items 3, 6, 7, 16, 24, 25 within CP1)

| # | Item (execution task §6) | Verdict | Source |
|---|---|---|---|
| 1 | Capture and playback together with AEC active; clear sound from the main speaker | **MET** | D0 / B1 `describe`: AEC attached and enabled (Qualcomm Fluence); replies heard on speaker and earpiece; positive control §5.3–5.4 |
| 2 | Echo-only: no false barge-in from the phone's own speaker; processed vs unprocessed measured; false-trigger rate | **MET on this phone** | §5.4: echo not detected with the canceller (E1 / E2 / E5, ≥ 26 pooled pairs each); detected at −61.6 dBFS without it (E3); 0 echo-caused cuts; room-only false-trigger rate reported (3 candidates / 40 s). No AEC number invented |
| 3 | True barge-in: detection after ≥ 200 ms of real speech; **local stop ≤ 50 ms** from detection; P50 / P95 / Max with timestamp origin | Detection **MET** (10 + 10 of 10, 0 before the cue). **Stop ≤ 50 ms: NOT MET** (measured): B1 P50 76.18 / P95 76.67 / Max 76.67 ms; B2 P50 69.77 / P95 72.43 / Max 72.43 ms. **Accepted for the first release as a PO-APPROVED EXCEPTION** (2026-11-02, below) | §5.5, source `TIMESTAMP` on every sample; A1 cross-check §5.5; one rejected attempt §5.6 |
| 4 | First words kept on the uplink during the cut | **MET** | §5.5: 35 / 35 packets, 0 holes, × 20 runs; speech level against the pre-onset level |
| 5 | No packet of a cut reply or old epoch played; PLAYOUT only from heard positions | **MET** | §5.7 (15 / 15 wrong epoch, late after cut refused, `playoutAboveSent` 0); B1 / B2 / E series `aheadOfAdmitted` 0 with `TIMESTAMP` |
| 6 | Capture clock not reset on resume; protocol-exact resend; no invented speech in the gap | **MET** | §5.8 |
| 7 | Mute / unmute, end, permission refused, audio resources released, audio mode restored, no microphone left held | **MET** | §5.8 (mute), §5.9 (P0; H1 platform log) |
| — | Repetitions documented; device conditions shown | **MET** | §5.1; ≥ 2–3 runs per echo condition, 10 per scenario |

**What was measured (as reported to the Product Owner).** The ≤ 50 ms stop criterion is not met on this phone. Every
sample is 69–77 ms, and almost all of it is the platform's output queue (§5.5).

- This is **not** a failure of platform AEC, which §5.4 shows working.
- The WebRTC condition of execution task §7 (*AEC fails, or echo causes false barge-in*) is therefore **not
  triggered**, and WebRTC was not proposed. It would also not remove the output queue, which a WebRTC audio device
  plays through as well.
- The 48 kHz `VOIP_RX` track was tried and rejected (§5.6).

The Product Owner was offered three options:

1. accept the measured latency;
2. a low-latency AAudio MMAP path through the NDK;
3. measuring on other phones first.

**Product Owner decision (2026-11-02, «S8B-06 CP1 — PO Decision & CI Fix»): PO-APPROVED EXCEPTION.**

- The engine's current performance is accepted for the first release, with the stop latency measured at 69–77 ms
  instead of the original ≤ 50 ms.
- The decision is an **approved exception to the original performance condition**: contract v1.0 D-A1 (detection
  after 200 ms, local stop ≤ 50 ms, the uplink never stopped), carried by execution task §6 item 3. Only the ≤ 50 ms
  figure is excepted. The 200 ms onset, the uplink rule and every other frozen condition stand unchanged, and the
  contract text is not rewritten.
- Not meeting ≤ 50 ms does not block closing S8B-06 CP1 or the first release.
- ≤ 50 ms stays a future goal, not an acceptance condition for the first release. It is recorded as **Future
  Improvement 018**, «S8B-06 — Reduce Android Voice Barge-in Stop Latency to ≤50ms», in the local log
  `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`, as *Future Improvement — Non-Launch-Blocking — PO
  Approved*. Its constraint: no cost to AEC, PLAYOUT truth or the user's first words, and re-evaluation on more than
  one phone model.
- No NDK / AAudio / WebRTC work is opened to shorten it now, and the engine is unchanged.
- The measurements above are **not altered**, and nothing here records the 50 ms criterion as met.

**Not claimed:** nothing here is PASS without its device report. Item 3's stop figure is an accepted exception, not a
pass.

## 10. Backlog (BG-05 at kickoff; CP1 is not the closing change)

S8B-06 owns no item by its own name at kickoff (from `main` at `50938001`). It works `QAN-BL-VOICE-01` for Stage 8B,
which stays `DEFERRED — OWNED`, `HIGH`; worked, not delivered.

**Read and left as they stand:**

| Item | Note |
|---|---|
| `QAN-BL-VOICE-02` … `05` | S8B-08 (`VOICE-04`'s physical-device list is the Voice Note's; the call's device list is S8B-06 CP3) |
| `QAN-BL-PROD-06` / `08` | nothing hosted |
| `QAN-BL-LAUNCH-01` | the edge limit (server) |
| `QAN-BL-MOB-01` | — |

CP1 admits and tombstones nothing.
