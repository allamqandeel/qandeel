# QANDEEL — Stage 5.3 Candidate Package v1
## Timeline Disclosure + Temporal Legibility Contract

**Status:** CANDIDATE v1 — for Product / Experience / Architecture review. **Not complete. Not frozen.** No self-declaration of closure is made anywhere in this package.
**Date:** 2026-09-03
**Authority:** `QANDEEL_STAGE5_3_EXECUTION_AUTHORIZATION.md` (Pre-Flight APPROVED), over `QANDEEL_NAVIGATION_CANONICAL_CHECKPOINT_v1` (Stages 0–4, frozen), the frozen Stage 5.1 contract, and the frozen Stage 5.2 contract.
**Scope discipline:** no repository changes, no code, no Replay, no final Timeline styling, no reopening of Stages 0–4 / 5.1 / 5.2, no resolution of deferred OPEN items.

---

## 0. Reading guide

| § | Section | Authorization §17 item |
|---|---------|------------------------|
| 1 | Checkpoint / Pre-Flight compliance statement | 1 |
| 2 | Research synthesis | 2 |
| 3 | Disclosure taxonomy | 3 |
| 4 | Timeline-vs-Map boundary analysis | 4 |
| 5 | State-dependent disclosure matrix | 5 |
| 6 | FOLLOW_LIVE disclosure contract | 6 |
| 7 | PINNED(TC) disclosure contract | 7 |
| 8 | Preview disclosure contract | 8 |
| 9 | Live Edge / latest Moment legibility requirement | 9 |
| 10 | Density / aggregation contract | 10 |
| 11 | Suspended IF + Live-meta contract | 11 |
| 12 | Accessibility / nonvisual contract | 12 |
| 13 | Mobile / narrow contract | 13 |
| 14 | Adversarial findings | 14 |
| 15 | Recommended Stage 5.3 contract (MUST / MUST NOT / SHOULD / MAY / OPEN) | 15 |
| 16 | Proof Board A — Timeline Disclosure States | 16 |
| 17 | Proof Board B — Temporal Disclosure Adversarial Stress | 17 |
| 18 | Remaining OPEN items | 18 |
| 19 | Architecture Review Handoff | 19 |
| A | Traceability — rules → AT-01…AT-18 | §17 closing requirement |

**Naming used throughout.** Proposed rules are labelled `D-nn` (disclosure rules). Adversarial scenarios are `AT-01…AT-18` (binding, from the approved Pre-Flight Gate) and `X-01…X-12` (the additional attacks required by Authorization §15). Findings surfaced during execution are `F-nn`.

---

## 1. Checkpoint / Pre-Flight compliance statement

**Frozen upstream preserved.** Stages 0–4 (Experience Architecture, Analysis Grammar, Conversation World, Static Visual Language, Pan + Semantic Zoom Navigation), Stage 5.1 (Temporal State + Map Orientation Contract) and Stage 5.2 (Timeline Navigation Grammar) are treated as binding and are not reopened. This package adds **no member to `S = { LH, LF, TM, TC, K(TC), IF, MC, RH }`**, adds no navigation primitive, and changes no commit, preview, entitlement, restoration or history semantics.

**Pre-Flight rulings applied.**
- **OPEN-06 (bookmarks) — DEFER.** This package invents no bookmark marker and **reserves no Track space** for one. Bookmarks appear nowhere in the taxonomy, matrix, contract or boards.
- **OPEN-08 (coarse-step granularity) — DEFER.** Aggregation is defined strictly as a *legibility* operation. Rule **D-25** states explicitly that no aggregate is a navigation unit; no bucket stepping, coarse jump unit, keyboard step granularity or navigation increment is defined or implied anywhere.
- **OPEN-12 — PARTIALLY IN SCOPE.** §9 states the semantic legibility requirement only. No control shape, icon, label wording, gesture, typography, motion or visual treatment is frozen.
- **AT-13 clarification applied.** The Live-meta bound in §11 permits only "Live has continued beyond TC" and "an explicit route back to Live exists", and forbids name, Thread, direction, location, Home locus, semantic category, analytical state, count and content summary — with the added magnitude and rate constraints in **D-30/D-31**.

**Deferred OPEN items not resolved.** OPEN-02, OPEN-06, OPEN-08, OPEN-09, OPEN-10 are untouched. Where a deferred item borders a disclosure decision, the border is named and the decision is made on the disclosure side only (§18).

**Contradictions with frozen rules.** None encountered. Execution surfaced two places where a frozen rule forces a non-obvious consequence rather than a contradiction — disclosure withdrawal on backward commit (**F-01**) and the focus-order count channel (**F-04**); both are resolved *inside* the frozen rules and are reported in §14.1, not treated as grounds to reinterpret anything upstream.

**Not present in this package:** Replay; final colour, typography, icons, motion, production animation or Timeline skin; runtime architecture, renderer, schema or coding strategy; any repository change.

---

## 2. Research synthesis

Targeted research only, on the questions the frozen grammar leaves genuinely open. Sources are primary (W3C normative and supporting documents, MDN reference, library reference for a technique). **No source is used as authority for QANDEEL product semantics** — each supplies a transferable principle only, and every QANDEEL implication is derived from the frozen contracts, not from the source.

**Unreachable / not relied upon.** Three sources intended for the Stage 5.2 corpus remain unreachable in this environment and are again **not** relied upon here: Esri ArcGIS TimeSlider reference (404), Apple HIG Sliders (script-rendered, no body), WHATWG HTML §4.8.11.9 seeking algorithm (document truncates before the section). Two Stage 5.2 findings are **carried forward without re-derivation** and marked as such (2.6).

### 2.1 Status messages must reach assistive technology without stealing focus — W3C WCAG 2.2, Understanding SC 4.1.3

- **Source.** WCAG 2.2 Understanding SC 4.1.3 Status Messages.
- **Finding.** Status messages "can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus." A status message informs about success, waiting state, progress or error, and is *not* delivered by a change of context. `role=status` is the sufficient technique for action results; `role=log` for progress updates.
- **Reusable principle.** A state change that a sighted user perceives passively must be perceivable passively by everyone — without moving focus and without interrupting the current task.
- **QANDEEL implication.** The temporal-mode state (`FOLLOW_LIVE` / `PINNED`), the settle of a commit, and the Live-continued indication are exactly this class: they must be exposed through a polite status channel rather than by focus movement (**D-33**). It also constrains them: because the channel is passive and repeated, it must carry *no payload beyond the permitted state* (**D-31**).
- **Pattern not to copy.** WCAG's own examples announce quantities ("18 results returned", "5 items"). QANDEEL must **not** carry a count into this channel while pinned — the pattern is the *channel*, not the *payload*.

### 2.2 Politeness, atomicity and relevance of live announcements — MDN, ARIA live regions

- **Source.** MDN Web Docs, "ARIA live regions".
- **Finding.** `aria-live="polite"` speaks "changes whenever the user is idle"; `assertive` "should only be used for time-sensitive/critical notifications that absolutely require the user's immediate attention". `role="status"` is implicitly polite. `aria-atomic="true"` "ensures that each time the live region is updated, the entirety of the content is announced in full"; `aria-relevant` selects which mutations announce at all (default `additions text`).
- **Reusable principle.** Announcement volume and frequency are design decisions with semantic consequences: what is re-announced, how completely, and how often are all choices about what the surface *asserts*.
- **QANDEEL implication.** The Live-continued indication must be polite, never assertive (it is orientation, not an alert), and — decisively — must **not re-announce per new committed Moment**, because announcement *rate* is itself a count channel (**D-31**). Mode changes announce atomically as a whole state ("Pinned", "Following live") rather than as a diff, so that no partial value implies a magnitude.
- **Pattern not to copy.** The clock example (announcing each tick) is the precise anti-pattern for a pinned Timeline: a per-tick live region would leak the arrival rate of future Moments.

### 2.3 Announced value should be meaning, not number — MDN, `aria-valuetext`

