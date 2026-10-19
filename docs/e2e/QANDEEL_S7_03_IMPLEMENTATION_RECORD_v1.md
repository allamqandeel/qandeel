# QANDEEL — S7-03 Historical Replay Composite Visual Proof — Implementation Record v1

**Task:** S7-03 — Historical Replay Composite Visual Proof (Stage 7)
**Status:** CLOSED / AT THE S7-03 INDEPENDENT VISUAL & TECHNICAL REVIEW GATE — NOT MERGED / NOT DEPLOYED / CLOSED TO USERS — PRODUCT COPY GATE CLOSED (Arabic 14 / 14 APPROVED; English PROPOSED)
**Date:** 2026-10-19
**Branch / base:** `s7/s7-03-composite-visual-proof` from `main` at `3ad4e4143264f1af7a5fd759ccb0102f1b98d087`, the merge of
PR #348 (S7-02 — Replay Entry & Conversation Selection). S7-01 merged earlier through PR #347 as `c152cb4b`.
**Authority:** the Product Owner's S7-03 brief and its binding decision «Replay يملك الحقيقة التاريخية وترتيب اللحظات، لكن
الجرافيك ملك نظام Living Analysis الحالي»; CW2-05 / I-06 (the Replay runtime and its render truth contract); the S7-01 record
(the API boundary); T-04 / LA-VIS-01 (the Map and the Living Analysis surface, unchanged); G3.2 as a visual reference only.

Merging, deploying or opening Replay to users needs the Product Owner's explicit approval. S7-04 does not start
automatically.

## 1. What S7-03 proves

Qandeel can show one historical Replay moment — the exact message as it was committed, with its speaker and role, and the
analysis as it stood **at that moment** — on the **existing** Living Analysis components, with no Replay-owned graphics:

```
Replay historical truth ──► governed projection adapter ──► LivingAnalysisSurface + T-04 MapSurface (unchanged)
 (S7-01 reads only)          (replay-composite/projection-adapter.ts)  (byte-identical to 3ad4e414)
```

Replay owns the truth and the order of moments (ordinal, TC, text, viewing state); Living Analysis owns every pixel. The
adapter decides no colour, position, size, motion or wording of the analysis; a future Living Analysis change needs no
change in the Replay engine, its API or its history (contract detector `engine`, §8).

This is a visual proof, not the production player: there is no play / pause, no navigation control, no Analysis-screen
entry, no preview / finalize / reopen in the Product UI (S7-04).

## 2. Files

| Path | Role |
| --- | --- |
| `apps/mobile/src/runtime-entry/replay-history-api.ts` | The ONE read-only client of the three S7-01 history reads (`GET /replay/:replayId/versions/:versionId`, `…/moments`, `…/moments/:ordinal/analysis?depth=`); strict, whole-answer decoders. |
| `apps/mobile/src/replay-composite/projection-adapter.ts` | The governed adapter: render-contract check, refusals, and the bridge into the existing `HistoricalDisclosure` (§4). |
| `apps/mobile/src/replay-composite/viewpoint-store.ts` | An isolated viewpoint store per version, PINNED at the moment's TC, with no Map authority and no Live Focus. |
| `apps/mobile/src/replay-composite/composite-controller.ts` | Reads the version, the moments and one moment's analysis per depth; LOADING / FAILED / NOT_FOUND / NOT_RENDERABLE / READY states; retry. |
| `apps/mobile/src/replay-composite/ReplayMomentComposite.tsx` | The composite: the moment panel (position, scope, gap, the exact message, honest states) as the surface's chrome, and `MapSurface` as its world. `ReplayPreviewLimit` for the two preview limits. |
| `apps/mobile/src/replay-composite/copy.ts` | The words S7-03 needs: 14 items, Arabic APPROVED by the Product Owner (2026-10-19), English PROPOSED (§7). Words approved earlier are reused from their owners verbatim. |
| `apps/mobile/src/replay-composite/__fixtures__/replay-wire.ts` | Serves the captured real-path wire to the real client as HTTP; the labelled `derivedGap` specimen. |
| `apps/mobile/src/replay-composite/__tests__/replay-composite.test.tsx` | The composite on the real components (§6). |
| `apps/mobile/src/runtime-entry/__tests__/replay-history-api.test.ts` | Decoding of every captured scene and depth; planted defects; the GET-only client. |
| `database/replay-composite-proof-world.mjs` | Builds the proof history on a fresh PostgreSQL 17 database with migrations `0001` … `0169`, reads it through the 0169 wrappers, and rolls back. |
| `tests/fixtures/s7-03-replay-history/rows.json` | The rows the wrappers returned. |
| `apps/mobile/src/replay-composite/__fixtures__/replay-wire.json` | What the real `ReplayService` answered over those rows. It sits inside the mobile build inputs, so the native-artifact fingerprint (QAN-INF-04) covers it. |
| `apps/api/src/replay/replay-history-proof.spec.ts` | Maps `rows.json` through the real, unchanged `ReplayService` and asserts the result equals `replay-wire.json`. |
| `apps/mobile/src/integration/__validation__/S703ProofRoot.tsx`, `s703-proof-entry.tsx`, `apps/mobile/scripts/select-s703-proof-entry.mjs` | The validation-only proof build (deep links choose scene, moment, language and opening rung). Never the product entry. |
| `tests/s7-03-replay-composite-visual-proof-contract.test.mjs` | The static contract (§8). |

