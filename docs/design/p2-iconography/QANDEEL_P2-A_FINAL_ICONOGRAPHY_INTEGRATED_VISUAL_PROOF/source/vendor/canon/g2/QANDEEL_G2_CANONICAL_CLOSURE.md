# QANDEEL — I-08B3.1-G2
## Living Analysis + Product Composition — Parent Canonical Closure

**Status:** `I-08B3.1-G2 — CLOSED / FROZEN AS LIVING ANALYSIS + PRODUCT COMPOSITION INTEGRATION PROOF`

**Closes:** the G2 parent over `I-08B3.1-G2.1`, `I-08B3.1-G2.2` and `I-08B3.1-G2.3`  
**Canonical baseline:** `a55af616fbde646bcaa4fcc01b63c78a6e5bc089` — the merge of PR #266, which closed G2.3  
**G3 handoff:** `docs/design/i-08b3.1-g2/QANDEEL_G3_READINESS_HANDOFF.md`

---

## A. Status

> `I-08B3.1-G2 — CLOSED / FROZEN AS LIVING ANALYSIS + PRODUCT COMPOSITION INTEGRATION PROOF`

This record closes the G2 parent after the Product Owner and independent review accepted the
G2.1 → G2.3 direction. It freezes the Product laws in §C–§F and nothing else. The proofs' visual craft
remains evidence; only those laws become canonical Product contract.

It claims no production implementation. No G2 package changed production code. The Skia / Reanimated
port of the I-08B1 world remains open, as I-08B1's own closure states. Production `ReturnControls`
does not yet implement the compact grouping (T-11 amendment §7).

It reopens nothing it consumed:
- the design records I-08B1, G1.1, G1.2, G2.3 and its T-11 amendment;
- the frozen contracts T-04, T-08, T-10, T-11 and T-12;
- the Replay runtime (`I-06`) and the Matching / Introduction runtime (`I-07`).

F2 is the one narrower case. G2 supersedes F2's general follow-system presentation for the Living
Analysis World on the Analysis surface, and nowhere else (§F). F2 is not reopened globally and stays the
general appearance authority.

`I-08B3.1-G2` is a design-track identifier, not Connected Worlds phase `I-08`. That phase owns:
- the mobile Matching UI;
- the final visual proposal experience;
- navigation surfaces.

That ownership is recorded in `docs/matching-introduction-runtime-v1.md` §11 and §24 and in the
backlog's I-07 closure record. This record neither starts nor closes that phase. §D records the
Product laws its surfaces must honor.

### What G2 does not claim

- a final Replay player or editor; the Product Analysis Replay surface remains `QAN-BL-NAV-02`;
- durable Personal call audio, which remains `QAN-BL-VOICE-01`;
- final Matching onboarding;
- final Introduction screen design;
- final notification choreography;
- production implementation of compact Return grouping;
- a universal Return dominance ranking beyond the reviewed contexts;
- a Light repaint of the Living Analysis World;
- a long-term / heavy-history density solution;
- any closure of the F1 / F2 North Star carry-forward, which stays open and owned by G, as F2 recorded
  it.

---

## B. Evidence chain

