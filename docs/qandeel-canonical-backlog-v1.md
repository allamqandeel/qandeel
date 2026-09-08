# QANDEEL — Canonical Backlog v1

**Status:** ACTIVE — governance authority
**Established by:** QAN-GOV-01 (documentation-only normalization)
**Canonical baseline:** `4473beb3d34993103baa82c034a76998bb40bc03` — the merge of PR #213, which
closed T-10 Living Analysis Map Motion System v1
**Authority:** documentation and governance only. Nothing recorded here is executable, and nothing
recorded here authorizes implementation, a migration, a dependency or a Product semantic.

This is QANDEEL's one canonical **cross-task** backlog. Active-task blockers remain owned by the
active contract until they are fixed and never move here merely to close a task. Outside those
active blockers, a cross-task obligation is tracked only when it is recorded here — and an
obligation that *is* recorded here is not thereby scheduled.

---

## 1. Why this document exists

Review findings must not become an endless revision loop, and closing a task must not become a way
of making a defect somebody else's problem. So this backlog distinguishes four things that a single
undifferentiated "todo" list would blur:

1. **a current blocker** — a finding that violates the ACTIVE task contract. It is fixed before that
   task closes and it never appears here (BG-01);
2. **a deferred obligation** with a known future owner — `DEFERRED — OWNED`;
3. **a validation item** that becomes implementation work only if a stated reopen condition is
   observed — `VALIDATION — OPEN`;
4. **an open future capability** deliberately not owned by any current roadmap stage —
   `OPEN — UNASSIGNED`.

The backlog is kept small enough to be read in full at every task kickoff. That is a functional
requirement, not a style preference: a register nobody can read is a register nobody checks.

---

## 2. Item schema

Every item carries all eight fields:

| Field | Meaning |
| --- | --- |
| **ID** | stable, never reused (BG-04) |
| **Title / Finding** | what is actually outstanding |
| **Source** | the exact canonical document and section that establishes it |
| **Why deferred** | the reason it is not current work |
| **Owner task** | one named future task, or `UNASSIGNED` (BG-02) |
| **Severity** | `HIGH` / `MEDIUM` / `LOW` |
| **Reopen condition** | the exact evidence or event that makes it executable (BG-03) |
| **Status** | one of the four below |

Some items additionally carry a **canonical disposition** token, a **current truth** statement, a
**required future property**, a **validation set**, or a stated **closure rule**. Those are recorded
because the canonical source states them, not because the schema requires them.

### The only four statuses

| Status | Meaning |
| --- | --- |
| `DEFERRED — OWNED` | a real obligation with one named future owner |
| `VALIDATION — OPEN` | nothing is known to be wrong; stated evidence would make it work |
| `OPEN — UNASSIGNED` | an open future capability with no frozen owner |
| `CLOSED — TOMBSTONE` | retired, retained with closure task / PR / SHA and disposition |

### Severity

| Severity | Meaning |
| --- | --- |
| `HIGH` | if reopened, can affect Product truth, accessibility parity, major interaction correctness, release quality, or an already-frozen capability |
| `MEDIUM` | meaningful Product capability or quality work, not currently violating a frozen contract |
| `LOW` | optional or lower-risk future capability |

Severity states the consequence *if the item is reopened*. It is not a schedule, a priority order or
an estimate, and this document holds none of those.

---

## 3. Governance rules

**BG-01 — No blocker laundering.** A finding that violates the ACTIVE task contract cannot be moved
into this backlog merely so the task can close. It is fixed, unless Architecture explicitly changes
or dispositions the active contract — and then the disposition, not the backlog entry, is the
record. Nothing in this document may be cited as authority for leaving a contract violated.

**BG-02 — Ownership is explicit.** Every item names one future owner task or says `UNASSIGNED`.
"Later", "a future release" and "TBD" are not owners.

**BG-03 — Validation is conditional.** Every `VALIDATION — OPEN` item states the exact evidence that
reopens implementation. "Check later" is not a reopen condition.

**BG-04 — IDs are never reused.** A closed item stays here as `CLOSED — TOMBSTONE` carrying its
closure task, PR and SHA and a short disposition. A retired ID is never re-issued to different work.

**BG-05 — Future tasks inherit owned items.** At every task kickoff, Architecture reads this backlog
and lists every open item whose owner matches that task. Each such item is then included in the task
contract, explicitly re-owned, or explicitly left deferred with a reason. Silence is not a
disposition. See §9.