Edited: `apps/mobile/src/runtime-entry/index.ts` (barrel exports), `runtime-entry/__tests__/scope.test.ts` (census: one new
class), four contracts re-anchored and two current-task pins moved (§9), `package.json` and `.github/workflows/api-ci.yml` (the new contract in API CI), and the locators.

No server, API, migration or schema change. No change to `LivingAnalysisSurface`, `MapSurface`, `WorldViewSurface`,
`LivingAnalysisMap`, the map scene, inspection, the store, the historical projection wire, the S7-02 client or its copy
(18 files pinned by sha256 at `3ad4e414`, detector `frozen`).

## 3. The truth chain

```
PostgreSQL 17, migrations 0001 … 0169 (fresh)            database/replay-composite-proof-world.mjs
   └─ the frozen T-03D Session 1 + one quiet exchange; Readings as SP-native events; drafts, previews, final versions
   └─ read through the 0169 SECURITY INVOKER wrappers as the creator; the transaction ROLLED BACK
        └─ tests/fixtures/s7-03-replay-history/rows.json
             └─ the real ReplayService (unchanged)       apps/api/src/replay/replay-history-proof.spec.ts
                  └─ replay-composite/__fixtures__/replay-wire.json  (what the API answers, byte for byte)
                       └─ ReplayHistoryApiClient (real decoders)
                            └─ projection adapter ──► LivingAnalysisSurface + MapSurface (real components)
```

Captured scenes: `main` (6 moments, TC 1–6, VIEWABLE), `part` (3 moments, TC 4–6), `notViewable` (E07,
`SOURCE_NOT_CURRENTLY_AVAILABLE`, source `NOT_DEREFERENCEABLE`, analysis `SEALED_HISTORICAL_EVIDENCE`), `analysisMoved`
(E08, `ANALYSIS_NOT_CURRENTLY_AVAILABLE` for ordinals 1–2), and the preview answers `MOMENT_NOT_SEALED` (E05, open head)
and `ANALYSIS_UNAVAILABLE` (E06, legacy). Controlled synthetic data builds the history; everything displayed came back
through the real path. No model runs at any point; no current analysis is read.

## 4. The adapter and the viewpoint

- **Render Truth Contract.** The version's `renderContract` must be `QANDEEL_REPLAY_RENDER_CONTRACT_V1`,
  `ORIGINAL_TEXT_ONLY`, with its twelve policies exactly; otherwise the composite refuses (`RENDER_CONTRACT_NOT_HONOURED`)
  and draws nothing. Only `TEXT` moments render (`MEDIUM_NOT_RENDERABLE`); Stage 7 synthesizes no audio.
