# MAP-VISUAL-REFRESH-01: AD-4 Internal Composition and Belonging (for review; not approved)

**Date:** 2026-11-09
**Status:** a limited art-direction round that develops AD-3 itself, per the PO's AD-3 review.
- The Particle Web and the drawing style are unchanged.
- This is not V-3. No branch, PR or commit.
- No engine or contract change. Replay is not resumed. No IA change.

**Outputs** (all under `AD4/`):
- **Board:** `board-AD4.png` (HTML: `board-AD4.html`)
- **Hero:** `out/AD4-hero.png` (2400×1788)
- **World-only:** `out/AD4-world-only.png`
- **AD-3 vs AD-4 zooms at identical windows:** `crops/{rel,fearpar,feardec,work}-{ad3,ad4}.png`, i.e. cases A, B, C, D (`tools/ad4-crops.mjs`)
- **Belonging test** in `belong/`:
  - `AD4-annotated.png`: the true belonging of all 41 elements;
  - `AD4-risk.png`: the misread-risk marks;
  - the same two over the greyscale render: `AD4-annotated-grey.png`, `AD4-risk-grey.png`;
  - `AD4-grey.png`, `AD4-deutan.png`, `AD4-protan.png`, and the same for AD-3;
  - tools: `tools/ad4-annot.mjs`, `tools/ad4-cvd.mjs`.
- **Annex:** `AD4_PT10_PT13_ANNEX.md`
- **Prototype:** `proto/web.js` (an AD-3 copy plus the AD-4 composition layer)

**Data:** every name, element, relation, colour and membership is declared synthetic. The colours are mock design colours, not product meanings.

## 1. Invariants (checked by machine)
- **The same 41 nodes and coordinates.** Identical to AD-1, AD-2 and AD-3: 0 mismatches, maximum deviation 0 pt.
- **The same 44 relations.** The internal/cross classification is identical to AD-3: 34 internal, 10 cross. None was added or removed.
- **World-only is byte-identical to AD-2 and AD-3** (0 of 12,873,600 bytes differ). The data-free latent world is unchanged, and every AD-4 change lives in the data layer.
- **The same light language, organic branches and Estedad font.**
  - There are still 3,000,000 particle candidates and 2600 walkers, and **light intensity was not raised.** The 44 world lights and 41 node lights are the same.
  - 370k particles were deposited in AD-3 and 377k in AD-4. The +2% comes from the shared zone in §2, case B.
  - 28 extra short threads are born only around the one declared shared element.
- **Labels:**
  - all 41 are shown, 0 are ambiguous, and the maximum own gap is 22.3 pt (unchanged);
  - none is abbreviated or moved to another node;
  - the two-line form is now used for 3 names (it was 1): «التوازن الأسري», «السلام الداخلي», «البحث عن الذات».
- **The image is not darker.**
  - Dark share (pixels with luminance < 0.06) is 35.9% in AD-3 and 33.4% in AD-4.
  - This number only supports "no wider dark gaps". It is not a belonging metric.

## 2. What changed (data mode only, driven by the declared synthetic membership)

