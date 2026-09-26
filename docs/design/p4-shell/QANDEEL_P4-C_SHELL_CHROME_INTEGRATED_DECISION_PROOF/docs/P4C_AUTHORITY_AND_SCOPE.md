# P4-C — Authority and Scope

**Status:** `P4-C COMPARATIVE VISUAL DECISION PROOF — CANDIDATES ONLY — P4-DQ-01 … P4-DQ-04 OPEN — NO PRODUCTION IMPLEMENTATION`

## 1. Repository truth

| | |
|---|---|
| Canonical `main` | `175df7b6f9254d83b82d2b7571c915959fb06a27` (PR #279, P4-DQ-10 resolved by CW2-08A), verified on GitHub before any work |
| Local starting state | branch `docs/p4-b-cw2-08-no-human-review-amendment` at `3e4cf2a`, clean, 1 behind / 1 ahead of `origin/main` (the P4-B branch before its squash merge). Nothing was reset or cleaned |
| Proof branch | `design/p4-c-shell-chrome-integrated-decision-proof`, created from exact `175df7b` |
| Lifecycle | P1 · P2 · P3 `CLOSED / FROZEN`; P4 `ACTIVE — NOT CLOSED / NOT FROZEN`; 16 Product Owner decisions open before this task |

## 2. What P4-C is

A **comparative visual decision proof** for four Decision Queue rows. It draws bounded candidates inside the real accepted
Product, measures them, and hands the choice back.

| Row | Question | P4-C does |
|---|---|---|
| `P4-DQ-01` | Where is the one General Settings destination entered? | proves S-A and S-B; records why no third option was earned |
| `P4-DQ-02` | Where is «فهم قنديل» / QANDEEL Understanding entered, and in what form? | proves U-A and U-B; shows the General Settings row only as the authority rejection |
| `P4-DQ-03` | Does the canonical Q appear persistently, and where? | proves Q-A, Q-B and Q-C with the real Q |
| `P4-DQ-04` | (A) the Global Switcher's physical form; (B) «سياق الكلام» placement in the Analysis | proves SW-1 / SW-2 / SW-3 and X-A / X-B / X-C |

It resolves none of them. `P4-DQ-05` onward are untouched.

## 3. Authorities read, and what each binds here

| Authority | Section(s) | Binds in P4-C |
|---|---|---|
| `docs/p4/P4_READ_FIRST.md`, `P4_PRODUCT_OWNER_DECISION_QUEUE.md`, `P4_RESIDUAL_GAP_CENSUS.md`, `P4_CARRY_FORWARD_MATRIX.md` | DQ-01 … DQ-04 in full | the four questions, their viable options, the queue's own exclusion of Understanding-as-Settings |
| I-08A4 closure synthesis | §2, §3, §4, §5, §7, §8, §9, §19, §21 | Personal-centred shell; three World destinations; switching ≠ pushing; Back local-only; Settings = secondary Global Shell utility; canonical Arabic / English names; the physical switcher form explicitly not frozen |
| P1 closure | §7, §8, §8.1, §10, §11, §12, §15, §16.1 | no Profile; one Settings destination and its groups; «فهم قنديل» / QANDEEL Understanding is a Personal depth, not Settings / Profile / tab, with a stable discoverable entry; «القراءات» stays the in-Analysis vocabulary; Dark / Light / System for non-Analysis surfaces |
| G1.1 closure | §1, §2, §5 | Conversation-first; «تحليل المحادثة» / «المحادثة»; Replay as an action; «سياق الكلام» is natural Arabic; English Conversation → Analysis label open |
| G1.2 closure | §1, §3 | Live Call Analysis-first; «العالم المشترك» / Shared World, singular |
| G3 closure, G2 / F2 amendment, T-11 / T-12 amendment | §C, §G; §2; §2, §3, §5 | the Analysis is one dark place under every appearance; the composition world → temporal line → Timeline → OrientationChrome; the 160 pt world floor; «سياق الكلام» placement "VI-01 / Product; not decided" |
| P2 closure | §4, §5, §8, §9, §10, §11, §13 | the N1 nav family, glyph above the word, Brass invariance, SELECTED by E1R marker + weight; Hugeicons Free utility sourcing; 44 pt; direction by meaning; placement is not iconography |
| P3 closure | §3, §5.1, §6, §8, §12, §16, §17, §19.4–19.6 | Activity: independent icon-only entry at the START edge of the non-Analysis upper chrome, never in the Analysis; Open Ledger; the Settings entry's placement left to P4 |
| C3 material contract | §2A, §3, §6, §7, §8 | the Q's material `qandeel.identity.mark`; Brass never encodes state; the Q's presence is an open placement question |
| I-08B2.5 brand package | `masters/QANDEEL_Q_BASE_MASTER.svg` | the Q geometry, read verbatim (P4-C does not ratify the package: that is DQ-05) |
| VI-01 Terminology Matrix / Foundation / Stress Test | S03, A01, §7.2 | «سياق الكلام» Arabic `APPROVED`; English `OPEN` ("In play now" is VI-01's own candidate) |

## 4. The visual baseline, consumed read-only

| Material | From | How |
|---|---|---|
| G3.2 final Analysis proof | `docs/design/canonical-artifacts/product-proofs/g3/g3.2/prototype/index.html` | vendored byte-exact to `prototype/g3.2/index.html` (SHA-256 `10611f35…83d71`) and loaded unchanged in a frame for every Analysis state |
| P3-A non-Analysis shell + Activity | `docs/design/p3-notifications/QANDEEL_P3-A_…/` | its shell geometry, styles and pipeline are the model for P4-C's own source (adapted, recorded in [`P4C_PROVENANCE.md`](P4C_PROVENANCE.md)); Open Ledger vendored byte-exact |
| P2 final iconography | `docs/design/p2-iconography/QANDEEL_P2-A_…/source` | `sig.mjs`, `utility.mjs`, `machines.mjs`, `tokens.mjs`, the token tree, Estedad v8.5, the utility glyphs — byte-exact |
| The canonical Q | the brand master | byte-exact; the path strings are read out, never redrawn |

Neither G3.2 nor P3-A is edited. Every vendored byte is re-hashed against its canonical origin by `C-PROV-1`, `C-G32-1`
and `C-Q-0`.

## 5. What P4-C creates

Only the P4-C package under `docs/design/p4-shell/QANDEEL_P4-C_SHELL_CHROME_INTEGRATED_DECISION_PROOF/`, plus one optional
line in `docs/p4/P4_READ_FIRST.md` saying the proof is ready and the four rows stay OPEN.

New in the proof, and only this: candidate **placement** and **form** — the START utility pair (S-A), the Personal row
(U-A, S-B), U-B's chrome action, the chrome Q slot (Q-B / Q-C), three switcher forms, and three «سياق الكلام» placements —
all built from existing tokens, the one Surface tone, E1R's state channels, P2 / P3 glyphs and canonical words.

## 6. What P4-C does not do

- It selects, approves or freezes nothing. Every option is `CANDIDATE — NOT SELECTED`; each integrated direction is
  `INTEGRATED CANDIDATE — NOT SELECTED`.
- It edits no Decision Queue row, no census row, no backlog, and no P1 / P2 / P3 / G1 / G2 / G3 / I-08A / I-08N / CW2 /
  CW2-08A record, no G3.2 or P3-A byte, no brand master byte, and no canonical visual-system source.
- It changes no `apps/`, `packages/`, `database/`, `.github/` or dependency. No production implementation is authorized
  or performed.
- It designs no Understanding surface, no Settings screen hierarchy, no Live Context panel and no launch brand
  (DQ-06 / DQ-07). It writes no new Product copy.
- It does not start `P4-DQ-05` or prepare P4 closure.
