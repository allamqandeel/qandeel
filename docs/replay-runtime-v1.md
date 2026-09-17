# QANDEEL — Replay Runtime v1

**Phase:** `I-06 — Replay Runtime` — **CLOSED / FROZEN**
**Slice:** `I-06A — Replay Foundation, Authorized Source Capture and Draft Construction v1` —
**CLOSED / MERGED**
**Slice:** `I-06B — Replay Analytical Projection, Render Truth Contract and Preview / Finalization v1` —
**CLOSED / MERGED**
**Slice:** `I-06C — Replay Distribution Package, Distribution Authority, Export Privacy Sanitization
and Destination Runtime v1` — **CLOSED / MERGED**
**Slice:** `I-06D — Post-Finalization Source Availability, Distribution Reconciliation and Replay
Runtime Closure v1` — **CLOSED / FROZEN**
**Architecture authority:** `CW2-05 — Replay Runtime Architecture v1.0 — CLOSED / FROZEN`, with
binding `CW2-01`–`CW2-04` and `CW2-08`
**Migrations:** `0100_replay_foundation_source_manifest_selection_v1.sql`,
`0101_replay_authorized_draft_runtime_v1.sql`,
`0102_replay_analytical_projection_render_contract_versioning_v1.sql`,
`0103_replay_preview_finalization_runtime_v1.sql`,
`0104_replay_distribution_package_authority_v1.sql`,
`0105_replay_distribution_runtime_export_public_bridge_v1.sql`,
`0106_replay_post_finalization_source_availability_v1.sql`,
`0107_replay_distribution_current_eligibility_reconciliation_v1.sql`

The phase is closed and frozen. This document records what `I-06A`, `I-06B`, `I-06C` and `I-06D`
implemented, what they deliberately did not, and where each deferred capability is owned. Sections
1–16 describe the `I-06A` substrate, which the later slices consume unchanged; sections 18–31
describe `I-06B`; sections 32–48 describe `I-06C`; sections 49–60 describe `I-06D`; sections 61–63
carry the closure record. **Closing the runtime is not clearing the launch** — section 62 states that
distinction, and section 63 records the evidence this closure rests on.

