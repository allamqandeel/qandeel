# QANDEEL — S7-05 Replay Final Integration, Device Proof & Stage Closure — Implementation Record v1

**Task:** S7-05 — Replay Final Integration, Device Proof & Stage Closure (Stage 7)
**Status:** IN PROGRESS — CP1 DELIVERED — CP2 DELIVERED EXCEPT TalkBack (it needs the Product Owner to operate the phone; not a pass) — CP3: the four D5 proofs DELIVERED; `QAN-BL-NAV-02`, BG-08 / BG-09 and the closure NOT YET DELIVERED — NOT MERGED / NOT DEPLOYED / CLOSED TO USERS
**Date:** 2026-10-20
**Branch / base:** `s7/s7-05-replay-final-integration` from `main` at `f9bc3947d840646385c618ea8db400914ca5aac4`, the merge
of PR #350 (S7-04 — Production Replay Player & Navigation). S7-01 merged through PR #347 as `c152cb4b`, S7-02 through
PR #348 as `3ad4e414`, S7-03 through PR #349 as `0d8a7335`.
**Authority:** the Product Owner's S7-05 brief (research and CP0 only) and the S7-05 CP0 Product Owner Final Decisions &
Implementation Authorization (2026-10-20): D1 — F-2 Option B APPROVED with conditions; D2 — the 27 English rows APPROVED
word for word; D3 — real-device validation inside S7-05; D4 — `QAN-BL-NAV-02` approved in principle for closure at CP3,
only on complete evidence; D5 — four focused tests in the existing suites. CP1, CP2 and CP3 in one branch and one PR. The
S7-01 … S7-04 records; CW2-05 / I-06, unchanged; migration `0169`, unchanged.

Merging, deploying, opening the Personal Replay capability, any distribution, CW2-08 and Stage 8A each need the Product
Owner's explicit approval. None is done here.

## 1. What S7-05 delivers (so far)

| Checkpoint | Scope | State |
| --- | --- | --- |
| CP1 | F-2 Option B (D1); the 27 English rows (D2); post-merge reconciliation of S7-04; tests and pins | DELIVERED (this record §2–§5) |
| CP2 | Real-device render and accessibility proof (D3) | DELIVERED except TalkBack (§7); the production journey through an open gate is not performed and not claimed |
| CP3 | The four focused tests (D5); BG-05 / BG-08 / BG-09; `QAN-BL-NAV-02` (D4); final locators; the Stage 7 status | D5 DELIVERED (§8); the rest NOT YET DELIVERED |

## 2. F-2 — Option B (Product Owner decision D1, 2026-10-20)

**The finding (S7-03 §5, S7-04 §5).** A Reading reaches the Personal Replay wire inside a moment's analysis at
`ANALYTICAL_OBJECT` depth and above. Its `scope` is the Hypothesis scope, which for every live writer is
`CONVERSATION_SESSION:<session uuid>`: the source Session's id crossed the wire (never shown, logged or sent onwards by
the client, but present).

**D1 condition 1 — every scope form that can reach a Personal Replay, checked.**

- The writers. `hypotheses.scope` is free text, 1 … 500 characters (migration `0005` CHECK). The live writers — durable
  intent (`0029` / `0033`), with the API assembler fixing `${INTENT_SCOPE_KIND}:${sessionId}` — write only
  `CONVERSATION_SESSION:<lowercase uuid>`. The service-role functions `0021` `background_create_system_hypothesis_v1` and
  `0027` `server_create_hypothesis_v1` accept any text; no route reaches them (`HypothesisGenerationService` has none).
  So a non-canonical scope is legal in the table but written by no live path.
- The reads. The `0072` projection a moment's analysis is read through includes the Readings of this Session AND of the
  world baseline (`e.world_version <= baseline`): a Reading's scope can name an EARLIER Session of the same world. That
  is the second reason the id must not cross: it is not even always this conversation's.
- The captured truth. Every scope in the real-PostgreSQL captures is canonical: 14 in `tests/fixtures/s7-03-replay-history`,
  24 in `tests/fixtures/s7-04-replay-player`.

