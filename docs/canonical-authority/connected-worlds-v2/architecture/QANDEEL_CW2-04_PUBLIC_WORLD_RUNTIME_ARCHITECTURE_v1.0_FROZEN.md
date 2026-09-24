# QANDEEL — Connected Worlds v2
## CW2-04 — Public World Runtime Architecture v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Public World runtime architecture  
**Depends on:** CW2-01 / CW2-02 / CW2-03 frozen contracts  
**Supersedes:** CW2-04 v0.1 and v0.2 drafts  
**Implementation:** NOT STARTED

---

# 1. Public World identity

`PUBLIC_WORLD` is one logical singleton semantic World.

It is not a collection of user-owned communities and not a chronological feed.

Its primary public object is:

`PUBLIC_EXPERIENCE`

A Public Experience is not a World.

---

# 2. Experience identity/version separation

Architecture separates:

```text
PUBLIC_EXPERIENCE
- stable experience_id

PUBLIC_EXPERIENCE_VERSION
- immutable experience_version_id

PUBLICATION_PACKAGE_MANIFEST
- immutable package_manifest_version
```

Material updates normally create a new version while preserving stable Experience identity.

---

# 3. Experience lifecycle

```text
DRAFT
READY_FOR_REVIEW
PUBLISHED
ABSENT_FROM_PUBLIC_WORLD
```

Only `PUBLISHED` participates in Public World projections.

Draft/review states do not widen audience.

---

# 4. Publication package

Each publish/update binds to an immutable package containing the exact authorized public payload.

Eligible payload may include:

- human text;
- voice/audio;
- selected QANDEEL analysis;
- Replay artifact;
- bounded public metadata.

Protected payload changes create a new manifest/version and new current authority evaluation.

---

# 5. Source isolation

Authorized source may come from:

```text
MY_WORLD
SHARED_WORLD
REPLAY_ARTIFACT
```

Publication creates a bounded public derivative.

It never creates navigation/access back into hidden source Worlds, Sessions, omitted material or future source updates.

---

# 6. Shared-source rights

Required publication approvals derive from included protected material.

Shared membership alone creates neither:

- automatic veto over unrelated material;
- ownership of the Public Experience.

---

# 7. Experience control vs content rights

Architecture separates:

```text
EXPERIENCE_CONTROL_AUTHORITY
CONTENT_RIGHTSHOLDER_SET
```

Experience control governs the public container.

Content rightsholders retain authority interests over their included protected source portions.

Consent to include material does not automatically create Experience control.

Experience control does not erase underlying material rights.

---

# 8. QANDEEL analysis publication

Selected QANDEEL analysis may be intentionally published when its exact authority requirement set is satisfied.

Published analysis becomes public content.

Public QANDEEL may reason from the published analysis itself.

It may not traverse sealed provenance to retrieve hidden private evidence.

---

# 9. Public identity

Public authorship binds internally to:

`PUBLIC_IDENTITY_REF`

Public rendering uses:

`PUBLIC_DISPLAY_LABEL`

The display label may be pseudonym or chosen real name.

`PUBLIC_IDENTITY_REF` is distinct from:

- private account identifier;
- Shared invite credential;
- contact endpoint.

Historical alias-label rendering remains deferred.

---

# 10. Alias non-semantic rule

Alias/display identity metadata is excluded from semantic-placement meaning unless intentionally included as Experience content.

Alias change alone:

- does not move an Experience;
- does not create a content version;
- does not alter semantic meaning.

---

# 11. Public audience policy

Public World identity is independent from who is currently eligible to view it.

Viewing is gated by:

`PUBLIC_AUDIENCE_POLICY`

Current Product direction may require registered membership.

Signed-out viewing remains unresolved without affecting World/Experience architecture.

---

# 12. Semantic interpretation

Each publishable version receives a bounded semantic interpretation based only on its public package.

No hidden Personal/Shared/Matching context may influence public placement/classification.

