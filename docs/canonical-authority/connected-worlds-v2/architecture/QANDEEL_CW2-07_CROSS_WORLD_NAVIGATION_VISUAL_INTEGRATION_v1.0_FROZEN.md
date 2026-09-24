# QANDEEL — Connected Worlds v2
## CW2-07 — Cross-World Navigation & Visual Integration v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Connected Worlds navigation/integration architecture  
**Depends on:** CW2-01 through CW2-06 — CLOSED / FROZEN  
**Supersedes:** CW2-07 v0.1 and v0.2 drafts  
**Implementation:** NOT STARTED  
**Final graphic design:** NOT FROZEN

---

# 1. Foundational law

> **Each World has its own semantic geography.**

There is no universal semantic coordinate plane across:

- `MY_WORLD`
- `SHARED_WORLD`
- `PUBLIC_WORLD`

Cross-world adjacency is navigation truth, not semantic truth.

---

# 2. QANDEEL Universe Shell

`QANDEEL_UNIVERSE_SHELL`

owns:

- current Product context;
- World/artifact/capability transitions;
- Back/Home/Exact Return;
- viewer-scoped World view state;
- deep-link resolution;
- navigation authority revalidation.

It does not own World semantic truth.

---

# 3. Context taxonomy

```text
WORLD_CONTEXT
ARTIFACT_CONTEXT
CAPABILITY_CONTEXT
```

Examples:

```text
MY_WORLD       → WORLD_CONTEXT
SHARED_WORLD   → WORLD_CONTEXT
PUBLIC_WORLD   → WORLD_CONTEXT
REPLAY         → ARTIFACT_CONTEXT
MATCHING       → CAPABILITY_CONTEXT
```

Replay and Matching never become fake Worlds for navigation convenience.

---

# 4. Viewer-scoped navigation state

World-local navigation state is:

`VIEWER_SCOPED_NAVIGATION_STATE`

Conceptually:

```text
viewer
world_id
camera
semantic_zoom
focus
temporal_mode
temporal_value
disclosure_state
```

One user's camera/focus is not Shared World truth for another user.

---

# 5. Independent World-local state

Each World preserves its own:

- camera;
- focus;
- semantic zoom;
- temporal state;
- disclosure state.

Entering another World never overwrites the prior World's local navigation state.

---

# 6. Personal World non-regression

`MY_WORLD` retains frozen Living Analysis Map semantics:

- stable semantic geography;
- semantic zoom as disclosure;
- `FOLLOW_LIVE`;
- `PINNED(t)`;
- Exact Return;
- Return to Live Head;
- Return to Live Focus;
- no hindsight;
- truthful motion.

The Shell surrounds these semantics; it does not redefine them.

---

# 7. Return anchor

Leaving a World may create a viewer-scoped:

`WORLD_RETURN_ANCHOR`

containing the prior returnable local state.

A return anchor is navigation metadata only.

It grants no authority.

---

# 8. Authority-constrained Exact Return

Return resolution is:

```text
saved return anchor
∩ current audience authority
∩ current historical entitlement
∩ current object availability
∩ current temporal validity
```

Only the currently valid intersection may restore.

Deleted/inaccessible objects are never resurrected.

---

# 9. Temporal honesty on degraded return

If an old temporal state cannot be exactly restored:

- runtime must not pretend Exact Return succeeded fully;
- it must not silently switch `PINNED(t)` to `FOLLOW_LIVE`;
- any fallback preserves the semantic distinction that the original temporal view was unavailable.

Exact visual feedback is deferred.

---

# 10. Context Return Stack

`CONTEXT_RETURN_STACK`

records product-context history such as:

```text
MY_WORLD
→ SHARED_WORLD
→ REPLAY
→ SHARED_WORLD
→ MY_WORLD
```

It is:

- viewer-scoped;
- privacy-scoped;
- bounded;
- cycle-safe.

---

# 11. Privacy-safe return history

Return-stack references are protected internally.

Visible labels/previews are generated under current authority.

If detail is no longer authorized:

- render a generic safe label;
- or suppress the entry.

Navigation history is not a privacy exception.

---

# 12. Back / Home / Exact Return

Architecture distinguishes:

```text
BACK
HOME_TO_MY_WORLD
EXACT_RETURN
```

They are not one generic navigation command.

---

# 13. Local navigation vs World Transition

Architecture distinguishes:

```text
LOCAL_SEMANTIC_NAVIGATION
WORLD_TRANSITION
ARTIFACT_TRANSITION
CAPABILITY_TRANSITION
```

World Transition must not visually masquerade as panning across one universal semantic plane.

---

# 14. Viewer-scoped Shared World presence set

Presence state is:

`VIEWER_SCOPED_WORLD_PRESENCE_SET`

computed under current authority.

Existence itself may differ by viewer.

Presence cache/state is never globally reusable across users without authority/version isolation.

---

# 15. World Presence Projection

Shared World existence may be represented through:

`WORLD_PRESENCE_PROJECTION`

only under independent presence authority.

Presence is never inferred merely from:

- provenance;
- hidden history;
- semantic similarity;
- old analytical links.

---

# 16. Non-semantic presence layer

World presences occupy:

`NON_SEMANTIC_WORLD_PRESENCE_LAYER`

not the current World's semantic coordinate plane.

The exact visual morphology is not frozen here.

---

# 17. Non-semantic layout policy

Presence placement/scale/order follows:

`NON_SEMANTIC_LAYOUT_POLICY`

Unless Product explicitly declares otherwise, placement cannot encode hidden:

- semantic similarity;
- relationship strength;
- importance;
- popularity;
- private activity.

---

# 18. Presence vs relation vs provenance vs navigation

Architecture distinguishes:

```text
WORLD_PRESENCE
SEMANTIC_RELATION
SOURCE_PROVENANCE
NAVIGATION_LINK
```

These concepts require distinct semantics and must not be collapsed into one line/link type.

---

# 19. Shared World entry

Entry sequence:

```text
capture return anchor
        ↓
resolve target + authority
        ↓
PRE_AUTH_TRANSITION_SHELL
        ↓
ALLOW
        ↓
POST_AUTH_DESTINATION_RENDER
        ↓
restore valid viewer state
```

No destination content renders before authority ALLOW.

---

# 20. Pre-auth transition shell

Before authorization, transition visuals may show only neutral QANDEEL/world-boundary motion.

They may not render:

- content;
- semantic geometry;
- participant identity;
- topic;
- private activity.

---

# 21. Shared World state restoration

Returning to an active Shared World restores that viewer's valid local state.

Personal World coordinates/time do not transfer into Shared World.

Each Shared World maintains independent geography.

---

# 22. Closed Shared World navigation

A viewer with valid:

`CLOSED_WORLD_VIEW_ENTITLEMENT`

enters:

`READ_ONLY_HISTORICAL_VIEW`

Ordinary active-World controls remain unavailable.

Historical navigation is bounded by current entitlement and later owner deletions/privacy changes.

---

# 23. Public World entry

`PUBLIC_WORLD` is a genuine World Transition.

It loads its own semantic field.

It is not a feed overlay on Personal or Shared World.

---

# 24. Public viewer state

Viewer-scoped Public state may preserve:

- semantic region;
- focused Experience;
- semantic zoom;
- current lens/search projection.

Deleted Experiences cannot be resurrected by stored state.

---

# 25. Public audience policy at entry

Public destination content renders only after current `PUBLIC_AUDIENCE_POLICY` allows viewing.

Audience-policy changes do not alter Public World identity.

---

# 26. Replay navigation

Replay opens as:

`ARTIFACT_CONTEXT`

and captures a viewer-scoped:

`REPLAY_RETURN_ANCHOR`

to the context from which that viewer entered Replay.

Replay does not become World context.

---

# 27. Viewer-scoped Replay source return

Source-return affordances are derived per viewer.

Replay contains no globally reusable source-navigation authority.

Public viewer does not inherit owner's Personal/Shared source route.

---

# 28. Public Experience → Replay

Opening Replay from a Public Experience returns to that same Public context where still visible.

No hidden source-navigation affordance appears.

---

# 29. Authorized owner/source return

An authorized viewer opening Replay from a Personal/Shared source may return to their prior source-time/spatial view if still allowed.

Return remains authority-constrained.

---

# 30. Matching navigation

Matching remains `CAPABILITY_CONTEXT` hosted from `MY_WORLD`.

It has no:

- World map;
- top-level Dating geography;
- candidate-browsing navigation space.

---

# 31. Mutual Match transition

A successful Match:

- exits proposal capability context;
- creates one new Shared World;
- transitions into `ACTIVE / INTRODUCTION`.

The transition cannot imply two Personal Worlds merged.

---

# 32. Match Handoff boundary

The new Introduction may use only the bounded:

`MATCH_HANDOFF_PACKAGE_VERSION`

for its opening.

No private Matching context/provenance becomes destination World content automatically.

---

# 33. Introduction completion

`INTRODUCTION → STANDARD`

preserves:

- same World;
- same `world_id`;
- same history;
- same navigation identity.

No World replacement occurs.

---

# 34. Deep-link target identity

`NAVIGATION_TARGET`

binds:

```text
target_context_type
target_world_or_artifact
target_object
intended_audience_context
optional_source_context
```

Object ID alone is not enough.

---

# 35. Deep-link authority

Before rendering destination:

- authority;
- lifecycle;
- historical entitlement;
- intended audience context;
- current object visibility

are revalidated.

Deep links never grant access.

---

# 36. Deep-link privacy failure

If access changed:

- hidden target detail is not exposed;
- resolver uses neutral unavailable/fallback behavior.

No error string becomes a source of private data.

---

# 37. Notification boundary

Notification payload obeys recipient disclosure authority.

Notifications cannot leak:

- hidden Shared topic/content;
- Match rejection reason;
- secret participant identity;
- private World state.

---

# 38. Provenance navigation

Provenance and navigation are separate permissions.