> **`I-06C` status normalization — governance reconciliation only.** Pull request
> [#254](https://github.com/allamqandeel/qandeel/pull/254) merged `I-06C` into `main` as
> `c94a8cf714a65925784be38fcc73171355b84c10`, with the reviewed implementation head
> `b33bc7e92917a2afda45d3a366015a9592224062`. This document nevertheless still carried the pre-merge
> banner `I-06C — CANDIDATE — awaiting independent ChatGPT review` at that baseline. `I-06D` is the
> change that closes the `I-06` parent and therefore owns this document's closure record under
> `BG-09`, so it normalizes that residue here. The normalization is **governance reconciliation
> only**: not one `I-06C` Product semantic, migration, function, contract or verifier is reopened,
> changed or re-judged by it, and the pre-merge banner is recorded above rather than erased, because
> a record tidied until every task reads as though it closed cleanly is the next record to drift.

---

## 1. What a Replay is

Replay is a source-bound, temporally truthful derived artifact. The Product law is that the sound is
what happened and the picture is how QANDEEL understood it.

A Replay is **not** a World, an AI reenactment, a generic video editor, or an independent truth
source. Exactly three World types exist — `MY_WORLD`, `SHARED_WORLD`, `PUBLIC_WORLD` — and a Replay
is none of them. The merged `I-01A` kernel already classifies it as

```text
architectureClass = MATERIAL_ARTIFACT
kind              = REPLAY_ARTIFACT
```

and already separates the two authorities: `CREATE_INTERNAL_REPLAY_DRAFT` is `NO_AUDIENCE_EXPANSION`
and `DISTRIBUTE_REPLAY_EXTERNALLY` is `AUDIENCE_EXPANSION`. `I-06A` implements
`REPLAY_CREATION_AUTHORITY` and nothing else.

No generic `worlds` table, Replay membership, Replay geography, Replay governance or World lifecycle
exists, and migration `0100` refuses to deploy if any relation it owns grows a World, membership,
governance or semantic column.

## 2. The stable Replay identity

`public.replays` carries the stable `replay_id`, the exact human creator, the current lifecycle and
the birth instant, and nothing else. There is no public flag, share flag, download flag, distribution
approver, Premium flag, Safety result, Launch clearance, World type, membership, governance or
semantic coordinate — the migration asserts their absence by column-name pattern at deploy time.

The lifecycle vocabulary is complete and forward-safe:

```text
DRAFT           written by I-06A
PREVIEW_READY   representable, written by nothing in I-06A — I-06B
FINALIZED       representable, written by nothing in I-06A — I-06B
```

A trigger freezes the identity, the creator and the birth instant against re-binding. The lifecycle
is deliberately **not** frozen, because `I-06B` owns its later transitions.

## 3. Why there is no REPLAY_VERSION yet

The frozen invariants require every canonical `REPLAY_VERSION` to bind all four truth-relevant
components:

```text
REPLAY_SOURCE_MANIFEST_VERSION      I-06A
REPLAY_SELECTION_SPEC_VERSION       I-06A
ANALYTICAL_PROJECTION_VERSION       I-06B
RENDER_CONTRACT_VERSION             I-06B
```

`I-06A` owns the first two. A `REPLAY_VERSION` that bound two real components and two placeholders
would be a fake truth version, so **none is created**. The stable Replay instead carries a private
draft composition — the current manifest version, the current selection-spec version and a draft
revision — and the first complete `REPLAY_VERSION` belongs to the slice that can bind all four
truthfully. The seam is additive: `I-06B` adds its relations beside these and binds the exact
component versions `I-06A` makes immutable.

## 4. The source manifest is a binding, never a copy

`public.replay_source_manifest_versions` holds one immutable manifest version bound to exactly **one**
authorized source context, so that "the complete authorized universe" has exactly one meaning.
`public.replay_source_manifest_items` holds its exact item set in canonical source order.

An item identifies the source class, the exact object identity, the exact version or availability
revision, the original medium, the canonical temporal anchor and the canonical source-identity
digest. It identifies **nothing by content**. There is no body, text, transcript, audio reference,
payload or JSON column anywhere in the slice, no foreign key to any body relation that owner deletion
destroys, and no reference at all to the sealed Public provenance. A later owner deletion therefore
makes a draft stale instead of being defeated by a private shadow copy. Preserving provenance
identity after deletion is allowed; reconstructing deleted content is not.

### What `captured_source_digest` attests, exactly

It is the one-way canonical **body-identity** digest each source substrate already defines for its own
material, recorded so that a later revision of that material is detectable. It is not an independent
attestation of media bytes, and the wording matters per source:

| Source | What the digest covers |
| --- | --- |
| `MY_WORLD` | `sha256` over the committed unit's exact UTF-8 text, so it does attest the source bytes |
| `SHARED_WORLD` text | `sha256` over the exact material body text |
| `SHARED_WORLD` voice note | the frozen I-04G convention: `sha256` over the opaque audio object **reference** and the transcript |
| `PUBLIC_EXPERIENCE` | the bounded public item's own `public_body_digest`, read from the exact package row |

For a Shared voice note the digest therefore attests the canonical identity of the voice-note body and
**does not attest the underlying audio media bytes**, and it confers no media delivery capability.
Whether that media can be fetched or rendered at all is `I-06B`'s question. This slice neither renames
nor redesigns the established I-04G convention.

### Structural separation, and exact same-row identity

The three classes are kept apart **by structure**, not by convention: one exact-shape `CHECK` per
relation, class-specific restrictive foreign keys, and composite foreign keys binding every item to
its own manifest's exact source context. A Personal item cannot carry a Shared identifier, and an item
cannot name a World, Session or package its manifest does not.

Foreign keys prove that every source row an item names **exists**. They cannot prove that the several
columns an item stores describe the **same** canonical row, because each key reaches its parent
independently. Without more, a privileged malformed insert could pair committed unit A with unit B's
Session Position, or Shared material M1 with material M2's history item inside one World, and describe
a source event that never happened out of parts that each exist.

A Replay-owned `BEFORE INSERT` guard closes that, for every role including the table owner:

```text
MY_WORLD           id + session_id + session_position + source_role   ONE conversation_units row
SHARED_WORLD       material id + world_id + history_item_id           ONE shared_world_materials row
                   history id + world_id + occurred_at                ONE shared_world_history_items row
PUBLIC_EXPERIENCE  package item + ordinal + derivative classification ONE package item row
```

The guard fires **only when every parent it compares already exists**, so it never preempts a foreign
key: a missing parent is still answered by the exact key that owns it, and that structural proof stays
reachable rather than hidden behind a procedural check. It reads source identity and no content. This
needed no change to any frozen predecessor migration, and **I-06A still alters no predecessor table**:
no candidate key was added to `conversation_units`, `shared_world_materials` or any other frozen
relation.

Defence in depth: `derive_replay_source_manifest_currency_v1` refuses to call such a binding CURRENT
even if one somehow existed, answering the internal class `SOURCE_CONTRADICTORY` **before** it answers
availability or access.

**Temporal anchors, never a new clock.** Migration `0072` owns the canonical temporal and no-hindsight
constitution and this slice creates no competing clock. A Personal item binds the `0065` Session
Position; a Shared item binds the frozen `0087` establishment instant; a Public item binds the
package's deterministic item ordinal. `created_at` decides nothing.

## 5. Selection

`public.replay_selection_spec_versions` and `public.replay_selection_spec_items` hold one immutable
resolved selection over one exact manifest version: stable manifest item identities, a derived
chronological order, exact source-native anchors — the whole item, or a half-open code-point range
inside a text item — and a declared coverage class.

**Coverage is proven, never asserted.** `FULL_SOURCE` is representable only when every manifest item
is selected whole, contiguously, over a manifest that captured the complete authorized universe. The
completeness half is a `GENERATED` column on the manifest bound by composite foreign key, so a caller
cannot self-assert completeness however the row is produced. The other two classes are
`SELECTED_EXCERPT` and `HIGHLIGHT_SELECTION`.

**Chronology cannot be reversed.** The selected order is derived from the manifest's canonical order,
and a `BEFORE INSERT` trigger makes a selected order that disagrees with source chronology
*unrepresentable* rather than merely refused. A selection may omit real moments; it may never reorder
them into a false story. A gap between selected items is legal and is recorded as machine truth
(`source_contiguous`) for `I-06B` to render perceptibly.

**No column says a cut is safe.** Semantic Cut Safety — negation, qualification, attribution, clause
context, meaningful timing — is `I-06B`. `I-06A` persists resolved anchors and intent, never
`semantic safety = TRUE`.

**Natural-language selection is representable and unwritten.** `selection_method` admits
`NATURAL_LANGUAGE_RESOLVED` so a later reviewed bounded resolver is additive, but every writer in this
slice produces `EXPLICIT_RESOLVED_ANCHORS`, and the selection core accepts only identities that are
already inside the manifest it just captured or proved current. A client or model cannot introduce a
source identity that was never in the authorized universe. The missing piece is an application and
provider seam that turns free text into candidate handles from that bounded universe; until it is
reviewed, arbitrary natural-language interpretation is non-executable rather than faked.

## 6. The current draft composition

`public.replay_draft_state` is the ONE mutable pointer: the current manifest version, the current
selection-spec version, the draft revision and the update instant. It moves forward exactly one
revision per controlled transaction, by trigger, and can never be re-bound to another Replay. The
selection is bound to the manifest it was resolved over as one exact pair, so the pointer can never
name a selection over one manifest beside a different manifest.

Changing source or selection creates **new** immutable component versions and advances the pointer
atomically. Every old component remains historical truth; nothing is mutated. All four component
relations are append-only for every role **including the table owner**, by `BEFORE` trigger, because
privileges do not bind the owner.

## 7. Source adapter capability matrix

This is what the repository can actually produce today, not what the vocabulary can spell.

| Source | Status |
| --- | --- |
| `MY_WORLD` committed text | **SUPPORTED** from canonical `conversation_units`, owner-exact |
| `MY_WORLD` original audio / call | **NOT PRODUCIBLE** — no durable canonical source exists |
| `SHARED_WORLD` `HUMAN_TEXT` | **SUPPORTED** when exact history visibility allows |
| `SHARED_WORLD` `HUMAN_VOICE_NOTE` | **SOURCE IDENTITY SUPPORTED**; render and media delivery not claimed |
| `SHARED_WORLD` `QANDEEL_OUTPUT` / `QANDEEL_ANALYSIS` | **SUPPORTED** when exact history visibility allows |
| Reserved Shared kinds without producers | **NOT PRODUCIBLE** — unrepresentable by `CHECK` |
| owned `PUBLIC_EXPERIENCE` | **SUPPORTED** only through exact Experience control over the bounded artifact |
| Replay-of-Replay | **NOT IMPLEMENTED** |
| `SHARED_HUMAN_LIVE_CALL` | **DISABLED / GATED** — unchanged by this slice |

### MY_WORLD

The actor must own the exact Personal Session, and the manifest binds `(Session, owner)` to the Replay
creator structurally through the identity row — not by a check a later writer could forget. Both
delivered human and delivered QANDEEL conversational text may be source events inside the owner's own
private Replay; that is not publication of protected analysis, because `I-06A` widens no audience.

**Personal audio does not exist and is not invented.** `conversation_units.source_modality` is
`CHECK`-pinned to `TEXT`. There is no reviewed durable Personal call or audio object source in this
repository, so no synthetic `ORIGINAL_AUDIO`, no invented audio object, no invented storage provider
and no transcript promoted to original audio. The `original_medium` vocabulary is forward-safe for a
future reviewed original-audio source; a Personal item is `CHECK`-pinned to `ORIGINAL_TEXT` today.

### SHARED_WORLD

Eligibility comes from the ONE canonical entry point,
`resolve_shared_world_history_visibility_v1`, and is never re-derived from current membership, member
count, material ownership or a Standing Context Grant. A former member or a closed-World viewer is
eligible exactly when that resolver says the exact item is visible to them, and not otherwise. A raise
from the resolver becomes the bounded unavailable class rather than an error a caller can read.

A Shared `HUMAN_VOICE_NOTE` binds as **original-audio identity** because its canonical Shared material
really exists. The opaque server audio handle is digested one way into the captured digest and stored
nowhere, reaches no application surface, and enters no public artifact. Whether it can be previewed or
rendered is `I-06B`'s question, not a claim made here.

### owned PUBLIC_EXPERIENCE

Authority is `EXPERIENCE_CONTROL_AUTHORITY` — an exact row in `public_experience_controllers` for the
creating human — and never `PUBLICLY_VISIBLE`, viewer admission, having read the Experience or knowing
its id. `resolve_public_visibility_state_v1` is **not** consulted for creation eligibility. An ordinary
Public viewer cannot remix or rebuild somebody else's Experience.

The Replay binds the bounded public derivative of the exact controlled current version, as ONE exact
row through the additive `0095` candidate key `(version, Experience, package manifest)`. It never
traverses `publication_package_item_provenance`: that sealed provenance is internal audit truth and is
not a source-access bridge into hidden Personal or Shared source. A non-current version fails closed
rather than inventing historical controller access, and the schema keeps a future reviewed
historical-version capability possible.

## 8. Creation is not distribution

Creating a draft creates no Public audience, no external audience, reserves no distribution right,
requires no external-distribution approval, does not become public because its source was public, and
creates no World.

Not implemented anywhere in this slice: `PUBLISH_TO_PUBLIC_WORLD`, `SHARE_EXTERNALLY`, `DOWNLOAD`,
`REPLAY_DISTRIBUTION_PACKAGE_VERSION`, distribution approvers, export entitlement and export
sanitization. Those are `I-06C`.

## 9. Source availability and staleness

`derive_replay_source_manifest_currency_v1` is the ONE currency derivation. It is read-only and takes
no lock of its own — a caller needing a stable answer holds the source rows — and asks of CURRENT
state whether every bound source is still exactly what the manifest captured and still legitimately
available to the creator. It answers a two-state currency plus an INTERNAL bounded staleness class:

```text
SOURCE_CONTRADICTORY        answered FIRST: the binding is not one canonical row
SOURCE_UNAVAILABLE          availability is answered BEFORE access
SOURCE_CHANGED
SOURCE_ACCESS_LOST
SOURCE_VERSION_NOT_CURRENT
```

Both human primitives revalidate under lock before committing, so prepared state cannot silently
commit over a source that changed, was deleted, became unavailable, became inaccessible to the
creator, lost controller authority or stopped being the eligible version. A stale manifest is never
rewritten to "fix" it: the derivation reports staleness and history stays exactly as captured.
Finalization-time handling is `I-06B` and `I-06D`.

## 10. Anti-oracle privacy

Unauthorized source probing is not an existence oracle. One bounded class,
`REPLAY_SOURCE_NOT_AVAILABLE` (`P0002`), covers a source that does not exist, a source belonging to
another human, a Shared item whose history is not visible, and an Experience the caller does not
control. `REPLAY_NOT_AVAILABLE` covers a Replay that does not exist and another human's Replay
identically.

No surface exposes a hidden World id, hidden membership, hidden participant identity, hidden material
count, private provenance, approval state, or why a different human cannot reach something.

The ONE read boundary, `resolve_replay_draft_composition_v1`, answers the exact creator and returns
zero rows to everyone else. It returns the composition and its derived currency and **no source
identity at all**: no Session, World, material, unit, package item, digest, availability revision or
media handle. Some creator source access is not a reason to expose private source paths through a DTO.

## 11. Security and ACL posture

Every relation is `postgres`-owned, RLS-enabled with zero policies, and revoked from `PUBLIC`, `anon`,
`authenticated` and `service_role`. Every function is `postgres`-owned, `SECURITY DEFINER` and
`search_path`-pinned.

The two human primitives derive the actor from `auth.uid()`. There is no `actor_user_id`,
`creator_user_id` or `owner_user_id` parameter anywhere through which a caller could manufacture
another human's Replay, and no mutation accepts an authority, audience, order, digest, medium or
completeness parameter either.

Every consequential primitive, both internal cores, the lock helper and the currency derivation are
executable by **no application role**. `service_role` alone may execute the creator-exact read
boundary, following the frozen narrow-resolver precedent of `0087` / `0089` / `0093`. This is the
established posture for a primitive awaiting a reviewed Product or Launch wrapper: the exact human
identity stays session-derived even though application-role `EXECUTE` is not yet granted.

**No Safety, Launch or entitlement decision is fabricated.** There is still no executable canonical
`CW2-08` runtime in this repository, and no `I-06A` function claims `SAFETY_ALLOW`, `LAUNCH_CLEARED`,
`ENTITLED`, `FEATURE_ENABLED` or `PUBLIC_LAUNCH_READY`. A later reviewed Launch integration may wrap
the internal primitive while preserving the exact human's `auth.uid()`. This slice adds no route,
controller, RPC or mobile surface.

## 12. Concurrency and lock order

One deterministic discipline, forward-safe for `I-06B` / `I-06C` / `I-06D`: **the Replay object first,
then each source domain in that domain's own frozen relative order**, and canonical source truth is
stabilized and revalidated before the source-bound draft commit becomes durable.

```text
1. public.replays                                   FOR UPDATE

2. MY_WORLD           session_semantic_clocks       FOR SHARE
                      conversation_units            FOR SHARE, ORDER BY id

   SHARED_WORLD       shared_worlds                 FOR SHARE
                      shared_world_materials        FOR SHARE, ORDER BY id
                      shared_world_history_items    FOR SHARE, ORDER BY id

   PUBLIC_EXPERIENCE  public_world_state            FOR SHARE
                      public_experiences            FOR SHARE
                      publication_package_manifest_versions FOR SHARE

3. Replay component writes
```

The Shared order is the frozen `I-04` order and the Public order is the canonical Public order. When
several source rows are taken, they are sorted by a canonical key. No predecessor writer takes a
Replay lock, and every Replay path takes the Replay row before any source row, so no path can invert
into a cycle. The migration asserts the ordering of its own text at deploy time by comparing the
positions of the lock statements inside each function body. No advisory lock, process mutex or
in-memory lock substitutes for database correctness.

Proven on real PostgreSQL across two connections: duplicate birth converging on one Replay and one
answer; competing draft revisions producing one winner and one stale loser; an owner deletion waiting
behind a revision and then the draft reading stale, and the reverse order where a deletion in flight
blocks a capture that then refuses; Public version supersession racing a capture; and Shared access
loss racing a capture. No test expects a deadlock and none occurs.

## 13. Idempotency

Both consequential commands are durably idempotent through narrow typed command relations —
`replay_create_commands` and `replay_draft_revision_commands` — never a generic untyped event table.

The request identity is a one-way token over the whole request: the actor, the Replay, the component
ids, the source class and context, the sorted source items and the sorted selection with its ranges,
and the requested coverage class. An equivalent retry returns the **original committed answer** rather
than re-reading current state, a same-command-id-different-request is `REPLAY_COMMAND_ID_CONFLICT`,
and one immutable component identity can never be re-bound to different sources.

## 14. Error vocabulary

```text
REPLAY_AUTHENTICATION_REQUIRED   42501
REPLAY_COMMAND_INVALID           22023
REPLAY_COMMAND_ID_CONFLICT       23505
REPLAY_ID_CONFLICT               23505
REPLAY_NOT_AVAILABLE             P0002
REPLAY_SOURCE_NOT_AVAILABLE      P0002   the ONE anti-oracle class
REPLAY_SOURCE_KIND_RESERVED      0A000   raised only after authority is proven
REPLAY_SOURCE_STALE              40001
REPLAY_DRAFT_STALE               40001
REPLAY_LIFECYCLE_INVALID         55000
REPLAY_COVERAGE_NOT_PROVABLE     22023
REPLAY_SELECTION_INVALID         22023
REPLAY_CONTRADICTORY_STATE       P0001
```

## 15. What I-06A did not do, and who owns it

| Deferred | Owner |
| --- | --- |
| complete `REPLAY_VERSION`, `ANALYTICAL_PROJECTION_VERSION`, `RENDER_CONTRACT_VERSION` | `I-06B` |
| `PREVIEW_READY`, `FINALIZED`, preview and finalization | `I-06B` |
| Semantic Cut Safety evaluator, temporal discontinuity rendering, timing compression | `I-06B` |
| camera and motion, captions, Living Analysis Map historical projection | `I-06B` |
| codec, container, media storage, CDN, export resolution | `I-06B` / deferred by `CW2-05` |
| `REPLAY_DISTRIBUTION_PACKAGE_VERSION`, distribution approvers, revalidation at distribution | `I-06C` |
| `PUBLISH_TO_PUBLIC_WORLD`, `SHARE_EXTERNALLY`, `DOWNLOAD`, `EXPORT_PRIVACY_SANITIZATION` | `I-06C` |
| source-loss enforcement after finalization | `I-06D` |
| Safety, moderation, entitlement, feature flag and Launch Gate runtime | `CW2-08`, unimplemented |
| Matching, Introduction, cross-world navigation UI, mobile Replay UI, deep links | outside `I-06` |
| live in-conversation Replay capture, full timeline editor, synthetic voice and dubbing | deferred by `CW2-05` |
| a new Personal call recorder, Shared human live-call enablement | not opened |

Static contracts protect what this slice owns without becoming ceilings on that roadmap: a mirrored
probe proves that every one of those authorized future additions leaves both `I-06A` contracts
passing, while each deliberate weakening of an `I-06A` authority, privacy or truth invariant breaks at
least one of them.

## 16. Backlog and governance disposition

`QAN-BL-NAV-02 — Analysis Replay` is `OPEN — UNASSIGNED` in
[`docs/qandeel-canonical-backlog-v1.md`](qandeel-canonical-backlog-v1.md) with the reopen condition
"Architecture opens a dedicated Replay contract".

That condition is now satisfied in substance by `CW2-05 — CLOSED / FROZEN`. This slice nevertheless
**leaves the entry exactly as it is**, on the governance rule rather than on preference: `BG-05` step 5
says an `OPEN — UNASSIGNED` item is left alone unless the task contract explicitly claims it, and the
`I-06A` contract does not claim it — it directs that the item be carried explicitly instead. The
register act belongs to Architecture under `BG-08` at `I-06` closure reconciliation, where the item is
to be tombstoned, re-owned to a named task, or deferred with a recorded reason. Recording the
disposition here is that explicit carry; silence would not be one. `BG-07` applies throughout: nothing
in the backlog is Product authority and no runtime semantics were taken from it.

## 17. Status

```text
I-06  — CLOSED / FROZEN
I-06A — CLOSED / MERGED
I-06B — CLOSED / MERGED
I-06C — CLOSED / MERGED
I-06D — CLOSED / FROZEN
```

The phase was **ACTIVE** from the opening of `I-06A` until the `I-06D` closure-sync change recorded in
section 63, and `I-06D` carried the banner `CANDIDATE — awaiting independent ChatGPT review` until
that same change. Both transitions are recorded rather than erased, on the `BG-09` rule: a register
tidied until every task reads as though it closed cleanly is the next register to drift.

Section 62 keeps the distinction this closure must not blur — the runtime is closed; the production
launch is not cleared.

---

# I-06B

## 18. The first complete Replay Version

`I-06A` owned two of the four truth components and refused to fake the rest. `I-06B` creates the
missing two and therefore the first canonical `REPLAY_VERSION`.

```text
replay_versions
  id
  replay_id
  replay_version_revision
  source_manifest_version_id        I-06A
  selection_spec_version_id         I-06A
  analytical_projection_version_id  I-06B
  render_contract_version_id        I-06B
  created_at
```

Every component column is `NOT NULL`, and the four are bound as ONE composition rather than through
four independent references that could each name a row of a different Replay:

```text
manifest    (source_manifest_version_id, replay_id)
              -> replay_source_manifest_versions (id, replay_id)
selection   (selection_spec_version_id, source_manifest_version_id)
              -> replay_selection_spec_versions (id, source_manifest_version_id)
projection  (analytical_projection_version_id, selection_spec_version_id,
             source_manifest_version_id, replay_id)
              -> replay_analytical_projection_versions (…)
contract    (render_contract_version_id, analytical_projection_version_id,
             selection_spec_version_id, source_manifest_version_id, replay_id)
              -> replay_render_contract_versions (…)
```

There is no nullable truth component, no placeholder and no `PENDING` projection. A truth or material
change creates a NEW Replay Version; nothing is ever mutated. Every truth component is append-only for
every role INCLUDING the table owner, by `BEFORE` trigger.

## 19. ANALYTICAL_PROJECTION_VERSION

An immutable commitment to **the actual QANDEEL analytical state that was legitimately available and
projection-valid at each represented source point**. It is never a prompt result, a summary generated
now, a current-model rerun over old source, a visual styling payload or source text copied into an
analysis blob.

Migration `0072` owns the canonical temporal / no-hindsight constitution and `I-06B` creates no
competing clock, no Replay-specific historical substrate and no second projection authority — the
migration refuses to deploy if a `replay_*` relation names a semantic clock, a world version, a
baseline or a coverage decision. The ONE analytical input is:

```text
K(TC) = get_session_historical_projection_v1(session, TC)
```

taken at the exact represented Session Position of each selected source item. That position is not a
value a writer chose: `replay_analytical_projection_points` binds
`(source_manifest_version_id, source_item_ordinal, represented_session_position)` to the manifest
item's own `personal_session_position` by foreign key.

### Only a SEALED coordinate may be frozen

Migration `0072` states its own stability contract: the result "is stable for a sealed TC and may
legitimately evolve while TC is the open head". A Replay Version must never freeze an analytical state
whose historical answer can still legitimately change under the same represented coordinate, so:

```text
sealed  (TC < Live Head)   may be bound
open Live Head             REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD — retried later, never frozen
```

`projection_sealed` is `CHECK`-pinned `TRUE` and `projection_live_head > represented_session_position`
is checked too, so an unsealed point is unrepresentable however the row is produced.

## 20. Source-class analytical projection capability matrix

```text
MY_WORLD covered Session, sealed points   PERSONAL_SESSION_HISTORICAL_PROJECTION — SUPPORTED
MY_WORLD covered Session, open Live Head  NOT AVAILABLE — REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD
MY_WORLD LEGACY_UNCOVERED Session         NOT AVAILABLE — REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE
MY_WORLD source medium                    text only (conversation_units.source_modality is TEXT)
SHARED_WORLD                              NOT AVAILABLE — REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE
owned PUBLIC_EXPERIENCE                   NOT AVAILABLE — REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE
```

The repository census behind the last two lines. A Shared history item of kind `QANDEEL_ANALYSIS` is
**source content** in a Shared World, and a bounded Public Experience derivative is **public source
material**; neither is a historical analytical projection of QANDEEL.
`shared_world_material_historical_authority` is a historical AUDIENCE-WIDENING resolution state, and
`public_experience_search_projection` and `public_experience_vitality_state` are derived, rebuildable
and explicitly never authorities. None of them is time-indexed by a knowledge coordinate,
knowledge-time truthful, version-valid, deterministically revalidatable or hindsight-free.

So preview and finalization **fail closed** for those classes with ONE bounded class, and:

```text
the I-06A DRAFT stays exactly as valid as it was
no hidden source detail leaks
no current AI rerun occurs
no fake zero-element projection is marked complete
no silent downgrade to a source-only Replay happens
```

This is a supported capability boundary, not a task failure. `projection_capability` carries exactly
one value, bound to `source_class = 'MY_WORLD'`, and `source_class` is read FROM the manifest by
composite foreign key — so a Shared or Public manifest cannot carry a Personal historical projection
however the row is produced.

## 21. The projection canonicalization

Schema identity `QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1`, pinned by `CHECK`.

Each family of `K(TC)` is rendered in PostgreSQL's own canonical `jsonb` form — object keys in a fixed
order, numbers as canonical numeric text — and then SORTED by that text under the `C` collation, so the
result is a property of the SET and not of the order the producer emitted. No language-runtime
serialization participates: there is no `JSON.stringify` anywhere in the commitment.

Two things are excluded, and both by construction rather than by omission:

| excluded | why |
| --- | --- |
| `moments` | the committed source-event payload, including `committedText`. The source manifest already binds each item's canonical source-identity digest. The canonicalization declares **no** `moments` parameter and its exact input list is pinned by the migration and by the static contract, so one cannot be added silently. |
| `materials[].expiry` | `0072` section 13: an expiry "is a policy fact in the wall-clock domain … It is NEVER compared to TC", and its `PENDING -> SP(LH)` mapping legitimately moves with wall time while the sealed historical answer does not. The TC-domain answer it feeds, `statusAtTc`, stays in the digest. |

The projection revision facts (`liveHead`, `worldVersion`, `sameSpEventSequence`, `pendingExpiries`)
are likewise absent from the digest: they are freshness tokens of the live Session, not the historical
answer at TC. `replay_analytical_projection_points` records them as the provenance of the derivation.

## 22. Semantic Cut Safety

```text
WHOLE_ITEM              SAFE      nothing was trimmed, so no negation, qualification,
                                  attribution or clause context can have been removed
TEXT_CODE_POINT_RANGE   UNPROVEN  no canonical deterministic boundary / attribution substrate
                                  exists in this repository, and none is invented here
```

Only `SAFE` may enter a complete Replay Version. The rule is structural, not procedural: a `CHECK`
requires `SAFE` to imply `WHOLE_ITEM`, another requires `TEXT_CODE_POINT_RANGE` to be `UNPROVEN` or
`REJECTED`, and the assessment binds the selected item AND its exact anchor kind as ONE row, so a row
claiming an anchor kind it does not have simply does not resolve.

A selection is never silently widened to make a cut pass. An expansion is a NEW explicit selection
revision through the frozen `I-06A` draft path.

## 23. Temporal discontinuity

One row per adjacent selected pair whose captured source-universe ranks are non-consecutive. Both
endpoints are bound as exact selected rows and both recorded ranks as the exact captured ranks; the
omitted count is `GENERATED ALWAYS AS (right_rank - left_rank - 1) STORED` with `CHECK (> 0)`, so a
fabricated gap over a contiguous pair is unrepresentable and no writer can author the number.

It copies no omitted content and names no omitted item: a gap is machine truth about ABSENCE. The
render contract requires `PERCEPTIBLE_DISCONTINUITY_REQUIRED` — a gap may never masquerade as
continuous source time.

## 24. Timing Semantic Integrity

The four concepts stay separate: audit timestamp, knowledge availability, source timing, render pacing.

The durable Personal source is text-only, and a text event has no original voice timing to preserve.
The render contract therefore carries `timing_integrity_policy = 'PRESENTATION_PACING_DECLARED'`,
pinned by `CHECK`: pacing is declared as PRESENTATION behaviour and is never presented as original
conversational timing.

Where an authorized original-audio source exists — a Shared voice note — its frozen `I-04G` digest is a
body IDENTITY over an opaque object reference and a transcript. It attests no media bytes and grants no
media-delivery capability, and this repository has no authorized media path. At this baseline the
source-class census refuses such a Replay first, so the procedural medium gate in `0103` is
unreachable; the line is actually held by `source_medium_class = 'ORIGINAL_TEXT_ONLY'` on the render
contract, which makes an audio-bearing contract row unrepresentable. Nothing synthesizes an absent
medium, and no transcript is ever promoted to an original spoken event.

## 25. RENDER_CONTRACT_VERSION

The truth contract a renderer must obey, bound to the exact analytical projection / selection /
manifest / Replay composition, with every policy an exact versioned value:

```text
source_medium_class            ORIGINAL_TEXT_ONLY
original_medium_policy         PRESERVE_ORIGINAL_MEDIUM_ONLY
source_text_policy             EXACT_SOURCE_TEXT
semantic_cut_policy            WHOLE_ITEM_ONLY_PROVEN_SAFE
temporal_discontinuity_policy  PERCEPTIBLE_DISCONTINUITY_REQUIRED
timing_integrity_policy        PRESENTATION_PACING_DECLARED
analytical_projection_policy   BOUND_HISTORICAL_PROJECTION_DIGEST
camera_emphasis_policy         EMPHASIS_WITHOUT_MEANING_CREATION
motion_policy                  EXPLANATORY_MOTION_ONLY
caption_provenance_policy      DERIVED_CAPTION_DISTINCT_FROM_SOURCE
accessibility_parity_policy    EQUIVALENT_TRUTH_REQUIRED
reduced_motion_parity_policy   EQUIVALENT_TRUTH_REQUIRED
editorial_annotation_policy    NO_EDITORIAL_ANNOTATION
```

It defines **no** codec, container, bitrate, resolution, frame rate, storage provider, CDN, watermark,
DRM, social template, typography or choreography — all deferred by `CW2-05` section 50, and the
migration refuses to deploy with such a column. `contract_digest` commits the exact composition and the
exact policy tuple through one `IMMUTABLE` function that both the builder and the finalization
revalidation call, so the two can never drift.

Derived captions and transcripts stay distinct from source truth
(`DERIVED_CAPTION_DISTINCT_FROM_SOURCE`), and no editorial narration exists at all
(`NO_EDITORIAL_ANNOTATION`). No mobile Replay UI is added by this slice: `I-06B` creates the truth
contract that later visual execution must obey.

## 26. PREVIEW_READY

> the current draft has been truthfully compiled into ONE complete immutable Replay Version whose
> analytical projection and render contract pass every required internal truth gate.

It does **not** mean distributed, approved for Public, downloadable, encoded as a final video,
launch-cleared, Safety-approved or entitled for export. `prepare_replay_preview_v1`:

```text
1  derives the exact actor from auth.uid()
2  locks the Replay FIRST
3  compares and swaps the expected draft revision
4  requires the lifecycle to be DRAFT
5  locks the current source manifest through the frozen I-06A helper
6  revalidates source currency through the ONE frozen I-06A derivation
7  derives Semantic Cut Safety and refuses any cut that is not proven SAFE
8  derives the temporal discontinuities
9  builds the analytical projection from the canonical historical truth
10 builds the render contract over it
11 creates the complete Replay Version binding all four components
12 advances the current-version pointer, forward only
13 transitions the lifecycle to PREVIEW_READY with append-only evidence
14 records the durable idempotent command answer
```

It widens no audience: no relation that could carry a package, an approver, a World membership or a
public surface is read or written anywhere in it, which the migration checks of its own text.

## 27. FINALIZED, and why it is not distributed

> ONE exact complete Replay Version passed final source, projection and render truth revalidation and
> is frozen as a private finalized version.

`finalize_replay_version_v1` binds the EXACT current previewed version, revalidates the source under
lock through the frozen `I-06A` derivation, re-derives the canonical analytical answer at every
represented coordinate and compares it to what the version froze, and recomputes the render contract
digest from its own bound composition. Anything that moved refuses the finalization:

```text
REPLAY_SOURCE_STALE                   40001
REPLAY_ANALYTICAL_PROJECTION_STALE    40001
REPLAY_RENDER_CONTRACT_STALE          40001
REPLAY_SEMANTIC_CUT_UNSAFE            0A000
REPLAY_VERSION_STALE                  40001
```

It regenerates no missing source and builds no new Replay Version: if truth changed, it fails and a new
draft / version cycle is required.

**FINALIZED is not distributed.** It creates no distribution package, no required approver set, no
publish, share or download action, no export sanitization result, no Public Experience and no external
artifact, and it reserves no future authority for any of them. A finalized Replay may remain private
forever. Evidence is append-only and keyed by the EXACT Replay Version, so `I-06C` can ask "was THIS
exact version finalized?" with one key lookup and never has to infer it from a current lifecycle.

## 28. Revision after finalization

```text
PREVIEW_READY -> DRAFT   through reopen_replay_for_revision_v1
FINALIZED     -> DRAFT   through reopen_replay_for_revision_v1
```

only through that explicit creator-exact command. The old Replay Version stays immutable byte for byte;
a previously finalized version stays historically finalized, because its evidence row is append-only
and keyed by that exact version. A later preview creates a NEW Replay Version revision. No distribution
behaviour exists here for the old or the new version.

The stable Replay's lifecycle moves only along those frozen transitions, enforced by a `BEFORE UPDATE`
trigger for every role including the table owner, so a jump from `DRAFT` straight to `FINALIZED` is
unrepresentable rather than merely refused.

## 29. Lock order, idempotency and concurrency

```text
1  replays                       FOR UPDATE
2  replay_draft_state            FOR UPDATE   (preview)
   replay_current_version_state  FOR UPDATE   (finalize / reopen)
3  the source domain, through replay_lock_source_manifest_v1, SHARE, in each
   domain's own frozen relative order
4  the canonical historical projection: STABLE, read only, no lock, no write
5  the I-06B component writes
```

Replay is always the first lock, so no `I-06B` path can be the second edge of a cycle. No advisory
lock, table lock or process mutex exists anywhere in the slice.

Three narrow typed command relations — `replay_preview_commands`,
`replay_finalization_commands`, `replay_revision_reopen_commands` — carry the idempotency key AND the
exact committed answer. `request_ref` binds the whole request, so an equivalent retry returns the
original committed answer and the same command id carrying a different request is a deterministic
`REPLAY_COMMAND_ID_CONFLICT`. Competing previews and competing finalizations serialize on the Replay
row and the loser is refused as `REPLAY_LIFECYCLE_INVALID` rather than applied to whatever is current.

## 30. Security and ACL posture

Every `I-06B` relation is postgres-owned, RLS-enabled with zero policies and revoked from `PUBLIC`,
`anon`, `authenticated` and `service_role`. Every function is postgres-owned and `search_path`-pinned;
every mutation is `SECURITY DEFINER` with the actor derived from `auth.uid()`. Every consequential
primitive, every derivation core, the canonicalizations and the truth revalidation are executable by
**no** application role, pending a reviewed `CW2-08` wrapper. `service_role` alone may execute
`resolve_replay_current_version_v1`, which answers the exact creator, returns zero rows to everybody
else, and discloses no source identity and no internal divergence cause.

`resolve_replay_current_version_v1` deliberately does **not** report analytical truth currency. The
frozen `I-06A` source currency can be a property of the Replay and its creator because its inputs are
owner-scoped columns; the analytical one cannot, because the canonical historical projection is
owner-scoped on `auth.uid()` itself. The truth revalidation therefore happens where the exact human is
present and holds the locks: inside finalization.

Nothing in this slice claims `SAFETY_ALLOW`, `MODERATION_ALLOW`, `ENTITLED`, `FEATURE_ENABLED`,
`LAUNCH_CLEARED` or `PUBLIC_LAUNCH_READY`. The frozen `CW2-08` prerequisite seam still answers
`NOT_EVALUATED`, and `I-06B` asserts that it does.

## 31. What I-06B did not do, and who owns it

| Deferred | Owner |
| --- | --- |
| `REPLAY_DISTRIBUTION_PACKAGE_VERSION`, distribution approver derivation, distribution-time revalidation | `I-06C` |
| `PUBLISH_TO_PUBLIC_WORLD`, `SHARE_EXTERNALLY`, `DOWNLOAD`, `EXPORT_PRIVACY_SANITIZATION` | `I-06C` |
| entitlement and launch integration at distribution | `I-06C` / `CW2-08` |
| source loss AFTER finalization, later source availability changes, withdrawal rules | `I-06D` |
| `I-06` closure reconciliation | `I-06D` |
| codec, container, bitrate, resolution, media storage, CDN, export resolution | deferred by `CW2-05` |
| final visual and motion craft, typography, social templates, watermark, DRM | deferred by `CW2-05` |
| a Shared or Public historical analytical substrate | not opened — see section 20 |
| an NLP semantic boundary / attribution authority for partial cuts | not opened — see section 22 |
| an authorized original-media delivery path | not opened — see section 24 |
| mobile Replay UI, routes, controllers and RPC surfaces | outside `I-06` |

Static contracts protect what this slice owns without becoming ceilings on that roadmap: a mirrored
probe proves that every one of those authorized future additions leaves both `I-06B` contracts passing,
while each deliberate weakening of an `I-06B` truth, authority or privacy invariant breaks at least one
of them. Independent review covers the completeness of the Replay Version composition, the analytical
projection capability matrix and the census behind it, the no-hindsight and sealed-coordinate rules,
the canonicalization and its two exclusions, Semantic Cut Safety conservatism, discontinuity truth,
render contract scope, `PREVIEW_READY` and `FINALIZED` audience neutrality, finalization revalidation,
revision-after-finalization semantics, lock order, idempotency and concurrency, ACL and RLS, forward
safety, and exact-head CI evidence.

---

# I-06C

## 32. REPLAY_DISTRIBUTION_PACKAGE_VERSION

`I-06B` ended at a private finalized Replay Version. `I-06C` owns the boundary at which one exact
finalized version may reach an audience, and nothing about that boundary is a World: distribution
changes **audience**, never ontology.

```text
replay_distribution_package_versions
  id
  replay_id                          the exact Replay
  replay_version_id                  the exact historically FINALIZED Replay Version
  source_manifest_version_id         that version's own manifest
  source_class                       read FROM the manifest, CHECK-pinned MY_WORLD
  destination_action                 PUBLISH_TO_PUBLIC_WORLD | SHARE_EXTERNALLY | DOWNLOAD
  package_revision
  authority_requirement_state        the union
  source_authority_resolution        half one
  analytical_authority_resolution    half two
  required_approver_count
  authority_request_fingerprint
  sanitization_contract_id
  audience_safe_reference            the ONLY identity an audience ever receives
  created_at
```

It is **not** a Replay Version, a render version, a mutable export job, a Public Experience, a file,
a URL, a storage object, a download receipt or a World. It holds no source body, path, transcript,
audio handle or sealed provenance: the payload stays exactly where `I-06A` bound it, and a package
carrying a shadow copy could outlive the deletion it is supposed to respect. It is append-only for
every role **including the table owner**, so the destination, the version and the authority identity
can never be re-pointed.

## 33. Historical finalization is bound, never inferred

`I-06B` allows a `FINALIZED` Replay to be reopened to `DRAFT` while the exact version it left behind
stays historically finalized. So a package never reads `replays.current_lifecycle`. It binds

```text
(replay_version_id, replay_id) -> replay_version_finalizations
```

through an additive candidate key, so *this exact version of this exact Replay was historically
finalized* is ONE row and an unfinalized version is **unrepresentable** rather than merely refused. A
previously finalized version therefore remains a distribution candidate while the stable Replay is
being revised — subject to every distribution-time gate below.

## 34. Destination is part of package identity

Authority for one destination never implies another. `(id, destination_action)` is a candidate key,
so an approval binds the package **and** its destination as ONE row; an approval collected for
`PUBLISH_TO_PUBLIC_WORLD` can never resolve against a `SHARE_EXTERNALLY` package, and vice versa.
Changing the destination, the Replay Version, the required set or the sanitized surface means a NEW
package version — there is no other representable outcome, because the row is immutable.

## 35. The analytical-layer authority, and why production is fail-closed

`CW2-02` derives a redistributable QANDEEL analysis's `AUTHORITY_REQUIREMENT_SET` from the protected
human material **and the SUBJECTS actually implicated**. Migration `0090` records the canonical
repository finding for the first time: the material half is computable and the subject half is not,
because no reviewed server-owned producer of a protected-human subject authority exists — the whole
`I-03` chain terminates at `NOT_GRANTED` / `SEALED` and produces no protected-subject authority set
at all. So `0090` records reasoning-bearing QANDEEL material as
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT`, and `0093` refuses Personal QANDEEL analysis for
publication on exactly the same ground.

An `I-06B` `ANALYTICAL_PROJECTION_VERSION` is reasoning of that kind. Its digest commits Readings,
reading relations, evidence participations, Materials, Gaps, Questions, question appearances,
Confidences, Threads and focuses — QANDEEL's understanding, not the creator's own words. That every
family of `K(TC)` is owner-scoped to the creator proves no **other human's row** can enter it; it does
not prove that no other human is a **subject** of it, and the repository's own canonical position is
that the second question is not answerable here.

```text
resolve_replay_analytical_distribution_authority_v1(projection)
  -> UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT, no approvers, with a stated basis
```

Package preparation therefore **fails closed** on it today, and migration `0104` makes the weaker
outcome unrepresentable: `analytical_authority_resolution` admits only the two RESOLVED states.
Unresolved is never reinterpreted as zero approvers, as creator-only, as "already finalized so it is
fine" or as "Safety will catch it". A later reviewed subject-authority resolver replaces the seam body
forward and the same package shape becomes reachable with no change to `0104` and none to the
primitives.

## 36. REQUIRED_REPLAY_DISTRIBUTION_APPROVER_SET

```text
required approvers = union(
    human material authority of the SELECTED source segments,
    human authority requirement of the represented analytical projection)
```

derived by `derive_replay_distribution_required_approvers_v1` and by nothing else. It reads **no**
membership relation of any kind, accepts no approver parameter, and fails closed on unresolved or
contradictory authority rather than answering an empty set.

| half | at this baseline |
| --- | --- |
| `MY_WORLD` human-authored segments | the creator, exactly and only — the manifest binds the Session owner to the Replay creator structurally |
| `MY_WORLD` QANDEEL-authored segments | `REPLAY_DISTRIBUTION_SOURCE_AUTHORITY_UNRESOLVED`, mirroring the frozen `0093` refusal |
| the analytical projection | `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` — section 35 |
| `SHARED_WORLD` / `PUBLIC_EXPERIENCE` | **unrepresentable**: a complete Replay Version needs an analytical projection, which is `CHECK`-pinned to a `MY_WORLD` manifest, so no Shared or Public Replay can reach `FINALIZED` and no package over one can exist |

The last line is a census result rather than an omission. Writing a Shared approver derivation for a
subject that cannot exist would be unreachable code claiming to protect something; when a later
reviewed slice gives those classes an analytical capability it adds the branch with its own proofs and
consumes `shared_world_history_item_required_approvers` and
`shared_world_material_historical_authority` exactly as `I-05A` does.

## 37. Approval, withdrawal and effective state

An approval binds the DERIVED required set by composite foreign key, so an approval by a human the
package does not require is structurally impossible however the row is produced. The approver is
`auth.uid()`; there is no approver parameter anywhere. Withdrawal is append-only — the historical
approval row is never mutated — and a human may withdraw only their own.

```text
EFFECTIVE    neither withdrawn nor superseded
WITHDRAWN    an append-only withdrawal event exists; a human act dominates every structural fact
SUPERSEDED   the approval binds an authority identity its own immutable package no longer carries
MISSING      a required human with no approval row at all
STALE        the CURRENT derivation no longer reproduces what the package recorded — a NEW package
```

The distribution commit never counts approval rows. It reads effective states, and `MISSING`,
`WITHDRAWN` and `SUPERSEDED` each refuse.

## 38. The authority request fingerprint

One canonical derivation, shared by preparation, approval, the effective-state evaluation and the
distribution commit, binding the protected action, the exact Replay and Replay Version, the exact
package, the four truth components and their committed digests, the sanitization contract, the
sanitized descriptor digest, both halves of the authority resolution, the exact derived approver set
and — for Public — the exact linked Public manifest. It is derived, never supplied, and it is not a
bearer token: it authorizes nothing by itself.

It binds the linked Public manifest **identity** rather than the Public fingerprint, deliberately: the
canonical Public fingerprint already binds this exact Replay distribution package and Replay Version
through its source scope and this exact required approver set, so including it here would be a cycle
rather than a stronger binding. The pair is bound both ways instead, and the commit requires both
sides to hold.

## 39. Source revalidation at distribution time

Preparation, approval and the distribution commit each stabilize the source through the frozen
`replay_lock_source_manifest_v1` and revalidate it through the frozen
`derive_replay_source_manifest_currency_v1`. No competing source-currency evaluator exists. A source
that was deleted, changed, became invisible to the creator, lost controller authority or stopped being
the eligible version refuses with `REPLAY_SOURCE_STALE`, and nothing is reconstructed from a digest:
there is no shadow copy to rescue a stale distribution. Broader post-finalization and
post-distribution source-loss consequences remain `I-06D`.

## 40. EXPORT_PRIVACY_SANITIZATION

A positive allowlist as normalized typed columns, never a blacklist over a JSON blob and never free
text a client authored. `replay_distribution_export_descriptors` is the WHOLE audience-visible surface
and carries exactly three kinds of column: the opaque audience reference, safe derived counts, and the
exact versioned render-truth policies `0102` already pinned.

There is no private World, Session, account, participant, source, unit, material, history item,
package item, provenance, path, URL, filename, storage handle, audio reference or transcript column,
and migration `0104` refuses to deploy if one appears — by column-name pattern **and** by column type,
so a `jsonb` escape hatch is refused too. `descriptor_digest` is a one-way digest of the sanitized
surface itself and of no source; the authority fingerprint binds it, so a package cannot be approved
against one audience-visible surface and exported with a materially different one.

## 41. The audience-safe reference

```text
audience_safe_reference text  ~ '^rdx1_[0-9a-f]{32}$'
```

Opaque `text` in its own shape, structurally distinct from every internal `uuid` identity, minted at
random by the writer and derived from nothing. A `BEFORE INSERT` guard refuses a reference that
reproduces the row's own Replay id, Replay Version id, manifest id or package id, so an internal
identifier wearing an opaque costume is unrepresentable. The mapping stays inside a sealed relation,
and the reference grants no source access and no provenance traversal.

## 42. The Public REPLAY_ARTIFACT bridge

`I-05A` reserved `source_class = 'REPLAY_ARTIFACT'` on the sealed publication provenance and
`public_body_form = 'RESERVED'` on the public package item because no Replay runtime existed. `I-06C`
activates that seam **narrowly**:

```text
exact Public package item + its RESERVED body form
  <-> its sealed provenance row, classed exactly REPLAY_ARTIFACT
  <-> the exact Public Experience its manifest belongs to
  <-> the exact Replay Distribution Package Version, its destination,
      its Replay Version and its audience-safe reference
```

each through ONE composite foreign key onto a candidate key. There is no generic `artifact_id`, no
source URL, no private source pointer and no sealed-provenance traversal. The Public package item
carries the sanitized descriptor digest as its `public_body_digest` and has **no public body row at
all** — a Replay artifact is not public text, so the canonical text-serving resolver has nothing to
serve for it and the artifact resolver of section 44 serves the sanitized descriptor instead.

**No second Public World and no second Public visibility truth.** The bounded Public package is
written into the canonical `I-05A` relations, the canonical `commit_public_experience_ready_for_review_v1`
performs the READY transition, and the canonical `publish_public_experience_v1` performs the
publication and owns the publication record. The `I-06C` authorization record **binds** that canonical
record rather than restating it.

### The canonical Public authority derivation, extended additively

`derive_public_publication_authority_v1` stays the ONE derivation of publication authority, with the
identical signature, the identical result columns and every rule it had. It is extended through the
repository's canonical forward method — a `CREATE OR REPLACE` in a later migration, exactly as `0098`
extended the canonical visibility derivation — because the reserved class had no branch:

```text
an unbridged REPLAY_ARTIFACT item   PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED
a bridged one                       contributes the EXACT required approver set of its
                                    Replay distribution package, and its exact package and
                                    Replay Version identity to the source scope
```

Without that branch a Replay-only Public package would read as requiring **zero** humans, which is
precisely the reinterpretation of an unresolved requirement as an empty one that the frozen rule
forbids — and it would become reachable for real the day a `CW2-08` runtime lands.

## 43. One human consent act, two immutable evidence stores

A Public Replay needs both the Replay distribution approval and the canonical Public manifest
approval, because both subsystems own immutable authority evidence and neither may be bypassed.
Asking the same human twice for the same immutable payload would be duplicate consent, so
`approve_replay_distribution_v1` is ONE act that writes both rows in ONE transaction, for the same
`auth.uid()`, over a Public package bound 1:1 to the Replay package — the Public row through the
canonical relation, with the canonical composite key into the canonical rightsholder set, bound to the
canonical Public authority fingerprint. A withdrawal takes back both halves the same way, through the
frozen `withdraw_publication_approval_v1`.

Because that one act names TWO identities, the committed evidence records BOTH. The exact linked
Public approval and its exact manifest version are columns of the Replay approval row, so the
idempotency key is the whole immutable request rather than the package and the human:

```text
Public destination      linked Public approval NOT NULL, its exact manifest version NOT NULL
every other destination both NULL
equivalent retry        ALREADY_APPROVED with the ORIGINAL linked identity, fingerprint and instant
same id, moved/dropped/added Public identity   REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT, writes nothing
```

The link is structural on three axes: a `CHECK` makes the other two combinations of destination and
link unrepresentable; one composite foreign key onto the frozen `0094` exact-identity key proves the
canonical Public row is the SAME human's; a second onto the bridge's own `(package, manifest)`
candidate key proves it belongs to THIS package's Public package and can never float to another; and
a `UNIQUE (linked_public_approval_id)` means one canonical Public approval belongs to at most one
Replay consent act. Because the Replay row now names the Public row under a foreign key, the Public
half is written FIRST inside the act, and the withdrawal takes back exactly the approval this act
created instead of searching the manifest for one belonging to the same human.

## 44. Public serving, and what a viewer does not get

`resolve_public_replay_artifact_v1(audience_safe_reference, viewer)` composes the ONE canonical
`resolve_public_visibility_state_v1` with the canonical `resolve_public_audience_admission_v1` and
returns the sanitized descriptor. An Experience that was never published, one whose pointer moved, one
that `I-05C` made `ABSENT_FROM_PUBLIC_WORLD`, one whose consent was withdrawn, an unknown reference
and a viewer the policy does not admit all receive the SAME answer: **zero rows**. Replay distribution
state resurrects nothing, and there is no second public visibility truth.

A Public viewer receives the distributable descriptor and **no capability**. They gain no source
return, no provenance traversal and no Replay creation authority: `I-06A` already requires exact
`EXPERIENCE_CONTROL_AUTHORITY` for a Public-source Replay, and this slice does not weaken it.

## 45. SHARE_EXTERNALLY, DOWNLOAD, and authorization versus delivery

This repository has no encoder, container, bitrate, object store, CDN, public file URL, messaging
transport, watermark or DRM, and this slice invents none.

```text
SHARE_EXTERNALLY          AUTHORIZED_FOR_DELIVERY
DOWNLOAD                  AUTHORIZED_FOR_DELIVERY
PUBLISH_TO_PUBLIC_WORLD   PUBLIC_PUBLICATION_COMMITTED, binding the canonical Public record
```

Nothing claims `DELIVERED`, `SHARED` or `DOWNLOADED`, no column records a delivery no transport
performed, and the migration refuses to deploy with a storage handle, URL, filename, object key,
codec or watermark column anywhere. Replay ownership and Replay export entitlement stay distinct: an
absent or expired entitlement deletes no ownership and no finalization, it refuses the scoped
destination.

## 46. CW2-08 composition, and the fail-closed prerequisite

```text
PRIVACY / OWNERSHIP AUTHORITY
AND WORLD / LIFECYCLE STATE
AND SAFETY / MODERATION POLICY
AND COMMERCIAL ENTITLEMENT
AND FEATURE / LAUNCH GATE
```

No layer manufactures another. `resolve_replay_distribution_prerequisites_v1` answers each dimension
separately and every one of them `NOT_EVALUATED` at this baseline, because no executable canonical
runtime exists — so a protected distribution **fails closed** on it, after every privacy and ownership
gate rather than instead of one. `replay_distribution_authorizations` `CHECK`-pins all five dimensions
to their positive values, so an authorization row cannot exist with an unevaluated or negative one,
and the recorded `prerequisite_clearance_basis` is exactly what the seam answered.

Nothing in this slice claims `SAFETY_ALLOW`, `MODERATION_ALLOW`, `ENTITLED`, `FEATURE_ENABLED` or
`LAUNCH_CLEARED` of its own, the frozen `resolve_public_publication_prerequisites_v1` still answers
`NOT_EVALUATED`, and a Public Replay publication must still pass it. There is no Replay-specific
shortcut around `I-05B`.

## 47. Lock order, idempotency and anti-oracle behaviour

```text
1  public.replays                              FOR UPDATE
2  replay_distribution_package_versions         FOR SHARE
3  replay_versions                              FOR SHARE
4  the source domain, through replay_lock_source_manifest_v1, SHARE, in each
   domain's own frozen relative order
5  replay_distribution_approvals                FOR SHARE, ORDER BY approver
6  the destination subsystem, in ITS canonical order:
     public_world_state                         FOR UPDATE
     public_experiences                         FOR UPDATE
7  the I-06C writes
```

Replay is always the first lock, no predecessor Public or Shared writer takes a Replay lock, and no
`I-06C` path inverts source or Public before Replay. No advisory lock, table lock or process mutex
exists anywhere in the slice. Three narrow typed command relations carry the idempotency key AND the
exact committed answer; `request_ref` binds the whole request, so an equivalent retry returns the
original committed answer and the same command id carrying a different request is a deterministic
`REPLAY_DISTRIBUTION_COMMAND_ID_CONFLICT`. An approval IS its own durable record, exactly as the
frozen `I-05A` approval is.

One bounded class, `REPLAY_DISTRIBUTION_NOT_AVAILABLE` (`P0002`), covers a Replay that does not exist,
another human's Replay, a package that is not yours, a human the package does not require and an
Experience the caller does not control — so no surface is an existence, ownership, control or
required-set oracle. The creator's read boundary returns COUNTS of effective, missing, withdrawn and
superseded approvals rather than approver identities: a creator learns whether the package is
distributable without learning a private approver's account metadata.

## 48. What I-06C did not do, and who owns it

| Deferred | Owner |
| --- | --- |
| source loss AFTER finalization or distribution, later availability changes | `I-06D` |
| post-delivery external recall, mandatory Public withdrawal on source loss | `I-06D` |
| `I-06` closure reconciliation and the `QAN-BL-NAV-02` register act | `I-06D` |
| a protected-human subject-authority resolver for QANDEEL analysis | not opened — see section 35 |
| a Shared or Public historical analytical substrate, and their approver branches | not opened — see section 36 |
| Safety, moderation, entitlement, feature flag and Launch Gate runtime | `CW2-08`, unimplemented |
| `DOWNLOAD` monetization policy and Premium rules | `CW2-08`, unimplemented |
| encoder, codec, container, bitrate, resolution, object storage, CDN, public URL | deferred by `CW2-05` |
| email / SMS / social transport, watermark, DRM, social templates | deferred by `CW2-05` |
| mobile Replay export UI, routes, controllers and RPC surfaces | outside `I-06` |

Static contracts protect what this slice owns without becoming ceilings on that roadmap: a mirrored
probe proves that an `I-06D` source-loss record, a distribution recall reconciliation, a reviewed
delivery receipt with a real storage handle, a resolved analytical authority seam, a cleared `CW2-08`
seam, additive columns, an index and a new CI gate all leave both `I-06C` contracts passing, while
each deliberate weakening of an `I-06C` authority, privacy or truth invariant breaks at least one of
them.

---

# I-06D

## 49. Historical truth and current usability are two different facts

This is the whole of `I-06D`, and every section below is a consequence of it.

```text
HISTORICAL_FINALIZATION_FACT      remains true, forever, append-only
CURRENT_SOURCE_ELIGIBILITY        may change, and is derived live

HISTORICAL_DISTRIBUTION_AUTHORIZATION   remains true at its historical instant
CURRENT_DELIVERY_ELIGIBILITY            may change, and is derived live

HISTORICAL_PUBLIC_PUBLICATION     remains true
CURRENT_PUBLIC_SERVING            remains owned by the canonical Public runtime
```

A Replay Version that was historically FINALIZED stays historically finalized even when the source it
once represented can no longer be legitimately dereferenced. No historical row is ever mutated to
encode a current answer, and no current answer is ever read off a historical row.

## 50. Current source availability for an exact Replay Version

`derive_replay_version_current_availability_v1(p_replay_id, p_replay_version_id)` binds ONE exact
Replay and ONE exact Replay Version as one row, reads that version's own captured source manifest from
the immutable composition, and then **delegates the whole source question** to the canonical `I-06A`
`derive_replay_source_manifest_currency_v1`. It is `STABLE` and takes no lock: a caller that needs a
stable answer stabilizes the source first, exactly as the frozen derivations document.

It answers three bounded states — `CURRENT`, `NOT_CURRENT`, `CONTRADICTORY` — and carries the private
`I-06A` staleness class separately and internally. It writes no second source-currency evaluator, reads
no source row of its own, recomputes no digest, and never treats historical finalization as evidence
that a source is still current. A captured digest records what a source WAS; it is never evidence that
it still IS, and the migration refuses to deploy if either function grows a digest comparison.

At this baseline a bound Personal source cannot be hard-deleted while a Replay names it: migration
`0100` binds `replay_source_manifest_items.personal_conversation_unit_id` to `conversation_units` with
`ON DELETE RESTRICT`. `QANDEEL` therefore never needs to reconstruct a deleted Personal source, and
never does: the reachable losses are a source that CHANGED and a source that is no longer the
creator's at its captured Session Position.

## 51. SOURCE_CONTENT_BEARING_LAYER and ANALYTICAL_VISUAL_LAYER

`CW2-05` section 32 classifies Replay elements between two layers, and the consequence of a source
becoming unavailable is different for each. `resolve_replay_version_current_usability_v1(...)` reports
both on every row, including its refusals:

```text
SOURCE_CONTENT_BEARING_LAYER   DEREFERENCEABLE | NOT_DEREFERENCEABLE
ANALYTICAL_VISUAL_LAYER        SEALED_HISTORICAL_EVIDENCE | SEALED_EVIDENCE_INCOMPLETE
```

Read together they say exactly what the architecture says. A source loss makes the source layer
`NOT_DEREFERENCEABLE` — it cannot be regenerated, reconstructed or newly rendered from hidden or
deleted source — while the analytical layer stays `SEALED_HISTORICAL_EVIDENCE`, because analytical
history is not erased merely because a source moved. And the complete Replay is still refused.

There is deliberately **no state meaning "the analytical layer stands in for the missing source"**.
An analytical-only rendering is not the Replay it would be served as, so no vocabulary exists in which
it could be offered as one, and the migration refuses to deploy if one is introduced.

## 52. Current complete-Replay usability

`resolve_replay_version_current_usability_v1(p_replay_id, p_replay_version_id, p_user_id)` answers
`COMPLETE_REPLAY_CURRENTLY_USABLE` or `COMPLETE_REPLAY_NOT_CURRENTLY_USABLE`, fail-closed, in order:
the historical finalization first, then current source availability, then the completeness of the
sealed analytical evidence this exact version binds, and only then usable.

It deliberately does **not** compose the canonical `I-06B`
`derive_replay_version_truth_currency_v1`. That derivation reaches
`get_session_historical_projection_v1`, which is scoped to `auth.uid()` and raises `FORBIDDEN` for
anyone but the Session owner. This boundary names its human as a **parameter** — the frozen
narrow-resolver precedent every Replay read boundary follows, and the shape the service tier calls it
in — so composing the two would make the answer depend on which session asked rather than on which
human was named. That is a gate which is arbitrary rather than fail-closed, and it would report a
perfectly healthy Replay as diverged for every caller but one. Whether the sealed evidence still
re-derives from current canonical state remains `I-06B`'s question, asked by `I-06B`'s own
owner-scoped path; what this boundary establishes is that the evidence is still there and still
complete, which is the fact `CW2-05` §32 asks it for and the fact a source loss must not change.

It is creator-exact. Everyone else receives ZERO ROWS, which is also what a nonexistent Replay, a
nonexistent version and another human's version answer, so the boundary is no existence oracle. The
creator receives the minimum actionable class and never the private cause:

```text
REPLAY_VERSION_NOT_FINALIZED
SOURCE_NOT_CURRENTLY_AVAILABLE
SOURCE_STATE_CONTRADICTORY
ANALYTICAL_EVIDENCE_INCOMPLETE
```

## 53. Source recovery is a live derivation, never a tombstone

If a source becomes temporarily unavailable and the SAME exact canonical row returns unchanged, the
canonical currency derivation answers `CURRENT` again and every answer built on it recovers with it.
That is a property of deriving rather than of storing, and it needs no repair path.

Recovery is not amnesty. A human approval that was withdrawn stays withdrawn, because effective state
is derived from append-only withdrawal evidence. A Public Experience that reached
`ABSENT_FROM_PUBLIC_WORLD` stays absent, because Public lifecycle is owned by the Public runtime. An
immutable package does not mutate. And a source that was deleted and re-created under a NEW canonical
identity is a different source: the currency derivation compares the exact captured identity, version
and revision, so equal text or an equal digest never lets a replacement impersonate the original.

## 54. Historical authorization is not a bearer right

`I-06C` truthfully records `SHARE_EXTERNALLY` and `DOWNLOAD` reaching `AUTHORIZED_FOR_DELIVERY`, and no
delivery, because no transport boundary exists. `I-06D` separates that historical fact from the current
ability to use it. `derive_replay_distribution_current_eligibility_v1(...)` is total and fail-closed,
and re-evaluates in a load-bearing order:

```text
1  a package never authorized has no authorization to use   NOT_AUTHORIZED
2  the historical finalization it binds is still there      PACKAGE_STATE_CONTRADICTORY
3  CURRENT SOURCE AVAILABILITY                              SOURCE_NOT_CURRENT
4  the current authority identity and required set          AUTHORITY_UNRESOLVED / SUPERSEDED
5  every required approval still effective                  APPROVAL_NOT_EFFECTIVE
6  the sanitized export descriptor still re-derives         EXPORT_SURFACE_SUPERSEDED
7  the destination's own current state                      PUBLIC_DESTINATION_NOT_SERVING
8  the CW2-08 prerequisite, LAST                            PREREQUISITE_UNRESOLVED
```

Source is answered BEFORE authority on purpose: the analytical subject-authority seam still answers
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` in production, so an authority-first order would make the
source-loss refusal unreachable outside a test seam — and source loss is this slice's subject. The
`CW2-08` seam is LAST, after every privacy and ownership gate, so a privacy failure is never reported
as a launch failure.

A historical authorization row is never deleted, rewritten or "refreshed". If current authority no
longer matches an old package, the old package stays historical and currently unusable, and a future
valid act needs the canonical new-package path. The answer vocabulary is about FUTURE eligibility and
has no `DELIVERED` state at all.

The creator boundary `resolve_replay_distribution_current_state_v1(...)` reports both facts side by
side and collapses every authority failure — missing, withdrawn, superseded, unresolved — into ONE
class, `AUTHORITY_NO_LONGER_CURRENT`, so a creator learns that the authority moved without learning
which human moved it.

## 55. Approval withdrawal after authorization

A withdrawal has the same precedence it already has at new-distribution time: it blocks future use of
that package's authorization. Nothing is mutated to express it. `APPROVED → REVOKED` is never a row
update and `AUTHORIZED → DELETED` never happens; the approval row stays byte-identical, the withdrawal
is one append-only event, and the effective state is derived. For `PUBLISH_TO_PUBLIC_WORLD` the
`I-06C` one-human-act / two-evidence-store design is consumed unchanged, and no second Replay-only
Public consent lifecycle exists.

## 56. The Public destination rule, in both directions

**Private Replay source loss alone invents no Public transition.** A private source that later becomes
unavailable does not force a `PUBLISHED` Public Replay Experience to `ABSENT_FROM_PUBLIC_WORLD`, for
four reasons: `CW2-05` explicitly declines to invent that rule; the `I-06C` Public `REPLAY_ARTIFACT` is
a bounded sanitized derivative rather than a live private-source pointer; Public serving is owned by
the canonical Public visibility resolver; and a private-source check inside that resolver would be
both a cross-domain policy no contract froze and a private-source oracle addressable by any admitted
viewer. `resolve_public_visibility_state_v1` is therefore not extended in any way — it is consumed —
and the migration refuses to deploy if it ever grows a Replay-source check.

**Everything the Public runtime already fails closed on still fails closed, immediately.** Canonical
approval withdrawal, owner or controller disappearance, `ABSENT_FROM_PUBLIC_WORLD` and every other
`I-05C` continuing-eligibility failure make the Public Replay artifact serve zero rows the moment they
happen, and make this package's current delivery eligibility false. No Replay state of any kind — no
reconciliation, no recovered source, no fresh authorization — can resurrect a Public Experience after
any of them, and a Public viewer never receives a private source-loss cause.

## 57. Reconciliation documents; it never decides

`reconcile_replay_post_finalization_state_v1(p_command_id, p_replay_id, p_replay_version_id,
p_distribution_package_version_id)` appends bounded convergence evidence and nothing else. Privacy and
current eligibility never wait for it: the live derivation is the answer the moment it is asked, and a
reconciliation row can only document a result it did not create. No derivation in `0106` or `0107`
reads one, and the migration refuses to deploy if one starts to.

It is creator-scoped through `auth.uid()`, because the canonical source lock is creator-scoped by
construction and reconciling under any other principal would mean inventing a second source-lock path
or skipping the lock. The lock order is Replay-first, with no inversion anywhere:

```text
1  public.replays                                  FOR UPDATE
2  replay_distribution_package_versions             FOR SHARE, exact target
   replay_versions                                  FOR SHARE
3  replay_lock_source_manifest_v1(...)              each source domain's own frozen order
4  replay_distribution_approvals                    FOR SHARE, ORDER BY approver
5  public_world_state, public_experiences           FOR SHARE, and only for a Public destination
6  the append-only I-06D writes
```

Public rows are taken `FOR SHARE` because reconciliation READS Public truth and never writes it, and
they are not taken at all for a package that has no Public destination. The primitive mutates no
immutable truth component, synthesizes no missing source, widens no audience, marks no external copy
recalled, and performs no Public lifecycle transition.

Its command identity binds the WHOLE immutable request — actor, exact Replay, exact Replay Version, the
exact package or its explicit absence, and the purpose. Both idempotency passes, before the Replay lock
and again under it, compare that digest and answer from the COMMITTED row; the same command id
carrying any materially different request is `REPLAY_POST_FINALIZATION_COMMAND_ID_CONFLICT` and writes
nothing. The command id IS the evidence id in both relations, so one command can never produce two
observations of the same kind.

## 58. No external recall, and no media, storage or transport

`CW2-05` is explicit that Replay cannot guarantee recall of already-exported external copies, and this
repository has no external transport or delivery record at all. The truthful statement this runtime
makes is exactly one sentence: **future QANDEEL-controlled distribution is refused; copies that already
left cannot be guaranteed recalled.** No relation may record `EXTERNAL_COPY_RECALLED`,
`REMOTE_FILE_DELETED`, `RECIPIENT_COPY_DESTROYED`, `DOWNLOAD_REVOKED_ON_DEVICE` or
`SOCIAL_POST_REMOVED`, and none may carry an encoder, codec, container, bitrate, object storage key,
CDN reference, signed URL, watermark or DRM field. Those bans are scoped to the relations `I-06D` owns,
so a later reviewed media or transport boundary remains possible everywhere else.

## 59. Anti-oracle behaviour and ACL posture

Every new relation is `postgres`-owned, RLS-enabled, carries zero policies, holds no privilege for
`PUBLIC`, `anon`, `authenticated` or `service_role`, and is append-only for every role including its
owner. The internal derivations and the reconciliation primitive are executable by NO application
role while the `CW2-08` Launch Gate is unimplemented; the two creator read boundaries are
`service_role`-only, the frozen narrow-resolver precedent. Every human principal comes from
`auth.uid()` and no availability, currency, authority, eligibility, Safety, entitlement or launch
verdict is ever a caller parameter.

An unauthorized caller cannot distinguish an absent Replay from another human's, an absent version
from one it may not see, or an absent package from a private one: all of them are zero rows or one
bounded class. The private staleness cause, the private approval identity, the hidden World, the
hidden participant and the internal component that went stale never cross any boundary.

## 60. What I-06D did not do, and who owns it

| Deferred | Owner |
| --- | --- |
| a protected-human subject-authority resolver for QANDEEL analysis | not opened — see section 35 |
| a Shared or Public historical analytical substrate, and their finalized source-loss branches | not opened — see section 36 |
| Safety, moderation, entitlement, feature flag and Launch Gate runtime | `CW2-08`, unimplemented |
| encoder, codec, container, bitrate, resolution, object storage, CDN, public URL, signed URL | deferred by `CW2-05` |
| email / SMS / social transport, watermark, DRM, social templates, mobile share sheet | deferred by `CW2-05` |
| an external provider contract, a delivery receipt, and any recall capability | deferred by `CW2-05` |
| mandatory Public withdrawal after later source deletion | deferred by `CW2-05` — see section 56 |
| the mobile Replay Product surface, routes, controllers and RPC | outside `I-06` |

Static contracts protect what this slice owns without becoming ceilings on that roadmap: a mirrored
probe proves that a reviewed delivery receipt with a real storage handle and signed URL, an
external-copy record with a recall column, a resolved analytical authority seam, a cleared `CW2-08`
seam, additive columns, an index and a new CI gate all leave both `I-06D` contracts passing, while each
deliberate weakening of an `I-06D` source, authority, privacy, Public or immutability invariant breaks
at least one of them.

## 61. Backlog and governance disposition at parent closure

`BG-08` requires every backlog item a closing phase inherited to receive one explicit disposition
before closure, and to be one of exactly three things. `I-06` inherited one:
`QAN-BL-NAV-02 — Analysis Replay`. Its applied disposition, reconciled in
[`docs/qandeel-canonical-backlog-v1.md`](qandeel-canonical-backlog-v1.md) by this closure, is:

```text
QAN-BL-NAV-02 — Analysis Replay
  disposition: OPEN — UNASSIGNED, with updated current truth
  owner task:  UNASSIGNED, unchanged

  why not CLOSED — TOMBSTONE
    the finding is "there is no Replay of how an analysis developed". I-06 closes the
    backend Replay RUNTIME truthfully and fail-closed; it opens no Product surface
    through which a human can watch an analysis develop. Tombstoning the item would
    record a capability the repository does not have.

  why not DEFERRED — OWNED
    no named successor task exists, and BG-08 does not permit inventing one to make a
    closure read cleanly.

  what the updated truth now records
    the Replay backend runtime exists and is CLOSED / FROZEN through migrations
    0100-0107; the final mobile / Product Analysis Replay surface is still not
    implemented and is outside I-06; media, storage and transport remain deferred by
    CW2-05; and production Replay distribution remains NOT CLEARED / FAIL-CLOSED while
    the protected-human analytical subject authority and the CW2-08 prerequisites are
    unresolved.
```

**Admitted: none.** No current blocker is laundered into the register by this closure. Every gate
`I-06D` found unresolved is unresolved *in the runtime itself*, fail-closed there, and documented in
sections 54, 56 and 62 — `BG-01` forbids moving an active-contract requirement into the backlog rather
than fixing it, and each of these boundaries is owned by its own frozen `CW2-0N` contract rather than
by an unassigned entry. `BG-07` applies throughout: nothing in the backlog is Product authority, and no
runtime semantics were taken from it.

## 62. Closing the runtime is not clearing the launch

When `I-06` closes, two different statements are true at once, and this document keeps them apart:

```text
I-06 Replay Runtime implementation        CLOSED / FROZEN
production Replay distribution launch     NOT CLEARED / FAIL-CLOSED
```

Production distribution **fails closed** today, and will keep failing closed until each of these is
resolved by its own reviewed work:

```text
protected-human analytical subject authority   resolve_replay_analytical_distribution_authority_v1
                                               answers UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT
canonical executable Safety / moderation       resolve_replay_distribution_prerequisites_v1
commercial entitlement runtime                 answers NOT_EVALUATED on every dimension
feature and Launch Gate runtime
actual media encoder, storage and transport    deferred by CW2-05
the mobile Replay Product surface              outside I-06
```

Closing the runtime means the architecture-defined runtime boundary is implemented truthfully. It does
not mean users can export or share production video today, and nothing in this document should be read
as saying they can.

## 63. Closure record

This section is the `BG-09` half of the closure: the change that closes `I-06` performs it, and the
record says what it closed on rather than leaving a later task to reconstruct it.

```text
closing slice                 I-06D — Post-Finalization Source Availability, Distribution
                              Reconciliation and Replay Runtime Closure v1
pull request                  #254 closed I-06C; #255 carries I-06D
reviewed implementation SHA   09e8f7d9763e29aea6c021cd510d48c3b414bdc8
migrations at closure         0100-0107, with 0001-0099 untouched throughout
```

**What the reviewed SHA was reviewed against.** Independent review of `I-06D` was performed on
`09e8f7d9763e29aea6c021cd510d48c3b414bdc8` and returned a PASS with no Product blocker. At that head
the two `I-06D` real-PostgreSQL verifiers had run green in **two consecutive focused rounds on that one
exact commit** — `0106` 23/23 and `0107` 35/35 each round, every run reporting
`ACCEPTANCE-ELIGIBLE: the target is an exact commit SHA` — and full API CI was green end to end with
every Replay group reported: `I-06A 0100 = PASS 0101 = PASS`, `I-06B 0102 = PASS 0103 = PASS`,
`I-06C 0104 = PASS 0105 = PASS`, `I-06D 0106 = PASS 0107 = PASS`, alongside `I-05` Public
non-regression, forward safety, toolchain, build and closure-governance. Mobile CI was green;
`I-06D` adds no mobile surface.

**What this closure-sync change contains.** Documentation and governance only. It changes no
migration, no runtime SQL, no verifier semantics, no static contract and no application code — the
`0106` and `0107` migrations reviewed at the SHA above are byte-identical to the ones this record
closes over, and `0001`-`0105` were never touched by `I-06D` at all. **Final merge still requires
review and CI on the exact closure-sync head**, which is a different commit from the reviewed
implementation SHA; the merge commit does not exist yet and is deliberately not named here, because a
record cannot contain its own future hash.

**Banner transitions, recorded rather than erased (`BG-09`).** Two stale banners existed on the path
to this closure and both are kept visible:

```text
I-06C   CANDIDATE — awaiting independent ChatGPT review   ->   CLOSED / MERGED
        a residue that survived the merge of #254; normalized by I-06D as the
        parent-closing slice, as governance reconciliation only, and recorded in
        the header block above rather than deleted

I-06D   CANDIDATE — awaiting independent ChatGPT review   ->   CLOSED / FROZEN
        performed by this change, which is the change that closes the slice, so no
        successor task is left responsible for it
```

**`BG-08`.** The one inherited register item, `QAN-BL-NAV-02 — Analysis Replay`, is reconciled in
section 61 and in the canonical backlog's `I-06` closure record. It is **not** tombstoned: `I-06` closes
the Replay backend runtime and opens no Product surface through which a human can watch an analysis
develop. No new item is admitted, and no unresolved gate is moved into the register instead of being
left fail-closed where it actually is.

**What a reader should not conclude from this section.** That the runtime is closed says nothing about
whether anything may be distributed. Section 62 is the binding statement: production Replay
distribution is `NOT CLEARED / FAIL-CLOSED`, and every prerequisite it names is still unresolved.