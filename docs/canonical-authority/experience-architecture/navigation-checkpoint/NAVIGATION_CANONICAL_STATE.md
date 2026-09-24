# QANDEEL Pan + Semantic Zoom Navigation v1 — Canonical State

## 4.1 — Spatial Navigation + Orientation — FROZEN

### Pan
Pan is camera movement through **one persistent Conversation World**. It may change viewport, scale, clipping and local projection, but it may not move canonical Home Anchors or re-layout the world.

### Three distinct focus/orientation facts
- **Live Focus:** where the current conversation is happening now.
- **Inspected Focus:** what the user is manually examining now.
- **Previous Inspection / Focus History:** meaningful prior inspection checkpoint(s) used for exact recovery.

Live Focus does not imply importance, confidence, recommendation, or centrality. Inspected Focus does not imply importance either.

### Return actions are semantically distinct
- **Return to Live Focus** — go to where the conversation is happening now.
- **Return to Previous / Original Inspection** — restore the preserved inspection context.
- **Return to World** — restore world-level orientation.
- **Back One Inspection Step** — unwind one inspection transition only.

These actions do not recompute analysis or geography.

### Orientation
At all times the experience must support answers to:
- Where am I?
- What am I inspecting?
- How deep am I?
- Where is the live conversation?
- What contains this?
- How do I return?

Minimap/world overview is helpful but **not the sole orientation mechanism**. Persistent landmarks, context lineage, focus-state distinction and return actions must also work.

### Direct addressability
Established Threads and inspectable canonical objects can be addressed directly. A direct jump must re-establish enough containing context to avoid an isolated object/screen.

### Narrow/mobile
Same canonical geography. Less simultaneous context is allowed. Stronger orientation aids are allowed. Canonical reflow is not.

---

## 4.2 — Semantic Zoom Disclosure — FROZEN

### Core rule
**SEMANTIC ZOOM ≠ OPTICAL MAGNIFICATION.**

A deeper level reveals information that was inappropriate or illegible at the previous depth. The canonical object does not change identity merely because its representation becomes richer.

### Canonical disclosure lineage
- **Z0 — World:** what exists, where it is, broad state/density, major session footprints, live/inspected focus.
- **Z1 — Thread:** what happened inside the Thread; Session footprints and locally appropriate context become clearer.
- **Z2 — Session / local analytical field:** what happened in the Session and how QANDEEL understood it; CU/source-bound material, provenance-sensitive Memory, Event, peer Readings, Unknown, Question and locally relevant impacts may be disclosed.
- **Z3 — Reading / analytical object:** what exactly QANDEEL is claiming and what grounds/challenges/qualifies it.
- **Deep Source / Provenance inspection:** where the grounding material came from; exact committed wording/provenance as entitled.

The number of rendered levels can be optimized later, but the conceptual lineage above is binding.

### Session disclosure
A Session opens **from within its Thread field**. No detached page, modal, drawer, dashboard or report is required by the canonical interaction.

### Reading vs Source
A Reading remains an interpretation. Inspecting a source reveals grounding/provenance **without transforming the Reading into Source Truth**.

### Peer Readings
Deeply inspecting R1 may make R1 the inspected object, but it does not make R1 the analytical winner. On return to Session level, peer Readings restore equal/unranked visual authority.

### Reversibility
World → Thread → Session → Reading → Source is reversible. Returning restores the exact previous spatial/inspection context rather than recomputing layout.

### Shared object at depth
Deeper inspection clarifies one canonical identity and provenance; it does not invent a primary Thread, extra canonical copy, or Shared Anchor.

### Historical material
A historical/superseded Reading remains then-valid in its historical context. Deeper inspection may explain later supersession without implying it was false all along.

---

## 4.3 — Focus, Return + Cross-Context Navigation — FROZEN

### One object, different contexts
A canonical object such as Memory M-27 can participate contextually in Work, Ahmed and Relationship with Ahmed.

The experience must distinguish:
- **Canonical object identity**
- **Current contextual appearance**
- **Other legitimate contextual appearances**

No arbitrary primary Thread is assigned.

### Context switching
Moving from `M-27 in Work context` to `M-27 in Ahmed context` means:

**SAME OBJECT + DIFFERENT CONTEXT.**

It is navigation between contextual appearances, not evidence, causality, or a Grounded Semantic Relation.

### Exact return
After cross-context navigation, **Return to Previous/Original Inspection** restores the exact prior chain, e.g.:

`Work → Session 12 → R1 → M-27`

including prior semantic depth and navigation context.

### Nested inspection history
The system can distinguish and recover from chains such as:

`World → Work → Session 12 → R1 → M-27 → Ahmed context → Event E4 → CU-9`

Back one step, original inspection, Live Focus, and World are different destinations.

### Live Focus divergence
Live Focus may change while the user manually inspects elsewhere. The system must not hijack the camera. Following Live Focus is explicit and must not erase preserved inspection history.

### Related object vs same object
Navigating to another appearance of the **same canonical object** is different from navigating to a **different object** connected through a grounded relation. UI/interaction must not collapse these meanings.

### Shared Anchor exception
Ordinary contextual appearances do not create a world-space hub. A Cross-Thread Shared Anchor is exceptional and valid only when the shared singular identity itself has independent persistent spatial-orientation value.

### Direct jump to multi-context object
No silent ownership choice. The landing behavior must truthfully expose available context or restore an explicitly preserved user context.

---

## 4.4 — Adversarial Navigation Validation — FROZEN

The final Red Team proof passed all 20 attacks:

1. Lost user recovery
2. Repeated Live Focus movement
3. Deep-return action differentiation
4. Same object / many contexts
5. Direct jump into deep object
6. Peer Reading restoration
7. Semantic-depth confusion / rapid depth traversal
8. 25+/50+/conceptually larger world scale
9. Dense truthful relations during navigation
10. Mobile / narrow navigation
11. Rotation / resize / device change
12. Emerging Focus provisional navigation
13. Dormant / Reopened same Thread identity and Home Anchor
14. Historical / Superseded object inspection
15. Ordinary sharing vs Shared Anchor exception
16. Orientation without minimap
17. Orientation with low label density
18. False-importance resistance
19. Rapid context switching
20. Navigation trope check

### Final Stage 4 decision

**QANDEEL PAN + SEMANTIC ZOOM NAVIGATION v1 — APPROVED / FROZEN / CLOSED.**

No Stage 4.x reopening is required before Stage 5.
