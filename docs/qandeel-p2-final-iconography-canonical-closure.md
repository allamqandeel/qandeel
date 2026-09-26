# QANDEEL — P2 Final Iconography System
## Canonical Product / Design Closure and Controlled Amendments

> **Status: `P2 — CLOSED / FROZEN — FINAL ICONOGRAPHY SYSTEM`**

| | |
|---|---|
| Roadmap track | `P2 — Final Iconography System` ([`QANDEEL_PRODUCT_ROADMAP.md`](../QANDEEL_PRODUCT_ROADMAP.md) §2) |
| Canonical baseline | `613735d7fbb1d2467756a85cadbcd68b83579ed1`, the merge of PR #273 (P2-A) |
| Evidence | the merged P2-A package, [`docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/`](design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/P2_READ_FIRST.md). At the baseline its Git tree is `b901b8c9851ff68b047b15d35795169e3277d35c`: 165 files, `MANIFEST.json` plus the 164 entries it lists by bytes and SHA-256 |
| Review provenance | the P2-A reviewed branch head was `afbef78f710c40a238e1b58cedd0726af8040c7a`; its review ZIP (local, not in Git) is 30,428,394 B, SHA-256 `38D471C02A79E8D01E334E571F97ADDD8A689E6AB9D8BEBA97F41ACE3DF77F38`. The ZIP is provenance only. The unpacked package on `main` is the repository evidence, and no reader needs the ZIP |
| Decision source | the Product Owner's selections, accepted after independent review of P2-A. This record takes no Product decision of its own |
| Authority class | later, additive Product / design authority. It narrowly amends named statements of earlier frozen records (§13) and rewrites none of them |
| Lifecycle effect | the state above is the one this closing change encodes. It binds on the merge of the pull request that carries it, after independent review. This record carries no review or merge status of its own |
| Implementation | **none.** No mobile code, component, dependency, runtime or native change is created, changed or authorized (§14) |

Historical records keep their bytes, and so does the P2-A package: its own "P2 NOT CLOSED / NOT FROZEN" wording is
superseded by this record, not edited. Where this record supersedes an earlier statement, §13 names it. Everything not
named there stays in force.

---

## 1. Scope

P2 closes the roadmap's second Product decision track: the final iconography of the frozen Product. It freezes:

1. the Hybrid QANDEEL Icon System (§3);
2. the signature geometry, N1 "Open" (§4);
3. the persistent navigation family and its presentation (§5);
4. the Call Rail, A "Keyed Seam", with End Call at 27 px (§6);
5. the Temporal Spine + Aperture, C "Parting" (§7);
6. the utility sourcing rule, Hugeicons Free as the curated source (§8);
7. the motion language, Calm State Morphing (§9);
8. the P2 application of the existing RTL and accessibility rules (§10).

It freezes **geometry, morphology and presentation**. It creates no Product semantics, no navigation destination, no
temporal behaviour, no status colour and no runtime.

**How geometry is frozen: by reference.** This record does not restate a second geometry specification. The frozen
geometry is the geometry in the merged P2-A package:

| Frozen material | Where it lives in the package |
|---|---|
| construction rules | `docs/P2_ICON_GEOMETRY_SPEC.md` |
| signature glyph drawings (N1 "Open") | `source/src/sig.mjs`, which generates every glyph as a pure function of nuance and size |
| Call Rail A art; End Call render size | `source/src/machines.mjs` (`RAIL_RECOMMENDED`, `END_GLYPH_PX = 27`) |
| Temporal Spine C drawing | `source/src/app.js` (the P2-A Temporal Spine block), `source/src/machines.mjs` (`SPINE_RECOMMENDED`) |
| curated utility drawings and their normalisation | `source/vendor/utility/` (with `LICENSE-hugeicons.txt`), `source/src/utility.mjs` |
| visual reference | boards `01`, `02`, `03`, `05`, `07`, `16`; clips `M01`–`M07` with their Reduced Motion counterparts |
| deterministic proof data | `data/CHECKS.json` (25 / 25 pass, 9 / 9 planted defects rejected), `data/END_CALL_STUDY.json`, `data/SHOTS.json`, `data/NAV_MATERIAL.json`, `MANIFEST.json` |

