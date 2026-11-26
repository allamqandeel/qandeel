# QANDEEL — INTEL-LIVE-INCREMENTAL-01: Understanding While the Person Is Still Speaking

**Record:** PRODUCT GAP / CODE-VERIFIED — OPEN, HIGH — 2026-11-24  
**Product Owner designation:** Long-form conversational listening must progressively influence the Living Analysis Map *during* the person's uninterrupted speech, not only after the user's turn ends or QANDEEL speaks.  
**Backlog:** `QAN-BL-INTEL-06` (canonical backlog, OPEN — UNASSIGNED).  
**Implementation authority:** NONE. This records a requirement and verified gap, not an approved algorithm, protocol, model, schema, or task contract.  

## 1. User experience and defect

A person may confide in QANDEEL for 60–120 seconds without stopping: car purchase, a hospital visit, family worries, and a correction of an earlier statement. The person expects the living map to *react to meaningful developments as they emerge*. A map that stays unchanged for the whole monologue and then suddenly displays the final interpretation after the person stops is not the intended product experience.

The intended behavior is a continuing visual indication of attention and evolving understanding during the person's speech. Neither the person's end-of-turn nor QANDEEL's next spoken reply may be a universal prerequisite for recognizing and presenting the person's significant developments.

## 2. Code-verified current truth (main @ `f45400a8`)

- **Speech recognition already streams audio and supports interim text.** `apps/api/src/voice/speechmatics/speechmatics-realtime.adapter.ts` enables partials and distinguishes INTERIM from FINAL.
- **The call turn engine discards the interim text from downstream analysis.** `apps/api/src/voice/call-turn/live-call-turn.engine.ts` `readEvents()` keeps only FINAL words and explicitly says that INTERIM never reaches DeepSeek, Memory, or analysis.
- **The turn boundary is governed by silence.** `apps/api/src/voice/call-turn/call-endpointer.ts` uses 500 ms finalize silence and 800 ms commit silence; resumed speech remains the SAME turn. During uninterrupted speech, the normal user-turn commit that queues semantic processing has not happened.
- **The durable live semantic worker begins from committed call halves.** `apps/api/src/live-analysis/call-analysis.worker.ts` processes queued USER/ASSISTANT halves and does not analyze provisional, still-spoken transcript spans as semantic commits.
- **Reply-first capacity can add a later delay.** In the worker, default `LIVE_CALL_ANALYSIS_START` is `AFTER_FIRST_AUDIO`; the alternate `AT_COMMIT` is opt-in. This is separate from the more fundamental no-analysis-before-turn-commit gap.

These are code-level findings, not a claim that a complete 90-second physical-device scenario has already been measured.

## 3. Classification and placement in the project map

**Primary ownership domain:** Live conversational intelligence / evolving semantic understanding (`S8B-05` live-call input + `S8B-05 CP3` analysis producer, complementary to Stage 8A intelligence). This is NOT first and foremost a COSMOS rendering defect.

**Dependent presentation:** Living Analysis Map needs a trustworthy way to reflect a *provisional or emerging* observation and to correct or withdraw it, distinct from persistent, committed semantic knowledge. No exact visual morphology or color is authorized here.

**Dependent historical playback:** S8B-07 Replay S4/S5 and video must replay only what was genuinely available or visibly presented at that time. RB-2/S1, S3 and M-2 certify committed semantic events; they cannot invent an earlier event merely because its source words were spoken earlier. Any future provisional visual events require their own honest capture/provenance and timeline semantics before they can be replayed or exported.

**Potential future task label (NOT assigned or approved):** `INTEL-LIVE-01 — Incremental In-Speech Understanding & Map Attention`. Product Owner must separately decide ownership and a bounded implementation contract. Do not reopen completed S8B-05 or COSMOS contracts by implication.

## 4. Required outcome, without freezing an implementation

1. During a continuous user monologue, multiple stable meaningful developments can emerge and be represented *before* the user finishes and *before* QANDEEL begins its next reply.
2. Provisional/incomplete ASR and interpretations must be distinguishable from durable understanding; no premature permanent memory, irreversible relation or assertion from uncertain words.
3. Corrections, negations, changed referents and evolving meaning must update or retract provisional presentation without silently retaining false history.
4. Preserve speech uplink continuity, First Audio priority, Live Focus ordering, costs, privacy/consent and safety. No additional delay is imposed on speaking/reply generation to draw the map.
5. Historical Replay and exported video preserve *actual* temporal truth. No backdating later semantic commits to an earlier spoken phrase. If provisional attention is to be replayed, its historical event source and handling must be explicitly designed and proven.
6. Should include stable English/Arabic and Egyptian Arabic speech cases, especially long continuous narratives, not just turn-end prompts.