| Record | Identity | Role in G2 |
|---|---|---|
| G2.1 — Analysis screen composition | `I-08B3.1-G2.1-ANALYSIS-SCREEN-COMPOSITION.zip`, 152,034,307 B, SHA-256 `7183ED66B313080ADC4545D23CC623DCEA2BC20D4001928B0731ED0F3EE888E0` | composed the Analysis around the canonical world: the world as the screen, words at its edges, the Timeline, Inspection, Live Call, Replay placement, Matching outside the world, the Mutual-Match birth |
| G2.2 — Matching process refinement | `I-08B3.1-G2.2-MATCHING-PROCESS-REFINEMENT.zip`, 6,479,082 B, SHA-256 `887DECEFBCE86C33BE768CE05551BC9F7158E8A6EE3116B554D2C37D139451C7` | built the Product Owner's decisions D1–D5: the phone window, the compact Return direction, the completed Q mark, two distinct Mutual-Match moments, one dark Analysis under system Light |
| G2.3 — Matching copy + Return amendment | `I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT.zip`, 4,308,615 B, SHA-256 `12CCA79C35D74DA8BC951B87B4827029AA50B2D4EB8FCA050934A46C4077C370` | integrated the exact Matching copy; proved the compact Return presentation |
| G2.3 canonical closure | PR #266, merged to `main` as `a55af616fbde646bcaa4fcc01b63c78a6e5bc089` | `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` and `docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md` |
| Living Analysis source | `docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html`, SHA-256 `4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413` | the one world every G2 package loads; unchanged at the baseline |
| Preserved final proof build | `docs/design/canonical-artifacts/product-proofs/g2/g2.3/prototype/index.html`, 1,308,967 B, SHA-256 `F0B11310AC9561BC7C14F3DFA2864EB450B78D02D9ADB6E747BA1D56B9680BEC` | the final effective G2 proof artifact, preserved byte-exact from the G2.3 archive with its manifest and README |

