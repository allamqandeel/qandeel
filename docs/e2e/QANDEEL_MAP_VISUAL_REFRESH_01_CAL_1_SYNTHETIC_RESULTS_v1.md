# QANDEEL MAP-VISUAL-REFRESH-01 — CAL-1: Synthetic Calibration Results v1

**Status:** `RESULTS RECORDED — ACCEPTED BY THE PO AS RECORDED (2026-11-09), INCLUDING THE Q1 FAILURE — NOT A PRODUCTION APPROVAL`
**Parent:** [CP-A contract record](QANDEEL_MAP_VISUAL_REFRESH_01_CP_A_PERSONAL_MAP_TOPICS_CONTRACT_RECORD_v1.md) §12.
**Harness location:** outside the product tree (`E:\QANDEEL_REPORTS\MAP-VISUAL-REFRESH-01\IA-GATE\CAL-1\`: `cal1-lib.mjs`, `cal1-dev.mjs`, `cal1-eval.mjs`, `prereg.json`, `out/`). The harness is not part of this PR; the file names below refer to that folder.

---

**Date:** 2026-11-09
**Authorization:** PO decision on Annex 2 §8: synthetic only, no real data, no paid calls.
**Code:** `cal1-lib.mjs` (generator, predicate, extraction, metrics), `cal1-dev.mjs` (development), `cal1-eval.mjs` (single preregistered evaluation).
**Outputs:** `out/dev-results.{json,txt}`, `out/eval-results.{json,txt}`, `out/eval-by-family.txt`.
**Preregistration:** `prereg.json`, sha256 `a17c478b…a4fae9` in `prereg.sha256`.

## 1. What was tested, and what was not
- **Tested:**
  - the pair-level association predicate `REL = ≥K current shared Readings over ≥S Sessions`, minus user vetoes;
  - three ways of extracting **candidate packages** from the association graph:
    - **E**, ego sets: one Thread plus everything associated with it, maximal sets only;
    - **Q**, maximal cliques;
    - **C**, connected components (reference only).
- **Not tested:**
  - real binding behaviour (CAL-2);
  - N4 or name quality (that needs the model itself, PO §8);
  - any user or AI data.
- **The labels:**
  - **Labels are fixed by each scenario's declaration before evidence is generated:**
    - topic membership (DENSE or STAR with a hub);
    - declared influence pairs (meaningful, but between different topics);
    - incidental pairs (one-off, and **repeated** 2–3 times).
  - **They are not derived from the rules under test.** They were authored by me in code, not reviewed by the PO.
  - The generator *assumes* how bindings are produced, which is the main limitation.

**Families** (8; required by PO §8 and §1):
- F1, one multi-facet topic: a hub with facets that are not linked to each other (**PO case 1**);
- F2, two topics with mutual influence;
- F3, overlapping topics;
- F4, repeated incidental links;
- F5, evidence withdrawn and partly restored;
- F6, user corrections (the user vetoes the incidental associations they see, twice per persona);
- F7, should abstain (no topic at all);
- F8, a star topic with a bridge to another topic.

**Scale** (**PO case 2**): synthetic worlds with 45, 134, 267 and 517 Threads, plus an adversarial worst case for cliques.

## 2. Protocol
1. **Development** on seeds 1–30 for each family, with noise ×1.0. A K/S grid (K 1–3, S 1–3) × methods E/Q/C.
2. **Preregistration** at `2026-11-09T20:35:43Z`, **before** any evaluation run.
   - It records the config (K=2, S=2), the methods and the evaluation set (seeds 1001–1060, **incidental noise ×1.5** as a declared held-out shift).
   - It records 16 criteria and the **sha256 of the harness**.
   - The evaluation runner refuses to run if the harness changed, or if it has already run once.
3. **One evaluation run.** No re-run, no tuning after it.

**The thresholds are my registered proposal, not production values. K/S stay unapproved.**

## 3. Results of the final evaluation (K=2, S=2; 60 personas × 8 families)
| ID | Kind | Criterion | Observed | Result |
|---|---|---|---|---|
| G1 | hard gate | order invariance: final state unchanged when the same evidence arrives in another order (1,260 checks) | 0 differences | **PASS** |
| G2 | hard gate | no duplicate candidates | 0 | **PASS** |
| G3 | hard gate | a user veto never recurs | 0 | **PASS** |
| G4 | hard gate | corrections reduce false associations (F6 vs F4 precision) | 0.846 vs 0.529 | **PASS** |
| Q1 | threshold | association precision ≥ 0.75 (E, all except F7) | **0.699** | **FAIL** |
| Q2 | threshold | association recall on observable meaningful pairs ≥ 0.45 | 0.549 | PASS |
| Q3 | threshold | topic recovery (best Jaccard ≥ 0.75) ≥ 0.40 | 0.439 | PASS |
| Q4 | threshold | multi-facet (star) topic mean Jaccard ≥ 0.50 | 0.591 | PASS |
| Q5 | threshold | spurious candidate share ≤ 0.40 | 0.399 | PASS (marginal) |
| Q6 | threshold | fragments per topic ≤ 2.0 | 1.73 | PASS |
| Q7 | threshold | relation coverage = 1 | 1 | PASS |
| Q8 | threshold | churn (candidate-set changes per evidence event) ≤ 0.30 | 0.225 | PASS |
| H1 | comparative | E recovers topics better than Q | 0.439 vs 0.249 | PASS |
| H2 | comparative | E has fewer spurious candidates than Q | 0.399 vs 0.627 | PASS |
| H3 | expected FAIL | Q on star topics ≥ 0.50 | 0.348 | **FAIL, as registered:** cliques split a hub-and-facets topic into pairs |
| A1 | expected FAIL | candidates in should-abstain worlds ≤ 0.5 per persona | 3.23 | **FAIL, as registered:** L1 cannot abstain |

**By family, for E** (`out/eval-by-family.txt`):
- star recovery holds in F1 (J 0.644) and F8 (0.539);
- influence pairs fragment F2 (2.22 fragments per topic);
- repeated incidental links drive precision to 0.529 in F4;
- **43% of all false associations (433 of 1,001) come from repeated incidental pairs.**

**C** merges influenced topics (F2 recovery 0.017) and is rejected, consistent with Annex 2.

## 4. Scale and limits (development, K2S2)
| World | Threads | Associations | Q: cliques / max size / max per Thread / time | E: candidates / time | Recovery Q vs E |
|---|---|---|---|---|---|
| 8 topics | 45 | 52 | 26 / 4 / 7 / 0.06 ms | 11 / 0.6 ms | 0.50 vs 0.875 |
| 24 topics | 134 | 178 | 97 / 4 / 6 / 0.34 ms | 55 / 0.2 ms | 0.33 vs 0.83 |
| 48 topics | 267 | 381 | 172 / 5 / 7 / 1.0 ms | 94 / 0.6 ms | 0.48 vs 0.79 |
| 96 topics | 517 | 767 | 311 / 5 / 7 / 3.5 ms | 177 / 2.4 ms | 0.53 vs 0.87 |

**The adversarial worst case for cliques** (Moon–Moser graphs, 3^(n/3) maximal cliques):
- 18 vertices: 729 cliques in 0.4 ms;
- 24 vertices: 6,561 in 4.9 ms;
- 30 vertices: 59,049 in 75 ms;
- 36 vertices: **stopped at the 200,000-clique cap** after 266 ms (531,441 theoretical).

**E is bounded by construction:** at most one ego set per Thread. Times are on this machine and are characterisation only.

## 5. What CAL-1 establishes
1. **The deterministic properties hold:**
   - order invariance;
   - no duplicates;
   - vetoes stay vetoed;
   - corrections measurably reduce false associations.

   This fixes the R1–R6 failures.
2. **A count predicate cannot separate a repeated incidental link from a real one.**
   - At K2S2, precision fails the registered threshold under higher noise (Q1).
   - Raising K buys precision at the cost of recall. In development, K3 gave precision 0.89 but recall 0.32.
   - **Consequence:** L1 must stay non-semantic, as the PO decided. Abstention cannot be L1's job (A1). It belongs to **N4 and the user**.
3. **Ego sets (E) are the better candidate packages:**
   - they recover multi-facet topics (PO case 1) that cliques split (H3);
   - they produce fewer spurious candidates;
   - they are bounded at scale.

   Q remains useful only as internal structure.

   **Neither is a topic law:**
   - topic recovery is 0.44 at best;
   - candidates are evidence packages offered to N4 or the user, never topics.
4. **Candidates churn** in about 22% of evidence events. L2 must not mirror L1. N4 needs material-change and debounce rules (CP-A §5).
5. **Not shown** (and claimed nowhere): real-data accuracy, N4 name quality, emergence speed on real conversations.
