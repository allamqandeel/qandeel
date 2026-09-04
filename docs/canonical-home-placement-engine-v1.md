# Canonical Home Placement Engine v1 — QANDEEL OSDAP v1

**Task:** T-03B2b1 (second slice of canonical Product task T-03B2 — Thread Establishment) · **Status:** implementation contract, PURE / production-inert · **Migration:** none · **Engineering decision:** ED-B2B1-01

Choosing the canonical Home placement encoding is permanent world architecture: once an
Established Thread receives its Home, no later code may move it, recalculate it, swap it,
re-layout it or migrate it to a "better" algorithm, because Stage 2 requires

```text
same Thread -> same Home -> same Canonical Spatial Address -> same canonical placement
```

and an opaque identity token alone cannot carry that. Architecture therefore split T-03B2b:

```text
T-03B2a   Thread Establishment semantics                  CLOSED / MERGED
T-03B2b1  Canonical Home Placement Engine                 THIS SLICE
T-03B2b2  Durable Thread + Home + same-SP DB substrate    NOT AUTHORIZED
T-03B2b3  Runtime orchestration + readiness               NOT AUTHORIZED
```

T-03B2b1 is deliberately pure so an unsuitable geography algorithm can be rejected
**before** any permanent user world state depends on it. It has no migration, no Thread
row, no Home row, no Thread identity allocation, no service-role RPC, no Nest wiring, no
provider call, no mobile change, no lifecycle write and no LF. It lives in
`apps/api/src/thread-establishment/home-placement/`, reaches nothing and is reached by
nothing; T-03B2a's own `index.ts` is untouched.
`tests/canonical-home-placement-engine-contract.test.mjs` proves every one of those
statements statically in API CI and replays the golden vectors and the 10,000-Thread
append proof in a separate Node process.

## Binding spatial truth the engine preserves

| frozen rule | how the engine honours it |
| --- | --- |
| one permanent Home per Established Thread; none for Emerging Focus | the engine is a pure function of the new Thread id, its Conversational Origin and the then-existing committed world; it is consulted only for NEW establishment and refuses a Thread that already holds a Home (`THREAD_ALREADY_PLACED`) |
| refinement / reopening never reposition | `resolveThreadHome(committedHome, placeNew)` keeps a committed Home unchanged on every later occasion and never calls `placeNew`; there is no relocation, re-layout, second pass or global optimization anywhere |
| append-oriented growth: new geography adapts, old geography never moves | the new Home adapts through the world fingerprint (candidate sequence) and the separation test; existing Homes are read-only inputs, copied once and never written |
| Conversational Origin is placement input, never hierarchy | origin only moves the search datum; the result carries no parent, edge, level, direction or member reference; MULTIPLE and AMBIGUOUS use one symmetric barycenter over ALL members and elect no primary |
| no semantic, importance, similarity, confidence, popularity, viewport or device authority | the request is closed to exactly four fields at type level AND at runtime (exact-key allowlist); no such channel can be authored or smuggled |
| exact, renderer-independent, replayable placement | signed-integer BigInt coordinates only; SHA-256 entropy; no `number` coordinate, no floating point, no random source, no clock, no locale-sensitive serialization |

## The closed input and the canonical result

```text
HomePlacementRequest
  userWorldId      canonical user / world owner id            (closed ASCII identity charset)
  newThreadId      the Thread being established
  origin           NONE | RESOLVED(1) | MULTIPLE(>=2) | AMBIGUOUS(>=2)   members = existing Homes, exact coordinates
  existingHomes    every committed permanent Home: { threadId, x: bigint, y: bigint }

CanonicalHomePlacement
  scheme           'QANDEEL_OSDAP_V1'      place identity = scheme + x + y (+ permanent home_anchor_id later)
  x, y             bigint
  attempt          zero-based index of the first admissible candidate   } establishment provenance /
  baseX, baseY     the origin seed point                                 } reproducibility data
  worldFingerprint sha256 hex of the then-existing world
  originFingerprint sha256 hex of the origin state + members
```

Identity charset: `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$` — no whitespace, control characters
or the `|` digest separator, so every canonical serialization is injective. RFC 4122 UUIDs
satisfy it; T-03B2b2 owns the actual identity allocation.

