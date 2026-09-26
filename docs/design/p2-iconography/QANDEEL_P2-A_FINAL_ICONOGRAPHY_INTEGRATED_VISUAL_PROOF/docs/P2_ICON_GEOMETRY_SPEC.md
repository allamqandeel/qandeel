# P2-A — Icon Geometry Specification ("Open Geometry Hybrid")

**Status:** `P2-A CANDIDATE SPECIFICATION — RECOMMENDED FOR PRODUCT OWNER REVIEW — NOT FROZEN`.

The source of truth for every number below is `source/src/sig.mjs`. Its glyphs are pure functions of a nuance and a
render size, so the rules are executable rather than descriptive. Board 01 shows the construction, and board 10 shows
the real rasters.

## 1. Grid and bounds

| Item | Value |
|---|---|
| Drawing grid | 24 × 24 units (u), one per point at 24 px |
| Live area (optical safe area) | 2 … 22 u (20 u). Nothing but a stroke's round cap may enter the 2-u margin |
| Keylines | circle ⌀16 u (r 8); portrait capsule 6 × 11.2 u; square 16 u; landscape handset 17.2 × 7.6 u |
| Render sizes | 24 px: navigation, the Call Rail, the Conversation line. 22 px: upper chrome (door, back, Replay). 20 px: the voice-message transport. 16 px: the documented minimum (board 10) |
| Relation to the target | the glyph is centred in a **44 × 44 pt** target (Call Rail, upper chrome) or a 56-pt-high navigation item. The glyph never grows to meet the target; the target is the control's box (animate-expo §7) |
| Exceptional sizes | 28–48 px keep the same drawing with a lighter optical stroke (`STROKE` table). No large "hero" size exists in P2 |

## 2. Weight

Stroke is **optical, not mathematical** (Apple HIG Icons: "you may need to adjust …"). One nominal weight is corrected
per render size so the drawn line stays ≥ 1.3 device px:

| Render size | 16 | 20 | 22 | 24 | 28 | 32 | 48 |
|---|---|---|---|---|---|---|---|
| Stroke (u) | 1.95 | 1.75 | 1.66 | **1.60** | 1.50 | 1.45 | 1.30 |
| Stroke (px) | 1.30 | 1.46 | 1.52 | 1.60 | 1.75 | 1.93 | 2.60 |

- **Solid optical anchor.** It is allowed only where it carries meaning or recognition:
  - a world's point of light (the "core", r 2.05 u);
  - the media transport (play, pause, stop);
  - a toggle's ON body (the loudspeaker);
  - the terminal act (End Call).

  Nothing else is filled.
- **Dark and light.** The same stroke is used in both appearances. On light grounds the inks are F2's (#29271f primary,
  #626059 rest, Brass #7a6446), and their contrast carries legibility. No weight is added for Light, since F2's light
  tokens were tuned for this.
- **Utility family.** Utility glyphs are re-weighted to the same optical stroke. That is the only normalisation
  (`src/utility.mjs`).

## 3. Terminals and corners

- **Terminals.** Round caps and round joins everywhere in N1 "Open", the recommended nuance. N2 "Architectural" uses
  **flat** caps at the cut only.
- **Corners.** Radius 2 u on rectilinear forms (N2: 1.2 u), concentric on nested forms. The capsule is a full radius
  (3 u).
- **THE QANDEEL CUT.** It is the one opening grammar of the family:
  - at most **one** opening per ring, centred at **45°** (the lower END of the ring as drawn, where the canonical Q's
    ring opens for its tail);
  - its visible span is the nuance's angle (N1: 50°, N2: 34°), measured **between the caps**. The drawn gap grows by
    the round caps' overhang so that the visible gap is the same at every stroke;
  - the visible gap is ≥ 2 u at 24 px (≥ 1.3 px at 16 px), so it never closes into a smudge (board 10).

  One exception is semantic and true: the Public World is a ring open on three sides, because it is the world open to
  everyone.
