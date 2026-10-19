# QANDEEL — S7-02 Implementation Record v1

**Task:** S7-02 — Replay Entry & Conversation Selection (Stage 7, the second task)  
**Owned:** no backlog item. `QAN-BL-NAV-02` stays `OPEN — UNASSIGNED`, with a dated note (§10).  
**Product authority:** the Stage 7 / WP0 approval, including its corrections addendum (Replay truth is separate from
graphics; the existing Living Analysis screens are reused), and the S7-02 brief («QANDEEL — Stage 7 / S7-02 Replay Entry &
Conversation Selection»). G1.1-R3 is the reference for behaviour and placement. Its code is not production code. Nothing
is merged, deployed or opened to users without the Product Owner's explicit approval, and S7-03 does not start
automatically.  
**Status:** **S7-02 CLOSED / AT THE S7-02 INDEPENDENT REVIEW GATE — NOT MERGED / NOT DEPLOYED / CLOSED TO USERS — PRODUCT
COPY GATE OPEN** (2026-10-19). This change is the task's closing change (BG-08 / BG-09, §10).  
**Base:** `main` = merged PR #347 (S7-01) at `c152cb4b5add0b47b080ae952b7f97ee3dbf866d`.  
**Branch:** `s7/s7-02-replay-entry-selection` (one pull request).  
**Migration:** none. **API change:** none. **Server change:** none.

`MERGED ≠ DEPLOYED ≠ LAUNCH-READY`. The Personal Replay capability gate still ships with no row, so the capability hint
reads closed. While it reads closed, the Conversation looks exactly as it did before S7-02: there is no control and no
reserved slot. Every Replay command still binds the gate on the server. CW2-08 still answers `NOT_EVALUATED`.

**STOP: S7-02 — INDEPENDENT REVIEW GATE.** S7-03 is not started.

## 1. What S7-02 delivers

The «إعادة العرض» entry is an action on the current Personal conversation, in `MY_WORLD` only. It is not a world, a tab,
a library or a player. Through it the reader:

- chooses either the whole conversation or one contiguous part of it;
- for a part, picks the first and the last message on the conversation's own messages;
- saves a real Replay draft through the S7-01 API;
- can return to this conversation's own saved draft and revise it.

## 2. Files

| Area | Files |
|---|---|
| The entry layer (new) | `apps/mobile/src/replay-entry/`: `replay-anchors.ts` (the message → Session Position proof, pure), `replay-entry-controller.ts` (the entry and selection owner), `ReplayEntry.tsx` (the control, the ASIDE, the selection bar, the saved line, `useReplaySelection`), `copy.ts` (the words and their Copy Gate status), `index.ts` |
| The S7-01 client (new) | `apps/mobile/src/runtime-entry/replay-api.ts` (`ReplayApiClient`: strict decoders, the five entry routes, the frozen temporal reads) |
| Composition seams | `apps/mobile/src/conversation/ConversationSurface.tsx`: three presentation-only props (`chromeEnd`, `overlay`, `selection`), the selecting message rows and `CONVERSATION_HEADER_MIN_HEIGHT`; `conversation/index.ts` exports them |
| The P2 glyph | `apps/mobile/scripts/generate-conversation-visual.mjs` ports P2's own `replay` media glyph (two optical strokes and one play mark at 22 px); `canonical-visual.generated.ts` regenerated; `Glyph.tsx` draws a glyph's fills |
| Wiring | `runtime-entry/mobile-runtime-entry.ts` (`replayFor(bundle)` on the AC-01 seam), `runtime-entry/index.ts`, `integration/runtime/integration-runtime.ts` (one `replayEntry` per generation, retired with it), `integration/composition/DepthComposition.tsx` (the entry in the Personal product world only) |
| Tests | `replay-entry/__tests__/` (anchors 23, controller 25, surface 7), `runtime-entry/__tests__/replay-api.test.ts` (18), `integration/__tests__/s7-02-replay-entry.test.tsx` (2); the static contract `tests/s7-02-replay-entry-selection-contract.test.mjs` |
| Re-anchored pins | §9 |

