# I-08B3.1-G3.2 — Targeted Coherence Refinement Proof

> **Status: READY FOR INDEPENDENT PRODUCT REVIEW.** This is a review candidate only. It is **not** closed and **not**
> frozen. **G3 is not closed.** No canonical amendment has been written, and nothing was changed in the repository:
> no tracked file, no branch, no PR (check K05).

G3.2 refines the reviewed G3.1 integrated Product proof for exactly two Product Owner decisions under proof
(`docs/G3.2_PRODUCT_DECISIONS_PROVED.md`):
- **Decision A.** The Analysis shell stays dark with the Living Analysis World under system Light and Dark; every
  other surface keeps following the system.
- **Decision B.** The concise temporal orientation line stands directly above the Timeline when temporal context
  exists.

**Baseline:**
- `main` `da4cf0c9ebcb573f8f186f60b6affbf8a4bd6752`;
- G3.1 ZIP SHA-256 `A5D286A888B7B851193AA4C2805C443766284FC45B3521DAAE356677F7E3316E`;
- the I-08B1 world, SHA-256 `4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413`, byte-exact.

## Open it

`prototype/index.html` opens from disk in Chrome and works offline. The phone is the Product. The panel beside it is the
**PROOF HARNESS — NOT PRODUCT UI**, for start states and device stand-ins.

**Parameters** (harness stand-ins only):

| Parameter | What it stands in for |
|---|---|
| `?lang=en` | the device language |
| `?appearance=light` | the system appearance |
| `?rm=1` | Reduced Motion |
| `?w=320&h=568` | the phone envelope |
| `?state=P4` | a start state |

There is **no shell switch**: G3.1's Q-LIGHT-SHELL fixture is gone.

**Try:**
1. «تحليل المحادثة» under system Light, then «المحادثة»: dark Analysis shell ↔ light Conversation.
2. The call button, then «المحادثة» and back: the same call, in each surface's own shell.
3. In the Analysis: focus the Timeline, press ← → then Enter to pin a Moment. Read the line above the Track, then
   press the Live edge.

## What changed from G3.1, and only this

G3.1's inputs are vendored in `source/vendor/upstream-g31/`, and `tools/upstream.mjs` rebuilds G3.1 from them
byte-identically. The diff below is therefore against sealed bytes.

| Change | Where | Why |
|---|---|---|
| The Analysis shell (status region, rail, call line, Replay action and entry, home indicator, ground) takes the dark scope while the Analysis is shown, under system Light | `app.js` `applyAppearance` | Decision A |
| The shell's tone change is F2's 200 ms appearance cross-fade, in both directions; a cut under Reduced Motion | `app.js` `DUR.appearance` | F-04 |
| The temporal line (PINNED or preview) moves from OrientationChrome into the Timeline cluster, directly above the Track; said once | `build.mjs` `#tl-ctx`, `app.js` `ctxContent` / `renderCtx` | Decision B |
| The line is paid for by the support; OrientationChrome yields with no fixed minimum; the world keeps its floor | `app.js` `bandRoom` | T-11 §3; F-09 |
| The world's legibility falloff gives the line the ground every chrome word has, only while the line is shown | `build.mjs` `#falloff-bottom` | F-01 |
| The Live-edge act's box begins at its label row (60 pt) | `build.mjs` `#tl-live.ret` | F-02 |
| OrientationChrome's soft edge appears only when content is actually cut | `app.js` `bandScrollState` | F-03 |

Nothing else changed:
- the world;
- Conversation, Voice, Live Call laws;
- Replay;
- Matching and its copy;
- the Shared World;
- T-08 truth;
- the «طرق العودة» rule.

## Validation

