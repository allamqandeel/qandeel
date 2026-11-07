# QANDEEL S8B-07 — Original Audio Replay, Media Rendering & Distribution: Implementation Record v1

**Checkpoint:** S8B-07 CP1-B — Retained Call Listening & Original Audio Replay Playback (2026-11-07) — **CP1-B IN
PROGRESS** (§13). On `s8b/s8b-07-cp1b` from `main` at `9eace91d`; **not merged; merge only on the Product Owner's
explicit «ادمج»**. S8B-07 is not closed. Every voice gate stays `DISABLED`, and the Personal Replay gate has no open
state. Not VOICE LAUNCH READY.

**Post-merge reconciliation (K-9, recorded by CP1-B step 0):**
- CP1-A merged through PR #383 as `2beaa7c0`. Migration `0195` is **not hosted**.
- INFRA-07 and the CP1-B final contract approvals (§12 – §12.5) merged through PR #384 as `9eace91d`.
- The CP1-A banner below is its pre-merge snapshot.

*(Pre-merge snapshot, as written at CP1-A's delivery:)* **Checkpoint:** S8B-07 CP1-A — Original Audio Source Truth (2026-11-05) — **CP1-A DELIVERED — NOT CLOSED**.
On `s8b/s8b-07-cp1a` as a Draft PR from `main` at `e9311ca1`, **not merged; merge only on the Product Owner's explicit
«ادمج»**. **CP1-B is not started and not authorized.** S8B-07 is not closed. Migration `0195` is **not hosted**. Every
voice gate stays `DISABLED`, and the Personal Replay gate has no open state. Not VOICE LAUNCH READY.

- **The two stop items of the first delivery are resolved by the Product Owner (2026-11-05), both under option (a)**
  (§9):
  - **S-1:** a declared, exact re-anchor of the S7-04 guard admits only `0195`;
  - **S-2:** the API version decoder admits exactly the V1 and V2 render contracts, with the S7-03 / S7-04 hash pins
    re-anchored as declared.
- No test outside the declared re-anchors (§7) was changed.

## 1. Authority

- **The S8B-07 CP0 package, reconciled and corrected (v1.1, 2026-11-05).** It lives outside the repository:
  `QANDEEL_REPORTS/S8B-07/CP0/S8B-07_CP0_RECONCILED_APPROVAL_PACKAGE_v1.1.md`, with `S8B-07_CP1-A_EXECUTION_ORDER_v1.1.md`.
  CP0 was not repeated.
- **The Product Owner's decisions (2026-11-05):**
  - **D-01(a):** CP3 stays Shared Voice Notes. The Shared / Public Replay Surface is admitted as its own backlog item, with
    no owner invented (§10: `QAN-BL-NAV-03`).
  - **D-03:** Selection-Exact Audio, the full L-1 … L-8 laws, including Whole-Turn Closure; no unselected track is ever
    heard.
  - **D-04:** the Render Contract V2 values and the Source Window Binding Digest. V1 is unchanged.
  - **D-08(a):** source availability is derived live. The I-06D evidence is written by the creator's existing
    reconciliation. It is written at reconciliation, **not automatically when a recording expires or is deleted**, and no
    automatic event is claimed (§6).
- **The CP1-A authorization**, with four mandatory corrections made before `0195` was written (§3).

## 2. What CP1-A delivers

**One forward-only migration:** `database/migrations/0195_s8b_07_replay_original_audio_source_truth_v1.sql`, one
transaction. No earlier migration is changed.

| | What | Where |
|---|---|---|
| A | `replay_render_contract_versions.source_window_binding_digest` (nullable text), plus the binding CHECK. The schema, medium and timing CHECKs are re-created under their own names, keyed on the schema: V1 exactly as in `0102`, V2 the D-04 values. The truth CHECK is untouched, and no row is written. | §1 |
| B | `replay_resolve_source_windows_v1`, the ONE window resolver: metadata only, never a storage key. | §2 |
| C | `replay_derive_source_window_binding_v1`, the canonical binding preimage (package §C.3.1 step 3). | §3 |
| D | `replay_render_contract_digest_v2`, which wraps the byte-identical `replay_render_contract_digest_v1`. | §4 |
| E | `build_replay_render_contract_v1` (forward): an all-text selection is V1 verbatim. An audio selection is V2 only if every window resolves; otherwise it is refused with `REPLAY_RENDER_MEDIUM_UNAVAILABLE` / `0A000`, its cause in DETAIL, and there is no V1 fallback. | §5 |
| F | `derive_replay_version_truth_currency_v1` (forward): a V2 contract is current only while its binding re-derives and its digest commits it. Otherwise it is `RENDER_CONTRACT_MOVED`, which the unchanged finalize answers as `ANALYSIS_CHANGED`. | §6 |
| G | `derive_replay_source_manifest_currency_v1` (forward, from `0155`): an original-audio item whose recording is not readable now is `STALE / SOURCE_UNAVAILABLE`. | §7 |
| H | `replay_lock_source_manifest_v1` (forward, from `0101`): the bound recordings are locked FOR SHARE, ascending, after the units. | §8 |
| I | `resolve_replay_version_audio_plan_v1`, the L-5 plan read, service_role only. It is named `resolve_*` by the `0169` A03 rule: service_role executes only Replay read boundaries named `resolve_`. | §9 |

**What the resolver checks.** For each original-audio item:
- it is a Personal unit of the creator, on a turn whose voice source is the creator's, with an anchor;
- it is selected whole, together with **every unit of its turn**;
- its track matches the turn's role (USER → `USER`, ASSISTANT → `QANDEEL`, a voice note → `NOTE`);
- its recording is readable now (`voice_private.recording_readable_v1`);
- its window is covered. A note is exactly one STORED object, and the anchor is `[0, its recorded duration)`. A call
  window is tiled exactly by STORED segments and recorded gaps: no hole, no overlap, and a discarded range counts only
  through its WRITER_LOSS gap.

**The refusal causes** are internal: `ANCHOR_ABSENT`, `OWNER_MISMATCH`, `TURN_PARTIALLY_SELECTED`,
`RECORDING_NOT_READABLE`, `TRACK_ROLE_MISMATCH`, `NOTE_SHAPE_INVALID`, `WINDOW_WITHOUT_STORED_AUDIO`, `COVERAGE_HOLE`,
`COVERAGE_OVERLAP`. The 0169 wrappers still answer one bounded word: `SELECTION_NOT_SUPPORTED`, or `SOURCE_CHANGED` when
the currency refuses first. No new wire word exists.

**The plan's rows:** `RUN`, `ITEM`, `WINDOW`, `AUDIBLE`, `MIX`, `HELD` (with its exact `elapsed_ms`), `GAP` (clipped to
its window, with its kind), `TEXT`, and `BOUNDARY` (`SAME_RECORDING` with its elapsed time, or `CROSS_RECORDING` with
NULL, i.e. untimed).
- It answers only for the person's own V2 version that is currently available and whose binding still re-derives.
- It asks the ONE availability derivation (`derive_replay_version_current_availability_v1`), never the source currency
  directly. That keeps verify-0155 R05's consumer set exact.
