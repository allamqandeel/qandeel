# QANDEEL — IP-IMP-01 — Interaction Preferences — Implementation Record v1

**Status:** `IP-IMP-01` — **CLOSED / MERGED through PR #331 as `424cd0231429e5280a0e70be25c2f83437e117c8` (2026-10-12);
migration `0153` NOT DEPLOYED.** The post-merge status is recorded by GOV-REC-01 (2026-10-12, §12). §1–§11 are kept as
written before the merge.

**Status at the closing change (historical, kept verbatim):** `IP-IMP-01` — **IMPLEMENTATION COMPLETE / READY FOR INDEPENDENT REVIEW AND THE PRODUCT OWNER'S MERGE DECISION.**
WP0–WP7 are implemented on one branch with migration `0153`, and this record carries the closing change (BG-08 / BG-09).
**Not merged** (merge only on «ادمج»), **migration not applied to any hosted database, nothing deployed.** The PO Copy
Addendum in §8 is closed: CA-1 and CA-2 (as corrected in R2) are `APPROVED`, and the owner name `PUBLIC-PREF-01` is
`APPROVED` (Product Owner, R2 approval, 2026-10-12).

**Authority:** the Product Owner's *IP-IMP-01 R1 Task Contract*.
- It carries the four review findings the Product Owner accepted: all capture paths in WP2, SELF-only in WP3, BG-05/08/09,
  and Shared/Public.
- The Product Owner clarified two points (C-1, C-2) and approved D-SP Option A. The approval was **FINAL PRODUCT OWNER
  APPROVAL**: "execution and creating a PR are allowed".
- These rules bind the task:
  - «الدمج ممنوع حتى أقول «ادمج»» (no merge until the Product Owner says «ادمج»);
  - no hosted migration without a separate approval;
  - no out-of-scope change and no edit to the Project Map or the Roadmap;
  - a temporary request is never stored as a durable preference or a new preference Memory, but stays in the history;
  - every defect that blocks a correct Personal implementation is fixed here, not deferred.
- The approved UI copy table is the copy authority for every user-visible string (§8).

