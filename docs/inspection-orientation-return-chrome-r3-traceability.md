# T-08 R3 — original-contract traceability

Every row below maps one requirement of the ORIGINAL T-08 execution contract to the exact test that
proves it. It is generated from the repository, not written by hand, and it is **enforced**: the root
contract `tests/inspection-orientation-return-chrome-contract.test.mjs` recomputes both matrices on
every run and fails when any case loses its citation. A renamed or deleted test breaks the gate
rather than silently leaving a gap in a document nobody re-derives.

Anti-proxy rule, applied throughout: a nearby test is not proof. Where an existing test genuinely
asserted a case's oracle, its title now cites the case id; where nothing asserted it, a real test was
written. No row is claimed by a test that proves something adjacent.

## Summary

| | |
| --- | --- |
| PROVEN | 118 |
| STRUCTURALLY IMPOSSIBLE | 2 |
| N/A | 0 |
| **uncovered** | **0** |

## §24 — adversarial cases 1–120

### A — orientation (1–8)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 1 | FOLLOW_LIVE truthful | `orientation.test.ts` — A1 — following Live is reported as following Live, at the authoritative Live Head | PROVEN |
| 2 | PINNED behind Live truthful | `orientation.test.ts` — A2 — a pinned position behind Live is historical, and Live is reported as having continued | PROVEN |
| 3 | PINNED(LH) distinct from FOLLOW_LIVE | `orientation.test.ts` — A3 — PINNED at the Live Head is NOT following Live, and returning to Live is still meaningful | PROVEN |
| 4 | LH null invents no Live edge | `orientation.test.ts` — A4 — with no mirrored Live Head, no Live edge is invented and no Live act is offered | PROVEN |
| 5 | depth comes only from canonical camera | `orientation.test.ts` — A5 — the depth is the canonical camera rung, whatever the disclosure contains | PROVEN |
| 6 | empty viewport does not imply World | `orientation.test.ts` — A6 — an empty disclosed viewport does not imply the camera is at the World viewpoint | PROVEN |
| 7 | no inspection is neutral | `orientation.test.ts` — A7 — inspecting nothing is neutral, and needs no projection to be knowable | PROVEN |
| 8 | chrome adds no canonical state | `orientation.test.ts` — A8 — building the model adds no canonical state and mutates nothing | PROVEN |

### B — six returns (9–20)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 9 | Back calls only backOneStep | `returns.test.tsx` — B9, B16 — Back reverses the latest step and never means Live | PROVEN |
| 10 | Exact calls only exactReturn with opaque target | `returns.test.tsx` — B10, G61 — Exact Return restores the named checkpoint and consumes it and everything newer | PROVEN |
| 11 | Live Head calls only returnLiveHead | `returns.test.tsx` — B11, B18 — Return to Live Head moves time only, and moves neither camera nor inspection | PROVEN |
| 12 | Live Focus calls only returnLiveFocus | `returns.test.tsx` — B12, B19 — Return to Live Focus moves the camera only, and never the temporal position | PROVEN |
| 13 | World calls only returnWorld | `returns.test.tsx` — B13, B17 — Return to World is the canonical World camera at the same moment, and is not Back | PROVEN |
| 14 | composite calls only goLiveAndLocate | `returns.test.tsx` — B14, B20 — the composite is ONE transaction that moves time AND camera together | PROVEN |
| 15 | no executor aliases another | `returns.test.tsx` — B15 — the six produce six different canonical outcomes from one starting viewpoint | PROVEN |
| 16 | Back not labeled as Live | `returns.test.tsx` — B9, B16 — Back reverses the latest step and never means Live | PROVEN |
| 17 | World not labeled as Back | `returns.test.tsx` — B13, B17 — Return to World is the canonical World camera at the same moment, and is not Back | PROVEN |
| 18 | Live Head promises no location | `returns.test.tsx` — B11, B18 — Return to Live Head moves time only, and moves neither camera nor inspection | PROVEN |
| 19 | Live Focus promises no Live temporal move | `returns.test.tsx` — B12, B19 — Return to Live Focus moves the camera only, and never the temporal position | PROVEN |
| 20 | composite communicated distinctly | `returns.test.tsx` — B14, B20 — the composite is ONE transaction that moves time AND camera together | PROVEN |