- It returns no key, URL, path or text.

**The API decoder admits exactly the two approved contracts** (S-2 option (a)).
- `replay.service.ts`'s version decoder accepts V1 exactly as `0102`'s CHECKs and V2 exactly as `0195`'s (D-04), value
  for value: the schema, the medium and all twelve policies.
- Any other schema, any mix of the two, and any single policy changed is refused whole (`UNAVAILABLE`).
- The wire keeps its shape: the same keys, and no binding, key, plan or new field. The repository, the controller, the
  types and `0169` are unchanged.
- Proven by `apps/api/src/replay/replay-render-contract-v2.spec.ts` (positive and negative).
- The mobile composite still refuses a V2 version whole (`RENDER_CONTRACT_NOT_HONOURED`) until CP1-B. No mobile code
  changed, and `projection-adapter.ts` keeps its S7-04 hash.

## 3. The Product Owner's four mandatory corrections

1. **The SQL CHECK.** The V2 branch states `source_window_binding_digest IS NOT NULL` as well as the pattern, because a
   CHECK passes UNKNOWN.
   - Shown on PostgreSQL 17: without it, a NULL V2 binding evaluates to `NULL`, which the CHECK would pass; with it, the
     result is `false`.
   - verify-0195 **B1** proves by real INSERTs that the CHECK refuses:
     - a V2 row with a NULL binding;
     - V2 rows with six malformed bindings (empty, prefix only, uppercase hex, 63 hex digits, no prefix, a trailing
       newline);
     - a V1 row with any binding;
     - a V1 row bearing audio;
     - V2 with V1 pacing;
     - V2 claiming exact source text.

   A well-formed V2 row is accepted. The deploy self-assertion also refuses a CHECK without the clause.
2. **Multi-unit turns.** An audio item resolves only when the selection holds every unit of its turn (L-4). Every unit
   maps to the ONE window of its turn, which the plan presents once.
   - No unit is given a time inside the turn, and nothing ties an analytical transition to a word or an instant inside
     the recording (B3, B4).
   - **This binds CP1-B and its Visual Proof Board** (§5).
3. **CP1-B audio boundary safety.** A STORED segment may be wider than the window it covers. The binding and the plan name
   the segment's own clock range, and the window is the bound (B4: window `[1000, 3000)` on segment `[0, 6500)`).
   - The CP1-B worker must cut to the window **after decoding**, and must never let audio before or after the window, or
     from the other track, through.
   - **Recorded as a CP1-B contract constraint** (§5).
4. **D-08 accountability.**
   - **B6:** a finalized V2 version's source becomes `NOT_CURRENT` at the expiry instant. No sweep ran (the recording is
     still `STORED`), no reconciliation ran, and no I-06D event exists. The creator's
     `reconcile_replay_post_finalization_state_v1` then records exactly one `NOT_CURRENT` event.
   - **B7:** the same holds for an early deletion and for a due account erasure.
   - **S2:** the creator's reconciliation is the only writer of an I-06D source-availability event; the sweep and the
     deletion name no Replay; no recording trigger reaches a Replay.
   - The absence of a system writer is **not** read as automatic recording: none exists.

## 4. The laws in CP1-A, and what remains for CP1-B

| Law | In CP1-A (data and truth) | For CP1-B (playback) |
|---|---|---|
| L-1 own window, own track | The resolver binds the track to the role; the plan's `WINDOW` / `AUDIBLE`. | The worker plays only these spans of only these tracks. |
| L-2 nothing unselected; mix only where both are selected | `MIX` is exactly the intersection of two selected tracks' windows. | No other mix. |
| L-3 one recording, one clock | `SAME_RECORDING` has a proven elapsed time; `CROSS_RECORDING` is untimed. No time is computed from `started_at` / `accepted_at`. | No duration claim across recordings. |
| L-4 Whole-Turn Closure | `TURN_PARTIALLY_SELECTED` (raw primitive), and `NOT_WHOLE_MESSAGES` (the wrapper, first). | One window per turn, presented once. |
| L-5 the plan is derived | `resolve_replay_version_audio_plan_v1`. | The worker consumes the plan, never its own. |
| L-6 held time | `HELD` with its exact `elapsed_ms`. | Its presentation and safe-shortening threshold are on the board (package §C.4). |
| L-7 a gap is never filled | `GAP` by kind, clipped. | Never filled, never stitched. |
| L-8 no fabricated audio | No anchor: `ANCHOR_ABSENT`; no row, no V1 fallback, no transcript promoted. | No synthesis, no silence presented as speech. |

## 5. Constraints CP1-B inherits (binding; from PO corrections 2 and 3)

- **C-B1, one window per turn.** Selecting all of a turn's units is the condition for its audio. They play as the ONE
  window of the turn, never repeated.
- **C-B2, no artificial timing.** No timing ties a Living Analysis transition to a word or an instant inside a recording.
  The Visual Proof Board shows the analysis at the turn's granularity only.
- **C-B3, the window is the bound after decoding.** A stored segment may be wider than its window. The worker decodes the
  segment, cuts to `[start, end)` of the window, and lets nothing before or after the window, or from the other track,
  through.
  - A test must prove no sample outside the window reaches the output: a synthetic segment, wider than the window, with
    a marker tone outside it.
- **C-B4, the plan only.** The worker reads only `resolve_replay_version_audio_plan_v1`, plus the object read by the
  plan's recording and segments. It never reads a recording that the plan does not name.
- **C-B5, private only.** As package §C.4: a `REPLAY_PLAYBACK` artifact exists only for the creator's `PREVIEW_READY` or
  `FINALIZED` V2 version; it is streamed `no-store`, and no I-06C relation can reference it.

