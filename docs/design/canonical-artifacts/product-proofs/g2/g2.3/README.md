# I-08B3.1-G2.3 — Matching copy + Return presentation amendment proof

**Status:** WORKSHOP / REVIEW CANDIDATE — NOT FROZEN. **I-08B3.1-G2.3 — MATCHING COPY + RETURN PRESENTATION
AMENDMENT PROOF — READY FOR PRODUCT REVIEW.**

This is a deliberately narrow refinement of I-08B3.1-G2.2 (READY FOR PRODUCT REVIEW, not frozen). It integrates
exactly what the Product Owner approved after G2.2, and nothing else:
- the Matching opening message (D1);
- QANDEEL's view + privacy message (D2), replacing G2.2's three reasons;
- the compact Return / Orientation direction, with a narrow T-11 amendment candidate.

What stays untouched:
- the Matching process, both Mutual-Match moments, and the Dark / Light Analysis;
- the world: the canonical I-08B1 file, byte-identical (SHA-256 `4DFD9D27…BC413`), driven only through the bridge;
- the repository: nothing in `apps/` changed, canonical T-11 was not edited, and no branch, commit or PR was made.

## Open it

- **`prototype/index.html`.** Open it from disk in Chrome or Edge; it works offline. It is Arabic (RTL) and follows
  your system appearance.
- **The review panel.** It jumps to every state on the boards. It switches the perspective (first / second accepter)
  and the system appearance. It lists every Matching word with its status: **PO-APPROVED** or **PROOF COPY — OPEN**.
- **Acts** play the process live:
  - a proposal awaits;
  - open it;
  - «أكمّل»;
  - it becomes unavailable;
  - the other side agrees;
  - enter the Shared World;
  - «طرق العودة».
- **Parameters:**
  - `?state=M2_PROPOSAL_A`
  - `?appearance=light`
  - `?rm=1` (reduced motion)
  - `?w=320&h=568` (the smallest window, where the proposal scrolls as one reading)

## A. Product copy

| Message | Where | Status |
|---|---|---|
| «قنديل شايف إن في شخص يستحق إنك تتعرف عليه. بناءً على فهمه لكل منكما، شايف إن بينكم مساحة تستحق إنكم تكتشفوها سوا.» | the Matching cue, beside the completed Q (board 03) | PO-APPROVED, verbatim (C3) |
| «قنديل شايف إن بينكم نقاط اتفاق كثيرة، وفي نفس الوقت في اختلافات تستحق إنكم تفهموها بهدوء. لو قررتوا تبدأوا التعارف، قنديل هيكون معاكم يساعدكم تفهموا بعض، ويتكلم معاكم عن نقاط الاتفاق والاختلاف في الوقت المناسب.» | QANDEEL's view: the proposal's first zone (board 04) | PO-APPROVED, verbatim (C4) |
| «خصوصيتك محفوظة. بياناتك وتحليلاتك الخاصة لن تُعرض على الطرف الآخر، ولن يُشارك منها شيء إلا ما تختار أنت مشاركته. وقنديل هيكون معك خطوة بخطوة لحد ما تكون مرتاح ومطمئن.» | the privacy assurance: the proposal's second zone (board 04) | PO-APPROVED, verbatim (C4) |

- **Checked against the brief file itself.** Both messages are read from the brief file by the checks, and are
  never retyped.
- **Nothing specific remains.** No similarity or difference list, no reasons, no traits and no evidence remain in
  the proposal (C5). G2.2's frame line, three reasons and "offer, not verdict" note are removed and not replaced.
- **Everything else is `PROOF COPY — OPEN`.** That covers every other Matching word.

## B. Return / Orientation

The approved compact presentation:
- **one status line;**
- **one dominant Return act shown directly.** It is the Live Head return at the Timeline's live edge when PINNED;
  otherwise «الرجوع خطوة واحدة». If neither is offered, every act is shown directly.
- **the other valid Return acts under «طرق العودة»,** Return acts only.

| State | Rows | Words | Band height | World share | Contrast |
|---|---|---|---|---|---|
| P3 (G2.1 → compact) | 3 → 2 | 15 → 9 | 116 → 72 pt | 58 % → 65 % | 5.04 → 5.04 : 1 |
| P4 (G2.1 → compact) | 4 → 2 | 22 → 11 | 141 → 72 pt | 54 % → 65 % | 5.00 → 5.14 : 1 |