**D1 conditions 2–4 — verify the exact form, send the class alone, refuse anything else.** In `ReplayService`
(`apps/api/src/replay/replay.service.ts`, `readingOf`), each disclosed Reading's scope is tested against the one canonical
form `^CONVERSATION_SESSION:<lowercase uuid>$`; on a match it leaves as `CONVERSATION_SESSION`, its class, and nothing
else of the Reading changes. Anything else — free text such as `USER`, the bare class, an empty id, an uppercase uuid, a
padded scope, another class, two sessions — refuses that moment's analysis whole (`503 UNAVAILABLE`, as every other refused projection answer); it is
never repaired. Below `ANALYTICAL_OBJECT` no Reading is disclosed, so no scope is examined. The types say the same:
`ReplayReading` (`replay.types.ts`) is a `DisclosedReading` whose `scope` is the literal `'CONVERSATION_SESSION'`.

**D1 condition 5 — no effect on historical truth.** The point digest is verified in `0169`'s SQL before the API sees the
answer, and the narrowing happens after it; the historical identity (replay, version, ordinal, TC), the analysis apart
from the scope, the relations and the visual projection are unchanged. Proven: `replay.spec.ts` (two Readings, one from an
earlier Session — each leaves as the class, the Readings are otherwise equal, the relations unchanged; seven refused forms,
each `503` at the analysis depth while `WORLD` stays available); `replay-history-proof.spec.ts` and
`replay-player-proof.spec.ts` (over the real captured `0169` rows: every captured scope canonical, every served scope the
class, no captured Session id in any answer). The two wires were regenerated from those specs; only the scope lines
changed (28 in `replay-wire.json`, 48 in `replay-player-wire.json`); no `CONVERSATION_SESSION:` remains.

**D1 condition 6 — nothing treats the class as the full scope.** The mobile decoder
(`apps/mobile/src/runtime-entry/replay-history-api.ts`) accepts exactly the vocabulary `['CONVERSATION_SESSION']` and
refuses anything else (planted: a Session-bearing scope, a bare `:`, lower case, `USER`, empty, missing). The governed
adapter bridges the Session as `replay:<replayId>:<versionId>` and never from a scope; T-04's `deriveMapScene` never reads
it. Proven: the Map's scene at every captured moment and depth is identical whatever a Reading's scope says
(`replay-composite.test.tsx`); the player's wire carries no Session id and only the class (`replay-player.test.tsx`).

