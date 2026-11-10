# AD-4 Annex: PT-10 / PT-13, from a synthetic composition to real Personal data

**Status:** analysis only. This annex makes no IA change, no contract change and no implementation, and it decides nothing for the Product Owner.

**Sources:**
- `V1_V2_ANALYSIS_REPORT.md` §2–§3 (what the Personal wire carries);
- `PRODUCT_TRACK_CANDIDATES.md` (PT-01 … PT-13);
- the AD-4 mechanisms in `AD4_REVIEW.md` §2.

**Ground rule (PO):** never infer membership from Home proximity or from background or latent colour.

## 1. What paint and display organisation can do with no membership data
- **The data-free world.** This covers the latent web, world lights, coloured darkness and stars. It is byte-identical with or without data in AD-2, AD-3 and AD-4, so it needs no membership.
- **Per-element light and tiers.**
  - Hub vs element is the only tier, and the Personal wire has it: Thread Home vs Reading appearance on the Home's ring.
  - Within a tier, size and strength come from a hash of the position, never from rank (I-08B1).
- **Label discipline.** Placement beside the own node, absolute belonging, a distance cap, the two-line form and a light knockout all use only the node and its name.
- **Relation styling of relations that exist.** This includes curves, fading, light deposited into the world, and veins and lit areas along a relation.
- **What paint alone cannot do.** It cannot say which elements form one *topic*. Every grouping cue in AD-3 and AD-4 needs that:
  - the cohesion field, interleaved meeting zones and neutral transitions;
  - the internal vs cross class of a relation;
  - name tint, title placement at the group centre, and label orientation toward the group;
  - the dual-belonging cues.
  Without membership, these cues would be guesses. A guess from proximity or colour is exactly what the PO rejected.

## 2. What needs explicit membership data (PT-13)
- For each element, **the topic group or groups it belongs to**, including **declared shared membership**: the «القلق على الأبناء» case.
- For each group:
  - a **title** (PT-02 for Thread names; PT-01 for domains);
  - an **identity colour**, if colour is to carry the group. That conflicts with the LA-VIS-01 law "a colour here means nothing" (PT-06), so it needs a decision. Colour must not be the only carrier in any case (D-3).
- **A relation's class** (internal or cross) follows from membership. It needs no extra field, but it is only as true as the membership.
- **Provenance:**
  - who assigns membership (model, user, rule);
  - when it may change;
  - how a change animates without implying that the data moved.
  Membership must stay user-scoped and provenance-aware, like memory.

## 3. Can today's Thread and Reading be used, without assuming Thread = life domain?
**Yes, in a limited and honest form.** Read AD-4's "group" as **one Thread's own constellation**: its Home plus the Readings that appear on its ring. Do not read it as a life domain such as «العمل» or «الخوف».

| AD-4 cue | Thread-based reading | Available today? |
|---|---|---|
| Group = a set of elements | A Thread Home and its Reading appearances | **Yes.** On the wire at MID and NEAR, as explicit structure, not proximity |
| Internal relations | Home → appearance tethers | **Yes** |
| Shared membership | The **same Reading bound in several Threads** | On the wire at Thread depth (MID/NEAR), but **not drawn**. Drawing it as a dual belonging or a link is **PT-03** (a MapCanvas "tethers only" rule amendment) |
| Group title | A Thread name | **No.** Threads carry no name on the wire (**PT-02**) |
| Group colour | LA-VIS-01 address chroma | Colour exists but means place, not group (**PT-06** if it should mean group) |
| Several groups visible together, each with its elements | The AD-4 overview | **No.** FAR discloses Threads only (no appearances), and MID is a single-Thread zoom (×8) with neighbours off-glass (**PT-08**) |

**Consequences:**
- Per-Thread cohesion cues (veins and lit area along tethers, label discipline) are paint over facts that already exist.
- **The AD-4 composition itself cannot appear with today's disclosure.** That composition is many topics, their elements and their overlaps in one view. Today the product never shows several Threads *with* their Readings at once.
- **A Thread is not a life domain.** Several Threads may concern the same domain, and one Thread may span several. Using "group = Thread" means the map shows **conversation threads**, not **topics of life**.
  - The synthetic titles in the mock (العمل، الخوف …) are domain names.
  - They would not exist under a Thread reading.

## 4. Decisions needed before applying this design to real user data
1. **What a "topic group" is in Personal.** Choose one:
   - **(a)** the Thread itself: no new analysis, but no names and no overview today;
   - **(b)** a new semantic layer of domains above Threads: PT-01, a new server derivation, wire field, disclosure rung, privacy review and model cost;
   - **(c)** keep Personal ungrouped: paint only, per §1.
2. **Shared membership.** Whether a Reading bound in two Threads (or an element in two domains) is drawn as a deliberate dual belonging, and at which zoom (PT-03, PT-08).
3. **Names.** Who names a group, in which language, and when a name may change (PT-02, Copy Gate).
4. **Colour meaning.** Whether colour may carry group identity (PT-06, against LA-VIS-01), and which non-colour carrier backs it (D-3). The AD-4 review shows that greyscale belonging rests on relation trees, titles and light. Under red-green deficiency, two of the mock's hues merge.
5. **The zoom ladder.** Whether an overview may show several groups with their elements at once (PT-08). Without it, the AD-4 composition has no product state to live in.
6. **Membership provenance and change** (PT-13): who assigns it, how it is audited, and how a change is shown without moving Homes. Home coordinates never move.

**Until these are decided, AD-4 stays a synthetic study.**
- Its grouping cues must not be fed by Home proximity or latent colour.
- Its latent world remains decoration that hosts no element.