- **Source.** MDN Web Docs, `aria-valuetext`.
- **Finding.** `aria-valuetext` is "only needed when the numeric value of `aria-valuenow` is not meaningful"; "when both the `aria-valuetext` and `aria-valuenow` are included, the `aria-valuetext` is announced."
- **Reusable principle.** A single control can be given a spoken value that differs from its numeric one, and the spoken form is what the user actually receives.
- **QANDEEL implication.** The Track is announced as *mode + selected position meaning*, never as a coordinate, and never as a ratio (Stage 5.2 FREEZE-02, carried into **D-32**). Because `aria-valuetext` overrides the number, it is also the mechanism by which a numeric `valuenow`/`valuemax` pair must **not** be exposed while pinned: a `valuemax` equal to `LH` would publish the future total even if never spoken (**D-34**).
- **Pattern not to copy.** The battery example ("8% (34 minutes) remaining") pairs a value with a total and a projection — three things the pinned Timeline may not say.

### 2.4 Structure conveyed visually must be available non-visually — W3C WCAG 2.2, Understanding SC 1.3.1

- **Source.** WCAG 2.2 Understanding SC 1.3.1 Info and Relationships.
- **Finding.** "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text." The intent is that relationships implied by visual formatting "are preserved when the presentation format changes"; "when such relationships are perceivable to one set of users, those relationships can be made to be perceivable to all."
- **Reusable principle.** Visual and nonvisual surfaces must carry the *same* structure.
- **QANDEEL implication.** Parity is **bidirectional and is the mechanism of the firewall, not an exception to it**: any structure the Track shows visually must be available nonvisually, and therefore any structure forbidden nonvisually is forbidden visually. This is why the no-hindsight rule cannot be satisfied by hiding a count from the screen while leaving it in the accessibility tree, or vice versa (**D-35**).
- **Pattern not to copy.** None; this is a floor. It is cited to establish that accessibility parity *tightens* the disclosure contract rather than relaxing it.

### 2.5 Sequential navigation order carries meaning — W3C WCAG 2.2, Understanding SC 2.4.3

- **Source.** WCAG 2.2 Understanding SC 2.4.3 Focus Order.
- **Finding.** "If a web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability." Focus order must preserve "the hierarchy and relationship of content implied by the visual presentation."
- **Reusable principle.** The *set and sequence of focus stops* is itself an information channel, not merely a convenience.
- **QANDEEL implication.** This yields **F-04**: if the Track exposed one focus stop per Moment, a keyboard or screen-reader user could enumerate them and recover the count — including future ones — defeating AT-04 and AT-15 while the visual Track remained compliant. Hence **D-36**: the Track exposes a single composite temporal control, and the post-`TC` region exposes **no per-Moment focus stops at all**.
- **Pattern not to copy.** Rich per-item focus lists (a common timeline treatment) are exactly the leak.

### 2.6 Binning is a choice, and a bin denotes only membership — d3-array `bin()`

- **Source.** d3-array reference, `d3.bin()`.
- **Finding.** `bin()` groups "quantitative values into consecutive, non-overlapping intervals, as in histograms". Each bin is an array with bounds `x0`/`x1`, and "the `length` of the bin is the number of elements in that bin". Bin count is a function of the chosen thresholds: "the generated bins will have `thresholds.length + 1` bins."
- **Reusable principle.** An aggregate is a *derived container*, defined by an arbitrary threshold choice; it denotes membership in an interval and nothing else. Change the thresholds and the "shape" changes without any change in the underlying data.
- **QANDEEL implication.** Two consequences. (i) An aggregate must never become a canonical object — it has no identity, is not nameable and is not inspectable as a thing (**D-26**), precisely because its existence is an artefact of a threshold. (ii) Because bin length is a count, aggregation applied to the post-`TC` region would publish a future count in graphical form; aggregation is therefore permitted **only over the region at or before `TC`** (**D-24**).
- **Pattern not to copy.** Histogram semantics generally — a histogram invites reading height as significance. QANDEEL's aggregate means only "more eligible disclosure occurred in this interval", never more importance (**D-27**).

### 2.7 Carried forward from Stage 5.2 (not re-derived)

- **Live edge is a moving referent, not a position** (RFC 8216, HLS). Retained as the basis for the `LIVE_EDGE` / `Moment(m)` distinction, which Stage 5.2 froze and §9 here only makes *legible*.
- **Seek start ≠ seek settle; the approximate path is never the authority** (MDN `seeking`/`seeked`/`fastSeek()`). Retained as the basis for Preview being a declared *unsettled* condition rather than a temporary committed world (§8).

### 2.8 Synthesis

| Principle | Where it lands |
|-----------|----------------|
| Passive state must reach AT without focus | `D-33` polite status channel for mode / settle / Live-continued |
| Announcement rate and atomicity are payload | `D-31` no per-Moment re-announcement; atomic mode announcements |
| Spoken value is the real value | `D-32` mode + meaning, never coordinate or ratio; `D-34` no future-bearing numeric properties |
| Visual/nonvisual parity is bidirectional | `D-35` the firewall binds both surfaces identically |
| Focus stops are an enumeration channel | `D-36` single composite control; no post-`TC` per-Moment stops |
| A bin is a threshold artefact denoting membership | `D-24` aggregation only ≤ `TC`; `D-26` aggregate is not an object; `D-27` neutral meaning |

---

## 3. Disclosure taxonomy

Every candidate class required by Authorization §3 is evaluated individually against the Timeline-vs-Map boundary test (§4) and the frozen firewall. **No analytical material is defaulted to Timeline-visible.**

Classification vocabulary is the authorized one: `TIMELINE-ELIGIBLE` · `ELIGIBLE ONLY AS AGGREGATED/STRUCTURAL` · `MAP-ONLY` · `STATE/CHROME ONLY` · `FORBIDDEN` · `DEFER`.

### 3.1 Temporal position

| # | Class | Classification | Reasoning |
|---|-------|----------------|-----------|
| 1.1 | Current selected temporal position (`TC`) | **TIMELINE-ELIGIBLE** | This is the Timeline's own subject. Answers boundary test A directly; asserts nothing analytical. |
| 1.2 | Temporal mode (`FOLLOW_LIVE` vs `PINNED`) | **TIMELINE-ELIGIBLE** (state) | Without it the user cannot tell whether what they see is present or historical — the single most load-bearing orientation fact in Stage 5. Frozen Stage 5.2 already requires a persistent indicator on narrow projections. |
| 1.3 | Live-Edge target state | **TIMELINE-ELIGIBLE** | The moving referent must be identifiable as a target distinct from `Moment(LH)` — see §9. |

### 3.2 Temporal extent

| # | Class | Classification | Reasoning |
|---|-------|----------------|-----------|
| 2.1 | Current-session start `m_0` | **TIMELINE-ELIGIBLE** | `m_0` is the Track's own origin, always knowable at any `TC ≥ m_0`. It is **not** a Session partition and introduces no cross-session structure: it is the single boundary the authorization admits, and the Track has exactly one of them. |
| 2.2 | Past extent `[m_0, TC]` | **TIMELINE-ELIGIBLE**, metric | Entirely at-or-before `TC`, therefore legitimately knowable. This is the surface that answers Q7 (elapsed conversational shape). |
| 2.3 | Post-`TC` navigable extent `(TC, LH]` while pinned | **ELIGIBLE ONLY AS AGGREGATED/STRUCTURAL** — and only in the degenerate, **non-metric** form defined by `D-20` | Reachability is required (later current-session time must remain addressable) but *magnitude* is a future quantity. See §7.2 — this is the sharpest rule in the package. |
| 2.4 | Total current-session extent while pinned (i.e. `m_0 … LH` as one measured span) | **FORBIDDEN** | A measured total is "N" in graphical form; AT-04 forbids "4 of 9" and parity forbids the visual equivalent. |

### 3.3 Conversational structure

