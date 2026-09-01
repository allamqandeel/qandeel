# QANDEEL — VI-03-01 · VISUAL TRUTH MATRIX & NORTH-STAR EXPLORATION BRIEF

**Working exploration brief. NOT a freeze artifact. Nothing here is canonical law.**

- **Phase:** VI — Final Visual Design + Design Systemization
- **Parent stage:** VI-03 — Visual North Star + Graphic Language
- **Task:** VI-03-01
- **Status:** `EXECUTION ARTIFACT — NOT A FREEZE`
- **Canonical baseline:** `313d1431d4b80acb5703fbd9d7f4f78cae74fc81`
  (merge of PR #188 into `main`; first parent `7c111f01`, second parent `733d0019` = FIX-01)
- **Repository:** `https://github.com/allamqandeel/qandeel.git`
- **Delivery correction applied:** `VI-03-01R` — canonical archive placement under
  `docs/design/phase-vi/vi-03-visual-north-star-graphic-language/`, and the `Q-1`…`Q-4` evidence
  dispositions recorded at the end of this document. **No semantic content was reopened, no
  direction was selected, and nothing was frozen.**

This document defines the **legal design space** for the divergent visual exploration that
follows. It selects no direction, adopts no aesthetic, and freezes nothing. Where it says
`LOCKED`, the lock was inherited from an earlier canonical freeze and is cited; this brief
creates no new locks.

---

## 0. How to read this document

### 0.1 Status legend

| Marker | Meaning |
|---|---|
| `LOCKED` | Already frozen by VI-01, VI-02 or Phase V. VI-03 may not reinterpret it in a way that changes behaviour or meaning |
| `RUNTIME-BACKED` | A record, field, constraint or command exists at the baseline that makes the claim true. May be expressed spatially/graphically |
| `SIMULATED-ONLY` | Useful for design research; **no** production semantic supports it. Must be labelled wherever it appears |
| `OPEN` | Genuinely free for VI-03 to invent |

### 0.2 Two senses of "runtime-backed" — do not conflate them

This distinction is load-bearing for Section C and Section D:

| Sense | What it means at this baseline |
|---|---|
| **Semantically recorded** | The record, field or constraint exists in the runtime and carries the meaning claimed. Example: explicit supporting/contradicting role membership per reading |
| **Client-exposed** | A client can actually fetch it today over HTTP |

At `313d1431` the only HTTP surfaces are conversation sessions/turns, session context-bindings,
and health — `apps/api/src/conversation/conversation.controller.ts`,
`apps/api/src/conversation/conversation-context-activation.controller.ts`,
`apps/api/src/health/health.controller.ts`. **No hypothesis, memory, confidence, gap or
question read endpoint exists.** This matches Phase V's recorded boundary: *"Shaped,
product-semantic durable-state fetch. No product read API exists."*
(`docs/design/phase-v/QANDEEL_V10_TRUTH_MANIFEST.md` §2.1).

**Consequence for VI-03.** A claim may be *semantically recorded* and still not fetchable
today. That is a delivery-sequencing fact, not a licence to invent — and it is not a reason to
treat recorded semantics as fiction. Section C lists what is semantically recorded; a scene
that renders it is honest design work. Section D lists what is **not** recorded at all; a scene
that renders that must carry the simulated-only label.

### 0.3 The one rule that governs everything left open

> **A visual relationship may be drawn only if it is true of the runtime.**
> — `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_BEHAVIORAL_NAVIGATION_FREEZE.md` §2

Grouping asserts belonging. A line asserts a relation. A weight asserts strength. A direction
asserts influence. A number asserts a quantity. Motion asserts that something changed.
**The gate is truth, not restraint.** It does not license timidity and is not a reason to leave
a surface unstructured.

---

# SECTION A — AUTHORITY MAP

## A.1 Which source governs which kind of decision

| Decision type | Governing authority | Canonical location | Standing at this baseline |
|---|---|---|---|
| **Product language, vocabulary, register, bilingual semantics, truth guardrails on copy** | **VI-01** | `docs/design/phase-vi/vi-01-bilingual-product-language/` (README is the authority on freeze state) | `CLOSED / FROZEN AS LANGUAGE SYSTEM + SEMANTIC CONTRACTS` |
| **Behaviour and navigation of the analysis surface when peers exist** | **VI-02** | `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_BEHAVIORAL_NAVIGATION_FREEZE.md` (highest authority in that archive) | `CLOSED / FROZEN AS BEHAVIORAL + NAVIGATION ARCHITECTURE` |
| **What may be claimed, expressed or inferred — semantic/runtime truth** | **Phase V** | `docs/design/phase-v/QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md` (A/B/C/D items + "Runtime / Truth Boundaries"), closed by `QANDEEL_PHASE_V_Closure_Structural_Grammar_Freeze.md` (`V10-FIX-01`) | `PHASE V CLOSED — V10-FIX-01 APPLIED` |
| **What the data actually is** | **The repository source itself** | `apps/api/src/**`, `database/migrations/**` | Authoritative over any document that describes it |
| **Visual morphology, graphic language, North Star** | **VI-03** | *does not exist yet* | **OPEN — VI-03 owns it** |
| **Freeze decisions of any kind** | **Product Lead / Freeze Authority (ChatGPT)** | — | Not delegated to this task |

## A.2 Precedence

1. **Repository source and database constraints** beat any document that describes them.
2. **Latest canonical decision wins** over an earlier one on the same question.
3. Within the VI-02 archive, `VI02_BEHAVIORAL_NAVIGATION_FREEZE.md` is the highest authority
   (README §"Canonical documents").
4. Within VI-01, the Foundation governs the Terminology Matrix, which governs Copy Patterns,
   which governs Rejected Language, which governs the Stress Test (VI-01 README
   §"Canonical authority order").
5. **Evidence is not law.** Prototype mechanics, measured numbers and screenshots are cited as
   evidence in all three archives and are explicitly not frozen.

## A.3 Known supersessions — record these, do not blend them

| Superseded | Superseded by | What VI-03 must take from it |
|---|---|---|
| Phase V `B1` RTL peer **paging** with equal labelled controls; `B2` pane-count-follows-reading-count; `B3` equal columns above a measure floor with all peers paged below it | **VI-02 `F-01`…`F-12`**, F3 Overview ⇄ Focus | Phase V itself deferred large/double-digit peer navigation to Phase VI as its `#1 HIGH-PRIORITY OPEN ITEM` and called the six-control pager "prototype evidence of where the present form breaks, not the final solution". The **pager is not the architecture.** What survives from B1–B3 is the *principle* — every peer reachable, controls equal, no orphan column, the gesture never the only route — not the paged form |
| Phase V `D7` read as a blanket ban on any near/far in Live Context | `V10-FIX-01` → `A22` / `A23` | Rank-like near/far stays permanently rejected. Contextual-relevance near/far is **reserved**, not rejected — future-only, simulable when labelled |
| VI-02's own prototype morphology (full-width vertical rows, four-line previews, white styling, the disclosure control's DOM placement, live-layout clipping detection, announcement mechanics) | Nothing — it was never canon | *"The row is evidence. It is not the product."* Every pixel is throwaway (`VI02_BEHAVIORAL_NAVIGATION_FREEZE.md` §0, §3) |
| VI-02-VIS-01 directions A / B / C / D | Nothing — completed visual research only | Not selected, not canonical, not frozen, **not constraints on VI-03** (`VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md` §8) |