A provenance marker may be:

- sealed;
- generic;
- non-clickable.

Seeing lineage never grants source entry.

---

# 39. Navigation edges are not semantic evidence

Cross-world movement records are typed:

`NAVIGATION_EDGE`

They are excluded from:

- semantic graph relations;
- provenance relations;
- analytical evidence;
- similarity truth.

User navigation does not create a semantic relationship between contexts.

---

# 40. Motion law

World Transition motion may explain:

- departure;
- context boundary;
- entry;
- orientation;
- return.

It may not imply:

- shared semantic coordinates;
- content merge;
- permission transfer;
- hidden destination truth.

---

# 41. Nothing teleports / no false continuity

> **Nothing teleports. Meaning resolves.**

Cross-world motion should preserve orientation without pretending the Worlds occupy one semantic plane.

A World boundary remains perceptible.

---

# 42. Reduced-motion parity

Reduced-motion behavior preserves:

- current context/World identity;
- origin/return understanding;
- temporal state;
- permission boundary.

Continuous motion may become stepped/static contextual transition.

---

# 43. State restoration order

Persistent navigation restore always follows:

```text
authority
→ visibility
→ temporal/object validity
→ navigation-state restore
```

Never restore first and check authority later.

---

# 44. Stored deleted/inaccessible focus

A stored focus on an unavailable object is not shown as a ghost.

Fallback is a nearest valid local state or safe World entry.

---

# 45. World-scoped time

Temporal state belongs to exact World.

Entering World B does not carry World A's `PINNED(t)`.

Returning to A may restore A's valid temporal state.

---

# 46. Public time distinction

Public freshness/vitality is not silently treated as Personal historical navigation.

Similar UI controls may exist only if their semantics remain explicit and non-conflicting.

---

# 47. Shared World semantic independence

Different Shared Worlds remain independently geocoded semantically.

Shared participants/provenance overlap does not create cross-world coordinate alignment.

---

# 48. Navigation telemetry

Navigation events may be recorded operationally.

They never become World semantic truth merely by existing.

---

# 49. Motion review requirement

This architecture is compatible with the frozen QANDEEL Motion Directive.

Production visual execution must still receive explicit animation/motion review.

Motion is a first-class Product pillar, but cannot override truth/privacy/navigation semantics.

---

# 50. Canonical invariants

`G1.` Each World has independent semantic geography.  
`G2.` Cross-world navigation never implies semantic adjacency.  
`G3.` Universe Shell owns navigation context, not World truth.  
`G4.` Navigation state is viewer-scoped, not Shared semantic truth.  
`G5.` Replay and Matching remain non-World contexts.  
`G6.` Each World preserves independent local viewer state.  
`G7.` Return anchors grant no authority.  
`G8.` Return restoration is current-authority/current-visibility constrained.  
`G9.` Degraded Exact Return cannot silently falsify temporal mode restoration.  
`G10.` Return-stack rendering obeys current privacy.  
`G11.` Context stack is bounded/cycle-safe.  
`G12.` World Presence is viewer-specific and independently authorized.  
`G13.` Presence is never inferred from provenance/hidden history.  
`G14.` Presence lives in a non-semantic layout domain.  
`G15.` Presence layout carries no undeclared semantic/social/private-activity meaning.  
`G16.` Presence, provenance, navigation and semantic relation are distinct concepts.  
`G17.` Destination content never renders before access ALLOW.  
`G18.` Closed World navigation is read-only and entitlement-bounded.  
`G19.` Public World remains an independent semantic World, not a feed overlay.  
`G20.` Back/Home/Exact Return remain distinct.  
`G21.` Replay source-return affordances are viewer-scoped.  
`G22.` Public Replay viewers cannot navigate into hidden source Worlds.  
`G23.` Matching has no independent World/map destination.  
`G24.` Mutual Match creates a real Shared World Transition.  
`G25.` Introduction completion changes phase, not World identity.  
`G26.` Deep links bind intended audience context and never grant authority.  
`G27.` Deep-link/notification failure cannot leak hidden details.  
`G28.` Navigation edges are not semantic/provenance evidence.  
`G29.` Motion cannot imply shared coordinates/content merge/permission transfer.  
`G30.` Reduced-motion preserves equivalent navigation truth.  
`G31.` Stored state cannot resurrect deleted/inaccessible objects.  
`G32.` Temporal state is World-scoped.  
`G33.` Shared Worlds remain semantically independent.  
`G34.` Navigation telemetry is not semantic truth.  
`G35.` Personal Living Analysis Map frozen navigation semantics remain unchanged.

---

# 51. Deferred

Not frozen here:

- final Shell UI;
- tabs/sidebar morphology;
- exact Shared World presence shape;
- final colors/materials/type;
- iconography;
- final animation curves;
- exact notification copy;
- exact screen layouts;
- production React Native navigation implementation.

---

# 52. Freeze status

# `CW2-07 — CLOSED / FROZEN`

Next:

# `CW2-08 — Safety, Moderation, Entitlements & Launch Integration`
