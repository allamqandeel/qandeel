# Recovery / Persistence v1 — T-13

**Status:** CANDIDATE — awaiting independent review
**Baseline:** `6bf04ccec5c4fe4f847eecd7f76083b23694711b` (canonical `main` after PR #222)
**Branch:** `feat/t13-recovery-persistence-v1`
**Architecture:** `QANDEEL — T-13 Recovery / Persistence v1` (re-anchored), FROZEN FOR IMPLEMENTATION
**Owner of:** the Product recovery persistence boundary (`apps/mobile/src/recovery/`), the active
Session locator per identity, the durable viewpoint (`TM`, `IF_ref`, `MC`, `RH`), the recovery
decision and its fail-closed refusals, the readiness sequencing inside the integration owner
**Not owner of:** any Product sign-in gateway (`QAN-BL-AUTH-01`), credential storage hardening
(`QAN-BL-SEC-01`), the canonical kernel, any temporal / Return / inspection semantic, any visual
language, any backend change

> **Persist the user's durable viewpoint and active Session locator. Re-fetch server-authoritative
> truth before Product READY. Reconstruct derived state deterministically. Reset ephemeral
> presentation/runtime state. Never present stale local state as current truth.**

`T-13 backlog inheritance: 1 item` — `QAN-BL-T13-01 — Restart / Recovery / Persistence`, included
in this contract (BG-05). `QAN-BL-AUTH-01` and `QAN-BL-SEC-01` are explicitly OUT of scope and are
neither claimed nor touched.

---

## 1. Authority topology

| Owner | What it keeps | What T-13 does with it |
| --- | --- | --- |
| T-02 canonical state | the kernel, the exact-shape validators, `Φ_eff`, RH | consumes one store; adds no field, act or mode; reuses its validators to decode a record |
| T-03A2 / T-03D live mirrors | `LH` and `LF` | never persists either; both come from the fresh snapshot the bootstrap fetches |
| T-03C projection | the wire, the transport, the one cache | persists no disclosure; the initial disclosure is fetched at the recovered viewpoint's position |
| T-04 Map | camera encodings, `initialCameraIntent()` | uses `decodeCameraIntent` to refuse an undecodable `MC`; never retargets |
| T-07 Return | the six acts, provenance, the checkpoint registry | restores `RH` entries verbatim; `BACK_ONE_STEP` works from restored history through T-07's own executor |
| T-08 chrome / T-12 journey | the process-local Exact Return origin | deliberately NOT persisted; reset by restart |
| T-12P runtime entry | identity, config, Session acquisition, bootstrap, live driver | extends the bootstrap with `initialViewpoint` beside the existing `existingSessionId` seam; the auth store stays auth-only |
| T-12 integration | app-root lifecycle | sequences load → decide → bootstrap → READY; retires the recovery writer with the generation |

**The one new owner:** `apps/mobile/src/recovery/` — schema and strict codec, explicit migration
runner, the Product recovery store, the recovery decision, the recovery writer. It is a persistence
boundary, not a runtime state model: it holds no canonical state, dispatches nothing, fetches nothing.

---

## 2. The frozen boundary: two stores, two files, two vocabularies

| | Auth store (T-12P) | Product recovery store (T-13) |
| --- | --- | --- |
| module | `runtime-entry/auth/auth-session-storage.ts` | `recovery/store/product-recovery-store.ts` |
| database file | `qandeel-auth-session.db` | `qandeel-product-recovery.db` |
| keys | Supabase's own, written by the SDK | `qandeel.product.recovery.v1:<ownerUserId>` |
| holds | access token, refresh token, expiry, user object | the record in §3 — and no credential |
| mechanism | `expo-sqlite/kv-store` (official Supabase-on-Expo route) | the SAME mechanism, its own file; no persistence library introduced |

The T-13 contract proves the separation by construction: exactly two production modules in the app
name the storage mechanism; the recovery boundary contains no auth vocabulary
(`accessToken`, `refresh_token`, `Bearer`, `supabase`, `password`, …) and the auth store contains no
Product vocabulary (`sessionId`, `camera`, `inspection`, `viewpoint`, `checkpoint`, …), each with a
planted-defect non-vacuity proof. The boundary is independently testable (its own four focused suites
run against an in-memory storage) and independently clearable (`clear(ownerUserId)`, which no Product
act calls).

**Not encrypted at rest, exactly like the auth store, and less sensitive than it:** the record holds
a Session locator and a viewpoint, never a credential. The at-rest disposition and the platform
backup question remain `QAN-SEC-01`'s (`QAN-BL-SEC-01`); T-13 introduces no hardware-specific or
secure storage and therefore does not intersect it.

---

## 3. The recovery record

```text
schemaVersion   1
ownerUserId     the authenticated identity's locator (namespace key; non-secret)
sessionId       the active conversation Session, exactly as the server minted it (UUID)
viewpoint       { temporal, inspection, camera, history }   =  TM, IF_ref, MC, RH
sequence        monotonic per owner; write-ordering metadata, never Product truth
```

**Persisted (§3.1):** exactly the five keys above. `temporal` is the MODE: `FOLLOW_LIVE` persists no
position at all; `PINNED(t)` persists exactly `t`.

**Reconstructed (§3.2):** the effective `TC` (`FOLLOW_LIVE → fresh LH`, `PINNED(t) → t`), the concrete
camera (from `MC` plus the current viewport, by T-04 as always), return availability (from the
restored state and `RH`), presentation and Timeline geometry.

**Re-fetched (§3.3):** Session existence / ownership / authorization (the snapshot `GET` under the
identity's bearer), `LH`, `LF`, committed-CU and LF catch-up, the initial disclosure at the recovered
position, and every projection the composition then requests.

**Reset (§3.4):** foreground cursors (from the fresh snapshot), preview / `PTC`, gesture and motion
state, the Timeline window, viewport pixels, and the process-local inspection-journey origin.

**Forbidden (§3.5):** `LH`, `LF`, an effective `TC`, `K(TC)`, `V`, any disclosure or projection, the
scene, animation state, any credential, and Product state inside the auth store. The record type has
no key for any of them, the encoder builds the wire form field by field from the allowlist (never a
spread), and the static contract forbids their spellings in the boundary's code.

---

## 4. Identity

Recovery is strictly identity-scoped. The record lives under the owner's namespace key AND names its
owner again; the store refuses a record naming another owner, and the decision refuses it a second
time independently. The load is keyed by the AUTHENTICATED identity's `userId` and happens only inside
the authenticated bootstrap, so:

- a signed-out launch reads no Product recovery at all (proven: zero storage reads);
- identity A → sign out: the runtime generation retires, the writer retires, A's record stays stored
  and is unreachable while signed out (no path from a signed-out runtime to it);
- identity B signs in: only B's namespace is read; B never sees A's `sessionId`, `TM`, `IF_ref`, `MC`
  or `RH` (proven: B's create carries B's bearer and yields a different Session);
- A signs in again: A resumes A's own valid record (proven: zero further creates).

Sign-out deletes nothing. Explicit account-data deletion is outside T-13.

---

## 5. The active Session

T-13 owns only the current active Session locator per identity: no browser, no catalog, no
cross-Session Timeline, no Replay, no merge.

| Loaded record | Decision | Bootstrap |
| --- | --- | --- |
| none | `FRESH` | the existing clean bootstrap: ONE `POST /conversation/sessions` |
| valid | `RESUME` | the existing bootstrap through `existingSessionId` + `initialViewpoint`: NO create; the snapshot `GET` validates the Session against server authority |
| corrupt / incompatible / foreign-owner / unreadable storage | `REFUSED` | none. `RECOVERY_FAILED` is published; no replacement Session is minted |
| valid, but the server refuses the Session (401 / 403 / 404) or names another Session | — | the bootstrap fails; published as `RECOVERY_FAILED { SESSION_INVALID }`; no replacement Session is minted |

"Unavailable storage" is refused rather than treated as "no record": creating a fresh Session while the
reader's real one may still be stored would orphan the real one. Not knowing is not knowing there is
nothing.

**There is no fresh-start action**, because no existing approved Product action provides one, and
inventing a hidden fallback is forbidden. A refused recovery is therefore terminal for that identity's
launch — a controlled, named technical state — exactly as a failed bootstrap already is (T-12 §14).

---

## 6. Readiness

```text
auth identity
  -> RECOVERING      load and validate THIS identity's record
  -> decide          FRESH | RESUME | REFUSED
  -> BOOTSTRAPPING   validate the Session (snapshot GET), fetch fresh LH/LF, judge the viewpoint
                     against them, fetch the initial disclosure at the recovered position, create
                     the ONE store from fresh live truth + the recovered viewpoint
  -> READY           the composition mounts; the T-12 coordinator requests every projection it needs
```

`READY` is published in exactly one place, strictly after the bootstrap resolved. The forbidden order
— restore locally, render a stale world, fetch, correct — is unrepresentable: there is no store to
render until the server has answered, and the Product root renders only the technical phase name
(`runtime: RECOVERING`, `runtime: BOOTSTRAPPING`, `runtime: RECOVERY_FAILED`) before READY.

---

## 7. `FOLLOW_LIVE` and `PINNED(t)`

- `FOLLOW_LIVE`: the mode is persisted and no position is. On recovery the effective `TC` is the
  fresh server `LH` (proven with a record written at `LH = 30` and a server that moved to 80: the store
  mirrors 80 and the effective `TC` is 80; the record never carried a Live Head).
- `PINNED(t)`: `t` is persisted exactly. On recovery the fresh snapshot is fetched, `LH` is mirrored
  fresh, the effective `TC` stays `t`, nothing moves the reader to the Live Head, and the initial
  disclosure is requested at `t` (`tc=t` on the wire, never `tc=LH`). No-hindsight is the server's
  and stays intact: `K(t)` is what the server discloses for `t`.
- an impossible `t` (beyond the fresh `LH`, or any `t` when the Session has no Live Head) fails the
  attempt closed as `VIEWPOINT_INCOHERENT`; it is never clamped or repaired.

---

## 8. `IF_ref`, `MC`, `RH`

- **`IF_ref`** is restored exactly. The projection under the recovered `TC` is NOT_FETCHED until the
  composition fetches it; T-04 / T-08 already treat that as a technical state, never as semantic
  absence, and nothing rebinds the reference to another object.
- **`MC`** is restored exactly, after T-04's own `decodeCameraIntent` has proven it decodable — a
  camera under a foreign scheme, a float coordinate or an unknown depth rejects the record whole. The
  concrete camera is then rebuilt by the Map from `MC` plus the current viewport. The window changes;
  the world does not.
- **`RH`** is restored verbatim — every entry keeps its `act` and its `captured` tuple — after the
  kernel's `rhEntryShapeIssue` and the Map's camera decoder have admitted every checkpoint, and after
  the bootstrap has judged every captured `tc` against the fresh `LH`. Malformed history rejects the
  record whole; nothing is partially repaired. Restored entries are the objects in the store's own
  history, so T-07's identity-based provenance works unchanged: `BACK_ONE_STEP` restores
  `PINNED(capturedTC)` from restored history and consumes exactly one entry.

---

## 9. Exact Return origin: intentionally reset

The Original Inspection Journey Origin is a process-local capability bound by the T-12 journey
coordinator at the moment a journey begins. It is not serialized, not synthesized and not guessed: after
a restart `journey.origin()` is `null` even when the restored `IF_ref` is non-null and the restored
`RH` holds an `INSPECT_OBJECT` checkpoint. `BACK_ONE_STEP` still works from that history, and a new
journey begun after restart binds a new valid origin under the existing rules. `EXACT_RETURN` is not
aliased to `BACK_ONE_STEP`, Return to World or Home. This is an intentional reset, recorded here rather
than presented as recovery.

---

## 10. Corruption, schema, migration

The decoder is fail-closed and whole. Rejected: malformed JSON, a non-object payload, a missing or
unknown key at either level, a non-current schema version, a non-UUID Session, an empty owner, a bad
sequence, a third temporal mode or a non-positive pinned time, a mis-shaped inspection reference, an
undecodable camera, a malformed checkpoint, a non-RH act identity, a checkpoint over the absence
sentinel, an owner mismatch, and (at the bootstrap) any position beyond the fresh Live Head. No field is
defaulted or coerced, and no semantic field is loaded while another is ignored.

`PRODUCT_RECOVERY_SCHEMA_VERSION = 1`. The migration runner is explicit and pure: a current record
passes through, a newer one is `INCOMPATIBLE_SCHEMA`, an older one is admitted only through declared
steps (`RECOVERY_MIGRATIONS`, empty for v1) and refused as `NO_MIGRATION_PATH` otherwise; a step that
does not land on the version it declared is refused. The runner is proven with an injected chain.

---

## 11. Durable writes

One record is one value under one key, written in one `setItem`. Every load and write joins ONE
promise chain per store, and every record carries a monotonic `sequence` per owner: a write whose
sequence is not greater than the last committed one is `SUPERSEDED`, so an older async write that
resolves late can never overwrite a newer snapshot. Admission (`isCurrent`) is re-asked inside the
serialized section, so a write queued before a retirement commits nothing.

The writer subscribes to the ONE store, reads the persisted subset by name, and issues a write only
when that subset changed. A Live Head advance or a Live Focus transition changes nothing in it and
issues nothing; a true no-op act issues nothing. The very first write, at READY, is the recovery
LOCATOR (the active Session plus the viewpoint the store was constructed with), so a reader who
restarts before acting still resumes the same Session. Nothing blocks the store or the UI on a write.

---

## 12. Foreground catch-up after recovery

Unchanged T-12P driver semantics. The cursors are derived from the fresh snapshot (`committedAfterSp`
from `liveHead`, `liveFocusAfterSp` from `liveFocusAtSp`), never persisted; catch-up applies through the
frozen T-03 seams under the generation and identity gates. No background polling was added.

---

## 13. Validation

### Deterministic

| Suite | Proves |
| --- | --- |
| `recovery/__tests__/record-codec.test.ts` (R01–R16) | exact keys, no smuggled key, every semantic rejection, no partial decode, the by-name subset, the writer's equality rule |
| `recovery/__tests__/migrations.test.ts` (M01–M08) | current / newer / older, deterministic injected chain, a lying step, a cycle |
| `recovery/__tests__/store.test.ts` (S01–S14) | separate database name, namespaces, owner mismatch, corrupt / incompatible / unreadable, atomic write, sequence gate across processes, serialized chain, admission inside the chain, clear |
| `recovery/__tests__/writer.test.ts` (W01–W08) | locator at attach, no write on `LH`/`LF`, writes on effective acts, no-op silence, continuation above a resumed sequence, retirement, out-of-order completion, non-blocking |
| `integration/__tests__/recovery.test.ts` (S1-01–S1-14) | fresh path, resume with zero creates, server refusals, Session mismatch, READY never before the snapshot, corrupt / future / partial / unreadable records, signed-out non-exposure, A → B replacement, A → out → B → out → A, foreign owner, advance-on-act-only |
| `integration/__tests__/recovery-viewpoint.test.ts` (S2-01–S2-12) | server advanced while away, `FOLLOW_LIVE → fresh LH`, `PINNED(t) → t` with the disclosure at `t`, incoherent `t`, `IF_ref` restored without guessing, `MC` restored / refused unrepaired, `RH` restored and `BACK_ONE_STEP` truthful, malformed `RH` refused whole, Exact Return origin reset, cursors reset, stale writer retirement |
| `tests/t13-recovery-persistence-contract.test.mjs` | the static boundary in §2–§12, with planted-defect non-vacuity |

Existing T-07 / T-08 / T-12 / T-12P suites and contracts stay green; two T-12 delivery-fact guards were
re-anchored (§15).

### Native (iOS / Android)

See §16.

---

## 14. Explicit non-goals

No cross-Session Timeline, Analysis Replay, session browser / catalog, Bookmarks, Voice, Matching,
Family, new visual language, map redesign, auth redesign, hardware credential hardening, offline
authoritative world cache, background polling, new provider semantics, durable Exact Return origin, or
T-12 redesign. No Product sign-in gateway: the validation harness that establishes an identity on a
device remains validation tooling, unreachable from the Product route, and is not a login experience.

---

## 15. Re-anchors (recorded, not silent)

- **`tests/t12-integration-contract.test.mjs` §28.6** forbade any production use of `existingSessionId`
  ("the production path must never pass it"). That was a delivery fact about a T-13 that did not exist;
  the T-13 architecture names this exact seam as the resume path. The permanent claim now asserted is
  stronger: the seam is passed from exactly ONE place, only inside a `RESUME` decision, only as the
  validated record's own locator, never a literal, a fixture or a synthesised id. The one-bootstrap-
  function rule is kept and both branches are proven to carry the three authorities by name.
- **`tests/t12-integration-contract.test.mjs` §28.19–20** forbade the words `restore`, `rehydrate`,
  `recover`, `resume(` in the integration layer ("restart and recovery are T-13's"). The permanent claim
  now asserted is about mechanisms: the layer holds no codec, schema, storage adapter, namespace key or
  record, reaches T-13 only through its barrel, and still persists nothing through any storage API.
- **`tests/forward-safety-contract.test.mjs`** used `test:t13-recovery-persistence-contract` as its
  hypothetical future gate; that gate is now real, so the hypothetical moved on to
  `test:qan-sec-01-mobile-credential-security-contract` — the same re-anchor T-10, T-11 and T-12 each
  made, and it starts nothing.
- **`integration/__tests__/credential-freshness.test.ts`** now injects an in-memory recovery storage,
  the same kind of seam as its injected auth port; without one the runtime builds the real SQLite
  adapter, which fails closed under Jest (correct on a device, not what that suite proves).

Nothing in `apps/mobile/src/state/` changed. The T-12P layer gained one optional bootstrap override
(`initialViewpoint`), one failure kind (`VIEWPOINT_INCOHERENT`) and the viewpoint-coherence judgement;
its auth store, its storage census and its "persists authentication material only" invariant are
unchanged and still proven.

---

## 16. Native restart validation

Recorded in the final report and in the PR. The T-12 Phase-M infrastructure is reused: the
validation-only harness (`integration/__validation__/`) gains T-13 procedures, the cloud workflow
gains a recovery job per platform, and every phase is separated by a real process kill.

`T-13 native validation: see PR evidence`
