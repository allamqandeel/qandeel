# QANDEEL — S8B-02 Voice Foundation — Implementation Record v1

**Task:** S8B-02 — Voice Foundation (Stage 8B). This record covers **CP1 — the database and governance foundation**
(§1 – §9). CP2 — the secure media lifecycle and S8B-02's closing change — is not started.
**Status:** `S8B-02 CP1 DELIVERED LOCALLY ON s8b/s8b-02-cp1 (2026-10-30) — NOT PUSHED, NO PULL REQUEST, NOT MERGED — S8B-02 NOT COMPLETE (CP2 NOT STARTED, NOT AUTHORIZED) — MIGRATIONS 0183 / 0184 NOT HOSTED — EVERY VOICE GATE CLOSED`
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
- Where they live: `MACHINE_ASR_MEMORY_CONFIDENCE` in `apps/api/src/memory/memory-write-evaluator.service.ts`, one frozen
  object. Changing them is a reviewed one-line change (§7, deviation 11). The database refuses any `MACHINE_ASR`
  confidence of 0.95 or more.

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

**Consent with withdrawal (A8, PRIV-W).** Versioned consent texts (none installed: every act is refused until S8B-03
installs a Copy-Gated version); grant, withdraw and state definers; the five recording acts refused without a current
grant; seal, read and owner deletion never consult consent. Two-connection races prove the ordering of a withdrawal
against a begin / open (A8r).

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
| `verify-migration-0183` | **19 / 19 PASS** |
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
   later decision admits `MACHINE_ASR` there.
7. **The database enforces the P-1 ceiling:** a `MACHINE_ASR` confidence of 0.95 or more is refused.
8. **Explicit Memory commands stay `USER_STATED`.** «افتكر …» spoken in a call is the foreground command path, which D-7
   does not change.
9. **The interim media erasure store knows only `intro-media/` keys.** 0183 admits voice keys to the 0162 queue and
   `media_pending`, but the S6-06 store's key pattern refuses them, so a voice key would be deferred, never lost. No voice
   key can exist in CP1 (no consent text, gates closed). CP2 extends the store and the worker (contract §3.10).
10. **Begin v1 still admits the route-neutral `GEMINI_SPEECH_GENERATION`.** Its settlement is partition-guarded: settle v1
    cannot write a text kind on it (A12).
11. **P-1 is a frozen code constant, not an environment variable.** The contract's recommendation said "adjustable
    without code"; the values are one reviewed line instead, which keeps them out of runtime configuration. If the
    Product Owner wants an environment override, it is a small follow-up within the same bound.
12. **`deleted_reason = 'ACCOUNT_ERASURE'` is in the vocabulary but unused:** account erasure removes the rows rather than
    marking them.
13. **Two NULL-unsafe CHECKs were found by the verifier and fixed before commit** (a call recording without an expiry;
    a `USER` voice source with no origin or band). Every 0183 CHECK is now written with `CASE` and explicit `IS NOT
    NULL` / `coalesce`.
14. **A refused Public package surfaces as `UNAVAILABLE`.** The S8A-05 classifier maps the voice exclusion to its
    existing closed outcome; nothing new is shown.

## 8. Risks and decisions for the Product Owner

- **Deviation 6** (`MACHINE_ASR` is not Evidence) is the one behavioural choice a later task may revisit.
- **P-1** values are starting values; they can be tuned only by a reviewed change, and only below 0.95.
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
