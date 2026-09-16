# QANDEEL — Replay Runtime v1

**Phase:** `I-06 — Replay Runtime` — **ACTIVE**
**Slice:** `I-06A — Replay Foundation, Authorized Source Capture and Draft Construction v1` —
**CLOSED / MERGED**
**Slice:** `I-06B — Replay Analytical Projection, Render Truth Contract and Preview / Finalization v1` —
**CANDIDATE — awaiting independent ChatGPT review**
**Architecture authority:** `CW2-05 — Replay Runtime Architecture v1.0 — CLOSED / FROZEN`, with
binding `CW2-01`–`CW2-04` and `CW2-08`
**Migrations:** `0100_replay_foundation_source_manifest_selection_v1.sql`,
`0101_replay_authorized_draft_runtime_v1.sql`,
`0102_replay_analytical_projection_render_contract_versioning_v1.sql`,
`0103_replay_preview_finalization_runtime_v1.sql`

`I-06` is **not** closed or frozen. This document records what `I-06A` and `I-06B` implemented, what
they deliberately did not, and where each deferred capability is owned. Sections 1–16 describe the
`I-06A` substrate, which `I-06B` consumes unchanged; sections 18–31 describe `I-06B`.

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
I-06  — ACTIVE
I-06A — CLOSED / MERGED
I-06B — CANDIDATE — awaiting independent ChatGPT review
```

`I-06` is not closed and not frozen, and Claude may not declare it so.

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
