# QANDEEL — S8B-01 Voice Runtime Contract & Provider Evidence — Implementation Record v1

**Task:** S8B-01 — Voice Runtime Contract & Provider Evidence (Stage 8B). This record covers **CP1 — the contract, the
amendments, the benchmark harness and the locator reconciliation** (§1 – §8) and **CP2 — the Gemini TTS and provider
evidence** (§9), with the full TTS evaluation on Google Cloud (§9.9). CP3, the selection and the closure, has not started.
**Status:** `S8B-01 CP1 MERGED (PR #364, de774cfd) — CP2 DELIVERED, PARTIAL — TTS SELECTION APPROVED BY THE PRODUCT OWNER (2026-10-28, §9.10) — NO PRODUCTION CODE — USD 0.1155 OF THE USD 10 CAP — ONE RUN, CONSUMED — FULL TTS EVALUATION ON GOOGLE CLOUD COMPLETE (592 / 592, USD 0.7950 OF ITS USD 2 CAP, CONSUMED) — TTS: GOOGLE GEMINI TTS, `gemini-3.8-flash-tts`, VOICE ACHIRD, APPROVED — ASR NOT SELECTED — NO PRODUCTION CODE FOR THE SELECTION — EVERY VOICE GATE CLOSED / CLOSED TO USERS`. S8B-01 is not closed: CP2 is partial (§9.5) and CP3 has not started, and BG-08 / BG-09 are reconciled at S8B-01's last checkpoint, not here.  
**Date:** 2026-10-28  
**Branch / base:** `s8b/s8b-01-voice-runtime-contract`, from `main` at `8b476114a0f8655bcc39c5af80ded169c691c3f8`. That is the
merge of PR #363 (S8A-05 CP4 and S8A-05's closing change, merged 2026-10-27).  
**Authority:** the Product Owner's *S8B-00 approval and S8B-01 CP1 order* (2026-10-28), recorded in §1. The S8B-00
foundation review, its recording / Replay correction and its final version were delivered to the Product Owner outside the
repository. Their decisions are recorded here so that they live in the repository.

Starting CP2, any paid call, merging, deploying and opening any gate each need the Product Owner's explicit approval. None
of them is done here.

---

## 1. The Product Owner's S8B-00 decisions (2026-10-28)

### 1.1 Stage and architecture

**D-1 — Stage transition.** Stage 8B starts.
- The remaining Stage 8A work keeps its owner and state:
  - S8A-06, S8A-07 and S8A-08;
  - `QAN-BL-AI-01`, `AI-02`, `AI-04`, `AI-05` and `AI-08`;
  - `QAN-BL-MATCH-03` and `MATCH-04`;
  - `QAN-BL-ACE-02`, `IP-02` and `CW-05`.
- Stage 8B neither closes nor defers any of them.
- `QAN-BL-VOICE-01` is re-owned to Stage 8B (§5).
- S8B-01 CP1 reconciles the locators after the merge of PR #363.

**D-2 — Architecture.** A streaming cascade with full-duplex management. DeepSeek Flash is the only brain. A
speech-to-speech model is never the brain.

**D-3 — Providers.** The best ASR and the best TTS are chosen on evidence.
- The benchmark is capped at USD 10.
- Nothing is spent before CP1 is approved.

**D-4 — Speech Rendering tools.** Specialised pronunciation and diacritization tools are allowed once their benefit is
proven. They never change QANDEEL's brain or a reply's meaning.

### 1.2 Experience, amendments and devices

**D-6 — Experience and voices.** The direction recommended at S8B-00 is approved (contract §15).
- The speed targets are measured.
- The voices are chosen after listening to real samples.
- There must be a clear path to listen to the original call while it is retained. It respects P4, with the narrowest
  change if P4 conflicts (VA-10).

**D-8 — Amendments.** Controlled amendments are approved in principle. Their actual texts are reviewed inside the tasks that
implement them.

**D-9 — Devices** (amended by the Product Owner).
- No physical iPhone or Mac is available before launch.
- **iOS:** the cloud iOS Simulator on GitHub Actions macOS, with EAS Build / Workflows and Maestro.
- **Android:** a real Android device, for audio, calls, interruption and background.
- **Optional:** a cloud real-iOS device service (for example BrowserStack), when needed. It is not a Stage 8B closure
  condition.
- iOS properties the simulator cannot prove are recorded as Stage 9 launch-readiness evidence and never claimed as tested
  (contract §14; §8 below).

### 1.3 Recording, retention, Replay and destinations

The Product Owner's clarified decisions 1 – 12:

| # | Decision |
|---|---|
| 1 | The Personal Live Call is recorded with its original audio: the user's voice and QANDEEL's voice as actually heard, with its timing and its correct live analysis. |
| 2 | A call recording is kept 30 days from the end of the call. A Voice Note is kept 30 days from its commit. |
| 3 | Within retention, the user can return to the call at any time, listen to it and create a Replay of any allowed part. This is not limited to the moment the call ends. |
| 4 | Listening, or creating, editing, previewing or distributing a Replay, never extends the source's retention. |
| 5 | The private Replay is a draft / preview with technical version data under CW2-05. It is not a permanent private video library. |
| 6 | The user has three independent destinations: `PUBLISH_TO_PUBLIC_WORLD`, `SHARE_EXTERNALLY` and `DOWNLOAD`. |
| 7 | Public publication creates a Public Experience whose playable content is independent of the private recording. The source's 30-day expiry does not withdraw it automatically. It is governed by Public World law, consent withdrawal and privacy. |
| 8 | A copy downloaded to the user's phone, or received by a third party, is not part of the temporary recording store. |
| 9 | No permanent private video copy is kept merely because a Replay was created. Processing files are cleaned up. A durable published copy is created only when its destination needs one. |
| 10 | If the recording expires before a Replay is created or a distribution completes, the expired source is not used, its life is not extended and no substitute audio is invented. |
| 11 | Existing consent, disclosure, privacy, publishing and distribution rights apply. No new power is opened. |
| 12 | Nothing claims the user's microphone kept capturing after a Force-quit. QANDEEL's generated audio is not treated as heard without proof. |

**Cancelled and clarified items:**
- The earlier D-5a (a published video deleted with its source) is **cancelled**.
- D-5c is read within the frozen technical `FINALIZED` state. It is not a permanently stored video.
- CW2-05 and I-06A … D are respected. No second Replay runtime is created.

## 2. What CP1 delivers

