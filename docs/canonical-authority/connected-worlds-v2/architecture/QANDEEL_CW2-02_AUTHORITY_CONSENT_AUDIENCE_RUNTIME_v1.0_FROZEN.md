# QANDEEL — Connected Worlds v2
## CW2-02 — Authority, Consent & Audience Runtime v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Connected Worlds v2 authority/privacy constitution  
**Depends on:** `CW2-01 — World & Capability Architecture v1.0 — CLOSED / FROZEN`  
**Supersedes:** CW2-02 v0.1 and v0.2 drafts  
**Implementation:** NOT STARTED

---

# 1. Purpose

CW2-02 defines one deterministic authority runtime for Connected Worlds v2.

For every protected use of knowledge, material, history, identity or audience expansion, QANDEEL must resolve:

> **Who may perform which protected action, using which source, for which exact audience and purpose, under which current authority state?**

The decision is owned by canonical runtime state.

Provider output has no independent QANDEEL authority.

---

# 2. Canonical conceptual separation

```text
CONSENT
= human act expressing agreement

APPROVAL
= agreement to one exact proposed operation/package

GRANT
= bounded permission state derived from valid consent/policy

AUTHORITY
= current effective right to perform one requested action

AUDIENCE
= exact recipients allowed to receive/observe the result

ENTITLEMENT
= commercial/product feature eligibility

MATERIAL AUTHORITY
= authority over protected source material
```

These concepts never collapse into one boolean.

Commercial entitlement can never manufacture privacy authority.

---

# 3. Authority identities

Every protected operation distinguishes:

```text
INITIATOR
AUTHORITY_PRINCIPAL(S)
SYSTEM_EXECUTOR
TARGET_AUDIENCE
```

A system actor initiating an operation does not inherit human consent authority.

---

# 4. Canonical AuthorityRequest

Conceptually:

```text
AuthorityRequest {
  initiator
  authority_principals
  system_executor
  action
  source_refs
  target_ref
  world_ref?
  capability_ref?
  audience
  purpose
  requested_scope
  package_manifest_version?
  proposed_mutation_version?
  timestamp
}
```

Canonical server state validates/enriches request data.

Client-provided permission claims are never final authority.

---

# 5. Decision result

```text
ALLOW
DENY
UNKNOWN
```

`ALLOW` may carry strict bounded constraints.

`UNKNOWN` fails closed.

DENY and UNKNOWN both block the protected operation externally, while remaining distinct internally for audit/debugging.

---

# 6. Authority Snapshot and Audience Snapshot

Every protected operation binds to:

```text
AUTHORITY_SNAPSHOT
AUDIENCE_SNAPSHOT
```

Relevant state may include:

- membership;
- membership topology;
- history grants;
- permission grants;
- material authority;
- source availability;
- governance approvals;
- package versions;
- exact audience.

Before delivery or irreversible commit:

> **Authority and Audience are revalidated.**

A result cannot be rerouted to a different/broader audience under the old decision.

---

# 7. Authority Request Fingerprint

Every ALLOW decision is bound to an immutable authority-relevant request identity:

`AUTHORITY_REQUEST_FINGERPRINT`

or equivalent mechanism.

It binds at least:

- action;
- source scope;
- target;
- audience snapshot;
- purpose;
- package/proposed mutation version when applicable;
- authority snapshot.

An ALLOW decision is not a reusable bearer permission.

It cannot authorize a materially different request.

---

# 8. Revocation before delivery

Canonical rule:

> **If relevant authority is withdrawn before protected delivery/commit, the stale result is not grandfathered merely because computation already occurred.**

Runtime must block, discard or regenerate under current authority.

Already delivered historical outputs are not silently rewritten unless a separate canonical Product rule requires removal.

---

# 9. Preview does not reserve authority

Preview answers:

> "What would be allowed under this preview snapshot?"

It does not lock or reserve:

- consent;
- membership;
- material ownership;
- distribution authority;
- target audience.

Commit always performs current authority evaluation.

---

# 10. Consent event history vs effective grant state

Architecture separates:

```text
CONSENT_EVENT_LOG
= append-only historical truth about grant/decline/revoke/approve actions

EFFECTIVE_GRANT_STATE
= current derived permission state
```

Revocation does not erase historical consent events.

Historical consent does not remain effective after current grant state says otherwise.

---

# 11. Grant model

Conceptual grant:

```text
AuthorityGrant {
  grant_id
  grant_type
  grantor
  authorized_actor_or_system
  source_scope
  target_scope
  audience_scope
  purpose_scope
  action_scope
  valid_from
  valid_until?
  revocation_policy
  current_status
  originating_consent_event
}
```