The comparison variants in the same package — Call Rail B and C, Spine A and B, nuance N2, the other four utility
libraries — are **comparison evidence only**. They are not open alternatives.

---

## 2. What the P2-A evidence proves, and what it does not

P2-A proved the system inside the real accepted Product: a fork of the frozen G3.2 proof, with its world, Conversation,
Live Call, Timeline, PINNED states, both appearances and three phone sizes. Its checks and findings are browser
evidence. Device assistive technology, device Reduce Motion and Increase Contrast, CallKit / Telecom and real touch
latency were not proved there, and are implementation / device gates (§14).

---

## 3. Accepted system architecture — the Hybrid QANDEEL Icon System

Three conceptual layers:

1. **QANDEEL Signature Geometry.** A small, custom-owned family for the identity-bearing Product controls: the three
   world navigation glyphs, the Analysis entry (`depth`), Replay, the Live Call and Voice family (mic / muted, route,
   End Call, call), send and the voice-message transport, plus the two machines, the Call Rail and the Temporal Spine
   + Aperture (P2-A geometry spec §8).
2. **Curated Utility Source.** Mundane utility symbols (close, back, chevrons, settings, overflow, edit, add, search)
   are sourced from a compatible open-source family and normalised to QANDEEL (§8).
3. **QANDEEL Motion Layer.** Restrained state continuity and morphing where useful (§9). It is not a generic
   animated-icon identity pack.

P2 does not redraw every generic UI symbol.

---

## 4. Signature geometry — N1 "Open"

**Frozen:** the N1 "Open" geometry exactly as `source/src/sig.mjs` generates it, under the rules of
`docs/P2_ICON_GEOMETRY_SPEC.md`. Its characteristics, as that specification states them:

- the Open Geometry Hybrid on a 24-unit grid with a 2-unit optical margin;
- **round terminals** and round joins;
- the QANDEEL cut: at most one opening per ring, at 45°, the canonical Q's opening used as a grammar and never the Q
  itself;
- optical, not mathematical, stroke weight per render size, with solid anchors only where they carry meaning (a
  world's point of light, the media transport, a toggle's ON body, End Call);
- controlled openings and negative space; no decorative gap;
- strictly 2D, frontal and flat: one perspective and one level of detail across the family;
- familiar semantics stay recognisable (microphone, handset, speaker, replay, send);
- optical correction is allowed where the specification says so (the stroke table; the solid End Call scaled
  without re-weighting).

This discharges, for the P2 family, C3's consistency obligation (`C3_ICONOGRAPHY_MATERIAL_CONTRACT.md` §7.2): one
size system, one level of detail, one stroke rule and one perspective.

---

## 5. Persistent navigation family

**Frozen:**

- the QANDEEL-owned navigation glyph family (`navMine`, `navShared`, `navPublic`) in N1 geometry;
- the glyph sits **above the destination word**. The word stays, and it names the control: the glyph never replaces
  the destination name;
- Living Brass stays governed by C3: the navigation family is `qandeel.navigation.machinery`, one material for the
  family, identical at every state (C3 §2A, §6). P2-A measured the glyphs byte-identical across states (K18);
- interaction state is **never** carried by Brass. It is carried by E1R's channels: the ground for PRESSED, the
  detached perimeter for FOCUS, the marker and word weight for SELECTED, one availability ink for DISABLED.

P2 freezes the geometry and presentation it adds. Destination names, destinations and the information architecture
are unchanged (I-08A4, G1.1, G1.2 §3, P1).

---

## 6. Call Rail — A "Keyed Seam"

> **Call Rail A — "Keyed Seam"**

**Frozen:**

- **one machine.** Mic and the audio route are one related plate. End Call is the separated terminal of the same
  machine, cut away along a parallel seam, at the END edge in both scripts;
- **End Call glyph at a nominal 27 px inside the unchanged 44 pt target.** It is the same solid handset scaled, with
  no stroke re-weighting. P2-A measured 24 / 26 / 27 / 28 px against seven criteria fixed beforehand; 27 px meets
  them all (`data/END_CALL_STUDY.json`, board 16, check K25). Mic and Route stay at 24 px;