**D1 conditions 7–8.** API, wire, mobile tests and the S7-03 / S7-04 contracts are updated (§5). Migration `0169`, the
frozen contracts (`I-06`, CW2-05, T-03C's mapper and depth law, `packages/runtime`) and the meaning of `scope` elsewhere
are unchanged: the narrowing is the Replay wire's alone.

## 3. The 27 English rows (Product Owner decision D2, 2026-10-20)

All 27 APPROVED word for word; no Arabic letter changed (checked against `main` for both files: 20 and 16 Arabic strings
identical); the S7-04 13 rows unchanged. The dynamic counts keep their rules and show no brackets.

**S7-02 (`apps/mobile/src/replay-entry/copy.ts`) — 12 rows and the count:**

| Row | Approved English |
| --- | --- |
| replayName | Conversation replay |
| whole | The whole conversation |
| part | Part of the conversation |
| savedDraft | Saved draft |
| pickHint | The first and last messages of the part |
| save | Save |
| openHead | A Replay that includes the latest message can only be shown once the conversation continues. |
| savedWhole | The whole conversation was saved for a Replay. |
| savedPart | The selected part was saved for a Replay. |
| changed | Something changed since you made this selection. Please select again. |
| notProvable | This selection can't be saved as one continuous part. |
| unconfirmed | We couldn't confirm whether it was saved. |
| count | 1 message / {n} messages |

**S7-03 (`apps/mobile/src/replay-composite/copy.ts`) — 14 rows:**

| Row | Approved English |
| --- | --- |
| notViewableVersionSuperseded | This version of the Replay is no longer current. |
| notViewableSourceContradictory | The original messages have changed, so they can't be shown as they were. |
| notViewableSourceUnavailable | The original messages aren't available right now. |
| notViewableEvidenceIncomplete | The saved analysis of these moments is incomplete. |
| sourceLayerAvailable | Original messages: available. |
| sourceLayerUnavailable | Original messages: not available right now. |
| analyticalLayerSealed | Saved analysis: kept as it was. |
| analyticalLayerIncomplete | Saved analysis: incomplete. |
| noAnalysisWithoutText | The analysis isn't shown without the messages it belongs to. |
| analysisNotCurrentlyAvailable | The analysis as it was at this moment isn't available right now. |
| analysisFailed | The analysis couldn't be displayed right now. This doesn't mean it doesn't exist. |
| previewAnalysisUnavailable | There's no saved analysis of this conversation, so it can't be replayed. |
| position | In the Replay: {ordinal} of {count}. |
| gap | {count} of the conversation is / are not shown here. (`is` for one message, `are` otherwise) |

**How the approval is recorded.** Each row's `enStatus` is `APPROVED` and its source names "S7-05 D2". The historical
gate strings of S7-02 and S7-03 stay as they were decided (their records are frozen); each gate gains `englishApproval`
and `englishApproved`, and `englishProposed` is empty. Seven English rows changed text in each file; the others were
approved as they stood.

**One name.** «إعادة عرض المحادثة» / "Conversation replay" is the one `replayName` row: the Conversation entry's
accessible name (`ReplayEntry.tsx`), the Analysis entry's accessible name and the player's title (`ReplayPlayer.tsx`) all
read it by reference. Proven in both languages (`replay-player.test.tsx`, `replay-entry-surface.test.tsx`,
`s7-04-replay-player.test.tsx`).

**T-08's inherited sentences** (`temporalSentence`, `spatialSentence`, reused by the composite) carry no row status: they
are T-08's frozen chrome copy under the VI-01 register law (`orientation-chrome/product-copy.ts`), approved with T-08's
closure. No conflict with the 27 rows was found, so they are not reopened.

## 4. Post-merge reconciliation (S7-04)

S7-04 merged through PR #350 as `f9bc3947d840646385c618ea8db400914ca5aac4` (2026-10-20; not deployed; the capability
closed). Current State, the Project Map, the Roadmap (§6.26) and the backlog's `QAN-BL-NAV-02` note are reconciled in this
change; the S7-04 record stays as written at its closing change.

## 5. Re-anchored pins and tests (CP1)

- `tests/s7-02-replay-entry-selection-contract.test.mjs`: each English row is held to its approved words and to
  `APPROVED`, where it was held to `PROPOSED`; the count's English rule pinned; three planted defects (an English row back
  to PROPOSED, an approved English row reworded, the count rule changed).
- `tests/s7-03-replay-composite-visual-proof-contract.test.mjs`: the 14 English rows pinned word for word (counting
  templates by their source), no `PROPOSED` English; three planted defects. The sha256 pins of `replay.service.ts`,
  `replay.types.ts` (F-2) and `replay-entry/copy.ts` (D2) move, each with an S7-05 comment.
- `tests/s7-04-replay-player-navigation-contract.test.mjs`: the sha256 pins of `replay.service.ts`, `replay.types.ts`,
  `replay-history-api.ts` (F-2) and both copy files (D2) move, each with an S7-05 comment.
- Jest: the word-for-word tests of all 27 rows; the count, position and gap rules; each NOT_VIEWABLE reason's English;
  the one Replay name in both languages; F-2 as in §2.

## 6. Verification (CP1)

Only what actually ran is listed; CI on the PR head is the authority for merge.