**Unchanged.** The following files are byte-identical to `c152cb4b`. Each one's blob id is the same as its blob at that
commit.

| File | Blob |
|---|---|
| `LivingAnalysisSurface.tsx` | `dd6ca475` |
| `MapSurface.tsx` | `680b2a42` |
| `LivingAnalysisMap.tsx` | `f125a5ab` |
| `AnalysisReturnBar.tsx` | `f6733dc2` |

Also unchanged: every file under `apps/mobile/src/living-analysis`, `apps/mobile/src/map`, `apps/api` and `database`.

## 3. Placement (G1.1-R3 §B7)

- **The control.** The entry is one quiet 44 × 44 control at the END edge of the Conversation's upper chrome, after the
  depth control. It draws P2's `replay` media glyph, which never mirrors.
  - Arabic: END is the left edge. English: END is the right edge.
  - Its accessible name is «إعادة عرض المحادثة» / "Replay this conversation". It carries `expanded` while its ASIDE is open.
- **Visibility.**
  - The hint reads closed or unreadable: nothing is drawn, and no slot is reserved.
  - The hint reads open, but the conversation has no committed material yet (the Live Head is null): the 44 × 44 slot is
    held and is hidden from the screen reader. Nothing shifts when the control appears.
  - The control is drawn on the first committed reply.
- **The ASIDE.** It is anchored under the control at the END edge, with no scrim, so the composer stays reachable. It
  closes on a choice, a second press of the control or Android Back. When the ASIDE or the selection ends, the screen
  reader returns to the control.
- **The selection mode.**
  - The upper chrome names the scope («المحادثة كاملة» / «جزء من المحادثة») and offers nothing else. The depth control is
    not offered inside the mode.
  - The Personal row keeps its place but cannot be reached.
  - The selection bar stands where the composer was: what is chosen, «إلغاء», then the primary action.
  - Each whole message becomes a checkbox named by its own words. Its mark is in the END gutter: a ring, filled when the
    message is in. A line joins the messages inside the range. The mark is a shape, never colour alone.
- **What leaving the mode keeps.** Leaving the mode by Cancel or Back returns the live conversation exactly as it was:
  - the composer's words;
  - an unresolved submission;
  - the loaded history and the scroll;
  - the Conversation ↔ Analysis transition.

  The mode never writes the conversation. Its owner reads the conversation through two functions only: `getState` and
  `subscribe`.
- **Calls and motion.** No call runs in this build (Voice is `QAN-BL-VOICE-01`), so nothing here can interrupt one. The
  mode adds no animation, so Reduced Motion is satisfied without a special case.
- **Deviation, recorded.** The control is in the Conversation chrome only. The Analysis depth's upper band
  (`AnalysisReturnBar`, inside `LivingAnalysisMap`) is left untouched, as the brief requires for the analysis surfaces.
  The same action at the Analysis depth is placed in S7-04's production navigation (§11).

## 4. Messages → Session Positions (the proof)

`ConversationExchangeView` carries turn ids and no Session Position. The positions come from the ONE existing source of
that truth, `GET /conversation/sessions/:sessionId/temporal/events`, read through the frozen T-03A2 `TemporalApiClient`.
An event is joined to a message by the event's own `sourceTurnId`.

**Why the source is sufficient.** No server change was needed:

- migration `0065` makes each committed-unit event one non-empty commitment batch of one turn, carrying exactly its
  units' positions (`verify-migration-0065`: "the event first_sp matches the stored batch"). It is served owner-only, in
  ascending order, at up to 256 per page;
- migration `0169` resolves a draft's range to whole messages, where a message is all the units of one turn
  (`resolve_personal_range_v1`). It refuses a range that cuts a turn (`NOT_WHOLE_MESSAGES`) or that crosses a gap or
  another Session (`UNAVAILABLE`).