Exact persistence schema is deferred.

---

# 12. Grant composition

Authority is computed for the exact requested action.

A grant may contribute only when its relevant dimensions match:

- source;
- target;
- audience;
- purpose;
- action;
- current validity.

There is no generic permissive union.

Two narrow grants cannot be combined to manufacture one broader permission that nobody approved.

---

# 13. Canonical grant/authority families

Architecture supports at least:

```text
STANDING_CONTEXT_GRANT
ONE_TIME_DISCLOSURE_GRANT
HISTORY_ACCESS_GRANT
PUBLICATION_APPROVAL
REPLAY_CREATION_AUTHORITY
REPLAY_DISTRIBUTION_APPROVAL
GOVERNANCE_APPROVAL
INTRODUCTION_DISCLOSURE_GRANT
MATCHING_CONTEXT_GRANT
```

Some effective authorities may derive directly from canonical ownership/membership/policy rather than a literal grant row.

All protected decisions still pass through the normalized authority runtime.

---

# 14. Context classification

Candidate context is labeled for the exact audience/purpose as:

```text
PUBLIC_CONTEXT
WORLD_NATIVE_CONTEXT
HISTORY_GRANTED_CONTEXT
PRIVATE_REASONING_ONLY_CONTEXT
DIRECTLY_DISCLOSABLE_PRIVATE_CONTEXT
FORBIDDEN_CONTEXT
```

Labels are authority-contextual, not timeless global properties.

---

# 15. Shared native/history context audience-intersection rule

For a QANDEEL output addressed to multiple Shared participants:

> **ordinary Shared World/history material may enter the model context only if every recipient in the current Audience Snapshot is authorized to access it.**

A new member with `FROM_JOIN_FORWARD` therefore cannot receive hidden prior history indirectly through QANDEEL's group answer.

No general hidden-history reasoning exception exists in v1.

---

# 16. Approved private-reasoning exception

Participant-owned `MY_WORLD` context may enter a Shared model call as:

`PRIVATE_REASONING_ONLY_CONTEXT`

only under a valid:

`STANDING_CONTEXT_GRANT`

This is the explicit Product-approved exception.

It may influence analysis/advice.

It does not authorize source disclosure.

---

# 17. Standing Context Grant

Scope includes:

```text
grantor = exact participant
source = grantor's MY_WORLD
target = exact SHARED_WORLD
purpose = QANDEEL reasoning in that World
audience_ceiling = human audience authorized at grant/extension time
```

Requested just-in-time when first actually needed.

The request itself is private to the grantor.

The grant does not authorize:

- source copying;
- direct quote;
- source-specific private fact disclosure;
- private-source attribution;
- provenance disclosure to unauthorized participants.

---

# 18. Standing Grant audience ceiling

Shared membership expansion does not automatically expand a Standing Context Grant.

If the Shared human audience grows beyond the grant's authorized audience ceiling:

```text
old grant
→ insufficient for outputs to the expanded audience
```

The grantor must explicitly extend/reconfirm private-context reasoning authority for the broader audience.

No membership change silently widens private-context use.

---

# 19. Reasoning authority vs disclosure authority

Canonical separation:

```text
REASON_FROM_PRIVATE_CONTEXT
≠
DISCLOSE_PRIVATE_FACT
```

Direct private-source disclosure requires separate bounded authority.

Reasoning-only context may influence higher-level advice without per-inference permission prompts.

---

# 20. Narrow Source Disclosure Gate

Before multi-person delivery, runtime prevents unauthorized:

- private quotes;
- direct protected source facts;
- source-specific attribution;
- sealed-provenance disclosure.

The gate does not treat every higher-level inference influenced by private context as an explicit disclosure.

This preserves the Product decision to keep QANDEEL useful without asking permission for every indirect influence.

---

# 21. Pre-model authority sequence

```text
Resolve World / capability
        ↓
Resolve exact Audience Snapshot
        ↓
Collect candidate context
        ↓
Evaluate each context item for this audience/purpose
        ↓
Exclude DENY / UNKNOWN
        ↓
Label reasoning-only and disclosure constraints
        ↓
Build bounded authorized provider envelope
```

Protected context does not enter the provider merely because it is useful.

---

# 22. Delivery sequence

```text
Provider output
    ↓
Source Disclosure Gate
    ↓
Authority Snapshot revalidation
    ↓
Audience Snapshot revalidation
    ↓
System / Safety policy check
    ↓
Deliver / commit
```

