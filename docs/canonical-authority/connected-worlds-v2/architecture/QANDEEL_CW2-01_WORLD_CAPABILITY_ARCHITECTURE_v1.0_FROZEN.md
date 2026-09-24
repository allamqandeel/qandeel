# QANDEEL — Connected Worlds v2
## CW2-01 — World & Capability Architecture v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Connected Worlds v2 structural architecture  
**Supersedes:** CW2-01 v0.1 and v0.2 drafts  
**Depends on:** `CW2-00 — Canonical Product Baseline`

---

# 1. Structural constitution

Connected Worlds v2 separates five architectural classes:

```text
WORLD
CAPABILITY
MATERIAL / ARTIFACT
USER STATE
RELATIONSHIP / INTRODUCTION STATE
```

No class silently inherits the authority, lifecycle or audience semantics of another.

Core principle:

> **Knowledge possession is not audience permission.**

---

# 2. World taxonomy

Exactly three World types exist:

```text
WORLD
├── MY_WORLD
├── SHARED_WORLD
└── PUBLIC_WORLD
```

The following are explicitly not Worlds:

```text
REPLAY
MATCHING / INTRODUCTIONS
PUBLIC_EXPERIENCE
INVITATION
PUBLIC_DISCUSSION
```

---

# 3. Canonical World definition

A World is a persistent semantic context with:

- stable identity;
- audience / participation topology;
- continuing state;
- temporal truth / history;
- semantic evolution;
- rules governing what QANDEEL may use and disclose inside it;
- lifecycle independent from a single Session, artifact or action.

---

# 4. MY_WORLD

`MY_WORLD` remains the frozen Living Analysis Map.

Connected Worlds may attach capabilities to it but may not weaken or reinterpret:

- owner-only human audience semantics;
- stable semantic geography;
- semantic zoom truth;
- temporal truth;
- no-hindsight;
- provenance;
- truthful motion;
- frozen navigation behavior.

A Personal World never becomes multi-owner state.

---

# 5. SHARED_WORLD identity

A Shared World:

- receives a stable `world_id` only when the required creation acceptance succeeds;
- does not exist as a dormant World while an invitation is pending;
- has identity independent from its current participant set;
- is collectively governed under Shared World rules;
- gives no initiator an owner/admin privilege merely for initiating creation.

A participant set is not the database identity of a Shared World.

---

# 6. PUBLIC_WORLD identity

`PUBLIC_WORLD` is one logical singleton semantic World.

Its primary public content unit is:

`PUBLIC_EXPERIENCE`

A Public Experience is a bounded public object inside the Public World, not a World of its own.

---

# 7. QANDEEL system-actor rule

Across all Worlds:

```text
QANDEEL != human member
QANDEEL != owner
QANDEEL != consent provider
```

QANDEEL may reason, analyze, propose, mediate, request permission and execute authorized capabilities.

QANDEEL cannot substitute for required human authority.

---

# 8. Shared World lifecycle

Canonical architecture-level lifecycle:

```text
ACTIVE
READ_ONLY_CLOSED
```

Final user-facing labels remain a later Product/UI concern.

Normal path:

```text
Invitation capability state
    ↓ accepted
SHARED_WORLD created
    ↓
ACTIVE / STANDARD
    ↓ valid END_WORLD authority
READ_ONLY_CLOSED / STANDARD
```

Matching-created path:

```text
Matching proposal flow
    ↓ Mutual Match
SHARED_WORLD created
    ↓
ACTIVE / INTRODUCTION
    ├── both approve transition
    │      ↓
    │  ACTIVE / STANDARD
    │
    └── either ends Introduction
           ↓
       READ_ONLY_CLOSED / INTRODUCTION
```

---

# 9. Matching proposal flow vs Introduction lifecycle

The architecture distinguishes:

`MATCHING_PROPOSAL_FLOW`

from:

`INTRODUCTION_LIFECYCLE`

At Mutual Match:

```text
MATCHING_PROPOSAL_FLOW → TERMINAL_SUCCESS
INTRODUCTION_LIFECYCLE → ACTIVE
SHARED_WORLD / INTRODUCTION → CREATED
```

