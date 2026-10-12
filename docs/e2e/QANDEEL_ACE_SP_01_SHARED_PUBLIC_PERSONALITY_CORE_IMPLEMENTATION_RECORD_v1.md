# QANDEEL — ACE-SP-01 — Shared / Public QANDEEL Personality Core — Implementation Record v1

**Status:** `ACE-SP-01` — **IMPLEMENTATION COMPLETE / READY FOR INDEPENDENT REVIEW AND THE PRODUCT OWNER'S MERGE DECISION.**
- One branch and one Draft PR. This record carries the closing change (BG-08 / BG-09).
- **Not merged**: merge happens only on the Product Owner's explicit order.
- No migration was added. Nothing was migrated on a hosted database, and nothing is deployed.

**Authority:** the Product Owner's *ACE-SP-01 — Final Product Approval & Implementation Authorization* (2026-10-12).
- It approves WP0 / WP1 and authorizes WP2 implementation within a strict scope.
- D-1: execute the ACE-SP-01 Task Contract.
- D-2: Option A, a standalone controlled amendment.
- D-3: Product Copy Gate CG-1 … CG-6, APPROVED 6 / 6.
- D-4: extend `QAN-BL-ACE-02`.
- Mandate: ACE-01 Gate B, Option A (2026-10-12; [ACE-01 record](QANDEEL_ACE_01_ADAPTIVE_CONVERSATIONAL_EXPRESSION_IMPLEMENTATION_RECORD_v1.md) §7).
- Research authority: the ACE-SP-01 WP0 / WP1 report (`ACE_SP_01_WP0_WP1_REPORT.md`, reviewed by the Product Owner). It is
  not re-run here.

**Binding authority:** the [ACE-SP-01 controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_ACE-SP-01_SHARED_PUBLIC_PERSONALITY_CORE_CONTROLLED_AMENDMENT_v1.0.md)
(effective / frozen on merge).

