# QANDEEL — ACE-01 — Adaptive Conversational Expression — Implementation Record v1

**Status:** `ACE-01` — **CLOSED / MERGED through PR #332 as `141a3190deb02bc6695d2ace05da275e623a2754` (2026-10-12); no
migration; NOT DEPLOYED.** The post-merge status is recorded by GOV-REC-01 (2026-10-12, §13). §1–§12 are kept as written
before the merge.

**Status at the closing change (historical, kept verbatim):** `ACE-01` — **IMPLEMENTATION COMPLETE / READY FOR INDEPENDENT REVIEW AND THE PRODUCT OWNER'S MERGE DECISION.**
WP0–WP5 are implemented on one branch, and this record carries the closing change (BG-08 / BG-09). **Not merged**: merge
happens only on «ادمج». No migration was added and nothing is deployed. The independent review's one correction (R1,
temporary language requests) is applied (§11), and the review's CI correction R2 is applied (§12). **Gate B is decided:
Option A — APPROVED** by the Product Owner (2026-10-12, §7). Shared / Public stay unchanged in this task; their parity is
future work under `QAN-BL-ACE-01`, owned by `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision`.

**Authority:** the Product Owner's *ACE-01 — FINAL PRODUCT OWNER APPROVAL & EXECUTION AUTHORIZATION* (2026-10-12) of the
*ACE-01 — Adaptive Conversational Expression v1 — C2 Structural Implementation — Draft Task Contract R0*. It approved the
contract and, with Gate A, the full personality text proposed in that contract's Product Copy Gate. Binding rules:
- one QANDEEL personality, through the existing Behavioral Runtime;
- no Persona / Tone / Personality Engine, no emotion classification, no competing prompt;
- the Interaction Preferences record of PR #331 is kept, including the R2 GUIDED humour suspension;
- Golden Conversations live inside `brain-eval`;
- no paid evaluation or Stage 8A run, and no model selection;
- frozen Shared / Public privacy contracts are respected. A genuine conflict stops at that point alone, with alternatives;
- no change to product decisions or approved texts without approval;
- the PR is allowed. Merge waits for «ادمج». No hosted migration or deployment.