## A.4 What VI-02's closure did and did not close

Both lines must be read together; either alone misrepresents it:

> `VI-02 — CANONICALLY CLOSED / FROZEN AS BEHAVIORAL + NAVIGATION ARCHITECTURE`
> `FINAL VISUAL MORPHOLOGY REMAINS OPEN`

VI-02 froze **what is true for the reader**, never **what the reader looks at**.
Phase VI itself remains OPEN; only VI-01 and VI-02 close.

---

# SECTION B — LOCKED MATRIX

Constraints later visual exploration must not violate. Every row is inherited; none is created
here.

| # | Constraint | Canonical source | Why it matters visually | What would constitute a violation |
|---|---|---|---|---|
| **L-01** | **F3 Overview ⇄ Focus is the behavioural reference.** The set precedes the reading; no reading is foregrounded until a reader raises it | VI-02 `F-01`; freeze §0 | Determines the *shape of the arrival moment* — the first composition a reader meets is the whole set, not a reading | Opening on one reading; a hero reading; a composition that reads as "the answer, plus alternatives" |
| **L-02** | **No system-selected winner.** Nothing pre-staged, pre-opened, pre-scrolled-to, recommended, ranked, scored, graded or relevance-ordered. *A default the reader did not choose is a rank* | VI-02 `F-02`; Phase V `A2` | Bans the entire "primary card + secondary cards" family, hero sizing, first-position emphasis, and any entrance animation that arrives at one peer | Any peer larger, darker, nearer, earlier-by-merit, pre-expanded, or landed-on by default |
| **L-03** | **Peers are equals, and are said to be — in words that also reach assistive technology** | VI-02 `F-03`; VI-01 `T07` (semantics `FROZEN`) | Equality may not be carried by arrangement alone; the composition must leave room for the statement of equality | Equality implied only by symmetry; a visual-only equality with no worded equivalent; different words to AT than to sighted readers |
| **L-04** | **Every exposed peer stays reachable *and* discoverable** — no peer behind an affordance the reader must already know about | VI-02 `F-04`; Phase V `A3`, `A13`, `D4` | Rules out off-canvas parking, hover-only reveals, gesture-only access, and "show more" that hides peers rather than deferring them | A peer that exists but cannot be found; silent omission or truncation as the count grows; a subset stage |
| **L-05** | **The full statement is the canonical human-facing identity source.** A derived title, excerpt, ordinal, letter, position, machine ID or set-relative fragment may never be the *sole* human-facing discriminator on a choosing surface. Compact excerpts may exist only as clearly secondary pointers when the whole statement is reachable under F-06 | VI-02 `F-05` *(C1)*; `VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` §1 | This is the single hardest constraint on dense/nodal morphologies: a node small enough to hold two words cannot be identified by those two words | Chip/node labels derived by truncation; "Reading A/B/C"; numbered nodes; a UUID on a human surface; an accessible name shorter or different from the visible identity |
| **L-06** | **Identity is reachable without commitment.** Wherever a reading is shown as less than its whole statement, the reader can reach the whole statement *on that surface* — without foregrounding, choosing, dismissing, or losing their place. *Inspecting is not choosing* | VI-02 `F-06`; identity contract §2 | This is the clause that **permits abbreviation at all**, and therefore the clause that makes nodes, clusters and compact fields legal | A node that must be opened (committed to) to be identified; a preview with no non-committing route to the whole text; a reveal that dismisses the set or loses scroll/focus |
| **L-07** | **Reader-chosen foreground is reversible, and the return recomputes nothing** | VI-02 `F-07`; Phase V `A9`, `A10` | Focus is a *view state*, not a navigation to a new page; the drawing may be an instant swap or a movement — but it may not imply that anything was recalculated | Focus that mutates stored state; a return that rebuilds, re-sorts or re-orders the set; motion that implies computation |
| **L-08** | **The return route is present the entire time a reading is foregrounded, and names its destination** | VI-02 `F-08` | The return is *the architecture's spine*. It constrains every full-bleed, immersive or scroll-hijacked focus treatment | A return that scrolls away, hides behind a gesture, is unnamed ("back"→where?), or disappears in an immersive mode |
| **L-09** | **Orientation is not currency.** Restored scroll and focus are orientation; never `current`, primary, selected, active or ranked — visually or to AT. A surface that foregrounds nothing exposes no current peer, including in URL state | VI-02 `F-09`; identity contract §4 | Bans "last visited" highlighting on the overview, and any persistent selection marker on a surface with nothing foregrounded | `aria-current` on an overview; a lingering highlight on the last-opened peer; a current-peer value in the URL of a surface that foregrounds nothing |
| **L-10** | **Deep links land on the reading, focused and announced after arrival, with the whole-set return route intact** | VI-02 `F-10`; Phase V `B4` | Any entry animation or progressive assembly must not delay or break the landing; the landing may not depend on an animation frame or a smooth scroll | A landing that depends on `requestAnimationFrame`, a smooth scroll, or a scheduling race; announcing before arrival; a deep-landed reading with no route to the set |
| **L-11** | **Late-divergence / label-collision safety.** Two readings may be materially identical for a long opening (measured: 262 AR / 336 EN chars) and diverge only afterwards; excerpt-derived labels collide at 40/60/80/160/240 chars and separate only at 340 | `VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` §3; `VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` §2.2, §2.2.1 | Any composition whose identity slot is short **must** pair with an L-06 mechanism; this is a truth rule, not a styling preference | A dense composition that identifies peers by short label alone; assuming a designed excerpt "will be different enough" |
| **L-12** | **Exact-duplicate boundary.** Statements are **not** assumed globally unique. Exact human-facing duplicates must never be cosmetically disambiguated by ordinal, letter, UUID, rank or invented label | VI-02 `F-05`/C2; `VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` §3; runtime: `HypothesisService.create()` enforces no uniqueness invariant, only the controlled generation path rejects normalized duplicate `statement + scope` (`apps/api/src/hypothesis/hypothesis-generation.policy.ts` `hypothesisCollisionKey`) | Forbids the tempting visual fix of "just add a tiny badge" when two peers look the same | Any invented visual distinction between records that carry none |
| **L-13** | **Bilingual language semantics from VI-01.** Native bilingual authorship (neither language is a translation); the Arabic register architecture `T1`/`T2`/`T3a`/`T3b`/`T4`; naming-minimization; the gender policy; peer-scaling language constraints; provenance/correction semantics; the `APPROVED` core vocabulary | VI-01 README §"What VI-01 froze"; `QANDEEL_VI01_TERMINOLOGY_MATRIX.md` | Type, composition and labelling must serve two *authored* languages, not one language plus a mirror. Approved terms that touch VI-03 directly: reading «قراءة / القراءات» (`O02`), shared material «المشترك بين القراءات» (`O06`), record date «تاريخ التسجيل» (`O13`), role in readings «دورها في القراءات» (`A09`), Deep Analysis «المشهد» (`S04`), Live Context AR «الشغّال دلوقتي» / «سياق الكلام» (`S03`) | Designing the English surface first and mirroring it; replacing an `APPROVED` term with a designer-preferred synonym; copy that claims understanding, agency, relevance or provenance the runtime does not deliver |
| **L-14** | **RTL/LTR correctness is architectural, not remediation.** Everything holds identically in Arabic RTL and English LTR at 375px, by keyboard, and to AT. Direction is logical (forward/back), never left/right. Arabic gets generous line-height; no `letter-spacing`, no italics on Arabic | VI-02 `F-11`; identity contract §7; Phase V `A21` | Constrains every directional metaphor: arrows, sweeps, timelines, entrance directions, progress axes | A layout that mirrors but does not compose; a directional convention that implies precedence; horizontal overflow at 375px at 200% text |
| **L-15** | **No fabricated confidence.** No numeric confidence, band or percentage | Phase V `A15`, Truth Boundaries; runtime: `database/migrations/0006_confidence_runtime.sql` — `CHECK (numeric_score IS NULL)`, `CHECK (confidence_band IS NULL)`, `calibration_state = 'UNCALIBRATED'`, `stability = 'UNASSESSED'` | The quantity does not exist to render. Bans meters, rings, bars, dots-out-of-five, opacity-as-certainty | Any visual quantity read as how sure QANDEEL is |
| **L-16** | **No fabricated relationship strength.** Role membership is nominal — supporting / contradicting, in words. Never weighted, never counted as strength | Phase V `A5`, `A6`, `A15`; VI-02 legacy guardrail §3 | Bans line thickness, edge weight, node size, saturation or distance as relation magnitude — the default vocabulary of every graph visualisation | A thicker line for a "stronger" relation; `strong/medium/weak` grades; evidence count rendered as strength |
| **L-17** | **No fabricated causal arrows.** No relation without a stored role membership; no causal arrows; no decorative connections between objects | Phase V Truth Boundaries; VI-02 legacy guardrail §3 | Bans influence diagrams, flow arrows between readings, and "connection" lines drawn for composition | An arrow asserting that one thing caused, produced or led to another |
| **L-18** | **No unsupported taxonomy and no unsupported life-domain model.** Fixed life-domain maps are explicitly not restored | VI-02 legacy guardrail §3, §4 | This is the exact mechanism by which the legacy bought its density: two-word nodes from an invented taxonomy. `hypotheses.domain` exists but is a 6-value enum (`GENERAL, RELATIONSHIP, WORK, DECISION, GOAL, INTERACTION`, `apps/api/src/hypothesis/hypothesis.types.ts:3`) — it is not a life map and must not be drawn as one | A territory/map/constellation whose regions are invented categories; domain enum values rendered as a spatial world model |
| **L-19** | **No irreversible selection behaviour.** Every reader act on the analysis surface is undoable and mutates nothing stored | VI-02 `F-07`; Phase V `A9`, `A10`; VI-01 `A08` (remove-from-context is session-scoped and not destructive) | Constrains swipe-to-dismiss, commit-style choosers, and any interaction whose visual language implies consequence | A gesture that removes a peer; a "choose" that feels like a decision recorded; removal copy that reads as deletion |
| **L-20** | **Visual density must not erase analytical richness.** Dense data degrades gracefully, never by hiding; nothing may be dropped, collapsed away or silently truncated to fit; counts are morphology, never figures | Phase V `A13`, `A14`; VI-02 density findings §6 | The density answer may not be "show fewer" — it must be "compose better" | Summarising peers away; a "+7 more" that is not reachable; a count rendered so it can read as a score |
| **L-21** | **The old row-based UI is not product morphology.** Rows, paragraph-heavy presentation, white styling, cards, four-line previews, the measured screenful counts — none is frozen, none may be inferred | VI-02 freeze §3; README §"What VI-02 explicitly does NOT freeze"; density findings §6 | Prevents the freeze from being read as a form. **Also prevents the inverse error:** rows are not *banned* either — they are simply unchosen | Treating the VI-02 prototype as a spec; treating any measured number as a target; treating "not rows" as a requirement |
| **L-22** | **Shared material is shown once, with every reading it stands in named, and the role it carries in each** | Phase V `A4`, `B12`; VI-01 `O06`, `A09` | The one relation the architecture already draws. Its region sits in reading order — own, then shared, then what each reading stands on, then what is missing | Duplicating a shared record per reading; a shared region that reads as a centre, a verdict or a conclusion |
| **L-23** | **A spatial semantic may never be the only carrier of its meaning.** Any spatial meaning needs a non-spatial accessible equivalent and must stay intact under reduced motion | Phase V `A23`; VI-02 `F-11` | Every ambitious spatial idea in Section E inherits this cost up front | A composition whose meaning collapses at `prefers-reduced-motion` or for a screen-reader user |
| **L-24** | **Conversation remains primarily conversational.** No fragment, plane, band, role or relationship mark ever appears there. Expression rises only with depth (`A1` restraint gradient) | Phase V `A1`, `A16`, `A18`, `A19` | Bounds the "one continuous graphic language" ambition: continuity is carried by *identity and voice*, not by exporting analysis marks upward | Role marks in the chat; the analysis grammar bleeding into the conversation surface |

