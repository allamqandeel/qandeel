# Durable Thread + Permanent Home + Same-SP DB Substrate v1 (T-03B2b2)

**Canonical Product task:** T-03B2 — Thread Establishment
**Implementation slice:** T-03B2b2 (third slice of T-03B2, after T-03B2a and T-03B2b1)
**Migration:** `database/migrations/0068_durable_thread_home_same_sp_substrate_v1.sql`
**Posture:** PRODUCTION-INERT — no application role executes anything new, and no
Product path can establish a Thread. T-03B2b3 owns runtime orchestration;
T-03D owns the final semantic-chain cutover.

---

## 1. What this slice makes durable

T-03B2a judges ONE committed CU and returns a prepared TE-01 / TE-02 / TE-03
decision. T-03B2b1 froze `QANDEEL_OSDAP_V1`, the pure permanent Home placement
engine. This slice turns both into permanent world state while preserving the
frozen Stage-6 same-SP order:

```text
1. CU is committed / receives SP
2. references + conversational focus are resolved          [T-03B1b1]
3. Emerging Focus continuity is resolved                   [T-03B1b1]
4. optional Thread establishment + permanent Home          [this slice]
5. effective LF                                            [T-03D]
```

Per committed CU, inside ONE transaction:

```text
allocate this CU's SP
-> make that SP the current open head
-> reserve same-SP sequence 1 through the ONE T-03A2 seam
-> persist the whole T-03B1 reference / focus bundle at it
-> inspect this CU's canonical B2 decision
     NO_ESTABLISHMENT  -> reserve NOTHING
     ESTABLISH_THREAD  -> lock this user's world, compute the canonical Home
                          against the world as it actually stands, reserve
                          same-SP sequence 2, and insert the Thread, its
                          permanent Home, the explicit ThreadEstablished
                          event, its evidence and its Conversational Origin
                          provenance atomically
-> only then may the next CU advance the clock and seal this SP
```

Expected clock on a Moment: `same_sp_event_sequence = 1` for B1 alone,
`= 2` when that Moment also established a Thread. T-03D will later append
effective LF at sequence 2 or 3 accordingly; nothing here forces it to backdate.

---

## 2. Identity scope: user/world, not Session

A canonical Thread belongs to the user's persistent Conversation World, while
the establishing Emerging Focus stays Session-scoped. Promotion therefore
creates an immutable lineage rather than a rename:

```text
EmergingFocus (session-scoped)  →  ESTABLISHMENT  →  Thread (user/world-scoped)
```

`apps/api/src/thread-establishment/durable-thread-canonicalizer.ts` derives the
three identities from frozen namespace URIs, deterministically and server-side:

```text
thread_id                   = uuidV5(THREAD_NAMESPACE,       userId + ":" + emergingFocusId)
home_anchor_id              = uuidV5(HOME_ANCHOR_NAMESPACE,  threadId)
thread_established_event_id = uuidV5(THREAD_EVENT_NAMESPACE, threadId)
```

The provider never authors an identity, and the same canonical promotion always
yields the same three ids, so a retry is recognised as an exact replay. The
earlier Emerging Focus history is never rewritten, and cross-session sameness is
NOT decided here — a later slice may bind a later Session focus to an existing
Thread, but must reuse the same Home.

**The database derives the same three identities itself.** "UUID-shaped and
mutually distinct" is not canonical identity: a privileged internal caller that
could substitute another well-formed UUID would also be choosing the permanent
placement entropy, because OSDAP consumes `thread_id`. Migration 0068 therefore
carries its own exact RFC 4122 / RFC 9562 version-5 derivation in pure PL/pgSQL
(`canonical_sha1_v1` → `canonical_uuid_v5_v1` → `canonical_thread_identities_v1`
— no extension, no new dependency, no caller-authored namespace, no
application-role EXECUTE), derives the expected triple from the DB-derived owner
and the already-validated Emerging Focus, and requires exact equality before the
world lock, the placement, the same-SP reservation and any durable row. A
mismatch is `INVALID_THREAD_IDENTITY`; nothing is silently replaced. The
placement and the durable rows then use the *derived* identity, so the payload
is out of the identity path entirely. The migration refuses to deploy unless the
SQL derivation reproduces the three frozen namespaces from their documented
URIs, the RFC 4122 reference vector and the pinned Thread vector.

---

## 3. Exactly one permanent Home per Thread

`conversation_thread_homes.thread_id` is the PRIMARY KEY, so a second Home for a
Thread is structurally impossible; `UNIQUE(user_id, address_scheme,
placement_x, placement_y)` makes a second Thread at one canonical place
impossible. Every canonical table is append-only for the owner too, so a Home
can be neither updated nor relocated by delete-and-reinsert. After commit there
is no Thread without its Home and no Home without its Thread.

