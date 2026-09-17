# QANDEEL — Matching / Introduction Runtime v1

**Phase:** `I-07 — Introductions / Matching Runtime` — **OPEN**
**Slice:** `I-07A — Matching Foundation, Participation & Private Authority Runtime v1` —
**CLOSED / FROZEN**
**Architecture authority:** `QANDEEL_CW2-06 — Introductions / Matching Runtime Architecture v1.0 —
CLOSED / FROZEN`, with binding `CW2-01`–`CW2-05` and `CW2-08`
**Migrations:** `0108_matching_participation_private_setup_foundation_v1.sql`,
`0109_matching_setup_human_authority_commands_v1.sql`

This document records what `I-07A` implemented, what it deliberately did not, and where each deferred
capability is owned. It does not close `I-07` and it does not restate the frozen architecture.

---

## 1. What Matching v1 is

Matching v1 is exactly one Product capability: **`MARRIAGE_INTRODUCTION`**. It is hosted from
`MY_WORLD`, it is a doorway capability, it is private by default and it is mediated by QANDEEL.

It is **not** a Shared World, a dating feed, a candidate marketplace, a searchable people directory, a
leaderboard or a direct-contact channel, and `I-07A` creates nothing that could become one. A later
Mutual Match will create exactly one `SHARED_WORLD / INTRODUCTION`; that World is owned by `I-07C` and
is neither created, reserved, pre-created nor simulated here. The already-merged kernel facts stand
unchanged: `INTRODUCTION` is a Shared World **phase** rather than a World type, a prospective Matching
proposal is not a World, Matching Context Admission is capability-scoped with no target World, and
Matching private context does not transfer into Shared World reasoning.

## 2. Three independent authorities

`I-07A` implements three separate truths, which are independently mutable, independently inspectable,
and none of which may silently create another.

| Authority | What it is | What it is not |
|---|---|---|
| `MATCHING_PARTICIPATION_STATE` | whether this human participates in Matching right now | not a grant, not a profile, not a disclosure permission |
| `MATCHING_CONTEXT_GRANT` | explicit authority for QANDEEL to reason from this human's own eligible self-authored `MY_WORLD` context, for the Matching capability only | not participation, not a Shared Standing Context Grant, not material disclosure |
| `PRE_MATCH_PROPOSAL_DISCLOSURE_AUTHORITY` | explicit authority for bounded future pre-Match proposal disclosure of exact Introduction Profile fields | not a proposal, not raw private evidence, not direct contact data |

The separation is structural rather than conventional. The three families share no foreign key,
trigger or generated column, and no participation command has a database path into a grant, a profile,
a requirement version or a disclosure authority — so turning participation off revokes nothing, and
holding a grant creates no participation. Whether a grant is **effective** for future candidate work
is gated by participation later, in `I-07B`; its authority history stays separate here.

## 3. Current state is a pointer, never a second copy

Every current truth is an explicit pointer to an exact historical identity, bound by a **composite**
foreign key so it can only ever name a row of its own human:

```text
matching_participation_state (participant_user_id, current_event_id)
  -> matching_participation_events (id, participant_user_id)

introduction_profile_state (owner_user_id, current_profile_version_id)
  -> introduction_profile_versions (id, owner_user_id)

matching_requirement_state (owner_user_id, current_requirement_version_id)
  -> matching_requirement_versions (id, owner_user_id)
```

The current participation state **is** the resulting state of the act the pointer names and is stored
nowhere else, so divergence is unrepresentable rather than merely avoided and "latest timestamp wins"
decides nothing. Absence of a pointer row is `OFF`: participation is never inferred from a profile, a
requirement set, a grant, a disclosure authority or conversation history.

Every family carries a prior-identity link with a partial unique index, so an identity is superseded
at most once and the history is a **chain** rather than a tree. A truth trigger additionally refuses a
pointer move whose target does not chain from the value being replaced, which binds the table owner
too: even a direct write cannot fork a human's history or graft another human's identity onto it.

