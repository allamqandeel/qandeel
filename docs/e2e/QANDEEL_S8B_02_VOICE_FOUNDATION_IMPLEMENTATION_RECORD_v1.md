# QANDEEL — S8B-02 Voice Foundation — Implementation Record v1

> **POST-MERGE RECONCILIATION — 2026-10-31 (supersedes the pre-merge CP2 status snapshots below; status only, no new task authority):** **S8B-02 Voice Foundation is CLOSED / MERGED** through [PR #368](https://github.com/allamqandeel/qandeel/pull/368) at `004f97270357a5efac3d21b9742c639ab8ede04a` (2026-10-31 Egypt local time). CP1 was merged through PR #367 at `f0d8ed1a`. API CI and Mobile CI passed on CP2 head `b5c23ccf`, including the live PostgREST / rclone `prove-0185` gate; rclone is **not** hosted-production proof. Migrations `0183` / `0184` / `0185` are **not hosted**. All four voice launch gates remain `DISABLED`; there is no user-ready voice, no provider adapter, no client voice surface and no paid production run. `QAN-BL-VOICE-01` stays worked but not delivered, the backlog stays at 89 items. **NEXT (not started or authorized): S8B-03**; then S8B-04 … S8B-08. S8A-06 … S8A-08 and Stage 9 remain unstarted. The earlier CP2 text is retained as its pre-merge historical snapshot.


**Task:** S8B-02 — Voice Foundation (Stage 8B). This record covers **CP1 — the database and governance foundation**
(§1 – §10) and **CP2 — the secure media lifecycle, S8B-02's closing change** (§11).
**Status:** `S8B-02 CLOSING CHANGE (CP2) DELIVERED AS A LOCAL COMMIT ON s8b/s8b-02-cp2 (2026-10-30; §11) — NOT PUSHED, NO PULL REQUEST — CP1 MERGED THROUGH PR #367 AS f0d8ed1a (2026-10-30) — ENGINEERING CLOSURE PENDING THE LIVE PostgREST / rclone PROOF (prove-0185) IN CI AND THE PRODUCT OWNER'S MERGE DECISION — S8B-02 NOT DECLARED COMPLETE, NOT MERGED — NOT USER-READY (VOICE FOR USERS NEEDS S8B-03 … S8B-08) — MIGRATIONS 0183 / 0184 / 0185 NOT HOSTED — EVERY VOICE GATE CLOSED`
*(As written at CP1 R1:)* `S8B-02 CP1 DELIVERED ON s8b/s8b-02-cp1, PUSHED, DRAFT PR #367 (2026-10-30) — R1: THE PRODUCT OWNER'S REVIEW CORRECTIONS APPLIED ON THE SAME BRANCH (2026-10-30; §10) — NOT MERGED — S8B-02 NOT COMPLETE (CP2 NOT STARTED, NOT AUTHORIZED) — MIGRATIONS 0183 / 0184 NOT HOSTED — EVERY VOICE GATE CLOSED`
**Date:** 2026-10-30
**Branch / base:** `s8b/s8b-02-cp1`, from `main` at `c65b878c50ffc519c838b86c08b53298f8a88ff7`, the merge of PR #366
(S8B-01 CP3, S8B-01's closing change, merged 2026-10-30).
**Authority:** the Product Owner's *S8B-02 WP0 approval* and *CP1 implementation authorization* (both 2026-10-30), and the
S8B-02 Implementation Task Contract v1.0 FINAL that the WP0 approval closed. The contract was delivered to the Product
Owner outside the repository; its binding decisions are recorded here so that they live in the repository (§1).

Pushing, opening a pull request, merging, starting CP2, opening any voice gate, any paid API call, any real user data and
any hosted resource each need the Product Owner's explicit approval. None of them is done here.

---

## 1. The Product Owner's decisions (2026-10-30), recorded as binding

### 1.1 WP0 decisions D-1 … D-8 (approved, with the Product Owner's corrections)

| # | Decision | As approved |
|---|---|---|
| D-1 | Gemini speech units | Gemini speech is billed in tokens: `INPUT_TOKEN` + `AUDIO_OUTPUT_TOKEN`. `SYNTHESIS_CHARACTERS` and `AUDIO_OUTPUT_MS` (VA-5 as first drafted) are not added. |
| D-2 | Speechmatics accounting | A gateway measurement of streamed audio is `GATEWAY_MEASURED`: kept distinguishable, **never evidence that the provider billed the same duration and never presented as provider-confirmed usage**. Every settled call carries its usage source; every reader, aggregate and telemetry label keeps the two apart. One ledger. Reconciliation with the provider is S8B-08's. |
| D-3 | Audio anchors | Anchors are **turn-level**: the turn's anchor is inherited by every unit of the turn (VA-3 tightened). |
| D-4 | Gaps | Gaps are recording data, held by the recording authority. |
| D-5 | Segments | Proof of order, gaps and interruption is required. **No loss-bound claim** is made. |
| D-6 | Retention anchor | A Voice Note's retention runs from `accepted_at`; a call recording's from `started_at` (S8B-01 D-D2). Both + 30 days, written once. |
| D-7 | Readers | A `LOW` band writes no Memory; `HIGH` / `MEDIUM` write `MACHINE_ASR`, never the typed-text 0.98 / 0.95. Voice units are excluded from the S8A-05 direct text path to the Public World. **D-7 does not cancel the Replay publishing of calls** — that path is untouched and waits for its owner, S8B-07. |
| D-8 | Hosted proof | No new backlog item: a dated note on `QAN-BL-PROD-08` at S8B-02's closure (CP2). No hosted claim is made by S8B-02. |

### 1.2 PRIV-W — consent withdrawal (added by the Product Owner)

- A user may withdraw recording consent at any time.
- After withdrawal, no new recording act is admitted: begin, accept, open, add segment, store segment.
- A seal of an open call recording still succeeds, so a recording is never left half-open.
- Existing recordings are unchanged by withdrawal; they keep their expiry and stay deletable by their owner.
- Withdrawal is never a deletion reason.
- **CP2 B5 (added by the CP1 authorization):** withdrawal racing an upload or a segment store is proven in CP2, against the
  object store. CP1 proves the database authority and the ordering of the consent and recording transactions.

### 1.3 P-1 — Memory confidence of a `MACHINE_ASR` turn — APPROVED

| Band | Value |
|---|---|
| `HIGH` | `0.90` |
| `MEDIUM` | `0.75` |
| `LOW` | `SKIP` (no durable Memory) |

- These are **controlled configuration values, not accuracy claims.**
- `MACHINE_ASR` stays the Memory's source. There is no automatic 0.98 / 0.95 for a voice turn.
- The text Memory path and every correction mechanism are unchanged.
- Where they live (as corrected by R1, §10.3): `MACHINE_ASR_MEMORY_CONFIDENCE_HIGH` / `_MEDIUM` in the API's environment,
  tuned without a code change. The approved values are the defaults (`MACHINE_ASR_MEMORY_CONFIDENCE_DEFAULTS` in
  `apps/api/src/memory/memory-write-evaluator.service.ts`). Each must be above 0 and below 0.95, and MEDIUM never above
  HIGH; any other value stops the API from starting. The database refuses any `MACHINE_ASR` confidence of 0.95 or more.

---

## 2. BG-05 at kickoff

Read in full: `docs/qandeel-canonical-backlog-v1.md`.

- **No item is owned by "S8B-02".**
- `QAN-BL-VOICE-01` (`Stage 8B — Voice Runtime`, `HIGH`, `DEFERRED — OWNED`) is **worked, not delivered.** It stays
  open and owned by Stage 8B.
- **Read and left as they stand:**

  | Item | Owner | State |
  |---|---|---|
  | `QAN-BL-PROD-06` / `08` / `09` / `10` | `HOSTED-DEPLOY-01` | `DEFERRED — OWNED` |
  | `QAN-BL-ACCT-01` | `ACCT-DEL-02` | `DEFERRED — OWNED` |
  | `QAN-BL-ACCT-03` | Stage 9 (Replay distribution) | `DEFERRED — OWNED` |
  | `QAN-BL-PRIV-05` | `PRIV-EXPORT-01` | `DEFERRED — OWNED` |
  | `QAN-BL-AI-01` / `AI-05` | Stage 8A | `DEFERRED — OWNED` |
  | `QAN-BL-AI-03` | Stage 9 | `DEFERRED — OWNED` |
  | `QAN-BL-ACE-02` | Stage 8A | `VALIDATION — OPEN` |
  | `QAN-BL-LAUNCH-01` | `LAUNCH-EDGE-SECURITY-GATE` | `DEFERRED — OWNED` |
  | `QAN-BL-NOTIF-03` / `05` | their owners | `DEFERRED — OWNED` |
  | `QAN-BL-CI-01` / `02` / `03` | their owners | `DEFERRED — OWNED` / `VALIDATION — OPEN` |

- No finding of S8B-01's review was moved here in violation of BG-01. No `OPEN — UNASSIGNED` item is claimed.
- **CP1 admits and tombstones nothing.** No real unowned gap was found (§8).
- S8B-01 is recorded as **closed and merged through PR #366 as `c65b878c`** (2026-10-30).

---

## 3. What CP1 delivers

| Kind | Files |
|---|---|
| Migrations | `database/migrations/0183_s8b_02_voice_foundation_v1.sql`; `database/migrations/0184_s8b_02_ai_cost_voice_units_v1.sql` |
| Substitution ledger | `database/voice-foundation-0183-substitutions.mjs` — each of the ten statements 0183 re-creates, as its origin statement plus exact declared edits |
| New verifiers | `database/verify-migration-0183.mjs` (S0, A1 – A11, A8r); `database/verify-migration-0184.mjs` (A12); `database/voice-cost-families-0184.mjs` (the shared probe and family list) |
| Re-anchored verifiers | `verify-migration-0135`, `-0150`, `-0152`, `-0153`, `-0166`, `-0168`, `-0169`, `-0170`, `-0171`, `-0174`, `-0175`, `-0176`, `-0181`, `-0182` — each a dated `RE-ANCHORED by S8B-02 CP1` note, conditional on 0183 / 0184 being applied, so every verifier still passes on its own migration's database |
| TypeScript | `conversation-unit.types.ts` (the modality union); `ai-usage.types.ts` (the voice ledger vocabulary, beside the unchanged text registries); `telemetry.service.ts` (`recordAiVoiceProviderCallSettlement`); `memory.types.ts` (`MACHINE_ASR`); `memory-write-evaluator.service.ts` (P-1); `background-intelligence-data-api.service.ts` and `-enrichment.service.ts` (the provenance read and the band); the A2 smoke adapter |
| API specs | new `s8b-02-voice-memory-capture.spec.ts`, `s8b-02-voice-usage-telemetry.spec.ts`; two mocks given the typed-turn default |
| Contract tests | new `tests/s8b-02-voice-foundation-contract.test.mjs`; re-anchored `acct-del-01-…`, `prod-retry-01-…`, `thread-establishment-evaluator-…`, `canonical-home-placement-engine-…` and the four current-task pins |
| CI | `package.json`: `verify:voice-foundation:integration`, `verify:voice-ai-cost:integration`, `test:s8b-02-voice-foundation-contract`; `api-ci.yml`: the three steps |
| Governance | this record; the amendment §4; contract notes (§6.2, §6.3, §7, §10, §12); the three locators; the backlog (§9 rows) |

No API endpoint, worker, store adapter, provider adapter, mobile code or user-visible string is added. No gate is opened.

---

## 4. The design as built (contract §3), against the acceptance rows

### 4.1 Migration 0183 — Voice Foundation

**VA-3, the voice source of a turn (A3).**
- `public.conversation_turn_voice_sources`: one row per turn, written once by `server_attach_turn_voice_source_v1`, and
  only before the turn has units. Immutable.
- `USER`: `transcript_origin = 'MACHINE_ASR'` and a band (`HIGH` / `MEDIUM` / `LOW`) are required; `ASSISTANT`:
  `LIVE_CALL_SPEECH`, `spoken = true` and a delivery state (`COMPLETE` / `INTERRUPTED` / `WITHHELD_TAIL`).
- The anchor is the turn's (D-3): the recording plus `[start_ms, end_ms)` on its clock. It never holds a key or URL.
- `conversation_units_source_modality_check` admits `TEXT`, `VOICE_NOTE`, `LIVE_CALL_SPEECH`. The live producer copies
  the modality from the turn's voice source; a turn with none commits `TEXT`, so every text row is unchanged (A1).
- A guard refuses any unit whose modality is not its turn's. The ungranted legacy producers (0064 … 0070) therefore
  cannot commit a voice turn.
- `channel = 'VOICE'` stays refused (A2): 0183 does not touch the session channel CHECK.

**D-7 readers (A4).**
- Memory: the background writer `background_record_memory_v1` reads the turn's band itself. `LOW` answers
  `LOW_CONFIDENCE_MACHINE_ASR` and writes nothing; `HIGH` / `MEDIUM` record `source = 'MACHINE_ASR'` and refuse a
  confidence of 0.95 or more. `memories_source_check` and the shape guard admit `MACHINE_ASR`.
- Public World: the S8A-05 picker, package and publish-from-QANDEEL exclude voice-sourced units.
- Export: voice turns carry `transcriptOrigin: MACHINE_ASR`, their modality and band; retained recordings are listed as
  metadata, never a key.

**VA-8 R-1 and the Replay boundary (A5).**
- A Personal Replay item's medium is its unit's: `ORIGINAL_AUDIO` for a voice unit, never `ORIGINAL_TEXT`.
- Moments return no transcript for a non-text item. A whole-item selection succeeds; a sub-range of an audio item is
  refused.
- Render, preview and distribution are not touched: the existing `ORIGINAL_TEXT_ONLY` law already refuses an
  audio-bearing Replay. That is the waiting state of S8B-07's R-2, not a cancellation (D-7, I-4).
- `0104` and the I-06C distribution functions are unchanged (static check and catalogue check).

**The recording authority (A6, A7; D-4, D-5, D-6).**
- Schema `voice_private`, closed to every role: `recordings`, `recording_objects`, `recording_gaps`.
- `retention_expires_at` = `accepted_at` + 30 days (note) or `started_at` + 30 days (call), by a NULL-safe CHECK; a call
  recording cannot exist without an expiry. A note's `accepted_at` / expiry change once, from `NULL`. Every other
  change is refused for every role, the owner included.
- Segments: index order, a continuous clock unless a gap row explains the discontinuity, and store-after-add are
  enforced. Gaps are `RECONNECTION`, `MUTED` or `WRITER_LOSS`. Recovery seals with `RECOVERY`, discards pending segments
  as `WRITER_LOSS` gaps, and leaves the expiry byte-equal. No loss bound is claimed (D-5).
- A read is refused from the expiry instant with no worker; the sweep marks `EXPIRED` and queues the keys.
- *(R1, §10.2.)* No segment, store or gap is admitted at or after the expiry. A call recording still `RECORDING` at its
  expiry is sealed `RECOVERY` by the sweep, then expired, with every key queued; the call itself stays S8B-05's.

**Consent with withdrawal (A8, PRIV-W).** Versioned consent texts (none installed: every act is refused until S8B-03
installs a Copy-Gated version); grant, withdraw and state definers; the five recording acts refused without a current
grant; seal, read and owner deletion never consult consent. Two-connection races prove the ordering of a withdrawal
against a begin / open (A8r). *(R1, §10.1.)* A replayed begin or add of an unfinished request is refused after a
withdrawal and never hands its key back; a completed accept or store still replays its result.

**The capability gate (A9).** `PERSONAL_VOICE_NOTE`, `PERSONAL_LIVE_CALL`, `SHARED_VOICE_NOTE`,
`REPLAY_AUDIO_DISTRIBUTION`, all seeded `DISABLED` / `UNSATISFIED` with an append-only event history. Begin and open
consult it; read, delete, export, expiry and erasure never do. Its setter is in `voice_private` and executable by no
role.

**Isolation (A10).** Every relation has RLS on and zero policies; nothing is granted to `anon` / `authenticated`; the 23
`server_*` definers are `service_role`'s alone, and each takes the owner and checks it.

**Erasure (A11).** The voice module runs inside the 0169 erasure subtransaction, before 0130. It queues every voice key
into the 0162 queue and `media_pending`, and leaves no voice row. An injected failure rolls everything back. Coverage
`VOICE` is registered.

**Deploy guard.** G1 – G5 check, where 0183 is installed: the four scopes closed, the consent catalogue empty, the voice
relations registered, the key CHECKs, and the function ACLs.

### 4.2 Migration 0184 — AI-COST-01 / VA-5 as amended (A12; D-1, D-2)

- `SPEECHMATICS` with `SPEECHMATICS_REALTIME_TRANSCRIPTION` / `SPEECHMATICS_BATCH_TRANSCRIPTION`; the route-neutral
  `GEMINI_SPEECH_GENERATION` under `GEMINI`.
- Kinds `AUDIO_INPUT_MS`, `AUDIO_OUTPUT_TOKEN`. The partition v2 is keyed by (provider, operation): Speechmatics
  `[AUDIO_INPUT_MS]`, Gemini speech `[AUDIO_OUTPUT_TOKEN, INPUT_TOKEN]`, **every existing pair exactly its v1
  partition**. A usage row outside its call's v2 partition is refused, whichever settlement writes it.
- Families `VOICE_NOTE_TRANSCRIPTION`, `LIVE_CALL_TRANSCRIPTION`, `SPEECH_SYNTHESIS`, `SPEECH_RENDERING`.
- `usage_source` (`PROVIDER_REPORTED` default; `GATEWAY_MEASURED` only for the two Speechmatics operations), set by
  `settle_ai_provider_call_v2` and immutable after settlement. A gateway-measured digest differs from a provider report
  of the same quantity.
- `begin_ai_provider_call_v3`: one row per provider session (a reconnect is a new row), bound to the payer's own
  recording in the named session.
- `server_read_ai_usage_operations_summary_v2` (the transcription stale bound is the controlled maximum session length;
  counts gateway-measured calls apart) and `server_read_ai_cost_aggregates_v2` (the usage source as its own dimension).
- **Not here:** no Price Card (every voice call rates `UNPRICED`), no Credit change, no DeepSeek or text change. Begin v1
  / v2, settle v1, the v1 reads, the v1 partition and the rater are byte-identical (A12 proves it against the migration
  that last defined each).

### 4.3 TypeScript

- **The modality union** is `ConversationUnitSourceModality` (`TEXT` / `VOICE_NOTE` / `LIVE_CALL_SPEECH`). The commitment
  gate stays channel-based: the API still refuses `UNSUPPORTED_SOURCE_MODALITY` for a non-text proposal.
- **The voice ledger vocabulary** is its own section of `ai-usage.types.ts`: providers → operations, kinds, families,
  usage sources, complete partitions. The `AI_LEDGER_*` unions equal the 0184 CHECKs (the static contract compares
  them). The text registries keep exactly their values, so no text caller can name a voice operation.
- **Telemetry.** `recordAiVoiceProviderCallSettlement` always labels `usage_source`, counts `AUDIO_INPUT_MS` on its own
  millisecond counter (`qandeel.ai_usage.audio_input`), emits only the operation's own partition, and drops
  `GATEWAY_MEASURED` outside transcription. The text method's labels are unchanged and it never accepts a voice
  family.
- **The Memory path.** When the typed grammar would keep a fact, the background capture reads the source turn's
  provenance through `rpc/server_read_turn_voice_provenance_v1` (content-free). A typed turn has none and is unchanged.
  `LOW` → `SKIP LOW_CONFIDENCE_MACHINE_ASR`; `HIGH` / `MEDIUM` → the same candidate with `source = 'MACHINE_ASR'` and
  the P-1 confidence. A `MACHINE_ASR` Memory completes the effect `NO_FRESH_EVIDENCE` (§7, deviation 6).

---

## 5. Verification (local, 2026-10-30)

All database runs used a local loopback PostgreSQL 17 cluster, never the hosted project and never the main checkout's
`.env`. No paid API was called; no real user data was used.

| Check | Result |
|---|---|
| `verify-migration-0183` (S0a – S0d, A1 – A11, A11b, A11c, A8r) on a fresh 0184 clone | **19 / 19 scenarios PASS**, run twice on the same database (no residue) |
| `verify-migration-0184` (A12) on a fresh 0184 clone | **PASS** |
| Every `npm run verify:*` step of `api-ci.yml` up to the dispatch smoke, on a fresh 0184 database | **see §5.1** |
| A1 golden text fingerprint (recorded on 0182 with `VERIFY_0183_GOLDEN=print`) | **equal on 0184** |
| API typecheck (`tsconfig.json`, `tsconfig.scripts.json`) | **clean** |
| API jest, static contracts, `test:database` | **see §5.1** |

**Not run, and why.**
- CI on GitHub: nothing is pushed (the authorization forbids it). CI stays authoritative, for forward-safety in
  particular (`QAN-BL-CI-02`).
- The ten baseline verifier failures above fail identically on 0182 in this local environment; they are not caused by
  S8B-02, and are not claimed as passes.
- The hosted database: 0183 / 0184 are not hosted, and no hosted claim is made (D-8).
- Any object-store, upload or race-against-storage proof: CP2 (B1 – B10, including B5).

### 5.1 Final local runs

Run on the final tree, on a database freshly migrated from the clean 0182 database through `0183` and `0184`:

| Check | Result |
|---|---|
| `verify-migration-0183` | **19 / 19 PASS** (20 / 20 after R1, §10.5) |
| `verify-migration-0184` | **PASS** |
| Every `npm run verify:*` step of `api-ci.yml` (the full sweep) | **176 PASS, 11 FAIL.** Ten fail identically on the clean 0182 database in this environment (175 PASS, 10 FAIL there) and are not caused by S8B-02; the eleventh was S8B-02's and is fixed: <ul><li>the HBS / HGS / HRS report-window and HIM bridge verifiers (7): the server-authoritative report-time clock;</li><li>`supabase-default-privilege-drift`: `psql` is not installed;</li><li>`runtime-event-publisher-startup-recovery`: the Redis publisher;</li><li>`personal-privacy-export-account-deletion` (0130): the PostgreSQL clock runs about 3 ms ahead of Node, so the 7-day grace computes as 7.00000003 days against `<= 7`;</li><li>`him-measurement-preflight` (S8B-02): its `test:database` step flagged the finding below. Fixed; each of its steps then passed when rerun (`him-structured-measurement-preflight` 6 / 6, `test:database`, both `tsc`, `build:api`; its jest run is the row below).</li></ul> |
| `test:database` (the verifier hazard scanner and its fixtures) | **1310 / 1310 PASS**, after one fix: the scanner's H2 rule flagged the `rejected()` wrapper in `verify-migration-0183`. That wrapper calls the savepoint-holding shared helper and only re-throws, so it was written as a re-throw without `try` / `catch` |
| API jest (inside the preflight) | **299 / 299 suites, 7062 PASS, 1 skipped** |
| API `tsc` (`tsconfig.json`, `tsconfig.scripts.json`) and `build:api` | **clean** |
| Every `npm run test:*` step of `api-ci.yml` and `mobile-ci.yml` (116 steps) | **115 PASS, 1 FAIL.** `test:mobile` fails with jest's `clearMocksOnScope is not a function`, a module-mocker version mismatch in this local install. No mobile file differs from `c65b878c`. Every contract S8B-02 touches passes, including `test:forward-safety-contract`, `test:task-closure-governance-contract`, `test:s8b-02-voice-foundation-contract` and the four current-task pins |

---

## 6. Proof that text and Replay are unchanged

- **Text.** A fixed text exchange is committed through the FINAL coordinator on 0182 and on 0184. Its batch
  fingerprint, unit rows and outcomes are equal (A1, golden `4fa20b86…`). Every text verifier passes; the only edits are
  the declared, conditional re-anchors (§3). The TypeScript text registries, the text telemetry labels, the typed Memory
  values (0.98 / 0.95) and the commitment gate are unchanged, and the static contract pins them.
- **Replay.** Text Replays are byte-identical: a text unit's medium is still `ORIGINAL_TEXT`, its moments still print
  its text, and its sub-range selection still succeeds (A5). `0104` and the I-06C distribution functions are not
  re-created (static check and catalogue check). The audio path is not cancelled: render, preview and distribution of
  an audio-bearing Replay are refused by the existing `ORIGINAL_TEXT_ONLY` law until S8B-07.

## 6.1 Proof that the gates are closed

- All four scopes are `DISABLED` / `UNSATISFIED` (S0c; deploy guard G1; static contract).
- No consent text is installed, so every recording act is refused even before the gate is consulted (A8, A9).
- The setter is executable by no role, `service_role` included (A9; static contract).
- No API, worker or client calls any recording definer (static contract).

---

## 7. Deviations from the contract, declared

1. **The legacy producers are closed by a trigger, not re-created.** A guard on `conversation_units` refuses a unit
   whose modality is not its turn's, so the ungranted 0064 … 0070 producers cannot commit a voice turn.
2. **The 0150 coordinator is not re-created.** It calls the live producer, which carries the whole change.
3. **The residue census is a deploy and verifier check, not a runtime one.** Deploy guard G3 and the verifier census
   refuse an unregistered voice relation; the erasure itself does not re-scan the catalogue.
4. **No `residue_class` row is added for voice.** Voice rows are erased by the voice module inside the coordinator, so a
   voice row never blocks erasure (A11 proves no row remains).
5. **The Replay shape law is a CHECK plus a guard.** The CHECK admits the three media for a Personal item; the guard
   binds the medium to the unit's turn.
6. **A `MACHINE_ASR` Memory is not Evidence.** Every existing Evidence, truth-maintenance and matching reader admits
   only `USER_STATED` / `USER_CONFIRMED`, so such a Memory is never fresh Evidence and the effect completes
   `NO_FRESH_EVIDENCE` (otherwise the association step would refuse it and the execution would quarantine). **A risk for
   the Product Owner:** spoken facts can be remembered and recalled, but never support a hypothesis or matching until a
   later decision admits `MACHINE_ASR` there. **Owner (R1, §10.4): S8B-03, before any voice gate opens**, recorded as a
   dated note on `QAN-BL-VOICE-01`.
7. **The database enforces the P-1 ceiling:** a `MACHINE_ASR` confidence of 0.95 or more is refused.
8. **Explicit Memory commands stay `USER_STATED`.** «افتكر …» spoken in a call is the foreground command path, which D-7
   does not change.
9. **The interim media erasure store knows only `intro-media/` keys.** 0183 admits voice keys to the 0162 queue and
   `media_pending`, but the S6-06 store's key pattern refuses them, so a voice key would be deferred, never lost. No voice
   key can exist in CP1 (no consent text, gates closed). CP2 extends the store and the worker (contract §3.10).
10. **Begin v1 still admits the route-neutral `GEMINI_SPEECH_GENERATION`.** Its settlement is partition-guarded: settle v1
    cannot write a text kind on it (A12).
11. ~~**P-1 is a frozen code constant, not an environment variable.**~~ **Withdrawn by R1 (§10.3):** P-1 is now
    controlled configuration, tuned without a code change, as approved.
12. **`deleted_reason = 'ACCOUNT_ERASURE'` is in the vocabulary but unused:** account erasure removes the rows rather than
    marking them.
13. **Two NULL-unsafe CHECKs were found by the verifier and fixed before commit** (a call recording without an expiry;
    a `USER` voice source with no origin or band). Every 0183 CHECK is now written with `CASE` and explicit `IS NOT
    NULL` / `coalesce`.
14. **A refused Public package surfaces as `UNAVAILABLE`.** The S8A-05 classifier maps the voice exclusion to its
    existing closed outcome; nothing new is shown.

## 8. Risks and decisions for the Product Owner

- **Deviation 6** (`MACHINE_ASR` is not Evidence) is an open gap. It is owned by S8B-03 and must be decided before any
  voice gate opens (§10.4).
- **P-1** values are starting values. They are tuned through configuration, and only above 0 and below 0.95 (§10.3).
- **CP2 dependencies:** the object store and its worker for voice keys (deviation 9), B5, the hosted-proof note on
  `QAN-BL-PROD-08` (D-8), and the closing BG-08 / BG-09.
- **No new backlog item.** Every gap found has a named owner: CP2 for the store and worker, S8B-03 for the consent text
  and the Voice Note writer, S8B-05 for the call writer, S8B-07 for Replay audio, S8B-08 for provider reconciliation.

## 9. Governance (CP1, in the same change)

- **Locators:** `QANDEEL_CURRENT_STATE.md`, `QANDEEL_PROJECT_MAP.md`, `QANDEEL_PRODUCT_ROADMAP.md`. S8B-01 recorded as
  closed and merged through PR #366 as `c65b878c`; Project Map `:142` no longer calls the contract a candidate; the
  current-task line is S8B-02, with S8B-01 beneath it; the four current-task pins re-anchored.
- **Backlog:** the two Stage 8B rows written into the §4 index by mistake are moved to §9 (contract I-10); S8B-01's row
  records its merge; S8B-02's BG-05 row is added. Nothing is admitted or tombstoned; the index count is unchanged.
- **Amendment:** §4 of the S8B-01 Voice Runtime Controlled Amendment records the text S8B-02 binds (VA-3 tightened by D-3,
  VA-5 amended by D-1 / D-2, VA-8 R-1), with the narrowed citations re-quoted on `c65b878c`. It binds from S8B-02's merge.
- **Contract:** dated S8B-02 notes in `docs/voice-runtime-v1.md` §6.2, §6.3, §7, §10 and §12.
- **Not done here:** BG-08 and BG-09 are S8B-02's closing change (CP2). This record keeps its CP1 banner; S8B-02 is not
  declared complete. No `**Phase:**` banner and no `### I-0N closure record` heading are written.

## 10. R1 — the Product Owner's review of PR #367 (2026-10-30)

The Product Owner reviewed PR #367 against the approved contract. The implementation was accepted, with three bounded
corrections and one record required before merge. R1 applies them on `s8b/s8b-02-cp1` and updates the Draft PR. It makes
no other change: 0184, the text path, Replay and the gates are untouched.

### 10.1 PRIV-W and idempotency

- **Finding.** `server_begin_voice_note_upload_v1` and `server_add_call_segment_v1` answered a replayed request from its
  earlier row before re-reading consent. After a withdrawal, a replay could hand back the key of an unfinished upload.
- **Correction (0183).**
  - A replayed begin of a note still `PENDING_UPLOAD` answers `CONSENT_REQUIRED` and returns no key.
  - The add re-reads consent before its idempotent replay, so the same segment index is refused too.
  - The accept and the store already re-read consent before acting on a pending object.
  - A **completed** operation stays safely retryable: an accepted note replays `ACCEPTED`, a stored segment replays
    `STORED`, and nothing new is recorded.
- **Proof (verify-0183 A8).**
  - After a withdrawal, a replayed begin answers `CONSENT_REQUIRED` with no key, and so does a replayed add of the same
    index.
  - An accepted note and a stored segment still replay their results.
  - Against the CP1 migration, A8 fails on exactly this assertion.

### 10.2 Retention while a call recording is `RECORDING`

- **Finding.**
  - The segment writers did not check `retention_expires_at`.
  - The sweep covered `STORED` and `PENDING_UPLOAD` only, so a recording whose writer never sealed it stayed
    `RECORDING` past its expiry.
- **Correction (0183).**
  - `voice_private.recording_expired_v1` (no role may execute it).
  - Add, store and gap answer `EXPIRED` at or after the expiry.
  - The sweep now also takes a `RECORDING` recording at or past its expiry. It seals it `RECOVERY` through the existing
    seal: pending segments become `WRITER_LOSS` gaps, and their keys are queued after their upload window. It then marks
    it `EXPIRED` and queues every stored key, in one transaction.
  - The expiry and `started_at` are unchanged.
  - **Only the recording is closed.** The call, its end and its end reason stay S8B-05's, and no call authority is added
    or changed.
- **Proof (verify-0183 A6r).**
  - In a call opened 30 days minus 2 seconds ago and never sealed, add, store and gap answer `EXPIRED` after the instant,
    and nothing is readable.
  - The sweep leaves the recording `EXPIRED`, sealed `RECOVERY`, with its expiry and `started_at` byte-equal.
  - The pending segment is `DISCARDED` with a `WRITER_LOSS` gap, and both keys are queued.
  - A late writer seal answers `UNAVAILABLE`, and the owner finds the recording `ALREADY_GONE`.
  - Against the CP1 migration, A6r fails at the first add.

### 10.3 P-1 as controlled configuration

- **Finding.** The values were a code constant, while the approved decision asks for controlled configuration that can be
  tuned without a code change (deviation 11).
- **Correction (API).**
  - `loadMachineAsrMemoryConfidence` reads `MACHINE_ASR_MEMORY_CONFIDENCE_HIGH` / `_MEDIUM` once, when the background
    enrichment service is built.
  - Unset or blank keeps the approved defaults, 0.90 / 0.75.
  - Each value must be a number above 0 and below 0.95, and MEDIUM must not exceed HIGH. Any other value stops the API
    from starting, so a misconfiguration never writes.
  - `.env.example` names both with their defaults. The database ceiling (< 0.95) is unchanged.
- **Proof (`s8b-02-voice-memory-capture.spec.ts`):**
  - the defaults;
  - a tuned pair;
  - every unsafe value refused, for both variables;
  - MEDIUM above HIGH refused;
  - the background capture writing the configured value, read once;
  - an unsafe value refusing to build the service.

### 10.4 `MACHINE_ASR` Memory and Fresh Evidence — a recorded gap with an owner

- **The gap.** A `MACHINE_ASR` Memory is written and recalled, but it **never reaches Fresh Evidence**:
  - every Evidence, truth-maintenance and matching reader admits only `USER_STATED` / `USER_CONFIRMED`;
  - the background effect therefore completes `NO_FRESH_EVIDENCE` (deviation 6).
- **Consequence.** A fact the user only ever said aloud does not support a hypothesis, Personal Understanding evidence or
  matching.
- **Owner: S8B-03** (Personal Voice Note), the first task that produces `MACHINE_ASR` turns.
  - The gap must be decided **before any voice gate opens**: either a reviewed controlled change that admits
    `MACHINE_ASR` to Evidence on stated terms, or the Product Owner's explicit acceptance of the limitation.
  - It is recorded as a dated note on `QAN-BL-VOICE-01` (owned by Stage 8B), so it does not live only in this record.
  - No backlog item is admitted, because the item already has its owner.
- **Not done in CP1.** CP1 does not redesign the Evidence system.

### 10.5 Verification (targeted, as the Product Owner asked)

| Check | Result |
|---|---|
| `verify-migration-0183` on a freshly migrated database (0182 → 0183 → 0184) | **20 / 20 PASS**, run twice. New: A6r. Extended: A8. |
| The same verifier against the CP1 migration | A6r and A8 **FAIL** on the defects, as expected (S0b fails on the new helper) |
| `test:database` (verifier hazard scanner) | 1310 / 1310 PASS |
| `test:s8b-02-voice-foundation-contract` (ACL count 41, P-1 configuration pins) | 7 / 7 PASS |
| `test:s4-01-shared-world-reachability-contract` (reads `.env.example`) | 7 / 7 PASS |
| API jest: `background-intelligence`, `memory`, the memory-control route | 20 suites, 624 PASS |
| API `tsc` (both configurations) | clean |

No full local sweep was rerun, as the Product Owner asked. GitHub CI on the R1 head is authoritative.

---

## 11. CP2 — the secure media lifecycle, S8B-02's closing change (2026-10-30)

### 11.1 Authority and scope

- **Order:** the Product Owner's *S8B-02 CP2 execution order* (2026-10-30): CP2 is S8B-02's second and last checkpoint, under
  the S8B-02 Implementation Task Contract v1.0 FINAL and its acceptance rows B1 – B14, keeping D-1 … D-8, PRIV-W, P-1 and
  the R1 corrections. WP0 and CP1 are not reopened.
- **Base:** `main` at `f0d8ed1a88a5f3747e32bc476a4d898c6e4a3046`, the merge of PR #367 (S8B-02 CP1 with R1; API CI and
  Mobile CI green). Branch `s8b/s8b-02-cp2`. 0183 and 0184 are byte-identical.
- **Allowed and done:** the branch, the code, one forward-only migration (§11.2), local and integration tests, these
  documents, a local commit.
- **Not done (each needs the Product Owner's further approval):** push, pull request, merge, S8B-03, opening any voice
  gate, any paid call, any hosted resource, any real user data.
- **Not built in CP2, as ordered:**
  - production ASR or TTS, or any provider call;
  - the mobile recorder and the mobile saver of exported voice files (S8B-03);
  - the Live Call gateway and its segment writer (S8B-05);
  - VAD, AEC and barge-in (S8B-05 / S8B-06);
  - Replay rendering and distribution (S8B-07);
  - Shared Voice Notes;
  - Price Cards or Credits;
  - any Memory or Evidence redesign. The `MACHINE_ASR` → Fresh Evidence gap stays with S8B-03 (§10.4).

### 11.2 Why migration 0185 exists

The integration proved two database gaps in 0183. Each is closed forward-only in
`database/migrations/0185_s8b_02_voice_media_lifecycle_v1.sql`.

1. **Export needs an enumerator.** No 0183 definer lists an owner's readable recordings: the export package builder
   names no recording or object, by design. Without one, the voice manifest of Export My Data (§3.11, B9) cannot be
   built.
   - **Added:** `public.server_list_voice_recordings_v1(uuid)`. It returns the owner's readable recordings (through
     0183's `recording_readable_v1`) and their `STORED` objects, each with a stable export file name. It returns **no
     storage key**: the per-file route re-reads the key through 0183's read definer, which re-checks ownership and
     readability at that instant.
2. **Late writes were invisible to reconciliation.** 0183's voice listing reconciliation skipped every key that still had
   an object row. Voice object rows outlive their recording's `EXPIRED` / `DELETED` / `DISCARDED` state, because they are
   its history. So an object written late under such a key could never be found (B5).
   - **Forward-replaced:** `public.server_enqueue_unknown_voice_media_v1(text[])`. It now queues a listed key unless that
     key belongs to a live object (not `DISCARDED`) of a live recording (not `EXPIRED`, `DELETED` or `DISCARDED`). A live
     key is never touched.

**What 0185 does not contain:**

- no relation, column, CHECK, trigger, state, gate or consent text;
- no `voice_private` function, so verify-0183's census is unchanged;
- nothing that names the account erasure coordinator.

Both definers are granted to `service_role` alone. Deploy guard G1 refuses unless all four voice scopes are
`DISABLED` / `UNSATISFIED`; G2 refuses any client-role execute.

**Defect found by its own verifier before commit:** a NULL `CASE` concatenation made every export file name NULL. It is
fixed with `ELSE ''`, and verify-0185 L1 proves the names.

### 11.3 What CP2 delivers

| Kind | Files |
|---|---|
| Migration | `0185_s8b_02_voice_media_lifecycle_v1.sql` (§11.2) |
| A — store | `apps/api/src/voice-media/private-audio-object.store.ts` — `PrivateAudioObjectStore` (`putStream`, `getRange`, `exists`, `remove`, `listOlderThan`), the S3 adapter and the ONE in-memory fake. It reuses the S6-06 bucket, configuration and SDK through `mediaStoreConfigFrom` / `mediaStoreClient` (exported from `introduction-media.store.ts`, behaviour unchanged). No new dependency, no second store. |
| B — API | `voice-media.service.ts`, `voice-media.controller.ts`, `voice-media.repository.ts`, `voice-media.module.ts` |
| C — retention | `voice-retention.worker.ts` (the 0183 sweep), `voice-recording-recovery.worker.ts` (the 0183 stale-writer recovery) |
| D — erasure | `introduction-media-erasure.worker.ts`, generalized: routes a key by prefix to its store, adds the voice listing reconciliation |
| E — account deletion | no new code. The 0164 / 0183 authority already queues every voice key to the shared queue and `media_pending`; D makes the worker erase them. |
| F — export | `privacy-data.service.ts` / `privacy-data.controller.ts`: `voiceManifest` beside `photoManifest`; `GET /account/privacy/export/download/bundle/voice/:fileName` |
| G — ports | `apps/api/src/voice/speech-recognition.adapter.ts`, `speech-synthesis.adapter.ts`; deterministic fakes in `apps/api/src/voice/testing/` |
| Composition | `IntroductionsDisclosureModule` imports and re-exports `VoiceMediaModule`, so `AccountModule`'s import list is unchanged |
| Telemetry | `VOICE_MEDIA` (upload / read / delete / export_file), `VOICE_RETENTION` (sweep / recover), `INTRODUCTION_MEDIA_ERASURE` `voice_reconcile`: content-free classes only |
| Rate census | the four voice routes and the voice export file route are classified |
| Tests | `voice-media.spec.ts` (30); `database/verify-migration-0185.mjs` (C0, L1, R1); `database/prove-0185-voice-media-lifecycle-postgrest.mjs` (V01 – V14) |
| CI | `verify:voice-media-lifecycle:integration` after the 0184 verifier; `prove:voice-media-lifecycle:postgrest` in the PostgREST + rclone loop after `prove-0168` |
| Re-anchored | `tests/s8b-02-voice-foundation-contract.test.mjs` (0185 is next; the CP2 boundary and privacy rules replace the CP1 "no adapter" rule); `tests/w3-mega-s-personal-controls-settings-contract.test.mjs` (the voice export route); `privacy-data.spec.ts`, `privacy-export-bundle.spec.ts`, `observability.spec.ts`; `prove-0168` X07 (the null `voiceManifest`) |

Routes. All are behind the verified token and answer `Cache-Control: no-store, private`. None takes a user id or a
storage key.

| Route | Behaviour |
|---|---|
| `POST /voice/notes/:sessionId/:commandId` | the raw `audio/mp4` body, streamed |
| `GET /voice/recordings/:recordingId` | the readable objects |
| `GET /voice/recordings/:recordingId/objects/:track/:segmentIndex` | 200, or 206 for a Range; 416 out of range |
| `DELETE /voice/recordings/:recordingId` | `DELETED`, or `ALREADY_GONE` on a repeat |
| `GET /account/privacy/export/download/bundle/voice/:fileName` | one listed export file, streamed |

### 11.4 The design as built

- **Streaming (A, B10).**
  - The upload is one S3 PUT. Its body is the request stream piped through an exact-length counter; the length is the
    one the database recorded at begin.
  - A read is the store's own body stream, piped to the response with a 30 s idle watchdog.
  - Every store call takes an AbortSignal: a client disconnect, the upload deadline and a 15 s budget to begin answering
    a read.
  - Nothing buffers a whole recording.
- **Note upload order (B).**
  1. Shape checks run before any database call.
  2. **begin:** the gate and consent are checked in the database.
  3. **PUT.**
  4. **accept:** consent is re-read.
  - Whatever stops the upload after begin discards the note at once:
    - a failed or aborted PUT;
    - an accept refusal, such as a PRIV-W withdrawal.
  - A discarded note is never `STORED`. Its key waits out the upload deadline in the shared queue.
  - An accept that gets no answer is neither discarded nor claimed: the sweep settles it.
- **Gates (B12).** Only creation consults a gate or consent. Read, delete and export never do.
- **Reads.**
  - Every read re-checks ownership and readability in the database.
  - A not-readable recording answers 404 without touching the store. That covers another human's, expired, deleted and
    erasure-due recordings.
  - A live key with no object is 503, an integrity failure, never an empty answer.
- **Retention (C, B8).**
  - The clock is 0183's: `retention_expires_at`, written once. Reads stop at the instant, inside the database, with no
    worker.
  - The retention worker runs 0183's sweep. It expires `STORED` recordings, discards unfinished notes, and seals
    `RECOVERY` then expires a call still `RECORDING` past its expiry.
  - The recovery worker seals a call whose writer lease lapsed.
  - No API code computes or extends an expiry.
- **Erasure (D).**
  - There is one worker and one queue, using DELETE, then HEAD 404, then Confirm, with the 0162 lease and backoff.
  - A voice key goes to the audio store and a photo key to the photo store.
  - Without an audio store, a voice key is deferred, never confirmed.
  - The listing reconciliation now covers `voice-note/` and `voice-call/` as well as `intro-media/`, and 0185 decides
    what is no longer live.
  - A pending key waits until its upload deadline plus 60 s (0183), so an upload still in flight is never erased from
    under itself, and a late write is found by the listing.
- **Account erasure (E).**
  - 0164 / 0183 queue every key the account's recordings ever named, history included, and track them in
    `media_pending`.
  - `media_erased_at` is set by the 0164 trigger only when the last key leaves the queue, for photos and voice alike.
- **Export (F).**
  - The voice manifest, format `qandeel.personal-data-export.voice.v1`, lists each file with:
    - its name, type, kind, track and index;
    - its instants, its size and its clock;
    - `originalAudio: true`.
  - It carries no key, no recording id and no bytes.
  - The per-file route re-resolves the name against the owner's readable recordings at download. An expired, deleted or
    erased recording, or another reader's file, answers 404 `NO_LONGER_AVAILABLE`.
  - The bundle requires a `READY` export, as for photos. A lost voice object does not block the bundle: its file
    answers 503 on download. This differs from `QAN-BL-PROD-10`, which is about photos and is unchanged.
- **Ports (G).**
  - `SpeechRecognitionAdapter` (batch and streaming) and `SpeechSynthesisAdapter` (chunked).
  - Their usage is in the VA-5 ledger's own units and sources:
    - Speechmatics: `audioInputMs`, `PROVIDER_REPORTED` / `GATEWAY_MEASURED` (D-2);
    - Gemini: `inputTokens` + `audioOutputTokens` (D-1);
    - a crashed session is `ABSENT`, never zero.
  - The fakes are deterministic and composed by no module. The ports carry no network code and read no credential
    (static contract).

### 11.5 Acceptance — B1 … B14

| Row | What proves it | State |
|---|---|---|
| **B1** Voice Note lifecycle | prove-0185 V02 – V04, V08 (consent → upload → store → read → expiry at the instant → physical deletion); `voice-media.spec` upload / read | proven locally at unit, contract and DB level; **live leg written, runs in CI** |
| **B2** Live Call recording | prove-0185 V09:<br>• USER / QANDEEL segments;<br>• `OUT_OF_ORDER` and `DISCONTINUOUS` refused;<br>• a `RECONNECTION` gap;<br>• the owner's deletion erases every segment.<br>verify-0183 A6 / A6r / A7 (the database authority) | DB proven locally; **live leg runs in CI** |
| **B3** Early deletion | prove-0185 V07: refused at once, erased (DELETE, HEAD 404, the data directory), `ALREADY_GONE` on repeat; spec | **live leg runs in CI** |
| **B4** Account erasure | prove-0185 V12 (a real photo and voice through the one queue; `media_erased_at` only after the last key); verify-0183 A11; verify-0164 E01 / E09 re-run on the 0185 database | DB proven locally; **live leg runs in CI** |
| **B5** Races, PRIV-W | prove-0185 V10:<br>• a withdrawal during an upload discards the note; the landed object waits out its deadline, then is erased;<br>• a withdrawal between a segment's PUT and its store refuses the store;<br>• a late PUT under a terminal key and an orphan are reconciled;<br>• live keys are never queued.<br>verify-0183 A8r (the two-connection ordering); verify-0185 R1 | DB proven locally; **live leg runs in CI** |
| **B6** Crash and recovery | V06 (a client disconnect discards, leaving no object or partial file); V09 (a writer lost → recovery seal); V12 (a crashed worker's leases lapse, then a fresh worker finishes); spec | **live leg runs in CI** |
| **B7** Storage failures | V07b (live PUT / GET / DELETE / HEAD failures: 503, nothing partial, never a false confirmation, the retry erases); V12 (a voice store outage during account erasure); spec (`failing` put / get / remove / exists / list) | unit proven locally; **live leg runs in CI** |
| **B8** Retention never extended | V04 (reads), V09 (reconnection and recovery), V08 (the instant); verify-0183 A6 / A6r (the Replay capture and the sweep leave the expiry byte-equal) | DB proven locally; **live leg runs in CI** |
| **B9** Export | V11 (the manifest beside an unchanged photo manifest; every file byte for byte; another reader and a deleted recording `NO_LONGER_AVAILABLE`); verify-0185 L1; spec | DB proven locally; **live leg runs in CI** |
| **B10** Privacy and streaming memory | static contract (no logger, console, Sentry, presign or ACL in the media code; no base64); telemetry allowlist (`observability.spec`); V03 / V11 (no key in any answer); V05 (an error carries only its outcome); V06 (the streaming witness); **V06m (the bounded-memory acceptance test, §11.7)** | contract and unit proven locally; **V06m runs in CI** |
| **B11** HTTP isolation | V05 (another human 404, nothing read from storage for them; no token 401 on every voice route); V13 (no client role reaches a voice definer on the wire) | **live leg runs in CI** |
| **B12** Gates | 0185 deploy guard G1; verify-0185 C0; V01 / V14; every scope `DISABLED` / `UNSATISFIED` | **proven locally** |
| **B13** Honest evidence | every rclone result is labelled a CI stand-in; the hosted proof is `QAN-BL-PROD-08`'s (§11.9) | **met** |
| **B14** Closure | §11.9 and the backlog's closing paragraph (BG-08, BG-09) | **met in this change** |

### 11.6 Verification (local, 2026-10-30)

All runs used the loopback PostgreSQL 17 on port 55433 and never the hosted database. The 0185 database is a fresh clone
of a database migrated to 0184, with 0185 applied.

| Check | Result |
|---|---|
| verify-migration-0185 (C0 catalogue and gates, L1 export listing, R1 reconciliation) | **PASS** |
| verify-migration-0183 / 0184 / 0164 / 0162 / 0168 / 0169 on the 0185 database | **PASS** (each) |
| `test:database` (verifier hazard scanner) | **1310 / 1310 PASS** |
| root contracts (`node --test tests/*.test.mjs`) | see §11.10 (final run) |
| `test:s8b-02-voice-foundation-contract` | **9 / 9 PASS** |
| S6-06 and the other pinned contracts (s6-02, s6-05, s6-06, s6-07 ×2, s7-01, acct-del-01, w3-mega-s) | **PASS** |
| forward-safety mirror contract | **35 / 35 PASS** |
| API jest, full | **300 suites; 7095 PASS, 1 skipped**. The "worker failed to exit" warning is not from the voice, account or disclosure suites: `--detectOpenHandles` on them finds none. |
| API `tsc` | clean |
| DI composition (`AccountModule` booted with no environment) | `PrivacyDataService` holds the one `VoiceMediaService`; the erasure worker holds the audio store and the voice repository |
| `prove-0185` (PostgREST + rclone) | **NOT RUN LOCALLY** (§11.7). Syntax-checked; wired into CI. |

**No regression in photo erasure or export:**

- verify-0162, verify-0164 and verify-0168 pass on the 0185 database.
- The photo store and worker behaviour are unchanged: the worker only adds a prefix route and a second reconciliation.
- The photo manifest, photo files and text package are byte-unchanged in shape; `voiceManifest` is additive.
- `prove-0162` and `prove-0168` are unchanged, apart from X07's re-anchored null shape, and run beside `prove-0185` in CI.

### 11.7 Proofs not complete, and why

- **`prove-0185` has not run.** This machine has no PostgREST, no `rclone` and no Docker. The Product Owner's CP2
  review (2026-10-30) authorized a push and a Draft PR so that CI runs it; nothing is downloaded locally. The proof is written, syntax-checked
  and wired into api-ci's PostgREST + rclone loop.
  - **Until it passes in CI, B1 – B9 and B11 are proven at the database, contract and unit level only**, and the
    PostgREST / rclone results the order asks for do not exist yet.
  - **This is the condition for engineering closure.**
- **Streaming memory (B10) — the acceptance test V06m** (added after the Product Owner's CP2 review, 2026-10-30; an RSS
  figure logged for information is not acceptance).
  - **What runs:** 50 MiB of synthetic notes (24 + 24 + 2 MiB, each under the 25 MiB object ceiling). Each is streamed up
    through the API to the store, then read back whole through the API. Every byte is checked by SHA-256.
  - **The bound:** at no sample may the process hold more than `STREAM_MEMORY_BOUND` = **16 MiB** of payload. That is under
    one third of the payload and under any one note, and nothing may remain afterwards.
    - "Held" means live ArrayBuffer memory (`process.memoryUsage().arrayBuffers`) over its baseline.
    - It is read after two synchronous collections in the same tick, so nothing is allocated in between, and the second
      collection completes the first one's ArrayBuffer sweep.
    - Samples run throughout the transfer, at least 10 of them.
    - The collector is exposed at run time, with no new command-line flag. The harness allocates nothing per chunk.
  - **The control:** the same instrument must see a deliberately held 24 MiB note exceed the bound, so it can fail.
  - **Why it is not RSS: the first CI run of V06m (`4e4c4cac`).**
    - That run measured RSS: baseline 175.6 MiB, peak growth 24.0 MiB and 24.0 MiB after a collection, against the
      original 16 MiB RSS bound.
    - The diagnosis (2026-10-30) ran on this machine against a fake S3 in its own process, with the same 24 + 24 + 2 MiB.
      It found no whole-file buffering anywhere in the production path:
      - the upload through `S3PrivateAudioObjectStore` and the SDK held at most 1.9 MiB live;
      - on the read path, the S3 body, the response's write queue and the S3 socket each held at most 0.1 MiB;
      - with the corrected instrument, the full API path (store and SDK) held 0.2 – 0.3 MiB, while a server that
        buffers a whole note held 48.0 MiB.
    - RSS grew 8 – 22 MiB even in a server that only discards the body, with no SDK. It grew 48.7 MiB when the harness
      alone streamed to the fake S3, with no API at all. In every case RSS was back to ~0 after a collection on this
      machine.
    - So RSS growth in this shared process measures churn from released bytes, not bytes held. Linux's allocator keeps
      the pages it has released, which is why CI showed the same 24.0 MiB after collection.
    - RSS is therefore reported, not asserted. The bound's VALUE is unchanged at 16 MiB.
  - The measured notes are then deleted and erased, so the later scenarios see the store unchanged.
  - V06's witness stays: while the client pauses with 8 of 24 MiB sent, the store already holds at least 4 MiB.
- **Timeouts** are proven by unit only: the 15 s read-open budget, the 30 s idle watchdog and the upload deadline.
- **Hosted Supabase Storage** is not proven and must not be inferred from rclone (B13; §11.9, `QAN-BL-PROD-08`).

### 11.8 Deviations, declared

1. **No `voice.module.ts`.** The ports have no production provider in CP2, so a module would compose nothing. S8B-03 /
   S8B-04 / S8B-05 bind them.
2. **`VoiceMediaModule` is composed through `IntroductionsDisclosureModule`,** which imports it for the shared erasure
   worker and re-exports it. `AccountModule`'s import list, pinned by six contracts, is unchanged. One instance of each
   provider exists; the DI composition check proves it.
3. **`writeCallSegment` has no route.** It is S8B-05's writer entry point and is proven live by `prove-0185` V09 / V10.
4. **The export voice file route answers through `@Res`.** It sets `no-store, private` before anything is sent, instead
   of the `@Header(...NO_STORE)` decorator of the JSON routes. The pinned count of seven decorated routes is unchanged.
5. **Account erasure tracks every key a recording ever named** (0183 `erase_voice_v1`), including keys already erased.
   Each is confirmed again by DELETE then HEAD 404. This is harmless, and it is what keeps a late write from escaping
   the erasure.

### 11.9 Governance — BG-08 / BG-09 (S8B-02's closing change)

- **BG-08:**
  - `QAN-BL-VOICE-01` is **worked and not delivered**. It stays `DEFERRED — OWNED` by Stage 8B, `HIGH`, with a dated
    current-truth note: done in S8B-02, and what remains with S8B-03 … S8B-08.
  - `QAN-BL-PROD-08` receives the dated note D-8 asked for: the hosted proof also covers `voice-note/` and `voice-call/`,
    Range, the object-size limit, DELETE / HEAD and listing.
  - Nothing is admitted or tombstoned. Every residue has an owner:
    - the hosted store: `HOSTED-DEPLOY-01` (`PROD-08`);
    - the recorder, the voice file saver, the consent text and `MACHINE_ASR` → Evidence: S8B-03;
    - the call gateway and writer: S8B-05;
    - Replay audio: S8B-07;
    - provider reconciliation and launch evidence: S8B-08.
  - The index is unchanged: **89 items; 44 / 4 / 8 / 33; 52 / 35 / 2**.
- **BG-09:** this record's banner carries S8B-02's state at its closing change. The three locators, the backlog's §7
  closing paragraph and its §9 row are updated in this same change. No separate documentation step follows.
- **Engineering completion is not user readiness.** S8B-02 gives Stage 8B a secure, closed-by-default media lifecycle.
  A user can record, hear or export nothing until:
  - S8B-03 (the recorder, the consent text, the saver, `MACHINE_ASR` → Evidence);
  - S8B-04 / S8B-05 / S8B-06 (rendering, the call, barge-in);
  - S8B-07 (Replay audio);
  - S8B-08 (cost, privacy and launch evidence);
  - the hosted store (`QAN-BL-PROD-08`);
  - and the gates opened by their own launch decisions.

### 11.10 Final local state

See the closing commit on `s8b/s8b-02-cp2`. The root-contract run after these documents is recorded in the Product
Owner's CP2 report.