**The proof** (`proveAnchors`, pure). It holds only when all of these hold:

- every event is this Session's;
- positions ascend densely from 1;
- each event's `unitCount` equals its span;
- each turn's units are contiguous: a turn that reappears after another turn is refused;
- the last event reaches the Live Head the server reports.

If the head moves while the pages are read, the reading catches up after the last event, at most three times. A
committed reply during a selection extends the proof, and the extension must keep every earlier block exactly as it was.

Anything else is no proof. The selection then fails closed: nothing can be saved, and the reader is told the selection
failed.

**What is never used:**

- a FlatList index;
- a message count, or "two positions per exchange";
- the loaded page count, to mean "whole conversation";
- a parallel timeline;
- a message id sent to the server.

**Ranges.**

- **The whole conversation** is `1 .. Live Head`. Its message count comes from the proof, so older pages that are not
  loaded are still inside.
- **A part** is the range from the first chosen message to the last, both inclusive. It is provable only when:
  - both ends are whole historical messages;
  - the messages the positions cover are exactly the provable messages displayed between the two ends;
  - none of those messages is outside the two ends.

  A display that disagrees with the Session Position order is refused, never reconciled. Two kinds of exchange are
  marked `NONE`, and the joining line breaks around them:
  - an exchange with an incomplete reply. Its reply is not a message yet;
  - an exchange with no committed units, because its reply failed.
- **Stability.** The two ends are message ids, never list positions. An older page loading, or a new reply, moves no end
  and no position. Tests: anchors "older pages not loaded yet", controller "an older page loading moves no end and no
  position" and "a new reply committed during the selection extends the proof and moves no end of a part".
  - "The whole conversation" grows with a new committed reply, by definition, and its count changes visibly in the bar.

## 5. Drafts (the S7-01 API as it is)

- **The routes.**
  - `GET /replay/capability` is the hint;
  - `POST /replay/drafts` takes `{ commandId, sessionId, firstTc, lastTc }`;
  - `POST /replay/:replayId/revisions` takes `{ commandId, expectedDraftRevision, firstTc, lastTc }`;
  - `GET /replay/conversations/:sessionId` and `GET /replay/:replayId` serve the return to a saved draft.
- **Identity.** The identity is the token's, through the AC-01 authorized fetch bound to the bundle's auth generation. No
  user, owner, source class or unit id is ever sent. The integration test reads the body back exactly, with
  `Bearer token-1`.
- **One command per attempt.** A command id (UUID v4) is minted when Save is pressed, and is kept with the exact range it
  names.
  - An unreadable answer (a network error, a 5xx or a malformed body) is `UNCONFIRMED`. «إعادة المحاولة» re-issues the
    SAME command id and range. The server answers it from its committed history, so a retry never creates a second
    draft.
  - While an attempt is unresolved, no new attempt is offered. Cancel keeps it, and re-entering resumes it.
  - While a command is in flight it cannot be cancelled, re-sent or changed.
- **Governed answers. A success is never guessed.**
  - `CREATED` / `REVISED`: the saved line follows the server's coverage, never the request. `FULL_SOURCE` →
    «حُفظت المحادثة كاملة لإعادة العرض.»; otherwise «حُفظ الجزء المختار لإعادة العرض.».
  - `NOT_AVAILABLE_NOW`: «هذا غير متاح الآن.». The selection closes, nothing is saved, and the hint is read again: a
    closed gate takes the entry away.
  - `CHANGED` / `SOURCE_CHANGED`: both ends are cleared, the proof is read again, and «تغيّر شيء منذ التحديد. يُرجى التحديد
    من جديد.» is shown. A revision first re-reads the draft revision it must name.
  - `NOT_WHOLE_MESSAGES`, `UNAVAILABLE`, `SELECTION_NOT_SUPPORTED`, `LIFECYCLE_NOT_ELIGIBLE`, `COMMAND_CONFLICT`, and a 4xx
    (`INVALID_REQUEST`) or a request never issued: «تعذّر ذلك الآن.». Nothing was saved, and a new choice is a new command.
    The client never sends a range it cannot prove, so `NOT_WHOLE_MESSAGES` means the conversation changed beneath it.
