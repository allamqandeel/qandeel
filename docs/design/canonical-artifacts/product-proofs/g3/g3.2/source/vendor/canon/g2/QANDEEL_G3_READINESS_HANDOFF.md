# QANDEEL — I-08B3.1-G2 → G3
## G3 Readiness Handoff

**Status:** `READINESS HANDOFF — G3 NOT STARTED`  
**From:** `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md` — `I-08B3.1-G2 — CLOSED / FROZEN`  
**Canonical baseline:** `a55af616fbde646bcaa4fcc01b63c78a6e5bc089`

This is a handoff, not a task contract. It states what G3 inherits. G3's own brief is its contract.

---

## 1. What G3 is

> G3 proves that the already-frozen Product pieces behave and feel like one coherent QANDEEL product
> end-to-end.

G3 is **not** another feature-design phase. It joins what is frozen. It adds no surface, redesigns no
owner and decides nothing G2 left open.

## 2. What G3 starts from

| Piece | Authority |
|---|---|
| Living Analysis World | `docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html`, SHA-256 `4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413` |
| Conversation shell, navigation, Replay placement | `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md` |
| Writing, Voice Note, Live Call, background call | `docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md` |
| Analysis composition, Matching laws, Dark / Light | `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md` |
| Final G2 proof artifact | `docs/design/canonical-artifacts/product-proofs/g2/`: the self-contained proof build `g2.3/prototype/index.html`, with its manifest and README |
| Matching copy; compact Return | `docs/design/i-08b3.1-g2.3/`: the G2.3 closure and the controlled T-11 amendment |
| Return meanings; responsive composition | T-08 `docs/inspection-orientation-return-chrome-v1.md`; T-11 `docs/responsive-recomposition-v1.md`; T-12 `docs/final-living-analysis-map-integration-v1.md` |
| Replay truth; Matching / Introduction truth | `docs/replay-runtime-v1.md`; `docs/matching-introduction-runtime-v1.md` |
| Appearance | F2, the general authority: `docs/design/canonical-artifacts/accessibility-appearance/i-08b3.1-f2r/`. G2 closure §F: the scoped supersession for the Living Analysis World |

Three starting conditions, none of them a blocker:

- **G1.2's preserved built prototypes are pre-R1.** Rebuild them from
  `docs/design/canonical-artifacts/product-proofs/g1.2/source/` before reuse (canonical artifact index,
  "Later amendments").
- **Start from the preserved G2 proof artifact.**
  - The minimum final reusable G2 proof build is preserved at
    `docs/design/canonical-artifacts/product-proofs/g2/`.
  - Prefer it, with the closure and amendment records, over any workshop folder.
  - The three sealed review ZIPs stay local as provenance, identified by SHA-256 (G2 closure §B).
- **The preserved G2 build is Arabic-only.** The G2 line's only English build is G2.1's. It is
  superseded and stays in its archive (`product-proofs/g2/SOURCE-PROVENANCE.md`).

## 3. Minimum integrated journeys

Each journey runs end-to-end through the frozen pieces and holds the laws named beside it. None asks
for a new surface.

1. **Conversation → Analysis → FAR / MID / NEAR → Inspection → Return → Conversation.**
   - In through «تحليل المحادثة», out through «المحادثة» (G1.1).
   - Zoom is distance, with no FAR / MID / NEAR control.
   - Inspection writes no camera (T-04) and never becomes a dashboard.
   - Only offered Return acts appear, presented under the T-11 amendment.
2. **Conversation → Live Call → Analysis → Conversation during the same call → Analysis.**
   - The call starts Analysis-first.
   - «المحادثة» does not end it, and «تحليل المحادثة» returns to the same call.
   - No persistent normal-state call prose; one assistive live-status channel (G1.2 §1, §4).
3. **Analysis → Historical / PINNED → Return Live.**
   - T-06's PINNED mode and T-08's historical firewall hold: nothing later than the pinned moment is
     previewed.
   - The way back to Live is the one G2.3 reviewed in its P4 context.
4. **Analysis → Replay entry.**
   - A quiet action on the current context, never a World or a tab (G1.1; Replay runtime §1).
   - Entry only: the player is not built (`QAN-BL-NAV-02`).
   - Personal call audio is not claimed (`QAN-BL-VOICE-01`).
5. **Analysis → Matching → Proposal → first / second accepter paths → Shared World / INTRODUCTION**
   (G2 closure §D).
   - G2.3's exact copy.
   - Nothing specific before the Introduction.
   - The two accepters' moments stay temporally distinct.
   - Nothing private crosses into the new World.
