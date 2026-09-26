# P3-A — Authority and Scope

**Status:** `P3-A — VISUAL PROOF / DECISION GATE — P3 NOT CLOSED / NOT FROZEN — NO PRODUCTION RUNTIME`.

## 1. Repository truth (checked 2026-09-26, before any edit)

| | |
|---|---|
| GitHub `main` | `b9e087ba366c9df6843b6b880ff5e790f1fde045` (the merge of PR #274, P2-B; merged 2026-09-26 12:31 UTC) |
| Laptop before the task | branch `docs/p2-final-iconography-canonical-closure` at `cd52632`, clean; 1 ahead / 1 behind `origin/main` only because #274 was squash-merged (the trees are identical: `git diff cd52632 b9e087b` is empty). Nothing was reset or cleaned |
| Branch | `design/p3-notification-activity-integrated-visual-proof`, cut from exact `b9e087b` |
| Scope of change | only `docs/design/p3-notifications/` (checked by C-SCOPE-1) |

## 2. Authorities read

- Orientation: `AGENTS.md`, `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PRODUCT_ROADMAP.md` (P3 is current / next; the roadmap
  forbids reopening I-08N-01's authority, privacy, interruption-class, Direct Entry and disclosure semantics),
  `QANDEEL_PROJECT_MAP.md`, `docs/qandeel-canonical-backlog-v1.md`.
- **I-08N-01, read in full** (`docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md`),
  `CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN`. Its §21 deferrals are exactly what P3 realizes:
  Activity morphology, filters, badge style and numbers vs dots, notification iconography and colours, Lock Screen
  visual form, in-app banners, motion, and (by the Product Owner's decision) the numeric ceilings.
- P1 closure (§8 one General Settings destination, §8.1 placement, §12 Dark / Light / System with the Analysis kept
  dark); P2 closure and the merged P2-A package (N1 geometry, the nav family, Call Rail A, End Call 27 px, Hugeicons
  Free as the curated source, Calm State Morphing); G1.1 and G1.2 closures (the shell, `UTTERANCE`, the call surfaces,
  no persistent call prose, one assistive channel); G3 closure (§C.1 the dark Analysis, §D Matching never interrupts an
  active Live Call); G2.3 (the frozen Matching copy — not redrawn); the vendored C3, B4R, E1R and F1 / F2 token tree.

## 3. Frozen semantics this proof realizes and does not reopen (I-08N-01)

| I-08N-01 | Where the proof realizes it |
|---|---|
| Notification ≠ truth source; ≠ authority expansion; no cross-World movement (§2) | the model decides delivery only; Activity is a projection (D29); C-ACT-4, C-PRIV-5 |
| Direct Entry revalidates at tap; no guessed destination (D38, D39, D43) | `enter()` in app.js; the stale row explains and offers only its own World (board 04) |
| Push is a privilege, not the default (D12) | most outcomes are Activity / in place / strip; board 14 |
| Proactive Gate; eligible reason ≠ trigger (§4, D23) | fixtures state the Gate's verdict (`usefulAtEnd`, `newContext`); the model never creates a candidate |
| Budget is a ceiling, not a quota; one global budget + category sub-budgets (D07, D08) | `CEILINGS` + `budgetVerdict`; C-FREQ-8 |
| Coalescing constraints (D09) | `coalesceKey` always contains category + exact context; C-ACT-4m, C-QUIET-4 |
| Classes 1–4 describe interruption value, not category (D10) | fixtures carry `cls`; the Product class is never mapped to an OS level (board 14) |
| L0–L3, the D15 matrix, explicit per-category permission, preference = ceiling (D14–D17) | `DISCLOSURE_DEFAULTS`, `project()`, settings rows; C-PRIV-1…4 |
| Bounded safe projection; no preview combines Worlds (§10) | `project()` receives ONE event |
| QANDEEL Voice vs Product / System voice (D18) | `SPEAKER`; copy table statuses |
| No manipulative copy (D20) | copy table; no counts, streaks or countdowns anywhere |
| One Activity surface, semantic separation, seen/read = attention only (D28–D31) | Activity + filters; `markSeen` / `markOpened` never touch `resolved` (C-ACT-6) |
| Product-meaning controls; per-World mute; Proactive off ≠ understanding off (D33–D35) | settings; C-FG-1 S9, S14 |
| Critical exception does not bypass the OS (D36) | S15; the settings statement |
| Quiet Hours / Snooze affect interruption only (D37) | deferred, never deleted; board 12 |
| Badges = attention state; global derived, not summed; count visibility = disclosure (D44–D48) | `indicators()`; C-MARK-3m/4m |
| OS permission is a hard Push boundary; no repeated pressure (D50) | S6, S15; C-PERM-3 |
| Foreground suppression (D51) | S1–S4; C-STRIP-1 |
| Retry revalidates; no retry past semantic expiry (D54, D55, D59) | the overnight Q3 goes stale at 08:00 |
| No psychological inference from silence (D05) | the same-thread rule only counts time and engagement |

## 4. What this proof adds, and only this

- the Product Owner's **accepted P3 direction** (task §5–§15) made visible: Activity «النشاط» / Activity, its entry,
  the Attention Mark, the Attention Strip, the settings, the permission education, the Lock Screen words, Quiet Hours
  and Snooze, the ceilings;
- **bounded craft** where the direction needed a drawing (listed as open questions in the report): the Activity entry
  glyph (two variants, one recommended), the Introductions source mark, the hollow WAITING mark, the L1 human label,
  the Proactive "Reduce" interpretation, and the placement of the entry.

## 5. Explicit non-scope (kept)

No production React Native, no APNs / FCM, no database schema, no workers, no device tokens, no native channels or
categories, no dependency, no P3 closure, no P4, no change to I-08N-01, P1, P2, the locators, the backlog or any
canonical artifact. The Analysis is not repainted or redesigned, and the Call Rail is untouched (it is the P2 file,
byte-exact).

## 6. Governance note

This is a proof, not a closing change: BG-08 / BG-09 do not apply to it, and it proposes no backlog item. Candidates a
later P3-B closure will have to disposition are listed in the report (§Open craft questions) and in
P3_IMPLEMENTATION_FEASIBILITY.md; none is admitted here.