Rejections are typed and closed (`CanonicalHomePlacementRejectedError.reason`):
`INVALID_PLACEMENT_INPUT`, `DUPLICATE_EXISTING_THREAD_ID`, `DUPLICATE_EXISTING_PLACEMENT`,
`EXISTING_HOME_OUT_OF_BOUNDS`, `THREAD_ALREADY_PLACED`, `INVALID_ORIGIN_CARDINALITY`,
`DUPLICATE_ORIGIN_HOME`, `UNKNOWN_ORIGIN_HOME`, `ORIGIN_HOME_MISMATCH`,
`CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED`. Nothing is guessed, clamped, filtered or wrapped.

The engine does not re-judge committed geography: two existing Homes closer than the
minimum separation are accepted as the world they are (a world this engine produced can
never contain them); only an exact duplicate placement or an out-of-bound coordinate is a
malformed world.

## Constants (v1 Engineering constants — placement viability only, never Product quantities)

| constant | value |
| --- | --- |
| `CANONICAL_HOME_PLACEMENT_SCHEME` | `QANDEEL_OSDAP_V1` |
| `OSDAP_DIGEST_DOMAIN` | `qandeel-osdap-v1` |
| `MIN_COORD` / `MAX_COORD` | `-(2^62)` / `2^62 - 1` — a technical storage bound, not a Product "edge of the world" |
| `HOME_STEP` | `1 000 000` |
| `MIN_HOME_SEPARATION` | `250 000` (Chebyshev) |
| `CANDIDATES_PER_SHELL` | `32` |
| `MAX_ATTEMPTS` | `8192` (shells 1 … 256) |

## The algorithm, exactly

1. **Validate** the closed request shape (exact enumerable keys at every level, BigInt
   coordinates, identity charset, coordinate bound, no duplicate Thread id, no duplicate
   placement, origin members known / distinct / coordinate-identical, origin cardinality,
   new Thread not already placed). Homes are copied once into frozen objects; the caller's
   objects are never mutated or retained.
2. **Seed point.** `NONE` → the world datum `(0,0)` — a search datum only, never a semantic
   center and never an automatic placement (the first Thread is never placed at the datum:
   every candidate lies at least `ceil(radius/2)` away from the base). `RESOLVED` → the
   one origin Home. `MULTIPLE` / `AMBIGUOUS` → the exact integer barycenter over ALL
   members, `floorDiv(sum, count)` with floor toward negative infinity
   (`floorDiv(-7, 2) = -4`, `floorDiv(-6, 2) = -3`). The same function serves both
   multi-member states; the states differ only in the origin fingerprint.
3. **Fingerprints.** `worldFingerprint = sha256("QANDEEL_OSDAP_V1\n" + lines)` and
   `originFingerprint = sha256(state + "\n" + lines)`, each line `threadId\tx\ty\n`, lines
   sorted by Thread id under UTF-16 code-unit order (never `localeCompare`), coordinates as
   decimal BigInt. Input order is irrelevant. No timestamp ever enters a fingerprint.
4. **Candidate search.** For zero-based attempt `i < 8192`: `shell = 1 + floor(i / 32)`
   (BigInt division), `radius = HOME_STEP * shell`,
   `digest = sha256("qandeel-osdap-v1|userWorldId|newThreadId|originFp|worldFp|i")`;
   `uX` = the first 16 digest bytes big-endian, `uY` = the last 16;
   `dx = uX mod (2·radius + 1) − radius`, likewise `dy`, so the raw offset lies in
   `[-radius, +radius]²`.
5. **Outer-half projection.** Require `max(|dx|, |dy|) >= ceil(radius / 2)`. Otherwise the
   DOMINANT component (larger absolute value; **x on an exact tie**) is replaced by
   `sign · ceil(radius / 2)` — the nearest signed boundary of the outer half — where a
   **zero component counts as positive**; the other component is kept. GV-02's `dy = 500 000`
   is a natural instance of this rule.
6. **Bound.** `candidate = base + offset`; a candidate outside `[MIN_COORD, MAX_COORD]²` is
   skipped, never clamped or wrapped.
7. **Admissibility.** A candidate is admissible only when its Chebyshev distance to EVERY
   existing Home is `>= MIN_HOME_SEPARATION`. The test is accelerated by bucketing Homes
   into `2^18`-wide cells (at least the minimum separation, floored by an arithmetic shift),
   so a 3×3 neighbourhood search is exact; the comparison itself is always the exact
   Chebyshev test. Exactly the minimum is admissible; one unit less is not. The distance
   carries zero semantic meaning.
8. **First admissible candidate wins.** Otherwise `CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED`,
   fail closed — no old Home moves, no global optimization, no second pass.

"Shell" is a search mechanism only. It is not a Thread level, importance, generation,
hierarchy or Timeline, and it is not part of the result.