The database is the ONLY permanent-placement authority. Neither the writer nor
the coordinator accepts a coordinate, a base, an attempt or a fingerprint: under
the per-user-world lock the writer reads the world as it actually stands and
recomputes the placement itself.

---

## 4. QANDEEL OSDAP v1 in PostgreSQL

Migration 0068 mirrors the frozen TypeScript engine step by step in exact
integer (`numeric`) arithmetic, with the same proof seams:

| seam | function |
| --- | --- |
| floor division toward negative infinity | `osdap_floor_div_v1` |
| big-endian unsigned digest half | `osdap_unsigned_v1` |
| canonical Home serialization (byte order) | `osdap_serialize_homes_v1` |
| world / origin fingerprints | `osdap_world_fingerprint_v1`, `osdap_origin_fingerprint_v1` |
| per-attempt digest | `osdap_attempt_digest_v1` |
| square mapping + outer-half projection | `osdap_candidate_offset_v1` |
| first admissible candidate | `osdap_search_admissible_placement_v1` |
| the whole placement, bound to the REAL fingerprints | `compute_canonical_home_placement_v1` |

Frozen constants: scheme `QANDEEL_OSDAP_V1`, digest domain `qandeel-osdap-v1`,
`MIN_COORD = -(2^62)`, `MAX_COORD = 2^62 - 1`, `HOME_STEP = 1000000`,
`MIN_HOME_SEPARATION = 250000`, `CANDIDATES_PER_SHELL = 32`,
`MAX_ATTEMPTS = 8192`. Out-of-bound candidates are skipped, never clamped or
wrapped; exhaustion fails closed with `CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED`.

`database/verify-migration-0068.mjs` replays all seven frozen golden vectors
(GV-01 … GV-07) plus negative floor division, the projection boundary, dense
shell escalation, the exact minimum separation, the technical bound skip and
capacity exhaustion against real PostgreSQL. The T-03B2b1 TypeScript sources
stay byte-identical.

---

## 5. The database re-proves every gate

A privileged caller must not be able to fabricate an impossible establishment,
so `validate_conversation_thread_decision_v1` re-proves, against the locked
canonical rows: the twelve-key decision shape; that the target is exactly the
Emerging Focus this CU's canonical B1 attention starts or attends; that the
focus belongs to this Session and owner and is not already promoted; that the
three identities are canonical and distinct; that the establishing CU appears
exactly once and last in the evidence; that every prior evidence CU is an
earlier committed CU of the same Session bound to the SAME focus.

* **TE-01** requires a USER CU, evidence of exactly that CU, and an explicit
  selection validated against the committed wording in code-point coordinates.
  A selection wholly inside a `REPORTED_SPEECH` or `DIRECT_QUOTATION`
  attribution of the same CU is refused (THR-12).
* **TE-02** requires at least two distinct evidence CUs, at least one prior CU
  and at least one USER CU. No score, no time threshold.
* **TE-03** requires that the current attention is not a local clarification,
  that the LATEST prior START/ATTEND of the target focus over the FULL canonical
  history is itself cited, that known intervening committed material off the
  target focus exists after it, and at least one USER evidence CU. The boundary
  is derived from the history, never from the evidence the caller chose, so
  provider-selected older evidence cannot manufacture a recurrence.

`NO_ESTABLISHMENT` is equally validated: `NO_INDEPENDENT_FOCUS` requires that
this CU carries no independent attention; `ALREADY_ESTABLISHED` requires an
existing lineage for exactly this focus; `NO_PROMOTION_PATH_PROVEN` requires
that none exists. A technical provider or runtime failure is never persisted as
truthful non-establishment.

---

## 6. Conversational Origin is provenance, never parenthood

`conversation_thread_origin_members` stores membership only:
`NONE` → 0 members, `RESOLVED` → exactly 1, `MULTIPLE` / `AMBIGUOUS` → at least
2, in canonical textual order, every member an already-canonical Thread of the
same user world that already holds its permanent Home. There is deliberately no
`parent_thread_id`, no `primary_origin`, no `edge_direction` and no semantic
distance; MULTIPLE and AMBIGUOUS are handled symmetrically, and the placement
base is the exact integer barycenter over ALL members.

---

## 7. Serialization, replay and atomicity

**Lock order (AF66-01), provable from the deployed body:**

```text
Session Semantic Clock FOR UPDATE  →  source turn  →  B1 semantic rows
                                   →  user-world spatial authority
                                   →  Thread / Home rows
```