## 6. D-08(a) — availability and its evidence

- **Availability is derived, live.** `derive_replay_source_manifest_currency_v1` (G), and through it
  `derive_replay_version_current_availability_v1`, answers `NOT_CURRENT` the instant a bound recording is not readable:
  - expired at its instant, whether or not the sweep has run;
  - deleted;
  - under a due account erasure.
- **The evidence is written at reconciliation.** An I-06D `replay_source_availability_reconciliation_events` row is
  written only when the creator runs the existing `reconcile_replay_post_finalization_state_v1`.
  - An expiry or a deletion writes **no** event by itself.
  - Nothing in `0195` writes one, and nothing here claims an automatic event.

## 7. Declared re-anchors (each stated in the PR body)

1. **`database/verify-migration-0183.mjs` A5.**
   - The preview of the A5 fixture is still refused. On `0195` the cause is pinned: the fixture note has no recorded
     duration, so the binding answers `NOTE_SHAPE_INVALID`.
   - Once the note's duration (4 200 ms) is the anchor's end, the same draft is admitted, and only as a V2 contract bound
     to its windows. No V1 row ever bears audio.
2. **`database/verify-migration-0194.mjs`:** "0194 is the last migration" → "exactly 0195 follows 0194".
3. **`tests/intel-04-thread-lifecycle-derivation-contract.test.mjs`:** the same re-anchor.
4. **`tests/s8b-05-live-call-contract.test.mjs`:** the `slice(-7)` list adds `0195`, with its RE-ANCHORED line.
5. **`tests/s7-04-replay-player-navigation-contract.test.mjs`, the "no Replay migration after `0169`" guard** (S-1
   option (a)).
   - `APPROVED_LATER_REPLAY_MIGRATIONS` holds exactly one whole file name,
     `0195_s8b_07_replay_original_audio_source_truth_v1.sql`. It is not a pattern or a prefix, and no future Replay
     migration is admitted. The guard itself is kept.
   - Proof: a new test asserts that the list is exactly that name, that `0195` is admitted, that it is the only Replay
     migration after `0169`, and that `0198_replay_any_v1.sql` is refused with the guard's message.
   - Four new planted cases are refused: `0196_s8b_07_replay_original_audio_source_truth_v2.sql`,
     `0195_replay_shared_surface_v1.sql`, the approved name with a `.bak` suffix, and `0197_REPLAY_render_v3.sql`. The
     existing `0170_replay_player_v1.sql` case still holds.
6. **`tests/s7-03-replay-composite-visual-proof-contract.test.mjs` and `tests/s7-04-…`: the `replay.service.ts` hash**
   (S-2 option (a)).
   - Both pins move from `2a3bdb23…` to `5ea40730…`, each with an `S8B-07 CP1-A RE-ANCHOR` comment.
   - The only change in the file is the decoder. The service diff adds the two contract constants and
     `isApprovedRenderContract`, replaces the `isText` checks of the schema, the medium and the policies with it, and
     drops the now-unused `isText`.
   - Every other pin, the G-1 decode lines, the F-2 scope checks and every other S7-03 / S7-04 guarantee are untouched,
     and both contracts pass in full.
7. **`apps/api/src/replay/replay.spec.ts`, the fixture** (a consequence of S-2).
   - Its version fixture carried V1 values that `0102`'s CHECKs could never store (`qandeel.replay.render-contract.v1`,
     `TEXT_ONLY`, `NONE_V1` …). It now carries the real V1 values, and its one expectation names the same real values.
   - No assertion is removed or weakened. The spec is not pinned by any contract.

**Not re-anchored:**
- **verify-0102 V07:** its insert carries the V1 schema and still fails `medium_check` / `timing_check`. It passes
  unchanged.
- **verify-0103 C04:** passes unchanged.

**One function was renamed:** the plan read was renamed before delivery to meet verify-0169 A03 unchanged (§2 I).

## 8. Verification

**Executed locally,** on a disposable PostgreSQL 17 (port 55441; `0000` … `0195` on a fresh database; synthetic humans;
rows only, no media byte):
- `verify-migration-0195`: **16 / 16** — S1a, S1b, S2, S3, S4, B1 – B9, B4b, R1.
  - R1 is two sessions: a preview holding its recording FOR SHARE makes the owner's deletion wait (`55P03` under a
    700 ms lock timeout). After the commit, the deletion proceeds and the finalization answers `SOURCE_CHANGED`.
- `verify-migration-0100` … `0107`, `0169` and `0183` … `0194` on the `0195` database: **all pass**, with the declared
  re-anchors.
- **Re-run after the S-1 / S-2 corrections**, on fresh clones: `verify-migration-0195`, `0169`, `0183`, `0102` and `0103`,
  all pass. `0195` itself is unchanged since `91472f13`.
- **The contract tests,** on the final tree:
  - every `tests/*.test.mjs` except the forward-safety mirror: **1 753 / 1 753**;
  - the forward-safety mirror (`tests/forward-safety-contract.test.mjs`): **35 / 35**;
  - the Stage 7 contracts `s7-01` … `s7-05`: **159 / 159**. Only `s7-03` (one pin) and `s7-04` (one pin, the guard,
    four planted cases and one proof test) changed;
  - `test:task-closure-governance-contract`: passes.
  - **An environmental flake, shown by independent re-runs:**
    - the first full run, before the corrections, had one QAN-INF-02 failure: it saw another test's live temp directory
      while the suites ran in parallel;
    - run alone, QAN-INF-02 passes 14 / 14;
    - in the final full run it passes.
- `verifier-hazards`: 0 findings.
- **API (jest):**
  - the four Replay suites: **84 / 84**, including the new decoder positives and negatives;
  - the whole API: 6 166 / 6 167 tests, 267 / 339 suites.
  - **Every failure is environmental**, one cause: the local `node_modules` (a junction) has no `openai` package, so the
    72 suites and the one test that load `deepseek-client.ts` cannot compile. None is a Replay suite. CI installs the
    dependencies with `npm ci`.

**Predicted, not executed:** the exact-head API CI and Mobile CI. CI is the authority, and the local PostgreSQL is only a
pre-check. No paid service, provider call, hosted database or device was used.

## 9. Stop items: as raised, and as resolved