If authority/audience is stale, the old result does not silently deliver.

---

# 23. Provider retry/fallback

Retries and fallback providers inherit the same or stricter:

- Authority Snapshot;
- Audience Snapshot;
- context set;
- context labels;
- non-disclosable constraints;
- target audience.

Fallback failure handling cannot broaden protected context or audience.

If authority becomes stale before retry, reevaluate first.

---

# 24. Provenance truth vs provenance disclosure

Internal dependency truth remains complete.

Audience visibility is separately authorized.

A private dependency may be recorded internally as:

`SEALED_PROVENANCE_DEPENDENCY`

while unauthorized participants receive no source identity/existence detail.

Sealing provenance is not deleting or falsifying provenance.

---

# 25. Material authority

Protected human-authored material has an authority owner or authority requirement set.

Membership alone does not create ownership over another participant's material.

Material authority may govern:

- owner deletion;
- public publication;
- Replay distribution;
- explicit disclosure;
- historical sharing;
- inclusion in derived artifacts.

---

# 26. QANDEEL analysis authority requirements

Publishable/redistributable QANDEEL analysis carries an:

`AUTHORITY_REQUIREMENT_SET`

derived from the protected human material/subjects actually implicated in the selected analysis.

The requirement set is not automatically every World member.

Exact derivation rules belong to the later Shared/Public/Replay domain contracts.

---

# 27. Owner deletion and derivative classes

Derived objects distinguish at least:

```text
SOURCE_CONTENT_BEARING_DERIVATIVE
ANALYTICAL_DERIVATIVE
```

Owner deletion:

- excludes source from future model use;
- prevents QANDEEL reconstruction;
- invalidates future QANDEEL access/use of source-content-bearing internal derivatives unless a later explicit rule preserves them;
- does not automatically erase legitimate historical analytical derivatives;
- marks provenance as `SOURCE_UNAVAILABLE`.

Exact Replay rendering/redaction behavior belongs to CW2-05.

---

# 28. History access

New Shared member default:

`FROM_JOIN_FORWARD`

Past access requires explicit bounded authority.

A `HISTORY_ACCESS_GRANT` is scoped by:

- grantee;
- source World;
- historical scope;
- authority basis;
- current policy state.

---

# 29. Selective historical package

Selective past sharing uses an immutable:

`HISTORY_PACKAGE_MANIFEST_VERSION`

Its:

`REQUIRED_HISTORY_APPROVER_SET`

is derived from the exact included material.

Consequences:

- one participant cannot share another participant's protected historical material by World membership alone;
- mixed-owner history requires the exact union of required authorities;
- changing package content creates a new manifest/version;
- old approval does not authorize changed content.

---

# 30. Selective-history privacy

Unauthorized older material:

- is not admitted into group context;
- does not require ghost placeholders;
- does not automatically reveal that hidden history exists.

---

# 31. Rejoin

Effective access after rejoin is composed from:

```text
new active membership
+ authorized prior membership-period history
+ explicit absence-period grants
```

The absence interval does not automatically open.

---

# 32. Grant-specific revocation

There is no universal retroactive revocation rule.

Examples:

### Standing Context Grant
Revocable for future reasoning.

### Matching Context Grant
Revocable/pausable for future Matching use.

### One-time disclosure already delivered
Later source permission changes do not silently erase delivered Shared history.

### History Access Grant
Withdrawal after delivery is deferred to Shared domain policy.

### Already externally distributed artifact
Recall/withdrawal semantics are deferred to the relevant domain contract.

---

# 33. Shared governance policies

Architecture supports policies such as:

```text
ALL_CURRENT_MEMBERS
ALL_CURRENT_MEMBERS_EXCEPT(target)
```

Current Product examples:

- World identity/settings change → all current members;
- add member → all current members before invite;
- remove member → all current members except target;
- end World → all current members;
- rejoin → all current members.

---

# 34. Governance approval binding

Governance approval binds to:

```text
exact operation
exact proposed payload/version
exact membership snapshot
```

Approval is never a reusable generic consent token.

If membership or the proposed mutation changes, approvals must be recalculated/recollected.

---

# 35. Voluntary leave

Voluntary leave is an individual authority.

It requires no group approval.

Commit:

- ends the current membership episode;
- ends current access;
- preserves historical authorship;
- invalidates future use of grants whose scope requires that active World relationship, according to grant policy.

Leave does not erase history.

---

# 36. Replay creation vs distribution

