# QANDEEL — MEM-AR-01 — Memory Correction & Arabic Acquisition — Implementation Record v1

**Status:** `MEM-AR-01` — **CLOSED / MERGED — all three slices merged: 01A through PR #328 (`04dfbf21`), 01B through PR
#329 (`20e33ae3`), 01C through PR #330 as `3bec87ac725c73db0aecc5a6fb4e01c90acce66b` (2026-10-12); migration `0152` NOT
DEPLOYED.** The post-merge status is recorded by GOV-REC-01 (2026-10-12; the 01C slice's §16, at the end of this record).
Everything else is kept as written before the 01C merge.

**Status at the 01C closing change (historical, kept verbatim):** `MEM-AR-01` — **CLOSED / READY FOR PO MERGE DECISION.** One task contract with three ordered slices,
`MEM-AR-01A` → `MEM-AR-01B` → `MEM-AR-01C`. 01A is merged (PR #328) and 01B is merged (PR #329). 01C — migration
`0152` — is implemented and carries this closing change (BG-08 / BG-09) in Draft PR #330, **awaiting the Product Owner's
merge decision («ادمج»); not merged, not deployed.**

**Authority:** the Product Owner's *MEM-AR-01 Implementation Task Contract*.
- Approved 2026-10-11 with mandatory review corrections RC-1 to RC-4. CQ-1 and CQ-2 were answered.
- The 01A brief authorizes "IMPLEMENT 01A ONLY. Draft PR allowed. NO MERGE."
- Design chain, in precedence order: Product Owner decisions → Addendum A2 → Addendum A1 → WP0R → WP0. These are
  task-local reports.
- This record carries the contract's binding decisions for 01A (§2). It does not restate the full contract.

**Baseline:** `main = 1294a6929655bd36cad6cea873836feca8dbc91f` (the merge of PR #327); migrations `0001`–`0151`.

**Backlog:**
- MEM-AR-01 inherits no backlog item.
- Admitted by the 01C closing change: `QAN-BL-INTEL-03` (owner `INTEL-SV-01`) and `QAN-BL-PRIV-03` (owner
  `PRIV-EXPORT-01`). See 01C §9.
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

**Slice:** `MEM-AR-01B` — **IMPLEMENTED — MERGED** through PR #329 on the Product Owner's «ادمج» (merge commit
`20e33ae3f0c7a4c95a952802d293547f1a98f676`). No migration, no deployment.

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

**Gate passed:** G-B1 — merged through PR #329 (`20e33ae3`). Its R2 verdict and L-1 … L-4 are disposed of in 01C §5 and §11.

---

## Slice: MEM-AR-01C — Subject Identity, Atomicity & Evidence Protection

**Slice:** `MEM-AR-01C` — **IMPLEMENTED — CLOSING CHANGE INCLUDED — DRAFT PR #330 — AWAITING THE PRODUCT OWNER'S MERGE
DECISION (G-C2) — NOT MERGED, NOT DEPLOYED.** Sole owner of migration `0152`.

**Authority:** the 01C brief ("IMPLEMENT 01C ONLY. Draft PR allowed. NO MERGE. NO DEPLOYMENT") under the approved
contract §2.3, §4, §6, §7, §8.3, §9, §10, §12, §13 and §16 (RC-1 … RC-4, CQ-1, CQ-2), with PD-1 … PD-8, RD-1 Option B,
CC-H1, CC-M1, CC-M2′ and CC-M3′.

**Branch:** `mem/mem-ar-01c-subject-identity-evidence-protection`, cut from `origin/main`
`20e33ae3f0c7a4c95a952802d293547f1a98f676` (the merge of PR #329).

**Implementation commit (the tested code tree):** `023f68e4e465795fd01aac80a857cf85ccb47851` — the first implementation
`b9549663b9f5eee234dabc24af664bd295326079`, the G-C2 review corrections RC-C1 and RC-C2 (§13, `38c977f`), the
Product Owner's G-C2 decisions L-10 and L-11 (§14, `b73206bb`) and the G-C2 final corrections A and L-12 (§15). Every
later commit on the branch adds documentation or CI-01 results only (RC-3).

### 1. Anti-duplication gate (contract §1.2), at the start of the slice

| Check | Result |
|---|---|
| `origin/main` | `20e33ae3f0c7a4c95a952802d293547f1a98f676`; PRs #328 and #329 merged |
| Terminal migration | `0151`; **`0152` free** — taken by this slice |
| §1.1 names on `main` outside `docs/` | none (01A's `arabic-text.ts` names `memory_equivalence_key_v1` in a comment only) |
| Open PRs touching Memory control, the evaluator, the retriever, Evidence, the generation policy, 0028 / 0033 / 0128 / 0151 | none (no open PR) |
| Backlog | `QAN-BL-INTEL-03`, `QAN-BL-PRIV-03` free; no item names MEM-AR-01 (re-checked at the closing change) |

### 2. What changed

**SQL — `database/migrations/0152_memory_subject_identity_atomicity_v1.sql`** (one transaction, forward-only, 0001–0151
untouched):
- `memory_equivalence_key_v1` — one `translate` pass, at parity with 01A's `normalizeArabicComparison` (golden fixture
  `database/fixtures/memory-equivalence-key-v1.json`, 38 cases, SQL = TS).
- `memory_subject_attributions` (SELF / OTHER; bases `FIRST_PERSON_CAPTURE`, `EXPLICIT_STATEMENT`, `USER_CLARIFIED`,
  `CORRECTION_INHERITED`, `LEGACY_FIRST_PERSON_CAPTURE`; a capture basis is always SELF and names its execution, a command
  basis names its command) and `memory_equivalence_dispositions` (`CORRECTED`, `FORGOTTEN`, `DISABLED`, `RECONFIRMED`):
  append-only, `UPDATE` refused, `DELETE` only inside the governed erasure, `CASCADE` with the Memory, owner-only RLS,
  `SELECT` for `authenticated` / `service_role`, no write grant.
- The legacy attribution (A1 C1.1, five provenance conditions), run once before the insert guard exists.
- `guard_memory_subject_attribution_insert_v1`: an attribution only with its Memory (owned, ACTIVE, unexpired, linked by
  no Hypothesis in either role, named by no withdrawal record).
- The `memory_control_commands` shape `CHECK`: the 0128 disjuncts verbatim plus `SUBJECT_CLARIFICATION_REQUIRED`, the
  REMEMBER answers, `RECONFIRMED` and `CORRECTED_TO_EXISTING`, and (L-11, §14) the subject question of a correction,
  which names its target.
- `server_finalize_memory_control_turn_v2` (lock order: turn → answered command → owner advisory lock → Memory rows `FOR
  UPDATE ORDER BY id` → writes), `background_record_memory_v1`, `pending_memory_subject_clarification_v1`,
  `pending_memory_correction_subject_clarification_v1` (L-11, §14), and four
  internal helpers with no grant (status-only supersede, the lock, the subject read, the disposition writer).
- CC-M1 (0028 L2 + one Step-B line), CC-M2′ / CC-M3′ (0151 L1 / L3), CC-H1 (0033 completion + one line).
- `REVOKE EXECUTE … FROM service_role` on the six legacy writers (bodies unchanged).

**TypeScript (API):**
- *Subject identity:* `memory-subject.ts` (the embed and its fail-safe reading); every Memory read embeds
  `memory_subject_attributions(subject)`; `MemoryRecord.subject`. The subject screen: step 1 is the closed first-person
  grammar (`recognizesFirstPersonStatement`), steps 2–4 `screenMemorySubject`; the answer parser `readSubjectAnswer` (A1
  C3.3, closed list); a correction whose words name no subject carries `asSaid` and inherits its target's subject in SQL.
- *Memory control:* REMEMBER asks the locked question when the subject is undecided and keeps it from the question turn's
  words after the answer; the plan names the equivalent the server found and carries `subject`, `replyIfExisting`;
  equivalent copies are offered once (`collapseEquivalents`), per subject — the same words about the user and about
  someone else are two candidates, and an unattributed copy goes with the attributed fact of its words (RC-C2, §13); the inspection lists Memories about other people in their
  own section (locked copy, CQ-1 form when first). The Conversation repository finalizes through v2.
- *Evidence / retrieval:* `projectEligibleEvidence` admits SELF only (CC-M1-TS); every served Memory carries `about`
  (`USER` / `SOMEONE_ELSE` / `NOT_RECORDED`) and the memory-context guidance carries the RC-2 sentence (MF-1).
- *Background:* `recordMemory` → `background_record_memory_v1(p_source_turn_id, …)`; non-write answers complete as no
  fresh Evidence; `ALREADY_RECORDED` completes with the returned id.
- *Hypotheses:* CC-H1 `NO_SUPPORTING_EVIDENCE` after `EVIDENCE_OUTSIDE_REQUEST` and `EVIDENCE_ROLE_CONFLICT`.
- *Dead writers removed:* `MemoryRuntimeService.create / markDeleted / supersede`, the three `MemoryRepository` write
  methods, `MemoryWriteService` and the then-unused `MemoryServiceRoleApiService` (+ specs).

**Harnesses:** the A2 e2e smoke PG adapter writes through `background_record_memory_v1` (K-3); the CI-01 harness speaks
v2, the pending subject read and the subject embed, records each Memory's subject, the personal Evidence at the end, the
served `about`, and the reliance at every labelled snapshot; fixtures P2, C3 and F2.

### 3. Subject attribution and legacy data

| Path | Subject | Proven by |
|---|---|---|
| Background first-person capture | SELF / `FIRST_PERSON_CAPTURE` (+ execution) | verify-0152 R2 / background section; CI-01 every capture |
| Explicit remember, decisive screen | SELF or OTHER / `EXPLICIT_STATEMENT` | route spec S-3; CI-01 P1.5 (OTHER), P2.1 (OTHER), P2.2 (SELF) |
| Explicit remember, undecided | the locked question; nothing stored | route spec; verify-0152 S-1; CI-01 P2.3, P2.5 |
| The answer | `USER_CLARIFIED` from the question turn's words; «لا» keeps nothing; anything else lapses | route spec; verify-0152 S-1; CI-01 P2.4, P2.6 |
| Correction, decisive / undecided | `EXPLICIT_STATEMENT` / `CORRECTION_INHERITED` (an UNATTRIBUTED target gives an UNATTRIBUTED successor) | route spec; verify-0152 D-1 |
| Re-confirmation of an unattributed fact | `RECONFIRMED`: one attributed successor, lineage kept | route spec; verify-0152 D-1, L-2 |
| Legacy rows | SELF only for fixture (a) of the matrix (a)–(g); `memories`, `hypotheses`, history and withdrawal rows byte-identical | verify-0152 L-1 on a fresh scratch database |

S-3 table (interpreter spec): «أختي بتحب الكشري» → OTHER; «أنا بتخانق مع أختي» → SELF; «أنا بحب الطريقة اللي أخويا…» →
SELF (closed grammar); «أمي عايزاني أتجوز قريب» → OTHER; «ساكنة في طنطا», «أحمد بيحب…», «أنا عارف إن أختي…» → AMBIGUOUS;
"my sister hates kids" → OTHER; a sensitive request is declined before any question. Legacy impact on the injected
matrix: SELF 1 / UNATTRIBUTED 6; reliance before → after: only-(a) `NONE` → `NONE`, only-(g) and only-(b) `NONE` →
`NO_REMAINING_SUPPORT`, (a)+(g) `NONE` → `REVIEW_PENDING`. **Production counts are not claimed** (§12).

### 4. Duplicates, atomicity, concurrency, isolation

- **One equivalent ACTIVE fact per owner:** REMEMBER over an attributed equivalent → `ALREADY_REMEMBERED`; over only
  UNATTRIBUTED equivalents → `RECONFIRMED`; CORRECT into an existing value → `CORRECTED_TO_EXISTING` (target superseded
  status-only, no second copy); FORGET / DISABLE / CORRECT over a legacy duplicate pair change every copy with a
  compatible subject (equal, or one side unattributed), each with its disposition — a copy about someone else is a
  different fact and is never retired or kept for the user's (RC-C2, verify-0152 D-2); the background never retires or
  attributes an existing row (`EQUIVALENT_EXISTS`).
- **Lineage invariant:** every `SUPERSEDED` row has exactly one of a successor, a `CORRECTED_TO_EXISTING` target or a
  disposition (verify-0152 D-1, after every L-4 step); the export label stays "replaced by a correction".
- **Atomicity (W-5):** a failure injected after each write step — Memory insert / update, attribution, disposition,
  command, turn finalization; foreground and background — leaves nothing behind.
- **Idempotency / replay (W-6):** a replayed execution answers `ALREADY_RECORDED` with the same id; a replayed answer turn
  writes nothing; a second answer is refused 42501.
- **Races (W-2, two connections, the second shown to block):** REMEMBER vs capture of the same fact (both orders),
  CORRECT into a value being captured (both orders), two sessions remembering the same fact — exactly one ACTIVE copy
  each time. **Deadlock (W-4):** v2 FORGET against the 0151 bind guard over the same Memory, both orders, three rounds —
  no `40P01`.
- **Isolation (I-1):** RLS two-sided on both tables; v2 with a foreign turn answers nothing; a foreign target, equivalent
  or candidate is refused 42501; classes, the lock decision and the stale-capture rule never span owners.

### 5. R2 — fixed (mandatory)

01B CONFIRMED R2 (this record, 01B §4; results `3d0ff0f…`, kept unchanged as the regression evidence). 01C installs
`SKIPPED_COMMAND_TURN` in `background_record_memory_v1`: a turn a Memory command already answered — decided from the
committed `memory_control_commands` row bound to that source turn, never from its words — writes nothing, before any
create.

| Proof | Result |
|---|---|
| Route spec (`memory-control-words-answer.route.spec.ts`, real orchestrator → v2 mirror → outbox → real dispatcher → real enrichment) | the words answer «أنا بحب الكشري» forgets the chosen Memory; the evaluator still reads the words; the writer answers `SKIPPED_COMMAND_TURN`; the effect completes `NO_FRESH_EVIDENCE`; a replay of the same event writes nothing; recall does not serve the forgotten statement; an unrelated ordinary statement afterwards is captured |
| S-2b (same spec) | the subject answer «عن أختي» — which the evaluator alone would keep as the user's relationship — is the command's: `SKIPPED_COMMAND_TURN` |
| verify-0152 (real PostgreSQL) | the FORGET answer turn and the question turn: `SKIPPED_COMMAND_TURN`, replay identical; the Memory stays `DELETED`, never Evidence again; an unrelated ordinary turn is `CREATED` |
| CI-01 U1 on `b9549663b9f5eee234dabc24af664bd295326079`, identical on `38c977f051248b038cceb1763c5173fc08cce2ee` | U1.4 `FORGET/FORGOTTEN` answering the question, `ACTIVE → DELETED`, `MEMORY_WRITE … NO_FRESH_EVIDENCE`, no new row; **U1.5 `forgottenServed` = false (0 / 1)** |

### 6. CC-M1 / CC-M2′ / CC-M3′ / CC-H1

| Change | Result |
|---|---|
| CC-M1 (SQL + TS) | only SELF Memories are personal Evidence; OTHER / UNATTRIBUTED stay visible and controllable, absent from L2, generation, intent, association and Confidence; attach refused 22023 (verify-0152; evidence / parity / enrichment specs; CI-01 P1, P2 `personalEvidence`) |
| CC-M2′ | `NOT_SELF` / `UNATTRIBUTED` precede `LAPSED` (an expired unattributed row stays tainted); `CURRENT` requires SELF |
| CC-M3′ | both subject standings taint, permanently; the housekeeping still detaches only `WITHDRAWN`; property test L-4: 40 random steps, 8 Hypotheses × 2 clocks, no withheld → `NONE`; CI-01 F2: `NONE` → `REVIEW_PENDING` after the forget → still `REVIEW_PENDING` after the re-confirmation (no restoration) |
| CC-H1 | TS `NO_SUPPORTING_EVIDENCE` (zero support, contradiction-only; precedence kept) — policy and generation specs; SQL `22023 CANDIDATE_WITHOUT_SUPPORT` directly and through the grounded wrapper, ledger unchanged, a supported candidate still completes — verify-0152; the validator and the provider schema unchanged |
| PG-02 | 0151's housekeeping, link guard, bind guard and selector are byte-identical (verify-0152 catalog); verify-0151 green |

### 7. Historical verifier re-anchor census (contract §10.3, K-1 … K-3, RC-1)

| Group | Verifiers | Re-anchor | Expectations changed? |
|---|---|---|---|
| Fixture attribution (RC-1: only ACTIVE fixtures the verifier cites as the reader's Evidence; before any link) | 0006, 0008, 0021, 0027, 0028, 0032, 0033, 0034, 0035, 0036, 0063, 0072, 0151, exact-version Confidence | one `attributeFixtureSelf` call per cited fixture (`database/verifier-memory-subject-fixture.mjs`); ineligible / foreign / superseded fixtures stay unattributed | no |
| Revoked writers | 0026, 0072, 0128, 0151 | grant assertions at the 0152 terminal state (0026's replay of its own text keeps 0026's grant); body proofs run as the owner | grants only |
| 0130 | 0130 | the fixture command uses v2, so erasure is proved over the attribution table too | no |
| Pinned bodies | 0151 (L2), 0028 (none needed) | 0151 pins L2 to its 0152 body; verify-0152 proves 0152 = 0028 + one marked line | pin only |
| 0151 T5 | 0151 | the lapsed SELF fixtures are attributed while current and read 2 days later (the guard attributes only a current row) | evaluation instant only |
| Not affected | 0029 (listed by the contract; no L2 consumer fixture), all others | — | — |
| Static | W3-MEGA-M (v2 RPC pin + its planted defect), INTEL-TM-01 (K-2: 0152 admitted only through its two Controlled Changes, + 2 planted defects; census drops `MemoryWriteService`), `database/tests/memory-authority-hardening-v1` (background writer, no repository writer), `database/tests/canonical-evidence-eligibility-v1` (unchanged; a comment reworded) | — | pins only |
| Harness / smoke | A2 e2e PG adapter (K-3), Full Intelligence and Integrated Brain smoke scripts (removed service), CI-01 harness | new writer names | — |

`0133` (Supabase default privileges) needs no change: hosted == CI for every 0152 object.

### 8. Validation

**Local (on the implementation tree `023f68e4`; the `b73206bb`, `38c977f` and `b9549663` figures, where they differ, in brackets):**

| Check | Result |
|---|---|
| API typecheck (`tsconfig.json`, `tsconfig.scripts.json`) | pass |
| API Jest, full | 235 suites, 5,448 / 5,448 [5,437; 5,427; 5,422] |
| Static: MEM-AR-01 contract (new) · W3-MEGA-M · INTEL-TM-01 · CI-01 · task-closure governance · `test:database` | 40 / 40 [36; 28; 21] · 36 / 36 · 23 / 23 · 18 / 18 · 24 / 24 · 1,304 / 1,304; every `tests/*.test.mjs` file: 1,341 / 1,341 [1,337; 1,329] |
| verify-0152 on a fresh PostgreSQL 17.10 | pass, with D-2 (`38c977f`), S-2 (`b73206bb`) and O-1 (`023f68e4`) |
| Full Intelligence smoke-transport adapter test, Full Intelligence e2e smoke, Integrated Brain e2e hardening v2, A2 e2e smoke, on a fresh PostgreSQL 17.10 (on `b73206bb`; §15 changes none of their paths, and API CI runs them on the PR head) | 5 / 5, PASS, PASS, PASS — a local pre-check only, against a scratch in-process Redis Streams stand-in (no Redis on the development machine); the binding runs are API CI's, against `redis:7` |
| The API CI database leg, locally, PostgreSQL 17.10 (126 steps) | 119 pass; the rest are environment-only: 4 need Redis, 0133 needs `psql` (passed through a node-pg replay of the same files), 0130's known Windows clock-skew check (passes on rerun) |

**CI-01 on `023f68e4e465795fd01aac80a857cf85ccb47851`** (`scripts/ci-01/results/023f68e4e465795fd01aac80a857cf85ccb47851.json`): 14 scenarios RUN, controls hold;
against the results on `b73206bb…` the summary, controls, census and every scenario are identical once random ids and
timestamps are set aside (only the head, cluster port, nonce and timings differ): `forgottenServed` stays 0 (R2), no
scenario ends with a duplicate ACTIVE Memory, no SELF or OTHER Memory changes beyond the earlier results, and PG-02 and
the Evidence controls hold. No scenario corrects an unattributed fact beside an attributed copy of its words or asks an
ambiguous correction whose new value is already remembered, so A and L-12 leave CI-01 unchanged. Every earlier results
file is untouched.

**CI-01 on `b73206bb700d91c576eafc7824ad953bdd25a74e`** (`scripts/ci-01/results/b73206bb700d91c576eafc7824ad953bdd25a74e.json`): 14 scenarios RUN, controls hold; against the results
on `38c977f…` the summary, controls, census and every scenario are identical once random ids and timestamps are set
aside (only the cluster port, nonce, timings and the driver hash — one allowlist entry — differ): no scenario corrects an
unattributed fact into a value of an established subject or shows identical options about two subjects, so L-10 / L-11
leave CI-01 unchanged. Every earlier results file is untouched.

**CI-01 on `38c977f051248b038cceb1763c5173fc08cce2ee`** (`scripts/ci-01/results/38c977f051248b038cceb1763c5173fc08cce2ee.json`; local PostgreSQL 17.10, 152
migrations, provider doubles, network guard; every earlier results file untouched, `b9549663…` included): 14 scenarios RUN,
controls hold (two-sided isolation, 0 content leaks, 0 outbound attempts), 0 foreground errors. Against the results on
`b9549663…` every scenario summary is identical and the bodies differ only in the random ids of F1 / F2 fixture
Hypotheses — no scenario holds the same words about two subjects, so RC-C2 leaves CI-01 unchanged. Against the 01B
results (`3d0ff0f…`) only two summaries move, both as intended; C2, F1, H1, K1, M1, N1, P1, U2 and X1 are identical.

| Scenario | Result |
|---|---|
| U1 (R2) | U1.4 `FORGET/FORGOTTEN` answering the question, `ACTIVE → DELETED`, no new row; **`forgottenServed` 1/1 → 0/1**; capture yield 3/3 → 2/3 (the words answer is no longer captured) |
| C1 (L-4) | C1.6 `CORRECT/CORRECTED_TO_EXISTING`; **`duplicateActiveAtEnd` 1 → 0**; new Memories 3 → 2 |
| C3 (new) | C3.3 `CORRECTED_TO_EXISTING` (target `SUPERSEDED`, no copy); C3.5 `ALREADY_REMEMBERED`; the restatement writes nothing; 0 duplicate actives; served `USER` |
| P2 (new) | P2.1 «أختي بتحب الكشري» OTHER; P2.2 «أنا بتخانق مع أختي كتير» SELF; P2.3 / P2.5 the locked question, nothing stored; P2.4 the answer «عن أختي» → OTHER; P2.6 «لا» → `CLARIFICATION_DECLINED`, nothing stored; personal Evidence = the SELF row only; served `SOMEONE_ELSE` / `USER` |
| P1 | P1.5 «أختي مش بتحب الأطفال» stored OTHER (the 1/3 third-party measure now names a row the user can see but that is not Evidence); personal Evidence = the two SELF rows |
| F1 | PG-02 holds: 0 injected after forget, 0 relied on after withdrawal |
| F2 (new) | reliance `NONE` → forget → `REVIEW_PENDING` → re-confirmation → still `REVIEW_PENDING` (no automatic restoration) |

**Focused Database Verification** (dispatched from `main`, selector `migration-0152`, `target_ref` = `023f68e4e465795fd01aac80a857cf85ccb47851`): run 1
[`38208191349`](https://github.com/allamqandeel/qandeel/actions/runs/38208191349) — PASS (harness `main`, 1 verifier, 1 passed), run 2
[`38208209858`](https://github.com/allamqandeel/qandeel/actions/runs/38208209858) — PASS (harness `main`, 1 verifier, 1 passed); two
consecutive fresh green runs on the same implementation SHA, with D-2, S-2 and O-1. The earlier pairs follow.

**Focused Database Verification on `b73206bb700d91c576eafc7824ad953bdd25a74e`** (before A and L-12): run 1
[`38181599496`](https://github.com/allamqandeel/qandeel/actions/runs/38181599496) — PASS (harness `main`, 1 verifier, 1 passed), run 2
[`38181746727`](https://github.com/allamqandeel/qandeel/actions/runs/38181746727) — PASS (harness `main`, 1 verifier, 1 passed); two
consecutive fresh green runs on the same implementation SHA, with D-2 and S-2. The pair on `38c977f…` follows.

**Focused Database Verification on `38c977f051248b038cceb1763c5173fc08cce2ee`** (before L-10 / L-11): run 1
[`38176554144`](https://github.com/allamqandeel/qandeel/actions/runs/38176554144) — PASS (harness `main`, 1 verifier, 1 passed), run 2 [`38176700560`](https://github.com/allamqandeel/qandeel/actions/runs/38176700560) — PASS (harness `main`, 1 verifier, 1 passed); two consecutive fresh green runs on the same implementation SHA, with D-2. The earlier pair on `b9549663…` ([`38171158583`](https://github.com/allamqandeel/qandeel/actions/runs/38171158583), [`38171378648`](https://github.com/allamqandeel/qandeel/actions/runs/38171378648), both PASS) proved the 0152 body before RC-C2. **API CI** runs on the exact PR head, which carries this record; that run is reported on PR #330 and in the G-C2 report, not here (a record cannot name the result of the commit that contains it).

### 9. Closing governance (BG-08 / BG-09)

- **Inherited items:** none (BG-05).
- **Admitted:** `QAN-BL-INTEL-03` — Hypothesis Semantic Support (R-G1a, R-G1b), owner `INTEL-SV-01`, `MEDIUM`, `DEFERRED —
  OWNED`; `QAN-BL-PRIV-03` — the export `about` field, owner `PRIV-EXPORT-01`, `MEDIUM`, `DEFERRED — OWNED`. Anti-duplication
  re-run against the register at the closing change.
- **INTEL-TM-01 R2** (observation): fixed (§5). **INTEL-TM-01 L-1:** narrowed — no new zero-support generated row;
  legacy rows under `QAN-BL-INTEL-03`.
- **Untouched:** `QAN-BL-INTEL-02` (CC-H1 refuses payloads and changes no retention; no reopen condition fires),
  `QAN-BL-QIR-01`, `QAN-BL-CTX-01`; `QAN-BL-PROD-06`: `0152` joins the undeployed catch-up with `0150` and `0151`.
- **01B limits:** L-1 («بطلت التدخين» beside «بشرب سجاير»: no lexical link, nothing inferred) and L-2 / L-3 / L-5 stay
  stated limitations by contract — BG-06 admits none of them; L-4 is closed (CI-01 C1.6 `CORRECTED_TO_EXISTING`).
- **Register:** 57 items, 26 / 2 / 10 / 19 by status, 31 / 24 / 2 by severity, recounted mechanically; mirrored in Current
  State §5. This record's banner, the Current State row, the Project Map checkpoint and the CC-H1 note in
  `docs/controlled-hypothesis-generation-v1.md` are updated in the same change.

### 10. Deployment compatibility (contract §12)

| Pairing | Behaviour | Proof |
|---|---|---|
| Old API, new database | **fails closed**: the v1 finalize and `server_create_memory_v1` are not executable by `service_role` (permission denied) — the turn fails, the `MEMORY_WRITE` effect fails; no unlocked or unattributed row is written | verify-0152 W-1 (grants, writer census); verify-0128 / 0026 (`service_role` refused) |
| New API, old database | **fails closed**: v2, `background_record_memory_v1` and the pending subject read do not exist (`PGRST202`) — the same turn / effect failure | the RPC names exist only in 0152 |

Apply the migration and release the API together. **No hosted migration or release is authorized.**

### 11. Limitations and residual risks

| # | Limitation | Disposition |
|---|---|---|
| R-G1a / R-G1b | legacy never-supported Hypotheses stay `NONE`; a candidate citing unrelated SELF Evidence is accepted | `QAN-BL-INTEL-03` |
| E-1 | the export lists Memories without whom they are about | `QAN-BL-PRIV-03` |
| L-6 | legacy rows that the five conditions cannot prove (explicit-command results, pre-ledger rows) stay UNATTRIBUTED for life: visible and controllable, never Evidence; their Hypotheses are withheld permanently | by design (A1 C1.4); the user can re-confirm (`RECONFIRMED`) for future reasoning |
| L-7 | the subject screen is a closed list (kin nouns, pronouns, first-person verbs, a complementizer rule); other wording asks the question | by design (conservative) |
| L-8 | the background TypeScript pre-screen still skips an exact duplicate before the writer, so a crash-replay of a capture whose row already exists completes with no fresh Evidence instead of `ALREADY_RECORDED` (the SQL replay rule is proven directly) | recorded |
| L-9 | Arabic subject answers and screens are Egyptian Arabic plus a minimal English list | by contract |
| L-10 | when the user's fact and someone else's carry the same words, the existing target question lists the same words twice: the options carry no subject label (no approved copy exists for one); the user answers by number | **DECIDED** by the Product Owner (2026-10-12) and implemented: approved labels (§14) |
| L-11 | an unattributed Memory is compatible with every subject (A1 C1.3, the v2 header): an undecided correction of an unattributed fact may end in an existing equivalent about someone else (`CORRECTED_TO_EXISTING`), and a command on an unattributed target retires compatible copies of either subject. The plan never offers an unattributed copy as the target while an attributed copy of its words exists, so this needs a fact whose subject was never established | **DECIDED** for the correction's new value by the Product Owner (2026-10-12) and implemented: the subject question, never an inferred merge (§14). The second half — an unattributed correction target's copies of the OLD words — **DECIDED** (2026-10-12) and implemented as correction A (§15): never retired when SELF or OTHER; FORGET / DISABLE keep the RC-C2 rule |
| L-12 | an ambiguous correction («which one?») whose new value is already remembered answers `ALREADY_CORRECT` («فاكرها كده أصلًا») from any current Memory with those words, whatever its subject (01B behaviour). It changes no Memory | **DECIDED** by the Product Owner (2026-10-12) and implemented as correction B (§15) |

### 12. Aggregate-only impact runbook (NOT executed; needs a separate explicit authorization)

```sql
SELECT m.status, coalesce(a.subject, 'UNATTRIBUTED') AS subject, count(*) AS memories
  FROM public.memories m LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
 GROUP BY 1, 2 ORDER BY 1, 2;
SELECT public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, now()) AS reliance,
       count(*) AS hypotheses
  FROM public.hypotheses h WHERE h.status IN ('ACTIVE','SUPPORTED','MIXED','WEAK','REOPENED','CANDIDATE') GROUP BY 1 ORDER BY 1;
```

No content, no id. Production impact is **not claimed** anywhere in this record.

### 13. G-C2 review corrections (RC-C1, RC-C2)

The Product Owner's independent review of PR #330 (API CI run
[`38171592904`](https://github.com/allamqandeel/qandeel/actions/runs/38171592904) on `d89b76d1`) returned two corrections,
implemented in `38c977f051248b038cceb1763c5173fc08cce2ee` on top of the first implementation and its closing change.

**RC-C1 — the Full Intelligence smoke failed at `FOREGROUND_TURN_1` ("Conversation generation failed.").** Cause,
reproduced against local PostgreSQL 17 by driving the real `MemoryRepository` and `MemoryControlRepository` through the
unchanged smoke transport: every Memory read now embeds `memory_subject_attributions(subject)`, and the smoke-only
PostgREST substitute (`pg-foreground-intelligence.adapters.ts`) refused it —
`FULL_INTELLIGENCE_E2E_UNSUPPORTED_DATA_API_REQUEST:select` from its plain-column-list rule. The orchestrator turns any
failure of the turn into its generic error, so CI showed only that. Correction (smoke-only; production error handling
unchanged):
- the substitute accepts exactly the pinned embed, on `memories` only, as the last item of a plain column list, and
  answers it as PostgREST answers the one-to-one relationship — `{ subject }` or `null` — through a correlated read on
  `(memory_id, user_id)` in the same request, under the caller's role, so the attribution table's own RLS applies;
  filters, order, limit and the RPC census are unchanged, and every other select shape still fails closed;
- refused shapes are recorded, and both smokes print them when they fail;
- `pg-foreground-intelligence.adapters.test.ts` (`test:full-intelligence-e2e-smoke-adapters`, in the API CI database leg
  before the smoke): the four production request shapes translate exactly; 18 other shapes (other tables, unknown
  relationships, extra or wildcard columns, nesting, hints, aliases, spreads, misplaced or repeated embeds) are refused;
  against real PostgreSQL the subject is read as SELF / OTHER / unattributed, another owner's Memory is neither found nor
  listed, and RLS — not the query's own filter — is what hides it.

Past `FOREGROUND_TURN_1` the same smoke then compared the second turn's `memoryContext` with a shape that predates MF-1. The
expectation now includes the served `about: 'USER'`, which the SELF attribution of the background's first-person
capture yields — a stronger assertion, not a relaxed one. `verify:integrated-brain:e2e-hardening-v2` wraps the same
substitute and needed no change of its own.

**RC-C2 — SELF / OTHER equivalence isolation: CONFIRMED and corrected.** v2 FORGET and DISABLE retired every equivalent
copy of the target whatever its subject, although the v2 header defines an equivalent with a compatible subject and
CORRECT already applied it; `collapseEquivalents` folded a SELF and an OTHER copy of the same words into one candidate,
chosen by read order. So forgetting the user's fact also deleted the identical fact about someone else (and vice versa).
Correction, the smallest compatible one:
- v2 FORGET and DISABLE retire a copy only with a compatible subject — the CORRECT predicate, verbatim; nothing else in
  0152 changes;
- the plan keeps a SELF and an OTHER copy as two candidates, so the existing target question asks (approved behaviour for
  several matches), and never offers an unattributed copy in place of the attributed fact of its words.

| Check (D-2 in verify-0152; RC-C2 cases in the route spec) | Result |
|---|---|
| FORGET targeting SELF / OTHER | only the target (and its compatible unattributed copies) is `DELETED`; the other subject stays `ACTIVE` — or `DISABLED` — with no disposition |
| DISABLE targeting either subject | the other subject stays relied on |
| An unattributed copy beside both | retired with the chosen fact; disposition names this command and the target |
| CORRECT / CORRECTED_TO_EXISTING | the other subject's copy of the old words stays `ACTIVE`; a SELF correction never ends in someone else's Memory, even when the caller names it as the equivalent |
| Same-subject duplicates, the unattributed legacy pair, R2, PG-02 | unchanged (D-1, R2, L-4, verify-0151 untouched) |
| Owner isolation, lineage, attributions | another owner untouched; no lineage violation; no attribution changed |

The new D-2 stage fails against the pre-correction 0152 body and four of the five route cases fail against the
pre-correction service (the fifth, CORRECTED_TO_EXISTING isolation, already held and stays as a guard). The static
contract adds the subject-isolation and smoke-transport detectors with seven planted defects.

**Open for the Product Owner at G-C2 (not decided here, nothing invented):** L-10 (the identical-words question carries no
subject label) and L-11 (how far an unattributed Memory's compatibility with every subject should reach). Both keep the
behaviour the approved decisions define. *(Decided on 2026-10-12: §14.)*

### 14. G-C2 Product Owner decisions (L-10, L-11)

The Product Owner approved both open points ("MEM-AR-01C — Final Product Decisions L-10 / L-11", 2026-10-12; implement the
two approved corrections only, no merge). Implemented in `b73206bb700d91c576eafc7824ad953bdd25a74e`.

**L-10 — clarification labels.** When options of the existing target question would read the same and their established
subjects differ, each option with an established subject says whom it is about, in the approved labels: «عنك إنت» /
«عن حد تاني», "about you" / "about someone else" (byte-pinned by the static contract), after the quoted words. Only where
needed: different words, or the same words with the same or no established subject, keep the existing wording exactly. An
unattributed option is never labelled. The candidate-id-to-number mapping is unchanged (a re-asked question keeps the same
labels on the same Memories); no id or internal value reaches the copy.

**L-11 — no cross-subject correction by inference.** When a correction's words do not decide the subject, its target is
unattributed, and its new value is already remembered with an established subject, the plan asks the existing subject
question («المعلومة دي عنك إنت، ولا عن حد تاني؟») instead of resolving into that Memory, and changes nothing. In 0152 (a
bounded change to the unmerged migration; Application-only was not enough, because the answer must bind to the exact
pending correction under the database's own checks):
- a shape disjunct: `CORRECT` / `SUBJECT_CLARIFICATION_REQUIRED` names its target (no result, no candidates); v2 asks it
  only for an unattributed target and only for `CORRECT` (`22023` otherwise);
- its own owner-token read, `pending_memory_correction_subject_clarification_v1` (SECURITY INVOKER, `authenticated`
  only), returning the question, its target and the words of the request that asked — through a "which one?" chain, the
  first request's words, as 0128's read does. The REMEMBER read is untouched and never returns it (REMEMBER clarification
  authority is not reused);
- v2 accepts as its answer only `CORRECTED` of exactly that target with a confirmed subject — the successor's attribution
  basis is `USER_CLARIFIED` — or `CLARIFICATION_DECLINED`; from the immediately following user turn of the same Session
  and owner, at most once (`42501` for a stale, repeated, re-asked, other-kind, other-target, other-owner or
  subject-less answer). The confirmed subject then goes through the unchanged CORRECT path: `CORRECTED_TO_EXISTING` only
  into a Memory of that subject, otherwise a new attributed successor with lineage;
- under its lock, v2 never resolves an undecided correction (no subject from the words or the target) into a Memory whose
  subject is established: that commits `TARGET_CHANGED` and changes nothing (reached only when such a Memory appears after
  the plan's read).

An unattributed correction with no remembered value of an established subject behaves exactly as before (no question; an
unattributed successor, or `CORRECTED_TO_EXISTING` into an unattributed copy).

| Check (S-2 in verify-0152; the G-C2 decision cases in the route spec) | Result |
|---|---|
| Identical SELF / OTHER options | distinct approved labels, Arabic and English; option numbers resolve to the original Memory ids, also when re-asked |
| Unrelated clarification replies | byte-identical; no label on different words or on unattributed options |
| Unattributed correction into an established subject | the question, no Memory change; never `CORRECTED_TO_EXISTING` by inference; `TARGET_CHANGED` if such a Memory appears under the lock |
| «عني» / «عن حد تاني» | `CORRECTED_TO_EXISTING` into the user's own Memory / a new OTHER successor (`USER_CLARIFIED`); the other subject's Memory untouched |
| «لا», an unrelated reply, a late or repeated answer, a mismatched answer | nothing changes; the database refuses every mismatched shape |
| "Which one?" → subject question → answer | the original request's words and the chosen fact are kept |
| Same-subject duplicates, R2, PG-02, lineage, owner isolation | unchanged: D-1 / D-2 / L-4 pass; both question and answer turns are `SKIPPED_COMMAND_TURN`; a Hypothesis on the unattributed fact stays withheld; no lineage violation; another owner reads and changes nothing |

Discrimination: against the pre-decision service and copy, 7 of the 10 new route cases fail (the other three are the
unchanged-behaviour guards); S-2 fails at its first step against the pre-decision 0152 (the shape is refused). The static
contract adds the decision detector and eight planted defects (36 / 36).

Residual for the Product Owner, not changed (outside the two decisions): L-11's second half and L-12 (§11). *(Decided on
2026-10-12: §15.)*

### 15. G-C2 final corrections (A, L-12)

The Product Owner's review of head `446e6dbb` (API CI [`38182581650`](https://github.com/allamqandeel/qandeel/actions/runs/38182581650)
SUCCESS) approved two final corrections in the same PR ("MEM-AR-01C — Final G-C2 Corrections", 2026-10-12; no new task, no
merge). Implemented in `023f68e4e465795fd01aac80a857cf85ccb47851`. The anti-duplication check found no newer commit on the branch or `main`
(`20e33ae3`) addressing either.

**A — no cross-subject old-fact retirement (0152, a bounded change to the unmerged migration).** Confirmed: in v2's CORRECT
branch the old-words loop admitted a copy when `target_subject IS NULL OR …`, so a correction of an UNATTRIBUTED fact
superseded every ACTIVE copy of its old words, SELF and OTHER included, with a `CORRECTED` disposition (reproduced on a
disposable database with the previous 0152: both copies `SUPERSEDED`). The plan never offers such a target while an
attributed copy of its words is current (`collapseEquivalents`), so reaching it needs a write between the plan's read and
the lock — or an expired attributed copy, which the loop also took. Correction, the smallest one:
- under the lock, a correction of an UNATTRIBUTED fact with a current SELF or OTHER copy of its old words commits
  `TARGET_CHANGED` and changes nothing — the existing fail-closed outcome and reply, as L-11's guard; a retry then reads
  the attributed fact as its target, and that correction takes the UNATTRIBUTED copies with it;
- the old-words loop retires only UNATTRIBUTED copies and copies with the target's own subject
  (`coalesce(subject, target_subject) IS NOT DISTINCT FROM target_subject`): an UNATTRIBUTED target retires only
  UNATTRIBUTED copies (its legacy pair, as before), and an expired SELF or OTHER copy is never retired;
- SELF and OTHER targets are unchanged (same-subject and UNATTRIBUTED copies); `CORRECTED_TO_EXISTING`, provenance,
  dispositions, versioning and the one-transaction finalization are unchanged. FORGET and DISABLE were inspected and keep
  the approved RC-C2 rule: a forget or do-not-rely request is the user's own instruction about those words, and leaving a
  copy would serve forgotten words again (R2 / U1); they are not corrections.

**B — L-12, no misleading ALREADY_CORRECT (API only).** Confirmed: an explicit correction whose old words did not resolve
to one fact answered `ALREADY_CORRECT` («فاكرها كده أصلًا») from any current Memory holding the new value — before an
ambiguous target was asked about, and whatever that Memory's subject (someone else's, or never established). Correction:
- the target is resolved first: an ambiguous one asks the existing «تقصد أنهي واحدة؟» question, and the chosen fact's
  correction then decides — `CORRECTED_TO_EXISTING` into a Memory of the established subject, a new successor, or the L-11
  subject question when the subject is unknown;
- `ALREADY_CORRECT` is claimed only when no remembered fact matches the old words any more, and only from a Memory whose
  established subject is the one the words name (the existing subject screen: «أنا …», "I …" → SELF). Someone else's fact,
  an UNATTRIBUTED one (never SELF by inference) or words that name nobody prove nothing: the turn stays ordinary
  conversation, the existing no-command path;
- no Memory changes to produce a reply; clarification binding, option numbering and stale-answer protection are the
  existing ones; Arabic and English share the one pipeline. **No new Product Copy** — every reply is an approved one.

| Check (O-1 in verify-0152; the G-C2 final-correction cases in the route spec) | Result |
|---|---|
| UNATTRIBUTED target + a SELF, an OTHER, or both copies of the old words (also with an UNATTRIBUTED duplicate, a decided subject, or `CORRECTED_TO_EXISTING`) | `TARGET_CHANGED`; no supersede, successor, attribution or disposition; PG-02 reliance and Evidence standing unchanged |
| A SELF copy committed while the correction waits on the owner lock (two connections, the wait observed in `pg_stat_activity`, no sleep as proof) | the correction blocks, then commits `TARGET_CHANGED`; both rows `ACTIVE` |
| Retry on the attributed fact; a stale target; a replayed turn | the retry corrects it and retires the UNATTRIBUTED copies (dispositions name it); `TARGET_CHANGED`; nothing written |
| Expired SELF copy of the old words | not retired; the UNATTRIBUTED fact is corrected alone |
| UNATTRIBUTED legacy pair; SELF / OTHER targets with same-subject duplicates | one fact, as before; same-subject and UNATTRIBUTED copies `CORRECTED` with dispositions naming the target; the other subject `ACTIVE`; successor attribution `EXPLICIT_STATEMENT` / `CORRECTION_INHERITED` |
| Another owner with the same words | untouched; no command |
| Ambiguous target + new value only about someone else / only the user's / both | which one? → the chosen fact corrected (a new SELF successor / `CORRECTED_TO_EXISTING` into the user's own / the L-11 subject question, then exactly that person's fact); never "already" |
| No old fact left + the new value about someone else, UNATTRIBUTED, or words naming nobody (Arabic, English) | ordinary conversation; no command; no Memory change; no "already" |
| No old fact left + the new value with the subject the words name (Arabic, English) | `ALREADY_CORRECT`, unchanged |
| «لا», a re-asked, lapsed or late answer | nothing changes |
| R2, L-10, L-11, RC-C1, RC-C2, PG-02 | unchanged: every earlier stage and route case passes; CI-01 identical |

Discrimination: against the previous 0152, O-1 fails at its first step (the old body commits `CORRECTED` and supersedes
the SELF / OTHER copies); against the previous service, 6 of the 7 L-12 route cases fail (the seventh is the justified
"already" guard). The static contract adds the correction-truth detector and five planted defects (40 / 40).

**Next gate:** G-C2 — MEM-AR-01C Final PR Review (STOP). No merge, no auto-merge, no deployment; merge only on the
Product Owner's explicit «ادمج».

### 16. Post-merge Governance Reconciliation (GOV-REC-01, 2026-10-12)

Added by `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation` (BG-09: recorded explicitly, never a quiet
rewrite). Nothing above is changed. The "Draft PR #330 … not merged" of the record banner and of the 01C slice banner,
and "Next gate: G-C2 … (STOP)", describe the state before the merge.

**GitHub truth (read 2026-10-12):** [PR #330](https://github.com/allamqandeel/qandeel/pull/330) was MERGED on 2026-10-12
at 06:08 UTC as merge commit `3bec87ac725c73db0aecc5a6fb4e01c90acce66b`, from the final head
`f98e956ddef0078908ae24dcd3c4b30f30aba6ab`. With PR #328 (`04dfbf21e8e40fe24ca042baa3e1456ac99ae798`) and PR #329
(`20e33ae3f0c7a4c95a952802d293547f1a98f676`), all three slices are merged. Migration `0152` is on `main` and not on the
hosted database (`QAN-BL-PROD-06`).

**Lifecycle:** `CLOSED / MERGED`. The closing change at 01C carried the BG-08 half: it admitted `QAN-BL-INTEL-03` and
`QAN-BL-PRIV-03`. Only the locators had drifted: Current State and the Project Map still showed 01C awaiting the merge
decision, and the backlog §9 had no `INTEL-SV-01` row and no `QAN-BL-PRIV-03` entry. GOV-REC-01 corrects them. No item,
owner or Product decision changes.