| PO CP1 scope item | Delivered | Where |
| --- | --- | --- |
| 1. The Voice Runtime specification | Yes: architecture, call authority, spoken turn, Speech Rendering, gates, devices, adopted experience decisions, task plan | [`docs/voice-runtime-v1.md`](../voice-runtime-v1.md) |
| 2. The contracts for the audio source, timing, retention and Replay | Yes: two tracks on one client clock, confirmed-played QANDEEL audio, anchors, the immutable 30-day expiry, listening, the private Replay, the three destinations, disclosure | contract §6 – §10 |
| 3. The controlled amendments | Yes: VA-1 … VA-10, each quoting the narrowed text, with the task each binds from | [S8B-01 Voice Runtime Controlled Amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md) |
| 4. The non-production measurement harness, test corpus and comparison criteria | Yes: the preregistered plan, two corpora, scoring, the latency model, the stream measurer, the guard, the launcher, simulated providers, a root contract | `scripts/s8b-01/`; `tests/s8b-01-voice-bench-harness-contract.test.mjs` (§4) |
| 5. The locator reconciliation after the merge of PR #363 | Yes | §5 |
| 6. The Project Map and the ownership of `QAN-BL-VOICE-01` | Yes: re-owned to Stage 8B | §5 |

**Not delivered, by the CP1 boundary:**
- production code in `apps/` or `packages/`, and migrations;
- mobile dependencies;
- a provider adapter or a provider call, and a paid run;
- a gate opened;
- any edit to a frozen document. Every narrowing is in the amendment and binds only from its implementing task.

## 3. Frozen authority consumed, not edited

**Consumed:**
- G1.1, G1.2 §1 – §5, G3 §D, P2 Call Rail A, P3 §9, the P4 non-signal Voice visuals and P4-C2 §4 / §5;
- CW2-05 and I-06A … D, CW2-03 §42, CW2-08 and CW2-08A;
- the Foundation runtimes and the fixed-Arabic-copy decision.

**Already foreseen by the frozen texts:**
- the Foundation's `STREAMING` turn state, its `REALTIME` routing mode and its interruption semantics;
- CW2-05's `ORIGINAL_AUDIO`, delivered QANDEEL audio (§6), render-contract versioning (§34 – §35) and the open codec /
  storage (§50);
- I-06C's three destination actions.

So the amendments wire existing designs rather than invent them. The one P4 change (VA-10) reuses P4-C3 §1's frozen
grammar and adds no token, colour, glyph or Surface role.

## 4. The benchmark harness (`scripts/s8b-01/`)

| File | Role |
| --- | --- |
| `bench-plan.json` | The preregistered plan. It is `PROPOSED` until the CP1 review approves it. It holds:<ul><li>candidates, which CP2 re-verifies first</li><li>the corpus protocol and speaker consent</li><li>normalization, metrics, thresholds and selection rules</li><li>the TTS arms and the `ASSISTED` adoption rule (D-4)</li><li>voice selection by listening (D-6)</li><li>the DeepSeek stream probe, Orchestrator overhead and the render spike</li><li>the latency stages and target</li><li>the guard: `authorized: false`, USD 10 split 3.5 / 4.5 / 0.2 / 0.3 / 1.5, no retry</li><li>the corpus hashes</li></ul> |
| `corpus/asr-reading-prompts.json` | Fifteen read and six spontaneous prompts each for MSA, Egyptian, Gulf and Levantine; three recording conditions. Invented content, no user data. |
| `corpus/tts-pronunciation-set.json` | 69 items:<ul><li>30 homographs in context, with the expected reading, including the Egyptian جِدّ / جَدّ reversal against MSA</li><li>8 names</li><li>8 number, date and time forms</li><li>13 dialect sentences</li><li>4 code-switch sentences</li><li>6 QANDEEL-style replies</li></ul> |
| `arabic-text-metrics.mjs` | The preregistered scoring normalization (diacritics, tatweel, alef, alef maqsura, ta marbuta, digits, punctuation) and corpus-level WER / CER. It is used for scoring only, never for user-visible text. |
| `latency-model.mjs` | E + A + P + T + G + R + S + N.<ul><li>The per-stage sums are a **planning budget only** (`WITHIN_PLANNING_BUDGET` / `OVER_PLANNING_BUDGET`), never a bound on the end-to-end p50 / p95 (R1-2).</li><li>The target is decided only by `endToEndVerdict` over complete on-device measurements.</li><li>A stage that was not measured is `MISSING`, and the verdict is `NOT_MEASURED`, never a pass.</li><li>The measured stages are also summed and shown on their own.</li></ul> |
| `stream-first-token.mjs` | Measures time to first token, and G at the first chunk that the VA-2 conditions release, over a Chat Completions SSE stream (R1-1).<ul><li>The conditions are a boundary, `UNREADABLE`, `INTERNAL_CONTAINER`, an unclosed `<` and the `GUIDANCE_ECHO` suffix holdback, mirroring the S8A-01 guard. The root contract pins the mirror.</li><li>The first punctuation mark is kept apart, as a diagnostic only.</li><li>A stream that VA-2 withholds gives no G.</li><li>It keeps no text.</li></ul> |
| `spend-guard.cjs` | A preload on the S8A-02 guard's pattern.<ul><li>In live mode it refuses to load while locked.</li><li>Otherwise only loopback is allowed: every other socket, TLS connection, DNS lookup and `fetch` is refused before any byte leaves.</li><li>Provider variables are scrubbed by name.</li></ul> |
| `bench-launch.mjs`, `bench-run.mjs`, `simulated-providers.mjs` | `--plan-check`, `--simulate` and `--live`.<ul><li>The rehearsal runs the whole scoring path against deterministic simulated providers and a local SSE stream.</li><li>Its report holds rates and instants only.</li><li>`--live` is refused.</li></ul> |

**Results (2026-10-28, local, zero cost):**
- `--plan-check` passed, with the cap at USD 10 and the lock on.
- `--simulate` wrote `artifacts/evals/s8b-01/simulated/report.json`, which is gitignored:
  - 7 ASR candidates × 4 dialects scored;
  - 4 TTS candidates × 2 arms × 69 items;
  - 40 simulated streams measured by the real measurer;
  - planning budget `NOT_MEASURED`, because N is device-only; end-to-end `NOT_MEASURED` (device only);
  - 0 network refusals needed, and 0 paid calls.
- `--live` was refused with exit 3: "Nothing was sent."
- **The simulated numbers are synthetic by construction and are not provider evidence.**

## 5. Governance: register and locators

**BG-05 at kickoff.**
- S8B-01 inherits `QAN-BL-VOICE-01`. It is re-owned to **`Stage 8B — Voice Runtime`**: from `UNASSIGNED` /
  `OPEN — UNASSIGNED` to `DEFERRED — OWNED`, with `HIGH` severity unchanged. Its required properties and the Arabic
  pronunciation handoff are unchanged, and the P4 residues are now addressed by the contract.
