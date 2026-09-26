# P4-C — Product Proof Report

**Status:** `P4-C — SHELL / PLACEMENT / SMALL-CHROME INTEGRATED VISUAL DECISION PROOF — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`

**P4-DQ-01 … P4-DQ-04 remain OPEN. No candidate has been selected or frozen.** Every recommendation below is advisory.

## 1. What was proved

On the real accepted Product — P3-A's non-Analysis shell and G3.2's own Analysis, byte-exact — P4-C drew each open
placement as a small set of candidates, one decision at a time with everything else held constant, then assembled the
two strongest combinations into full screens to expose collisions.

| | |
|---|---|
| Candidates | DQ-01: S-A, S-B · DQ-02: U-A, U-B, and the General Settings row (`REJECTED BY AUTHORITY`) · DQ-03: Q-A, Q-B, Q-C · DQ-04A: SW-1, SW-2, SW-3 · DQ-04B: X-A, X-B, and X-C (`REJECTED BY AUTHORITY`, measured) |
| Integrated | Direction I (Personal-centred) and Direction II (Global utility), each `INTEGRATED CANDIDATE — NOT SELECTED` |
| Coverage | Arabic RTL and English LTR; 320 × 568, 390 × 844, 430 × 932; Dark and Light non-Analysis; the Analysis dark under Light; ordinary, PINNED, Live Call and Live Call + PINNED Analysis; Increased Contrast; keyboard focus; pressed; a large-text stand-in |
| Evidence | 124 captures at 2× (28 kept in `captures/`), 11 boards, `data/SHOTS.json` with the geometry measured in every capture |
| Checks | see §4 |

## 2. What the evidence shows, per decision

The full matrix, with every measurement, is [`P4C_DECISION_STUDY.md`](P4C_DECISION_STUDY.md).

**DQ-01 — Settings.** Both candidates keep P3's Activity at the START edge and reach the one destination.

- **S-A** adds one neutral glyph beside Activity on every non-Analysis surface. That forms a START utility group opposite
  the conversation's own END group. The Personal chrome keeps 95.2 pt free at 390 AR and 25.2 pt at 320 AR.
- **But S-A overflows at 320 pt in English, by 17 pt.** Activity, Settings, the door's proof English label "Conversation
  analysis" and Replay do not fit, so Replay is pushed past the edge. That label is OPEN copy (G1.1 §2, P4-DQ-09), so
  S-A's English fit depends on DQ-09.
- **S-B** keeps the global chrome to Activity only. But a Shared World then shows no Settings entry, and a gear on the
  Personal row can read as QANDEEL's own settings rather than the app's.
- **Craft note:** the curated gear reads denser than Open Ledger beside it. That is a weight tuning inside P2's utility
  rule, not a placement question.

**DQ-02 — Understanding.** U-A — «فهم قنديل» with a depth chevron on a quiet Personal row — is:

- stable, discoverable and on Personal only;
- clearly not Settings, a Profile or a tab;
- resilient at 320 pt.

Its price is one 44 pt row. U-B — beside «تحليل المحادثة» — reads as a sibling of the conversation's own analysis. The
one U-B form drawn overflows the chrome at 390 pt in English, where the door and Replay leave the screen, and at 320 pt
in both languages. That is a weakness of the drawn form, not an authority rejection. The queue lists U-B as viable; a
refined U-B that kept the frozen chrome would need a second line, which is U-A's shape.

**DQ-03 — the Q.** Q-B and Q-C were each given their best case: the centre of the free chrome span. Even so, a chrome Q:

- adds no information;
- lands in the busiest chrome;
- strikes the Settings entry and the door at 320 pt under S-A;
- can read as a search glyph at chrome size;
- cannot reach the Analysis without further authority.

Q-A keeps the Q where it says something: the frozen Matching cue, and QANDEEL's opening turn as G3.2 draws it.

**DQ-04A — the switcher.** All three forms keep every frozen semantic. The checks measure this: three Worlds, the P2
glyphs above the words, Brass identical at every state, and SELECTED shown by marker + weight.

