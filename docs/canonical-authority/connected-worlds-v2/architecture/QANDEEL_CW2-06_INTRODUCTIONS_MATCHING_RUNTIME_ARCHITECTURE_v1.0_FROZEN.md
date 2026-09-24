# QANDEEL — Connected Worlds v2
## CW2-06 — Introductions / Matching Runtime Architecture v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Matching / Introductions runtime architecture  
**Depends on:** CW2-01 through CW2-05 — CLOSED / FROZEN  
**Supersedes:** CW2-06 v0.1 and v0.2 drafts  
**Implementation:** NOT STARTED

---

# 1. Product identity

Matching v1 is:

`MARRIAGE_INTRODUCTION`

hosted from `MY_WORLD`.

It is a doorway capability, not:

- a World;
- a Dating feed;
- a candidate marketplace;
- a visible compatibility-ranking system;
- a direct-contact system.

Successful Match creates:

`SHARED_WORLD / INTRODUCTION`

under frozen CW2-03 semantics.

---

# 2. Participation vs private-context authority

Architecture separates:

```text
MATCHING_PARTICIPATION_STATE
MATCHING_CONTEXT_GRANT
```

Participation controls proposal-flow availability.

Context Grant controls which self-authored Personal knowledge QANDEEL may use internally.

One does not silently imply the other.

---

# 3. Participation states

Conceptually:

```text
OFF
ACTIVE
PAUSED
```

Pause reasons may include:

```text
USER_PAUSED
ACTIVE_INTRODUCTION
POST_INTRODUCTION
POST_SUCCESS
SYSTEM_POLICY
```

New proposal/Mutual Match flow requires compatible current active state.

---

# 4. Entry and activation

Entry paths:

```text
CONVERSATIONAL_ENTRY
MANUAL_MY_WORLD_ENTRY
```

QANDEEL may offer the feature.

Offer is not activation.

Activation requires explicit user action.

Decline/ignore does not activate Matching and does not justify repeated nagging.

---

# 5. Activation conversation

A short QANDEEL flow may establish:

- marriage intent;
- hard dealbreakers;
- preferences;
- Introduction Profile;
- Matching Context Grant.

It is not a long Dating Profile marketplace form.

---

# 6. No mandatory identity/age proof

v1 does not require:

- KYC;
- national ID;
- selfie verification;
- government identity verification;
- mandatory age-proof documents.

Safety/report/block remains a separate later domain.

---

# 7. Matching Context Grant

Scope:

```text
grantor = user
source = user's self-authored MY_WORLD knowledge
target = Matching capability
purpose = candidate evaluation + safe compatibility reasoning
```

It permits internal reasoning.

It does not authorize raw private-source disclosure.

It never transfers into Shared World.

---

# 8. Candidate self-truth

Matching facts about a candidate may derive from:

- candidate's self-authored Personal knowledge;
- candidate's explicit Matching answers;
- candidate's Introduction Profile;
- allowed canonical product/account state.

Third-party claims do not become candidate self-truth merely because QANDEEL knows them.

---

# 9. Non-inference rule

Eligibility-critical facts are not silently inferred from:

- name;
- voice;
- photo;
- linguistic style.

Unknown required facts remain `UNKNOWN`.

No hidden stereotype is promoted to confirmed candidate truth.

---

# 10. Introduction Profile

A versioned:

`INTRODUCTION_PROFILE_VERSION`

contains bounded information the user pre-authorizes for proposal use.

Exact final fields remain Product-configurable.

---

# 11. Pre-Match Proposal Disclosure Authority

An active candidate must have current:

`PRE_MATCH_PROPOSAL_DISCLOSURE_AUTHORITY`

for the bounded information QANDEEL may show to potential candidates.

It covers:

- approved Introduction Profile material;
- Product-permitted Safe Compatibility Conclusions.

It does not cover raw private evidence or direct contact data.

---

# 12. Pre-Match disclosure ceiling