---

# SECTION C — RUNTIME-BACKED VISUAL CLAIMS

What the runtime and current contracts actually justify visualizing. Read §0.2 first: these are
**semantically recorded**; most are not client-fetchable at this baseline.

> **Do not assume** line thickness, size, brightness, distance, opacity, ranking, direction,
> causality, probability or confidence carries meaning. Each is a separate claim requiring its
> own support.

| # | Runtime-backed concept | Exact semantic meaning | Source / evidence | Safe visual affordances | Unsafe over-interpretations |
|---|---|---|---|---|---|
| **RB-01** | **Multiple peer readings coexist for one subject** | More than one durable `hypotheses` row may be held at once; nothing in the runtime ranks them | `apps/api/src/hypothesis/hypothesis.types.ts:9` `MAX_ACTIVE_HYPOTHESES = 32` (**per user**); no per-subject cap found; `question_candidates` forbids ranking by CHECK (`database/migrations/0007_…` `question_candidate_uncalibrated_check`) | Parallel spatial presence; equal columns; a field; simultaneous grouping; any composition that shows plurality at once | Order read as rank; a "main + others" split; count rendered as a figure that can read as a score (`A14`); claiming a single subject exposes 32 peers — **`32` is VI-02's synthetic stress ceiling, per user, not a production peer count** |
| **RB-02** | **A reading's own statement** | Long human-facing text, ≤2000 chars, the validated identity source. May be `SYSTEM_GENERATED` — it is not necessarily the user's literal wording | `hypothesis.types.ts:14` `MAX_STATEMENT_LENGTH = 2000`; `HYPOTHESIS_ORIGINS` includes `SYSTEM_GENERATED`; VI-02 `F-05` | Typography as the primary structural material; measure, rhythm, weight; the statement as the object itself rather than a payload inside a container | Presenting it as a quotation of the user; any morphology that assumes a short title exists |
| **RB-03** | **Explicit stored role membership: supporting / contradicting** | A recorded item stands in a named role in a named reading. Nominal, never graded. Disjoint within one reading; ≤32 per role | `hypothesis.types.ts:21` `supporting_evidence_ids` / `contradicting_evidence_ids`, `MAX_EVIDENCE_LINKS_PER_ROLE = 32`; `hypothesis.service.ts:39-48` enforces role disjointness; VI-01 `O07`/`O08` role words | A *kind*-differentiated mark (two distinguishable mark families); explicit role words; adjacency between a record and the readings it stands in | Thickness/size/colour-intensity as amount; counting roles as strength; a "score" derived from the balance of supporting vs contradicting |
| **RB-04** | **One record standing in more than one reading — including "some but not all"** | The same `memories` row is cited by several `hypotheses` rows, possibly in different roles | Separate stored memberships per hypothesis row; Phase V `A4`, Truth Manifest §1 | The shared-material region (`L-22`); a genuine connection drawn between a record and each reading it stands in; enclosure/grouping that expresses actual co-membership | A connection between two *readings* inferred from a shared record; the shared region as a centre or verdict; "closeness" derived from how many records two readings share |
| **RB-05** | **Assumptions and disconfirming conditions per reading** | Human-language lists, ≤8 each, ≤500 chars each, and **may be empty** | `hypothesis.types.ts:12-13,16`; identity contract §1 | Structural differentiation between a reading's claim and what it rests on / what would undo it; layered or progressive reveal | Rendering emptiness as a deficiency; a completeness meter; treating the counts as rigour |
| **RB-06** | **Named unknowns with an explicit lifecycle** | `information_gaps` are named, occupy space while `OPEN`, and move to `RESOLVED` / `SUPERSEDED` in words | `database/migrations/0007_question_information_gap_runtime.sql`; migration `0063` lifecycle (`status`, `closed_at`, `closure_reason`, `open_epoch`); Phase V `A7` | An unknown drawn as a *present, named* object rather than an absence; an open mark that closes when the status does | An error/refusal state; a scored gap; "incomplete" framing; a level below "established" |
| **RB-07** | **A recorded gap relates to specific readings** | `information_gaps.related_hypothesis_ids` (≤16) plus an owner-scoped `information_gap_hypotheses` join table | `database/migrations/0007_question_information_gap_runtime.sql` | A drawable relation between an unknown and the readings it bears on | Direction/causality on that relation; ordering readings by how many gaps touch them |
| **RB-08** | **Recorded material is made from the user's own words, with a record date, a category and a status** | `memories` rows, deterministic non-model extraction, `source = 'USER_STATED'`; date is a **record** date, not an event date | `apps/api/src/memory/memory.repository.ts` field list (`content`, `type`, `source`, `status`, `created_at`, `updated_at`); Phase V `A8`, Truth Manifest §1 | Provenance one press away at the record; a consistent record identity across surfaces | Typographic quotation as transcription; record date read as when it happened; memory→turn provenance; occurrence counts |
| **RB-09** | **One intelligence across depths** | A record keeps one identity, one provenance line and one interaction logic on every surface it appears on | Phase V `A19`, `A1` | A single mark/typographic system whose *expression* deepens from Conversation → Live Context → Deep Analysis | Exporting analysis marks into the conversation (`A16`, `L-24`); a morph/transition that implies the object changed |
| **RB-10** | **Explicit user context activation for four kinds** | A binding proves only that an authenticated binding command executed against an owned target. Kinds: `GOAL`, `SITUATION`, `DECISION`, `RELATIONSHIP`; at most one per kind; 0–4 total; returned in a fixed canonical kind order | `apps/api/src/human-model/him-session-context-binding.types.ts:16-21,57-63`; `PUT/DELETE/GET /conversation/sessions/:id/context-bindings` — **client-exposed today** | A bounded, explicit statement of what is in play; reader-driven activation/removal; a stable, non-ordinal arrangement | Treating the fixed kind order as priority; binding presence as importance, relevance or strength — **the boundary carries no target text, relevance score, confidence, reason or metric value** (that file's own header comment) |
| **RB-11** | **Conversation and its per-turn timestamps** | Sessions and turns are durable and own-row readable; a turn may be cancelled | `apps/api/src/conversation/conversation.controller.ts` (`POST sessions`, `GET sessions/:id`, `POST …/turns`, `PATCH …/turns/:turnId/cancel`); Phase V Truth Boundaries | Conversation as the primary durable surface; real temporal sequence within a session | A cross-session chronology of the user's life; conversation time read as analysis time |
| **RB-12** | **Thin data is a normal product state** | Zero readings, one reading, no relation, no unknown are all valid; two readings are **not** guaranteed | Phase V `A12`, Truth Boundaries; VI-02 density findings §5; `hypotheses` are only ever CANDIDATE/ACTIVE in the represented set | Compositions designed for n=0, n=1, n=2 as first-class, not as degraded states | A layout that needs two peers to make sense; "so far"/"only one" framing that implies more is coming |
| **RB-13** | **A recorded reading↔reading link exists in the record shape — `competing_hypothesis_ids`** ⚠ **`NOT DRAWABLE IN VI-03`** | A capped (≤16) owner-scoped list, written only by an explicit `linkCompetitor` command that rejects self-linking and requires both records owned | `hypothesis.types.ts:11,22` `MAX_COMPETING_HYPOTHESES = 16`; `hypothesis.service.ts:49-54` `linkCompetitor` | **None.** Existence in storage is **not** sufficient by itself to authorize a visual relation. It stays outside drawable VI-03 truth **unless the product-visible runtime/exposure contract has been separately reviewed and explicitly approved** | Turning it into a line, edge, grouping, strength, rank, causality or any other visual assertion. The word "competing" is a record name, not a validated product semantic; no client route reads or writes it at this baseline; neither Phase V nor VI-02 evaluated it. See disposition `Q-2` |

## C.1 The overview ⇄ focus transition is a behavioural truth, and therefore expressible

Focus is a **reader-created, reversible view state** that recomputes nothing (`L-07`, Phase V
`A9`/`A10`). A foreground/background transition, a recomposition, or a change of scale between
overview and focus is therefore an honest expression of something real. What it may not do is
imply that the system judged, selected, recalculated or re-ranked anything.

## C.2 What is emphatically NOT runtime-backed, and why the temptation is strong

| Tempting claim | Status | Evidence |
|---|---|---|
| Confidence / certainty of a reading | **Does not exist as a quantity** | `numeric_score IS NULL`, `confidence_band IS NULL` CHECK constraints, `database/migrations/0006_confidence_runtime.sql` |
| Question value / information gain / ranking | **Does not exist as a quantity** | `CHECK(expected_information_gain IS NULL AND question_utility IS NULL AND ranking_state='UNASSESSED')`, `database/migrations/0007_…` |
| Relationship strength | **Not carried** | Phase V `A5`, `A6`; VI-02 legacy guardrail §3 |
| A short reading label | **Does not exist** | No approved runtime short-label field; no validated semantic-label derivation contract (`VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` §2.2.1). Standing: `DEFERRED POSSIBILITY — NOT REQUESTED` |
| A durable subject object above the reading/session level | **Does not exist** | Phase V Truth Manifest §2.3; `A20` is conditional on the runtime one day having one |
| Guaranteed-distinct peer statements | **Forbidden as an assumption** | `L-12` |

---

# SECTION D — SIMULATED-ONLY DESIGN RESEARCH

Concepts that may be genuinely useful in high-fidelity exploration but are **not currently
production-backed**. Each must be labelled, wherever it appears, exactly as:

> **`SIMULATED FOR DESIGN RESEARCH — NOT CURRENT PRODUCTION SEMANTICS`**

Phase V requires the same discipline it applied to its own harness: the declaration must live in
more than one place — in the artefact, in its file/route names, and in the reviewer
documentation — and must never be burned into a rendered state as decoration
(`QANDEEL_V10_TRUTH_MANIFEST.md` §0; `QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md`
§"Runtime / Truth Boundaries" → DESIGN / PROTOTYPE).

| # | Simulated item | Why it may be valuable for visual exploration | What production semantic is missing | What must never be implied to the user |
|---|---|---|---|---|
| **S-01** | **Live Context contextual-relevance spatialization** — items positioned or recomposed nearer/farther, more/less present, by how related they are to what the conversation is about right now | It is the reserved capability that gives Live Context its only legitimate spatial work; without simulating it, Live Context's final form cannot be designed. Phase V explicitly permits simulating it for exactly this purpose | **No client-readable relevance computation exists.** The context-binding boundary carries no relevance score at all (`him-session-context-binding.types.ts` header). Production's bounded material selection is a **recency window**: ≤64 most-recently-updated ACTIVE memories (`apps/api/src/memory/evidence.service.ts` `EVIDENCE_CANDIDATE_LIMIT = 64` / `MAX_ELIGIBLE_EVIDENCE = 64`; ordering `updated_at.desc,id.desc` in `apps/api/src/memory/memory.repository.ts`). Recency is not a contract for contextual-relevance spatialization | That any current near/far position is runtime-derived relevance. **And never** that nearer means more important, more true, more strongly supported, more confident, more certain, higher priority, higher rank or more correct (`A15` non-equivalence law). Scope: **Live Context only** — it never reaches peer readings, Deep Analysis, the shared region or the conversation. Needs a non-spatial accessible equivalent and must survive reduced motion (`A23`) |
| **S-02** | **A durable subject anchor** organising the analysis | Anchors the composition and is the natural first mark in most spatial morphologies | No durable subject object exists above the reading/session level | That QANDEEL holds a subject as a stored thing. `A20` is conditional on a future runtime |
| **S-03** | **A product-semantic read/fetch of analysis state** (any screen that shows readings, records, roles, unknowns to a client) | Every North-Star scene needs it to exist at all | No product read API. Only conversation, context-bindings and health are exposed (§0.2) | That this screen exists in the product today |
| **S-04** | **A Home surface** | Needed for any Conversation→Analysis continuity scene that starts before the conversation | Not present in the runtime | That it is a shipped surface |
| **S-05** | **Cross-screen continuity navigation** — recognising the same recorded sentence in Conversation → Live Context → Deep Analysis, and "see its role in the readings" | This is the single hardest `AT RISK` quality (Section F) and cannot be shown without it | Not production-backed navigation | That the product can currently route between these surfaces |
| **S-06** | **Live Context recomposition and removal-from-current-context** | Needed to show the field as a living surface rather than a static list | Prototype logic only; effect is session-scoped and non-destructive by design | That removal deletes or judges the record |
| **S-07** | **Stress density itself** — dense multi-peer sets, many shared records, several unknowns | Required for the density-scalability scene; without it the composition is never tested | Reviewer construction. `32` is a **per-user** cap used as a synthetic ceiling | That QANDEEL produces this much material, or that a subject typically exposes this many readings |
| **S-08** | **Any structural consequence of a correction** | Tempting for motion design — a correction that visibly changes something | Correction is `RECEIVED` / `PENDING` and nothing else | That anything downstream changed. **No motion may be attached to the correction path** (`A11`) |
| **S-09** | **Answer-linked gap closure; user-driven reading status change** | Attractive as narrative arcs for a North Star | Neither is supported | That a reader can resolve an unknown by answering, or retire/reject a reading |
| **S-10** | **Reading states beyond the represented set** (`SUPPORTED` / `MIXED` / `WEAK` / `REJECTED` / `RETIRED`) | Would give a designer a status vocabulary to compose with | The enum exists in `HYPOTHESIS_STATUSES`, but Phase V records that hypotheses are only ever CANDIDATE/ACTIVE in what is represented, and lists these states as forbidden to infer | That QANDEEL grades or retires readings. These read as verdicts and collide with peer equality |
| **S-11** | **Cross-session persistence of explicit context activation** as shown in prior prototypes | Affects how permanent the Live Context field should feel | Not established | That bindings persist across sessions as drawn |

## D.1 The rule that keeps a prototype from becoming false documentation

Any VI-03 artefact that contains **any** row above must, at minimum:

1. carry the label string verbatim in the artefact itself, visible to a reviewer;
2. name the simulated items individually — a blanket "this is a prototype" is not a
   declaration; and
3. never present a simulated behaviour in a way that a reader could mistake for a description
   of the shipped product.

A simulation is **never** evidence of production support and must never be cited as one
(`QANDEEL_PHASE_V_Closure_Structural_Grammar_Freeze.md` §1.5).

---

# SECTION E — VISUALLY OPEN MORPHOLOGY

VI-03 is free to explore all of the following. **No preferred answer is proposed here, and the
order carries no preference.**

**Information shape**
- information shape before text — what the eye understands before it reads
- spatial fields; clusters; circles; nodes; threads; relation lines
- grouping and enclosure; proximity; overlap; layering; depth
- rhythm, weight, spacing, adjacency as non-textual structure
- visual anchors that let the eye find its place before reading everything
- progressive reveal; layered disclosure
- visual transformation between overview and focus — assembly, recomposition, arrival, return
- final set morphology **and** final small-count composition (n=2 / n=3 may be composed
  differently from n=12 / n=32 — it is the same behaviour drawn for a set that fits)
- search / filter / sort / group / jump-to / sticky index — **neither frozen in nor frozen out**

**Continuity**
- Conversation → Live Context → Deep Analysis continuity: how one intelligence reads as opening
  further rather than as three products
- how the extra stage (conversation → *set* → reading) is composed so it does not feel like a
  dashboard boundary

**Language and type**
- typography, type system, measure, optical sizing
- Arabic/English composition as two authored languages
- RTL/LTR behaviour beyond mirroring
- numeral policy expression (the policy itself is a later Phase VI decision)

**Surface**
- colour; material / surface behaviour; light; ground
- iconography
- motion; transitions; choreography; reduced-motion equivalents
- generative / parametric graphic behaviour
- Q brand-mark integration where semantically appropriate
- responsive density behaviour; the 375px composition and its desktop counterpart

**Density**
- final density styling; preview length or its absence; how many readings share a viewport
- how ambiguity resolution and travel reduction are balanced — they are in **direct tension**
  (density findings §3)

> ## Open morphology does not mean open semantics.
>
> **A new shape may be invented; a new product meaning may not.**
>
> A circle is open. A circle that means *confidence* is not. A thread is open. A thread that
> means *causality*, or that joins two readings on no recorded relation, is not. Motion is open.
> Motion that implies something was recomputed is not.

---

# SECTION F — LEGACY QUALITY / AMBITION BENCHMARK

The legacy work is a **quality and ambition floor only** — not a canonical direction, not a
style source, and nothing in it was copied
(`VI02_LEGACY_ANTI_REGRESSION_GUARDRAIL.md`).

## F.1 Qualities worth preserving

| Quality | Standing at VI-02 closure | What VI-03 must do |
|---|---|---|
| **Analytical presence** | `AT RISK — MUST BE ACTIVELY PROTECTED IN VI-03` | Nothing in the frozen semantics prevents the architecture from being drawn as a settings list — and the tested prototype honestly is one. Presence must be **drawn**; it is not delivered by the behaviour |
| **Narrative / spatial intelligibility** | `AT RISK` | Recomposition is preserved by the architecture, but **time, relation, adjacency and grouping are absent from the tested surface**. The legacy's threads, brackets and temporal rhythm have no counterpart yet |
| **Conversation ↔ Analysis continuity** | `AT RISK` | Untested, not preserved: both VI-02 prototypes begin at a subject anchor with no conversation above them, and the architecture adds a stage (conversation → set → reading). This is the most likely place for the product to start feeling like a dashboard |
| **Distinct QANDEEL character** | `PRESERVED BY ARCHITECTURE` | Every comparable product ranks, scores and summarises. QANDEEL's architecture structurally refuses all three. This is a *structure*, not chrome — do not spend it on generic surface treatment |
| **Meaning-led hierarchy** | `PRESERVED BY ARCHITECTURE` | Emphasis follows meaning and reader action. Nothing is emphasised decoratively |

Also worth carrying from the strongest previous work: a **graded expressive language where
expression rises only when meaning does**; **one continuous mark language** across
conversation → reflection → map with each mark having a stated job; and **giving understanding a
shape** rather than reducing everything to prose.

## F.2 Legacy weaknesses that must not be automatically restored

| Rejected legacy element | Standing |
|---|---|
| Dark-purple + brass/gold as QANDEEL's automatic identity | **not restored** — and not banned as a colour *choice*; what is rejected is its status as a mandatory identity |
| Glow everywhere | **not restored** |
| Particles / decorative stars | **not restored** |
| Numeric confidence percentages | **not restored** — and impossible (`L-15`) |
| Graded `strong / medium / weak` relationship claims | **not restored** — and unsupported (`L-16`) |
| Numbered node badges as meaning | **not restored** — and forbidden as identity (`L-05`) |
| Fixed life-domain maps | **not restored** (`L-18`) |
| Unsupported causal arrows | **not restored** (`L-17`) |
| A physical lantern outside the Authentication Gateway | **not restored** |
| Sci-fi / HUD spectacle; generic card overload | **not restored** |

## F.3 The lesson that matters most

> **The legacy bought its spatial density by asserting a taxonomy the runtime never had.**

The legacy mobile map fits nine related nodes and their connections onto one 375px screen —
genuinely more legible-at-a-glance than four peers per screen with five screenfuls of travel.
It achieved that by reducing each node to two words drawn from an **invented** life-domain
taxonomy and by grading the connections. Neither the labels nor the grades exist in the runtime.
**The compression is not craft; it is a claim.**

So the honest framing is not "the legacy was denser, VI-02 regressed". It is:

> The legacy bought density by asserting a taxonomy. VI-02 refuses the assertion and pays for it
> in vertical distance. **Recovering that density honestly is VI-03's real problem** — and it is
> solvable, because the constraint is not "statements must be shown as rows". The constraint is:
> *wherever a reading is represented by less than its statement, the whole statement must be
> reachable there without committing to it* (`L-06`).

A per-row disclosure control is one instance of that rule. **A spatial composition whose nodes
open in place is another.** That is the bridge between the legacy's ambition and the runtime's
honesty — and it is a **permission, not a requirement**.

---

# SECTION G — NORTH-STAR TEST SCENES

A fixed set of scenes every later visual direction must render, so directions can be compared
apples-to-apples. **They are not drawn in this task.**

Global requirements for all nine scenes: Arabic and English versions of the system must both be
*composed* (not mirrored); every scene must state which Section D items it simulates; no
measured VI-02 number is a target.

**No simulated item is ever implicit.** Each scene names its own dependencies in full, including
`S-03` — every scene that shows readings, records, roles or unknowns to a client inherits it
under Section D's own definition, and a scene-level declaration is required even where the
dependency looks obvious.

---

### G-01 · Conversation → Analysis transition

- **UX truth tested:** continuity — that going deeper reads as *the same intelligence opening
  further*, not as arriving in a second product (`RB-09`, `A1`, `A19`).
- **Required content/state:** a real conversational session above the analysis; at least one
  recorded item that is recognisable in both places; the route from conversation into the set.
- **Must prove:** the same object keeps one identity, one provenance line and one interaction
  logic across the boundary; expression rises with depth without the analysis grammar leaking
  into the conversation (`L-24`).
- **Failure modes:** a hard "app switch" feeling; role/relationship marks appearing in the chat;
  a transition that implies the system computed something on crossing; the extra
  conversation → *set* → reading stage reading as a toll gate or dashboard shell.
- **Simulated:** `S-03`, `S-04`, `S-05`.

### G-02 · Overview with 2–3 peer readings

- **UX truth tested:** peer equality with no winner and no implicit hierarchy at the
  **least-composed** count — the surface VI-02 flags as most in need of VI-03's attention.
- **Required content/state:** 2 (and separately 3) peers; every statement whole (nothing cut, so
  no disclosure is even offered); record dates; the equality statement in words.
- **Must prove:** a reader who never activates anything has still read the analysis's substance;
  the surface looks like an intelligence organising something rather than two paragraphs and a
  hairline; equality is carried in words *and* not contradicted by the composition.
- **Failure modes:** inertness; one peer visually first-among-equals; equality asserted only by
  symmetry; a composition that needs a third peer to make sense (`RB-12`).
- **Simulated:** `S-03`.

### G-03 · Dense multi-peer overview

- **UX truth tested:** scanability and density scalability under stress — where the architecture
  is proven *identity-safe and scalable*, and explicitly **not proven pleasant to scan**.
- **Required content/state:** a hostile ceiling set (VI-02 used 32 as a synthetic per-user
  ceiling); crucially, a **normal-case** dense set — peers about one subject that share an
  opening — because that, not the adversarial edge, is where scanning is hardest.
- **Must prove:** every peer present, reachable, equal and identifiable; ambiguity resolvable
  without the set growing unusably longer; the eye can find its place before reading everything.
- **Failure modes:** solving density by hiding, summarising or truncating (`L-20`); a "+N more"
  that is not reachable; a jump/index mechanism that introduces an ordinal identity; treating
  32-per-subject as a production claim.
- **Simulated:** `S-03`, `S-07`.

### G-04 · Focused reading

- **UX truth tested:** reversible reader-chosen foregrounding with a permanent, named return.
- **Required content/state:** one reading raised from the set; its assumptions and disconfirming
  conditions (including the empty case); the return route visible throughout.
- **Must prove:** the return route never disappears and names where it goes (`L-08`); returning
  restores the set as it was left and visibly recomputes nothing (`L-07`); the transition reads
  as recomposition, not as a new page.
- **Failure modes:** immersive/full-bleed focus that swallows the return; motion implying
  recalculation; a lingering "current" marker on the returned overview (`L-09`); empty
  assumptions rendered as a deficiency.
- **Simulated:** `S-03`.

### G-05 · Shared material / recorded relationship state

- **UX truth tested:** honest representation of the one relation the architecture already draws.
- **Required content/state:** at least one record standing in more than one reading, including a
  "some but not all" case; role words for each membership; the shared region in reading order.
- **Must prove:** the record is shown once with every reading it stands in named and the role it
  carries in each (`L-22`, `RB-04`); the relation is legible as a *kind* of membership, not an
  amount; the shared region recedes like anything else when the reader raises something else.
- **Failure modes:** thickness/size/proximity as strength (`L-16`); a line between two *readings*
  inferred from a shared record; the shared region reading as a verdict or centre; a connection
  drawn for composition rather than for a recorded membership (`L-17`).
- **Simulated:** `S-03`.

### G-06 · Live Context

- **UX truth tested:** the boundary between production-backed semantics and reserved,
  simulated-only spatialization — on the same surface, in the same direction.
- **Required content/state:** the bounded field with explicit reader activation/removal;
  0–4 context bindings across the four supported kinds; **two variants** — one strictly
  production-backed (flat, nothing nearer/larger/darker at rest) and one exercising the reserved
  contextual-relevance spatialization, clearly labelled.
- **Must prove:** the production variant asserts flatness; the reserved variant carries
  `SIMULATED FOR DESIGN RESEARCH — NOT CURRENT PRODUCTION SEMANTICS` (`S-01`), ships a
  non-spatial accessible equivalent, and stays understandable under reduced motion (`L-23`);
  nearer means *only* more related to the current conversation, identically in RTL and LTR.
- **Failure modes:** the two variants being indistinguishable to a reviewer; relevance sliding
  into importance/confidence/priority; the reserved semantic leaking onto peer readings or Deep
  Analysis; the fixed canonical kind order read as priority (`RB-10`); English wording that
  implies computed relevance — note **`Live Context` English wording is `OPEN`** in VI-01
  (`S03`).
- **Simulated:** `S-01`, `S-03`, `S-06`. (`S-06` because the scene requires reader activation /
  removal and a recomposing field; the context **bindings** themselves are `RB-10` and
  client-exposed today, but the recorded material shown in the field is not.)

### G-07 · Arabic mobile — 375px

- **UX truth tested:** RTL as the primary composed case, not an adaptation.
- **Required content/state:** long Arabic statements, long shared material and a long subject
  simultaneously, at a true 375×812 viewport; keyboard reachability; 200% text size.
- **Must prove:** composed RTL from the start; logical direction throughout; no horizontal
  overflow at 200% text with every statement revealed; generous Arabic line-height; no
  `letter-spacing`, no italics on Arabic.
- **Failure modes:** a mirrored LTR layout; directional metaphors that imply precedence; clipping
  that hides the divergent half of a statement; measuring at a wider viewport than the one
  claimed.
- **Simulated:** `S-02`, `S-03`. (`S-02` because this scene renders a durable subject anchor as
  an object — the long-subject stress case — not merely subject matter in prose.)

### G-08 · English / desktop counterpart

- **UX truth tested:** that the system is bilingual **structurally**, not merely mirrored, and
  that the composition scales to a wide surface without becoming a dashboard.
- **Required content/state:** the same scenario as G-07 in authored English at desktop width.
- **Must prove:** both languages are authored compositions of the same structure; the wide
  surface earns its extra space (adjacency, grouping, field) rather than stretching rows.
- **Failure modes:** English-first design with Arabic retrofitted; a desktop layout that
  introduces a hierarchy the mobile one does not have; enterprise-dashboard chrome arriving with
  the extra width.
- **Simulated:** `S-02`, `S-03` — inherited from G-07, whose scenario this scene repeats.

### G-09 · Late-divergence identity stress case

- **UX truth tested:** that similar or duplicated labels cannot collapse identity or navigation.
- **Required content/state:** the measured pair — identical for 262 (AR) / 336 (EN) characters,
  identical record date, type, domain and scope, no assumptions, no disconfirming conditions —
  plus, separately, a genuinely **exact-duplicate** pair.
- **Must prove:** the two are separable **on the choosing surface, before any commitment**
  (`L-06`); the accessible name carries the same identity truth as the visible one; the
  exact-duplicate pair is left honestly identical.
- **Failure modes:** any short-label morphology that quietly relies on excerpts (`L-11`);
  ordinals, letters, UUIDs, rank or invented labels used to tell them apart (`L-12`); an
  abbreviation with no non-committing route to the whole statement; identity that changes when
  the peer set changes.
- **Simulated:** `S-03`. (The late-divergence pair and the exact-duplicate pair are both states
  the current runtime genuinely permits — `L-11`, `L-12` — so neither is a simulated semantic;
  only the surface that shows them to a client is.)

---

# SECTION H — COMPARISON CRITERIA FOR VI-03-02+

Evaluation dimensions for later critique of divergent North Stars. **No scoring, ranking or
weighting is applied here; no directions exist yet.**

| # | Dimension | The question it asks |
|---|---|---|
| **X-01** | Pre-reading comprehension | What does the reader understand *before* reading — is there information shape before text? |
| **X-02** | Spatial intelligibility | Does the arrangement itself carry meaning, and is that meaning true? |
| **X-03** | Analytical richness | Does it look like an intelligence organising something, or like a settings list? |
| **X-04** | Truthfulness to runtime | Does every drawn relationship, weight, direction and quantity trace to a record? |
| **X-05** | Peer equality | Is equality structural, or asserted in copy while the composition contradicts it? |
| **X-06** | Overview / focus clarity | Is the transition legible, reversible and obviously non-computational? Is the return always there and named? |
| **X-07** | Bilingual / RTL robustness | Are both languages composed, or is one a mirror? |
| **X-08** | Dense-state scalability | What breaks between n=2 and the stress ceiling — distance, or brokenness? |
| **X-09** | Small-count composition | Is n=2 / n=3 a first-class composition or a degraded one? |
| **X-10** | Conversation ↔ Live Context ↔ Analysis coherence | Does depth increase while the object stays the same? |
| **X-11** | Distinctive QANDEEL character | Is the refusal to rank, score and summarise *visible* as character? |
| **X-12** | Avoidance of generic AI SaaS / dashboard / card-stack aesthetics | Would this be recognisable with the logo removed? |
| **X-13** | Avoidance of sci-fi cosplay / HUD / VisionOS imitation | Is futurity carried by intelligence or by costume? |
| **X-14** | Accessibility | WCAG 2.2 AA floor; name/role/value; structural association; keyboard; focus visible; no meaning by colour alone; reflow at 375px / 200% |
| **X-15** | Reduced-motion viability | Does meaning survive with motion disabled — and is no state carried by motion alone? |
| **X-16** | Non-spatial equivalence | Does every spatial meaning have a non-spatial equivalent (`L-23`)? |
| **X-17** | Implementation feasibility | Can it be built without depending on an animation frame, a smooth scroll or a scheduling race (`D5`)? |
| **X-18** | Responsive behaviour | Does a real breakpoint crossing preserve draft, caret, focus, open disclosures and the reader's place? |
| **X-19** | Graphics without decorative noise | Does each graphic device earn its place by improving attention, comprehension, relation or navigation — and survive repetition without becoming texture? |
| **X-20** | Simulation hygiene | Is every simulated-only element labelled so the artefact cannot be mistaken for product documentation? |

---

# SECTION I — NOT DECIDED IN VI-03-01

`NOT DECIDED IN VI-03-01`

- **no palette selection**
- **no dark/light mode selection**
- **no purple/gold commitment** — neither adopted nor banned as a colour choice; only its
  legacy status as a mandatory identity stays rejected
- **no typography freeze**
- **no card / row / node / circle / field commitment** — including no commitment *against* rows
- **no illustration style freeze**
- **no iconography freeze**
- **no motion language freeze**
- **no final Q integration rule**
- **no surface / material freeze**
- **no final density style**
- **no final North Star**
- **no Graphic Language freeze**

Additionally not decided here: numeral policy; final Arabic rendered-surface microcopy; the
English `Live Context` / return / remove-from-context wording (VI-01 `OPEN`); search, filter,
sort, group, jump-to and sticky-index behaviour; and whether a second surface value is admitted
at all.

---

# EVIDENCE DISPOSITIONS — Q-1 … Q-4

The four evidence questions VI-03-01 raised were ruled on by the Product / Creative Direction
authority in `VI-03-01R`. The dispositions are recorded below and **applied** in this document.
**None remains open.** No runtime, schema or prior-phase change is requested by any of them.

### Q-1 · Canonical paths and the VI-03 archive slug — `RESOLVED`

**Disposition:** use the repository's established Phase VI naming convention and the canonical
VI-02 freeze filename.

**Applied.** This brief lives at
`docs/design/phase-vi/vi-03-visual-north-star-graphic-language/`, matching
`vi-01-bilingual-product-language/` and `vi-02-analysis-navigation-density/`. The VI-02 freeze is
cited throughout by its canonical name, **`VI02_BEHAVIORAL_NAVIGATION_FREEZE.md`**.

*Provenance note only.* The originating VI-03-01 task text named source files under
`docs/design/phase-vi/vi01/` and `docs/design/phase-vi/vi02/`, and a file
`VI02_BEHAVIORAL_FREEZE.md`. Those paths exist at no reviewed baseline; every intended document
was located under the canonical paths above and read. Recorded as provenance, not as an open
question.

### Q-2 · `competing_hypothesis_ids` — `RESOLVED: NOT DRAWABLE IN VI-03`

**Disposition:** existence in storage or in the runtime record shape is **not sufficient by
itself to authorize a visual relation.** Until the product-visible semantics, exposure path,
meaning and truth contract are **separately reviewed and explicitly approved**, VI-03 must not
turn it into a line, edge, grouping, strength, rank, causality, or any other visual assertion.

**Applied** at `RB-13`.

The field is real: a capped (≤16) owner-scoped list written only by an explicit `linkCompetitor`
command (`apps/api/src/hypothesis/hypothesis.types.ts:11,22`;
`apps/api/src/hypothesis/hypothesis.service.ts:49-54`). Neither the Phase V structural grammar
freeze nor any VI-02 document evaluates it, and no client route reads or writes it at this
baseline. It is also the relation most likely to be drawn as rivalry or opposition, which would
collide with peer equality (`A2`) and with the ban on ordinal relationship semantics
(`A6`, `A15`). The standard VI-02's freeze sets for exposing a relation applies here in full:
its own task, its own runtime evidence, its own review — **before any line is drawn.**

### Q-3 · PR #188 / FIX-01 provenance — `RESOLVED AS PROVENANCE WORDING`

**Disposition:** PR #188 is the VI-02 documentation / freeze archive merge. **Do not claim that
it introduced a production or runtime "semantic-scale determinism fix."** Describe FIX-01 only
according to the canonical diff and provenance observed at the baseline.

**Applied.** The observed provenance, and the only claim this brief makes about it:

- **PR #188** — *"docs: freeze VI-02 analysis navigation architecture"*, merged as `313d1431`.
  **Documentation-only:** 9 changed files, all under `docs/`.
- **FIX-01** — its second commit, `733d0019`, *"docs: tighten VI-02 freeze truth boundaries"*,
  applying canonical-truth wording corrections to that archive, among them the three named review
  corrections **C1** (the statement is the canonical identity *source*, not a ban on all
  excerpts), **C2** (statement uniqueness is never assumed), **C3** (F-12 scoped to the validated
  architecture rather than a permanent prohibition).

**No production, runtime, schema, migration or determinism change exists in PR #188, and this
brief asserts none.** Every runtime fact cited in Sections B and C is read directly from the
source files and migrations at the baseline, never inferred from that PR.

### Q-4 · Phase V `B1`/`B2`/`B3` vs VI-02 `F3` — `RESOLVED BY AUTHORITY ORDER`

**Disposition:** VI-02's frozen behavioural / navigation contract is the **later and governing
authority** for the peer-analysis behaviour VI-02 covers. The older Phase V archive is **not**
edited or rewritten in this work; the supersession is recorded only where the VI-03 brief needs
it.

**Applied** at **Section A.3**, which records Phase V `B1`/`B2`/`B3` (the paged peer stage) as
superseded by VI-02 `F-01`…`F-12` and carries forward only their surviving principles — every
peer reachable, controls equal, no orphan column, the gesture never the only route. **No Phase V
file is modified.** A reader arriving at `QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md` on its own
should read Section A.3 alongside it.

---

# SOURCE INDEX

All paths are at `313d1431d4b80acb5703fbd9d7f4f78cae74fc81`.

**Phase VI — VI-01 (language authority)**
- `docs/design/phase-vi/vi-01-bilingual-product-language/README.md`
- `docs/design/phase-vi/vi-01-bilingual-product-language/ARCHIVE-MANIFEST.md`
- `docs/design/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_TERMINOLOGY_MATRIX.md`

**Phase VI — VI-02 (behaviour / navigation authority)**
- `docs/design/phase-vi/vi-02-analysis-navigation-density/README.md`
- `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_BEHAVIORAL_NAVIGATION_FREEZE.md`
- `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md`
- `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_DENSITY_AND_SCALABILITY_FINDINGS.md`
- `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md`
- `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_LEGACY_ANTI_REGRESSION_GUARDRAIL.md`
- `docs/design/phase-vi/vi-02-analysis-navigation-density/VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md`
- `docs/design/phase-vi/vi-02-analysis-navigation-density/ARCHIVE-MANIFEST.md`

**Phase V (runtime / semantic truth authority)**
- `docs/design/phase-v/QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md`
- `docs/design/phase-v/QANDEEL_PHASE_V_Closure_Structural_Grammar_Freeze.md`
- `docs/design/phase-v/QANDEEL_V10_TRUTH_MANIFEST.md`

**Runtime source and constraints**
- `apps/api/src/hypothesis/hypothesis.types.ts` — caps, record shape, enums
- `apps/api/src/hypothesis/hypothesis.service.ts` — create/find/transition/attachEvidence/linkCompetitor
- `apps/api/src/hypothesis/hypothesis-generation.policy.ts` — `hypothesisCollisionKey`
- `apps/api/src/memory/memory.repository.ts` — memory fields, `updated_at.desc,id.desc` ordering
- `apps/api/src/memory/memory-retriever.service.ts` — lexical selection for model context (server-internal; not a client-readable relevance contract)
- `apps/api/src/memory/evidence.service.ts` — `EVIDENCE_CANDIDATE_LIMIT` / `MAX_ELIGIBLE_EVIDENCE = 64`
- `apps/api/src/human-model/him-session-context-binding.types.ts` — four kinds; no relevance/score/metric on the boundary
- `apps/api/src/conversation/conversation.controller.ts`, `conversation-context-activation.controller.ts`, `apps/api/src/health/health.controller.ts` — the entire HTTP surface
- `database/migrations/0006_confidence_runtime.sql` — `numeric_score IS NULL`, `confidence_band IS NULL`
- `database/migrations/0007_question_information_gap_runtime.sql` — `question_candidate_uncalibrated_check`, information-gap shape

---

**`VI-03-01 — EXPLORATION BRIEF COMPLETE. NOTHING FROZEN. NO VISUAL DIRECTION SELECTED.`**

Next stage — `VI-03-02 — Divergent Visual North Stars` — opens only when the Product /
Creative Direction authority explicitly opens it.