- **Read, and left unchanged:**
  - `QAN-BL-AI-01`: real-user enablement, `SYNTHETIC_ONLY`;
  - `QAN-BL-AI-05`: VA-1 builds `stream()` for the spoken path only;
  - `QAN-BL-ACE-02`: "audio expression is Stage 8B";
  - `QAN-BL-LAUNCH-01`: the same trusted-proxy law for the voice connection;
  - `QAN-BL-NOTIF-03` and `QAN-BL-NOTIF-05`;
  - `QAN-BL-PRIV-05`: export includes retained audio;
  - `QAN-BL-ACCT-01`, `QAN-BL-ACCT-03` and `QAN-BL-PROD-09`;
  - `QAN-BL-PROD-08` and `PROD-10`: the photo store pattern;
  - `QAN-BL-CI-01` and `QAN-BL-CI-03`.
- Nothing is admitted or tombstoned at CP1.
- **Latest index:** 89 items; 44 / 4 / 8 / 33 by status; 52 / 35 / 2 by severity (backlog §7).

**Locators.** The S8A-05 entries of `QANDEEL_CURRENT_STATE.md` §0, `QANDEEL_PROJECT_MAP.md` §5 and
`QANDEEL_PRODUCT_ROADMAP.md` now read **`CLOSED / MERGED` through PR #363 as
`8b476114a0f8655bcc39c5af80ded169c691c3f8` (2026-10-27)**. Its closing change is effective, and its bullets stay as written
at that change.

**Stage rows:**
- 8A stays ACTIVE for its remaining work, with S8A-06 … S8A-08 not started.
- 8B is **ACTIVE — S8B-01 CP1 at the Product Owner's review**.
- The Voice / Live Call rows and the register row show the new owner.

## 6. Verification

