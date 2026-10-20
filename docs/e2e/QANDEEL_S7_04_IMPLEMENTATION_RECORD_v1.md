# QANDEEL — S7-04 Production Replay Player & Navigation — Implementation Record v1

**Task:** S7-04 — Production Replay Player & Navigation (Stage 7)
**Status:** CLOSED / AT THE S7-04 INDEPENDENT PRODUCT, VISUAL & TECHNICAL REVIEW GATE (FINAL) — NOT MERGED / NOT DEPLOYED / CLOSED TO USERS — PRODUCT COPY GATE OPEN (13 rows PROPOSED, Arabic and English)
**Date:** 2026-10-20
**Branch / base:** `s7/s7-04-replay-player` from `main` at `0d8a73350f075402897421e9ebb88379fe165575`, the merge of PR #349
(S7-03 — Historical Replay Composite Visual Proof). S7-01 merged through PR #347 as `c152cb4b`, S7-02 through PR #348 as
`3ad4e414`.
**Authority:** the Product Owner's S7-04 brief and its binding rules (Replay owns the historical truth and the order of
moments; the graphics belong to Living Analysis; only the existing preview / finalize / reopen routes, one command id per
attempt; no fourth world; nothing in the live store; F-2; new copy PROPOSED); the Product Owner's Visual Direction #1
(2026-10-20, option (b): CHROME_ONLY with a measured band); Decision #2 (2026-10-20, «Replay Temporal Spine»: P2's
Temporal Spine + Aperture C "Parting"); and the Independent Visual Review Decision (2026-10-20: the Spine approved in
principle, two corrections required — §5A). The S7-03 record (the composite and its handover); CW2-05 / I-06; T-04, T-05,
T-06, T-11 and VPORT-02, unchanged.

Merging, deploying or opening Replay to users needs the Product Owner's explicit approval. S7-05 does not start
automatically.

## 1. What S7-04 delivers

The Personal Replay player, closed to users behind the existing capability gate:

```
Conversation «معاينة» (saved draft) ─┐                         ┌─ POST /replay/:id/preview  (one command id per attempt)
Analysis END-edge Replay glyph ──────┴─► ReplayPlayer passage ─┼─ POST /replay/:id/finalize
                                          (over the depth,      └─ POST /replay/:id/reopen
                                           which stays mounted)
                                                │ ordinal
                                                ▼
              S7-03 ReplayMomentComposite ── moment.tc ── T-06 commitMoment (isolated, pinned viewpoint)
                                                │
                                                ▼
              S7-01 history reads ── governed adapter ── LivingAnalysisSurface + T-04 MapSurface (unchanged)
```

- **The passage.** One overlay over the depth the reader came from (the Conversation or the Analysis), which stays
  mounted, untouched and out of reach beneath it. Android Back and the way back at the START edge close it; nothing of it
  stays. No route, no fourth world.
- **The moments.** Navigated on the Replay's Temporal Spine (§4): P2's frozen Spine + Aperture C "Parting", one notch per
  moment of the version. A completed touch (a tap or a drag) or an accessible increment / decrement hands ONE ordinal to
  the player (`controller.seek(ordinal)`); the composite commits that moment's TC on its own isolated viewpoint.
- **Play / pause.** P2's own `play` / `pause` media marks (`sig.mjs`, through the generated canonical glyphs; never the
  Call Rail). Play steps at a declared, bounded reading pace (never the original timing) and stops at the last moment;
  at the last moment the control is «التشغيل من البداية» with the play mark.
- **The private lifecycle.** Preview, finalize («حفظ نسخة خاصة») and reopen («تعديل إعادة العرض») through the existing
  S7-01 routes. A finalized version is private: no share, publish, export, library, audio or video exists anywhere. An
  answer that cannot be read is `OUTCOME_UNKNOWN` (UNCONFIRMED), and «إعادة المحاولة» re-issues the SAME command id and
  body. Every bounded refusal is said as what it is.
- **Generation.** One player controller per auth generation, on that identity's transports, retired with it: no
  version, moment, timer or command of one account or Session reaches the next.

## 2. Files