Before Mutual Match, recipient may see only:

- first name;
- minimal approved non-identifying information;
- safe compatibility conclusion.

No:

- photo;
- full searchable identity;
- phone/email;
- social handle;
- precise workplace/contact route.

---

# 13. Hard dealbreakers vs preferences

```text
HARD_DEALBREAKER
SOFT_PREFERENCE
```

A finalized Hard Dealbreaker cannot be overridden by stronger compatibility.

Soft Preferences may be balanced.

---

# 14. Dealbreaker truth

Hard requirements use:

```text
PASS
FAIL
UNKNOWN
```

`FAIL` blocks.

`UNKNOWN` is never silently treated as PASS.

---

# 15. Candidate eligibility snapshot

Before surfacing, forwarding and Mutual Match commit, runtime revalidates:

`CANDIDATE_ELIGIBILITY_SNAPSHOT`

including:

- active participation;
- no active Introduction;
- current disclosure authority;
- hard requirements;
- current profile/requirement versions;
- pair state;
- system/safety policy.

---

# 16. Internal evaluation vs visible output

QANDEEL may use internal candidate-evaluation signals.

Product-visible output does not expose:

- compatibility percentage;
- rank;
- score;
- leaderboard;
- browsable candidate list.

Matching produces bounded proposals.

---

# 17. Cadence and bounded pending proposals

Cadence is controlled by:

`PROPOSAL_CADENCE_POLICY`

with current Product target ≈ five proposals/week.

Concurrent pending count is controlled by:

`PENDING_PROPOSAL_LIMIT_POLICY`

Exact values remain configurable.

Pause does not create a future backlog flood.

---

# 18. Canonical pair identity

Every pair uses unordered:

`PAIR_KEY(userA,userB)`

At most one live pair proposal exists regardless of which direction QANDEEL first surfaced it.

---

# 19. Proposal lifecycle

Conceptual states:

```text
PREPARED
OFFERED_TO_FIRST
FIRST_DECLINED
FIRST_FORWARD_APPROVED
FORWARDED_TO_SECOND
SECOND_DECLINED
WITHDRAWN
EXPIRED
STALE
CANCELLED_BY_COMPETING_MATCH
MUTUAL_MATCH_COMMITTED
```

---

# 20. First-recipient proposal

First recipient receives:

- candidate first name;
- bounded approved information;
- recipient-specific Safe Compatibility Conclusion.

Candidate is not notified yet.

---

# 21. First decline

First-party decline terminalizes the proposal.

Candidate does not learn proposal existed.

Decline reason remains private.

---

# 22. Forward approval

First recipient explicitly authorizes QANDEEL to send the candidate an independent proposal about them.

Forward approval:

- is not Mutual Match;
- creates no World;
- grants no direct contact.

The flow must make clear that counterpart acceptance can create an Introduction.

---

# 23. Independent second proposal

Second recipient receives a recipient-specific proposal based on:

- first party's approved proposal information;
- safe compatibility conclusions relevant to the second recipient.

It is not a copy of the first-side proposal.

First party does not automatically see its exact wording.

---

# 24. Safe Compatibility Conclusion

A:

`SAFE_COMPATIBILITY_CONCLUSION`

may express broad relational compatibility inferred from authorized Matching context.

It may not expose:

- private memories;
- incidents;
- direct private quotes;
- hidden evidence;
- secret provenance.

---

# 25. Sensitive Conclusion Filter

Every safe conclusion passes:

`SENSITIVE_CONCLUSION_FILTER`

The output must not reveal or strongly imply unapproved sensitive/private facts merely through an inferred conclusion.

Private context may still be used internally for reasoning.

---

# 26. Proposal Disclosure Gate

Every proposal passes:

`MATCHING_PROPOSAL_DISCLOSURE_GATE`

which transforms:

```text
PRIVATE_MATCHING_REASONING
```

into only:

```text
AUTHORIZED_RECIPIENT_PROPOSAL
```