- **neutral functional material by default.** Mic and Route in rest ink; End Call in primary ink, the family's one
  solid call mark; the rail art a neutral hairline;
- **End Call's hierarchy comes from geometry, position, separation, terminal form and optical presence,** never from a
  mandatory red. No destructive or error colour rule is frozen by P2. E1R's error ink stays retrospective and grants
  nothing to End Call;
- no Brass because a control is important (C3 §2B); no decorative Q or logo in the controls;
- no generic row of circular buttons, and no full generic pill;
- mute and route state stay understandable **by form**, not colour alone: Mute is the slash plus a cut through the
  microphone; Route is the body fill plus the wave count.

The call surfaces, their behaviour and their copy remain G1.2's (§13.1). P2 changes only the drawing and
arrangement of the controls inside the existing 64 pt call line.

---

## 7. Temporal Spine + Aperture — C "Parting"

> **Temporal Spine + Aperture C — "Parting"**

**Frozen as the final P2 visual morphology:**

- a quiet temporal spine: a neutral hairline carrying one notch per disclosed Moment;
- the aperture is the spine itself opening locally at the Moment; nothing floats on the line;
- the preview is a lighter, less committed opening than the committed one, and carries no committed mark;
- a separate **Live Edge terminal** — a stop and the present as its own line — that shares no form with a Moment and
  cannot be confused with one;
- Return Live stays in its one canonical home at the Live edge, with its words (G3 T-11 / T-12 amendment §2);
- no generic detached slider thumb;
- no fake waveform, and no variation that encodes importance, emotion, confidence or energy;
- no ghost or interpolated historical truth: apertures appear and close in place;
- no repeating Live pulse as semantic truth.

**Visual morphology only.** Every temporal semantic stays with its owner, unchanged:

- T-05's 48 React Native layout pixels per committed Moment and the 44-pixel interaction rail;
- T-06's `FOLLOW_LIVE` / `PINNED(t)`, the separate lossless preview, direct 1:1 scrub, commit on a completed act and
  lossless cancel;
- `Moment(LH) ≠ Live Edge`: committing the newest Moment gives `PINNED(LH)`, never Live;
- T-05 / T-06 / T-08 disclosure rules;
- T-06's one logical RTL mirror rule, with no second mirror (T-11);
- the T-06 / T-10 Reduced Motion truth.

The exact aperture dimensions, notch length, terminal line length and discontinuity mark are what P2-A itself classed
them as: reference craft values, not Product law (P2-A Spine proof §5).

---

## 8. Utility family — the sourcing rule

**Frozen as a Product / design sourcing rule, not a runtime dependency:**

- **Hugeicons Free** is the preferred curated source / reference for mundane utility glyphs;
- no Hugeicons Pro or paid asset path is authorized by P2;
- no runtime Hugeicons package is adopted by P2;
- Lucide remains a benchmark, not the selected source;
- every utility glyph is optically normalised to the P2 geometry system: the same optical stroke per size, round
  terminals, and the same renderer as the signature family.

The evolving Hugeicons catalogue is **not** QANDEEL authority. Only curated geometry actually adopted in QANDEEL, and
normalised, becomes QANDEEL design material. Today that is the Hugeicons Free drawings the proof's Product screens
render through `source/src/utility.mjs`; the other libraries' entries in `utility-glyphs.json` are comparison evidence.
Adopting a new utility glyph is curation under this rule, carried with its MIT notice.

---

## 9. Motion — Calm State Morphing

**Frozen as motion language:**

- calm state morphing and continuity where useful: Mute draws its slash and cuts the microphone together; Route fills
  its body and draws its wave; the aperture opens and closes in place;
- no bounce as a default language. The only settle is the single commit acknowledgement the temporal contract already
  defines (T-06 M2), after a finger commit;
- no decorative looping;
- no semantic pulse; a still state stays still;
- direct manipulation stays immediate and 1:1 under the finger;
- state motion reinforces a truthful state change and never invents Product truth;
- Reduced Motion preserves the same semantic state: movement, travel and settle go; the truth, the stance and the
  offered acts do not.

