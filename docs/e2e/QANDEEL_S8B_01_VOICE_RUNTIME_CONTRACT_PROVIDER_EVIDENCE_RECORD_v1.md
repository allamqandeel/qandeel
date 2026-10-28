# QANDEEL — S8B-01 Voice Runtime Contract & Provider Evidence — Implementation Record v1

**Task:** S8B-01 — Voice Runtime Contract & Provider Evidence (Stage 8B). This record covers **CP1 — the contract, the
amendments, the benchmark harness and the locator reconciliation** (§1 – §8) and **CP2 — the Gemini TTS and provider
evidence** (§9), with the full TTS evaluation on Google Cloud (§9.9). CP3, the closure, has not started; both selections were made by the Product Owner in CP2 (§9.10, §9.21).
**Status:** `S8B-01 CP1 MERGED (PR #364, de774cfd) — CP2 COMPLETE — READY FOR THE PULL REQUEST, NOT OPENED (§9.22) — TTS SELECTION APPROVED BY THE PRODUCT OWNER (2026-10-28, §9.10) — ASR SELECTION APPROVED BY THE PRODUCT OWNER: SPEECHMATICS ENHANCED AR_EN (2026-10-28, §9.21), THE PROOF VERDICT NOT ACCEPTED (5 / 6) KEPT, ON-DEVICE BARGE-IN A BLOCKING LAUNCH CONDITION FOR CALLS — NO PRODUCTION CODE — USD 0.1155 OF THE USD 10 CAP — ONE RUN, CONSUMED — FULL TTS EVALUATION ON GOOGLE CLOUD COMPLETE (592 / 592, USD 0.7950 OF ITS USD 2 CAP, CONSUMED) — TTS: GOOGLE GEMINI TTS, `gemini-3.8-flash-tts`, VOICE ACHIRD, APPROVED — NO PRODUCTION CODE FOR EITHER SELECTION — EVERY VOICE GATE CLOSED / CLOSED TO USERS`. S8B-01 is not closed: CP2 is complete (§9.22) and CP3 has not started, and BG-08 / BG-09 are reconciled at S8B-01's last checkpoint, not here.  
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