## 5. Minimum future acceptance scenario

Test one continuous 90–120-second phone monologue, with at least three distinct meaningful developments (e.g. a car, doctor visit, concern) and a subsequent correction/negation. Do not rely on an artificial end-of-turn until the end.

Record for each: actual speech position, partial/final ASR arrival, provisional attention update if any, semantic durable commit if any, first map change, first assistant audio, and eventual Replay/video placement. Demonstrate at least two meaningful map changes before the turn-end or assistant reply, while refusing to present an uncommitted interpretation as durable truth. Measure timing rather than invent an unapproved universal millisecond SLA.

Use synthetic content and protect actual call performance. If the upstream analysis has not emitted a trustworthy event, presentation and Replay must not fabricate it.

## 5A. Replay future-compatibility requirement (PO direction, 2026-11-24)

Replay S4 and later video S5 must be prepared to ingest a separately governed, versioned event stream for **actual in-speech attention**, distinct from the existing RB-2 committed-moment track; both must use the same original-audio presentation clock and deterministic temporal reducer. See [S4/S5 compatibility contract](QANDEEL_S8B07_S4_INCREMENTAL_UNDERSTANDING_REPLAY_COMPATIBILITY_v1.md). Do not weaken `Moment.completeAt` for committed knowledge, backdate a late semantic commit, manufacture interim history, or alter S3/M-2. This is design direction and acceptance guardrail, not authorization to implement a provisional producer or its persistence.

## 6. Scope and governance

**Status:** OPEN — UNASSIGNED; **severity:** HIGH (central user experience of being understood while speaking).  
**Current task:** No runtime change authorized; `#408` S3 and `#409` M-2 remain separate Draft PRs. Their time certification work is not invalidated. `S4` may wire already-committed availability without claiming to solve this new gap.  
**Reopen/ownership gate:** Before declaring continuous in-speech understanding / evolving-map behavior complete for users, or before product acceptance of Replay/video as a truthful depiction of such evolution, the PO must assign a named task, freeze the distinction between provisional attention and committed understanding, and authorize focused execution.  
**Not automatically blocked:** merge review for S3/M-2 and technical S4 integration that meets their own frozen contracts.  
**Not authorized:** altering frozen COSMOS art/gestures, changing `0201`/`0202`/`0203`, changing model/provider or ASR policy, introducing new background workers, and starting S4/S5 or any new migration on this record alone.

This issue is independent of `QAN-BL-INTEL-05` (deterministic semantic refusal), `QAN-BL-VOICE-07` (capacity/Live Focus speed), and `QAN-BL-VIS-02` (Replay COSMOS renderer fidelity).

---

## Addendum — 2026-11-25 — transferred to `main` by INTEL-LIVE-01 CP1 (status only; the record above is unchanged)

- **Origin.** This record was written on Draft PR #410 (head `55d016b6`) and is carried here verbatim by INTEL-LIVE-01 CP1 under
  its CP0 contract v1.1 §8.3. `git diff 55d016b6:docs/e2e/QANDEEL_INTEL_LIVE_INCREMENTAL_UNDERSTANDING_GAP_v1.md` shows only this
  addendum. #410 itself is closed only on the Product Owner's word, with a comment naming the CP1 commit.
- **Status since 2026-11-24.** #408 (S3, `9fe16a55`), #409 (M-2, `aed79e7c`) and #413 (S4 + S4-CORRECTION-01, `aa6fc0c8`) are
  merged. Replay's Lane B seam (`apps/mobile/src/features/replay/event-track.ts`) exists, typed, with no producer.
- **Owner.** The Product Owner assigned the gap to **INTEL-LIVE-01 — Incremental In-Speech Understanding & Living Map Attention**
  ("INTEL-LIVE-01 — Final PO Execution Authorization", 2026-11-25) on the CP0 stack v1.0 → v1.1 → A1 → A2
  ([execution record](QANDEEL_INTEL_LIVE_01_IN_SPEECH_UNDERSTANDING_RECORD_v1.md)). `QAN-BL-INTEL-06` is `DEFERRED — OWNED` by it.
- **What CP1 delivers.** The producer only: FINAL segments (never INTERIM) and heard QANDEEL pieces are evaluated by DeepSeek
  during the speech, one evaluation in flight per call, into a private provisional attention ledger (migration `0204`), settled by
  identity against the durable commit. The live map (CP2) and Replay's Lane B (CP3) consume it later; until then nothing a person
  sees changes.
- **Product readiness.** DeepSeek is `SYNTHETIC_ONLY`; synthetic acceptance proves the mechanism, not the product; the product
  gate is the HONOR Live + Replay proof (the Product Owner's sequence, step 3).
