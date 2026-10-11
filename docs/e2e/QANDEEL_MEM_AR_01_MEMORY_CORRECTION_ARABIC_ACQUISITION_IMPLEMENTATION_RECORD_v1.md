# QANDEEL — MEM-AR-01 — Memory Correction & Arabic Acquisition — Implementation Record v1

**Status:** `MEM-AR-01` — **ACTIVE.** One task contract with three ordered slices, `MEM-AR-01A` → `MEM-AR-01B` →
`MEM-AR-01C`. Only 01A is implemented. 01B and 01C are NOT STARTED.

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

**Slice:** `MEM-AR-01A` — **IMPLEMENTED — DRAFT PR OPEN — NOT MERGED.** Merge only on the Product Owner's explicit «ادمج».
No migration, no deployment.

**Branch:** `mem/mem-ar-01a-arabic-fidelity-normalization`, cut from `origin/main` `1294a69`.

**Implementation commit (the tested code tree):** `0815ff3f56fde97f4dab04bd768b17f96bc4baf1`.
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
| API CI on the PR head | see the PR; reported at the review gate |

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
| K1.9 | served 2 (one through «إني») | served **2** | The «إني» hit is gone. The second item is now the newly captured K1.4 «بحب السفر…», reached through the shared predicate «بحب». The contract's "K1.9 serves 1" assumed K1.4 stays uncaptured. Removing it would need a ranking change, which 01A excludes. Recorded for review (§4, item 2) |
| M1 | M1.4 «ليه أنا دايما …» → `NO_TRIGGER` | M1.4 → **`TRIGGER EXPLICIT_WHY_SELF`** (+1 Hypothesis) | F-3 effect. Capture is still 1/4 (compound turns; Stage 8A) |
| U2 (new) | — | capture 5/9 (by design); fact 1/1; recall 1/1; **0 duplicate ACTIVE rows** | U2.2 (tatweel) and U2.4 (Arabic-Indic digits) are already remembered. U2.6 is a duplicate. U2.8 «بطلت أشرب قهوة» beside «أنا بحب القهوة» writes nothing. U2.9 «بطلت السهر» and U2.10 «بحب السفر» are captured as said |
| C1, P1, H1, X1 | — | identical to `272a567` | Not 01A's scope. Correction, third party and HIM are unchanged |
| F1 | 1 Hypothesis (from the F1.2 trigger) | **0 Hypotheses**; `pg02DependedOnWithdrawnOrCorrected` 0 | See §4, item 1 |

**Controls:**
- User isolation holds on both sides: owner reads equal ground truth; the non-owner reads nothing by user id, by row
  id, unfiltered or through retrieval.
- The isolation result is `holds: false` only because one non-vacuity flag, `ownerHypothesesSeen`, is false (§4,
  item 1). Memory and retrieval non-vacuity are true.

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
   - **Proposed:** a later CI-01 maintenance replaces F1.2 with a genuine contradiction turn, e.g. «أنا قررت أنام بدري بس
     دايما بسهر». It needs a Product Owner decision and an owner.
2. **K1.9 serves 2, not 1** (§3).
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

**Next gate:** G-A1 — MEM-AR-01A Review (STOP). Nothing of 01B or 01C is started. Migration `0152` is not created.