---

# 13. Publisher correction

Publisher may clarify/correct interpretation.

Correction is truth-constrained input, not arbitrary map control.

Placement must remain consistent with published material.

---

# 14. Semantic placement

`SEMANTIC_PLACEMENT`

binds to exact `experience_version_id`.

Meaning determines geography.

Activity, popularity, views and reply volume do not directly move the Experience.

---

# 15. Multi-theme meaning

An Experience may occupy an in-between semantic location representing several real themes.

Spatial proximity represents semantic similarity only.

---

# 16. Explicit relation lines

A visible relation requires:

`EXPLICIT_PUBLIC_RELATION`

with public evidence, relation type, endpoint/version validity and current validity state.

Similarity alone is not enough.

Invalid/deleted supporting truth removes the public relation rendering.

---

# 17. Experience updates

Material update:

```text
new package manifest
→ new Experience Version
→ new semantic interpretation
→ publisher review
→ placement validation/commit
```

Discussion activity alone never triggers semantic reposition.

---

# 18. Public discussion

Each Experience may have one dependent:

`PUBLIC_DISCUSSION_THREAD`

It:

- is not a World;
- is not a DM surface;
- has no independent public existence without its parent.

---

# 19. Replies

v1 supports:

```text
TEXT_REPLY
VOICE_REPLY
```

Reply commit requires parent Experience still be currently `PUBLISHED`.

Deletion winning the race prevents orphan reply publication.

---

# 20. Discussion entitlement

Current Product direction:

`reply/comment requires Premium entitlement`

This is separate from privacy/material authority.

Premium status cannot unlock hidden/private information.

---

# 21. @qandeel boundary

Public QANDEEL may use only currently public-visible:

- Experience content;
- discussion content;
- relation context;
- required public metadata.

It may not use:

- Personal context;
- Shared hidden context;
- Matching context;
- sealed provenance sources;
- deleted/non-public thread records.

---

# 22. Public QANDEEL response

A public QANDEEL response is public discussion material.

It is not a private user↔QANDEEL conversation.

The invoking user's private QANDEEL history does not enrich that response.

---

# 23. No direct contact

No Public World capability creates direct person-to-person contact with Experience owner.

Public identity presentation is not contact authority.

No phone/email/Shared credential/private account endpoint is exposed by publication or discussion.

---

# 24. Replay ownership boundary

Only authorized Experience control owner(s) may initiate a new Replay from that Experience under Replay rules.

Viewers cannot remix/rebuild a Replay from another person's Experience, even if they can view/share the existing Experience or Replay.

---

# 25. Vitality state

Activity is modeled separately as:

`PUBLIC_VITALITY_STATE`

It may represent freshness/momentum/discussion/voice activity.

Vitality is not truth, importance or semantic meaning.

---

# 26. Cooling/reactivation

An Experience may cool after inactivity and reactivate after renewed public activity.

Cooling/reactivation changes prominence/vitality only.

It never deletes content or changes semantic geography by itself.

---

# 27. Search/lenses/panels

Search, lenses and contextual panels are projections over the same Public World.

They do not define new Worlds or canonical semantic positions.

They operate only on public-visible material.

---

# 28. Canonical public visibility

All serving surfaces obey one canonical:

`PUBLIC_VISIBILITY_STATE`

or equivalent authority.

Stale indexes/caches cannot re-expose content whose canonical state is absent.

---

# 29. Owner deletion

Authorized Experience deletion transitions:

```text
PUBLISHED
→ ABSENT_FROM_PUBLIC_WORLD
```

Public result:

- absent from map;
- absent from search;
- absent from lenses/panels;
- public direct link reveals no Experience content/details;
- discussion not public;
- relation edges not public;
- no public tombstone.

Internal legal/safety/audit records remain outside Public World semantics.

---

# 30. Relation cleanup

Deleted Experience causes public edges to/from it to disappear.

