# T-05 Timeline presentation window v1

Baseline: `d163739b3a553a0321aa3115a4c28493163e3e36`.
Branch: `feat/t05-timeline-presentation-window-v1`.

## Canonical reconciliation

Read in full: `QANDEEL_STAGE6_2_FINAL_FREEZE_RECORD_v1.md` and
`QANDEEL_STAGE6_4_FINAL_FREEZE_RECORD_v1.md`, supplied in
`QANDEEL_T05_MANDATORY_FREEZE_REFERENCES.zip`. These override candidate and
proof-board shorthand. The Stage 6.2 v2 candidate and boards S6.2 A/B and
S6.4 B were also inspected. No styling, annotation layout or debug-board labels
are imported into the component.

- Stage 6.2 sections 3–5/13–15: invariant ordinal geometry, windowing, disclosed
  membership only, no aggregation, and narrow-device parity are preserved.
- Stage 6.2 sections 8–10: the optional outboard Live presentation slot is outside
  the FlatList, fixed at 64 layout pixels, never an item or part of ordinal extent.
  A fixed-size discontinuity mark states only that disclosed Track continues when
  the window is away from its end. The later temporal owner supplies Live intent
  and the committed-mode indicator; T-05 supplies no fake Live step or activation.
- Stage 6.2 AF-01: the restriction is on the Timeline exposure path, not unrelated
  runtime knowledge. No global runtime count prohibition is introduced here.
- Stage 6.4 sections 10–15 and AF64-02: the presentation-position control is separate
  from the later exact-target navigator, relative forward action and Live target.
  Practicality is proven using direct percentage/rail positioning and bounded
  assistive actions at 10k/100k, not merely fewer page commands than Moments.
- Stage 6.4 sections 3–8/17/19: nonanimated programmatic movement carries no semantic
  authority; tap and text submission provide non-dragging equivalents; no passive
  commit announcements, canonical pause or transaction is introduced.
- Stage 6.4 sections 20–24: responsive changes only clamp the local viewport.
  Preview ownership and Map/camera intent remain outside T-05 and unchanged.

No Product/Architecture contradiction was found. The 48-pixel step and 64-pixel
outboard extent are implementation constants, not canonical pixel minima or final
art direction. No Stage 6.2/6.4 freeze document independently authorizes code;
implementation authorization is the user's T-05 brief.

## Boundary and integration

`apps/mobile/src/timeline/index.ts` exports a presentation component and controller.
The parent supplies the **complete already-disclosed current-session prefix**
`SP1 ... SP(H)` through `disclosedTrack(sessionId, targets)`. That factory copies and
freezes SP only. It rejects duplicates, gaps, unsafe ordinals, reversed input, and any
non-empty input whose first Session Position is not `SP1`. The empty Track stays valid.
Entitlement remains upstream: never give it full history while pinned. There is no LH
parameter, history fetcher, canonical store handle, dispatch, selected Moment or
temporal action.

**T-05 performs viewport/window virtualization over that prefix itself.** A caller must
never hand it an arbitrary already-disclosed suffix such as `[SP50, SP51, SP52]` in
order to show a later part of the Timeline. Array index 0 is the Track origin, so a
suffix would move the origin: the same Moments would take different offsets, the
position scale would normalize over a partial slice, and `0%` / `first` would name
something other than the beginning of the disclosed Timeline. Windowing reduces
simultaneity only; it does not redefine ordinal geometry, target meaning, Track origin
or presentation truth. To move the visible region, move the window — not the input.

```tsx
// Build once per supplied entitlement snapshot, not on every scroll.
const track = disclosedTrack(sessionId, entitledTargets);
const presentation = createPresentationController(track);
// Mount in the later owning composition:
<TimelinePresentation controller={presentation} />;
// Only after a legitimate upstream disclosure update:
presentation.replaceDisclosed(disclosedTrack(sessionId, updatedEntitledTargets));
```

This is an exported composition seam, not final app-shell topology or styling. Exact
visible Moment activation and a separate Live intent belong to T-06. The optional
`outboardLivePresentation` prop reserves their non-metric composition boundary.
No Live surrogate
is appended to the item array; Moment(LH) remains an ordinary disclosed SP item.

## Geometry and state

Every committed Moment occupies 48 React Native layout pixels. Item `i` has offset
`i * 48` and length `48`; the key is its SP string. Narrow widths show fewer steps.
Metadata, time, content, viewport and count never change the step. No aggregation
or aggregation extension hook is present.

The ephemeral controller snapshot contains only track, viewport, pixel offset,
maximum offset, normalized position and adjustment fraction. No persistence or
canonical-state edits are involved. All four frozen `PRESENTATION_*` identities
operate on this controller alone.

`P = offset / max(0, disclosedCount * 48 - viewport)` when scrolling is possible;
otherwise P is zero. A viewport not yet measured also has zero movement. Empty,
single and fully fitting regions cannot scroll. Pixel offsets clamp on resize,
shrink and invalid overscroll. Non-finite inputs fail without modifying state.
Same-session disclosure growth preserves the absolute offset, rather than moving
to the new end. Session replacement resets position, fraction and command entry.

