# QANDEEL — Connected Worlds v2
## CW2-03 — Shared World Runtime Architecture v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Shared World runtime architecture  
**Depends on:**  
- `CW2-01 — World & Capability Architecture v1.0 — CLOSED / FROZEN`
- `CW2-02 — Authority, Consent & Audience Runtime v1.0 — CLOSED / FROZEN`

**Supersedes:** CW2-03 v0.1 and v0.2 drafts  
**Implementation:** NOT STARTED

---

# 1. Runtime identity

`SHARED_WORLD` is a persistent multi-human semantic World with:

- stable `world_id`;
- lifecycle;
- phase;
- historical membership episodes;
- local material/truth;
- governance;
- historical-access boundaries;
- QANDEEL presence.

It is never implemented as shared access to a Personal World.

---

# 2. World birth paths

Exactly two v1 birth paths exist:

```text
DIRECT_INVITATION_ACCEPTED
MATCHING_MUTUAL_MATCH
```

Direct birth:

`ACTIVE / STANDARD`

Matching birth:

`ACTIVE / INTRODUCTION`

No Shared World exists before the corresponding valid creation event.

---

# 3. Direct invitation object

Before World birth there is only:

`DIRECT_WORLD_INVITATION`

Conceptual states:

```text
PENDING
ACCEPTED
DECLINED
CANCELLED
EXPIRED
INVALIDATED
```

An invitation is not a dormant World.

---

# 4. Secret Shared invitation credential

The credential is user/account state.

It is:

- private;
- non-searchable;
- distinct from Public Alias;
- rotatable;
- not World identity.

Inviter-side behavior before acceptance must be non-enumerating.

Entering a credential does not reveal the target identity.

---

# 5. Credential epoch rule

Invite creation binds to the target's current:

`TARGET_CREDENTIAL_EPOCH`

Epoch is revalidated at invitation dispatch/commit.

If target rotates:

```text
old-epoch new invite attempt → INVALIDATED
```

In v1, pending unaccepted direct invitations created under an older credential epoch are invalidated.

Already accepted Worlds remain unaffected.

---

# 6. Direct World birth transaction

Valid target acceptance atomically:

```text
consume exact invitation
create SHARED_WORLD
create inviter membership episode
create target membership episode
phase = STANDARD
lifecycle = ACTIVE
append WORLD_BIRTH
mark invitation = ACCEPTED
```

Preconditions:

- exact target;
- invitation active;
- invitation unconsumed;
- inviter/target can still participate;
- system policy allows creation.

Acceptance is idempotent.

One invitation creates at most one World.

---

# 7. No setup requirement before birth

Name, description, topic, avatar/visual marker and other common settings are not required before entry.

They are later governed Shared World settings.

---

# 8. Direct birth initializer

Direct World birth imports no hidden Personal truth.

Initializer may create:

- World birth event;
- neutral QANDEEL welcome;
- onboarding affordances.

Private Personal context requires a later valid Shared Standing Context Grant.

---

# 9. Matching birth transaction

Successful single-winner Mutual Match atomically:

```text
create SHARED_WORLD
create membership episodes for matched pair
phase = INTRODUCTION
lifecycle = ACTIVE
link INTRODUCTION_RECORD
append WORLD_BIRTH
append INTRODUCTION_STARTED
```

No third human may join while phase is `INTRODUCTION`.

---

# 10. Matching birth context boundary

The Introduction initializer may render bounded Matching-authorized safe compatibility explanation.

It may not:

- expose raw private Matching evidence;
- copy private source material;
- transfer `MATCHING_CONTEXT_GRANT` into Shared World.

Future Shared private reasoning requires its own Shared Standing Context Grant.

---

# 11. Lifecycle and phase

Lifecycle:

```text
ACTIVE
READ_ONLY_CLOSED
```

Phase:

```text
INTRODUCTION
STANDARD
```

Valid combinations:

```text
ACTIVE / INTRODUCTION
READ_ONLY_CLOSED / INTRODUCTION
ACTIVE / STANDARD
READ_ONLY_CLOSED / STANDARD
```

---

# 12. Introduction transition law

From:

`ACTIVE / INTRODUCTION`

exactly one terminal transition may commit:

```text
SUCCESS → ACTIVE / STANDARD
END     → READ_ONLY_CLOSED / INTRODUCTION
```

Commit is serialized on exact phase/version.

No hybrid state is valid.

---

# 13. Introduction success

QANDEEL may propose transition.

Both matched humans must approve.

Commit preserves:

- same `world_id`;
- same history;
- same provenance.

Then:

```text
phase = STANDARD
INTRODUCTION_RECORD = COMPLETED
append INTRODUCTION_COMPLETED
```