| Path | Role |
| --- | --- |
| `apps/mobile/src/replay-player/ReplayPlayer.tsx` | The passage, its top band (the way back, the title, the private lifecycle), the transport (play / pause + the Spine) and the pacing line; hands the moment controls to the S7-03 composite. |
| `apps/mobile/src/replay-player/ReplaySpine.tsx` | The Replay's Temporal Spine (§4). |
| `apps/mobile/src/replay-player/player-controller.ts` | The player's state: open / close, the saved-draft and Analysis entries, `seek`, play / pause at the declared pace, preview / finalize / reopen with one command id per attempt, revocation, generation. |
| `apps/mobile/src/replay-player/copy.ts` | The 13 new rows, all PROPOSED (§7). Approved words are reused from their owners. |
| `apps/mobile/src/replay-player/__fixtures__/` | The captured real-path wire (`replay-player-wire.json`) served to the real clients as HTTP. |
| `apps/mobile/src/replay-player/__tests__/` | `player-controller`, `replay-player`, `replay-player-layout` (§8). |
| `apps/mobile/src/runtime-entry/replay-lifecycle-api.ts` | The ONE client of the three lifecycle commands, by POST only, strict decoders, `OUTCOME_UNKNOWN`. |
| `apps/api/src/replay/replay-player-proof.spec.ts`, `tests/fixtures/s7-04-replay-player/rows.json`, `database/replay-composite-proof-world.mjs --player` | The real-path proof chain (§3). |
| `apps/mobile/src/integration/__validation__/S704ProofRoot.tsx`, `s704-proof-entry.tsx`, `s704-proof-world.ts`, `apps/mobile/scripts/select-s704-proof-entry.mjs` | The validation-only proof build. Never the product entry. |
| `apps/mobile/src/integration/__tests__/s7-04-replay-player.test.tsx` | The journey in the production composition. |
| `tests/s7-04-replay-player-navigation-contract.test.mjs` | The static contract (§8). |

Edited, each additive: `ReplayMomentComposite.tsx` (S7-03; optional `top` and `controls`, §5A), `replay-composite/index.ts`
(the `ReplayMomentControls` type), `AnalysisReturnBar.tsx` (an optional END-edge control), `ReplayEntry.tsx` (an optional
action on the saved line), `DepthComposition.tsx` and `integration-runtime.ts` (mounting the passage and the controller),
`runtime-entry/replay-api.ts` (keeps the `currentVersion` the S7-01 read already answers), `runtime-entry/index.ts` and
`mobile-runtime-entry.ts` (the lifecycle client), `generate-conversation-visual.mjs` / `canonical-visual.generated.ts` /
`Glyph.tsx` (P2's `play` / `pause`), the re-anchored pins (§9), `package.json` and `.github/workflows/api-ci.yml` (the new
contract in API CI), and the locators.

No server, API, migration or schema change; no new route. No change to `LivingAnalysisSurface`, `MapSurface`,
`WorldViewSurface`, `LivingAnalysisMap`, T-05, T-06, T-11, VPORT-02's drawings, the S7-02 or S7-03 copy, the S7-03
adapter or viewpoint store (sha256 pins, detector `frozen`). No frozen file was changed, so no decision gate was needed.

## 3. The truth chain

```
PostgreSQL 17, migrations 0001 … 0169 (fresh)     database/replay-composite-proof-world.mjs --player
  └─ one Replay's whole journey: draft → preview → finalize → reopen → a new preview; read through the 0169 wrappers
     as the creator; the transaction ROLLED BACK
       └─ tests/fixtures/s7-04-replay-player/rows.json
            └─ the real ReplayService (unchanged)   apps/api/src/replay/replay-player-proof.spec.ts
                 └─ replay-player/__fixtures__/replay-player-wire.json (what the API answers, byte for byte)
                      └─ ReplayApiClient + ReplayLifecycleApiClient + ReplayHistoryApiClient (real decoders)
                           └─ ReplayPlayer → ReplayMomentComposite → LivingAnalysisSurface + MapSurface (real)
```

Controlled synthetic data builds the history; everything displayed came back through the real path. No model runs.

