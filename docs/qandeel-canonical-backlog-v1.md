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

**BG-09 — Same-task closure-state synchronization.** A task may not be treated as CLOSED / FROZEN
while its primary canonical task document still advertises a pre-closure lifecycle state such as
`CANDIDATE — awaiting independent review`. The closing task — the change that closes it — performs
BOTH halves itself: the BG-08 backlog reconciliation above, and the update of its own primary
document from its candidate/review banner to its final lifecycle state. A later ordinary task must
not be relied upon to finish a predecessor's closure record. Where a historical omission is
discovered after the fact, it is repaired by an explicit governance-reconciliation task that records
the correction without reopening Product semantics — never by quietly rewriting the record so that
the omission appears not to have happened.

This complements BG-08; it does not replace it, duplicate it or relax it. BG-08 remains the one
authority for what the backlog must say at closure, and this document remains the one backlog: BG-09
adds no second register, no second lifecycle model and no new Product state. It governs only the
agreement between a closed task's own banner and the closure the register already records.

---

## 4. Index

| ID | Title / Finding | Owner task | Severity | Status |
| --- | --- | --- | --- | --- |
| `OPEN-06` | Bookmarks | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-08` | Coarse Temporal Step | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-09` | Object-Originated Version Jump | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-19` | Dedicated No-Op Acknowledgement | `UNASSIGNED` | `LOW` | `OPEN — UNASSIGNED` |
| `QAN-BL-T12-01` | Original Inspection Journey-Origin Binding | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-T12-02` | Locale Provider / Regional Numeral Policy | `T-12 — Final Integration` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-T12-03` | Final App-Shell Composition | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-01` | Meaning Ignition Authoritative Trigger | `T-12 — Final Integration` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-02` | Exact Composite Spatial-Cause Binding | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-03` | Physical Motion Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-MOT-04` | Direct-Drag Presentation Culling | `T-12 — Final Integration / pre-release physical validation gate` | `MEDIUM` | `CLOSED — TOMBSTONE` |
| `QAN-BL-RSP-01` | Physical Responsive Recomposition Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-RSP-02` | Outboard Live Label Clipped at Large Text | `T-12 — Final Integration` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-T12-04` | Mobile Auth Session Storage Production Security + Device Validation | `T-12 — Final Integration / pre-release physical validation gate` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-SEC-01` | Mobile Credential Backup & Hardware Security Hardening | `QAN-SEC-01 — Pre-release Mobile Credential Security` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-T13-01` | Restart / Recovery / Persistence | `T-13 — Recovery / Persistence v1` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-NAV-01` | Cross-Session Timeline | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-NAV-02` | Analysis Replay | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-VOICE-01` | Personal Voice / Live Call Runtime + Durable Audio Source | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-AUTH-01` | Mobile Product Sign-In Gateway | `T-14 — Mobile Product Sign-In Gateway v1` | `HIGH` | `CLOSED — TOMBSTONE` |
| `QAN-BL-VIS-01` | Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-CW-01` | Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`) | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |

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

### `QAN-BL-SEC-01` — Mobile Credential Backup & Hardware Security Hardening

- **Title / Finding:** the accepted-v1 auth storage boundary has two platform-security residues:
  Android `allowBackup` currently resolves to `true`, so the isolated auth database is eligible for
  Auto Backup; and the iOS functional storage contract is proven on a Release simulator rather than
  physical hardware, so iOS Data Protection / backup-exclusion behaviour is not physically attested.
- **Source:** [T-12 auth storage-at-rest disposition §§4, 6 and 7](t12-auth-storage-at-rest-disposition-v1.md),
  admitted by T-12 BG-08 closure reconciliation after AC-03 explicitly accepted the v1 storage risk.
- **Why deferred:** T-12 proved the functional auth-storage lifecycle on Android hardware and iOS
  Release simulator and Architecture/Security explicitly accepted the v1 SQLite threat boundary.
  Changing backup policy changes the native artifact and belongs in one deliberate pre-release
  credential-security pass rather than an unvalidated final T-12 edit.
- **Owner task:** `QAN-SEC-01 — Pre-release Mobile Credential Security`
- **Severity:** `HIGH`
- **Reopen condition:** automatic before the first production-store release, or earlier if the
  auth-storage mechanism, backup policy, platform credential model or mobile threat model changes.
- **Required future properties:** settle Android backup policy (`allowBackup: false` or precise
  auth-database exclusion); settle the equivalent iOS backup/Data-Protection policy; validate the
  generated native configuration; preserve sign-out removal, identity isolation, token replacement,
  and the prohibition on Product truth / QANDEEL conversation `sessionId` in auth storage; use
  maintained platform mechanisms only — no custom cryptography.
- **Status:** `DEFERRED — OWNED`

This item is platform-wide: Family, Match and any future QANDEEL surface using the shared mobile auth
foundation inherit the same credential-storage boundary.

### `QAN-BL-T12-04` — Mobile Auth Session Storage Production Security + Device Validation

> **Historical pre-closure schema retained for the frozen T-12P contract only.** This block records
> what T-12 inherited before physical validation. It is not the current lifecycle state; the current
> state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** production mobile auth-session storage security and native lifecycle/device validation were still outstanding at T-12P closure.
- **Source:** T-12P mobile runtime-entry preconditions and the original canonical backlog admission for `QAN-BL-T12-04`.
- **Why deferred:** T-12P established the runtime-entry boundary but deliberately left production physical validation to T-12 Final Integration.
- **Owner task:** `T-12 — Final Integration / pre-release physical validation gate`
- **Severity:** `HIGH`
- **Reopen condition:** T-12 physical validation gate reached with production-equivalent auth storage and native builds.
- **Status:** `VALIDATION — OPEN`
- **Validation set:** persistence/restore, token replacement, identity isolation, sign-out removal, auth-only storage boundary, Android hardware, and iOS Release-native evidence where available.

This historical validation residue was **not** T-13 Product persistence. Historical T-12 physical-gate inheritance included `QAN-BL-RSP-01`, `QAN-BL-T12-04`. T-12 subsequently discharged it; the only narrower future security residue is `QAN-BL-SEC-01`.

### `QAN-BL-T13-01` — Restart / Recovery / Persistence

> **Historical pre-closure schema retained for the frozen T-07 / T-08 deferrals only.** This block
> records what T-13 inherited before it ran. It is not the current lifecycle state; the current state
> is the `CLOSED — TOMBSTONE` record in §6 below.

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
- **Why deferred:** T-07 explicitly excludes Replay, and no current owner is frozen. The Replay
  *backend runtime* has since been built and closed by `I-06`; what this item names — a surface
  through which a human can actually watch an analysis develop — has no frozen owner still.
- **Owner task:** `UNASSIGNED`
- **Severity:** `MEDIUM`
- **Reopen condition:** Architecture opens a dedicated Replay contract. *(Satisfied and consumed for
  the runtime half: `CW2-05 — Replay Runtime Architecture v1.0` is `CLOSED / FROZEN` and `I-06`
  implemented it. The condition is retained as written rather than rewritten, because the record of
  what was asked for is what makes the remaining gap legible. For the remaining half the condition is
  narrower: a canonical contract opens the mobile / Product Analysis Replay surface, and the CW2-08
  and analytical subject-authority prerequisites in the current truth below are resolved.)*
- **Current truth (BG-08 reconciliation at `I-06` closure):** the Replay **backend runtime** exists and
  is `CLOSED / FROZEN` — migrations `0100`–`0107` implement authorized source capture and draft
  construction, the analytical projection and render truth contract, preview and finalization,
  distribution packaging, distribution authority, export privacy sanitization, the Public
  `REPLAY_ARTIFACT` bridge, post-finalization source availability and current delivery eligibility.
  None of that is the thing this item names. The **final mobile / Product Analysis Replay surface is
  still not implemented** and is outside `I-06`. **Media, storage and transport remain outside `I-06`**
  and deferred by `CW2-05` — no encoder, codec, container, object store, CDN, public URL or delivery
  path exists, and `QANDEEL` guarantees no recall of already-exported copies. **Production Replay
  distribution is `NOT CLEARED / FAIL-CLOSED`** while two prerequisites are unresolved: the
  protected-human analytical subject authority, whose canonical seam answers
  `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT`, and the `CW2-08` Safety / moderation / entitlement /
  feature / Launch Gate runtime, whose canonical seam answers `NOT_EVALUATED` on every dimension.
  Neither is deferred *here*: each fails closed in the runtime itself and is owned by its own frozen
  `CW2-0N` contract, which is why no new backlog item is admitted for either (`BG-01`, `BG-06`).
- **Status:** `OPEN — UNASSIGNED`

### `QAN-BL-VOICE-01` — Personal Voice / Live Call Runtime + Durable Audio Source

- **Title / Finding:** the Product interaction for Writing / Voice Note / Live Call is now closed at
  proof level, including Analysis-first Live Call, background continuation and exact in-call surface
  restoration, but the repository still has **no canonical Personal Voice / Live Call runtime** and
  no durable Personal original-audio source.
- **Source:** `I-08B3.1-G1.2 — Voice + Live Conversation Experience Proof`, closed after independent
  Product / Design review. Reviewed proof ZIP SHA-256:
  `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96`; bounded R1 direct
  correction ZIP SHA-256:
  `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11`.
- **Why deferred:** G1.2 deliberately proves Product behavior without inventing the provider,
  realtime transport, native call lifecycle, media persistence, audio retention/deletion,
  interruption semantics, device integration or production permission/service declarations.
  Personal Replay original audio remains non-producible until a reviewed durable source exists.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`