**Not frozen: timing constants.** P2-A's durations are T-06 / T-10 values plus 180 ms toggles, and P2-A itself calls
them "craft, not Product law". They remain reviewed evidence and implementation reference. Only values an earlier
frozen motion contract already freezes keep that status, under that contract. Feel is judged on a device.

---

## 10. RTL and accessibility — the P2 application

P2 applies existing authority. It creates no competing accessibility or direction contract.

- **Direction by meaning, not naïve whole-set flipping** (C3 §7.1; P2-A geometry spec §7):
  - directional utility glyphs such as the back chevron mirror by meaning;
  - media, call, world, identity and send glyphs never mirror merely because the locale is RTL;
  - the Call Rail art follows layout direction (End Call at the END edge);
  - the Temporal Spine follows T-06's one logical mirror rule.
- **Icon-only controls carry truthful accessible names,** using the existing action labels (G1.2 R1).
- **Decorative glyphs are hidden from the accessibility tree** where the control owns the name. Navigation glyphs are
  decorative; the words name the controls.
- **State never relies on colour alone** (F1R2; E1R; C3 §2C). Toggles expose their pressed state and change form.
- **Focus stays perceivable** under the existing E1R detached perimeter and F1R2's Increase Contrast rule.
- **The 44 pt minimum target obligation stays.** A glyph never grows to meet its target; the target is the control's
  box.
- The Live terminal keeps its words: it is never icon-only (T-12).

---

## 11. Explicit non-scope

P2 does **not** freeze:

- a Voice provider, realtime transport, native iOS / Android call stack or durable audio source;
- real speaking detection, or a Speaking Indicator (§11.1);
- call-history media representation;
- the broader final Voice visual language beyond the accepted call controls;
- G1.2's audio strip / waveform / activity morphology as a general Voice system;
- notification Product realization, which is P3's next Product decision track;
- production React Native components, production dependency choices, `react-native-svg` adoption, or any icon-package
  runtime dependency;
- Skia adoption or any Skia / Reanimated version pairing;
- a platform-specific animation mechanism;
- new Product navigation destinations or entry placements;
- temporal semantics;
- new status colours.

P2-A's conservative Skia statement stands: the repository's exact Skia / Reanimated pairing is not certified by P2-A,
P2-A does not rely on Skia, and future implementation and device validation own that integration choice.

**Placement is not iconography.** P2 supplies the glyph a control uses once it is placed. It does not place the
General Settings entry, the QANDEEL Understanding entry, the Activity entry or its badges, or decide the canonical Q's
presence on every screen (C3 §8). P2-A classed these `UNRESOLVED_BY_EXISTING_PRODUCT_AUTHORITY` and drew no glyph for
them. They belong to the shell and attention decisions the roadmap sequences next (P3 for Activity; the P4 census for
remaining placement), not to P2.

### 11.1 Speaking Indicator

- **No Speaking Indicator is frozen by P2.**
- **No fake speaking or activity signal is permitted.** P2-A removed the simulated microphone level the G1.2 / G3.2
  call line drew (F-P2-05).
- A truthful future speaking indicator requires real call / audio runtime truth.
- `QAN-BL-VOICE-01` already owns the missing Personal Voice / Live Call runtime and durable audio source, including
  "truthful microphone and route state". P2 creates **no duplicate backlog alias** for the indicator, and invents no
  future morphology for it.

---

## 12. P2-A findings — disposition