No private evidence crosses the gate.

---

# 27. Recipient Proposal View Version

Every recipient-visible proposal is immutable:

`RECIPIENT_PROPOSAL_VIEW_VERSION`

Acceptance binds to the exact view version the recipient saw.

A materially changed proposal requires a new view and fresh acceptance.

---

# 28. Rejection / expiry privacy

Second recipient may accept, decline or let proposal expire.

If no Mutual Match occurs, first recipient receives neutral non-completion only.

The system does not reveal:

- rejection vs expiry;
- rejection reason;
- private feedback;
- competing activity.

---

# 29. Withdrawal

Before Mutual Match, first party may withdraw.

If second party already saw proposal, they receive only audience-safe neutral unavailability.

---

# 30. Pause/opt-out

Pause or opt-out wins before Mutual Match.

On pause:

- no new proposals;
- no new Match commit;
- pending proposals involving the user become terminal/non-matchable;
- already-informed counterparties receive neutral unavailability where appropriate.

Pause reason is private.

---

# 31. Proposal expiry

Expiry is controlled by configurable:

`PROPOSAL_EXPIRY_POLICY`

Expiry is terminal.

Exact duration is not frozen.

---

# 32. Proposal version binding

A live proposal binds current:

- Introduction Profile versions;
- requirements/dealbreakers;
- candidate eligibility snapshot;
- disclosure authority;
- recipient proposal view versions.

Material change triggers revalidation.

Invalidated proposals become `STALE`.

Already-delivered proposal information is not retroactively erased.

---

# 33. Private invalidation reason

If proposal becomes invalid because of a private dealbreaker/profile/state change:

counterpart receives no private reason.

Only neutral non-completion/unavailability may be exposed.

---

# 34. Active Introduction Slot

Each user has conceptually:

```text
ACTIVE_INTRODUCTION_SLOT
= EMPTY | OCCUPIED(introduction_id)
```

No durable pre-reservation exists outside atomic Match commit.

---

# 35. Mutual Match transaction

Second-party acceptance may commit only if accepted Proposal View is still valid/current.

Logical transaction:

1. both participation states current ACTIVE;
2. exact pair/proposal/version current;
3. eligibility/authority current;
4. both Introduction slots EMPTY;
5. atomically claim both slots;
6. mark `MUTUAL_MATCH_COMMITTED`;
7. create/link one Introduction Record;
8. create exactly one `SHARED_WORLD / INTRODUCTION`;
9. pause/suppress proposal generation for both;
10. terminalize competing proposals;
11. create exact bounded `MATCH_HANDOFF_PACKAGE_VERSION`.

All effects converge under one stable `MATCH_COMMIT_ID` or equivalent exactly-once identity.

---

# 36. Single-winner invariant

If multiple counterparties accept near-simultaneously:

only one transaction can claim a user's active Introduction slot.

Exactly one active Introduction may result.

No duplicate Shared World is allowed.

---

# 37. No ghost slot

Failed/partial technical Match commit cannot leave an occupied slot without the linked Introduction identity.

Retries converge on the same Match/World.

---

# 38. Competing proposal privacy

Winning Match terminalizes all other live proposals involving either user.

Already-informed counterparties receive neutral unavailability.

No disclosure of:

- another Match;
- winner identity;
- Match timing;
- competing proposals.

---

# 39. Mutual Match meaning

Canonical Product truth:

> Both users consented to begin a QANDEEL-guided Introduction.

It is not canonical truth of:

- engagement;
- exclusivity;
- relationship success;
- marriage;
- legal status.

---

# 40. Matching private operational domain

Matching operational data is classified:

`MATCHING_PRIVATE_OPERATIONAL_STATE`

It includes by default:

- activation status;
- candidate evaluation history;
- proposal history;
- decline/expiry reason;
- hard dealbreakers;
- private feedback;
- competing proposals.

It is not ordinary Public/Profile/Shared material.

Only bounded outputs cross through explicit canonical capabilities.