## 4. The Replay Temporal Spine (Product Owner Decision #2, 2026-10-20)

- **Drawn by** VPORT-02's own production drawings, unchanged: `SpineLayer` (the hairline and the notches), `Aperture`
  (the committed parting with its mark; the lighter preview parting with none) and `spinePresentation`, at T-05's
  48-point step inside P2's 44-point band.
- **Moved by** T-06's own `useTemporalMotion` (PINNED, store-free): the finger followed 1:1, a release that retargets and
  settles once, a lossless cancel, and Reduced Motion's cut, read from the ONE live Reduce Motion setting. The Spine adds
  no easing, fade or scale of its own.
- **About** the version's moments only: one notch per moment, in ordinal order; the spatial step is the ordinal step. No
  original timing is drawn or implied.
- **Not about** the live conversation: no Live Head, no Live terminal, no Return Live, no T-06 store, scrub or target
  layer; no temporal authority. The live Timeline, its store and its preview are never reached.
- **Touch.** A drag (`Pan.minDistance(0)`) and a tap race; whichever completes commits where the finger lifted, and the
  touch is cancelled only when both fail (Android never activates a pan on a stationary tap). A late or older callback can
  never reopen or commit a settled touch. A release outside the moments commits nothing.
- **Accessibility.** One adjustable element named «لحظات إعادة العرض» (PROPOSED), whose value is the APPROVED S7-03
  position sentence; increment / decrement are the next / previous moment.
- **Paging.** A version longer than the strip jumps a whole window at a time (T-05's rule), never glides.

## 5. Gaps and findings

- **G-1 (API finding, not fixed here: an API change needs a decision).** While a fresh draft exists in a conversation,
  the 0169 list wrapper answers `current_version_finalized = false` beside a null version, and the S7-01 summary decoder
  accepts only null there, so the conversation list fails closed (503). The Analysis entry says this as a failure with a
  retry, never as "nothing here" (test `G-1`); the saved-draft entry reads the Replay itself and is unaffected. Placed
  with S7-05 (§11).
- **F-1.** On the real Personal path `omittedBefore` is always 0 (S7-01 selects one contiguous range), so an omission is
  shown only on a test specimen (`omitBefore`), never on the device.
- **F-2 assessment (binding from S7-03).** A Reading's `scope` carries `CONVERSATION_SESSION:<sessionId>` across the
  Replay wire, creator-exact. The player and the composite never read, show, log or send it: a Jest test renders the
  captured wire and asserts no reader-facing string and no accessible name contains it or any id; the contract refuses
  `scope`, `console` and telemetry in the player. Whether the wire keeps it at all is an API question; S7-04 changes no
  API, and places the decision with the Product Owner before any user opening (S7-05, §11).
- **Repeated sentences.** The position sentence («في إعادة العرض: N من 6.») and T-08's «أنت عند اللحظة N.» are both
  approved and both shown; left unchanged.
- **Font scale.** Before the correction (§5A) the controls scrolled out of view with a long message at 200%.

## 5A. Independent Visual Review corrections (2026-10-20)

The Product Owner approved the Spine direction, the 1:1 preview and the two apertures, and required two corrections.

1. **The controls stay in reach while a long message scrolls.** The smallest compositional change, additive to the S7-03
   composite and only when the player hands it controls: the moment band holds the controls (play / pause and the
   Spine) and the position sentence in place, and only the reading under them — the declaration of the pace, then the
   gap, the message and its sentences, in the same order as before — scrolls, in its own `ScrollView`. The reading is
   bounded by T-11's own band cap — read from the same pure `recompositionPlan` the surface composes (CHROME_ONLY,
   unmeasured) for the rect the composite fills — minus the band's padding, the controls' measured height and the gap,
   so the band's own scroller never has anything to scroll. It is a bound, never a size: a short moment holds no room.
   Only where the controls alone leave less than one 44-point touch target is nothing bounded, and the band's own
   scroller reaches everything, as before. *(Found on the emulator: with the pace sentence held among the controls, the
   English sentence's three lines at 200% left the reading under the first threshold, so the whole band scrolled again;
   the sentence now leads the reading.)* A different moment is read from its
   start: the reading returns to its top at once, with no motion (found on the emulator: a moment chosen while the
   previous one was scrolled opened mid-message). Without controls (every S7-03 consumer)
   nothing is measured and the moment is composed exactly as before (Jest, the S7-03 suite unchanged and green). No
   change to the engine, T-11, the surface or the drawings.
