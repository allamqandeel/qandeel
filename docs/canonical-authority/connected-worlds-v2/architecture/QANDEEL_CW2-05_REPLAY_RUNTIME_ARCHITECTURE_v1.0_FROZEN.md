# QANDEEL — Connected Worlds v2
## CW2-05 — Replay Runtime Architecture v1.0

**Status:** CLOSED / FROZEN  
**Authority:** Canonical Replay runtime architecture  
**Depends on:** CW2-01 through CW2-04 — CLOSED / FROZEN  
**Supersedes:** CW2-05 v0.1 and v0.2 drafts  
**Implementation:** NOT STARTED

---

# 1. Replay identity

Replay is a source-bound, temporally truthful derived artifact.

Core Product law:

> **الصوت = ما حدث.**
>
> **الصورة = كيف فهمه قنديل.**

Replay is not:

- a World;
- an AI reenactment;
- a generic video editor;
- an independent truth source.

---

# 2. Stable identity and versions

Architecture separates:

```text
REPLAY
- stable replay_id

REPLAY_VERSION
- immutable replay_version_id

REPLAY_SOURCE_MANIFEST_VERSION
REPLAY_SELECTION_SPEC_VERSION
ANALYTICAL_PROJECTION_VERSION
RENDER_CONTRACT_VERSION
REPLAY_DISTRIBUTION_PACKAGE_VERSION
```

Truth/material-relevant changes create a new version.

---

# 3. Source manifest

Every Replay Version binds to exact authorized source material.

The source manifest identifies:

- source event/material identity;
- source version;
- original medium;
- source time;
- source availability;
- provenance;
- authority requirements;
- canonical temporal/knowledge constraints.

---

# 4. Source contexts

Replay may derive from authorized material in:

```text
MY_WORLD
SHARED_WORLD
owned PUBLIC_EXPERIENCE
```

Replay provenance never grants access to hidden source World content.

---

# 5. Original medium preservation

## Audio/call source

Use authorized:

`ORIGINAL_AUDIO`

Missing/deleted audio is never synthetically recreated as source truth.

## Text source

Use:

`ORIGINAL_TEXT_EVENT_STREAM`

## Mixed source

Each element preserves its original source medium.

---

# 6. QANDEEL original event

If QANDEEL originally spoke in audio, Replay uses the actual delivered audio artifact where available/authorized.

If original QANDEEL event was text, later generated voice cannot masquerade as that historical event.

---

# 7. Temporal model

Replay reuses canonical QANDEEL temporal truth.

It distinguishes:

- source/event time;
- knowledge availability;
- analytical version/projection validity;
- Replay render time.

Render time never grants hindsight.

Supersession never means historical knowledge ceased to have existed.

---

# 8. Analytical projection

Each Replay Version binds an immutable:

`ANALYTICAL_PROJECTION_VERSION`

It represents the truth-relevant QANDEEL analytical state over represented time.

A later model improvement cannot silently rewrite an already-finalized Replay's past understanding.

---

# 9. No-hindsight invariant

At represented time `t`, Replay may show only knowledge/analysis legitimately available and valid for projection at `t`.

Later confirmation, contradiction, correction or confidence change remains later.

---

# 10. Selection model

Replay v1 uses:

`REPLAY_SELECTION_SPEC_VERSION`

rather than a freeform professional editing timeline.

Allowed Product actions include:

- choose start/end;
- include segments;
- exclude segments;
- highlights;
- link non-contiguous real moments;
- natural-language selection.

---

# 11. Stable source anchors

Selections bind stable source-event/material identities and versions.

Raw timestamps alone are insufficient when source may be revised.

If selected source changes materially:

`selection = STALE`

and must be re-resolved/reviewed.

---

# 12. Semantic Cut Safety

Replay may never turn real source fragments into a false utterance.

Cuts must preserve necessary:

- negation;
- qualification;
- attribution;
- clause context.

Unsafe cuts are expanded, rejected or clarified.

---

# 13. Chronological order

Selected segments remain in real source chronological order.

User instruction order cannot reverse chronology to create false narrative.

---

# 14. Replay coverage class

Every Replay Version declares:

`REPLAY_COVERAGE_CLASS`

At minimum:

```text
FULL_SOURCE
SELECTED_EXCERPT
HIGHLIGHT_SELECTION
```

A selected Replay cannot imply that it represents the complete source.

Coverage truth does not require exposing what omitted private material contains.

---

# 15. Non-contiguous selections

Every non-contiguous join creates:

`REPLAY_TEMPORAL_DISCONTINUITY`

The omitted interval is machine-truth.

Renderer must make the discontinuity perceptible.

A gap may not masquerade as continuous source time.

---

# 16. Transition rule

Transitions may:

- orient;
- compress;
- signal passage;
- maintain visual continuity.

They may not:

- fabricate events;
- fake continuous speech;
- reverse chronology;
- invent analytical evolution.

---

# 17. Timing Semantic Integrity

Conversational timing can itself carry meaning.

Replay may compress passive time only when doing so does not materially change:

- hesitation;
- interruption;
- turn-taking;
- reaction timing;
- uncertainty;
- conversation meaning;
- analytical interpretation.

Meaningful pauses/timing are preserved or truthfully indicated as compressed.

---

# 18. Natural-language selection

Natural-language instructions operate only over authorized existing source.

If requested material cannot be confidently resolved:

```text
UNKNOWN / clarification required
```

Replay never hallucinates a likely source segment.

---

# 19. Lifecycle

Conceptual Replay lifecycle:

```text
DRAFT
PREVIEW_READY
FINALIZED
```

Distribution is a separate action.

A finalized Replay may remain private.

---

# 20. Draft and preview

Draft/preview:

- creates no new external audience;
- reserves no distribution right;
- is source/authority-version sensitive;
- may be regenerated.

Preview is never equivalent to distribution approval.

---

# 21. Creation authority

`REPLAY_CREATION_AUTHORITY`

governs Replay construction.

It is distinct from:

`REPLAY_DISTRIBUTION_AUTHORITY`

Creation does not widen audience.

---

# 22. Shared internal creation

An authorized Shared participant may create an internal Replay from material they are entitled to view under Product/runtime rules.

Internal creation does not imply Public/external distribution authority.

---

# 23. Shared external/public distribution

Required distribution approvers derive from exact included protected material:

```text
REQUIRED_REPLAY_DISTRIBUTION_APPROVER_SET
```

World membership alone creates no unnecessary approver.

---

# 24. Distribution Package

Distribution binds to immutable:

`REPLAY_DISTRIBUTION_PACKAGE_VERSION`

containing:

- exact Replay Version;
- exact source-bearing payload;
- destination class where relevant;
- exact authority requirements.

Changed Replay payload requires new current approvals.

---

# 25. Distribution-time revalidation

Every distribution act revalidates authority at the time of distribution.

Finalization never reserves future authority for:

- Public publication;
- external share;
- download.

---

# 26. Destinations

Separate distribution acts:

```text
PUBLISH_TO_PUBLIC_WORLD
SHARE_EXTERNALLY
DOWNLOAD
```

Authority for one does not imply another.

---

# 27. Public Experience boundary

Only authorized Experience control owner(s) may create a new Replay from a Public Experience.

Viewers cannot remix/rebuild another person's Experience.

Public provenance cannot unlock hidden private source.

---

# 28. Public publication

Publishing Replay to Public World creates a bounded Public Experience package under CW2-04.

Replay does not become a new World.

---

# 29. Source deletion before finalization

If required source becomes unavailable:

- stale selection/render cannot finalize;
- source-bearing material cannot be reconstructed;
- runtime must fail or regenerate from remaining valid source with user awareness.

---

# 30. Source deletion during render

Render/finalization revalidates source availability.

If source changes/deletes mid-render:

- stale render cannot commit automatically;
- no synthetic replacement is allowed.

---

# 31. Source unavailable after finalization

Replay records source availability and derivative classification.

Rules:

- hidden/deleted source cannot be reconstructed/dereferenced;
- new Replay Versions cannot rely on unavailable source;
- new distributions revalidate current policy/authority.

Replay cannot guarantee recall of already-exported external copies.

Replay architecture does not invent automatic Public withdrawal solely because source later became unavailable unless a later canonical rule requires it.

---

# 32. Source-content vs analysis layers

Replay elements are classified as needed between:

```text
SOURCE_CONTENT_BEARING_LAYER
ANALYTICAL_VISUAL_LAYER
```

This preserves correct deletion/provenance behavior.

---

# 33. Provenance

Every source/visual element retains lineage to:

- exact source/version;
- represented time;
- analytical state/version;
- authority basis;
- source availability.

Audience-visible provenance may be sealed.

Provenance never grants source access.

---

# 34. Render determinism

A finalized Replay Version binds all truth-relevant render inputs:

```text
source_manifest_version
selection_spec_version
analytical_projection_version
render_contract_version
```

Re-rendering must preserve semantic/temporal equivalence.

Truth-relevant renderer change requires a new validated version.

---

# 35. Render Contract

`RENDER_CONTRACT_VERSION` governs truth-preserving rendering of:

- original media;
- text timing;
- analytical visuals;
- discontinuities;
- transitions;
- timing compression;
- motion;
- captions;
- accessibility/reduced motion.

---

# 36. Living Analysis Map truth

Replay may reuse Living Analysis Map visual grammar only when canonical runtime truth supports it.

It preserves:

- semantic relationships valid at represented time;
- no invented relation lines;
- no future knowledge;
- analytical version validity;
- truthful disclosure state;
- motion as explanation rather than fabrication.

---

# 37. Camera/emphasis

Camera focus and semantic zoom may direct attention.

They do not create new importance, relation or truth.

---

# 38. Text rendering

Source text remains exact.

Compression/pacing cannot create false continuity or alter source meaning.

Semantic Cut Safety and temporal discontinuity rules apply.

---

# 39. Audio rendering

Original audio remains primary source truth.

Allowed only where semantically safe:

- truthful clipping;
- simple crossfade;
- passive-time compression.

Forbidden:

- synthetic missing speech;
- source-word manipulation that creates false utterance;
- removal of meaningful timing that changes interpretation.

---

# 40. Caption/transcript provenance

Architecture distinguishes:

```text
SOURCE_TRANSCRIPT
DERIVED_CAPTION
DERIVED_TRANSCRIPT
```

Derived accessibility text is not promoted to original source-event truth.

---

# 41. Mixed media

Mixed Replay may synchronize original audio, original text and analytical visuals while retaining source identity and temporal alignment for each element.

---

# 42. Replay editorial annotation

Architecture distinguishes:

```text
SOURCE_EVENT_CONTENT
REPLAY_EDITORIAL_ANNOTATION
```

Any later generated explanation/narration added for Replay must be clearly separate from original conversation truth.

It may never masquerade as something actually said at source time.

---

# 43. No synthetic source event

Replay cannot invent:

- human speech;
- QANDEEL speech;
- conversation turns;
- human reactions;
- historical analytical state;
- fake reenactment represented as source event;
- false temporal continuity.

---

# 44. Accessibility parity

Accessibility transformations preserve equivalent semantic and temporal truth.

---

# 45. Reduced-motion parity

Reduced-motion may replace continuous animation with stepped/static cues.

It must preserve:

- chronology;
- analytical change;
- relationship truth;
- uncertainty/confidence where relevant;
- no-hindsight.

---

# 46. Export Privacy Sanitization

Every Public/external/download Replay artifact passes:

`EXPORT_PRIVACY_SANITIZATION`

Exported metadata may include only audience-authorized information.

It must not leak:

- private World IDs;
- internal account IDs;
- hidden participant IDs;
- private source paths;
- source URLs;
- sealed provenance;
- internal filenames or runtime metadata that reveal hidden source context.

Internal provenance remains protected inside QANDEEL.

---

# 47. Immutable export

Distributed artifact refers to exact immutable Replay Version/Distribution Package.

Later editing creates a new Replay Version.

Old exported files never silently mutate.

---

# 48. Concurrency

Stale Replay operations fail/re-evaluate when:

- source version changes;
- source availability changes;
- authority changes;
- distribution approval changes;
- selection changes;
- analytical projection changes;
- target destination changes.

---

# 49. Canonical invariants

`E1.` Replay is a derived artifact, never a World.  
`E2.` Stable Replay identity and immutable Replay Versions are distinct.  
`E3.` Every Replay Version binds exact source manifest, selection, analytical projection and render contract.  
`E4.` Original source medium is preserved.  
`E5.` Missing/deleted audio is never synthetically reconstructed as source truth.  
`E6.` Text source remains exact and chronologically truthful.  
`E7.` Replay reuses canonical temporal/no-hindsight semantics.  
`E8.` Superseded analysis remains historically real where it existed.  
`E9.` Selection omits/selects source; it does not rewrite source.  
`E10.` Semantic Cut Safety prevents meaning reversal through trimming.  
`E11.` Selected segments remain chronological.  
`E12.` Replay truthfully declares full vs selected/highlight coverage.  
`E13.` Non-contiguous joins create mandatory perceptible temporal discontinuity.  
`E14.` Conversational timing is preserved when timing itself carries meaning.  
`E15.` Natural-language selection cannot hallucinate unresolved source.  
`E16.` Selection binds stable source identity/version, not raw offsets alone.  
`E17.` Draft/preview does not widen audience or reserve distribution rights.  
`E18.` Replay creation and distribution are distinct authorities.  
`E19.` Distribution approval binds exact Replay Distribution Package Version.  
`E20.` Every distribution act revalidates current authority.  
`E21.` Shared distribution derives exact included protected-material authority.  
`E22.` Viewer cannot create Replay from another owner's Public Experience.  
`E23.` Publish/share/download are distinct distribution acts.  
`E24.` Deleted/unavailable source cannot be reconstructed.  
`E25.` Stale source/render state cannot finalize silently.  
`E26.` Replay provenance never grants hidden source access.  
`E27.` Finalized Replay preserves semantic/temporal equivalence across renders.  
`E28.` Replay visuals bind actual analytical state/version.  
`E29.` Camera/motion may emphasize but never create meaning.  
`E30.` Replay editorial annotation cannot masquerade as source event.  
`E31.` Derived captions/transcripts remain distinct from source truth.  
`E32.` Accessibility/reduced-motion preserves equivalent truth.  
`E33.` Exported artifacts are sanitized against private provenance/metadata leakage.  
`E34.` Distributed Replay Version is immutable.  
`E35.` Stale Replay operations cannot silently commit.

---

# 50. Deferred

Not frozen here:

- codec/container;
- storage/CDN;
- export resolution;
- final visual/motion craft;
- social templates;
- external recall capability;
- mandatory Public withdrawal after later source deletion;
- DRM/watermarking;
- live in-conversation Replay capture;
- full editing timeline;
- synthetic translation/dubbing;
- monetization/export limits.

---

# 51. Freeze status

# `CW2-05 — CLOSED / FROZEN`

Next:

# `CW2-06 — Introductions / Matching Runtime Architecture`