- SW-1 and SW-3 are two plate variants; SW-2 is the only plate-less form.
- **SW-1** is the reviewed incumbent. Its plate runs on from the composer, so the switcher's top edge is implicit.
- **SW-2**'s under-word rule is the grammar P3 uses for in-page filters.
- **SW-3** gives the plate a stated seam edge and makes the selected cell's seam the E1R marker, echoing Call Rail A. It
  stacks three horizontals within about 20 pt.

**DQ-04B — «سياق الكلام».** Arabic is approved (VI-01 S03 / A01). English is open, so "In play now" is PROOF COPY — NOT
CANONICAL, handed to DQ-09.

- **X-A** (in the chrome beside Replay) never touches the world. It clears every frozen control at 320 pt, with its
  target 2 pt from Replay's.
- **X-B** (centred) reads as the place's title.
- **X-C** (the world's upper edge, G1.2's old position) leaves 118 pt of world against the 160 pt floor in the densest
  reachable state. It is **rejected by authority**.

Focus order inside the Analysis is not evidenced for any placement, because the overlay sits outside G3.2's frame.

## 3. Integrated directions

| | Direction I — Personal-centred | Direction II — Global utility |
|---|---|---|
| Settings | S-B (Personal row) | S-A (beside Activity) |
| Understanding | U-A | U-A |
| Q | Q-A | Q-A |
| Switcher | SW-1 | SW-3 |
| «سياق الكلام» | X-A | X-A |
| Status | `INTEGRATED CANDIDATE — NOT SELECTED` | `INTEGRATED CANDIDATE — NOT SELECTED` |

Direction II combines each decision's advisory recommendation.

- **Its Personal chrome overflows by 17 pt at 320 pt in English** with the current proof door label (board 09). So
  Direction II stands only together with an English Conversation → Analysis label from P4-DQ-09 that fits.
- **Direction I** (S-B, SW-1) fits at every measured size in both languages.
- Neither direction drops the world below its floor (boards 07–10).
- `C-CHROME-1` checks that no chrome overflow in any capture goes unrecorded. The only overflows are U-B's and S-A's at
  320 EN.

## 4. Verification

- **Checks:** see `data/CHECKS.json`. Every DOM check runs on the live built page, not on a description of it. All
  checks pass, and **23 / 23 planted defects are rejected**, each by its named check:
  - the switcher:
    - a fourth destination;
    - selected-only Brass;
    - colour-only SELECTED;
    - the glyph below the word;
    - a mirrored World glyph;
    - a nav glyph exposed to assistive technology;
  - Settings:
    - a duplicate entry;
    - an entry hidden behind an overflow;
    - an unnamed entry;
    - an entry under the 44 pt target;
    - an entry that leads elsewhere;
  - Understanding as a Settings row;
  - Activity:
    - Activity in the Analysis;
    - Activity moved to the END edge;
  - focus order that differs from visual order;
  - the door's words rewritten;
  - the Q:
    - a chrome Q under Q-A;
    - the Q as a selected marker;
    - a Q redrawn by eye;
  - «سياق الكلام» shown twice, or laid over Replay;
  - a Light Analysis;
  - an Arabic shell laid out LTR.
- **Focus:** focus order is proved two ways. A real Tab walk from the page start (`C-FOCUS-2`) checks it. So does a
  DOM-order check against geometry (`C-FOCUS-1`). In the Analysis, G3.2's own rail under the candidate switcher is inert
  (`C-FOCUS-3`).
- **Frozen sources:**
  - G3.2 `10611f35…` is byte-exact.
  - Every vendored P2 / P3 / brand byte is re-hashed against its origin (`C-PROV-1`, `C-G32-1`, `C-Q-0`).
- **Rebuild:** `source/` rebuilds `prototype/index.html` byte-identically (`C-BUILD-1`, and again in `p4package.mjs`).
  A second, independent run of the checks produced byte-identical `CHECKS.json` (Review Pool, verification lens).