**Baseline:** `main = 424cd0231429e5280a0e70be25c2f83437e117c8` (the merge of PR #331), verified as `origin/main` before
branching. Migrations `0001`–`0153`; ACE-01 adds none.

**Branch:** `ace/ace-01-adaptive-conversational-expression`.

---

## 1. WP0 — repository truth and architecture gate

### 1.1 Matrix

| Area | Frozen Product / design authority | Existing backend runtime at `424cd023` | Already merged implementation | ACE-01 gap |
| --- | --- | --- | --- | --- |
| Personality | conversational-personality-v1 P1–P9 ("ONE QANDEEL PERSONALITY — ADAPTIVE NATURAL EXPRESSION"); the personality lives "in the text of the one behavioural guidance" (§3) | `BehavioralResponsePolicyService.buildTextGuidance` → `behavioralGuidance` → the ONE `composeServerGuidance`, QIR-004 Mandatory Core | the static Text v1 (8 lines); no personality text | **activate the approved core in that same guidance** |
| Preferences | P4; IP-IMP-01 (CA-1 / CA-2 R2 approved copy) | `InteractionPreferencesService.readForTurn`, `compileInteractionPreferenceGuidance`, header precedence, R2 GUIDED suspension | PR #331 / `0153` | **none: reused unchanged** |
| Safety | Safety Response Gate; P6 (`GUIDED` suspends humour; `BLOCK` before any style) | BLOCK short-circuit before any read; GUIDED guidance in the Mandatory Core | yes | none (proved again on the new guidance) |
| Current-turn constraints | P3 / P5 as amended: deterministic rules = authorities and constraints, never tones; the design census lists `locale: 'und'` | `locale: 'und'` hard-coded; providers never render `locale` | none | **conservative locale compiler** (WP2) |
| HIM | QHIA-013, 12 frozen instruction IDs | rendered after the charter, in frozen order | yes | none |
| QIR-004 | Mandatory Core non-truncatable, isolated optional lanes | `IntegratedContextBudgetAssemblerService` | yes | none (byte accounting re-proved) |
| Evaluation | P8; personality record §7 (Decision 5: a second named suite through the same validator / harness / scripts) | `brain-eval` validator (20–30), harness, blinded review, CLI | Bake-off suite, 24 cases, never run | **Golden Conversations suite** (WP3) |
| Shared / Public | S4-02 ("the frozen Behavioral Response Policy, unchanged"; pinned by `tests/s4-02-shared-conversation-material-contract.test.mjs`); CW2-04 §21–§22 / S5-04 | both assemblers import `TEXT_V1_BEHAVIORAL_GUIDANCE` directly | yes | **Gate B: Option A APPROVED (§7)**; unchanged here, future work `ACE-SP-01` |

### 1.2 Every path that reads `TEXT_V1_BEHAVIORAL_GUIDANCE`

| Path | Consumer | ACE-01 effect |
| --- | --- | --- |
| Personal conversation | `BehavioralResponsePolicyService.buildTextGuidance` (orchestrator) | now Text v2 = Text v1 + personality core |
| `brain-eval` | `buildTextGuidance()` (validator, harness) | follows production: Text v2 |
| Shared World | `shared-conversation-model-input.ts` (`${TEXT_V1}\n${SHARED_CONVERSATION_FRAME}`) | **byte-identical** |
| Public World @qandeel | `public-qandeel-model-input.ts` (`${TEXT_V1}\n${PUBLIC_QANDEEL_FRAME}`) | **byte-identical** |

The smallest safe way to reuse one personality was to keep Text v1 as the one shared constant and version the Personal
guidance as Text v2 = Text v1 + the core. Text v1 keeps every frozen obligation. Shared and Public keep the exact bytes
their frozen contracts pin. The core exists once in the codebase, so no second definition can drift.

### 1.3 Anti-duplication

ACE-01 reimplements none of these:
- CI-01: the design, the scenario list and the baseline census;
- IP-IMP-01: the record, the commands, the compiler, the R2 suspension, the Memory filtering and the precedence header.

`interpretExplicitReplyLanguageRequest` reuses the IP-IMP-01 language verbs and varieties and its normalizer, so ACE-01 adds
no second language vocabulary. After review R1 it also accepts a bounded set of natural temporary request forms (§11). It
never feeds the durable command grammar, which is unchanged.

ACE-01 does not touch `QAN-BL-CW-02`, `QAN-BL-IP-01` or `QAN-BL-IP-02` (§9).

### 1.4 Kickoff census (BG-05)

**NONE.** No backlog item names ACE-01 as owner. Re-checked at closure.

These neighbouring items are cited and left unchanged:
- `QAN-BL-IP-01`: Personal preferences in Public;
- `QAN-BL-IP-02`: preference-following quality, Stage 8A;
- `QAN-BL-CW-02`: Shared private context;
- `QAN-BL-CW-05`: the Stage 8A owner precedent;
- `QAN-BL-VOICE-01`: the voice runtime. Audio expression is Stage 8B.

---

## 2. Design decisions (inside the approved contract)

| # | Decision | Why |
| --- | --- | --- |
| DD-1 | **Additive versioning.** `TEXT_V1_BEHAVIORAL_GUIDANCE` stays byte-identical. `QANDEEL_PERSONALITY_CORE_V1` holds the approved wording. `TEXT_V2_BEHAVIORAL_GUIDANCE = Text v1 + "\n\n" + core` is the Personal baseline, and `buildTextGuidance` returns it, followed by the compiled preferences as before. | Used as a replacement, the approved core would drop frozen v1 obligations it does not restate: provider / model / routing identity non-disclosure, observations worded apart from facts, no invented identity facts, excessive disclaimers. The approved note says "Preserve all higher-priority instructions". Shared / Public keep Text v1 (§1.2). |
| DD-2 | The core is the eight model-facing paragraphs of the R0 Copy Gate candidate, verbatim. The ninth sentence ("This wording is a draft, not frozen authority. Preserve all higher-priority instructions and existing R2 safety constraints.") is an engineering note to the implementer and is **not** sent to the model. | It addresses the implementer, not QANDEEL. Sending "this wording is a draft" to the model would be meaningless. *(Reviewer check: if the Product Owner meant it as model text, adding it is a one-line, copy-approved change.)* |
| DD-3 | **No new directive string.** Temporary current-turn requests (brevity, more detail, simpler, direct, «من غير هزار») are honoured by the model under approved copy: the core's "respecting safety, explicit current requests and durable interaction preferences", "go deeper when the user asks", and the CA-2 header ("An explicit request … takes precedence for what it asks"). The current user message reaches the model intact in the Mandatory Core. No deterministic "for this reply" line is rendered. | Every new model-facing string needs Product Copy Gate approval (contract §4), and only the core was approved. A keyword-driven temporary directive would also come close to the forbidden trigger-word lock. The durable `DECLINED` preference and GUIDED Safety remain deterministic hard lines (IP-IMP-01). |
| DD-4 | **The locale compiler** (`conversation-turn-locale.ts`, pure). An explicit whole-message language request (IP-IMP-01 grammar, with or without a durable marker) wins. Next comes the durable `replyLanguage`: `ENGLISH` → `en`, any Arabic variety → `ar`. Next comes a conservative script indication: core Arabic letters only (≥ 3) → `ar`, ASCII letters only (≥ 3, no Arabizi digit-letter adjacency) → `en`. Everything else is `und`: mixed scripts, Persian / Urdu letters, accented Latin, other scripts, too few letters. The type stays `ar \| en \| und`. | WP2. A language, never a dialect. `locale` is request metadata that no provider adapter renders, so it changes no model-facing text. |
| DD-5 | **No first-contact signal.** The contract made it optional ("may"), and rendering one would be a new directive string. The two continuity guards (v1 line 8 and core line 8) already forbid invented familiarity. No history query is added, and the frozen Welcome copy is untouched. | WP2 "turn position"; WP4 item 9. |
| DD-6 | **Disagreement and humour initiative belong to the core text**: core lines 6 and 7, the standing permission stated once. No keyword switch, no directive. | P6 / P7; WP2 "humour and disagreement". |
| DD-7 | **Golden Conversations** is the second named suite (`golden-conversations`) of the existing system. The registry is `brain-eval.suites.ts`, the CLI takes an optional suite argument, and the default stays `brain-bakeoff`. The validator's 20–30 bound is unchanged. `validateGoldenConversationSuite` adds the Golden structural truths. The rubric is the nine shared dimensions plus the four approved style dimensions. The blinded review adds `styleFocus`, the applied authority (declared preferences, safety GUIDED) and the explicit `unfitRegisterFail` mark. The summary counts FAIL marks. | WP3; personality record §7.2. |
| DD-8 | **22 cases** from the 20 approved scenarios. Scenario 18 ("each shift scored") is split into its three shifts, because one case scores one reply. Scenarios 13 and 19 carry **canonical** preference values, rendered exactly as production renders them; the old dialogue line is not used. Scenario 14 is GUIDED by the production Safety gate, which the validator proves. Every case's locale must equal the production locale. | "Golden scenarios referencing durable preferences must represent genuine canonical preference authority". |

---

## 3. Product Copy Gate

- **Approved and implemented, verbatim:** the eight-paragraph core in `QANDEEL_PERSONALITY_CORE_V1`. It is pinned byte for
  byte by `behavioral-response-policy.service.spec.ts` and by the static contract.
- **New model-facing directive strings:** none.
- **New user-facing Arabic or English copy:** none.
- **Reused approved copy, unchanged:** Text v1, the IP-IMP-01 CA-2 header and lines, and the R2 Safety humour-suspension line.
- **Golden scenario wording:** the approved synthetic scenarios of the personality record §7.3, kept as written. Synthetic
  assistant turns scaffold the multi-turn cases. This is evaluation material, never product copy.

---

## 4. What was built, per work package

- **WP1:** `behavioral-response-policy.service.ts` (Text v2, the core); the types comment; the orchestrator comment.
- **WP2:**
  - `conversation-turn-locale.ts` (new, pure);
  - `interpretExplicitReplyLanguageRequest` in the IP-IMP-01 interpreter (additive; widened by review R1, §11);
  - the orchestrator computes `locale` after the preference join and passes it to the ONE QIR-004 assembly.
- **WP3:**
  - `brain-eval.types.ts`: `STYLE_FOCUS`, optional case fields, the Golden rubric;
  - `brain-eval.golden.suite.ts` (new);
  - `brain-eval.suites.ts` (new);
  - `validateGoldenConversationSuite`;
  - harness: per-case production guidance and Safety guidance, rubric-parameterized review, artifact directory;
  - summary: unfit-register counts;
  - CLI: an optional suite argument;
  - Golden artifacts under the git-ignored `artifacts/evals/golden-conversations/`.
- **WP4:** `ace-01-adaptive-conversational-expression.spec.ts`, `conversation-turn-locale.spec.ts`,
  `brain-eval.golden.spec.ts` and `tests/ace-01-adaptive-conversational-expression-contract.test.mjs`, with its npm script
  and API CI step.
- **Re-anchors (validation only):**
  - `behavioral-response-policy.service.spec.ts` now pins v1, the core and v2;
  - the IP-IMP-01 guidance and orchestrator specs now expect the Personal guidance to be Text v2 (`TEXT_V1` → `TEXT_V2`).
    Their preference and R2 assertions are unchanged, and one locale expectation moved from `und` to `ar`;
  - `tests/integrated-context-budget-conflict-resolution-v1-contract.test.mjs` now pins the carried-through
    `locale, modality: 'TEXT',` instead of the literal `'und'`.
- **WP5:** this record and the backlog closing change.

---

## 5. Verification — the contract's 15 structural items

| # | Item | Proof |
| --- | --- | --- |
| 1 | One stable personality core | ACE spec (1); policy spec (core verbatim, once); static contract |
| 2 | No extra provider request or LLM classifier | ACE spec (2)(10): one `generate` per turn, identical request keys; static: one `this.router.generate(` |
| 3 | Safety BLOCK provider-free | ACE spec (3); IP spec BLOCK |
| 4 | GUIDED suppresses humour for all preference values | ACE spec (4): 3 humour × 2 length values, all-DEFAULT included |
| 5 | Explicit current request outranks durable | ACE spec (5): locale `en` over durable Egyptian; precedence copy present; message intact; no write; durable renders next turn |
| 6 | Memory never becomes style authority | ACE spec (6); IP spec R2-02 (×2) |
| 7 | No stored emotional / personality inference | ACE spec (7): the only write is the ordinary finalization, field set pinned |
| 8 | Conservative language indication | locale spec (Arabic, English, mixed, Arabizi, Persian, accented, other script, short, empty); ACE spec (8) end to end |
| 9 | First session invents no familiarity | ACE spec (9) |
| 10 | Model keeps the register | ACE spec (2)(10): byte-identical guidance for sad / joking / pressured / conflict messages |
| 11 | Current message + Mandatory Core intact | ACE spec (11)(12); IP spec |
| 12 | Exact UTF-8 accounting, isolated lanes | ACE spec (11)(12): `mandatoryCoreBytes`, `finalTextBytes` identities; Memory lane whole |
| 13 | Frozen HIM ordering / identity / meaning | ACE spec (13): HIM rendering after the guidance is byte-identical to before; IDs never rendered |
| 14 | Shared / Public privacy and frozen authority | ACE spec (14); static contract; `shared-world-conversation.spec.ts`; `interaction-preferences.isolation.spec.ts` |
| 15 | Original suite preserved; Golden validates with zero calls | Golden spec (suite / rubric SHA-256 pinned; `fetch` spy never called); `npm run eval:brain:validate` and `eval:brain:dry-run -- golden-conversations` |

### 5.1 Commands and results (local, implementation tree)

- `npx tsc --noEmit -p apps/api/tsconfig.json`: clean.
- Focused jest:
  - `src/conversation`, `src/interaction-preferences`, `src/brain-eval`, `src/shared-world`, `src/public-world`;
  - plus the HIM regression gate, the QIR-004 assembler and `src/model-router`.
  - Results in §10.
- Static contracts that read any changed file (23 files) plus the ACE-01 contract: results in §10.
- `npm run eval:brain:validate`: brain-bakeoff, 24 cases (12 FAST / 12 DEEP), 48 planned, ZERO CALLS.
- `npm run eval:brain:dry-run -- golden-conversations`: 22 cases (12 FAST / 10 DEEP), 44 planned, ZERO CALLS.
- `npm run test:task-closure-governance-contract`: §10.

---

## 6. Proven structurally vs waiting for Stage 8A / 8B

**Proven structurally, with a deterministic router double on the real normalized request:**
- the core reaches every Personal request once, inside the Mandatory Core, in exact bytes;
- no tone is selected: guidance is byte-identical whatever the message's mood;
- one provider call per turn, and BLOCK makes none;
- GUIDED suspends humour for every preference value;
- the preference and explicit-request precedence is stated in approved copy, and the request carries the user message intact;
- Memory is never style authority;
- nothing emotional is stored;
- the locale is conservative and dialect-free;
- no invented familiarity text;
- HIM and QIR-004 are unchanged;
- Shared / Public are byte-identical;
- the Golden suite validates with zero provider calls.

**Waiting for Stage 8A (real model, `QAN-BL-ACE-02`; preference following stays `QAN-BL-IP-02`):**
- whether a real model actually sounds natural and consistent, and fits the register;
- whether its humour initiative is fitting and absent where it must be;
- whether it drops lightness at once and its empathy avoids canned phrases;
- whether it is brief, disagrees respectfully, follows dialects and handles multi-turn transitions;
- whether it honours an explicit temporary request without a deterministic directive (DD-3);
- the FAIL rate on negative controls.

No quality score is recorded or implied.

**Stage 8B:** audio expression, prosody and interruption (`QAN-BL-VOICE-01`).

---

## 7. Gate B — the one Product Owner decision (Shared / Public)

**Verified conflict:**
- Shared and Public QANDEEL build their model input from `TEXT_V1_BEHAVIORAL_GUIDANCE` under frozen contracts. S4-02 says
  "consumed as they are", and its static contract asserts "the frozen Behavioral Response Policy, unchanged". CW2-04 §21–§22
  and S5-04 cover Public.
- Giving those worlds the personality core is a behavioural amendment to frozen Connected Worlds model inputs.
- The core also names "durable interaction preferences", which have no authority in a Shared or Public reply
  (`QAN-BL-CW-02`, `QAN-BL-IP-01`). Sent as written, that clause would be inert or misleading.

ACE-01 therefore changed nothing there. The alternatives are:

| Option | What it means | Copy / authority needed |
| --- | --- | --- |
| **A (recommended)** | Personal now (done). Shared / Public parity is decided later under `QAN-BL-ACE-01`, by a narrow controlled amendment of S4-02 and CW2-04 / S5-04. | A world-neutral core variant without the preference clause (new copy) and the two frozen-record amendments |
| B | Amend the frozen records now and send the core as written to Shared / Public. | Two frozen-record amendments; it accepts an inert preference clause in group and public replies |
| C | Keep the personality core Personal-only by Product decision. `QAN-BL-ACE-01` would then be closed as decided, not done. | None |

Nothing in Shared / Public changes until the Product Owner chooses. No world's permissions changed.

**Product Owner decision (2026-10-12): Gate B — Option A — APPROVED.** The Product Owner also approved the future task's
name: `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision`. Consequences:
- ACE-01 leaves Shared / Public model inputs byte-identical (frozen Text v1 + their frames, no core, no Personal data,
  `locale: 'und'`). This is pinned by ACE spec item 14 and the ACE static contract.
- The future work stays `QAN-BL-ACE-01` (`DEFERRED — OWNED`), owned by `ACE-SP-01`. It needs a world-neutral core
  variant without the preference clause, which needs its own Product Copy Gate, plus narrow controlled amendments of S4-02
  and CW2-04 / S5-04 before any code.
- `ACE-SP-01` is not implemented now and is not authorized by this decision (BG-07).

---

## 8. Open risks and owned deferrals

- **R-1:** Text v2 has some redundancy between the v1 lines and the core, for example concision, one question and canned
  empathy (DD-1). A later copy decision may consolidate them. Until then nothing frozen is lost.
- **R-2:** the explicit temporary requests in DD-3 are model-honoured. If Stage 8A shows a real model under-honours them, a
  copy-gated deterministic line can be added through the existing compiler.
- **R-3:** the locale is metadata only. It becomes behaviour-relevant only when an adapter consumes it (for example voice,
  Stage 8B).
- **Owned deferrals:** `QAN-BL-ACE-01` (Gate B) and `QAN-BL-ACE-02` (Stage 8A), §9.

---

## 9. Closing change (BG-08 / BG-09)

- **Inherited items (BG-05):** none.
- **Admitted, both after an anti-duplication run against the whole register:**
  - **`QAN-BL-ACE-01`:** the Shared / Public QANDEEL personality core decision. `MEDIUM`, `DEFERRED — OWNED`. Owner
    `ACE-SP-01 — Shared / Public QANDEEL Personality Core Decision`. The Product Owner approved the owner name and Gate B
    Option A on 2026-10-12.
  - **`QAN-BL-ACE-02`:** real-model personality behaviour on the Golden Conversations suite. `MEDIUM`,
    `VALIDATION — OPEN`. Owner `Stage 8A — QANDEEL AI Brain / Production LLM Runtime`.
- **Unchanged:**
  - `QAN-BL-IP-01`, `QAN-BL-IP-02`, `QAN-BL-CW-02`, `QAN-BL-CW-05` and `QAN-BL-VOICE-01`;
  - `QAN-BL-PROD-06`: no new migration joins the hosted catch-up queue.
- **Not backlog (BG-06):** DD-3, DD-5 and the absent tone engine are design decisions and non-goals, not obligations.
- **Banner:** this record's own banner states the true state: implementation complete, PR open, not merged, Gate B decided
  (Option A APPROVED).
- **Gate:** `npm run test:task-closure-governance-contract` passes (§10).

## 10. PR and verification results

- **Commits:**
  - `4bd52b7e`: the implementation, the tested code tree;
  - `3a220128` and later: documentation only.
- **PR:** the ACE-01 pull request opened from this branch for independent review. It is not merged.
- **Local results on the implementation tree (2026-10-12):**
  - `npx tsc --noEmit -p apps/api/tsconfig.json`: clean.
  - Full API jest (`npx jest --runInBand`, apps/api): **244 suites, 5657 tests, all passed.**
  - New and re-anchored focused specs, all inside that run:
    - ACE spec: 23 tests;
    - locale spec: 20 tests;
    - Golden spec: 7 tests;
    - policy spec: 3 tests;
    - the IP-IMP-01 guidance and orchestrator specs.
  - Full static contract suite (`node --test tests/*.test.mjs`): passes after the two documented re-anchors (§4).
    - The first full run found one genuine hit: the W3-MEGA-U3 keyword detector against the approved disagreement
      sentence. It is re-anchored to that exact sentence only.
    - The forward-safety mirror failures in that run were that same failure reproduced inside the mirror. Rerun alone,
      forward-safety passes 35/35.
  - `npm run test:ace-01-adaptive-conversational-expression-contract`,
    `npm run test:task-closure-governance-contract` and `npm run test:ci-01-intelligence-evidence-baseline-contract`:
    pass.
  - `npm run eval:brain:validate`: 24 cases, 48 planned requests, ZERO CALLS.
  - `npm run eval:brain:dry-run -- golden-conversations`: 22 cases, 44 planned requests, ZERO CALLS.
  - No paid evaluation, no provider key, no Stage 8A run.
- **GitHub CI:** the exact-head run on the PR is the gate. It is reported in the PR, not here.

## 11. Independent review correction R1 — temporary language requests

**Finding (independent review at `724cd4d2`):** when a durable `replyLanguage` conflicted with a clear, naturally phrased
request in the current message, the durable preference won `locale`:
- `replyLanguage=EGYPTIAN_ARABIC` with "Can you answer in English?";
- `replyLanguage=ENGLISH` with «خلاص قول لي بالعربي».

The cause: the explicit-request reader accepted only the exact durable-command phrasing, rejected every question, and had
no value for the plain «بالعربي».

**Correction, bounded:**
- `interpretExplicitReplyLanguageRequest` now returns a language (`ar` | `en`), not a preference value, and reads a closed,
  whole-message grammar. It is the IP-IMP-01 language verbs and varieties plus:
  - a few Arabic lead words (خلاص، طب، طيب، ممكن، المرة دي …) and current-turn tails (دلوقتي، بقى، المرة دي …);
  - a few more verbs (قول لي، احكي لي، رد، جاوب، اكتب، كمّل، نتكلم);
  - «بالعربي / بالعربية / عربي»;
  - the English request forms "can / could / would / will you … in X", "can we / let's talk in X", "switch to X", with
    "this time / for now / instead".
- A question mark is accepted only at the end of a request-phrased question («ممكن …؟», "can / could / would / will you",
  "can / shall we").
- Unchanged:
  - the durable command grammar, so a temporary request is still never a command and is never stored;
  - no dialect or tone is inferred: the result is a language only;
  - mixed-script messages stay `und`;
  - `locale` is still rendered by no provider;
  - no new model-facing text.

**Tests:**
- `conversation-turn-locale.spec.ts` now has 53 tests:
  - the two review cases, both directions;
  - 14 positive forms;
  - 17 null cases: negation (English, Egyptian, «مش عايزك», «بلاش»), quotation (straight quotes, guillemets, reported
    speech), embedded requests, capability, complaint and unphrased questions, the ambiguous «ما تكلمني …», mixed script,
    translation;
  - durable precedence on ambiguity;
  - `interpretInteractionPreferenceCommand` returns null for every temporary form, while a marked command still parses.
- The ACE orchestrator spec adds `(5-R1)` for both review cases on the real provider request:
  - the turn's `locale` follows the request;
  - the durable line still renders;
  - `finalizeInteractionPreferenceTurn` is never called;
  - the next ordinary turn returns to the durable language.

**Focused verification (local, R1 tree):**
- `tsc`: clean.
- jest:
  - `src/conversation`, `src/model-router`, `src/intelligence-runtime`, `src/human-model`, `src/shared-world`,
    `src/public-world`: 104 suites, 2645 tests passed;
  - interaction-preferences and brain-eval: passed.
- Static contracts: ACE (6), task-closure governance (24), QIR-004 + W3-MEGA-U3 (39) all pass.
- `eval:brain:validate` and `eval:brain:dry-run -- golden-conversations`: ZERO CALLS. The Golden locale check uses the same
  resolver.
- Per the review, full CI was not repeated locally. GitHub CI on the new head is the gate.

## 12. Independent review correction R2 — Full Intelligence smoke compatibility

**Finding (GitHub API CI, runs 38254010927 and 38255795654):** `npm run verify:full-intelligence-e2e-runtime` failed at
`FOREGROUND_TURN_1` with `'en' !== 'und'`. The smoke still pinned the pre-ACE-01 constant `locale: 'und'`. VAL-01 failed
only because API CI failed.

**Correction (test expectation only, no production change):**
- In `apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts`, `FOREGROUND_TURN_1` now expects `locale: 'en'`,
  with a comment explaining why. The smoke user has no stored preference, and `SOURCE_TURN_TEXT` is plain English (ASCII
  letters, no Arabizi digits). Under WP2 the result is therefore `en`.
- `FOREGROUND_TURN_2` adds one focused check that the locale is `en` for `SECOND_TURN_TEXT`.
- No other assertion was changed, removed or disabled (HIM, Memory, Hypothesis, Confidence, Question, Safety, QIR). One
  review of the file found no other expectation tied to ACE-01.

**Verification:**
- `test:full-intelligence-e2e-runtime-contract`: 18 / 18.
- `tsc` on `tsconfig.scripts.json` and `tsconfig.json`: clean.
- The smoke itself needs PostgreSQL and Redis, and no local test environment exists. Per the review's policy, none was
  built. GitHub API CI on the correction head is the gate.

**CI result on the R2 head `a6478108`:** the Full Intelligence end-to-end runtime smoke passed. The next step,
`verify:integrated-brain:e2e-hardening-v2`, then failed at `B_DEEP_PARITY_AND_D_AUTHORITY` with the same `'en' !== 'und'`
pin. Commit `96f6c7a0`, pushed to the branch from outside this session, re-anchors that one assertion: the FAST and DEEP
turns are plain English with no reply-language preference, so the locale is `en`. No other assertion is touched. The
remaining `locale: 'und'` in `apps/api/scripts/integrated-brain-e2e-hardening-v2/human-intelligence-capacity.ts` builds a
request fixture and is not an expectation.

## 13. Post-merge Governance Reconciliation (GOV-REC-01, 2026-10-12)

Added by `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` (BG-09: recorded explicitly, never a quiet
rewrite). §1–§12 are unchanged. Their "PR open" and "not merged" describe the state before the merge, and their results
stay tied to the trees and heads they name.

**GitHub truth (read 2026-10-12):** [PR #332](https://github.com/allamqandeel/qandeel/pull/332) was MERGED on 2026-10-12
at 16:19 UTC as merge commit `141a3190deb02bc6695d2ace05da275e623a2754`, from the final head
`94fc3d76b3e729cd229f2334cfea61f01890fb48` (the R2 re-anchor of §12). No migration. Nothing is deployed.

**Lifecycle:** `CLOSED / MERGED`. This task's own closing change carried the BG-08 half (§9). After the merge:
- `QAN-BL-ACE-01` was delivered and tombstoned by ACE-SP-01 (PR #333). GOV-REC-01 fills in that tombstone's merge SHA.
- `QAN-BL-ACE-02` stays `VALIDATION — OPEN` under Stage 8A, its validation set extended by ACE-SP-01 (D-4).
- Current State and the Project Map had no ACE-01 row. GOV-REC-01 adds it (`QAN-BL-GOV-01`, finding 1).

**Not changed:** the personality core, Text v1 / v2, the locale compiler, the Golden Conversations suite and every
Product decision (Gate A, Gate B).