- **Refusals.** `NOT_VIEWABLE`, `NO_MOMENT_TEXT` (no analysis without its moment's text), `NOT_THIS_MOMENT` (the analysis
  of another ordinal or TC), `OUTSIDE_THE_VERSION`, `BEYOND_THE_MOMENT` (any knowledge after the moment's TC). The decoder
  already refuses whole any answer with later knowledge, a wrong depth, an extra field, a Session Moment, a Turn id or a
  Material expiry.
- **Bridge (gap G-1).** The Replay wire is a historical disclosure without the live-session envelope the frozen
  `HistoricalDisclosure` shape carries. The smallest bridge, all in the adapter: `sessionId = replay:<replayId>:<versionId>`
  (a viewpoint key, never shown), `liveHead = lastTc`, `sealed = true`, `revision = {liveHead: lastTc, worldVersion:
  version.revision, pendingExpiries: 0}`; the families the wire does not carry are empty (`session.moments`,
  `questionAppearances`, `materials`) and `inspection` is `null`. T-04's scene reads only threads, thread-reading
  appearances, emerging focuses and readings, so nothing is invented or hidden; inspection reads the emptied families and
  the viewpoint has no Map authority, so every promoted act fails closed. No relation, node or label is created.
- **Viewpoint.** `createCanonicalStore` with no authorities, Live Focus `NONE`, PINNED at the moment's TC, the camera at
  the world origin at the opening rung. It is not the live Conversation store and nothing is written to it from Replay
  except the moment (`commitMoment`). Pinch and the accessibility zoom are T-04's own semantic zoom; the composite then
  reads the same ordinal at the new depth.

## 5. Gaps and findings

- **G-1 (technical gap, bridged — §4).** Evidence: `packages/runtime/src/historical-projection.d.ts` requires the live
  envelope; the S7-01 wire omits it by design. Smallest fix: the adapter's bridge, with a contract guard that no file
  outside the composite reads `scene.liveHead` / `scene.sealed`. No API or runtime change.
- **G-2 (frozen-contract conflict, re-anchored narrowly).** Evidence: `tests/t13-recovery-persistence-contract.test.mjs`
  allowed exactly one production creator of the canonical store, the live bootstrap. The Map reads its viewpoint from a
  `CanonicalStore`, and the brief forbids Replay state in the live conversation store, so the composite needs one
  isolated viewpoint store. Smallest fix: the T-13 contract now admits exactly that one file, and pins it as pinned at a
  moment, with no live truth, no authority, no dependency and no reach from outside the composite. The live store law is
  unchanged. For the reviewer to weigh.
- **F-1.** On the real Personal path `omittedBefore` is always 0 (S7-01 selects one contiguous range of whole messages).
  A perceptible gap is therefore shown only on `derivedGap`, the main scene with ONE declared edit (two messages omitted
  before ordinal 4), labelled DERIVED SPECIMEN in the fixture, the tests and the proof build's banner.
- **F-2 (for the Product Owner).** A Reading's `scope` carries `CONVERSATION_SESSION:<sessionId>` across the Replay wire.
  It is the creator's own conversation, served creator-exact. The composite never reads or shows it (test: no reader-facing
  string contains an id). Whether the wire keeps it is placed with S7-04, before any user opening (§10).
- **T-04 accessibility testIDs** carry canonical ids by T-04's existing design. They are not reader-facing and are
  unchanged.

## 6. Evidence

Four evidence classes are kept apart; none is described as more than it is.

| Class | What happened | Where |
| --- | --- | --- |
| **AUTOMATED TEST** | Ran and passed (§8). | Jest, `node --test`, the API spec. |
| **RENDER PROOF ON THE REAL COMPONENTS** | The Jest suite renders `ReplayMomentComposite` with the real `LivingAnalysisSurface` and `MapSurface` (wrapped only in `jest.fn(actual)` to count their mounts) over the captured wire through the real client; it asserts what they received and what they drew. | `replay-composite.test.tsx` |
| **REVIEWED SCREENSHOT** | See §6.1. | `.s7-03-visual-proof/` (not committed), the review page. |
| **REAL DEVICE TEST** | **Did not happen.** No physical device was used. Emulator screenshots are not a real device test. | — |