- **Asymmetry limits.**
  - Only the cut and the core may break a glyph's symmetry.
  - Recognisable silhouettes stay symmetric: the mic capsule, the speaker body, the handset, send.
  - The core sits on the diagonal through the cut, never centred. A centred point in a ring reads as a selected radio
    button, that is, a *state*.

## 4. Perspective and depth

- All glyphs are strictly 2D, frontal and flat: no isometric view, no shading, no pseudo-3D.
- There is one mode per glyph: outline with at most one solid anchor. No outline glyph is mixed with a filled
  pictogram of the same meaning.
- There is no gradient, glow, bevel or texture. Living Brass on navigation is "quiet satin, painted with the body and
  nothing else" (C3 at 24 px).

## 5. Negative space

- **Intentional openings are semantic or structural:**
  - the cut, which is the family's signature;
  - Replay's opening, which is the return;
  - the slash's cut through the muted microphone, which is the state;
  - the Public ring's openings, which carry its meaning.
- **Forbidden:** a decorative gap that separates a glyph's recognisable parts. For example, a stem detached from the
  mic cradle was tried and rejected: after the round caps, its visible gap would be 0.4 u, and at 16 px it reads as
  an accident. No gap under 2 u visible is ever drawn.
- **Faces.** Points of light never sit on a horizontal inside a ring. The first render of Shared and Public did this,
  and they read as faces (board 01 note).

## 6. State: how the glyph cooperates with E1R

| State | Carried by (E1R) | What the glyph does |
|---|---|---|
| REST | absence | nothing |
| PRESSED | the **ground** (press wash `primary @ 0.1`, from pointer-down) | nothing. The glyph and word sit **above** the wash (fixed in P2, check K18) |
| FOCUS | a detached perimeter (2 pt, 2 pt offset, with a world-colour companion) | nothing |
| SELECTED (navigation) | a 2-pt attached marker at the top edge, plus the word at weight 600 | nothing. The Brass glyph is byte-identical (K18) |
| Toggled (Mute, Route) | aria-pressed plus a change of **form** | Mute: the slash, and a band of negative space cut through the mic. Route: the body fills, and the second wave draws |
| DISABLED | one availability ink (#696762 dark / #83817c light) | every ink in the control resolves to it. No call control is disabled in the Product; the route is **absent** while connecting |

State is never colour alone, and never Living Brass.

## 7. Direction

| Member | Rule |
|---|---|
| Navigation world glyphs, the Q, `depth` | **never mirror** (identity; the cut is not a direction) |
| Mic, Muted, Route, End, Call, Replay, Play, Pause, Stop | **never mirror** (media and call) |
| Send | **never mirror** (drawn vertical, so it has no reading direction) |
| Back chevron (utility) | **mirrors by meaning** (`scaleX(-1)` under RTL; never `rotate(180)`) |
| Call Rail art (group ↔ terminal) | **layout direction**. The terminal is at the END edge, and the art mirrors as layout |
| Temporal Spine | **locale / content direction via T-06's one mirror rule**: SP1 at the START edge, Live at the END; logical 0 → physical right in Arabic |
| Numerals on the Track | never flipped. Their order follows the Track (Apple HIG RTL); Western digits through the one locale authority (T-12 §9) |

RTL is not "flip every SVG". Only the chevron and the layout art mirror.

## 8. The small signature family, and why each member is owned (task §4.6)

| Owned glyph | Why QANDEEL owns it |
|---|---|
| `navMine`, `navShared`, `navPublic` | QANDEEL's own places. Identity material (C3 §2A) needs owned geometry |
| `depth`, `replay` | the two Analysis-critical actions in the upper chrome |
| `mic` / `muted`, `routeMorph`, `endCall`, `call` | the Live Call / Voice critical family and its morphs |
| `send`, `play`, `pause`, `stop` | the Conversation line and the voice message, the Product's most-seen controls. They must share the call family's weight and terminals |
| Spine, Aperture, Terminal | the Temporal machine (not glyphs) |

Everything else (close, back, chevrons, settings, overflow, edit, add, search) comes from the curated utility family.