**BG-06 — Anti-scope is not automatically backlog.** A sentence saying a task did not do something
is not an obligation. An item enters this backlog only if it has an existing `OPEN` identifier, is
explicitly deferred to a future task by a canonical document, is explicitly carried forward for
validation, or Architecture explicitly designates it.

**BG-07 — Backlog is not Product authority.** An item becomes executable only through a future Task
Contract. Nothing here defines runtime semantics, and no reader may implement from an entry.

**BG-08 — Closure reconciliation / backlog admission.** Before an ACTIVE task may be declared
CLOSED / FROZEN, Architecture reconciles that task's cross-task residue against this backlog. Every
newly discovered item that is not a current blocker and qualifies under BG-06 is admitted here, with
the complete schema of §2, *before* closure. Every backlog item that task inherited is explicitly
updated as one of: completed → `CLOSED — TOMBSTONE`, re-owned to one named task, or still deferred
with a recorded reason. Once the task has closed, a qualifying item may not exist only in a review
comment, a final report, a task-local note or a model's memory. This adds no lifecycle state and
relaxes nothing: a current blocker is still fixed inside the active task (BG-01), anti-scope is
still not automatically backlog (BG-06), and admission still authorizes no implementation (BG-07).

---

## 4. Index

| ID | Title / Finding | Owner task | Severity | Status |
| --- | --- | --- | --- | --- |
| `OPEN-06` | Bookmarks | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-08` | Coarse Temporal Step | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-09` | Object-Originated Version Jump | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-19` | Dedicated No-Op Acknowledgement | `UNASSIGNED` | `LOW` | `OPEN — UNASSIGNED` |
| `QAN-BL-T12-01` | Original Inspection Journey-Origin Binding | `T-12 — Final Integration` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-T12-02` | Locale Provider / Regional Numeral Policy | `T-12 — Final Integration` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-T12-03` | Final App-Shell Composition | `T-12 — Final Integration` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-MOT-01` | Meaning Ignition Authoritative Trigger | `T-12 — Final Integration` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-MOT-02` | Exact Composite Spatial-Cause Binding | `T-12 — Final Integration` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-MOT-03` | Physical Motion Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `VALIDATION — OPEN` |
| `QAN-BL-MOT-04` | Direct-Drag Presentation Culling | `T-12 — Final Integration / pre-release physical validation gate` | `MEDIUM` | `VALIDATION — OPEN` |
| `QAN-BL-RSP-01` | Physical Responsive Recomposition Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `VALIDATION — OPEN` |
| `QAN-BL-RSP-02` | Outboard Live Label Clipped at Large Text | `T-12 — Final Integration` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-T13-01` | Restart / Recovery / Persistence | `T-13 — Recovery / Persistence` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-NAV-01` | Cross-Session Timeline | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-NAV-02` | Analysis Replay | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |

---

## 5. Items

### `OPEN-06` — Bookmarks

- **Title / Finding:** no bookmarking capability exists. A reader cannot mark a position, an object
  or a viewpoint and return to it by name.
- **Source:** Architecture planning carry-forward — the `OPEN` register that issued this identifier
  is not itself a repository document. Corroborated in the repository as an explicit boundary by
  [T-04 §14 Anti-scope](living-analysis-map-runtime-v1.md) ("no bookmarks (OPEN-06)") and by
  [T-07 §12](return-navigation-layer-v1.md) ("no bookmarks").
- **Why deferred:** intentionally outside the frozen T-07 Return semantics. The six return
  identities are complete as frozen, and a bookmark is a seventh kind of destination rather than a
  gap in them.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated bookmarking / navigation capability task, or a
  future integration contract explicitly claims it.
- **Status:** `OPEN — UNASSIGNED`

No bookmark semantics — storage, identity, lifetime, sharing, restoration or relation to reversible
history — are defined here or implied by this entry.

### `OPEN-08` — Coarse Temporal Step

- **Title / Finding:** no coarse-grained temporal stepping exists. Temporal targeting is per
  disclosed Moment.
- **Source:** Architecture planning carry-forward. Corroborated as an explicit boundary by
  [T-04 §14](living-analysis-map-runtime-v1.md) ("no coarse temporal step (OPEN-08)") and by
  [T-07 §12](return-navigation-layer-v1.md) ("no coarse temporal stepping").
- **Why deferred:** not part of the current frozen temporal or Return contracts.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a future temporal-navigation task explicitly defines coarse stepping
  semantics *and* their relationship to exact disclosed Moment targeting.
- **Status:** `OPEN — UNASSIGNED`

The relationship named in the reopen condition is the hard part, and it is deliberately left
undefined here: T-06 keeps canonical Moment addressability and disclosed interaction availability as
two separate gates, and any coarse step would have to answer to both.

### `OPEN-09` — Object-Originated Version Jump

- **Title / Finding:** selecting an object does not authorize temporal or version navigation from
  it.
- **Source:** Architecture planning carry-forward. Corroborated as an explicit boundary by
  [T-04 §14](living-analysis-map-runtime-v1.md) ("no object-originated version jump (OPEN-09)") and
  by [T-07 §12](return-navigation-layer-v1.md) ("no object-originated version jumps").
- **Why deferred:** current object selection is inspection, not temporal authority. Inspecting is
  not navigating.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** a future Product contract explicitly authorizes object-originated
  temporal / version navigation and defines its truth and history semantics.
- **Status:** `OPEN — UNASSIGNED`

### `OPEN-19` — Dedicated No-Op Acknowledgement

- **Title / Finding:** there is no dedicated canonical acknowledgement state for a return act that
  correctly does nothing.
- **Source:** [T-08 §9](inspection-orientation-return-chrome-v1.md) states it by identifier — "There
  is no dedicated no-op acknowledgement state; `OPEN-19` stays deferred." Also carried as a boundary
  by [T-04 §14](living-analysis-map-runtime-v1.md) and [T-07 §12](return-navigation-layer-v1.md).
  The register that issued the identifier is an Architecture planning carry-forward.
- **Why deferred:** the frozen Return layer has no such state, and a no-op already resolves
  truthfully: no fabricated canonical state, no invented reversible-history entry, no invented camera
  movement, no persistent selected state.
- **Owner task:** `UNASSIGNED`
- **Severity:** `LOW`
- **Reopen condition:** product or user evidence shows that the existing truthful outcome and chrome
  feedback is insufficient, *and* Architecture opens a dedicated contract for the acknowledgement.
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-T12-01` — Original Inspection Journey-Origin Binding