- **Exactly G2.2's.** The offered sets are exactly G2.2's, and every P2 / P3 / P4 frame, closed and open, is
  pixel-identical to G2.2's capture (C7).
- **The T-11 conflict.** It is written up as `G2.3_T11_RETURN_PRESENTATION_AMENDMENT_CANDIDATE.md`. Canonical T-11
  is not edited.

## C. The Matching process

The G2.2 process is untouched:

Analysis attention → private proposal → first-accepter acknowledgement → neutral unavailable state → second-accepter
Mutual Match → first-accepter later arrival → Shared World / INTRODUCTION handoff.

The two accepters still experience it differently:
- **The second accepter's «أكمّل»** *is* the Match: the World rises.
- **The first accepter's Match** arrives later, into a World that already exists.

The state machine and every sampled motion value are G2.2's (C10). No new motion was recorded, because nothing in any
transition changed. G2.2's two clips remain the motion reference.

## D. Boards (8)

| File | Size | What it shows |
|---|---|---|
| `boards/01-compact-return-p3.png` | 1680 × 1404 | P3, default and disclosed, and P2: Back shown directly, the rest under «طرق العودة»; measured against G2.1; 0 px from G2.2 |
| `boards/02-compact-return-p4.png` | 2391 × 1544 | P4, default and disclosed: the Live Head at the live edge; the closed dominance rule over 11 offered sets |
| `boards/03-matching-opening-cue.png` | 2154 × 1378 | the approved opening message at FAR, MID and 320 × 568; the cue at 2×; its arrival, frame by frame; contrast |
| `boards/04-qandeel-proposal-view.png` | 1656 × 1738 | the approved view + privacy message for both accepters, under system Light, and at 320 × 568 scrolled; the three zones; what was removed; the runtime privacy check |
| `boards/05-first-accepter.png` | 1686 × 1570 | decision → acknowledgement → nothing pending; the neutral ended / unavailable outcome |
| `boards/06-second-accepter-match.png` | 1718 × 960 | the birth, frame by frame, now dissolving the approved view; T-10 / G1.1 timing |
| `boards/07-first-accepter-later-arrival.png` | 1744 × 911 | the arrival and the entry into an existing World, frame by frame; how it differs from 06 |
| `boards/08-shared-world-handoff.png` | 1975 × 1002 | what crosses into «العالم المشترك» / «تعارف» and what stays behind |

## E. Validation (brief §12): the twelve lightweight checks

No G2.1 or G2.2 suite was rerun, and there was no planted-defect campaign.
- **C1–C11** are computed from the captures, from the running prototype, from the brief file and from G2.2's
  recorded evidence.
- **C12** runs while the ZIP is written.

Run 2026-09-24 09:25 UTC on Windows 11, headless Chrome (GPU raster), CDP. **11 / 11 pass** (C1–C11).