## 4. Participation, and why its resume path is safe for I-07C and I-07D

The frozen vocabulary is `OFF | ACTIVE | PAUSED`. All five `CW2-06` pause reasons are representable.
Only `USER_PAUSED` has an `I-07A` producer; `ACTIVE_INTRODUCTION`, `POST_INTRODUCTION`, `POST_SUCCESS`
and `SYSTEM_POLICY` are reserved for `I-07C` and `I-07D` exactly as migration 0089 carries reserved
material kinds that pin no producer. `I-07A` does not fabricate an active Introduction or a
system-policy engine in order to exercise them.

The two frozen entry channels, `CONVERSATIONAL_ENTRY` and `MANUAL_MY_WORLD_ENTRY`, are activation
**provenance**, carried by an activation row and by nothing else. An offer, a prompt or a suggestion
from QANDEEL is not an activation and has no representation at all.

Two rules keep the `I-07A` resume path from becoming a bypass of a gate it does not implement:

1. `resume_matching_participation_v1` lifts `PAUSED / USER_PAUSED` and refuses every other pause
   reason with a bounded `MATCHING_PAUSE_NOT_USER_RESUMABLE`.
2. Activation is not a way around rule 1. It requires the current state to be `OFF`, so it can never
   be applied to a pause directly — and an `OFF` reached **from** a pause `I-07A` may not resume is
   refused with `MATCHING_REACTIVATION_REQUIRES_REVALIDATION`, because the obvious bypass is two steps
   rather than one: turn off while system-paused, then activate as though nothing had happened. The
   check is exactly one hop along the immutable chain, and one hop is the whole of it: the only way a
   human reaches `OFF` from a pause is that single `TURN_OFF` act, and the chain cannot fork.

Opting out is never blocked. It is the human's own privacy authority and works from any state,
including a pause `I-07A` cannot resume; it simply does not launder the pause.

## 5. The bounded field representation

The Product's Introduction Profile field catalogue is **deferred by CW2-06** and neither migration
decides it. A field is a bounded lower-case identifier key (`^[a-z][a-z0-9_]{2,47}$`) with a bounded
private text value, so the catalogue stays configurable without a speculative marriage questionnaire
being frozen into DDL.

What the representation may never become is an arbitrary channel. There is no JSON and no array
column, the value is structurally ceilinged, and a key may not name a **direct contact route** or an
**identity document** — phone, email, a social handle, a street or geographic address, a photo or
other media handle, a URL, an identifier number or a KYC artifact. That ban is what makes "no photo or
contact disclosure behaviour in `I-07A`" and "no mandatory documentary identity verification"
structural rather than a comment: a disclosure authority approves a **field key**, and no field key
can name a contact route.

The ban is token-delimited, so `handles_conflict_well` is an ordinary profile field while
`whatsapp_handle` can never exist. It bans a contact-route **field**; it does not police free text a
human writes about themselves, and it freezes no Product catalogue decision.

Requirements use the same representation and carry the frozen distinction `HARD_DEALBREAKER |
SOFT_PREFERENCE` and nothing beside it: no weight, score, rank, percentage or priority column exists,
because `I-07A` stores the human's self-declared requirement truth and evaluates no candidate. A
strength is never silently converted, because a committed item is immutable and a changed requirement
is a new version.

## 6. An authority over V1 never covers V2

A Pre-Match Proposal Disclosure Authority binds one exact Introduction Profile version — the
grantor's **own**, by composite foreign key — and each approved field is bound by composite foreign
key to a **real field row of that exact version**:

```text
pre_match_disclosure_authority_fields (authority_id, introduction_profile_version_id)
  -> pre_match_disclosure_authorities (id, introduction_profile_version_id)

pre_match_disclosure_authority_fields (introduction_profile_version_id, field_key)
  -> introduction_profile_field_values (profile_version_id, field_key)
```

