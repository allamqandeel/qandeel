# I-04 — Shared World Lifecycle / Conversation Runtime v1

**Status:** `I-04 — CLOSED / FROZEN`
**Phase:** Connected Worlds v2 — `I-04`
**Closing task:** `I-04G — Shared Conversation / Material Commit Runtime + I-04 Closure v1`
**Baseline:** `22343431ab57ad8b16e7ce4629038410c98c7031` — the merge of PR #246, which closed I-04F
**Authority:** implements the frozen `CW2-01`, `CW2-02` and `CW2-03` contracts. It defines no Product
semantic of its own, and nothing recorded here authorizes a route, a client surface or a launch.

This document is the primary canonical record of the `I-04` phase. It inventories what I-04A→I-04G
built, states precisely what remains unbuilt, and is the banner `BG-09` governs. It is **not** a
declaration that I-04 is closed: the lifecycle line above is the current state, and only the change
that actually closes the phase may move it.

---

## 1. What I-04 was for

`I-03` finished the Shared authority chain: who may reason over what, for which audience, and whether
a produced output is still current. It deliberately stopped at a boundary it named exactly:

```text
READY_FOR_LATER_DELIVERY_GATES
  != System / Safety clearance
  != Launch Gate clearance
  != delivery / commit permission
```

I-04 is what stands behind that boundary: the Shared World itself. A World has to be born, gain and
lose members under governance, carry settings, disclose its own history selectively, close, and — last
— actually hold the material all of that governs. Without the last part, every authority I-04A→I-04F
built governed nothing.

---

## 2. Inventory

| Slice | What it established | Migrations | PR |
| --- | --- | --- | --- |
| `I-04A` | Direct invitation runtime: a secret rotatable invite credential, its epoch rule, and `PENDING` invitations that create **no World** | `0081` | #238 |
| `I-04B` | Direct World birth: one atomic transaction turning an accepted invitation into a born `ACTIVE / STANDARD` World with two membership episodes | `0082` | #239 |
| `I-04C` | Standard voluntary leave: a unilateral, episodic, history-preserving departure that revokes no Standing Context Grant | `0083` | #240 |
| `I-04D` | Governance approval foundation: the exact membership snapshot and the proposal/approval substrate every later governed operation binds to | `0084` | #242 |
| `I-04E` | Governed membership lifecycle and Shared settings: add / remove / rejoin under unanimity, and unanimous settings changes | `0085`, `0086` | #244 |
| `I-04F` | Selective historical access and Standard World closure: the history-visibility projection, the immutable package manifest, the `HISTORY_ACCESS_GRANT`, and archival closure with a bounded `CLOSED_WORLD_VIEW_ENTITLEMENT` | `0087`, `0088` | #246 |
| `I-04G` | Shared conversation / material commit runtime: real `HUMAN_TEXT`, `HUMAN_VOICE_NOTE`, `QANDEEL_OUTPUT` and `QANDEEL_ANALYSIS`, their provenance, and human owner deletion | `0089`, `0090` | this PR |

The PR column records where each slice's implementation evidence lives. The authoritative record of
each slice is its own migration, static contract and real-PostgreSQL verifier, all of which are in the
repository; this table is an index into them, not a substitute for them.

---

## 3. What I-04G added, precisely

### 3.1 The material envelope (migration `0089`)

One material is one envelope bound **one-to-one** to exactly one I-04F history item in exactly one
Shared World, plus exactly one normalized body in the relation its kind structurally requires. The
frozen `CW2-03 §36` vocabulary is complete in the envelope; `HUMAN_TEXT`, `HUMAN_VOICE_NOTE`,
`QANDEEL_OUTPUT` and `QANDEEL_ANALYSIS` pin their producer exactly, and `EXPLICIT_DISCLOSURE` and
`WORLD_EVENT_DERIVED_MATERIAL` are RESERVED with no producer path at all.

There is no universal JSON payload, no generic content column, no owner/admin/moderator column and no
mutable audience blob. Availability, audience and material authority stay on the frozen I-04F
projection: this slice adds neither a second history model nor a second audience model.

Provenance keeps `MATERIAL_DEPENDENCY`, `REASONING_DEPENDENCY` and `INDEPENDENT_TARGET_TRUTH` apart by
one exact-shape constraint, and a `MATERIAL_DEPENDENCY` cycle is **unrepresentable** — each edge carries
both endpoints' establishment instants and requires the source's to be strictly earlier.