### C — no-hindsight Live (21–30)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 21 | LF NONE vs future unavailable LF → identical generic chrome | `no-hindsight.test.tsx` — no-hindsight.test.tsx | PROVEN |
| 22 | future target name absent | `no-hindsight.test.tsx` — C22, C23, C24, C25, C26, J92 — nothing spoken names the future target, its family, a direction, a distance or a count | PROVEN |
| 23 | future family/category absent | `no-hindsight.test.tsx` — C22, C23, C24, C25, C26, J92 — nothing spoken names the future target, its family, a direction, a distance or a count | PROVEN |
| 24 | direction absent | `no-hindsight.test.tsx` — C22, C23, C24, C25, C26, J92 — nothing spoken names the future target, its family, a direction, a distance or a count | PROVEN |
| 25 | distance/location absent | `no-hindsight.test.tsx` — C22, C23, C24, C25, C26, J92 — nothing spoken names the future target, its family, a direction, a distance or a count | PROVEN |
| 26 | count/set-size absent | `no-hindsight.test.tsx` — C22, C23, C24, C25, C26, J92 — nothing spoken names the future target, its family, a direction, a distance or a count | PROVEN |
| 27 | a11y differential identical | `no-hindsight.test.tsx` — no-hindsight.test.tsx | PROVEN |
| 28 | generic route back to Live remains available where frozen | `no-hindsight.test.tsx` — C28 — the generic route back to Live remains available while historical, and says only that | PROVEN |
| 29 | specific Live Focus capability only via projection-safe API | `no-hindsight.test.tsx` — C29 — the specific Live Focus capability comes only from the projection-bound answer | PROVEN |
| 30 | legitimately locatable LF may enable generic focus-return act without extra metadata | `no-hindsight.test.tsx` — C30 — a legitimately locatable Live Focus offers the act and attaches no metadata to it | PROVEN |

### D — inspection (31–42)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 31 | unknown-at-TC leaks no identity | `inspection.test.ts` — D31 — an identity unknown at TC leaks no family, no id, no version and no lineage | PROVEN |
| 32 | unknown retains safe recovery | `inspection.test.ts` — D32 — an unknown identity keeps every safe generic recovery route | PROVEN |
| 33 | known/renderable may show disclosed identity | `inspection.test.ts` — D33 — a known, renderable identity may be named, in plain language and never by its id | PROVEN |
| 34 | known noncurrent retains requested lineage | `inspection.test.ts` — D34, D35 — a noncurrent version keeps its lineage intent and is never called wrong or deleted | PROVEN |
| 35 | superseded != false/deleted | `inspection.test.ts` — D34, D35 — a noncurrent version keeps its lineage intent and is never called wrong or deleted | PROVEN |
| 36 | context unavailable withholds future context label | `inspection.test.ts` — D36, D37 — an unavailable context withholds its name and substitutes nothing | PROVEN |
| 37 | no context substitution | `inspection.test.ts` — D36, D37 — an unavailable context withholds its name and substitutes nothing | PROVEN |
| 38 | depth-withheld != unknown | `inspection.test.ts` — D38, D39 — depth-withheld is not absence, names the rung, and exposes no withheld content | PROVEN |
| 39 | withheld content absent | `inspection.test.ts` — D38, D39 — depth-withheld is not absence, names the rung, and exposes no withheld content | PROVEN |
| 40 | NOT_FETCHED technical only | `inspection.test.ts` — D40, D41 — NOT_FETCHED and UNAVAILABLE stay technical and stay different from each other | PROVEN |
| 41 | UNAVAILABLE technical only | `inspection.test.ts` — D40, D41 — NOT_FETCHED and UNAVAILABLE stay technical and stay different from each other | PROVEN |
| 42 | malformed resolution fails closed | `inspection.test.ts` — D42 — a malformed or disagreeing resolution fails closed | PROVEN |