| ID | Check | Result |
|---|---|---|
| C1 | Living Analysis canonical hash unchanged | **PASS** — pin 4DFD9D27D752… = the blob on main b089c86fb (0a18a4f6d8f8) (true) = the vendored copy G2.1 / G2.2 / G2.3 read (true) = the bytes inlined in prototype/index.html (true) = the page's own SHA-256 check before loading (true) |
| C2 | Repository tracked files unchanged; no branch, commit or PR | **PASS** — HEAD 7eb2017da = the baseline taken before G2.3 wrote anything (true); branch fix/connected-worlds-rem03-privacy-cross-phase-governance, unchanged; 0 tracked changes (canonical T-11 docs/responsive-recomposition-v1.md untouched); 40 untracked files under apps/ packages/ database/ docs/ — all pre-existing and byte-identical to the baseline (0 differ); no G2.3 branch, local or remote |
| C3 | The approved opening message appears exactly | **PASS** — the D1 text, read from the brief file itself (113 characters), is the cue's visible text, code point for code point, at 390 × 844 FAR and MID and at 320 × 568 (true · true · true); the cue's accessible name begins with it (true); its two sentences start their own lines (1+2 lines · 1+2 lines · 2+3 lines) and rejoin exactly; the G2.2 cue is gone from the page (true); the completed Q sits beside it (see C6) |
| C4 | The approved QANDEEL-view / privacy message appears exactly | **PASS** — both D2 paragraphs, read from the brief file itself, are the proposal's text exactly — QANDEEL's view, then the privacy message — for the first and the second accepter, after the first accepter's decision, at 390 × 844 and 320 × 568, under system Dark and system Light (6 renders: view true, privacy true, in that order true); the privacy message's first sentence is a run-in lead that rejoins exactly (the build refuses otherwise) |
| C5 | No specific agreement / disagreement details in the Product proposal | **PASS** — every visible text block in every proposal render (7 renders, 38 blocks) is exactly one of: the back label, the approved view, the approved privacy message (its lead and its rest), what continuing does, the two decisions, the acknowledgement, the unavailable line (0 other); 0 lists (ul / ol / li) in the proposal (0 found); none of G2.2's three reasons, its frame line or its "offer, not verdict" note — nor 7 of their key fragments — exists anywhere in the built page (0 found). The only agreement / difference words are the approved ones, which name no trait, similarity or difference. |
| C6 | No candidate name, photo, score, %, ranking or feed | **PASS** — 15 Matching renders scanned (Dark, Light, 320 × 568): 0 score / ranking / % words, 0 numbers (the only digits are the Shared World's time «اليوم 9:41» / «اليوم 9:18»), 0 names (the fixture's one name is the reader's own, in the Conversation only), 0 images or photos in the prototype, at most ONE Matching item on screen in any state (1): no list, no feed, no candidate card; the world's own state is identical with and without Matching (true): no candidate object enters it; the cue's mark is the completed QANDEEL Q — paths identical and viewBox identical to the I-08B2.5 master on main (blob 70e795b87413) |
| C7 | P3 / P4 keep exactly G2.2's underlying Return offered sets | **PASS** — P2: offered BACK_ONE_STEP · RETURN_WORLD — identical to G2.2's recorded P2 and to G2.1's (true), same reasons (true), same shown / grouped acts (true), same T-08 sentences (true); the whole frame vs G2.2's capture: 0 px differ / P3: offered BACK_ONE_STEP · EXACT_RETURN · RETURN_WORLD — identical to G2.2's recorded R_P3_COMPACT and to G2.1's (true), same reasons (true), same shown / grouped acts (true), same T-08 sentences (true); the whole frame vs G2.2's capture: 0 px differ / P3_OPEN: offered BACK_ONE_STEP · EXACT_RETURN · RETURN_WORLD — identical to G2.2's recorded R_P3_OPEN and to G2.1's (true), same reasons (true), same shown / grouped acts (true), same T-08 sentences (true); the whole frame vs G2.2's capture: 0 px differ / P4: offered BACK_ONE_STEP · RETURN_LIVE_HEAD · RETURN_WORLD · GO_LIVE_AND_LOCATE — identical to G2.2's recorded R_P4_COMPACT and to G2.1's (true), same reasons (true), same shown / grouped acts (true), same T-08 sentences (true); the whole frame vs G2.2's capture: 0 px differ / P4_OPEN: offered BACK_ONE_STEP · RETURN_LIVE_HEAD · RETURN_WORLD · GO_LIVE_AND_LOCATE — identical to G2.2's recorded R_P4_OPEN and to G2.1's (true), same reasons (true), same shown / grouped acts (true), same T-08 sentences (true); the whole frame vs G2.2's capture: 0 px differ |
| C8 | «طرق العودة» contains only secondary Return acts | **PASS** — opened in P2, P3 and P4, «طرق العودة» discloses exactly the offered acts other than the dominant one, in T-08's order, each with its frozen T-08 label (verbatim in product-copy.ts) — 1 · 2 · 3 acts, none twice, nothing that is not a Return act; the trigger is T-08's own «طرق العودة» with aria-expanded / aria-controls; no generic More / Options / overflow word anywhere on screen. The closed rule over 11 offered sets (11 correct): one act never gets «طرق العودة»; nothing offered renders no group; with no dominant act every act is shown directly. G2.2's rule gives the same answer in every row this fixture can reach and differs only in: no Back, not PINNED (unreachable here); origin + World, no Back (unreachable here) |
| C9 | The dominant Return act stays directly visible | **PASS** — P2: BACK_ONE_STEP (band) shown directly — visible, labelled with its T-08 words, ≥ 44 pt, and a real press at its centre reaches it (true) · P3: BACK_ONE_STEP (band) shown directly — visible, labelled with its T-08 words, ≥ 44 pt, and a real press at its centre reaches it (true) · P3_OPEN: BACK_ONE_STEP (band) shown directly — visible, labelled with its T-08 words, ≥ 44 pt, and a real press at its centre reaches it (true) · P4: RETURN_LIVE_HEAD (live edge) shown directly — visible, labelled with its T-08 words, ≥ 44 pt, and a real press at its centre reaches it (true) · P4_OPEN: RETURN_LIVE_HEAD (live edge) shown directly — visible, labelled with its T-08 words, ≥ 44 pt, and a real press at its centre reaches it (true) — with «طرق العودة» closed AND open, the dominant act never moves into the group |
| C10 | The first and second accepter processes stay distinct — and unchanged from G2.2 | **PASS** — second accepter: their own «أكمّل» commits (proceed→born/born); the proposal dissolves, an empty beat (true), the World RISES (true), QANDEEL's welcome arrives after it (true), «اليوم 9:41». First accepter: a system arrival, then their own tap (matchArrives→arrived/- · enterShared→entered/entered); no rise (true), the welcome already there on every sample (true), «اليوم 9:18». Sampled exactly as G2.2's V5: all 26 samples are identical to G2.2's recorded numbers (second true, first true); the 12 Matching state-machine functions are G2.2's, statement for statement (12/12; the only addition is openProposal's scroll reset) |
| C11 | The Shared World contains no private Matching reasoning | **PASS** — the born and the entered Shared World show its kind «العالم المشترك», its phase «تعارف», a time and QANDEEL's welcome — none of the 14 Matching sentences (every sentence of both approved messages included), none of 15 key fragments (agreement, differences, privacy, data, analyses, the other side, the reasons G2.2 had, a name): 0 found; no proposal or cue text is on screen there (true); Replay is not offered there (true) |
| C12 | Package manifest / hash verifies | **Checked at packaging.** `data/MANIFEST.json` lists every other file with its SHA-256 and size. The ZIP beside the folder is read back entry by entry (name, size, CRC-32, bytes) against the folder, and the folder must be exactly the brief's §14 tree. The ZIP cannot contain its own hash, so its SHA-256 is written beside it as `I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT.zip.sha256`. |

**Plus one live-mode pass** (not one of the twelve): 28 / 28 steps OK. It uses real mouse clicks and keys on
the real controls, with no capture clock:
- cue → proposal;
- the proposal's own back button (the header click-through fix);
- both accepters' paths and the later arrival;
- «طرق العودة» opening and closing by click, Enter and Escape, and focus returning after an act;
- the operating system switching to Light mid-session.

**The Dark / Light Analysis (D5) was not reopened.** `data/MANIFEST.json` → `appearanceCodeUnchanged` compares
every piece of appearance code with G2.2's: the blend, the palettes, the dark scope and the system listener. None was
touched, so G2.2's 11-frame proof stands (brief §8).

## F. Package

```text
I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT/
├─ README.md                                            this file
├─ G2.3_DECISIONS.md                                    the decisions as built, the copy integration, self-review
├─ G2.3_OPEN_QUESTIONS.md                               genuine open decisions only (brief §15 preserved)
├─ G2.3_T11_RETURN_PRESENTATION_AMENDMENT_CANDIDATE.md  the narrow T-11 amendment, for review before canonicalization
├─ prototype/index.html                                 the one interactive prototype (self-contained, offline)
├─ boards/01 … 08 *.png                                 the eight review boards
└─ data/MANIFEST.json                                   every file with SHA-256, provenance, the checks, the copy table
```

The ZIP sits beside the folder, with its `.zip.sha256`. The skill guidance is G2.2's `G2.2_SKILL_DELTA.md`; no new
guidance was used (brief §13).

## Reproduce

The tools live outside the package, in `.i08b31-g23-work/` beside `design-workshops/`. They read G2.2's source and
recorded evidence read-only, and G2.1's vendored bytes and tools read-only.

Run these, in order:
1. `node tools/pipeline.mjs` (build → shots → frames → validate → live check → boards → README)
2. `node tools/package.mjs` (manifest → ZIP → read-back)

The host needs headless Chrome with GPU raster.