| What | Result | Where |
|---|---|---|
| Checks | **29 / 29** pass. Each is computed from evidence (captures, the G3.1 twins, motion logs, the live run, the built page, canonical blobs) | `data/CHECKS.json` |
| Planted defects | **10 / 10** rejected. Each probe **plants a regression in a copy of the source, builds it, captures it**, and hands the captures to the guarding check | `data/PROBES.json` |
| Real-input run | **38 / 38** steps pass: mouse presses asserted pressable, wheel, keys, real time, emulated system Light / Reduced Motion | `data/LIVECHECK.json` |
| World floor | 37 Analysis captures; the tightest is 161 pt against its 160-pt floor (320 × 568, in a call, PINNED) | K14 |
| Status legibility | ink against the ground behind it is ≥ 11.86 : 1 on every surface in both appearances. G3.1's fixture B, kept as reference, measured 1.27 : 1 | K18 |
| Temporal line legibility | ≥ 11.29 : 1 at every size and language | K26 |
| World pixels | **0 px** different from G3.1 at FAR, MID, NEAR, PINNED(14) and in a call; **0 px** between Dark, Light and Reduced Motion | K06, K07 |
| Rebuild | `source/` alone rebuilds `prototype/index.html` byte-identically, from a clean copy and again from the extracted ZIP | `tools/package.mjs` |

**The planted defects:**
- a light Analysis shell;
- the line back below the Timeline;
- a duplicated Return act;
- the world squeezed at 320 × 568, twice;
- status legibility broken;
- world pixels changed;
- world bytes flipped;
- a stale PINNED sentence in LIVE;
- a pale veil.

**Browser evidence only.** VoiceOver / TalkBack and device status-bar behaviour are not validated here (F-07).

## Evidence

- **12 boards** in `boards/`:
  - Product captures at 2×, with every diagnostic outside the phones;
  - 390 × 844, 320 × 568 and 430 × 932;
  - Arabic and English;
  - system Light and Dark;
  - Reduced Motion.
- **7 motion clips** in `motion/`: 30 fps, H.264, each decoded back to its exact frame count, with truth logs in
  `data/motion/`.

| Clip | What it shows |
|---|---|
| 01 | FOLLOW_LIVE → preview → PINNED → Return Live |
| 02 | The same journey, under Reduced Motion |
| 03 | Conversation (Light) → Analysis (dark shell) → Conversation (Light) |
| 04 | The same, during a Live Call, with one call identity |
| 05 | 320 × 568: disclosure and reachability in the densest state |
| 06 | Clip 04 under Reduced Motion |
| 07 | Clip 03 under Reduced Motion |

## Read next

| File | What it holds |
|---|---|
| `docs/G3.2_PRODUCT_DECISIONS_PROVED.md` | The two decisions, exactly as proved; what a later amendment would have to say |
| `docs/G3.2_CANONICAL_RECONCILIATION.md` | Repo truth, the canon read, PASS / no contradiction, backlog (nothing inherited) |
| `docs/G3.2_INTEGRATION_FINDINGS.md` | 5 craft defects, all corrected; 0 contradictions; 4 out-of-scope / later |
| `docs/G3.2_OPEN_QUESTIONS.md` | What moved (Q-LIGHT-SHELL, S-04) and four new questions for the reviewer |
| `docs/G3.2_SKILL_USE.md` | The Skill Gate: five skills loaded, one concrete effect each |
| `source/REGENERATE.md` | How to rebuild, re-capture and re-seal |
| `MANIFEST.json` | Every file, with bytes and SHA-256 |

## Package tree

```text
README.md · MANIFEST.json
docs/       G3.2_CANONICAL_RECONCILIATION · _PRODUCT_DECISIONS_PROVED · _INTEGRATION_FINDINGS · _SKILL_USE · _OPEN_QUESTIONS
source/     REGENERATE.md · CANON_DEPENDENCIES.json · src/ · tools/ (+ lib/) · vendor/ (canon · tokens · fonts · lineage · upstream-g31)
prototype/  index.html
boards/     01 … 12 *.png
motion/     01 … 07 *.mp4
data/       CHECKS · PROBES · LIVECHECK · STATE_MATRIX · BOARDS · UPSTREAM · motion/*.truth.json
```