- **S-1 — the S7-04 "no Replay migration after `0169`" rule.**
  - **As raised (first delivery, commit `91472f13`):** `0195`'s approved name contains "replay", and the S7-04 rule was
    not among the declared re-anchors. Nothing was changed; the test failed.
  - **Resolved by the Product Owner, option (a):** a limited re-anchor that admits only `0195`. The guard is kept,
    nothing is widened to future Replay migrations, and the proof required is in §7 item 5.
- **S-2 — an exact API decoder.**
  - **As raised:** the decoder accepted any non-empty policy text, and `replay.service.ts` is hash-pinned by S7-03 and
    S7-04.
  - **Resolved by the Product Owner, option (a):** the decoder is tightened to the exact V1 and V2 values. V1 behaviour is
    unchanged, any unknown schema or changed policy is refused, the wire is unchanged, and the phone still refuses V2. The
    hash re-anchor is declared and limited to that change (§2, §7 items 6 and 7), with real positive and negative tests.

## 10. Backlog (BG-05 / BG-06 / BG-08)

- **Worked, not delivered:** `QAN-BL-VOICE-01` (its "Current truth" line for CP1-A).
- **Admitted (BG-06, D-01(a)):** `QAN-BL-NAV-03`, the Shared / Public Replay Surface: `UNASSIGNED`, `MEDIUM`,
  `OPEN — UNASSIGNED`. No owner is invented.
- **Not admitted:** the analytical subject-authority producer (D-07 is not decided in this authorization).
- **Read and left unchanged:**
  - `QAN-BL-ACCT-03`: `0195` adds no relation and no new personal footprint. The binding is a column of a Replay row
    that the `0169` module already erases. It reopens at CP2-B and CP3.
  - `QAN-BL-INTEL-05`: separate, not merged into S8B-07.
  - `QAN-BL-VOICE-02` … `05`, `07`, `08`, `09`.
  - `QAN-BL-PRIV-05`.
  - `QAN-BL-PROD-06` / `08` / `09`: `0195` is not hosted.
- **BG-09:** S8B-07 is not closed. This record carries `CP1-A DELIVERED — NOT CLOSED`, and so do the locators.

## 11. Deliberately not done

- CP1-B: the transient mix, the worker, the player, the board and the Copy Gate.
- CP2 / CP3.
- Any media byte; any mobile code.
- Any gate opened; any retention written; any provider or paid call; any hosted deployment.
- Not reopened: S8B-06 or INTEL-04. Not merged into this task: INTEL-05 or GCR.
- `finalize_replay_version_v1`, `prepare_replay_preview_v1`, `0104` and every I-06C function are not replaced.

## 12. The Product Owner's INFRA-07 decision (2026-11-07): Dedicated Replay Infrastructure & Future Credit Accounting

**What this section is.** A contract and project-map update only. It is not CP1-B and does not implement or authorize
anything:
- no migration, code, gate change, hosted deployment, paid call, Google Cloud resource or merge.

The analysis, the Delta and the open decisions are in the WP0 package,
`E:\QANDEEL_REPORTS\S8B-07\S8B-07_DEDICATED_REPLAY_INFRASTRUCTURE_UPDATE.md`. That file is outside the repository.

### 12.1 The decisions

| ID | Decision |
|---|---|
| INFRA-07-01 | Every Replay operation runs on a **Replay Media Compute Pool**, physically independent of the **Live Voice Compute Pool**: listening to a finished call, preparing and mixing audio, private Replay playback, video rendering and A/V sync, export / distribution files. The Live Voice pool keeps its resources, has absolute priority and hosts no Replay worker. The Replay pool owns its queue and cannot borrow live-call resources. Same-host separation (processes, CPU affinity, a dedicated core) is **not** sufficient. Shared PostgreSQL, object storage, network, background queues and API resources are isolated and proven. Two GCP projects alone prove nothing. **Mandatory acceptance:** under high, concurrent Replay + video-render load, First Audio and live reply speed stay within the approved limits. Insufficient Replay resources → deferred or temporarily refused; **never** Live Voice resources |
| INFRA-07-02 | GCP project `qandeel-replay` ("QANDEEL Replay"; billing "My Billing Account"; Cloud Run Jobs available, none created) is the **proposed** destination. Cloud Run Jobs is a candidate for video rendering, not a final choice for every workload. The current voice project is unchanged |
| INFRA-07-03 | The Dedicated Replay Compute Pool is an **architectural condition**, with no fallback to Live Voice hosts. It supersedes the WP0 proposal of CPU affinity or a dedicated core on the same host (A-5) |
| INFRA-07-04 | No Replay starts during a running call. After the call, a Replay can be made while the original recording exists and is valid. The original audio matches the map's historical image. The established time boundaries are used, with no per-word timing. The final video needs A/V sync and device playback tests. CP1-A Source Truth and Whole-Turn Closure are unchanged |
| INFRA-07-05 | Confirmed, not a change: the three destinations (§9.3 of the [Voice Runtime contract](../voice-runtime-v1.md)). **No automatic expiry of the final video** because of time or the source's expiry. The phone copy is the user's; the external copy also follows the receiving platform, and QANDEEL claims no control after delivery; the published copy follows Public World privacy, withdrawal, deletion and permissions. Processing files are not the final video and stay under their cleanup contract. No maximum Replay duration is set: it needs its own decision from CP2's measurements and cost |
| INFRA-07-06 | Stage 9 (future planning): Replay joins the unified Credit balance ([Project Map](../../QANDEEL_PROJECT_MAP.md), unified credits). Not implemented, and no price set |

### 12.2 How the earlier texts read with it

- **D-C1** (S8B-01 record §10.9) and §9.2 of the Voice Runtime contract: "a resource-bounded background worker inside the
  existing architecture". INFRA-07-01 **tightens** "runs apart from the Voice Gateway's process" into separate compute
  pools. One codebase with deployment roles, one database and one PostgreSQL job table keep "no second Replay engine and
  no microservice". No Controlled Amendment is needed.
- **Hosting:** "Backend V1: Railway" is a recommended baseline, not frozen (the Foundation Freeze lists deployment sizing as
  configurable). A Replay pool on GCP is a deviation recorded for `HOSTED-DEPLOY-01`.
- **Confirmed by the Product Owner on 2026-11-07 (§12.4):**
  - (P-6) a delivery not completed when its source expires fails (PO decision 10), so only a delivered or published video
    is the never-expiring final video;
  - (P-7) GCR-01's "bounded spending" read as planned, credit-backed, monitored spend.