| PO request | AD-4 mechanism |
|---|---|
| **Do not separate by widening dark areas** (§1, §4) | The transition between two different groups now calms texture by **at most 22% (AD-3: 50%)**. A transition is no longer a void. It is a **neutral connective tone**: the world's own silver-blue threads, still lit and still crossing. |
| **Colour gradients that keep each group's identity** (§4) | **Interleaving instead of blending.** Where two groups meet, each particle, dust grain or whole thread takes **one** group's own colour, and the second group's share rises across the meeting zone. AD-3 blended in RGB, which made a false third hue: fear red + parenthood blue read as decisions violet. Only the very faint colour body still blends. |
| **Internal relations as a belonging aid; texture and light that unify** (§2) | **Belonging veins:** along each of the 34 internal relations, five fine broken fibres in the group's own colour braid around the line and converge at the nodes, so the group's texture runs from its centre out to its farthest element.<br>**Internal light:** a faint lit area along the same relations brightens only the group's own texture. It has no visible halo or disc, it is the same for every group, and it is never a measure.<br>Cross relations get neither, so they recede when they are not the focus. |
| **Internal relations in the group's colour** | An internal relation is now drawn in its **group's** colour end to end. AD-3 mixed the two node colours, which made the shared element's relations purple. |
| **Limited softening of cross relations** (§4) | Unchanged from AD-3 (thin, cool, fading mid-span), except long ones now fade to 45% (AD-3: 38%), so they stay traceable. |
| **Title placement relative to its elements; a visual centre** (§2) | Each title moves to its group's **visual centre**: the centroid of its own elements (hub ×2, shared element ×0.5), at the nearest spot that covers no relation and no node.<br>Moves in pt: العلاقات 3, العمل 33, الخوف 19, الأبوة 24, القرارات 43, الهوية 29, الصحة النفسية 90, الوحدة 47.<br>**The titles are mock-chosen, not data**, so this is presentation only. |
| **Label ordering around the real nodes** (§2) | The label-cost rules add three terms. All three are **subordinate to belonging**, which stays absolute: a name is never nearer to another node.<br>1. Prefer the side of the node inside its own group.<br>2. A mild preference for facing the group's interior.<br>3. Keep distance from other groups' names (two adjacent names of different groups read as one row) and some air from titles. |
| **Natural variety of group shapes** (§3 D) | There is no template. Veins and light follow each group's own relation tree, so every group keeps its own shape and size. |

## 3. The four cases

| Case | What became clear | What remains ambiguous |
|---|---|---|
| **A, relations and loneliness: «الخذلان»** | Its label sits on the gold side. Its relation to «الحب» is a firm gold line with gold fibres. Its immediate surroundings are gold-dominant, and no barrier was raised between gold and pink. | **A coordinate constraint, stated, not hidden.** «الخذلان» is 67 pt from «العزلة» (loneliness) and 171 pt from its nearest own element («الحب»). Its declared cross relation to «العزلة» is real data and stays drawn, thinly. Paint cannot remove the pull of proximity: in greyscale, its belonging is read only by tracing lines. Making it obvious at first glance needs either the data coordinates (not changeable here) or an explicit marker, which would be a new visual element rather than paint. |
| **B, fear and parenthood: «القلق على الأبناء»** | The dual belonging is now **deliberate**:<br>(1) a split ring, each half in one group's colour, facing that group's hub;<br>(2) the name in two colours, each toward its own group's side;<br>(3) each of its two relations in its own group's colour (red to fear, blue to parenthood);<br>(4) a meeting zone where red and blue threads visibly interweave, not a dark void.<br>Fear and parenthood remain two distinct identities. | In greyscale the colour-based cues vanish. What remains is two lines to two hubs, and a viewer may read it as parenthood only (it is 36 pt from «التوازن الأسري»). The split ring is small at full-map scale. |
| **C, fear and decisions: «المفترقات», «بداية جديدة»** | A clear gain. Violet texture now continues from the hub to both elements, carried by veins and internal light along their **existing** relations; no new link was added. The title «القرارات» moved to the group's visual centre, between the pair and the hub. The «المفترقات» label moved off the row it shared with «المجهول» (red). | The cross relation «المجهول»–«المفترقات» passes close by, as data. The decisions group is still the most spread-out group, because of its coordinates. |
| **D, work (reference)** | It stays clear. Labels shifted slightly toward the group's interior. Veins and light follow its own tree, not a template. | — |

## 4. Belonging test (design review, not user evidence)
The method follows the PO's §5:
- **(1) the natural image**, with no marks;
- **(2) a separate annotated image:**
  - a numbered group badge on every node;
  - a split badge «3+4» for the declared shared element;
  - the legend;
- **(3) a comparison.** I read the natural image group by group and checked each element against (2), in colour, in greyscale and in simulated deuteranopia/protanopia. The simulation uses the Machado et al. 2009 matrices at severity 1.0, applied in linear RGB.