**Baseline:** `main = 141a3190deb02bc6695d2ace05da275e623a2754` (the merge of PR #332, ACE-01), verified as `origin/main`
before branching. Migrations `0001`–`0153`; ACE-SP-01 adds none.

**Branch:** `ace/ace-sp-01-shared-public-personality-core`.

---

## 1. Kickoff census (BG-05)

ACE-SP-01 inherits exactly one item, `QAN-BL-ACE-01`, which is included in the contract. No other register item names
ACE-SP-01 as its owner.

## 2. Authority first, then code

| Commit | Content |
| --- | --- |
| `2b223c3a` | The standalone controlled amendment, registered in `docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md` (a scope bullet, a pointer in the CW2 row, its own row) and in `QANDEEL_PROJECT_MAP.md` §1 rule 2. |
| `ca0eec92` | The code and its tests, after the amendment. |
| closing change | This record, the backlog dispositions, the Current State row, and the static contract with its script and API CI step. |

**Untouched:**
- CW2-03, CW2-04 and CW2-08 (their SHA-256 equals rows 4, 5 and 9 of `CW2_SOURCE_PROVENANCE.sha256`; the new static
  contract recomputes it);
- `CW2_SOURCE_PROVENANCE.sha256` itself;
- the S4-02 and S5-04 implementation records;
- the ACE-01 and IP-IMP-01 records.

No Option B forward pointers were added. The amendment binds on merge.

## 3. What changed

| File | Change |
| --- | --- |
| `apps/api/src/conversation/behavioral-response-policy.service.ts` | `QANDEEL_PERSONALITY_CORE_V1_WORLD_NEUTRAL`, derived from `QANDEEL_PERSONALITY_CORE_V1` by reference (`split('\n').map(...)`): paragraph 3 = CG-1; 6 and 7 by a one-phrase `replace` (CG-2, CG-3); 1, 2, 4, 5, 8 the approved bytes. One pure, append-only helper `withWorldNeutralPersonality(worldPrefix, safetyGuided)`. `SAFETY_HUMOUR_SUSPENSION_LINE` joins the file's existing import statement. Text v1, the approved core, Text v2 and `buildTextGuidance` are unchanged. |
| `apps/api/src/shared-world/shared-conversation-model-input.ts` | `behavioralGuidance: withWorldNeutralPersonality(\`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${SHARED_CONVERSATION_FRAME}\`, Boolean(safetyGuidance))`; header comment made truthful. |
| `apps/api/src/public-world/public-qandeel-model-input.ts` | The same expression with `PUBLIC_QANDEEL_FRAME`; header comment made truthful. |
| `apps/api/src/conversation/ace-sp-01-shared-public-personality-core.spec.ts` | New focused spec (19 cases). |
| `tests/ace-sp-01-shared-public-personality-core-contract.test.mjs` | New static contract, `package.json` script and one API CI step. |
| 3 re-anchors | §7. |

**Not touched:**
- the generators (BLOCK returns before the assembler, as before);
- the reply service and its lease / Source Disclosure Gate / I-03F revalidation / commit sequence;
- the Safety gate, `composeServerGuidance` and both provider adapters;
- QIR-004, routing, `locale`;
- every migration, the mobile app and every copy file.

The flag is `Boolean(safetyGuidance)`, the same test `composeServerGuidance` uses. So the suspension line appears if and
only if the Safety block appears.

## 4. Product Copy Gate — CLOSED (6 / 6 APPROVED by the Product Owner, 2026-10-12)

| Row | Status | Text in production (verbatim) |
| --- | --- | --- |
| CG-1, paragraph 3 | APPROVED | "Match the language or dialect of the message you are answering when reliably supported, respecting safety and explicit current requests. Never infer identity from language or dialect." |
| CG-2, paragraph 6 | APPROVED | "Light humour may arise naturally in suitable everyday moments, but never force it, repeat it mechanically, use it at anyone's expense, or use it during distress, loss or crisis. Shift immediately to a serious register when appropriate." |
| CG-3, paragraph 7 | APPROVED | "When genuine evidence supports disagreement, be clear and respectful. Explain the reason without moralizing, humiliating anyone or arguing to win." |
| CG-4, Safety humour suspension | APPROVED (reuse, IP-IMP-01 CA-2 R2) | "This turn carries safety guidance: do not use humour or playfulness in this reply." — Shared / Public `GUIDED` turns only |
| CG-5, paragraphs 1, 2, 4, 5, 8 | APPROVED (reuse by reference) | the ACE-01 Gate A wording, from the same constant |
| CG-6, the World frames | APPROVED (unchanged) | `SHARED_CONVERSATION_FRAME`, `PUBLIC_QANDEEL_FRAME`, byte-identical |

Rejected by the Product Owner: the PRIMARY and A2 wordings for paragraph 3.

## 5. Before / after, per World

The composition, in exact bytes (UTF-8), was computed from the real modules of this branch.

- **Before:** `Text v1 + "\n" + frame`.
- **After:** that prefix, then `"\n\n" + world-neutral core` (1,367 B; the approved core is 1,378 B).
- **GUIDED:** additionally `"\n\n" + CG-4` (82 B).
- `composeServerGuidance` then appends the Safety block (`GUIDED` only) and the charter.

| World / turn | `behavioralGuidance` before → after | Provider instructions before → after |
| --- | --- | --- |
| Shared ALLOW | 1,429 → 2,798 | 2,427 → 3,796 (+1,369) |
| Shared GUIDED (SELF_HARM / AMBIGUOUS / THIRD_PARTY) | 1,429 → 2,882 | 2,777 / 2,790 / 3,007 → 4,230 / 4,243 / 4,460 (+1,453) |
| Public ALLOW | 1,500 → 2,869 | 2,498 → 3,867 (+1,369) |
| Public GUIDED (SELF_HARM / AMBIGUOUS / THIRD_PARTY) | 1,500 → 2,953 | 2,848 / 2,861 / 3,078 → 4,301 / 4,314 / 4,531 (+1,453) |
| Shared / Public BLOCK | no request (unchanged) | no provider call |
| Personal | Text v2 = 2,437, byte-identical | unchanged |

**Every other request field is unchanged:**
- `task`, `path`, `complexity`, `context`, `locale: 'und'`, `modality`, `latencyBudgetMs`, `costBudget`, `safetyLevel`;
- the Shared history budget (`HISTORY_BUDGET_BYTES`, 16,384);
- `PUBLIC_QANDEEL_RESPONSE_MAX` (4,000).

QIR-004's Mandatory Core applies to the Personal pipeline only and is unaffected. Each approved paragraph appears exactly
once, and no paragraph exists twice in the codebase. Text v1 and the core do not compete: v1 stays the hard policy
prefix, as in Personal Text v2.

## 6. Privacy and Safety proof (the authorization's §3)

| # | Property | Proof |
| --- | --- | --- |
| 1 | No Memory, HIM, Hypothesis, Recommendation, Question or Personal preference in Shared / Public | new spec `expectNoPersonalOrIdentity` (all five Personal fields undefined; no preference or Personal-only text) on every ALLOW / GUIDED case in both Worlds. Unchanged and green: `interaction-preferences.isolation.spec.ts`, the S4-02 contract test 4, the S5-04 contract, and the ACE-01 contract's Shared / Public negatives (kept verbatim). The new static contract also bans each World's assembler from importing the other. |
| 2 | The requester gains no authority | the requester's id is absent from every request JSON, while the accounting scope carries it. The guidance is identical whoever asks and whatever was asked before (spec: "the requester gains no authority …"). CG-1 follows "the message you are answering" and keeps "explicit current requests" (this turn's scope). |
| 3 | Shared audience intersection, Source Disclosure Gate, I-03F revalidation and commit sequence unchanged | `connected-worlds/material-commit/` and the generator are untouched; their specs pass (§8). The context equals `boundedSharedContext` (spec). |
| 4 | Public uses Public Servable Context only | `PublicQandeelContext` is unchanged; one context message; no "Shared World" text and no version id in the request (spec). `public-discussion.spec.ts` is unchanged and green. |
| 5 | BLOCK makes zero provider calls; the deterministic answer is unchanged | spec, both Worlds: `router.generate` is never called, and the answer is exactly the gate's English self-harm text. |
| 6 | GUIDED: the suspension line appears once, immediately before the Safety block | spec, both Worlds, all three GUIDED constants (each confirmed GUIDED by the production gate): exactly one occurrence, with `CG-4 + "\n\n" + "Safety guidance for this turn:\n" + guidance` contiguous. |
| 7 | ALLOW never carries the line | spec, both Worlds, FAST and DEEP. |
| 8 | FAST and DEEP receive the same personality; routing unchanged | spec: a DEEP ALLOW and a DEEP GUIDED turn in each World give the same guidance as FAST, and the path / complexity / latency are as before. |
| 9 | Introduction-phase Shared Worlds keep their boundaries | they use the same Shared reply path (`0139` checks lifecycle `ACTIVE` only). No Matching or Introduction context or import exists in the assembler: S4-02 contract test 4 and the S5-04 import ban are unchanged. Enrollment stays suspended under `QAN-BL-MATCH-01`. |
| 10 | Personal requests and guidance are byte-identical to ACE-01 | spec ("Personal guidance is byte-identical …"); `behavioral-response-policy.service.spec.ts`, `conversation-interaction-preferences.spec.ts`, `interaction-preference-guidance.spec.ts`, the Golden spec and ACE-01 spec items 1–13 are unchanged and green. |