| Check | Result |
| --- | --- |
| API Jest `src/replay` (`replay.spec.ts`, `replay-history-proof.spec.ts`, `replay-player-proof.spec.ts`) | 78 / 78 pass; `tsc --noEmit` clean |
| Mobile Jest, focused (replay-composite, replay-player, replay-entry, runtime-entry, the S7-0x journeys) | 29 suites, 463 / 463 pass; `tsc --noEmit` clean |
| S7-01 / S7-02 / S7-03 / S7-04 / S7-05 contracts | 23 / 23, 19 / 19, 31 / 31, 58 / 58, 20 / 20 pass |
| S5-03B, S5-03C contracts (current task re-anchored to S7-05) | 13 / 13, 8 / 8 pass |
| `npm run test:task-closure-governance-contract` | 24 / 24 pass |
| Every root `*contract*` script | 108 of 111 pass; the three below do not |
| Mobile Jest, whole suite (with the English locale shim; this machine's `Intl` is ar-EG) | 227 suites, 2889 / 2889 pass |
| `apps/mobile` ESLint on the touched trees | clean |

After CP2 and the D5 proofs (local, Windows, on the head that carries them):

| Check | Result |
| --- | --- |
| `database/verify-migration-0169.mjs` on local PostgreSQL 17 (a clone of `0001`–`0168`, then `0169`) | 35 / 35 scenarios pass, E15 included; "migration 0169 verified" |
| Mobile Jest `s7-04-replay-player.test.tsx` (D5 (1) and (4)) and `replay-entry-controller.test.ts` (D5 (2)) | 7 / 7 and 26 / 26 pass |
| Mobile Jest, whole suite (English locale shim) | 228 suites, 2895 / 2895 pass. A first run had `w3-settings-appearance-signout.test.tsx` fail as a suite with no failing test; it passes alone (15 / 15) and in the full rerun, so it is recorded as a one-time load failure, not as green |
| Mobile `tsc --noEmit`; ESLint on the touched test files | clean |
| API Jest `src/replay` | 78 / 78 pass |
| S7-01 / S7-02 / S7-03 / S7-04 / S7-05 contracts | 23 / 23, 19 / 19, 31 / 31, 58 / 58, 23 / 23 pass |
| S5-03B, S5-03C contracts; `npm run test:task-closure-governance-contract` | 13 / 13, 8 / 8; 24 / 24 pass |

Not green locally, for reasons outside this change (as S7-04 recorded): `test:qan-inf-03-deterministic-expo-dependency-validation-contract`
(expo-doctor's online checks cannot run deterministically here) and `test:forward-safety-contract` through the same
check; `verify:replay-analytical-projection-render-contract:integration` (needs a fully migrated PostgreSQL; it runs in
API CI).

## 7. CP2 — the real-device proof (Product Owner decision D3)

### 7.1 What was proven, and what kind of proof it is

D3 asks for three proofs, reported apart. This section keeps them apart:

| Proof | What it is | State |
| --- | --- | --- |
| **Device render / accessibility proof** | the PRODUCTION phase surface (`RuntimePhaseSurface`) on the Product Owner's physical phone, over the validation-only proof world and the REAL-PATH captured Replay wire (§7.2) | DELIVERED for every D3 item except TalkBack (§7.4) |
| **API / DB proof** | the same wire's truth chain: the 0169 wrappers on real PostgreSQL (`verify-migration-0169`), the real `ReplayService` over the captured rows (`replay-player-proof.spec.ts`), and the D5 proofs (§8) | DELIVERED |
| **Production journey through an open gate** | a reader on a deployed build, against a hosted database, with the Personal Replay capability open | **NOT PERFORMED — and not claimed.** The capability stays closed (D3), nothing is deployed and 0169 is not on a hosted database. No harness run here is a production journey. |

### 7.2 The device and the build

- **Phone:** HONOR ALI-NX1 (build `ALI-N21 9.0.0.226(C185E14R3P1)`), Android 15 / SDK 35, arm64-v8a, 1200 × 2652 at
  520 dpi; TalkBack 17.1.0 with Google TTS installed.
- **Proof APK:** sha256 `a0835e92f58dad56ea26a0529bccac84c2184edd4dc58c4527b748861534b302`, built from `bbaef7a3` (this
  branch's CP1 commit; the Product code has not changed since — later commits touch tests, the verifier and documents).
  Package `com.qandeel.mobile.s705proof`, label "S7-05 proof", installed beside the Product Owner's own
  `com.qandeel.mobile`, which was not touched. The installed APK's sha256 was checked on the device against the built one.
- **What runs:** `S705ProofRoot` mounts the production `RuntimePhaseSurface` over `createS705ProofWorld(scenario)`: the
  S7-04 proof world (an in-memory synthetic identity and a fixture conversation; no real person, no network) and its
  REAL-PATH captured Replay wire. The launch link `qandeel://s705-proof/<journey|faults|revoked>` picks the network's
  behaviour; no Replay answer is invented (§1, the S7-05 contract's `proofViolations`).
- **Phone settings** were read before the proof and restored after it: font scale 1.0, the three animator scales 1.0,
  no accessibility service enabled.

### 7.3 Results (screenshots and accessibility dumps kept outside the repository, in the local evidence folder)

| D3 item | Result on the device |
| --- | --- |
| Entry from the Conversation | The END-edge control «إعادة عرض المحادثة» / "Conversation replay"; the menu (whole, part); the approved English and Arabic |
| Part | The hint, first / last tap, "4 messages"; Save → "The selected part was saved for a Replay." |
| Whole | The selection renders (title, the open-head note, "6 messages"). Its save is answered `404` by the harness because the captured journey never saved the whole conversation, so the device shows "That didn't work right now." **Harness limit — not a Product proof of saving Whole.** Whole's save is proven by the S7-02 / S7-04 Jest journeys and the 0169 verifier (E04 `FULL_SOURCE`). |
| Draft → Preview → Finalize → Reopen | Preview opens the player ("In the Replay: 1 of 6."); Finalize → "A private copy of the Replay was saved. It isn't shared with anyone."; Reopen → "The Replay is a draft again and can be edited." |
| Entry from the Analysis | The Analysis's END-edge entry opens the newest Replay; its Back reads "Analysis" |
| Spine: tap, drag, preview, commit | Tap → 4 of 6 (English), 3 من 6 (Arabic); drag → 6 of 6 / 6 من 6, committed on release; the Arabic Spine runs right to left |
| Play / Pause | Play advanced 1 → 4, Pause held it; played to the end it offers "Play from the start" |
| Arabic RTL / English LTR | Per-app locale `ar-EG` / `en-US`: mirrored chrome, the control at the END edge, the approved words in each language |
| Font 100 / 130 / 200 % | 130 % and 200 %, both languages: the actions wrap; the Play control and the Spine stay at the same bounds while the reading scrolls beneath them (`[52,1691][1148,1834]` at 200 %). At 130 % a one-pixel settle after the first scroll, and no movement on two further scrolls. |
| Reduced Motion | The three animator scales at 0 (Android "Remove animations"): the player draws the same moment and world; the Spine tap gives 3 of 6; Play advances 3 → 5 → 6 |
| Long messages, stable controls | As the font rows: at 200 % the long message scrolls under unmoved controls |
| Failures and Retry (`faults`) | Each first request dropped once, then retried with the same command: save — "We couldn't confirm whether it was saved." + Try again → saved; preview — "We couldn't confirm whether the action was completed." + Try again → the player; finalize and reopen — unconfirmed, then retried; analysis — "The analysis couldn't be displayed right now. This doesn't mean it doesn't exist." + Try again → the Map |
| Revocation (`revoked`) | The captured source part (1 … 3, "2 messages"): NOT_VIEWABLE with "The original messages aren't available right now." / "Original messages: not available right now." / "Saved analysis: kept as it was." / "The analysis isn't shown without the messages it belongs to."; no text; Finalize → "Something changed since you made this selection. Please select again." |
| The open head | The captured open-head draft (1 … 7) previews to the approved open-head sentence. The save notice said "The whole conversation was saved…" because the captured coverage of that draft is `FULL_SOURCE` (the captured world's conversation had 7 SP); a harness mismatch with the fixture conversation on screen, recorded, not a Product defect. |
| The live conversation unchanged | Back from the player returns to the same conversation, with nothing sent |
| G-1 after a restart | Force-stop and relaunch: the Analysis entry reaches the "Saved draft", and Preview plays it |
| The world beneath the player | The compressed accessibility tree (important-for-accessibility nodes only) holds the player alone: the Conversation beneath is not reachable (`DepthComposition` hides it with `no-hide-descendants`; `accessibilityViewIsModal` is iOS-only) |

### 7.4 TalkBack (D3: names, focus order, moment reading, increment / decrement)

The accessibility tree on the device gives the names and the tree order (English: Back "Conversation", the title,
"Save a private copy", "Edit the Replay", "Play", "Replay moments, In the Replay: 1 of 6.", the position, the pace note,
the message, the reading; Arabic: the same names, the header and transport children in their right-to-left order).
That is not a TalkBack proof: on a phone that is not rooted, injected input bypasses TalkBack, so its focus order,
its speech and its increment / decrement gestures can only be driven by a person. **TalkBack is not yet proven on the
device; it is not reported as a pass.**

### 7.5 Observation outside S7-05

The Arabic labels of the bottom world switcher (`GlobalSwitcher`) truncate at font scale 1.0 on this phone («قند…»,
«العالم المش…», «لعالم ال..»). It is not Replay code and it is not inside the player. It is admitted under BG-08 at this
task's closing change (CP3).

## 8. The four focused proofs (Product Owner decision D5)

Each lives in an existing suite, and each was shown to fail on a planted defect before it was kept.

| D5 | Proof | Where | Planted defect it catches |
| --- | --- | --- | --- |
| (1) An account switch after a sign-out | A saves, previews and privately finalizes a Replay and signs out; B signs in through the explicit path into its own Session with one committed exchange of its own. B's screen shows B's conversation and nothing of A — no passage, no notice, none of A's words or moments, mounted or hidden. B's Analysis entry reads B's own empty history. Every request after the sign-out carries B's credential, and none names A's Session, Replay or version. | `apps/mobile/src/integration/__tests__/s7-04-replay-player.test.tsx` (the production composition, over the captured real-path wire) | B's list answering A's finalized Replay (caught by the id check); B's history carrying A's conversation (caught by the words check) |
| (2) A revise retry with the same command id | The saved draft is revised and the answer is lost (UNCONFIRMED). Save again issues nothing. Try again re-issues the ONE command, with the same id, Replay, expected revision and range, and the answer that follows is the saved revision. The server's half — an equivalent retry answers its first result, gate open or closed, and a different range under the same id is COMMAND_CONFLICT — is `verify-migration-0169` E10, on real PostgreSQL. | `apps/mobile/src/replay-entry/__tests__/replay-entry-controller.test.ts`; `database/verify-migration-0169.mjs` E10 | the controller minting a new id on a revise retry |
| (3) A read of an existing Replay after the Creation Capability Gate closes | A FINALIZED and a PREVIEW_READY Replay exist under the open gate. Under `EMERGENCY_DISABLED` and again under `DISABLED`: the hint says closed; the Replay, version, moments (with their text) and moment analysis of each, and the conversation's list, read exactly as before; reopen, finalize and create are NOT_AVAILABLE_NOW and write nothing; the other human reads nothing. | `database/verify-migration-0169.mjs` new scenario E15 (real PostgreSQL 17; 35 / 35 scenarios pass) | — (each assertion compares with the non-empty reads captured under the open gate) |
| (4) NOT_VIEWABLE through the real path | The reader saves the captured source part (1 … 3) and previews it; its original message changes; Finalize is refused (CHANGED), and the passage reads its version again as the captured withdrawn scene: the reason, both layers and "The analysis isn't shown without the messages it belongs to.", no text, no Map, no Spine, no further analysis read. The chain is real: the 0169 rows on real PostgreSQL (E07 proves the same withdrawal there), the real `ReplayService` over them (`replay-player-proof.spec.ts`), the captured wire, the production composition. | `apps/mobile/src/integration/__tests__/s7-04-replay-player.test.tsx` | the source never withdrawn |

The S7-05 contract (`d5Violations`) requires all four to stay, and requires that none is skipped or singled out. Three
planted defects show it: a proof removed, the E15 scenario renamed, and a proof skipped.

## 9. Deliberately not implemented

Opening the Personal Replay Capability Gate or CW2-08; any migration, SQL or route change; any change to the general
meaning of a Hypothesis scope; sharing, publishing, distribution or export; Stage 8A; a redo of S7-01 … S7-04.
