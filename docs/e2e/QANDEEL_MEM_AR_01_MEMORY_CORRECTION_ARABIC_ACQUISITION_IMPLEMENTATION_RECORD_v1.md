# QANDEEL — MEM-AR-01 — Memory Correction & Arabic Acquisition — Implementation Record v1

**Status:** `MEM-AR-01` — **ACTIVE.** One task contract with three ordered slices, `MEM-AR-01A` → `MEM-AR-01B` →
`MEM-AR-01C`. 01A is merged (PR #328). 01B is implemented, Draft PR open, not merged. 01C is NOT STARTED.

**Authority:** the Product Owner's *MEM-AR-01 Implementation Task Contract*.
- Approved 2026-10-11 with mandatory review corrections RC-1 to RC-4. CQ-1 and CQ-2 were answered.
- The 01A brief authorizes "IMPLEMENT 01A ONLY. Draft PR allowed. NO MERGE."
- Design chain, in precedence order: Product Owner decisions → Addendum A2 → Addendum A1 → WP0R → WP0. These are
  task-local reports.
- This record carries the contract's binding decisions for 01A (§2). It does not restate the full contract.

**Baseline:** `main = 1294a6929655bd36cad6cea873836feca8dbc91f` (the merge of PR #327); migrations `0001`–`0151`.

**Backlog:**
- MEM-AR-01 inherits no backlog item.
- `QAN-BL-INTEL-03` (owner `INTEL-SV-01`) and `QAN-BL-PRIV-03` are proposed for admission at the 01C closing change only.
- `QAN-BL-INTEL-02` stays with `INTEL-RET-01` and is not touched.

---

## Slice: MEM-AR-01A — Arabic Fidelity & Normalization

**Slice:** `MEM-AR-01A` — **IMPLEMENTED — MERGED** through PR #328 on the Product Owner's «ادمج» (merge commit
`04dfbf21e8e40fe24ca042baa3e1456ac99ae798`). No migration, no deployment.

**Branch:** `mem/mem-ar-01a-arabic-fidelity-normalization`, cut from `origin/main` `1294a69`.

**Implementation commit (the tested code tree):** `d94bb9b15b7cb9e3673327b6236e52c4d0ffc49c` (G-A1 corrections, §5), on top of the
first implementation commit `0815ff3f56fde97f4dab04bd768b17f96bc4baf1` (§2–§4).
- Every later commit on the branch adds documentation or harness results only.
- The PR head's code tree must equal this commit's tree for `apps/`, `database/`, `packages/`, `tests/` and every
  `scripts/` path except `scripts/ci-01/results/` (RC-3; verified in the PR description).

### 1. Anti-duplication gate (contract §1.2), at the start of the slice

| Check | Result |
|---|---|
| `origin/main` | `1294a6929655bd36cad6cea873836feca8dbc91f`: unchanged since the contract was prepared |
| Terminal migration | `0151`; 01A adds none |
| Open PRs, and `mem/*` branches on the remote | none |
| `memory_subject_attributions`, `memory_equivalence_key_v1`, `background_record_memory_v1`, `normalizeArabicComparison`, `arabic-text` on `origin/main` outside `docs/` | none |

### 2. What changed

| Area | Change | Files |
|---|---|---|
| **A. Wording fidelity (PD-4)** | Arabic location and travel statements are stored as the user's own clause on the three write paths: background, explicit remember, correction replacement. «أنا ساكنة في مدينة نصر» → «أنا ساكنة في مدينة نصر.»; «أنا عايشة في المعادي» → «أنا عايشة في المعادي.»; «أنا مسافرة الإسكندرية بكرة» → «أنا مسافرة الإسكندرية بكرة.». Only orthography changes: the existing `clean`, «انا / إني → أنا», one terminal full stop, and the «بالمناسبة» preamble. English templates are unchanged | `memory-write-evaluator.service.ts` |
| **B. One comparison normalizer** | `normalizeArabicComparison`, pure, with every operation enumerated by code point for the 01C SQL mirror. Steps in order: NFKC; tatweel U+0640 and harakat U+064B–U+065F, U+0670; أ إ آ → ا, ى → ي, ة → ه; Arabic-Indic digits → ASCII; ASCII case fold; the 25 White_Space code points; terminal `. ! ? ؟ ، , ; ؛ :`. It is used for the evaluator duplicate key, the retrieval tokens and the Memory-control resolution words. The 0028 Evidence key (`normalizeExact`) and `evidence-normalization-parity` golden file are byte-unchanged | `memory/arabic-text.ts` (new) |
| **C. Retrieval** | Tokens go through the normalizer and then the W3-MEGA-M light stem (moved unchanged into `arabic-text.ts`). «اني», «انه» and «انها» are added to the stop words. Bounds (32 → 4, 2,400 characters), scoring and ordering are unchanged. No vector or embedding retrieval, and no new ranking | `memory-retriever.service.ts` |
| **D. Bounded Egyptian capture (PD-5)** | Pronoun-less «بحب …» → `STABLE_PREFERENCE`. First-person «(أنا) بطلت …» → `PERSONAL_FACT`, in the user's words. A question is never captured. «بطلت» followed by a «ت… / ي… / ن…» verb is another person, so it is not captured. «نفسي …», «مش عايز حد …» and multi-candidate extraction stay excluded | `memory-write-evaluator.service.ts` |
| **D. «بطلت» safety boundary** | The background capture screen fails closed with `REVERSAL_NEEDS_CORRECTION` when «بطلت X» shares a distinctive, non-predicate word with a current Memory («أنا بحب القهوة» → «بطلت أشرب قهوة»). Nothing is written, corrected or retired. No reply claims a correction. The controlled correction belongs to 01B | `screenMemoryCapture` in the evaluator; both background writers |
| **E. Legacy-template duplicates** | Rows written before 01A are never rewritten. A new statement is also compared with the frozen pre-01A template of the same statement (the two old regular expressions, unchanged), so «أنا ساكنة في X» does not duplicate a legacy «أنا ساكن في X.». The rule is bounded to the two formerly templated shapes. It applies on the background path and on the explicit remember and correct paths, which used to template and would otherwise create a new duplicate pair | `memoryDuplicateKeys`; `memory-control.service.ts` |
| **F. Trigger boundaries (PD-6)** | «ليه أنا» uses `(?![\p{L}\p{M}])` instead of the ASCII-only `\b`. «بس» is a whole word in the two INTERNAL_CONTRADICTION patterns, so «بسهر» no longer fires; «لكن», «لكنه» and «لكني» still match. No new trigger or category | `hypothesis-generation-trigger-classification.service.ts` |
| Static contract re-anchor | The W3-MEGA-M purity rule admits the pure `arabic-text` helper and checks that the helper itself imports nothing. Two planted defects prove the check | `tests/w3-mega-m-conversational-memory-control-contract.test.mjs` |
| CI-01 | New fixture U2: Unicode duplicates, feminine wording, «بطلت» fail-closed, pronoun-less «بحب». N1, K1 and M1 are unchanged | `scripts/ci-01/fixtures/u2-unicode-duplicates-bounded-cues.json` |
| G-A1 corrections (§5) | RC-A1: F1 gains the genuine contradiction turn F1.2b. RC-A2: «بحب» is non-distinctive in recall | `f1-forget-do-not-rely-propagation.json`; `memory-retriever.service.ts` |

**Exclusions held:**
- No migration and no SQL.
- No 01B reversal or correction logic. No subject attribution, finalize v2, writer grants, duplicate retirement, CC-H1,
  CC-M1, CC-M2′ or CC-M3′.
- No change to the 0151 reliance semantics.
- No user-visible copy, no provider or embedding, no Mobile change, no backlog change, no hosted access.

**Expectations changed (each one encoded the templating defect):**
- `memory-write-evaluator.service.spec.ts`: «بالمناسبة أنا ساكن في أكتوبر من 3 سنين.» is now stored as «أنا ساكن في أكتوبر
  من 3 سنين.», not «أنا ساكن في أكتوبر.». The duration is part of the user's clause.
- No other existing expectation changed.

### 3. Validation (QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE)

All local checks ran on the implementation tree `0815ff3`.

| Check | Result |
|---|---|
| API typecheck (`tsc --noEmit`, `apps/api/tsconfig.json` and `tsconfig.scripts.json`) | pass |
| Focused Jest, `--no-cache`: `src/memory` (incl. `arabic-text`, evaluator, retriever, resolution, interpreter, write service, `evidence-normalization-parity`), the trigger classifier, background enrichment, and the direct consumers (Memory-control route, orchestrator, eligibility, dispatcher, association, foreground gatherer, brain context) | **23 suites, 963 tests, all pass** |
| Non-vacuity of the new F-2 / F-3 tests | Against the `main` retriever and classifier, **10** of the new tests fail |
| Static contracts that read a touched file (W3-MEGA-M, INTEL-TM-01, CI-01, bounded foreground gatherer, FAST/DEEP v2, HIM bridge, HSE latency, explicit session context, historical projection, integrated brain v2, integrated budget, integrated runtime and phase closure, question / information gap, A2 smoke, Full Intelligence smoke) | **160 tests, all pass** |
| `evidence-normalization-parity` golden file | byte-unchanged (`git diff` empty) |
| PostgreSQL migration verification | not run: 01A changes no schema |
| Mobile | not run: no Mobile change |
| API CI on the PR head | `71977f7` (code tree = `0815ff3`): API CI **success** (`verify-api` pass; VAL-01 plan and evidence pass). For `d94bb9b` see §5 |

**Focused matrix rows (contract §10.1):**
- **F-1:** evaluator spec. Covers the three paths, the bounded cues and their exclusions, I-F3 anchoring (12
  third-person or subject-less statements not captured), legacy-template duplicates, and the «بطلت» fail-closed screen.
  The route spec proves explicit remember, legacy already-remembered and correction wording; the enrichment spec proves
  the background path.
- **F-2:** the normalizer table and the stem table in `arabic-text.spec.ts`, plus the retriever recall, stop-word,
  digit / tatweel, K1.10-miss and bounds cases.
- **F-3:** classifier cases for «ليه أنا …», «بسهر» in both patterns, and a standalone «بس» / «لكنه».

- **CI-01 re-run:** `scripts/ci-01/results/0815ff3f56fde97f4dab04bd768b17f96bc4baf1.json`, run on the implementation
  commit. Full harness, 9 scenarios plus controls, one run (about 30 s), local process-owned PostgreSQL 17.10.
  Guard: 14/14 transports blocked; 0 network attempts; 0 telemetry content leaks; 0 outbox content.

| Scenario | `272a567` (before 01A) | `0815ff3` (01A) | Reading |
|---|---|---|---|
| N1 | recall 0/2; fact stored «أنا ساكن في مدينة نصر.» | recall **1/2**; fact stored «أنا ساكنة في مدينة نصر.» | N1.6 «فاكر أنا ساكنة فين؟» now hits. N1.7 stays a miss: the value statements N1.1–N1.4 are not captured (Stage 8A) |
| K1 | capture 3/6, recall 1/4 | capture **4/6**, recall **2/4** | K1.4 pronoun-less «بحب» is captured; K1.8 «للهدوء» hits. **K1.10 «التدخين» against «بيدخن» stays a recorded miss.** K1.7 (paraphrase) is a miss |
| K1.9 | served 2 (one through «إني») | served **2** | The «إني» hit is gone. The second item is now the newly captured K1.4 «بحب السفر…», reached through the shared predicate «بحب». Resolved at G-A1: served **1** on `d94bb9b` (§5) |
| M1 | M1.4 «ليه أنا دايما …» → `NO_TRIGGER` | M1.4 → **`TRIGGER EXPLICIT_WHY_SELF`** (+1 Hypothesis) | F-3 effect. Capture is still 1/4 (compound turns; Stage 8A) |
| U2 (new) | — | capture 5/9 (by design); fact 1/1; recall 1/1; **0 duplicate ACTIVE rows** | U2.2 (tatweel) and U2.4 (Arabic-Indic digits) are already remembered. U2.6 is a duplicate. U2.8 «بطلت أشرب قهوة» beside «أنا بحب القهوة» writes nothing. U2.9 «بطلت السهر» and U2.10 «بحب السفر» are captured as said |
| C1, P1, H1, X1 | — | identical to `272a567` | Not 01A's scope. Correction, third party and HIM are unchanged |
| F1 | 1 Hypothesis (from the F1.2 trigger) | **0 Hypotheses**; `pg02DependedOnWithdrawnOrCorrected` 0 | See §4, item 1. Non-vacuous again on `d94bb9b` (§5) |

**Controls:**
- User isolation holds on both sides: owner reads equal ground truth; the non-owner reads nothing by user id, by row
  id, unfiltered or through retrieval.
- On `0815ff3` the isolation result is `holds: false` only because one non-vacuity flag, `ownerHypothesesSeen`, is false
  (§4, item 1). Memory and retrieval non-vacuity are true. On `d94bb9b` every flag is true and `allHold` is true (§5).

### 4. Findings and residues (for Product Owner review)

1. **F1 measured PG-02 through the «بسهر» defect.**
   - The only F1 Hypothesis came from F1.2 «قررت أنام بدري رغم إني دايما بسهر». It matched INTERNAL_CONTRADICTION
     only because «بس» was found inside «بسهر»; the fixture's own `triggerProbe` note says it records that.
   - The F-3 repair the Product Owner required removes that false trigger, so F1 now generates no Hypothesis.
   - Two things become vacuous in the synthetic run: the F1 PG-02 measure, and the hypothesis side of the CI-01
     isolation control (whose hypothesis target is F1).
   - Nothing regressed. PG-02 itself is proven by `verify-0151` in API CI, and the INTEL-TM-01 contract pins its own
     `272a567` results, which remain committed.
   - 01A does not change F1 ("re-run unchanged"; do not broaden scope to make historical synthetic results green).
   - **Resolved at G-A1 (RC-A1, §5):** F1.2 is kept as the false-trigger probe, and a genuine contradiction turn,
     F1.2b, is added.
2. **K1.9 serves 2, not 1** (§3). **Resolved at G-A1 (RC-A2, §5).**
3. **«بطلت» detection is lexical.**
   - A reversal with no shared word with the old fact (old «بشرب سجاير», new «بطلت التدخين») is captured beside the old
     fact. The capture is silent and claims no correction.
   - An explicit «افتكر إني بطلت …» beside a related Memory was already stored verbatim before 01A; it is unchanged.
   - Both are 01B's reversal scope.
4. **ASCII-only case fold** (contract §2.1, needed for the SQL mirror). Non-ASCII Latin capitals («É») are no longer
   folded in the duplicate key. This is deliberate and has no Arabic effect.
5. **Not fixed by 01A:**
   - The C1.6 duplicate ACTIVE pair after a correction whose replacement already exists, and duplicate retirement in
     general → 01C.
   - Third-party subject separation (P1) → 01C.

### 5. G-A1 focused review corrections (Product Owner review of PR #328)

The Product Owner accepted the implementation in principle and required two focused dispositions. Implementation
commit: `d94bb9b15b7cb9e3673327b6236e52c4d0ffc49c`.

**RC-A1: F1 non-vacuity (fixture only; the harness is unchanged).**
- F1.2 «قررت أنام بدري رغم إني دايما بسهر» is kept unchanged as the «بسهر» false-trigger probe.
- New turn F1.2b «مع إني قررت أنام بدري بس بشرب القهوة بالليل وبسهر», before `F1.links.before`:
  - It is a genuine `INTERNAL_CONTRADICTION` («مع إني … بس …», with a whole-word «بس»).
  - It concerns the two Memories captured at F1.1 and F1.2.
  - It writes no Memory of its own (`NO_SUPPORTED_EXPLICIT_PATTERN`), so FORGET and DO_NOT_RELY still resolve to the
    same two Memories.
- The Hypothesis comes from the production generation path with the existing candidate double. No Hypothesis is
  fabricated. Historical result files are unchanged.

**RC-A2: K1.9 lexical precision (retriever).**
- «بحب» (and «بحبه» / «بحبها», which stem to it) never selects a Memory on its own while the query's other words select
  one. When they select nothing, the earlier behaviour is kept.
- A plain stop word was tried as the negative control, and two recall guards fail with it:
  - «فاكر أنا بحب إيه؟» would serve nothing instead of every «بحب» Memory.
  - «فاكر إني بحب القهوة؟» would serve nothing when no Memory mentions coffee.

  It is therefore not used.
- The scoring formula, the ordering, the bounds (32 → 4, 2,400 characters) and every other token are unchanged.
  Nothing is semantic.
- Intentional consequence: a Memory that also contains «بحب» no longer outranks an equally distinctive match only
  because of «بحب».
- Only «بحب» is treated this way. English "like" and "love" and the other predicates are untouched; widening the rule
  belongs to `QAN-BL-CTX-01`.

**Validation (on `d94bb9b`):**

| Check | Result |
|---|---|
| API typecheck (both tsconfigs) | pass |
| Affected Jest, `--no-cache`: retriever, orchestrator, HIM-snapshot degradation, foreground gatherer | **4 suites, 296 tests, all pass** |
| New RC-A2 tests against the `0815ff3` retriever | the K1.9 test fails; the three guard tests pass, because they pin behaviour that must not change |
| Plain stop-word variant (negative control) | 2 guard tests fail |
| Static contracts that read the retriever or CI-01, plus W3-MEGA-M | **76 + 33 tests, all pass** |
| CI-01, one full run | `scripts/ci-01/results/d94bb9b15b7cb9e3673327b6236e52c4d0ffc49c.json` |

**CI-01 on `d94bb9b`:**

**F1:**
- F1.2 → `AMBIGUOUS TRIGGER_LIKE_BUT_UNRESOLVED`, +0 Hypotheses. The false trigger stays fixed.
- F1.2b → `TRIGGER INTERNAL_CONTRADICTION` → generation `COMPLETED`, +1 Hypothesis.
  - Before withdrawal it is linked to `STABLE_PREFERENCE:ACTIVE` and `DECISION_COMMITMENT:ACTIVE`.
- After FORGET (`DELETED`) and DO_NOT_RELY (`DISABLED`):
  - the links are detached;
  - the Hypothesis carries `NO_REMAINING_SUPPORT`, with the withdrawal recorded.
- PG-02 measures: `pg02DependedOnWithdrawnOrCorrected` **1**; `pg02ReliedOnAfterWithdrawal` **0**;
  `activeHypothesesOverNonActiveEvidence` 0.
- Forgotten content served: 0/2. Hypothesis injected after forget: 0.

**K1:**
- Recall stays 2/4 and capture 4/6.
- **K1.9 serves 1 item**, the «الهدوء» Memory.
- K1.4 still sees one item through the fallback.
- K1.7 and K1.10 stay recorded misses.

**Controls:**
- Isolation `holds: true`, with every non-vacuity flag true, including `ownerHypothesesSeen`. F1 owner: 1 / 1
  Hypotheses, 2 / 2 Memories.
- Positive ownership and the negative cross-user checks both hold.
- Telemetry content leaks: 0. Outbox content: 0. Guard: 14 / 14 transports blocked.
- **`allHold: true`**.
- The 0029 by-design ledger rows rise from 4 to 6, because there is one more generation. They are not counted against
  the controls.

**Other scenarios:** C1, H1, M1, N1, P1, U2 and X1 yields are identical to `0815ff3`.

**Gate:** G-A1 passed; 01A merged as PR #328. Migration `0152` is not created.

---

## Slice: MEM-AR-01B — Natural Reversal & Correction

**Slice:** `MEM-AR-01B` — **IMPLEMENTED — DRAFT PR OPEN — UNDER REVIEW (G-B1) — NOT MERGED.** Merge only on the Product
Owner's explicit «ادمج». No migration, no deployment.

**Authority:** the 01B brief ("IMPLEMENT MEM-AR-01B ONLY. Draft PR allowed. NO MERGE") under the approved contract §2.2,
§8.2 and §14, RC-4 included.

**Branch:** `mem/mem-ar-01b-natural-reversal-correction`, cut from `origin/main` `04dfbf21` (the merge of PR #328).

**Implementation commit (the tested code tree):** `3d0ff0f9c3e543ae1a2116468d4908de2e4c8b47`. Every later commit on the
branch adds documentation or harness results only (RC-3).

### 1. Anti-duplication gate (contract §1.2), at the start of the slice

| Check | Result |
|---|---|
| `origin/main` | `04dfbf21e8e40fe24ca042baa3e1456ac99ae798`, the verified main. PR #328 is merged and its code is present |
| Terminal migration | `0151`; 01B adds none |
| Open PRs, and other 01B branches | none |
| The 01C names of §1.1 on `origin/main` outside `docs/` | none, except a forward-reference comment to `memory_equivalence_key_v1` in 01A's `arabic-text.ts` |
| Backlog | `QAN-BL-INTEL-03`, `QAN-BL-PRIV-03` and `MEM-AR` absent; not modified |

### 2. What changed

| Area | Change | Files |
|---|---|---|
| **Cues (PD-2)** | `CORRECT_AR` admits «غيرت رأيي» as an opener, so «غيرت رأيي، مبقتش X، أنا Y» is the existing explicit correction. A new pure reader, `interpretNaturalReversal`, reads three single-clause shapes, each a `CORRECT` with a `natural` marker (no new kind, no new outcome): «(أنا) مبقتش X» (`NO_LONGER`), «(أنا) بطلت X» (`STOPPED`, never before a «ت… / ي… / ن…» verb) and «(أنا) بقيت Y» (`BECAME`), optionally after «غيرت رأيي». The cue must open the utterance: quoted words, a question, a second clause, or anything in front of the cue («هو بطل …», «قالي …», «مراتي بقت …») is not a reversal | `memory-control.interpreter.ts`; `NaturalReversal` in `memory-control.types.ts` |
| **Target (contract §2.2 items 2–4)** | `resolveReversalTarget`, pure, beside `resolveMemoryTarget` and with the shared 01A normalizer and stem. `BECAME` replaces a value only in the single-valued residence / location frame («أنا ساكن / ساكنة / عايش / عايشة في …», the evaluator's location frame): a first-person Memory of the same type in that frame with another value. Every other frame is multi-valued, so «بقيت بحب الشاي» never replaces coffee. `NO_LONGER` / `STOPPED` negate the same object: every distinctive word of X, the predicate included, must be in the target; a predicate alone names nothing; the type must match when X is a typed statement; a Memory that already negates or stops something is never the target. One morphological bridge, nothing semantic: after «بطلت», the first verb's bare first-person form («أشرب») also meets the habitual «بشرب». Exactly one target → `RESOLVED`; two or more → `AMBIGUOUS` (at most three, recency order); none → `NONE` | `memory-control.resolution.ts` |
| **Plan** | An explicit request is read first, then a natural reversal. One target → the existing v1 `CORRECT` / `CORRECTED` plan with the existing `correctedReply`; several → the existing `CLARIFICATION_REQUIRED`; none → `null`, i.e. ordinary conversation with no command row and no Memory reply. A Memory that already says the new statement is never the target, so a repeated reversal changes nothing. The successor of a negation keeps the user's words («أنا مبقتش بحب القهوة.») with the target's type, importance and expiry inherited; «أنا» is written out when it was implicit, as every correction already does. A clarification answer re-reads the original reversal the same way | `memory-control.service.ts` |
| **Background** | Unchanged. Natural reversals are not added to the background's command skip, so «بطلت السهر» with no related Memory is still captured (U2.9). After a committed reversal, the 01A capture screen stops a second row (C2.9: `NO_FRESH_EVIDENCE`) | none |
| **Static contract re-anchor** | W3-MEGA-M's "only a unique match is RESOLVED" now counts the one reversal path, pins its unique-match line, the predicate-alone refusal, and "a reversal that names nothing is ordinary conversation". Three planted defects prove them | `tests/w3-mega-m-conversational-memory-control-contract.test.mjs` |
| **CI-01** | Fixtures C2 (reversal shapes) and U1 (words answer). Two per-turn observations: the committed Memory-control command (kind, outcome, options, answered) and status changes of existing Memories. Additive; no existing measure changed | `scripts/ci-01/` |

**Exclusions held:** no SQL or migration, no new command kind, outcome or copy, no R2 guard, no subject attribution, no
finalize v2, no duplicate retirement, no CC-H1 / CC-M1 / CC-M2′ / CC-M3′, no copula-less correction, no bulk forget or
re-enable, no semantic matcher or provider, no Mobile / Shared / Public World change, no backlog change, no hosted access.

### 3. Validation (on the implementation tree `3d0ff0f`)

| Check | Result |
|---|---|
| API typecheck (`tsconfig.json`, `tsconfig.scripts.json`) | pass |
| Changed-module and neighbouring Jest, `--no-cache`: interpreter, resolution, Memory-control route, R2 words-answer route, background enrichment, evaluator | **6 suites, 302 tests, all pass** |
| Non-vacuity: the new route tests against `main`'s Memory-control modules | **6 of 7** R-2 tests fail; the seventh (ordinary conversation) is a guard that holds on both |
| W3-MEGA-M | **36 / 36** (33 + 3 planted defects) |
| The 32 static contracts that walk the API sources or read Memory control (W3-MEGA-M included) | **407 / 407** |
| CI-01 contract | **18 / 18** |
| PostgreSQL migration verification | not run locally: no schema change. The 0128 / 0151 verifiers run in API CI |
| Mobile | not run: no Mobile change |

**R-1 (unit; interpreter and resolution specs):**
- Each cue against one, several and no target.
- Single-valued (residence) against multi-valued (preference) frames; same-object negation; the type never crossing.
- A predicate alone never naming the fact.
- Explicit against natural shapes; ordinary statements without a cue.
- Quoted, reported and third-party sentences; questions.
- The «بطلت» bridge and its limit («التدخين» never meets «سجاير»).

**R-2 (route; the real production turn route):**
- «غيرت رأيي، بقيت ساكن في طنطا»: the one remembered residence → `SUPERSEDED`, exactly one successor «أنا ساكن في طنطا.»
  (version 2, `PERSONAL_FACT`), the reply `correctedReply`, the only server command
  `server_finalize_memory_control_turn_v1`. A friend's residence and another reader's identical row are untouched.
- «أنا مبقتش بحب القهوة»: successor «أنا مبقتش بحب القهوة.», `STABLE_PREFERENCE` inherited; tea untouched.
- «أنا بطلت أشرب قهوة» against «أنا بشرب قهوة كل يوم.»: corrected.
- Two residences: the existing clarification, nothing changed, then only the chosen one corrected (`answers_command_id`
  linked). An answered negation keeps the inherited type.
- Ordinary conversation, no command, no change: «بقيت بحب الشاي», «أنا بحب الكشري» beside «أنا بحب الفول.», «أنا بطلت أشرب
  قهوة» beside «أنا بحب القهوة.» only, «غيرت رأيي، بقيت ساكن في طنطا» with no residence, «قالي: أنا مبقتش بحب القهوة», a
  question, and a repeat after a committed reversal.
- No reply carries an id, a status, a type or a score.
- **PG-02:** the correction is the unchanged v1 SQL path. Its taint and withholding are proven by `verify-migration-0128`
  and `verify-migration-0151` in API CI; CI-01 F1 is identical to 01A.

### 4. S-2a — R2 characterization verdict: **CONFIRMED**

The question (INTEL-TM-01 R2, PD-7): when a FORGET clarification is answered in words, does background capture write the
answer or re-create the forgotten Memory?

**Route reproduction** (`apps/api/src/post-response-intelligence/memory-control-words-answer.route.spec.ts`). It drives
`ConversationService` → the real orchestrator → the Memory-control boundary → the 0128 mirror → the completed-turn
outbox event → the real `PostResponseIntelligenceDispatcher` → the real `BackgroundIntelligenceEnrichment`. Data ports
are doubles.

| Step | Observed |
|---|---|
| Stored | «أنا بحب الكشري.», «أنا بحب الفول.» (`STABLE_PREFERENCE`) |
| «انسى إني بحب» | `FORGET` / `CLARIFICATION_REQUIRED`, both options; background `SKIP` |
| «أنا بحب الكشري» (the answer) | `FORGET` / `FORGOTTEN`, answering the question: «الكشري» → `DELETED`, «الفول» `ACTIVE` |
| Background on the same turn | The interpreter sees no command in the words; the deleted row is outside the active screen. `MEMORY_WRITE` = `WRITE` (`FRESH_EVIDENCE_CREATED`): a new `ACTIVE` «أنا بحب الكشري.» |
| Control: the answer «2» | the same Memory forgotten; background `SKIP`, nothing written |

**Database reproduction** (CI-01 U1, local PostgreSQL 17.10, every migration):

| Turn | Command | Status change | Background `MEMORY_WRITE` | New row |
|---|---|---|---|---|
| U1.3 «انسى إني بحب» | `FORGET` / `CLARIFICATION_REQUIRED` (2 options) | none | `NO_FRESH_EVIDENCE` | none |
| U1.4 «أنا بحب الكشري» | `FORGET` / `FORGOTTEN`, answering | «أنا بحب الكشري.» `ACTIVE` → `DELETED` | `FRESH_EVIDENCE_CREATED` | `STABLE_PREFERENCE` `ACTIVE` «أنا بحب الكشري.» |
| U1.5 «فاكر أنا بحب إيه؟» | none | none | — | none; the forgotten statement **is served** (`forgottenServed: true`) |

End state: one `DELETED` and one `ACTIVE` row with the same words, plus «الفول».

**Verdict: CONFIRMED** by both reproductions: the forgotten Memory is re-created and served again. No guard is installed
in 01B. The spec asserts the observed behaviour; its assertions marked OBSERVED are the ones a guard inverts.
**Handoff:** the R2 guard belongs to MEM-AR-01C under the existing contract (A1/A2: a predicate in
`background_record_memory_v1`, `SKIPPED_COMMAND_TURN`; S-2b).

### 5. CI-01 on `3d0ff0f`

`scripts/ci-01/results/3d0ff0f9c3e543ae1a2116468d4908de2e4c8b47.json`: full harness, 11 scenarios plus controls, one run.
Repository head `3d0ff0f`, working tree clean.

**C2 (new):**

| Turn | Outcome |
|---|---|
| C2.6 «غيرت رأيي، بقيت ساكن في طنطا» | `CORRECTED`: «أنا ساكن في أكتوبر.» → `SUPERSEDED`, successor «أنا ساكن في طنطا.» v2. C2.7 recall hit, stale 0 |
| C2.8 «أنا مبقتش بحب القهوة» | `CORRECTED`: successor «أنا مبقتش بحب القهوة.» `STABLE_PREFERENCE` v2 |
| C2.9 «أنا بطلت أشرب قهوة» | `CORRECTED` against «أنا بشرب قهوة كل يوم.»; the background's own capture is stopped as a duplicate |
| C2.10 «بقيت بحب الشاي» | ordinary; nothing superseded, nothing captured |
| C2.11 «أنا بحب الكشري» | ordinary; captured; «أنا بحب الفول.» untouched |
| C2.12 «غيرت رأيي، مبقتش بحب الفول، أنا بحب الطعمية» | explicit `CORRECTED` → «أنا بحب الطعمية.» |
| C2.13 «بطلت التدخين» beside «أنا بشرب سجاير.» | ordinary; **captured** «بطلت التدخين.» while «أنا بشرب سجاير.» stays `ACTIVE` (limit L-1) |
| C2.14 the C2.8 sentence again | ordinary; nothing left to reverse |
| C2b.3 «غيرت رأيي وبقيت ساكن في المعادي» with two residences | `CLARIFICATION_REQUIRED` (2 options) |
| C2b.4 «1» | `CORRECTED`, answering: «أنا عايش في الزمالك.» → «أنا ساكن في المعادي.» |

End state: C2 4 `SUPERSEDED`, 7 `ACTIVE`, 0 duplicate actives; C2b 1 `SUPERSEDED`, 2 `ACTIVE`.

**U1 (new):** §4.

**C1, F1, H1, K1, M1, N1, P1, U2, X1:** yields, turns and end states identical to 01A's `d94bb9b` run, apart from the
two new observation fields.
- F1: PG-02 proof unchanged.
- K1.9: still serves 1 item.
- C1.2 stays unrecognized (limit L-2), and C1.6 still leaves one duplicate active pair (L-4).

**Controls:** `allHold: true`; isolation two-sided and non-vacuous; 0 telemetry content leaks; 0 outbox content;
guard 14 / 14. Only volumes grew: 82 executions and outbox events instead of 59, from the 23 new turns.

### 6. Limitations and 01C handoff

| # | Limitation | Disposition |
|---|---|---|
| R2 | A words answer to a FORGET clarification re-creates the forgotten Memory (§4) | **CONFIRMED → 01C**, as contracted. No guard in 01B |
| L-1 | «بطلت التدخين» has no lexical link to «أنا بشرب سجاير.»: nothing is corrected, and the background captures «بطلت التدخين.» beside the old fact (the 01A screen cannot see the relation). Not inferred | Recorded; for the 01C closing reconciliation (BG-08) |
| L-2 | C1.2 «غيرت رأيي وبقيت عايز أعيش في إسكندرية بعد الجواز»: a preference (multi-valued by contract) with another predicate («عايز» ≠ «بفضل»). It stays ordinary; the stale value is served at C1.3 | Recorded; by contract |
| L-3 | Only residence / location is single-valued for «بقيت». Other single-valued facts are not replaced by a bare new value | By contract |
| L-4 | A correction into a value already stored still leaves a duplicate active pair (C1.6) | 01C (`CORRECTED_TO_EXISTING`), as contracted |
| L-5 | The four cues are Egyptian Arabic only; English natural reversals are not read | By contract |

**Next gate:** G-B1 — MEM-AR-01B Review (STOP). 01C is not started; migration `0152` is not created.
