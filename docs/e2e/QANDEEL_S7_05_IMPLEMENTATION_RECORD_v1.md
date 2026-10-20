# QANDEEL — S7-05 Replay Final Integration, Device Proof & Stage Closure — Implementation Record v1

**Task:** S7-05 — Replay Final Integration, Device Proof & Stage Closure (Stage 7)
**Status:** IN PROGRESS — CP1 DELIVERED (F-2 Option B, the 27 English rows, post-merge reconciliation) — CP2 (real-device proof) and CP3 (focused tests, NAV-02, closure) NOT YET DELIVERED — NOT MERGED / NOT DEPLOYED / CLOSED TO USERS
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

## 1. What S7-05 delivers (so far: CP1)

| Checkpoint | Scope | State |
| --- | --- | --- |
| CP1 | F-2 Option B (D1); the 27 English rows (D2); post-merge reconciliation of S7-04; tests and pins | DELIVERED (this record §2–§5) |
| CP2 | Real-device render and accessibility proof (D3) | NOT YET DELIVERED (its validation-only proof tooling is in place, §7) |
| CP3 | The four focused tests (D5); BG-05 / BG-08 / BG-09; `QAN-BL-NAV-02` (D4); final locators; the Stage 7 status | NOT YET DELIVERED |

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

Not green locally, for reasons outside this change (as S7-04 recorded): `test:qan-inf-03-deterministic-expo-dependency-validation-contract`
(expo-doctor's online checks cannot run deterministically here) and `test:forward-safety-contract` through the same
check; `verify:replay-analytical-projection-render-contract:integration` (needs a fully migrated PostgreSQL; it runs in
API CI).

## 7. Not yet done (CP2, CP3)

CP2: the real-device proof (D3) on the Product Owner's Android phone. Its validation-only tooling is in place, outside
the production import closure: `apps/mobile/src/integration/__validation__/S705ProofRoot.tsx` and `s705-proof-world.ts`
(the S7-04 proof world and its REAL-PATH captured wire, with a per-launch scenario — `journey`, `faults`: the first save,
preview, finalize, reopen and moment-analysis read each dropped once by the network; `revoked`: the captured source Replay
read as its captured withdrawn scene; no Replay answer invented), `s705-proof-entry.tsx`, and
`apps/mobile/scripts/select-s705-proof-entry.mjs` (refuses without `S705_DEVICE_PROOF=1`); tested by
`integration/__tests__/s7-05-proof-world.test.ts`. CP3: the four focused tests (D5); BG-05 / BG-08 / BG-09;
`QAN-BL-NAV-02` (D4); the final record with the Engineering Complete / Real-device Verified / Merged / Deployed /
Launch Ready distinction.

## 8. Deliberately not implemented

Opening the Personal Replay Capability Gate or CW2-08; any migration, SQL or route change; any change to the general
meaning of a Hypothesis scope; sharing, publishing, distribution or export; Stage 8A; a redo of S7-01 … S7-04.