One narrow server-only resolver, `resolve_shared_world_material_v1`, CONSUMES the frozen I-04F
visibility entry point and intersects it with the bodies that still exist. It returns no row for hidden
or deleted material — no count, no placeholder — and no provenance source, private context reference,
material authority row or membership data.

### 3.2 The commit runtime and owner deletion (migration `0090`)

A material commit is ONE transaction producing the envelope, its body, the history item, that item's
exact original human audience, its exact human material authorities, its provenance and its durable
command — or none of them. `clock_timestamp()` is read exactly once per commit and written to every
authoritative moment.

Human material carries the exact human author as its only required approver; membership co-owns
nothing. QANDEEL material derives its **known** required-approver set as the exact union over its
`MATERIAL_DEPENDENCY` sources, never every member, and never anything a `REASONING_DEPENDENCY`
contributed. Historical-sharing authority is resolved separately from that enumerable set: a target
is `UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` when it has any `REASONING_DEPENDENCY`, when any
`MATERIAL_DEPENDENCY` source is itself not positively resolved, or when the runtime has no positive
server-owned proof that the exact target has no protected-human requirement. Known approver rows are
retained even when an additional requirement is unresolved. At this baseline the current QANDEEL
producer cannot positively establish `RESOLVED_NO_HUMAN_REQUIREMENT`; that value remains representable
for a future reviewed resolver rather than being inferred from an empty dependency/approver set.
Missing or contradictory source authority metadata fails closed.

The QANDEEL core binds the exact I-03 operation evidence to the exact body bytes, recomputing the
I-03G readiness fingerprint in SQL rather than trusting it, and one readiness commits at most one
material. It reinterprets `READY_FOR_LATER_DELIVERY_GATES` as nothing: the evidence relation carries no
system-safety, launch-gate or delivery-permission column, and the migration refuses to deploy if one
appears.

It also **revalidates the audience**. The supplied audience snapshot reference must equal the canonical
I-03D fingerprint of the World's CURRENT audience, recomputed in SQL under the World lock from the same
rows that become the baseline viewers. Because that fingerprint is per (user, **episode**) and carries
the exact World, a leave, a same-human rejoin, a governed add or remove, and evidence generated for a
different World each stale it — so an output cannot be silently delivered to an audience it was never
revalidated against, and cross-World evidence reuse fails at the database boundary.

What SQL cannot see is the I-03F result behind an opaque `authorityRevalidationRef`. That half is bound
by one narrow server-internal adapter,
`apps/api/src/connected-worlds/material-commit/shared-qandeel-material-commit-binding.ts`, which
consumes the already-frozen typed I-03F and I-03G results and refuses to assemble commit inputs unless
`targetWorldId`, `outputDigest`, `effectiveContextRef`, `authorityRevalidationRef` and
`audienceSnapshotRef` all describe the same operation, output and World. It is registered in no module,
imported by nothing, performs no I/O, and grants nothing — the database still decides.

**Durable idempotency binds the whole immutable request**, not part of it. Each commit computes one
versioned `material_commit_request_ref` covering the World, material and history identities, the kind,
the exact body, the media reference, the transcript and the **duration** (presence distinguished from
value), every I-03 evidence reference, the audience snapshot and both canonically ordered dependency
sets. Set order cannot change identity; set content always does. All three retry paths — pre-lock,
under-lock and unique-violation recovery — decide on that one identity, and every count a retry reports
comes from committed rows rather than from the arrays the retry supplied.

Owner deletion makes reconstruction impossible rather than merely hidden: the body row is physically
removed — human text, audio object reference and stored transcript together — and the history item
becomes terminally `DELETED_BY_OWNER`. Every transitively source-content-bearing target becomes
`UNAVAILABLE` and loses its body; analytical derivatives survive; provenance identity is never erased;
a history grant audit and a closed-World entitlement audit both survive while neither can reconstruct
the source.

---

## 4. Unresolved historical-sharing authority, and why it fails closed

Task §9 admits **two** contributors to the QANDEEL required-approver set: the human authorities
propagated from `MATERIAL_DEPENDENCY` sources, **and** "any additional exact protected-human
subject/material authorities produced by an already-reviewed server-owned authority source, **if such a
canonical source exists**".