| Finding | Disposition |
|---|---|
| **F-P2-01** — the G3.2 proof truncated the Track at the pinned Moment | corrected inside the P2 proof toward frozen T-05 / T-06, which keep SP1…SP(LH) disclosed. **Closed** |
| **F-P2-02** — Return Live's hit region covered the Track's last Moments | corrected inside the proof harness by narrowing the hit region; box, label and focus ring unchanged. Production integration must preserve every Moment's reachability and keep Return Live's hit region from overlapping the Track. That is an implementation composition detail of existing T-05 / T-06 / T-12 law, **not a new Product semantic** (§14, §15) |
| **F-P2-03** — the floating Moment number collided with the Live label | resolved by not drawing the redundant number; the T-08 line and the accessible value carry it. **Closed** |
| **F-P2-04** — five visible Moments at 320 pt under the canonical pitch | the accepted consequence of T-05 ("Narrow widths show fewer steps"), not a defect. Older Moments stay reachable by the window, keyboard and navigator |
| **F-P2-05** — simulated microphone level | removed. No fake waveform (§11.1). **Closed** |
| **F-P2-06** — the press wash painted over the Brass glyph | corrected: PRESSED belongs to the ground, under the content. C3 state invariance preserved. **Closed** |
| **F-P2-07** — the first Shared / Public drawings read as faces | redrawn in the accepted geometry. **Closed** |

None is reopened as a design alternative.

---

## 13. Narrow precedence / supersession matrix

Each row names the older text, what it now reads as, and what stays in force. The older records are not edited.

### 13.1 G1.2 — Voice + Live Call

| Older statement | Now reads | Preserved |
|---|---|---|
| §6 "current small icon/glyph shapes" not frozen; "The current icons … are **PROOF ONLY — NOT A VISUAL FREEZE**" | still true of G1.2's own glyph shapes, which are not authority where P2 supersedes them. The final shapes are P2's (§4–§6) | G1.2 §1–§5 and §7 in full: the interaction model, the background contract, «العالم المشترك», no persistent normal-state prose, one assistive live-status channel, first-need microphone permission, the device gates |
| §6 "final iconography system" not frozen | **frozen by P2**, including the accepted call-control morphology, Call Rail A (§6) | — |
| §6 "current audio strip / waveform / activity morphology"; "final Voice visual language"; "The current … audio strip [is] PROOF ONLY" | **still not frozen.** P2 freezes no audio strip, waveform, activity morphology or broader Voice visual language, beyond the call controls themselves | every other §6 item |
| §4 normal call truth carried by "the call controls, elapsed continuity and the current proof activity treatment" | the proof's activity treatment was a simulated level and is removed (F-P2-05). Until a truthful signal exists (§11.1), normal call truth is carried by the controls, elapsed continuity and the assistive live-status channel | §4's prose rule and its one assistive channel |

### 13.2 C3 — Living Brass

| Older statement | Now reads | Preserved |
|---|---|---|
| §7 "**C3 freezes no icon geometry.** Not stroke weight, not corner treatment, not the glyph set, not sizes …" | still true of C3. P2 now supplies the final geometry and presentation of the accepted icon family | C3 is the material authority, unchanged: the permission classes (§2), the Brass permissions, the navigation family as one material, state invariance (§6), the counterexamples (§3) and the §5 admission test |
| §7.1 the RTL obligation "any future navigation icon set inherits" | discharged for the P2 family by direction by meaning (§10) | the obligation itself, for any later member |
| §7.2 the consistency obligation "passed to integration" | discharged for the P2 family (§4) | the obligation itself, for any later member |
| §8 the canonical Q's presence on every screen | **not answered by P2** (§11) | the open placement question |

### 13.3 E1R and F1R2 — interaction and accessibility

Unchanged. P2 consumes their state and accessibility semantics: PRESSED on the ground, FOCUS as the detached perimeter,
SELECTED as marker and weight, one availability ink, non-colour state, Increase Contrast and Reduced Motion. P2 adds
glyph geometry that cooperates with those channels and changes none of them.

### 13.4 T-05 / T-06 / T-07 / T-08, T-10, and the G3 temporal amendment

Their temporal semantics and geometry stay unchanged (§7). P2 supplies the accepted visible Temporal Spine, Aperture
and Live terminal morphology on top of them. The G3 T-11 / T-12 amendment's composition — world → temporal line →
Timeline → OrientationChrome, Return Live in its one home at the Live edge, the yield rule and 44 pt targets — is
unchanged.

### 13.5 G1.1, I-08A4 and P1 — navigation and shell