The 12 acceptance criteria, against the automated evidence:

1. **Exact text** — the shown message equals `replay-wire.json` byte for byte, with its speaker and accessible name.
2. **Same ordinal and TC** — the analysis requested and drawn is the moment's ordinal; the store's effective TC is its TC.
3. **No future knowledge** — moving 2 → 3 → 2 draws only what each moment knew; planted later knowledge is refused whole.
4. **No live state** — the composite imports no live store, conversation runtime or session hook (detector `liveState`).
5. **The same Living Analysis components** — the real surface and Map mount; no Replay map exists (detector `renderer`).
6. **Available and withheld rungs** — zoom fetches only the shown ordinal at the new depth; withheld rungs stay withheld.
7. **Gaps** — the derived specimen shows the dashed gap before ordinal 4; no gap on the real path.
8. **Withholding when not viewable** — the reason and both layers; no analysis read is made.
9. **Arabic, RTL, accessibility, Reduced Motion** — `ar` / `en`, RTL layout, accessible names, Reduced Motion honoured.
10. **No identity or session leak** — no reader-facing string carries an id; requests carry no identity.
11. **Engine independent of graphics** — the adapter decides no graphics; no Replay API file imports mobile code.
12. **Frozen files unchanged** — 18 sha256 pins at `3ad4e414`.

### 6.1 Reviewed screenshots

A validation APK (x86_64, release; sha256 `d6d80e66ed61226d2df2f2ff034bf55682346d8adc20785fd0e155a0026f8e6b`) was built from
this branch with the proof entry selected by `select-s703-proof-entry.mjs` and restored afterwards. Sixteen frames were
taken on the Android emulator `QANDEEL_API36` (software GPU) through the proof deep links and reviewed by the implementing
agent. They show rendering on an emulator, nothing more. The full-resolution PNGs and their SHA-256 sums are in the local,
uncommitted `.s7-03-visual-proof/`; a private review page carries downscaled copies.

| Frame | Link | What it shows |
| --- | --- | --- |
| 01 / 02 / 03 | `show/main/{1,3,4}/ar` | Moment 1 has one Thread; the second Thread first appears at moment 3; moment 4 is Qandeel's reply (criteria 1–3, 5). |
| 05 | `show/main/3/en` | English chrome; the Arabic message keeps its own start (9). |
| 16 / 04 | `show/main/4/ar/{THREAD,ANALYTICAL_OBJECT}` | Opening rungs; the orientation line names the rung (6). |
| 06 | `show/part/1/ar` | Part of a conversation: 1 of 3, at moment 4 (7). |
| 07 | `show/derivedGap/4/ar` | DERIVED SPECIMEN: the dashed gap before ordinal 4 (7). |
| 08 / 12 | `show/notViewable/1/{ar,en}` | Reason, both layers, no analysis without its messages; no Map (8). |
| 09 | `show/analysisMoved/2/ar` | The message, and the analysis at that moment not available now; no Map. |
| 10 / 11 | `preview/{openHead,legacy}/ar` | The two preview limits as the real path answered them. |
| 13 / 14 / 15 | `show/main/…/ar` | System font scale 1.3; a narrower logical width (density 600); Android animation scales 0 (9). |

A defect was found on these screenshots and fixed before the final frames: Android ignores `writingDirection`, so the
first build showed Arabic panel text on the left. The composite now sets the reader's side physically
(`textAlign: readerSide(language)`, as the Conversation does) and the message keeps its own direction; a Jest assertion
pins it. Limits: a still cannot show motion (Reduced Motion parity rests on the Jest assertion); the Map takes up to about
30 s to paint after a cold start on the software GPU; System UI raised a "not responding" dialog on the first boot.

