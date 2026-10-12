# QANDEEL — GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation — Record v1

**Task:** `GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation`. The name was APPROVED by the Product Owner
on 2026-10-12.
**Backlog:** `QAN-BL-GOV-01` (admitted by ACE-SP-01).
**Task type:** documentation / governance only. It is not a Product stage and does not start Stage 6.
**Kickoff baseline:** `main = 84dd486c905cd3512bb206e48a2d7a63aa1c2d9b`, the merge of PR #333 (ACE-SP-01). It was
verified on GitHub at kickoff and matched the Product Owner's stated starting point.
**Branch:** `gov/gov-rec-01-post-merge-reconciliation`.
**Status:** `GOV-REC-01 — CLOSING CHANGE COMPLETE IN PR #334 · CLOSED FROM THE MERGE OF PR #334 · MERGE ONLY ON THE PRODUCT OWNER'S ORDER · NO RUNTIME CHANGE`.
If the PR is not merged, nothing here is closed. The banner needs no successor edit: it becomes true at the merge.

> This reconciliation changes no code, migration, API, screen, copy, Product decision, sequencing decision or frozen
> contract. Every correction is recorded explicitly, and every superseded statement that is history is kept and labelled
> (BG-09).

---

## 1. Authority and rules

The Product Owner's *GOV-REC-01* brief (2026-10-12) is the authority. Its rules:

- Path: Research → Repo Truth → Anti-duplication → Scoped Changes → Proportional Validation → Review → PO Merge Approval.
- No production code, migration, API or UI change. ACE-SP-01, the Matching runtime and every frozen contract stay closed.
- No mass replacement of `ACTIVE` / `NOT MERGED`. Original history is kept; each later correction is documented.
- Issue #322 stays open. Merging PR #321 is not proof of the physical-device test.
- A new backlog commitment the Product Owner has not approved is presented to the Product Owner first, not admitted.
- No merge or auto-merge without the Product Owner's explicit order.

---

## 2. GitHub truth (read with `gh` at kickoff, 2026-10-12)

| PR | Task | State | Merge commit | Merged (UTC) | Final head |
|---|---|---|---|---|---|
| #321 | SHARED-VIS-01 — Shared World Living Analysis Map Product Integration (`QAN-BL-CW-03`) | MERGED | `5973123153e26494d702a4a859a79631ede225cd` | 2026-10-09 07:29 | `8563e5699a100fe88c3e5ef451ca825c98d4c18e` |
| #325 | CI-01 — Intelligence Evidence, Personality & Synthetic Baseline | MERGED | `44a440cfbb2c05421ed36639a5cf67ee7a8d25e5` | 2026-10-10 14:17 | `2d81a168b2fc4e2058084f6cfc468dcfaff3489f` |
| #326 | INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02; `0151`) | MERGED | `995d5ae9bf2530ac8e655b870526e0976be7cbf4` | 2026-10-10 18:00 | `1eac0731d70c038ffeaaf5123251ff2dafff9ecd` |
| #327 | INTEL-TM-01 — post-merge BG-08 / BG-09 closure | MERGED | `1294a6929655bd36cad6cea873836feca8dbc91f` | 2026-10-10 18:21 | `8aab2a84eb8730768390385c4539f261c148c964` |
| #328 | MEM-AR-01A — Arabic Memory fidelity & normalization | MERGED | `04dfbf21e8e40fe24ca042baa3e1456ac99ae798` | 2026-10-11 17:38 | `d4988780d60e2e10286878ae55c5396d2ce4ec16` |
| #329 | MEM-AR-01B — Natural Reversal & Memory Correction | MERGED | `20e33ae3f0c7a4c95a952802d293547f1a98f676` | 2026-10-11 18:37 | `3ad0fe76d4f5e514001dfc26212c115ff018e2b1` |
| #330 | MEM-AR-01C — Memory Subject Identity, Atomicity & Evidence Protection (`0152`) | MERGED | `3bec87ac725c73db0aecc5a6fb4e01c90acce66b` | 2026-10-12 06:08 | `f98e956ddef0078908ae24dcd3c4b30f30aba6ab` |
| #331 | IP-IMP-01 — Interaction Preferences (`0153`) | MERGED | `424cd0231429e5280a0e70be25c2f83437e117c8` | 2026-10-12 09:37 | `cad6e66ab98dc3d3e69cc84573907d41423d88b3` |
| #332 | ACE-01 — Adaptive Conversational Expression v1 | MERGED | `141a3190deb02bc6695d2ace05da275e623a2754` | 2026-10-12 16:19 | `94fc3d76b3e729cd229f2334cfea61f01890fb48` |
| #333 | ACE-SP-01 — Shared / Public QANDEEL Personality Core | MERGED | `84dd486c905cd3512bb206e48a2d7a63aa1c2d9b` | 2026-10-12 19:45 | `dbd3329f9f78bf17622862a599351ff15428a622` |