- **The gate.** It stays closed. The entry is proven with controlled test fixtures only: a test transport, and an HTTP
  double answering `creationAvailable: true`. No row, operator act or configuration opens it.

## 6. The newest message and the S7-02 Product Copy Gate

**The newest message (`MOMENT_NOT_SEALED`).**

- A range that reaches the Live Head is saved truthfully. The S7-01 draft accepts it, and "whole" stays whole.
- The open-head limit is said, never hidden. Before Save, and in the saved line, the reader sees «إعادة العرض التي تشمل
  آخر رسالة لا يمكن عرضها إلا بعد أن تستمر المحادثة.».
- The S7-03 handoff carries `reachesOpenHead`. A preview of such a draft answers `MOMENT_NOT_SEALED` until a newer
  message exists.
- The frozen sealing rule is unchanged.

**The Copy Gate.**

- **Status:** `S7-02 PRODUCT COPY GATE — OPEN — PROPOSED rows await the Product Owner` (`replay-entry/copy.ts`).
- Arabic is simplified MSA and gender-considerate (LANG-01). Proof copy is not production copy.
- Every PROPOSED row is shown only behind the closed gate.

| Key | Arabic | English | Status | Source |
|---|---|---|---|---|
| replayName | إعادة عرض المحادثة | Replay this conversation | PROPOSED | G1.1-R3 proof copy (R3-J6) |
| whole | المحادثة كاملة | The whole conversation | LOCKED (Arabic) | G1.1 closure; G1.2 §L. The English is G1.1-R3 proof, PROPOSED |
| part | جزء من المحادثة | Part of the conversation | LOCKED (Arabic) | G1.1 closure; G1.2 §L. The English is G1.1-R3 proof, PROPOSED |
| savedDraft | المسودة المحفوظة | The saved draft | PROPOSED | S7-02 |
| pickHint | أول رسالة وآخر رسالة في الجزء | The first and last message of the part | PROPOSED | G1.1-R3 proof copy |
| save | حفظ | Save | PROPOSED | S7-02 |
| openHead | إعادة العرض التي تشمل آخر رسالة لا يمكن عرضها إلا بعد أن تستمر المحادثة. | A Replay that includes the newest message can be shown only after the conversation continues. | PROPOSED | S7-02 (S7-01 §8.1) |
| savedWhole | حُفظت المحادثة كاملة لإعادة العرض. | The whole conversation was saved for a Replay. | PROPOSED | S7-02 |
| savedPart | حُفظ الجزء المختار لإعادة العرض. | The chosen part was saved for a Replay. | PROPOSED | S7-02 |
| changed | تغيّر شيء منذ التحديد. يُرجى التحديد من جديد. | Something changed since this was chosen. Please choose again. | PROPOSED | S7-02 |
| notProvable | لا يمكن حفظ هذا الاختيار كجزء واحد متصل. | This selection can't be saved as one continuous part. | PROPOSED | S7-02 |
| unconfirmed | تعذّر التأكد من الحفظ. | It couldn't be confirmed that this was saved. | PROPOSED | S7-02, after the approved W1A-01 sendUnconfirmed |
| count | رسالة واحدة / رسالتان / N رسائل (3–10) / N رسالة (11+) | 1 message / N messages | PROPOSED | S7-02 |
| cancel | إلغاء | Cancel | APPROVED | S4-01 Product Copy Gate |
| tryAgain | إعادة المحاولة | Try again | APPROVED | VI-01 T03 |
| notAvailable | هذا غير متاح الآن. | This isn't available right now. | APPROVED | S4-01 Product Copy Gate |
| failed | تعذّر ذلك الآن. | That didn't work right now. | APPROVED | S4-01 Product Copy Gate |