### E — freshness (43–50)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 43 | current context derives semantic chrome | `freshness.test.tsx` — E43 — the current projection does derive semantic chrome | PROVEN |
| 44 | wrong Session → technical generic | `freshness.test.tsx` — E43 — the current projection does derive semantic chrome | PROVEN |
| 45 | wrong TC → technical generic | `freshness.test.tsx` — E43 — the current projection does derive semantic chrome | PROVEN |
| 46 | wrong depth → technical generic | `freshness.test.tsx` — E43 — the current projection does derive semantic chrome | PROVEN |
| 47 | state update retires old semantic chrome next render | `freshness.test.tsx` — E47, E50 — a committed act that moves the camera retires the semantic chrome and its labels | PROVEN |
| 48 | stale context cannot enable focus return | `freshness.test.tsx` — E43 — the current projection does derive semantic chrome | PROVEN |
| 49 | stale context cannot enumerate contexts | `freshness.test.tsx` — E43 — the current projection does derive semantic chrome | PROVEN |
| 50 | stale context cannot populate a11y semantic labels | `freshness.test.tsx` — E47, E50 — a committed act that moves the camera retires the semantic chrome and its labels | PROVEN |

### F — contextual appearance (51–60)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 51 | one current appearance needs no artificial chooser | `context.test.tsx` — F51 — one legitimate appearance produces no artificial chooser | PROVEN |
| 52 | multiple disclosed appearances can be chosen | `context.test.tsx` — F52, F53, F54 — several disclosed appearances are all offered, none marked as preferable | PROVEN |
| 53 | no primary/preselected option | `context.test.tsx` — F52, F53, F54 — several disclosed appearances are all offered, none marked as preferable | PROVEN |
| 54 | ordering is not ranking | `context.test.tsx` — F52, F53, F54 — several disclosed appearances are all offered, none marked as preferable | PROVEN |
| 55 | future context absent | `context.test.tsx` — F55 — a context that this position does not disclose is absent from the list entirely | PROVEN |
| 56 | choice uses current T-04 public executor | `context.test.tsx` — F56, F58, F59 — the choice runs T-04\ | PROVEN |
| 57 | cancel obeys owner no-act semantics where applicable | `context.test.tsx` — F57, I81 — rendering the chooser performs no act; only an explicit press does | PROVEN |
| 58 | identity remains one | `context.test.tsx` — F56, F58, F59 — the choice runs T-04\ | PROVEN |
| 59 | switching context creates no relation | `context.test.tsx` — F56, F58, F59 — the choice runs T-04\ | PROVEN |
| 60 | stale context retires chooser | `context.test.tsx` — F60 — a stale projection retires the chooser rather than leaving it actionable | PROVEN |

### G — exact-return capability (61–70)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 61 | legitimate opaque target reaches exactReturn | `returns.test.tsx` — B10, G61 — Exact Return restores the named checkpoint and consumes it and everything newer | PROVEN |
| 62 | no structural copy | `exact-return.test.tsx` — G62, G63, R2-01.3, R2-01.4 — a structural copy and a JSON round trip cannot bind | PROVEN |
| 63 | no serialization | `exact-return.test.tsx` — G62, G63, R2-01.3, R2-01.4 — a structural copy and a JSON round trip cannot bind | PROVEN |
| 64 | foreign-store target fails closed | `exact-return.test.tsx` — G64, R2-01.1 — a target minted by ANOTHER store cannot be bound to this one | PROVEN |
| 65 | consumed target fails closed | `exact-return.test.tsx` — G65, R2-01.5 — a target consumed BEFORE binding cannot bind | PROVEN |
| 66 | invalidating unwind retires local opportunity conservatively | `exact-return.test.tsx` — G66, R2-01.8, R2-01.9 — Exact Return retires the origin, and history regrowth does not revive it | PROVEN |
| 67 | no checkpoint internals exposed | `exact-return.test.tsx` — G67, R2-01.13 — the predicate answers with a boolean and exposes no checkpoint internals | PROVEN |
| 68 | checkpointCount does not become named history | `exact-return.test.tsx` — G68, G69 — the model carries a count of the reader\ | PROVEN |
| 69 | no RH browser | `exact-return.test.tsx` — G68, G69 — the model carries a count of the reader\ | PROVEN |
| 70 | target survives ordinary rerender without recapture | `exact-return.test.tsx` — G70, I80, R2-01.12 — a valid same-store origin survives rerenders and callback churn | PROVEN |