2. **P2's discontinuity keeps its one meaning.** P2's three points mean "the window continues" toward the live edge, which
   has no place on a Replay. The Spine no longer draws them for omitted messages (or anything else), and no substitute
   mark was invented: an omission is said where it is by the S7-03 composite's own approved historical disclosure
   («لم تُعرض هنا {count} من المحادثة.», `qandeel-replay-gap`), now inside the moment's reading. The notches stay 48
   points apart across an omission.

No approved copy changed; the 13 new rows stay PROPOSED.

## 6. Evidence

Four evidence classes are kept apart; none is described as more than it is.

| Class | What happened | Where |
| --- | --- | --- |
| **AUTOMATED TEST** | Ran and passed (§8). | Jest, `node --test`, the API spec. |
| **RENDER PROOF ON THE REAL COMPOSITION** | Jest renders `ReplayPlayer` with the real composite, `LivingAnalysisSurface`, `MapSurface` and T-11 over the captured wire through the real clients, and the journey in the production `DepthComposition`. | `replay-player*.test.tsx`, `s7-04-replay-player.test.tsx` |
| **EMULATOR SCREENSHOT** | See §6.1. | `.s7-04-visual-proof/` (not committed). |
| **REAL DEVICE TEST** | **Did not happen.** No physical device was used; emulator screenshots are not a real device test. | — (S7-05) |

### 6.1 Emulator screenshots

Validation APKs (x86_64, release) were built from this branch with the proof entry selected by
`select-s704-proof-entry.mjs` and restored afterwards, and installed on the Android emulator `QANDEEL_API36`
(1080 × 2400, density 2.625, software GPU). The frames were reviewed by the implementing agent and by the Product Owner;
they show rendering on an emulator, nothing more.

- **Decision #2 (APK `813abef5f37bf5365e0d0a3a5ea628760b8d581ac7888600107805620c1ae58c`)**, `.s7-04-visual-proof/spine/`:
  moments 1, 2, 3 (the second Thread appears at 3); a drag preview (the lighter parting under the finger) and its commit;
  the last moment («التشغيل من البداية»); playing and paused; English LTR mirrored; Reduced Motion (animation scales 0)
  preview and commit; font scale 1.3 and 2.0; the live Analysis after closing the player still following the
  conversation.
- **Review corrections (§5A)**: see §6.2.

### 6.2 Review-correction screenshots