---

# 14. Introduction end

Either matched person may end unilaterally.

No counterpart approval.

Commit:

```text
lifecycle = READ_ONLY_CLOSED
phase = INTRODUCTION
INTRODUCTION_RECORD = CLOSED
append INTRODUCTION_ENDED
```

Ordinary add-member/remove-member/leave mechanics are not used during Introduction.

---

# 15. Active membership episodes

Standard Shared World membership is represented by historical episodes:

```text
MEMBERSHIP_EPISODE
- user
- start
- end?
- end_reason?
```

Current members are derived from open episodes.

Prior episodes remain historical truth.

---

# 16. Add-member governance

For `ACTIVE / STANDARD`:

```text
exact target proposal
        ↓
ALL_CURRENT_MEMBERS approve
        ↓
MEMBER_INVITATION dispatched
```

Target must separately accept.

The inviter does not gain owner privilege.

---

# 17. Stale add-member invitation

A `MEMBER_INVITATION` is bound to:

- exact target;
- exact World;
- exact governance proposal;
- exact membership snapshot.

If membership topology changes before target acceptance:

```text
MEMBER_INVITATION → STALE_GOVERNANCE / TERMINAL
```

It cannot be revived.

A fresh proposal/approval/invite is required.

---

# 18. Member acceptance

Valid acceptance:

```text
revalidate exact invitation
revalidate authority
        ↓
create new membership episode
append MEMBER_JOINED
```

No new World is created.

---

# 19. New-member historical default

At join:

`FROM_JOIN_FORWARD`

No automatic retrospective access to:

- messages;
- voice notes;
- Sessions;
- analysis;
- decisions;
- events;
- Replays.

---

# 20. No ghost-history requirement

The runtime does not require placeholders revealing:

- hidden message counts;
- hidden Session existence;
- hidden topic names;
- hidden participant activity.

Internal historical truth can exist without disclosure of hidden history existence.

---

# 21. Selective historical sharing

Flow:

```text
select meaningful historical scope
        ↓
HISTORY_PACKAGE_MANIFEST_VERSION
        ↓
preview exact grantee-visible package
        ↓
derive REQUIRED_HISTORY_APPROVER_SET
        ↓
collect current approvals
        ↓
commit HISTORY_ACCESS_GRANT
```

Conceptual scopes may include:

- topic;
- period;
- Session;
- event;
- decision;
- analysis group;
- Replay.

---

# 22. Historical temporal truth

Later visibility never changes:

- event time;
- membership time;
- original knowledge time.

A later grant changes visibility only.

It never implies the new member was present when material was created.

---

# 23. Voluntary leave

For `ACTIVE / STANDARD`:

Any current member may leave unilaterally.

Commit:

- closes membership episode;
- appends `MEMBER_LEFT`;
- ends current World access;
- invalidates stale audience/authority snapshots;
- stops future use of World-scoped private-context grants where applicable.

History is not rewritten.

---

# 24. Material authority after membership loss

Loss of World access does not erase authority over one's own material.

Former members may use:

`OWN_MATERIAL_CONTROL`

through an account/privacy surface without regaining World browsing access.

The capability cannot reveal surrounding World content.

---

# 25. Removal

For `ACTIVE / STANDARD`:

Removal requires:

`ALL_CURRENT_MEMBERS_EXCEPT(target)`

over the exact removal mutation.

Commit:

- closes target membership episode;
- appends `MEMBER_REMOVED`;
- ends target current access;
- invalidates stale audience/authority state.

Historical authorship remains.

---

# 26. One active human remaining

A Shared World with one active human remains a Shared World.

The remaining member may continue using authorized Shared World context.

No special "sole survivor" authority exists.

Departed members' private Personal context is not available for future reasoning without a valid independent authority basis.

---

# 27. Zero active humans

Condition:

`NO_ACTIVE_HUMAN_MEMBERS`

Effect:

- World/history preserved;
- no new ordinary human World activity;
- no automatic deletion/conversion;
- empty-set unanimity is never considered approval;
- no automatic recovery.

v1 treats the World as inert historical state.

Recovery requires later explicit superseding design.

---

# 28. Rejoin

A former member may rejoin an `ACTIVE / STANDARD` World with at least one current human when:

`ALL_CURRENT_MEMBERS`

approve the exact rejoin.

A new membership episode is created.

Absence remains historically real.

---

# 29. Rejoin history

Rejoin restores authorized prior membership-period history.

Absence-period material remains hidden unless separately granted.

No hidden absence-period material enters group QANDEEL context by default.

---

# 30. World settings

World-level settings affecting all participants require exact unanimous current-member approval.