- **Scope:** changed paths are only this package and one line of `docs/p4/P4_READ_FIRST.md` (`C-SCOPE-1`).
- **Links and labels:**
  - every relative link resolves (`C-LINK-1`);
  - no candidate is labelled approved, selected, final or frozen in the documents, data or candidate sources
    (`C-LABEL-1`). Board pixels were checked by the Review Pool;
  - every decision is OPEN in the matrix (`C-OPEN-1`).

## 5. Review Pool

Four independent, read-only reviewers ran after the proof was built. They were separate agents with their own context,
and none of them resolved a Product Owner decision. Their findings were then corrected in the package, and the pipeline
re-run.

| Reviewer lens | Verdict | Material finding | Disposition |
|---|---|---|---|
| Canonical Product / IA | CONCERN | X-C carried two statuses (candidate and rejected); U-B was rated FAILS AUTHORITY on a layout overflow; the default live page opened on Direction I's choices | **corrected:** X-C is `REJECTED BY AUTHORITY` everywhere (judged by its worst reachable state); U-B is now CONCERN ("fails as drawn"), with the U-A advisory reduced to moderate; the default page is the incumbent shell. No ontology drift and no frozen authority reopened |
| Principal Visual / Interaction | CONCERN | the Personal row hard-cut the opener and its Q; SW-1 and SW-3 are two plate variants, not three structural forms; the gear outweighs Open Ledger | **corrected:** the conversation's own top fade (G3.2 grammar) on every candidate and the baseline; board 05 and the matrix say "two plate variants and one plate-less form" and name SW-3's line stacking; the gear weight is recorded as craft. The Q-B "search glyph" reading and X-A's "caption for Replay" risk are recorded as evidence |
| Arabic / RTL + Accessibility | CONCERN | "keyboard walk" overstated (focus was set programmatically); the Analysis overlay's focus order untested and G3.2's hidden rail still focusable; board 09 figures; the digit statement | **corrected:** a real Tab walk (`C-FOCUS-2`); G3.2's rail made inert under the candidate (`C-FOCUS-3`); the Analysis focus gap recorded on X-A / X-B; board 09 reads the densest world from the checks and shows overflow as a negative span; the digit statement now describes G3.2's Arabic-Indic world labels; a forced-colours outline fallback added |
| Proof / Verification | PASS | re-ran the checks (byte-identical output); re-hashed all 67 vendored files and all 137 manifest entries; minor: 13 DOM checks had no planted negative, two could pass vacuously, the label scan was loose, capture counts were stale | **corrected:** 8 more planted defects (23 in all); non-vacuity guards on `C-DIR-2` and `C-X-2`; a stricter label scan that covers the candidate sources; counts updated |

## 6. What stays open, and whose it is

- The four decisions (§7).
- English wording → P4-DQ-09:
  - the «سياق الكلام» English word;
  - the English Conversation → Analysis label, on which S-A's 320 pt English fit depends.
- The Understanding surface, and the Settings screen's order and hierarchy → P4-DQ-07. The entries are enough for the
  audit to walk.
- Launch / splash / gateway brand → P4-DQ-06; brand ratification → P4-DQ-05.
- G3.2's own call-line level, pre-P2 glyphs and world fixture labels stay as preserved evidence. P2 §13.6 already
  supersedes the first two, and P4-C does not redraw G3.2.
- Device gates:
  - VoiceOver / TalkBack;
  - Dynamic Type at 320 pt;
  - device Increase Contrast and forced colours;
  - touch latency;
  - focus order inside the production Analysis chrome.

## 7. Product Owner decision cards

### DQ-01 — General Settings entry

| Candidate | One-line tradeoff | Boards |
|---|---|---|
| **S-A** Upper-chrome utility | one predictable place on every non-Analysis surface, as a utility pair with Activity; costs one more glyph in each upper chrome, and **overflows at 320 pt in English** with the current proof door label | 02, 07, 08, 09 |
| **S-B** Personal surface entry | the quietest global chrome and the most Personal-centred; a Shared World shows no Settings entry, and the gear can read as "QANDEEL's" settings | 02, 07, 09 |
| Considered, not earned | inside Activity; an overflow menu; a fourth tab (fails I-08A4 §19) | 02 |

