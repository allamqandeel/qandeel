# QANDEEL — S8B-07 S4/S5 Future In-Speech Understanding Replay Compatibility

**Date:** 2026-11-24  
**Status:** PRODUCT OWNER INTEGRATION DIRECTION / DESIGN GUARDRAIL — DOCUMENTATION ONLY, NOT IMPLEMENTED  
**Dependent gap:** [`INTEL-LIVE-INCREMENTAL-01`](QANDEEL_INTEL_LIVE_INCREMENTAL_UNDERSTANDING_GAP_v1.md), `QAN-BL-INTEL-06` (HIGH, OPEN — UNASSIGNED).  
**Current Replay:** RB-2/S1 `0201` merged not hosted; S3 `0202` Draft PR #408; M-2 `0203` Draft PR #409; S4 consumption and S5 video remain open.  
**Authority boundary:** This is **not** an authorization to implement a provisional analysis producer, to persist interim ASR as durable knowledge, to amend frozen migrations or contracts, or to merge/deploy. The future implementation contract must resolve data provenance, consent, retention, and producer semantics. Any new actual coding requires an appropriately scoped PO execution authorization.

## 1. Product Owner objective

Replay and its video must be built so that future improvements in QANDEEL's understanding *during a long continuous user's speech* can be added WITHOUT replacing the audio timeline, the committed analysis clock, or the full video renderer.

A user can speak uninterrupted for 90–120 s. Several attention changes may occur before the user finishes or QANDEEL speaks. Existing S3/M-2 recover only certified, durable semantic commits; they do not generate these hypothetical interim observations and MUST NOT retrospectively invent them.

## 2. Code-verified seam and current limits

- `apps/mobile/src/replay-cosmos/timeline.ts` is the one historical timeline shared between phone and video. It now has a **moment-oriented knowledge track**. Its `completeAt` guard requires a moment's source window to be presented in full and its availability to be certified; this is valid for authoritative moment-knowledge snapshots, but it cannot express multiple *provisional* attention events within a single long USER window.
- `apps/mobile/src/replay-cosmos/history.ts` derives immutable per-moment visual stages from governed reads; a future attention channel MUST NOT treat a speculative interim observation as a new authoritative TC or as a complete future stage.
- `apps/mobile/src/replay-cosmos/frame.tsx` consumes the same timeline to produce visual frames. New attention presentation should be shared with the mobile experience and the later video pipeline through one deterministic reducer/data seam, not an independently fabricated video behavior.
- `apps/mobile/src/original-audio/replay-audio-clock.ts` owns playback position and the server's presentation map; `apps/mobile/src/original-audio/presentation-map.ts` defines runs, WINDOW, MIX, GAP, HELD, and boundaries. Any future event track must use this mapping rather than assuming raw recorded capture milliseconds equal exported file milliseconds.
- `apps/mobile/src/original-audio/replay-availability.ts` already decodes the strict S3 version/revision/digest-bound availability response. Do not loosen its closed schema, change or reinterpret existing `RECORDED` moments to encode provisional events, or retrofit data by guessing from the final projection.
- The currently available live call engine ignores INTERIM for semantic establishment; this annex does not pretend the future producer is available.

## 3. Required future-facing S4 shape

S4 should plan for **two logically distinct historical lanes sharing one playback clock**:

**A. COMMITTED_KNOWLEDGE lane (existing, authoritative):** `S1 → M-2 → S3` produces certified availability of sealed Replay Moments. Retain `K(TC)`, the current moment order, `completeAt`, historical monotonicity, binding, `UNESTABLISHED`/`BROKEN`/`AFTER_END`, and all forward-only display protections.

**B. IN_SPEECH_ATTENTION lane (future, NOT yet available):** when a future approved intelligence producer supplies historical attention events, Replay can show a *provisional* visual cue/update while the same USER turn continues, and later revise/retract/confirm it. It MUST NOT make a provisional observation look like durable canonical knowledge. This lane's event availability/causal bounds are its own, NOT `Moment.completeAtMs` by default.