APK `22465b70ff9ff910270f4d54c80aad6c754d3730d0953dd56575d3bf52d2aa6a` (this change's final source), same emulator,
`.s7-04-visual-proof/review2/` (not committed). The long message is the proof world's own; the bounds below are read from
uiautomator on the same frames.

- **Arabic, 200%** (`final-ar-2.0-m1`, `…-m1-scrolled-end`, `final-ar-2.0-m3`, `…-playing-scrolled`): the play button
  and the Spine stay at `[43,1554][911,1670]` and the position sentence under them while the reading — the pace, the
  message, «أنت عند اللحظة 1.», «المعروض الآن: العالم كله.» — is scrolled to its end; moment 3 chosen while scrolled
  opens at the start of its message; play pressed while scrolled advances to «في إعادة العرض: 4 من 6» with
  «إيقاف مؤقت» in place.
- **English, 200%** (`final-en-2.0-m1`, `…-m1-scrolled-end`, `final-en-2.0-m3`): the reading is bounded (it ends inside
  the screen) and scrolls under the controls, which do not move; moment 3 opens at its top. This is the case that found
  the pace sentence's place (§5A).
- **Arabic 100% and 130%, English 100%** (`final-ar-1.0-m1/m3`, `final-ar-1.3-m1/m3`, `final-en-1.0-m1`): nothing
  overflows; the moment reads as before, controls, position, pace, message, sentences, in that order.
- **English 130%:** no screenshot — the emulator hung on that font-scale change (a known emulator fault). Covered by
  Jest only (§8.1), like every one of the six language × scale combinations.
- **No discontinuity anywhere:** in every frame the Spine shows only its notches and the aperture; the three points are
  not drawn.

## 7. Product Copy Gate — OPEN

Every row below is PROPOSED, Arabic and English alike, until the Product Owner decides; shipping a row promotes nothing.
Approved words are reused verbatim from their owners (S7-02 and S7-03 Copy Gates, CLOSED; W1A-01; T-08) and not
reopened. The previous / next chevrons and their two rows were removed by Decision #2.

| # | Key | Arabic (PROPOSED) | English (PROPOSED) |
| --- | --- | --- | --- |
| 1 | play | تشغيل | Play |
| 2 | pause | إيقاف مؤقت | Pause |
| 3 | restart | التشغيل من البداية | Play from the start |
| 4 | moments | لحظات إعادة العرض | The Replay's moments |
| 5 | pacing | تُعرض الرسائل نصًّا بإيقاع مناسب للقراءة، لا بتوقيتها الأصلي. | Messages are shown as text at a reading pace, not at their original timing. |
| 6 | preview | معاينة | Preview |
| 7 | finalize | حفظ نسخة خاصة | Save a private copy |
| 8 | finalized | نسخة خاصة محفوظة | A saved private copy |
| 9 | finalizedNotice | حُفظت نسخة خاصة من إعادة العرض، ولا تُشارك مع أحد. | A private copy of the Replay was saved. It isn't shared with anyone. |
| 10 | reopen | تعديل إعادة العرض | Edit the Replay |
| 11 | reopenedNotice | أصبحت إعادة العرض مسودة يمكن تعديلها. | The Replay is a draft again and can be edited. |
| 12 | analysisChanged | تغيّر التحليل منذ المعاينة، فلا يمكن حفظ هذه النسخة. | The analysis changed since the preview, so this version can't be saved. |
| 13 | commandUnconfirmed | تعذّر التأكد من إتمام ذلك. | It couldn't be confirmed that this was done. |

## 8. Verification

See §8.1 for the run on the final head of this change.

### 8.1 What ran, on this change's final source (2026-10-20, locally, Windows)

Only what actually ran is listed; CI on the PR head is the authority for merge.

| Check | Result |
| --- | --- |
| `npm run test:s7-04-replay-player-navigation-contract` | 54 / 54 pass |
| S7-01 / S7-02 / S7-03 contracts | 23 / 23, 17 / 17, 29 / 29 pass |
| S5-03B, S5-03C, thread-lifecycle continuity, W1A-01 contracts (re-anchored) | 13 / 13, 8 / 8, 17 / 17, 18 / 18 pass |
| `npm run test:task-closure-governance-contract` | pass |
| Every other root `*contract*` script | pass, except the three below |
| `apps/mobile` `tsc --noEmit` | clean |
| `apps/mobile` ESLint on the touched trees | 0 errors (34 warnings, all in files or lines S7-04 did not write) |
| Mobile Jest, focused (replay-player, replay-composite, replay-entry, runtime-entry, the S7-04 journey) | 28 suites, 450 / 450 pass — including the six language × font-scale layout cases (Arabic and English at 1.0, 1.3, 2.0) and the S7-03 composite without controls |
| Mobile Jest, whole suite | 2872 / 2878 pass; the 6 failures (`depth.test.tsx`, `w2-account-access.test.tsx`) are the known machine-locale baseline (this machine's `Intl` is ar-EG); with the English locale shim, 2878 / 2878 pass |
| API Jest `src/replay` (incl. `replay-player-proof.spec.ts`) | 3 suites, 67 / 67 pass |

Not green locally, for reasons outside this change:

- `test:qan-inf-03-deterministic-expo-dependency-validation-contract` — expo-doctor's online checks cannot run
  deterministically here; `test:forward-safety-contract` fails only through the same check (its mirror's test 561).
- `verify:replay-analytical-projection-render-contract:integration` — needs PostgreSQL, which this run had none of.

A generated `apps/mobile/android` left by the local APK builds made five root contracts fail ("no generated native
project"); it was removed and the five pass. It is not part of this change.

## 9. Re-anchored pins

- `tests/s7-01-replay-secure-integration-contract.test.mjs`: the lifecycle client may POST preview, finalize and reopen
  and nothing else (two planted defects); the S7-02 read's pin moves for `currentVersion` (no new server field).
- `tests/s7-03-replay-composite-visual-proof-contract.test.mjs`, `tests/s5-03b-…`, `tests/s5-03c-…`: the Project Map's
  current task is S7-04; S7-03 stands beneath it as the previous task (merged through PR #349).
- `tests/thread-lifecycle-cross-session-continuity-contract.test.mjs`: the player's real-path wire may carry the exact
  T-03C Thread-state-at-TC names, and the lifecycle client the reopen command's own outcome word; nothing else.
- `tests/w1a-01-conversation-core-contract.test.mjs`: the ported glyphs gain P2's `play` / `pause`.
- `apps/mobile/src/runtime-entry/__tests__/scope.test.ts`: the census gains exactly one class, `ReplayLifecycleApiClient`.

## 10. BG-08 / BG-09

- **Inherited (BG-05):** none owned. Read in full: `QAN-BL-NAV-02` (`OPEN — UNASSIGNED`, unchanged, with a dated S7-04
  note in §4), `QAN-BL-ACCT-03`, `QAN-BL-PRIV-05` and `QAN-BL-VOICE-01` (untouched). S7-03's S7-04 placements are
  discharged or placed: the player and its navigation are delivered (inspection stays fail-closed; the composite still
  draws no Timeline, by the Product Owner's direction); F-2 is assessed (§5) and its wire decision placed with S7-05; the
  real-device and TalkBack proof is placed with S7-05, before any user opening.
- **Admitted:** none. **Checked and not admitted**, each placed with S7-05: G-1 (the list 503 while a fresh draft exists;
  an API change needs a decision); F-2's wire question; a real-device and TalkBack proof of the player; the English rows
  and the S7-04 Copy Gate (this task's own gate, OPEN). F-1 is no obligation.
- **Carried:** `QAN-BL-PROD-09` stays `HOSTED-DEPLOY-01`'s; `CW2-08` not opened (`NOT_EVALUATED`); the Personal Replay
  capability stays closed (no gate row).
- Register: **77 items; 36 / 4 / 9 / 28; 43 / 32 / 2**, unchanged.
- **BG-09:** this record's banner states its lifecycle; Current State, the Project Map, the Roadmap (§6.25) and the backlog
  are updated in the same change.

## 11. S7-05 handover

- **What exists:** the player behind the closed capability gate; its two entries; the private lifecycle; the Spine.
- **Before any user opening (S7-05 and the Product Owner):** the S7-04 Copy Gate (13 rows) and every English row; F-2
  (whether the wire keeps the Reading scope's session id — an API decision); G-1 (the list 503 while a fresh draft exists
  — an API decision); a real-device and TalkBack proof of the entry, the selection, the player and the Spine;
  `QAN-BL-NAV-02`'s reconciliation (the WP0 places it at S7-05); the capability gate stays an operator act behind the
  Product Owner's approval; CW2-08 stays `NOT_EVALUATED`.
- **Known, not obligations:** F-1; the two approved position sentences both shown; uiautomator lists the depth beneath the
  passage (existing behaviour, as beneath Settings).

## 12. Deliberately not implemented

Opening the Capability Gate or CW2-08; any API, DB or migration change; sharing, publishing, export, library, audio or
video; a Live Timeline, Live Head or Return Live in Replay; inspection in the composite; a rebuild of S7-03, Living
Analysis or I-06; S7-05.

---

**STOP — S7-04 INDEPENDENT PRODUCT, VISUAL & TECHNICAL REVIEW GATE.** The player is not finally approved before the
Product Owner reviews the frames and the motion. No merge, deployment or user opening without the Product Owner's
approval; S7-05 is not started.