- **Reopen condition:** Architecture opens the Personal Voice / Live Call runtime implementation
  track, or a production implementation task explicitly claims realtime two-way audio, Voice Note
  persistence/playback, background-call lifecycle, or durable Personal original audio.
- **Required future properties:** one canonical call/session authority; provider-agnostic realtime
  audio boundary; native iOS/Android call lifecycle and background behavior; truthful microphone and
  route state; interruption/reconnection semantics; durable Voice Note audio if history playback is
  shipped; consent/retention/deletion for any Personal original audio; and a reviewed source
  contract before audio-led Replay can claim the original call.
- **Status:** `OPEN — UNASSIGNED`

This item does not reopen G1.2 Product proof. It records the implementation/runtime residue that G1.2
was explicitly forbidden to invent.

### `QAN-BL-AUTH-01` — Mobile Product Sign-In Gateway

> **Historical pre-closure schema retained for the frozen T-12 / T-12P residue only.** This block
> records the obligation as it was admitted, with no owner. It is not the current lifecycle state;
> the current state is the `CLOSED — TOMBSTONE` record in §6 below.

- **Title / Finding:** there is no Product mobile sign-in experience, and no task owns one. The
  Product has no entry path for a signed-out reader.
- **Source:** [T-12 §14 residual limitations](final-living-analysis-map-integration-v1.md) — "There
  is no mobile sign-in experience, and no task owns one. T-12P shipped the capability and named no
  owner for the gateway. It is not T-12's, and it is not registered in the canonical backlog."
  Corroborated by [T-12P §8](mobile-runtime-entry-preconditions-v1.md) ("No login experience.
  `signInWithPassword` is a runtime capability for a future auth gateway to call.") and by
  [T-12 Phase M §11](final-living-analysis-map-integration-v1-phase-m.md), which routes around the
  absent gateway rather than building one.
- **Why deferred:** T-12P owns authentication/runtime capability and T-12 owns final Living Analysis
  Map integration, but neither task owns or defines the Product-facing login/onboarding gateway.
  Implementing it requires a dedicated Product/experience contract rather than being smuggled into
  T-12 closure or T-13 recovery.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`
- **Reopen condition:** Architecture opens a dedicated Product authentication / onboarding gateway
  task, or pre-release readiness requires a real Product entry path for signed-out users.
- **Status:** `OPEN — UNASSIGNED`

This entry authorizes **no implementation**. Its boundaries, stated so the obligation is not
misread as a decision:

- the validation-only T12-04 auth harness is **not** the Product login experience and must not be
  promoted into one by implication;
- the existence of Supabase auth capability, auth-session persistence, or `signInWithPassword` is
  not the same thing as a Product login gateway;
- `T-13 — Recovery / Persistence` does not own this item merely because T-13 interacts with
  authenticated identity;
- `QAN-SEC-01 — Pre-release Mobile Credential Security` does not own this Product experience merely
  because it owns credential security (`QAN-BL-SEC-01`);
- no visual language, onboarding flow, registration flow, password-recovery flow, social auth,
  account creation, account linking, or credential UX semantics are defined by this entry.

The backlog records the obligation only (BG-07).

### `QAN-BL-VIS-01` — Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof

- **Title / Finding:** the canonical I-08B1 Living Analysis World has only been proved on its fixture world. Nothing
  shows how its density, level of detail, legibility and performance behave when a reader's conversation history is
  long-term and heavy.
- **Source:** [G2 closure §G item 8](design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md) ("HEAVY-HISTORY /
  LONG-TERM WORLD DENSITY + LOD STRESS PROOF — future stress proof"), carried unchanged by the
  [G3 readiness handoff §7](design/i-08b3.1-g2/QANDEEL_G3_READINESS_HANDOFF.md), and admitted by the
  [I-08B3.1-G3 closure §H](design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) when parent G closed.
- **Why deferred:** G3 was forbidden to redesign I-08B1, and its fixture world stays canonical. A stress proof needs
  heavy-history material and may need a reconciliation with the frozen D-track contract. Parent G closes without it and
  can no longer hold it.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`, because if reopened it can affect an already-frozen capability, the I-08B1 world.
- **Reopen condition:** Architecture or Product opens a world-scale density / level-of-detail proof task; or a production
  port, or real long-term history, shows the frozen world losing legibility, semantic truth or performance at scale.
- **Status:** `OPEN — UNASSIGNED`

This entry defines no density, no level-of-detail rule, no token and no world change. Any change to the world still passes through I-08B1's own reopen rule. The Product Owner's ruling that the F1 / F2 North Star spectacle requirement is met (G3 closure §E) is a separate, fully dispositioned obligation and does not answer this G2 heavy-history stress item.

### `QAN-BL-CW-01` — Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`)

- **Title / Finding:** owner deletion of Shared material never reaches the Public DRAFT derivative. Preparing a
  Public Experience manifest copies the author's Shared material into
  `public_experience_text_derivative_bodies` as a `SOURCE_CONTENT_BEARING_DERIVATIVE`. That row has no deleter
  and is immutable. `resolve_public_experience_review_v1`, executable by `service_role`, returns the body
  without checking current source availability. After the author deletes the material, a different human, the
  Experience's controller, can still read the deleted text through that review boundary, permanently. Every
  outward Public surface correctly goes dark; the internal controller review surface does not.
- **Source:** assurance finding `ASSURE-F05` (severity `HIGH`), in the `QAN-CW-ASSURE-01` register, preserved as
  evidence in
  [`assurance/connected-worlds/QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md`](assurance/connected-worlds/QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md)
  (SHA-256 `53ccf85f…68d8fe4`). The frozen invariants it cites are CW2-02 §27 (B19 / B20), CW2-03 §37 (C32),
  CW2-01 A18 and CW2-08 §2 ("deleted-content non-serving" is non-waivable), now preserved in
  [`canonical-authority/connected-worlds-v2/architecture/`](canonical-authority/connected-worlds-v2/architecture/).
- **Current truth:** not implemented on `main` in any form. Migration `0121` states "It implements no part of
  ASSURE-F05". Migration `0122` states "ASSURE-F05 is not implemented here in any form", and its deploy-time
  self-assertion `B7` refuses an owner-deletion body that touches Public state ("ASSURE-F05 is not authorized
  here"). Their tests assert that neither implements it
  (`database/tests/public-replay-consistency-historical-retry-remediation-v1.test.mjs`,
  `database/tests/introduction-disclosure-privacy-erasure-v1.test.mjs`).
- **Why deferred:** no remediation task has owned it. `QAN-CW-REM-01` … `REM-03` remediated other findings of
  the same register and explicitly excluded this one. The finding is cross-phase: I-05A owns the derivative
  and review boundary, I-04G / I-07D the deletion primitive, and I-05C the disappearance census. Its full
  remedy includes an open Product ruling: whether the retained bytes must also be destroyed, which would need
  a reviewed exception to the `0092` immutability guard. No write path reaches it today, because
  `prepare_public_experience_manifest_v1` is executable by no application role. The read boundary is already
  `service_role`-reachable.
- **Owner task:** `UNASSIGNED`
- **Severity:** `HIGH`, as the source states. The register keeps HIGH over one refuter's MEDIUM, because CW2-08
  §2 makes deleted-content non-serving non-waivable and the retention is permanent.
- **Reopen condition:** Architecture opens a Connected Worlds remediation or integration task for Public
  derivative source availability; or any task proposes opening Public draft creation or manifest preparation
  to an application role (the CW2-08 launch gate); or any task adds a reader of
  `public_experience_text_derivative_bodies`.
- **Required future property:** after owner deletion, no internal or public boundary serves a
  source-content-bearing Public derivative of the deleted material. This is the property CW2-02 §27 and CW2-08
  §2 already state; this entry adds none.
- **Status:** `OPEN — UNASSIGNED`

Admitted by the recovered canonical authority preservation, at the explicit direction of Architecture / the
Product Owner (BG-06). This entry chooses no remedy. The register's "remediation direction" is evidence, not a
decision, and nothing here authorizes implementation (BG-07).

---

## 6. Tombstones

All T-12 tombstones below were reconciled under BG-08 against **T-12 — Final Living Analysis Map
Integration v1**, PR **#220**, with final implementation/validation evidence head
**`02bff1b61c65c33a0d186da52dfa25d25baebe9e`**. The BG-08 commits after that head are governance-
record changes only and do not modify Product/runtime code.

### `QAN-BL-T12-01` — Original Inspection Journey-Origin Binding

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. T-12 supplies the real inspection-journey origin at the integration
  boundary; T-07 remains the final Return execution authority and no origin is manufactured by
  presentation.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-02` — Locale Provider / Regional Numeral Policy

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. One app-level locale authority is integrated; language and direction
  remain independent; Egypt is the v1 region where needed; Western `latn` digits remain the v1
  numeral policy unless a later Product contract changes it.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-03` — Final App-Shell Composition

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The real Product root composes the Living Analysis Map owners from one
  canonical runtime/store; the FoundationShell validation path is not the Product route.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-01` — Meaning Ignition Authoritative Trigger

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed by the canonical no-trigger branch. T-12 found no truthful authoritative
  semantic-crystallization signal, therefore **NO MEANING IGNITION CUE SHIPS**. No dormant or
  fabricated trigger was introduced.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-02` — Exact Composite Spatial-Cause Binding

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The exact `GO_LIVE_AND_LOCATE` cause is bound one-shot to its exact
  camera transition and cannot be borrowed by an unrelated act.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-03` — Physical Motion Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** passed under the T-12 platform matrix. Release-equivalent Android hardware evidence
  on the Honor X9b plus iOS Release native/simulator evidence showed no blocking teleport, jank or
  truth/parity violation. The protected Pan baseline remained 0.00% janky in measured runs and the
  user's physical judgement was smooth, fast, direct and comfortable.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-MOT-04` — Direct-Drag Presentation Culling

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** hardware testing reopened this item by proving blank-entry / sudden pop-in. T-12
  fixed the stale live-drag visibility corridor with bounded presentation admission; before/after
  evidence reduced the largest release-time admission jump from **+26.55 points to 0.00**, and the
  user confirmed the visible pop-in was completely gone while Pan feel improved.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-RSP-01` — Physical Responsive Recomposition Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** passed after T-12 corrected the short-landscape allocation defect. Android physical
  portrait↔landscape round-trips and iOS Release native composition kept all truth-bearing regions
  visible; no zero-height support region remained; affected large-text/RTL coverage passed.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-RSP-02` — Outboard Live Label Clipped at Large Text

- **Closing task:** `T-12 — Final Integration`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed. The final integrated responsive composition preserves visible and
  accessible Live wording at the required large-text envelope while keeping the outboard control
  separate from Moment-targeting space and preserving T-05 measurement authority.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T12-04` — Mobile Auth Session Storage Production Security + Device Validation

- **Closing task:** `T-12 — Final Integration / pre-release physical validation gate`
- **PR / SHA:** `#220` / `02bff1b61c65c33a0d186da52dfa25d25baebe9e`
- **Disposition:** completed for T-12. Android hardware and iOS Release-simulator lifecycle validation
  proved persist/restore, token replacement, sign-out removal, identity isolation and auth-only
  restoration. Architecture/Security produced
  [`t12-auth-storage-at-rest-disposition-v1.md`](t12-auth-storage-at-rest-disposition-v1.md) and
  explicitly accepted the v1 isolated SQLite risk boundary; no custom cryptography was introduced.
  The narrower platform-hardening residue — Android backup policy and physical iOS backup/Data-
  Protection attestation — is admitted separately as `QAN-BL-SEC-01`, not left hidden inside this
  closed item.
- **Status:** `CLOSED — TOMBSTONE`

### `QAN-BL-T13-01` — Restart / Recovery / Persistence

- **Closing task:** `T-13 — Recovery / Persistence v1`
- **PR / SHA:** `#223` / `5d9ba46efc6cf2d391096fcb3784bf2a5588ae15`
- **Disposition:** completed. Restart, recovery and persistence of the reader's viewpoint and
  reversible history are delivered. Product recovery is identity-scoped and separate from auth
  persistence: a signed-out launch reads no Product recovery at all, a record is validated before any
  Session is resumed, and a record that cannot be trusted fails closed rather than minting a
  replacement Session.
- **Status:** `CLOSED — TOMBSTONE`

This tombstone was recorded by `T-14 — Mobile Product Sign-In Gateway v1` under BG-08. T-13 closed
without reconciling its own inherited item, and this is that reconciliation; it reopens nothing and
changes no T-13 semantics.

### `QAN-BL-AUTH-01` — Mobile Product Sign-In Gateway

- **Closing task:** `T-14 — Mobile Product Sign-In Gateway v1`
- **PR / SHA:** `#225` / `784d8de75d97410d08dd9149ce822138ecfe9748` — the implementation evidence
  head, carrying every Product and test change of T-14. The commits after it are this BG-08
  governance record and one documentation correction; neither changes Product, runtime or test
  behaviour, and standard PR CI is green on the final head.
- **Disposition:** completed. A signed-out reader has one real Product entry surface, and it consumes
  only the already-frozen `MobileAuthAuthority.signInWithPassword`. A successful sign-in hands control
  back to the existing integration runtime, which owns
  `AUTHENTICATED → RECOVERING → BOOTSTRAPPING → READY`; the gateway creates no client, no storage, no
  Session and no route, and it navigates nothing. No onboarding, registration, password-recovery,
  social auth, account linking or credential-UX semantics were defined — the entry described by this
  item is the whole of what was built.
- **Status:** `CLOSED — TOMBSTONE`

The boundaries this item stated remain true: the validation-only T12-04 auth harness was not promoted
into a Product experience, and `QAN-SEC-01 — Pre-release Mobile Credential Security` still owns
credential security through `QAN-BL-SEC-01`, which T-14 left untouched.

---

## 7. Counts at this baseline

| Status | Count |
| --- | ---: |
| `DEFERRED — OWNED` | 1 |
| `VALIDATION — OPEN` | 0 |
| `OPEN — UNASSIGNED` | 9 |
| `CLOSED — TOMBSTONE` | 12 |
| **Total** | **22** |

| Severity | Count |
| --- | ---: |
| `HIGH` | 13 |
| `MEDIUM` | 8 |
| `LOW` | 1 |

These totals are counted mechanically from the §4 index, one row per ID.

T-12 inherited ten items and all ten are now tombstoned. `QAN-BL-SEC-01` was the sole new BG-08
admission made *at* T-12 closure. `QAN-BL-AUTH-01` is a later BG-08 reconciliation: the residue was
explicitly named in the T-12 document but missed this register, and it was admitted afterwards by
`PRE-T13 — T-12 Documentation / Governance Reconciliation`. Admitting it reopens nothing — T-12
remains `CLOSED / FROZEN`.

T-14 tombstoned two: its own `QAN-BL-AUTH-01`, and `QAN-BL-T13-01`, which T-13 delivered but did not
reconcile here before closing. `QAN-BL-SEC-01` is now the only `DEFERRED — OWNED` item in the
register, and it is unchanged. **T-14 admitted no new item.** Its anti-scope — sign-up, email
verification, password reset, magic link, OTP, social auth, biometrics, passkeys, profile,
onboarding, account deletion, account linking, "remember me", a password visibility toggle and
sign-out chrome — is anti-scope, and BG-06 admits none of it: none has an existing `OPEN` identifier,
none is deferred to a future task by a canonical document, none is carried forward for validation,
and Architecture designated none.

The I-08B3.1-G3 closure admitted `QAN-BL-VIS-01`. It is the one open item parent `I-08B3.1-G` could no longer hold once
it closed, so the register now counts seven `OPEN — UNASSIGNED` items.

**Count correction (recovered canonical authority preservation, 2026-09-24).** The table above had gone
stale. At the PR #268 baseline (`84f507d0`) the §4 index held 21 rows, not 20:

- 8 `OPEN — UNASSIGNED`, not 7;
- 12 `HIGH`, not 11.

The sentence above is left as it was written. It undercounted by one: the §4 index already held eight open
items once `QAN-BL-VIS-01` was admitted.

The preservation then admitted `QAN-BL-CW-01` (`ASSURE-F05`, `HIGH`, `OPEN — UNASSIGNED`). The register now
holds 22 items: 9 `OPEN — UNASSIGNED`, 13 `HIGH`. The correction reopens nothing and changes no other item.

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

Inherited after T-12 closure reconciliation:

| Task | Items it inherits on kickoff |
| --- | --- |
| `T-11` | none |
| `QAN-SEC-01 — Pre-release Mobile Credential Security` | `QAN-BL-SEC-01` |
| `T-13 — Recovery / Persistence` | `QAN-BL-T13-01` — delivered; tombstoned under BG-08 by T-14 |
| `T-12 — Final Integration` | none — reconciled and tombstoned under BG-08 / PR #220 |
| `T-14 — Mobile Product Sign-In Gateway v1` | `QAN-BL-AUTH-01` — explicitly claimed by the T-14 contract |

T-11 inherits nothing from this backlog. That historical kickoff invariant remains true after T-12 closure reconciliation.

### At closure (BG-08)

Before any task is declared CLOSED / FROZEN, Architecture:

1. reconciles every backlog item that task inherited — completed → `CLOSED — TOMBSTONE` with the
   closing task, PR and SHA and disposition; re-owned to one named task; or still deferred with a
   recorded reason;
2. admits every newly accepted cross-task deferral that qualifies under BG-06, with the complete
   schema of §2;
3. leaves every current blocker where it belongs — inside the active task, fixed (BG-01);
4. does not declare the task CLOSED / FROZEN while a qualifying cross-task residue exists only
   outside this document;
5. updates that task's own primary canonical document from its candidate/review banner to its final
   lifecycle state, in the same closing change (BG-09), leaving no successor task to do it.

### T-12 closure record

T-12 BG-08 reconciliation is complete on PR #220 against final implementation/validation evidence
head `02bff1b61c65c33a0d186da52dfa25d25baebe9e`: all ten inherited items are tombstoned, the one
qualifying new security residue is admitted as `QAN-BL-SEC-01`, and no T-12 Product, validation,
Architecture or Security blocker remains open in this register. The BG-08 commits after that head
are documentation-only governance records and do not alter Product/runtime code.

**Late BG-08 reconciliation.** One qualifying cross-task residue named by T-12 — the absent Product
mobile sign-in gateway — was recorded only in the task document and did not reach this register
before closure. It is admitted here as `QAN-BL-AUTH-01 — Mobile Product Sign-In Gateway`,
`OPEN — UNASSIGNED`, by `PRE-T13 — T-12 Documentation / Governance Reconciliation`, so that no
qualifying residue exists only in a task-local note. This is a register correction, not a lifecycle
change: T-12 stays `CLOSED / FROZEN`, no blocker is laundered (BG-01), no owner is invented (BG-02),
and no implementation is authorized (BG-07).

### T-14 closure record

T-14 BG-08 reconciliation covers two items.

`QAN-BL-AUTH-01` is the item T-14 opened by claiming: the contract names it, the task implements
exactly the Product entry it describes and nothing beside it, and the tombstone in §6 records the
disposition. `QAN-BL-T13-01` is a **late reconciliation of a predecessor**, in the same shape as the
`QAN-BL-AUTH-01` admission above: T-13 delivered restart, recovery and persistence and closed, but
left its own inherited item reading `DEFERRED — OWNED` here. T-14 records the tombstone rather than
leaving the register disagreeing with a closed task. That is a register correction, not a lifecycle
change — T-13 stays `CLOSED / FROZEN`, nothing about its semantics is reopened, and T-14 claims none
of its work.

`QAN-BL-SEC-01` remains `DEFERRED — OWNED` by `QAN-SEC-01 — Pre-release Mobile Credential Security`,
untouched: T-14 changed no auth persistence, no storage mechanism, no backup policy and no platform
credential model, and introduced no cryptography. No new item was admitted (BG-06), and no T-14
finding was moved here in order to close (BG-01).

### I-04 closure record (Connected Worlds v2 — Shared World Lifecycle / Conversation Runtime)

**Inherited: none.** At the kickoff of `I-04G`, the phase-closing slice, this register was read in
full. No item names `I-04`, `I-04G`, or any earlier `I-04` slice as its **Owner task**, and no item's
reopen condition is met by anything I-04 built. The only `DEFERRED — OWNED` item in the register,
`QAN-BL-SEC-01`, is owned by `QAN-SEC-01` and is untouched: I-04 changed no mobile auth persistence, no
storage mechanism, no backup policy and no platform credential model, and introduced no cryptography.

**Admitted: none.** I-04G's anti-scope is anti-scope, and `BG-06` admits none of it. The boundaries
I-04 stated and kept — `CW2-08` Safety / moderation / entitlement / Launch Gate; authenticated Product
routes, controllers and public RPC; mobile surfaces; a media storage provider, upload path or storage
credential; history-grant withdrawal after viewing; Introduction birth, success and end; Matching;
Public World; Replay; human-to-human live call; and the explicit-disclosure and World-event-derived
material producers — qualify under none of BG-06's four admission routes. None carries an existing
`OPEN` identifier; none is deferred to a future task **by a canonical document** as an obligation rather
than as a scope boundary; none is carried forward for validation; and Architecture designated none.
Several are owned by their own frozen `CW2-0N` contracts, which is where they belong: `CW2-04` owns
Public World, `CW2-05` owns Replay, `CW2-06` owns Matching and Introduction runtime, and `CW2-08` owns
safety, moderation, entitlements and launch integration. A contract that already owns a capability does
not also need a backlog entry claiming it.

**The unresolved-authority boundary is implemented, not deferred.** Phase-wide assurance later proved
that the original I-04G implementation did not fully satisfy this law: an empty dependency/approver set
could still be written as `RESOLVED_NO_HUMAN_REQUIREMENT`, and an unresolved source with known approvers
could be laundered to `RESOLVED_EXACT_HUMAN_REQUIREMENT` through `MATERIAL_DEPENDENCY`. These were active
correctness defects, not backlog candidates. `QAN-CW-REM-01` fixes both in forward migration `0119`:
zero-dependency QANDEEL material and every QANDEEL descendant of unresolved material remain
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` for later widening, while known approver rows and exact
baseline-audience delivery remain intact. Already-persisted affected rows are reconciled transitively
in the fail-closed direction without rewriting source history.

Because that boundary is complete inside this PR, **no backlog item is admitted for it**. There is no
outstanding correctness obligation to record, and BG-01 forbids moving an active-contract requirement
here rather than fixing it. The *enabling* capability — a future reviewed protected-human
subject-authority resolver — is owned by the frozen `CW2-08` and later domain contracts rather than by
an unassigned backlog entry, and qualifies under none of BG-06's four admission routes: it has no
existing `OPEN` identifier, no canonical document defers it to a named future task as an obligation, it
is not carried forward for validation, and Architecture designated none. The representation I-04G ships
is additive precisely so that resolver can extend it without reopening anything, which is recorded in
§4 of [`docs/shared-world-lifecycle-conversation-runtime-v1.md`](shared-world-lifecycle-conversation-runtime-v1.md).

**Independent closure review.** Exact implementation head `18dc934e67b951592838f7af33ecd7066efd84ab` passed independent ChatGPT
Architecture / Privacy / Database / Concurrency review after the accepted authority defect and the
same-class transitive propagation defect were corrected. `ASSURE-F04` was reproduced on real
PostgreSQL before correction and the same barrier-pinned race proved the cycle broken afterward. Two
complete Focused Database Verification rounds for `0119`, all required predecessor regressions, API
CI and Mobile CI were green on the exact accepted implementation head.

**BG-08:** no new cross-task backlog item is admitted. The authority and locking findings were active
I-04 correctness defects and were fixed before closure under BG-01. Existing Product/launch boundaries
remain owned by their already-frozen later contracts; `QAN-BL-SEC-01` remains owned by
`QAN-SEC-01` and is untouched.

**BG-09:** this same closure synchronization changes the primary I-04 banner to
`CLOSED / FROZEN`. No successor task is left to synchronize lifecycle state.

### QAN-GOV-03 lifecycle reconciliation

Two closed tasks were still advertising a pre-closure banner. `docs/recovery-persistence-v1.md`
(T-13) and `docs/mobile-product-sign-in-gateway-v1.md` (T-14) both read
`CANDIDATE — awaiting independent review` long after each had been reviewed, accepted and merged —
T-13 by PR #223 at `5d9ba46efc6cf2d391096fcb3784bf2a5588ae15`, T-14 by PR #225 at
`615e586f42be39a300370dcf32ef018d40cfaa94`. `QAN-GOV-03` corrected both banners and added BG-09
above, which is the rule whose absence allowed the drift.

**This changes no lifecycle and reopens nothing.** Both tasks were already CLOSED / FROZEN; only the
documents disagreed with the register. No Product semantics, ownership, security disposition or
acceptance criterion was touched, no backlog item changed status, and no implementation is authorized
(BG-07).

**The record of what went wrong stays.** The three late reconciliations above — `QAN-BL-AUTH-01`
admitted after T-12 closed, `QAN-BL-T13-01` tombstoned by T-14 after T-13 closed, and these two stale
banners — are the evidence BG-09 exists for. They are deliberately not rewritten to read as though
each task closed cleanly. The pattern is the point: in every case a successor absorbed work its
predecessor owed, which is precisely what BG-09 now forbids.

A bounded read-only sweep for the exact phrase `CANDIDATE — awaiting independent review` found these
two documents and no others. Two near-variant banners were found, classified and deliberately left
alone: `docs/mobile-runtime-entry-preconditions-v1.md` (T-12P) reads
`CANDIDATE — awaiting independent Architecture + Security review`, and
`docs/living-analysis-map-runtime-v1.md` (T-04) reads `implemented, awaiting independent Architecture
review`. Neither task carries a CLOSED / FROZEN closure record in this register, so neither is an
established stale banner, and repairing either on inference would be exactly the opportunistic
history-editing BG-09 warns against. They are reported to Architecture rather than corrected here.

### I-05 closure record (Connected Worlds v2 — Public World Runtime)

**Inherited: none.** At the kickoff of `I-05C`, the phase-closing slice, this register was read in
full. No item names `I-05`, `I-05A`, `I-05B`, `I-05C` or Public World as its **Owner task**, and no
item's reopen condition is met by anything I-05 built. `OPEN-06`, `OPEN-08`, `OPEN-09` and `OPEN-19`
are `OPEN — UNASSIGNED` navigation and acknowledgement capabilities that I-05 neither implements nor
blocks; `QAN-BL-SEC-01` is owned by `QAN-SEC-01` and is untouched — I-05 changed no mobile auth
persistence, no storage mechanism, no backup policy and no platform credential model, and introduced
no cryptography beyond the SHA-256 request and authority digests migrations 0091-0093 already
established. `QAN-BL-NAV-01` and `QAN-BL-NAV-02` are Personal navigation and Replay items and are
untouched: I-05C wrote no Replay producer and no Timeline surface.

**Admitted: none.** I-05's anti-scope is anti-scope, and `BG-06` admits none of it. The boundaries
I-05 stated and kept — `CW2-08` Safety / moderation / commercial entitlement / Launch Gate; the
`SIGNED_OUT_PUBLIC_VIEW_POLICY` launch requirement; authenticated Product routes, controllers and
public RPC; mobile surfaces; a public media boundary for `PUBLIC_VOICE`; Replay; successor-package
publication and republication of an absent Experience; historical alias-label rendering; a spatial or
ranking model over semantic placement; and general account deletion or erasure — qualify under none of
BG-06's four admission routes. None carries an existing `OPEN` identifier; none is deferred to a future
task **by a canonical document** as an obligation rather than as a scope boundary; none is carried
forward for validation; and Architecture designated none. Several are owned by their own frozen
`CW2-0N` contracts, which is where they belong: `CW2-04` owns Public World, `CW2-05` owns Replay and
`CW2-08` owns safety, moderation, entitlements and launch integration.

**The launch prerequisite is implemented as a fail-closed seam, not deferred.** No executable canonical
runtime for System / Safety policy, the Launch Gate or commercial entitlement exists in this
repository. I-05B created ONE seam, `resolve_public_publication_prerequisites_v1`, whose only answer is
`NOT_EVALUATED`, and made the publish boundary require exactly `CLEARED` from it as its LAST gate;
I-05C changed none of that and added no permissive constant, no launch-ready row and no
application-role grant. Production publication therefore fails closed on
`PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED` even when every authority gate is satisfied, and the
signed-out audience is still not admitted. Because that boundary is complete inside the phase, **no
backlog item is admitted for it**: there is no outstanding correctness obligation to record, and
`BG-01` forbids moving an active-contract requirement here rather than fixing it. The *enabling*
capability is owned by the frozen `CW2-08` contract rather than by an unassigned backlog entry, and the
seam is additive precisely so that slice can replace it without reopening anything. This is the same
disposition the I-04 closure record above records for the same boundary, on the same basis.

**Controller loss has no canonical producer, and I-05C did not invent one.** `I-05C`'s task contract
required a STOP if controller-loss semantics were essential to correctness and the frozen contracts did
not define whether controller loss invalidates an existing publication. They are not essential:
`create_public_experience_draft_v1` is the ONLY writer of `public_experience_controllers` in this
repository and there is no removal, transfer or revocation counterpart, so the event the policy would
govern cannot be produced by any canonical primitive. I-05C therefore implements the frozen reading —
control decides who may ISSUE a control action, and every consequential primitive re-checks it at
execution time — and continuing public eligibility reads no control at all. No backlog item is admitted:
a future reviewed multi-controller or transfer slice is an unbuilt capability owned by `CW2-04`, not an
outstanding obligation, and it qualifies under none of BG-06's routes.

**Post-publication source AVAILABILITY is a continuing condition; actor source ACCESS is not, and no
backlog item is admitted for the difference.** The frozen `0095` gate 6 is labelled `CURRENT SOURCE
ACCESS FOR THE PUBLISHING HUMAN` and asks the canonical I-04F entry point whether `auth.uid()` may still
see each included Shared history item at the consequential instant of publication. Nothing in
`0091`-`0097` re-asks it afterwards, so I-05C does not: re-asking it forever would let one human's later
loss of Shared browsing delete everyone else's Public view, which is a Product policy no frozen contract
states, and inferring it from the publish-time gate is exactly the inference that is unavailable.
Continuing eligibility instead consumes the actor-free availability and integrity truth the ONE I-05A
derivation already owns — availability state, captured availability revision, and the captured digest of
the Shared body and of the Personal committed unit — so owner deletion and source corruption fail closed
for the reason that is true, while a departed publisher's browsing status changes nothing. Migration
`0098` refuses at deploy time if that distinction is ever collapsed, and the real-PostgreSQL verifier
proves both directions against one fixture. This is a preserved frozen distinction rather than an
outstanding obligation, and it qualifies under none of BG-06's routes.

**I-05 implementation is complete; launch readiness is a different claim.** Migrations 0091-0099 leave
no Public World capability that I-05A, I-05B or I-05C deferred to a later slice. The Public World is
NOT product-launch ready and this record does not say otherwise: nothing in it can serve anybody in
production while the `CW2-08` prerequisite is unimplemented.

**Banner state.** `I-05` has no primary canonical document of its own — the canonical Public World
runtime documentation is [`database/README.md`](../database/README.md) — so `BG-09` has no stale banner
to correct here. Independent architecture, privacy, security and database-runtime review is complete;
this closure record is durable and intentionally carries no transient pull-request or merge-status text.

### I-06 closure record (Connected Worlds v2 — Replay Runtime)

**Inherited: one, and it is reconciled rather than tombstoned.** At the kickoff of `I-06D`, the
phase-closing slice, this register was read in full. Exactly one item names what `I-06` built:
`QAN-BL-NAV-02 — Analysis Replay`, whose finding is "there is no Replay of how an analysis developed"
and whose reopen condition is "Architecture opens a dedicated Replay contract". That condition was
satisfied by `CW2-05 — Replay Runtime Architecture v1.0 — CLOSED / FROZEN`, and `I-06` implemented it
in migrations `0100`-`0107`. It is nevertheless **not** tombstoned, and the reason is the whole of the
disposition: `I-06` closes the Replay *backend runtime*, and opens no Product surface through which a
human can watch an analysis develop. Tombstoning would record a capability this repository does not
have. `BG-08` permits three dispositions; `CLOSED — TOMBSTONE` would be untrue and `DEFERRED — OWNED`
would require naming an owner that does not exist, which `BG-02` and `BG-08` both forbid inventing. The
item therefore stays `OPEN — UNASSIGNED` with its **current truth** updated in §5 to record what now
exists, what still does not, and what remains fail-closed. Every other item is untouched: `OPEN-06`,
`OPEN-08`, `OPEN-09`, `OPEN-19` and `QAN-BL-NAV-01` are navigation, acknowledgement and Timeline
capabilities `I-06` neither implements nor blocks, and `QAN-BL-SEC-01` is owned by `QAN-SEC-01` — `I-06`
changed no mobile auth persistence, no storage mechanism and no credential model, and introduced no
cryptography beyond the SHA-256 request, authority and content digests migrations `0091`-`0105` already
established.

**Admitted: none.** `I-06`'s anti-scope is anti-scope, and `BG-06` admits none of it. The boundaries
`I-06` stated and kept — the video encoder, codec, container, bitrate, resolution, object storage, CDN,
public URL, signed URL, watermark and DRM; email, SMS, social and share-sheet transport; any external
provider contract, delivery receipt or recall capability; the final Replay player and the mobile Replay
Product surface; a protected-human analytical subject-authority resolver; a Shared or Public historical
analytical substrate; and `CW2-08` Safety / moderation / commercial entitlement / feature gate / Launch
Gate — qualify under none of `BG-06`'s four admission routes. None carries an existing `OPEN`
identifier; none is deferred to a future task **by a canonical document** as an obligation rather than
as a scope boundary; none is carried forward for validation; and Architecture designated none. They are
owned by their own frozen contracts, which is where they belong: `CW2-05` owns Replay and defers the
media and transport craft explicitly, and `CW2-08` owns safety, moderation, entitlements and launch
integration.

**Both launch prerequisites are implemented as fail-closed seams, not deferred.** This is the same
disposition the `I-04` and `I-05` closure records above take, for the same reason, and `I-06` has two
of them rather than one. `resolve_replay_analytical_distribution_authority_v1` answers
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT`, because the protected-human SUBJECT half of a QANDEEL
analysis authority requirement has no canonical producer in this repository; migration `0104` makes that
state **unrepresentable inside a distribution package** rather than merely refused, so unresolved can
never be reinterpreted as zero approvers. `resolve_replay_distribution_prerequisites_v1` answers
`NOT_EVALUATED` on every `CW2-08` dimension, and both the authorization boundary and the `I-06D` current
eligibility derivation require exactly `CLEARED` from it as their LAST gate, after every privacy and
ownership gate. Production Replay distribution therefore fails closed even when every authority gate is
satisfied. Because each boundary is complete inside the phase, **no backlog item is admitted for
either**: there is no outstanding correctness obligation to record, and `BG-01` forbids moving an
active-contract requirement here rather than fixing it. The enabling capabilities are owned by the
frozen `CW2-08` contract and by a future reviewed subject-authority slice, and both seams are additive
precisely so those can replace them without reopening anything.

**Source loss after finalization is implemented, and no Public rule was invented for it.** `CW2-05`
declines to invent automatic Public withdrawal solely because a private source later became
unavailable, and `I-06D` implements that as written: current source availability, current
complete-Replay usability and current delivery eligibility are all derived live and all fail closed on
source loss, while the canonical Public visibility resolver is consumed unchanged and no Public
lifecycle transition is performed. Everything the Public runtime already fails closed on — approval
withdrawal, controller disappearance, `ABSENT_FROM_PUBLIC_WORLD` and every other `I-05C`
continuing-eligibility failure — still does, immediately, and no Replay state resurrects an Experience
after any of them. `QANDEEL` cannot guarantee recall of already-exported external copies and this
runtime records no claim that it can. These are preserved frozen distinctions rather than outstanding
obligations, and they qualify under none of `BG-06`'s routes.

**`I-06` implementation is complete; launch readiness is a different claim.** Migrations `0100`-`0107`
leave no Replay runtime capability that `I-06A`, `I-06B`, `I-06C` or `I-06D` deferred to a later slice
of `I-06`. Replay is NOT product-launch ready and this record does not say otherwise: nothing in it can
distribute anything to anybody in production while the two prerequisites above are unimplemented, and
there is no media, storage or transport for it to distribute through.

**Banner state (`BG-09`).** `I-06` does have a primary canonical document —
[`docs/replay-runtime-v1.md`](replay-runtime-v1.md) — so `BG-09` applies here, and both halves were
performed by the closing change itself rather than left to a successor. Two stale banners existed and
both are recorded rather than erased: `I-06C` still read `CANDIDATE — awaiting independent ChatGPT
review` after the pull request that merged it, normalized by `I-06D` as the parent-closing slice and as
governance reconciliation only; and `I-06D`'s own candidate banner was moved to `CLOSED / FROZEN` by
the closure-sync change. Section 63 of that document carries the reviewed implementation SHA, the pull
request, and the statement that final merge still requires review and CI on the exact closure-sync
head. This register entry is durable and intentionally carries no transient merge-status text of its
own.

### I-07 closure record (Connected Worlds v2 — Matching / Introductions Runtime)

**Inherited: none.** The canonical backlog was read in full at I-07D kickoff. No open item names
`I-07`, `I-07D`, Matching or Introduction as its Owner task, and no existing reopen condition is
satisfied by this phase. `OPEN-06`, `OPEN-08`, `OPEN-09`, `OPEN-19`, `QAN-BL-NAV-01` and
`QAN-BL-NAV-02` remain navigation, acknowledgement, Timeline and Replay-surface items outside the
Matching/Introduction backend closure. `QAN-BL-SEC-01` remains `DEFERRED — OWNED` by `QAN-SEC-01`.

**Admitted: none.** I-07's anti-scope remains anti-scope under BG-06. The frozen later work — mobile
integration, final Product copy and visual treatment, exact progressive-image rendering, safety,
moderation, report/block, entitlements, pricing, feature rollout and Launch Gate integration — is
already owned by `I-08`, `I-09`, `CW2-06` or `CW2-08`. No new backlog item is invented merely to
repeat those ownership boundaries.

**Review findings were fixed, not deferred.** Independent review found `I07D-IDEM-01` and
`I07D-SCOPE-01`. Both were confirmed and corrected inside I-07D before acceptance: reactivation command
identity now binds entry-channel provenance on both historical retry paths, and migration `0118`
forward-extends the canonical Shared material cores so an `ACTIVE / INTRODUCTION` World supports normal
human/QANDEEL conversation without a parallel material or history model. BG-01 therefore has no defect
to move into this register.

**Phase state.** Exact accepted implementation head
`9be1757fc4686bdf76a3c39e39ba099f98d7181a` passed independent Architecture / Privacy / Database / Concurrency review after the fixes,
two complete Focused Database Verification rounds for migrations `0115`–`0118`, the required
predecessor regressions, and exact-head API/Mobile CI. `I-07A`, `I-07B`, `I-07C`, `I-07D` and parent
`I-07` are now `CLOSED / FROZEN`. Launch readiness is explicitly not implied; production-enabling
safety/entitlement/Launch Gate work remains fail-closed and owned by the later launch phase.

### I-08B3.1-G3 and parent I-08B3.1-G — design-track BG-08 reconciliation

This is a design-track record. `I-08B3.1-G3` is not Connected Worlds phase `I-08`, and this section is not a phase
record for it. The primary record is
[`design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`](design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md), and it
carries G3's and parent G's lifecycle state itself (BG-09).

**Inherited: none.** No item names G3, parent G or any I-08B3.1 task as its Owner task. The adjacent items stay where
they are:
- `QAN-BL-NAV-02` still owns the Product Analysis Replay surface;
- `QAN-BL-VOICE-01` still owns the Personal Voice / Live Call runtime. The G3 Matching / Live-Call rule consumes that
  item's future call authority and takes nothing from it;
- `QAN-BL-SEC-01` is untouched.

**Admitted: one, `QAN-BL-VIS-01`.**
- **Why it qualifies:** it is the heavy-history density / level-of-detail stress proof that G2 §G deferred by name and the G3 readiness handoff carried forward unchanged.
- **Why now:** parent G closes and can no longer hold it.
- **Why it is not a laundered blocker (BG-01):** G3's contract forbade touching the world.

**Not admitted:** every other G3 carry-forward, for the reasons the closure record §H states. None is admitted (BG-06):
- the proof copy;
- the device gates;
- the production implementation of the frozen presentation contracts;
- the Matching / Live-Call presentation, owned by Connected Worlds `I-08`.

**A disposition that needs no backlog entry.** The F1 / F2 North Star spectacle requirement, which the F records gave to
G, is dispositioned by the Product Owner's decision recorded in the closure record §E: met by the accepted canonical
I-08B1 world. That leaves no obligation to register.
