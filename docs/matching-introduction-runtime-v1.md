# QANDEEL — Matching / Introduction Runtime v1

**Phase:** `I-07 — Introductions / Matching Runtime` — **OPEN**
**Slice:** `I-07A — Matching Foundation, Participation & Private Authority Runtime v1` —
**CLOSED / FROZEN**
**Slice:** `I-07B — Candidate Eligibility, Proposal & Privacy Runtime v1` —
**CLOSED / FROZEN**
**Slice:** `I-07C — Atomic Mutual Match & Introduction Birth Runtime v1` —
**CLOSED / FROZEN**
**Slice:** `I-07D — Introduction Lifecycle, Progressive Disclosure & I-07 Closure v1` —
**CANDIDATE — awaiting independent ChatGPT review**
**Architecture authority:** `QANDEEL_CW2-06 — Introductions / Matching Runtime Architecture v1.0 —
CLOSED / FROZEN`, with binding `CW2-01`–`CW2-05` and `CW2-08`
**Migrations:** `0108_matching_participation_private_setup_foundation_v1.sql`,
`0109_matching_setup_human_authority_commands_v1.sql`,
`0110_matching_pair_eligibility_proposal_persistence_v1.sql`,
`0111_matching_candidate_evaluation_disclosure_gate_v1.sql`,
`0112_matching_proposal_choreography_runtime_v1.sql`,
`0113_matching_mutual_match_introduction_persistence_v1.sql`,
`0114_matching_mutual_match_commit_transaction_v1.sql`,
`0115_introduction_progressive_disclosure_history_visibility_v1.sql`,
`0116_introduction_terminal_lifecycle_v1.sql`,
`0117_post_introduction_matching_reactivation_v1.sql`

This document records what `I-07A`, `I-07B`, `I-07C` and `I-07D` implemented, what each deliberately
did not, and where each deferred capability is owned. It does not close `I-07` and it does not
restate the frozen architecture. Sections 1–13 are the frozen `I-07A` record and are unchanged;
sections 14–26 are the frozen `I-07B` record and are unchanged; sections 27–33 are the frozen `I-07C`
record and are unchanged; sections 34–43 are the `I-07D` candidate record.

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

---

## 14. What `I-07B` is

`I-07B` is the first slice allowed to create durable Matching **pair / eligibility / proposal /
recipient-view** state. It implements the complete pre-Mutual-Match runtime up to, but not including,
the second-party acceptance commit that can create an Introduction.

```text
private Matching setup  ->  candidate eligibility  ->  bounded proposal preparation
  ->  first recipient offer  ->  first decline OR forward approval
  ->  independent second-recipient proposal  ->  second decline / expiry / withdrawal / stale
  ->  READY FOR THE I-07C ACCEPTANCE COMMIT
```

There is deliberately **no durable "accepted but not matched" intermediate state**. `SECOND_ACCEPTED`,
`ACCEPTED_PENDING_MATCH`, `MATCH_PENDING` and `INTRODUCTION_RESERVED` do not exist and cannot be
spelled anywhere in the slice, and the structural contract asserts that over the executable SQL of all
three migrations. Second-recipient acceptance must revalidate its exact view **and** converge
atomically with the Mutual Match / two-slot / Introduction-birth transaction, which is `I-07C`'s work;
a durable intermediate state is precisely what would make splitting it look possible.

## 15. The canonical unordered pair

One row per unordered pair, stored smallest member first with a CHECK and a UNIQUE over the ordered
column pair, so the reverse direction is **unwritable** rather than merely de-duplicated:
`PAIR_KEY(A,B) = PAIR_KEY(B,A)` is a property of the schema. Direction belongs to a proposal, is
immutable once prepared, and a CHECK pins the first recipient and the candidate to the two
arrangements of that pair's own members. At most one **live** proposal exists per pair in either
direction, and because the pair row is unordered a single partial unique index is the whole of the
rule. No user-facing path enumerates a pair, and no boundary returns one.

## 16. `PASS | FAIL | UNKNOWN`, and the two halves of one law

The source-class vocabulary contains only the four allowed candidate self-truth classes plus
`NOT_ESTABLISHED`. A third-party claim, and an inference from a name, a voice, a photo, a language
style or any stereotype-bearing proxy, are not refused at runtime — they **cannot be spelled**.

```sql
(requirement_outcome = 'UNKNOWN') = (evidence_source_class = 'NOT_ESTABLISHED')
```

An `UNKNOWN` therefore cannot carry a confirmed source, a `PASS` cannot exist without one, and the row
is append-only for every role including the table owner. There is no weight, score, rank, percentage
or priority column anywhere, so a strong soft signal has nothing to override a hard `FAIL` or a hard
`UNKNOWN` with.

**An unevaluated hard dealbreaker blocks exactly like an `UNKNOWN` one.** A check that only inspected
the results present would be satisfied by a snapshot carrying none at all, which is the most complete
way for a dealbreaker to go unsatisfied, so a truth trigger requires every `HARD_DEALBREAKER` of both
humans' bound requirement versions to carry a `PASS` of its own. `SOFT_PREFERENCE` items are
deliberately not required: demanding one would be the quiet promotion of a preference into a gate.

## 17. The eligibility snapshot binds exact identities and certifies nothing

Every identity the `CANDIDATE_ELIGIBILITY_SNAPSHOT` binds is bound by a **composite** foreign key to a
row of that exact human, using the composite identity keys `0108` already declares, so one human's
participation can never be bound to another's profile. The three proposal policy identities are bound
the same way with their kinds pinned, so a cadence policy can never be consumed as an expiry.

It carries no aggregate eligibility column — an aggregate would be a second copy of a truth the
results already hold — and it is never the authority for a continuing truth: every advancing step
revalidates the **current** identities. A snapshot a proposal has consumed is **sealed**, so the set it
was judged against cannot grow underneath it.

`I-07B` implements no `ACTIVE_INTRODUCTION_SLOT`. "No active Introduction" is derived live from the
canonical Shared World substrate migration `0075` owns.

## 18. The one-way privacy boundary is four relations, not four flags

```text
matching_private_reasoning_notes      private Matching reasoning
matching_safe_conclusion_candidates   untrusted input, whatever produced it
matching_permitted_safe_conclusions   filter_verdict pinned to 'PERMITTED'
matching_sensitive_filter_refusals    the PRIVATE reason, reachable by no view
```

A recipient view binds a permitted-conclusion row, and that relation's verdict column is pinned to
`PERMITTED` by a single-value CHECK — so a refused or unclassified conclusion is not filtered out at
read time, it **cannot exist** in the relation a view is able to reference. Absence *is* refusal. A
safe conclusion candidate carries no "the model says this is safe" column: provider output is
untrusted input and the only verdict that exists is the filter's own.

The `SENSITIVE_CONCLUSION_FILTER` is deterministic and fail-closed. It refuses a contact route, hidden
provenance, a long verbatim quoted span, visible ranking language and an unauthorized sensitive fact;
it records an unclassifiable result as a **refusal**; an unconfigured filter policy refuses the call
outright, because there is no "filter unavailable, so allow" path; and it refuses a conclusion that
carries a private reasoning note of its own snapshot word for word **with no quotation marks**, which
is the leak a regex-only redaction layer never catches.

The five classifiers are IMMUTABLE pure functions and each is the runtime half of a CHECK the database
already carries. They are two implementations of one rule on purpose — the CHECK is the structural
floor that binds even the table owner, the classifier is what lets a boundary refuse with an
answerable error — and the verifier proves they agree over one corpus so they cannot drift.

## 19. A disclosed field needs two independent gates

```text
pre_match_disclosure_authority_fields (authority_id, field_key)    the SUBJECT human approved it
matching_proposal_safe_field_keys (policy_version_id, field_key)   Product permits it pre-Match
```

Human authority is necessary and **not sufficient**. The Product policy is versioned and configurable,
freezes no Introduction Profile catalogue, and **no policy row ships in any migration** — an
unconfigured policy has no current version and every consequential path fails closed on it.