- **Title / Finding:** nothing establishes the real origin of an inspection **journey**. T-08
  consumes an opaque origin and can mint none, so the Exact Return control has no supplier.
- **Source:** [T-08 §13 — "The original inspection is consumed, never manufactured (R3-04)"](inspection-orientation-return-chrome-v1.md),
  which defers it in those words: "establishing the real inspection-**journey** origin at the actual
  journey boundary". See also T-08 §6, "The Exact Return opportunity (R2-01, narrowed by R3-04)".
- **Why deferred:** T-08 is consumer-only for the opaque origin capability. Same-store provenance is
  necessary and is proven by T-07, but it is not evidence that a checkpoint is the named origin of a
  real explicit inspection journey — a checkpoint recorded by Return to World is a valid handle and
  is not an inspection at all. T-08 is not app-shell integrated and owns no journey coordinator, so
  the origin belongs at the actual integration boundary.
- **Owner task:** `T-12 — Final Integration`
- **Severity:** `HIGH`
- **Reopen condition:** automatic when T-12 begins.
- **Current truth:** until such an origin is supplied, the relevant Exact Return control is simply
  absent. That is the correct behaviour, not a defect awaiting a workaround.
- **Constraint on the future work:** T-12 may add a narrow journey-origin coordinator or integration
  seam **without reopening T-07's return semantics**. T-07 remains the final execution authority and
  re-proves provenance and presence before writing anything.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-T12-02` — Locale Provider / Regional Numeral Policy

- **Title / Finding:** no regional locale authority exists. Numerals are Western in both languages
  through one formatter, and no regional numeral policy is frozen.
- **Source:** [T-08 §13 — "Arabic and English are both real, and neither is the semantics"](inspection-orientation-return-chrome-v1.md):
  "No regional numeral policy is frozen here; that belongs with T-12's locale provider."
- **Why deferred:** T-08 owns language presentation, not regional locale authority. Its seam is a
  *language* and carries no region, and `ar` alone does not determine digits.
- **Owner task:** `T-12 — Final Integration`
- **Severity:** `MEDIUM`
- **Reopen condition:** automatic when T-12 integrates the final locale and app composition.
- **Status:** `DEFERRED — OWNED`

The VI-01 register law remains the authority over Arabic register and vocabulary; this item is about
regional locale and numeral policy only, and defines neither.

### `QAN-BL-T12-03` — Final App-Shell Composition

- **Title / Finding:** the T-06, T-08 and T-10 layers are not mounted into the final app shell.
  Where each Product surface appears is undecided.
- **Source:** [T-06 §13](temporal-navigation-layer-v1.md) ("Nothing under `src/temporal-navigation/`
  is mounted in the app shell … where the temporal surface appears in the Product is a later task's
  decision"); [T-08 §11](inspection-orientation-return-chrome-v1.md) ("final app-shell integration to
  T-12") and T-08 §12 ("the app shell and the router root reference nothing in `orientation-chrome`;
  T-08 is mounted nowhere"); [T-10 traceability §5, static guard 5](living-analysis-map-motion-system-v1-traceability.md)
  ("no app-shell mount — the app shell still mounts no world").
- **Why deferred:** the layers were intentionally left unmounted so that each could be proven as its
  own owner. Composition is a distinct act with its own correctness conditions.
- **Owner task:** `T-12 — Final Integration`
- **Severity:** `HIGH`
- **Reopen condition:** automatic when T-12 begins.
- **Status:** `DEFERRED — OWNED`

Recorded here as an obligation, not as a design. This entry defines no shell structure, no route
topology, no mount order and no surface arrangement.

### `QAN-BL-MOT-01` — Meaning Ignition Authoritative Trigger

- **Title / Finding:** the M5 Meaning Ignition cue has no authoritative Product trigger, so it is
  absent in v1.
- **Canonical disposition:** `MEANING_IGNITION_TRIGGER_DEFERRED_TO_T12`
- **Source:** [T-10 §8 — "Meaning Ignition disposition"](living-analysis-map-motion-system-v1.md);
  §2 (the M5 row) and §3 (Q4). Traceability §2 Q4 and §3 PM-14.
- **Why deferred:** no authoritative Product signal currently distinguishes a true committed semantic
  crystallization from a fetch completing, a projection being replaced, a remount, or navigation.
  Inventing a trigger would make motion the authority for a Product claim.
- **Owner task:** `T-12 — Final Integration`
- **Severity:** `MEDIUM`
- **Reopen condition:** T-12 finds or defines the correct authoritative seam — without making motion
  the authority for it.
- **If no such signal exists:** keep the cue absent. Do not invent a trigger, and do not ship a
  dormant one. The absence is structural today: the motion owner cannot observe a live advance, a
  Live Focus transition or a fetch at all.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-MOT-02` — Exact Composite Spatial-Cause Binding