## Laws proven

- **Determinism / replay (section 10).** Same `userWorldId`, `newThreadId`, origin,
  committed world and engine version ⇒ byte-identical result across calls, processes and
  operating systems. Seven golden vectors (GV-01 … GV-07) and three stress goldens are
  pinned in `home-placement-vectors.ts`, verified in Jest and replayed by the static
  contract in a separate Node process on API CI (Linux) exactly as on the authoring machine
  (Windows).
- **Append-only (section 11).** `W0 → P1`, `W1 = W0 + P1 → P2`, `W2 → P3`: P1 and P2 never
  change; every placement of the 100 / 1,000 / 10,000 Thread scenario replays exactly
  against the world as it then stood, presented in any order.
- **Origin invariants (section 12).** RESOLVED changes only the base; the result is distinct,
  not a child, has no origin edge and no required direction. MULTIPLE and AMBIGUOUS are
  invariant under every member permutation and elect no primary; AMBIGUOUS still places.
  NONE fabricates no nearest or parent Thread; the first Thread is not `(0,0)` and not a root.
- **No semantic-geography channel (section 13).** No `similarity`, `embedding`,
  `confidence`, `importance`, `rank`, `score`, `reading`, `evidenceStrength`,
  `relationCount`, `connectionCount`, `emotion`, `sentiment`, `priority`, `popularity`,
  `viewport`, `screen`, `device`, label, path, CU text or extension bag exists in the
  request type or the implementation; a smuggled key is rejected at runtime.
- **Capacity / bound.** With every candidate blocked the engine exhausts at exactly
  `MAX_ATTEMPTS`; at the corner of the world it skips out-of-bound candidates and exhausts
  rather than clamp or wrap.

## Proof map (task section 14)

| items | where |
| --- | --- |
| 1–7, 12–13, 32–35 | `home-placement-engine.spec.ts` — origin seed point, determinism, golden vectors, non-substitution |
| 8–11, 24–26 | `home-placement-engine.spec.ts` — the closed request shape (type-level `@ts-expect-error` + runtime rejection) |
| 14–18 | `home-placement-engine.spec.ts` — floor division, shell boundary, projection tie rule, exact-minimum separation |
| 19–21 | `home-placement-engine.spec.ts` — dense origin, exhaustion, coordinate bound |
| 22–23, 31 | `home-placement-engine.spec.ts` — `resolveThreadHome` never consults the engine for an existing Home; inputs never mutated |
| 27–30 | `home-placement-stress.spec.ts` (100 / 1,000) and the static contract's separate-process 10,000-Thread replay |

Stress outcomes under the frozen constants: 100 Threads → `maxAttempt 42`; 1,000 → `184`;
10,000 → `603` (all far below `MAX_ATTEMPTS`), with world fingerprints pinned.

## What T-03B2b2 MUST do with this

- Call `placeCanonicalHome` exactly once per Thread establishment, inside the same-SP
  per-Moment transaction, **serialized per user world** against the committed Home set as
  it then stands (the engine guarantees separation against the world it is given; two
  concurrent placements against the same world are the caller's error, not the engine's).
- Persist `scheme`, `x`, `y`, `attempt`, `baseX`, `baseY`, both fingerprints, the origin
  state and the origin candidate ids as immutable establishment provenance beside the
  permanent `home_anchor_id`.
- Never call the engine for refinement, dormancy, reopening or an existing-Thread return;
  `resolveThreadHome` is the consumer rule.
- Never persist a `number` coordinate, never re-derive or re-run a committed placement,
  never add an origin edge or parent relation from the provenance.

## Files

```text
apps/api/src/thread-establishment/home-placement/
  home-placement.types.ts        frozen types, constants, closed vocabularies, rejection error
  home-placement-engine.ts       OSDAP v1 - validation, seed point, fingerprints, search, admissibility, engine, consumer rule
  home-placement-scenario.ts     deterministic append-growth scenario + dense lattice fixture
  home-placement-vectors.ts      pinned golden vectors GV-01..GV-07 and stress goldens
  sha256-canonical.ts            the one hashing primitive (node:crypto)
  index.ts                       public surface: types + placeCanonicalHome + resolveThreadHome
  home-placement-engine.spec.ts  adversarial proof suite
  home-placement-stress.spec.ts  append laws at 100 / 1,000
tests/canonical-home-placement-engine-contract.test.mjs        static anti-scope contract + separate-process replay
tests/canonical-home-placement-engine-stress-runner.mjs        the replay runner (ts-node, transpile-only)
```