`I-07A` bans a contact-route field **key**; a field **value** is bounded free text, so `0110` bans the
contact route in the value as well and `0111`'s gate filters every value before writing it, refusing
the offending field **by name**. The ban is deliberately fail-closed and will refuse some innocent
text: refusing to disclose a sentence is recoverable, and disclosing a phone number before a Mutual
Match is not.

## 20. Two independent disclosures, never one view with the names swapped

`RECIPIENT_PROPOSAL_VIEW_VERSION` is immutable and audience-exact: the recipient is pinned by CHECK to
the proposal member its role names, the subject to the other, the authority must be the subject's own
and bound to exactly the profile version being disclosed, and the conclusion must have been filtered
for that recipient about that subject. The two views are therefore built over different subjects,
authorities, profile versions and conclusions, with no copy path between them.

Currentness is an explicit pointer that may only move forward along that recipient's own chain, never
"the latest timestamp". A superseded view is not erased — it is the record of what that human was
shown — and a stale view authorizes no consequential act.

## 21. The neutral outcome *is* the privacy property

```text
AWAITING_YOU · IN_PROGRESS · CLOSED_BY_YOU · NO_LONGER_AVAILABLE · MATCH_CONCLUDED
```

A first recipient cannot distinguish a second decline from an expiry, from a private invalidation, or
from a competing match that cancelled the proposal: all four are one answer. A second recipient cannot
distinguish a withdrawal from an expiry. The private reason lives on the transition row and reaches no
recipient projection.

Neither human learns anything about a proposal they hold **no view of**: another human's proposal, one
never offered to them and one that does not exist are the same bounded not-found. That is what keeps
the candidate from having a "proposal existed" oracle — they hold no view until the first recipient
explicitly approves forwarding.

## 22. Nothing in `I-07B` is executable by any application role

Every boundary in `0111` and `0112` is postgres-owned, `SECURITY DEFINER`, empty-`search_path`-pinned
and revoked from `PUBLIC`, `anon`, `authenticated` **and** `service_role`. No role holds `EXECUTE` on
any of them.

This is the repository's established pre-launch pattern rather than an omission. Proposal delivery and
human proposal decisions are consequential disclosure about two humans, and the `CW2-08` gate that
must clear them does not exist here: `resolve_matching_proposal_prerequisites_v1` answers
`NOT_EVALUATED`, exactly as the `I-05B` and `I-06` seams do, and every delivery and human decision
requires exactly `CLEARED` from it as its **last** gate. Expiry, staleness and withdrawal are
deliberately not gated on it: all three end exposure rather than create it.

`CW2-06` permits a narrow read-only service resolver over the sealed setup state but does not require
one, and a `service_role`-executable resolver that **enumerates currently matchable humans** is
precisely the oracle the anti-oracle law forbids — so candidate discovery is internal too, and
`service_role` gains nothing at all from this slice. The four human decision cores nevertheless derive
their human from `auth.uid()` and take no actor parameter, so `I-09` can wrap them by granting EXECUTE
with no step that turns a system credential into human consent.

### A second fail-closed seam: the canonical first name

A pre-Match proposal may present the candidate's first name from an allowed canonical source, and this
repository has none — `public.users` carries an id, an auth subject and two timestamps. The Public
World display label belongs to a different capability and reading it here would move a **public** fact
into private Matching. `resolve_matching_canonical_first_name_v1` therefore answers
`UNRESOLVED_NO_CANONICAL_SOURCE`, the disclosure gate requires `RESOLVED`, and the whole proposal path
fails closed on it. The seam is replaceable without reopening anything, and this is the same
disposition the `I-04`, `I-05` and `I-06` closure records take for the boundaries they could not
resolve.

## 23. Lock order and concurrency

```text
1. both humans' matching_setup_locks   FOR UPDATE   in CANONICAL USER-ID ORDER
2. the canonical pair row              FOR SHARE
3. the proposal row                    FOR UPDATE
4. recipient view, transition and policy rows
```

The two-human lock uses the **same** upsert-and-lock statement the `I-07A` commands use, so an `I-07A`
setup command and an `I-07B` pair operation serialize on the same row. Direction never decides lock
order — both callers take the smaller identifier first, always — which is what makes simultaneous
`(A,B)` and `(B,A)` work impossible to deadlock. Cadence and pending limits are **derived** from the
proposals that exist rather than stored in a counter, so a pause accumulates no backlog and returning
cannot produce a flood.

### The exact-view check is inside the serialization region, and that is an order

Interim independent Concurrency review raised `I07B-CONC-01`, and it was
**confirmed against the runtime**. All four human decision paths originally ran

```text
assert_matching_recipient_view_current_v1  ->  read proposal  ->  lock the pair
```

so the exact-view truth was read with **no lock held**.
`materialize_matching_recipient_view_core_v1` supersedes a recipient view while
holding the canonical two-human lock, which leaves a real window:

```text
T1  reads V1 and accepts it
T2  takes the pair lock, materializes V2, moves the pointer, COMMITS
T1  takes the now-free pair lock and acts on V1
```

The compare-and-swap in `append_matching_proposal_transition_v1` does not close
it, because materializing a view does not change the proposal state, so the swap
still succeeds. The delivery and protective paths were already lock-first; only
the four decisions were affected.

**The fix** is one entry point. `enter_matching_proposal_decision_v1` answers the
bounded not-found from the proposal's own immutable membership and *then* takes
the canonical two-human lock; all four decisions call it first, and everything
they read about currentness — the committed transition, the exact view version,
the proposal state — is read after it, under the same lock a materialization
holds.

The anti-oracle behaviour is preserved and slightly strengthened: a proposal that
does not exist, one this human is no part of, and one they hold no view of are
still the same `MATCHING_PROPOSAL_NOT_FOUND`, and a caller who is no part of the
proposal now never causes a serialization row to be written for two humans they
have nothing to do with.

**The proof is a real two-connection race** (`0112` scenario `E06`), not an
assertion about text. T2 holds the pair lock with an uncommitted V2 while T1's
decline is already in flight, so T1 blocks exactly where the check has to happen;
T2 commits; T1 must then fail closed with `MATCHING_RECIPIENT_VIEW_STALE`, no
transition from the stale view exists, and acting on the **current** view then
succeeds. The same scenario also installs the pre-fix ordering and runs the same
interleaving again, where the superseded view **is** accepted — so the ordering is
load-bearing rather than decorative — and restores the canonical definition byte
for byte. A live `prosrc` ordering assertion and a static contract assertion stop
the order drifting back; the race remains the authority.

## 24. `I-07B` anti-scope

`I-07B` deliberately does not implement, and nothing in migrations 0110–0112 can represent:

- **`I-07C`** — the second-party acceptance commit, `SECOND_ACCEPTED`, `ACTIVE_INTRODUCTION_SLOT`,
  `MATCH_COMMIT_ID`, Mutual Match, the `MUTUAL_MATCH_COMMITTED` producer, the
  `CANCELLED_BY_COMPETING_MATCH` producer, the atomic two-slot claim, the single-winner
  competing-match race, Introduction Record creation, `SHARED_WORLD / INTRODUCTION` birth,
  competing-proposal cancellation as part of the Match commit, and `MATCH_HANDOFF_PACKAGE_VERSION`.
  The two reserved states are **representable** with no producer, so that slice adds one rather than
  relaxing a ceiling.
- **`I-07D`** — active Introduction progressive disclosure, image / name / contact staged disclosure,
  the Introduction success transition to `STANDARD`, unilateral Introduction end, slot release,
  post-Introduction and post-success resume revalidation, `I-07` phase closure reconciliation.
- **`I-08`** — mobile Matching UI, candidate cards or feed, the final visual proposal experience,
  navigation surfaces.
- **`I-09` / deferred Product** — report, block, moderation, the final safety policy engine,
  entitlements, the production Launch Gate, the feature-rollout system, pricing, mandatory KYC or
  documentary identity verification, a candidate ranking model, any visible compatibility percentage,
  score or rank, a browsable candidate list, the exact final Introduction Profile field catalogue, the
  exact proposal copy, the exact weekly proposal count, the exact pending proposal maximum, the exact
  expiry duration, and pair cooldown or re-proposal policy.