Architecture separates:

```text
REPLAY_CREATE
REPLAY_DISTRIBUTE
```

Internal creation authority does not imply public/external distribution authority.

---

# 37. Immutable package approval

Public Experience and distributable Replay approval binds to an immutable:

`PACKAGE_MANIFEST_VERSION`

Changing protected payload produces a new version and requires current authority evaluation plus any newly required approvals.

---

# 38. Multi-owner distribution

For an immutable package:

```text
REQUIRED_APPROVER_SET
= union(authority requirements of included protected portions)
```

Distribution is ALLOW only when every required approval matches the exact current manifest.

Unincluded material creates no approval requirement.

Mere World membership creates no automatic veto.

---

# 39. Publication

Public publication is explicit audience expansion.

Before commit runtime checks:

- actor/principal authority;
- exact package manifest;
- included source availability;
- required authority set;
- current approvals;
- public target audience;
- policy/entitlement where applicable.

Preview never substitutes for commit-time authority.

---

# 40. Public deletion

Authorized deletion removes the Public Experience from Public World.

No public tombstone remains.

Internal audit/safety records are not Public audience access.

---

# 41. Matching Context Grant

Scope:

```text
grantor = user
source = user's self-authored MY_WORLD knowledge
target = Matching capability
purpose = candidate selection + safe compatibility reasoning
```

It does not transfer to Shared World after Mutual Match.

---

# 42. Introduction Profile

First-stage candidate disclosure uses the user's pre-authorized bounded:

`INTRODUCTION_PROFILE`

Private Matching context may influence safe compatibility explanation without exposing protected evidence.

---

# 43. Progressive disclosure

Each resource disclosure is independently authorized.

Examples:

- partial image;
- full image;
- full name;
- contact method;
- other personal field.

Audience = exact counterpart.

One person's disclosure never creates reciprocal authority.

QANDEEL suggestion is not authorization.

---

# 44. Audience computation

Every protected action has an explicit effective audience, such as:

```text
one user
exact Shared participant set
bounded subset
Public World audience
external target
```

Audience is never inferred solely from the UI surface.

---

# 45. Entitlement separation

Commercial/Product entitlement is conjunctive, never overriding.

Example:

```text
PUBLIC_COMMENT_ALLOWED
=
commercial entitlement
AND public participation policy
```

Entitlement cannot grant private/history/material authority.

---

# 46. Safety/system policy composition

Privacy/ownership authority is necessary but not always sufficient.

Effective execution requires:

```text
PRIVACY / OWNERSHIP AUTHORITY = ALLOW
AND
SYSTEM / SAFETY POLICY = ALLOW
AND
COMMERCIAL ENTITLEMENT = ALLOW (where required)
```

A hard safety/system policy may further restrict an action.

It can never manufacture missing human privacy authority.

No hard-authority layer converts another layer's DENY/UNKNOWN into ALLOW.

---

# 47. Error disclosure policy

Exact internal denial reason may itself be sensitive.

User-facing denial is governed by:

`ERROR_DISCLOSURE_POLICY`

It reveals only the minimum audience-safe explanation.

Example:

Internal:
`COUNTERPART_REVOKED_PRIVATE_GRANT`

External to unauthorized user:
`This action isn't currently available.`

---

# 48. Concurrency and stale-state law

Authority-sensitive commit rejects stale state.

Examples:

- permission revoked during generation;
- member leaves during response generation;
- new member joins and audience expands;
- source deleted during Replay render;
- approval withdrawn before publish;
- package changed after approval;
- membership changes during unanimous governance flow.

No stale authority state silently commits.

---

# 49. Audit

Protected decisions create internal audit metadata sufficient to explain:

- initiator;
- authority principal(s);
- action;
- target;
- audience;
- authority basis;
- decision;
- snapshot versions;
- request fingerprint;
- failure class.

Audit minimizes protected-content duplication.

---

# 50. Canonical scenario — private reasoning

Mohamed grants exact-World Standing Context permission.

For a response to the authorized Shared audience:

```text
USE_FOR_REASONING = ALLOW
DIRECT_PRIVATE_DISCLOSURE = DENY unless separately granted
PROVENANCE_DISCLOSURE = SEALED where required
```

QANDEEL may produce higher-level advice influenced by private context without prompting for every inference.

---

# 51. Canonical scenario — Shared audience expands

Mohamed granted private reasoning when Shared audience was `{Mohamed, Hadir}`.

Later a third participant joins.

For output audience `{Mohamed, Hadir, NewMember}`:

```text
old Standing Context Grant = insufficient
```

Mohamed must explicitly extend/reconfirm the private-context reasoning grant before his private context can influence output to the expanded audience.

---

# 52. Canonical scenario — hidden historical material

New member is `FROM_JOIN_FORWARD`.

Old Session S1 is visible to Mohamed/Hadir only.

For a group response including the new member:

```text
S1 = excluded from ordinary Shared model context
```

No indirect history leak through QANDEEL.

---

# 53. Canonical scenario — selective old-history sharing

Proposed historical package contains:

- Mohamed message;
- Hadir voice note;
- QANDEEL analysis based on both.

The history package manifest derives the exact required authority set.

No single member can authorize the whole package merely by being a World member.

---

# 54. Canonical scenario — source deletion during generation

Source is available at model-call start.

Owner deletes before protected delivery.

Snapshot becomes stale.

Old result does not automatically deliver.

Future source use/reconstruction is denied.

---

# 55. Canonical scenario — changed Replay after approval

Replay manifest v3 is approved.

Protected payload changes → manifest v4.

v3 approvals do not authorize v4.

The new manifest requires current authority evaluation.

---

# 56. Canonical scenario — hard safety denial

Every human authority requirement is satisfied for an action.

A canonical Safety/System policy blocks the action.

Result:

`DENY`

Privacy consent does not override Safety.

Conversely, Safety cannot create missing privacy consent.

---

# 57. Canonical invariants

`B1.` Consent, approval, grant, authority, audience, entitlement and material ownership are distinct.  
`B2.` Initiator, authority principal and system executor are distinct.  
`B3.` Authority is action-, audience-, purpose- and current-state-specific.  
`B4.` UNKNOWN fails closed.  
`B5.` Protected operations bind Authority and Audience Snapshots.  
`B6.` ALLOW decisions are request-bound and non-transferable.  
`B7.` Authority/audience is revalidated before delivery/commit.  
`B8.` Preview never reserves authority.  
`B9.` Consent events are historical; effective grants represent current permission.  
`B10.` Grant scopes cannot be unioned to manufacture broader authority.  
`B11.` Ordinary Shared context in a group response must be visible to every response recipient.  
`B12.` Private reasoning-only context requires explicit canonical grant.  
`B13.` Standing private-context grants have an audience ceiling.  
`B14.` Membership expansion never silently widens private-context reasoning authority.  
`B15.` Reasoning authority never implies direct disclosure authority.  
`B16.` Higher-level private-context influence does not require per-inference consent.  
`B17.` Provenance truth may remain sealed from unauthorized audiences.  
`B18.` Material authority is independent from World membership.  
`B19.` Owner deletion excludes deleted source from future use/reconstruction.  
`B20.` Source-content-bearing derivatives and analytical derivatives are distinct.  
`B21.` Membership does not imply historical access.  
`B22.` Historical sharing authority derives from the exact historical package manifest.  
`B23.` Grant revocation semantics are grant-class specific.  
`B24.` Governance approval binds exact mutation + membership snapshot.  
`B25.` Derived creation authority does not imply distribution authority.  
`B26.` Distribution approval binds the exact immutable package manifest version.  
`B27.` Multi-owner approval derives from included protected material, not all World members by default.  
`B28.` Matching permission never transfers automatically to Shared World.  
`B29.` Progressive disclosure is resource-specific and non-reciprocal.  
`B30.` Commercial entitlement never overrides privacy authority.  
`B31.` Safety/system policy may narrow authority but never manufacture missing privacy authority.  
`B32.` Provider retries/fallbacks preserve the same or stricter authority envelope.  
`B33.` Error explanations cannot leak private consent state.  
`B34.` Stale authority state cannot commit.  
`B35.` Protected authority decisions are auditable with minimal protected-content duplication.

---

# 58. Deferred to later domain contracts

CW2-02 intentionally does not freeze:

- SQL/schema;
- API/service names;
- exact implementation of direct-source disclosure detection;
- grant TTL defaults;
- history-grant withdrawal after delivery;
- recall of externally distributed artifacts;
- Public Alias historical rendering;
- moderation/block/report policy;
- exact commercial tier matrix;
- domain-specific derivation of QANDEEL analysis authority sets;
- Replay redaction/render behavior after source deletion.

---

# 59. Freeze status

# `CW2-02 — CLOSED / FROZEN`

Any deliberate change to this authority/privacy constitution requires an explicit versioned superseding contract.

Next:

# `CW2-03 — Shared World Runtime Architecture`