| Check | Result |
| --- | --- |
| `npm run test:s8b-01-voice-bench-harness-contract` (registered in `package.json` and as an API CI static-contract step, after S8A-01's) | 13 / 13 pass (8 at the first push; 4 focused R1 tests, then 1 for the end-of-stream holdback) |
| `node scripts/s8b-01/bench-launch.mjs --plan-check` / `--simulate` / `--live` | pass / report written / refused (exit 3) |
| `npm run test:task-closure-governance-contract` | 24 / 24 pass |
| Every root contract, `node --test tests/*.test.mjs` (Node 24, local), including the forward-safety mirror | 1654 / 1654 pass (1649 at the first push) |
| The backlog §4 index, recounted mechanically | 89 items; 44 / 4 / 8 / 33 by status; 52 / 35 / 2 by severity — equal to §7 and to Current State §5 |

Four root contracts pin the one current-task line of the Project Map:
- `s5-03b-public-semantic-field-viewer-contract`;
- `s5-03c-public-explicit-relations-integrity-contract`;
- `s7-03-replay-composite-visual-proof-contract`;
- `s7-04-replay-player-navigation-contract`.

They are re-anchored, validation only, as each earlier task did: S8B-01 is current, and S8A-05 stands beneath it as merged
through PR #363. No other assertion was changed.

## 6.1 CP1 review corrections R1 (2026-10-28)

The Product Owner's independent review of PR #364 accepted the scope and the contracts and asked for three bounded
corrections. No product decision and no frozen contract changes.

| # | Correction | Where | Focused proof |
| --- | --- | --- | --- |
| R1-1 | The first punctuation mark is no longer stage G. G is the first chunk the VA-2 conditions release, measured with a predicate that mirrors the S8A-01 guard. The approximate boundary is a diagnostic only, and a withheld stream gives no G. S8B-05 re-measures G through the implemented guard. | `stream-first-token.mjs`, `bench-run.mjs`, `bench-plan.json` (`deepseekStream`, stage G), contract §11 | the mirror pinned against `model-output-release-guard.ts`; a boundary inside an unclosed `<`, a guidance-echo prefix and an internal container are not releasable; a timed stream releases after its first mark; a withheld stream reports no G |
| R1-2 | The per-stage p50 / p95 sums are a planning budget, not a statistical bound. p50 / p95 are decided only by complete end-to-end measurements on the device. | `latency-model.mjs`, `bench-plan.json` (`latency.composition`), contract §11 | a counterexample where the sum of stage p95s (0) is below the end-to-end p95 (100); the planning verdict never claims the target; `endToEndVerdict` decides on device samples |
| R1-3 | Interruption mid-chunk: a cut chunk's text is never committed as spoken, and no word-level alignment is claimed. The played audio up to the confirmed playout position is kept and is the Replay reference. The anchor ends at the cut. | contract §4.3, §6.1, §6.3 | contract text (S8B-05 implements it) |

## 7. What CP2 needs, and what is not decided here

**CP2 prerequisites** (`bench-plan.json` `prerequisitesForCp2`):
- the Product Owner's approval of this checkpoint: the contract, VA-1 … VA-10 in principle, the plan's thresholds, and
  the corpus;
- on the day CP2 starts, every candidate's Arabic support, streaming, zero-retention / no-training terms and price are
  re-verified from its own documentation;
- the Product Owner creates the provider accounts and places the keys in the per-user key file;
- consenting speakers record the ASR prompts;
- no public dataset is used unless the Product Owner approves its name and licence.

**Only after that approval**, CP2 adds the approved provider hosts and per-call worst-case costs to the guard and lifts
its lock, as the single change recorded beside the plan's new hash.

**Not decided here:**
- the providers;
- the voices;
- the codec and render placement;
- the REALTIME budget values.

CP3 decides them.

## 8. Stage 9 launch-readiness evidence (iOS, D-9)

The iOS Simulator cannot prove the following. They will be admitted at S8B-08, with their final list, owned by the Stage 9
release-readiness gate. None is claimed as tested:

- AEC / echo on the iPhone speaker;
- Bluetooth and route changes;
- the CallKit system UI and its Recents exclusion;
- a cellular-call interruption;
- background audio continuity under lock on hardware;
- the real microphone permission prompt;
- on-device latency;
- thermal and battery behaviour.

## 9. CP2 — Gemini TTS & Provider Evidence (2026-10-28)

**Status:** `S8B-01 CP2 DELIVERED — PARTIAL — TTS SELECTION APPROVED`. The one run is consumed: USD 0.1155 of the
USD 10 cap was spent. The Product Owner selected the TTS path after listening (§9.10): Google Gemini TTS,
`gemini-3.8-flash-tts`, voice Achird. The expression set and the second voice were then run on Google Cloud: 592 of 592 calls, USD 0.7950 of
that run's USD 2 cap (§9.9). ASR is `BLOCKED — MISSING PREREQUISITES`, and the render spike awaits the approval to install ffmpeg (§9.11); stage P is deferred to S8B-05. CP2 is not claimed fully closed, and CP3 has not started.  
**Branch / base:** `s8b/s8b-01-cp2`, from `main` at `de774cfd` (the merge of PR #364, S8B-01 CP1).  
**Run:** `s8b01-cp2-r1`, at `1fe1eb9c`, 2026-10-28 06:10 – 06:30 UTC. Its outputs are local and gitignored, under
`artifacts/evals/s8b-01/live/s8b01-cp2-r1/`:
- `report.json`, `samples.csv` and `summary.json`;
- `audio/S####.wav`;
- `listening.html`: every valid sample;
- `listening-pack.html`: a self-contained selection of 48.

### 9.1 The Product Owner's CP2 decisions, and the checks before the first paid call

The decisions:
- **Models.** Evaluate `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts` only. The choice between them waits for
  quality, speed and cost.
- **Architecture unchanged.** DeepSeek Flash is the only brain; Gemini only speaks approved text. There is no Gemini Live
  brain, and no new Orchestrator, Memory or Accounting.
- **Retention.** Zero retention is waived for the two models only, by Controlled Amendment **VA-11**
  ([`QANDEEL_S8B-01_CP2_GEMINI_TTS_RETENTION_EXCEPTION_CONTROLLED_AMENDMENT_v1.0.md`](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_CP2_GEMINI_TTS_RETENTION_EXCEPTION_CONTROLLED_AMENDMENT_v1.0.md)).
  No training stays required, and no real user data is used. VA-11 does not reopen CP1.
- **Budget.** USD 10 across every provider, which is not an approval to spend the Gemini credit in full. No automatic
  retry.

| Check before the first paid call | Result |
| --- | --- |
| `GEMINI_API_KEY` reachable, never printed, sent elsewhere or logged | Present at the Windows user scope. The launcher reads it into its own memory and passes it only to the guarded child process. The scrub admits only this key and `DEEPSEEK_API_KEY`. |
| Model availability for the account | A free metadata GET on each model returned HTTP 200 for both. |
| Google's current prices and terms, read directly | Pricing page, updated 2026-10-27, paid tier. Input: USD 0.50 per 1M text tokens, both models. Output per 1M audio tokens: USD 9 for Flash, USD 6 for Lite. Audio: 25 tokens per second. "Used to improve our products": **No**. The terms are in VA-11 §3. |
| Request format | The Interactions API (`/v1beta/interactions`). The text is sent verbatim, a style only in `speech_metadata`, with `stream: true` and `store: false`. There is no legacy prompt preamble the model could read aloud. |
| Guard | Live mode requires an authorized plan, an APPROVED approval bound to the plan's SHA-256, the matching run id and `--confirm`. It allows https to the two hosts only, and one request per worst-case reservation within each bucket and the cap. The spend state is persisted. |
| Approval, cap, plan hash | `scripts/s8b-01/cp2-approval.json`: run `s8b01-cp2-r1`, USD 10, plan `2fa39d90…`. It is now **CONSUMED**, and a second `--live` is refused before anything is sent. |

### 9.2 What the run reached

Gemini Tier 1 limits each TTS model to **10 requests per minute and 100 requests per day**. Neither limit was in the plan.
- The plan paced requests at 5 s, which is 12 a minute, so some requests were refused with HTTP 429. Those were not
  charged and not retried.
- After 100 accepted requests in the day, the refusals came three in a row, and the fail-fast rule stopped each model at
  **112 calls**.

| | Flash | Flash-Lite |
| --- | --- | --- |
| Calls | 112 | 112 |
| Valid samples | 96 | 95 |
| HTTP 429 | 12 | 12 |
| Invalid input (§9.4) | 4 | 5 |
| Voice reached | Achird only | Achird only |
| Corpus reached | the pronunciation set H01 … R03 (BASELINE, and RENDERED where it differs) | the same |

Not reached on either model:
- the second voice, Sulafat;
- the whole expression set: joy, surprise, joking, empathy and advice, under NO_STYLE / PERSONA / EMOTION. So there is no
  evidence yet on the effect of `speech_metadata`;
- the replies R01 – R06 (R01 – R03 were refused with HTTP 429).

The 24 samples refused with HTTP 429 stay in the run directory as rows with no audio.

### 9.3 Results

Valid samples only, on synthetic text, measured from the developer's machine. Both columns use the Achird voice.

| Measure | Flash | Flash-Lite |
| --- | --- | --- |
| First audio byte, p50 / p95 | 679 / 982 ms | **590 / 750 ms** |
| Complete synthesis, p50 / p95 | 1349 / 1791 ms | **1023 / 1226 ms** |
| Real-time factor, p50 / p95 | 0.48 / 0.65 | **0.34 / 0.48** |
| Largest gap between chunks, p50 / p95 | 51 / 65 ms | 35 / 43 ms |
| Samples with a playback stall (buffer 0 / 200 ms) | 2 / 0 | 0 / 0 |
| Valid audio | 280.6 s | 290.4 s |
| Cost per audio minute, from the reported usage | **USD 0.0136** | **USD 0.0091** |

- **RENDERED against BASELINE.** Timing and cost are the same within noise, for both models.
- **Audio length per character.** The only outlier, on both models, is D03 `15/3/1990` BASELINE. It is longer because the
  date is read from digits. Whether it was read *correctly* is a listening question.
- **Not scored by the harness** (`bench-plan.json` `tts.humanMetrics`): pronunciation, dialect fit, naturalness, and
  whether words were added or dropped. Those are for the Product Owner's listening at CP3.

**DeepSeek stream probe.** `deepseek-flash` with thinking off, 20 synthetic spoken prompts × 2 rounds. All 40 succeeded,
all at the peak price, all finishing on `stop`. None was withheld, and none held text at the end.

| Measure | p50 | p95 |
| --- | --- | --- |
| Headers | 309 ms | 369 ms |
| T (first token) | 690 ms | 903 ms |
| G (first VA-2-releasable chunk, after T) | 136 ms | 243 ms |
| First releasable chunk, from the request | 826 ms | 1070 ms |
| Stream end | 1029 ms | 1319 ms |
| Reply length | 79 characters | 135 characters |

- **By dialect.** Median time to the first releasable chunk: Egyptian 826 ms, MSA 847 ms, Gulf 901 ms, Levantine 943 ms.
- **Cost.** USD 0.0030 for all 40.

**Stage R.** The corpus-oracle rendering takes less than 0.001 ms per item. The real Speech Rendering layer is
re-measured at S8B-04.

**Planning budget.** This is not a statistical bound (§6.1 R1-2).

| Partial sum T + G + R + S | p50 | p95 |
| --- | --- | --- |
| with Flash-Lite | 1416 ms | 1896 ms |
| with Flash | 1505 ms | 2128 ms |

The verdict stays `NOT_MEASURED`, because E, A, P and N are missing. These four stages alone already reach the 1500 ms
p50 target.

*Live-call estimate — **assumptions, not measurements**:*
- endpointing E: 300 – 500 ms;
- ASR final A: 100 – 300 ms;
- stage P: 50 – 100 ms;
- network and playout N: 100 – 200 ms.

On these assumptions, the first audible audio would be about 2.0 – 2.5 s at p50 with Flash-Lite. That is above the 1.5 s
target, so the contract §11 levers would be needed: tuning endpointing, speculative generation on a stable interim
transcript, a shorter first chunk, and a REALTIME `max_tokens`. S8B-05 and S8B-06 measure the real figure.

### 9.4 A harness defect found in the run, and its fix

`renderItem` sent the corpus's expected reading verbatim. For six items that reading is a note for human raters, not
speech text:
- H27, H28 and H30 carry a parenthetical English gloss;
- N04 carries an IPA form, N05 a Latin transliteration, N06 a Latin brand spelling.

So the RENDERED samples of those items asked the model to speak the note:
- 9 samples are excluded as `INVALID_INPUT`. Their USD 0.0042 stays in the spend;
- the other 3 were refused with HTTP 429.

The fix:
- `cp2-providers.mjs`: `readingAnnotated()` detects an annotated reading. The gloss is stripped, and a reading with no
  Arabic-script form is not rendered.
- `cp2-analyze.mjs`: `invalidate()` marks the affected samples.
- A new focused test fails on the old code.

The fix applies to any future run. The consumed run is not repeated.

### 9.5 Not run, and why

| Item | Status | What is missing |
| --- | --- | --- |
| Expression set, the `speech_metadata` effect, voice Sulafat, R04 – R06 | **NOT RUN — QUOTA** (Tier 1: 100 requests per model per day) | A second bounded run with a new Product Owner approval. For example: the 42 expression requests × 2 voices = 84 per model, under the daily 100, paced at ≥ 6.5 s, about USD 0.10. Alternatively the Product Owner raises the tier (billing). Not started. |
| ASSISTED arm | NOT RUN | Not justified by the BASELINE / RENDERED evidence until listening shows a residual error. |
| ASR (stages E and A) | **NOT RUN — MISSING PREREQUISITE** | Recordings from consenting speakers, and the provider accounts. Synthetic speech is never ASR evidence, and no user voice is used. |
| Orchestrator stage P | NOT RUN — DEFERRED WITHIN CP2 | A local PostgreSQL. S8B-05 measures it. |
| Render spike (Replay video feasibility) | **NOT RUN — MISSING PREREQUISITE** | `ffmpeg` is not installed. Installing it needs the Product Owner's approval. |

**ASR provider review.** Each provider's own pages, read 2026-10-28. Zero retention and no training stay **mandatory** for
ASR; VA-11 does not extend to it.

| Provider | Arabic / Egyptian | Retention / training | Price | Qualifies |
| --- | --- | --- | --- | --- |
| Azure AI Speech | `ar-EG`, real-time | Real-time audio is not stored and not used for training. | USD 1 / hour, real-time | **yes**, self-serve |
| Speechmatics | Global Arabic pack, Egyptian included | Real-time audio is never stored; no training by default. | USD 0.80 / hour, Enhanced | **yes**, self-serve |
| Deepgram Nova-3 | `ar-EG` | Retained and used for training **by default**, unless each request sends `mip_opt_out=true`. | USD 0.0048 / min (promotional) | only with the opt-out on every request |
| Google Chirp 3 | `ar-EG`, in Preview | Zero retention is not stated explicitly. | — | not shown |
| Soniox | Egyptian not documented | — | — | no |
| OpenAI | Arabic dialects not stated | Zero retention needs sales approval. | — | no |
| ElevenLabs | — | Zero retention is enterprise-only. | — | no |

### 9.6 Spend

| Bucket | Settled USD | Budget USD |
| --- | --- | --- |
| tts (226 reservations: 2 free preflights + 224 calls) | 0.1125 | 4.5 |
| deepseekStream (40) | 0.0030 | 0.2 |
| asr | 0 | 3.5 |
| speechRenderingTools | 0 | 0.3 |
| **Total** | **0.1155 of 10** | |

- Every one of the 266 reservations was settled.
- None was refused, none overran its worst case, and there was no retry.
- Every Gemini cost came from the usage the API reported.

### 9.7 For the Product Owner, at CP3

**What the evidence shows so far.** Flash-Lite is the better candidate on every objective measure: faster first audio, a
lower real-time factor, steadier chunking, and a third cheaper per minute. Any advantage Flash has can only be in quality.
`listening-pack.html` and `listening.html` let the pair be compared side by side.

**What the choice needs:**
1. The Product Owner's listening: Egyptian speech, names, numbers, homographs.
2. The expression run that r1 did not reach. It is the only evidence on emotion, on `speech_metadata` and on the second
   voice.

No voice and no model is chosen here.

**Open items:**
- The Product Owner confirms that AI Studio request logging is **off** for the `QANDEEL` project (VA-11 §3).
- The pacing and quota of any further run.

### 9.8 Google Cloud PayGo check (the Product Owner's order and approval, 2026-10-28)

This was a separate bounded check, not a CP2 re-run. CP2's approval stays `CONSUMED`.

**Setup:**
- **Approval:** `scripts/s8b-01/gcp-paygo-approval.json`, now `CONSUMED`. Run `s8b01-gcp-paygo-r1` at `2dfe8757`. Plan `14423873…`, verified before the run. Cap USD 0.25.
- **Route:** project `gen-lang-client-0473671267`, location `global`, `streamGenerateContent` on `aiplatform.googleapis.com`.
- **Credential:** the Application Default Credentials (ADC) access token, held in memory only.
- **Request:** one invented sentence (not a CP2 sample), voice Achird, no style. One request per model, no retry.
- **Outputs:** gitignored, under `artifacts/evals/s8b-01/gcp-paygo/s8b01-gcp-paygo-r1/`.

| | Flash | Flash-Lite |
| --- | --- | --- |
| Result | HTTP 200, audio received | HTTP 200, audio received |
| First audio byte / end of stream | 1000 / 2046 ms | 632 / 1240 ms |
| Audio / chunks / largest gap | 4.44 s / 59 / 46 ms | 3.48 s / 50 / 38 ms |
| Usage (text in / audio out tokens), `trafficType` | 20 / 111, `ON_DEMAND` | 20 / 87, `ON_DEMAND` |
| Cost, promotional price (2026) / list price (2027) | USD 0.00101 / 0.00202 | USD 0.00053 / 0.00106 |

| Question | Finding |
| --- | --- |
| **Access** | **Proven.** Both models are callable from the project in `global`. |
| **Billing** | The project is linked to the open billing account `My Billing Account`. Whether the USD 300 promotional credit covers the cost is **UNVERIFIED**. Cost data appears in Cloud Billing reports with a delay, and the Cloud Billing API exposes no cost or credit. Google states that the Free Trial credit can be applied to Gemini platform usage, and that it **cannot** pay for Gemini API usage in AI Studio. |
| **Capacity** | **Not proven, and two calls cannot prove it.** Google publishes no numeric quota for these Preview models, and its Standard PayGo tiers "don't apply to preview models". Guaranteed higher capacity goes through Google's sales team. |
| **Latency** | One cold request per model, so it is an indication only. Flash-Lite's 632 ms is near its AI Studio p50 (590 ms). Flash's 1000 ms is above its AI Studio p50 (679 ms) and near its p95 (982 ms). No route difference is established. |

**Spend:** USD 0.0015 at the promotional price, and USD 0.0031 at the list price, which is what the guard settled.

### 9.9 Full Gemini TTS evaluation on Google Cloud (the Product Owner's order and approval, 2026-10-28)

This is the TTS part of CP2, completed through Google Cloud. It is not a new checkpoint. The CP2 run `s8b01-cp2-r1` (§9.2) and
the PayGo check (§9.8) stay `CONSUMED`. DeepSeek streaming, the ASR research and the Replay render were not repeated, and
neither was the billing investigation, which the Product Owner deferred.

**A — the set, reviewed and corrected before any paid call (`scripts/s8b-01/cp2-worklist.mjs`):**
- **The gloss defect (§9.4) stays fixed.** A reading that carries a gloss, an IPA, a Latin transliteration or `=` is never
  substituted. H27, H28, H30 and N04 – N06 are sent as BASELINE only: their RENDERED arm would equal BASELINE.
- **An automated review guards the run.** The plan check refuses to start on any defect. The review requires:
  - every text is Arabic speech, with no annotation mark, no inline-tag bracket, and no Latin word its own item lacks;
  - RENDERED differs from BASELINE only by diacritics on its target, which is one whole word (a one-letter proclitic is
    allowed: «وضحى»), or a number span replaced by words;
  - a style travels only in `speechMetadata.style`, a short English style, on PERSONA and EMOTION only;
  - an expression item has the same text in its three variants;
  - no duplicate (item, arm), and no two identical requests.
- **Defects found and fixed:**
  - two review false positives (tanween in H03 / H24; a proclitic in N03, N07, N08), fixed in the review, not in the set;
  - one real duplication: the six replies (R01 – R06) were planned both as SET BASELINE and as expression NO_STYLE. These
    are identical requests. The NO_STYLE copies were removed, and a reply's no-style reference is its BASELINE.
- **The real count, not an assumed 628:** 148 texts (69 BASELINE, 43 RENDERED, 10 NO_STYLE, 16 PERSONA, 10 EMOTION) × 2
  models × 2 voices = **592 calls**.

**B — the run:**
- **Approval:** `scripts/s8b-01/cp2-cloud-approval.json`, now `CONSUMED`. Plan `5a6ac838…`, verified at `7a516185` before the
  run; run `s8b01-cp2-cloud-r1` at `2e0ac38e`.
- **Route:** project `gen-lang-client-0473671267`, `global`, `streamGenerateContent`, ADC token in memory only.
- **Models:** `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts`.
- **Voices:** Achird and Sulafat.
- **Guard:** cap USD 2; each call reserved its API ceiling (request bytes + 16,384 output tokens, at list price).
- **Order:** categories in round robin, the two models strictly alternating, the voices balanced.
- **Pacing:** at least 6.5 s between two calls to the same model (Product Owner).
- **Retries:** none.
- **Time:** 11:09:20 – 11:41:24 UTC, 32.1 minutes, against an estimate of 32.
- **Outputs:** gitignored, under `artifacts/evals/s8b-01/cloud/s8b01-cp2-cloud-r1/`:
  - `report.json`, `samples.csv` and `summary.json`;
  - `audio/C####.wav`, 592 files;
  - `listening.html`: every sample, by section;
  - `listening-pack.html`: self-contained, the start-here and flagged sections.

**Coverage: complete.** Required 592, executed 592, OK 592. There were:
- no errors, no HTTP 429 and no stream cancelled at its bound;
- no stop rule triggered;
- 0 calls not reached.

Per model: 120 homograph, 26 name, 32 number, 26 dialect, 8 code-switch, 24 reply and 60 emotion calls.

**Results.** Synthetic text, measured from the developer's machine.

| Measure | Flash | Flash-Lite |
| --- | --- | --- |
| First audio byte, p50 / p95 | 671 / 782 ms | **391 / 569 ms** |
| Complete synthesis, p50 / p95 | 1434 / 2007 ms | **986 / 1415 ms** |
| Real-time factor, p50 / p95 | 0.43 / 0.57 | **0.29 / 0.43** |
| Largest gap between chunks, p50 / p95 | 48 / 112 ms | 39 / 80 ms |
| Playback stalls (200 ms buffer) | 0 | 0 |
| Audio | 1046.8 s | 1049.4 s |
| Cost per audio minute, list price (2027) / promotional (2026) | USD 0.0273 / 0.0136 | **USD 0.0183 / 0.0091** |

| Model · voice | First audio p50 / p95 | Complete p50 / p95 | Audio |
| --- | --- | --- | --- |
| Flash · Achird | 655 / 764 ms | 1413 / 1944 ms | 508.7 s |
| Flash · Sulafat | 677 / 797 ms | 1475 / 2049 ms | 538.0 s |
| Flash-Lite · Achird | 390 / 572 ms | 965 / 1302 ms | 510.8 s |
| Flash-Lite · Sulafat | 391 / 560 ms | 987 / 1426 ms | 538.6 s |

- **The voice changes neither model's speed.** Sulafat speaks about 5 % longer than Achird on both models.
- **Style lengthens the speech, and the latency grows with it.** Complete-synthesis p50 for Flash is 1.85 s with PERSONA and
  1.81 s with EMOTION, against 1.38 s for BASELINE. For Flash-Lite it is 1.20 s and 1.26 s, against 0.94 s.
- **First audio does not change with style.**
- **Style length against the same text without a style (p50):**
  - PERSONA: Flash 1.11, Flash-Lite 1.02;
  - EMOTION: 1.12 on both models;
  - range 0.79 – 1.45.
- **Against AI Studio (§9.3, Achird, the pronunciation set):** Flash-Lite's first audio p50 is 390 ms on Cloud, against
  590 ms on AI Studio. Flash's is 655 ms, against 679 ms. One run per route and different hours, so this is an indication,
  not a route comparison.

**Flagged for listening.** The harness scores no pronunciation, dialect or naturalness. All of these are in the
`listening.html` section "Flagged by the measures":
- **H04 RENDERED, Flash · Achird (`C0185`):** 2.44 s, against 3.6 – 3.8 s for the other three. This could be a dropped word.
- **D03 `15/3/1990` BASELINE:** 3.6 – 6.0 s across the four (`C0121` – `C0124`). Flash-Lite · Achird is the longest. The date
  is read in different forms.
- **Emotion styles that shortened the speech:** X01 JOY (0.84 on Flash · Sulafat and Flash-Lite · Achird) and X04 SURPRISE
  (0.90 – 0.96). Did the style register?
- **Emotion styles that lengthened it most:** X02, X06 and X07 (up to 1.45).
- **Egyptian colloquial:** E01, N05 and C02 are the fastest speech of the run. Listen for clipped words.
- **Persona consistency:** R01 – R06 BASELINE against PERSONA. Flash lengthens the persona by about 11 %; Flash-Lite barely
  changes it.

**Spend.** The guard settled **USD 0.7950** at the list price, of the USD 2 cap. That was 592 reservations and 592
settlements, with no refusal, no overrun and no blocked request. At the promotional price it is about USD 0.3975, and the
estimate was USD 0.8293 at list. CP2 in all, at list price: USD 0.1155 (AI Studio) + 0.0031 (PayGo check) + 0.7950 (this
run) = **USD 0.9136**. Whether the USD 300 credit covers it is **UNVERIFIED** (§9.8).

**Not decided here:** no model, voice or provider was selected by this run, and no Voice Quality Router exists. The Product
Owner chose one voice path and one final model after listening (§9.10). CP3 has not started.

### 9.10 The Product Owner's TTS selection — APPROVED (2026-10-28)

The Product Owner made this selection after listening to the §9.9 samples and reviewing §9.3, §9.8 and §9.9. It is recorded
as given.

| Decision | Value |
| --- | --- |
| **TTS provider** | Google Gemini TTS |
| **Model** | `gemini-3.8-flash-tts` |
| **Voice** | Achird (male) |
| **Path** | One TTS path only. No Voice Quality Router, no per-turn model or voice switching, no fallback model. |
| **Status** | `APPROVED` |

**Style:**
- Qandeel's persona is friendly and natural.
- Emotional expression is balanced and never exaggerated.
- The Product Owner's listening ratings, adopted (given with the ASR & Replay order, 2026-10-28):

| Sample | Rating |
| --- | --- |
| X05 EMOTION | excellent |
| X07 EMOTION | overdone and unnatural |
| R01 PERSONA | very good |
| X01 / X04 EMOTION | better than their no-style versions |
| D03 RENDERED | much better than reading the date from digits |
| Numbers in general | acceptable for now |

- The samples rated, on the selected model and voice:

| Item | NO_STYLE / BASELINE | PERSONA | EMOTION |
| --- | --- | --- | --- |
| X01 JOY | `C0025` | `C0055` | `C0081` |
| X04 SURPRISE | `C0255` | `C0279` | `C0303` |
| X05 JOKING | `C0321` | `C0335` | `C0345` |
| X07 EMPATHY | `C0383` | `C0391` | `C0399` |
| R01 reply | `C0023` (BASELINE) | `C0177` | — |

**Speech Rendering:**
- It stays, for dates and for pronunciation: selective diacritics on homographs and names, with no gloss or reading note
  ever spoken (§9.4).
- The current quality of numbers is accepted.

**Evidence for the selected path** (Flash · Achird, §9.9, 148 calls, all OK):
- first audio p50 / p95: 655 / 764 ms;
- complete synthesis p50 / p95: 1413 / 1944 ms;
- no playback stall;
- USD 0.0273 per audio minute at the list price (2027), and USD 0.0136 at the promotional price (2026).

Flash-Lite was faster and cheaper on every objective measure (§9.9). The Product Owner chose Flash on listening.

**No further paid TTS run** is needed to choose the model or the voice.

**Kept, not deleted:**
- the results of both models and both voices: §9.3, §9.8, §9.9, and the gitignored run directories, audio included;
- the expression corpus, including its persona and emotion styles. They stay evaluation inputs; the selection does not
  make them production copy.

**Two production requirements follow** (Product Owner, 2026-10-28). They are recorded in `docs/voice-runtime-v1.md` §5 and
§16, in S8B-04's scope, with the contextual expression carried on S8B-05's realtime path. Both are **NOT IMPLEMENTED**.
No TTS sample marks them done.
1. **Contextual expression.** QANDEEL chooses its spoken expression from the conversation's context: calm, empathy,
   playfulness, humour, enthusiasm or seriousness. It stays balanced, never exaggerated.
2. **Selective contextual vocalization** through Speech Rendering: by meaning and context, for names, dates and ambiguous
   words.

**What the selection does not do:**
- **No production code.** No adapter, configuration, voice constant or feature gate. Implementing the voice belongs to
  S8B-04 under `QAN-BL-VOICE-01`, with VA-11 §4's obligations.
- **VA-11 is unchanged.** It still names both models. Only the selected model is on the TTS path.
- **No gate opened.** Every voice gate stays closed, and Voice stays closed to users.
- **ASR is not selected**, and neither are the codec, the render placement or the REALTIME budget values. CP2 / CP3 settle
  them (§9.5, §7).

**Open, for the Product Owner:**
1. **The production route.** The evidence used two routes: AI Studio (the Gemini API key, §9.2) and Google Cloud (the
   Agent Platform with ADC, §9.8 – §9.9). VA-11 §4's obligations (`store: false`, the server-only key, the re-verification of
   Google's terms) are worded for the Gemini API. Which route production uses, and that route's retention terms, are for
   S8B-04 to settle with the Product Owner. The selection does not decide it.
2. **AI Studio request logging off** (VA-11 §3, §9.7). This still applies if the AI Studio route is used.

### 9.11 ASR evidence and the Replay render spike (the Product Owner's order, 2026-10-28)

These are the two remaining CP2 parts, inside CP2. Gemini TTS and the DeepSeek stream probe were not repeated, and no
provider was called. **Nothing was spent.**

**A — ASR: `BLOCKED — MISSING PREREQUISITES`.** `bench-plan.json` keeps its frozen `asr.cp2.status` (`NOT RUN — MISSING
PREREQUISITE`): the plan is hash-bound to the consumed CP2 approval.

**The candidates, from each provider's own documentation** (read 2026-10-28; the privacy clauses were re-read directly):

| | Azure AI Speech | Speechmatics | Deepgram Nova-3 |
| --- | --- | --- | --- |
| Egyptian / MSA | `ar-EG` locale for real-time, fast and batch | one `ar` pack naming MSA, Gulf, **Egyptian** and Levantine | `ar-EG` code (monolingual) |
| English inside Egyptian speech | weak: language ID does not switch within a sentence | **`ar_en` bilingual pack**: Arabic and English in one stream | `language=multi`; Arabic dialect coverage unstated |
| Names, numbers, dates | phrase list (2,000; ar-EG support unverified); custom speech for ar-EG | `additional_vocab` (20,000); Arabic formatting "best-effort" | keyterms (500 tokens, extra cost); Arabic formatting unstated |
| Hesitation | not documented | `remove_disfluencies`, Arabic included | filler words: English only |
| Noise | no documented claim | no documented claim | marketing only |
| Streaming partials / endpointing | interim results; segmentation silence 100 – 5000 ms | partials; `max_delay` 0.7 – 4 s; end-of-utterance trigger | interim results; endpointing; utterance end |
| Price, streaming / batch | USD 1.00 / 0.18 per hour | USD 0.80 (Enhanced) / 0.75 per hour; Standard 0.45 | USD 0.0048 / 0.0043 per minute (promotional) |
| Free | F0: 5 hours a month, real-time | USD 100 credit (12 months) | USD 200 credit |
| Region | EU, **UAE North**, Qatar Central | EU, US, AU | US, EU |

**Privacy — the deciding condition.** Zero retention with no training is mandatory for ASR; VA-11 is Gemini TTS only.

| Provider | Verdict | What must hold on every request |
| --- | --- | --- |
| **Speechmatics** | **PROVEN WITH SETTINGS** | Real-time audio is never recorded or stored; it is processed in memory. Batch jobs are kept 7 days: QANDEEL deletes each job through the API at once. No training unless the workspace opts in (Terms §10.4): the "model training" setting stays off. |
| **Azure AI Speech** | **PROVEN WITH SETTINGS, with one gap** | Real-time and fast transcription are not stored. Audio logging is off by default and must never be enabled; batch uses QANDEEL's own storage with a time-to-live, or deletion. **Gap:** the speech-to-text privacy page states no explicit "not used for training". It follows from no retention, and Microsoft's DPA must be checked before selection. |
| **Deepgram** | **PROVEN ONLY WITH A PER-REQUEST FLAG, NOT BY DEFAULT** | By default, audio and transcripts are retained for model improvement. `mip_opt_out=true` on every request limits content to processing time; one missed flag breaks the condition. |

**The two candidates to test: Speechmatics, then Azure.**
- Speechmatics is the only one that names Egyptian, has an Arabic–English code-switching pack and handles Arabic
  hesitation.
- Azure has an explicit `ar-EG` locale, a UAE region and the lowest batch price. Its weakness, English words inside a
  sentence, is exactly what the recordings measure.
- Deepgram is kept in reserve: its privacy depends on a flag the default omits.
- Noise robustness and real Egyptian accuracy are proven by no provider's documentation, only by the recordings.

**What was prepared (free, local):**
- `corpus/asr-cp2-recording-script.json`: the organised session. It reuses the hash-pinned Egyptian and MSA prompts
  unchanged and adds 30 lines:
  - English words inside Egyptian and MSA speech, each word scored in Latin or a listed Arabic spelling;
  - names, numbers and dates, with key terms;
  - hesitation, self-correction and self-interruption, scored verbatim with the intended value beside it;
  - an OVERLAP condition: QANDEEL's selected voice plays from a second device while the speaker talks.

  Conditions are QUIET, SPEAKER, NOISE and OVERLAP. There is an Arabic consent text, and speakers are anonymous codes.
- `asr-recording-sheet.mjs <S1|S2…>`: the printable Arabic session sheet. 130 named files per speaker, about 11 minutes
  of speech: Egyptian 79, MSA 51.

**What the Product Owner provides:**
1. At least 2 consenting native Egyptian speakers, one female and one male (4 preferred). Each records the 130 lines of
   their sheet, with consent kept outside the repository. The files go to `artifacts/evals/s8b-01/corpus/<S#>/`
   (gitignored).
2. A Speechmatics account (self-serve, EU region, model training off) and an Azure Speech resource (UAE North or West
   Europe, F0 or S0, audio logging untouched). The keys go in the per-user key file, never in the repository.
3. ffmpeg (below), which converts the phone recordings to the scored 16 kHz WAV.
4. Then an independent ASR spend plan, prepared when the recordings exist, for explicit approval. It covers the two
   providers' streaming and batch adapters, the scoring already in the harness, and a cap. A rough size: 2 speakers ×
   about 12 minutes × 2 providers × 2 modes ≈ USD 1.10 at list price, likely inside the free credits.

   No adapter is written yet, and no ASR call is made.

**B — Replay render spike: `BLOCKED — AWAITING THE PRODUCT OWNER'S APPROVAL TO INSTALL FFMPEG`.**

ffmpeg / ffprobe are not installed.

**The official route:** ffmpeg.org publishes source only, and its download page links the Windows builds of gyan.dev and
BtbN. The proposal:
- gyan.dev's `ffmpeg-release-essentials.zip`, release 9.0.2 (2026-09-19), 109 MB;
- verified against gyan.dev's published `.sha256`;
- extracted to a tools folder outside the repository, not added to the system PATH (`QANDEEL_FFMPEG_DIR`).

The build includes libx264, libopus, libfribidi, libharfbuzz and libfreetype, and ffmpeg's native AAC encoder. Not
installed.

**The spike is ready:** `replay-render-spike.mjs <cloudRunDir> <outDir>`, local and synthetic.
- **The call (31.4 s), on one clock (§6.1):**
  - a USER track (synthesized Sulafat speech, a stand-in; never a human voice) and a QANDEEL track (the selected Achird);
  - a QANDEEL reply cut at 55 % by a barge-in that starts 300 ms before the playout stops. Only the played part is on
    the track (§4.3 – §4.4);
  - a 1.5 s reconnection gap, left as a gap (§6.2).
- **The source:** two mono Opus tracks (§9.2).
- **The render:**
  - the tracks mixed on the shared clock;
  - a simple visual sequence from the unit anchors. This is a placeholder for the bound analytical projection, not the
    Living Analysis grammar;
  - derived captions (CW2-05 §40);
  - output in H.264 Main / yuv420p + AAC-LC, in MP4 with faststart, 720 × 1280 at 30 fps.
- **The checks:**
  - the codec profile and faststart;
  - audio / picture sync at the start and the end, within one frame: a calibration beep and a white frame at the same
    instants;
  - the timeline held;
  - the sources unchanged by rendering (hashes): rendering touches no source, so no retention;
  - the processing files deleted on completion (§9.1);
  - render time, CPU time, peak memory and file size.
- **The phone check:** playing the MP4 on an Android device or the emulator. No device was connected on 2026-10-28.
- Retention start, the 30-day expiry, the on-demand rule and the Public World lifecycle are contract rules (§7, §9). The
  spike neither implements them nor changes them.

The focused contract covers the recording kit and the spike's pure functions without ffmpeg: `tests/s8b-01-voice-bench-harness-contract.test.mjs`, 38 / 38.