Every expected state matched, so there was no discrepancy to stop on. None of these is deployed: the hosted database was
at `0074` at the last approved check, and `QAN-BL-PROD-06` stands.

**The Product Owner's merge decision on PR #321** (a PR comment of 2026-10-09) approved merging the exact head `8563e56…`.
It made release a NO-GO until Issue #322 is fulfilled and closed with physical-device evidence. It also said that green
CI and the emulator TalkBack tests do not waive that condition.

**Issue #322** — *[PRE-LAUNCH BLOCKER][SHARED-VIS-01] Physical Android rapid interaction & resize stability proof* — is
**OPEN**, created on 2026-10-09, with no comments. It requires a physical Android phone on a release-representative build,
covering both Living Analysis consumers (Shared and Public). The test is at least 12 panel-scroll-Back cycles and 4 rapid
open / Back cycles. A pass needs no ANR, unrecovered stall, lost touch, persistently missing labels or wrong focus, plus
auditable proof. Without a device the result stays NOT PROVEN / LAUNCH BLOCKED. Owner: the Stage 9 Economy + Launch Closure
/ release-readiness gate, or an earlier explicit validation owner.

---

## 3. Anti-duplication — what earlier reconciliations already did

| Earlier change | What it already reconciled | What GOV-REC-01 does not repeat |
|---|---|---|
| ROADMAP-REC-01 (through PR #305) | the 9-stage map, W3 / VPORT / PROD rows, trap rows for merged-but-banner-stale records | its rows and banners; its precedent (`**Status:**` = current truth, the old banner kept as history) is followed |
| SHARED-VIS-01 itself (2026-10-08) | Stage 5 DONE / MERGED (PR #319, #320) | the S5 rows |
| INTEL-TM-01 post-merge closure (PR #327) | the CI-01 row of Current State (DONE / MERGED through PR #325), the INTEL-TM-01 row and checkpoint, the `QAN-BL-INTEL-01` tombstone | the CI-01 and INTEL-TM-01 rows; only the remaining CI-01 labels (§4 "local, not merged"), the baseline banner and the stale checkpoint headings are touched |
| MEM-AR-01 / IP-IMP-01 / ACE-01 / ACE-SP-01 closing changes | each one's own backlog admissions and dispositions | no item is re-admitted or re-owned |

---

## 4. Files changed and why

| File | Correction (before → after) |
|---|---|
| `QANDEEL_CURRENT_STATE.md` | **§1:** a GOV-REC-01 entry in the snapshot chain, and the stray table separator moved to the end of that cell. **§3.4:** the I-07 row's PROD-RETRY-01 label "not merged" → merged through PR #324. **§3.6:** "S4-04 (open PR)" / "S5-04 (closed, not merged)" → merged, PR #313 / #319. **§3.7:** the intro "merged except five … SHARED-VIS-01 is not merged" → "except two", with the merges listed and the old sentence quoted. SHARED-VIS-01 row: ACTIVE / NOT MERGED → `CLOSED / MERGED` through PR #321, Issue #322 kept OPEN, the old text labelled *(At the time)*. MEM-AR-01 row → `CLOSED / MERGED` (01C, PR #330). **New rows:** IP-IMP-01 (PR #331) and ACE-01 (PR #332) — finding 1. ACE-SP-01 row → `CLOSED / MERGED` (PR #333). **§4:** the CI-01 C1-B, S4-04 and S5-04 labels, plus a dated note that the C2 slices merged. **§5:** counts 57 → 62 (26 / 4 / 10 / 22; 31 / 29 / 2) and the update paragraph — finding 5. The active list goes from 38 to 40 rows: CW-03 removed; IP-01, IP-02 and ACE-02 added. **§7:** the GOV-REC-01 checkpoint; the Stage 4 bullet (SHARED-VIS-01 DONE / MERGED); Stage 6 **NEXT** with 7 / 8A / 8B / 9 **LATER**, the old "Stages 6–9 are LATER" quoted; a dated C2 note. **Owners table:** the SHARED-VIS-01 row is delivered; new rows for the Stage 9 Issue #322 gate and `PUBLIC-PREF-01`; Stage 8A lists its three items; PRIV-EXPORT-01 lists PRIV-01 … 03 |
| `QANDEEL_PROJECT_MAP.md` | **§2:** this record located. **§5:** a new CURRENT checkpoint (GOV-REC-01, GitHub truth, execution status, Issue #322). The MEM-AR-01, INTEL-TM-01 and CI-01 checkpoint headings are relabelled historical, with their original labels quoted. The INTEL-TM-01 "later proposed C2 slices" line gets a dated note — finding 1. The post-P4 "Current sequence" is labelled "as last reconciled on 2026-10-04". **§5.1:** the status header; Stage 4 → SHARED-VIS-01 DONE / MERGED (old text quoted) — finding 3; Stage 6 → **NEXT** (it was LATER). The current-task line → `CURRENT TASK: GOV-REC-01`; the SHARED-VIS-01 paragraph is kept verbatim under *(Historical, SHARED-VIS-01:)*. **§6:** a trap row for the merged records' pre-merge banners; the register count trap → 62 at PR #333 |
| `QANDEEL_PRODUCT_ROADMAP.md` | a new §6.6 execution note: the merges, the execution status (Stages 1–5 DONE / MERGED; GOV-REC-01 current; Stage 6 NEXT; 7 / 8A / 8B / 9 LATER), and Issue #322 and the hosted gate unchanged. §6.2 and §6.5 are left as written and named as dated |
| `docs/qandeel-canonical-backlog-v1.md` | **§4:** `QAN-BL-CW-03` and `QAN-BL-GOV-01` → `CLOSED — TOMBSTONE`. **§5:** both blocks get the historical pre-closure note. The GOV-01 owner line says APPROVED, with the old wording quoted. CW-03 gets a GOV-REC-01 current-truth note. **§6:** the `QAN-BL-ACE-01` tombstone gets its merge SHA (old wording quoted), plus two new tombstones, CW-03 (retroactive) and GOV-01. **§7:** the counts table → 26 / 4 / 10 / 22; the ACE-SP-01 paragraph's "name proposed …" → APPROVED (old wording quoted); a GOV-REC-01 reconciliation paragraph. **§9:** the Stage 8A row adds `QAN-BL-IP-02` — finding 4. Entries are added for eight open items whose owner had none (PROD-04, PROD-05, LAUNCH-03, CI-01, MATCH-01, INTEL-03, PRIV-03, IP-01), plus task rows for MEM-AR-01 and IP-IMP-01. The SHARED-VIS-01 and GOV-REC-01 rows record their closures |
| `docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md` | the ACE-SP-01 amendment row's lifecycle cell adds "merged by PR #333 at `84dd486c`", as the CW2-08A row does for PR #278. The amendment's own bytes are untouched |
| `docs/e2e/QANDEEL_SHARED_VIS_01_…_RECORD_v1.md` | `**Status:**` → `CLOSED / MERGED …`, with the old banner kept verbatim. "Closure waits on" is labelled historical. A new **§15 Post-merge Governance Reconciliation** — finding 3 |
| `docs/e2e/QANDEEL_IP_IMP_01_…_RECORD_v1.md` | `**Status:**` → `CLOSED / MERGED` through PR #331, with the old banner kept verbatim; a new **§12** — finding 2 |
| `docs/e2e/QANDEEL_ACE_01_…_RECORD_v1.md` | `**Status:**` → `CLOSED / MERGED` through PR #332, with the old banner kept verbatim; a new **§13** — finding 2 |
| `docs/e2e/QANDEEL_ACE_SP_01_…_RECORD_v1.md` | `**Status:**` → `CLOSED / MERGED` through PR #333, with the old banner kept verbatim. §10's owner-name line → APPROVED, old wording quoted. A new **§12** |
| `docs/e2e/QANDEEL_MEM_AR_01_…_RECORD_v1.md` | `**Status:**` → `CLOSED / MERGED`, all three slices, with the old banner kept verbatim; a new 01C **§16** |
| `docs/intelligence-evidence-baseline-v1.md` | `**Status:**` → CI-01 DONE / MERGED through PR #325, with the old banner kept verbatim. A §2 reading note. Rows C-22, C-23, C-30 and C-31 are marked "historical at `census-v1 @ 6a5fa42`". A new **§2.3 Post-merge notes** gives the after-state of those four rows from the merged records. The D10 row, the two §6 gap rows and §8 note 1 get dated notes. No measurement, figure, SHA or census version changed — finding 6 |
| `docs/conversational-personality-v1.md` | a post-merge note under the banner: CI-01 merged; the design was later realized by ACE-01, ACE-SP-01 and IP-IMP-01. The banner itself (pinned `DESIGN ONLY`) is unchanged |
| `docs/e2e/QANDEEL_GOV_REC_01_…_v1.md` | this record (new) |
| 6 static contracts | validation-only re-anchors (§8) |

**Not changed** (as reviewed): the CI-01 C0 report, its annex and the C1 Task Contract keep their pre-merge banners as process
history (Project Map §6 trap row). The backlog's dated notes ("PR open", "Draft PR, not merged") describe their own dates;
the GOV-REC-01 §7 paragraph says so once instead of rewriting each. The ACE-SP-01 controlled amendment, every CW2 file and
`CW2_SOURCE_PROVENANCE.sha256` are untouched. No file under `apps/`, `packages/` or `database/` changed, nor any workflow,
`package.json` or migration.

---

## 5. BG-05 / BG-08 / BG-09 reconciliation

- **Kickoff (BG-05):** one inherited item, `QAN-BL-GOV-01` (owner `GOV-REC-01`), included in this task. No other item names
  GOV-REC-01.
- **`QAN-BL-GOV-01` → `CLOSED — TOMBSTONE`**, holding from this PR's merge. Each of its six findings is corrected (§4).
  The comprehensive search found more of the same drift, and it was corrected the same way.
- **`QAN-BL-CW-03` → `CLOSED — TOMBSTONE`**, retroactively for SHARED-VIS-01 (PR #321, `5973123…`). It holds from this
  PR's merge.
  - **Why late:** SHARED-VIS-01's planned closing change never landed. BG-09 allows exactly this repair: an explicit
    governance reconciliation that records the correction and reopens no Product semantics.
  - **Scope check:** the item's Scope and each Required future property were checked against the merged record (§3–§9,
    §13, §14). No gap inside the item's own scope was found.
  - **"Grows from Shared-native truth over time":** the production producer refuses until Stage 8A binds a provider (D2).
    That binding is Stage 8A's delivery objective.
  - **"Time state":** no Shared Timeline, by D5; that is `QAN-BL-CW-07`.
  - **Parts dispositioned elsewhere by the Product Owner:** `QAN-BL-CW-05` … `07`, and `QAN-BL-VIS-01` for scale.
- **ACE-01 tombstone:** the merge SHA is filled in, and the pre-merge wording is kept (the `QAN-BL-CW-01` precedent).
- **§9 inheritance:** checked mechanically. Every open item with a named owner now appears in its owner's §9 row. Before
  this change, nine did not: IP-02 under Stage 8A, plus the eight listed in §4. No owner, scope, severity or status
  changed.
- **Admitted:** none (§7).
- **Counts, recounted mechanically from §4** (one row per ID):

| | Before | After |
|---|---|---|
| Total | 62 | 62 |
| `DEFERRED — OWNED` | 28 | 26 |
| `VALIDATION — OPEN` | 4 | 4 |
| `OPEN — UNASSIGNED` | 10 | 10 |
| `CLOSED — TOMBSTONE` | 20 | 22 |
| `HIGH` / `MEDIUM` / `LOW` | 31 / 29 / 2 | 31 / 29 / 2 |

  These equal the Product Owner's expected figures, computed independently from the edited index, not copied.
- **BG-09 for this task:** the banner above states the lifecycle this change creates. No successor task is needed to
  finish it: the PR number is the only identifier added after the PR opens, in a documentation-only commit of this same
  PR.

---

## 6. Final state of the two items

| Item | Before | After (from this PR's merge) |
|---|---|---|
| `QAN-BL-CW-03` — Shared World Living Analysis Map / Semantic Geography Product Integration | `DEFERRED — OWNED`, owner SHARED-VIS-01, no disposition after the merge | `CLOSED — TOMBSTONE`. Closing task SHARED-VIS-01; PR #321, `5973123153e26494d702a4a859a79631ede225cd`; recorded retroactively by GOV-REC-01 |
| `QAN-BL-GOV-01` — Locator and Closure-Record Drift | `DEFERRED — OWNED`, owner name "proposed" | `CLOSED — TOMBSTONE`. Closing task GOV-REC-01 (name APPROVED, 2026-10-12); this PR |

---

## 7. Issue #322 — status, and the one Product Owner decision

- **Status:** `OPEN / NOT PROVEN / RELEASE BLOCKER`. It is not closed and not touched. The locators state it everywhere
  SHARED-VIS-01 is recorded merged: Current State §3.7, the §7 owners table, the Project Map checkpoint and §5.1, Roadmap
  §6.6, the SHARED-VIS-01 record §15 and the `QAN-BL-CW-03` tombstone.
  - The tombstone states that neither it, the merge, green CI nor the emulator proofs are device evidence.
- **Backlog coverage:** none today, and nothing was duplicated.
  - `QAN-BL-NOTIF-05` covers the native-Push physical-device Exit Gates (PD-01 … PD-09) only.
  - `QAN-BL-VIS-01` covers heavy-history scale, LOD and real-device scale performance. It does not cover
    rapid-interaction or resize stability.
  - No item names Issue #322.
- **Decision for the Product Owner.** Should Issue #322 be admitted to the register as one item?
  - **Proposal (not admitted):** title *Shared / Public Living Analysis — Physical-Android Rapid-Interaction & Resize
    Stability Proof (Issue #322)*.
    - Owner: `Stage 9 — Economy + Launch Closure (release-readiness gate)`.
    - `HIGH`, `DEFERRED — OWNED`.
    - Reopen condition: automatic at Release Hardening & Launch, and before any public production launch.
    - Required future property: exactly the issue's evidence list.
  - **Why it is raised:** BG-08 (4) prefers that a qualifying residue not live only outside the register. Today it lives
    in the issue, the PR #321 decision and the locators GOV-REC-01 updated.
  - **Alternative:** keep Issue #322 as the release gate's single home, referenced from the tombstone and the locators.
  - The Product Owner's brief requires this decision before any new commitment is added, so the register stays at 62.

---

## 8. Static contracts re-anchored (validation only; none weakened)

Each re-anchor carries a dated `RE-ANCHORED by GOV-REC-01` note. Each accepts the post-merge state only together with
evidence that is at least as strong as the pre-merge assertion.

| Contract | Pre-merge pin | Re-anchor |
|---|---|---|
| `tests/ace-01-…-contract.test.mjs` (BG-08 / BG-09 test) | banner `IMPLEMENTATION COMPLETE` | or `CLOSED / MERGED through PR #332 as` the exact merge SHA — and then the historical banner must be kept |
| `tests/ace-sp-01-…-contract.test.mjs` (BG-08 / BG-09 test) | banner `IMPLEMENTATION COMPLETE`; `QAN-BL-GOV-01` `DEFERRED — OWNED` | banner: or `CLOSED / MERGED through PR #333 as` the exact SHA, with the historical banner kept. GOV-01: or `CLOSED — TOMBSTONE`, and then its §6 tombstone must name `GOV-REC-01` as the closing task |
| `tests/shared-vis-01-…-contract.test.mjs` test 7 | the Project Map's current task is SHARED-VIS-01 | or the map records "**SHARED-VIS-01 is DONE / MERGED** through PR #321 as `5973123…`". A CW-03 tombstone must name SHARED-VIS-01, carry `5973123…` and keep Issue #322 `OPEN / NOT PROVEN / RELEASE BLOCKER` |
| `tests/s5-03b-…-contract.test.mjs` | current task ∈ {S5-03C, S5-04, SHARED-VIS-01} | ∪ {`CURRENT TASK: GOV-REC-01`}; "S5-03B is not current" kept |
| `tests/s5-03c-…-contract.test.mjs` | CW-03 `DEFERRED — OWNED`; current task ∈ {…} | CW-03: or a tombstone whose closing task is SHARED-VIS-01 (not S5-03C). Current task: ∪ {GOV-REC-01} |
| `tests/s5-04-…-contract.test.mjs` | CW-03 `DEFERRED — OWNED` ("SHARED-VIS-01 is not started here") | or a tombstone whose closing task is SHARED-VIS-01 (not S5-04) |

**Mutation checks**, in memory on the edited files:
- removing the ACE-01 historical banner fails the re-anchored assertion;
- a wrong merge SHA fails;
- flipping Issue #322 to closed in the CW-03 tombstone fails;
- the old SHARED-VIS-01 current-task line is absent from the map, and the GOV-REC-01 line is present;
- Current State has no `Stage 6 … **ACTIVE` line.

---

## 9. Validation (proportional to a documentation change)

All runs are local on the branch tree. The exact commands and results are in §11 (filled in at the push).

- The four required contracts: `test:task-closure-governance-contract`, `test:ci-01-intelligence-evidence-baseline-contract`,
  `test:ace-01-adaptive-conversational-expression-contract` and `test:ace-sp-01-shared-public-personality-core-contract`.
- `git diff --check`.
- Every root static contract that reads an edited document: 23 files (the list is derived by grep over `tests/*.test.mjs`
  for the edited paths) plus `database/tests/replay-distribution-reconciliation-closure-v1.test.mjs`.
  - Baseline before any edit: 352 / 352.
  - After the edits and before the re-anchors: 346 / 352. The 6 failures are exactly the pre-merge pins in §8 (class B:
    validation expectations of a superseded state, not a defect).
  - After the re-anchors: 352 / 352. The database closure test: 15 / 15.
- **Mechanical checks:** the §4 recount (§5); §9 coverage of every open owned item; PR and SHA truth (§2); Issue #322
  still OPEN; no file under `apps/`, `packages/` or `database/migrations/` in the diff.
- **Not run, deliberately:** full Jest, Android / iOS, PostgreSQL, and the forward-safety mirror. No runtime, source tree
  or migration changed, and the re-anchored contracts keep their `existsSync` guards for the root locators that the
  mirror omits.

---

## 10. Out of scope (left as found)

- Stage 6 and any Matching work; any Product, copy, runtime or sequencing decision.
- Issue #322 and its admission (§7).
- Re-measuring any CI-01 census row. A later task that re-measures a row bumps the census version.
- The CI-01 C0 report, its annex and the C1 Task Contract banners (process history; Project Map §6).
- Pre-existing, unrelated locator wording outside the merged-lifecycle drift. One example: the Project Map §2 note that
  says `database/migrations/` runs 0001–0135 "at PR #303" is dated and correct for its date.
- Hosted deployment (`QAN-BL-PROD-06`).
- A pre-existing table glitch: the Current State §3.7 S5-03B row has no separator before its record link, so it renders
  as two cells instead of three. The row's lifecycle is correct, and the row is pinned by the S5-03B contract, so it is
  left as found.

---

## 11. PR, commits and validation results

- **PR:** Draft [PR #334](https://github.com/allamqandeel/qandeel/pull/334), `gov/gov-rec-01-post-merge-reconciliation`
  → `main`. Not merged. Merge only on the Product Owner's explicit order; auto-merge is not enabled.
- **Commits:**
  - `086325071f9147c4ba41810a6aaf91615334e36e` — the reconciliation and the six re-anchors (the evidence commit);
  - the next commit — documentation only: the PR number and these results.
- **Local results** (on `08632507`; the follow-up commit changes documentation only):

| Command | Result |
|---|---|
| `npm run test:task-closure-governance-contract` | 24 / 24 pass |
| `npm run test:ci-01-intelligence-evidence-baseline-contract` | 18 / 18 pass |
| `npm run test:ace-01-adaptive-conversational-expression-contract` | 6 / 6 pass |
| `npm run test:ace-sp-01-shared-public-personality-core-contract` | 7 / 7 pass |
| `git diff --check` | clean |
| `node --test` over the 23 contracts that read an edited document | 352 / 352 pass |
| `node --test database/tests/replay-distribution-reconciliation-closure-v1.test.mjs` | 15 / 15 pass |
| §4 index recount / §9 coverage script | 62 · 26 / 4 / 10 / 22 · 31 / 29 / 2 · no open owned item without a §9 entry |
| `git diff --name-only` against `apps/`, `packages/`, `database/`, `.github/`, `package*.json` | empty |

- **GitHub CI:** API CI and Mobile CI run on the PR's exact head and are reported on the PR. A failure would be
  classified by root cause before any change.