| Older statement | Now reads | Preserved |
|---|---|---|
| (no final navigation glyph existed) | the P2 navigation glyph family sits above the existing destination words (§5) | every name, destination and IA decision; the Global Switcher's three areas |
| P1 §16.1 "final icons" deferred | the icon system is now P2's | the placement of the General Settings and QANDEEL Understanding entries (§11); P1's other §16.1 items |

### 13.6 G3 — integrated Product coherence

G3's composition and its three decisions (§C, §D) remain authoritative. P2 supersedes only the proof craft of the G3.2
package where this record says so: its glyph shapes (`source/src/glyphs.mjs`, G1.1 → G1.2 → G3.2 lineage), its
circular End Call control and simulated call-line level, its 16 pt tick spacing (the canonical pitch is T-05's 48), its
Track truncation while PINNED (F-P2-01), its Return Live hit region (F-P2-02) and its press wash over Brass (F-P2-06).
No G3.2 byte is rewritten; the preserved package stays evidence.

### 13.7 Consumed unchanged

- I-08N-01, including its attention and disclosure semantics. A future badge is a status mark and is never Brass
  (C3 §2C).
- B4R surface roles and G1.1's `UTTERANCE`.
- F2's appearance tokens and P1 §12's appearance preference; the Analysis stays one dark place.
- The brand package (I-08B2.5), including the canonical Q.

---

## 14. Implementation and device carry-forward

**Nothing in this record is implemented by it.** Frozen Product / design is not production code. Today on `main` no
final icon exists in `apps/mobile/`, and no production component uses the P2 system.

The carry-forwards are implementation-owned detail beneath decisions frozen here, not Product questions:

1. the production vector / component port of the signature family, the machines and the curated utility subset;
2. no runtime icon package is chosen by P2;
3. `react-native-svg` is **not** authorized or adopted by this closure. P2-A names it as the one dependency a future
   task would need to approve;
4. Skia is neither required nor certified by P2;
5. the final platform rendering and animation mechanism is an implementation choice, constrained by P2's geometry and
   behaviour;
6. real-device VoiceOver / TalkBack, Reduce Motion, Increase Contrast (including the focus perimeter against the rail
   plate at 3 pt) and touch-latency validation remain implementation / release work;
7. F-P2-02 must be respected by the future temporal composition integration (§12);
8. a truthful speaking indicator depends on the future Voice runtime (§11.1);
9. P3 will apply the P2 icon system to notifications and Activity. P3 is **not** opened here.

A change to frozen P2 geometry or morphology — rather than device-driven implementation craft that keeps it — needs a
controlled change of this record.

Implementation follows the roadmap: the End-to-End Product Experience Completeness Audit, then Production Integration,
each through its own scoped Task Contract. This record authorizes none (roadmap §1 rule 2).

**P2 closes with no remaining Product Owner decision question inside its scope.**

---

## 15. Governance — BG-05, BG-08 and BG-09

**Kickoff (BG-05).** [`docs/qandeel-canonical-backlog-v1.md`](qandeel-canonical-backlog-v1.md) was read in full at the
baseline. No item names P2, iconography or any P2 task as its Owner task.

**Inherited: none.** The adjacent items are untouched and not claimed:

| Item | Why P2 does not touch it |
|---|---|
| `QAN-BL-VOICE-01` | stays `OPEN — UNASSIGNED`. P2 consumes its future truth for the Speaking Indicator and takes nothing from it |
| `QAN-BL-NAV-02` | the Replay surface. P2 draws the Replay glyph only |
| `QAN-BL-VIS-01` | the world is unchanged |
| `QAN-BL-NAV-01`, `OPEN-06`, `OPEN-08`, `OPEN-09`, `OPEN-19` | navigation and acknowledgement capabilities P2 neither implements nor blocks. P2 changes no temporal semantic |
| `QAN-BL-SEC-01` | stays `DEFERRED — OWNED` by `QAN-SEC-01` |
| `QAN-BL-CW-01` | stays open; P2 has no bearing on it |

**Admitted: none.** Each candidate residue was tested against BG-06's four admission routes, and none qualifies:

| Candidate | Why it is not admitted |
|---|---|
| the production port of the frozen system (§14 items 1–5) | implementation of a frozen design, not a cross-task obligation. The roadmap already sequences Production Integration |
| F-P2-02 | an implementation composition detail of existing T-05 / T-06 / T-12 law. The backlog excludes "Implementation design for T-11, T-12 or T-13" (§8) |
| device accessibility, Reduce Motion, Increase Contrast and touch-latency checks | implementation / device gates. G1.2 §7 and G3 §F / §H keep the same class of gate unadmitted |
| the Speaking Indicator | contingent on `QAN-BL-VOICE-01`, which already requires "truthful microphone and route state". A second entry would be a duplicate alias (backlog §8) |
| the broader Voice visual language and the audio strip | stay governed by G1.2 §6 and the roadmap's P4 census. No canonical document defers them to a named task **as an obligation** |
| the placement questions of §11 | shell and attention decisions sequenced by the roadmap (P3, P4), which is sequencing, not a task |
| a utility dependency choice | implementation detail |

None carries an existing `OPEN` identifier. No canonical document defers any of them **as an obligation** to a named
future task. None is carried forward for validation, and Architecture designated none.

**BG-01.** There are no current P2 blockers, so none was moved here. Every P2-A finding was corrected inside the proof
or dispositioned in §12.

This is not blocker laundering. Architecture remains free to designate any of the above under BG-06.

**No backlog closure record.** `tests/task-closure-governance-contract.test.mjs` governs `T-` tasks through index
tombstones and Connected Worlds `I-0N` phases through `### I-0N closure record` headings. P2 is neither and has no
backlog item, so the contract requires no P2 record and none is manufactured. The backlog is not changed.

**BG-09.** This document is P2's primary canonical record, and it carries its final lifecycle banner in the closing
change itself. The same change updates:
- [`QANDEEL_PRODUCT_ROADMAP.md`](../QANDEEL_PRODUCT_ROADMAP.md), [`QANDEEL_CURRENT_STATE.md`](../QANDEEL_CURRENT_STATE.md)
  and [`QANDEEL_PROJECT_MAP.md`](../QANDEEL_PROJECT_MAP.md);
- [`CANONICAL_AUTHORITY_INDEX.md`](canonical-authority/CANONICAL_AUTHORITY_INDEX.md) and
  [`QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md).

The P2-A package bytes are not changed: its "P2 NOT CLOSED / NOT FROZEN" wording is superseded by this record, as G3
§I did for G3.2. No successor task is left to synchronize any of these.

---

## 16. Closure method (Skills Gate)

The installed skills were inspected. None covers documentation governance or change control. Three bear on wording
this record had to get right. Repository canon and the Product Owner's selections outranked each of them.

| Skill | Concrete effect on this record |
|---|---|
| `fixing-accessibility` | Its critical rules — "icon-only buttons must have aria-label", "decorative icons must be aria-hidden", "do not remove focus outlines without a visible replacement", disabled states "must not rely on color alone" — are each stated in §10 as platform-neutral requirements (an accessible name, hidden from the accessibility tree), carried by reference to E1R / F1R2 and G1.2 R1's labels rather than restated as a second contract. The End Call size change is recorded inside an unchanged 44 pt target |
| `designing-arabic-frontends` | "Mirror by meaning … never mirror … media playback": §10 freezes direction by meaning, lists the never-mirrored classes, and routes the Call Rail through layout direction and the Spine through T-06's one mirror rule rather than a whole-set flip. Placement is written in start / end terms. No Arabic copy is written or changed |
| `animate-expo` | "Feel is judged on a release build on the slowest device" and "Reduced motion means fewer and gentler, not zero": §9 freezes the language (no bounce, loop or pulse; 1:1 under the finger; the same truth under Reduced Motion) and explicitly does **not** freeze P2-A's durations. "Bounce only when the gesture carried momentum" matches the single commit settle T-06 already owns, which §9 cites instead of re-freezing |

---

## 17. Closure

> **P2 — CLOSED / FROZEN — FINAL ICONOGRAPHY SYSTEM**

This is binding on the merge of the pull request that carries this record. Production implementation remains open.
The next Product decision track is **P3 — Notification Final Realization**, which this record does not open.