**Deliberately absent:**

- a loading sentence;
- any "preview" or "play" word, because no player exists;
- any audio word;
- any server word or engineering term;
- a dismiss control on the saved line. The line has no word of its own. It goes when the conversation moves on or the
  entry is opened again.

## 7. Returning to a saved draft

- When the ASIDE opens, the controller reads `GET /replay/conversations/:sessionId`. It takes the newest `DRAFT` and reads
  it with `GET /replay/:replayId`.
- Only then is a third choice, «المسودة المحفوظة», offered. If the conversation has no draft, it is not offered.
- Choosing it enters a part selection that revises the draft with `expectedDraftRevision` set to the revision read. The
  draft's two ends are marked again by their positions when both are on screen.
- It is reached only from this conversation, and lists nothing else.
- For an unowned conversation the server answers an empty list, so no entry into anyone else's draft exists.

## 8. Verification (what ran)

**Mobile jest, focused, all pass:**

- `replay-anchors` 23 / 23;
- `replay-entry-controller` 25 / 25;
- `replay-entry-surface` 7 / 7, in Arabic and English. It covers RTL sides, the 44 pt targets, checkbox roles and
  states, focus return, the composer's words kept, and the depth control after Cancel;
- `replay-api` 18 / 18;
- `integration/s7-02-replay-entry` 2 / 2, through the production runtime and `DepthComposition`;
- `runtime-entry/scope` 5 / 5, re-anchored.

**Full mobile jest:** 218 / 220 suites and 2756 / 2762 tests pass. The 6 failures are all in `depth.test.tsx` and
`w2-account-access.test.tsx`. They come from the Arabic host locale of the local machine, which renders the English
fixtures in Arabic, and they match the recorded baseline (the S4-03 proof on an untouched worktree). The `scope.test.ts`
barrel pin failed once, before its re-anchor in §9, and now passes.

**Typecheck and lint:** `tsc --noEmit` is clean. `eslint` shows 0 errors on the changed files. The 2 warnings it shows
are pre-existing duplicate imports of `settings`, also present on `main`.

**Root contracts:**

- these pass: `s7-02-replay-entry-selection` (the shipped change plus 12 planted defects), `s7-01` (re-anchored),
  `w1a-01` (re-anchored), `w3-mega-u2` (re-anchored), `t12p`, `s5-03b` and `s5-03c` (re-anchored), and
  `task-closure-governance`;
- the full root run passes: 1489 / 1489, including the repository-mirror contract (`forward-safety-contract`). That
  mirror omits the root locators. The S7-02 contract first read them unconditionally and failed there, so it now reads
  them only where the tree carries them, as the precedent contracts do.

**Not run:**

- no device or emulator proof (TalkBack, a physical phone);
- no hosted environment.

The exact-head CI run is linked on the pull request.

## 9. Re-anchored pins (controlled; each names S7-02)

- **`tests/s7-01-replay-secure-integration-contract.test.mjs`.** "No mobile surface calls a Replay route" now reads: the
  ONE mobile client is `runtime-entry/replay-api.ts`, and it calls only the entry's routes. No mobile code calls
  preview, finalize, reopen, a version, its moments or their analysis; those stay S7-03's. Wrapper names stay forbidden
  everywhere in mobile. There are two new planted defects.
- **`tests/w1a-01-conversation-core-contract.test.mjs`.**
  - §6: the conversation is built in a local just before the generation object. It is still one per generation, and is
    still retired.
  - §7: only the generated `"replay": {` glyph key is stripped before the "no Replay in this layer" scan. The glyph list
    adds `replay`.
- **`tests/w3-mega-u2-understanding-surface-contract.test.mjs`.** The Understanding strip shares the one `discussion` seam
  with the Replay saved line, which stands before it in the same fragment.