In this repository the second does not exist. The whole I-03 chain terminates at
`materialDisclosureAuthority: NOT_GRANTED` and `provenanceDisclosure: SEALED` and produces no
protected-subject authority set of any kind. Accepting one as a parameter would be exactly the
"app/client supplies final authority claims" that the same section forbids, and manufacturing one would
be engineering inventing missing Product logic (`AGENTS.md` §2).

**What does not follow is that the requirement is empty.** "We cannot compute it" and "we computed it,
and there is none" are different facts, and the frozen rule is explicit: *missing or unresolved
authority metadata never means approval-free*. So I-04G records which of the three it actually is, in
`shared_world_material_historical_authority`:

```text
RESOLVED_EXACT_HUMAN_REQUIREMENT        the exact required humans are known
RESOLVED_NO_HUMAN_REQUIREMENT           there is genuinely no human requirement
UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT an additional human requirement may exist and is not resolvable
```

QANDEEL material carrying **any** `REASONING_DEPENDENCY` is `UNRESOLVED` — including when it also
carries known `MATERIAL_DEPENDENCY` owners, because those known owners do not resolve the whole
requirement. The same rule propagates through `MATERIAL_DEPENDENCY`: if any source carries an unresolved
additional human requirement, the target remains unresolved no matter how many known approvers are
also enumerable. This propagation is transitive; a known owner never answers an unknown additional
requirement one edge later. A reasoning dependency still propagates **no** material consent: no
reasoning grantor is ever turned into an approver, and the required-approver set stays exactly the
propagated material owners.

**Current delivery is untouched.** The material commits, its exact baseline audience sees it, and the
material resolver returns it. What is blocked is **historical audience widening**: a narrow additive
trigger on the frozen I-04F `shared_world_history_package_manifest_items` refuses to admit any item
whose material is `UNRESOLVED`. That is enforced in the database, at the one place widening actually
happens — not left to a future Product wrapper and not left to this document. `NO_HUMAN_APPROVAL_REQUIRED`
remains representable **only** for a genuinely positively resolved empty requirement; the current
QANDEEL producer reaches no such state. Anything unresolved keeps the exact-approver mode, so the
frozen I-04F path can never read absence of known approvers as approval-free.

The representation is additive on purpose. A later reviewed subject-authority resolver moves a row
forward to `RESOLVED`, and the same item becomes packageable with no change to the gate and no source
history rewritten.

---

## 5. Frozen laws this phase did not bend

- Shared-native truth arises from human statements, human voice notes, World events, explicit
  disclosures and legitimate QANDEEL output; reasoning-only Personal context never automatically
  becomes Shared truth (`CW2-01 §26`, `CW2-03 §38`).
- Membership `!=` historical access (`CW2-01 A9`); knowledge possession `!=` audience permission
  (`A12`); reasoning authority `!=` material disclosure authority (`CW2-02 §19`).
- Material authority is independent of World membership and survives its loss (`CW2-03 §24 / C21`).
- `MATERIAL_DEPENDENCY != REASONING_DEPENDENCY != INDEPENDENT_TARGET_TRUTH` (`I-00 §12`).
- Owner-deleted material is unavailable for future use and cannot be reconstructed by QANDEEL; no
  history grant or closed entitlement preserves it (`CW2-01 A18`, `CW2-03 §37`).
- `READ_ONLY_CLOSED` blocks ordinary mutation but permits an authorized privacy material mutation,
  which never reopens lifecycle (`CW2-03 §35 / C31`).
- QANDEEL is a system actor and never a human consent or ownership principal (`CW2-01 §7 / A3`).
- Safety, entitlement and Launch may further restrict; they never manufacture missing privacy
  authority (`CW2-02 §46`, `B30`, `B31`).

---

## 6. Completed internal runtime versus later Product execution work

This distinction is the point of this section, and it is deliberately blunt.

**What I-04 completed is an internal database runtime.** Every consequential primitive it created —
invitation dispatch, World birth, leave, governance preparation and approval, add / remove / rejoin,
settings change, history package preparation, history approval, history grant, Standard closure,
material commit and owner deletion — is executable by **no application role at all**: not `PUBLIC`, not
`anon`, not `authenticated`, not `service_role`. Every direct table is RLS-enabled with zero policies
and zero application-role privileges. The only things an application role may call are the narrow
read-only resolvers, and `service_role` alone may call those.

**What remains is Product execution work, and it is not I-04's.** In particular:

- `CW2-08` Safety / moderation / entitlement / Launch Gate — the frozen precondition that makes any of
  these primitives reachable at all;