- **Title / Finding:** binding an already-returned T-07 outcome to the exact camera transition it
  belongs to is not owned by T-10. The pure composite choreography exists and is tested; no
  production path can produce a cause, and the camera passes `null` unconditionally.
- **Canonical disposition:** `COMPOSITE_SPATIAL_CAUSE_BINDING_DEFERRED_TO_T12`
- **Source:** [T-10 §10a — "R3 — the final path"](living-analysis-map-motion-system-v1.md);
  [T-10 traceability §5, guard R3-j](living-analysis-map-motion-system-v1-traceability.md); PM-27.
- **Why deferred:** T-10 can own pure choreography but not the final outcome → exact
  camera-transition composition boundary. A pending token has no owner: a mailbox is not a binding,
  and which canonical change an already-returned outcome belongs to is a composition fact the motion
  owner does not have and cannot acquire without taking T-12's integration ownership.
- **Owner task:** `T-12 — Final Integration`
- **Severity:** `HIGH`
- **Reopen condition:** automatic when T-12 begins.
- **Required future property:** one exact transition, one owner generation, one shot, invalidated by
  a stale, replacement or intervening act, and never borrowed by an unrelated camera action.
- **Status:** `DEFERRED — OWNED`

### `QAN-BL-MOT-03` — Physical Motion Validation

- **Title / Finding:** `PHYSICAL MOTION REVIEW PENDING`. The frozen T-10 motion has never been felt
  on real hardware.