**Status:** `S8B-01 CP2 COMPLETE — TTS SELECTION APPROVED — ASR SELECTION APPROVED (SPEECHMATICS ENHANCED AR_EN, §9.21) — STAGE P MEASURED LOCALLY (§9.22) — READY FOR THE PULL REQUEST, NOT OPENED`. The one run is consumed: USD 0.1155 of the
USD 10 cap was spent. The Product Owner selected the TTS path after listening (§9.10): Google Gemini TTS,
`gemini-3.8-flash-tts`, voice Achird. The expression set and the second voice were then run on Google Cloud: 592 of 592 calls, USD 0.7950 of
that run's USD 2 cap (§9.9). ASR, at first `BLOCKED — MISSING PREREQUISITES`: Speechmatics only, by the Product Owner's decision, prepared and awaiting the account, the key and the recordings (§9.12), then simplified by the Product Owner to their own 20 recordings, Enhanced `ar_en` only, a preliminary single-speaker test (§9.13); the 20 recordings arrived as WhatsApp Ogg Opus (§9.14), were converted with the approved ffmpeg and checked, and the one approved run (plan `3fd6a842…`, USD 0.0345) gave the preregistered verdict `NOT ACCEPTED` and the recommendation `NOT READY` for production, a preliminary single-speaker test (§9.16, §9.17); the Product Owner waived the English and name items (`PO ACCEPTED WITH WAIVER`, the results unchanged), and the engineering review found the latency solvable by a QANDEEL-owned endpoint with `ForceEndOfUtterance` and sample 20 unrepresentative of the contract's echo-cancelled barge-in path, with a small proof proposed (§9.18); the Product Owner's final engineering proof (12 sessions, `max_delay` 0.7 with QANDEEL's VAD and `ForceEndOfUtterance`, plan `6ba458f4…`, cap USD 0.10) was approved and run once (USD 0.0201): `NOT ACCEPTED` on overlap alone, latency solved (text ready p50 680 ms, forced answer p50 164 ms, no word lost or repeated across a thinking pause), Speechmatics recommended for production integration conditionally, with on-device barge-in as a blocking pre-launch gate (§9.19, §9.20); the Product Owner then SELECTED Speechmatics Enhanced `ar_en` with seven limits, the verdict kept, barge-in on a real device a condition blocking the launch of calls (§9.21); the render spike ran locally, all eight checks passed, phone playback not verified on a device (§9.15); stage P was then measured locally by the Product Owner's decision (§9.22: p50 8.4 ms, p95 17.4 ms on a local PostgreSQL; 137 / 172 ms with an assumed 20 ms per data request). CP2 is complete and ready for its pull request, not opened (§9.22), and CP3 has not started.  
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

### 9.12 Speechmatics real-time ASR — prepared, awaiting the Product Owner's prerequisites (2026-10-28)

**The Product Owner's decision (2026-10-28):**
- Speechmatics alone is tested, with the aim of approving it for production if it proves its quality, its speed and the
  privacy conditions. A satisfactory result goes to production without reopening the provider comparison.
- Google, Azure and Deepgram are not tested now, and Gemini TTS is not re-tested.
- The test is real-time streaming ASR, not only file transcription.
- It starts with a representative human set of about 25 – 30 lines per speaker, a man and a woman, each with explicit
  consent, instead of the 130 lines of §9.11.

**The model and configuration, from Speechmatics' own documentation** (read 2026-10-28):

| | Enhanced `ar_en` | Melia 1 |
| --- | --- | --- |
| Language | the Arabic–English bilingual pack: "Arabic and English in the same media file or stream"; Arabic covers MSA and the Gulf, Egypt and the Levant | `language: multi` with `language_hints: ["ar", "en"]`; no `ar_en` pack |
| End of utterance | `conversation_config.end_of_utterance_silence_trigger` (0 – 2 s) | **not supported**: the client sends `ForceEndOfUtterance` |
| Latency control | `max_delay` 0.7 – 4 s, `max_delay_mode` | **not supported** |
| Custom dictionary | `additional_vocab` (up to 20,000) | **not supported** |
| Partials | yes | yes |
| Real-time price | USD 0.80 per hour | USD 0.40 per hour |

- **Test configuration, the production candidate:** Enhanced `ar_en` with:
  - partials on;
  - `max_delay` 1.0 s, `flexible`;
  - end of utterance after 0.5 s of silence;
  - the set's names as `additional_vocab`.

  It is the only configuration that has code-switching in one stream, server-side end-of-speech detection and a custom
  dictionary together.
- **The comparison the Product Owner named:** Melia 1, with `ForceEndOfUtterance` sent 500 ms after the measured speech
  end, which stands in for QANDEEL's own VAD.
- **Endpoint:** `wss://eu.rt.speechmatics.com/v2` (EU, pinned).
- **Audio:** raw `pcm_s16le` at the recording's own rate, in 20 ms frames, streamed at real-time pace.

**Privacy, from Speechmatics' own pages** (read directly, 2026-10-28):
- **Real-time:** audio is "never recorded or stored"; it is processed in memory, and the transcripts are returned and
  discarded (Security and compliance).
- **Training:** Terms of Service §10.4. No use of customer data for machine learning or model training unless the
  workspace opts in through its model-training setting. The pricing page states that the opt-in (a 33 % discount) is off by
  default.
- **The run therefore requires:**
  - the model-training setting **off**, confirmed by the Product Owner in the approval (`modelTrainingOff: true`; the
    launcher refuses without it);
  - real-time only. No batch job is ever created, so nothing waits out the batch retention of 7 days;
  - the EU endpoint;
  - no translation, speaker identification or audio events.

**What is prepared (free, local, nothing sent):**
- **The 30-line set** (`asr-cp2-recording-script.json` `sets.core`; sheets `asr-recording-sheet.mjs <S#> --set core`):
  - 22 Egyptian lines on the speaker phone: everyday speech, English words, names / numbers / dates, hesitation,
    self-correction and self-interruption;
  - 3 noise lines and 2 lines with QANDEEL's voice playing (barge-in). Each repeats a speaker-phone line, so the condition
    is compared on the same words;
  - 1 spontaneous answer, scored against the speaker's own transcript;
  - 3 MSA lines;
  - recordings in WAV, at any common rate. Another format needs ffmpeg, which is not installed.
- **The harness** (`asr-sm.mjs`, `asr-sm-run.mjs`, `asr-sm-summary.mjs`):
  - one real-time session per line and arm, the key in the handshake header, no retry;
  - the measures: WER / CER, the checks (names, numbers in digits or words, the intended word of a self-correction,
    English words in either script), first partial, last final, E (end of utterance after speech end), A (final after the
    end of utterance), and the final's lag;
  - the preregistered acceptance, for the Enhanced `ar_en` arm:

| Measure | Threshold |
| --- | --- |
| Egyptian WER | ≤ 0.25 |
| MSA WER | ≤ 0.12 |
| WER in noise | ≤ 0.35 |
| Each check | ≥ 80 % |
| First partial p50 | ≤ 1000 ms |
| E p50 | ≤ 900 ms |
| A p50 | ≤ 300 ms |
| Session errors | none |

- **The guard:** `spend-guard.cjs` now admits a WebSocket exactly like a fetch: an allowed host, `wss` only, and one
  session per reservation. Every other provider key is scrubbed.
- **The plan:** `asr-sm-plan.json`, hash `e6b233b62675ca18009cc14ddef693afee1478bc14f2e92d188b8286e44379be`:
  - 120 sessions = 30 lines × 2 speakers × 2 arms;
  - cap USD 1; every session at its ceiling totals USD 0.94;
  - expected about USD 0.15 and about 15 minutes, inside Speechmatics' free credit.
- **The approval:** `asr-sm-approval.json` is `PENDING`, so `--live` is refused.
- **Tests:** `tests/s8b-01-voice-bench-harness-contract.test.mjs`, 42 / 42, covering:
  - the plan and its refusals;
  - the guard's WebSocket rules;
  - a session against a loopback server (the header, the pacing, partials, finals, end of utterance);
  - the scoring and the verdict.

**Status: `BLOCKED — MISSING PREREQUISITES`.** The Product Owner provides:
1. A Speechmatics account (self-serve, free credit, no card) with the workspace **model-training setting off**.
2. An API key, saved by the Product Owner in `~/.qandeel/speechmatics-api-key.txt` and never pasted into a conversation
   or the repository.
3. The two consenting speakers' 30 recordings each, from `recording-sheet-S1-core.html` / `-S2-core.html`, in
   `artifacts/evals/s8b-01/corpus/S1/` and `/S2/`. The spontaneous answer's own transcript goes beside it as a `.txt`.
4. Then `asr-sm.mjs --plan-check` verifies the 60 files, and the Product Owner approves the plan hash, the USD 1 cap and
   the run `s8b01-cp2-asr-sm-r1`, confirming model training off.

**The recommendation** (`APPROVE FOR PRODUCTION` or `NOT READY`) follows that one run. None is given before it.

**The Replay render spike** is unchanged (§9.11). It is ready and awaits the approval to install ffmpeg.

### 9.13 ASR recording simplification — the Product Owner's 20 recordings, Enhanced `ar_en` only (2026-10-28)

**The Product Owner's decision (2026-10-28)** replaces the two-speaker set of §9.12:
- one sheet of 20 sentences across everyday Egyptian, English inside Egyptian, names and numbers, MSA, hesitation, noise and
  interruption;
- the Product Owner records each sentence on their own phone, one file each, named `01` … `20`, in
  `artifacts/evals/s8b-01/corpus/PO/`;
- the phone's natural format is accepted when it converts locally; WAV is not required;
- Speechmatics Enhanced `ar_en` only, streamed at real-time pace over the WebSocket (Melia 1 is dropped);
- a new plan, reservation, cap and hash for 20 recordings; the previous plan and approval record are not used;
- **the results are a preliminary single-speaker test.** They are never reported as showing performance for all users,
  voices, phones or rooms;
- no call before the recordings are reviewed and the run is approved.

**The 20 lines** (`asr-cp2-recording-script.json` `sets.po20`; the sheet is `asr-recording-sheet.mjs --po`, which writes
`recording-sheet-PO-20.html`), each taken by id from the existing items or the pinned reading prompts, so no reference text is
new:

| Files | Content | Condition |
| --- | --- | --- |
| 01 – 05 | everyday Egyptian (reading prompts EG-R01, R02, R07, R10, R12) | speaker phone |
| 06 – 09 | English inside Egyptian (EG-CS-01, 02, 03, 08) | speaker phone |
| 10 – 13 | names, a date, digits, an amount (EG-ND-01, 02, 04, 06) | speaker phone |
| 14 – 15 | MSA: a date, and an English word (MSA-ND-03, MSA-CS-01) | speaker phone |
| 16 – 17 | hesitation, self-correction (EG-DF-01, 02) | speaker phone |
| 18 – 19 | lines 02 and 06 again, with the television on | noise |
| 20 | a self-interruption, with QANDEEL's voice playing from the PC (`C0177.wav` of §9.9, an existing file) | overlap |

**Local conversion, nothing installed and nothing sent:** `convert-audio.ps1` converts a phone recording to 16 kHz mono
16-bit WAV with Windows' own Media Foundation transcoder (WinRT `Windows.Media.Transcoding`, run from Windows PowerShell).
`asr-sm.mjs --prepare` runs it for every file, uses a streamable WAV as it is, and writes `PO/wav/prepared.json`, which binds
each source's SHA-256 to its WAV's. A file recorded again after `--prepare` is refused until it is prepared again.
- **Proof:** a 7.88 s WAV converted to AAC m4a and back gave 16 kHz, 7.89 s, and the same measured speech bounds (220 /
  7580 ms). The same m4a went through `prepareRecordings` with the real converter in 0.8 s.
- A format Windows cannot decode is reported as `NOT CONVERTED` by `--prepare`. That recording is then re-saved by the
  Product Owner as m4a or WAV; no other tool is installed.

**The plan, version 2** (`asr-sm-plan.json`, hash `5d1af7a4a5ed0390fd6b20855d83876c7936fce57d066bc761a56f29b185f897`):
- 20 sessions = 20 recordings × Enhanced `ar_en`: partials on, `max_delay` 1.0 s `flexible`, end of utterance after 0.5 s,
  the set's names as `additional_vocab`; EU endpoint; real-time only; model training off; no retry.
- **Cap USD 0.25.** Every session at its ceiling (30 s of audio, 2 s of tail silence and a 15 s margin, at USD 0.80 per hour)
  totals USD 0.2089. For lines of about 5 s the expected spend is under USD 0.05, inside Speechmatics' free credit.
- `scope.preliminarySingleSpeaker: true` is a structural rule of the plan check.
- The preregistered thresholds of §9.12 are unchanged. With 20 lines, a group such as MSA (2 lines) or noise (2 lines) is read
  with that caution.
- **Plan version 1** (`e6b233b6…`, 120 sessions, USD 1) is **SUPERSEDED**: it was never approved and never run. Its
  approval record is replaced by a new PENDING one for run `s8b01-cp2-asr-sm-po-r1`.

**`--plan-check`** reports, for the Product Owner's review, each recording's source format, duration, sample rate and
measured speech span. It prints no transcript and sends nothing.

**Tests:** `tests/s8b-01-voice-bench-harness-contract.test.mjs`, 43 / 43. They cover the version 2 plan and its refusals
(a second arm, a second speaker, another set, a cap above USD 0.25, the single-speaker rule), the 20 lines, and the
prepare / manifest path (conversion, WAV as is, an undecodable file, a re-recorded file).

**Status: `BLOCKED — MISSING PREREQUISITES`.**
- The key file is present (checked for presence only).
- The Product Owner records the 20 files.
- Then `--prepare` and `--plan-check` run, and the recordings are reviewed.
- Then the Product Owner approves the plan hash, the USD 0.25 cap and the run `s8b01-cp2-asr-sm-po-r1`, confirming that the
  workspace's model-training setting is off.

Nothing has been sent. The recommendation (`APPROVE FOR PRODUCTION` or `NOT READY`, stated as preliminary and
single-speaker) follows that one run.

### 9.14 The Product Owner's 20 recordings received — WhatsApp Ogg Opus, awaiting ffmpeg (2026-10-28)

The Product Owner placed `01.ogg` … `20.ogg` in `corpus/PO/`, transferred through WhatsApp. They are inspected read-only.
Their SHA-256 values were taken on arrival and still match after every step; the originals are never modified.

**What the files are** (Ogg pages parsed, nothing decoded):
- all 20 are Ogg Opus, encoder (vendor) `WhatsApp`: mono, 16 kHz input rate, SILK wideband only (an audio band up to
  8 kHz), about 15 – 19 kbps, 120 ms packets;
- every page's CRC is valid, with no trailing bytes and one stream each;
- the last page carries no end-of-stream flag, which is how WhatsApp writes its voice notes; the final granule position is
  consistent;
- durations 3.82 – 6.52 s, 99.7 s in all, each inside the plan's 30 s limit.

**No file is silent:** without decoding, coded-speech packets (≥ 20 bytes per 20 ms) cover 25 – 50 packets per file. Speech
starts by about 0.24 s in every file.
- Speech reaches the last 120 ms packet in 01, 19 and 20, so a final syllable may be clipped. Only listening, or a decoded
  waveform, can tell.
- 19 and 20 keep large packets even between words. That is consistent with the television, or QANDEEL's voice, still being
  present after WhatsApp's processing.

**Conversion:**
- Windows Media Foundation cannot read Ogg Opus on this machine. `convert-audio.ps1` fails with `Unknown`, and only
  Microsoft's Web Media Extensions (Vorbis) is installed.
- No other local decoder exists: no ffmpeg, and none in `node_modules`.
- `asr-sm.mjs --prepare` therefore reports 20 / 20 `NOT CONVERTED`, and `--plan-check` reports 20 unprepared.
- `--prepare` now tries ffmpeg after Windows, but only from `QANDEEL_FFMPEG_DIR`, never PATH:
  `-map 0:a:0 -map_metadata -1 -ac 1 -ar 16000 -c:a pcm_s16le`.
- ffmpeg is the one already proposed for the Replay spike (§9.11), so one approved install serves both. Nothing is
  installed before the Product Owner's approval.

**Reading the results, given WhatsApp:**
- The audio the test scores is WhatsApp's 16 kbps SILK-wideband encoding, not the phone microphone's own signal. It is
  likely a lower quality than QANDEEL's own capture.
- If the files were recorded as WhatsApp voice notes, the phone's voice-call processing (noise suppression, gain control)
  probably applied too. That is likely, but it cannot be confirmed from the file. It may lower the noise and overlap
  difficulty of 18 – 20.
- An error may come from the codec rather than Speechmatics, so the run is read as a preliminary single-speaker test on
  WhatsApp-quality audio.
- A good result on this audio is not weakened by the codec. A poor result does not by itself show Speechmatics is not
  ready.

**Status:** `BLOCKED — AWAITING THE PRODUCT OWNER'S APPROVAL TO INSTALL FFMPEG`. After it:
1. `--prepare` converts the 20 files;
2. `--plan-check` gives the readiness report on the decoded audio (durations, sample rate, speech spans);
3. the Product Owner approves the run (plan `5d1af7a4…`, USD 0.25, model training off).

The plan's `audio.format` line names only the Windows converter. If ffmpeg is approved and used, that line is corrected before
the run approval, and the new plan hash is presented with the readiness report. The expected spend on 99.7 s of audio is
about USD 0.04. Nothing has been sent.

### 9.15 ffmpeg approved and installed locally; the 20 recordings converted; the Replay render spike run (2026-10-28)

**The Product Owner's approval (2026-10-28):** download and set up `ffmpeg 9.0.2` from gyan.dev, if the published SHA-256
matches.
- It is portable `release-essentials`, outside the repository, with no change to PATH or to system settings.
- It is approved for converting the 20 recordings and for the local, free Replay render.
- No request to Speechmatics is approved until the Product Owner approves the run and its cap.

**The tool:**
- **Download:** `https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip` (114,768,076 bytes), into
  an empty folder of its own. `release-version` reads `9.0.2`.
- **SHA-256:** `60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba`, equal to gyan.dev's published
  `.sha256`. It was checked before extraction.
- **Location:** extracted to `C:\Users\MG\tools\ffmpeg-9.0.2-essentials\`. It is used only through
  `QANDEEL_FFMPEG_DIR`, set per process. PATH and system settings are untouched.
- **Build:** `ffmpeg version 9.0.2-essentials_build-www.gyan.dev`. It has the native Opus decoder, libopus, libx264 and AAC.

**The 20 recordings:**
- **Conversion:** `asr-sm.mjs --prepare` gave 20 / 20 `CONVERTED` by ffmpeg, to `PO/wav/NN.wav` with `prepared.json`,
  all PCM, mono, 16 kHz, 16-bit.
- **Originals:** the SHA-256 of all 20 still equals their arrival value.
- **Decoding:** `ffmpeg -v error -xerror` reports no error in any file.
- **`--plan-check`:** 20 present, 0 missing, unprepared or invalid; durations 3.81 – 6.51 s.

**Levels, from the converted WAVs** (energy measures; no one has listened to them yet):
- **Speech:** −17 to −24.5 dBFS RMS in every file, clearly audible.
- **Clipping:** peaks reach 0 dBFS in 04, 07, 12 and 18, with 1 – 13 samples at full scale. That is negligible.
- **Speech start:** 0.34 – 1.42 s, so a short silence precedes speech in every file.

**The three endings checked** (50 ms energy profiles):
- **01:** speech ends at about 3.37 s, followed by 0.6 s of near-silence (−45 dB). A 50 ms low-frequency thump closes the
  file, the record button being released, not speech.
- **19:** speech ends at about 3.75 s. The television continues at about −40 dB until the file ends 1.1 s later.
- **20:** speech decays to −71 dB at 3.61 s, before the file ends at 3.81 s.
- None of the three is cut inside a word. No re-recording is requested.

**What WhatsApp did, now measured:**
- The noise floor of 12 files is digital silence (−94.7 dBFS), and of the rest −72 to −83 dBFS, except 19. That is the
  phone's voice processing: a noise gate or suppression, applied before or by WhatsApp.
- **18 (noise):** the television is largely removed (floor −83 dB).
- **19 (noise):** it stays (floor −54 dB, speech to floor 35 dB).
- **20 (overlap):** QANDEEL's playback, if it is present, lies under the speech or was suppressed (floor −72 dB).

So the noise and overlap conditions are easier than the conditions they stand for, and only 19 is a real noisy line. The
run reads them that way, as stated in §9.14.

**Withdrawn (§9.16):** the Product Owner listened to 18, 19 and 20 and confirms the noise and QANDEEL's voice in all three.
The energy-floor reading above is not evidence that they are absent.

**The Speechmatics plan, final for review:**
- `asr-sm-plan.json` version 2, hash **`3fd6a842e9dcf238270124aee9a5c2dbb96dae33db276bba54217c9562751c17`**.
- Only its `audio.format` line changed from `5d1af7a4…`: it now names the ffmpeg route and the WhatsApp source.
- 20 sessions; cap USD 0.25; the worst case USD 0.2089; the expected spend USD 0.0353 on the 99.7 s.
- `asr-sm-approval.json` stays `PENDING` (run `s8b01-cp2-asr-sm-po-r1`). Nothing has been sent.

**The Replay render spike** (`replay-render-spike.mjs`; synthetic, local, free; outputs gitignored under
`artifacts/evals/s8b-01/replay-spike/`):
- **Two harness defects, fixed:**
  - ffmpeg 9 no longer has `-filter_complex_script`; the graph is passed with `-/filter_complex <file>`.
  - The first render (`r1`, kept) put the end beep at 1.58 s, inside speech, while the white frame was at 30.67 s. The
    beep detector measured energy only, so loud speech counted as a beep. It now counts a window only when the 1 kHz tone
    carries most of its energy (Goertzel), and the contract asserts that a loud non-beep sound is never a beep.
- **The run, `r2`: all eight checks passed.**

| Check | Result |
| --- | --- |
| Video | H.264 Main, level 4.0, yuv420p, 720 × 1280, 30 fps |
| Audio | AAC-LC, 48 kHz, mono |
| Container | MP4, faststart (`moov` before `mdat`) |
| Duration | 31.4 s; audio and video durations agree |
| Sync, start | beep and white frame both at 500 ms (0 ms) |
| Sync, end | beep 30,650 ms, frame 30,667 ms: −17 ms, within one frame (33 ms); the timeline held |
| Sources | the two Opus tracks unchanged by the render (SHA-256) |
| Processing files | deleted on completion |
| Size | 552,369 bytes (about 141 kbps) |
| Render | 2.9 s wall time for 31.4 s, 0.092 of real time; 14.5 s user CPU on all cores; peak memory 522 MiB |

- **Phone playback is NOT VERIFIED on a device:** no Android device was connected. The profile (H.264 Main 4.0, yuv420p,
  AAC-LC, faststart MP4) is the one phones play natively. Playback on a handset is left to the first device session.
- **What it proves:** two mono Opus sources on one clock render to a phone-profile MP4 with sync within a frame, the sources
  untouched and the processing files deleted, at about a tenth of real time on this PC.
- **What it does not show:** the Replay runtime, the bound analytical projection, the Living Analysis grammar, or a server's
  cost. The codec / container choice of `voice-runtime-v1.md` §9.2 can now cite this evidence.

**Status:**
- ASR is `READY FOR THE PRODUCT OWNER'S RUN APPROVAL`: the recordings are prepared and checked, and the plan
  `3fd6a842…` awaits approval with model training off.
- The render spike is `RUN — ALL CHECKS PASSED`, with device playback not verified.
- CP3 has not started.

### 9.16 The Product Owner's correction and the run approval (2026-10-28)

**Correction, from the Product Owner's own listening:** the noise and QANDEEL's voice are present in 18, 19 and 20.
- The automated background analysis of §9.15 (noise floors from energy) is **not evidence of their absence**, and its
  inference that 18 and 20 are easier than their conditions is withdrawn.
- 18 and 19 are scored as noise lines, and 20 as an overlap line with QANDEEL's voice playing.
- What remains true: the audio is WhatsApp-encoded (§9.14), and the phone's voice processing may have lowered the
  background. Its level relative to speech is not claimed from the energy floor.

**PO FINAL APPROVAL — Speechmatics ASR (2026-10-28):**
- **Run:** `s8b01-cp2-asr-sm-po-r1` on plan `3fd6a842e9dcf238270124aee9a5c2dbb96dae33db276bba54217c9562751c17`, ONE run only.
- **Arm and recordings:** Enhanced `ar_en`, the 20 recordings only.
- **Cap:** USD 0.25, from the free credit.
- **Region:** EU1. This is the account's region; the plan pins the EU real-time endpoint `wss://eu.rt.speechmatics.com/v2`.
- **Model training:** OFF, checked by the Product Owner.
- **Approval record:** `asr-sm-approval.json` is `APPROVED`, with `modelTrainingOff: true`.
- **Not approved:** no re-run, no CP3, no PR and no merge.

### 9.17 Speechmatics Enhanced `ar_en` — the one approved run, a preliminary single-speaker test (2026-10-28)

**The run:**
- `s8b01-cp2-asr-sm-po-r1` at `39119a83`, plan `3fd6a842…`, EU endpoint, run once, no retry.
- **Spend:** 20 of 20 sessions. Settled USD 0.0345, an upper bound priced on each session's wall time, of the USD 0.25 cap,
  from the free credit. No reservation was refused or overran.
- **Approval:** `asr-sm-approval.json` is `CONSUMED`.
- **Outputs:** gitignored under `artifacts/evals/s8b-01/asr/s8b01-cp2-asr-sm-po-r1/`. They hold the server messages, which
  hold the transcripts of the Product Owner's read sentences.
- 19 sessions returned a transcript. Session 20 (overlap) closed normally but returned only empty finals.

**The preregistered verdict: `NOT ACCEPTED`** (4 of 11 rules pass):

| Rule | Result | |
| --- | --- | --- |
| every session without error | 19 / 20 with a transcript | fail |
| Egyptian WER, speaker phone ≤ 0.25 | 0.278 | fail |
| MSA WER ≤ 0.12 | 0.167 (2 lines) | fail |
| noise WER ≤ 0.35 | 0.389 (2 lines) | fail |
| English words ≥ 0.8 | 4 / 10 | fail |
| names / key terms ≥ 0.8 | 1 / 2 | fail |
| numbers ≥ 0.8 | 2 / 2 | pass |
| the intended word of a self-correction ≥ 0.8 | 1 / 1 | pass |
| first partial p50 ≤ 1000 ms | 951 ms (p95 2417) | pass |
| end of utterance E p50 ≤ 900 ms | 1700 ms | fail |
| final after the endpoint A p50 ≤ 300 ms | 0 ms | pass |

Overall WER is 0.290 (47 errors / 162 reference words), CER 0.248.

**What the errors are** (a post-hoc reading by line, not a preregistered measure; it does not change the verdict):
- **Formatting, not comprehension, makes up 27 of the 47 word errors.** Numbers come back as digits, all of them correct:
  78345, 3750, 1990, 15 March, the hours 3 and 4. Some words are split or joined differently: `ما نمتش` for `منمتش`,
  `حولت لك`, `أقول لك`. Also `الأحد` for `الحد`, and `شوفوا` for `شوفه`, which sound the same.
- **Comprehension errors are 20 of 162 words, about 12 %:**
  - **Everyday Egyptian (01 – 05):** 3 of 42 words wrong. `بفكر` became `تفكر`, `شغلي` was lost, and `بعيد` became
    `بعيدة`.
  - **English inside Egyptian, the main weakness.**
    - The words are dropped, not misheard: `meeting` and `link` (06), `deadline` and `presentation` (07, where the
      whole first half became `It.`), `login` (08), and `meeting` again in 19.
    - Heard: `call` (كول), `PDF` (البي دي إف), `app` (الأب) and `link` (19).
  - **Names:** `شريف عبد الحميد` was right. `نهى` became `نوال`, although `نهى الشربيني` was in the custom dictionary.
  - **13:** `كلّم` became `تكلم`, and the last word `الجديد` was lost.
  - **Numbers, dates, amounts:** all right. **Self-correction (17):** the intended `خمسة` was kept. **Hesitation (16):**
    the words were right and the filler was kept.
  - **MSA (14, 15):** no comprehension error. The 3 errors in 14 are the year written as digits.
- **Noise (18, 19; the Product Owner confirms the noise, §9.16):** one comprehension error more than the same sentence on
  the speaker phone. 18 lost `امبارح`, which 02 kept. 19 lost `meeting` but kept `link`, where 06 lost both.
- **Overlap (20, QANDEEL's voice playing; confirmed by the Product Owner):** **no words at all**. Speechmatics returned
  only empty finals and no end of utterance. One sample cannot show why.

**Speed** (the audio clock, from speech onset / end as measured by energy):
- **First partial:** p50 951 ms after speech onset, p95 2417 ms.
- **The last word's final:** p50 1.29 s after speech end (0.67 – 1.51 s). With `max_delay` 1.0 s, a final arrives about
  1.0 s after the audio it covers.
- **EndOfUtterance:** p50 1.70 s after speech end (1.03 – 1.89 s), well over the 0.9 s budget, with the 0.5 s silence
  trigger. The sentence-ending punctuation arrives with it, so A = 0.
- **Early endpoints:** in 2 of 19 sessions (02, 19) an EndOfUtterance also came inside the sentence, at a reading pause.
- **What this means for QANDEEL:** in this configuration, Speechmatics' end of utterance cannot be QANDEEL's turn signal.
  The final text of a turn arrives about 1.3 s after the user stops.
- `max_delay` (minimum 0.7 s) and the trigger are the configuration's levers. Neither was tested.

**Privacy held as planned:** real-time only, the EU endpoint, model training off (checked by the Product Owner), no batch
job, and no retry.

**Limits of this test** (§9.13, §9.14):
- One speaker, one phone, 20 read sentences.
- MSA, noise and overlap have 2, 2 and 1 lines, so their rates carry very wide uncertainty.
- The audio is WhatsApp's 16 kbps SILK-wideband Opus with the phone's voice processing, not QANDEEL's own capture. The codec
  may account for part of the lost English words and of the empty overlap session; this test cannot separate the two.
- The run shows how Speechmatics did on this audio. It does not show how it does for other users, voices, phones or rooms.

**The recommendation: `NOT READY` for production on this evidence.**
1. English inside Egyptian, central to QANDEEL's users, lost 6 of 10 English words, and one sentence collapsed.
2. With QANDEEL's voice playing, nothing was transcribed.
3. The end of utterance (p50 1.7 s) and the final text (about 1.3 s after speech) are too slow to drive turn-taking in
   this configuration.
4. A name in the custom dictionary was misrecognized.

What held: everyday Egyptian, numbers, dates and amounts, self-correction, hesitation, MSA, the first partial in under a
second, the privacy conditions, and the cost.

`NOT READY` is not a rejection of Speechmatics. A decision to approve it would need a further test on audio of QANDEEL's
own quality, with the configuration levers above and the English terms in the custom dictionary. That would be a new plan
and a new approval. The provider decision is the Product Owner's, and ASR remains not selected.

### 9.18 The Product Owner's review: a waiver, and an engineering review of the two open problems (2026-10-28)

**The Product Owner's decision, after listening to the recordings again:**
- **`PO ACCEPTED WITH WAIVER`** for the English words inside Egyptian and for `نهى` / `نوال`. The Product Owner judges
  that some of those words were spoken fast and not clearly enough.
- The understanding of everyday Egyptian is accepted provisionally.
- **The results and the preregistered criteria of §9.17 stand unchanged:** the verdict stays `NOT ACCEPTED`, and the
  English rate stays 4 / 10. The waiver is the Product Owner's evaluation, not a numerical pass.
- **Two engineering problems are not waived:**
  1. no word recognized while QANDEEL's voice played (sample 20);
  2. the slow end-of-speech detection and final transcript.
- The order is a bounded engineering review with no paid call, then the smallest remediation and proof plan, stopping
  before any paid test.

**Problem 1 — sample 20 (from the run's own messages and the audio, locally):**
- **Not a session failure:**
  - Speechmatics accepted the 3.8 s and ran at broadcast quality, the same as every other session.
  - It sent 17 partials and 9 finals at the normal cadence, and every one was empty.
  - The model heard no recognizable word; nothing was lost in transport.
- **The audio is not silent or damaged** (§9.15). It carries the most continuous loud content and the highest
  zero-crossing rate of the set (2680 Hz against 1618 – 2105 Hz), consistent with two voices overlapping, as the Product
  Owner confirms (§9.16).
- **QANDEEL's share cannot be measured locally.** An envelope cross-correlation with the played file (`C0177.wav`) finds
  no distinct alignment: the best match is 0.50, against 0.45 at the top 1 % of chance alignments. The PC speaker, the
  room, the phone's processing and the WhatsApp codec stand between the two signals.
- **What the sample stands for:** QANDEEL's voice from an external PC speaker, for the whole sentence, into the phone's
  microphone. The phone's echo canceller has no reference for that sound and cannot remove it. That is the "second voice in
  the room" condition. It is not QANDEEL's own barge-in path:
  - **The contract's path** (`voice-runtime-v1.md` §2, §4.4): QANDEEL plays from the same phone. The platform's echo
    cancellation (Android `VOICE_COMMUNICATION` + `AcousticEchoCanceler`, iOS `voiceChat`) removes it against the
    played reference.
  - On-device VAD after AEC detects the user's speech, and **playout stops immediately**.
  - The ASR then receives at most a short overlap with residual echo, followed by clean speech.
- **What this cannot establish:**
  - whether the zero output is Speechmatics' limit on two overlapping voices, or the phone / WhatsApp processing of
    double-talk, or both;
  - how Speechmatics transcribes speech after echo cancellation, with a residual echo.
- **Classification:**
  - "two people speaking at once in the room" may be a real limit, though one sample cannot show it;
  - QANDEEL's own barge-in is a design matter, already in the contract. Its proof is the remaining gap.

**Problem 2 — latency (from the run's own event logs):**

| Moment, after the measured speech end (p50, 19 sessions) | ms |
| --- | --- |
| the whole eventual transcript first visible as the finals so far plus the latest partial | **433** |
| the last word's final | 1294 |
| EndOfUtterance | 1700 |

- **The words are recognized early.** About 0.86 s of the wait is finalization, not recognition.
- **The finalization wait has three sources:**
  - `max_delay` 1.0 s: Speechmatics: "the delay between the end of a spoken word and the Final transcript", range
    0.7 – 4 s;
  - `flexible` mode, which holds a final until a number, date or amount is complete;
  - the EndOfUtterance, which follows the final.
- **The documented control** (Speechmatics turn-detection page):
  - `ForceEndOfUtterance` is supported by Enhanced. The server answers it with an `AddTranscript` and then an
    `EndOfUtterance`, both `forced: true`.
  - Speechmatics recommends a 0.5 – 0.8 s silence trigger for voice AI, kept below `max_delay`.
  - Partials arrive "typically in less than 500 milliseconds", and are 10 – 25 % less accurate than finals.
- **Classification: solvable by configuration and the audio path, not a provider limit.** The contract already places
  endpointing in QANDEEL's pipeline (§2: "streaming ASR adapter → endpointing → final transcript"; §11 lever: endpointing
  tuning).
- **The design that follows**, with no provider change:
  1. QANDEEL's Voice Gateway decides the end of the user's turn from silence on the received audio (VAD, a value under
     controlled configuration), not from Speechmatics' EndOfUtterance.
  2. At that moment it sends `ForceEndOfUtterance`.
  3. The forced `AddTranscript` is the committed final transcript (§4.1). The Conversation Orchestrator passes it to
     DeepSeek (REALTIME) as today.
  4. `max_delay` 0.7 s, `flexible` kept: the numbers were all correct, and the force releases what is held.
     Speechmatics' own trigger stays as a backstop below `max_delay`.
  5. Partials are not sent to DeepSeek. Speculative generation stays the contract's lever (§11), used only if the measured
     end-to-end time misses the target.
- **The projection, to be proven:** E ≈ the configured silence (0.5 s); A = the forced final's turnaround, unknown until
  measured. This compares with 1.7 s today.
- **The risk:** a 0.5 s silence can end a turn at a thinking pause. 2 of 19 sessions had a pause-length gap inside the
  sentence (02, 19). The value is set from S8B-05 measurement. If the user goes on speaking, the existing interruption path
  (§4.4) supersedes the reply.

**One production prerequisite noticed:** each session reported `concurrent_session_usage`, "2 concurrent sessions active
out of quota 2". The free account allows two concurrent real-time sessions, so production needs an account tier sized for
concurrent calls. That is a commercial setting, not a technical limit.

**The smallest remediation proof** (a proposal; not prepared as a plan and not run; it needs the Product Owner's approval):
- **One guarded run**, about 13 sessions, Enhanced `ar_en` only, on the existing recordings and the existing QANDEEL file.
  No new recording.
- **P1, overlap, 7 sessions:**
  - sample 20 once more, as it is, to see whether the empty result repeats;
  - two clean lines the run already transcribed well, each mixed locally with `C0177.wav` three ways: QANDEEL about
    25 dB below the speech for the whole line (a stand-in for the echo canceller's residual), QANDEEL at the speech's level
    for the first 0.4 s and then stopped (the barge-in path), and QANDEEL at the speech's level throughout (the room
    condition, reported only).
- **P2, latency, 6 sessions:**
  - six clean lines, two with numbers, with `max_delay` 0.7 and `ForceEndOfUtterance` sent 500 ms after the measured
    speech end;
  - measured: the forced final's arrival after the force; E + A; whether the forced transcript keeps the words and
    numbers of the same line in §9.17.
- **Preregistered acceptance:**
  - the residual-echo and barge-in variants keep the comprehension of the clean line, at most one extra word wrong;
  - with the force, E + A p50 ≤ 900 ms, the forced final ≤ 300 ms p50 after the force, and no word or number lost
    against §9.17.
- **Cost:** expected under USD 0.03; proposed cap USD 0.10.
- **What it would still not prove:**
  - the real device echo canceller. That is the S8B-06 real-device evidence (§13), which the contract already requires;
  - the turn-end value for natural speech. That is S8B-05.

**Status:**
- ASR is not selected; the Speechmatics decision awaits the Product Owner after the proof above, if it is approved.
- No paid call has been made since §9.17.

### 9.19 The final ASR engineering proof — prepared, awaiting the Product Owner's approval (2026-10-28)

**The Product Owner's order** (review of §9.18), which changes the §9.18 proposal:
- 12 sessions, 6 overlap and 6 latency. **Sample 20 is not repeated.**
- Speechmatics Enhanced `ar_en` only, `max_delay` 0.7, with `ForceEndOfUtterance` and a VAD.
- The latency lines include thinking pauses and self-corrections: "لا نريد تسريع الرد على حساب قطع كلام المستخدم".
- The accuracy and no-word-loss criteria are kept. The actual time to answer a `ForceEndOfUtterance` is measured.
- **Synthetic mixes do not prove the phone's echo canceller.** That proof stays for the device-call phase.
- **If the proof passes**, the recommendation is Speechmatics for production integration, with on-device barge-in proven
  as a pre-launch condition. That is not a declaration that production testing is complete.
- Cap USD 0.10 from the free credit. No re-run or expansion without approval.

**The plan:**
- **The files:**
  - plan `scripts/s8b-01/asr-sm-proof-plan.json`, SHA-256
    **`6ba458f4ced2c81f1d658367d473eeba0756b465c7786b4ce38ec8fbee158b74`**;
  - approval `asr-sm-proof-approval.json`, `PENDING`, run id `s8b01-cp2-asr-sm-proof-r1`.
- **The harness** (operator-only, never imported by production code):
  - `asr-sm-proof.mjs`, with `--plan-check` and `--live --confirm <runId>`;
  - its guarded child `asr-sm-proof-run.mjs`;
  - the guard check `asr-sm-proof` in `spend-guard.cjs`: its own plan and approval pair, the EU real-time host only, one
    WebSocket per reservation, every other provider key scrubbed.
- **The arm `ENHANCED_AR_EN_FAST`:**
  - `model enhanced`, `language ar_en`, partials on;
  - `max_delay` 0.7 (Speechmatics' minimum), `max_delay_mode flexible` kept for numbers;
  - `conversation_config.end_of_utterance_silence_trigger` **0**, which turns Speechmatics' own trigger off. QANDEEL's
    endpoint is then the only one, and every EndOfUtterance answers a force;
  - the same vocabulary as §9.17, USD 0.80 / hour.

**The endpoint: two decisions kept apart**, so that a fast final never cuts the user:
1. **FINALIZE.** A causal energy VAD runs on the audio as it is sent: 20 ms frames, threshold 300, armed after 100 ms of
   speech. After **500 ms** of silence it sends `ForceEndOfUtterance`, with the silence start as `timestamp`. This happens
   at a thinking pause too, and the VAD re-arms on new speech.
2. **COMMIT.** The Conversation Orchestrator commits the turn only after a longer silence. S8B-05 sets that value by
   controlled configuration. In this proof it is computed locally and reported, never sent.

**The commit cut table** (local, all 20 recordings; a recording is "cut" when the silence ends a turn before the measured
speech end):

| Commit silence (ms) | Recordings cut |
| --- | --- |
| 500 | 05, 09, 17 |
| 600 | 05, 17 |
| 800 | none |
| 1000 | none |
| 1200 | none |

The internal pauses behind it: 05 780 ms, 17 600 ms, 09 580 ms.

**The 12 sessions:**
- **OVERLAP, 6 sessions.** Lines 01 and 04, which §9.17 transcribed with no word error, so a change comes from the overlap
  and not from the line. Each is mixed locally with QANDEEL's voice (`C0177.wav`, pinned by hash):

  | Variant | QANDEEL's voice | Gated |
  | --- | --- | --- |
  | `RESIDUAL_M25` | 25 dB under the speech, for the whole line: a stand-in for the echo canceller's residual | yes |
  | `BARGE_IN_400` | at the speech's level until 0.4 s after the user starts, then stopped: the barge-in path | yes |
  | `FULL_0DB` | at the speech's level for the whole line: the room condition | reported only |

  The endpoints are computed on the clean speech. On the phone the VAD runs after the echo canceller (§2, §4.4), so
  QANDEEL's own voice never arms it. The mixes clip at most 3 samples.
- **LATENCY, 6 sessions.** Lines 02, 05, 09, 11, 16 and 17, with no mix:
  - thinking or reading pauses (05, 17, 09; 02 had a mid-sentence EndOfUtterance in §9.17);
  - a self-correction (17) and hesitation (16);
  - numbers spoken digit by digit (11).

  The forces fall at 4720 (02); 2080 and 5520 (05); 1980 and 4280 (09); 4180 (11); 6120 (16); 2200 and 4400 (17). That is
  three forces inside a sentence, at a pause, and every end-of-speech force 500 ms after the measured speech end.
- **The inputs are pinned:** the recording script hash, the eight WAV hashes from `prepared.json`, and QANDEEL's file. The
  plan check refuses any change.

**Preregistered acceptance** (`plan.acceptance`; every item is reported, passed or not):
1. Every gated session ran and returned a transcript (10).
2. Overlap `RESIDUAL_M25` and `BARGE_IN_400`: at most 1 word error more than the same line in §9.17.
3. Latency lines: at most 1 word error more than §9.17.
4. Latency lines: every check that passed in §9.17 still passes (the number in 11, the intended word in 17, the English
   word in 09).
5. `ForceEndOfUtterance` answered, p50 ≤ 300 ms (the contract's A budget).
6. Text ready, meaning the EndOfUtterance answering the end-of-speech force, after the speech end: p50 ≤ 900 ms (E + A).

Also measured and reported, not gated: the forces inside a sentence, the last word's final, the first partial, and
`FULL_0DB`.

**Spend and stop rules:**
- **The cost:**
  - worst case USD 0.072, with every session at its 10 s ceiling;
  - expected about USD 0.021;
  - cap USD 0.10.
- **One run, no retry.** The run stops on not-authorised (4001), quota exceeded (4005), a failed first session, three
  consecutive failures, or a budget refusal.
- **The launcher refuses** unless all of these hold:
  - the approval is `APPROVED` with this plan hash;
  - model training off is confirmed;
  - `--confirm s8b01-cp2-asr-sm-proof-r1` is given;
  - the run directory does not exist yet;
  - the tracked tree is clean;
  - the per-user key file holds a key, which is never printed.

**A harness correction found by the new tests:**
- `smSession` sent each 20 ms chunk at the start of its own interval, 20 ms before a microphone could have delivered it.
  It now sends each chunk when its audio is complete, so the session clock is the audio clock.
- The §9.17 timings were therefore up to 20 ms optimistic. That is negligible against the 1.7 s measured there, and they
  are not re-stated.

**What a pass would and would not mean:**
- **A pass** supports recommending Speechmatics Enhanced `ar_en` for production integration. On-device barge-in
  (the platform echo canceller, VAD after AEC, playout stopping) stays a **pre-launch condition**, proven on devices in
  S8B-06 when calls are implemented.
- **Not proven, even by a pass:**
  - the phone's echo canceller;
  - more than one speaker;
  - the commit value for natural speech (S8B-05);
  - the account tier for concurrent sessions (§9.18).
- **A failure** is reported as it is, with no re-run or expansion without approval.

**Verification (local, no network):**
- The harness contract adds five tests, 48 of 48 passing:
  - the plan and its refusals: the cap, a second arm, `max_delay`, Speechmatics' trigger, sample 20, the session count,
    the deferred AEC scope, a changed recording;
  - the causal VAD, its re-arming, and the mix level and stop;
  - a loopback session where each force follows its audio with its timestamp, and the forced answer and text ready are
    measured;
  - the verdict and its failures;
  - the guard check.
- `--plan-check` passes.

**Status:**
- **PENDING** the Product Owner's approval of the plan hash, the USD 0.10 cap, the run id and model training off.
- ASR is not selected. No paid call has been made since §9.17.
- *(Superseded by §9.20: approved and run once.)*

### 9.20 The final Speechmatics proof — the one approved run (2026-10-28)

**The approval** (PO APPROVAL — Final Speechmatics Proof):
- **Scope:** plan `6ba458f4…`, run `s8b01-cp2-asr-sm-proof-r1`, Speechmatics Enhanced `ar_en`, 12 sessions, cap USD 0.10
  from the free credit, EU.
- **The Product Owner confirms model training is `OFF`.**
- One run only, with no retry and no expansion. Recorded in `asr-sm-proof-approval.json` (commit `e80196ca`), now
  `CONSUMED`.
- **The Product Owner's engineering note, binding on the reading of these results:**
  - `ForceEndOfUtterance` finalizes the text; it does not by itself end the user's turn.
  - The results must show that no word is lost or repeated where a thinking pause is followed by more speech.
  - An early finalization is never permission to send a reply to DeepSeek.
  - The 800 ms commit value is experimental only. Its production setting is decided in S8B-05.
- This corrects §9.18's design step 3, which treated the forced transcript as the committed turn. The forced transcript
  is the *finalized text*; the turn is committed only by the Orchestrator's commit silence (§9.19).

**The run:**
- 12 of 12 sessions, no error, no stop rule triggered, nothing blocked by the guard.
- Settled USD **0.0201** (wall-time upper bound) of the USD 0.10 cap.
- Run directory `artifacts/evals/s8b-01/asr/s8b01-cp2-asr-sm-proof-r1/` (gitignored, kept).

**The preregistered verdict: `NOT ACCEPTED`. Five of six items pass; overlap fails.**

| # | Item | Result |
| --- | --- | --- |
| 1 | every gated session ran and returned a transcript | **passed** (10 / 10) |
| 2 | overlap `RESIDUAL_M25` / `BARGE_IN_400`: at most +1 word error against the clean line | **failed** (line 01) |
| 3 | latency lines: at most +1 word error against §9.17 | **passed** |
| 4 | latency lines: every §9.17 check still passes | **passed** (the number in 11, the intended word in 17, the English word in 09) |
| 5 | `ForceEndOfUtterance` answered, p50 ≤ 300 ms | **passed**: p50 **164 ms**, p95 216 ms (9 forces) |
| 6 | text ready after the speech end (E + A), p50 ≤ 900 ms | **passed**: p50 **680 ms**, p95 718 ms |

**Latency — solved on these recordings:**
- Text ready after the speech end: p50 680 ms, against EndOfUtterance at 1.7 s in §9.17. The last word's final was
  678 ms.
- Every EndOfUtterance answered a force. Speechmatics returns `forced: true` at the top level of the message, not in
  `metadata`; the harness's reported (not gated) count read `metadata` and showed zero. That is corrected in
  `asr-sm-proof.mjs`, with its test, after the run.
- Word errors on the latency lines against §9.17: 02 2 → 2; 05 2 → 1; 09 0 → 1 (the digit `5` for `خمسة`, formatting);
  11 5 → 5 (the number check held); 16 2 → 2; 17 1 → 1 (the intended word held).

**The Product Owner's checks at the thinking pauses** (lines 05, 09 and 17, one early finalization each):

| Line | Silence start (ms) | Force sent (ms) | Answered (ms) | Speech resumes (ms) | Pause | Commit at 800 ms |
| --- | --- | --- | --- | --- | --- | --- |
| 05 | 1580 | 2080 | 2298 | 2360 | 780 ms | held open (margin **20 ms**) |
| 09 | 1480 | 1980 | 2104 | 2060 | 580 ms | held open (margin 220 ms) |
| 17 | 1700 | 2200 | 2366 | 2300 | 600 ms | held open (margin 200 ms) |

- **No word lost or repeated at any of the three boundaries.** The text before and after each early finalization abuts
  on the audio clock (05: 1.86 s | 1.86 s; 09 and 17: 1.78 s | 1.78 s). No word appears in both parts.
- **Line 17's self-correction kept the intended word:** `الميعاد الساعة 4.` | `لا . لا. قصدي خمسة.`
- **No early finalization would have committed the turn** at the experimental 800 ms: the user resumed in every case
  before it elapsed. So nothing would have gone to DeepSeek.
- **Line 05's margin is 20 ms.** A 780 ms reading pause shows the commit value must come from S8B-05's natural-speech
  measurement, not from this proof.
- At 800 ms commit, a turn's text is ready (p50 680 ms) before it is committed. The turn's E is then the commit silence
  itself, still inside the 900 ms E + A budget on these lines.

**Overlap — the failure, as measured:**

| Session | Word errors (clean line: 0) | What went wrong |
| --- | --- | --- |
| `OVERLAP_04_RESIDUAL_M25` | 1 / 10 | `فهم.`: QANDEEL's own word, from before the user starts |
| `OVERLAP_04_BARGE_IN_400` | 1 / 10 | `فهمك.`: the same |
| `OVERLAP_01_RESIDUAL_M25` | **4** / 8 | `فهمك.` from QANDEEL; `احكي لك` split (2, formatting); `الشغل` heard as `الشعور` |
| `OVERLAP_01_BARGE_IN_400` | **3** / 8 | `فهمك.` from QANDEEL; the user's first words `عايز أحكيلك` replaced by QANDEEL's `أول خط` |
| `OVERLAP_01_FULL_0DB` (reported only) | 8 / 8 | QANDEEL's sentence transcribed instead of the user's |
| `OVERLAP_04_FULL_0DB` (reported only) | 10 / 10 | the same |

- **QANDEEL's own words are transcribed as the user's.** In every mix Speechmatics transcribed QANDEEL's voice before the
  user started, even at −25 dB. This happened because nothing else was in the audio then.
  - A post-hoc diagnostic, not the preregistered verdict, dropped the words that end before the user's measured onset.
    Line 04 stays at 1 and 1. Line 01 becomes 3 (residual) and 2 (barge-in), so it still fails.
- **At the barge-in, QANDEEL's voice won.** With QANDEEL at the user's level for the first 0.4 s, Speechmatics kept
  QANDEEL's words and lost the user's first two words on line 01, though not on line 04.
- **At the speech's level throughout, Speechmatics transcribes QANDEEL, not the user.** The two `FULL_0DB` sessions show
  this; they are consistent with sample 20 in §9.17.
- **On line 01 the end of speech was found late.** The energy VAD heard the line's tail until 4.08 s against the measured
  3.44 s end, so the text was ready at 1.32 – 1.37 s. Line 04 was ready at 0.73 – 0.76 s. That is the stand-in VAD's
  threshold, not Speechmatics; these sessions are not gated on time.

**What this does and does not establish:**
- **Synthetic mixes are not the phone's echo canceller** (the Product Owner's point 6). The −25 dB residual here is clean,
  undistorted speech. The barge-in variant has no echo cancellation during its first 0.4 s.
- **What the run shows is the requirement the device path must meet:** the ASR must not receive, or must discard,
  QANDEEL's own voice. That means the platform echo canceller, plus discarding ASR words that end before the on-device
  VAD's user onset while QANDEEL is playing (§4.4). Otherwise QANDEEL's words become the user's turn.
- That design point is recorded here for S8B-05 / S8B-06 and is not implemented. Without the device proof, nothing
  establishes that the residual after a real echo canceller is low enough.

**The recommendation:**
- **Speechmatics Enhanced `ar_en` is recommended for production integration — conditionally**, as a single-speaker
  preliminary result. The verdict stays `NOT ACCEPTED`; this is not a numerical pass.
- **The basis:**
  - latency is solved by QANDEEL's own endpoint (text ready p50 680 ms; forced answer p50 164 ms);
  - clean-speech accuracy and every §9.17 check held at `max_delay` 0.7;
  - no word was lost or repeated across a thinking pause;
  - the Product Owner's waiver for English and names stands (§9.18).
- **The conditions:**
  1. **On-device barge-in becomes a blocking pre-launch gate, not merely a condition.** It must be proven on devices in
     S8B-06 before launch: the platform echo canceller, the on-device VAD after AEC, playout stopping, and no QANDEEL
     word reaching the user's turn.
  2. **The integration discards ASR words before the user's on-device VAD onset while QANDEEL plays** (a design point
     for S8B-05).
  3. **The commit silence is set in S8B-05** from natural speech. 800 ms is experimental, and line 05 came within 20 ms
     of it.
  4. **An account tier sized for concurrent sessions** (§9.18).
- **If the Product Owner does not accept the overlap result:** a change of provider would need the same overlap test
  first. Overlapping voices at equal level are a hard case for streaming ASR in general, and this run gives no evidence
  that another provider does better. The overlap failure is not shown to be a Speechmatics limit; the device path is
  where it is decided.

**Verification after the run:**
- The harness contract passes 48 of 48 with the `forced` correction.
- No re-run, and no further paid call.

**Status:**
- ASR is **recommended conditionally**. It is not selected until the Product Owner decides.
- No CP3, no PR, no merge.
- *(Superseded by §9.21: the Product Owner selected Speechmatics.)*

### 9.21 The Product Owner's ASR selection — APPROVED (2026-10-28)

The Product Owner made this selection after reviewing §9.17 – §9.20 (PO DECISION — Speechmatics Selection). It is recorded
as given.

| Decision | Value |
| --- | --- |
| **ASR provider** | Speechmatics real-time, **Enhanced `ar_en`** |
| **Use** | QANDEEL's selected ASR provider, carried into production integration in the Stage 8B tasks that own it |
| **Further selection tests** | none needed; no new comparison with other providers for now |
| **Status** | `APPROVED` |

**The decision's limits** (the Product Owner's seven points):
1. **The final proof's verdict stays `NOT ACCEPTED` (5 / 6)** (§9.20). It is neither changed nor presented as better than
   it is. §9.17's `NOT ACCEPTED` / `NOT READY` and the §9.18 waiver also stand as recorded.
2. **The Product Owner selects Speechmatics although the synthetic overlap test failed.** The overlap problem remains a
   **mandatory gate before launch**.
3. **The endpoint path is approved: QANDEEL's VAD and `ForceEndOfUtterance`.**
   - Finalizing the text is separate from ending the user's turn.
   - An early finalization is never permission to send a reply to DeepSeek.
   - The production commit silence is decided in S8B-05. The 800 ms of §9.19 – §9.20 is experimental only.
4. **S8B-05 / S8B-06 must test:**
   - echo cancellation;
   - detecting the user's speech while QANDEEL is playing;
   - stopping QANDEEL's audio immediately;
   - keeping QANDEEL's own voice from reaching the ASR.
5. **Discarding the words before the user's onset is not enough on its own.** It must also be shown that the user's first
   words are not lost during the overlap (§9.20 line 01: `عايز أحكيلك` lost at the 0 dB barge-in).
6. **Barge-in succeeding on a real device is a condition that blocks the launch of calls.** It is not a deferred
   improvement.
7. **Production capacity and cost:** the concurrent-session capacity (the free account allows 2, §9.18) and the cost are
   taken into account when the production environment is prepared.

No further Speechmatics test round is opened to select the provider.

**Where the decision binds:**
- **The contract** records it in `docs/voice-runtime-v1.md` §4.7, with the S8B-05, S8B-06 and S8B-08 rows of §16.
  It holds the selection, the endpoint path, the barge-in requirements, the launch condition, and capacity and cost.
- The PO's obligations bind tasks inside Stage 8B (S8B-05, S8B-06, S8B-08) under `QAN-BL-VOICE-01`. None leaves the
  stage, so none is cross-task residue (BG-06), and nothing is admitted to the backlog.
  - The iOS echo-cancellation property the simulator cannot prove stays in the Stage 9 list that S8B-08 admits (§8;
    contract §14).

**What the selection does not do:**
- **No production code.** No adapter, configuration, endpoint constant, key path or feature gate. The ASR adapter belongs to
  S8B-03 (Voice Notes, batch) and S8B-05 (streaming), under `QAN-BL-VOICE-01`.
- **The CP2 harness stays operator-only and non-production.** That covers `asr-sm.mjs`, `asr-sm-proof.mjs` and their runs.
- **Every voice gate stays closed**, and Voice stays closed to users.
- **ASR's zero retention and no training stay mandatory** (§9.5). VA-11 does not extend to ASR.
  - The Product Owner confirmed model training `OFF` on the evaluation account (§9.16, §9.20).
  - The production account's terms are re-verified when it is set up (D-3 / §7).

**The CP2 closure position** (for the Product Owner's review):

| CP2 part | State | Where |
| --- | --- | --- |
| VA-11, the Gemini TTS retention exception | candidate amendment, written | §9, VA-11 |
| TTS evidence: AI Studio run, PayGo check, full Cloud evaluation | done, three runs consumed | §9.2 – §9.9 |
| **TTS selection** | **APPROVED**: Gemini `gemini-3.8-flash-tts`, Achird, one path | §9.10 |
| ASR evidence: the PO's 20 recordings, then the final proof | done, two runs consumed | §9.13 – §9.20 |
| **ASR selection** | **APPROVED**: Speechmatics Enhanced `ar_en`, with the seven limits | §9.21 |
| Latency stages E and A | measured: text ready p50 680 ms, forced final p50 164 ms | §9.20 |
| Latency stages T, G, R and S | measured | §9.3, §9.9 |
| Replay render spike | done locally, 8 / 8; phone playback not verified on a device | §9.15 |
| Stage P (Orchestrator pre-generation) | **not run** at this review. The Product Owner then had it measured locally inside CP2 (§9.22) | §9.5, §9.22 |
| Stage N (network, jitter, playout) | S8B-06, on the device | contract §11 |
| ASSISTED arm | not run; not justified by the BASELINE / RENDERED evidence | §9.5 |

**The spend:**

| Run | USD |
| --- | --- |
| AI Studio, `s8b01-cp2-r1` | 0.1155 |
| Google Cloud: PayGo check, then `s8b01-cp2-cloud-r1` | 0.0031 + 0.7950 |
| Speechmatics, `s8b01-cp2-asr-sm-po-r1` | 0.0345 |
| Speechmatics, `s8b01-cp2-asr-sm-proof-r1` | 0.0201 |

- Each run stayed inside its own approved cap, with no retry. The Speechmatics figures are wall-time upper bounds taken
  from the free credit.

**Still open, for CP3 (S8B-01's last checkpoint: closure only, not started):**
- The REALTIME budget values (VA-4) and the codec and render placement (§7).
- Cost per minute for the selected pair.
- The final lifecycle of the contract and of VA-1 … VA-11.
- BG-08 / BG-09.
- The two open TTS questions (§9.10) stay with S8B-04: the production route, and AI Studio logging.

**The branch:**
- `s8b/s8b-01-cp2` is local only: every CP2 commit on `de774cfd`, ending at this change, never pushed, with no pull request.
- Merging CP2 needs a pull request, and opening one needs the Product Owner's authorization.
- Not done here: no push, no PR, no merge, and CP3 not started.

**Status: `CP2 DELIVERED — TTS AND ASR SELECTED — AT THE PRODUCT OWNER'S CP2 CLOSURE REVIEW`.**
*(Superseded by §9.22: the closure review approved, stage P measured, CP2 complete.)*

### 9.22 Stage P measured locally; CP2 complete (2026-10-28)

**The Product Owner's decision** (PO DECISION — Final Measurement Before PR):
- The closure position of §9.21 is reviewed and approved, with the Speechmatics selection and its obligations recorded for
  the later tasks as stated there.
- **Stage P is measured locally inside CP2 before it closes.** It belongs to the contract's original scope (§11: "CP2
  (local, free)").
- **The terms:**
  1. one local, bounded measurement, with no paid API call;
  2. the orchestrator's real path as far as possible;
  3. the method and p50 / p95 recorded and compared with the contract's latency budget;
  4. if missing infrastructure blocks it, no new setup or installation; report the blocker instead;
  5. no new improvement round unless a substantive defect affects the user's experience.
- No TTS or ASR decision and no finished test is reopened.

**The infrastructure — nothing new installed or set up:**
- The PostgreSQL 17.10 binaries already on this machine from earlier local verification (embedded-postgres, outside the
  repository).
- CI-01's own process-owned disposable cluster: `scripts/ci-01/local-db.mjs start` migrates a fresh `mkdtemp` cluster on
  127.0.0.1, and `stop` removes only what it created.
- CI-01's network guard.
- Two temporary directory junctions to the main checkout's installed `node_modules`, the root and `apps/api`, so that the
  worktree resolves its packages. They are removed after the run.

**The method:** `scripts/s8b-01/stage-p.mjs` (the launcher), `stage-p.ts` (the driver), `stage-p-plan.json`; run
`s8b01-cp2-stage-p-r1` at `9c1b21d1`, results under `artifacts/evals/s8b-01/stage-p/` (gitignored).
- **What is real:** the production `ConversationOrchestratorService` and every service it calls, unmodified. That covers
  context, Safety, Memory control, interaction preferences, the HIM lane (snapshot, reflection, cross-context, brain
  context), Memory and Hypothesis gathering, Question selection, guidance and the budget assembly.
  - CI-01's composition, plus `InteractionPreferencesService`, which CI-01's wiring predates.
  - Between turns, the real post-response pipeline (publisher, then dispatcher) runs as in CI-01, so the rows it writes
    accumulate.
- **What is a double:**
  - the Model Router, which stamps the instant it is asked for the reply and answers a fixed line;
  - PostgREST, replaced by a *pooled* SQL transport: one transaction per request, with the request's role and JWT claims,
    so the orchestrator's parallel lanes stay parallel (CI-01's single serialized client would inflate P);
  - the background hypothesis providers;
  - CI-01's semantic-chain fixture;
  - Personal Understanding capture, left off, since it is an optional model call.
- **P** = from `orchestrate()` entry to the orchestrator's Model Router reply call (`this.router.generate`). Turn admission
  (`createTurn`) is not inside P.
- **The inputs:**
  - 6 synthetic accounts × 10 invented, ordinary Egyptian Personal turns = **60 turns per pass** (`bench-plan.json`
    `orchestratorOverhead.runs`);
  - each turn reaches the reply call: no Safety block, no Memory or preference command;
  - one warm-up account per pass is reported, not counted.
- **Two passes in the one run:**
  - `LOCAL`, measured;
  - `ASSUMED_RTT_20MS`, which adds 20 ms to each data request. That is an **assumption, not a measurement**, standing in for
    the API → hosted PostgREST round trip.
- **The network guard** recorded 14 blocked attempts, exactly its 14 self-test probes. No other network attempt was made.
- Windows dev machine, Node 24.19.0.

**Results** (60 turns per pass; every turn reached the reply call, all on the FAST path, no error):

| Pass | P p50 | P p95 | max | data requests before the reply call |
| --- | --- | --- | --- | --- |
| `LOCAL` (measured) | **8.4 ms** | **17.4 ms** | 19.4 ms | 11 (max 12) |
| `ASSUMED_RTT_20MS` (assumption) | 136.7 ms | 171.6 ms | 172.2 ms | 11 (max 12) |

- **The code's own cost is small:** about 8 – 17 ms. The rest of P in production is round trips to the database.
- With 20 ms per request, P rose by about 128 ms at p50: roughly **6 of the 11 requests lie on the sequential path**, and the
  rest overlap. The 170 ms turns (3, 6, 9, 10) add about two more sequential requests.
- **A cold first turn** after process start took 140 ms (warm-up, not counted). It reaches the steady 8 – 20 ms within
  about eight turns.

**Against the contract's budget** (§11; a planning budget only, never a statistical bound):
- **The earlier live-call assumption for P was 50 – 100 ms** (§9.3).
  - Measured locally: 8 / 17 ms, well inside it.
  - With the assumed 20 ms round trip: 137 / 172 ms, above it. The real figure depends on the API ↔ PostgREST round
    trip, which only the hosted path measures (S8B-05).
- **The planning composition at p50, for the selected path:**

  | Stage | p50 | Source |
  | --- | --- | --- |
  | E | ≈ 800 ms | the experimental commit silence; the text is ready at 680 ms, so A is hidden inside it (§9.20) |
  | P | 8 – 137 ms | this section |
  | T + G + R + S | 1505 ms | Flash (§9.3) |
  | N | 100 – 200 ms | assumption |
  | **Total** | **about 2.4 – 2.6 s** | against the 1.5 s target |

- **P is about 1 – 5 % of that total.** It is not where the target is missed: T + G + R + S and E are.
- The §11 levers (speculative generation on a stable transcript, a shorter first chunk, a REALTIME `max_tokens`, endpointing)
  belong to S8B-05, which must meet the target end to end.
- **No defect affecting the user's experience was found in P, so no improvement round is opened** (term 5).

**What the measurement does not cover:**
- the hosted round trips (the second pass is an assumption);
- the DEEP path (every turn routed FAST);
- the realtime voice turn path, which does not exist until S8B-05;
- the work lease and session read inside `createTurn`, and authentication, which sit outside P;
- **whether the accumulated Memory rows were served** on the later turns. The harness did not record it, and it swallowed
  the background dispatcher's errors. The flat per-turn P suggests no large growth over ten turns, but this is not shown.

S8B-05 re-measures P on the implemented realtime path against the hosted database, inside the end-to-end measurement that
decides the target (§11).

**Verification:**
- The harness contract passes 49 of 49, including a new Stage P test: the plan's 6 × 10 = `runs`, the assumption labelled,
  the CI-01 guard and cluster, and no production import.
- The run itself, recorded above.

**CP2 is complete:**

| CP2 part | State |
| --- | --- |
| VA-11 | candidate amendment, written |
| TTS evidence and selection | **APPROVED**: Gemini `gemini-3.8-flash-tts`, Achird |
| ASR evidence and selection | **APPROVED**: Speechmatics Enhanced `ar_en`; the proof's `NOT ACCEPTED` kept; device barge-in blocks the launch of calls |
| Latency, measured | E and A (§9.20); **P (this section)**; T, G, R and S (§9.3, §9.9) |
| Latency, not in CP2 | N, on the device (S8B-06) |
| Render spike | done locally |
| ASSISTED arm | not justified |

- **Every production capability stays `NOT IMPLEMENTED`:** the ASR and TTS adapters, the endpointing, barge-in, Speech
  Rendering, the realtime path and the gates. Every voice gate is closed.

**The branch, ready for a pull request:**
- `s8b/s8b-01-cp2`, on `de774cfd`, all local, never pushed.
- The tracked tree is clean, and its own checks pass:
  - the harness contract, 49 of 49;
  - the governance contract;
  - the four root contracts.
- No production code changed (`apps/`, `packages/` and `database/` are untouched since `de774cfd`).
- Pushing, opening the pull request and merging each need the Product Owner's authorization. CP3 has not started.

**Status: `CP2 COMPLETE — READY FOR THE PULL REQUEST, NOT OPENED (AWAITING THE PRODUCT OWNER'S AUTHORIZATION)`.**