The Introduction lifecycle continues until:

```text
COMPLETED
```

or:

```text
CLOSED
```

QANDEEL therefore remains able to guide the early relationship after the Match without keeping candidate-selection flow alive.

---

# 10. Introduction-phase member freeze

For v1:

```text
SharedWorld.phase = INTRODUCTION
human_member_count = exactly 2
```

During this phase:

`ADD_MEMBER = unavailable`

After successful transition to `STANDARD`, ordinary Shared World governance may permit later membership change.

---

# 11. Membership episodes

Membership is historical and episodic.

Conceptually:

```text
MEMBERSHIP_EPISODE
- member
- joined_at
- ended_at?
- end_reason?
```

The same human may have multiple membership episodes in one Shared World.

This supports:

- leave;
- removal;
- later rejoin;
- accurate historical presence.

---

# 12. Current membership does not imply full historical access

Freeze invariant:

> **Current membership ≠ entitlement to all historical World material.**

A newly joining member defaults to:

`FROM_JOIN_FORWARD`

Past access requires explicit authorization.

Conceptually:

```text
HISTORY_ACCESS_GRANT
- grantee
- bounded historical scope
- authority basis
```

Historical scope may later represent meaningful units such as:

- topic;
- period;
- Session;
- event;
- decision;
- analysis group;
- Replay.

Exact schema belongs later.

---

# 13. Rejoin

Rejoin creates a new `MEMBERSHIP_EPISODE`.

Architecture must support:

- restoration of access to the person's own prior membership-period history;
- no automatic access to the absence interval;
- selective later sharing of absence-period material.

Current access is therefore derived from:

```text
active membership
+ membership episodes
+ explicit history grants
```

not active membership alone.

---

# 14. Empty-membership condition

Current occupancy is separate from lifecycle.

A Shared World may reach:

`NO_ACTIVE_HUMAN_MEMBERS`

without being automatically deleted, converted or declared unanimously ended.

While no active human member is authorized:

- no new human activity occurs;
- historical truth remains;
- the World type does not change.

Exact recovery/rejoin handling is deferred to `CW2-03`.

Freeze invariant:

> **Membership count alone never deletes, converts or rewrites a Shared World.**

---

# 15. Capability definition

A Capability is a bounded mechanism that:

- acts on authorized World, material or user state;
- may create a World, artifact, projection or state transition;
- has its own lifecycle;
- is not itself a persistent semantic World.

---

# 16. Capability families

Conceptual families:

```text
WORLD BIRTH / MEMBERSHIP
- INVITE
- ACCEPT_INVITE
- ADD_MEMBER
- LEAVE_WORLD
- REMOVE_MEMBER
- REJOIN_WORLD
- END_WORLD
- GRANT_HISTORY_ACCESS

CROSS-WORLD / AUTHORITY
- CONTEXT_ADMISSION
- DISCLOSE
- PUBLISH
- SHARE_EXTERNAL

DERIVED OUTPUT
- REPLAY_CREATE
- REPLAY_DISTRIBUTE

PUBLIC
- DISCUSS
- DELETE_PUBLIC_EXPERIENCE

INTRODUCTIONS
- MATCHING_ENABLE
- MATCHING_PROPOSE
- MATCHING_FORWARD_PROPOSAL
- MATCHING_DECIDE
- MATCHING_MUTUAL
- INTRODUCTION_DISCLOSURE
- INTRODUCTION_END
- INTRODUCTION_COMPLETE

AMBIENT WORLD SYSTEM
- WORLD_PRESENCE_PROJECTION
```

These are architecture concepts, not frozen endpoint/event names.

---

# 17. User-level state

User/account state includes:

- Public Alias;
- secret Shared invitation credential;
- Marriage Introductions enabled/paused state;
- Matching preferences;
- hard dealbreakers;
- Introduction Profile;
- capability-specific permission grants.

These states remain separate from World state.

---

# 18. Relationship / Introduction state

Introduction state owns:

- proposal lifecycle;
- first-party forwarding approval;
- second-party decision;
- Mutual Match;
- active Introduction linkage;
- completion/closure outcome;
- Matching pause/resume effects.