A V1 authority therefore cannot name a V2 field even by accident: structural impossibility, not a
runtime check that could be forgotten. When the profile moves on, the old authority stays bound to the
old version — including to a field the new version no longer has — and a new authority over the
superseded version is refused. Re-approving is an explicit act over the version the human is looking
at, and it creates a new authority identity while revoking the old one as history.

There is deliberately no recipient, pair, proposal or candidate column anywhere: no proposal recipient
exists in `I-07A`, and inventing an identifier for one would be pre-implementing `I-07B`.

## 7. The command boundary

Eleven boundaries, all `SECURITY DEFINER` with a pinned empty `search_path`, all deriving their human
from `auth.uid()`, all executable by `authenticated` and by nothing else. `PUBLIC`, `anon` and
`service_role` receive nothing: the server may facilitate the experience later, but possession of the
service-role credential must never be able to manufacture, widen or withdraw a human's Matching
participation or consent.

```text
activate_matching_participation_v1       pause_matching_participation_v1
resume_matching_participation_v1         turn_off_matching_participation_v1
grant_matching_context_v1                revoke_matching_context_v1
set_introduction_profile_v1              set_matching_requirements_v1
grant_pre_match_disclosure_authority_v1  revoke_pre_match_disclosure_authority_v1
get_my_matching_setup_v1
```

Four participation commands rather than one command with a kind parameter: the act is fixed by
**function identity** exactly as the grant semantics are fixed by table identity, so a caller cannot
spell an act, cannot spell a pause reason, and cannot reach the resume path by asking an activate
command for it.

The command id **is** the primary key of the row each command commits — a participation act, a consent
event, a profile version, a requirement version, a disclosure authority event — so there is no second
idempotency table and no idempotency key that can drift from the result. An equivalent retry returns
the already committed result read back from the committed row rather than echoed from the retry's own
arguments; the same id carrying a different request fails closed with `23505`, and the comparison
covers the whole immutable request including the exact committed field or key set. Every consequential
command names the exact current identity it expects, and any other current state is a bounded `40001`.

## 8. No oracle

No command takes a human identifier, so a caller cannot even phrase a question about someone else, and
the self-inspection projection `get_my_matching_setup_v1()` takes no parameter at all. A grant,
authority or version that is not the caller's own is reported through the same bounded error as one
that never existed. There is no list-all-users, no list-all-profiles, no candidate search and no
existence probe of any kind.

The projection answers with identities and states only — never a profile field value, a requirement
value or a private reason — so it is a setup mirror and can never become a candidate browser or a
content read path. Reading one's own field values back is deliberately deferred: no Product surface
needs it yet, and it is the one place a generic output channel could grow.

## 9. Lock order

```text
matching_setup_locks                 FOR UPDATE   the caller's own row, first and always
  -> introduction_profile_state      FOR SHARE    disclosure grant only
     introduction_profile_versions   FOR SHARE    disclosure grant only
  -> the family the command owns     FOR UPDATE
```

`public.matching_setup_locks` is the per-human serialization row and the whole of its own concern: it
carries a human and a birth instant, no authority, no state and no participation fact, and its
existence for a human says only that some Matching command of theirs once ran. It is not a participant
directory — no application role can read it and no command accepts another human's identifier.

Every command takes it through the same upsert-and-lock statement before it reads, compares or changes
anything. A command only ever touches rows of **one** human — its own `auth.uid()` — so two humans can
never contend, and two commands of the same human are serialized by that human's lock row before they
can reach anything else. There is no cycle to deadlock on, no advisory lock and no process-local
mutex.

## 10. The `I-07B` seam

`I-07A` opens no server-side read path. The private relations exist, sealed: RLS enabled with zero
policies, postgres-owned, and every application role revoked from every privilege. `I-07B` will add
its own service-tier derivation over this state in its own reviewed migration — which the `0109`
verifier proves is possible without any `I-07A` assertion refusing it — rather than inheriting a
boundary opened speculatively now. Creating that resolver here would be pre-implementing `I-07B`.

## 11. Anti-scope

`I-07A` deliberately does not implement, and nothing in migrations 0108 or 0109 can represent:

- **`I-07B`** — candidate discovery or selection, pair evaluation, `PAIR_KEY`,
  `CANDIDATE_ELIGIBILITY_SNAPSHOT`, candidate-side `PASS | FAIL | UNKNOWN`, Safe Compatibility
  Conclusion generation, the Sensitive Conclusion Filter, the Matching Proposal Disclosure Gate,
  proposal cadence or pending limits, any proposal object or state, recipient proposal views, first /
  second proposal choreography, decline / expiry / withdraw / stale transitions.
- **`I-07C`** — `ACTIVE_INTRODUCTION_SLOT`, `MATCH_COMMIT_ID`, Mutual Match, the two-human exact-view
  acceptance commit, single-winner competing-match concurrency, Introduction Record creation,
  `SHARED_WORLD / INTRODUCTION` birth, the Matching handoff package, competing-proposal cancellation.
- **`I-07D`** — active Introduction progressive disclosure, image / name / contact staged disclosure,
  the Introduction success transition to `STANDARD`, unilateral Introduction end, slot release,
  post-Introduction and post-success resume revalidation, `I-07` phase closure reconciliation.
- **Later phases / deferred Product work** — mobile Matching UI, `I-08` Mobile Integration, safety /
  report / block, launch feature flags, entitlements, production clearance, pricing, mandatory KYC or
  documentary identity verification, a candidate ranking model, any compatibility percentage or score,
  the final Introduction Profile field catalogue, exact proposal copy, the exact weekly proposal count,
  the exact proposal expiry duration, the exact pending-proposal maximum, and pair cooldown policy.

None of these is admitted to the canonical backlog by this slice. Each is owned by the frozen `CW2-06`
and `CW2-08` contracts or by the named later `I-07` slice, and a contract that already owns a
capability does not also need a backlog entry claiming it (`BG-06`).

## 12. Verification

```bash
npm run test:database                                                     # static contracts
npm run verify:db:hazards                                                 # verifier-hazard gate
npm run verify:matching-participation-private-setup-foundation:integration
npm run verify:matching-setup-human-authority-commands:integration
```

Both real-PostgreSQL verifiers need `DATABASE_URL` pointing at a fully migrated database and run in
API CI as one reported group after the `I-06D` group. Both report every scenario independently through
the permanent aggregator, so one defect cannot hide the rest.

The verifiers reach the four reserved pause reasons — which have no `I-07A` producer on purpose — only
as the table owner inside a scenario that rolls back, and every weakening probe restores the
production definition and proves it back byte for byte. No permissive definition is ever left
installed. The serialization row is proven by a real committed race on two connections.

## 13. Status and closure record

`I-07A` is **CLOSED / FROZEN**. `I-07` remains **OPEN**; this closure does not start or close `I-07B`,
`I-07C`, or `I-07D` and does not change any Product/runtime semantic above.

Independent ChatGPT Architecture review passed on implementation head
`fe61641f2205a464e1afa6ac35592b683a018b2f`. The review covered the actual PR diff, migrations
`0108`/`0109`, the command and authority boundaries, the real-PostgreSQL verifiers, the exact-head CI
state, and the order of the implementation/fix commits. No runtime, schema, verifier, or test-semantic
finding required a revision.

**BG-08 reconciliation:** no newly discovered cross-task obligation qualifies for admission from
`I-07A`. The deferred capabilities listed in §11 are already owned by frozen `CW2-06` / `CW2-08` or by
the named later `I-07` slices, so duplicating them in the canonical backlog would violate the intent of
`BG-06`. No existing open canonical-backlog item is owned by `I-07A`, so there is no inherited item to
tombstone, re-own, or carry forward here.

**BG-09 synchronization:** the stale `CANDIDATE — awaiting independent ChatGPT review` banner was the
pre-review state of this same task. This closure sync records that transition rather than leaving the
primary document stale. `I-07` itself remains OPEN and its phase-level closure record stays owned by the
closing slice of the phase.