Examples:

- name;
- description;
- general visual marker;
- common settings.

---

# 31. Standard World end

For `ACTIVE / STANDARD`:

World end requires unanimous current-member approval.

Commit:

```text
ACTIVE / STANDARD
→ READ_ONLY_CLOSED / STANDARD
append WORLD_ENDED
```

World end is archival closure, not deletion.

---

# 32. Closed-world membership termination

When any Shared World enters:

`READ_ONLY_CLOSED`

all open active membership episodes terminate with the appropriate closure reason.

Closed historical viewing is not represented as active membership.

---

# 33. Closed World View Entitlement

At closure, each entitled person receives a bounded:

`CLOSED_WORLD_VIEW_ENTITLEMENT`

representing only the World material/history that person was authorized to view at the moment of closure.

The entitlement:

- permits historical viewing;
- does not permit new conversation;
- does not grant governance;
- does not allow adding/rejoining members;
- does not create new historical access;
- does not authorize private-context reasoning;
- remains subject to later valid owner deletions/privacy mutations.

Closure therefore preserves historical access without fake active membership.

---

# 34. Failed Introduction viewing

When `INTRODUCTION` closes unsuccessfully:

- both matched members' active episodes terminate;
- each gets a bounded `CLOSED_WORLD_VIEW_ENTITLEMENT`;
- ordinary messaging/progression stops;
- own-material privacy authority remains independent.

---

# 35. Ordinary vs privacy mutation

Runtime distinguishes:

```text
ORDINARY_WORLD_MUTATION
PRIVACY_MATERIAL_MUTATION
```

`READ_ONLY_CLOSED` blocks ordinary mutations.

It may still permit properly authorized privacy/material mutations such as owner deletion.

Privacy mutation never reopens lifecycle.

---

# 36. Material classes

Conceptual Shared material:

```text
HUMAN_TEXT
HUMAN_VOICE_NOTE
QANDEEL_OUTPUT
QANDEEL_ANALYSIS
EXPLICIT_DISCLOSURE
WORLD_EVENT_DERIVED_MATERIAL
```

Material carries:

- author/source;
- temporal data;
- authority requirements;
- availability state;
- provenance;
- audience visibility.

---

# 37. Owner deletion

Owner deletion:

```text
MATERIAL_AVAILABLE
→ MATERIAL_OWNER_DELETED
```

Consequences:

- source content unavailable;
- future model use denied;
- QANDEEL reconstruction forbidden;
- minimal non-content deletion trace may remain;
- prior legitimate analysis/discussion may remain historical;
- provenance can resolve `SOURCE_UNAVAILABLE`.

A history/view entitlement cannot preserve deleted source content.

---

# 38. Shared local truth

Shared-native truth may arise from:

- human statements;
- human voice notes;
- World events/actions;
- explicit private disclosures;
- legitimate QANDEEL outputs/analysis.

Reasoning-only private context does not automatically become Shared truth.

---

# 39. Standing private-context integration

When QANDEEL genuinely needs Personal context:

```text
private JIT request to exact participant
→ grant / decline
```

A grant is:

- participant-owned;
- exact-World scoped;
- audience-ceiling bounded;
- reasoning-only unless separate disclosure authority exists.

---

# 40. Membership expansion and private grants

Adding a member never expands existing Standing Context Grants automatically.

Each grantor must explicitly extend/reconfirm before their private context may influence outputs to the expanded audience.

---

# 41. Shared communication substrate

v1 supports:

```text
HUMAN_TEXT
HUMAN_VOICE_NOTE
QANDEEL_PARTICIPATION
```

These share one World truth/history model.

---

# 42. Human-to-human live call extension

Reserved:

`SHARED_HUMAN_LIVE_CALL`

v1:

`DISABLED_BY_PRODUCT_LEGAL_GATE`

No current Shared runtime dependency requires it.

Future enablement needs a separate reviewed legal/runtime contract and must preserve frozen World semantics.

---

# 43. QANDEEL Standard mode

In `ACTIVE / STANDARD`, QANDEEL may:

- converse;
- analyze authorized World truth;
- connect authorized history;
- mediate;
- ask;
- support reflection/decisions;
- use valid private reasoning grants.

QANDEEL remains a system actor.

---

# 44. QANDEEL Introduction mode

In `ACTIVE / INTRODUCTION`, QANDEEL may additionally be more proactive:

- welcome;
- break ice;
- explain bounded safe compatibility reasons;
- suggest questions/topics;
- surface safe differences/agreements;
- propose progressive disclosure;
- propose transition to Standard.

The richer behavior creates no extra privacy authority.

---

# 45. World Presence Projection

