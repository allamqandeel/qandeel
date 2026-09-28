# QANDEEL — W1A-01 Authenticated Personal Conversation Core — Implementation Record v1

**Task:** W1A-01 — Authenticated Personal Conversation Core (E2E-01 wave W1A)
**Rows:** `E2E-B-03` (write / send), `E2E-B-04` (read QANDEEL's reply and the authoritative conversation-so-far),
`E2E-B-07` (Conversation ↔ Analysis)
**Baseline:** `fc4d812e4f16f52087c24cbf8296e0c0dde7e2e8`
**Branch:** `feat/w1a-01-authenticated-personal-conversation-core`
**Status:** IMPLEMENTED ON A DRAFT PR — NOT MERGED. Production Integration has started through this one bounded,
Product-Owner-authorized slice only; no other wave or Product area is opened by it.

---

## 1. Authorization

Phase A (read-only research + Owner Decision Pack) stopped at the Product Owner hold point. The Product Owner then
returned the approval record *QANDEEL_W1A01_OWNER_APPROVAL_PHASE_B_AUTHORIZATION* with the exact phrase

> **AUTHORIZE W1A-01 PRODUCTION INTEGRATION**

A first Phase B attempt stopped again on an **architecture blocker** (§6): the approved reply-retry rule could not be
implemented without reopening the frozen turn-state machine. The Product Owner and Technical Lead resolved it by
choosing **Option C**, replacing the ambiguous-send wording, and re-confirming the rest of the authorization. This
record carries both decisions as the implementation contract, so that no string or behaviour is later guessed.

## 2. Product copy — the implemented contract, verbatim

Every visible and assistive string the W1A-01 surfaces expose is below, and nothing else. The one place they are
written is `apps/mobile/src/conversation/copy.ts`; the W1A-01 contract fails if any is altered or any other string is
added there.

### Already frozen / approved

| Surface / state | Arabic | English |
|---|---|---|
| Conversation | المحادثة | Conversation |
| Analysis → Conversation (visible label and accessible name) | المحادثة | Conversation |
| Conversation → Analysis, visible label | تحليل المحادثة | Analysis |
| Conversation → Analysis, accessible name | تحليل المحادثة | Analysis of this conversation |
| Retry | إعادة المحاولة | Try again |
| Product name | قنديل | QANDEEL |

### Product Owner approved in the W1A-01 gate

| Surface / state | Arabic | English |
|---|---|---|
| Composer placeholder | كلامك هنا | Write here |
| Composer accessible name | رسالتك لقنديل | Your message to QANDEEL |
| Send accessible name (icon-only control) | إرسال | Send |
| User turn, assistive attribution | كلامك: {text} | You: {text} |
| QANDEEL turn, assistive attribution | قنديل: {text} | QANDEEL: {text} |
| Waiting for reply | في انتظار رد قنديل | Waiting for QANDEEL's reply |
| Send outcome unknown (replacement wording, final decision) | تعذّر التأكد من إرسال الرسالة. | It couldn't be confirmed that the message was sent. |
| Reply failed | تعذّر إكمال رد قنديل. | QANDEEL's reply couldn't be completed. |
| Conversation history failed to load | تعذّر تحميل المحادثة. | The conversation didn't load. |
| Send definitively refused before admission (approved in the W1A-01 correction pass) | تعذّر إرسال الرسالة. | The message wasn't sent. |

The first approved ambiguous-send wording («لم نتأكد من إرسال الرسالة.» / "We couldn't confirm the message was sent.")
is **superseded** by the replacement above, which follows VI-01's process-framed failure pattern.

### Deliberately silent

Empty Conversation (no opener, no fallback name); history loading; success; any "offline" or connection claim; day
markers; and every server message, status value, test id or engineering term.

### Copy needs found during implementation, NOT invented (reported to the Product Owner)

The definitive-refusal need reported here in Phase B was answered by the Product Owner in the correction pass with the
wording above (§10). No copy need of the Conversation layer remains open.

## 3. Interaction behaviour — as implemented

| Decision | Implemented behaviour | Where |
|---|---|---|
| Submit | the Send control only; the composer is multiline, Enter inserts a new line (`submitBehavior="newline"`, no `onSubmitEditing`) | `ConversationSurface.tsx` |
| Send visibility | Send is ABSENT without non-blank words; no disabled state and no explanation string | `ConversationSurface.tsx` |
| After Send | the words stay in the composer, the composer is LOCKED, the waiting line is shown and announced; only the server's confirmation clears the composer and turns the words into a committed `UTTERANCE` | `conversation-controller.ts` |
| One in flight | one unresolved logical submission at a time; nothing else can be sent or typed | `conversation-controller.ts` |
| Cancel (B-05) | not implemented | — |
| Send outcome unknown | first resolved BY READING the history (which admits nothing) for a turn under this submission's key; if none, the words stay locked with «تعذّر التأكد من إرسال الرسالة.» and «إعادة المحاولة», which re-issues the SAME words under the SAME key | `conversation-controller.ts` |
| Send definitively refused (`4xx` before admission, or a request that could not be issued) | nothing was committed: the words return to the EDITABLE composer with «تعذّر إرسال الرسالة.» / "The message wasn't sent.", shown and announced; no retry is offered or implied, and the next Send is a NEW submission under a NEW key; no server word is shown | `conversation-controller.ts`, `ConversationSurface.tsx` |
| Confirmed reply failure | the committed user turn stays in the conversation with «تعذّر إكمال رد قنديل.» on QANDEEL's side; **no retry**; no FAILED turn is reopened or replaced (Option C) | `conversation-controller.ts`, `ConversationSurface.tsx` |
| Reply exists but post-finalization establishment failed | reading finds the COMPLETED turn; the exchange is shown, and the server's explicitly supported same-key replay re-enters establishment, which cannot generate or admit anything | `conversation-controller.ts` |
| A committed turn still PENDING (e.g. restored from history after a crash) | shown with the waiting line and left alone for `ABANDONED_REPLY_RECHECK_MS` (the frozen 120 s generation lease + 5 s). Then it is re-checked through the EXISTING same-key path — for GENERATING that is the orchestrator's bounded liveness check (`recover_expired_generating_conversation_turn_v1`): a live lease stays PENDING, an expired one becomes canonical FAILED, neither reaches a provider; a turn that never reached its claim is claimed there once, atomically — and the authoritative history is read again. At most `ABANDONED_REPLY_RECHECKS` (2) re-checks per turn; a turn still PENDING after them stays truthfully PENDING. FAILED and COMPLETED turns, and turns without a key, are never re-sent; no key is minted; the turn-state machine is unchanged (§10) | `conversation-controller.ts` |
| No answer at all | after the frozen 120-second generation lease with no answer, the submission is reconciled by reading exactly as an unknown outcome; a late answer is still applied | `SUBMISSION_CONFIRMATION_WINDOW_MS` |
| History | completed exchanges, committed turns whose reply FAILED (with that state), and committed turns still awaiting a reply (with the waiting line), oldest to newest; rebuilt from the server after every restart | API `listTurns`, `conversation-controller.ts` |
| Scrolling | opens at the newest turn; follows a new reply only when the reader is near the newest turn; never pulls a reader off older turns; no "new message" pill; older pages load as the top approaches | `ConversationSurface.tsx` |
| Landing | after sign-in and after restart: the Conversation. Depth is never persisted (the T-13 recovery record is unchanged) | `DepthComposition.tsx` |
| Depth transition | F2's symmetric appearance cross-fade (`qandeel.appearance.switch.crossfade`, 200 ms, linear) in standard motion; a cut under Reduced Motion (`crossfade-reduced-motion`, 0 ms). The outgoing depth stays opaque beneath the incoming one. The fade starts only once the incoming depth is DRAWN — the Conversation on its first layout, the Analysis when `LivingAnalysisMap` reports its real first state (the Map composed, or a settled projection that cannot be drawn, whose chrome says so) — so a slow mount cannot use up its 200 ms before the first frame. No timer can start the fade earlier: until the Analysis is drawn the Conversation stays visible beneath it, and Back still returns (§7, §10) | `DepthComposition.tsx`, `LivingAnalysisMap.tsx` |
| Android system Back | at the Analysis depth, Back is the same act as «المحادثة» / Conversation: the same boundary, fade and Session, no route pushed or popped. At the Conversation depth nothing is registered, so the platform's own root behaviour is untouched (§10) | `DepthComposition.tsx` |
| Keyboard | the composer and Send — and the T-14 Sign-in form (§10) — stay above the keyboard on both platforms, including Android 15+'s enforced edge-to-edge window, which no longer resizes for the keyboard (§7) | `ConversationSurface.tsx`, `ProductSignInGateway.tsx` |
| Upper chrome | Conversation shows only the Conversation → Analysis control; Analysis gains only the Analysis → Conversation control | both surfaces |

## 4. Technical implementation

### 4.1 API — `GET /conversation/sessions/:sessionId/turns` (E2E-B-04)

Inside the existing Conversation module, under the existing controller-wide `SupabaseAuthGuard`. Ownership is the same
`resumeSession` check every Session route uses (404 when not the caller's). Every row is read with the caller's token
under the existing row-level security (`conversation_turns_select_own`) plus an explicit owner filter; the
service-role channel is never used. Pure read: it never reaches the orchestrator, admission, claim, finalization,
failure, recovery or cancel. **No migration** — the existing `(session_id, created_at, id)` index serves the order.

- Query: `limit` (1–100, default 50) and `before` (a user turn id the caller already holds). Unknown parameters are refused.
- Response: `{ exchanges: [{ userTurn: { id, content, idempotencyKey, createdAt }, replyState, assistantTurn: { id, content, createdAt } | null }], hasOlder }`.
- `replyState` is `COMPLETED` (a COMPLETED assistant turn exists), `FAILED` (the committed turn's frozen terminal state) or
  `PENDING` (still outstanding). CANCELLED turns are not part of the conversation-so-far.
- `idempotencyKey` is the caller's OWN submission identity. It is returned so an ambiguous send can be reconciled by
  reading, without admitting anything. No routing, lifecycle timestamp or server-owned internal is exposed.

### 4.2 Mobile transport (T-12P layer)

`runtime-entry/conversation/conversation-turn-api.ts`: one POST and one GET site, hand-written strict decoders, typed
outcomes (`ANSWERED`, `REFUSED`, `NOT_ISSUED`, `OUTCOME_UNKNOWN` / `PAGE`, `UNAVAILABLE`). It holds no credential and
repeats nothing. `MobileRuntimeEntry.conversationTurnsFor(bundle)` builds it on the AC-01 request-time seam bound to the
bundle's own auth generation, so a refresh is carried and a replaced identity's request is never issued.

### 4.3 Conversation owner layer — `apps/mobile/src/conversation/`

- `conversation-controller.ts` — the presentation owner for one generation and one Session (§3). It is not a store, not
  a second semantic world and not persistence; a committed reply reaches Analysis only through the live driver's
  existing `requestImmediateCatchUp()`.
- `ConversationSurface.tsx`, `AnalysisReturnBar.tsx` — the production surfaces.
- `copy.ts` — §2. `bidi.ts` — the G1.1-A1 majority-script paragraph rule, ported verbatim, plus the speaker sides.
- `visual/` — the generated canonical constants, the Skia glyph, the interaction-state control, fonts and theme.

### 4.4 Integration

The integration owner builds one Conversation controller per runtime generation over `entry.conversationTurnsFor(bundle)`
with the bundle's own Session id, and retires it with the generation. `ProductRoot` still composes exactly one world,
only at READY; `ComposedWorld` now renders `DepthComposition`, whose Analysis depth is the unchanged
`LivingAnalysisMap`. The router stays two files; no route, dispatch, Session or persistence is added.

## 5. Visual implementation

| Authority | Realization |
|---|---|
| P1 Dark default for non-Analysis | the Conversation paints the Dark resolution only (no appearance preference exists yet) |
| Token tree (B4R / C3 / D2R / E1 / F1 / F2 / G1.1 alias) | `apps/mobile/scripts/generate-conversation-visual.mjs` resolves every colour through the canonical G3.2 resolver and writes `canonical-visual.generated.ts` with a sha256 of every source; the contract fails on drift |
| `UTTERANCE` / `FIELD` | `qandeel.role.utterance.fill` for the committed turn; `qandeel.role.field.fill` for the composer; QANDEEL paints no surface |
| G1.1 speaker sides | reader's edge RIGHT in Arabic, LEFT in English, computed physically inside an explicit left-to-right frame so the platform's global direction cannot move a side |
| Paragraph bidi | per paragraph, by majority script, with an invisible RLM / LRM first character so both platforms agree |
| E3 typography | body 17/30, supporting 15/25, action 14/23, metadata 12/20, read from E3's `system.json`; weight carried by the face, never `fontWeight`; no letter-spacing |
| Estedad v8.5 | the release's OWN static `Estedad-Regular.ttf` and `Estedad-Medium.ttf`, byte-identical, sha256-recorded in `apps/mobile/assets/fonts/estedad/SOURCE.json`, OFL 1.1 beside them; loaded at runtime through `expo-font` (now a direct dependency at the version Expo SDK 57 already bundles). No config plugin, no `app.json` change, no native project change |
| P2 geometry | Send (`sig.mjs`, 24 px, stroke 1.6), the depth glyph (N1 open world, 22 px, stroke 1.66) and the curated Hugeicons Free back chevron (MIT, normalised to 1.66) — generated from P2's own functions and drawn by the installed Skia renderer. `react-native-svg` is not adopted |
| E1R / F1R2 | 44 pt minimum targets; pressed presence from `qandeel.state.pressed.*`; focus perimeter from `qandeel.state.focus.*`; increased contrast from the platform setting selects F1's increased resolution |
| Reduced Motion | the depth cut (above); no other motion is added |

## 6. The architecture blocker, and its resolution

The first approval required a reply retry that creates no second user turn. The frozen contract forbids it:
`docs/foreground-generating-turn-recovery-v1.md` makes FAILED terminal ("a genuine retry is a NEW turn / NEW idempotency
admission"; a FAILED turn never gains a late completion; the outbox is `UNIQUE(event_type, subject_turn_id)`), the
committed-conversational-unit substrate says "a continuation is a new turn", `claim_conversation_turn` accepts only
RECEIVED and `finalize_conversation_turn_v2` only GENERATING. Work stopped before any code. The Product Owner and
Technical Lead chose **Option C**: no retry for a confirmed reply failure in W1A-01, no reopened FAILED turn, no
replacement turn, no retry-link migration. Reply retry may be revisited by a later task if Product decides it is needed.

## 7. Verification

Exact-head results are in the Draft PR description.

### 7.1 Visual proof on the production route (VALIDATION ONLY)

`.github/workflows/w1a-01-visual-proof.yml` builds a Release APK whose root component is
`integration/__validation__/W1AProofRoot.tsx`: the PRODUCTION `RuntimePhaseSurface`, `createIntegrationRuntime`,
`DepthComposition`, Conversation and Living Analysis Map, given an in-memory identity and a scripted network in place of
Supabase and the API (no credential exists in the job). The conversation text is fixture text; no model generated it.
Maestro 2.10 (`apps/mobile/.maestro/w1a-01-proof.yaml`) drives it on an Android 16 (API 36) emulator four times:
English; Arabic; Arabic at the largest system text size (200 %); Arabic under Reduced Motion (every animation scale 0).
Each run captures: the Conversation with history (including a FAILED turn), send-ready, waiting (words locked in the
composer), the reply, the unconfirmed send with «إعادة المحاولة» / Try again, the retried send committed once, the
Analysis depth, the return, and a recording of the depth switch.

Defects the proof found, and fixed on this branch:

1. **Composer under the keyboard (Android 15+).** Edge-to-edge is enforced, the window no longer resizes for the
   keyboard, and Send was covered. `KeyboardAvoidingView` now uses `padding` on both platforms (contract-guarded).
2. **The cross-fade could render as a cut.** The switch mounts the incoming depth; on the emulator that mount outlasted
   the 200 ms fade, and the recording went from the Conversation to the Analysis between two frames 70 ms apart. The
   fade now starts on the incoming depth's first layout (`depth.test.tsx` pins it, including turning back mid-fade).

A harness-only fault: at 200 % text the emulator's keyboard once committed a whole message before its input session
was bound, and Android discarded every character (logcat: `Session id mismatch … commitText`). The flow now waits for
the keyboard to settle, and types once more only when Send is absent (`w1a-01-retype.yaml`).

Seen in the proof, outside W1A-01 and unchanged: the Analysis depth is the existing Living Analysis Map, not yet under
the visual foundation, and its T-06 timeline navigator still shows two English sentences in Arabic.

### 7.2 Suites added

- API: `apps/api/src/conversation/conversation-history.spec.ts` — owner scope, pure read, ordering, paging, refused
  queries, exposed fields, the FAILED / PENDING turns, and the route's guard and method.
- Mobile: `runtime-entry/__tests__/conversation-turns.test.ts`, `conversation/__tests__/{controller,surface,bidi}.test.*`,
  `integration/__tests__/{depth,depth-band}.test.tsx` — every rule of §3, the sides, paragraph direction, roles, faces,
  accessible names, exact copy, the production-route send / read / switch, token refresh, sign-out retirement, the
  cross-fade and its Reduced Motion cut.
- Root: `tests/w1a-01-conversation-core-contract.test.mjs`, registered once in Mobile CI.

Re-anchored, with the expired delivery fact stated in place: T14-B8 / T14-B9 (READY now lands in the Conversation; the
unchanged Map is its Analysis depth) and the T-12P public-barrel census (two deliberate additions).

## 8. What W1A-01 deliberately does not do

Sign-up, Name / Login ID, the openers and first use (W1B); the Global Shell, Shared and Public worlds (W1C and later);
Memory through Conversation (W3); Voice Note and Live Call; Replay; cancel (B-05); reply retry after a confirmed
failure (B-06, §6); Activity, the Understanding row and Settings; provider selection; the full I-08B1 world port (W4);
an appearance preference; persisting the depth.

The Phase B known limitations (a PENDING turn left waiting indefinitely, the definitive-refusal copy gap, the unchecked
Sign-in keyboard, Android system Back, and the forward fade) are resolved by the correction pass (§10).

## 9. Backlog (BG-05 / BG-08)

W1A-01 inherits no canonical backlog item (BG-05). `QAN-BL-SEC-01`'s constraint is respected: the Conversation Session
id and every Product truth stay out of auth storage — nothing new is persisted at all. W1A-01 is a Draft
implementation slice and closes no phase, so it records no closure and admits no backlog item; its open residue is
already tracked by the E2E-01 gap matrix rows it names (B-05, B-06) and by §2's reported copy need.

## 10. Correction pass (bounded; before merge-readiness)

The Product Owner reviewed Phase B at `06a866c` and ordered one bounded correction pass for every defect the proof and
the report surfaced. It adds no feature and changes no frozen contract.

| # | Defect | Correction |
|---|---|---|
| 1 | A definitive pre-admission refusal returned the words silently | PO-approved «تعذّر إرسال الرسالة.» / "The message wasn't sent." (§2), visible and announced, words editable, no retry implied (§3) |
| 2 | A committed turn restored as PENDING could wait forever, because the history read is a pure read | bounded same-key re-check after the lease, through the existing canonical recovery path, then an authoritative re-read (§3). No API, migration or state-machine change |
| 3 | Android system Back was not mapped to the depth pair | Back at Analysis returns to the Conversation through the same boundary; at the Conversation it is not taken (§3) |
| 4 | English Product / assistive language inside the Arabic Analysis surface | see §10.1 |
| 5 | The T-14 Sign-in gateway relied on Android resizing the window for the keyboard, which Android 15+'s enforced edge-to-edge no longer does (measured on this branch's proof emulator for the Conversation) | `KeyboardAvoidingView` `padding` on both platforms, like the composer; verified by the focused keyboard proof (§10.2) |
| 6 | Conversation → Analysis still reached the Analysis in one emulator frame: the Analysis depth's first layout is T-11's empty measuring pass, and the Map composes only after it | the fade into Analysis starts only when the Analysis has produced a real renderable state (`LivingAnalysisMap` `onComposed`: the Map composed, or a settled undrawable projection with its chrome). A 1 s fallback that would have started the fade anyway was proposed and REJECTED by the Product Owner, because it could fade into an unrendered surface; there is no timer. Turning back to an Analysis that is not yet drawn waits for it again. Analysis → Conversation and the Reduced Motion cut are unchanged |
| 7 | The Analysis world is still the pre-W4 map | not redesigned here; the full I-08B1 production port remains W4 |

### 10.1 Arabic Analysis language leakage

The audit covered the whole production subtree the Analysis depth renders (`LivingAnalysisMap` → `MapSurface` /
`MapAccessibilityLayer`, `TemporalTargetLayer` / `LiveEdgeTarget` / `TimelinePresentation` / `PresentationNavigator` /
`TemporalNavigator`, `OrientationChrome`). `OrientationChrome` and the Analysis band are already localized; the
temporal, timeline and map-accessibility owners received no language and spoke hard-coded English, including "Live" /
"Go live" (rejected by VI-01 even in English), raw object ids (`Thread w1a-proof-thread-1`) and a raw depth enum
(`disclosed at SOURCE_PROVENANCE`). The Product Owner then approved the complete package below.

**Implementation.** One leaf copy module, `apps/mobile/src/analysis-language/analysis-copy.ts` (no imports), holds every
word; `LivingAnalysisMap` passes the reader's language to `TemporalTargetLayer` (→ `TimelinePresentation`,
`PresentationNavigator`, `TemporalNavigator`, the outboard current-edge control) and to `MapSurface` (→
`MapAccessibilityLayer`). No runtime semantics changed: the same acts, gates, stores and action identities; "live"
remains a runtime term only. Commit / cancel are offered only while a temporary look exists, because their approved
words name its moment. Map objects are described by Product type and placement only — no id of any kind.

**Product Owner supersession (explicit).** For the current-edge state and act, on every surface of this path (visible
text, accessible name, accessible action, the T-08 chrome sentence and the T-07 return control):

| | Superseded | Now |
|---|---|---|
| State | «أنت عند آخر المحادثة» / "Following the conversation as it continues" | «تتابع المحادثة الآن» / "Following the conversation" |
| Act | «العودة إلى المحادثة الجارية» / "Rejoin the conversation" | «العودة لمتابعة المحادثة» / "Rejoin the conversation" |

In T-08's sentence slot the state keeps that slot's full stop («تتابع المحادثة الآن.» / "Following the conversation."),
exactly as the superseded sentence had one; everywhere else it is used as approved, without one.

**Approved package, verbatim.**

| Key | Arabic | English |
|---|---|---|
| Temporal navigation | التنقل الزمني | Temporal navigation |
| Moment number | رقم اللحظة | Moment number |
| No moment available | لا توجد لحظة متاحة بعد. | No moment is available yet. |
| Moment-number hint | أدخل رقمًا من 1 إلى {n}. ستظهر نظرة مؤقتة على اللحظة دون الانتقال إليها. | Enter a number from 1 to {n}. This gives you a temporary look without moving there. |
| Unavailable moment | هذه اللحظة غير متاحة ضمن الخط الزمني الحالي. | This moment isn't available in the current timeline. |
| Preview next moment | نظرة مؤقتة على اللحظة التالية | Preview the next moment |
| Timeline point | اللحظة {n} | Moment {n} |
| Track continues | يوجد المزيد على الخط الزمني. | More is available on the timeline. |
| Timeline view position | موضع العرض على الخط الزمني | Timeline view position |
| View percentage | {n}% من نطاق العرض | {n}% of the view range |
| Everything visible | كل اللحظات المتاحة ظاهرة الآن. | All available moments are visible. |
| Move view | تغيير موضع العرض | Move the timeline view |
| Narrow view | تضييق نطاق العرض | Narrow the view |
| Widen view | توسيع نطاق العرض | Widen the view |
| Map | خريطة تحليل المحادثة | Conversation analysis map |
| Thread / Reading / Emerging focus | خيط / قراءة / تركيز ناشئ | Thread / Reading / Emerging focus |
| Permanent place | في موضعه الثابت | At its permanent place |
| Contexts | عدد السياقات: {n} | Contexts: {n} |
| No map placement | بلا موضع على الخريطة | No place on the map |
| Inspect | معاينة | Inspect |
| Switch context | تغيير السياق | Switch context |
| Go to place | الانتقال إلى هذا الموضع | Go to this place |
| More / less detail | إظهار تفاصيل أكثر / إظهار تفاصيل أقل | Show more detail / Show less detail |
| Explore | استكشاف أعلى / أسفل / يمين / يسار الخريطة | Explore up / down / right / left on the map |
| Command words (accepted in BOTH languages) | البداية، النهاية، التالي، السابق، تضييق، توسيع | first, last, next, previous, refine, widen |

Also used, already approved: P4-C4 «الانتقال إلى اللحظة {n}» / "Go to moment {n}" and «إلغاء النظرة المؤقتة» / "Cancel
the temporary look"; T-08 «أنت عند اللحظة {n}.» / "Reading at moment {n}." and «نظرة مؤقتة على اللحظة {n}، ولم يتغير
موضعك.» / "A temporary look at moment {n}. Your position has not changed."

**Derived, not invented.** The command helper and its error are the approved command words of the reader's language
with `+`, `-` and `0–100%`, joined («البداية، النهاية، التالي، السابق، تضييق، توسيع، +، -، 0–100%»). The adjustable
Timeline's step actions use the approved words «التالي» / «السابق» / «البداية» / «النهاية» and the approved narrow / widen
names. A map object is spoken as its type and placement joined by «،» / "." . The command field and the moment-number
field also read Arabic-Indic digits and «٪».

### 10.2 Focused verification

The four-way matrix of §7.1 is not repeated. `scripts/w1a/run-w1a-correction-proof.sh` runs one standard-motion
recording of the depth boundary in both directions (the door forward, Android system Back returning), and the
production Sign-in gateway with the keyboard open at the default and the largest text size, where the keyboard's
inset frame and the element bounds are measured; and the Arabic Analysis depth, whose on-device accessibility tree is
measured for Latin-script words, internal ids and the approved current-edge wording.

Locally, `integration/__tests__/analysis-language.test.tsx` censuses every visible and assistive string of the
production Analysis depth in both languages; `timeline/__tests__/language.test.tsx` covers the bilingual commands; the
T-06 and T-04 suites carry the Arabic surface. The T-06 contract's T-05 byte pins are re-anchored for the four T-05
files whose words moved, with their store-free authority asserted directly.
