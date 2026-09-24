# QANDEEL — I-08B3.1-G3
## Integrated Product Coherence — Canonical Closure, and Parent I-08B3.1-G Closure

**Status:** `I-08B3.1-G3 — CLOSED / FROZEN AS INTEGRATED END-TO-END PRODUCT COHERENCE PROOF`\
**Parent status:** `I-08B3.1-G — CLOSED / FROZEN` (§J)

**Lifecycle effect:** this is the canonical state encoded by the closing change. It becomes binding on the merge of the
pull request that carries this record, after independent review. This record carries no review or merge status of its
own.

**Canonical baseline:** `da4cf0c9ebcb573f8f186f60b6affbf8a4bd6752`, the merge of PR #267, which closed G2\
**Controlled amendments made with this closure:**
- `docs/design/i-08b3.1-g3/T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md`
- `docs/design/i-08b3.1-g3/G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md`

**Final proof preserved:** `docs/design/canonical-artifacts/product-proofs/g3/g3.2/`

---

## A. Status

G3 set out to prove that the already-frozen Product pieces behave and feel like one coherent QANDEEL Product, end to
end (G3 handoff §1). Two review packages did that:
- **G3.1** built the integrated Product and found where the joins failed;
- **G3.2** refined exactly two joins after the Product Owner decided them.

Both passed independent Product review. That acceptance is an input to this closure, not a claim made by it.

This record freezes:
- the three Product decisions in §C and §D;
- the North Star disposition in §E.

Everything else in the G3 proofs remains evidence: their visual craft, their proof copy and their harness.

This record reopens nothing it consumed:
- I-08B1, G1.1, G1.2, G2 and G2.3;
- T-04, T-05, T-06, T-07, T-08, T-10, T-11 and T-12;
- Replay (`I-06`) and Matching / Introduction (`I-07`).

The two amendments above change only the statements they name.

`I-08B3.1-G3` is a design-track identifier, not Connected Worlds phase `I-08`. That phase still owns the mobile Matching
UI, the final visual proposal experience and navigation surfaces (`docs/matching-introduction-runtime-v1.md` §24).

---

## B. Evidence chain

| Record | Identity | Role |
|---|---|---|
| G3.1 — Integrated end-to-end Product proof | `I-08B3.1-G3.1-INTEGRATED-END-TO-END-PRODUCT-PROOF.zip`, 40,331,309 B, 149 entries, SHA-256 `A5D286A888B7B851193AA4C2805C443766284FC45B3521DAAE356677F7E3316E`; prototype `47dfe29ec1fceeeb9d05b9dae886074710c75abde0575291802647673847b264` | one integrated Product, proved end to end from the frozen pieces; 32 / 32 checks, 8 / 8 planted defects, 65 / 65 real-input steps. Found the PINNED split (F-04), Matching-during-call (F-05) and Q-LIGHT-SHELL's fixture-B legibility failure (F-08). **Predecessor evidence** |
| G3.2 — Targeted coherence refinement | `I-08B3.1-G3.2-TARGETED-COHERENCE-REFINEMENT.zip`, 26,909,573 B, 145 files (144 manifest entries + `MANIFEST.json`), SHA-256 `D6AF79DAEEE0B6F09197084E8E35961112B5A30BC2B4CF2524D1FD2B769CE9B0`; prototype `10611f35cdcfd031d74ad0b065634a19f530e2b1e28acfd2c944d4f2d4983d71` | proves Decisions A and B on G3.1's sealed bytes; 29 / 29 checks, 10 / 10 planted-build defects rejected, 38 / 38 real-input steps; 12 boards, 7 motion clips. **The final accepted Product-coherence proof** |
| Living Analysis source | `docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html`, SHA-256 `4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413` | the one world both packages load, unchanged |

**Verification made by this closure, before any canonical text was written:**
- **ZIP identity.** The G3.2 ZIP was re-hashed: 26,909,573 B, `D6AF79DA…E9B0`.
- **Two independent extractions** of the ZIP: the package's own reader, and .NET `ZipFile`.
  - Both verify all 144 manifest entries by bytes and SHA-256.
  - Neither finds an extra file.
- **Rebuild.** `source/src/build.mjs`, run from each extraction and again from the preserved tree, reproduces
  `10611f35…83d71` byte for byte.