- **Source:** [T-10 §10 — "Physical-device items still pending"](living-analysis-map-motion-system-v1.md);
  [T-10 traceability §3 PM-19 and §5](living-analysis-map-motion-system-v1-traceability.md) ("the
  retirement's behaviour is a device item"). The owner named below is an Architecture designation
  made by QAN-GOV-01 under BG-06; the T-10 documents state the items without naming an owner.
- **Why deferred:** exact-head CI proves build, install and boot integrity, not perceptual feel on
  real, release-capable hardware. The authoring machine has no Android SDK, no emulator and no Xcode,
  and jest-expo mocks the native side of Reanimated, so no mid-travel frame is observable there.
- **Owner task:** `T-12 — Final Integration / pre-release physical validation gate`
- **Severity:** `HIGH`
- **Validation set:**
  1. perceptual parity of the 260–540 ms travel band on a mid-range Android and on iOS;
  2. perceptibility of the commit acknowledgement after the 6 % → 9 % `scaleY` tuning;
  3. Android drag and release continuity feel;
  4. Arabic / RTL 1:1 Timeline scrub tracking on hardware;
  5. re-measurement of the T-10.0 ~190–220 ms depth-change stall — observed in a dev bundle and
     attributed to React reconciliation — in a release / native context;
  6. interruption feel when one act retargets another mid-travel without carrying velocity.
- **Reopen condition:** device evidence shows teleport, pop, visible discontinuity, incorrect or
  harmful reduced-motion behaviour, unacceptable jank, a failed 1:1 scrub, or any other violation of
  the frozen T-10 motion contract.
- **If validation passes:** close as `CLOSED — TOMBSTONE` with the device evidence recorded. Do not
  invent tuning work to justify the gate.
- **Status:** `VALIDATION — OPEN`

Nothing here is known to be wrong. This item exists because a specific class of claim cannot be made
from code and CI alone.

### `QAN-BL-MOT-04` — Direct-Drag Presentation Culling

- **Title / Finding:** during an M0 direct drag the surface still uses T-04's resting viewport cull,
  so an object carried in from beyond the cull margin is not repainted until the `PAN` commits.
- **Source:** [T-10 §10a — "Carried forward, not fixed here"](living-analysis-map-motion-system-v1.md).
  The owner named below is an Architecture designation made by QAN-GOV-01 under BG-06.
- **Why deferred:** the surface intentionally does not re-render while a finger is down — that is
  what makes a 60-frame drag cost zero React renders and zero crossings to the Product runtime. The
  behaviour predates T-10, T-10 did not change it, and it is outside the R3 M4 / M3 scope. It is
  recorded here rather than left to be rediscovered.
- **Owner task:** `T-12 — Final Integration / pre-release physical validation gate`
- **Severity:** `MEDIUM`
- **Reopen condition:** hardware testing shows visible pop-in, blank entry, a missing
  currently-disclosed object, or another user-visible continuity defect during a direct drag.
- **If no visible defect:** close by validation, not by architecture churn. The performance property
  that produces this behaviour is deliberate.
- **Status:** `VALIDATION — OPEN`

### `QAN-BL-RSP-01` — Physical Responsive Recomposition Validation

- **Title / Finding:** `PHYSICAL RESPONSIVE REVIEW PENDING`. The frozen T-11 recomposition has never
  been laid out by a real type engine, a real safe-area provider or a real window manager.
- **Source:** [T-11 §11 and §15](responsive-recomposition-v1.md) — "Native and physical validation
  limits", which states the four unproven claims by name rather than glossing them.
- **Why deferred:** `jest-expo` performs no layout at all — there is no Yoga in the test renderer, so
  `onLayout` never fires by itself and the proof composition supplies the rect a real column would
  produce. That proves everything the responsive owner does *given* a measurement, and nothing about
  the measurement itself. The browser proof shows real layout of the real components, but browser
  layout is not native layout and is in particular not a Dynamic Type proof. The authoring machine
  has no simulator, emulator, Xcode or device, and exact-head CI proves build, install and boot
  integrity rather than perceptual layout on release-capable hardware.
- **Owner task:** `T-12 — Final Integration / pre-release physical validation gate`
- **Severity:** `HIGH`
- **Validation set:**
  1. real type-engine layout of the Arabic and English return wording at the largest system text
     sizes, at 320 points, in both writing directions — no clipped final line, no ellipsis on any
     canonical identity, status or Return wording, and every control still at least 44 points;
  2. real safe-area insets on a notched device and on a gesture-bar device, including the asymmetric
     and landscape cases, with the chrome's bottom seam and the Map's usable rect both correct;
  3. real continuous resize — split view, Stage-Manager-style dragging and orientation change — with
     no visible lag, no band flip-flop and no layout loop;
  4. a real mid-travel resize and a real mid-scrub resize performed with a finger, confirming no
     teleport and no stale-mapped commit on hardware — and, on the mid-scrub case, whether the
     retirement READS as an interruption. It reuses T-06's own cancellation choreography exactly,
     so the preview cursor fades out under a finger that is still down and nothing previews again
     until that finger lifts. That is correct and it is deliberately silent: a positive signal
     would need either a new motion vocabulary or new Product copy, and T-11 is authorized to add
     neither. Whether silence is enough is a perceptual question, and this is where it is asked.
- **Reopen condition:** device evidence shows clipped or ellipsized essential wording, a control
  below 44 points, an unreachable act, a band that oscillates, a visible layout lag during a
  continuous resize, a teleport during a resize under motion, a stale-mapped temporal commit, or any
  other violation of the frozen T-11 contract.
- **If validation passes:** close as `CLOSED — TOMBSTONE` with the device evidence recorded. Do not
  invent tuning work to justify the gate.
- **Status:** `VALIDATION — OPEN`

Nothing here is known to be wrong. This item exists because a specific class of claim — how a real
type engine, a real inset provider and a real window manager lay out these exact strings — cannot be
made from code and CI alone. It is admitted under BG-08 before T-11 closes rather than left in a
report.

### `QAN-BL-RSP-02` — Outboard Live Label Clipped at Large Text

- **Title / Finding:** T-05 gives the outboard Live slot a fixed `width: OUTBOARD_LIVE_EXTENT` (64
  points) with `overflow: 'hidden'`. At a 200 % system text size its label — "Go live" / "Live", and
  the Arabic equivalents — needs roughly 110 points, so the reader sees "Go". Essential wording is
  clipped by a fixed presentation width.
- **Source:** [T-11 §15 — "What the proof found that T-11 could not fix"](responsive-recomposition-v1.md).
  Visible in the `P07-large-text` and `P07b-largest-text` frames of the T-11 visual proof.
- **Why deferred:** it is **pre-existing and outside T-11's reach**, not a T-11 regression. The slot,
  its fixed width and its clip all predate this task, and the clipping occurs at that text size with
  or without the responsive layer. T-11 cannot fix it either: the T-06 contract holds every T-05
  file byte-identical, and a presentation task reaching sideways into a frozen owner to change its
  geometry is exactly what that freeze exists to prevent. The control's accessible name is
  unaffected, so the act remains reachable to a screen reader; what is lost is the visible word.
- **Owner task:** `T-12 — Final Integration`
- **Severity:** `HIGH` — clipped essential wording is an accessibility-parity failure at a text size
  real readers use, even though no act becomes unreachable.
- **Reopen condition:** automatic when T-12 begins. Any fix must keep T-06's single physical mirror
  rule and the outboard slot's separation from Moment-targeting space intact: the slot may grow, but
  it may not become part of the strip, and `presentationX` must keep receiving T-05's own measured
  viewport.
- **Status:** `DEFERRED — OWNED`

The two candidate shapes — letting the slot size to its content, or giving the Track row a wrapping
composition at large text — are recorded as observations, not as a design. Which one is correct
depends on where the temporal surface finally sits, which is `QAN-BL-T12-03`'s question.

### `QAN-BL-T13-01` — Restart / Recovery / Persistence

- **Title / Finding:** restart, recovery and persistence of the reader's viewpoint and reversible
  history are unimplemented.
- **Source:** [T-07 §12](return-navigation-layer-v1.md) ("no T-13 restart or persistence");
  [T-08 §11](inspection-orientation-return-chrome-v1.md) ("restart and persistence to T-13").
- **Why deferred:** explicitly outside T-07, and already assigned to future recovery / persistence
  work by both canonical documents.
- **Owner task:** `T-13 — Recovery / Persistence`
- **Severity:** `HIGH`
- **Reopen condition:** automatic when T-13 begins.
- **Status:** `DEFERRED — OWNED`

No persistence semantics — what survives a restart, for how long, under what identity, and what
happens to reversible history — are defined here.

### `QAN-BL-NAV-01` — Cross-Session Timeline

- **Title / Finding:** the Timeline is Session-scoped. There is no cross-Session temporal
  navigation.
- **Source:** [T-07 §12](return-navigation-layer-v1.md) ("no cross-session Timeline").
- **Why deferred:** T-07 explicitly excludes it, and no current roadmap owner is frozen for it.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a future cross-Session temporal-navigation contract.
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-NAV-02` — Analysis Replay

- **Title / Finding:** there is no Replay of how an analysis developed.
- **Source:** [T-07 §12](return-navigation-layer-v1.md) ("no Replay").
- **Why deferred:** T-07 explicitly excludes Replay, and no current owner is frozen.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated Replay contract.
- **Status:** `OPEN — UNASSIGNED`

---

## 6. Tombstones

None at this baseline. No backlog item has been closed.

Under BG-04, a closed item is moved to this section as `CLOSED — TOMBSTONE`, keeps its ID for ever,
and records the closing task, PR, SHA and a short disposition. IDs are never re-issued.

---

## 7. Counts at this baseline

| Status | Count |
| --- | --- |
| `DEFERRED — OWNED` | 7 |
| `VALIDATION — OPEN` | 3 |
| `OPEN — UNASSIGNED` | 6 |
| `CLOSED — TOMBSTONE` | 0 |
| **Total** | **16** |

| Severity | Count |
| --- | --- |
| `HIGH` | 7 |
| `MEDIUM` | 8 |
| `LOW` | 1 |

---

## 8. What is deliberately not in this backlog

- **Current unresolved blockers.** By BG-01 they do not belong here at all.
- **Speculative features.** Nothing enters because it might be nice.
- **Every anti-scope sentence.** Task documents state many boundaries; a boundary is not an
  obligation (BG-06).
- **Implementation design for T-11, T-12 or T-13.** Entries name obligations, never solutions.
- **Estimates, priorities and schedules.** Severity is consequence, not order.
- **Detailed code solutions and duplicate aliases** for items already recorded.
- **Already-closed work**, except as a tombstone.

Items resolved *within* the tasks that raised them — the T-10 R1 / R2 / R3 corrections, the T-06
FCR findings, the T-08 R1 / R2 / R3 corrections, `OPEN-17` — are closed work and are not recorded
here. Their record is the canonical document of the owning task.

---

## 9. Task lifecycle checklist (BG-05 at kickoff, BG-08 at closure)

### At kickoff (BG-05)

At the kickoff of any future task, Architecture:

1. reads this document in full;
2. lists every open item whose **Owner task** matches the task being opened;
3. for each, records one of: *included in this contract*, *re-owned to <named task>*, or *remains
   deferred, because <reason>*;
4. confirms that no finding from the previous task's review was moved here in violation of BG-01;
5. leaves any `OPEN — UNASSIGNED` item alone unless the task contract explicitly claims it.

Inherited at this baseline:

| Task | Items it inherits on kickoff |
| --- | --- |
| `T-11` | none |
| `T-12 — Final Integration` | `QAN-BL-T12-01`, `QAN-BL-T12-02`, `QAN-BL-T12-03`, `QAN-BL-MOT-01`, `QAN-BL-MOT-02`, `QAN-BL-RSP-02`, and — at the pre-release physical validation gate — `QAN-BL-MOT-03`, `QAN-BL-MOT-04`, `QAN-BL-RSP-01` |
| `T-13 — Recovery / Persistence` | `QAN-BL-T13-01` |

T-11 inherits nothing from this backlog. That is a fact about the register, not a statement that
T-11 has been started, scoped or authorized.

### At closure (BG-08)

Before any task is declared CLOSED / FROZEN, Architecture:

1. reconciles every backlog item that task inherited — completed → `CLOSED — TOMBSTONE` with the
   closing task, PR, SHA and disposition; re-owned to one named task; or still deferred with a
   recorded reason;
2. admits every newly accepted cross-task deferral that qualifies under BG-06, with the complete
   schema of §2;
3. leaves every current blocker where it belongs — inside the active task, fixed (BG-01);
4. does not declare the task CLOSED / FROZEN while a qualifying cross-task residue exists only
   outside this document.