I also report a fixed **geometry fact**, computed from the coordinates only: four elements are nearer to a node of another group than to any node of their own. The judgement on each element is visual.

| # | Element (true group) | Nearest own / nearest other (pt) | Normal colour vision | Greyscale | Deuteranopia sim. | Risk |
|---|---|---|---|---|---|---|
| 1 | الخذلان (العلاقات) | 171 / **67** (العزلة, الوحدة) | gold vs pink: resolved | line tracing only | yellow vs blue: resolved | **High** (coordinates) |
| 2 | المستقبل (الخوف) | 111 / **109** (الضغوط, العمل) | red vs green: resolved | the tree line to «فقدان السيطرة» | **red and green collapse** into one yellowish family | Medium (colour-vision deficiency) |
| 3 | المسؤولية (الأبوة) | 90 / **70** (من أنا؟, الهوية) | blue vs orange: resolved | its label sits on the side facing «الوعي» | blue vs yellow: resolved | Medium |
| 4 | الوعي (الصحة النفسية) | 106 / **70** (الثقة بالنفس, الهوية) | turquoise vs orange: resolved | tree line | pale vs yellow: resolved | Medium |
| 5 | القلق على الأبناء (الخوف + الأبوة) | 36 / — | dual cues clear | dual cue lost, two lines remain | yellow and blue halves: survives | Medium |

- **Resolved in AD-4:**
  - «المفترقات» and «بداية جديدة» (the AD-3 open items);
  - «العزلة», «من أنا؟» and «الثقة بالنفس», whose geometry is near-equal but where colour and relation trees settle it.
- **Main pattern:**
  - **Without colour, belonging rests on the relation trees, the titles and light concentration.** That works for compact groups and is weak exactly where the coordinates are adverse.
  - **Under red-green colour-vision deficiency, work and fear become one colour family.** They stay apart by space (about 110 pt) and by their trees.
  - The decorative latent clouds can share a group's hue (for example the violet cloud above decisions). They hold no element, so they cannot cause an element to be misread.
- **This is my own design review.** It is not proof of real-user success, and no user was tested.

## 5. Still open (not decided here)
- **«الخذلان»:** proximity cannot be beaten by paint. The PO can accept it as a property of this synthetic data, or ask for an explicit belonging marker, which would be a new visual element needing a decision.
- **Greyscale and colour-vision deficiency:**
  - the dual cue for the shared element is colour-based;
  - a non-colour cue (for example ring shape or texture pattern) was not added in this round.
- **Interleaved colour** in meeting zones reads as fine "two-colour grain". It is deliberate, but it could look speckled to some viewers.
- **Title moves are presentation.** In a product they need a defined source (PT-02 / PT-13).
- **More two-line names** (3 instead of 1): the form was approved in principle; the PO decides on the count.

## 6. Not done (as instructed)
- No V-3, branch, PR, engine change, contract change, IA change or Replay.
- No change to analysis data, coordinates or relations.
- No new style, no extra light, no rings and no fog.

**Stopping at the visual review. The design is not self-approved.**

---
**Corrections (2026-11-09, found during the IA-GATE study):**
1. **The knockout was not drawn.** As in AD-3, the glyph knockout `strokeText` loop was inside a comment, so AD-4 names have only the soft dark halo and shadow, not a knockout. AD-4 was not re-rendered. The fix exists only in `IA-GATE/proto/web.js`.
2. **Annex correction.** `AD4_PT10_PT13_ANNEX.md` §3 says MID is "a single-Thread zoom" and that a Reading bound in several Threads is "not drawn". The repository says otherwise:
   - MID is one ×8 camera step, and the THREAD rung carries appearances for **all** Threads. Only 0–2 Homes fit on a phone screen at MID by geometry; no rule limits it to one Thread.
   - A Reading in several Threads **is** drawn today as several appearances, each on its own host's ring with its own tether, plus a chooser ("This appears in more than one place"). Only a **link** between the copies is undrawn (PT-03).

   The IA decision report (`IA-GATE/IA_DECISION_REPORT.md`) uses the corrected facts.