## 7. Product Copy Gate — CLOSED (2026-10-19)

**Product Owner decision, 2026-10-19:** all 14 proposed Arabic rows are APPROVED exactly as written, including the
counting templates `position` and `gap`. No Arabic character and no counting rule changed in closing the gate. Every
English row stays PROPOSED; the decision does not approve English. The S7-02 rows reused here are untouched.
In the code: `REPLAY_COMPOSITE_COPY_GATE` is CLOSED with `decidedOn: '2026-10-19'`; every row has `status: 'APPROVED'`
(Arabic) and `enStatus: 'PROPOSED'` (English). The static contract pins the 14 Arabic rows word for word and refuses an
approved English row, an Arabic row left PROPOSED, a reworded row, a changed counting rule and a reopened gate.

Approved words are reused verbatim from their owners and not reopened: the speaker (S4-01 «أنت», W1A-01 «قنديل»), the
message accessible names (W1A-01), the temporal and spatial sentences (T-08), the scope «المحادثة كاملة» / «جزء من المحادثة»
(G1.1), the message count, the open-head refusal, «هذا غير متاح الآن.» and «إعادة المحاولة» (S7-02 Copy Gate, CLOSED).

| # | Key | Arabic (APPROVED, 2026-10-19) | English (PROPOSED) |
| --- | --- | --- | --- |
| 1 | notViewableVersionSuperseded | هذه النسخة من إعادة العرض لم تعد الحالية. | This version of the Replay is no longer the current one. |
| 2 | notViewableSourceContradictory | تغيّرت الرسائل الأصلية بطريقة لا تسمح بعرضها كما كانت. | The original messages changed in a way that doesn't allow showing them as they were. |
| 3 | notViewableSourceUnavailable | الرسائل الأصلية غير متاحة الآن. | The original messages aren't available right now. |
| 4 | notViewableEvidenceIncomplete | التحليل المحفوظ لهذه اللحظات غير مكتمل. | The saved analysis of these moments is incomplete. |
| 5 | sourceLayerAvailable | الرسائل الأصلية: متاحة. | The original messages: available. |
| 6 | sourceLayerUnavailable | الرسائل الأصلية: غير متاحة الآن. | The original messages: not available right now. |
| 7 | analyticalLayerSealed | التحليل المحفوظ: محفوظ كما كان. | The saved analysis: kept as it was. |
| 8 | analyticalLayerIncomplete | التحليل المحفوظ: غير مكتمل. | The saved analysis: incomplete. |
| 9 | noAnalysisWithoutText | لا يُعرض التحليل من دون الرسائل التي يخصّها. | The analysis isn't shown without the messages it belongs to. |
| 10 | analysisNotCurrentlyAvailable | التحليل كما كان عند هذه اللحظة غير متاح الآن. | The analysis as it was at this moment isn't available right now. |
| 11 | analysisFailed | تعذّر عرض التحليل الآن. هذا لا يعني أنه غير موجود. | The analysis couldn't be shown right now. That doesn't mean there is none. |
| 12 | previewAnalysisUnavailable | لا يتوفر تحليل محفوظ لهذه المحادثة، فلا يمكن إعادة عرضها. | There's no saved analysis of this conversation, so it can't be replayed. |
| 13 | position | في إعادة العرض: {o} من {n}. | In the Replay: {o} of {n}. |
| 14 | gap | لم تُعرض هنا {count} من المحادثة. | {count} of the conversation is / are not shown here. |

Before the decision, every row was PROPOSED in both languages and nothing was approved by being shipped in a proof build.
The gate was closed by the Product Owner's word alone, in this PR.

## 8. Verification

Ran on this branch (Windows 11, Node 24):

- Mobile Jest, `src/replay-composite` and `src/runtime-entry`: 20 suites, 310 tests, all pass. The whole mobile suite:
  220 / 222 suites pass; the two failing suites (`integration/__tests__/w2-account-access.test.tsx`,
  `integration/__tests__/depth.test.tsx`, 6 tests) fail on this machine's Arabic locale and on a network-dependent auth
  call, touch no S7-03 code, and are left to Mobile CI.