| # | Class | Classification | Reasoning |
|---|-------|----------------|-----------|
| 3.1 | Individual committed Moments / CUs as marks, at or before `TC` | **ELIGIBLE ONLY AS AGGREGATED/STRUCTURAL** | Legitimate (past) and useful for orientation, but individually marking every Moment is neither required for addressability (Stage 5.2's non-drag equivalence is satisfied by step controls and address entry) nor legible at density. Marks are a legibility affordance, never a semantic assertion. |
| 3.2 | Structural density of committed Moments, at or before `TC` | **ELIGIBLE ONLY AS AGGREGATED/STRUCTURAL** | Permitted under the neutrality rules of §10; denotes only "more eligible disclosure occurred here". |
| 3.3 | Pauses / gaps between Moments | **DEFER** | A gap is only expressible if the axis is duration-proportional rather than ordinal, and no upstream contract entitles "elapsed silence" with a meaning. Deferred to **OPEN-13** (axis metric) rather than guessed. Deferring is the conservative reading: nothing is shown that would assert an unentitled meaning. |
| 3.4 | Session start boundary only | **TIMELINE-ELIGIBLE** | Same as 2.1. Explicitly **not** a partition, and no other Session boundary exists on the Track (FORBIDDEN-01). |

### 3.4 Semantic / analytical marker candidates

Default rule applied: **no analytical class is Timeline-eligible by default** (Authorization §3 closing sentence). Each is evaluated, not assumed.

| # | Class | Classification | Reasoning against tests A / B / C |
|---|-------|----------------|-----------------------------------|
| 4.1 | Thread / focus change | **ELIGIBLE ONLY AS AGGREGATED/STRUCTURAL** — as an *anonymous transition point*; identity is **MAP-ONLY** | A: yes — "the conversation moved" is a conversational-time fact and the main thing a person means by "what happened when". B: the *fact* of movement is not an interpretation; the *identity* of what it moved to is. C: an unnamed transition series gives shape, not content; a **named** series would be a topical outline of the session — a partial reconstruction of the analytical world. Therefore transitions may be structural and unnamed by default; naming resolves only through explicit interaction that routes into the Map. |
| 4.2 | Reading creation / update | **MAP-ONLY** | B fails outright: a Reading is exactly "what QANDEEL thinks this means". |
| 4.3 | Relation establishment | **MAP-ONLY** | B fails; and AT-05 makes this the canonical future-leak vector. Relations are Stage 3.4 material with entitlement rules the Track cannot carry. |
| 4.4 | Evidence participation | **MAP-ONLY** | B fails. Stage 3.4 forbids count/proximity/repetition from becoming evidence strength; a time axis would supply all three. |
| 4.5 | Confidence change | **FORBIDDEN** | Plotting confidence against time creates a confidence trace — a second analytical world in the most literal sense (C fails), and Stage 3 forbids brightness/size encodings of confidence. Not merely Map-only: it must not exist as a Timeline class at all. |
| 4.6 | Correction / supersession transition | **MAP-ONLY in v1** (evaluated, not assumed — see §4.3) | A partially passes ("something was corrected here" is a conversational event). B and C fail in practice: a supersession marker is only useful if it says *what* was corrected, and a series of them is the analytical narrative's turning points. §10 of the authorization also forbids inferring markers from retained lineage. Recorded as the **strongest candidate for reconsideration** if Architecture wishes to admit exactly one analytical class. |
| 4.7 | Question / information-gap events | **MAP-ONLY** | Unknown / Question are epistemic objects in the frozen Stage 3.3 family. B fails. Navigationally attractive, which is precisely why the boundary must hold. |
| 4.8 | Any other analytical transition supported upstream | **MAP-ONLY** by default | `D-12` states the default explicitly so that future analytical capabilities do not silently acquire Track presence. |

### 3.5 Live meta

| # | Class | Classification | Reasoning |
|---|-------|----------------|-----------|
| 5.1 | Live Edge while `FOLLOW_LIVE` | **TIMELINE-ELIGIBLE** | The present is legitimately knowable when you are at the present. |
| 5.2 | Live-continued indication while pinned | **STATE/CHROME ONLY** | Permitted by the AT-13 ruling, bounded by `D-30`/`D-31`: existence and route only; no magnitude, no rate, no identity. |

### 3.6 Inspection / return chrome

| # | Class | Classification | Reasoning |
|---|-------|----------------|-----------|
| 6.1 | Suspended `IF` reference | **STATE/CHROME ONLY**, knowledge-gated | Frozen Stage 5.2 rule carried into disclosure; see §11. |
| 6.2 | Generic return target when identity unavailable | **STATE/CHROME ONLY** | The generic affordance is the *only* permitted form when identity is not Known at `TC`. |
| 6.3 | Known-name vs unavailable-context distinction | **STATE/CHROME ONLY** | Known canonical name may remain; future context / locus may not be named. |
| 6.4 | A Track marker for a retained `RH` reference | **FORBIDDEN** | Authorization §11: no marker may be created merely because `RH` retains the reference internally. |

### 3.7 Density / aggregation constructs

| # | Class | Classification | Reasoning |
|---|-------|----------------|-----------|
| 7.1 | Aggregation for legibility, at or before `TC` | **ELIGIBLE ONLY AS AGGREGATED/STRUCTURAL** | Permitted under §10's neutrality rules. |
| 7.2 | Structural compression, at or before `TC` | **ELIGIBLE ONLY AS AGGREGATED/STRUCTURAL** | Same, provided addressability is unchanged. |
| 7.3 | Empty stretches | **TIMELINE-ELIGIBLE as absence** — with no compensating emphasis | An empty stretch is shown by *nothing being there*; it must not attract emphasis to neighbours (AT-11). |
| 7.4 | Aggregation of the post-`TC` region | **FORBIDDEN** | The authorization's density rule: even anonymous density after `TC` leaks future structure. |

### 3.8 Nonvisual / accessibility equivalents

| # | Class | Classification | Reasoning |
|---|-------|----------------|-----------|
| 8.1 | Announced value of the temporal control | **TIMELINE-ELIGIBLE**, gated | Mode + selected-position meaning; never coordinate, ratio or total (§12). |
| 8.2 | Status announcements (mode change, settle, Live-continued) | **STATE/CHROME ONLY**, polite | Per 2.1/2.2; payload bounded by the same firewall. |
| 8.3 | Focus-order metadata / per-Moment stops | **FORBIDDEN** after `TC`; single composite control overall | `F-04`; enumeration is a count channel. |
| 8.4 | Count summaries of any kind while pinned | **FORBIDDEN** | AT-04 / AT-15 directly. |
| 8.5 | Nonvisual equivalents of every eligible visual class | **TIMELINE-ELIGIBLE**, with identical gating | Parity is bidirectional (2.4). |

---

## 4. Timeline-vs-Map boundary analysis

The mandatory boundary test, applied as three questions to every candidate class in §3.

### 4.1 The test as applied

- **A — Does it help answer "Where am I / what changed in conversational time?"** Passing A makes a class *possibly* eligible. Position, mode, extent, structure and transition-shape pass A.
- **B — Does it primarily answer "What does QANDEEL think this means?"** Passing B is disqualifying for the Timeline. Readings, relations, evidence, confidence, questions and corrections all pass B and are therefore Map-path material.
- **C — Would showing it let a user reconstruct the analytical world without entering the Map?** This is the *aggregate* test: a set of individually innocuous classes can jointly fail C. Named focus transitions plus supersession markers plus question markers would together constitute a readable session narrative — which is why 4.1's identity is Map-only and 4.6/4.7 are Map-only.

### 4.2 The resulting boundary, stated once

> **The current-session Timeline discloses conversational time. It does not disclose analytical meaning.**

Everything on the Track answers *when* and *how much conversation*; nothing on it answers *what QANDEEL concluded*. Exactly one semantic-adjacent class (focus transition) is admitted, and only in anonymous structural form, because the fact that attention moved is a property of the conversation rather than of the analysis.

### 4.3 The one deliberate near-miss, recorded honestly

Correction / supersession (4.6) is the strongest argument against the boundary as drawn. It is a genuine conversational event, it is what a person most often wants to return to, and Authorization §10 asks explicitly whether the *transition* is eligible even though the versions are not.

It is classified **MAP-ONLY in v1** for three reasons: (i) a supersession marker is navigationally useless unless it identifies what was corrected, and identification is analytical; (ii) a series of them is precisely the analytical narrative, failing test C in aggregate; (iii) admitting it would create the first analytical class on the Track and thereby the precedent that "important enough" analytical events earn Track presence — the mechanism by which a navigator becomes a feed.

This is a judgement, not a derivation. It is flagged for Architecture as the single most reasonable place to overrule this package, and §18 records it as a review question rather than burying it.

### 4.4 Red-flag check (AT-17)

Applying the test to the whole proposal: with the taxonomy as classified, a user who never opens the Map can learn *when* the session started, *where in it they are*, whether they are live or historical, how much conversation has elapsed up to their position, roughly where its movements were, and that live has continued. They cannot learn a single Thread name, Reading, relation, evidence link, confidence, correction or question. The analytical world remains unreachable except through the Map. **No red flag raised** — see X-12.

---

## 5. State-dependent disclosure matrix

Values: **V** visible · **H** hidden · **A** aggregated (legibility only, neutral) · **G** generic only · **K** knowledge-gated · **F** forbidden · **—** not applicable.

The `PINNED(TC)` column is split into the two regions the authorization requires (`≤ TC` and `TC < position ≤ LH`).

| Disclosure class | FOLLOW_LIVE | PINNED · region ≤ TC | PINNED · region TC < pos ≤ LH | Preview active at PTC | Preview cancelled | Post-commit / pre-settle | Narrow / mobile | Nonvisual / a11y |
|---|---|---|---|---|---|---|---|---|
| 1.1 Selected temporal position `TC` | V | V | — | V (preview position, marked *unsettled*, distinct from `TC`) | V (`TC` only; preview position removed) | V (`TC` already committed) | V (priority 2) | V — announced as meaning |
| 1.2 Temporal mode | V | V | V | V + explicit "previewing" status | V | V ("settling" permitted) | **V (priority 1, mandatory)** | V — atomic status |
| 1.3 Live-Edge target state | V | V (as target) | V (as target) | V | V | V | V | V — must differ from "latest Moment" |
| 2.1 Session start `m_0` | V | V | — | V | V | V | V (priority 3) | V |
| 2.2 Past extent `[m_0, TC]` | V (= `[m_0, LH]`) | V metric | — | V metric to `PTC` when `PTC > TC`, else to `TC` | V metric to `TC` | V | V (priority 3) | V — described, never totalled |
| 2.3 Post-`TC` extent | — | — | **A — non-metric only (`D-20`)** | Metric **only up to `PTC`**; `(PTC, LH]` remains non-metric | Reverts to non-metric | Non-metric | Non-metric | Reachability stated; **no magnitude** |
| 2.4 Total session extent as a measured span | — | F | F | F | F | F | F | F |
| 3.1 Individual Moment marks | A | A | **F** | A up to `PTC` | A up to `TC` | A | A (fewer, priority 5) | No per-Moment stops (`D-36`) |
| 3.2 Structural density | A | A | **F** | A up to `PTC` | A up to `TC` | A | A | Described qualitatively, never counted |
| 3.3 Pauses / gaps | DEFER (OPEN-13) | DEFER | F | DEFER | DEFER | DEFER | DEFER | DEFER |
| 3.4 Session start boundary | V | V | — | V | V | V | V | V |
| 4.1 Focus transitions — *fact* | A (anonymous) | A (anonymous) | **F** | A up to `PTC` | A up to `TC` | A | A (priority 6, first to drop) | Announced as anonymous structure |
| 4.1 Focus transitions — *identity* | **MAP-ONLY** | MAP-ONLY | F | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY |
| 4.2 Reading create/update | MAP-ONLY | MAP-ONLY | F | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY |
| 4.3 Relation establishment | MAP-ONLY | MAP-ONLY | F | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY |
| 4.4 Evidence participation | MAP-ONLY | MAP-ONLY | F | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY |
| 4.5 Confidence change | **F** | F | F | F | F | F | F | F |
| 4.6 Correction / supersession | MAP-ONLY | MAP-ONLY | F | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY |
| 4.7 Question / gap events | MAP-ONLY | MAP-ONLY | F | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY | MAP-ONLY |
| 5.1 Live Edge (present) | V | — | V (as target only) | V | V | V | V | V |
| 5.2 Live-continued indication | — | — | **G** (existence + route only) | G | G | G | G | G — polite, non-repeating |
| 6.1 Suspended `IF` reference | — | **K** | — | K | K | K | K (priority 4) | K — same gating |
| 6.2 Generic return target | — | G | — | G | G | G | G | G |
| 6.3 Known-name vs unavailable context | — | K | — | K | K | K | K | K |
| 6.4 Track marker from retained `RH` | F | F | F | F | F | F | F | F |
| 7.1 Aggregation for legibility | A | A | **F** | A up to `PTC` | A up to `TC` | A | A | Qualitative only |
| 7.3 Empty stretch | V as absence | V as absence | — | V as absence | V as absence | V as absence | V as absence | Described as absence, not measured |
| 8.4 Count summaries | — | F | F | F | F | F | F | F |

**Reading of the matrix.** Three columns are load-bearing and are stated as contracts in §6–§8: `FOLLOW_LIVE`, the two-region `PINNED(TC)`, and Preview. Two columns are consequences rather than new policy: *Preview cancelled* must equal the committed column exactly (`D-23`), and *post-commit / pre-settle* may differ from settled only by adding a "settling" state indication — never by adding or removing a disclosure class (`D-19`).

---

## 6. FOLLOW_LIVE disclosure contract

- **D-01.** While `TM = FOLLOW_LIVE`, the entire Track domain `[m_0, LH]` is at-or-before the effective `TC` and is therefore legitimately disclosable at the eligibility levels of §3. No firewall region exists in this state.
- **D-02.** The mode itself is disclosed. A user must be able to determine, without acting, that what they see is the present.
- **D-03.** As `LH` advances, disclosure updates continuously and the Live-Edge target remains the endpoint. Advancement is not announced per Moment (`D-31`); the mode state is announced when it *changes*, not when it *persists*.
- **D-04.** Eligible classes are exactly those marked `V`/`A` in the FOLLOW_LIVE column: position, mode, Live-Edge state, `m_0`, extent, aggregated structure, anonymous focus transitions, absence. Analytical classes remain Map-only in this state as in every other — being live is not an entitlement to analytical disclosure on the Track.
- **D-05.** Nothing in this state may be presented in a form that cannot be withdrawn on a backward commit (see `F-01`, `D-21`).

---

## 7. PINNED(TC) disclosure contract

### 7.1 The region at or before `TC`

- **D-06.** `[m_0, TC]` is disclosed at the same eligibility levels as the `FOLLOW_LIVE` Track, evaluated in `K(TC)`. Everything here was legitimately knowable at `TC`.
- **D-07.** Historical disclosure uses the same classes and the same encodings as the live state. Being historical changes *what is available*, never *what things mean*.
- **D-08.** The mode indication is mandatory in this state on every projection and every surface. A historical view that cannot be recognised as historical is the primary failure mode of the whole stage.

### 7.2 The region `TC < position ≤ LH` — the non-metric reachability rule

This is the sharpest requirement in Stage 5.3, and it follows from combining two frozen rules: later current-session time must remain reachable (Stage 5.2 addressability), and no future-relative-to-`TC` quantity may be disclosed (firewall + the authorization's anonymous-density rule).

A proportional axis satisfies the first and violates the second: the *length* of the post-`TC` region is a graphical statement of how many Moments have been committed since `TC` — a picture of "of N".

- **D-20 (post-`TC` non-metric reachability).** While `TM = PINNED(TC)`, the region `TC < position ≤ LH` is a **non-metric reachability affordance**. Its presented magnitude, subdivision, internal structure and density MUST be independent of the number, spacing, kind or clustering of committed Moments after `TC`. It may express only (i) that later current-session time is reachable and (ii) the permitted Live-meta state. It carries no marks, no ticks, no aggregate, no gradient, no focus stops.
- **D-21 (licensed resolution).** Metric resolution of that region is licensed **only** by the user's own explicit forward Preview or commit into it, and only as far as the explicitly reached position (`D-17`). The act of navigating forward is what legitimises knowing how far forward one has gone.
- **D-22 (withdrawal).** On a backward commit, disclosure that was legitimate at the previous position MUST be withdrawn from the Track, even if the same user saw it moments earlier while live. The firewall governs what the surface *asserts now*, not what a person remembers; a Track that retains previously-seen structure after pinning is disclosing future-relative-to-`TC` information (see `F-01`).
- **D-09.** No count, total, ratio, progress proportion or "position of N" may be disclosed in any surface while pinned.
- **D-10.** No future object, label, name, marker, disabled control, placeholder or empty slot may appear after `TC`.
- **D-11.** The permitted Live-meta state (§11) is the only thing the post-`TC` region may say about the present.

### 7.3 Historical eligibility is evaluated in `K(TC)`

- **D-12.** A class's eligibility is evaluated against `K(TC)`, not against the current world. An anonymous focus transition at Moment 3 remains disclosable at `TC = 12`; a transition at Moment 20 does not exist for a Track pinned at 12 — not as a mark, not as a gap in a rhythm, not as a change in aggregate shape.
- **D-13.** No analytical class becomes eligible by being historical. Age does not launder analysis into orientation.

---

## 8. Preview disclosure contract

Stage 5.2 froze Model C and the structural preview envelope `P(PTC) = K(PTC) ↾ depth ≤ Z1`. Stage 5.3 defines what the **Track** discloses during Preview, strictly inside that envelope.

- **D-14.** During Preview, committed `TM/TC` remain unchanged, and `RH`, `IF` and `MC` remain authoritative and unchanged. Preview disclosure is presentation only.
- **D-15.** Preview may disclose **only the same classes** that are eligible in the committed state, evaluated at `PTC`. Preview never introduces a class that the committed Track would not show — in particular it never exposes analytical classes, and passing the pointer over a position asserts nothing about what is there.
- **D-16.** Preview MUST be distinguishable from committed state on every surface: visually it is marked as an *unsettled* preview position distinct from `TC`; nonvisually it is announced as a preview. A preview that reads as a commitment is a false state.
- **D-17.** Forward preview licenses metric resolution of `(TC, PTC]` only. The region `(PTC, LH]` remains non-metric under `D-20`. Scrubbing part-way forward does not reveal the whole future.
- **D-18.** Cancellation removes Preview disclosure **completely** and restores the committed disclosure exactly — including re-withdrawing any metric resolution the preview had licensed (`D-22` applies). The Preview-cancelled column of the matrix is identical to the committed column by construction (`D-23`).
- **D-19.** Between commit and settle, disclosure may add only a *settling* state indication. No class is added or removed by the settling phase itself.

---

## 9. Live Edge / latest Moment legibility requirement (OPEN-12, partial)

Stage 5.2 froze two target meanings that can occupy the same temporal coordinate. Stage 5.3 must ensure the disclosure model keeps them distinguishable — and must not prescribe the affordance.

- **D-28 (semantic legibility requirement).** The Timeline MUST provide **distinguishable state and target semantics for the moving Live Edge and for the absolute latest committed Moment, even when they occupy the same temporal coordinate.** Specifically the disclosure model must make it possible for a person to determine, without acting: (i) which of the two is currently selected, if either; (ii) that selecting one is not selecting the other; and (iii) which mode results from each — `FOLLOW_LIVE` or `PINNED(that Moment)`.
- **D-29 (parity).** The distinction MUST survive the nonvisual surface: the announced state must differentiate "following live" from "pinned at the latest moment", and must not render both as the same value merely because `TC == LH` numerically.
- **Explicitly not frozen here:** control shape, icon, label wording, gesture, typography, motion, production visual treatment, and whether the two are one control with two states or two controls. The affordance vocabulary remains deferred (OPEN-12 remainder, OPEN-02).

---

## 10. Density / aggregation contract

- **D-24 (scope).** Aggregation is permitted **only over the region at or before `TC`** (or `PTC` during a licensed forward preview). Aggregation of the post-`TC` region is forbidden (`D-20`).
- **D-25 (aggregation is not navigation).** An aggregate is a legibility construct only. It MUST NOT define, imply or become a navigation step unit, jump target granularity, keyboard increment or addressing unit. Disclosure aggregation and navigation granularity remain separate concepts; OPEN-08 stays deferred and untouched.
- **D-26 (an aggregate is not an object).** An aggregate has no canonical identity: it is not nameable, not addressable as a semantic entity, not inspectable as a thing, and never becomes a canonical object. It may resolve into its constituent positions on explicit interaction. (Grounded in 2.6: an aggregate's very existence is an artefact of a threshold choice.)
- **D-27 (neutral meaning).** A denser interval means only *more eligible temporal disclosure occurred in that interval* — never importance, confidence, truth strength, causal significance, ownership or recommendation priority. Aggregate encoding MUST NOT vary with any analytical property; two intervals with the same eligible-event count MUST present identically regardless of what those events were.
- **D-28b (empty stretches).** An empty stretch is disclosed by absence. No emphasis may be redistributed to neighbouring marks, no marker may be enlarged, no spacing may be adjusted and no "nearest event" magnetism may be introduced to fill it. Absence is a legitimate, meaningful, unembellished state.
- **D-27b (determinism).** Aggregation MUST be deterministic and reversible: the same eligible input at the same resolution produces the same aggregate, and the underlying positions remain individually addressable regardless of how they are grouped.

---

## 11. Suspended `IF` + Live-meta contract

### 11.1 Suspended Inspected Focus

- **D-37.** If `IF`'s identity is **not Known in `K(TC)`**, visible and nonvisual chrome may use only a generic return affordance equivalent to "Return to previous inspection". The future identity, name, category and locus are not disclosed on any surface.
- **D-38.** If the identity **is Known at `TC`** but a later contextual appearance is unavailable, the known canonical name may remain. The unavailable future context name, the future locus, future Thread ownership and any spatial hint are not disclosed.
- **D-39.** No Timeline marker may be created because `RH` retains the reference internally. Retention is memory, not disclosure.

### 11.2 Live meta while pinned

- **D-30 (permitted content).** The Live-meta indication may communicate only that (i) Live has continued or advanced beyond `TC`, and/or (ii) an explicit route back to Live exists. It may not communicate Live Focus name, Thread name, direction, location, Home locus, semantic category, analytical state, count of future Moments, or content summary.
- **D-31 (no magnitude, no rate).** The indication MUST be qualitative and MUST NOT encode magnitude — not by size, length, intensity, badge, number, or accumulation — and MUST NOT change per newly committed Moment. Its update *rate* is a count channel; it therefore presents as a stable state, not as a stream of events, and is never re-announced per Moment.
- **D-32b.** The indication is a status, not an alert: polite, non-interrupting, and never focus-stealing (2.1/2.2).

---

## 12. Accessibility / nonvisual contract

- **D-32 (announced value).** The temporal control's announced value is *mode + selected-position meaning*, never a coordinate, ratio or total. While pinned, permitted forms are equivalent to "Pinned — selected moment", "Pinned — moment 4" only where that index is past-inclusive and exposes no future total, and "Following live".
- **D-33 (status channel).** Temporal mode changes, settle, and the Live-meta state are exposed as polite status messages, programmatically determinable without receiving focus. They are never delivered by moving focus and never as alerts.
- **D-34 (no future-bearing numeric properties).** While pinned, no exposed numeric property may carry a future-relative-to-`TC` bound — including a maximum, total, length, percentage or progress proportion. A numeric value whose maximum is `LH` publishes the future total even if it is never spoken aloud.
- **D-35 (bidirectional parity).** Everything forbidden visually by the firewall is forbidden in announcements, labels, descriptions, focus-order metadata and summaries; and everything disclosed visually must have a nonvisual equivalent at the same gating. Parity tightens the contract; it never relaxes it.
- **D-36 (no enumeration channel).** The Track exposes a **single composite temporal control** rather than one focus stop per Moment. The post-`TC` region exposes **no per-Moment focus stops at all**. Sequential navigation must not allow the count or clustering of Moments — least of all future ones — to be recovered by traversal.
- **D-40.** Preview is announced as preview (`D-16`), and preview announcements are bounded by `P(PTC)` exactly as the visual surface is.

---

## 13. Mobile / narrow contract

- **D-41 (less simultaneous, not different).** Narrow projection reduces *how much is disclosed at once*. It never changes temporal meaning, marker semantics, eligibility or truth.
- **D-42 (deterministic priority order).** When space forces reduction, classes are dropped in a fixed, declared order — **(1) temporal mode, (2) selected position, (3) `m_0` and past extent, (4) suspended-`IF` / return chrome, (5) individual Moment marks and aggregated structure, (6) anonymous focus transitions** — highest priority retained longest. Priority 1 is never dropped: on any projection where the Timeline exists at all, the mode is disclosed. The order is a semantic ranking, not a layout.
- **D-43 (no new IA).** Narrow projection MUST NOT introduce a cross-session Timeline, detach the Timeline as a new primary screen or information architecture, reflow canonical Map geography, or expose information unavailable on wider surfaces.
- **D-44 (parity retained).** Accessibility parity is retained at every projection. Reduction of visual disclosure never reduces the nonvisual equivalent below the visual one, and never raises it above.

---

## 14. Adversarial findings

Verdict scale, chosen to permit failure: **PASS** (the contract as written resolves the attack), **PASS-WITH-OPEN** (resolves, but a declared OPEN item affects the exact surface), **CONDITIONAL** (resolves only if a stated rule is honoured in a later stage that this package cannot bind), **FAIL** (the contract does not resolve it). Verdicts are claims for Architecture to attack, not declarations of closure.

### 14.1 Findings surfaced during execution

- **F-01 — Disclosure withdrawal is required, and it will feel strange.** A user in `FOLLOW_LIVE` legitimately sees the full metric Track to `LH`. On pinning back to `TC`, the post-`TC` region must *withdraw* to non-metric (`D-22`), so the Track visibly "forgets" structure the user just saw. This is required by the firewall — the surface must not assert future structure regardless of what the user remembers — and it is not a contradiction with any frozen rule (no-relayout governs Map geography, not the Track). It is recorded because reviewers will meet it as an oddity, and because a designer trying to smooth it away would breach the firewall.
- **F-02 — The post-`TC` *extent itself* is a quantity.** The reason `D-20` exists: a proportional post-`TC` region is a graphical "of N" and defeats AT-04 without a single label. Every solution that keeps a proportional forward axis while pinned leaks.
- **F-03 — Anonymous is not the same as safe.** An unnamed density pattern after `TC` still discloses how much and how clustered the future is. Anonymity solves *identity* leakage, not *quantity* leakage.
- **F-04 — Focus order is a count channel.** One focus stop per Moment lets a keyboard or screen-reader user enumerate Moments — including future ones — while the visual Track remains compliant. Hence `D-36`. This is the clearest illustration that parity (2.4) tightens rather than relaxes the contract.
- **F-05 — Announcement rate is a count channel.** A Live-continued indication that re-announces per committed Moment publishes the arrival rate of future Moments through a channel with no visual equivalent. Hence `D-31`.
- **F-06 — Naming is what turns shape into narrative.** Anonymous focus transitions give conversational shape; the same transitions with names give a topical outline, which is a partial reconstruction of the analytical world. The eligibility boundary therefore falls between *fact of transition* and *identity of transition*, not between classes of event.
- **F-07 — Aggregation thresholds are authorship.** Because bin boundaries are chosen (2.6), an aggregate's shape is partly an authored artefact; `D-26`/`D-27b` prevent that artefact from acquiring identity or meaning.

### 14.2 Binding acceptance tests AT-01…AT-18

| # | Attack | Behaviour under this contract | Verdict |
|---|--------|-------------------------------|---------|
| AT-01 | Current-session only | The Track's domain is `M_current`; `m_0` is the Track origin, explicitly not a partition (3.2/3.4); no Session stepping, ranges or boundaries exist; past Sessions remain Map footprints and appear in no disclosure class | PASS |
| AT-02 | `Moment(LH)` remains pinnable | Disclosure never collapses the two target meanings: `D-28`/`D-29` require them to be distinguishable in state, in selection outcome and in announcement, even at one coordinate. Disclosure does not touch commit semantics | PASS-WITH-OPEN (affordance is OPEN-12 remainder) |
| AT-03 | `LIVE_EDGE` remains moving | In `FOLLOW_LIVE` the endpoint tracks `LH` and disclosure updates continuously (`D-03`); the Live-Edge target is disclosed as a target in both modes | PASS |
| AT-04 | Pinned future-count firewall | No total, ratio or "of N" on any surface (`D-09`); no numeric maximum bound by `LH` (`D-34`); the post-`TC` region is non-metric so no graphical equivalent exists (`D-20`); no enumeration by focus (`D-36`) | PASS |
| AT-05 | Future structural marker firewall | A relation first knowable at Moment 8 is Map-only in every state (4.3) and, at `TC = 4`, does not exist in `K(TC)` for disclosure purposes (`D-12`); no marker, disabled marker, count, placeholder, empty slot or accessibility hint may appear after `TC` (`D-10`) | PASS |
| AT-06 | Preview reveals only preview-legitimate structure | Preview discloses the committed classes evaluated at `PTC` and nothing more (`D-15`), resolves metrically only to `PTC` (`D-17`), and mutates no committed state (`D-14`) | PASS |
| AT-07 | Spatial input cancels Preview | Frozen Stage 5.2 behaviour is untouched; disclosure follows: preview disclosure is removed completely and the committed disclosure is restored exactly (`D-18`/`D-23`), with committed `TC` unchanged | PASS |
| AT-08 | `SP` is address, `RTO` is not | The address rule (`D-45`) admits only current-session `SP`. In this contract the question is largely moot for v1 because no analytical marker class is Timeline-eligible; the rule is stated so that any later-approved marker inherits it | PASS |
| AT-09 | `KF` is not Track address | Same rule; and explicitly: numeric coincidence of `SP` and `KF` does not make `KF` the address source (`D-45`) | PASS |
| AT-10 | Known superseded lineage ≠ clutter | Retained lineage creates no marker (`D-39` for `RH`; 4.6 for supersession); the versions remain Map/lineage material; no automatic duplicate marker requirement is introduced | PASS |
| AT-11 | Empty stretch ≠ importance | Absence is disclosed as absence with no compensating emphasis, enlargement, spacing change or magnetism (`D-28b`) | PASS |
| AT-12 | Dense stretch ≠ importance | Aggregation is permitted for legibility only, with fixed neutral meaning and encoding invariant to analytical properties (`D-27`), and never becomes an object (`D-26`) or a navigation unit (`D-25`) | PASS |
| AT-13 | Live Focus unavailable historically | Live-meta may say only that live continued and that a route back exists (`D-30`), with no magnitude or rate (`D-31`); `LF` name, Thread, direction, locus and category are disclosed nowhere | PASS |
| AT-14 | Suspended `IF` naming | Knowledge-gated: generic affordance when identity is unknown at `TC` (`D-37`); known canonical name retained but future context/locus never named when identity is known (`D-38`) | PASS |
| AT-15 | Accessibility parity | Bidirectional parity (`D-35`), gated announced value (`D-32`), no future-bearing numeric properties (`D-34`), no enumeration channel (`D-36`), polite non-repeating status (`D-33`/`D-31`) | PASS |
| AT-16 | Mobile is less simultaneous, not different truth | Deterministic priority order with mode never dropped (`D-42`); no new IA, no geography reflow, no extra information, no semantic change (`D-41`/`D-43`); parity retained (`D-44`) | PASS |
| AT-17 | Timeline remains navigation support | §4.4: with all analytical classes Map-only and transition identity Map-only, the analytical world cannot be reconstructed from the Track | PASS |
| AT-18 | No implementation decisions | This package defines disclosure semantics only; no runtime architecture, renderer, schema or coding strategy appears | PASS |

### 14.3 Additional required attacks X-01…X-12

| # | Attack | Behaviour under this contract | Verdict |
|---|--------|-------------------------------|---------|
| X-01 | Anonymous post-`TC` density leaking future structure | Defeated only by `D-20`: the post-`TC` region is non-metric and carries no marks, ticks, aggregate, gradient or density of any kind; `F-03` records why anonymity alone was insufficient | PASS |
| X-02 | Accessibility text leaking future count | `D-32` (no ratio/total), `D-34` (no future-bearing numeric bound), `D-36` (no enumeration), `D-31` (no per-Moment announcement) | PASS |
| X-03 | Superseded lineage creating Timeline clutter | Supersession is Map-only in v1 (4.6) and retained references create no markers (`D-39`); the Track's density is therefore unaffected by lineage depth | PASS |
| X-04 | `RTO` mistaken for Track address | `D-45` forbids `RTO` as position; an Event discussed at Moment 20 referring to June 2025 would address from `SP = 20` if ever approved for a marker | PASS |
| X-05 | `KF` mistaken for Track address | `D-45` forbids `KF` as position and states the coincidence clause explicitly | PASS |
| X-06 | Marker clustering implying importance | `D-27` fixes the meaning of density to "more eligible disclosure occurred here" and forbids encoding variation by analytical property; `D-26` prevents a cluster becoming an entity | PASS |
| X-07 | Empty stretch causing fabricated emphasis | `D-28b` forbids emphasis redistribution, enlargement, spacing adjustment and magnetism | PASS |
| X-08 | Narrow viewport changing semantic class | `D-41`/`D-42`: narrow drops whole classes by declared priority; it never re-encodes a class as a different one, and never exposes anything the wide surface does not | PASS |
| X-09 | Live meta leaking `LF` identity or location | `D-30` bounds content to existence + route; `D-31` bounds magnitude and rate; `D-32b` makes it a polite status rather than an event stream | PASS |
| X-10 | Latest Moment collapsing into `LIVE_EDGE` | `D-28`/`D-29` require distinguishable state, selection outcome and announcement at a shared coordinate. This package can require legibility but cannot supply the affordance that delivers it | **CONDITIONAL** — depends on the deferred OPEN-12 affordance honouring `D-28`/`D-29` |
| X-11 | Preview exposing deep analytical truth | `D-15` restricts Preview to the committed class set evaluated at `PTC`; analytical classes are Map-only in every column of the matrix, so no pointer movement can assert an analytical result | PASS |
| X-12 | Timeline becoming sufficient to understand the whole analytical world | §4.4's inventory: a Map-free user obtains time, position, mode, elapsed shape and live-continuation — and no Thread name, Reading, relation, evidence, confidence, correction or question | PASS |

### 14.4 Honest summary of verdicts

Eighteen binding tests and twelve required attacks were evaluated on a scale that permits failure. **No FAIL was found.** One test is **PASS-WITH-OPEN** (AT-02) and one attack is **CONDITIONAL** (X-10) — both for the same reason: Stage 5.3 can impose a legibility *requirement* on the Live-Edge/latest-Moment distinction but cannot itself supply the affordance, which is deferred. The two nearest misses elsewhere are recorded rather than smoothed: the withdrawal behaviour of `F-01` (required, and likely to be argued about), and the deliberate MAP-ONLY classification of supersession in §4.3 (a judgement, flagged for overrule).

---

## 15. Recommended Stage 5.3 contract

### MUST

1. **D-01/D-06.** Disclose the Track domain `[m_0, TC]` at the eligibility levels of the taxonomy, evaluated in `K(TC)`; in `FOLLOW_LIVE` this is the whole Track.
2. **D-02/D-08.** Disclose the temporal mode at all times, on every projection and every surface. Mode is priority 1 and is never dropped.
3. **D-20.** While `PINNED(TC)`, present `TC < position ≤ LH` as a **non-metric reachability affordance** whose magnitude, subdivision, internal structure and density are independent of the Moments after `TC`.
4. **D-21.** License metric resolution of that region only through the user's own explicit forward Preview or commit, and only as far as the position explicitly reached.
5. **D-22.** Withdraw previously-legitimate disclosure on a backward commit; the surface asserts what is knowable now.
6. **D-12.** Evaluate every class's eligibility in `K(TC)`; nothing after `TC` exists for disclosure purposes.
7. **D-15/D-16/D-17/D-18.** Preview discloses only the committed class set evaluated at `PTC`, is distinguishable as unsettled on every surface, resolves metrically only to `PTC`, and is removed completely on cancel.
8. **D-28/D-29.** Provide distinguishable state and target semantics for the moving Live Edge and the absolute latest committed Moment at a shared coordinate, including nonvisually.
9. **D-24/D-25/D-26/D-27/D-27b/D-28b.** Confine aggregation to `≤ TC`, keep it a legibility construct with fixed neutral meaning, deterministic and reversible, never an object and never a navigation unit; disclose empty stretches as absence without compensating emphasis.
10. **D-30/D-31.** Bound Live-meta to existence and route, qualitative, without magnitude or rate, never re-announced per Moment.
11. **D-37/D-38/D-39.** Knowledge-gate suspended-`IF` chrome; never create a Track marker from a retained `RH` reference.
12. **D-32/D-33/D-34/D-35/D-36/D-40.** Announce mode + meaning; use a polite status channel; expose no future-bearing numeric property; maintain bidirectional parity; expose a single composite temporal control with no post-`TC` per-Moment focus stops; announce Preview as Preview.
13. **D-41/D-42/D-43/D-44.** On narrow projections reduce simultaneity by the declared priority order only, without changing meaning, IA, geography or parity.
14. **D-45 (address rule).** If a content or semantic marker is ever approved for Timeline presentation, its Track address derives from its legitimate current-session `SP`; numeric coincidence of `SP` with `KF` does not make `KF` the address source.

### MUST NOT

1. Introduce any cross-session Timeline construct: Session stepping, multi-Session ranges, Session partitioning of the Track, or life-history timeline. (`m_0` is the Track origin, not a partition.)
2. Turn the Timeline into a feed, event log, dashboard, analytical card stack, graph, duplicate Map, or second inspection hierarchy.
3. Redefine any Stage 5.2 navigation semantics: `Moment` vs `LIVE_EDGE`, Preview/Commit/Settle, `PTC` membership, commit timing, `RH` atomicity, Back, Exact Return, temporal vs spatial intent, locate entitlement, or persistent follow.
4. Disclose, on any surface while pinned, future-relative-to-`TC` semantic markers, marker density, object labels, Thread or focus names, relation markers, Reading markers, confidence or conclusion markers, subdivisions, counts, total Moment count, disabled future objects or controls, future Home loci, future `IF` names, or future accessibility labels and summaries.
5. Encode the quantity or clustering of post-`TC` events in any form, including anonymous density, extent magnitude, gradient, badge, or announcement rate.
6. Use `RTO`, `KF`, `VF/VT`, object age, Thread age or Map position as a Track address.
7. Let density, spacing, marker size, clustering or proximity imply importance, confidence, truth, causal relation, ownership, analytical strength or recommendation priority.
8. Default any analytical class to Timeline-visible; place Readings, relations, evidence participation, questions or corrections on the Track in v1; or disclose confidence on the Track in any form.
9. Name a focus transition on the Track by default, or otherwise let the Track render a topical outline of the session.
10. Let an aggregate acquire identity, name, inspectability, canonical-object status, or navigational granularity.
11. Create a Track marker because `RH` retains a reference internally.
12. Expose per-Moment focus stops in the post-`TC` region, or any numeric property whose bound is `LH`, while pinned.
13. Invent a temporal-bookmark marker or reserve Track space for one (OPEN-06 deferred).
14. Define bucket stepping, coarse temporal jump units, keyboard step granularity or navigation increments (OPEN-08 deferred).
15. Freeze final control shape, icon, label wording, gesture, typography, motion or production visual treatment for the Live-Edge/latest-Moment distinction — or for anything else.
16. Turn Preview into a temporary committed world, or let pointer passage assert an analytical result.
17. Detach the Timeline as a primary screen or IA on any projection, or reflow canonical Map geography for it.

### SHOULD

1. Resolve an aggregate into its constituent positions on explicit interaction rather than by default expansion.
2. Route any request for the identity behind an anonymous transition into the Map's inspection path rather than answering it on the Track.
3. Present the "settling" phase as a state indication rather than as a change in disclosed classes.
4. Keep the mode indication in a position and form that survives every projection, since it is priority 1.
5. Prefer absence over placeholder wherever a class has nothing to disclose.

### MAY

1. Mark individual committed Moments at or before `TC` where density permits, as a legibility affordance carrying no semantic assertion.
2. Aggregate structure at or before `TC` for legibility under §10.
3. Disclose anonymous focus transitions at or before `TC` as structural shape.
4. Provide a Live-meta indication while pinned within the `D-30`/`D-31` bounds.

### OPEN

See §18. Two new OPEN items are proposed (OPEN-13, OPEN-14), each because the contract genuinely cannot be frozen without later visual evidence.

---

## 16. Proof Board A — Timeline Disclosure States

`boards/S5.3_A_Timeline_Disclosure_States_CANDIDATE.png` (source `.html` alongside).

Proves the same current-session Timeline, over the same persistent Organic Living Field, under: **FOLLOW_LIVE**; **PINNED(TC)** with the two-region split; **active Preview** at a forward `PTC`; a **dense interval**; an **empty interval**; **narrow/mobile**; and a **nonvisual/accessibility** annotation of the same states. A dedicated panel shows the Map remaining primary — the Track carries no analytical content in any state, and the analytical world is reachable only through the Map's aperture.

Scaffolding only. Every shape, colour, glyph, layout, control placement and copy is explanatory, not proposed.

## 17. Proof Board B — Temporal Disclosure Adversarial Stress

`boards/S5.3_B_Temporal_Disclosure_Adversarial_Stress_CANDIDATE.png` (source `.html` alongside).

Twelve cells, X-01…X-12, each showing the attack and the contract's response, plus a verdict strip. The board makes the two non-PASS verdicts visible rather than hiding them: X-10 is marked CONDITIONAL. It also carries the ✘ anti-variants for the leak vectors (post-`TC` density, future count in announcements, clustering-as-importance) so the forbidden form is visible next to the permitted one.

Scaffolding only. No final UI.

---

## 18. Remaining OPEN items

### Inherited, still deferred (untouched by this package)

| ID | Item | Status |
|----|------|--------|
| OPEN-02 | P3a locate-affordance vocabulary | DEFER — untouched |
| OPEN-06 | In-session temporal bookmarks | DEFER — no marker invented, no Track space reserved |
| OPEN-08 | In-session coarse-step granularity | DEFER — `D-25` explicitly prevents aggregation from becoming a step unit |
| OPEN-09 | Object-originated jump involving version-validity semantics | DEFER — untouched; `D-45` pre-empts nothing |
| OPEN-10 | Motion | DEFER — Stage 12 |
| OPEN-11 | Timeline disclosure classes | **Addressed by this package** (§3); candidate classification returned for review, not self-declared closed |
| OPEN-12 | Live Edge vs latest-Moment endpoint | **Semantic legibility requirement supplied** (§9); final affordance remains DEFER |

### Newly proposed OPEN items

Proposed only where the contract genuinely cannot be frozen without later visual, motion or implementation evidence, as Authorization §18 permits.

| ID | Question | Why it cannot be settled here | Suggested owner |
|----|----------|-------------------------------|-----------------|
| **OPEN-13** | **Axis metric and scale policy.** Is the Track ordinal (uniform spacing per Moment) or duration-proportional? And when `TC` moves, does the metric region rescale, or does scale stay fixed while the Track's used length changes? | Both are legible and truthful; the choice determines whether pauses/gaps (class 3.3) can exist at all, and it needs visual evidence at real density. Deciding it by argument alone would either invent an unentitled meaning for silence or foreclose a legitimate one. | Experience + Architecture |
| **OPEN-14** | **Aggregate encoding form.** Which neutral encoding expresses "more eligible disclosure occurred here" without reading as weight or importance? | `D-27` fixes the *meaning* and forbids analytical variation, but every candidate encoding (height, opacity, count of marks, thickness) carries different perceptual baggage that only visual testing can settle. Freezing an encoding now would breach FORBIDDEN-07. | Experience |

### Review question, not an OPEN item

§4.3 records that **correction/supersession transitions** are classified MAP-ONLY in v1 by judgement. This is offered explicitly for overrule rather than left implicit; if Architecture wishes to admit exactly one analytical class to the Track, this is the one with the strongest case and the clearest containment story.

---

## 19. Architecture Review Handoff

**What is being asked of review.** Attack the disclosure contract, not the boards' aesthetics. In particular, try to find a channel through which future-relative-to-`TC` information still escapes.

Suggested attack order:

1. **Find a fifth channel.** This package closed four leak channels beyond the obvious labels: extent magnitude (`F-02`), anonymous density (`F-03`), focus enumeration (`F-04`) and announcement rate (`F-05`). Look for a fifth — scroll position, control affordance state, caching behaviour, cursor constraint, or anything else whose *availability* encodes how far the future extends.
2. **Attack `D-20`.** Try to construct a case where non-metric post-`TC` reachability makes a legitimate navigation impossible — if one exists, the rule needs refinement rather than removal.
3. **Attack the withdrawal rule (`D-22`, `F-01`).** Decide whether withdrawal is acceptable product behaviour; if not, the alternative must be found *inside* the firewall, not by relaxing it.
4. **Attack the boundary (§4).** Try to show that anonymous focus transitions, taken together with everything else eligible, permit a reconstruction of the analytical narrative — that would move class 4.1 to Map-only.
5. **Rule on §4.3** — whether supersession transitions should be admitted as the single analytical Timeline class.
6. **Rule on the two new OPEN items** (OPEN-13 axis metric, OPEN-14 aggregate encoding), or confirm they belong to the later visual stage.
7. **Verify no deferred item moved.** OPEN-02/06/08/09/10 should be untouched; confirm that `D-25` in particular keeps aggregation and navigation granularity separate.

**Upstream freezes touched and confirmed untouched.** Stage 5.2's grammar in full (targets, Model C, `PTC ∉ S`, commit timing, entitlements, `RH` atomicity, restoration semantics, spatial-input-cancels-Preview); Stage 5.1's state, modes, temporal-fact distinctions, `K(t)` rules, Exact Return and Return-to-Live-Focus guard; Stage 4's camera preservation, no-hijack, no-silent-ownership and return actions; Stage 3.5's Emerging Focus and Stage 3.6's in-place Session disclosure; Stage 3's prohibition on geometry manufacturing meaning.

**Deliberately absent.** Replay; final colour, typography, icons, motion, production animation, Timeline skin; runtime architecture, renderer, schema, coding strategy; any repository change; any resolution of deferred OPEN items.

**Status.** Stage 5.3 is **not** declared complete or frozen. This package is returned for Product / Experience / Architecture review.

---

## Appendix A — Traceability: proposed rules → AT-01…AT-18

| AT | Rules that carry it |
|----|---------------------|
| AT-01 Current-session only | Taxonomy 2.1 / 3.4 (`m_0` is origin, not partition); MUST NOT 1 |
| AT-02 `Moment(LH)` pinnable | `D-28`, `D-29`; MUST 8 |
| AT-03 `LIVE_EDGE` moving | `D-03`, taxonomy 1.3, 5.1 |
| AT-04 Pinned future-count firewall | `D-09`, `D-20`, `D-34`, `D-36`; taxonomy 2.4, 8.4 |
| AT-05 Future structural marker firewall | `D-10`, `D-12`; taxonomy 4.3; MUST NOT 4 |
| AT-06 Preview legitimacy | `D-14`, `D-15`, `D-17` |
| AT-07 Spatial input cancels Preview | `D-18`, `D-23` |
| AT-08 `SP` is address | `D-45`; MUST NOT 6 |
| AT-09 `KF` is not address | `D-45` (coincidence clause) |
| AT-10 Superseded lineage restraint | Taxonomy 4.6, 6.4; `D-39` |
| AT-11 Empty stretch neutrality | `D-28b`; taxonomy 7.3 |
| AT-12 Dense stretch neutrality | `D-24`, `D-25`, `D-26`, `D-27`, `D-27b` |
| AT-13 Live Focus unavailable historically | `D-30`, `D-31`, `D-32b` |
| AT-14 Suspended `IF` naming | `D-37`, `D-38`, `D-39` |
| AT-15 Accessibility parity | `D-32`, `D-33`, `D-34`, `D-35`, `D-36`, `D-40` |
| AT-16 Mobile parity of truth | `D-41`, `D-42`, `D-43`, `D-44` |
| AT-17 Timeline remains support | §4.2, §4.4; taxonomy 4.1–4.8; MUST NOT 2, 8, 9 |
| AT-18 No implementation decisions | §1 scope statement; whole package altitude |
