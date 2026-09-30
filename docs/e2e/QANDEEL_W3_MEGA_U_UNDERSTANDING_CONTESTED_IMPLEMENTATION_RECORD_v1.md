# QANDEEL — W3-MEGA-U QANDEEL Understanding + User Disagreement / Contested — Implementation Record v1

**Task:** W3-MEGA-U — «فهم قنديل» / QANDEEL Understanding + User Disagreement / Contested Runtime (E2E-01 wave W3)
**Rows:** `E2E-D-14` (open QANDEEL Understanding) and `E2E-D-15` (disagree → Contested / Under Review)
**Baseline:** `92444c3ab8c35f7d819888be76aa6395c93d94b8` (merge of PR #288, W3-02)
**Stack:** three stacked Draft PRs — U1 projection → U2 surface → U3 contested runtime (§0)
**Status:** IMPLEMENTED ON STACKED DRAFT PRs — NOT MERGED. One Product-Owner-authorized Production Integration task; it
opens no other wave or Product area, closes no phase, and does not close W3.

---

## 0. Stack

| Gate | Branch | Base | Scope |
|---|---|---|---|
| U0 + U1 | `feat/w3-mega-u1-understanding-projection` | `main` | locator reconciliation; the owner-only Understanding projection and its two read routes |
| U2 | `feat/w3-mega-u2-understanding-surface` | U1 | the Personal-QANDEEL U-A entry, the Understanding surface, "talk to QANDEEL about this" |
| U3 | `feat/w3-mega-u3-contested-runtime` | U2 | explicit disagreement, durable Contested / Under Review state, real re-evaluation, reliance |

The exact PR numbers and heads are recorded in each PR and in the final hand-off; a record cannot name its own head.

## 1. U0 — repository truth and post-W3-02 reconciliation

- `origin/main` was exactly `92444c3ab8c35f7d819888be76aa6395c93d94b8`; PR #288 (W3-02) is MERGED with that merge commit
  (`2026-09-29T22:54:21Z`, head `f4cf201`). The tree was clean.
- Reconciled in its own commit: the Current State, the Project Map, `E2E01_READ_FIRST.md` §6 and the W3-02 record now say
  W3-02 is MERGED / CLOSED through PR #288; `E2E-D-09` is CLOSED; `E2E-D-02` is advanced only; **W3 is ACTIVE** with
  `E2E-D-03`, `D-05`, `D-13`, `D-14`, `D-15` open. The W3-02 contract's record-status predicate was re-anchored to the
  merged truth; its permanent claims are unchanged. No historical census, matrix or wave baseline was rewritten.
- **BG-05.** The backlog was read in full. No item names an Understanding, P1 or W3 task as its Owner task, so the task
  inherits none. `QAN-BL-CTX-01` (conversational relevance) is adjacent and untouched: this task claims no relevance
  signal; the first view orders by recency of change only (§2.4).

## 2. U1 — QANDEEL Understanding Projection Authority

### 2.1 Architecture

A new `apps/api/src/understanding/` module (`UnderstandingModule`), composed by the application root beside
`AccountModule`. It imports `MemoryModule` and `HypothesisModule` and consumes only their exported services; it adds
nothing to the Conversation module, calls no provider and writes nothing. U1 needs **no migration**: every source table is
already owner-SELECT-only under RLS and is read with the caller's own token.

| Source (canonical) | Used for |
|---|---|
| `HypothesisService.listActiveForUser` (≤ 32, `updated_at DESC, id ASC`) | the current items and their order |
| `EvidenceService.listEligibleForUser` | the reader's own currently eligible supporting / contradicting context |
| `ConfidenceRepository.listExactVersionsForTargets` | the exact-current-version structural record (never an older one) |
| `hypothesis_updates`, `hypothesis_lifecycle_transitions` (owner RLS) | evolution |

### 2.2 The Product view model

```
GET /understanding/items?limit=N   → { items: [{ ref, revision, theme, summary, confidence, underReview }] }
GET /understanding/items/:ref      → { ref, revision, theme, summary, confidence, underReview,
                                        evidence[], contradictions[], alternatives[], unresolved[], evolution[{kind, at}] }
```

(`underReview` — the one boolean U3 adds for P1 §11.4's Contested / Under Review state; the U1 contract pins the shape.)

- **`ref`** — opaque, one-way (domain-separated SHA-256 of reader + item, 22 base64url characters), stable across versions.
  It resolves only against the caller's own current items; a malformed ref, another reader's ref and a withdrawn item's
  ref all answer the same 404.
- **`revision`** — opaque token for the exact interpretation version the reader saw (U3 binds disagreement to it).
- **`theme`** — the human-readable title family, derived deterministically from the canonical Hypothesis domain:
  `GENERAL→YOU`, `RELATIONSHIP→RELATIONSHIPS`, `WORK→WORK`, `DECISION→DECISIONS`, `GOAL→GOALS`, `INTERACTION→HOW_WE_TALK`.
  It is a label on an item that exists, never an empty category tab. The words are U2's copy.
- **`summary`** — the canonical Hypothesis statement: already bounded, provider-validated at generation, free of
  identifiers. The internal `scope` is **never** exposed (it is `KIND:<sessionId>`), nor the type, origin, status,
  version or disconfirming conditions. No provider rewrite is added: the deterministic projection is adequate, needs no
  cache or authority, and cannot add a claim.
- **Detail:** `evidence` / `contradictions` are the statements of the reader's own currently eligible linked context
  (user-stated or user-confirmed Memory, ≤ 8 each); `alternatives` are the statements of competing items that are
  themselves current (≤ 4); `unresolved` are the item's unverified assumptions (≤ 8); `evolution` is newest-first (≤ 16):
  `FIRST_SEEN`, `SUPPORT_ADDED`, `CHALLENGE_ADDED`, `STRENGTHENED`, `WEAKENED`, `BECAME_MIXED`, `WITHDRAWN`,
  `RECONSIDERED`. The generation-time `CANDIDATE → ACTIVE` admission is not a separate entry.
- **No "why" paragraph is generated.** The runtime stores no rationale by design (Hypothesis Runtime Foundation), and a
  generated one would be reasoning text. The supporting context *is* the user-facing "why"; absence is shown by omission.
- **Which items are current.** `ACTIVE`, `SUPPORTED`, `MIXED`, `WEAK`. `CANDIDATE` is a transient pre-admission state,
  `REOPENED` is a withdrawn interpretation being reconsidered, `REJECTED` / `RETIRED` are withdrawn.

### 2.3 Confidence — the exact mapping and why it invents no calibration

The Confidence Runtime is uncalibrated: `numeric_score = null`, `confidence_band = null`, database-constrained. The
projection has **no input** through which a score, band, weight, Evidence count-as-strength or Memory extraction
confidence could arrive. Ordered, first match wins:

| # | Canonical structural fact | Product state (copy key) |
|---|---|---|
| 1 | an unresolved explicit disagreement by the reader (U3) | `MIXED` (`confMixed`) |
| 2 | lifecycle state `MIXED` | `MIXED` |
| 3 | currently eligible supporting **and** contradicting context both present | `MIXED` |
| 4 | no Confidence record for the **exact current** version | `NEEDS_MORE` (`confMore`) |
| 5 | lifecycle state `WEAK` | `NEEDS_MORE` |
| 6 | no currently eligible supporting context, or `NO_ELIGIBLE_EVIDENCE` | `NEEDS_MORE` |
| 7 | `SUPPORTED`, nothing contradicting, and the exact-version record names no gap but the always-present `CONFIDENCE_MODEL_UNCALIBRATED` | `CLEAR` (`confClear`) |
| 8 | `ACTIVE` or `SUPPORTED` with some support | `TAKING_SHAPE` (`confForming`) |
| 9 | anything else | `NEEDS_MORE` |

`CLEAR` is the only state needing positive grounds, and they are all canonical structure: `SUPPORTED` is an explicit
lifecycle state no automatic rule sets (migration 0036), and the rest is the absence of every structural gap the runtime
can name (no unverified assumption, no unassessed alternative, no contradiction). It claims no probability, truth or
calibration. `ACTIVE` — the state every generated item starts in — is never `CLEAR`. No fifth state exists.

### 2.4 Order, bounds, empty state

The first view is the repository order `updated_at DESC, id ASC` — most recently changed first — bounded to 32 (`limit`
1–32; any other query key, including any user id, is a 400). It is recency only: no importance score, no relevance
signal (`QAN-BL-CTX-01` stays unclaimed) and nothing is shown as a rank. With no current item the answer is
`{ items: [] }` and no further read happens; nothing is manufactured.

### 2.5 Security and privacy

- Guarded at the class (`SupabaseAuthGuard`); identity comes only from the verified token; no route takes a user id.
- Every read is the caller's own token under RLS **and** filtered by the caller's id; every Hypothesis and Confidence row
  is re-checked for ownership and a mismatch fails closed. No service-role channel.
- **Outbound audit:** each response is checked against the exact Product shape before it leaves (exact keys, enums,
  bounded texts, one-way tokens, no number anywhere). A widened upstream object, a numeric field, a raw identifier or an
  added reasoning field fails closed as one sanitized 503.
- A malformed canonical row (including a non-null score or band, or a stale-version record in an exact-version answer)
  fails closed. No log line carries item text (the module logs nothing).

### 2.6 U1 verification

- `apps/api/src/understanding/understanding-projection.spec.ts` and `understanding.service.spec.ts` — **48 / 48** locally:
  the full confidence table, the tokens, 21 planted outbound defects, owner-only reads, the honest empty state, current
  items only, no stale-version substitution, refusal of an upstream score / band, cross-user fail-closed, query bounds and
  refusal of a client user id, the 404 non-oracle, the detail's exact shape, and the sanitized 503.
- `tests/w3-mega-u1-understanding-projection-contract.test.mjs` — **25 / 25**: twelve detectors that pass on the shipped
  source, each proven by planted defects (21) — numeric confidence exposure, raw Hypothesis object / status, raw internal
  id, hidden chain-of-thought field, a provider-written explanation, cross-user read (owner check removed; service role),
  client-supplied user id, unknown query keys, Memory extraction confidence shown as truth confidence, HIM exposure, empty
  taxonomy tabs, stale-version substitution, Confidence history instead of exact version, an invented default for an
  unknown / uncalibrated state, an optimistic fall-through, a second path to Clear, a widened outbound shape.
- Narrow re-anchors (validation, not Product): the three contracts that byte-pin `app.module.ts` strip the one
  `UnderstandingModule` composition exactly as they already strip `AccountModule`; the W1B-01 composition regex admits
  it. Every other byte stays pinned.
- `tsc -p apps/api` clean; all 34 static contracts API CI runs pass locally.

## 3. U2 — QANDEEL Understanding Product surface

### 3.1 Entry and navigation (P4-C1 U-A, P1 §11)

- **One persistent word on Personal QANDEEL's own row**, beneath the upper chrome, at the reader's **start** edge, with the
  General Settings entry keeping the end edge (the row is `row-reverse` in Arabic so the screen reader reaches the
  Understanding entry first in both languages). No glyph is frozen for it (P1 §16.1), so it is its frozen name. It is
  never in the upper chrome, never in the Analysis, never inside Settings.
- The Conversation layer only gained two neutral slot props, `personalEntry` and `discussion`. It draws and words none of
  it, so the W1A-01 scope ban and the W3-01 row pins hold unchanged.
- **A depth, not a route.** Like General Settings, the surface is shown OVER the Conversation, which stays mounted, out of
  reach of touch and assistive technology. Opening it dispatches nothing, pushes no route, creates no Session and
  persists nothing. Back (the control) and Android Back leave an open item first, then Understanding, and return to the
  exact Personal state — same runtime, generation, Conversation controller, draft. With it closed, Back is the
  platform's again. It is reachable only from the Conversation depth.
- One `UnderstandingController` per runtime generation (built in `integration-runtime.ts` over
  `entry.understandingFor(bundle)` on the AC-01 seam bound to the bundle's auth generation), retired with it.

### 3.2 First view and detail

- First view: title (theme), current summary, confidence **in words** (`الثقة: {state}` / `Confidence: {state}`), one
  screen-reader stop per item in reading order. No percentage, number, score, rank or diagnostic label.
- Detail: the summary and confidence, then only the parts that exist: «الأدلة» / Evidence, «التناقضات» / Contradictions,
  «البدائل» / Alternatives, «نقاط غير محسومة» / Unresolved points, «تطور التحليل» / Analysis evolution. An empty part is
  omitted; nothing is filled in. Evolution is the ordered, newest-first sequence **without dates**: the T-12 locale
  authority records that nothing in v1 formats a date and pins no calendar, and choosing one is not this task's.
- Honest states: nothing yet → one sentence; an unreadable answer → one sentence plus «إعادة المحاولة» / Try again,
  asked only when the reader asks; an item no longer current → back to the refreshed list.
- Accessibility: logical `direction` frame (RTL Arabic / LTR English); every control ≥ 44 × 44; headings are `header`;
  no fixed widths or line clamps on reading text (320 pt and dynamic type reflow); no motion added; the canonical
  palette in the reader's effective non-Analysis appearance (the Analysis stays dark and is untouched); Estedad v8.5
  through the existing type roles; state is always in words, never colour alone.

### 3.3 "Talk to QANDEEL about this" (P1 §11.4) — the context seam

- In the detail, one control. It is bound to the **exact revision shown**: `POST /understanding/items/:ref/discussion`
  with `{ revision }` only. 204 → the reader is back in the SAME Conversation with one quiet context line above the
  composer («الحديث عن: {title}» + the summary) and a way to end it. 409 (the item changed) → nothing is recorded, the
  item is read again and the reader sees the current interpretation before choosing again. Failure → one sentence, and
  it can be asked again. **Nothing is typed into the composer and no turn is sent**: the reader says what they want.
- Server: migration `0126` (`database/README.md`) holds ONE owner-only discussion focus per reader (private DEFINER /
  public INVOKER, exact version under `FOR SHARE`, bounded `OPENED` / `STALE` / `NOT_FOUND`, a close that only closes the
  named item). The provider-facing `HypothesisReasoningContextService` reads it with the caller's token and, while it is
  open and at most `DISCUSSION_FOCUS_WINDOW_MS` (30 minutes) old, marks that one item
  `userDiscussion: 'OPENED_FROM_UNDERSTANDING'` and offers it first. It is the reader's own explicit act, not a
  relevance ranking (`QAN-BL-CTX-01` stays unclaimed). The central hypothesis guidance gains one sentence: the item
  stays provisional, the user leads, and their view is heard rather than argued down. A failed focus read fails the
  whole Hypothesis context (it is then omitted), never consumed without it. The Conversation orchestrator, the
  gatherer and the turn contract are unchanged.
- The strip's end control closes the focus once; if that request is lost, the bounded window lets it lapse.

### 3.4 Copy

Frozen / approved, reused verbatim: `understanding`, `confClear`, `confForming`, `confMixed`, `confMore`, `confName`,
the I-08A4 §9 detail names, `p3.back`, VI-01 «إعادة المحاولة» / Try again.

**TASK-APPROVED DELEGATED COPY** (W3-MEGA-U §7.6; QANDEEL's formal T1 register, plain, non-diagnostic, no new concept):

| Key | Arabic | English |
|---|---|---|
| theme `YOU` | عنك | About you |
| theme `RELATIONSHIPS` | علاقاتك | Your relationships |
| theme `WORK` | عملك | Your work |
| theme `DECISIONS` | قراراتك | Your decisions |
| theme `GOALS` | أهدافك | Your goals |
| theme `HOW_WE_TALK` | طريقة حديثنا | How we talk |
| empty | لم يتكوّن لدى قنديل فهمٌ يعرضه بعد. | QANDEEL hasn't formed an understanding to show yet. |
| unavailable | تعذّر عرض فهم قنديل. | QANDEEL Understanding couldn't be shown. |
| talk | الحديث مع قنديل عن هذا | Talk to QANDEEL about this |
| talk failed | تعذّر نقل هذا إلى المحادثة. | This couldn't be brought into the conversation. |
| strip | الحديث عن: {title} | Talking about: {title} |
| end strip | إنهاء الحديث عن هذا | Stop talking about this |
| `FIRST_SEEN` | بدأ قنديل يرى الأمر هكذا | QANDEEL began to see it this way |
| `SUPPORT_ADDED` | أضاف كلامك ما يدعمه | Something you said supported it |
| `CHALLENGE_ADDED` | أضاف كلامك ما يعارضه | Something you said challenged it |
| `STRENGTHENED` | ازداد وضوحًا | It grew clearer |
| `WEAKENED` | ضعُف | It grew weaker |
| `BECAME_MIXED` | ظهر فيه تعارض | It became mixed |
| `WITHDRAWN` | تركه قنديل جانبًا | QANDEEL set it aside |
| `RECONSIDERED` | أعاد قنديل النظر فيه | QANDEEL reconsidered it |

The Arabic avoids gendered imperatives (a verbal noun for the talk control) and the confession framing («لم نتمكّن»);
«تعذّر» frames a failure as the process's.

### 3.5 U2 verification

- Mobile Jest: `understanding/__tests__/understanding-surface.test.tsx` and `understanding-api.test.ts` (35, Arabic and
  English: first view words, exact confidence words, no numerals / % / score, 44 × 44, reflow, honest empty and
  unavailable, detail omission, Back order, talk bound to revision, changed-item re-read, failure and retry, strict
  decoding with 9 planted payload defects, no identity sent) and `integration/__tests__/w3-mega-u-understanding.test.tsx`
  (5, the production phase surface: entry placement and reading order, same runtime / Session / draft, Android Back
  chain, talk returns to the same Conversation with the context line and sends no turn, absent from Analysis and
  Settings). The runtime-entry barrel test is re-anchored for the one new transport class.
- API Jest: discussion open / stale / cross-user / withdrawn / widened body / close; reasoning-context marking, window,
  malformed row and fail-closed read.
- `database/verify-migration-0126.mjs` (real PostgreSQL, API CI); hazard scan 0 findings; all 1257 static database
  contracts pass locally.
- `tests/w3-mega-u2-understanding-surface-contract.test.mjs`: seven detectors, fifteen planted defects.
- Validation re-anchors: the W3-02 contract's "0125 is the last migration" is now "0125 directly follows 0124"; the U1
  contract counts one token identity per route.

## 4. U3 — User Disagreement → Contested / Under Review, with real re-evaluation (`PG-01`)

### 4.1 The trigger — explicit, bound, never inferred

- The ONE act is «أراه بشكل مختلف» / "I see it differently" on the Conversation's discussion line, i.e. only after the
  reader chose "talk to QANDEEL about this" for that item. It is an intentional control, bound to that item's exact
  revision and to one command identity. Nothing in the Conversation turn path (API or mobile) reads what the reader
  types for a disagreement — the U3 contract proves the whole path free of it (no keyword interception).
- The request is `POST /understanding/items/:ref/disagreement` with exactly `{ commandId, revision }`. **No words the
  reader typed are sent or stored**; the Conversation simply continues, and whatever they say next is an ordinary turn.

### 4.2 Persistence — migration `0127`

`public.understanding_contests`: owner, item (composite FK to the reader's own Hypothesis), command identity
(`UNIQUE (user_id, command_id)`), the EXACT contested version, lifecycle, the re-evaluation's before / after status and
after version, and the instant. No text, reasoning, score or payload column. At most ONE contest under review per item
(partial unique index). RLS owner SELECT only; no client write; the command is DEFINER in `understanding_private` with a
`public` INVOKER pass-through; the owner is `auth.uid()` only.

Contest lifecycle v1 is exactly `UNDER_REVIEW`. No Product authority defines what resolves a contest beyond the
re-evaluation, so it **stays under review** rather than pretending to be resolved; no manual "resolved" control exists,
and a provider restating the interpretation cannot clear it.

### 4.3 Stale, concurrency, idempotency

- The command locks the item `FOR UPDATE` first, then: same command replayed → `RECORDED` with the committed truth
  (nothing repeated); a command id spent elsewhere → `COMMAND_CONFLICT`; not one of the caller's current items →
  `NOT_FOUND`; a contest already under review → `ALREADY_UNDER_REVIEW`; a version other than the one seen → `STALE`.
  Every non-recording answer writes nothing.
- The API maps the revision the reader saw to the current version, or the one just before it (their own disagreement
  may already have moved it); anything else is `409 UNDERSTANDING_ITEM_CHANGED` unless the item is already under review.
- Mobile: a lost answer is retried as the SAME command (recorded at most once); `CHANGED` re-reads the item, shows the
  current interpretation and records nothing — the reader decides again; `CONFLICT` mints a new command next time.
- Real PostgreSQL (`database/verify-migration-0127.mjs`): two different commands racing on one item → exactly one
  `RECORDED`, one `ALREADY_UNDER_REVIEW`, one contest, one version step; the same command twice → one contest; one command id on two items at once → one `RECORDED`, one `COMMAND_CONFLICT` whose `MIXED` step is undone (R1).

### 4.4 Re-evaluation — real, through existing machinery

1. **Lifecycle** (same transaction as the contest): a current `ACTIVE` / `SUPPORTED` / `WEAK` interpretation becomes
   `MIXED` through the ONE audited lifecycle core (`transition_hypothesis_core_v1`, migration 0036) at the exact
   version — a new version and an `AUTHENTICATED_TRANSITION` audit row; 0072 captures it historically. One already
   `MIXED` keeps its version. Authority: P1 §11.4 ("makes the item contested / under review and causes re-evaluation")
   and the P4-C3R ruling that one label, `MIXED`, covers mixed evidence and an explicit disagreement; the transition is
   one the frozen graph already allows. Nothing else of the Hypothesis changes: statement, Evidence, assumptions and
   alternatives are untouched, it is never deleted, rejected or retired, and history is not rewritten.
2. **Confidence**: the Confidence Runtime's own `evaluateHypothesisVersion` at the returned `reevaluated_version` —
   never a later one; at most once per version. It is a fresh structural snapshot of the new `MIXED` version from the
   same canonical inputs; the contest itself is not a Confidence input (the Confidence Runtime has none for it, and none
   is invented). A failure changes nothing relied on: the item is `MIXED` and under review regardless (projection rule
   1), and a missing exact-version record is `NOT_EVALUATED_FOR_CURRENT_VERSION`, never an older one; a later
   disagreement request on the item (replay, or another command answering `ALREADY_UNDER_REVIEW`) repairs it.
3. **Reliance** (below). No supporting Evidence is manufactured and no user text becomes Evidence.

The result of this re-evaluation is "remains contested / under review" (P1 §11.5 "become contested"). Later canonical
lifecycle moves (weaken, change, withdraw, support) stay with their existing lawful authorities.

### 4.5 Contested affects reliance, not merely UI

- **Product projection:** a contest under review forces `MIXED` (rule 1 of §2.3) and `underReview: true`; the outbound
  audit refuses any item under review that is not `MIXED`. The detail shows «أخذ قنديل برأيك، وهذا الفهم قيد المراجعة.» and
  the evolution «سُجّل رأيك المختلف» (the re-evaluation's own `MIXED` step is folded into it, not told twice); the list row
  says «قيد المراجعة» / Under review in words.
- **Provider-facing:** `HypothesisReasoningContextService` reads the reader's contests (owner RLS, caller token) and marks
  each item `userContest: 'UNDER_REVIEW'`; its lifecycle state is `MIXED` too. The central guidance adds: it is
  contested and under review, so do not rely on it, do not present it as QANDEEL's current understanding of the user,
  and do not treat the disagreement as proof either way. A failed contest read fails the whole Hypothesis context (it is
  omitted), so a contested item is never consumed as uncontested. Provider-neutral: the guidance is the central
  composition both adapters consume; no provider-specific logic, no numeric penalty.

### 4.6 User-visible behaviour

The line says «سُجّل رأيك، وصار هذا الفهم قيد المراجعة.» and the act disappears; the context stays; the draft is the
reader's; nothing is sent for them. Reopening Understanding always opens on the freshly read first view (a proof-found
defect fixed in U3: it had reopened on an explanation read before the disagreement). The state is server-truth, so it
survives a restart (integration-proven with a fresh runtime).

### 4.7 U3 copy (TASK-APPROVED DELEGATED COPY, same register)

| Key | Arabic | English |
|---|---|---|
| disagree | أراه بشكل مختلف | I see it differently |
| recorded | سُجّل رأيك، وصار هذا الفهم قيد المراجعة. | Your view is noted. This understanding is now under review. |
| failed | تعذّر تسجيل رأيك. | Your view couldn't be recorded. |
| under review | قيد المراجعة | Under review |
| detail note | أخذ قنديل برأيك، وهذا الفهم قيد المراجعة. | QANDEEL took your view into account. This understanding is under review. |
| `YOU_DISAGREED` | سُجّل رأيك المختلف | Your different view was noted |

«قيد المراجعة» / Under review names P1 §11.4's own concept ("contested / under review"); the Arabic uses passive or
first-person-free forms so nothing is gendered.

### 4.8 U3 verification

- API Jest: disagreement recorded / replay (version before) / Confidence once / Confidence failure / stale ×2 /
  already under review ×2 / cross-user / spent command / six widened bodies (a message included) / contested projection
  (Mixed, under review, not deleted, evolution); reasoning context marks `UNDER_REVIEW` and fails closed on a failed read;
  outbound audit refuses under-review-not-Mixed and a missing flag.
- Mobile Jest: the act, bound to revision, UUID command, recorded words; lost answer → SAME command; changed → re-read,
  nothing recorded, new command; under-review words in list and detail; transport sends exactly `{ commandId, revision }`
  and types every answer; production-surface integration: disagreement from the Conversation line with the bearer,
  no words sent, no turn sent, draft kept, list shows Mixed + under review, and again after a restart.
- `database/verify-migration-0127.mjs` (real PostgreSQL, API CI and the focused gate): catalog, grants, every outcome,
  the audited transition, no deletion, isolation, committed two-connection races proven to block.
- `tests/w3-mega-u3-contested-runtime-contract.test.mjs`: seven detectors, twenty-one planted defects (a capped contest window, DEFINER exposed, client
  write grant, caller-supplied owner, message stored, words sent, cosmetic re-evaluation, unaudited status write, no
  Confidence, Confidence at a later version, objection applied to a newer interpretation, two contests, a retry as a new
  command, deletion, rejection, auto-resolution, a decorative badge, the provider never told, guidance that keeps
  relying, keyword interception, a non-explicit act).

### 4.9 U3 R1 — independent adversarial self-review of the whole stack

An independent review agent reviewed `92444c3..3fc14e0` against §14 of the task. Findings and dispositions:

| # | Severity | Finding | Class | Disposition |
|---|---|---|---|---|
| 1 | HIGH | the 0126 verifier counted every `understanding_private` function, so with 0127 applied (API CI applies all migrations first) it would fail | validation | fixed: both catalog queries scoped to the discussion functions |
| 2 | MEDIUM | contest reads were capped at 64 and unfiltered; contests never lapse, so an old contest on a still-current item could drop out and be projected / sent to the provider as uncontested | Product (reliance) | fixed: both reads bound to the exact current item ids |
| 3 | MEDIUM | "QANDEEL will reconsider" promised a runtime step; the Confidence claim overstated its repair | Product copy / record accuracy | fixed: the copy now says the understanding is now under review; §4.4 corrected; a repair on `ALREADY_UNDER_REVIEW` added |
| 4 | LOW | a replay could hand the client an older revision | Product | fixed: the answer is the current interpretation's revision |
| 5 | LOW | the same command id used at the same instant for two items surfaced a unique violation as 503 | Product | fixed: the lifecycle step and the contest insert are one exception block; the violation undoes both and answers `COMMAND_CONFLICT` |
| 6 | LOW | `ALREADY_UNDER_REVIEW` precedes `STALE`: a reader holding an older revision of an item already under review is told it is under review | Product | kept deliberately: the item IS under review by the same reader's earlier explicit act; nothing is recorded for the older revision; the copy states only that it is under review |
| 7 | LOW | the 0127 verifier's cleanup could mask the original error after an aborted transaction | validation | fixed: `ROLLBACK` first |

Recorded, not changed (concerns the review did not confirm as defects): Recommendation grounding counts contested items
toward its coverage (the central guidance already forbids relying on them); `unresolved` shows the Hypothesis's
explicit `assumptions` metadata (the Hypothesis Runtime defines them as "explicit metadata, not hidden reasoning", which
is P1 §11.2's "unresolved points"); Evidence eligibility can change without the revision changing (the interpretation
itself stays bound).

## 5. Lifecycle truth and row accounting

- **`E2E-D-14` — IMPLEMENTED on the stacked Draft PRs (U1 + U2); closes on merge of the stack.** Not closed now.
- **`E2E-D-15` — IMPLEMENTED on the stacked Draft PRs (U3, over U1 + U2); closes on merge of the stack.** Not closed now.
- **`PG-01`** (I-08A4 §18) — implemented by U3 as recorded above; it stops being a gap only when the stack merges. The
  I-08A4 register text is historical and is not edited.
- **`PG-02` — Personal Evidence Invalidation → Derived Understanding Propagation — remains NOT IMPLEMENTED.** Narrowly, the
  projection already counts only CURRENTLY eligible Evidence (a withdrawn Memory stops supporting an item at once); no
  propagation into the Hypothesis lifecycle exists, and that is not claimed.
- **`PG-04` — Selective Understanding Sharing — remains NOT IMPLEMENTED.** Nothing here reaches Shared, Public or
  Introductions.
- **W3 remains ACTIVE.** `E2E-D-03`, `D-05` and `D-13` stay open; `E2E-D-02` stays advanced only; the Account & Identity
  residues stay separate.

## 6. Residues (owned by the End-to-End audit / Production Integration, BG-06: none is a new backlog item)

1. Evolution shows no dates: the T-12 locale authority formats no date and pins no calendar.
2. Summaries are the canonical statement text in whatever language generation produced; no rewrite into the reader's
   Product language exists.
3. Contest resolution beyond the immediate re-evaluation is undefined by Product authority, so a contest stays under
   review — including when an item is later withdrawn and reopened, where it is still shown as under review and a
   second objection answers `ALREADY_UNDER_REVIEW`.
4. The discussion focus lapses after 30 minutes if its close request is lost.
5. No device / raster proof campaign was run for this surface (validation proportional: React UI states, 320 / text-scale
   structure and accessibility semantics are unit- and integration-proven; the Mobile CI boot smoke runs where native
   impact is classified).

No backlog item is inherited or admitted: this task closes no phase and no `CLOSED / FROZEN` task (BG-08 runs at a
closure); each residue is owned by the End-to-End audit or Production Integration.