The two lanes feed the same **shared presentation-time cursor**, one event ordering/reducer mechanism and one staged visual compositor. The existing knowledge lane still wins any conflict over authoritative state; how a future provisional cue looks or expires is **not approved** by this annex.

### 3.1 Minimal future event **concept** (not a frozen schema)

The S4 boundary must be capable of accepting future **typed and versioned** records that identify, when an authority eventually defines them:

- **Identity and binding:** event ID, session/recording/run and replay version/revision, presentation-map digest, source authority, provenance and event-schema version;
- **Meaning and lifecycle:** attention emerging, update, retract, confirm/supersede; causal reference to prior event(s) or latest authorized scene, without an irreversible memory write from provisional interpretation;
- **Source and clocks:** original capture interval (when relevant), **earliest trustworthy event availability** (not just when source words were spoken), separate known-at/committed-at markers, certified mapping onto a specific presentation run, deterministic tie-break for equal times;
- **Presentation payload:** only authorized, privacy-filtered scene intent/delta referencing permitted objects, not speculative full canonical knowledge or private transcript exposure;
- **Governance:** missing/revoked data, deletion, consent, expiry, accessibility/language, and explicit policy for events outside selected audio windows.

These fields describe extensibility requirements. They DO NOT authorize a new database table, message type, extra recording retention, ephemeral-content export or any arbitrary `clockMs` from the client.

### 3.2 Historical timing rules

- Never infer an event instant from its final transcript or final COSMOS state. A later semantic commit is not backdated to the beginning of the user's utterance.
- No event is shown before the speech evidence needed for its claim has occurred **and** the event was actually available to the historical consumer. Any future exact source/observation evidence must be specified and proven by the intelligence task. Current M-2 S3 certification applies to durable commits, not automatically to speculative attention.
- A future event that lacks validated historical provenance is omitted from the time-based lane or explicitly not established. It must not use an invented or guessed timestamp.
- Translate capture clock → recorded audio run → selected presentation file position at or after the proven instant; uphold shortened HELD, gaps, run boundaries, selection scope, and cross-recording isolation. Unselected source intervals must not leak their interim analysis into earlier selected audio.
- A live visual-only event without trustworthy historical persistence can affect the live map but CANNOT automatically be claimed as replayable. The future producer must explicitly decide whether it creates eligible, privacy-governed historical records.

### 3.3 Playback and video behavior

- A single deterministic, pure event application path must support play, pause, seeking backwards/forwards, jumping to arbitrary timestamps, replay restarts, partial scopes, and repeated playback without stale/future-state leaks.
- Updates within one `WINDOW` cannot be collapsed into a single final moment if a future authority proves their intermediate histories.
- A correction/retraction must affect only its proper time and the future state reconstructed from it; the earlier historical state remains historically faithful, not retroactively replaced by the corrected knowledge.
- Replay's view and offline video frame rendering must consume the **same** ordered event facts, stage resolver, causal timestamps, and policy. Video export timing must not be independently guessed; video can defer implementation until S5.
- Without a future in-speech producer, lane B is absent/empty and S4 behaves exactly as the existing authoritative moment-only replay. No synthetic demonstrations should be mislabeled as product coverage.

## 4. Focused future acceptance tests to include in S4 design