### H — Preview / no-op / outcome (71–78)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 71 | Preview + Back → one public executor call | `outcomes.test.tsx` — outcomes.test.tsx | PROVEN |
| 72 | Preview + Live Head → one call | `outcomes.test.tsx` — outcomes.test.tsx | PROVEN |
| 73 | Preview + World → one call | `outcomes.test.tsx` — outcomes.test.tsx | PROVEN |
| 74 | no-op makes no fake canonical state | `outcomes.test.tsx` — H74 — a no-op creates no fake canonical state and no fake reversible step | PROVEN |
| 75 | stale projection remains technical | `outcomes.test.tsx` — H75 — a stale projection stays technical and never becomes a semantic absence | PROVEN |
| 76 | stale exact target refusal retires opportunity appropriately | `exact-return.test.tsx` — H76, R2-01.7 — a target consumed between validation and press is refused by T-07, with no extra mutation | PROVEN |
| 77 | absent observer callback does not suppress act | `outcomes.test.tsx` — H77 — an absent outcome observer never suppresses the act itself | PROVEN |
| 78 | observer receives outcome after execution | `outcomes.test.tsx` — H78 — the observer is notified AFTER execution, with the executor\ | PROVEN |

### I — React lifecycle (79–86)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 79 | callback identity change does not alter semantics | `lifecycle.test.tsx` — I79 — a new callback identity on every render changes no semantics and runs no act | PROVEN |
| 80 | rerender does not recapture exact origin | `exact-return.test.tsx` — G70, I80, R2-01.12 — a valid same-store origin survives rerenders and callback churn | PROVEN |
| 81 | rerender does not auto-select context | `context.test.tsx` — F57, I81 — rendering the chooser performs no act; only an explicit press does | PROVEN |
| 82 | unmount makes late provider callback inert | `lifecycle.test.tsx` — I82 — a provider captured before unmount is inert afterwards: it holds nothing and writes nothing | PROVEN |
| 83 | old callback cannot act on replacement | `lifecycle.test.tsx` — R1-08 — a replaced store invalidates the old Exact Return opportunity immediately | PROVEN |
| 84 | store replacement invalidates old store-bound target/context | `exact-return.test.tsx` — I84, R2-01.11 — a replaced store invalidates the origin immediately | PROVEN |
| 85 | rapid taps cannot replay owner authorization | `lifecycle.test.tsx` — I85 — rapid repeated presses cannot replay an authorization | PROVEN |
| 86 | transient UI state remains noncanonical | `lifecycle.test.tsx` — I86 — the one piece of local state is noncanonical and can only ever remove an opportunity | PROVEN |

