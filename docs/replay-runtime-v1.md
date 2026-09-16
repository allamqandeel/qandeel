# QANDEEL — Replay Runtime v1

**Phase:** `I-06 — Replay Runtime` — **ACTIVE**
**Slice:** `I-06A — Replay Foundation, Authorized Source Capture and Draft Construction v1` —
**CANDIDATE — awaiting independent ChatGPT review**
**Architecture authority:** `CW2-05 — Replay Runtime Architecture v1.0 — CLOSED / FROZEN`, with
binding `CW2-01`–`CW2-04` and `CW2-08`
**Migrations:** `0100_replay_foundation_source_manifest_selection_v1.sql`,
`0101_replay_authorized_draft_runtime_v1.sql`

`I-06` is **not** closed or frozen. This document records what `I-06A` implemented, what it
deliberately did not, and where each deferred capability is owned.

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
revision, the original medium, the canonical temporal anchor and a one-way digest of the exact source
bytes. It identifies **nothing by content**. There is no body, text, transcript, audio reference,
payload or JSON column anywhere in the slice, no foreign key to any body relation that owner deletion
destroys, and no reference at all to the sealed Public provenance. A later owner deletion therefore
makes a draft stale instead of being defeated by a private shadow copy. Preserving provenance
identity after deletion is allowed; reconstructing deleted content is not.

The three classes are kept apart **by structure**, not by convention: one exact-shape `CHECK` per
relation, class-specific restrictive foreign keys, and composite foreign keys binding every item to
its own manifest's exact source context. A Personal item cannot carry a Shared identifier, and an item
cannot name a World, Session or package its manifest does not.

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
I-06A — CANDIDATE — awaiting independent ChatGPT review
```

`I-06A` is not closed and not frozen, and Claude may not declare it so. Independent review covers
architecture, `Replay != World`, creation versus distribution separation, source access authority,
source deletion non-bypass, anti-oracle privacy, Personal temporal non-regression, Shared history
authority, the Public Experience owner boundary, selection truth, the absence of an incomplete Replay
Version, lock order and concurrency, idempotency, ACL and RLS, forward safety, and exact-head CI
evidence.