6. **System Dark and system Light entering the same dark Living Analysis World** (G2 closure §F).
   - Both system appearances enter the same dark Living Analysis World.
   - The world's appearance and light behavior do not change between them.
   - The surrounding shell's treatment is still Q-LIGHT-SHELL, and G3 must not silently decide it.
7. **Reduced Motion parity.** Journeys 1–6 again with Reduced Motion on:
   - the same committed truth;
   - T-10's reduced-motion behavior;
   - no appearance cross-fade (F2).
8. **Arabic-primary and English-primary shell coherence.** One Product in two languages:
   - G1.1's speaker sides and independent paragraph direction;
   - «المحادثة» / Conversation;
   - «العالم المشترك» / Shared World (G1.2 §3);
   - T-12's one locale authority.
9. **Accessibility, keyboard and screen-reader routing, where applicable.**
   - Every act in journeys 1–8 is reachable by pointer, keyboard and screen reader.
   - Visual order equals focus order.
   - Focus returns when a disclosure or a private place closes.
   - «طرق العودة» meets the T-11 amendment's §4.
   - Browser accessibility-tree evidence does not replace real VoiceOver / TalkBack validation, which
     remains a device gate (G1.2 §7; F2).

## 4. What G3 judges

- visual hierarchy;
- transition continuity;
- navigation consistency;
- language consistency;
- motion continuity;
- cross-surface coherence.

## 5. What G3 does not redesign

- I-08B1 Living Analysis;
- the G1 Conversation shell;
- G1.2's Live Call laws;
- G2.3's Matching copy;
- T-08's Return semantics;
- the controlled T-11 amendment;
- Replay runtime truth.

**The Reading-surface route is not G3 work.** G2.1 once named G3 as the owner of a route from an
inspected body to a later Reading surface (Q-READING-1). That predates this handoff. G3 designs no
feature, so the route is not G3's.

## 6. Classifying what G3 finds

| Class | Meaning | Where it goes |
|---|---|---|
| `INTEGRATION CRAFT DEFECT` | each piece obeys its owner, but the join between them fails a §4 criterion | corrected in G3's own proof, inside the frozen laws |
| `CANONICAL CONTRADICTION` | two frozen owners cannot both be obeyed | reported to both owners and resolved only by a controlled change, as G2.3's T-11 amendment was; G3 picks no winner |
| `IMPLEMENTATION GAP` | a frozen Product law that production does not yet realize | recorded against the implementation owner; not a proof defect |
| `OPEN COPY` | words that are still proof-only | recorded for the Product copy owner; G3 neither rewrites frozen copy nor freezes proof copy |
| `OUT-OF-SCOPE / LATER` | real, but owned by later work or by another owner | recorded, not built |

## 7. Already known: not G3 discoveries

| Item | Source | Class |
|---|---|---|
| Matching proof lines: the cue label «ليه؟», the acknowledgement, the unavailable line, the second-accepter line, the later arrival, the welcome | G2 closure §G items 1–6 | `OPEN COPY` |
| The Arabic Replay noun and entry names; the English Conversation → Analysis label; the Timeline's accessible name and preview routes; the Live edge's wording while following Live | G1.1 §2, §5; G2.1 proof copy | `OPEN COPY` |
| Q-LIGHT-SHELL | G2 closure §F | `OUT-OF-SCOPE / LATER`: the Product Owner's decision |
| Heavy-history density; final Introduction screen; Replay player; Matching onboarding; notification choreography | G2 closure §A, §G | `OUT-OF-SCOPE / LATER` |
| Compact grouping in production `ReturnControls`; the Skia / Reanimated port of the I-08B1 world | T-11 amendment §7; I-08B1 closure | `IMPLEMENTATION GAP` |
| Orientation placed above the Timeline, as every G2 proof placed it | G2 closure §E | `OUT-OF-SCOPE / LATER`: production needs a controlled T-11 / T-12 amendment |
| A one-act inspection journey offers Back and Exact Return to the same checkpoint. An Emerging Focus has no locus, so the Live Focus return is not offered. | G2.1 seams S-06, S-07 | `OUT-OF-SCOPE / LATER`: T-08 / T-04 |
| The world's own Eastern digits and typeface, beside the chrome's Western digits and Product typeface | G2.1 seams S-09, S-10 | `OUT-OF-SCOPE / LATER`: VI-01 / the port |
| Distinct titles once a person has several Shared Worlds | Matching runtime §22: no canonical first-name source | `OUT-OF-SCOPE / LATER` |

## 8. Blockers

**None.** Every journey in §3 can be proved from frozen pieces, and every carried item is classified in
§7.