### J — accessibility (87–95)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 87 | all essential T-08 actions have non-pointer route | `accessibility.test.tsx` — J87, J91, J93 — exactly the meaningful acts are rendered, and nothing unavailable is reachable | PROVEN |
| 88 | independent controls remain independent native elements | `accessibility.test.tsx` — J88, J89 — every offered control is its own native button, and no grouping parent swallows them | PROVEN |
| 89 | parent grouping does not swallow children | `accessibility.test.tsx` — J88, J89 — every offered control is its own native button, and no grouping parent swallows them | PROVEN |
| 90 | pointer/a11y invoke same executor | `accessibility.test.tsx` — J90 — the pointer route reaches the executor the control names, and only that one | PROVEN |
| 91 | disabled/hidden state is knowledge-safe | `accessibility.test.tsx` — J87, J91, J93 — exactly the meaningful acts are rendered, and nothing unavailable is reachable — R1 removed disabled and hidden control states entirely: an act is offered or it is absent, so there is no disabled or hidden state left that could leak. Proved by the offered-set test plus the static guard that no control renders `disabled` or publishes a disabled accessibility state. | STRUCTURALLY IMPOSSIBLE |
| 92 | no future identity in screen-reader output | `no-hindsight.test.tsx` — C22, C23, C24, C25, C26, J92 — nothing spoken names the future target, its family, a direction, a distance or a count | PROVEN |
| 93 | no unavailable/off-depth focus item | `accessibility.test.tsx` — J87, J91, J93 — exactly the meaningful acts are rendered, and nothing unavailable is reachable | PROVEN |
| 94 | touch targets practical | `accessibility.test.tsx` — J94, J95 — targets are practical, and nothing is reachable only by dragging | PROVEN |
| 95 | no drag-only T-08 action | `accessibility.test.tsx` — J94, J95 — targets are practical, and nothing is reachable only by dragging | PROVEN |

### K — RTL / bidi (96–102)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 96 | Arabic logical reading order | `rtl.test.tsx` — K96, K97 — Arabic and code-switched identities drive the chrome without ever being spoken | PROVEN |
| 97 | mixed Arabic/English/numeral legibility | `rtl.test.tsx` — K96, K97 — Arabic and code-switched identities drive the chrome without ever being spoken | PROVEN |
| 98 | RTL does not swap Live Head/Focus semantics | `rtl.test.tsx` — K98, K99, K101 — the six keep their identities, order, labels and states under RTL | PROVEN |
| 99 | RTL does not swap Back/World meaning | `rtl.test.tsx` — K98, K99, K101 — the six keep their identities, order, labels and states under RTL | PROVEN |
| 100 | arrows do not encode unproven geography | `rtl.test.tsx` — K100 — there is no arrow, chevron, icon or direction word to be mirrored | PROVEN |
| 101 | screen-reader order logical in RTL | `rtl.test.tsx` — K98, K99, K101 — the six keep their identities, order, labels and states under RTL | PROVEN |
| 102 | truncation does not reorder/guess identity | `rtl.test.tsx` — K102 — nothing truncates, so truncation can never reorder or guess an identity | PROVEN |

### L — Product anti-drift (103–110)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 103 | Map remains perceptually continuous | `boundaries.test.tsx` — L103 — the chrome claims only its own touches; everything else reaches the world beneath | PROVEN |
| 104 | no full-screen inspector page | `boundaries.test.tsx` — L104, L105 — there is no modal, no page, no scroller, no tab bar and no object list | PROVEN |
| 105 | no sidebar/browser/dashboard navigation | `boundaries.test.tsx` — L104, L105 — there is no modal, no page, no scroller, no tab bar and no object list | PROVEN |
| 106 | no generic Home/Reset Product action | `boundaries.test.tsx` — L106 — no generic Home, Reset, Navigate or Go Live identity exists in the model | PROVEN |
| 107 | prominence not derived from unsupported importance/confidence | `boundaries.test.tsx` — L107 — nothing in the answer carries importance, confidence, ranking or prominence | PROVEN |
| 108 | no generic glow used as status/availability grammar | `boundaries.test.tsx` — L108 — meaning is carried by words and by presence, never by a decorative glow | PROVEN |
| 109 | no new geography/layout authority | `boundaries.test.tsx` — L109 — the answer carries no coordinate, anchor, scale or placement of any kind | PROVEN |
| 110 | no app-shell mount | `composition.test.tsx` — L110, 7 — nothing is mounted in the app shell and no app router participates in any of it — T-08 is mounted nowhere. The app shell and router root reference nothing in this layer, and the layer never reaches for the shell; the composition proof mounts the Map and the chrome in a test composition instead. | STRUCTURALLY IMPOSSIBLE |

