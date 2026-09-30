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
