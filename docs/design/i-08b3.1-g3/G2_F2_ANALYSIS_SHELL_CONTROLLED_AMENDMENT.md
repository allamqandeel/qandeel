# QANDEEL — G2 / F2 Controlled Amendment
## The Analysis Shell Under Both System Appearances (Q-LIGHT-SHELL resolved)

**Status:** `CANONICAL CONTROLLED AMENDMENT — FROZEN WITH I-08B3.1-G3`\
**Amends:** `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md` §C item 11, §F and §G item 7 only. Through them it
also resolves the Q-LIGHT-SHELL rows of `docs/design/i-08b3.1-g2/QANDEEL_G3_READINESS_HANDOFF.md` (§3 journey 6, §7) and
the Q-LIGHT-SHELL bullet of `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` §6\
**Narrowly supersedes:** F2 FINAL_CANONICAL's general follow-system presentation, **for the Analysis shell only**\
**Does not amend:** any F2 token, the I-08B1 world, T-08, T-10, T-11, T-12, G1.1, G1.2, G2.3's Matching copy\
**Closure record:** `docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`\
**Product proof:** `I-08B3.1-G3.2-TARGETED-COHERENCE-REFINEMENT`, ZIP SHA-256
`D6AF79DAEEE0B6F09197084E8E35961112B5A30BC2B4CF2524D1FD2B769CE9B0`, preserved at
`docs/design/canonical-artifacts/product-proofs/g3/g3.2/`

This record is additive. The G2 closure, the G3 handoff and the G2.3 closure stay in the repository unchanged, as the
historical records of the state before this decision. For the Q-LIGHT-SHELL question, this later record is
authoritative. The binding takes effect on the merge of the pull request that carries it.

---

## 1. What was open

G2 froze one appearance law, about the **Living Analysis World** alone (G2 §F): the world stays the same dark,
immersive world under system Dark and system Light. It left one question open (G2 §F, §G item 7): while the Analysis is
open, does the **shell around the world** stay dark with it, or follow the system?

G3.1 showed both answers as harness fixtures A and B, and decided neither. The Product Owner then chose A. G3.2 proved
it, and independent Product review accepted it.

## 2. The decision

> **The Analysis is one dark, immersive place, with the canonical Living Analysis World, under both system Dark and
> system Light. Every surface that is not the Analysis keeps following the system appearance.**

### What takes the dark Analysis scope

While the Analysis is shown, the shell and chrome that belong to that place take the dark scope together with the
world. At minimum:

- the status region and its content;
- the upper Analysis chrome;
- the Replay action and its entry, while on the Analysis;
- the Timeline / Temporal Surface;
- OrientationChrome;
- the Analysis call line and call chrome;
- the rail, while on the Analysis;
- the home indicator and the Analysis ground, wherever the platform exposes them.

The dark scope is F2's own dark palette, applied to that shell. No new colour, token or literal is introduced.

### What does not change

- **The world.** The G2 §F scoped exception stands exactly as written: the same dark world, atmosphere, Meaning Light
  morphology and motion, and Living Brass behaviour under both appearances. G3.2 measured the world alone at 0 px
  difference between Dark, Light and Reduced Motion, still and in motion (K06, K07). Its bytes equal the canonical
  I-08B1 source (`4DFD9D27…2BC413`, K03), and it gains no object, marker or veil (K08).
- **Every other surface follows the system.** The reviewed proof keeps these following the system appearance:
  - the Conversation;
  - the private Matching proposal;
  - the Shared World.
- **One Live Call, one identity.** A call carried from the Analysis (dark) to the Conversation (following the system)
  and back is the same call. Only the tone of the surface around it changes (G1.2 §1, §2; G3.2 K20).

### What this is not

- not an app-wide dark mode;
- not a user appearance override, setting or toggle, in the Product or anywhere else;
- not a change to any F2 token or to F2's derivation;
- not a Light repaint of the I-08B1 world, and not a pale veil over it.

## 3. Motion at the surface boundary

For the reviewed **Conversation ↔ Analysis** boundary, the shell's tone change is an appearance change, so it uses F2's
own appearance quantities:

| Setting | Quantity | F2 token |
|---|---|---|
| Normal motion | a 200 ms cross-fade, the same in both directions | `qandeel.appearance.switch.crossfade` |
| Reduced Motion | a cut: no appearance cross-fade | `qandeel.appearance.switch.crossfade-reduced-motion` (0 ms) |

This record does **not** extend the 200 ms rule to the private Matching proposal or to the Shared World. Their end-state
appearance is settled above (they follow the system). The timing of those transitions stays with their existing Product
and motion owners, and G3.2 left it unchanged (finding F-05).

## 4. Status content: a requirement, not a mechanism

While the Analysis is shown, the status content must be **legible against the dark Analysis ground**. It uses the
light-content presentation that ground needs, under system Light as under Dark.

This record freezes the requirement only:
- it names no iOS or Android API;
- it freezes no status-bar animation. The platform switches its own status-bar style and cannot follow a custom
  cross-fade. §3 governs the shell the Product paints, not the platform's style switch;
- it sets no new contrast threshold. Legibility is judged against the text-contrast minimum the existing accessibility
  authorities already apply.

The proof's own measurement is stronger than the requirement and remains evidence: status ink measured at
≥ 11.86 : 1 against the ground painted behind it, on every surface in both appearances (K18). G3.1's rejected fixture B
measured 1.27 : 1 (board 10). No part of that measurement becomes a Product token.

## 5. Exact supersession of the older wording

| Older text | Now reads |
|---|---|
| G2 §C item 11: "surrounding shell treatment remains open" | the surrounding shell treatment is this record's §2 |
| G2 §F: "Q-LIGHT-SHELL remains open … This record does not decide it. It claims no frozen dark treatment for the rest of the Analysis screen, the status region, the rail, the call chrome" | **Q-LIGHT-SHELL is resolved** by this record. The scope in §2 takes the dark Analysis treatment |
| G2 §F, "Later G2 scoped supersession": "It does not … decide Q-LIGHT-SHELL" | still true of G2. This later record decides it |
| G2 §G item 7: "open Product decision" | **resolved** (Decision A, G3.2) |
| G3 handoff §3 journey 6 and §7: "Q-LIGHT-SHELL … `OUT-OF-SCOPE / LATER`" | resolved by this record |
| G2.3 §6: "Q-LIGHT-SHELL — whether shell chrome outside the Analysis world follows the dark immersive surface" | resolved by this record |

Every other statement in those records stays in force. In particular, G2 §F's general F2 rule still governs every
non-Analysis surface:

> **Default appearance follows the system**
> (`qandeel.appearance.system-appearance` = `follow-system-no-in-app-override`).

F2 remains the general appearance authority. F2's preserved package bytes are not changed.

## 6. Implementation status

This record freezes the Product / presentation contract only. It does **not** claim that production code implements the
Analysis shell, the status-content style, or the appearance cross-fade. No native status-bar code, no appearance setting
and no runtime change is made or authorized by it.

A later implementation must show on real iOS and Android devices that the status content stays legible on the Analysis
under system Light (G3.2 finding F-07). That device evidence does not reopen this Product decision unless it shows a
Product contradiction.

> **G2 / F2 ANALYSIS-SHELL CONTROLLED AMENDMENT — FROZEN**