**Mutation check of the new spec:**
- with the GUIDED line suppressed, 7 cases fail;
- with paragraph 3 left as the Personal wording, 9 cases fail.

## 7. Exact-string impact sweep (done before the first push)

Every tracked test, script and verifier was searched for:
- `TEXT_V1_BEHAVIORAL_GUIDANCE`, `SHARED_CONVERSATION_FRAME`, `PUBLIC_QANDEEL_FRAME`;
- `assembleSharedConversationRequest`, `assemblePublicQandeelRequest`;
- `behavioralGuidance`, `SAFETY_HUMOUR_SUSPENSION_LINE`;
- the World generators and reply services.

This covered the late API CI steps too:
- the DB verifiers `verify-migration-0139.mjs` and `0147.mjs`;
- the Full Intelligence smoke;
- the Integrated Brain E2E hardening v2.

None of those reads Shared / Public guidance.

**Exactly three re-anchors, each with a dated `RE-ANCHORED by ACE-SP-01` note:**
1. `tests/ace-01-adaptive-conversational-expression-contract.test.mjs`, test 2:
   - the import pin now names the helper;
   - a call-site pin keeps Text v1 + the frame as the literal prefix;
   - the Personal-authority negatives and `locale: 'und',` are kept verbatim.
2. `apps/api/src/conversation/ace-01-adaptive-conversational-expression.spec.ts` item 14:
   - `toBe(helper(prefix, false))` plus a prefix check;
   - the core's first paragraph is now present;
   - `durable interaction preferences` and the preference headers are absent;
   - `locale` is `und`.