- `tsc --noEmit` (mobile): exit 0. ESLint on the changed mobile files: no errors.
- `npm run test:s7-03-replay-composite-visual-proof-contract`: 25 / 25 (detectors `renderer`, `liveState`, `model`,
  `engine`, `frozen`, `copy`, `proof`, `wiring`, `record`, each with planted defects).
- Every contract script that API CI and Mobile CI run was run locally. All pass except three that fail here for reasons
  outside S7-03: `qan-inf-03` (expo-doctor sees 10 packages behind the registry; S7-03 changes no dependency),
  `forward-safety` (its mirror re-runs `qan-inf-03`), and `full-intelligence-e2e-smoke-adapters` (needs a configured
  PostgreSQL). CI is authoritative for these.
- The local run caught real conflicts, fixed in this change: `t12p` (a deep import of the runtime entry from a test, and
  a lifetime word in the client), `qan-inf-04` (the wire fixture outside the mobile build inputs; moved), and the T-13,
  evaluator and continuity contracts (re-anchored, §9).
- API: `replay-history-proof.spec.ts` 4 / 4.

## 9. Re-anchored pins

- `tests/s7-01-replay-secure-integration-contract.test.mjs`: the history client may GET the version, its moments and their
  analysis, and nothing else; the S7-02 client still may not; two planted defects added.
- `apps/mobile/src/runtime-entry/__tests__/scope.test.ts`: the census gains exactly one class, `ReplayHistoryApiClient`.
- `tests/s5-03b-…`, `tests/s5-03c-…`: the Project Map's current task is S7-03; S7-02 is no longer current.
- `tests/t13-recovery-persistence-contract.test.mjs`: the live store is still created only by the bootstrap; the one other
  creator is the isolated Replay viewpoint, pinned, with no live truth and no authority, reached only inside the composite
  (G-2).
- `tests/thread-establishment-evaluator-contract.test.mjs`: the proof world joins the database files that drive the frozen
  gates with the TE-01 provenance (as the 0072 verifier does) and must never import the evaluator.
- `tests/thread-lifecycle-cross-session-continuity-contract.test.mjs`: the history client and its real-path wire may carry
  the two exact T-03C Thread-state-at-TC names; every other lifecycle word stays forbidden there.

## 10. BG-08 / BG-09

- **Inherited (BG-05):** none owned. `QAN-BL-NAV-02` read in full: `OPEN — UNASSIGNED`, unchanged, a dated S7-03 note.
  S7-02's S7-03 placement — the presentation of `MOMENT_NOT_SEALED` and `ANALYSIS_UNAVAILABLE` at preview — is
  discharged by `ReplayPreviewLimit`.
- **Admitted:** none. **Checked and not admitted**, each placed with S7-04: F-2 (the Reading scope's session id on the
  wire); inspection, the Timeline, the player and navigation in the composite; a real-device and TalkBack proof. F-1 is no
  obligation. The S7-03 Copy Gate is this task's own gate, CLOSED by the Product Owner on 2026-10-19 (§7).
- **Carried:** `QAN-BL-PROD-09` stays `HOSTED-DEPLOY-01`'s; `CW2-08` not opened (`NOT_EVALUATED`); the Personal Replay
  capability stays closed (no gate row).
- Register: **77 items; 36 / 4 / 9 / 28; 43 / 32 / 2**, unchanged.
- **BG-09:** this record's banner states its lifecycle; Current State, the Project Map and the Roadmap (§6.24) are updated
  in the same change.

## 11. S7-04 handover

- **Mount:** `ReplayMomentComposite({ controller, ordinal, language, insets, initialDepth })` over
  `createReplayCompositeController(reader, replayId, versionId)`, where `reader` is `ReplayHistoryApiClient` (or any
  `ReplayHistoryReader`). The player owns which ordinal is shown; the composite owns nothing but the moment.