None of these is admitted to the canonical backlog by this slice. Each is owned by the frozen `CW2-06`
and `CW2-08` contracts or by the named later `I-07` slice, and a contract that already owns a
capability does not also need a backlog entry claiming it (`BG-06`).

## 25. `I-07B` verification

```bash
npm run test:database                                                     # static contracts
npm run verify:db:hazards                                                 # verifier-hazard gate
npm run verify:matching-pair-eligibility-proposal-persistence:integration
npm run verify:matching-candidate-evaluation-disclosure-gate:integration
npm run verify:matching-proposal-choreography-runtime:integration
```

All three real-PostgreSQL verifiers need `DATABASE_URL` pointing at a fully migrated database and run
in API CI as one reported group after the `I-07A` group. All three report every scenario independently
through the permanent aggregator, so one defect cannot hide the rest.

The two reserved `I-07C` states and the competing-match cancellation are reached only as the table
owner inside a scenario that rolls back — `I-07B` has no producer for them on purpose — and both
fail-closed seams are replaced only inside a transaction and restored byte for byte, with the
production answer asserted back at the end of the run. No permissive seam or policy is ever left
installed.

**The `I-07A` censuses were repaired, not dodged.** `verify-migration-0108.mjs` and
`verify-migration-0109.mjs` compared the **live catalog** for any lifecycle-shaped relation in the
Matching namespace and asserted emptiness. `I-07B` legitimately adds eleven, so both now assert an
**equality** against a named shared list, exactly as `I-06C` put its new outward Public resolver into
the `I-05C` census. Renaming out of the pattern would have been the dodge those censuses exist to
prevent, and both halves of what `I-07A` claimed remain proven: every such relation is one a named
later slice owns, and none of them is an `I-07A` relation. No `I-07A` migration was touched.

The final implementation/verifier head accepted for closure is
`5165d0a4c0f664b26f5b17cc2ece1b031ead718d`. Two complete consecutive Focused Database Verification
rounds ran from the trusted `main` harness against that exact 40-character target SHA, in migration
order: round one `#102/#103/#104 = 0110/0111/0112`, round two `#105/#106/#107 = 0110/0111/0112`.
All six runs completed successfully and their artifacts identify the same target head. API CI `#709`
and Mobile CI `#278` also completed successfully on that same implementation head before this
closure-only documentation sync.

## 26. `I-07B` status and closure record

`I-07B` is **CLOSED / FROZEN**. `I-07` remains **OPEN**; `I-07A` remains **CLOSED / FROZEN**. This
closure starts no other `I-07` slice, does not implement any `I-07C`, `I-07D`, `I-08` or `I-09`
capability, and changes no Product/runtime semantic above section 14.

Independent ChatGPT Architecture / Privacy / Database / Concurrency review passed on implementation
head `5165d0a4c0f664b26f5b17cc2ece1b031ead718d`. The review covered the actual PR diff, migrations
`0110`–`0112`, the predecessor-verifier repairs, authority and privacy boundaries, proposal state and
exact-view semantics, real-PostgreSQL concurrency behavior, anti-oracle projections, and exact-head
Focused/API/Mobile evidence.

The interim review finding `I07B-CONC-01` was confirmed and corrected before closure: all four human
decision paths now acquire the canonical two-human serialization lock before revalidating the exact
current recipient view. The real two-connection `0112` race proves the stale view is rejected after
supersession, and the load-bearing negative proof demonstrates that the pre-fix ordering would accept
it. No unresolved Architecture / Privacy / Database / Concurrency finding remains.

**BG-05 / BG-08 reconciliation:** the canonical backlog was reviewed for ownership. No open backlog
item is owned by `I-07B`, and no newly discovered cross-task obligation qualifies for admission. The
deferred capabilities in section 24 are already owned by frozen `CW2-06` / `CW2-08` or by the named
later `I-07` slices, so duplicating them would violate the intent of `BG-06`. The fail-closed Launch
Gate and canonical-first-name seams are implemented boundaries, not backlog deferrals.

**BG-09 synchronization:** the former `CANDIDATE — awaiting independent ChatGPT review` banner was the
pre-review state of this same slice. This closure sync records the completed independent review and
freezes `I-07B` while leaving the parent `I-07` phase OPEN for `I-07C` and `I-07D`.

**Launch readiness is a different claim.** Nothing in `I-07B` can propose anybody to anybody in
production: every boundary is executable by no application role, the `CW2-08` prerequisite answers
`NOT_EVALUATED`, and the canonical first-name seam answers `UNRESOLVED_NO_CANONICAL_SOURCE`. The
`I-07B` runtime is closed and frozen; production Matching remains fail-closed until its later owners
open those boundaries.

---

## 27. `I-07C` — what the closed slice implements

`I-07C` is **CLOSED / FROZEN**. Baseline `main` at
`308218bf661d1083ab023f6a4045a328c0a7e4bd` (the `I-07B` closure merge); migrations `0113` and
`0114`, forward-only after the verified `0112` tip. Nothing above section 26 changes.

`I-07C` is the ONE atomic transaction that turns a proposal in `FORWARDED_TO_SECOND` into a Mutual
Match, and it is one macro slice on purpose. Mutual Match, Introduction Record birth,
active-Introduction claim acquisition, competing-proposal terminalization, participation pause and
Match handoff commit together or not at all; no part of it is separately merged, and no part of it
is durable on its own.

**Second acceptance is durable only as a successful Match.** There is no `SECOND_ACCEPTED`, no
"accepted pending match", no reserved slot and no pre-created World. The candidate acts on the exact
current `CANDIDATE` view; the acting human is `auth.uid()`; there is no actor parameter anywhere.

**The Match command identity.** `commit_matching_mutual_match_v1` takes twelve opaque uuid
identities — the command, the proposal, the exact accepted view and nine persistence identities
(World, record, two episodes, two claims, two pause acts, handoff) — and returns nine bounded
columns: the operation, the identities the caller supplied and the frozen birth constants. The
command id IS the `MUTUAL_MATCH_COMMITTED` transition id and the `matching_match_commits` row id.
Three durable idempotency passes compare the WHOLE request and answer from the committed row with
the committed constants — never the live World or record, which `I-07D` legitimately moves on. A
reused id naming any different request fails closed with `MATCHING_COMMAND_ID_CONFLICT`.

**Two proven acceptances.** `FIRST_FORWARD_APPROVED` alone is not proof. The revised forward
approval — byte-identical to `0112` in authority and order plus ONE write — durably binds the
approving transition, the approving human and the exact `FIRST_RECIPIENT` view in
`matching_forward_approval_view_bindings`. The Match core requires that bound view to STILL be the
first recipient's current view; a superseded first approval is not carried forward.

**Final acceptance revalidates everything, serialized.** Under both humans' canonical setup locks
and every mutable proposal row: the exact candidate view, the winner exactly `FORWARDED_TO_SECOND`
and unexpired, the first-approval binding, `resolve_matching_proposal_validity_v1` (participation,
grants, profile and requirement versions, disclosure authorities, policies and the canonical
active-Introduction truth), no `HELD` claim for either human, both participation pointers `ACTIVE`,
and — LAST, after every privacy and authority gate — `resolve_matching_proposal_prerequisites_v1`
must answer `CLEARED`. The production seam answers `NOT_EVALUATED`; no application role receives a
bypass; no application role can execute either boundary.