- **CP1-B's own WP0 decisions P-1 … P-5** are in the WP0 package, and were decided on 2026-11-07 (§12.4):
  - the Replay Media Service;
  - V-24a / V-24b;
  - the Replay DB role;
  - the watchdog;
  - the resource columns.

### 12.3 Backlog

Nothing is admitted or tombstoned by this documentation change. The hosted two-pool proof (V-24b) and the GCP resources
are residue for CP1-B's closing change to admit under BG-08, with `HOSTED-DEPLOY-01` / GCR-01 as candidate owners.

### 12.4 The Product Owner's approvals (2026-11-07)

Status: `S8B-07 INFRA-07 — PO DECISIONS RECORDED — READY FOR FINAL CONTRACT REVIEW`. Documentation and decision recording
only.

| # | Decision | Recorded as |
|---|---|---|
| P-1 | Every Replay media, control and streaming route runs on the Replay Media Compute Pool. The Live API keeps only the finished-call read | **APPROVED** |
| P-2 | V-24a before the CP1-B merge. V-24b, true isolation on two independent environments, before any hosted Replay deployment or any gate opening. It is re-run with video-render load at CP2-A | **APPROVED** |
| P-3 | The Replay PostgreSQL role: `CONNECTION LIMIT` 10, `statement_timeout` 5 s, `lock_timeout` 1 s, `idle_in_transaction_session_timeout` 10 s | **APPROVED AS INITIAL VALUES**, reviewed by measurement; not permanent growth limits |
| P-4 | No Replay violation watchdog in the Live API or on call servers. Monitoring is an independent party that uses no Live Voice resource, detects the Replay pool's own failure, raises an alert, and does not depend only on a worker that may stop | **APPROVED WITH CHANGE** |
| P-5 | Content-free resource data per Replay job for Stage 9 | **APPROVED** |
| P-6 | A delivery not completed before its source expires fails. A delivered or published final video does not expire because the source did; privacy, deletion and withdrawal still apply | **CONFIRMED** |
| P-7 | A disciplined economy is cost planning, measurement, Credits and monitoring, not a hard spending cap that stops Replay for customers with credit | **CONFIRMED** |
| new | A mandatory Cloud Run HTTP Range streaming test, V-35:<br>- Range resume with no lost and no duplicated audio;<br>- the end of a request, a network loss and a reconnect;<br>- no single non-resumable request for a whole recording;<br>- authorization on every new request;<br>- the stop at the source's end (V-32);<br>- no unauthorized audio copy on the phone.<br>A minimum instance count is not treated as a fix for the request timeout | **RECORDED** |

**Binding separation:**
- Live Voice priority is absolute.
- No Replay worker, video rendering or Replay monitoring runs on a call server.
- There is no fallback.
- PostgreSQL, the object store, the network and the queues are protected.
- `qandeel-replay` exists and is billed, with no Job.
- No hosted resource is created by this decision.

**Consequences in the WP0 package** (outside the repository; the Delta is in
`E:\QANDEEL_REPORTS\S8B-07\S8B-07_DEDICATED_REPLAY_INFRASTRUCTURE_UPDATE.md` §14):
- the same-host DEDICATED / SHARED modes and live-call yield are withdrawn;
- transient keys use a Replay-owned erasure ledger, so the shared `media_erasure_queue` and its CHECK are untouched;
- a scheduled `REPLAY_WATCHDOG` deployment and managed alerting replace the API-side watchdog;
- the tests V-35 (streaming) and V-36 (independent monitoring) are added.

**Not approved at that point** *(approved in §12.5, except the CP1-B start)*:
- CA-07B-1's final text;
- the Copy Gate R1.1;
- the D-06.7 final values and their proof;
- the D-05.7 sample;
- the CP1-B implementation start.

Nothing is admitted or tombstoned here. §12.3 stands, and the hosted alert policies join the V-24b residue it names.

### 12.5 CP1-B final contract approvals (Product Owner, 2026-11-07)

**Status:** `S8B-07 CP1-B — FINAL CONTRACT APPROVALS RECORDED`.
- After the final review of R5.1, the Product Owner approved the six decisions below. They are recorded as approved,
  with no edit.
- The full texts are in the WP0 package, outside the repository:
  - `E:\QANDEEL_REPORTS\S8B-07\CP1-B\S8B-07_CP1-B_FINAL_PO_APPROVAL_SHEET.md` (§0 records the approvals);
  - the contract `CP1-B_MEDIA_RUNTIME_CONTRACT.md` §20;
  - the copy `CP1-B_COPY_GATE_R1.1_FINAL.md`.

| # | Decision | Status |
|---|---|---|
| 1 | **CA-07B-1** (sheet §2.3 / §2.4, with §20 in sheet §2.6 as corrected in R5.1, and every added test: V-27 (h), V-31 (l) … (t) including s1 / s2 / s3, V-35 (8) … (10)):<br>- readability ends with the source, absolutely;<br>- the in-stream cut follows A-2;<br>- physical deletion is asynchronous, due at the first end, with a 120 s **target** under healthy operation, so a **target** within 1 hour of creation, not a guarantee;<br>- misses are recorded and retried;<br>- continuation across the 58-min cap, on at most two live generations, enforced by the single write path;<br>- no extension of the source's retention | **APPROVED AS FINAL** |
| 2 | **HC-1 … HC-5:** acceptance criteria for the hand-over (no lost samples; no audible stop) | **APPROVED** as binding criteria, **not** as passed tests |
| 3 | **Copy Gate R1.1:**<br>- all 28 rows;<br>- CL-11 without its final full stop: «تسجيل هذه المكالمة غير متاح» / "This call's recording isn't available";<br>- the operational mapping (`NONE`, `LIVE_CALL_ACTIVE`, Range resume, continuation) onto existing rows, with no new row | **APPROVED** |
| 4 | **D-06.7:**<br>- First Audio ≤ +25 ms p50 / ≤ +50 ms p95 against a matched baseline, as medians of ≥ 3 interleaved repetitions;<br>- V-24a before the CP1-B merge;<br>- V-24b on two independent compute environments before any hosted Replay or any gate, re-run at CP2-A | **APPROVED** as a binding performance criterion; its proof is still required |
| 5 | **D-05.7 option (b):**<br>- no new UI sound asset now;<br>- the visual frame, the screen-reader announcement and the pacing line are kept;<br>- the future sound improvement is FI 020 in the local Future Improvements log (recording is not an authorization) | **APPROVED** |
| 6 | **G-6:** the (a) recommendations of D-02 … D-02.4 (with `readable_for_ms`), D-05.1 … D-05.6, D-06.1 and D-06.3 … D-06.6, and the later architectural decisions | **CONFIRMED AS WRITTEN** |