- **Preview:** `ReplayPreviewLimit({ outcome, language, insets })` for `MOMENT_NOT_SEALED` and `ANALYSIS_UNAVAILABLE`.
- **Not provided:** the Timeline (`timeline={null}`), play / pause, step controls, the Analysis entry, finalize / reopen,
  inspection (fail-closed by the bridge; opening it needs a decision on what a Replay inspection may read).
- **Before any user opening:** a decision on the English rows (still PROPOSED); F-2; a real-device and TalkBack proof; the capability gate stays an
  operator act behind the Product Owner's approval.

## 11A. Independent review correction R1 (2026-10-19)

The independent review of PR #349 at `ed1bd9eb` accepted the visual proof within S7-03's scope (no rebuild, no new
screenshots) and asked for one focused engineering correction before any merge. Its decisions: G-1 accepted for this
proof; G-2 accepted provisionally, on condition the Replay viewpoint never reaches the live store and gains no mutating
authority (the T-13 re-anchor keeps pinning both); F-1 accepted as a labelled illustration; F-2 stays a binding privacy
item for S7-04, with no API change now.

- **Cross-read consistency** (`composite-controller.ts`). The version and its moments are used together only when they
  agree: a VIEWABLE version needs every moment's original text, a NOT_VIEWABLE one none. A mixed or contradictory answer is
  FAILED whole: no text, reason, layer or analysis is shown, and no analysis is read.
- **Revocation while viewing** (`composite-controller.ts`, `ReplayMomentComposite.tsx`). A moment analysis that answers
  NOT_VIEWABLE withdraws the viewing permission: the controller forgets the version, its texts and every analysis at once
  (state `REVOKED`), so the text and the Map leave the screen. Every read carries the epoch it started in; an answer
  from an earlier epoch is dropped when it lands, so a late answer brings nothing back. The withdrawn screen says only the
  APPROVED S7-02 «هذا غير متاح الآن.» with the APPROVED «إعادة المحاولة»; no reason or layer is shown from the earlier
  version read. A retry reads the version and its moments again, and the composite shows them only when the fresh pair is
  consistent. No analysis is read for a moment whose text is not here.
- **Tests** (`replay-composite.test.tsx`, 7 new): the three consistency cases; withdrawal of the text and Map on screen;
  an answer that started before the revocation and lands after it (out of order); a retry that shows only the fresh
  pair's reason and layers, with nothing during the reads and no analysis read; a fresh pair that is itself inconsistent.
- **Effect on the visual proof:** none on what the 16 frames show. Every frame came from a consistent real-path pair, and
  none of them involves a revocation. The withdrawn state reuses approved rows, so no new copy enters the Copy Gate (then
  still OPEN, 14 PROPOSED; closed afterwards, §11B).
- **CI at `ed1bd9eb`:** `verify-api` failed in `database/verify-migration-0052.mjs` (HIM measurement semantics, outside
  S7-03). Its own fixture check compares two back-to-back `created_at` values at millisecond precision, and both events
  landed in the same millisecond: a timing flake in a pre-existing verifier. S7-03 does not change it.

## 11B. Product Copy Gate closure (2026-10-19)

The Product Owner APPROVED all 14 Arabic rows exactly as proposed, `position` and `gap` included (§7). This change
records the decision and nothing else: the statuses in `copy.ts`, the gate's status and date, the Jest gate test, the
static contract's copy detector (the 14 rows pinned, English never approved, five planted defects), this record and the
locators. No Arabic character, counting rule, English word, S7-02 row, Replay logic or design changed; the visual proof is
unaffected (the frames show the same words, now approved).

## 12. Deliberately not implemented

The player, its navigation and controls; the Analysis-screen entry; preview / finalize / reopen in the Product UI; opening
the Capability Gate or CW2-08; sharing, publishing, library, video or audio; any API, DB or migration change;
`QAN-BL-PROD-09`.

---

**STOP — S7-03 INDEPENDENT VISUAL & TECHNICAL REVIEW GATE.** No merge, deployment or user opening without the Product
Owner's approval; S7-04 is not started.