- authenticated Product routes, controllers and public RPC;
- mobile surfaces of any kind;
- a media storage provider, upload path or storage credential for voice notes;
- history-grant withdrawal after viewing (explicitly deferred frozen policy);
- Introduction birth, success and end; Matching; Public World; Replay;
- human-to-human live call, which remains `DISABLED_BY_PRODUCT_LEGAL_GATE` (`CW2-03 §42 / C37`);
- the explicit-disclosure and World-event-derived material producers, whose authority and source
  contracts do not yet exist.

None of these is a gap in I-04. Each is a boundary I-04 stated and kept.

---

## 7. Verification

Every slice carries a secret-free static contract over its own migration and a real-PostgreSQL verifier
run in API CI against a freshly migrated database. For I-04G specifically:

```sh
npm run test:database
npm run verify:shared-world-material-persistence:integration
npm run verify:shared-world-material-commit-owner-deletion:integration
```

The static contracts prove structure before deploy — including that each migration's own
self-assertions do not reject the migration itself. The verifiers prove live catalog, ACL, behaviour,
concurrency with real independent connections, and forward safety.

`QAN-CW-REM-01` adds forward migration `0119_shared_historical_authority_remediation_v1.sql` without
editing any historical migration `0075`–`0118`. It corrects the accepted phase-wide assurance finding
`ASSURE-F02`, including the same-class transitive laundering path found during independent review:
zero-dependency QANDEEL material and every QANDEEL descendant of unresolved material now remain
`UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT` for later audience widening while baseline Shared delivery
remains unchanged. The migration also reconciles already-persisted affected authority rows forward to a
fail-closed fixed point without rewriting bodies, provenance, approvers, viewers, timestamps or frozen
`authority_requirement_mode` history.

The same remediation also resolved `ASSURE-F04` only after real PostgreSQL reproduced the claimed
cross-World deadlock with `40P01`. The corrected lock statements are scoped to the World row already
held by the transaction; the post-fix barrier-pinned race completes without a deadlock, same-World
serialization remains intact, unrelated Worlds remain concurrent, and refusal classes are preserved.

Final implementation head `${impl}` passed two complete Focused Database Verification rounds for
`0119` plus the required predecessor regressions (`0087`, `0088`, `0090`, `0093`, `0098`, `0115`,
`0118`) on that same exact target SHA, followed by green API and Mobile CI.

---

## 8. Governance

`BG-08` reconciliation for this phase is recorded in
[`docs/qandeel-canonical-backlog-v1.md`](qandeel-canonical-backlog-v1.md) §9. I-04 inherited no backlog
item, and I-04G admitted none: its anti-scope is anti-scope, and `BG-06` admits none of it.

`BG-09` governs the Status banner at the top of this document. Independent ChatGPT Architecture /
Privacy / Database / Concurrency review **PASSED** on exact implementation head `${impl}` after
`ASSURE-F02`, the same-class `REM01-AUTH-01` propagation defect, and reproduced `ASSURE-F04` were
corrected and re-verified from scratch. This same closure synchronization moves the banner to
`CLOSED / FROZEN`; no successor task is left to repair phase status.

## 9. QAN-CW-REM-01 closure reconciliation

The phase-wide Connected Worlds assurance did not reopen I-04 Product scope; it identified two defects
inside I-04's already-frozen correctness obligations. `ASSURE-F02` showed that absence of enumerable
human authority had been interpreted as a positively empty human requirement. Independent remediation
review then found `REM01-AUTH-01`, the same defect class one `MATERIAL_DEPENDENCY` edge later: a known
approver set could discard an unresolved additional-human requirement. Migration `0119` corrects both
creation and historical state transitively while preserving known approvers and baseline visibility.

`ASSURE-F04` was provisional until real PostgreSQL reproduced it. The pre-fix focused run on exact head
`bfbf11d8c65179e1bc559c55e15d14ff25038459` observed `40P01`; the final accepted head
`18dc934e67b951592838f7af33ecd7066efd84ab` proves the same barrier-pinned interleaving no longer closes a cycle after World-scoping the
relevant row locks. No advisory lock, table lock or process mutex was introduced.

**Independent review result:** PASS. No blocking I-04 finding remains from `QAN-CW-ASSURE-01` or
`QAN-CW-REM-01`. Remaining Connected Worlds assurance findings are owned by the later remediation
slices and do not reopen I-04's completed Shared runtime. I-04 is therefore **CLOSED / FROZEN**.