**Consistency corrections applied in the WP0 package (R5.1):** K-1 … K-8, K-10, K-11 (sheet §6.2). K-9 (the CP1-A
post-merge wording of the locators) stays with CP1-B step 0, as the approved execution order sets.

**Not authorized by this section:**
- CP1-B, any code, and migration `0196`;
- any Google Cloud or other hosted resource;
- any gate change;
- any merge without the Product Owner's «ادمج».

## 13. CP1-B — Retained Call Listening & Original Audio Replay Playback (IN PROGRESS, 2026-11-07)

**Status:** `CP1-B — IN PROGRESS`.

**Authority:**
- The Product Owner's execution authorization (2026-11-07), after PR #384 merged as `9eace91d`.
- The approved WP0 package, contract version **R5.1**, outside the repository: `E:\QANDEEL_REPORTS\S8B-07\CP1-B\WP0\`.
  - A frozen copy with checksums was taken at the start: `…\CP1-B\frozen-R5.1-at-cp1b-start\`.
  - Where texts differ, the later approved decisions bind: INFRA-07 and R5.1 over the earlier drafts.
- The six decisions of §12.5.

**CA-07B-1 recorded as FINAL (step 0):**
- The binding texts (approval sheet §2.3 / §2.4) are the new §6 of the
  [S8B-01 Controlled Amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md), with the continuation rules of WP0 contract §20. The §2 effect table
  gains the row CA-07B-1 → S8B-07 CP1-B.
- The two narrowed lines stay verbatim, each with a pointer:
  - `docs/voice-runtime-v1.md` §9.1;
  - the S8B-01 record §10.3, the listening row.
- **It binds from CP1-B's merge.** Until then, nothing in it is in force.
- **The board's A9 note** (outside the repository; not a UI string and not a Copy Gate row) is corrected to CA-07B-1
  point 2, with no visual change: a released file is never reused. The Addendum §6 reading "the next tap within the cap
  reuses it" predates R5.1, and is superseded by it.

**Steps (WP0 Execution Order §2; each green before the next):**

| Step | Content | State |
|---|---|---|
| 0 | Documentation first (this section, K-9, CA-07B-1 FINAL) | done in this change |
| 1 | Migration `0196_s8b_07_transient_media_v1.sql` and its verifier on a disposable PostgreSQL 17 | done locally: `verify-migration-0196.mjs` 31/31 on a disposable PG17, earlier verifiers re-anchored (each re-anchor named); not yet run in CI |
| 2 | Media worker, reaper and watchdog (`REPLAY_MEDIA` / `REPLAY_WATCHDOG`) | done locally: `apps/api/src/replay-media/` (API jest 344 suites green), `prove-0196-media-worker.mjs` 21/21 on a disposable PG17 with the pinned ffmpeg 9.0.2 and the in-memory store (60-min listening file 34.8 s against the 128 s D-06.5 cap); the rclone S3 run and the BtbN pin run only in CI; not yet run in CI |
| 3 | Replay Media Service (the five routes, bounded Range responses) | done locally (details below): `replay-media-service.main.ts` under `REPLAY_MEDIA` / `REPLAY_POOL` only; API jest green; `prove-0196-media-service.mjs` 15/15 on a disposable PG17 with the in-memory store; `verify-migration-0196.mjs` 32/32 after the step-3 amendment; the rclone S3 run and the PostgREST proof (`prove-0185`) run only in CI; not yet run in CI |
| 4 | V-24a First Audio isolation (not a proof of pool separation) | done locally (details below): `prove-0196-first-audio-isolation.mjs` on a disposable PG17 with the in-memory store, 3 interleaved repetitions per mode, D-06.7 PASS for M0 and M1_SHIPPED in each full run; `verify-migration-0196.mjs` 33/33 after the step-4 amendment; the rclone S3 run (with the store upload probe) runs only in CI; not yet run in CI. **Not V-24b.** |
| 5 | Mobile | not started |
| 6 | Device proof (HONOR and the iOS Simulator) | not started |

**Step 3, what it adds and what it changed (each change declared in the PR body):**
- **The service.** The five routes of contract §6 and `/health` (§18.3), on the Replay pool's own HTTP process. It
  reaches PostgreSQL only as `qandeel_replay_media` (a LOGIN of that role itself) and verifies the bearer with the
  API's own `SupabaseAuthGuard`. Every answer is `Cache-Control: no-store, private`, a refusal too, and the audio
  never carries a Content-Disposition. The in-stream termination follows §15: the `serve_until − db_now` timer, the 5 s
  re-check with its 2 s fail-closed budget, and destroy, never end. Each response is capped at 10 min (§19); the cap can
  only be lowered.
- **V-32, server part,** measured on PG17 with a client reading at ≤ 16 KiB/s:
  - (a) owner deletion, (c) release, (d) account erasure, (e) the version leaving CURRENT, (g) a release through
    instance A while the stream is on B: destroyed 3.4 – 3.6 s after the commit (bound ≤ 7 s).
  - (b) a known end: destroyed 0 – 15 ms from `serve_until` (bound ± 1 s).
  - (f) a re-check held by a lock, or its connection killed: destroyed (fail-closed).
  - Every cut: no write after the termination instant (an instrumented counter on the response), bytes received below
    the file size, and the next Range answered 404. Under (f) the source is still readable, so the next Range is 206.
  - (h) the control: every byte, with 11 – 13 re-checks answered true.
  - The cut is one point of the 5 s period. For a commit, the analytical worst case is one period plus the check's own
    answer, inside the 7 s bound.
- **V-35a, server parts:**
  - a request timeout, two network drops and an instance restart mid-response: each read resumed with Range to a
    byte-identical file;
  - every answered request re-ran `server_read_transient_media_v1`;
  - a 60-minute file, with the cap lowered to 1 s: 16 bounded responses;
  - the source ending between two Range requests: the second is refused.
  - The phone parts (exact played position, ≤ 3 resumes per minute, no local file) are step 5.
- **V-31 (API) and V-34 over HTTP:**
  - parallel POSTs of one command: one `artifactId` and one ledger row;
  - a reused command: `409 {outcome: COMMAND_REUSED}` and nothing else;
  - a live call: `409 LIVE_CALL_ACTIVE` for listening and for playback, nothing created; once the call has ended,
    allowed.
- **`0196` amended (forward, before any merge or hosted apply):** `voice_private.transient_unavailable_reason_v1` gives
  the PROVEN reason of §0.4. It is EXPIRED or DELETED only when every unreadable source proves that same cause, and
  null otherwise (an account erasure is not a proven cause). It is carried by the set rows, by the refusal's DETAIL and
  by `server_check_transient_media_v1`. A new verify-0196 scenario, V30, proves it.
- **F-1 narrowed (contract §0.3):** the Voice Media object route serves `NOTE` only, and a call track answers 404.
  - **Re-anchored, declared:** `prove-0185` V09's two call-track reads now expect 404. The stored bytes are checked in
    the bucket itself, and "stays readable" is checked through `recording_readable_v1`.
- **The finished-call read v2 (`0196` G):** the API's history page reads `server_read_session_finished_calls_v2`. The
  page now carries `recordingStatus`, `availableUntil` and `unavailableReason`, fail-closed to `UNAVAILABLE`.
  - **Re-anchored, declared:** the conversation spec's repository test names v2.
- **PROD-SEC-01 SEC-A:**
  - The five routes are classified in the one route census (`AUTHENTICATED`; no new class), and the service carries
    the same global rate limit (`HttpSecurityModule`).
  - The census spec reads both applications. They share only the probe, `GET /health`.
  - V-33's static check now reads route decorators, because the census names the routes as data.
- **Deferred to step 5:** the phone's Replay media base URL (configuration, no secret) and `BUSY` under placement `NONE`.

**Step 4, V-24a (INFRA-07 P-2, D-06.7) — NOT A PROOF OF POOL SEPARATION:**
- **What it is.** `database/prove-0196-first-audio-isolation.mjs` runs the approved S8B-05 CP3 harness
  (`apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts`, fake providers with their seeded latencies, 68 exchanges per
  mode) for M0 and M1_SHIPPED, in the order B1 L1 B2 L2 B3 L3: a baseline with no Replay load, then the same harness
  under the Replay load, three times. Every run in one session on one machine, with one database. It is a local
  isolation measurement on a shared machine; it is **not** V-24b, and not a proof that the pools are separate hosts.
- **The load (L runs).** A separate process, `prove-0196-first-audio-isolation-replay-load.mjs`, started behind the
  shipped guard `assertReplayPoolProcess('REPLAY_MEDIA')` and connected as `qandeel_replay_media` itself, with its whole
  CONNECTION LIMIT of 10 (two service instances 3 + 2, two workers 2 + 2, the watchdog 1):
  - two Replay Media Service instances (the shipped module, the global rate limit on, bound to 127.0.0.1);
  - two media workers at the D-06.1 maximum (concurrency 2 each) with the pinned ffmpeg 9.0.2, the reaper, and the
    watchdog every 10 s (deployed: 60 s);
  - 38 simulated people, each its own loopback address and two request loops on two subjects of their own (the D-06.4
    per-person bound): sealed 10-minute and 60-minute calls and Replays of a 6-minute call. Each loop requests, polls,
    reads the whole file in 1 – 3 Range responses at full speed, then DELETEs. That is 76 sets wanted for 32 queue
    places, so the queue stays at its bound and `BUSY` is answered. The loops retry `BUSY` and poll every 250 ms, far
    above a phone, which shows CL-05 on `BUSY` and checks status every 10 s while playing (contract §15.2);
  - one listener at natural speed (64 KiB/s) on a 60-minute file, cut and resumed with Range every 5 s.
  - Every path ran: preparation, mixing, streaming, Range, the definers, the store and the erasure.
- **Saturation is asserted, or nothing is compared (V24A-1).** Each L run: `BUSY` > 0, 24 ≤ pending ≤ 32, workers
  busy at their bound ≥ 70 % of samples, ≥ 8 Replay sessions, the watchdog ran, erasures happened; each B run: no
  Replay session.
- **Placement and no fallback (V24A-2, V24A-3).** Sampled every 500 ms from `pg_stat_activity`: at most 10 Replay
  sessions, no unnamed and no foreign-named session of the Replay role, no other role calling a transient definer, and
  no live session waiting on a lock held by a Replay session. After the last L run the pool is killed with SIGKILL and
  work pending: 15 s later no Replay session exists and no job changed state or lease (no other process took it).
- **The rate limit and the 10-minute cap (V24A-4, step 4 point 4).** The natural listener's response is cut every 5 s
  and resumed with Range from the exact byte, as at each 10-minute response cap (the cap itself is unchanged), so a
  resume is measured under the load. Asserted in every L run:
  - no 429 and no refusal for the natural listener;
  - no phone's read of a READY file refused (every read and Range part answered 200 / 206; counted per route, so a
    refused read cannot hide among admission's `BUSY`).

  The rate limit is per client address (a phone is one address). The 10-minute cap ends a response, not the playback,
  and the step-3 proof already shows the byte-identical resume.
- **Results of the final run (local-r4, on the committed code; Windows 11, i7-11850H, 16 logical CPUs, 31 GiB, PG17, the
  in-memory store).** Every run in ms; the verdict compares the medians of three:

  | Mode | | rep 1 | rep 2 | rep 3 | median | Δ (bound) | verdict |
  |---|---|---|---|---|---|---|---|
  | M0 | baseline p50 | 530 | 535 | 530 | 530 | | |
  | M0 | load p50 | 524 | 527 | 535 | 527 | −3 (≤ +25) | PASS |
  | M0 | baseline p95 | 671 | 668 | 670 | 670 | | |
  | M0 | load p95 | 658 | 671 | 669 | 669 | −1 (≤ +50) | PASS |
  | M1_SHIPPED | baseline p50 | 595 | 589 | 601 | 595 | | |
  | M1_SHIPPED | load p50 | 589 | 607 | 608 | 607 | +12 (≤ +25) | PASS |
  | M1_SHIPPED | baseline p95 | 795 | 809 | 811 | 809 | | |
  | M1_SHIPPED | load p95 | 775 | 818 | 792 | 792 | −17 (≤ +50) | PASS |

  Absolute targets: worst p50 535 / 608 ms (≤ 1.5 s), worst p95 671 / 818 ms (≤ 2.5 s), worst max 687 / 911 ms
  (< 3 s), all PASS. The isolation result (the Δ) and the absolute reply speed are separate verdicts. The absolute one
  is reached with the harness's fake providers, so it says nothing about real provider latency.

  Two earlier full runs, with the generator before its fixes below, also passed D-06.7: local-r1 M0 Δ 0 / +1,
  M1_SHIPPED Δ −2 / −5; local-r2 M0 Δ +5 / +2, M1_SHIPPED Δ 0 / −31.
- **The load in the final run (each L run, about two minutes):**
  - Requests: 3 801 / 3 769 / 3 763, of which `BUSY` 3 720 / 3 679 / 3 649.
  - Pending sets: max 32 in every run. Workers busy at their bound in 95 – 97 % of samples. Replay sessions: 10 of 10.
  - Files made: 53 / 58 / 41 (mixing wall time 368 – 578 s per run across four lanes). Erased: 46 / 54 / 43.
  - Streamed: 111 / 128 / 122 MB in 89 / 114 / 84 reads and Range parts, every one answered 200 / 206.
  - 429: 0. The natural listener: 20 / 20 / 19 resumes, 0 refusals.
  - CPU mean ≈ 87 % (max 98 – 99 %) against ≈ 10 – 11 % in the baselines. Load process RSS 232 – 247 MiB; its event
    loop's delay p99 21 – 23 ms.
  - No fallback: 32 sets pending when the pool was killed; 15 s later 0 Replay sessions and 0 jobs changed.
- **What the load cost the call path (reported, not hidden).** The call path's database commands (commit, Safety,
  begin, activate, end) rose in p95 from 23 – 27 ms in the baselines to 41 – 49 ms under load, with max 91 – 136 ms
  against 47 – 73 ms. Single statements did not move (p95 9 – 24 ms against 13 – 18 ms). No live session waited on a
  Replay lock. The only live lock waits were live-to-live advisory waits (`begin_call`,
  `acquire_background_permit`). The cause is CPU scheduling on one shared machine. First Audio did not move beyond the
  margin.
- **What the storm cost the Replay service itself (reported; no contract bound applies; cause not isolated).**
  - **What was seen.** Under a `BUSY` storm of about 30 requests a second, every route answered slowly, cheap status
    polls included: first byte p50 0.6 – 0.9 s, p95 1.7 – 2.0 s, max 2.0 – 4.4 s. The natural listener's resume first
    byte was p50 545 – 762 ms, max 1 060 ms. In the earlier runs it was p50 ≈ 22 ms; there, a person's two loops
    shared one set, and the storm was about half as large.
  - **What was ruled out, by a diagnostic trial** (one repetition, the same code, a sampler of the Replay role's
    sessions every 100 ms, ≈ 8 700 session samples):
    - the admission lock: 2 samples waited on it;
    - the database pool: all five service connections were busy at once in 7 % of samples, and the sessions were
      mostly idle;
    - the load process's event loop: its delay p99 was ≤ 23 ms.
  - **Where it sits, then:** outside PostgreSQL, in the one load process that hosts both services, the auth gateway,
    76 client loops and the workers' orchestration, on a machine at 87 – 99 % CPU. It was not isolated further.
  - The contract sets no bound for a Replay read's first byte. A resume at a 10-minute cap is no audible stop while
    the player's buffer leads, which is the phone's part (step 5). A phone does not retry `BUSY` itself. The service's
    own latency under its pool's own CPUs belongs to V-24b.
- **Found by V-24a and fixed (forward, before any merge or hosted apply):** `0196`'s admission let two requests that
  each counted 31 pending sets both add one (33 observed against the bound of 32).
  `server_request_transient_media_v1` now takes one transaction advisory lock
  (`qandeel.transient-admission.v1`) before it counts. A new verify-0196 scenario, V31u, proves it: one person's 16
  parallel requests leave 2 active sets; 16 people against 31 pending sets admit exactly one. The scenario fails on the
  old `0196`. C1c is narrowed, declared: exactly this one advisory key, and no other advisory or table lock.
- **The proof's own faults, found and fixed before the final run (no criterion changed):**
  - BUSY was never reached at first, so the phones were raised to 38 (76 loops for 32 places).
  - A Range cut was counted as status 0, so no resume was recorded; the client now keeps the response status.
  - The natural listener now starts first, so its 60-minute file is made before the queue fills.
  - A connecting session (state `NULL`, no name yet) was taken for an unnamed Replay session; it is counted apart.
  - The harness's own teardown, which deletes its people's rows from every table with a `user_id`, was taken for a
    foreign transient session. Now only a call of a transient definer counts.
  - A person's two loops asked for the same subject, so they shared one set (`0196` (b)), and one loop's release cut
    the other's read with 404. That is the contract working; no phone plays one recording in two players. Each loop
    now has a subject of its own, and refused reads are counted per route and asserted to be none.
- **The harness, additive and report-only (declared):** a mode filter (`S8B05_CP3_MODES`), skipping its reliability
  blocks when filtered; the raw First Audio samples; a timer around the call path's SQL. Nothing it measures or
  decides changed, which `tests/s8b-07-cp1b-first-audio-isolation-contract.test.mjs` pins.
- **CI:** the contract test, and the proof once in the rclone step (`REPLAY_PROOF_STORE=s3`). There it adds the store
  upload probe: the call writer's own `S3PrivateAudioObjectStore`, putting to the same store under the load.
- **Not proven here:** V-24b (on the hosted pools), V-35b and the hosted alert policies stay pre-deployment conditions
  (HOSTED-DEPLOY-01). The CI run (4 vCPU, rclone S3) has not happened yet.

**Not authorized:**
- any hosted resource or deployment (`0196` is never applied to a hosted database);
- paid AI;
- any gate change;
- CP2-A or CP2-B;
- any Replay work on a Live Voice host, and any fallback to one;
- a merge without the Product Owner's «ادمج».

V-24b, V-35b and the hosted alert policies remain pre-deployment conditions (HOSTED-DEPLOY-01). They need a separate
authorization for resources and cost.