The Shared World owns the actual shared history after birth.

---

# 19. Context Admission vs Material Transfer

## Context Admission

Permission for QANDEEL to reason from knowledge held in another authorized context.

It does not copy that fact into the target World.

## Material Transfer / Disclosure

An authorized source portion becomes target-audience material.

It establishes target-side content/truth with provenance.

These are separate primitives.

---

# 20. Shared private-context admission

Shared World private-context admission is scoped by:

```text
permission owner = exact participant
permission target = exact Shared World
effect = future QANDEEL reasoning admission
```

It does not automatically disclose private source content.

Explicit disclosure requires separate authority.

Revocation stops future admission but does not rewrite legitimate historical outputs.

---

# 21. Matching private-context admission

Matching admission is scoped by:

```text
source = user's self-authored MY_WORLD knowledge
target = Matching capability for that user
purpose = candidate selection / compatibility reasoning
```

This permission does not transfer into a Shared World after Match.

---

# 22. Public private-context prohibition

Public World has no hidden private Context Admission in v1.

Experience placement, classification and public `@qandeel` responses may use only:

- published/public material;
- permitted public-discussion context.

They may not use hidden Personal or hidden Shared context.

---

# 23. Provenance truth vs provenance disclosure

Architecture distinguishes:

`PROVENANCE_TRUTH`

from:

`PROVENANCE_DISCLOSURE`

The system preserves truthful internal dependency information.

But audiences see only provenance details they are authorized to know.

A derived Shared output may therefore contain an internal:

`SEALED_PROVENANCE_DEPENDENCY`

when private context legitimately contributed to the result but the source identity/details are not authorized for another participant.

Sealing provenance is not deletion or fabrication.

It is audience-scoped disclosure of truthful provenance.

---

# 24. World Presence Projection

Other Shared Worlds may be represented through:

`WORLD_PRESENCE_PROJECTION`

This projection may expose only the existence-level information authorized by Product.

It grants no:

- entry;
- membership;
- content;
- World name;
- participant identity;
- topic;
- private analysis;
- unapproved activity detail.

Presence Projection is neither membership nor Material Transfer.

---

# 25. Material availability states

Architecture distinguishes at least:

```text
MATERIAL_AVAILABLE
MATERIAL_OWNER_DELETED
```

For owner-deleted Shared material:

- source content becomes unavailable;
- QANDEEL must not reconstruct it from memory;
- minimal non-content historical/provenance trace may remain;
- legitimate prior analysis/discussion may remain historical;
- provenance may resolve to `SOURCE_UNAVAILABLE`.

Exact trace structure belongs to `CW2-03`.

---

# 26. Shared truth domain

Shared truth may be established by:

- statements made in the Shared World;
- events/actions occurring there;
- explicit disclosures admitted there;
- QANDEEL analysis/advice legitimately produced there.

A private fact used only through Context Admission does not automatically become Shared truth.

If later independently established in the Shared World, that new source may establish Shared truth.

---

# 27. Public Experience

A `PUBLIC_EXPERIENCE` has:

- stable identity while published;
- bounded published payload;
- publisher/publication authority;
- public semantic placement;
- attached discussion;
- provenance to authorized source portions.

Eligible payload may include authorized:

- human conversation material;
- audio;
- Replay;
- selected QANDEEL analysis material.

Authorizing one analysis portion does not expose hidden reasoning or adjacent private analysis.

---

# 28. Public source isolation

Publishing never creates access to:

- source World;
- source Session;
- omitted material;
- future source updates;
- adjacent private analysis.

A public object is a bounded projection, not a portal into its source.

---

# 29. Public discussion parent boundary

Public discussion exists under a parent:

`PUBLIC_EXPERIENCE`

It is not:

- a standalone World;
- an independent public destination;
- a DM channel;
- a route to contact the publisher directly.

If the parent Experience leaves Public World, attached discussion does not survive as an independently discoverable public object.

---

# 30. Public deletion

Authorized deletion results in:

```text
PUBLIC_EXPERIENCE → ABSENT_FROM_PUBLIC_WORLD
```

No public tombstone remains.

Any internal legal/safety/audit record is outside Public World semantics.

---