---

# 41. Match Handoff Package

Successful Match creates immutable:

`MATCH_HANDOFF_PACKAGE_VERSION`

It may contain only safe, Introduction-opening material such as:

- first names;
- approved profile fields appropriate to the Introduction;
- safe compatibility conclusions;
- safe agreement/difference themes;
- continuity identifiers.

It must not contain:

- raw `MY_WORLD` evidence;
- private memories/incidents;
- hidden Matching context;
- secret provenance;
- Matching Context Grant.

CW2-03 Introduction initializer may consume this package.

---

# 42. Matching→Shared permission isolation

After handoff:

ongoing Shared private reasoning requires a new Shared Standing Context Grant.

Matching Context Grant is never reused as Shared authority.

---

# 43. Shared World independence after Match

After Match commit, the Shared Introduction has its own lifecycle.

Later changes to:

- Matching ON/OFF/PAUSED state;
- Matching Context Grant;
- cadence;
- Introduction Profile;

do not automatically mutate or close the Shared World.

Ending the Introduction uses the Shared/Introduction action from CW2-03.

---

# 44. Progressive disclosure

During active Introduction, QANDEEL may suggest owner-controlled disclosure of:

- partial image;
- full image;
- full name;
- contact method;
- deeper personal field.

Suggestion is not authority.

---

# 45. Disclosure resource

Each:

`INTRODUCTION_DISCLOSURE_RESOURCE`

binds:

- owner;
- resource type;
- resource version;
- exact counterpart;
- current disclosure authority.

Staged image derivatives are separate bounded owner-authorized resources.

---

# 46. Non-reciprocity

One user's disclosure never obligates or authorizes reciprocal disclosure from the other.

---

# 47. Failed Introduction integration

On `INTRODUCTION_CLOSED`:

- active slots release;
- Matching setup remains;
- effective status becomes `PAUSED_POST_INTRODUCTION` unless separately OFF;
- no new proposals auto-start.

Explicit user Resume is required.

---

# 48. Successful Introduction integration

On `INTRODUCTION_COMPLETED`:

- active slots release as Matching lifecycle locks;
- Marriage Introductions remains paused;
- no time/inactivity auto-reactivation.

Canonical truth remains:

`INTRODUCTION_COMPLETED_TO_STANDARD_SHARED_WORLD`

not an inferred relationship/legal status.

---

# 49. Later relationship end

Ending the later Standard Shared World never auto-reactivates Marriage Introductions.

User explicitly reactivates if desired.

---

# 50. Reactivation

Explicit Resume revalidates:

- participation;
- Matching Context Grant;
- Introduction Profile;
- requirements/preferences;
- active Introduction slot;
- current safety/system eligibility.

Old stale proposals never revive.

---

# 51. Profile/disclosure revocation

Removing a profile field/disclosure authority:

- affects future proposal use;
- may stale current proposal if materially relevant;
- does not erase already-delivered proposal history.

---

# 52. No marketplace/contact path

No user-facing `LIST_ALL_CANDIDATES` capability exists.

No direct pre-Match contact endpoint exists.

Proposal interaction remains mediated by QANDEEL.

---

# 53. Pair privacy

A person does not learn they were evaluated/considered unless proposal flow reaches an authorized recipient proposal.

Internal pair state remains private.

---

# 54. Event history

Conceptual events include:

```text
MATCHING_ACTIVATED
MATCHING_PAUSED
MATCHING_REACTIVATED
PROFILE_UPDATED
PROPOSAL_PREPARED
PROPOSAL_OFFERED_FIRST
PROPOSAL_FORWARD_APPROVED
PROPOSAL_FORWARDED_SECOND
PROPOSAL_DECLINED
PROPOSAL_EXPIRED
PROPOSAL_WITHDRAWN
PROPOSAL_STALE
MUTUAL_MATCH_COMMITTED
COMPETING_PROPOSAL_CANCELLED
INTRODUCTION_CLOSED
INTRODUCTION_COMPLETED
DISCLOSURE_GRANTED
```