**Refusal vocabulary.** `MATCHING_AUTHENTICATION_REQUIRED` (42501), `MATCHING_COMMAND_INVALID`
(22023), `MATCHING_PROPOSAL_NOT_FOUND` (P0002, the one bounded answer for a proposal this human is
no part of, holds no candidate view of, or that never existed), `MATCHING_RECIPIENT_VIEW_STALE` /
`MATCHING_STALE_STATE` / `MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE` (40001 — every post-view
currentness failure is ONE class, so a refusal never says which authority moved),
`MATCHING_PROPOSAL_EXPIRED` and `MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED` (55000),
`MATCHING_COMMAND_ID_CONFLICT` and `MATCHING_MATCH_ID_CONFLICT` (23505),
`MATCHING_MATCH_CONTRADICTORY_STATE` (P0001). The revised forward approval answers an equivalent retry
from its committed rows, refuses a different view under a reused id with `MATCHING_COMMAND_ID_CONFLICT`,
and — since interim review finding `I07C-AUTH-01` — fails closed with `MATCHING_MATCH_CONTRADICTORY_STATE`
when the committed `FIRST_FORWARD_APPROVED` transition exists but its exact-view binding is missing: no
historical view is inferred and nothing is backfilled from the current view.

## 28. `I-07C` — persistence (migration `0113`)

Persistence and nothing else — no command, no resolver, no read boundary — exactly as `0108` and
`0110` did for their slices:

- seven additive candidate keys on predecessor relations, each over an existing primary key, so a
  later row binds an EXACT row of that human, actor, view or World rather than two independently
  satisfiable halves;
- the `0110` private-reason CHECK rebuilt in place with exactly one more code,
  `COMPETING_MATCH_COMMITTED`: the one reviewed `DROP` in the slice, adjacent to its rebuild;
- `matching_forward_approval_view_bindings`, `matching_match_commits`, `introduction_records`
  (`ACTIVE | COMPLETED | CLOSED`, born `ACTIVE`, one terminal move, never reopened),
  `shared_world_matching_birth_events`, `shared_world_introduction_started_events`,
  `matching_active_introduction_claims` (`HELD | RELEASED`, one partial unique index on `HELD` per
  human), `matching_match_competing_cancellations`, and the three handoff relations;
- six reverse bindings onto the commit, `DEFERRABLE INITIALLY DEFERRED` (the `0085` precedent), so
  the commit row is written LAST and its truth trigger re-reads every effect: the World shape, two
  open episodes, the record, both facts, both claims, both `ACTIVE_INTRODUCTION` pauses, the handoff,
  all at ONE instant;
- immutability guards on the eight append-only relations; truth triggers on the record, the claim,
  the commit and the handoff; RLS enabled, zero policies, every relation revoked from every
  application role.

The claim is an INTERNAL concurrency guard only. It does not replace the canonical
Shared-World-derived truth `resolve_matching_active_introduction_v1`; the core checks both, and a
`HELD` claim with no Introduction World behind it is refused on its own.

## 29. `I-07C` — the atomic effects (migration `0114`)

In one transaction, at one `clock_timestamp()`: the winner `FORWARDED_TO_SECOND ->
MUTUAL_MATCH_COMMITTED` through `append_matching_proposal_transition_v1` (the sole transition
writer; the core inserts no transition itself); the Shared World on the canonical `0075` substrate
— `ACTIVE / INTRODUCTION / MUTUAL_MATCH`, no closure moment; exactly two open peer episodes; the
Introduction Record `ACTIVE`; `WORLD_BIRTH / MUTUAL_MATCH` and `INTRODUCTION_STARTED`; both claims
`HELD`; both humans `PAUSE -> PAUSED / ACTIVE_INTRODUCTION` superseding their exact `ACTIVE` acts,
through the `0108` act chain and pointer truth — `I-07C` is the reviewed producer `I-07A` reserved,
and no `USER_PAUSED` is faked; every other LIVE proposal involving either human
`-> CANCELLED_BY_COMPETING_MATCH` with private reason `COMPETING_MATCH_COMMITTED`, inside the same
transaction, read from the exact state under its row lock, never left to become `STALE`; the Match
Handoff Package; the commit row; the deferred bindings flushed `IMMEDIATE`.

The Shared World birth reuses `shared_worlds` / `shared_world_membership_episodes` and the `0082`
atomic-birth and idempotency patterns, and NOT the direct-invitation semantics or function: the
direct birth core is byte-identical to what `0082` left, and exactly the two frozen birth paths
create a Shared World. No third human can join while the phase is `INTRODUCTION`: the frozen `0084`
governance capture refuses every governed operation for a World that is not `ACTIVE / STANDARD`,
and the real verifier proves it against the born World. No Shared Standing Context Grant is created.
The World is independent of Matching participation: after a Match the human may still turn Matching
off, and cannot resume the reserved pause (`I-07A` law, unchanged).

## 30. `I-07C` — lock order, concurrency proofs and the no-ghost proof