**Where the packages live.** The three sealed review archives stay local, in
`E:\QANDEEL\QANDEEL PROJECT\design-workshops\`, following the canonical artifact index's convention:
none is in Git, and each SHA-256 is its identity.

**The preserved final proof artifact.** The minimum reusable G2 proof build is in the repository at
`docs/design/canonical-artifacts/product-proofs/g2/`. Its original build inputs were never sealed and are therefore not promoted as canonical source; that limitation is recorded in `SOURCE-PROVENANCE.md`.
- **What it holds:** the G2.3 build, which is the final effective proof, with its manifest and README,
  byte-exact from the sealed G2.3 archive.
- **What it leaves out:** G2.1 and G2.2 contribute no file, because the G2.3 build supersedes their
  builds and source.
- **Its record:** `SOURCE-PROVENANCE.md` there records what was admitted, what stayed in the archives
  and why.

**Their lifecycle.** Each package, and the preserved copy of G2.3's files, keeps its own
review-candidate wording. This record is their lifecycle authority.

---

## C. Frozen Product composition

These laws bind the Analysis surface.

1. **The Living Analysis World is the hero of the Analysis surface.** It is the screen, and everything
   else is support around it (T-11 §3: the world is sized first, at no less than half).
2. **The world is reused, not recreated.** The Analysis shows the canonical I-08B1 source (§B) byte for
   byte. G2 changed no pixel of it, and I-08B1's reopen rule still binds.
3. **FAR, MID and NEAR are semantic / spatial zoom states, never Product controls.** Zoom is distance.
   No FAR / MID / NEAR tab, button, label or indicator exists in the chrome.
4. **One continuous place.** Pan, pinch and semantic zoom move through one world. The finger is 1:1
   and nothing teleports (T-10).
5. **The phone window is accepted.**
   - A phone is a full-height window onto the world at one constant scale.
   - A larger phone therefore shows more of the same world, never the same world larger (T-11).
   - At FAR, a 390-point phone shows about 26 % of the world's width and pans for the rest.
   - The Product Owner accepted this; it is not a G2 blocker.
6. **The Timeline stays present and subordinate at the bottom of the Analysis, below the world.** Its
   order relative to the orientation band is set out in §E.
7. **Orientation and Return are contextual support around the world, never an analytical dashboard.**
   - T-08 decides what is offered and what each act means.
   - An empty offered set renders no Return group at all.
   - A permanent control matrix is the toolbar T-08 §6 forbids.
8. **Writing and Voice Note are Conversation-first. Live Call is Analysis-first when it starts.**
   - During an active Live Call, opening «المحادثة» does not end the call.
   - Returning to «تحليل المحادثة» returns to the same call (G1.1 §1; G1.2 §1).
9. **Replay is a quiet action derived from the current Conversation / Analysis context, not a World or
   a tab** (G1.1 §1; Replay runtime §1: "A Replay is **not** a World").
10. **Matching is a QANDEEL-mediated Product doorway outside the world's geography:** §D.
11. **The Living Analysis World remains the same dark immersive world in both system appearances; surrounding shell treatment remains open:** §F.

---

## D. Matching

**Copy authority.** `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` §1–§2 owns:
- the exact Arabic opening;
- the exact QANDEEL-view / privacy copy.

This record does not restate, paraphrase or translate that copy. The same closure's copy-only
clarification (§2) stands unchanged: the reassurance sentence about agreement and difference creates no
capability, architecture requirement, consent mechanism, data flow or backlog item.

**Frozen Product laws.**

- **Matching is a QANDEEL-initiated Product moment outside semantic-world geography.**
  - A proposal is not a World (Matching runtime §1).
  - No candidate or proposal becomes a planet or an object in the Personal Analysis World. The world's
    objects and relations are the same with and without a proposal.
- **Nothing is ranked or exposed.** None of the following appears (G2.3 §1–§2):
  - a compatibility score, percentage or ranking;
  - a candidate feed;
  - a required candidate photo;
  - private reasoning;
  - raw `MY_WORLD` evidence;
  - before the Introduction begins, any specific agreement, disagreement, similarity, trait or reason.
- **Mutual Match creates exactly one `SHARED_WORLD / INTRODUCTION`** (`I-07C`). `INTRODUCTION` is a
  Shared World phase, not a World type. The new World belongs to «العالم المشترك» (G1.2 §3).
- **The process is G2.3 §3's, inherited from G2.2:**
  1. Analysis attention;
  2. private proposal;
  3. first-accepter acknowledgement;
  4. neutral unavailable state;
  5. second-accepter Mutual Match;
  6. first-accepter later arrival;
  7. Shared World / `INTRODUCTION` handoff.
- **The two Mutual-Match presentations stay temporally distinct** (G2.3 §3).
  - For the second accepter, their acceptance converges with the Mutual Match and the Shared World /
    Introduction birth.
  - For the first accepter, a later Match is a truthful arrival into a Shared World that already exists.
    The Product does not replay a fake acceptance moment.
- **Nothing private crosses into the new World.** The handoff carries neither the pre-Match proposal nor
  private Matching reasoning (G2.3 §3).

---

## E. Return / Orientation

**Presentation authority.** Compact Return / Orientation follows two records, which this record
references and does not restate or change:
- `docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md`;
- G2.3 closure §4.

**T-08 semantics are untouched.** G2 does not amend any of T-08's:
- six Return meanings;
- offered-set derivation;
- canonical order;
- labels;
- hints;
- executors.

Neither the G2.3 amendment nor this record changes any of them.

**Reviewed contexts only.** The evidence is the reviewed P3 and P4 contexts. G2 claims no universal
Return dominance ranking beyond them (G2.3 §4; amendment §3).

**Placement boundary (G2.1 seam S-04).** Two frozen compositions remain in force, and G2 does not amend
either:
- T-11's column `[world, temporal surface, chrome]`, with the world sized first (T-11 §3);
- T-12's final composition (T-12 §5).

Every G2 proof placed contextual orientation directly **above** the Timeline, over a world that runs
behind the chrome. That reverses the frozen order and is proof evidence only. An implementation may
adopt it only through a controlled T-11 / T-12 amendment. The G2.3 amendment is not one: it changes
T-11 §4, §10 and §14 only.

---

## F. Dark / Light

> **The Living Analysis World remains the same dark immersive world in both system appearances.**

That law is about the **Living Analysis World**, the immersive world surface of the Analysis. It is all
that G2 freezes about appearance.

### General F2 rule

F2 (`CLOSED / FROZEN`) remains the general Product appearance authority:

> **Default appearance follows the system.**

F2 records it as `qandeel.appearance.system-appearance` = `follow-system-no-in-app-override`, in
`docs/design/canonical-artifacts/accessibility-appearance/i-08b3.1-f2r/tokens/base/appearance.tokens.json`.
No user-facing QANDEEL appearance override is introduced here.

### Later G2 scoped supersession

G2 supersedes that general presentation behavior **only for the Living Analysis World on the Analysis
surface**:

> The Living Analysis World remains the same dark immersive world under both system Dark Mode and system
> Light Mode.

Under both, it keeps the same:
- world darkness and atmosphere;
- visible world appearance;
- QANDEEL Meaning Light morphology;
- QANDEEL Meaning Light motion;
- Living Brass behavior.

There is no Light repaint of the Living Analysis World, no pale Light veil over it and no
appearance-dependent world redesign. G2.2 measured the Living Analysis rendering at a 0 px difference between the two
system appearances, still and in motion.

This is the Product Owner's decision (G2.2, D5) about the spectacle F2 left "OWNED BY G". It is a
**surface-scoped Product exception, not an app-wide appearance override.** It does not:
- reopen F2 globally;
- change any F2 token;
- create an app-wide dark mode;
- create a user appearance toggle;
- decide Q-LIGHT-SHELL.

### Q-LIGHT-SHELL remains open

While the Analysis is open, does the surrounding Product shell stay dark with the Analysis surface, or
follow the system appearance? This record does not decide it. It claims no frozen dark treatment for:
- the rest of the Analysis screen;
- the status region;
- the rail;
- the call chrome.

G2.2's proof shows one answer. That answer is evidence, not a decision.

---

## G. Non-blocking carry-forward

These remain open. None keeps G2 open, and none is decided here. They are the same ten items G2.3 §6
recorded.

| # | Item | State |
|---|---|---|
| 1 | Cue action label (current «ليه؟») | proof-only |
| 2 | First-accepter acknowledgement copy | proof-only |
| 3 | Neutral unavailable copy | proof-only |
| 4 | Second-accepter explanatory copy | proof-only |
| 5 | Later-arrival copy | proof-only |
| 6 | Shared World welcome copy | proof-only |
| 7 | Q-LIGHT-SHELL: whether shell chrome outside the Analysis world stays dark or follows the system appearance | open Product decision (§F) |
| 8 | HEAVY-HISTORY / LONG-TERM WORLD DENSITY + LOD STRESS PROOF | future stress proof |
| 9 | Final Introduction screen design | later Product work |
| 10 | Production implementation of compact Return grouping | implementation work, not a Product-proof blocker |

**Backlog reconciliation (BG-08).** The canonical backlog was read in full at the baseline.
- **Inherited and tombstoned: none.** No item names G2 as its Owner task.
- **Admitted: none.** The ten items above are Product-proof boundaries. None qualifies under any of
  BG-06's routes, as G2.3 §6 recorded for the same list.
- **Adjacent concerns already have owners:**
  - `QAN-BL-NAV-02`: the Product Analysis Replay surface;
  - `QAN-BL-VOICE-01`: the Personal Voice / Live Call runtime and durable audio;
  - Connected Worlds `I-08`: the mobile Matching and Introduction surfaces.

**Seams held by other owners.** The G2.1–G2.3 packages also record questions that belong elsewhere.
- **Their owners:** T-04, T-08, the VI-01 copy pass, the native port and the Matching / Introduction
  runtime.
- **An example:** a one-act inspection journey offers Back and Exact Return to the same checkpoint.
- **Their status:** they stay with those owners, and this record neither answers nor reopens them. The
  G3 handoff lists the ones G3 will meet.

---

## H. Closure

G2's closure rests on four things:
- its Product laws are frozen in §C–§F;
- its evidence is identified by hash;
- its open items are carried forward without keeping it open;
- no frozen owner is reopened.

> **I-08B3.1-G2 — CLOSED / FROZEN**

> G3 may proceed without reopening G2 unless a genuine contradiction is discovered.