Event truth and audience-visible explanation are separate.

---

# 55. Idempotency and concurrency

Consequential operations are idempotent.

Stale state cannot commit when:

- user pauses;
- profile/dealbreaker changes;
- disclosure authority changes;
- proposal expires;
- view version changes;
- another Match wins;
- active slot changes;
- system/safety state changes.

---

# 56. Canonical invariants

`F1.` Matching is a capability hosted from `MY_WORLD`, never a World.  
`F2.` v1 intent is serious relationship/marriage.  
`F3.` Offer and activation are distinct.  
`F4.` Matching participation and private-context authority are distinct.  
`F5.` Matching operational state is private by default.  
`F6.` No mandatory KYC/identity/age-proof prerequisite is introduced.  
`F7.` Matching reasoning uses only currently authorized self-authored/self-related Personal context.  
`F8.` Third-party claims do not become candidate self-truth.  
`F9.` Eligibility-critical unknown facts are not silently inferred/pass.  
`F10.` Introduction Profile is bounded/versioned.  
`F11.` Pre-Match Proposal Disclosure Authority is required to surface a candidate.  
`F12.` Before Match there is no photo/contact/full searchable identity.  
`F13.` Hard dealbreakers cannot be overridden.  
`F14.` Candidate evaluation is not exposed as score/ranking/marketplace.  
`F15.` Cadence and pending counts are bounded/configurable.  
`F16.` Canonical Pair Key prevents reversed duplicate live proposals.  
`F17.` First proposal does not notify candidate.  
`F18.` Forward approval is not Mutual Match.  
`F19.` Second proposal is independently recipient-specific.  
`F20.` Safe conclusions cannot reveal private evidence or unapproved sensitive facts.  
`F21.` Recipient acceptance binds exact Proposal View Version.  
`F22.` Rejection/expiry/invalidation reasons remain neutral externally.  
`F23.` Pause/opt-out wins before Mutual Match.  
`F24.` Version/state changes can stale proposal.  
`F25.` Already-delivered proposal information is not retroactively erased.  
`F26.` Each user has at most one active Introduction slot.  
`F27.` Slot claim + Introduction/World creation are one logical exactly-once Match commit.  
`F28.` Failed Match commit cannot leave ghost slot/duplicate World.  
`F29.` Exactly one competing Mutual Match can win per user.  
`F30.` Competing proposal closure never reveals another Match.  
`F31.` Mutual Match means consent to begin Introduction, not relationship status.  
`F32.` Match Handoff Package is bounded and contains no raw Matching private context.  
`F33.` Matching Context Grant never transfers into Shared World.  
`F34.` Shared World lifecycle becomes independent after Match commit.  
`F35.` Progressive disclosure is owner/resource/version/counterpart-specific.  
`F36.` Progressive disclosure is non-reciprocal.  
`F37.` Failed Introduction preserves Matching setup but remains paused until explicit Resume.  
`F38.` Successful Introduction leaves Matching paused until explicit reactivation.  
`F39.` Later Shared World end does not auto-reactivate Matching.  
`F40.` No candidate browsing/direct pre-Match contact exists.  
`F41.` Internal event truth and audience-visible explanation remain separate.  
`F42.` Consequential Matching operations are idempotent.  
`F43.` Stale Matching state cannot silently commit.

---

# 57. Deferred

Not frozen here:

- candidate ranking/model implementation;
- exact maximum pending proposals;
- exact proposal expiry;
- exact weekly scheduling;
- exact Introduction Profile fields;
- final proposal copy;
- exact progressive-image rendering method;
- pair re-proposal/cooldown policy;
- safety/report/block implementation;
- pricing;
- final Matching UI/visual design.

---

# 58. Freeze status

# `CW2-06 — CLOSED / FROZEN`

Next:

# `CW2-07 — Cross-World Navigation & Visual Integration`