**Published lock order.** (A) `enter_matching_proposal_decision_v1` — the bounded not-found before
any lock, then BOTH humans' `matching_setup_locks` rows in globally canonical ascending user-id
order, exactly once, never in competing-proposal order; (B) every proposal row this transaction may
mutate — the winner and every live proposal involving either human — `FOR UPDATE` in ascending
proposal id; (C) both participation pointers `FOR UPDATE`; (D) the new rows. No advisory lock, no
table lock, no process mutex. The human lock set of one Match is provably exactly its own two
humans (a competitor's setup state is never mutated), so a re-scan can never discover a human
outside the precomputed set; a competitor terminalized by a disjoint Match is re-read under its row
lock and skipped.

**Real two-connection proofs**, every one pinned with a lock-wait barrier observed from another
connection (a race whose interleaving is not pinned is not a proof): the same command retried
concurrently commits once; two commands on one proposal yield one Match; A-B vs A-C and A-B vs C-B
yield one winner with the loser cancelled INSIDE the winner; reversed UUID ordering does not
deadlock; the four-human competing lock set (two disjoint winners crossing on two competitors) lets
BOTH succeed and cancels every competitor exactly once; two disjoint Matches never wait on each
other; a concurrent pause, opt-out, profile change, requirement change, disclosure-authority
revocation, candidate-view supersession or first-approval-view supersession under the pair lock
defeats a Match that read first, writing nothing; a Match against another Introduction birth for
the same human yields exactly one.

**The deadline is final-currentness, so it is decided on the birth instant.** `CURRENT_TIMESTAMP` is
the TRANSACTION timestamp and is fixed before the transaction ever waits on a lock, so a Match that
entered while its proposal was live, waited on the canonical pair lock and resumed after
`expires_at` would compare a moment that had already gone by and commit a Match the proposal no
longer authorized (review finding I07C-TIME-01). The core therefore finishes every currentness,
authority and prerequisite check, captures the ONE canonical instant, and decides
`expires_at <= birth_at` immediately before the irreversible write region, with nothing written yet
— one Match clock, one persisted instant, the same value for the decision and for every persisted
moment; the terminal self-assertion refuses any other clock, `CURRENT_TIMESTAMP` included. The
sixteenth race is the proof: the Match is observably blocked on the lower human's lock, its own
`xact_start` is shown to PRECEDE the deadline, the deadline passes while it is still waiting, and on
release it fails `MATCHING_PROPOSAL_EXPIRED` with zero surviving effects and terminalizes nothing —
expiry terminalization stays the `I-07B` boundary that owns it — after which the same request
commits once the proposal is live again.

**No ghost.** A verifier-local late failure and a late unique violation, each injected on the LAST
write of the transaction after every other effect was written, leave ZERO surviving effects: no
commit, no transition, no World, no episode, no record, no fact, no claim, no pause, no
cancellation, no handoff, no binding change — proven from live rows, with the probe removed on
every path and the trigger set proven restored.

## 31. `I-07C` — handoff privacy, neutrality and the `I-07D` anti-scope

**The Match Handoff Package is a one-way, bounded projection.** Its subjects are bound by foreign
keys to the exact view's subject, first name and permitted conclusion; its fields to a real field of
the exact view; its values are route- and provenance-banned; its truth trigger requires the view to
be in the package, the conclusion text to be the permitted text and the field value to be the view
value. The core copies from exactly the two views that already crossed both disclosure gates and the
value filter, composes nothing and fetches nothing from a profile. Raw `MY_WORLD` evidence, private
reasoning, hidden provenance, the Matching Context Grant, private operational reasons and competing
proposal information are unreachable from every handoff relation, by structure and by the real
verifier's search for every private identity and text.

**Competing-proposal privacy.** The recipient of a proposal cancelled by another human's Match is
told `NO_LONGER_AVAILABLE` — the same columns, the same values and the same field projection as an
expiry, with no winner, no commit, no World, no reason and no state name anywhere in the answer.

**What `I-07C` deliberately does not do (`I-07D` and later):** no claim release (`RELEASED` is
representable and produced by nothing); no `COMPLETED` / `CLOSED` record producer; no Introduction
success transition to `STANDARD`; no unilateral Introduction end; no `POST_INTRODUCTION`,
`POST_SUCCESS` or `SYSTEM_POLICY` pause producer; no resume of a reserved pause; no Shared Standing
Context Grant; no launch, no application-executable boundary, no ranking, no contact route. The
migration refuses to deploy a core that spells any of those lifecycles.

## 32. `I-07C` — forward-seam reconciliation record

Done in the same branch, never as a separate cleanup PR, and never by editing a historical
migration; the `I-07C` static contract pins `0075`, `0082`, `0108`–`0112` and the frozen `I-07A` /
`I-07B` TypeScript vocabulary modules by git blob id.

- `verify-migration-0110.mjs` P06: the future-relation ABSENCE census is now an EQUALITY against the
  named `I07C_LIFECYCLE_RELATIONS` list (regex extended to reach the `_claim` relation, the name
  `I-07C` gave the slot), proven non-vacuous; the `I-07B` proposal `COLUMN_BAN` is preserved —
  `matching_proposals` still carries exactly its eleven `0110` columns.
- `verify-migration-0112.mjs`: the "no reserved-state producer" (A05) and "no acceptance producer"
  (B01) assertions are equalities against `commit_matching_mutual_match_v1`;
  `append_matching_proposal_transition_v1` remains the sole transition writer.
- `verify-migration-0108.mjs` / `-0109.mjs`: the shared lifecycle census list is the union of one
  array per reviewed slice (`I07B_LIFECYCLE_RELATIONS`, `I07C_LIFECYCLE_RELATIONS`), and each census
  filters it by its own regex; the `I-07A` human-consent boundaries are unchanged and the `0114`
  self-assertion proves the `I-07A` commands still name no `ACTIVE_INTRODUCTION`.
- `verify-migration-0082.mjs`: the forward-safety probe predicted `introduction_records` as a name to
  plant; it has arrived, and the probe counts an arrived relation instead of planting over it.
- `database/tests/matching-proposal-privacy-runtime-v1.test.mjs`: reads the `I-07B` half of the
  census from its own named array and asserts the union line.

## 33. `I-07C` — status and closure record

`I-07C` is **CLOSED / FROZEN**. `I-07` remains **OPEN** for `I-07D`; `I-07A` and `I-07B` remain
**CLOSED / FROZEN**. This closure changes no Product/runtime semantic above section 27 and does not
implement any `I-07D`, `I-08` or `I-09` capability.

Independent ChatGPT Architecture / Privacy / Database / Concurrency review passed on the final
implementation/verifier head `338dc8294c2dbd481aafbdcd5cda2361fc081e84`. The review covered the
actual PR #258 diff, migrations `0113`–`0114`, predecessor-verifier reconciliation, exact dual-consent
authority, durable exact-view binding, atomic Match/World birth, idempotency, lock ordering, real
PostgreSQL races, no-ghost rollback, handoff privacy, anti-oracle projection, and exact-head
Focused/API/Mobile evidence. No unresolved Architecture / Privacy / Database / Concurrency finding
remains.

Two independent-review findings were confirmed and corrected before closure. `I07C-AUTH-01` made a
committed `FIRST_FORWARD_APPROVED` transition with a missing exact-view binding fail closed rather
than report retry success; verifier scenario `A15` proves same-view idempotency, different-view
conflict and missing-binding contradiction with no inference or backfill. `I07C-TIME-01` moved the
final proposal-deadline decision from PostgreSQL transaction time to the one captured Match birth
instant after lock waiting and all final-currentness gates; barrier-pinned race `C16` proves a Match
that crosses `expires_at` while blocked resumes to `MATCHING_PROPOSAL_EXPIRED` with zero effects. The
pre-fix accepted head `f0723d48e9de2806ee2a94ff3d5fe338678f0d1a` was discarded and all final
acceptance evidence was rerun from scratch on `338dc8294c2dbd481aafbdcd5cda2361fc081e84`.

**Exact-head acceptance evidence:** two complete consecutive Focused Database Verification rounds ran
from the trusted `main` harness against that exact 40-character target SHA, in migration order: round
one `0113 #35238047201` and `0114 #35238232746`; round two `0113 #35238462345` and
`0114 #35238624628`. `0113` passed `17/17` in both rounds and `0114` passed `35/35` in both rounds.
Predecessor regressions also passed on the same target: `0082 #35238821298`, `0108 #35238831038`,
`0109 #35238841436`, `0110 #35238851356`, `0112 #35238861684`. API CI `#717`
(run `35237786130`) and Mobile CI `#286` (run `35237786592`) completed successfully on the same
implementation head. Local gates were green: `test:database 1184/1184`, database hazards `0`,
`test:toolchain 8/8`, TypeScript clean, with nothing skipped.

**BG-05 / BG-08 reconciliation:** the canonical backlog was reviewed at kickoff and again at closure.
No open backlog item is owned by `I-07C`, no inherited item requires a state change, and no newly
discovered cross-task obligation qualifies for admission. The deferred capabilities in section 31
remain owned by frozen `CW2-03` / `CW2-06` / `CW2-08` or by the named `I-07D`; duplicating them in
the backlog would violate the intent of `BG-06`. Existing unrelated backlog items remain untouched.

**BG-09 synchronization:** the former `CANDIDATE — awaiting independent ChatGPT review` banner and
section 33 candidate record were the pre-review state of this same slice. This documentation-only
closure sync records the completed independent review and freezes `I-07C` while leaving the parent
`I-07` phase OPEN. No runtime, schema, migration, verifier, static-contract or test semantic changes
are part of this closure commit.

**Launch readiness is a different claim.** Nothing in `I-07C` can match anybody to anybody in
production: both consequential boundaries remain executable by no application role, the `CW2-08`
prerequisite answers `NOT_EVALUATED` and is required LAST, and the canonical first-name seam answers
`UNRESOLVED_NO_CANONICAL_SOURCE`. Production Matching remains fail-closed until its later owners open
those boundaries.

**Next slice:** `I-07D — Introduction Lifecycle, Progressive Disclosure & I-07 Closure`.

---

## 34. `I-07D` — what the candidate slice implements

`I-07D` is the final implementation slice of `I-07`. `I-07C` left two humans inside a born
`ACTIVE / INTRODUCTION` Shared World with an `ACTIVE` Introduction Record, two open membership
episodes and two `HELD` claims — and no way for the Introduction to progress or to end. `I-07D` owns
the whole of that in three forward-only migrations after the verified `0114` tip:

- `0115` — owner-controlled progressive disclosure, the Introduction branch of the ONE canonical
  historical visibility entry point, the Introduction closed-view entitlement family, the narrow
  disclosure read boundary, and exactly one new branch in the canonical owner-deletion primitive;
- `0116` — the two terminal outcomes and the one durable terminal winner both converge on: dual
  human approval for `SUCCESS`, unilateral `END`, both terminal facts, the Introduction closed-view
  snapshot, claim release and the two reserved post-terminal participation transitions;
- `0117` — the one narrow explicit post-Introduction Matching reactivation boundary, and the
  `I-07` phase-closing forward contracts asserted at the tip of the chain.

No predecessor relation is altered. The three functions this slice replaces are replaced
FORWARD-ONLY through `CREATE OR REPLACE`, and every historical migration file — `0001`–`0114`
included — is untouched.

## 35. `I-07D` — progressive disclosure

**A QANDEEL suggestion creates zero authority, and has no representation at all.** There is no
dormant suggestion object, no pending grant and no reusable "share everything with this person"
permission. The owner's explicit grant and the protected delivery are ONE atomic act, which closes
the revocation-before-delivery race by design rather than by policy: before the grant nothing is
delivered, and after it delivery is historical Shared truth.

**The owner is `auth.uid()`; the counterpart is DERIVED.** The command accepts no counterpart,
recipient, audience or owner identifier of any kind — the counterpart is read from the exact
Introduction Record's two matched humans under the World lock — so a disclosure cannot be rerouted to
a third human however the caller is composed. The migration refuses to deploy a command that accepts
one.

**The resource vocabulary is closed at five broad categories.** `PARTIAL_IMAGE`, `FULL_IMAGE`,
`FULL_NAME`, `CONTACT_METHOD` and `DEEPER_PERSONAL_FIELD`. There is no generic `RESOURCE_KIND` and no
JSON payload anywhere. The type-to-payload binding is STRUCTURAL: the resource version carries
`UNIQUE (id, resource_type)` and each typed payload relation composite-binds both columns, so a text
resource carrying a media reference is a constraint violation rather than a bug a reviewer must
catch. A field key exists exactly for `DEEPER_PERSONAL_FIELD`, and the frozen `0108` contact-route ban
is kept for a reason that survives the Match: `CONTACT_METHOD` is the ONE reviewed way to disclose a
contact route, so a deeper personal field can never become a second, unreviewed one. Image
references are opaque server-side media object identities, CHECKed exactly as `0089` CHECKs a voice
note: not a URL, no query, no fragment, no credential-shaped token. A partial image and a full image
are two INDEPENDENT resource versions and neither authorizes the other, because no authority object
spans them. The exact cropping, blurring and derivative-rendering algorithm stays deferred Product
scope.

**A delivered disclosure is real Shared history.** It creates an `I-04F` history item whose exact
baseline audience is the owner and the counterpart and whose exact material authority is the owner
alone; the reserved `EXPLICIT_DISCLOSURE` material `0089` created and deliberately gave no producer,
with `producer_kind = HUMAN` and `body_form = RESERVED`; an `INDEPENDENT_TARGET_TRUTH` provenance edge,
because the owner establishes their own truth and no Matching private reasoning is read to decide what
to disclose; and a `RESOLVED_EXACT_HUMAN_REQUIREMENT` historical-authority row. `I-07D` is the ONE
reviewed producer of that reserved material kind, which the migration, the verifier and the
phase-closing contract each assert on the live catalog.

**Non-reciprocity is structural.** A disclosure by A names A as owner and B as counterpart, in one
row, in one direction. There is no code path that could create a reverse row: B's own disclosure
exists only after B executes the command as themselves.

**Owner deletion dominates future visibility.** `delete_shared_world_owned_material_v1` gains exactly
one branch, named by kind: an `EXPLICIT_DISCLOSURE` loses its typed payload when its owner deletes it.
Everything else is preserved exactly — the actor is still `auth.uid()`, the World row is still locked
first, phase is still not a gate, `READ_ONLY_CLOSED` still permits it, the transitive
`MATERIAL_DEPENDENCY` invalidation and the terminal `DELETED_BY_OWNER` transition are unchanged, and
no `HUMAN_TEXT`, `HUMAN_VOICE_NOTE` or `QANDEEL` semantic moves. The resource version, its
`DISCLOSURE_GRANTED` fact and its material envelope SURVIVE the deletion: audit identity remains,
source content does not, a frozen closed-view entitlement can never preserve it, and the Introduction
resolver cannot reconstruct it.

**The read boundary is narrow and composed.** `resolve_shared_world_introduction_disclosure_v1` is
`service_role`-only, CONSUMES the ONE canonical visibility entry point rather than re-deciding
visibility, and returns a bounded render shape. A disclosure whose payload the owner destroyed
produces no row, no count and no placeholder. It returns no authority row, no private reason, no
source profile or grant identity, no Matching context, no proposal id, no private provenance and no
undisclosed resource version, and it reads no Matching relation at all.

## 36. `I-07D` — Introduction historical visibility

`I-07D` extends the ONE existing entry point, `resolve_shared_world_history_visibility_v1`, rather
than creating a competing resolver. `0087` refused `INTRODUCTION` with a bounded unsupported class;
that was a truthful statement about what existed, not a ceiling.

**The Standard branches are preserved exactly.** `ACTIVE / STANDARD` is the same union of
membership-period visibility and explicit history grants, with the same temporal bounds; availability
still dominates every mode; `READ_ONLY_CLOSED` still delegates to the closure slice's own reader; a
human with no currently open episode still gets a truthful empty answer rather than a distinguishable
error. The explicit history-grant basis appears exactly once in the replaced body, which is what
proves the Introduction branch did not inherit it.

**The Introduction branch is strictly narrower.** `ACTIVE / INTRODUCTION` requires an exact
currently-open matched episode and returns the exact baseline-audience conjunction alone. Selective
history packages are deliberately NOT extended into an Introduction: at v1 an Introduction has exactly
two humans and no add, remove or rejoin flow, so there is no absence period for a package to bridge,
and granting package semantics merely because Standard Worlds have them would be inventing Product
law. No hidden placeholder is manufactured.

**Failed-Introduction closed viewing is its own entitlement family.** The `shared_world_standard_*`
entitlement tables are named for Standard closure and stay Standard-owned; treating them as generic
would make one relation answer for two closures with different law. `introduction_closed_view_entitlements`
and `introduction_closed_view_entitlement_items` are the narrow Introduction family, and `0088`'s
closed reader gains the reviewed Introduction branch over them with its signature unchanged and its
Standard branch intact. An entitlement is historical viewing authority and nothing else: not
membership, not governance, not a history grant, not a Standing Context Grant. A human may
legitimately hold one with zero items, and availability continues to dominate it — a later valid
owner deletion narrows an entitlement that already exists.

**Extending the ONE entry point widens every consumer that composes it.** That is what composing it
means, and the consumer set is declared rather than discovered: the `I-04G` material resolver, the
`I-04F` Standard closure snapshot, the two `I-05` Public manifest boundaries, the two `I-06A` Replay
source adapters, `I-07D`'s own end core and its disclosure resolver. Three properties make the
widening safe. The generic material resolver returns a material only when a `TEXT` or `VOICE_NOTE`
body row exists, and an `EXPLICIT_DISCLOSURE` has neither, so a disclosure payload can never be
rendered through it. Public publication derives its required-approver set from the exact
`shared_world_history_item_required_approvers` relation, which for a disclosure is the OWNER and
nobody else — so a counterpart can see a disclosure but can never publish it without the owner's
explicit approval. And every downstream consequential path remains fail-closed in production on its
own `CW2-08` seam. This is a reviewed consequence of the frozen "one entry point decides" rule rather
than a new capability, and it is named here so the independent review can weigh it directly.

## 37. `I-07D` — the successful Introduction

**QANDEEL may propose; QANDEEL is not a consent provider.** The transition is an immutable exact
version bound to one World and one Introduction Record, with a payload fixed by CHECK:
`ACTIVE / INTRODUCTION` becomes `ACTIVE / STANDARD`, and nothing else is representable. Preparing one
is not authority and reserves nothing; it derives no actor at all, because a proposal is not a consent
act. A record may carry several versions over its life, which is what makes a stale approval
structurally unable to contribute: an approval binds its exact version by foreign key, and the commit
reads the approvals of exactly the version it commits.

**Both matched humans must hold a CURRENT approval.** Approval is an immutable `APPROVE` / `WITHDRAW`
act chain plus ONE current pointer per `(version, human)`, in the same shape `I-07A` models
participation. The human is `auth.uid()` with no actor parameter, so no caller — QANDEEL included, a
future launch-gated wrapper included — can manufacture or withdraw somebody else's consent. Only a
required human of the exact version can ever have an approval row, structurally, through a composite
foreign key into the derived required-approver set. Withdrawal works right up to the terminal commit,
changing one human's approval never touches the other's, and a withdrawn act stays in the chain rather
than being erased.

**System execution, human authority.** `commit_introduction_success_v1` derives NO actor and writes no
approval; the deploy-time assertion refuses a commit that reads `auth.uid()` or touches an approval
relation. It may execute only BECAUSE both exact current approvals exist, revalidated under
serialization together with the World, the Record, both matched humans, both open episodes, both HELD
claims, the absence of a prior terminal commit and — LAST — the `CW2-08` prerequisite.

**What SUCCESS changes, atomically and at one instant.** The SAME World becomes `ACTIVE / STANDARD`;
the Introduction Record becomes `COMPLETED`; one `INTRODUCTION_COMPLETED` fact is appended; both HELD
claims become `RELEASED`; a human still paused for this Introduction moves to `PAUSED / POST_SUCCESS`
and a human who explicitly turned Matching OFF is left exactly as they are. The same `world_id`, the
same two open membership episodes, the same history and the same provenance survive: no new World, no
new episode, no closure instant, no closed-view entitlement, no re-authorship and no retrospective
time rewrite. Introduction-period history reads on under Standard semantics, and an existing frozen
Standard capability that refused before the transition succeeds after it.

**A completed Introduction is not a relationship status.** The only Product truth is that both humans
approved leaving guided Introduction mode and continuing in the same Shared World as Standard. No
column, event, enum or check anywhere in the slice encodes a relationship, engagement, exclusivity,
marriage or legal status, and both the migrations and the static contract refuse to deploy one.

## 38. `I-07D` — the unilateral end

Either matched human may end an `ACTIVE / INTRODUCTION` alone. There is no counterpart approval, no
proposal and no waiting period, and the actor is `auth.uid()` with no actor parameter.

**Ending is deliberately NOT gated on the `CW2-08` seam.** A safety system may restrict what a human
can create, disclose or continue; it must never make them unable to leave. Disclosure and `SUCCESS`
each require `CLEARED` from their own seam; `END` has none, and the deploy-time assertion refuses an
END core that consults one.

**What END changes, atomically and at one instant.** Each matched human's exact visible history is
snapshotted through the ONE canonical visibility entry point WHILE the World is still `ACTIVE` and both
episodes are still open — so the frozen set is genuinely what they could see immediately before
closure — and only then does anything close. The SAME World becomes `READ_ONLY_CLOSED / INTRODUCTION`
at that instant and keeps its phase; the Introduction Record becomes `CLOSED`; one
`INTRODUCTION_ENDED` fact naming the exact ending human is appended; both open episodes close in place
with `WORLD_CLOSED`; both claims are `RELEASED`; a still-paused human moves to
`PAUSED / POST_INTRODUCTION` and an explicitly OFF human is left alone. No Standard `WORLD_ENDED` fact
is fabricated — that belongs to unanimous Standard governance closure — and no Standard closed-view
entitlement is written. After closure no ordinary Shared mutation is available, while the owner's
privacy deletion still is, and it still narrows the frozen view.

## 39. `I-07D` — exactly one terminal winner

Both outcomes converge on ONE substrate, `introduction_terminal_commits`, written LAST after every
other effect exists, under `UNIQUE (introduction_record_id)`. That single key is the whole one-winner
guarantee: `SUCCESS` versus `END`, `END` by A versus `END` by B, and two competing commands of either
kind all resolve to exactly one surviving row, because the second insert violates a unique index
rather than losing a procedural comparison a concurrent transaction could read stale.

The Product status on `introduction_records` remains the canonical truth and the frozen `0113` trigger
still allows exactly one move from `ACTIVE`. Both are true at once on purpose, and the terminal truth
trigger proves they agree rather than trusting either alone: it refuses the OTHER outcome's fact in
both directions, requires both claims `RELEASED` at exactly the terminal instant, requires the exact
World and membership shape each outcome implies, and requires every participation act it names to be
that human's own post-terminal pause superseding the exact `ACTIVE_INTRODUCTION` pause the Match
created — or, where it names none, that the human really is explicitly OFF over it.

Terminal commands are durable and idempotent. An equivalent retry is answered ENTIRELY from the
committed row, never by re-reading live World state, so a retry after later Standard changes still
answers the original terminal result. The same command id carrying any different request fails closed.

## 40. `I-07D` — Matching integration and explicit reactivation

**There is no automatic Matching restart.** A failed Introduction preserves Matching setup and leaves
the human paused; a successful one also leaves them paused; a later Standard World end reactivates
nothing. Reactivation is explicit and fully revalidated.

**The three real human states the lifecycle produces** are `PAUSED / POST_INTRODUCTION`,
`PAUSED / POST_SUCCESS`, and an explicit `OFF` over that exact lineage — the last because
participation is independent after the Match, so a human may turn Matching off while an Introduction
is live and the terminal transition then leaves their own decision alone. The frozen `I-07A`
activation refuses exactly that `OFF` with `MATCHING_REACTIVATION_REQUIRES_REVALIDATION`; this is the
revalidation it was waiting for, and it is the ONLY path that may cross it. Neither frozen ceiling is
widened: the generic resume stays `USER_PAUSED`-only, and both are proven still refusing — and proven
load-bearing — on the live catalog.

**Eligibility is proven from exact immutable identity, never from time.** One chain: the human's
current act, the act it supersedes, the exact `I-07C` `ACTIVE_INTRODUCTION` pause of a Match commit or
the exact `I-07D` `POST_*` act of a terminal commit, that terminal commit, its terminal Introduction
Record, and this human's exact `RELEASED` claim from it. No timestamp is compared, no ordering is
inferred and no set is searched for a best candidate. One lineage can be crossed at most once.

**Every current truth is revalidated, and the seam is LAST.** Under the caller's own
`matching_setup_locks` row: an eligible current state; a current active Matching Context Grant; a
current Introduction Profile version; a current Matching Requirements version; no `HELD`
active-Introduction claim anywhere; the canonical active-Introduction truth answering false; the prior
Record terminal and the prior claim released; and then the `CW2-08` prerequisite. The canonical
`I-07A` / `I-07B` resolvers are CONSUMED rather than re-implemented. The Pre-Match Proposal Disclosure
Authority is deliberately not required here: it is the authority for a future pre-Match disclosure and
the frozen `I-07B` boundary already requires it at that moment, so demanding it to change a
participation state would make one authority a precondition of another.

**Reactivation changes participation and nothing else.** It moves no proposal out of a terminal state,
clones none, restores no recipient view pointer, revives no `CANCELLED_BY_COMPETING_MATCH`, `STALE`,
`EXPIRED`, `WITHDRAWN` or declined proposal, and creates none; it reopens no World, no membership, no
Introduction Record and no claim.

## 41. `I-07D` — lock order, concurrency proofs and the no-ghost proofs

**The published cross-domain order**, taken by both terminal cores: the exact Shared World row
`FOR UPDATE`; the exact Introduction Record; BOTH humans' `matching_setup_locks` rows in canonical
ASCENDING user-id order through the frozen `0111` helper — never in role order, never in pair
direction order, never incrementally per counterparty; then the membership episodes, participation
pointers, approval pointers and HELD claims in deterministic identity order; then the entitlement
snapshot, the terminal event, the participation acts and the one terminal commit row. No advisory
lock, no table lock, no process mutex.

**Progressive disclosure is Shared-World-local.** It takes the World row and then the exact
Introduction Record, and acquires NO Matching setup lock: after the Match the Shared World lifecycle is
independent, and taking one here would re-couple Matching permission to Shared disclosure and invent a
deadlock surface the law does not require. Approval and withdrawal take the same World-first order as
the terminal commit. Reactivation is a one-human Matching act and takes the caller's own setup row and
then their own participation pointer — the same relative order the terminal cores use, so the two
block rather than deadlock.

**One canonical instant per terminal transaction**, read AFTER every lock wait and every currentness
check, immediately before the irreversible writes, and reused for every effect of that one event. The
`I-07C` lesson is explicit: `CURRENT_TIMESTAMP`, `now()` and `transaction_timestamp()` are all settled
before a lock wait begins and can therefore decide state that changed while the transaction waited.

**Eleven real two-connection races**, each pinned with an observable lock-wait barrier rather than
timing: `SUCCESS` versus `END` in both directions; `END` by A versus `END` by B; the success commit
versus approval withdrawal in both directions; two competing success commands; disclosure versus `END`
and versus `SUCCESS`, each in both directions; `END` versus owner deletion of already-disclosed
material; the terminal transition versus Matching `TURN_OFF` in both directions; the terminal
transition versus a Matching Context Grant revoke; and two reactivation races. Every one asserts no
deadlock, no lock timeout, exact final cardinalities and no partial losing-path effects. The loser of
an `END` versus `END` race is told only that the Introduction is already settled, and is told nothing
about which human won.

**Three no-ghost proofs.** A verifier-local late failure injected on the LAST write of each
transaction — after every other effect is in place — must roll the whole thing back. For disclosure:
no resource version, no payload, no grant fact, no history item, no baseline audience and no material.
For `SUCCESS` and for `END`: no terminal commit, no terminal fact, no claim release, no entitlement, no
episode closure, no participation move, the Record still `ACTIVE` and the World exactly as it was. Each
probe is removed on every path and the same request then commits everything.

## 42. `I-07D` — predecessor forward-seam reconciliation record

Every predecessor census this slice legitimately advances is reconciled in the PREDECESSOR itself, not
evaded and not deleted.

- **`0087`** — the ONE entry point learned `INTRODUCTION`. Its verifier now proves that the Standard
  union, the truthful temporal bounds, the baseline-audience requirement, availability dominance and
  the closed delegation are all intact; that the explicit history-grant basis appears exactly once, so
  the Introduction branch did not inherit selective-history semantics; that the reviewed Introduction
  branch is present; that an unspelled World mode is still refused; and that there is still exactly
  ONE server-role historical visibility boundary.
- **`0088`** — `C23` no longer asserts the ABSENCE of Introduction closure. It now proves that `0088`
  itself still closes Standard Worlds only, that `READ_ONLY_CLOSED / INTRODUCTION` and the
  Introduction entitlement family are produced by exactly `commit_introduction_end_v1`, that the
  Standard entitlement family is still written by exactly `commit_shared_world_standard_end_v1`, and
  that the closed reader has exactly the Standard and Introduction branches and consults no membership
  in either.
- **`0089`** — the reserved `EXPLICIT_DISCLOSURE` kind keeps its frozen `RESERVED` body form and gains
  exactly one reviewed producer. `0089`'s verifier deliberately carries no live census — a fixed list
  there would be a ceiling on the roadmap rather than a fact about `0089` — so the exact-ownership
  census lives where the producer does: in `0115`'s deploy-time assertion, in its verifier, and in the
  phase-closing contract at the tip of the chain.
- **`0090`** — the `DELETE` census is repaired to the exact four targets, with the two new ones proven
  reachable ONLY inside the exact `EXPLICIT_DISCLOSURE` branch and the two frozen ones proven still
  outside it. No other reserved kind became deletable, no old owner-deletion behaviour moved, and the
  canonical primitive is still the only thing in the database that destroys any source content.
- **`0108` / `0109`** — `I-07A` still produces neither reserved `POST_*` reason and neither
  `ACTIVE_INTRODUCTION` nor `SYSTEM_POLICY`; `SYSTEM_POLICY` still has no producer at all. `POST_SUCCESS`
  and `POST_INTRODUCTION` have exactly one reviewed producer each. The generic resume remains
  `USER_PAUSED`-only and the generic activation still refuses the `OFF` lineage; exactly one reviewed
  boundary crosses a post-Introduction pause.
- **`0113`** — the `INSERT`-only producer census is still exactly true, and the `UPDATE` side it could
  not speak to is now proven with the same exact-ownership shape: exactly the two reviewed terminal
  cores move a Record to a terminal state and release a claim, both converge on one unique-keyed
  winner, and the frozen `0113` truth triggers are unchanged.
- **`0114`** — the `ACTIVE_INTRODUCTION` census could not tell a PRODUCER from a READER, which it did
  not need to when nothing else existed. It is narrowed to the `VALUES` shape that produces one, the
  two reviewed terminal cores that merely READ it are NAMED beside it, and the frozen Match core is
  proven to produce no terminal state, no claim release and no post-terminal pause.
- **The shared lifecycle census list** gains one named relation, `introduction_terminal_commits`,
  because it genuinely carries a census word. It is NAMED rather than renamed out of the pattern, which
  is what the `0108` and `0110` censuses ask for in so many words. The other fifteen `I-07D` relations
  carry no census word, so no census reaches them and none demands them.
- **Two tip-shaped assertions** were repaired forward-safely in the same shape `I-07A` already used:
  the `I-07C` contract's "0114 is the migration tip" became "no migration after `0114` belongs to
  `I-07C`", and the two contracts pinning the census expression now pin the union of three named
  per-slice arrays instead of two. Neither claim was weakened.

**No historical migration was edited.** The three replaced functions are replaced forward-only through
`CREATE OR REPLACE` in `0115`.

## 43. `I-07D` — anti-scope, status and verification

**Anti-scope.** No `I-08` mobile surface of any kind: no Matching or Introduction screen, disclosure
UI, image blur or crop UI, success celebration, navigation, proposal card, copywriting or design
system. No `I-09`: no Launch Gate, production safety engine, moderation, report or block, entitlement
or pricing, feature rollout, or production grant or wrapper — `I-07D` creates three fail-closed seams
and implements none of them. No deferred Product decision is frozen: not the progressive image
rendering algorithm, the blur or crop amount, the final disclosure copy, timing or cadence, the final
Introduction Profile field catalogue, the pair cooldown or reproposal policy, or any ranking or score
model. No media storage provider, upload path or credential is built.

**Status.** `I-07D` is **CANDIDATE — awaiting independent ChatGPT review**. `I-07` remains **OPEN**;
`I-07A`, `I-07B` and `I-07C` remain **CLOSED / FROZEN** and no semantic above section 34 is changed by
this slice.

**BG-05 kickoff reconciliation.** `docs/qandeel-canonical-backlog-v1.md` was read in full at kickoff.
No open item names `I-07`, `I-07D`, Introduction or Matching as its **Owner task**, and no item's
reopen condition is met by anything this slice builds. `OPEN-06`, `OPEN-08`, `OPEN-09`, `OPEN-19`,
`QAN-BL-NAV-01` and `QAN-BL-NAV-02` are navigation, acknowledgement, Timeline and Replay-surface
capabilities `I-07D` neither implements nor blocks; `QAN-BL-SEC-01` is owned by `QAN-SEC-01` and is
untouched — this slice changes no mobile auth persistence, no storage mechanism, no backup policy and
no platform credential model, and introduces no cryptography beyond the SHA-256 request and payload
digests earlier migrations already established. Nothing is inherited. No finding from the `I-07C`
review was moved into the backlog in violation of `BG-01`: the register carries no `I-07C` entry at
all.

**Launch readiness is a different claim.** Nothing in `I-07D` can disclose anything to anybody, complete
any Introduction or re-enter any human into Matching in production. Every consequential boundary is
executable by no application role, and the three `CW2-08` prerequisite seams answer `NOT_EVALUATED` and
are each required LAST. The one exception is deliberate and is the point: ending an Introduction
consults no seam at all, because a human must always be able to leave.

**Verification evidence.** Recorded at independent-review handoff, on the exact accepted implementation
head, in the pull request body and in the implementation handoff that accompanies it: two complete
consecutive Focused Database Verification rounds in migration order for `0115`, `0116` and `0117`; the
required predecessor focused regressions for `0087`, `0088`, `0089`, `0090`, `0108`, `0109`, `0113` and
`0114` on that same head; and API CI and Mobile CI on that same head. Local gates were green with
nothing skipped.
