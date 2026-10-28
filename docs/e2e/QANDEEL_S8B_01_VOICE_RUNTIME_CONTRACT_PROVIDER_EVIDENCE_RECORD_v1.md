# QANDEEL — S8B-01 Voice Runtime Contract & Provider Evidence — Implementation Record v1

**Task:** S8B-01 — Voice Runtime Contract & Provider Evidence (Stage 8B). This record covers **CP1 — the contract, the
amendments, the benchmark harness and the locator reconciliation** (§1 – §8). CP2, the paid benchmark, and CP3, the
selection and the closure, have not started.
**Status:** `S8B-01 CP1 DELIVERED — AT THE PRODUCT OWNER'S CP1 REVIEW (2026-10-28) — NO PRODUCTION CODE — NO PAID CALL (USD 0.00 OF THE USD 10 CAP) — BENCHMARK LOCKED — NO PROVIDER OR VOICE SELECTED — EVERY VOICE GATE CLOSED / CLOSED TO USERS — NOT MERGED`. S8B-01 is not closed: CP2 and CP3 have not started, and BG-08 / BG-09 are reconciled at S8B-01's last checkpoint, not here.  
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
