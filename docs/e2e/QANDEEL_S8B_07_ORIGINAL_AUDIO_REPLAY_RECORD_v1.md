# QANDEEL S8B-07 — Original Audio Replay, Media Rendering & Distribution: Implementation Record v1

**Checkpoint:** S8B-07 CP1-A — Original Audio Source Truth (2026-11-05) — **CP1-A DELIVERED — NOT CLOSED**.
On `s8b/s8b-07-cp1a` as a Draft PR from `main` at `e9311ca1`, **not merged; merge only on the Product Owner's explicit
«ادمج»**. **CP1-B is not started and not authorized.** S8B-07 is not closed. Migration `0195` is **not hosted**. Every
voice gate stays `DISABLED`, and the Personal Replay gate has no open state. Not VOICE LAUNCH READY.

- **Two stop items are raised for the Product Owner, not resolved here** (§9):
  - **S-1:** the S7-04 contract forbids any Replay migration after `0169`, and `0195` is one by the name the order
    approved;
  - **S-2:** tightening the API version decoder needs the S7-03 / S7-04 hash pins re-anchored.
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

**The API is unchanged.** The 0169 version read passes the D-04 values through the existing decoder, proven by
`apps/api/src/replay/replay-render-contract-v2.spec.ts`. The mobile composite refuses a V2 version whole
(`RENDER_CONTRACT_NOT_HONOURED`) until CP1-B. No mobile code changed.

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
- The contract tests:
  - `tests/*` without the forward-safety mirror, after this record and the backlog: 1 746 / 1 748 pass.
    - One failure is stop item S-1 (§9), the S7-04 rule.
    - The other was a parallel-run collision: QAN-INF-02 saw another test's live temp directory. Run alone, it passes
      14 / 14.
    - Without the experimental line, the forward-safety mirror fails on S-1 alone (an earlier run: 1 772 / 1 783, all
      11 failures S-1).
  - `test:task-closure-governance-contract`: passes.
  - The two re-anchored contract tests: pass.
- `verifier-hazards`: 0 findings.
- **The forward-safety mirror, as an experiment only:** with the S-1 one-line re-anchor applied temporarily (never
  committed, reverted after the run), `tests/forward-safety-contract.test.mjs` passes 35 / 35. That shows S-1 is the only
  blocker there. Without that line, the mirror fails on the S7-04 rule.
- **API:** `replay.spec.ts` and `replay-render-contract-v2.spec.ts`, 67 / 67.

**Predicted, not executed:** the exact-head API CI and Mobile CI. CI is the authority, and the local PostgreSQL is only a
pre-check. No paid service, provider call, hosted database or device was used.

## 9. Stop items for the Product Owner

- **S-1 — the S7-04 "no Replay migration after `0169`" rule.**
  - `tests/s7-04-replay-player-navigation-contract.test.mjs:205-208` refuses any migration after `0169` whose name
    contains "replay". `0195_s8b_07_replay_original_audio_source_truth_v1.sql` is the name the CP1-A order gives. The
    rule is not among the declared re-anchors.
  - Nothing was changed. The test fails, and so does every forward-safety mirror run that executes it.
  - **Options:**
    - (a) a declared re-anchor: "nothing after `0169` is a Replay migration except S8B-07's `0195`", one line, the same
      form as the earlier RE-ANCHORED lines;
    - (b) rename the migration. **Not recommended:** it would dodge the guard's intent, and the name was approved.
- **S-2 — an exact API decoder.**
  - The order asks the version decoder to accept exactly the V1 or the V2 policy row. `apps/api/src/replay/replay.service.ts`
    and `replay.types.ts` are pinned by sha256 in the S7-03 and S7-04 contracts.
  - The decoder today accepts any non-empty policy text, so V2 passes (spec above), but not exactly.
  - **Options:**
    - (a) tighten it in this PR, with the two S7 hash pins re-anchored as declared;
    - (b) keep the permissive decoder until CP1-B, where the mobile side changes anyway.

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