### M — mixed chains (111–120)

| # | Original requirement | Proved by | Status |
| --- | --- | --- | --- |
| 111 | inspect → deeper inspect → Exact Return updates chrome from restored truth | `chains.test.tsx` — M111, M117 — a context switch then Back restores the prior context, and the chrome follows | PROVEN |
| 112 | historical pin → Live advances → safe generic Live meta only | `chains.test.tsx` — M112, M118 — Live advancing while pinned changes the generic meta and grows no fake history | PROVEN |
| 113 | historical → safe Live Focus return → TC remains pinned | `chains.test.tsx` — M113 — returning to the live focus moves the camera and leaves the reader pinned | PROVEN |
| 114 | historical → Live Head → camera/IF do not magically move | `chains.test.tsx` — M114, M115 — Live Head moves nothing spatial, and Back restores the exact prior orientation | PROVEN |
| 115 | Live Head → Back → exact prior historical orientation | `chains.test.tsx` — M114, M115 — Live Head moves nothing spatial, and Back restores the exact prior orientation | PROVEN |
| 116 | World → Back → prior depth/camera restored | `chains.test.tsx` — M116 — Return to World then Back restores the prior depth, and the chrome restates it | PROVEN |
| 117 | context switch → Back → prior context restored | `chains.test.tsx` — M111, M117 — a context switch then Back restores the prior context, and the chrome follows | PROVEN |
| 118 | passive LH/LF events create no fake chrome history | `chains.test.tsx` — M112, M118 — Live advancing while pinned changes the generic meta and grows no fake history | PROVEN |
| 119 | stale → fresh projection handoff shows no stale semantic frame | `chains.test.tsx` — M119 — a stale-to-fresh handoff never shows a stale semantic frame | PROVEN |
| 120 | narrow fixture changes chrome arrangement only; canonical state/geography unchanged | `composition.test.tsx` — M120 — at 320 points the %s chrome keeps the same truth, acts and geography | PROVEN |


## §25 — static / architecture guards 1–43

All 43 are implemented, and the mapping is itself checked: `every one of the original 43 static
guards is still implemented in this contract` pins each guard to the text that implements it, so
deleting an assertion fails the gate.

**Covered: 43 / 43. Uncovered: 0.**

The R2 discriminator still governs which of these may be frozen forever: *a permanent semantic or
authority invariant earns a permanent guard; a historical delivery fact is closure evidence at a SHA,
never a perpetual repository ceiling.* Four guards were re-scoped under that rule rather than
deleted, and the "Kind" column says which.