**Advisory recommendation: S-A, conditional on P4-DQ-09.** Recommend it only with an English Conversation → Analysis
label that fits the 320 pt chrome beside Activity, Settings and Replay. If a label of the current length is kept, the
evidence supports S-B.

**Question:** *Is the General Settings entry an icon-only utility beside Activity in the upper chrome of every
non-Analysis surface (S-A), or a stable entry on the Personal QANDEEL surface only (S-B)?*

### DQ-02 — QANDEEL Understanding entry

| Candidate | One-line tradeoff | Boards |
|---|---|---|
| **U-A** Personal row control | stable, discoverable, Personal-only and unmistakably not Settings / Profile / tab; costs one 44 pt row | 03, 07, 09 |
| **U-B** Conversation-context sibling | sits with the conversation's own depth, but reads as its sibling, and the drawn form overflows the chrome at 390 EN and 320 pt | 03, 09 |
| General Settings row | **rejected by authority** (P1 §11) | 03 |

**Advisory recommendation: U-A (moderate).**

**Question:** *Is «فهم قنديل / QANDEEL Understanding» entered from a persistent Personal row under the upper chrome
(U-A), or from the Conversation chrome beside «تحليل المحادثة» (U-B)?*

### DQ-03 — Canonical Q

| Candidate | One-line tradeoff | Boards |
|---|---|---|
| **Q-A** Identity moments only | the Q appears only where it says something (the Matching cue; the opening turn); the chrome stays for content and controls | 04 |
| **Q-B** Persistent shell Q | constant brand presence; repeats the app's identity, crowds the busiest chrome, can read as a search glyph, and cannot reach the Analysis | 04 |
| **Q-C** Personal QANDEEL only | brands the Personal relationship; implies Shared and Public are less QANDEEL | 04 |

**Advisory recommendation: Q-A (strong).** This is stronger than the queue's "weakly", on the measured evidence.

**Platform note:** Apple HIG Branding says "Resist the temptation to display your logo throughout your app or game
unless it's essential for providing context". C3 §8 already cites it.

**Question:** *Is the canonical Q limited to named identity moments (Q-A), persistent in the shell chrome (Q-B), or
persistent on Personal QANDEEL only (Q-C)? And under Q-A, does QANDEEL's opening turn count as an identity moment?*

### DQ-04A — Global Switcher physical form

| Candidate | One-line tradeoff | Boards |
|---|---|---|
| **SW-1** Plate · crown rule | the proven incumbent; the plate runs on from the composer, so the switcher's top edge is implicit | 05 |
| **SW-2** Ground · word rule | the only plate-less form; the lightest; its marker is the in-page filter grammar, and the composer floats | 05 |
| **SW-3** Keyed seam | the incumbent plate with a stated edge; SELECTED is the seam itself, the most legible marker; three horizontals stack within about 20 pt | 05, 07, 08 |

**Advisory recommendation: SW-3 (moderate), SW-1 a close alternative.** The Product choice is the container, its tab
depth, its relation to the ground and the marker geometry. Craft covers the marker length, hairline weight and plate
height.

**Question:** *Which physical form does the Global Switcher take: SW-1, SW-2 or SW-3?*

### DQ-04B — «سياق الكلام» placement

| Candidate | One-line tradeoff | Boards |
|---|---|---|
| **X-A** Chrome · beside Replay | grouped with the other act on this conversation; no world cost; clear at 320 pt (its target 2 pt from Replay's); may read as Replay's caption | 06, 07, 08, 09 |
| **X-B** Chrome · centred | clear of the controls, but it takes the position of a place title | 06 |
| **X-C** World · upper edge | **rejected by authority**: 118 pt of world against the 160 pt floor in the densest reachable state | 06 |

**Advisory recommendation: X-A (strong).** This is placement only: the meaning, the Live Context panel and the English
word are not decided (English → DQ-09).

**Question:** *Where does «سياق الكلام» sit in the Analysis: beside Replay in the upper chrome (X-A), or centred in the
upper chrome (X-B)?*
