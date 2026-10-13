# QANDEEL — LANG-01 — Arabic Language Authority & Fixed Copy Correction — Record v1

**Status:** `ACTIVE — WORK PACKAGE A (RESOLVED MANIFEST + CONTROLLED AMENDMENTS) PREPARED ON PR A — NOT MERGED; WORK PACKAGES B, C NOT STARTED; WORK PACKAGE D BLOCKED (INDEPENDENT SAFETY REVIEW)`
**Workstream:** LANG — independent from Stage 6 (WP0 record §14.14, D6).
**Baseline:** `main = af94748de73cca744c466d8db526984427b94b38` (the merge of PR #335), verified as `origin/main` before
branching.
**Branch / worktree:** `lang/lang-01-arabic-language-authority`, in its own Git worktree, separate from any S6 worktree.
**Authority:** the LANG-01 Task Contract (Product Owner, 2026-10-13: "PRODUCT COPY APPROVED — IMPLEMENTATION TASK";
"QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE") and its two attachments (§1).

---

## 1. Inputs

| Input | Where | SHA-256 |
|---|---|---|
| Approval register (primary, machine-readable) | [`lang-01/QANDEEL_LANG_Approval_Register_2026-10-13.json`](lang-01/QANDEEL_LANG_Approval_Register_2026-10-13.json), committed byte-for-byte | `6ba3bc62e72938998a067e32f8c87b69c01f102f6d3c3fa98b342081cff16785` |
| Approval record (human-readable) | `QANDEEL_LANG_Arabic_Copy_Approval_2026-10-13.docx`, supplied with the Task Contract; not committed | `3eb9c4a17a36011f3a0c79898adf6cc5bf9d1681087f2a58134cda630167f17c` |
| Census (the `Proposed` texts) | [`QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md`](QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md), pinned at the baseline | read in place |

Both attachments were readable. No approval was reconstructed, no wording alternative was written, and no fresh
Product Owner approval was requested for an approved wording.

## 2. The resolved approval manifest

[`lang-01/QANDEEL_LANG_01_RESOLVED_APPROVAL_MANIFEST_v1.json`](lang-01/QANDEEL_LANG_01_RESOLVED_APPROVAL_MANIFEST_v1.json)
holds all 109 units: the original, the exact resolved text and its SHA-256, the source of the text, the amendment
section, the work package, the disposition and, for runtime units, the production source to edit.

**Resolution rule (Task Contract §2):** a non-null `final_text` is used exactly; otherwise the exact «Proposed» of the
same ID in the pinned census. Interpolation, placeholders, directional marks and escaping are kept as they are.

**Mechanical verification.** A script parsed the census units and the register and checked, with no manual step:

| Check | Result |
|---|---|
| Unique IDs in the register; census units; IDs in one and not the other | 109; 109; none |
| `final_text` non-null ⇔ selection `exact_explicit_text`; null ⇔ `verbatim_Proposed_from_pinned_census` | 109 / 109 |
| Explicit overrides in the register; the same IDs and bytes in the Word record | 39; 39 identical, byte for byte |
| Approved individually by the Product Owner / under explicit delegation | 27 / 82 |
| Register category agrees with the census status of the same unit | 109 / 109 |
| Text sources | 39 register `final_text`, 70 census «Proposed» verbatim |

The LANG-01 static contract (`tests/lang-01-arabic-language-authority-contract.test.mjs`) repeats the derivation on
every run.

**Classification, exactly as recorded:**

| Classification | Count | Dispositions |
|---|---:|---|
| Controlled Copy Amendment required | 87 | 83 `IMPLEMENT` (Work Package B); 3 `AMENDED_IN_LANG_RUNTIME_USE_OWNED_BY_S6` (M-01 … M-03); 1 `AMENDED_DOCUMENT_ONLY` (N-01) |
| Safety review required | 6 | 6 `BLOCKED_PENDING_INDEPENDENT_SAFETY_REVIEW` (S-01 … S-06, Work Package D) |
| Future owning Copy Gate only | 16 | 15 `ROUTED_TO_FUTURE_COPY_GATE`; 1 `NOT_TO_BE_IMPLEMENTED` (M-13) |
| **Total** | **109** | **every ID has exactly one disposition** |

The 109 approvals are editorial decisions. They activate no unavailable feature and bypass no change control.

## 3. Work Package A — language authority and controlled amendments

Delivered on PR A (documentation and governance only; no runtime change):

- the [LANG-01 controlled amendment](../canonical-authority/final-product-experience/lang/QANDEEL_LANG01_ARABIC_LANGUAGE_AUTHORITY_FIXED_COPY_CONTROLLED_AMENDMENT_v1.0.md):
  - **§1 language authorities**, LA-01 … LA-17: VI-01 T2 split into generated (T2a) and scripted (T2b) voice; T3b;
    §3.2's fixed-copy gate made binding; §3.4 scoped to generated Egyptian; VI-01 §14 and P11; G2.3 §1's withheld
    rewrite authority; the G1.1 / P4-C4 opener and P4-C3 C-COPY-1; W1B-01; A3-02; W3-MEGA-M; MEM-AR-01 and the subject
    recogniser; E1R §1; I-08A4 §11 (D4); the `ar-EG` tag (no change); T-14 §5's gender-neutral claim; and the D4
    model-facing guidance lines;
  - **§2 copy amendments**, CA-01 … CA-20, one per approving authority, each quoting the superseded original and the
    exact replacement;
- the [G2.3 LANG-01 controlled amendment](../design/i-08b3.1-g2.3/G2_3_LANG01_MATCHING_COPY_CONTROLLED_AMENDMENT.md)
  (M-01 … M-03), beside G2.3 on the pattern of the T-11 amendment.

Two documents carry all 87 amendment units; no per-string governance document was created.

**Preserved.** No frozen or approved record is edited. I-08A4 still matches its provenance pin; G2.3, G1.1, P4-C4,
W1B-01, VI-01, E1R, T-14 and every e2e Copy Gate record are byte-identical; the byte-preserved proof and vendored canon
copies are untouched (the static contract pins the five most exposed ones by hash). The census keeps every unit and
gains one dated note at its head.

**Product Decision Gate check.** Each of the 87 replacements was read against its original's meaning, privacy
guarantee and user action. None changes Product meaning, a privacy guarantee or frozen architectural behaviour; none
was stopped. Two notes are recorded without changing anything:
- SW-09's explicit wording «ستظهر هذه الرسائل فقط لـ{0}:» attaches «لـ» directly to a Name. A Name that begins with «ال»
  renders as «لـالـ…» rather than «لل…». The census noted this; the Product Owner chose the wording explicitly, and it is
  implemented exactly.
- PC-01's register wording carries a full stop. The W1A-01 rule that only the T-08 stance slot carries the stop is kept
  (CA-19): punctuation placement, not a paraphrase.

## 4. Work Package B — impact map for the existing fixed copy

Reused by PR B without new research. Every production source is named in the manifest; the pins and couplings below
were re-verified at the baseline by searching the whole tree for each original.

| Family | Production sources | Test and proof pins that move with the copy |
|---|---|---|
| Q | `apps/mobile/src/account/copy.ts` (`FIRST_USE_AR`) | `tests/w1b-01-account-identity-first-use-contract.test.mjs` (`APPROVED`, also asserted against the W1B-01 record, which stays history) |
| A | `account/copy.ts`, `account/access/copy.ts`, `integration/auth-gateway/product-sign-in-copy.ts`, `settings/copy.ts` | `tests/w1b-01-…`, `tests/w2-01-final-account-access-contract.test.mjs`, `tests/w3-02-account-identity-public-id-contract.test.mjs`, `tests/w3-mega-s-personal-controls-settings-contract.test.mjs`; `account/__tests__/access.test.tsx`; `integration/__tests__/sign-in-gateway.test.tsx` |
| P | `apps/mobile/src/push/copy.ts` | `tests/a3-02-native-push-platform-delivery-contract.test.mjs` (`PUSH_COPY_GATE` rows); `.maestro/a3-02-permission-deny.yaml`; comments in `PermissionEducationSheet.tsx`, `push-controller.ts` |
| IP, AC | `settings/interaction-preferences-copy.ts`; `activity/copy.ts`; API `interaction-preferences/interaction-preference.copy.ts` | `settings/__tests__/interaction-preferences.test.tsx`; `tests/a3-01-activity-attention-inapp-contract.test.mjs`; API `interaction-preferences.service.spec.ts`, `post-response-intelligence/interaction-preference-command.route.spec.ts` |
| SW | `shared-world/copy.ts`, `shared-world/lifecycle-copy.ts`; API `shared-world/shared-activity-copy.ts` | `tests/s4-01-shared-world-reachability-contract.test.mjs`; `tests/s4-04-shared-activity-notifications-direct-entry-contract.test.mjs` (byte-exact reuse pins); `shared-world/__tests__/surfaces.test.tsx`; API `shared-world/shared-activity.spec.ts` |
| PW | `public-authoring/copy.ts`, `public-authoring/semantic-copy.ts`, `public-world/field/field-copy.ts`, `public-world/field/discussion-copy.ts` | `public-world/field/__tests__/public-field.test.tsx` |
| PC | `orientation-chrome/product-copy.ts`, `analysis-language/analysis-copy.ts` | `integration/__tests__/analysis-language.test.tsx`; the Jest golden `integration/__tests__/__golden__/living-analysis-screen.golden.json` (a test snapshot, regenerated, not a proof); `temporal-navigation/__tests__/accessibility.test.tsx`; `.maestro/w1a-01-analysis-language.yaml`; comments in `TemporalTargetLayer.tsx`, `temporal-accessibility.ts` |
| MEM | API `memory/memory-control.copy.ts` | `tests/mem-ar-01-memory-subject-identity-contract.test.mjs` (locked-copy pins and the CQ-1 mutation check); `conversation/conversation-memory-control.route.spec.ts`; `post-response-intelligence/memory-control-words-answer.route.spec.ts`, `interaction-preference-command.route.spec.ts`; `memory/memory-control.interpreter.spec.ts`; comments in `memory-control.interpreter.ts`, `memory-control.repository.ts` |

**Couplings carried into PR B:**
1. `inspectReply` derives MEM-03's first-section form with `.replace(/^وفيه/u, 'فيه')`. The derivation changes with the
   string to «وهناك» → «هناك» (CA-03), or the heading would keep a dangling «و».
2. `readSubjectAnswer` keeps every current answer and adds «عن شخص آخر», «شخص آخر» (OTHER) and «عني أنا» (SELF) (LA-12).
3. Reused rows change at the source and at every reuse together: the four T-14 network sentences (A-07), the
   W3-MEGA-S `enterPassword` (A-18), the duplicated `invalidEmail` (A-05), the API Shared Activity rows (SW-05, SW-06)
   and the API CA-1 reply (IP-01).
4. PW-09 keeps U+200E before `@qandeel`; Q-01 keeps `${isolate(displayName)}`; A-08 keeps `${isolate(email)}`; MEM-20
   … MEM-23 keep their `quoteMemory(…)` placeholders; PC-02 keeps `${digits(max)}`.
5. `database/verify-migration-0152.mjs` passes the subject question to `0152` as an opaque reply string. `0152` holds
   no copy, so the fixture is not a copy pin and is not edited.
6. No migration holds any amended copy. Activity rows already delivered keep the words they were delivered with.
7. English copy is not changed anywhere.

## 5. Work Package C — the D4 generated-language default

The model-facing lines are fixed in the amendment (LA-17): one for the Personal conversation, one for Shared and
Public QANDEEL replies, appended after the personality core. `TEXT_V1_BEHAVIORAL_GUIDANCE`, the approved core
(ACE-01), its world-neutral form (ACE-SP-01) and the IP-IMP-01 CA-2 block stay byte-identical. No Model Router,
provider selection, cost logic, memory retrieval or HIM behaviour changes, and no model call or dialect classifier is
added. The Shared / Public line reads only the message being answered, so no participant's personal preference reaches
another participant.

## 6. Work Package D — safety replies

**State: BLOCKED / NOT MERGED.** S-01 … S-06 are editorially approved, but the Task Contract requires an independent
safety review before production integration. No such review exists yet, so nothing in
`apps/api/src/conversation/safety-response-gate.service.ts` changes. The review must confirm, for each reply: the
refusal meaning; the emergency-support meaning and its urgency; clarity; third-person references (S-06 keeps the
generic masculine for «هذا الشخص»); gender neutrality toward the reader; and that the English replies are unchanged.
`safety-response-gate.service.spec.ts` pins «مش هقدر» (S-01) and asserts «لإيذاء نفسك» present for S-01 and absent for
S-06; those pins move only with the reviewed wording.

## 7. Future-stage Copy Gate handoffs

These units are approved editorial references only. Nothing is implemented, no historical fixture or proof is edited,
and no Matching or Voice interface is created in LANG.

| Units | Owning Copy Gate |
|---|---|
| M-04 … M-10 | S6-04 — Private Proposal Review and Decisions (WP0 GATE-28) |
| M-11, M-12 | S6-05 — Mutual Match & Introduction World (GATE-28) |
| M-13 | **never implemented or promoted** (pre-Match identity and compatibility-reason content); S6-04's Copy Gate decides privacy-safe proposal copy |
| M-14 | S6-07 — Activity, Direct Entry and Final Integration (the END notice, GATE-34), with S6-02 owning the END carrier |
| M-15, M-16 | S6-07 (GATE-28) |
| V-01 … V-03 | `QAN-BL-VOICE-01` (owner UNASSIGNED; Stage 8B) |

M-01 … M-03 are amended now (G2.3 amendment); their runtime use belongs to S6-04.

## 8. Parallel execution with S6

- LANG runs in its own worktree and branch. It edits no S6 implementation code, migration, grant, consent logic or
  interface, and no S6 document.
- The G2.3 wording amendment has one owner, LANG (D6 rule 5). S6 consumes it.
- No destructive checkout, no force-push, no merge without the Product Owner's explicit order.

## 9. Backlog (BG-05 at kickoff)

The canonical backlog was read in full. **No item names LANG-01 as its owner; none is inherited.** Observed and left
unchanged:
- `QAN-BL-VOICE-01` — receives V-01 … V-03 as approved references (§7); its fields are unchanged.
- `QAN-BL-IP-01` — the Personal preference still does not reach Public replies; the D4 world line reads no personal
  preference, so it agrees with the item.
- `QAN-BL-IP-02`, `QAN-BL-ACE-02` — real-model language behaviour stays Stage 8A validation.
- `QAN-BL-MATCH-01`, `QAN-BL-MATCH-02`, `QAN-BL-PRIV-04` — S6-owned; untouched.

**Residue to reconcile at LANG-01's closure (BG-08):** the SW-07 `fill()` defect (amendment §4). It is a code defect
outside the language rule, still visible in English after Work Package B. It is tracked here until closure, where it is
either fixed by an authorized change or admitted to the backlog with a named owner.

## 10. Validation of PR A

Proportional to a documentation and governance change: no runtime, database, native or end-to-end suite can be
affected, so none was run.
- `tests/lang-01-arabic-language-authority-contract.test.mjs` (new): the register's hash; 109 unique IDs; 87 / 6 / 16;
  39 overrides; the census re-derivation of all 109 resolved texts; one disposition per ID; every amendment unit quoted
  verbatim in its amendment; provenance pins and byte-preserved proofs unchanged; registration.
- The root static contracts, `npm run test:task-closure-governance-contract` included.

## 11. Pull requests

| PR | Scope | State |
|---|---|---|
| PR A | Work Package A: this record, the manifest, the two amendments, locator notes, the static contract | prepared |
| PR B | Work Package B: mobile and API fixed copy, with the pins of §4 | not started |
| PR C | Work Package C: the D4 guidance lines and their focused tests | not started |
| PR D | Work Package D: S-01 … S-06, after the independent safety gate | blocked |

Not merged. No launch gate, S6-01 file or Stage 6 lifecycle row is touched.