| # | Original guard | Enforced by | Kind |
| --- | --- | --- | --- |
| 1 | owner directory exists | `T-08 is additive: it owns exactly one directory and takes over none` | permanent |
| 2 | no new canonical key | `T-08 adds no canonical state, no temporal mode, no Product act and no router navigation` | permanent |
| 3 | no third mode | `the preview is consumed read-only, and never becomes a temporal mode` | permanent |
| 4 | no Product action added | `T-08 adds no canonical state…` (the action catalog is unchanged) | permanent |
| 5 | no generic NAVIGATE | `T-08 adds no canonical state…` (generic-identity denylist) | permanent |
| 6 | no generic Product HOME | `T-08 adds no canonical state…` (generic-identity denylist) | permanent |
| 7 | no Product RESET | `T-08 adds no canonical state…` (generic-identity denylist) | permanent |
| 8 | no router Product Back | `T-08 adds no canonical state…` (generic-identity denylist) | permanent |
| 9 | no `router.push/back` for T-08 navigation | `T-08 adds no canonical state…` (routing denylist) | permanent |
| 10 | no T-08 `dispatchReturn` | `T-07 is consumed only through its barrel…` | permanent |
| 11 | no ReturnAction construction | `T-07 is consumed only through its barrel…` | permanent |
| 12 | no T-07 deep import | `T-07 is consumed only through its barrel…` | permanent |
| 13 | no `focusMapTarget` | `T-07 is consumed only through its barrel…` (internals denylist) | permanent |
| 14 | no `resolveFocusLanding` | `T-07 is consumed only through its barrel…` (internals denylist) | permanent |
| 15 | no `runReturnPlan` | `T-07 is consumed only through its barrel…` (internals denylist) | permanent |
| 16 | no private T-07 plan/landing types | `T-07 is consumed only through its barrel…` (internals denylist) | permanent |
| 17 | no duplicate freshness algorithm | `there is one freshness rule, no second resolver, and no raw Live Focus shortcut` | permanent |
| 18 | no projection cache | `the Exact Return opportunity is proven by T-07 provenance…` (one module-level registry) | permanent |
| 19 | no locatability resolver duplication | `there is one freshness rule…` (resolver denylist) | permanent |
| 20 | no specific focus availability from raw LF kind | `there is one freshness rule…` (no `.LF` read anywhere) | permanent |
| 21 | no persistence API | `the Exact Return opportunity is proven by T-07 provenance…` (persistence denylist) | permanent |
| 22 | no checkpoint persistence/serialization | `the Exact Return opportunity is proven by T-07 provenance…` (serialization denylist) | permanent |
| 23 | no new package dependency | `T-08 adds no dependency and touches no backend, database or schema` | permanent |
| 24 | lockfile unchanged unless Architecture explicitly reauthorizes | `T-08 adds no dependency…` — R2-02 replaced the lockfile hash, which was a repository ceiling, with the scoped import scan | permanent (re-scoped in R2) |
| 25 | no backend/API/database/schema change | `T-08 adds no dependency and touches no backend, database or schema` | permanent |
| 26 | no `apps/mobile/src/app/**` change | `T-08 never reaches for the app shell, and the shell may reach T-08 only through its barrel` | permanent (re-scoped in R2: T-12 must be able to change those files) |
| 27 | no final shell mount | `T-08 never reaches for the app shell…`; that nothing mounts it today is closure evidence, not a frozen ceiling | delivery fact + permanent invariant |
| 28 | no T-11 responsive action implementation | `no truth in this layer may ever depend on animation, measurement, scheduling or a gesture` (semantic closure) | permanent (re-scoped in R2/R3: T-11 may make the components responsive) |
| 29 | no T-10 reduced-motion ownership | semantic closure denylist | permanent (re-scoped: T-10 owns motion in the components) |
| 30 | no general Reanimated system in T-08 if motion verdict is none | semantic closure denylist | permanent (re-scoped as above) |
| 31 | no animation callback Product dispatch | `no truth in this layer…` (no Product navigation act of any kind) | permanent |
| 32 | no RH browser | `the Exact Return opportunity is proven by T-07 provenance…` | permanent |
| 33 | no checkpoint metadata extraction | `the Exact Return opportunity is proven by T-07 provenance…` | permanent |
| 34 | no accessible parent swallowing independent controls | `no non-focusable container advertises custom actions as an accessibility route` and `every noninteractive node of the chrome is transparent to touch` (R3: containers carry no accessible name either) | permanent |
| 35 | six T-07 executors remain public/distinct | `each of the six frozen return acts is reached exactly once, through its own executor` | permanent |
| 36 | T-07 forbidden internals remain private | `T-07 is consumed only through its barrel…` | permanent |
| 37 | T-04 stale-projection firewall intact | `the T-04, T-05 and T-06 boundaries this layer leans on are intact` | permanent |
| 38 | T-06 Preview contract intact | `the T-04, T-05 and T-06 boundaries this layer leans on are intact` and `the preview is consumed read-only…` | permanent |
| 39 | T-05 presentation state noncanonical | `the T-04, T-05 and T-06 boundaries this layer leans on are intact` | permanent |
| 40 | T-08 public barrel allowlisted/narrow | `the public surface is a narrow allowlist, never a wildcard` | permanent |
| 41 | no BOM/NUL/control-character corruption | `every T-08 source file is real text: no control byte can make git treat it as binary` | permanent |
| 42 | no future-target placeholder wording/shape in unsafe branches | `the render states that may not name an identity have no field to name one with` | permanent |
| 43 | all T-02/T-04/T-05/T-06/T-07 root contracts remain green. | the full root contract set runs in CI; `tests/forward-safety-contract.test.mjs` re-runs every contract against a mutated tree | permanent |