3. `apps/api/src/shared-world/shared-world-conversation.spec.ts` (the exact-guidance `toBe`).

**Unchanged and green**, none of them weakened:
- the S4-02, S5-04, W3-MEGA-U3, CI-01, task-closure-governance and forward-safety contracts;
- the isolation spec, the Public spec and the policy spec.

## 8. Validation (local, proportional to the change)

| Check | Result |
| --- | --- |
| `tsc --noEmit -p apps/api/tsconfig.json` and `-p apps/api/tsconfig.scripts.json` | exit 0, exit 0 |
| Focused Jest: the new spec, both ACE-01 / Shared re-anchored specs, the policy spec, `interaction-preferences/`, `public-discussion.spec.ts`, `safety-response-gate.service.spec.ts`, `conversation-interaction-preferences.spec.ts`, `brain-eval/`, `model-router.types.spec.ts`, `connected-worlds/material-commit/` | 17 suites, 431 tests, all passed (new spec: 19 / 19) |
| Every root static contract (`node --test tests/*.test.mjs`) — including ACE-01, ACE-SP-01, S4-02, S5-04, W3-MEGA-U3, CI-01, forward-safety and task-closure-governance | all passed (see §9 for the exact count on the closing head) |
| `npm run eval:brain:validate` and `npm run eval:brain:dry-run -- golden-conversations` | valid (24 bake-off and 22 Golden cases); ZERO CALLS |

**Not run, by the authorization:**
- the full local Jest suite;
- migrations;
- PostgreSQL / Redis;
- native-device suites;
- any paid or real-model evaluation.

GitHub CI validates the exact head (§9).

## 9. PR and CI

The closing change is recorded before the push. The PR number, the exact head and the API CI / Mobile CI results are
appended here after the push, without changing anything above.

## 10. Backlog closure (BG-08) and residuals

**Dispositions:**
- `QAN-BL-ACE-01` — `CLOSED — TOMBSTONE` (§6 of the backlog; effective from merge).
- `QAN-BL-ACE-02` — the validation set is extended to Shared / Public (D-4); its owner (Stage 8A) and its status
  (`VALIDATION — OPEN`) are unchanged.
- `QAN-BL-GOV-01` — admitted for pre-existing locator / closure-record drift, presented as one standalone item at the
  Product Owner's direction. Its owner name, `GOV-REC-01`, is proposed for confirmation.
- `QAN-BL-CW-02` (SHARED-CTX-01), `QAN-BL-IP-01` (PUBLIC-PREF-01), `QAN-BL-MATCH-01` — current-truth notes or citations
  only; owners and statuses unchanged.

| Residual | Owner |
| --- | --- |
| Real-model behaviour of the world-neutral personality in Shared / Public (register, `GUIDED` suspension honoured, no private-conversation tone in Public, fitting group humour) | Stage 8A, under `QAN-BL-ACE-02` |
| Public reachability in production still depends on the CW2-08 publication / entitlement seams (`NOT_EVALUATED`) | unchanged, Stage 9 / CW2-08 launch work |
| Locators and closure records still stale after the IP-IMP-01, ACE-01 and SHARED-VIS-01 merges. ACE-SP-01 does **not** claim the Project Map or Current State are reconciled | `QAN-BL-GOV-01` → `GOV-REC-01` |

## 11. What this task deliberately did not do

- **No new runtime.** No new persona, tone or emotion engine, behavioural runtime, model call, setting or saved trait.
- **No persistence.** No participant's language or style is stored.
- **No Personal preference machinery** (`InteractionPreferencesService`, the compiler, any preference read) in a World
  source.
- **No change outside the guidance.** No migration, storage, API, screen, provider or routing change. No change to
  Shared Standing Context, Public Personal Preferences, Matching, Replay, the Semantic Map or Launch Entitlements.
- **No edits to frozen or closed records.** No edit to a CW2 file, a SHA-pinned artifact, or the S4-02 / S5-04 records.
- **No repair of predecessor drift.** Admitted as `QAN-BL-GOV-01` instead.
- **No merge, hosted migration or deployment.**