- **Recorded results.** The package records 29 / 29, 10 / 10 and 38 / 38.
- **G3.1 ZIP identity.** It was re-hashed and equals `A5D286A8…316E`.

**Where the packages live.**
- **G3.2** is preserved whole, byte-exact, at `docs/design/canonical-artifacts/product-proofs/g3/g3.2/` (§K).
- **G3.1** stays local as provenance, at `E:\QANDEEL\QANDEEL PROJECT\design-workshops\`. G3.2 vendors G3.1's three
  changed build inputs, and its `tools/upstream.mjs` rebuilds G3.1's reviewed prototype byte-identically from the
  preserved tree. Only the ZIP identity check needs the local G3.1 ZIP.
- **G3.1 is not promoted over G3.2.**

**Their lifecycle.** Both packages keep their own review-candidate wording in their bytes. This record is their
lifecycle authority.

---

## C. Frozen Product decisions

### C.1 Q-LIGHT-SHELL — resolved (Decision A)

> **The Analysis is one dark, immersive place with the canonical Living Analysis World under both system Dark and
> system Light. Non-Analysis surfaces keep following the system appearance.**

The full statement is in `G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md`:
- the shell scope;
- the unchanged world;
- the Conversation, private proposal and Shared World following the system;
- F2's appearance-switch semantics at the Conversation ↔ Analysis boundary. The reviewed proof used 200 ms, which remains F2's `production-default` / device-tunable craft value; under Reduced Motion the cross-fade is removed entirely;
- the status content as a legibility requirement rather than a mechanism.

It is not an app-wide dark mode, a user appearance override or toggle, a change to any F2 token, or a Light repaint or
veil over I-08B1.

### C.2 Temporal Orientation ↔ Timeline — resolved (Decision B)

> **World → concise temporal orientation line (only when truthful temporal context exists) → Timeline / Temporal
> Surface → OrientationChrome.**

The full statement is in `T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md`:
- the line belongs spatially to the Timeline region;
- T-08 keeps its words, presence and truth, for PINNED and for a Moment preview alike;
- OrientationChrome keeps «طرق العودة» and the other Return acts;
- Return Live stays in its one home at the Live edge;
- the yield rule.

**The evidence of record** is G3.2's final K14 data. The tightest reviewed case, 320 × 568 in a Live Call while
PINNED, keeps **161 pt of world against the 160 pt floor**. Candidate prose in the preserved package that describes that
case as sitting on its floor is superseded by the measurement (amendment §3).

---

## D. Matching during an active Live Call — resolved

> **If a new Matching opportunity becomes available while the user is in an active Live Call, it must not interrupt or
> replace the active Live Call. The Matching Product moment is deferred and presented after that Live Call ends.**

This is a Product attention and presentation rule. It is not a Matching runtime authority.

### What it was reconciled against

| Authority | What it says | Result |
|---|---|---|
| G1.2 §1, §2 | a Live Call is Analysis-first; opening «المحادثة» does not end it; it continues when QANDEEL backgrounds and restores the last truthful in-call surface; the same call identity continues | **compatible.** The rule protects the same call G1.2 protects. "Active" means G1.2's active call, on either surface, foreground or background. "Ends" means the call actually ended, including G1.2's truthful ended-while-away state |
| G2 §C item 10, §D; G2.3 §1–§3 | Matching is a QANDEEL-initiated Product moment outside the world's geography, with the frozen process, copy and two distinct accepter moments | **compatible.** The rule changes **when** the moment is presented, never what it is. The copy, process and privacy laws are untouched |
| `docs/matching-introduction-runtime-v1.md` §1, §11, §24 | a proposal is not a World; proposal cadence, expiry and pending limits are deferred Product policy; the mobile Matching UI is Connected Worlds `I-08`'s | **compatible.** The deferral is presentation only. It creates, extends and expires nothing, and it changes no proposal state, cadence, lifetime or eligibility. When presented, the moment shows what the Matching runtime then holds, and never an opportunity the runtime no longer offers |
| Notification / proactive-attention canon | Safety Runtime, "Proactive Safety": proactive behaviour "requires consent, cadence/cooldown/quiet-hour controls" and the same constraints as reactive conversation. Behavioral Runtime, "Default Posture": "Interrupt minimally". Notifications and proactive Product behaviour are **deferred with no owner**: Human Intelligence Activation freeze, "Deferred beyond this phase"; Integrated Intelligence Runtime freeze. G2 §A and the G3 handoff §7 keep notification choreography `OUT-OF-SCOPE / LATER` | **compatible, and nothing to reference.** The rule is a stricter case of "interrupt minimally" and adds no proactive surface. The repository has **no** canonical notification runtime and **no** generic deferred-attention mechanism, so this record references none and invents none |

### What it does not define

- a database state, queue, schema or persistence mechanism;
- a notification transport, a push or local notification, or its timing;
- a consent model;
- a Matching score, reason or ranking;
- the exact post-call placement, animation, copy or timing;
- English Matching copy. No English Matching moment exists, and none is written here.

### Where the implementation residue goes

The Product presentation belongs to Connected Worlds `I-08`, the mobile Matching UI (Matching runtime §24; G2 §A). It
consumes a truthful answer to "is a Live Call active?" from the future canonical call / session authority, which is a
required property of `QAN-BL-VOICE-01`. Both owners already exist, so no backlog item is admitted for this (BG-06; §H).

This rule does not take ownership from either of them.

---

## E. The F1 / F2 North Star carry-forward — met, by Product Owner decision

F1 and F2 recorded the North Star spectacle capacity as "OPEN, NOT PROVEN, NOT WEAKENED, OWNED BY G":
- F1R2: `F1_KNOWN_LIMITATIONS.md` §9b, `F1_F2_CARRY_FORWARD.md` §C item 11;
- F2: `F2_NORTH_STAR_CARRY_FORWARD.md`.

G2 §A kept it open and owned by G. Parent G cannot close with it silent.

**Product Owner decision, recorded by this closure:**

> **The North Star spectacle requirement owned by G is met by the accepted canonical I-08B1 Living Analysis World, as
> integrated byte-exact as the hero of the Analysis by G2 and G3.**

**What this decision is:**
- The Product Owner's judgement, made during this closure task.
- A disposition of an obligation the F records gave to G.

**What it is not:**
- **Not a new measurement.** F1's recorded ratios stay in F1 as history, unchanged.
- **Not a change to any token or Product value.** It does not relax the D-track atmosphere chroma ceiling (D is CLOSED /
  FROZEN), grant density to anyone, or change the world.
- **Not a verdict on heavy-history scale.** The separate G2 §G item 8 obligation — **Heavy-History / Long-Term World Density + LOD Stress Proof** — is admitted to the backlog as `QAN-BL-VIS-01` (§H). It is not a remaining part of the F1 / F2 North Star obligation.

---

## F. What G3 does not close or implement

- **No production implementation** of:
  - the Analysis shell or the status-content style;
  - the appearance cross-fade;
  - the temporal line's placement or the yield rule;
  - compact `ReturnControls`;
  - the Matching / Live-Call deferral.
- **No native code:** no status-bar code, no Voice runtime, no call stack, no notification transport or queue.
- **No Replay player or export** (`QAN-BL-NAV-02`) and no durable Personal call audio (`QAN-BL-VOICE-01`).
- **No world change.** No I-08B1 byte, and no Skia / Reanimated port of the world.
- **No copy.** No Matching copy change, no English Matching copy, and none of G2 §G's proof copy frozen.
- **No appearance setting,** and no app-wide dark mode.
- **No device certification.** VoiceOver / TalkBack, CallKit / Telecom, background and lock, audio routes and native
  status-bar behaviour stay device and implementation gates (G1.2 §7). Browser evidence does not replace them.

---

## G. Carried items, classified

Nothing below keeps G3 or parent G open. Each item keeps the owner and class shown.

| Item | Source | Disposition |
|---|---|---|
| Matching proof lines: cue label «ليه؟», first-accepter acknowledgement, neutral unavailable line, second-accepter line, later arrival, welcome | G2 §G 1–6 | `OPEN COPY`, unchanged. Product copy owner |
| Q-LIGHT-SHELL | G2 §G 7 | **resolved** (§C.1) |
| Heavy-history / long-term density and LOD stress proof | G2 §G item 8; G3 readiness handoff §7 | **admitted** as `QAN-BL-VIS-01` (§H) |
| Final Introduction screen | G2 §G 9 | later Product work; Connected Worlds `I-08` |
| Production compact Return grouping | G2 §G 10; G2.3 T-11 amendment §7 | `IMPLEMENTATION GAP`, unchanged |
| Orientation above the Timeline (S-04) | G2 §E; handoff §7; G3.1 N1 | **resolved** in its narrower form (§C.2) |
| Matching during a Live Call | G3.1 F-05, N2 | **resolved** (§D) |
| «سياق الكلام» placement in the Analysis | G3.1 N3 | Product copy placement. VI-01 / Product; not decided |
| Exact Return / Back restoring a PINNED stance | G3.1 N4, F-11 | confirmation for the T-07 / T-08 owners; not reopened |
| English Matching copy | G3.1 N5, F-06 | `OPEN COPY`. Nothing invented |
| The preview line counts as temporal context | G3.2 N1 | **answered** by §C.2 and the amendment §2 item 3 |
| The falloff under the line | G3.2 N2, F-01 | accepted as presentation craft; `.88` not frozen (amendment §4) |
| F2 timing into the proposal / Shared World | G3.2 N3, F-05 | **not universalised**. Their existing Product / motion owners keep the timing (G2 / F2 amendment §3) |
| Status bar on a device | G3.2 N4, F-07 | requirement frozen, mechanism not (G2 / F2 amendment §4); device validation at implementation |
| Large text at 320 pt in the densest state | G3.2 F-08 | implementation / device evidence (T-11 / T-12 amendment §7) |
| One assistive live channel with no single native equivalent | G3.1 F-09 | implementation gate (G1.2 §4, §7) |
| The world's atmosphere laid out per canvas | G3.1 F-10 | the native port of I-08B1 |
| Seams S-06, S-07 (T-08 / T-04); S-09, S-10 (VI-01 / port); distinct Shared World titles (Matching runtime §22) | handoff §7 | unchanged, with their owners |
| Arabic Replay noun and entry names; the English Conversation → Analysis label; Timeline accessible name and preview routes; Live-edge wording while following Live | handoff §7 | `OPEN COPY`, unchanged |

---

## H. Backlog reconciliation (BG-08)

`docs/qandeel-canonical-backlog-v1.md` was read in full at the baseline.

**Inherited: none.** No item names G3, parent G or any I-08B3.1 task as its Owner task.

**Adjacent items, untouched and not claimed:**
- `QAN-BL-NAV-02` keeps the Product Analysis Replay surface. G3 proved only the Replay entry.
- `QAN-BL-VOICE-01` keeps the Personal Voice / Live Call runtime and durable audio. §D consumes its future call
  authority and takes nothing from it.
- `QAN-BL-NAV-01`, `OPEN-06`, `OPEN-08`, `OPEN-09` and `OPEN-19` are navigation and acknowledgement capabilities G3
  neither implements nor blocks.
- `QAN-BL-SEC-01` stays with `QAN-SEC-01`.

**Admitted: one.** `QAN-BL-VIS-01 — Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof`,
`OPEN — UNASSIGNED`, with the full §2 schema.
- **Why it qualifies under BG-06:** G2 §G item 8 explicitly names it as a future heavy-history / long-term density + LOD stress proof, and the G3 readiness handoff §7 carries that obligation forward unchanged.
- **Why it must be admitted now:** G is closing and can no longer hold it.
- **Not blocker laundering (BG-01):** G3's contract forbade redesigning the world, and G2 already recorded the item as
  not keeping G2 open.

**Not admitted, with reasons.** Every other §G item is one of:
- a resolved decision;
- open copy;
- an implementation or device gate;
- a question for an owner that already exists.

None carries an `OPEN` identifier, none is deferred **as an obligation** to a named future task by a canonical document,
none is carried for validation, and Architecture designated none (BG-06).

The Matching / Live-Call implementation residue is owned by Connected Worlds `I-08` and by `QAN-BL-VOICE-01`'s call
authority. A contract that already owns a capability does not also need a backlog entry claiming it.

---

## I. Lifecycle synchronization (BG-09)

| Record | State encoded by this closing change |
|---|---|
| **G3**: this document, G3's primary canonical record | `CLOSED / FROZEN` (banner above) |
| **Parent G** | `CLOSED / FROZEN`, recorded here (§J). No standalone parent-G document exists in the repository, and none is invented |
| The two amendments in `docs/design/i-08b3.1-g3/` | `FROZEN` banners, binding on the merge |
| G3.1 and G3.2 package bytes (G3.2 preserved; G3.1 local) | keep their "READY FOR … REVIEW" wording as sealed. This record supersedes it; the bytes are not edited |
| G2 closure, G3 handoff, G2.3 closure | unchanged historical records. Their Q-LIGHT-SHELL and S-04 statements are superseded by the two amendments, and the canonical artifact index records that |
| Locators: `QANDEEL_CANONICAL_ARTIFACT_INDEX.md`, `canonical-artifacts/README.md`, `product-proofs/README.md`, and `product-proofs/g2/README.md` + `SOURCE-PROVENANCE.md` | updated in this change to name G3.2 as the final proof and to point every "Q-LIGHT-SHELL open" and "S-04" statement to its resolution |
| `docs/qandeel-canonical-backlog-v1.md` | `QAN-BL-VIS-01` admitted, and a design-track reconciliation section added (§H) |

No successor task is left to synchronize any of these.

---

## J. Parent I-08B3.1-G

The G line is the Product integration line of the I-08B3.1 design track. Its three stages and their records:

| Stage | Record | State |
|---|---|---|
| G1 — Product shell, Conversation, Voice and Live Call | `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md`; `docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md` | `CLOSED / FROZEN` through G1.1 and G1.2. No separate G1 parent record exists, and none is invented |
| G2 — Living Analysis + Product composition | `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md` (PR #267) | `CLOSED / FROZEN`; its §C item 11, §E, §F and §G item 7 are superseded as the two amendments state |
| G3 — Integrated Product coherence | this record | `CLOSED / FROZEN` |

**Parent G's own obligations are discharged:**
- **the North Star carry-forward:** met, by the Product Owner's decision (§E);
- **Q-LIGHT-SHELL and S-04:** resolved (§C);
- **the one remaining world-scale residue:** in the backlog (§H).

> **I-08B3.1-G — CLOSED / FROZEN**

---

## K. Final proof preservation

The complete reviewed G3.2 package is preserved byte-exact at
`docs/design/canonical-artifacts/product-proofs/g3/g3.2/`. Only the outer ZIP container was removed. That means all 145
files:
- `README.md` and `MANIFEST.json`;
- `prototype/`, `source/`, `data/` and `docs/`;
- the 12 boards;
- the 7 motion clips.

The ZIP itself is not committed, because its payload is preserved whole. Its path, size and SHA-256 are the
provenance, recorded in `product-proofs/g3/SOURCE-PROVENANCE.md`.

Motion is a first-class Product pillar and G3 is the final integrated proof, so its boards and clips are kept. That
is a recorded exception to the preservation directory's rule 4 (`docs/design/canonical-artifacts/README.md`).

---

## L. Closure method (Skill Gate)

The installed skills were inspected. None covers documentation or change control, so the three loaded skills were the
ones bearing on canonical wording this closure had to get right:

| Skill | Concrete effect on this closure |
|---|---|
| `fixing-accessibility` | The status-content rule is stated as a contrast **requirement** against the existing minimum, with the proof's ratio kept as evidence (G2 / F2 amendment §4). Reading and focus order are required to equal visual order with the line before the Timeline, and the line is text, not a control (T-11 / T-12 amendment §5). The «طرق العودة» requirements are carried by reference to the G2.3 amendment §4 rather than restated in a way that could weaken them |
| `designing-arabic-frontends` | Placement is written in start / end terms, never left / right. The digit policy is left to T-12's one locale authority instead of being restated. No copy is rewritten or translated (T-11 / T-12 amendment §5) |
| `animate-expo` | The status bar is treated as a platform style that cannot follow a custom cross-fade, so only the legibility requirement is frozen and no native mechanism or status-bar animation is. Reduced Motion is written as "the same truth with no movement", using F2's own 0 ms token for the cut (G2 / F2 amendment §3–§4; T-11 / T-12 amendment §4) |

---

## M. Closure

> **I-08B3.1-G3 — CLOSED / FROZEN**

> **I-08B3.1-G — CLOSED / FROZEN**

Both are binding on the merge of the pull request that carries this record.