Refine halves the adjustment fraction, down to 1/1024 of the presentation range;
widen doubles it, up to the full range. The initial fraction is 1/8. Neither action
moves the window or chooses a Moment. Subsequent adjustments operate relative to
the current visible region. These are presentation fractions, not temporal units.

## Input and accessibility

- Pointer/touch: native horizontal scrolling plus a 44-pixel-high position rail.
  One rail position event can reach any disclosed presentation fraction.
- Keyboard/external keyboard: the text field submits a percentage (`75%`), `first`,
  `last`, `next`, `previous`, `+`/`plus`, `-`/`minus`, `refine` or `widen` with Enter.
  Next/previous move a viewport of pixels. This uses native text submission, not
  an unsupported assumption about Android hardware `onKeyPress` or web keydown.
- Assistive/non-pointer: a native adjustable control exposes increment/decrement,
  first/last and refine/widen accessibility actions. Eight initial increments or
  one last action reaches the end at either fixture size. Text entry plus the Move
  button is an alternative for systems that do not expose custom actions.
- All position labels and the 0–100 scale explicitly concern already-disclosed
  presentation. No full-session set size or future labels are supplied. Target
  Views expose only their disclosed SP and have no activation handler.
- RTL native Cartesian scrolling is converted to logical ordinal offset; RN's
  own `scrollToOffset` performs the opposite conversion. The rail mirrors too.

## Built-in virtualization and proof

React Native FlatList uses deterministic `getItemLayout`, stable SP keys, an
initial batch of 12, maximum batch of 12 and a five-viewport render window. The
underlying RN implementation is unchanged. No new dependency or lockfile change.

The deterministic 10,000 and 100,000 fixtures run through the **real RN FlatList
and VirtualizedList window algorithm** in Jest. The harness supplies native layout,
content-size and scroll events because there is no native host in Jest. A
call-through spy verifies actual `scrollToOffset` requests; no list or constant-time
controller internals are mocked. Tests assert distant and last SP Views actually
appear and fewer than 100 target Views remain mounted, including repeated long
jumps. Both sizes observed 36 mounted target Views at the distant and last windows.

These results demonstrate bounded rendered work and practical interaction count,
not device frame rate, native screen-reader certification, or an O(1) API guarantee.
Trusted-environment Android/iOS smokes and independent Architecture review remain.

| Proof | Test coverage |
| --- | --- |
| TL05-01 | Identical step at 10/10k/100k and narrow/wide widths |
| TL05-02 | SP ordering; unrelated metadata stripped; malformed order rejected |
| TL05-03 | Canonical state and RH remain object-identical |
| TL05-04 | Position movement preserves TM/effective TC; no PTC/selection field |
| TL05-05 | Refine/widen only alter bounded adjustment fraction |
| TL05-06 | Pinned disclosed prefix only: count/extent/hits and component a11y |
| TL05-07 | Growth preserves offset/geometry; shrink and session reset clamp |
| TL05-08 | 100k unique SP items, no aggregate surrogate |
| TL05-09 | Rail grant/drag causes a distant native scroll request at both sizes |
| TL05-10 | Submitted keyboard commands reach first/last/page/direct positions |
| TL05-11 | Assistive eight increments or one last action at both sizes |
| TL05-12 | Actual distant/last target Views; bounded mounted work after jumps |
| TL05-13 | No canonical dispatch or exact-Moment activation |
| TL05-14 | No invented coordinate or merging of Live and Moment intent |
| TL05-15 | Ephemeral restart reset, canonical identity, persistence source guard |
| TL05-16 | No Map/Skia/store imports or dependency; T-04 not consumed |
| R1-01 | Suffix input refused at the factory and through `replaceDisclosed`; the complete SP1-anchored prefix accepted with origin-anchored offsets |

Focused command (from `apps/mobile`):

```text
node ../../node_modules/jest/bin/jest.js --ci --runInBand --testPathPattern=src/timeline/__tests__
```

## Local verification and handoff

Dependencies were installed offline from the existing npm cache with `npm ci
--offline --ignore-scripts`; no manifests were altered. Full local results are
recorded in the completion report. The standard lint resolver's existing native
binding is blocked by Windows Application Control on this host. A supplementary
lint run uses the same rules and the existing pure-JavaScript Node resolver with
TypeScript extensions; it does not replace the required standard lint gate.

The frozen classifier treats mobile source changes as native-impacting, so later
Mobile CI must include Android and iOS native smokes. API workflow path filters
are not triggered by timeline-only source and this document. No classifier edits.
Windows can prove Android prebuild only; iOS generation belongs to the trusted host.

Push, Draft PR creation and remote CI are **TRUSTED-ENVIRONMENT HANDOFF REQUIRED**.
The local task does not authenticate, fetch, pull, push, open a PR, merge, or start
T-06. No unmerged T-04 branch or files were inspected or consumed.