Other Shared Worlds may be represented externally only through:

`WORLD_PRESENCE_PROJECTION`

v1 source is a dedicated privacy-safe projection state.

Default exposed meaning:

`existence only`

It does not reveal private telemetry, identity, topic, content or entry rights.

---

# 46. World event history

Logical append-only events may include:

```text
WORLD_BIRTH
MEMBER_JOINED
MEMBER_LEFT
MEMBER_REMOVED
MEMBER_REJOINED
HISTORY_GRANTED
SETTING_CHANGED
MATERIAL_DELETED
INTRODUCTION_STARTED
INTRODUCTION_COMPLETED
INTRODUCTION_ENDED
WORLD_ENDED
```

Internal event truth and audience-visible event detail remain separate.

---

# 47. Idempotency

Consequential transitions are idempotent.

At minimum:

- one direct invitation → at most one World;
- one member acceptance → at most one membership episode;
- one leave command → one effective leave;
- deletion cannot double-transition material;
- Introduction has one terminal winner.

---

# 48. Concurrency

Runtime commits against canonical current state.

Stale operations fail/re-evaluate when:

- membership changes;
- governance changes;
- credential epoch changes;
- invitation terminalizes;
- material is deleted;
- World closes;
- phase changes;
- authority/audience changes.

---

# 49. Canonical invariants

`C1.` No Shared World exists before valid creation acceptance.  
`C2.` Direct acceptance and Matching Mutual Match are the only v1 birth paths.  
`C3.` Secret invite credential is user state, not World identity.  
`C4.` Credential epoch is revalidated at invitation commit.  
`C5.` Pending old-epoch direct invites are invalidated by credential rotation in v1.  
`C6.` A direct invitation creates at most one World.  
`C7.` Direct World birth imports no hidden Personal context.  
`C8.` Matching birth may use bounded safe compatibility output but transfers no Matching Context Grant.  
`C9.` Introduction and Standard are phases of one Shared World type.  
`C10.` Introduction contains exactly two humans.  
`C11.` Exactly one Introduction terminal transition may commit.  
`C12.` Membership is episodic and historically truthful.  
`C13.` Add member requires unanimous current-member approval before invitation.  
`C14.` Stale add-member invitation is terminal and cannot be revived.  
`C15.` New member defaults to `FROM_JOIN_FORWARD`.  
`C16.` Hidden history has no required ghost placeholders.  
`C17.` Selective historical sharing is manifest/version/authority bound.  
`C18.` Later visibility never implies historical presence.  
`C19.` Voluntary Standard leave is unilateral.  
`C20.` Removal requires all current members except target.  
`C21.` Material authority may survive membership loss without restoring World access.  
`C22.` One active member does not convert Shared World into Personal World.  
`C23.` One-member continuation creates no special authority over departed private context.  
`C24.` Zero active membership preserves an inert World and never makes empty-set unanimity true.  
`C25.` Rejoin creates a new membership episode.  
`C26.` Absence-period history is not automatically restored.  
`C27.` World settings require exact unanimous current-member governance.  
`C28.` Standard World end requires unanimous current members.  
`C29.` Closed historical viewers are not active members.  
`C30.` Closed World viewing is bounded to access held at closure.  
`C31.` Read-only closure blocks ordinary mutation but may permit authorized privacy material mutation.  
`C32.` Owner-deleted material is unavailable for future use/reconstruction.  
`C33.` Shared truth is distinct from private reasoning-only context.  
`C34.` Shared Standing Context Grants are exact-World and audience-ceiling bounded.  
`C35.` Membership expansion never silently widens private-context reasoning.  
`C36.` Shared v1 supports human text, human voice notes and QANDEEL participation.  
`C37.` Human-to-human Shared live call is extension-ready but disabled in v1.  
`C38.` QANDEEL Introduction mode creates no extra privacy authority.  
`C39.` Presence Projection uses dedicated privacy-safe state and grants no access.  
`C40.` Internal event truth and audience-visible event detail are separate.  
`C41.` Consequential Shared transitions are idempotent.  
`C42.` Stale canonical state cannot silently mutate Shared World.

---

# 50. Deferred

Not frozen here:

- physical database schema;
- endpoint/service names;
- invitation expiry duration;
- final invitation copy;
- final small-group maximum;
- zero-member recovery mechanism;
- human live-call legal/provider implementation;
- material deletion UI;
- history grant withdrawal after already viewed;
- moderation/report/block mechanics;
- final visual/motion design.

---

# 51. Freeze status

# `CW2-03 — CLOSED / FROZEN`

Any deliberate change requires an explicit versioned superseding contract.

Next:

# `CW2-04 — Public World Runtime Architecture`
