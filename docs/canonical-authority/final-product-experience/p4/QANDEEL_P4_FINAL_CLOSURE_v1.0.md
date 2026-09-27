# QANDEEL — P4 Remaining Product / Visual Gaps Census & Closure
## Canonical Product / Architecture Closure v1.0

> **Status: `P4 — CLOSED / FROZEN — REMAINING PRODUCT / VISUAL GAPS CENSUS & CLOSURE COMPLETE`**

| | |
|---|---|
| Roadmap track | `P4 — Remaining Product / Visual Gaps Census & Closure` ([`QANDEEL_PRODUCT_ROADMAP.md`](../../../../QANDEEL_PRODUCT_ROADMAP.md) §2) |
| Canonical baselines | P4-A census: `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` (canonical `main` after PR #277). P4-B onward: `576b010dcf78276c982f5052cfee7dd1bcbfcbcb` (canonical `main` after the merge of PR #278, which carries CW2-08A) |
| Closing branch | `design/p4-c-shell-chrome-integrated-decision-proof`, pull request #280. The head before this closing change was `0a58941cc1de22e0a0cae97f2818626dc9dbd921` |
| Evidence | the P4-local package [`docs/p4/`](../../../p4/P4_READ_FIRST.md); the [P4-C comparative proof](../../../design/p4-shell/QANDEEL_P4-C_SHELL_CHROME_INTEGRATED_DECISION_PROOF/P4C_READ_FIRST.md); the [P4-C3 residual visual + copy proof](../../../design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/P4C3_READ_FIRST.md) as corrected by P4-C3R (§6) |
| Decision source | the Product Owner decisions already recorded in P4-C1, P4-C2, the P4-C3R approvals and P4-C4, and the APP-OPS `PO-OPS-nn` decisions. **This record takes no Product decision of its own** |
| Authority class | later, additive Product / Architecture closure. It consumes the P4 controlled amendments and summarizes them; where it and a P4-C record differ, the P4-C record binds in its named scope |
| Lifecycle effect | the state above is the one this closing change encodes. It binds on the merge of the pull request that carries it, after independent review. This record carries no review or merge status of its own |
| Implementation | **none.** No code, schema, migration, dependency, runtime, mobile, API, notification, Voice or auth change is created, changed or authorized (§11) |

Historical records keep their bytes. The P4-C and P4-C3 packages keep theirs: their own pre-closure wording —
"P4 remains ACTIVE — NOT CLOSED / NOT FROZEN", `P4-C3 — CORRECTIONS COMPLETE / READY FOR FINAL INDEPENDENT REVIEW`,
`PROPOSED FOR PRODUCT OWNER + INDEPENDENT REVIEW — NOT FROZEN`, and the proof-time copy status labels — is superseded by
this record and by P4-C4, not edited. The P4-local lifecycle documents in `docs/p4/` are updated in this same change
(BG-09). Later controlled amendments bind only in their named scope. Implementation, audit and validation carry-forwards
stay open where §10 names them.

---

## 1. Scope

P4 is the roadmap's fourth and last pre-audit Product decision track: close the residual decisions the existing
Product / design canon deliberately left open, so the End-to-End audit does not keep stopping on already-known gaps.
It carries one Product-Owner-approved cross-cutting exception, `APP-OPS-01` (§8).

P4 freezes, by reference to the records named:

1. the P4 residual census and its final disposition of every row (§2);
2. the CW2-08A No Human Review controlled amendment, in its named scope (§3);
3. the shell / small-chrome decisions and the retirement of the dedicated Live Context surface (§4);
4. the brand ratification, the launch / gateway sequencing, the undrawn-screen boundary, the Voice visual split, the
   residual-copy disposition and the APP-OPS Product Owner decisions (§5);
5. the static launch → system handoff and the non-signal Voice visual language, as proved by P4-C3 and corrected by
   P4-C3R, and the four P4-C3R approvals (§6);
6. the exact P4-owned copy ratified by P4-C4 (§7);
7. `APP-OPS-01`, the QANDEEL App ↔ QANDEEL Company Operations Product / Architecture contract (§8).

P4 closure does **not** mean that the app is production-ready, that any Product surface is implemented, that a Voice
runtime exists, that Shared / Public / Introductions surfaces are final, that the lantern identity moment is designed,
that a model / provider is selected, that Plans / Credits are final, or that device / release validation is complete.

---

## 2. P4-A — the residual census

[`P4_RESIDUAL_GAP_CENSUS.md`](../../../p4/P4_RESIDUAL_GAP_CENSUS.md) is the authoritative evidence table: 66 rows,
`APP-OPS-01` plus `P4-GAP-001` … `P4-GAP-065`, each traced to its source and every later authority. Its final
reconciliation (census §2 and §5) is:

| Final disposition | Count | Rows |
|---|---:|---|
| `CLOSED IN P4 — PROVED / RATIFIED` | 8 | APP-OPS-01; 018, 021, 022 (proof); 028, 030, 031, 034 (copy) |
| `ALREADY CLOSED / SUPERSEDED` | 18 | 001 … 007, 012 … 014, 033, 037, 038, 057, 060 … 063 |
| `IMPLEMENTATION ONLY — NOT P4` | 12 | 008, 009, 011, 016, 017, 045, 047, 050, 051, 053, 054, 055 |
| `DEVICE / RELEASE VALIDATION — NOT P4` | 1 | 052 |
| `END-TO-END AUDIT OWNED` | 7 | 020, 029, 032, 039, 040, 048, 049 |
| `BACKLOG OWNED` | 4 | 027, 041, 042, 065 |
| `DEPENDENCY-GATED — CANNOT CLOSE YET` | 6 | 023, 024, 025, 026, 035, 056 |
| `HISTORICAL / EVIDENCE ONLY` | 2 | 058, 059 |
| `NO ACTION` | 7 | 010, 015, 036, 043, 044, 046, 064 |
| `FUTURE STANDALONE PRODUCT / MOTION TASK` | 1 | 019 |
| **Total** | **66** | |

No row is closed merely because P4 closes. Audit-owned, runtime-gated, device-gated and backlog-owned rows stay open with
their named owner. Two reclassifications are reconciliation, not new decisions: `P4-GAP-039` had kept the pre-`P4-DQ-07`
label `P4 — PRODUCT DECISION REQUIRED` in its row while the count already placed it under the audit; and `P4-GAP-065`
moves from implementation-only to backlog-owned because P4-C1 admitted `QAN-BL-CTX-01` for it.

## 3. P4-B — the CW2-08A controlled amendment

[CW2-08A](../../connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md), merged
through PR #278 at `576b010dcf78276c982f5052cfee7dd1bcbfcbcb`, resolved `P4-DQ-10`. No human role or person may
receive, inspect or review private QANDEEL conversation content under Safety / Moderation authority; automated Safety
processing stays allowed; Public moderation is not decided. The original CW2-08 stays frozen and byte-identical.
Moderation / report UX and appeals stay with Connected Worlds `I-09` / CW2-08 §44 item 5, bounded by CW2-08A.

## 4. P4-C1 — shell / small chrome + Live Context

[P4-C1](QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) resolved `P4-DQ-01` … `04`:
**S-B** (General Settings entry from Personal QANDEEL; one global destination), **U-A** (the «فهم قنديل» / QANDEEL
Understanding persistent Personal row), **Q-A** (no persistent shell Q; the Q only at named identity moments) and **SW-3
Keyed Seam**. It retired the dedicated «سياق الكلام» / Live Context surface, preserved explicit Context Activation and
T-03D Live Focus, and admitted `QAN-BL-CTX-01`.

## 5. P4-C2 — brand, scope, Voice, copy and APP-OPS decisions

[P4-C2](QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md) resolved `P4-DQ-05` … `09` and
`11` … `17`:

- **Brand:** I-08B2.5 is the final Brand Authority; icon bytes / hash kept; Android 48 dp; no iOS dark / tinted variant
  in v1.
- **Launch / gateway:** P4 closes the static launch / splash / gateway brand application. **The exceptional lantern
  gateway identity moment is in v1**; its design, motion, interaction, technology and proof belong to the standalone
  task **QANDEEL — Lantern Gateway Identity Moment v1** (§9, `QAN-BL-LANTERN-01`).
- **Undrawn screens:** P4 designs none; the End-to-End audit owns them.
- **Voice:** the **Split** — non-signal visuals close in P4; signal-bearing morphology waits for `QAN-BL-VOICE-01`.
- **Copy:** core copy closes in P4; journey residue goes to the audit; Voice / call state strings are runtime-gated.
- **APP-OPS:** `PO-OPS-13` … `PO-OPS-19`.

## 6. P4-C3 / P4-C3R — residual visual + copy proof

The [P4-C3 proof](../../../design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/P4C3_READ_FIRST.md) closed the
three evidence gaps P4-C2 left. Independent Product review found it **approved with minor corrections**; the P4-C3R pass
applied exactly the four [P4-C3R approvals](QANDEEL_P4C3_RESIDUAL_VISUAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md), and
the corrected package has passed independent Product review. Its recorded results, not re-run by this closure:

| Run | Checks | Planted defects |
|---|---|---|
| full P4-C3 run (`data/CHECKS.json`) | **44 / 44 PASS** | **19 / 19 rejected** |
| targeted P4-C3R run (`data/CHECKS_P4C3R.json`) | **17 / 17 PASS** | **7 / 7 rejected** |

**Frozen by reference, as accepted:**

- the **static launch → system handoff** on iOS and Android (boards 01–02), up to the boundary where the standalone
  lantern task begins, with the P4-C3R §1 appearance policy: iOS system launch follows the device appearance; Android
  system splash follows the effective QANDEEL appearance where supported; no forced Dark, no duplicate custom splash;
- the **non-signal Voice visual language** (boards 03–07; `docs/P4C3_VOICE_VISUAL_SPEC.md`): the Voice Note turn as an
  UTTERANCE with its own media control and stored position, the finished-call record in the history's plane, the
  recording line, and the Analysis-first Live Call composition on P2's Call Rail A;
- the P4-C3R approvals: «يوجد تعارض» / Mixed, the Public ID English warning, and the Replay name «إعادة العرض» /
  Replay (superseding I-08A4's «عرض الجلسة» / Session Replay row for that Product-facing name only).

**Evidence only, not frozen:** the proof harness; pixel values the spec itself calls "reference craft" (they stay
device-tunable production defaults, as P2 §9 / P3 §16 treat craft); every `RUNTIME_GATED`, `AUDIT_OWNED` and
`FIXTURE_ONLY` string; and every browser stand-in for a device setting.

Findings the proof left for this closure:

| Finding | Disposition |
|---|---|
| F-03 — P3-A's copy table marks «كتم الميكروفون» / «إنهاء المكالمة» `CANON` | P4-C2 §5, the later authority, keeps Voice / call strings runtime-gated. They stay `RUNTIME_GATED` under `QAN-BL-VOICE-01`; P3-A's bytes are not edited |
| F-04 — G1.1 §3 lets a voice-message UTTERANCE carry "its committed textual representation"; G1.2 §6 leaves a Voice Note transcript open | no conflict is decided here. G1.2 §6 is the later record and keeps transcript existence open and runtime-gated (`P4-GAP-024`, `QAN-BL-VOICE-01`). P4-C3's text-less Voice Note drawing freezes neither the presence nor the absence of a transcript line |
| F-05 — Android recommends 48 dp targets; P2 / P3 freeze 44 pt | no frozen value changes; an implementation / device gate (Release Hardening) |
| F-06 — G3.2's preserved bytes carry pre-P2 call-line / switcher details | runtime-only masking in the proof; production follows P2 / P4-C1 / P4-C2 |
| F-07 — the I-08B1 world's labels stay Arabic under English | the frozen world, out of P4 scope; the End-to-End audit may observe it |
| F-01, F-02, F-08, F-09 | resolved inside P4-C3 / P4-C3R |

**Known documentation nit, deliberately not repaired.** `docs/P4C3_PRODUCT_PROOF_REPORT.md` still says each registry row
carries "one of the five statuses", while the P4-C3R copy report and check C-COPY-4 record six status classes after
`APPROVED_BY_PO_P4C3` was added. The sentence is non-authoritative report wording. P4-C3R and P4-C4 hold the lifecycle
and approval truth, and the package is not rebuilt or resealed to change it.

## 7. P4-C4 — final copy

[P4-C4](QANDEEL_P4C4_FINAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md) ratifies **all 104** P4-owned rows that were
`PROPOSED_FOR_PO_REVIEW` in the pinned P4-C3R registry (head `ab9ec3f92eb6059cffe41a8c4d561c9053667f9e`, blob
`feaee4405d07db30bf7689257c866a7442bce927`), text unchanged. **No P4-owned Product copy remains awaiting Product
Owner approval.** Runtime-gated, audit-owned and fixture rows keep their dispositions.

## 8. APP-OPS-01 — closure

[`APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md`](../../../p4/APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md)
keeps its path, because existing links use it, and moves in this change to:

> **`APP-OPS-01 — CLOSED / FROZEN — QANDEEL APP ↔ QANDEEL COMPANY OPERATIONS PRODUCT / ARCHITECTURE CONTRACT`**

Its §23 conditions, verified on this closing change:

| # | Condition | State |
|---|---|---|
| 1 | Product Owner + independent review | complete |
| 2 | CW2-08A merged | merged through PR #278 at `576b010dcf78276c982f5052cfee7dd1bcbfcbcb` |
| 3 | every APP-OPS Product Owner decision resolved | `PO-OPS-01` … `19`; `P4-DQ-10` … `17` resolved (P4-B, P4-C2) |
| 4 | every APP-OPS carry-forward reconciled under BG-06 / BG-08 | §9 and the [Carry-Forward Matrix](../../../p4/P4_CARRY_FORWARD_MATRIX.md) §2.1 |
| 5 | the document advertises its final lifecycle state in the closing change | done in this change (BG-09) |
| 6 | `npm run test:task-closure-governance-contract` passes on the closing head | run on this change; the result is reported with it |

APP-OPS-01 freezes the boundary only. It still designs no schema, vendor, service, dashboard, Command Center UI,
retention number, threshold or Remote Configuration family, and implements nothing (its §20–§21).

---

## 9. Governance — BG-05, BG-08 and BG-09

**Kickoff (BG-05).** [`docs/qandeel-canonical-backlog-v1.md`](../../../qandeel-canonical-backlog-v1.md) was read in full.
No item names P4, P4-A … P4-C4 or APP-OPS-01 as its Owner task. **Inherited: none.**

**Existing items reused, never aliased.** Each P4 residue that an existing item already covers is recorded against it:

| Item | P4 residue it covers | Change in this closure |
|---|---|---|
| `QAN-BL-VOICE-01` | `P4-GAP-023` … `026`, `035`, `027`; signal-bearing Voice morphology (P4-C2 §4); Voice / call state strings (P4-C2 §5); F-03; APP-OPS call-status events | current truth gains a P4 reconciliation note naming these dependencies. Owner, status, severity and reopen condition unchanged |
| `QAN-BL-CTX-01` | `P4-GAP-065` | none. Admitted by P4-C1 itself, still `DEFERRED — OWNED` by `QAN-CTX-01`, because that runtime task has not opened |
| `QAN-BL-NAV-02` | `P4-GAP-041`; the Replay surface named «إعادة العرض» / Replay by P4-C3R | none. A name is not the surface; the item stays `OPEN — UNASSIGNED` |
| `QAN-BL-VIS-01` | `P4-GAP-042` | none |
| `QAN-BL-CW-01` | none — P4 has no bearing on it | none |
| `QAN-BL-SEC-01` | none — control-plane authentication is a different surface from mobile credential storage | none |

**Admitted: one, `QAN-BL-LANTERN-01` — Lantern Gateway Identity Moment v1.**

- **Why it qualifies (BG-06).** P4-C2 §2 explicitly defers a real obligation to a named future task: the lantern identity
  moment **is in v1**, and its design, motion, interaction, technology and proof belong to **QANDEEL — Lantern Gateway
  Identity Moment v1**. That is BG-06's second admission route, deferral to a future task by a canonical document, and it
  is an obligation, not an anti-scope sentence: v1 must contain the moment.
- **Why now (BG-08).** P4 closes and can no longer hold it; it may not live only in the P4-local matrix or a report.
- **Why it is not a laundered blocker (BG-01).** P4-C2 took the work out of P4 by Product Owner decision, and P4-C3 drew
  nothing past the lantern boundary by contract.
- **Severity `HIGH`.** Consequence, not schedule: if reopened, the work lands on a capability P4-C2 has frozen as present
  in v1, at the launch / gateway moment every user passes through, bounded by the static launch → system handoff P4
  froze. That is the backlog's `HIGH` definition ("an already-frozen capability", "release quality").
- **What the entry does not say.** No animation technology, choreography, timing, Q reveal behaviour, interaction
  mechanics, visual composition or implementation. Those belong to the task.

**Not admitted.** Each other P4 carry-forward was tested against BG-06's four routes:

| Candidate | Why it is not admitted |
|---|---|
| APP-OPS audit fields `Operational Events Required` / `Company Controls Required` | owned by the roadmap's End-to-End audit through `PO-OPS-11`; roadmap sequencing, not a backlog obligation |
| APP-OPS implementation: collectors, events, outbox domains, control plane, Command Center, RBAC, audit log | later implementation of a frozen contract, owned by Production Integration (`PO-OPS-12`). The same disposition as P2 §15 and P3 §20 |
| control authentication, signing, freshness / TTL, last-known-good, audit retention | Production Integration security design (`PO-OPS-15`); Release Hardening validation. Not `QAN-BL-SEC-01`, which owns mobile credential storage |
| user-diagnostic identifier format, pseudonymization, storage, query, retention | Production Integration security / privacy (`PO-OPS-13`) |
| the Approved Remote Configuration family register | a controlled-approval gate, not a deferred obligation: no family exists until Product Owner + Architecture approve one (`PO-OPS-18`, APP-OPS-01 §11), and nothing requires one to exist |
| release / OTA governance | code delivery is a release (`PO-OPS-19`); App Operations & Release Lead and Release Hardening own it. Whether OTA is ever adopted is a later release-operations decision, not an obligation |
| operational-readiness validation | Release Hardening (roadmap §5 already names it) |
| undrawn screens, journey copy, account lifecycle, economy, provider selection | the End-to-End audit, by the roadmap and P4-C2 §3 / §5 |
| device gates (VoiceOver / TalkBack, CallKit / Telecom, 320 pt large text, on-device icons, real Push, 48 dp targets) | Release Hardening, the disposition G1.2, G3, P2 and P3 already took |
| production ports and craft tuning | Production Integration |
| Connected Worlds-owned surfaces and launch policies | Connected Worlds `I-08` / `I-09`, owned by frozen contracts |
| orphaned VI-01 / VI-02 owners | re-owned in the Carry-Forward Matrix §2.2 (voice strings → `QAN-BL-VOICE-01`; casing resolved; screen-reader validation → Release Hardening) |

None of these carries an existing `OPEN` identifier, none is deferred to a named future task **as an obligation** by a
canonical document, none is carried forward for validation, and Architecture designated none.

**The backlog record.** The backlog carries the admission, the `QAN-BL-VOICE-01` note, its recounted §7, its §9 kickoff
row and a `### P4 — design-track BG-08 reconciliation` section. P4 is neither a `T-` task nor a Connected Worlds `I-0N`
phase, so `tests/task-closure-governance-contract.test.mjs` requires no P4 tombstone or phase heading, and none is
manufactured.

**BG-09.** This record is P4's primary canonical record. The same change moves the P4-local lifecycle documents —
[`P4_READ_FIRST.md`](../../../p4/P4_READ_FIRST.md), APP-OPS-01, the census, the carry-forward matrix, the decision
queue and the authority compatibility matrix — to their final state, and updates Current State, Project Map, the
Product Roadmap, the Canonical Authority Index, the Canonical Artifact Index and `docs/README.md`. No successor task is
left to synchronize any of these.

---

## 10. Downstream ownership after P4

**QANDEEL End-to-End Product Experience Completeness Audit** — the next roadmap phase. It owns the complete journey
audit, including launch / auth / first use; Settings and QANDEEL Understanding; Voice journey completeness; Shared World;
Public World; Introductions; Replay; Plans / Credits / usage visibility; failure / offline / interrupted states; account
lifecycle; and long-term return / recovery. It inherits APP-OPS-01's two gap-matrix fields, **`Operational Events
Required`** and **`Company Controls Required`** (`PO-OPS-11`), the user-facing Maintenance / Minimum Version moments
(`PO-OPS-16`), the evidence-led model / provider benchmark and selection, and the Plans / Credits / Usage Economy.

**Production Integration** — implementation of the frozen Product / Architecture contracts, including APP-OPS-01 where
sequenced after the audit (`PO-OPS-12`), the P4 shell / chrome, brand, static launch and non-signal Voice realization, and
the P4 ports and craft rows.

**Release Hardening & Launch** — device validation, operational readiness, control-plane validation and release / OTA
governance.

**Existing backlog owners, by their own identities** — `QAN-BL-VOICE-01`, `QAN-BL-CTX-01`, `QAN-BL-NAV-02`,
`QAN-BL-VIS-01`, `QAN-BL-CW-01`, `QAN-BL-SEC-01`.

**Connected Worlds `I-08` / `I-09`** — Matching / Introduction surfaces; moderation, report / block, entitlements and the
Launch Gate, bounded by CW2-08A.

**QANDEEL — Lantern Gateway Identity Moment v1** — the named standalone Product / Motion task, carried by
`QAN-BL-LANTERN-01`. It is not opened by this record.

**Product Owner + Architecture** — any Approved Remote Configuration family, by controlled approval, before it exists.

## 11. Explicit non-scope

This closure decides no lantern creative direction or technology; no Public, Shared, sign-up or first-use screen; no
model / provider winner, FAST / DEEP allocation or realtime / voice provider; no Plans / Credits formula, price or credit
unit; no OTA adoption; no Remote Configuration family set; no Voice runtime string; and no runtime-dependent speaking /
listening morphology. It re-renders nothing, re-runs no capture, and changes no production path (`apps/`, `packages/`,
`database/`, `infra/`), dependency, migration or schema. It does not start the End-to-End audit or Production
Integration.

## 12. Next-phase boundary

After the merge that carries this record, P1 – P4 are all `CLOSED / FROZEN` and the roadmap's next phase is the
**QANDEEL End-to-End Product Experience Completeness Audit**, which this record does not open. The roadmap's existing
sequencing is preserved unchanged: model / provider benchmark and selection with real QANDEEL workload evidence, and the
Plans / Credits / Usage Economy on real workload and provider-cost evidence, both inside that phase; Production
Integration after the audit; Release Hardening & Launch after that. A later explicit Product Owner decision may refine
that sequencing; this record does not.

## 13. Closure method (Skills Gate)

The installed skills were inspected before any closure work. None covers documentation governance, change control,
backlog reconciliation or architecture review. The design, motion and React Native skills do not apply to a
documentation-only closure, and the Arabic writing skills would apply only to new Arabic text: this record writes none,
and every Arabic string in it is quoted verbatim from the P4-C records. **No skill was used**, and none is claimed.

---

## 14. Closure

> **P4 — CLOSED / FROZEN — REMAINING PRODUCT / VISUAL GAPS CENSUS & CLOSURE COMPLETE**

- This is binding on the merge of the pull request that carries this record, after independent review.
- `APP-OPS-01` is `CLOSED / FROZEN` with it.
- P4 has no unresolved Product Owner decision, no unowned qualifying carry-forward and no P4-owned copy awaiting approval.
- Production implementation of everything P4 froze remains open, and the End-to-End audit has not started.
