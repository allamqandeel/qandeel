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
GET /understanding/items?limit=N   → { items: [{ ref, revision, theme, summary, confidence }] }
GET /understanding/items/:ref      → { ref, revision, theme, summary, confidence,
                                        evidence[], contradictions[], alternatives[], unresolved[], evolution[{kind, at}] }
```

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
  open, at most `DISCUSSION_FOCUS_WINDOW_MS` (30 minutes) old, and (R2, §3.6) the item is still at the **exact version
  the reader chose**, marks that one item `userDiscussion: 'OPENED_FROM_UNDERSTANDING'` and offers it first. It is the reader's own explicit act, not a
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

### 3.6 R2-A — the discussion focus is consumed at its exact revision

Independent review found that migration `0126` stored the exact `hypothesis_version` the reader chose, but the
provider-side read selected only `hypothesis_id, opened_at`, and the resolver matched the id alone. If the item advanced
after the reader chose it (v3 → v4), the provider would have received v4 — an interpretation the reader never saw —
marked `OPENED_FROM_UNDERSTANDING`. The U2 text above claimed "that one item" without saying which revision.

Corrected on this PR (no migration, no copy, no UI change):

- `HypothesisUserSignalRepository.readOpenDiscussionFocus` selects `hypothesis_id,hypothesis_version,opened_at`, and
  `HypothesisDiscussionFocusRow` carries `hypothesis_version`.
- `HypothesisReasoningContextService` refuses (invariant error, whole context omitted) a focus row whose version is not a
  positive safe integer, and marks an item only when `id === focus.hypothesis_id && version === focus.hypothesis_version`.
  An advanced (or lower) version marks nothing; the focus is never moved to the new version, never rewritten, and no
  replacement is inferred. The stored row simply stays until the reader closes it, chooses again, or the window lapses.
- Proof: API Jest (same revision marked; v3 focus + current v4 unmarked; lower version unmarked; another item never
  marked; five malformed versions fail closed; window and fail-closed read unchanged). `verify-migration-0126.mjs` now
  also proves the stored version is the one the command accepted, that an audited lifecycle advance leaves it
  unchanged, that the old revision can no longer be opened, and that only a new explicit open names the new version.
  The U2 contract gains an `exactRevisionFocusViolations` detector with four planted defects (reader omits the version;
  id-only match; `>=` rebinding; version check removed) and is now also run by API CI, since its new guard reads API
  source. The Mobile surface, transport and tests are unchanged and still pass.