`conversation_world_spatial_authorities` is a technical serialization row (one
per user, immutable scheme, no rank, counter or layout state). It is lazily
inserted and locked only when an establishment is actually proven, always after
the Session clock. Two Sessions of one user establishing concurrently do not
race: the loser waits, then computes its placement against the
winner-inclusive world. No duplicate Home, no stale pre-lock world, no
committed Home moves.

**One completeness authority.** `conversation_thread_batch_state_v1` is the
single read-only, timestamp-free classifier over all three layers of a
committed-CU batch — commitment, B1 capture, B2 capture — returning `ABSENT`,
`COMPLETE` or `PARTIAL`. Counting Threads, Homes and events against
`establishment_count` is not enough, so COMPLETE additionally requires: capture
identity agreement across the three batch rows; exactly `establishment_count`
establishments with no missing and no *extra* durable Thread or Home; per
establishment, one Thread, one Home and one event agreeing on identity, owner,
Session, establishing CU, SP, same-SP sequence 2, focus and path, with the
establishing CU inside this batch at that SP and its identities equal to the
derived canonical ones; evidence that is non-empty, contiguous from ordinal 0,
carries exactly one `ESTABLISHING_CU` as its final row and whose every prior CU
is an earlier same-Session CU B1-bound to the same focus; and Conversational
Origin membership matching the recorded state's cardinality, in canonical
textual order, every member an already-canonical Thread of this world that
already holds a Home. A nonzero batch that established nothing, and a zero-CU
batch, are COMPLETE — not absent.

The **same** authority serves the per-batch writer's replay gate and the
finalized-exchange half-state gate, so the two can never disagree.

**Replay / partial state:**

| classified state | outcome |
| --- | --- |
| `ABSENT` | new integrated batch, all layers atomically |
| `COMPLETE` + identical payload | stored canonical state, zero mutation, zero sequence consumed |
| `COMPLETE` + changed B2 payload or provenance | `THREAD_BATCH_PAYLOAD_CONFLICT` |
| `PARTIAL` (missing layer, corrupted evidence, origin or coherence) | `THREAD_CAPTURE_BATCH_INTEGRITY` — never repaired |
| zero-CU batch | capture row with `unit_count = 0`, `establishment_count = 0`; no SP, no sequence, no Thread |

Beyond the fingerprint, an exact replay also compares the stored evidence CU
ids and the stored origin members to the canonical payload, in order, so a
substituted or reordered provenance row can never pass as a replay.

**Finalized-exchange half states.** Before the stale-token logic and before
*either* writer is invoked, the coordinator classifies BOTH halves. Only two
combinations are legitimate:

```text
ABSENT   + ABSENT     a NEW exchange; the expected token must match
COMPLETE + COMPLETE   an exact replay; the token is irrelevant, each writer
                      still proves its own payload fingerprint
```

Everything else — one half canonical while the other is absent or structurally
partial — fails `THREAD_CAPTURE_BATCH_INTEGRITY` before any mutation. A
stale-token failure is not a substitute for this gate: with a *current* token an
asymmetric exchange would otherwise replay the stored half and create the
missing one, which the frozen contract forbids.

Every failure rolls the whole transaction back: no orphan Thread, no orphan
Home, no consumed same-SP sequence 2 and no half-finished finalized exchange.

---

## 8. Security / activation posture

At the end of migration 0068 the new writer, the new coordinator, the decision
validator, the persistence helper, the identity authority, the completeness
authority and every internal OSDAP and digest helper are executable
by NO application role, and every new table is unreachable by `anon`,
`authenticated` and `service_role`. The T-03A2 producer / coordinator / snapshot
grants and the ungranted T-03B1b1 writer and coordinator are left exactly as
they were, and the same-SP reservation helper stays internal. No
`ConversationService` or `ConversationModule` change accompanies this slice, and
the migration coexists safely with legacy T-03A2 and T-03B1 batches: nothing is
backfilled, no Session is declared historical-enabled, and there is no
activation or cutover flag.

Out of scope here and unauthorized: Thread lifecycle / Dormant / Reopened,
cross-session reopening identity resolution, Thread ↔ Reading bindings, Live
Focus, T-03C historical projection, Neighborhood geometry, Thread merge, mobile
rendering.

---

## 9. Gates

```text
npm run test:durable-thread-home-same-sp-substrate-contract
npm run verify:durable-thread-home-same-sp-substrate:integration   # real PostgreSQL
node --test database/tests/durable-thread-home-same-sp-substrate-v1.test.mjs
```

Both are wired into API CI: the static contract with the other static gates
before the database bootstrap, the verifier after the 0067 verifier.