1. **Backwards compatibility:** a version with zero in-speech events has identical moment disclosures and COSMOS stages to the current baseline; existing availability decoder/clock semantics unchanged.
2. **Long turn:** a 120-second user WINDOW with multiple *synthetic, explicitly labeled* provisional attention updates at distinct proven instants causes multiple separate stage/attention changes before the end of that WINDOW, without bypassing the committed knowledge lane guards.
3. **Late known-at:** an event whose source speech was at 12 s but the earliest proven availability was at 17 s cannot display at 12 s.
4. **Correction:** emerge → update → retract/confirm are causal, bounded, and repeat identically after backseek and restart. No provisional cue creates durable knowledge.
5. **Selective Replay:** if a relevant source span is omitted or a HELD interval is shortened, the event is not backdated or silently moved into an earlier window.
6. **No event authority:** missing or malformed event feed fails closed while normal committed Replay playback still works; invalid event data cannot invalidate valid historical commitments or be silently accepted.
7. **Parity and cost:** mobile and offline-video simulated frame facts are identical at equivalent presentation timestamps, with no extra per-frame DB access and no impact on Live Voice/First Audio.
8. **Version and erasure:** changes in replay revision/map digest/consent/revocation invalidate all related provisional events; no cross-user, cross-session or cross-run leaks.

A synthetic acceptance demonstration is **compatibility evidence**, NOT evidence that the missing live intelligence feature has been implemented.

## 5. S4 / S5 implementation instructions (when separately authorized)

- In the **S4 execution contract**, explicitly include a small pure clock-bound `ReplayHistoricalEventTrack` / adapter boundary or equivalent, and a read-only empty-lane behavior; leave the event producer/provider undecided. Avoid introducing a new overlay renderer or separate time authority.
- Keep the current S3 availability answer strictly validated and immutable. A future lane should be separately negotiated/versioned rather than adding unknown keys to the exact-key S3 decoder.
- Require an explicit, safely testable seam where the future owner `INTEL-LIVE-01` (candidate; no approved owner yet) can supply the event track. Do not attach the source to raw INTERIM text now or draw from a later committed scene at an earlier time.
- Build the later **S5** video renderer on the *same* clock/event facts; resist a video-only event logic path. Replay pool remains isolated from Live Voice.
- If full implementation of such a seam would substantially change the frozen moment contract, stop at a documented adapter boundary and request a narrow PO-controlled amendment. Do not silently weaken `completeAt` or `K(TC)`.
- The gap `QAN-BL-INTEL-06` remains OPEN until the actual intelligence producer and live map behavior are proven in a real continuous call.

## 6. Governance and sequencing

This annex does **not** block reviewing or merging #408 and #409 on their own exact-head CI and acceptance gates. It does require the S4 planning/implementation review to address the dual-lane compatibility before accepting S4 as a reusable Replay foundation, and the S5 video plan to inherit the same contract. A postponed intelligence-producer launch is not the same thing as postponing Replay's future-facing integration seam.

No branch merge, migration, deployment, live protocol change, model/provider choice, or relaxation of approved COSMOS rendering or audio priority is authorized by this document alone.

---

## Addendum — 2026-11-25 — transferred to `main` by INTEL-LIVE-01 CP1 (status only; the annex above is unchanged)

- **Origin.** Written on Draft PR #410 (head `55d016b6`); carried here verbatim by INTEL-LIVE-01 CP1 (CP0 contract v1.1 §8.3).
  `git diff 55d016b6:docs/e2e/QANDEEL_S8B07_S4_INCREMENTAL_UNDERSTANDING_REPLAY_COMPATIBILITY_v1.md` shows only this addendum.
  `event-track.ts` already cites its §3.1.
- **Status since 2026-11-24.** S3 `0202` (#408) and M-2 `0203` (#409) merged; S4 consumption merged through #413 (`aa6fc0c8`),
  with Lane A untouched by INTEL-LIVE-01 and Lane B a typed seam with no producer.
- **The producer this annex anticipated** is INTEL-LIVE-01 (`QAN-BL-INTEL-06`, `DEFERRED — OWNED`;
  [execution record](QANDEEL_INTEL_LIVE_01_IN_SPEECH_UNDERSTANDING_RECORD_v1.md)). Its CP1 writes provisional attention events on
  the call's capture clock (`anchor ≤ evidence ≤ produced`, each at its real instant, never backdated) in migration `0204`. Replay
  consumes them only at its CP3, through Lane B and the §19 placement policy; S5 is not started.