- **`apps/mobile/src/runtime-entry/__tests__/scope.test.ts`.** S7-02 adds exactly one barrel export: `ReplayApiClient`,
  a plain class.
- **`tests/s5-03b-…` and `tests/s5-03c-…`.** S7-01 merged through PR #347, and S7-02 is the current task.

## 10. BG-08 / BG-09 at S7-02's closure

**Inherited (BG-05).** S7-02 inherited no owned item. Read in full:

- `QAN-BL-NAV-02` (`Analysis Replay`, `OPEN — UNASSIGNED`). It stays `OPEN — UNASSIGNED`, with a dated note: S7-02
  delivers the Conversation entry and selection, and the WP0 places its reconciliation at S7-05;
- `QAN-BL-ACCT-03`, `QAN-BL-PRIV-05`, `QAN-BL-VOICE-01`. Untouched.

**Admitted (BG-06 / BG-08).** None.

**Checked and not admitted.** Each is placed in the S7-03 / S7-04 handover (§11) and in the backlog's closing note:

- the Analysis-depth entry: S7-04;
- the presentation of `MOMENT_NOT_SEALED` and `ANALYSIS_UNAVAILABLE` at preview: S7-03;
- a device and TalkBack proof of the entry: S7-04's production proof, before any user opening;
- opening the Personal Replay capability: an operator act behind the Product Owner's approval;
- the S7-02 Product Copy Gate. It is this task's own open gate, decided by the Product Owner at its review.

**Carried from S7-01 and honoured:**

- `QAN-BL-PROD-09` is not taken: it stays `HOSTED-DEPLOY-01`'s;
- `CW2-08` is neither changed nor opened for show: it answers `NOT_EVALUATED`.

**Register.** 77 items; 36 / 4 / 9 / 28 by status; 43 / 32 / 2 by severity. It is unchanged, because S7-02 admits,
re-owns and closes nothing.

**BG-09.** This record's own banner is final for the review gate: `CLOSED / AT THE S7-02 INDEPENDENT REVIEW GATE`.

## 11. S7-03 HANDOVER — what is ready and what stays closed

**Ready.**

- **The handoff.** It is defined by identity, revision and the proven selection, never by a screen element. The
  `ReplayDraftHandoff` (`replay-entry-controller.ts`) holds:
  - `sessionId`, `replayId`;
  - `draftRevision`: the revision a preview must name;
  - `coverage`: what the server says it saved;
  - `selectedMomentCount`: the server's count;
  - `firstTc`, `lastTc`;
  - `reachesOpenHead`.
- **The client and the gate.** `ReplayApiClient` holds strict decoders for the draft, the summary and the read, and the
  `NOT_AVAILABLE_NOW` re-bind.
- **The proof.** The message → position proof (`replay-anchors.ts`) is reusable for showing which messages a draft
  covers.

**Still closed, and not started.**

- **The player and preview.** No mobile code calls `POST /replay/:replayId/preview`, `finalize`, `reopen`, the version,
  its moments or their analysis. The S7-02 contract enforces this.
- **S7-03's own words.** The presentation of `MOMENT_NOT_SEALED` and `ANALYSIS_UNAVAILABLE` at preview belongs to S7-03,
  through its own Copy Gate. S7-02 only states the open-head limit at selection.
- **Graphics.** Replay data never drives graphics. A player renders a moment through the existing analysis surfaces
  (S7-01 §11).
- **For S7-04.** S7-04 owns:
  - the same entry at the Analysis depth;
  - navigation into and out of a player;
  - the native device proof.
- **The capability.** It stays closed: the gate has no row.

## 12. Deliberately not implemented

- a player, a preview, a historical animation, or an alternative analysis or map;
- a library, sharing, publishing, or video or audio export;
- any server, API, migration or frozen-contract change;
- opening the gate;
- S7-03 and S7-04.