Surviving Experiences retain their own truth/content.

No visible ghost node/placeholder is required.

---

# 31. Source later unavailable

Each Experience maintains:

```text
SOURCE_AVAILABILITY_STATE
DERIVATIVE_CLASSIFICATION
```

If source later becomes unavailable:

- source cannot be reconstructed;
- provenance cannot be traversed into hidden material;
- future updates cannot rely on missing source;
- current public visibility follows explicit canonical policy.

CW2-04 does not invent automatic retroactive withdrawal solely because source availability changed.

---

# 32. Provenance

Internal provenance binds to the exact authorized package.

Audience-visible provenance is separately governed.

Provenance provides evidence lineage, never source-access permission.

---

# 33. Public temporal/version truth

Runtime preserves:

- initial publication time;
- each version publication time;
- semantic-placement version;
- reply time;
- QANDEEL-response time;
- relation validity time;
- vitality transitions.

Current rendering never mixes versions into false chronology.

---

# 34. Concurrency

Stale operations fail/re-evaluate on:

- approval changes;
- package changes;
- parent deletion;
- version changes;
- relation invalidation;
- visibility changes.

No stale public state silently commits.

---

# 35. Canonical invariants

`D1.` Public World is one logical singleton World.  
`D2.` Public Experience is an object, not a World.  
`D3.` Experience identity, version identity and package manifest identity are distinct.  
`D4.` Draft/review states are non-public.  
`D5.` Publication binds exact current authority to exact manifest.  
`D6.` Publication never opens source-World access.  
`D7.` Shared-source rights derive from included protected material, not membership alone.  
`D8.` Experience control and source-material rights are distinct.  
`D9.` Selected QANDEEL analysis may be public without exposing hidden reasoning/evidence.  
`D10.` Public identity uses stable internal ref + mutable public display label.  
`D11.` Public identity is not a contact endpoint.  
`D12.` Alias changes do not alter semantic meaning/placement.  
`D13.` Public audience eligibility is policy, not World identity.  
`D14.` Semantic interpretation uses public package only.  
`D15.` Publisher correction is truth-constrained.  
`D16.` Semantic placement binds to exact Experience Version.  
`D17.` Activity/discussion does not move geography by itself.  
`D18.` Semantic proximity does not create explicit relation lines.  
`D19.` Explicit relation edges require public evidence/version validity.  
`D20.` Discussion is parent-dependent and not a DM/World.  
`D21.` Replies require live public parent at commit.  
`D22.` Current direction requires Premium entitlement to reply/comment.  
`D23.` Public QANDEEL uses only public-visible context.  
`D24.` Public QANDEEL cannot dereference sealed provenance.  
`D25.` Viewers cannot create new Replay from another owner's Experience.  
`D26.` Vitality is distinct from semantic meaning/placement.  
`D27.` Cooling/reactivation never changes truth/geography by itself.  
`D28.` Search/lenses/panels are projections over one Public World.  
`D29.` Canonical visibility overrides stale indexes/caches.  
`D30.` Owner deletion produces complete public disappearance with no tombstone.  
`D31.` Deletion removes public discussion/relations without rewriting surviving truth.  
`D32.` Source unavailability cannot create hidden-source reconstruction/access.  
`D33.` Source unavailability alone does not invent retroactive withdrawal policy.  
`D34.` Public temporal/version truth is preserved.  
`D35.` Stale public operations cannot silently commit.

---

# 36. Deferred

Not frozen here:

- signed-out access;
- historical Alias label rendering;
- exact semantic model/coordinates;
- lens algorithms/ranking;
- moderation/report/block;
- exact Premium implementation;
- historical version browsing;
- source-right withdrawal/recall policy after publication;
- final visual composition/motion.

---

# 37. Freeze status

# `CW2-04 — CLOSED / FROZEN`

Next:

# `CW2-05 — Replay Runtime Architecture`