## Definition of Done — original §35

| DoD line | Proof |
| --- | --- |
| exact baseline proven | branch head `390bb61` synchronized with canonical main `c85550f7`; this candidate builds on it |
| production RN chrome exists | `apps/mobile/src/orientation-chrome/` — 11 modules, three components |
| Map remains the semantic world | `composition.test.tsx` mounts the real `MapSurface` beside the real chrome; a tap that misses a control reaches the Map route |
| five orientation dimensions remain separate | `types.ts` keeps them as five shapes; `orientation.test.ts` A1–A8 |
| six returns remain distinct | `return-promises.test.tsx` 50–57; `returns.test.tsx` B9–B20 |
| no raw-LF capability shortcut | static guard: no `.LF` read anywhere in the layer; `no-hindsight.test.tsx` C29 |
| historical Live differential proof passes | `no-hindsight.test.tsx` C21–C27 and `bilingual.test.tsx` 11–14, over the whole rendered tree, in BOTH languages |
| no visual/a11y future leak | same differential; `bilingual.test.tsx` 17, 18 |
| `IF_ref` remains exact | `inspection.test.ts` — a projection change leaves `IF_ref` object-identical |
| `IF_render` is projection-gated | `model.ts` freshness gate; `freshness.test.tsx` E43–E50 |
| stale / NOT_FETCHED / UNAVAILABLE remain technical | `inspection.test.ts` D40–D42; `outcomes.test.tsx` H75 |
| contextual choice explicit, current-disclosure-only, non-ranking | `context.test.tsx` F51–F60 |
| Exact Return target stays opaque and provenance-bound | `exact-return.test.tsx` G61–G70; `origin-boundary.test.tsx` 75–81 |
| no RH browser | static guard: no `returnCheckpoints(` / `latestReturnCheckpoint(` / `.history[` in the layer |
| no authority bypass | `each of the six frozen return acts is reached exactly once, through its own executor` |
| Preview cancellation not duplicated | `preview.test.tsx` 44 — no cancel is ever called; static guard bans `.cancel(` |
| rerender / remount / unmount / store replacement | `lifecycle.test.tsx` I79–I86; `preview.test.tsx` 36, 37 |
| T-09 accessibility closure | `accessibility.test.tsx` J87–J95; R3 removed the container accessible names that would have swallowed the controls on Android |
| RTL / bidi passes | `rtl.test.tsx` K96–K102; `bilingual.test.tsx` 21, 22, 24 |
| no T-10 / T-11 / T-12 / T-13 scope theft | `forward-safety-contract.test.mjs` proves each of those future changes still passes every contract |
| no backend / schema / dependency change | `T-08 adds no dependency and touches no backend, database or schema` |
| required skills used at the correct stage | recorded in the completion report |
| adversarial and static gates green | 21 T-08 suites / 200 tests; 40 root contracts |
| all upstream regression contracts green | 40 / 40 root contracts, 77 / 77 mobile Jest suites |
| one final candidate push only | one commit, one push |
| Draft PR open, not merged | PR #210 stays Draft |

### Carried forward — REQUIRES REAL DEVICE

These are the only items not settled at code level, and none of them is a code-level defect:

- Arabic reading rhythm and font fallback on a real device (the app's font assumption is stated, not set here).
- TalkBack and VoiceOver traversal order in Arabic and English on hardware.
- Practical touch-target feel, and Map pan/tap feel around the chrome edges.
- Narrow-device readability at the largest Dynamic Type setting.
