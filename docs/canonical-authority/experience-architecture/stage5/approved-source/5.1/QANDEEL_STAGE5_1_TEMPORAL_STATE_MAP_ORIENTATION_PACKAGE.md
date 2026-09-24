# QANDEEL — Stage 5.1 Temporal State + Map Orientation Contract

**Status:** Proposed package for Product / Experience / Architecture review  
**Authority:** Research and interaction-proof output only — not approved, complete, or frozen  
**Upstream:** Stages 0–4 remain binding and unchanged

## 1. Research Synthesis

Only findings that materially affect Stage 5.1 are included.

| Source finding | Reusable principle | QANDEEL implication | Pattern not to copy |
|---|---|---|---|
| W3C Media Source Extensions defines a live seekable range separately from the media element's current playback position. | A live frontier and an inspected position can advance independently. | Model **Live Head** separately from **Temporal Cursor**; a pinned TC must not be dragged by new live commits. | Media-player semantics, autoplay, buffering chrome, or treating QANDEEL as video playback. |
| Oracle Temporal Validity distinguishes real-world valid time; SQL Server system-versioned tables reconstruct stored state at a point in system time. | “When a fact was true in the world” and “when the system knew/stored it” are different dimensions. | **Referenced Temporal Origin** and **Knowledge Time** must be distinct. Current-session position remains a third QANDEEL-specific axis. | Exposing database terms or reducing conversation time to two table columns. |
| Azure Event Sourcing derives projections by replaying an immutable ordered event history. | A historical view should be reconstructed from changes valid up to a boundary, rather than rewriting the past from today's snapshot. | K(t) must be a deterministic then-knowable projection, including then-valid states and excluding later Readings, relations, evidence and confidence. | Adopting event sourcing as an implementation decision at this stage. |
| W3C PROV gives entities generation and invalidation boundaries and links them to the activities that caused those transitions. | Analytical objects have provenance-aware availability lifetimes. | Reading creation, supersession, relation establishment and evidence participation each need their own knowledge-time boundaries. | Copying PROV vocabulary into user-facing UI or treating invalidation as “was always false.” |
| ArcGIS Pro can navigate the time, camera, or range components of a bookmark independently. | Spatial and temporal navigation are orthogonal state dimensions; combined navigation should be intentional. | Temporal movement must not inherently imply camera movement. A combined temporal+spatial action needs explicit entitlement. | GIS bookmark UI, map-page architecture, or generic time-enabled layers. |
| ArcGIS geospatial video distinguishes “Zoom to frame” from explicit “Automatic Follow”; continuous following can also be disabled. | Locate-once and follow-continuously are different intents. | QANDEEL should distinguish a one-time temporal locate from any continuing temporal-camera follow policy. Manual spatial inspection must override/cancel camera-follow behavior. | Continuous centering, frame chasing, or moving the camera on every scrub tick. |
| ArcGIS time sliders filter the visible temporal state while the time setting persists independently of whether the slider itself is expanded. | Temporal state is durable application state, not merely the position of a visible control. | Hiding or deemphasizing Timeline UI later must not reset TC or K(t). | Timeline-first information architecture or treating the Timeline widget as the state owner. |

Primary sources:

- [W3C Media Source Extensions — live seekable range](https://www.w3.org/TR/media-source-2/)
- [Oracle — Temporal Validity](https://docs.oracle.com/en/database/oracle/oracle-database/18/vldbg/control-validity-visibility-data.html)
- [Microsoft — System-versioned temporal tables](https://learn.microsoft.com/en-us/sql/relational-databases/tables/temporal/overview?view=sql-server-ver17)
- [Microsoft Azure — Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [W3C PROV-O](https://www.w3.org/TR/prov-o/)
- [Esri — Independent camera/time bookmark navigation](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/navigation/time-and-range-in-bookmarks.html)
- [Esri — Geospatial video: Zoom, Locate, and Automatic Follow](https://doc.esri.com/en/arcgis-pro/latest/help/analysis/image-analyst/the-full-motion-video-player.html)
- [Esri — Time slider behavior](https://pro.arcgis.com/en/pro-app/3.4/help/mapping/time/visualize-temporal-data-using-the-time-slider.htm)

## 2. Formal Temporal State Model

### 2.1 Terminology

Avoid the unqualified word **current**. Use one of:

- **Live:** evaluated at the latest committed conversational position.
- **Cursor-selected:** evaluated at TC.
- **Referenced:** the real-world time described by content.
- **Available:** legitimately knowable to QANDEEL at a stated knowledge boundary.
- **Inspected:** deliberately examined by the user.
- **Visible:** inside the Map Camera viewport at its current semantic depth.

### 2.2 State vector

The initial hypothesis is retained but refined:

`S = { LH, LF, TM, TC, IF, MC, RH }`

| Variable | Definition | State class |
|---|---|---|
| `LH` | Latest committed conversational unit/position. Monotonic within the Session. | Independent authoritative live state |
| `LF` | Semantic world location to which meaningful live activity currently belongs. It may be provisional if the runtime has only Emerging Focus. | Derived from committed live analysis at LH, but independently observable from TC/IF/MC |
| `TM` | Temporal mode: `FOLLOW_LIVE` or `PINNED(t)`. | Independent user-navigation state |
| `TC` | Effective current-session position being inspected. If `FOLLOW_LIVE`, `TC = LH`; if `PINNED(t)`, `TC = t`. | Derived from TM and LH |
| `K(TC)` | Historical knowledge projection legitimately available at TC. | Derived projection, never independently mutated |
| `IF` | Inspection reference: canonical object identity, contextual appearance, containing lineage and inspection depth. It may resolve as available or unavailable under K(TC). | Independent inspection state |
| `MC` | Map Camera: world-space viewport, scale, semantic depth and local projection. | Independent spatial state; conditionally changed by entitled actions |
| `RH` | Ordered return checkpoints sufficient to restore TC mode/value, IF, context lineage, semantic depth and MC exactly. | Navigation history state |

### 2.3 Temporal metadata carried by analytical material

For an object, object version, relation, evidence participation, contextual appearance or state transition `x`:

- `SP(x)` — **Session Position:** where the relevant utterance/commit occurred.
- `RTO(x)` — **Referenced Temporal Origin:** real-world instant/interval described by the content, if any.
- `KF(x)` — **Knowledge From:** earliest Session Position at which QANDEEL was legitimately entitled to expose `x`.
- `KT(x)` — **Knowledge To:** first position at which that exact version ceased to be the live-valid version; infinity if still current.

`RTO(x)` may be unknown, approximate, contested, or an interval. It does not control TC.

### 2.4 Cursor modes and the necessary exception

The provisional invariant “only explicit temporal navigation may change TC” is almost correct but fails at the live edge. If the user is following Live, each conversational commit must keep TC aligned with the advancing LH.

Refined invariant:

> Only an explicit temporal-navigation act may establish or change a **pinned** TC. A conversational commit may advance effective TC only while `TM = FOLLOW_LIVE`, because in that mode TC is defined as LH rather than independently moved.

Therefore:

- Pan, Semantic Zoom, inspection, contextual navigation and spatial direct jumps never change TM or TC.
- Explicit scrub/jump sets `TM = PINNED(t)`.
- New commits advance LH always; they advance TC only in `FOLLOW_LIVE`.
- Return to Live Head sets `TM = FOLLOW_LIVE`, hence `TC = LH`.

### 2.5 K(t) projection semantics

Let `W` be the one canonical persistent Conversation World. Then:

`K(t) = Project(W, t)`

The projection includes only identities, versions and appearances satisfying their knowledge-time entitlement at `t`.

For a versioned item `xᵥ`:

`visible_in_K(xᵥ,t) ⇔ KF(xᵥ) ≤ t < KT(xᵥ)`

Additional rules:

1. **Identity persists; appearance is time-gated.** A canonical object may have multiple contextual appearances, each with its own `KF/KT`.
2. **Relations are first-class time-gated claims.** Existing endpoints do not entitle a relation before its own `KF`.
3. **Evidence participation is independently time-gated.** Later participation cannot strengthen an earlier Reading in K(t).
4. **Confidence is versioned.** K(t) shows only the confidence legitimately available then, never today's score.
5. **Thread state is versioned.** Emerging, Active, Dormant and Reopened project as then valid while retaining one identity and Home locus.
6. **Referenced origin does not filter knowledge.** An Event from last year first disclosed today is unavailable in K(yesterday), even though its RTO is last year.
7. **No historical compaction.** Thread Home loci do not move. A not-yet-emerged Thread leaves no label, latent object or anticipatory trace; the remaining world is not recentered to fill its future location.
8. **Absence is real absence.** An unavailable item is not shown dimmed, ghosted, low-confidence, or “locked,” because each would leak that the item exists later.
9. **Projection does not clone the world.** K(t) is a filter/version selection over the same world identity and geography.

### 2.6 Inspection resolution under K(t)

`IF` preserves inspection intent even if a temporal change makes its target unavailable. Its derived resolution is:

- `AVAILABLE_AT_TC` — the object/version/context may be rendered and inspected.
- `UNAVAILABLE_AT_TC` — the identity reference may remain in RH, but the object must not be rendered as if it existed in K(TC).
- `CONTEXT_UNAVAILABLE_AT_TC` — the canonical object existed, but that contextual appearance did not.

This preserves Exact Return without leaking future knowledge. Final absence messaging is a later UI decision.

### 2.7 Invalid combinations

The following states are invalid:

- `TC > LH`.
- `TM = PINNED(t)` while a new commit silently advances TC.
- An item rendered inside K(t) when `KF(item) > t`.
- A later state/confidence/conclusion shown as though it were the historical version.
- A relation displayed because both endpoints exist, before the relation itself became knowable.
- RTO used as TC without an explicit current-session temporal act.
- Pan, Semantic Zoom, object inspection or contextual appearance navigation changing TC.
- A spatial direct jump silently selecting the object's creation time.
- A historical projection moving Home loci, compacting empty space, or recentring canonical geography.
- Multiple canonical identities created for time-specific or context-specific appearances.
- RH omitting temporal state after a temporal excursion, making Exact Return approximate.
- MC center, LF, IF, TC or density being interpreted as importance, truth or confidence.

## 3. State Transition Matrix

Legend: `Δ` changes; `—` unchanged; `C` conditional; `I` invalid. `K` changes only as a derivation of TC.

| Action | LH | LF | TC | K(TC) | IF | MC | RH | Contract note |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| Conversational commit | Δ | C | C | C | — | — | — | TC/K advance only in `FOLLOW_LIVE`; pinned inspection is not hijacked. |
| Live Focus change | — | Δ | — | — | — | — | — | Does not move the camera; LF is not importance. |
| Pan | — | — | — | — | — | Δ | C | Meaningful spatial checkpoint may be recorded; never every pixel. |
| Semantic Zoom | — | — | — | — | C | Δ | Δ | Depth/lineage changes; TC does not. |
| Object inspection | — | — | — | — | Δ | C | Δ | Camera/depth may move to reveal the target in place. |
| Contextual navigation, same object | — | — | — | — | Δ | Δ | Δ | Same identity, different contextual appearance; TC preserved. |
| Direct spatial jump | — | — | — | — | C | C | Δ | Land only if target/context is available in K(TC); otherwise do not fabricate it. |
| Timeline scrub | — | — | Δ | Δ | —/C | C | Δ | Sets `PINNED(t)`. During active scrub MC stays fixed; post-commit locate is conditional. |
| Explicit temporal jump | — | — | Δ | Δ | —/C | C | Δ | May include explicit spatial intent; never infer it merely from time change. |
| New Live content while historical | Δ | C | — | — | — | — | — | Exact mandatory divergence case. |
| Back One Step | — | — | C | C | C | C | Δ | Pop one navigation checkpoint; LH/LF remain genuinely live. |
| Return to Original Inspection | — | — | C | C | C | C | Δ | Restore named checkpoint exactly, including TM/TC, IF, depth and camera. |
| Return to Live Head | — | — | Δ | Δ | —/C | — | Δ | Set `FOLLOW_LIVE`; temporal action, not inherently spatial. |
| Return to Live Focus | — | — | — | — | C | Δ | Δ | Spatially locate LF; does not change TC. Never render a future Thread inside historical K. |
| Return to World | — | — | — | — | C | Δ | Δ | Restore World/Z0 orientation at the same TC/K; no recomputation or re-layout. |

### Return semantics

- **Back One Step:** restores the immediately preceding navigation checkpoint. If that checkpoint crossed time, TC is restored; otherwise it is not changed.
- **Return to Original Inspection:** restores the explicitly preserved origin checkpoint: temporal mode/value + canonical object + contextual appearance + lineage + semantic depth + camera.
- **Return to Live Head:** temporal return only: `TM := FOLLOW_LIVE`, `TC := LH`, `K := K(LH)`. Camera is preserved by default.
- **Return to Live Focus:** spatial return only: MC locates the present LF; TC remains unchanged. If LF did not exist at TC, the historical projection must not fabricate it; the experience should offer the separate Live Head action.
- **Return to World:** spatial/depth return only: World-level camera at the existing TC/K.

## 4. Timeline ↔ Camera Policy Evaluation

| Policy | Strength | Critical failures | Verdict |
|---|---|---|---|
| **A — Hard Coupling** | Immediate spatial answer to “where was this?” | Hijacks manual inspection; destroys rapid-scrub orientation; causes continuous camera churn; confuses TC with LF/IF; weakens Exact Return; worst on narrow screens. | Reject. Contradicts frozen focus separation and spatial memory. |
| **B — Full Decoupling** | Perfect camera stability; simplest invariant | Explicit selection of a CU in another Thread can leave the user staring at irrelevant/empty space; weak orientation; forces extra actions for obvious locate intent. | Reject as absolute policy. Useful as the default during scrub and protected inspection. |
| **C — Conditional Coupling** | Preserves orthogonality while allowing intentional temporal+spatial navigation | Requires precise entitlement rules; careless defaults could drift back into hard coupling. | Recommend for review. |

### Recommended Conditional Coupling rules

Temporal movement always changes TC/K. It may change MC only after the temporal act is committed and one of these entitlements exists:

1. The user explicitly requested **locate this temporal target on the Map**.
2. The selected temporal target is a specific committed CU/Session with one unambiguous then-valid contextual locus, the user has no protected manual inspection, and the initiating action semantically combines time + location.
3. A separately enabled temporal-camera follow state is active. Any manual Pan, Zoom, inspection or contextual navigation cancels that camera-follow authority.

Even when entitled:

- no camera movement occurs on every intermediate rapid-scrub tick;
- reorientation happens only at scrub commit/settle;
- the target must exist in K(TC);
- MC moves within the same canonical geography and preserves return history;
- ambiguous multi-context targets require an explicit context choice or preserved context, never arbitrary ownership;
- no temporal action moves Thread Home loci or recomputes layout.

## 5. Recommended Stage 5.1 Contract

These are proposals for review, not frozen decisions.

### MUST

- Maintain `LH`, `LF`, `TM/TC`, `IF`, `MC` and `RH` as distinguishable state.
- Support simultaneous divergence such as `LH=184`, `LF=Work`, `TC=121`, `IF=Family/M-27`, `MC=Family` in one world.
- Use `FOLLOW_LIVE` and `PINNED(t)` cursor modes.
- Derive K(t) exclusively from then-available knowledge and then-valid versions.
- Preserve one canonical world identity and fixed Thread Home loci across K(t).
- Version/gate Readings, relations, evidence participation, contextual appearances, Thread states, confidence and conclusions by knowledge time.
- Preserve RTO independently from current-session TC.
- Include temporal mode/value in RH checkpoints whenever temporal state may need restoration.
- Preserve Stage 4 Exact Return across temporal navigation.
- Treat Live Head return, Live Focus return and World return as different actions.

### MUST NOT

- Move TC because of Pan, Semantic Zoom, inspection, contextual navigation or a spatial direct jump.
- Advance pinned TC when new live content arrives.
- Move MC on every scrub tick or hijack protected manual inspection.
- Reveal later Readings, Evidence, relations, Thread states, confidence, conclusions or semantic importance in earlier K(t).
- Show unavailable future items as ghosts, dim objects, placeholders, counts or latent geometry.
- Use an old Event's RTO as though it were current-session Timeline position.
- Backdate a later correction or treat a superseded Reading as always false.
- Assign a primary Thread to a multi-context object during a temporal/direct jump.
- Compact, recenter or re-layout historical geography.

### SHOULD

- Preserve MC during active/rapid scrub and decide any entitled reorientation only after commit/settle.
- Cancel temporal-camera follow authority when the user manually navigates or inspects.
- Keep present Live orientation detectable while historical, but clearly outside K(t)'s analytical truth.
- Resolve direct jumps within current K(TC); if unavailable, offer an explicit jump to a legitimate availability point rather than moving TC silently.
- Preserve IF as an inspection reference when unavailable at TC so return remains exact, while not rendering the unavailable object.
- Make temporal mode and projection boundary intelligible on narrow screens without changing canonical geography.

### MAY

- Perform one-time post-commit camera location when explicit temporal+spatial intent and a unique then-valid locus are present.
- Maintain a separate opt-in temporal-camera follow state, provided manual spatial action immediately revokes it.
- Show a non-analytical present-Live locator while historical, provided it cannot be confused with material available in K(t).
- Preserve multiple named inspection checkpoints in addition to the stepwise RH stack.

### OPEN

- Exact interaction/gesture that distinguishes temporal-only scrub from temporal+locate.
- Settle/debounce threshold for rapid scrub.
- Whether temporal-camera follow is exposed at all and its default.
- Exact treatment of present LF when its Thread had not yet emerged in K(t).
- Exact absence explanation when IF is unavailable at TC.
- Timeline windowing, aggregation and label density.
- Final motion, styling, responsive projection and accessibility behavior.

## 6. Proof Board A — Temporal State + Map Orientation

![Proof Board A](QANDEEL_STAGE5_1_PROOF_BOARD_A.png)

The board demonstrates one unchanged geography across five states:

1. Live state at CU-180.
2. Explicit historical selection at CU-121, located at Ahmed.
3. Live Head advances to CU-184 while TC stays pinned.
4. User pans to Family and inspects M-27 without moving TC.
5. Explicit temporal return to Live, with spatial Live Focus treated as a separate intent.

It specifically proves that Live Head, Live Focus, Temporal Cursor, K(t), Inspected Focus and Map Camera may diverge without creating multiple maps or false analytical relations.

## 7. Proof Board B — Temporal Adversarial Stress

![Proof Board B](QANDEEL_STAGE5_1_PROOF_BOARD_B.png)

The board covers:

- historically unavailable Reading;
- relation established after both endpoints existed;
- old referenced Event discussed today;
- then-current vs later-superseded Reading;
- Thread state across Active/Dormant/Reopened;
- historical pin plus manual spatial inspection;
- temporal Exact Return;
- hindsight leakage firewall;
- narrow/mobile conceptual projection.

Rectangles, legends and labels are proof scaffolding only. They are not proposed product components.

## 8. Adversarial Findings

1. **The original TC invariant needed one exception.** A live-following cursor must advance with LH; this is safely modeled as a derived equality in `FOLLOW_LIVE`, not as hidden navigation.
2. **Hard coupling fails.** It breaks manual inspection, rapid scrub, spatial memory and Stage 4 focus separation.
3. **Full decoupling also fails as an absolute.** A deliberate jump to a specific historical CU in another Thread can require an intentional locate operation.
4. **Historical inspection while Live continues passes** under `PINNED(t)`: LH/LF advance while TC/K/IF/MC remain stable.
5. **Reading unavailable historically passes** only if it is completely absent; dimming or locking leaks future knowledge.
6. **Superseded Reading passes** when K(t) selects the then-valid version and Live selects the later lineage state without retroactive falsification.
7. **Old Event discussed today passes** because RTO is metadata, not a current-session navigation command.
8. **One Memory/multiple contexts passes** when canonical identity is singular but each contextual appearance has independent knowledge availability.
9. **Thread not yet emerged passes** when it leaves no historical object/label/trace and the world does not compact around the absence.
10. **Later relation passes** only when the relation has its own KF boundary; endpoint existence is insufficient.
11. **Dormant→Reopened passes** with one Home locus and time-versioned state.
12. **Emerging Focus passes** when K(t) shows the legitimate earlier pre-geographic state and does not borrow its later Established Thread morphology.
13. **Direct jump while historical passes** only if TC remains fixed. An exception is legitimate solely when the command itself explicitly includes a temporal target or the user confirms a jump to first availability.
14. **Rapid scrub passes** with camera preservation during the gesture, deferred projection settlement, no intermediate auto-pan and exact final K(t).
15. **Mobile passes** because state independence does not require simultaneous wide-canvas display; reduced disclosure is sufficient without canonical reflow.
16. **Confidence and importance are high-risk leakage vectors.** Historical objects cannot inherit today's confidence, salience, outcome framing or later evidence count.

## 9. Intentionally Open Questions for Later Stage 5 Work

- What exact user action communicates temporal-only movement versus “locate this moment on the Map”?
- Should a persistent temporal-camera follow mode exist, or are one-time locate actions sufficient?
- At what point is rapid scrub considered committed for K(t) and possible camera reorientation?
- How should present Live orientation be indicated when LF belongs to a Thread absent from K(t), without leaking that Thread into the projection?
- What in-place explanation appears when the preserved IF is unavailable at TC?
- How are approximate/contested RTO intervals represented without confusing them with session Timeline position?
- How much RH is retained and which checkpoints are named versus stepwise?
- How should later comparison of historical and live analytical lineage work without turning K(t) into a hindsight view?

## 10. Architecture Review Handoff

### Recommendation submitted for review

Adopt **Conditional Timeline↔Camera Coupling** with:

- independent Live, temporal, inspection and camera state;
- `FOLLOW_LIVE` / `PINNED(t)` temporal modes;
- strict knowledge-time K(t) projection;
- camera preservation during rapid scrub and protected inspection;
- camera movement only from explicit or unambiguous combined temporal+spatial intent;
- temporal state included in Exact Return checkpoints.

### Review decisions requested from Product / Experience / Architecture

1. Accept or reject the refined `FOLLOW_LIVE` exception to the explicit-TC-change invariant.
2. Accept or reject Conditional Coupling as the Stage 5.1 direction.
3. Confirm that Return to Live Head is temporal and Return to Live Focus is spatial.
4. Confirm complete absence—not ghosting—for future-unavailable material in K(t).
5. Confirm that direct spatial jumps preserve TC unless temporal intent is explicit.

No Stage 5.1 completion or freeze is asserted by this package.