# 31. Replay position

Replay is a:

`SOURCE_BOUND_DERIVED_ARTIFACT`

Conceptual flow:

```text
Authorized Source Portion
    ↓
REPLAY_CREATE
    ↓
Replay Draft / Artifact
    ↓
Preview
    ↓
separate distribution decision
```

Creation does not widen audience.

---

# 32. Replay creation authority vs distribution authority

Architecture requires separate checks:

```text
REPLAY_CREATION_AUTHORITY
REPLAY_DISTRIBUTION_AUTHORITY
```

Passing creation authority never implies external/public distribution authority.

This allows internal Replay creation from viewable Shared material while preserving multi-owner distribution consent.

---

# 33. Replay temporal truth

Replay may:

- select real portions;
- omit real portions;
- join non-contiguous portions in truthful chronological order;
- use simple transitions.

Replay may not:

- fabricate speech;
- fabricate analysis;
- reorder events into false chronology;
- inject later knowledge into earlier time;
- reconstruct owner-deleted source content.

---

# 34. Derived object provenance degradation

Every derived object preserves provenance sufficient to know:

- source class;
- authorized source portion;
- source-time / knowledge-time constraints where relevant;
- authority basis at creation.

A provenance dependency may later become:

`SOURCE_UNAVAILABLE`

without exposing deleted/private content.

Final withdrawal behavior for already-authorized distributed artifacts belongs to `CW2-02`.

---

# 35. Mutual Match single-winner invariant

Pending Matching proposals may coexist before Match.

But:

> **At most one Mutual Match may commit into an active Introduction for a user.**

If acceptances race:

- exactly one transition may win;
- only one `SHARED_WORLD / INTRODUCTION` may be created;
- other pending proposals become terminal/non-matchable.

Transactional enforcement belongs to `CW2-06`.

---

# 36. Cross-world transition matrix

| Source | Capability | Result | Audience effect |
|---|---|---|---|
| `MY_WORLD` | accepted Invite | new `SHARED_WORLD / STANDARD` | explicit new audience |
| Matching state | Mutual Match | new `SHARED_WORLD / INTRODUCTION` | explicit new audience |
| `MY_WORLD` | Context Admission | Shared reasoning permission | no material transfer |
| `MY_WORLD` | Matching admission | Matching reasoning permission | no material transfer |
| Shared history | Grant History Access | bounded historical visibility | explicit |
| `MY_WORLD` | Publish | `PUBLIC_EXPERIENCE` | explicit |
| `SHARED_WORLD` | Publish | `PUBLIC_EXPERIENCE` | explicit |
| source material | Replay Create | Replay artifact | no audience widening |
| Replay artifact | Publish | `PUBLIC_EXPERIENCE` | explicit |
| Replay artifact | External Share | external artifact | explicit |
| other Shared World | Presence Projection | existence-only presence | no content access |
| Public Experience | Discuss | attached public discussion | remains public context |

---

# 37. Forbidden implicit transitions

Forbidden by default:

```text
MY_WORLD → automatic Shared copy
MY_WORLD → automatic Public copy
SHARED_WORLD → automatic MY_WORLD copy
SHARED_WORLD → automatic Public copy
PUBLIC_WORLD → automatic MY_WORLD memory import
PUBLIC_WORLD → hidden private-context enrichment
Matching permission → automatic Shared permission
Replay creation → automatic publication
Invitation creation → dormant Shared World
Matching proposal → Shared World before Mutual Match
Active membership → automatic full-history entitlement
One person's disclosure → reciprocal disclosure obligation
World Presence Projection → entry/access
Provenance truth → automatic provenance disclosure
Membership count change → automatic World deletion/conversion
```

---

# 38. Authority separation

Architecture separates:

## World governance authority
Controls World-level state/settings.

## Material authority
Controls an author's/owner's own contribution.

## Historical access authority
Controls visibility of prior World material.

## Derived-object creation authority
Controls whether an Experience/Replay can be created.

## Distribution authority
Controls audience expansion.

## Provenance-disclosure authority
Controls which provenance details an audience may see.

No authority implies another unless a later canonical contract explicitly says so.

---

# 39. Shared member exit and rejoin

