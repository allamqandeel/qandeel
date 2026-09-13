# Recovery / Persistence v1 — T-13

**Status:** CLOSED / FROZEN — reviewed, accepted and merged into `main` by PR #223 at
`5d9ba46efc6cf2d391096fcb3784bf2a5588ae15`. The banner above this line previously still read
`CANDIDATE — awaiting independent review`; it was reconciled by `QAN-GOV-03` under BG-09. That is a
historical lifecycle correction and nothing else: no recovery or persistence semantic, no ownership,
no security disposition, no acceptance criterion, no evidence claim and no anti-scope statement below
was reopened or rewritten.
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
- **`tests/t13-recovery-persistence-contract.test.mjs` §18** (this task's own gate) was re-anchored
  after the first cloud run: the sequencer literal it pinned (`outcome[$name]="blocked"`) named a bash-4
  associative array that macOS `/bin/bash` 3.2 rejects. The permanent claims now asserted are stronger:
  the sequencer needs nothing beyond bash 3.2 and reads every outcome back from the results file; the
  gate declares all fourteen phases itself and cannot pass an empty or truncated results file; no flow
  uses Maestro's `hideKeyboard`; every flow that types retries the field until the harness's character
  count matches the count the sequencer passes; the harness renders the report before the inputs.
- **T-12 Maestro flows `t12-04-phase-1`, `-3`, `-6`** replaced `hideKeyboard` with a tap on the harness
  heading. Maestro's iOS fallback for `hideKeyboard` swipes at the centre of the screen; the two T-13
  inputs moved the Moment field under that point, so the heuristic raised a number pad it could not
  dismiss. The heading tap is the `ScrollView`'s own outside-tap blur, on both platforms. Nothing else in
  those flows changed, and the T-12 AUTH and PRODUCT jobs were re-run on the same dispatch as proof (§16).
- **Workflow iOS harness boot steps** (`t12-phase-m-cloud-validation.yml`, the three jobs that type into
  the harness) declare the simulator's one-time "slide to type" keyboard introduction shown before the
  app is installed: on a fresh simulator it swallowed every typed key after the first.
- **`integration/__validation__/auth-storage-validation.ts` `settled()`** treated only `RESTORING` and
  `BOOTSTRAPPING` as transient. T-13 publishes `RECOVERING` between them, so the T12-04 procedure could
  sample the runtime while the recovery store was still being read: the second cloud run did exactly
  that on the iOS simulator (`T12-04.1b` reported `phase=RECOVERING`) while Android passed on timing
  alone. `RECOVERING` is transient there now, as it already was in the T-13 procedures. A validation
  procedure's omission, not a Product one: `ProductRoot` renders every non-`READY` phase as a runtime
  state and never sampled anything.
- **`scripts/phase-m/run-t13-recovery-phases.sh`** now waits for the device after every interruption
  (`adb get-state` = `device` and `sys.boot_completed` = 1 on Android, `simctl bootstatus -b` on iOS)
  instead of sleeping three seconds: the fifth cloud run met an emulator whose adb transport was still
  `offline` after the force-stop, and the next flow died at `launchApp` before any claim. Phase 9 also
  requires phase 7, so when the chain before it broke it is recorded as `blocked`, never as the failure
  of a `PINNED(5)` claim that phase 5 never established.
- **`scripts/phase-m/run-t13-recovery-phases.sh`** (Android) keeps the emulator's crash / ANR dialogs
  hidden (`settings put global hide_error_dialogs 1`) for the whole sequence and again after the reboot,
  and waits for the boot animation to stop plus fifteen seconds before the next flow: the sixth cloud
  run lost phases 9 and 10 to a "System UI isn't responding" dialog that sat over the app after
  `adb reboot`, with the harness underneath it and no claim made. The boot-animation wait that came
  with it is bounded at sixty seconds: the seventh run showed that a headless emulator need not ever
  report the service `stopped`, and an unbounded wait turned that into an eighty-minute hang.

Nothing in `apps/mobile/src/state/` changed. The T-12P layer gained one optional bootstrap override
(`initialViewpoint`), one failure kind (`VIEWPOINT_INCOHERENT`) and the viewpoint-coherence judgement;
its auth store, its storage census and its "persists authentication material only" invariant are
unchanged and still proven.

---

## 16. Native restart validation

Evidence class: the functional recovery contract on a Release build against the real API and the real
Supabase auth authority, on the iOS simulator (iPhone 17 / iOS 26.5, Xcode 26.6) and the Android
emulator (API 36, x86_64). Never a physical, tactile, backup or Data Protection claim. The T-12 Phase-M
infrastructure is reused: the validation-only harness (`integration/__validation__/`) gains the T-13
procedures, the cloud workflow gains one recovery job per platform, and every artifact carries an
identity record that pins the checkpoint SHA it was built from.

### The proof

One sequencer (`scripts/phase-m/run-t13-recovery-phases.sh`) runs fourteen phases against ONE
installation of the validation build, with a real interruption between them performed outside any
flow: `xcrun simctl terminate` / `adb shell am force-stop`, a home-and-reopen (`pressKey: Home`), and a
simulator shutdown-and-boot / `adb reboot`. The gate (`gate-t13-recovery-phases.sh`) declares all
fourteen phases itself, records a phase the sequencer never reached as `missing`, reports phase 8 (the
restart itself) without gating it, and gates phase 9 (recovery after the restart) whenever phase 8
succeeded — which it did on every run of both platforms. A phase is `success` only when its flow's
every assertion held; `blocked` and `skipped` are never success; the T-13 static contract holds the
gate's list to the sequencer's phases.

| phase | what it proves |
| --- | --- |
| 01 `fresh-signin` | clean install; identity A signs in; READY through `FRESH`; the locator is committed (`T13-B`) |
| 02 `kill-resume` | after a process kill: `RESUMED`, `FOLLOW_LIVE`, no Exact Return origin (`T13-A`) |
| 03 `adopt-session` | a server-populated Session is adopted through the production store and codec (`T13-D`) |
| 04 `kill-adopted-follow-live` | the adopted Session resumes with a fresh Live Head from the server |
| 05 `pin-moment` | `COMMIT_MOMENT(5)` on the READY store; the durable snapshot advances (`T13-P`) |
| 06 `kill-pinned` | `PINNED(5)` survives a kill — exactly 5 |
| 07 `close-reopen` | `PINNED(5)` survives a normal close and reopen |
| 08 `device-restart` | the environment restarts (reported, not gated) |
| 09 `after-device-restart` | `PINNED(5)` and the same Session survive the device restart |
| 10 `sign-out` | sign-out retires the runtime (`T13-O`) |
| 11 `signed-out-launch` | a signed-out launch exposes nothing: `auth=SIGNED_OUT phase=SIGNED_OUT` (`T13-S`) |
| 12 `replacement` | B reaches READY `FRESH` in B's own namespace, B signs out, A resumes A's own `PINNED(5)` record (`T13-R`) |
| 13 `adopt-foreign` | a Session that is NOT A's is adopted through the store |
| 14 `refused` | the next launch fails closed: `RECOVERY_FAILED` / `SESSION_INVALID`, no replacement Session, no world (`T13-F`) |

### Runs

Workflow `t12-phase-m-cloud-validation.yml`, branch `feat/t13-recovery-persistence-v1`, the local API
served through a Cloudflare Quick Tunnel from the validating host, the seeded Session owned by
identity A (Live Head 13), moment 5. Every run is listed; none is hidden.

| run | commit | T-13 Android | T-13 iOS | other jobs | what it established |
| --- | --- | --- | --- | --- | --- |
| 34652975615 | `cce4787f` | FAIL — phases 01 and 09 failed, the rest blocked | job green on an EMPTY results file | — | the four infrastructure defects of §15 (bash 3.2, off-screen report, `hideKeyboard`, the keyboard introduction) and a gate that could pass vacuously; the run also produced Maestro's own failure screenshot with the identity field still filled, which is why the harness now clears credential fields as a run starts (that artifact should be deleted or left to expire) |
| 34657321018 | `aa0ca685` | 14/14 PASS, gate PASS | 14/14 PASS, gate PASS | Android AUTH PASS, Android PRODUCT PASS, iOS PRODUCT PASS; iOS AUTH and iOS RESPONSIVE FAIL at `T12-04.1b` (`phase=RECOVERING` sampled) | the recovery contract holds on both platforms; the T-12 procedure's wait needed `RECOVERING` (§15) |
| 34659986008 | `d136590` | phase 01 FAIL `BOOTSTRAP_FAILED failure=SESSION_ACQUISITION` | same | Android AUTH PASS (it had finished first) | environmental: the API tunnel on the validating host ended with its session mid-run; nothing in the tree changed but the T-12 procedure |
| 34674638527 | `d136590`, full workflow | 14/14 PASS, gate PASS | 01–03 PASS; 04 FAIL `RECOVERY_FAILED failure=SESSION_INVALID/SNAPSHOT` at 05:30:41Z | Android AUTH PASS, Android PRODUCT PASS, iOS PRODUCT PASS, iOS RESPONSIVE PASS; iOS AUTH phases 1–3 PASS, phase 4 FAIL `sign-in refused: UNEXPECTED` at 05:30:19Z | two independent iOS jobs failed within thirty seconds on two paths that share one dependency — the app signs in against Supabase Auth, and the API validates every bearer against `/auth/v1/user` with a five-second timeout — an external transient, so the affected jobs were re-run |
| 34677724416 | `d136590`, auth + recovery | 01 PASS; 02 FAIL at `launchApp`: `host:transport:emulator-5554: device offline` (no claim was made); 03–07 blocked; 08 PASS; 09 FAIL asserting a `PINNED(5)` that phase 05 never established | cancelled after 28 minutes inside the sequence step (the run was already failed by the Android gate; the step's output was not flushed) | Android AUTH PASS; iOS AUTH PASS, phases 1–7 and its gate | the emulator's adb transport was still down seconds after the force-stop: the sequencer now observes the device back after every interruption, and phase 9 also requires phase 7 so a broken chain records it as `blocked` (§15) |
| 34680242364 | `cef5d29e`, recovery only | 01–08 PASS; 09 and 10 FAIL with the harness never visible: the screen hierarchy at both steps is Android's own "System UI isn't responding" dialog over the freshly launched app; 11–14 blocked | **14/14 PASS, gate PASS** | — | the emulator's System UI stalls after `adb reboot` on a loaded runner: error dialogs are now kept hidden for the whole sequence and System UI is given time to settle after the reboot (§15) |
| 34682302709 | `95d8ff84`, recovery only | hung inside the sequence after the reboot for over eighty minutes — the wait for the boot-animation service to report `stopped` had no bound — and was cancelled | **14/14 PASS, gate PASS** | — | the wait is bounded at sixty seconds; `sys.boot_completed` stays the readiness criterion (§15) |
| 34685898388 | `8b3a00db`, recovery only | **14/14 PASS, gate PASS** | 01–04 PASS; 05 FAIL `RECOVERY_FAILED failure=SESSION_INVALID/SNAPSHOT` at 09:50Z (the temporal snapshot read failed on that launch); 06–14 blocked | — | the same transient as run 34674638527, iOS only, on a launch that had just succeeded on the launch before; the report now prints the bootstrap failure's own detail so the next occurrence names its cause |
| 34687258684 | `1803d5e4`, recovery only | phase 01 FAIL before the app was launched: Maestro's transport to the emulator died seventeen seconds into the session, `host:transport:emulator-5554: device offline`, at the first `launchApp`; 02–14 blocked; nothing of the Product ran | **14/14 PASS, gate PASS** | — | the same adb-transport class as run 34677724416's phase 02 and as this branch's Mobile CI Android boot smoke (which failed the same way on two pushes and passed on re-run); by instruction, the final run — no further run was launched |

### Result

Both native gates passed on the delivered implementation, on separate runs of the same, unchanged
Product code:

| platform | run | commit | phases | gate |
| --- | --- | --- | --- | --- |
| Android API 36 emulator (x86_64, google_apis, Release APK) | 34685898388 | `8b3a00db` | 14/14 `success` | PASS |
| iOS iPhone 17 / iOS 26.5 simulator (Xcode 26.6, Release) | 34687258684 | `1803d5e4` | 14/14 `success` | PASS |

Earlier full passes of the same fourteen phases: iOS on `95d8ff84` (run 34682302709), `cef5d29e`
(34680242364) and `aa0ca685` (34657321018); Android on `cef5d29e` (34680242364), `d136590`
(34674638527) and `aa0ca685` (34657321018). Every pass above includes the device / simulator restart
(phase 8 `success`) and recovery after it (phase 9 `success`).

Why two runs are one proof: the Product implementation has not changed since `aa0ca685`. Every commit
after it touches only `integration/__validation__/`, `scripts/phase-m/` and `docs/` — four files in
all (`git diff --stat aa0ca685..1803d5e4`) — none of which the Product import closure reaches: the
T-12 static contract proves that closure contains no reference to `__validation__`, and the sequencer
and workflow run outside the app. Between the Android pass (`8b3a00db`) and the iOS pass (`1803d5e4`)
exactly one file changed, `recovery-validation.ts`, and only in what the validation report prints.
The Android failure of run 34687258684 happened before the app was launched and says nothing about
the implementation. Nothing is treated as passed that did not pass: every `blocked`, `failure` and
cancelled outcome above is listed as such, and the gate that decides a job declares all fourteen
phases itself.

Observed and left as it is, deliberately: on iOS only, a launch that had just succeeded on the launch
before twice failed its bootstrap with `SESSION_INVALID/SNAPSHOT` (runs 34674638527 and 34685898388),
never on Android. The Product fails closed exactly as T-12P's bootstrap always did on a snapshot it
cannot read — no Session is synthesised, nothing is READY — so this is not a T-13 defect and no
Product semantics were changed; the validation report now prints the transport's own detail so the
next occurrence names its cause. Whether the bootstrap should retry a transient transport failure is
a T-12P design question, recorded for the backlog, not answered here.

### Evidence

Artifacts `t13-recovery-android-emulator` and `t13-recovery-ios-simulator` of each run: the identity
record (checkpoint SHA, build configuration, simulator / emulator identity), `t13-phase-results.txt`
(the record the gate reads), `COMPLETENESS.txt`, `REDACTION.txt` (every supplied value redacted from the
text evidence), and per phase the Maestro command log, screen hierarchies and screenshots. The
screenshots carry kinds, modes, counts and the Session locator — never a credential (the harness prints
counts; the flows erase the identity field before their own screenshot; the harness clears every
credential field as a run starts).