**Baseline:** `main = 3bec87ac725c73db0aecc5a6fb4e01c90acce66b` (the merge of PR #330), verified before branching.
Migrations `0001`–`0152`; `0153` is the next free number.

**Branch:** `ip/ip-imp-01-interaction-preferences`.

**Implementation commits (the tested code tree):**
- `07486604` — implementation.
- `8af35fd9bfc028b0100910842c17137bf720615b` — the explicit WP7 proofs and the focused group.
- Later commits add documentation only.

**Backlog:**
- IP-IMP-01 inherits no item. The BG-05 census is NONE (§1.4).
- The closing change admits `QAN-BL-IP-01` (Public World) and `QAN-BL-IP-02` (Stage 8A behavioural quality) after
  anti-duplication.
- It records a BG-08 reconciliation note on `QAN-BL-CW-02` (Shared). Owner, scope and status are unchanged (§9).

---

## 1. WP0 — repository truth, change boundaries, kickoff census

### 1.1 Repository truth at `3bec87ac` (verified, read-only)

| # | Fact | Where |
| --- | --- | --- |
| T-1 | No canonical preference record, no preference read, no preference rendering existed. | grep of `apps/`, `database/` |
| T-2 | `INTERACTION_PREFERENCE` existed only as a Memory type (importance 0.90). | `memory.types.ts`, `memory-write-evaluator.service.ts:11` |
| T-3 | **Defect D-1:** two evaluator templates captured «كلمني/كلّمني/اتكلم معايا/رد عليا/رد عليّ …» and "speak/talk/respond/answer (to) me in …" as an `INTERACTION_PREFERENCE` Memory, with no durable-intent check. A temporary «كلمني بالمصري» became a permanent Memory. | `memory-write-evaluator.service.ts:127-130` |
| T-4 | That Memory reached the model only if 4-slot lexical retrieval picked it, as untrusted `<user_memory_context>` data. It was neither reliable nor authoritative. | `memory-retriever.service.ts` |
| T-5 | The Behavioral Runtime guidance is one static Text v1 string. The orchestrator always sends `locale: 'und'`. | `behavioral-response-policy.service.ts`, orchestrator |
| T-6 | There is ONE guidance renderer, `composeServerGuidance`. It is used by both adapters. `behavioralGuidance` (+ Safety) is counted in the QIR-004 Mandatory Core. | `model-router.types.ts`, `integrated-context-budget-assembler.service.ts:188-195` |
| T-7 | Memory commands commit with their reply in one transaction (0152 v2). Only ALLOW turns are eligible. BLOCK short-circuits first. Any throw before the router fails the turn with zero provider calls. | orchestrator `:164-195`, `:553-557` |
| T-8 | Background capture runs `evaluateAndWriteMemory`. A TypeScript guard skips Memory commands. The DB writer `background_record_memory_v1` skips turns that have a committed Memory command row. Its body is pinned by `verify-migration-0152`. | `background-intelligence-enrichment.service.ts:118`, 0152 |
| T-9 | There is no version/CAS settings precedent. `activity_preferences` (0136) writes the whole row and the last write wins. `understanding_private` (0126) has the `expected_version → STALE` style. | 0136, 0126 |
| T-10 | Export (`build_personal_export_v1`, 0130) is not redefined anywhere. Erasure covers later tables through `REFERENCES public.users ON DELETE CASCADE`. | 0130, 0136 |
| T-11 | Settings group «قنديل والمحادثة» / QANDEEL & Conversation holds only the system Language row. Settings pages are a state of the ONE destination. | `SettingsSurface.tsx` |
| T-12 | Shared and Public replies are composed by their own builders. Both render the fixed `TEXT_V1_BEHAVIORAL_GUIDANCE` constant and carry no Personal context (§1.3). | `shared-conversation-model-input.ts`, `public-qandeel-model-input.ts` |

### 1.2 Change boundaries (what this task touches, and what it does not)

**It touches:**
- one new migration (`0153`);
- one new API module (`interaction-preferences/`);
- the orchestrator: one command branch and one bounded read;
- the Behavioral Runtime policy: an optional preference input;
- the conversation repository: one finalization call;
- the evaluator: the two templates are removed;
- the retriever: one type filter;
- the background guard: one line;
- mobile: one row, one page, one controller, one transport and the runtime wiring;
- export: one section;
- CI and package wiring for the verifier.

**It does not touch:**
- any historical migration (`0001`–`0152` are byte-unchanged);
- any Memory function or table;
- HIM / QHIA identity or order;
- the QIR-004 constants;
- the Model Router or its adapters;
- Safety;
- Shared and Public builders;
- the W3-MEGA-S Language row (app UI language is not reply language);
- the Project Map and the Roadmap.

### 1.3 Shared / Public assessment (D-SP Option A)

**Shared World.**
- The frozen contract admits private Personal context into a Shared QANDEEL call only as `PRIVATE_REASONING_ONLY_CONTEXT`
  under a just-in-time `STANDING_CONTEXT_GRANT` (CW2-02 §16–§18, invariant B12).
- That path is unimplemented and is owned by `QAN-BL-CW-02` / `SHARED-CTX-01`. Its scope is exactly "whether a participant's
  private Personal context can influence what QANDEEL says to other people in a Shared World".
- A style preference is also a poor fit for a grant made "for QANDEEL reasoning": it would change what every other
  participant receives.
- **Disposition:** not integrated. It is covered by `QAN-BL-CW-02` after the anti-duplication check, so no new item is
  needed; a reconciliation note is added there (§9).

**Public World.**
- CW2-04 §21 says the Public reply "may not use: Personal context".
- CW2-04 §22 says "The invoking user's private QANDEEL history does not enrich that response."
- No exception path exists.
- **Disposition:** not integrated, and no item covers it. `QAN-BL-IP-01` is admitted with a named future owner (§9).

**Structural proof that no private data enters either input:**
- `interaction-preferences.isolation.spec.ts`: no Shared, Public or Connected Worlds source reaches the preference
  authority or the per-owner policy, and both builders keep rendering the fixed Text v1 constant.
- The Personal consumption spec: the preference appears only in the Personal Behavioral Runtime guidance.

**IP-IMP-01 does not claim all-world coverage.** Interaction Preferences shape Personal-world replies only.

**P1 §8.1 ("Relationship style is not a Settings group … not through dozens of toggles") is reconciled, not
contradicted:**
- this is ONE row inside the existing QANDEEL & Conversation group;
- it opens four closed choices, each defaulting to Automatic;
- this is exactly the Product Owner's later IP-01..IP-10 decision.

### 1.4 Kickoff census (BG-05)

**NONE.** No backlog item names IP-IMP-01 as owner, re-checked at closure.

Neighbouring items are cited and left unchanged:
- `QAN-BL-CW-02` — Shared private context;
- `QAN-BL-PRIV-01/02/03` — other export omissions, owned by `PRIV-EXPORT-01`; the Interaction Preferences section is not
  one of them, because this contract requires it (WP6);
- `QAN-BL-PROD-06` — the hosted catch-up;
- `QAN-BL-CW-05` — Stage 8A owner precedent.

None is re-owned.

---

## 2. Design decisions (all inside the approved contract)

| # | Decision | Why |
| --- | --- | --- |
| DD-1 | One row per owner; four closed text columns, each defaulting to `DEFAULT`; `version` (no row = version 0); CHECK on every value. | contract WP1 |
| DD-2 | ONE write core for all three entry points. One field per call, under the owner's advisory lock. A value already held → `UNCHANGED`, which makes a replay idempotent. A different value under an unread version → `STALE`, which changes nothing. Otherwise → `SAVED`, version + 1. `DEFAULT` is the reset. | atomic single-field CAS, idempotent replay, "a stale command cannot overwrite a newer value" |
| DD-3 | Settings and legacy review are `auth.uid()`-only owner commands: SECURITY INVOKER `public` pass-throughs to SECURITY DEFINER functions in a non-exposed schema. The conversation command is `service_role`-only, with an explicit owner bound to a GENERATING turn. No client-supplied user id reaches authority. | server-side authorization only |
| DD-4 | Durable commands use a closed, deterministic, whole-message grammar: an explicit durable marker («دايمًا», «من هنا ورايح», «بعد كده», "always", "from now on", …) plus a named field/value, or an explicit reset naming the field and Automatic. Not a command: questions, negations, longer messages, unknown varieties («بالعربي»), temporal-only markers («المرة دي», «دلوقتي», "this time"). | no extra LLM classifier; no inference; temporary requests never stored (C-1) |
| DD-5 | A command is eligible on ALLOW only. It is answered from the record in ONE transaction with its reply for the committed outcome; the reply copy is in §8. A GUIDED turn keeps Safety's provider path and stores nothing. BLOCK short-circuits first. | Safety BLOCK and GUIDED respected; no success acknowledgement for a failed or stale command |
| DD-6 | **Defect D-1 is fixed, not deferred.** No evaluator template produces `INTERACTION_PREFERENCE` any more, and the background TypeScript guard also skips command turns. The Memory type stays for the owner's existing rows. | C-1; "a permanent request writes only to the canonical record" |
| DD-7 | A legacy `INTERACTION_PREFERENCE` Memory is filtered out of the model's Memory context. It stays listed, exported, correctable and forgettable. | "old Memory must never override or revive a revoked preference" |
| DD-8 | The per-turn read is launched beside the existing lanes and joined before the Behavioral Runtime renders. A failed or malformed read rejects, which fails the turn closed with zero provider calls. An absent row is the legitimate DEFAULT. | WP4 fail-closed |
| DD-9 | Compiled guidance is appended to Text v1 inside `behavioralGuidance`, so it sits in the Mandatory Core through the ONE `composeServerGuidance` with exact UTF-8 accounting. The order is fixed: length, language, humour, explanation. All-DEFAULT without GUIDED is byte-identical Text v1. The block states the precedence: Safety and the current explicit request come first; the preference overrides the model's own inference, including inference from user memory context (R2-02, §11). | WP4 rendering and precedence |
| DD-10 | `WELCOME` permits humour and "never force a joke". `DECLINED` forbids humour. **Every** GUIDED turn suspends humour whatever the preference, `DEFAULT` included (P6 / `HUMOUR_SUSPENDED_SAFETY`), through one Safety-sourced line after the preference block (R2-01, §11). | WP4 |
| DD-11 | Legacy review offers only the owner's ACTIVE, unexpired, SELF `INTERACTION_PREFERENCE` Memories that the same grammar maps to an approved value not already held. The server derives the value from the Memory; the DB re-validates the Memory at commit (FOR SHARE) and never changes it. Skip is client-side. An empty list is legitimate. | WP3, SELF-only, no backfill |
| DD-12 | No command log table and no change to `background_record_memory_v1`. Its body is pinned by verify-0152, and a preference command writes no Memory, so the TypeScript guard plus the removed templates suffice. The writable Memory set is unchanged. | simplicity; MEM-AR-01 unchanged |

---

## 3. What was built, per work package

**WP1 — the record (migration `0153`):**
- `public.interaction_preferences` with RLS, an owner-only SELECT policy, no client write, and cascade erasure;
- `interaction_preference_private.apply_v1` (the core, executable by no application role);
- `set_own_interaction_preference_v1`;
- `apply_own_legacy_interaction_preference_v1`;
- `server_finalize_interaction_preference_turn_v1`;
- the export section;
- deploy-time self-assertions.

The verifier is `database/verify-migration-0153.mjs`; the package script is `verify:interaction-preferences:integration`;
the API CI step runs after MEM-AR-01C; the focused group is `ip-imp-01`; `database/README.md` has a new section.

**WP2 — conversation commands:**
- `interaction-preference-command.interpreter.ts` (the grammar);
- `interaction-preference.copy.ts` (replies);
- `InteractionPreferencesService.planCommand`;
- `ConversationRepository.finalizeInteractionPreferenceTurn`;
- the orchestrator branch before Memory control;
- the evaluator templates removed;
- the background guard.

**WP3 — legacy review:** `GET` / `POST /interaction-preferences/legacy-review`, plus the DB re-validation.

**WP4 — consumption:**
- `interaction-preference-guidance.ts` (the compiler);
- `BehavioralResponsePolicy.buildTextGuidance(interaction?)`;
- the orchestrator's bounded read and join;
- the retriever filter.

**WP5 — Settings:**
- the «تفضيلات التعامل» row in QANDEEL & Conversation, drawn only with its controller;
- the page: four radio groups; direct commit; a PENDING state with `busy` and `disabled`, in which the confirmed value
  stays checked; the server's answer announced once; the load failure (pressing it reads again); the review section;
- the controller (single-flight, generation-bound);
- the strict transport;
- the vocabulary;
- the approved copy;
- runtime and composition wiring.

**WP6 — privacy:**
- the export section in readable words;
- erasure through the cascade;
- no content in telemetry or logs: engine spans carry only the name `interaction_preferences`, and no log line contains a
  value.

**WP7 — verification:** §4.

---

## 4. Verification — the contract's 15 structural coverage items

All tests use synthetic fixtures and a deterministic Model Router double that asserts on the normalized request. There is
no paid model evaluation.

| # | Item | Proof |
| --- | --- | --- |
| 1 | every legal value, DEFAULT, invalid | `verify-0153` (all 12 non-DEFAULT values, resets, 22023 refusals, 23514 CHECKs); `interaction-preferences.service.spec`; interpreter spec (7 dialects AR+EN); mobile strict decoder |
| 2 | owner isolation, RLS, anon refusal | `verify-0153` isolation stage (RLS row visibility, 42501 for direct writes, the core, anon, a missing `auth.uid()`) |
| 3 | conversation ≡ Settings | `verify-0153` equivalence stage (same core, identical record, outcome and version); same value vocabulary and labels |
| 4 | permanent vs temporary | route spec PROOF 1 / PROOF 2; interpreter spec (26 non-commands); evaluator spec |
| 5 | change, reset, replay, stale, concurrent devices, failed commit | `verify-0153` (CAS, replay = no row, two-connection race → SAVED + STALE, injected failure leaves nothing); route spec (stale reply, reset, idempotency-key replay, failed command → FAILED turn, no reply); mobile (STALE / FAILED never shown saved) |
| 6 | no duplicate legacy `INTERACTION_PREFERENCE` writes | evaluator spec (8 forms → SKIP); route spec (no Memory, no background record, on delivery and on replay) |
| 7 | legacy review: SELF / OTHER / UNATTRIBUTED, stale candidate, conflicting choice | `verify-0153` legacy stage (+ forgotten, expired, another type, another account; the Memory is never changed); service spec; mobile Apply / Replace / Skip / empty |
| 8 | no revival through Memory retrieval | retriever spec (legacy rows never selected) |
| 9 | canonical read each eligible generation; failure → zero provider calls | consumption spec (read on ALLOW and GUIDED, none on BLOCK; upstream failure, unknown value and two rows → 503, `failTurn`, router never called) |
| 10 | Safety precedence, current-turn precedence, no classifier, single provider call | consumption spec (GUIDED suspension on every GUIDED turn including all-DEFAULT, safety after the block, temporary request in history plus the precedence line, `generate` called exactly once); the grammar is closed and deterministic |
| 11 | QIR-004 budget, Mandatory Core, lane isolation | consumption spec: the block's exact UTF-8 bytes join `mandatoryCoreBytes`; the accounting identity holds; the source decisions are unchanged |
| 12 | AR/EN copy, RTL/LTR, a11y, navigation | `settings/__tests__/interaction-preferences.test.tsx` (19 tests); `w3-settings-appearance-signout` re-anchor |
| 13 | export and deletion | `verify-0153` (readable words, absent = automatic, no identifier, governed erasure leaves 0 rows) |
| 14 | no privacy leakage into Shared / Public | `interaction-preferences.isolation.spec`; consumption spec (no value outside the guidance) |
| 15 | compatibility with 0152 and later invariants | full API-CI database leg on a fresh PostgreSQL 17 with `0001`–`0153`: 124 pass. The only failures are environmental (no Redis / `psql` locally); the 0133 privilege census was re-run as SQL |

### 4.1 Commands and results (local, on the implementation tree)

**Unit, route and contract tests:**

| Command | Result |
| --- | --- |
| `npx jest src/interaction-preferences` (api) | 117 pass |
| `npx jest src/post-response-intelligence/interaction-preference-command.route.spec.ts` | 12 pass |
| `npx jest src/conversation/conversation-interaction-preferences.spec.ts` | 12 pass |
| `npm run test:api` | 241 suites, **5595 / 5595 pass** |
| `npx tsc --noEmit` (api) | clean |
| `npx tsc --noEmit` (mobile) | clean |
| `npm run lint:mobile` | 0 errors |
| `npx jest --ci src/settings src/runtime-entry/__tests__/scope.test.ts src/integration/__tests__/w3-settings-appearance-signout.test.tsx` (mobile) | 188 pass |
| `npx jest --ci` (mobile, whole) | 2402 pass, 8 fail: the 6 locale-baseline failures in `depth` / `w2-account-access` (identical on `3bec87ac`, verified by stash) and `runtime-entry/scope` (2), since re-anchored and passing |
| `node --test tests/*.test.mjs` | **1341 pass, 0 fail** (incl. the forward-safety mirror and `test:task-closure-governance-contract`) |
| `node --test database/tests/verifier-hazard-contract-v1.test.mjs database/tests/memory-authority-surface-v1.test.mjs` | 57 pass |

**Database verification (local PostgreSQL 17):**

| Command | Result |
| --- | --- |
| `DATABASE_URL=… node database/verify-migration-0153.mjs` | verified, twice on the same database, no residue |
| API-CI database leg (fresh `0001`–`0153`) | 124 pass / 5 env-only |

The five environment-only failures are:
- `REDIS_URL` absent: 4, of which 2 are the e2e smokes that now compile with the real preference read added;
- `psql` absent: 1, the 0133 drift scratch.

**Focused DB workflow (`focused-database-verification.yml`, selector `ip-imp-01`, two consecutive green runs on one SHA):**
see §10 (filled after push).

### 4.2 Re-anchors (validation only, no product change)

- `w3-settings-appearance-signout.test.tsx`: one row added to the exact control list.
- `runtime-entry/__tests__/scope.test.ts`: the barrel gained exactly one transport class.
- `integrated-context-budget-conflict-resolution-v1-contract.test.mjs`: the "assembled twice" mutation anchor moved to the
  preference join line.
- Seven orchestrator construction sites gained the new positional dependency; the Memory-command route specs pass it as
  `untouchable`, proving a Memory command never touches the record.
- Two e2e runtime scripts gained the real preference service, and the smoke adapter may SELECT `interaction_preferences`.

---

## 5. What is proven structurally vs what waits for Stage 8A / 8B

- **Proven structurally here:**
  - the record and its semantics;
  - the command path;
  - consumption, meaning the exact instruction lines in the ONE provider request at the right authority level;
  - fail-closed behaviour;
  - isolation;
  - export and erasure;
  - the Settings UI.
- **Not proven here, by design:** whether a real model *follows* the lines well. This covers dialect fidelity for all
  seven varieties, brevity, humour judgement and explanation style. It is the Golden Conversations / real dialect
  evaluation of **Stage 8A**, admitted as `QAN-BL-IP-02` so it does not live only in this record. All seven dialects stay
  as approved candidates; none is removed.
- **Stage 8B (voice):** prosody, pauses, interruptions. Out of scope.

## 6. Failure classification (this task)

| Failure | Class | Disposition |
| --- | --- | --- |
| Six mobile locale tests (`depth`, `w2-account-access`) | baseline (pre-existing on `3bec87ac`) | none |
| Redis / `psql` absent locally | environment | CI runs them |
| AppModule pins (5 contracts) | own regression, caught | fixed (the module is composed through `ConversationModule`) |
| Barrel scope, JSX pin, deep import | own regression, caught | fixed / re-anchored (§4.2) |
| verify-0153 fixture | own test defect | fixed: the 0152 guard forbids attributing an already-forgotten or expired Memory |

## 7. Open risks and owned deferrals

- **R-1 (grammar coverage).** A durable request phrased outside the closed grammar is not a command. It is honoured in
  that conversation only and stored nowhere, which is the safe direction. The owner can always use Settings. Wider
  phrasing needs a Product decision, never inference.
- **R-2 (explicit Memory request).** «افتكر إني بحب الردود المختصرة» remains an explicit Memory request under MEM-AR-01. It
  is never typed `INTERACTION_PREFERENCE` and is not the preference authority.
- **R-3 (GUIDED turns).** A durable command on a GUIDED turn stores nothing and takes the provider path. The model could
  phrase agreement; Safety governs that turn.
- **R-4 (deployment order).** API and migration must ship together: the new API fails closed (no provider call) against a
  database without `0153`. `QAN-BL-PROD-06` owns the hosted catch-up.
- **Owned deferrals:**
  - Public → `QAN-BL-IP-01`;
  - Shared → `QAN-BL-CW-02` (existing);
  - real-model quality → `QAN-BL-IP-02` (Stage 8A).

## 8. PO Copy Addendum

**APPROVED (verbatim from the contract's table):** every Settings string and all three result messages, in AR and EN.

**APPROVED by the Product Owner (R2 approval, 2026-10-12)** — CA-1 as written; CA-2 in its R2-corrected wording (§11):

| # | Where | AR | EN |
| --- | --- | --- | --- |
| CA-1 | conversation command reply, composed only of approved strings: `<result message> <field label>: <value label>.` | «تم حفظ التفضيل. اللغة واللهجة: مصري.» / «تمت إعادة التفضيل إلى تلقائي. اللغة واللهجة: تلقائي.» / STALE: «لم يُحفظ التغيير. حاول مرة أخرى.» | "Preference saved. Reply Language & Dialect: Egyptian Arabic." / "Preference reset to Automatic. Humour: Automatic." / "Your change wasn't saved. Try again." |
| CA-2 | model-facing directive texts (never shown to the user; R2 wording) | — | header: "Standing interaction preferences the user explicitly chose. Apply them to this reply. An explicit request the user makes in the current conversation takes precedence for what it asks, and safety guidance always takes precedence. They take precedence over anything inferred from the conversation or from user memory context."; lines: "- Reply length: keep the reply brief.", "- Reply language: reply in <Egyptian Arabic \| Modern Standard Arabic \| Levantine Arabic \| Gulf Arabic \| Maghrebi Arabic \| English>.", "- Humour: light humour is welcome where it fits naturally; never force a joke." / "- Humour: do not use humour." / (every GUIDED turn, own line after the block) "This turn carries safety guidance: do not use humour or playfulness in this reply.", "- Explanation style: explain in simpler terms." / "get to the point directly." / "explain in simple terms and get to the point directly." |

## 9. Closing change (BG-08 / BG-09)

- **Inherited items (BG-05):** none.
- **Admitted, both after an anti-duplication run against the whole register:**
  - `QAN-BL-IP-01` — Personal interaction preferences in the Public World. `MEDIUM`, `DEFERRED — OWNED`, owner
    `PUBLIC-PREF-01 — Public World Personal Interaction Preference Decision` (name APPROVED by the Product Owner, 2026-10-12).
  - `QAN-BL-IP-02` — Interaction Preferences real-model behavioural quality (seven dialects, brevity, humour, explanation).
    `MEDIUM`, `VALIDATION — OPEN`, owner `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`.
- **Reconciliation note:** on `QAN-BL-CW-02` (Shared); owner, scope, severity and status unchanged.
- **Unchanged:** `QAN-BL-PROD-06` current truth. `0153` joins the undeployed hosted catch-up queue with `0150`–`0152`.
- **Banner:** this record's own banner states the true state (implementation complete, PR open, not merged).
- **Gate:** `npm run test:task-closure-governance-contract` passes.

## 10. PR and focused database verification

- **Branch:** `ip/ip-imp-01-interaction-preferences`, from `main @ 3bec87ac725c73db0aecc5a6fb4e01c90acce66b`.
- **PR:** https://github.com/allamqandeel/qandeel/pull/331 (Draft, not merged).
- **Verified SHA:** `be73bdc5c78733e14d9fe2095be261391c6ba3c2`.
  - Its code tree equals `8af35fd9`'s; it adds documentation only.
  - The commit that fills this section also changes documentation only.
- **Focused database gate:** `focused-database-verification.yml`, on PostgreSQL 17.
  - Each run applied all 153 migrations from zero (`0001` .. `0153`).
  - Target: `be73bdc5`.

| Run | Selector | Result |
|---|---|---|
| [38222800258](https://github.com/allamqandeel/qandeel/actions/runs/38222800258) | `migration-0153` | PASS |
| [38222812295](https://github.com/allamqandeel/qandeel/actions/runs/38222812295) | `migration-0153` (second consecutive) | PASS |
| [38223147075](https://github.com/allamqandeel/qandeel/actions/runs/38223147075) | `migration-0130` (personal export; `0153` replaces its builder) | PASS |
| [38223157120](https://github.com/allamqandeel/qandeel/actions/runs/38223157120) | `migration-0132` | PASS |
| [38223165704](https://github.com/allamqandeel/qandeel/actions/runs/38223165704) | `migration-0133` (anon / `PUBLIC` EXECUTE census) | PASS |
| [38223173788](https://github.com/allamqandeel/qandeel/actions/runs/38223173788) | `migration-0152` (MEM-AR-01 writer census and guards) | PASS |
| [38222765317](https://github.com/allamqandeel/qandeel/actions/runs/38222765317) | `pull_request` self-test of the gate (`focused-verifiers.json` changed) | PASS |

- **The `ip-imp-01` group** in `database/focused-verifiers.json` covers `0153`, `0130`, `0132`, `0133` and `0152`.
  - A dispatch reads its mapping from the default branch, so the group can be selected only after merge.
  - Until then, each verifier in the group was dispatched under its own `migration-NNNN` selector (the table above).
- **Nothing hosted:**
  - no migration was applied to the hosted database;
  - nothing was deployed;
  - nothing was merged.

## 11. Independent review R2 — corrections (on top of `be73bdc5`)

**R2-01 — P6 / GUIDED Safety (confirmed defect, fixed).**
- **Defect:** `conversational-personality-v1.md` defines `HUMOUR_SUSPENDED_SAFETY` for *any* GUIDED disposition. The
  compiler only suspended humour under GUIDED when the preference was `WELCOME`; with `DEFAULT` nothing was rendered.
- **Fix:** `interaction-preference-guidance.ts`.
  - Every GUIDED turn now adds one line after the preference block: "This turn carries safety guidance: do not use humour
    or playfulness in this reply."
  - Because it is Safety's constraint, the line sits outside the "the user explicitly chose" header.
  - Under GUIDED, `WELCOME` renders no welcome line; `DECLINED` keeps its own line.
  - No new engine, classifier or provider call is added. The line lives in `behavioralGuidance`, so it is QIR-004
    Mandatory Core at exact UTF-8 bytes.
- **Effect on all-DEFAULT:** without GUIDED the guidance is still byte-identical Text v1. GUIDED with all-DEFAULT is now
  Text v1 + `

` + the suspension line, and both cases are tested.
- **Proof:**
  - `interaction-preference-guidance.spec.ts`: four GUIDED cases (`DEFAULT`, `WELCOME`, `DECLINED`, `DEFAULT` with
    another field), plus the all-DEFAULT with/without GUIDED test.
  - `conversation-interaction-preferences.spec.ts`: the exact GUIDED guidance; GUIDED all-DEFAULT through the real
    orchestrator, with one provider call and Mandatory Core bytes reconciled.
  - Against the pre-fix compiler, 9 of these tests fail.

**R2-02 — Memory is not a parallel preference authority (verified; one sentence made explicit).**
- **Scenario:**
  1. «أنا بحب الهزار» is captured as `STABLE_PREFERENCE` (the evaluator's `بحب` template; MEM-AR-01A).
  2. The owner later sets `HUMOUR=DECLINED`.
  3. The Memory is retrieved on a later turn.
- **What already held structurally:**
  - The Memory is served as "untrusted contextual data" in the optional memory lane, after the Mandatory Core.
  - No path turns a Memory into a directive or into a write to the canonical record. The remark has no durable marker,
    so it is not a command.
  - WP3 offers only `INTERACTION_PREFERENCE` Memories, and only on owner action.
  - `DECLINED` is the only humour directive, in the non-truncatable Mandatory Core.
- **Gap closed:** the header named what comes before the preference (Safety, the current request) but not what comes after
  it. The contract's order is Safety > current explicit request > durable preference > model interpretation, so the header
  now ends with: "They take precedence over anything inferred from the conversation or from user memory context."
  - This wording is part of CA-2, APPROVED by the Product Owner in the R2 approval.
  - No Memory is filtered, edited or deleted, so the owner's data and rights are unchanged.
- **Proof** (`conversation-interaction-preferences.spec.ts`):
  - With `DECLINED` and the retrieved Memory, the provider receives exactly Text v1 + the `DECLINED` block. The Memory is
    served unchanged, after the directive and after the "untrusted contextual data" preamble. The record is only read
    (`finalizeInteractionPreferenceTurn` is never called); one provider call is made.
  - With no declaration, the same Memory produces no humour directive (byte-identical Text v1).

**Focused verification (no full CI re-run, per the review):**
- `jest src/conversation src/interaction-preferences src/post-response-intelligence/interaction-preference-command.route.spec.ts src/brain-eval src/memory`:
  51 suites, 1437/1437.
- API `tsc --noEmit`: clean.
- No migration, SQL or mobile file changed, so the focused database runs on `be73bdc5` remain the database proof.

## 12. Post-merge Governance Reconciliation (GOV-REC-01, 2026-10-12)

Added by `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` (BG-09: recorded explicitly, never a quiet
rewrite). §1–§11 are unchanged. Their "PR open", "Draft, not merged" and "nothing was merged" describe the state before
the merge, and their test results stay tied to the trees and heads they name.

**GitHub truth (read 2026-10-12):**
- [PR #331](https://github.com/allamqandeel/qandeel/pull/331) was MERGED on 2026-10-12 at 09:37 UTC as merge commit
  `424cd0231429e5280a0e70be25c2f83437e117c8`, from the final head `cad6e66ab98dc3d3e69cc84573907d41423d88b3`.
- Migration `0153` is on `main`. It is not applied to the hosted database: `QAN-BL-PROD-06` owns the catch-up.

**Lifecycle:** `CLOSED / MERGED`. This task's own closing change carried the BG-08 half (§9). After the merge, only the
locators had drifted: Current State and the Project Map had no IP-IMP-01 row, and the backlog §9 had no Stage 8A entry for
`QAN-BL-IP-02` and no `PUBLIC-PREF-01` row. GOV-REC-01 adds them (`QAN-BL-GOV-01`, finding 1 and finding 4). No owner,
scope, severity or status changes. `QAN-BL-IP-01` and `QAN-BL-IP-02` stay as admitted.

**Not changed:** the canonical record, the grammar, the Settings surface, the approved copy (CA-1, CA-2) and every Product
decision.