Leaving/removal:

- ends current access;
- preserves historical authorship;
- does not rewrite World history.

Rejoin creates a new membership episode.

A Shared World never converts into a Personal World merely because membership shrinks.

---

# 40. Minimal common substrate

A generalized substrate may provide abstract infrastructure such as:

```text
world_id
world_type
lifecycle
audience-boundary hooks
history/time hooks
provenance hooks
capability boundary
authorization boundary
```

World types remain free to differ in:

- content objects;
- navigation;
- visual semantics;
- membership rules;
- analysis policies.

Shared infrastructure never implies shared Product meaning.

---

# 41. MY_WORLD non-regression obligations

Any implementation derived from CW2-01 must prove:

1. no second human can enter an existing Personal World;
2. Personal audience meaning remains unchanged;
3. no-hindsight remains intact;
4. Personal provenance remains intact;
5. cross-world permission is never implicit;
6. Public/Shared state cannot rewrite Personal semantic geography;
7. Matching does not turn `MY_WORLD` into a Dating destination;
8. Replay does not rewrite historical Personal analysis;
9. generalized membership code cannot accidentally apply to `MY_WORLD`;
10. Context Admission never becomes hidden source copying;
11. generalized provenance cannot leak private source existence/details to unauthorized audiences.

---

# 42. Canonical CW2-01 invariants

`A1.` Exactly three World types exist.  
`A2.` Replay, Matching, Experiences, Invitations and Public Discussion are not Worlds.  
`A3.` QANDEEL is a system actor, never a consenting human participant.  
`A4.` A Shared World is born only at its explicit creation-authority event.  
`A5.` Shared World identity is independent from current participant set.  
`A6.` Matching proposal flow and Introduction lifecycle are distinct.  
`A7.` `INTRODUCTION` is a Shared World phase, not a World type.  
`A8.` Introduction phase has exactly two human members in v1.  
`A9.` Membership and historical access are independent.  
`A10.` Rejoin is a new membership episode.  
`A11.` Membership count alone cannot delete, convert or rewrite a World.  
`A12.` Knowledge possession does not grant audience permission.  
`A13.` Context Admission is not Material Transfer.  
`A14.` Public World has no hidden private Context Admission in v1.  
`A15.` Matching permission does not transfer to Shared World.  
`A16.` Provenance truth does not imply provenance disclosure.  
`A17.` Presence Projection grants no World entry/content access.  
`A18.` Owner-deleted Shared material cannot be reconstructed by QANDEEL.  
`A19.` Publication creates bounded public material, never source access.  
`A20.` Public discussion cannot become a standalone public/DM surface.  
`A21.` Public Experience deletion leaves no public tombstone.  
`A22.` Replay creation and distribution have separate authority.  
`A23.` Replay remains source/temporal-truth bound.  
`A24.` At most one active Introduction may commit per user.  
`A25.` World governance, material authority, history access, derived creation, distribution and provenance disclosure are distinct authorities.  
`A26.` Member exit does not rewrite history.  
`A27.` No cross-world transition is implicit.  
`A28.` `MY_WORLD` frozen semantics remain behaviorally equivalent after infrastructure generalization.

---

# 43. Deferred dependencies

`CW2-02 — Authority, Consent & Audience Runtime`
owns the exact consent/permission machinery and audience computation.

`CW2-03 — Shared World Runtime Architecture`
owns concrete Shared lifecycle, membership, history-access, deletion and zero-member recovery mechanics.

`CW2-04 — Public World Runtime Architecture`
owns Public Experience runtime and public discussion.

`CW2-05 — Replay Runtime Architecture`
owns Replay manifest/rendering/export.

`CW2-06 — Introductions / Matching Runtime Architecture`
owns Matching proposals, cadence, races and Introduction runtime.

`CW2-07`
owns cross-world navigation/visual integration.

`CW2-08`
owns safety, moderation, entitlements and launch integration.

---

# 44. Freeze status

# `CW2-01 — CLOSED / FROZEN`

Any deliberate change to this structural architecture requires an explicit versioned superseding contract.

Next:

# `CW2-02 — Authority, Consent & Audience Runtime`
